// phys.js — Rack Attack v2 table physics (pure, no DOM/THREE): shared by the game (deep.js) and the QA solver.
// Same numbers as v1 (friction, cushions, restitution), plus posts, bumpers, corked pockets and ice/mud patches.
export const W = 5, L = 10, R = 0.18;
export const XB = W / 2 - R, ZB = L / 2 - R;
export const POCKETS = [[-W / 2 - 0.06, -L / 2 - 0.06, 0.5], [W / 2 + 0.06, -L / 2 - 0.06, 0.5], [-W / 2 - 0.14, 0, 0.44], [W / 2 + 0.14, 0, 0.44], [-W / 2 - 0.06, L / 2 + 0.06, 0.5], [W / 2 + 0.06, L / 2 + 0.06, 0.5]].map(([x, z, r]) => ({ x, z, r }));
export const HEAD = { x: 0, z: L / 4 }, FOOT = { x: 0, z: -L / 4 };
// v2 pockets are wider than v1's (a corner shot had a ±0.3° window): cushions stop CG from the corner, SG from the middle
export const CG = 0.95, SG = 0.62;
const inGapZ = z => Math.abs(z) < SG || Math.abs(z) > L / 2 - CG, inGapX = x => Math.abs(x) > W / 2 - CG;
export const H = 1 / 1200;

/** spec: { balls:[[n,x,z]], cue:[x,z], posts:[[x,z,r,kind?]], corks:[pocketIndex], zones:[[x,z,w,h,'ice'|'mud']] } */
export function makeWorld(spec) {
  const w = { balls: [], posts: [], zones: [], corks: spec.corks || [], rec: null, on: null, ctx: null };
  const add = (n, x, z) => { const b = { n, x, z, vx: 0, vz: 0, in: false, bank: 0, x0: x, z0: z, sx: x, sz: z }; w.balls.push(b); return b; };
  for (const [n, x, z] of spec.balls) add(n, x, z);
  w.cue = add(0, spec.cue[0], spec.cue[1]);
  for (const [x, z, r, kind] of spec.posts || []) w.posts.push({ x, z, r, kind: kind || 'post' });
  for (const i of w.corks) { const p = POCKETS[i]; w.posts.push({ x: p.x, z: p.z, r: Math.abs(p.z) < 1 ? 0.5 : 0.55, kind: 'cork', pocket: i }); }
  for (const [x, z, ww, hh, kind] of spec.zones || []) w.zones.push({ x, z, w: ww, h: hh, kind, f: kind === 'ice' ? 0.12 : 2.4 });
  return w;
}
export function cloneWorld(w) {
  const c = { ...w, balls: w.balls.map(b => ({ ...b })), rec: null, on: null };
  c.cue = c.balls.find(b => b.n === 0); return c;
}
export function zoneAt(w, x, z) { for (const q of w.zones) if (Math.abs(x - q.x) < q.w / 2 && Math.abs(z - q.z) < q.h / 2) return q; return null; }
export const open = (w, i) => !w.corks.includes(i);

export function step(w, dt) {
  const live = w.balls.filter(b => !b.in), rec = w.rec, on = w.on;
  for (const b of live) {
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0) { const zq = w.zones.length ? zoneAt(w, b.x, b.z) : null, f = zq ? zq.f : 1; const ns = Math.max(0, sp * Math.exp(-0.55 * f * dt) - 2.6 * f * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.x) > XB && !inGapZ(b.z)) { b.x = Math.sign(b.x) * XB; b.vx = -b.vx * 0.78; b.vz *= 0.95; b.bank++; if (rec) rec.rails++; if (on && on.rail) on.rail(b); }
    if (Math.abs(b.z) > ZB && !inGapX(b.x)) { b.z = Math.sign(b.z) * ZB; b.vz = -b.vz * 0.78; b.vx *= 0.95; b.bank++; if (rec) rec.rails++; if (on && on.rail) on.rail(b); }
    const ox = W / 2 + 0.2, oz = L / 2 + 0.2;
    if (Math.abs(b.x) > ox) { b.x = Math.sign(b.x) * ox; b.vx = -b.vx * 0.5; }
    if (Math.abs(b.z) > oz) { b.z = Math.sign(b.z) * oz; b.vz = -b.vz * 0.5; }
    for (const p of w.posts) {
      const dx = b.x - p.x, dz = b.z - p.z, rr = p.r + R, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-9) {
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d; b.x = p.x + nx * rr; b.z = p.z + nz * rr;
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
          const e = p.kind === 'bumper' ? 1.15 : 0.82; b.vx -= (1 + e) * vn * nx; b.vz -= (1 + e) * vn * nz;
          if (p.kind === 'bumper') { const s = Math.hypot(b.vx, b.vz); if (s < 3.2) { b.vx *= 3.2 / s; b.vz *= 3.2 / s; } }
          b.bank++; if (on && on.post) on.post(b, p, -vn);
        }
      }
    }
    for (let i = 0; i < POCKETS.length; i++) {
      const p = POCKETS[i]; if (w.corks.includes(i)) continue;
      const pd = Math.hypot(b.x - p.x, b.z - p.z);
      if (pd < p.r || (pd < p.r + 0.4 && (b.vx * (p.x - b.x) + b.vz * (p.z - b.z)) > 0.35 * pd * Math.hypot(b.vx, b.vz))) { b.in = true; b.vx = b.vz = 0; b.pocket = p; if (rec) { rec.potted.push(b.n); rec.info.push({ n: b.n, bank: b.bank, pocket: i, dist: rec.cueTravel }); } if (on && on.pot) on.pot(b, p); break; }
    }
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], c = live[j]; if (a.in || c.in) continue;
    const dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 < 4 * R * R && d2 > 1e-9) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = 2 * R - d;
      a.x -= nx * ov / 2; a.z -= nz * ov / 2; c.x += nx * ov / 2; c.z += nz * ov / 2;
      const rv = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
      if (rv > 0) {
        const k = rv * (1 + 0.96) / 2;
        a.vx -= k * nx; a.vz -= k * nz; c.vx += k * nx; c.vz += k * nz;
        if (rec && rec.first === null && (a === w.cue || c === w.cue)) rec.first = (a === w.cue ? c : a).n;
        if (rec) rec.hits++;
        if (on && on.hit) on.hit(a, c, rv);
      }
    }
  }
}
export const moving = w => w.balls.some(b => !b.in && Math.hypot(b.vx, b.vz) > 0.02);
export const shotSpeed = pw => 2 + pw * 17;

/** hit the cue ball and run the shot to rest (silent, for solver/AI); live game steps it itself. */
export function strike(w, angle, pw) {
  const c = w.cue; c.vx = Math.cos(angle) * shotSpeed(pw); c.vz = Math.sin(angle) * shotSpeed(pw);
  for (const b of w.balls) { b.bank = 0; b.x0 = b.x; b.z0 = b.z; }
  w.rec = { first: null, potted: [], info: [], rails: 0, hits: 0, cueTravel: 0 };
  return w.rec;
}
export function runShot(w, maxSteps = 14400) {
  for (let i = 0; i < maxSteps; i++) { step(w, H); if (i % 60 === 59 && !moving(w)) break; }
  for (const b of w.balls) b.vx = b.vz = 0;
  return w.rec;
}
export function free(w, x, z, skip) { return !w.balls.some(b => b !== skip && !b.in && Math.hypot(b.x - x, b.z - z) < 2.05 * R) && !w.posts.some(p => Math.hypot(p.x - x, p.z - z) < p.r + R) && Math.abs(x) < XB && Math.abs(z) < ZB; }
export function spotFor(w, b, hx, hz) {
  if (free(w, hx, hz, b)) return [hx, hz];
  for (let r = 0.1; r < 4; r += 0.1) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r; if (free(w, x, z, b)) return [x, z]; }
  return [hx, hz];
}

/** Trick-table rules after a shot: balls go in any order (8 last), or 1,2,3… when spec.order. An illegal pot goes back to its
 * start spot; a scratch puts the cue back where the shot began. Returns { good: legal pots, bad: [n], scratch, cleared }. */
export function resolveTrick(w, spec) {
  const rec = w.rec, out = { good: 0, bad: [], scratch: false, cleared: false, bank: 0, goodNs: [] };
  for (const info of rec.info) {
    const b = w.balls.find(x => x.n === info.n);
    if (b === w.cue) { out.scratch = true; continue; }
    const left = w.balls.filter(x => x !== w.cue && (!x.in || x.in === 'redo' || x === b) && !out.goodNs.includes(x.n)).map(x => x.n);
    const others = left.filter(n => n !== b.n);
    const legal = spec.order ? b.n === Math.min(...left) : (b.n !== 8 || others.length === 0);
    if (legal) { out.good++; out.goodNs.push(b.n); if (info.bank > 0) out.bank++; } else { out.bad.push(b.n); b.in = 'redo'; }
  }
  for (const b of w.balls) if (b.in === 'redo') { b.in = false; const [x, z] = spotFor(w, b, b.sx, b.sz); b.x = x; b.z = z; b.vx = b.vz = 0; }
  if (out.scratch) { const c = w.cue; c.in = false; const [x, z] = spotFor(w, c, c.x0, c.z0); c.x = x; c.z = z; c.vx = c.vz = 0; }
  out.cleared = !w.balls.some(b => b !== w.cue && !b.in);
  return out;
}

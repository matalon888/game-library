// Honk Out! deep v2 logic (no DOM, no three.js: runs in node for qa/bake.mjs and qa/check.mjs)
// A level = grid rows + legend. Vehicles leave along their arrow; cones never move; a sleepy vehicle (z:N) wakes once N
// vehicles have left the lot; a rainbow bus ('*') takes the next rider whatever the colour.
export const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
export const TYPES = { car: { len: 2, cap: 4 }, van: { len: 2, cap: 6 }, bus: { len: 3, cap: 10 } };
export const COLOR_NAMES = { red: 'r', blue: 'b', yellow: 'y', green: 'g', purple: 'p', orange: 'o', pink: 'k', cyan: 'c', '*': '*' };
export const FROM_INIT = Object.fromEntries(Object.entries(COLOR_NAMES).map(([k, v]) => [v, k]));
const CONE = 99;

export function parse(spec) {
  const rows = spec.rows, h = rows.length, w = rows[0].length, cones = [], cellsBy = {};
  rows.forEach((row, j) => { if (row.length !== w) throw new Error('ragged row'); [...row].forEach((ch, i) => { if (ch === '#') cones.push([i, j]); else if (ch !== '.') (cellsBy[ch] ||= []).push([i, j]); }); });
  const leg = {}; for (const e of spec.leg.split(/\s+/).filter(Boolean)) { const [k, d, c, z] = e.split(':'); leg[k] = { dir: d, color: c, z: z ? +z.slice(1) : 0 }; }
  const vs = [];
  for (const ch of Object.keys(cellsBy).sort()) {
    const L = leg[ch]; if (!L) throw new Error('no legend ' + ch);
    const both = L.dir === 'v' || L.dir === 'h'; if (both) L.dir = L.dir === 'v' ? 'u' : 'l';   // taxi: leaves by whichever end is clear
    const cs = cellsBy[ch], [dx, dz] = DIRS[L.dir]; cs.sort((a, b) => (b[0] * dx + b[1] * dz) - (a[0] * dx + a[1] * dz));   // head first
    const type = cs.length === 3 ? 'bus' : ch === ch.toUpperCase() ? 'van' : 'car';
    if (cs.length !== TYPES[type].len) throw new Error('bad length ' + ch);
    vs.push({ id: vs.length, ch, type, dir: L.dir, cells: cs, cap: TYPES[type].cap, both, color: FROM_INIT[L.color] ? FROM_INIT[L.color] : L.color, z: L.z });
  }
  return { w, h, slots: spec.slots || 5, cones, vs };
}
export const grid = (Ld) => { const g = Array.from({ length: Ld.w }, () => new Array(Ld.h).fill(-1)); Ld.cones.forEach(([i, j]) => g[i][j] = CONE); Ld.vs.forEach((v) => v.cells.forEach(([i, j]) => g[i][j] = v.id)); return g; };
export const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
export function clearWay(v, g, W_, H_, dir) {
  const [dx, dz] = DIRS[dir]; let [i, j] = dir === v.dir ? v.cells[0] : v.cells[v.cells.length - 1];
  for (;;) { i += dx; j += dz; if (i < 0 || j < 0 || i >= W_ || j >= H_) return true; const o = g[i][j]; if (o >= 0 && o !== v.id) return false; }
}
export function exitable(v, g, W_, H_) { return clearWay(v, g, W_, H_, v.dir) || (!!v.both && clearWay(v, g, W_, H_, OPP[v.dir])); }
export function rankFor(color, q, from, freeSeats) { if (color === '*') return from - 0.5; let need = freeSeats[color] || 0; for (let k = from; k < q.length; k++) if (q[k] === color) { if (need === 0) return k; need--; } return 1e9; }

// greedy player: park whichever free vehicle serves the queue soonest. Returns { ok, peak, taps }
export function simulate(Ld, q, rnd = null) {
  const { w: W_, h: H_, vs } = Ld, SL = Ld.slots, g = grid(Ld), rem = new Set(vs.map((v) => v.id)), parked = []; let k = 0, departed = 0, peak = 0;
  while (k < q.length) {
    for (;;) {
      if (k >= q.length) break;
      let pv = parked.find((p) => p.color === q[k] && p.seats > 0) || parked.find((p) => p.color === '*' && p.seats > 0); if (!pv) break;
      pv.seats--; k++; if (!pv.seats) parked.splice(parked.indexOf(pv), 1);
    }
    if (k >= q.length) break; if (parked.length >= SL) return { ok: false, peak };
    const free = [...rem].filter((id) => exitable(vs[id], g, W_, H_) && departed >= vs[id].z); if (!free.length) return { ok: false, peak };
    const fs = {}; parked.forEach((p) => { if (p.color !== '*') fs[p.color] = (fs[p.color] || 0) + p.seats; });
    let ranked = free.map((id) => vs[id]).map((v) => [rankFor(v.color, q, k, fs) + (rnd ? rnd() * 0.9 : 0), v]).sort((a, b) => a[0] - b[0]);
    const pick = ranked[0][1];
    rem.delete(pick.id); departed++; pick.cells.forEach(([i, j]) => g[i][j] = -1); parked.push({ color: pick.color, seats: pick.cap }); peak = Math.max(peak, parked.length);
  }
  return { ok: true, peak };
}
export function parPeak(Ld, q, rng) { let best = 99; const r = rng(7); for (let t = 0; t < 40; t++) { const s = simulate(Ld, q, t ? r : null); if (s.ok) best = Math.min(best, s.peak); } return best; }

// a casual player: mostly picks a car that serves the queue, sometimes any free car. Win rate over n runs.
export function casual(Ld, q, rnd, smart = 0.6) {
  const { w: W_, h: H_, vs } = Ld, SL = Ld.slots, g = grid(Ld), rem = new Set(vs.map((v) => v.id)), parked = []; let k = 0, departed = 0;
  while (k < q.length) {
    for (;;) { if (k >= q.length) break; let pv = parked.find((p) => p.color === q[k] && p.seats > 0) || parked.find((p) => p.color === '*' && p.seats > 0); if (!pv) break; pv.seats--; k++; if (!pv.seats) parked.splice(parked.indexOf(pv), 1); }
    if (k >= q.length) break; if (parked.length >= SL) return false;
    const free = [...rem].filter((id) => exitable(vs[id], g, W_, H_) && departed >= vs[id].z); if (!free.length) return false;
    let pick;
    if (rnd() < smart) { const fs = {}; parked.forEach((p) => { if (p.color !== '*') fs[p.color] = (fs[p.color] || 0) + p.seats; }); const near = free.map((id) => vs[id]).filter((v) => rankFor(v.color, q, k, fs) < k + 6); pick = near.length ? near[Math.floor(rnd() * near.length)] : vs[free[Math.floor(rnd() * free.length)]]; }
    else pick = vs[free[Math.floor(rnd() * free.length)]];
    rem.delete(pick.id); departed++; pick.cells.forEach(([i, j]) => g[i][j] = -1); parked.push({ color: pick.color, seats: pick.cap });
  }
  return true;
}
// passenger queue for an authored level: peel order (seeded choice among free vehicles), riders per vehicle, then a seeded mix
export function makeQueue(Ld, seed, mix, rng) {
  const R = rng(seed), { w: W_, h: H_, vs } = Ld, g = grid(Ld), rem = new Set(vs.map((v) => v.id)), order = []; let departed = 0;
  while (rem.size) {
    const free = [...rem].filter((id) => exitable(vs[id], g, W_, H_) && departed >= vs[id].z); if (!free.length) return null;
    const id = free[Math.floor(R() * free.length)]; rem.delete(id); order.push(id); departed++; vs[id].cells.forEach(([i, j]) => g[i][j] = -1);
  }
  const q = []; for (const id of order) if (vs[id].color !== '*') for (let k = 0; k < vs[id].cap; k++) q.push(vs[id].color);
  for (let i = 0; i < q.length; i++) if (mix && R() < 0.5) { const j = Math.min(q.length - 1, i + 1 + Math.floor(R() * mix)); [q[i], q[j]] = [q[j], q[i]]; }
  return q;
}
// bonus rooms after level 30 (and the daily): the v1 generator, fixed difficulty (never the tuner)
export function generate(n, seed, rng, CKEYS) {
  const R = rng(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const W_ = cl(3 + Math.ceil(n * 0.55), 4, 7), H_ = cl(4 + Math.ceil(n * 0.55), 5, 9), maxV = Math.min(4 + n * 2, 22), nc = cl(n + 1, 2, 7);
  const pal = [...CKEYS].sort(() => R() - 0.5).slice(0, nc), D = Object.keys(DIRS);
  for (let attempt = 0; attempt < 80; attempt++) {
    const g = Array.from({ length: W_ }, () => new Array(H_).fill(-1)), vs = [];
    for (let t = 0; t < 900 && vs.length < maxV; t++) {
      const type = R() < Math.min(0.35, 0.08 + n * 0.03) ? 'bus' : R() < 0.45 ? 'van' : 'car', len = TYPES[type].len, dir = D[ri(0, 3)], [dx, dz] = DIRS[dir], i0 = ri(0, W_ - 1), j0 = ri(0, H_ - 1);
      const cells = []; for (let k = 0; k < len; k++) cells.push([i0 - dx * k, j0 - dz * k]);
      if (cells.some(([i, j]) => i < 0 || j < 0 || i >= W_ || j >= H_ || g[i][j] >= 0)) continue;
      const v = { id: vs.length, type, dir, cells, cap: TYPES[type].cap, z: 0 }; vs.push(v); cells.forEach(([i, j]) => g[i][j] = v.id);
    }
    if (vs.length < 4) continue;
    const rem = new Set(vs.map((v) => v.id)), order = [];
    while (rem.size) {
      const free = [...rem].filter((id) => exitable(vs[id], g, W_, H_));
      if (free.length) { const id = free[ri(0, free.length - 1)]; rem.delete(id); order.push(id); vs[id].cells.forEach(([i, j]) => g[i][j] = -2); continue; }
      const id = [...rem][ri(0, rem.size - 1)], v = vs[id], opp = { u: 'd', d: 'u', l: 'r', r: 'l' }[v.dir], fl = { ...v, dir: opp, cells: [...v.cells].reverse() };
      if (exitable(fl, g, W_, H_)) { v.dir = opp; v.cells.reverse(); } else { rem.delete(id); v.cells.forEach(([i, j]) => g[i][j] = -1); v.dead = true; }
    }
    const live = vs.filter((v) => !v.dead); live.forEach((v, k) => v.nid = k); const L = live.map((v) => ({ ...v, id: v.nid }));
    const ord = order.filter((id) => !vs[id].dead).map((id) => vs[id].nid);
    ord.forEach((id, k) => { let c; do c = pal[ri(0, nc - 1)]; while (k && c === L[ord[k - 1]].color && nc > 1 && R() < 0.8); L[id].color = c; });
    const Ld = { w: W_, h: H_, slots: 5, cones: [], vs: L }, base = []; for (const id of ord) for (let k = 0; k < L[id].cap; k++) base.push(L[id].color);
    const mixW = Math.min(12, 2 + n);
    for (let tries = 0; tries < 12; tries++) { const qq = base.slice(), p = tries < 9 ? 0.5 : 0; for (let i = 0; i < qq.length; i++) if (R() < p) { const j = Math.min(qq.length - 1, i + ri(1, mixW)); [qq[i], qq[j]] = [qq[j], qq[i]]; } if (simulate(Ld, qq).ok) return { Ld, queue: qq }; }
  }
  throw new Error('generate failed');
}

// Pin Pals: pure bowling logic (no three.js). Scoring, the pin-deck physics used for the player's lane,
// scripted outcomes for agent lanes, and the "task cycle -> pins" rule. Original RIFFCADE code.

export const L = 12;            // foul line (z = 0) to the head pin (z = -L)
export const HALF = 0.53;       // half lane width
export const GUT = 0.12;        // gutter radius
export const BR = 0.108, PR = 0.06;
export const PIT = -L - 0.264 * 3 - 0.55;
export const WALL = HALF + GUT * 2 + 0.05;

// pin spots, index 0..9 = pins 1..10
export const SPOTS = [];
for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) SPOTS.push({ x: (j - row / 2) * 0.305, z: -L - row * 0.264, row });

// ------------------------------------------------------------------ scoring
export function status(r) {
  let i = 0;
  for (let f = 0; f < 9; f++) {
    if (i >= r.length) return { over: false, frame: f, ball: 0, standing: 10, fresh: true };
    if (r[i] === 10) { i++; continue; }
    if (i + 1 >= r.length) return { over: false, frame: f, ball: 1, standing: 10 - r[i], fresh: false };
    i += 2;
  }
  const t = r.slice(i), F = 9;
  if (t.length === 0) return { over: false, frame: F, ball: 0, standing: 10, fresh: true };
  if (t.length === 1) return t[0] === 10 ? { over: false, frame: F, ball: 1, standing: 10, fresh: true } : { over: false, frame: F, ball: 1, standing: 10 - t[0], fresh: false };
  if (t.length === 2) {
    if (t[0] === 10) return t[1] === 10 ? { over: false, frame: F, ball: 2, standing: 10, fresh: true } : { over: false, frame: F, ball: 2, standing: 10 - t[1], fresh: false };
    if (t[0] + t[1] === 10) return { over: false, frame: F, ball: 2, standing: 10, fresh: true };
    return { over: true, frame: 10, ball: 0, standing: 0, fresh: true };
  }
  return { over: true, frame: 10, ball: 0, standing: 0, fresh: true };
}
const d = n => n === 0 ? '-' : String(n);
/** 10 frames: { marks: [..], cum: number|null } */
export function frames(r) {
  const out = []; let i = 0, cum = 0, known = true;
  for (let f = 0; f < 10; f++) {
    const fr = { marks: [], cum: null };
    if (i >= r.length) { out.push(fr); known = false; continue; }
    if (f < 9) {
      if (r[i] === 10) {
        fr.marks = ['', 'X'];
        if (known && r[i + 2] !== undefined) { cum += 10 + r[i + 1] + r[i + 2]; fr.cum = cum; } else known = false;
        i++;
      } else {
        const a = r[i], b = r[i + 1];
        if (b === undefined) { fr.marks = [d(a), '']; known = false; i++; }
        else if (a + b === 10) { fr.marks = [d(a), '/']; if (known && r[i + 2] !== undefined) { cum += 10 + r[i + 2]; fr.cum = cum; } else known = false; i += 2; }
        else { fr.marks = [d(a), d(b)]; if (known) { cum += a + b; fr.cum = cum; } i += 2; }
      }
    } else {
      const t = r.slice(i), m = [];
      if (t[0] !== undefined) m.push(t[0] === 10 ? 'X' : d(t[0]));
      if (t[1] !== undefined) m.push(t[0] === 10 ? (t[1] === 10 ? 'X' : d(t[1])) : (t[0] + t[1] === 10 ? '/' : d(t[1])));
      if (t[2] !== undefined) m.push(t[0] === 10 && t[1] !== 10 ? (t[1] + t[2] === 10 ? '/' : d(t[2])) : (t[2] === 10 ? 'X' : d(t[2])));
      fr.marks = m;
      if (known && status(r).over) { cum += t.reduce((s, v) => s + v, 0); fr.cum = cum; }
      i = r.length;
    }
    out.push(fr);
  }
  return out;
}
export function total(r) { let s = 0; for (const f of frames(r)) if (f.cum != null) s = f.cum; return s; }
/** running score that also counts frames still waiting for bonus balls (for "live" totals) */
export function runningTotal(r) {
  let s = 0, i = 0;
  for (let f = 0; f < 10 && i < r.length; f++) {
    if (f === 9) { s += r.slice(i).reduce((a, b) => a + b, 0); break; }
    if (r[i] === 10) { s += 10 + (r[i + 1] || 0) + (r[i + 2] || 0); i++; }
    else if (r[i] + (r[i + 1] || 0) === 10 && r[i + 1] !== undefined) { s += 10 + (r[i + 2] || 0); i += 2; }
    else { s += r[i] + (r[i + 1] || 0); i += 2; }
  }
  return s;
}

// ------------------------------------------------------------------ rng
export function rng(seed) { let s = (Math.floor(Math.abs(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ------------------------------------------------------------------ split detection (head pin down + standing pins not touching)
export function isSplit(mask) {
  const st = []; for (let i = 0; i < 10; i++) if (mask & (1 << i)) st.push(i);
  if (st.length < 2 || (mask & 1)) return false;
  const seen = new Set([st[0]]), q = [st[0]];
  while (q.length) { const a = q.pop(); for (const b of st) if (!seen.has(b) && Math.hypot(SPOTS[a].x - SPOTS[b].x, SPOTS[a].z - SPOTS[b].z) < 0.31) { seen.add(b); q.push(b); } }
  return seen.size < st.length;
}
const maskOf = arr => arr.reduce((m, n) => m | (1 << (n - 1)), 0);
const SPLITS = [[7, 10], [4, 6], [6, 7], [4, 10], [8, 10], [7, 9], [4, 7, 10], [6, 7, 10]].map(maskOf);
const LEAVES1 = [10, 7, 10, 7, 4, 6, 9, 8].map(n => maskOf([n]));
const LEAVES2 = [[6, 10], [4, 7], [2, 8], [3, 10], [2, 4], [3, 6], [3, 9], [1, 2]].map(maskOf);
const count = m => { let c = 0; for (let i = 0; i < 10; i++) if (m & (1 << i)) c++; return c; };
export const bits = count;

/** which of the standing pins (mask) fall, knocking exactly k. Returns the mask of pins that FALL. */
export function pickFall(standing, k, R, splitChance = 0.35) {
  const n = count(standing);
  if (k >= n) return standing;
  if (k <= 0) return 0;
  const leave = n - k;
  if (standing === 1023) {
    const pool = (leave === 1 ? LEAVES1 : leave === 2 ? (R() < splitChance ? SPLITS.filter(m => count(m) === 2) : LEAVES2) : leave === 3 && R() < splitChance ? SPLITS.filter(m => count(m) === 3) : null);
    if (pool && pool.length) return 1023 & ~pool[(R() * pool.length) | 0];
  }
  // otherwise keep the pins that are furthest back / on the edges standing
  const st = []; for (let i = 0; i < 10; i++) if (standing & (1 << i)) st.push(i);
  st.sort((a, b) => (R() * 0.8 + SPOTS[b].row * 0.35 + Math.abs(SPOTS[b].x) * 1.2) - (R() * 0.8 + SPOTS[a].row * 0.35 + Math.abs(SPOTS[a].x) * 1.2));
  let keep = 0; for (let i = 0; i < leave; i++) keep |= 1 << st[i];
  return standing & ~keep;
}

// ------------------------------------------------------------------ a finished task cycle -> pins
// c = { n, ok, test, commit, deploy } (results in the cycle). st = status(rolls) before the ball.
export function outcome(c, st, R) {
  const r = c.n ? c.ok / c.n : 0;
  let pins, tag;
  if (st.fresh) {
    // real agent logs are nearly all OK, so a clean cycle strikes like a good league bowler (~55%), not every time;
    // passing tests is the sure strike
    if (c.test) pins = 10;
    else if (r >= 1) pins = R() < 0.55 ? 10 : 8 + (R() < 0.6 ? 1 : 0);
    else if (r >= 0.8) pins = 7 + (R() < 0.5 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
    else if (r >= 0.6) pins = 6 + ((R() * 3) | 0);
    else if (r >= 0.3) pins = 3 + ((R() * 4) | 0);
    else if (r >= 0.15) pins = (R() * 3) | 0;
    else pins = 0;
    tag = pins === 10 ? 'strike' : pins === 0 ? 'gutter' : 'open';
  } else {
    const s = st.standing;
    if (c.test || r >= 1) pins = R() < 0.8 ? s : Math.max(0, s - 1);
    else if (r >= 0.8) pins = R() < 0.6 ? s : Math.max(0, s - 1);
    else if (r >= 0.5) pins = Math.min(s - 1, Math.round(s * r * (0.4 + R() * 0.5)));
    else if (r >= 0.2) pins = Math.min(s - 1, Math.floor(s * 0.35 * R()));
    else pins = 0;
    pins = Math.max(0, pins);
    tag = pins === s ? 'spare' : pins === 0 ? 'gutter' : 'open';
  }
  return { pins, tag, ratio: r };
}

// ------------------------------------------------------------------ the pin-deck simulation (2D top-down; the view adds tilt + hops)
// pins: [{ i, x, z, vx, vz, down, out, stand }] ; ball: { x, z, vx, vz, spin, gutter, gone }
// scripted lanes pass `fall` (mask of pins that must fall, others are immovable) and skip the ball physics on pins.
export function makeRack(mask = 1023) {
  return SPOTS.map((s, i) => ({ i, x: s.x, z: s.z, vx: 0, vz: 0, down: false, out: false, stand: !!(mask & (1 << i)), hitT: -1, hop: 0 }));
}
export class Deck {
  constructor(pins, ball, { fall = null, R = Math.random } = {}) {
    this.pins = pins; this.ball = ball; this.fall = fall; this.R = R; this.t = 0; this.hitT = -1; this.events = []; this.done = false;
    this.startMask = pins.reduce((m, p) => p.stand && !p.down ? m | (1 << p.i) : m, 0);
  }
  knock(p, vx, vz, t, strength) {
    if (p.down) return;
    p.down = true; p.hitT = t; p.vx = vx; p.vz = vz; p.hop = Math.min(1.6, strength * 0.35) * (0.4 + this.R() * 0.8);
    this.events.push({ type: 'pin', i: p.i, s: strength });
  }
  step(dt) {
    const b = this.ball, R = this.R; this.t += dt;
    // ---- ball
    if (!b.gone) {
      if (!b.gutter && b.z < -L * 0.5 && b.z > -L) b.vx += b.spin * 1.25 * dt;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (!b.gutter && Math.abs(b.x) > HALF - 0.01) { b.gutter = true; b.x = Math.sign(b.x) * (HALF + GUT * 0.55); b.vx = 0; this.events.push({ type: 'gutter' }); }
      if (b.gutter && b.z < -L + 0.4) { /* gutter ball passes the deck */ }
      if (b.z < PIT) { b.gone = true; this.events.push({ type: 'pit' }); }
    }
    // ---- ball vs pins
    const standing = this.pins.filter(p => p.stand && !p.out);
    if (!b.gone && !b.gutter) {
      for (const p of standing) {
        const dx = p.x - b.x, dz = p.z - b.z, dist = Math.hypot(dx, dz), rr = BR + (p.down ? 0.1 : PR);
        if (dist < rr && dist > 1e-6) {
          const nx = dx / dist, nz = dz / dist;
          if (this.fall && !(this.fall & (1 << p.i)) && !p.down) continue;   // scripted: non-falling pins are ghosts for the ball
          const vrel = (p.vx - b.vx) * nx + (p.vz - b.vz) * nz;
          if (vrel < 0) {
            const mb = 7, mp = 1.5, e = 0.75, j = -(1 + e) * vrel / (1 / mb + 1 / mp);
            b.vx -= j / mb * nx; b.vz -= j / mb * nz;
            const sc = 1 + (R() - 0.5) * 0.5, rot = (R() - 0.5) * 0.5, px = j / mp * nx * sc, pz = j / mp * nz * sc;
            const vx = p.vx + px * Math.cos(rot) - pz * Math.sin(rot), vz = p.vz + px * Math.sin(rot) + pz * Math.cos(rot);
            if (!p.down) { this.knock(p, vx, vz, this.t, Math.abs(j)); if (this.hitT < 0) this.hitT = this.t; } else { p.vx = vx; p.vz = vz; }
          }
          const push = rr - dist; p.x += nx * push; p.z += nz * push;
        }
      }
    }
    // ---- scripted lanes: falling pins the ball did not touch go down as the wave reaches them
    if (this.fall && !b.gutter && b.z < -L + 0.3) {
      if (this.hitT < 0) this.hitT = this.t;
      for (const p of standing) if (!p.down && (this.fall & (1 << p.i))) {
        const delay = 0.04 + SPOTS[p.i].row * 0.07 + Math.abs(p.x - b.x) * 0.12;
        if (this.t - this.hitT > delay) { const dx = p.x - b.x; this.knock(p, Math.sign(dx || (R() - 0.5)) * (0.6 + R() * 1.4) + dx * 2, -(1 + R() * 2.4), this.t, 2 + R() * 3); }
      }
    }
    if (this.fall && this.t > (this.hitT > 0 ? this.hitT + 0.5 : 2.2)) for (const p of standing) if (!p.down && (this.fall & (1 << p.i))) this.knock(p, (R() - 0.5) * 2, -(1 + R() * 2), this.t, 2);
    // ---- pins vs pins, walls, pit
    for (let a = 0; a < standing.length; a++) {
      const p = standing[a];
      for (let c = a + 1; c < standing.length; c++) {
        const q = standing[c]; if (!p.down && !q.down) continue;
        const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz), rr = (p.down ? 0.1 : PR) + (q.down ? 0.1 : PR);
        if (dist >= rr || dist < 1e-6) continue;
        const nx = dx / dist, nz = dz / dist, vrel = (q.vx - p.vx) * nx + (q.vz - p.vz) * nz;
        const pFix = this.fall && !p.down && !(this.fall & (1 << p.i)), qFix = this.fall && !q.down && !(this.fall & (1 << q.i));
        if (vrel < 0) {
          const e = 0.55, im1 = pFix ? 0 : 1, im2 = qFix ? 0 : 1, j = -(1 + e) * vrel / (im1 + im2 || 1);
          const rot = (R() - 0.5) * 0.6, cr = Math.cos(rot), sr = Math.sin(rot);
          const ix = (nx * cr - nz * sr) * j, iz = (nx * sr + nz * cr) * j;
          if (!pFix) { p.vx -= ix * im1; p.vz -= iz * im1; }
          if (!qFix) { q.vx += ix * im2; q.vz += iz * im2; }
          if (Math.abs(j) > 0.25) { if (!p.down && !pFix) this.knock(p, p.vx, p.vz, this.t, Math.abs(j)); if (!q.down && !qFix) this.knock(q, q.vx, q.vz, this.t, Math.abs(j)); }
        }
        const push = (rr - dist) / ((pFix ? 0 : 1) + (qFix ? 0 : 1) || 1);
        if (!pFix) { p.x -= nx * push; p.z -= nz * push; } if (!qFix) { q.x += nx * push; q.z += nz * push; }
      }
    }
    for (const p of standing) {
      if (!p.down) continue;
      p.x += p.vx * dt; p.z += p.vz * dt;
      const f = Math.exp(-dt * 1.7); p.vx *= f; p.vz *= f;
      if (Math.abs(p.x) > WALL) { p.x = Math.sign(p.x) * WALL; p.vx = -p.vx * 0.45; this.events.push({ type: 'wall' }); }
      if (p.z > -L + 0.9) { p.z = -L + 0.9; p.vz = -Math.abs(p.vz) * 0.3; }
      if (p.z < PIT) { p.out = true; }
    }
    // ---- settle
    const moving = standing.some(p => p.down && !p.out && Math.hypot(p.vx, p.vz) > 0.06);
    if ((b.gone && !moving && this.t > 0.3 && (this.hitT < 0 || this.t - this.hitT > 1.1)) || this.t > 7) this.done = true;
  }
  /** pins (mask) that fell this ball */
  fallen() { return this.pins.reduce((m, p) => p.stand && p.down ? m | (1 << p.i) : m, 0); }
}

/** the player's throw -> initial ball. aimX: release x; slope: aim angle (x per z); power 0..1; spin -1..1 */
export function throwBall(aimX, slope, power, spin) {
  const vz = -(6 + power * 5);
  return { x: aimX, z: 0, vx: -vz * slope, vz, spin, gutter: false, gone: false };
}

/** for agent lanes: a believable ball line that ends where the falling pins are */
export function scriptBall(standing, fall, R) {
  if (!fall) {
    // gutter ball or a clean miss of what is left
    const side = R() < 0.5 ? -1 : 1;
    if (R() < 0.6 || standing === 1023) return { x: side * 0.25, z: 0, vx: side * 0.45, vz: -7.5, spin: 0, gutter: false, gone: false };
    let mx = 0, n = 0; for (let i = 0; i < 10; i++) if (standing & (1 << i)) { mx += SPOTS[i].x; n++; }
    const tx = (n ? mx / n : 0) + (mx >= 0 ? -0.36 : 0.36);
    return { x: tx * 0.5, z: 0, vx: (tx - tx * 0.5) / L * 7.5, vz: -7.5, spin: 0, gutter: false, gone: false };
  }
  let tx, best = 9;
  for (let i = 0; i < 10; i++) if (fall & (1 << i)) { const r = SPOTS[i].row + Math.abs(SPOTS[i].x) * 0.2; if (r < best) { best = r; tx = SPOTS[i].x; } }
  if (fall === 1023 || (fall & 1)) tx = 0.07 * (R() < 0.85 ? 1 : -1);   // pocket
  const x0 = tx + 0.22 + R() * 0.12, spin = -0.55 - R() * 0.25, vz = -7.6;
  // aim so the hook lands on tx: hook acts over the back half (time th), offset = spin*1.25*th^2/2
  const T = L / -vz, th = (L * 0.5) / -vz, hook = spin * 1.25 * th * th / 2 + spin * 1.25 * th * 0;
  const vx = (tx - x0 - hook) / T;
  return { x: x0, z: 0, vx, vz, spin, gutter: false, gone: false };
}

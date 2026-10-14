// physics.js — Fort Fling's own tiny 2D rigid-body engine (oriented boxes + circles).
// SAT + reference-face clipping for box/box, closest-point for circle/box, sequential impulses with
// accumulated clamping, warm starting (contacts matched by feature id), speculative contacts (no tunnelling),
// Baumgarte position bias, restitution, Coulomb friction, and whole-world sleeping so stacks stand dead still.
let NEXT_ID = 1;
const MARGIN = 0.04;          // speculative contact distance
const SLOP = 0.008, BETA = 0.2;

function baseBody(x, y, o) {
  return { id: NEXT_ID++, x, y, a: o.angle || 0, vx: 0, vy: 0, w: 0, fric: o.fric ?? 0.6, rest: o.rest ?? 0.1,
    isStatic: !!o.isStatic, asleep: false, user: o.user || null, invM: 0, invI: 0, m: 0 };
}
export function makeBox(x, y, w, h, o = {}) {
  const b = baseBody(x, y, o); b.shape = 'box'; b.hw = w / 2; b.hh = h / 2;
  if (!b.isStatic) { const d = o.density ?? 1; b.m = w * h * d; b.invM = 1 / b.m; const I = b.m * (w * w + h * h) / 12; b.invI = 1 / I; }
  b.bound = Math.hypot(b.hw, b.hh); return b;
}
export function makeCircle(x, y, r, o = {}) {
  const b = baseBody(x, y, o); b.shape = 'circle'; b.r = r;
  if (!b.isStatic) { const d = o.density ?? 1; b.m = Math.PI * r * r * d; b.invM = 1 / b.m; b.invI = 1 / (0.5 * b.m * r * r); }
  b.bound = r; return b;
}

// ---------------------------------------------------------------- narrow phase
const LX = [-1, 1, 1, -1], LY = [-1, -1, 1, 1], NX = [0, 1, 0, -1], NY = [-1, 0, 1, 0];
function polyOf(b) {
  const c = Math.cos(b.a), s = Math.sin(b.a), vx = [], vy = [], nx = [], ny = [];
  for (let i = 0; i < 4; i++) {
    const lx = LX[i] * b.hw, ly = LY[i] * b.hh;
    vx.push(b.x + c * lx - s * ly); vy.push(b.y + s * lx + c * ly);
    nx.push(c * NX[i] - s * NY[i]); ny.push(s * NX[i] + c * NY[i]);
  }
  return { vx, vy, nx, ny };
}
function maxSep(A, B) {
  let best = -1e9, edge = 0;
  for (let i = 0; i < 4; i++) {
    let mn = 1e9;
    for (let j = 0; j < 4; j++) { const d = A.nx[i] * (B.vx[j] - A.vx[i]) + A.ny[i] * (B.vy[j] - A.vy[i]); if (d < mn) mn = d; }
    if (mn > best) { best = mn; edge = i; }
  }
  return [best, edge];
}
function clip(pts, nx, ny, off, clipId) {
  const out = [];
  const d0 = nx * pts[0].x + ny * pts[0].y - off, d1 = nx * pts[1].x + ny * pts[1].y - off;
  if (d0 <= 0) out.push(pts[0]); if (d1 <= 0) out.push(pts[1]);
  if (d0 * d1 < 0) { const t = d0 / (d0 - d1); out.push({ x: pts[0].x + t * (pts[1].x - pts[0].x), y: pts[0].y + t * (pts[1].y - pts[0].y), id: clipId }); }
  return out;
}
function boxBox(a, b) {
  const A = polyOf(a), B = polyOf(b);
  const [sA, eA] = maxSep(A, B); if (sA > MARGIN) return null;
  const [sB, eB] = maxSep(B, A); if (sB > MARGIN) return null;
  let R, I, edge, flip;
  if (sB > 0.98 * sA + 0.001) { R = B; I = A; edge = eB; flip = 1; } else { R = A; I = B; edge = eA; flip = 0; }
  const nx = R.nx[edge], ny = R.ny[edge];
  let ie = 0, mn = 1e9;
  for (let i = 0; i < 4; i++) { const d = nx * I.nx[i] + ny * I.ny[i]; if (d < mn) { mn = d; ie = i; } }
  const i2 = (ie + 1) % 4;
  let pts = [{ x: I.vx[ie], y: I.vy[ie], id: ie }, { x: I.vx[i2], y: I.vy[i2], id: i2 }];
  const e2 = (edge + 1) % 4, v1x = R.vx[edge], v1y = R.vy[edge], v2x = R.vx[e2], v2y = R.vy[e2];
  let tx = v2x - v1x, ty = v2y - v1y; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
  pts = clip(pts, -tx, -ty, -(tx * v1x + ty * v1y), 8); if (pts.length < 2) return null;
  pts = clip(pts, tx, ty, tx * v2x + ty * v2y, 9); if (pts.length < 2) return null;
  const front = nx * v1x + ny * v1y, out = [];
  for (const p of pts) {
    const s = nx * p.x + ny * p.y - front;
    if (s <= MARGIN) out.push({ px: p.x - nx * s * 0.5, py: p.y - ny * s * 0.5, sep: s, id: (flip << 8) | (edge << 4) | p.id });
  }
  return out.length ? { nx: flip ? -nx : nx, ny: flip ? -ny : ny, pts: out } : null;
}
function boxCircle(a, b) {   // normal from box a to circle b
  const c = Math.cos(a.a), s = Math.sin(a.a), dx = b.x - a.x, dy = b.y - a.y;
  const lx = c * dx + s * dy, ly = -s * dx + c * dy;
  const qx = Math.max(-a.hw, Math.min(a.hw, lx)), qy = Math.max(-a.hh, Math.min(a.hh, ly));
  let nlx, nly, sep, plx = qx, ply = qy;
  if (qx === lx && qy === ly) {   // centre inside the box
    const ex = a.hw - Math.abs(lx), ey = a.hh - Math.abs(ly);
    if (ex < ey) { nlx = Math.sign(lx) || 1; nly = 0; sep = -ex - b.r; plx = nlx * a.hw; }
    else { nlx = 0; nly = Math.sign(ly) || 1; sep = -ey - b.r; ply = nly * a.hh; }
  } else {
    const ddx = lx - qx, ddy = ly - qy, d = Math.hypot(ddx, ddy);
    sep = d - b.r; if (sep > MARGIN) return null; nlx = ddx / d; nly = ddy / d;
  }
  const nx = c * nlx - s * nly, ny = s * nlx + c * nly;
  return { nx, ny, pts: [{ px: a.x + c * plx - s * ply, py: a.y + s * plx + c * ply, sep, id: 0 }] };
}
function circleCircle(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, sep = d - a.r - b.r;
  if (sep > MARGIN) return null;
  const nx = dx / d, ny = dy / d;
  return { nx, ny, pts: [{ px: a.x + nx * a.r, py: a.y + ny * a.r, sep, id: 0 }] };
}

// ---------------------------------------------------------------- world
export class World {
  constructor({ gravity = -18, iterations = 10 } = {}) {
    this.g = gravity; this.it = iterations; this.bodies = []; this.arb = new Map(); this.calm = 0;
    this.onWake = null; this.onHit = null; this.sleeping = false;
  }
  add(b) { this.bodies.push(b); if (this.sleeping && !b.isStatic) b.asleep = true; return b; }
  remove(b) {
    const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1);
    for (const [k, a] of this.arb) if (a.A === b || a.B === b) this.arb.delete(k);
    b.removed = true;
  }
  sleepAll() { this.sleeping = true; for (const b of this.bodies) if (!b.isStatic && !b.noSleep) { b.asleep = true; b.vx = b.vy = b.w = 0; } }
  wakeAll() { if (!this.sleeping) return; this.sleeping = false; this.calm = 0; for (const b of this.bodies) b.asleep = false; this.onWake && this.onWake(); }
  // treat static and sleeping bodies as immovable
  _im(b) { return b.isStatic || b.asleep; }

  collide() {
    const B = this.bodies, n = B.length, seen = new Set();
    for (let i = 0; i < n; i++) {
      const a = B[i];
      for (let j = i + 1; j < n; j++) {
        const b = B[j];
        if (this._im(a) && this._im(b)) continue;
        const r = a.bound + b.bound + MARGIN;
        if (!(a.isStatic || b.isStatic) && (a.x - b.x) ** 2 + (a.y - b.y) ** 2 > r * r) continue;
        if (a.isStatic && a.shape === 'box' && b.shape !== 'box' && Math.abs(b.y - a.y) > a.hh + b.bound + MARGIN && a.a === 0) continue;
        let A = a, Bb = b, m;
        if (A.shape === 'circle' && Bb.shape === 'box') { A = b; Bb = a; }
        if (A.shape === 'box' && Bb.shape === 'box') m = boxBox(A, Bb);
        else if (A.shape === 'box') m = boxCircle(A, Bb);
        else m = circleCircle(A, Bb);
        const key = A.id < Bb.id ? A.id * 100000 + Bb.id : Bb.id * 100000 + A.id;
        if (!m) { this.arb.delete(key); continue; }
        // a moving body touching the sleeping world wakes it
        if ((A.asleep && !Bb.asleep && !Bb.isStatic) || (Bb.asleep && !A.asleep && !A.isStatic)) {
          const mover = A.asleep ? Bb : A;
          if (m.pts.some(p => p.sep < 0.01) && (Math.hypot(mover.vx, mover.vy) > 0.6 || mover.forceWake)) this.wakeAll();
        }
        seen.add(key);
        const old = this.arb.get(key), cs = m.pts.map(p => ({ ...p, Pn: 0, Pt: 0 }));
        if (old && old.A === A) for (const c of cs) { const o = old.cs.find(q => q.id === c.id); if (o) { c.Pn = o.Pn; c.Pt = o.Pt; } }
        this.arb.set(key, { A, B: Bb, nx: m.nx, ny: m.ny, cs, fric: Math.sqrt(A.fric * Bb.fric), rest: Math.max(A.rest, Bb.rest) });
      }
    }
    for (const k of this.arb.keys()) if (!seen.has(k)) this.arb.delete(k);
  }

  step(h) {
    const inv = 1 / h, g = this.g;
    this.collide();
    for (const b of this.bodies) if (!this._im(b)) { b.vy += g * h; b.w *= 0.995; }
    // pre-step
    for (const a of this.arb.values()) {
      const A = a.A, B = a.B, iA = this._im(A), iB = this._im(B);
      const mA = iA ? 0 : A.invM, mB = iB ? 0 : B.invM, IA = iA ? 0 : A.invI, IB = iB ? 0 : B.invI;
      a.mA = mA; a.mB = mB; a.IA = IA; a.IB = IB;
      const nx = a.nx, ny = a.ny, tx = ny, ty = -nx;
      for (const c of a.cs) {
        c.rax = c.px - A.x; c.ray = c.py - A.y; c.rbx = c.px - B.x; c.rby = c.py - B.y;
        const rnA = c.rax * ny - c.ray * nx, rnB = c.rbx * ny - c.rby * nx;
        c.mn = 1 / (mA + mB + IA * rnA * rnA + IB * rnB * rnB);
        const rtA = c.rax * ty - c.ray * tx, rtB = c.rbx * ty - c.rby * tx;
        c.mt = 1 / (mA + mB + IA * rtA * rtA + IB * rtB * rtB);
        const dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray, dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
        const vn = dvx * nx + dvy * ny;
        c.bias = c.sep > 0 ? -c.sep * inv : BETA * inv * Math.max(0, -c.sep - SLOP);
        if (vn < -1.8 && c.sep < 0.02) c.bias = Math.max(c.bias, -a.rest * vn);
        if (c.sep > 0) { c.Pn = 0; c.Pt = 0; }
        c.impact = 0;
        // warm start
        const Px = c.Pn * nx + c.Pt * tx, Py = c.Pn * ny + c.Pt * ty;
        A.vx -= mA * Px; A.vy -= mA * Py; A.w -= IA * (c.rax * Py - c.ray * Px);
        B.vx += mB * Px; B.vy += mB * Py; B.w += IB * (c.rbx * Py - c.rby * Px);
      }
    }
    // iterate
    for (let k = 0; k < this.it; k++) {
      for (const a of this.arb.values()) {
        const A = a.A, B = a.B, nx = a.nx, ny = a.ny, tx = ny, ty = -nx, mA = a.mA, mB = a.mB, IA = a.IA, IB = a.IB;
        for (const c of a.cs) {
          let dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray, dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
          const vn = dvx * nx + dvy * ny;
          let dPn = c.mn * (-vn + c.bias);
          const P0 = c.Pn; c.Pn = Math.max(P0 + dPn, 0); dPn = c.Pn - P0; c.impact += Math.max(0, dPn);
          let Px = dPn * nx, Py = dPn * ny;
          A.vx -= mA * Px; A.vy -= mA * Py; A.w -= IA * (c.rax * Py - c.ray * Px);
          B.vx += mB * Px; B.vy += mB * Py; B.w += IB * (c.rbx * Py - c.rby * Px);
          dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray; dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
          const vt = dvx * tx + dvy * ty;
          let dPt = c.mt * -vt; const maxPt = a.fric * c.Pn;
          const T0 = c.Pt; c.Pt = Math.max(-maxPt, Math.min(maxPt, T0 + dPt)); dPt = c.Pt - T0;
          Px = dPt * tx; Py = dPt * ty;
          A.vx -= mA * Px; A.vy -= mA * Py; A.w -= IA * (c.rax * Py - c.ray * Px);
          B.vx += mB * Px; B.vy += mB * Py; B.w += IB * (c.rbx * Py - c.rby * Px);
        }
      }
    }
    // report impacts (impulse beyond the warm-started resting load)
    if (this.onHit) for (const a of this.arb.values()) {
      let s = 0; for (const c of a.cs) s += c.impact;
      if (s > 0.25) this.onHit(a.A, a.B, s, a.cs[0].px, a.cs[0].py);
    }
    // integrate
    let maxV = 0;
    for (const b of this.bodies) {
      if (this._im(b)) continue;
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
      if (!b.noSleep) maxV = Math.max(maxV, Math.abs(b.vx) + Math.abs(b.vy), Math.abs(b.w) * (b.bound || 0.5));
    }
    if (!this.sleeping) { if (maxV < 0.12) this.calm += h; else this.calm = 0; if (this.calm > 0.5) this.sleepAll(); }
  }
}

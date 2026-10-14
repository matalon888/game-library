// physics.js — tiny 2D rigid-body engine for Smooch Roll (our own code).
// Dynamic bodies are rigid sets of circles ("parts"): a ball is one circle, a drawn ink stroke is a chain of small circles.
// Statics are circles, rotated boxes and capsules. Sequential impulses with friction + rotation, fixed substeps (no tunnelling).
export const INK_R = 4.6, SPACING = 4.2, BALL_R = 22, INK_DENSITY = 0.022;

function bb(s) {
  if (s.t === 'c') return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
  if (s.t === 's') return [Math.min(s.ax, s.bx) - s.r, Math.min(s.ay, s.by) - s.r, Math.max(s.ax, s.bx) + s.r, Math.max(s.ay, s.by) + s.r];
  const c = Math.abs(Math.cos(s.a)), n = Math.abs(Math.sin(s.a)), ex = s.hw * c + s.hh * n, ey = s.hw * n + s.hh * c;
  return [s.x - ex, s.y - ey, s.x + ex, s.y + ey];
}
export function makeStatic(s) { s = { ...s }; if (s.t === 'b') { s.c = Math.cos(s.a || 0); s.s = Math.sin(s.a || 0); s.a = s.a || 0; } s.bb = bb(s); return s; }

/** circle (cx,cy,cr) vs static shape → null | {nx,ny,pen,px,py}; n points from the shape toward the circle */
export function hitStatic(s, cx, cy, cr) {
  if (cx + cr < s.bb[0] || cx - cr > s.bb[2] || cy + cr < s.bb[1] || cy - cr > s.bb[3]) return null;
  if (s.t === 'c' || s.t === 's') {
    let qx = s.x, qy = s.y;
    if (s.t === 's') {
      const ex = s.bx - s.ax, ey = s.by - s.ay, L = ex * ex + ey * ey;
      const t = L ? Math.max(0, Math.min(1, ((cx - s.ax) * ex + (cy - s.ay) * ey) / L)) : 0;
      qx = s.ax + ex * t; qy = s.ay + ey * t;
    }
    const dx = cx - qx, dy = cy - qy, d = Math.hypot(dx, dy), pen = s.r + cr - d;
    if (pen <= 0) return null;
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1;
    return { nx, ny, pen, px: cx - nx * cr, py: cy - ny * cr };
  }
  // rotated box
  const rx = cx - s.x, ry = cy - s.y, lx = rx * s.c + ry * s.s, ly = -rx * s.s + ry * s.c;
  const qx = Math.max(-s.hw, Math.min(s.hw, lx)), qy = Math.max(-s.hh, Math.min(s.hh, ly));
  let nlx, nly, pen;
  if (qx === lx && qy === ly) {           // centre inside: push out along the shallow axis
    const ox = s.hw - Math.abs(lx), oy = s.hh - Math.abs(ly);
    if (ox < oy) { nlx = Math.sign(lx) || 1; nly = 0; pen = ox + cr; } else { nlx = 0; nly = Math.sign(ly) || -1; pen = oy + cr; }
  } else {
    const dx = lx - qx, dy = ly - qy, d = Math.hypot(dx, dy); pen = cr - d;
    if (pen <= 0) return null; nlx = dx / d; nly = dy / d;
  }
  const nx = nlx * s.c - nly * s.s, ny = nlx * s.s + nly * s.c;
  return { nx, ny, pen, px: cx - nx * cr, py: cy - ny * cr };
}

let ID = 1;
export function makeBall(x, y, color) {
  const m = 1, r = BALL_R;
  return { id: ID++, kind: 'ball', color, x, y, a: 0, vx: 0, vy: 0, w: 0, r, invM: 1 / m, invI: 1 / (0.5 * m * r * r), parts: [{ lx: 0, ly: 0, r }], wx: [x], wy: [y], fr: 0.6 };
}
/** samples: [{x,y,link}] in world space → rigid ink body */
export function makeInk(samples) {
  let cx = 0, cy = 0; for (const p of samples) { cx += p.x; cy += p.y; } cx /= samples.length; cy /= samples.length;
  const mp = INK_DENSITY, m = mp * samples.length; let I = 0;
  const parts = samples.map(p => { const lx = p.x - cx, ly = p.y - cy; I += mp * (lx * lx + ly * ly + 0.5 * INK_R * INK_R); return { lx, ly, r: INK_R, link: p.link }; });
  return { id: ID++, kind: 'ink', x: cx, y: cy, a: 0, vx: 0, vy: 0, w: 0, invM: 1 / m, invI: 1 / Math.max(I, 1), parts, wx: parts.map(p => p.lx + cx), wy: parts.map(p => p.ly + cy), fr: 0.7 };
}
function place(b) {
  const c = Math.cos(b.a), s = Math.sin(b.a); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < b.parts.length; i++) {
    const p = b.parts[i], x = b.x + p.lx * c - p.ly * s, y = b.y + p.lx * s + p.ly * c; b.wx[i] = x; b.wy[i] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const r = b.parts[0].r; b.bb = [x0 - r, y0 - r, x1 + r, y1 + r];
}
function shift(b, dx, dy) { b.x += dx; b.y += dy; for (let i = 0; i < b.wx.length; i++) { b.wx[i] += dx; b.wy[i] += dy; } b.bb[0] += dx; b.bb[2] += dx; b.bb[1] += dy; b.bb[3] += dy; }

export class World {
  constructor() { this.statics = []; this.bodies = []; this.g = 1250; this.sub = 10; this.onHit = null; this.touch = null; }
  addStatic(s) { const m = makeStatic(s); this.statics.push(m); return m; }
  add(b) { place(b); this.bodies.push(b); return b; }
  remove(b) { const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); }
  step(dt) { const h = dt / this.sub; for (let k = 0; k < this.sub; k++) this.substep(h); }
  substep(h) {
    const B = this.bodies, S = this.statics;
    for (const b of B) {
      b.vy += this.g * h; b.vx *= 0.99985; b.vy *= 0.99985; b.w *= b.kind === 'ink' ? 0.9992 : 0.9997;
      const sp = Math.hypot(b.vx, b.vy); if (sp > 1600) { b.vx *= 1600 / sp; b.vy *= 1600 / sp; }
      if (Math.abs(b.w) > 30) b.w = Math.sign(b.w) * 30;
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h; place(b);
    }
    for (let it = 0; it < 2; it++) {
      for (const b of B) {
        for (const s of S) {
          if (b.bb[2] < s.bb[0] || b.bb[0] > s.bb[2] || b.bb[3] < s.bb[1] || b.bb[1] > s.bb[3]) continue;
          for (let i = 0; i < b.parts.length; i++) {
            const c = hitStatic(s, b.wx[i], b.wy[i], b.parts[i].r);
            if (c) this.resolve(b, null, c.px, c.py, c.nx, c.ny, c.pen, it);
          }
        }
      }
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const a = B[i], b = B[j];
        if (a.bb[2] < b.bb[0] || a.bb[0] > b.bb[2] || a.bb[3] < b.bb[1] || a.bb[1] > b.bb[3]) continue;
        if (a.kind === 'ball' && b.kind === 'ball') { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < a.r + b.r + 1.5 && this.touch) this.touch(a, b); }
        for (let p = 0; p < a.parts.length; p++) {
          const ax = a.wx[p], ay = a.wy[p], ar = a.parts[p].r;
          if (ax + ar < b.bb[0] || ax - ar > b.bb[2] || ay + ar < b.bb[1] || ay - ar > b.bb[3]) continue;
          for (let q = 0; q < b.parts.length; q++) {
            const dx = ax - b.wx[q], dy = ay - b.wy[q], rr = ar + b.parts[q].r, d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
            this.resolve(a, b, ax - nx * ar, ay - ny * ar, nx, ny, rr - d, it);
          }
        }
      }
    }
  }
  resolve(A, Bd, px, py, nx, ny, pen, it) {
    const ia = A.invM, ib = Bd ? Bd.invM : 0;
    const corr = Math.max(0, pen - 0.15) * 0.85 / (ia + ib);
    if (corr > 0) { shift(A, nx * corr * ia, ny * corr * ia); if (Bd) shift(Bd, -nx * corr * ib, -ny * corr * ib); }
    if (it) return;    // velocities only on the first pass, second pass just cleans up overlap
    const rax = px - A.x, ray = py - A.y;
    let vx = A.vx - A.w * ray, vy = A.vy + A.w * rax, rbx = 0, rby = 0;
    if (Bd) { rbx = px - Bd.x; rby = py - Bd.y; vx -= Bd.vx - Bd.w * rby; vy -= Bd.vy + Bd.w * rbx; }
    const vn = vx * nx + vy * ny;
    if (vn >= 0) return;
    const ran = rax * ny - ray * nx, rbn = rbx * ny - rby * nx;
    const k = ia + ran * ran * A.invI + (Bd ? ib + rbn * rbn * Bd.invI : 0);
    const e = vn < -260 ? 0.22 : 0;
    const j = -(1 + e) * vn / k;
    const tx = -ny, ty = nx, vt = vx * tx + vy * ty, rat = rax * ty - ray * tx, rbt = rbx * ty - rby * tx;
    const kt = ia + rat * rat * A.invI + (Bd ? ib + rbt * rbt * Bd.invI : 0);
    const mu = Math.min(A.fr, Bd ? Bd.fr : 0.8);
    const jt = Math.max(-mu * j, Math.min(mu * j, -vt / kt));
    const Jx = nx * j + tx * jt, Jy = ny * j + ty * jt;
    A.vx += Jx * ia; A.vy += Jy * ia; A.w += (rax * Jy - ray * Jx) * A.invI;
    if (Bd) { Bd.vx -= Jx * ib; Bd.vy -= Jy * ib; Bd.w -= (rbx * Jy - rby * Jx) * Bd.invI; }
    if (vn < -140 && this.onHit) this.onHit(A, Bd, -vn, nx, ny);
  }
  energy() { let m = 0; for (const b of this.bodies) m = Math.max(m, Math.hypot(b.vx, b.vy) + Math.abs(b.w) * 20); return m; }
}

/** turns raw pointer points into evenly spaced ink samples, skipping any that would overlap statics or bodies. Shared by player + bot + validator. */
export class StrokeBuilder {
  constructor(world, budget) { this.world = world; this.budget = budget; this.used = 0; this.samples = []; this.last = null; this.lastOk = false; }
  free(x, y) {
    const r = INK_R + 1.2;
    for (const s of this.world.statics) if (hitStatic(s, x, y, r)) return false;
    for (const b of this.world.bodies) {
      if (x + r < b.bb[0] || x - r > b.bb[2] || y + r < b.bb[1] || y - r > b.bb[3]) continue;
      for (let i = 0; i < b.parts.length; i++) { const rr = r + b.parts[i].r; if ((x - b.wx[i]) ** 2 + (y - b.wy[i]) ** 2 < rr * rr) return false; }
    }
    return true;
  }
  add(x, y) {
    if (this.used >= this.budget) return false;
    if (!this.last) { this.last = { x, y }; this.push(x, y); return true; }
    let dx = x - this.last.x, dy = y - this.last.y, d = Math.hypot(dx, dy);
    while (d >= SPACING && this.used < this.budget) {
      const nx = this.last.x + dx / d * SPACING, ny = this.last.y + dy / d * SPACING;
      this.last = { x: nx, y: ny }; this.push(nx, ny);
      dx = x - nx; dy = y - ny; d = Math.hypot(dx, dy);
    }
    return true;
  }
  push(x, y) {
    if (this.free(x, y)) { if (this.samples.length) this.used += SPACING; this.samples.push({ x, y, link: this.lastOk && this.samples.length > 0 }); this.lastOk = true; }
    else this.lastOk = false;
  }
}

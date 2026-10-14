// physics.js — tiny position-based 2D water: circle particles vs. each other and vs. thick line segments.
// Our own code. No DOM, so it also runs in node for level verification.
export class Water {
  constructor({ r = 4, max = 700, g = 0.3, coh = 0.035 } = {}) {
    this.r = r; this.coh = coh; this.d = r * 2; this.max = max; this.n = 0; this.g = g;
    this.x = new Float32Array(max); this.y = new Float32Array(max);
    this.px = new Float32Array(max); this.py = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max);
    this.age = new Float32Array(max); this.inGlass = new Uint8Array(max);
    this.segs = [];
    // spatial grid over the world box (-60..420, -100..800)
    this.ox = -60; this.oy = -100; this.cell = this.d * 1.5; this.cols = Math.ceil(480 / this.cell); this.rows = Math.ceil(900 / this.cell);
    this.head = new Int32Array(this.cols * this.rows); this.next = new Int32Array(max);
  }
  add(x, y, vx = 0, vy = 0) {
    if (this.n >= this.max) return -1; const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.age[i] = 0; this.inGlass[i] = 0; return i;
  }
  /** segment: {ax, ay, bx, by, t (half thickness), fr (tangential friction 0..1)} */
  addSeg(ax, ay, bx, by, t = 2, fr = 0.02) {
    const s = { ax, ay, bx, by, t, fr, minx: Math.min(ax, bx) - t, maxx: Math.max(ax, bx) + t, miny: Math.min(ay, by) - t, maxy: Math.max(ay, by) + t };
    this.segs.push(s); return s;
  }
  remove(i) {
    const j = --this.n; if (i === j) return;
    for (const a of [this.x, this.y, this.vx, this.vy, this.age, this.inGlass]) a[i] = a[j];
  }
  /** advance one frame (dt≈1 at 60 fps) using `sub` substeps */
  step(sub = 3) {
    const g = this.g / (sub * sub), vmax = this.r * 0.85, vscale = 1 / sub;
    // velocities are stored per frame; convert to per substep
    for (let s = 0; s < sub; s++) this.substep(g, vmax, vscale);
    for (let i = this.n - 1; i >= 0; i--) {
      this.age[i] += 1;
      if (this.y[i] > 780 || this.x[i] < -50 || this.x[i] > 410) this.remove(i);
    }
  }
  substep(g, vmax, vs) {
    const { x, y, px, py, vx, vy, n, d, r } = this;
    for (let i = 0; i < n; i++) {
      px[i] = x[i]; py[i] = y[i];
      vy[i] += g / vs;               // vy is per frame: per-substep gravity g == (g/vs) per-frame increment over vs
      let ux = vx[i] * vs, uy = vy[i] * vs; const sp = Math.hypot(ux, uy);
      if (sp > vmax) { ux *= vmax / sp; uy *= vmax / sp; }
      x[i] += ux; y[i] += uy;
    }
    // particle-particle (2 relaxation passes)
    const d2 = d * d, c2 = d2 * 2.25, coh = this.coh;
    for (let it = 0; it < 2; it++) {
      this.buildGrid();
      const { head, next, cols, rows, ox, oy, cell } = this;
      for (let i = 0; i < n; i++) {
        const cx = Math.floor((x[i] - ox) / cell), cy = Math.floor((y[i] - oy) / cell);
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          if (gy < 0 || gy >= rows) continue;
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            if (gx < 0 || gx >= cols) continue;
            for (let j = head[gy * cols + gx]; j !== -1; j = next[j]) {
              if (j <= i) continue;
              const dx = x[j] - x[i], dy = y[j] - y[i], q = dx * dx + dy * dy;
              if (q >= c2) continue;
              if (q >= d2) {   // cohesion: gently pull close neighbours together (blobby water, coherent streams)
                const dist = Math.sqrt(q), pull = (dist - d) * coh / dist;
                x[i] += dx * pull; y[i] += dy * pull; x[j] -= dx * pull; y[j] -= dy * pull; continue;
              }
              let dist = Math.sqrt(q), nx, ny;
              if (dist < 1e-4) { nx = (i & 1) ? 1 : -1; ny = 0; dist = 0; } else { nx = dx / dist; ny = dy / dist; }
              const push = (d - dist) * 0.25;
              x[i] -= nx * push; y[i] -= ny * push; x[j] += nx * push; y[j] += ny * push;
            }
          }
        }
      }
    }
    // particle-segment
    for (let i = 0; i < n; i++) {
      for (const s of this.segs) {
        if (x[i] < s.minx - r || x[i] > s.maxx + r || y[i] < s.miny - r || y[i] > s.maxy + r) continue;
        const ex = s.bx - s.ax, ey = s.by - s.ay, L2 = ex * ex + ey * ey;
        let t = L2 > 0 ? ((x[i] - s.ax) * ex + (y[i] - s.ay) * ey) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.ax + ex * t, cy = s.ay + ey * t, dx = x[i] - cx, dy = y[i] - cy, q = dx * dx + dy * dy, R = s.t + r;
        if (q >= R * R) continue;
        let dist = Math.sqrt(q), nx, ny;
        if (dist < 1e-4) {   // exactly on the line: push back toward where it came from
          nx = px[i] - cx; ny = py[i] - cy; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        } else { nx = dx / dist; ny = dy / dist; }
        x[i] += nx * (R - dist); y[i] += ny * (R - dist);
        // tangential friction: drag the previous position along the tangent
        const mx = x[i] - px[i], my = y[i] - py[i], tn = mx * -ny + my * nx;
        px[i] += -ny * tn * s.fr; py[i] += nx * tn * s.fr;
      }
    }
    for (let i = 0; i < n; i++) { vx[i] = (x[i] - px[i]) / vs * 0.999; vy[i] = (y[i] - py[i]) / vs * 0.999; }
  }
  buildGrid() {
    const { head, next, cols, rows, ox, oy, cell, x, y, n } = this; head.fill(-1);
    for (let i = 0; i < n; i++) {
      let cx = Math.floor((x[i] - ox) / cell), cy = Math.floor((y[i] - oy) / cell);
      cx = cx < 0 ? 0 : cx >= cols ? cols - 1 : cx; cy = cy < 0 ? 0 : cy >= rows ? rows - 1 : cy;
      const k = cy * cols + cx; next[i] = head[k]; head[k] = i;
    }
  }
}

/** distance from point to segment */
export function distSeg(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
  let t = L2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / L2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - ex * t, py - ay - ey * t);
}
export function pointInPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

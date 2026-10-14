// Bumpy Buggy — seeded hilly heightfield (our own code). Samples every DX metres from X0.
import { rng } from './kit/hc.js';
export const DX = 0.25, X0 = -40;
export function makeTerrain(level, length) {
  const r = rng(level * 7919 + 13);
  const n = Math.ceil((length - X0) / DX) + 1, H = new Float32Array(n);
  const waves = [[64, 1], [29, 0.42], [13, 0.16], [6.5, 0.045]].map(([wl, a]) => ({ k: 2 * Math.PI / (wl * (0.85 + r() * 0.3)), a, ph: r() * 6.283 }));
  const amp = Math.min(5.5, 2.4 + (level - 1) * 0.4), trend = 0.015 + Math.min(0.05, level * 0.006);
  for (let i = 0; i < n; i++) {
    const x = i * DX + X0;
    const ramp = x < 12 ? 0 : x > 80 ? 1 : (t => t * t * (3 - 2 * t))((x - 12) / 68);
    let h = 0; for (const w of waves) h += w.a * Math.sin(w.k * x + w.ph) - w.a * Math.sin(w.k * 12 + w.ph);
    H[i] = ramp * (h * amp * (0.8 + Math.min(0.5, x / 900)) + (x - 12) * trend);
  }
  // limit steepness so every hill is climbable (steeper with level)
  const dmax = DX * Math.tan(Math.min(40, 27 + level * 2.2) * Math.PI / 180);
  for (let i = 1; i < n; i++) H[i] = Math.max(H[i - 1] - dmax, Math.min(H[i - 1] + dmax, H[i]));
  const T = {
    H, n, length,
    h(x) { const f = (x - X0) / DX, i = Math.max(0, Math.min(n - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - i)); return H[i] + (H[i + 1] - H[i]) * t; },
    slope(x) { return (T.h(x + 0.3) - T.h(x - 0.3)) / 0.6; },
    normal(x) { const s = T.slope(x), l = Math.hypot(s, 1); return { x: -s / l, y: 1 / l }; },
    /** deepest contact of a circle against the polyline: {nx, ny, pen} or null */
    circle(px, py, rad) {
      const hc = T.h(px);
      if (py < hc) { const nn = T.normal(px); return { nx: nn.x, ny: nn.y, pen: (hc - py) * nn.y + rad }; }
      let bd = rad * rad, bx = 0, by = 0, hit = false;
      const i0 = Math.max(0, Math.floor((px - rad - 0.3 - X0) / DX)), i1 = Math.min(n - 1, Math.ceil((px + rad + 0.3 - X0) / DX));
      for (let i = i0; i < i1; i++) {
        const ax = i * DX + X0, ay = H[i], ex = DX, ey = H[i + 1] - ay;
        let t = ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + ex * t, cy = ay + ey * t, d2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (d2 < bd) { bd = d2; bx = cx; by = cy; hit = true; }
      }
      if (!hit) return null;
      const d = Math.sqrt(bd) || 1e-6; return { nx: (px - bx) / d, ny: (py - by) / d, pen: rad - d };
    },
  };
  return T;
}

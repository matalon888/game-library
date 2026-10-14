// levels.js — seeded procedural level generator for Drip Doodle. Pure data, no DOM (runs in node for verification).
import { Water, distSeg, pointInPoly } from './physics.js';
export const W = 360, H = 640;
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export const GLASS = { wb: 56, wt: 82, h: 92, t: 3, line: 0.6 };
/** glass outline (outer polygon corners) */
export function glassPts(g) {
  const { wb, wt, h } = GLASS;
  return { bl: [g.x - wb / 2, g.y], br: [g.x + wb / 2, g.y], tl: [g.x - wt / 2, g.y - h], tr: [g.x + wt / 2, g.y - h] };
}
/** is point inside the glass interior (and below the rim)? */
export function inGlass(g, x, y) {
  const { wb, wt, h, t } = GLASS;
  if (y > g.y - t || y < g.y - h) return false;
  const f = (g.y - y) / h, half = wb / 2 + (wt - wb) / 2 * f - t;
  return Math.abs(x - g.x) < half;
}
export function blockPoly(b) {
  if (b.type === 'rect') return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
  return b.pts;
}
export function insideBlocks(L, x, y, pad = 0) {
  for (const b of L.blocks) {
    const p = blockPoly(b);
    if (pointInPoly(x, y, p)) return true;
    if (pad) for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; if (distSeg(x, y, a[0], a[1], c[0], c[1]) < pad) return true; }
  }
  return false;
}
function polyLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
function distToPoly(x, y, pts) { let m = 1e9; for (let i = 1; i < pts.length; i++) m = Math.min(m, distSeg(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return m; }

export function genLevel(n, salt = 0) {
  const R = rng(n * 7919 + 13 + salt * 104729);
  const d = Math.min(1, (n - 1) / 24);
  let dir = R() < 0.5 ? 1 : -1;                         // glass is to the right (1) or left (-1) of where the stream lands
  const side = n >= 3 && (n % 3 === 0 || (n > 10 && R() < 0.3));   // side pipe shooting sideways, glass tucked under it
  const { h, wt } = GLASS;
  const L = { n, dir, blocks: [], tap: null, glass: null, solution: null, ink: 0, water: 0, target: 0 };
  let offset = 105 + R() * 70 + d * 45;
  let tapX, gx, sgn = 0;
  if (side) { sgn = -dir; tapX = sgn > 0 ? 72 : W - 72; gx = tapX + sgn * (22 + R() * 34); }
  else { tapX = W / 2 - dir * offset / 2 + (R() - 0.5) * 40; gx = tapX + dir * offset; }
  gx = Math.max(52, Math.min(W - 52, gx));
  if (!side) tapX = Math.max(40, Math.min(W - 40, tapX));
  if (!side && Math.abs(gx - tapX) < 100) tapX = gx - dir * 100;
  const gy = 470 + R() * 100;
  L.glass = { x: gx, y: gy };
  const top = gy - h;

  // solution ramp (bot stroke): from under the stream to just inside the glass mouth, with a little down-hook
  const nearWall = gx - dir * wt / 2;
  const E = [nearWall + dir * 10, top - 12], E2 = [gx + dir * 2, top + 10];
  let S, tap;
  if (!side) {
    const sx = tapX - dir * 26, dx = Math.abs(E[0] - sx);
    let sy = E[1] - Math.max(0.42 * dx, 46);
    let oy = sy - 100 - R() * 110;
    if (oy < 92) { oy = 92; sy = Math.max(sy, oy + 52); }
    if (sy > E[1] - 0.28 * dx) sy = E[1] - 0.28 * dx;           // keep enough slope
    S = [sx, sy];
    tap = { kind: 'down', x: tapX, y: oy, vx: 0, vy: 2 };
  } else {
    const oy = 110 + R() * 60, vx = 3.3 + R() * 0.9;
    tap = { kind: 'side', x: tapX, y: oy, vx: sgn * vx, vy: 0 };
    const lx = tap.x + sgn * vx * Math.sqrt(2 * 60 / 0.3) * 0.9;
    let sx = lx + sgn * 34; if (Math.abs(sx - E[0]) < 90) sx = E[0] + sgn * 90;
    sx = Math.max(16, Math.min(W - 16, sx));
    const dx = Math.abs(E[0] - sx);
    S = [sx, Math.max(oy + 50, E[1] - Math.max(0.5 * dx, 60))];
  }
  L.tap = tap;
  // gentle sag in the middle
  const mid = [(S[0] + E[0]) / 2, (S[1] + E[1]) / 2 + 8];
  const sol = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    sol.push([a * S[0] + b * mid[0] + c * E[0], a * S[1] + b * mid[1] + c * E[1]]);
  }
  sol.push(E2);
  L.solution = sol;

  // stand under the glass
  const standW = 92 + R() * 30, sx0 = Math.max(6, gx - standW / 2), sx1 = Math.min(W - 6, gx + standW / 2);
  if (R() < 0.5) L.blocks.push({ type: 'rect', x: sx0, y: gy, w: sx1 - sx0, h: 14, stand: true });
  else L.blocks.push({ type: 'rect', x: sx0, y: gy, w: sx1 - sx0, h: H + 40 - gy, stand: true });

  // obstacles that do not touch the solution corridor, the stream, or the glass
  const want = 1 + Math.floor(d * 2.6 + R() * 1.4);
  const streamX0 = tap.kind === 'down' ? tap.x - 16 : Math.min(tap.x, S[0]) - 14, streamX1 = tap.kind === 'down' ? tap.x + 16 : Math.max(tap.x, S[0]) + 14;
  const ok = (poly) => {
    for (const [x, y] of poly) if (x < 6 || x > W - 6 || y < 70) return false;
    // sample the polygon interior & edges against the corridor
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let x = x0; x <= x1; x += 5) for (let y = y0; y <= y1; y += 5) {
      if (!pointInPoly(x, y, poly) && !(x === x0 || y === y0)) continue;
      if (distToPoly(x, y, sol) < 30) return false;
      if (x > streamX0 && x < streamX1 && y < S[1] + 10) return false;            // falling stream above the ramp
      if (Math.abs(x - gx) < wt / 2 + 18 && y > top - 40 && y < gy + 2) return false;   // around the glass
      if (y < S[1] && Math.abs(x - tap.x) < 30 && y > tap.y - 60) return false;   // pipe
      if (tap.kind === 'side' && y > tap.y - 34 && y < S[1] + 24 && x > streamX0 && x < streamX1) return false;
    }
    for (const b of L.blocks) { const p = blockPoly(b); for (const [x, y] of poly) if (pointInPoly(x, y, p)) return false; for (const [x, y] of p) if (pointInPoly(x, y, poly)) return false; }
    return true;
  };
  let tries = 0;
  while (L.blocks.length < want + 1 && tries++ < 200) {
    const k = R();
    let poly, b;
    if (k < 0.35) {          // wall/pillar from the floor between tap and glass
      const x = Math.min(tapX, gx) + R() * Math.abs(gx - tapX), w = 26 + R() * 50, yTop = 260 + R() * 300;
      b = { type: 'rect', x: x - w / 2, y: yTop, w, h: H + 40 - yTop };
    } else if (k < 0.6) {    // triangle on the floor or floating
      const cx = 30 + R() * (W - 60), s = 40 + R() * 50, by = 300 + R() * 330;
      b = { type: 'tri', pts: [[cx - s / 2, by], [cx + s / 2, by], [cx + (R() - 0.5) * s * 0.4, by - s * (0.8 + R() * 0.4)]] };
    } else if (k < 0.85) {   // floating slab
      const w = 50 + R() * 90, hh = 16 + R() * 26, x = R() * (W - w), y = 90 + R() * 470;
      b = { type: 'rect', x, y, w, h: hh };
    } else {                  // big block in a corner
      const w = 60 + R() * 70, hh = 60 + R() * 120, x = R() < 0.5 ? 6 : W - w - 6, y = 200 + R() * 300;
      b = { type: 'rect', x, y, w, h: hh };
    }
    poly = blockPoly(b);
    if (ok(poly)) L.blocks.push(b);
  }

  L.inkLen = polyLen(sol);
  L.ink = Math.round(L.inkLen * (1.85 - 0.45 * d) + 40);
  L.target = TARGET;
  L.water = Math.round(TARGET * (2.6 - 0.6 * d));
  return L;
}
export const TARGET = 42;   // particles inside the glass needed to reach the line (calibrated in test)

/** segments for the static world: blocks + glass + pipe */
export function staticSegs(L, sim) {
  for (const b of L.blocks) { const p = blockPoly(b); for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; sim.addSeg(a[0], a[1], c[0], c[1], 0.5, 0.03); } }
  const g = glassPts(L.glass), t = GLASS.t;
  sim.addSeg(g.bl[0], g.bl[1] - t, g.tl[0], g.tl[1], t, 0.05);
  sim.addSeg(g.br[0], g.br[1] - t, g.tr[0], g.tr[1], t, 0.05);
  sim.addSeg(g.bl[0], g.bl[1] - t, g.br[0], g.br[1] - t, t, 0.05);
  const tp = L.tap;
  if (tp.kind === 'down') { const b = pipeBox(tp); sim.addSeg(b.x0, b.y0, b.x0, b.y1, 2, 0); sim.addSeg(b.x1, b.y0, b.x1, b.y1, 2, 0); sim.addSeg(b.x0, b.y0, b.x1, b.y0, 2, 0); }
  else { const x0 = tp.vx > 0 ? 8 : W - 8; sim.addSeg(x0, tp.y - 15, tp.x, tp.y - 15, 2, 0); sim.addSeg(x0, tp.y + 15, tp.x, tp.y + 15, 2, 0); sim.addSeg(x0, tp.y - 15, x0, tp.y + 15, 2, 0); }
}

/** bounding box of the pipe (for drawing exclusion + collision) */
export function pipeBox(tp) {
  if (tp.kind === 'down') return { x0: tp.x - 25, x1: tp.x + 25, y0: tp.y - 64, y1: tp.y };
  return tp.vx > 0 ? { x0: 8, x1: tp.x, y0: tp.y - 22, y1: tp.y + 22 } : { x0: tp.x, x1: W - 8, y0: tp.y - 22, y1: tp.y + 22 };
}
/** spawn one water particle from the tap (k = running index) */
export function emit(sim, tp, k) {
  const o = (k % 2 ? 4.6 : -4.6) + ((k * 7) % 5 - 2) * 0.25;
  if (tp.kind === 'down') sim.add(tp.x + o, tp.y + 5, 0, 4.4); else sim.add(tp.x + Math.sign(tp.vx) * 5, tp.y + o, tp.vx, 0);
}
/** headless run: does the level fill with (or without) the solution line? */
export function simulate(L, withLine, frames = 900) {
  const sim = new Water({ r: 4 }); staticSegs(L, sim);
  if (withLine) for (let i = 1; i < L.solution.length; i++) sim.addSeg(...L.solution[i - 1], ...L.solution[i], 3, 0.02);
  let emitted = 0, full = 0, maxIn = 0;
  for (let f = 0; f < frames; f++) {
    if (emitted < L.water) emit(sim, L.tap, emitted++);
    sim.step(3);
    let c = 0; for (let i = 0; i < sim.n; i++) if (inGlass(L.glass, sim.x[i], sim.y[i])) c++;
    if (c > maxIn) maxIn = c;
    if (c >= L.target) { if (++full > 70) return { win: true, f, maxIn }; } else full = 0;
    if (emitted >= L.water && sim.n === 0) break;
  }
  return { win: false, maxIn };
}
/** seeded level that is verified solvable with the solution stroke and NOT solvable without drawing */
export function makeLevel(n) {
  let last;
  for (let salt = 0; salt < 14; salt++) {
    const L = genLevel(n, salt); last = L;
    const a = simulate(L, true); if (!a.win) continue;
    const b = simulate(L, false); if (b.maxIn > L.target * 0.6) continue;
    L.salt = salt; return L;
  }
  return last;
}

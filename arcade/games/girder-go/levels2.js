// levels2.js — Girder Go deep v2: 36 hand-made crossings in 3 worlds, plus a daily bridge. Every level is a spec (cliff step,
// pillars, anchors, vehicle, allowed materials, budget slack); the reference design (par for 3 stars, base for the budget) is
// found by testing a ladder of truss candidates in the real simulation (qa/check2.mjs proves all 36 cross at 1.0-1.4x weight).
import { createSim, stepSim, MATS } from './sim.js';

export const WORLDS = [
  { name: 'Meadow Creek', theme: 0, blurb: 'road and wood · triangles hold' },
  { name: 'Sunset Mesa', theme: 1, blurb: 'steel · steps and twin pillars' },
  { name: 'Frost Peak', theme: 2, blurb: 'heavy buses · long hauls' },
];
const V = {
  car: { kind: 'car', axle: 1.3, r: 0.35, wheelMass: 1.5, speed: 3.2 },
  truck: { kind: 'truck', axle: 1.6, r: 0.4, wheelMass: 2.1, speed: 2.8 },
  bus: { kind: 'bus', axle: 2.0, r: 0.42, wheelMass: 2.8, speed: 2.6 },
};
const RW = ['road', 'wood'], ALL = ['road', 'wood', 'steel'];
// gap = cliff to cliff, step = right cliff height vs left (+ up / - down), pil = pillar x list (rock columns in the gap), low = anchors on
// the cliff walls, veh, mats, bf = budget slack over the reference design, tip = the one idea this level teaches
const S = (name, tip, o) => ({ name, tip, gap: 6, step: 0, pil: [], low: false, veh: 'car', mats: ALL, bf: 1.3, ...o });
export const SPECS = [
  // ---- world 1: Meadow Creek
  S('First Plank', 'Drag one plank across, then press GO', { gap: 2, mats: ['road'], bf: 3, flat: true }),
  S('Footbridge', 'Two planks: the car is light', { gap: 4, mats: RW, bf: 1.9 }),
  S('Plank Walk', 'Wood is cheap: brace the road', { gap: 6, low: true, mats: RW, bf: 1.6 }),
  S('Rock Stop', 'Triangles make a bridge stiff', { gap: 8, pil: [0], mats: RW, bf: 1.5 }),
  S('Three Spans', 'Two rocks: three short spans', { gap: 12, pil: [-2, 2], mats: RW, bf: 1.4 }),
  S('Steel Arrives', 'Steel: strong but dear. The far cliff is higher', { gap: 6, step: 1, low: true, bf: 1.5 }),
  S('First Truck', 'A heavy truck: build stronger', { gap: 6, low: true, veh: 'truck' }),
  S('Downhill', 'The far cliff is lower', { gap: 8, step: -1, low: true }),
  S('Off Centre', 'The rock is not in the middle', { gap: 10, pil: [-1] }),
  S('Rock Truck', 'A truck over two spans', { gap: 10, pil: [1], veh: 'truck' }),
  S('Steel Saver', 'Put steel only where it counts', { gap: 8, low: true, bf: 1.35 }),
  S('Big Muddy', 'BOSS: the long span', { gap: 12, pil: [0], low: true, veh: 'truck', boss: true }),
  // ---- world 2: Sunset Mesa
  S('Cliff Step', 'Two steps up', { gap: 6, step: 2, low: true }),
  S('Deep Drop', 'Two steps down', { gap: 8, step: -2, low: true }),
  S('Twin Pillars', 'Three short spans', { gap: 12, pil: [-2, 2] }),
  S('Steel Diagonals', 'Climb over the rock', { gap: 10, step: 1, pil: [1], veh: 'truck' }),
  S('Lopsided', 'One short span, one long', { gap: 12, pil: [-2], veh: 'truck' }),
  S('Long Jump', 'No rock: one long span', { gap: 10, low: true, veh: 'truck' }),
  S('Climb And Cross', 'Pillar, then up', { gap: 10, step: 1, pil: [1], low: true }),
  S('Easy Rider', 'Breather: a smooth ride', { gap: 6, bf: 1.6 }),
  S('Wood Only', 'No steel here: be clever', { gap: 12, pil: [-2, 2], mats: RW, bf: 1.25 }),
  S('Mesa Mile', 'Two rocks, a heavy truck', { gap: 14, pil: [-3, 3], veh: 'truck' }),
  S('Thin Margin', 'Tight budget: spend wisely', { gap: 8, low: true, veh: 'truck', bf: 1.2 }),
  S('Mesa Gap', 'BOSS: climb the long way', { gap: 14, step: 1, pil: [-3, 3], low: true, veh: 'truck', bf: 1.25, boss: true }),
  // ---- world 3: Frost Peak
  S('Big Bus', 'The bus is heavier still', { gap: 6, low: true, veh: 'bus' }),
  S('Bus On Rock', 'Bus over two spans', { gap: 10, pil: [1], veh: 'bus' }),
  S('Frozen Wood', 'Wood and road only', { gap: 8, pil: [0], mats: RW, veh: 'truck' }),
  S('Thin Ice', 'Tight budget: spend wisely', { gap: 8, low: true, veh: 'truck', bf: 1.15 }),
  S('Ski Jump', 'Rock, then up two', { gap: 12, step: 2, pil: [0], low: true }),
  S('Downhill Bus', 'Long way down', { gap: 12, step: -1, pil: [-2, 2], veh: 'bus' }),
  S('Snow Day', 'Breather: a simple one', { gap: 8, bf: 1.7 }),
  S('Long Haul', 'Three rocks, long road', { gap: 16, pil: [-4, 0, 4], veh: 'truck' }),
  S('Bus Climb', 'Heavy and uphill', { gap: 8, step: 1, pil: [0], low: true, veh: 'bus' }),
  S('Wide Bus', 'One rock, a big bus', { gap: 12, pil: [0], low: true, veh: 'bus' }),
  S('Tight Spot', 'Tight budget, heavy load', { gap: 10, pil: [1], veh: 'truck', bf: 1.12 }),
  S('Summit Span', 'BOSS: the last crossing', { gap: 16, step: 1, pil: [-4, 0, 4], low: true, veh: 'bus', bf: 1.2, boss: true }),
];
export const NL = SPECS.length;

function rngf(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

/** spec → level: anchors, deck path (the reference road line), ground for the wheels */
export function build(s, n = 0, seed = 1) {
  const gap = s.gap, L = -Math.floor(gap / 2), R = L + gap, yR = s.step;
  const stops = [L, ...s.pil.slice().sort((a, b) => a - b), R], segs = [];
  for (let i = 0; i + 1 < stops.length; i++) { let x = stops[i]; const b = stops[i + 1]; while (b - x >= 2) { segs.push([x, x + 2]); x += 2; } if (b - x === 1) { segs.push([x, x + 1]); } }
  const dy = yR, k = Math.abs(dy), sl = new Set();   // sloped segments: the last k of the 2-wide ones
  for (let i = segs.length - 1, c = 0; i >= 0 && c < k; i--) if (segs[i][1] - segs[i][0] === 2) { sl.add(i); c++; }
  const deck = [[L, 0]]; let y = 0;
  segs.forEach((sg, i) => { y += sl.has(i) ? Math.sign(dy) : 0; deck.push([sg[1], y]); });
  const yAt = x => (deck.find(p => p[0] === x) || [0, 0])[1];
  const pillars = s.pil.map(x => ({ x, y: yAt(x) }));
  const anchors = [{ x: L, y: 0 }, { x: R, y: yR }];
  if (s.low) anchors.push({ x: L, y: -1 }, { x: R, y: yR - 1 });
  for (const p of pillars) anchors.push({ x: p.x, y: p.y });
  const depth = 3 + Math.max(0, -yR) + (seed % 2);
  return { n, name: s.name, tip: s.tip, spec: s, gap, L, R, yL: 0, yR, pillars, pillar: pillars.length > 0, low: !!s.low, anchors, deck, segs, sl,
    vehicle: { ...V[s.veh] }, cliffDepth: depth, seed: n * 31 + 7, theme: seed, mats: s.mats, bf: s.bf, boss: !!s.boss };
}
export function groundOf(lv) {
  const d = lv.cliffDepth + 6;
  return [[lv.L - 14, 0, lv.L, 0], [lv.R, lv.yR, lv.R + 14, lv.yR], [lv.L, 0, lv.L, -d], [lv.R, lv.yR, lv.R, lv.yR - d]];
}
const cache = {};
export function levelOf(n) { if (!cache['L' + n]) { const sp = SPECS[n - 1]; const th = Math.floor((n - 1) / 12); cache['L' + n] = build(sp, n, th); } return cache['L' + n]; }

/** daily bridge: today's seed picks a crossing from the pieces (same for everyone that day) */
export function dailyLevel(day) {
  const r = rngf(day * 7 + 3), pick = a => a[Math.floor(r() * a.length)];
  const gap = 8 + Math.floor(r() * 7), step = pick([0, 0, 1, -1]);
  const pil = gap >= 11 ? [pick([-2, -1, 0, 1, 2])] : gap >= 9 && r() < 0.6 ? [pick([-1, 0, 1])] : [];
  const sp = S('Daily Bridge', 'Same crossing for everyone today', { gap, step, pil, low: r() < 0.6, veh: pick(['car', 'truck', 'truck', 'bus']), bf: 1.3 });
  const lv = build(sp, 100 + (day % 1000), Math.floor(r() * 3)); lv.daily = day; lv.seed = day; return lv;
}

// ------------------------------------------------------------------ reference design (par) by a candidate ladder
function design(lv, { h = 1, chord, diag, struts = null, vert = false, flat = false }) {
  const nodes = [], beams = [], idx = {};
  const N = (x, y) => { const k = x + ',' + y; if (idx[k] !== undefined) return idx[k]; const fixed = lv.anchors.some(a => a.x === x && a.y === y); nodes.push({ x, y, fixed }); return idx[k] = nodes.length - 1; };
  for (const a of lv.anchors) N(a.x, a.y);
  const D = lv.deck, tops = [];
  for (let i = 0; i + 1 < D.length; i++) {
    const [x0, y0] = D[i], [x1, y1] = D[i + 1];
    beams.push({ a: N(x0, y0), b: N(x1, y1), type: 'road' });
    if (x1 - x0 === 2 && !flat) {
      const hh = y0 !== y1 ? 1 : h, t = N(x0 + 1, Math.max(y0, y1) + hh);
      beams.push({ a: N(x0, y0), b: t, type: diag }, { a: t, b: N(x1, y1), type: diag }); tops.push([t, x0 + 1, Math.max(y0, y1) + hh]);
    } else tops.push(null);
  }
  for (let i = 0; i + 1 < tops.length; i++) { const a = tops[i], b = tops[i + 1]; if (a && b && b[1] - a[1] === 2 && Math.abs(b[2] - a[2]) <= 1) beams.push({ a: a[0], b: b[0], type: chord }); }
  if (vert) for (let i = 0; i + 1 < tops.length; i++) {   // vertical posts (Pratt-style) where both neighbours are flat tops at the same height
    const a = tops[i], b = tops[i + 1], dn = D[i + 1]; if (!a || !b || a[2] !== b[2] || a[2] !== dn[1] + h) continue;
    const u = N(dn[0], dn[1] + h); beams.push({ a: N(dn[0], dn[1]), b: u, type: diag }, { a: u, b: a[0], type: chord }, { a: u, b: b[0], type: chord }); }
  if (struts && lv.low) {
    const near = (x, dir) => D.filter(p => Math.abs(p[0] - x) <= 2 && Math.abs(p[0] - x) >= 1 && Math.sign(p[0] - x) === dir).sort((p, q) => Math.abs(q[0] - x) - Math.abs(p[0] - x))[0];
    const fit = (p, ax, ay) => p && Math.hypot(p[0] - ax, p[1] - ay) <= 2.3;
    let l = near(lv.L, 1), r = near(lv.R, -1); if (!fit(l, lv.L, -1)) l = null; if (!fit(r, lv.R, lv.yR - 1)) r = null;
    if (l) beams.push({ a: N(lv.L, -1), b: N(l[0], l[1]), type: struts });
    if (r) beams.push({ a: N(lv.R, lv.yR - 1), b: N(r[0], r[1]), type: struts });
  }
  return { nodes, beams };
}
export function designCost(d) { return d.beams.reduce((s, b) => s + (b.dead ? 0 : Math.hypot(d.nodes[b.a].x - d.nodes[b.b].x, d.nodes[b.a].y - d.nodes[b.b].y) * MATS[b.type].cost), 0); }
export function testDesign(lv, d, massMul = 1, clean = false) {
  const v = lv.vehicle;
  const s = createSim(d, groundOf(lv), { x: lv.L - 3.2, y: v.r, axle: v.axle, r: v.r, wheelMass: v.wheelMass * massMul, speed: v.speed });
  for (let t = 0; t < 16; t += 1 / 60) { stepSim(s, 1 / 60, 30); if (s.wheels[0].y < -lv.cliffDepth + 0.3) return false; if (clean && s.beams.some(b => b.broken)) return false; if (s.wheels[0].x > lv.R + 0.9) return true; }
  return false;
}
function candidates(lv) {
  if (lv.spec.flat) return [design(lv, { h: 1, chord: 'wood', diag: 'wood', flat: true })];
  const m = lv.mats, strong = m.filter(t => t !== 'road'), out = [];
  for (const vert of [false, true]) for (const h of [1, 2]) for (const chord of strong) for (const diag of strong) for (const struts of [null, ...strong]) {
    if (!lv.low && struts) continue;
    out.push(design(lv, { h, chord, diag, struts, vert }));
  }
  const ok = d => d.beams.every(b => Math.hypot(d.nodes[b.a].x - d.nodes[b.b].x, d.nodes[b.a].y - d.nodes[b.b].y) <= MATS[b.type].maxLen + 1e-6);
  return out.filter(ok).sort((a, b) => designCost(a) - designCost(b));
}
const sol = {};
/** cheapest candidate that survives with the vehicle up to 40% heavier; null if none does */
export function solution(lv) {
  const key = lv.daily ? 'd' + lv.daily : lv.n; if (sol[key] !== undefined) return sol[key];
  let best = null;
  for (const d of candidates(lv)) { const rev = { nodes: d.nodes, beams: d.beams.slice().reverse() }; if ([1, 1.12, 1.25].every(mm => testDesign(lv, d, mm, true)) && testDesign(lv, d, 1.4) && [1, 1.2].every(mm => testDesign(lv, rev, mm, true)) && testDesign(lv, rev, 1.4)) { best = d; break; } }
  return sol[key] = best;
}
export const parOf = lv => { const s = solution(lv); return s ? Math.ceil(designCost(s) / 100) * 100 : 0; };
export const budgetFor = lv => { const s = solution(lv); return s ? Math.ceil(designCost(s) * lv.bf / 100) * 100 : 9999; };

// levels.js — seeded level generator + a known-good reference design per level (used to set the budget and by the bot).
import { createSim, stepSim, MATS } from './sim.js';

function rngf(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

/** level → { gap, L, R, pillar, anchors:[{x,y}], cliffH, vehicle } */
export function makeLevel(level) {
  const h = Math.abs(Math.sin(level * 12.9898 + 4.1414) * 43758.5453) % 1, r = rngf(1 + Math.floor(h * 2147483000));
  const table = [
    { gap: 4 }, { gap: 6 }, { gap: 6, low: true }, { gap: 8, low: true }, { gap: 12, pillar: true, low: true }, { gap: 8, low: true, truck: true },
  ];
  let spec = level <= table.length ? table[level - 1] : [{ gap: 6, low: true, truck: true }, { gap: 8, low: true }, { gap: 12, pillar: true, low: true }, { gap: 8, low: true, truck: true }, { gap: 12, pillar: true, truck: true }][Math.floor(r() * 5)];
  const { gap } = spec, L = -gap / 2, R = gap / 2;
  const anchors = [{ x: L, y: 0 }, { x: R, y: 0 }];
  if (spec.low) anchors.push({ x: L, y: -1 }, { x: R, y: -1 });
  if (spec.pillar) anchors.push({ x: 0, y: 0 });
  const truck = !!spec.truck;
  return { level, gap, L, R, pillar: !!spec.pillar, low: !!spec.low, anchors,
    vehicle: truck ? { kind: 'truck', axle: 1.6, r: 0.4, wheelMass: 2.1, speed: 2.8 } : { kind: 'car', axle: 1.3, r: 0.35, wheelMass: 1.5, speed: 3.2 },
    cliffDepth: 3 + Math.floor(r() * 2), seed: level * 31 + 7, theme: level % 3 };
}

export function ground(lv) {
  const g = [[lv.L - 14, 0, lv.L, 0], [lv.R, 0, lv.R + 14, 0]];
  return g;
}

/** a candidate design builder: Warren truss over each span + optional struts to low anchors */
function design(lv, { h = 1, chord = 'wood', diag = 'wood', struts = null }) {
  const nodes = [], beams = [], idx = {};
  const N = (x, y) => { const k = x + ',' + y; if (idx[k] !== undefined) return idx[k]; const fixed = lv.anchors.some(a => a.x === x && a.y === y); nodes.push({ x, y, fixed }); return idx[k] = nodes.length - 1; };
  for (const a of lv.anchors) N(a.x, a.y);
  const spans = lv.pillar ? [[lv.L, 0], [0, lv.R]] : [[lv.L, lv.R]];
  for (const [a, b] of spans) {
    for (let x = a; x < b; x += 2) beams.push({ a: N(x, 0), b: N(x + 2, 0), type: 'road' });
    for (let x = a; x < b; x += 2) { const t = N(x + 1, h); beams.push({ a: N(x, 0), b: t, type: diag }, { a: t, b: N(x + 2, 0), type: diag }); if (x + 3 < b) beams.push({ a: t, b: N(x + 3, h), type: chord }); }
  }
  if (struts && lv.low) { beams.push({ a: N(lv.L, -1), b: N(lv.L + 2, 0), type: struts }, { a: N(lv.R, -1), b: N(lv.R - 2, 0), type: struts }); }
  return { nodes, beams };
}
export function designCost(d) { return d.beams.reduce((s, b) => s + (b.dead ? 0 : Math.hypot(d.nodes[b.a].x - d.nodes[b.b].x, d.nodes[b.a].y - d.nodes[b.b].y) * MATS[b.type].cost), 0); }

export function testDesign(lv, d, massMul = 1) {
  const v = lv.vehicle;
  const s = createSim(d, ground(lv), { x: lv.L - 3.2, y: v.r, axle: v.axle, r: v.r, wheelMass: v.wheelMass * massMul, speed: v.speed });
  for (let t = 0; t < 14; t += 1 / 60) { stepSim(s, 1 / 60, 30); if (s.wheels[0].y < -2.5) return false; if (s.wheels[0].x > lv.R + 0.9) return true; }
  return false;
}

const CANDS = [
  { h: 1 }, { h: 2 }, { h: 1, struts: 'wood' }, { h: 2, struts: 'wood' }, { h: 2, chord: 'steel' }, { h: 2, chord: 'steel', struts: 'wood' },
  { h: 2, chord: 'steel', struts: 'steel' }, { h: 2, chord: 'steel', diag: 'steel' }, { h: 2, chord: 'steel', diag: 'steel', struts: 'steel' },
];
const cache = {};
/** cheapest candidate that survives with the vehicle up to 40% heavier */
export function solution(lv) {
  if (cache[lv.level]) return cache[lv.level];
  const opts = CANDS.map(c => design(lv, c)).sort((a, b) => designCost(a) - designCost(b));
  let best = opts[opts.length - 1];
  for (const d of opts) if ([1, 1.12, 1.25, 1.4].every(m => testDesign(lv, d, m))) { best = d; break; }
  return cache[lv.level] = best;
}
export function budgetFor(lv) { return Math.ceil(designCost(solution(lv)) * 1.3 / 100) * 100; }

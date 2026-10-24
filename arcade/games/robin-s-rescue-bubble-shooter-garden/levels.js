// Robin's Rescue levels: seeded and endless. Hedge shapes, clumped berry colours, trapped chicks, bramble knots and a
// berry (shot) budget measured by a clumsy test bot. Levels 1–5 are near-certain wins; then a gentle sawtooth with a short
// "Hard" level every 6th from level 12. Never a wall.
import { COLS, Grid, nbrs, bestShot, LAUNCH_Y } from './grid.js';

export function rng(seed) { seed = Math.floor(Math.abs(seed)) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

// six berries; each has a shape mark so colour is never the only cue
export const BERRIES = [
  { id: 'berry-red', name: 'Rosehip', mark: 'heart', ink: '#b8323a' },
  { id: 'berry-blue', name: 'Blueberry', mark: 'drop', ink: '#2e4c92' },
  { id: 'berry-gold', name: 'Golden plum', mark: 'star', ink: '#d9951f' },
  { id: 'berry-green', name: 'Gooseberry', mark: 'leaf', ink: '#7f9c3a' },
  { id: 'berry-pink', name: 'Rosebud', mark: 'diamond', ink: '#d9708f' },
  { id: 'berry-purple', name: 'Blackberry', mark: 'square', ink: '#4a2c66' },
];
export const CHICKS = [{ id: 'chick-bluetit', name: 'blue tit' }, { id: 'chick-wren', name: 'wren' }];

const SHAPES = {
  full: () => true,
  vee: (r, c, R) => Math.abs(c - 4) <= 4.6 - r * 0.42 + 1.6,
  arch: (r, c, R) => !(r > R * 0.5 && c >= 3 && c <= 5),
  wave: (r, c, R) => r < R - 1 - Math.round(1.4 + 1.4 * Math.sin(c * 0.95)),
  columns: (r, c, R) => r < R * 0.45 || c % 3 !== 1,
  heart: (r, c, R) => { const x = (c - 4) / 4.6, y = 1 - r / Math.max(1, R - 1) * 2; return (x * x + y * y - 0.55) ** 3 - x * x * y * y * y < 0.02 || r === 0; },
  diamond: (r, c, R) => Math.abs(c - 4) + Math.abs(r - R / 2) * 0.85 <= 6,
  bowl: (r, c, R) => r < 2 || Math.abs(c - 4) >= Math.min(4, r * 0.7) - 0.2,
};
const ORDER = ['full', 'vee', 'arch', 'wave', 'heart', 'columns', 'diamond', 'bowl'];

export const isHard = n => n >= 12 && n % 6 === 0;

/** makeLevel(n, fk = flow multiplier, seed?, { daily }) → { n, hard, grid, shots, chicks, ncol, pal, seed } */
export function makeLevel(n, fk = 1, seed = null, opts = {}) {
  const hard = !opts.daily && isHard(n), sd = seed ?? n * 7919 + 17, rnd = rng(sd + 3);
  const ncol = opts.daily ? 5 : n <= 2 ? 3 : n <= 7 ? 4 : n <= 22 ? 5 : n < 40 ? (rnd() < 0.5 ? 5 : 6) : 6;
  const pal = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5).slice(0, ncol);
  let R = opts.daily ? 8 : n <= 3 ? 6 : Math.min(9, 7 + Math.floor(Math.min(n, 36) / 18) + (rnd() < 0.35 ? 1 : 0));
  if (hard) R = 6;
  const shape = n <= 3 && !opts.daily ? 'full' : ORDER[(n + Math.floor(rnd() * 3)) % ORDER.length];
  const ok = SHAPES[shape];
  const clump = n <= 5 ? 0.6 : hard ? 0.4 : Math.max(0.42, 0.55 - n * 0.003);
  const maxG = n <= 5 && !opts.daily ? 6 : hard ? 4 : 5;
  const g = new Grid();
  for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) {
    if (!ok(r, c, R)) continue;
    const ns = nbrs(r, c).map(([a, b]) => g.get(a, b)).filter(v => v && v.color >= 0);
    let color = ns.length && rnd() < (r === 0 ? clump * 0.5 : clump) ? ns[(rnd() * ns.length) | 0].color : pal[(rnd() * pal.length) | 0];
    // keep colour patches small, so one lucky pop never drops half the hedge
    const v = g.set(r, c, { color, chick: -1 });
    for (let k = 0; k < pal.length && g.group(r, c).length > maxG; k++) v.color = color = pal[(pal.indexOf(color) + 1) % pal.length];
  }
  for (const v of g.loose()) g.del(v.r, v.c);
  // bramble knots from level 9: they only fall, or snap when a group next to them pops
  if (n >= 9 || opts.daily) { const k = hard ? 0.07 : 0.045; for (const v of g.cells()) if (v.r > 0 && v.r < R - 1 && rnd() < k) { v.color = -1; v.bramble = true; } }
  // chicks: low and easy to reach early on, tucked deeper later
  const want = opts.daily ? 4 : hard ? 4 : Math.min(6, (n <= 2 ? 2 : 3) + Math.floor(n / 12));
  // target row: middle of the hedge on the first levels, the upper third later (you dig a path to them)
  const aim = n <= 5 && !opts.daily ? (R - 1) * 0.45 : Math.max(1, (R - 1) * 0.3);
  const cand = g.cells().filter(v => !v.bramble && v.r >= 1).sort((a, b) => Math.abs(a.r - aim) - Math.abs(b.r - aim) + (rnd() - 0.5) * 2.2);
  const chicks = [];
  for (const v of cand) {
    if (chicks.length >= want) break;
    if (chicks.some(w => Math.abs(w.r - v.r) <= 1 && Math.abs(w.c - v.c) <= 1)) continue;
    v.chick = n >= 4 && rnd() < 0.5 ? 1 : 0; chicks.push(v);
  }
  // berry budget: a clumsy bot (aim wobble, never swaps) plays 5 times; the budget is a multiple of an unlucky-ish run
  const runs = [0, 1, 2, 3, 4].map(t => playout(g, rng(sd * 31 + t * 977 + 5))).sort((a, b) => a - b);
  const used = runs[3];
  const base = 6 + g.size * 0.2 + ncol * 1.2;
  const mult = n <= 5 && !opts.daily ? 1.7 : hard ? 1.05 : opts.daily ? 1.25 : n <= 12 ? 1.4 : 1.3;
  let shots = Math.max(base, used * mult + (hard ? 1 : 3));
  if (n <= 5 && !opts.daily) shots = Math.max(shots, runs[4] * 1.5 + 4, 24);   // first levels: near-certain wins
  shots = Math.max(10, Math.round(shots / Math.max(0.85, Math.min(1.25, fk))));
  return { n, hard, seed: sd, pal, ncol, rows: R, shape, grid: g, shots, chicks: chicks.length, daily: !!opts.daily };
}

// headless calibration run → berries needed to free every chick (capped)
export function playout(grid, r, err = 3.2, cap = 80) {
  const g = grid.clone(); let cur = nextBerry(g, r), n = 0;
  while (n < cap && g.chicks() > 0) {
    const b = bestShot(g, [{ color: cur }], { step: 4, noise: 4, rnd: r });
    if (!b) break;
    const tr = g.trace(0, LAUNCH_Y, b.a + (r() + r() + r() - 1.5) * err * Math.PI / 180);
    if (!g.get(tr.cell[0], tr.cell[1])) g.land(tr.cell[0], tr.cell[1], { color: cur });
    n++; cur = nextBerry(g, r);
  }
  return n;
}

// next berry for the robin: any colour still in the hedge; chick colours a little more likely (more near the end)
export function nextBerry(g, r) {
  const w = new Map(), left = g.chicks();
  for (const v of g.m.values()) if (v.color >= 0 && !w.has(v.color)) w.set(v.color, 1);
  for (const v of g.m.values()) if (v.chick >= 0 && v.color >= 0) w.set(v.color, left <= 2 ? 3 : 2);
  if (!w.size) return 0;
  let tot = 0; for (const x of w.values()) tot += x; let k = r() * tot;
  for (const [c, x] of w) { k -= x; if (k <= 0) return c; }
  return [...w.keys()][0];
}

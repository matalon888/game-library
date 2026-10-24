// Bubblebay levels: seeded, procedural, endless. Shapes, clumped colours, trapped critters, pearl stones, shot budget.
// Difficulty: levels 1–5 near-certain wins; then a gentle sawtooth with a short "Hard" level every 6th; never a wall.
import { COLS, Grid, nbrs, bestShot, MAXR, RH } from './grid.js';
export const LAUNCH_Y = -0.5 - MAXR * RH - 0.9;

export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

// critters (AI 3D library ids) and the level they first appear on
export const CRITTERS = [
  { id: 'r04', name: 'Chickpea', kind: 'hen', from: 1 },
  { id: 't08', name: 'Puddle', kind: 'duckling', from: 3 },
  { id: 'r05', name: 'Truffle', kind: 'piglet', from: 6 },
  { id: 'r06', name: 'Cloudy', kind: 'lamb', from: 10 },
  { id: 't29', name: 'Lily', kind: 'frog', from: 15 },
  { id: 'r03', name: 'Moo-Moo', kind: 'calf', from: 21 },
];
export const COLORS = ['#ff2e63', '#ffa600', '#1d8cff', '#22c454', '#9447ff', '#ff7417'];
export const COLOR_NAMES = ['Coral', 'Sunny', 'Ocean', 'Kelp', 'Lilac', 'Peach'];

const SHAPES = {
  full: () => true,
  vee: (r, c, R) => Math.abs(c - 4.5) <= 5 - r * 0.45 + 2.2,
  arch: (r, c, R) => !(r > R * 0.55 && c >= 3 && c <= 6),
  pillars: (r, c, R) => r < R * 0.5 || c % 3 !== 1,
  diamond: (r, c, R) => Math.abs(c - 4.5) + Math.abs(r - R / 2) * 0.9 <= 6.5,
  wave: (r, c, R) => r < R - 1 - Math.round(1.5 + 1.5 * Math.sin(c * 0.9)),
  heart: (r, c, R) => { const x = (c - 4.5) / 5, y = 1 - r / Math.max(1, R - 1) * 2; return (x * x + y * y - 0.55) ** 3 - x * x * y * y * y < 0.02 || r === 0; },
};
const SHAPE_ORDER = ['full', 'vee', 'arch', 'wave', 'pillars', 'heart', 'diamond'];

export function isHard(n) { return n > 6 && n % 6 === 0; }
export function speciesFor(n) { return CRITTERS.filter(c => c.from <= n).map((c, i) => i); }

/** makeLevel(n, fk = flow multiplier, seed?) → level definition (grid + shots + goals) */
export function makeLevel(n, fk = 1, seed = null, opts = {}) {
  const hard = !opts.daily && isHard(n), rnd = rng((seed ?? n * 7919 + 13) + 1);
  const ncol = opts.colors ?? (n <= 2 ? 3 : n <= 7 ? 4 : n <= 24 ? 5 : n < 40 ? (rnd() < 0.5 ? 5 : 6) : 6);
  const pal = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5).slice(0, ncol);
  let R = opts.rows ?? Math.min(11, 4 + Math.floor(Math.min(n, 30) / 4) + (rnd() < 0.4 ? 1 : 0));
  if (hard) R = Math.max(5, R - 1);
  const shape = n <= 3 ? 'full' : SHAPE_ORDER[(n + Math.floor(rnd() * 3)) % SHAPE_ORDER.length];
  const ok = SHAPES[shape];
  // clumpiness: easy levels have big friendly colour groups
  const clump = n <= 5 ? 0.72 : hard ? 0.45 : Math.max(0.48, 0.66 - n * 0.004);
  const g = new Grid();
  for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) {
    if (!ok(r, c, R)) continue;
    const ns = nbrs(r, c).map(([a, b]) => g.get(a, b)).filter(v => v && v.color >= 0);
    const color = ns.length && rnd() < clump ? ns[(rnd() * ns.length) | 0].color : pal[(rnd() * pal.length) | 0];
    g.set(r, c, { color, critter: -1 });
  }
  // keep only what hangs from the ceiling
  for (const v of g.floating()) g.del(v.r, v.c);
  // rocks (from level 9): only fall, or crack when a group next to them pops
  if (n >= 9) { const k = hard ? 0.07 : 0.045; for (const v of g.cells()) if (v.r > 0 && v.r < R - 1 && rnd() < k) { v.color = -1; v.stone = true; } }
  // trapped critters
  const sp = speciesFor(n), nCrit = opts.critters ?? Math.min(7, (n <= 2 ? 2 : 3) + Math.floor(n / 7) + (hard ? 1 : 0));
  const cand = g.cells().filter(v => !v.stone && v.r >= 1 && v.r <= Math.max(1, R - 2)).sort((a, b) => (a.r - b.r) * 0.3 + (rnd() - 0.5));
  const crit = [];
  for (const v of cand) {
    if (crit.length >= nCrit) break;
    if (crit.some(w => Math.abs(w.r - v.r) <= 1 && Math.abs(w.c - v.c) <= 1)) continue;
    v.critter = sp.length > 1 && rnd() < 0.55 ? sp[sp.length - 1 - ((rnd() * Math.min(2, sp.length)) | 0)] : sp[(rnd() * sp.length) | 0];
    crit.push(v);
  }
  if (!crit.length) { const v = g.cells().find(w => !w.stone); if (v) { v.critter = 0; crit.push(v); } }
  // shot budget: a clumsy calibration bot (aim error, no swapping) plays the level 3 times; the budget is a multiple of
  // its median — generous early, short + tight on Hard, flow-scaled (fewer shots when it has been easy for you)
  const runs = [0, 1, 2, 3, 4].map(t => playout(g, rng((seed ?? n) * 31 + t * 977 + 5), 3)).sort((a, b) => a - b);
  const used = runs[3];   // an unlucky-ish run (80th percentile), so a bad colour streak rarely decides the level
  const cells = g.size, deep = crit.reduce((a, v) => Math.max(a, v.r), 0);
  const base = (6 + cells * 0.22 + deep * 0.9 + ncol * 1.2) * (n <= 5 ? 1.6 : hard ? 0.92 : n <= 12 ? 1.2 : 1.08);
  let shots = Math.max(base, used * (hard ? 1.05 : 1.2) + 2);
  if (opts.daily) shots *= 1.1;
  shots = Math.max(12, Math.round(shots / Math.max(0.85, Math.min(1.25, fk))));
  // first shots in the launcher: colours that exist on the board
  const goals = {}; for (const v of crit) goals[v.critter] = (goals[v.critter] || 0) + 1;
  return { n, hard, seed: seed ?? n * 7919 + 13, pal, rows: R, shape, grid: g, shots, goals, nCrit: crit.length, daily: !!opts.daily };
}

// quick headless playout for calibration → shots it took to free every critter (capped)
export function playout(grid, r, err = 3.5, cap = 90) {
  const g = grid.clone(), pick = () => nextColor(g, r);
  let cur = pick(), n = 0;
  while (n < cap && g.crittersLeft() > 0) {
    const b = bestShot(g, 0, LAUNCH_Y, [{ color: cur }], { step: 4, noise: 4, rnd: r });
    const tr = g.trace(0, LAUNCH_Y, b.a + (r() + r() + r() - 1.5) * err * Math.PI / 180);
    if (!g.get(tr.cell[0], tr.cell[1])) g.resolve(tr.cell[0], tr.cell[1], { color: cur });
    n++; cur = pick();
  }
  return n;
}

// the next launcher colour: any colour still on the board, critter colours a little more likely (more so near the end)
export function nextColor(g, r) {
  const w = new Map(), cl = g.crittersLeft();
  for (const v of g.m.values()) if (v.color >= 0 && !w.has(v.color)) w.set(v.color, 1);
  for (const v of g.m.values()) if (v.critter >= 0 && v.color >= 0) w.set(v.color, cl <= 2 ? 3 : 2);
  if (!w.size) return 0;
  let tot = 0; for (const x of w.values()) tot += x; let k = r() * tot;
  for (const [c, x] of w) { k -= x; if (k <= 0) return c; }
  return [...w.keys()][0];
}

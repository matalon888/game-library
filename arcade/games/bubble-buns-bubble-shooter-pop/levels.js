// Bubble Buns levels: seeded, procedural, endless. Tall shaped fields (they scroll, so the screen is always full),
// clumped colours, baby critters trapped in bubbles of their own colour, sugar-cube blockers and a shot budget measured by
// a clumsy test bot. Levels 1–5 are near-certain wins; then a gentle sawtooth with a short "Hard" level every 6th; never a wall.
import { COLS, Grid, nbrs, bestShot } from './grid.js';

export function rng(seed) { seed = Math.floor(Math.abs(seed)) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

// six jelly colours; each has a critter (kawaii library c01–c06) and a shape mark so colour is never the only clue
export const COLORS = ['#ff5fa2', '#4aa8ff', '#33d6a6', '#ffc93a', '#b47cff', '#ff8a3d'];
export const LIGHT = ['#ffc2dc', '#c4e2ff', '#bff5e4', '#fff0b8', '#e6d4ff', '#ffd6b8'];
export const COLOR_NAMES = ['Strawberry', 'Blueberry', 'Mint', 'Butter', 'Lilac', 'Peach'];
export const MARKS = ['heart', 'drop', 'clover', 'star', 'moon', 'flower'];
export const CRITTERS = [
  { id: 'c01', name: 'Mochi', kind: 'bunny' },
  { id: 'c02', name: 'Blu', kind: 'bear cub' },
  { id: 'c03', name: 'Pip', kind: 'froggy' },
  { id: 'c04', name: 'Custard', kind: 'chick' },
  { id: 'c05', name: 'Taro', kind: 'kitten' },
  { id: 'c06', name: 'Yuzu', kind: 'fox kit' },
];

const SHAPES = {
  full: () => true,
  vee: (r, c, R) => Math.abs(c - 4) <= 4.6 - r * 0.32 + 1.8,
  arch: (r, c, R) => !(r > R * 0.55 && c >= 3 && c <= 5),
  wave: (r, c, R) => r < R - 1 - Math.round(1.4 + 1.4 * Math.sin(c * 0.95)),
  columns: (r, c, R) => r < R * 0.4 || c % 3 !== 1,
  heart: (r, c, R) => { const x = (c - 4) / 4.6, y = 1 - r / Math.max(1, R - 1) * 2; return (x * x + y * y - 0.55) ** 3 - x * x * y * y * y < 0.02 || r === 0; },
  diamond: (r, c, R) => Math.abs(c - 4) + Math.abs(r - R / 2) * 0.62 <= 6,
  bunny: (r, c, R) => r < R * 0.32 ? (c <= 2 || c >= 6 || r < 1) : true,   // two ears up top
};
const ORDER = ['full', 'vee', 'bunny', 'arch', 'wave', 'heart', 'columns', 'diamond'];

export const isHard = n => n >= 12 && n % 6 === 0;

/** makeLevel(n, fk = flow multiplier, seed?, { daily }) → { n, hard, grid, shots, goals, nCrit, pal, rows, seed, daily } */
export function makeLevel(n, fk = 1, seed = null, opts = {}) {
  const hard = !opts.daily && isHard(n), sd = seed ?? n * 7919 + 13, rnd = rng(sd + 1);
  const ncol = opts.daily ? 5 : n <= 2 ? 3 : n <= 7 ? 4 : n < 40 ? 5 : n < 60 ? (rnd() < 0.5 ? 5 : 6) : 6;
  const pal = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5).slice(0, ncol);
  if (n === 1 && !opts.daily) pal[0] = 0;   // the first level always has a pink bunny
  // tall fields: at least the window height, so the board fills the screen from the first level
  const R = hard ? 12 : opts.daily ? 14 : n <= 3 ? 12 : Math.min(15, 13 + Math.floor(Math.min(n, 40) / 12) + (rnd() < 0.35 ? 1 : 0));
  const shape = n <= 2 && !opts.daily ? 'full' : n === 3 ? 'bunny' : ORDER[(n + Math.floor(rnd() * 3)) % ORDER.length];
  const nCrit = opts.daily ? 5 : Math.min(7, (n <= 2 ? 3 : 4) + Math.floor(n / 9) + (hard ? 1 : 0));
  // levels stay short: a clumsy calibration bot (aim error, no swapping) plays each candidate layout 3 times; layouts
  // whose median run is longer than the cap are rebuilt (up to 5 tries, then the shortest one is kept)
  const cap = opts.daily ? 22 : n <= 5 ? 12 : hard ? 20 : Math.min(28, 15 + n * 0.35);
  let best = null;
  for (let t = 0; t < 5; t++) {
    const L = buildField(n, R, shape, pal, nCrit, hard, opts, rng(sd * 3 + t * 7717 + 11));
    const runs = [0, 1, 2].map(k => playout(L.g, rng(sd * 31 + t * 131 + k * 977 + 5), 3)).sort((a, b) => a - b);
    if (!best || runs[1] < best.runs[1]) best = { ...L, runs };
    if (runs[1] <= cap) break;
  }
  const { g, crit, runs } = best, used = n <= 5 && !opts.daily ? runs[1] : (runs[1] + runs[2]) / 2;   // between the median and the unlucky run
  // shot budget from the median run: generous early, short + tight on Hard, flow-scaled (fewer shots when it has been easy)
  let shots = n <= 5 && !opts.daily ? used * 2 + 10 : hard ? used * 1.2 + 4 : used * 1.55 + 6;
  shots = Math.max(n <= 5 ? 22 : 18, Math.min(hard ? 34 : n <= 5 ? 32 : 50, shots));
  if (opts.daily) shots *= 1.1;
  shots = Math.round(shots / (opts.daily ? 1 : Math.max(0.85, Math.min(1.25, fk))));
  const goals = {}; for (const v of crit) goals[v.critter] = (goals[v.critter] || 0) + 1;
  return { calib: runs, n, hard, seed: sd, pal, rows: R, shape, grid: g, shots, goals, nCrit: crit.length, daily: !!opts.daily };
}

function buildField(n, R, shape, pal, nCrit, hard, opts, rnd) {
  const ok = SHAPES[shape];
  const clump = n <= 5 ? 0.74 : hard ? 0.5 : Math.max(0.52, 0.68 - n * 0.004), maxG = n <= 5 ? 10 : hard ? 7 : 8;
  const g = new Grid();
  for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) {
    if (!ok(r, c, R)) continue;
    const ns = nbrs(r, c).map(([a, b]) => g.get(a, b)).filter(v => v && v.color >= 0);
    // the top rows are mixed (many colours hold the field up), lower down the colours clump into friendly groups
    let color = ns.length && rnd() < (r < 2 ? 0.2 : r < 4 ? clump * 0.7 : clump) ? ns[(rnd() * ns.length) | 0].color : pal[(rnd() * pal.length) | 0];
    // no giant single-colour blobs: a group that would grow past maxG takes another colour (one shot shouldn't drop it all)
    if (groupIf(g, r, c, color) > maxG) { const alt = pal.slice().sort(() => rnd() - 0.5).find(k => groupIf(g, r, c, k) <= maxG); if (alt !== undefined) color = alt; }
    g.set(r, c, { color, critter: -1 });
  }
  for (const v of g.floating()) g.del(v.r, v.c);
  // sugar cubes (from level 9): only fall, or melt when a group next to them pops
  if (n >= 9 || opts.daily) { const k = hard ? 0.06 : 0.04; for (const v of g.cells()) if (v.r > 0 && v.r < R - 1 && rnd() < k) { v.color = -1; v.stone = true; } }
  // critters (each in a bubble of its own colour), stratified over the height: one near the launcher for a quick first
  // rescue, the last one up near the top (dig a tunnel and drop the rest), the others in between
  const top = n <= 5 ? 3 : 2, bot = Math.max(top + 1, R - 2), crit = [];
  for (let i = 0; i < nCrit; i++) {
    const want = Math.round(bot - (bot - top) * (nCrit === 1 ? 0.5 : i / (nCrit - 1)));
    const cand = g.cells().filter(v => !v.stone && v.critter < 0 && Math.abs(v.r - want) <= 1 && !crit.some(w => Math.abs(w.r - v.r) <= 1 && Math.abs(w.c - v.c) <= 2));
    if (!cand.length) continue;
    const v = cand[(rnd() * cand.length) | 0]; v.critter = v.color; crit.push(v);
  }
  if (!crit.length) { const v = g.cells().find(w => !w.stone); if (v) { v.critter = v.color; crit.push(v); } }
  return { g, crit };
}

// size of the same-colour group (r,c) would join if it were `color`
function groupIf(g, r, c, color) {
  const seen = new Set(), q = []; let n = 1;
  for (const [a, b] of nbrs(r, c)) { const v = g.get(a, b); if (v && v.color === color && !seen.has(a * 64 + b)) { seen.add(a * 64 + b); q.push(v); } }
  while (q.length) { const v = q.pop(); n++; for (const [a, b] of nbrs(v.r, v.c)) { const w = g.get(a, b); if (w && w.color === color && !seen.has(a * 64 + b)) { seen.add(a * 64 + b); q.push(w); } } }
  return n;
}

// quick headless playout for calibration → shots it took to free every critter (capped)
export function playout(grid, r, err = 3.5, cap = 110) {
  const g = grid.clone(), pick = () => nextColor(g, r);
  let cur = pick(), n = 0;
  while (n < cap && g.crittersLeft() > 0) {
    const y0 = g.launchY();
    const b = bestShot(g, 0, y0, [{ color: cur }], { step: 4, noise: 4, rnd: r });
    if (!b) break;
    const tr = g.trace(0, y0, b.a + (r() + r() + r() - 1.5) * err * Math.PI / 180);
    if (!g.get(tr.cell[0], tr.cell[1])) g.resolve(tr.cell[0], tr.cell[1], { color: cur });
    n++; cur = pick();
  }
  return n;
}

// the next launcher colour: any colour still on the board; critter colours a little more likely (more so near the end)
export function nextColor(g, r) {
  const w = new Map(), cl = g.crittersLeft();
  for (const v of g.m.values()) if (v.color >= 0 && !w.has(v.color)) w.set(v.color, 1);
  for (const v of g.m.values()) if (v.critter >= 0 && v.color >= 0) w.set(v.color, cl <= 2 ? 3 : 2);
  if (!w.size) return 0;
  let tot = 0; for (const x of w.values()) tot += x; let k = r() * tot;
  for (const [c, x] of w) { k -= x; if (k <= 0) return c; }
  return [...w.keys()][0];
}

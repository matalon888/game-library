// Seeded level generator: board shape, colours, moves, goals, crates (1–3 layers) and ice. Level 1–3 are gentle.
import { rng } from './kit/hc.js';

// shapes: rows of 8 chars, '.' playable, ' ' gap. Columns stay contiguous (pieces fall straight down).
const SHAPES = [
  ['........', '........', '........', '........', '........', '........', '........', '........'],
  [' ...... ', '........', '........', '........', '........', '........', '........', ' ...... '],
  ['........', '........', '........', '........', '........', '........', '........', '........', '........'],
  ['  ....  ', ' ...... ', '........', '........', '........', '........', '........', '........'],
  ['........', '........', '........', '........', '........', '........', ' ...... ', '  ....  '],
  [' ...... ', '........', '........', '........', '........', '........', '........', '........', ' ...... '],
  ['.. .. ..', '........', '........', '........', '........', '........', '........', '........'],
];
// crate / ice patterns (applied on the lower half or as a band)
const PAT = {
  band: (W, H, r) => { const y = H - 2 - ((r() * 2) | 0); return Array.from({ length: W }, (_, x) => [x, y]); },
  bottom2: (W, H) => { const o = []; for (let y = H - 2; y < H; y++) for (let x = 0; x < W; x++) o.push([x, y]); return o; },
  corners: (W, H) => [[0, H - 1], [1, H - 1], [0, H - 2], [W - 1, H - 1], [W - 2, H - 1], [W - 1, H - 2]],
  pillars: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) o.push([2, y], [W - 3, y]); return o; },
  center: (W, H) => { const o = []; for (let y = H - 5; y < H - 2; y++) for (let x = 2; x < W - 2; x++) o.push([x, y]); return o; },
  vee: (W, H) => { const o = []; for (let x = 0; x < W; x++) o.push([x, H - 1 - Math.min(x, W - 1 - x) % 4]); return o; },
  checker: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2) o.push([x, y]); return o; },
};

export function makeLevel(n, fk = 1, seed = null) {
  const r = rng(seed ?? (n * 7919 + 101));
  const hard = n > 6 && n % 10 === 0;                       // every 10th level is a "hard level"
  const tier = Math.min(1, (n - 1) / 40);
  const colors = n <= 3 ? 4 : n <= 12 ? 5 : (n % 3 === 0 ? 6 : 5);
  const shape = n <= 3 ? SHAPES[0] : SHAPES[(1 + Math.floor(r() * (SHAPES.length - 1)))];
  const H = shape.length, W = 8;
  const mask = shape.map(row => [...row].map(ch => ch === '.'));
  const crate = mask.map(row => row.map(() => 0)), ice = mask.map(row => row.map(() => 0));
  const goals = [];
  let moves = n <= 3 ? 22 : Math.round(26 - tier * 4 + (r() * 4 - 2));
  if (hard) moves -= 2;
  // blockers
  const useCrate = n >= 3 && (n === 3 || r() < 0.7), useIce = n >= 5 && (n === 5 || r() < 0.55);
  const place = (grid, kinds, maxLayer) => {
    const k = kinds[(r() * kinds.length) | 0]; let cnt = 0;
    for (const [x, y] of PAT[k](W, H, r)) { if (y < 2 || !mask[y]?.[x] || crate[y][x] || ice[y][x]) continue; grid[y][x] = 1 + Math.floor(r() * maxLayer); cnt++; }
    return cnt;
  };
  if (useCrate) {
    const layers = n < 8 ? 1 : n < 18 ? 2 : 3;
    const c = place(crate, n === 3 ? ['corners'] : ['band', 'corners', 'pillars', 'vee', 'bottom2'], layers);
    if (c) goals.push({ k: 'crate', n: c });
  }
  if (useIce) {
    const c = place(ice, n === 5 ? ['center'] : ['center', 'checker', 'band', 'bottom2'], 1);
    if (c) goals.push({ k: 'ice', n: c });
  }
  // colour goals
  const nColorGoals = n === 1 ? 1 : n <= 4 ? 2 - (goals.length ? 1 : 0) : goals.length >= 2 ? 1 : goals.length ? 1 + (r() < 0.4 ? 1 : 0) : 2 + (r() < 0.3 ? 1 : 0);
  const used = new Set();
  for (let i = 0; i < nColorGoals; i++) {
    let c; do { c = (r() * colors) | 0; } while (used.has(c)); used.add(c);
    const base = n === 1 ? 12 : n <= 3 ? 14 : 16 + tier * 14 + r() * 6;
    goals.push({ k: 'color', c, n: Math.round(base * (nColorGoals > 1 ? 0.75 : 1) * (hard ? 1.2 : 1) * fk) });
  }
  moves = Math.max(14, Math.round(moves / Math.sqrt(fk)));
  return { n, W, H, mask, crate, ice, colors, moves, goals, hard, seed: Math.floor(r() * 1e9) };
}

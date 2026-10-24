// Seeded level generator. Levels 1–5 are near-certain wins that each introduce one idea; after that a gentle
// sawtooth: every 6th level from 10 is a short "Hard" level (fewer moves, smaller goals), and the two after it ease off.
import { rng } from './kit/hc.js';

// rows of 7: '.' a bed cell, ' ' a gap (flowers drop through gaps)
const SHAPES = [
  ['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
  ['.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
  ['  ...  ', ' ..... ', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
  ['.......', '.......', '.......', '.......', '.......', '.......', ' ..... ', '  ...  '],
  ['... ...', '... ...', '.......', '.......', '.......', '.......', '.......', '.......'],
  ['  ...  ', ' ..... ', '.......', '.......', '.......', '.......', '.......', ' ..... ', '  ...  '],
  ['.......', '.......', '.......', '... ...', '.......', '.......', '.......', '.......'],
  ['. ... .', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
];
const PAT = {
  band: (W, H, r) => { const y = H - 2 - ((r() * 2) | 0); return Array.from({ length: W }, (_, x) => [x, y]); },
  bottom2: (W, H) => { const o = []; for (let y = H - 2; y < H; y++) for (let x = 0; x < W; x++) o.push([x, y]); return o; },
  corners: (W, H) => [[0, H - 1], [1, H - 1], [0, H - 2], [W - 1, H - 1], [W - 2, H - 1], [W - 1, H - 2]],
  pillars: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) o.push([1, y], [W - 2, y]); return o; },
  center: (W, H) => { const o = []; for (let y = H - 5; y < H - 2; y++) for (let x = 2; x < W - 2; x++) o.push([x, y]); return o; },
  checker: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2) o.push([x, y]); return o; },
  middle: (W, H) => { const o = []; for (let y = 3; y < H - 1; y++) o.push([3, y]); for (let x = 1; x < W - 1; x++) o.push([x, H - 3]); return o; },
  floorAll: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) o.push([x, y]); return o; },
  floorX: (W, H) => { const o = []; for (let i = 0; i < H; i++) { o.push([Math.round(i * (W - 1) / (H - 1)), i]); o.push([W - 1 - Math.round(i * (W - 1) / (H - 1)), i]); } return o; },
};
export const isHard = n => n >= 10 && (n - 10) % 6 === 0;

// fk: flow.js multiplier (1 = neutral; daily levels pass 1). seed: optional (daily).
import { TABLE } from './table.js';
export function makeLevel(n, fk = 1, seed = null, alt = null) {
  const T = seed == null ? TABLE[n] : null; if (alt == null) alt = T ? T[1] : 0;
  const r = rng(seed ?? (n * 7919 + 101 + alt * 104729));
  const hard = seed == null && isHard(n);
  const cyc = n < 10 ? 0 : (n - 10) % 6;                 // 0 = hard, 1–2 = breathers, 3–5 = rising
  const tier = Math.min(1, Math.max(0, (n - 5) / 45));
  const colors = n <= 5 ? 4 : 5;
  const shape = n <= 3 ? SHAPES[0] : SHAPES[(r() * SHAPES.length) | 0];
  const H = shape.length, W = 7;
  const mask = shape.map(row => [...row].map(ch => ch === '.'));
  const used = new Set(), blocks = [], covers = [], floor = [];
  const take = (pat, fn, max = 9) => { let c = 0; for (const [x, y] of PAT[pat](W, H, r)) { const k = y * 16 + x; if (c >= max || y < 2 || !mask[y]?.[x] || used.has(k)) continue; used.add(k); fn(x, y); c++; } return c; };
  const goals = [];
  let moves = n === 1 ? 20 : n <= 5 ? 22 : Math.round(23 - tier * 3 + (r() * 3 - 1));
  // which blocker ideas are in play (each one is introduced alone on its own level)
  const intro = { 3: 'crate', 4: 'mud', 6: 'cloche', 7: 'pot', 9: 'bramble' }[n];
  const pool = ['crate', 'mud', 'cloche', 'pot', 'bramble'].filter(k => n >= { crate: 3, mud: 4, cloche: 6, pot: 7, bramble: 9 }[k]);
  let kinds = [];
  if (intro) kinds = [intro];
  else if (n > 7 || seed != null) { const k1 = pool[(r() * pool.length) | 0]; kinds = [k1]; if (n > 14 && r() < 0.35 && !hard) { const k2 = pool[(r() * pool.length) | 0]; if (k2 !== k1) kinds.push(k2); } }
  else if (n === 5) kinds = ['crate'];
  const two = kinds.length > 1, cap = two ? 6 : 9;
  for (const k of kinds) {
    if (k === 'crate' || k === 'bramble') {
      const pats = n === 3 || n === 9 ? ['corners'] : ['band', 'corners', 'pillars', 'middle'];
      const hp = k === 'bramble' ? 2 : (n < 12 || two ? 1 : 1 + (r() < 0.5 ? 1 : 0));
      const c = take(pats[(r() * pats.length) | 0], (x, y) => blocks.push({ x, y, k, hp }), k === 'bramble' ? (n < 30 || two ? 4 : 6) : cap);
      if (c) goals.push({ k, n: c });
    } else if (k === 'cloche') {
      const c = take(n === 6 ? 'center' : ['center', 'checker', 'band'][(r() * 3) | 0], (x, y) => covers.push({ x, y, hp: n < 20 || two ? 1 : 1 + (r() < 0.3 ? 1 : 0) }), n < 20 || two ? 6 : 8);
      if (c) goals.push({ k: 'cloche', n: c });
    } else if (k === 'mud') {
      const c = take(n === 4 ? 'band' : ['floorAll', 'floorX', 'bottom2', 'center'][(r() * 4) | 0], (x, y) => floor.push({ x, y }), two ? 14 : 28);
      if (c) goals.push({ k: 'mud', n: c });
    } else if (k === 'pot') {
      goals.push({ k: 'pot', n: n < 40 ? 2 : 2 + (r() < 0.4 ? 1 : 0) });
    }
  }
  // flower goals
  const nCol = n === 1 ? 1 : n === 2 ? 2 : goals.length ? (r() < 0.45 ? 1 : 0) + (n <= 5 ? 1 : 0) : 2;
  const cols = new Set();
  for (let i = 0; i < Math.max(goals.length ? 0 : 1, nCol); i++) {
    let c; do { c = (r() * colors) | 0; } while (cols.has(c)); cols.add(c);
    const base = n === 1 ? 12 : n <= 5 ? 14 : 16 + tier * 12 + r() * 5;
    goals.push({ k: 'color', c, n: Math.round(base * (nCol > 1 ? 0.8 : 1) * (goals.length && n > 5 ? 0.65 : 1) * (hard ? 0.85 : 1) * (n > 5 ? fk : 1)) });
  }
  // sawtooth: hard = short and tight, the two after it are breathers, then a gentle rise
  if (hard) moves = Math.round(moves * 0.78);
  else if (cyc === 1 || cyc === 2) moves += 3;
  else if (cyc === 5) moves -= 1;
  if (T) moves = T[0];                                   // measured offline (greedy-bot quantile + a human margin)
  if (n > 5) moves = Math.round(moves / Math.sqrt(fk));
  moves = Math.max(n <= 5 ? 18 : 13, moves);
  // a pot or two already waiting at the top
  const pots0 = goals.some(g => g.k === 'pot') ? [{ x: 1 + ((r() * 2) | 0), y: 3 }, { x: 4 + ((r() * 2) | 0), y: 2 }].filter(p => mask[p.y][p.x] && !used.has(p.y * 16 + p.x)) : [];
  return { n, W, H, mask, blocks, covers, floor, colors, moves, goals, hard, pots0, potMax: 2, seed: Math.floor(r() * 1e9) + 1 };
}

// daily: one of the measured mid-game layouts, picked by the date, with today's own flower drops and +2 moves
// (tuned so a casual player solves it about 4 days in 5)
export function dailyLevel(seed) {
  const r = rng(seed);
  let n; do { n = 12 + ((r() * 110) | 0); } while (isHard(n));
  const L = makeLevel(n);
  L.moves += 2; L.hard = false; L.daily = true; L.seed = (seed * 31 + 7) % 2147483646 + 1;
  return L;
}

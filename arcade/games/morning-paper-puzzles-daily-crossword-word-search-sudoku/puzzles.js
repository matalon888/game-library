// The Morning Paper puzzles: one set per calendar day (mini crossword, themed word search, sudoku), the same for
// everyone, seeded by the date. Pure functions, no DOM, so node can import this file and test every day of the year.
import { THEMES } from './themes.js';
import { CW, CLUES } from './cw.js';

// ---------------------------------------------------------------- dates
export const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const fromNum = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100, 12);
export const addDays = (n, k) => { const d = fromNum(n); d.setDate(d.getDate() + k); return dayNum(d); };
const EPOCH = Date.UTC(2026, 0, 1);
/** issue number: days since 1 Jan 2026 (+1) */
export const issueNo = n => { const d = fromNum(n); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5) + 1; };
export const daysBetween = (a, b) => issueNo(b) - issueNo(a);
export const weekday = n => fromNum(n).toLocaleDateString('en-US', { weekday: 'long' });
export const dow = n => fromNum(n).getDay();          // 0 Sun … 6 Sat
export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Like a newspaper: Monday is gentle and the week climbs to Saturday (the flagged Hard day). Sunday is a relaxed middle.
//                  Sun   Mon   Tue   Wed   Thu   Fri   Sat
export const LEVEL = [3, 1, 2, 3, 4, 5, 6];
export const LEVEL_NAME = ['', 'Gentle', 'Easy', 'Steady', 'Brisk', 'Tricky', 'Hard'];
export const levelOf = n => LEVEL[dow(n)];

// ---------------------------------------------------------------- mini crossword (bank built offline by tools/build-cw.mjs)
/** clue numbering + across/down entries for a 5x5 grid string array ('#' = shaded square) */
export function numberGrid(rows) {
  const H = rows.length, Wd = rows[0].length, open = (y, x) => y >= 0 && x >= 0 && y < H && x < Wd && rows[y][x] !== '#';
  const num = rows.map(r => [...r].map(() => 0)), entries = [];
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
    if (!open(y, x)) continue;
    const a = !open(y, x - 1) && open(y, x + 1) && open(y, x + 2), d = !open(y - 1, x) && open(y + 1, x) && open(y + 2, x);
    if (!a && !d) continue;
    num[y][x] = ++n;
    if (a) { const cells = []; for (let i = x; open(y, i); i++) cells.push([y, i]); entries.push({ n, dir: 'a', cells, ans: cells.map(([r, c]) => rows[r][c]).join('') }); }
    if (d) { const cells = []; for (let i = y; open(i, x); i++) cells.push([i, x]); entries.push({ n, dir: 'd', cells, ans: cells.map(([r, c]) => rows[r][c]).join('') }); }
  }
  for (const e of entries) e.clue = CLUES[e.ans] || '';
  return { num, entries };
}
export function crosswordFor(n) {
  const lv = levelOf(n), group = CW[lv - 1], k = Math.floor((issueNo(n) + 700) / 7);
  const rows = group[((k * 37) % group.length + group.length) % group.length].split('/');
  const { num, entries } = numberGrid(rows);
  return { rows, num, entries, size: rows.length };
}

// ---------------------------------------------------------------- word search
const DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1], W: [0, -1], N: [-1, 0], NW: [-1, -1], SW: [1, -1] };
//                    lv:  1      2      3      4      5      6
const WS_SIZE = [0, 8, 9, 9, 10, 10, 10], WS_N = [0, 6, 7, 8, 9, 10, 11];
const WS_DIRS = [null, ['E', 'S'], ['E', 'S', 'SE'], ['E', 'S', 'SE', 'NE'], ['E', 'S', 'SE', 'NE', 'W'], ['E', 'S', 'SE', 'NE', 'W', 'N'], Object.keys(DIRS)];
export function wordsearchFor(n) {
  const lv = levelOf(n), N = WS_SIZE[lv], want = WS_N[lv];
  const ti = ((issueNo(n) * 17 + 5) % THEMES.length + THEMES.length) % THEMES.length;
  const [title, line, list] = THEMES[ti];
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rngf(n * 31 + attempt * 977 + 11);
    const pool = shuffle(list.split(' ').filter(w => w.length >= 3 && w.length <= N), r);
    const g = [...Array(N)].map(() => new Array(N).fill('')), placed = [];
    const dirs = WS_DIRS[lv];
    for (const w of pool) {
      if (placed.length >= want) break;
      // prefer the gentler directions, but make sure the harder ones appear on harder days
      const order = shuffle(dirs.slice(), r);
      let ok = false;
      for (let t = 0; t < 200 && !ok; t++) {
        const d = order[t % order.length], [dy, dx] = DIRS[d];
        const y0 = Math.floor(r() * N), x0 = Math.floor(r() * N), y1 = y0 + dy * (w.length - 1), x1 = x0 + dx * (w.length - 1);
        if (y1 < 0 || y1 >= N || x1 < 0 || x1 >= N) continue;
        let fits = true, overlap = 0;
        for (let i = 0; i < w.length; i++) { const c = g[y0 + dy * i][x0 + dx * i]; if (c && c !== w[i]) { fits = false; break; } if (c) overlap++; }
        if (!fits || overlap > 1) continue;
        for (let i = 0; i < w.length; i++) g[y0 + dy * i][x0 + dx * i] = w[i];
        placed.push({ w, y: y0, x: x0, dy, dx, d }); ok = true;
      }
    }
    if (placed.length < want) continue;
    // fill the gaps with letters from the theme words, so stray letters look like the real ones
    const letters = placed.map(p => p.w).join('');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) g[y][x] = letters[Math.floor(r() * letters.length)];
    // every word must appear exactly once (in any of the 8 directions), so a find is never ambiguous
    if (!placed.every(p => countIn(g, p.w) === 1)) continue;
    placed.sort((a, b) => a.w.localeCompare(b.w));
    return { title, line, size: N, grid: g.map(r => r.join('')), words: placed, level: lv };
  }
  throw new Error('word search failed for ' + n);
}
function countIn(g, w) {
  const N = g.length; let c = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [dy, dx] of Object.values(DIRS)) {
    let i = 0; for (; i < w.length; i++) { const yy = y + dy * i, xx = x + dx * i; if (yy < 0 || yy >= N || xx < 0 || xx >= N || g[yy][xx] !== w[i]) break; }
    if (i === w.length) c++;
  }
  return w.length > 1 && w === [...w].reverse().join('') ? c / 2 : c;
}

// ---------------------------------------------------------------- sudoku
// Every grid has exactly one solution and can be finished by plain logic (no guessing): Gentle days need only "the one
// number that fits this square"; harder days also need "the one square in this row/column/box that takes this number",
// and Saturday adds pairs. Fewer givens as the week goes on.
const GIVENS = [0, 40, 36, 33, 30, 28, 26];
const peers = [...Array(81)].map((_, i) => {
  const r = Math.floor(i / 9), c = i % 9, s = new Set();
  for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
  const br = r - r % 3, bc = c - c % 3; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) s.add((br + y) * 9 + bc + x);
  s.delete(i); return [...s];
});
export const UNITS = (() => {
  const u = [];
  for (let r = 0; r < 9; r++) u.push([...Array(9)].map((_, k) => r * 9 + k));
  for (let c = 0; c < 9; c++) u.push([...Array(9)].map((_, k) => k * 9 + c));
  for (let b = 0; b < 9; b++) { const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3; u.push([...Array(9)].map((_, k) => (br + Math.floor(k / 3)) * 9 + bc + k % 3)); }
  return u;
})();
export const PEERS = peers;
function fullGrid(r) {
  const g = new Array(81).fill(0);
  const go = i => {
    if (i === 81) return true;
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r)) { if (peers[i].some(p => g[p] === d)) continue; g[i] = d; if (go(i + 1)) return true; }
    g[i] = 0; return false;
  };
  go(0); return g;
}
export function countSolutions(g0, cap = 2) {
  const g = g0.slice(); let n = 0;
  const go = () => {
    let best = -1, bc = null;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const c = []; for (let d = 1; d <= 9; d++) if (!peers[i].some(p => g[p] === d)) c.push(d);
      if (!c.length) return false; if (!bc || c.length < bc.length) { best = i; bc = c; if (c.length === 1) break; }
    }
    if (best < 0) { n++; return n >= cap; }
    for (const d of bc) { g[best] = d; if (go()) return true; } g[best] = 0; return false;
  };
  go(); return n;
}
/** logic solver: returns {solved, hardest} with hardest 1 = naked singles, 2 = hidden singles, 3 = pairs/pointing */
export function logicSolve(g0, maxTech = 3) {
  const g = g0.slice(), cand = g.map((v, i) => v ? 0 : 0x3fe);
  for (let i = 0; i < 81; i++) if (g[i]) for (const p of peers[i]) cand[p] &= ~(1 << g[i]);
  const bits = m => { const a = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) a.push(d); return a; };
  const place = (i, d) => { g[i] = d; cand[i] = 0; for (const p of peers[i]) cand[p] &= ~(1 << d); };
  let hardest = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (g.every(v => v)) return { solved: true, hardest };
    let moved = false;
    for (let i = 0; i < 81; i++) if (!g[i]) { const b = bits(cand[i]); if (b.length === 0) return { solved: false, hardest }; if (b.length === 1) { place(i, b[0]); moved = true; } }
    if (moved) { hardest = Math.max(hardest, 1); continue; }
    if (maxTech < 2) return { solved: false, hardest };
    for (const u of UNITS) for (let d = 1; d <= 9 && !moved; d++) {
      if (u.some(i => g[i] === d)) continue;
      const spots = u.filter(i => !g[i] && cand[i] & (1 << d));
      if (spots.length === 1) { place(spots[0], d); moved = true; }
    }
    if (moved) { hardest = Math.max(hardest, 2); continue; }
    if (maxTech < 3) return { solved: false, hardest };
    // naked pairs + pointing (box/line) eliminations
    for (const u of UNITS) {
      const two = u.filter(i => !g[i] && bits(cand[i]).length === 2);
      for (let a = 0; a < two.length; a++) for (let b = a + 1; b < two.length; b++) if (cand[two[a]] === cand[two[b]]) {
        for (const i of u) if (i !== two[a] && i !== two[b] && !g[i] && cand[i] & cand[two[a]]) { cand[i] &= ~cand[two[a]]; moved = true; }
      }
    }
    for (let b = 18; b < 27; b++) for (let d = 1; d <= 9; d++) {
      const spots = UNITS[b].filter(i => !g[i] && cand[i] & (1 << d)); if (spots.length < 2) continue;
      const rows = new Set(spots.map(i => Math.floor(i / 9))), cols = new Set(spots.map(i => i % 9));
      const line = rows.size === 1 ? UNITS[[...rows][0]] : cols.size === 1 ? UNITS[9 + [...cols][0]] : null;
      if (line) for (const i of line) if (!spots.includes(i) && !g[i] && cand[i] & (1 << d)) { cand[i] &= ~(1 << d); moved = true; }
    }
    if (moved) { hardest = 3; continue; }
    return { solved: false, hardest };
  }
  return { solved: false, hardest };
}
const sudokuCache = new Map();
export function sudokuFor(n) {
  if (sudokuCache.has(n)) return sudokuCache.get(n);
  const lv = levelOf(n), target = GIVENS[lv], tech = lv <= 1 ? 1 : lv <= 5 ? 2 : 3;
  let best = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = rngf(n * 7 + attempt * 101 + 3), sol = fullGrid(r), g = sol.slice();
    const order = shuffle([...Array(41).keys()], r);       // symmetric pairs (i, 80-i), centre last
    for (const i of order) {
      if (g.filter(Boolean).length <= target) break;
      const j = 80 - i, keep = [g[i], g[j]];
      g[i] = 0; g[j] = 0;
      if (countSolutions(g) !== 1 || !logicSolve(g, tech).solved) { g[i] = keep[0]; g[j] = keep[1]; }
    }
    const givens = g.filter(Boolean).length;
    if (!best || givens < best.givens) best = { grid: g, sol, givens, level: lv, tech: logicSolve(g, tech).hardest };
    if (givens <= target + 1) break;
  }
  sudokuCache.set(n, best);
  return best;
}

// ---------------------------------------------------------------- the day's set
export function setFor(n) {
  const lv = levelOf(n);
  return { n, no: issueNo(n), level: lv, levelName: LEVEL_NAME[lv], hard: lv === 6, get cw() { return this._cw || (this._cw = crosswordFor(n)); }, get ws() { return this._ws || (this._ws = wordsearchFor(n)); }, get su() { return sudokuFor(n); } };
}

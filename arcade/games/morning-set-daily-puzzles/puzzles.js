// Morning Set puzzles: three seeded generators (word, logic grid, number) — one set per calendar day, the same for
// everyone. Pure functions, no DOM: node can import this file to test solve-ability and uniqueness.
import { WORDS } from './words.js';

// ---------------------------------------------------------------- dates
export const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const fromNum = n => new Date(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100, 12);
export const addDays = (n, k) => { const d = fromNum(n); d.setDate(d.getDate() + k); return dayNum(d); };
const EPOCH = Date.UTC(2026, 0, 1);
/** puzzle number: days since 1 Jan 2026 (+1) */
export const setNo = n => { const d = fromNum(n); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5) + 1; };
export const daysBetween = (a, b) => setNo(b) - setNo(a);
export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Weekly rhythm like a newspaper: Monday is gentle, Saturday is the flagged "Hard" day (kept short), Sunday is medium.
//           Sun Mon Tue Wed Thu Fri Sat
const GRID = [7, 5, 6, 6, 7, 7, 8];
const OPS = [3, 2, 2, 3, 3, 3, 4];
export const isHard = n => fromNum(n).getDay() === 6;
export const weekday = n => fromNum(n).toLocaleDateString('en-US', { weekday: 'long' });

// ---------------------------------------------------------------- words (SCOWL list from words.js, notice kept there)
const ALLW = WORDS.split ? WORDS.split(' ') : WORDS;
const BLOCK = new Set('drunk idiot moron bigot booze devil sexes sexed rapes sluts pussy kills death dying curse damns enema opium vomit lynch naked bosom booty kinky lager cocks butts tipsy demon witch gonna dunno kinda lemme sorta gimme sades color honor humor labor favor valor rumor tumor vapor savor armor ardor odors lorry maths datum ditto leach flied halon nuder muter coyer rifer apter direr dimer sizer liker lamer haler octal infix aping axing acing awing cuing ruing eking hippy sissy ninny pokey'.split(' '));
const NOT_ANSWER = new Set('arson bawdy booby buxom cigar drown lover belch bowel bible deity vicar roman sigma colic meter pence fiver crime flesh blood skull abyss bully brawl bribe angst bleak gloom grief panic toxic venom sorry spine guilt shame'.split(' '));
const FIVE = ALLW.filter(w => w.length === 5 && /^[a-z]+$/.test(w) && !BLOCK.has(w));
export const VALID = new Set(FIVE);
const ALL = new Set(ALLW);
// answers: common, no plain plurals / past tenses, most common first
export const ANSWERS = FIVE.filter(w => !(w.endsWith('s') && ALL.has(w.slice(0, -1))) && !(w.endsWith('ed') && (ALL.has(w.slice(0, -2)) || ALL.has(w.slice(0, -1)))) && !w.endsWith('es') && !NOT_ANSWER.has(w));
const POOL = shuffle(ANSWERS.slice(0, 1000), rngf(20261024));
export function wordFor(n) { const i = ((setNo(n) * 7 + 3) % POOL.length + POOL.length) % POOL.length; return POOL[i]; }
/** 2 = right spot, 1 = in the word, 0 = not in it (duplicate letters handled like the classic) */
export function mark(guess, ans) {
  const r = [0, 0, 0, 0, 0], left = {};
  for (let i = 0; i < 5; i++) { if (guess[i] === ans[i]) r[i] = 2; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (!r[i] && left[guess[i]]) { r[i] = 1; left[guess[i]]--; }
  return r;
}

// ---------------------------------------------------------------- logic grid ("Sunny Side": one egg per row, column and colour, eggs never touch)
function placeQueens(N, r) {
  const q = new Array(N).fill(-1), used = new Array(N).fill(false);
  const go = row => {
    if (row === N) return true;
    for (const c of shuffle([...Array(N).keys()], r)) {
      if (used[c] || (row && Math.abs(c - q[row - 1]) <= 1)) continue;
      used[c] = true; q[row] = c; if (go(row + 1)) return true; used[c] = false;
    }
    return false;
  };
  go(0); return q;
}
/** number of solutions (stops at `cap`) for a region map reg[r][c] */
export function countSolutions(reg, cap = 2, out = null) {
  const N = reg.length, col = new Array(N).fill(false), rg = new Array(N).fill(false), q = new Array(N);
  let n = 0;
  const go = row => {
    if (row === N) { n++; if (out && !out.length) out.push(...q); return n >= cap; }
    for (let c = 0; c < N; c++) {
      const g = reg[row][c];
      if (col[c] || rg[g] || (row && Math.abs(c - q[row - 1]) <= 1)) continue;
      col[c] = rg[g] = true; q[row] = c;
      if (go(row + 1)) return true;
      col[c] = rg[g] = false;
    }
    return false;
  };
  go(0); return n;
}
function growRegions(N, q, r, minSize) {
  const reg = [...Array(N)].map(() => new Array(N).fill(-1)), size = new Array(N).fill(1);
  for (let i = 0; i < N; i++) reg[i][q[i]] = i;
  let left = N * N - N;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (left > 0) {
    // favour small regions a little so sizes vary but none starves
    const order = shuffle([...Array(N).keys()], r).sort((a, b) => (size[b] < minSize) - (size[a] < minSize));
    let grew = false;
    for (const g of order) {
      const front = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (reg[y][x] === g) for (const [dy, dx] of nb) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < N && xx >= 0 && xx < N && reg[yy][xx] < 0) front.push([yy, xx]); }
      if (!front.length) continue;
      const take = r() < 0.5 ? 1 : 1 + Math.floor(r() * 3);
      for (let k = 0; k < take && front.length; k++) { const i = Math.floor(r() * front.length), [yy, xx] = front.splice(i, 1)[0]; if (reg[yy][xx] < 0) { reg[yy][xx] = g; size[g]++; left--; } }
      grew = true; break;
    }
    if (!grew) break;
  }
  return { reg, size };
}
function connected(reg, g, N) {
  let start = null, total = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (reg[y][x] === g) { total++; if (!start) start = [y, x]; }
  if (!start) return false;
  const seen = new Set([start[0] * N + start[1]]), st = [start];
  while (st.length) { const [y, x] = st.pop(); for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + dy, xx = x + dx; if (yy < 0 || yy >= N || xx < 0 || xx >= N || reg[yy][xx] !== g || seen.has(yy * N + xx)) continue; seen.add(yy * N + xx); st.push([yy, xx]); } }
  return seen.size === total;
}
/** nudge region borders until only the planted solution `q` is left */
function repair(reg, q, r, minSize) {
  const N = reg.length, isQ = (y, x) => q[y] === x;
  for (let it = 0; it < 400; it++) {
    const alt = []; const n = countSolutions(reg, 2, null);
    if (n === 1) return true;
    // find a solution that is not q
    const sols = []; (function all() { const col = new Array(N).fill(false), rg = new Array(N).fill(false), cur = [];
      const go = row => { if (sols.length >= 2) return; if (row === N) { if (cur.some((c, i) => c !== q[i])) sols.push(cur.slice()); return; }
        for (let c = 0; c < N; c++) { const g = reg[row][c]; if (col[c] || rg[g] || (row && Math.abs(c - cur[row - 1]) <= 1)) continue; col[c] = rg[g] = true; cur[row] = c; go(row + 1); col[c] = rg[g] = false; } };
      go(0); })();
    if (!sols.length) return true;
    const s2 = sols[0], cells = [];
    for (let y = 0; y < N; y++) if (s2[y] !== q[y]) cells.push([y, s2[y]]);
    shuffle(cells, r);
    let moved = false;
    for (const [y, x] of cells) {
      const g0 = reg[y][x], opts = [];
      for (const [dy, dx] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], r)) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < N && xx >= 0 && xx < N && reg[yy][xx] !== g0) opts.push(reg[yy][xx]); }
      for (const g1 of opts) {
        reg[y][x] = g1;
        const sz = reg.flat().filter(v => v === g0).length;
        if (sz >= minSize && connected(reg, g0, N)) { moved = true; break; }
        reg[y][x] = g0;
      }
      if (moved) break;
    }
    if (!moved) return false;
  }
  return countSolutions(reg, 2) === 1;
}
export function logicFor(n) {
  const N = GRID[fromNum(n).getDay()], r = rngf(setNo(n) * 104729 + 17), minSize = N >= 7 ? 2 : 1;
  for (let tries = 0; tries < 400; tries++) {
    const q = placeQueens(N, r);
    const { reg, size } = growRegions(N, q, r, minSize);
    if (size.some(s => s < minSize)) continue;
    if (repair(reg, q, r, minSize)) return { N, reg, sol: q, tries };
  }
  throw new Error('no unique logic grid');
}

// ---------------------------------------------------------------- number ("Perfect Blend": combine tiles with + − × ÷ to hit the target)
const OPF = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => (b && a % b === 0 ? a / b : NaN) };
export const apply = (a, op, b) => OPF[op](a, b);
/** can `target` be made from `nums` in at most `depth` operations? returns the steps [[a,op,b,res],...] or null */
export function solveNum(nums, target, depth) {
  const seen = new Set();
  const go = (pool, d, path) => {
    if (pool.includes(target)) return path;
    if (!d || pool.length < 2) return null;
    const key = pool.slice().sort((x, y) => x - y).join(',') + '|' + d; if (seen.has(key)) return null; seen.add(key);
    for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
      if (i === j) continue; const a = pool[i], b = pool[j];
      for (const op of ['+', '−', '×', '÷']) {
        if ((op === '+' || op === '×') && i > j) continue;
        const v = OPF[op](a, b); if (!(v > 0) || !Number.isInteger(v)) continue;
        const rest = pool.filter((_, k) => k !== i && k !== j); rest.push(v);
        const p = go(rest, d - 1, [...path, [a, op, b, v]]); if (p) return p;
      }
    }
    return null;
  };
  return go(nums.slice(), depth, []);
}
export function numberFor(n) {
  const k = OPS[fromNum(n).getDay()], r = rngf(setNo(n) * 7919 + 101);
  const lo = k === 2 ? 15 : k === 3 ? 40 : 90, hi = k === 2 ? 99 : k === 3 ? 260 : 480;
  for (let tries = 0; tries < 5000; tries++) {
    const small = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r).slice(0, 4), big = shuffle([10, 11, 12, 15, 20, 25], r).slice(0, 2);
    const nums = shuffle([...small, ...big], r);
    // random recipe using k operations on k+1 of the tiles
    let pool = shuffle(nums.slice(), r).slice(0, k + 1), steps = [], ok = true;
    for (let s = 0; s < k; s++) {
      const i = Math.floor(r() * pool.length); let j = Math.floor(r() * (pool.length - 1)); if (j >= i) j++;
      let a = pool[i], b = pool[j];
      const ops = shuffle(['+', '×', '−', '×', '+', '÷'], r);
      let done = false;
      for (const op of ops) {
        let x = a, y = b; if ((op === '−' || op === '÷') && x < y) [x, y] = [y, x];
        const v = OPF[op](x, y);
        if (!(v > 0) || !Number.isInteger(v) || v === x || v === y || (op === '×' && (x === 1 || y === 1))) continue;
        pool = pool.filter((_, q) => q !== i && q !== j); pool.push(v); steps.push([x, op, y, v]); done = true; break;
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    const target = pool[pool.length - 1];
    if (target < lo || target > hi || nums.includes(target)) continue;
    if (solveNum(nums, target, k - 1)) continue;          // must really need k steps
    return { nums, target, steps, ops: k, tries };
  }
  throw new Error('no number puzzle');
}

/** the whole set for one day */
export function setFor(n) {
  return { n, no: setNo(n), hard: isHard(n), word: wordFor(n), logic: logicFor(n), number: numberFor(n) };
}

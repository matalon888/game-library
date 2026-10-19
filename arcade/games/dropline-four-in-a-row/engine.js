// engine.js — Dropline four-in-a-row rules + CPU (no DOM; used by the page and by ai-worker.js). Our own code, MIT.
// 7 columns × 6 rows; discs fall to the lowest empty cell; four in a row (across, down or diagonal) wins; full board = draw.
// Cells: index = row * 7 + col, row 0 at the TOP. Side +1 = you, −1 = CPU.
export const COLS = 7, ROWS = 6;
export const empty = () => new Array(COLS * ROWS).fill(0);
export function dropRow(b, c) { for (let r = ROWS - 1; r >= 0; r--) if (!b[r * COLS + c]) return r; return -1; }
export const legalCols = (b) => [3, 2, 4, 1, 5, 0, 6].filter(c => !b[c]);
const LINES = (() => {
  const L = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = []; for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break; cells.push(rr * COLS + cc); }
      if (cells.length === 4) L.push(cells);
    }
  return L;
})();
const BY = Array.from({ length: COLS * ROWS }, (_, i) => LINES.filter(l => l.includes(i)));
/** winning line through cell i (after a move there), or null */
export function winAt(b, i) { const s = b[i]; if (!s) return null; for (const l of BY[i]) if (l.every(j => b[j] === s)) return l; return null; }
export function winner(b) { for (const l of LINES) { const s = b[l[0]]; if (s && l.every(j => b[j] === s)) return { side: s, line: l }; } return null; }

// ---------------------------------------------------------------- CPU
function evaluate(b, side) {
  let s = 0;
  for (const l of LINES) {
    let me = 0, op = 0; for (const j of l) { if (b[j] === side) me++; else if (b[j] === -side) op++; }
    if (me && op) continue;
    if (me === 3) s += 50; else if (me === 2) s += 6; else if (me === 1) s += 1;
    if (op === 3) s -= 55; else if (op === 2) s -= 6; else if (op === 1) s -= 1;
  }
  for (let r = 0; r < ROWS; r++) { if (b[r * COLS + 3] === side) s += 4; else if (b[r * COLS + 3] === -side) s -= 4; }
  return s;
}
const WIN = 100000;
export function search(b, side, { depth = 5, ms = 800, noise = 0, rand = Math.random, blunder = 0, sharp = true } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  b = b.slice();
  function ab(sd, d, alpha, beta, ply) {
    if ((++nodes & 2047) === 0 && Date.now() - t0 > ms) stop = true;
    if (stop) return 0;
    const cols = legalCols(b); if (!cols.length) return 0;
    for (const c of cols) { const r = dropRow(b, c), i = r * COLS + c; b[i] = sd; const w = winAt(b, i); b[i] = 0; if (w) return WIN - ply; }
    if (d <= 0) return evaluate(b, sd);
    let best = -Infinity;
    for (const c of cols) {
      const i = dropRow(b, c) * COLS + c; b[i] = sd;
      const v = -ab(-sd, d - 1, -beta, -alpha, ply + 1); b[i] = 0;
      if (stop) return 0;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return best;
  }
  const root = legalCols(b); if (!root.length) return -1;
  // never miss a win in one; on Normal/Hard never miss a must-block
  for (const c of root) { const i = dropRow(b, c) * COLS + c; b[i] = side; const w = winAt(b, i); b[i] = 0; if (w) return c; }
  if (sharp) for (const c of root) { const i = dropRow(b, c) * COLS + c; b[i] = -side; const w = winAt(b, i); b[i] = 0; if (w) return c; }
  if (blunder && rand() < blunder) return root[Math.floor(rand() * root.length)];
  const jit = root.map(() => (noise ? (rand() * 2 - 1) * noise : 0));
  let best = root[0];
  for (let d = 1; d <= depth; d++) {
    let bs = -Infinity, bc = -1;
    for (let k = 0; k < root.length; k++) {
      const c = root[k], i = dropRow(b, c) * COLS + c; b[i] = side;
      const v = -ab(-side, d - 1, -Infinity, Infinity, 1) + jit[k]; b[i] = 0;
      if (stop) break;
      if (v > bs) { bs = v; bc = c; }
    }
    if (stop) break;
    if (bc >= 0) best = bc;
    if (bs > WIN - 100 || Date.now() - t0 > ms * 0.4) break;
  }
  return best;
}
// Easy looks two plies ahead and sometimes slips, Normal 5 plies, Hard up to 10 plies.
export function think({ b, side = -1, diff, seed, fk = 1 }) {
  const rand = mk(seed);
  const L = [{ depth: 2, ms: 150, noise: 18 / fk, blunder: 0.15 / fk, sharp: false }, { depth: 5, ms: 500 * fk, noise: 4 / fk }, { depth: 10, ms: 1200 * fk }][diff];
  return search(b, side, { ...L, rand });
}
function mk(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

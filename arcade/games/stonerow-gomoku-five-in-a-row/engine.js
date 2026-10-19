// engine.js — Stonerow five-in-a-row rules + CPU (no DOM; used by the page and by ai-worker.js). Our own code, MIT.
// 15 × 15 grid, players alternate placing stones on empty points; the first to get five or more in an unbroken line
// (across, down or diagonally) wins (freestyle rules). A full board is a draw. Side +1 = you (dark, first), −1 = CPU (light).
export const N = 15;
export const empty = () => new Array(N * N).fill(0);
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
/** the 5+ line through i for the stone on i, or null */
export function lineAt(b, i) {
  const s = b[i]; if (!s) return null; const r0 = (i / N) | 0, c0 = i % N;
  for (const [dr, dc] of DIRS) {
    const cells = [i];
    for (const sg of [1, -1]) { let r = r0 + dr * sg, c = c0 + dc * sg; while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === s) { cells.push(r * N + c); r += dr * sg; c += dc * sg; } }
    if (cells.length >= 5) return cells.sort((a, b2) => a - b2);
  }
  return null;
}
// all 5-cell windows, and which windows each cell belongs to
const WINS = [], WOF = Array.from({ length: N * N }, () => []);
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
  const er = r + dr * 4, ec = c + dc * 4; if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
  const w = []; for (let k = 0; k < 5; k++) w.push((r + dr * k) * N + c + dc * k);
  for (const j of w) WOF[j].push(WINS.length); WINS.push(w);
}
const VAL = [0, 1, 12, 120, 1500, 1e6];
/** how much placing `side` on i is worth (attack), from the windows through i */
function cellScore(b, i, side) {
  let s = 0;
  for (const wi of WOF[i]) { let me = 0, op = 0; for (const j of WINS[wi]) { if (b[j] === side) me++; else if (b[j]) op++; } if (!op) s += VAL[me + 1] - VAL[me]; }
  return s;
}
export function candidates(b, side, limit = 12) {
  const near = new Set(); let stones = 0;
  for (let i = 0; i < N * N; i++) if (b[i]) { stones++; const r = (i / N) | 0, c = i % N; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N && !b[rr * N + cc]) near.add(rr * N + cc); } }
  if (!stones) return [{ i: 7 * N + 7, a: 0, d: 0, p: 1 }];
  const out = []; for (const i of near) { const a = cellScore(b, i, side), d = cellScore(b, i, -side); out.push({ i, a, d, p: a + d * 0.92 }); }
  out.sort((x, y) => y.p - x.p); return out.slice(0, limit);
}
function evaluate(b, side) {
  let s = 0;
  for (const w of WINS) { let me = 0, op = 0; for (const j of w) { if (b[j] === side) me++; else if (b[j]) op++; } if (me && !op) s += VAL[me]; else if (op && !me) s -= VAL[op] * 1.15; }
  return s;
}
const WIN = 1e8;
export function search(b, side, { depth = 2, width = 10, ms = 800, noise = 0, rand = Math.random, blunder = 0, block = 1 } = {}) {
  b = b.slice(); const t0 = Date.now(); let nodes = 0, stop = false;
  const cand = candidates(b, side, 30);
  if (cand.length === 1 && !cand[0].a && !cand[0].d) return cand[0].i;
  const win = cand.find(c => c.a >= VAL[5] - VAL[4]); if (win) return win.i;               // five now
  const must = cand.find(c => c.d >= VAL[5] - VAL[4]); if (must && rand() < block) return must.i;   // stop their five
  if (blunder && rand() < blunder) { const top = cand.slice(0, 6); return top[Math.floor(rand() * top.length)].i; }
  if (depth <= 1) { let best = cand[0], bs = -Infinity; for (const c of cand.slice(0, 12)) { const v = c.p + (noise ? (rand() * 2 - 1) * noise * c.p : 0); if (v > bs) { bs = v; best = c; } } return best.i; }
  function ab(sd, d, alpha, beta) {
    if ((++nodes & 255) === 0 && Date.now() - t0 > ms) stop = true;
    if (stop) return 0;
    const cs = candidates(b, sd, width);
    if (cs[0] && cs[0].a >= VAL[5] - VAL[4]) return WIN;
    if (d <= 0) return evaluate(b, sd);
    let best = -Infinity;
    for (const c of cs) {
      b[c.i] = sd; const v = -ab(-sd, d - 1, -beta, -alpha); b[c.i] = 0;
      if (stop) return 0;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return best === -Infinity ? 0 : best;
  }
  const root = cand.slice(0, width + 2);
  let bestI = root[0].i;
  for (let d = 2; d <= depth; d++) {
    let bs = -Infinity, bi = -1;
    for (const c of root) {
      b[c.i] = side; let v = -ab(-side, d - 1, -Infinity, Infinity); b[c.i] = 0;
      if (stop) break;
      if (noise) v += (rand() * 2 - 1) * noise * 400;
      if (v > bs) { bs = v; bi = c.i; }
    }
    if (stop) break;
    if (bi >= 0) bestI = bi;
    if (Date.now() - t0 > ms * 0.4) break;
  }
  return bestI;
}
// Easy: greedy with some noise, sometimes misses a block. Normal: looks 2 plies. Hard: 4 plies on the best candidates.
export function think({ b, side = -1, diff, seed, fk = 1 }) {
  const rand = mk(seed);
  const L = [{ depth: 1, noise: 0.35 / fk, blunder: 0.12 / fk, block: 0.75 }, { depth: 2, width: 10, ms: 500 * fk, noise: 0.05 / fk, block: 1 }, { depth: 4, width: 9, ms: 1400 * fk, block: 1 }][diff];
  return search(b, side, { ...L, rand });
}
function mk(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

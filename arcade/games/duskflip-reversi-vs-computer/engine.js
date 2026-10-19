// engine.js — Duskflip reversi rules + CPU (no DOM; used by the page and by ai-worker.js). Our own code, MIT.
// 8×8 disc-flipping: place a disc so it outflanks a line of the opponent's discs, which flip to your colour.
// No legal move → pass; both stuck → game over, most discs wins. Side +1 = you (dark, first), −1 = CPU (light).
const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];
export function initial() { const b = new Array(64).fill(0); b[27] = -1; b[36] = -1; b[28] = 1; b[35] = 1; return b; }
function flipsAt(b, i, side) {
  if (b[i]) return null;
  const out = [], r0 = i >> 3, c0 = i & 7;
  for (const d of DIRS) {
    const dr = d === -9 || d === -8 || d === -7 ? -1 : d === 7 || d === 8 || d === 9 ? 1 : 0, dc = d === -9 || d === -1 || d === 7 ? -1 : d === -7 || d === 1 || d === 9 ? 1 : 0;
    let r = r0 + dr, c = c0 + dc; const line = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === -side) { line.push(r * 8 + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === side) out.push(...line);
  }
  return out.length ? out : null;
}
export function moves(b, side) { const out = []; for (let i = 0; i < 64; i++) { const f = flipsAt(b, i, side); if (f) out.push({ i, flips: f }); } return out; }
export function apply(b, m, side) { const nb = b.slice(); nb[m.i] = side; for (const f of m.flips) nb[f] = side; return nb; }
export const count = (b, side) => b.reduce((a, v) => a + (v === side ? 1 : 0), 0);

// ---------------------------------------------------------------- CPU
const W = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];
const CORN = [[0, 1, 8, 9], [7, 6, 15, 14], [56, 57, 48, 49], [63, 62, 55, 54]];
function evaluate(b, side) {
  let s = 0, empty = 0;
  for (let i = 0; i < 64; i++) { if (b[i]) s += W[i] * b[i]; else empty++; }
  for (const [c, a, d, x] of CORN) if (b[c]) { s -= (W[a] * b[a] + W[d] * b[d] + W[x] * b[x]); s += 12 * (b[a] === b[c] ? b[c] : 0) + 12 * (b[d] === b[c] ? b[c] : 0); }   // once a corner is taken its neighbours stop being risky
  const mob = moves(b, 1).length - moves(b, -1).length;
  s += mob * (empty > 20 ? 8 : 4);
  if (empty < 14) s += (count(b, 1) - count(b, -1)) * (14 - empty);
  return s * side;
}
const WIN = 100000;
export function search(b, side, { depth = 3, ms = 800, noise = 0, rand = Math.random, blunder = 0, exact = 0 } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  const empties = b.filter(v => !v).length;
  const final = (bb, sd) => { const d = count(bb, sd) - count(bb, -sd); return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0; };
  function ab(bb, sd, d, alpha, beta, passed) {
    if ((++nodes & 511) === 0 && Date.now() - t0 > ms) stop = true;
    if (stop) return 0;
    if (d <= 0) return evaluate(bb, sd);
    const ms_ = moves(bb, sd);
    if (!ms_.length) { if (passed) return final(bb, sd); return -ab(bb, -sd, d, -beta, -alpha, true); }
    ms_.sort((x, y) => W[y.i] - W[x.i]);
    let best = -Infinity;
    for (const m of ms_) {
      const v = -ab(apply(bb, m, sd), -sd, d - 1, -beta, -alpha, false);
      if (stop) return 0;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return best;
  }
  const root = moves(b, side); if (!root.length) return null;
  if (root.length === 1) return root[0];
  if (blunder && rand() < blunder) return root[Math.floor(rand() * root.length)];
  const jit = root.map(() => (noise ? (rand() * 2 - 1) * noise : 0));
  let best = root[0];
  const maxD = exact && empties <= exact ? empties : depth;
  for (let d = 1; d <= maxD; d++) {
    let bs = -Infinity, bm = null;
    for (let k = 0; k < root.length; k++) {
      const v = -ab(apply(b, root[k], side), -side, d - 1, -Infinity, Infinity, false) + jit[k];
      if (stop) break;
      if (v > bs) { bs = v; bm = root[k]; }
    }
    if (stop) break;
    if (bm) best = bm;
    if (Date.now() - t0 > ms * 0.4) break;
  }
  return best;
}
export function think({ b, side = -1, diff, seed, fk = 1 }) {
  const rand = mk(seed);
  const L = [{ depth: 1, ms: 200, noise: 40 / fk, blunder: 0.15 / fk }, { depth: 3, ms: 500 * fk, noise: 8 / fk }, { depth: 7, ms: 1300 * fk, exact: 12 }][diff];
  return search(b, side, { ...L, rand });
}
function mk(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

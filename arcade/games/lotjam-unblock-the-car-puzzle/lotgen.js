// lotgen.js — parking-lot puzzle generator + solver (6×6, red car on row 2 exits right). Our own code, MIT.
// A vehicle: { h: true|false (horizontal), len: 2|3, line: row (h) or column (v), red?: bool }; positions live in a separate array.
// generate() places random vehicles, explores every state reachable from that layout (BFS), then measures each state's distance
// to a solved state (multi-source BFS back from every state where the red car reaches the exit) and picks the state whose
// shortest solution length is closest to the target. Difficulty = that solution length (moves; one move = one slide).
export const N = 6, EXIT_ROW = 2;

export function encode(pos) { let c = 0; for (let i = pos.length - 1; i >= 0; i--) c = c * 6 + pos[i]; return c; }
export function decode(code, n, out = new Array(n)) { for (let i = 0; i < n; i++) { out[i] = code % 6; code = Math.floor(code / 6); } return out; }
export function cellsOf(v, p) { const out = []; for (let k = 0; k < v.len; k++) out.push(v.h ? v.line * N + p + k : (p + k) * N + v.line); return out; }
export function occupancy(V, pos) { const o = new Int8Array(N * N).fill(-1); V.forEach((v, i) => { for (const c of cellsOf(v, pos[i])) o[c] = i; }); return o; }
/** free range for vehicle i: [lo, hi] positions it can slide to */
export function range(V, pos, i, occ = occupancy(V, pos)) {
  const v = V[i]; let lo = pos[i], hi = pos[i];
  const at = (p) => v.h ? v.line * N + p : p * N + v.line;
  while (lo - 1 >= 0 && occ[at(lo - 1)] < 0) lo--;
  while (hi + v.len < N && occ[at(hi + v.len)] < 0) hi++;
  return [lo, hi];
}
function neighbours(V, code, fn) {
  const pos = decode(code, V.length), occ = occupancy(V, pos);
  for (let i = 0; i < V.length; i++) {
    const [lo, hi] = range(V, pos, i, occ), p0 = pos[i];
    for (let p = lo; p <= hi; p++) if (p !== p0) { pos[i] = p; fn(encode(pos), i, p); }
    pos[i] = p0;
  }
}
const solvedPos = (V) => N - V[0].len;
/** shortest solution from pos: array of [vehicle, newPos] moves, or null */
export function solve(V, pos, cap = 200000) {
  const start = encode(pos), goal = solvedPos(V);
  if (pos[0] === goal) return [];
  const prev = new Map([[start, null]]), q = [start];
  for (let h = 0; h < q.length && prev.size < cap; h++) {
    const c = q[h]; let found = -1;
    neighbours(V, c, (n, i, p) => {
      if (found >= 0 || prev.has(n)) return;
      prev.set(n, [c, i, p]); q.push(n);
      if (i === 0 && p === goal) found = n;
    });
    if (found >= 0) { const path = []; let k = found; while (prev.get(k)) { const [pc, i, p] = prev.get(k); path.push([i, p]); k = pc; } return path.reverse(); }
  }
  return null;
}
function hardestIn(V, startCode, target, cap) {
  // 1) the whole reachable component
  const seen = new Set([startCode]), q = [startCode];
  for (let h = 0; h < q.length; h++) { if (q.length > cap) return null; neighbours(V, q[h], (n) => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); }
  // 2) distance to solved, multi-source BFS from solved states (moves are reversible)
  const goal = solvedPos(V), dist = new Map(), qq = [];
  for (const c of q) if (c % 6 === goal) { dist.set(c, 0); qq.push(c); }
  if (!qq.length) return null;
  for (let h = 0; h < qq.length; h++) { const d = dist.get(qq[h]) + 1; neighbours(V, qq[h], (n) => { if (!dist.has(n)) { dist.set(n, d); qq.push(n); } }); }
  let best = null, bd = -1;
  for (const [c, d] of dist) { const score = d >= target ? 1000 - (d - target) : d; if (score > bd) { bd = score; best = { code: c, d }; } }
  return best;
}
export function generate(rand, target, { vehicles = 11, budgetMs = 350 } = {}) {
  const t0 = performance.now(); let best = null;
  for (let tries = 0; tries < 400 && (performance.now() - t0 < budgetMs || !best); tries++) {
    const V = [{ h: true, len: 2, line: EXIT_ROW, red: true }], pos = [Math.floor(rand() * 3)];
    const occ = new Int8Array(N * N).fill(-1); for (const c of cellsOf(V[0], pos[0])) occ[c] = 0;
    const want = vehicles + Math.floor(rand() * 3) - 1;
    for (let k = 0; k < 200 && V.length < want + 1; k++) {
      const h = rand() < 0.5, len = rand() < 0.28 ? 3 : 2, line = Math.floor(rand() * N), p = Math.floor(rand() * (N - len + 1));
      if (h && line === EXIT_ROW) continue;                      // nothing else lies across the exit lane horizontally
      const v = { h, len, line }, cs = cellsOf(v, p);
      if (cs.some(c => occ[c] >= 0)) continue;
      V.push(v); pos.push(p); for (const c of cs) occ[c] = V.length - 1;
    }
    const r = hardestIn(V, encode(pos), target, 60000);
    if (!r) continue;
    if (!best || (best.d < target ? r.d > best.d : (r.d >= target && Math.abs(r.d - target) < Math.abs(best.d - target)))) best = { V, pos: decode(r.code, V.length), d: r.d };
    if (best.d >= target && best.d <= target + 2 && performance.now() - t0 > 60) break;
  }
  return best;
}

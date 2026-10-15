// flipgen.js — Flipwise boards (pure, no DOM). Our own code, MIT.
// Each tile carries a flip pattern. Pressing tile j flips the tiles in its pattern. Over GF(2) the board is a square
// matrix; we only keep pattern layouts whose matrix is invertible, so every scramble has exactly one set of tiles to
// press (the par), and the hint can always name a tile that must be pressed.
export const PATTERNS = {
  plus: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  x: [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]],
  ring: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]],
  knight: [[0, 0], [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]],
  row: [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0]], col: [[0, 0], [0, 1], [0, -1], [0, 2], [0, -2]],
};
export function affected(N, pat, c) {
  const y = (c / N) | 0, x = c % N, out = [];
  for (const [dx, dy] of PATTERNS[pat]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) out.push(ny * N + nx); }
  return out;
}
// inverse of the press matrix over GF(2), or null if singular
export function inverse(N, pats) {
  const T = N * N, A = [], I = [];
  for (let i = 0; i < T; i++) { A.push(new Uint8Array(T)); I.push(new Uint8Array(T)); I[i][i] = 1; }
  for (let j = 0; j < T; j++) for (const i of affected(N, pats[j], j)) A[i][j] = 1;   // A[i][j]: pressing j flips i
  for (let col = 0, row = 0; col < T; col++, row++) {
    let p = row; while (p < T && !A[p][col]) p++;
    if (p === T) return null;
    [A[row], A[p]] = [A[p], A[row]]; [I[row], I[p]] = [I[p], I[row]];
    for (let r = 0; r < T; r++) if (r !== row && A[r][col]) { for (let k = 0; k < T; k++) { A[r][k] ^= A[row][k]; I[r][k] ^= I[row][k]; } }
  }
  return I;
}
export function solution(N, inv, st) {
  const T = N * N, x = new Uint8Array(T);
  for (let i = 0; i < T; i++) { let v = 0; for (let k = 0; k < T; k++) if (inv[i][k] && st[k]) v ^= 1; x[i] = v; }
  return x;
}
export function spec(level, fk = 1) {
  const L = level * fk;
  if (L < 3) return { N: 3, kinds: ['plus'], k: 2 + (L >= 2) };
  if (L < 6) return { N: 4, kinds: ['plus', 'knight'], k: 4 };
  if (L < 10) return { N: 4, kinds: ['plus', 'knight', 'x', 'row', 'col'], k: 5 };
  if (L < 16) return { N: 5, kinds: ['plus', 'x', 'knight'], k: 6 };
  if (L < 25) return { N: 5, kinds: ['plus', 'x', 'knight', 'row', 'col', 'ring'], k: 7 + (L >= 20) };
  return { N: 6, kinds: ['plus', 'x', 'knight', 'row', 'col', 'ring'], k: Math.min(12, 9 + Math.floor((L - 25) / 10)) };
}
export function generate(level, seed, fk, rngf) {
  const sp = spec(level, fk), { N } = sp, r = rngf(seed), T = N * N;
  const k = Math.max(2, Math.min(T - 2, Math.round(sp.k * Math.max(0.85, Math.min(1.3, fk)))));
  for (let t = 0; t < 600; t++) {
    // mostly the first pattern, sprinkled with the others
    const pats = []; for (let i = 0; i < T; i++) pats.push(sp.kinds.length === 1 || r() < 0.45 ? sp.kinds[0] : sp.kinds[1 + Math.floor(r() * (sp.kinds.length - 1))]);
    const inv = inverse(N, pats); if (!inv) continue;
    const press = []; const idx = [...Array(T).keys()]; for (let i = T - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (let i = 0; i < k; i++) press.push(idx[i]);
    const st = new Uint8Array(T); for (const p of press) for (const a of affected(N, pats[p], p)) st[a] ^= 1;
    if (st.every(v => !v)) continue;
    const sol = solution(N, inv, st), par = sol.reduce((a, b) => a + b, 0);
    return { N, pats, inv, start: Array.from(st), par, kinds: [...new Set(pats)] };
  }
  return null;
}

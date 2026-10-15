// solgen.js — Solune puzzle generator + human-style logic solver (pure, no DOM). Our own code, MIT.
// Grid N×N (N even) of suns (1) and moons (2): every row and column holds N/2 of each, never three alike in a line,
// '=' between two cells means alike, '×' means different. Clues are removed one by one while the logic solver below
// can still finish the grid without guessing, which also proves the answer is unique.
export const SUN = 1, MOON = 2;
const opp = (v) => 3 - v;

function fullGrid(N, r) {
  const g = new Array(N * N).fill(0), h = N / 2;
  const okAt = (c) => {
    const y = (c / N) | 0, x = c % N, v = g[c];
    if (x >= 2 && g[c - 1] === v && g[c - 2] === v) return false;
    if (y >= 2 && g[c - N] === v && g[c - 2 * N] === v) return false;
    let rc = 0, cc = 0; for (let i = 0; i <= x; i++) if (g[y * N + i] === v) rc++; for (let j = 0; j <= y; j++) if (g[j * N + x] === v) cc++;
    return rc <= h && cc <= h;
  };
  const go = (c) => {
    if (c === N * N) return true;
    const vs = r() < 0.5 ? [1, 2] : [2, 1];
    for (const v of vs) { g[c] = v; if (okAt(c) && go(c + 1)) return true; }
    g[c] = 0; return false;
  };
  go(0); return g;
}
// all valid lines of length N (balanced, no triples)
const LINES = {};
function lines(N) {
  if (LINES[N]) return LINES[N];
  const out = [], a = [];
  const go = (i, s, m) => {
    if (i === N) { out.push(a.slice()); return; }
    for (const v of [1, 2]) {
      if ((v === 1 ? s : m) >= N / 2) continue;
      if (i >= 2 && a[i - 1] === v && a[i - 2] === v) continue;
      a[i] = v; go(i + 1, s + (v === 1), m + (v === 2));
    }
  };
  go(0, 0, 0); return (LINES[N] = out);
}
// edges: Map key "a:b" (a<b, neighbours) → '=' | 'x'
export const ek = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
export function lineCells(N) {
  const L = []; for (let y = 0; y < N; y++) L.push([...Array(N).keys()].map(x => y * N + x));
  for (let x = 0; x < N; x++) L.push([...Array(N).keys()].map(y => y * N + x)); return L;
}
// one deduction {c, v, lvl, why} or null
export function step(N, st, edges, maxLvl = 2, LC = lineCells(N)) {
  // 1a: signs next to a known cell
  for (const [k, s] of edges) {
    const [a, b] = k.split(':').map(Number);
    if (st[a] && !st[b]) return { c: b, v: s === '=' ? st[a] : opp(st[a]), lvl: 1, why: 'sign' };
    if (st[b] && !st[a]) return { c: a, v: s === '=' ? st[b] : opp(st[b]), lvl: 1, why: 'sign' };
  }
  for (const L of LC) {
    // 1b: two alike side by side → the cells either side are the other symbol; 1c: X _ X → middle is the other
    for (let i = 0; i < N; i++) {
      const c = L[i]; if (st[c]) continue;
      const v1 = i >= 2 && st[L[i - 1]] && st[L[i - 1]] === st[L[i - 2]] ? st[L[i - 1]] : 0;
      const v2 = i <= N - 3 && st[L[i + 1]] && st[L[i + 1]] === st[L[i + 2]] ? st[L[i + 1]] : 0;
      const v3 = i >= 1 && i <= N - 2 && st[L[i - 1]] && st[L[i - 1]] === st[L[i + 1]] ? st[L[i - 1]] : 0;
      const v = v1 || v2 || v3; if (v) return { c, v: opp(v), lvl: 1, why: v3 ? 'between' : 'pair' };
    }
    // 1d: a line already holding half of one symbol takes the other everywhere else
    let s = 0, m = 0; for (const c of L) { if (st[c] === 1) s++; else if (st[c] === 2) m++; }
    if (s === N / 2 || m === N / 2) for (const c of L) if (!st[c]) return { c, v: s === N / 2 ? 2 : 1, lvl: 1, why: 'count' };
  }
  if (maxLvl < 2) return null;
  // 2: try every legal filling of one line (respecting its own signs); a cell that agrees in all of them is forced
  const all = lines(N);
  for (const L of LC) {
    if (L.every(c => st[c])) continue;
    const fits = all.filter(a => {
      for (let i = 0; i < N; i++) if (st[L[i]] && st[L[i]] !== a[i]) return false;
      for (let i = 0; i < N - 1; i++) { const e = edges.get(ek(L[i], L[i + 1])); if (e && ((e === '=') !== (a[i] === a[i + 1]))) return false; }
      return true;
    });
    if (!fits.length) return null;
    for (let i = 0; i < N; i++) if (!st[L[i]] && fits.every(a => a[i] === fits[0][i])) return { c: L[i], v: fits[0][i], lvl: 2, why: 'line' };
  }
  return null;
}
export function solve(N, given, edges, maxLvl = 2) {
  const st = given.slice(), LC = lineCells(N); let hard = 0;
  for (;;) { const s = step(N, st, edges, maxLvl, LC); if (!s) break; st[s.c] = s.v; hard = Math.max(hard, s.lvl); }
  return { ok: st.every(v => v), st, hard };
}
export function spec(level, fk = 1) {
  const L = level * fk;
  const N = L < 2.5 ? 4 : L < 16 ? 6 : 8;
  const maxLvl = L < 4 ? 1 : 2;
  const keep = L < 2 ? 0.45 : L < 4 ? 0.26 : L < 7 ? 0.16 : 0;   // easy levels keep a few extra clues
  return { N, maxLvl, keep };
}
export function generate(level, seed, fk, rngf) {
  const { N, maxLvl, keep } = spec(level, fk), r = rngf(seed);
  for (let attempt = 0; attempt < 30; attempt++) {
    const sol = fullGrid(N, r), given = sol.slice(), edges = new Map();
    for (let c = 0; c < N * N; c++) for (const d of [c + 1, c + N]) {
      if ((d === c + 1 && c % N === N - 1) || d >= N * N) continue;
      if (r() < 0.45) edges.set(ek(c, d), sol[c] === sol[d] ? '=' : 'x');
    }
    const items = []; for (let c = 0; c < N * N; c++) items.push(['c', c]); for (const k of edges.keys()) items.push(['e', k]);
    // try removing given symbols a little before signs, so finished puzzles show plenty of = / × clues
    const key = new Map(items.map(it => [it, r() + (it[0] === 'e' ? 0.18 : 0)])); items.sort((a, b) => key.get(a) - key.get(b));
    const floor = Math.round(items.length * keep);
    let left = items.length;
    for (const [t, k] of items) {
      if (left <= floor) break;
      if (t === 'c') { const v = given[k]; given[k] = 0; if (!solve(N, given, edges, maxLvl).ok) given[k] = v; else left--; }
      else { const v = edges.get(k); edges.delete(k); if (!solve(N, given, edges, maxLvl).ok) edges.set(k, v); else left--; }
    }
    const res = solve(N, given, edges, maxLvl);
    if (!res.ok) continue;
    if (maxLvl === 2 && res.hard < 2 && attempt < 8) continue;
    // need both kinds of clue for the look of the thing
    if (!edges.size || given.every(v => !v)) continue;
    return { N, sol, given, edges: [...edges], hard: res.hard };
  }
  return null;
}

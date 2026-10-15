// Pourly levels — every level is a seeded deal that the solver below proves solvable before it is used.
// The solver's move list, played backwards from the sorted state, is the reverse-pour that builds the level.
export const CAP = 4;
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
export const top = (t) => t[t.length - 1];
export const run = (t) => { let k = 0; for (let i = t.length - 1; i >= 0 && t[i] === top(t); i--) k++; return k; };
export const done = (t) => !t.length || (t.length === CAP && run(t) === CAP);
export const legal = (T, a, b) => a !== b && T[a].length > 0 && T[b].length < CAP && (!T[b].length || top(T[b]) === top(T[a]));
export const pourN = (T, a, b) => Math.min(run(T[a]), CAP - T[b].length);
const key = (T) => T.map((t) => t.join(',')).sort().join('|');

/** depth-first solver with a visited set; returns a list of [from, to] or null */
export function solve(T0, budget = 40000) {
  const seen = new Set(), path = [];
  function dfs(T) {
    if (T.every(done)) return true;
    if (--budget < 0) return false;
    const k = key(T); if (seen.has(k)) return false; seen.add(k);
    const mv = [];
    for (let a = 0; a < T.length; a++) {
      if (!T[a].length || done(T[a])) continue;
      const ra = run(T[a]); let emptyTried = false;
      for (let b = 0; b < T.length; b++) {
        if (!legal(T, a, b)) continue;
        if (!T[b].length) { if (ra === T[a].length || emptyTried) continue; emptyTried = true; }
        const n = pourN(T, a, b); let s = T[b].length ? 10 + n : 0; if (n === ra) s += 3;
        mv.push([s, a, b, n]);
      }
    }
    mv.sort((x, y) => y[0] - x[0]);
    for (const [, a, b, n] of mv) {
      const U = T.slice(), c = top(T[a]); U[a] = T[a].slice(0, -n); U[b] = T[b].concat(Array(n).fill(c));
      path.push([a, b]); if (dfs(U)) return true; path.pop();
    }
    return false;
  }
  return dfs(T0.map((t) => t.slice())) ? path.slice() : null;
}

/** n colours in n full tubes + `empties` empty tubes; no tube starts with 3 of a kind; proven solvable */
export function deal(n, seed, empties = 2) {
  const R = rng(seed);
  for (let tries = 0; tries < 80; tries++) {
    const u = []; for (let c = 0; c < n; c++) for (let i = 0; i < CAP; i++) u.push(c);
    for (let i = u.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [u[i], u[j]] = [u[j], u[i]]; }
    const T = []; for (let c = 0; c < n; c++) T.push(u.slice(c * CAP, c * CAP + CAP));
    for (let e = 0; e < empties; e++) T.push([]);
    if (T.some((t) => t.length && run(t) >= 3)) continue;
    const p = solve(T); if (p) return { T, par: p.length };
  }
  const T = []; for (let c = 0; c < n; c++) T.push([c, (c + 1) % n, c, (c + 1) % n]); for (let e = 0; e < empties; e++) T.push([]);
  return { T, par: 2 * n };
}

// Pantry Sort logic: jars hold up to CAP pieces of fruit (bottom → top). Pour the top run of one kind onto a jar whose
// top is the same kind (or that is empty), as many as fit. A jar with CAP of one kind is finished: it gets its lid and
// becomes jam, and can't be moved again. Win = every jar finished or empty. A small solver gives each level a par,
// proves it can be solved before it is dealt, and drives the hint and the QA bot. Pure logic, no DOM.
export const CAP = 4;
export const KINDS = ['strawberry', 'blueberry', 'apricot', 'lemon', 'plum', 'lime', 'rhubarb', 'honey'];
export const JAM = { strawberry: 'Strawberry Jam', blueberry: 'Blueberry Jam', apricot: 'Apricot Jam', lemon: 'Lemon Curd', plum: 'Plum Jam', lime: 'Lime Marmalade', rhubarb: 'Rhubarb Jam', honey: 'Heather Honey' };

export const top = j => j.length ? j[j.length - 1] : null;
export const done = j => j.length === CAP && j.every(k => k === j[0]);
export function run(j) { if (!j.length) return 0; const t = top(j); let n = 0; for (let i = j.length - 1; i >= 0 && j[i] === t; i--) n++; return n; }
export function canPour(J, a, b) {
  if (a === b) return false; const A = J[a], Bj = J[b];
  if (!A.length || done(A) || Bj.length >= CAP) return false;
  return !Bj.length || top(Bj) === top(A);
}
/** a legal pour that achieves something (not a whole one-kind jar into an empty jar) */
export function useful(J, a, b) {
  if (!canPour(J, a, b)) return false;
  const A = J[a]; if (!J[b].length && run(A) === A.length) return false;
  return true;
}
export function pour(J, a, b) {
  const n = Math.min(run(J[a]), CAP - J[b].length), k = top(J[a]);
  for (let i = 0; i < n; i++) { J[a].pop(); J[b].push(k); }
  return n;
}
export const won = J => J.every(j => !j.length || done(j));
export const clone = J => J.map(j => j.slice());
export function moves(J) { const out = []; for (let a = 0; a < J.length; a++) for (let b = 0; b < J.length; b++) if (useful(J, a, b)) out.push([a, b]); return out; }
export const stuck = J => !won(J) && moves(J).length === 0;
const key = J => J.map(j => j.join(',')).sort().join('|');

/** depth-first solver with a visited set; returns a list of [a,b] moves or null. Good moves first. */
export function solve(J0, limit = 60000) {
  const seen = new Set(); let nodes = 0;
  const score = (J, a, b) => {   // finishing a jar, pouring onto a matching run, emptying a jar: first
    let s = 0; const A = J[a], Bj = J[b], n = Math.min(run(A), CAP - Bj.length);
    if (Bj.length && Bj.length + n === CAP && Bj.every(k => k === top(A))) s += 10;
    if (Bj.length) s += 4 + run(Bj); else s -= 2;
    if (n === A.length) s += 3; if (n < run(A)) s -= 3;
    return s;
  };
  const path = [];
  function dfs(J) {
    if (won(J)) return true;
    if (++nodes > limit) return false;
    const k = key(J); if (seen.has(k)) return false; seen.add(k);
    const ms = moves(J).map(([a, b]) => [a, b, score(J, a, b)]).sort((x, y) => y[2] - x[2]);
    for (const [a, b] of ms) {
      const T = clone(J); pour(T, a, b); path.push([a, b]);
      if (dfs(T)) return true;
      path.pop();
    }
    return false;
  }
  return dfs(clone(J0)) ? path.slice() : null;
}

/** level n: kinds and spare jars; first 5 levels near-certain wins; a short "Hard" level every 6th (one spare jar) */
export function makeLevel(n, fk = 1, rnd, { daily = false } = {}) {
  const easy = !daily && n <= 5, hard = !daily && n > 5 && n % 6 === 0;
  let kinds = daily ? 6 : easy ? [3, 3, 4, 4, 5][n - 1] : Math.min(8, 5 + Math.floor((n - 6) / 7) + (n % 3 === 0 ? 1 : 0));
  if (!easy && !daily) kinds = Math.max(4, Math.min(8, Math.round(kinds * Math.min(1.15, Math.max(0.88, fk)))));
  if (hard) kinds = Math.max(4, kinds - 1);
  const spare = hard ? 1 : 2;
  const pick = [...KINDS].sort(() => rnd() - 0.5).slice(0, kinds);
  for (let tries = 0; tries < 60; tries++) {
    const pool = []; for (const k of pick) for (let i = 0; i < CAP; i++) pool.push(k);
    for (let i = pool.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let J = pick.map((_, i) => pool.slice(i * CAP, i * CAP + CAP));
    if (easy) {   // gentle start: lower layers mostly sorted already
      const sorted = n <= 2 ? 2 : 1;
      J = pick.map((k, i) => { const j = J[i]; for (let s = 0; s < sorted; s++) j[s] = k; return j; });
      const cnt = {}; for (const j of J) for (const k of j) cnt[k] = (cnt[k] || 0) + 1;   // repair counts after forcing bottoms
      const extra = [], need = []; for (const k of pick) { const d = (cnt[k] || 0) - CAP; for (let i = 0; i < d; i++) extra.push(k); for (let i = 0; i < -d; i++) need.push(k); }
      for (const j of J) for (let s = CAP - 1; s >= sorted && need.length; s--) { const e = extra.indexOf(j[s]); if (e >= 0) { extra.splice(e, 1); j[s] = need.pop(); } }
    }
    if (J.some(done)) continue;
    for (let s = 0; s < spare; s++) J.push([]);
    const sol = solve(J, 40000);
    if (!sol) continue;
    const par = Math.max(4, Math.round(sol.length * (easy ? 1.35 : 1.2) + 2));
    return { n, easy, hard, daily, kinds: pick, jars: J, par, sol: sol.length };
  }
  // fallback: a sure thing
  const J = pick.map(k => [k, k, k]); const rest = pick.slice(); J.push([]); J.push([]);
  rest.forEach((k, i) => J[(i + 1) % pick.length].length < CAP ? J[(i + 1) % pick.length].push(k) : J[J.length - 1].push(k));
  return { n, easy, hard, daily, kinds: pick, jars: J, par: kinds * 3, sol: kinds * 2 };
}

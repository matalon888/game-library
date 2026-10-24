// Shelfie level logic (pure, no three.js): shelves of 3 slots with hidden rows behind, a greedy solver that proves every
// generated level can be cleared (and sets the move par for the stars), and the difficulty schedule.
// State: comps = [{ L: [[t,t,t], [t,t,t], ...] }]  L[0] = the front row (what you can touch), -1 = empty slot.

export function rng(seed) { seed = Math.floor(Math.abs(seed)) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const clone = comps => comps.map(c => ({ L: c.L.map(l => l.slice()), extra: c.extra }));
export const frontFree = c => c.L[0].filter(v => v < 0).length;
export const left = comps => comps.reduce((a, c) => a + c.L.reduce((b, l) => b + l.filter(v => v >= 0).length, 0), 0);

/** apply a move in place; returns { cleared: type|-1, advanced: [compIdx...] } */
export function apply(comps, m) {
  const A = comps[m.a], B = comps[m.b], t = A.L[0][m.sa];
  A.L[0][m.sa] = -1; B.L[0][m.sb] = t;
  return settle(comps, [m.b, m.a]);
}
/** clears + row advances after a change on the given comps */
export function settle(comps, idxs) {
  const out = { cleared: [], advanced: [] };
  for (const i of idxs) {
    const c = comps[i], f = c.L[0];
    if (f[0] >= 0 && f[0] === f[1] && f[1] === f[2]) { out.cleared.push({ comp: i, type: f[0] }); c.L[0] = [-1, -1, -1]; }
  }
  for (const i of new Set(idxs)) {
    const c = comps[i];
    while (c.L.length > 1 && c.L[0].every(v => v < 0)) { c.L.shift(); out.advanced.push(i); }
  }
  return out;
}
export function stuck(comps) { return left(comps) > 0 && comps.every(c => frontFree(c) === 0); }

/** one greedy, sensible move (used by the generator's proof, the hint and the bot). r = rng for tie-breaks */
export function greedy(comps, r = Math.random, last = null) {
  const vis = {};                                              // type → [[comp, slot]] on the front rows
  comps.forEach((c, ci) => c.L[0].forEach((t, s) => { if (t >= 0) (vis[t] = vis[t] || []).push([ci, s]); }));
  const freeSlot = ci => { const f = comps[ci].L[0]; const e = [0, 1, 2].filter(s => f[s] < 0); return e.length ? e[Math.floor(r() * e.length)] : -1; };
  const cnt = (ci, t) => comps[ci].L[0].filter(v => v === t).length;
  const revealGain = ci => { const c = comps[ci]; const n = 3 - frontFree(c); return c.L.length > 1 ? 4 - n : 0; };   // fewer left on front + hidden rows = good to empty
  // 1. complete a pair: comp B holds 2×t and a gap, t is on another front
  let best = null, bs = -1e9;
  comps.forEach((B, bi) => {
    const f = B.L[0]; if (frontFree(B) !== 1) return;
    const t = f.find(v => v >= 0 && cnt(bi, v) === 2); if (t === undefined) return;
    for (const [ai, sa] of vis[t] || []) { if (ai === bi) continue; const sc = 10 + revealGain(ai) * 2 - cnt(ai, t) * 3 + r(); if (sc > bs) { bs = sc; best = { a: ai, sa, b: bi, sb: freeSlot(bi) }; } }
  });
  if (best) return best;
  // 2. grow a single into a pair where a third copy is visible somewhere
  comps.forEach((B, bi) => {
    if (frontFree(B) < 2) return;
    const t = B.L[0].find(v => v >= 0); if (t === undefined || (vis[t] || []).length < 3) return;
    for (const [ai, sa] of vis[t]) { if (ai === bi) continue; const sc = 6 + revealGain(ai) * 2 - cnt(ai, t) * 3 + r(); if (sc > bs) { bs = sc; best = { a: ai, sa, b: bi, sb: freeSlot(bi) }; } }
  });
  if (best) return best;
  // 3. start a triple in an empty shelf when 3 copies are visible
  const empty = comps.map((c, i) => i).filter(i => frontFree(comps[i]) === 3);
  if (empty.length) for (const t in vis) if (vis[t].length >= 3) {
    for (const [ai, sa] of vis[t]) { const sc = 3 + revealGain(ai) * 2 - cnt(ai, +t) * 3 + r(); if (sc > bs) { bs = sc; best = { a: ai, sa, b: empty[0], sb: 0 }; } }
  }
  if (best) return best;
  // 4. dig: move an item off a shelf with hidden rows onto a free gap, next to a same item if possible
  const holes = []; comps.forEach((c, i) => { if (frontFree(c) > 0) holes.push(i); });
  if (!holes.length) return null;
  comps.forEach((A, ai) => {
    A.L[0].forEach((t, sa) => {
      if (t < 0) return;
      for (const bi of holes) {
        if (bi === ai || (last && ai === last.b && bi === last.a)) continue;
        const pair = cnt(bi, t), others = 3 - frontFree(comps[bi]) - pair;
        const sc = revealGain(ai) * 2 + pair * 3 - others * 2 - (frontFree(comps[bi]) === 3 ? 1.5 : 0) + r() * 1.5;
        if (sc > bs) { bs = sc; best = { a: ai, sa, b: bi, sb: freeSlot(bi) }; }
      }
    });
  });
  return best;
}

/** play greedily to the end: { won, moves } */
export function solve(comps, seed, cap = 400) {
  const c = clone(comps), r = rng(seed); let moves = 0, last = null;
  while (left(c) > 0 && moves < cap) {
    const m = greedy(c, r, last); if (!m) break;
    apply(c, m); moves++; last = m;
  }
  return { won: left(c) === 0, moves };
}

// ---------------------------------------------------------------- difficulty schedule
// first 5 levels near-certain wins; then a sawtooth: every 6th level is a short "Hard" one, the level after it eases off.
export function plan(n, fk = 1) {
  if (n <= 5) return [
    { C: 4, T: 3, E: 3, deep: 0 }, { C: 4, T: 4, E: 4, deep: 1 }, { C: 6, T: 6, E: 4, deep: 1 },
    { C: 6, T: 7, E: 4, deep: 1 }, { C: 8, T: 9, E: 5, deep: 2 },
  ][n - 1];
  const hard = n % 6 === 0, after = n % 6 === 1;
  const base = Math.min(15, 8 + Math.floor((n - 6) / 4)) * fk;
  const T = Math.round(Math.max(6, Math.min(17, hard ? base - 1 : after ? base - 2 : base + (n % 3) - 1)));
  const C = Math.max(6, Math.min(12, Math.round(T * (hard ? 0.62 : 0.72))));
  const E = hard ? 3 : after ? 5 : 4;
  return { C, T, E, deep: hard ? 2 : 3, hard };
}

/**
 * build a level: { comps, types, par3, par2, hard }. pool = item ids of the theme. Proven solvable by the greedy solver
 * (the generator retries until it is), par = the solver's move count.
 */
export function generate(n, seed, pool, fk = 1, forced = null) {
  const P = forced || plan(n, fk);
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng(seed * 31 + attempt * 977 + 5);
    const types = shuffle(pool.slice(), r).slice(0, Math.min(P.T, pool.length));
    const T = types.length;
    // copies: mostly 3, some 6 on bigger levels (more ambiguity)
    const bag = []; types.forEach((_, i) => { const k = (n > 8 && i < Math.floor(T / 5)) ? 6 : 3; for (let j = 0; j < k; j++) bag.push(i); });
    shuffle(bag, r);
    const C = P.C, N = bag.length;
    const front = Math.min(N, C * 3 - P.E);
    const comps = Array.from({ length: C }, () => ({ L: [[-1, -1, -1]] }));
    // front rows: spread the empties across shelves
    const slots = []; for (let c = 0; c < C; c++) for (let s = 0; s < 3; s++) slots.push([c, s]);
    shuffle(slots, r);
    for (let i = 0; i < front; i++) { const [c, s] = slots[i]; comps[c].L[0][s] = bag[i]; }
    // hidden rows: rows of 1–3 items behind, deeper shelves first
    let rest = bag.slice(front);
    const order = shuffle([...Array(C).keys()], r);
    let k = 0, guard = 0;
    while (rest.length && guard++ < 999) {
      const c = order[k++ % C];
      if (comps[c].L.length > 1 + P.deep + Math.floor(rest.length / (C * 3))) continue;
      const take = Math.min(rest.length, 1 + Math.floor(r() * 3));
      const row = [-1, -1, -1], pos = shuffle([0, 1, 2], r);
      for (let j = 0; j < take; j++) row[pos[j]] = rest.pop();
      comps[c].L.push(row);
    }
    if (rest.length) continue;
    // no ready-made triple on a front row, no shelf whose front is empty while rows wait behind
    let bad = false;
    for (const c of comps) { const f = c.L[0]; if (f[0] >= 0 && f[0] === f[1] && f[1] === f[2]) bad = true; if (c.L.length > 1 && f.every(v => v < 0)) bad = true; }
    if (bad) continue;
    let best = Infinity, wins = 0;
    for (let s = 0; s < 6; s++) { const o = solve(comps, seed + s * 13 + attempt); if (o.won) { wins++; best = Math.min(best, o.moves); } }
    if (wins < (P.hard ? 2 : 4)) continue;          // must be clearly solvable (hard ones may be trickier)
    return { comps, types, par3: best + (n <= 5 ? 4 : 1), par2: Math.round(best * 1.45) + 3, hard: !!P.hard, plan: P, attempt };
  }
  // fallback: a trivially solvable small level (never a wall)
  return generate(n, seed + 1, pool, fk, { C: 6, T: 5, E: 4, deep: 1 });
}

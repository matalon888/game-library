// klondike.js — Klondike rules + solver, copied from our own patience-pine/solver.js (unchanged logic). Our own code, MIT.
export const SU = c => (c / 13) | 0, RK = c => c % 13 + 1, RED = c => { const s = (c / 13) | 0; return s === 1 || s === 2; };
export const canStack = (c, onto) => RK(onto) === RK(c) + 1 && RED(onto) !== RED(c);

export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** shuffled deck → { tab: [{d, c:[ids]}] ×7, stock: [ids in draw order] } */
export function dealCards(seed) {
  const r = rngf(seed * 2654435761 + 97), deck = [...Array(52).keys()];
  for (let k = 0; k < 5; k++) r();
  for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const tab = []; let p = 0;
  for (let i = 0; i < 7; i++) { const c = deck.slice(p, p + i + 1); p += i + 1; tab.push({ d: i, c }); }
  return { tab, stock: deck.slice(p) };
}

/** talon indices reachable from a fresh pass (draw k, unlimited passes) */
export function reach(T, k) { const out = []; for (let i = 0; i < T.length; i++) if (k === 1 || (i + 1) % k === 0 || i === T.length - 1) out.push(i); return out; }

const canF = (c, f) => f[SU(c)] === RK(c) - 1;
function safeAuto(c, f) {
  const r = RK(c); if (f[SU(c)] !== r - 1) return false; if (r <= 2) return true;
  return RED(c) ? f[0] >= r - 1 && f[3] >= r - 1 : f[1] >= r - 1 && f[2] >= r - 1;
}
const firstUp = col => col.d;
const pop = (col) => { col.c.pop(); if (col.c.length && col.d >= col.c.length) col.d = col.c.length - 1; };

/** all "useful" moves from a position (also used for the stuck check and hints). Moves:
 *  {k:'tf',col} column top → foundation · {k:'wf',card} talon → foundation · {k:'tt',from,at,to} run from index `at` → column
 *  {k:'wt',card,to} talon → column */
export function moves(tab, T, f, drawK, extraTalon = null, ptr = 0) {
  const out = [], tops = tab.map(col => col.c.length ? col.c[col.c.length - 1] : -1), L = T.length || 1;
  // talon cards nearest the current stock position first, so solutions cycle the stock as little as possible
  const idx = reach(T, drawK).sort((a, b) => ((a - ptr + 1 + L) % L) - ((b - ptr + 1 + L) % L));
  const R = new Set(idx.map(i => T[i])); if (extraTalon) for (const c of extraTalon) R.add(c);
  for (let i = 0; i < 7; i++) if (tops[i] >= 0 && canF(tops[i], f)) out.push({ k: 'tf', col: i });
  for (let i = 0; i < 7; i++) {
    const col = tab[i]; if (!col.c.length) continue;
    const at = firstUp(col), c = col.c[at];
    const empties = col.d === 0 && at === 0;
    let emptyDone = false;
    for (let j = 0; j < 7; j++) {
      if (j === i) continue;
      if (tops[j] < 0) { if (RK(c) === 13 && !empties && !emptyDone) { out.push({ k: 'tt', from: i, at, to: j }); emptyDone = true; } }
      else if (canStack(c, tops[j])) out.push({ k: 'tt', from: i, at, to: j });
    }
    // partial run: frees a card that can go straight to the foundation
    for (let a = at + 1; a < col.c.length; a++) {
      if (!canF(col.c[a - 1], f)) continue;
      for (let j = 0; j < 7; j++) if (j !== i && tops[j] >= 0 && canStack(col.c[a], tops[j])) { out.push({ k: 'tt', from: i, at: a, to: j }); break; }
    }
  }
  for (const c of R) {
    let emptyDone = false;
    for (let j = 0; j < 7; j++) {
      if (tops[j] < 0) { if (RK(c) === 13 && !emptyDone) { out.push({ k: 'wt', card: c, to: j }); emptyDone = true; } }
      else if (canStack(c, tops[j])) out.push({ k: 'wt', card: c, to: j });
    }
  }
  for (const c of R) if (canF(c, f)) out.push({ k: 'wf', card: c });
  return out;
}

export function apply(tab, T, f, m) {
  if (m.k === 'tf') { const col = tab[m.col], c = col.c[col.c.length - 1]; pop(col); f[SU(c)]++; }
  else if (m.k === 'wf') { T.splice(T.indexOf(m.card), 1); f[SU(m.card)]++; }
  else if (m.k === 'wt') { T.splice(T.indexOf(m.card), 1); tab[m.to].c.push(m.card); }
  else if (m.k === 'tt') { const col = tab[m.from], run = col.c.splice(m.at); if (col.c.length && col.d >= col.c.length) col.d = col.c.length - 1; tab[m.to].c.push(...run); }
}

/** returns { ok, path (list of moves incl. auto-moves), nodes } */
export function solve(tab0, T0, f0, drawK, limit = 20000, ptr0 = 0) {
  const seen = new Set(), path = []; let nodes = 0;
  const clone = (tab) => tab.map(col => ({ d: col.d, c: col.c.slice() }));
  function rec(tab, T, f, ptr) {
    if (++nodes > limit) return false;
    const pushed = [];
    for (let again = true; again;) {          // safe auto-moves, no branching
      again = false;
      for (let i = 0; i < 7; i++) { const col = tab[i]; if (col.c.length && safeAuto(col.c[col.c.length - 1], f)) { const m = { k: 'tf', col: i }; apply(tab, T, f, m); path.push(m); pushed.push(m); again = true; } }
      for (const i of reach(T, drawK)) if (safeAuto(T[i], f)) { const m = { k: 'wf', card: T[i] }; apply(tab, T, f, m); path.push(m); pushed.push(m); again = true; break; }
    }
    if (f[0] + f[1] + f[2] + f[3] === 52) return true;
    const key = f.join(',') + '|' + tab.map(col => col.d + ':' + col.c.join('.')).sort().join('/') + '|' + T.join('.');
    if (seen.has(key)) { path.length -= pushed.length; return false; }
    seen.add(key);
    for (const m of moves(tab, T, f, drawK, null, ptr)) {
      const t2 = clone(tab), T2 = T.slice(), f2 = f.slice(), np = m.card !== undefined ? T.indexOf(m.card) : ptr; apply(t2, T2, f2, m);
      path.push(m); if (rec(t2, T2, f2, np)) return true; path.pop();
      if (nodes > limit) break;
    }
    path.length -= pushed.length; return false;
  }
  const ok = rec(clone(tab0), T0.slice(), f0.slice(), ptr0);
  return { ok, path: ok ? path : null, nodes };
}

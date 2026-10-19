// rules.js — pyramid solitaire rules (pairs that add up to 13) as pure functions, plus a depth-first solver used to
// check that a deal can be cleared, to give hints and to drive the test bot. Our own code, MIT.
export const SU = c => (c / 13) | 0, RK = c => c % 13 + 1;
export const PASSES = 3;              // the stock may be gone through three times (two redeals)
// pyramid slot i: row r, index c. Slot i is covered by the two slots below it.
export const ROW = [], COL = [], KIDS = [];
for (let r = 0, i = 0; r < 7; r++) for (let c = 0; c <= r; c++, i++) { ROW[i] = r; COL[i] = c; }
for (let i = 0; i < 28; i++) { const r = ROW[i], c = COL[i]; KIDS[i] = r < 6 ? [idx(r + 1, c), idx(r + 1, c + 1)] : []; }
function idx(r, c) { return r * (r + 1) / 2 + c; }

export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function dealCards(seed) {
  const r = rngf(seed * 2654435761 + 59), deck = [...Array(52).keys()];
  for (let k = 0; k < 5; k++) r();
  for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { pyr: deck.slice(0, 28), talon: deck.slice(28) };
}
// a position: { pyr: [ids] (28), gone: bitmask of cleared slots, talon: [ids] (24, draw order), tgone: bitmask, p: drawn count, pass }
export const exposed = (st, i) => !(st.gone & (1 << i)) && KIDS[i].every(k => st.gone & (1 << k));
export function wasteTop(st) { for (let q = st.p - 1; q >= 0; q--) if (!(st.tgone & (1 << q))) return q; return -1; }
export function stockNext(st) { for (let q = st.p; q < st.talon.length; q++) if (!(st.tgone & (1 << q))) return q; return -1; }
export const cleared = (st) => st.gone === (1 << 28) - 1;
const pr = (st, i) => RK(st.pyr[i]);

/** moves: ['k', slot] king from the pyramid · ['kw'] king on the waste · ['pp', a, b] two pyramid cards · ['pw', a] pyramid + waste · ['d'] draw · ['r'] redeal */
export function moves(st) {
  const out = [], ex = []; for (let i = 0; i < 28; i++) if (exposed(st, i)) ex.push(i);
  const w = wasteTop(st), wr = w >= 0 ? RK(st.talon[w]) : 0;
  for (const i of ex) if (pr(st, i) === 13) out.push(['k', i]);
  if (wr === 13) out.push(['kw']);
  for (let a = 0; a < ex.length; a++) for (let b = a + 1; b < ex.length; b++) if (pr(st, ex[a]) + pr(st, ex[b]) === 13) out.push(['pp', ex[a], ex[b]]);
  if (w >= 0) for (const i of ex) if (pr(st, i) + wr === 13) out.push(['pw', i]);
  if (stockNext(st) >= 0) out.push(['d']);
  else if (st.pass < PASSES && wasteTop(st) >= 0) out.push(['r']);
  return out;
}
export function apply(st, m) {   // returns a new position
  const n = { ...st };
  if (m[0] === 'k') n.gone |= 1 << m[1];
  else if (m[0] === 'kw') n.tgone |= 1 << wasteTop(st);
  else if (m[0] === 'pp') n.gone |= (1 << m[1]) | (1 << m[2]);
  else if (m[0] === 'pw') { n.gone |= 1 << m[1]; n.tgone |= 1 << wasteTop(st); }
  else if (m[0] === 'd') n.p = stockNext(st) + 1;
  else if (m[0] === 'r') { n.p = 0; n.pass = st.pass + 1; }
  return n;
}
export function legal(st, m) { return moves(st).some(x => x.length === m.length && x.every((v, q) => v === m[q])); }
export const fresh = (d) => ({ pyr: d.pyr, talon: d.talon, gone: 0, tgone: 0, p: 0, pass: 1 });

/** depth-first search for a line that clears the pyramid. { ok, path, nodes } */
export function solve(st0, budget = 40000) {
  const seen = new Set(); let nodes = 0; const path = [];
  const key = (s) => s.gone + ',' + s.tgone + ',' + s.p + ',' + s.pass;
  function dfs(s) {
    if (cleared(s)) return true;
    if (nodes++ > budget) return false;
    const k = key(s); if (seen.has(k)) return false; seen.add(k);
    const ms = moves(s);
    // a king or a pair is never worse than drawing past it: try removals first (deepest rows first), then draw
    ms.sort((a, b) => rankM(s, b) - rankM(s, a));
    for (const m of ms) { path.push(m); if (dfs(apply(s, m))) return true; path.pop(); if (nodes > budget) return false; }
    return false;
  }
  const ok = dfs(st0);
  return { ok, path: ok ? path.slice() : [], nodes };
}
function rankM(s, m) {
  if (m[0] === 'k') return 100 + ROW[m[1]];
  if (m[0] === 'kw') return 90;
  if (m[0] === 'pp') return 60 + ROW[m[1]] + ROW[m[2]];
  if (m[0] === 'pw') return 40 + ROW[m[1]];
  if (m[0] === 'd') return 10;
  return 0;
}

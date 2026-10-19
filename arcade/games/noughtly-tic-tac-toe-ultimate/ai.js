// ai.js — rules + CPU players for Noughtly (classic 3×3 and the 9-board "ultimate" variant). Our own code, MIT.
// Players: 1 = you (✕), 2 = CPU (◯). Cells hold 0 / 1 / 2. Ultimate cell index = board * 9 + cell.
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function lineOf(a, off = 0, only12 = true) {
  for (const L of LINES) { const v = a[off + L[0]]; if (v && (!only12 || v < 3) && v === a[off + L[1]] && v === a[off + L[2]]) return L; }
  return null;
}
export const winnerOf = (a, off = 0) => { const L = lineOf(a, off); return L ? a[off + L[0]] : 0; };

// ---------------------------------------------------------------- classic
export function classicResult(c) { const w = winnerOf(c); if (w) return w; return c.every(v => v) ? 3 : 0; }
function minimax(c, turn, me, depth, alpha, beta) {
  const r = classicResult(c);
  if (r === me) return 10 - depth; if (r === 3) return 0; if (r) return depth - 10;
  let best = turn === me ? -99 : 99;
  for (let i = 0; i < 9; i++) if (!c[i]) {
    c[i] = turn; const s = minimax(c, 3 - turn, me, depth + 1, alpha, beta); c[i] = 0;
    if (turn === me) { if (s > best) best = s; if (best > alpha) alpha = best; } else { if (s < best) best = s; if (best < beta) beta = best; }
    if (beta <= alpha) break;
  }
  return best;
}
/** every legal move with its exact minimax value for `me` (higher is better) */
export function classicScores(c, me) {
  const out = [];
  for (let i = 0; i < 9; i++) if (!c[i]) { c[i] = me; out.push({ m: i, s: minimax(c, 3 - me, me, 1, -99, 99) }); c[i] = 0; }
  return out;
}
const immediate = (c, who) => { for (let i = 0; i < 9; i++) if (!c[i]) { c[i] = who; const w = winnerOf(c) === who; c[i] = 0; if (w) return i; } return -1; };
/** CPU move. level 0 Easy / 1 Normal / 2 Hard; slip = chance of a human-like slip (scaled by flow); r = rng */
export function classicMove(c, me, level, r, fk = 1) {
  const free = []; for (let i = 0; i < 9; i++) if (!c[i]) free.push(i);
  const pick = a => a[Math.floor(r() * a.length)];
  const win = immediate(c, me), block = immediate(c, 3 - me);
  if (level === 0) {                                    // Easy: takes a win it sees, blocks half the time, else wanders
    if (win >= 0 && r() < 0.8) return win;
    if (block >= 0 && r() < 0.45) return block;
    return pick(free);
  }
  if (win >= 0) return win;
  const slip = level === 1 ? Math.min(0.7, 0.5 * fk) : Math.min(0.25, 0.09 * fk);
  if (block >= 0 && (level === 2 || r() < 0.8)) return block;
  const sc = classicScores(c, me), top = Math.max(...sc.map(x => x.s));
  if (r() < slip) {                                     // a slip: any move that doesn't hand over an instant win
    const safe = sc.filter(x => { c[x.m] = me; const bad = immediate(c, 3 - me) >= 0; c[x.m] = 0; return !bad; });
    if (safe.length) return pick(safe).m;
  }
  return pick(sc.filter(x => x.s === top)).m;
}

// ---------------------------------------------------------------- ultimate
export function uNew() { return { cells: new Int8Array(81), macro: new Int8Array(9), next: -1, turn: 1, result: 0, last: -1 }; }
export function uClone(s) { return { cells: s.cells.slice(), macro: s.macro.slice(), next: s.next, turn: s.turn, result: s.result, last: s.last }; }
export function uLegal(s, out = []) {
  out.length = 0; if (s.result) return out;
  if (s.next >= 0 && !s.macro[s.next]) { const o = s.next * 9; for (let i = 0; i < 9; i++) if (!s.cells[o + i]) out.push(o + i); return out; }
  for (let b = 0; b < 9; b++) if (!s.macro[b]) { const o = b * 9; for (let i = 0; i < 9; i++) if (!s.cells[o + i]) out.push(o + i); }
  return out;
}
export function uPlay(s, m) {
  s.cells[m] = s.turn; s.last = m;
  const b = (m / 9) | 0, o = b * 9;
  const w = winnerOf(s.cells, o);
  if (w) s.macro[b] = w;
  else { let full = true; for (let i = 0; i < 9; i++) if (!s.cells[o + i]) { full = false; break; } if (full) s.macro[b] = 3; }
  const g = winnerOf(s.macro);
  if (g) s.result = g;
  else { let open = false; for (let i = 0; i < 9; i++) if (!s.macro[i]) { open = true; break; } if (!open) s.result = 3; }
  const n = m % 9; s.next = s.macro[n] ? -1 : n; s.turn = 3 - s.turn;
  return s;
}
const TMP = [];
function playout(s, r) {
  const t = uClone(s);
  while (!t.result) {
    const mv = uLegal(t, TMP); if (!mv.length) { t.result = 3; break; }
    // light heuristic: grab a small board when a move wins it
    let m = -1;
    if (r() < 0.5) for (const x of mv) { const o = ((x / 9) | 0) * 9; t.cells[x] = t.turn; const w = winnerOf(t.cells, o); t.cells[x] = 0; if (w) { m = x; break; } }
    uPlay(t, m >= 0 ? m : mv[Math.floor(r() * mv.length)]);
  }
  return t.result;
}
/** Monte Carlo tree search (UCT). Returns the most visited move. */
export function mcts(s, iters, r, maxMs = 900) {
  const root = { m: -1, p: null, kids: [], untried: uLegal(s).slice(), w: 0, n: 0, by: 3 - s.turn };
  if (root.untried.length === 1) return root.untried[0];
  const t0 = performance.now();
  for (let it = 0; it < iters; it++) {
    if ((it & 63) === 0 && performance.now() - t0 > maxMs) break;
    let node = root; const st = uClone(s);
    while (!node.untried.length && node.kids.length) {
      let best = null, bv = -1e9; const ln = Math.log(node.n);
      for (const k of node.kids) { const v = k.w / k.n + 1.25 * Math.sqrt(ln / k.n); if (v > bv) { bv = v; best = k; } }
      node = best; uPlay(st, node.m);
    }
    if (node.untried.length) {
      const i = Math.floor(r() * node.untried.length), m = node.untried[i]; node.untried.splice(i, 1);
      const by = st.turn; uPlay(st, m);
      const kid = { m, p: node, kids: [], untried: uLegal(st).slice(), w: 0, n: 0, by }; node.kids.push(kid); node = kid;
    }
    const res = st.result || playout(st, r);
    for (let k = node; k; k = k.p) { k.n++; if (res === k.by) k.w += 1; else if (res === 3) k.w += 0.5; }
  }
  let best = root.kids[0]; for (const k of root.kids) if (k.n > best.n) best = k;
  return best ? best.m : uLegal(s)[0];
}
export function ultimateMove(s, level, r, fk = 1) {
  const mv = uLegal(s);
  if (level === 0) {                                    // Easy: wins small boards it sees, otherwise plays loosely
    const me = s.turn;
    for (const x of mv) { const t = uPlay(uClone(s), x); if (t.result === me) return x; }
    if (r() < 0.55) for (const x of mv) { const o = ((x / 9) | 0) * 9; s.cells[x] = me; const w = winnerOf(s.cells, o); s.cells[x] = 0; if (w) return x; }
    return mv[Math.floor(r() * mv.length)];
  }
  const iters = Math.round((level === 1 ? 260 : 2600) * fk);
  return mcts(s, iters, r, level === 1 ? 300 : 1100);
}

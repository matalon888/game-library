// rules.js — four-cell solitaire rules as pure functions, plus a best-first solver used to check that a deal can be won,
// to give hints and to drive the test bot. Our own code, MIT.
export const SU = c => (c / 13) | 0, RK = c => c % 13 + 1, RED = c => { const s = (c / 13) | 0; return s === 1 || s === 2; };
export const canStack = (c, onto) => RK(onto) === RK(c) + 1 && RED(onto) !== RED(c);

export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** shuffled deck dealt row by row into 8 columns (7,7,7,7,6,6,6,6) */
export function dealCards(seed) {
  const r = rngf(seed * 2654435761 + 41), deck = [...Array(52).keys()];
  for (let k = 0; k < 5; k++) r();
  for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const cols = [[], [], [], [], [], [], [], []]; deck.forEach((c, i) => cols[i % 8].push(c));
  return cols;
}
// a position: { cols: [[ids]] ×8, cells: [id|-1] ×4, found: [count] ×4 }
export const clonePos = (p) => ({ cols: p.cols.map(c => c.slice()), cells: p.cells.slice(), found: p.found.slice() });
export const freeCells = (p) => p.cells.filter(c => c < 0).length;
export const emptyCols = (p) => p.cols.filter(c => !c.length).length;
/** the most cards one move can carry (the classic supermove: free cells and empty columns as temporary space) */
export const capacity = (p, toEmpty) => (freeCells(p) + 1) * Math.pow(2, Math.max(0, emptyCols(p) - (toEmpty ? 1 : 0)));
/** the start index of the ordered run at the bottom of column i */
export function runStart(col) { let k = col.length - 1; while (k > 0 && canStack(col[k], col[k - 1])) k--; return k; }
const canF = (p, c) => p.found[SU(c)] === RK(c) - 1;

// moves: [src, a, k, dst, b]   src: 'c' column a (from index k) | 'x' cell a;   dst: 'c' column b | 'x' cell b | 'f' foundation
export function legal(p, m) {
  const [src, a, k, dst, b] = m;
  let ids;
  if (src === 'c') { const col = p.cols[a]; if (k < 0 || k >= col.length) return false; ids = col.slice(k); for (let q = 1; q < ids.length; q++) if (!canStack(ids[q], ids[q - 1])) return false; }
  else { if (p.cells[a] < 0) return false; ids = [p.cells[a]]; }
  if (dst === 'f') return ids.length === 1 && canF(p, ids[0]);
  if (dst === 'x') return ids.length === 1 && src === 'c' && p.cells[b] < 0;
  if (dst === 'c') {
    if (src === 'c' && a === b) return false; const t = p.cols[b];
    if (t.length && !canStack(ids[0], t[t.length - 1])) return false;
    return ids.length <= capacity(p, !t.length);
  }
  return false;
}
export function apply(p, m) {   // mutates p
  const [src, a, k, dst, b] = m;
  const ids = src === 'c' ? p.cols[a].splice(k) : [p.cells[a]];
  if (src === 'x') p.cells[a] = -1;
  if (dst === 'f') p.found[SU(ids[0])]++;
  else if (dst === 'x') p.cells[b] = ids[0];
  else p.cols[b].push(...ids);
}
/** the next safe card to send home automatically (never needed elsewhere), as a move, or null */
export function safeAuto(p) {
  const safe = (c) => { if (!canF(p, c)) return false; const r = RK(c); if (r <= 2) return true; return RED(c) ? p.found[0] >= r - 1 && p.found[3] >= r - 1 : p.found[1] >= r - 1 && p.found[2] >= r - 1; };
  for (let x = 0; x < 4; x++) if (p.cells[x] >= 0 && safe(p.cells[x])) return ['x', x, 0, 'f', 0];
  for (let i = 0; i < 8; i++) { const col = p.cols[i]; if (col.length && safe(col[col.length - 1])) return ['c', i, col.length - 1, 'f', 0]; }
  return null;
}
export function settle(p) { const out = []; for (let m = safeAuto(p); m; m = safeAuto(p)) { apply(p, m); out.push(m); } return out; }

/** every legal move (sensible subset: one empty cell / column target is enough) */
export function moves(p) {
  const out = [], fx = p.cells.indexOf(-1);
  for (let x = 0; x < 4; x++) { const c = p.cells[x]; if (c < 0) continue;
    if (canF(p, c)) out.push(['x', x, 0, 'f', 0]);
    let emptyDone = false;
    for (let j = 0; j < 8; j++) { const t = p.cols[j]; if (!t.length) { if (emptyDone) continue; emptyDone = true; out.push(['x', x, 0, 'c', j]); } else if (canStack(c, t[t.length - 1])) out.push(['x', x, 0, 'c', j]); }
  }
  for (let i = 0; i < 8; i++) {
    const col = p.cols[i]; if (!col.length) continue; const top = col[col.length - 1], rs = runStart(col);
    if (canF(p, top)) out.push(['c', i, col.length - 1, 'f', 0]);
    let emptyDone = false;
    for (let j = 0; j < 8; j++) {
      if (j === i) continue; const t = p.cols[j];
      if (!t.length) {
        if (emptyDone) continue; emptyDone = true;
        const cap = capacity(p, true);
        for (let k = Math.max(rs, col.length - cap); k < col.length; k++) if (k > 0) out.push(['c', i, k, 'c', j]);
        continue;
      }
      const tt = t[t.length - 1];
      for (let k = rs; k < col.length; k++) if (canStack(col[k], tt)) { if (col.length - k <= capacity(p, false)) out.push(['c', i, k, 'c', j]); break; }
    }
    if (fx >= 0) out.push(['c', i, col.length - 1, 'x', fx]);
  }
  return out;
}
const key = (p) => p.cols.map(c => c.join(',')).sort().join('|') + '#' + p.cells.slice().sort((a, b) => a - b).join(',');
function score(p) {
  let v = 0; const f = p.found;
  v += (f[0] + f[1] + f[2] + f[3]) * 30;
  v += freeCells(p) * 6 + emptyCols(p) * 14;
  for (const col of p.cols) {
    // ordered run at the bottom is good; low cards buried under higher ones are bad
    const rs = runStart(col); v += (col.length - rs) * 2;
    for (let q = 0; q < col.length; q++) { const r = RK(col[q]); const need = f[SU(col[q])] + 1; if (r - need < 3) v -= (col.length - 1 - q) * (4 - (r - need)) * 1.5; }
  }
  return v;
}
function heap() {
  const a = [];
  return {
    size: () => a.length,
    push(x) { a.push(x); let i = a.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (a[q].v >= a[i].v) break; [a[q], a[i]] = [a[i], a[q]]; i = q; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].v > a[m].v) m = l; if (r < a.length && a[r].v > a[m].v) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
  };
}
/** best-first search to a win. Returns { ok, path: [moves] (auto moves are implied), nodes } */
export function solve(p0, budget = 20000) {
  const root = clonePos(p0); settle(root);
  const won = (p) => p.found.every(n => n === 13);
  const open = heap(), seen = new Set([key(root)]); open.push({ p: root, v: score(root), par: null, mv: null, d: 0 }); let nodes = 0;
  const path = (n) => { const out = []; for (let x = n; x && x.mv; x = x.par) out.push(x.mv); return out.reverse(); };
  while (open.size() && nodes < budget) {
    const n = open.pop(); nodes++;
    if (won(n.p)) return { ok: true, path: path(n), nodes };
    for (const m of moves(n.p)) {
      const q = clonePos(n.p); apply(q, m); settle(q);
      const k = key(q); if (seen.has(k)) continue; seen.add(k);
      open.push({ p: q, v: score(q) - n.d * 0.5, par: n, mv: m, d: n.d + 1 });
    }
  }
  return { ok: false, path: [], nodes };
}

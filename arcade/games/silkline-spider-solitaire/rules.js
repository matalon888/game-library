// rules.js — spider solitaire rules as pure functions (used by the game, the bot and the deal picker). Our own code, MIT.
const SUIT_SETS = { 1: [0, 0, 0, 0, 0, 0, 0, 0], 2: [0, 0, 0, 0, 1, 1, 1, 1], 4: [0, 0, 1, 1, 2, 2, 3, 3] };
export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function makeDeal(seed, suits) {
  const set = SUIT_SETS[suits], su = new Int8Array(104), rk = new Int8Array(104);
  for (let id = 0; id < 104; id++) { su[id] = set[(id / 13) | 0]; rk[id] = id % 13 + 1; }
  const r = rngf(seed * 2654435761 + 131), deck = [...Array(104).keys()];
  for (let k = 0; k < 7; k++) r();
  for (let i = 103; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const c = []; let p = 0;
  for (let i = 0; i < 10; i++) { const n = i < 4 ? 6 : 5; c.push({ d: n - 1, c: deck.slice(p, p + n) }); p += n; }
  return { su, rk, cols: c, stock: deck.slice(p) };
}
// the movable run at the bottom of column: index of its first card
export function runStart(col, su, rk) {
  const c = col.c; if (!c.length) return -1; let k = c.length - 1;
  while (k > col.d && su[c[k - 1]] === su[c[k]] && rk[c[k - 1]] === rk[c[k]] + 1) k--;
  return k;
}
export function canDrop(cs, i, k, j, su, rk) {
  if (i === j) return false; const col = cs[i]; if (k < col.d || k >= col.c.length) return false;
  for (let q = k; q < col.c.length - 1; q++) if (su[col.c[q]] !== su[col.c[q + 1]] || rk[col.c[q]] !== rk[col.c[q + 1]] + 1) return false;
  const t = cs[j].c; return !t.length || rk[t[t.length - 1]] === rk[col.c[k]] + 1;
}
export const canDeal = (cs, st) => st.length > 0 && (cs.every(c => c.c.length) || cs.reduce((a, c) => a + c.c.length, 0) < 10);
// a completed King..Ace run of one suit at the bottom of a column → its index, else -1
export function fullRun(col, su, rk) {
  const c = col.c, n = c.length; if (n < 13) return -1; const s = su[c[n - 1]];
  for (let q = 0; q < 13; q++) { const id = c[n - 1 - q]; if (n - 1 - q < col.d || su[id] !== s || rk[id] !== q + 1) return -1; }
  return n - 13;
}
// greedy evaluation of one move (higher is better; ≤ 0 means pointless)
export function rate(cs, i, k, j, su, rk) {
  const col = cs[i], run = col.c.slice(k), c = run[0], t = cs[j].c, tgt = t.length ? t[t.length - 1] : -1;
  const below = k > 0 ? col.c[k - 1] : -1, belowUp = k > col.d;
  const natural = belowUp && su[below] === su[c] && rk[below] === rk[c] + 1;
  if (natural) return 0;                                         // never break a same-suit run
  let v = 0;
  if (tgt >= 0 && su[tgt] === su[c]) v += 60;
  if (k === col.d && col.d > 0) v += 45;                          // reveals a face-down card
  if (k === 0 && tgt >= 0) v += 30;                               // empties a column
  if (tgt < 0) { if (k === col.d && col.d > 0) v = 12 + col.d; else return 0; }
  if (belowUp && tgt >= 0 && rk[below] === rk[c] + 1 && su[tgt] !== su[c]) return 0;   // a sideways swap, gains nothing
  if (belowUp && tgt >= 0 && v === 0) {                          // exposes a card: worth it if that card can then take a same-suit run
    for (let q = 0; q < cs.length; q++) { if (q === i) continue; const rs = runStart(cs[q], su, rk); if (rs >= 0 && su[cs[q].c[rs]] === su[below] && rk[cs[q].c[rs]] === rk[below] - 1) { v += 8; break; } }
  }
  if (v > 0) v += run.length * 0.5 + col.d * 0.3;
  return v;
}
export function bestMoves(cs, su, rk) {
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const rs = runStart(cs[i], su, rk); if (rs < 0) continue;
    for (let k = rs; k < cs[i].c.length; k++) for (let j = 0; j < cs.length; j++) {
      if (!canDrop(cs, i, k, j, su, rk)) continue;
      const v = rate(cs, i, k, j, su, rk); if (v > 0) out.push({ i, k, j, v });
    }
  }
  return out.sort((a, b) => b.v - a.v);
}
export const hashOf = (cs) => cs.map(c => c.d + ':' + c.c.join(',')).join('|');
// ---------------------------------------------------------------- search (the bot and the deal picker)
// Best-first search over positions with a node budget. A position scores runs home, same-suit links, open columns and
// face-down cards left. Returns the move list to a win, or to the best position it found.
function evalPos(cs, done, su, rk, left) {
  let v = done * 1000;
  for (const col of cs) {
    const c = col.c; if (!c.length) { v += left ? 30 : 60; continue; }
    v -= col.d * 18;
    for (let q = Math.max(col.d, 1); q < c.length; q++) { const a = c[q - 1], b = c[q]; if (q - 1 >= col.d && rk[a] === rk[b] + 1) v += su[a] === su[b] ? 12 : 3; }
    // a column topped (deepest) by a king is a good foundation for a run
    if (col.d === 0 && rk[c[0]] === 13) v += 6;
  }
  return v;
}
function childMoves(cs, su, rk) {
  const out = [];
  for (let i = 0; i < cs.length; i++) {
    const rs = runStart(cs[i], su, rk); if (rs < 0) continue; const col = cs[i];
    for (let j = 0; j < cs.length; j++) {
      if (j === i) continue; const t = cs[j].c;
      if (!t.length) { if (rs > 0) out.push([i, rs, j]); if (rs < col.c.length - 1) out.push([i, col.c.length - 1, j]); continue; }
      const need = rk[t[t.length - 1]] - 1, k = col.c.length - 1 - (need - rk[col.c[col.c.length - 1]]);
      if (k < rs || k >= col.c.length || rk[col.c[k]] !== need) continue;
      if (k > col.d && su[col.c[k - 1]] === su[col.c[k]] && rk[col.c[k - 1]] === need + 1) continue;   // don't break a natural link
      out.push([i, k, j]);
    }
  }
  return out;
}
function heap() {   // max-heap on .v
  const a = [];
  return {
    size: () => a.length,
    push(x) { a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].v >= a[i].v) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].v > a[m].v) m = l; if (r < a.length && a[r].v > a[m].v) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
  };
}
export const posKey = (cs, st) => st + '#' + hashOf(cs);
export function search(cols, stock, done, su, rk, budget = 2500, avoid = null, deals = false) {
  const clone = (cs) => cs.map(c => ({ d: c.d, c: c.c.slice() }));
  const root = { cs: clone(cols), st: stock.length, done, par: null, mv: null, len: 0, v: 0 };
  const pathOf = (n) => { const p = []; for (let x = n; x && x.mv; x = x.par) p.push(x.mv); return p.reverse(); };
  const settle = (n, j) => { const col = n.cs[j], f = fullRun(col, su, rk); if (f >= 0) { col.c.splice(f); n.done++; } if (col.c.length && col.d >= col.c.length) col.d = col.c.length - 1; };
  const key = (n) => n.st + '#' + hashOf(n.cs);
  root.v = evalPos(root.cs, root.done, su, rk, root.st);
  const open = heap(), seen = new Set([key(root)]); let best = root, best2 = null, nodes = 0; open.push(root);
  while (open.size() && nodes < budget) {
    const n = open.pop(); nodes++;
    if (n.done === 8) return { win: true, path: pathOf(n), gain: 1e6, nodes };
    const kids = [];
    for (const [i, k, j] of childMoves(n.cs, su, rk)) {
      const m = { cs: n.cs.slice(), st: n.st, done: n.done, par: n, mv: [i, k, j], len: n.len + 1 };
      m.cs[i] = { d: n.cs[i].d, c: n.cs[i].c.slice(0, k) }; m.cs[j] = { d: n.cs[j].d, c: n.cs[j].c.concat(n.cs[i].c.slice(k)) };
      settle(m, i); settle(m, j); kids.push(m);
    }
    if (deals && n.st > 0 && canDeal(n.cs, { length: n.st })) {
      const m = { cs: clone(n.cs), st: n.st - 10, done: n.done, par: n, mv: ['deal'], len: n.len + 1 };
      const from = n.st;   // stock is dealt from its end: cards stock[from-10 .. from-1] go to columns 0..9
      for (let q = 0; q < 10; q++) m.cs[q].c.push(stock[from - 10 + q]);
      for (let q = 0; q < 10; q++) settle(m, q); kids.push(m);
    }
    for (const m of kids) {
      const kk = key(m); if (seen.has(kk) || (avoid && avoid.has(kk))) continue; seen.add(kk);
      m.v = evalPos(m.cs, m.done, su, rk, m.st) - m.len * 0.4 - (m.mv[0] === 'deal' ? 25 : 0);
      open.push(m); if (m.v > best.v) best = m; if (!best2 || m.v > best2.v) best2 = m;
    }
  }
  return { win: false, path: pathOf(best), gain: best.v - root.v, nodes };
}

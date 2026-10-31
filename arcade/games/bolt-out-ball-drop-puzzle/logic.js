// Bolt Out v2: the rules of a vessel as pure data + a solver (no rendering). deep.js plays levels with real physics;
// this file is the abstract model the levels are authored and checked against (qa/levels.mjs, qa/playall.cjs).
//
// A vessel = up to two side-by-side lanes of bolts (top to bottom) that pour into one shared "tail" lane of wide bolts,
// which pours into the jar. A pin holds a pile (one token). Pull a pin: its pile falls onto the next bolt still in place
// below it (own lane, then the tail), or into the jar when there is none.
//   C colour ball   G grey ball   B bomb   O goo   '-' nothing (the bolt still has to be pulled to let things through)
// Rules at a landing (X falls onto the pile at j):  bomb + colour = BOOM (lose) · bomb + grey/goo = bomb pops, goo gone ·
//   grey + colour = grey turns colour · into the jar: grey, goo or bomb = lose.
// Twin bolts (same ring colour) are pulled together by one tap: both piles fall at the same moment. A padlocked bolt can't be pulled until its key bolt is out.
export const C = 1, G = 2, B = 4, O = 8;
const TOK = { '-': 0, C, G, B, O };
const LANE_ID = 'ab';

export function compile(def) {
  const pins = [], ids = {};
  def.lanes.forEach((L, li) => L.forEach((tk, k) => { const id = LANE_ID[li] + k; ids[id] = pins.length; pins.push({ id, li, k, m: TOK[tk] }); }));
  (def.tail || []).forEach((tk, k) => { const id = 't' + k; ids[id] = pins.length; pins.push({ id, li: -1, k, m: TOK[tk] }); });
  const tl = (def.tail || []).length;
  for (const p of pins) {
    p.below = [];
    if (p.li >= 0) for (let k = p.k + 1; k < def.lanes[p.li].length; k++) p.below.push(ids[LANE_ID[p.li] + k]);
    for (let k = p.li >= 0 ? 0 : p.k + 1; k < tl; k++) p.below.push(ids['t' + k]);
    p.twin = -1; p.lock = -1;
  }
  for (const [a, b] of def.twins || []) { pins[ids[a]].twin = ids[b]; pins[ids[b]].twin = ids[a]; }
  for (const [a, key] of def.locks || []) pins[ids[a]].lock = ids[key];
  return { pins, ids };
}

// one tap: pulls the pin (and its twin at the same moment), then every freed pile lands on the next bolt still in place below it.
// Piles that land on the same bolt in the same moment are checked together (bomb + colour in one landing = BOOM).
function land(st, j, x) {
  let U = x | st[j];
  if ((U & B) && (U & C)) return false;
  if ((U & B) && (U & (G | O))) U &= ~(B | O);
  if ((U & G) && (U & C)) U = (U & ~G) | C;
  st[j] = U; return true;
}
export function start(M) { return { st: M.pins.map(p => p.m), on: M.pins.map(() => true) }; }
const free = (M, s, p) => M.pins[p].lock < 0 || !s.on[M.pins[p].lock];
export const legal = (M, s, p) => s.on[p] && free(M, s, p) && (M.pins[p].twin < 0 || (s.on[M.pins[p].twin] && free(M, s, M.pins[p].twin)));
// tap pin p: returns the next state, or { fail: reason }
export function move(M, s, p) {
  const st = s.st.slice(), on = s.on.slice(), q = M.pins[p].twin, group = q >= 0 ? [p, q] : [p], X = group.map(i => st[i]);
  for (const i of group) { on[i] = false; st[i] = 0; }
  const into = new Map();
  group.forEach((i, g) => {
    const j = M.pins[i].below.find(t => on[t]);
    if (j === undefined) { if (X[g] & (B | G | O)) into.set(-1, true); return; }
    if (X[g]) into.set(j, (into.get(j) || 0) | X[g]);
  });
  if (into.has(-1)) return { fail: 'jar' };
  for (const [j, x] of into) if (!land(st, j, x)) return { fail: 'boom' };
  return { st, on };
}
export const won = (M, s) => s.st.every((m, i) => !s.on[i] || !(m & (C | G)));
const key = (s) => s.on.map(x => x ? 1 : 0).join('') + s.st.join('');

// best[state] = fewest taps to win from here (Infinity: dead end). Returns the table helpers.
export function solver(M) {
  const memo = new Map();
  const f = (s) => {
    if (won(M, s)) return 0;
    const k = key(s); if (memo.has(k)) return memo.get(k);
    memo.set(k, Infinity); let best = Infinity;
    for (let p = 0; p < M.pins.length; p++) { if (!legal(M, s, p)) continue; const n = move(M, s, p); if (n.fail) continue; const d = f(n); if (d + 1 < best) best = d + 1; }
    memo.set(k, best); return best;
  };
  return { f, memo };
}
// the shortest winning tap order (pin indexes)
export function plan(M, from) {
  const S = solver(M); let s = from || start(M); const out = [];
  while (!won(M, s)) {
    const d = S.f(s); if (!isFinite(d)) return null;
    let nx = null, pp = -1; for (let p = 0; p < M.pins.length && !nx; p++) { if (!legal(M, s, p)) continue; const n = move(M, s, p); if (!n.fail && S.f(n) === d - 1) { nx = n; pp = p; } }
    out.push(pp); s = nx;
  }
  return out;
}
// design numbers: par taps, how many first taps are wrong (lose now, or dead end), how many states the player can wander into
export function analyze(M) {
  const S = solver(M), s0 = start(M), par = S.f(s0); let first = 0, bad = 0, instant = 0;
  for (let p = 0; p < M.pins.length; p++) { if (!legal(M, s0, p)) continue; first++; const n = move(M, s0, p); if (n.fail) { bad++; instant++; } else if (!isFinite(S.f(n))) bad++; }
  // slack: how many alternative first taps also keep par (a level with one narrow path has 1)
  let ok = 0; for (let p = 0; p < M.pins.length; p++) { if (!legal(M, s0, p)) continue; const n = move(M, s0, p); if (!n.fail && S.f(n) === par - 1) ok++; }
  // dead-end share over every reachable state (how punishing wandering is)
  let reach = 0, dead = 0; const seen = new Set(), q = [s0];
  while (q.length) { const s = q.pop(), k = key(s); if (seen.has(k)) continue; seen.add(k); reach++; if (!isFinite(S.f(s))) dead++; for (let p = 0; p < M.pins.length; p++) { if (!legal(M, s, p)) continue; const n = move(M, s, p); if (!n.fail) q.push(n); } }
  return { par, first, bad, instant, ok, reach, dead, pins: M.pins.length };
}

// bonus + daily vessels after the authored ones: random layouts that pass the same checks (solvable, a real trap, narrow)
export function generate(r) {
  const pick = a => a[Math.floor(r() * a.length)], T = ['C', 'C', 'G', 'G', 'B', 'O', '-'];
  for (let t = 0; t < 6000; t++) {
    const two = r() < 0.85, lanes = [];
    for (let i = 0; i < (two ? 2 : 1); i++) lanes.push(Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(T)));
    const tail = two ? Array.from({ length: 1 + Math.floor(r() * 2) }, () => pick(T)) : [], d = { lanes, tail };
    const ids = [...lanes.flatMap((L, li) => L.map((_, k) => LANE_ID[li] + k)), ...tail.map((_, k) => 't' + k)];
    if (two && r() < 0.4) d.twins = [['a' + Math.floor(r() * lanes[0].length), 'b' + Math.floor(r() * lanes[1].length)]];
    if (r() < 0.4) { const a = pick(ids), b = pick(ids); if (a !== b && !(d.twins || []).flat().includes(a)) d.locks = [[a, b]]; }
    const M = compile(d); if (M.pins.length > 8 || M.pins.length < 4 || !M.pins.some(p => p.m & C)) continue;
    const A = analyze(M); if (!isFinite(A.par) || A.par < 4 || A.bad < 2 || A.ok > 2) continue;
    return d;
  }
  return { lanes: [['G'], ['C', 'O']], tail: ['B'] };
}

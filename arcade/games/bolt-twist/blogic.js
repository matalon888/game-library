// Bolt Twist deep v2 — pure rules + level builder (no three.js, no DOM: node-testable by qa/verify.mjs).
// A toy = faces carrying stacked plates; plates carry bolts; a bolt can be tapped when no live plate above covers it, its
// padlock key is gone (key/lock pairs) and enough other bolts have left (ice). Bolts fly to the open box of their colour or
// park in the tray; a plate with no bolts left falls. Same rules as v1 plus locks and ice.
export const PI = Math.PI;
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
export const FACE_DEF = (W, H, D) => ({
  front: { c: [0, 0, D / 2], n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], fw: W, fh: H },
  right: { c: [W / 2, 0, 0], n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], fw: D, fh: H },
  back: { c: [0, 0, -D / 2], n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], fw: W, fh: H },
  left: { c: [-W / 2, 0, 0], n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fw: D, fh: H },
  top: { c: [0, H / 2, 0], n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], fw: W, fh: D },
});
export function contains(p, x, y, m = 0) {
  const dx = x - p.cx, dy = y - p.cy, c = Math.cos(-p.rot), s = Math.sin(-p.rot), lx = dx * c - dy * s, ly = dx * s + dy * c;
  if (p.type === 'circle') return Math.hypot(lx, ly) <= p.r + m;
  if (p.type === 'capsule') { const r = p.h / 2, ex = Math.max(0, Math.abs(lx) - (p.w / 2 - r)); return Math.hypot(ex, ly) <= r + m; }
  return Math.abs(lx) <= p.w / 2 + m && Math.abs(ly) <= p.h / 2 + m;
}
export function corners(p) {
  if (p.type === 'circle') return [[p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy + p.r], [p.cx - p.r, p.cy + p.r], [p.cx + p.r, p.cy - p.r]];
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const lx = a * p.w / 2, ly = b * p.h / 2; return [p.cx + lx * c - ly * s, p.cy + lx * s + ly * c]; });
}
export const toFace = (p, lx, ly) => { const c = Math.cos(p.rot), s = Math.sin(p.rot); return [p.cx + lx * c - ly * s, p.cy + lx * s + ly * c]; };
export function overlaps(a, b) {
  const R = a.type === 'circle' ? a.r : Math.max(a.w, a.h) / 2;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const x = a.cx - R + (2 * R * i) / 8, y = a.cy - R + (2 * R * j) / 8;
    if (contains(a, x, y, -0.04) && contains(b, x, y, -0.04)) return true;
  }
  return false;
}
// ---------------------------------------------------------------- plate builders (levels.js templates use these)
const rad = (d) => d * PI / 180;
export const cap = (cx, cy, L, deg, bolts) => { const p = { type: 'capsule', w: L, h: 0.5, cx, cy, rot: rad(deg) }; p.screws = bolts.map(([x, y]) => [x, y]); return p; };
export const rect = (cx, cy, w, h, deg, bolts, r = 0.14) => ({ type: 'rect', w, h, r, cx, cy, rot: rad(deg), screws: bolts.map(([x, y]) => [x, y]) });
export const disc = (cx, cy, r, bolts) => ({ type: 'circle', r, cx, cy, rot: 0, screws: bolts.map(([x, y]) => [x, y]) });

// ---------------------------------------------------------------- rules
export function accessible(P, S, alive, gone, s, removed) {
  if (gone[s.id]) return false;
  if (s.lockedBy != null && !gone[s.lockedBy]) return false;
  if (s.ice && removed < s.ice) return false;
  const p = P[s.plate];
  return !p.above.some((qid) => alive[qid] && contains(P[qid], s.fx, s.fy, 0.12));
}
export function settlePlates(P, S, alive, gone) {
  let ch = true; while (ch) { ch = false; for (const p of P) if (alive[p.id] && S.every((s) => s.plate !== p.id || gone[s.id]) && p.above.every((q) => !alive[q])) { alive[p.id] = false; ch = true; } }
}
export function removalOrder(P, S, R) {
  const alive = P.map(() => true), gone = S.map(() => false), order = [];
  while (order.length < S.length) {
    const acc = S.filter((s) => accessible(P, S, alive, gone, s, order.length)); if (!acc.length) break;
    const s = acc[Math.floor(R() * acc.length)]; gone[s.id] = true; order.push(s.id); settlePlates(P, S, alive, gone);
  }
  return order;
}
export function queueFrom(colors) { const need = {}, q = []; for (const c of colors) { need[c] = (need[c] || 0) + 1; if (need[c] % 3 === 1) q.push(c); } return q; }
/** greedy play: tap a bolt that matches an open box, else park the bolt whose colour is needed soonest. R(): random tie-breaks.
 *  returns parks (>=0) or -1 when the tray fills / nothing is tappable. */
export function play(P, S, q, K_, T_, R = null) {
  const alive = P.map(() => true), gone = S.map(() => false); let qi_ = 0, parks = 0, removed = 0; const bx = [], buf = [];
  const refill = () => { while (bx.length < K_ && qi_ < q.length) bx.push({ c: q[qi_++], n: 0 }); };
  const settleBoxes = () => { let ch = true; while (ch) { ch = false; for (let i = bx.length - 1; i >= 0; i--) if (bx[i].n >= 3) { bx.splice(i, 1); ch = true; } refill();
    for (const b of bx) for (let j = buf.length - 1; j >= 0 && b.n < 3; j--) if (buf[j] === b.c) { buf.splice(j, 1); b.n++; ch = true; } } };
  refill();
  const pickOf = (l) => R ? l[Math.floor(R() * l.length)] : l[0];
  for (let step = 0; step < S.length; step++) {
    const acc = S.filter((s) => accessible(P, S, alive, gone, s, removed)); if (!acc.length) return -1;
    const m = acc.filter((s) => bx.some((b) => b.c === s.color && b.n < 3)); let pick = m.length ? pickOf(m) : null, toBox = !!pick;
    if (!pick) {
      if (buf.length >= T_) return -1;
      const rank = (c) => { const i = q.indexOf(c, qi_); return i < 0 ? 1e9 : i; };
      let best = 1e10, c = []; for (const s of acc) { const r = rank(s.color); if (r < best) { best = r; c = [s]; } else if (r === best) c.push(s); }
      pick = pickOf(c);
    }
    gone[pick.id] = true; removed++; settlePlates(P, S, alive, gone);
    if (toBox) bx.find((b) => b.c === pick.color && b.n < 3).n++; else { buf.push(pick.color); parks++; }
    settleBoxes(); if (buf.length >= T_ && !bx.some((b) => buf.includes(b.c))) return -1;
  }
  return parks;
}
/** a casual player: taps a box match pm of the time, else any free bolt (v1's simulate). returns win% over trials */
export function casual(P, S, q, K_, T_, trials = 200, pm = 0.8, seed = 5) {
  const R = rng(seed); let won = 0;
  for (let t = 0; t < trials; t++) {
    const alive = P.map(() => true), gone = S.map(() => false), bx = [], buf = []; let qi_ = 0, ok = true, removed = 0;
    const refill = () => { while (bx.length < K_ && qi_ < q.length) bx.push({ c: q[qi_++], n: 0 }); };
    const settleB = () => { let ch = true; while (ch) { ch = false; for (let i = bx.length - 1; i >= 0; i--) if (bx[i].n >= 3) { bx.splice(i, 1); ch = true; } refill(); for (const b of bx) for (let j = buf.length - 1; j >= 0 && b.n < 3; j--) if (buf[j] === b.c) { buf.splice(j, 1); b.n++; ch = true; } } };
    refill();
    for (let step = 0; step < S.length; step++) {
      const acc = S.filter((s) => accessible(P, S, alive, gone, s, removed)); if (!acc.length) { ok = false; break; }
      const m = acc.filter((s) => bx.some((b) => b.c === s.color && b.n < 3));
      const pick = R() < pm && m.length ? m[Math.floor(R() * m.length)] : acc[Math.floor(R() * acc.length)];
      gone[pick.id] = true; removed++; settlePlates(P, S, alive, gone);
      const b = bx.find((b) => b.c === pick.color && b.n < 3); if (b) b.n++; else { if (buf.length >= T_) { ok = false; break; } buf.push(pick.color); }
      settleB(); if (buf.length >= T_ && !bx.some((b) => buf.includes(b.c))) { ok = false; break; }
    }
    if (ok) won++;
  }
  return Math.round(100 * won / trials);
}
export const solve = (P, S, q, K_, T_) => play(P, S, q, K_, T_) >= 0;
/** par = fewest parks over many randomised greedy plays (what a careful player can reach) */
export function parOf(P, S, q, K_, T_, tries = 60) {
  let best = -1; const R = rng(77); for (let i = 0; i < tries; i++) { const v = play(P, S, q, K_, T_, R); if (v >= 0 && (best < 0 || v < best)) best = v; } return best;
}

// ---------------------------------------------------------------- level builder
export const CKEYS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'cyan'];
export const SIZE = { crate: [2.6, 2.6, 2.6], house: [2.6, 2.4, 2.6], robot: [2.6, 2.4, 2.6], gift: [2.6, 2.4, 2.6], rocket: [2.6, 2.4, 2.6], castle: [2.6, 2.4, 2.6] };
/** spec: {theme, faces:{front:[plates],...}, nc, K, T, mix, win, keys, ice:[n..], seed}. plates already carry their bolts. */
export function buildLevel(spec, fk = 1) {
  const R = rng(spec.seed * 7919 + 101), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const [W, H, D] = SIZE[spec.theme] || SIZE.crate, F = FACE_DEF(W, H, D), P = [];
  for (const fn of Object.keys(spec.faces)) {
    const list = [];
    for (const src of spec.faces[fn]) {
      const p = { ...src, screws: src.screws.map((s) => [...s]), face: fn, lv: 0 };
      for (const q of list) if (overlaps(p, q) || overlaps(q, p)) p.lv = Math.max(p.lv, q.lv + 1);
      list.push(p); P.push(p);
    }
  }
  let N = P.reduce((a, p) => a + p.screws.length, 0);
  while (N % 3) { const p = [...P].reverse().find((q) => q.screws.length >= 3) || [...P].reverse().find((q) => q.screws.length >= 2); if (!p) break; p.screws.pop(); N--; }
  P.forEach((p, i) => p.id = i);
  P.forEach((p) => { p.above = P.filter((q) => q.face === p.face && q.lv > p.lv && (overlaps(p, q) || overlaps(q, p))).map((q) => q.id); });
  const S = []; P.forEach((p) => p.screws.forEach(([x, y]) => S.push({ plate: p.id, face: p.face, fx: x, fy: y, kind: 'n' })));
  S.forEach((s, i) => s.id = i);
  if (spec.bake) {   // baked colours / padlocks / ice from qa/bake.mjs (same result for everyone, instant on a phone)
    S.forEach((s, i) => { s.color = spec.bake.c[i]; [s.kind, s.lockedBy, s.ice] = spec.bake.k[i]; });
    return { ...spec, W, H, D, F, P, S, queue: spec.bake.q, K: spec.K, T: spec.T, par: spec.bake.par, casualPct: spec.bake.casual };
  }
  const nc = spec.nc, K_ = spec.K, T_ = spec.T, win = spec.win ?? Math.min(4, 2 + Math.floor((spec.n || 1) / 4)), mix = spec.mix ?? 0.5;
  const pal = [...CKEYS].sort(() => R() - 0.5).slice(0, nc);
  const reset = () => { for (const s of S) { s.kind = 'n'; s.lockedBy = null; s.ice = 0; } };
  let best = null, bestGap = 1e9, p = Math.min(0.75, mix * fk);
  for (let attempt = 0; attempt < 140; attempt++) {
    reset();
    // padlocks: a locked bolt waits for its gold key bolt (never on the same plate, never a bolt that is itself locked)
    for (let k = 0; k < (spec.keys || 0); k++) {
      const free = S.filter((s) => s.kind === 'n'); if (free.length < 2) break;
      const lock = free[ri(0, free.length - 1)], keys = free.filter((s) => s.id !== lock.id && s.plate !== lock.plate);
      if (!keys.length) continue; const key = keys[ri(0, keys.length - 1)];
      key.kind = 'key'; lock.kind = 'lock'; lock.lockedBy = key.id;
    }
    for (const n of spec.ice || []) { const free = S.filter((s) => s.kind === 'n'); if (!free.length) break; const s = free[ri(0, free.length - 1)]; s.kind = 'ice'; s.ice = n; }
    const order = removalOrder(P, S, R); if (order.length < S.length) continue;
    const tri = []; let prev = null;
    for (let t = 0; t < order.length / 3; t++) { let c; do c = pal[ri(0, nc - 1)]; while (c === prev && nc > 1); prev = c; tri.push(c); }
    order.forEach((sid, i) => S[sid].color = tri[Math.floor(i / 3)]);
    if (win) for (let i = 0; i < order.length; i++) if (R() < p) { const j = Math.min(order.length - 1, i + ri(3, 3 * win)); const a = S[order[i]], b = S[order[j]]; [a.color, b.color] = [b.color, a.color]; }
    const cnt = {}; S.forEach((s) => cnt[s.color] = (cnt[s.color] || 0) + 1);
    if (Object.values(cnt).some((v) => v % 3)) continue;
    const q = queueFrom(order.map((sid) => S[sid].color));
    if (parOf(P, S, q, K_, T_, 12) < 0) continue;
    // authored difficulty: a casual player (taps a box match 80% of the time) should win about spec.target % of the time
    const c = spec.target == null ? 0 : casual(P, S, q, K_, T_, 80);
    const gap = spec.target == null ? 0 : Math.abs(c - spec.target);
    if (gap < bestGap) { bestGap = gap; best = { colors: S.map((s) => s.color), kinds: S.map((s) => [s.kind, s.lockedBy, s.ice]), q }; }
    if (gap <= 7) break;
    p = Math.max(0.05, Math.min(0.9, p + (c > spec.target ? 0.04 : -0.04)));
  }
  if (!best) return null;
  S.forEach((s, i) => { s.color = best.colors[i]; [s.kind, s.lockedBy, s.ice] = best.kinds[i]; });
  const q = best.q;
  return { ...spec, W, H, D, F, P, S, queue: q, K: K_, T: T_, par: parOf(P, S, q, K_, T_, 80), casualPct: casual(P, S, q, K_, T_, 200) };
  return null;
}

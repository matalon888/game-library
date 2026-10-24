// Twistwood rules engine: plates, screws, holes and colour boxes. Pure JS (no three.js), shared by the game, the bot,
// the hint and the level generator's solver, so every generated level is proven solvable with the same rules the player has.
//
// Board space: x right, y up, one grid step = 1. Grid holes at x = -2.5..2.5 (6 columns), y = -3..3 (7 rows).
// A plate is the rounded hull of its key points (radius R). Screws sit on key points. A plate with 2+ screws is fixed,
// with 1 screw it hangs from that screw like a pendulum, with 0 it falls. A screw is blocked while a higher plate covers
// its head; a hole is free while nothing covers it.

export const COLS = 6, ROWS = 7, R = 0.44, HEAD = 0.3;
export const gx = c => c - (COLS - 1) / 2, gy = r => r - (ROWS - 1) / 2;
export const SPARE_Y = 4.15;
export const spareX = (i, n) => (i - (n - 1) / 2) * 0.98;

export function rng(seed) { let s = (Math.floor(Math.abs(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------------------------------------------------------------- geometry
function hull(pts) {   // convex hull (monotone chain) of [[x,y]], returns indices
  const idx = pts.map((p, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
  if (idx.length < 3) return idx;
  const cr = (o, a, b) => (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
  const lo = [], up = [];
  for (const i of idx) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 1e-9) lo.pop(); lo.push(i); }
  for (const i of idx.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], i) <= 1e-9) up.pop(); up.push(i); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** distance from (x,y) to the convex polygon P ([[x,y]] in hull order); 0 inside */
export function polyDist(P, x, y) {
  if (P.length === 1) return Math.hypot(x - P[0][0], y - P[0][1]);
  let inside = P.length >= 3, d = 1e9;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    if (inside && (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false;
    d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1]));
  }
  return inside ? 0 : d;
}
function segSeg(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return 0;
  return Math.min(segDist(a[0], a[1], c[0], c[1], d[0], d[1]), segDist(b[0], b[1], c[0], c[1], d[0], d[1]),
    segDist(c[0], c[1], a[0], a[1], b[0], b[1]), segDist(d[0], d[1], a[0], a[1], b[0], b[1]));
}
export function polyPolyDist(A, B) {
  for (const p of A) if (polyDist(B, p[0], p[1]) === 0 && B.length >= 3) return 0;
  for (const p of B) if (polyDist(A, p[0], p[1]) === 0 && A.length >= 3) return 0;
  let d = 1e9;
  const ea = A.length === 1 ? [[A[0], A[0]]] : A.map((p, i) => [p, A[(i + 1) % A.length]]);
  const eb = B.length === 1 ? [[B[0], B[0]]] : B.map((p, i) => [p, B[(i + 1) % B.length]]);
  for (const [a, b] of ea) for (const [c, e] of eb) d = Math.min(d, segSeg(a, b, c, e));
  return d;
}
/** centroid of the plate (area centroid of its hull, or midpoint of a bar) */
export function centroid(P) {
  if (P.length < 3) { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; }
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  return [cx / (3 * a), cy / (3 * a)];
}

// ---------------------------------------------------------------- state
/**
 * makeState(level) → mutable game state. level = { plates:[{pts,screws,depth,color}], screws:[{color}], boxes:[color], spare }
 * Screw i sits on plate.pts[...] given by plate.screws (indices into level.screws are assigned in plate order).
 */
export function makeState(L) {
  const S = { plates: [], screws: [], holes: [], boxes: [], next: 2, slots: [], spare: L.spare, moves: 0 };
  let si = 0;
  L.plates.forEach((p, i) => {
    const order = hull(p.pts), poly = order.map(k => p.pts[k]);
    const pl = { i, pts: p.pts, poly, depth: p.depth, color: p.color, com: centroid(poly), alive: true, pin: null, ang: 0, rest: 0, screws: new Set(), w: 0, falling: false };
    S.plates.push(pl);
    for (const k of p.screws) {
      const [x, y] = p.pts[k], h = { i: S.holes.length, x, y, kind: 'grid', screw: si };
      S.holes.push(h);
      S.screws.push({ i: si, color: L.screws[si].color, plate: i, hole: h.i, box: -1, x, y });
      pl.screws.add(si); si++;
    }
  });
  for (let k = 0; k < L.spare; k++) S.holes.push({ i: S.holes.length, x: spareX(k, L.spare), y: SPARE_Y, kind: 'spare', screw: null });
  S.boxes = L.boxes.map((c, i) => ({ i, color: c, n: 0, done: false }));
  S.slots = [0, 1].map(i => i < S.boxes.length ? i : -1);
  return S;
}
/** world-space points of a plate in its current pose */
export function platePoly(pl) {
  if (!pl.pin || !pl.ang) return pl.poly;
  const [px, py] = pl.pin, c = Math.cos(pl.ang), s = Math.sin(pl.ang);
  return pl.poly.map(([x, y]) => [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c]);
}
export function covers(pl, x, y, margin) { return pl.alive && !pl.falling && polyDist(platePoly(pl), x, y) < R + margin; }
export function screwDepth(S, s) { return s.plate >= 0 ? S.plates[s.plate].depth : -1; }
export function blocked(S, s) {
  if (s.box >= 0 || s.hole < 0) return true;
  const d = screwDepth(S, s), h = S.holes[s.hole];
  for (const pl of S.plates) if (pl.depth > d && pl.i !== s.plate && covers(pl, h.x, h.y, HEAD * 0.55)) return true;
  return false;
}
export function holeFree(S, h) {
  if (h.screw !== null || h.locked || h.kind === 'grid') return false;
  for (const pl of S.plates) if (covers(pl, h.x, h.y, 0.12)) return false;
  return true;
}
export const activeBoxes = S => S.slots.filter(i => i >= 0).map(i => S.boxes[i]).filter(b => !b.done);
export function boxFor(S, color) { return activeBoxes(S).find(b => b.color === color && b.n < 3) || null; }

/** take screw s out of its hole: returns { fell: plate|null, swing: plate|null } */
export function lift(S, s) {
  const h = S.holes[s.hole]; h.screw = null; s.hole = -1;
  let fell = null, swing = null;
  if (s.plate >= 0) {
    const pl = S.plates[s.plate]; pl.screws.delete(s.i); s.plate = -1;
    if (pl.screws.size === 1) {
      const o = S.screws[[...pl.screws][0]]; pl.pin = [o.x, o.y];
      const vx = pl.com[0] - o.x, vy = pl.com[1] - o.y;
      pl.rest = -Math.PI / 2 - Math.atan2(vy, vx); swing = pl;
    } else if (pl.screws.size === 0) { pl.alive = false; fell = pl; }
  }
  return { fell, swing };
}
export function putHole(S, s, h) { h.screw = s.i; s.hole = h.i; s.x = h.x; s.y = h.y; }
export function putBox(S, s, b) { b.n++; s.box = b.i; if (b.n >= 3) b.done = true; }
/** a full box leaves its slot and the next one in the queue takes it: returns [{slot, box}] of arrivals */
export function advanceBoxes(S) {
  const out = [];
  S.slots = S.slots.map((i, k) => {
    if (i < 0 || !S.boxes[i].done) return i;
    if (S.next < S.boxes.length) { const b = S.next++; out.push({ slot: k, box: S.boxes[b] }); return b; }
    return -1;
  });
  return out;
}
export const fullBoxInSlot = S => S.slots.some(i => i >= 0 && S.boxes[i].done);
export const platesLeft = S => S.plates.filter(p => p.alive).length;
export const looseScrews = S => S.screws.filter(s => s.plate < 0 && s.box < 0 && s.hole >= 0);

/** every legal move right now: [{ s, to: {box}|{hole} }] */
export function moves(S) {
  const out = [], free = S.holes.filter(h => holeFree(S, h));
  for (const s of S.screws) {
    if (s.box >= 0 || s.hole < 0 || blocked(S, s)) continue;
    const b = boxFor(S, s.color);
    if (b) out.push({ s, box: b });
    if (s.plate >= 0) for (const h of free) out.push({ s, hole: h });
  }
  return out;
}

// ---------------------------------------------------------------- policy (bot, hint, solver)
/** the move a careful player would make. Returns a move or null */
export function bestMove(S) {
  const ms = moves(S); if (!ms.length) return null;
  const queuePos = c => { for (let k = S.next; k < S.boxes.length; k++) if (S.boxes[k].color === c) return k - S.next + 1; return 99; };
  const freeN = S.holes.filter(h => holeFree(S, h)).length;
  let best = null, bs = -1e9;
  for (const m of ms) {
    const s = m.s, pl = s.plate >= 0 ? S.plates[s.plate] : null;
    let v = 0;
    if (m.box) v = 1000 + (pl ? 50 : 0) + (pl && pl.screws.size === 1 ? 40 : 0) + (m.box.n === 2 ? 20 : 0);
    else {
      if (!pl) continue;
      v = 100 - queuePos(s.color) * 12 + (pl.screws.size === 1 ? 30 : 0) - (freeN <= 1 ? 200 : 0);
      if (m.hole.kind === 'grid') v += 6;   // keep the spare strip open when a board hole will do
      // how many screws does this plate hide? freeing those is progress
      let hidden = 0; for (const o of S.screws) if (o.plate >= 0 && o.plate !== s.plate && o.hole >= 0 && S.plates[o.plate].depth < pl.depth) { const h = S.holes[o.hole]; if (covers(pl, h.x, h.y, HEAD * 0.55)) hidden++; }
      v += pl.screws.size === 1 ? hidden * 8 : hidden * 2;
    }
    v += (m.s.i * 7919 % 13) * 0.01;   // stable tie-break
    if (v > bs) { bs = v; best = m; }
  }
  return best;
}
/** loose screws that can drop straight into an active box (auto-collect) */
export function autoCollect(S) {
  const out = [];
  for (const s of looseScrews(S)) { if (blocked(S, s)) continue; const b = boxFor(S, s.color); if (b && b.n + out.filter(o => o.b === b).length < 3) out.push({ s, b }); }
  return out;
}
/** apply a move instantly (solver): pendulums settle at once */
export function applyInstant(S, m) {
  const { swing } = lift(S, m.s);
  if (swing) swing.ang = swing.rest;
  if (m.box) putBox(S, m.s, m.box); else putHole(S, m.s, m.hole);
  S.moves++;
  for (let guard = 0; guard < 50; guard++) {
    if (fullBoxInSlot(S)) { advanceBoxes(S); continue; }
    const a = autoCollect(S); if (!a.length) break;
    for (const { s, b } of a) { const h = S.holes[s.hole]; h.screw = null; s.hole = -1; putBox(S, s, b); }
  }
}
export function solve(L, maxMoves = 200) {
  const S = makeState(L);
  for (let k = 0; k < maxMoves; k++) {
    if (!platesLeft(S)) return { ok: true, moves: S.moves };
    const m = bestMove(S); if (!m) return { ok: false, moves: S.moves, plates: platesLeft(S) };
    applyInstant(S, m);
  }
  return { ok: false, moves: S.moves };
}

// ---------------------------------------------------------------- level generator
const BARS = [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 1], [2, 2], [1, -1], [2, -2], [2, 1], [1, 2], [3, 1], [1, 3]];
function shapeAt(r) {
  const t = r();
  if (t < 0.42) { const [dx, dy] = BARS[Math.floor(r() * BARS.length)]; const pts = [[0, 0], [dx, dy]]; return { pts, screws: [0, 1], kind: 'bar' }; }
  if (t < 0.75) {
    const w = 1 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 3), pts = [[0, 0], [w, 0], [w, h], [0, h]];
    const pat = r(), screws = pat < 0.3 ? [0, 2] : pat < 0.55 ? [1, 3] : pat < 0.8 ? [0, 1, 2, 3] : [0, 1, 2];
    return { pts, screws, kind: 'rect' };
  }
  const a = 1 + Math.floor(r() * 2), b = 1 + Math.floor(r() * 2), sx = r() < 0.5 ? 1 : -1, sy = r() < 0.5 ? 1 : -1;
  return { pts: [[0, 0], [a * sx, 0], [0, b * sy]], screws: r() < 0.6 ? [0, 1, 2] : [1, 2], kind: 'tri' };
}
/** difficulty for level n (fk = flow multiplier, harder when > 1). Hard levels (~1 in 6) are short and flagged. */
export function params(n, fk = 1) {
  const hard = n > 5 && n % 6 === 0;
  const P = n === 1 ? { plates: 2, colours: 2, window: 0 } : n === 2 ? { plates: 3, colours: 2, window: 0 } : n === 3 ? { plates: 4, colours: 3, window: 1 }
    : n === 4 ? { plates: 5, colours: 3, window: 2 } : n === 5 ? { plates: 6, colours: 4, window: 2 }
    : { plates: Math.min(12, Math.round((6 + (n - 5) * 0.3) * fk)), colours: Math.min(8, 4 + Math.floor((n - 5) / 6)), window: Math.round((3 + n / 4) * fk) };
  if (hard) { P.plates = Math.min(14, P.plates + 3); P.colours = Math.min(9, P.colours + 2); P.window = 99; }
  P.spare = hard ? 4 : 5; P.hard = hard; P.n = n;
  return P;
}
const L1 = { plates: [
  { pts: [[-1.5, -2], [1.5, -2], [1.5, 1], [-1.5, 1]], screws: [0, 1, 2, 3], depth: 1, color: 1, kind: 'rect' },
  { pts: [[-2.5, 0], [2.5, 0]], screws: [0, 1], depth: 2, color: 0, kind: 'bar' }] };
export function genLevel(P, seed) {
  if (P.n === 1) {
    const L = { plates: L1.plates, screws: [], boxes: [], spare: P.spare, hard: false };
    colourise(L, P, rng(seed), 0); L.par = 6; L.window = 0; L.seed = seed; return L;
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const L = design(P, seed * 31 + attempt * 977 + 11);
    if (!L) continue;
    for (let w = P.window; w >= 0; w--) {
      colourise(L, P, rng(seed + attempt * 7 + w * 131), w);
      const res = solve(L);
      if (res.ok) { L.par = res.moves; L.window = w; L.seed = seed; L.attempt = attempt; return L; }
    }
  }
  // fallback: the tiniest level (never happens in practice; keeps the game playable)
  return genLevel({ ...P, plates: 2, colours: 2, window: 0 }, seed + 1);
}
function design(P, seed) {
  const r = rng(seed), plates = [], used = new Set();
  const want = P.plates;
  const bury = P.bury ?? 1;   // 0 = plates side by side … 1 = plates stacked to hide screws
  for (let round = 0; round < want * 3 && plates.length < want; round++) {
    let best = null, bv = -1e9;
    for (let tries = 0; tries < 60; tries++) {
      const sh = shapeAt(r), ox = Math.floor(r() * COLS), oy = Math.floor(r() * ROWS);
      const g = sh.pts.map(([a, b]) => [ox + a, oy + b]);
      if (g.some(([c, w]) => c < 0 || c >= COLS || w < 0 || w >= ROWS)) continue;
      const pts = g.map(([c, w]) => [gx(c), gy(w)]);
      if (sh.screws.some(k => used.has(g[k] + ''))) continue;
      const poly = hull(pts).map(k => pts[k]);
      // screws of a new (higher) plate never sit on a lower plate (no screw through two plates)
      if (sh.screws.some(k => plates.some(p => polyDist(p.poly, pts[k][0], pts[k][1]) < R + HEAD * 0.7))) continue;
      let depth = 1, overl = 0;
      for (const p of plates) if (polyPolyDist(p.poly, poly) < 2 * R - 0.02) { depth = Math.max(depth, p.depth + 1); overl++; }
      if (depth > 6) continue;
      let buried = 0; for (const p of plates) for (const k of p.screws) if (polyDist(poly, p.pts[k][0], p.pts[k][1]) < R + HEAD * 0.55) buried++;
      if (buried > 5) continue;
      const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      const v = (buried * 2 + Math.min(overl, 3)) * bury + r() * 3 - (sh.screws.length > 3 ? 1 : 0) - Math.hypot(cx, cy * 0.8) * (P.center || 0.25)
        + (P.n <= 4 ? pts.length * 0.4 : 0);
      if (v > bv) { bv = v; best = { pts, poly, screws: sh.screws.slice(), depth, kind: sh.kind, color: Math.floor(r() * 7), g }; }
    }
    if (!best) continue;
    plates.push(best);
    for (const k of best.screws) used.add(best.g[k] + '');
  }
  if (plates.length < Math.min(want, 2)) return null;
  // total screws must be a multiple of 3 (boxes hold 3): drop a screw from a plate that keeps ≥2, or add one on a free key point
  let total = plates.reduce((a, p) => a + p.screws.length, 0);
  for (let g = 0; g < 20 && total % 3; g++) {
    const p = plates[Math.floor(r() * plates.length)];
    if (p.screws.length > 2 && r() < 0.6) { p.screws.splice(Math.floor(r() * p.screws.length), 1); total--; continue; }
    const k = p.pts.findIndex((q, i) => !p.screws.includes(i) && !used.has(q + '') && !plates.some(o => o !== p && o.depth < p.depth && polyDist(o.poly, q[0], q[1]) < R + HEAD * 0.7));
    if (k >= 0) { p.screws.push(k); used.add(p.pts[k] + ''); total++; }
  }
  if (total % 3) return null;
  // nice plate colours: neighbours in depth differ
  plates.forEach((p, i) => { if (i && p.color === plates[i - 1].color) p.color = (p.color + 3) % 7; });
  return { plates: plates.map(p => ({ pts: p.pts, screws: p.screws, depth: p.depth, color: p.color, kind: p.kind })), screws: [], boxes: [], spare: P.spare, hard: P.hard };
}
/** order the screws the way they come free, then colour them in triplets (with a little shuffle = difficulty) */
function colourise(L, P, r, window) {
  const total = L.plates.reduce((a, p) => a + p.screws.length, 0);
  L.screws = Array.from({ length: total }, () => ({ color: 0 }));
  L.boxes = [];
  const S = makeState({ ...L, boxes: [] });
  const order = [];
  for (let g = 0; g < 400 && order.length < total; g++) {
    const free = S.screws.filter(s => s.plate >= 0 && !blocked(S, s));
    if (!free.length) break;
    const s = free[Math.floor(r() * free.length)]; order.push(s.i);
    const { swing } = lift(S, s); if (swing) swing.ang = swing.rest; s.box = 0;
  }
  if (order.length < total) { for (const s of S.screws) if (!order.includes(s.i)) order.push(s.i); }
  for (let i = 0; i < order.length; i++) { const j = Math.min(order.length - 1, i + Math.floor(r() * (window + 1))); [order[i], order[j]] = [order[j], order[i]]; }
  const nT = total / 3, pal = [];
  const cols = Math.min(P.colours, nT);
  const base = Array.from({ length: 9 }, (_, i) => i).sort(() => r() - 0.5).slice(0, Math.max(cols, 1));
  let last = -1;
  for (let t = 0; t < nT; t++) {
    let c = base[t % base.length];
    if (t >= base.length) { c = base[Math.floor(r() * base.length)]; if (c === last && base.length > 1) c = base[(base.indexOf(c) + 1) % base.length]; }
    pal.push(c); last = c;
  }
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) L.screws[order[t * 3 + k]].color = pal[t];
  L.boxes = pal;
}

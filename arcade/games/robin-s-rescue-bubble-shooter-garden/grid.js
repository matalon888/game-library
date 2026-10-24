// Robin's Rescue: the hedge grid. Hex layout ("odd rows sit half a berry to the right"), shot tracing with side-wall
// bounces, snapping, colour groups, falling branches and the bot's aim picker. Pure logic, no drawing, runs in node too.
// Units: one berry is 1 wide. x = 0 is the centre of the hedge, y = 0 is the ceiling, y goes negative downward.
export const COLS = 9, RH = Math.sqrt(3) / 2, W = COLS + 0.5, DEAD = 12;   // a berry stuck on row DEAD+ means the hedge is full
export const XWALL = W / 2 - 0.5;                                          // centre of a berry touching a side
export const LAUNCH_Y = -(0.5 + DEAD * RH + 1.35);                          // the robin's perch
const HIT = 0.82;
export const key = (r, c) => r * COLS + c;
export function cellPos(r, c) { return { x: c + (r & 1 ? 0.5 : 0) + 0.5 - W / 2, y: -0.5 - r * RH }; }
export function nbrs(r, c) {
  const o = r & 1, out = [];
  for (const [a, b] of [[r - 1, c - 1 + o], [r - 1, c + o], [r, c - 1], [r, c + 1], [r + 1, c - 1 + o], [r + 1, c + o]])
    if (a >= 0 && b >= 0 && b < COLS) out.push([a, b]);
  return out;
}

export class Grid {
  constructor() { this.m = new Map(); }
  get(r, c) { return this.m.get(key(r, c)); }
  set(r, c, v) { v.r = r; v.c = c; this.m.set(key(r, c), v); return v; }
  del(r, c) { this.m.delete(key(r, c)); }
  get size() { return this.m.size; }
  cells() { return [...this.m.values()]; }
  colours() { const s = new Set(); for (const v of this.m.values()) if (v.color >= 0) s.add(v.color); return s; }
  chicks() { let n = 0; for (const v of this.m.values()) if (v.chick >= 0) n++; return n; }
  lowest() { let m = -1; for (const v of this.m.values()) m = Math.max(m, v.r); return m; }
  clone() { const g = new Grid(); for (const [k, v] of this.m) g.m.set(k, { ...v }); return g; }

  // follow a shot from (x0,y0) at angle a (0 = right, PI/2 = straight up) → { pts, cell:[r,c], bounces }
  trace(x0, y0, a, maxLen = 70) {
    let x = x0, y = y0, dx = Math.cos(a), dy = Math.sin(a), len = 0, bounces = 0; const pts = [{ x, y }], st = 0.06;
    while (len < maxLen) {
      x += dx * st; y += dy * st; len += st;
      if (x > XWALL) { x = 2 * XWALL - x; dx = -dx; bounces++; pts.push({ x: XWALL, y }); }
      else if (x < -XWALL) { x = -2 * XWALL - x; dx = -dx; bounces++; pts.push({ x: -XWALL, y }); }
      if (y >= -0.5) { y = -0.5; break; }
      if (this.touches(x, y)) break;
    }
    pts.push({ x, y });
    return { pts, cell: this.snap(x, y), bounces };
  }
  touches(x, y) {
    const r0 = Math.round((-y - 0.5) / RH);
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) {
      if (!this.m.has(key(r, c))) continue; const p = cellPos(r, c);
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < HIT * HIT) return true;
    }
    return false;
  }
  // nearest free cell that hangs on something (the ceiling row or a neighbour)
  snap(x, y) {
    const r0 = Math.round((-y - 0.5) / RH); let best = null, bd = 1e9;
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) {
      if (this.m.has(key(r, c))) continue; const p = cellPos(r, c); if (Math.abs(p.x) > XWALL + 0.01) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d > 2.4) continue;
      if (r > 0 && !nbrs(r, c).some(([a, b]) => this.m.has(key(a, b)))) continue;
      if (d < bd) { bd = d; best = [r, c]; }
    }
    if (!best) { const r = Math.max(0, r0), off = r & 1 ? 0.5 : 0; best = [r, Math.max(0, Math.min(COLS - 1, Math.round(x + W / 2 - 0.5 - off)))]; }
    return best;
  }
  group(r, c) {      // same-colour group around (r,c)
    const s = this.get(r, c); if (!s || s.color < 0) return [];
    const seen = new Set([key(r, c)]), out = [s], q = [s];
    while (q.length) { const v = q.pop(); for (const [a, b] of nbrs(v.r, v.c)) { const k = key(a, b); if (seen.has(k)) continue; seen.add(k); const w = this.m.get(k); if (w && w.color === s.color) { out.push(w); q.push(w); } } }
    return out;
  }
  loose() {          // berries no longer hanging from the ceiling
    const seen = new Set(), q = [];
    for (let c = 0; c < COLS; c++) { const v = this.get(0, c); if (v) { seen.add(key(0, c)); q.push(v); } }
    while (q.length) { const v = q.pop(); for (const [a, b] of nbrs(v.r, v.c)) { const k = key(a, b); if (seen.has(k)) continue; const w = this.m.get(k); if (w) { seen.add(k); q.push(w); } } }
    return [...this.m.values()].filter(v => !seen.has(key(v.r, v.c)));
  }
  // land a shot at (r,c). shot = { color } | { pearl:true } | { acorn:true }. Mutates → { popped, dropped, placed }
  land(r, c, shot) {
    const res = { popped: [], dropped: [], placed: null };
    if (shot.acorn) {
      const placed = this.set(r, c, { color: -2, chick: -1 }); res.placed = placed;
      const hit = new Set([placed]);
      for (const [a, b] of nbrs(r, c)) { const v = this.get(a, b); if (v) hit.add(v); for (const [a2, b2] of nbrs(a, b)) { const w = this.get(a2, b2); if (w) hit.add(w); } }
      for (const v of hit) this.del(v.r, v.c); res.popped = [...hit];
    } else {
      let color = shot.color;
      if (shot.pearl) {   // the pearl takes the colour of the biggest group it touches
        let bc = -1, bn = 0; for (const [a, b] of nbrs(r, c)) { const v = this.get(a, b); if (!v || v.color < 0) continue; const n = this.group(a, b).length; if (n > bn) { bn = n; bc = v.color; } }
        color = bc >= 0 ? bc : 0;
      }
      const placed = this.set(r, c, { color, chick: -1, pearl: !!shot.pearl }); res.placed = placed;
      const g = this.group(r, c);
      if (g.length >= 3 || (shot.pearl && g.length >= 2)) {
        const thorn = new Set(); for (const v of g) for (const [a, b] of nbrs(v.r, v.c)) { const w = this.get(a, b); if (w && w.bramble) thorn.add(w); }
        for (const v of g) this.del(v.r, v.c); for (const w of thorn) this.del(w.r, w.c);
        res.popped = [...g, ...thorn];
      }
    }
    if (res.popped.length) { res.dropped = this.loose(); for (const v of res.dropped) this.del(v.r, v.c); }
    return res;
  }
}

// the bot / hint: best angle for the current shot (and the swap berry when given)
export function bestShot(grid, shots, { step = 1.5, noise = 0, rnd = Math.random, x0 = 0, y0 = LAUNCH_Y } = {}) {
  let best = null; const chicks = grid.cells().filter(v => v.chick >= 0);
  for (let si = 0; si < shots.length; si++) {
    const shot = shots[si]; if (!shot) continue;
    for (let deg = 14; deg <= 166; deg += step) {
      const a = deg * Math.PI / 180, tr = grid.trace(x0, y0, a), [r, c] = tr.cell;
      if (grid.get(r, c)) continue;
      const g = grid.clone(), res = g.land(r, c, shot);
      const freed = [...res.popped, ...res.dropped].filter(v => v.chick >= 0).length;
      let v = res.popped.length + res.dropped.length * 1.7 + freed * 14;
      if (!res.popped.length) {
        let same = 0; for (const [a2, b2] of nbrs(r, c)) { const w = grid.get(a2, b2); if (w && w.color === shot.color) same++; }
        v = same * 0.7 - r * 0.04 - tr.bounces * 0.15 - (r >= DEAD - 1 ? 30 : 0);
      }
      for (const w of chicks) { const d = Math.abs(w.r - r) + Math.abs(w.c - c) * 0.6; if (d <= 2.5) v += 0.5; }
      v += (rnd() - 0.5) * noise - si * 0.35;
      if (!best || v > best.v) best = { v, a, swap: si === 1, cell: [r, c] };
    }
  }
  return best;
}

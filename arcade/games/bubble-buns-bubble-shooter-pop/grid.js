// Bubble Buns grid: hex ("odd rows shifted right") bubble field, shot tracing with wall bounces, snapping, matching,
// floating detection and the bot's aim chooser. Pure logic (no three.js), so it also runs in node for tuning.
// The field is tall and scrolls: the launcher always sits GAP rows below the lowest bubble (Bubble-Witch style), so the
// board fills the screen on every level instead of hanging in the top third.
export const COLS = 9, RH = Math.sqrt(3) / 2, W = COLS + 0.5, R_HIT = 0.8;
export const XWALL = W / 2 - 0.5;                       // centre of a bubble touching a side wall
export const WIN = 12;                                   // rows the launcher keeps in view at least (logic constant: same for everyone)
export const GAP = 4.8;                                  // distance (units) from the lowest row to the launcher
export const key = (r, c) => r * 64 + c;
export function cellPos(r, c) { return { x: c + (r & 1 ? 0.5 : 0) + 0.5 - W / 2, y: -0.5 - r * RH }; }
export function nbrs(r, c) {
  const o = r & 1, out = [];
  for (const [a, b] of [[r - 1, c - 1 + o], [r - 1, c + o], [r, c - 1], [r, c + 1], [r + 1, c - 1 + o], [r + 1, c + o]])
    if (a >= 0 && b >= 0 && b < COLS && a < 60) out.push([a, b]);
  return out;
}
/** launcher y for a field whose lowest row is `maxRow` (the field scrolls so the gap above the launcher stays the same) */
export const launchYFor = maxRow => -0.5 - Math.max(WIN - 1, maxRow) * RH - GAP;

export class Grid {
  constructor() { this.m = new Map(); }
  get(r, c) { return this.m.get(key(r, c)); }
  set(r, c, v) { v.r = r; v.c = c; this.m.set(key(r, c), v); return v; }
  del(r, c) { this.m.delete(key(r, c)); }
  get size() { return this.m.size; }
  cells() { return [...this.m.values()]; }
  maxRow() { let m = -1; for (const v of this.m.values()) m = Math.max(m, v.r); return m; }
  launchY() { return launchYFor(this.maxRow()); }
  colorsLeft() { const s = new Set(); for (const v of this.m.values()) if (v.color >= 0) s.add(v.color); return s; }
  clone() { const g = new Grid(); for (const [k, v] of this.m) g.m.set(k, { ...v }); return g; }

  // follow a shot from (x0,y0) at angle a (radians, 0 = right, PI/2 = up). → { pts:[{x,y}], cell:[r,c], bounces, end }
  trace(x0, y0, a, maxLen = 160) {
    let x = x0, y = y0, dx = Math.cos(a), dy = Math.sin(a); const pts = [{ x, y }], st = 0.07; let len = 0, bounces = 0;
    while (len < maxLen) {
      x += dx * st; y += dy * st; len += st;
      if (x > XWALL) { x = 2 * XWALL - x; dx = -dx; bounces++; pts.push({ x: XWALL, y }); }
      else if (x < -XWALL) { x = -2 * XWALL - x; dx = -dx; bounces++; pts.push({ x: -XWALL, y }); }
      if (y >= -0.5) { y = -0.5; break; }
      if (this.hits(x, y)) break;
    }
    pts.push({ x, y });
    return { pts, cell: this.snap(x, y), bounces, end: { x, y } };
  }
  hits(x, y) {
    const r0 = Math.round((-y - 0.5) / RH);
    for (let r = r0 - 1; r <= r0 + 1; r++) { if (r < 0) continue;
      for (let c = 0; c < COLS; c++) { if (!this.m.has(key(r, c))) continue; const p = cellPos(r, c); if ((p.x - x) ** 2 + (p.y - y) ** 2 < R_HIT * R_HIT) return true; } }
    return false;
  }
  // nearest empty cell that is legal (top row, or touching a bubble)
  snap(x, y) {
    const r0 = Math.round((-y - 0.5) / RH); let best = null, bd = 1e9;
    for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) {
      if (this.m.has(key(r, c))) continue; const p = cellPos(r, c), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d > 2.2) continue;
      if (r > 0 && !nbrs(r, c).some(([a, b]) => this.m.has(key(a, b)))) continue;
      if (d < bd) { bd = d; best = [r, c]; }
    }
    if (!best) { const r = Math.max(0, r0), cc = Math.max(0, Math.min(COLS - 1, Math.round(x + W / 2 - 0.5 - (r & 1 ? 0.5 : 0)))); best = [r, cc]; }
    return best;
  }
  cluster(r, c) {   // same-colour group containing (r,c)
    const s = this.get(r, c); if (!s || s.color < 0) return [];
    const seen = new Set([key(r, c)]), out = [s], q = [s];
    while (q.length) { const v = q.pop(); for (const [a, b] of nbrs(v.r, v.c)) { const k = key(a, b); if (seen.has(k)) continue; seen.add(k); const w = this.m.get(k); if (w && w.color === s.color) { out.push(w); q.push(w); } } }
    return out;
  }
  floating() {      // bubbles no longer connected to the ceiling
    const seen = new Set(), q = [];
    for (let c = 0; c < COLS; c++) { const v = this.get(0, c); if (v) { seen.add(key(0, c)); q.push(v); } }
    while (q.length) { const v = q.pop(); for (const [a, b] of nbrs(v.r, v.c)) { const k = key(a, b); if (seen.has(k)) continue; const w = this.m.get(k); if (w) { seen.add(k); q.push(w); } } }
    return [...this.m.values()].filter(v => !seen.has(key(v.r, v.c)));
  }
  // resolve a shot landing at (r,c) with kind {color} | {rainbow} | {bomb}. Mutates. → { popped:[], dropped:[], placed }
  resolve(r, c, shot) {
    const res = { popped: [], dropped: [], placed: null };
    if (shot.bomb) {
      const placed = this.set(r, c, { color: -2, critter: -1 }); res.placed = placed;
      const hit = [placed]; for (const [a, b] of nbrs(r, c)) { const v = this.get(a, b); if (v) hit.push(v); for (const [a2, b2] of nbrs(a, b)) { const w = this.get(a2, b2); if (w && !hit.includes(w)) hit.push(w); } }
      for (const v of hit) this.del(v.r, v.c); res.popped = hit;
    } else {
      let color = shot.color;
      if (shot.rainbow) {   // takes the colour of the biggest touching group
        let bc = -1, bn = 0; for (const [a, b] of nbrs(r, c)) { const v = this.get(a, b); if (!v || v.color < 0) continue; const n = this.cluster(a, b).length; if (n > bn) { bn = n; bc = v.color; } }
        color = bc >= 0 ? bc : 0;
      }
      const placed = this.set(r, c, { color, critter: -1, rainbow: !!shot.rainbow }); res.placed = placed;
      const cl = this.cluster(r, c);
      if (cl.length >= 3 || (shot.rainbow && cl.length >= 2)) {
        // jelly locks next to a popping group melt too
        const extra = new Set(); for (const v of cl) for (const [a, b] of nbrs(v.r, v.c)) { const w = this.get(a, b); if (w && w.stone) extra.add(w); }
        for (const v of cl) this.del(v.r, v.c); for (const w of extra) this.del(w.r, w.c);
        res.popped = [...cl, ...extra];
      }
    }
    if (res.popped.length) { res.dropped = this.floating(); for (const v of res.dropped) this.del(v.r, v.c); }
    return res;
  }
  crittersLeft() { let n = 0; for (const v of this.m.values()) if (v.critter >= 0) n++; return n; }
}

// --- bot: choose the best angle for the current (and optionally next) shot, launched from (x0, y0)
export function bestShot(grid, x0, y0, shots, { step = 1.2, noise = 0, rnd = Math.random } = {}) {
  let best = null;
  const crit = [...grid.m.values()].filter(w => w.critter >= 0);
  for (let si = 0; si < shots.length; si++) {
    const shot = shots[si];
    for (let deg = 12; deg <= 168; deg += step) {
      const a = deg * Math.PI / 180, tr = grid.trace(x0, y0, a); const [r, c] = tr.cell;
      if (grid.get(r, c)) continue;
      const g = grid.clone(), res = g.resolve(r, c, shot);
      const freed = [...res.popped, ...res.dropped].filter(v => v.critter >= 0).length;
      let v = res.popped.length + res.dropped.length * 1.6 + freed * 12;
      if (!res.popped.length) {   // no pop: prefer resting next to the same colour, high up
        let same = 0; for (const [a2, b2] of nbrs(r, c)) { const w = grid.get(a2, b2); if (w && w.color === shot.color) same++; }
        v = same * 0.6 - r * 0.03 - tr.bounces * 0.1 - (r > grid.maxRow() ? 0.6 : 0);
      }
      // critters close to the landing spot are worth digging toward
      for (const w of crit) if (Math.abs(w.r - r) <= 2 && Math.abs(w.c - c) <= 2) v += 0.4;
      v += (rnd() - 0.5) * noise - si * 0.3;
      if (!best || v > best.v) best = { v, a, swap: si === 1, cell: [r, c] };
    }
  }
  return best;
}

// Slidegate level logic (no rendering): board, shapes, gates, moves, exits, and a generator that is always solvable.
// Generation works backwards: each new block is slid IN through its gate to a reachable spot, so taking the blocks out
// in reverse order is always possible (moves are reversible, and removing a block only frees space).
export const SIDES = { L: [-1, 0], R: [1, 0], T: [0, -1], B: [0, 1] };
const BASE = [
  { w: 2, c: [[0, 0], [1, 0]] },                         // domino
  { w: 3, c: [[0, 0], [1, 0], [2, 0]] },                 // bar 3
  { w: 3, c: [[0, 0], [1, 0], [0, 1], [1, 1]] },         // square
  { w: 3, c: [[0, 0], [0, 1], [1, 1]] },                 // small L
  { w: 3, c: [[0, 0], [0, 1], [0, 2], [1, 2]] },         // L
  { w: 3, c: [[0, 0], [1, 0], [2, 0], [1, 1]] },         // T
  { w: 1.5, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },       // S
  { w: 0.3, c: [[0, 0]] },                               // single
  { w: 1.5, c: [[0, 0], [1, 0], [2, 0], [3, 0]] },       // bar 4
];
export function norm(cells) {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
const rot = cells => norm(cells.map(([x, y]) => [-y, x]));
export const ext = cells => ({ w: Math.max(...cells.map(c => c[0])) + 1, h: Math.max(...cells.map(c => c[1])) + 1 });

export function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

/** a board: W×H cells; g[y*W+x] = -1 free, -2 wall, else block id */
export function makeBoard(W, H) { return { W, H, g: new Array(W * H).fill(-1), blocks: [], gates: [] }; }
export const inside = (b, x, y) => x >= 0 && y >= 0 && x < b.W && y < b.H;
export const at = (b, x, y) => b.g[y * b.W + x];
const freeFor = (b, x, y, id) => inside(b, x, y) && (at(b, x, y) === -1 || at(b, x, y) === id);
export function fits(b, blk, x, y) { for (const [dx, dy] of blk.cells) if (!freeFor(b, x + dx, y + dy, blk.id)) return false; return true; }
export function canMove(b, blk, dx, dy) {
  if (blk.lock === 'h' && dy) return false; if (blk.lock === 'v' && dx) return false;
  return fits(b, blk, blk.x + dx, blk.y + dy);
}
export function stamp(b, blk, v) { for (const [dx, dy] of blk.cells) b.g[(blk.y + dy) * b.W + blk.x + dx] = v; }
/** the gate this block can leave through from (x, y) going `side`, or null */
export function exitGate(b, blk, side, x = blk.x, y = blk.y) {
  const [sx, sy] = SIDES[side];
  if (blk.lock === 'h' && sy) return null; if (blk.lock === 'v' && sx) return null;
  const g = b.gates.find(g => g.side === side && g.color === blk.color && blk.cells.every(([dx, dy]) => { const p = sx ? y + dy : x + dx; return p >= g.start && p < g.start + g.len; }));
  if (!g) return null;
  for (const [dx, dy] of blk.cells) {           // every cell's straight path to that wall must be clear
    let cx = x + dx + sx, cy = y + dy + sy;
    while (inside(b, cx, cy)) { if (!freeFor(b, cx, cy, blk.id)) return null; cx += sx; cy += sy; }
  }
  return g;
}
export function exitAny(b, blk, x = blk.x, y = blk.y) { for (const s of 'LRTB') { const g = exitGate(b, blk, s, x, y); if (g) return s; } return null; }
/** BFS over positions the block can slide to; returns { path: [[x,y]...], side } to the nearest exit, or null */
export function pathOut(b, blk) {
  const key = (x, y) => x + ',' + y, prev = new Map([[key(blk.x, blk.y), null]]), q = [[blk.x, blk.y]];
  while (q.length) {
    const [x, y] = q.shift(), s = exitAny(b, blk, x, y);
    if (s) { const path = []; let k = key(x, y); while (k) { path.unshift(k.split(',').map(Number)); k = prev.get(k); } return { path, side: s }; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (blk.lock === 'h' && dy) continue; if (blk.lock === 'v' && dx) continue;
      const nx = x + dx, ny = y + dy, k = key(nx, ny); if (prev.has(k) || !fits(b, blk, nx, ny)) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  return null;
}

export function generate(level, seed, fk = 1) {
  for (let tries = 0; tries < 30; tries++) { const b = attempt(level, seed + tries * 7919, fk); if (b && b.blocks.length >= Math.min(3, 1 + level)) return b; }
  return attempt(1, seed, 1);
}
function attempt(level, seed, fk) {
  const r = rngf(seed * 2654435761 + level * 97), pick = a => a[Math.floor(r() * a.length)];
  const W = Math.min(7, 4 + Math.floor((level + 1) / 3)), H = Math.min(9, W + 1 + (level > 5 ? 1 : 0));
  const b = makeBoard(W, H);
  // corner notches (walls) from level 3 for shape variety
  if (level >= 3) { const n = level >= 7 ? 2 : 1; for (let i = 0; i < n; i++) { const x = r() < 0.5 ? 0 : W - 1, y = r() < 0.5 ? 0 : H - 1; b.g[y * W + x] = -2; } }
  const ncol = Math.min(6, 2 + Math.floor(level / 2)), cols = [0, 1, 2, 3, 4, 5].sort(() => r() - 0.5).slice(0, ncol);
  const free = b.g.filter(v => v === -1).length, target = Math.round(free * Math.min(0.8, Math.max(0.4, (0.46 + level * 0.025) * fk)));
  const maxSize = level < 3 ? 3 : 4, shapes = BASE.filter((s, i) => s.c.length <= maxSize && (i !== 8 || W >= 6));
  let filled = 0;
  for (let a = 0; a < 600 && filled < target; a++) {
    const color = b.blocks.length < ncol ? cols[b.blocks.length] : pick(cols);
    const tw = shapes.reduce((a, s) => a + s.w, 0); let u = r() * tw, base = shapes[0]; for (const s of shapes) { if ((u -= s.w) < 0) { base = s; break; } }
    let cells = base.c; for (let k = Math.floor(r() * 4); k > 0; k--) cells = rot(cells);
    cells = norm(cells); if (filled + cells.length > target + 1) continue;
    const e = ext(cells);
    let gate = b.gates.find(g => g.color === color), fresh = false;
    if (!gate) {
      const side = pick(['L', 'R', 'T', 'B']), along = side === 'L' || side === 'R' ? H : W, need = side === 'L' || side === 'R' ? e.h : e.w;
      const len = Math.min(along - 1, need + (r() < 0.45 ? 1 : 0)), start = Math.floor(r() * (along - len + 1));
      // keep gates apart, and off notched corners
      const clash = b.gates.some(g => g.side === side && start < g.start + g.len + 1 && g.start < start + len + 1);
      const [sx, sy] = SIDES[side]; let notch = false;
      for (let p = start; p < start + len; p++) { const x = sx ? (sx < 0 ? 0 : W - 1) : p, y = sx ? p : (sy < 0 ? 0 : H - 1); if (b.g[y * W + x] === -2) notch = true; }
      if (clash || notch || len < need) continue;
      gate = { side, start, len, color }; fresh = true;
    }
    const vert = gate.side === 'L' || gate.side === 'R', need = vert ? e.h : e.w;
    if (need > gate.len) continue;
    const lock = level >= 6 && r() < 0.22 ? (vert ? 'h' : 'v') : null;
    const blk = { id: b.blocks.length, color, cells, lock, x: 0, y: 0 };
    // flush against the gate wall, inside its span
    const off = gate.start + Math.floor(r() * (gate.len - need + 1));
    blk.x = vert ? (gate.side === 'L' ? 0 : W - e.w) : off; blk.y = vert ? off : (gate.side === 'T' ? 0 : H - e.h);
    if (fresh) b.gates.push(gate);
    if (!fits(b, blk, blk.x, blk.y) || !exitGate(b, blk, gate.side)) { if (fresh) b.gates.pop(); continue; }
    // slide it in: BFS reachable spots, prefer far ones
    const seen = new Map([[blk.x + ',' + blk.y, 0]]), q = [[blk.x, blk.y]];
    while (q.length) { const [x, y] = q.shift(), d = seen.get(x + ',' + y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (lock === 'h' && dy) continue; if (lock === 'v' && dx) continue;
        const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && fits(b, blk, x + dx, y + dy)) { seen.set(k, d + 1); q.push([x + dx, y + dy]); } } }
    const all = [...seen.entries()], md = Math.max(...all.map(e => e[1])), far = all.filter(e => e[1] >= md * 0.5);
    const [px, py] = pick(far)[0].split(',').map(Number); blk.x = px; blk.y = py;
    stamp(b, blk, blk.id); b.blocks.push(blk); filled += cells.length;
  }
  return b;
}

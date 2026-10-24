// Peony Mahjong rules engine: the free-tile rule, solvable deals (built by playing the layout backwards),
// solvable re-deals for Shuffle, and a quick randomized solver for Hint.
// A tile {x, y, l} covers [x, x+2) x [y, y+2) in half-tile units on layer l.

export function rng(seed) { let s = (Math.floor(seed) >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export const shuffleA = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// neighbours: who covers each tile, who touches it on the left and on the right
export function links(tiles) {
  const n = tiles.length, above = [], left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = tiles[i], ab = [], lf = [], rt = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue; const b = tiles[j];
      if (Math.abs(b.y - a.y) >= 2) continue;
      if (b.l === a.l + 1 && Math.abs(b.x - a.x) < 2) ab.push(j);
      else if (b.l === a.l) { if (b.x - a.x === 2) rt.push(j); else if (a.x - b.x === 2) lf.push(j); }
    }
    above.push(ab); left.push(lf); right.push(rt);
  }
  return { above, left, right };
}

export function isFree(i, alive, L) {
  if (!alive[i]) return false;
  for (const j of L.above[i]) if (alive[j]) return false;
  let lb = false, rb = false;
  for (const j of L.left[i]) if (alive[j]) { lb = true; break; }
  if (!lb) return true;
  for (const j of L.right[i]) if (alive[j]) { rb = true; break; }
  return !rb;
}
export const freeList = (alive, L) => { const f = []; for (let i = 0; i < alive.length; i++) if (isFree(i, alive, L)) f.push(i); return f; };

// matching: identical faces, or any flower with any flower, any season with any season
export const keyOf = f => f.startsWith('flower-') ? 'flower' : f.startsWith('season-') ? 'season' : f;
export const matches = (a, b) => keyOf(a) === keyOf(b);

// available pairs among free tiles
export function pairsAvailable(alive, faces, L) {
  const by = new Map(), out = [];
  for (const i of freeList(alive, L)) { const k = keyOf(faces[i]); if (!by.has(k)) by.set(k, []); by.get(k).push(i); }
  for (const g of by.values()) for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) out.push([g[a], g[b]]);
  return out;
}

// a removal order of position pairs, each pair free at its moment; giving each pair matching faces makes it the solution
function reverseOrder(tiles, alive0, L, r) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const alive = alive0.slice(), order = [];
    let left = alive.filter(Boolean).length, ok = true;
    while (left > 0) {
      const free = freeList(alive, L);
      if (free.length < 2) { ok = false; break; }
      // favour high tiles and the outer ends so the deal doesn't paint itself into a corner
      const w = free.map(i => 1 + tiles[i].l * 2.5);
      const pick = (ex) => { let tot = 0; for (let k = 0; k < free.length; k++) if (free[k] !== ex) tot += w[k]; let x = r() * tot; for (let k = 0; k < free.length; k++) { if (free[k] === ex) continue; x -= w[k]; if (x <= 0) return free[k]; } return free.find(i => i !== ex); };
      const a = pick(-1), b = pick(a);
      alive[a] = alive[b] = false; order.push([a, b]); left -= 2;
    }
    if (ok) return order;
  }
  return null;
}

// face units: each unit is the two faces that go on one pair
export function unitsFromFaces(faceList, r) {
  const by = new Map();
  for (const f of faceList) { const k = keyOf(f); if (!by.has(k)) by.set(k, []); by.get(k).push(f); }
  const units = [];
  for (const g of by.values()) { shuffleA(g, r); for (let i = 0; i + 1 < g.length; i += 2) units.push([g[i], g[i + 1]]); }
  return units;
}

// a solvable deal for all tiles: returns faces[] (or null) given pair units
export function deal(tiles, L, units, r) {
  const alive = tiles.map(() => true), order = reverseOrder(tiles, alive, L, r);
  if (!order) return null;
  const u = shuffleA(units.slice(), r), faces = new Array(tiles.length);
  order.forEach(([a, b], k) => { const fl = r() < 0.5; faces[a] = u[k][fl ? 0 : 1]; faces[b] = u[k][fl ? 1 : 0]; });
  return { faces, solution: order };
}

// re-deal the faces of the tiles still on the board so the rest is solvable again
export function redeal(tiles, alive, faces, L, r) {
  const idx = []; for (let i = 0; i < tiles.length; i++) if (alive[i]) idx.push(i);
  const units = unitsFromFaces(idx.map(i => faces[i]), r);
  const order = reverseOrder(tiles, alive, L, r);
  if (!order) return null;
  const out = faces.slice(); shuffleA(units, r);
  order.forEach(([a, b], k) => { out[a] = units[k][0]; out[b] = units[k][1]; });
  return { faces: out, solution: order };
}

// randomized greedy playouts: a first move that leads to a full clear, or null if none was found in the budget
export function solveFrom(tiles, alive0, faces, L, { ms = 40, r = Math.random } = {}) {
  const t0 = performance.now();
  let tries = 0;
  while (tries < 6 || performance.now() - t0 < ms) {
    tries++;
    const alive = alive0.slice(); let first = null, left = alive.filter(Boolean).length;
    while (left > 0) {
      const av = pairsAvailable(alive, faces, L);
      if (!av.length) break;
      // safe moves first: a key whose every remaining tile is free and there are 2 or 4 of them
      let mv = null;
      const remain = new Map(); for (let i = 0; i < alive.length; i++) if (alive[i]) { const k = keyOf(faces[i]); remain.set(k, (remain.get(k) || 0) + 1); }
      const freeBy = new Map(); for (const [a, b] of av) { const k = keyOf(faces[a]); if (!freeBy.has(k)) freeBy.set(k, new Set()); freeBy.get(k).add(a).add(b); }
      for (const [k, s] of freeBy) if (s.size === remain.get(k) && (s.size === 2 || s.size === 4)) { mv = av.find(p => keyOf(faces[p[0]]) === k); break; }
      if (!mv) {
        // otherwise prefer pairs that uncover the most, with noise
        let best = -1;
        for (const p of av) { const sc = tiles[p[0]].l + tiles[p[1]].l + (L.above[p[0]].length === 0 ? 0 : 0) + r() * 2.2; if (sc > best) { best = sc; mv = p; } }
      }
      if (!first) first = mv;
      alive[mv[0]] = alive[mv[1]] = false; left -= 2;
    }
    if (left === 0) return first;
    if (tries > 400) break;
  }
  return null;
}

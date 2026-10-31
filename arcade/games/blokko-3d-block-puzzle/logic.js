// Blokko deep v2 — pure rules (no THREE): shape parser, arrow generator (peels the shape so a full clearing order always
// exists), the sim used for par and by the QA bots, and the cube kinds.
export const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const KIND = { '#': 'n', G: 'g', '?': 'h', B: 'b', S: 's' };
const key = (x, y, z) => x + ',' + y + ',' + z;
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export function parse(shape) {
  const cells = [], layers = shape.split(' '); let X = 0, Z = 0;
  layers.forEach((layer, y) => layer.split('/').forEach((row, z) => {
    [...row].forEach((ch, x) => { if (ch !== '.') cells.push({ x, y, z, t: KIND[ch] }); X = Math.max(X, x + 1); });
    Z = Math.max(Z, z + 1);
  }));
  return { cells, dims: [X, layers.length, Z] };
}

// a world of cubes: alive flags, ray tests, taps with bomb blasts. Used by the generator, par search and the game's logic.
export function world(cells, dims) {
  const idx = new Map(); cells.forEach((c, i) => idx.set(key(c.x, c.y, c.z), i));
  const alive = cells.map(() => true), at = (x, y, z) => idx.get(key(x, y, z));
  const nb = cells.map(c => DIRS.map(d => at(c.x + d[0], c.y + d[1], c.z + d[2])).filter(i => i !== undefined));
  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < dims[0] && y < dims[1] && z < dims[2];
  // how many cells cube i can slide along direction di before it hits a living cube (Infinity = it leaves)
  function reach(i, di) {
    const c = cells[i], d = DIRS[di]; let x = c.x + d[0], y = c.y + d[1], z = c.z + d[2], n = 0;
    while (inside(x, y, z)) { const j = at(x, y, z); if (j !== undefined && alive[j]) return n; n++; x += d[0]; y += d[1]; z += d[2]; }
    return Infinity;
  }
  function blast(i, out = []) {   // kill the cubes touching i (chains through bombs); returns the list of cubes removed, in order
    const q = [i];
    while (q.length) { const b = q.shift(); for (const j of nb[b]) if (alive[j]) { alive[j] = false; out.push(j); if (cells[j].t === 'b') q.push(j); } }
    return out;
  }
  return { cells, dims, alive, idx, at, nb, inside, reach, blast };
}

// lay the arrows: peel the shape cube by cube (each peeled cube was free at that moment), so the peel order is a full solution.
// Returns null when the shape cannot be peeled (a stone no bomb can reach).
export function gen(shape, seed) {
  const { cells, dims } = parse(shape), r = rng(seed), W = world(cells, dims), n = cells.length;
  const dir = new Array(n).fill(-1), removed = new Set(), order = [];
  const left = () => cells.map((c, i) => i).filter(i => W.alive[i] && cells[i].t !== 's');
  let guard = 0;
  while (left().length && guard++ < 999) {
    const cand = [];
    for (const i of left()) { const f = []; for (let di = 0; di < 6; di++) if (W.reach(i, di) === Infinity) f.push(di); if (f.length) cand.push([i, f]); }
    if (!cand.length) return null;
    const [i, f] = cand[Math.floor(r() * cand.length)];
    let best = f[Math.floor(r() * f.length)];
    if (r() < 0.75) {   // prefer an arrow that points through cells already peeled: at the start they are full, so it is blocked until then
      let bs = -1;
      for (const di of f) {
        const d = DIRS[di], c = cells[i]; let x = c.x + d[0], y = c.y + d[1], z = c.z + d[2], k = 0;
        while (W.inside(x, y, z)) { const j = W.at(x, y, z); if (j !== undefined && removed.has(j)) k++; x += d[0]; y += d[1]; z += d[2]; }
        if (k + r() * 0.5 > bs) { bs = k + r() * 0.5; best = di; }
      }
    }
    dir[i] = best; W.alive[i] = false; removed.add(i); order.push(i);
    if (cells[i].t === 'b') for (const j of W.blast(i)) removed.add(j);
  }
  if (cells.some((c, i) => W.alive[i])) return null;
  for (let i = 0; i < n; i++) if (dir[i] < 0) dir[i] = Math.floor(r() * 6);   // blasted cubes: any arrow (they leave with the blast)
  return { cells: cells.map((c, i) => Object.assign({}, c, { d: dir[i] })), dims, order };
}

// the state of a level in play (used by par search and the QA bots; deep.js keeps its own copy of the same rules for the 3D part)
export function sim(lv) {
  const W = world(lv.cells, lv.dims), n = lv.cells.length;
  const free = i => W.alive[i] && lv.cells[i].t !== 's' && W.reach(i, lv.cells[i].d) === Infinity;
  function tap(i) { W.alive[i] = false; const out = [i]; if (lv.cells[i].t === 'b') W.blast(i, out); return out; }
  return { W, n, free, tap, left: () => W.alive.filter(Boolean).length, tappables: () => lv.cells.map((c, i) => i).filter(free) };
}

// fewest taps found: random orders plus "prefer the bomb that blows the most" orders
export function parSearch(lv, tries = 400, seed = 7) {
  const r = rng(seed); let best = 1e9, bestSeq = null;
  for (let t = 0; t < tries; t++) {
    const S = sim(lv), seq = [], greedy = t % 2 === 0, noise = (t % 5) / 5;
    while (S.left() && seq.length < 400) {
      const f = S.tappables(); if (!f.length) break;
      let pick;
      if (greedy) {
        let bs = -1;
        for (const i of f) {
          const c = lv.cells[i]; let sc = r() * (1 + noise * 4);
          if (c.t === 'b') { const save = S.W.alive.slice(); sc += S.W.blast(i).length * 2; S.W.alive.splice(0, S.n, ...save); }
          if (sc > bs) { bs = sc; pick = i; }
        }
      } else pick = f[Math.floor(r() * f.length)];
      S.tap(pick); seq.push(pick);
    }
    if (!S.left() && seq.length < best) { best = seq.length; bestSeq = seq; }
  }
  return { par: best, seq: bestSeq };
}

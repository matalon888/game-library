// inkgen.js — Inkpath puzzle generator (pure, no DOM). Our own code, MIT.
// A random path that visits every cell (backbite moves on a zig-zag), numbered stops along it, optional walls,
// then stops are removed one by one while an exhaustive solver still finds exactly one line.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function wallKey(a, b) { return a < b ? a + ':' + b : b + ':' + a; }
export function neighbours(N, c, walls) {
  const y = (c / N) | 0, x = c % N, out = [];
  for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const d = ny * N + nx; if (walls && walls.has(wallKey(c, d))) continue; out.push(d); }
  return out;
}
function randomPath(N, r) {
  let p = []; for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) p.push(y * N + (y % 2 ? N - 1 - i : i));
  const moves = N * N * 30;
  for (let m = 0; m < moves; m++) {
    if (r() < 0.5) p.reverse();
    const end = p[p.length - 1], nb = neighbours(N, end).filter(d => d !== p[p.length - 2]);
    const d = nb[Math.floor(r() * nb.length)], i = p.indexOf(d);
    // backbite: connect end to d, reverse the tail after d
    const tail = p.slice(i + 1).reverse(); p = p.slice(0, i + 1).concat(tail);
  }
  return p;
}
// count lines (up to 2) that start at stop 1, pass the stops in order, fill every cell and end on the last stop
export function count(N, stops, walls, budget = 250000) {
  const T = N * N, order = new Map(stops.map((c, i) => [c, i])), last = stops[stops.length - 1];
  const nb = []; for (let c = 0; c < T; c++) nb.push(neighbours(N, c, walls));
  const vis = new Uint8Array(T); let found = 0, nodes = 0, firstSol = null; const path = [];
  const ok = (head) => {
    // every free cell needs two ways in/out (one if it's the final stop); free cells must stay connected to the head
    let free = 0, start = -1;
    for (let c = 0; c < T; c++) if (!vis[c]) {
      free++; start = c; let deg = 0;
      for (const d of nb[c]) if (!vis[d] || d === head) deg++;
      if (deg < (c === last ? 1 : 2)) return false;
    }
    if (!free) return true;
    const seen = new Uint8Array(T), st = [start]; seen[start] = 1; let n = 1, touchesHead = false;
    while (st.length) { const c = st.pop(); for (const d of nb[c]) { if (d === head) touchesHead = true; if (!vis[d] && !seen[d]) { seen[d] = 1; n++; st.push(d); } } }
    return n === free && touchesHead;
  };
  const go = (c, k, len) => {
    if (found >= 2 || ++nodes > budget) return;
    if (len === T) { if (c === last) { found++; if (!firstSol) firstSol = path.slice(); } return; }
    if (c === last) return;
    if (!ok(c)) return;
    for (const d of nb[c]) {
      if (vis[d]) continue;
      const o = order.get(d);
      if (o !== undefined && o !== k) continue;
      vis[d] = 1; path.push(d); go(d, o !== undefined ? k + 1 : k, len + 1); path.pop(); vis[d] = 0;
    }
  };
  vis[stops[0]] = 1; path.push(stops[0]); go(stops[0], 1, 1);
  return { n: nodes > budget ? -1 : found, sol: firstSol };
}

export function spec(level, fk = 1) {
  const L = level * fk;
  const N = L < 2.5 ? 5 : L < 7 ? 6 : L < 15 ? 7 : 8;
  const minStops = Math.max(3, Math.round((N === 5 ? 6 : N === 6 ? 7 : N === 7 ? 9 : 10) / Math.min(1.35, Math.max(0.85, fk))));
  const walls = L < 5 ? 0 : Math.min(N + 2, Math.round((L - 3) / 2.5));
  return { N, minStops, walls };
}
export function generate(level, seed, fk, rngf) {
  const { N, minStops, walls: nW } = spec(level, fk), r = rngf(seed), T = N * N;
  for (let attempt = 0; attempt < 12; attempt++) {
    const path = randomPath(N, r), pos = new Map(path.map((c, i) => [c, i]));
    // walls between neighbours the line never steps across
    const walls = new Set(), cand = [];
    for (let c = 0; c < T; c++) for (const d of neighbours(N, c)) if (c < d && Math.abs(pos.get(c) - pos.get(d)) !== 1) cand.push([c, d]);
    for (let i = 0; i < nW && cand.length; i++) { const j = Math.floor(r() * cand.length); const [a, b] = cand.splice(j, 1)[0]; walls.add(wallKey(a, b)); }
    // start dense: every other cell is a stop
    let idx = []; for (let i = 0; i < T; i += 2) idx.push(i); if (idx[idx.length - 1] !== T - 1) idx.push(T - 1);
    const stopsOf = (ix) => ix.map(i => path[i]);
    let c0 = count(N, stopsOf(idx), walls);
    if (c0.n !== 1) { idx = [...Array(T).keys()]; c0 = count(N, stopsOf(idx), walls); if (c0.n !== 1) continue; }
    // thin the stops while the answer stays unique
    const order = idx.slice(1, -1); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const i of order) {
      if (idx.length <= minStops) break;
      const trial = idx.filter(v => v !== i);
      if (count(N, stopsOf(trial), walls, 120000).n === 1) idx = trial;
    }
    return { N, path, stops: stopsOf(idx), walls: [...walls] };
  }
  return null;
}

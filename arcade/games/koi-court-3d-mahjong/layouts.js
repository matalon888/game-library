// Koi Court layouts: seeded tile stacks (half-tile grid), the free-tile rule, and solvable deals.
// A tile at (x, z, l) covers [x, x+2) x [z, z+2) in half-tile units on layer l.
// Free = nothing on top overlapping it, and nothing touching its left side OR nothing touching its right side.
// Deals are built by playing the layout backwards (remove random free pairs, give each pair one symbol), so every deal
// has at least one full solution. Shuffles re-deal the remaining tiles the same way.
import { KINDS, TREASURE } from './tiles.js';

export function rng(seed) { let s = (Math.floor(seed) >>> 0) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const shuffleA = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// shape families on normalised coordinates (u, v in -1..1, v = toward the player)
const SHAPES = {
  rect: () => true,
  oval: (u, v) => u * u + v * v <= 1.18,
  diamond: (u, v) => Math.abs(u) + Math.abs(v) <= 1.3,
  ring: (u, v) => { const d = u * u + v * v; return d <= 1.2 && d >= 0.2; },
  cross: (u, v) => Math.abs(u) < 0.5 || Math.abs(v) < 0.42,
  hourglass: (u, v) => Math.abs(u) <= 0.3 + 0.8 * Math.abs(v),
  bowtie: (u, v) => Math.abs(v) <= 0.3 + 0.8 * Math.abs(u),
  heart: (u, v) => { const x = u * 1.2, y = -v * 1.25 + 0.25; return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0.05; },
  arch: (u, v) => v < 0.15 || Math.abs(u) > 0.42,
  twin: (u, v) => Math.abs(u) > 0.18,
  flower: (u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); return r <= 0.82 + 0.3 * Math.cos(4 * a); },
  pagoda: (u, v) => Math.abs(u) <= 0.35 + 0.65 * (v + 1) / 2 + 0.05,
  lattice: (u, v, c, r) => !(c % 2 === 1 && r % 2 === 1) || Math.abs(u) < 0.2,
  koi: (u, v) => { const b = (u * u) / 0.5 + ((v + 0.15) * (v + 0.15)) / 0.75 <= 1; const tail = v > 0.55 && Math.abs(u) <= (v - 0.45) * 1.4; return b || tail; },
};
export const SHAPE_NAMES = Object.keys(SHAPES);

// layout target sizes by level (tiles); early levels small, ramps to ~120
export function targetTiles(n) {
  if (n <= 1) return 16; if (n === 2) return 24; if (n === 3) return 30;
  return Math.min(124, Math.round(30 + (n - 3) * 3.2));
}

// build a layout of tiles [{x, z, l}] for level n
export function makeLayout(n, seed) {
  const r = rng(seed * 31 + 7), target = targetTiles(n);
  const fam = n <= 1 ? ['rect'] : n <= 3 ? ['oval', 'diamond', 'rect'] : SHAPE_NAMES;
  let best = null, bestD = 1e9;
  for (let attempt = 0; attempt < 60; attempt++) {
    const shape = fam[Math.floor(r() * fam.length)];
    const maxL = n <= 2 ? 2 : n <= 6 ? 3 : n <= 15 ? 4 : 5;
    const cols = 4 + Math.floor(r() * 5);                 // 4..8 tiles across
    const rows = Math.max(4, Math.min(9, cols + Math.floor(r() * 4) - 1));   // portrait-friendly: about as tall as wide, or taller
    const tiles = buildStack(shape, cols, rows, maxL, r, n);
    if (!tiles) continue;
    let cnt = tiles.length; if (cnt % 2) { tiles.splice(tiles.findIndex(t => t.l === Math.max(...tiles.map(q => q.l))), 1); cnt--; }
    const d = Math.abs(cnt - target) + (cols > 8 ? 99 : 0);
    if (d < bestD) { bestD = d; best = { tiles, shape, cols, rows }; }
    if (d <= 2) break;
  }
  return best;
}

function buildStack(shape, cols, rows, maxL, r, n) {
  const f = SHAPES[shape], tiles = [], key = (x, z, l) => x + ',' + z + ',' + l;
  const has = new Set();
  // layer 0 (full-tile grid, mirrored left/right)
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    const u = cols === 1 ? 0 : (c + 0.5) / cols * 2 - 1, v = rows === 1 ? 0 : (rr + 0.5) / rows * 2 - 1;
    const cm = cols - 1 - c, um = -u;
    if (f(u, v, c, rr) || f(um, v, cm, rr)) { tiles.push({ x: c * 2, z: rr * 2, l: 0 }); has.add(key(c * 2, rr * 2, 0)); }
  }
  if (tiles.length < 8) return null;
  // upper layers: shrink toward the centre; alternate straight stacks and half-offset "bridging" stacks
  let prev = tiles.filter(t => t.l === 0);
  for (let l = 1; l < maxL; l++) {
    const off = (l % 2 === 1) && r() < 0.45 && n > 3;
    const next = [];
    const shrink = 0.78 - l * 0.12 + r() * 0.1;
    for (const t of prev) {
      if (off) {
        // a tile at +1,+1 sits on the four tiles below it
        const x = t.x + 1, z = t.z + 1;
        if (!(has.has(key(t.x + 2, t.z, l - 1)) && has.has(key(t.x, t.z + 2, l - 1)) && has.has(key(t.x + 2, t.z + 2, l - 1)))) continue;
        const u = (x / 2 + 0.5 - cols / 2) / (cols / 2), v = (z / 2 + 0.5 - rows / 2) / (rows / 2);
        if (Math.abs(u) > shrink + 0.1 || Math.abs(v) > shrink + 0.1) continue;
        next.push({ x, z, l });
      } else {
        const u = (t.x / 2 + 0.5 - cols / 2) / (cols / 2), v = (t.z / 2 + 0.5 - rows / 2) / (rows / 2);
        if (Math.abs(u) > shrink || Math.abs(v) > shrink) continue;
        // keep only well-supported tiles: all four neighbours below exist (prevents lonely towers)
        const nb = [[-2, 0], [2, 0], [0, -2], [0, 2]].filter(([a, b]) => has.has(key(t.x + a, t.z + b, l - 1))).length;
        if (nb < 3) continue;
        next.push({ x: t.x, z: t.z, l });
      }
    }
    // mirror-symmetrise (remove tiles whose mirror is missing)
    const W = (cols - 1) * 2, nset = new Set(next.map(t => key(t.x, t.z, t.l)));
    const sym = next.filter(t => nset.has(key(W - t.x, t.z, t.l)));
    if (sym.length < 2) break;
    for (const t of sym) { tiles.push(t); has.add(key(t.x, t.z, t.l)); }
    prev = sym;
  }
  return tiles;
}

// ---------------------------------------------------------------- free rule
export function computeFree(tiles, alive) {
  // tiles: [{x,z,l}], alive: bool array. returns bool array free[i]
  const n = tiles.length, free = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    const a = tiles[i]; let top = false, left = false, right = false;
    for (let j = 0; j < n && !top; j++) {
      if (j === i || !alive[j]) continue; const b = tiles[j];
      const dz = Math.abs(b.z - a.z); if (dz >= 2) continue;
      if (b.l === a.l + 1) { if (Math.abs(b.x - a.x) < 2) top = true; }
      else if (b.l === a.l) { if (b.x - a.x === 2) right = true; else if (a.x - b.x === 2) left = true; }
    }
    free[i] = !top && (!left || !right);
  }
  return free;
}

// play the given tile positions backwards: returns pairs [[i, j], ...] in a valid removal order, or null
export function reversePairs(tiles, alive, r) {
  const al = alive.slice(), pairs = [];
  let left = al.filter(Boolean).length;
  while (left > 0) {
    const fr = computeFree(tiles, al); const ids = []; for (let i = 0; i < fr.length; i++) if (fr[i]) ids.push(i);
    if (ids.length < 2) return null;
    // prefer pairs that are not side by side, so matches are spread over the board
    shuffleA(ids, r);
    let a = ids[0], b = ids[1];
    for (let k = 1; k < Math.min(ids.length, 6); k++) { const t1 = tiles[a], t2 = tiles[ids[k]]; if (Math.abs(t1.x - t2.x) + Math.abs(t1.z - t2.z) > 4) { b = ids[k]; break; } }
    pairs.push([a, b]); al[a] = false; al[b] = false; left -= 2;
  }
  return pairs;
}

// choose symbol kinds for a level and give every pair one (pairs of the same kind come in 2s or 4s)
export function dealSymbols(pairs, n, r, { kinds, treasure = 0, pool = null } = {}) {
  const P = pairs.length;
  const K = Math.max(2, Math.min(kinds, P - treasure));
  const avail = pool || [...Array(Math.min(KINDS, K + 6)).keys()];
  const kindsUsed = shuffleA(avail.slice(), r).slice(0, K);
  const list = [];
  for (let i = 0; i < treasure; i++) list.push(TREASURE);
  let k = 0; while (list.length < P) { list.push(kindsUsed[k % K]); k++; }
  shuffleA(list, r);
  const sym = {};
  pairs.forEach(([a, b], i) => { sym[a] = list[i]; sym[b] = list[i]; });
  return sym;
}

// re-deal the alive tiles so that the board is solvable again; keeps the multiset of symbols.
export function reshuffle(tiles, alive, symOf, r) {
  const groups = {};
  for (let i = 0; i < tiles.length; i++) if (alive[i]) (groups[symOf[i]] = groups[symOf[i]] || []).push(i);
  const pairSyms = []; for (const s in groups) for (let k = 0; k + 1 < groups[s].length; k += 2) pairSyms.push(+s);
  for (let tries = 0; tries < 80; tries++) {
    const pairs = reversePairs(tiles, alive, r); if (!pairs) continue;
    shuffleA(pairSyms, r); const sym = {};
    pairs.forEach(([a, b], i) => { sym[a] = pairSyms[i]; sym[b] = pairSyms[i]; });
    return { sym, pairs };
  }
  return null;    // structurally stuck (e.g. a lone two-tile tower): caller re-lays the tiles flat
}

// all currently matchable pairs [[i, j], ...]
export function freePairs(tiles, alive, symOf) {
  const fr = computeFree(tiles, alive), by = {};
  for (let i = 0; i < tiles.length; i++) if (fr[i]) (by[symOf[i]] = by[symOf[i]] || []).push(i);
  const out = []; for (const s in by) { const g = by[s]; for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) out.push([g[a], g[b]]); }
  return { free: fr, pairs: out };
}

// is the current position solvable? bounded depth-first search (used by the hint + bot; gives up after a budget)
export function solve(tiles, alive, symOf, budget = 4000) {
  const al = alive.slice(); let steps = 0; const seen = new Set();
  const path = [];
  function rec() {
    if (++steps > budget) return null;
    let any = false; for (const v of al) if (v) { any = true; break; }
    if (!any) return true;
    const k = al.map(v => v ? 1 : 0).join(''); if (seen.has(k)) return false; seen.add(k);
    const { pairs } = freePairs(tiles, al, symOf);
    if (!pairs.length) return false;
    // heuristic order: pairs that free the most tiles first, prefer higher layers
    pairs.sort((p, q) => (tiles[q[0]].l + tiles[q[1]].l) - (tiles[p[0]].l + tiles[p[1]].l));
    for (const [a, b] of pairs.slice(0, 6)) {
      al[a] = al[b] = false; path.push([a, b]);
      const res = rec(); if (res) return true;
      al[a] = al[b] = true; path.pop(); if (res === null) return null;
    }
    return false;
  }
  const ok = rec();
  return ok ? path : ok;   // path | false (proved stuck) | null (unknown)
}

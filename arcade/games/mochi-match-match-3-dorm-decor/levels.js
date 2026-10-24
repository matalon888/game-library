// Mochi Match levels: seeded board shape, colours, moves, goals, gift boxes (1–3 layers) and jelly ice.
// Difficulty is a sawtooth: levels 1–5 are near-certain wins (tutorial), then each block of 6 goes
// easy → normal → normal → breather → normal → HARD (short: fewer moves, fewer goals). Never a wall.
// Every number below was tuned with the headless bot sim (scratchpad sim.mjs), see README.
import { rng } from './kit/hc.js';

// rows of 8 chars, '.' playable, ' ' gap. Every column stays one contiguous run (pieces fall straight down).
const SHAPES = {
  full: ['........', '........', '........', '........', '........', '........', '........', '........'],
  pill: [' ...... ', '........', '........', '........', '........', '........', '........', ' ...... '],
  tall: ['........', '........', '........', '........', '........', '........', '........', '........', '........'],
  heart: [' ..  .. ', '........', '........', '........', '........', '........', ' ...... ', '  ....  '],
  cup: ['........', '........', '........', '........', '........', '........', ' ...... ', '  ....  '],
  bunny: ['.. .. ..', '........', '........', '........', '........', '........', '........', '........'],
  cloud: ['  ....  ', ' ...... ', '........', '........', '........', '........', '........', '........'],
};
const SHAPE_ROT = ['pill', 'heart', 'full', 'cup', 'bunny', 'cloud', 'tall'];
// smaller / gappier boards cascade less: their goals shrink (measured with the sim)
const SHAPE_K = { full: 1.12, tall: 1.12, pill: 1.05, cloud: 0.85, heart: 0.86, bunny: 0.86, cup: 0.86 };

// gift box / ice patterns
const PAT = {
  band: (W, H, r) => { const y = H - 2 - ((r() * 2) | 0); return Array.from({ length: W }, (_, x) => [x, y]); },
  bottom2: (W, H) => { const o = []; for (let y = H - 2; y < H; y++) for (let x = 0; x < W; x++) o.push([x, y]); return o; },
  corners: (W, H) => [[0, H - 1], [1, H - 1], [0, H - 2], [W - 1, H - 1], [W - 2, H - 1], [W - 1, H - 2]],
  pillars: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) o.push([2, y], [W - 3, y]); return o; },
  center: (W, H) => { const o = []; for (let y = H - 5; y < H - 2; y++) for (let x = 2; x < W - 2; x++) o.push([x, y]); return o; },
  vee: (W, H) => { const o = []; for (let x = 0; x < W; x++) o.push([x, H - 1 - Math.min(x, W - 1 - x) % 4]); return o; },
  checker: (W, H) => { const o = []; for (let y = H - 4; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2) o.push([x, y]); return o; },
  smile: (W, H) => [[2, H - 5], [W - 3, H - 5], [1, H - 3], [W - 2, H - 3], [2, H - 2], [3, H - 2], [4, H - 2], [W - 3, H - 2]],
};

// position in the 6-level sawtooth (levels 6+): pressure multiplier on goals per move
const SAW = [0.8, 0.95, 1.0, 0.82, 1.02, 1.0];
export const isHard = n => n >= 6 && (n - 6) % 6 === 5;            // 11, 17, 23, … (~1 in 6)

/**
 * makeLevel(n, fk = flow multiplier, seed = daily seed or null, opts = { daily })
 * returns { n, W, H, mask, crate, ice, colors, moves, goals: [{k:'color',c,n}|{k:'crate',n}|{k:'ice',n}], hard, seed }
 */
export function makeLevel(n, fk = 1, seed = null, { daily = false } = {}) {
  const mix = v => { v = Math.imul(v ^ (v >>> 16), 0x45d9f3b); v = Math.imul(v ^ (v >>> 16), 0x45d9f3b); return ((v ^ (v >>> 16)) >>> 0) % 2147483646 + 1; };
  const r = rng(seed != null ? mix(seed) : n * 7919 + 4243);
  const hard = !daily && isHard(n);
  const tier = Math.min(1, Math.max(0, (n - 6) / 60));          // slow ramp across the first 66 levels
  const tut = n <= 5 && !daily;
  const colors = tut ? (n <= 3 ? 4 : 5) : hard ? 5 : (n % 4 === 2 ? 6 : 5);
  const sk = tut ? (n === 5 ? 'pill' : 'full') : daily ? SHAPE_ROT[(r() * SHAPE_ROT.length) | 0] : SHAPE_ROT[(n + ((r() * 2) | 0)) % SHAPE_ROT.length];
  const shape = SHAPES[sk], H = shape.length, W = 8;
  const mask = shape.map(row => [...row].map(ch => ch === '.'));
  const crate = mask.map(row => row.map(() => 0)), ice = mask.map(row => row.map(() => 0));
  const goals = [];
  const place = (grid, kinds, maxLayer, minLayer = 1) => {
    const k = kinds[(r() * kinds.length) | 0]; let cnt = 0, hits = 0;
    for (const [x, y] of PAT[k](W, H, r)) { if (y < 2 || !mask[y]?.[x] || crate[y][x] || ice[y][x]) continue; const l = minLayer + Math.floor(r() * (maxLayer - minLayer + 1)); grid[y][x] = l; cnt++; hits += l; }
    return { cnt, hits };
  };

  // ---- tutorial: 1 colour goal → 2 colour goals → gift boxes → jelly ice
  if (tut) {
    let moves = [0, 20, 20, 20, 22, 22][n];
    if (n === 1) goals.push({ k: 'color', c: 0, n: 12 });
    if (n === 2) goals.push({ k: 'color', c: 1, n: 10 }, { k: 'color', c: 2, n: 10 });
    if (n === 3) goals.push({ k: 'color', c: 3, n: 14 });
    if (n === 4) { const g = place(crate, ['corners'], 1); goals.push({ k: 'crate', n: g.cnt }, { k: 'color', c: 0, n: 10 }); }
    if (n === 5) { const g = place(ice, ['center'], 1); goals.push({ k: 'ice', n: g.cnt }); }
    return { n, W, H, mask, crate, ice, colors, moves, goals, hard: false, shape: sk, seed: Math.floor(r() * 1e9) };
  }

  // ---- regular / hard / daily
  const pos = daily ? 2 : (n - 6) % 6;
  const press = (daily ? 1.12 : SAW[pos]) * (1 + tier * 0.22) * SHAPE_K[sk] * fk;
  let moves = hard ? 17 + ((r() * 3) | 0) : 22 + ((r() * 5) | 0);
  const budget = moves * (hard ? (globalThis.KH || 3.8) : (globalThis.KN || 2.8)) * press;               // "goal units" the level asks for
  const useCrate = n === 6 || r() < 0.6, useIce = n >= 7 && r() < (useCrate ? 0.35 : 0.65);
  let used = 0;
  if (useCrate) {
    const layers = n < 12 ? 1 : n < 30 ? 2 : 3, CC = 1.5;              // each gift layer costs ~1.5 goal units
    place(crate, ['band', 'corners', 'pillars', 'vee', 'smile', 'band'], layers);
    const cells = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (crate[y][x]) cells.push([x, y]);
    const hits = () => cells.reduce((a, [x, y]) => a + crate[y][x], 0);
    // never a wall: thin the gifts until they take at most ~60% of the level
    for (let g = 0; g < 200 && (hits() * CC > budget * 0.6 || cells.length > 12); g++) {
      const thick = cells.filter(([x, y]) => crate[y][x] > 1);
      if (thick.length) { const [x, y] = thick[(r() * thick.length) | 0]; crate[y][x]--; }
      else if (cells.length > 4 || cells.length > 12) { const [x, y] = cells.splice((r() * cells.length) | 0, 1)[0]; crate[y][x] = 0; }
      else break;
    }
    if (cells.length) { goals.push({ k: 'crate', n: cells.length }); used += hits() * CC; }
  }
  if (useIce) {
    const g = place(ice, ['center', 'checker', 'band', 'smile'], 1);
    if (g.cnt) { goals.push({ k: 'ice', n: g.cnt }); used += g.cnt * 1.25; }
  }
  const left = Math.max(budget * 0.35, budget - used);
  const nColor = goals.length >= 2 ? 1 : goals.length === 1 ? (hard ? 1 : 1 + (r() < 0.45 ? 1 : 0)) : (hard ? 2 : 2 + (r() < 0.3 ? 1 : 0));
  const pick = new Set();
  for (let i = 0; i < nColor; i++) {
    let c; do { c = (r() * colors) | 0; } while (pick.has(c)); pick.add(c);
    const cost = (colors === 6 ? 1.5 : colors === 4 ? 0.8 : 1) * (nColor === 1 ? 1.3 : nColor === 3 ? 0.92 : 1);
    goals.push({ k: 'color', c, n: Math.max(6, Math.round(left / nColor / cost / 2) * 2) });
  }
  return { n, W, H, mask, crate, ice, colors, moves, goals, hard, shape: sk, seed: Math.floor(r() * 1e9) };
}

// a level card's "how hard" label for the map + popup
export const levelTag = n => n <= 5 ? '' : isHard(n) ? 'HARD' : '';

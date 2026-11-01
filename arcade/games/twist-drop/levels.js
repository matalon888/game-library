// Twist Drop v2: 30 authored towers in 3 worlds + a Daily Tower.
// A level is a list of motifs (hand-picked, in order). A motif makes rings of 12 slices:
//   '.' safe  '_' gap  'x' dark  'c' crumble (bounce once, then it breaks into a hole)  'z' blinker (dark while lit)  'b' bumper (big bounce)
// Every level holds 3 gems (in gaps, ring indices in `gems`, fractions of the tower by default). Stars: 1 clear, 2 = 2 gems, 3 = 3 gems.
export const SEG = 12;
export const WORLDS = [
  { name: 'Candy Tower', icon: '🍭', from: 1, to: 10, pal: 0 },
  { name: 'Frost Tower', icon: '❄️', from: 11, to: 20, pal: 4 },
  { name: 'Neon Tower', icon: '🌃', from: 21, to: 30, pal: 2 },
];
const mod = (a) => ((a % SEG) + SEG) % SEG;
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function ring(gapAt, gapW, over = {}, spin = 0) {
  const k = new Array(SEG).fill('.');
  for (let i = 0; i < gapW; i++) k[mod(gapAt + i)] = '_';
  for (const [i, c] of Object.entries(over)) if (k[mod(+i)] === '.') k[mod(+i)] = c;
  return { k: k.join(''), spin };
}
// motif library: (n, a, b, r) -> rings ; r is the level's seeded random
const M = {
  warm: (n, w, _b, r) => Array.from({ length: n }, () => ring(Math.floor(r() * SEG), w)),
  stair: (n, w, step, r) => { let p = Math.floor(r() * SEG); return Array.from({ length: n }, () => ring(p = mod(p + step), w)); },
  zig: (n, w, span, r) => { const p = Math.floor(r() * SEG); return Array.from({ length: n }, (_, i) => ring(p + (i % 2 ? span : 0), w)); },
  // dots: gap + d dark slices spread over the rest
  dots: (n, w, d, r) => Array.from({ length: n }, () => { const g = Math.floor(r() * SEG), o = {}; for (let i = 0; i < d; i++) o[g + w + 1 + Math.floor(r() * (SEG - w - 1))] = 'x'; return ring(g, w, o); }),
  // wall: a run of 4 dark slices straight opposite the gap, so the safe bounce spots are the thin ones next to the gap
  wall: (n, w, _b, r) => Array.from({ length: n }, () => { const g = Math.floor(r() * SEG), o = {}; for (let i = 0; i < 4; i++) o[g + w + 2 + i] = 'x'; return ring(g, w, o); }),
  // pinch: gap 1 wide, everything else dark except two safe landing slices on each side (precision)
  pinch: (n, _a, _b, r) => Array.from({ length: n }, () => { const g = Math.floor(r() * SEG), o = {}; for (let i = 2; i <= 9; i++) o[g + i] = 'x'; return ring(g, 1, o); }),
  crumb: (n, w, _b, r) => Array.from({ length: n }, () => { const g = Math.floor(r() * SEG), o = {}; for (let i = 0; i < 4; i++) o[g + w + i] = 'c'; return ring(g, w, o); }),
  spin: (n, w, sp, r) => Array.from({ length: n }, (_, i) => ring(Math.floor(r() * SEG), w, {}, sp * (i % 2 ? -1 : 1))),
  blink: (n, w, d, r) => Array.from({ length: n }, () => { const g = Math.floor(r() * SEG), o = {}; for (let i = 0; i < d; i++) o[g + w + i] = 'z'; return ring(g, w, o); }),
  bump: (n, w, _b, r) => Array.from({ length: n }, (_, i) => { const g = Math.floor(r() * SEG), o = {}; if (i % 2 === 0) o[g + w + 3] = 'b'; return ring(g, w, o); }),
  // mix: dark + crumble + blink on every ring (world 3 final exams)
  mix: (n, w, d, r) => Array.from({ length: n }, (_, i) => { const g = Math.floor(r() * SEG), o = {}; for (let j = 0; j < d; j++) o[g + w + 1 + Math.floor(r() * (SEG - w - 1))] = ['x', 'c', 'z'][(i + j) % 3]; return ring(g, w, o, i % 3 === 2 ? 0.012 : 0); }),
};
const L = (why, parts, extra = {}) => ({ why, parts, gems: [0.3, 0.6, 0.88], ...extra });
export const LEVELS = [
  // ---- World 1: Candy Tower (twist -> gaps; dark slices; fire streak; first gems)
  L('intro: wide gaps only, cannot be lost; fall through 3 rings in a row and the ball catches fire', [['warm', 8, 4]], { gems: [0.4, 0.65, 0.9] }),
  L('tiny decision: the gap steps round the tower, follow it', [['stair', 9, 3, 2]]),
  L('first dark slices: the first level that can be lost, and you can see why', [['warm', 3, 3], ['dots', 7, 3, 2]]),
  L('practise dark slices, then a taste of cracking ice', [['dots', 8, 2, 3], ['crumb', 3, 3]]),
  L('introduce the zig: gap swings across the tower, plan the twist in the air, then a first springy bumper', [['zig', 4, 3, 6], ['bump', 4, 3], ['dots', 4, 3, 2]]),
  L('fire streak level: wide gaps in long runs so you can reach ON FIRE and smash a dark ring', [['warm', 6, 3], ['dots', 2, 3, 4], ['warm', 6, 3], ['dots', 2, 3, 5]]),
  L('walls: a dark run opposite the gap, stay on the thin safe slices', [['wall', 8, 3]]),
  L('gems tucked beside walls: take the risk for 3 stars', [['stair', 4, 3, 3], ['wall', 6, 2], ['dots', 4, 2, 4]], { gems: [0.25, 0.5, 0.78] }),
  L('hard: every ring has dark slices and 2-wide gaps', [['dots', 8, 2, 4], ['wall', 4, 2], ['dots', 6, 2, 5]], { hard: true }),
  L('BOSS: all of world 1, then a long fire run to finish', [['dots', 6, 2, 4], ['wall', 4, 2], ['zig', 4, 2, 6], ['warm', 6, 3], ['dots', 4, 2, 5]], { boss: true }),
  // ---- World 2: Frost Tower (crumbling ice, spinning rings)
  L('breather + introduce ice: the pale slices crack when you land, the second bounce falls through', [['crumb', 8, 2]]),
  L('practise ice with wide gaps', [['crumb', 6, 3], ['warm', 3, 3], ['crumb', 4, 2]]),
  L('ice and dark slices together: dark ones never crack', [['crumb', 4, 2], ['dots', 6, 2, 3]]),
  L('introduce spinners: the ring turns by itself, time your drop', [['spin', 8, 3, 0.008]]),
  L('practise spinners, a ring turns each way', [['warm', 2, 3], ['spin', 8, 3, 0.012]]),
  L('twist: spinning rings with dark slices', [['spin', 4, 3, 0.01], ['dots', 4, 2, 3], ['spin', 4, 3, 0.012]]),
  L('gems on ice: break the ice to reach them', [['crumb', 4, 2], ['stair', 4, 2, 4], ['crumb', 4, 2]], { gems: [0.2, 0.5, 0.8] }),
  L('walls of ice: dark run + pale slices around the gap', [['wall', 4, 2], ['crumb', 6, 2], ['wall', 4, 2]]),
  L('hard: narrow spinners among ice', [['spin', 6, 2, 0.015], ['crumb', 6, 2], ['spin', 4, 2, 0.018]], { hard: true }),
  L('BOSS: ice, spinners, dark walls, then a 1-wide finish gauntlet', [['crumb', 4, 2], ['spin', 4, 2, 0.015], ['wall', 4, 2], ['pinch', 3], ['spin', 4, 3, 0.012]], { boss: true }),
  // ---- World 3: Neon Tower (bumpers, blinking dark slices, the mixes)
  L('breather + introduce bumpers: the springy pad throws you high, get a long look at what is coming', [['bump', 8, 3]]),
  L('practise bumpers with dark slices', [['bump', 4, 3], ['dots', 6, 2, 3]]),
  L('introduce blinkers: slices that are dark only while lit, wait for the dim', [['blink', 8, 3, 3]]),
  L('blinkers and bumpers: bounce high, read the lights', [['bump', 4, 2], ['blink', 6, 3, 3]]),
  L('blinkers on spinning rings', [['spin', 3, 3, 0.01], ['blink', 4, 3, 4], ['spin', 3, 3, 0.012]]),
  L('precision: 1-wide gaps between dark slices', [['pinch', 6], ['warm', 2, 3], ['pinch', 4]], { gems: [0.3, 0.6, 0.85] }),
  L('the mix: dark, ice and blinkers on every ring', [['mix', 10, 3, 3]]),
  L('breather: wide gaps and bumpers, all three gems out in the open (a power level after the pinch and the mix)', [['bump', 6, 4], ['warm', 6, 4]], { gems: [0.2, 0.5, 0.8] }),
  L('hard: the mix with 2-wide gaps and fast spinners', [['mix', 6, 2, 4], ['spin', 4, 2, 0.02], ['mix', 4, 2, 4]], { hard: true }),
  L('FINAL BOSS: every element in a row, one long tower', [['bump', 3, 3], ['crumb', 3, 2], ['spin', 3, 2, 0.015], ['blink', 3, 2, 4], ['pinch', 3], ['mix', 5, 2, 4], ['warm', 3, 3]], { boss: true }),
];
export function levelRows(idx) {   // 1-based level -> { rows, gems:Set<ringIndex> }
  const lv = LEVELS[idx - 1], r = rng(idx * 7919 + 13);
  const rows = []; for (const [name, n, a, b] of lv.parts) rows.push(...M[name](n, a, b, r));
  return finish(rows, lv.gems, r);
}
function finish(rows, gems, r) {
  const gi = new Set(gems.map(f => Math.min(rows.length - 1, Math.max(1, Math.floor(f * rows.length)))));
  for (const i of gi) { const k = rows[i].k; const g = k.indexOf('_'); rows[i] = { ...rows[i], gem: g }; }
  return { rows, gems: gi };
}
// Daily Tower: same for everyone each day; 16 rings of motifs from every world
export function dailyRows(dateStr) {
  let h = 7; for (const ch of dateStr) h = (h * 31 + ch.charCodeAt(0)) % 2147483000; const r = rng(h + 1);
  const pool = [['dots', 4, 2, 3], ['wall', 3, 3], ['crumb', 4, 2], ['spin', 4, 3, 0.012], ['blink', 4, 3, 3], ['bump', 4, 3], ['zig', 4, 3, 6], ['stair', 4, 3, 3], ['pinch', 3]];
  const parts = [['warm', 2, 4]]; for (let i = 0; i < 4; i++) parts.push(pool[Math.floor(r() * pool.length)]);
  const rows = []; for (const [name, n, a, b] of parts) rows.push(...M[name](n, a, b, r));
  return finish(rows, [0.35, 0.6, 0.85], r);
}
export function validate() {   // every ring has a gap; no ring is fully dark; 3 gems, each in a gap ring
  const bad = [];
  const chk = (id, o) => { o.rows.forEach((rw, i) => { if (!rw.k.includes('_')) bad.push(id + ' ring ' + i + ' no gap'); if (rw.k.length !== SEG) bad.push(id + ' ring ' + i + ' len'); });
    if (o.gems.size !== 3) bad.push(id + ' gems ' + o.gems.size); };
  for (let i = 1; i <= LEVELS.length; i++) chk('L' + i, levelRows(i));
  chk('daily', dailyRows('2026-10-31'));
  return bad;
}

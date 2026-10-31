// Glow Keys deep v2: 33 hand-arranged levels in 3 worlds. Every level = a song, a length in seconds, a tempo and the rules on.
// song: id from _music/songs.js · sec: target length · tempo: speed of the song · look: seconds a tile takes to fall (bigger = easier)
// long: hold tiles on · dbl: share of beats that get a second tile (play both) · gold: golden tiles (gems) · ghost: share of tiles that fade
// near the line · hearts: misses allowed + 1 · hard: boss/spike level (red badge, double gems).
export const WORLDS = [
  { name: 'Lantern Lane', from: 1, to: 11, theme: 0, blurb: 'tap · hold' },
  { name: 'Neon Alley', from: 12, to: 22, theme: 2, blurb: 'two at once' },
  { name: 'Starlight Stage', from: 23, to: 33, theme: 4, blurb: 'ghost tiles' },
];
export const LEVELS = [
  // ---- world 1: one verb (tap the dark tile), then holds ----
  { song: 'twinkle', sec: 12, tempo: 1.0, look: 1.9, hearts: 3, why: 'tap the dark tiles; cannot be lost' },
  { song: 'ode', sec: 16, tempo: 1.0, look: 1.8, hearts: 3, why: 'tiles hop between lanes' },
  { song: 'minuet', sec: 18, tempo: 0.85, look: 1.7, hearts: 3, why: 'waltz rhythm; first level you can lose' },
  { song: 'saints', sec: 20, tempo: 1.05, look: 1.6, hearts: 3, gold: 1, why: 'introduce golden tiles (gems)' },
  { song: 'canon', sec: 22, tempo: 1.0, look: 1.6, hearts: 3, gold: 2, why: 'slow and flowing: breathe' },
  { song: 'elise', sec: 22, tempo: 0.9, look: 1.5, hearts: 3, gold: 2, why: 'quick runs: first spike' },
  { song: 'ode', sec: 24, tempo: 1.1, look: 1.5, hearts: 3, long: true, why: 'introduce HOLD tiles: press and keep pressing' },
  { song: 'twinkle', sec: 24, tempo: 1.1, look: 1.5, hearts: 3, long: true, why: 'practise holds on a song you know' },
  { song: 'canon', sec: 28, tempo: 1.1, look: 1.45, hearts: 3, long: true, gold: 3, why: 'holds + golden tiles' },
  { song: 'saints', sec: 30, tempo: 1.15, look: 1.4, hearts: 2, long: true, gold: 2, hard: true, why: 'BOSS: fast march with holds' },
  { song: 'minuet', sec: 24, tempo: 0.85, look: 1.7, hearts: 3, long: true, gold: 6, why: 'breather: a shower of gold' },
  // ---- world 2: two tiles at once ----
  { song: 'neon', sec: 20, tempo: 1.05, look: 1.55, hearts: 3, long: true, dbl: 0.12, why: 'introduce DOUBLE tiles: tap both with two fingers' },
  { song: 'starlight', sec: 22, tempo: 1.05, look: 1.5, hearts: 3, long: true, dbl: 0.15, why: 'practise doubles' },
  { song: 'cancan', sec: 22, tempo: 1.0, look: 1.5, hearts: 3, long: true, dbl: 0.2, gold: 2, why: 'galop: doubles on the beat' },
  { song: 'mountain', sec: 24, tempo: 1.0, look: 1.45, hearts: 3, long: true, dbl: 0.2, why: 'the song speeds up as it climbs' },
  { song: 'turkish', sec: 24, tempo: 1.0, look: 1.45, hearts: 3, long: true, dbl: 0.2, gold: 3, why: 'march with doubles and gold' },
  { song: 'elise', sec: 28, tempo: 1.1, look: 1.4, hearts: 3, long: true, dbl: 0.25, why: 'doubles inside quick runs' },
  { song: 'neon', sec: 30, tempo: 1.15, look: 1.4, hearts: 3, long: true, dbl: 0.25, gold: 2, why: 'long set: stay in rhythm' },
  { song: 'ode', sec: 30, tempo: 1.2, look: 1.35, hearts: 3, long: true, dbl: 0.3, gold: 3, why: 'a known song at a new speed' },
  { song: 'starlight', sec: 32, tempo: 1.15, look: 1.35, hearts: 3, long: true, dbl: 0.3, why: 'holds and doubles together' },
  { song: 'mountain', sec: 34, tempo: 1.25, look: 1.3, hearts: 2, long: true, dbl: 0.3, gold: 3, hard: true, why: 'BOSS: the mountain king, fast' },
  { song: 'canon', sec: 26, tempo: 1.1, look: 1.5, hearts: 3, long: true, dbl: 0.2, gold: 6, why: 'breather: smooth canon, lots of gold' },
  // ---- world 3: ghost tiles fade as they near the line, so play it by rhythm ----
  { song: 'cancan', sec: 24, tempo: 1.15, look: 1.45, hearts: 3, long: true, dbl: 0.1, ghost: 0.25, why: 'introduce GHOST tiles: they fade, keep the beat' },
  { song: 'saints', sec: 26, tempo: 1.2, look: 1.4, hearts: 3, long: true, dbl: 0.15, ghost: 0.3, why: 'practise ghosts on a steady march' },
  { song: 'turkish', sec: 28, tempo: 1.2, look: 1.4, hearts: 3, long: true, dbl: 0.15, ghost: 0.3, gold: 3, why: 'ghosts + a driving beat' },
  { song: 'elise', sec: 30, tempo: 1.25, look: 1.35, hearts: 3, long: true, dbl: 0.2, ghost: 0.35, why: 'ghost holds' },
  { song: 'neon', sec: 32, tempo: 1.3, look: 1.3, hearts: 3, long: true, dbl: 0.25, ghost: 0.35, gold: 3, why: 'all the rules on' },
  { song: 'minuet', sec: 30, tempo: 1.35, look: 1.3, hearts: 3, long: true, dbl: 0.2, ghost: 0.4, why: 'a gentle waltz, played fast' },
  { song: 'starlight', sec: 36, tempo: 1.3, look: 1.3, hearts: 3, long: true, dbl: 0.3, ghost: 0.4, why: 'endurance' },
  { song: 'mountain', sec: 38, tempo: 1.4, look: 1.25, hearts: 2, long: true, dbl: 0.3, ghost: 0.45, gold: 3, hard: true, why: 'BOSS: ghost mountain' },
  { song: 'ode', sec: 30, tempo: 1.3, look: 1.4, hearts: 3, long: true, dbl: 0.25, ghost: 0.25, gold: 8, why: 'breather: joyful and golden' },
  { song: 'cancan', sec: 40, tempo: 1.45, look: 1.25, hearts: 2, long: true, dbl: 0.35, ghost: 0.5, gold: 3, hard: true, why: 'BOSS: the fastest galop' },
  { song: 'twinkle', sec: 40, tempo: 1.35, look: 1.3, hearts: 2, long: true, dbl: 0.4, ghost: 0.5, gold: 10, hard: true, why: 'GRAND FINALE: the first song, grown up' },
];
/** level n (1-based). After 33: the authored levels again, a bit faster each lap. */
export function levelOf(n) {
  if (n <= LEVELS.length) return LEVELS[n - 1];
  const lap = Math.floor((n - 1) / LEVELS.length), b = LEVELS[(n - 1) % LEVELS.length];
  return { ...b, tempo: Math.min(1.5, b.tempo + 0.04 * lap), hearts: Math.max(2, b.hearts - (lap > 1 ? 1 : 0)), ghost: Math.max(b.ghost || 0, 0.2), why: 'lap ' + (lap + 1) };
}
export const worldOf = (n) => { const m = (n - 1) % LEVELS.length + 1; return WORLDS.findIndex(w => m >= w.from && m <= w.to); };
export const SKINS = [   // tile colours (top → bottom of a tile) unlocked by total stars
  { id: 'night', name: 'Night', a: '#252a66', b: '#020208', need: 0 },
  { id: 'rose', name: 'Rose', a: '#7a2a5c', b: '#14030e', need: 8 },
  { id: 'mint', name: 'Mint', a: '#1f6a60', b: '#021412', need: 20 },
  { id: 'amber', name: 'Amber', a: '#8a5a14', b: '#160d00', need: 40 },
  { id: 'prism', name: 'Prism', a: '#7a2ad0', b: '#06304a', need: 65 },
];
/** the daily melody: same for everyone today */
export function dailyOf(dayNum) {
  const ids = ['twinkle', 'ode', 'minuet', 'saints', 'canon', 'elise', 'cancan', 'neon', 'mountain', 'starlight', 'turkish'];
  const s = ids[dayNum % ids.length], k = (dayNum * 7) % 5;
  return { song: s, sec: 26 + k * 2, tempo: 1.1 + k * 0.05, look: 1.45, hearts: 3, long: true, dbl: 0.15 + k * 0.04, gold: 3, ghost: k > 2 ? 0.25 : 0, why: 'daily melody' };
}

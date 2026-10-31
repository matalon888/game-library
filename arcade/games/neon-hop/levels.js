// Neon Hop v2 — 36 authored levels in 3 worlds. Every level asks ONE thing (the `why` line); the sawtooth is
// teach -> practise -> twist -> HARD -> breather. Fields (all optional but song/sec):
//   song  song id from _music/songs.js        sec   target length in seconds (rounded to whole 4-bar phrases)
//   tempo speed of the song (1 = written)      gap   shortest time between tiles (s, before the flow multiplier)
//   dx    widest sideways step between tiles   w     tile width (1 = normal, 2 = double)
//   gem   chance a tile carries a gem          mv    chance a tile slides side to side
//   zig   force left-right-left stepping       ice   steering slides on (0..1)
//   fork  chance a beat offers TWO tiles (either one is safe; the gem tile sits on the far side)
//   hard  red HARD badge, pays a bonus         gift  the clear is always 3 stars (level 1: the big first win)
//   safe  tiles never farther than this from the middle (level 1 cannot be lost)
export const WORLDS = [
  { name: 'Glow Streets', blurb: 'Steer onto every tile', top: '#ff3ea5', tile: '#ff3ea5' },
  { name: 'Drift Lane', blurb: 'Sliding, slim, slippery', top: '#22c8ff', tile: '#22c8ff' },
  { name: 'Storm Deck', blurb: 'Two tiles, you choose', top: '#ffc23d', tile: '#ffc23d' },
];
export const LEVELS = [
  // ---- World 1: Glow Streets (the core verb: drag to put the ball on the next tile)
  { song: 'twinkle', sec: 20, tempo: 0.95, w: 2.0, dx: 0.7, safe: 0.8, gem: 0, gift: true, why: 'Just ride: huge tiles in the middle, cannot be lost' },
  { song: 'ode', sec: 22, tempo: 0.95, w: 1.6, dx: 1.3, gem: 0.3, why: 'Gems appear: drift over to grab them' },
  { song: 'neon', sec: 26, tempo: 1.0, w: 1.15, dx: 2.0, gem: 0.2, why: 'First real misses: normal tiles, wider steps' },
  { song: 'saints', sec: 26, tempo: 1.0, w: 1.1, dx: 2.2, zig: true, why: 'Zig-zag: left, right, left to the march' },
  { song: 'minuet', sec: 28, tempo: 1.0, w: 1.1, dx: 2.0, gem: 0.3, why: 'Waltz time: three beats to a bar' },
  { song: 'canon', sec: 30, tempo: 1.0, w: 1.0, dx: 2.4, gem: 0.25, why: 'Slow and wide: big sweeps, time to land centre' },
  { song: 'starlight', sec: 30, tempo: 1.0, w: 1.0, dx: 2.4, zig: true, why: 'Twist: zig-zag at a brisker pace' },
  { song: 'cancan', sec: 30, tempo: 1.0, gap: 0.3, w: 1.0, dx: 2.0, why: 'Galop: the quick one, shorter hops' },
  { song: 'ode', sec: 32, tempo: 1.05, w: 0.95, dx: 2.5, gem: 0.45, why: 'Gem rush: greedy gems pull you to the edges' },
  { song: 'elise', sec: 34, tempo: 1.0, w: 0.95, dx: 2.3, zig: true, gem: 0.3, why: 'Waltz meets zig-zag' },
  { song: 'mountain', sec: 34, tempo: 1.0, w: 0.9, dx: 2.6, gem: 0.3, hard: true, why: 'HARD: the mountain king stomps faster and wider' },
  { song: 'twinkle', sec: 24, tempo: 1.1, w: 1.6, dx: 1.8, gem: 0.7, why: 'Breather: fat tiles, gems everywhere, feel powerful' },
  // ---- World 2: Drift Lane (tiles move, tiles shrink, the floor goes slippery)
  { song: 'neon', sec: 28, tempo: 1.05, w: 1.3, dx: 1.6, mv: 0.35, why: 'Introduce sliding tiles: aim where they will be' },
  { song: 'starlight', sec: 30, tempo: 1.05, w: 1.15, dx: 2.0, mv: 0.35, gem: 0.2, why: 'Practise sliding tiles at tempo' },
  { song: 'turkish', sec: 30, tempo: 1.0, gap: 0.28, w: 1.15, dx: 1.8, mv: 0.3, why: 'Fast rondo: sliding tiles, sixteenth-note runs' },
  { song: 'saints', sec: 30, tempo: 1.05, w: 0.78, dx: 1.8, gem: 0.2, why: 'Introduce narrow tiles: land them dead-centre' },
  { song: 'canon', sec: 32, tempo: 1.05, w: 0.8, dx: 2.2, mv: 0.25, why: 'Twist: narrow AND sliding, slow song to think' },
  { song: 'ode', sec: 30, tempo: 1.05, w: 1.35, dx: 2.0, ice: 0.55, why: 'Introduce ice: steering slides, start turning early' },
  { song: 'minuet', sec: 32, tempo: 1.05, w: 1.2, dx: 2.2, ice: 0.65, gem: 0.3, why: 'Practise ice with gems to chase' },
  { song: 'cancan', sec: 32, tempo: 1.05, gap: 0.3, w: 0.9, dx: 1.9, ice: 0.55, why: 'Ice at galop speed: small, early nudges' },
  { song: 'elise', sec: 34, tempo: 1.05, w: 0.85, dx: 2.2, mv: 0.35, zig: true, why: 'Twist: slim, sliding, zig-zag waltz' },
  { song: 'mountain', sec: 36, tempo: 1.05, w: 0.8, dx: 2.4, mv: 0.3, ice: 0.5, hard: true, why: 'HARD: ice, sliders and slim tiles together' },
  { song: 'turkish', sec: 28, tempo: 0.95, w: 1.5, dx: 1.8, gem: 0.6, mv: 0.2, why: 'Breather: easy sliders, a gem shower' },
  { song: 'neon', sec: 30, tempo: 1.1, w: 0.9, dx: 2.3, mv: 0.35, ice: 0.4, gem: 0.25, why: 'World 2 finale: a little of everything' },
  // ---- World 3: Storm Deck (a fork in the beat: two tiles, either is safe, the gem sits on the far one)
  { song: 'twinkle', sec: 26, tempo: 1.05, w: 1.3, dx: 1.4, fork: 0.45, why: 'Introduce forks: pick a tile, both are safe' },
  { song: 'ode', sec: 30, tempo: 1.1, w: 1.15, dx: 1.8, fork: 0.5, gem: 0.3, why: 'Practise forks: the gem is on the harder tile' },
  { song: 'neon', sec: 30, tempo: 1.1, w: 1.0, dx: 2.0, fork: 0.45, mv: 0.25, why: 'Forks with sliding tiles' },
  { song: 'saints', sec: 32, tempo: 1.1, w: 1.0, dx: 2.2, fork: 0.5, zig: true, why: 'Twist: a zig-zag where you can cut the corner' },
  { song: 'starlight', sec: 32, tempo: 1.1, w: 1.0, dx: 2.2, fork: 0.45, ice: 0.5, why: 'Forks on ice: pick early, glide in' },
  { song: 'canon', sec: 34, tempo: 1.1, w: 0.8, dx: 2.2, fork: 0.5, gem: 0.3, why: 'Narrow forks: two small targets, one plan' },
  { song: 'cancan', sec: 32, tempo: 1.1, gap: 0.3, w: 0.95, dx: 2.0, fork: 0.5, why: 'Galop forks: decide fast' },
  { song: 'minuet', sec: 34, tempo: 1.1, w: 0.9, dx: 2.2, fork: 0.5, mv: 0.3, ice: 0.4, why: 'Waltz forks, sliding and slippery' },
  { song: 'elise', sec: 36, tempo: 1.1, w: 0.8, dx: 2.3, fork: 0.5, mv: 0.3, gem: 0.3, why: 'Gem hunt on narrow sliding forks' },
  { song: 'turkish', sec: 32, tempo: 1.05, gap: 0.28, w: 0.95, dx: 2.0, fork: 0.5, ice: 0.4, hard: true, why: 'HARD: fast rondo, forks and ice' },
  { song: 'mountain', sec: 38, tempo: 1.1, w: 0.8, dx: 2.5, fork: 0.5, mv: 0.3, ice: 0.4, hard: true, why: 'HARD: the king with every trick' },
  { song: 'starlight', sec: 40, tempo: 1.15, w: 0.9, dx: 2.4, fork: 0.45, mv: 0.25, ice: 0.3, gem: 0.35, hard: true, why: 'Grand finale: full tempo, all the toys' },
];
// after level 36: endless remix, seeded by the level number, using every unlocked toy
export function remix(n, order) {
  const k = n - LEVELS.length, i = (k * 7 + 3) % order.length;
  return { song: order[i], sec: Math.min(48, 34 + k), tempo: Math.min(1.3, 1.12 + k * 0.01), w: Math.max(0.75, 0.95 - k * 0.01), dx: 2.4, fork: 0.4, mv: 0.3, ice: 0.4, gem: 0.3, zig: k % 3 === 0, hard: k % 5 === 4, why: 'Remix ' + (k + 1) };
}
// Daily Jam: today's song and toys, the same for everyone today
export function dailySpec(dayNum, order) {
  const r = (a) => a[(dayNum * 2654435761 >>> 0) % a.length];
  const song = order[dayNum % order.length];
  const toys = [{ mv: 0.35 }, { ice: 0.5 }, { fork: 0.5 }, { zig: true, gem: 0.4 }, { w: 0.8, gem: 0.3 }, { mv: 0.25, fork: 0.35 }, { ice: 0.4, zig: true }];
  const t = toys[dayNum % toys.length];
  return { song, sec: 30 + (dayNum % 4) * 3, tempo: 1.05 + (dayNum % 3) * 0.04, w: 1.0, dx: 2.2, gem: 0.25, ...t, daily: true, why: 'Daily Jam' };
}

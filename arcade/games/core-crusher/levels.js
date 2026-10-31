// Core Crusher v2 — 30 authored towers in 3 worlds + a generator for later ones.
// A level is a list of sections "pattern count@twist": each ring in a section uses the pattern (see PATTERNS in deep.js) and the
// ring's angle spirals by the twist (@0 straight column, @s slow, @f fast, none = medium, @- reverses).
// spin = rad/s of the tower, flip = seconds between spin reversals (0 = never), mercy = free "saved!" bounces on a crash.
// Patterns: open one two three half wide split tri pick gold goldone gap gapx flame steel steels blink blinkb
export const WORLDS = [
  { name: 'CANDY HILL', icon: '🍬', tag: 'black slices · gold · flame', bg: ['#1fc7b6', '#c9fff1'] },
  { name: 'NEON DUNES', icon: '🌵', tag: 'holes · blinkers · reversals', bg: ['#ff6b3d', '#ffd36e'] },
  { name: 'SHADOW CORE', icon: '🌑', tag: 'steel · everything at once', bg: ['#7a4cf0', '#f1b6ff'] },
];
export const LEVELS = [
  // ---- world 1: the verb (hold = smash, release = bounce away from black) + gold + flame
  { n: 'Warm-up', p: 'learn: hold to smash, let go when black comes', spin: 0.8, mercy: 2, sec: 'open6 gold2 open4 one2 open4 one2 open4' },
  { n: 'Two-step', p: 'practice release timing with one and two black', spin: 0.85, mercy: 1, sec: 'open4 gold1 one3 open3 two3 open3 one4 gold2' },
  { n: 'Let go!', p: 'first level you can lose: wider black, shorter safe windows', spin: 0.9, sec: 'open3 one4 two4 gold2 three4 half3 open2 one4' },
  { n: 'Spiral stairs', p: 'danger that drifts: hold in the safe lane', spin: 0.95, sec: 'open3 two5@s one5@s three4@s gold2 half4@s' },
  { n: 'Flame on', p: 'introduce flame slices: smash one, then smash anything', spin: 1.0, sec: 'open3 gold1 flame1 half8 wide8 gold3 open2 half4 flame1 wide6' },
  { n: 'Gold rush', p: 'gold rings pay big: chain them for the combo', spin: 1.0, sec: 'one4 gold3 two4 gold3 three3 gold4 one4 gold2' },
  { n: 'Fast hands', p: 'faster tower, shorter windows', spin: 1.25, sec: 'open2 two4 one3 two3 split4 gold2 three3 split3 one3' },
  { n: 'Turnaround', p: 'introduce reversals: the tower changes direction', spin: 1.0, flip: 4, sec: 'open3 two4 half4 one4 three4 gold2 half4 two4' },
  { n: 'Needle', p: 'tight safe gaps: pick your moment', spin: 1.05, sec: 'open2 one3 pick5 gold2 one3 pick4 split4 three3' },
  { n: 'CANDY KING', p: 'boss: everything from world 1 in one long tower', boss: 1, spin: 1.1, flip: 5, sec: 'open2 two4 split4 flame1 wide8 half4 gold3 pick5 three4 split4 pick4 half4 gold3 wide4 flame1 half6' },
  // ---- world 2: holes (free fall), blinkers
  { n: 'Trapdoors', p: 'introduce holes: line one up and fall through', spin: 1.0, sec: 'open3 gap4 open2 gold2 gap4 one3 gap3 gold2 gap3' },
  { n: 'Thread it', p: 'a hole next to black: thread it, do not clip it', spin: 1.0, sec: 'open2 gapx4 open2 gapx4 two4 gapx3 gold2 gapx3' },
  { n: 'Blink', p: 'introduce blinkers: purple is safe, flashing means black next', spin: 1.0, sec: 'open3 blink4 open2 blink4 gold2 blink4 one3 blink3' },
  { n: 'Blink + black', p: 'blinkers together with black', spin: 1.05, sec: 'open2 blinkb4 two3 blinkb4 half3 gold2 blinkb4 three3' },
  { n: 'Spin city', p: 'fast, reversing, with holes as your escape', spin: 1.35, flip: 3.4, sec: 'two4 split4 one3 gap3 three4 gold2 split4 pick3 two3' },
  { n: 'Flame trail', p: 'flame lets you cut through the blinker wall', spin: 1.1, sec: 'open2 one3 flame1 wide6 blinkb5 half5 gold3 flame1 wide5 two4' },
  { n: 'Hole punch', p: 'holes as the only safe lane', spin: 1.15, sec: 'gapx3 pick4 gap3 split4 gapx3 gold2 three4 gapx4 blinkb3' },
  { n: 'Rush hour', p: 'hard: fast and dense, rest in the holes', spin: 1.45, sec: 'two4 three4 half4 gap2 pick4 split4 blinkb4 gold3 wide3 two4' },
  { n: 'Mix tape', p: 'breather: long and flashy, flames everywhere', spin: 1.0, sec: 'open3 flame1 half6 gold3 gap3 blink4 gold3 flame1 wide6 gapx3 gold3 two4 flame1 half6 gold4' },
  { n: 'NEON JAW', p: 'boss: reversals, holes and blinkers', boss: 1, spin: 1.3, flip: 4, sec: 'open2 two4 gapx4 blinkb4 split4 flame1 wide8 pick5 gap3 three4 blinkb5 gapx4 half4 gold3 pick4 flame1 wide6 two4 split4' },
  // ---- world 3: steel (even fire stops), the lot
  { n: 'Steel', p: 'introduce steel: fire does not break it, go around', spin: 1.0, sec: 'open3 gold1 steel4 open3 gold2 steel4 open2 steel4 gold3' },
  { n: 'Hot steel', p: 'ignite a flame, then steer through steel anyway', spin: 1.05, sec: 'open2 flame1 wide6 steel4 half5 flame1 wide5 steel4 gold3 half4' },
  { n: 'Steel wall', p: 'four steel slices: tight lane', spin: 1.1, sec: 'open2 steels4 gold2 steels4 one3 steels4 gap3 steels4' },
  { n: 'Ghost lane', p: 'steel, holes and blinkers together', spin: 1.15, flip: 4.5, sec: 'open2 steel4 gapx3 blinkb4 steel4 gold3 gapx4 blinkb3 steel3' },
  { n: 'Spin the wheel', p: 'fast, reversing steel', spin: 1.4, flip: 3.2, sec: 'steel4 two3 steels4 pick4 steel3 gold2 split4 steel3 three4' },
  { n: 'Fire drill', p: 'two flames, two steel walls: ignite at the right time', spin: 1.2, sec: 'open2 flame1 wide5 steel3 wide5 flame1 half6 steels3 wide5 gold3 half4' },
  { n: 'Needle steel', p: 'narrow safe gaps among steel', spin: 1.2, sec: 'steel3 pick4 steel3 pick4 gold2 steels3 pick4 steel3 gapx3' },
  { n: 'Last light', p: 'hard: dense mix, fastest spin, one flame to save you', spin: 1.6, sec: 'two4 steel3 blinkb4 split4 gapx3 steel3 flame1 wide6 steels3 pick4 half3 steel3 gold2' },
  { n: 'Victory lap', p: 'breather before the finale: gold everywhere', spin: 1.0, sec: 'open3 gold4 flame1 half6 gold4 gap3 gold4 flame1 wide6 gold5 blink4 gold4 half4' },
  { n: 'THE CORE', p: 'final boss: all seven elements, no mercy', boss: 1, spin: 1.45, flip: 4, sec: 'open2 two4 steel3 gapx4 blinkb4 flame1 wide8 steels3 split4 gapx3 pick5 steel3 three4 blinkb4 flame1 wide6 steels4 gold2 pick4 gapx4 steel3 half4 blinkb4 two4 gold3' },
];
export const PATTERN_NAMES = 'open one two three half wide split tri pick gold goldone gap gapx flame steel steels blink blinkb'.split(' ');

// levels past 30: seeded sections from the elements unlocked so far, getting longer and faster up to a cap
export function genLevel(n, seed = n * 977 + 13) {
  let s = seed % 2147483647 || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const k = Math.min(1, (n - 30) / 40);
  const pool = ['one', 'two', 'three', 'half', 'wide', 'split', 'pick', 'gapx', 'blinkb', 'steel', 'steels', 'gap', 'tri'];
  const parts = ['open3'];
  const len = 36 + Math.floor(k * 30);
  let c = 3;
  while (c < len) {
    const cnt = 3 + Math.floor(r() * 4);
    if (r() < 0.2) parts.push('gold' + (2 + Math.floor(r() * 2)));
    else if (r() < 0.14) parts.push('flame1', 'wide' + (5 + Math.floor(r() * 3)));
    else parts.push(pool[Math.floor(r() * pool.length)] + cnt);
    c += cnt;
  }
  parts.push('gold3');
  return { n: 'Deep ' + (n - 30), p: 'generated tower', spin: 1.1 + k * 0.5, flip: r() < 0.5 ? 3.6 + r() * 2 : 0, sec: parts.join(' ') };
}

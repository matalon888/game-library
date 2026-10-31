// Bolt Twist deep v2 — 30 hand-built toys in 3 worlds. Each toy is a theme + one plate template per face (templates are
// drawn by hand below: where every plate and bolt sits) + the knobs that make it that toy: colours, open boxes, tray size,
// how mixed the colours are, padlocks and ice. The first line of each entry says what the toy is for.
import { cap, rect, disc } from './blogic.js';

// ---------------------------------------------------------------- hand-drawn plate templates (face coordinates: x right, y up; face ≈ 2.6 × 2.4)
const slabB = () => [[-.9, .78], [.9, .78], [.9, -.78], [-.9, -.78]];
const slab = () => rect(0, 0, 2.28, 2.08, 0, slabB());
export const TPL = {
  slab: () => [slab()],                                                                     // 4 bolts, nothing covers anything
  halves: () => [rect(-.6, 0, 1.1, 2.08, 0, [[-.85, .74], [-.35, -.74]]), rect(.6, 0, 1.1, 2.08, 0, [[.35, .74], [.85, -.74]])],
  slabbar: () => [slab(), cap(0, 0, 2.2, 0, [[-.5, 0], [.5, 0]])],                         // 6: a bar across the middle, free to take first
  rail: () => [slab(), cap(.9, 0, 2.2, 90, [[.9, .3], [.9, -.3]])],                         // 6: the bar hides the two bolts on its side
  bridge: () => [slab(), cap(0, .78, 2.2, 0, [[-.3, .78], [.3, .78]])],                     // 6: the top bar hides both top bolts
  cross: () => [slab(), cap(0, 0, 2.6, 45, [[.32, .32], [-.32, -.32]]), cap(0, 0, 2.6, -45, [[-.32, .32], [.32, -.32]])],   // 8: an X over the corners
  tiles: () => [rect(-.62, .55, 1.1, 1.0, 0, [[-.45, .4]]), rect(.62, .55, 1.1, 1.0, 0, [[.45, .4]]), rect(-.62, -.55, 1.1, 1.0, 0, [[-.45, -.4]]), rect(.62, -.55, 1.1, 1.0, 0, [[.45, -.4]]), disc(0, 0, .62, [[0, 0]])],   // 5: four tiles pinned by a button
  ladder: () => [rect(-.8, 0, .5, 2.1, 0, [[-.8, .6], [-.8, -.6]]), rect(.8, 0, .5, 2.1, 0, [[.8, .6], [.8, -.6]]), cap(0, .6, 1.9, 0, [[-.3, .6], [.3, .6]]), cap(0, -.6, 1.9, 0, [[-.3, -.6], [.3, -.6]])],   // 8: two rungs over two rails
  dots: () => [disc(-.72, .5, .5, [[-.72, .5]]), disc(0, -.5, .5, [[0, -.5]]), disc(.72, .5, .5, [[.72, .5]])],   // 3: three buttons, all free
  xx: () => [cap(0, 0, 2.4, 40, [[.25, .21], [-.25, -.21]]), cap(0, 0, 2.4, -40, [[-.4, .34], [.4, -.34]])],   // 4: scissors, the top blade hides the middle
  cage: () => [cap(-.6, 0, 2.2, 90, [[-.6, .55], [-.6, -.55]]), cap(.6, 0, 2.2, 90, [[.6, .55], [.6, -.55]]), cap(0, .55, 2.4, 0, [[0, .55]]), cap(0, -.55, 2.4, 0, [[0, -.55]])],   // 6: two posts, two bars: bars first
  duo: () => [cap(0, .55, 2.2, 0, [[-.6, .55], [.6, .55]]), cap(0, -.55, 2.2, 0, [[-.6, -.55], [.6, -.55]])],   // 4: two bars, free
  trio: () => [rect(0, 0, 2.28, 2.08, 0, [[-.9, .78], [.9, .78], [0, -.78]]), disc(0, .4, .62, [[0, .4]]), cap(0, -.15, 1.6, 0, [[-.45, -.15], [.45, -.15]])],   // 6
};
const flip = (list, mx, my) => list.map((p) => ({ ...p, cx: mx ? -p.cx : p.cx, cy: my ? -p.cy : p.cy, rot: (mx ? -1 : 1) * (my ? -1 : 1) * p.rot, screws: p.screws.map(([x, y]) => [mx ? -x : x, my ? -y : y]) }));
/** 'rail' | 'rail:x' (mirror left-right) | 'rail:y' | 'rail:xy' */
export function plates(name) { const [n, f = ''] = name.split(':'); return flip(TPL[n](), f.includes('x'), f.includes('y')); }

export const WORLDS = [
  { name: 'Toy Shop', icon: '🧸', note: 'Tap, match, park, spin', bg: ['#a9d8ff', '#eaf7ff'] },
  { name: 'Workshop', icon: '🔧', note: 'Gold keys open padlocks', bg: ['#ffe0b0', '#fff7ea'] },
  { name: 'Factory', icon: '🏭', note: 'Ice bolts thaw as you work', bg: ['#dcd0ff', '#f6f1ff'] },
];
export const THEME_ICON = { crate: '📦', house: '🏠', robot: '🤖', gift: '🎁', rocket: '🚀', castle: '🏰' };

// n, name (the purpose), theme, faces {face: template}, nc colours, K open boxes, T tray slots, mix (how tangled), keys, ice[], minPar, hard
const L = (n, name, theme, faces, o) => ({ n, world: Math.floor((n - 1) / 10), name, theme, faces, win: 3, mix: 0.5, K: 2, T: 4, keys: 0, ice: [], ...o, seed: o.seed ?? n * 31 + 7 });
export const LEVELS = [
  // ---- World 1 · Toy Shop: tap, match, park, spin
  L(1, 'Tap a bolt, it flies to its box', 'crate', { front: 'slabbar' }, { target: 100, nc: 2, T: 5, mix: 0, win: 0 }),
  L(2, 'Take the bar first: layers', 'crate', { front: 'bridge' }, { target: 100, nc: 3, T: 5, mix: 0.3, win: 1 }),
  L(3, 'Swipe to spin: the other side has bolts too', 'house', { front: 'dots', right: 'duo' }, { target: 100, nc: 3, T: 5, K: 1, mix: 0.3, win: 1 }),
  L(4, 'No match? Park it in the tray', 'robot', { front: 'rail', right: 'dots:y' }, { target: 100, nc: 3, T: 5, K: 1, mix: 0.5, win: 2 }),
  L(5, 'The tray is smaller now: think first', 'gift', { front: 'tiles', left: 'duo' }, { target: 97, nc: 4, T: 4, K: 1, mix: 0.6 }),
  L(6, 'Scissors: the top blade hides the middle', 'crate', { front: 'xx', right: 'rail', back: 'dots' }, { target: 95, nc: 4, mix: 0.6 }),
  L(7, 'Three sides, one plan', 'house', { front: 'rail:x', right: 'tiles', left: 'bridge' }, { target: 92, nc: 4, mix: 0.6 }),
  L(8, 'Rungs over rails', 'robot', { front: 'ladder', right: 'duo:y' }, { target: 85, nc: 5, mix: 0.6 }),
  L(9, 'Four sides, five colours', 'gift', { front: 'cage', right: 'xx', back: 'rail', left: 'dots' }, { target: 80, nc: 5, mix: 0.7 }),
  L(10, 'HARD · The toy shop window', 'crate', { front: 'cross', right: 'ladder', back: 'tiles', left: 'cage', top: 'dots' }, { target: 55, nc: 6, mix: 0.7, hard: true }),
  // ---- World 2 · Workshop: gold keys open padlocks, three open boxes
  L(11, 'Gold bolt = key. Take it, the padlock opens', 'house', { front: 'rail', right: 'dots' }, { target: 100, nc: 3, K: 3, keys: 1, mix: 0.3 }),
  L(12, 'The key is on the other side', 'robot', { front: 'bridge', right: 'duo', back: 'dots' }, { target: 97, nc: 4, K: 3, keys: 1, mix: 0.5 }),
  L(13, 'Two locks, two keys', 'crate', { front: 'tiles', right: 'rail:x', left: 'duo' }, { target: 94, nc: 4, K: 3, keys: 2, mix: 0.5 }),
  L(14, 'Keys behind plates', 'gift', { front: 'cross', right: 'rail:x', left: 'dots' }, { target: 90, nc: 5, K: 3, keys: 2, mix: 0.5 }),
  L(15, 'Ladder with a lock on every side', 'rocket', { front: 'ladder', right: 'xx', left: 'duo' }, { target: 85, nc: 5, K: 3, keys: 2, mix: 0.6 }),
  L(16, 'Spin, spin, spin: four sides of keys', 'castle', { front: 'rail', right: 'bridge:x', back: 'xx', left: 'tiles' }, { target: 82, nc: 5, K: 3, keys: 3, mix: 0.6 }),
  L(17, 'A cage first, locks second', 'robot', { front: 'cage', right: 'cross', back: 'dots', left: 'duo' }, { target: 78, nc: 6, K: 3, keys: 2, mix: 0.6 }),
  L(18, 'Fewer boxes, more padlocks', 'house', { front: 'ladder', right: 'tiles', left: 'rail:y' }, { target: 74, nc: 6, K: 2, keys: 3, mix: 0.6 }),
  L(19, 'Everything at once', 'gift', { front: 'cross', right: 'cage', back: 'xx', left: 'bridge', top: 'duo' }, { target: 70, nc: 6, K: 3, keys: 3, mix: 0.6 }),
  L(20, 'HARD · The locksmith', 'castle', { front: 'cross', right: 'ladder', back: 'cage', left: 'tiles', top: 'xx' }, { target: 50, nc: 7, K: 3, keys: 4, mix: 0.7, hard: true }),
  // ---- World 3 · Factory: ice bolts thaw after N bolts have left
  L(21, 'Ice: the number is how many bolts must leave', 'robot', { front: 'rail', right: 'dots' }, { target: 100, nc: 3, ice: [3], mix: 0.3 }),
  L(22, 'Ice and a key', 'rocket', { front: 'bridge', right: 'tiles', left: 'duo' }, { target: 95, nc: 4, ice: [4], keys: 1, mix: 0.5 }),
  L(23, 'A frozen ladder', 'house', { front: 'ladder', right: 'dots:y', left: 'rail' }, { target: 92, nc: 4, ice: [3, 6], mix: 0.5 }),
  L(24, 'Three open boxes, three frozen bolts', 'crate', { front: 'cross', right: 'rail', back: 'duo' }, { target: 88, nc: 5, K: 3, ice: [3, 5, 8], mix: 0.5 }),
  L(25, 'Keys and ice together', 'castle', { front: 'tiles', right: 'xx', back: 'ladder', left: 'dots' }, { target: 82, nc: 5, ice: [4, 7], keys: 2, mix: 0.6 }),
  L(26, 'Small tray, tidy mind', 'gift', { front: 'cage', right: 'rail:x', left: 'xx' }, { target: 76, nc: 5, ice: [4], keys: 1, T: 4, mix: 0.7 }),
  L(27, 'Wait for the thaw', 'robot', { front: 'cross', right: 'bridge', back: 'tiles', left: 'duo:y' }, { target: 72, nc: 6, ice: [4, 8, 12], keys: 1, mix: 0.6 }),
  L(28, 'Five faces, no mercy', 'rocket', { front: 'ladder', right: 'cross', back: 'cage', left: 'xx', top: 'tiles' }, { target: 66, nc: 6, K: 3, ice: [5, 9], keys: 2, mix: 0.6 }),
  L(29, 'The last gate', 'castle', { front: 'cross', right: 'tiles', back: 'ladder', left: 'rail', top: 'dots' }, { target: 60, nc: 7, K: 3, ice: [5, 10], keys: 3, mix: 0.7 }),
  L(30, 'HARD · The big machine', 'robot', { front: 'cross', right: 'ladder', back: 'cage', left: 'cross:x', top: 'xx' }, { target: 42, nc: 8, K: 3, T: 4, ice: [6, 12], keys: 3, mix: 0.7, hard: true }),
];

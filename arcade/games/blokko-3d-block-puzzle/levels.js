// Blokko deep v2 — 36 hand-shaped levels in 3 worlds. A shape is drawn in layers, bottom first, layers split by a space, rows by "/".
//   #  plain cube       G  gold cube (a coin when it leaves)     ?  hidden arrow (shows once a neighbour leaves)
//   B  bomb (blows its 6 touching cubes when it slides out; bombs next to bombs chain)   S  stone (no arrow; only a bomb removes it)
// The arrows are laid by logic.js from `seed` (picked by qa/pick.mjs: many seeds tried, the most puzzling that is solvable);
// `par` = fewest taps found (a bomb that blows 4 cubes saves 4 taps). 3 stars = par (+slack), 2 stars = par + 2, 1 star = cleared.
import SEEDS from './seeds.js';

export const WORLDS = [
  { name: 'Candy Corner', sub: 'plain cubes and gold', bg: ['#ffd1ec', '#c9b8ff'], ui: '#6a3d9a', accent: '#ff7ab8' },
  { name: 'Mystery Attic', sub: 'hidden arrows and bombs', bg: ['#ffd9a8', '#c98a6a'], ui: '#6b3a1e', accent: '#ff9d3b' },
  { name: 'Boom Factory', sub: 'stones, chains and big booms', bg: ['#9fd3ff', '#4a6fa8'], ui: '#173a6b', accent: '#ffb02e' },
];

const L = (w, name, shape, why, hard = false) => ({ w, name, shape, why, hard });
const RAW = [
  // ---- World 1 · Candy Corner: the verb alone, then gold
  L(0, 'First slide', '##/## ##/##', 'intro: tap a cube whose arrow has a clear road; cannot be lost'),
  L(0, 'Spin it', '###/### ###/###', 'practise: drag to spin, find the cubes that are free'),
  L(0, 'Tower', '##/## ##/## ##/##', 'arrows can point up and down too'),
  L(0, 'Gold dust', '.#./###/.#. .#./#G#/.#.', 'intro: a gold cube pays a coin'),
  L(0, 'Steps', '####/####/#### ###./#?#./###. ##../##../##..', 'teaser: one ? hides its arrow until a neighbour leaves'),
  L(0, 'Donut', '###/#.#/### #G#/#.#/###', 'twist: a hole in the middle, the arrows can point into it'),
  L(0, 'Little hill', '###/###/### .#./#B#/.#. .../.#./...', 'teaser: the first bomb, it blows the cubes it touches'),
  L(0, 'Archway', '#...#/#...# #...#/#...# #####/##G##', 'test: roads cross through the gap', true),
  L(0, 'Zigzag', '###../###.. .###./.###. ..###/..###', 'breather: a long easy ribbon'),
  L(0, 'Checker', '#.#/.#./#.# .#./#.#/.#. #.#/.#./#.#', 'breather: lots of gaps, lots of free cubes'),
  L(0, 'Solid cube', '####/####/#### ####/####/#### ####/#GG#/####', 'practise: nothing shows, so work layer by layer'),
  L(0, 'Candy tower', '###/###/### ###/#.#/### ###/#.#/### G#G/###/G#G', 'boss: a tall hollow tower with gold corners', true),
  // ---- World 2 · Mystery Attic: hidden arrows (13-18), bombs (19-24)
  L(1, 'Who is that?', '###/#?#/### ###/###/###', 'intro: a ? hides its arrow until a neighbour leaves'),
  L(1, 'Two shy ones', '####/#??#/#### ####/####/####', 'practise: two hidden cubes side by side'),
  L(1, 'Attic stairs', '#?#/###/#?# ###/###/### .#./#?#/.#.', 'twist: hidden cubes at three heights'),
  L(1, 'Hallway', '#?#?#/#?#?# #?#?#/#?#?#', 'practise: every other cube is hidden'),
  L(1, 'The trunk', '####/####/#### ####/#??#/#### ####/####/####', 'test: the hidden core sits in the middle', true),
  L(1, 'Lamp light', '###/#G#/### .#./#G#/.#.', 'breather: two golds, nothing hidden'),
  L(1, 'Boom', '###/###/### ###/#B#/###', 'intro: a bomb blows the cubes it touches when it slides out'),
  L(1, 'Twin booms', '#####/#####/##### #####/#B#B#/#####', 'practise: two bombs, which first?'),
  L(1, 'Shy bomb', '###/#?#/### ###/#B#/###', 'twist: a bomb above a hidden cube'),
  L(1, 'Dominoes', '######/###### BBBB##/######', 'surprise: bombs touching bombs chain'),
  L(1, 'Gold rush', '###/###/### G#G/#B#/G#G', 'practise: blast around the gold, tap the gold'),
  L(1, 'Attic boss', '####/####/####/#### ####/#??#/#??#/#### B###/####/####/###B', 'boss: two bombs, a hidden core', true),
  // ---- World 3 · Boom Factory: stones (25-30), chains (31-36)
  L(2, 'Stone wall', '###/###/### #S#/SBS/#S#', 'intro: stones do not move, only a bomb removes them'),
  L(2, 'Under the lid', '.S./SBS/.S. ###/###/###', 'practise: clear the lid, then the bomb is free'),
  L(2, 'Stone bridge', '#####/##### SB#BS/#####', 'twist: two bombs, one stone each'),
  L(2, 'The vault', '###/###/### #S#/SBS/#S# ###/###/###', 'test: bomb inside, sealed top and bottom'),
  L(2, 'Corner bombs', 'BSB/S#S/BSB .?./???/.?.', 'practise: bombs at the corners, stones between'),
  L(2, 'Factory floor', '#####/#####/##### #S#S#/SBSBS/#S#S# #####/#####/#####', 'hard: two sealed bombs, a lot of cubes', true),
  L(2, 'Chain reaction', '.SS./SBBS/.SS. ####/####/####', 'surprise: touching bombs blow together'),
  L(2, 'Golden vault', 'GGG/G#G/GGG ###/#B#/###', 'breather: gold ring, one bomb'),
  L(2, 'Jackpot', 'GGGG/GGGG BBBB/####', 'breather: a chain over a pile of gold'),
  L(2, 'The works', '#####/#?#?#/##### ..B../.BSB./..B..', 'twist: four bombs around one stone, hidden cubes below'),
  L(2, 'Fortress', '####/####/####/#### #SS#/SBBS/SBBS/#SS# ????/????/????/????', 'hard: a hidden roof over a stone fortress', true),
  L(2, 'Boom Factory', '#####/#?#?#/#####/##### #S#S#/SBSBS/#S#S# #####/#?#?#/##### G###G/#???#/G###G', 'boss: everything at once', true),
];

export const LEVELS = RAW.map((l, i) => Object.assign({ n: i + 1 }, l, SEEDS[i] || { seed: 1, par: 0 }));
export const COUNT = LEVELS.length;

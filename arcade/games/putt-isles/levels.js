// Putt Isles v2 — 30 hand-made holes in 3 worlds. Path language (tee is the start tile; the LAST token is the cup tile):
//   F / L / R = one tile forward (up) / left / right (absolute heading, like the old generator); J = ramp + gap + landing tile
//   after ':' (joined with '+'):  b bumpers · s sliding block · p spinning bar   (one hazard per tile, straights only)
//                                 a sand (slow) · g boost pad · i ice (slippery)
//                                 c coin in the middle · cl / cr coin to the left / right of the line
// par = strokes a careful player needs (found with the solver, qa/levels.mjs); 3 stars = par + all coins.
export const WORLDS = [
  { name: 'Meadow Isles', icon: '🌱', sub: 'bumpers, blocks, bars, jumps', first: 1, last: 10, theme: 0 },
  { name: 'Dune Isles', icon: '🏜️', sub: 'sand slows, pads boost', first: 11, last: 20, theme: 1 },
  { name: 'Frost Isles', icon: '❄️', sub: 'ice slides on and on', first: 21, last: 30, theme: 2 },
];
export const LEVELS = [
  // ---- World 1: Meadow (one new idea every hole or two)
  { n: 'Hello Hole', p: 'F F:c F F:cl F', why: 'tutorial: aim at the flag, coins are a bonus' },
  { n: 'Turn Left', p: 'F F L:c F F:cr F', why: 'a corner: the line bends' },
  { n: 'Bumper Buddies', p: 'F F:b+c F F:cl F', why: 'bumpers bounce you: first obstacle' },
  { n: 'S Curve', p: 'F R:c F F L F:cr F', why: 'two corners in a row' },
  { n: 'First Leap', p: 'F F J:c F:cr F', why: 'ramp: full power to clear the gap' },
  { n: 'Gate Keeper', p: 'F F:s+c F F:s F L F:cl F', why: 'sliding blocks: wait for the gap' },
  { n: 'Pinwheel', p: 'F F:p+c F F:p F F:cr F', why: 'spinning bars: time the pass' },
  { n: 'Mix Tape', p: 'F F:b+c F R F F:s F L F F:p F:cl F', why: 'all three obstacles together' },
  { n: 'Gauntlet', p: 'F F:p F:b+c F R F F:s+cl F F:p L F F:b F', hard: 1, why: 'HARD: long run of obstacles' },
  { n: 'Sky Hop', p: 'F J:c F J:cl F F', why: 'breather: two jumps, easy coins' },
  // ---- World 2: Dunes (sand + boost pads)
  { n: 'Sand Trap', p: 'F F:a+c F F:a F:cl F', why: 'sand: it eats your speed, hit harder' },
  { n: 'Fast Lane', p: 'F F:g F F:c F:g F F', why: 'boost pads: light taps, long rolls' },
  { n: 'Dune Bend', p: 'F L F:a+c F F R F F:cl F', why: 'corner with sand in the way' },
  { n: 'Boost Jump', p: 'F F:g J:c F F', why: 'a pad before the ramp clears the gap' },
  { n: 'Sand Spin', p: 'F F:p+a F F:c L F F:cr F', why: 'bar over sand: power plus timing' },
  { n: 'Slingshot', p: 'F F:g R F F:b F:g L F F:cl F', why: 'pads between bumpers: keep control' },
  { n: 'Dune Slalom', p: 'F R F F:b+c F F L F F:s F F R F F:cl F', why: 'long mixed course' },
  { n: 'Hot Sand', p: 'F F:a F:a+c F:p F F:g J F:cr F', why: 'sand, then a bar, then a boosted jump' },
  { n: 'Mirage', p: 'F F:g F:p R F:a+c F:s F L F F:g J:cl F F', hard: 1, why: 'HARD: every dune trick at once' },
  { n: 'Oasis', p: 'F F:g F:c F F:cl F', why: 'breather: pads and an easy cup' },
  // ---- World 3: Frost (ice)
  { n: 'Slippery', p: 'F F:i F:i+c F F:cl F', why: 'ice: tiny taps go a long way' },
  { n: 'Ice Corner', p: 'F F:i L F:i+c F F:cr F', why: 'corner on ice: use the wall' },
  { n: 'Glide Gap', p: 'F F:g J:c F:i F F', why: 'jump, land on ice, stop in time' },
  { n: 'Ice Bumpers', p: 'F F:i+b F:i F:c F F', why: 'bumpers on ice fling you far' },
  { n: 'Frozen Spin', p: 'F F:p+i F F:c L F:i F:cr F', why: 'a bar on ice' },
  { n: 'Cold Snap', p: 'F R F F:i+s F F L F:i+c F:b F:cl F', why: 'blocks and bumpers on ice' },
  { n: 'Slide & Hop', p: 'F F:i J:c F:i F:p F:cl F', why: 'ice, a jump, and a bar' },
  { n: 'Deep Freeze', p: 'F F:i+b F R F F:i+s F F L F F:i+p F:cr F F', why: 'long ice course' },
  { n: 'Blizzard', p: 'F F:g F:i+p R F F:i+s F:b L F:i J:c F F:cl F', hard: 1, why: 'HARD: everything, on ice' },
  { n: 'Summit', p: 'F F:g J:c F F:i+b F:i R F F:s+i F L F F:p F:cl F', hard: 1, why: 'finale: the full set' },
].map((l, i) => ({ ...l, i: i + 1, w: 1 + Math.floor(i / 10), par: 0 }));
// par table filled by the solver run (qa/levels.mjs); kept here as data
const PAR = [2,3,3,3,3,3,3,4,4,3, 3,2,3,2,3,3,4,4,4,3, 3,3,3,3,3,4,4,5,5,5];
LEVELS.forEach((l, i) => l.par = PAR[i]);
const DIRS = { F: [0, -1], L: [-1, 0], R: [1, 0] };
const HAZ = { b: 'bumpers', s: 'slider', p: 'spinner' }, SURF = { a: 'sand', g: 'boost', i: 'ice' };
// parse a path string into tile records {gx,gz,type,d,obst,surf,coin}
export function parsePath(p) {
  const tiles = [{ gx: 0, gz: 0, type: 'tee', d: 'F' }];
  let gx = 0, gz = 0, d = 'F';
  const put = (type, dd, mods) => { const [dx, dz] = DIRS[dd]; gx += dx; gz += dz; const t = { gx, gz, type, d: dd }; for (const m of mods) { if (HAZ[m]) t.obst = HAZ[m]; else if (SURF[m]) t.surf = SURF[m]; else if (m[0] === 'c') t.coin = m[1] || 'm'; } tiles.push(t); return t; };
  for (const tok of p.split(' ')) {
    const [h, ms] = tok.split(':'), mods = ms ? ms.split('+') : [];
    if (h === 'J') { const [dx, dz] = DIRS[d]; put('ramp', d, []); put('gap', d, []); put('land', d, mods); } else { d = h; put('plain', d, mods); }
  }
  tiles[tiles.length - 1].type = 'cup';
  return tiles;
}

// Horde Blast v2: 36 hand-made sieges (3 worlds x 12). Every layout is designed by hand; the numbers that depend on how the
// layout plays (troop budget, star thresholds) are measured by qa/calibrate.cjs with a bot and live in cal.js.
// Lane is x in [-5.2, 5.2]; the cannon aims in [-4.1, 4.1]; z is how far up the lane (gates sit between -8 and -34, the fort at -45).
// Gate kinds: x = blue multiplier, d = red divide (half the crowd dies), s = blue gate that slides across, f = flips blue <-> red.
const W = 5.2;
const x = (m, cx, w) => ({ k: 'x', m, x: cx, w });
const d = (cx, w) => ({ k: 'd', m: 0.5, x: cx, w });
const s = (m, w = 3.2) => ({ k: 's', m, x: 0, w });
const f = (m, cx, w, per = 3.2, ph = 0) => ({ k: 'f', m, x: cx, w, per, ph });
const Lx = m => x(m, -W / 2, W - 0.3), Rx = m => x(m, W / 2, W - 0.3), Ld = () => d(-W / 2, W - 0.3), Rd = () => d(W / 2, W - 0.3);
const Cx = (m, w = 4) => x(m, 0, w), Cd = (w = 3.8) => d(0, w);
// three lanes: left | centre | right
const T3 = (a, b, c) => [{ ...a, x: -3.6, w: 3 }, { ...b, x: 0, w: 3.8 }, { ...c, x: 3.6, w: 3 }];
const row = (z, ...g) => ({ z, g: g.flat() });
// hazards: crusher [z, centre x it patrols around, speed, amplitude]; rock [x, z, radius]; crate [x, z, troops]; laser {xs, per, ph}
export const WORLDS = [
  { name: 'Sand Fort', col: '#e0a64a', sky: ['#9fd8ff', '#ffe2b0'], ui: '#2f7bff' },
  { name: 'Frost Pass', col: '#7fc8ff', sky: ['#bfe6ff', '#f2fbff'], ui: '#3a8dff' },
  { name: 'Magma Keep', col: '#ff7a3a', sky: ['#5b2a3c', '#ff9a5c'], ui: '#ff6a2a' },
];
export const LEVELS = [
  // ---------------- World 1: Sand Fort (the core verb, red gates, crushers, sliders, a brute, heavies, crates)
  { w: 0, name: 'First Blood', why: 'introduce: hold to fire, blue gates multiply. Cannot be lost.', hp: 30, wv: 3, every: 3.8,
    rows: [row(-12, Lx(2), Rx(3)), row(-22, Cx(2, 8))] },
  { w: 0, name: 'Pick the Bigger', why: 'introduce the choice: aim at the x4 side, not the x2 side.', hp: 70, wv: 4, every: 3.6,
    rows: [row(-10, Lx(2), Rx(3)), row(-18, Lx(4), Rx(2)), row(-26, Lx(2), Rx(3))] },
  { w: 0, name: 'Red Means Danger', why: 'introduce red gates: the first level you can lose; steer round the red.', hp: 130, wv: 5, every: 4.2, tip: 'Red gates halve your crowd · drag to aim',
    rows: [row(-12, T3(x(3), d(), x(2))), row(-22, T3(x(2), d(), x(3)))] },
  { w: 0, name: 'Roller', why: 'introduce the crusher: it eats troops, so wait for it to pass.', hp: 190, wv: 8, every: 3.3, tip: 'Dodge the crusher!',
    rows: [row(-10, Lx(3), Rd()), row(-24, Ld(), Rx(3))], cr: [[-17, 1.3, 0.9, 2.3]] },
  { w: 0, name: 'Runaway Gate', why: 'introduce the sliding gate: catch it when it passes your lane.', hp: 240, wv: 9, every: 3.2, tip: 'The gold gate slides: shoot when it is in front',
    rows: [row(-12, s(4)), row(-22, Lx(2), Rx(3))] },
  { w: 0, name: 'The Brute', why: 'first boss: a giant brute walks down the lane; fill him with troops.', hp: 190, wv: 8, every: 3.4, boss: 300, tip: 'BOSS LEVEL!',
    rows: [row(-10, Rx(3), Ld()), row(-20, Rx(3), Ld()), row(-28, Rx(2), Lx(2))] },
  { w: 0, name: 'Heavy Hitters', why: 'introduce heavy reds (3 hits each): a thick crowd beats them, a trickle does not.', hp: 320, wv: 8, every: 3.3, tank: 2, tip: 'Dark reds take 3 hits',
    rows: [row(-12, T3(x(2), d(), x(4))), row(-22, Lx(2), Rx(3))] },
  { w: 0, name: 'Supply Run', why: 'introduce supply crates: a detour through the red gate edge for extra troops.', hp: 380, wv: 9, every: 3.1, tank: 1, tip: 'Troops that touch a crate add ammo',
    rows: [row(-12, Lx(3), Rd()), row(-22, Lx(3), Rd())], cr: [[-17, 1.6, 0.8, 2.3]], crates: [[3.6, -16, 25], [3.9, -27, 25]] },
  { w: 0, name: 'Pincers', why: 'HARD: two crushers and a thin good lane; wait for the gap.', hp: 440, wv: 11, every: 3, tank: 1, hard: 1,
    rows: [row(-10, T3(d(), x(4), d())), row(-24, T3(x(3), d(), d()))], cr: [[-16, -1.5, 1.0, 2.6], [-30, 1.5, 0.9, 2.6]] },
  { w: 0, name: 'Big Four', why: 'breather: huge x4 gates, a flashy easy win after the hard one.', hp: 300, wv: 6, every: 3.8,
    rows: [row(-10, Cx(4, 9)), row(-20, Cx(3, 9)), row(-30, Cx(4, 9))] },
  { w: 0, name: 'Runaway Heavies', why: 'combine: sliding gate + heavy reds, aim while the gate runs.', hp: 520, wv: 10, every: 3, tank: 2,
    rows: [row(-12, s(5, 3.4)), row(-22, Lx(2), Rx(3)), row(-30, Cx(2, 8))], cr: [[-17, 0, 0.8, 4]] },
  { w: 0, name: 'Sand King', why: 'HARD world boss: a king, heavies, a crusher and a thin lane.', hp: 520, wv: 11, every: 2.9, tank: 2, boss: 480, hard: 1,
    rows: [row(-10, Lx(3), Rd()), row(-20, Rx(4), Ld()), row(-29, Lx(3), Rx(2))], cr: [[-15, 1.4, 1.0, 2.4]] },
  // ---------------- World 2: Frost Pass (flip gates, boulders, bombers)
  { w: 1, name: 'Blink Gate', why: 'introduce flip gates: blue, then red, then blue: time your stream.', hp: 360, wv: 7, every: 3.4, tip: 'Flip gates blink: shoot while they are blue',
    rows: [row(-12, f(4, 0, 9, 3.4)), row(-24, Lx(2), Rx(3))] },
  { w: 1, name: 'Blink and Roll', why: 'combine flip gate and crusher.', hp: 420, wv: 9, every: 3.2,
    rows: [row(-10, f(3, -W / 2, W - 0.3, 3.2), Rx(3)), row(-24, Lx(3), f(3, W / 2, W - 0.3, 3.2, 1.6))], cr: [[-17, 0, 1.0, 3.2]] },
  { w: 1, name: 'Boulders', why: 'introduce boulders: they smash troops, so aim around them.', hp: 460, wv: 9, every: 3.2, tip: 'Boulders crush troops',
    rows: [row(-12, Lx(3), Rx(3)), row(-26, Lx(4), Rx(2))], rocks: [[0, -19, 1.4], [-2.4, -19, 1.1]] },
  { w: 1, name: 'Slalom', why: 'HARD: boulders in a zig-zag, one narrow x5 lane at the end.', hp: 560, wv: 11, every: 3, hard: 1,
    rows: [row(-10, Cx(2, 9)), row(-32, x(5, 0, 3.4))], rocks: [[-2.4, -16, 1.3], [2.4, -21, 1.3], [-2.4, -26, 1.3]] },
  { w: 1, name: 'Snow Slide', why: 'breather: wide gates that flip slowly, easy to ride.', hp: 420, wv: 6, every: 3.8,
    rows: [row(-10, Cx(4, 9)), row(-20, f(3, 0, 9, 4.4)), row(-30, Cx(3, 9))] },
  { w: 1, name: 'Bombers', why: 'introduce bombers: fast reds that blow up your crowd; thin them early.', hp: 520, wv: 8, every: 3.2, bomb: 3, tip: 'Orange reds explode on contact',
    rows: [row(-12, T3(x(2), d(), x(4))), row(-22, Lx(3), Rx(3))] },
  { w: 1, name: 'Frozen Cache', why: 'crates beside flipping gates: greed versus timing.', hp: 600, wv: 9, every: 3.1, bomb: 2,
    rows: [row(-12, f(4, -W / 2, W - 0.3, 3.0), Rx(2)), row(-24, f(4, W / 2, W - 0.3, 3.0, 1.5), Lx(2))], crates: [[-3.8, -18, 25], [3.8, -18, 25], [0, -30, 30]] },
  { w: 1, name: 'Ice Brute', why: 'boss behind a flip gate and heavy reds.', hp: 520, wv: 9, every: 3.2, boss: 600, tank: 1,
    rows: [row(-10, f(4, 0, 9, 3.4)), row(-20, Rx(3), Ld()), row(-29, Lx(3), Rx(2))] },
  { w: 1, name: 'Boulder Blink', why: 'combine boulders with flip gates: the open lane keeps changing.', hp: 700, wv: 10, every: 3, tank: 1,
    rows: [row(-12, f(3, -W / 2, W - 0.3, 3.0), f(3, W / 2, W - 0.3, 3.0, 1.5)), row(-28, Lx(3), Rx(3))], rocks: [[0, -20, 1.5], [-3.6, -20, 1.0], [3.6, -20, 1.0]] },
  { w: 1, name: 'Tank Alley', why: 'a corridor of heavy reds: a thick x4 crowd or nothing.', hp: 800, wv: 9, every: 2.8, tank: 4, hard: 1,
    rows: [row(-10, T3(d(), x(4), d())), row(-24, T3(d(), x(4), d()))] },
  { w: 1, name: 'Cold Snap', why: 'breather: x5 gates and few reds, a big satisfying crowd.', hp: 560, wv: 6, every: 3.8,
    rows: [row(-10, Cx(5, 9)), row(-24, Cx(3, 9))] },
  { w: 1, name: 'Frost Queen', why: 'HARD world boss: flips, a boulder, heavies and a queen.', hp: 760, wv: 9, every: 3.3, boss: 900, tank: 2, hard: 1,
    rows: [row(-10, f(4, 0, 9, 3.2)), row(-22, Rx(4), Ld()), row(-30, f(3, -W / 2, W - 0.3, 3.0), f(3, W / 2, W - 0.3, 3.0, 1.5))], rocks: [[-2.4, -16, 1.2]] },
  // ---------------- World 3: Magma Keep (laser lanes)
  { w: 2, name: 'Heat Ray', why: 'introduce lasers: a red strip warns, then the lane burns.', hp: 640, wv: 8, every: 3.3, tip: 'A red strip means the beam fires there',
    rows: [row(-12, Lx(3), Rx(3)), row(-26, T3(d(), x(3), x(4)))], lasers: [{ xs: [-2.6, 2.6], per: 3.6, ph: 0 }] },
  { w: 2, name: 'Cross Beams', why: 'two beams in a rhythm: left, right, centre.', hp: 700, wv: 9, every: 3.2,
    rows: [row(-12, T3(x(3), x(2), x(3))), row(-26, T3(x(4), d(), x(3)))], lasers: [{ xs: [-3.4, 3.4, 0], per: 3.0, ph: 0 }] },
  { w: 2, name: 'Beam and Gate', why: 'combine lasers with red gates.', hp: 800, wv: 10, every: 3.1,
    rows: [row(-10, Lx(3), Rd()), row(-24, Rx(3), Ld())], lasers: [{ xs: [-3.0, 3.0], per: 3.2, ph: 1 }], cr: [[-17, 0, 0.9, 3.2]] },
  { w: 2, name: 'Magma Brute', why: 'boss that walks through the beams.', hp: 700, wv: 8, every: 3.2, boss: 1000, tank: 1,
    rows: [row(-10, Rx(4), Ld()), row(-22, Lx(4), Rd()), row(-30, Cx(2, 9))], lasers: [{ xs: [0, -3, 3], per: 3.4, ph: 0 }] },
  { w: 2, name: 'Lava Field', why: 'HARD: boulders and beams: one clean lane and a rhythm.', hp: 900, wv: 11, every: 3, bomb: 2, hard: 1,
    rows: [row(-10, Cx(2, 9)), row(-30, x(5, 0, 3.6))], rocks: [[-2.6, -16, 1.3], [2.6, -22, 1.3]], lasers: [{ xs: [0, 3.4, -3.4], per: 3.0, ph: 0 }] },
  { w: 2, name: 'Cooling Off', why: 'breather: big gates and one slow beam.', hp: 680, wv: 6, every: 3.8,
    rows: [row(-10, Cx(4, 9)), row(-22, Cx(4, 9)), row(-32, Cx(3, 9))], lasers: [{ xs: [-3, 3], per: 4.2, ph: 0 }] },
  { w: 2, name: 'Flicker Forge', why: 'flip gates plus a beam: two timers at once.', hp: 950, wv: 10, every: 3, tank: 1,
    rows: [row(-12, f(4, 0, 9, 3.6)), row(-26, f(3, -W / 2, W - 0.3, 3.0), f(3, W / 2, W - 0.3, 3.0, 1.5))], lasers: [{ xs: [-3.4, 3.4], per: 3.6, ph: 1.2 }] },
  { w: 2, name: 'Fire Bombers', why: 'bombers behind beams: thin them out before they arrive.', hp: 1000, wv: 9, every: 3, bomb: 2, 
    rows: [row(-12, T3(x(3), d(), x(4))), row(-24, Lx(3), Rx(3))], lasers: [{ xs: [0, 3.4, -3.4], per: 3.6, ph: 0 }] },
  { w: 2, name: 'Iron Wall', why: 'HARD: heavy reds and two crushers in a narrow lane.', hp: 1100, wv: 9, every: 2.8, tank: 4, hard: 1,
    rows: [row(-10, T3(d(), x(5), d())), row(-24, T3(d(), x(4), d()))], cr: [[-17, -1.3, 1.0, 2.6], [-31, 1.3, 0.9, 2.6]] },
  { w: 2, name: 'Hot Cache', why: 'crates under the beams: worth the risk.', hp: 1100, wv: 10, every: 3, bomb: 2,
    rows: [row(-12, Lx(4), Rd()), row(-26, Rx(4), Ld())], crates: [[3.8, -18, 30], [-3.8, -32, 30], [0, -22, 25]], lasers: [{ xs: [0, -3.4, 3.4], per: 3.0, ph: 0 }] },
  { w: 2, name: 'Last Breath', why: 'breather before the king: wide x5 gates.', hp: 800, wv: 6, every: 3.8,
    rows: [row(-10, Cx(5, 9)), row(-24, Cx(4, 9))] },
  { w: 2, name: 'Magma King', why: 'HARD final boss: everything at once.', hp: 1200, wv: 8, every: 3.6, boss: 1500, bomb: 1, tank: 1, hard: 1, tip: 'Stay out of the red strips · kill the king first',
    rows: [row(-10, f(4, 0, 9, 3.4)), row(-22, Rx(4), Ld()), row(-31, Lx(4), Rd())], rocks: [[0, -16, 1.2]], lasers: [{ xs: [-3.4, 3.4, 0], per: 3.6, ph: 0 }], cr: [[-26, 0, 0.9, 3.4]] },
];

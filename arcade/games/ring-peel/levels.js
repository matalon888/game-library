// Ring Peel — 30 hand-made piers in 3 worlds (Harbor Pier, Sunset Reef, Storm Dock). A pier is 2-4 towers; each tower is
// T(rings, guards, extras). Guards: S spin wall, W swinging wall, U surging wall, B blinking shutter, G gate ring (a wall all
// the way round with one gap). Extras: sh 'o' round / 'h' hex / 'q' square, tw twist per ring, gold/arm/bomb = ring numbers
// counted from the bottom (the first ring the cannon hits is 0). par = seconds for the 3rd star (from qa/calib.mjs).
const PI = Math.PI;
const S = (w, sp, a0 = 1.2) => ({ mode: 'spin', w, sp, a0 });
const W = (w, sp, amp = 1.2, ph = 0) => ({ mode: 'swing', w, sp, amp, a0: 0, ph });
const U = (w, sp, sp2 = 2, ph = 0, a0 = 1) => ({ mode: 'surge', w, sp, sp2, ph, a0 });
const B = (w, sp, on, off, a0 = 0, ph = 0) => ({ mode: 'blink', w, sp, on, off, a0, ph });
const G = (gap, sp, a0 = 0) => ({ mode: 'spin', w: 2 * PI - gap, sp, a0, gate: true });
const T = (r, g = [], x = {}) => ({ r, g, sh: x.sh || 'o', tw: x.tw || 0, gold: x.gold || [], arm: x.arm || [], bomb: x.bomb || [] });
const L = (name, purpose, stages, o = {}) => ({ name, purpose, stages, hard: !!o.hard, par: o.par || 0 });

export const WORLDS = [
  { name: 'Harbor Pier', icon: '⚓', blurb: 'spinning walls, swings, shapes' },
  { name: 'Sunset Reef', icon: '🌅', blurb: 'armored rings, shutters, bomb chains' },
  { name: 'Storm Dock', icon: '⛈️', blurb: 'gate rings, surges, long towers' },
];
export const LEVELS = [
  // ---- World 1: Harbor Pier
  L('Peel it', 'nothing to dodge: hold, pop the red bomb ring, then a first tiny slow wall', [T(12, [], { bomb: [7], gold: [3] }), T(16, [S(0.5, 0.7)])]),
  L('Gap and go', 'one spinning wall: let go when it comes round', [T(14, [S(0.7, 0.9)]), T(20, [S(0.8, 1.1)]), T(22, [S(0.8, 1.2, 2)], { gold: [10] })]),
  L('First bite', 'first pier you can lose: a faster wall, three towers', [T(18, [S(0.9, 1.2)]), T(24, [S(0.95, 1.4, 2.5)]), T(28, [S(1, 1.5, 0.5)], { gold: [9] })]),
  L('Swing set', 'introduce the swinging wall: it comes back the way it left', [T(20, [W(0.7, 1.0, 1.1)]), T(26, [W(0.75, 1.1, 1.3)], { gold: [8] }), T(28, [W(0.8, 1.2, 1.2)])]),
  L('Hexagon', 'six-sided towers with a twist: same dodge, new look', [T(22, [S(0.75, 1.3)], { sh: 'h', tw: 0.14 }), T(26, [S(0.8, 1.4)], { sh: 'h', tw: 0.2, gold: [10] }), T(28, [W(0.75, 1.2, 1.2)], { sh: 'h', tw: 0.16, bomb: [12] })]),
  L('Two walls', 'two walls half a turn apart: the gaps come in pairs', [T(22, [S(0.6, 1.0, 0), S(0.6, 1.0, PI)]), T(26, [S(0.6, 1.1, 1), S(0.6, 1.1, 1 + PI)]), T(30, [S(0.65, 1.2, 2), S(0.65, 1.2, 2 + PI)], { gold: [6, 14] })]),
  L('Counter-spin', 'two walls turning opposite ways: the gap keeps changing', [T(22, [S(0.75, 1.1, 0), S(0.75, -0.9, 3)]), T(26, [S(0.8, 1.2, 1), S(0.8, -1.0, 4)]), T(30, [S(0.8, 1.3, 2), S(0.8, -1.1, 5)], { bomb: [10] })]),
  L('Square dance', 'square towers, a swing and a spinner together', [T(24, [W(0.65, 1.1, 1.2), S(0.45, 0.9, 2)], { sh: 'q', tw: 0.18 }), T(28, [W(0.7, 1.2, 1.3), S(0.5, 1.0, 4)], { sh: 'q', tw: 0.1, gold: [12] }), T(30, [W(0.7, 1.3, 1.2, 1), S(0.5, -1.0, 1)], { sh: 'q', tw: 0.22 })]),
  L('Long pier', 'four towers in a row: keep your nerve and your rhythm', [T(20, [S(0.8, 1.3)]), T(24, [W(0.7, 1.2, 1.2)], { bomb: [8] }), T(26, [S(0.6, 1.1, 0), S(0.6, 1.1, PI)], { sh: 'h', tw: 0.15 }), T(30, [W(0.65, 1.3, 1.2), S(0.45, -1.0, 2)], { sh: 'q', gold: [4, 12, 20] })]),
  L('Harbor Master', 'HARD: tall towers, fast swing plus counter-spin', [T(30, [W(0.8, 1.5, 1.3), S(0.6, -1.3, 2)], { tw: 0.1 }), T(34, [S(0.75, 1.5, 0), S(0.75, -1.2, 3)], { sh: 'h', tw: 0.16, gold: [14] }), T(38, [W(0.8, 1.6, 1.3), S(0.6, 1.3, 1), S(0.5, -1.1, 4)], { sh: 'q', tw: 0.2, bomb: [10, 22] })], { hard: true }),
  // ---- World 2: Sunset Reef
  L('Armor up', 'introduce armored steel rings: two hits each, the first one cracks them', [T(16, [S(0.7, 1.1)], { arm: [4, 9] }), T(22, [S(0.75, 1.2)], { arm: [5, 10, 14], gold: [7] }), T(26, [S(0.8, 1.3)], { arm: [6, 12, 18] })]),
  L('Steel swing', 'armor and the swinging wall: every extra hit is a wasted gap', [T(20, [W(0.65, 1.1, 1.2)], { arm: [3, 7, 11] }), T(24, [W(0.7, 1.2, 1.3)], { arm: [4, 9, 14], gold: [6] }), T(28, [W(0.75, 1.3, 1.2)], { arm: [5, 12, 18] })]),
  L('Chain bombs', 'bomb rings every few: a breather to feel like a hero', [T(22, [S(0.7, 1.2)], { bomb: [3, 8, 13] }), T(26, [S(0.75, 1.3)], { bomb: [4, 9, 14, 19], gold: [11] }), T(30, [W(0.7, 1.2, 1.2)], { bomb: [5, 12, 19], gold: [9, 16] })]),
  L('Golden hour', 'gold rings everywhere: chase them for score and the fever bar', [T(20, [S(0.7, 1.2)], { gold: [2, 5, 8, 11] }), T(24, [S(0.6, 1.1), S(0.5, -0.9, 3)], { gold: [3, 7, 11, 15] }), T(28, [W(0.7, 1.3, 1.2)], { gold: [4, 9, 14, 19], bomb: [6] })]),
  L('Shutter', 'introduce the blinking shutter: it flashes before it shuts', [T(18, [B(1.4, 0, 0.7, 1.7)]), T(22, [B(1.5, 0, 0.8, 1.6)]), T(26, [B(1.6, 0, 0.9, 1.5)], { gold: [8] })]),
  L('Shutter spin', 'a shutter that turns: the gap moves while it blinks', [T(20, [B(1.2, 0.8, 1.0, 1.4, 0)]), T(24, [B(1.3, -0.9, 1.0, 1.3, 1)], { arm: [6, 12] }), T(28, [B(1.4, 1.0, 1.0, 1.3, 2), S(0.45, -0.9, 3)], { gold: [10] })]),
  L('Armor shutters', 'steel rings behind shutters: plan which gap takes the second hit', [T(20, [B(1.5, 0.4, 1.0, 1.4)], { arm: [3, 7, 12] }), T(24, [B(1.5, -0.5, 1.0, 1.3)], { arm: [4, 8, 13, 17] }), T(28, [B(1.4, 0.6, 1.0, 1.3), W(0.55, 1.2, 1.2)], { arm: [6, 12, 18], bomb: [9] })]),
  L('Reef trio', 'three walls round one tower: tight little windows', [T(22, [S(0.45, 0.9, 0), S(0.45, 0.9, 2.1), S(0.45, 0.9, 4.2)]), T(26, [S(0.45, 1.0, 0), S(0.45, 1.0, 2.1), S(0.45, 1.0, 4.2)], { sh: 'h', tw: 0.15, bomb: [10] }), T(30, [S(0.5, -1.0, 0), S(0.5, -1.0, 2.1), S(0.5, -1.0, 4.2)], { gold: [8, 18] })]),
  L('Long reef', 'four towers: shutter, steel, trio, swing — all you learned', [T(22, [B(1.6, 0.3, 1.0, 1.4)], { gold: [6] }), T(26, [S(0.65, 1.2, 0), S(0.65, 1.2, PI)], { arm: [4, 9, 15] }), T(28, [W(0.75, 1.4, 1.3)], { arm: [6, 12, 18], bomb: [14] }), T(30, [B(1.2, 0.7, 0.9, 1.3), S(0.5, -1.0, 3)], { sh: 'h', tw: 0.18, gold: [5, 13, 21] })]),
  L('Reef Boss', 'HARD: shutters, steel and two spinners on tall towers', [T(30, [B(1.3, 0.5, 0.9, 1.3), S(0.55, -1.3, 2)], { arm: [5, 11, 17], tw: 0.1 }), T(34, [W(0.8, 1.6, 1.3), B(1.0, -0.6, 0.9, 1.3, 2)], { sh: 'h', tw: 0.16, arm: [6, 13, 20], gold: [10] }), T(38, [S(0.6, 1.4, 0), S(0.6, 1.4, PI), B(0.9, 0.5, 0.9, 1.3, 1.5)], { sh: 'q', tw: 0.2, arm: [8, 16, 24], bomb: [12, 26] })], { hard: true }),
  // ---- World 3: Storm Dock
  L('Gate', 'introduce the gate ring: a wall all the way round with one gap', [T(18, [G(3.0, 0.9)]), T(24, [G(2.8, 1.0)]), T(28, [G(2.6, 1.1)], { gold: [8] })]),
  L('Surge', 'a wall that speeds up and slows down: watch it, then go', [T(22, [U(0.8, 1.2, 2.2)]), T(26, [U(0.85, 1.3, 2.4, 1)], { gold: [7] }), T(30, [U(0.9, 1.4, 2.6, 2), S(0.45, -1.0, 3)])]),
  L('Steel gate', 'armor behind a gate: every cracked ring costs a gap', [T(20, [G(3.0, 1.0)], { arm: [4, 9] }), T(24, [G(2.8, 1.1)], { arm: [5, 11, 16] }), T(28, [G(2.6, 1.2)], { arm: [6, 13, 19], bomb: [9] })]),
  L('Gate and spinner', 'a gate ring and a loose wall inside it', [T(22, [G(3.0, 1.0), S(0.35, -0.9, 2)]), T(26, [G(3.0, 1.1), S(0.35, -1.0, 3)], { gold: [9] }), T(30, [G(2.9, 1.2), S(0.4, 1.0, 4)], { sh: 'h', tw: 0.14 })]),
  L('Storm shutters', 'a gate that blinks: two kinds of waiting at once', [T(22, [G(3.1, 0.9), B(1.0, 0, 0.7, 1.7, 0)]), T(26, [G(3.0, 1.0), B(1.0, 0.3, 0.7, 1.6, 1)], { gold: [10] }), T(30, [G(2.9, 1.1), B(1.0, -0.4, 0.7, 1.5, 2)], { arm: [8, 15] })]),
  L('Bomb storm', 'bomb rings behind gates: a breather that still keeps you honest', [T(24, [G(2.9, 1.1)], { bomb: [4, 9, 14] }), T(28, [G(2.8, 1.2)], { bomb: [5, 11, 17], gold: [8, 14] }), T(32, [G(2.7, 1.3), S(0.4, -1.0, 2)], { bomb: [6, 13, 20], gold: [10, 24] })]),
  L('Double surge', 'two surging walls in step, then out of step', [T(22, [U(0.55, 1.1, 2.0, 0, 0), U(0.55, 1.1, 2.0, 3, PI)]), T(26, [U(0.55, 1.2, 2.2, 0, 0), U(0.55, -1.0, 2.4, 1, 3)], { sh: 'q', tw: 0.16, arm: [7, 14] }), T(30, [U(0.6, 1.3, 2.4, 0, 0), U(0.6, 1.2, 2.1, 2, PI)], { gold: [6, 13, 20] })]),
  L('Hex storm', 'hex towers behind gates and shutters', [T(24, [G(2.9, 1.2)], { sh: 'h', tw: 0.18, arm: [5, 12] }), T(28, [G(2.8, 1.3), B(0.9, 0.5, 0.7, 1.5)], { sh: 'h', tw: 0.22, gold: [8, 18] }), T(32, [G(2.7, 1.4), W(0.5, 1.2, 1.2)], { sh: 'h', tw: 0.25, arm: [8, 16, 24], bomb: [12] })]),
  L('Long dock', 'four towers: gate, surge, shutter gate, steel — a marathon with checkpoints', [T(22, [G(2.9, 1.2)], { gold: [6] }), T(26, [U(0.65, 1.3, 2.2), S(0.4, -1.0, 3)], { bomb: [10] }), T(28, [G(2.8, 1.3), B(0.9, 0.4, 0.7, 1.5)], { sh: 'q', tw: 0.2, gold: [9, 19] }), T(32, [G(2.7, 1.4)], { sh: 'h', tw: 0.2, arm: [6, 12, 18, 24], bomb: [14] })]),
  L('Storm King', 'HARD: gate, surge and shutter on the tallest towers', [T(32, [G(2.8, 1.4), S(0.4, -1.2, 2)], { arm: [6, 13, 20], tw: 0.1 }), T(36, [U(0.75, 1.5, 2.4), G(2.9, -1.4)], { sh: 'h', tw: 0.18, arm: [8, 16, 24], gold: [12] }), T(40, [G(2.7, 1.5), B(0.8, 0.6, 0.8, 1.3, 1), W(0.45, 1.4, 1.2)], { sh: 'q', tw: 0.22, arm: [8, 17, 26], bomb: [12, 30], gold: [20] })], { hard: true }),
];

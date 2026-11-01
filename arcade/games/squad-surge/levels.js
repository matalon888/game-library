// Squad Surge v2 — 36 hand-made tracks in 3 worlds. One row = one 13-unit slice of track; "+" puts several things in one slice.
//   I8 idle buddies (I8< left, I8> right, I8= centre)   G+10|x2 gate pair (+N add, xN multiply, -N lose, /N halve: left | right)
//   S saw  S2 fast saw   P posts (P:L, P:C, P:R, P:LC, P:LR, P:CR, P:LCR)   N spinner (N- turns the other way)
//   D spike pad (D< left half, D> right half)   C20:12 cage (opens when the squad is 20+, frees 12)   E6 rival patrol (6 pink fighters)
// boss: hp, kind ('club' swats the nearest buddies, 'slam' drops a red ring on the squad: drag away, 'twin' does both), k buddies per swat.
// par: [2 stars, 3 stars] = survivors at the end (set from bot runs, qa/sim.mjs). `why` is what the level teaches.
export const WORLDS = [
  { name: 'Sky Park', icon: '☁️', bg: ['#8a6bff', '#bfe3ff'], ui: '#7b4dff', theme: 0 },
  { name: 'Pink Pier', icon: '🌸', bg: ['#ff8fc8', '#ffe0f0'], ui: '#ff4fa3', theme: 2 },
  { name: 'Castle Rush', icon: '🏰', bg: ['#4fb6ff', '#d6f0ff'], ui: '#2f8cff', theme: 1 },
];
export const INTRO = { 1: 'TOUCH THE WHITE BUDDIES', 2: 'SAWS! find the gap', 3: 'PICK A GATE', 5: 'RED GATES TAKE BUDDIES', 6: 'SPINNER!', 8: 'RIVAL PATROL!', 13: 'SPIKE PADS', 14: 'CAGE: bring enough buddies', 15: 'HALVING GATE ÷2', 16: 'RED RING: DRAG AWAY!', 25: 'TWIN BOSS: ring + club' };
const L = (n, why, rows, gang, boss, par, extra = {}) => ({ n, w: Math.ceil(n / 12), why, rows, gang, boss, par, ...extra });
export const LEVELS = [
  // ---- World 1 · Sky Park: the verb (steer, recruit), saws, posts, gates, spinner, patrols
  L(1, 'touch the white buddies, then pick the x3 gate: cannot lose', ['I6=', 'G+5|x3', 'I8', 'I8=', 'I8<'], 2, { hp: 12, kind: 'club', k: 1 }, [14, 26]),
  L(2, 'first saw: slip through the gap', ['I6', 'S', 'I8', 'I8<', 'Y>', 'S', 'I8>'], 3, { hp: 18, kind: 'club', k: 1 }, [14, 26]),
  L(3, 'first gates: both good, pick the bigger', ['I6', 'G+10|+20', 'I6', 'S', 'G+6|x2', 'I6'], 3, { hp: 24, kind: 'club', k: 2 }, [35, 62]),
  L(4, 'posts: thread the gap', ['I6', 'P', 'I8', 'P:LR', 'I6', 'G+6|x2', 'P:C'], 4, { hp: 28, kind: 'club', k: 2 }, [14, 26]),
  L(5, 'red gate: read before you pick', ['I6', 'G-5|+8', 'I8', 'Y', 'S', 'G x2|-6', 'I6>', 'P:LC'], 3, { hp: 28, kind: 'club', k: 2 }, [22, 40]),
  L(6, 'spinner: cross when the arm is away', ['I8', 'N', 'I8', 'G+5|+10', 'N-', 'I6'], 4, { hp: 30, kind: 'club', k: 2 }, [15, 28]),
  L(7, 'practise: saw, posts and gates together', ['I6', 'S', 'P', 'G x2|+6', 'I8', 'S', 'P:LCR', 'I6'], 6, { hp: 22, kind: 'club', k: 2 }, [16, 30]),
  L(8, 'rival patrol: your first fight on the run', ['I8', 'E4', 'I6', 'G x2|+4', 'I6', 'S'], 6, { hp: 46, kind: 'club', k: 2 }, [16, 30]),
  L(9, 'twist: the x2 gate drops you next to posts', ['I8', 'Y<', 'G x2|+5', 'P:LC', 'I8', 'G+6|x2', 'P:CR', 'I6'], 7, { hp: 52, kind: 'club', k: 2 }, [18, 32]),
  L(10, 'HARD: gauntlet of fast saws and spinners', ['I6', 'S', 'N', 'G-8|x2', 'S2', 'I8', 'N-', 'P:LCR', 'I8'], 7, { hp: 40, kind: 'club', k: 2 }, [16, 30], { hard: true }),
  L(11, 'breather: gates stack into a huge squad', ['I10', 'G x2|x2', 'I10', 'G x2|+10', 'I8', 'G x2|x2'], 10, { hp: 70, kind: 'club', k: 2 }, [30, 60]),
  L(12, 'BOSS: the Club Boss swats your front line', ['I8', 'S', 'G x2|+6', 'E6', 'I10', 'N', 'G x2|+8', 'I8', 'S'], 12, { hp: 110, kind: 'club', k: 3 }, [20, 40], { hard: true }),
  // ---- World 2 · Pink Pier: spike pads, cages, halving gates, the red ring
  L(13, 'spike pads: they snap shut in a rhythm', ['I8', 'Y>', 'D<', 'I8', 'D>', 'I6', 'G+8|x2', 'I8'], 6, { hp: 60, kind: 'club', k: 2 }, [26, 44]),
  L(14, 'cages: bring enough buddies to open them', ['I8', 'C8:12', 'I8', 'G+5|+5', 'C14:14', 'I6'], 7, { hp: 66, kind: 'club', k: 2 }, [24, 40]),
  L(15, 'halving gate: x2 or lose half', ['I8', 'G/2|+10', 'I8', 'D', 'G x2|/2', 'I8', 'S'], 8, { hp: 70, kind: 'club', k: 2 }, [26, 46]),
  L(16, 'the red ring: drag away from the slam', ['I8', 'E6', 'D<', 'I8', 'G x2|+4', 'I8'], 8, { hp: 60, kind: 'slam', k: 2 }, [20, 38]),
  L(17, 'cage maths: take x2 first or the cage stays shut', ['I10', 'G x2|+6', 'C30:20', 'I6', 'S', 'G+8|x2'], 9, { hp: 90, kind: 'slam', k: 2 }, [24, 44]),
  L(18, 'HARD: pads, spinner and a patrol back to back', ['I8', 'Y', 'D>', 'N', 'E8', 'G x2|-6', 'D<', 'I8', 'S2'], 11, { hp: 100, kind: 'slam', k: 3 }, [20, 40], { hard: true }),
  L(19, 'breather: cage jackpot, x2 on x2', ['I10', 'C12:25', 'G x2|x2', 'I8', 'C30:30', 'G x2|+10'], 12, { hp: 130, kind: 'slam', k: 2 }, [90, 180]),
  L(20, 'patrols in the lane: kill them before the gate', ['I8', 'E6', 'G x2|+5', 'E8', 'I8', 'D', 'G/2|x2'], 12, { hp: 110, kind: 'slam', k: 3 }, [24, 46]),
  L(21, 'twist: halve gate guarding a big cage', ['I10', 'S', 'G/2|+12', 'C22:28', 'I8', 'P:LCR', 'G x2|+8'], 12, { hp: 120, kind: 'slam', k: 3 }, [26, 48]),
  L(22, 'practise: every hazard, one decision a row', ['I8', 'S', 'D>', 'G x2|-5', 'N', 'I8', 'P:LC', 'E8', 'G+10|x2'], 14, { hp: 130, kind: 'slam', k: 3 }, [26, 50]),
  L(23, 'quiet before the storm: just bank buddies', ['I10', 'G x2|+8', 'I10', 'C16:20', 'G x2|x2', 'I8'], 14, { hp: 140, kind: 'slam', k: 2 }, [40, 76]),
  L(24, 'BOSS: the Pier Queen slams twice as often', ['I8', 'S2', 'G x2|+6', 'E10', 'D<', 'I10', 'Y<', 'N-', 'G x2|+8', 'C20:24', 'I8'], 16, { hp: 190, kind: 'slam', k: 3, sw: 1.7 }, [28, 54], { hard: true }),
  // ---- World 3 · Castle Rush: twin bosses, tight lanes, everything at once
  L(25, 'twin boss: dodge the ring, then the club', ['I8', 'S', 'G x2|+6', 'I10', 'P:LC', 'G+8|x2', 'I8'], 10, { hp: 100, kind: 'twin', k: 2 }, [24, 46]),
  L(26, 'tight lane: posts on both sides of the gate', ['I8', 'G x2|+4', 'P:LR', 'I8', 'N', 'G+6|x2', 'P:C', 'I8'], 12, { hp: 120, kind: 'twin', k: 2 }, [24, 46]),
  L(27, 'two patrols and a cage: spend your squad wisely', ['I10', 'E8', 'G x2|+6', 'C24:26', 'E10', 'I8', 'G x2|+6'], 12, { hp: 130, kind: 'twin', k: 3 }, [26, 50]),
  L(28, 'fast saws between every gate', ['I8', 'S2', 'G x2|+6', 'S2', 'I8', 'S2', 'G+8|x2', 'I8'], 13, { hp: 130, kind: 'twin', k: 3 }, [26, 50]),
  L(29, 'practise: halving gates and spike pads', ['I10', 'G/2|x2', 'D<', 'I8', 'G x2|/2', 'D>', 'I10', 'G x2|+8'], 14, { hp: 140, kind: 'twin', k: 3 }, [28, 54]),
  L(30, 'HARD: spinner field into a patrol', ['I8', 'Y>', 'N', 'N-', 'I8', 'E10', 'G x2|-8', 'N', 'I10', 'P:LCR', 'G x2|+10'], 18, { hp: 170, kind: 'twin', k: 3 }, [26, 50], { hard: true }),
  L(31, 'breather: a river of gates', ['I10', 'G x2|x2', 'I10', 'G x2|x2', 'C20:30', 'G x2|+12', 'I8'], 18, { hp: 240, kind: 'twin', k: 3 }, [50, 100]),
  L(32, 'cages in a row: only the biggest squad opens them all', ['I10', 'C10:12', 'G x2|+6', 'C26:28', 'I8', 'G x2|+8', 'C50:40', 'I8'], 18, { hp: 200, kind: 'twin', k: 3 }, [34, 64]),
  L(33, 'rival gauntlet: three patrols, one gate between', ['I10', 'E8', 'I8', 'G x2|+6', 'E10', 'D', 'E12', 'G x2|+8', 'I8'], 20, { hp: 200, kind: 'twin', k: 3 }, [30, 56]),
  L(34, 'twist: the +20 gate is behind a spinner', ['I8', 'N', 'G+20|x2', 'S2', 'G-6|x2', 'D<', 'I10', 'N-', 'G x2|+8'], 20, { hp: 210, kind: 'twin', k: 3 }, [30, 56]),
  L(35, 'last climb: every hazard, every gate', ['I8', 'S2', 'N', 'G x2|+6', 'D>', 'E10', 'P:LC', 'G/2|x2', 'C20:30', 'N-', 'G x2|+10', 'I8'], 22, { hp: 240, kind: 'twin', k: 4 }, [32, 60], { hard: true }),
  L(36, 'FINAL BOSS: the Castle King (fast ring, fast club)', ['I10', 'S2', 'G x2|+8', 'E12', 'D<', 'I10', 'N', 'G x2|x2', 'C26:36', 'P:LCR', 'G x2|+12', 'E10', 'I8'], 26, { hp: 340, kind: 'twin', k: 4, sw: 1.5 }, [36, 70], { hard: true }),
];

// after level 36 and for the Daily Surge: a track mixed from the same rows with a seeded roll (same track for everyone on a given day)
const POOL = ['I8', 'I10', 'S', 'S2', 'P:LC', 'P:CR', 'P:LCR', 'N', 'N-', 'D<', 'D>', 'E8', 'G x2|+6', 'G+8|x2', 'G x2|-6', 'G/2|x2', 'C16:20'];
export function genLevel(seed, n) {
  let s = Math.floor(seed) % 2147483647 || 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rows = ['I8'], cnt = 9 + Math.floor(R() * 4);
  for (let i = 0; i < cnt; i++) { const r = POOL[Math.floor(R() * POOL.length)]; rows.push(i % 3 === 2 ? 'I8' : r); if (r[0] === 'G' && R() < 0.5) rows.push('I8'); }
  rows.push('G x2|+8', 'I8');
  return { n, w: 3, why: 'Daily Surge', rows, gang: 14 + Math.floor(R() * 8), boss: { hp: 230 + Math.floor(R() * 60), kind: R() < 0.5 ? 'twin' : 'slam', k: 3 }, par: [30, 56], daily: true };
}

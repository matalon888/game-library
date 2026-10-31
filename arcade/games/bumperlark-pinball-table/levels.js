// Bumperlark v2 — 30 authored missions in 3 tables. One mission = a goal (or goals) to hit before the balls run out.
// goal types: score n · bump n (pop-bumper hits) · drops n (full target banks) · orbit n · mult n (reach n×) · lanes n (lane sets) · hot n (hot-bumper hits) · sling n
// lay: bumper layout key (LAYOUTS in deep.js). hot: one bumper glows gold (5× points) and hops. mover: one bumper slides. armor: drop targets need two hits.
// balls: balls for the mission. save: ball-save seconds after launch. s3: score that earns the third star (with the goal done).
// Stars: 1 = goal done · 2 = done before the last ball · 3 = done and score >= s3.
export const WORLDS = [
  { name: 'LARK LANE', icon: '🐦', tag: 'bumpers · lanes · targets · orbit', bg: ['#2a1260', '#ff5fa2'] },
  { name: 'NEON ALLEY', icon: '🌃', tag: 'hot bumper · sliding bumper', bg: ['#0b3a63', '#3ad7ff'] },
  { name: 'MIDNIGHT LOOP', icon: '🌙', tag: 'armored targets · everything', bg: ['#1b0b3d', '#ffd166'] },
];
const G = (t, n) => ({ t, n });
export const LEVELS = [
  // ---- table 1: the toy first (big save, easy goals), then one idea per mission
  { n: 'First flap', p: 'learn: launch and pop the bumpers', balls: 3, save: 14, lay: 'tri', goal: [G('bump', 6)], s3: 5500 },
  { n: 'Pop it', p: 'keep the ball up with the flippers', balls: 3, save: 12, lay: 'tri', goal: [G('bump', 15)], s3: 4800 },
  { n: 'Lane up', p: 'light the three top lanes for a multiplier', balls: 3, save: 10, lay: 'tri', goal: [G('mult', 2)], s3: 5200 },
  { n: 'Knock down', p: 'the pink targets on the right: hit all three', balls: 3, save: 10, lay: 'tri', goal: [G('drops', 1)], s3: 6000 },
  { n: 'Round trip', p: 'the left orbit: shoot up the lane once', balls: 3, save: 9, lay: 'tri', goal: [G('orbit', 1)], s3: 2600 },
  { n: 'Sling it', p: 'the slingshots kick back: bounce off them 6 times', balls: 3, save: 9, lay: 'wide', goal: [G('sling', 6)], s3: 4200 },
  { n: 'Points please', p: 'new: diverter walls steer the ball. A plain score race', gim: 'wall', balls: 3, save: 8, lay: 'wide', goal: [G('score', 5000)], s3: 11000 },
  { n: 'Double up', p: 'new: the spinner pays for every spin. Multiplier 3×: tap a flipper to move lit lanes', gim: 'spin', balls: 3, save: 8, lay: 'wide', goal: [G('mult', 3), G('spin', 10)], s3: 6000 },
  { n: 'Two jobs', p: 'targets, then the orbit', balls: 3, save: 8, lay: 'tri', goal: [G('drops', 1), G('orbit', 1)], s3: 7500 },
  { n: 'LARK QUEEN', p: 'boss: score, a target bank and 2 orbits on one table', boss: 1, balls: 3, save: 8, lay: 'tri', goal: [G('score', 9000), G('drops', 1), G('orbit', 2)], s3: 17500 },
  // ---- table 2: the hot bumper (gold, 5×) and a bumper that slides
  { n: 'Hot spot', p: 'new: one bumper glows gold and pays 5×', balls: 3, save: 10, lay: 'tri', hot: 1, goal: [G('hot', 3)], s3: 3000 },
  { n: 'Chase gold', p: 'the hot bumper hops after every hit: follow it', gim: 'spin', balls: 3, save: 9, lay: 'diamond', hot: 1, goal: [G('hot', 6)], s3: 6000 },
  { n: 'Slider', p: 'new: a bumper that slides side to side', gim: 'wall', balls: 3, save: 9, lay: 'line', mover: 1, goal: [G('bump', 20)], s3: 4500 },
  { n: 'Five alive', p: 'five bumpers, a busy middle', balls: 3, save: 8, lay: 'five', goal: [G('score', 8000)], s3: 16000 },
  { n: 'Gold lanes', p: 'new: a magnet pocket grabs the ball. Multiplier 4× while the hot bumper hops', gim: 'magnet', balls: 3, save: 8, lay: 'five', hot: 1, goal: [G('mult', 4)], s3: 11000 },
  { n: 'Moving gold', p: 'hot bumper on a sliding bumper', balls: 3, save: 8, lay: 'line', hot: 1, mover: 1, goal: [G('hot', 5)], s3: 7500 },
  { n: 'Full bank', p: 'two target banks', gim: 'spin wall', balls: 3, save: 7, lay: 'diamond', goal: [G('drops', 2)], s3: 11000 },
  { n: 'Orbit run', p: 'two orbits in a row of balls: aim the left flipper', gim: 'magnet', balls: 3, save: 7, lay: 'wide', goal: [G('orbit', 2)], s3: 9000 },
  { n: 'Tight one', p: 'two balls only', gim: 'wall', balls: 2, save: 7, lay: 'five', hot: 1, goal: [G('score', 9000)], s3: 17500 },
  { n: 'NEON NIGHT', p: 'boss: hot bumper, slider, targets and a 3× lane', boss: 1, balls: 3, save: 7, lay: 'five', hot: 1, mover: 1, goal: [G('hot', 4), G('drops', 1), G('mult', 3)], s3: 22500 },
  // ---- table 3: armored targets, shorter saves, everything together
  { n: 'Armor up', p: 'new: armored targets take two hits', gim: 'spin', balls: 3, save: 8, lay: 'tri', armor: 1, goal: [G('drops', 1)], s3: 6000 },
  { n: 'Slow burn', p: 'armor with the sliding bumper in the way', gim: 'magnet', balls: 3, save: 7, lay: 'line', armor: 1, mover: 1, goal: [G('drops', 1), G('bump', 15)], s3: 9000 },
  { n: 'Gold armor', p: 'armored bank, hot bumper, spinner and walls', gim: 'wall spin', balls: 3, save: 7, lay: 'diamond', armor: 1, hot: 1, goal: [G('drops', 1), G('hot', 3)], s3: 11000 },
  { n: 'Lane master', p: '5× multiplier', gim: 'spin', balls: 3, save: 6, lay: 'five', armor: 1, goal: [G('mult', 5)], s3: 15000 },
  { n: 'Sling storm', p: 'rack up slingshot kicks under pressure', gim: 'magnet wall', balls: 3, save: 6, lay: 'wide', mover: 1, goal: [G('sling', 14), G('bump', 20)], s3: 11000 },
  { n: 'Double orbit', p: 'orbit twice, then targets', gim: 'spin', balls: 3, save: 6, lay: 'tri', armor: 1, hot: 1, goal: [G('orbit', 2), G('drops', 1)], s3: 14000 },
  { n: 'Big score', p: 'a 15000 race with armor in play', gim: 'magnet', balls: 3, save: 6, lay: 'five', armor: 1, hot: 1, goal: [G('score', 15000)], s3: 30000 },
  { n: 'Two balls, one try', p: 'two balls, three jobs', gim: 'spin wall', balls: 2, save: 6, lay: 'diamond', armor: 1, mover: 1, goal: [G('drops', 1), G('orbit', 1), G('hot', 3)], s3: 15000 },
  { n: 'Pin master', p: 'everything: 4× lanes, a bank, an orbit', gim: 'magnet spin', balls: 3, save: 5, lay: 'five', armor: 1, hot: 1, mover: 1, goal: [G('mult', 4), G('drops', 1), G('orbit', 1)], s3: 25000 },
  { n: 'MIDNIGHT LARK', p: 'boss: every idea at once', boss: 1, gim: 'spin wall magnet', balls: 3, save: 5, lay: 'five', armor: 1, hot: 1, mover: 1, goal: [G('score', 20000), G('drops', 2), G('orbit', 2), G('hot', 4)], s3: 40000 },
];

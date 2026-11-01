// Bloop Stack v2 — 36 hand-made levels in 3 worlds. Text format: see sim.js parse(). Every level is searched by qa/solve.mjs:
// it must be clearable, every gem reachable, and `perf` (flush walls with every gem) is what the 3rd star asks for.
export const WORLDS = [
  { name: 'Meadow Hop', speed: 4.6, sky: ['#7fd3ff', '#e4f8ff'], dirt: ['#e98a5c', '#de7d50'], grass: ['#6ad66a', '#76df70'], ui: '#2fd1b4' },
  { name: 'Candy Canyon', speed: 5.0, sky: ['#ffb3c7', '#ffe6cf'], dirt: ['#f2a0c0', '#e88fb2'], grass: ['#fff0a8', '#ffe27a'], ui: '#ff6fa3' },
  { name: 'Sky Gears', speed: 5.4, sky: ['#7a6bd8', '#f2c9ff'], dirt: ['#7d86a6', '#6f789a'], grass: ['#c7d0f0', '#b4bfe6'], ui: '#9a7bff' },
];
export const LEVELS = [
  // ---- World 1: Meadow Hop (walls, drops, carried blocks, roofs)
  { n: 'First wall', why: 'tap once per step: the only thing to learn', assist: true, s: '+1/7g0 +1/7g0 +1/7g0 -2/6g0 +1/6g0 +1/6g0' },
  { n: 'Two high', why: 'a step of 2: tap twice before it', s: '+1/6g0 +2/7g0 -1/6g0 +2/7g0 +1/6g0 -3/6g0 +2/6g0 +2/7g0' },
  { n: 'Down and up', why: 'first drops: you fall, then climb from the bottom', s: '+2/6g0 -2/6g0 +3/7g0 -1/6g0 +1/6g0 -3/6g0 +2/6g0 +1/5g0 -2/6g0 +3/7g0' },
  { n: 'Carry it', why: 'a gem in the air: tap early and carry the blocks into the wall', s: '=/6 +2/5g0 =/8g2 +2/6g0 =/8g1 +1/6g0 -3/6 =/8g3 +3/6g0 =/7g2 +2/6g0' },
  { n: 'Pillars', why: 'thin tall walls, then straight back down', s: '=/5 +3/1 -3/5g0 +4/1 -4/5g0 +3/1 -3/4 +2/6g0 +3/1 -1/6g0 +4/1 -5/6g0' },
  { n: 'Stair gems', why: 'a gem one above each step: carry one block up the stairs', s: '=/5 +1/5g1 +1/5g1 +1/5g1 +1/5g1 +1/5g0 -4/6g0 +1/5g1 +1/5g1 +2/6g0 -3/6g0 +1/5g1 +1/5g0' },
  { n: 'Low roof', why: 'first roof: too many blocks bonk the ceiling', s: '=/6 +1/8r3g2 +2/6 -1/6 +1/8r3g1 +2/6r4g2 +2/6 -4/5 =/7r3g1 +1/6 +1/7r3g2 +2/7 -3/6 +2/7 +1/6g0' },
  { n: 'Tunnel', why: 'walls inside a tunnel: tap late, not early', s: '+1/5 =/9r3g1 +1/9r3g1 +1/9r3g1 +1/9r3g1 +1/9r3g0 -4/6 =/10r3g2 +2/9r3g2 +2/8r4g0 -3/6 =/6' },
  { n: 'HARD: Rock garden', why: 'hard: pillars, drops and a roof back to back', hard: true, s: '+1/5g0 +4/1 -4/5g0 +3/1 -2/5g0 +5/1 -5/5g0 +2/5r4g1 +3/1 -4/5 +1/5g0 +3/1 -3/5g0 +2/1 -2/5r4g2 +2/6g0' },
  { n: 'Breather', why: 'breather: easy steps, lots of gems, feels powerful', s: '+1/5g0 +1/5g0 +1/5g0 +1/5g0 +1/5g0 +1/5g0 -3/6g0 +1/5g0 +1/5g0 +1/5g0 +1/5g0 -4/6g0 +1/5g0 +1/5g0' },
  { n: 'Gem ladder', why: 'carry 2 and 3 blocks at once: gems high over flat ground', s: '=/7g2 +2/6g0 =/8g3 +3/6g0 -3/5 =/8g2 +2/6g0 =/8g3 +3/7g0 -4/5 =/9g4 +4/6g0 -1/5' },
  { n: 'HARD: Boss meadow', why: 'hard: everything from world 1, longer', hard: true, s: '+1/5g0 =/7r3g1 +2/6g0 -2/4 +4/1 -4/4g0 =/7r4g2 +2/6g0 +2/1 -3/4 =/8g2 +2/5g0 -1/4r3g1 +1/6 +4/1 -5/4 =/9r4g3 +3/6g0 -3/5 +1/5g0 +2/6r4g1 +2/5g0' },
  // ---- World 2: Candy Canyon (spring pads, bonus blocks, springs under roofs)
  { n: 'Springboard', why: 'new: spring pads hop you over a wall with no blocks at all', s: '=/5 =/2s +2/7g0 =/6 =/2s +2/7g0 -2/5 =/2s +3/7g0 -1/5 =/2s +2/7g0 -2/6 =/2s +3/7g0' },
  { n: 'Sky gems', why: 'gems at the top of the spring arc: be airborne at the right moment', s: '=/5 =/4sg3 =/5 =/4sg3 =/5 +1/4sg3 +1/5g0 -2/5 =/4sg3 +2/6g0 -3/5 =/4sg3 =/4 =/4sg3 +3/6g0' },
  { n: 'Bounce a pillar', why: 'a spring plus one tap in the air clears a tall pillar', s: '=/4 =/2s +3/1 -3/6g0 =/2s +4/1 -4/6g0 =/2s +3/1 -3/5 =/2s +4/1 -3/5 =/2s +5/1 -5/6g0' },
  { n: 'Free block', why: 'new: a bonus block on the ground drops into your stack for free', s: '=/5 =/6p0 +1/6g0 =/5p0 +2/6g0 =/6p0 +1/5 =/5p0 +1/6g0 -3/6 =/5p0 +2/6 =/5p0 +1/6g0' },
  { n: 'High blocks', why: 'bonus blocks floating higher: carry a block up to grab another', s: '=/6p1 +2/6g0 =/6p1 +2/6g0 -2/5 =/7p2 +3/7g0 -3/5 =/6p1 +1/6 =/7p2 +3/7g0 =/5p1 +2/6g0' },
  { n: 'Crowded roof', why: 'free blocks under a low roof: too many and you bonk', s: '=/5 =/9r3p0 +1/7r3g1 +1/8r3p0 +1/7r3g1 +2/7r4 -2/5 =/9r3p0g1 +1/8r3 +2/7r4g2 -1/6' },
  { n: 'Low spring', why: 'a spring under a roof: do not tap while you fly', s: '=/5 =/4sr5 +2/7g0 =/5 =/4sr5g3 +2/7g0 -2/5 =/4sr5 +3/7g0 -3/5 =/4sr5g3 +3/6g0 -2/5 =/4sr6g3 +3/7g0' },
  { n: 'Candy run', why: 'spring, bonus block and wall in one flowing level', s: '=/5 =/4sg3 +1/5p0 +2/6g0 -2/5 =/2s +3/1 -3/5p0 +1/6g0 =/4sg3 =/5p0 +2/6g0 -2/5 =/2s +4/1 -4/5 =/6p0 +1/5 +2/6g0' },
  { n: 'HARD: Sugar cliffs', why: 'hard: pillars, springs and roofs with free blocks to manage', hard: true, s: '=/5 =/2s +4/1 -4/4 =/6p0 +1/6r3g1 +2/6r4 -3/4 =/2s +3/1 -3/5p0 +1/6 +3/1 -4/5 =/4sr6g3 +2/7g0 -2/4 =/6p0 +3/6g0 +2/6' },
  { n: 'Breather', why: 'breather: springs and free blocks everywhere, feels powerful', s: '=/5 =/4sg3 =/5p0 +1/5g0 =/4sg3 =/5p0 +1/5g0 =/4sg3 =/5p0 +1/5g0 -3/5 =/4sg3 =/5p0 +1/5g0 =/4sg3 =/5p0 +2/6g0' },
  { n: 'Twin pads', why: 'two springs in a row chain a big double hop', s: '=/5 =/3s =/3s +3/7g0 -3/5 =/3s =/3s +4/7g0 -4/5 =/3s =/3s +3/1 -3/5 =/3s =/3s +4/1 -3/6g0' },
  { n: 'HARD: Boss canyon', why: 'hard: every candy toy in one long canyon', hard: true, s: '=/5 =/4sg3 +1/5p0 +2/6g0 -2/4 =/2s +4/1 -4/5 =/6p0 +1/6r3g1 +2/6r4 -3/4 =/4sg3 +2/1 -2/5p0 +2/6g0 =/4sr6g3 +3/7g0 -3/4 =/6p0 +2/6 =/2s +4/1 -4/4 =/7r3p0 +1/6r3g1 +1/6g0' },
  // ---- World 3: Sky Gears (crushing roofs, checkpoints, everything)
  { n: 'Crusher', why: 'new: a roof that slams up and down: pass with few blocks, tap in the open windows', s: '=/6 =/10c2-6 +1/7 =/10c2-6 +1/7 =/10c3-6 +2/7 -3/6 =/10c2-6 +1/7' },
  { n: 'Gear garden', why: 'gems under crushers: carry them only while the roof is high', s: '=/6 =/10c2-6g0 +1/8c3-6g0 +2/7 =/10c3-6g1 +1/8c2-6 -3/6 =/10c3-6g1 +1/7 =/10c3-6g1 +1/7' },
  { n: 'Press line', why: 'back-to-back crushers with walls between them', s: '=/5 +1/6c2-5 +1/6c2-5 +1/6c2-5 +1/6c2-5 -4/6 +2/6c3-6 +2/6c2-5 -4/6 +1/7c2-5g0' },
  { n: 'Crusher steps', why: 'a spring over a press: hop when the roof is up', s: '=/5 =/4sc4-7g3 +2/7 -2/5 =/4sc4-7g3 +2/7 -2/5 =/4sc4-7g3 +3/7 =/6' },
  { n: 'Free ride', why: 'free blocks from the bonus pad meet the crusher: do not carry too many', s: '=/5 =/6c2-6p0 +1/6c2-6 =/6c2-6p0 +1/6c2-6 =/6c3-6p0 +2/6 -3/5 =/7c2-6p0 +1/6g0 +1/6' },
  { n: 'Gear stairs', why: 'rising stairs with crushers on every other step', s: '=/5 +1/5c3-6g0 +1/5 +1/5c3-6g0 +1/5 +1/5c3-6g0 +1/5 -5/6 +1/5c3-6g0 +1/5 +1/5c3-6g0 +2/6' },
  { n: 'Piston pillars', why: 'thin pillars between crushers', s: '=/5 +3/1 -3/4c4-7 +3/1 -3/4c5-8 +4/1 -4/5 =/5c3-6g1 +2/6 +3/1 -4/5c5-8' },
  { n: 'HARD: Gear gauntlet', why: 'hard: crushers, springs and tall walls with a checkpoint', hard: true, s: '=/5 +1/5c3-6g0 +2/6 =/2s +3/1 -4/5c5-8 +2/6g0 +1/5k =/6c2-6p0 +1/6 =/4sc4-8g3 +3/7 -4/5 +2/6c3-6g0 +2/6' },
  { n: 'Rainbow gears', why: 'a long gem trail through the clockwork', s: '=/5 =/4sg3 +1/5g0 +1/5c3-6g0 +2/6 -2/4 =/6p0 +1/6 =/4sg3 +1/6c2-6 -3/5 =/7c2-6g1 +1/6g0 +2/7' },
  { n: 'Breather', why: 'breather: wide gears, slow crushers, easy gems', s: '=/5 +1/6g0 +1/6g0 +1/6c3-7g0 +1/6g0 +1/6g0 +1/6c3-7g0 -5/6 +1/6g0 +1/6g0 +1/6c3-7g0 +1/6g0' },
  { n: 'HARD: Clock tower', why: 'hard: everything at once, two checkpoints', hard: true, s: '=/5 =/2s +3/1 -3/5c4-7g0 +2/6k =/6c2-6p0 +1/6g0 =/4sc4-8g3 +3/7 -4/5k +1/6c3-6g1 +2/6 =/2s +4/1 -5/5 +1/6c3-6g0 +2/6c2-6 +1/6' },
  { n: 'HARD: Boss sky', why: 'final: every toy, three checkpoints, a long run to the flag', hard: true, s: '=/5 =/4sg3 +1/5p0 +2/6c2-6g0 -2/4k =/2s +4/1 -4/5 =/6p0 +1/6c3-6g1 +2/6 -3/4 =/4sc4-8g3 +2/1 -2/5k +2/6c2-6g0 =/6p0 +2/6 =/2s +4/1 -4/4 -2/6c3-6g1 +2/6k =/7c3-6p0 +2/6g0 -4/5 =/4sg3 +3/7c2-6g0 -2/6' },
];

// Cardcairn data: cards, relics, foes, encounters, events. All original.
// Card effect fields: d dmg, x hits, all (every foe), b block, dr draw, e energy, vu/wk/ps vulnerable/weak/poison,
// st/dx/th strength/dexterity/thorns (self), hl heal, sd lose HP, ex exhaust, sp special, p* powers.
export const CARDS = {};
const C = (id, n, c, t, r, i, b, u = {}) => { CARDS[id] = { id, n, c, t, r, i, b, u }; };

// starter
C('toss', 'Pebble Toss', 1, 'A', 's', '🪨', { d: 6 }, { d: 9 });
C('guard', 'Stone Guard', 1, 'S', 's', '🛡️', { b: 5 }, { b: 8 });
C('flash', 'Lantern Flash', 2, 'A', 's', '🏮', { d: 8, vu: 2 }, { d: 10, vu: 3 });
// common attacks
C('bash', 'Badger Bash', 2, 'A', 'c', '💥', { d: 12 }, { d: 16 });
C('claws', 'Twin Claws', 1, 'A', 'c', '🐾', { d: 4, x: 2 }, { d: 6, x: 2 });
C('slide', 'Rock Slide', 1, 'A', 'c', '🏔️', { d: 7, all: 1 }, { d: 10, all: 1 });
C('whip', 'Moss Whip', 1, 'A', 'c', '🌿', { d: 7, wk: 1 }, { d: 9, wk: 2 });
C('nip', 'Quick Nip', 0, 'A', 'c', '⚡', { d: 4 }, { d: 7 });
C('check', 'Shoulder Check', 1, 'A', 'c', '🤜', { d: 5, b: 5 }, { d: 7, b: 7 });
C('storm', 'Pebble Storm', 1, 'A', 'c', '🌧️', { d: 3, x: 3 }, { d: 4, x: 3 });
C('thistle', 'Thistle Jab', 1, 'A', 'c', '🌵', { d: 5, ps: 3 }, { d: 6, ps: 4 });
C('ember', 'Ember Swipe', 1, 'A', 'c', '🔥', { d: 7, dr: 1 }, { d: 10, dr: 1 });
C('gale', 'Gale Kick', 2, 'A', 'c', '🌬️', { d: 8, all: 1, wk: 1 }, { d: 11, all: 1, wk: 1 });
C('crush', 'Cairn Crush', 3, 'A', 'c', '🗿', { d: 24 }, { d: 32 });
// common skills
C('brace', 'Brace', 1, 'S', 'c', '🧱', { b: 8 }, { b: 11 });
C('hunker', 'Hunker Down', 0, 'S', 'c', '🐢', { b: 3, dr: 1 }, { b: 5, dr: 1 });
C('breath', 'Deep Breath', 1, 'S', 'c', '🌀', { dr: 2 }, { dr: 3 });
C('wall', 'Mossy Wall', 2, 'S', 'c', '🪵', { b: 13 }, { b: 18 });
C('fur', 'Thick Fur', 1, 'S', 'c', '🦔', { b: 5, th: 2 }, { b: 7, th: 3 });
C('spore', 'Spore Puff', 1, 'S', 'c', '🍄', { vu: 2 }, { vu: 3 });
C('hidey', 'Hidey Hole', 1, 'S', 'c', '🕳️', { b: 7, dr: 1 }, { b: 9, dr: 1 });
C('ivy', 'Bitter Ivy', 1, 'S', 'c', '🍃', { ps: 6 }, { ps: 8 });
C('glare', 'Lantern Glare', 1, 'S', 'c', '👀', { wk: 2, b: 3 }, { wk: 3, b: 5 });
// uncommon attacks
C('avalanche', 'Avalanche', 2, 'A', 'u', '❄️', { d: 6, x: 2, all: 1 }, { d: 8, x: 2, all: 1 });
C('slam', 'Shield Slam', 1, 'A', 'u', '🛡️', { sp: 'blkdmg' }, { c: 0 });
C('rush', 'Fury Rush', 2, 'A', 'u', '🌪️', { d: 4, x: 4 }, { d: 5, x: 4 });
C('venom', 'Venom Burst', 1, 'A', 'u', '🧪', { sp: 'dblps', ex: 1 }, { sp: 'dblps', ex: 0 });
C('beam', 'Lantern Beam', 2, 'A', 'u', '🔦', { d: 16, vu: 2 }, { d: 22, vu: 3 });
C('boulder', 'Boulder Roll', 2, 'A', 'u', '🎳', { d: 20, sd: 3 }, { d: 27, sd: 3 });
C('rumble', 'Rumble', 1, 'A', 'u', '🥁', { d: 6, st: 1 }, { d: 8, st: 2 });
C('hail', 'Hailstones', 1, 'A', 'u', '🧊', { d: 2, x: 4 }, { d: 3, x: 4 });
C('lash', 'Bramble Lash', 1, 'A', 'u', '🌹', { d: 8, th: 2 }, { d: 11, th: 3 });
C('pounce', 'Pounce', 1, 'A', 'u', '🦘', { d: 10, wk: 1, vu: 1 }, { d: 13, wk: 2, vu: 2 });
C('shatter', 'Shatter', 1, 'A', 'u', '💎', { sp: 'clrblk', d: 8 }, { sp: 'clrblk', d: 12 });
// uncommon skills
C('rockskin', 'Rockskin', 2, 'S', 'u', '🪨', { b: 18 }, { b: 24 });
C('smoke', 'Smoke Lantern', 1, 'S', 'u', '💨', { wk: 2, all: 1 }, { wk: 3, all: 1 });
C('duck', 'Duck & Cover', 1, 'S', 'u', '🦆', { b: 6, sp: 'blkatk', b2: 6 }, { b: 8, sp: 'blkatk', b2: 8 });
C('wind', 'Second Wind', 0, 'S', 'u', '🍃', { e: 1, dr: 1, ex: 1 }, { e: 2, dr: 1, ex: 1 });
C('bandage', 'Moss Bandage', 1, 'S', 'u', '🩹', { hl: 5, ex: 1 }, { hl: 8, ex: 1 });
C('cloud', 'Toxic Cloud', 2, 'S', 'u', '☁️', { ps: 5, all: 1 }, { ps: 7, all: 1 });
C('sharpen', 'Sharpen Claws', 1, 'S', 'u', '💪', { st: 2, ex: 1 }, { st: 3, ex: 1 });
C('rally', 'Rally Horn', 1, 'S', 'u', '📯', { dr: 3 }, { dr: 4 });
C('wool', 'Woolly Coat', 1, 'S', 'u', '🧶', { dx: 2, ex: 1 }, { dx: 3, ex: 1 });
C('howl', 'Echo Howl', 1, 'S', 'u', '🐺', { vu: 2, all: 1 }, { vu: 3, all: 1 });
// uncommon powers
C('heart', 'Mountain Heart', 1, 'P', 'u', '⛰️', { pBlk: 3 }, { pBlk: 5 });
C('thorny', 'Thorny Hide', 1, 'P', 'u', '🦔', { th: 3 }, { th: 5 });
C('bees', 'Stinger Bees', 1, 'P', 'u', '🐝', { pPs: 1 }, { pPs: 2 });
C('paws', 'Steady Paws', 1, 'P', 'u', '🐾', { dx: 2 }, { dx: 3 });
C('glow', 'Lantern Glow', 2, 'P', 'u', '💡', { pDraw: 1 }, { c: 1 });
// rares
C('meteor', 'Meteor Drop', 3, 'A', 'r', '☄️', { d: 32 }, { d: 42 });
C('inner', 'Inner Ember', 2, 'P', 'r', '🔥', { pStr: 1 }, { c: 1 });
C('form', 'Cairn Form', 3, 'P', 'r', '🗻', { pEn: 1 }, { c: 2 });
C('quake', 'Earthquake', 2, 'A', 'r', '🌋', { d: 14, all: 1, vu: 1 }, { d: 19, all: 1, vu: 2 });
C('unbreak', 'Unbreakable', 2, 'S', 'r', '💠', { b: 30, ex: 1 }, { b: 40, ex: 1 });
C('plague', 'Moth Cloud', 2, 'S', 'r', '🦋', { ps: 12 }, { ps: 16 });
C('thousand', 'Thousand Pebbles', 2, 'A', 'r', '✨', { d: 2, x: 8 }, { d: 2, x: 11 });
C('moon', 'Moonlight Nap', 1, 'S', 'r', '🌙', { hl: 8, ex: 1 }, { hl: 12, ex: 1 });
C('double', 'Double Down', 1, 'S', 'r', '⏫', { sp: 'dblblk' }, { c: 0 });
C('bloom', 'Wild Bloom', 0, 'S', 'r', '🌸', { st: 2, sd: 3 }, { st: 3, sd: 3 });
C('blizzard', 'Blizzard', 2, 'A', 'r', '🌨️', { d: 9, all: 1, wk: 2 }, { d: 12, all: 1, wk: 3 });
C('clover', 'Lucky Clover', 0, 'S', 'r', '🍀', { e: 2, dr: 2, ex: 1 }, { e: 3, dr: 3, ex: 1 });
C('core', 'Glowing Core', 2, 'P', 'r', '🔮', { pAoe: 5 }, { pAoe: 8 });
C('stand', 'Last Stand', 1, 'A', 'r', '🦡', { sp: 'missing', d: 6 }, { sp: 'missing', d: 10 });
C('grove', 'Ancient Grove', 2, 'P', 'r', '🌳', { pBlk: 4, th: 2 }, { pBlk: 6, th: 3 });

export const REL = {
  acorn: { n: 'Ember Acorn', i: '🌰', d: 'Start each fight with 1 Strength.' },
  cushion: { n: 'Moss Cushion', i: '🪺', d: 'Start each fight with 8 Block.' },
  bell: { n: 'Pocket Bell', i: '🔔', d: 'Draw 2 extra cards on your first turn.' },
  honey: { n: 'Honey Jar', i: '🍯', d: 'Heal 5 HP after each fight.' },
  collar: { n: 'Thorn Collar', i: '🌵', d: 'Start each fight with 3 Thorns.' },
  lucky: { n: 'Lucky Stone', i: '🔷', d: 'Fights give 30% more pebbles.' },
  shell: { n: 'Snail Shell', i: '🐚', d: 'Keep up to 6 Block between turns.' },
  nettle: { n: 'Nettle Charm', i: '🌿', d: 'Your first Attack each turn applies 2 Poison.' },
  quill: { n: 'Feather Quill', i: '🪶', d: 'Every 4th card you play draws a card.' },
  kettle: { n: 'Copper Kettle', i: '🫖', d: '+12 max HP.' },
  moth: { n: 'Glow Moth', i: '🦋', d: 'Foes start each fight with 1 Vulnerable.' },
  boots: { n: 'Trail Boots', i: '👢', d: 'Start each fight with 1 Dexterity.' },
  starmap: { n: 'Star Map', i: '🗺️', d: 'Resting heals 50% instead of 30%.' },
  hourglass: { n: 'Sand Timer', i: '⏳', d: 'Gain 2 extra energy on turn 3.' },
  whistle: { n: 'Tin Whistle', i: '🎺', d: 'Whenever you play a Power, gain 5 Block.' },
  owl: { n: 'Sleepy Owl', i: '🦉', d: 'Gain 1 extra energy on your first turn.' },
  compass: { n: 'Old Compass', i: '🧭', d: 'Card rewards offer 4 choices.' },
  // boss relics
  sunstone: { n: 'Sunstone', i: '☀️', d: '+1 energy every turn.', boss: 1 },
  backpack: { n: 'Big Backpack', i: '🎒', d: 'Draw 1 extra card every turn.', boss: 1 },
  bough: { n: 'Golden Bough', i: '🌾', d: '+10 max HP and heal to full.', boss: 1 },
  anvil: { n: 'Cairn Anvil', i: '🔨', d: 'Upgrade 4 random cards now.', boss: 1 },
  crown: { n: 'Moon Crown', i: '👑', d: 'Start each fight with 2 Strength and 2 Dexterity.', boss: 1 },
};

// foes: k = art kind, c = colour, hp range, moves, ai 'cycle' | 'rand'
// move: a attack, h hits, b block, s strength, wk/vu/ps debuff the hero, hl heal, sum summon ids, n name
export const EN = {
  gloop: { n: 'Gloop', k: 'slime', c: '#7ed957', hp: [12, 16], moves: [{ n: 'Splat', a: 6 }, { n: 'Wobble', b: 5, a: 3 }], ai: 'rand' },
  crab: { n: 'Pebble Crab', k: 'crab', c: '#ff9e6b', hp: [18, 22], moves: [{ n: 'Pinch', a: 7 }, { n: 'Shell Up', b: 8 }], ai: 'cycle' },
  spore: { n: 'Sporecap', k: 'mush', c: '#e86a92', hp: [14, 18], moves: [{ n: 'Spore Sneeze', a: 5, wk: 1 }, { n: 'Bonk', a: 7 }], ai: 'rand' },
  buzz: { n: 'Buzzbot', k: 'fly', c: '#7cc6ff', hp: [10, 13], moves: [{ n: 'Zip Zap', a: 3, h: 2 }, { n: 'Dive', a: 5 }], ai: 'rand' },
  brute: { n: 'Mossback Brute', k: 'yeti', c: '#6fbf73', hp: [46, 50], size: 1.3, elite: 1, moves: [{ n: 'Roar', s: 2 }, { n: 'Big Swat', a: 12 }, { n: 'Double Swat', a: 6, h: 2 }], ai: 'cycle' },
  sentry: { n: 'Sentry Bot', k: 'bot', c: '#9aa7ff', hp: [24, 26], elite: 1, moves: [{ n: 'Laser', a: 9, vu: 1 }, { n: 'Shield', b: 10 }], ai: 'cycle' },
  gloopus: { n: 'Grand Gloopus', k: 'slime', c: '#4fd17a', hp: [110, 110], size: 1.7, boss: 1, half: ['gloopkin', 'gloopkin'], moves: [{ n: 'Ooze Spit', a: 7, wk: 1 }, { n: 'Goo Up', b: 12, s: 2 }, { n: 'Belly Flop', a: 20 }], ai: 'cycle' },
  gloopkin: { n: 'Gloopkin', k: 'slime', c: '#b6f28f', hp: [12, 14], size: 0.7, moves: [{ n: 'Splat', a: 4 }, { n: 'Splat', a: 5 }], ai: 'rand' },

  rust: { n: 'Rustbot', k: 'bot', c: '#d98c4a', hp: [32, 36], moves: [{ n: 'Clank', a: 10 }, { n: 'Rivet Spray', a: 4, h: 3 }], ai: 'rand' },
  thorn: { n: 'Thornling', k: 'mush', c: '#8fd16a', hp: [28, 32], th: 3, moves: [{ n: 'Prickle', a: 8 }, { n: 'Curl Up', b: 9, a: 4 }], ai: 'rand' },
  worm: { n: 'Glowworm', k: 'worm', c: '#ffd166', hp: [26, 30], moves: [{ n: 'Sting', a: 7, ps: 3 }, { n: 'Wriggle', a: 9 }], ai: 'rand' },
  owl: { n: 'Owlbot', k: 'owl', c: '#b39ddb', hp: [30, 34], moves: [{ n: 'Hoot', a: 5, vu: 2 }, { n: 'Talon Dive', a: 11 }], ai: 'cycle' },
  crab2: { n: 'Boulder Crab', k: 'crab', c: '#c97b63', hp: [38, 42], size: 1.15, moves: [{ n: 'Crunch', a: 12 }, { n: 'Hunker', b: 12, s: 1 }], ai: 'cycle' },
  yeti: { n: 'Iron Yeti', k: 'yeti', c: '#a7c7e7', hp: [80, 86], size: 1.4, elite: 1, moves: [{ n: 'Puff Up', s: 3, b: 10 }, { n: 'Snow Slam', a: 16 }, { n: 'Flurry', a: 7, h: 2 }], ai: 'cycle' },
  witch: { n: 'Bramble Witchcap', k: 'mush', c: '#9b5de5', hp: [70, 74], size: 1.35, elite: 1, moves: [{ n: 'Spore Cloud', ps: 4, a: 6 }, { n: 'Grow Sporelings', sum: ['sporeling'] }, { n: 'Thorn Bolt', a: 12, wk: 1 }], ai: 'cycle' },
  sporeling: { n: 'Sporeling', k: 'mush', c: '#f4a3c4', hp: [10, 12], size: 0.7, moves: [{ n: 'Bump', a: 5 }], ai: 'rand' },
  warden: { n: 'Clockwork Warden', k: 'bot', c: '#f2b134', hp: [190, 190], size: 1.8, boss: 1, moves: [{ n: 'Shield Up', b: 20, s: 1 }, { n: 'Gear Barrage', a: 5, h: 4 }, { n: 'Steam Burst', a: 14, vu: 2 }, { n: 'Overclock', s: 3, b: 10 }, { n: 'Piston Smash', a: 28 }], ai: 'cycle' },

  storm: { n: 'Storm Slime', k: 'slime', c: '#5e7bff', hp: [44, 48], moves: [{ n: 'Thunder Blob', a: 13 }, { n: 'Static Pops', a: 5, h: 3 }], ai: 'rand' },
  golem: { n: 'Crystal Golem', k: 'golem', c: '#8be9fd', hp: [55, 60], size: 1.15, moves: [{ n: 'Harden', b: 15, s: 1 }, { n: 'Crystal Fist', a: 18 }], ai: 'cycle' },
  mothling: { n: 'Mothling', k: 'moth', c: '#e0aaff', hp: [18, 22], size: 0.75, moves: [{ n: 'Dust', a: 6, ps: 2 }, { n: 'Flutter', a: 8 }], ai: 'rand' },
  imp: { n: 'Frost Imp', k: 'imp', c: '#a0e7e5', hp: [40, 44], moves: [{ n: 'Icicles', a: 9, h: 2 }, { n: 'Chill', a: 6, wk: 2 }], ai: 'rand' },
  ram: { n: 'Thunder Ram', k: 'ram', c: '#ffe066', hp: [120, 126], size: 1.45, elite: 1, moves: [{ n: 'Charge Up', s: 3 }, { n: 'Thunder Butt', a: 24 }, { n: 'Hoof Stomp', a: 8, h: 3 }], ai: 'cycle' },
  mirror: { n: 'Mirror Moth', k: 'moth', c: '#c0c0ff', hp: [40, 42], elite: 1, moves: [{ n: 'Glint', a: 10 }, { n: 'Dazzle', a: 7, vu: 1, wk: 1 }], ai: 'rand' },
  queen: { n: 'Moonmoth Queen', k: 'moth', c: '#b388ff', hp: [260, 260], size: 1.8, boss: 1, moves: [{ n: 'Dust Veil', ps: 6, wk: 2 }, { n: 'Moonbeam', a: 20, vu: 2 }, { n: 'Call Mothlings', sum: ['mothling', 'mothling'] }, { n: 'Wing Storm', a: 6, h: 5 }, { n: 'Lunar Rest', hl: 25, b: 20 }], ai: 'cycle' },
};

export const ACTS = [
  null,
  { name: 'Mossy Foothills', easy: [['gloop'], ['crab'], ['buzz', 'buzz'], ['spore']],
    normal: [['gloop', 'gloop'], ['crab', 'buzz'], ['spore', 'gloop'], ['buzz', 'buzz', 'buzz'], ['crab', 'spore']],
    elite: [['brute'], ['sentry', 'sentry']], boss: ['gloopus'],
    sky: ['#ffb88c', '#ffe3b3'], hills: ['#a6c48a', '#7fa36b', '#557f53'], ground: ['#4a6b46', '#2c4030'] },
  { name: 'Rusty Canyon', easy: [['rust'], ['thorn', 'worm'], ['crab2']],
    normal: [['owl', 'rust'], ['worm', 'worm'], ['owl', 'thorn'], ['rust', 'worm'], ['crab2', 'owl']],
    elite: [['yeti'], ['witch']], boss: ['warden'],
    sky: ['#f6bd60', '#f28482'], hills: ['#d08c60', '#b5654a', '#7d4535'], ground: ['#6b3d33', '#3d221f'] },
  { name: 'Moonlit Summit', easy: [['storm'], ['golem'], ['mothling', 'mothling', 'mothling']],
    normal: [['imp', 'mothling'], ['storm', 'imp'], ['golem', 'mothling'], ['imp', 'imp'], ['storm', 'mothling']],
    elite: [['ram'], ['mirror', 'mirror']], boss: ['queen'],
    sky: ['#232a5c', '#6a5a9e'], hills: ['#7d8cc4', '#55619e', '#353d72'], ground: ['#2b3060', '#171a38'] },
];

// Daubdeck Bingo: rooms on the travel map, their stamp albums, the caller's lines and the level schedule.
// Art ids refer to the AI 3D library (assets/cozy, copied into ./assets): d = diorama rooms, stamps use the renders.

export const ROOMS = [
  { id: 'paris', name: 'Paris Café', d: 'd03', sky: ['#ffd3df', '#fff1df'], card: '#e8457c', card2: '#ff8fb1', dab: '#ff3d7f', glow: '#ffb3c9',
    stamps: ['f01', 'f02', 'f05', 't12', 't11', 't13', 't14', 'g14', 'f04'] },
  { id: 'cottage', name: 'Rose Cottage', d: 'd09', sky: ['#d9f0d6', '#fff4e0'], card: '#3f9f6b', card2: '#7fd49b', dab: '#2fb36a', glow: '#bff0cf',
    stamps: ['g09', 'g10', 'g11', 'h26', 't27', 'h19', 't16', 'g13', 'h34'] },
  { id: 'venice', name: 'Venice Canal', d: 'd05', sky: ['#ffe2bd', '#fff6e6'], card: '#d9782a', card2: '#ffb35c', dab: '#ff8a1f', glow: '#ffd9a8',
    stamps: ['t20', 'h17', 'h15', 'f06', 'h16', 't21', 'f16', 'f07', 'g16'] },
  { id: 'greece', name: 'Greek Isle', d: 'd04', sky: ['#cfe8ff', '#f4fbff'], card: '#2f74d0', card2: '#6fb0ff', dab: '#2f7bff', glow: '#bfe0ff',
    stamps: ['t06', 't18', 't04', 't23', 'f15', 't15', 't28', 't07', 'h23'] },
  { id: 'kyoto', name: 'Kyoto Blossom', d: 'd02', sky: ['#f3d6f5', '#ffeef4'], card: '#a54fc9', card2: '#d69cf0', dab: '#b04dff', glow: '#ead0ff',
    stamps: ['t19', 'z01', 'z02', 'z07', 'z08', 'g06', 'z03', 'g07', 'z05'] },
  { id: 'marrakesh', name: 'Marrakesh Market', d: 'd08', sky: ['#ffd9c2', '#fff0dc'], card: '#c4502f', card2: '#f08a5d', dab: '#e24a2a', glow: '#ffd1bd',
    stamps: ['h21', 'g18', 't30', 't02', 'h08', 't17', 't10', 'h13', 't26'] },
  { id: 'tropics', name: 'Tropical Cove', d: 'd07', sky: ['#c4f3ec', '#f2fff9'], card: '#159c9c', card2: '#4fd6c8', dab: '#12b5a8', glow: '#bff5ee',
    stamps: ['t05', 't08', 't24', 't29', 'f08', 't01', 't03', 't09', 't25'] },
  { id: 'alps', name: 'Alpine Lodge', d: 'd06', sky: ['#dfe4ff', '#fff3ea'], card: '#b0353f', card2: '#e86a72', dab: '#d8323f', glow: '#ffc9cd',
    stamps: ['h09', 'h10', 'f03', 'f17', 'r22', 'r23', 'h12', 'f10', 'h20'] },
];
export const ROUNDS_PER_ROOM = 5;
export const STAMP_NAMES = {
  f01: 'Cappuccino', f02: 'Croissant', f05: 'Macarons', t12: 'Perfume', t11: 'Lipstick', t13: 'Heel', t14: 'Handbag', g14: 'Gâteau', f04: 'Donut',
  g09: 'Teacup', g10: 'Teapot', g11: 'High Tea', h26: 'Roses', t27: 'Candle', h19: 'Sleepy Cat', t16: 'Knitting', g13: 'Cupcake', h34: 'Bird Bath',
  t20: 'Gelato', h17: 'Chandelier', h15: 'Gramophone', f06: 'Torta', h16: 'Old Master', t21: 'Gift', f16: 'Waffle', f07: 'Frappé', g16: 'Wedding Cake',
  t06: 'Lemon', t18: 'Seashell', t04: 'Watermelon', t23: 'Cherries', f15: 'Smoothie', t15: 'Sunnies', t28: 'Sunflower', t07: 'Avocado', h23: 'Fountain',
  t19: 'Sushi', z01: 'Stone Lantern', z02: 'Bonsai', z07: 'Lotus', z08: 'Paper Lantern', g06: 'Blossom', z03: 'Koi Pond', g07: 'Tea Leaf', z05: 'Bamboo',
  h21: 'Old Chest', g18: 'Treasure', t30: 'Piggy Bank', t02: 'Banana', h08: 'Rug', t17: 'Cactus', t10: 'Clock', h13: 'Vanity', t26: 'Hair Dryer',
  t05: 'Pineapple', t08: 'Rubber Duck', t24: 'Butterfly', t29: 'Frog', f08: 'Bubble Tea', t01: 'Apple', t03: 'Strawberry', t09: 'Teddy', t25: 'Nail Polish',
  h09: 'Fireplace', h10: 'Grandfather Clock', f03: 'Pancakes', f17: 'Cinnamon Roll', r22: 'Bread', r23: 'Honey', h12: 'Dresser', f10: 'Espresso', h20: 'Piano',
};

// the caller's traditional bingo nicknames (Mr Mustard reads one out now and then)
export const CALLS = {
  1: "Kelly's eye", 2: 'One little duck', 3: 'Cup of tea', 4: 'Knock at the door', 5: 'Man alive', 7: 'Lucky seven', 8: 'Garden gate',
  9: "Doctor's orders", 10: 'Cock and hen', 11: 'Legs eleven', 12: 'One dozen', 13: "Unlucky for some", 14: 'Valentine\'s day', 16: 'Sweet sixteen',
  17: 'Dancing queen', 21: 'Key of the door', 22: 'Two little ducks', 23: 'Thee and me', 26: 'Pick and mix', 27: 'Gateway to heaven',
  28: 'In a state', 30: 'Dirty Gertie', 32: 'Buckle my shoe', 33: 'All the threes', 39: 'Steps', 44: 'Droopy drawers', 45: 'Halfway there',
  48: 'Four dozen', 50: "Half a century", 52: 'Deck of cards', 55: 'Snakes alive', 57: 'Heinz varieties', 59: 'Brighton line', 62: 'Tickety-boo',
  64: 'Almost retired', 65: 'Stop work', 66: 'Clickety click', 69: 'Either way up', 71: 'Bang on the drum', 72: 'Six dozen', 73: 'Queen bee',
  74: 'Hit the floor', 75: 'Strive and strive',
};
export const LETTER = n => 'BINGO'[Math.min(4, Math.floor((n - 1) / 15))];
export const BALL_COLORS = ['#2f7bff', '#ff3d5a', '#f1f1f6', '#2fbf5b', '#ffb21f'];   // B I N G O
export const ballColor = n => BALL_COLORS[Math.min(4, Math.floor((n - 1) / 15))];

// ---------------------------------------------------------------- patterns (5×5, index = row*5 + col, 12 = free centre)
const ROW = r => [0, 1, 2, 3, 4].map(c => r * 5 + c), COL = c => [0, 1, 2, 3, 4].map(r => r * 5 + c);
export const SHAPES = {
  line: { name: 'Any line', icon: [...ROW(2)], masks: [0, 1, 2, 3, 4].map(ROW).concat([0, 1, 2, 3, 4].map(COL), [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]]) },
  corners: { name: 'Four corners', icon: [0, 4, 20, 24], masks: [[0, 4, 20, 24]] },
  stamp: { name: 'Postage stamp', icon: [3, 4, 8, 9], masks: [[0, 1, 5, 6], [3, 4, 8, 9], [15, 16, 20, 21], [18, 19, 23, 24]] },
  diamond: { name: 'Little diamond', icon: [7, 11, 13, 17], masks: [[7, 11, 12, 13, 17]] },
  plus: { name: 'Plus', icon: [2, 7, 10, 11, 12, 13, 14, 17, 22], masks: [[2, 7, 10, 11, 12, 13, 14, 17, 22]] },
  x: { name: 'Big X', icon: [0, 6, 12, 18, 24, 4, 8, 16, 20], masks: [[0, 6, 12, 18, 24, 4, 8, 16, 20]] },
};

// ---------------------------------------------------------------- level schedule
// balls = the round's ball budget, from a 6000-round simulation of these rules (2 cards, one power-up per full meter):
// TUNE[key] = balls by which a bingo has landed in [97%, 88%, 80%, 62%] of rounds. First 5 rounds use 97%, normal
// rounds 88%, the daily 80%, and the short "Hard" round (1 in 6) 62%. More cards raise every number (Fair play panel).
export const TUNE = {
  'line': [49, 43, 40, 36],
  'corners+line': [48, 43, 40, 35],
  'line+stamp': [46, 41, 38, 33],
  'corners': [71, 65, 62, 55],
  'stamp': [56, 50, 46, 41],
  'corners+diamond': [63, 57, 54, 48],
  'diamond': [70, 65, 62, 56],
  'line+plus': [48, 43, 40, 36],
  'x': [73, 70, 68, 64],
};
const NORMAL = [['line'], ['corners', 'line'], ['line', 'stamp'], ['line'], ['corners', 'diamond'], ['line', 'plus'], ['line'], ['stamp']];
const HARD = [['stamp'], ['corners'], ['diamond'], ['stamp']];
export const keyOf = shapes => shapes.slice().sort().join('+');

export function levelDef(n) {
  const room = Math.floor((n - 1) / ROUNDS_PER_ROOM) % ROOMS.length, round = (n - 1) % ROUNDS_PER_ROOM + 1;
  const hard = n >= 6 && n % 6 === 0;
  let shapes, q;
  if (n <= 3) { shapes = ['line']; q = 0; }
  else if (n <= 5) { shapes = n === 4 ? ['corners', 'line'] : ['line', 'stamp']; q = 0; }
  else if (hard) { shapes = HARD[(n / 6 - 1) % HARD.length]; q = 3; }
  else { shapes = NORMAL[(n * 7) % NORMAL.length]; q = 1; }
  const t = TUNE[keyOf(shapes)] || TUNE.line;
  return { n, room, round, hard, shapes, balls: t[q], q };
}
export const DAILY = (seed) => {   // daily: shape of the day, tuned to ~80% (2 cards)
  const opts = [['line'], ['corners', 'line'], ['line', 'stamp'], ['stamp'], ['corners', 'diamond']];
  const shapes = opts[seed % opts.length];
  return { n: 0, daily: true, room: seed % ROOMS.length, round: 0, hard: false, shapes, balls: (TUNE[keyOf(shapes)] || TUNE.line)[2], q: 2 };
};

// power-ups, drawn fairly from this table (shown in the Fair play panel)
export const POWERS = [
  { id: 'daub', icon: '✨', name: 'Magic Daub', line: 'daubs a random square', w: 30 },
  { id: 'pick', icon: '🎯', name: 'Pick a Square', line: 'you daub any square', w: 15 },
  { id: 'coins', icon: '💰', name: 'Coin Purses', line: '3 purses on your cards', w: 20 },
  { id: 'stamp', icon: '📮', name: 'Stamp Gift', line: 'a stamp on your cards', w: 15 },
  { id: 'balls', icon: '🎱', name: '+3 Balls', line: 'three more calls', w: 10 },
  { id: 'double', icon: '⚡', name: 'Double Pay', line: 'next bingo pays ×2', w: 10 },
];
export const POWER_DAUBS = 8;      // daubs to charge the power-up meter
export const MAX_BINGOS = 3;       // per card per round
export const CARD_COST = 20;       // coins per extra card (the first card is always free)
export const PAY = { first: 60, more: 40, quick: 15, purse: 20, dupe: 25, room: 200, album: 500 };

// Bluebell Bingo: the garden rooms on the map, their stamps and plants, the caller's lines and the round schedule.
// Art: the Storybook Garden library (assets/storybook, copied into ./assets). All words are drawn in code.

export const ROOMS = [
  { id: 'wood', name: 'Bluebell Wood', short: 'Bluebell Wood', bg: 'bluebell-bingo', dab: 'navy', plant: 'larkspur', stamps: ['bluebells', 'owl', 'robin'] },
  { id: 'tea', name: 'The Rose Tea Room', short: 'Tea Room', bg: 'bingo-tearoom', dab: 'rose', plant: 'rose', stamps: ['teapot', 'teacup', 'strawberry'] },
  { id: 'sea', name: 'Seaside Promenade', short: 'Seaside', bg: 'bingo-seaside', dab: 'navy', plant: 'lavender', stamps: ['lighthouse', 'sailboat', 'swan'] },
  { id: 'fete', name: 'The Village Fête', short: 'Village Fête', bg: 'bingo-fete', dab: 'sage', plant: 'sunflower', stamps: ['beehive', 'sunflower', 'cat'] },
  { id: 'gazebo', name: 'Peony Gazebo', short: 'Gazebo', bg: 'peony-mahjong', dab: 'rose', plant: 'peony', stamps: ['peony', 'hydrangea', 'butterfly'] },
  { id: 'walled', name: 'The Walled Garden', short: 'Walled Garden', bg: 'rosewick', dab: 'sage', plant: 'tulip', stamps: ['rose', 'tulip', 'hedgehog'] },
  { id: 'orchard', name: 'Orchard Lane', short: 'Orchard', bg: 'robins-rescue', dab: 'rose', plant: 'poppy', stamps: ['bluetit', 'squirrel', 'fox'] },
  { id: 'terrace', name: 'The Sunny Terrace', short: 'Terrace', bg: 'hub', dab: 'navy', plant: 'hydrangea', stamps: ['cottage', 'lavender', 'kingfisher'] },
];
export const ROUNDS_PER_ROOM = 5;
export const STAMP_NAMES = {
  bluebells: 'Bluebells', owl: 'Tawny Owl', robin: 'Robin', teapot: 'Teapot', teacup: 'Teacup', strawberry: 'Strawberries',
  lighthouse: 'Lighthouse', sailboat: 'Sailboat', swan: 'Swan', beehive: 'Beehive', sunflower: 'Sunflower', cat: 'Garden Cat',
  peony: 'Peony', hydrangea: 'Hydrangea', butterfly: 'Butterfly', rose: 'Rose', tulip: 'Tulip', hedgehog: 'Hedgehog',
  bluetit: 'Blue Tit', squirrel: 'Squirrel', fox: 'Fox', cottage: 'Cottage', lavender: 'Lavender', kingfisher: 'Kingfisher',
};
// ball colours by column: B rose · I sage · N navy · G gold · O lilac (painted balls with an ivory centre)
export const BALL = ['rose', 'sage', 'navy', 'gold', 'lilac'];
export const ballOf = n => BALL[Math.min(4, Math.floor((n - 1) / 15))];
export const DAB_INK = { navy: '#FAF6EC', rose: '#1F2D54', sage: '#1F2D54' };   // number colour on top of each dab

// traditional bingo calls, read out now and then by the caller
export const CALLS = {
  1: "Kelly's eye", 2: 'One little duck', 3: 'Cup of tea', 4: 'Knock at the door', 5: 'Man alive', 7: 'Lucky seven', 8: 'Garden gate',
  9: "Doctor's orders", 10: 'Cock and hen', 11: 'Legs eleven', 12: 'One dozen', 13: 'Unlucky for some', 14: "Valentine's day",
  16: 'Sweet sixteen', 17: 'Dancing queen', 21: 'Key of the door', 22: 'Two little ducks', 23: 'Thee and me', 26: 'Pick and mix',
  27: 'Gateway to heaven', 30: 'Burlington Bertie', 32: 'Buckle my shoe', 33: 'All the threes', 39: 'Steps', 44: 'Droopy drawers',
  45: 'Halfway there', 48: 'Four dozen', 50: 'Half a century', 52: 'Deck of cards', 55: 'Snakes alive', 59: 'Brighton line',
  62: 'Tickety-boo', 64: 'Almost retired', 65: 'Stop work', 66: 'Clickety click', 71: 'Bang on the drum', 72: 'Six dozen',
  73: 'Queen bee', 74: 'Hit the floor', 75: 'Strive and strive',
};

// ---------------------------------------------------------------- schedule
// Ball budgets come from tools/tune.mjs (8000 simulated rounds per pattern, 2 cards, no power-ups): the number of balls
// by which the first bingo has landed in [97%, 88%, 80%, 62%] of rounds. Rounds 1–5 use 97% (near-certain), normal
// rounds 88%, the daily 80%, and the short "Tricky" round (1 in 6) 62%. One card is a little lower, more cards higher:
// the Fair play sheet shows the exact chance for 1–4 cards. Budgets never change with coins, purchases or results.
export const TUNE = {
  'line': [51, 46, 43, 39],
  'corners+line': [51, 45, 43, 38],
  'line+stamp': [49, 44, 41, 36],
  'stamp': [59, 53, 50, 45],
  'corners+diamond': [67, 61, 58, 52],
  'line+plus': [51, 46, 44, 39],
};
export const keyOf = shapes => shapes.slice().sort().join('+');
const NORMAL = [['line'], ['corners', 'line'], ['line', 'stamp'], ['line', 'plus'], ['stamp'], ['line'], ['corners', 'diamond'], ['line', 'stamp']];
const TRICKY = [['stamp'], ['corners', 'diamond'], ['line']];

export function levelDef(n) {
  const room = Math.floor((n - 1) / ROUNDS_PER_ROOM) % ROOMS.length, round = (n - 1) % ROUNDS_PER_ROOM + 1;
  const hard = n >= 6 && n % 6 === 0;
  let shapes, q;
  if (n <= 3) { shapes = ['line']; q = 0; }
  else if (n <= 5) { shapes = n === 4 ? ['corners', 'line'] : ['line', 'stamp']; q = 0; }
  else if (hard) { shapes = TRICKY[(n / 6 - 1) % TRICKY.length]; q = 3; }
  else { shapes = NORMAL[(n * 5) % NORMAL.length]; q = 1; }
  return { n, room, round, hard, shapes, balls: (TUNE[keyOf(shapes)] || TUNE.line)[q], q };
}
export function DAILY(seed) {   // the daily round: pattern of the day, 2 free cards, tuned to ~80%
  const opts = [['line'], ['corners', 'line'], ['line', 'stamp'], ['stamp'], ['line', 'plus']];
  const shapes = opts[seed % opts.length];
  return { n: 0, daily: true, room: seed % ROOMS.length, round: 0, hard: false, shapes, balls: (TUNE[keyOf(shapes)] || TUNE.line)[2], q: 2 };
}

export const POWER_DAUBS = 8;      // daubs that charge the power-up
export const CARD_COST = 20;       // coins per extra card (first card always free; first two in rounds 1–5 and the daily)
export const BOOST_COST = 40;      // Bluebell Boost: start the round with the power-up charged
export const PAY = { first: 60, more: 40, purse: 20, dupe: 25, room: 200, album: 150 };
export const SPEEDS = { slow: 4.6, normal: 3.0 };   // seconds between balls

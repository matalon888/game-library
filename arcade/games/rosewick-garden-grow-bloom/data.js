// Rosewick Garden: content tables (species, villagers, decorations, keepsake stamps).
// Grow times are real seconds for the whole seedling → bloom journey (3 stages). Minutes, never hours.

export const SPECIES = [
  // id, name, grow (s), seed cost, stem value, garden level needed, unlock cost (coins), emoji for the share grid, note
  { id: 'daisy',     name: 'Daisy',      grow: 30,  seed: 2,  value: 4,  lvl: 1, unlock: 0,   emoji: '🌼', note: 'Opens with the sun and closes at dusk: the "day\'s eye".' },
  { id: 'tulip',     name: 'Tulip',      grow: 45,  seed: 3,  value: 5,  lvl: 1, unlock: 0,   emoji: '🌷', note: 'Keeps growing in the vase, and bends toward the light.' },
  { id: 'sunflower', name: 'Sunflower',  grow: 60,  seed: 4,  value: 7,  lvl: 1, unlock: 0,   emoji: '🌻', note: 'Young heads follow the sun from east to west.' },
  { id: 'sweet-pea', name: 'Sweet Pea',  grow: 90,  seed: 5,  value: 9,  lvl: 2, unlock: 40,  emoji: '🌸', note: 'The more you pick, the more it blooms.' },
  { id: 'lavender',  name: 'Lavender',   grow: 120, seed: 6,  value: 11, lvl: 3, unlock: 70,  emoji: '💜', note: 'Bees adore it; dried bunches scent a linen drawer.' },
  { id: 'poppy',     name: 'Poppy',      grow: 150, seed: 7,  value: 13, lvl: 4, unlock: 100, emoji: '🔴', note: 'Seeds can sleep in the soil for decades, then wake.' },
  { id: 'rose',      name: 'Rose',       grow: 180, seed: 9,  value: 16, lvl: 5, unlock: 140, emoji: '🌹', note: 'Old English roses were bred for scent before shape.' },
  { id: 'larkspur',  name: 'Larkspur',   grow: 240, seed: 11, value: 19, lvl: 6, unlock: 180, emoji: '💙', note: 'Each flower hides a little spur, like a lark\'s claw.' },
  { id: 'peony',     name: 'Peony',      grow: 300, seed: 13, value: 23, lvl: 7, unlock: 230, emoji: '🩷', note: 'A happy peony can bloom in the same spot for 100 years.' },
  { id: 'foxglove',  name: 'Foxglove',   grow: 360, seed: 15, value: 27, lvl: 8, unlock: 290, emoji: '🪻', note: 'Bumblebees climb right inside the speckled bells.' },
  { id: 'dahlia',    name: 'Dahlia',     grow: 420, seed: 17, value: 31, lvl: 9, unlock: 360, emoji: '🏵️', note: 'Grown from tubers; one plant gives armfuls till frost.' },
  { id: 'hydrangea', name: 'Hydrangea',  grow: 600, seed: 20, value: 38, lvl: 10, unlock: 450, emoji: '💠', note: 'Acid soil turns it blue, chalky soil turns it pink.' },
];
export const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const STAGES = ['seedling', 'young', 'bud', 'bloom'];

export const VILLAGERS = [
  { id: 'hedgehog',  name: 'Mrs Hedgewick', stamp: 'hedgehog',  says: ['Oh, how lovely!', 'For my kitchen table, thank you dear.', 'They smell like June.'] },
  { id: 'robin',     name: 'Miss Robin',    stamp: 'robin',     says: ['A posy for the choir!', 'Tweet-tweet, perfect!', 'You have a gift, truly.'] },
  { id: 'fox',       name: 'Mr Russet',     stamp: 'fox',       says: ['Splendid stems.', 'For the harvest supper.', 'Most kind, most kind.'] },
  { id: 'owl',       name: 'Professor Hoot',stamp: 'owl',       says: ['Remarkable specimens.', 'For my study, by the lamp.', 'I shall press one in a book.'] },
  { id: 'squirrel',  name: 'Nutmeg',        stamp: 'squirrel',  says: ['For my mum!', 'Wheee, flowers!', 'Better than acorns!'] },
  { id: 'cat',       name: 'Tabitha',       stamp: 'cat',       says: ['Purrfect for the windowsill.', 'I may nap beside them.', 'Mrrow, very nice.'] },
  { id: 'swan',      name: 'Lady Swann',    stamp: 'swan',      says: ['For the lake-house ball.', 'Exquisite, darling.', 'Simply divine.'] },
  { id: 'kingfisher',name: 'Captain Kingsley', stamp: 'kingfisher', says: ['For the riverboat!', 'Shipshape bouquet.', 'Bright as a summer river.'] },
  { id: 'bluetit',   name: 'Little Wren',   stamp: 'bluetit',   says: ['For Grandma\'s birthday!', 'So pretty!', 'I\'ll tie a ribbon on it.'] },
];
export const VIL = Object.fromEntries(VILLAGERS.map(v => [v.id, v]));

// decoration slots (fractions of the garden rect are set per layout in game.js); items cost coins, add charm
export const DECOR = [
  { id: 'watering-can', name: 'Watering can', cost: 40,  charm: 1 },
  { id: 'birdhouse',    name: 'Birdhouse',    cost: 80,  charm: 1 },
  { id: 'lantern',      name: 'Lantern',      cost: 110, charm: 1 },
  { id: 'birdbath',     name: 'Birdbath',     cost: 150, charm: 2 },
  { id: 'wheelbarrow',  name: 'Wheelbarrow',  cost: 190, charm: 2 },
  { id: 'beehive',      name: 'Beehive',      cost: 240, charm: 2 },
  { id: 'bench',        name: 'Garden bench', cost: 300, charm: 3 },
  { id: 'urn',          name: 'Stone urn',    cost: 360, charm: 3 },
  { id: 'trellis',      name: 'Clematis trellis', cost: 420, charm: 3 },
  { id: 'sundial',      name: 'Sundial',      cost: 500, charm: 4 },
  { id: 'rose-arch',    name: 'Rose arch',    cost: 600, charm: 4 },
  { id: 'fountain',     name: 'Fountain',     cost: 750, charm: 5 },
];
export const DEC = Object.fromEntries(DECOR.map(d => [d.id, d]));

// keepsake stamps for the album, earned in this order (villager stamps come when you first serve that villager)
export const STAMPS = ['teacup', 'bluebells', 'butterfly', 'beehive', 'cottage', 'strawberry', 'teapot', 'rose', 'tulip',
  'sunflower', 'lavender', 'peony', 'hydrangea', 'lighthouse', 'sailboat'];

// plot unlock prices, in order (first 4 plots are open from the start)
export const PLOT_COST = [0, 0, 0, 0, 60, 110, 170, 250, 350];

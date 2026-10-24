// Dumpling Dash — menu, stations, restaurants, levels, album. Pure data + the level generator (no DOM, no three.js).
import { rng, clamp } from './kit/hc.js';

// dishes: m = model id (assets/<m>.glb + icons/<m>.webp), p = price, st = station that makes it, s = size on a slot
export const DISH = {
  boba: { m: 't01', n: 'Boba tea', p: 4, st: 'tap', s: 0.65 },
  mochi: { m: 't02', n: 'Mochi', p: 3, st: 'grab', s: 0.57 },
  pan: { m: 'f08', n: 'Pancakes', p: 6, st: 'griddle', s: 0.68, tops: ['str'] },
  soft: { m: 't08', n: 'Soft serve', p: 4, st: 'swirl', s: 0.65 },
  dump: { m: 'f01', n: 'Dumplings', p: 6, st: 'steam', s: 0.60, tops: ['soy'] },
  bao: { m: 'f02', n: 'Bao bun', p: 5, st: 'steam2', s: 0.60 },
  tea: { m: 'f09', n: 'Jasmine tea', p: 3, st: 'pour', s: 0.55 },
  ramen: { m: 'f03', n: 'Ramen', p: 8, st: 'pot', s: 0.70, tops: ['egg'] },
  oni: { m: 'f05', n: 'Onigiri', p: 4, st: 'grab', s: 0.57 },
  sushi: { m: 'f04', n: 'Salmon nigiri', p: 6, st: 'board', s: 0.62, tops: ['soy'] },
  cake: { m: 'g11', n: 'Shortcake', p: 8, st: 'oven', s: 0.65 },
  cup: { m: 'g09', n: 'Cupcake', p: 4, st: 'grab', s: 0.57 },
  mac: { m: 'g08', n: 'Macarons', p: 4, st: 'grab', s: 0.57 },
};
// toppings, added on a plate: +price each
export const TOP = {
  str: { n: 'Strawberry', p: 2, m: 't03', icon: './assets/icons/t03.webp' },
  egg: { n: 'Egg', p: 2, icon: 'egg' },
  soy: { n: 'Soy dip', p: 2, icon: 'soy' },
};
// cook stations: t = seconds to cook one, item it makes
export const STN = {
  tap: { n: 'Boba tap', t: 1.8, item: 'boba', snd: 'pour' },
  griddle: { n: 'Griddle', t: 2.6, item: 'pan', snd: 'sizzle' },
  swirl: { n: 'Swirl machine', t: 1.5, item: 'soft', snd: 'whirr' },
  steam: { n: 'Dumpling steamer', t: 2.8, item: 'dump', snd: 'steam' },
  steam2: { n: 'Bao steamer', t: 2.6, item: 'bao', snd: 'steam' },
  pour: { n: 'Tea warmer', t: 1.3, item: 'tea', snd: 'pour' },
  pot: { n: 'Ramen pot', t: 3.2, item: 'ramen', snd: 'bubble' },
  board: { n: 'Sushi board', t: 1.8, item: 'sushi', snd: 'chop' },
  oven: { n: 'Oven', t: 3.4, item: 'cake', snd: 'ding' },
};

// restaurants on the map. menu: [dish, level it unlocks at]; tops: [topping, level]; kitchen = cook row; front = grabs + jars
export const REST = [
  { id: 'boba', n: 'Bunny Boba', tag: 'boba · pancakes · mochi', icon: 't01', need: 0,
    theme: { wall: '#e6c6ff', wall2: '#ffc4e1', dots: '#ffffff', floorA: '#ffaed0', floorB: '#ffe6f2', counter: '#ff8fbf', counter2: '#ffd2e6', trim: '#b58cff', top: '#fff7fb', bg: '#f6d7ff', sign: '#ff5da2', lamp: '#ffd1f0', accent: '#7fe0c4' },
    kitchen: ['tap', 'griddle', 'swirl'], front: ['g:mochi', 't:str'],
    menu: [['boba', 1], ['mochi', 2], ['pan', 3], ['soft', 6]], tops: [['str', 5]],
    decor: [{ id: 'h07', n: 'Succulent', cost: 270, size: 0.62, pos: null }, { id: 'h06', n: 'Mushroom lamp', cost: 480, size: 1.1, pos: null },
      { id: 'h05', n: 'Cloud rug', cost: 720, size: 2.2, pos: null }, { id: 'r01', n: 'Blossom tree', cost: 1080, size: 2.0, pos: null }] },
  { id: 'dump', n: 'Dumpling Den', tag: 'dumplings · bao · tea', icon: 'f01', need: 10,
    theme: { wall: '#c8f3e3', wall2: '#ffe0cf', dots: '#ffffff', floorA: '#ffe7a8', floorB: '#fffaf0', counter: '#ff9f87', counter2: '#ffd7c9', trim: '#4fcfa6', top: '#fffaf4', bg: '#d4f7e8', sign: '#ff7a59', lamp: '#ffd27a', accent: '#ff8fbf' },
    kitchen: ['steam', 'steam2', 'pour'], front: ['g:mochi', 't:soy'],
    menu: [['dump', 1], ['tea', 1], ['bao', 2], ['mochi', 4]], tops: [['soy', 3]],
    decor: [{ id: 'h07', n: 'Succulent', cost: 360, size: 0.62, pos: null }, { id: 'h12', n: 'Cat tree', cost: 600, size: 1.7, pos: null },
      { id: 'h10', n: 'Tea table', cost: 900, size: 1.4, pos: null }, { id: 'r01', n: 'Blossom tree', cost: 1260, size: 2.0, pos: null }] },
  { id: 'ramen', n: 'Ramen Moon', tag: 'ramen · onigiri · gyoza', icon: 'f03', need: 24,
    theme: { wall: '#cbb8ff', wall2: '#a996f2', dots: '#fff6b8', floorA: '#d9cbff', floorB: '#f7f2ff', counter: '#8f7cf0', counter2: '#cbbdff', trim: '#ffcf5a', top: '#fbf8ff', bg: '#c8b6ff', sign: '#7a5cff', lamp: '#fff0a6', accent: '#ff9fd0' },
    kitchen: ['pot', 'steam', 'pour'], front: ['g:oni', 't:egg', 't:soy'],
    menu: [['ramen', 1], ['oni', 1], ['tea', 2], ['dump', 3]], tops: [['egg', 2], ['soy', 5]],
    decor: [{ id: 'h06', n: 'Mushroom lamp', cost: 450, size: 1.1, pos: null }, { id: 'h07', n: 'Succulent', cost: 660, size: 0.62, pos: null },
      { id: 'h10', n: 'Moon table', cost: 960, size: 1.4, pos: null }, { id: 'h12', n: 'Cat tree', cost: 1380, size: 1.7, pos: null }] },
  { id: 'sushi', n: 'Sushi Star', tag: 'nigiri · ramen · boba', icon: 'f04', need: 40,
    theme: { wall: '#fff0b3', wall2: '#bfeaff', dots: '#ffffff', floorA: '#ffc9b5', floorB: '#fffaf0', counter: '#6fc9f2', counter2: '#c8eeff', trim: '#ff8f8f', top: '#ffffff', bg: '#fff3c4', sign: '#ff6f61', lamp: '#ffe08a', accent: '#ff8fbf' },
    kitchen: ['board', 'pot', 'tap'], front: ['g:oni', 'g:mochi', 't:soy', 't:egg'],
    menu: [['sushi', 1], ['oni', 1], ['boba', 2], ['ramen', 3], ['mochi', 5]], tops: [['soy', 2], ['egg', 4]],
    decor: [{ id: 'h07', n: 'Succulent', cost: 540, size: 0.62, pos: null }, { id: 'h06', n: 'Mushroom lamp', cost: 780, size: 1.1, pos: null },
      { id: 'h05', n: 'Cloud rug', cost: 1080, size: 2.2, pos: null }, { id: 'r01', n: 'Blossom tree', cost: 1560, size: 2.0, pos: null }] },
  { id: 'sweet', n: 'Cloud Bakery', tag: 'shortcake · pancakes · macarons', icon: 'g11', need: 58,
    theme: { wall: '#ffd6e7', wall2: '#d8f0ff', dots: '#ffffff', floorA: '#ff9fc0', floorB: '#fff5f9', counter: '#ffffff', counter2: '#ffe3ee', trim: '#ff6fa8', top: '#fff7fb', bg: '#ffd9ea', sign: '#ff4f93', lamp: '#fff3c4', accent: '#8fd8ff' },
    kitchen: ['oven', 'griddle', 'swirl'], front: ['g:cup', 'g:mac', 't:str'],
    menu: [['cake', 1], ['cup', 1], ['pan', 2], ['mac', 3], ['soft', 5]], tops: [['str', 2]],
    decor: [{ id: 'h11', n: 'Cake case', cost: 660, size: 1.1, pos: null }, { id: 'h06', n: 'Mushroom lamp', cost: 900, size: 1.1, pos: null },
      { id: 'h12', n: 'Cat tree', cost: 1260, size: 1.7, pos: null }, { id: 'r01', n: 'Blossom tree', cost: 1800, size: 2.0, pos: null }] },
];
export const LEVELS_PER = 8;
// where décor goes (visible on a phone too): back corners by the door, then the sides of the queue; rugs lie in the middle
export const DECOR_POS = [[-1.95, 0, -5.25], [1.95, 0, -5.25], [-2.35, 0, -4.05], [2.35, 0, -4.05]];

// customers: k02..k07 chibi friends (k01 is the chef)
export const FRIENDS = [
  { id: 'k02', n: 'Momo', h: 1.3 }, { id: 'k03', n: 'Juju', h: 1.3 }, { id: 'k04', n: 'Rin', h: 1.3 },
  { id: 'k06', n: 'Bunbun', h: 0.9 }, { id: 'k07', n: 'Purrin', h: 0.9 },
];

// album: 27 stickers in 3 pages
export const STICKERS = [
  ...Object.entries(DISH).map(([k, d]) => ({ id: 'd_' + k, n: d.n, icon: `./assets/icons/${d.m}.webp`, how: `Serve ${d.n}`, page: 0 })),
  ...FRIENDS.map(f => ({ id: 'f_' + f.id, n: f.n, icon: `./assets/icons/${f.id}.webp`, how: `Make ${f.n} happy 5 times`, page: 1 })),
  { id: 'x_combo5', n: 'Combo star', icon: './assets/icons/m03.webp', how: 'Reach a x5 combo', page: 1 },
  { id: 'x_perfect', n: 'Nobody left', icon: './assets/icons/x05.webp', how: 'Finish a day with every guest happy', page: 1 },
  { id: 'x_daily', n: 'Daily sparkle', icon: './assets/icons/x04.webp', how: 'Win a Daily Rush', page: 1 },
  ...REST.map(r => ({ id: 'r_' + r.id, n: r.n, icon: `./assets/icons/${r.icon}.webp`, how: `Clear all ${LEVELS_PER} days at ${r.n}`, page: 2, rest: true })),
  { id: 'x_trophy', n: 'Golden whisk', icon: './assets/icons/w11.webp', how: 'Earn 3 stars on 10 days', page: 2 },
  { id: 'x_streak', n: '3-day streak', icon: './assets/icons/x02.webp', how: 'Play the Daily Rush 3 days in a row', page: 2 },
];
export const PAGE_GIFT = [250, 400, 600];

// ---------------------------------------------------------------- level generator
// gl = global level (1-based: restaurant r, day i → (r)*8 + i). Days 1–5 are near-certain wins; then a gentle sawtooth with a
// short Hard day every 6th. fk = flow multiplier (1 for board players / daily). Same inputs → same day.
export function levelConfig(ri, i, { fk = 1, seed = null, daily = false } = {}) {
  const R = REST[ri], gl = ri * LEVELS_PER + i;
  const r = rng(seed != null ? seed : gl * 7919 + 131);
  const lvlInR = daily ? 6 : i;
  const menu = R.menu.filter(([, l]) => l <= lvlInR).map(([k]) => k);
  const tops = R.tops.filter(([, l]) => l <= lvlInR).map(([k]) => k);
  const debut = R.menu.filter(([, l]) => l === lvlInR && !daily).map(([k]) => k).concat(R.tops.filter(([, l]) => l === lvlInR && !daily).map(([k]) => 'top:' + k));
  const hard = !daily && gl > 6 && gl % 6 === 0;
  const easy = gl <= 5 && !daily;
  // pace: base difficulty climbs with gl, dips at the start of each restaurant (new menu to learn), Hard days are short
  const d = daily ? 0.45 : clamp((gl - 1) / 34, 0, 1) * (i <= 2 && ri > 0 ? 0.75 : 1);
  let n = gl === 1 ? 5 : gl === 2 ? 6 : Math.round(clamp(7 + gl * 0.6, 7, 22)); if (hard) n = Math.round(n * 0.7); if (daily) n = 14;
  const maxItems = gl <= 3 ? 1 : gl <= 10 ? 2 : 3;
  const specs = [];
  for (let c = 0; c < n; c++) {
    let cnt = 1 + Math.floor(r() * maxItems); if (c < 2 && !daily) cnt = 1;
    const order = [];
    for (let j = 0; j < cnt; j++) {
      let k = debut.length && r() < 0.4 && !debut[0].startsWith('top:') ? debut[0] : menu[Math.floor(r() * menu.length)];
      if (order.some(o => o.k === k) && menu.length > 1) k = menu.find(q => !order.some(o => o.k === q)) || k;
      const can = (DISH[k].tops || []).filter(t => tops.includes(t));
      const topChance = debut.some(x => x.startsWith('top:')) ? 0.7 : 0.4;
      const t = can.length && r() < topChance ? [can[Math.floor(r() * can.length)]] : [];
      order.push({ k, tops: t });
    }
    specs.push({ order, who: Math.floor(r() * 1000) });
  }
  const value = o => DISH[o.k].p + o.tops.reduce((a, t) => a + TOP[t].p, 0);
  const sum = specs.reduce((s, sp) => s + sp.order.reduce((a, o) => a + value(o), 0), 0);
  // patience in seconds (per order; +20% per extra item), gap between arrivals
  const pat = (easy ? 46 : clamp(38 - d * 16, 20, 38) * (hard ? 0.88 : 1)) / fk;
  const gap = (easy ? 5.2 - gl * 0.15 : clamp(4.6 - d * 2.0, 2.4, 4.6) * (hard ? 0.85 : 1)) / fk;
  const tipRate = 0.3;
  const maxPot = sum * (1 + tipRate) + n * 4;
  const g1 = easy ? 0.42 : daily ? 0.62 : clamp(0.55 + d * 0.15, 0.55, 0.72) * (hard ? 1.03 : 1);
  const goal = Math.max(10, Math.round(sum * g1 / 5) * 5);
  const s2 = Math.max(goal + 5, Math.round(maxPot * (easy ? 0.66 : 0.72) / 5) * 5), s3 = Math.max(s2 + 5, Math.round(maxPot * (easy ? 0.8 : 0.86) / 5) * 5);
  return { ri, i, gl, R, menu, tops, debut, hard, easy, daily, n, specs, pat, gap, goal, stars: [goal, s2, s3], sum, spots: gl <= 2 ? 2 : 3, r };
}

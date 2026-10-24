// Bluebell Bingo rules: pure logic (runs in the browser and in node for the tuning sim, tools/tune.mjs).
// 75-ball bingo: column B 1–15, I 16–30, N 31–45 (free centre), G 46–60, O 61–75.
// Fairness: every normal round draws card numbers, the ball order, power-ups and prize squares from the device's
// cryptographic random generator (crypto.getRandomValues), uniform and identical for every player. The daily round
// uses one shared seed instead, so everyone plays the same balls. Nothing reads coins, purchases or past results.

export function fairRng() {
  const a = new Uint32Array(1);
  return () => { crypto.getRandomValues(a); return a[0] / 4294967296; };
}
export function seededRng(seed) {   // mulberry32, only for the shared daily round
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, n) => Math.min(n - 1, Math.floor(r() * n));
export function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = pick(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const ROW = r => [0, 1, 2, 3, 4].map(c => r * 5 + c), COL = c => [0, 1, 2, 3, 4].map(r => r * 5 + c);
export const SHAPES = {
  line: { name: 'Any line', icon: ROW(2), masks: [0, 1, 2, 3, 4].map(ROW).concat([0, 1, 2, 3, 4].map(COL), [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]]) },
  corners: { name: 'Four corners', icon: [0, 4, 20, 24], masks: [[0, 4, 20, 24]] },
  stamp: { name: 'Postage stamp', icon: [3, 4, 8, 9], masks: [[0, 1, 5, 6], [3, 4, 8, 9], [15, 16, 20, 21], [18, 19, 23, 24]] },
  diamond: { name: 'Little diamond', icon: [7, 11, 13, 17], masks: [[7, 11, 12, 13, 17]] },
  plus: { name: 'Garden cross', icon: [2, 7, 10, 11, 12, 13, 14, 17, 22], masks: [[2, 7, 10, 11, 12, 13, 14, 17, 22]] },
  x: { name: 'Kisses', icon: [0, 6, 12, 18, 24, 4, 8, 16, 20], masks: [[0, 6, 12, 18, 24, 4, 8, 16, 20]] },
};
export const LETTER = n => 'BINGO'[Math.min(4, Math.floor((n - 1) / 15))];
export const MAX_BINGOS = 3;   // per card per round

export function makeCard(r) {
  const nums = new Array(25);
  for (let col = 0; col < 5; col++) {
    const pool = shuffle(Array.from({ length: 15 }, (_, i) => col * 15 + i + 1), r).slice(0, 5).sort((a, b) => a - b);
    for (let row = 0; row < 5; row++) nums[row * 5 + col] = pool[row];
  }
  nums[12] = 0;
  return { nums, daub: nums.map((n, i) => i === 12), claimed: [], bingos: 0, prizes: {} };
}
export const makeBag = r => shuffle(Array.from({ length: 75 }, (_, i) => i + 1), r);

/** every not-yet-claimed pattern that is fully daubed on this card */
export function readyMasks(card, shapes) {
  if (card.bingos >= MAX_BINGOS) return [];
  const out = [];
  for (const s of shapes) for (const m of SHAPES[s].masks) {
    const key = s + ':' + m.join(',');
    if (card.claimed.includes(key) || out.some(o => o.key === key)) continue;
    if (m.every(i => card.daub[i])) out.push({ key, mask: m, shape: s });
  }
  return out.slice(0, MAX_BINGOS - card.bingos);
}
/** nearest unclaimed pattern: fraction done, squares still needed, its cells */
export function closeness(card, shapes) {
  let best = 0, need = 99, cells = null;
  for (const s of shapes) for (const m of SHAPES[s].masks) {
    const key = s + ':' + m.join(','); if (card.claimed.includes(key)) continue;
    const have = m.filter(i => card.daub[i]).length, f = have / m.length;
    if (f > best || (f === best && m.length - have < need)) { best = f; need = m.length - have; cells = m; }
  }
  return { f: best, need, cells };
}

// power-ups: drawn fairly from this table, which the Fair play sheet shows
export const POWERS = [
  { id: 'daub', icon: 'hint', name: 'Magic Daub', line: 'daubs a square for you', w: 30 },
  { id: 'pick', icon: 'pencil', name: 'Pick a Square', line: 'you choose any square', w: 15 },
  { id: 'coins', icon: 'coins', name: 'Coin Purses', line: '3 purses appear on your cards', w: 20 },
  { id: 'stamp', icon: 'album', name: 'Stamp Gift', line: 'a stamp square on your card', w: 15 },
  { id: 'balls', icon: 'plus', name: 'Three More Balls', line: 'three extra calls this round', w: 10 },
  { id: 'double', icon: 'star', name: 'Double Coins', line: 'your next bingo pays twice', w: 10 },
];
export function pickPower(r) {
  const tot = POWERS.reduce((a, p) => a + p.w, 0); let x = r() * tot;
  for (const p of POWERS) { x -= p.w; if (x < 0) return p; }
  return POWERS[0];
}

/** chance that at least one card gets a bingo within `balls` calls (no power-ups), by Monte Carlo */
export function oddsTable(shapes, balls, n = 1200, r = fairRng()) {
  const out = [];
  for (let cards = 1; cards <= 4; cards++) {
    let hit = 0;
    for (let k = 0; k < n; k++) {
      const cs = []; for (let i = 0; i < cards; i++) cs.push(makeCard(r));
      const called = new Set(makeBag(r).slice(0, balls)); called.add(0);
      let ok = false;
      outer: for (const c of cs) for (const s of shapes) for (const m of SHAPES[s].masks) if (m.every(i => called.has(c.nums[i]))) { ok = true; break outer; }
      if (ok) hit++;
    }
    out.push(hit / n);
  }
  return out;
}
/** balls until the first bingo on any of `cards` cards (for the tuning sim) */
export function firstBingoBall(shapes, cards, r) {
  const cs = []; for (let i = 0; i < cards; i++) cs.push(makeCard(r));
  const bag = makeBag(r), called = new Set([0]);
  for (let b = 0; b < 75; b++) {
    called.add(bag[b]);
    for (const c of cs) for (const s of shapes) for (const m of SHAPES[s].masks) if (m.every(i => called.has(c.nums[i]))) return b + 1;
  }
  return 75;
}

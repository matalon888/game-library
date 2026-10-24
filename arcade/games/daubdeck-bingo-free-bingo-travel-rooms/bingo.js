// Daubdeck Bingo rules (pure logic, also runs in node for the tuning sim).
// 75-ball bingo: column B 1–15, I 16–30, N 31–45 (free centre), G 46–60, O 61–75.
// Fairness: in normal rounds every random draw (card numbers, ball order, power-ups, prize squares) comes from the
// browser's cryptographic generator, uniform and the same for everyone. The daily round uses one shared seed instead,
// so everybody plays the same balls. Nothing ever looks at coins, purchases, or how you've been doing.
import { SHAPES, MAX_BINGOS, POWERS } from './data.js';

export function fairRng() {
  const a = new Uint32Array(1);
  return () => { crypto.getRandomValues(a); return a[0] / 4294967296; };
}
export function seededRng(seed) {   // mulberry32 — only for the shared daily round
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const int = (r, n) => Math.min(n - 1, Math.floor(r() * n));
export function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = int(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function makeCard(r) {
  const nums = new Array(25);
  for (let col = 0; col < 5; col++) {
    const pool = shuffle(Array.from({ length: 15 }, (_, i) => col * 15 + i + 1), r);
    for (let row = 0; row < 5; row++) nums[row * 5 + col] = pool[row];
  }
  nums[12] = 0;
  for (let col = 0; col < 5; col++) {   // keep each column in ascending order, like a printed card
    const idx = [0, 1, 2, 3, 4].map(row => row * 5 + col).filter(i => i !== 12), v = idx.map(i => nums[i]).sort((a, b) => a - b);
    idx.forEach((i, k) => nums[i] = v[k]);
  }
  return { nums, daub: nums.map((n, i) => i === 12), claimed: [], bingos: 0, prizes: {} };
}
export const makeBag = r => shuffle(Array.from({ length: 75 }, (_, i) => i + 1), r);

/** every not-yet-claimed shape mask that is fully daubed on this card */
export function readyMasks(card, shapes) {
  if (card.bingos >= MAX_BINGOS) return [];
  const out = [];
  for (const s of shapes) for (const m of SHAPES[s].masks) {
    const key = s + ':' + m.join(',');
    if (card.claimed.includes(key)) continue;
    if (m.every(i => card.daub[i])) out.push({ key, mask: m, shape: s });
  }
  return out.slice(0, MAX_BINGOS - card.bingos);
}
/** how close the card is to its nearest shape (0..1), for the "one to go" glow and the flow record */
export function closeness(card, shapes) {
  let best = 0, need = 99, cells = null;
  for (const s of shapes) for (const m of SHAPES[s].masks) {
    const key = s + ':' + m.join(','); if (card.claimed.includes(key)) continue;
    const have = m.filter(i => card.daub[i]).length, f = have / m.length;
    if (f > best || (f === best && m.length - have < need)) { best = f; need = m.length - have; cells = m; }
  }
  return { f: best, need, cells };
}
export function pickPower(r) {
  const tot = POWERS.reduce((a, p) => a + p.w, 0); let x = r() * tot;
  for (const p of POWERS) { x -= p.w; if (x < 0) return p; }
  return POWERS[0];
}

/** chance (no power-ups) that at least one card gets a bingo within `balls` calls, by Monte Carlo (shown to players) */
export function oddsTable(shapes, balls, n = 1500) {
  const r = fairRng(), out = [];
  for (let cards = 1; cards <= 4; cards++) {
    let hit = 0;
    for (let k = 0; k < n; k++) {
      const cs = []; for (let i = 0; i < cards; i++) cs.push(makeCard(r));
      const bag = makeBag(r), called = new Set(bag.slice(0, balls)); called.add(0);
      let ok = false;
      for (const c of cs) { for (const s of shapes) { for (const m of SHAPES[s].masks) if (m.every(i => called.has(c.nums[i]))) { ok = true; break; } if (ok) break; } if (ok) break; }
      if (ok) hit++;
    }
    out.push(hit / n);
  }
  return out;
}

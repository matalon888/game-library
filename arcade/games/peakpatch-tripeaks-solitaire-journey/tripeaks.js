// Peakpatch rules: TriPeaks solitaire. Clear the peaks by playing open cards one rank above or below the top of the
// waste pile (K↔A wraps). Draw from the stock when stuck. Wild cards play on anything and take anything.
// Levels are seeded layouts; the stock is sized fairly: an ordinary player policy (sees only face-up cards) is
// simulated on the exact deal, and the stock gets exactly what it needed plus a slack that shrinks as levels go on.
import { rng } from './kit/hc.js';

export const LEVELS_PER_ISLAND = 6, ISLANDS = 12, JOURNEY = LEVELS_PER_ISLAND * ISLANDS;
export const DY = 0.62;                                   // row spacing (card heights are 1.4)

export const adj = (a, b) => { if (!a || !b) return false; if (a.w || b.w) return true; const d = Math.abs(a.r - b.r); return d === 1 || d === 12; };

function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const deck = R => shuffle(Array.from({ length: 52 }, (_, i) => ({ r: (i % 13) + 1, s: Math.floor(i / 13) })), R);

// ---------------------------------------------------------------- layouts
// rows are counted from the bottom (k = 0 is the front row, on top of everything). Row k, index i sits at
// x = k + 2i half-card units and is covered by (k-1, i) and (k-1, i+1).
const SHAPES = {
  peaks(N, H, R) {   // the classic: two full front rows, then P peaks rising behind them
    const P = N >= 8 ? (R() < 0.5 ? 2 : 3) : 2, span = 2 * (N - 1);
    const apex = []; for (let j = 0; j < P; j++) apex.push(Math.round((span * (j + 0.5)) / P));
    return (k, x) => k <= 1 || apex.some(a => Math.abs(x - a) <= (H - 1 - k) * 1 + 0.5 && (H - 1 - k) >= 0);
  },
  pyramid(N, H) { return () => true; },
  valley(N, H) { const mid = N - 1; return (k, x) => k <= 1 || Math.abs(x - mid) >= (k - 1) * 2 + 1; },
  towers(N, H, R) { const c = [Math.round(N * 0.5) - 1, N - 1, Math.round(N * 1.5) - 1]; return (k, x) => k <= 1 || c.some(a => Math.abs(x - a) <= Math.max(1, 3 - k * 0.5)); },
  terrace(N, H) { return (k, x) => k <= 1 || (k % 2 === 0 ? true : x % 4 !== (k % 4)); },
};
export function buildLayout(shape, N, H, R) {
  const keep = SHAPES[shape](N, H, R), slots = [], at = new Map();
  for (let k = 0; k < H; k++) for (let i = 0; i < N - k; i++) {
    const x = k + 2 * i;
    if (!keep(k, x)) continue;
    if (k > 0 && !at.has(`${k - 1},${i}`) && !at.has(`${k - 1},${i + 1}`)) continue;   // nothing floats
    const s = { id: slots.length, k, i, x, cov: [], under: [] };
    at.set(`${k},${i}`, s); slots.push(s);
  }
  for (const s of slots) if (s.k > 0) for (const j of [s.i, s.i + 1]) { const c = at.get(`${s.k - 1},${j}`); if (c) { s.cov.push(c.id); c.under.push(s.id); } }
  // a card that is covered by nothing but sits high counts as a "peak"
  for (const s of slots) s.peak = s.k >= 2 && !slots.some(o => o.k === s.k + 1 && Math.abs(o.x - s.x) === 1);
  return slots;
}

// ---------------------------------------------------------------- level parameters
export function levelParams(n, seed = n * 7919 + 17) {
  const R = rng(seed);
  const N = n <= 2 ? 6 : n <= 6 ? 7 : 8;
  const H = n <= 3 ? 3 : n <= 10 ? 4 : n <= 30 ? (R() < 0.5 ? 4 : 5) : (R() < 0.35 ? 4 : R() < 0.75 ? 5 : 6);
  const shapes = n <= 3 ? ['pyramid', 'peaks'] : ['peaks', 'peaks', 'pyramid', 'valley', 'towers', 'terrace'];
  const shape = shapes[Math.floor(R() * shapes.length)];
  const hard = n > 9 && n % 10 === 0;
  let slack = n <= 3 ? 8 : Math.max(4, Math.round(7.5 - (n - 3) * 0.15));
  if (hard) slack = Math.max(3, slack - 1);
  const locks = n < 8 ? 0 : Math.min(4, 1 + Math.floor((n - 8) / 9));
  const faceRows = n <= 8 ? 1 : 0;
  const stockWilds = n <= 5 ? 1 : n % 4 === 0 ? 1 : 0;
  return { n, seed, N, H, shape, slack, hard, locks, faceRows, stockWilds, island: Math.floor((n - 1) / LEVELS_PER_ISLAND) % ISLANDS };
}

// ---------------------------------------------------------------- game state
export function newGame(p, k = 1) {
  // try a few deals of this layout and keep the smoothest one (fewest stock draws for an ordinary player)
  let best = null;
  for (let v = 0; v < 8; v++) { const g = deal(p, v); if (!best || g.need < best.need) best = g; if (best.need <= 18) break; }
  const g = best;
  g.stock = g.stock.slice(g.stock.length - Math.max(4, g.need + Math.round(p.slack / k)));
  g.slackLeft = { two: Math.max(1, Math.round(p.slack * 0.3)), three: Math.max(2, Math.round(p.slack * 0.65)) };
  return g;
}
function deal(p, v) {
  const R = rng(p.seed * 3 + 1 + v * 104729);
  const slots = buildLayout(p.shape, p.N, p.H, R);
  let cards = deck(R);
  const tab = slots.map(() => cards.pop());
  // locks: on covered cards, counters 3–7
  const lockable = slots.filter(s => s.k >= 1);
  shuffle(lockable, R);
  for (let i = 0; i < Math.min(p.locks, lockable.length); i++) lockable[i].lock = 3 + Math.floor(R() * 5);
  // the long stock (more decks if needed); wilds tucked in early
  const pool = [...cards]; while (pool.length < 140) pool.push(...deck(R));
  for (let w = 0; w < p.stockWilds; w++) pool.splice(pool.length - 1 - Math.floor(4 + R() * 8), 0, { w: 1 });
  const g = {
    p, slots: slots.map((s, i) => ({ ...s, card: tab[i], gone: false, lock: s.lock || 0, up: false })),
    stock: pool,               // drawn from the END (pop)
    waste: [], streak: 0, best: 0, score: 0, moves: 0, plays: 0,
  };
  // the opening waste card comes off the stock
  g.waste.push(g.stock.pop());
  refreshUp(g, true);
  // calibrate the stock: what an ordinary player needs on this exact deal, plus slack
  g.need = simulate(g);
  return g;
}
export function isOpen(g, s) { return !s.gone && s.cov.every(c => g.slots[c].gone); }
export function refreshUp(g, initial = false) {
  const flipped = [];
  for (const s of g.slots) {
    if (s.gone) continue;
    const want = isOpen(g, s) || s.k <= g.p.faceRows;
    if (want && !s.up) { s.up = true; if (!initial) flipped.push(s); }
  }
  return flipped;
}
export const playable = (g, s) => isOpen(g, s) && !s.lock && adj(s.card, g.waste[g.waste.length - 1]);
export const moves = g => g.slots.filter(s => playable(g, s));
export const left = g => g.slots.reduce((a, s) => a + !s.gone, 0);

/** play a tableau card onto the waste. returns { flipped, unlocked, peak } */
export function play(g, s) {
  s.gone = true; g.waste.push(s.card); g.streak++; g.best = Math.max(g.best, g.streak); g.moves++; g.plays++;
  const pts = 100 + 50 * Math.min(12, g.streak - 1);
  g.score += pts;
  const unlocked = [];
  for (const o of g.slots) if (!o.gone && o.lock > 0) { o.lock--; if (!o.lock) unlocked.push(o); }
  return { flipped: refreshUp(g), unlocked, pts, peak: s.peak };
}
export function draw(g) { if (!g.stock.length) return null; const c = g.stock.pop(); g.waste.push(c); g.streak = 0; g.moves++; return c; }
export const stuck = g => !g.stock.length && !moves(g).length && left(g) > 0;

// ---------------------------------------------------------------- the ordinary-player policy (bot + calibration)
// sees only face-up cards. Prefers the play that keeps the longest visible run going, then the one that frees most.
function chain(g, top, used, depth) {
  if (depth <= 0) return 0;
  let best = 0;
  for (const s of g.slots) {
    if (s.gone || used.has(s.id) || s.lock || !s.up) continue;
    if (!s.cov.every(c => g.slots[c].gone || used.has(c))) continue;
    if (!adj(s.card, top)) continue;
    used.add(s.id); best = Math.max(best, 1 + chain(g, s.card, used, depth - 1)); used.delete(s.id);
    if (best >= depth) break;
  }
  return best;
}
export function choose(g) {
  const ms = moves(g); if (!ms.length) return null;
  let best = null, bs = -1;
  for (const s of ms) {
    const used = new Set([s.id]);
    const run = chain(g, s.card, used, 6);
    const frees = s.under.filter(u => g.slots[u].cov.every(c => c === s.id || g.slots[c].gone)).length;
    const sc = run * 10 + frees * 3 + (s.card.w ? -8 : 0) + s.k;
    if (sc > bs) { bs = sc; best = s; }
  }
  return best;
}
function clone(g) { return { p: g.p, slots: g.slots.map(s => ({ ...s })), stock: g.stock.slice(), waste: g.waste.slice(), streak: 0, best: 0, score: 0, moves: 0, plays: 0 }; }
/** how many stock draws the policy needs to clear this deal */
export function simulate(g0) {
  const g = clone(g0); let draws = 0;
  for (let it = 0; it < 2000 && left(g) > 0; it++) {
    const s = choose(g);
    if (s) play(g, s); else { if (!draw(g)) return draws + 99; draws++; }
  }
  return draws;
}
export function stars(g) { const l = g.stock.length; return 1 + (l >= g.slackLeft.two) + (l >= g.slackLeft.three); }
export function snapshot(g) { return JSON.stringify({ slots: g.slots.map(s => [s.gone, s.lock, s.up]), stock: g.stock, waste: g.waste, streak: g.streak, score: g.score }); }
export function restore(g, snap) {
  const o = JSON.parse(snap); o.slots.forEach(([gone, lock, up], i) => Object.assign(g.slots[i], { gone, lock, up }));
  g.stock = o.stock; g.waste = o.waste; g.streak = o.streak; g.score = o.score;
}

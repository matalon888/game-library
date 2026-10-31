// Slab Up v2 — 30 authored towers in 3 worlds. Each: goal (slabs to stack), w (start width), sp (speed), tol (perfect window),
// mode ('lin' | 'sine' slows at the ends | 'burst' pulses), safe (a full miss can't end it), gold (gold slab indexes: a perfect
// there regrows the tower), rush (fast slabs), blink (ghost slab), wind (path wobble), diag (comes in on a diagonal and cuts two sides),
// par [perfects for 2 stars, for 3 stars], hard (red badge), why (the purpose of the level).
export const WORLDS = [
  { name: 'Candy Quarry', hue: 340, icon: '🍬' },
  { name: 'Ghost Harbor', hue: 205, icon: '👻' },
  { name: 'Sky Spire', hue: 270, icon: '🌌' },
];
const L = (n, o) => ({ n, w: 3, sp: 1, tol: 0.09, mode: 'lin', safe: false, gold: [], rush: [], blink: 0, wind: 0, diag: false, hard: false, ...o });
export const LEVELS = [
  // ---- world 1: Candy Quarry — the verb, then rhythm, gold and speed
  L(1, { world: 0, goal: 7, w: 3.4, sp: 0.65, tol: 0.24, safe: true, par: [2, 4], why: 'intro: tap to drop, cannot fail' }),
  L(2, { world: 0, goal: 9, w: 3.3, sp: 0.78, tol: 0.17, safe: true, gold: [5], par: [2, 4], why: 'first decision: wait for the middle' }),
  L(3, { world: 0, goal: 7, sp: 0.78, tol: 0.2, gold: [3], par: [3, 5], why: 'first tower you can lose; the cut shows why' }),
  L(4, { world: 0, goal: 10, sp: 0.85, tol: 0.16, gold: [3, 7], mode: 'sine', par: [3, 7], why: 'rhythm: slabs slow down at the ends, fast in the middle' }),
  L(5, { world: 0, goal: 13, sp: 0.95, gold: [6], par: [3, 7], why: 'introduce gold: a perfect there regrows the tower' }),
  L(6, { world: 0, goal: 14, sp: 1.0, gold: [5, 10], rush: [8], par: [4, 8], why: 'introduce rush: one slab comes in fast' }),
  L(7, { world: 0, goal: 15, w: 2.3, sp: 0.95, gold: [4, 9], par: [4, 9], why: 'small base: every cut counts' }),
  L(8, { world: 0, goal: 16, sp: 1.0, mode: 'burst', gold: [8], par: [5, 10], why: 'pulsing speed: read the beat' }),
  L(9, { world: 0, goal: 18, sp: 1.2, mode: 'sine', gold: [7, 13], rush: [10, 15], hard: true, par: [6, 11], why: 'HARD: the Quarry boss, fast sine with rushes' }),
  L(10, { world: 0, goal: 10, w: 3.6, sp: 0.8, tol: 0.2, gold: [2, 4, 6, 8], par: [4, 7], why: 'breather: wide slabs, gold every other one' }),
  // ---- world 2: Ghost Harbor — slabs flicker, wind wobbles the path
  L(11, { world: 1, goal: 10, sp: 0.85, blink: 0.25, tol: 0.12, par: [3, 6], why: 'introduce ghost: the slab flickers' }),
  L(12, { world: 1, goal: 12, sp: 0.9, blink: 0.38, gold: [6], par: [3, 7], why: 'practise ghost: time it by the beat' }),
  L(13, { world: 1, goal: 12, sp: 0.9, wind: 0.35, tol: 0.12, par: [3, 7], why: 'introduce wind: the path wobbles' }),
  L(14, { world: 1, goal: 14, sp: 0.95, wind: 0.5, gold: [6, 11], par: [4, 8], why: 'practise wind with gold to recover' }),
  L(15, { world: 1, goal: 14, sp: 1.0, mode: 'sine', rush: [4, 8, 12], par: [4, 9], why: 'twist: rushes inside the sine rhythm' }),
  L(16, { world: 1, goal: 18, sp: 1.1, blink: 0.4, wind: 0.4, gold: [9], hard: true, par: [6, 11], why: 'HARD: ghost in the wind' }),
  L(17, { world: 1, goal: 10, w: 3.6, sp: 0.8, tol: 0.2, gold: [3, 6, 9], par: [4, 7], why: 'breather: gentle, golden' }),
  L(18, { world: 1, goal: 16, sp: 1.05, mode: 'burst', rush: [5, 11], wind: 0.3, par: [5, 10], why: 'beat + wind + rush together' }),
  L(19, { world: 1, goal: 18, sp: 1.1, blink: 0.35, rush: [6, 12], gold: [8, 14], par: [6, 11], why: 'ghost with rushes: stay calm' }),
  L(20, { world: 1, goal: 20, w: 2.5, sp: 1.2, blink: 0.4, wind: 0.5, gold: [7, 14], hard: true, par: [7, 13], why: 'HARD: the Harbor boss, narrow base, ghost and wind' }),
  // ---- world 3: Sky Spire — the slab comes in on a diagonal and cuts two sides
  L(21, { world: 2, goal: 8, w: 3.4, sp: 0.6, tol: 0.2, safe: true, par: [2, 4], why: 'introduce diagonal: it comes in on a corner and cuts two sides' }),
  L(22, { world: 2, goal: 10, sp: 0.7, diag: true, tol: 0.14, par: [2, 5], why: 'practise diagonal, still slow' }),
  L(23, { world: 2, goal: 12, sp: 0.75, diag: true, tol: 0.14, gold: [5, 9], par: [3, 6], why: 'diagonal with gold to regrow' }),
  L(24, { world: 2, goal: 12, w: 2.6, sp: 0.75, diag: true, tol: 0.14, par: [3, 7], why: 'diagonal on a small base' }),
  L(25, { world: 2, goal: 14, sp: 0.8, diag: true, tol: 0.14, blink: 0.3, gold: [7], par: [4, 8], why: 'twist: diagonal and ghost' }),
  L(26, { world: 2, goal: 16, sp: 0.9, diag: true, tol: 0.13, mode: 'sine', gold: [6, 11], hard: true, par: [5, 10], why: 'HARD: fast diagonal' }),
  L(27, { world: 2, goal: 10, w: 3.6, sp: 0.7, tol: 0.2, mode: 'sine', gold: [2, 4, 6, 8], par: [4, 7], why: 'breather: wide, golden' }),
  L(28, { world: 2, goal: 16, sp: 0.85, diag: true, tol: 0.13, wind: 0.3, rush: [5, 10], gold: [8], par: [5, 10], why: 'diagonal, wind and rush' }),
  L(29, { world: 2, goal: 18, sp: 0.9, diag: true, tol: 0.13, mode: 'burst', blink: 0.25, gold: [6, 12], par: [6, 11], why: 'diagonal with a pulsing beat' }),
  L(30, { world: 2, goal: 22, w: 2.8, sp: 1.0, diag: true, tol: 0.13, blink: 0.35, wind: 0.4, rush: [8, 15], gold: [7, 14], hard: true, par: [7, 13], why: 'HARD: the Spire top, everything' }),
];

// seeded random for the daily tower (same for every player today)
function rng(seed) { let s = Math.floor(seed) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function dayNum(d = new Date()) { return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
export function dailyLevel(day = dayNum()) {
  const r = rng(day * 7 + 3), pick = (a) => a[Math.floor(r() * a.length)];
  const goal = 14 + Math.floor(r() * 7), o = { world: Math.floor(r() * 3), goal, w: 2.7 + r() * 0.5, sp: 0.85 + r() * 0.25, tol: 0.12, mode: pick(['lin', 'sine', 'burst']), daily: true };
  const mut = pick(['blink', 'wind', 'diag', 'rush', 'blink+wind']);
  if (mut.includes('blink')) o.blink = 0.3; if (mut.includes('wind')) o.wind = 0.4; if (mut === 'diag') { o.diag = true; o.sp = Math.min(o.sp, 0.85); }
  o.rush = mut === 'rush' ? [4, 9, 13].filter(x => x < goal) : [];
  o.gold = [Math.floor(goal * 0.4), Math.floor(goal * 0.75)];
  o.par = [Math.round(goal * 0.3), Math.round(goal * 0.55)];
  o.why = 'daily tower';
  return L(0, o);
}
// after the authored 30: bonus towers built from the world-3 elements (goal grows slowly, never past 28)
export function bonusLevel(n) {
  const k = n - LEVELS.length, goal = Math.min(28, 20 + k);
  return L(n, { world: 2, goal, w: 2.8, sp: Math.min(1.1, 0.95 + k * 0.01), diag: k % 2 === 0, blink: k % 3 === 0 ? 0.3 : 0, wind: k % 2 ? 0.4 : 0, tol: 0.13, mode: k % 3 === 1 ? 'burst' : 'sine', gold: [8, 15], rush: [6, 12], par: [Math.round(goal * 0.35), Math.round(goal * 0.6)], why: 'bonus tower' });
}
export const levelAt = (n) => (n <= LEVELS.length ? LEVELS[n - 1] : bonusLevel(n));

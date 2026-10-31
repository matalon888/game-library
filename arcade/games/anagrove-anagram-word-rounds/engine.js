// engine.js — the pure rules of Anagrove v2 (no DOM): the word sets, round building from an authored level, goals and stars.
// deep.js plays it in the browser, qa/check.mjs validates every authored level with it in node. Our own code, MIT.
import { WORDS } from './words.js';
import { SAFE } from './safe.js';

const SAFESET = new Set(SAFE);
export const CORE = WORDS.slice(0, 5911).filter(w => SAFESET.has(w));          // everyday words fill the slots
export const ALL = new Set(SAFE.filter(w => w.length >= 3 && w.length <= 6));  // rarer real words still count as bonus words
export const SIXES = CORE.filter(w => w.length === 6);
export const SUBS = CORE.filter(w => w.length >= 3 && w.length <= 6);
export const counts = (w) => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
export const fits = (w, pc) => { const c = {}; for (const ch of w) { c[ch] = (c[ch] || 0) + 1; if (c[ch] > (pc[ch] || 0)) return false; } return true; };
export const rngf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/** words that can be made from `base` (3-6 letters), short first */
export function wordsOf(base) {
  const pc = counts(base);
  return SUBS.filter(w => fits(w, pc)).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
}
const shuffled = (arr, r) => { const a = arr.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };

/**
 * Build a round from an authored level spec { b: base word, tw: {wilt, thorn, wind, fog}, gold, g: goal, ... }.
 * Returns { base, letters, words, pc, gold, wiltCh, ... }. Same spec → same round (levels are learnable).
 */
export function buildRound(spec, seed = 1) {
  const base = spec.b, words = wordsOf(base), pc = counts(base), r = rngf(hash(base) + seed * 7919);
  let letters = shuffled(base.split(''), r); if (letters.join('') === base) letters.reverse();
  const tw = spec.tw || {};
  // gold word: one 4-5 letter slot, the same every time this level is played
  let gold = null;
  if (spec.gold) { const pool = words.filter(w => w.length >= 4 && w.length <= 5); if (pool.length) gold = pool[Math.floor(rngf(hash(base + 'g'))() * pool.length)]; }
  // wilted tile: a letter that appears once in the base and blocks as few words as possible (but at least a few words stay open)
  let wiltCh = null, wiltFree = 0;
  if (tw.wilt) {
    let best = null;
    for (const ch of Object.keys(pc)) {
      if (pc[ch] !== 1) continue;
      const open = words.filter(w => !w.includes(ch)).length;
      const sixBlocked = words.filter(w => w.length === 6).every(w => w.includes(ch));
      if (!sixBlocked) continue;                        // the six-letter word needs this tile: it must be woken, so it matters
      if (open >= tw.wilt + 3 && (!best || open > best.open)) best = { ch, open };
    }
    if (best) { wiltCh = best.ch; wiltFree = best.open; }
  }
  return { base, letters, words, pc, gold, wiltCh, wiltFree, spec, sixes: words.filter(w => w.length === 6) };
}

/** daily / bonus rounds: a seeded base from the common list, same rule as v1 (9-24 words) */
export function seededBase(seed) {
  const r = rngf(seed); r(); r();
  for (let t = 0; t < 500; t++) {
    const base = SIXES[Math.floor(r() * SIXES.length)];
    const n = wordsOf(base).length;
    if (n >= 9 && n <= 24) return base;
  }
  return 'secret';
}

export const wordPts = (w) => w.length * w.length * 10 + (w.length === 6 ? 100 : 0);

/** goal progress. st = { found:Set, bonus:Set, pts, chainMax, goldFound, sixAt (seconds elapsed when the six was found) } */
export function goalProgress(R, st) {
  const g = R.spec.g || ['words', 1], found = [...st.found];
  switch (g[0]) {
    case 'words': return { have: found.length, need: g[1] };
    case 'long': return { have: found.filter(w => w.length >= 5).length, need: g[1] };
    case 'start': return { have: found.filter(w => w[0] === g[1]).length, need: g[2] };
    case 'score': return { have: st.pts, need: g[1] };
    case 'chain': return { have: st.chainMax, need: g[1] };
    case 'gold': return { have: st.goldFound ? 1 : 0, need: 1 };
    case 'fast': return { have: st.sixAt != null && st.sixAt <= g[1] ? 1 : 0, need: 1 };
  }
  return { have: 0, need: 1 };
}
export function goalText(R) {
  const g = R.spec.g || ['words', 1];
  switch (g[0]) {
    case 'words': return `Find ${g[1]} words`;
    case 'long': return `Find ${g[1]} words of 5+ letters`;
    case 'start': return `Find ${g[2]} words starting with ${g[1].toUpperCase()}`;
    case 'score': return `Score ${g[1]} points`;
    case 'chain': return `Reach a x${g[1]} chain`;
    case 'gold': return 'Find the golden word';
    case 'fast': return `Find the six-letter word in ${g[1]}s`;
  }
  return '';
}
/** stars: 1 = the six-letter word, 2 = + the goal, 3 = + most of the wall (spec.s3 share, default 0.85) with 20% of the clock still left */
export function starsOf(R, st) {
  const six = [...st.found].some(w => w.length === 6); if (!six) return 0;
  const gp = goalProgress(R, st); let s = 1;
  if (gp.have >= gp.need) { s = 2; if (st.found.size >= Math.ceil(R.words.length * Math.min(0.95, (R.spec.s3 || 0.85) + 0.1)) && (st.fracLeft == null || st.fracLeft >= 0.3)) s = 3; }
  return s;
}

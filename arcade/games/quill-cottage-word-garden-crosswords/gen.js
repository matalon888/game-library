// gen.js — Quill Cottage level generator (adapted from wordvista/gen.js, our own code, MIT). Picks a wheel word, finds
// every common word hidden in its letters and lays the answers out as a small crossword. Used at build time
// (tools/build-levels.mjs → levels.js, the 120-level journey) and in the browser for the daily puzzle and the endless
// Wandering Paths after the last garden.
import { WORDS } from './words.js';
import { isBlocked } from './safe.js';

// SCOWL tiers: words.js lists size-10 words first, then size-20, then size-35 (each block alphabetical)
const TIER = new Map();
{ let t = 1; for (let i = 0; i < WORDS.length; i++) { if (i && WORDS[i] < WORDS[i - 1]) t++; if (!TIER.has(WORDS[i])) TIER.set(WORDS[i], t); } }
// short odd words that are in the common lists but feel unfair as crossword answers (still accepted as bonus words)
const ODD = new Set('aah ado ail ain aint alb amp ani auk awl baa bah bap biz bod bop brr cad cob cog cox cud dab dib din dis dun eek eke ems ere erg ewe fez fie fop gad gal gee gnu goo hie hob hod hon hun ido ilk ion ire jot lam lea lei lye maw mew nab nay nee nib nit oho ova pah pas pew poi pox rah rec rel rem rep rho roc sac sod sol sou tam tat tho tic tod tog tor tut ute vac yaw yea yep yin yon zed zit ones ons ors eds ens ess sis tis ares eras rte etc'.split(' '));

export const ALL = [...new Set(WORDS.filter(w => /^[a-z]{3,7}$/.test(w) && !isBlocked(w)))];
const ALLSET = new Set(ALL);
export const isWord = w => ALLSET.has(w);
export const tier = w => TIER.get(w) || 3;
const cnt = w => { const a = new Uint8Array(26); for (let i = 0; i < w.length; i++) a[w.charCodeAt(i) - 97]++; return a; };
const SIG = ALL.map(w => [w, cnt(w)]);
const fits = (c, base) => { for (let i = 0; i < 26; i++) if (c[i] > base[i]) return false; return true; };

/** every allowed word (3+ letters) that can be spelled from `letters` */
export function wordsIn(letters) { const b = cnt(letters); return SIG.filter(([w, c]) => w.length <= letters.length && fits(c, b)).map(s => s[0]); }
/** crossword-worthy answers: common (tier ≤ maxTier) and not odd */
export const answerOk = (w, maxTier = 2) => tier(w) <= maxTier && !ODD.has(w);

// ------------------------------------------------------------ crossword layout
// words: candidates, longest first is placed first. Returns { rows, cols, w: [[word, r, c, across], ...] } or null.
function attempt(words, rand, maxR, maxC, want) {
  const cell = new Map(), dirs = new Map(), placed = [];
  const key = (r, c) => r * 1000 + c;
  let r0 = 0, r1 = 0, c0 = 0, c1 = 0;
  const put = (w, r, c, a) => {
    for (let i = 0; i < w.length; i++) { const rr = r + (a ? 0 : i), cc = c + (a ? i : 0), k = key(rr + 500, cc + 500); cell.set(k, w[i]); dirs.set(k, (dirs.get(k) || 0) | (a ? 1 : 2)); }
    if (!placed.length) { r0 = r; c0 = c; r1 = r + (a ? 0 : w.length - 1); c1 = c + (a ? w.length - 1 : 0); }
    else { r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r + (a ? 0 : w.length - 1)); c1 = Math.max(c1, c + (a ? w.length - 1 : 0)); }
    placed.push([w, r, c, a]);
  };
  const at = (r, c) => cell.get(key(r + 500, c + 500));
  const check = (w, r, c, a) => {
    const dr = a ? 0 : 1, dc = a ? 1 : 0;
    if (at(r - dr, c - dc) || at(r + dr * w.length, c + dc * w.length)) return -1;
    let cross = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i, ex = at(rr, cc);
      if (ex) { if (ex !== w[i]) return -1; if ((dirs.get(key(rr + 500, cc + 500)) & (a ? 1 : 2))) return -1; cross++; }
      else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1;    // side neighbours of a new cell must be empty
    }
    if (!cross || cross === w.length) return -1;
    const nr0 = Math.min(r0, r), nc0 = Math.min(c0, c), nr1 = Math.max(r1, r + dr * (w.length - 1)), nc1 = Math.max(c1, c + dc * (w.length - 1));
    if (nr1 - nr0 + 1 > maxR || nc1 - nc0 + 1 > maxC) return -1;
    const area = (nr1 - nr0 + 1) * (nc1 - nc0 + 1);
    return cross * 6 - area * 0.18 + rand() * 2.5;
  };
  const first = words[0];
  put(first, 0, 0, true);
  const rest = words.slice(1);
  for (let pass = 0; pass < 2 && placed.length < want; pass++) {
    for (const w of rest) {
      if (placed.length >= want) break;
      if (placed.some(p => p[0] === w)) continue;
      let best = null, bs = -1;
      for (const [k, ch] of cell) {
        const R = Math.floor(k / 1000) - 500, Cc = k % 1000 - 500;
        for (let i = 0; i < w.length; i++) if (w[i] === ch) for (const a of [true, false]) {
          const r = a ? R : R - i, c = a ? Cc - i : Cc, s = check(w, r, c, a);
          if (s > bs) { bs = s; best = [r, c, a]; }
        }
      }
      if (best) put(w, best[0], best[1], best[2]);
    }
  }
  return { rows: r1 - r0 + 1, cols: c1 - c0 + 1, w: placed.map(([w, r, c, a]) => [w, r - r0, c - c0, a ? 1 : 0]) };
}

export function layout(words, rand, { maxR = 7, maxC = 9, want = 8, tries = 60 } = {}) {
  let best = null, bs = -1e9;
  for (let t = 0; t < tries; t++) {
    const head = words[0], rest = words.slice(1);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    rest.sort((a, b) => b.length - a.length + (rand() - 0.5) * 2.2);
    const L = attempt([head, ...rest], rand, maxR, maxC, want);
    const n = L.w.length, area = L.rows * L.cols;
    const s = n * 100 - area * 1.2 - Math.abs(L.cols - L.rows * 1.25) * 6 + L.w.reduce((a, x) => a + x[0].length, 0) * 3;
    if (s > bs) { bs = s; best = L; }
  }
  return best;
}

// ------------------------------------------------------------ one level
export function shuffleWord(w, rand) {
  for (let k = 0; k < 20; k++) {
    const a = w.split(''); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const s = a.join(''); if (s !== w || k === 19) return s;
  }
  return w;
}
const BASES = {};
function bases(n, maxTier) {
  const k = n + ':' + maxTier;
  return BASES[k] || (BASES[k] = ALL.filter(w => w.length === n && tier(w) <= maxTier && !ODD.has(w) && !/(.)\1\1/.test(w)));
}
/**
 * makeLevel(rand, { letters, min, max, used }) → { l, rows, cols, w } or null
 *   letters: wheel size 3..7, min/max: answers in the grid, used: Set of base words to avoid
 */
export function makeLevel(rand, { letters = 5, min = 4, max = 7, used = null, baseTier = 2, ansTier = 2, pick = null } = {}) {
  const pool = bases(letters, baseTier);
  for (let t = 0; t < 400; t++) {
    const base = pick || pool[Math.floor(rand() * pool.length)];
    if (used && used.has(base)) continue;
    const all = wordsIn(base), ans = all.filter(w => answerOk(w, ansTier) && w !== base);
    if (ans.length + 1 < min) continue;
    // prefer a mix of lengths; longest words first so the long ones get placed
    ans.sort((a, b) => b.length - a.length || tier(a) - tier(b));
    const cand = [base, ...ans.slice(0, Math.max(max * 2, 12))];
    const maxC = Math.max(letters, letters >= 7 ? 9 : 8), maxR = letters >= 6 ? 7 : 6;
    const L = layout(cand, rand, { maxR, maxC, want: max, tries: letters >= 6 ? 50 : 30 });
    if (!L || L.w.length < min) continue;
    // keep it a real crossword: every 3-letter-only grid is dull, ask for at least one word ≥ 4 besides the base on 5+ wheels
    if (letters >= 5 && L.w.filter(x => x[0].length >= 4).length < 2) continue;
    used && used.add(base);
    return { l: shuffleWord(base, rand), base, rows: L.rows, cols: L.cols, w: L.w };
  }
  return null;
}

/** difficulty schedule for journey level n (1-based): first 5 near-certain wins, then a gentle sawtooth inside each
 *  15-level garden; every 6th level from 12 on is a short "Hard" one (big wheel, few answers, less common words ok). */
export const isHard = n => n >= 12 && n % 6 === 0;
export function schedule(n) {
  if (n === 1) return { letters: 3, min: 2, max: 3 };
  if (n <= 3) return { letters: 4, min: 3, max: 4 };
  if (n <= 5) return { letters: 4, min: 3, max: 5 };
  if (isHard(n)) return { letters: n < 50 ? 6 : 7, min: 4, max: 5, hard: true };
  const k = (n - 1) % 15;                         // position inside the garden: ramps, then eases at the start of the next
  if (n <= 30) return k < 5 ? { letters: 4, min: 4, max: 5 } : { letters: 5, min: 4, max: 6 };
  if (n <= 60) return k < 4 ? { letters: 5, min: 4, max: 6 } : k < 11 ? { letters: 5, min: 5, max: 7 } : { letters: 6, min: 5, max: 7 };
  if (n <= 90) return k < 4 ? { letters: 5, min: 5, max: 7 } : { letters: 6, min: 6, max: 8 };
  return k < 3 ? { letters: 6, min: 5, max: 7 } : k % 3 === 2 ? { letters: 7, min: 6, max: 8 } : { letters: 6, min: 6, max: 9 };
}

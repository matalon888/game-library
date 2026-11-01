// Puzzle Book: 30 authored pages in 3 worlds. Each page is ONE puzzle (v = Vibe Check, d = Decode, g = Mini Grid) with a purpose.
// Options go to puzzles.js (vibeFor/decodeFor/gridFor). Pages 10/20/30 are boss pages (HARD badge, bigger chest).
import { vibeFor, decodeFor, gridFor } from './puzzles.js';
export const BOOKBASE = 99000000;                   // a "day" number >= this is a Puzzle Book page (BOOKBASE + page index)
export const isBook = n => n >= BOOKBASE;
export const pageOf = n => n - BOOKBASE;
export const WORLDS = [
  { name: 'Sprinkle Lane', blurb: 'Warm-up pages: one idea at a time', color: '#ffe27a' },
  { name: 'Pastel Plaza', blurb: 'Fill-in-the-blank and sneaky clues', color: '#7fe3c0' },
  { name: 'Starlit Club', blurb: 'Wordplay, no gimmes, tight clue sets', color: '#c3a3ff' },
];
const V = (tiers, purpose, boss) => ({ k: 'v', tiers, purpose, boss });
const D = (rebus, extra, minLen, maxLen, purpose, boss) => ({ k: 'd', rebus, extra, minLen, maxLen, purpose, boss });
const G = (N, gifts, maxClues, purpose, boss) => ({ k: 'g', N, gifts, isMax: gifts, maxClues, purpose, boss });
export const PAGES = [
  // ---- World 1: Sprinkle Lane
  D(true, 0, 5, 7, 'intro Decode: only the answer letters, no decoys'),
  V([1, 1, 1, 2], 'intro Vibe Check: three plain categories'),
  G(3, 2, 6, 'intro logic grid: several direct clues, cross off the rest'),
  D(false, 0, 5, 6, 'scramble: same letters, put them in order'),
  V([1, 1, 2, 2], 'two plain, two thinkers'),
  G(3, 1, 5, 'logic grid: one gift, use "not" clues'),
  D(true, 2, 5, 8, 'rebus with two decoy letters'),
  V([1, 2, 2, 3], 'first fill-in-the-blank group'),
  G(3, 0, 5, 'first grid with no gift: pure elimination'),
  V([2, 2, 3, 3], 'BOSS Cookie Quartet: no butter groups, a red herring or two', true),
  // ---- World 2: Pastel Plaza
  V([1, 2, 3, 3], 'two fill-in-the-blank groups at once'),
  D(false, 0, 7, 8, 'longer scramble: find the club word'),
  G(4, 3, 9, 'first 4-friend grid, three gifted clues to start from'),
  V([2, 2, 3, 4], 'first wordplay group (strawberry)'),
  D(true, 3, 6, 9, 'rebus with three decoys'),
  G(4, 2, 8, '4 friends again, two gifts to start'),
  V([1, 3, 3, 4], 'plain next to wordplay: trust the easy one first'),
  D(false, 0, 8, 9, 'long scramble'),
  G(4, 1, 8, '4 friends, one gift'),
  V([2, 3, 4, 4], 'BOSS Berry Bonanza: two wordplay groups', true),
  // ---- World 3: Starlit Club
  V([3, 3, 4, 4], 'sky and strawberry only'),
  D(true, 4, 6, 9, 'rebus with four decoys'),
  G(4, 1, 7, '4 friends, one gift, fewer clues'),
  V([2, 3, 4, 4], 'a thinker hiding in the wordplay'),
  D(false, 0, 9, 10, 'the longest scrambles'),
  G(4, 0, 8, '4 friends, no gifts'),
  V([3, 4, 4, 4], 'three wordplay groups, one fill-in'),
  D(true, 5, 7, 10, 'rebus, five decoys: spell it clean'),
  G(4, 0, 6, 'tight clue set: every clue matters'),
  V([4, 4, 4, 3], 'BOSS Starlit Finale: wordplay all the way down', true),
];
export const BOOK_N = PAGES.length;
export const worldOf = i => Math.floor(i / 10);
// the puzzle a page asks for, in the same shape as setFor() returns
export function pageSet(i) {
  const p = PAGES[i], n = BOOKBASE + i, set = { n, no: i + 1, hard: !!p.boss, gentle: false, book: i, k: p.k, purpose: p.purpose };
  if (p.k === 'v') set.v = vibeFor(n, { tiers: p.tiers, no: i * 5 + 3, seed: 'book' + i });
  if (p.k === 'd') set.d = decodeFor(n, { rebus: p.rebus, idx: i * 3 + 1, extra: p.extra, minLen: p.minLen, maxLen: p.maxLen, seed: 'book' + i });
  if (p.k === 'g') set.g = gridFor(n, { N: p.N, isMax: p.isMax, gifts: p.gifts, maxClues: p.maxClues, hard: false, seed: 'book' + i });
  if (p.boss && p.k === 'v') set.v.mistakes = 4;
  return set;
}

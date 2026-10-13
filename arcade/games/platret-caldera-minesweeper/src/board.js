/* ============================================================
   board.js — packed bitflag helpers over a Uint8Array.
   Direct masking is banned outside this file: always use these
   named helpers so the compact representation stays safe.
   ============================================================ */

export const MINE       = 1 << 0;
export const REVEALED   = 1 << 1;
export const FLAGGED    = 1 << 2;
export const QUESTION   = 1 << 3;
export const EXPLODED   = 1 << 4;
export const WRONG_FLAG = 1 << 5;

export const isMine      = (s, i) => (s[i] & MINE) !== 0;
export const isRevealed  = (s, i) => (s[i] & REVEALED) !== 0;
export const isFlagged   = (s, i) => (s[i] & FLAGGED) !== 0;
export const isQuestion  = (s, i) => (s[i] & QUESTION) !== 0;
export const isExploded  = (s, i) => (s[i] & EXPLODED) !== 0;
export const isWrongFlag = (s, i) => (s[i] & WRONG_FLAG) !== 0;

export const setMine      = (s, i) => { s[i] |= MINE; };
export const setRevealed  = (s, i) => { s[i] |= REVEALED; };
export const setFlagged   = (s, i) => { s[i] |= FLAGGED; };
export const clearFlagged = (s, i) => { s[i] &= ~FLAGGED; };
export const setQuestion  = (s, i) => { s[i] |= QUESTION; };
export const clearQuestion = (s, i) => { s[i] &= ~QUESTION; };
export const setExploded  = (s, i) => { s[i] |= EXPLODED; };
export const setWrongFlag = (s, i) => { s[i] |= WRONG_FLAG; };

/* mulberry32 — tiny deterministic PRNG so boards can be seeded/replayed */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

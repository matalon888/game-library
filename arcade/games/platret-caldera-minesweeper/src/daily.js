/* ============================================================
   daily.js — the Daily Challenge: one fixed board per calendar
   day, identical for every player. The mine layout is derived
   deterministically from the date seed and placed up-front
   (click-independent), so times are comparable on the leaderboard.
   ============================================================ */

// Intermediate-size board keeps the daily approachable but not trivial.
export const DAILY_CONFIG = Object.freeze({ w: 16, h: 16, m: 40 });

/** Local calendar date as YYYY-MM-DD (the player's own day). */
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Stable 32-bit seed from a date string (xfnv1a-ish). */
export function seedForDate(key = todayKey()) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The center cell index — the canonical safe opening for the daily. */
export function dailySafeIndex(cfg = DAILY_CONFIG) {
  return ((cfg.h / 2) | 0) * cfg.w + ((cfg.w / 2) | 0);
}

/** Leaderboard difficulty key for a given day's daily board. */
export function dailyDiffKey(key = todayKey()) {
  return `daily-${key}`;
}

/* ============================================================
   stats.js — best times + win/loss streaks per difficulty.
   Assisted runs (hint/undo) never count toward best times.
   ============================================================ */

import * as storage from "./storage.js";

const FIELD = "stats";

function blank() {
  return { best: {}, games: {}, wins: {}, streak: 0, bestStreak: 0 };
}

export function all() {
  return { ...blank(), ...storage.get(FIELD, {}) };
}

/**
 * Record a finished game.
 * @returns {boolean} true if this set a new best time for the difficulty.
 */
export function record(diffKey, { won, timeMs, assisted }) {
  const s = all();
  s.games[diffKey] = (s.games[diffKey] || 0) + 1;

  let newBest = false;
  if (won) {
    s.wins[diffKey] = (s.wins[diffKey] || 0) + 1;
    s.streak = (s.streak || 0) + 1;
    if (s.streak > (s.bestStreak || 0)) s.bestStreak = s.streak;
    if (!assisted) {
      const prev = s.best[diffKey];
      if (prev == null || timeMs < prev) { s.best[diffKey] = timeMs; newBest = true; }
    }
  } else {
    s.streak = 0;
  }
  storage.set(FIELD, s);
  return newBest;
}

export function bestFor(diffKey) {
  return all().best[diffKey] ?? null;
}

export function reset() {
  storage.set(FIELD, blank());
}

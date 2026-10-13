/* ============================================================
   achievements.js — unlockable badges persisted in localStorage.
   evaluate(ctx) is pure over its inputs; unlocked ids are stored
   so a badge only ever fires its toast once.
   ============================================================ */

import * as storage from "./storage.js";

const FIELD = "achievements";

/** Each badge: id, icon, label, desc, and a predicate over the win context.
    ctx = { won, difficulty, timeMs, assisted, noGuess, daily,
            threeBV, threeBVps, efficiency, streak, totalWins } */
export const ACHIEVEMENTS = [
  { id: "first-win",   icon: "🌱", label: "First Clear",      desc: "Win your first game.",
    test: (c) => c.won },
  { id: "expert",      icon: "💎", label: "Expert Cleared",   desc: "Win an Expert board.",
    test: (c) => c.won && c.difficulty === "expert" },
  { id: "sub30-int",   icon: "⚡", label: "Quick Hands",       desc: "Win Intermediate under 30s.",
    test: (c) => c.won && c.difficulty === "intermediate" && c.timeMs < 30000 },
  { id: "sub100-exp",  icon: "🔥", label: "Sub-100 Expert",   desc: "Win Expert under 100s.",
    test: (c) => c.won && c.difficulty === "expert" && c.timeMs < 100000 },
  { id: "streak-5",    icon: "🎯", label: "On a Roll",         desc: "Win 5 games in a row.",
    test: (c) => c.won && c.streak >= 5 },
  { id: "streak-10",   icon: "👑", label: "Unstoppable",       desc: "Win 10 games in a row.",
    test: (c) => c.won && c.streak >= 10 },
  { id: "no-guess",    icon: "🧠", label: "Pure Logic",        desc: "Win a no-guess board unassisted.",
    test: (c) => c.won && c.noGuess && !c.assisted },
  { id: "daily",       icon: "📅", label: "Daily Devotee",     desc: "Win a Daily Challenge.",
    test: (c) => c.won && c.daily },
  { id: "efficient",   icon: "🎼", label: "No Wasted Moves",   desc: "Win at 100% click efficiency.",
    test: (c) => c.won && c.efficiency != null && c.efficiency >= 0.999 },
  { id: "fast-3bv",    icon: "🚀", label: "Speed Demon",       desc: "Solve at 2+ 3BV/s.",
    test: (c) => c.won && c.threeBVps != null && c.threeBVps >= 2 },
  { id: "centurion",   icon: "🏅", label: "Centurion",         desc: "Win 100 games total.",
    test: (c) => c.won && c.totalWins >= 100 },
];

export function unlockedSet() {
  return new Set(storage.get(FIELD, []));
}

/** Evaluate the context; persist + return any newly-unlocked badges. */
export function evaluate(ctx) {
  const have = unlockedSet();
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    let ok = false;
    try { ok = !!a.test(ctx); } catch { ok = false; }
    if (ok) { have.add(a.id); fresh.push(a); }
  }
  if (fresh.length) storage.set(FIELD, [...have]);
  return fresh;
}

export function reset() { storage.set(FIELD, []); }

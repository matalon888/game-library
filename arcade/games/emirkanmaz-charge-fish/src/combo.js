// Combo / streak system. Each catch within the window adds to the streak;
// the streak times out otherwise. Multipliers are applied as a BONUS
// added to score (so the base points are always awarded by the catch
// site; combo just sweetens it).

const WINDOW_MS = 5500;

// streak threshold → multiplier (the multiplier is applied to *every*
// catch while the streak is at or above that threshold)
const TIERS = [
  { at: 10, multiplier: 5 },
  { at: 5,  multiplier: 3 },
  { at: 3,  multiplier: 2 },
  { at: 0,  multiplier: 1 },
];

let streak = 0;
let lastCatchAt = 0;
let lastMultiplier = 1;
const subscribers = new Set();

function notify(event) {
  for (const cb of subscribers) cb(event);
}

function multiplierFor(s) {
  for (const tier of TIERS) {
    if (s >= tier.at) return tier.multiplier;
  }
  return 1;
}

// Returns the bonus points to add for this catch (multiplier - 1) * base.
// Call after the base score has already been awarded.
export function registerCatch(basePoints) {
  const now = performance.now();
  if (now - lastCatchAt > WINDOW_MS) {
    streak = 0;
  }
  streak += 1;
  lastCatchAt = now;
  const mult = multiplierFor(streak);
  lastMultiplier = mult;
  const bonus = basePoints * (mult - 1);
  notify({ kind: 'catch', streak, multiplier: mult, bonus });
  return bonus;
}

// Called every frame to expire the streak when the window passes.
export function tick() {
  if (streak === 0) return;
  if (performance.now() - lastCatchAt > WINDOW_MS) {
    const prev = streak;
    streak = 0;
    lastMultiplier = 1;
    notify({ kind: 'expire', previousStreak: prev });
  }
}

export function reset() {
  streak = 0;
  lastCatchAt = 0;
  lastMultiplier = 1;
}

export function getStreak() { return streak; }
export function getMultiplier() { return lastMultiplier; }

// Returns 0..1 — how much of the combo window has elapsed since the last catch.
export function getDecayProgress() {
  if (streak === 0) return 0;
  const elapsed = performance.now() - lastCatchAt;
  return Math.min(1, elapsed / WINDOW_MS);
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

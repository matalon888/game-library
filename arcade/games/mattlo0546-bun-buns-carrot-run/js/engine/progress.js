/**
 * Player progress — persists which levels have been completed.
 * Backed by localStorage; safe to call from SSR (returns empty set).
 */

const STORAGE_KEY = 'gamify.progress.v1';

// World 1 is always available; everything else requires the previous to be cleared.
const PREREQ = {
  level1: null,
  level2: 'level1',
  level3: 'level2',
};

function read() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — best-effort */
  }
}

export function isLevelCompleted(levelId) {
  return !!read()[levelId];
}

export function markLevelCompleted(levelId) {
  const state = read();
  state[levelId] = true;
  write(state);
}

export function isLevelLocked(levelId) {
  const req = PREREQ[levelId];
  if (req == null) return false;
  return !isLevelCompleted(req);
}

export function resetProgress() {
  write({});
}

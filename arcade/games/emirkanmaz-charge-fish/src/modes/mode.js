// Game mode system. Two modes:
//   FREE:     no timer, infinite play
//   SURVIVAL: countdown timer, each catch adds time, ends when timer hits 0
//
// The mode object exposes start(), onCatch(points), tick(dtMs) and
// getStatus(). main.js orchestrates the lifecycle (start screen → in-game →
// game over).

export const MODE = Object.freeze({
  FREE: 'free',
  SURVIVAL: 'survival',
});

const SURVIVAL_INITIAL_MS = 30000;
const SURVIVAL_ADD_PER_CATCH_MS = 4000;
const SURVIVAL_MAX_MS = 90000;

let activeMode = null;
let state = null;
const subscribers = new Set();

function notify() {
  for (const cb of subscribers) cb(activeMode, state);
}

export function setMode(mode) {
  activeMode = mode;
  if (mode === MODE.SURVIVAL) {
    state = {
      startedAt: performance.now(),
      timeRemainingMs: SURVIVAL_INITIAL_MS,
      catches: 0,
      isOver: false,
      survivedMs: 0,
    };
  } else {
    state = {
      startedAt: performance.now(),
      catches: 0,
    };
  }
  notify();
}

export function clearMode() {
  activeMode = null;
  state = null;
  notify();
}

export function getMode() {
  return activeMode;
}

export function getStatus() {
  return state;
}

export function isSurvival() {
  return activeMode === MODE.SURVIVAL;
}

export function isOver() {
  return state?.isOver === true;
}

export function onCatch(points) {
  if (!state) return;
  state.catches += 1;
  if (activeMode === MODE.SURVIVAL && !state.isOver) {
    state.timeRemainingMs = Math.min(
      state.timeRemainingMs + SURVIVAL_ADD_PER_CATCH_MS,
      SURVIVAL_MAX_MS,
    );
  }
}

export function tick(dtMs) {
  if (!state) return;
  if (activeMode === MODE.SURVIVAL && !state.isOver) {
    state.timeRemainingMs -= dtMs;
    if (state.timeRemainingMs <= 0) {
      state.timeRemainingMs = 0;
      state.isOver = true;
      state.survivedMs = performance.now() - state.startedAt;
      notify();
    }
  }
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

// Format helpers for display.
export function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Drawable adapter so renderer.js can tick the mode in lockstep with the
// frame loop without importing mode.js itself.
export const modeTicker = {
  update({ dtMs }) {
    tick(dtMs);
  },
  draw() {},
};

export const TUNING = Object.freeze({
  SURVIVAL_INITIAL_MS,
  SURVIVAL_ADD_PER_CATCH_MS,
  SURVIVAL_MAX_MS,
});

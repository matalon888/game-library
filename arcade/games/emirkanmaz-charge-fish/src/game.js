// Game state machine. Transitions are only allowed through transition().
// Invalid transitions throw — see CLAUDE.md Hard Rule #5.

import { TIMING } from './config.js';

export const State = Object.freeze({
  IDLE: 'IDLE',
  CASTING: 'CASTING',
  FISHING: 'FISHING',
  HOOKED: 'HOOKED',
  REELING: 'REELING',
});

const VALID_TRANSITIONS = {
  IDLE: ['CASTING'],
  CASTING: ['FISHING'],
  FISHING: ['HOOKED', 'REELING'],
  HOOKED: ['REELING', 'FISHING'],
  REELING: ['IDLE'],
};

const game = {
  state: State.IDLE,
  score: 0,
  hookedFish: null, // attached fish reference while HOOKED
  // Why the most recent REELING was triggered: 'caught' | 'empty' | 'escape'
  reelReason: null,
  stateEnteredAt: 0,
};

const subscribers = new Set();
let hookedTimeoutId = null;

function notify(prevState) {
  for (const cb of subscribers) cb(game, prevState);
}

export function getState() {
  return game.state;
}

export function getScore() {
  return game.score;
}

export function getSnapshot() {
  return {
    state: game.state,
    score: game.score,
    hookedFish: game.hookedFish,
    reelReason: game.reelReason,
    stateEnteredAt: game.stateEnteredAt,
  };
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function transition(next, payload = {}) {
  const allowed = VALID_TRANSITIONS[game.state];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid transition: ${game.state} → ${next}`);
  }

  const prev = game.state;
  game.state = next;
  game.stateEnteredAt = performance.now();

  // Clear any pending HOOKED timeout on every transition.
  if (hookedTimeoutId != null) {
    clearTimeout(hookedTimeoutId);
    hookedTimeoutId = null;
  }

  if (next === State.HOOKED) {
    game.hookedFish = payload.fish ?? null;
    hookedTimeoutId = setTimeout(() => {
      // Fish escapes after the timeout.
      if (game.state === State.HOOKED) {
        game.hookedFish = null;
        transition(State.FISHING);
      }
    }, TIMING.HOOKED_TIMEOUT_MS);
  } else if (next === State.REELING) {
    if (prev === State.HOOKED && game.hookedFish) {
      game.reelReason = 'caught';
      game.score += game.hookedFish.type.points ?? 1;
    } else {
      game.reelReason = 'empty';
    }
  } else if (next === State.IDLE) {
    game.hookedFish = null;
    game.reelReason = null;
  }

  notify(prev);
}

export function resetScore() {
  game.score = 0;
}

// Force-reset the state machine to IDLE. Bypasses the valid-transition
// check — used only by UI flow code (menu / play again) which yanks the
// player out of mid-round. Subscribers still see the change so cleanup
// hooks (wake lock, attached fish) fire normally.
export function resetState() {
  const prev = game.state;
  if (hookedTimeoutId != null) {
    clearTimeout(hookedTimeoutId);
    hookedTimeoutId = null;
  }
  game.state = State.IDLE;
  game.score = 0;
  game.hookedFish = null;
  game.reelReason = null;
  game.stateEnteredAt = performance.now();
  notify(prev);
}

// Manual score bump for in-flight catches during REELING (the transition()
// path above only adds score on HOOKED→REELING).
export function addScore(points) {
  game.score += points;
}

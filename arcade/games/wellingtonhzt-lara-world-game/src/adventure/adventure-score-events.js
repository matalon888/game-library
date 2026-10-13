import { SCORE_EVENT_TYPES } from './adventure-scoring.js';

function rejected(reason) {
  return { accepted: false, pointsAwarded: 0, reason };
}

function freezeContext(context) {
  Object.freeze(context.source);
  return Object.freeze(context);
}

export function createAdventureScoreEvents(runtime) {
  const attemptCounters = new Map();

  function begin(type, participantId, source = {}) {
    if (!runtime.isAdventureGame() || !runtime.hasActiveAdventure()) return null;
    const world = runtime.getCurrentWorld();
    if (!world || typeof participantId !== 'string') return null;
    const key = `${world.worldRunId}:${participantId}:${type}`;
    const attempt = (attemptCounters.get(key) || 0) + 1;
    attemptCounters.set(key, attempt);
    return freezeContext({
      eventId: `${key}:${attempt}`,
      worldRunId: world.worldRunId,
      worldId: world.worldId,
      participantId,
      type,
      source: { ...source, attempt },
    });
  }

  function beginChallenge({ participantId, questionId, cell }) {
    return begin('challenge', participantId, { questionId, cell });
  }

  function beginMinigame({ participantId, minigameId, cell }) {
    return begin('minigame', participantId, { minigameId, cell });
  }

  function beginWorldWin({ participantId, position, turnCount }) {
    if (!runtime.isAdventureGame() || !runtime.hasActiveAdventure()) return null;
    const world = runtime.getCurrentWorld();
    if (!world || typeof participantId !== 'string') return null;
    return freezeContext({
      eventId: `${world.worldRunId}:${participantId}:world-win`,
      worldRunId: world.worldRunId,
      worldId: world.worldId,
      participantId,
      type: 'world-win',
      source: { position, turnCount },
    });
  }

  function credit(context, type) {
    if (!context) return rejected('not-adventure-mode');
    if (!runtime.isAdventureGame() || !runtime.hasActiveAdventure()) {
      return rejected('adventure-not-active');
    }
    if (!runtime.isCurrentWorldRun(context.worldRunId)) return rejected('stale-world-run');
    return runtime.recordScoreEvent({
      eventId: context.eventId,
      worldRunId: context.worldRunId,
      worldId: context.worldId,
      participantId: context.participantId,
      type,
      source: context.source,
    });
  }

  function resolveChallenge(context, correct) {
    return credit(context, correct
      ? SCORE_EVENT_TYPES.CHALLENGE_CORRECT
      : SCORE_EVENT_TYPES.CHALLENGE_INCORRECT);
  }

  function resolveMinigame(context, result) {
    return credit(context, result?.venceu === true
      ? SCORE_EVENT_TYPES.MINIGAME_WIN
      : SCORE_EVENT_TYPES.MINIGAME_LOSS);
  }

  function completeWorldVictory(context) {
    const score = credit(context, SCORE_EVENT_TYPES.WORLD_WIN);
    if (!score.accepted) return { score, completion: null };
    return {
      score,
      completion: runtime.completeWorld({ winnerId: context.participantId }),
    };
  }

  return Object.freeze({
    beginChallenge,
    resolveChallenge,
    beginMinigame,
    resolveMinigame,
    beginWorldWin,
    completeWorldVictory,
  });
}

export const SCORING_MODEL_ID = 'adventure-mvp-a-v1';

export const SCORE_EVENT_TYPES = Object.freeze({
  CHALLENGE_CORRECT: 'challenge-correct',
  CHALLENGE_INCORRECT: 'challenge-incorrect',
  MINIGAME_WIN: 'minigame-win',
  MINIGAME_LOSS: 'minigame-loss',
  WORLD_WIN: 'world-win',
  RANDOM_EVENT: 'random-event',
});

export const SCORE_RULES = Object.freeze({
  [SCORE_EVENT_TYPES.CHALLENGE_CORRECT]: Object.freeze({ points: 10, limit: 2, category: 'challengeCorrect' }),
  [SCORE_EVENT_TYPES.CHALLENGE_INCORRECT]: Object.freeze({ points: 0, limit: Infinity, category: null }),
  [SCORE_EVENT_TYPES.MINIGAME_WIN]: Object.freeze({ points: 20, limit: 1, category: 'minigameWin' }),
  [SCORE_EVENT_TYPES.MINIGAME_LOSS]: Object.freeze({ points: 0, limit: Infinity, category: null }),
  [SCORE_EVENT_TYPES.WORLD_WIN]: Object.freeze({ points: 30, limit: 1, category: 'worldWin' }),
  [SCORE_EVENT_TYPES.RANDOM_EVENT]: Object.freeze({ points: 0, limit: Infinity, category: null }),
});

export const MAX_SCORE_PER_WORLD = 70;

function reject(reason) {
  return { accepted: false, pointsAwarded: 0, reason };
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)]));
  }
  return value;
}

export function creditScore(state, event) {
  if (!event || typeof event !== 'object' || !SCORE_RULES[event.type]) {
    return reject('invalid-event-type');
  }
  if (typeof event.eventId !== 'string' || event.eventId.length === 0) {
    return reject('invalid-event-id');
  }
  if (!state.participants.some(participant => participant.id === event.participantId)) {
    return reject('invalid-participant');
  }
  if (!state.worldOrder.includes(event.worldId)) {
    return reject('invalid-world');
  }
  if (!state.currentWorldRun || event.worldRunId !== state.currentWorldRun.id) {
    return reject('stale-world-run');
  }
  if (event.worldId !== state.currentWorldRun.worldId) {
    return reject('invalid-world');
  }
  if (state.processedScoreEvents.has(event.eventId)) {
    return reject('duplicate-event');
  }

  const rule = SCORE_RULES[event.type];
  const counters = state.currentWorldCounters[event.participantId];
  if (
    event.type === SCORE_EVENT_TYPES.WORLD_WIN &&
    state.participants.some(participant => state.currentWorldCounters[participant.id].worldWin >= rule.limit)
  ) {
    return reject('category-limit-reached');
  }
  if (rule.category && counters[rule.category] >= rule.limit) {
    return reject('category-limit-reached');
  }

  state.processedScoreEvents.add(event.eventId);
  if (rule.category) counters[rule.category] += 1;

  if (rule.points === 0) {
    return { accepted: true, pointsAwarded: 0, reason: 'no-points' };
  }

  const breakdownEntry = {
    eventId: event.eventId,
    worldRunId: event.worldRunId,
    participantId: event.participantId,
    worldId: event.worldId,
    type: event.type,
    points: rule.points,
    source: event.source && typeof event.source === 'object' ? cloneData(event.source) : {},
  };
  state.currentWorldBreakdown.push(breakdownEntry);
  state.currentWorldScore[event.participantId] += rule.points;
  state.totalScores[event.participantId] += rule.points;

  return {
    accepted: true,
    pointsAwarded: rule.points,
    reason: 'awarded',
  };
}

export function getFinalResult(state) {
  const [first, second] = state.participants;
  const firstScore = state.totalScores[first.id];
  const secondScore = state.totalScores[second.id];
  const isTie = firstScore === secondScore;
  const finalWinnerId = isTie ? null : (firstScore > secondScore ? first.id : second.id);
  return {
    completed: state.worldResults.length === state.worldOrder.length,
    finalWinnerId,
    isTie,
    totalScores: { ...state.totalScores },
  };
}

export function hasZeroedLaraWorld(state, participantId) {
  const result = getFinalResult(state);
  const participant = state.participants.find(item => item.id === participantId);
  return !!participant && !participant.isBot && result.completed && result.finalWinnerId === participantId;
}

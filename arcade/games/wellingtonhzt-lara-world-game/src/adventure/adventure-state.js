import { validateCampaign } from '../data/campaigns.js';
import { SCORING_MODEL_ID, creditScore, getFinalResult } from './adventure-scoring.js';

export const ADVENTURE_SCHEMA_VERSION = 1;

let adventureSequence = 0;

export class InvalidAdventureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidAdventureError';
  }
}

function validateParticipants(participants) {
  if (!Array.isArray(participants) || participants.length !== 2) {
    throw new InvalidAdventureError('Adventure MVP requires exactly two participants');
  }
  const ids = new Set();
  const slots = new Set();
  for (const participant of participants) {
    if (!participant || typeof participant !== 'object') {
      throw new InvalidAdventureError('Participant must be an object');
    }
    if (typeof participant.id !== 'string' || participant.id.length === 0 || ids.has(participant.id)) {
      throw new InvalidAdventureError('Participants must have distinct non-empty ids');
    }
    if (!Number.isInteger(participant.slot) || slots.has(participant.slot)) {
      throw new InvalidAdventureError('Participants must have distinct integer slots');
    }
    if (typeof participant.name !== 'string' || participant.name.length === 0) {
      throw new InvalidAdventureError('Participant must have a non-empty name');
    }
    if (typeof participant.isBot !== 'boolean') {
      throw new InvalidAdventureError('Participant must define isBot');
    }
    ids.add(participant.id);
    slots.add(participant.slot);
  }
  if (participants[0].slot !== 0 || participants[0].isBot) {
    throw new InvalidAdventureError('First participant must be a human in slot 0');
  }
  if (participants[1].slot !== 1) {
    throw new InvalidAdventureError('Second participant must use slot 1');
  }
  if (participants[0].id !== 'p1' || participants[1].id !== 'p2') {
    throw new InvalidAdventureError('Adventure MVP participant ids must be p1 and p2');
  }
}

function copyParticipant(participant) {
  return Object.freeze({
    id: participant.id,
    slot: participant.slot,
    name: participant.name,
    emoji: participant.emoji || '',
    tokenId: participant.tokenId || '',
    isBot: participant.isBot,
  });
}

function emptyParticipantRecord(participants, factory) {
  return Object.fromEntries(participants.map(participant => [participant.id, factory()]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)]));
  }
  return value;
}

function resetWorldRuntime(state) {
  state.currentWorldScore = emptyParticipantRecord(state.participants, () => 0);
  state.currentWorldCounters = emptyParticipantRecord(state.participants, () => ({
    challengeCorrect: 0,
    minigameWin: 0,
    worldWin: 0,
  }));
  state.currentWorldBreakdown = [];
}

export function createAdventure({ campaign, participants, initialStarterId }) {
  validateCampaign(campaign);
  validateParticipants(participants);
  if (!participants.some(participant => participant.id === initialStarterId)) {
    throw new InvalidAdventureError('Initial starter must be a valid participant');
  }

  const safeParticipants = Object.freeze(participants.map(copyParticipant));
  adventureSequence += 1;
  const state = {
    schemaVersion: ADVENTURE_SCHEMA_VERSION,
    active: true,
    campaignId: campaign.id,
    adventureRunId: `${campaign.id}:adventure-${adventureSequence}`,
    scoringModelId: SCORING_MODEL_ID,
    currentWorldIndex: 0,
    worldOrder: Object.freeze([...campaign.worldOrder]),
    participants: safeParticipants,
    initialStarterId,
    totalScores: emptyParticipantRecord(safeParticipants, () => 0),
    currentWorldScore: {},
    currentWorldCounters: {},
    currentWorldBreakdown: [],
    processedScoreEvents: new Set(),
    worldResults: [],
    currentWorldRun: null,
    worldRunSequence: 0,
    completed: false,
    finalWinnerId: null,
    isTie: false,
  };
  resetWorldRuntime(state);
  return state;
}

export function getStarterForWorld(initialStarterId, worldIndex, participants) {
  validateParticipants(participants);
  if (!Number.isInteger(worldIndex) || worldIndex < 0) {
    throw new InvalidAdventureError('World index must be a non-negative integer');
  }
  const starterIndex = participants.findIndex(participant => participant.id === initialStarterId);
  if (starterIndex < 0) throw new InvalidAdventureError('Initial starter must be a valid participant');
  return participants[(starterIndex + worldIndex) % participants.length].id;
}

export function openCurrentWorld(state) {
  if (!state.active || state.completed) throw new InvalidAdventureError('Adventure is not active');
  if (state.currentWorldRun) throw new InvalidAdventureError('Current world is already open');
  const worldId = state.worldOrder[state.currentWorldIndex];
  if (!worldId) throw new InvalidAdventureError('Current world does not exist');
  resetWorldRuntime(state);
  state.worldRunSequence += 1;
  state.currentWorldRun = {
    id: `${state.adventureRunId}:run-${state.worldRunSequence}`,
    worldId,
    worldIndex: state.currentWorldIndex,
    starterId: getStarterForWorld(state.initialStarterId, state.currentWorldIndex, state.participants),
    scoresBefore: { ...state.totalScores },
  };
  return { ...state.currentWorldRun, scoresBefore: { ...state.currentWorldRun.scoresBefore } };
}

export function registerScoreEvent(state, event) {
  if (!state.active || state.completed) {
    return { accepted: false, pointsAwarded: 0, reason: 'adventure-not-active' };
  }
  return creditScore(state, event);
}

export function resetCurrentWorld(state) {
  if (!state.currentWorldRun) throw new InvalidAdventureError('No world is open');
  state.totalScores = { ...state.currentWorldRun.scoresBefore };
  state.currentWorldRun = null;
  resetWorldRuntime(state);
  return openCurrentWorld(state);
}

export function completeCurrentWorld(state, { winnerId } = {}) {
  if (!state.currentWorldRun) throw new InvalidAdventureError('No world is open');
  if (!state.participants.some(participant => participant.id === winnerId)) {
    throw new InvalidAdventureError('World winner must be a valid participant');
  }
  if (state.worldResults.some(result => result.worldId === state.currentWorldRun.worldId)) {
    throw new InvalidAdventureError('World was already completed');
  }

  const result = deepFreeze({
    worldId: state.currentWorldRun.worldId,
    worldRunId: state.currentWorldRun.id,
    starterId: state.currentWorldRun.starterId,
    winnerId,
    scoresBefore: { ...state.currentWorldRun.scoresBefore },
    scoresEarned: { ...state.currentWorldScore },
    scoresAfter: { ...state.totalScores },
    eventBreakdown: cloneData(state.currentWorldBreakdown),
  });
  state.worldResults.push(result);
  state.currentWorldRun = null;

  if (state.worldResults.length === state.worldOrder.length) {
    state.completed = true;
    state.active = false;
    const finalResult = getFinalResult(state);
    state.finalWinnerId = finalResult.finalWinnerId;
    state.isTie = finalResult.isTie;
  } else {
    state.currentWorldIndex += 1;
    resetWorldRuntime(state);
  }
  return result;
}

export function endAdventure(state) {
  state.active = false;
  state.currentWorldRun = null;
  resetWorldRuntime(state);
}

export function restartAdventure(state) {
  state.active = true;
  state.currentWorldIndex = 0;
  state.totalScores = emptyParticipantRecord(state.participants, () => 0);
  state.processedScoreEvents = new Set();
  state.worldResults = [];
  state.currentWorldRun = null;
  state.completed = false;
  state.finalWinnerId = null;
  state.isTie = false;
  resetWorldRuntime(state);
  return state;
}

export function getAdventureMapProgress(state, campaign) {
  validateCampaign(campaign);
  if (campaign.id !== state.campaignId) throw new InvalidAdventureError('Campaign does not match adventure state');
  return campaign.worldOrder.map((worldId, index) => {
    const result = state.worldResults.find(item => item.worldId === worldId);
    const status = result
      ? 'completed'
      : (!state.completed && index === state.currentWorldIndex ? 'current' : 'locked');
    return {
      worldId,
      order: index + 1,
      status,
      winnerId: result?.winnerId ?? null,
    };
  });
}

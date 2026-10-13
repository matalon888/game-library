import { MAIN_CAMPAIGN_ID, getCampaign } from '../data/campaigns.js';
import {
  InvalidAdventureError,
  completeCurrentWorld,
  createAdventure,
  endAdventure,
  getAdventureMapProgress,
  getStarterForWorld,
  openCurrentWorld,
  registerScoreEvent,
  resetCurrentWorld,
} from './adventure-state.js';
import { getFinalResult } from './adventure-scoring.js';

export const GAME_MODES = Object.freeze({
  QUICK: 'rapido',
  ADVENTURE: 'aventura',
});

export class StaleWorldOperationError extends Error {
  constructor() {
    super('Operation belongs to an inactive world run');
    this.name = 'StaleWorldOperationError';
  }
}

export function isQuickGame(mode = GAME_MODES.QUICK) {
  return mode === GAME_MODES.QUICK;
}

export function isAdventureGame(mode) {
  return mode === GAME_MODES.ADVENTURE;
}

export function toAdventureParticipants(boardPlayers) {
  if (!Array.isArray(boardPlayers) || boardPlayers.length !== 2) {
    throw new InvalidAdventureError('Adventure requires two board participants');
  }
  return boardPlayers.map((player, slot) => ({
    id: slot === 0 ? 'p1' : 'p2',
    slot,
    name: player.name,
    emoji: player.emoji || '',
    tokenId: player.tokenId || '',
    isBot: !!player.isBot,
  }));
}

export function toBoardRuntimeParticipants(participants) {
  return participants.map(participant => ({
    id: participant.id,
    slot: participant.slot,
    name: participant.name,
    emoji: participant.emoji,
    tokenId: participant.tokenId,
    isBot: participant.isBot,
    posicao: 0,
    rodadasPerdidas: 0,
    element: null,
  }));
}

export function createAdventureRuntime({
  resolveWorld,
  scheduleTimeout = (callback, delay) => setTimeout(callback, delay),
  cancelTimeout = timerId => clearTimeout(timerId),
} = {}) {
  if (typeof resolveWorld !== 'function') {
    throw new InvalidAdventureError('Adventure runtime requires a world resolver');
  }

  let mode = GAME_MODES.QUICK;
  let activeAdventure = null;
  let campaign = null;
  let boardParticipants = [];
  let botTimer = null;
  const previewCampaign = getCampaign(MAIN_CAMPAIGN_ID);

  function enrichProgress(progress) {
    return progress.map(item => {
      const world = resolveWorld(item.worldId);
      return {
        ...item,
        name: world?.name || item.worldId,
        icon: world?.icon || '🌍',
      };
    });
  }

  function getCampaignPreview() {
    return {
      campaign: previewCampaign,
      progress: enrichProgress(previewCampaign.worldOrder.map((worldId, index) => ({
        worldId,
        order: index + 1,
        status: index === 0 ? 'current' : 'locked',
        winnerId: null,
      }))),
      totalScores: { p1: 0, p2: 0 },
      participants: [],
      currentWorldId: null,
      nextWorldId: previewCampaign.worldOrder[0],
      starterId: null,
      completed: false,
      finalResult: null,
      worldResults: [],
    };
  }

  function requireAdventure() {
    if (!activeAdventure || !isAdventureGame(mode)) {
      throw new InvalidAdventureError('No active adventure');
    }
    return activeAdventure;
  }

  function cancelBotTimer() {
    if (botTimer !== null) cancelTimeout(botTimer);
    botTimer = null;
  }

  function createWorldDescriptor(worldRun) {
    const worldConfig = resolveWorld(worldRun.worldId);
    if (!worldConfig || worldConfig.id !== worldRun.worldId) {
      throw new InvalidAdventureError(`World "${worldRun.worldId}" could not be resolved`);
    }
    boardParticipants = toBoardRuntimeParticipants(activeAdventure.participants);
    return {
      worldId: worldRun.worldId,
      worldRunId: worldRun.id,
      starterId: worldRun.starterId,
      starterIndex: activeAdventure.participants.findIndex(item => item.id === worldRun.starterId),
      worldConfig,
      participants: boardParticipants.map(item => ({ ...item })),
    };
  }

  function startAdventure({
    participants,
    initialStarterId,
    campaignId = MAIN_CAMPAIGN_ID,
  }) {
    if (activeAdventure) throw new InvalidAdventureError('An adventure is already active');
    campaign = getCampaign(campaignId);
    activeAdventure = createAdventure({ campaign, participants, initialStarterId });
    mode = GAME_MODES.ADVENTURE;
    return createWorldDescriptor(openCurrentWorld(activeAdventure));
  }

  function abandonAdventure() {
    cancelBotTimer();
    if (activeAdventure) endAdventure(activeAdventure);
    activeAdventure = null;
    campaign = null;
    boardParticipants = [];
    mode = GAME_MODES.QUICK;
  }

  function getCurrentWorld() {
    const state = requireAdventure();
    if (!state.currentWorldRun) return null;
    return {
      worldId: state.currentWorldRun.worldId,
      worldRunId: state.currentWorldRun.id,
      starterId: state.currentWorldRun.starterId,
      isLastWorld: state.currentWorldIndex === state.worldOrder.length - 1,
    };
  }

  function isCurrentWorldRun(worldRunId) {
    return !!activeAdventure?.active && activeAdventure.currentWorldRun?.id === worldRunId;
  }

  function assertCurrentWorldRun(worldRunId) {
    if (!isCurrentWorldRun(worldRunId)) throw new StaleWorldOperationError();
    return true;
  }

  function runIfCurrentWorld(worldRunId, callback) {
    if (!isCurrentWorldRun(worldRunId)) return false;
    callback();
    return true;
  }

  function scheduleBotForCurrentWorld(callback, delay) {
    const current = getCurrentWorld();
    if (!current) throw new InvalidAdventureError('No adventure world is open');
    cancelBotTimer();
    botTimer = scheduleTimeout(() => {
      botTimer = null;
      runIfCurrentWorld(current.worldRunId, callback);
    }, delay);
    return botTimer;
  }

  function resetWorld() {
    const state = requireAdventure();
    cancelBotTimer();
    return createWorldDescriptor(resetCurrentWorld(state));
  }

  function completeWorld({ winnerId }) {
    const state = requireAdventure();
    cancelBotTimer();
    const result = completeCurrentWorld(state, { winnerId });
    return {
      result,
      completed: state.completed,
      finalResult: state.completed ? getFinalResult(state) : null,
    };
  }

  function recordScoreEvent(event) {
    return registerScoreEvent(requireAdventure(), event);
  }

  function advanceWorld() {
    const state = requireAdventure();
    if (state.completed) throw new InvalidAdventureError('Adventure is already completed');
    if (state.currentWorldRun) throw new InvalidAdventureError('Current world must be completed before advancing');
    if (state.worldResults.length !== state.currentWorldIndex) {
      throw new InvalidAdventureError('Adventure world order is inconsistent');
    }
    cancelBotTimer();
    return createWorldDescriptor(openCurrentWorld(state));
  }

  function getMapData() {
    const state = requireAdventure();
    const current = getCurrentWorld();
    const nextWorldId = state.completed ? null : state.worldOrder[state.currentWorldIndex] || null;
    return {
      campaign,
      progress: enrichProgress(getAdventureMapProgress(state, campaign)),
      totalScores: { ...state.totalScores },
      currentWorldScore: { ...state.currentWorldScore },
      currentWorldBreakdown: state.currentWorldBreakdown.map(entry => ({
        ...entry,
        source: { ...entry.source },
      })),
      currentWorldId: current?.worldId ?? null,
      nextWorldId,
      starterId: current?.starterId ?? null,
      nextStarterId: state.completed ? null : getStarterForWorld(
        state.initialStarterId,
        state.currentWorldIndex,
        state.participants,
      ),
      participants: state.participants.map(item => ({ ...item })),
      worldResults: [...state.worldResults],
      completed: state.completed,
      finalResult: state.completed ? getFinalResult(state) : null,
    };
  }

  return Object.freeze({
    getMode: () => mode,
    isQuickGame: () => isQuickGame(mode),
    isAdventureGame: () => isAdventureGame(mode),
    hasActiveAdventure: () => activeAdventure !== null,
    getCampaignPreview,
    startAdventure,
    abandonAdventure,
    getCurrentWorld,
    getBoardParticipants: () => boardParticipants.map(item => ({ ...item })),
    isCurrentWorldRun,
    assertCurrentWorldRun,
    runIfCurrentWorld,
    scheduleBotForCurrentWorld,
    cancelBotTimer,
    resetWorld,
    recordScoreEvent,
    completeWorld,
    advanceWorld,
    getMapData,
  });
}

import { getMinigame } from './minigame-registry.js';

export const DEFAULT_BOT_RATE = 0.5;
export const DEFAULT_AUTO_RETURN_SECONDS = 5;

function isProfileObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeContext(context) {
  return typeof context === 'string' && context.length > 0 ? context : 'board';
}

export function createDefaultLegacyProfile(config) {
  return {
    botSuccessRate: config.botSuccessRate,
    autoReturnSeconds: config.autoReturnSeconds,
    rewards: config.rewards,
    presentation: config.presentation,
    botPresentation: config.botPresentation
  };
}

export function hasProfile(id, context = 'board') {
  const config = getMinigame(id);
  const ctx = normalizeContext(context);
  const profiles = isProfileObject(config.profiles) ? config.profiles : null;
  return !!profiles && isProfileObject(profiles[ctx]);
}

export function getProfile(id, context = 'board') {
  const config = getMinigame(id);
  const ctx = normalizeContext(context);
  const profiles = isProfileObject(config.profiles) ? config.profiles : null;
  if (profiles) {
    if (isProfileObject(profiles[ctx])) return profiles[ctx];
    if (isProfileObject(profiles.board)) return profiles.board;
  }
  return null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function mergeSections(...layers) {
  const merged = {};
  for (const layer of layers) {
    if (!isProfileObject(layer)) continue;
    for (const key of Object.keys(layer)) {
      const value = layer[key];
      if (value !== undefined) merged[key] = value;
    }
  }
  return merged;
}

export function getEffectiveConfig(id, context = 'board') {
  const config = getMinigame(id);
  const ctx = normalizeContext(context);
  const profiles = isProfileObject(config.profiles) ? config.profiles : null;

  const boardProfile = profiles && isProfileObject(profiles.board) ? profiles.board : {};
  const contextProfile = ctx !== 'board' && profiles && isProfileObject(profiles[ctx]) ? profiles[ctx] : {};

  const legacy = {
    botSuccessRate: config.botSuccessRate,
    autoReturnSeconds: config.autoReturnSeconds,
    rewards: config.rewards,
    presentation: config.presentation,
    botPresentation: config.botPresentation
  };

  return {
    botSuccessRate: firstDefined(
      contextProfile.botSuccessRate,
      boardProfile.botSuccessRate,
      legacy.botSuccessRate,
      DEFAULT_BOT_RATE
    ),
    autoReturnSeconds: firstDefined(
      contextProfile.autoReturnSeconds,
      boardProfile.autoReturnSeconds,
      legacy.autoReturnSeconds,
      DEFAULT_AUTO_RETURN_SECONDS
    ),
    rewards: mergeSections(legacy.rewards, boardProfile.rewards, contextProfile.rewards),
    presentation: mergeSections(legacy.presentation, boardProfile.presentation, contextProfile.presentation),
    botPresentation: mergeSections(legacy.botPresentation, boardProfile.botPresentation, contextProfile.botPresentation),
    resultStats: firstDefined(
      contextProfile.resultStats,
      boardProfile.resultStats,
      []
    )
  };
}

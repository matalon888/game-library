// ── Error Classes ──

export class InvalidSessionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidSessionError';
  }
}

export class SessionAlreadyActiveError extends Error {
  constructor() {
    super('A session is already active. Call endSession() first.');
    this.name = 'SessionAlreadyActiveError';
  }
}

export class NoActiveSessionError extends Error {
  constructor() {
    super('No active session. Call initSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

// ── Session State ──

let _session = null;

// ── Validation ──

function validateSessionConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new InvalidSessionError('Session config must be a non-null object');
  }

  if (config.modoJogo !== 'rapido' && config.modoJogo !== 'carreira') {
    throw new InvalidSessionError(
      `Invalid modoJogo: "${config.modoJogo}". Must be "rapido" or "carreira"`
    );
  }

  if (typeof config.isSinglePlayer !== 'boolean') {
    throw new InvalidSessionError('Session must specify isSinglePlayer as boolean');
  }

  if (!Array.isArray(config.players) || config.players.length === 0) {
    throw new InvalidSessionError('Session must have at least one player');
  }

  for (const [i, p] of config.players.entries()) {
    if (typeof p.id !== 'number') {
      throw new InvalidSessionError(`players[${i}] missing required numeric field "id"`);
    }
    if (!p.name || typeof p.name !== 'string') {
      throw new InvalidSessionError(`players[${i}] missing required field "name"`);
    }
    if (!p.emoji || typeof p.emoji !== 'string') {
      throw new InvalidSessionError(`players[${i}] missing required field "emoji"`);
    }
    if (typeof p.isBot !== 'boolean') {
      throw new InvalidSessionError(`players[${i}] missing required field "isBot"`);
    }
  }
}

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

// ── Public API ──

export function initSession(config) {
  if (_session !== null) {
    throw new SessionAlreadyActiveError();
  }

  validateSessionConfig(config);

  const session = {
    modoJogo: config.modoJogo,
    isSinglePlayer: config.isSinglePlayer,
    players: config.players.map(p => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      isBot: p.isBot,
    })),
    worldId: config.worldId || null,
    campaignId: config.campaignId || null,
    completedWorlds: [],
    seed: typeof config.seed === 'number' ? config.seed : Date.now(),
    drawState: config.drawState || null,
  };

  _session = deepFreeze(session);
}

export function getSession() {
  if (_session === null) {
    throw new NoActiveSessionError();
  }
  return _session;
}

export function endSession() {
  _session = null;
}

export function resetSession(config) {
  _session = null;
  initSession(config);
}

export function isSessionActive() {
  return _session !== null;
}

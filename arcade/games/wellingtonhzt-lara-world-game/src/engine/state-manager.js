// ── Error Classes ──

export class InvalidStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

export class NoActiveStateError extends Error {
  constructor() {
    super('No active state. Call initState() first.');
    this.name = 'NoActiveStateError';
  }
}

// ── State ──

let _state = null;
let _isInitialized = false;

// ── Validation ──

function validateStateInput(worldId, players) {
  if (!worldId || typeof worldId !== 'string') {
    throw new InvalidStateError('worldId must be a non-empty string');
  }

  if (!Array.isArray(players) || players.length === 0) {
    throw new InvalidStateError('State must have at least one player reference');
  }

  for (const [i, p] of players.entries()) {
    if (typeof p.id !== 'number') {
      throw new InvalidStateError(`players[${i}] missing required field "id"`);
    }
  }
}

// ── Helpers ──

function createPlayerRuntime(input) {
  return {
    id: input.id,
    position: typeof input.position === 'number' ? Math.max(0, input.position) : 0,
    skippedTurns: typeof input.skippedTurns === 'number' ? Math.max(0, input.skippedTurns) : 0,
  };
}

function deepClone(obj) {
  if (obj instanceof Set) return new Set(obj);
  if (Array.isArray(obj)) return obj.map(deepClone);
  if (obj && typeof obj === 'object') {
    const clone = {};
    for (const key of Object.keys(obj)) {
      clone[key] = deepClone(obj[key]);
    }
    return clone;
  }
  return obj;
}

function ensureActiveState() {
  if (!_isInitialized || _state === null) {
    throw new NoActiveStateError();
  }
}

function findPlayer(playerId) {
  const player = _state.players.find(p => p.id === playerId);
  if (!player) {
    throw new InvalidStateError(`Player ${playerId} not found in active state`);
  }
  return player;
}

// ── Lifecycle ──

export function initState(worldId, players) {
  validateStateInput(worldId, players);

  _state = {
    currentPlayerIndex: 0,
    isActive: true,
    isFinished: false,
    isLocked: false,
    currentWorldId: worldId,
    usedQuestionIds: new Set(),
    justEnteredPortal: false,
    players: players.map(createPlayerRuntime),
  };

  _isInitialized = true;
}

export function getState() {
  ensureActiveState();
  return cloneState();
}

export function cloneState() {
  ensureActiveState();
  return deepClone(_state);
}

export function resetState(worldId, players) {
  _state = null;
  _isInitialized = false;
  initState(worldId, players);
}

// ── Game lifecycle ──

export function isActive() {
  return _isInitialized && _state !== null && _state.isActive;
}

export function isFinished() {
  return _isInitialized && _state !== null && _state.isFinished;
}

export function isLocked() {
  return _isInitialized && _state !== null && _state.isLocked;
}

export function setLocked(value) {
  ensureActiveState();
  _state.isLocked = !!value;
}

export function setActive(value) {
  ensureActiveState();
  _state.isActive = !!value;
}

export function finishGame() {
  ensureActiveState();
  _state.isActive = false;
  _state.isFinished = true;
}

// ── Turn management ──
// Complex turn rules (extra, skip, reverse) will be handled
// by a future TurnManager. This module only does mechanical
// turn advancement.

export function getCurrentPlayerIndex() {
  ensureActiveState();
  return _state.currentPlayerIndex;
}

export function setCurrentPlayerIndex(index) {
  ensureActiveState();
  if (typeof index !== 'number' || index < 0 || index >= _state.players.length) {
    throw new InvalidStateError(
      `Invalid player index ${index}. Must be 0..${_state.players.length - 1}.`
    );
  }
  _state.currentPlayerIndex = index;
}

export function advanceTurn() {
  ensureActiveState();
  _state.currentPlayerIndex =
    (_state.currentPlayerIndex + 1) % _state.players.length;
}

// ── Player position ──

export function getPlayerPosition(playerId) {
  ensureActiveState();
  return findPlayer(playerId).position;
}

export function setPlayerPosition(playerId, position) {
  ensureActiveState();
  if (typeof position !== 'number' || position < 0) {
    throw new InvalidStateError(`Invalid position ${position}. Must be >= 0.`);
  }
  findPlayer(playerId).position = position;
}

export function movePlayer(playerId, delta) {
  ensureActiveState();
  if (typeof delta !== 'number') {
    throw new InvalidStateError('delta must be a number');
  }
  const player = findPlayer(playerId);
  player.position = Math.max(0, player.position + delta);
}

// ── Skipped turns ──

export function getSkippedTurns(playerId) {
  ensureActiveState();
  return findPlayer(playerId).skippedTurns;
}

export function setSkippedTurns(playerId, count) {
  ensureActiveState();
  if (typeof count !== 'number' || count < 0) {
    throw new InvalidStateError(`Invalid skippedTurns ${count}. Must be >= 0.`);
  }
  findPlayer(playerId).skippedTurns = count;
}

export function decrementSkippedTurns(playerId) {
  ensureActiveState();
  const player = findPlayer(playerId);
  if (player.skippedTurns > 0) {
    player.skippedTurns--;
  }
}

// ── Questions ──

export function markQuestionUsed(id) {
  ensureActiveState();
  _state.usedQuestionIds.add(id);
}

export function isQuestionUsed(id) {
  ensureActiveState();
  return _state.usedQuestionIds.has(id);
}

export function resetUsedQuestions() {
  ensureActiveState();
  _state.usedQuestionIds.clear();
}

// ── World ──

export function getWorldId() {
  ensureActiveState();
  return _state.currentWorldId;
}

export function setWorldId(id) {
  ensureActiveState();
  if (!id || typeof id !== 'string') {
    throw new InvalidStateError('worldId must be a non-empty string');
  }
  _state.currentWorldId = id;
}

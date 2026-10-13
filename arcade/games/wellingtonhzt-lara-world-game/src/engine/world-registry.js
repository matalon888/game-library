import { hasCategory } from '../data/questions/category-catalog.js';

// ── Error Classes ──

export class WorldNotFoundError extends Error {
  constructor(id) {
    super(`World "${id}" not found in registry`);
    this.name = 'WorldNotFoundError';
    this.worldId = id;
  }
}

export class DuplicateWorldError extends Error {
  constructor(id) {
    super(`World "${id}" is already registered`);
    this.name = 'DuplicateWorldError';
    this.worldId = id;
  }
}

export class InvalidWorldConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidWorldConfigError';
  }
}

export class NoWorldsAvailableError extends Error {
  constructor(detail) {
    const msg = detail
      ? `No worlds available: ${detail}`
      : 'No worlds available after applying the filter';
    super(msg);
    this.name = 'NoWorldsAvailableError';
  }
}

// ── Registry State ──

const _registry = new Map();
let _isLoaded = false;

// ── Helpers ──

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

function ensureLoaded() {
  if (!_isLoaded && _registry.size > 0) {
    console.warn('[WorldRegistry] Registry used before loadAllWorlds completed');
  }
}

// ── Validation ──

function validateWorldConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new InvalidWorldConfigError('WorldConfig must be a non-null object');
  }

  const requiredFields = [
    ['id', 'string'],
    ['name', 'string'],
    ['type', 'string'],
    ['version', 'string'],
  ];

  for (const [field, kind] of requiredFields) {
    const val = config[field];
    if (typeof val !== kind || (kind === 'string' && val.length === 0)) {
      throw new InvalidWorldConfigError(
        `Missing or invalid required field "${field}": expected non-empty ${kind}, got ${typeof val}`
      );
    }
  }

  if (config.type !== 'main' && config.type !== 'subworld') {
    throw new InvalidWorldConfigError(
      `Invalid type "${config.type}": must be "main" or "subworld"`
    );
  }

  if (!config.board || typeof config.board !== 'object') {
    throw new InvalidWorldConfigError('Missing required field "board"');
  }

  if (!Number.isInteger(config.board.totalCells) || config.board.totalCells < 1) {
    throw new InvalidWorldConfigError(
      `board.totalCells must be a positive integer, got ${config.board.totalCells}`
    );
  }

  const total = config.board.totalCells;

  const hasPositions = !!config.board.positions;
  const hasCells = !!config.board.cells;
  const hasLayouts = !!config.board.layouts;

  if (!hasPositions && !hasCells && !hasLayouts) {
    throw new InvalidWorldConfigError('Missing required field "board.positions", "board.cells", or "board.layouts"');
  }

  if (hasLayouts) {
    if (typeof config.board.layouts !== 'object' || Array.isArray(config.board.layouts)) {
      throw new InvalidWorldConfigError('"board.layouts" must be an object (layoutId -> layout)');
    }
    if (!config.board.defaultLayout || typeof config.board.defaultLayout !== 'string') {
      throw new InvalidWorldConfigError('"board.defaultLayout" is required when board.layouts is provided');
    }
    const layoutIds = Object.keys(config.board.layouts);
    if (layoutIds.length === 0) {
      throw new InvalidWorldConfigError('"board.layouts" must contain at least one layout');
    }
    if (!config.board.layouts[config.board.defaultLayout]) {
      throw new InvalidWorldConfigError(`board.defaultLayout "${config.board.defaultLayout}" not found in board.layouts`);
    }
    for (const [lid, layout] of Object.entries(config.board.layouts)) {
      if (!layout.id || typeof layout.id !== 'string') {
        throw new InvalidWorldConfigError(`board.layouts["${lid}"] missing required "id"`);
      }
      if (!layout.name || typeof layout.name !== 'string') {
        throw new InvalidWorldConfigError(`board.layouts["${lid}"] missing required "name"`);
      }
      if (!Array.isArray(layout.cells)) {
        throw new InvalidWorldConfigError(`board.layouts["${lid}"] missing required "cells" array`);
      }
      const seen = new Set();
      for (const c of layout.cells) {
        if (!Number.isInteger(c.id) || c.id < 1 || c.id > total) {
          throw new InvalidWorldConfigError(
            `board.layouts["${lid}"].cells: each cell must have an integer id in 1..${total}`
          );
        }
        if (seen.has(c.id)) throw new InvalidWorldConfigError(`board.layouts["${lid}"].cells: duplicate cell id ${c.id}`);
        seen.add(c.id);
        if (typeof c.x !== 'number' || typeof c.y !== 'number') {
          throw new InvalidWorldConfigError(`board.layouts["${lid}"].cells[${c.id}]: x and y must be numbers`);
        }
      }
      if (seen.size === 0) {
        throw new InvalidWorldConfigError(`board.layouts["${lid}"].cells must contain at least one cell`);
      }
    }
  }

  if (hasPositions) {
    const posKeys = Object.keys(config.board.positions)
      .map(Number)
      .filter(k => Number.isInteger(k) && k >= 1 && k <= total);

    if (posKeys.length === 0) {
      throw new InvalidWorldConfigError(
        `board.positions must cover at least one cell in range 1..${total}`
      );
    }

    for (let cell = 1; cell <= total; cell++) {
      const pos = config.board.positions[cell];
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
        console.warn(
          `[WorldRegistry] World "${config.id}": board.positions[${cell}] is missing or has no x/y coordinates`
        );
      }
    }
  }

  if (hasCells) {
    if (!Array.isArray(config.board.cells)) {
      throw new InvalidWorldConfigError('"board.cells" must be an array');
    }
    const seen = new Set();
    for (const c of config.board.cells) {
      if (!Number.isInteger(c.id) || c.id < 1 || c.id > total) {
        throw new InvalidWorldConfigError(
          `board.cells: each cell must have an integer id in 1..${total}`
        );
      }
      if (seen.has(c.id)) throw new InvalidWorldConfigError(`board.cells: duplicate cell id ${c.id}`);
      seen.add(c.id);
      if (typeof c.x !== 'number' || typeof c.y !== 'number') {
        throw new InvalidWorldConfigError(
          `board.cells[${c.id}]: x and y must be numbers`
        );
      }
    }
    if (seen.size === 0) {
      throw new InvalidWorldConfigError('board.cells must contain at least one cell');
    }
  }

  if (!config.objectives || !Array.isArray(config.objectives) || config.objectives.length === 0) {
    throw new InvalidWorldConfigError('objectives must be a non-empty array');
  }

  for (const [i, obj] of config.objectives.entries()) {
    if (typeof obj.type !== 'string' || obj.type.length === 0) {
      throw new InvalidWorldConfigError(`objectives[${i}] missing required field "type"`);
    }
    if (typeof obj.label !== 'string' || obj.label.length === 0) {
      throw new InvalidWorldConfigError(`objectives[${i}] missing required field "label"`);
    }
  }

  if (!config.events || typeof config.events !== 'object') {
    throw new InvalidWorldConfigError('Missing required field "events"');
  }

  const eventKeys = Object.keys(config.events);
  for (const key of eventKeys) {
    const cellNum = Number(key);
    if (!Number.isInteger(cellNum) || cellNum < 1 || cellNum > total) {
      throw new InvalidWorldConfigError(
        `Event key "${key}" is not a valid cell number (1..${total})`
      );
    }
    if (!Array.isArray(config.events[key])) {
      throw new InvalidWorldConfigError(`Events for cell ${key} must be an array`);
    }
  }

  if (config.portals && Array.isArray(config.portals)) {
    for (const [i, portal] of config.portals.entries()) {
      if (!portal.id) {
        throw new InvalidWorldConfigError(`portals[${i}] missing required field "id"`);
      }
      if (typeof portal.sourceCell !== 'number') {
        throw new InvalidWorldConfigError(
          `portals[${i}] ("${portal.id}") missing required field "sourceCell"`
        );
      }
    }
  }

  if (config.questionPolicy !== undefined && config.questionPolicy !== null) {
    const qp = config.questionPolicy;
    if (typeof qp !== 'object' || Array.isArray(qp)) {
      throw new InvalidWorldConfigError('questionPolicy must be a non-null object');
    }
    if (!qp.categoryWeights || typeof qp.categoryWeights !== 'object' || Array.isArray(qp.categoryWeights)) {
      throw new InvalidWorldConfigError('questionPolicy.categoryWeights must be a non-null object');
    }
    const catKeys = Object.keys(qp.categoryWeights);
    if (catKeys.length === 0) {
      throw new InvalidWorldConfigError('questionPolicy.categoryWeights must have at least one category');
    }
    let hasPositiveWeight = false;
    for (const [cat, weight] of Object.entries(qp.categoryWeights)) {
      if (!hasCategory(cat)) {
        throw new InvalidWorldConfigError(`questionPolicy.categoryWeights["${cat}"] is not a registered category`);
      }
      if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        throw new InvalidWorldConfigError(`questionPolicy.categoryWeights["${cat}"] must be a finite number`);
      }
      if (weight < 0) {
        throw new InvalidWorldConfigError(`questionPolicy.categoryWeights["${cat}"] cannot be negative`);
      }
      if (weight > 0) hasPositiveWeight = true;
    }
    if (!hasPositiveWeight) {
      throw new InvalidWorldConfigError('questionPolicy.categoryWeights must have at least one weight > 0');
    }
    if (qp.levelRange !== undefined && qp.levelRange !== null) {
      const lr = qp.levelRange;
      if (typeof lr !== 'object' || Array.isArray(lr)) {
        throw new InvalidWorldConfigError('questionPolicy.levelRange must be a non-null object');
      }
      if (lr.min !== undefined) {
        if (!Number.isInteger(lr.min) || lr.min < 1 || lr.min > 3) {
          throw new InvalidWorldConfigError('questionPolicy.levelRange.min must be an integer between 1 and 3');
        }
      }
      if (lr.max !== undefined) {
        if (!Number.isInteger(lr.max) || lr.max < 1 || lr.max > 3) {
          throw new InvalidWorldConfigError('questionPolicy.levelRange.max must be an integer between 1 and 3');
        }
      }
      if (lr.min !== undefined && lr.max !== undefined && lr.min > lr.max) {
        throw new InvalidWorldConfigError('questionPolicy.levelRange.min cannot be greater than max');
      }
    }
  }

  if (typeof config.requiredEngineVersion === 'string') {
    const warn = `World "${config.id}" requires engine version ${config.requiredEngineVersion}. Ensure the engine is compatible.`;
    console.warn(`[WorldRegistry] ${warn}`);
  }
}

// ── Public API ──

export function register(config) {
  validateWorldConfig(config);

  if (_registry.has(config.id)) {
    throw new DuplicateWorldError(config.id);
  }

  const frozen = deepFreeze(config);
  _registry.set(config.id, frozen);
}

export function registerAll(configs) {
  if (!Array.isArray(configs)) {
    throw new InvalidWorldConfigError('registerAll expects an array of WorldConfig');
  }
  for (const config of configs) {
    register(config);
  }
  _isLoaded = true;
}

export function get(id) {
  ensureLoaded();
  if (!_registry.has(id)) {
    throw new WorldNotFoundError(id);
  }
  return _registry.get(id);
}

export function getSafe(id) {
  ensureLoaded();
  return _registry.get(id) || null;
}

export function exists(id) {
  return _registry.has(id);
}

export function list(filter) {
  ensureLoaded();
  const worlds = Array.from(_registry.values());

  worlds.sort((a, b) => {
    const pa = a.metadata?.sortPriority ?? Infinity;
    const pb = b.metadata?.sortPriority ?? Infinity;
    if (pa !== pb) return pa - pb;
    return 0;
  });

  if (typeof filter === 'function') {
    return worlds.filter(filter);
  }

  return worlds;
}

export function ids() {
  ensureLoaded();
  return Array.from(_registry.keys());
}

export function getDefault() {
  ensureLoaded();

  const worlds = Array.from(_registry.values());

  const explicit = worlds.find(w => w.metadata?.default === true);
  if (explicit) return explicit;

  if (worlds.length === 0) {
    throw new NoWorldsAvailableError('No worlds registered');
  }

  return worlds[0];
}

export function random(filter, options = {}) {
  ensureLoaded();

  let worlds = list(filter);
  const { excludeIds = [] } = options || {};

  if (Array.isArray(excludeIds) && excludeIds.length > 0) {
    worlds = worlds.filter(w => !excludeIds.includes(w.id));
  }

  if (worlds.length === 0) {
    throw new NoWorldsAvailableError();
  }

  return worlds[Math.floor(Math.random() * worlds.length)];
}

export function count() {
  return _registry.size;
}

export function isLoaded() {
  return _isLoaded;
}

export function reset() {
  _registry.clear();
  _isLoaded = false;
}

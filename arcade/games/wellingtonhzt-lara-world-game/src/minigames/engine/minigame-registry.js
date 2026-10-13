export class MinigameNotFoundError extends Error {
  constructor(id) {
    super(`Minigame "${id}" not found in registry`);
    this.name = 'MinigameNotFoundError';
    this.minigameId = id;
  }
}

const ID_RE = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;

const registry = new Map();

export function registerMinigame(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('registerMinigame: config must be a non-null object');
  }
  const id = config.id;
  if (!id || typeof id !== 'string') {
    throw new Error('registerMinigame: id is required and must be a string');
  }
  if (!ID_RE.test(id)) {
    throw new Error(`registerMinigame: id "${id}" does not match kebab-case pattern`);
  }
  if (registry.has(id)) {
    throw new Error(`registerMinigame: id "${id}" is already registered`);
  }
  if (typeof config.create !== 'function') {
    throw new Error(`registerMinigame: create must be a function for id "${id}"`);
  }
  registry.set(id, Object.freeze({ ...config }));
}

export function getMinigame(id) {
  if (!registry.has(id)) {
    throw new MinigameNotFoundError(id);
  }
  return registry.get(id);
}

export function hasMinigame(id) {
  return registry.has(id);
}

export function listMinigames() {
  return Array.from(registry.keys());
}

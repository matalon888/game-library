/**
 * @typedef {Object} EventResult
 * @property {boolean} extraTurn - Se o jogador deve jogar novamente
 * @property {boolean} finished - Se o mundo/jogo foi concluído
 */

/**
 * @typedef {Object} EventContext
 * @property {Object} player
 * @property {number} player.id
 * @property {string} player.name
 * @property {string} player.emoji
 * @property {boolean} player.isBot
 *
 * @property {Object} state
 * @property {() => number} state.getPosition
 * @property {(pos: number) => void} state.setPosition
 * @property {() => number} state.getSkippedTurns
 * @property {(count: number) => void} state.setSkippedTurns
 * @property {(itemId: string) => boolean} [state.hasItem]
 * @property {() => number} [state.getTurnCount]
 *
 * @property {Object} world
 * @property {number} world.totalCells
 * @property {number} world.startCell
 *
 * @property {Object} ui
 * @property {(text: string, type: string) => void} ui.addHistory
 * @property {(from: number, to: number) => Promise<void>} ui.animateMovement
 *
 * @property {Object} decisions
 * @property {(category: string|null) => Promise<boolean>} decisions.resolveChallenge
 * @property {(portalId: string) => Promise<boolean>} decisions.resolvePortal
 *
 * @property {Object} callbacks
 * @property {() => Promise<void>} callbacks.onVictory
 * @property {(worldId: string) => Promise<void>} callbacks.onWorldEnter
 * @property {(itemId: string, count: number) => void} [callbacks.onCollectItem]
 * @property {(playerId: number, position: number) => void} [callbacks.onPortalEntryPosition]
 */

/**
 * @callback EventHandler
 * @param {Object} eventConfig
 * @param {EventContext} context
 * @param {Object} [worldConfig]
 * @returns {Promise<EventResult>}
 */

// ── Custom Handler Registry ──

const _customHandlers = new Map();

export function registerEventType(type, handler) {
  if (typeof type !== 'string' || type.length === 0) {
    throw new Error('Event type must be a non-empty string');
  }
  if (typeof handler !== 'function') {
    throw new Error('Event handler must be a function');
  }
  _customHandlers.set(type, handler);
}

export function clearCustomHandlers() {
  _customHandlers.clear();
}

// ── Handler Resolution ──
// Priority: world custom → built-in → global

function resolveHandler(type, worldConfig) {
  if (worldConfig?.customEventHandlers?.[type]) return worldConfig.customEventHandlers[type];
  if (BUILTIN_HANDLERS[type]) return BUILTIN_HANDLERS[type];
  if (_customHandlers.has(type)) return _customHandlers.get(type);
  return null;
}

// ── Built-in Handlers ──

async function handleMove(event, context) {
  const pos = context.state.getPosition();
  const total = context.world.totalCells;
  const { params, description } = event;

  let target;
  if (typeof params?.target === 'number') {
    target = Math.max(0, Math.min(params.target, total));
  } else if (typeof params?.delta === 'number') {
    target = Math.max(0, Math.min(pos + params.delta, total));
  } else {
    return { extraTurn: false, finished: false };
  }

  if (target === pos) return { extraTurn: false, finished: false };

  if (target === total) {
    if (description) context.ui.addHistory(description, 'special');
    await context.ui.animateMovement(pos, total);
    context.state.setPosition(total);
    await context.callbacks.onVictory();
    return { extraTurn: false, finished: true };
  }

  if (description) context.ui.addHistory(description, 'special');
  await context.ui.animateMovement(pos, target);
  context.state.setPosition(target);
  return { extraTurn: false, finished: false };
}

async function handleChallenge(event, context) {
  const pos = context.state.getPosition();
  const total = context.world.totalCells;
  const category = event.params?.category || null;

  context.ui.addHistory(
    event.description || '\u2753 Desafio!',
    'special'
  );

  const isCorrect = await context.decisions.resolveChallenge(category);

  if (isCorrect) {
    const dest = Math.min(pos + 1, total);
    if (dest > pos) await context.ui.animateMovement(pos, dest);
    context.state.setPosition(dest);
    context.ui.addHistory(
      `\u2705 ${context.player.name} acertou! Avan\u00e7ou para casa ${dest}`,
      'special'
    );
    if (dest >= total) {
      await context.callbacks.onVictory();
      return { extraTurn: false, finished: true };
    }
  } else {
    const dest = Math.max(pos - 1, 0);
    if (dest < pos && dest > 0) await context.ui.animateMovement(pos, dest);
    context.state.setPosition(dest);
    context.ui.addHistory(
      `\u274C ${context.player.name} errou! Voltou para casa ${dest}`,
      'special'
    );
  }

  return { extraTurn: false, finished: false };
}

async function handleSkipTurn(event, context) {
  const count = event.params?.count ?? 1;
  const current = context.state.getSkippedTurns();
  context.state.setSkippedTurns(current + count);

  if (event.description) {
    context.ui.addHistory(event.description, 'special');
  } else {
    const label = count > 1 ? `${count} rodadas` : 'uma rodada';
    context.ui.addHistory(
      `\uD83D\uDE34 ${context.player.name} perdeu ${label}!`,
      'special'
    );
  }

  return { extraTurn: false, finished: false };
}

async function handleExtraTurn(event, context) {
  if (event.description) {
    context.ui.addHistory(event.description, 'special');
  } else {
    context.ui.addHistory(
      `\uD83C\uDFAF ${context.player.name} joga novamente!`,
      'special'
    );
  }
  return { extraTurn: true, finished: false };
}

async function handleResetPosition(event, context) {
  const target = typeof event.params?.target === 'number'
    ? Math.max(0, Math.min(event.params.target, context.world.totalCells))
    : 0;

  const pos = context.state.getPosition();

  if (event.description) {
    context.ui.addHistory(event.description, 'special');
  } else {
    context.ui.addHistory(
      `\uD83D\uDD19 ${context.player.name} voltou para o in\u00edcio!`,
      'special'
    );
  }

  if (pos !== target) {
    await context.ui.animateMovement(pos, target);
    context.state.setPosition(target);
  }

  return { extraTurn: false, finished: false };
}

async function handlePortal(event, context, worldConfig) {
  const portalId = event.params?.portalId;

  if (!portalId) {
    console.warn('[EventProcessor] portal event missing portalId');
    return { extraTurn: false, finished: false };
  }

  const portal = worldConfig?.portals?.find(p => p.id === portalId);
  if (!portal) {
    console.warn(`[EventProcessor] portal "${portalId}" not found in world config`);
    return { extraTurn: false, finished: false };
  }

  const entered = await context.decisions.resolvePortal(portalId);

  if (entered) {
    const pos = context.state.getPosition();
    context.callbacks.onPortalEntryPosition?.(context.player.id, pos);
    context.ui.addHistory(
      `\uD83C\uDF3F ${context.player.name} entrou em ${portal.name}!`,
      'special'
    );
    await context.callbacks.onWorldEnter(portal.targetWorldId);
  } else {
    context.ui.addHistory(
      `\u27A1\uFE0F ${context.player.name} seguiu no tabuleiro.`,
      'info'
    );
  }

  return { extraTurn: false, finished: false };
}

async function handleFinishWorld(event, context) {
  const pos = context.state.getPosition();
  const total = context.world.totalCells;

  if (event.description) {
    context.ui.addHistory(event.description, 'special');
  }

  if (pos !== total) {
    await context.ui.animateMovement(pos, total);
    context.state.setPosition(total);
  }

  await context.callbacks.onVictory();
  return { extraTurn: false, finished: true };
}

async function handleItem(event, context) {
  const itemId = event.params?.itemId ?? 'unknown';
  const count = event.params?.count ?? 1;

  context.callbacks.onCollectItem?.(itemId, count);

  if (event.description) {
    context.ui.addHistory(event.description, 'special');
  } else {
    context.ui.addHistory(
      `${context.player.name} recebeu ${count}x ${itemId}`,
      'info'
    );
  }

  return { extraTurn: false, finished: false };
}

const BUILTIN_HANDLERS = {
  move: handleMove,
  challenge: handleChallenge,
  skipTurn: handleSkipTurn,
  extraTurn: handleExtraTurn,
  resetPosition: handleResetPosition,
  portal: handlePortal,
  finishWorld: handleFinishWorld,
  item: handleItem,
};

// ── Core API ──

export async function processEvent(type, eventConfig, context, worldConfig) {
  const handler = resolveHandler(type, worldConfig);
  if (!handler) {
    console.warn(
      `[EventProcessor] No handler for event type "${type}" ` +
      `(world: ${worldConfig?.id || 'unknown'})`
    );
    return { extraTurn: false, finished: false };
  }
  return handler(eventConfig, context, worldConfig);
}

/**
 * Processa todos os eventos de uma célula, na ordem do array.
 * Após todos os eventos, se a posição do jogador mudou,
 * cascateia para a nova célula (com proteção contra loop via _cascadeSet).
 *
 * Nota: eventos de movimento (que mudam posição) devem vir por último
 * no array da célula para evitar comportamento inesperado com eventos
 * subsequentes operando na posição pós-movimento.
 */
export async function processEventsAtCell(cellNumber, worldConfig, context, _cascadeSet) {
  if (!worldConfig?.events) return { extraTurn: false, finished: false };

  const events = worldConfig.events[cellNumber];
  if (!events || !Array.isArray(events) || events.length === 0) {
    return { extraTurn: false, finished: false };
  }

  if (!_cascadeSet) _cascadeSet = new Set();
  if (_cascadeSet.has(cellNumber)) return { extraTurn: false, finished: false };
  _cascadeSet.add(cellNumber);

  const originalPos = context.state.getPosition();
  let extraTurn = false;

  for (const event of events) {
    if (event.condition) {
      const met = evaluateCondition(event.condition, context);
      if (!met) continue;
    }

    if (typeof event.probability === 'number') {
      if (Math.random() >= event.probability) continue;
    }

    const result = await processEvent(event.type, event, context, worldConfig);

    if (result.extraTurn) extraTurn = true;
    if (result.finished) {
      return { extraTurn, finished: true };
    }
  }

  const finalPos = context.state.getPosition();
  if (finalPos !== originalPos && finalPos >= 0 && finalPos <= context.world.totalCells) {
    const cascadeEvents = worldConfig.events[finalPos];
    if (cascadeEvents && cascadeEvents.length > 0 && !_cascadeSet.has(finalPos)) {
      return processEventsAtCell(finalPos, worldConfig, context, _cascadeSet);
    }
  }

  return { extraTurn, finished: false };
}

// ── Condition Evaluation ──

function evaluateCondition(condition, context) {
  if (!condition || !condition.type) return true;

  switch (condition.type) {
    case 'hasItem':
      return context.state.hasItem?.(condition.value) ?? false;

    case 'minPosition':
      return context.state.getPosition() >= (condition.value ?? 0);

    case 'maxPosition':
      return context.state.getPosition() <= (condition.value ?? Infinity);

    case 'isBot':
      return context.player.isBot === !!condition.value;

    case 'turnCount':
      return context.state.getTurnCount?.() === condition.value;

    case 'random':
      return Math.random() < (condition.value ?? 1);

    default:
      return true;
  }
}

// ── Utility ──

export function getBuiltinTypes() {
  return Object.keys(BUILTIN_HANDLERS);
}

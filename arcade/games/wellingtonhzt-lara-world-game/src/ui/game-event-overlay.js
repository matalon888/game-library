export const GAME_EVENT_DURATIONS = Object.freeze({
  dice: 1000,
  movement: 800,
  special: 1100,
  turn: 900,
  answer: 1200,
  minigame: 1100,
});

const VALID_TYPES = new Set([
  'dice', 'movement', 'bonus', 'penalty', 'challenge',
  'success', 'failure', 'minigame', 'turn', 'neutral',
]);

let root = null;
let iconEl = null;
let titleEl = null;
let messageEl = null;
let queue = [];
let active = null;
let generation = 0;
let onShow = null;

function settle(item, result) {
  if (item.settled) return;
  item.settled = true;
  item.resolve(result);
}

function wait(ms, itemGeneration) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(itemGeneration === generation), ms);
    if (active) active.timer = timer;
  });
}

async function processQueue() {
  if (active || !root) return;
  const item = queue.shift();
  if (!item) return;
  active = item;
  const itemGeneration = generation;
  const event = item.event;

  root.className = `game-event-overlay game-event-${event.type}`;
  iconEl.textContent = event.icon;
  titleEl.textContent = event.title;
  messageEl.textContent = event.message;
  messageEl.hidden = !event.message;
  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
  onShow?.(event);

  requestAnimationFrame(() => root?.classList.add('is-visible'));
  const stayedActive = await wait(event.duration, itemGeneration);
  if (!stayedActive || active !== item) return;
  root.classList.remove('is-visible');
  const completedExit = await wait(180, itemGeneration);
  if (!completedExit || active !== item) return;
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  active = null;
  settle(item, { cancelled: false });
  processQueue();
}

export function initGameEventOverlay(container, options = {}) {
  if (!container) throw new Error('initGameEventOverlay: container is required');
  clearGameEvents();
  onShow = typeof options.onShow === 'function' ? options.onShow : null;
  root = document.createElement('div');
  root.id = 'game-event-overlay';
  root.className = 'game-event-overlay game-event-neutral';
  root.hidden = true;
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'true');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <span class="game-event-icon" aria-hidden="true"></span>
    <span class="game-event-copy">
      <strong class="game-event-title"></strong>
      <span class="game-event-message"></span>
    </span>`;
  container.appendChild(root);
  iconEl = root.querySelector('.game-event-icon');
  titleEl = root.querySelector('.game-event-title');
  messageEl = root.querySelector('.game-event-message');
  return root;
}

export function queueGameEvent(event = {}) {
  const normalized = {
    icon: String(event.icon || '✨'),
    title: String(event.title || 'Aconteceu!'),
    message: event.message ? String(event.message) : '',
    type: VALID_TYPES.has(event.type) ? event.type : 'neutral',
    duration: Math.max(500, Number(event.duration) || GAME_EVENT_DURATIONS.special),
  };
  return new Promise(resolve => {
    queue.push({ event: normalized, resolve, settled: false, timer: null });
    processQueue();
  });
}

export function showGameEvent(event) {
  return queueGameEvent(event);
}

export function clearGameEvents() {
  generation++;
  if (active?.timer) clearTimeout(active.timer);
  if (active) settle(active, { cancelled: true });
  queue.forEach(item => settle(item, { cancelled: true }));
  queue = [];
  active = null;
  if (root) {
    root.classList.remove('is-visible');
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
  }
}

export function destroyGameEventOverlay() {
  clearGameEvents();
  root?.remove();
  root = iconEl = titleEl = messageEl = null;
  onShow = null;
}

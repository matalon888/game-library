import { getMinigameStats } from './arcade-stats.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CARD_METRICS = Object.freeze({
  'dino-runner': [
    ['pontuacao', '🏅', value => `${value} pts`],
    ['tempo', '⏱', value => formatSeconds(value)],
    ['obstaculosDesviados', '🪨', value => `${value} desviados`]
  ],
  'meteor-game': [
    ['pontuacao', '🏅', value => `${value} pts`],
    ['tempo', '⏱', value => formatSeconds(value)],
    ['meteorosDesviados', '☄️', value => `${value} desviados`]
  ],
  'ocean-match3': [
    ['pontuacao', '🏅', value => `${value} pts`],
    ['multiplicadorMax', '✨', value => `x${value} combo`],
    ['metasConcluidas', '🎯', value => `${value} metas`]
  ],
  'memory-forest': [
    ['pontuacao', '🏅', value => `${value} pts`],
    ['tempo', '⏱', value => `${formatSeconds(value)} restante`],
    ['paresEncontrados', '🧩', value => `${value} pares`]
  ],
  'ataque-dragoes': [
    ['pontuacao', '🏅', value => `${value} pts`],
    ['tempo', '⏱', value => formatSeconds(value)],
    ['acertos', '🐉', value => `${value} afastados`]
  ],
  'quiz-lara': [
    ['score', '🏅', value => `${value} pts`],
    ['accuracy', '🎯', value => `${value}% de acerto`],
    ['bestStreak', '🔥', value => `${value} de sequência`]
  ]
});

function formatSeconds(value) {
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function renderStatsHtml(mg, minigameId) {
  const partidas = Number.isFinite(mg?.partidas) ? Math.max(0, mg.partidas) : 0;
  const records = mg?.records && typeof mg.records === 'object' ? mg.records : {};
  const metrics = CARD_METRICS[minigameId] || [];
  const rendered = metrics.flatMap(([key, icon, formatter]) => {
    const value = records[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? [`<span class="arcade-stat">${icon} ${formatter(value)}</span>`]
      : [];
  });
  return [`<span class="arcade-stat">🎮 ${partidas} partidas</span>`, ...rendered].join('');
}

export function createMinigameCard(minigameId, config, onSelect) {
  const icon = escapeHtml(config.icon || '🎮');
  const iconAsset = typeof config.iconAsset === 'string' ? config.iconAsset : '';
  const name = escapeHtml(config.name || minigameId);
  const description = escapeHtml(config.description || '');
  const mg = getMinigameStats(minigameId);

  const card = document.createElement('button');
  card.className = 'arcade-card';
  card.setAttribute('data-minigame', minigameId);
  card.setAttribute('type', 'button');

  card.innerHTML = `
    <div class="arcade-card-icon" aria-hidden="true">
      <span class="arcade-card-icon-fallback">${icon}</span>
      ${iconAsset ? '<img class="arcade-card-icon-img" alt="" decoding="async">' : ''}
    </div>
    <div class="arcade-card-name">${name}</div>
    <div class="arcade-card-description">${description}</div>
    <div class="arcade-card-stats">${renderStatsHtml(mg, minigameId)}</div>
  `;

  const iconContainer = card.querySelector('.arcade-card-icon');
  const iconImage = card.querySelector('.arcade-card-icon-img');
  if (iconContainer && iconImage && iconAsset) {
    iconImage.addEventListener('load', () => {
      iconContainer.classList.add('asset-loaded');
    });
    iconImage.addEventListener('error', () => {
      iconContainer.classList.remove('asset-loaded');
      iconImage.removeAttribute('src');
    });
    iconImage.src = iconAsset;
  }

  card.addEventListener('click', () => {
    if (typeof onSelect === 'function') onSelect(minigameId, config);
  });

  return card;
}

export function updateCardStats(card, minigameId) {
  const mg = getMinigameStats(minigameId);
  const statsEl = card.querySelector('.arcade-card-stats');
  if (!statsEl) return;
  statsEl.innerHTML = renderStatsHtml(mg, minigameId);
}

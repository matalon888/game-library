import { listMinigames, getMinigame } from '../minigames/engine/index.js';
import { createMinigameCard, updateCardStats } from './arcade-card.js';

let _screenEl = null;
let _cardsContainer = null;
let _errorEl = null;
let _cards = [];

export function initArcadeScreen(onSelect) {
  _screenEl = document.getElementById('arcade-screen');
  _cardsContainer = document.getElementById('arcade-cards');
  _errorEl = document.getElementById('arcade-error');
  if (!_screenEl || !_cardsContainer) return;
  _cardsContainer.innerHTML = '';
  _cards = [];

  const ids = listMinigames();
  for (const id of ids) {
    const config = getMinigame(id);
    const card = createMinigameCard(id, config, onSelect);
    _cards.push({ id, card });
    _cardsContainer.appendChild(card);
  }
}

export function showArcadeScreen() {
  if (_screenEl) _screenEl.classList.remove('hidden');
  hideError();
}

export function hideArcadeScreen() {
  if (_screenEl) _screenEl.classList.add('hidden');
}

export function setCardsEnabled(enabled) {
  if (!_cardsContainer) return;
  if (enabled) {
    _cardsContainer.classList.remove('arcade-cards-disabled');
  } else {
    _cardsContainer.classList.add('arcade-cards-disabled');
  }
}

export function showError(message) {
  if (!_errorEl) return;
  _errorEl.textContent = message || 'Ocorreu um erro ao abrir o minigame.';
  _errorEl.classList.remove('hidden');
}

export function hideError() {
  if (_errorEl) _errorEl.classList.add('hidden');
}

export function refreshArcadeCards() {
  for (const { id, card } of _cards) {
    updateCardStats(card, id);
  }
}

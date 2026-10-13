import { launchMinigameHost } from '../minigames/engine/index.js';
import { recordGame, getMinigameStats } from './arcade-stats.js';
import { showArcadeScreen, hideArcadeScreen, setCardsEnabled, showError, hideError, refreshArcadeCards } from './arcade-screen.js';
import { musicDirector, MUSIC_CONTEXTS } from '../audio/music-context.js';

let _isRunning = false;
let _onExit = null;

export function initArcadeController(onExit) {
  _onExit = onExit;
}

export function enterArcadeMode() {
  _isRunning = false;
  setCardsEnabled(true);
  hideError();
  refreshArcadeCards();
  showArcadeScreen();
  musicDirector.setContext(MUSIC_CONTEXTS.ARCADE);
}

export function leaveArcadeMode() {
  hideArcadeScreen();
  setCardsEnabled(true);
  hideError();
  _isRunning = false;
}

export function resetArcadeTransientState() {
  _isRunning = false;
  setCardsEnabled(true);
  hideError();
}

export function isArcadeGameRunning() {
  return _isRunning;
}

export async function launchArcadeMinigame(minigameId) {
  if (_isRunning) return null;
  _isRunning = true;
  setCardsEnabled(false);
  hideError();
  musicDirector.pauseForMinigame();

  try {
    hideArcadeScreen();
    const startTime = performance.now();
    const result = await launchMinigameHost(minigameId, {
      isBot: false,
      playerName: 'Jogador',
      context: 'arcade',
      getStats: () => getMinigameStats(minigameId),
    });
    const durationMs = performance.now() - startTime;
    try {
      recordGame(minigameId, result, durationMs);
    } catch (statsErr) {
      console.error('[Arcade] Erro ao registrar estatísticas:', statsErr);
    }
    return result;
  } catch (err) {
    console.error('[Arcade] Erro ao abrir minigame:', minigameId, err);
    showError('Não foi possível abrir este minigame. Tente novamente.');
    return null;
  } finally {
    _isRunning = false;
    setCardsEnabled(true);
    refreshArcadeCards();
    showArcadeScreen();
    musicDirector.restoreAfterMinigame(MUSIC_CONTEXTS.ARCADE);
  }
}

export function exitArcadeToMenu() {
  leaveArcadeMode();
  if (typeof _onExit === 'function') _onExit();
}

import { audioManager } from './index.js';

export const MUSIC_CONTEXTS = Object.freeze({
  MENU: 'menu',
  ARCADE: 'arcade',
  BOARD: 'board',
  PAUSED_MINIGAME: 'paused-minigame',
  SILENT: 'silent',
});

export const MUSIC_KEY_BY_CONTEXT = Object.freeze({
  [MUSIC_CONTEXTS.MENU]: 'menuMusic',
  [MUSIC_CONTEXTS.ARCADE]: 'arcadeMusic',
  [MUSIC_CONTEXTS.BOARD]: 'backgroundMusic',
});

const VALID_CONTEXTS = new Set(Object.values(MUSIC_CONTEXTS));

export class MusicDirector {
  constructor(audio = audioManager) {
    this._audio = audio;
    this._context = MUSIC_CONTEXTS.SILENT;
    this._resumeContext = null;
  }

  getContext() {
    return this._context;
  }

  setContext(context) {
    if (!VALID_CONTEXTS.has(context)) {
      throw new Error(`Unknown music context: ${context}`);
    }
    if (this._context === context) return Promise.resolve();
    this._context = context;
    if (context !== MUSIC_CONTEXTS.PAUSED_MINIGAME) this._resumeContext = null;
    return this._applyCurrentContext();
  }

  syncCurrentContext() {
    return this._applyCurrentContext();
  }

  async unlock() {
    const unlocked = await this._audio.unlock();
    if (unlocked) await this._applyCurrentContext();
    return unlocked;
  }

  preload(context) {
    const soundKey = MUSIC_KEY_BY_CONTEXT[context];
    if (!soundKey || !this._audio.isSoundAvailable(soundKey)) return Promise.resolve();
    return this._audio.preloadMusic(soundKey);
  }

  pauseForMinigame() {
    if (this._context === MUSIC_CONTEXTS.PAUSED_MINIGAME) return;
    this._resumeContext = MUSIC_KEY_BY_CONTEXT[this._context] ? this._context : null;
    this._context = MUSIC_CONTEXTS.PAUSED_MINIGAME;
    this._audio.pauseMusic();
  }

  restoreAfterMinigame(fallbackContext = MUSIC_CONTEXTS.SILENT) {
    const targetContext = this._resumeContext || fallbackContext;
    this._resumeContext = null;
    return this.setContext(targetContext);
  }

  _applyCurrentContext() {
    if (this._context === MUSIC_CONTEXTS.PAUSED_MINIGAME) {
      this._audio.pauseMusic();
      return Promise.resolve();
    }

    const soundKey = MUSIC_KEY_BY_CONTEXT[this._context];
    if (!soundKey || !this._audio.isSoundAvailable(soundKey)) {
      this._audio.stopMusic();
      return Promise.resolve();
    }

    if (!this._audio.isUnlocked()) return Promise.resolve();
    return this._audio.playMusic(soundKey);
  }
}

export const musicDirector = new MusicDirector();

import { SOUNDS } from './sounds.js';
import { getCacheBust } from '../version.js';

const STORAGE_KEY = 'laraAudioConfig';
const MUSIC_OUTPUT_SCALE = 0.4;

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._initialized = false;
    this._unlocked = false;
    this._sounds = {};
    this._bufferCache = new Map();
    this._pendingBufferLoads = new Map();
    this._activeEffects = {};
    this._musicSource = null;
    this._musicBuffer = null;
    this._musicKey = null;
    this._musicOffset = 0;
    this._musicStartedAt = 0;
    this._musicPaused = false;
    this._musicRequestId = 0;
    this._musicGain = null;
    this._masterGain = null;
    this._effectsGain = null;
    this._loadSettings();
  }

  /* ────────────── Public API ────────────── */

  init() {
    if (this._initialized) return;
    this._registerSounds();
    this._initialized = true;
  }

  async play(soundKey) {
    if (!this._initialized) return;
    if (this.muted) return;
    const entry = this._sounds[soundKey];
    if (!entry || !entry.path) return;
    if (entry.available === false) return;
    if (entry.category !== 'effects') return;
    try {
      await this._ensureCtx();
      const buffer = await this._decode(entry.path);
      const source = this._ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this._effectsGain);
      source.start(0);
      this._activeEffects[soundKey] = source;
      source.onended = () => { delete this._activeEffects[soundKey]; };
    } catch (error) {
      this._reportPlaybackFailure('effect', soundKey, error);
    }
  }

  stop(soundKey) {
    const source = this._activeEffects[soundKey];
    if (source) {
      try { source.stop(); } catch { /* already stopped */ }
      delete this._activeEffects[soundKey];
    }
  }

  async playMusic(soundKey) {
    if (!this._initialized) return;
    if (this.muted) return;
    const entry = this._sounds[soundKey];
    if (!entry || !entry.path) return;
    if (entry.available === false) return;
    if (entry.category !== 'music') return;

    try {
      await this._ensureCtx();
    } catch (error) {
      this._reportPlaybackFailure('music-context', soundKey, error);
      return;
    }

    // A mesma source volta a produzir áudio assim que um contexto suspenso é
    // retomado. Não encerre antes de recuperar o AudioContext.
    if (this._musicKey === soundKey && this._musicSource) return;
    if (this._musicKey === soundKey && this._musicPaused) {
      return this.resumeMusic();
    }

    this.stopMusic();
    this._musicKey = soundKey;
    this._musicOffset = 0;
    this._musicPaused = false;
    return this._loadAndStartMusic(soundKey, entry.path, 0);
  }

  async preloadMusic(soundKey) {
    if (!this._initialized) return;
    const entry = this._sounds[soundKey];
    if (!entry || !entry.path || entry.category !== 'music' || entry.available === false) return;
    try {
      await this._ensureCtx();
      await this._decode(entry.path);
    } catch (error) {
      this._reportPlaybackFailure('music-preload', soundKey, error);
    }
  }

  pauseMusic() {
    if (!this._musicKey) return;
    this._musicRequestId++;
    if (this._musicSource && this._musicBuffer?.duration) {
      const elapsed = Math.max(0, this._ctx.currentTime - this._musicStartedAt);
      this._musicOffset = elapsed % this._musicBuffer.duration;
      this._disposeMusicSource();
    }
    this._musicPaused = true;
  }

  async resumeMusic() {
    if (this.muted || !this._musicKey || this._musicSource) return;
    const entry = this._sounds[this._musicKey];
    if (!entry || !entry.path || entry.category !== 'music') return;
    this._musicPaused = false;
    return this._loadAndStartMusic(this._musicKey, entry.path, this._musicOffset);
  }

  async _loadAndStartMusic(soundKey, path, offset) {
    const requestId = ++this._musicRequestId;
    try {
      await this._ensureCtx();
      const buffer = await this._decode(path);
      if (requestId !== this._musicRequestId || this._musicKey !== soundKey) return;
      this._musicBuffer = buffer;
      if (this.muted || this._musicPaused) {
        this._musicPaused = true;
        return;
      }
      this._startMusicSource(offset);
    } catch (error) {
      this._reportPlaybackFailure('music', soundKey, error);
    }
  }

  stopMusic() {
    this._musicRequestId++;
    this._disposeMusicSource();
    this._musicBuffer = null;
    this._musicKey = null;
    this._musicOffset = 0;
    this._musicStartedAt = 0;
    this._musicPaused = false;
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this._masterGain) this._masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this._save();
  }

  get masterVolume() {
    return this._masterVol;
  }

  set masterVolume(v) { this._masterVol = v; }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this._musicGain) this._musicGain.gain.value = this.musicVolume * MUSIC_OUTPUT_SCALE;
    this._save();
  }

  get musicVolume() {
    return this._musicVol;
  }

  set musicVolume(v) { this._musicVol = v; }

  setEffectsVolume(value) {
    this.effectsVolume = Math.max(0, Math.min(1, value));
    if (this._effectsGain) this._effectsGain.gain.value = this.effectsVolume;
    this._save();
  }

  get effectsVolume() {
    return this._effectsVol;
  }

  set effectsVolume(v) { this._effectsVol = v; }

  mute() {
    this.muted = true;
    if (this._masterGain) this._masterGain.gain.value = 0;
    this._save();
  }

  unmute() {
    this.muted = false;
    if (this._masterGain) this._masterGain.gain.value = this.masterVolume;
    this._save();
  }

  toggleMute() {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  isSoundAvailable(soundKey) {
    const entry = this._sounds[soundKey];
    return !!(entry && entry.path && entry.available !== false);
  }

  isUnlocked() {
    return this._unlocked;
  }

  async unlock() {
    if (!this._initialized) return false;
    try {
      await this._ensureCtx();
      return true;
    } catch (error) {
      this._reportPlaybackFailure('unlock', 'audio-context', error);
      return false;
    }
  }

  /* ────────────── Internal ────────────── */

  _startMusicSource(offset = 0) {
    if (!this._ctx || !this._musicBuffer || this._musicSource) return;
    const duration = this._musicBuffer.duration;
    const safeOffset = duration > 0 ? Math.max(0, offset) % duration : 0;
    const source = this._ctx.createBufferSource();
    source.buffer = this._musicBuffer;
    source.loop = true;
    source.connect(this._musicGain);
    source.start(0, safeOffset);
    this._musicSource = source;
    this._musicOffset = safeOffset;
    this._musicStartedAt = this._ctx.currentTime - safeOffset;
    this._musicPaused = false;
  }

  _disposeMusicSource() {
    if (!this._musicSource) return;
    try { this._musicSource.stop(); } catch { /* already stopped */ }
    try { this._musicSource.disconnect(); } catch { /* already disconnected */ }
    this._musicSource = null;
  }

  _registerSounds() {
    for (const [key, cfg] of Object.entries(SOUNDS)) {
      this._sounds[key] = {
        path: cfg.path || '',
        category: cfg.category || 'effects',
        available: cfg.available !== false,
      };
    }
  }

  async _ensureCtx() {
    if (this._ctx && this._ctx.state !== 'closed') {
      if (this._ctx.state === 'suspended' || this._ctx.state === 'interrupted') {
        await this._ctx.resume();
      }
      if (this._ctx.state !== 'running') {
        throw new Error(`AudioContext unavailable: ${this._ctx.state}`);
      }
      this._unlocked = true;
      return this._ctx;
    }
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this.muted ? 0 : this._masterVol;
    this._masterGain.connect(this._ctx.destination);

    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = this._musicVol * MUSIC_OUTPUT_SCALE;
    this._musicGain.connect(this._masterGain);

    this._effectsGain = this._ctx.createGain();
    this._effectsGain.gain.value = this._effectsVol;
    this._effectsGain.connect(this._masterGain);

    if (this._ctx.state === 'suspended' || this._ctx.state === 'interrupted') {
      await this._ctx.resume();
    }
    if (this._ctx.state !== 'running') {
      throw new Error(`AudioContext unavailable: ${this._ctx.state}`);
    }
    this._unlocked = true;
    return this._ctx;
  }

  _reportPlaybackFailure(operation, soundKey, error) {
    console.warn(`[AudioManager] ${operation} failed for "${soundKey}"`, error);
  }

  async _decode(path) {
    const separator = path.includes('?') ? '&' : '?';
    const versionedPath = `${path}${separator}${getCacheBust()}`;

    if (this._bufferCache.has(versionedPath)) {
      return this._bufferCache.get(versionedPath);
    }

    if (this._pendingBufferLoads.has(versionedPath)) {
      return this._pendingBufferLoads.get(versionedPath);
    }

    const loadPromise = (async () => {
      const response = await fetch(versionedPath);
      if (!response.ok) throw new Error(`Audio not found: ${path}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await this._ctx.decodeAudioData(arrayBuffer);
      this._bufferCache.set(versionedPath, buffer);
      return buffer;
    })();

    this._pendingBufferLoads.set(versionedPath, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this._pendingBufferLoads.delete(versionedPath);
    }
  }

  /* ── Settings persistence ── */

  _loadSettings() {
    this._masterVol = 1.0;
    this._musicVol = 0.3;
    this._effectsVol = 0.8;
    this.muted = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.masterVolume === 'number') this._masterVol = data.masterVolume;
        if (typeof data.musicVolume === 'number') this._musicVol = data.musicVolume;
        if (typeof data.effectsVolume === 'number') this._effectsVol = data.effectsVolume;
        if (typeof data.muted === 'boolean') this.muted = data.muted;
      }
    } catch {
      /* ignore corrupt localStorage */
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        masterVolume: this._masterVol,
        musicVolume: this._musicVol,
        effectsVolume: this._effectsVol,
        muted: this.muted,
      }));
    } catch {
      /* localStorage full or unavailable */
    }
  }
}

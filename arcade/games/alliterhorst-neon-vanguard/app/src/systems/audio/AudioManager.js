// AudioManager: synth sfxr-style + reprodução com pooling leve. Dono: sound-designer.
// Usa Web Audio direto (independente do Phaser). Resume no primeiro gesto do usuário.
import { SFX_DEFS } from './sfx-defs.js';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = {};
    this.muted = false;
    this.ready = false;
  }

  /** cria contexto e pré-renderiza todos os SFX. Chamar após um gesto do usuário. */
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    for (const [name, def] of Object.entries(SFX_DEFS)) {
      this.buffers[name] = this._render(def);
    }
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** renderiza um SFX para AudioBuffer a partir dos parâmetros */
  _render(def) {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * def.dur));
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;                       // 0..1
      const f = def.f0 + (def.f1 - def.f0) * t; // varredura de frequência
      const vib = def.vibDepth ? Math.sin(2 * Math.PI * (def.vibRate || 8) * (i / sr)) * def.vibDepth : 0;
      phase += (2 * Math.PI * (f + vib)) / sr;
      let s;
      switch (def.type) {
        case 'noise': s = Math.random() * 2 - 1; break;
        case 'saw':   s = (phase / Math.PI % 2) - 1; break;
        case 'sine':  s = Math.sin(phase); break;
        case 'square':
        default:      s = Math.sin(phase) >= 0 ? 1 : -1; break;
      }
      // envelope ataque/decaimento
      const env = Math.min(1, (def.dur * t) / (def.attack || 0.001)) * (1 - t);
      data[i] = s * env * (def.vol ?? 0.3);
    }
    return buf;
  }

  play(name) {
    if (!this.ready || this.muted) return;
    const buf = this.buffers[name];
    if (!buf) return;
    this.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.master);
    src.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
    return this.muted;
  }
}

export const audio = new AudioManager();
export default audio;

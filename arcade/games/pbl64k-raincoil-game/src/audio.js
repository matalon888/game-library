// Original synthesized score and effects. No samples or external assets.
export class Sound {
  constructor() { this.ctx = null; this.music = .35; this.sfx = .65; this.active = false; this.beat = 0; this.next = 0; this.intensity = 0; }
  unlock() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.bus = this.ctx.createGain(); this.bus.gain.value = .6;
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -14; compressor.ratio.value = 5;
        this.bus.connect(compressor); compressor.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.bus);
        this.fxBus = this.ctx.createGain(); this.fxBus.connect(this.bus);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * .2, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      this.ctx.resume(); this.volumes();
    } catch (_) { /* Silent play remains fully functional. */ }
  }
  volumes() { if (this.ctx) { this.musicBus.gain.setTargetAtTime(this.music, this.ctx.currentTime, .04); this.fxBus.gain.setTargetAtTime(this.sfx, this.ctx.currentTime, .04); } }
  tone(freq, end, duration, volume, type = 'sine', at = 0, music = false) {
    if (!this.ctx) return; const t = at || this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(); osc.type = type;
    osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    gain.gain.setValueAtTime(.001, t); gain.gain.exponentialRampToValueAtTime(Math.max(.002, volume), t + .008); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(gain); gain.connect(music ? this.musicBus : this.fxBus); osc.start(t); osc.stop(t + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  hiss(volume, duration, at = 0) {
    if (!this.ctx) return; const t = at || this.ctx.currentTime, src = this.ctx.createBufferSource(), gain = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    src.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
    src.connect(f); f.connect(gain); gain.connect(this.musicBus); src.start(t); src.stop(t + duration);
    src.onended = () => { src.disconnect(); f.disconnect(); gain.disconnect(); };
  }
  event(type, color = 0, combo = 1) {
    const f = [261.63, 329.63, 392][Math.max(0, color) % 3];
    if (type === 'catch') { this.tone(f * 2, f * 2.015, .16, .16, 'sine'); this.tone(f * 4, f * 2, .06, .04); }
    if (type === 'clear') for (let i = 0; i < 4; i++) this.tone(f * [1, 1.25, 1.5, 2][i] * (1 + Math.min(combo, 5) * .04), f * [1, 1.25, 1.5, 2][i], .35, .12, 'triangle', (this.ctx?.currentTime || 0) + i * .045);
    if (type === 'shed') { this.tone(200, 55, .32, .3, 'sawtooth'); this.tone(800, 1200, .2, .06); }
    if (type === 'hit') { this.tone(130, 35, .35, .3, 'sawtooth'); this.tone(71, 30, .45, .24); }
    if (type === 'miss') this.tone(75, 40, .07, .06, 'triangle');
    if (type === 'start') [261.63, 392, 523.25].forEach((n, i) => this.tone(n, n, .22, .13, 'triangle', (this.ctx?.currentTime || 0) + i * .08));
    if (type === 'win') [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, n, .6, .16, 'triangle', (this.ctx?.currentTime || 0) + i * .12));
    if (type === 'lose') [196, 164.81, 130.81].forEach((n, i) => this.tone(n, n * .98, .5, .16, 'triangle', (this.ctx?.currentTime || 0) + i * .18));
  }
  tick() {
    if (!this.ctx) return;
    if (!this.active) { this.next = this.ctx.currentTime + .05; return; }
    if (this.next < this.ctx.currentTime - .3) this.next = this.ctx.currentTime;
    const notes = [130.81, 130.81, 155.56, 116.54, 103.83, 103.83, 116.54, 155.56];
    while (this.next < this.ctx.currentTime + .09) {
      const n = this.beat, t = this.next, base = notes[Math.floor(n / 8) % notes.length];
      if (n % 4 === 0) this.tone(115, 42, .22, .4, 'sine', t, true);
      if (n % 4 === 2) { this.hiss(.10, .06, t); this.tone(160, 75, .09, .1, 'triangle', t, true); }
      if (n % 2 === 0 || this.intensity > .65) this.hiss(n % 2 ? .025 : .045, .025, t);
      if (n % 2 === 0) this.tone(base / 2, base / 2, .23, .19, 'triangle', t, true);
      const melody = [2, 0, 3, 0, 2.5, 0, 3, 4];
      if (melody[n % 8] && (n % 4 === 0 || this.intensity > .25)) this.tone(base * melody[n % 8], base * melody[n % 8], .23, .055, 'sine', t, true);
      this.beat++; this.next += 60 / 112 / 4;
    }
  }
}

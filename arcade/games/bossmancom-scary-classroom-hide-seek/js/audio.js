/**
 * Lightweight procedural audio via Web Audio API — no external assets.
 */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humGain = null;
    this.humOsc = null;
    this.breathGain = null;
    this.enabled = false;
    this._stepTimer = 0;
  }

  async init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    // Fluorescent hum
    this.humOsc = this.ctx.createOscillator();
    this.humOsc.type = 'sine';
    this.humOsc.frequency.value = 60;
    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 200;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.04;
    this.humOsc.connect(humFilter);
    humFilter.connect(this.humGain);
    this.humGain.connect(this.master);
    this.humOsc.start();

    // Distant breathing (filtered noise loop)
    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.value = 0;
    this.breathGain.connect(this.master);
    this._startBreathLoop();

    this.enabled = true;
    // Never hang start on resume — race with timeout
    if (this.ctx.state === 'suspended') {
      await Promise.race([
        this.ctx.resume(),
        new Promise((r) => setTimeout(r, 400)),
      ]);
    }
  }

  async resume() {
    if (!this.ctx || this.ctx.state !== 'suspended') return;
    await Promise.race([
      this.ctx.resume(),
      new Promise((r) => setTimeout(r, 400)),
    ]);
  }

  _noiseBuffer(duration = 1) {
    const len = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startBreathLoop() {
    const playBreath = () => {
      if (!this.enabled || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer(1.8);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 280;
      filter.Q.value = 0.7;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.5);
      g.gain.linearRampToValueAtTime(0.01, t + 1.0);
      g.gain.linearRampToValueAtTime(0.04, t + 1.4);
      g.gain.linearRampToValueAtTime(0, t + 1.8);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.breathGain);
      src.start();
      src.stop(t + 1.9);
      setTimeout(playBreath, 2800 + Math.random() * 2000);
    };
    playBreath();
  }

  setBreathProximity(amount) {
    if (!this.breathGain) return;
    // amount 0..1 — louder when seeker is near
    this.breathGain.gain.setTargetAtTime(
      Math.min(1, amount) * 0.9,
      this.ctx.currentTime,
      0.15
    );
  }

  setHumFlicker(intensity) {
    if (!this.humGain) return;
    const base = 0.04;
    this.humGain.gain.setTargetAtTime(
      base + intensity * 0.06,
      this.ctx.currentTime,
      0.05
    );
  }

  footstep(isSprint = false, isCrouch = false) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isCrouch ? 280 : isSprint ? 900 : 550;
    const g = this.ctx.createGain();
    const vol = isCrouch ? 0.04 : isSprint ? 0.14 : 0.08;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.08);
  }

  lockerCreak() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.45);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  /** Dissonant found sting */
  foundSting() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const freqs = [55, 58, 82, 110, 165];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 1.4, t + 0.3);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 1.25);
    });
    // Noise hit
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  winChime() {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    [220, 277, 330].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.12);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.12 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + i * 0.12);
      osc.stop(t + 1.3);
    });
  }

  updateFootsteps(dt, moving, isSprint, isCrouch) {
    if (!moving) {
      this._stepTimer = 0;
      return;
    }
    const interval = isCrouch ? 0.55 : isSprint ? 0.28 : 0.42;
    this._stepTimer -= dt;
    if (this._stepTimer <= 0) {
      this.footstep(isSprint, isCrouch);
      this._stepTimer = interval;
    }
  }
}

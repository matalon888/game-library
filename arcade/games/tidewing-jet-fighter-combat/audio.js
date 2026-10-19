// Tidewing audio: everything synthesised with WebAudio (engine, wind, cannon, missiles, explosions, lock tones,
// missile alert, and an adaptive 4-layer combat score composed in code). No sample files.
export class Sound {
  constructor() { this.ctx = null; this.intensity = 0; this.on = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    let ctx; try { ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.85; this.master.connect(comp);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.gain.value = 0.3; this.mus.connect(this.master);
    // a short convolution-ish echo for space (feedback delay)
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.28; const lp = ctx.createBiquadFilter(); lp.frequency.value = 2200;
    dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.master); this.echo = ctx.createGain(); this.echo.gain.value = 0.35; this.echo.connect(dl);
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    // brown noise for rumbles
    const bb = ctx.createBuffer(1, len, ctx.sampleRate), bd = bb.getChannelData(0); let l = 0;
    for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = l * 3.5; }
    this.brown = bb;
    const loopSrc = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    // engine: turbine whine + brown roar + afterburner
    this.engRoar = ctx.createBiquadFilter(); this.engRoar.type = 'lowpass'; this.engRoar.frequency.value = 500;
    this.engRoarG = ctx.createGain(); this.engRoarG.gain.value = 0; loopSrc(this.brown).connect(this.engRoar); this.engRoar.connect(this.engRoarG); this.engRoarG.connect(this.sfx);
    this.whine = ctx.createOscillator(); this.whine.type = 'sawtooth'; this.whine.frequency.value = 900; const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 2400; wf.Q.value = 6;
    this.whineG = ctx.createGain(); this.whineG.gain.value = 0; this.whine.connect(wf); wf.connect(this.whineG); this.whineG.connect(this.sfx); this.whine.start();
    this.ab = ctx.createBiquadFilter(); this.ab.type = 'lowpass'; this.ab.frequency.value = 900; this.abG = ctx.createGain(); this.abG.gain.value = 0;
    loopSrc(this.noise).connect(this.ab); this.ab.connect(this.abG); this.abG.connect(this.sfx);
    this.wind = ctx.createBiquadFilter(); this.wind.type = 'bandpass'; this.wind.frequency.value = 800; this.wind.Q.value = 0.7; this.windG = ctx.createGain(); this.windG.gain.value = 0;
    loopSrc(this.noise).connect(this.wind); this.wind.connect(this.windG); this.windG.connect(this.sfx);
    // tones (lock / alert)
    this.toneO = ctx.createOscillator(); this.toneO.type = 'square'; this.toneO.frequency.value = 1000; this.toneG = ctx.createGain(); this.toneG.gain.value = 0;
    const tf = ctx.createBiquadFilter(); tf.frequency.value = 3000; this.toneO.connect(tf); tf.connect(this.toneG); this.toneG.connect(this.master); this.toneO.start();
    this.alertO = ctx.createOscillator(); this.alertO.type = 'square'; this.alertO.frequency.value = 1500; this.alertG = ctx.createGain(); this.alertG.gain.value = 0;
    this.alertO.connect(this.alertG); this.alertG.connect(this.master); this.alertO.start();
    this.tt = 0; this.lastGun = 0; this.step = 0; this.nextT = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  nz(t, dur, { type = 'lowpass', f = 1000, f2 = null, q = 1, vol = 0.3, a = 0.002, bus = this.sfx, brown = false, rate = 1 } = {}) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = brown ? this.brown : this.noise; s.playbackRate.value = rate;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); this.env(g, t, a, vol, dur); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05); return g;
  }
  osc(t, dur, { type = 'sine', f = 100, f2 = null, vol = 0.3, a = 0.003, bus = this.sfx } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); this.env(g, t, a, vol, dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.05); return g;
  }
  engine(throttle, speed, boost, g, cockpit) {
    if (!this.ctx) return; const t = this.t, k = 0.08;
    this.engRoarG.gain.setTargetAtTime((0.22 + throttle * 0.25) * (cockpit ? 0.7 : 1), t, k);
    this.engRoar.frequency.setTargetAtTime(260 + throttle * 500 + boost * 400, t, k);
    this.whine.frequency.setTargetAtTime(700 + throttle * 900, t, k); this.whineG.gain.setTargetAtTime(cockpit ? 0.006 : 0.012 + throttle * 0.01, t, k);
    this.abG.gain.setTargetAtTime(boost * 0.16, t, 0.15); this.ab.frequency.setTargetAtTime(500 + boost * 700, t, k);
    this.windG.gain.setTargetAtTime(Math.min(0.2, speed / 2400 + Math.max(0, g - 4) * 0.025), t, k); this.wind.frequency.setTargetAtTime(500 + speed * 2.5, t, k);
  }
  gun() {
    if (!this.ctx) return; const t = this.t; if (t - this.lastGun < 0.045) return; this.lastGun = t;
    this.nz(t, 0.05, { type: 'bandpass', f: 1400, q: 0.8, vol: 0.22 }); this.osc(t, 0.06, { type: 'square', f: 140, f2: 60, vol: 0.14 }); this.nz(t, 0.18, { f: 400, vol: 0.08, brown: true });
  }
  enemyGun(vol = 0.5) { if (!this.ctx) return; const t = this.t; this.nz(t, 0.06, { type: 'bandpass', f: 900, vol: 0.12 * vol }); }
  missile() {
    if (!this.ctx) return; const t = this.t;
    this.nz(t, 0.25, { type: 'highpass', f: 2000, vol: 0.15 }); this.osc(t, 0.12, { type: 'square', f: 90, f2: 45, vol: 0.2 });
    const g = this.nz(t + 0.05, 1.4, { type: 'bandpass', f: 300, f2: 2600, q: 1.2, vol: 0.35, a: 0.05 }); g.connect(this.echo);
  }
  boom(dist = 300, big = 1) {
    if (!this.ctx) return; const t = this.t, v = Math.min(1, 700 / (dist + 200)) * Math.min(1.6, big);
    if (v < 0.04) return; const dly = Math.min(0.6, dist / 1500);
    this.nz(t + dly, 1.6 * big, { f: 900, f2: 90, vol: 0.55 * v, brown: true, a: 0.005 }).connect(this.echo);
    this.osc(t + dly, 0.7 * big, { f: 70, f2: 26, vol: 0.6 * v });
    this.nz(t + dly, 0.5, { type: 'highpass', f: 2500, vol: 0.12 * v });
    for (let i = 0; i < 4; i++) this.nz(t + dly + 0.1 + Math.random() * 0.6 * big, 0.08, { type: 'bandpass', f: 1500 + Math.random() * 2000, vol: 0.08 * v });
  }
  hit() { if (!this.ctx) return; const t = this.t; this.osc(t, 0.12, { type: 'square', f: 320, f2: 110, vol: 0.18 }); this.nz(t, 0.15, { type: 'bandpass', f: 2500, vol: 0.2 }); }
  thud() { if (!this.ctx) return; const t = this.t; this.osc(t, 0.3, { f: 90, f2: 40, vol: 0.5 }); this.nz(t, 0.4, { f: 600, f2: 100, vol: 0.4, brown: true }); this.nz(t, 0.2, { type: 'bandpass', f: 3000, vol: 0.2 }); }
  ding() { if (!this.ctx) return; const t = this.t; this.osc(t, 0.12, { type: 'triangle', f: 1760, vol: 0.12 }); this.osc(t + 0.06, 0.2, { type: 'triangle', f: 2349, vol: 0.1 }); }
  flare() { if (!this.ctx) return; const t = this.t; for (let i = 0; i < 3; i++) { this.nz(t + i * 0.18, 0.12, { type: 'bandpass', f: 1800, vol: 0.25 }); this.osc(t + i * 0.18, 0.05, { type: 'square', f: 300, f2: 120, vol: 0.1 }); } }
  thunder() { if (!this.ctx) return; const t = this.t + 0.3 + Math.random() * 0.8; this.nz(t, 3.5, { f: 300, f2: 60, vol: 0.5, brown: true, a: 0.1 }).connect(this.echo); }
  ui(f = 880) { if (!this.ctx) return; this.osc(this.t, 0.08, { type: 'triangle', f, vol: 0.12 }); }
  fanfare() { if (!this.ctx) return; const t = this.t; [62, 69, 74, 78, 81].forEach((m, i) => this.osc(t + i * 0.13, 0.9 - i * 0.1, { type: 'sawtooth', f: mf(m), vol: 0.09, bus: this.mus })); }
  // lock tones: 0 none, 1 seeking (beeps), 2 locked (steady); alert: missile incoming (fast beeps)
  tones(dt, lock, alert) {
    if (!this.ctx) return; this.tt += dt; const t = this.t;
    let tv = 0; if (lock === 2) { tv = 0.05; this.toneO.frequency.setTargetAtTime(1650, t, 0.01); } else if (lock === 1) { tv = (this.tt * 6.5 % 1) < 0.45 ? 0.04 : 0; this.toneO.frequency.setTargetAtTime(1050, t, 0.01); }
    this.toneG.gain.setTargetAtTime(tv, t, 0.008);
    const av = alert ? ((this.tt * (alert > 1 ? 9 : 4.5)) % 1 < 0.5 ? 0.06 : 0) : 0; this.alertO.frequency.setTargetAtTime(alert > 1 ? 1900 : 1400, t, 0.01); this.alertG.gain.setTargetAtTime(av, t, 0.006);
  }
  silence() { if (!this.ctx) return; const t = this.t; for (const g of [this.toneG, this.alertG, this.abG, this.whineG]) g.gain.setTargetAtTime(0, t, 0.05); }
  // ---------------------------------------------------------------- adaptive score, D minor, 124 bpm
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const spb = 60 / 124 / 4;
    while (this.nextT < c.currentTime + 0.15) { this.playStep(this.step, this.nextT, spb); this.nextT += spb; this.step++; }
  }
  playStep(s, t, spb) {
    const I = this.intensity, bar = Math.floor(s / 16) % 4, i = s % 16, b = this.mus;
    const chords = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];   // Dm  Bb  F  C
    const ch = chords[bar], root = ch[0] - 12;
    if (i === 0) for (const m of ch) for (const det of [-6, 6]) {            // pad: detuned saws, slow attack
      const o = c(this.ctx, 'sawtooth', mf(m + 12), det), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 500 + I * 350; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 16 + 0.3);
      o.connect(f); f.connect(g); g.connect(b); o.start(t); o.stop(t + spb * 16 + 0.4);
    }
    if (I >= 1) {                                                             // driving bass in 8ths with octave pops
      if (i % 2 === 0) this.osc(t, spb * 1.6, { type: 'sawtooth', f: mf(root + (i % 8 === 6 ? 12 : 0)), vol: 0.12, bus: b });
      if (i % 4 === 0) { this.osc(t, 0.22, { f: 150, f2: 42, vol: 0.5, bus: b }); }                       // kick
    }
    if (I >= 2) {
      if (i === 4 || i === 12) { this.nz(t, 0.16, { type: 'bandpass', f: 1800, vol: 0.22, bus: b }); this.osc(t, 0.08, { type: 'triangle', f: 190, vol: 0.12, bus: b }); }
      if (i % 2 === 1) this.nz(t, 0.03, { type: 'highpass', f: 7000, vol: 0.06, bus: b });
      const arp = [0, 1, 2, 1, 0, 2, 1, 2]; this.osc(t, spb * 0.9, { type: 'square', f: mf(ch[arp[i % 8]] + 24), vol: 0.025, bus: b });
    }
    if (I >= 3 && (i === 0 || i === 3 || i === 6 || i === 10)) {             // boss: brass stabs
      for (const m of ch) this.osc(t, spb * 1.8, { type: 'sawtooth', f: mf(m), vol: 0.05, bus: b });
    }
    if (I === 0 && i % 4 === 2) this.nz(t, 0.05, { type: 'highpass', f: 6000, vol: 0.02, bus: b });
  }
}
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function c(ctx, type, f, det) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; return o; }

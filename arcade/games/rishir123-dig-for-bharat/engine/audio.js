/* ============================================================
   Audio.

   Everything here is synthesised. Nothing is downloaded, which
   keeps the licensing clean and lets a sound know what it is
   about — a trowel in silt and a pick in granite are different
   sounds because the block says what it is made of, not because
   two files were recorded.

   The score is generative and raga-based. Each site gets a raga
   whose traditional time of day suits it, a drone holds the
   tonic and fifth underneath, and a melodic line wanders the
   scale above it. Percussion only joins in while you are
   actually digging, and a discovery gets its own phrase.
   ============================================================ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---- ragas, as semitone offsets from Sa ----
   The time-of-day association is a real convention in Hindustani
   music (samay); the mapping to sites is this game's own choice. */
export const RAGAS = {
  bhairav:  { name: "Bhairav",  when: "morning",     steps: [0, 1, 4, 5, 7, 8, 11] },
  bhupali:  { name: "Bhupali",  when: "early evening", steps: [0, 2, 4, 7, 9] },
  yaman:    { name: "Yaman",    when: "evening",     steps: [0, 2, 4, 6, 7, 9, 11] },
  malkauns: { name: "Malkauns", when: "late night",  steps: [0, 3, 5, 8, 10] },
  kafi:     { name: "Kafi",     when: "late evening", steps: [0, 2, 3, 5, 7, 9, 10] }
};
export const SITE_RAGA = {
  rakhigarhi: "bhairav", lothal: "bhupali", vidisha: "yaman",
  nalanda: "malkauns", hampi: "kafi"
};

/* material -> how it answers a tool */
const MAT = {
  soil:    { cut: 620, gain: 0.10, decay: 0.15, body: 0 },
  clay:    { cut: 430, gain: 0.13, decay: 0.20, body: 90 },
  sand:    { cut: 1500, gain: 0.07, decay: 0.12, body: 0 },
  gravel:  { cut: 2200, gain: 0.11, decay: 0.13, body: 0 },
  stone:   { cut: 3000, gain: 0.14, decay: 0.16, body: 150 },
  brick:   { cut: 2400, gain: 0.13, decay: 0.14, body: 190 },
  wood:    { cut: 900,  gain: 0.12, decay: 0.17, body: 130 },
  foliage: { cut: 4200, gain: 0.06, decay: 0.22, body: 0 },
  ash:     { cut: 780,  gain: 0.07, decay: 0.18, body: 0 },
  metal:   { cut: 3400, gain: 0.12, decay: 0.30, body: 420 },
  water:   { cut: 1100, gain: 0.09, decay: 0.30, body: 0 }
};

export class Audio {
  constructor(settings) {
    this.s = settings;
    this.ctx = null;
    this.ready = false;
    this.music = { on: false, state: "explore", raga: RAGAS.bhairav, sa: 146.83, timer: null, beat: 0, next: 0, last: 0 };
  }

  /* the context can only start inside a gesture */
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return this.ctx; }
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
    } catch (e) { return null; }

    const c = this.ctx;
    this.master = c.createGain();
    this.busSfx = c.createGain();
    this.busMusic = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 5; this.comp.knee.value = 12;
    this.busSfx.connect(this.master); this.busMusic.connect(this.master);
    this.master.connect(this.comp); this.comp.connect(c.destination);

    /* one noise buffer, reused by everything that needs grit */
    const len = Math.floor(c.sampleRate * 1.2);
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.ready = true;
    this.applyVolumes();
    return c;
  }

  applyVolumes() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(clamp(this.s.master, 0, 1), t, 0.05);
    this.busSfx.gain.setTargetAtTime(clamp(this.s.sfx, 0, 1), t, 0.05);
    this.busMusic.gain.setTargetAtTime(this.s.music_on ? clamp(this.s.music, 0, 1) * 0.6 : 0, t, 0.4);
  }

  /* ---------------- building blocks ---------------- */
  _noise(dest, { cut = 1200, q = 1, type = "lowpass", gain = 0.1, attack = 0.002, decay = 0.15, when = 0 }) {
    const c = this.ctx, t = (when || c.currentTime);
    const src = c.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = cut; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + attack + decay + 0.05);
  }
  _tone(dest, { freq = 220, type = "sine", gain = 0.1, attack = 0.005, decay = 0.3, when = 0, glide = 0, cut = 0 }) {
    const c = this.ctx, t = (when || c.currentTime);
    const o = c.createOscillator(); o.type = type;
    if (glide) {
      o.frequency.setValueAtTime(glide, t);
      o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
    } else o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let node = o;
    if (cut) {
      const f = c.createBiquadFilter(); f.type = "lowpass";
      f.frequency.setValueAtTime(cut, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t + decay);
      f.Q.value = 6;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(dest);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  /* ---------------- sound effects ---------------- */
  dig(material, tool) {
    if (!this.ready) return;
    const m = MAT[material] || MAT.soil;
    const heavy = tool === "pick" || tool === "mattock";
    const light = tool === "brush" || tool === "dental";
    this._noise(this.busSfx, {
      cut: m.cut * (heavy ? 0.55 : light ? 2.4 : 1),
      gain: m.gain * (heavy ? 1.7 : light ? 0.35 : 1),
      decay: m.decay * (light ? 2.2 : 1),
      type: light ? "highpass" : "lowpass"
    });
    if (m.body && !light)
      this._tone(this.busSfx, { freq: m.body, type: "triangle", gain: m.gain * 0.5, decay: 0.09 });
  }
  breakBlock(material) {
    if (!this.ready) return;
    const m = MAT[material] || MAT.soil;
    this._noise(this.busSfx, { cut: m.cut * 1.3, gain: m.gain * 1.5, decay: m.decay * 2.1 });
    if (m.body) this._tone(this.busSfx, { freq: m.body * 0.8, type: "triangle", gain: 0.10, decay: 0.16 });
  }
  step(material) {
    if (!this.ready) return;
    const m = MAT[material] || MAT.soil;
    this._noise(this.busSfx, { cut: m.cut * 0.8, gain: m.gain * 0.42, decay: 0.09 });
  }
  find() {
    if (!this.ready) return;
    const st = this.music.steps || this.music.raga.steps;
    const base = this.music.sa * 2;
    [0, 2, 4].forEach((i, n) => {
      const semi = st[Math.min(i, st.length - 1)];
      this._tone(this.busSfx, {
        freq: base * Math.pow(2, semi / 12), type: "triangle",
        gain: 0.10, attack: 0.01, decay: 0.9, when: this.ctx.currentTime + n * 0.11, cut: 3000
      });
    });
  }
  damage() {
    if (!this.ready) return;
    this._noise(this.busSfx, { cut: 2600, type: "highpass", gain: 0.16, decay: 0.35 });
    this._tone(this.busSfx, { freq: 180, type: "square", gain: 0.05, decay: 0.18 });
  }
  ping() {
    if (!this.ready) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1500, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.5);
    g.gain.setValueAtTime(0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0005, c.currentTime + 0.55);
    o.connect(g); g.connect(this.busSfx);
    o.start(); o.stop(c.currentTime + 0.6);
  }
  machine(kind) {
    if (!this.ready) return;
    if (kind === "sieve") {
      for (let i = 0; i < 7; i++)
        this._noise(this.busSfx, { cut: 3200, type: "bandpass", q: 1.6, gain: 0.075,
                                   decay: 0.11, when: this.ctx.currentTime + i * 0.1 });
    } else if (kind === "float") {
      this._noise(this.busSfx, { cut: 900, gain: 0.09, decay: 0.9, type: "lowpass" });
      for (let i = 0; i < 12; i++)
        this._tone(this.busSfx, { freq: 300 + Math.random() * 900, type: "sine", gain: 0.03,
                                  decay: 0.09, when: this.ctx.currentTime + Math.random() * 0.9 });
    } else if (kind === "bench") {
      this._noise(this.busSfx, { cut: 5200, type: "highpass", gain: 0.05, decay: 0.7 });
      this._tone(this.busSfx, { freq: 880, type: "sine", gain: 0.05, decay: 0.5 });
    } else if (kind === "station") {
      [660, 990, 1320].forEach((f, i) =>
        this._tone(this.busSfx, { freq: f, type: "sine", gain: 0.06, decay: 0.25,
                                  when: this.ctx.currentTime + i * 0.08 }));
    }
  }
  ui(kind) {
    if (!this.ready) return;
    const f = kind === "back" ? 420 : kind === "confirm" ? 760 : 620;
    this._tone(this.busSfx, { freq: f, type: "triangle", gain: 0.06, attack: 0.002, decay: 0.09 });
    if (kind === "confirm") this._tone(this.busSfx, { freq: f * 1.5, type: "triangle", gain: 0.05, decay: 0.16, when: this.ctx.currentTime + 0.07 });
  }

  /* ---------------- the score ---------------- */
  startMusic(ragaKey) {
    if (!this.ready) return;
    this.stopMusic();
    const raga = RAGAS[ragaKey] || RAGAS.bhairav;
    const m = this.music;
    m.raga = raga; m.steps = raga.steps; m.on = true;
    m.beat = 0; m.next = this.ctx.currentTime + 0.15; m.degree = 0;

    /* drone: tonic and fifth, held, with a slow shimmer */
    const c = this.ctx;
    m.drone = c.createGain();
    m.drone.gain.value = 0.0001;
    m.drone.gain.setTargetAtTime(0.085, c.currentTime, 2.0);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.7;
    m.drone.connect(lp); lp.connect(this.busMusic);
    m.droneVoices = [];
    for (const [mult, det, gain] of [[1, 0, 1], [1, 5, 0.7], [1.4983, 0, 0.55], [2, -4, 0.30]]) {
      const o = c.createOscillator(); o.type = "sawtooth";
      o.frequency.value = m.sa * mult; o.detune.value = det;
      const g = c.createGain(); g.gain.value = 0.05 * gain;
      const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.06 + Math.random() * 0.05;
      const lg = c.createGain(); lg.gain.value = 0.018 * gain;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(m.drone);
      o.start(); lfo.start();
      m.droneVoices.push(o, lfo);
    }
    m.timer = setInterval(() => this._schedule(), 60);
  }
  stopMusic() {
    const m = this.music;
    if (m.timer) { clearInterval(m.timer); m.timer = null; }
    m.on = false;
    if (m.drone && this.ctx) {
      const t = this.ctx.currentTime;
      m.drone.gain.setTargetAtTime(0.0001, t, 0.5);
      const voices = m.droneVoices || [];
      setTimeout(() => voices.forEach((v) => { try { v.stop(); } catch (e) {} }), 2200);
      m.drone = null; m.droneVoices = [];
    }
  }
  setMusicState(state) { this.music.state = state; }

  /* look a little ahead and place the next events */
  _schedule() {
    if (!this.music.on || !this.ready) return;
    const c = this.ctx, m = this.music;
    const spb = 60 / 52;                                  // slow, roughly 52 bpm
    const horizon = c.currentTime + 0.35;
    let guard = 0;
    while (m.next < horizon && guard++ < 12) {
      this._beat(m.next, m.beat % 16);
      m.beat++;
      m.next += spb;
    }
  }
  _beat(t, b) {
    const m = this.music, st = m.steps, digging = m.state === "dig";

    /* tanpura pluck at the head of each four */
    if (b % 4 === 0) {
      this._tone(this.busMusic, { freq: m.sa * 2, type: "sawtooth", gain: 0.035,
                                  attack: 0.004, decay: 1.6, when: t, cut: 1400 });
    }

    /* the melodic line: a weighted walk, resting on Sa */
    if (b % 2 === 0 || Math.random() < 0.30) {
      const step = Math.random() < 0.62 ? (Math.random() < 0.5 ? 1 : -1) : (Math.random() < 0.5 ? 2 : -2);
      m.degree = clamp(m.degree + step, -2, st.length + 1);
      const oct = Math.floor(m.degree / st.length);
      const semi = st[((m.degree % st.length) + st.length) % st.length] + oct * 12;
      const freq = m.sa * 2 * Math.pow(2, semi / 12);
      const glide = Math.random() < 0.35 && m.lastFreq ? m.lastFreq : 0;
      this._tone(this.busMusic, {
        freq, glide, type: "sawtooth",
        gain: digging ? 0.055 : 0.045,
        attack: 0.012, decay: 0.9 + Math.random() * 0.8, when: t, cut: 2200
      });
      m.lastFreq = freq;
    }

    /* percussion only while the tool is in the ground */
    if (digging) {
      const low = b === 0 || b === 5 || b === 8 || b === 13;
      const high = b % 2 === 1;
      if (low) {
        this._tone(this.busMusic, { freq: 96, type: "sine", gain: 0.10, attack: 0.002,
                                    decay: 0.28, when: t, glide: 180 });
      }
      if (high) {
        this._noise(this.busMusic, { cut: 1500, type: "bandpass", q: 3.5, gain: 0.045,
                                     decay: 0.07, when: t });
      }
    }
  }

  /* a resolving phrase when something comes out of the ground */
  discovery() {
    if (!this.ready) return;
    const m = this.music, st = m.steps || RAGAS.bhairav.steps, c = this.ctx;
    const asc = [0, 2, 4, st.length - 1];
    asc.forEach((d, i) => {
      const semi = st[Math.min(d, st.length - 1)] + (i === asc.length - 1 ? 12 : 0);
      this._tone(this.busMusic, {
        freq: m.sa * 2 * Math.pow(2, semi / 12), type: "sawtooth",
        gain: 0.075, attack: 0.01, decay: 1.4, when: c.currentTime + i * 0.16, cut: 2600
      });
    });
  }
  ragaLabel() {
    const r = this.music.raga;
    return r ? r.name + " — a " + r.when + " raga" : "";
  }
}

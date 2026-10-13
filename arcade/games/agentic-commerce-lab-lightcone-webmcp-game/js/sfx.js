/* LIGHTCONE · sound — every game event has a voice, and the arena has a score.
   Clips generated with ElevenLabs (scripts/elevenlabs.js) live in assets/audio/.
   Any clip that is missing falls back to the tiny WebAudio synth below, so the
   game is fully playable straight from a clone with no audio files at all. */
(function () {
  window.HS = window.HS || {};

  const BASE = 'assets/audio/';
  // per-clip level — the generated clips are normalised hot; the frequent
  // ones (steps, sniffs, scans) sit back so they read as texture, not events
  const SFX_LEVEL = {
    count: 0.5, go: 0.8, wall: 0.8, decoy: 0.6, scrub: 0.6, dash: 0.6, ping: 0.7,
    sniff: 0.4, scan: 0.35, step: 0.3, pounce: 0.9, stun: 0.7, capture: 1.0,
    escape: 0.9, taunt: 0.5, deny: 0.5, glyph: 0.6, glitch: 0.6, unlock: 0.9,
    rise: 0.5, sink: 0.5, realize: 0.6,
  };
  const MUSIC = ['ambient', 'hunt', 'ascension'];
  // the score is always on: this faint at rest, full when the seeker is on you
  const MUSIC_FAR = 0.18;
  const MUSIC_NEAR = 1.0;
  // generated tracks arrive with a fade-in and a long fade-out tail; loop only
  // the steady body, and stitch passes with an equal-power crossfade
  const LOOP = {
    ambient: { start: 3.0, end: 52.0, xfade: 3.0 },
    hunt:    { start: 9.0, end: 39.0, xfade: 1.0 },
  };
  const XFADE_CURVE_N = 64;
  const FADE_IN = new Float32Array(XFADE_CURVE_N);
  const FADE_OUT = new Float32Array(XFADE_CURVE_N);
  for (let i = 0; i < XFADE_CURVE_N; i++) {
    const a = (i / (XFADE_CURVE_N - 1)) * Math.PI / 2;
    FADE_IN[i] = Math.sin(a); FADE_OUT[i] = Math.cos(a);
  }

  let ctx = null, master = null, sfxBus = null, musicBus = null, loopBus = null;
  let on = true;

  // ── clip store ─────────────────────────────────────────────────────
  // fetched at load time (bytes), decoded the moment an AudioContext exists
  const bytes = {};   // name → ArrayBuffer (awaiting decode)
  const clips = {};   // name → AudioBuffer | null (null = missing → synth)

  function fetchClip(name, dir) {
    fetch(`${BASE}${dir}/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        if (!buf) { clips[name] = null; return; }
        bytes[name] = buf;
        if (ctx) decodeClip(name);
      })
      .catch(() => { clips[name] = null; });
  }

  function decodeClip(name) {
    const buf = bytes[name];
    if (!buf) return;
    delete bytes[name];
    ctx.decodeAudioData(buf.slice(0))
      .then((ab) => { clips[name] = ab; })
      .catch(() => { clips[name] = null; });
  }

  Object.keys(SFX_LEVEL).forEach((n) => fetchClip(n, 'sfx'));
  MUSIC.forEach((n) => fetchClip(n, 'music'));

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = on ? 1 : 0;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.45;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.42;
      musicBus.connect(master);
      loopBus = ctx.createGain();      // the two loops, scaled by threat
      loopBus.gain.value = MUSIC_FAR;
      loopBus.connect(musicBus);
      Object.keys(bytes).forEach(decodeClip);
      return true;
    } catch (e) { return false; }
  }

  function playClip(name) {
    const ab = clips[name];
    if (!ab) return false;
    const src = ctx.createBufferSource();
    src.buffer = ab;
    const g = ctx.createGain();
    g.gain.value = SFX_LEVEL[name] || 0.6;
    src.connect(g).connect(sfxBus);
    src.start();
    return true;
  }

  // ── synth fallback ─────────────────────────────────────────────────
  function tone(f0, f1, dur, type, gain, delay) {
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function hiss(dur, freq, gain, delay) {
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t0);
  }

  const bank = {
    count:   () => tone(440, 440, 0.09, 'sine', 0.18),
    go:      () => { tone(520, 880, 0.18, 'sine', 0.25); tone(660, 1320, 0.22, 'sine', 0.18, 0.06); },
    wall:    () => { tone(140, 60, 0.22, 'square', 0.22); hiss(0.08, 900, 0.1); },
    decoy:   () => { tone(980, 1400, 0.1, 'sine', 0.14); tone(1400, 980, 0.12, 'sine', 0.1, 0.08); },
    scrub:   () => hiss(0.5, 2400, 0.28),
    dash:    () => { tone(220, 720, 0.16, 'sawtooth', 0.12); hiss(0.14, 3000, 0.08); },
    ping:    () => { tone(1180, 590, 0.55, 'sine', 0.28); tone(1180, 590, 0.4, 'sine', 0.1, 0.18); },
    sniff:   () => { hiss(0.07, 1600, 0.12); hiss(0.09, 1300, 0.12, 0.1); },
    scan:    () => tone(700, 1050, 0.12, 'triangle', 0.1),
    step:    () => tone(180, 140, 0.05, 'triangle', 0.07),
    pounce:  () => { tone(90, 40, 0.4, 'sine', 0.5); hiss(0.25, 500, 0.3); },
    stun:    () => tone(320, 110, 0.45, 'sawtooth', 0.16),
    capture: () => { tone(600, 100, 0.7, 'sawtooth', 0.3); tone(300, 60, 0.9, 'sine', 0.3, 0.1); },
    escape:  () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.22, 'sine', 0.2, i * 0.12)); },
    taunt:   () => { tone(500, 340, 0.08, 'square', 0.09); tone(340, 500, 0.08, 'square', 0.09, 0.09); },
    deny:    () => tone(200, 150, 0.12, 'square', 0.12),
    glyph:   () => { tone(1568, 2093, 0.25, 'sine', 0.13); tone(2093, 1568, 0.3, 'sine', 0.09, 0.12); hiss(0.08, 6000, 0.05); },
    glitch:  () => { hiss(0.12, 5000, 0.18); tone(233, 175, 0.1, 'square', 0.08); tone(466, 350, 0.08, 'square', 0.06, 0.05); },
    unlock:  () => { tone(130, 520, 1.0, 'sawtooth', 0.12); tone(131.5, 523, 1.0, 'sawtooth', 0.1); tone(196, 784, 0.9, 'sine', 0.1, 0.12); hiss(0.5, 2000, 0.08, 0.2); },
    rise:    () => { tone(300, 900, 0.35, 'sine', 0.16); hiss(0.2, 3200, 0.06); },
    sink:    () => { tone(900, 300, 0.35, 'sine', 0.16); hiss(0.2, 1200, 0.06); },
    realize: () => { tone(392, 784, 0.32, 'sine', 0.16); tone(587, 1175, 0.4, 'triangle', 0.11, 0.14); hiss(0.12, 4500, 0.05, 0.04); },
  };

  // ── score ──────────────────────────────────────────────────────────
  // two loops run from the first interaction and never stop: `ambient` carries
  // the room, `hunt` fades in as the seeker closes in, and the whole thing sits
  // very faint until the threat is real. `ascension` plays once on top when the
  // hider escapes. Everything is driven from game state via score(S).
  const layers = {};   // name → { src, gain }
  let sting = null;    // the one-shot ascension source
  let tension = 0;     // smoothed 0..1
  let scorePhase = '';

  function startLoop(name, level) {
    const ab = clips[name];
    if (!ab) return null;
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(loopBus);
    const cfg = LOOP[name] || { start: 0.03, end: ab.duration - 0.03, xfade: 0.5 };
    const end = Math.min(cfg.end, ab.duration);
    const xfade = Math.min(cfg.xfade, (end - cfg.start) / 3);
    const layer = { gain: g, ab, start: cfg.start, len: end - cfg.start, xfade, nextAt: ctx.currentTime, passes: 0 };
    // a timer, not the frame loop: rAF stops in a background tab, the music must not
    layer.timer = setInterval(() => scheduleLoop(layer), 250);
    scheduleLoop(layer);
    return layer;
  }

  // keep ~2.5s of passes queued; each pass fades in over the previous one's fade-out
  function scheduleLoop(layer) {
    const { ab, start, len, xfade } = layer;
    while (layer.nextAt < ctx.currentTime + 2.5) {
      const t0 = layer.nextAt;
      const src = ctx.createBufferSource();
      src.buffer = ab;
      const env = ctx.createGain();
      env.gain.setValueCurveAtTime(FADE_IN, t0, xfade);
      env.gain.setValueCurveAtTime(FADE_OUT, t0 + len - xfade, xfade);
      src.connect(env).connect(layer.gain);
      src.start(t0, start, len);
      src.onended = () => { try { env.disconnect(); } catch (e) { /* gone */ } };
      layer.nextAt = t0 + len - xfade;
      layer.passes++;
    }
  }

  function fadeStop(layer, secs) {
    if (!layer) return;
    const t = ctx.currentTime;
    layer.gain.gain.cancelScheduledValues(t);
    layer.gain.gain.setValueAtTime(layer.gain.gain.value, t);
    layer.gain.gain.linearRampToValueAtTime(0.0001, t + secs);
    try { layer.src.stop(t + secs + 0.05); } catch (e) { /* already stopped */ }
  }

  // each layer starts the moment its clip has decoded (they arrive async,
  // the big ambient file last) — the loops are not beat-locked, so joining late is fine
  function startLoops() {
    if (!layers.ambient) layers.ambient = startLoop('ambient', 1 - tension * 0.5);
    if (!layers.hunt) layers.hunt = startLoop('hunt', tension);
  }

  function playSting(name, level, delay) {
    const ab = clips[name];
    if (!ab) return;
    const src = ctx.createBufferSource();
    src.buffer = ab;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(g).connect(musicBus);
    src.start(ctx.currentTime + (delay || 0));
    sting = { src, gain: g };
    src.onended = () => { if (sting && sting.src === src) sting = null; };
  }

  // how close the seeker is, as a 0..1 threat — the score follows it
  function threat(S) {
    const h = S.hider, sk = S.seeker;
    if (S.phase !== 'play') return S.phase === 'countdown' ? 0.15 : 0;
    if (S.t < sk.stunnedUntil) return 0.1;
    const d = Math.hypot(sk.fx - h.x, sk.fy - h.y);
    let t = Math.max(0, Math.min(1, 1 - (d - 3) / 9));
    const left = S.roundEndsAt - S.t;
    if (left <= 30) t = Math.max(t, 0.4 + (1 - left / 30) * 0.3);
    return t;
  }

  function score(S) {
    if (!ctx) return;
    startLoops();

    if (S.phase !== scorePhase) {
      scorePhase = S.phase;
      if (S.phase === 'countdown' && sting) { fadeStop(sting, 0.6); sting = null; }
      if (S.phase === 'over' && S.winner === 'hider') playSting('ascension', 0.9, 0.5);
      // a capture needs nothing extra: the threat collapses and the loops sink
      // back to faint under the slow-motion tear
    }

    if (!layers.ambient && !layers.hunt) return;
    const target = threat(S);
    tension += (target - tension) * (target > tension ? 0.06 : 0.02);
    const t = ctx.currentTime;
    loopBus.gain.setTargetAtTime(MUSIC_FAR + (MUSIC_NEAR - MUSIC_FAR) * tension, t, 0.15);
    if (layers.ambient) layers.ambient.gain.gain.setTargetAtTime(1 - tension * 0.5, t, 0.15);
    if (layers.hunt) layers.hunt.gain.gain.setTargetAtTime(tension, t, 0.15);
  }

  // the lobby has music too — start on the first gesture of any kind, since
  // browsers will not let audio run before one
  const wake = () => { HS.sfx.init(); };
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { once: true, passive: true }));

  // ── public ─────────────────────────────────────────────────────────
  HS.sfx = {
    play(name) {
      if (!on || !ensure()) return;
      try { if (!playClip(name)) { const f = bank[name]; if (f) f(); } } catch (e) { /* audio not ready */ }
    },
    score,
    init() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggle() {
      on = !on;
      if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
      return on;
    },
    get on() { return on; },
    /** which clips are real generated audio vs synth (for the console) */
    get loaded() { return Object.keys(clips).filter((k) => clips[k]); },
    get debug() {
      return {
        ctx: ctx ? ctx.state : null, tension: +tension.toFixed(3), sting: !!sting,
        level: loopBus ? +loopBus.gain.value.toFixed(3) : null,
        passes: { ambient: layers.ambient ? layers.ambient.passes : 0, hunt: layers.hunt ? layers.hunt.passes : 0 },
        ambient: layers.ambient ? +layers.ambient.gain.gain.value.toFixed(3) : null,
        hunt: layers.hunt ? +layers.hunt.gain.gain.value.toFixed(3) : null,
      };
    },
  };
})();

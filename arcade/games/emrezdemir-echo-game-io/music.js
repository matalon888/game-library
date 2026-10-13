// Music — programatik chiptune motoru (8-bit / dark space mood).
// Phrygian/locrian skala, dissonans, polyrhythm, vibrato — gizem + kaos + çekicilik.

const Music = (() => {
  let muted = false;
  let volume = 0.45;
  let currentTrack = null;
  let chip = null;

  // ---------- Menu music: external MP3 (NCS - C - Voyage) ----------
  // Analyser exposed for spectrum-reactive visuals (TitleFX).
  const MENU_TRACK_URL = "music/voyage_main_menu.mp3";
  const GAME_TRACK_URL = "music/level_music.mp3";
  const TELEPORT_SFX_URL = "music/teleport.mp3";

  let menuAudio = null;
  let gameAudio = null;
  let teleportSfx = null;
  let menuCtx = null;
  let menuSource = null;
  let menuAnalyser = null;
  let menuAnalyserData = null;
  let menuGain = null;
  let menuAnalyserReady = false;

  // audio.js içinde `const Audio = (...)` SFX modülünü tanımlıyor ve global
  // `Audio` constructor'unu gölgeliyor. HTMLAudioElement constructor'una
  // ulaşmak için window.Audio kullanıyoruz.
  const HTMLAudioCtor = window.Audio;

  // file:// protokolünde createMediaElementSource audio çıkışını siler (CORS).
  // Bu yüzden file:// ile açıldıysa Web Audio API zincirini hiç kurmayız —
  // ses doğrudan HTMLAudio'dan çalar, spectrum reaktif görsel devre dışı kalır.
  const isFileProtocol = (typeof location !== "undefined" && location.protocol === "file:");

  function startMenuTrack() {
    if (menuAudio) {
      const p = menuAudio.play();
      if (p && p.catch) p.catch(err => console.info("Menu audio resume blocked:", err && err.message));
      return;
    }
    try {
      menuAudio = new HTMLAudioCtor(MENU_TRACK_URL);
    } catch (e) {
      console.warn("[Music] HTMLAudio constructor failed:", e);
      return;
    }
    menuAudio.loop = true;
    menuAudio.preload = "auto";
    menuAudio.volume = muted ? 0 : volume;
    menuAudio.addEventListener("error", () => {
      console.warn("[Music] Voyage MP3 load error:",
        menuAudio.error ? menuAudio.error.code : "unknown",
        " src=", menuAudio.currentSrc || MENU_TRACK_URL);
    });
    menuAudio.addEventListener("canplay", () => {
      console.info("[Music] Voyage ready.");
    });

    // Web Audio analyser — yalnızca http(s) altında dene; file:// için skip
    if (!isFileProtocol) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        menuCtx = new Ctx();
        menuSource = menuCtx.createMediaElementSource(menuAudio);
        menuAnalyser = menuCtx.createAnalyser();
        menuAnalyser.fftSize = 256;
        menuAnalyser.smoothingTimeConstant = 0.78;
        menuGain = menuCtx.createGain();
        menuGain.gain.value = 1.0;
        menuSource.connect(menuAnalyser);
        menuAnalyser.connect(menuGain);
        menuGain.connect(menuCtx.destination);
        menuAnalyserData = new Uint8Array(menuAnalyser.frequencyBinCount);
        menuAnalyserReady = true;
        console.info("[Music] Web Audio analyser enabled (reactive visuals on).");
      } catch (e) {
        console.warn("[Music] Analyser unavailable, falling back to raw HTMLAudio:", e && e.message);
        if (menuCtx) { try { menuCtx.close(); } catch (e2) {} }
        menuCtx = null; menuSource = null; menuAnalyser = null;
        menuAnalyserReady = false;
      }
    } else {
      console.info("[Music] file:// detected — Web Audio analyser bypassed. Spectrum visuals off; audio plays via HTMLAudio.");
    }

    if (menuCtx && menuCtx.state === "suspended") {
      menuCtx.resume().catch(() => {});
    }
    const playPromise = menuAudio.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(err =>
        console.info("[Music] Autoplay blocked; will start on first user gesture. (" + (err && err.message || err) + ")")
      );
    }
  }

  function stopMenuTrack() {
    if (!menuAudio) return;
    try { menuAudio.pause(); } catch (e) {}
  }

  function startGameTrack() {
    if (gameAudio) {
      const p = gameAudio.play();
      if (p && p.catch) p.catch(err => console.info("[Music] Game audio resume blocked:", err && err.message));
      return;
    }
    try {
      gameAudio = new HTMLAudioCtor(GAME_TRACK_URL);
    } catch (e) {
      console.warn("[Music] HTMLAudio constructor failed for game track:", e);
      return;
    }
    gameAudio.loop = true;
    gameAudio.preload = "auto";
    gameAudio.volume = muted ? 0 : volume * 0.6;
    gameAudio.addEventListener("error", () => {
      console.warn("[Music] level_music load error:",
        gameAudio.error ? gameAudio.error.code : "unknown");
    });
    const p = gameAudio.play();
    if (p && p.catch) {
      p.catch(err =>
        console.info("[Music] Game track autoplay blocked; will start on next gesture. (" + (err && err.message || err) + ")")
      );
    }
  }

  function stopGameTrack() {
    if (!gameAudio) return;
    try { gameAudio.pause(); } catch (e) {}
  }

  function playTeleportSfx() {
    if (muted) return;
    if (!teleportSfx) {
      try {
        teleportSfx = new HTMLAudioCtor(TELEPORT_SFX_URL);
        teleportSfx.preload = "auto";
      } catch (e) {
        return;
      }
    }
    try { teleportSfx.currentTime = 0; } catch (e) {}
    teleportSfx.volume = muted ? 0 : volume;
    const p = teleportSfx.play();
    if (p && p.catch) p.catch(() => {});
  }

  // Procedural fallback spectrum — gerçek audio analizi yoksa kullanılır
  // (file:// CORS, autoplay henüz tetiklenmemiş, analyser hiç kurulamamış vb.)
  // Sonuç: ana menü görselleri her durumda canlı kalır.
  let _procSpectrum = null;
  function getProceduralSpectrum() {
    if (!_procSpectrum) _procSpectrum = new Uint8Array(128);
    const t = performance.now() * 0.001;
    // Beat envelope — ~120 BPM (2 Hz) ana darbe; üzerine hafif 2. tepki
    const beat = 0.55 + 0.45 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * (120 / 60))), 3);
    const sub  = 0.35 + 0.30 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * (120 / 60) + Math.PI)), 2);
    for (let i = 0; i < 128; i++) {
      // Frekansla azalan envelope — bass tarafı daha yoğun
      const env = Math.pow(1 - i / 128, 1.6);
      // Per-bin osilasyon (faz kayık, doğal his)
      const wave = 0.5 + 0.5 * Math.sin(i * 0.21 + t * (1.4 + i * 0.045));
      // Mid-treble bandında ikinci darbe katkısı
      const bandMix = (i < 16) ? beat : (i < 56 ? (beat * 0.6 + sub * 0.4) : sub);
      const v = env * wave * bandMix * 0.85;
      _procSpectrum[i] = Math.max(0, Math.min(255, Math.floor(v * 255)));
    }
    return _procSpectrum;
  }

  function isAudioActive() {
    return !!(menuAudio && !menuAudio.paused && menuAudio.currentTime > 0 && !menuAudio.ended);
  }

  function getSpectrum() {
    // Gerçek analiz öncelikli; aksi durumda procedural canlı dalga
    if (isAudioActive() && menuAnalyserReady && menuAnalyser) {
      menuAnalyser.getByteFrequencyData(menuAnalyserData);
      return menuAnalyserData;
    }
    return getProceduralSpectrum();
  }

  // Bass/mid/treble enerji özeti (0..1) — getSpectrum gerçek veya procedural döndürür
  function getEnergy() {
    const data = getSpectrum();
    if (!data) return { bass: 0, mid: 0, treble: 0, overall: 0 };
    const N = data.length;
    const bassEnd = Math.floor(N * 0.10);
    const midEnd = Math.floor(N * 0.45);
    let bass = 0, mid = 0, treble = 0;
    for (let i = 0; i < bassEnd; i++) bass += data[i];
    for (let i = bassEnd; i < midEnd; i++) mid += data[i];
    for (let i = midEnd; i < N; i++) treble += data[i];
    bass /= (bassEnd * 255) || 1;
    mid /= ((midEnd - bassEnd) * 255) || 1;
    treble /= ((N - midEnd) * 255) || 1;
    const overall = (bass + mid + treble) / 3;
    return { bass, mid, treble, overall };
  }

  // ---------- MIDI ----------
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------- Patterns ----------
  // bpm + bars + tracks. Step = 16'lık nota.
  // type: triangle / square / noise / kick / drone
  // duty (square): 0.5 / 0.25 / 0.125 — ince → daha buruk, kalın → kuvvetli
  // detune: cent cinsinden (slight detune = beating, dolu his)
  // vibrato: { rate, depth } — Hz, cent
  // gate: 0..1 — patterndeki rastgele atlama olasılığı (0 = her zaman çal)
  const PATTERNS = {

    // ============ MENU — dark ambient (no melody, no rhythm) ============
    // Sub drone + slow pad swells + occasional bell ping + wind noise.
    // 38 BPM = ~6 saniyede bar değişimi → çok yavaş, derin atmosfer.
    menu: {
      bpm: 38,
      bars: 4,
      tracks: [
        // 1) SUB DRONE — A1 sustain, çok uzun decay
        { type: "triangle", gain: 0.16, decay: 6.0, vibrato: { rate: 0.2, depth: 4 },
          steps: pad(64, [
            { at: 0,  note: 33, dur: 32 },     // A1
            { at: 32, note: 32, dur: 24 },     // G#1 — gerilim
            { at: 56, note: 33, dur: 8 },      // A1 geri
          ])},

        // 2) PAD — soluk sine-pulse, sub'un üst oktavı
        { type: "square", duty: 0.5, gain: 0.035, decay: 5.0, detune: -8, vibrato: { rate: 0.25, depth: 3 },
          steps: pad(64, [
            { at: 0,  note: 57, dur: 32 },     // A3
            { at: 32, note: 56, dur: 32 },     // G#3
          ])},
        { type: "square", duty: 0.5, gain: 0.035, decay: 5.0, detune: +8, vibrato: { rate: 0.28, depth: 3 },
          steps: pad(64, [
            { at: 0,  note: 60, dur: 32 },     // C4
            { at: 32, note: 59, dur: 32 },     // B3 (minor mood)
          ])},

        // 3) DISTANT BELL — çok seyrek, derinden gelen
        { type: "square", duty: 0.0625, gain: 0.045, decay: 3.0,
          steps: pad(64, [
            { at: 14, note: 81, dur: 1 },      // A5 — uzak çan
            { at: 48, note: 76, dur: 1 },      // E5
          ])},

        // 4) WIND — filtered noise sweep, uzun decay
        { type: "noise", gain: 0.022, decay: 5.5, hp: 700,
          steps: pad(64, [
            { at: 0,  dur: 18 },
            { at: 30, dur: 16 },
          ])},
      ],
    },

    // ============ GAME — minimal heartbeat tension ============
    // Sub bass kalp atışı + minor pad layers + çok seyrek high ping + ambient noise.
    // 44 BPM, 4 bar döngü. No lead melody, no arpej, no hi-hat. Sadece atmosfer.
    game: {
      bpm: 44,
      bars: 4,
      tracks: [
        // 1) HEARTBEAT — sub pulse her 4 step (≈1.3s aralık)
        { type: "triangle", gain: 0.18, decay: 1.2,
          steps: pad(64, [
            { at: 0,  note: 33, dur: 3 },      // A1
            { at: 8,  note: 33, dur: 3 },
            { at: 16, note: 33, dur: 3 },
            { at: 24, note: 33, dur: 3 },
            { at: 32, note: 32, dur: 3 },      // G#1 — half-step gerilim
            { at: 40, note: 32, dur: 3 },
            { at: 48, note: 33, dur: 3 },      // A1 geri
            { at: 56, note: 33, dur: 3 },
          ])},

        // 2) PAD LOW — C minor 3rd, very long sustain
        { type: "square", duty: 0.5, gain: 0.04, decay: 5.0, detune: -8,
          steps: pad(64, [
            { at: 0,  note: 60, dur: 32 },     // C4
            { at: 32, note: 58, dur: 32 },     // Bb3 (descent)
          ])},
        { type: "square", duty: 0.5, gain: 0.04, decay: 5.0, detune: +8,
          steps: pad(64, [
            { at: 0,  note: 63, dur: 32 },     // Eb4 (minor 3rd)
            { at: 32, note: 62, dur: 32 },     // D4
          ])},

        // 3) RARE HIGH PING — gizem, bar başı düşmeyen
        { type: "square", duty: 0.0625, gain: 0.035, decay: 2.2,
          steps: pad(64, [
            { at: 18, note: 84, dur: 1 },      // C6
            { at: 52, note: 79, dur: 1 },      // G5
          ])},

        // 4) AMBIENT NOISE — düşük frekanslı uğultu
        { type: "noise", gain: 0.016, decay: 7.0, hp: 500,
          steps: pad(64, [
            { at: 0,  dur: 32 },
            { at: 32, dur: 32 },
          ])},

        // 5) DEEP KICK — çok seyrek, bar değişiminde
        { type: "kick", gain: 0.09, decay: 0.7,
          steps: pad(64, [
            { at: 0,  dur: 2 },
            { at: 32, dur: 2 },
          ])},
      ],
    },
  };

  // {at, ...} listesini 'len' uzunluklu sparse diziye dök
  function pad(len, events) {
    const out = new Array(len).fill(null);
    events.forEach(e => { if (e.at < len) out[e.at] = e; });
    return out;
  }

  // ---------- Engine ----------
  function startChip(track) {
    stopChip();
    const pattern = PATTERNS[track];
    if (!pattern) return;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();

    const master = ctx.createGain();
    master.gain.value = muted ? 0 : volume * 0.55;
    master.connect(ctx.destination);

    // Lo-fi lowpass (8-bit konsol his)
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 5200;
    lowpass.Q.value = 0.6;
    lowpass.connect(master);

    // Tempo'ya senkron stereo delay
    const delay = ctx.createDelay(0.6);
    delay.delayTime.value = 60 / pattern.bpm / 2;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    delay.connect(fb).connect(delay);
    delay.connect(lowpass);

    const stepDur = 60 / pattern.bpm / 4;          // 16'lık
    const totalSteps = pattern.tracks[0].steps.length;
    const startTime = Math.max(ctx.currentTime + 0.1, 0.1);

    chip = {
      ctx, master, lowpass, delay, fb,
      pattern, stepDur, totalSteps, startTime,
      step: 0, lookAhead: 0.18,
      activeNodes: [], timer: null,
    };
    if (ctx.state === "suspended") {
      // Browser policy: kullanıcı etkileşimi sonrası çağrılırsa resume olur.
      ctx.resume().catch(() => {});
    }

    function pushNode(n) {
      chip.activeNodes.push(n);
      if (chip.activeNodes.length > 256) chip.activeNodes.shift();
    }

    function makeSquareWave(duty) {
      const real = new Float32Array(20);
      const imag = new Float32Array(20);
      for (let h = 1; h < 20; h++) {
        imag[h] = (2 / (h * Math.PI)) * Math.sin(Math.PI * h * duty);
      }
      return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    }

    function playTone(time, freq, dur, type, gainPeak, decay, opts) {
      const releaseT = time + dur;
      const osc = ctx.createOscillator();
      if (type === "square" && opts.duty != null && opts.duty !== 0.5) {
        osc.setPeriodicWave(makeSquareWave(opts.duty));
      } else {
        osc.type = type === "square" ? "square" : type;
      }
      osc.frequency.value = freq;
      if (opts.detune) osc.detune.value = opts.detune;

      // Vibrato LFO
      let lfo = null, lfoGain = null;
      if (opts.vibrato) {
        lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = opts.vibrato.rate;
        lfoGain = ctx.createGain();
        lfoGain.gain.value = opts.vibrato.depth;
        lfo.connect(lfoGain).connect(osc.detune);
        lfo.start(time);
        lfo.stop(releaseT + decay + 0.05);
        pushNode(lfo);
      }

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gainPeak, time + 0.01);
      g.gain.linearRampToValueAtTime(gainPeak * 0.65, time + Math.min(0.08, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, releaseT + decay);

      osc.connect(g);
      g.connect(lowpass);
      if (type === "square") g.connect(delay);
      osc.start(time);
      osc.stop(releaseT + decay + 0.05);
      pushNode(osc);
    }

    function playNoise(time, dur, gainPeak, decay, hp) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * (dur + decay + 0.05)));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "highpass";
      filt.frequency.value = hp || 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gainPeak, time + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur + decay);
      src.connect(filt).connect(g).connect(lowpass);
      src.start(time);
      src.stop(time + dur + decay + 0.05);
      pushNode(src);
    }

    function playKick(time, dur, gainPeak, decay) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, time);
      osc.frequency.exponentialRampToValueAtTime(28, time + 0.10);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gainPeak, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur + decay);
      osc.connect(g).connect(lowpass);
      osc.start(time);
      osc.stop(time + dur + decay + 0.05);
      pushNode(osc);
    }

    function scheduleStep(stepIdx, time) {
      pattern.tracks.forEach(tr => {
        const cell = tr.steps[stepIdx];
        if (!cell) return;
        const dur = (cell.dur || 1) * stepDur;
        const gain = (cell.gain != null ? cell.gain : tr.gain) || 0.1;
        if (tr.type === "noise")        playNoise(time, dur, gain, tr.decay || 0.05, tr.hp);
        else if (tr.type === "kick")    playKick(time, dur, gain, tr.decay || 0.1);
        else playTone(time, midiHz(cell.note), dur, tr.type, gain, tr.decay || 0.2, {
          duty: tr.duty,
          detune: tr.detune,
          vibrato: tr.vibrato,
        });
      });
    }

    function tick() {
      if (!chip) return;
      const now = chip.ctx.currentTime;
      while (chip.startTime + chip.step * stepDur < now + chip.lookAhead) {
        const t = chip.startTime + chip.step * stepDur;
        scheduleStep(chip.step % totalSteps, t);
        chip.step++;
      }
    }
    chip.timer = setInterval(tick, 30);
    tick();
  }

  function stopChip() {
    if (!chip) return;
    clearInterval(chip.timer);
    try {
      chip.activeNodes.forEach(n => { try { n.stop(); } catch (e) {} });
      chip.ctx.close();
    } catch (e) {}
    chip = null;
  }

  // ---------- One-shot stings ----------
  // Kısa müzikal efekt — kazanma, kapı kilitlenme, vb. Ana track üzerine biner.
  const STINGS = {
    // Major arpeggio, parlak — kazanma
    win:   { notes: [69, 72, 76, 81],          dur: 0.10, gap: 0.07, gain: 0.22, type: "square" },
    // 3 yıldız — daha uzun, daha tiz, triumph
    win3:  { notes: [69, 73, 76, 81, 84, 88],  dur: 0.11, gap: 0.07, gain: 0.26, type: "square" },
    // Latch — hızlı yükselen 3 nota
    latch: { notes: [60, 67, 72],              dur: 0.08, gap: 0.05, gain: 0.20, type: "triangle" },
  };
  function playSting(name) {
    if (muted) return;
    const spec = STINGS[name];
    if (!spec) return;
    let ctx = chip ? chip.ctx : null;
    let tempCtx = false;
    if (!ctx) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ctx = new Ctx();
        tempCtx = true;
      } catch (e) { return; }
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const master = ctx.createGain();
    master.gain.value = volume * 0.85;
    master.connect(ctx.destination);

    const t0 = ctx.currentTime + 0.02;
    spec.notes.forEach((n, i) => {
      const t = t0 + i * (spec.dur * 0.5 + spec.gap);
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = midiHz(n);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(spec.gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + spec.dur + 0.05);
    });

    if (tempCtx) {
      const lifetime = (spec.notes.length * (spec.dur + spec.gap) + 0.3) * 1000;
      setTimeout(() => { try { ctx.close(); } catch (e) {} }, lifetime);
    }
  }

  // ---------- Public ----------
  function play(track) {
    if (track === currentTrack) {
      if (track === "menu") {
        if (!menuAudio) {
          startMenuTrack();
        } else {
          if (menuCtx && menuCtx.state === "suspended") {
            menuCtx.resume().catch(() => {});
          }
          if (menuAudio.paused) {
            const p = menuAudio.play();
            if (p && p.catch) p.catch(err =>
              console.info("[Music] resume play blocked:", err && err.message));
          }
        }
      }
      if (track === "game") {
        if (!gameAudio) {
          startGameTrack();
        } else if (gameAudio.paused) {
          const p = gameAudio.play();
          if (p && p.catch) p.catch(err =>
            console.info("[Music] game resume blocked:", err && err.message));
        }
      }
      return;
    }
    currentTrack = track;
    if (track === "menu") {
      stopGameTrack();
      stopChip();
      startMenuTrack();
    } else if (track === "game") {
      stopMenuTrack();
      stopChip();
      startGameTrack();
    }
  }
  function stopAll() {
    currentTrack = null;
    stopChip();
    stopMenuTrack();
    stopGameTrack();
  }
  function setMuted(v) {
    muted = !!v;
    if (chip) chip.master.gain.value = muted ? 0 : volume * 0.55;
    if (menuAudio) menuAudio.volume = muted ? 0 : volume;
    if (gameAudio) gameAudio.volume = muted ? 0 : volume * 0.6;
    if (teleportSfx) teleportSfx.volume = muted ? 0 : volume;
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (chip) chip.master.gain.value = muted ? 0 : volume * 0.55;
    if (menuAudio) menuAudio.volume = muted ? 0 : volume;
    if (gameAudio) gameAudio.volume = muted ? 0 : volume * 0.6;
    if (teleportSfx) teleportSfx.volume = muted ? 0 : volume;
  }
  function getVolume() { return volume; }
  function isMuted() { return muted; }

  return { play, stopAll, setMuted, setVolume, getVolume, isMuted, playSting, playTeleportSfx, getSpectrum, getEnergy };
})();

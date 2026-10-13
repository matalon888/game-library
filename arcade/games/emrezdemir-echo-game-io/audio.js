// Tiny WebAudio synth — tek dosya, dış kaynak yok.
const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
  }

  function tone(freq, dur, type = "sine", gain = 1, slideTo = null) {
    if (muted) return;
    init();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain = 0.4, filterFreq = 1200) {
    if (muted) return;
    init();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  return {
    move:        () => tone(420, 0.04, "square", 0.25),
    bump:        () => tone(140, 0.08, "sawtooth", 0.4),
    plateOn:     () => tone(660, 0.10, "triangle", 0.6, 990),
    doorOpen:    () => { tone(330, 0.06, "square", 0.4); tone(660, 0.10, "square", 0.3, 990); },
    record:      () => { tone(220, 0.08, "sine", 0.5); setTimeout(() => tone(440, 0.08, "sine", 0.5), 60); setTimeout(() => tone(660, 0.12, "sine", 0.5), 120); },
    undo:        () => { tone(660, 0.06, "sine", 0.4, 220); },
    teleport:    () => { tone(880, 0.08, "sine", 0.5, 200); tone(1200, 0.10, "triangle", 0.3, 600); },
    laser:       () => noise(0.18, 0.35, 1800),
    death:       () => { tone(220, 0.20, "sawtooth", 0.6, 60); noise(0.25, 0.3, 600); },
    win:         () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, "triangle", 0.5), i * 90)); },
    fail:        () => { [330, 247, 196].forEach((f, i) => setTimeout(() => tone(f, 0.18, "sawtooth", 0.4), i * 110)); },
    click:       () => tone(800, 0.03, "square", 0.25),
    setMuted:    (v) => { muted = !!v; },
    isMuted:     () => muted,
  };
})();

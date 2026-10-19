// Zoomburst audio, all synthesised: engine (two detuned oscillators through a filter, rpm follows gears), tyre squeal,
// wind, scrapes, crunches, nitro whoosh, countdown beeps and an upbeat 128 BPM music loop with intensity layers.
export function makeAudio() {
  let ctx = null, master, music, fx, noise, eng = null, sq, wind, scr, muted = false, intensity = 0.3, step = 0, nextT = 0, timer = 0, musicOn = false;
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    music = ctx.createGain(); music.gain.value = 0.32; music.connect(comp); fx = ctx.createGain(); fx.gain.value = 0.9; fx.connect(comp);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loopN = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
    // engine
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sine'; lp.type = 'lowpass'; lp.Q.value = 3; g.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(lp); o1.connect(lp); const g3 = ctx.createGain(); g3.gain.value = 0.6; o3.connect(g3); g3.connect(g);
    lp.connect(g); g.connect(fx); [o1, o2, o3].forEach(o => o.start()); eng = { o1, o2, o3, lp, g };
    // tyre squeal, wind, scrape
    const mk = (type, f, q) => { const s = loopN(), b = ctx.createBiquadFilter(), gg = ctx.createGain(); b.type = type; b.frequency.value = f; b.Q.value = q; gg.gain.value = 0; s.connect(b); b.connect(gg); gg.connect(fx); return gg; };
    sq = mk('bandpass', 1500, 9); wind = mk('lowpass', 900, 0.7); scr = mk('highpass', 2500, 1.5);
  };
  const env = (node, t, a, peak, dec) => { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const osc = (type, f, t, dur, vol, slide = 1, dest = fx) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur); env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05); };
  const nz = (t, dur, vol, type = 'bandpass', f = 1200, q = 1, dest = fx) => { const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; b.type = type; b.frequency.value = f; b.Q.value = q; env(g, t, 0.003, vol, dur); s.connect(b); b.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05); };

  // ---- music: F - C - Dm - Bb, bright pop-EDM
  const BPM = 128, S16 = 60 / BPM / 4, CH = [[53, 57, 60, 65], [48, 52, 55, 60], [50, 53, 57, 62], [46, 50, 53, 58]];
  const LEAD = [72, 0, 69, 72, 74, 0, 72, 69, 67, 0, 69, 0, 65, 67, 69, 0];
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function tick() {
    if (!ctx || !musicOn) return;
    while (nextT < ctx.currentTime + 0.12) {
      const t = nextT, s = step % 16, bar = Math.floor(step / 16) % 4, ch = CH[bar], I = intensity;
      if (s % 4 === 0) { osc('sine', 150, t, 0.22, 0.9, 0.3, music); }
      if (s === 4 || s === 12) { nz(t, 0.16, 0.45, 'bandpass', 1800, 0.8, music); osc('triangle', 220, t, 0.08, 0.2, 0.6, music); }
      if (s % 2 === 1) nz(t, 0.04, I > 0.5 ? 0.22 : 0.12, 'highpass', 8000, 1, music);
      if (s % 4 === 2) osc('sawtooth', mf(ch[0] - 12), t, S16 * 1.6, 0.22, 1, music);
      if (s % 4 === 3) osc('square', mf(ch[0] - 24), t, S16 * 0.9, 0.12, 1, music);
      if (s % 2 === 0) osc('triangle', mf(ch[(s / 2) % 4] + 12), t, S16 * 1.4, 0.07 + I * 0.05, 1, music);
      if (s === 0) ch.forEach(m => osc('sawtooth', mf(m), t, S16 * 15, 0.025, 1, music));
      if (I > 0.6 && LEAD[s]) osc('square', mf(LEAD[s] + (bar === 3 ? -2 : 0)), t, S16 * 1.8, 0.06, 1, music);
      nextT += S16; step++;
    }
  }
  return {
    init, get ctx() { return ctx; },
    mute(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
    music(on) { if (!on && !ctx) return; init(); if (!ctx) return; if (on && !musicOn) { musicOn = true; nextT = ctx.currentTime + 0.05; clearInterval(timer); timer = setInterval(tick, 40); } if (!on) { musicOn = false; clearInterval(timer); } },
    intensity(x) { intensity = x; },
    engine(speed, top, throttle, nitro, on = true) {
      if (!eng) return; const t = ctx.currentTime;
      const gears = [0, 0.18, 0.34, 0.5, 0.67, 0.84, 1.2], v = Math.max(0, speed / top); let gi = 0; while (gi < 5 && v > gears[gi + 1]) gi++;
      const r = (v - gears[gi]) / (gears[gi + 1] - gears[gi]), rpm = 0.3 + 0.7 * Math.min(1, r), f = 46 + rpm * 120 + gi * 6 + (nitro ? 18 : 0);
      eng.o1.frequency.setTargetAtTime(f, t, 0.04); eng.o2.frequency.setTargetAtTime(f * 1.505, t, 0.04); eng.o3.frequency.setTargetAtTime(f / 2, t, 0.04);
      eng.lp.frequency.setTargetAtTime(400 + rpm * 1600 * (0.5 + throttle * 0.5) + (nitro ? 900 : 0), t, 0.05);
      eng.g.gain.setTargetAtTime(on ? 0.16 + throttle * 0.08 : 0, t, 0.08);
      return gi + 1;
    },
    skid(a) { if (sq) sq.gain.setTargetAtTime(a * 0.13, ctx.currentTime, 0.05); },
    wind(a) { if (wind) wind.gain.setTargetAtTime(a * 0.14, ctx.currentTime, 0.2); },
    scrape(a) { if (scr) scr.gain.setTargetAtTime(a * 0.22, ctx.currentTime, 0.03); },
    hit(p = 1) { if (!ctx) return; const t = ctx.currentTime; osc('sine', 110, t, 0.3, 0.6 * p, 0.4); nz(t, 0.25, 0.5 * p, 'lowpass', 900); nz(t + 0.02, 0.12, 0.3 * p, 'bandpass', 3000, 2); },
    cone() { if (!ctx) return; const t = ctx.currentTime; osc('triangle', 520, t, 0.12, 0.25, 0.5); nz(t, 0.06, 0.2, 'bandpass', 2400, 3); },
    nitro() { if (!ctx) return; const t = ctx.currentTime; nz(t, 0.7, 0.5, 'bandpass', 600, 0.7); osc('sawtooth', 80, t, 0.6, 0.25, 2.5); },
    beep(hi) { init(); if (!ctx) return; osc('square', hi ? 1320 : 660, ctx.currentTime, hi ? 0.5 : 0.18, 0.22); },
    whoosh() { if (!ctx) return; nz(ctx.currentTime, 0.3, 0.3, 'bandpass', 900, 1.2); },
    pop(i = 0) { if (!ctx) return; const t = ctx.currentTime; osc('triangle', 660 + i * 110, t, 0.1, 0.2, 1.4); },
    cash() { if (!ctx) return; const t = ctx.currentTime; [988, 1318, 1568].forEach((f, i) => osc('square', f, t + i * 0.07, 0.12, 0.12, 1)); },
    win() { if (!ctx) return; const t = ctx.currentTime; [65, 69, 72, 77].forEach((m, i) => osc('triangle', mf(m), t + i * 0.12, 0.35, 0.25, 1)); },
    lose() { if (!ctx) return; const t = ctx.currentTime; [60, 56, 53].forEach((m, i) => osc('triangle', mf(m), t + i * 0.16, 0.35, 0.22, 1)); },
    land() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 90, t, 0.25, 0.6, 0.5); nz(t, 0.15, 0.35, 'lowpass', 600); },
  };
}

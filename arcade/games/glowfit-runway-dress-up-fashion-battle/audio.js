// Glowfit Runway: sounds and a bubbly pop music loop composed in code (no files). Two moods: a soft "closet" loop while
// you style and a bouncier runway beat for the strut and the vote.
let ac = null, master = null, mus = null, fx = null, muted = false, mode = null, step = 0, next = 0, timer = 0, nb = null, paused = false;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination);
    fx = ac.createGain(); fx.gain.value = 0.8; fx.connect(master);
    mus = ac.createGain(); mus.gain.value = 0.26; mus.connect(master);
  }
  if (ac.state === 'suspended' && !paused) ac.resume();
  return ac;
}
export const unlock = () => ctx();
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05); }
export function pauseAll(p) { paused = p; if (!ac) return; if (p) ac.suspend(); else ac.resume(); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function osc(f, dur, { type = 'sine', vol = 0.12, slide = 1, attack = 0.005, at = 0, bus = null, t0 = null } = {}) {
  const a = ctx(); if (!a) return;
  const t = (t0 ?? a.currentTime) + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || fx); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.08, freq = 3000, q = 1, type = 'bandpass', at = 0, slide = 1, bus = null, t0 = null } = {}) {
  const a = ctx(); if (!a) return;
  if (!nb) { nb = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = (t0 ?? a.currentTime) + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nb; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || fx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const bell = (m, at = 0, vol = 0.1, dur = 0.5, t0 = null, bus = null) => { osc(mtof(m), dur, { vol, at, t0, bus }); osc(mtof(m) * 2.005, dur * 0.5, { vol: vol * 0.3, at, t0, bus }); osc(mtof(m) * 4.01, dur * 0.25, { vol: vol * 0.1, at, t0, bus }); };
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];
export const S = {
  tap: () => osc(700, 0.07, { type: 'triangle', vol: 0.07, slide: 1.3 }),
  tab: () => { osc(540, 0.06, { type: 'triangle', vol: 0.06, slide: 1.5 }); },
  pick: (i = 0) => { bell(PENTA[i % PENTA.length], 0, 0.08, 0.4); bell(PENTA[(i + 2) % PENTA.length] + 12, 0.05, 0.04, 0.3); noise(0.1, { vol: 0.025, freq: 7000, type: 'highpass' }); },
  colour: (i = 0) => { osc(mtof(76 + i * 2), 0.12, { type: 'sine', vol: 0.07, slide: 1.12 }); },
  no: () => { osc(260, 0.12, { type: 'square', vol: 0.035, slide: 0.8 }); osc(200, 0.14, { type: 'square', vol: 0.03, slide: 0.8, at: 0.08 }); },
  swish: () => noise(0.24, { vol: 0.05, freq: 900, q: 1.3, slide: 3.5 }),
  whoosh: () => noise(0.5, { vol: 0.07, freq: 400, q: 0.8, slide: 6 }),
  sparkle: () => { for (let i = 0; i < 5; i++) bell(84 + [0, 4, 7, 12, 16][i], i * 0.045, 0.045, 0.3); },
  flash: () => { noise(0.05, { vol: 0.05, freq: 6000, type: 'highpass' }); osc(1800, 0.05, { vol: 0.02, slide: 0.5 }); },
  heart: (i = 0) => osc(mtof(79 + (i % 6) * 2), 0.09, { type: 'sine', vol: 0.05, slide: 1.4 }),
  cheer: (len = 1.4, vol = 0.06) => { noise(len, { vol, freq: 1500, q: 0.5 }); noise(len * 0.8, { vol: vol * 0.6, freq: 3200, q: 0.7, at: 0.1 }); for (let i = 0; i < 6; i++) osc(1200 + Math.random() * 900, 0.18, { type: 'sine', vol: 0.012, slide: 1.6, at: Math.random() * len * 0.6 }); },
  drum: () => { for (let i = 0; i < 10; i++) noise(0.08, { vol: 0.04 + i * 0.006, freq: 300, q: 1, type: 'lowpass', at: i * 0.11 }); },
  rank: (p) => { const m = [72, 67, 64, 60][p] || 60; bell(m, 0, 0.1, 0.5); bell(m + 7, 0.08, 0.06, 0.5); },
  win: () => { [72, 76, 79, 84, 88].forEach((m, i) => bell(m, i * 0.09, 0.11, 0.7)); osc(mtof(48), 0.6, { type: 'triangle', vol: 0.08 }); },
  lose: () => { [67, 64, 60].forEach((m, i) => bell(m, i * 0.16, 0.08, 0.6)); },
  star: (i) => { bell(84 + i * 4, 0, 0.1, 0.6); noise(0.15, { vol: 0.03, freq: 8000, type: 'highpass' }); },
  coin: (i = 0) => { osc(mtof(88 + (i % 3) * 2), 0.07, { type: 'square', vol: 0.025 }); osc(mtof(95 + (i % 3) * 2), 0.12, { type: 'square', vol: 0.02, at: 0.05 }); },
  sticker: () => { osc(300, 0.12, { type: 'triangle', vol: 0.08, slide: 2.5 }); bell(88, 0.1, 0.08, 0.4); },
  unlock: () => { [79, 83, 86, 91].forEach((m, i) => bell(m, i * 0.06, 0.08, 0.5)); },
};

// ---------------------------------------------------------------- music: two loops (C major pop, 4 chords)
const CH = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];   // Cmaj7 Am7 Fmaj7 G7
const MEL = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 83, 81, 79, 76, -1];
function tick() {
  if (!ac || !mode) return;
  const spb = mode === 'run' ? 60 / 118 / 2 : 60 / 96 / 2;   // 8th notes
  while (next < ac.currentTime + 0.25) {
    const t0 = next, bar = Math.floor(step / 8) % 4, s8 = step % 8, ch = CH[bar];
    if (mode === 'run') {
      if (s8 % 2 === 0) { osc(110, 0.16, { type: 'sine', vol: 0.22, slide: 0.35, t0, bus: mus }); }
      if (s8 % 4 === 2) noise(0.12, { vol: 0.07, freq: 2200, q: 0.8, t0, bus: mus });
      noise(0.04, { vol: 0.03, freq: 9000, type: 'highpass', t0, bus: mus });
      osc(mtof(ch[0] - 24), spb * 0.9, { type: 'triangle', vol: 0.12, t0, bus: mus });
      if (s8 === 0 || s8 === 3 || s8 === 6) ch.forEach(m => osc(mtof(m), spb * 1.4, { type: 'sawtooth', vol: 0.012, attack: 0.02, t0, bus: mus }));
      const m = MEL[(step) % 16]; if (m > 0 && step % 2 === 0) bell(m, 0, 0.045, 0.3, t0, mus);
    } else {
      if (s8 === 0) osc(mtof(ch[0] - 24), spb * 6, { type: 'triangle', vol: 0.1, attack: 0.03, t0, bus: mus });
      if (s8 % 2 === 0) bell(ch[(s8 / 2) % 4] + 12, 0, 0.035, 0.5, t0, mus);
      if (s8 === 4) noise(0.06, { vol: 0.02, freq: 6000, type: 'highpass', t0, bus: mus });
      const m = MEL[(step >> 1) % 16]; if (s8 % 4 === 0 && m > 0) bell(m, 0, 0.03, 0.6, t0, mus);
    }
    next += spb; step++;
  }
}
export function music(m) {
  if (!ctx()) return; if (m === mode) return;
  mode = m; step = 0; next = ac.currentTime + 0.05;
  clearInterval(timer); if (m) timer = setInterval(tick, 80);
}

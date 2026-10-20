// Strut Off — sound design and two music loops composed in code (no files): a mellow lounge loop for the atelier and a
// bouncy disco-house beat for the runway.
let ac = null, master = null, musicBus = null, sfxBus = null, muted = false, mode = null, mTimer = 0, mStep = 0, mNext = 0, noiseBuf = null;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export function unlock() { ctx(); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function nbuf() { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function osc(f, dur, { type = 'sine', vol = 0.15, slide = 1, attack = 0.005, at = 0, bus = null, t0 = null } = {}) {
  const a = ctx(); if (!a) return;
  const t = (t0 ?? a.currentTime) + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.1, freq = 2000, q = 1, type = 'bandpass', at = 0, slide = 1, bus = null, t0 = null } = {}) {
  const a = ctx(); if (!a) return;
  const t = (t0 ?? a.currentTime) + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nbuf(); s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function bell(m, at = 0, vol = 0.12, dur = 0.6) { osc(mtof(m), dur, { vol, at }); osc(mtof(m) * 2.01, dur * 0.6, { vol: vol * 0.35, at }); osc(mtof(m) * 3.98, dur * 0.3, { vol: vol * 0.12, at }); }

export const S = {
  tap: () => osc(660, 0.07, { type: 'triangle', vol: 0.08, slide: 1.25 }),
  tab: () => { osc(520, 0.06, { type: 'triangle', vol: 0.07, slide: 1.4 }); },
  pick: (i = 0) => { bell(79 + (i % 5) * 2, 0, 0.08, 0.35); noise(0.12, { vol: 0.03, freq: 5000, type: 'highpass' }); },
  swish: () => noise(0.22, { vol: 0.06, freq: 900, q: 1.4, slide: 3.5 }),
  no: () => { osc(330, 0.08, { type: 'triangle', vol: 0.07 }); osc(262, 0.12, { type: 'triangle', vol: 0.07, at: 0.08 }); },
  shutter: () => { noise(0.04, { vol: 0.12, freq: 3000, q: 0.8 }); noise(0.06, { vol: 0.08, freq: 1800, q: 1, at: 0.05 }); osc(2400, 0.03, { type: 'square', vol: 0.02, at: 0.01 }); },
  flashes: (n = 5) => { for (let i = 0; i < n; i++) { noise(0.035, { vol: 0.08, freq: 2600 + Math.random() * 1500, q: 0.9, at: i * 0.07 + Math.random() * 0.03 }); } },
  pose: (q = 0) => { [72, 76, 79, 84].slice(0, 2 + q).forEach((m, i) => bell(m + 2, i * 0.06, 0.09, 0.6)); noise(0.5, { vol: 0.04, freq: 6000, type: 'highpass', at: 0.05 }); },
  miss: () => { osc(300, 0.18, { type: 'triangle', vol: 0.07, slide: 0.7 }); },
  heart: (i = 0) => { const m = 84 + [0, 2, 4, 7, 9, 12][i % 6]; osc(mtof(m), 0.09, { type: 'sine', vol: 0.05 }); osc(mtof(m) * 2, 0.05, { type: 'sine', vol: 0.015 }); },
  crowd: (dur = 1.6, vol = 0.07) => { noise(dur, { vol, freq: 1200, q: 0.6 }); noise(dur * 0.8, { vol: vol * 0.6, freq: 2600, q: 0.9, at: 0.1 }); for (let i = 0; i < 10; i++) noise(0.03, { vol: vol * 0.8, freq: 1800 + Math.random() * 1200, q: 2, at: Math.random() * dur * 0.8 }); },
  drum: () => { for (let i = 0; i < 14; i++) noise(0.06, { vol: 0.03 + i * 0.004, freq: 220, q: 1.2, at: i * 0.08 }); },
  rank: (place) => { const base = [84, 79, 76, 72][place] || 72; [0, 4, 7].forEach((d, i) => bell(base + d, i * 0.05, 0.09, 0.5)); },
  win: () => [72, 76, 79, 84, 88].forEach((m, i) => { bell(m, i * 0.11, 0.1, 0.9); osc(mtof(m - 24), 0.4, { type: 'triangle', vol: 0.04, at: i * 0.11 }); }),
  lose: () => [67, 64, 60, 55].forEach((m, i) => osc(mtof(m), 0.4, { type: 'triangle', vol: 0.07, at: i * 0.16 })),
  star: (i = 0) => { bell(84 + i * 4, 0, 0.11, 0.8); bell(96 + i * 4, 0.03, 0.04, 0.5); },
  buy: () => { [79, 84, 88, 91].forEach((m, i) => bell(m, i * 0.06, 0.08, 0.4)); noise(0.3, { vol: 0.03, freq: 7000, type: 'highpass', at: 0.2 }); },
  unlock: () => { [76, 81, 84, 88, 93].forEach((m, i) => bell(m, i * 0.07, 0.08, 0.6)); },
  tip: () => { osc(300, 0.5, { vol: 0.08, slide: 3 }); [84, 88, 91, 96].forEach((m, i) => bell(m, 0.1 + i * 0.05, 0.06, 0.4)); },
  whoosh: () => noise(0.35, { vol: 0.06, freq: 500, q: 1, slide: 4 }),
  gem: (i = 0) => { const b = 91 + (i % 5); osc(mtof(b), 0.07, { type: 'square', vol: 0.02 }); bell(b + 12, 0.05, 0.04, 0.3); },
};

// ---------------------------------------------------------------- music
const LOUNGE = { bpm: 92, ch: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], mel: [[76, -1, 74, 72, -1, 69, -1, -1], [72, -1, 74, -1, 76, 77, -1, -1], [74, -1, 71, -1, 67, -1, 71, 72], [71, -1, -1, -1, 64, -1, 67, -1]] };
const HOUSE = { bpm: 118, ch: [[60, 63, 67, 70], [56, 60, 63, 67], [58, 62, 65, 68], [55, 58, 62, 65]], bass: [36, 32, 34, 31] };
function ep(m, t, dur, vol) {
  const f = mtof(m), g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [mul, ty, v] of [[1, 'sine', 1], [2, 'sine', 0.25], [4, 'triangle', 0.04]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = ty; o.frequency.value = f * mul; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); }
  g.connect(musicBus);
}
function schedule() {
  if (!ac || !mode) return;
  if (mode === 'dress') {
    const E = 60 / LOUNGE.bpm / 2;
    while (mNext < ac.currentTime + 0.25) {
      const bar = Math.floor(mStep / 8) % 4, s = mStep % 8, ch = LOUNGE.ch[bar], t = mNext;
      if (s === 0) ch.forEach((m, i) => ep(m, t + i * 0.015, E * 7, 0.045));
      if (s === 3 || s === 6) ch.slice(1).forEach(m => ep(m + 12, t, E * 1.4, 0.02));
      if (s === 0 || s === 4) osc(mtof(ch[0] - 24 + (s === 4 ? 7 : 0)), E * 3, { type: 'triangle', vol: 0.1, bus: musicBus, t0: t });
      if (s % 2 === 1) noise(0.05, { vol: 0.02, freq: 8000, type: 'highpass', bus: musicBus, t0: t });
      const mel = LOUNGE.mel[bar][s]; if (mel > 0 && Math.floor(mStep / 32) % 2 === 1) ep(mel, t, E * 2.2, 0.035);
      mStep++; mNext += E * (s % 2 === 0 ? 1.1 : 0.9);
    }
  } else {
    const SX = 60 / HOUSE.bpm / 4;
    while (mNext < ac.currentTime + 0.25) {
      const bar = Math.floor(mStep / 16) % 4, s = mStep % 16, t = mNext, ch = HOUSE.ch[bar];
      if (s % 4 === 0) osc(150, 0.28, { vol: 0.32, slide: 0.28, bus: musicBus, t0: t });                       // kick
      if (s === 4 || s === 12) noise(0.16, { vol: 0.07, freq: 1700, q: 0.7, bus: musicBus, t0: t });          // clap
      if (s % 4 === 2) noise(0.06, { vol: 0.045, freq: 9000, type: 'highpass', bus: musicBus, t0: t });        // open hat
      else if (s % 2 === 1) noise(0.025, { vol: 0.02, freq: 10000, type: 'highpass', bus: musicBus, t0: t });
      if ([0, 3, 6, 10, 11, 14].includes(s)) osc(mtof(HOUSE.bass[bar] + (s === 11 ? 12 : 0)), SX * 1.6, { type: 'sawtooth', vol: 0.05, bus: musicBus, t0: t });
      if ([2, 6, 9, 14].includes(s)) ch.forEach(m => ep(m + 12, t, SX * 1.5, 0.022));
      if (s === 0 && bar % 2 === 0) ep(ch[3] + 24, t, SX * 6, 0.02);
      mStep++; mNext += SX;
    }
  }
}
export function music(m) {
  if (m === mode) return; mode = m;
  const a = ctx(); if (!a) return;
  clearInterval(mTimer);
  if (m) { mNext = a.currentTime + 0.08; mStep = 0; mTimer = setInterval(schedule, 80); }
}
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

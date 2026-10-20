// Honeyfield Farm — soft, warm farm sounds and a gentle folk loop, all synthesised in code (no files).
let ac = null, master = null, musicBus = null, sfxBus = null, muted = false, musicOn = false, mTimer = 0, mStep = 0, mNext = 0, noiseBuf = null;
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

function osc(f, dur, { type = 'sine', vol = 0.15, slide = 1, attack = 0.005, at = 0, bus = null, vib = 0 } = {}) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  if (vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = vib; lg.gain.value = f * 0.04; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
function nbuf(a) { if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function noise(dur, { vol = 0.1, freq = 2000, q = 1, type = 'bandpass', at = 0, slide = 1, attack = 0.02 } = {}) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nbuf(a); s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function bell(m, at = 0, vol = 0.12, dur = 0.6) { osc(mtof(m), dur, { vol, at }); osc(mtof(m) * 2.01, dur * 0.6, { vol: vol * 0.35, at }); osc(mtof(m) * 3.98, dur * 0.3, { vol: vol * 0.12, at }); }
// plucked string (a soft banjo/guitar): short triangle + a bright partial with a fast decay
function pluck(m, at = 0, vol = 0.08, dur = 0.5, bus = null) { osc(mtof(m), dur, { type: 'triangle', vol, at, bus }); osc(mtof(m) * 2, dur * 0.35, { type: 'sine', vol: vol * 0.4, at, bus }); osc(mtof(m) * 3, dur * 0.15, { type: 'sine', vol: vol * 0.18, at, bus }); }

export const S = {
  tap: () => osc(660, 0.07, { type: 'triangle', vol: 0.08, slide: 1.25 }),
  pop: (i = 0) => { osc(420 + i * 40, 0.09, { vol: 0.15, slide: 2.2 }); osc(900 + i * 60, 0.05, { type: 'triangle', vol: 0.05, at: 0.02 }); },
  plant: () => { noise(0.14, { vol: 0.09, freq: 380, q: 0.8, type: 'lowpass' }); osc(150, 0.12, { type: 'sine', vol: 0.12, slide: 0.6 }); },
  harvest: (i = 0) => { noise(0.16, { vol: 0.06, freq: 3800, q: 1.5, slide: 0.5, attack: 0.005 }); pluck(79 + (i % 4) * 2, 0.04, 0.06, 0.3); },
  collect: (i = 0) => { pluck(84 + (i % 5) * 2, 0, 0.07, 0.35); bell(96 + (i % 5) * 2, 0.04, 0.03, 0.3); },
  cluck: () => { for (let i = 0; i < 3; i++) osc(700 + Math.random() * 200, 0.07, { type: 'square', vol: 0.025, slide: 0.55, at: i * 0.09 }); },
  moo: () => { osc(140, 0.75, { type: 'sawtooth', vol: 0.035, slide: 0.8, attack: 0.12, vib: 5 }); osc(280, 0.7, { type: 'sine', vol: 0.02, slide: 0.8, attack: 0.12 }); },
  baa: () => { osc(420, 0.45, { type: 'sawtooth', vol: 0.025, slide: 0.9, attack: 0.03, vib: 11 }); },
  buzz: () => osc(220, 0.5, { type: 'sawtooth', vol: 0.012, vib: 30, attack: 0.1 }),
  mill: () => { noise(0.8, { vol: 0.04, freq: 500, q: 1.5, slide: 1.4 }); osc(110, 0.6, { type: 'triangle', vol: 0.03 }); },
  oven: () => { noise(0.7, { vol: 0.035, freq: 900, q: 0.6, type: 'lowpass', attack: 0.15 }); bell(88, 0.1, 0.03, 0.4); },
  ding: () => bell(88, 0, 0.09, 0.7),
  whoosh: () => noise(0.25, { vol: 0.05, freq: 600, q: 1.2, slide: 3 }),
  honk: () => { osc(330, 0.18, { type: 'square', vol: 0.035 }); osc(392, 0.18, { type: 'square', vol: 0.03 }); osc(330, 0.22, { type: 'square', vol: 0.035, at: 0.24 }); osc(392, 0.22, { type: 'square', vol: 0.03, at: 0.24 }); },
  engine: () => { osc(70, 1.3, { type: 'sawtooth', vol: 0.03, slide: 1.8, attack: 0.1 }); noise(1.2, { vol: 0.02, freq: 300, q: 1, slide: 1.6 }); },
  coin: (i = 0) => { const b = 93 + (i % 5); osc(mtof(b), 0.08, { type: 'square', vol: 0.022 }); osc(mtof(b + 5), 0.18, { type: 'square', vol: 0.022, at: 0.06 }); bell(b + 12, 0.06, 0.04, 0.3); },
  ship: () => [72, 76, 79, 84].forEach((m, i) => bell(m, i * 0.07, 0.08, 0.5)),
  no: () => { osc(330, 0.08, { type: 'triangle', vol: 0.07 }); osc(262, 0.12, { type: 'triangle', vol: 0.07, at: 0.08 }); },
  buy: () => { [79, 84, 88, 91].forEach((m, i) => bell(m, i * 0.06, 0.08, 0.4)); noise(0.3, { vol: 0.03, freq: 7000, type: 'highpass', at: 0.2 }); },
  star: (i = 0) => { bell(84 + i * 4, 0, 0.11, 0.8); bell(96 + i * 4, 0.03, 0.04, 0.5); },
  win: () => [72, 76, 79, 84, 88].forEach((m, i) => { bell(m, i * 0.11, 0.1, 0.9); pluck(m - 24, i * 0.11, 0.06, 0.5); }),
  lose: () => [67, 64, 60, 55].forEach((m, i) => osc(mtof(m), 0.4, { type: 'triangle', vol: 0.07, at: i * 0.16 })),
  boost: () => { osc(300, 0.5, { vol: 0.08, slide: 3 }); [84, 88, 91, 96].forEach((m, i) => bell(m, 0.1 + i * 0.05, 0.06, 0.4)); },
  rain: () => { for (let i = 0; i < 10; i++) noise(0.12, { vol: 0.03, freq: 4000 + Math.random() * 3000, q: 4, at: i * 0.07 }); },
  rooster: () => { osc(520, 0.16, { type: 'sawtooth', vol: 0.03, slide: 1.3 }); osc(700, 0.5, { type: 'sawtooth', vol: 0.03, slide: 0.75, at: 0.17, vib: 9 }); },
};

// ---------------------------------------------------------------- music: an easy-going folk loop in G (G C D G / Em C D G)
const CH = [[55, 59, 62], [48, 52, 55], [50, 54, 57], [55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57], [55, 59, 62]];
const MEL = [[71, -1, 74, 71, 67, -1, 69, 71], [72, -1, 71, 69, 67, -1, -1, -1], [69, -1, 71, 72, 74, -1, 72, 71], [71, -1, 69, -1, 67, -1, -1, -1],
  [71, 72, 74, -1, 76, -1, 74, 71], [72, -1, 76, -1, 74, 72, 71, -1], [69, -1, 67, 69, 71, -1, 72, 74], [74, -1, 71, -1, 67, -1, -1, -1]];
const BPM = 104, EIGHTH = 60 / BPM / 2;
function schedule() {
  if (!ac || !musicOn) return;
  while (mNext < ac.currentTime + 0.25) {
    const bar = Math.floor(mStep / 8) % 8, s = mStep % 8, ch = CH[bar], t = Math.max(0, mNext - ac.currentTime);
    // boom-chick: bass on 1 and 5, strum on the off beats
    if (s === 0 || s === 4) pluck((s === 0 ? ch[0] : ch[0] + 7) - 12, t, 0.09, EIGHTH * 3, musicBus);
    if (s === 2 || s === 6) ch.forEach((m, i) => pluck(m + 12, t + i * 0.015, 0.025, EIGHTH * 1.6, musicBus));
    const mel = MEL[bar][s]; if (mel > 0 && Math.floor(mStep / 64) % 2 === 1) pluck(mel + 12, t, 0.04, EIGHTH * 2.4, musicBus);
    mStep++; mNext += EIGHTH * (s % 2 === 0 ? 1.1 : 0.9);
  }
}
export function music(on) {
  if (on === musicOn) return; musicOn = on;
  const a = ctx(); if (!a) return;
  if (on) { mNext = a.currentTime + 0.1; clearInterval(mTimer); mTimer = setInterval(schedule, 90); }
  else clearInterval(mTimer);
}
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

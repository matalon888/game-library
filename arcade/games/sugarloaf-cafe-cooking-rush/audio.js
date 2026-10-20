// Sugarloaf Café — soft, warm sound design and a gentle café music loop, all synthesised (no files).
let ac = null, master = null, musicBus = null, sfxBus = null, muted = false, musicOn = false, mTimer = 0, mStep = 0, mNext = 0;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export const isMuted = () => muted;
export function unlock() { ctx(); }

function osc(f, dur, { type = 'sine', vol = 0.15, slide = 1, attack = 0.005, at = 0, bus = null, detune = 0 } = {}) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(dur, { vol = 0.1, freq = 2000, q = 1, type = 'bandpass', at = 0, slide = 1 } = {}) {
  const a = ctx(); if (!a) return;
  if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function bell(m, at = 0, vol = 0.12, dur = 0.6) { osc(mtof(m), dur, { type: 'sine', vol, at }); osc(mtof(m) * 2.01, dur * 0.6, { type: 'sine', vol: vol * 0.35, at }); osc(mtof(m) * 3.98, dur * 0.3, { type: 'sine', vol: vol * 0.12, at }); }

export const S = {
  tap: () => osc(660, 0.07, { type: 'triangle', vol: 0.09, slide: 1.25 }),
  pop: (i = 0) => { osc(420 + i * 40, 0.09, { type: 'sine', vol: 0.16, slide: 2.2 }); osc(900 + i * 60, 0.05, { type: 'triangle', vol: 0.05, at: 0.02 }); },
  start: () => { noise(0.25, { vol: 0.03, freq: 900, slide: 2 }); osc(300, 0.18, { type: 'triangle', vol: 0.06, slide: 1.5 }); },
  pour: () => { noise(1.1, { vol: 0.05, freq: 1400, q: 3, slide: 0.6 }); noise(0.6, { vol: 0.03, freq: 3200, q: 6, at: 0.3 }); },
  steam: () => noise(0.9, { vol: 0.05, freq: 5000, q: 0.7, type: 'highpass', slide: 0.8 }),
  sizzle: () => { for (let i = 0; i < 4; i++) noise(0.5, { vol: 0.025, freq: 6000, q: 0.5, type: 'highpass', at: i * 0.35 }); },
  whirr: () => { osc(140, 1.0, { type: 'sawtooth', vol: 0.025, slide: 1.4 }); noise(1.0, { vol: 0.03, freq: 700, q: 2 }); },
  press: () => { osc(160, 0.15, { type: 'square', vol: 0.04, slide: 0.6 }); noise(0.5, { vol: 0.025, freq: 5000, type: 'highpass', at: 0.1 }); },
  ding: () => { bell(88, 0, 0.1, 0.7); },
  whoosh: () => noise(0.25, { vol: 0.05, freq: 600, q: 1.2, slide: 3 }),
  serve: () => { bell(84, 0, 0.09, 0.4); bell(91, 0.07, 0.07, 0.5); },
  coin: (i = 0) => { const b = 93 + (i % 5); osc(mtof(b), 0.08, { type: 'square', vol: 0.025 }); osc(mtof(b + 5), 0.18, { type: 'square', vol: 0.025, at: 0.06 }); bell(b + 12, 0.06, 0.04, 0.3); },
  cheer: () => [72, 76, 79, 84].forEach((m, i) => bell(m, i * 0.07, 0.08, 0.5)),
  combo: (n = 2) => [0, 4, 7, 12].forEach((d, i) => bell(76 + Math.min(n, 8) + d, i * 0.05, 0.07, 0.35)),
  angry: () => { osc(220, 0.25, { type: 'triangle', vol: 0.08, slide: 0.7 }); osc(180, 0.35, { type: 'triangle', vol: 0.07, slide: 0.7, at: 0.15 }); },
  bell: () => { bell(96, 0, 0.06, 1.2); bell(91, 0.12, 0.05, 1.2); },
  no: () => { osc(330, 0.08, { type: 'triangle', vol: 0.07 }); osc(262, 0.12, { type: 'triangle', vol: 0.07, at: 0.08 }); },
  buy: () => { [79, 84, 88, 91].forEach((m, i) => bell(m, i * 0.06, 0.08, 0.4)); noise(0.3, { vol: 0.03, freq: 7000, type: 'highpass', at: 0.2 }); },
  star: (i = 0) => { bell(84 + i * 4, 0, 0.11, 0.8); bell(96 + i * 4, 0.03, 0.04, 0.5); },
  win: () => [72, 76, 79, 84, 88].forEach((m, i) => { bell(m, i * 0.11, 0.1, 0.9); osc(mtof(m - 24), 0.4, { type: 'triangle', vol: 0.04, at: i * 0.11 }); }),
  lose: () => [67, 64, 60, 55].forEach((m, i) => osc(mtof(m), 0.4, { type: 'triangle', vol: 0.07, at: i * 0.16 })),
  boost: () => { osc(300, 0.5, { type: 'sine', vol: 0.08, slide: 3 }); [84, 88, 91, 96].forEach((m, i) => bell(m, 0.1 + i * 0.05, 0.06, 0.4)); },
};

// ---------------------------------------------------------------- music: a slow bossa-ish loop in F (Fmaj7 Dm7 Gm7 C7)
const CH = [[53, 57, 60, 64], [50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58]];
const MEL = [[76, -1, 77, 76, 72, -1, 69, -1], [74, -1, 72, -1, 69, 72, -1, -1], [70, -1, 72, 74, 77, -1, 74, -1], [72, -1, 70, 67, 64, -1, -1, -1],
  [76, 77, 79, -1, 81, -1, 79, 77], [77, -1, 74, -1, 72, -1, 69, -1], [70, 74, 77, -1, 76, -1, 74, -1], [72, -1, -1, -1, 67, -1, 70, -1]];
const BPM = 96, EIGHTH = 60 / BPM / 2;
function epiano(m, t, dur, vol) {
  const a = ac, f = mtof(m), g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [mul, ty, v] of [[1, 'sine', 1], [2, 'sine', 0.25], [4, 'triangle', 0.04]]) { const o = a.createOscillator(), og = a.createGain(); o.type = ty; o.frequency.value = f * mul; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); }
  g.connect(musicBus);
}
function schedule() {
  if (!ac || !musicOn) return;
  while (mNext < ac.currentTime + 0.25) {
    const bar = Math.floor(mStep / 8) % 8, s = mStep % 8, ch = CH[bar % 4], t = mNext;
    if (s === 0) ch.forEach((m, i) => epiano(m, t + i * 0.012, EIGHTH * 7, 0.05));
    if (s === 3 || s === 6) ch.slice(1).forEach(m => epiano(m + 12, t, EIGHTH * 1.6, 0.025));
    if (s === 0 || s === 5) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = mtof(ch[0] - 12 + (s === 5 ? 7 : 0)); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + EIGHTH * 2.5); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + EIGHTH * 3); }
    if (s % 2 === 1) { // shaker
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      src.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(f); f.connect(g); g.connect(musicBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.08);
    }
    const mel = MEL[bar][s]; if (mel > 0 && Math.floor(mStep / 64) % 2 === 1) epiano(mel, t, EIGHTH * 2.2, 0.04);
    mStep++; mNext += EIGHTH * (s % 2 === 0 ? 1.08 : 0.92);   // a little swing
  }
}
export function music(on) {
  if (on === musicOn) return; musicOn = on;
  const a = ctx(); if (!a) return;
  if (on) { mNext = a.currentTime + 0.1; clearInterval(mTimer); mTimer = setInterval(schedule, 90); }
  else clearInterval(mTimer);
}
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

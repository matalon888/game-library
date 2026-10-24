// Dumpling Dash — bright, bubbly sound design and a kawaii pop music loop, all synthesised (no files).
let ac = null, master = null, musicBus = null, sfxBus = null, muted = false, musicOn = false, mTimer = 0, mStep = 0, mNext = 0, adPause = false;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.26; musicBus.connect(master);
  }
  if (ac.state === 'suspended' && !adPause && !document.hidden) ac.resume();
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export function unlock() { ctx(); }
export function adPaused(on) { adPause = on; if (!ac) return; if (on) ac.suspend(); else if (!document.hidden) ac.resume(); }

function osc(f, dur, { type = 'sine', vol = 0.15, slide = 1, attack = 0.005, at = 0, bus = null } = {}) {
  const a = ctx(); if (!a || adPause) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function nbuf(a) { if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function noise(dur, { vol = 0.1, freq = 2000, q = 1, type = 'bandpass', at = 0, slide = 1 } = {}) {
  const a = ctx(); if (!a || adPause) return;
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nbuf(a); s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide !== 1) f.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function bell(m, at = 0, vol = 0.12, dur = 0.6) { osc(mtof(m), dur, { vol, at }); osc(mtof(m) * 2.01, dur * 0.6, { vol: vol * 0.35, at }); osc(mtof(m) * 3.98, dur * 0.3, { vol: vol * 0.12, at }); }
function boing(f = 300, at = 0, vol = 0.12) { osc(f, 0.18, { type: 'sine', vol, slide: 2.4, at }); osc(f * 1.5, 0.12, { type: 'triangle', vol: vol * 0.3, slide: 2, at: at + 0.02 }); }

export const S = {
  tap: () => boing(520, 0, 0.08),
  pop: (i = 0) => { osc(460 + i * 50, 0.09, { vol: 0.16, slide: 2.4 }); osc(980 + i * 60, 0.05, { type: 'triangle', vol: 0.05, at: 0.02 }); },
  plate: () => { bell(91, 0, 0.06, 0.25); osc(700, 0.06, { type: 'triangle', vol: 0.05 }); },
  top: () => { boing(640, 0, 0.09); bell(96, 0.05, 0.05, 0.3); },
  pour: () => { noise(0.8, { vol: 0.05, freq: 1400, q: 3, slide: 0.6 }); for (let i = 0; i < 4; i++) osc(500 + i * 90, 0.07, { vol: 0.04, slide: 1.8, at: 0.1 + i * 0.12 }); },
  steam: () => noise(0.9, { vol: 0.05, freq: 5000, q: 0.7, type: 'highpass', slide: 0.8 }),
  sizzle: () => { for (let i = 0; i < 4; i++) noise(0.45, { vol: 0.025, freq: 6000, q: 0.5, type: 'highpass', at: i * 0.3 }); },
  whirr: () => { osc(220, 0.8, { type: 'triangle', vol: 0.04, slide: 1.6 }); noise(0.8, { vol: 0.025, freq: 900, q: 2 }); },
  bubble: () => { for (let i = 0; i < 6; i++) osc(300 + Math.random() * 300, 0.06, { vol: 0.05, slide: 1.9, at: i * 0.11 }); },
  chop: () => { for (let i = 0; i < 3; i++) { noise(0.05, { vol: 0.08, freq: 2500, q: 2, at: i * 0.14 }); osc(180, 0.05, { type: 'square', vol: 0.03, at: i * 0.14 }); } },
  ding: () => { bell(93, 0, 0.1, 0.6); bell(100, 0.06, 0.05, 0.5); },
  whoosh: () => noise(0.22, { vol: 0.05, freq: 700, q: 1.2, slide: 3 }),
  serve: () => { bell(86, 0, 0.09, 0.4); bell(93, 0.07, 0.07, 0.5); },
  coin: (i = 0) => { const b = 95 + (i % 5); osc(mtof(b), 0.07, { type: 'square', vol: 0.02 }); osc(mtof(b + 5), 0.16, { type: 'square', vol: 0.02, at: 0.05 }); bell(b + 12, 0.05, 0.035, 0.3); },
  combo: (n = 2) => [0, 4, 7, 12].forEach((d, i) => bell(79 + Math.min(n, 8) + d, i * 0.05, 0.07, 0.35)),
  angry: () => { osc(260, 0.22, { type: 'triangle', vol: 0.08, slide: 0.7 }); osc(200, 0.3, { type: 'triangle', vol: 0.07, slide: 0.7, at: 0.14 }); },
  bell: () => { bell(98, 0, 0.06, 1.0); bell(93, 0.12, 0.05, 1.0); },
  no: () => { osc(360, 0.08, { type: 'triangle', vol: 0.07 }); osc(290, 0.1, { type: 'triangle', vol: 0.07, at: 0.08 }); },
  toss: () => { noise(0.3, { vol: 0.06, freq: 900, slide: 0.3 }); osc(400, 0.25, { vol: 0.06, slide: 0.4 }); },
  buy: () => { [81, 86, 89, 93].forEach((m, i) => bell(m, i * 0.06, 0.08, 0.4)); noise(0.3, { vol: 0.03, freq: 7000, type: 'highpass', at: 0.2 }); },
  sticker: () => { [88, 93, 97, 100, 105].forEach((m, i) => bell(m, i * 0.05, 0.07, 0.5)); boing(420, 0, 0.08); },
  star: (i = 0) => { bell(86 + i * 4, 0, 0.11, 0.8); bell(98 + i * 4, 0.03, 0.04, 0.5); },
  win: () => [74, 78, 81, 86, 90].forEach((m, i) => { bell(m, i * 0.1, 0.1, 0.9); osc(mtof(m - 24), 0.4, { type: 'triangle', vol: 0.04, at: i * 0.1 }); }),
  lose: () => [69, 66, 62, 57].forEach((m, i) => osc(mtof(m), 0.4, { type: 'triangle', vol: 0.07, at: i * 0.16 })),
  boost: () => { osc(320, 0.5, { vol: 0.08, slide: 3 }); [86, 90, 93, 98].forEach((m, i) => bell(m, 0.1 + i * 0.05, 0.06, 0.4)); },
  start: () => [79, 83, 86].forEach((m, i) => bell(m, i * 0.08, 0.07, 0.4)),
};

// ---------------------------------------------------------------- music: a bouncy kawaii-pop loop in D (D Bm G A) with a music-box lead
const CH = [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]];
const MEL = [[78, -1, 81, 78, 76, -1, 74, -1], [74, 76, 78, -1, 71, -1, -1, -1], [79, -1, 78, 76, 74, -1, 76, 78], [76, -1, -1, 73, 76, -1, -1, -1],
  [81, -1, 83, 81, 78, -1, 76, 78], [78, -1, 74, -1, 71, 74, 78, -1], [79, 78, 76, -1, 74, -1, 79, -1], [81, -1, 78, -1, 76, -1, -1, -1]];
const BPM = 116, EIGHTH = 60 / BPM / 2;
function pluck(m, t, dur, vol, bus = musicBus) {
  const a = ac, f = mtof(m), g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [mul, ty, v] of [[1, 'sine', 1], [2, 'sine', 0.3], [3, 'triangle', 0.08]]) { const o = a.createOscillator(), og = a.createGain(); o.type = ty; o.frequency.value = f * mul; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); }
  g.connect(bus);
}
function schedule() {
  if (!ac || !musicOn || adPause) return;
  while (mNext < ac.currentTime + 0.25) {
    const bar = Math.floor(mStep / 8) % 8, s = mStep % 8, ch = CH[bar % 4], t = mNext;
    if (s === 0 || s === 4) ch.forEach((m, i) => pluck(m, t + i * 0.01, EIGHTH * 3, 0.03));
    if (s === 2 || s === 6) ch.forEach(m => pluck(m + 12, t, EIGHTH * 1.2, 0.018));
    if (s % 2 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = mtof(ch[0] - 24 + (s === 4 ? 7 : 0)); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + EIGHTH * 1.6); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + EIGHTH * 2); }
    if (s === 0 || s === 4) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2); }
    if (s === 2 || s === 6) { const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = nbuf(ac); f.type = 'bandpass'; f.frequency.value = 2200; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); src.connect(f); f.connect(g); g.connect(musicBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.12); }
    if (s % 2 === 1) { const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = nbuf(ac); f.type = 'highpass'; f.frequency.value = 8000; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); src.connect(f); f.connect(g); g.connect(musicBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.06); }
    const mel = MEL[bar][s]; if (mel > 0 && Math.floor(mStep / 64) % 2 === 1) pluck(mel, t, EIGHTH * 2.4, 0.045);
    mStep++; mNext += EIGHTH;
  }
}
export function music(on) {
  if (on === musicOn) return; musicOn = on;
  const a = ctx(); if (!a) return;
  if (on) { mNext = a.currentTime + 0.1; clearInterval(mTimer); mTimer = setInterval(schedule, 90); }
  else clearInterval(mTimer);
}
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else if (!adPause) ac.resume(); });

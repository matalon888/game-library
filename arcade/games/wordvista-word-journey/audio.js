// audio.js — Wordvista sound, all synthesised (our own code, MIT): soft marimba plucks that climb a pentatonic scale as
// you link letters, a bell chord for a found word, coin chimes, and a gentle music-box loop composed in code.
let ctx = null, master = null, musicBus = null, sfxBus = null, muted = false, musicOn = false, musicTimer = 0;
try { muted = localStorage.getItem('wordvista_mute') === '1'; } catch (e) {}

function ac() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    // a small feedback echo gives the bells some air
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    dl.delayTime.value = 0.23; fb.gain.value = 0.28; wet.gain.value = 0.22;
    sfxBus.connect(dl); musicBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
  } catch (e) { ctx = null; }
  return ctx;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function pluck(midi, { t = 0, dur = 0.5, vol = 0.2, bus = 'sfx', type = 'marimba' } = {}) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, f = hz(midi), g = c.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, n + dur);
  g.connect(bus === 'music' ? musicBus : sfxBus);
  const parts = type === 'bell' ? [[1, 'sine', 1], [2.76, 'sine', 0.32], [5.4, 'sine', 0.12], [2, 'triangle', 0.18]]
    : type === 'box' ? [[1, 'triangle', 1], [2, 'sine', 0.4], [4, 'sine', 0.1]]
    : [[1, 'sine', 1], [4, 'sine', 0.22], [10, 'sine', 0.05]];
  for (const [m, ty, v] of parts) {
    const o = c.createOscillator(), og = c.createGain(); o.type = ty; o.frequency.value = f * m; og.gain.value = v;
    if (m > 3) { og.gain.setValueAtTime(v, n); og.gain.exponentialRampToValueAtTime(0.0005, n + Math.min(dur, 0.18)); }
    o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function thud(t = 0, vol = 0.22) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(180, n); o.frequency.exponentialRampToValueAtTime(70, n + 0.18);
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.22); o.connect(g); g.connect(sfxBus); o.start(n); o.stop(n + 0.25);
}
function swish(t = 0, vol = 0.08, up = true) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, len = 0.35, b = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'bandpass'; f.Q.value = 1.4;
  f.frequency.setValueAtTime(up ? 600 : 2400, n); f.frequency.exponentialRampToValueAtTime(up ? 3200 : 500, n + len);
  g.gain.value = vol; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n);
}

// C major pentatonic, two octaves: the nth linked letter plays the nth step
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
export const snd = {
  unlock() { ac(); },
  letter(i) { pluck(PENTA[Math.min(i, PENTA.length - 1)], { dur: 0.35, vol: 0.2 }); },
  word(len) { [72, 76, 79, 84].slice(0, 2 + Math.min(2, len - 2)).forEach((m, i) => pluck(m + 12, { t: i * 0.06, dur: 1.1, vol: 0.16, type: 'bell' })); swish(0, 0.05); },
  tile(i) { pluck(84 + [0, 2, 4, 7, 9, 12, 14][i % 7], { t: 0, dur: 0.25, vol: 0.09, type: 'box' }); },
  bonus() { pluck(91, { dur: 0.3, vol: 0.14, type: 'bell' }); pluck(96, { t: 0.08, dur: 0.6, vol: 0.14, type: 'bell' }); },
  coin() { pluck(95, { dur: 0.18, vol: 0.1, type: 'box' }); pluck(100, { t: 0.05, dur: 0.35, vol: 0.1, type: 'box' }); },
  again() { pluck(76, { dur: 0.2, vol: 0.12 }); pluck(76, { t: 0.12, dur: 0.25, vol: 0.12 }); },
  wrong() { thud(0, 0.2); thud(0.1, 0.12); },
  shuffle() { swish(0, 0.07, true); },
  hint() { pluck(88, { dur: 0.6, vol: 0.14, type: 'bell' }); pluck(93, { t: 0.1, dur: 0.8, vol: 0.12, type: 'bell' }); },
  tap() { pluck(84, { dur: 0.12, vol: 0.08, type: 'box' }); },
  win() { [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => pluck(m, { t: i * 0.085, dur: 1.4, vol: 0.15, type: 'bell' })); swish(0.1, 0.06); },
  star(i) { pluck([84, 88, 91][i] + 12, { dur: 0.8, vol: 0.15, type: 'bell' }); },
  island() { [60, 67, 72, 76, 79, 84].forEach((m, i) => pluck(m + 12, { t: i * 0.12, dur: 2, vol: 0.14, type: 'bell' })); },
  get muted() { return muted; },
  toggle() {
    muted = !muted; try { localStorage.setItem('wordvista_mute', muted ? '1' : '0'); } catch (e) {}
    if (ac() && master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  },
  music(on = true) {
    if (on === musicOn) return; musicOn = on; clearTimeout(musicTimer);
    if (on) { ac(); bar = 0; tick(); }
  },
};

// ------------------------------------------------------------ music box loop (4 chords, a slow random-walk melody)
const CHORDS = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]];   // Cmaj7 Am7 Fmaj7 G
let bar = 0, mel = 4;
function tick() {
  if (!musicOn || !ctx) return;
  if (ctx.state !== 'running') { musicTimer = setTimeout(tick, 600); return; }
  const ch = CHORDS[bar % 4], beat = 0.62;
  pluck(ch[0] - 12, { dur: 2.4, vol: 0.2, bus: 'music', type: 'box' });
  ch.forEach((m, i) => pluck(m, { t: i * beat * 0.5 + beat * 2, dur: 1.6, vol: 0.08, bus: 'music', type: 'box' }));
  for (let k = 0; k < 4; k++) if (Math.random() < 0.7) {
    mel = Math.max(0, Math.min(PENTA.length - 3, mel + Math.floor(Math.random() * 5) - 2));
    pluck(PENTA[mel], { t: k * beat, dur: 1.2, vol: 0.07, bus: 'music', type: 'bell' });
  }
  bar++;
  musicTimer = setTimeout(tick, beat * 4 * 1000);
}

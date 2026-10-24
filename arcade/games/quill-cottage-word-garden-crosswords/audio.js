// audio.js — Quill Cottage sound, all synthesised in code (our own code, MIT). Calm on purpose: soft harp plucks that
// climb a pentatonic scale as you link letters, a warm piano chord for a found word, and a slow music-box/piano loop.
// No sharp or loud sounds; a gentle room echo. Music and sound can be switched off separately (Settings).
let ctx = null, master = null, musicBus = null, sfxBus = null, musicTimer = 0, musicWanted = false, paused = false;
const K = 'quill-cottage_audio';
const pref = (() => { try { return Object.assign({ sound: true, music: true }, JSON.parse(localStorage.getItem(K) || '{}')); } catch (e) { return { sound: true, music: true }; } })();
const savePref = () => { try { localStorage.setItem(K, JSON.stringify(pref)); } catch (e) {} };

function ac() {
  if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {}); return ctx; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;   // keeps everything soft
    master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = pref.sound ? 0.75 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = pref.music ? 0.16 : 0; musicBus.connect(master);
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    dl.delayTime.value = 0.31; fb.gain.value = 0.3; wet.gain.value = 0.2;
    sfxBus.connect(dl); musicBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
  } catch (e) { ctx = null; }
  return ctx;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// harp: bright attack, quick fade of the upper partials; piano: slower, rounder
function pluck(midi, { t = 0, dur = 0.9, vol = 0.16, bus = 'sfx', type = 'harp' } = {}) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, f = hz(midi), g = c.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + (type === 'piano' ? 0.012 : 0.004));
  g.gain.exponentialRampToValueAtTime(0.0006, n + dur);
  g.connect(bus === 'music' ? musicBus : sfxBus);
  const parts = type === 'piano' ? [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12], [0.5, 'sine', 0.15]]
    : type === 'bell' ? [[1, 'sine', 1], [2.76, 'sine', 0.22], [2, 'triangle', 0.15]]
    : [[1, 'triangle', 1], [2, 'sine', 0.45], [3, 'sine', 0.18], [4, 'sine', 0.08]];
  for (const [m, ty, v] of parts) {
    const o = c.createOscillator(), og = c.createGain(); o.type = ty; o.frequency.value = f * m; og.gain.value = v;
    if (m > 1.5) { og.gain.setValueAtTime(v, n); og.gain.exponentialRampToValueAtTime(0.0004, n + Math.min(dur, 0.35)); }
    o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function rustle(t = 0, vol = 0.04) {   // a soft paper/leaf rustle (shuffle, page turns)
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, len = 0.4, b = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length) ** 2;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(1800, n); f.frequency.exponentialRampToValueAtTime(900, n + len);
  g.gain.value = vol; s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n);
}

// D major pentatonic: the nth linked letter plays the nth step
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
export const snd = {
  unlock() { ac(); },
  letter(i) { pluck(PENTA[Math.min(i, PENTA.length - 1)] + 12, { dur: 0.7, vol: 0.13 }); },
  word(len) { [62, 66, 69, 74, 78].slice(0, 3 + Math.min(2, len - 3)).forEach((m, i) => pluck(m + 12, { t: i * 0.07, dur: 1.6, vol: 0.11, type: 'piano' })); },
  tile(i) { pluck(86 + [0, 2, 4, 7, 9, 12, 14][i % 7], { dur: 0.4, vol: 0.05, type: 'bell' }); },
  bonus() { pluck(88, { dur: 0.6, vol: 0.09, type: 'bell' }); pluck(93, { t: 0.1, dur: 0.9, vol: 0.09, type: 'bell' }); },
  wrong() { pluck(57, { dur: 0.5, vol: 0.09, type: 'piano' }); pluck(56, { t: 0.09, dur: 0.6, vol: 0.07, type: 'piano' }); },
  again() { pluck(69, { dur: 0.4, vol: 0.08, type: 'piano' }); },
  hint() { [81, 86, 90].forEach((m, i) => pluck(m, { t: i * 0.08, dur: 0.9, vol: 0.08, type: 'bell' })); },
  shuffle() { rustle(0, 0.05); },
  page() { rustle(0, 0.035); },
  tap() { pluck(74, { dur: 0.35, vol: 0.07 }); },
  coin() { pluck(93, { dur: 0.35, vol: 0.05, type: 'bell' }); },
  star(i) { pluck([74, 78, 81][i] + 12, { dur: 1.1, vol: 0.1, type: 'bell' }); },
  win() { [50, 57, 62, 66, 69, 74, 78].forEach((m, i) => pluck(m + 12, { t: i * 0.09, dur: 2.2, vol: 0.1, type: i < 2 ? 'piano' : 'harp' })); },
  stamp() { [74, 81, 86].forEach((m, i) => pluck(m, { t: i * 0.12, dur: 1.4, vol: 0.1, type: 'bell' })); },
  get sound() { return pref.sound; }, get musicOn() { return pref.music; },
  setSound(v) { pref.sound = v; savePref(); if (sfxBus) sfxBus.gain.value = v ? 0.75 : 0; },
  setMusic(v) { pref.music = v; savePref(); if (musicBus) musicBus.gain.value = v ? 0.16 : 0; },
  music(on) { musicWanted = on; if (on && !musicTimer) startMusic(); },
  pause(p) { paused = p; try { if (ctx) p ? ctx.suspend() : ctx.resume(); } catch (e) {} },
};

// a slow, unhurried piano loop (I – vi – IV – V in D, broken chords, ~66 bpm), composed in code
const PROG = [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]];
const MEL = [78, 76, 74, 76, 74, 71, 69, 71, 74, 71, 67, 69, 69, 73, 76, 74];
let step = 0;
function startMusic() {
  const beat = 0.9;
  const tick = () => {
    musicTimer = 0;
    if (!musicWanted || !ctx || document.hidden) { musicTimer = setTimeout(tick, 900); return; }
    if (pref.music && !paused) {
      const ch = PROG[Math.floor(step / 4) % PROG.length], i = step % 4;
      pluck(ch[[0, 2, 3, 2][i]], { dur: 2.4, vol: 0.12, bus: 'music', type: 'piano' });
      if (i === 0) pluck(ch[1] - 12, { dur: 3.2, vol: 0.08, bus: 'music', type: 'piano' });
      if (step % 2 === 0) pluck(MEL[(step / 2) % MEL.length], { t: 0.02, dur: 1.8, vol: 0.07, bus: 'music', type: 'harp' });
      step++;
    }
    musicTimer = setTimeout(tick, beat * 1000);
  };
  tick();
}

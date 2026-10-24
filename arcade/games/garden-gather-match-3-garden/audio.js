// Calm garden sound: harp plucks, soft bells, a slow harp-and-pad music loop in F major (composed here, original).
let ctx = null, master, musicG, sfxG, verb, musicOn = true, sfxOn = true, playing = false, paused = false, timer = 0, step = 0, nextT = 0;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function init() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  // tiny feedback-delay "room" so plucks bloom softly
  verb = ctx.createDelay(1); verb.delayTime.value = 0.19; const fb = ctx.createGain(); fb.gain.value = 0.32; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  const wet = ctx.createGain(); wet.gain.value = 0.35; verb.connect(lp); lp.connect(fb); fb.connect(verb); lp.connect(wet); wet.connect(master);
  musicG = ctx.createGain(); musicG.gain.value = musicOn ? 0.5 : 0; musicG.connect(master); musicG.connect(verb);
  sfxG = ctx.createGain(); sfxG.gain.value = sfxOn ? 0.85 : 0; sfxG.connect(master); sfxG.connect(verb);
  return ctx;
}
function pluck(m, { t = 0, vol = 0.2, dur = 1.4, bus = null, bright = 1 } = {}) {
  if (!init()) return; const n = ctx.currentTime + t, f = mtof(m);
  const g = ctx.createGain(), flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.setValueAtTime(Math.min(9000, f * 6 * bright), n); flt.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), n + dur);
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  for (const [mul, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.45], [3, 'sine', 0.12], [4.01, 'sine', 0.05]]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = v; o.connect(og); og.connect(flt); o.start(n); o.stop(n + dur + 0.05);
  }
  flt.connect(g); g.connect(bus || sfxG);
}
function bell(m, { t = 0, vol = 0.12, dur = 2.2 } = {}) {
  if (!init()) return; const n = ctx.currentTime + t, f = mtof(m), g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  for (const [mul, v] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * mul; og.gain.value = v; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur); }
  g.connect(sfxG);
}
function noise(dur = 0.12, { t = 0, vol = 0.12, freq = 900, q = 1, type = 'bandpass' } = {}) {
  if (!init()) return; const n = ctx.currentTime + t, len = Math.ceil(ctx.sampleRate * dur), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(sfxG); s.start(n);
}
// F major pentatonic, two octaves
const PENTA = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89];
export const snd = {
  unlock() { if (init() && ctx.state === 'suspended' && !paused) ctx.resume(); },
  swap: () => pluck(77, { vol: 0.07, dur: 0.35, bright: 0.6 }),
  pick: () => pluck(84, { vol: 0.05, dur: 0.25, bright: 0.5 }),
  nope: () => { pluck(57, { vol: 0.1, dur: 0.3, bright: 0.4 }); pluck(56, { t: 0.09, vol: 0.08, dur: 0.3, bright: 0.4 }); },
  match: (chain = 1) => { const i = Math.min(PENTA.length - 2, chain - 1 + 2); pluck(PENTA[i], { vol: 0.16 }); pluck(PENTA[i + 1] + 12, { t: 0.05, vol: 0.06, dur: 0.8 }); },
  made: () => { pluck(84, { vol: 0.12 }); pluck(88, { t: 0.08, vol: 0.12 }); bell(96, { t: 0.14, vol: 0.05 }); },
  line: () => [72, 76, 79, 84, 88, 91].forEach((m, i) => pluck(m, { t: i * 0.035, vol: 0.09, dur: 0.9 })),
  bee: () => { noise(0.35, { vol: 0.05, freq: 220, q: 3 }); pluck(60, { vol: 0.14, dur: 1 }); pluck(67, { t: 0.04, vol: 0.1 }); },
  wreath: () => [65, 69, 72, 77, 81, 84, 89, 93].forEach((m, i) => pluck(m, { t: i * 0.05, vol: 0.08, dur: 1.4 })),
  fly: () => [91, 93, 96].forEach((m, i) => pluck(m, { t: i * 0.06, vol: 0.05, dur: 0.4 })),
  crate: () => { noise(0.09, { vol: 0.22, freq: 420, q: 2 }); pluck(50, { vol: 0.06, dur: 0.3, bright: 0.3 }); },
  glass: () => { bell(100, { vol: 0.06, dur: 0.8 }); bell(103, { t: 0.04, vol: 0.04, dur: 0.6 }); },
  pot: () => { noise(0.07, { vol: 0.16, freq: 300, q: 3 }); pluck(79, { t: 0.05, vol: 0.12 }); pluck(84, { t: 0.13, vol: 0.12 }); },
  land: () => pluck(91, { vol: 0.012, dur: 0.15, bright: 0.4 }),
  trowel: () => { noise(0.18, { vol: 0.18, freq: 700, q: 0.8 }); },
  water: () => { noise(0.6, { vol: 0.1, freq: 2500, q: 0.6 }); [79, 84, 88].forEach((m, i) => pluck(m, { t: 0.1 + i * 0.07, vol: 0.06 })); },
  goal: () => pluck(96, { vol: 0.04, dur: 0.3 }),
  tick: () => pluck(89, { vol: 0.08, dur: 0.5 }),
  star: (i = 0) => { bell([84, 88, 91][i] || 91, { vol: 0.12 }); pluck([72, 76, 79][i] || 79, { vol: 0.1 }); },
  coin: () => { pluck(93, { vol: 0.07, dur: 0.4 }); pluck(98, { t: 0.06, vol: 0.06, dur: 0.5 }); },
  win: () => { [65, 69, 72, 77, 81, 84].forEach((m, i) => pluck(m, { t: i * 0.09, vol: 0.13, dur: 1.8 })); bell(89, { t: 0.6, vol: 0.08 }); },
  lose: () => [72, 69, 65].forEach((m, i) => pluck(m, { t: i * 0.22, vol: 0.12, dur: 1.6, bright: 0.6 })),
  restore: () => { [77, 81, 84, 89].forEach((m, i) => pluck(m, { t: i * 0.11, vol: 0.12, dur: 2 })); bell(96, { t: 0.5, vol: 0.07, dur: 3 }); },
  page: () => noise(0.12, { vol: 0.06, freq: 3000, q: 0.5 }),
  tap: () => pluck(86, { vol: 0.05, dur: 0.25, bright: 0.5 }),
};

// ---------------------------------------------------------------- music: 72 bpm, 4 chords × 8 eighths, harp arpeggio + warm pad
const CH = [[53, [65, 69, 72, 76]], [50, [62, 65, 69, 72]], [46, [62, 65, 70, 74]], [48, [64, 67, 72, 76]]];   // Fmaj7 Dm7 Bbmaj7 C
const PAT = [0, 1, 2, 3, 2, 1, 2, 3], E = 60 / 72 / 2;
function pad(m, t, dur) {
  const n = ctx.currentTime + t, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, n); g.gain.linearRampToValueAtTime(0.035, n + 1.2); g.gain.linearRampToValueAtTime(0.0001, n + dur);
  for (const d of [-4, 4]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(g); o.start(n); o.stop(n + dur + 0.1); }
  g.connect(musicG);
}
function schedule() {
  if (!ctx || !playing) return;
  while (nextT < ctx.currentTime + 0.4) {
    const t = nextT - ctx.currentTime, bar = Math.floor(step / 8) % CH.length, [root, notes] = CH[bar], i = step % 8;
    if (i === 0) { pad(root, t, E * 8 + 0.6); pad(root + 12 + 7, t, E * 8 + 0.6); pluck(root - 12, { t, vol: 0.07, dur: 2.4, bus: musicG, bright: 0.4 }); }
    // the melody breathes: skip a few notes per bar, a little higher every other cycle
    const skip = (i === 5 && bar % 2) || (i === 7 && bar === 3);
    if (!skip) pluck(notes[PAT[i]] + (Math.floor(step / 32) % 2 && i === 4 ? 12 : 0), { t, vol: i === 0 ? 0.075 : 0.05, dur: 1.6, bus: musicG, bright: 0.7 });
    step++; nextT += E;
  }
}
export const music = {
  start() { if (!init() || playing) return; playing = true; nextT = ctx.currentTime + 0.1; clearInterval(timer); timer = setInterval(schedule, 120); },
  set(on) { musicOn = on; if (musicG) musicG.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.2); },
  get on() { return musicOn; },
};
export function setSfx(on) { sfxOn = on; if (sfxG) sfxG.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.05); }
export function pauseAll(p) { paused = p; if (!ctx) return; if (p) ctx.suspend(); else ctx.resume(); }

// Pastel Pixel sound: bubbly pops, jelly boings, sparkle chimes and a soft lo-fi club loop, all synthesised (WebAudio).
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, muted = false, timer = 0, step = 0, nextT = 0, paused = false;
try { muted = localStorage.getItem('pastelpixel_mute') === '1'; } catch (e) {}
function init() {
  if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.3, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.2; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.26; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function v(midi, { t = 0, dur = 0.3, vol = 0.18, type = 'sine', bus = null, attack = 0.004, slide = 0, harm = [[2, 'sine', 0.25]] } = {}) {
  if (!init() || muted) return;
  const n = ctx.currentTime + t, g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur); g.connect(bus || sfxBus);
  for (const [m, ty, k] of [[1, type, 1], ...harm]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; o.frequency.setValueAtTime(hz(midi) * m, n);
    if (slide) o.frequency.exponentialRampToValueAtTime(hz(midi + slide) * m, n + dur * 0.8);
    og.gain.value = k; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function nz({ t = 0, dur = 0.12, vol = 0.12, f0 = 3000, f1 = 800, q = 2 } = {}) {
  if (!init() || muted) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, n); f.frequency.exponentialRampToValueAtTime(f1, n + dur);
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];
export const snd = {
  init,
  tap(i = 0) { v(PENTA[i % PENTA.length], { dur: 0.12, vol: 0.12, type: 'triangle', slide: 2 }); nz({ dur: 0.04, vol: 0.05, f0: 5000, f1: 2500 }); },
  untap() { v(67, { dur: 0.1, vol: 0.08, type: 'triangle', slide: -3 }); },
  paint(i = 0) { v(PENTA[i % PENTA.length] + 12 * (Math.floor(i / 8) % 2), { dur: 0.07, vol: 0.06, type: 'sine', slide: 3, harm: [] }); },
  pop() { v(84, { dur: 0.09, vol: 0.12, slide: 7, type: 'sine' }); },
  boing() { v(60, { dur: 0.28, vol: 0.14, type: 'sine', slide: 12, harm: [[1.5, 'sine', 0.3]] }); },
  good(k = 0) { [0, 4, 7, 12].forEach((s, i) => v(72 + k * 2 + s, { t: i * 0.07, dur: 0.35, vol: 0.13, type: 'triangle' })); nz({ t: 0.25, dur: 0.3, vol: 0.05, f0: 8000, f1: 5000, q: 4 }); },
  oops() { v(64, { dur: 0.22, vol: 0.12, type: 'triangle', slide: -2 }); v(60, { t: 0.13, dur: 0.3, vol: 0.12, type: 'triangle', slide: -3 }); },
  coin() { v(88, { dur: 0.12, vol: 0.1, type: 'square', harm: [] }); v(93, { t: 0.07, dur: 0.25, vol: 0.09, type: 'square', harm: [] }); },
  sparkle() { for (let i = 0; i < 6; i++) v(PENTA[(i * 3) % 8] + 12, { t: i * 0.05, dur: 0.25, vol: 0.06 }); },
  win() { [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => v(m, { t: i * 0.09, dur: 0.45, vol: 0.14, type: 'triangle' })); v(60, { t: 0, dur: 0.9, vol: 0.1, type: 'sine' }); nz({ t: 0.5, dur: 0.6, vol: 0.06, f0: 9000, f1: 4000, q: 3 }); },
  sticker() { v(79, { dur: 0.15, vol: 0.12, type: 'triangle', slide: 5 }); v(91, { t: 0.1, dur: 0.3, vol: 0.08 }); nz({ dur: 0.15, vol: 0.08, f0: 2000, f1: 6000 }); },
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('pastelpixel_mute', muted ? '1' : '0'); } catch (e) {} if (master) master.gain.value = muted ? 0 : 0.85; return muted; },
  music(on) { if (!on) { clearInterval(timer); timer = 0; return; } if (timer || !init()) return; nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 90); },
  pause(p) { paused = p; if (!ctx) return; if (p) ctx.suspend(); else ctx.resume(); },
};
// soft club loop: Fmaj7 – Em7 – Dm7 – Cmaj7 pads, a plucky bass and sparkly bell melody, 92 bpm
const CH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const MEL = [76, 0, 79, 0, 77, 76, 0, 72, 74, 0, 76, 0, 72, 0, 0, 0, 72, 0, 74, 76, 0, 77, 0, 76, 74, 0, 72, 0, 71, 0, 0, 0];
function tick() {
  if (!ctx || muted || paused) { if (ctx) nextT = ctx.currentTime + 0.1; return; }
  const spb = 60 / 92 / 2;
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % 4, s = step % 8, dt = nextT - ctx.currentTime;
    if (s === 0) CH[bar].forEach((m, i) => v(m + 12, { t: dt, dur: spb * 7.5, vol: 0.035, type: 'sine', attack: 0.15, bus: musicBus, harm: [[2, 'triangle', 0.15]] }));
    if (s === 0 || s === 3 || s === 6) v(CH[bar][0] - 12, { t: dt, dur: 0.3, vol: 0.09, type: 'triangle', bus: musicBus, harm: [] });
    const m = MEL[step % 32]; if (m && (step >> 5) % 2 === 0) v(m + 12, { t: dt, dur: 0.4, vol: 0.035, type: 'sine', bus: musicBus, harm: [[3, 'sine', 0.2]] });
    if (s % 2 === 1) { const n = ctx.currentTime; nz({ t: dt, dur: 0.03, vol: 0.02, f0: 9000, f1: 7000, q: 1 }); }
    nextT += spb; step++;
  }
}

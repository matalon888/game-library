// Bubblebay sound: glassy pops, soft plucks, sea-breeze whooshes and a lilting harbour waltz, all synthesised (WebAudio).
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, muted = false, musicOn = false, timer = 0, step = 0, nextT = 0;
try { muted = localStorage.getItem('bubblebay_mute') === '1'; } catch (e) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.24; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function voice(midi, { t = 0, dur = 0.4, vol = 0.2, type = 'triangle', bus = null, attack = 0.005, harm = [[2, 'sine', 0.3]], slide = 0 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || sfxBus);
  for (const [mult, ty, v] of [[1, type, 1], ...harm]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; o.frequency.setValueAtTime(hz(midi) * mult, n);
    if (slide) o.frequency.exponentialRampToValueAtTime(hz(midi + slide) * mult, n + dur);
    og.gain.value = v; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function noise({ t = 0, dur = 0.2, vol = 0.2, f0 = 2000, f1 = 400, q = 1, type = 'bandpass' } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, n); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), n + dur);
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const snd = {
  unlock: init,
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('bubblebay_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  tap() { voice(84, { dur: 0.08, vol: 0.08, type: 'sine', harm: [] }); },
  swap() { voice(79, { dur: 0.1, vol: 0.06, type: 'sine', harm: [], slide: 7 }); noise({ dur: 0.08, vol: 0.04, f0: 2500, f1: 4000, q: 3 }); },
  shoot() { noise({ dur: 0.18, vol: 0.09, f0: 600, f1: 2600, q: 1.2 }); voice(67, { dur: 0.12, vol: 0.06, type: 'sine', harm: [], slide: 12 }); },
  bounce() { voice(86, { dur: 0.06, vol: 0.05, type: 'sine', harm: [] }); },
  stick() { voice(60, { dur: 0.1, vol: 0.1, type: 'sine', harm: [], slide: -3 }); noise({ dur: 0.06, vol: 0.05, f0: 900, f1: 400, q: 2 }); },
  pop(k = 0, chain = 0) {   // glassy pop; pitch climbs along the cluster
    const m = 74 + PENT[Math.min(PENT.length - 1, (k + chain) % PENT.length)];
    voice(m, { t: k * 0.035, dur: 0.14, vol: 0.08, type: 'sine', harm: [[2, 'sine', 0.25]], slide: 9 });
    noise({ t: k * 0.035, dur: 0.05, vol: 0.06, f0: 3500, f1: 1400, q: 3 });
  },
  drop(k = 0) { voice(70 - (k % 5), { t: k * 0.03, dur: 0.18, vol: 0.05, type: 'triangle', harm: [], slide: -7 }); },
  thud(k = 0) { voice(48 + (k % 4) * 2, { t: k * 0.02, dur: 0.08, vol: 0.05, type: 'sine', harm: [] }); },
  rescue(i = 0) { [79, 83, 86, 91].forEach((m, j) => voice(m + (i % 3) * 2, { t: j * 0.06, dur: 0.3, vol: 0.07, type: 'triangle', harm: [[2, 'sine', 0.3]] })); },
  chime(i = 0) { voice(84 + PENT[i % PENT.length], { dur: 0.9, vol: 0.09, type: 'sine', harm: [[2.76, 'sine', 0.25], [5.4, 'sine', 0.08]] }); },
  sparkle() { for (let i = 0; i < 5; i++) voice(91 + PENT[(Math.random() * 6) | 0], { t: i * 0.05, dur: 0.35, vol: 0.04, type: 'sine', harm: [[3, 'sine', 0.15]] }); },
  whoosh() { noise({ dur: 0.45, vol: 0.12, f0: 400, f1: 3500, q: 1.4 }); },
  boom() { voice(40, { dur: 0.5, vol: 0.3, type: 'sine', harm: [], slide: -12 }); noise({ dur: 0.5, vol: 0.18, f0: 1200, f1: 80, q: 0.7, type: 'lowpass' }); },
  magic() { for (let i = 0; i < 6; i++) voice(84 + PENT[i], { t: i * 0.04, dur: 0.3, vol: 0.05, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  collect(i = 0) { voice(88 + PENT[i % 5], { dur: 0.2, vol: 0.06, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  star(i = 0) { voice(79 + i * 5, { dur: 0.6, vol: 0.12, type: 'triangle', harm: [[2, 'sine', 0.3], [4, 'sine', 0.1]] }); },
  coin() { voice(95, { dur: 0.08, vol: 0.06, type: 'square', harm: [] }); voice(100, { t: 0.06, dur: 0.18, vol: 0.06, type: 'square', harm: [] }); },
  bad() { voice(62, { dur: 0.12, vol: 0.08, type: 'sine', harm: [] }); voice(58, { t: 0.09, dur: 0.16, vol: 0.08, type: 'sine', harm: [] }); },
  win() { [74, 78, 81, 86, 90].forEach((m, i) => voice(m, { t: i * 0.11, dur: 0.6, vol: 0.12, type: 'triangle' })); voice(62, { t: 0.55, dur: 1.2, vol: 0.1, type: 'sine' }); },
  lose() { [69, 66, 62, 57].forEach((m, i) => voice(m, { t: i * 0.16, dur: 0.5, vol: 0.09, type: 'sine' })); },
  place() { voice(55, { dur: 0.25, vol: 0.18, type: 'sine', harm: [], slide: -5 }); noise({ dur: 0.15, vol: 0.08, f0: 500, f1: 150, q: 1 }); setTimeout(() => this.sparkle(), 120); },
  music(on = true) { musicOn = on; if (!on || !init()) return; if (timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 120); },
};
// "Harbour waltz" in D major (original): I – vi – IV – V7 pad + plucked broken chords; a lilting tune every other phrase
const CH = [[50, 54, 57, 62], [47, 50, 54, 59], [43, 47, 50, 55], [45, 49, 52, 55]];
const MEL = [[78, 76, 78], [81, -1, 78], [74, 76, 78], [76, -1, -1], [78, 81, 83], [86, -1, 83], [81, 78, 76], [74, -1, -1]];
function tick() {
  if (!musicOn || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.1 : 0; return; }
  const beat = 0.4;
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 3) % 8, b = step % 3, ch = CH[bar % 4], t = nextT - ctx.currentTime;
    if (b === 0) voice(ch[0] - 12, { t, dur: beat * 3, vol: 0.12, type: 'sine', bus: musicBus, attack: 0.04, harm: [[2, 'sine', 0.15]] });
    voice(ch[1 + b] + 12, { t, dur: 0.55, vol: 0.055, type: 'triangle', bus: musicBus, harm: [[3, 'sine', 0.12]] });
    const mel = MEL[bar][b]; if (mel > 0 && Math.floor(step / 24) % 2 === 1) voice(mel, { t, dur: 0.8, vol: 0.05, type: 'sine', bus: musicBus, harm: [[2.76, 'sine', 0.2]] });
    step++; nextT += beat;
  }
}

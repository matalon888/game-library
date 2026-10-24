// Morning Set sound: soft plucks, chimes, pops and a gentle morning loop, all synthesised in code (WebAudio).
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, muted = false, musicOn = false, timer = 0, step = 0, nextT = 0;
try { muted = localStorage.getItem('morningset_mute') === '1'; } catch (e) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    // soft room reverb from a generated impulse
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.22; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function voice(midi, { t = 0, dur = 0.4, vol = 0.2, type = 'triangle', bus = null, attack = 0.005, harm = [[2, 'sine', 0.3]], detune = 0, slide = 0 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || sfxBus);
  for (const [mult, ty, v] of [[1, type, 1], ...harm]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; o.frequency.setValueAtTime(hz(midi) * mult, n); o.detune.value = detune;
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
  toggle() { muted = !muted; try { localStorage.setItem('morningset_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  tap() { voice(84, { dur: 0.08, vol: 0.08, type: 'sine', harm: [] }); },
  swap() { noise({ dur: 0.12, vol: 0.06, f0: 900, f1: 2400, q: 2 }); voice(76, { dur: 0.1, vol: 0.05, type: 'sine', harm: [], slide: 5 }); },
  bad() { voice(62, { dur: 0.12, vol: 0.08, type: 'sine', harm: [] }); voice(58, { t: 0.09, dur: 0.16, vol: 0.08, type: 'sine', harm: [] }); },
  pop(chain = 0, k = 0) {   // bubbly pop, pitch climbs with the cascade
    const m = 72 + PENT[Math.min(PENT.length - 1, chain * 2 + (k % 3))];
    voice(m, { t: k * 0.012, dur: 0.16, vol: 0.09, type: 'sine', harm: [[2, 'sine', 0.2]], slide: 7 });
    noise({ t: k * 0.012, dur: 0.05, vol: 0.05, f0: 3000, f1: 1200, q: 3 });
  },
  chime(i = 0) { const m = 84 + PENT[i % PENT.length]; voice(m, { dur: 0.9, vol: 0.09, type: 'sine', harm: [[2.76, 'sine', 0.25], [5.4, 'sine', 0.08]] }); },
  sparkle() { for (let i = 0; i < 5; i++) voice(91 + PENT[(Math.random() * 6) | 0], { t: i * 0.05, dur: 0.35, vol: 0.04, type: 'sine', harm: [[3, 'sine', 0.15]] }); },
  make() { [72, 76, 79, 84].forEach((m, i) => voice(m, { t: i * 0.05, dur: 0.3, vol: 0.08, type: 'triangle' })); },
  whoosh() { noise({ dur: 0.45, vol: 0.12, f0: 400, f1: 3500, q: 1.4 }); },
  boom() { voice(40, { dur: 0.5, vol: 0.3, type: 'sine', harm: [], slide: -12 }); noise({ dur: 0.5, vol: 0.18, f0: 1200, f1: 80, q: 0.7, type: 'lowpass' }); },
  zap() { for (let i = 0; i < 4; i++) voice(88 + i * 3, { t: i * 0.04, dur: 0.12, vol: 0.05, type: 'square', harm: [], slide: -10 }); },
  crate() { noise({ dur: 0.18, vol: 0.18, f0: 700, f1: 200, q: 2 }); voice(50, { dur: 0.12, vol: 0.12, type: 'triangle', harm: [] }); },
  ice() { noise({ dur: 0.25, vol: 0.12, f0: 6000, f1: 2500, q: 4 }); voice(96, { dur: 0.3, vol: 0.05, type: 'sine', harm: [] }); },
  collect(i = 0) { voice(88 + PENT[i % 5], { dur: 0.2, vol: 0.06, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  star(i = 0) { voice(79 + i * 5, { dur: 0.6, vol: 0.12, type: 'triangle', harm: [[2, 'sine', 0.3], [4, 'sine', 0.1]] }); },
  win() { [72, 76, 79, 84, 88].forEach((m, i) => voice(m, { t: i * 0.11, dur: 0.6, vol: 0.12, type: 'triangle' })); voice(60, { t: 0.55, dur: 1.2, vol: 0.1, type: 'sine' }); },
  lose() { [67, 64, 60, 55].forEach((m, i) => voice(m, { t: i * 0.16, dur: 0.5, vol: 0.09, type: 'sine' })); },
  place() { voice(55, { dur: 0.25, vol: 0.18, type: 'sine', harm: [], slide: -5 }); noise({ dur: 0.15, vol: 0.08, f0: 500, f1: 150, q: 1 }); setTimeout(() => this.sparkle(), 120); },
  coin() { voice(95, { dur: 0.08, vol: 0.06, type: 'square', harm: [] }); voice(100, { t: 0.06, dur: 0.18, vol: 0.06, type: 'square', harm: [] }); },
  key() { voice(79, { dur: 0.06, vol: 0.05, type: 'sine', harm: [[3, 'sine', 0.1]] }); noise({ dur: 0.03, vol: 0.04, f0: 4000, f1: 2000, q: 2 }); },
  flip(m = 0, i = 0) { const base = [64, 71, 76][m]; voice(base + i * 2, { dur: 0.25, vol: 0.08, type: m === 2 ? 'triangle' : 'sine', harm: [[2, 'sine', 0.2]] }); noise({ dur: 0.06, vol: 0.05, f0: 2400, f1: 900, q: 2 }); },
  egg() { voice(67, { dur: 0.18, vol: 0.12, type: 'sine', harm: [], slide: 7 }); noise({ dur: 0.1, vol: 0.06, f0: 5000, f1: 1500, q: 1.5 }); },
  mark() { noise({ dur: 0.05, vol: 0.05, f0: 1800, f1: 700, q: 3 }); },
  merge(i = 0) { voice(72 + PENT[i % 6], { dur: 0.3, vol: 0.1, type: 'triangle', harm: [[2, 'sine', 0.3]], slide: 2 }); noise({ dur: 0.08, vol: 0.05, f0: 3000, f1: 800, q: 2 }); },
  music(on = true) {
    musicOn = on; if (!on || !init()) return;
    if (timer) return; nextT = ctx.currentTime + 0.1;
    timer = setInterval(tick, 120);
  },
};
// morning loop in G major, 4/4: I – iii – IV – V with a celesta arpeggio and a sparse melody
const CH = [[55, 59, 62, 67], [59, 62, 66, 71], [60, 64, 67, 72], [62, 66, 69, 74]];
const MEL = [[79, -1, 78, 76], [74, -1, -1, 71], [72, 74, 76, -1], [74, -1, -1, -1], [79, 81, 83, -1], [81, -1, 79, 78], [76, -1, 74, 72], [74, -1, -1, -1]];
function tick() {
  if (!musicOn || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.1 : 0; return; }
  const beat = 0.5;
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 4) % 8, b = step % 4, ch = CH[bar % 4], t = nextT - ctx.currentTime;
    if (b === 0) voice(ch[0] - 12, { t, dur: beat * 4, vol: 0.1, type: 'sine', bus: musicBus, attack: 0.06, harm: [[2, 'sine', 0.12]] });
    voice(ch[b] + 12, { t, dur: 0.7, vol: 0.05, type: 'triangle', bus: musicBus, harm: [[3, 'sine', 0.1]] });
    const mel = MEL[bar][b]; if (mel > 0 && Math.floor(step / 32) % 2 === 1) voice(mel, { t, dur: 0.9, vol: 0.045, type: 'sine', bus: musicBus, harm: [[2.76, 'sine', 0.2]] });
    step++; nextT += beat;
  }
}

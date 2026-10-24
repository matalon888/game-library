// Gemloft sound: glassy plucks, soft wooden clacks, crystal chimes and a warm lo-fi loop, all synthesised in code (WebAudio).
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, muted = false, musicOn = false, timer = 0, step = 0, nextT = 0;
try { muted = localStorage.getItem('gemloft_mute') === '1'; } catch (e) {}

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
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
export const snd = {
  unlock: init,
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('gemloft_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  tap() { voice(84, { dur: 0.08, vol: 0.08, type: 'sine', harm: [] }); },
  pick() { voice(79, { dur: 0.1, vol: 0.07, type: 'sine', harm: [[2, 'sine', 0.2]], slide: 5 }); noise({ dur: 0.06, vol: 0.04, f0: 2500, f1: 4000, q: 3 }); },
  drop() { voice(67, { dur: 0.12, vol: 0.06, type: 'sine', harm: [], slide: -4 }); },
  place(n = 1) {   // a soft, glassy clack: one per block, slightly spread
    for (let i = 0; i < Math.min(n, 5); i++) { noise({ t: i * 0.012, dur: 0.07, vol: 0.09, f0: 1800, f1: 600, q: 4 }); voice(60 + (i % 3) * 2, { t: i * 0.012, dur: 0.09, vol: 0.09, type: 'triangle', harm: [[3, 'sine', 0.2]] }); }
  },
  bad() { voice(62, { dur: 0.12, vol: 0.08, type: 'sine', harm: [] }); voice(58, { t: 0.09, dur: 0.16, vol: 0.08, type: 'sine', harm: [] }); },
  clear(lines = 1, combo = 0) {   // crystal cascade that climbs with the combo
    const base = 76 + Math.min(10, combo * 2);
    for (let i = 0; i < 6 + lines * 2; i++) voice(base + PENT[i % PENT.length], { t: i * 0.035, dur: 0.5, vol: 0.06, type: 'sine', harm: [[2.76, 'sine', 0.25], [5.4, 'sine', 0.08]] });
    noise({ dur: 0.35, vol: 0.07, f0: 6000, f1: 2500, q: 2 });
    if (lines > 1) voice(52, { dur: 0.6, vol: 0.12, type: 'sine', harm: [[2, 'sine', 0.2]] });
  },
  gem(i = 0) { voice(91 + PENT[i % 6], { dur: 0.25, vol: 0.06, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  chime(i = 0) { const m = 84 + PENT[i % PENT.length]; voice(m, { dur: 0.9, vol: 0.09, type: 'sine', harm: [[2.76, 'sine', 0.25], [5.4, 'sine', 0.08]] }); },
  sparkle() { for (let i = 0; i < 5; i++) voice(91 + PENT[(Math.random() * 6) | 0], { t: i * 0.05, dur: 0.35, vol: 0.04, type: 'sine', harm: [[3, 'sine', 0.15]] }); },
  whoosh() { noise({ dur: 0.45, vol: 0.12, f0: 400, f1: 3500, q: 1.4 }); },
  smash() { noise({ dur: 0.3, vol: 0.2, f0: 5000, f1: 800, q: 1 }); voice(48, { dur: 0.3, vol: 0.2, type: 'sine', harm: [], slide: -12 }); },
  star(i = 0) { voice(79 + i * 5, { dur: 0.6, vol: 0.12, type: 'triangle', harm: [[2, 'sine', 0.3], [4, 'sine', 0.1]] }); },
  win() { [72, 76, 79, 84, 88].forEach((m, i) => voice(m, { t: i * 0.11, dur: 0.6, vol: 0.12, type: 'triangle' })); voice(60, { t: 0.55, dur: 1.2, vol: 0.1, type: 'sine' }); },
  lose() { [67, 64, 60, 55].forEach((m, i) => voice(m, { t: i * 0.16, dur: 0.5, vol: 0.09, type: 'sine' })); },
  placeDecor() { voice(55, { dur: 0.25, vol: 0.18, type: 'sine', harm: [], slide: -5 }); noise({ dur: 0.15, vol: 0.08, f0: 500, f1: 150, q: 1 }); setTimeout(() => this.sparkle(), 120); },
  coin() { voice(95, { dur: 0.08, vol: 0.06, type: 'square', harm: [] }); voice(100, { t: 0.06, dur: 0.18, vol: 0.06, type: 'square', harm: [] }); },
  music(on = true) {
    musicOn = on; if (!on || !init()) return;
    if (timer) return; nextT = ctx.currentTime + 0.1;
    timer = setInterval(tick, 120);
  },
};
// warm lo-fi loop in D major, 4/4 at 84 bpm: Dmaj7 – Bm7 – Gmaj7 – A6, soft pad + Rhodes-ish arpeggio + a little melody
const CH = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 54]];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
const MEL = [[78, -1, 76, 73], [74, -1, -1, 71], [74, 76, 78, -1], [76, -1, -1, -1], [81, -1, 78, 76], [78, -1, 74, -1], [71, 74, 76, -1], [73, -1, -1, -1]];
function tick() {
  if (!musicOn || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.1 : 0; return; }
  const eighth = 60 / 84 / 2;
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8) % 8, b = step % 8, ch = CH[bar % 4], t = nextT - ctx.currentTime;
    if (b === 0) { voice(ch[0] - 12, { t, dur: eighth * 8, vol: 0.11, type: 'sine', bus: musicBus, attack: 0.05, harm: [[2, 'sine', 0.12]] });
      for (const n of ch.slice(1)) voice(n, { t, dur: eighth * 7, vol: 0.025, type: 'triangle', bus: musicBus, attack: 0.25, harm: [], detune: (Math.random() - 0.5) * 8 }); }
    if (b % 4 === 2) noise({ t, dur: 0.05, vol: 0.015, f0: 7000, f1: 5000, q: 1 });
    voice(ch[ARP[b]] + 12, { t, dur: 0.5, vol: 0.04, type: 'sine', bus: musicBus, harm: [[2, 'sine', 0.25], [3, 'sine', 0.06]] });
    const mel = b % 2 === 0 ? MEL[bar][b / 2] : -1; if (mel > 0 && Math.floor(step / 64) % 2 === 1) voice(mel, { t, dur: 0.9, vol: 0.045, type: 'sine', bus: musicBus, harm: [[2.76, 'sine', 0.18]] });
    step++; nextT += eighth;
  }
}

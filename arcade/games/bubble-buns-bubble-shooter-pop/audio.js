// Bubble Buns sound: squishy jelly pops, bubbly plucks, sparkle chimes and a bouncy kawaii-pop loop, all synthesised.
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, muted = false, musicOn = false, timer = 0, step = 0, nextT = 0;
try { muted = localStorage.getItem('bubble-buns_mute') === '1'; } catch (e) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.2; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.28; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function voice(midi, { t = 0, dur = 0.4, vol = 0.2, type = 'triangle', bus = null, attack = 0.004, harm = [[2, 'sine', 0.3]], slide = 0 } = {}) {
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
function noise({ t = 0, dur = 0.2, vol = 0.2, f0 = 2000, f1 = 400, q = 1, type = 'bandpass', bus = null } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, n); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), n + dur);
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const snd = {
  unlock: init,
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('bubble-buns_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  tap() { voice(86, { dur: 0.07, vol: 0.08, type: 'sine', harm: [], slide: 5 }); },
  swap() { voice(81, { dur: 0.12, vol: 0.07, type: 'sine', harm: [], slide: 12 }); voice(88, { t: 0.06, dur: 0.1, vol: 0.05, type: 'sine', harm: [] }); },
  shoot() { voice(64, { dur: 0.16, vol: 0.09, type: 'sine', harm: [[2, 'sine', 0.2]], slide: 19 }); noise({ dur: 0.12, vol: 0.05, f0: 900, f1: 3000, q: 2 }); },
  bounce() { voice(91, { dur: 0.07, vol: 0.05, type: 'sine', harm: [] }); },
  stick() { voice(62, { dur: 0.14, vol: 0.11, type: 'sine', harm: [], slide: -5 }); voice(74, { dur: 0.1, vol: 0.04, type: 'sine', harm: [], slide: -12 }); },   // squishy "blup"
  pop(k = 0, chain = 0) {   // jelly pop: a rising bloop + a tiny click; pitch climbs along the cluster
    const m = 76 + PENT[Math.min(PENT.length - 1, (k + chain) % PENT.length)];
    voice(m - 7, { t: k * 0.035, dur: 0.12, vol: 0.09, type: 'sine', harm: [[2, 'sine', 0.15]], slide: 14 });
    noise({ t: k * 0.035, dur: 0.035, vol: 0.05, f0: 5000, f1: 2500, q: 4 });
  },
  drop(k = 0) { voice(74 - (k % 6), { t: k * 0.03, dur: 0.2, vol: 0.05, type: 'triangle', harm: [], slide: -9 }); },
  thud(k = 0) { voice(52 + (k % 4) * 2, { t: k * 0.02, dur: 0.09, vol: 0.05, type: 'sine', harm: [] }); },
  rescue(i = 0) { [84, 88, 91, 96].forEach((m, j) => voice(m + (i % 3) * 2, { t: j * 0.055, dur: 0.3, vol: 0.07, type: 'triangle', harm: [[2, 'sine', 0.3]] })); voice(100, { t: 0.25, dur: 0.4, vol: 0.04, type: 'sine', harm: [[3, 'sine', 0.2]] }); },
  chime(i = 0) { voice(84 + PENT[i % PENT.length], { dur: 0.9, vol: 0.09, type: 'sine', harm: [[2.76, 'sine', 0.25], [5.4, 'sine', 0.08]] }); },
  sparkle() { for (let i = 0; i < 6; i++) voice(93 + PENT[(Math.random() * 6) | 0], { t: i * 0.045, dur: 0.3, vol: 0.04, type: 'sine', harm: [[3, 'sine', 0.15]] }); },
  whoosh() { noise({ dur: 0.4, vol: 0.1, f0: 500, f1: 4000, q: 1.4 }); },
  boom() { voice(43, { dur: 0.45, vol: 0.26, type: 'sine', harm: [], slide: -12 }); noise({ dur: 0.45, vol: 0.14, f0: 1400, f1: 90, q: 0.7, type: 'lowpass' }); setTimeout(() => this.sparkle(), 90); },
  magic() { for (let i = 0; i < 7; i++) voice(84 + PENT[i], { t: i * 0.035, dur: 0.28, vol: 0.05, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  collect(i = 0) { voice(91 + PENT[i % 5], { dur: 0.18, vol: 0.06, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  star(i = 0) { voice(81 + i * 5, { dur: 0.6, vol: 0.12, type: 'triangle', harm: [[2, 'sine', 0.3], [4, 'sine', 0.1]] }); },
  coin() { voice(96, { dur: 0.07, vol: 0.05, type: 'square', harm: [] }); voice(101, { t: 0.05, dur: 0.16, vol: 0.05, type: 'square', harm: [] }); },
  bad() { voice(64, { dur: 0.12, vol: 0.08, type: 'sine', harm: [], slide: -3 }); voice(60, { t: 0.09, dur: 0.16, vol: 0.08, type: 'sine', harm: [], slide: -3 }); },
  win() { [76, 79, 84, 88, 91].forEach((m, i) => voice(m, { t: i * 0.1, dur: 0.6, vol: 0.12, type: 'triangle' })); voice(64, { t: 0.5, dur: 1.2, vol: 0.1, type: 'sine' }); setTimeout(() => this.sparkle(), 500); },
  lose() { [72, 69, 65, 60].forEach((m, i) => voice(m, { t: i * 0.16, dur: 0.5, vol: 0.09, type: 'sine', slide: -1 })); },
  place() { voice(60, { dur: 0.25, vol: 0.18, type: 'sine', harm: [], slide: 7 }); noise({ dur: 0.12, vol: 0.06, f0: 700, f1: 200, q: 1 }); setTimeout(() => this.sparkle(), 120); },
  music(on = true) { musicOn = on; if (!on || !init()) return; if (timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 110); },
};
// "Marshmallow Hop" in F major (original): I – V – vi – IV, bouncy bass + offbeat bell chords, a sing-song tune on top
const CH = [[53, 57, 60, 65], [48, 52, 55, 60], [50, 53, 57, 62], [46, 50, 53, 58]];
const MEL = [[77, -1, 81, 79, 77, -1, 74, -1], [76, -1, 79, -1, 72, -1, -1, -1], [74, 77, 81, -1, 79, 77, 74, -1], [77, -1, 74, -1, 72, -1, -1, -1]];
function tick() {
  if (!musicOn || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.1 : 0; return; }
  const beat = 0.18;   // eighth notes at ~167 bpm
  while (nextT < ctx.currentTime + 0.35) {
    const bar = Math.floor(step / 8) % 4, b = step % 8, ch = CH[bar], t = nextT - ctx.currentTime;
    if (b === 0 || b === 4) voice(ch[0] - 12 + (b === 4 ? 7 : 0), { t, dur: 0.3, vol: 0.13, type: 'sine', bus: musicBus, harm: [[2, 'sine', 0.2]] });
    if (b % 2 === 1) for (const m of ch.slice(1)) voice(m + 12, { t, dur: 0.16, vol: 0.022, type: 'triangle', bus: musicBus, harm: [[3, 'sine', 0.1]] });
    if (b === 2 || b === 6) noise({ t, dur: 0.03, vol: 0.025, f0: 7000, f1: 6000, q: 2, bus: musicBus });
    const mel = MEL[bar][b]; if (mel > 0 && Math.floor(step / 32) % 2 === 1) voice(mel + 12, { t, dur: 0.32, vol: 0.04, type: 'sine', bus: musicBus, harm: [[2, 'sine', 0.2], [3, 'sine', 0.05]] });
    step++; nextT += beat;
  }
}

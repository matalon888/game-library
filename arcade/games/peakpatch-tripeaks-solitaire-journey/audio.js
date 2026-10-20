// Peakpatch sound, all synthesised: card flicks and flips, plucks that climb with the streak, chimes, and a breezy
// island marimba loop (C major, I–V–vi–IV with a lilting melody). Mute is remembered.
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, muted = false, musicOn = false, timer = 0, step = 0, nextT = 0;
try { muted = localStorage.getItem('peakpatch_mute') === '1'; } catch (e) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.2; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master); musicBus.connect(verb);
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
function noise({ t = 0, dur = 0.2, vol = 0.2, f0 = 2000, f1 = 400, q = 1, type = 'bandpass' } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, n); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), n + dur);
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const marimba = (m, o = {}) => voice(m, { type: 'sine', harm: [[4, 'sine', 0.18], [10, 'sine', 0.03]], attack: 0.003, ...o });
export const snd = {
  unlock: init,
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('peakpatch_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.05); return muted; },
  tap() { voice(86, { dur: 0.07, vol: 0.07, type: 'sine', harm: [] }); },
  flick() { noise({ dur: 0.09, vol: 0.11, f0: 5200, f1: 1800, q: 1.2 }); },
  flip() { noise({ dur: 0.07, vol: 0.08, f0: 2600, f1: 5200, q: 2 }); voice(79, { t: 0.03, dur: 0.12, vol: 0.04, type: 'sine', harm: [] }); },
  play(streak = 1) {      // the streak pluck climbs a pentatonic ladder
    const m = 67 + PENT[Math.min(PENT.length - 1, streak - 1)];
    noise({ dur: 0.08, vol: 0.09, f0: 4800, f1: 1500, q: 1.2 });
    marimba(m, { dur: 0.45, vol: 0.13 }); if (streak >= 5) marimba(m + 12, { t: 0.04, dur: 0.35, vol: 0.05 });
  },
  draw() { noise({ dur: 0.16, vol: 0.12, f0: 900, f1: 3800, q: 1.1 }); voice(64, { t: 0.05, dur: 0.14, vol: 0.05, type: 'sine', harm: [] }); },
  deal(i = 0) { noise({ dur: 0.05, vol: 0.05, f0: 4500 + (i % 5) * 200, f1: 2200, q: 1.5 }); },
  bad() { voice(55, { dur: 0.14, vol: 0.1, type: 'sine', harm: [], slide: -3 }); voice(52, { t: 0.08, dur: 0.18, vol: 0.08, type: 'sine', harm: [] }); },
  wild() { for (let i = 0; i < 7; i++) voice(84 + PENT[i], { t: i * 0.045, dur: 0.5, vol: 0.06, type: 'sine', harm: [[2.76, 'sine', 0.2]] }); },
  unlock2() { noise({ dur: 0.12, vol: 0.12, f0: 6000, f1: 2500, q: 5 }); voice(91, { dur: 0.3, vol: 0.06, type: 'triangle', harm: [] }); voice(96, { t: 0.07, dur: 0.4, vol: 0.06, type: 'triangle', harm: [] }); },
  tick() { voice(98, { dur: 0.05, vol: 0.03, type: 'sine', harm: [] }); },
  peak() { [72, 76, 79, 84, 88].forEach((m, i) => marimba(m, { t: i * 0.06, dur: 0.6, vol: 0.09 })); },
  combo(k = 0) { [0, 4, 7, 12].forEach((d, i) => voice(76 + k + d, { t: i * 0.05, dur: 0.5, vol: 0.07, type: 'triangle', harm: [[2, 'sine', 0.25]] })); },
  chime(i = 0) { voice(84 + PENT[i % PENT.length], { dur: 0.9, vol: 0.08, type: 'sine', harm: [[2.76, 'sine', 0.25], [5.4, 'sine', 0.08]] }); },
  whoosh() { noise({ dur: 0.5, vol: 0.12, f0: 300, f1: 3200, q: 1.3 }); },
  coin(i = 0) { voice(93 + (i % 4) * 2, { dur: 0.07, vol: 0.05, type: 'square', harm: [] }); voice(100 + (i % 4) * 2, { t: 0.05, dur: 0.16, vol: 0.05, type: 'square', harm: [] }); },
  star(i = 0) { voice(79 + i * 5, { dur: 0.7, vol: 0.12, type: 'triangle', harm: [[2, 'sine', 0.3], [4, 'sine', 0.1]] }); },
  win() { [72, 76, 79, 84, 88, 91].forEach((m, i) => marimba(m, { t: i * 0.09, dur: 0.7, vol: 0.12 })); voice(48, { t: 0.5, dur: 1.4, vol: 0.12, type: 'sine', harm: [[2, 'sine', 0.2]] }); },
  lose() { [67, 64, 60, 55].forEach((m, i) => voice(m, { t: i * 0.17, dur: 0.55, vol: 0.09, type: 'sine' })); },
  fanfare() { [60, 64, 67, 72, 67, 72, 76, 79].forEach((m, i) => marimba(m + 12, { t: i * 0.1, dur: 0.6, vol: 0.1 })); },
  music(on = true) { musicOn = on; if (!on || !init()) return; if (timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 110); },
};
// I – V – vi – IV in C, eighth-note marimba arpeggio, soft bass, a melody every other phrase
const CH = [[48, 60, 64, 67], [43, 59, 62, 67], [45, 57, 60, 64], [41, 57, 60, 65]];
const MEL = [[76, -1, 74, 72, -1, 74, 76, -1], [79, -1, 76, -1, 74, -1, 71, -1], [72, -1, 74, 76, -1, 79, 76, -1], [77, -1, 76, 74, -1, 72, 74, -1]];
const ARP = [1, 2, 3, 2, 1, 2, 3, 2];
function tick() {
  if (!musicOn || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.1 : 0; return; }
  const e = 0.27;
  while (nextT < ctx.currentTime + 0.35) {
    const bar = Math.floor(step / 8) % 4, b = step % 8, ch = CH[bar], t = nextT - ctx.currentTime;
    if (b === 0 || b === 5) voice(ch[0] - (b ? 0 : 0), { t, dur: e * 3, vol: 0.13, type: 'sine', bus: musicBus, attack: 0.02, harm: [[2, 'sine', 0.12]] });
    marimba(ch[ARP[b]] + 12, { t, dur: 0.35, vol: b % 2 ? 0.035 : 0.05, bus: musicBus });
    const mel = MEL[bar][b]; if (mel > 0 && Math.floor(step / 32) % 2 === 1) voice(mel + 12, { t, dur: 0.55, vol: 0.045, type: 'triangle', bus: musicBus, harm: [[2, 'sine', 0.2]] });
    if (b === 2 || b === 6) noise({ t, dur: 0.04, vol: 0.02, f0: 9000, f1: 6000, q: 1 });
    step++; nextT += e;
  }
}

// Mergewood audio: soft bells, pops, plucks and a gentle garden music loop, all synthesised (no files).
let ctx = null, master = null, musicBus = null, muted = false, musicOn = false, nextBeat = 0, step = 0, timer = 0;
try { muted = localStorage.getItem('mergewood_mute') === '1'; } catch (e) {}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function voice(freq, { t = 0, dur = 0.4, vol = 0.15, type = 'sine', partials = [[1, 1]], attack = 0.005, slide = 1, bus } = {}) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, g = c.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || master);
  for (const [m, v] of partials) {
    const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq * m, n);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * m * slide, n + dur * 0.6);
    og.gain.value = v; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function noise(t = 0, dur = 0.25, vol = 0.05, f = 2400) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, n); bp.frequency.exponentialRampToValueAtTime(f * 2.2, n + dur); bp.Q.value = 0.8;
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(bp); bp.connect(g); g.connect(master); s.start(n);
}
const BELL = [[1, 1], [2.76, 0.32], [5.4, 0.12], [2, 0.2]];
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88];

export const snd = {
  unlock() { ac(); if (!musicOn) startMusic(); },
  get muted() { return muted; },
  toggle() {
    muted = !muted; try { localStorage.setItem('mergewood_mute', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  },
  pop() { voice(520, { dur: 0.12, vol: 0.16, slide: 1.9, type: 'sine' }); voice(180, { dur: 0.1, vol: 0.1, slide: 0.6, type: 'triangle' }); },
  land() { voice(300, { dur: 0.08, vol: 0.08, slide: 0.7, type: 'triangle' }); },
  pick() { voice(880, { dur: 0.06, vol: 0.06, slide: 1.2 }); },
  drop() { voice(420, { dur: 0.07, vol: 0.07, slide: 0.8, type: 'triangle' }); },
  merge(tier = 1) {
    const m = PENTA[Math.min(PENTA.length - 1, tier)];
    voice(mtof(m), { dur: 0.9, vol: 0.14, partials: BELL }); voice(mtof(m + 7), { t: 0.06, dur: 0.7, vol: 0.07, partials: BELL });
    voice(mtof(m - 12), { dur: 0.25, vol: 0.08, type: 'triangle' }); noise(0, 0.18, 0.025, 3000);
  },
  big() { [0, 4, 7, 12, 16].forEach((s, i) => voice(mtof(79 + s), { t: i * 0.06, dur: 0.8, vol: 0.09, partials: BELL })); },
  give() { [0, 2, 4, 7, 9, 12].forEach((s, i) => voice(mtof(67 + s), { t: i * 0.045, dur: 0.5, vol: 0.09, type: 'triangle', partials: [[1, 1], [2, 0.3]] })); },
  coin() { voice(mtof(93), { dur: 0.1, vol: 0.06, type: 'square', partials: [[1, 0.5]] }); voice(mtof(100), { t: 0.06, dur: 0.18, vol: 0.06, type: 'square', partials: [[1, 0.5]] }); },
  star(i = 0) { voice(mtof(76 + [0, 4, 7][i % 3]), { dur: 0.7, vol: 0.13, partials: BELL }); voice(mtof(88 + [0, 4, 7][i % 3]), { t: 0.05, dur: 0.5, vol: 0.05, partials: BELL }); },
  restore() { noise(0, 0.6, 0.05, 1200); [0, 4, 7, 11, 14, 19, 23].forEach((s, i) => voice(mtof(72 + s), { t: 0.05 + i * 0.07, dur: 1.2, vol: 0.08, partials: BELL })); },
  chest() { noise(0, 0.25, 0.05, 900); [0, 7, 12].forEach((s, i) => voice(mtof(76 + s), { t: 0.12 + i * 0.08, dur: 0.6, vol: 0.09, partials: BELL })); },
  nope() { voice(220, { dur: 0.14, vol: 0.09, slide: 0.8, type: 'triangle' }); voice(196, { t: 0.1, dur: 0.18, vol: 0.08, slide: 0.8, type: 'triangle' }); },
  win() { [0, 4, 7, 12].forEach((s, i) => voice(mtof(72 + s), { t: i * 0.12, dur: 0.9, vol: 0.12, partials: BELL })); voice(mtof(60), { t: 0.48, dur: 1.4, vol: 0.08, type: 'triangle' }); },
};

// ---- music: I–vi–IV–V in F, plucked arpeggio + soft pad, 88 bpm, scheduled ahead on the audio clock
const CHORDS = [[53, 57, 60, 65], [50, 57, 60, 62], [46, 53, 58, 62], [48, 55, 60, 64]];
const ARP = [0, 1, 2, 3, 2, 1, 3, 2];
const MEL = [77, null, 76, 74, null, 72, 74, null, 74, null, 72, 69, null, 70, 72, null, 70, null, 69, 65, null, 67, 69, null, 72, null, 74, 72, null, 71, 72, null];
function startMusic() {
  const c = ac(); if (!c || musicOn) return; musicOn = true; nextBeat = c.currentTime + 0.2; step = 0;
  const spb = 60 / 88 / 2;
  const tick = () => {
    if (document.visibilityState === 'hidden') { nextBeat = c.currentTime + 0.2; return; }
    while (nextBeat < c.currentTime + 0.35) {
      const bar = Math.floor(step / 8) % 4, ch = CHORDS[bar], i = step % 8, t = nextBeat - c.currentTime;
      voice(mtof(ch[ARP[i]] + 12), { t, dur: 0.55, vol: 0.05, type: 'triangle', partials: [[1, 1], [2, 0.25]], bus: musicBus });
      if (i === 0) { voice(mtof(ch[0] - 12), { t, dur: 1.6, vol: 0.05, type: 'sine', bus: musicBus }); for (const n of ch.slice(1)) voice(mtof(n), { t, dur: 2.2, vol: 0.012, type: 'sine', attack: 0.4, bus: musicBus }); }
      const mn = MEL[step % MEL.length]; if (mn && (step >> 5) % 2 === 1) voice(mtof(mn), { t, dur: 0.6, vol: 0.035, partials: BELL, bus: musicBus });
      nextBeat += spb; step++;
    }
  };
  timer = setInterval(tick, 100);
}

// Mergie Dorm audio: bubbly pops, music-box bells, kalimba plucks and a bouncy kawaii lo-fi loop, all synthesised.
let ctx = null, master = null, musicBus = null, muted = false, musicOn = false, nextBeat = 0, step = 0, paused = false;
try { muted = localStorage.getItem('mergie-dorm_mute') === '1'; } catch (e) {}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master);
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended' && !paused) ctx.resume();
  return ctx;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function voice(freq, { t = 0, dur = 0.4, vol = 0.15, type = 'sine', partials = [[1, 1]], attack = 0.005, slide = 1, bus } = {}) {
  const c = ac(); if (!c || paused) return;
  const n = c.currentTime + t, g = c.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || master);
  for (const [m, v] of partials) {
    const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq * m, n);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * m * slide, n + dur * 0.6);
    og.gain.value = v; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function noise(t = 0, dur = 0.25, vol = 0.05, f = 2400, bus) {
  const c = ac(); if (!c || paused) return;
  const n = c.currentTime + t, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; bp.type = 'bandpass'; bp.frequency.setValueAtTime(f, n); bp.frequency.exponentialRampToValueAtTime(f * 2.2, n + dur); bp.Q.value = 0.8;
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(bp); bp.connect(g); g.connect(bus || master); s.start(n);
}
const BOX = [[1, 1], [3.0, 0.22], [5.9, 0.08], [2, 0.12]];           // music box tine
const KAL = [[1, 1], [2.01, 0.25], [4.3, 0.06]];                      // kalimba
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88, 91];

export const snd = {
  unlock() { ac(); if (!musicOn) startMusic(); },
  get muted() { return muted; },
  pause(on) { paused = on; },
  toggle() {
    muted = !muted; try { localStorage.setItem('mergie-dorm_mute', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  },
  pop() { voice(620, { dur: 0.12, vol: 0.15, slide: 1.8 }); voice(200, { dur: 0.1, vol: 0.08, slide: 0.6, type: 'triangle' }); },
  land() { voice(340, { dur: 0.07, vol: 0.06, slide: 0.75, type: 'triangle' }); },
  pick() { voice(990, { dur: 0.06, vol: 0.05, slide: 1.25 }); },
  drop() { voice(460, { dur: 0.07, vol: 0.06, slide: 0.8, type: 'triangle' }); },
  bubble() { for (let i = 0; i < 3; i++) voice(700 + i * 260, { t: i * 0.04, dur: 0.09, vol: 0.09, slide: 1.9 }); noise(0, 0.08, 0.05, 4200); },
  merge(tier = 1) {
    const m = SCALE[Math.min(SCALE.length - 1, tier)];
    voice(mtof(m), { dur: 0.9, vol: 0.13, partials: BOX }); voice(mtof(m + 7), { t: 0.07, dur: 0.7, vol: 0.06, partials: BOX });
    voice(mtof(m - 12), { dur: 0.22, vol: 0.08, type: 'triangle' }); voice(300, { dur: 0.1, vol: 0.08, slide: 2.2 });
  },
  big() { [0, 4, 7, 12, 16, 19].forEach((s, i) => voice(mtof(79 + s), { t: i * 0.055, dur: 0.8, vol: 0.08, partials: BOX })); },
  give() { [0, 4, 7, 9, 12, 16].forEach((s, i) => voice(mtof(69 + s), { t: i * 0.045, dur: 0.5, vol: 0.09, partials: KAL })); },
  coin() { voice(mtof(95), { dur: 0.08, vol: 0.05, type: 'square', partials: [[1, 0.4]] }); voice(mtof(100), { t: 0.05, dur: 0.16, vol: 0.05, type: 'square', partials: [[1, 0.4]] }); },
  star(i = 0) { voice(mtof(76 + [0, 4, 7][i % 3]), { dur: 0.7, vol: 0.12, partials: BOX }); voice(mtof(88 + [0, 4, 7][i % 3]), { t: 0.05, dur: 0.5, vol: 0.05, partials: BOX }); },
  restore() { noise(0, 0.5, 0.05, 1500); [0, 4, 7, 11, 14, 19, 23].forEach((s, i) => voice(mtof(72 + s), { t: 0.05 + i * 0.07, dur: 1.2, vol: 0.075, partials: BOX })); },
  chest() { noise(0, 0.2, 0.05, 900); [0, 7, 12, 16].forEach((s, i) => voice(mtof(76 + s), { t: 0.1 + i * 0.07, dur: 0.6, vol: 0.08, partials: BOX })); },
  nope() { voice(260, { dur: 0.12, vol: 0.08, slide: 0.8, type: 'triangle' }); voice(220, { t: 0.09, dur: 0.16, vol: 0.07, slide: 0.8, type: 'triangle' }); },
  talk() { const b = 74 + ((Math.random() * 5) | 0); for (let i = 0; i < 3; i++) voice(mtof(b + [0, 3, 5][i]), { t: i * 0.05, dur: 0.07, vol: 0.05, type: 'triangle' }); },
  win() { [0, 4, 7, 12, 16].forEach((s, i) => voice(mtof(72 + s), { t: i * 0.11, dur: 0.9, vol: 0.11, partials: BOX })); voice(mtof(60), { t: 0.5, dur: 1.4, vol: 0.07, type: 'triangle' }); },
  zap() { voice(500, { dur: 0.22, vol: 0.08, slide: 2.5, type: 'triangle' }); voice(1200, { t: 0.08, dur: 0.2, vol: 0.05, slide: 1.4 }); },
};

// ---- music: bouncy I–V–vi–IV in G, kalimba arpeggio + music-box melody + soft bass + brushed hat, 100 bpm
const CHORDS = [[55, 59, 62, 67], [50, 57, 62, 66], [52, 55, 59, 64], [48, 55, 60, 64]];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
const MEL = [79, null, 81, 83, null, 81, 79, null, 78, null, 79, 81, null, null, 74, null, 76, null, 79, 76, null, 74, 72, null, 74, null, 76, 79, null, 78, 79, null];
function startMusic() {
  const c = ac(); if (!c || musicOn) return; musicOn = true; nextBeat = c.currentTime + 0.2; step = 0;
  const spb = 60 / 100 / 2;
  setInterval(() => {
    if (document.visibilityState === 'hidden' || paused || c.state !== 'running') { nextBeat = c.currentTime + 0.2; return; }
    while (nextBeat < c.currentTime + 0.35) {
      const bar = Math.floor(step / 8) % 4, ch = CHORDS[bar], i = step % 8, t = nextBeat - c.currentTime;
      voice(mtof(ch[ARP[i]] + 12), { t, dur: 0.45, vol: 0.045, partials: KAL, bus: musicBus });
      if (i === 0 || i === 4) voice(mtof(ch[0] - 12), { t, dur: 0.5, vol: 0.07, type: 'triangle', bus: musicBus });
      if (i % 2 === 1) noise(t, 0.05, 0.012, 7000, musicBus);
      const mn = MEL[step % MEL.length]; if (mn && (step >> 5) % 2 === 1) voice(mtof(mn), { t, dur: 0.6, vol: 0.03, partials: BOX, bus: musicBus });
      nextBeat += spb; step++;
    }
  }, 100);
}

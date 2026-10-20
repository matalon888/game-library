// Koi Court audio: wooden tile clacks, koto-like plucks, temple-bell chimes and a gentle garden music loop,
// all synthesised in code (no files). Mute is remembered.
let ctx = null, master = null, musicBus = null, verb = null, muted = false, musicOn = false, nextBeat = 0, step = 0, timer = 0, musicWanted = false;
try { muted = localStorage.getItem('koicourt_mute') === '1'; } catch (e) {}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      // tiny feedback-delay "garden air" reverb
      verb = ctx.createDelay(1); verb.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.32; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      verb.connect(lp); lp.connect(fb); fb.connect(verb); const wet = ctx.createGain(); wet.gain.value = 0.35; lp.connect(wet); wet.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master); musicBus.connect(verb);
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function voice(freq, { t = 0, dur = 0.4, vol = 0.15, type = 'sine', partials = [[1, 1]], attack = 0.004, slide = 1, bus, wet = true, vib = 0 } = {}) {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, g = c.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || master); if (wet && !bus) g.connect(verb);
  let lfo = null;
  if (vib) { lfo = c.createOscillator(); lfo.frequency.value = 5.2; const lg = c.createGain(); lg.gain.value = freq * vib; lfo.connect(lg); lfo.start(n); lfo.stop(n + dur + 0.05); lfo.gain = lg; }
  for (const [m, v] of partials) {
    const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq * m, n);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * m * slide, n + dur * 0.6);
    if (lfo) lfo.gain.connect(o.frequency);
    og.gain.value = v; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function noise(t = 0, dur = 0.06, vol = 0.1, f = 1800, q = 1.2, type = 'bandpass') {
  const c = ac(); if (!c) return;
  const n = c.currentTime + t, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; bp.type = type; bp.frequency.value = f; bp.Q.value = q;
  g.gain.value = vol; s.connect(bp); bp.connect(g); g.connect(master); s.start(n);
}
// koto-ish pluck: bright attack, fast decay, a little pitch drop
const pluck = (m, t = 0, vol = 0.12, dur = 0.9, bus) => voice(mtof(m), { t, dur, vol, type: 'triangle', partials: [[1, 1], [2, 0.45], [3, 0.2], [4.02, 0.08]], slide: 0.995, bus });
const BELL = [[1, 1], [2.76, 0.32], [5.4, 0.12], [2, 0.18]];
// in-scale (Japanese pentatonic) on D: D Eb G A Bb
const SCALE = [62, 63, 67, 69, 70, 74, 75, 79, 81, 82, 86];

export const snd = {
  unlock() { ac(); if (musicWanted && !musicOn) startMusic(); },
  get muted() { return muted; },
  toggle() {
    muted = !muted; try { localStorage.setItem('koicourt_mute', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  },
  // wooden clack of picking a tile up
  tap(i = 0) { noise(0, 0.05, 0.22, 2600, 2.2); voice(mtof(SCALE[2 + (i % 4)] + 12), { dur: 0.12, vol: 0.05, type: 'sine' }); },
  deselect() { noise(0, 0.04, 0.12, 1500, 2); },
  blocked() { noise(0, 0.05, 0.12, 700, 3); voice(180, { dur: 0.12, vol: 0.06, slide: 0.8, type: 'triangle' }); },
  // two tiles clack together, then a chime that climbs with the combo
  match(combo = 0) {
    noise(0, 0.06, 0.28, 3200, 2.5); noise(0.012, 0.05, 0.18, 1900, 2);
    const m = SCALE[Math.min(SCALE.length - 1, 2 + combo)];
    voice(mtof(m + 12), { t: 0.05, dur: 1.1, vol: 0.12, partials: BELL }); pluck(m, 0.05, 0.09);
    if (combo >= 2) voice(mtof(m + 19), { t: 0.12, dur: 0.8, vol: 0.05, partials: BELL });
  },
  treasure() { [0, 2, 4, 5, 7].forEach((k, i) => voice(mtof(SCALE[k] + 12), { t: i * 0.06, dur: 0.9, vol: 0.08, partials: BELL })); noise(0, 0.4, 0.05, 6000, 0.8); },
  hint() { voice(mtof(81), { dur: 0.6, vol: 0.08, partials: BELL }); voice(mtof(86), { t: 0.12, dur: 0.6, vol: 0.06, partials: BELL }); },
  shuffle() { for (let i = 0; i < 9; i++) noise(i * 0.045, 0.05, 0.14, 1600 + Math.random() * 1600, 2); voice(mtof(70), { t: 0.42, dur: 0.6, vol: 0.06, partials: BELL }); },
  undo() { voice(mtof(74), { dur: 0.2, vol: 0.07, type: 'triangle', slide: 0.75 }); noise(0, 0.05, 0.12, 1800, 2); },
  deny() { voice(220, { dur: 0.14, vol: 0.08, slide: 0.8, type: 'triangle' }); voice(196, { t: 0.1, dur: 0.18, vol: 0.07, slide: 0.8, type: 'triangle' }); },
  star(i = 0) { voice(mtof(74 + [0, 5, 7][i % 3]), { dur: 1.0, vol: 0.12, partials: BELL }); voice(mtof(86 + [0, 5, 7][i % 3]), { t: 0.05, dur: 0.6, vol: 0.05, partials: BELL }); },
  win() { [0, 2, 3, 5, 7, 9].forEach((k, i) => pluck(SCALE[k], i * 0.09, 0.12, 1.2)); voice(mtof(50), { t: 0.5, dur: 2.4, vol: 0.12, partials: BELL }); voice(mtof(86), { t: 0.6, dur: 1.6, vol: 0.06, partials: BELL }); },
  gong() { voice(mtof(45), { dur: 3, vol: 0.14, partials: [[1, 1], [1.5, 0.3], [2.4, 0.2], [3.1, 0.1]], vib: 0.004 }); },
  restore() { noise(0, 0.5, 0.05, 1200, 0.7); [0, 2, 3, 4, 5, 7, 8].forEach((k, i) => voice(mtof(SCALE[k] + 12), { t: 0.05 + i * 0.07, dur: 1.4, vol: 0.07, partials: BELL })); },
  coin() { voice(mtof(93), { dur: 0.1, vol: 0.05, type: 'square', partials: [[1, 0.5]] }); voice(mtof(100), { t: 0.06, dur: 0.18, vol: 0.05, type: 'square', partials: [[1, 0.5]] }); },
  music(on) { musicWanted = on; if (on && ctx) startMusic(); if (!on) stopMusic(); },
};

// music: slow koto arpeggios over a drone, an airy flute line every other phrase. 66 bpm eighths.
const CH = [[50, 57, 62, 63, 67], [48, 55, 60, 63, 67], [46, 53, 58, 62, 65], [45, 52, 57, 62, 64]];
const ARP = [0, 2, 3, 4, 3, 2, 1, 2];
const FLUTE = [74, null, null, 75, 74, null, 70, null, 69, null, null, null, 67, null, 69, 70, 74, null, null, null, 79, null, 77, 75, 74, null, null, null, null, null, null, null];
function startMusic() {
  const c = ac(); if (!c || musicOn) return; musicOn = true; nextBeat = c.currentTime + 0.25; step = 0;
  const spb = 60 / 66 / 2;
  clearInterval(timer);
  timer = setInterval(() => {
    if (!musicOn) return;
    if (document.visibilityState === 'hidden') { nextBeat = c.currentTime + 0.2; return; }
    while (nextBeat < c.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % 4, ch = CH[bar], i = step % 8, t = nextBeat - c.currentTime;
      if (i % 2 === 0 || Math.random() < 0.5) pluck(ch[ARP[i]] + 12, t, 0.045, 1.4, musicBus);
      if (i === 0) { voice(mtof(ch[0] - 12), { t, dur: 3.2, vol: 0.045, type: 'sine', attack: 0.3, bus: musicBus }); voice(mtof(ch[2]), { t, dur: 3.4, vol: 0.012, type: 'sine', attack: 0.8, bus: musicBus }); }
      const fl = FLUTE[step % FLUTE.length]; if (fl && (step >> 5) % 2 === 1) voice(mtof(fl), { t, dur: 1.1, vol: 0.03, type: 'sine', partials: [[1, 1], [2, 0.12]], attack: 0.12, vib: 0.006, bus: musicBus });
      nextBeat += spb; step++;
    }
  }, 100);
}
function stopMusic() { musicOn = false; clearInterval(timer); }

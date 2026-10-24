// Soft, warm sound for Shelfie (adapted from Trinket Trio): bubbly pops, bell chimes, plucks and a gentle music-box loop, all synthesised.
let ctx = null, master = null, musicBus = null, muted = false, musicOn = false, nextT = 0, step = 0, timer = 0;
try { muted = localStorage.getItem('shelfie_mute') === '1'; } catch (e) {}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function osc(type, f, t0, dur, vol, { slide = 1, out = master, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
let noiseBuf = null;
function noise(t0, dur, vol, { f = 2000, q = 1, type = 'bandpass', sweep = 1, out = master } = {}) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0); if (sweep !== 1) fl.frequency.exponentialRampToValueAtTime(f * sweep, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t0); s.stop(t0 + dur + 0.05);
}
function bell(m, t0, vol = 0.12, dur = 0.9, out = master) {
  const f = hz(m);
  osc('sine', f, t0, dur, vol, { out }); osc('sine', f * 2.01, t0, dur * 0.55, vol * 0.35, { out }); osc('sine', f * 3.98, t0, dur * 0.25, vol * 0.12, { out });
}
function pluck(m, t0, vol = 0.1, dur = 0.45, out = master) { const f = hz(m); osc('triangle', f, t0, dur, vol, { out }); osc('sine', f * 2, t0, dur * 0.4, vol * 0.3, { out }); }

export const snd = {
  unlock() { ac(); },
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('shelfie_mute', muted ? '1' : '0'); } catch (e) {} if (ac()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  pick(i = 0) { if (!ac()) return; const t = ctx.currentTime; osc('sine', 520 + i * 55, t, 0.12, 0.2, { slide: 1.7 }); noise(t, 0.04, 0.05, { f: 3500, q: 2 }); },
  land(i = 0) { if (!ac()) return; const t = ctx.currentTime; osc('triangle', 330 + i * 20, t, 0.07, 0.09, { slide: 0.7 }); noise(t, 0.03, 0.04, { f: 1200, q: 3 }); },
  deny() { if (!ac()) return; const t = ctx.currentTime; osc('square', 180, t, 0.12, 0.05, { slide: 0.8 }); },
  match(combo = 0) {
    if (!ac()) return; const t = ctx.currentTime, base = 76 + Math.min(combo, 6) * 2;
    [0, 4, 7, 12].forEach((d, i) => bell(base + d, t + i * 0.045, 0.09, 0.7));
    noise(t, 0.18, 0.06, { f: 6000, q: 0.8, type: 'highpass' });
    for (let i = 0; i < 5; i++) osc('sine', hz(96 + Math.floor(Math.random() * 8)), t + 0.08 + i * 0.04, 0.12, 0.025);
  },
  goal() { if (!ac()) return; const t = ctx.currentTime; pluck(84, t, 0.07, 0.25); pluck(91, t + 0.05, 0.06, 0.3); },
  tick() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 1400, t, 0.04, 0.05); },
  whoosh() { if (!ac()) return; const t = ctx.currentTime; noise(t, 0.5, 0.18, { f: 300, q: 1.2, sweep: 8 }); osc('sine', 120, t, 0.4, 0.08, { slide: 2 }); },
  freeze() { if (!ac()) return; const t = ctx.currentTime; for (let i = 0; i < 8; i++) bell(91 + (i % 4) * 3, t + i * 0.05, 0.035, 0.5); noise(t, 0.6, 0.08, { f: 8000, q: 3, sweep: 0.5 }); },
  magnet() { if (!ac()) return; const t = ctx.currentTime; osc('sawtooth', 110, t, 0.5, 0.05, { slide: 3 }); osc('sine', 220, t, 0.5, 0.1, { slide: 3 }); },
  undo() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 800, t, 0.18, 0.12, { slide: 0.5 }); },
  star(i) { if (!ac()) return; const t = ctx.currentTime; bell(79 + i * 5, t, 0.12, 0.9); },
  win() { if (!ac()) return; const t = ctx.currentTime; [72, 76, 79, 84, 88].forEach((m, i) => bell(m, t + i * 0.09, 0.1, 1.1)); [60, 67].forEach(m => pluck(m, t + 0.45, 0.08, 1.2)); },
  lose() { if (!ac()) return; const t = ctx.currentTime; [67, 64, 60, 55].forEach((m, i) => pluck(m, t + i * 0.14, 0.09, 0.5)); },
  slide() { if (!ac()) return; const t = ctx.currentTime; noise(t, 0.22, 0.06, { f: 900, q: 1.5, sweep: 2.2 }); osc('sine', 300, t, 0.18, 0.05, { slide: 1.5 }); },
  sticker() { if (!ac()) return; const t = ctx.currentTime; [84, 88, 91, 96].forEach((m, i) => bell(m, t + i * 0.06, 0.07, 0.6)); },
  tap() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 660, t, 0.06, 0.08, { slide: 1.3 }); },
  coin() { if (!ac()) return; const t = ctx.currentTime; bell(93, t, 0.06, 0.25); bell(100, t + 0.06, 0.05, 0.3); },
  // a slow music-box loop: I – vi – IV – V in G major, arpeggiated plucks with a soft bass
  music(on) {
    musicOn = on; if (!on) { clearInterval(timer); timer = 0; return; }
    if (!ac() || timer) return;
    nextT = ctx.currentTime + 0.1; step = 0;
    const chords = [[55, 59, 62, 67], [52, 55, 59, 64], [48, 52, 55, 60], [50, 54, 57, 62]];
    const mel = [79, 78, 76, 74, 76, 79, 83, 81, 79, 76, 72, 74, 76, 74, 71, 74];
    const beat = 0.34;
    timer = setInterval(() => {
      if (!musicOn || document.visibilityState === 'hidden') { nextT = ctx.currentTime + 0.1; return; }
      while (nextT < ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4, c = chords[bar], s8 = step % 8;
        if (s8 === 0) pluck(c[0] - 12, nextT, 0.07, 1.4, musicBus);
        pluck(c[[0, 1, 2, 3, 2, 1, 2, 3][s8]] + 12, nextT, 0.045, 0.6, musicBus);
        if (s8 % 4 === 0) bell(mel[(Math.floor(step / 4)) % mel.length], nextT, 0.03, 1.0, musicBus);
        nextT += beat / 2; step++;
      }
    }, 80);
  },
};

// Bowtwist sound: everything synthesised. A bubbly "bloop" twist when a pin lifts, a squishy boing when it seats,
// jelly wobble-plops when a plate drops, music-box chimes for a full gift box, and a bouncy kawaii pop loop.
let musicPaused = false;
let ctx = null, master = null, musicBus = null, muted = false, musicOn = false, nextT = 0, step = 0, timer = 0;
try { muted = localStorage.getItem('bowtwist_mute') === '1'; } catch (e) {}

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master);
    } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function osc(type, f, t0, dur, vol, { slide = 1, out = master, attack = 0.004 } = {}) {
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
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
}
function bell(m, t0, vol = 0.1, dur = 0.9, out = master) {
  const f = hz(m); osc('sine', f, t0, dur, vol, { out }); osc('sine', f * 2.76, t0, dur * 0.4, vol * 0.3, { out }); osc('sine', f * 5.4, t0, dur * 0.15, vol * 0.1, { out });
}
function marimba(m, t0, vol = 0.1, dur = 0.5, out = master) { const f = hz(m); osc('sine', f, t0, dur, vol, { out }); osc('sine', f * 4, t0, dur * 0.12, vol * 0.25, { out }); }
function wood(t0, vol = 0.12, f = 900) { noise(t0, 0.05, vol, { f, q: 6 }); osc('sine', f * 0.32, t0, 0.07, vol * 0.8, { slide: 0.8 }); }

function bloop(t0, f = 520, vol = 0.1, up = 1.9, dur = 0.14) { osc('sine', f, t0, dur, vol, { slide: up }); osc('triangle', f * 2, t0, dur * 0.6, vol * 0.25, { slide: up }); }
function squish(t0, vol = 0.1, f = 300) { osc('sine', f, t0, 0.18, vol, { slide: 0.55 }); noise(t0, 0.08, vol * 0.4, { f: 900, q: 2, sweep: 0.5 }); }
function pluck(m, t0, vol = 0.08, dur = 0.35, out = master) { const f = hz(m); osc('triangle', f, t0, dur, vol, { out }); osc('sine', f * 2, t0, dur * 0.5, vol * 0.35, { out }); }

export const snd = {
  unlock() { ac(); },
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('bowtwist_mute', muted ? '1' : '0'); } catch (e) {} if (ac()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  /** lift a pin: a rising bubbly twist */
  unscrew() { if (!ac()) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) noise(t + i * 0.035, 0.02, 0.04, { f: 4200 + i * 400, q: 9 }); bloop(t + 0.02, 480, 0.09, 2.1, 0.18); },
  /** pin pops into a hole */
  seat(i = 0) { if (!ac()) return; const t = ctx.currentTime; bloop(t, 700 + i * 30, 0.07, 0.6, 0.1); squish(t + 0.08, 0.07, 380); },
  /** into a gift box: music-box ding, rising with the slot */
  box(n = 0) { if (!ac()) return; const t = ctx.currentTime; bell(86 + n * 4, t + 0.02, 0.07, 0.6); bloop(t, 900, 0.05, 1.5, 0.08); },
  boxFull() { if (!ac()) return; const t = ctx.currentTime; [84, 88, 91, 96].forEach((m, i) => bell(m, t + i * 0.06, 0.08, 0.9)); noise(t + 0.2, 0.3, 0.05, { f: 8000, q: 0.7, type: 'highpass' }); },
  slideIn() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 300, t, 0.22, 0.05, { slide: 2.2 }); bloop(t + 0.2, 640, 0.05, 1.4, 0.1); },
  drop(size = 1) { if (!ac()) return; const t = ctx.currentTime; const f = 240 / Math.sqrt(size); osc('sine', f * 2.4, t, 0.35, 0.12, { slide: 0.35 }); osc('sine', f * 1.2, t + 0.05, 0.4, 0.08, { slide: 1.6 }); noise(t, 0.2, 0.05, { f: 600, q: 1.4, sweep: 0.4 }); },
  clack() { if (!ac()) return; const t = ctx.currentTime; squish(t, 0.06, 420 + Math.random() * 120); },
  swing() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 420, t, 0.3, 0.04, { slide: 0.7 }); osc('sine', 300, t + 0.12, 0.25, 0.03, { slide: 1.3 }); },
  deny() { if (!ac()) return; const t = ctx.currentTime; osc('square', 230, t, 0.08, 0.03, { slide: 0.8 }); osc('square', 200, t + 0.09, 0.1, 0.03, { slide: 0.8 }); },
  tap() { if (!ac()) return; const t = ctx.currentTime; bloop(t, 900, 0.04, 1.3, 0.06); },
  pop() { if (!ac()) return; const t = ctx.currentTime; bloop(t, 620, 0.11, 2.2, 0.12); },
  hint() { if (!ac()) return; const t = ctx.currentTime; [91, 95, 98].forEach((m, i) => bell(m, t + i * 0.07, 0.05, 0.6)); },
  drill() { if (!ac()) return; const t = ctx.currentTime; for (let i = 0; i < 8; i++) bloop(t + i * 0.05, 500 + i * 70, 0.05, 1.5, 0.06); noise(t, 0.45, 0.04, { f: 5000, q: 2, sweep: 1.4 }); },
  unlock2() { if (!ac()) return; const t = ctx.currentTime; [76, 83, 88].forEach((m, i) => bell(m, t + i * 0.08, 0.08, 0.8)); },
  star(i) { if (!ac()) return; const t = ctx.currentTime; bell(84 + i * 4, t, 0.1, 0.9); bloop(t, 800 + i * 200, 0.05, 1.6, 0.1); },
  coin() { if (!ac()) return; const t = ctx.currentTime; bell(96, t, 0.05, 0.25); bell(103, t + 0.06, 0.045, 0.3); },
  win() { if (!ac()) return; const t = ctx.currentTime; [72, 76, 79, 84, 88, 91].forEach((m, i) => bell(m, t + i * 0.08, 0.08, 1.1)); [60, 64, 67].forEach(m => pluck(m, t + 0.5, 0.08, 1.0)); },
  lose() { if (!ac()) return; const t = ctx.currentTime; [72, 69, 65, 64].forEach((m, i) => pluck(m, t + i * 0.15, 0.08, 0.45)); osc('sine', 330, t + 0.6, 0.5, 0.05, { slide: 0.6 }); },
  restore() { if (!ac()) return; const t = ctx.currentTime; for (let i = 0; i < 10; i++) bell(86 + (i % 5) * 3, t + i * 0.045, 0.04, 0.7); [60, 64, 67, 72].forEach(m => pluck(m, t + 0.3, 0.07, 1.2)); },
  sticker() { if (!ac()) return; const t = ctx.currentTime; noise(t, 0.12, 0.08, { f: 4000, q: 1, sweep: 0.4 }); bell(93, t + 0.1, 0.07, 0.6); },
  pause() { musicPaused = true; },
  resume() { musicPaused = false; if (ctx) nextT = ctx.currentTime + 0.1; },
  // a bouncy music-box loop in C major (I – vi – IV – V) with a sing-song melody
  music(on) {
    musicOn = on; if (!on) { clearInterval(timer); timer = 0; return; }
    if (!ac() || timer) return;
    nextT = ctx.currentTime + 0.1; step = 0;
    const chords = [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]];
    const mel = [76, 79, 81, 79, 76, 74, 72, 74, 76, 76, 79, 84, 83, 81, 79, 0];
    const beat = 0.3;
    timer = setInterval(() => {
      if (!musicOn || musicPaused || document.visibilityState === 'hidden') { nextT = ctx.currentTime + 0.1; return; }
      while (nextT < ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4, c = chords[bar], s8 = step % 8;
        if (s8 === 0 || s8 === 4) pluck(c[0] - 12, nextT, 0.07, 0.5, musicBus);
        if (s8 % 2 === 1) pluck(c[[1, 2, 3, 2][(s8 - 1) / 2]] + 12, nextT, 0.03, 0.25, musicBus);
        if (s8 % 2 === 0) { const m = mel[(Math.floor(step / 2)) % mel.length]; if (m) bell(m, nextT, 0.028, 0.5, musicBus); }
        nextT += beat / 2; step++;
      }
    }, 80);
  },
};

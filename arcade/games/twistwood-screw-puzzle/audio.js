// Twistwood sound: everything synthesised. Ratchet ticks while a screw turns, a soft wooden "tok" when it seats,
// hollow clacks when a plate drops, brass dings for a full box, and a slow warm marimba loop for the workshop.
let ctx = null, master = null, musicBus = null, muted = false, musicOn = false, nextT = 0, step = 0, timer = 0;
try { muted = localStorage.getItem('twistwood_mute') === '1'; } catch (e) {}

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

export const snd = {
  unlock() { ac(); },
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('twistwood_mute', muted ? '1' : '0'); } catch (e) {} if (ac()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
  /** unscrew: a quick ratchet run rising in pitch */
  unscrew() { if (!ac()) return; const t = ctx.currentTime; for (let i = 0; i < 7; i++) { noise(t + i * 0.032, 0.02, 0.07, { f: 3200 + i * 260, q: 8 }); } osc('triangle', 520, t, 0.2, 0.05, { slide: 1.6 }); },
  /** screw seats in a hole: ratchet down + a soft tok */
  seat(i = 0) { if (!ac()) return; const t = ctx.currentTime; for (let k = 0; k < 5; k++) noise(t + k * 0.03, 0.02, 0.06, { f: 3600 - k * 300, q: 8 }); wood(t + 0.16, 0.13, 700 + i * 40); },
  /** into a colour box: brass plink */
  box(n = 0) { if (!ac()) return; const t = ctx.currentTime; bell(84 + n * 3, t + 0.02, 0.07, 0.5); wood(t, 0.08, 1300); },
  boxFull() { if (!ac()) return; const t = ctx.currentTime; [79, 83, 86, 91].forEach((m, i) => bell(m, t + i * 0.06, 0.08, 0.9)); noise(t + 0.2, 0.25, 0.05, { f: 7000, q: 0.7, type: 'highpass' }); },
  slideIn() { if (!ac()) return; const t = ctx.currentTime; noise(t, 0.28, 0.07, { f: 500, q: 1.5, sweep: 2.5 }); wood(t + 0.26, 0.08, 600); },
  drop(size = 1) { if (!ac()) return; const t = ctx.currentTime; wood(t, 0.16, 520 / Math.sqrt(size)); wood(t + 0.09, 0.1, 680 / Math.sqrt(size)); noise(t, 0.35, 0.06, { f: 260, q: 0.8, sweep: 0.6 }); },
  clack() { if (!ac()) return; const t = ctx.currentTime; wood(t, 0.1, 820 + Math.random() * 200); },
  swing() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 300, t, 0.25, 0.04, { slide: 0.7 }); },
  deny() { if (!ac()) return; const t = ctx.currentTime; osc('square', 190, t, 0.1, 0.04, { slide: 0.8 }); wood(t, 0.06, 400); },
  tap() { if (!ac()) return; const t = ctx.currentTime; wood(t, 0.05, 1500); },
  pop() { if (!ac()) return; const t = ctx.currentTime; osc('sine', 600, t, 0.12, 0.12, { slide: 1.8 }); },
  hint() { if (!ac()) return; const t = ctx.currentTime; [88, 91, 95].forEach((m, i) => bell(m, t + i * 0.07, 0.05, 0.6)); },
  drill() { if (!ac()) return; const t = ctx.currentTime; osc('sawtooth', 160, t, 0.55, 0.05, { slide: 1.8 }); noise(t, 0.55, 0.07, { f: 2400, q: 2, sweep: 1.6 }); },
  unlock2() { if (!ac()) return; const t = ctx.currentTime; [72, 79, 84].forEach((m, i) => bell(m, t + i * 0.08, 0.08, 0.8)); },
  star(i) { if (!ac()) return; const t = ctx.currentTime; bell(79 + i * 5, t, 0.11, 0.9); },
  coin() { if (!ac()) return; const t = ctx.currentTime; bell(93, t, 0.05, 0.25); bell(100, t + 0.06, 0.045, 0.3); },
  win() { if (!ac()) return; const t = ctx.currentTime; [72, 76, 79, 84, 88].forEach((m, i) => bell(m, t + i * 0.09, 0.09, 1.1)); [48, 55, 60].forEach(m => marimba(m, t + 0.45, 0.1, 1.2)); },
  lose() { if (!ac()) return; const t = ctx.currentTime; [67, 64, 60, 57].forEach((m, i) => marimba(m, t + i * 0.15, 0.1, 0.5)); },
  restore() { if (!ac()) return; const t = ctx.currentTime; for (let i = 0; i < 10; i++) bell(84 + (i % 5) * 2, t + i * 0.045, 0.04, 0.7); [60, 64, 67].forEach(m => marimba(m, t + 0.3, 0.09, 1.3)); },
  sticker() { if (!ac()) return; const t = ctx.currentTime; noise(t, 0.12, 0.08, { f: 4000, q: 1, sweep: 0.4 }); bell(91, t + 0.1, 0.07, 0.6); },
  // a warm marimba loop: Bb major, I – vi – IV – V, with a lazy melody on top
  music(on) {
    musicOn = on; if (!on) { clearInterval(timer); timer = 0; return; }
    if (!ac() || timer) return;
    nextT = ctx.currentTime + 0.1; step = 0;
    const chords = [[46, 50, 53, 58], [43, 46, 50, 55], [51, 55, 58, 63], [41, 45, 48, 53]];
    const mel = [74, 72, 70, 72, 74, 77, 74, 72, 70, 67, 70, 72, 74, 72, 70, 69];
    const beat = 0.36;
    timer = setInterval(() => {
      if (!musicOn || document.visibilityState === 'hidden') { nextT = ctx.currentTime + 0.1; return; }
      while (nextT < ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4, c = chords[bar], s8 = step % 8;
        if (s8 === 0) marimba(c[0] - 12, nextT, 0.09, 1.2, musicBus);
        if (s8 % 2 === 0) marimba(c[[1, 2, 3, 2][s8 / 2]] + 12, nextT, 0.045, 0.45, musicBus);
        if (s8 === 3 || s8 === 6) marimba(mel[(Math.floor(step / 4)) % mel.length], nextT, 0.04, 0.7, musicBus);
        nextT += beat / 2; step++;
      }
    }, 80);
  },
};

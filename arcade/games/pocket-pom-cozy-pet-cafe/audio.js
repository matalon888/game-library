// Pocket Pom — sounds and a bubbly music loop, all synthesized (no audio files).
let ctx = null, master = null, musicBus = null, muted = false, musicOn = false, musicTimer = 0, paused = false;
export function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  }
  if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {});
  return ctx;
}
export function unlock() { ac(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function pauseAll(p) { paused = p; if (!ctx) return; if (p) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
// soft bell / marimba pluck
function bell(m, t, d = 0.5, v = 0.2, out = master) {
  const c = ac(); if (!c) return; t = t ?? c.currentTime;
  const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
  o.type = 'sine'; o2.type = 'sine'; o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 3.98;
  env(g, t, 0.006, d, v); env(g2, t, 0.004, d * 0.35, v * 0.22);
  o.connect(g).connect(out); o2.connect(g2).connect(out); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1);
}
function blip(f0, f1, t, d, v = 0.18, type = 'sine') {
  const c = ac(); if (!c) return; t = t ?? c.currentTime;
  const o = c.createOscillator(), g = c.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  env(g, t, 0.005, d, v); o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05);
}
function noise(t, d, v = 0.1, f = 2000, q = 1) {
  const c = ac(); if (!c) return; t = t ?? c.currentTime;
  const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
  g.gain.value = v; s.connect(fl).connect(g).connect(master); s.start(t);
}

export const S = {
  tap() { blip(700, 1100, null, 0.07, 0.12); },
  pop() { blip(420, 980, null, 0.09, 0.2); },
  soft() { blip(520, 760, null, 0.08, 0.1); },
  serve() { const c = ac(); if (!c) return; const t = c.currentTime; [76, 81, 84].forEach((m, i) => bell(m, t + i * 0.07, 0.4, 0.15)); },
  coin() { const c = ac(); if (!c) return; const t = c.currentTime; bell(88, t, 0.25, 0.12); bell(93, t + 0.06, 0.35, 0.12); },
  heart() { const c = ac(); if (!c) return; const t = c.currentTime; bell(84, t, 0.3, 0.12); bell(88, t + 0.08, 0.4, 0.12); },
  munch() { const c = ac(); if (!c) return; const t = c.currentTime; for (let i = 0; i < 3; i++) noise(t + i * 0.13, 0.07, 0.16, 1400 + i * 200, 2); },
  squeak() { blip(900, 1500, null, 0.12, 0.13, 'triangle'); setTimeout(() => blip(1300, 1800, null, 0.08, 0.1, 'triangle'), 90); },
  boing() { blip(220, 620, null, 0.18, 0.18, 'triangle'); },
  sparkle() { const c = ac(); if (!c) return; const t = c.currentTime; for (let i = 0; i < 5; i++) bell(91 + i * 2, t + i * 0.045, 0.25, 0.06); },
  brush() { noise(null, 0.12, 0.05, 4500, 1.5); },
  bubble() { blip(600 + Math.random() * 500, 1400 + Math.random() * 600, null, 0.06, 0.07); },
  door() { const c = ac(); if (!c) return; const t = c.currentTime; bell(84, t, 0.6, 0.12); bell(79, t + 0.16, 0.8, 0.12); },
  nope() { blip(330, 240, null, 0.14, 0.12, 'triangle'); },
  levelup() { const c = ac(); if (!c) return; const t = c.currentTime; [72, 76, 79, 84, 88].forEach((m, i) => bell(m, t + i * 0.08, 0.6, 0.14)); },
  win() { const c = ac(); if (!c) return; const t = c.currentTime; [72, 76, 79, 84, 79, 84, 88, 91].forEach((m, i) => bell(m, t + i * 0.09, 0.7, 0.13)); },
  lose() { const c = ac(); if (!c) return; const t = c.currentTime; [76, 72, 69, 67].forEach((m, i) => bell(m, t + i * 0.14, 0.7, 0.1)); },
  tick() { blip(1500, 1500, null, 0.03, 0.05, 'square'); },
};

// a gentle, bouncy loop: I–vi–IV–V in F major, marimba arpeggios + soft bass
const CH = [[65, 69, 72, 76], [62, 65, 69, 74], [58, 62, 65, 70], [60, 64, 67, 72]];
const MEL = [81, 0, 79, 77, 76, 0, 77, 79, 74, 0, 76, 77, 79, 0, 0, 0, 77, 0, 76, 74, 72, 0, 74, 76, 79, 0, 77, 76, 74, 0, 0, 0];
export function music(on) {
  musicOn = on; clearInterval(musicTimer); if (!on) return;
  const c = ac(); if (!c) return;
  const bpm = 104, step = 60 / bpm / 2; let i = 0, next = c.currentTime + 0.1;
  const sched = () => {
    if (!musicOn || !ctx) return;
    while (next < ctx.currentTime + 0.4) {
      const bar = Math.floor(i / 8) % 4, ch = CH[bar], s = i % 8;
      bell(ch[[0, 2, 1, 3, 2, 1, 3, 2][s]] , next, 0.35, 0.08, musicBus);
      if (s === 0) bell(ch[0] - 24, next, 1.4, 0.12, musicBus);
      if (s === 4) bell(ch[0] - 17, next, 0.9, 0.07, musicBus);
      const m = MEL[i % 32]; if (m && Math.floor(i / 32) % 2 === 1) bell(m, next, 0.5, 0.07, musicBus);
      next += step; i++;
    }
  };
  sched(); musicTimer = setInterval(sched, 120);
}

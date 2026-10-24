// Starlit Crush — sound, all composed in code (no files): four kawaii-pop loops (bouncy campus, cozy lo-fi room,
// dreamy night, soft romance) on music-box bells + plucked bass + pad, and bubbly UI sounds. Music pauses during ads.
let ac = null, master = null, mus = null, sfxB = null, muted = false, mood = null, step = 0, nextT = 0, timer = null, noiseBuf = null, paused = false;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination);
    sfxB = ac.createGain(); sfxB.gain.value = 0.7; sfxB.connect(master);
    mus = ac.createGain(); mus.gain.value = 0.2; mus.connect(master);
  }
  if (ac.state === 'suspended' && !paused) ac.resume();
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05); }
export function pauseAll(p) { paused = p; if (mus && ac) mus.gain.setTargetAtTime(p ? 0 : 0.2, ac.currentTime, 0.05); }
export function unlock() { if (ctx()) startLoop(); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function nb() { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function tone(f, dur, { type = 'sine', vol = 0.1, at = 0, attack = 0.005, bus = sfxB, slide = 1, t0 = null } = {}) {
  const a = ctx(); if (!a) return; const t = (t0 ?? a.currentTime) + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function bell(m, t0, vol = 0.06) { const f = mtof(m); tone(f, 0.9, { vol, t0, bus: mus }); tone(f * 2, 0.4, { vol: vol * 0.3, t0, bus: mus }); tone(f * 4.01, 0.18, { vol: vol * 0.12, t0, bus: mus }); }
function pluck(m, t0, vol = 0.07) { tone(mtof(m), 0.32, { type: 'triangle', vol, t0, bus: mus, attack: 0.004 }); }
function pad(ms, t0, dur, vol = 0.02) { for (const m of ms) { tone(mtof(m), dur, { type: 'triangle', vol, t0, attack: 0.35, bus: mus }); tone(mtof(m) * 1.004, dur, { vol: vol * 0.7, t0, attack: 0.4, bus: mus }); } }
function hat(t0, vol = 0.015) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb(); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05); s.connect(f); f.connect(g); g.connect(mus); s.start(t0); s.stop(t0 + 0.06); }
function hiss(dur, { vol = 0.05, f = 900, at = 0, slide = 1, q = 0.7 } = {}) {
  const a = ctx(); if (!a) return; const t = a.currentTime + at, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nb(); s.loop = true; fl.type = 'bandpass'; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (slide !== 1) fl.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxB); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
// 4/4, 16 steps a bar, 4 bars; mel = 32 eighth notes (0 = rest)
const MOODS = {
  campus: { bpm: 112, chords: [[60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74]], bass: [48, 45, 41, 43], mel: [79, 0, 76, 79, 81, 0, 79, 76, 72, 0, 74, 76, 0, 0, 0, 0, 77, 0, 76, 74, 72, 0, 74, 0, 79, 0, 0, 77, 76, 0, 74, 0], hats: true },
  cozy: { bpm: 84, chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [67, 71, 74, 77]], bass: [41, 40, 38, 43], mel: [72, 0, 0, 76, 0, 74, 72, 0, 71, 0, 0, 0, 67, 0, 69, 71, 69, 0, 0, 72, 0, 74, 0, 72, 74, 0, 76, 0, 0, 0, 0, 0], hats: true },
  night: { bpm: 72, chords: [[57, 64, 67, 71], [53, 60, 64, 67], [55, 62, 65, 69], [52, 59, 64, 67]], bass: [45, 41, 43, 40], mel: [76, 0, 79, 0, 83, 0, 0, 81, 79, 0, 0, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 0, 79, 76, 0, 0, 0, 0, 0, 0, 0] },
  romance: { bpm: 78, chords: [[65, 69, 72], [69, 72, 76], [70, 74, 77], [72, 76, 79]], bass: [41, 45, 46, 48], mel: [81, 0, 0, 79, 77, 0, 76, 0, 77, 0, 0, 0, 0, 0, 72, 74, 76, 0, 0, 77, 79, 0, 81, 0, 84, 0, 0, 0, 0, 0, 0, 0] },
};
export function music(m) { mood = m; ctx(); startLoop(); }
function startLoop() {
  if (timer || !ac) return;
  nextT = ac.currentTime + 0.1;
  timer = setInterval(() => {
    if (!ac || !mood || muted || paused || document.hidden) { if (ac) nextT = ac.currentTime + 0.1; return; }
    const M = MOODS[mood], sd = 60 / M.bpm / 4;
    while (nextT < ac.currentTime + 0.3) {
      const s = step % 64, bar = Math.floor(s / 16), b16 = s % 16, ch = M.chords[bar];
      if (b16 === 0) pad(ch, nextT, sd * 16.5, 0.017);
      if (b16 % 4 === 0) pluck(M.bass[bar] - (b16 === 8 ? -7 : 0), nextT, 0.06);
      if (M.hats && b16 % 4 === 2) hat(nextT);
      if (s % 2 === 0) { const n = M.mel[s / 2]; if (n) bell(n, nextT, 0.05); }
      if (b16 === 6 || b16 === 14) bell(ch[(b16 / 2) % ch.length] + 12, nextT, 0.018);
      nextT += sd; step++;
    }
  }, 60);
}
export const S = {
  tap: () => tone(1100, 0.05, { type: 'triangle', vol: 0.03, slide: 1.3 }),
  next: () => tone(1500, 0.04, { vol: 0.018, slide: 1.2 }),
  choice: () => [76, 79, 84].forEach((m, i) => tone(mtof(m), 0.35, { vol: 0.045, at: i * 0.05 })),
  pick: () => { [84, 88, 91].forEach((m, i) => tone(mtof(m), 0.4, { vol: 0.05, at: i * 0.05 })); hiss(0.15, { vol: 0.02, f: 6000 }); },
  heart: () => [79, 84, 88, 91].forEach((m, i) => tone(mtof(m), 0.45, { vol: 0.045, at: i * 0.07 })),
  coin: () => { tone(mtof(88), 0.1, { type: 'square', vol: 0.018 }); tone(mtof(95), 0.28, { type: 'square', vol: 0.018, at: 0.07 }); },
  photo: () => { hiss(0.07, { vol: 0.08, f: 3000 }); tone(2200, 0.04, { type: 'square', vol: 0.015, at: 0.05 }); hiss(0.22, { vol: 0.04, f: 1500, at: 0.1, slide: 0.5 }); },
  swoosh: () => hiss(0.45, { vol: 0.045, f: 600, slide: 3 }),
  pop: () => { tone(500, 0.12, { vol: 0.08, slide: 2.4 }); tone(1200, 0.08, { vol: 0.03, at: 0.05, slide: 1.5 }); },
  splat: () => { tone(160, 0.2, { vol: 0.1, slide: 0.5 }); hiss(0.18, { vol: 0.07, f: 500, slide: 0.5 }); },
  letter: () => { [84, 88, 91, 96].forEach((m, i) => tone(mtof(m), 0.7, { vol: 0.04, at: i * 0.09 })); hiss(0.6, { vol: 0.02, f: 4000, slide: 1.5 }); },
  sticker: () => { tone(700, 0.1, { vol: 0.07, slide: 1.8 }); [88, 93].forEach((m, i) => tone(mtof(m), 0.3, { vol: 0.04, at: 0.08 + i * 0.07 })); },
  cliff: () => { tone(mtof(52), 2.4, { type: 'triangle', vol: 0.07, attack: 0.05 }); tone(mtof(59), 2.4, { vol: 0.04, at: 0.2 }); [76, 79, 83, 88].forEach((m, i) => tone(mtof(m), 1.6, { vol: 0.04, at: 0.3 + i * 0.16 })); },
  win: () => [72, 76, 79, 84, 88].forEach((m, i) => tone(mtof(m), 0.6, { vol: 0.05, at: i * 0.08 })),
  wrong: () => tone(260, 0.28, { type: 'triangle', vol: 0.05, slide: 0.7 }),
  right: () => [84, 91].forEach((m, i) => tone(mtof(m), 0.35, { vol: 0.05, at: i * 0.07 })),
};

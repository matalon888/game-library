// Lantern Bay — sound, all composed in code (no files): three soft loops (a harbour waltz on music box + pad, a minor
// "mystery" arpeggio for night scenes, a warm romance loop), surf, gulls, and gentle UI sounds.
let ac = null, master = null, mus = null, sfxB = null, amb = null, muted = false, mood = null, step = 0, nextT = 0, timer = null, noiseBuf = null, surf = null;
function ctx() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ac.destination);
    sfxB = ac.createGain(); sfxB.gain.value = 0.7; sfxB.connect(master);
    mus = ac.createGain(); mus.gain.value = 0.22; mus.connect(master);
    amb = ac.createGain(); amb.gain.value = 0.0; amb.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05); }
export function unlock() { if (ctx()) startLoop(); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function nb() { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6; } } return noiseBuf; }
function tone(f, dur, { type = 'sine', vol = 0.1, at = 0, attack = 0.006, bus = sfxB, slide = 1, t0 = null } = {}) {
  const a = ctx(); if (!a) return; const t = (t0 ?? a.currentTime) + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function box(m, t0, vol = 0.07) { const f = mtof(m); tone(f, 1.1, { vol, t0, bus: mus }); tone(f * 2, 0.5, { vol: vol * 0.25, t0, bus: mus }); tone(f * 3.01, 0.25, { vol: vol * 0.1, t0, bus: mus }); }
function pad(ms, t0, dur, vol = 0.025) { for (const m of ms) { tone(mtof(m), dur, { type: 'triangle', vol, t0, attack: 0.4, bus: mus }); tone(mtof(m) * 1.003, dur, { type: 'sine', vol: vol * 0.8, t0, attack: 0.5, bus: mus }); } }
function hiss(dur, { vol = 0.05, f = 900, at = 0, slide = 1, bus = sfxB, q = 0.7 } = {}) {
  const a = ctx(); if (!a) return; const t = a.currentTime + at, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nb(); s.loop = true; fl.type = 'bandpass'; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (slide !== 1) fl.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.2, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
// --- music: 3/4 at ~84 bpm, eighth-note steps; each mood = 4 bars of chords + a melody line
const MOODS = {
  calm:    { bpm: 84, chords: [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]], mel: [76, 0, 74, 72, 0, 74, 72, 0, 69, 67, 0, 0, 69, 0, 72, 74, 0, 72, 71, 0, 67, 0, 0, 0] },
  mystery: { bpm: 70, chords: [[45, 52, 60], [41, 48, 57], [43, 50, 59], [40, 47, 56]], mel: [69, 72, 76, 72, 69, 72, 65, 69, 72, 69, 65, 69, 67, 71, 74, 71, 67, 71, 64, 68, 71, 68, 64, 68], arp: true },
  romance: { bpm: 76, chords: [[41, 48, 57], [45, 52, 60], [46, 53, 62], [48, 55, 64]], mel: [72, 0, 0, 74, 76, 0, 77, 0, 76, 74, 0, 0, 74, 0, 0, 76, 77, 0, 79, 0, 77, 76, 0, 0] },
};
export function music(m) { mood = m; ctx(); startLoop(); }
function startLoop() {
  if (timer || !ac) return;
  nextT = ac.currentTime + 0.1;
  timer = setInterval(() => {
    if (!ac || !mood || muted || document.hidden) { if (ac) nextT = ac.currentTime + 0.1; return; }
    const M = MOODS[mood]; const sd = 60 / M.bpm / 2;
    while (nextT < ac.currentTime + 0.3) {
      const s = step % 24, bar = Math.floor(s / 6), ch = M.chords[bar];
      if (s % 6 === 0) { pad(ch, nextT, sd * 6.2, mood === 'mystery' ? 0.02 : 0.022); tone(mtof(ch[0] - 12), sd * 5, { type: 'sine', vol: 0.05, t0: nextT, attack: 0.02, bus: mus }); }
      const n = M.mel[s]; if (n) box(n, nextT, M.arp ? 0.04 : 0.06);
      nextT += sd; step++;
    }
  }, 60);
}
export function ambience(kind) {   // 'sea' | 'room' | null — soft surf under harbour scenes
  if (!ctx()) return;
  amb.gain.setTargetAtTime(kind === 'sea' ? 0.5 : kind === 'room' ? 0.08 : 0, ac.currentTime, 0.6);
  if (!surf) {
    surf = ac.createBufferSource(); surf.buffer = nb(); surf.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = ac.createGain(); g.gain.value = 0.05;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    surf.connect(f); f.connect(g); g.connect(amb); surf.start();
  }
}
export const S = {
  tap: () => tone(880, 0.06, { type: 'triangle', vol: 0.035, slide: 1.2 }),
  next: () => { tone(1320, 0.05, { vol: 0.02 }); },
  choice: () => { [72, 76, 79].forEach((m, i) => tone(mtof(m), 0.4, { vol: 0.05, at: i * 0.05 })); },
  pick: () => { [79, 84].forEach((m, i) => tone(mtof(m), 0.5, { vol: 0.06, at: i * 0.07 })); hiss(0.2, { vol: 0.02, f: 5000 }); },
  heart: () => { [76, 81, 88].forEach((m, i) => tone(mtof(m), 0.5, { vol: 0.05, at: i * 0.08 })); },
  coin: () => { tone(mtof(88), 0.12, { type: 'square', vol: 0.02 }); tone(mtof(95), 0.3, { type: 'square', vol: 0.02, at: 0.07 }); },
  clue: () => { [67, 71, 74, 79].forEach((m, i) => tone(mtof(m), 0.6, { vol: 0.045, at: i * 0.06 })); },
  photo: () => { hiss(0.08, { vol: 0.08, f: 3000 }); tone(2000, 0.04, { type: 'square', vol: 0.02, at: 0.05 }); hiss(0.25, { vol: 0.04, f: 1500, at: 0.1, slide: 0.5 }); },
  swoosh: () => hiss(0.5, { vol: 0.05, f: 500, slide: 3 }),
  light: () => { pad([57, 64, 69, 76], ac ? ac.currentTime : 0, 3.5, 0.04); [76, 81, 88].forEach((m, i) => tone(mtof(m), 2.5, { vol: 0.05, at: i * 0.9, attack: 0.3 })); hiss(2.5, { vol: 0.04, f: 1200, slide: 2 }); },
  cliff: () => { tone(mtof(45), 2.5, { type: 'triangle', vol: 0.08, attack: 0.05 }); tone(mtof(52), 2.5, { type: 'sine', vol: 0.05, at: 0.2 }); [69, 72, 76, 81].forEach((m, i) => tone(mtof(m), 1.8, { vol: 0.045, at: 0.3 + i * 0.18 })); },
  win: () => { [72, 76, 79, 84, 88].forEach((m, i) => tone(mtof(m), 0.7, { vol: 0.055, at: i * 0.09 })); },
  wrong: () => { tone(220, 0.3, { type: 'triangle', vol: 0.05, slide: 0.7 }); },
  roll: () => { for (let i = 0; i < 8; i++) tone(90 + i * 6, 0.07, { type: 'triangle', vol: 0.04, at: i * 0.09 }); },
  thud: () => { tone(110, 0.25, { vol: 0.1, slide: 0.5 }); hiss(0.15, { vol: 0.05, f: 300 }); },
  door: () => { [84, 88, 91].forEach((m, i) => tone(mtof(m), 0.9, { vol: 0.04, at: i * 0.12 })); },
  gull: () => { tone(1400, 0.25, { type: 'sawtooth', vol: 0.008, slide: 0.7 }); tone(1500, 0.22, { type: 'sawtooth', vol: 0.007, slide: 0.65, at: 0.3 }); },
};

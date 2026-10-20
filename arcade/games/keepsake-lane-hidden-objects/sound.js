// Keepsake Lane sound: a soft music-box waltz composed in code + warm chimes, plucks and pops. Mute is remembered.
let ac = null, master = null, musicBus = null, fxBus = null, rev = null, muted = false, song = null;
try { muted = localStorage.getItem('keepsake_mute') === '1'; } catch (e) {}

export function ctx() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    // small generated reverb (soft room)
    rev = ac.createConvolver(); const len = ac.sampleRate * 1.6, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = b; const rg = ac.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master); musicBus.connect(rev);
    fxBus = ac.createGain(); fxBus.gain.value = 0.8; fxBus.connect(master); fxBus.connect(rev);
  } catch (e) { ac = null; }
  return ac;
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; try { localStorage.setItem('keepsake_mute', m ? '1' : '0'); } catch (e) {} if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }

const f = m => 440 * Math.pow(2, (m - 69) / 12);
// music-box bell: sine + inharmonic partials, fast attack, long decay
function bell(m, t, dur = 1.4, vol = 0.16, bus = fxBus) {
  if (!ac) return; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(bus);
  for (const [k, v] of [[1, 1], [2.76, 0.28], [5.4, 0.1], [2, 0.18]]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f(m) * k; const og = ac.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); }
}
function pluck(m, t, dur = 0.5, vol = 0.1, type = 'triangle', bus = fxBus) {
  if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + dur);
  o.type = type; o.frequency.value = f(m); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function pad(ms, t, dur, vol = 0.03) {
  if (!ac) return; const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur); g.connect(musicBus);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
  for (const m of ms) for (const d of [-5, 5]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
}
function noise(t, dur, vol, hp = 2000) {
  if (!ac) return; const n = ac.createBufferSource(), b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = b; const fl = ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = hp; const g = ac.createGain(); g.gain.value = vol; n.connect(fl); fl.connect(g); g.connect(fxBus); n.start(t);
}

// ---------------------------------------------------------------- music: original waltz in F major (3/4), music box + soft pad + plucked bass
const BAR = 2.0; // seconds per bar (90 bpm, 3 beats)
const CH = [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55], [53, 57, 60], [46, 50, 53], [48, 52, 55], [53, 57, 60]];
// melody: [beat, midi, length beats] per bar
const MEL = [
  [[0, 72, 1], [1, 69, 1], [2, 70, 1]], [[0, 74, 2], [2, 72, 1]], [[0, 70, 1], [1, 69, 1], [2, 67, 1]], [[0, 69, 1.5], [1.5, 67, 0.5], [2, 64, 1]],
  [[0, 65, 1], [1, 69, 1], [2, 72, 1]], [[0, 74, 1], [1, 77, 1], [2, 74, 1]], [[0, 72, 1], [1, 70, 1], [2, 67, 1]], [[0, 65, 3]],
];
const MEL2 = [
  [[0, 77, 1], [1, 76, 1], [2, 74, 1]], [[0, 72, 2], [2, 69, 1]], [[0, 70, 1], [1, 72, 1], [2, 74, 1]], [[0, 72, 3]],
  [[0, 69, 1], [1, 72, 1], [2, 77, 1]], [[0, 76, 1.5], [1.5, 74, 0.5], [2, 70, 1]], [[0, 69, 1], [1, 67, 1], [2, 64, 1]], [[0, 65, 3]],
];
export function startMusic() {
  if (!ctx() || song) return;
  let bar = 0, next = ac.currentTime + 0.1;
  const tick = () => {
    while (next < ac.currentTime + 0.6) {
      const i = bar % 8, ch = CH[i], mel = (Math.floor(bar / 8) % 2 ? MEL2 : MEL)[i], bt = BAR / 3;
      pluck(ch[0] - 12, next, 1.2, 0.07, 'triangle', musicBus);
      for (const b of [1, 2]) for (const m of ch.slice(1)) pluck(m, next + b * bt, 0.35, 0.025, 'sine', musicBus);
      if (bar % 2 === 0) pad(ch, next, BAR * 2, 0.012);
      for (const [b, m, l] of mel) bell(m + 12, next + b * bt, Math.max(0.6, l * bt * 1.4), 0.05, musicBus);
      next += BAR; bar++;
    }
  };
  tick(); song = setInterval(tick, 200);
}
export function stopMusic() { if (song) { clearInterval(song); song = null; } }

// ---------------------------------------------------------------- effects
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
export function found(combo = 0) { if (!ctx()) return; const t = ac.currentTime, b = Math.min(5, combo);
  bell(PENTA[b], t, 1.2, 0.17); bell(PENTA[b + 2], t + 0.07, 1.2, 0.13); bell(PENTA[b + 4], t + 0.14, 1.6, 0.11); noise(t, 0.25, 0.04, 6000); }
export function miss() { if (!ctx()) return; const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.18);
  g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(fxBus); o.start(t); o.stop(t + 0.25); pluck(58, t + 0.02, 0.2, 0.05, 'square'); }
export function tap() { if (!ctx()) return; pluck(84, ac.currentTime, 0.12, 0.06, 'sine'); }
export function pop() { if (!ctx()) return; const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(fxBus); o.start(t); o.stop(t + 0.14); }
export function hint() { if (!ctx()) return; const t = ac.currentTime; [79, 84, 88, 91, 96].forEach((m, i) => bell(m, t + i * 0.06, 0.9, 0.07)); noise(t, 0.5, 0.03, 7000); }
export function star(i) { if (!ctx()) return; const t = ac.currentTime; bell([76, 79, 84][i] || 84, t, 1.4, 0.16); bell(([76, 79, 84][i] || 84) + 7, t + 0.05, 1.2, 0.08); }
export function win() { if (!ctx()) return; const t = ac.currentTime; [65, 69, 72, 77, 81, 84].forEach((m, i) => bell(m + 12, t + i * 0.09, 1.6, 0.12)); pad([65, 69, 72, 77], t, 2.2, 0.03); }
export function lose() { if (!ctx()) return; const t = ac.currentTime; [72, 70, 67, 65].forEach((m, i) => pluck(m, t + i * 0.16, 0.6, 0.08)); }
export function whoosh() { if (!ctx()) return; noise(ac.currentTime, 0.35, 0.05, 1200); }
export function tick() { if (!ctx()) return; pluck(96, ac.currentTime, 0.05, 0.05, 'square'); }
export function page() { if (!ctx()) return; const t = ac.currentTime; noise(t, 0.2, 0.05, 3000); bell(84, t + 0.05, 0.7, 0.06); }

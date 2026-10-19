// audio.js — Grindhaven sound: an original laid-back boom-bap loop composed in code, rolling-wheel noise,
// grind hiss, pop/land clacks. One AudioContext, created on the first touch or key.
let AC = null, master, music, fx, noiseBuf, rollG, rollF, grindG, nextT = 0, step = 0, timer = 0, muted = false;
const BPM = 92, SIX = 60 / BPM / 4;
// 4 bars: roots + chord tones (MIDI). Original progression.
const BARS = [[41, [53, 57, 60, 64]], [40, [52, 55, 59, 62]], [38, [50, 53, 57, 60]], [43, [50, 55, 59, 62]]];
const LEAD = [0, -1, 2, -1, 1, -1, -1, 3, -1, 2, -1, -1, 0, -1, 1, -1];   // index into chord tones (+12), -1 = rest
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

export function initAudio(on = true) {
  muted = !on;
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(AC.destination);
  music = AC.createGain(); music.gain.value = 0.32; music.connect(master);
  fx = AC.createGain(); fx.gain.value = 0.9; fx.connect(master);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const loopNoise = () => { const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };
  rollF = AC.createBiquadFilter(); rollF.type = 'lowpass'; rollF.frequency.value = 500; rollG = AC.createGain(); rollG.gain.value = 0;
  loopNoise().connect(rollF); rollF.connect(rollG); rollG.connect(fx);
  const gf = AC.createBiquadFilter(); gf.type = 'bandpass'; gf.frequency.value = 3200; gf.Q.value = 3; grindG = AC.createGain(); grindG.gain.value = 0;
  loopNoise().connect(gf); gf.connect(grindG); grindG.connect(fx);
  nextT = AC.currentTime + 0.1;
  timer = setInterval(schedule, 50);
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, AC.currentTime, 0.05); }
export const isMuted = () => muted;

function env(node, t, a, peak, dec) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function osc(type, f, t, dur, peak, dest, slide = 0) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  env(g, t, 0.005, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, peak, type, freq, dest, q = 1) {
  const s = AC.createBufferSource(); s.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = AC.createGain(); env(g, t, 0.002, peak, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function schedule() {
  if (!AC || document.visibilityState === 'hidden') return;
  while (nextT < AC.currentTime + 0.25) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, [root, ch] = BARS[bar], t = nextT, swing = s % 2 ? SIX * 0.12 : 0;
    if (s === 0 || s === 7 || s === 10) osc('sine', 130, t, 0.22, 0.9, music, 42);                 // kick
    if (s === 4 || s === 12) { noise(t, 0.16, 0.5, 'bandpass', 1900, music, 0.8); osc('triangle', 210, t, 0.08, 0.25, music, 150); }   // snare
    if (s % 2 === 0) noise(t + swing, s % 4 === 2 ? 0.06 : 0.03, 0.12, 'highpass', 7500, music); // hats
    if (s === 0 || s === 6 || s === 8 || s === 14) osc('triangle', hz(root + (s === 14 ? 7 : 0)), t, 0.32, 0.5, music);   // bass
    if (s === 0) for (const n of ch) { const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = hz(n); f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + SIX * 15); o.connect(f); f.connect(g); g.connect(music); o.start(t); o.stop(t + SIX * 16); }
    if (bar % 2 === 1 && LEAD[s] >= 0) osc('square', hz(ch[LEAD[s]] + 12), t + swing, 0.14, 0.05, music);
    nextT += SIX; step++;
  }
}
const now = () => AC ? AC.currentTime : 0;
export const snd = {
  pop() { if (!AC) return; const t = now(); noise(t, 0.05, 0.9, 'bandpass', 1400, fx, 1.5); osc('square', 180, t, 0.06, 0.25, fx, 90); },
  flip() { if (!AC) return; const t = now(); noise(t, 0.18, 0.25, 'bandpass', 900, fx, 0.7); },
  land(hard = 1) { if (!AC) return; const t = now(); osc('sine', 110, t, 0.18, 0.8 * hard, fx, 45); noise(t, 0.08, 0.6 * hard, 'bandpass', 1100, fx, 1); },
  grindOn() { if (!AC) return; const t = now(); osc('square', 1900, t, 0.08, 0.12, fx, 1500); noise(t, 0.06, 0.5, 'highpass', 3000, fx); },
  bail() { if (!AC) return; const t = now(); osc('sawtooth', 300, t, 0.35, 0.25, fx, 80); osc('sine', 90, t + 0.15, 0.3, 0.8, fx, 40); noise(t + 0.15, 0.25, 0.5, 'lowpass', 600, fx); },
  bank(n) { if (!AC) return; const t = now(); [72, 76, 79, 84].slice(0, 2 + Math.min(2, n)).forEach((m, i) => osc('triangle', hz(m), t + i * 0.07, 0.18, 0.22, fx)); },
  chime() { if (!AC) return; const t = now(); [79, 83, 86, 91].forEach((m, i) => osc('sine', hz(m), t + i * 0.09, 0.4, 0.25, fx)); },
  bonk() { if (!AC) return; const t = now(); osc('square', 140, t, 0.12, 0.3, fx, 70); },
  tick() { if (!AC) return; osc('sine', 1200, now(), 0.05, 0.15, fx); },
};
export function setRoll(speed, grounded, grinding) {
  if (!AC) return; const t = AC.currentTime;
  rollG.gain.setTargetAtTime(grounded && !grinding ? Math.min(0.32, speed * 0.04) : 0, t, 0.05);
  rollF.frequency.setTargetAtTime(300 + speed * 70, t, 0.1);
  grindG.gain.setTargetAtTime(grinding ? 0.14 + Math.min(0.1, speed * 0.01) : 0, t, 0.03);
}

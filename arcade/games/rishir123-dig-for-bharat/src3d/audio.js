/* Synthesised on the fly — no files to load, and it means the
   pick and the trowel can actually sound different. */
let AC = null, NOISE = null;
export let soundOn = true;
export function setSound(v) { soundOn = v; }

function ctx() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const len = Math.floor(AC.sampleRate * 0.5);
      NOISE = AC.createBuffer(1, len, AC.sampleRate);
      const d = NOISE.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    } catch (e) { return null; }
  }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
export function unlockAudio() { ctx(); }

function noise(cut, gain, dur, type = "lowpass") {
  if (!soundOn) return; const c = ctx(); if (!c) return;
  try {
    const s = c.createBufferSource(); s.buffer = NOISE;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = cut;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, c.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(); s.stop(c.currentTime + dur + 0.05);
  } catch (e) {}
}
export const sfxTrowel = () => noise(720, 0.10, 0.16);
export const sfxPick   = () => noise(330, 0.20, 0.26);
export const sfxBrush  = () => noise(3600, 0.045, 0.30, "highpass");
export const sfxBreak  = () => noise(1900, 0.16, 0.32, "highpass");
export const sfxStep   = (inPit) => noise(inPit ? 260 : 430, 0.052, 0.12);

export function sfxFind() {
  if (!soundOn) return; const c = ctx(); if (!c) return;
  try {
    [587.33, 880, 1174.66].forEach((hz, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "triangle"; o.frequency.value = hz;
      const t = c.currentTime + i * 0.085;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.9);
    });
  } catch (e) {}
}
export function sfxPing() {                 // magnetometer
  if (!soundOn) return; const c = ctx(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(1400, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.5);
    g.gain.setValueAtTime(0.07, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0005, c.currentTime + 0.55);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.6);
  } catch (e) {}
}

// Synthesised sound effects via the Web Audio API. No asset files.
// AudioContext must be created from a user gesture (the start button).

import * as Settings from '../settings.js';

let ctx = null;
let masterGain = null;
const BASE_VOLUME = 0.6;

function applySettings() {
  if (!masterGain) return;
  masterGain.gain.value = Settings.get().soundOn ? BASE_VOLUME : 0;
}

Settings.subscribe(applySettings);

export async function initAudio() {
  if (ctx) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = Settings.get().soundOn ? BASE_VOLUME : 0;
  masterGain.connect(ctx.destination);
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
}

function now() { return ctx ? ctx.currentTime : 0; }

function envelope(node, startVol, attack, dur, t0) {
  const t = t0 ?? now();
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(startVol, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ freq, freqEnd, dur, type = 'sine', vol = 0.25, attack = 0.005, delay = 0 }) {
  if (!ctx) return;
  const t0 = now() + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), t0 + dur);
  }
  envelope(gain, vol, attack, dur, t0);
  osc.connect(gain).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBuffer(durSec) {
  const sampleRate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sampleRate * durSec, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function noise({ dur, vol = 0.4, lowpass = 1200, attack = 0.005, delay = 0 }) {
  if (!ctx) return;
  const t0 = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lowpass;
  const gain = ctx.createGain();
  envelope(gain, vol, attack, dur, t0);
  src.connect(filt).connect(gain).connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// --- Effects ---

export function playCast() {
  // Whoosh: high-to-low pitch sweep.
  tone({ freq: 700, freqEnd: 180, dur: 0.25, type: 'sawtooth', vol: 0.18 });
}

export function playSplash() {
  // Water splash: filtered noise burst + low tone underneath.
  noise({ dur: 0.35, vol: 0.35, lowpass: 2200, attack: 0.002 });
  tone({ freq: 380, freqEnd: 120, dur: 0.18, type: 'sine', vol: 0.15, delay: 0.02 });
}

export function playBite() {
  // Two-tone alert.
  tone({ freq: 880, dur: 0.08, type: 'square', vol: 0.2 });
  tone({ freq: 1320, dur: 0.08, type: 'square', vol: 0.2, delay: 0.09 });
}

export function playCatch(rarity = 'common') {
  // Rising arpeggio — rare fish get one extra note.
  const notes = rarity === 'rare'
    ? [523, 659, 784, 1047, 1319]
    : [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.22, delay: i * 0.07 });
  });
}

export function playReel() {
  // Low thump for an empty reel-in.
  tone({ freq: 200, freqEnd: 70, dur: 0.3, type: 'sine', vol: 0.2 });
}

export function playEscape() {
  // Fish got away: descending pitch.
  tone({ freq: 600, freqEnd: 150, dur: 0.4, type: 'triangle', vol: 0.18 });
}

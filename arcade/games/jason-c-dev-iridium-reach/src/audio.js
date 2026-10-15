// audio.js — WebAudio sound. The AudioContext is only created on the first
// user gesture, so headless runs never touch audio and never log autoplay
// errors. Every call is a safe no-op until unlocked.
//
// r15: "No assets" is no longer true and the header used to say so. The
// procedural layer below is unchanged and still asset-free; voice.js adds 49
// recorded lines on top, gated on the same gesture and additionally muted
// under every harness param. What changed HERE is the routing:
//
//   master ── destination
//     ├── sfxBus   ← engine hum, blips, noise bursts, warp swell, klaxon
//     └── voiceBus ← voice.js, one line at a time
//
// The split exists so a voice line can DUCK the procedural layer without
// ducking itself. Ducking is a gain dip on sfxBus, nothing more: 1.0 -> 0.32
// over 120 ms when a line starts, back over 250 ms when it ends. Two-node
// change; every synthesis function below is otherwise byte-for-byte what it
// was in round 14, and the only edit inside them is `master` -> `sfxBus`.
import { initVoice } from './voice.js';

const DUCK_LEVEL = 0.32;
const DUCK_DOWN = 0.12;
const DUCK_UP = 0.25;

export function initAudio(G) {
  let ctx = null;
  let master = null;
  let sfxBus = null, voiceBus = null;
  let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
  let klaxonTimer = null;
  let warpNoise = null, warpGain = null;
  let ducked = 0;   // refcount, so overlapping duck requests cannot strand the dip
  let voice = null; // assigned below; unlock() reads it, hence the forward declaration

  function unlocked() { return ctx !== null && ctx.state === 'running'; }

  function unlock() {
    if (ctx) { try { ctx.resume(); } catch (e) {} return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // r15 bus split — see the header. sfxBus is what ducks; voiceBus is not.
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1.0;
      sfxBus.connect(master);
      voiceBus = ctx.createGain();
      voiceBus.gain.value = 1.35; // recorded speech sits under the synth layer without this
      voiceBus.connect(master);

      // engine hum: two detuned saws through a lowpass
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 48;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'triangle';
      engineOsc2.frequency.value = 96.5;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 220;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(sfxBus);
      engineOsc.start();
      engineOsc2.start();
      try { ctx.resume(); } catch (e) {}
    } catch (e) { ctx = null; }
    // THE ONLY PLACE THE VOICE ASSETS ARE EVER FETCHED. unlock() runs on a
    // real pointerdown/keydown, which a headless capture or fps run never
    // makes; voice.load() is additionally a no-op when muted. Two locks.
    if (ctx && voice) voice.load();
  }

  // Duck the procedural layer under a voice line. A refcount rather than a
  // boolean because preempt fires duck(false) from the outgoing line and
  // duck(true) from the incoming one in the same tick, and a boolean loses
  // that race in whichever order they arrive.
  function duck(on) {
    ducked = Math.max(0, ducked + (on ? 1 : -1));
    if (!ctx || !sfxBus) return;
    try {
      const t = ctx.currentTime;
      const target = ducked > 0 ? DUCK_LEVEL : 1.0;
      sfxBus.gain.cancelScheduledValues(t);
      sfxBus.gain.setValueAtTime(sfxBus.gain.value, t);
      sfxBus.gain.linearRampToValueAtTime(target, t + (ducked > 0 ? DUCK_DOWN : DUCK_UP));
    } catch (e) {}
  }

  function blip(freq, dur, type, gain, sweepTo) {
    if (!unlocked()) return;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g); g.connect(sfxBus);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  function noiseBurst(dur, gain, filterFrom, filterTo) {
    if (!unlocked()) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(filterFrom, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start(t);
    } catch (e) {}
  }

  const A = {
    unlock,
    laser() { blip(920, 0.14, 'square', 0.10, 240); },
    enemyLaser() { blip(560, 0.18, 'sawtooth', 0.05, 160); },
    hit() { noiseBurst(0.12, 0.12, 2400, 300); },
    shieldHit() { blip(180, 0.28, 'sine', 0.16, 60); noiseBurst(0.2, 0.1, 1200, 200); },
    explosion() { noiseBurst(0.9, 0.32, 900, 60); blip(70, 0.7, 'sine', 0.2, 28); },
    overheat() { blip(300, 0.4, 'sawtooth', 0.08, 90); },
    warpSwell() {
      if (!unlocked()) return;
      try {
        const t = ctx.currentTime;
        blip(60, 5.5, 'sawtooth', 0.10, 700);
        const len = Math.floor(ctx.sampleRate * 6);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
        warpNoise = ctx.createBufferSource();
        warpNoise.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(200, t);
        f.frequency.exponentialRampToValueAtTime(2400, t + 5.5);
        f.Q.value = 1.2;
        warpGain = ctx.createGain();
        warpGain.gain.setValueAtTime(0.001, t);
        warpGain.gain.exponentialRampToValueAtTime(0.22, t + 5.0);
        warpGain.gain.exponentialRampToValueAtTime(0.0005, t + 6.0);
        warpNoise.connect(f); f.connect(warpGain); warpGain.connect(sfxBus);
        warpNoise.start(t);
      } catch (e) {}
    },
    klaxonOn() {
      if (klaxonTimer || !unlocked()) return;
      const beep = () => {
        blip(660, 0.35, 'sawtooth', 0.09, 440);
        setTimeout(() => blip(440, 0.35, 'sawtooth', 0.09, 330), 420);
      };
      beep();
      klaxonTimer = setInterval(beep, 1400);
    },
    klaxonOff() {
      if (klaxonTimer) { clearInterval(klaxonTimer); klaxonTimer = null; }
    },
    update(dt) {
      if (!unlocked() || !engineGain) return;
      try {
        const throttle = Math.min(1, Math.abs(G.player.speed) / 140);
        const boost = G.input.boost ? 0.35 : 0;
        engineGain.gain.value += ((0.05 + throttle * 0.11 + boost * 0.08) - engineGain.gain.value) * Math.min(1, dt * 5);
        engineFilter.frequency.value = 180 + throttle * 620 + boost * 500;
        engineOsc.frequency.value = 42 + throttle * 40;
        engineOsc2.frequency.value = 85 + throttle * 82;
      } catch (e) {}
    },
  };

  // ---- voice layer (r15) ----
  // ?novoice=1 is the off-switch arm: it proves the talk-test can go RED and
  // gives the fps pool a paired no-voice arm without a rebuild.
  const NOVOICE = new URLSearchParams(location.search).get('novoice') === '1';
  voice = initVoice(G, {
    ctx: () => ctx,
    voiceNode: () => voiceBus,
    duck,
  }, { off: NOVOICE });
  A.voice = voice;
  // one-call convenience so call sites read as game events, not audio plumbing
  A.say = (key) => voice.play(key);

  // unlock on first gesture only — headless never triggers this
  const g = () => { unlock(); window.removeEventListener('pointerdown', g); window.removeEventListener('keydown', g); };
  window.addEventListener('pointerdown', g);
  window.addEventListener('keydown', g);

  G.audio = A;
  return A;
}

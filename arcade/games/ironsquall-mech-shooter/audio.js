// Ironsquall audio: every sound is synthesised (WebAudio). Layered weapon shots (noise crack + low thump + tail),
// heavy mech footfalls, city ambience, and an adaptive music loop (calm → combat → boss) composed in code.
let ctx = null, master, comp, sfxBus, musBus, verb, verbIn, noiseBuf, ambG, musicOn = true, muted = false;
const now = () => ctx.currentTime;
export function audioReady() { return !!ctx; }
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.gain.value = 0.32; musBus.connect(master);
  // generated reverb tail (open street)
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb); verb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  ambience(); startMusic();
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, now(), 0.05); }
function out(node, wet = 0.2) { node.connect(sfxBus); if (wet > 0) { const g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(verbIn); } }
function noise(t0, dur, { type = 'bandpass', f = 1000, f2 = null, q = 1, vol = 0.3, wet = 0.2, attack = 0.002 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); out(g, wet); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
function osc(t0, dur, { type = 'sine', f = 100, f2 = null, vol = 0.3, wet = 0.1, attack = 0.003, lp = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let n = o; if (lp) { const f3 = ctx.createBiquadFilter(); f3.type = 'lowpass'; f3.frequency.value = lp; o.connect(f3); n = f3; } n.connect(g); out(g, wet); o.start(t0); o.stop(t0 + dur + 0.05);
}
const ok = () => ctx && !muted;
export const S = {
  cannon() { if (!ok()) return; const t = now(), d = 1 + (Math.random() - 0.5) * 0.12;
    noise(t, 0.07, { f: 2400 * d, q: 0.8, vol: 0.22, wet: 0 }); noise(t, 0.16, { type: 'lowpass', f: 1600, f2: 300, vol: 0.28, wet: 0.35 });
    osc(t, 0.13, { f: 150 * d, f2: 45, vol: 0.5, wet: 0 }); osc(t, 0.03, { type: 'square', f: 900 * d, f2: 300, vol: 0.05, wet: 0 }); },
  rocket() { if (!ok()) return; const t = now(); noise(t, 0.5, { f: 500, f2: 2600, q: 1.2, vol: 0.22, wet: 0.3, attack: 0.02 }); osc(t, 0.2, { f: 90, f2: 40, vol: 0.3, wet: 0 }); osc(t, 0.25, { type: 'sawtooth', f: 300, f2: 900, vol: 0.04, wet: 0, lp: 1500 }); },
  boom(s = 1) { if (!ok()) return; const t = now(); noise(t, 1.2 * s, { type: 'lowpass', f: 1800, f2: 90, vol: 0.55 * Math.min(1.2, s), wet: 0.5, attack: 0.004 }); osc(t, 0.6 * s, { f: 80, f2: 28, vol: 0.7 * Math.min(1, s), wet: 0 }); noise(t + 0.02, 0.25, { f: 3200, q: 0.6, vol: 0.12, wet: 0.2 });
    for (let i = 0; i < 5; i++) noise(t + 0.1 + Math.random() * 0.5, 0.05, { f: 1500 + Math.random() * 2000, q: 2, vol: 0.05, wet: 0.3 }); },
  small() { if (!ok()) return; const t = now(); noise(t, 0.35, { type: 'lowpass', f: 2200, f2: 200, vol: 0.35, wet: 0.35 }); osc(t, 0.2, { f: 160, f2: 50, vol: 0.4, wet: 0 }); },
  step(v = 1) { if (!ok()) return; const t = now(); osc(t, 0.22, { f: 62, f2: 32, vol: 0.45 * v, wet: 0.05 }); noise(t, 0.05, { type: 'highpass', f: 2500, vol: 0.05 * v, wet: 0.1 }); osc(t + 0.01, 0.06, { type: 'square', f: 1200, f2: 800, vol: 0.025 * v, wet: 0.1 }); noise(t + 0.04, 0.16, { f: 4200, q: 3, vol: 0.03 * v, wet: 0 }); },
  hit() { if (!ok()) return; const t = now(); osc(t, 0.05, { type: 'triangle', f: 1900, f2: 1500, vol: 0.12, wet: 0 }); },
  kill() { if (!ok()) return; const t = now(); [880, 1320].forEach((f, i) => osc(t + i * 0.05, 0.12, { type: 'triangle', f, vol: 0.12, wet: 0.1 })); },
  bolt() { if (!ok()) return; const t = now(); osc(t, 0.16, { type: 'square', f: 1100, f2: 260, vol: 0.06, wet: 0.2, lp: 2500 }); noise(t, 0.06, { f: 3000, q: 2, vol: 0.05, wet: 0 }); },
  beep() { if (!ok()) return; osc(now(), 0.09, { type: 'square', f: 1560, vol: 0.05, wet: 0, lp: 3000 }); },
  hurt() { if (!ok()) return; const t = now(); noise(t, 0.18, { f: 900, q: 1.5, vol: 0.22, wet: 0.1 }); osc(t, 0.12, { type: 'sawtooth', f: 220, f2: 90, vol: 0.12, wet: 0, lp: 1200 }); },
  shieldHit() { if (!ok()) return; const t = now(); osc(t, 0.2, { type: 'sine', f: 1400, f2: 700, vol: 0.12, wet: 0.3 }); },
  dash() { if (!ok()) return; const t = now(); noise(t, 0.35, { f: 600, f2: 3200, q: 0.8, vol: 0.3, wet: 0.2, attack: 0.01 }); osc(t, 0.2, { f: 80, f2: 160, vol: 0.2, wet: 0 }); },
  jump() { if (!ok()) return; const t = now(); noise(t, 0.6, { type: 'lowpass', f: 700, f2: 2000, vol: 0.3, wet: 0.2, attack: 0.03 }); },
  land() { if (!ok()) return; const t = now(); osc(t, 0.3, { f: 70, f2: 25, vol: 0.6, wet: 0.1 }); noise(t, 0.25, { type: 'lowpass', f: 900, f2: 120, vol: 0.3, wet: 0.2 }); },
  shield() { if (!ok()) return; const t = now(); [523, 659, 784, 1046].forEach((f, i) => osc(t + i * 0.05, 0.3, { type: 'triangle', f, vol: 0.08, wet: 0.4 })); },
  reload() { if (!ok()) return; const t = now(); osc(t, 0.05, { type: 'square', f: 400, vol: 0.06, wet: 0, lp: 2000 }); osc(t + 0.35, 0.06, { type: 'square', f: 700, vol: 0.06, wet: 0, lp: 2500 }); noise(t + 0.4, 0.08, { f: 2000, q: 2, vol: 0.08, wet: 0 }); },
  ready() { if (!ok()) return; const t = now(); osc(t, 0.12, { type: 'triangle', f: 988, vol: 0.06, wet: 0.2 }); osc(t + 0.08, 0.16, { type: 'triangle', f: 1318, vol: 0.06, wet: 0.2 }); },
  win() { if (!ok()) return; const t = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => osc(t + i * 0.09, 0.4, { type: 'triangle', f, vol: 0.12, wet: 0.4 })); },
  alarm() { if (!ok()) return; const t = now(); for (let i = 0; i < 3; i++) osc(t + i * 0.32, 0.26, { type: 'sawtooth', f: 520, f2: 760, vol: 0.06, wet: 0.3, lp: 2000 }); },
  thud() { if (!ok()) return; const t = now(); osc(t, 0.5, { f: 50, f2: 22, vol: 0.8, wet: 0.2 }); noise(t, 0.4, { type: 'lowpass', f: 500, f2: 80, vol: 0.4, wet: 0.3 }); },
};
// sustained laser: returns stop()
export function laserLoop(base = 110) {
  if (!ok()) return () => {};
  const t = now(), g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = 6;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sine';
  o1.frequency.value = base; o2.frequency.value = base * 2.01; o3.frequency.value = base * 16;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 18; lg.gain.value = 900; lfo.connect(lg); lg.connect(f.frequency);
  [o1, o2, o3].forEach(o => o.connect(f)); f.connect(g); out(g, 0.3); [o1, o2, o3, lfo].forEach(o => o.start(t));
  return () => { const e = now(); g.gain.cancelScheduledValues(e); g.gain.setTargetAtTime(0.0001, e, 0.06); [o1, o2, o3, lfo].forEach(o => o.stop(e + 0.4)); };
}
// ------------------------------------------------------------------ ambience: city hum + wind + distant traffic
function ambience() {
  ambG = ctx.createGain(); ambG.gain.value = 0.5; ambG.connect(master);
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ctx.createGain(); g.gain.value = 0.05; s.connect(f); f.connect(g); g.connect(ambG); s.start();
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true; const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2400; f2.Q.value = 0.4; const g2 = ctx.createGain(); g2.gain.value = 0.012; s2.connect(f2); f2.connect(g2); g2.connect(ambG); s2.start(0, 0.7);
  setInterval(() => { if (!ctx || muted || document.hidden) return; const t = now(); if (Math.random() < 0.35) { const o = ctx.createOscillator(), g3 = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; o.type = 'sawtooth'; o.frequency.setValueAtTime(90 + Math.random() * 40, t); o.frequency.linearRampToValueAtTime(140 + Math.random() * 60, t + 2.4); g3.gain.setValueAtTime(0.0001, t); g3.gain.exponentialRampToValueAtTime(0.02, t + 1.2); g3.gain.exponentialRampToValueAtTime(0.0001, t + 3); o.connect(fl); fl.connect(g3); g3.connect(verbIn); o.start(t); o.stop(t + 3.1); }
    if (Math.random() < 0.25) for (let i = 0; i < 2; i++) { const o = ctx.createOscillator(), g3 = ctx.createGain(); o.type = 'triangle'; o.frequency.value = [1760, 2093][i]; g3.gain.setValueAtTime(0.0001, t + i * 0.12); g3.gain.exponentialRampToValueAtTime(0.008, t + i * 0.12 + 0.02); g3.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.15); o.connect(g3); g3.connect(verbIn); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.2); } }, 2500);
}
// ------------------------------------------------------------------ adaptive music: 110 bpm, D minor-ish heroic progression
let intensity = 0, target = 0, step = 0, nextT = 0, musTimer = null;
const BPM = 112, SIX = 60 / BPM / 4;
const PROG = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]];   // Dm  Bb  C  A
const LEAD = [74, 72, 69, 72, 74, 77, 76, 72, 70, 69, 70, 72, 69, 67, 65, 64];
export function setIntensity(v) { target = v; }
function startMusic() { nextT = now() + 0.1; musTimer = setInterval(sched, 25); }
function mOsc(t, f, dur, type, vol, lp = 0, bus = musBus) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); fl.connect(g); } else o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function sched() {
  if (!ctx || muted || document.hidden) { if (ctx) nextT = now() + 0.1; return; }
  intensity += (target - intensity) * 0.02;
  while (nextT < now() + 0.12) {
    const t = nextT, s = step % 16, bar = Math.floor(step / 16) % 4, ch = PROG[bar];
    // pad (always)
    if (s === 0) for (const n of ch) { mOsc(t, mf(n), SIX * 15, 'sawtooth', 0.025, 900); mOsc(t, mf(n) * 1.005, SIX * 15, 'triangle', 0.03, 1400); }
    // hats
    if (s % 2 === 0) { const nb = ctx.createBufferSource(); nb.buffer = noiseBuf; const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 7000; const g = ctx.createGain(); const v = (s % 4 === 2 ? 0.05 : 0.025) * (0.4 + intensity * 0.6); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); nb.connect(hf); hf.connect(g); g.connect(musBus); nb.start(t, Math.random()); nb.stop(t + 0.06); }
    if (intensity > 0.25) {
      // bass: driving 8ths
      if (s % 2 === 0) mOsc(t, mf(ch[0] - 24 + (s === 6 || s === 14 ? 12 : 0)), SIX * 1.8, 'sawtooth', 0.14 * Math.min(1, intensity * 1.5), 520);
      // kick
      if (s % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.5 * Math.min(1, intensity * 1.4), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.22); }
    }
    if (intensity > 0.55) {
      // snare on 2 & 4
      if (s === 4 || s === 12) { const nb = ctx.createBufferSource(); nb.buffer = noiseBuf; const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1800; bf.Q.value = 0.7; const g = ctx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); nb.connect(bf); bf.connect(g); g.connect(musBus); nb.start(t, Math.random()); nb.stop(t + 0.18); mOsc(t, 190, 0.08, 'triangle', 0.08); }
      // arp
      mOsc(t, mf(ch[s % 3] + 12 + (s % 8 > 5 ? 12 : 0)), SIX * 0.9, 'square', 0.03, 2600);
    }
    if (intensity > 0.85 && s % 2 === 0) mOsc(t, mf(LEAD[(s / 2 + bar * 8) % 16]), SIX * 1.9, 'sawtooth', 0.045, 3200);
    nextT += SIX; step++;
  }
}

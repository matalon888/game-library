// Ringbreaker audio: layered synth weapons, explosions, footsteps, ambience drones, alarm and an adaptive music loop.
// Pure WebAudio, everything synthesised in code.
let A = null, master, comp, rev, revSend, musicBus, sfxBus, ambBus, noiseBuf;
let muted = false;
export const audio = { ready: false };

function impulse(ctx, secs = 2.4, decay = 2.6) {
  const len = ctx.sampleRate * secs, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
export function initAudio() {
  if (A) { if (A.state === 'suspended') A.resume(); return; }
  try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  comp = A.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = A.createGain(); master.gain.value = muted ? 0 : 0.8; comp.connect(master); master.connect(A.destination);
  rev = A.createConvolver(); rev.buffer = impulse(A); revSend = A.createGain(); revSend.gain.value = 0.32; revSend.connect(rev); rev.connect(comp);
  sfxBus = A.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp); sfxBus.connect(revSend);
  musicBus = A.createGain(); musicBus.gain.value = 0.32; musicBus.connect(comp);
  ambBus = A.createGain(); ambBus.gain.value = 0.5; ambBus.connect(comp); ambBus.connect(revSend);
  noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  audio.ready = true; startAmbience(); startMusic();
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function isMuted() { return muted; }
export function setReverb(v) { if (revSend) revSend.gain.value = v; }

const now = () => A.currentTime;
function noise(t0, dur, { type = 'bandpass', f = 1200, q = 0.8, vol = 0.5, f2 = null, bus = sfxBus, attack = 0.002 } = {}) {
  const s = A.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random();
  const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = A.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}
function osc(t0, dur, { type = 'sine', f = 100, f2 = null, vol = 0.4, bus = sfxBus, attack = 0.003, curve = 'exp' } = {}) {
  const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); else g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
}
const ok = () => A && !muted && A.state === 'running';

// distance attenuation for world sounds
const att = (d) => Math.max(0.08, Math.min(1, 9 / (d + 3)));

export const snd = {
  pulse() { if (!ok()) return; const t = now(); noise(t, 0.09, { f: 2400, q: 0.7, vol: 0.55 }); osc(t, 0.12, { f: 150, f2: 50, vol: 0.55 }); osc(t, 0.07, { type: 'square', f: 1400, f2: 300, vol: 0.08 }); noise(t + 0.02, 0.32, { type: 'lowpass', f: 900, f2: 200, vol: 0.12 }); },
  scatter() { if (!ok()) return; const t = now(); noise(t, 0.22, { type: 'lowpass', f: 5000, f2: 400, vol: 0.9, q: 0.4 }); osc(t, 0.25, { f: 110, f2: 38, vol: 0.85 }); noise(t + 0.03, 0.7, { type: 'lowpass', f: 700, f2: 120, vol: 0.2 });
    noise(t + 0.38, 0.06, { f: 3000, vol: 0.15 }); noise(t + 0.48, 0.05, { f: 2200, vol: 0.15 }); },
  rail() { if (!ok()) return; const t = now(); osc(t, 0.5, { type: 'sawtooth', f: 2200, f2: 90, vol: 0.18 }); noise(t, 0.15, { f: 6000, q: 0.5, vol: 0.8 }); osc(t, 0.4, { f: 80, f2: 30, vol: 0.9 });
    noise(t + 0.02, 1.4, { type: 'bandpass', f: 1800, f2: 300, q: 2, vol: 0.18 }); osc(t + 0.05, 0.9, { type: 'sine', f: 520, f2: 260, vol: 0.06 }); },
  dry() { if (!ok()) return; const t = now(); noise(t, 0.03, { f: 4000, q: 3, vol: 0.2 }); },
  reload(kind = 0) { if (!ok()) return; const t = now(); noise(t, 0.05, { f: 1800, q: 4, vol: 0.25 }); noise(t + 0.35, 0.06, { f: 900, q: 5, vol: 0.3 }); osc(t + 0.36, 0.05, { type: 'square', f: 300, f2: 200, vol: 0.05 });
    noise(t + (kind === 1 ? 0.95 : 0.75), 0.07, { f: 2600, q: 6, vol: 0.32 }); osc(t + 0.8, 0.15, { type: 'sine', f: 880, f2: 1300, vol: 0.05 }); },
  throwG() { if (!ok()) return; const t = now(); noise(t, 0.2, { f: 600, f2: 2000, q: 1, vol: 0.2 }); osc(t, 0.08, { type: 'triangle', f: 1600, f2: 2400, vol: 0.05 }); },
  boom(d = 5, big = 1) { if (!ok()) return; const t = now(), a = att(d) * big; osc(t, 0.9, { f: 70, f2: 22, vol: 1.0 * a }); noise(t, 1.6, { type: 'lowpass', f: 3000, f2: 90, vol: 0.9 * a, q: 0.3 });
    noise(t + 0.04, 0.4, { f: 1200, q: 0.5, vol: 0.4 * a }); for (let i = 0; i < 5; i++) noise(t + 0.15 + Math.random() * 0.6, 0.05, { f: 2500 + Math.random() * 3000, q: 4, vol: 0.12 * a }); },
  arc(d = 5) { if (!ok()) return; const t = now(), a = att(d); for (let i = 0; i < 6; i++) osc(t + i * 0.03, 0.06, { type: 'sawtooth', f: 200 + Math.random() * 900, f2: 60, vol: 0.12 * a }); noise(t, 0.3, { f: 5000, q: 2, vol: 0.3 * a }); },
  hit() { if (!ok()) return; const t = now(); osc(t, 0.05, { type: 'square', f: 2400, f2: 1800, vol: 0.06 }); noise(t, 0.04, { f: 5000, q: 3, vol: 0.12 }); },
  crit() { if (!ok()) return; const t = now(); osc(t, 0.08, { type: 'square', f: 3200, f2: 2600, vol: 0.07 }); osc(t + 0.04, 0.08, { type: 'square', f: 4200, f2: 3600, vol: 0.05 }); },
  shieldHit() { if (!ok()) return; const t = now(); osc(t, 0.15, { type: 'sine', f: 900, f2: 600, vol: 0.12 }); noise(t, 0.1, { f: 3500, q: 6, vol: 0.12 }); },
  kill(d = 5) { if (!ok()) return; const t = now(), a = att(d); noise(t, 0.5, { type: 'bandpass', f: 1500, f2: 200, q: 1.5, vol: 0.5 * a }); osc(t, 0.35, { type: 'square', f: 220, f2: 40, vol: 0.18 * a });
    for (let i = 0; i < 4; i++) noise(t + 0.08 + i * 0.07, 0.05, { f: 3000 + i * 800, q: 8, vol: 0.15 * a }); osc(t, 0.12, { type: 'triangle', f: 1300, f2: 1900, vol: 0.06 }); },
  enemyShot(d = 8, kind = 0) { if (!ok()) return; const t = now(), a = att(d);
    if (kind === 2) { osc(t, 0.5, { type: 'sawtooth', f: 160, f2: 50, vol: 0.4 * a }); noise(t, 0.4, { type: 'lowpass', f: 1200, f2: 200, vol: 0.4 * a }); return; }
    osc(t, 0.14, { type: 'square', f: kind ? 700 : 1100, f2: kind ? 180 : 260, vol: 0.12 * a }); noise(t, 0.08, { f: 2000, q: 1, vol: 0.25 * a }); },
  telegraph(d = 8) { if (!ok()) return; const t = now(), a = att(d); osc(t, 0.45, { type: 'sine', f: 400, f2: 1600, vol: 0.06 * a }); },
  whiz() { if (!ok()) return; const t = now(); noise(t, 0.15, { f: 3000, f2: 900, q: 3, vol: 0.12 }); },
  hurt(shield) { if (!ok()) return; const t = now(); if (shield) { osc(t, 0.2, { type: 'sine', f: 520, f2: 260, vol: 0.18 }); noise(t, 0.12, { f: 4000, q: 2, vol: 0.18 }); } else { osc(t, 0.25, { f: 90, f2: 40, vol: 0.6 }); noise(t, 0.2, { type: 'lowpass', f: 600, vol: 0.4 }); } },
  shieldDown() { if (!ok()) return; const t = now(); osc(t, 0.5, { type: 'sawtooth', f: 900, f2: 120, vol: 0.12 }); },
  shieldUp() { if (!ok()) return; const t = now(); osc(t, 0.4, { type: 'sine', f: 300, f2: 900, vol: 0.08 }); },
  step(i = 0) { if (!ok()) return; const t = now(); noise(t, 0.07, { type: 'bandpass', f: 220 + (i % 2) * 60, q: 1.2, vol: 0.22 }); noise(t, 0.03, { f: 3200, q: 4, vol: 0.04 }); },
  land() { if (!ok()) return; const t = now(); noise(t, 0.14, { type: 'lowpass', f: 400, vol: 0.4 }); osc(t, 0.1, { f: 70, f2: 40, vol: 0.3 }); },
  door() { if (!ok()) return; const t = now(); noise(t, 1.0, { type: 'bandpass', f: 300, f2: 900, q: 1.2, vol: 0.35, attack: 0.15 }); osc(t, 0.12, { type: 'square', f: 660, vol: 0.05 }); osc(t + 0.14, 0.12, { type: 'square', f: 990, vol: 0.05 }); noise(t + 0.9, 0.12, { type: 'lowpass', f: 300, vol: 0.4 }); },
  beep(hi = 0) { if (!ok()) return; const t = now(); osc(t, 0.08, { type: 'square', f: hi ? 1320 : 880, vol: 0.06, bus: sfxBus }); },
  objective() { if (!ok()) return; const t = now(); [523, 784, 1046].forEach((f, i) => osc(t + i * 0.09, 0.4, { type: 'triangle', f, vol: 0.12 })); osc(t, 0.6, { f: 130, vol: 0.2 }); },
  spawn(d = 8) { if (!ok()) return; const t = now(), a = att(d); osc(t, 0.6, { type: 'sawtooth', f: 60, f2: 300, vol: 0.12 * a }); noise(t, 0.6, { f: 800, f2: 3000, q: 2, vol: 0.15 * a, attack: 0.3 }); },
  missile(d = 8) { if (!ok()) return; const t = now(), a = att(d); noise(t, 0.6, { f: 1200, f2: 400, q: 1, vol: 0.3 * a }); },
  pickup() { if (!ok()) return; const t = now(); osc(t, 0.1, { type: 'triangle', f: 990, vol: 0.1 }); osc(t + 0.07, 0.15, { type: 'triangle', f: 1480, vol: 0.1 }); },
  swap() { if (!ok()) return; const t = now(); noise(t, 0.05, { f: 1500, q: 5, vol: 0.2 }); noise(t + 0.12, 0.05, { f: 2400, q: 6, vol: 0.22 }); },
  ui() { if (!ok()) return; const t = now(); osc(t, 0.06, { type: 'square', f: 1200, f2: 900, vol: 0.05 }); },
  win() { if (!ok()) return; const t = now(); [392, 523, 659, 784, 1046].forEach((f, i) => { osc(t + i * 0.12, 0.6, { type: 'triangle', f, vol: 0.12 }); osc(t + i * 0.12, 0.6, { type: 'sine', f: f / 2, vol: 0.08 }); }); },
  lose() { if (!ok()) return; const t = now(); [330, 262, 196, 131].forEach((f, i) => osc(t + i * 0.2, 0.6, { type: 'sawtooth', f, vol: 0.06 })); osc(t, 1.8, { f: 60, f2: 30, vol: 0.4 }); },
};

// ---------------------------------------------------------------- ambience (station hum + air) and alarm
let ambNodes = null, alarmOn = false, alarmGain = null;
function startAmbience() {
  const t = now(), g = A.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.5, t + 2); g.connect(ambBus);
  const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 3; lp.connect(g);
  const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 110; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  for (const [f, ty, v] of [[41.2, 'sawtooth', 0.2], [41.6, 'sawtooth', 0.2], [61.7, 'triangle', 0.15], [120, 'sine', 0.05]]) { const o = A.createOscillator(), og = A.createGain(); o.type = ty; o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(lp); o.start(); }
  const air = A.createBufferSource(); air.buffer = noiseBuf; air.loop = true; const af = A.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 500; af.Q.value = 0.4; const ag = A.createGain(); ag.gain.value = 0.06; air.connect(af); af.connect(ag); ag.connect(g); air.start();
  alarmGain = A.createGain(); alarmGain.gain.value = 0; alarmGain.connect(ambBus);
  const ao = A.createOscillator(); ao.type = 'square'; ao.frequency.value = 620; const af2 = A.createBiquadFilter(); af2.type = 'lowpass'; af2.frequency.value = 1400; ao.connect(af2); af2.connect(alarmGain); ao.start();
  const sw = A.createOscillator(), sg = A.createGain(); sw.type = 'square'; sw.frequency.value = 1.1; sg.gain.value = 140; sw.connect(sg); sg.connect(ao.frequency); sw.start();
  ambNodes = { g, lp };
}
export function setAlarm(on) { if (!A || !alarmGain || on === alarmOn) return; alarmOn = on; alarmGain.gain.setTargetAtTime(on ? 0.035 : 0, now(), 0.3); }
export function setAmbience(level) { if (ambNodes) ambNodes.g.gain.setTargetAtTime(level, now(), 0.5); }

// ---------------------------------------------------------------- adaptive music (100 bpm, D minor) composed in code
// layer 0: pad + pulse bass (explore). layer 1: drums + arp (combat). layer 2: lead + toms (boss / defend)
let intensity = 0, target = 0, step = 0, nextT = 0, musicTimer = null;
const BPM = 104, S16 = 60 / BPM / 4;
const PROG = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]];   // Dm  Bb  C  A
const LEAD = [74, 0, 72, 74, 77, 0, 76, 74, 72, 0, 69, 0, 70, 72, 69, 0];
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
export function setIntensity(v) { target = v; }
function startMusic() {
  nextT = now() + 0.2;
  musicTimer = setInterval(() => { if (!A) return; while (nextT < now() + 0.12) { sched(step, nextT); nextT += S16; step++; } intensity += (target - intensity) * 0.05; }, 40);
}
function sched(s, t) {
  if (muted) return;
  const bar = Math.floor(s / 16) % 4, i = s % 16, ch = PROG[bar];
  // pad on the bar
  if (i === 0) for (const m of ch) { const o = A.createOscillator(), o2 = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter(); o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.value = mf(m); o2.frequency.value = mf(m) * 1.006; lp.type = 'lowpass'; lp.frequency.value = 700 + intensity * 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + S16 * 16);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musicBus); g.connect(revSend); o.start(t); o2.start(t); o.stop(t + S16 * 16 + 0.1); o2.stop(t + S16 * 16 + 0.1); }
  // pulse bass
  if (i % 2 === 0) { const m = ch[0] - 12 + (i === 6 || i === 14 ? 12 : 0); const o = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mf(m);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(300 + intensity * 700, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.18); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(lp); lp.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25); }
  if (intensity > 0.3) {
    const v = Math.min(1, (intensity - 0.3) / 0.4);
    if (i % 4 === 0) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.22); }
    if (i % 8 === 4) { const s2 = A.createBufferSource(); s2.buffer = noiseBuf; const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = A.createGain(); g.gain.setValueAtTime(0.28 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s2.connect(f); f.connect(g); g.connect(musicBus); g.connect(revSend); s2.start(t, Math.random()); s2.stop(t + 0.2); }
    if (i % 2 === 1) { const s2 = A.createBufferSource(); s2.buffer = noiseBuf; const f = A.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = A.createGain(); g.gain.setValueAtTime(0.07 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s2.connect(f); f.connect(g); g.connect(musicBus); s2.start(t, Math.random()); s2.stop(t + 0.05); }
    { const m = ch[i % 3] + 12 + (i % 8 > 5 ? 12 : 0); const o = A.createOscillator(), g = A.createGain(); o.type = 'square'; o.frequency.value = mf(m); g.gain.setValueAtTime(0.025 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g); g.connect(musicBus); g.connect(revSend); o.start(t); o.stop(t + 0.12); }
  }
  if (intensity > 0.75) {
    const v = Math.min(1, (intensity - 0.75) / 0.25), m = LEAD[i] ? LEAD[i] - (bar === 3 ? 1 : 0) : 0;
    if (m && i % 2 === 0) { const o = A.createOscillator(), g = A.createGain(); o.type = 'sawtooth'; o.frequency.value = mf(m); const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.04 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + S16 * 2); o.connect(lp); lp.connect(g); g.connect(musicBus); g.connect(revSend); o.start(t); o.stop(t + S16 * 2 + 0.05); }
    if (i === 14 || i === 15) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(i === 14 ? 180 : 130, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.2); g.gain.setValueAtTime(0.3 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3); }
  }
}

// Voidlance audio: layered synth weapons, explosions, engine + ambience drones and an adaptive music loop, all WebAudio.
let A = null, master, sfxBus, musBus, comp, noiseBuf, engine = null, music = null, muted = false;

export function audioInit() {
  if (A) { if (A.state === 'suspended') A.resume(); return A; }
  try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  comp = A.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = A.createGain(); master.gain.value = muted ? 0 : 0.9;
  sfxBus = A.createGain(); sfxBus.gain.value = 1; musBus = A.createGain(); musBus.gain.value = 0.42;
  sfxBus.connect(comp); musBus.connect(comp); comp.connect(master); master.connect(A.destination);
  noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return A;
}
export const setMuted = m => { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, A.currentTime, 0.05); };
export const isMuted = () => muted;

const now = () => A.currentTime;
function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function noise(t, dur, { type = 'lowpass', f = 1200, f2 = null, q = 0.8, vol = 0.3, a = 0.003, pan = 0, out = sfxBus } = {}) {
  const s = A.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = A.createGain(); env(g, t, a, vol, dur);
  let node = g; if (pan && A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  s.connect(fl); fl.connect(g); node.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
}
function osc(t, dur, { type = 'sine', f = 220, f2 = null, vol = 0.2, a = 0.003, pan = 0, out = sfxBus, filt = null } = {}) {
  const o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = A.createGain(); env(g, t, a, vol, dur);
  let src = o; if (filt) { const fl = A.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); src = fl; }
  let node = g; if (pan && A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  src.connect(g); node.connect(out); o.start(t); o.stop(t + a + dur + 0.05);
}

export const S = {
  laser(side = 1, hot = 0) {
    if (!A) return; const t = now(), p = side * 0.35;
    osc(t, 0.11, { type: 'sawtooth', f: 1500 + Math.random() * 200 - hot * 300, f2: 240, vol: 0.075, pan: p, filt: 3800 });
    osc(t, 0.08, { type: 'square', f: 760, f2: 180, vol: 0.04, pan: p });
    noise(t, 0.05, { type: 'highpass', f: 3000, vol: 0.06, pan: p });
    osc(t, 0.09, { type: 'sine', f: 140, f2: 60, vol: 0.12 });
  },
  enemyLaser(vol = 1) { if (!A || vol < 0.03) return; const t = now(); osc(t, 0.14, { type: 'sawtooth', f: 900, f2: 160, vol: 0.05 * vol, filt: 2400 }); noise(t, 0.06, { type: 'bandpass', f: 1800, vol: 0.03 * vol }); },
  flak(vol = 1) { if (!A || vol < 0.03) return; const t = now(); noise(t, 0.25, { f: 900, f2: 200, vol: 0.12 * vol }); osc(t, 0.2, { type: 'sine', f: 90, f2: 40, vol: 0.12 * vol }); },
  missile() { if (!A) return; const t = now(); noise(t, 0.9, { type: 'bandpass', f: 500, f2: 2600, q: 1.4, vol: 0.22, a: 0.02 }); osc(t, 0.5, { type: 'sawtooth', f: 90, f2: 260, vol: 0.06, filt: 900 }); noise(t, 0.12, { f: 4000, vol: 0.12 }); },
  hit() { if (!A) return; const t = now(); osc(t, 0.07, { type: 'triangle', f: 2100, f2: 1500, vol: 0.06 }); osc(t, 0.06, { type: 'square', f: 3100, vol: 0.025 }); },
  armor() { if (!A) return; const t = now(); noise(t, 0.08, { type: 'bandpass', f: 2600, q: 3, vol: 0.06 }); osc(t, 0.05, { type: 'triangle', f: 900, f2: 600, vol: 0.03 }); },
  shieldHit() { if (!A) return; const t = now(); noise(t, 0.3, { type: 'bandpass', f: 1400, f2: 500, q: 4, vol: 0.2 }); osc(t, 0.25, { type: 'sine', f: 620, f2: 300, vol: 0.08 }); },
  hullHit() { if (!A) return; const t = now(); noise(t, 0.4, { f: 800, f2: 120, vol: 0.4 }); osc(t, 0.3, { type: 'square', f: 70, f2: 38, vol: 0.18, filt: 400 }); noise(t, 0.1, { type: 'highpass', f: 2500, vol: 0.1 }); },
  explode(size = 1, dist = 0) {
    if (!A) return; const t = now(), v = Math.min(1, 1.6 / (1 + dist / 160)) * Math.min(1.6, 0.55 + size * 0.35);
    if (v < 0.02) return;
    noise(t, 0.5 + size * 0.5, { f: 2600, f2: 90, vol: 0.5 * v, a: 0.004 });
    noise(t + 0.02, 1.0 + size * 0.7, { f: 500, f2: 60, vol: 0.45 * v, a: 0.02 });
    osc(t, 0.6 + size * 0.3, { type: 'sine', f: 110, f2: 28, vol: 0.5 * v });
    noise(t, 0.12, { type: 'highpass', f: 3500, vol: 0.18 * v });
    if (size > 2) for (let i = 1; i < 4; i++) noise(t + i * 0.12 + Math.random() * 0.1, 0.6, { f: 1200, f2: 100, vol: 0.2 * v });
  },
  lock(stage) { if (!A) return; const t = now(); if (stage === 2) { osc(t, 0.07, { type: 'square', f: 1760, vol: 0.05, filt: 5000 }); osc(t + 0.09, 0.12, { type: 'square', f: 2350, vol: 0.05, filt: 5000 }); } else osc(t, 0.04, { type: 'square', f: 1320, vol: 0.035, filt: 4000 }); },
  warn() { if (!A) return; const t = now(); osc(t, 0.13, { type: 'square', f: 880, vol: 0.05, filt: 2000 }); osc(t + 0.17, 0.13, { type: 'square', f: 660, vol: 0.05, filt: 2000 }); },
  boost() { if (!A) return; const t = now(); noise(t, 0.9, { type: 'bandpass', f: 300, f2: 1800, q: 0.7, vol: 0.25, a: 0.05 }); osc(t, 0.7, { type: 'sawtooth', f: 60, f2: 140, vol: 0.08, filt: 600 }); },
  ui() { if (!A) return; const t = now(); osc(t, 0.05, { type: 'triangle', f: 1200, vol: 0.06 }); osc(t + 0.05, 0.08, { type: 'triangle', f: 1800, vol: 0.05 }); },
  radio() { if (!A) return; const t = now(); noise(t, 0.12, { type: 'bandpass', f: 2200, q: 2, vol: 0.06 }); osc(t + 0.02, 0.05, { type: 'square', f: 1600, vol: 0.02 }); },
  power() { if (!A) return; const t = now(); osc(t, 0.18, { type: 'sawtooth', f: 200, f2: 900, vol: 0.05, filt: 2500 }); },
  overheat() { if (!A) return; const t = now(); noise(t, 0.6, { type: 'highpass', f: 2000, f2: 600, vol: 0.12 }); osc(t, 0.4, { type: 'square', f: 300, f2: 120, vol: 0.05, filt: 900 }); },
  win() { if (!A) return; const t = now(); [57, 64, 69, 72, 76].forEach((m, i) => osc(t + i * 0.12, 0.9, { type: 'sawtooth', f: mf(m), vol: 0.05, filt: 1800 })); },
};
const mf = m => 440 * Math.pow(2, (m - 69) / 12);

// engine hum + ambience drone (always on once started); setEngine(speed01, boost01)
export function engineStart() {
  if (!A || engine) return;
  const t = now(), g = A.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.05, t, 0.6); g.connect(sfxBus);
  const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 2; lp.connect(g);
  const o1 = A.createOscillator(), o2 = A.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 46; o2.frequency.value = 46.7; o1.connect(lp); o2.connect(lp); o1.start(); o2.start();
  const ns = A.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
  const ng = A.createGain(); ng.gain.value = 0.25; ns.connect(bp); bp.connect(ng); ng.connect(g); ns.start();
  // ambience: slow detuned pad drone
  const ag = A.createGain(); ag.gain.value = 0.0001; ag.gain.setTargetAtTime(0.022, t, 2); ag.connect(sfxBus);
  const alp = A.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 500; alp.connect(ag);
  const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 250; lfo.connect(lg); lg.connect(alp.frequency); lfo.start();
  for (const f of [55, 82.4, 110.3, 164.6]) { const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004); o.connect(alp); o.start(); }
  engine = { g, lp, o1, o2, bp, ng };
}
export function setEngine(sp, bo) {
  if (!engine) return; const t = now();
  engine.lp.frequency.setTargetAtTime(220 + sp * 500 + bo * 1400, t, 0.15);
  engine.o1.frequency.setTargetAtTime(40 + sp * 18 + bo * 30, t, 0.2); engine.o2.frequency.setTargetAtTime(40.7 + sp * 18 + bo * 31, t, 0.2);
  engine.bp.frequency.setTargetAtTime(300 + bo * 1500, t, 0.2); engine.ng.gain.setTargetAtTime(0.2 + bo * 0.8, t, 0.1);
}

// adaptive music: A minor, 112 bpm. intensity 0 = pad + soft bass, 1 = drums + arp + lead stabs, boss = extra pulse
const PROG = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];   // Am F Dm E
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
export function musicStart() {
  if (!A || music) return;
  music = { step: 0, next: now() + 0.1, int: 0, target: 0, boss: 0 };
  const spb = 60 / 112 / 4;
  music.timer = setInterval(() => {
    if (!A || A.state !== 'running') return;
    music.int += (music.target - music.int) * 0.05;
    while (music.next < now() + 0.15) { tick(music.step, music.next, spb); music.next += spb; music.step++; }
  }, 25);
}
export function setMusic(intensity, boss = 0) { if (music) { music.target = intensity; music.boss = boss; } }
function tick(s, t, spb) {
  const I = music.int, bar = Math.floor(s / 16) % 4, chord = PROG[bar], st = s % 16, O = musBus;
  if (st === 0) for (const m of chord) osc(t, spb * 15, { type: 'sawtooth', f: mf(m - 12), vol: 0.018, a: 0.3, out: O, filt: 700 + I * 900 });
  if (st % 4 === 0 || (I > 0.5 && st % 4 === 3 && st !== 15)) osc(t, spb * 2.2, { type: 'sawtooth', f: mf(chord[0] - 24), vol: 0.09 + I * 0.04, a: 0.005, out: O, filt: 260 + I * 500 });
  if (I > 0.25) { if (st % 4 === 0) { osc(t, 0.22, { type: 'sine', f: 120, f2: 38, vol: 0.32 * I, out: O }); } if (st % 8 === 4) noise(t, 0.16, { type: 'bandpass', f: 1800, q: 0.8, vol: 0.13 * I, out: O }); if (st % 2 === 0) noise(t, 0.035, { type: 'highpass', f: 7000, vol: 0.03 * I, out: O }); }
  if (I > 0.55) { const m = chord[ARP[st % 8]] + (st >= 8 ? 12 : 0); osc(t, spb * 0.9, { type: 'square', f: mf(m), vol: 0.022 * I, a: 0.004, out: O, filt: 1600 + I * 1600 }); }
  if (music.boss > 0 && st % 2 === 1) osc(t, spb * 0.8, { type: 'sawtooth', f: mf(chord[0] - 12 + (st % 4 === 1 ? 0 : 7)), vol: 0.03, out: O, filt: 1200 });
  if (I > 0.8 && st === 0 && bar % 2 === 0) noise(t, 1.4, { type: 'highpass', f: 5000, f2: 3000, vol: 0.05, a: 0.01, out: O });
}

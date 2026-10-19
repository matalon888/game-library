// music.js — the Beatbuds band: 20 loops (beats, effects, melodies, voices) composed in code over one 4-bar progression
// (Am · F · C · G at 100 BPM), played by a small Web Audio synth with a look-ahead scheduler. Our own code, MIT.
export const BPM = 100, STEP = 60 / BPM / 4, STEPS = 64;   // 16 steps per bar, 4 bars
const CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], ROOT = [45, 41, 48, 43];
const LEAD = [[69, -1, 72, -1, 76, 74, 72, -1], [72, -1, 69, -1, 72, 74, -1, -1], [76, -1, 79, 76, 74, -1, 72, -1], [74, -1, 71, -1, 74, 76, -1, -1]];
const LA = [[64, -1, 64, 67, 69, -1, 67, -1], [65, -1, 65, 64, 60, -1, -1, -1], [64, -1, 67, -1, 72, 71, 67, -1], [67, -1, 69, 71, 74, -1, 71, -1]];
const BELL = [[81, 79, 76, 79], [77, 76, 72, 76], [79, 76, 72, 76], [79, 74, 71, 74]];
const WHIS = [[76, 74], [72, 69], [67, 72], [71, 74]];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const VOW = { oo: [300, 870, 2240], ah: [730, 1090, 2440], ee: [270, 2290, 3010], eh: [530, 1840, 2480], oh: [570, 840, 2410] };

export function engine() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  const master = ac.createGain(); master.gain.value = 0.85; master.connect(comp); comp.connect(ac.destination);
  const verbIn = ac.createGain(); verbIn.gain.value = 0.22;   // a cheap echo "room"
  const dl = ac.createDelay(1); dl.delayTime.value = STEP * 3; const fb = ac.createGain(); fb.gain.value = 0.28; const lp = ac.createBiquadFilter(); lp.frequency.value = 2400;
  verbIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
  const nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const out = (vol, echo = 0) => { const gg = ac.createGain(); gg.gain.value = vol; gg.connect(master); if (echo) { const e = ac.createGain(); e.gain.value = echo; gg.connect(e); e.connect(verbIn); } return gg; };
  function env(gn, t, a, peak, d) { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, dur, vol, dest, { a = 0.005, slide = 0, det = 0 } = {}) {
    const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    env(gn, t, a, vol, dur); o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + a + dur + 0.05); return o;
  }
  function noise(t, dur, vol, dest, type = 'highpass', f = 6000, q = 0.7, a = 0.002) {
    const s = ac.createBufferSource(); s.buffer = nb; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = ac.createGain();
    env(gn, t, a, vol, dur); s.connect(fl); fl.connect(gn); gn.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05); return fl;
  }
  const kick = (t, d, v = 1) => osc('sine', 150, t, 0.32, 0.9 * v, d, { slide: 0.28 });
  const snare = (t, d, v = 1) => { noise(t, 0.16, 0.45 * v, d, 'highpass', 1500); osc('triangle', 190, t, 0.08, 0.3 * v, d, { slide: 0.7 }); };
  const hat = (t, d, v = 1, open = 0) => noise(t, open ? 0.22 : 0.04, 0.22 * v, d, 'highpass', 7500);
  const clap = (t, d, v = 1) => { for (let i = 0; i < 3; i++) noise(t + i * 0.011, i === 2 ? 0.16 : 0.02, 0.4 * v, d, 'bandpass', 1500, 1.2); };
  function voice(m, t, dur, vow, vol, dest, { vib = 5, type = 'sawtooth', a = 0.04 } = {}) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(m);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = vib; lg.gain.value = hz(m) * 0.012; lfo.connect(lg); lg.connect(o.frequency);
    const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + a); gn.gain.setValueAtTime(vol, t + Math.max(a, dur - 0.08)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    const F = VOW[vow] || VOW.ah;
    F.forEach((f, i) => { const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 9 + i * 3; const fg = ac.createGain(); fg.gain.value = [1.2, 0.6, 0.25][i] * 3; o.connect(bp); bp.connect(fg); fg.connect(gn); });
    gn.connect(dest); o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  // each sound: play(step 0-15, bar 0-3, time, dest) → returns a list of visual hits [{dt, amt, len}] (mouth/bounce cues)
  const S = {
    // ---- beats
    thump: (s, b, t, d) => { if (s % 8 === 0) { kick(t, d); return 1; } if (s % 8 === 4) { snare(t, d); return 0.7; } },
    bap: (s, b, t, d) => { let h = 0; if ([0, 7, 10].includes(s)) { kick(t, d); h = 1; } if (s === 4 || s === 12) { snare(t, d, 1.1); h = 0.8; } if (s % 2 === 0) hat(t, d, s % 4 ? 0.6 : 1); return h; },
    floor: (s, b, t, d) => { let h = 0; if (s % 4 === 0) { kick(t, d, 0.95); h = 1; } if (s % 4 === 2) { hat(t, d, 1, 1); h = h || 0.4; } if (s === 4 || s === 12) clap(t, d, 0.7); return h; },
    shaker: (s, b, t, d) => { noise(t, 0.05, [0.22, 0.08, 0.14, 0.08][s % 4], d, 'bandpass', 6500, 1.5, 0.008); if (s === 4 || s === 12) { osc('square', 820, t, 0.03, 0.15, d); return 0.8; } return s % 4 === 0 ? 0.3 : 0; },
    mouth: (s, b, t, d) => { if ([0, 6, 10].includes(s)) { osc('sine', 120, t, 0.12, 0.8, d, { slide: 0.5 }); noise(t, 0.06, 0.12, d, 'lowpass', 400); return 1; } if (s === 4 || s === 12) { noise(t, 0.03, 0.4, d, 'bandpass', 2600, 3); noise(t + 0.02, 0.1, 0.18, d, 'highpass', 4000); return 0.9; } if (s % 2 === 0) { noise(t, 0.08, 0.12, d, 'highpass', 5500); return 0.3; } },
    // ---- effects
    bass: (s, b, t, d) => { if ([0, 3, 6, 8, 11, 14].includes(s)) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 5; f.connect(d); osc('sawtooth', hz(ROOT[b] - 12 + (s === 14 ? 12 : 0)), t, 0.22, 0.5, f); return 1; } },
    wobble: (s, b, t, d) => { if (s % 4 === 0) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 9; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(1600, t + STEP * 2); f.frequency.linearRampToValueAtTime(200, t + STEP * 4); f.connect(d); osc('square', hz(ROOT[b] - 12), t, STEP * 3.8, 0.35, f, { a: 0.02 }); return 1; } },
    claps: (s, b, t, d) => { if (s === 4 || s === 12 || (b % 2 && s === 14)) { clap(t, d, 1); return 1; } },
    riser: (s, b, t, d) => { if (b === 3 && s === 0) { const fl = noise(t, STEP * 16, 0.32, d, 'bandpass', 500, 2, STEP * 15); fl.frequency.setValueAtTime(400, t); fl.frequency.exponentialRampToValueAtTime(7000, t + STEP * 16); } if (b === 0 && s === 0) { osc('sine', 90, t, 0.6, 0.7, d, { slide: 0.35 }); return 1; } return b === 3 ? s / 16 : 0; },
    bleeps: (s, b, t, d) => { const P = [[2, 5, 9, 13], [3, 6, 11], [2, 9, 13, 15], [1, 5, 10]][b]; if (P.includes(s)) { osc('sine', hz(CH[b][(s + b) % 3] + 24), t, 0.09, 0.22, d); return 0.8; } },
    // ---- melodies
    arp: (s, b, t, d) => { const n = CH[b][[0, 1, 2, 1][s % 4]] + 12 + (s >= 8 ? 12 : 0) * 0; osc('triangle', hz(n), t, 0.2, 0.18, d); return s % 4 === 0 ? 0.8 : 0.3; },
    bells: (s, b, t, d) => { if (s % 4 === 0) { const m = BELL[b][s / 4]; osc('sine', hz(m), t, 0.9, 0.2, d); osc('sine', hz(m) * 2.76, t, 0.35, 0.06, d); return 1; } },
    pad: (s, b, t, d) => { if (s === 0) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.connect(d); for (const m of CH[b]) for (const det of [-9, 9]) osc('sawtooth', hz(m), t, STEP * 15.5, 0.07, f, { a: 0.35, det }); return 1; } return s === 8 ? 0.5 : 0; },
    whistle: (s, b, t, d) => { if (s === 0 || s === 8) { const m = WHIS[b][s / 8]; voice(m + 12, t, STEP * 7, 'oo', 0.09, d, { type: 'sine', vib: 6 }); osc('sine', hz(m + 12), t, STEP * 7, 0.08, d, { a: 0.05 }); return 1; } },
    marimba: (s, b, t, d) => { if ([0, 3, 6, 10, 12, 14].includes(s)) { const m = CH[b][[0, 2, 1, 2, 0, 1][[0, 3, 6, 10, 12, 14].indexOf(s)]] + 12; osc('sine', hz(m), t, 0.18, 0.28, d); osc('sine', hz(m) * 4, t, 0.04, 0.06, d); return 0.9; } },
    // ---- voices
    ooh: (s, b, t, d) => { if (s === 0) { CH[b].forEach((m, i) => voice(m, t, STEP * 15, 'oo', 0.07, d, { vib: 4.5 + i * 0.4, a: 0.25 })); return 1; } return s === 8 ? 0.7 : 0; },
    doo: (s, b, t, d) => { if ([0, 6, 8, 12].includes(s)) { voice(ROOT[b], t, s === 8 ? STEP * 1.5 : STEP * 2.5, 'oo', 0.22, d, { vib: 3, a: 0.02 }); return 1; } },
    la: (s, b, t, d) => { if (s % 2 === 0) { const m = LA[b][s / 2]; if (m > 0) { voice(m + 12, t, STEP * 1.7, 'ah', 0.11, d, { a: 0.02 }); return 1; } } },
    hey: (s, b, t, d) => { if (b % 2 === 1 && s === 12) { voice(62, t, 0.22, 'eh', 0.22, d, { vib: 0, a: 0.01 }); noise(t, 0.15, 0.15, d, 'bandpass', 1800, 2); voice(66, t, 0.22, 'eh', 0.12, d, { vib: 0, a: 0.01 }); return 1.3; } },
    hum: (s, b, t, d) => { if (s === 0 || s === 8) { const m = [[64, 60], [60, 57], [64, 67], [62, 59]][b][s / 8]; voice(m, t, STEP * 7.5, 'oh', 0.08, d, { vib: 5, a: 0.12, type: 'triangle' }); return 1; } },
  };
  // bonus fanfare layer that plays over a found combo
  const bonus = (s, b, t, d) => { if (s % 2 === 0) { const m = LEAD[b][s / 2]; if (m > 0) { osc('triangle', hz(m + 12), t, 0.25, 0.12, d); osc('sine', hz(m + 24), t, 0.15, 0.05, d); } } if (s === 0) noise(t, 0.6, 0.12, d, 'highpass', 9000); };
  return { ac, S, bonus, out, master };
}

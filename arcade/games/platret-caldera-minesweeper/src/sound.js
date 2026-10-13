/* ============================================================
   sound.js — tiny synthesized sound effects via the Web Audio API.
   No asset files: every cue is generated from oscillators + noise,
   so it stays offline-friendly and weightless. The AudioContext is
   created lazily on the first cue (after a user gesture) and the
   whole module no-ops when sound is disabled or unsupported.
   ============================================================ */

let ctx = null;
let enabled = false;
let master = null;

export function setEnabled(on) {
  enabled = !!on;
  if (enabled && ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

function ensure() {
  if (!enabled) return null;
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

function tone({ freq = 440, dur = 0.08, type = "sine", gain = 0.18, slideTo = null, delay = 0 }) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.25, gain = 0.4, lp = 1200 } = {}) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lp;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  reveal() { tone({ freq: 320, dur: 0.05, type: "triangle", gain: 0.08 }); },
  cascade() { tone({ freq: 260, slideTo: 520, dur: 0.12, type: "triangle", gain: 0.1 }); },
  flag() { tone({ freq: 660, dur: 0.05, type: "square", gain: 0.07 }); },
  chord() { tone({ freq: 400, slideTo: 600, dur: 0.07, type: "triangle", gain: 0.09 }); },
  explode() {
    noise({ dur: 0.4, gain: 0.5, lp: 900 });
    tone({ freq: 140, slideTo: 50, dur: 0.4, type: "sawtooth", gain: 0.22 });
  },
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((f, i) => tone({ freq: f, dur: 0.22, type: "triangle", gain: 0.16, delay: i * 0.1 }));
  },
  achievement() {
    tone({ freq: 880, dur: 0.1, type: "sine", gain: 0.14 });
    tone({ freq: 1318.5, dur: 0.16, type: "sine", gain: 0.14, delay: 0.09 });
  },
};

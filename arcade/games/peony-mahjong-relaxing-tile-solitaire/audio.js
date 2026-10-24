// Peony Mahjong sound: soft harp plucks, a wooden knock, a two-note chime, and a slow piano loop composed in code.
// Everything goes through one AudioContext made on the first tap; music pauses during ads (ap:ad) and when hidden.
let ctx = null, master = null, musicBus = null, sfxBus = null;
const S = { sound: true, music: true };
let musicTimer = 0, step = 0, paused = false;

function ensure() {
  if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {}); return ctx; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    // a gentle room: two short feedback delays make the plucks bloom
    const verb = ctx.createGain(); verb.gain.value = 0.22;
    for (const [t, fb] of [[0.11, 0.32], [0.17, 0.28]]) {
      const d = ctx.createDelay(1), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      d.delayTime.value = t; g.gain.value = fb; lp.type = 'lowpass'; lp.frequency.value = 2400;
      verb.connect(d); d.connect(lp); lp.connect(g); g.connect(d); lp.connect(master);
    }
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master); musicBus.connect(verb);
  } catch (e) { ctx = null; }
  return ctx;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// harp / piano-ish pluck: a few partials with a fast attack and a soft exponential tail
function pluck(midi, { dur = 1.1, vol = 0.12, bus = 'sfx', when = 0, bright = 1 } = {}) {
  if (!ensure()) return;
  const t = ctx.currentTime + when, g = ctx.createGain(), f = hz(midi);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, f * 6 * bright), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + dur);
  for (const [m, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.32], [3, 'sine', 0.1], [4.01, 'sine', 0.05]]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v;
    o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
  }
  lp.connect(g); g.connect(bus === 'music' ? musicBus : sfxBus);
}
function knock(vol = 0.1) {
  if (!ensure()) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.09);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.14);
}
// a soft clack of two tiles touching
function clack(vol = 0.07) {
  if (!ensure()) return;
  const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * 0.04), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
  const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 2.5; g.gain.value = vol;
  s.connect(bp); bp.connect(g); g.connect(sfxBus); s.start(t);
}

const PENTA = [0, 2, 4, 7, 9];
export const sfx = {
  select(i = 0) { if (!S.sound) return; const n = 67 + PENTA[i % 5] + 12 * Math.floor(i / 5 % 2); pluck(n, { vol: 0.09, dur: 0.9 }); clack(0.05); },
  blocked() { if (!S.sound) return; knock(0.08); },
  match(combo = 0) { if (!S.sound) return; const b = 72 + PENTA[combo % 5]; pluck(b, { vol: 0.1, dur: 1.4 }); pluck(b + 7, { vol: 0.08, dur: 1.6, when: 0.09 }); clack(0.06); },
  undo() { if (!S.sound) return; pluck(64, { vol: 0.07, dur: 0.7 }); pluck(60, { vol: 0.06, dur: 0.8, when: 0.08 }); },
  shuffle() { if (!S.sound) return; [60, 64, 67, 72, 76, 79].forEach((m, i) => pluck(m, { vol: 0.06, dur: 0.6, when: i * 0.05 })); },
  hint() { if (!S.sound) return; pluck(84, { vol: 0.06, dur: 1.2 }); pluck(88, { vol: 0.05, dur: 1.2, when: 0.12 }); },
  win() { if (!S.sound) return; [60, 64, 67, 71, 72, 76, 79, 83, 84].forEach((m, i) => pluck(m, { vol: 0.08, dur: 1.8, when: i * 0.075 })); },
  coin() { if (!S.sound) return; pluck(88, { vol: 0.05, dur: 0.5 }); pluck(93, { vol: 0.045, dur: 0.6, when: 0.06 }); },
  tap() { if (!S.sound) return; pluck(76, { vol: 0.05, dur: 0.4, bright: 0.6 }); },
  stamp() { if (!S.sound) return; knock(0.1); [72, 79, 84].forEach((m, i) => pluck(m, { vol: 0.07, dur: 1.4, when: 0.12 + i * 0.1 })); },
};

// slow piano loop: I – vi – IV – V in F, gentle arpeggios with a sparse melody on top
const CHORDS = [[53, 57, 60, 65], [50, 57, 62, 65], [46, 58, 62, 65], [48, 55, 60, 64]];
const MEL = [[72, -1, 69, -1, 70, 72, -1, -1], [74, -1, 72, -1, 69, -1, -1, -1], [70, -1, 69, 70, 74, -1, 72, -1], [72, -1, 67, -1, -1, -1, -1, -1]];
function tick() {
  if (!S.music || paused || !ctx || document.visibilityState === 'hidden') return;
  const bar = Math.floor(step / 8) % 4, beat = step % 8, ch = CHORDS[bar];
  if (beat === 0) pluck(ch[0] - 12, { vol: 0.05, dur: 3.4, bus: 'music', bright: 0.5 });
  if (beat % 2 === 0) pluck(ch[1 + (beat / 2) % 3], { vol: 0.035, dur: 2.2, bus: 'music', bright: 0.6 });
  const mm = MEL[(bar + Math.floor(step / 32)) % 4][beat];
  if (mm > 0 && (Math.floor(step / 32) % 2 === 1)) pluck(mm, { vol: 0.04, dur: 2.4, bus: 'music', bright: 0.7 });
  step++;
}
export function startMusic() { ensure(); if (!musicTimer) musicTimer = setInterval(tick, 430); }
export function setSound(v) { S.sound = !!v; }
export function setMusic(v) { S.music = !!v; if (v) startMusic(); }
export function unlock() { ensure(); if (S.music) startMusic(); }
// ads: the kit suspends every AudioContext too; we also stop scheduling notes so nothing piles up
addEventListener('ap:ad', e => { const ph = e.detail && e.detail.phase; paused = ph === 'start'; if (!paused && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); });

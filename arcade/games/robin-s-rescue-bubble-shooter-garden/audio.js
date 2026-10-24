// Robin's Rescue sound: soft harp plucks, a music-box pop, birdsong chirps for freed chicks and a slow harp lullaby.
// All synthesised here (no files). Calm on purpose: no harsh waves, gentle volumes, nothing flashes or buzzes.
let ctx = null, master = null, musicBus = null, verb = null;
const LS = k => { try { return localStorage.getItem('rr_' + k); } catch (e) { return null; } };
const SET = (k, v) => { try { localStorage.setItem('rr_' + k, v); } catch (e) {} };
let muted = LS('mute') === '1', musicOn = LS('music') !== '0', musicWanted = false, musicTimer = 0, step = 0;

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    // tiny feedback-delay "room" so plucks bloom softly
    verb = ctx.createDelay(0.5); verb.delayTime.value = 0.13; const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; const wet = ctx.createGain(); wet.gain.value = 0.35;
    verb.connect(lp); lp.connect(fb); fb.connect(verb); lp.connect(wet); wet.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master); musicBus.connect(verb);
  } catch (e) { ctx = null; }
  return ctx;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function pluck(midi, { vol = 0.16, dur = 1.4, when = 0, bus = null, bright = 1 } = {}) {
  if (!init() || muted) return;
  const t = ctx.currentTime + when, f = hz(midi), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, f * 6 * bright), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  for (const [m, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.42], [3, 'sine', 0.16], [4.01, 'sine', 0.06]]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v;
    o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
  }
  lp.connect(g); g.connect(bus || master); if (!bus) g.connect(verb);
}
function chirp(when = 0, base = 2600) {
  if (!init() || muted) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.05); o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.11);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.13);
  o.connect(g); g.connect(master); g.connect(verb); o.start(t); o.stop(t + 0.16);
}
function soft(freq, dur, vol, type = 'sine', when = 0, to = null) {
  if (!init() || muted) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
// C major pentatonic, harp register
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88];
// lullaby: I – vi – IV – V in C, broken chords, one note every 0.42 s
const CHORDS = [[48, 55, 60, 64, 67, 72], [45, 52, 57, 60, 64, 69], [41, 48, 53, 57, 60, 65], [43, 50, 55, 59, 62, 67]];
const PATTERN = [0, 2, 4, 5, 3, 4, 2, 1];
function musicTick() {
  if (!musicWanted || !musicOn || muted || !ctx || document.hidden) return;
  const ch = CHORDS[Math.floor(step / 8) % 4], i = PATTERN[step % 8];
  pluck(ch[i], { vol: step % 8 === 0 ? 0.075 : 0.05, dur: 2.2, bus: musicBus, bright: 0.6 });
  if (step % 16 === 6) pluck(ch[5] + 12, { vol: 0.03, dur: 2.6, bus: musicBus, bright: 0.5, when: 0.21 });
  step++;
}
export const snd = {
  get muted() { return muted; }, get music() { return musicOn; },
  unlock() { init(); },
  toggle() { muted = !muted; SET('mute', muted ? '1' : '0'); if (master) master.gain.value = muted ? 0 : 0.9; return muted; },
  setMusic(on) { musicOn = on; SET('music', on ? '1' : '0'); },
  playMusic(on) { musicWanted = on; if (on && !musicTimer) { init(); musicTimer = setInterval(musicTick, 420); } if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = 0; } },
  tap() { pluck(79, { vol: 0.07, dur: 0.5 }); },
  aim() { soft(1400, 0.03, 0.012); },
  shoot() { soft(520, 0.16, 0.05, 'sine', 0, 820); },
  bounce() { pluck(84, { vol: 0.05, dur: 0.4 }); },
  stick() { soft(240, 0.09, 0.06, 'triangle', 0, 180); },
  pop(i = 0) { pluck(PENTA[Math.min(PENTA.length - 1, 3 + i)], { vol: 0.11, dur: 1.1 }); },
  drop(i = 0) { pluck(PENTA[Math.max(0, 8 - (i % 8))] - 12, { vol: 0.06, dur: 0.8, when: 0.05 }); },
  freed() { chirp(0); chirp(0.12, 2900); chirp(0.26, 2500); pluck(84, { vol: 0.08, dur: 1.6, when: 0.05 }); },
  swap() { pluck(67, { vol: 0.07, dur: 0.5 }); pluck(72, { vol: 0.06, dur: 0.5, when: 0.07 }); },
  star(i) { pluck(72 + [0, 4, 7][i], { vol: 0.12, dur: 1.6 }); },
  coin() { pluck(88, { vol: 0.05, dur: 0.5 }); },
  win() { [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => pluck(m, { vol: 0.12, dur: 2, when: i * 0.09 })); chirp(0.7); chirp(0.84, 2800); },
  lose() { [67, 64, 60, 55].forEach((m, i) => pluck(m, { vol: 0.08, dur: 1.6, when: i * 0.16, bright: 0.5 })); },
  boost() { [72, 76, 79, 84].forEach((m, i) => pluck(m, { vol: 0.08, dur: 1, when: i * 0.05 })); },
  thud() { soft(150, 0.25, 0.08, 'sine', 0, 70); },
};

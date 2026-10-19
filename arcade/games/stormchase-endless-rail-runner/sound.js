// sound.js — tiny Web Audio kit for the runners: noise whooshes, punchy one-shots and a looping step sequencer.
// All sounds are synthesised in code (original). Shared shape with temple-run/sound.js (each game keeps its own copy).
let ctx = null, master = null, musicBus = null, noiseBuf = null, timer = null;
export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function noise() {
  if (!noiseBuf) { const c = ac(); noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return noiseBuf;
}
/** oscillator blip. `at` = absolute audio time (default now), `bus` = master or music */
export function osc(f, dur = 0.1, type = 'sine', vol = 0.12, slide = 1, at = 0, bus = null) {
  try {
    const c = ac(), n = at || c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, n); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), n + dur);
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + Math.min(0.012, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g); g.connect(bus || master); o.start(n); o.stop(n + dur + 0.03);
  } catch (e) {}
}
/** filtered noise sweep (whoosh, hiss, rumble) */
export function hiss(dur = 0.18, f0 = 800, f1 = 3000, vol = 0.15, type = 'bandpass', at = 0, bus = null, q = 1.1) {
  try {
    const c = ac(), n = at || c.currentTime, s = c.createBufferSource(); s.buffer = noise(); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, n); fl.frequency.exponentialRampToValueAtTime(f1, n + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + Math.min(0.03, dur * 0.25)); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    s.connect(fl); fl.connect(g); g.connect(bus || master); s.start(n, Math.random() * 0.5); s.stop(n + dur + 0.05);
  } catch (e) {}
}
export const note = (m, dur, type, vol, at, bus) => osc(mtof(m), dur, type, vol, 1, at, bus);
export const kick = (at, bus, vol = 0.32) => osc(150, 0.16, 'sine', vol, 0.33, at, bus);
export const hat = (at, bus, vol = 0.05) => hiss(0.035, 7000, 9000, vol, 'highpass', at, bus);
export const snare = (at, bus, vol = 0.12) => { hiss(0.12, 2500, 1800, vol, 'bandpass', at, bus, 0.7); osc(220, 0.08, 'triangle', vol * 0.6, 0.6, at, bus); };

/** loop a song: song = { bpm, steps, play(step, time, api) } — eighth-note steps, scheduled ahead for tight timing */
export function startMusic(song) {
  stopMusic(); const c = ac(); if (!c) return;
  musicBus.gain.cancelScheduledValues(c.currentTime); musicBus.gain.setValueAtTime(0.55, c.currentTime);
  let step = 0, next = c.currentTime + 0.06; const spb = 60 / song.bpm / 2;
  const api = { note: (m, d, t, v, at) => note(m, d, t, v, at, musicBus), kick: (at, v) => kick(at, musicBus, v), hat: (at, v) => hat(at, musicBus, v), snare: (at, v) => snare(at, musicBus, v), spb };
  timer = setInterval(() => { while (next < c.currentTime + 0.18) { song.play(step % song.steps, next, api); step++; next += spb; } }, 40);
}
export function stopMusic(fade = 0.4) {
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx && musicBus) { const n = ctx.currentTime; musicBus.gain.setValueAtTime(musicBus.gain.value, n); musicBus.gain.linearRampToValueAtTime(0.0001, n + fade); }
}

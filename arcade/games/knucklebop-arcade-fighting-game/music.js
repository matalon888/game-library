// Knucklebop music: three original arcade loops composed in code, played on the kit synth (tone/note).
import { tone, note } from './kit/hc.js';

const _ = -1;
const SONGS = [
  { bpm: 132, root: 45, prog: [0, 0, 5, 3], bass: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0], lead: [12, _, 15, _, 17, _, 15, 12, _, 10, _, 12, _, _, 7, _] },
  { bpm: 120, root: 50, prog: [0, 3, 5, 7], bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0], lead: [7, _, 10, 12, _, 14, _, 12, 10, _, 7, _, 5, _, 7, _] },
  { bpm: 140, root: 43, prog: [0, 0, 3, 5], bass: [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1], lead: [12, _, 12, 14, _, 15, _, 17, _, 15, 14, _, 12, _, 10, _] },
];
let timer = 0, step = 0, idx = 0, muted = false, intensity = 1, playing = -1;
try { muted = localStorage.getItem('knucklebop_mute') === '1'; } catch (e) {}

function tick() {
  const S = SONGS[idx], s = step % 16, bar = Math.floor(step / 16) % 4, r = S.root + S.prog[bar];
  step++;
  if (muted || document.visibilityState === 'hidden') return;
  const v = intensity;
  if (s % 4 === 0 || s === 10) tone(115, 0.16, 'sine', 0.24 * v, 0.35);
  if (s === 4 || s === 12) { tone(210, 0.1, 'triangle', 0.08 * v, 0.55); tone(1500, 0.05, 'square', 0.022 * v, 0.5); }
  if (s % 2 === 0) tone(7200, 0.025, 'square', 0.011 * v, 0.9);
  if (S.bass[s]) note(r + (s === 14 ? 7 : 0), 0.2, 0.11 * v);
  if (bar % 2 === 1 && S.lead[s] !== _) note(r + 12 + S.lead[s], 0.22, 0.05 * v);
}
export const music = {
  play(i, v = 1) {
    intensity = v;
    if (playing === i % SONGS.length && timer) return;
    idx = playing = i % SONGS.length; step = 0;
    clearInterval(timer); timer = setInterval(tick, 60000 / SONGS[idx].bpm / 4);
  },
  level(v) { intensity = v; },
  stop() { clearInterval(timer); timer = 0; playing = -1; },
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('knucklebop_mute', muted ? '1' : '0'); } catch (e) {} return muted; },
};

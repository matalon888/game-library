// sound.js — calm audio for Teatime Solitaire: harp-like plucks, a soft chime when a card goes home and a quiet
// piano loop (C major 7 → A minor 7 → F major 7 → G), all synthesised with the kit's note()/tone(). No samples.
import { note, tone } from './kit/hc.js';
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
const PROG = [[48, 60, 64, 67, 71], [45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [43, 55, 59, 62, 67]];
let paused = false, gest = false, step = 0;
const st = { muted: false, music: true };
const on = () => !st.muted && !paused && gest;
addEventListener('pointerdown', () => { gest = true; }, { capture: true });
setInterval(() => {
  if (!on() || !st.music || document.visibilityState !== 'visible') return;
  const ch = PROG[(step >> 3) % 4], i = step % 8;
  if (i === 0) note(ch[0], 2.4, 0.03);
  const seq = [1, 2, 3, 4, 3, 2, 3, 1];
  note(ch[seq[i]], 1.4, i % 2 ? 0.016 : 0.022);
  step++;
}, 520);
export const snd = {
  st,
  set muted(v) { st.muted = !!v; }, get muted() { return st.muted; },
  set music(v) { st.music = !!v; }, get music() { return st.music; },
  pause(p) { paused = !!p; },
  pick() { if (on()) tone(880, 0.04, 'sine', 0.035, 0.9); },
  flip() { if (on()) { tone(1500, 0.03, 'sine', 0.025, 0.6); } },
  place(i = 0) { if (on()) note(PENTA[(i * 3 + 2) % 6] + 12, 0.45, 0.07); },
  home(n = 0) { if (on()) { note(PENTA[Math.min(PENTA.length - 1, 2 + (n % 9))] + 12, 0.9, 0.08); setTimeout(() => on() && note(PENTA[Math.min(PENTA.length - 1, 4 + (n % 7))] + 24, 0.7, 0.03), 70); } },
  draw() { if (on()) tone(620, 0.05, 'triangle', 0.03, 0.8); },
  nope() { if (on()) tone(240, 0.14, 'sine', 0.05, 0.85); },
  click() { if (on()) tone(700, 0.04, 'sine', 0.04, 0.9); },
  run() { if (on()) [72, 76, 79, 84].forEach((m, i) => setTimeout(() => note(m, 0.8, 0.07), i * 90)); },
  win() { if (on()) [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => setTimeout(() => note(m, 1.2, 0.08), i * 120)); },
};

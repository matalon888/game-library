/**
 * Synthesized sound effects using Web Audio API.
 */
let audioCtx;
let musicTimer = null;
let musicStep = 0;
let _muted = false;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function setMuted(m) {
  _muted = m;
  if (m) stopMusic();
  // We don't restart music here because we don't know the current level easily without importing S
  // The UI caller should handle restarting music if unmuting
}

export function isMuted() {
  return _muted;
}

function tone(freq, type, dur, vol = 0.12, delay = 0) {
  if (!audioCtx || _muted) return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

const MUSIC_NOTES = [
  392, 392, 0, 392, 0, 311, 392, 0,
  523, 0, 0, 0, 262, 0, 0, 0,
  196, 0, 0, 262, 0, 330, 0, 349,
  0, 294, 330, 0, 262, 0, 0, 0,
];

const MUSIC2_NOTES = [
  523, 0, 494, 523, 0, 659, 0, 587,
  523, 0, 440, 0, 392, 0, 440, 0,
  587, 659, 0, 784, 0, 880, 0, 784,
  659, 0, 523, 0, 440, 0, 0, 0,
];

export function startMusic(level = 1) {
  if (!audioCtx || musicTimer) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const notes = level >= 2 ? MUSIC2_NOTES : MUSIC_NOTES;
  const tempo = level >= 2 ? 150 : 170;
  musicStep = 0;
  musicTimer = setInterval(() => {
    const note = notes[musicStep % notes.length];
    if (note > 0) {
      tone(note, 'square', 0.18, 0.08);
      tone(note * 2, 'square', 0.07, 0.03, 0.03);
      tone(note / 2, 'triangle', 0.24, 0.055, 0.02);
    }
    musicStep++;
  }, tempo);
}

export function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
}

export const sfx = {
  jump()    { tone(500, 'square', 0.1, 0.1); tone(700, 'square', 0.08, 0.1, 0.06); },
  coin()    { tone(988, 'square', 0.06, 0.12); tone(1319, 'square', 0.2, 0.12, 0.06); },
  stomp()   { tone(200, 'square', 0.15, 0.15); },
  powerup() { [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => tone(f, 'square', 0.1, 0.1, i * 0.055)); },
  bump()    { tone(150, 'triangle', 0.08, 0.1); },
  breakB()  { tone(300, 'sawtooth', 0.06, 0.08); tone(200, 'sawtooth', 0.06, 0.08, 0.03); },
  die()     { tone(400, 'square', 0.15, 0.15); tone(300, 'square', 0.15, 0.12, 0.15); tone(200, 'square', 0.35, 0.12, 0.3); },
  flag()    { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 'square', 0.18, 0.1, i * 0.1)); },
  leek()    { tone(800, 'sawtooth', 0.08, 0.08); tone(600, 'sawtooth', 0.06, 0.08, 0.04); },
  rocket()  { tone(150, 'sawtooth', 0.15, 0.14); tone(300, 'square', 0.1, 0.1, 0.02); tone(100, 'sawtooth', 0.2, 0.12, 0.08); tone(500, 'sawtooth', 0.06, 0.06, 0.12); },
  gameover(){ [262, 247, 233, 220].forEach((f, i) => tone(f, 'square', 0.4, 0.12, i * 0.35)); },
  oneup()   { tone(330, 'square', 0.08, 0.1); tone(524, 'square', 0.08, 0.1, 0.08); tone(660, 'square', 0.2, 0.12, 0.16); },
  pipe()    { tone(600, 'square', 0.1, 0.12); tone(500, 'square', 0.1, 0.1, 0.08); tone(400, 'square', 0.15, 0.1, 0.16); },
  explode() { tone(100, 'sawtooth', 0.3, 0.15); tone(80, 'square', 0.25, 0.12, 0.05); tone(200, 'sawtooth', 0.15, 0.1); },
  sing()    { tone(880, 'sine', 0.12, 0.1); tone(1100, 'sine', 0.1, 0.08, 0.06); tone(1320, 'sine', 0.15, 0.1, 0.12); },
  tongue()  { tone(250, 'sawtooth', 0.12, 0.1); tone(350, 'sawtooth', 0.08, 0.08, 0.06); },
};

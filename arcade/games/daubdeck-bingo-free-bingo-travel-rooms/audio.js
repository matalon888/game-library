// Daubdeck sound: warm lounge music, ball rumble, daub thocks, a bingo fanfare, all synthesised in code (WebAudio),
// plus the caller's voice through the browser's speech synthesis (off with the sound).
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null, muted = false, musicOn = false, timer = 0, step = 0, nextT = 0;
try { muted = localStorage.getItem('daubdeck_mute') === '1'; } catch (e) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.2; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function voice(midi, { t = 0, dur = 0.4, vol = 0.2, type = 'triangle', bus = null, attack = 0.005, harm = [[2, 'sine', 0.3]], slide = 0 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + attack); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || sfxBus);
  for (const [mult, ty, v] of [[1, type, 1], ...harm]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = ty; o.frequency.setValueAtTime(hz(midi) * mult, n);
    if (slide) o.frequency.exponentialRampToValueAtTime(hz(midi + slide) * mult, n + dur);
    og.gain.value = v; o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function noise({ t = 0, dur = 0.2, vol = 0.2, f0 = 2000, f1 = 400, q = 1, type = 'bandpass' } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = dur > 0.9; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, n); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), n + dur);
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + Math.min(0.08, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let voiceOn = true, ttsVoice = null;
try { voiceOn = localStorage.getItem('daubdeck_voice') !== '0'; } catch (e) {}
function pickVoice() {
  try { const vs = speechSynthesis.getVoices(); ttsVoice = vs.find(v => /en-GB/i.test(v.lang) && /male|daniel|arthur|george/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; } catch (e) {}
}
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch (e) {}

export const snd = {
  unlock: init,
  get muted() { return muted; },
  get voice() { return voiceOn; },
  toggle() { muted = !muted; try { localStorage.setItem('daubdeck_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); if (muted) try { speechSynthesis.cancel(); } catch (e) {} return muted; },
  toggleVoice() { voiceOn = !voiceOn; try { localStorage.setItem('daubdeck_voice', voiceOn ? '1' : '0'); } catch (e) {} if (!voiceOn) try { speechSynthesis.cancel(); } catch (e) {} return voiceOn; },
  say(text, rate = 1) {
    if (muted || !voiceOn || navigator.webdriver) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); if (ttsVoice) u.voice = ttsVoice; u.rate = rate; u.pitch = 0.92; u.volume = 0.9; speechSynthesis.speak(u); } catch (e) {}
  },
  tap() { voice(84, { dur: 0.08, vol: 0.07, type: 'sine', harm: [] }); },
  rumble(sec = 0.9) { noise({ dur: sec, vol: 0.05, f0: 260, f1: 520, q: 0.9 }); for (let i = 0; i < 6; i++) voice(90 + (i % 3) * 3, { t: 0.08 + i * sec / 7, dur: 0.05, vol: 0.025, type: 'sine', harm: [] }); },
  pop() { voice(70, { dur: 0.16, vol: 0.12, type: 'sine', harm: [[2, 'sine', 0.2]], slide: 9 }); noise({ dur: 0.06, vol: 0.06, f0: 2600, f1: 900, q: 2 }); },
  roll() { noise({ dur: 0.45, vol: 0.05, f0: 900, f1: 300, q: 3 }); },
  daub(k = 0) { voice(48 + PENT[k % 6], { dur: 0.12, vol: 0.16, type: 'sine', harm: [[2, 'triangle', 0.15]], slide: -5 }); noise({ dur: 0.07, vol: 0.08, f0: 700, f1: 200, q: 1.5, type: 'lowpass' }); voice(84 + PENT[k % 8], { t: 0.02, dur: 0.18, vol: 0.04, type: 'sine', harm: [] }); },
  nope() { voice(57, { dur: 0.1, vol: 0.07, type: 'sine', harm: [] }); voice(54, { t: 0.08, dur: 0.14, vol: 0.07, type: 'sine', harm: [] }); },
  ready() { [79, 84, 88].forEach((m, i) => voice(m, { t: i * 0.07, dur: 0.3, vol: 0.06, type: 'sine', harm: [[3, 'sine', 0.2]] })); },
  bingo() {
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => voice(m, { t: i * 0.06, dur: 0.5, vol: 0.11, type: 'triangle', harm: [[2, 'sine', 0.3]] }));
    [[72, 76, 79], [74, 77, 81], [76, 79, 84]].forEach((ch, k) => ch.forEach(m => voice(m, { t: 0.5 + k * 0.18, dur: k === 2 ? 1.2 : 0.2, vol: 0.06, type: 'sawtooth', harm: [[1.005, 'sawtooth', 0.6]], attack: 0.02 })));
    noise({ t: 0.45, dur: 1.4, vol: 0.05, f0: 6000, f1: 3000, q: 0.5, type: 'highpass' });
  },
  coin(i = 0) { voice(95 + (i % 3), { t: i * 0.04, dur: 0.07, vol: 0.05, type: 'square', harm: [] }); voice(100 + (i % 3), { t: i * 0.04 + 0.05, dur: 0.16, vol: 0.05, type: 'square', harm: [] }); },
  stamp() { noise({ dur: 0.1, vol: 0.18, f0: 500, f1: 120, q: 1, type: 'lowpass' }); voice(43, { dur: 0.16, vol: 0.18, type: 'sine', harm: [] }); setTimeout(() => this.sparkle(), 90); },
  sparkle() { for (let i = 0; i < 5; i++) voice(91 + PENT[(Math.random() * 6) | 0], { t: i * 0.05, dur: 0.35, vol: 0.04, type: 'sine', harm: [[3, 'sine', 0.15]] }); },
  power() { for (let i = 0; i < 8; i++) voice(72 + PENT[i], { t: i * 0.035, dur: 0.25, vol: 0.05, type: 'triangle', harm: [] }); noise({ dur: 0.5, vol: 0.08, f0: 600, f1: 5000, q: 1.2 }); },
  star(i = 0) { voice(79 + i * 5, { dur: 0.6, vol: 0.12, type: 'triangle', harm: [[2, 'sine', 0.3], [4, 'sine', 0.1]] }); },
  win() { [72, 76, 79, 84, 88].forEach((m, i) => voice(m, { t: i * 0.11, dur: 0.6, vol: 0.12, type: 'triangle' })); voice(60, { t: 0.55, dur: 1.2, vol: 0.1, type: 'sine' }); },
  lose() { [67, 64, 60, 55].forEach((m, i) => voice(m, { t: i * 0.16, dur: 0.5, vol: 0.09, type: 'sine' })); },
  whoosh() { noise({ dur: 0.45, vol: 0.1, f0: 400, f1: 3500, q: 1.4 }); },
  music(on = true) { musicOn = on; if (!on || !init() || timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(tick, 120); },
};

// lounge loop in Bb: | Bbmaj7 | Gm7 | Cm7 | F7 | swung Rhodes-ish comping, walking-ish bass, a lazy melody every other pass
const CH = [[46, 57, 62, 65, 69], [43, 55, 58, 62, 65], [48, 55, 58, 63, 67], [41, 57, 60, 63, 65]];
const BASS = [[46, 50, 53, 55], [43, 46, 50, 53], [48, 51, 55, 53], [41, 45, 48, 52]];
const MEL = [[74, -1, 72, 70], [74, -1, -1, 77], [75, 74, 72, -1], [69, -1, 70, 72], [77, -1, 74, -1], [72, 74, 70, -1], [72, -1, 70, 67], [69, -1, -1, -1]];
function tick() {
  if (!musicOn || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.1 : 0; return; }
  const beat = 0.5;
  while (nextT < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 4) % 8, b = step % 4, ch = CH[bar % 4], t = nextT - ctx.currentTime, swing = b % 2 ? 0.06 : 0;
    voice(BASS[bar % 4][b] - 12, { t, dur: beat * 0.9, vol: 0.13, type: 'sine', bus: musicBus, attack: 0.01, harm: [[2, 'sine', 0.25]] });
    if (b === 0 || b === 2) for (let i = 1; i < ch.length; i++) voice(ch[i], { t: t + swing + i * 0.008, dur: b === 0 ? 1.1 : 0.45, vol: 0.028, type: 'sine', bus: musicBus, attack: 0.01, harm: [[2, 'sine', 0.4], [3, 'sine', 0.08]] });
    const mel = MEL[bar][b]; if (mel > 0 && Math.floor(step / 32) % 2 === 1) voice(mel, { t: t + swing, dur: 0.7, vol: 0.05, type: 'triangle', bus: musicBus, attack: 0.02, harm: [[2, 'sine', 0.2]] });
    if (b === 1 || b === 3) noise({ t: t + swing, dur: 0.06, vol: 0.018, f0: 8000, f1: 6000, q: 0.7, type: 'highpass' });
    step++; nextT += beat;
  }
}

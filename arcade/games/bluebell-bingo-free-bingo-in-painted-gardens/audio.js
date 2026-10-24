// Bluebell Bingo sound: soft harp and piano plucks, a slow garden waltz, all synthesised in code (WebAudio),
// plus a calm caller voice through the browser's speech synthesis (its own toggle; off when sound is off).
const KEY = 'bluebell-bingo_';
const get = (k, d) => { try { const v = localStorage.getItem(KEY + k); return v === null ? d : v === '1'; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(KEY + k, v ? '1' : '0'); } catch (e) {} };
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
let sound = get('sound', true), music = get('music', true), voiceOn = get('voice', true), playing = false, timer = 0, step = 0, nextT = 0;

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = sound ? 0.85 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.6); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.32; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = music ? 0.28 : 0; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// a plucked string: bright attack, quick fade of the upper partials, long soft tail
function pluck(midi, { t = 0, dur = 1.2, vol = 0.12, bus = null, bright = 1 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, out = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(hz(midi) * 6 * bright, n); lp.frequency.exponentialRampToValueAtTime(hz(midi) * 1.5, n + dur * 0.6);
  out.gain.setValueAtTime(0.0001, n); out.gain.exponentialRampToValueAtTime(vol, n + 0.006); out.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  lp.connect(out); out.connect(bus || sfxBus);
  for (const [m, ty, v] of [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12], [1.003, 'sine', 0.4]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = ty; o.frequency.value = hz(midi) * m; g.gain.value = v;
    o.connect(g); g.connect(lp); o.start(n); o.stop(n + dur + 0.05);
  }
}
function soft(midi, { t = 0, dur = 0.3, vol = 0.08, type = 'sine', slide = 0 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(hz(midi), n);
  if (slide) o.frequency.exponentialRampToValueAtTime(hz(midi + slide), n + dur);
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  o.connect(g); g.connect(sfxBus); o.start(n); o.stop(n + dur + 0.05);
}
function hush({ t = 0, dur = 0.12, vol = 0.06, f = 900, q = 0.8, type = 'lowpass' } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(n); s.stop(n + dur + 0.05);
}
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];   // F major from 65

let ttsVoice = null;
function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    ttsVoice = vs.find(v => /en-GB/i.test(v.lang) && /serena|kate|martha|stephanie|female|libby|sonia/i.test(v.name))
      || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /en-(IE|AU|US)/i.test(v.lang) && /samantha|karen|moira|female/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || null;
  } catch (e) {}
}
try { speechSynthesis.onvoiceschanged = pickVoice; pickVoice(); } catch (e) {}

export const snd = {
  unlock: init,
  get sound() { return sound; }, get music() { return music; }, get voice() { return voiceOn; },
  setSound(v) { sound = v; put('sound', v); if (init()) master.gain.setTargetAtTime(v ? 0.85 : 0, ctx.currentTime, 0.05); if (!v) this.hush(); },
  setMusic(v) { music = v; put('music', v); if (init()) musicBus.gain.setTargetAtTime(v ? 0.28 : 0, ctx.currentTime, 0.2); },
  setVoice(v) { voiceOn = v; put('voice', v); if (!v) this.hush(); },
  hush() { try { speechSynthesis.cancel(); } catch (e) {} },
  say(text) {
    if (!sound || !voiceOn || navigator.webdriver) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); if (ttsVoice) u.voice = ttsVoice; u.rate = 0.82; u.pitch = 1; u.volume = 0.85; speechSynthesis.speak(u); } catch (e) {}
  },
  tap() { soft(84, { dur: 0.09, vol: 0.05 }); },
  call() { pluck(77, { dur: 1.4, vol: 0.07 }); pluck(84, { t: 0.09, dur: 1.6, vol: 0.06 }); hush({ dur: 0.08, vol: 0.05, f: 1400, type: 'bandpass', q: 2 }); },
  daub(k = 0) { hush({ dur: 0.1, vol: 0.09, f: 500 }); pluck(65 + SCALE[k % 8], { t: 0.02, dur: 0.9, vol: 0.08 }); },
  nope() { soft(62, { dur: 0.14, vol: 0.04 }); },
  ready() { [77, 81, 84, 89].forEach((m, i) => pluck(m, { t: i * 0.11, dur: 1.6, vol: 0.06 })); },
  bingo() { for (let i = 0; i < 12; i++) pluck(65 + SCALE[i], { t: i * 0.055, dur: 2.2, vol: 0.07 }); [65, 69, 72, 77].forEach(m => pluck(m, { t: 0.75, dur: 3, vol: 0.06, bright: 0.6 })); },
  coin(i = 0) { soft(96 + (i % 3) * 2, { t: i * 0.05, dur: 0.18, vol: 0.03, type: 'sine' }); },
  stamp() { hush({ dur: 0.16, vol: 0.14, f: 300 }); pluck(72, { t: 0.05, dur: 1.4, vol: 0.06 }); pluck(79, { t: 0.14, dur: 1.4, vol: 0.05 }); },
  power() { for (let i = 0; i < 7; i++) pluck(77 + SCALE[i], { t: i * 0.06, dur: 1.2, vol: 0.05 }); },
  star(i = 0) { pluck(81 + i * 4, { dur: 1.8, vol: 0.09 }); },
  win() { [65, 69, 72, 77, 81].forEach((m, i) => pluck(m, { t: i * 0.16, dur: 2.4, vol: 0.08 })); pluck(53, { t: 0.8, dur: 3, vol: 0.07, bright: 0.5 }); },
  lose() { [72, 69, 65, 64].forEach((m, i) => pluck(m, { t: i * 0.22, dur: 1.6, vol: 0.06, bright: 0.6 })); },
  page() { hush({ dur: 0.3, vol: 0.05, f: 2400, type: 'bandpass', q: 0.6 }); },
  play(on = true) { playing = on; if (!on || !init() || timer) return; nextT = ctx.currentTime + 0.2; timer = setInterval(tick, 150); },
};

// a slow garden waltz in F (3/4, ~66 bpm): harp arpeggios over | F | Dm | Bb | C | F | Am | Bb C | F |, melody every other pass
const BARS = [[41, 65, 69, 72], [38, 62, 65, 69], [46, 62, 65, 70], [36, 64, 67, 70], [41, 65, 69, 72], [45, 64, 69, 72], [46, 65, 70, 74], [41, 65, 69, 72]];
const MEL = [[81, 0, 79], [77, 0, 0], [77, 0, 74], [76, 0, 0], [72, 74, 77], [76, 0, 72], [74, 0, 76], [77, 0, 0]];
function tick() {
  if (!playing || !ctx || document.visibilityState === 'hidden') { nextT = ctx ? ctx.currentTime + 0.2 : 0; return; }
  const beat = 0.9;
  while (nextT < ctx.currentTime + 0.5) {
    const bar = Math.floor(step / 3) % 8, b = step % 3, ch = BARS[bar], t = nextT - ctx.currentTime;
    if (b === 0) pluck(ch[0] - 12 + 12, { t, dur: 2.6, vol: 0.09, bus: musicBus, bright: 0.5 });
    pluck(ch[1 + b], { t: t + 0.0, dur: 1.8, vol: 0.035, bus: musicBus, bright: 0.7 });
    if (b === 1) pluck(ch[3] + 12, { t: t + beat / 2, dur: 1.4, vol: 0.02, bus: musicBus, bright: 0.7 });
    const m = MEL[bar][b]; if (m && Math.floor(step / 24) % 2 === 1) pluck(m, { t: t + 0.02, dur: 2, vol: 0.045, bus: musicBus });
    step++; nextT += beat;
  }
}

// Hivefall audio: every sound is synthesised with WebAudio (no files). Layered gunshots (noise crack + low thump +
// reverb tail), flamethrower roar, rocket whoosh + blast, bug chitter/screech, footsteps, wind + drone ambience and an
// adaptive combat score (layers fade in with the number of bugs near the player).
let ctx = null, master, comp, verb, verbIn, musicBus, sfxBus, ambBus, noiseBuf;
const now = () => ctx.currentTime;

export function audioInit() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);
  // outdoor reverb: decaying noise impulse (wide canyon slap)
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 2200 ? 0.3 : 1); } }
  verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb); verb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  startAmbience(); startMusic();
}
export const audioReady = () => !!ctx;

function noise(dur, { type = 'bandpass', f = 1000, q = 1, vol = 0.5, a = 0.002, slideTo = 0, verbAmt = 0.4, bus = sfxBus, at = 0 } = {}) {
  const t = now() + at, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (slideTo) fl.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(bus); if (verbAmt) { const v = ctx.createGain(); v.gain.value = verbAmt; g.connect(v); v.connect(verbIn); }
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return g;
}
function osc(f, dur, { type = 'sine', vol = 0.3, slide = 0.5, a = 0.003, verbAmt = 0.2, bus = sfxBus, at = 0, detune = 0 } = {}) {
  const t = now() + at, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); if (verbAmt) { const v = ctx.createGain(); v.gain.value = verbAmt; g.connect(v); v.connect(verbIn); }
  o.start(t); o.stop(t + dur + 0.05); return o;
}

export const S = {
  rifle() { if (!ctx) return; noise(0.07, { f: 2600, q: 0.7, vol: 0.55, verbAmt: 0.5 }); noise(0.16, { type: 'lowpass', f: 900, vol: 0.5, slideTo: 200 }); osc(120, 0.12, { vol: 0.5, slide: 0.35 }); noise(0.5, { type: 'lowpass', f: 600, vol: 0.08, a: 0.02, verbAmt: 0.9 }); },
  casing() { if (!ctx) return; osc(3200 + Math.random() * 900, 0.05, { type: 'triangle', vol: 0.03, slide: 0.9, at: 0.25 + Math.random() * 0.1, verbAmt: 0 }); },
  empty() { if (!ctx) return; osc(1800, 0.03, { type: 'square', vol: 0.06, slide: 0.7, verbAmt: 0 }); },
  reload() { if (!ctx) return; noise(0.06, { f: 3000, q: 4, vol: 0.12, verbAmt: 0 }); osc(500, 0.05, { type: 'square', vol: 0.05, slide: 0.6, at: 0.35, verbAmt: 0 }); noise(0.05, { f: 1800, q: 3, vol: 0.18, at: 0.75, verbAmt: 0 }); osc(220, 0.06, { type: 'square', vol: 0.07, slide: 0.7, at: 0.95, verbAmt: 0 }); },
  rocket() { if (!ctx) return; noise(0.9, { f: 500, q: 0.6, vol: 0.5, slideTo: 2400, a: 0.02 }); osc(80, 0.3, { vol: 0.5, slide: 0.4 }); },
  boom(big = 1, dist = 0) { if (!ctx) return; const v = Math.max(0.12, 1 - dist / 120) * big;
    noise(0.12, { f: 1800, q: 0.5, vol: 0.6 * v, verbAmt: 0.6 }); noise(1.6 * big, { type: 'lowpass', f: 700, vol: 0.85 * v, slideTo: 60, a: 0.005, verbAmt: 1 });
    osc(70, 0.9, { vol: 0.9 * v, slide: 0.3 }); osc(42, 1.3, { vol: 0.6 * v, slide: 0.5, type: 'triangle' }); },
  beam() { if (!ctx) return; osc(55, 2.6, { type: 'sawtooth', vol: 0.25, slide: 0.6, a: 0.05, verbAmt: 0.8 }); osc(1400, 2.2, { type: 'sine', vol: 0.06, slide: 0.3, a: 0.02 }); noise(2.6, { f: 300, q: 0.4, vol: 0.5, slideTo: 1200, a: 0.1, verbAmt: 1 }); },
  beacon() { if (!ctx) return; for (let i = 0; i < 4; i++) osc(1320, 0.07, { type: 'square', vol: 0.06, slide: 1, at: i * 0.6, verbAmt: 0.3 }); },
  hit() { if (!ctx) return; osc(1900, 0.04, { type: 'square', vol: 0.05, slide: 0.8, verbAmt: 0 }); },
  goo() { if (!ctx) return; noise(0.12, { f: 400 + Math.random() * 300, q: 3, vol: 0.18, slideTo: 150, verbAmt: 0.1 }); },
  kill() { if (!ctx) return; noise(0.2, { f: 700, q: 2, vol: 0.22, slideTo: 140 }); osc(300 + Math.random() * 120, 0.18, { type: 'sawtooth', vol: 0.05, slide: 0.4 }); },
  chitter(dist = 10) { if (!ctx) return; const v = Math.max(0.01, 0.12 - dist / 400); for (let i = 0; i < 3; i++) osc(2400 + Math.random() * 1600, 0.025, { type: 'square', vol: v, slide: 0.6, at: i * 0.045, verbAmt: 0.3 }); },
  screech(dist = 10) { if (!ctx) return; const v = Math.max(0.03, 0.3 - dist / 200); const o = osc(700, 0.8, { type: 'sawtooth', vol: v, slide: 1.9, a: 0.05, verbAmt: 0.7 }); noise(0.8, { f: 2200, q: 6, vol: v * 0.6, slideTo: 3800, a: 0.05 }); },
  roar() { if (!ctx) return; osc(90, 2.2, { type: 'sawtooth', vol: 0.4, slide: 0.55, a: 0.15, verbAmt: 1 }); osc(134, 2.0, { type: 'sawtooth', vol: 0.25, slide: 0.6, a: 0.2, detune: 18 }); noise(2.2, { f: 500, q: 1.2, vol: 0.45, slideTo: 160, a: 0.2, verbAmt: 1 }); },
  spit(dist = 10) { if (!ctx) return; const v = Math.max(0.04, 0.3 - dist / 150); noise(0.3, { f: 900, q: 2, vol: v, slideTo: 300 }); osc(200, 0.25, { type: 'triangle', vol: v * 0.6, slide: 2 }); },
  hurt() { if (!ctx) return; osc(160, 0.22, { type: 'sawtooth', vol: 0.18, slide: 0.6, verbAmt: 0 }); noise(0.15, { type: 'lowpass', f: 600, vol: 0.4, verbAmt: 0 }); },
  step(run) { if (!ctx) return; noise(0.09, { f: run ? 900 : 700, q: 0.9, vol: run ? 0.1 : 0.07, slideTo: 300, verbAmt: 0 }); },
  land() { if (!ctx) return; noise(0.18, { type: 'lowpass', f: 500, vol: 0.3, verbAmt: 0 }); },
  turret() { if (!ctx) return; noise(0.05, { f: 3500, q: 0.8, vol: 0.18, verbAmt: 0.4 }); osc(180, 0.06, { vol: 0.15, slide: 0.4 }); },
  deploy() { if (!ctx) return; [440, 660, 880].forEach((f, i) => osc(f, 0.12, { type: 'square', vol: 0.06, slide: 1, at: i * 0.08 })); noise(0.4, { f: 600, q: 1, vol: 0.2, at: 0.25 }); },
  ui(i = 0) { if (!ctx) return; osc(660 + i * 110, 0.08, { type: 'triangle', vol: 0.1, slide: 1, verbAmt: 0 }); },
  win() { if (!ctx) return; [392, 523, 659, 784, 1046].forEach((f, i) => osc(f, 0.6, { type: 'sawtooth', vol: 0.07, slide: 1, at: i * 0.12, verbAmt: 0.8 })); },
  lose() { if (!ctx) return; [220, 185, 147, 110].forEach((f, i) => osc(f, 0.7, { type: 'sawtooth', vol: 0.08, slide: 0.98, at: i * 0.2, verbAmt: 0.8 })); },
  alarm() { if (!ctx) return; for (let i = 0; i < 3; i++) { osc(740, 0.25, { type: 'square', vol: 0.06, slide: 1, at: i * 0.5 }); osc(554, 0.25, { type: 'square', vol: 0.06, slide: 1, at: i * 0.5 + 0.25 }); } },
  rumble() { if (!ctx) return; noise(2.5, { type: 'lowpass', f: 160, vol: 0.7, a: 0.4, verbAmt: 0.5 }); osc(38, 2.5, { vol: 0.4, slide: 1.2, a: 0.4 }); },
};

// ---------- continuous sources: flamethrower roar, wind, drone
let flame = null, wind = null;
export function flameOn(on) {
  if (!ctx) return;
  if (!flame) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(sfxBus); const v = ctx.createGain(); v.gain.value = 0.3; g.connect(v); v.connect(verbIn);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 13; lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); s.start();
    flame = g;
  }
  flame.gain.setTargetAtTime(on ? 0.55 : 0, now(), on ? 0.03 : 0.12);
}
function startAmbience() {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.7;
  const g = ctx.createGain(); g.gain.value = 0.18; s.connect(f); f.connect(g); g.connect(ambBus);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); s.start();
  wind = { g, f };
  for (const [fr, dt] of [[55, 0], [55.4, 7], [82.4, -5]]) { const o = ctx.createOscillator(), og = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt; lp.type = 'lowpass'; lp.frequency.value = 180; og.gain.value = 0.05; o.connect(lp); lp.connect(og); og.connect(ambBus); o.start(); }
}
export function setStorm(k) { if (!wind) return; wind.g.gain.setTargetAtTime(0.18 + k * 0.55, now(), 0.8); wind.f.frequency.setTargetAtTime(420 + k * 500, now(), 0.8); }

// ---------- adaptive music: 4 layers on a 16th-note grid at 132 bpm (D minor, Phrygian flavour)
let mus = null;
export function setIntensity(k) { if (mus) mus.target = Math.max(0, Math.min(1, k)); }
export function setMusic(on) { if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.42 : 0.14, now(), 0.5); }
function startMusic() {
  const step = 60 / 132 / 4; let next = now() + 0.1, i = 0;
  mus = { target: 0, level: 0 };
  const bass = [38, 0, 38, 38, 0, 38, 41, 0, 38, 0, 38, 38, 0, 39, 0, 36];   // D2 pedal with Eb/C stabs
  const arp = [62, 65, 69, 74, 69, 65, 63, 65];
  const pad = [[50, 53, 57], [48, 51, 55], [46, 50, 53], [51, 55, 58]];
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  function kick(t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.32); }
  function hat(t, v, open) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.18 : 0.04)); s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.2); }
  function snare(t, v) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); s.connect(f); f.connect(g); g.connect(musicBus); const vv = ctx.createGain(); vv.gain.value = 0.5; g.connect(vv); vv.connect(verbIn); s.start(t, Math.random()); s.stop(t + 0.22); }
  function tonal(t, m, dur, type, v, cut) { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = mf(m); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(cut * 0.3, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02); return g; }
  setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    mus.level += (mus.target - mus.level) * 0.08;
    const L = mus.level;
    while (next < now() + 0.25) {
      const s = i % 16, bar = Math.floor(i / 16) % 4;
      // layer 0: always: low pulse + sparse pad
      if (s === 0) for (const m of pad[bar]) { const g = tonal(next, m, step * 16, 'sawtooth', 0.025, 900); }
      if (bass[s]) tonal(next, bass[s] + (bar === 3 ? 1 : 0), step * 1.6, 'sawtooth', 0.06 + L * 0.1, 400 + L * 900);
      // layer 1: drums
      if (L > 0.15) { if (s % 4 === 0) kick(next, 0.35 + L * 0.3); if (s % 2 === 1) hat(next, 0.03 + L * 0.04, s === 7 || s === 15); }
      if (L > 0.4 && (s === 4 || s === 12)) snare(next, 0.18 + L * 0.15);
      // layer 3: arp lead
      if (L > 0.6 && s % 2 === 0) tonal(next, arp[(s / 2 + bar * 2) % 8] + (bar === 3 ? 1 : 0), step * 1.8, 'square', 0.02 + (L - 0.6) * 0.06, 2600);
      next += step; i++;
    }
  }, 60);
}

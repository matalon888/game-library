// Hollowtide — sound: everything synthesized with WebAudio (plasma cutter, footsteps, the Warden, drips, hull groans,
// and an adaptive score that tightens as the threat level rises). No audio files.
let ctx = null, master, comp, verb, verbIn, musicBus, sfxBus, noiseBuf;
export const A = { ready: false, intensity: 0, muted: false };

function impulse(sec = 2.8, decay = 2.6) {
  const n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 40 ? i / 40 : 1); }
  return b;
}
export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(ctx.destination);
      verb = ctx.createConvolver(); verb.buffer = impulse(); verbIn = ctx.createGain(); verbIn.gain.value = .55; verbIn.connect(verb); verb.connect(master);
      sfxBus = ctx.createGain(); sfxBus.connect(master); musicBus = ctx.createGain(); musicBus.gain.value = .5; musicBus.connect(master);
      const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      A.ready = true; ambience(); music();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
}
const now = () => ctx.currentTime;
function out(pan = 0, wet = .3) {
  const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(sfxBus); if (wet) { const s = ctx.createGain(); s.gain.value = wet; p.connect(s); s.connect(verbIn); } }
  else { g.connect(sfxBus); }
  return g;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function osc(type, f0, f1, dur, vol, dest, t = now(), a = .004) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, a, vol, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + .05); return o;
}
function noise(dur, vol, dest, { type = 'bandpass', f = 1200, f1 = null, q = 1, t = now(), a = .002 } = {}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; s.loop = true;
  fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q;
  env(g, t, a, vol, dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + a + dur + .05);
}
// distance → gain and pan (relative to listener yaw)
export function spatial(dx, dz, yaw, range = 30) {
  const d = Math.hypot(dx, dz) || .001, vol = Math.max(0, 1 - d / range) ** 1.6;
  const pan = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d;
  return { vol, pan: pan * .85, d };
}
const ok = () => ctx && A.ready && !A.muted;

export const S = {
  shot() { if (!ok()) return; const o = out(0, .45), t = now();
    noise(.09, .55, o, { f: 2600, f1: 500, q: .8 }); osc('sine', 120, 38, .28, .9, o); osc('sawtooth', 2200, 160, .26, .16, o); osc('square', 880, 1320, .06, .08, o); noise(.5, .07, o, { type: 'lowpass', f: 900, f1: 200, t: t + .05 }); },
  empty() { if (!ok()) return; const o = out(0, .1); osc('square', 1800, 1700, .03, .1, o); noise(.04, .2, o, { f: 3000 }); },
  reload() { if (!ok()) return; const o = out(.2, .15), t = now(); noise(.06, .4, o, { f: 1500, t }); osc('square', 300, 200, .05, .12, o, t + .02); noise(.05, .35, o, { f: 2200, t: t + .55 }); osc('sine', 600, 1400, .25, .12, o, t + .7); noise(.07, .45, o, { f: 1000, t: t + 1.0 }); osc('square', 200, 120, .06, .15, o, t + 1.02); },
  step(water, soft, side) { if (!ok()) return; const o = out(side * .25, .15), v = soft ? .12 : .3;
    if (water) { noise(.22, v * 1.3, o, { type: 'lowpass', f: 1800, f1: 400 }); noise(.08, v * .6, o, { f: 3200, q: 2 }); }
    else { noise(.05, v, o, { f: 1400 + Math.random() * 600, q: 3 }); osc('sine', 90, 60, .07, v * .6, o); } },
  drip(pan, vol) { if (!ok() || vol < .02) return; const o = out(pan, .7), f = 1100 + Math.random() * 900; osc('sine', f, f * .45, .07, .12 * vol, o); },
  spark(pan, vol) { if (!ok() || vol < .02) return; const o = out(pan, .4), t = now(); for (let i = 0; i < 6; i++) noise(.02, .4 * vol * Math.random(), o, { type: 'highpass', f: 3000, t: t + i * .03 + Math.random() * .02 }); osc('sawtooth', 70, 60, .25, .08 * vol, o); },
  hit() { if (!ok()) return; const o = out(0, .2); osc('square', 1600, 2400, .05, .12, o); noise(.08, .3, o, { f: 4000, q: 2 }); },
  clank(pan, vol = 1) { if (!ok()) return; const o = out(pan, .5); noise(.12, .5 * vol, o, { f: 2400, q: 6 }); osc('triangle', 520, 480, .4, .12 * vol, o); osc('triangle', 1310, 1290, .3, .06 * vol, o); },
  break(pan, vol = 1) { if (!ok()) return; const o = out(pan, .5), t = now(); noise(.35, .6 * vol, o, { f: 1800, f1: 300, q: 1 }); osc('sine', 150, 40, .4, .6 * vol, o); osc('sawtooth', 900, 80, .5, .12 * vol, o); for (let i = 0; i < 5; i++) noise(.04, .3 * vol, o, { type: 'highpass', f: 3500, t: t + .1 + i * .06 }); },
  servo(pan, vol) { if (!ok() || vol < .03) return; const o = out(pan, .2), f = 500 + Math.random() * 300; osc('square', f, f * 1.6, .08, .03 * vol, o); osc('square', f * 1.6, f, .08, .03 * vol, o, now() + .09); },
  windup(pan, vol) { if (!ok()) return; const o = out(pan, .2); osc('sawtooth', 300, 1600, .5, .07 * vol, o); },
  wStep(pan, vol) { if (!ok() || vol < .01) return; const o = out(pan, .6); osc('sine', 65, 30, .35, .9 * vol, o); noise(.1, .35 * vol, o, { f: 700, q: 2 }); noise(.25, .12 * vol, o, { f: 2600, q: 8 }); },
  wListen(pan, vol) { if (!ok() || vol < .02) return; const o = out(pan, .6), t = now(); [1250, 940, 1500].forEach((f, i) => osc('sine', f, f * .98, .12, .14 * vol, o, t + i * .13)); },
  wRoar(pan, vol) { if (!ok()) return; const o = out(pan, .7), t = now(); const sh = ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } sh.curve = c; sh.connect(o);
    osc('sawtooth', 210, 70, 1.3, .35 * vol, sh, t, .15); osc('sawtooth', 214, 68, 1.3, .3 * vol, sh, t, .15); osc('square', 52, 40, 1.4, .25 * vol, sh, t, .1); noise(1.2, .2 * vol, o, { f: 600, f1: 200, q: 3, t, a: .2 }); },
  grab() { if (!ok()) return; const o = out(0, .6); noise(.6, .9, o, { f: 900, f1: 100 }); osc('sawtooth', 160, 30, .9, .5, o); osc('sine', 60, 25, 1, .9, o); },
  hurt() { if (!ok()) return; const o = out(0, .3); osc('sine', 200, 60, .25, .5, o); noise(.15, .4, o, { type: 'lowpass', f: 700 }); },
  ping() { if (!ok()) return; const o = out(0, .9), t = now(); osc('sine', 1560, 1540, .5, .22, o, t, .005); osc('sine', 1560, 1540, .4, .08, o, t + .32); },
  blip(pan = 0, vol = 1) { if (!ok()) return; osc('sine', 1900, 1900, .06, .1 * vol, out(pan, .3)); },
  beep() { if (!ok()) return; const o = out(0, .2); osc('square', 880, 880, .07, .07, o); osc('square', 1320, 1320, .09, .07, o, now() + .09); },
  deny() { if (!ok()) return; const o = out(0, .2); osc('square', 180, 170, .25, .12, o); },
  pickup() { if (!ok()) return; const o = out(0, .3), t = now(); [660, 990, 1320].forEach((f, i) => osc('triangle', f, f, .1, .12, o, t + i * .06)); },
  card() { if (!ok()) return; const o = out(0, .3), t = now(); [523, 784, 1046, 1568].forEach((f, i) => osc('square', f, f, .09, .07, o, t + i * .07)); },
  door(pan, vol = 1) { if (!ok() || vol < .03) return; const o = out(pan, .4); noise(.7, .35 * vol, o, { type: 'highpass', f: 4000, f1: 900, a: .02 }); osc('sine', 80, 50, .6, .3 * vol, o); osc('square', 140, 140, .05, .08 * vol, o, now() + .65); },
  term() { if (!ok()) return; const o = out(0, .2), t = now(); for (let i = 0; i < 8; i++) osc('square', 900 + Math.random() * 900, 900, .03, .05, o, t + i * .04); },
  emp(pan = 0) { if (!ok()) return; const o = out(pan, .8), t = now(); osc('sine', 40, 2000, .5, .4, o, t, .01); osc('sawtooth', 3000, 60, 1.2, .25, o, t + .45); noise(1.4, .6, o, { f: 5000, f1: 200, q: .7, t: t + .45 }); osc('sine', 70, 28, 1.2, .9, o, t + .45); },
  throwIt() { if (!ok()) return; noise(.2, .2, out(0, .1), { f: 900, f1: 2400, q: 1 }); },
  heart(vol) { if (!ok() || vol < .03) return; const o = out(0, 0), t = now(); osc('sine', 62, 40, .14, .7 * vol, o, t); osc('sine', 58, 38, .16, .5 * vol, o, t + .22); },
  valve() { if (!ok()) return; const o = out(0, .5); noise(.18, .3, o, { f: 600, q: 4 }); osc('triangle', 180, 220, .2, .12, o); },
  done() { if (!ok()) return; const o = out(0, .6), t = now(); osc('sawtooth', 110, 110, 1.2, .1, o, t, .05); [440, 554, 659, 880].forEach((f, i) => osc('triangle', f, f, .5, .1, o, t + i * .1)); },
  locker() { if (!ok()) return; const o = out(0, .3); noise(.3, .3, o, { f: 500, q: 4 }); osc('sawtooth', 120, 90, .25, .08, o); },
  win() { if (!ok()) return; const o = out(0, .8), t = now(); [[57, 0], [64, .3], [69, .6], [72, .9], [76, 1.2]].forEach(([m, dt]) => { const f = 440 * 2 ** ((m - 69) / 12); osc('sawtooth', f, f, 1.6, .06, o, t + dt, .2); osc('sine', f * 2, f * 2, 1.4, .05, o, t + dt, .1); }); },
  lose() { if (!ok()) return; const o = out(0, .9), t = now(); osc('sawtooth', 220, 40, 2.2, .25, o, t, .05); osc('sawtooth', 233, 41, 2.2, .2, o, t, .05); noise(2, .3, o, { type: 'lowpass', f: 1200, f1: 80, t }); },
};

// ------------------------------------------------------------------ ambience: hull drone, groans, distant knocks
function ambience() {
  const t = now(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 6;
  const g = ctx.createGain(); g.gain.value = .22; lp.connect(g); g.connect(master); const gs = ctx.createGain(); gs.gain.value = .25; g.connect(gs); gs.connect(verbIn);
  for (const f of [41, 41.3, 61.7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); }
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .05; lg.gain.value = 70; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t);
  // filtered water hiss
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = .5; const hg = ctx.createGain(); hg.gain.value = .02; s.connect(f); f.connect(hg); hg.connect(master); s.start();
  const groan = () => {
    if (!A.muted) { const o = out(Math.random() * 2 - 1, 1.2), tt = now(), f0 = 40 + Math.random() * 40;
      osc('sawtooth', f0, f0 * (1.3 + Math.random() * .6), 3 + Math.random() * 2, .06, o, tt, 1.2); noise(3, .05, o, { type: 'lowpass', f: 300, f1: 90, t: tt, a: 1 });
      if (Math.random() < .5) for (let i = 0; i < 3; i++) noise(.08, .12, o, { f: 900, q: 8, t: tt + 2 + i * (.3 + Math.random() * .4) }); }
    setTimeout(groan, 7000 + Math.random() * 9000);
  };
  setTimeout(groan, 3000);
}

// ------------------------------------------------------------------ adaptive score: pad (always), pulse (alert), drums (hunted)
function music() {
  const bpm = 92, sp = 60 / bpm / 4; let step = 0, next = now() + .2;
  const prog = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 58], [40, 47, 52, 56]];   // Am · F · Gm-ish · E (minor, uneasy)
  const padLP = ctx.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 600; const padG = ctx.createGain(); padG.gain.value = .5; padLP.connect(padG); padG.connect(musicBus);
  const pv = ctx.createGain(); pv.gain.value = .6; padG.connect(pv); pv.connect(verbIn);
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  function tick() {
    if (!ctx) return;
    while (next < now() + .25) {
      const bar = (step / 16) | 0, s16 = step % 16, chord = prog[(bar >> 1) % 4], I = A.intensity, mute = A.muted ? 0 : 1;
      if (s16 === 0 && bar % 2 === 0) for (const m of chord) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = Math.random() * 14 - 7; g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(.035 * mute, next + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, next + sp * 32 + .5); o.connect(g); g.connect(padLP); o.start(next); o.stop(next + sp * 32 + .6); }
      padLP.frequency.setTargetAtTime(500 + I * 1500, next, .5);
      // pulse: 8th-note bass ostinato when alert
      if (I > .2 && s16 % 2 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300 + I * 900; o.type = 'sawtooth'; o.frequency.value = hz(chord[0] - 12 + (s16 === 6 || s16 === 14 ? 7 : 0)); g.gain.setValueAtTime(.0001, next); g.gain.exponentialRampToValueAtTime(.09 * Math.min(1, (I - .2) * 2) * mute, next + .01); g.gain.exponentialRampToValueAtTime(.0001, next + sp * 1.6); o.connect(f); f.connect(g); g.connect(musicBus); o.start(next); o.stop(next + sp * 2); }
      // high tension tick: sparse metallic plinks (always, quiet)
      if (s16 === 10 && Math.random() < .5) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = hz(chord[3] + 24); g.gain.setValueAtTime(.0001, next); g.gain.exponentialRampToValueAtTime(.025 * mute, next + .01); g.gain.exponentialRampToValueAtTime(.0001, next + 1.2); o.connect(g); g.connect(musicBus); g.connect(verbIn); o.start(next); o.stop(next + 1.3); }
      // drums when hunted
      if (I > .6) {
        if (s16 % 4 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, next); o.frequency.exponentialRampToValueAtTime(40, next + .15); g.gain.setValueAtTime(.5 * mute, next); g.gain.exponentialRampToValueAtTime(.0001, next + .25); o.connect(g); g.connect(musicBus); o.start(next); o.stop(next + .3); }
        if (s16 % 2 === 1) noise(.04, .06 * mute, musicBus, { type: 'highpass', f: 7000, t: next });
        if (s16 === 4 || s16 === 12) noise(.15, .18 * mute, musicBus, { f: 1800, q: .8, t: next });
      }
      step++; next += sp;
    }
    setTimeout(tick, 60);
  }
  tick();
}

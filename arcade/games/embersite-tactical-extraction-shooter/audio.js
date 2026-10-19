// Embersite sound: everything synthesised with WebAudio. Layered gunshots (crack + thump + reverb tail + valley echo),
// robot plasma fire, metal pings, explosions, footsteps, wind + birds ambience, rotor / engine loops and an adaptive
// music loop (calm pad → tension plucks → combat drums + bass) composed in code.
export function createAudio() {
  let ctx = null, master, comp, verb, verbIn, noiseBuf, music, musicGain = { calm: null, tense: null, combat: null }, loops = {};
  const A = { ready: false, intensity: 0, muted: false };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .25;
    master = ctx.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // outdoor reverb: decaying noise impulse
    verb = ctx.createConvolver(); const L = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, L, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < L; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 3.2) * (i < 900 ? i / 900 : 1); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = .35; verbIn.connect(verb); const vo = ctx.createGain(); vo.gain.value = .5; verb.connect(vo); vo.connect(master);
    A.ready = true; startAmbience(); startMusic();
  }
  A.init = init;
  const now = () => ctx.currentTime;
  const env = (g, t, a, peak, dec, end = .0001) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + dec); };
  function noise(t, dur, { type = 'bandpass', f = 1000, q = 1, gain = .5, a = .002, f2 = null, out = master, send = 0, pan = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = .8 + Math.random() * .4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, gain, dur);
    let node = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    s.connect(fl); fl.connect(g); node.connect(out); if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verbIn); }
    s.start(t, Math.random() * 1.5); s.stop(t + a + dur + .05);
  }
  function osc(t, dur, { type = 'sine', f = 200, f2 = null, gain = .3, a = .002, out = master, send = 0, detune = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); o.detune.value = detune;
    const g = ctx.createGain(); env(g, t, a, gain, dur); o.connect(g); g.connect(out); if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verbIn); }
    o.start(t); o.stop(t + a + dur + .05);
  }
  const distGain = d => 1 / (1 + d / 18);
  // ---- weapons
  A.shot = (kind) => { if (!ctx) return; const t = now();
    if (kind === 'rifle') { noise(t, .09, { type: 'highpass', f: 900, gain: 1.1, send: .9 }); noise(t, .35, { type: 'lowpass', f: 2200, f2: 300, gain: .7 }); osc(t, .22, { f: 140, f2: 38, gain: .9 }); noise(t + .42, .9, { type: 'lowpass', f: 900, f2: 200, gain: .16, send: .6 }); noise(t + .9, .9, { type: 'lowpass', f: 600, f2: 150, gain: .07, send: .6 }); }
    else if (kind === 'carbine') { noise(t, .06, { type: 'highpass', f: 1400, gain: .75, send: .55 }); noise(t, .16, { type: 'lowpass', f: 2600, f2: 400, gain: .45 }); osc(t, .12, { f: 120, f2: 45, gain: .55 }); noise(t + .35, .5, { type: 'lowpass', f: 800, f2: 200, gain: .06, send: .4 }); }
    else if (kind === 'smg') { noise(t, .05, { type: 'bandpass', f: 2600, q: 1.6, gain: .28 }); noise(t, .07, { type: 'lowpass', f: 900, gain: .18 }); osc(t, .05, { type: 'triangle', f: 320, f2: 120, gain: .12 }); noise(t + .02, .03, { type: 'highpass', f: 5000, gain: .08 }); }
    else if (kind === 'dry') osc(t, .03, { type: 'square', f: 1800, f2: 1200, gain: .05 });
  };
  A.reload = (kind) => { if (!ctx) return; const t = now(); const tick = (dt, f, g = .12) => noise(t + dt, .04, { type: 'bandpass', f, q: 4, gain: g });
    tick(0, 2200); tick(.08, 1500, .08); tick(kind === 'rifle' ? .9 : .55, 1800, .16); tick(kind === 'rifle' ? 1.05 : .7, 2800, .1); if (kind === 'rifle') { tick(1.35, 1200, .14); tick(1.45, 2400, .12); } else tick(.95, 3200, .12); };
  A.boltCycle = () => { if (!ctx) return; const t = now() + .18; noise(t, .05, { type: 'bandpass', f: 1600, q: 3, gain: .12 }); noise(t + .14, .05, { type: 'bandpass', f: 2400, q: 3, gain: .1 }); };
  A.enemyShot = (kind, dist, pan = 0) => { if (!ctx) return; const t = now(), g = distGain(dist);
    if (kind === 'kestrel') { osc(t, .25, { type: 'sawtooth', f: 1400, f2: 180, gain: .35 * g + .02, send: .5 }); noise(t, .12, { type: 'highpass', f: 2000, gain: .5 * g, send: .6, pan }); noise(t + .4, .8, { type: 'lowpass', f: 700, f2: 200, gain: .1 * g + .02, send: .5 }); return; }
    if (kind === 'bulwark') { noise(t, .06, { type: 'bandpass', f: 900, q: 1, gain: .5 * g, pan }); osc(t, .06, { type: 'square', f: 260, f2: 90, gain: .25 * g }); return; }
    osc(t, .09, { type: 'square', f: kind === 'strider' ? 1100 : 820, f2: 260, gain: .14 * g + .01, send: .3 }); noise(t, .05, { type: 'bandpass', f: 3000, q: 1.5, gain: .35 * g, pan, send: .3 });
  };
  A.charge = (dist, f = 600) => { if (!ctx) return; const t = now(), g = distGain(dist); osc(t, .4, { type: 'sine', f, f2: f * 2.6, gain: .07 * g + .01 }); };
  A.laser = (dist) => { if (!ctx) return; const t = now(), g = distGain(dist); osc(t, .5, { type: 'sine', f: 2200, gain: .05 * g + .02 }); osc(t, .5, { type: 'sine', f: 2210, gain: .05 * g + .02 }); };
  A.ping = (crit) => { if (!ctx) return; const t = now(); const f = (crit ? 3400 : 2400) + Math.random() * 300; osc(t, .16, { f, gain: .12 }); osc(t, .12, { f: f * 1.5, gain: .05 }); noise(t, .03, { type: 'highpass', f: 4000, gain: .12 }); };
  A.hitmark = (kill) => { if (!ctx) return; const t = now(); osc(t, .05, { type: 'square', f: kill ? 1500 : 2600, gain: .05 }); if (kill) { osc(t + .06, .25, { type: 'triangle', f: 880, gain: .12 }); osc(t + .12, .3, { type: 'triangle', f: 1320, gain: .1 }); } };
  A.boom = (dist = 10) => { if (!ctx) return; const t = now(), g = Math.min(1.2, 30 / (dist + 12));
    noise(t, 1.6, { type: 'lowpass', f: 1400, f2: 120, gain: g, a: .005, send: .9 }); osc(t, .9, { f: 70, f2: 24, gain: g }); noise(t, .12, { type: 'highpass', f: 1500, gain: g * .6 });
    noise(t + .5 + dist / 340, 1.2, { type: 'lowpass', f: 500, f2: 120, gain: g * .25, send: .6 }); };
  A.robotDie = (dist, big) => { if (!ctx) return; const t = now(), g = distGain(dist) * (big ? 1.4 : 1);
    osc(t, .5, { type: 'sawtooth', f: 900, f2: 60, gain: .25 * g + .02 }); noise(t, .25, { type: 'bandpass', f: 1800, q: 2, gain: .5 * g }); for (let i = 0; i < 4; i++) osc(t + i * .05, .08, { type: 'square', f: 2000 - i * 300, gain: .06 * g }); };
  A.alert = (dist) => { if (!ctx) return; const t = now(), g = distGain(dist) * 2 + .05; osc(t, .1, { type: 'square', f: 1250, gain: .08 * g }); osc(t + .12, .16, { type: 'square', f: 1660, gain: .08 * g }); };
  A.hurt = () => { if (!ctx) return; const t = now(); osc(t, .2, { f: 110, f2: 60, gain: .5 }); noise(t, .12, { type: 'lowpass', f: 600, gain: .4 }); };
  A.plate = () => { if (!ctx) return; const t = now(); noise(t, .08, { type: 'bandpass', f: 900, gain: .3 }); osc(t + .05, .2, { type: 'triangle', f: 660, f2: 990, gain: .12 }); };
  A.loot = (r = 0) => { if (!ctx) return; const t = now(); [523, 659, 784, 1046, 1318].slice(0, 2 + r).forEach((f, i) => osc(t + i * .07, .25, { type: 'triangle', f, gain: .12, send: .3 })); };
  A.ui = () => { if (!ctx) return; osc(now(), .05, { type: 'triangle', f: 900, gain: .08 }); };
  A.step = (water) => { if (!ctx) return; const t = now(); water ? noise(t, .16, { type: 'bandpass', f: 1500, q: .7, gain: .1 }) : noise(t, .07, { type: 'bandpass', f: 500 + Math.random() * 500, q: .8, gain: .09 }); };
  A.land = () => { if (!ctx) return; const t = now(); noise(t, .12, { type: 'lowpass', f: 400, gain: .3 }); };
  A.beep = (hi) => { if (!ctx) return; osc(now(), .08, { type: 'square', f: hi ? 1900 : 1400, gain: .06 }); };
  A.radio = () => { if (!ctx) return; const t = now(); noise(t, .1, { type: 'bandpass', f: 2500, q: 3, gain: .12 }); };
  A.throw = () => { if (!ctx) return; noise(now(), .18, { type: 'bandpass', f: 800, f2: 300, gain: .15 }); };
  A.bounce = () => { if (!ctx) return; osc(now(), .06, { type: 'triangle', f: 700, f2: 400, gain: .08 }); };
  A.smokePop = () => { if (!ctx) return; noise(now(), 1.4, { type: 'bandpass', f: 1200, f2: 400, gain: .25 }); };
  A.win = () => { if (!ctx) return; const t = now(); [523, 659, 784, 1046].forEach((f, i) => osc(t + i * .12, .5, { type: 'triangle', f, gain: .15, send: .4 })); };
  A.lose = () => { if (!ctx) return; const t = now(); [392, 330, 262].forEach((f, i) => osc(t + i * .2, .6, { type: 'triangle', f, gain: .14, send: .4 })); };
  // ---- loops (wind, birds, rotor, dropship engines, water)
  function loopNoise(type, f, q, gain) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return { s, fl, g }; }
  function startAmbience() {
    loops.wind = loopNoise('bandpass', 380, .6, .05);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .13; lg.gain.value = 160; lfo.connect(lg); lg.connect(loops.wind.fl.frequency); lfo.start();
    loops.water = loopNoise('lowpass', 900, .5, 0);
    loops.rotor = loopNoise('lowpass', 260, 1, 0);
    const am = ctx.createOscillator(), ag = ctx.createGain(); am.type = 'square'; am.frequency.value = 16; ag.gain.value = 0; am.connect(ag); ag.connect(loops.rotor.g.gain); am.start(); loops.rotorAm = ag;
    loops.engine = (() => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 55; o2.type = 'sawtooth'; o2.frequency.value = 57.5; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); return { g }; })();
    setInterval(() => { if (!A.ready || A.intensity > .6 || Math.random() < .4) return; const t = now() + Math.random(); const f = 2600 + Math.random() * 1800; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) osc(t + i * .13, .09, { f, f2: f * (1.2 + Math.random() * .3), gain: .025, send: .3 }); }, 2600);
  }
  A.loops = (o) => { if (!ctx || !loops.wind) return; const t = now();
    loops.water.g.gain.setTargetAtTime(o.water || 0, t, .3); loops.rotor.g.gain.setTargetAtTime((o.rotor || 0) * .5, t, .3); loops.rotorAm.gain.setTargetAtTime((o.rotor || 0) * .45, t, .3);
    loops.engine.g.gain.setTargetAtTime((o.engine || 0) * .2, t, .3); };
  // ---- adaptive music: D minor, 96 bpm; layers fade by A.intensity (0 calm, .5 tense, 1 combat)
  function startMusic() {
    music = ctx.createGain(); music.gain.value = .5; music.connect(master);
    for (const k of ['calm', 'tense', 'combat']) { musicGain[k] = ctx.createGain(); musicGain[k].gain.value = 0; musicGain[k].connect(music); }
    const bpm = 96, s16 = 60 / bpm / 4; let step = 0, next = ctx.currentTime + .1;
    const chords = [[50, 57, 62, 65], [46, 53, 58, 62], [41, 48, 53, 57], [48, 55, 60, 64]];   // Dm Bb F C
    const mf = m => 440 * Math.pow(2, (m - 69) / 12);
    const tick = () => {
      while (next < ctx.currentTime + .15) {
        const bar = Math.floor(step / 16) % 8, chord = chords[Math.floor(bar / 2)], s = step % 16;
        if (s === 0 && bar % 2 === 0) for (const n of chord) { osc(next, s16 * 30, { type: 'sawtooth', f: mf(n), gain: .025, a: .8, out: musicGain.calm, detune: (Math.random() - .5) * 14 }); osc(next, s16 * 30, { type: 'sine', f: mf(n - 12), gain: .03, a: .8, out: musicGain.calm }); }
        if (s % 2 === 0) { const n = chord[(s / 2 + bar) % 4] + 12 + (s % 8 === 6 ? 12 : 0); osc(next, s16 * 1.6, { type: 'triangle', f: mf(n), gain: .045, out: musicGain.tense, send: .2 }); }
        if (s % 2 === 0) osc(next, s16 * 1.5, { type: 'sawtooth', f: mf(chord[0] - 12 + (s === 6 || s === 14 ? 7 : 0)), gain: .07, out: musicGain.combat });
        if (s === 0 || s === 8 || s === 10) { osc(next, .18, { f: 120, f2: 40, gain: .5, out: musicGain.combat }); }
        if (s === 4 || s === 12) noise(next, .14, { type: 'bandpass', f: 1800, q: .7, gain: .3, out: musicGain.combat });
        if (s % 2 === 1) noise(next, .03, { type: 'highpass', f: 7000, gain: .08, out: musicGain.combat });
        if (s % 4 === 2) noise(next, .02, { type: 'highpass', f: 6000, gain: .05, out: musicGain.tense });
        step++; next += s16;
      }
      const t = ctx.currentTime, I = A.intensity;
      musicGain.calm.gain.setTargetAtTime(A.muted ? 0 : .9 - I * .4, t, .8); musicGain.tense.gain.setTargetAtTime(A.muted ? 0 : Math.min(1, I * 2), t, .8); musicGain.combat.gain.setTargetAtTime(A.muted ? 0 : Math.max(0, I - .55) * 2.2, t, .6);
    };
    setInterval(tick, 50);
  }
  return A;
}

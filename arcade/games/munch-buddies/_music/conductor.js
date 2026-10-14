// conductor.js — shared WebAudio music engine for the hc-games rhythm games. Our own code, MIT.
// One AudioContext, a small synth (piano, bass, pad, kick/snare/hat/crash, chimes) and a look-ahead scheduler that
// queues every event on the audio clock (never setTimeout for musical timing), plus a smoothed song clock for visuals.
let ctx = null, master, comp, verb, verbSend, noiseBuf;

export function audio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  comp = ctx.createDynamicsCompressor();
  Object.assign(comp, {}); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
  // small generated reverb for that "produced" glue
  verb = ctx.createConvolver(); const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir; verbSend = ctx.createGain(); verbSend.gain.value = 0.28; verbSend.connect(verb); verb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
/** call from any pointerdown so the context unlocks on mobile */
export function unlockAudio() { try { audio(); } catch (e) {} }
addEventListener('pointerdown', unlockAudio, { capture: true });
/** QA hook: lets automated checks confirm the audio clock is running and tap the master output */
window.__hcAudio = () => ({ ctx, master: comp });

const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

// ---------------------------------------------------------------- instruments (all take an absolute audio time `t`)
export const synth = {
  /** soft electric-piano/celesta voice: triangle + bell partials, short hammer click, into the reverb */
  piano(midi, t, dur = 0.4, vol = 0.2, bright = 1) {
    const c = audio(); t = Math.max(t, c.currentTime); const f = mf(midi), g = c.createGain(), d = Math.min(1.6, Math.max(0.25, dur * 1.4));
    env(g, t, 0.006, vol, d);
    for (const [mult, type, v, det] of [[1, 'triangle', 1, 0], [1, 'sine', 0.5, 6], [2, 'sine', 0.3 * bright, 0], [3, 'sine', 0.1 * bright, 0], [4.01, 'sine', 0.05 * bright, 0]]) {
      const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f * mult; o.detune.value = det; og.gain.value = v;
      if (mult > 2) { og.gain.setValueAtTime(v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.25); }
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.05);
    }
    g.connect(master); g.connect(verbSend);
  },
  /** sparkly pluck for pickups/collect */
  chime(midi, t, vol = 0.12) {
    const c = audio(); t = Math.max(t, c.currentTime); const g = c.createGain(); env(g, t, 0.004, vol, 0.35);
    for (const [m, v] of [[1, 1], [2, 0.4], [3.5, 0.15]]) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = mf(midi) * m; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.42); }
    g.connect(master); g.connect(verbSend);
  },
  bass(midi, t, dur = 0.3, vol = 0.22) {
    const c = audio(); t = Math.max(t, c.currentTime); const o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = mf(midi); o2.frequency.value = mf(midi);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, dur)); lp.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(lp); o2.connect(g); lp.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  },
  pad(midis, t, dur = 2, vol = 0.035) {
    const c = audio(); t = Math.max(t, c.currentTime); const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.25, dur * 0.3)); g.gain.setValueAtTime(vol, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    for (const m of midis) for (const det of [-9, 9]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.25); }
    lp.connect(g); g.connect(master); g.connect(verbSend);
  },
  kick(t, vol = 0.9) {
    const c = audio(); t = Math.max(t, c.currentTime); const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.35);
  },
  noise(t, { hp = 6000, dur = 0.05, vol = 0.1, bp = 0 } = {}) {
    const c = audio(); t = Math.max(t, c.currentTime); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = bp || hp; if (bp) f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
    return g;
  },
  snare(t, vol = 1) { synth.noise(t, { bp: 1800, dur: 0.16, vol: 0.32 * vol }); const c = audio(), o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); g.gain.setValueAtTime(0.18 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.12); },
  hat(t, vol = 1) { synth.noise(t, { hp: 7500, dur: 0.045, vol: 0.09 * vol }); },
  crash(t, vol = 1) { synth.noise(t, { hp: 4500, dur: 1.2, vol: 0.09 * vol }); },
  /** whoosh-down used on fail: a falling sine sweep */
  fail(t) { const c = audio(); t = Math.max(t ?? c.currentTime, c.currentTime); const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.6); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.65); const lp = c.createBiquadFilter(); lp.frequency.value = 1400; o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.7); },
};

// ---------------------------------------------------------------- player: schedules a track (from songs.arrange) on the audio clock
/**
 * const player = createPlayer();
 * player.start(track, { lead: 1.5, melody: true, melVol: 0.2, accVol: 1, countIn: true })
 * player.time()  → song seconds (0 = first downbeat, negative during the lead-in), smoothed, latency-compensated
 * player.stop(fade) ; player.playNote(midi, dur, vol) plays a melody note *now* (for tap-to-play games)
 * player.at(songTime) → absolute audio time, for scheduling extra sounds in sync
 */
export function createPlayer() {
  let track = null, t0 = 0, i = 0, timer = 0, playing = false, opts = {}, perfClock = false, p0 = 0;
  let anchorA = -1, anchorP = 0, events = [], gain = 1;
  function rawNow() {
    const p = performance.now() / 1000;
    if (perfClock) return p - p0;
    const a = ctx.currentTime;
    if (a !== anchorA) { anchorA = a; anchorP = p; }
    return anchorA + Math.min(p - anchorP, 0.06);
  }
  function pump() {
    if (!playing) return;
    const c = ctx, horizon = c.currentTime + 0.14;
    while (i < events.length && t0 + events[i].t < horizon) {
      const e = events[i++], at = t0 + e.t, v = (e.vol ?? 1) * gain;
      if (perfClock) continue;
      switch (e.kind) {
        case 'mel': synth.piano(e.midi, at, e.dur, (opts.melVol ?? 0.2) * v); break;
        case 'bass': synth.bass(e.midi, at, e.dur, 0.2 * v * (opts.accVol ?? 1)); break;
        case 'pad': synth.pad(e.midi, at, e.dur, 0.03 * (opts.accVol ?? 1)); break;
        case 'kick': synth.kick(at, 0.85 * v * (opts.drumVol ?? 1)); break;
        case 'snare': synth.snare(at, 0.9 * v * (opts.drumVol ?? 1)); break;
        case 'hat': synth.hat(at, v * (opts.drumVol ?? 1)); break;
        case 'crash': synth.crash(at, v * (opts.drumVol ?? 1)); break;
        case 'tick': synth.hat(at, 1.4); break;
      }
    }
  }
  return {
    start(tr, o = {}) {
      audio(); track = tr; opts = o; i = 0; gain = 1;
      perfClock = ctx.state !== 'running';
      const lead = o.lead ?? 1.5;
      if (perfClock) { p0 = performance.now() / 1000 + lead; t0 = 0; }
      else t0 = ctx.currentTime + lead;
      events = [...tr.acc.map(e => ({ ...e }))];
      if (o.melody !== false) for (const n of tr.melody) events.push({ t: n.t, kind: 'mel', midi: n.midi, dur: n.dur });
      if (o.countIn !== false) { const sb = tr.beats[1] ? tr.beats[1].t - tr.beats[0].t : 0.5; for (let k = 1; k <= 4 && k * sb <= lead + 0.01; k++) events.push({ t: -k * sb, kind: 'tick' }); }
      events.sort((a, b) => a.t - b.t);
      playing = true; clearInterval(timer); timer = setInterval(pump, 25); pump();
      // the context may finish resuming a moment later: switch from the fallback clock to the audio clock if so
      if (perfClock) ctx.resume().then(() => { if (playing && perfClock) { const st = this.time(); perfClock = false; t0 = ctx.currentTime - st; } }).catch(() => {});
    },
    stop(fade = 0) { playing = false; clearInterval(timer); if (fade && master && ctx) { const n = ctx.currentTime; master.gain.cancelScheduledValues(n); master.gain.setValueAtTime(master.gain.value, n); master.gain.linearRampToValueAtTime(0.0001, n + fade); master.gain.linearRampToValueAtTime(0.9, n + fade + 0.9); } },
    /** soften everything still to come (e.g. after a fail) */
    duck(g) { gain = g; },
    time() { if (!ctx) return -99; const lat = perfClock ? 0 : (ctx.outputLatency || ctx.baseLatency || 0); return rawNow() - t0 - lat; },
    at(songT) { return perfClock ? (ctx ? ctx.currentTime : 0) : t0 + songT; },
    playNote(midi, dur = 0.4, vol = 0.24, delay = 0) { synth.piano(midi, audio().currentTime + delay, dur, vol); },
    get playing() { return playing; }, get track() { return track; },
  };
}

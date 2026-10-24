// The Morning Paper sound: soft harp and piano plucks, a pencil tick, a gentle music-box loop. All synthesised (WebAudio),
// quiet by design, nothing sharp or flashing. Music and sound can be switched off separately.
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false, musicOff = false, musicTimer = 0, nextT = 0, step = 0, paused = false;
try { muted = localStorage.getItem('mpaper_mute') === '1'; musicOff = localStorage.getItem('mpaper_music') === '0'; } catch (e) {}

function init() {
  if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.3; verb.connect(wet); wet.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master); sfxBus.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOff ? 0 : 0.22; musicBus.connect(master); musicBus.connect(verb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// a plucked string: fundamental + a few soft partials, fast attack, long natural decay
function pluck(midi, { t = 0, dur = 1.4, vol = 0.12, bus = null, bright = 0.35 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  g.connect(bus || sfxBus);
  for (const [mult, type, v, d] of [[1, 'triangle', 1, 1], [2, 'sine', bright, 0.5], [3, 'sine', bright * 0.35, 0.3], [4.01, 'sine', bright * 0.15, 0.2]]) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz(midi) * mult;
    og.gain.setValueAtTime(v, n); og.gain.exponentialRampToValueAtTime(0.0001, n + dur * d);
    o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
  }
}
function tick({ t = 0, vol = 0.05, f = 2600, dur = 0.035 } = {}) {
  if (!init()) return;
  const n = ctx.currentTime + t, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 3;
  g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(n, Math.random() * 0.5); s.stop(n + dur + 0.02);
}
const MAJ = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
// gentle loop: I – vi – IV – V in F major, harp arpeggios with a slow bass, 66 bpm
const PROG = [[53, [0, 4, 7, 12, 16]], [50, [0, 3, 7, 12, 15]], [46, [0, 4, 7, 12, 16]], [48, [0, 4, 7, 10, 16]]];
const PAT = [0, 2, 1, 3, 2, 4, 3, 1];
function schedule() {
  if (!ctx || musicOff || muted || paused) return;
  while (nextT < ctx.currentTime + 0.6) {
    const bar = Math.floor(step / 8) % PROG.length, [root, ch] = PROG[bar], i = step % 8, at = nextT - ctx.currentTime;
    if (i === 0) pluck(root - 12, { t: at, dur: 3.2, vol: 0.07, bus: musicBus, bright: 0.15 });
    if (!(i === 7 && Math.random() < 0.4)) pluck(root + 12 + ch[PAT[i]], { t: at, dur: 2.2, vol: 0.045 + (i === 0 ? 0.015 : 0), bus: musicBus, bright: 0.25 });
    nextT += 60 / 66 / 2; step++;
  }
}
export const snd = {
  unlock() { if (init()) { if (!musicTimer) { nextT = ctx.currentTime + 0.3; musicTimer = setInterval(schedule, 200); } } },
  get muted() { return muted; }, get musicOff() { return musicOff; },
  toggle() { muted = !muted; try { localStorage.setItem('mpaper_mute', muted ? '1' : '0'); } catch (e) {} if (init()) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05); if (!muted && ctx) nextT = ctx.currentTime + 0.2; return muted; },
  toggleMusic() { musicOff = !musicOff; try { localStorage.setItem('mpaper_music', musicOff ? '0' : '1'); } catch (e) {} if (init()) { musicBus.gain.setTargetAtTime(musicOff ? 0 : 0.22, ctx.currentTime, 0.2); nextT = ctx.currentTime + 0.2; } return musicOff; },
  pause(p) { paused = p; if (!ctx) return; if (p) ctx.suspend().catch(() => {}); else { ctx.resume().catch(() => {}); nextT = ctx.currentTime + 0.2; } },
  tap() { tick({ vol: 0.06, f: 1800, dur: 0.05 }); pluck(84, { dur: 0.25, vol: 0.03, bright: 0.1 }); },
  key() { tick({ vol: 0.08, f: 3200 + Math.random() * 600, dur: 0.04 }); },
  place(d = 5) { pluck(67 + MAJ[(d - 1) % MAJ.length], { dur: 0.9, vol: 0.07 }); },
  soft() { pluck(72, { dur: 0.5, vol: 0.05, bright: 0.1 }); },
  bad() { pluck(57, { dur: 0.5, vol: 0.07, bright: 0.05 }); pluck(56, { t: 0.12, dur: 0.6, vol: 0.06, bright: 0.05 }); },
  word(k = 0) { for (let i = 0; i < 4; i++) pluck(72 + MAJ[(k + i) % 6] + (i === 3 ? 12 : 0), { t: i * 0.07, dur: 1.2, vol: 0.07 }); },
  select(i = 0) { pluck(72 + MAJ[Math.min(MAJ.length - 1, i)], { dur: 0.5, vol: 0.04, bright: 0.2 }); },
  solve() { [65, 69, 72, 77, 81, 84, 89].forEach((m, i) => pluck(m, { t: i * 0.09, dur: 2, vol: 0.08 })); pluck(53, { dur: 3, vol: 0.08, bright: 0.1 }); },
  coin() { pluck(96, { dur: 0.6, vol: 0.04, bright: 0.6 }); pluck(103, { t: 0.06, dur: 0.6, vol: 0.03, bright: 0.6 }); },
  stamp() { tick({ vol: 0.25, f: 220, dur: 0.12 }); pluck(41, { dur: 0.4, vol: 0.1, bright: 0 }); },
  page() { if (!init()) return; const n = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(900, n); f.frequency.exponentialRampToValueAtTime(3200, n + 0.25); g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.05, n + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.3); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(n); s.stop(n + 0.35); },
};

// audio.js — Skidsy's own sound: a looping chiptune-ish race tune composed here, an engine hum that follows speed,
// and a few whooshes. Everything is synthesised with WebAudio; nothing is sampled.
let ctx = null, master = null, musicGain = null, engO = null, engO2 = null, engF = null, engG = null, timer = 0, step = 0, nextT = 0, muted = false, fast = false;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function audioInit() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 600;
  engG = ctx.createGain(); engG.gain.value = 0; engF.connect(engG); engG.connect(master);
  engO = ctx.createOscillator(); engO.type = 'sawtooth'; engO.frequency.value = 50; engO.connect(engF); engO.start();
  engO2 = ctx.createOscillator(); engO2.type = 'square'; engO2.frequency.value = 25; const g2 = ctx.createGain(); g2.gain.value = 0.35; engO2.connect(g2); g2.connect(engF); engO2.start();
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
export const isMuted = () => muted;
export function engine(speed01, boost, on) {
  if (!ctx) return; const t = ctx.currentTime;
  engO.frequency.setTargetAtTime(48 + speed01 * 95 + (boost ? 30 : 0), t, 0.08);
  engO2.frequency.setTargetAtTime(24 + speed01 * 48 + (boost ? 15 : 0), t, 0.08);
  engF.frequency.setTargetAtTime(380 + speed01 * 900 + (boost ? 600 : 0), t, 0.1);
  engG.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.035 : 0, t, 0.15);
}
function voice(type, f, t, dur, vol, dest, slide = 1, cutoff = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl); fl.connect(g); } else o.connect(g);
  g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function hat(t, vol, dest, len = 0.04) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + len + 0.02);
}
// an original 4-bar loop in F major: I – vi – IV – V with a bouncy lead
const CH = [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55]];
const LEAD = [72, 0, 69, 72, 74, 0, 72, 69, 69, 0, 65, 69, 72, 0, 74, 76, 70, 0, 69, 70, 74, 0, 72, 70, 72, 0, 74, 72, 67, 69, 70, 72];
const LEAD2 = [77, 0, 76, 74, 72, 0, 74, 76, 74, 0, 72, 69, 65, 0, 69, 72, 70, 0, 72, 74, 77, 0, 74, 70, 72, 0, 70, 69, 67, 0, 64, 67];
function tick() {
  if (!ctx) return;
  const spb = 60 / (fast ? 156 : 140) / 2;     // eighth notes
  while (nextT < ctx.currentTime + 0.2) {
    const bar = Math.floor(step / 8) % 4, e = step % 8, ch = CH[bar], phrase = Math.floor(step / 32) % 2, ld = (phrase ? LEAD2 : LEAD)[step % 32];
    voice('square', mtof(ch[0] - 12), nextT, spb * 0.9, 0.09, musicGain, 1, 700);
    if (e % 2 === 1) voice('square', mtof(ch[0]), nextT, spb * 0.6, 0.04, musicGain, 1, 1400);
    if (e === 0 || e === 4) voice('sine', 90, nextT, 0.16, 0.22, musicGain, 0.4);
    if (e === 2 || e === 6) { hat(nextT, 0.08, musicGain, 0.09); voice('triangle', 190, nextT, 0.08, 0.06, musicGain, 0.5); }
    hat(nextT, 0.035, musicGain);
    if (ld) voice('triangle', mtof(ld), nextT, spb * 1.6, 0.07, musicGain);
    if (e === 0) for (const n of ch) voice('sine', mtof(n + 12), nextT, spb * 7, 0.018, musicGain);
    step++; nextT += spb;
  }
}
export function music(on, isFast = false) {
  if (!ctx) return; fast = isFast;
  musicGain.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.3);
  if (on && !timer) { nextT = ctx.currentTime + 0.05; timer = setInterval(tick, 60); }
  if (!on && timer) { setTimeout(() => { if (musicGain.gain.value < 0.05) { clearInterval(timer); timer = 0; } }, 1200); }
}
export function whoosh(vol = 0.12) { if (!ctx) return; const t = ctx.currentTime; voice('sawtooth', 180, t, 0.45, vol, master, 3.2, 1800); hat(t, vol * 0.8, master, 0.3); }
export function bonk() { if (!ctx) return; const t = ctx.currentTime; voice('square', 140, t, 0.12, 0.1, master, 0.6, 900); hat(t, 0.05, master, 0.06); }
export function spinOut() { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 4; i++) voice('triangle', 700 - i * 120, t + i * 0.07, 0.12, 0.08, master, 0.7); }
export function skid(on) { /* drift squeal: short repeated chirps while drifting */ if (!ctx || !on) return; voice('sawtooth', 820 + Math.random() * 120, ctx.currentTime, 0.06, 0.012, master, 0.92, 2500); }

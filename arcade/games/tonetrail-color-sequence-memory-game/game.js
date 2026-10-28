// Tonetrail — a colour-and-tone memory game. Four little singers light up a sequence that grows by one each round;
// sing it back in the same order. One slip ends the run. Today's score = your longest sequence.
import { createUI, store, buzz, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, arp } from './calm.js';

const NAME = 'Tonetrail: Color Sequence Memory Game';
const S = store('tonetrail');
const F = flow('tonetrail', { par: 9, warmup: 4 });
const ui = createUI({ title: 'Tonetrail', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#7b6cff' });
const D = daily('tonetrail', ui, { name: NAME });
const B = board({ game: 'tonetrail', label: 'Longest sequence', limits: { maxRun: 80, maxPerSec: 1 }, corner: 'tl' });
startCard(ui, D, { kicker: D.isDaily ? 'Daily sequence' : 'colour memory game' });
{ const p = document.createElement('p'); p.textContent = 'Watch the singers, then repeat the tune.'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:14px'; ui.els.start.querySelector('.hint').before(p); }
const fx = fx2d(11);

// four singers: colour, dark tone, note (G major-ish open voicing), little face style
const PADS = [
  { name: 'Rosie', c: '#ff5d78', d: '#a8344d', glow: '#ffb3c1', midi: 64 },
  { name: 'Sunny', c: '#ffc23d', d: '#b07b12', glow: '#ffe6a3', midi: 67 },
  { name: 'Minto', c: '#2fca95', d: '#1b7e5c', glow: '#a8f2d7', midi: 71 },
  { name: 'Bluey', c: '#4a9bff', d: '#2a5fae', glow: '#b6d7ff', midi: 74 },
];
const INK = '#f2efff';
css(`
body{background:radial-gradient(120% 75% at 50% 15%,#3b3577,#1b1838 70%);color:${INK}}
body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(255,255,255,.18) 1px,transparent 1.5px);background-size:30px 30px;opacity:.5;pointer-events:none}
#tt{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
.hc-top .hc-lvl{width:30px;height:30px;font-size:15px;font-family:inherit;font-weight:700;box-shadow:none}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.15);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.15);height:8px}
`);
const cv = document.createElement('canvas'); cv.id = 'tt'; document.body.appendChild(cv);
const g = cv.getContext('2d');

let state = 'ready', seq = [], pos = 0, phase = 'idle', score = 0, best = S.get('best', 0), runs = 0, r = Math.random, recorded = false, beatenShown = false;
const lit = [0, 0, 0, 0], litAt = [0, 0, 0, 0], press = [0, 0, 0, 0];
let sad = 0, phaseAt = 0, timers = [], t0 = 0;
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

function sing(i, dur = 0.42, vol = 0.2) {
  litAt[i] = performance.now(); lit[i] = dur * 1000;
  note(PADS[i].midi, dur + 0.25, vol); note(PADS[i].midi + 12, dur * 0.6, vol * 0.18);
  const [x, y] = padCenter(i); fx.sparks(x, y - geo.s * 0.12, [PADS[i].glow, '#fff'], 5, { speed: 2.2, size: 4, kind: 'dot', g: -0.03 });
}
function newRun() {
  timers.forEach(clearTimeout); timers = [];
  runs++; score = 0; seq = []; recorded = false; sad = 0;
  r = D.seed ? rng(D.seed * 7 + 3) : rng(((Date.now() ^ runs * 7919) >>> 0) % 2147483646 + 1);
  state = 'play'; t0 = performance.now(); B.start();
  ui.levels(1); ui.progress(0); ui.sub('');
  later(nextRound, 650);
}
function nextRound() {
  seq.push(Math.floor(r() * 4)); pos = 0; phase = 'show'; phaseAt = performance.now();
  ui.levels(seq.length); ui.progress(0);
  const fk = F.k(seq.length);
  const gap = Math.max(240, Math.min(660, 680 - seq.length * 22) / fk), on = gap * 0.62;
  seq.forEach((p, k) => later(() => sing(p, on / 1000), 380 + k * gap));
  later(() => { phase = 'input'; phaseAt = performance.now(); tone(980, 0.05, 'sine', 0.05, 1.2); }, 380 + seq.length * gap);
}
function tap(i) {
  if (state !== 'play' || phase !== 'input') return;
  press[i] = performance.now();
  if (seq[pos] !== i) return fail(i);
  sing(i, 0.32); buzz(6); pos++; ui.progress(pos / seq.length);
  if (pos === seq.length) {
    score = seq.length; phase = 'wait';
    if (score > best) { best = score; S.set('best', best); }
    const [x, y] = [geo.cx, geo.cy];
    fx.ring(x, y, '#fff', geo.s * 0.18);
    if (score % 5 === 0) { ui.pop(`${score}!`, '#fff', 46, 22); arp([72, 76, 79, 84], 70, 0.1, 0.5); fx.sparks(x, y, PADS.map(p => p.c), 26, { speed: 5 }); buzz([12, 30, 12]); }
    else ui.pop(['Nice!', 'Yes!', 'Great!', 'Sweet!'][score % 4], '#fff', 30, 22);
    if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 42, 30); fx.confetti(80); }, 300); }
    later(nextRound, 700);
  }
}
function fail(i) {
  phase = 'over'; state = 'lost'; sad = performance.now();
  timers.forEach(clearTimeout); timers = [];
  tone(150, 0.4, 'sawtooth', 0.09, 0.6); tone(110, 0.5, 'square', 0.05, 0.7); buzz([30, 40, 60]);
  const right = seq[pos]; later(() => sing(right, 0.5, 0.12), 350);
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  ui.lose(score ? `Sequence ${score}` : 'Oops!', score >= best && score ? 'New best! The glowing singer was next.' : `Best ${best} · the glowing singer was next`);
}
ui.onTap(() => newRun());
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first run, until the first real
// touch, the one-note opening sequence is answered by pressing the singer that just sang, and round 2 starts playing
demo(() => { tap(seq[0]); },
  { ready: () => state === 'play' && phase === 'input' && seq.length === 1 && pos === 0 && runs === 1 && !D.seed, wait: 1800, max: 1 });

// ---------------------------------------------------------------- layout + input
let dpr = 1, W = 0, H = 0, geo = { s: 300, cx: 0, cy: 0 };
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const s = Math.min(W - 36, H - 300, 540);
  geo = { s, cx: W / 2, cy: Math.round(Math.max(150 + s / 2, H * 0.53)) };
}
addEventListener('resize', layout); layout();
function padRect(i) { const { s, cx, cy } = geo, gap = s * 0.05, w = (s - gap) / 2; return [cx - s / 2 + (i % 2) * (w + gap), cy - s / 2 + ((i / 2) | 0) * (w + gap), w]; }
function padCenter(i) { const [x, y, w] = padRect(i); return [x + w / 2, y + w / 2]; }
cv.addEventListener('pointerdown', e => {
  for (let i = 0; i < 4; i++) { const [x, y, w] = padRect(i); if (e.clientX >= x && e.clientX < x + w && e.clientY >= y && e.clientY < y + w) { tap(i); return; } }
});
addEventListener('keydown', e => { const k = '1234'.indexOf(e.key); const q = 'qwas'.indexOf(e.key.toLowerCase()); const i = k >= 0 ? k : q; if (i >= 0) tap(i); });

// ---------------------------------------------------------------- drawing
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function face(cx, cy, s, on, k, t, i) {
  g.save(); g.translate(cx, cy);
  const ink = 'rgba(40,20,50,.85)';
  const blink = !on && ((t * 1000 / 1000 + i * 1.3) % 4.6) < 0.12;
  for (const sx of [-1, 1]) {
    if (on || sad) { g.strokeStyle = ink; g.lineWidth = s * 0.04; g.lineCap = 'round'; g.beginPath(); g.arc(sx * s * 0.2, -s * 0.02 + (sad ? s * 0.06 : 0), s * 0.06, sad ? Math.PI * 1.15 : Math.PI * 1.1, sad ? Math.PI * 1.85 : Math.PI * 1.9); g.stroke(); }
    else if (blink) { g.strokeStyle = ink; g.lineWidth = s * 0.035; g.beginPath(); g.moveTo(sx * s * 0.2 - s * 0.05, -s * 0.03); g.lineTo(sx * s * 0.2 + s * 0.05, -s * 0.03); g.stroke(); }
    else { g.fillStyle = ink; g.beginPath(); g.ellipse(sx * s * 0.2, -s * 0.03, s * 0.05, s * 0.065, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * s * 0.2 + s * 0.018, -s * 0.055, s * 0.018, 0, 7); g.fill(); }
  }
  g.fillStyle = 'rgba(255,255,255,.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * s * 0.31, s * 0.08, s * 0.06, s * 0.035, 0, 0, 7); g.fill(); }
  if (on) { const m = 0.6 + 0.4 * Math.sin(k * Math.PI); g.fillStyle = ink; g.beginPath(); g.ellipse(0, s * 0.13, s * 0.07, s * 0.09 * m, 0, 0, 7); g.fill(); g.fillStyle = '#ff8fa3'; g.beginPath(); g.ellipse(0, s * 0.17, s * 0.045, s * 0.03 * m, 0, 0, 7); g.fill(); }
  else if (sad) { g.strokeStyle = ink; g.lineWidth = s * 0.035; g.lineCap = 'round'; g.beginPath(); g.arc(0, s * 0.2, s * 0.07, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  else { g.strokeStyle = ink; g.lineWidth = s * 0.035; g.lineCap = 'round'; g.beginPath(); g.arc(0, s * 0.08, s * 0.07, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
  g.restore();
}
function noteGlyph(x, y, s, col, a) {
  g.save(); g.globalAlpha = a; g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.12;
  g.beginPath(); g.ellipse(x, y, s * 0.28, s * 0.2, -0.4, 0, 7); g.fill();
  g.beginPath(); g.moveTo(x + s * 0.24, y - s * 0.05); g.lineTo(x + s * 0.24, y - s * 0.9); g.quadraticCurveTo(x + s * 0.6, y - s * 0.7, x + s * 0.55, y - s * 0.4); g.stroke(); g.restore();
}
function draw(t) {
  const now = performance.now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const { s, cx, cy } = geo;
  // base plate
  g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 40; g.shadowOffsetY = 16; rr(cx - s / 2 - 14, cy - s / 2 - 14, s + 28, s + 28, s * 0.14); g.fillStyle = '#2a2556'; g.fill(); g.restore();
  rr(cx - s / 2 - 14, cy - s / 2 - 14, s + 28, s + 28, s * 0.14); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 4; i++) {
    const P = PADS[i], [x, y, w] = padRect(i), el = now - litAt[i], on = el < lit[i], k = on ? el / lit[i] : 1;
    const pr = now - press[i] < 140 ? 1 - (now - press[i]) / 140 : 0;
    const pop = on ? Math.sin(Math.min(1, el / 160) * Math.PI) * 0.05 : 0, sc = 1 + pop - pr * 0.04;
    const isNext = state === 'lost' && seq[pos] === i && now - sad > 700;
    g.save(); g.translate(x + w / 2, y + w / 2); g.scale(sc, sc);
    if (on || isNext) { g.shadowColor = P.c; g.shadowBlur = w * 0.45; }
    else { g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 8; }
    const R = w * 0.3;
    rr(-w / 2, -w / 2, w, w, R); g.fillStyle = on || isNext ? P.c : P.d; g.fill(); g.shadowColor = 'transparent';
    const gr = g.createLinearGradient(0, -w / 2, 0, w / 2); gr.addColorStop(0, on ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.18)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)');
    rr(-w / 2, -w / 2, w, w, R); g.fillStyle = gr; g.fill();
    rr(-w / 2 + 6, -w / 2 + 6, w - 12, w * 0.42, R * 0.8); g.fillStyle = 'rgba(255,255,255,.10)'; g.fill();
    g.globalAlpha = on ? 1 : 0.85; face(0, w * 0.04 + (on ? -Math.sin(k * Math.PI) * w * 0.03 : Math.sin(t * 2 + i) * w * 0.006), w, on, k, t, i); g.globalAlpha = 1;
    if (on) noteGlyph(w * 0.3, -w * 0.18 - k * w * 0.25, w * 0.2, '#fff', 1 - k);
    g.restore();
  }
  // centre medallion: sequence length / status
  const m = s * 0.15;
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18; g.beginPath(); g.arc(cx, cy, m, 0, 7); g.fillStyle = '#1e1a40'; g.fill(); g.restore();
  g.beginPath(); g.arc(cx, cy, m, 0, 7); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
  if (phase === 'input' && seq.length) { g.beginPath(); g.arc(cx, cy, m - 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pos / seq.length); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.stroke(); }
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${Math.round(m * 0.78)}px -apple-system,system-ui,sans-serif`; g.fillText(state === 'ready' ? '♪' : String(seq.length || 0), cx, cy - m * 0.08);
  g.font = `700 ${Math.round(m * 0.2)}px -apple-system,system-ui,sans-serif`; g.globalAlpha = 0.65; g.fillText(phase === 'input' ? 'YOUR TURN' : phase === 'show' ? 'LISTEN' : 'SEQUENCE', cx, cy + m * 0.45); g.globalAlpha = 1;
  // status text above the board
  const ty = cy - s / 2 - 46;
  if (ty > 80) {
    g.font = '700 20px -apple-system,system-ui,sans-serif'; g.fillStyle = INK;
    const msg = state !== 'play' ? '' : phase === 'show' ? 'Watch and listen…' : phase === 'input' ? `Your turn · ${seq.length - pos} to go` : 'Nice!';
    g.fillText(msg, cx, ty);
    g.font = '600 14px -apple-system,system-ui,sans-serif'; g.globalAlpha = 0.6; g.fillText(`Best ${best}${D.isDaily ? ' · daily tune' : ''}`, cx, ty + 24); g.globalAlpha = 1;
  }
}
function frame(t) { draw(t / 1000); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
ui.start();

window.__game = {
  get state() { return state; }, get level() { return seq.length; }, get score() { return score; },
  bot() {   // a good human memory: perfect up to ~4, then slips grow a little with every extra note
    if (state !== 'play' || phase !== 'input') return;
    const slip = Math.max(0, (seq.length - 4) * 0.04);
    tap(Math.random() < slip ? (seq[pos] + 1 + Math.floor(Math.random() * 3)) % 4 : seq[pos]);
  },
};

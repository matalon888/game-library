// Grumble Drop — original physics topple puzzle. Tap wooden and glass blocks to remove them so the grumpy trolls
// tumble into the sea, while Pip (the friendly sprout) stays dry. Stone can't be tapped. Every level is generated
// from a seed and checked by simulation before you see it.
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, fx2d, arp, todayKey } from './calm.js';
import { makeLevel, build, describe, DT, WATER, MAT } from './gen.js';

const NAME = 'Grumble Drop: Tower Topple Game';
const S = store('grumble-drop');
const F = flow('grumble-drop');
const ui = createUI({ title: 'Grumble Drop', hint: 'Tap to play', hand: '👆', score: false });
cardTheme({ accent: '#f08a3c', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('grumble-drop', ui, { name: NAME });
const B = board({ game: 'grumble-drop', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.6 }, mode: 'sum', corner: 'bl' });
const fx = fx2d(9);

css(`
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(30,40,70,.55),rgba(30,40,70,.35) 55%,rgba(30,40,70,.6));-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.hc-card h1{font-weight:800;font-size:clamp(46px,14vw,76px);color:#fff;text-shadow:0 5px 0 #c4561c,0 10px 24px rgba(0,0,0,.25)}
.hc-card p{font-weight:700}
.gd-rules{display:flex;gap:14px;justify-content:center;margin-top:14px}
.gd-rules div{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:16px;padding:8px 10px;font-size:14px;font-weight:700;line-height:1.15;width:100px}
.gd-rules canvas{display:block;margin:0 auto 4px}
.hc-top{z-index:6}.hc-sub{top:calc(52px + env(safe-area-inset-top));left:50%;right:auto;transform:translateX(-50%);width:max-content;font-size:14px;letter-spacing:1.5px;font-weight:800;text-transform:uppercase;color:#2f4a6d;background:rgba(255,255,255,.75);border-radius:14px;padding:2px 14px;text-shadow:none}
.hc-sub:empty{display:none}
#gd-taps{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(22px + env(safe-area-inset-bottom));z-index:5;display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.92);color:#33415c;border-radius:30px;padding:8px 18px 8px 12px;font:800 20px 'Baloo 2',system-ui,sans-serif;box-shadow:0 6px 0 rgba(0,40,80,.18),0 10px 24px rgba(0,30,60,.18);pointer-events:none;white-space:nowrap}
#gd-taps .dots{display:flex;gap:6px}
#gd-taps .dots i{width:16px;height:16px;border-radius:50%;background:#f08a3c;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
#gd-taps .dots i.off{background:#d5dbe6;box-shadow:none}
#gd-taps.low{animation:gdlow .5s ease 2}
@keyframes gdlow{50%{transform:translateX(-50%) scale(1.12)}}
#gd-retry{position:fixed;right:12px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:5;width:52px;height:52px;border-radius:50%;border:0;background:rgba(255,255,255,.92);box-shadow:0 5px 0 rgba(0,40,80,.18);display:grid;place-items:center;cursor:pointer}
#gd-retry svg{width:26px;height:26px;stroke:#33415c;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
#gd-retry:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,40,80,.18)}
`);

// ---------------------------------------------------------------- DOM
const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none'; document.body.prepend(cv);
let g = cv.getContext('2d');
const tapsEl = document.createElement('div'); tapsEl.id = 'gd-taps'; document.body.appendChild(tapsEl);
const retry = document.createElement('button'); retry.id = 'gd-retry'; retry.setAttribute('aria-label', 'Restart level');
retry.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v5h5"/></svg>'; document.body.appendChild(retry);

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = S.get('score', 0);
let L, W, awakeT = 0, taps = 0, tapsMax = 0, awake = true, calmT = 0, endT = 0, recorded = false, beatenShown = false, trolls0 = 0, drowned = 0, shake = 0, t = 0;
let ghosts = [], ripples = [], chips = [], drops = [], pipSad = 0, winT = -1;
const isDaily = D.isDaily;

function newLevel(fresh = true) {
  const fk = isDaily ? 1 : F.k();
  const seed = D.seed ? D.seed : level * 6151 + 11, lv = isDaily ? 6 : level;
  if (fresh || !L) L = makeLevel(seed, lv, fk) || { ...makeLevel(17, 1, 1) };
  W = build(L); sky = SKY[((D.seed || level) - 1) % SKY.length];
  for (const b of W.bodies) { b.blink = Math.random() * 4; b.squash = 0; }
  taps = tapsMax = L.taps; awake = true; calmT = 0; awakeT = 0; endT = 0; recorded = false; beatenShown = false; drowned = 0; pipSad = 0; winT = -1;
  trolls0 = L.chars.filter(c => c.kind === 'troll').length; ghosts = []; ripples = []; chips = []; drops = [];
  ui.levels(isDaily ? 1 : level); ui.progress(0);
  if (isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  ui.sub(isDaily ? 'Daily challenge' : `${trolls0} troll${trolls0 > 1 ? 's' : ''} to drop`);
  hud(); layout();
}
function hud() {
  tapsEl.innerHTML = `<span>Taps</span><span class="dots">${Array.from({ length: tapsMax }, (_, i) => `<i class="${i < taps ? '' : 'off'}"></i>`).join('')}</span>`;
}

// ---------------------------------------------------------------- view
let Wd = 0, Ht = 0, dpr = 1, SC = 40, CX = 0, Y0 = 0;
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); Wd = innerWidth; Ht = innerHeight;
  cv.width = Wd * dpr; cv.height = Ht * dpr;
  let half = 3.2, top = 2;
  if (L) { for (const b of L.blocks) { half = Math.max(half, Math.abs(b.x) + b.w / 2 * (b.rot ? 0.95 : 1)); top = Math.max(top, b.y + b.h / 2); } for (const c of L.chars) { half = Math.max(half, Math.abs(c.x) + c.r); top = Math.max(top, c.y + c.r); } }
  half += 0.3;
  SC = Math.min(Wd / (2 * half), Ht * 0.5 / (top + 1.9), 100); CX = Wd / 2; Y0 = Math.min(Ht * 0.64, Ht - 2.4 * SC - 76);
  Y0 = Math.max(Y0, Ht * 0.5);
}
addEventListener('resize', layout);
const sx = (x) => CX + x * SC, sy = (y) => Y0 - y * SC;
const toWorld = (px, py) => [(px - CX) / SC, (Y0 - py) / SC];

// ---------------------------------------------------------------- drawing helpers
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const SKY = [['#8fd3ff', '#cdeeff', '#fff3d6'], ['#a5c8ff', '#dfe6ff', '#ffe3ec'], ['#86e0d6', '#d2f6ee', '#fff6dc'], ['#ffc29e', '#ffe0c2', '#fff4e0'], ['#b9a8ff', '#e2d9ff', '#ffe6f2']];
let sky = SKY[0];
const clouds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: 0.06 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006 }));
function drawBackdrop() {
  const gr = g.createLinearGradient(0, 0, 0, sy(WATER)); sky.forEach((c, i) => gr.addColorStop(i / (sky.length - 1), c));
  g.fillStyle = gr; g.fillRect(0, 0, Wd, Ht);
  // sun
  const sxp = Wd * 0.78, syp = Ht * 0.16, R = Math.min(Wd, Ht) * 0.07;
  const gl = g.createRadialGradient(sxp, syp, R * 0.5, sxp, syp, R * 4); gl.addColorStop(0, 'rgba(255,250,220,.9)'); gl.addColorStop(1, 'rgba(255,250,220,0)');
  g.fillStyle = gl; g.fillRect(0, 0, Wd, Ht); g.fillStyle = '#fff6cf'; g.beginPath(); g.arc(sxp, syp, R, 0, 7); g.fill();
  // clouds
  for (const c of clouds) {
    c.x = (c.x + c.v / 60) % 1.3; const x = (c.x - 0.15) * Wd, y = c.y * Ht, s = c.s * Math.min(Wd, 500) * 0.12;
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (const [dx, dy, r] of [[0, 0, 0.55], [0.5, -0.25, 0.6], [1.0, 0, 0.5], [0.45, 0.12, 0.6]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill(); }
  }
  // far hills with a windmill and pines, near hills
  const hy = sy(WATER);
  const hill = (amp, base, f, ph, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, hy); for (let x = 0; x <= Wd + 8; x += 8) g.lineTo(x, hy - base - amp * Math.max(0, Math.sin(x / Wd * f + ph)) - 6 * Math.sin(x / 41)); g.lineTo(Wd, hy); g.fill(); };
  hill(Ht * 0.16, 10, 3.2, 0.6, 'rgba(150,190,215,.55)');
  // windmill on the far hill
  const wx = Wd * 0.2, wy = hy - 10 - Ht * 0.16 * Math.max(0, Math.sin(0.2 * 3.2 + 0.6)) + 4, ws = Math.min(Wd, Ht) * 0.05;
  g.fillStyle = 'rgba(120,160,190,.8)'; g.beginPath(); g.moveTo(wx - ws * 0.35, wy); g.lineTo(wx - ws * 0.2, wy - ws * 1.6); g.lineTo(wx + ws * 0.2, wy - ws * 1.6); g.lineTo(wx + ws * 0.35, wy); g.fill();
  g.save(); g.translate(wx, wy - ws * 1.6); g.rotate(t * 0.6); g.fillStyle = 'rgba(235,245,255,.85)';
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillRect(-ws * 0.08, 0, ws * 0.16, ws * 1.1); } g.restore();
  hill(Ht * 0.09, 4, 5.5, 2.4, 'rgba(110,175,180,.6)');
  g.fillStyle = 'rgba(70,140,140,.55)';
  for (let i = 0; i < 9; i++) { const px = ((i * 0.137 + 0.05) % 1) * Wd, ph = 10 + (i % 3) * 6, py = hy - 4 - Ht * 0.09 * Math.max(0, Math.sin(px / Wd * 5.5 + 2.4)) + 3; g.beginPath(); g.moveTo(px, py - ph * 2); g.lineTo(px + ph * 0.55, py); g.lineTo(px - ph * 0.55, py); g.fill(); }
  // birds
  g.strokeStyle = 'rgba(60,80,110,.55)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const bx = ((t * 18 + i * 140) % (Wd + 60)) - 30, by = Ht * (0.24 + i * 0.05) + Math.sin(t * 2 + i) * 6, fl = Math.sin(t * 9 + i * 2) * 4;
    g.beginPath(); g.moveTo(bx - 8, by - fl); g.quadraticCurveTo(bx - 3, by - 5, bx, by); g.quadraticCurveTo(bx + 3, by - 5, bx + 8, by - fl); g.stroke(); }
}
function drawSea(front) {
  const y0 = sy(WATER);
  if (!front) { const gr = g.createLinearGradient(0, y0, 0, Ht); gr.addColorStop(0, '#46c2e0'); gr.addColorStop(1, '#1f6fb0'); g.fillStyle = gr; g.fillRect(0, y0, Wd, Ht - y0); return; }
  // translucent front water over the island feet + waves
  const gr = g.createLinearGradient(0, y0, 0, Ht); gr.addColorStop(0, 'rgba(70,194,224,.82)'); gr.addColorStop(1, 'rgba(25,100,170,.95)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, Ht);
  for (let x = 0; x <= Wd + 6; x += 6) g.lineTo(x, y0 + Math.sin(x / 26 + t * 2) * 3 + Math.sin(x / 61 - t * 1.3) * 2);
  g.lineTo(Wd, Ht); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath();
  for (let x = 0; x <= Wd + 6; x += 6) g.lineTo(x, y0 + Math.sin(x / 26 + t * 2) * 3 + Math.sin(x / 61 - t * 1.3) * 2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 14; i++) { const x = ((i * 97 + t * 14) % (Wd + 40)) - 20, y = y0 + 18 + (i * 53) % Math.max(30, Ht - y0 - 30); g.fillRect(x, y, 16 + (i % 3) * 8, 2.5); }
}
function drawIsland(b) {
  const x0 = sx(b.x - b.hw), x1 = sx(b.x + b.hw), top = sy(b.y + b.hh), bot = sy(WATER) + 46, w = x1 - x0;
  let k = Math.abs(Math.floor(b.x * 100)) + 7; const rnd = () => ((k = (k * 16807) % 2147483647) % 1000) / 1000;
  // rock pillar
  const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#b77d4d'); gr.addColorStop(0.5, '#d29a63'); gr.addColorStop(1, '#a06a40');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0, top + 6); g.lineTo(x1, top + 6); g.lineTo(x1 - 6, bot); g.quadraticCurveTo((x0 + x1) / 2, bot + 18, x0 + 6, bot); g.closePath(); g.fill();
  g.fillStyle = 'rgba(90,50,25,.22)';
  for (let i = 0; i < Math.max(3, w / 18); i++) { const rx = x0 + 8 + rnd() * (w - 16), ry = top + 22 + rnd() * (bot - top - 30); g.beginPath(); g.ellipse(rx, ry, 5 + rnd() * 9, 3 + rnd() * 5, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,235,200,.18)'; g.fillRect(x0 + 5, top + 12, 6, bot - top - 26);
  // bushes behind the play surface
  for (let i = 0; i < Math.max(1, Math.floor(w / 70)); i++) {
    const bx = x0 + 14 + rnd() * (w - 28), bs = 9 + rnd() * 8;
    g.fillStyle = '#3fa857'; for (const [dx, dy, rr2] of [[-0.8, 0.1, 0.8], [0, -0.35, 1], [0.8, 0.1, 0.8]]) { g.beginPath(); g.arc(bx + dx * bs, top - 2 + dy * bs, rr2 * bs, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(bx - bs * 0.3, top - 2 - bs * 0.6, bs * 0.3, 0, 7); g.fill();
    if (rnd() < 0.6) { g.fillStyle = ['#ff7aa8', '#ffd23f', '#ffffff'][Math.floor(rnd() * 3)]; for (let f = 0; f < 3; f++) { g.beginPath(); g.arc(bx + (rnd() - 0.5) * bs * 1.6, top - 4 - rnd() * bs * 0.9, 2.2, 0, 7); g.fill(); } }
  }
  // grass cap with a scalloped lip
  g.fillStyle = '#4fb85f'; rr(x0 - 5, top - 2, w + 10, 15, 8); g.fill();
  for (let x = x0 - 2; x < x1 - 2; x += 13) { g.beginPath(); g.arc(x + 6.5, top + 12, 6.5, 0, Math.PI); g.fill(); }
  g.fillStyle = '#7fe07f'; rr(x0 - 3, top - 3, w + 6, 7, 4); g.fill();
}
const MATC = {
  wood: { a: '#f6b26b', b: '#d9823f', line: 'rgba(120,60,20,.35)', edge: '#9a5a2a' },
  glass: { a: 'rgba(200,245,255,.85)', b: 'rgba(120,205,240,.75)', line: 'rgba(255,255,255,.9)', edge: '#5fb4d8' },
  stone: { a: '#b9bfcc', b: '#8a92a5', line: 'rgba(60,65,80,.3)', edge: '#5d6474' },
};
function drawBlock(b, alpha = 1, scale = 1) {
  const w = b.hw * 2 * SC * scale, h = b.hh * 2 * SC * scale, c = MATC[b.m];
  g.save(); g.globalAlpha = alpha; g.translate(sx(b.x), sy(b.y)); g.rotate(-b.rot);
  const r = Math.min(w, h) * 0.18;
  g.fillStyle = 'rgba(30,30,60,.18)'; rr(-w / 2 + 2, -h / 2 + 4, w, h, r); g.fill();
  const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, c.a); gr.addColorStop(1, c.b);
  g.fillStyle = gr; rr(-w / 2, -h / 2, w, h, r); g.fill();
  g.lineWidth = 2; g.strokeStyle = c.edge; g.stroke();
  g.save(); rr(-w / 2, -h / 2, w, h, r); g.clip();
  if (b.m === 'wood') {
    g.strokeStyle = c.line; g.lineWidth = 1.6; const horiz = w >= h;
    for (let k = 1; k < 4; k++) { g.beginPath(); if (horiz) { const y = -h / 2 + k * h / 4; g.moveTo(-w / 2, y); g.bezierCurveTo(-w / 6, y - 2, w / 6, y + 2, w / 2, y); } else { const x = -w / 2 + k * w / 4; g.moveTo(x, -h / 2); g.bezierCurveTo(x - 2, -h / 6, x + 2, h / 6, x, h / 2); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(-w / 2, -h / 2, w, Math.min(5, h * 0.2));
    g.fillStyle = '#8a5a35'; for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { if (w < 18 || h < 18) break; g.beginPath(); g.arc(px * (w / 2 - 5), py * (h / 2 - 5), 1.8, 0, 7); g.fill(); }
  } else if (b.m === 'glass') {
    g.strokeStyle = c.line; g.lineWidth = 3; g.globalAlpha = alpha * 0.8;
    g.beginPath(); g.moveTo(-w / 2 + w * 0.15, h / 2); g.lineTo(-w / 2 + w * 0.15 + h * 0.6, -h / 2); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(-w / 2 + w * 0.32, h / 2); g.lineTo(-w / 2 + w * 0.32 + h * 0.6, -h / 2); g.stroke();
  } else {
    g.fillStyle = 'rgba(60,65,80,.18)';
    for (let k = 0; k < 5; k++) { const px = ((b.bi * 37 + k * 53) % 100) / 100 - 0.5, py = ((b.bi * 71 + k * 29) % 100) / 100 - 0.5; g.beginPath(); g.arc(px * w * 0.8, py * h * 0.8, 2 + (k % 3), 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-w / 2, -h / 2, w, Math.min(4, h * 0.2));
  }
  g.restore(); g.restore();
}
function drawTroll(b) {
  const R = b.r * SC, sp = Math.hypot(b.vx, b.vy), panic = sp > 2.2 || b.y < 0;
  const sq = 1 + Math.sin(t * 3 + b.id) * 0.03 + b.squash;
  g.save(); g.translate(sx(b.x), sy(b.y)); g.rotate(-b.rot); g.scale(1 / sq, sq);
  // shadow ring + body
  g.fillStyle = '#4c9a3c'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  const gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R); gr.addColorStop(0, '#9be36c'); gr.addColorStop(1, '#5fae47');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.94, 0, 7); g.fill();
  // ears
  g.fillStyle = '#5fae47';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.98, -R * 0.1, R * 0.26, R * 0.16, s * 0.5, 0, 7); g.fill(); }
  // hair tuft
  g.fillStyle = '#7a4b2a'; g.beginPath(); g.moveTo(-R * 0.3, -R * 0.82); g.quadraticCurveTo(-R * 0.1, -R * 1.45, R * 0.05, -R * 0.9); g.quadraticCurveTo(R * 0.2, -R * 1.35, R * 0.35, -R * 0.8); g.fill();
  // eyes look toward Pip
  const pip = W.bodies.find(o => o.kind === 'pip');
  let lx = 0, ly = 0; if (pip) { const dx = pip.x - b.x, dy = -(pip.y - b.y), d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
  const blink = (t + b.blink) % 4 < 0.12;
  for (const s of [-1, 1]) {
    const ex = s * R * 0.33, ey = -R * 0.12;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, R * 0.22, blink ? R * 0.03 : (panic ? R * 0.28 : R * 0.22), 0, 0, 7); g.fill();
    if (!blink) { g.fillStyle = '#2a2a35'; g.beginPath(); g.arc(ex + lx * R * 0.08, ey + ly * R * 0.08, R * (panic ? 0.07 : 0.1), 0, 7); g.fill(); }
    // grumpy brow
    g.strokeStyle = '#3a5a22'; g.lineWidth = Math.max(2, R * 0.12); g.lineCap = 'round';
    g.beginPath(); if (panic) { g.moveTo(ex - s * R * 0.2, ey - R * 0.42); g.lineTo(ex + s * R * 0.18, ey - R * 0.36); } else { g.moveTo(ex - s * R * 0.25, ey - R * 0.4); g.lineTo(ex + s * R * 0.18, ey - R * 0.22); } g.stroke();
  }
  // mouth: underbite with fangs, or a scream
  g.fillStyle = '#3b2030';
  if (panic) { g.beginPath(); g.ellipse(0, R * 0.42, R * 0.2, R * 0.24, 0, 0, 7); g.fill(); }
  else {
    g.beginPath(); g.moveTo(-R * 0.34, R * 0.38); g.quadraticCurveTo(0, R * 0.22, R * 0.34, R * 0.38); g.quadraticCurveTo(0, R * 0.58, -R * 0.34, R * 0.38); g.fill();
    g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * R * 0.22, R * 0.4); g.lineTo(s * R * 0.12, R * 0.4); g.lineTo(s * R * 0.17, R * 0.2); g.fill(); }
  }
  g.restore();
}
function drawPip(b) {
  const R = b.r * SC, scared = Math.hypot(b.vx, b.vy) > 1.6 || pipSad > 0;
  const hop = winT >= 0 ? Math.abs(Math.sin((t - winT) * 7)) * R * 0.5 : 0;
  const sq = 1 + Math.sin(t * 2.4) * 0.035 + b.squash;
  g.save(); g.translate(sx(b.x), sy(b.y) - hop); g.rotate(-b.rot * 0.6); g.scale(1 / sq, sq);
  // sprout
  g.strokeStyle = '#3f9a4a'; g.lineWidth = Math.max(2, R * 0.12); g.beginPath(); g.moveTo(0, -R * 0.9); g.quadraticCurveTo(R * 0.05, -R * 1.2, 0, -R * 1.3); g.stroke();
  g.fillStyle = '#5ccb64';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.25, -R * 1.32, R * 0.28, R * 0.14, -s * 0.5 + Math.sin(t * 3) * 0.1, 0, 7); g.fill(); }
  const gr = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(1, '#ffc43d');
  g.fillStyle = '#e8a52a'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.93, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,120,120,.45)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.52, R * 0.2, R * 0.17, R * 0.11, 0, 0, 7); g.fill(); }
  g.fillStyle = '#2d2433';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.3, -R * 0.08, R * 0.1, scared ? R * 0.17 : R * 0.14, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * R * 0.3 + R * 0.03, -R * 0.14, R * 0.04, 0, 7); g.fill(); g.fillStyle = '#2d2433'; }
  g.strokeStyle = '#2d2433'; g.lineWidth = Math.max(1.6, R * 0.09); g.lineCap = 'round'; g.beginPath();
  if (scared) { g.arc(0, R * 0.42, R * 0.13, Math.PI * 1.1, Math.PI * 1.9); } else { g.arc(0, R * 0.18, R * 0.2, 0.2 * Math.PI, 0.8 * Math.PI); }
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- frame
function frame() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shx = shake ? (Math.random() - 0.5) * shake : 0, shy = shake ? (Math.random() - 0.5) * shake : 0; shake *= 0.86; if (shake < 0.3) shake = 0;
  drawBackdrop(); drawSea(false);
  g.save(); g.translate(shx, shy);
  for (const b of W.bodies) if (b.kind === 'island') drawIsland(b);
  for (const gh of ghosts) drawBlock(gh.b, gh.a, gh.s);
  for (const b of W.bodies) if (b.kind === 'block') drawBlock(b);
  for (const b of W.bodies) if (b.kind === 'troll') drawTroll(b); else if (b.kind === 'pip') drawPip(b);
  // chips (removed-block splinters) in world space
  for (const c of chips) { g.save(); g.translate(sx(c.x), sy(c.y)); g.rotate(c.r); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.fillRect(-c.s, -c.s * 0.4, c.s * 2, c.s * 0.8); g.restore(); }
  g.globalAlpha = 1;
  drawSea(true);
  for (const p of ripples) { g.strokeStyle = `rgba(255,255,255,${p.life})`; g.lineWidth = 3; g.beginPath(); g.ellipse(sx(p.x), sy(WATER) + 4, (1.2 - p.life) * 70 + 10, (1.2 - p.life) * 14 + 3, 0, 0, 7); g.stroke(); }
  for (const d of drops) { g.fillStyle = `rgba(220,248,255,${Math.min(1, d.life * 1.5)})`; g.beginPath(); g.arc(sx(d.x), sy(d.y), d.s, 0, 7); g.fill(); }
  g.restore();
}

// ---------------------------------------------------------------- simulation + rules
function splash(b) {
  shake = Math.max(shake, b.kind === 'block' ? 4 : 9);
  ripples.push({ x: b.x, life: 1 });
  for (let i = 0; i < (b.kind === 'block' ? 8 : 18); i++) drops.push({ x: b.x + (Math.random() - 0.5) * 0.4, y: WATER, vx: (Math.random() - 0.5) * 3.5, vy: 3 + Math.random() * 4, s: 2 + Math.random() * 4, life: 1 });
  tone(260, 0.25, 'sine', 0.12, 0.4); setTimeout(() => tone(700, 0.12, 'sine', 0.05, 1.6), 40);
  if (b.kind === 'troll') {
    drowned++; buzz([15, 30, 15]); score += 50; S.set('score', score);
    ui.progress(drowned / trolls0);
    const left = trolls0 - drowned;
    ui.pop(drowned > 1 && left === 0 ? 'SPLASH × ' + drowned + '!' : 'SPLASH!', '#fff', 40, 30);
    note(72 + drowned * 3, 0.3, 0.12);
    ui.sub(left ? `${left} troll${left > 1 ? 's' : ''} left` : 'All trolls in the sea!');
    if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 24); fx.confetti(60); }, 500); }
  } else if (b.kind === 'pip') {
    pipSad = 1; buzz([60, 40, 80]);
  }
}
function simulate(dtS) {
  if (!awake) return;
  const n = Math.max(1, Math.round(dtS / DT));
  for (let i = 0; i < Math.min(n, 4); i++) {
    W.step(DT);
    for (const b of [...W.bodies]) if (!b.fixed && b.y < WATER - 0.35) { W.remove(b); splash(b); }
  }
  for (const b of W.bodies) b.squash *= 0.85;
  awakeT += dtS;
  if (W.energy() < 0.05) { calmT += dtS; if (calmT > 0.6) awake = false; } else calmT = 0;
  if (awakeT > 7) awake = false;              // slow creepers freeze: the world never drifts on its own
}
function check(dtS) {
  if (state !== 'play') return;
  if (demoing) { if (DM.touched || performance.now() - demoT0 > 4000) demoRewind(); return; }   // the demo topple never wins or loses; a touch rewinds it at once
  const pip = W.bodies.some(b => b.kind === 'pip'), left = W.bodies.filter(b => b.kind === 'troll').length;
  if (!pip) { endT += dtS; if (endT > 0.5) lose('Oh no, Pip!', 'Pip took a swim. Keep the sprout dry!'); return; }
  if (!left) { endT += dtS; if (endT > 0.45) win(); return; }
  if (!taps && !awake) lose('Out of taps', `${left} troll${left > 1 ? 's' : ''} still grumbling`);
}
function win() {
  if (state !== 'play') return; state = 'won'; winT = t;
  const bonus = 100 + taps * 25; score += bonus; S.set('score', score);
  if (!recorded) { recorded = true; B.submit(1); if (!isDaily) F.level(true); }
  arp([67, 72, 76, 79, 84], 90, 0.13, 0.8); fx.confetti(120); buzz([20, 40, 20]);
  if (isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, 0); if (score > prev) S.set(k, score); }
  else { level++; S.set('level', level); }
  D.won(score, 'scored');
  ui.win(isDaily ? 'Daily' : level - 1, `+${bonus} · ${taps ? taps + ' spare tap' + (taps > 1 ? 's' : '') : 'no taps to spare'}`);
}
function lose(title, line) {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; if (!isDaily) F.level(false, drowned / Math.max(1, trolls0)); }
  tone(330, 0.2, 'triangle', 0.12, 0.7); setTimeout(() => tone(220, 0.35, 'triangle', 0.12, 0.6), 160);
  ui.lose(title, line);
}

// ---------------------------------------------------------------- input
function tapAt(wx, wy) {
  if (state !== 'play' || !taps) return false;
  let best = null, bd = 1e9;
  for (const b of W.bodies) if (b.tap && W.hit(b, wx, wy, 0.14)) { const d = Math.hypot(b.x - wx, b.y - wy) + (W.hit(b, wx, wy, 0) ? 0 : 1); if (d < bd) { bd = d; best = b; } }
  if (!best) {
    // tapped stone? give a dull knock so it reads as "can't"
    const st = W.bodies.find(b => b.kind === 'block' && !b.tap && W.hit(b, wx, wy, 0.05));
    if (st) { tone(140, 0.08, 'square', 0.06, 0.8); st.squash = 0.08; ui.pop('Stone!', '#e8edf5', 24, 40); }
    return false;
  }
  removeBlock(best); return true;
}
function removeBlock(b) {
  W.remove(b); taps--; awake = true; calmT = 0; awakeT = 0; hud();
  if (taps === 1 && tapsMax > 1) { tapsEl.classList.remove('low'); void tapsEl.offsetWidth; tapsEl.classList.add('low'); }
  ghosts.push({ b, a: 1, s: 1 });
  const col = b.m === 'glass' ? ['#e6fbff', '#9fe0f5', '#ffffff'] : ['#f6b26b', '#d9823f', '#ffe1b8'];
  for (let i = 0; i < 14; i++) chips.push({ x: b.x + (Math.random() - 0.5) * b.hw * 2, y: b.y + (Math.random() - 0.5) * b.hh * 2, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: 3 + Math.random() * 4, col: col[i % 3], life: 1 });
  fx.sparks(sx(b.x), sy(b.y), ['#fff', '#ffe08a'], 8, { speed: 3.5, size: 3 });
  if (b.m === 'glass') { tone(1800, 0.09, 'triangle', 0.08, 0.6); setTimeout(() => tone(2400, 0.08, 'sine', 0.05, 0.7), 30); }
  else { tone(420, 0.07, 'square', 0.08, 0.5); tone(200, 0.12, 'triangle', 0.1, 0.6); }
  buzz(12); shake = Math.max(shake, 3);
  for (const o of W.bodies) if (!o.fixed && Math.hypot(o.x - b.x, o.y - b.y) < 1.2) o.squash = 0.06;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the right block pops (tap given back) and the tower topples for a moment, then the level rewinds, like the retry button
let demoing = false, demoScore = 0, demoT0 = 0;
function demoRewind() { demoing = false; newLevel(false); score = demoScore; S.set('score', score); hud(); }
const DM = demo((n) => {
  if (n === 1) {
    const b = L.sol.map(bi => W.bodies.find(o => o.bi === bi)).find(Boolean); if (!b) return false;
    demoing = true; demoScore = score; demoT0 = performance.now(); removeBlock(b); taps++; hud(); return;
  }
  if (demoing) demoRewind(); return false;
}, { ready: () => state === 'play' && level === 1 && !isDaily && (demoing || (!awake && taps === tapsMax)), wait: 1500, every: 2000, max: 2 });
cv.addEventListener('pointerdown', (e) => { const [wx, wy] = toWorld(e.clientX, e.clientY); tapAt(wx, wy); });
retry.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (state !== 'play') return; newLevel(false); tone(600, 0.06, 'sine', 0.08, 0.7); });

ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  newLevel(which === 'win'); state = 'play';
});

// start card: a tiny legend (tap wood + glass, stone stays, keep Pip dry)
{
  const row = document.createElement('div'); row.className = 'gd-rules';
  row.innerHTML = '<div><canvas width="64" height="44"></canvas>Tap wood &amp; glass</div><div><canvas width="64" height="44"></canvas>Drop the trolls</div><div><canvas width="64" height="44"></canvas>Keep Pip dry</div>';
  ui.els.start.querySelector('.hint').before(row);
  const cs = row.querySelectorAll('canvas');
  setTimeout(() => cs.forEach((c, i) => {
    const gg = c.getContext('2d'), keep = [g, SC, CX, Y0]; g = gg; SC = 40; CX = 32; Y0 = 40;
    if (i === 0) { drawBlock({ x: -0.38, y: 0.33, rot: 0, hw: 0.28, hh: 0.28, m: 'wood', bi: 1 }); drawBlock({ x: 0.36, y: 0.33, rot: 0, hw: 0.28, hh: 0.28, m: 'glass', bi: 2 }); }
    else if (i === 1) { W && drawTroll({ x: 0, y: 0.5, rot: 0, r: 0.42, vx: 0, vy: 0, id: 1, blink: 1, squash: 0 }); }
    else drawPip({ x: 0, y: 0.45, rot: 0, r: 0.38, vx: 0, vy: 0, squash: 0 });
    [g, SC, CX, Y0] = keep;
  }), 50);
}
const k = isDaily ? 'daily_' + todayKey() : null;
if (k && S.get(k, 0)) { const p = document.createElement('p'); p.textContent = 'Solved today ✓'; ui.els.start.querySelector('h1').after(p); }

newLevel(true);
let last = performance.now();
function tick(now) {
  const dtS = Math.min(0.05, (now - last) / 1000); last = now; t += dtS;
  if (state === 'play' || state === 'won' || state === 'lost') { simulate(dtS); check(dtS); }
  for (const gh of ghosts) { gh.a -= dtS * 4; gh.s += dtS * 1.2; } ghosts = ghosts.filter(gh => gh.a > 0);
  for (const c of chips) { c.vy -= 15 * dtS; c.x += c.vx * dtS; c.y += c.vy * dtS; c.r += c.vr; c.life -= dtS * 1.3; } chips = chips.filter(c => c.life > 0);
  for (const d of drops) { d.vy -= 15 * dtS; d.x += d.vx * dtS; d.y += d.vy * dtS; d.life -= dtS * 1.2; if (d.y < WATER - 0.2) d.life = 0; } drops = drops.filter(d => d.life > 0);
  for (const p of ripples) p.life -= dtS * 0.9; ripples = ripples.filter(p => p.life > 0);
  if (pipSad) pipSad = Math.max(0, pipSad - dtS * 0.3);
  frame();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---------------------------------------------------------------- test hook: the bot taps the next block of the verified plan once the world is still
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || awake) return;
    const next = L.sol.map(bi => W.bodies.find(b => b.bi === bi)).find(Boolean);
    const b = next || W.bodies.find(o => o.tap);
    if (b) tapAt(b.x, b.y);
  },
};

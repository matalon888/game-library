// Skyfloat — an original, friendly take on the classic letter-guessing word game. Guess the hidden word one letter
// at a time; every wrong letter pops one balloon of Pip's basket. Guess it before the last balloon goes and Pip
// floats away happy; run out and Pip bumps down softly onto the hay. Categories, endless words and a daily word.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { CATS } from './cats.js';

const NAME = 'Skyfloat: Hangman Word Guess';
const S = store('skyfloat');
const F = flow('skyfloat');
const ui = createUI({ title: 'Skyfloat', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#ef6f6c' });
const D = daily('skyfloat', ui, { name: NAME });
const B = board({ game: 'skyfloat', label: 'Words solved', limits: { maxRun: 1, maxPerSec: 0.5 }, mode: 'sum' });   // world board: words solved today (RULES.md part C)
const fx = fx2d(11);
const CHIPS = ['Mixed', 'Animals', 'Food', 'Nature', 'Sports', 'Space', 'Ocean'];
let catPick = Math.min(CHIPS.length - 1, S.get('cat', 0));
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily word' : 'word guess · save the balloons',
  doneLine: doneToday ? (doneToday.w ? `Solved today · ${doneToday.left} balloons left` : 'Played today') : null,
  chips: D.isDaily ? null : { items: CHIPS, get: () => catPick, set: (i) => { catPick = i; S.set('cat', i); build(); } },
});
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily word<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'WORD <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Up, up!';
ui.els.lose.querySelector('.hint').textContent = 'Tap for a new word';

const rngf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const SKIES = [
  { sky: ['#8fcdf4', '#c4e6fa', '#eef8ff'], sun: '#fff6cf', hill: ['#a5dba0', '#7fc58a', '#5fae73'], acc: '#ef6f6c' },
  { sky: ['#f7b9a4', '#fbd9bd', '#fff1df'], sun: '#fff8e6', hill: ['#c9d98f', '#a3c46f', '#7fa957'], acc: '#e0644c' },
  { sky: ['#b9b3f2', '#d9d0fa', '#f6eefd'], sun: '#fff9ea', hill: ['#a9d7b6', '#84bf98', '#5f9f7b'], acc: '#7a5fd0' },
  { sky: ['#7fd6cf', '#bdebe2', '#effbf6'], sun: '#fffbe0', hill: ['#b9dc8f', '#92c66c', '#6aa64e'], acc: '#2f9a8a' },
];
const BCOL = ['#ff6b7a', '#ffb547', '#59c3f0', '#8f7cf2', '#53c98b', '#ff8fc7', '#ffd84d', '#ff8a5c'];

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#2b2a33}
body{background:#c4e6fa}
#sky{position:fixed;inset:0;width:100%;height:100%;z-index:0}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:var(--acc);box-shadow:0 2px 6px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:#fff;color:var(--acc)}.hc-top .hc-bar{background:rgba(255,255,255,.6);height:8px}.hc-top .hc-bar i{background:var(--acc)}
.hc-sub{top:calc(50px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#fff;text-shadow:0 1px 6px rgba(30,60,90,.35);opacity:1}
#pts{position:fixed;z-index:6;right:12px;top:calc(48px + env(safe-area-inset-top));height:30px;display:flex;align-items:center;border-radius:16px;font-weight:800;font-size:14px;padding:0 12px;background:rgba(255,255,255,.92);color:var(--acc);box-shadow:0 2px 8px rgba(30,60,90,.15);pointer-events:none;font-variant-numeric:tabular-nums}
#cat{position:fixed;z-index:5;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.92);border-radius:18px;padding:6px 14px;font-weight:800;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#4a4a5a;box-shadow:0 4px 14px rgba(30,60,90,.14);white-space:nowrap;pointer-events:none}
#cat b{color:var(--acc)}
#slots{position:fixed;left:0;right:0;z-index:3;display:flex;justify-content:center;gap:var(--sg);pointer-events:none}
#slots .s{width:var(--sw);height:var(--sh);border-radius:10px;background:rgba(255,255,255,.95);box-shadow:inset 0 -4px 0 #d9d2c4,0 4px 12px rgba(30,60,90,.12);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:calc(var(--sw) * .62);text-transform:uppercase;color:#2b2a33;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
#slots .s.on{animation:pop .4s cubic-bezier(.3,1.6,.5,1)}
#slots .s.miss{color:#d0584f;background:#fff1ee}
#slots .s.gap{background:transparent;box-shadow:none}
#slots.win .s{animation:jump .55s cubic-bezier(.3,1.6,.5,1) both;background:#e9f8ee;box-shadow:inset 0 -4px 0 #a9dcb9,0 4px 12px rgba(30,60,90,.12)}
@keyframes pop{0%{transform:scale(.4) rotate(-10deg)}100%{transform:scale(1)}}
@keyframes jump{0%{transform:translateY(0)}40%{transform:translateY(-18px)}70%{transform:translateY(3px)}100%{transform:translateY(0)}}
#panel{position:fixed;left:0;right:0;bottom:0;z-index:2;background:linear-gradient(180deg,rgba(255,252,244,.96),#fbf6ea);border-radius:26px 26px 0 0;box-shadow:0 -8px 30px rgba(40,70,50,.18)}
#kb{position:fixed;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 6px}
#kb .kr{display:flex;gap:5px;width:100%;max-width:520px;justify-content:center}
#kb button{flex:1;max-width:48px;height:var(--kh);border:0;border-radius:10px;background:#fff;color:#2b2a33;font-weight:800;font-size:19px;text-transform:uppercase;box-shadow:0 3px 0 #d8cfbd,0 4px 10px rgba(80,60,30,.08);cursor:pointer;transition:background .25s,color .25s,transform .08s,opacity .25s;padding:0;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
#kb button:active{transform:translateY(2px);box-shadow:0 1px 0 #d8cfbd}
#kb button.hit{background:#4caf7a;color:#fff;box-shadow:0 3px 0 #368a5c}
#kb button.miss{background:#e7e2d8;color:#b3ab9c;box-shadow:none;text-decoration:line-through;text-decoration-thickness:2px}
#toast{position:fixed;left:50%;z-index:9;transform:translateX(-50%);background:#2b2a33;color:#fff;font-weight:700;font-size:15px;padding:9px 16px;border-radius:12px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap}
#toast.show{opacity:1}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(30,58,92,.72),rgba(22,40,66,.86))}
`);
const sky = document.createElement('canvas'); sky.id = 'sky'; document.body.prepend(sky);
const g = sky.getContext('2d');
const panel = document.createElement('div'); panel.id = 'panel'; document.body.appendChild(panel);
const slots = document.createElement('div'); slots.id = 'slots'; document.body.appendChild(slots);
const kb = document.createElement('div'); kb.id = 'kb'; document.body.appendChild(kb);
const catEl = document.createElement('div'); catEl.id = 'cat'; document.body.appendChild(catEl);
const ptsEl = document.createElement('div'); ptsEl.id = 'pts'; document.body.appendChild(ptsEl);
const toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast);
let toastT = 0;
function say(t, ms = 1400) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), ms); }

const keyEl = {};
for (const r of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']) {
  const d = document.createElement('div'); d.className = 'kr';
  for (const ch of r) {
    const b = document.createElement('button'); b.textContent = ch; keyEl[ch] = b;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); guess(ch); });
    d.appendChild(b);
  }
  kb.appendChild(d);
}
addEventListener('keydown', (e) => { if (e.metaKey || e.ctrlKey || e.altKey) return; if (/^[a-zA-Z]$/.test(e.key)) guess(e.key.toLowerCase()); });

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), points = S.get('points', 0), solved = S.get('solved', 0);
let word = '', cat = '', guessed = new Set(), total = 7, popped = 0, recorded = false, beatenShown = false, sk = SKIES[0];
let balloons = [], geo = {}, scene = { y: 0, vy: 0, mode: 'float', t0: 0, wave: 0, cheer: 0, bump: 0 }, slotEls = [];

function pickWord() {
  const names = Object.keys(CATS);
  if (D.isDaily) {
    const r = rngf(D.seed * 31 + 7); r(); const c = names[Math.floor(r() * names.length)], list = CATS[c];
    return [c, list[Math.floor(r() * list.length)]];
  }
  const recent = S.get('recent', []);
  const r = rngf(level * 7919 + catPick * 131 + 7); r();
  for (let t = 0; t < 40; t++) {
    const c = catPick ? CHIPS[catPick] : names[Math.floor(r() * names.length)], list = CATS[c];
    const w = list[Math.floor(r() * list.length)];
    if (!recent.includes(w) || t === 39) { recent.push(w); S.set('recent', recent.slice(-60)); return [c, w]; }
  }
}
function build() {
  [cat, word] = pickWord();
  // flow (honest difficulty): balloons = allowed misses. With the world board on, F.k() is 1 for everyone → 7 balloons.
  total = Math.max(6, Math.min(8, Math.round(7 / (D.isDaily ? 1 : F.k()))));
  guessed = new Set(); popped = 0; recorded = false; beatenShown = false;
  sk = SKIES[(D.isDaily ? D.seed : level - 1) % SKIES.length];
  document.body.style.setProperty('--acc', sk.acc); document.body.style.setProperty('--ui', sk.acc);
  const r = rngf((D.seed || level) * 977 + 5), order = BCOL.slice().sort(() => r() - 0.5);
  balloons = Array.from({ length: total }, (_, i) => ({ col: order[i % order.length], ph: r() * 7, alive: true, pop: 0 }));
  scene = { y: 0, vy: 0, mode: 'float', t0: performance.now(), wave: 0, cheer: 0, bump: 0 };
  slots.className = ''; slots.innerHTML = ''; slotEls = [];
  for (const ch of word) { const s = document.createElement('div'); s.className = 's' + (ch === ' ' ? ' gap' : ''); slots.appendChild(s); slotEls.push(s); }
  for (const k in keyEl) keyEl[k].className = '';
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const d = new Date();
  ui.sub(D.isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `Word #${level}`);
  catEl.innerHTML = `Category · <b>${cat}</b>`;
  hud(); layout();
}
function hud() { ptsEl.textContent = `★ ${points.toLocaleString()}`; }
function layout() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  sky.width = W * dpr; sky.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const kh = Math.max(46, Math.min(58, H * 0.066)); kb.style.setProperty('--kh', kh + 'px');
  const kbH = kh * 3 + 16, pad = Math.max(16, H * 0.025);
  kb.style.bottom = `calc(${pad}px + env(safe-area-inset-bottom))`;
  panel.style.height = `calc(${kbH + pad + 22}px + env(safe-area-inset-bottom))`;
  const n = word.length, sg = n > 9 ? 4 : 6, sw = Math.floor(Math.min(46, (Math.min(W, 520) - 28 - sg * (n - 1)) / n)), sh = Math.round(sw * 1.18);
  slots.style.setProperty('--sw', sw + 'px'); slots.style.setProperty('--sh', sh + 'px'); slots.style.setProperty('--sg', sg + 'px');
  const panelTop = H - (kbH + pad + 22);
  const slotsTop = panelTop - sh - 22; slots.style.top = slotsTop + 'px';
  const top = 96, groundY = slotsTop - 14, sceneH = groundY - top;
  catEl.style.top = top - 18 + 'px';
  const bw = Math.min(92, W * 0.23), bh = bw * 0.58;
  const high = top + sceneH * 0.7, low = groundY - bh - sceneH * 0.13;
  const tieGap = bw * 0.62, maxOff = 8.1 + 1.3;
  const r = Math.max(15, Math.min(W * 0.088, (high - tieGap - (top + 44)) / maxOff));
  geo = { W, H, top, groundY, sceneH, bw, bh, high, low, r, tieGap, slotsTop };
  toast.style.top = slotsTop - 46 + 'px';
}
addEventListener('resize', () => word && layout());

// balloon bunch offsets (in balloon radii, relative to the tie point; y up is negative)
const OFF = {
  6: [[-0.95, -6.3], [0.95, -6.3], [-2.6, -4.7], [2.6, -4.7], [-0.9, -4.1], [0.9, -4.1]],
  7: [[0, -6.3], [-1.85, -5.8], [1.85, -5.8], [-2.95, -4.2], [2.95, -4.2], [-1.0, -3.9], [1.0, -3.9]],
  8: [[0, -8.1], [0, -6.3], [-1.85, -5.8], [1.85, -5.8], [-2.95, -4.2], [2.95, -4.2], [-1.0, -3.9], [1.0, -3.9]],
};
const slotFor = (i, n) => OFF[n][i];

// ---------------------------------------------------------------- drawing
let clouds = []; { const r = rngf(99); clouds = Array.from({ length: 5 }, () => ({ x: r(), y: 0.08 + r() * 0.45, s: 0.6 + r() * 0.7, v: 0.004 + r() * 0.006 })); }
function drawSky(t) {
  const { W, H, groundY } = geo;
  const gr = g.createLinearGradient(0, 0, 0, groundY); sk.sky.forEach((c, i) => gr.addColorStop(i / (sk.sky.length - 1), c));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // sun + glow
  const sx = W * 0.8, sy = geo.top + 40, sr = 30;
  const gl = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4); gl.addColorStop(0, sk.sun + 'cc'); gl.addColorStop(1, sk.sun + '00'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  g.fillStyle = sk.sun; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  // drifting clouds
  for (const c of clouds) {
    const x = ((c.x + t * c.v * 0.05) % 1.3) * (W + 200) - 120, y = geo.top + c.y * geo.sceneH * 0.8, s = 40 * c.s;
    g.fillStyle = 'rgba(255,255,255,.82)';
    g.beginPath(); g.ellipse(x, y, s * 1.5, s * 0.42, 0, 0, 7); g.ellipse(x - s * 0.5, y - s * 0.28, s * 0.62, s * 0.5, 0, 0, 7); g.ellipse(x + s * 0.35, y - s * 0.36, s * 0.7, s * 0.58, 0, 0, 7); g.fill();
  }
  // rolling hills + hay
  const hy = groundY;
  sk.hill.forEach((col, i) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, hy - 46 + i * 22 - Math.sin(x / W * (2.4 + i) + i * 1.7) * (16 - i * 3));
    g.lineTo(W, H); g.closePath(); g.fill();
  });
  // little flowers
  const fr = rngf(7);
  for (let i = 0; i < 18; i++) { const x = fr() * W, y = hy - 10 + fr() * 30; g.fillStyle = ['#fff', '#ffd84d', '#ff9ec4'][i % 3]; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
  // hay pile (Pip's soft landing spot)
  const cx = W / 2, ww = geo.bw * 1.5;
  g.fillStyle = '#f0c75e'; g.beginPath(); g.ellipse(cx, hy + 6, ww * 0.62, geo.bh * 0.5, 0, Math.PI, 0); g.fill();
  g.strokeStyle = '#d9a83c'; g.lineWidth = 2; for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(cx + i * ww * 0.09, hy + 4); g.lineTo(cx + i * ww * 0.11 + 4, hy - geo.bh * 0.32 * (1 - Math.abs(i) / 7)); g.stroke(); }
}
function balloonPath(x, y, r) {
  g.beginPath(); g.moveTo(x, y + r * 1.18);
  g.bezierCurveTo(x - r * 0.55, y + r * 1.05, x - r * 1.02, y + r * 0.5, x - r, y - r * 0.12);
  g.bezierCurveTo(x - r * 0.98, y - r * 0.85, x - r * 0.5, y - r * 1.2, x, y - r * 1.2);
  g.bezierCurveTo(x + r * 0.5, y - r * 1.2, x + r * 0.98, y - r * 0.85, x + r, y - r * 0.12);
  g.bezierCurveTo(x + r * 1.02, y + r * 0.5, x + r * 0.55, y + r * 1.05, x, y + r * 1.18); g.closePath();
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
function draw(now) {
  if (!geo.W) return;
  const t = now / 1000, { W, r, bw, bh } = geo;
  drawSky(t);
  // basket altitude: sinks a little with every popped balloon; on a win it lifts off, on a loss it settles on the hay
  const left = total - popped, frac = popped / total;
  let target = geo.high + (geo.low - geo.high) * Math.min(1, frac / ((total - 1) / total));
  if (scene.mode === 'land') target = geo.groundY - bh * 0.78;
  if (scene.mode === 'fly') { scene.vy -= 0.35; scene.y += scene.vy; }
  else { scene.y += (target - (geo.high + scene.y) - 0) * 0.06; }
  const by = (scene.mode === 'fly' ? geo.high : geo.high) + scene.y + (scene.mode === 'land' ? 0 : Math.sin(t * 1.4) * 4);
  const bx = W / 2 + (scene.mode === 'land' ? 0 : Math.sin(t * 0.8) * 7);
  const tx = bx, ty = by - geo.tieGap;
  // ropes from basket to tie point
  g.strokeStyle = 'rgba(90,70,50,.7)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(bx - bw * 0.42, by + 2); g.lineTo(tx, ty); g.moveTo(bx + bw * 0.42, by + 2); g.lineTo(tx, ty); g.stroke();
  // balloons back to front
  const live = balloons.map((b, i) => ({ b, i, o: slotFor(i, total) })).sort((a, c) => a.o[1] - c.o[1]);
  for (const { b, o } of live) {
    const wob = Math.sin(t * 1.7 + b.ph) * r * 0.12, x = tx + o[0] * r + wob, y = ty + o[1] * r + Math.cos(t * 1.3 + b.ph) * r * 0.08;
    b.x = x; b.y = y;
    if (!b.alive) continue;
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo((tx + x) / 2 + wob, (ty + y) / 2 + r, x, y + r * 1.25); g.stroke();
    const s = 1 + (b.shake ? Math.sin((now - b.shake) / 30) * 0.06 * Math.max(0, 1 - (now - b.shake) / 400) : 0);
    g.save(); g.translate(x, y); g.scale(s, s); g.translate(-x, -y);
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.5, r * 0.1, x, y, r * 1.3); gr.addColorStop(0, shade(b.col, 0.35)); gr.addColorStop(0.55, b.col); gr.addColorStop(1, shade(b.col, -0.22));
    g.fillStyle = gr; balloonPath(x, y, r); g.fill();
    g.fillStyle = shade(b.col, -0.15); g.beginPath(); g.moveTo(x, y + r * 1.12); g.lineTo(x - r * 0.16, y + r * 1.34); g.lineTo(x + r * 0.16, y + r * 1.34); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - r * 0.42, y - r * 0.48, r * 0.17, r * 0.32, -0.5, 0, 7); g.fill();
    g.restore();
  }
  // tie knot
  g.fillStyle = '#c99a62'; g.beginPath(); g.arc(tx, ty, 3, 0, 7); g.fill();
  drawPip(bx, by, t, left);
  drawBasket(bx, by);
}
function drawBasket(x, y) {
  const { bw, bh } = geo, x0 = x - bw / 2;
  g.save();
  g.fillStyle = '#c8894b'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + bw, y); g.lineTo(x0 + bw * 0.88, y + bh); g.quadraticCurveTo(x, y + bh * 1.08, x0 + bw * 0.12, y + bh); g.closePath(); g.fill();
  g.clip();
  g.strokeStyle = '#a86f38'; g.lineWidth = 2;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x0, y + bh * i / 4); g.lineTo(x0 + bw, y + bh * i / 4); g.stroke(); }
  for (let i = 0; i < 9; i++) { const xx = x0 + bw * (i + 0.5) / 9; for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? 'rgba(255,230,190,.28)' : 'rgba(120,70,30,.18)'; g.fillRect(xx - bw / 20, y + bh * j / 4 + 1, bw / 10, bh / 4 - 2); } }
  g.restore();
  g.fillStyle = '#e0a463'; g.beginPath(); g.roundRect(x0 - 4, y - 5, bw + 8, 10, 5); g.fill();
}
function drawPip(x, y, t, left) {
  const { bw } = geo, hr = bw * 0.27, hx = x, hy = y - hr * 0.95 - (scene.cheer ? Math.abs(Math.sin(t * 9)) * 4 : 0);
  const worried = state === 'play' && left <= 2 && left > 0, sad = scene.mode === 'land', happy = scene.mode === 'fly' || scene.cheer > 0;
  // arms
  g.strokeStyle = '#e8a861'; g.lineCap = 'round'; g.lineWidth = hr * 0.32;
  const wave = scene.wave > performance.now() ? Math.sin(t * 16) * 0.5 : 0;
  const up = happy ? -1.1 : 0;
  g.beginPath(); g.moveTo(hx - hr * 0.7, hy + hr * 0.5); g.lineTo(hx - hr * 1.15, hy + hr * (0.85 + up * 1.4)); g.stroke();
  g.beginPath(); g.moveTo(hx + hr * 0.7, hy + hr * 0.5); g.lineTo(hx + hr * 1.15 + wave * hr * 0.4, hy + hr * (0.85 + (happy ? up * 1.4 : -0.9 * Math.abs(wave) * 2))); g.stroke();
  // ears
  g.fillStyle = '#f3b46e'; for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * hr * 0.72, hy - hr * 0.72, hr * 0.38, 0, 7); g.fill(); }
  g.fillStyle = '#ffd7c2'; for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * hr * 0.72, hy - hr * 0.72, hr * 0.2, 0, 7); g.fill(); }
  // head
  const hg = g.createRadialGradient(hx - hr * 0.3, hy - hr * 0.4, hr * 0.2, hx, hy, hr * 1.1); hg.addColorStop(0, '#ffd9a3'); hg.addColorStop(1, '#f0a75f');
  g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fill();
  g.fillStyle = '#fff1dc'; g.beginPath(); g.ellipse(hx, hy + hr * 0.38, hr * 0.55, hr * 0.42, 0, 0, 7); g.fill();
  // eyes
  g.fillStyle = '#2b2233'; g.strokeStyle = '#2b2233'; g.lineWidth = 2.2;
  const ey = hy - hr * 0.1, ex = hr * 0.38, blink = (t % 3.7) < 0.12;
  for (const s of [-1, 1]) {
    if (happy || sad) { g.beginPath(); g.arc(hx + s * ex, ey + (sad ? -1 : 2), hr * 0.14, sad ? 0.1 : Math.PI + 0.2, sad ? Math.PI - 0.1 : -0.2); g.stroke(); }
    else if (blink) { g.beginPath(); g.moveTo(hx + s * ex - hr * 0.12, ey); g.lineTo(hx + s * ex + hr * 0.12, ey); g.stroke(); }
    else { g.beginPath(); g.arc(hx + s * ex, ey, hr * (worried ? 0.16 : 0.13), 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + s * ex + 1.5, ey - 1.8, hr * 0.05, 0, 7); g.fill(); g.fillStyle = '#2b2233'; }
  }
  if (worried) { g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * ex - hr * 0.15 * s, ey - hr * 0.32); g.lineTo(hx + s * ex + hr * 0.15 * s, ey - hr * 0.22); g.stroke(); } }
  // cheeks + mouth
  g.fillStyle = 'rgba(255,120,130,.45)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(hx + s * hr * 0.62, hy + hr * 0.22, hr * 0.16, hr * 0.1, 0, 0, 7); g.fill(); }
  g.fillStyle = '#7a3a3a'; g.strokeStyle = '#7a3a3a'; g.lineWidth = 2;
  if (worried) { g.beginPath(); g.ellipse(hx, hy + hr * 0.38, hr * 0.1, hr * 0.13, 0, 0, 7); g.fill(); }
  else if (happy) { g.beginPath(); g.arc(hx, hy + hr * 0.26, hr * 0.22, 0.1, Math.PI - 0.1); g.closePath(); g.fill(); }
  else if (sad) { g.beginPath(); g.arc(hx, hy + hr * 0.5, hr * 0.13, Math.PI + 0.3, -0.3); g.stroke(); }
  else { g.beginPath(); g.arc(hx, hy + hr * 0.28, hr * 0.15, 0.2, Math.PI - 0.2); g.stroke(); }
  if (sad && scene.bump) { // little dizzy stars after the soft landing
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; g.fillStyle = '#ffd84d'; star(hx + Math.cos(a) * hr * 1.1, hy - hr * 1.15 + Math.sin(a) * hr * 0.25, 5); }
  }
}
function star(x, y, s) { g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
const frame = (now) => { draw(now); requestAnimationFrame(frame); };
requestAnimationFrame(frame);

// ---------------------------------------------------------------- play
const popSfx = () => { tone(1500, 0.04, 'square', 0.08, 0.3); tone(240, 0.12, 'sawtooth', 0.07, 0.4); setTimeout(() => tone(160, 0.15, 'sine', 0.06, 0.6), 40); };
function revealed() { return [...word].every(ch => ch === ' ' || guessed.has(ch)); }
function guess(ch) {
  if (state !== 'play' || guessed.has(ch)) { if (state === 'play' && guessed.has(ch)) say(`${ch.toUpperCase()} is already used`); return; }
  guessed.add(ch);
  const hits = [...word].map((c, i) => c === ch ? i : -1).filter(i => i >= 0);
  if (hits.length) {
    keyEl[ch].className = 'hit'; buzz(8);
    hits.forEach((i, k) => setTimeout(() => {
      const s = slotEls[i]; s.textContent = ch; s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
      const b = s.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', '#ffd84d', sk.acc], 6, { speed: 2.4, size: 2.6 });
      chime(k + 2 + hits.length, 69, 0.1);
    }, k * 90));
    scene.wave = performance.now() + 700;
    const n = [...word].filter(c => c !== ' ').length, got = [...word].filter(c => c !== ' ' && guessed.has(c)).length;
    ui.progress(got / n);
    if (hits.length >= 3) ui.pop(`×${hits.length}!`, '#fff', 34, 30);
    if (revealed()) setTimeout(() => finish(true), hits.length * 90 + 250);
  } else {
    keyEl[ch].className = 'miss';
    const alive = balloons.filter(b => b.alive);
    const b = alive[Math.floor(Math.random() * alive.length)];
    b.shake = performance.now();
    setTimeout(() => {
      b.alive = false; popped++; popSfx(); buzz(25);
      fx.sparks(b.x, b.y, [b.col, shade(b.col, -0.2), '#fff'], 14, { speed: 4.2, size: 4, kind: 'conf', g: 0.18 });
      fx.ring(b.x, b.y, '#fff', geo.r);
      const left = total - popped;
      if (left === 1) ui.pop('Last balloon!', '#fff', 26, 30);
      if (left <= 0) finish(false);
    }, 160);
  }
}
const PRAISE = ['Flawless!', 'Brilliant!', 'Great guessing!', 'Nicely done!', 'Got it!', 'Phew!', 'Just in time!', 'Close one!', 'Saved!'];
function finish(won) {
  if (state !== 'play') return;
  const left = total - popped;
  if (!recorded) { recorded = true; if (!D.isDaily) { if (won) F.level(true); else F.level(false, [...word].filter(c => guessed.has(c)).length / word.length); } }
  if (won) {
    state = 'won';
    const pts = 10 + left * 5; points += pts; solved++; S.set('points', points); S.set('solved', solved); hud();
    B.submit(1);
    slots.classList.add('win'); slotEls.forEach((s, i) => (s.style.animationDelay = i * 70 + 'ms'));
    scene.mode = 'fly'; scene.vy = 0; scene.cheer = 1;
    ui.pop(PRAISE[Math.min(PRAISE.length - 1, popped)], '#fff', 36, 30); arp([67, 72, 76, 79, 84], 90, 0.12, 0.8); fx.confetti(); buzz([20, 40, 20]);
    if (!beatenShown && D.beaten(pts)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#ffd84d', 40, 22); fx.confetti(60); }, 500); }
    const d = new Date(), tag = D.isDaily ? `the ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()} daily word` : `word #${level}`;
    D.won(pts, `guessed ${tag} with ${left} balloon${left === 1 ? '' : 's'} left and scored`);
    if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || !prev.w || left > prev.left) S.set(k, { w: 1, left }); }
    else { level++; S.set('level', level); }
    setTimeout(() => ui.win(D.isDaily ? '' : level - 1, `${word.toUpperCase()} · ${left} balloon${left === 1 ? '' : 's'} left · +${pts} ★`), 700);
  } else {
    state = 'lost';
    [...word].forEach((ch, i) => { if (ch !== ' ' && !guessed.has(ch)) { const s = slotEls[i]; s.textContent = ch; s.classList.add('miss', 'on'); } });
    scene.mode = 'land'; setTimeout(() => { scene.bump = 1; soft.wood(); buzz([30, 40, 30]); }, 900);
    soft.err();
    if (D.isDaily) { const k = 'daily_' + todayKey(); if (!S.get(k, null)) S.set(k, { w: 0 }); }
    else { level++; S.set('level', level); }   // a missed word still moves on (the answer is shown)
    setTimeout(() => ui.lose('Soft landing!', `The word was ${word.toUpperCase()}`), 1500);
  }
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot guesses like a careful player,
// picking the letter most common among this category's words that still fit the pattern (one guess per ~0.5 s)
let botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return points; },
  bot() {
    if (state !== 'play' || (botTick++ % 4)) return;
    const fits = (w) => w.length === word.length && [...w].every((c, i) => guessed.has(word[i]) ? c === word[i] : !guessed.has(c));
    let cand = CATS[cat].filter(fits); if (!cand.length) cand = [word];
    const cnt = {}; for (const w of cand) for (const c of new Set(w)) if (!guessed.has(c) && c !== ' ') cnt[c] = (cnt[c] || 0) + 1;
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || [...'etaoinshrdlcumwfgypbvkjxqz'].find(c => !guessed.has(c));
    guess(best);
  },
};

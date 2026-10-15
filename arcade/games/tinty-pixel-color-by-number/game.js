// Tinty — pixel colour-by-number. Pick a colour, tap or drag over its numbered squares to fill them, and finish the
// picture. All pictures are hand-coded vector drawings (pictures.js) rasterised to bigger pixel grids on later levels.
import { createUI, store, buzz, note, tone } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { PICTURES, raster } from './pictures.js';
// No flow.js: colouring has no fail state and no skill element (FLOW_BRIEF rule 4) — every picture can always be finished.

const NAME = 'Tinty: Pixel Color by Number';
const S = store('tinty');
const ui = createUI({ title: 'Tinty', hint: 'Tap to colour', hand: '', score: false });
cardTheme({ accent: '#ff5d8f', serif: "'Baloo 2',system-ui,sans-serif", font: "'Baloo 2',system-ui,sans-serif" });
const D = daily('tinty', ui, { name: NAME });
const WB = board({ game: 'tinty', label: 'Pictures coloured', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily picture' : 'pixel colour by number', doneLine: doneToday ? (D.isDaily ? 'Coloured today ✓' : 'Daily picture coloured ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily picture<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Beautiful!';

css(`
body{background:linear-gradient(180deg,#fdf0fb,#eaf4ff)}
.hc-card{background:linear-gradient(180deg,rgba(60,30,80,.55),rgba(40,20,60,.75))!important}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:800;color:#fff;background:#ff5d8f}
.hc-top .hc-lvl.next{background:rgba(255,93,143,.15);color:#ff5d8f}
.hc-top .hc-bar{background:rgba(255,93,143,.15);height:8px}.hc-top .hc-bar i{background:linear-gradient(90deg,#ff5d8f,#ffb15c)}
#cv{position:fixed;inset:0;z-index:2;touch-action:none}
#nm{position:fixed;left:0;right:0;top:calc(54px + env(safe-area-inset-top));text-align:center;z-index:5;pointer-events:none;font-family:'Baloo 2',system-ui,sans-serif;color:#7a5a8c;font-weight:800;font-size:16px;letter-spacing:.5px}
#nm span{opacity:.55;font-weight:600;font-size:13px}
#pal{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;justify-content:center;align-content:center;flex-wrap:wrap;gap:10px 8px;padding:18px 10px calc(26px + env(safe-area-inset-bottom));background:rgba(255,255,255,.82);border-radius:26px 26px 0 0;box-shadow:0 -6px 24px rgba(120,60,140,.12);min-height:110px}
.ch{position:relative;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:19px;cursor:pointer;transition:transform .18s cubic-bezier(.3,1.6,.5,1);box-shadow:0 3px 8px rgba(80,40,90,.18)}
.ch:before{content:'';position:absolute;inset:-5px;border-radius:50%;background:conic-gradient(#ff5d8f var(--p),rgba(0,0,0,.06) 0);-webkit-mask:radial-gradient(circle,transparent 26px,#000 27px);mask:radial-gradient(circle,transparent 26px,#000 27px)}
.ch.on{transform:scale(1.2) translateY(-4px)}
.ch.on:after{content:'';position:absolute;bottom:-14px;width:6px;height:6px;border-radius:50%;background:#ff5d8f}
.ch.done{opacity:.9}
.ch.done span{font-size:22px}
#zoom{position:fixed;right:12px;top:calc(50px + env(safe-area-inset-top));z-index:6;font:inherit;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:14px;color:#7a5a8c;background:rgba(255,255,255,.75);border:0;border-radius:18px;padding:6px 12px;box-shadow:0 2px 6px rgba(80,40,90,.15);cursor:pointer}
`);
const cv = document.createElement('canvas'); cv.id = 'cv'; document.body.appendChild(cv); const g = cv.getContext('2d');
const nm = document.createElement('div'); nm.id = 'nm'; document.body.appendChild(nm);
const pal = document.createElement('div'); pal.id = 'pal'; document.body.appendChild(pal);
const zoomBtn = document.createElement('button'); zoomBtn.id = 'zoom'; zoomBtn.textContent = '🔍 Zoom'; document.body.appendChild(zoomBtn);
for (const el of [pal, zoomBtn]) el.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), total = S.get('score', 0), pic = null, filled = null, fillT = null, wrongT = null, sel = 0, left = [], nFilled = 0;
let view = { z: 1, x: 0, y: 0 }, B = { x: 0, y: 0, s: 300 }, revealT = 0, recorded = false, beatenShown = false, botPos = null, shake = 0;
const sizeFor = (L) => L <= 4 ? 14 : L <= 12 ? 16 : L <= 26 ? 20 : L <= PICTURES.length ? 24 : 28;
const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

function layout() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const palH = pal.offsetHeight || 110, top = 92, room = H - top - palH - 16;
  B.s = Math.min(W - 16, room - 8, 620); B.x = (W - B.s) / 2; B.y = top + Math.max(0, (room - B.s) / 2);
  clampView();
}
addEventListener('resize', layout);
function build() {
  const idx = D.isDaily ? (D.seed * 7) % PICTURES.length : (level - 1) % PICTURES.length, n = D.isDaily ? 20 : sizeFor(level);
  pic = raster(idx, n);
  // number colours by how many squares they cover (most first) so "1" is usually the background
  const cnt = pic.pal.map((_, i) => 0); for (const c of pic.cells) cnt[c]++;
  const order = pic.pal.map((_, i) => i).sort((a, b) => cnt[b] - cnt[a]), remap = []; order.forEach((o, i) => remap[o] = i);
  pic.pal = order.map(o => pic.pal[o]); pic.cells = pic.cells.map(c => remap[c]);
  filled = new Uint8Array(n * n); fillT = new Float32Array(n * n); wrongT = new Float32Array(n * n);
  left = pic.pal.map(() => 0); for (const c of pic.cells) left[c]++;
  sel = 0; nFilled = 0; revealT = 0; recorded = false; beatenShown = false; view = { z: 1, x: 0, y: 0 };
  nm.innerHTML = `${pic.name} <span>· ${n}×${n}</span>`;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  ui.progress(0); drawPal(); layout(); requestAnimationFrame(layout);
}
function drawPal() {
  pal.innerHTML = '';
  pic.pal.forEach((c, i) => {
    const d = document.createElement('div'), done = left[i] === 0, tot = pic.cells.filter(x => x === i).length;
    d.className = 'ch' + (i === sel ? ' on' : '') + (done ? ' done' : '');
    d.style.background = c; d.style.color = lum(c) > 0.62 ? '#4b3a55' : '#fff'; d.style.setProperty('--p', ((1 - left[i] / tot) * 100) + '%');
    d.innerHTML = `<span>${done ? '✓' : i + 1}</span>`;
    d.onpointerdown = () => { if (state !== 'play') return; sel = i; drawPal(); soft.click(); buzz(4); };
    pal.appendChild(d);
  });
}
function updChip(i) { const d = pal.children[i]; if (!d) return; const tot = pic.cells.filter(x => x === i).length; d.style.setProperty('--p', ((1 - left[i] / tot) * 100) + '%'); }

// ---------------------------------------------------------------- view (zoom / pan)
const cs = () => B.s / pic.n * view.z;
function clampView() { if (!pic) return; const s = B.s * view.z; view.x = Math.min(0, Math.max(B.s - s, view.x)); view.y = Math.min(0, Math.max(B.s - s, view.y)); if (view.z <= 1) view.x = view.y = 0; }
function zoomAt(px, py, z) { z = Math.max(1, Math.min(4, z)); const k = z / view.z; view.x = (px - B.x) - (px - B.x - view.x) * k; view.y = (py - B.y) - (py - B.y - view.y) * k; view.z = z; clampView(); }
function cellAt(px, py) { const c = cs(), x = Math.floor((px - B.x - view.x) / c), y = Math.floor((py - B.y - view.y) / c); return px < B.x || py < B.y || px > B.x + B.s || py > B.y + B.s || x < 0 || y < 0 || x >= pic.n || y >= pic.n ? -1 : y * pic.n + x; }
zoomBtn.onclick = () => { if (!pic) return; const z = view.z > 1.4 ? 1 : 2.4; zoomAt(B.x + B.s / 2, B.y + B.s / 2, z); zoomBtn.textContent = view.z > 1 ? '🔍 Fit' : '🔍 Zoom'; soft.click(); };
cv.addEventListener('wheel', e => { e.preventDefault(); if (pic) { zoomAt(e.clientX, e.clientY, view.z * (e.deltaY < 0 ? 1.15 : 0.87)); zoomBtn.textContent = view.z > 1 ? '🔍 Fit' : '🔍 Zoom'; } }, { passive: false });

// ---------------------------------------------------------------- painting
let streak = 0, lastNoteT = 0;
function paint(k, tap) {
  if (state !== 'play' || k < 0 || filled[k]) return false;
  const now = performance.now() / 1000;
  if (pic.cells[k] !== sel) { if (tap) { wrongT[k] = now; soft.err(); buzz(15); } return false; }
  filled[k] = 1; fillT[k] = now; nFilled++; left[sel]--; total++; streak++;
  if (now - lastNoteT > 0.045) { lastNoteT = now; tone(520 + Math.min(streak, 30) * 18, 0.05, 'triangle', 0.06, 1.25); }
  buzz(3); updChip(sel); ui.progress(nFilled / pic.cells.length);
  if (!beatenShown && D.beaten(total)) { beatenShown = true; ui.pop('BEATEN!', '#ff5d8f', 40, 30); fx.confetti(60); }
  if (left[sel] === 0) colourDone(sel);
  return true;
}
function colourDone(i) {
  const d = pal.children[i], b = d.getBoundingClientRect();
  fx.sparks(b.left + b.width / 2, b.top + b.height / 2, [pic.pal[i], '#fff', '#ffd23f'], 18, { speed: 4, size: 4 }); fx.ring(b.left + b.width / 2, b.top + b.height / 2, pic.pal[i], 34);
  chime(i + 3, 72, 0.12); buzz(15);
  if (nFilled === pic.cells.length) return win();
  const nx = left.findIndex(v => v > 0); if (nx >= 0) sel = nx;
  ui.pop(['Nice!', 'Lovely!', 'Great!', 'Pretty!', 'Yay!'][i % 5], '#ff5d8f', 30, 74);
  drawPal();
}
function stroke(ax, ay, bx, by) {   // paint along the finger path so fast drags don't skip squares
  const c = cs(), steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (c * 0.4)));
  for (let i = 1; i <= steps; i++) paint(cellAt(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps), false);
}
const ptrs = new Map(); let mode = null, last = null, pinch = null, downAt = null;
cv.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 1) { mode = 'paint'; last = [e.clientX, e.clientY]; downAt = [e.clientX, e.clientY]; streak = 0; const k = cellAt(e.clientX, e.clientY); if (k >= 0 && !filled[k] && pic.cells[k] !== sel) mode = view.z > 1 ? 'pan' : 'paint'; else paint(k, false); }
  else if (ptrs.size === 2) { mode = 'pinch'; const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: view.z, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; }
});
addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (mode === 'paint' && last) { stroke(last[0], last[1], e.clientX, e.clientY); last = [e.clientX, e.clientY]; }
  else if (mode === 'pan' && last) { view.x += e.clientX - last[0]; view.y += e.clientY - last[1]; clampView(); last = [e.clientX, e.clientY]; }
  else if (mode === 'pinch' && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    view.x += cx - pinch.cx; view.y += cy - pinch.cy; pinch.cx = cx; pinch.cy = cy; zoomAt(cx, cy, pinch.z * d / pinch.d);
    zoomBtn.textContent = view.z > 1 ? '🔍 Fit' : '🔍 Zoom';
  }
});
const up = (e) => {
  if (!ptrs.has(e.pointerId)) return;
  if (mode === 'pan' && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8) paint(cellAt(e.clientX, e.clientY), true);
  else if (mode === 'paint' && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8) { const k = cellAt(e.clientX, e.clientY); if (k >= 0 && !filled[k] && pic.cells[k] !== sel) paint(k, true); }
  ptrs.delete(e.pointerId); if (!ptrs.size) { mode = null; last = null; } else if (mode === 'pinch') { mode = null; }
};
addEventListener('pointerup', up); addEventListener('pointercancel', up);

// ---------------------------------------------------------------- win
function win() {
  if (state !== 'play') return;
  state = 'won'; revealT = performance.now() / 1000;
  view = { z: 1, x: 0, y: 0 }; zoomBtn.textContent = '🔍 Zoom';
  S.set('score', total);
  arp([72, 76, 79, 84, 79, 84, 88], 95, 0.12, 0.8); setTimeout(() => fx.confetti(150, pic.pal.concat(['#fff', '#ffd23f'])), 500); buzz([20, 50, 20]);
  if (D.isDaily) S.set('daily_' + todayKey(), { s: total });
  else { level++; S.set('level', level); }
  D.won(total, 'coloured'); WB.submit(1);   // world board: pictures coloured today
  setTimeout(() => ui.win(D.isDaily ? '' : level - 1, `${pic.name} · ${pic.cells.length} squares`), 900);
}
ui.onTap((which) => {
  WB.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});

// ---------------------------------------------------------------- render
function frame() {
  requestAnimationFrame(frame);
  if (!pic) return;
  const W = innerWidth, H = innerHeight, now = performance.now() / 1000, n = pic.n;
  g.clearRect(0, 0, W, H);
  const rv = revealT ? Math.min(1, (now - revealT) / 0.8) : 0, bounce = revealT ? Math.sin(Math.min(1, (now - revealT) / 0.5) * Math.PI) * 0.04 : 0;
  // board card
  g.save(); g.shadowColor = 'rgba(120,60,140,.22)'; g.shadowBlur = 26; g.shadowOffsetY = 8; g.fillStyle = '#fff';
  g.beginPath(); g.roundRect(B.x - 6, B.y - 6, B.s + 12, B.s + 12, 14); g.fill(); g.restore();
  g.save(); g.beginPath(); g.rect(B.x, B.y, B.s, B.s); g.clip();
  const sc = 1 + bounce; g.translate(B.x + B.s / 2, B.y + B.s / 2); g.scale(sc, sc); g.translate(-B.x - B.s / 2, -B.y - B.s / 2);
  const c = cs(), ox = B.x + view.x, oy = B.y + view.y, gap = c > 9 ? Math.max(0.6, c * 0.05) * (1 - rv) : 0;
  const x0 = Math.max(0, Math.floor(-view.x / c)), y0 = Math.max(0, Math.floor(-view.y / c)), x1 = Math.min(n, Math.ceil((B.s - view.x) / c)), y1 = Math.min(n, Math.ceil((B.s - view.y) / c));
  const fs = Math.max(7, Math.min(22, c * 0.52)), showNums = c >= 11 && rv === 0;
  g.font = `800 ${fs}px 'Baloo 2',system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const k = y * n + x, px = ox + x * c, py = oy + y * c, v = pic.cells[k];
    if (filled[k] || rv > 0) {
      const t = filled[k] ? Math.min(1, (now - fillT[k]) / 0.18) : 1, s = t < 1 ? 0.4 + 0.6 * (1 + 0.5 * Math.sin(t * Math.PI)) * t : 1;
      g.fillStyle = pic.pal[v]; const w = c * Math.min(1.12, s);
      g.fillRect(px + (c - w) / 2 - 0.25, py + (c - w) / 2 - 0.25, w + 0.5, w + 0.5);
      continue;
    }
    const hl = v === sel, wr = now - wrongT[k] < 0.35;
    g.fillStyle = wr ? '#ffb3c1' : hl ? '#cfd2e2' : ((x + y) % 2 ? '#f3f3f8' : '#f8f8fb');
    g.fillRect(px + gap / 2, py + gap / 2, c - gap, c - gap);
    if (showNums) { g.fillStyle = hl ? '#3f4460' : '#a3a8bb'; g.fillText(v + 1, px + c / 2, py + c / 2 + fs * 0.06); }
  }
  // shimmer sweep on reveal
  if (rv > 0 && rv < 1) { const sx = B.x - B.s * 0.3 + rv * B.s * 1.6, gr = g.createLinearGradient(sx - 60, 0, sx + 60, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(B.x, B.y, B.s, B.s); }
  g.restore();
  if (botPos && state === 'play') { g.fillStyle = 'rgba(255,93,143,.25)'; g.beginPath(); g.arc(botPos[0], botPos[1], 22, 0, 7); g.fill(); }
}
build(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hook: picks a colour and drags across its squares
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play') return;
    if (left[sel] === 0) { sel = left.findIndex(v => v > 0); drawPal(); }
    let done = 0;
    for (let k = 0; k < pic.cells.length && done < 12; k++) if (!filled[k] && pic.cells[k] === sel) { const c = cs(); botPos = [B.x + view.x + (k % pic.n + 0.5) * c, B.y + view.y + (Math.floor(k / pic.n) + 0.5) * c]; if (paint(k, false)) done++; if (state !== 'play') break; }
  },
};

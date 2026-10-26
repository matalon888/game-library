// Seekaloo — original themed word search. Swipe across the grid in any of 8 directions to circle a hidden word.
// Grids are generated (seeded) from our own hand-written themes and grow with the level; ?daily=1 = today's grid for everyone.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { THEMES } from './themes.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
const B = board({ game: 'seekaloo', label: 'Puzzles solved', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Seekaloo: Word Search Puzzle';
const S = store('seekaloo');
const F = flow('seekaloo');
const ui = createUI({ title: 'Seekaloo', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#ff8a3d' });
const D = daily('seekaloo', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily word search' : 'themed word search', doneLine: doneToday ? (D.isDaily ? `Found them all today · ${doneToday.s} pts` : 'Daily grid done ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily grid<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'All found!';

const CAPS = ['#ff9f43', '#ff6b81', '#4fa3ff', '#4cd388', '#c56cf0', '#f9c932', '#2fd3e6', '#ff7f50', '#8c7cf0', '#7bd148'];
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- painted backdrops (one per scene family)
const SCENES = {
  sea: { sky: ['#9ad9f0', '#c8ecf7', '#fff3dc'], layers: ['#5cc6d8', '#2fa9c4', '#f4dcae', '#ecca8f'], sun: '#fff8e4', waves: true },
  meadow: { sky: ['#bfe6ff', '#e6f6ff', '#fff6e0'], layers: ['#b6e39c', '#8fd07a', '#6cbc62', '#4fa555'], sun: '#fffbe8' },
  forest: { sky: ['#cfeee4', '#e9f7ef', '#fdf6e6'], layers: ['#8cc9a2', '#5fae7f', '#3f8f66', '#2c724f'], sun: '#ffffff', pines: true },
  desert: { sky: ['#ffd9a8', '#ffe9c9', '#fff5e4'], layers: ['#f6c98b', '#eeb06d', '#e09a57', '#cf8445'], sun: '#fff4d6' },
  snow: { sky: ['#cfe3ff', '#e8f1ff', '#ffffff'], layers: ['#e6eefb', '#cfdcf2', '#b7c9e8', '#f7fbff'], sun: '#ffffff', pines: true },
  lake: { sky: ['#b9dcff', '#dcefff', '#f6f2ff'], layers: ['#a7c9e6', '#86b0d6', '#6fc0d2', '#5aaecb'], sun: '#ffffff', waves: true },
  night: { sky: ['#1f2a5c', '#3b3f86', '#7d6bb3'], layers: ['#4a4c8f', '#383a76', '#292a5e', '#1c1d47'], sun: '#fff3c9', stars: true },
  city: { sky: ['#ffd0c2', '#ffe6d6', '#fff4e8'], layers: ['#c7b8e0', '#a796cf', '#8b7cc0', '#6f63a8'], sun: '#fff6e8', city: true },
  blossom: { sky: ['#ffd6e7', '#ffeaf2', '#fff7ea'], layers: ['#c9e7a8', '#a8d88f', '#f7b5cd', '#8cc879'], sun: '#ffffff', blossom: true },
};
const bg = document.createElement('canvas'); bg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0'; document.body.prepend(bg);
function paint(sc, seed) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight, r = rngf(seed * 977 + 3);
  bg.width = W * dpr; bg.height = H * dpr; const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = g.createLinearGradient(0, 0, 0, H * 0.7); sc.sky.forEach((c, i) => sk.addColorStop(i / (sc.sky.length - 1), c)); g.fillStyle = sk; g.fillRect(0, 0, W, H);
  if (sc.stars) for (let i = 0; i < 120; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.fillStyle = '#fff'; g.beginPath(); g.arc(r() * W, r() * H * 0.7, r() * 1.4 + 0.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const sx = W * (0.2 + r() * 0.6), sy = H * (0.1 + r() * 0.1), sr = Math.min(W, H) * 0.08;
  const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4); glow.addColorStop(0, sc.sun + 'cc'); glow.addColorStop(1, sc.sun + '00'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = sc.sun; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  for (let i = 0; i < 5; i++) { const cx = r() * W, cy = H * (0.05 + r() * 0.3), cw = 60 + r() * 110; g.fillStyle = sc.stars ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.55)';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + (k - 2) * cw * 0.22, cy + Math.sin(k * 2) * 4, cw * 0.28, cw * 0.11, 0, 0, 7); g.fill(); } }
  sc.layers.forEach((col, li) => {
    const base = H * (0.42 + li * 0.13), amp = H * (sc.waves && li >= 2 ? 0.012 : 0.06 - li * 0.008), f = [1.2 + r(), 3 + r() * 3], ph = [r() * 7, r() * 7];
    const y = (x) => base - amp * (Math.sin(x / W * f[0] * 3 + ph[0]) * 0.7 + Math.sin(x / W * f[1] * 4 + ph[1]) * 0.3);
    if (sc.city && li < 2) { g.fillStyle = col; let x = -10; while (x < W) { const bw = 22 + r() * 40, bh = H * (0.08 + r() * 0.16) * (li ? 0.7 : 1); g.fillRect(x, base - bh, bw, H); g.fillStyle = 'rgba(255,255,255,.35)'; for (let wy = base - bh + 8; wy < base - 6; wy += 12) for (let wx = x + 5; wx < x + bw - 6; wx += 10) if (r() < 0.5) g.fillRect(wx, wy, 4, 5); g.fillStyle = col; x += bw + 2; } }
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 4; x += 4) g.lineTo(x, y(x)); g.lineTo(W, H); g.closePath(); g.fill();
    if (sc.pines && li >= 1 && li <= 2) for (let x = 0; x < W; x += 8 + r() * 16) { const yy = y(x), h = 16 + r() * 22 + li * 6; g.fillStyle = li === 1 ? sc.layers[2] : sc.layers[3]; g.beginPath(); g.moveTo(x, yy - h); g.lineTo(x + h * 0.3, yy + 2); g.lineTo(x - h * 0.3, yy + 2); g.fill(); }
    if (sc.blossom && li === 1) for (let i = 0; i < 9; i++) { const x = r() * W, yy = y(x); g.fillStyle = '#8a6a5a'; g.fillRect(x - 2, yy - 26, 4, 28); g.fillStyle = ['#ffb3cf', '#ffc9dd', '#ff9ec3'][i % 3]; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (r() - 0.5) * 22, yy - 30 + (r() - 0.5) * 14, 10 + r() * 7, 0, 7); g.fill(); } }
    if (sc.waves && li >= 2) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const wy = base + 10 + i * 14, wx = r() * W; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 15, wy - 5, wx + 30, wy); g.stroke(); } }
  });
}

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#3a3247}
body{background:#bfe6ff}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#ff8a3d;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.hc-top .hc-lvl.next{background:#fff;color:#ff8a3d}.hc-top .hc-bar{background:rgba(255,255,255,.7);height:8px}.hc-top .hc-bar i{background:#ff8a3d}
#panel{position:fixed;z-index:2;background:rgba(255,253,248,.92);border-radius:22px;box-shadow:0 14px 40px -12px rgba(40,30,60,.35),inset 0 0 0 1.5px rgba(255,255,255,.9);overflow:hidden}
#head{background:linear-gradient(180deg,#ffa155,#ff8433);color:#fff;text-align:center;font-weight:800;font-size:19px;letter-spacing:1px;text-transform:uppercase;padding:7px 10px 6px;text-shadow:0 1px 0 rgba(0,0,0,.15);box-shadow:inset 0 -3px 0 rgba(0,0,0,.08)}
#list{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;padding:10px 12px 12px}
#list span{font-weight:800;font-size:15px;letter-spacing:.6px;color:#5a5068;position:relative;transition:color .3s}
#list span.f{color:#b9b1c4}
#list span.f:after{content:'';position:absolute;left:-3px;right:-3px;top:52%;height:3px;border-radius:2px;background:var(--c);animation:strike .35s ease-out both}
@keyframes strike{from{transform:scaleX(0);transform-origin:left}to{transform:scaleX(1)}}
#gridWrap{position:fixed;z-index:2;background:rgba(255,253,248,.95);border-radius:22px;box-shadow:0 14px 40px -12px rgba(40,30,60,.35);touch-action:none}
#gridWrap svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
#grid{position:absolute;display:grid}
#grid div{display:flex;align-items:center;justify-content:center;font-weight:800;color:#3a3247;position:relative;z-index:1;transition:transform .2s,color .2s;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif}
#grid div.sel{color:#fff;transform:scale(1.12)}
#grid div.pop{animation:lp .4s cubic-bezier(.3,1.6,.5,1)}
#grid div.hint{animation:hl 1s ease-in-out infinite;color:#ff6b81}
@keyframes lp{40%{transform:scale(1.35)}}
@keyframes hl{50%{transform:scale(1.35)}}
.btn{position:fixed;z-index:4;width:54px;height:54px;border-radius:50%;background:#fff;box-shadow:0 5px 0 rgba(0,0,0,.1),0 8px 20px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0}
.btn svg{width:28px;height:28px;stroke:#ff8a3d;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.btn i{position:absolute;top:-4px;right:-4px;font-style:normal;background:#ff6b81;color:#fff;font-size:12px;font-weight:800;border-radius:10px;padding:1px 6px}
.btn i.off{background:#aaa}
#score{position:fixed;z-index:5;height:44px;display:flex;align-items:center;background:rgba(255,255,255,.92);color:#3a3247;border-radius:22px;padding:0 16px;font-weight:800;font-size:17px;box-shadow:0 5px 0 rgba(0,0,0,.08),0 8px 20px rgba(0,0,0,.12)}
#curWord{position:fixed;left:50%;z-index:5;transform:translateX(-50%);color:#fff;font-weight:800;font-size:22px;letter-spacing:3px;padding:3px 16px;border-radius:14px;opacity:0;transition:opacity .15s;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.18)}
#curWord.show{opacity:1}
`);
const panel = document.createElement('div'); panel.id = 'panel'; panel.innerHTML = '<div id="head"></div><div id="list"></div>'; document.body.appendChild(panel);
const head = panel.querySelector('#head'), list = panel.querySelector('#list');
const gridWrap = document.createElement('div'); gridWrap.id = 'gridWrap'; gridWrap.innerHTML = '<svg></svg><div id="grid"></div>'; document.body.appendChild(gridWrap);
const svg = gridWrap.querySelector('svg'), gridEl = gridWrap.querySelector('#grid');
const scoreEl = document.createElement('div'); scoreEl.id = 'score'; document.body.appendChild(scoreEl);
const curWord = document.createElement('div'); curWord.id = 'curWord'; document.body.appendChild(curWord);
const hintBtn = document.createElement('button'); hintBtn.className = 'btn'; hintBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg><i>3</i>'; document.body.appendChild(hintBtn);
const NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- level generation
const DIRS8 = [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]];
function spec(lvl, fk) {
  // grids grow by level; flow scales the number of hidden words (and how many run backwards)
  const L = Math.min(lvl, 40);
  const size = L <= 2 ? 6 : L <= 5 ? 7 : L <= 10 ? 8 : L <= 18 ? 9 : 10;
  const rows = size + (L > 24 ? 1 : 0);
  const base = L <= 2 ? 4 : L <= 5 ? 5 : L <= 10 ? 6.5 : L <= 18 ? 8 : 9.5;
  const n = Math.max(4, Math.min(size + 2, Math.round(base * fk)));
  const dirs = L <= 2 ? 2 : L <= 5 ? 3 : L <= 9 ? 4 : 8;
  const back = Math.min(0.6, (L <= 9 ? 0 : 0.25 + (L - 10) * 0.02) * fk);
  return { cols: size, rows, n, dirs, back };
}
function makeLevel(seed, lvl, fk) {
  const r = rngf(seed), sp = spec(lvl, fk);
  for (let attempt = 0; attempt < 60; attempt++) {
    const th = THEMES[Math.floor(r() * THEMES.length)];
    const fit = th.words.filter(w => w.length >= 3 && w.length <= Math.max(sp.cols, sp.rows) && !(lvl <= 2 && w.length > 6));
    if (fit.length < sp.n) continue;
    // drop words that contain another chosen word (avoids "SEA" hiding inside "SEAL")
    const pool = fit.slice().sort(() => r() - 0.5), words = [];
    for (const w of pool) { if (words.length >= sp.n) break; if (words.some(x => x.includes(w) || w.includes(x))) continue; words.push(w); }
    if (words.length < sp.n) continue;
    words.sort((a, b) => b.length - a.length);
    const g = Array.from({ length: sp.rows }, () => Array(sp.cols).fill(''));
    const placed = []; let ok = true;
    for (const w of words) {
      let best = null;
      for (let t = 0; t < 250; t++) {
        let [dx, dy] = DIRS8[Math.floor(r() * sp.dirs)];
        if (sp.dirs < 8 && r() < sp.back) { dx = -dx; dy = -dy; }
        const x0 = Math.floor(r() * sp.cols), y0 = Math.floor(r() * sp.rows), x1 = x0 + dx * (w.length - 1), y1 = y0 + dy * (w.length - 1);
        if (x1 < 0 || x1 >= sp.cols || y1 < 0 || y1 >= sp.rows) continue;
        let cross = 0, good = true;
        for (let i = 0; i < w.length; i++) { const c = g[y0 + dy * i][x0 + dx * i]; if (c && c !== w[i]) { good = false; break; } if (c) cross++; }
        if (!good) continue;
        const sc = cross * 2 + r();
        if (!best || sc > best.sc) best = { sc, x0, y0, dx, dy };
        if (t > 60 && best) break;
      }
      if (!best) { ok = false; break; }
      for (let i = 0; i < w.length; i++) g[best.y0 + best.dy * i][best.x0 + best.dx * i] = w[i];
      placed.push({ w, x0: best.x0, y0: best.y0, dx: best.dx, dy: best.dy, found: false });
    }
    if (!ok) continue;
    // fill with letters drawn from the theme's own words, so the filler looks plausible
    const bag = th.words.join('') + 'AEIOURSTLNE';
    for (let y = 0; y < sp.rows; y++) for (let x = 0; x < sp.cols; x++) if (!g[y][x]) g[y][x] = bag[Math.floor(r() * bag.length)];
    if (placed.every(p => countIn(g, p.w) === 1)) return { theme: th, grid: g, cols: sp.cols, rows: sp.rows, words: placed };
  }
  return null;
}
function countIn(g, w) {
  let n = 0; const R = g.length, C = g[0].length;
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) for (const [dx, dy] of DIRS8) {
    let k = 0; while (k < w.length) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= C || yy >= R || g[yy][xx] !== w[k]) break; k++; }
    if (k === w.length) n++;
  }
  return w.split('').reverse().join('') === w ? n / 2 : n;
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = S.get('score', 0), lv, cells = [], geo = { cs: 30, ox: 0, oy: 0 }, sel = null, hints = 3, hintUsedAt = -1, recorded = false, beatenShown = false, dailyScore = 0, colorI = 0, botPlan = null;
function build() {
  const fk = D.isDaily ? 1 : F.k();
  const lvl = D.isDaily ? 12 : level;
  lv = makeLevel(D.seed ? D.seed : level * 4271 + 5, lvl, fk) || makeLevel(level * 4271 + 6, 1, 1);
  hints = 3; hintUsedAt = -1; recorded = false; beatenShown = false; dailyScore = 0; colorI = Math.floor(Math.random() * CAPS.length); sel = null; botPlan = null;
  head.textContent = lv.theme.name;
  list.innerHTML = ''; for (const p of lv.words) { const s = document.createElement('span'); s.textContent = p.w; list.appendChild(s); p.el = s; }
  gridEl.innerHTML = ''; cells = [];
  gridEl.style.gridTemplateColumns = `repeat(${lv.cols},1fr)`;
  for (let y = 0; y < lv.rows; y++) { cells.push([]); for (let x = 0; x < lv.cols; x++) { const d = document.createElement('div'); d.textContent = lv.grid[y][x]; gridEl.appendChild(d); cells[y].push(d); } }
  svg.innerHTML = '';
  ui.levels(D.isDaily ? 1 : level); ui.progress(0); ui.sub('');
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  layout(); hud();
}
function layout() {
  const W = innerWidth, H = innerHeight, bw = Math.min(W - 24, 470), left = (W - bw) / 2;
  Object.assign(panel.style, { left: left + 'px', top: '64px', width: bw + 'px' });
  const ph = panel.offsetHeight;
  const cs = Math.floor(Math.min((bw - 18) / lv.cols, (H - 64 - ph - 12 - 96) / lv.rows, 56));
  const gw = cs * lv.cols + 18, gh = cs * lv.rows + 18;
  const top = 64 + Math.max(0, (H - 64 - 96 - ph - 12 - gh) * 0.35), gTop = top + ph + 12;
  panel.style.top = top + 'px';
  Object.assign(gridWrap.style, { left: (W - gw) / 2 + 'px', top: gTop + 'px', width: gw + 'px', height: gh + 'px' });
  Object.assign(gridEl.style, { left: '9px', top: '9px', width: cs * lv.cols + 'px', height: cs * lv.rows + 'px', gridAutoRows: cs + 'px' });
  for (const row of cells) for (const c of row) c.style.fontSize = cs * 0.54 + 'px';
  geo = { cs, ox: 9, oy: 9 };
  const by = Math.min(H - 74, gTop + gh + 16); Object.assign(hintBtn.style, { left: (W + gw) / 2 - 54 + 'px', top: by + 'px' }); Object.assign(scoreEl.style, { left: (W - gw) / 2 + 'px', top: by + 5 + 'px' });
  curWord.style.top = gTop - 2 + 'px';
  redraw();
  paint(SCENES[lv.theme.scene] || SCENES.meadow, (D.seed || level) * 13 + 1);
}
addEventListener('resize', () => lv && layout());
function hud() {
  scoreEl.textContent = '★ ' + (D.isDaily ? dailyScore : score).toLocaleString();
  const hi = hintBtn.querySelector('i'); hi.textContent = hints; hi.classList.toggle('off', !hints);
  ui.progress(lv.words.filter(p => p.found).length / lv.words.length);
}
const cx = (x) => geo.ox + geo.cs * (x + 0.5), cy = (y) => geo.oy + geo.cs * (y + 0.5);
function capsule(x0, y0, x1, y1, color, cls = '') {
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', cx(x0)); l.setAttribute('y1', cy(y0)); l.setAttribute('x2', cx(x1)); l.setAttribute('y2', cy(y1));
  l.setAttribute('stroke', color); l.setAttribute('stroke-width', geo.cs * 0.8); l.setAttribute('stroke-linecap', 'round'); l.setAttribute('opacity', cls === 'live' ? 0.85 : 0.72);
  svg.appendChild(l); return l;
}
function redraw() {
  svg.innerHTML = '';
  for (const p of lv.words) if (p.found) { const n = p.w.length - 1; capsule(p.x0, p.y0, p.x0 + p.dx * n, p.y0 + p.dy * n, p.color); }
  if (sel) capsule(sel.x0, sel.y0, sel.x1, sel.y1, sel.color, 'live');
}

// ---------------------------------------------------------------- swipe input (snaps to 8 directions)
function cellAt(e) {
  const r = gridWrap.getBoundingClientRect(); const x = (e.clientX - r.left - geo.ox) / geo.cs, y = (e.clientY - r.top - geo.oy) / geo.cs;
  return [x, y];
}
function selCells() { const n = Math.max(Math.abs(sel.x1 - sel.x0), Math.abs(sel.y1 - sel.y0)), dx = Math.sign(sel.x1 - sel.x0), dy = Math.sign(sel.y1 - sel.y0); return Array.from({ length: n + 1 }, (_, i) => [sel.x0 + dx * i, sel.y0 + dy * i]); }
function selWord() { return selCells().map(([x, y]) => lv.grid[y][x]).join(''); }
function setEnd(fx_, fy) {
  const dx = fx_ - (sel.x0 + 0.5), dy = fy - (sel.y0 + 0.5), ax = Math.abs(dx), ay = Math.abs(dy);
  let ux = 0, uy = 0, n = 0;
  if (ax > ay * 2.2) { ux = Math.sign(dx); n = Math.round(ax); } else if (ay > ax * 2.2) { uy = Math.sign(dy); n = Math.round(ay); } else { ux = Math.sign(dx); uy = Math.sign(dy); n = Math.round((ax + ay) / 2); }
  // clip to the grid
  while (n > 0 && (sel.x0 + ux * n < 0 || sel.x0 + ux * n >= lv.cols || sel.y0 + uy * n < 0 || sel.y0 + uy * n >= lv.rows)) n--;
  const nx = sel.x0 + ux * n, ny = sel.y0 + uy * n;
  if (nx !== sel.x1 || ny !== sel.y1) { sel.x1 = nx; sel.y1 = ny; soft.click(); buzz(3); }
  paintSel();
}
function paintSel() {
  for (const row of cells) for (const c of row) c.classList.remove('sel');
  if (sel) for (const [x, y] of selCells()) cells[y][x].classList.add('sel');
  if (sel) { curWord.textContent = selWord(); curWord.style.background = sel.color; curWord.classList.add('show'); } else curWord.classList.remove('show');
  redraw();
}
function begin(x, y) { sel = { x0: x, y0: y, x1: x, y1: y, color: CAPS[colorI % CAPS.length] }; soft.click(); paintSel(); }
gridWrap.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return; botPlan = null; gridWrap.setPointerCapture(e.pointerId);
  const [x, y] = cellAt(e).map(Math.floor); if (x < 0 || y < 0 || x >= lv.cols || y >= lv.rows) return;
  begin(x, y);
});
gridWrap.addEventListener('pointermove', (e) => { if (!sel || state !== 'play') return; const [x, y] = cellAt(e); setEnd(x, y); });
const end = () => { if (!sel) return; release(); };
gridWrap.addEventListener('pointerup', end); gridWrap.addEventListener('pointercancel', end);
function release() {
  const w = selWord(), rev = w.split('').reverse().join('');
  const hit = lv.words.find(p => !p.found && (p.w === w || p.w === rev) && matchesPlace(p));
  const s = sel; sel = null;
  if (hit) {
    hit.found = true; hit.color = s.color; colorI++;
    hit.el.style.setProperty('--c', s.color); hit.el.classList.add('f');
    const pts = hit.w.length * 10; score += pts; dailyScore += pts; S.set('score', score);
    const n = hit.w.length - 1, pathCells = Array.from({ length: n + 1 }, (_, i) => [hit.x0 + hit.dx * i, hit.y0 + hit.dy * i]);
    pathCells.forEach(([x, y], i) => setTimeout(() => {
      const c = cells[y][x]; c.classList.remove('pop', 'hint'); void c.offsetWidth; c.classList.add('pop'); chime(i + 2, 72, 0.08);
      const b = c.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', s.color], 4, { speed: 2.2, size: 2.6 });
    }, i * 55));
    buzz(12); hud(); checkBeat();
    const left = lv.words.filter(p => !p.found).length;
    if (hit.w.length >= 7) ui.pop('Superb!', '#ff6b81', 34, 9); else if (left === 1) ui.pop('One more!', '#ff8a3d', 30, 9);
    if (!left) setTimeout(win, n * 55 + 300);
  } else if (w.length > 1) { soft.err(); buzz(20); }
  paintSel();
}
function matchesPlace(p) {
  const n = p.w.length - 1, a = [p.x0, p.y0, p.x0 + p.dx * n, p.y0 + p.dy * n].join();
  return a === [sel.x0, sel.y0, sel.x1, sel.y1].join() || a === [sel.x1, sel.y1, sel.x0, sel.y0].join();
}
function checkBeat() { const s = D.isDaily ? dailyScore : score; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
hintBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); if (state !== 'play' || !hints) return;
  const p = lv.words.find(q => !q.found && !cells[q.y0][q.x0].classList.contains('hint')); if (!p) return;
  hints--; if (hintUsedAt < 0) hintUsedAt = lv.words.filter(q => q.found).length;
  cells[p.y0][p.x0].classList.add('hint'); chime(4, 76, 0.1); hud();
});
function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; B.submit(1); if (!D.isDaily) { if (hintUsedAt < 0) F.level(true); else F.level(false, hintUsedAt / lv.words.length); } }
  const bonus = 20 + lv.words.length * 5; score += bonus; dailyScore += bonus; S.set('score', score); hud();
  arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  [...gridEl.children].forEach((c, i) => setTimeout(() => { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }, ((i % lv.cols) + Math.floor(i / lv.cols)) * 35));
  const shown = D.isDaily ? dailyScore : score;
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyScore > prev.s) S.set(k, { s: dailyScore }); }
  else { level++; S.set('level', level); }
  D.won(shown);
  ui.win(D.isDaily ? '' : level - 1, `${lv.theme.name} · ${lv.words.length} words · ${shown.toLocaleString()} pts`);
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// a finger-less swipe runs letter by letter along the shortest hidden word and circles it (its points are taken back)
demo(() => {
  const p = lv.words.filter(q => !q.found).sort((a, b) => a.w.length - b.w.length)[0]; if (!p || lv.words.filter(q => !q.found).length <= 3) return false;
  const n = p.w.length - 1, s0 = score, d0 = dailyScore; begin(p.x0, p.y0); const mine = sel;
  for (let i = 1; i <= n + 1; i++) setTimeout(() => { if (sel !== mine || state !== 'play') return;
    if (i <= n) return setEnd(p.x0 + p.dx * i + 0.5, p.y0 + p.dy * i + 0.5);
    release(); score = s0; dailyScore = d0; S.set('score', score); hud(); }, i * 130);
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !sel && lv, wait: 2000, max: 1 });

ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot swipes one hidden word over three calls
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyScore : score; },
  bot() {
    if (state !== 'play') return;
    if (!botPlan) { const p = lv.words.find(q => !q.found); if (!p) return; botPlan = { p, step: 0 }; }
    const { p } = botPlan, n = p.w.length - 1;
    if (botPlan.step === 0) { begin(p.x0, p.y0); botPlan.step = 1; }
    else if (botPlan.step === 1) { setEnd(p.x0 + p.dx * n + 0.5, p.y0 + p.dy * n + 0.5); botPlan.step = 2; }
    else { botPlan = null; release(); }
  },
};

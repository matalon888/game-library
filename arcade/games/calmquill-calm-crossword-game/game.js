// Calmquill — original calm crossword. Each level is a small themed crossword with some letters missing;
// drag the wooden letter tiles from the tray into the empty squares. Levels are generated (seeded) from our own
// themed word lists, ranked by how common each word is. Each theme is set against a painted procedural landscape.
import { createUI, store, buzz, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as scoreboard } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { WORDS } from './words.js';
import { THEMES } from './themes.js';

const NAME = 'Calmquill: Calm Crossword Game';
const S = store('calmquill');
const F = flow('calmquill');
const ui = createUI({ title: 'Calmquill', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#c9774a' });
const D = daily('calmquill', ui, { name: NAME });
const B = scoreboard({ game: 'calmquill', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.7 }, mode: 'sum', corner: 'tl' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily crossword' : 'Themed crossword', doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s} pts` : 'Solved today ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Lovely!';

const RANK = new Map(WORDS.map((w, i) => [w, i]));
const rank = (w) => RANK.has(w) ? RANK.get(w) : 6000 + w.length * 100;   // themed words not in the common list come later

// ---------------------------------------------------------------- scenery: procedural painted landscapes
const SCENES = [
  { sky: ['#e9f3ff', '#cfe3f7', '#b4cde8'], sun: '#ffffff', mts: ['#c3d6ea', '#9db8d6', '#7393b9', '#4f6f96'], mist: '#eef6ff', acc: '#4f7fb8' },
  { sky: ['#e2f2ea', '#bfe0cf', '#95c7b0'], sun: '#ffffff', mts: ['#a8d1bb', '#7fb398', '#558f74', '#336650'], mist: '#ecf8f1', acc: '#3f8a66', pines: true },
  { sky: ['#fff0d9', '#ffd9ae', '#f5b98e'], sun: '#fff8e6', mts: ['#f2c49b', '#dea47c', '#bf835f', '#8c5a44'], mist: '#fff0db', acc: '#c46c3c' },
  { sky: ['#f3eaff', '#ddcdf5', '#bfa9e6'], sun: '#fffaf0', mts: ['#cdbbec', '#a993d6', '#826eb5', '#5a4c8a'], mist: '#f4eeff', acc: '#7c5cc9' },
  { sky: ['#e3f6fb', '#bfe6f0', '#93cfe0'], sun: '#ffffff', mts: ['#a9d8e4', '#7fbcd0', '#5596b3', '#33708f'], mist: '#eefaff', acc: '#2f86a8', lake: true },
  { sky: ['#ffeceb', '#f9cfcf', '#eaaab2'], sun: '#fff3ee', mts: ['#eeb3b8', '#d48c98', '#ad6a7a', '#7a4a5c'], mist: '#ffeeee', acc: '#c0566e' },
  { sky: ['#283058', '#414276', '#77659a'], sun: '#fdf3d8', mts: ['#5a588c', '#444478', '#313260', '#1f2148'], mist: '#8a82b6', acc: '#e0a64a', lake: true, night: true },
  { sky: ['#f3f9e2', '#dcefbf', '#b9db9e'], sun: '#ffffff', mts: ['#bddca0', '#93c47e', '#6a9f5f', '#43734c'], mist: '#f3fae8', acc: '#4f8a3e', pines: true },
];
const bg = document.createElement('canvas'); bg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0'; document.body.prepend(bg);
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function paint(sc, seed) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight, r = rngf(seed * 977 + 3);
  bg.width = W * dpr; bg.height = H * dpr; const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = g.createLinearGradient(0, 0, 0, H * 0.62); sc.sky.forEach((c, i) => sk.addColorStop(i / (sc.sky.length - 1), c)); g.fillStyle = sk; g.fillRect(0, 0, W, H);
  if (sc.night) for (let i = 0; i < 110; i++) { g.globalAlpha = 0.3 + r() * 0.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(r() * W, r() * H * 0.55, r() * 1.3 + 0.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const sx = W * (0.2 + r() * 0.6), sy = H * (0.12 + r() * 0.1), sr = Math.min(W, H) * 0.08;
  const glow = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4); glow.addColorStop(0, sc.sun + 'aa'); glow.addColorStop(1, sc.sun + '00'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = sc.sun; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  for (let i = 0; i < 5; i++) { const cx = r() * W, cy = H * (0.06 + r() * 0.3), cw = 60 + r() * 120; g.fillStyle = sc.night ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.4)';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + (k - 2) * cw * 0.22, cy + Math.sin(k * 2) * 4, cw * 0.28, cw * 0.11, 0, 0, 7); g.fill(); } }
  const lakeY = sc.lake ? H * 0.78 : H * 2;
  sc.mts.forEach((col, li) => {
    const base = H * (0.36 + li * 0.11), amp = H * (0.13 - li * 0.018), ph = [r() * 7, r() * 7, r() * 7], f = [1.3 + r(), 3 + r() * 2, 7 + r() * 4];
    const y = (x) => base - amp * (0.55 * Math.sin(x / W * f[0] + ph[0]) + 0.3 * Math.sin(x / W * f[1] * 2 + ph[1]) + 0.15 * Math.abs(Math.sin(x / W * f[2] * 3 + ph[2])));
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 4; x += 4) g.lineTo(x, Math.min(y(x), lakeY)); g.lineTo(W, H); g.closePath(); g.fill();
    if (sc.pines && li >= 2) for (let x = 0; x < W; x += 6 + r() * 10) { const yy = y(x), h = 10 + r() * 16 + li * 4; if (yy > lakeY - 4) continue; g.beginPath(); g.moveTo(x, yy - h); g.lineTo(x + h * 0.28, yy + 2); g.lineTo(x - h * 0.28, yy + 2); g.fill(); }
    const m = g.createLinearGradient(0, base - amp * 0.2, 0, base + H * 0.12); m.addColorStop(0, sc.mist + '00'); m.addColorStop(1, sc.mist + (li < 3 ? '88' : '33')); g.fillStyle = m; g.fillRect(0, base - amp, W, H * 0.25);
  });
  if (sc.lake) {
    const lk = g.createLinearGradient(0, lakeY, 0, H); lk.addColorStop(0, sc.sky[2]); lk.addColorStop(1, sc.mts[3]); g.fillStyle = lk; g.fillRect(0, lakeY, W, H - lakeY);
    g.globalAlpha = 0.5; g.fillStyle = sc.sun; for (let i = 0; i < 9; i++) { const w = sr * (1.4 - i * 0.12); g.fillRect(sx - w / 2, lakeY + 8 + i * 9, w, 2.5); } g.globalAlpha = 1;
  }
  const vg = g.createLinearGradient(0, H * 0.5, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,8,20,.32)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- styles + DOM
const SERIF = "ui-serif,'New York','Iowan Old Style',Georgia,serif";
css(`
body{background:#e6ddd0}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(30,24,40,.6) 0%,rgba(30,24,40,.36) 55%,rgba(30,24,40,.56) 100%)}
.hc-top{z-index:6}
.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-weight:700}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.78)}
.hc-top .hc-bar{background:rgba(255,255,255,.55);height:8px}
#theme{position:fixed;left:0;right:0;z-index:4;text-align:center;pointer-events:none;color:#fff;font-family:${SERIF};font-weight:700;font-size:24px;letter-spacing:.5px;text-shadow:0 2px 12px rgba(0,0,0,.28)}
#theme small{display:block;font-family:-apple-system,system-ui,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;opacity:.85;margin-bottom:1px}
#chips{position:fixed;left:12px;right:12px;z-index:4;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;pointer-events:none}
#chips span{font:700 13px/1 -apple-system,system-ui,sans-serif;letter-spacing:2px;color:#4b3a2c;background:rgba(255,250,240,.82);border-radius:12px;padding:6px 9px 5px;box-shadow:0 2px 8px rgba(40,20,10,.12);transition:background .3s,color .3s}
#chips span.done{background:var(--acc);color:#fff}
#grid{position:fixed;left:0;top:0;z-index:2}
.c{position:absolute;border-radius:20%;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-weight:700;color:#4b3626;transition:background .3s,color .3s,box-shadow .3s}
.c.empty{background:rgba(255,255,255,.28);border:2px dashed rgba(255,255,255,.85);box-shadow:inset 0 2px 8px rgba(40,20,30,.15)}
.c.empty.near{background:rgba(255,255,255,.62);transform:scale(1.06)}
.c.empty.no{animation:nope .35s}
.c.fill{background:linear-gradient(180deg,#fffaf0,#f3e3c6);box-shadow:0 3px 0 #cfae80,0 6px 12px rgba(50,30,10,.18)}
.c.done{background:var(--acc);color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.2),0 6px 14px rgba(0,0,0,.15);text-shadow:0 1px 0 rgba(0,0,0,.2)}
.c.flip{animation:flip .5s cubic-bezier(.3,1.5,.5,1)}
.c.pop{animation:cpop .35s ease-out}
@keyframes flip{0%{transform:rotateY(90deg) scale(.8)}100%{transform:rotateY(0) scale(1)}}
@keyframes cpop{40%{transform:scale(1.16)}}
@keyframes nope{20%{transform:translateX(-5px);background:rgba(255,120,120,.45)}50%{transform:translateX(5px)}80%{transform:translateX(-2px)}}
#tray{position:fixed;z-index:3;border-radius:24px;background:linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,.16));border:1px solid rgba(255,255,255,.55);box-shadow:0 18px 40px -16px rgba(30,15,30,.45);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.t{position:fixed;z-index:5;border-radius:22%;display:flex;align-items:center;justify-content:center;font-family:${SERIF};font-weight:700;color:#4b3626;background:linear-gradient(180deg,#fffaf0,#f1dfbf);box-shadow:0 4px 0 #c9a473,0 8px 14px rgba(50,30,10,.22);touch-action:none;cursor:grab;transition:left .28s cubic-bezier(.3,1.3,.5,1),top .28s cubic-bezier(.3,1.3,.5,1),transform .15s}
.t.drag{transition:none;transform:scale(1.18);z-index:7;box-shadow:0 8px 0 #c9a473,0 18px 26px rgba(50,30,10,.3);cursor:grabbing}
.t.sel{transform:translateY(-8px);box-shadow:0 4px 0 #c9a473,0 0 0 3px var(--acc),0 12px 18px rgba(50,30,10,.25)}
.t.in{animation:tin .4s cubic-bezier(.3,1.5,.5,1) backwards}
@keyframes tin{0%{transform:scale(0)}}
.t sub{position:absolute;right:12%;bottom:8%;font:700 9px -apple-system,system-ui,sans-serif;color:#b08a5a}
.btn{position:fixed;z-index:4;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 6px 18px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0}
.btn svg{width:25px;height:25px;stroke:#3a3042;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.btn i{position:absolute;top:-4px;right:-4px;font-style:normal;background:var(--acc);color:#fff;font-size:11px;font-weight:800;border-radius:10px;padding:1px 6px;min-width:18px;text-align:center;font-family:system-ui}
.btn i.off{background:#9a95a3}
.btn:active{transform:scale(.92)}
#score{position:fixed;z-index:5;right:12px;top:calc(12px + env(safe-area-inset-top));background:rgba(255,255,255,.78);color:#3a3042;border-radius:14px;padding:3px 11px;font:700 15px system-ui,-apple-system,sans-serif;font-variant-numeric:tabular-nums}
`);
const grid = document.createElement('div'); grid.id = 'grid'; document.body.appendChild(grid);
const tray = document.createElement('div'); tray.id = 'tray'; document.body.appendChild(tray);
const themeEl = document.createElement('div'); themeEl.id = 'theme'; document.body.appendChild(themeEl);
const chipsEl = document.createElement('div'); chipsEl.id = 'chips'; document.body.appendChild(chipsEl);
const scoreEl = document.createElement('div'); scoreEl.id = 'score'; document.body.appendChild(scoreEl);
const mkBtn = (svg) => { const b = document.createElement('button'); b.className = 'btn'; b.innerHTML = svg; document.body.appendChild(b); return b; };
const hintBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg><i>3</i>');
const shufBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>');
[hintBtn, shufBtn, grid, tray].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));

// ---------------------------------------------------------------- level generation
function layoutWords(words, r, maxW, maxH) {
  const cells = new Map(), placed = [];
  const key = (x, y) => x + ',' + y;
  const put = (w, x, y, dir) => { for (let i = 0; i < w.length; i++) { const k = key(x + (dir ? 0 : i), y + (dir ? i : 0)); const c = cells.get(k) || { ch: w[i], h: false, v: false }; c[dir ? 'v' : 'h'] = true; cells.set(k, c); } placed.push({ w, x, y, dir }); };
  let bb = { x0: 0, y0: 0, x1: words[0].length - 1, y1: 0 };
  put(words[0], 0, 0, 0);
  for (const w of words.slice(1)) {
    let best = null;
    for (const [k, c] of cells) {
      const [cx, cy] = k.split(',').map(Number);
      for (let i = 0; i < w.length; i++) {
        if (w[i] !== c.ch) continue;
        for (const dir of [0, 1]) {
          if (dir ? c.v : c.h) continue;
          const dx = dir ? 0 : 1, dy = dir ? 1 : 0, sx = cx - i * dx, sy = cy - i * dy;
          if (cells.has(key(sx - dx, sy - dy)) || cells.has(key(sx + w.length * dx, sy + w.length * dy))) continue;
          let ok = true, cross = 0;
          for (let j = 0; j < w.length && ok; j++) {
            const x = sx + j * dx, y = sy + j * dy, e = cells.get(key(x, y));
            if (e) { if (e.ch !== w[j] || (dir ? e.v : e.h)) ok = false; else cross++; }
            else if (cells.has(key(x + dy, y + dx)) || cells.has(key(x - dy, y - dx))) ok = false;
          }
          if (!ok || !cross) continue;
          const nb = { x0: Math.min(bb.x0, sx), y0: Math.min(bb.y0, sy), x1: Math.max(bb.x1, sx + (w.length - 1) * dx), y1: Math.max(bb.y1, sy + (w.length - 1) * dy) };
          const bw = nb.x1 - nb.x0 + 1, bh = nb.y1 - nb.y0 + 1;
          if (bw > maxW || bh > maxH) continue;
          const sc = cross * 6 - (bw * bh) * 0.15 - Math.abs(bw - bh) * 0.4 + r() * 2;
          if (!best || sc > best.sc) best = { sc, sx, sy, dir, nb };
        }
      }
    }
    if (best) { put(w, best.sx, best.sy, best.dir); bb = best.nb; }
  }
  return placed;
}
function makeLevel(seed, lvl, fk) {
  const r = rngf(seed);
  const want = Math.max(3, Math.min(6, Math.round((lvl <= 1 ? 3 : lvl <= 4 ? 4 : lvl <= 12 ? 5 : 6) * fk)));
  const blankFrac = Math.max(0.3, Math.min(0.72, (0.36 + Math.min(lvl, 20) * 0.015) * fk));
  const th = THEMES[(seed * 7 + Math.floor(r() * 1000)) % THEMES.length];
  let best = null;
  for (let a = 0; a < 40; a++) {
    const pool = th.words.map(w => ({ w, k: rank(w) * (0.4 + r() * 1.2) + (lvl <= 3 && w.length > 6 ? 9000 : 0) })).sort((p, q) => p.k - q.k).map(o => o.w).slice(0, want + 5);
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [pool[k], pool[j]] = [pool[j], pool[k]]; }
    const order = pool.sort((x, y) => y.length - x.length + (r() - 0.5) * 2.5);
    const lay = layoutWords(order, r, 7, 8);
    if (lay.length > want) lay.length = want;
    if (!best || lay.length > best.length) best = lay;
    if (lay.length >= want) break;
  }
  let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
  for (const p of best) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + (p.dir ? 0 : p.w.length - 1)); y1 = Math.max(y1, p.y + (p.dir ? p.w.length - 1 : 0)); }
  const words = best.map(p => ({ ...p, x: p.x - x0, y: p.y - y0 }));
  // cells + which ones start empty: every word gets at least one blank, and keeps at least one letter shown
  const cells = new Map();
  for (const w of words) { w.keys = []; for (let i = 0; i < w.w.length; i++) { const x = w.x + (w.dir ? 0 : i), y = w.y + (w.dir ? i : 0), k = x + ',' + y; if (!cells.has(k)) cells.set(k, { x, y, ch: w.w[i], blank: false }); w.keys.push(k); } }
  const all = [...cells.values()];
  const nBlank = Math.max(words.length, Math.round(all.length * blankFrac));
  const shuffled = all.map(c => ({ c, k: r() })).sort((p, q) => p.k - q.k).map(o => o.c);
  for (const c of shuffled.slice(0, nBlank)) c.blank = true;
  for (const w of words) {
    const cs = w.keys.map(k => cells.get(k));
    if (!cs.some(c => c.blank)) cs[Math.floor(r() * cs.length)].blank = true;
    if (cs.every(c => c.blank)) cs[Math.floor(r() * cs.length)].blank = false;
  }
  return { theme: th, words, cells, cols: x1 - x0 + 1, rows: y1 - y0 + 1 };
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = S.get('score', 0), lv, tiles = [], hints = 3, hintsUsed = 0, recorded = false, beatenShown = false, dailyScore = 0, sc;
let geo = { cs: 50, ox: 0, oy: 0, ts: 48 }, sel = null, drag = null, lastBot = 0, busy = 0;

function build() {
  const fk = D.isDaily ? 1 : F.k();
  const seed = D.seed ? D.seed : level * 7349 + 3;
  lv = makeLevel(seed, D.isDaily ? 10 : level, fk);
  sc = SCENES[lv.theme.scene % SCENES.length];
  document.body.style.setProperty('--acc', sc.acc); document.body.style.setProperty('--ui', sc.acc);
  hints = 3; hintsUsed = 0; recorded = false; beatenShown = false; dailyScore = 0; sel = null; drag = null; busy = 0;
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  themeEl.innerHTML = `<small>${D.isDaily ? 'Daily · ' : ''}Theme</small>${lv.theme.icon} ${lv.theme.name}`;
  grid.innerHTML = '';
  for (const c of lv.cells.values()) { c.el = document.createElement('div'); c.el.className = 'c ' + (c.blank ? 'empty' : 'fill'); c.el.textContent = c.blank ? '' : c.ch.toUpperCase(); c.filled = !c.blank; grid.appendChild(c.el); }
  for (const w of lv.words) w.done = false;
  tiles.forEach(t => t.el.remove());
  const r = rngf((D.seed || level) * 31 + 5);
  tiles = [...lv.cells.values()].filter(c => c.blank).map(c => ({ ch: c.ch, r: r() })).sort((a, b) => a.r - b.r).map((o, i) => {
    const el = document.createElement('div'); el.className = 't in'; el.style.animationDelay = i * 40 + 'ms'; el.textContent = o.ch.toUpperCase(); document.body.appendChild(el);
    const t = { ch: o.ch, el }; el.addEventListener('pointerdown', (e) => grab(e, t)); return t;
  });
  layout(); chips(); hud();
}
function layout() {
  if (!lv) return;
  const W = innerWidth, H = innerHeight, safeB = 18;
  // tray at the bottom
  const n = tiles.length, perRow = Math.min(n, W < 500 ? 7 : 9), rows = Math.max(1, Math.ceil(n / perRow));
  const tw = Math.min(W - 24, 560), ts = Math.min(52, (tw - 24) / perRow - 8); geo.ts = ts;
  const th = rows * (ts + 12) + 22, ty = H - th - safeB - 4, tx = (W - tw) / 2;
  Object.assign(tray.style, { left: tx + 'px', top: ty + 'px', width: tw + 'px', height: th + 'px' });
  geo.tray = { tx, ty, tw, th, perRow };
  tiles.forEach((t, i) => { if (t === drag) return; const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), col = i % perRow;
    const x = W / 2 - (inRow * (ts + 8) - 8) / 2 + col * (ts + 8), y = ty + 14 + row * (ts + 12);
    Object.assign(t.el.style, { left: x + 'px', top: y + 'px', width: ts + 'px', height: ts + 'px', fontSize: ts * 0.56 + 'px' }); t.hx = x; t.hy = y; });
  // buttons sit just above the tray, on its edges
  Object.assign(hintBtn.style, { left: tx + tw - 50 + 'px', top: ty - 62 + 'px' });
  Object.assign(shufBtn.style, { left: tx + 'px', top: ty - 62 + 'px' });
  // header: theme + word chips
  const top = 54; themeEl.style.top = top + 'px';
  chipsEl.style.top = top + 54 + 'px';
  const chipsH = chipsEl.getBoundingClientRect().height || 26;
  const gTop = top + 66 + chipsH, gBot = ty - 72, aw = W - 28, ah = gBot - gTop;
  const cs = Math.min(W > 700 ? 66 : 58, aw / lv.cols, ah / lv.rows), gap = cs * 0.1; geo.cs = cs;
  geo.ox = (W - cs * lv.cols) / 2; geo.oy = gTop + (ah - cs * lv.rows) / 2;
  for (const c of lv.cells.values()) Object.assign(c.el.style, { left: geo.ox + c.x * cs + gap / 2 + 'px', top: geo.oy + c.y * cs + gap / 2 + 'px', width: cs - gap + 'px', height: cs - gap + 'px', fontSize: cs * 0.55 + 'px' });
  paint(sc, (D.seed || level) * 31 + 7);
}
addEventListener('resize', layout);
function chips() {
  chipsEl.innerHTML = lv.words.map(w => `<span class="${w.done ? 'done' : ''}">${w.done ? w.w.toUpperCase() : w.w.split('').map((ch, i) => { const c = lv.cells.get(w.keys[i]); return c.filled ? ch.toUpperCase() : '_'; }).join(' ')}</span>`).join('');
}
function hud() {
  scoreEl.textContent = (D.isDaily ? dailyScore : score).toLocaleString();
  const hi = hintBtn.querySelector('i'); hi.textContent = hints; hi.classList.toggle('off', !hints);
  const total = [...lv.cells.values()].filter(c => c.blank).length, done = [...lv.cells.values()].filter(c => c.blank && c.filled).length;
  ui.progress(total ? done / total : 0);
}

// ---------------------------------------------------------------- drag + tap-to-place
function cellAt(px, py, radius = 0.75) {
  let best = null, bd = Infinity;
  for (const c of lv.cells.values()) {
    if (c.filled) continue;
    const cx = geo.ox + (c.x + 0.5) * geo.cs, cy = geo.oy + (c.y + 0.5) * geo.cs, d = Math.hypot(px - cx, py - cy);
    if (d < geo.cs * radius && d < bd) { bd = d; best = c; }
  }
  return best;
}
function grab(e, t) {
  e.stopPropagation(); e.preventDefault();
  if (state !== 'play' || t.placing) return;
  drag = t; t.sx = e.clientX; t.sy = e.clientY; t.moved = false; t.ox = e.clientX - t.hx; t.oy = e.clientY - t.hy;
  t.el.setPointerCapture && t.el.setPointerCapture(e.pointerId);
  soft.click();
}
let nearCell = null;
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const t = drag;
  if (!t.moved && Math.hypot(e.clientX - t.sx, e.clientY - t.sy) > 8) { t.moved = true; t.el.classList.add('drag'); t.el.classList.remove('sel'); if (sel === t) sel = null; }
  if (!t.moved) return;
  // the tile floats above the finger so you can see where it goes
  const x = e.clientX - geo.ts / 2, y = e.clientY - geo.ts * 1.1;
  t.el.style.left = x + 'px'; t.el.style.top = y + 'px';
  const c = cellAt(e.clientX, e.clientY - geo.ts * 0.6, 0.8);
  if (c !== nearCell) { nearCell && nearCell.el.classList.remove('near'); nearCell = c; c && c.el.classList.add('near'); }
});
const release = (e) => {
  if (!drag) return;
  const t = drag; drag = null; t.el.classList.remove('drag');
  nearCell && nearCell.el.classList.remove('near'); const c = nearCell; nearCell = null;
  if (!t.moved) {                                   // a tap: select this tile, the next tap on a square places it
    if (sel === t) { t.el.classList.remove('sel'); sel = null; return; }
    sel && sel.el.classList.remove('sel'); sel = t; t.el.classList.add('sel'); chime(1, 72, 0.06); return;
  }
  if (c) tryPlace(t, c); else backHome(t);
};
addEventListener('pointerup', release); addEventListener('pointercancel', release);
grid.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || !sel) return;
  const c = cellAt(e.clientX, e.clientY, 0.6); if (!c) return;
  const t = sel; sel = null; t.el.classList.remove('sel'); tryPlace(t, c);
});
function backHome(t) { t.el.style.left = t.hx + 'px'; t.el.style.top = t.hy + 'px'; soft.swish(); }
function tryPlace(t, c) {
  if (c.filled || state !== 'play') return backHome(t);
  if (c.ch !== t.ch) {
    c.el.classList.remove('no'); void c.el.offsetWidth; c.el.classList.add('no'); soft.err(); buzz(8);
    return setTimeout(() => backHome(t), 120);
  }
  place(t, c);
}
function place(t, c, viaHint = false) {
  c.filled = true; t.placing = true; busy++;
  const gap = geo.cs * 0.1;
  t.el.style.left = geo.ox + c.x * geo.cs + gap / 2 + 'px'; t.el.style.top = geo.oy + c.y * geo.cs + gap / 2 + 'px';
  t.el.style.width = geo.cs - gap + 'px'; t.el.style.height = geo.cs - gap + 'px'; t.el.style.fontSize = geo.cs * 0.55 + 'px';
  tiles = tiles.filter(o => o !== t);
  setTimeout(() => {
    busy--; t.el.remove();
    c.el.className = 'c fill pop'; c.el.textContent = c.ch.toUpperCase();
    const b = c.el.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', '#ffe7a8', sc.acc], 6, { speed: 2.2, size: 2.4 });
    chime(3 + (score % 5), 70, 0.08); buzz(6);
    const pts = viaHint ? 2 : 10; score += pts; dailyScore += pts; S.set('score', score);
    checkWords(); layout(); chips(); hud(); checkBeat();
  }, 260);
  layout();
}
function checkWords() {
  let newly = 0;
  for (const w of lv.words) {
    if (w.done) continue;
    const cs = w.keys.map(k => lv.cells.get(k));
    if (cs.every(c => c.filled)) {
      w.done = true; newly++;
      cs.forEach((c, i) => setTimeout(() => { c.el.className = 'c done flip'; chime(i + 2, 72, 0.08); }, i * 70));
      const pts = w.w.length * 10; score += pts; dailyScore += pts; S.set('score', score);
    }
  }
  if (newly) { const w = lv.words.filter(o => o.done).slice(-1)[0]; ui.pop(newly > 1 ? 'Double!' : ['Lovely', 'Nice', 'Sweet', 'Calm'][w.w.length % 4], sc.night ? '#ffe7a8' : sc.acc, 32, 40); }
  if (lv.words.every(w => w.done)) setTimeout(win, 650);
}
function checkBeat() { const s = D.isDaily ? dailyScore : score; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
function hint() {
  if (state !== 'play' || !hints || busy) return;
  const target = [...lv.cells.values()].find(c => !c.filled && lv.words.some(w => !w.done && w.keys.includes(c.x + ',' + c.y)));
  if (!target) return;
  const t = tiles.find(o => o.ch === target.ch && !o.placing); if (!t) return;
  hints--; hintsUsed++; if (sel === t) sel = null; t.el.classList.remove('sel'); place(t, target, true); hud();
}
hintBtn.addEventListener('click', (e) => { e.stopPropagation(); hint(); });
shufBtn.addEventListener('click', (e) => {
  e.stopPropagation(); if (state !== 'play' || drag) return;
  for (let k = tiles.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [tiles[k], tiles[j]] = [tiles[j], tiles[k]]; }
  soft.swish(); layout();
});

function win() {
  if (state !== 'play') return;
  state = 'won';
  const blanks = [...lv.cells.values()].filter(c => c.blank).length;
  if (!recorded) { recorded = true; B.submit(1); if (!D.isDaily) { if (!hintsUsed) F.level(true); else F.level(false, Math.max(0, 1 - hintsUsed / Math.max(1, blanks))); } }
  const bonus = 50; score += bonus; dailyScore += bonus; S.set('score', score); hud();
  [...lv.cells.values()].forEach(c => setTimeout(() => { c.el.classList.remove('pop'); void c.el.offsetWidth; c.el.classList.add('pop'); }, (c.x + c.y) * 45));
  arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const shown = D.isDaily ? dailyScore : score;
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyScore > prev.s) S.set(k, { s: dailyScore }); }
  else { level++; S.set('level', level); }
  D.won(shown);
  ui.win(D.isDaily ? '' : level - 1, `${lv.theme.icon} ${lv.theme.name} · ${lv.words.length} words · ${shown.toLocaleString()} pts`);
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot drops one correct tile at a human pace
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyScore : score; },
  bot() {
    if (state !== 'play' || drag || busy) return;
    const now = performance.now(); if (now - lastBot < 420) return; lastBot = now;
    const c = [...lv.cells.values()].find(o => !o.filled); if (!c) return;
    const t = tiles.find(o => o.ch === c.ch && !o.placing); if (!t) return;
    t.el.classList.remove('sel'); if (sel === t) sel = null;
    place(t, c);
  },
};

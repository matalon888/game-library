// Letterloom — original anagram crossword. Swipe across the letter wheel to spell words and fill the crossword above.
// Levels are generated (seeded) from our own common-word list; extra valid words count as bonus words.
// Each level is set against a hand-painted procedural landscape.
import { createUI, store, buzz, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { WORDS } from './words.js';

const NAME = 'Letterloom: Anagram Crossword Puzzle';
const S = store('letterloom');
const F = flow('letterloom');
const ui = createUI({ title: 'Letterloom', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#d9675f' });
const D = daily('letterloom', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily word puzzle' : 'Anagram crossword', doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s} pts` : 'Solved today ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Woven!';

const RANK = new Map(WORDS.map((w, i) => [w, i]));
const DICT = new Set(WORDS);

// ---------------------------------------------------------------- scenery: procedural painted landscapes
const SCENES = [
  { name: 'Quiet Lake', sky: ['#fbe3cf', '#f4bfae', '#c7a9c8'], sun: '#fff4dc', mts: ['#d7a9b4', '#b48aa3', '#86708f', '#5b506e'], mist: '#fbe7dc', acc: '#d9675f', lake: true },
  { name: 'Pine Ridge', sky: ['#d9f0ee', '#b5dfd9', '#8fc3c4'], sun: '#ffffff', mts: ['#9ccbc2', '#74ad a3'.replace(' ', ''), '#4f8a82', '#2f5f5c'], mist: '#e6f6f2', acc: '#2f8f83', pines: true },
  { name: 'Amber Dunes', sky: ['#ffe9c2', '#ffd09a', '#f5a97f'], sun: '#fff7e3', mts: ['#f2bb8a', '#e09a6e', '#c27a58', '#8e5642'], mist: '#ffeacb', acc: '#c8693d' },
  { name: 'Lavender Hills', sky: ['#efe6ff', '#d8c8f5', '#b7a4e6'], sun: '#fffaf0', mts: ['#c6b3ec', '#a48ed6', '#7d69b5', '#56498a'], mist: '#f2ebff', acc: '#7a5fd0', pines: true },
  { name: 'Glacier Bay', sky: ['#e8f4ff', '#c4e0f7', '#9ec4ea'], sun: '#ffffff', mts: ['#b6d3ee', '#8db4dc', '#628fbf', '#3f6a99'], mist: '#eef7ff', acc: '#3d7fc4', lake: true },
  { name: 'Rose Canyon', sky: ['#ffe4e4', '#f7c1c6', '#e59aa6'], sun: '#fff1ec', mts: ['#eaa5ad', '#cf7f8d', '#a85d6f', '#743f55'], mist: '#ffe9ea', acc: '#c24f6b' },
  { name: 'Moonlit Fjord', sky: ['#2c3460', '#45457c', '#7c6a9c'], sun: '#fdf3d8', mts: ['#5d5b8f', '#46467a', '#323462', '#20224a'], mist: '#8c84b8', acc: '#e0a64a', lake: true, night: true },
  { name: 'Tea Terraces', sky: ['#f1f8df', '#d8eeb9', '#b4d99a'], sun: '#ffffff', mts: ['#b9da9c', '#8fc27a', '#669e5c', '#41714a'], mist: '#f2fae6', acc: '#4d8a3f', pines: true },
];
const bg = document.createElement('canvas'); bg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0'; document.body.prepend(bg);
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function paint(sc, seed) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight, r = rngf(seed * 977 + 3);
  bg.width = W * dpr; bg.height = H * dpr; const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = g.createLinearGradient(0, 0, 0, H * 0.62); sc.sky.forEach((c, i) => sk.addColorStop(i / (sc.sky.length - 1), c)); g.fillStyle = sk; g.fillRect(0, 0, W, H);
  if (sc.night) for (let i = 0; i < 90; i++) { g.globalAlpha = 0.3 + r() * 0.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(r() * W, r() * H * 0.5, r() * 1.3 + 0.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const sx = W * (0.25 + r() * 0.5), sy = H * (0.2 + r() * 0.12), sr = Math.min(W, H) * 0.09;
  const glow = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4); glow.addColorStop(0, sc.sun + 'aa'); glow.addColorStop(1, sc.sun + '00'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = sc.sun; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  // soft clouds
  for (let i = 0; i < 4; i++) { const cx = r() * W, cy = H * (0.08 + r() * 0.3), cw = 60 + r() * 120; g.fillStyle = sc.night ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.35)';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + (k - 2) * cw * 0.22, cy + Math.sin(k * 2) * 4, cw * 0.28, cw * 0.11, 0, 0, 7); g.fill(); } }
  const lakeY = sc.lake ? H * 0.8 : H * 2;
  sc.mts.forEach((col, li) => {
    const base = H * (0.38 + li * 0.1), amp = H * (0.13 - li * 0.018), ph = [r() * 7, r() * 7, r() * 7], f = [1.3 + r(), 3 + r() * 2, 7 + r() * 4];
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
  const vg = g.createLinearGradient(0, H * 0.55, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,8,20,.28)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- styles + DOM
css(`
body{background:#e9dccf}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(28,20,44,.62) 0%,rgba(28,20,44,.38) 55%,rgba(28,20,44,.55) 100%)}
.hc-top{z-index:6}
.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-weight:700}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.75)}
.hc-top .hc-bar{background:rgba(255,255,255,.55);height:8px}
.hc-sub{top:calc(50px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;text-shadow:0 1px 6px rgba(0,0,0,.25)}
#board{position:fixed;left:0;top:0;z-index:2;pointer-events:none}
.t{position:absolute;border-radius:22%;background:rgba(255,255,255,.5);border:1.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1px rgba(60,30,50,.2),inset 0 2px 6px rgba(60,30,50,.12),0 2px 10px rgba(40,20,40,.1);display:flex;align-items:center;justify-content:center;font-family:ui-serif,'New York',Georgia,serif;font-weight:700;color:#fff;transition:background .25s,transform .25s}
.t.on{background:var(--acc);border-color:rgba(255,255,255,.35);box-shadow:0 4px 0 rgba(0,0,0,.14),0 6px 16px rgba(0,0,0,.12);text-shadow:0 1px 0 rgba(0,0,0,.18)}
.t.hint{color:var(--acc);background:rgba(255,255,255,.88)}
.t.flip{animation:flip .45s cubic-bezier(.3,1.5,.5,1)}
.t.glow{animation:glow .6s ease}
@keyframes flip{0%{transform:scale(.3) rotate(-12deg)}100%{transform:scale(1) rotate(0)}}
@keyframes glow{40%{transform:scale(1.18);filter:brightness(1.25)}}
#wheel{position:fixed;z-index:3;touch-action:none}
#wheel .disc{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.97),rgba(250,246,242,.9));box-shadow:0 18px 50px -12px rgba(30,15,40,.45),inset 0 -6px 18px rgba(0,0,0,.05)}
#wheel svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.L{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:ui-serif,'New York',Georgia,serif;font-weight:700;color:#2d2433;transform:translate(-50%,-50%);transition:transform .15s,background .15s,color .15s;pointer-events:none}
.L.on{background:var(--acc);color:#fff;transform:translate(-50%,-50%) scale(1.08)}
#word{position:fixed;left:50%;z-index:4;transform:translateX(-50%);background:var(--acc);color:#fff;font-family:ui-serif,'New York',Georgia,serif;font-weight:700;font-size:26px;letter-spacing:3px;padding:4px 18px 3px;border-radius:14px;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;transition:opacity .15s;pointer-events:none;white-space:nowrap}
#word.show{opacity:1}#word.bad{animation:shake .35s}#word.old{background:#8b8794}#word.bonus{background:#e2a33b}
@keyframes shake{20%{transform:translateX(calc(-50% - 7px))}40%{transform:translateX(calc(-50% + 7px))}60%{transform:translateX(calc(-50% - 4px))}80%{transform:translateX(calc(-50% + 3px))}}
.btn{position:fixed;z-index:4;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 6px 18px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0}
.btn svg{width:26px;height:26px;stroke:#3a3042;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.btn i{position:absolute;top:-4px;right:-4px;font-style:normal;background:var(--acc);color:#fff;font-size:11px;font-weight:800;border-radius:10px;padding:1px 6px;min-width:18px;text-align:center}
.btn i.off{background:#9a95a3}
.btn:active{transform:scale(.92)}
#score{position:fixed;z-index:5;right:12px;top:calc(56px + env(safe-area-inset-top));background:rgba(255,255,255,.75);color:#3a3042;border-radius:14px;padding:3px 11px;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}
`);
const board = document.createElement('div'); board.id = 'board'; document.body.appendChild(board);
const wheel = document.createElement('div'); wheel.id = 'wheel'; wheel.innerHTML = '<div class="disc"></div><svg><polyline fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'; document.body.appendChild(wheel);
const line = wheel.querySelector('polyline');
const wordEl = document.createElement('div'); wordEl.id = 'word'; document.body.appendChild(wordEl);
const scoreEl = document.createElement('div'); scoreEl.id = 'score'; document.body.appendChild(scoreEl);
const mkBtn = (svg) => { const b = document.createElement('button'); b.className = 'btn'; b.innerHTML = svg; document.body.appendChild(b); return b; };
const shuffleBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>');
const hintBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg><i>3</i>');
const bonusBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg><i>0</i>');
bonusBtn.style.display = 'none';

// ---------------------------------------------------------------- level generation
const counts = (w) => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
const fits = (w, pool) => { const c = {}; for (const ch of w) { c[ch] = (c[ch] || 0) + 1; if (c[ch] > (pool[ch] || 0)) return false; } return true; };
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
          const sc = cross * 6 - (bw * bh) * 0.15 - Math.abs(bw - bh * 1.1) * 0.6 + r() * 2;
          if (!best || sc > best.sc) best = { sc, sx, sy, dir, nb };
        }
      }
    }
    if (best) { put(w, best.sx, best.sy, best.dir); bb = best.nb; }
  }
  return { placed, bb };
}
function makeLevel(seed, lvl, fk) {
  const r = rngf(seed);
  const L = lvl <= 2 ? 4 : lvl <= 8 ? 5 : lvl <= 22 ? 6 : 7;
  const want = Math.max(3, Math.min(L === 4 ? 5 : L === 5 ? 7 : L === 6 ? 9 : 11, Math.round((L === 4 ? 3.4 : L === 5 ? 4.8 : L === 6 ? 6.5 : 8) * fk)));
  const pool = WORDS.slice(0, 2600).filter(w => w.length === L);
  for (let tries = 0; tries < 400; tries++) {
    const base = pool[Math.floor(r() * pool.length)], pc = counts(base);
    const subs = WORDS.filter(w => w.length >= 3 && w.length <= L && fits(w, pc));
    if (subs.length < want + (L > 4 ? 1 : 0)) continue;
    // common words first (with a little randomness), always including the wheel word
    const ranked = subs.filter(w => w !== base).map(w => ({ w, k: RANK.get(w) * (0.6 + r() * 0.8) })).sort((a, b) => a.k - b.k).map(o => o.w);
    let bestLay = null;
    for (let a = 0; a < 6; a++) {
      const pick = [base, ...ranked.slice(0, want + 3)].slice(0, want + 3);
      const order = [pick[0], ...pick.slice(1).sort((x, y) => y.length - x.length + (r() - 0.5) * 1.5)];
      const lay = layoutWords(order, r, Math.max(L + 1, 8), 9);
      if (lay.placed.length > want) lay.placed.length = want;   // trim to the target size (the last ones placed are leaves)
      if (!bestLay || lay.placed.length > bestLay.placed.length) bestLay = lay;
      if (lay.placed.length >= want) break;
    }
    if (bestLay.placed.length < Math.min(want, 3)) continue;
    // recompute bbox after trimming
    let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    for (const p of bestLay.placed) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + (p.dir ? 0 : p.w.length - 1)); y1 = Math.max(y1, p.y + (p.dir ? p.w.length - 1 : 0)); }
    const letters = base.split(''); for (let k = letters.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [letters[k], letters[j]] = [letters[j], letters[k]]; }
    if (letters.join('') === base) letters.reverse();
    return { base, letters, words: bestLay.placed.map(p => ({ ...p, x: p.x - x0, y: p.y - y0 })), cols: x1 - x0 + 1, rows: y1 - y0 + 1, subs: new Set(subs) };
  }
  return null;
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = S.get('score', 0), lv, found, bonus, hints, hintUsedAt, cellsEl, tileMap, sel = [], dragging = false, recorded = false, beatenShown = false, sc, dailyScore = 0;
let geo = { R: 110, cx: 0, cy: 0, lr: 30 }, letterPos = [], botPlan = null;

function build() {
  const fk = D.isDaily ? 1 : F.k();
  const seed = D.seed ? D.seed : level * 6151 + 11;
  const L = D.isDaily ? 12 : level;
  lv = makeLevel(seed, L, fk) || makeLevel(seed + 1, 3, 1);
  sc = SCENES[(D.isDaily ? (D.seed % SCENES.length) : (level - 1)) % SCENES.length];
  document.body.style.setProperty('--acc', sc.acc); document.body.style.setProperty('--ui', sc.acc);
  found = new Set(); bonus = new Set(); hints = 3; hintUsedAt = -1; recorded = false; beatenShown = false; dailyScore = 0; sel = []; botPlan = null;
  ui.levels(D.isDaily ? 1 : level); ui.progress(0); ui.sub(D.isDaily ? 'Daily · ' + sc.name : sc.name); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  board.innerHTML = ''; tileMap = new Map();
  for (const w of lv.words) for (let i = 0; i < w.w.length; i++) {
    const x = w.x + (w.dir ? 0 : i), y = w.y + (w.dir ? i : 0), k = x + ',' + y;
    if (!tileMap.has(k)) { const t = document.createElement('div'); t.className = 't'; board.appendChild(t); tileMap.set(k, { el: t, x, y, ch: w.w[i], shown: false }); }
  }
  for (const w of lv.words) w.cells = Array.from(w.w, (_, i) => tileMap.get((w.x + (w.dir ? 0 : i)) + ',' + (w.y + (w.dir ? i : 0))));
  wheel.querySelectorAll('.L').forEach(e => e.remove());
  lv.letters.forEach(ch => { const e = document.createElement('div'); e.className = 'L'; e.textContent = ch.toUpperCase(); wheel.appendChild(e); });
  layout(); hud();
}
function layout() {
  const W = innerWidth, H = innerHeight, top = 82;
  const R = Math.min(118, W * 0.3, H * 0.15); geo.R = R; geo.cx = W / 2; geo.cy = H - R - Math.max(34, H * 0.05);
  const n = lv.letters.length; geo.lr = Math.min(R * 0.3, (2 * Math.PI * R * 0.66) / n / 2.5);
  Object.assign(wheel.style, { left: geo.cx - R + 'px', top: geo.cy - R + 'px', width: 2 * R + 'px', height: 2 * R + 'px' });
  letterPos = lv.letters.map((_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [R + Math.cos(a) * R * 0.66, R + Math.sin(a) * R * 0.66]; });
  wheel.querySelectorAll('.L').forEach((e, i) => Object.assign(e.style, { left: letterPos[i][0] + 'px', top: letterPos[i][1] + 'px', width: geo.lr * 2 + 'px', height: geo.lr * 2 + 'px', fontSize: geo.lr * 1.25 + 'px' }));
  line.setAttribute('stroke-width', Math.max(8, geo.lr * 0.42)); line.setAttribute('stroke', getComputedStyle(document.body).getPropertyValue('--acc'));
  const bottom = geo.cy - R - 66, aw = W - 28, ah = bottom - top;
  const cs = Math.min(64, aw / lv.cols, ah / lv.rows), gap = cs * 0.1, ox = (W - cs * lv.cols) / 2, oy = top + (ah - cs * lv.rows) / 2;
  for (const t of tileMap.values()) Object.assign(t.el.style, { left: ox + t.x * cs + gap / 2 + 'px', top: oy + t.y * cs + gap / 2 + 'px', width: cs - gap + 'px', height: cs - gap + 'px', fontSize: cs * 0.56 + 'px' });
  wordEl.style.top = geo.cy - R - 50 + 'px';
  const by = geo.cy + R * 0.35;
  Object.assign(shuffleBtn.style, { left: Math.max(10, geo.cx - R - 66) + 'px', top: by + 'px' });
  Object.assign(hintBtn.style, { left: Math.min(W - 62, geo.cx + R + 14) + 'px', top: by + 'px' });
  Object.assign(bonusBtn.style, { left: Math.max(10, geo.cx - R - 66) + 'px', top: geo.cy - R + 6 + 'px' });
  paint(sc, (D.seed || level) * 31 + 7);
}
addEventListener('resize', () => lv && layout());
function hud() {
  scoreEl.textContent = (D.isDaily ? dailyScore : score).toLocaleString();
  const hi = hintBtn.querySelector('i'); hi.textContent = hints; hi.classList.toggle('off', !hints);
  bonusBtn.style.display = bonus.size ? 'flex' : 'none'; bonusBtn.querySelector('i').textContent = bonus.size;
  ui.progress(found.size / lv.words.length);
}

// ---------------------------------------------------------------- swipe input
const current = () => sel.map(i => lv.letters[i]).join('');
function drawLine(px, py) {
  const pts = sel.map(i => letterPos[i].join(','));
  if (px !== undefined && sel.length) pts.push(px + ',' + py);
  line.setAttribute('points', pts.join(' '));
  wheel.querySelectorAll('.L').forEach((e, i) => e.classList.toggle('on', sel.includes(i)));
  const w = current(); wordEl.textContent = w.toUpperCase(); wordEl.className = w ? 'show' : '';
}
function hit(px, py) { for (let i = 0; i < letterPos.length; i++) if (Math.hypot(px - letterPos[i][0], py - letterPos[i][1]) < geo.lr * 1.05) return i; return -1; }
function addLetter(i) {
  if (i < 0) return;
  if (sel.length >= 2 && sel[sel.length - 2] === i) { sel.pop(); soft.click(); return; }
  if (sel.includes(i)) return;
  sel.push(i); chime(sel.length - 1, 67, 0.1); buzz(5);
}
const local = (e) => { const r = wheel.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
wheel.addEventListener('pointerdown', (e) => { if (state !== 'play') return; botPlan = null; dragging = true; wheel.setPointerCapture(e.pointerId); const [x, y] = local(e); sel = []; addLetter(hit(x, y)); drawLine(x, y); });
wheel.addEventListener('pointermove', (e) => { if (!dragging) return; const [x, y] = local(e); addLetter(hit(x, y)); drawLine(x, y); });
const end = () => { if (!dragging) return; dragging = false; submit(); };
wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);

function reveal(w, stagger = 70) {
  w.cells.forEach((t, i) => setTimeout(() => {
    if (!t.shown) { t.shown = true; t.el.textContent = t.ch.toUpperCase(); t.el.classList.remove('hint'); t.el.classList.add('on'); t.el.classList.remove('flip'); void t.el.offsetWidth; t.el.classList.add('flip');
      const b = t.el.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', '#ffe08a', sc.acc], 5, { speed: 2.2, size: 2.6 }); }
    else { t.el.classList.remove('glow'); void t.el.offsetWidth; t.el.classList.add('glow'); }
    chime(i + 2, 72, 0.09);
  }, i * stagger));
}
function submit() {
  const w = current(); const finish = (cls, ms = 380) => { wordEl.className = 'show ' + cls; setTimeout(() => { sel = []; drawLine(); }, ms); };
  if (w.length < 2) { sel = []; drawLine(); return; }
  const target = lv.words.find(o => o.w === w);
  if (target && !found.has(w)) {
    found.add(w); const pts = w.length * 10; score += pts; dailyScore += pts; S.set('score', score);
    reveal(target); buzz(12);
    if (w.length >= 5) ui.pop(w.length >= 6 ? 'BRILLIANT' : 'SPLENDID', '#fff', 32, 40);
    finish(''); hud(); checkBeat();
    if (found.size === lv.words.length) setTimeout(win, w.length * 70 + 350);
    return;
  }
  if (target) { reveal(target, 40); ui.pop('Already found', '#fff', 22, 40); return finish('old'); }
  if (w.length >= 3 && DICT.has(w) && lv.subs.has(w)) {
    if (bonus.has(w)) { ui.pop('Already found', '#fff', 22, 40); return finish('old'); }
    bonus.add(w); score += w.length * 3; dailyScore += w.length * 3; S.set('score', score); hud(); checkBeat();
    const b = bonusBtn.getBoundingClientRect(); fx.sparks(b.left + 26, b.top + 26, ['#ffd36e', '#fff'], 14, { speed: 3 });
    arp([79, 84, 88], 60, 0.09); ui.pop('Bonus word +' + w.length * 3, '#ffe08a', 24, 40); return finish('bonus', 450);
  }
  soft.err(); return finish('bad', 360);
}
function checkBeat() { const s = D.isDaily ? dailyScore : score; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
shuffleBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (state !== 'play' || dragging) return; botPlan = null;
  const idx = lv.letters.map((_, i) => i); for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  lv.letters = idx.map(i => lv.letters[i]); wheel.querySelectorAll('.L').forEach((el, i) => { el.textContent = lv.letters[i].toUpperCase(); el.style.transform = 'translate(-50%,-50%) rotate(-180deg) scale(.5)'; setTimeout(() => el.style.transform = '', 30); });
  soft.swish(); sel = []; drawLine();
});
hintBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (state !== 'play' || !hints) return;
  const open = lv.words.filter(o => !found.has(o.w));
  for (const o of open) { const t = o.cells.find(c => !c.shown && !c.el.classList.contains('hint')); if (t) { t.el.textContent = t.ch.toUpperCase(); t.el.classList.add('hint', 'flip'); hints--; if (hintUsedAt < 0) hintUsedAt = found.size; chime(4, 76, 0.1); hud(); return; } }
});
bonusBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); ui.pop([...bonus].join(' · ').toUpperCase() || 'No bonus words yet', '#fff', 18, 46); });

function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; if (!D.isDaily) { if (hintUsedAt < 0) F.level(true); else F.level(false, hintUsedAt / lv.words.length); } }
  const bonusPts = 50; score += bonusPts; dailyScore += bonusPts; S.set('score', score); hud();
  const all = [...tileMap.values()]; all.forEach((t, i) => setTimeout(() => { t.el.classList.remove('glow'); void t.el.offsetWidth; t.el.classList.add('glow'); }, (t.x + t.y) * 45));
  arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const shown = D.isDaily ? dailyScore : score;
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyScore > prev.s) S.set(k, { s: dailyScore }); }
  else { level++; S.set('level', level); }
  D.won(shown);
  ui.win(D.isDaily ? '' : level - 1, `${lv.words.length} words${bonus.size ? ` · ${bonus.size} bonus` : ''} · ${shown.toLocaleString()} pts`);
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot swipes an unfound word one letter per call
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyScore : score; },
  bot() {
    if (state !== 'play' || dragging) return;
    if (!botPlan) {
      const o = lv.words.find(w => !found.has(w.w)); if (!o) return;
      const used = new Set(); botPlan = []; for (const ch of o.w) { const i = lv.letters.findIndex((c, k) => c === ch && !used.has(k)); used.add(i); botPlan.push(i); }
      sel = [];
    }
    if (sel.length < botPlan.length) { addLetter(botPlan[sel.length]); const p = letterPos[sel[sel.length - 1]]; drawLine(p[0], p[1]); }
    else { botPlan = null; submit(); }
  },
};

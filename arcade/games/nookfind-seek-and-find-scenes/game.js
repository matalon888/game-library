// Nookfind — original seek-and-find game. Cozy scenes are painted in code from hundreds of shapes; find every item
// on the list in the tray. Pinch / wheel to zoom, drag to look around, tap to collect. Calm: no timer, no lives.
import { createUI, store, buzz, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as scoreboard } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { KINDS, NAMES, drawItem } from './items.js';
import { THEMES, WW, HH, drawCover } from './scenes.js';

const NAME = 'Nookfind: Seek and Find Scenes';
const S = store('nookfind');
const F = flow('nookfind');
const ui = createUI({ title: 'Nookfind', hint: 'Tap to start', hand: '', score: false });
cardTheme({ accent: '#e07a5f' });
const D = daily('nookfind', ui, { name: NAME });
const B = scoreboard({ game: 'nookfind', label: 'Scenes completed', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum', corner: 'tl' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily scene' : 'Seek & find', doneLine: doneToday ? (D.isDaily ? `Found it all today · ${doneToday.s} pts` : 'Daily scene done ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily scene<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'All found!';

// ---------------------------------------------------------------- DOM
css(`
body{background:var(--side,#e9dccf)}
#scene{position:fixed;left:0;top:0;z-index:1;touch-action:none;cursor:grab}
.hc-top{z-index:6}
.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.2);font-weight:700}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.85)}
.hc-top .hc-bar{background:rgba(255,255,255,.7);height:9px;box-shadow:0 1px 6px rgba(0,0,0,.15)}
.hc-sub{top:calc(50px + env(safe-area-inset-top));left:50%;right:auto;transform:translateX(-50%);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-weight:800;color:#fff;background:rgba(61,43,36,.72);border-radius:10px;padding:3px 10px 2px;text-shadow:none;white-space:nowrap}
.hc-pop{color:#fff!important;text-shadow:0 2px 0 #3d2b24,0 0 14px rgba(40,20,10,.55)!important}
#tray{position:fixed;left:0;right:0;bottom:0;z-index:5;padding:10px 10px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(180deg,#fffaf2,#f6ead8);border-top:3px solid #3d2b24;border-radius:22px 22px 0 0;box-shadow:0 -6px 24px rgba(40,20,10,.22)}
#tray .head{display:flex;justify-content:space-between;align-items:center;color:#5a4236;font-weight:800;font-size:13px;letter-spacing:.5px;margin:0 auto 6px;max-width:520px;padding:0 6px}
#tray .head b{color:#e07a5f}
#chips{display:flex;gap:7px;justify-content:center}
.chip{position:relative;flex:1 1 0;max-width:76px;height:66px;border-radius:16px;background:#fff;border:2px solid #e6d6c2;display:flex;align-items:center;justify-content:center;transition:transform .2s,background .3s}
.chip canvas{width:46px;height:46px}
.chip i{position:absolute;right:-5px;bottom:-6px;font-style:normal;background:#3d2b24;color:#fff;font-size:13px;font-weight:800;border-radius:11px;padding:1px 7px;min-width:22px;text-align:center;font-family:system-ui,sans-serif}
.chip.bump{animation:bump .35s cubic-bezier(.3,1.6,.5,1)}
.chip.done{background:#e6f6ea;border-color:#7cc47a}
.chip.done canvas{opacity:.35}
.chip.done i{display:none}
.chip.done::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#2d8a52;font-size:30px;font-weight:900}
@keyframes bump{40%{transform:scale(1.18)}}
.rbtn{position:fixed;z-index:5;width:54px;height:54px;border-radius:50%;background:#fffaf2;border:3px solid #3d2b24;box-shadow:0 5px 0 rgba(61,43,36,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.rbtn svg{width:26px;height:26px;stroke:#3d2b24;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.rbtn i{position:absolute;top:-6px;right:-6px;font-style:normal;background:#e07a5f;color:#fff;font-size:12px;font-weight:800;border-radius:10px;padding:1px 6px;font-family:system-ui,sans-serif}
.rbtn i.off{background:#9a95a3}
.rbtn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(61,43,36,.35)}
#found{position:fixed;z-index:5;left:12px;padding:5px 12px;border-radius:14px;background:rgba(255,250,242,.92);border:2px solid #3d2b24;color:#3d2b24;font-weight:800;font-size:14px;font-family:system-ui,sans-serif}
`);
const cv = document.createElement('canvas'); cv.id = 'scene'; document.body.prepend(cv); const g = cv.getContext('2d');
const tray = document.createElement('div'); tray.id = 'tray'; tray.innerHTML = '<div class="head"><span>Find these</span><span data-n></span></div><div id="chips"></div>'; document.body.appendChild(tray);
const chipsEl = tray.querySelector('#chips');
const mkBtn = (svg) => { const b = document.createElement('button'); b.className = 'rbtn'; b.innerHTML = svg; b.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(b); return b; };
const hintBtn = mkBtn('<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M10.5 7.5v6M7.5 10.5h6" stroke-width="2"/></svg><i>3</i>');
const fitBtn = mkBtn('<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>');
const foundEl = document.createElement('div'); foundEl.id = 'found'; document.body.appendChild(foundEl);
tray.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- level
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const bake = document.createElement('canvas'); let RES = 2.2;
const side = document.createElement('canvas');
function paintSide() { side.width = Math.ceil(innerWidth / 2); side.height = Math.ceil(innerHeight / 2); const x = side.getContext('2d'), k = Math.max(side.width / WW, side.height / HH);
  x.filter = 'blur(14px)'; x.drawImage(bake, (side.width - WW * k) / 2, (side.height - HH * k) / 2, WW * k, HH * k); x.filter = 'none'; x.fillStyle = 'rgba(40,25,15,.28)'; x.fillRect(0, 0, side.width, side.height); }
let state = 'ready', level = S.get('level', 1), score = S.get('score', 0), dailyScore = 0, lv = null, recorded = false, beatenShown = false;
let hints = 3, hintRing = null, lastFind = 0, t0 = 0, flies = [], botStep = 0;

function makeLevel(seed, L, fk) {
  const r = rngf(seed * 2654435761 + 97);
  const theme = THEMES[(D.isDaily ? seed : L - 1) % THEMES.length];
  RES = Math.min(2.2, 4000 / HH);
  bake.width = WW * RES; bake.height = HH * RES; const bg = bake.getContext('2d'); bg.setTransform(RES, 0, 0, RES, 0, 0); bg.lineJoin = 'round'; bg.lineCap = 'round';
  const sc = theme(bg, r);
  const nk = Math.max(3, Math.min(6, 3 + Math.floor((L - 1) / 2)));
  const total = Math.round(Math.max(6, Math.min(20, (6 + L * 0.9) * fk)));
  const rad = Math.max(16, Math.min(26, 27 - L * 0.7)) / Math.sqrt(fk);
  const decoyN = Math.round(Math.max(22, Math.min(60, (22 + L * 2.5) * fk)));
  const kinds = KINDS.slice(); for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const want = kinds.slice(0, nk), rest = kinds.slice(nk);
  const counts = want.map(() => 1); for (let i = nk; i < total; i++) counts[Math.floor(r() * nk)]++;
  const area = sc.spots.reduce((a, s) => a + s.w * s.h * s.wt, 0), placed = [];
  const place = (rr) => { for (let t = 0; t < 400; t++) { let a = r() * area, sp = sc.spots[0]; for (const s of sc.spots) { a -= s.w * s.h * s.wt; if (a <= 0) { sp = s; break; } }
      const x = sp.x + r() * sp.w, y = sp.y + r() * sp.h; if (x < rr + 8 || x > WW - rr - 8 || y < 150 || y > HH - rr - 6) continue;
      if (placed.some(p => Math.hypot(p.x - x, p.y - y) < (p.r + rr) * 1.1)) continue; placed.push({ x, y, r: rr }); return { x, y }; } return null; };
  const targets = [];
  want.forEach((k, ki) => { for (let c = 0; c < counts[ki]; c++) { const r0 = rad * (0.85 + r() * 0.3), p = place(r0); if (!p) continue;
    targets.push({ kind: k, x: p.x, y: p.y, r: r0, rot: (r() - 0.5) * 1.1, found: false, cover: r() < 0.38 ? { dx: (r() - 0.5) * r0 * 1.2, dy: r0 * (0.35 + r() * 0.3), s: r0 * (1.1 + r() * 0.3), rot: (r() - 0.5) * 0.6 } : null }); } });
  const decoys = []; for (let i = 0; i < decoyN; i++) { const r0 = rad * (0.8 + r() * 0.45), p = place(r0); if (p) decoys.push({ kind: rest[Math.floor(r() * rest.length)], x: p.x, y: p.y, r: r0, rot: (r() - 0.5) * 1.2, wob: 0 }); }
  const list = want.map(k => ({ kind: k, left: targets.filter(t => t.kind === k).length })).filter(o => o.left > 0);
  return { sc, targets, decoys, list, total: targets.length };
}

// ---------------------------------------------------------------- camera
const cam = { s: 1, tx: 0, ty: 0, minS: 1, maxS: 3, aim: null };
let VW = 0, VH = 0, TRAY = 120;
function viewSize() { TRAY = tray.offsetHeight || 120; VW = innerWidth; VH = innerHeight - TRAY + 18; }
function clampCam() {
  const w = WW * cam.s, h = HH * cam.s;
  cam.tx = w <= VW ? (VW - w) / 2 : Math.min(0, Math.max(VW - w, cam.tx));
  cam.ty = h <= VH ? (VH - h) / 2 : Math.min(0, Math.max(VH - h, cam.ty));
}
function fit() {
  viewSize(); const contain = Math.min(VW / WW, VH / HH), cover = Math.max(VW / WW, VH / HH);
  cam.minS = contain; cam.s = cover / contain < 1.3 ? cover : contain; cam.maxS = Math.max(cam.s, contain) * 3.2;
  cam.tx = (VW - WW * cam.s) / 2; cam.ty = (VH - HH * cam.s) / 2; clampCam();
}
function zoomAt(px, py, ns) { ns = Math.max(cam.minS, Math.min(cam.maxS, ns)); const wx = (px - cam.tx) / cam.s, wy = (py - cam.ty) / cam.s; cam.s = ns; cam.tx = px - wx * ns; cam.ty = py - wy * ns; clampCam(); }
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  viewSize(); if (lv) { const old = cam.s; fit(); if (old > cam.s) cam.s = old; clampCam(); paintSide(); }
  Object.assign(hintBtn.style, { right: '14px', bottom: TRAY + 14 + 'px' }); Object.assign(fitBtn.style, { right: '78px', bottom: TRAY + 14 + 'px' });
  foundEl.style.bottom = TRAY + 26 + 'px';
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- tray
let chipMap = new Map();
const icon = (kind) => { const c = document.createElement('canvas'); c.width = c.height = 92; const x = c.getContext('2d'); drawItem(x, kind, 46, 48, 36, 0); return c; };
function buildTray() {
  chipsEl.innerHTML = ''; chipMap = new Map();
  for (const o of lv.list) { const d = document.createElement('div'); d.className = 'chip'; d.appendChild(icon(o.kind)); const i = document.createElement('i'); i.textContent = o.left; d.appendChild(i); chipsEl.appendChild(d); chipMap.set(o.kind, { el: d, badge: i, o });
    d.addEventListener('pointerdown', e => { e.stopPropagation(); ui.pop(`${NAMES[o.kind]}${o.left ? ` · ${o.left} left` : ' ✓'}`, '#fff', 22, 70); soft.click(); }); }
}
function hud() {
  const f = lv.targets.filter(t => t.found).length;
  ui.progress(f / lv.total); tray.querySelector('[data-n]').innerHTML = `<b>${f}</b> / ${lv.total}`;
  const hi = hintBtn.querySelector('i'); hi.textContent = hints; hi.classList.toggle('off', !hints);
  foundEl.textContent = `★ ${(D.isDaily ? dailyScore : score).toLocaleString()}`;
}

function build() {
  const fk = D.isDaily ? 1 : F.k();
  const L = D.isDaily ? 7 : level, seed = D.seed ? D.seed : level * 7919 + 13;
  lv = makeLevel(seed, L, fk);
  document.body.style.setProperty('--side', lv.sc.side);
  hints = 3; hintRing = null; flies = []; recorded = false; beatenShown = false; dailyScore = 0; lastFind = 0; botStep = 0;
  ui.levels(D.isDaily ? 1 : level); ui.sub(D.isDaily ? 'Daily · ' + lv.sc.name : lv.sc.name);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  buildTray(); resize(); fit(); hud();
}

// ---------------------------------------------------------------- input: drag to pan, pinch / wheel to zoom, tap to find
const pts = new Map(); let gesture = null;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 1) gesture = { kind: 'tap', x: e.clientX, y: e.clientY, t: performance.now() };
  else if (pts.size === 2) { const [a, b] = [...pts.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s }; }
  cam.aim = null;
});
cv.addEventListener('pointermove', e => {
  const p = pts.get(e.pointerId); if (!p || !gesture) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (gesture.kind === 'pinch' && pts.size >= 2) { const [a, b] = [...pts.values()]; zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, gesture.s * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, gesture.d)); return; }
  if (gesture.kind === 'tap' && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 9) { gesture.kind = 'pan'; cv.style.cursor = 'grabbing'; }
  if (gesture.kind === 'pan') { cam.tx += dx; cam.ty += dy; clampCam(); }
});
const up = e => {
  if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); cv.style.cursor = 'grab';
  if (gesture && gesture.kind === 'tap' && pts.size === 0) tap(e.clientX, e.clientY);
  if (pts.size === 0) gesture = null; else if (gesture && gesture.kind === 'pinch') gesture = { kind: 'pan' };
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); cam.aim = null; zoomAt(e.clientX, e.clientY, cam.s * Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
let lastTap = 0;
function tap(x, y) {
  if (state !== 'play') return;
  const now = performance.now(); const wx = (x - cam.tx) / cam.s, wy = (y - cam.ty) / cam.s;
  let best = null, bd = 1e9;
  for (const t of lv.targets) { if (t.found) continue; const d = Math.hypot(t.x - wx, t.y - wy), lim = Math.max(t.r * 1.2, 20 / cam.s); if (d < lim && d < bd) { bd = d; best = t; } }
  if (best) return collect(best);
  for (const d of lv.decoys) if (Math.hypot(d.x - wx, d.y - wy) < Math.max(d.r * 1.1, 14 / cam.s)) { d.wob = 1; soft.wood(); fx.ring(x, y, 'rgba(255,255,255,.8)', 14); return; }
  if (now - lastTap < 320) { zoomAt(x, y, cam.s < cam.maxS * 0.6 ? cam.s * 1.8 : cam.minS); lastTap = 0; return; }   // double tap zooms
  lastTap = now; fx.ring(x, y, 'rgba(255,255,255,.7)', 10); soft.click();
}

// ---------------------------------------------------------------- find
function collect(t) {
  t.found = true; const now = performance.now(), sx = cam.tx + t.x * cam.s, sy = cam.ty + t.y * cam.s;
  const quick = lastFind && now - lastFind < 2600; lastFind = now;
  const pts2 = 10 + (quick ? 5 : 0); score += pts2; dailyScore += pts2; S.set('score', score);
  const ch = chipMap.get(t.kind), rc = ch.el.getBoundingClientRect();
  flies.push({ t, x0: sx, y0: sy, x1: rc.left + rc.width / 2, y1: rc.top + rc.height / 2, r0: t.r * cam.s, start: now, ch });
  fx.ring(sx, sy, '#fff', t.r * cam.s * 1.2); fx.sparks(sx, sy, ['#fff', '#ffd23f', '#e07a5f'], 12, { speed: 3.2, size: 3 });
  const f = lv.targets.filter(q => q.found).length; chime(f + 1, 72, 0.11); buzz(10);
  if (hintRing && hintRing.t === t) hintRing = null;
  if (quick && f > 1) ui.pop(f % 3 === 0 ? 'Sharp eye!' : 'Quick find +5', '#fff', 24, 15);
  hud(); checkBeat();
  if (f === lv.total) setTimeout(win, 750);
}
function landed(fl) {
  const o = fl.ch.o; o.left--; fl.ch.badge.textContent = o.left; fl.ch.el.classList.remove('bump'); void fl.ch.el.offsetWidth; fl.ch.el.classList.add('bump');
  fx.sparks(fl.x1, fl.y1, ['#ffd23f', '#fff'], 6, { speed: 2, size: 2.5 });
  if (!o.left) { fl.ch.el.classList.add('done'); arp([76, 81, 88], 70, 0.09); }
}
function checkBeat() { const s = D.isDaily ? dailyScore : score; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }

hintBtn.addEventListener('click', e => {
  e.stopPropagation(); if (state !== 'play') return;
  if (!hints) { ui.pop('No hints left', '#fff', 22, 70); soft.err(); return; }
  const open = lv.targets.filter(t => !t.found); if (!open.length) return;
  const t = open[Math.floor(Math.random() * open.length)]; hints--; hintRing = { t, start: performance.now() };
  cam.aim = { wx: t.x, wy: t.y, s: Math.min(cam.maxS, Math.max(cam.s, cam.minS * 1.6)) }; note(84, 0.5, 0.1); setTimeout(() => note(91, 0.6, 0.08), 90); hud();
});
fitBtn.addEventListener('click', e => { e.stopPropagation(); cam.aim = null; fit(); soft.swish(); });

function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; B.submit(1, { ms: performance.now() - t0 }); if (!D.isDaily) F.level(true); }
  const bonus = 50 + hints * 10; score += bonus; dailyScore += bonus; S.set('score', score); hud();
  arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const shown = D.isDaily ? dailyScore : score, secs = Math.round((performance.now() - t0) / 1000);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyScore > prev.s) S.set(k, { s: dailyScore }); }
  else { level++; S.set('level', level); }
  D.won(shown);
  ui.win(D.isDaily ? '' : level - 1, `${lv.total} items · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} · ${shown.toLocaleString()} pts`);
}
ui.onTap(which => {
  B.start(); t0 = performance.now();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});

// ---------------------------------------------------------------- render
const ease = t => 1 - Math.pow(1 - t, 3);
function frame(now) {
  requestAnimationFrame(frame); if (!lv) return;
  if (cam.aim) { const a = cam.aim; cam.s += (a.s - cam.s) * 0.12; const ax = VW / 2 - a.wx * cam.s, ay = VH / 2 - a.wy * cam.s; cam.tx += (ax - cam.tx) * 0.16; cam.ty += (ay - cam.ty) * 0.16; clampCam(); if (Math.abs(a.s - cam.s) < 0.003 && Math.abs(ax - cam.tx) < 1 && Math.abs(ay - cam.ty) < 1) cam.aim = null; }
  const dpr = cv.width / innerWidth; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (WW * cam.s < VW - 2) g.drawImage(side, 0, 0, innerWidth, innerHeight); else { g.fillStyle = lv.sc.side; g.fillRect(0, 0, innerWidth, innerHeight); }
  g.save(); g.translate(cam.tx, cam.ty); g.scale(cam.s, cam.s);
  if (WW * cam.s < VW - 2) { g.save(); g.shadowColor = 'rgba(30,15,10,.35)'; g.shadowBlur = 30; g.fillStyle = '#000'; g.fillRect(0, 0, WW, HH); g.restore(); }
  g.drawImage(bake, 0, 0, WW, HH);
  for (const d of lv.decoys) { if (d.wob > 0) d.wob = Math.max(0, d.wob - 0.04); shadow(d); drawItem(g, d.kind, d.x, d.y, d.r, d.rot + Math.sin(d.wob * 18) * d.wob * 0.3); }
  for (const t of lv.targets) if (!t.found) { shadow(t); drawItem(g, t.kind, t.x, t.y, t.r, t.rot); }
  for (const t of lv.targets) if (t.cover && !t.found) drawCover(g, lv.sc.cover, t.x + t.cover.dx, t.y + t.cover.dy, t.cover.s, t.cover.rot);
  if (hintRing) { const k = (now - hintRing.start) / 1000; if (k > 4) hintRing = null; else { const t = hintRing.t, pr = t.r * (1.6 + 0.35 * Math.sin(k * 7)); g.beginPath(); g.arc(t.x, t.y, pr, 0, 7); g.lineWidth = 5 / cam.s * 1.4; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke(); g.lineWidth = 2.5 / cam.s * 1.4; g.strokeStyle = '#e07a5f'; g.stroke(); } }
  g.restore();
  // items flying to the tray, in screen space
  for (let i = flies.length - 1; i >= 0; i--) {
    const f = flies[i], k = Math.min(1, (now - f.start) / 620), e = ease(k);
    const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 70, r = f.r0 * (1 + Math.sin(k * Math.PI) * 0.7) * (1 - k) + 20 * k;
    if (k < 0.25) { g.beginPath(); g.arc(f.x0, f.y0, f.r0 * (1.3 + k * 2), 0, 7); g.lineWidth = 3; g.strokeStyle = `rgba(255,255,255,${1 - k * 4})`; g.stroke(); }
    drawItem(g, f.t.kind, x, y, r, f.t.rot * (1 - e));
    if (k >= 1) { landed(f); flies.splice(i, 1); }
  }
}
function shadow(o) { g.save(); g.globalAlpha = 0.16; g.beginPath(); g.ellipse(o.x + o.r * 0.1, o.y + o.r * 0.85, o.r * 0.8, o.r * 0.22, 0, 0, 7); g.fillStyle = '#2b1d16'; g.fill(); g.restore(); }
requestAnimationFrame(frame);
build();

// ---------------------------------------------------------------- test hook: the bot looks at an unfound item, zooms in a little, then taps it
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyScore : score; },
  bot() {
    if (state !== 'play') return;
    const t = lv.targets.find(q => !q.found); if (!t) return;
    botStep++;
    if (botStep % 3 === 1) { cam.aim = { wx: t.x, wy: t.y, s: Math.min(cam.maxS, cam.minS * (1.25 + Math.random() * 0.5)) }; return; }
    if (botStep % 3 === 0) { cam.aim = null; clampCam(); tap(cam.tx + t.x * cam.s, cam.ty + t.y * cam.s); }
  },
};

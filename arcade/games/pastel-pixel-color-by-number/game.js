// Pastel Pixel: Color by Number — kawaii pixel art coloured by number (tap to fill, drag to paint the matching cells,
// pinch / wheel to zoom), no timer and no fail state. Finished pictures pop up as 3D jelly voxels, go into a sticker
// album and unlock new packs. A daily picture with a streak (free weekly freeze) and a spoiler-free share line.
// Style B · Kawaii Pop. Pictures: 8 hand-made + 61 pixel maps built from our kawaii library props (tools/build-pics.cjs).
import { store } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';
import { PICS, PACKS, byId, dayNum, addDays, fromNum, setNo, dailyPic } from './pics.js';
import { popUp, stopPop, warm } from './voxel.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Pastel Pixel: Color by Number';
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const Q = new URLSearchParams(location.search);
const TODAY = dayNum();
const week = n => Math.floor((setNo(n) + 3) / 7);
const CH = 'abcdefghijklmnopqrstuvwxyz';
const thumb = id => `assets/thumbs/${id}.webp`;
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };

// ---------------------------------------------------------------- saved state
const S = store('pastelpixel');
const sg = (k, d) => { try { return S.get(k, d); } catch (e) { return d; } };
const st = {
  fills: sg('fills', {}), done: sg('done', {}), ms: sg('ms', {}), finds: sg('finds', {}),
  streak: sg('streak', { n: 0, best: 0, last: 0, freeWeek: -1, extra: 0, frozen: [] }), daily: sg('daily', {}), packsPaid: sg('packsPaid', []), seenPacks: sg('seenPacks', ['starter']),
};
const save = (...ks) => { for (const k of (ks.length ? ks : Object.keys(st))) try { S.set(k, st[k]); } catch (e) {} };
const finished = () => Object.keys(st.done).length;
const unlocked = pk => finished() >= PACKS.find(p => p.id === pk).need;
const fillOf = pic => st.fills[pic.id] || [...pic.px].map(c => c === '.' ? '.' : '0').join('');
const progress = pic => { const f = st.fills[pic.id]; if (st.done[pic.id]) return 1; if (!f) return 0; let n = 0; for (const c of f) if (c === '1') n++; return n / pic.cells; };

// ---------------------------------------------------------------- kit layers
const F = flow('pastelpixel');                // colouring has no fail state and no skill knob (FLOW_BRIEF rule 4): records only
const D = daily('pastelpixel', null, { name: NAME });
const B = worldBoard({ game: 'pastel-pixel', label: 'Pictures coloured', limits: { maxRun: 1, maxPerSec: 0.25 }, mode: 'sum', corner: 'tr', accent: '#ff79b8' });
const M = money({ game: 'pastel-pixel', style: 'B', onAdStart: () => { snd.music(false); snd.pause(true); }, onAdEnd: () => { snd.pause(false); if (!snd.muted) snd.music(true); } });

// ---------------------------------------------------------------- previews (gallery cards, album stickers)
// unfinished cells show as a soft grey version of their colour, so the shape reads without spoiling the palette
function preview(cv, pic, fill, full = false) {
  const s = Math.max(1, Math.floor(160 / Math.max(pic.w, pic.h)));
  cv.width = pic.w * s; cv.height = pic.h * s; const x = cv.getContext('2d');
  for (let i = 0; i < pic.px.length; i++) { const c = pic.px[i]; if (c === '.') continue;
    const col = pic.pal[c.charCodeAt(0) - 97];
    if (full || (fill && fill[i] === '1')) x.fillStyle = col;
    else { const l = lum(col), g = Math.round(150 + l * 90); x.fillStyle = `rgb(${g - 4},${g - 14},${Math.min(255, g + 12)})`; }
    x.fillRect((i % pic.w) * s, Math.floor(i / pic.w) * s, s, s); }
}

// ---------------------------------------------------------------- DOM
const home = $(`<div id="home"><div class="wrap">
  <div class="hd"><div class="logo outline">Pastel <span>Pixel</span><small>COLOR BY NUMBER</small></div>
    <div class="right"><button class="chip" data-shop aria-label="Coins and shop"><span class="coin"></span><b data-coins>0</b><span class="plus">+</span></button></div></div>
  <div class="chips"><button class="chip" data-streak><span class="ic">🔥</span><b>0</b></button><button class="chip" data-streak2><span class="ic">🧊</span><b>1</b></button><button class="chip" data-count><span class="ic">🎨</span><b>0</b></button><button class="chip" data-mute aria-label="Sound"><span class="ic">🔊</span></button></div>
  <div class="scroll"><button class="daily" data-daily></button><div class="packs"></div><div class="packhd"></div><div class="grid"></div></div>
</div>
<div class="nav"><button data-nav="gallery"><img src="${thumb('g05')}" alt="">Gallery</button><button data-nav="album"><img src="${thumb('t09')}" alt="">Album</button><button data-nav="shop"><img src="${thumb('x01')}" alt="">Shop</button></div></div>`);
const play = $(`<div id="play" class="hide">
  <div class="ph"><button class="round" data-back aria-label="Back">‹</button><div class="ttl"><b></b><div class="pbar"><i></i></div></div><button class="chip" data-shop aria-label="Coins"><span class="coin"></span><b data-coins>0</b></button></div>
  <canvas id="cv"></canvas>
  <div class="tools"><button class="tool" data-find aria-label="Find a cell">🔍<small></small></button><button class="tool" data-bucket aria-label="Fill this colour">🪣<small><span class="coin"></span>30</small></button><button class="tool" data-fit aria-label="Fit">⤢</button></div>
  <div class="pal"></div>
</div>`);
document.body.append(home, play);
const cv = play.querySelector('#cv'), cx = cv.getContext('2d'), palEl = play.querySelector('.pal'), toolsEl = play.querySelector('.tools');
const coinEls = () => document.querySelectorAll('[data-coins]');
const paintCoins = () => coinEls().forEach(e => e.textContent = M.coins().toLocaleString());
M.onChange(paintCoins);
document.querySelectorAll('[data-shop]').forEach(b => b.onclick = () => { snd.pop(); M.shop(); });
const muteIc = home.querySelector('[data-mute] .ic'); muteIc.textContent = snd.muted ? '🔇' : '🔊';
home.querySelector('[data-mute]').onclick = () => { const m = snd.toggle(); muteIc.textContent = m ? '🔇' : '🔊'; if (!m) snd.music(true); };
home.querySelector('[data-streak]').onclick = home.querySelector('[data-streak2]').onclick = () => streakCard();
home.querySelector('[data-count]').onclick = () => albumCard();
home.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { snd.pop(); ({ gallery: () => home.querySelector('.scroll').scrollTo({ top: 0, behavior: 'smooth' }), album: () => albumCard(), shop: () => M.shop() })[b.dataset.nav](); });
play.querySelector('[data-back]').onclick = () => { snd.untap(); goHome(); };
addEventListener('pointerdown', () => { snd.init(); if (!snd.muted) snd.music(true); }, { once: true });

// ---------------------------------------------------------------- fx
const fx = document.getElementById('fx'), fctx = fx.getContext('2d'); let parts = [];
function fxSize() { fx.width = innerWidth * Math.min(2, devicePixelRatio); fx.height = innerHeight * Math.min(2, devicePixelRatio); fx.style.width = innerWidth + 'px'; fx.style.height = innerHeight + 'px'; }
fxSize(); addEventListener('resize', fxSize);
const FXC = ['#ff79b8', '#ffd24d', '#7fe3c0', '#9fd2ff', '#c3a3ff', '#ffffff', '#ffb3d6'];
function burst(x, y, n = 20, { speed = 6, colors = FXC, size = 1, kinds = 'heart star dot' } = {}) {
  const ks = kinds.split(' ');
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * (0.35 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, r: (4 + Math.random() * 6) * size, k: ks[i % ks.length], c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .3, life: 1, decay: .012 + Math.random() * .01 }); }
}
function rain(n = 90) { for (let i = 0; i < n; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .6, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, r: 5 + Math.random() * 7, k: ['heart', 'star', 'rect', 'dot'][i % 4], c: FXC[i % 7], rot: Math.random() * 6, vr: (Math.random() - .5) * .2, life: 1, decay: .004, sway: 1 }); }
function fxTick() {
  const k = fx.width / innerWidth; fctx.setTransform(k, 0, 0, k, 0, 0); fctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) { p.vy += .18; p.vx *= .985; p.x += p.vx + (p.sway ? Math.sin(p.y / 40) * .6 : 0); p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
    const x = fctx; x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.globalAlpha = Math.min(1, p.life * 1.6); x.fillStyle = p.c; const r = p.r;
    if (p.k === 'heart') { x.beginPath(); x.moveTo(0, r * .35); x.bezierCurveTo(-r, -r * .4, -r * .45, -r * 1.05, 0, -r * .45); x.bezierCurveTo(r * .45, -r * 1.05, r, -r * .4, 0, r * .35); x.fill(); }
    else if (p.k === 'star') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.fill(); }
    else if (p.k === 'rect') x.fillRect(-r * .6, -r * .3, r * 1.2, r * .6); else { x.beginPath(); x.arc(0, 0, r * .5, 0, 7); x.fill(); }
    x.restore(); }
}
function toast(t) { const e = $(`<div class="toast"></div>`); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2300); }

// ---------------------------------------------------------------- streak (daily picture) with a free weekly freeze
const freezes = () => (st.streak.freeWeek !== week(TODAY) ? 1 : 0) + st.streak.extra;
function streakNow() {
  const s = st.streak; if (!s.last) return { n: 0, safe: true };
  const gap = Math.round((fromNum(TODAY) - fromNum(s.last)) / 864e5);
  if (gap <= 1) return { n: s.n, safe: true };
  return gap - 1 <= freezes() ? { n: s.n, safe: true, frozen: gap - 1 } : { n: 0, safe: false, lost: s.n };
}
function streakOnDaily() {
  const s = st.streak; if (s.last === TODAY) return 0; let used = 0;
  const gap = s.last ? Math.round((fromNum(TODAY) - fromNum(s.last)) / 864e5) : 1;
  if (gap > 1) { const missed = gap - 1; if (missed <= freezes()) { for (let i = 1; i <= missed; i++) { s.frozen.push(addDays(s.last, i)); if (s.freeWeek !== week(TODAY)) s.freeWeek = week(TODAY); else s.extra--; used++; } } else s.n = 0; }
  s.n++; s.best = Math.max(s.best, s.n); s.last = TODAY; s.frozen = s.frozen.slice(-30); save('streak'); return used;
}

// ---------------------------------------------------------------- gallery
let view = 'home', pack = sg('pack', 'starter'), state = 'ready', ov = null, ovKind = null;
function setView(v) { view = v; home.classList.toggle('hide', v !== 'home'); play.classList.toggle('hide', v !== 'play'); document.body.classList.toggle('playing', v === 'play'); }
function paintHome() {
  const sn = streakNow(), dp = dailyPic(TODAY), dd = !!st.daily[TODAY];
  home.querySelector('[data-streak] b').textContent = dd ? st.streak.n : sn.n; home.querySelector('[data-streak2] b').textContent = freezes();
  home.querySelector('[data-count] b').textContent = finished();
  const dEl = home.querySelector('[data-daily]');
  dEl.innerHTML = `<canvas></canvas><div class="tx"><div class="k">Daily pixel · #${setNo(TODAY)}</div><b>${dd ? dp.name + ' ✓' : 'Today’s picture'}</b><span>${dd ? `Done! New one at midnight · 🔥 ${st.streak.n}` : `${dp.cells} pixels · ${dp.pal.length} colours · keeps your 🔥`}</span><br><span class="btn ${dd ? 'soft' : 'pink'}">${dd ? 'Share 💌' : progress(dp) > 0 ? 'Continue ▸' : 'Color it ▸'}</span></div>`;
  preview(dEl.querySelector('canvas'), dp, st.fills[dp.id], st.done[dp.id] && dd);
  dEl.onclick = () => { snd.tap(); if (dd) share(); else open(dp.id, true); };
  home.querySelector('.packs').innerHTML = PACKS.map(p => `<button class="${p.id === pack ? 'on' : ''} ${unlocked(p.id) ? '' : 'lock'}" data-pk="${p.id}"><img src="${thumb(p.icon)}" alt="">${p.name}${unlocked(p.id) ? '' : ' 🔒'}</button>`).join('');
  home.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { snd.tap(); pack = b.dataset.pk; try { S.set('pack', pack); } catch (e) {} paintHome(); });
  const P = PACKS.find(p => p.id === pack), list = PICS.filter(p => p.pack === pack), nDone = list.filter(p => st.done[p.id]).length;
  home.querySelector('.packhd').innerHTML = `<b>${P.name}</b><span>${nDone}/${list.length} coloured</span>`;
  const grid = home.querySelector('.grid');
  if (!unlocked(pack)) { grid.innerHTML = `<div class="lockmsg"><b>🔒 ${P.name}</b>Colour ${P.need - finished()} more picture${P.need - finished() === 1 ? '' : 's'} to unlock this pack.</div>`; return; }
  grid.innerHTML = list.map(p => { const pr = progress(p), d = !!st.done[p.id];
    return `<button class="card ${d ? 'done' : ''}" data-id="${p.id}"><canvas></canvas>${p.size !== 'Small' && !d ? `<span class="badge ${p.size === 'Big' ? 'big' : ''}">${p.size}</span>` : ''}${pr > 0 ? `<span class="ring" style="--p:${Math.round(pr * 100)}%"><i>${d ? '✓' : Math.floor(pr * 100)}</i></span>` : ''}<b>${p.name}</b><span>${p.cells} px · ${p.pal.length} colours</span></button>`; }).join('');
  grid.querySelectorAll('.card').forEach(c => { const p = byId[c.dataset.id]; preview(c.querySelector('canvas'), p, st.fills[p.id], !!st.done[p.id]); c.onclick = () => { snd.tap(); open(p.id); }; });
  paintCoins();
}
function goHome() { saveFill(true); closeOv(); stopPop(); state = 'ready'; cur = null; setView('home'); paintHome(); }

// ---------------------------------------------------------------- play
let cur = null, sel = 0, vw = { s: 10, ox: 0, oy: 0 }, need = [], dirty = false, saveT = 0, tOpen = 0, streakN = 0, pulse = 0, flash = null, findRing = null;
function open(id, isDaily = false) {
  const pic = byId[id]; closeOv();
  cur = { pic, fill: [...fillOf(pic)], isDaily: isDaily || (dailyPic(TODAY).id === id && !st.daily[TODAY]) };
  if (st.done[id]) cur.fill = [...pic.px].map(c => c === '.' ? '.' : '1');
  cur.replay = !!st.done[id];
  if (cur.replay) cur.fill = [...pic.px].map(c => c === '.' ? '.' : '0');       // colour it again from scratch
  state = 'play'; tOpen = performance.now(); setView('play');
  play.querySelector('.ttl b').textContent = pic.name;
  M.level(finished() + 1);
  need = pic.pal.map((_, k) => 0); pic.px.split('').forEach((c, i) => { if (c !== '.' && cur.fill[i] !== '1') need[c.charCodeAt(0) - 97]++; });
  sel = need.findIndex(n => n > 0); if (sel < 0) sel = 0;
  buildPal(); resize(); fit(); paintTools(); paintProg();
}
function resize() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio); cv.width = r.width * d; cv.height = r.height * d; toolsEl.style.top = (r.bottom - 66) + 'px'; }
addEventListener('resize', () => { if (view === 'play') { resize(); fit(); } });
function fit() {
  const r = cv.getBoundingClientRect(), { w, h } = cur.pic;
  const s = Math.min((r.width - 28) / w, (r.height - 96) / h, 60);
  // small cells are hard to tap: start a bit zoomed on phones for big pictures (pinch / ⤢ to see it all)
  vw.s = s; vw.ox = (r.width - w * s) / 2; vw.oy = (r.height - 70 - h * s) / 2 + 4;
  if (s < 16 && r.width < 600) zoomAt(r.width / 2, r.height / 2, 20 / s);
}
function zoomAt(px, py, f) { const ns = Math.max(4, Math.min(80, vw.s * f)); f = ns / vw.s; vw.ox = px - (px - vw.ox) * f; vw.oy = py - (py - vw.oy) * f; vw.s = ns; clampView(); }
function clampView() { const r = cv.getBoundingClientRect(), { w, h } = cur.pic, W = w * vw.s, H = h * vw.s, m = 60;
  vw.ox = Math.min(r.width - m, Math.max(m - W, vw.ox)); vw.oy = Math.min(r.height - m, Math.max(m - H, vw.oy)); }
function buildPal() {
  palEl.innerHTML = cur.pic.pal.map((c, k) => `<button class="sw" data-k="${k}" aria-label="Colour ${k + 1}"><span class="in" style="background:${c}"></span><svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="26.5" fill="none" stroke="rgba(150,110,210,.18)" stroke-width="4"/><circle class="arc" cx="29" cy="29" r="26.5" fill="none" stroke="#ff79b8" stroke-width="4" stroke-linecap="round" stroke-dasharray="166.5" stroke-dashoffset="166.5"/></svg><span class="n" style="color:${lum(c) > 0.62 ? '#4b2a6e' : '#fff'}">${k + 1}</span></button>`).join('');
  palEl.querySelectorAll('.sw').forEach(b => b.onclick = () => { selectColour(+b.dataset.k); snd.tap(+b.dataset.k); });
  paintPal();
}
function paintPal() {
  const tot = cur.pic.pal.map(() => 0); for (const c of cur.pic.px) if (c !== '.') tot[c.charCodeAt(0) - 97]++;
  palEl.querySelectorAll('.sw').forEach((b, k) => { const done = tot[k] - need[k]; b.classList.toggle('on', k === sel); b.classList.toggle('fin', need[k] === 0);
    b.querySelector('.arc').setAttribute('stroke-dashoffset', 166.5 * (1 - done / tot[k])); b.querySelector('.n').textContent = need[k] === 0 ? '✓' : k + 1; });
}
function selectColour(k) { sel = k; paintPal(); const b = palEl.children[k]; if (b) b.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' }); }
function paintProg() { const left = need.reduce((a, b) => a + b, 0); play.querySelector('.pbar i').style.width = ((1 - left / cur.pic.cells) * 100) + '%'; }
function paintTools() { const f = st.finds[cur.pic.id] ?? 3; play.querySelector('[data-find] small').innerHTML = f > 0 ? f : '<span class="coin"></span>10'; }

function draw() {
  if (view !== 'play' || !cur) return;
  const d = cv.width / cv.getBoundingClientRect().width, { pic, fill } = cur, { s, ox, oy } = vw, W = cv.width / d, H = cv.height / d;
  cx.setTransform(d, 0, 0, d, 0, 0); cx.clearRect(0, 0, W, H);
  // the board: a white rounded card under the picture
  cx.save(); cx.shadowColor = 'rgba(120,60,190,.18)'; cx.shadowBlur = 24; cx.shadowOffsetY = 8; cx.fillStyle = '#fff';
  const pad = Math.max(8, s * 0.6); rr(ox - pad, oy - pad, pic.w * s + pad * 2, pic.h * s + pad * 2, Math.max(16, s)); cx.fill(); cx.restore();
  const x0 = Math.max(0, Math.floor(-ox / s)), y0 = Math.max(0, Math.floor(-oy / s)), x1 = Math.min(pic.w, Math.ceil((W - ox) / s)), y1 = Math.min(pic.h, Math.ceil((H - oy) / s));
  const showNum = s >= 11, hl = 0.5 + 0.5 * Math.sin(pulse * 4);
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = `700 ${Math.round(s * 0.5)}px Fredoka, Nunito, sans-serif`;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * pic.w + x, c = pic.px[i]; if (c === '.') continue;
    const k = c.charCodeAt(0) - 97, v = fill[i], X = ox + x * s, Y = oy + y * s;
    if (v === '1') {
      cx.fillStyle = pic.pal[k]; cx.fillRect(X, Y, s + 0.5, s + 0.5);
      if (s >= 9) { cx.fillStyle = 'rgba(255,255,255,.28)'; cx.fillRect(X + s * 0.14, Y + s * 0.12, s * 0.42, s * 0.16); cx.fillStyle = 'rgba(0,0,0,.06)'; cx.fillRect(X, Y + s * 0.84, s, s * 0.16); }
      continue;
    }
    const l = lum(pic.pal[k]), g = Math.round(236 + l * 14);
    const isSel = k === sel;
    cx.fillStyle = isSel ? `rgb(${Math.round(196 - hl * 16)},${Math.round(186 - hl * 16)},${Math.round(212 - hl * 12)})` : `rgb(${g - 4},${g - 10},${Math.min(255, g + 6)})`;
    cx.fillRect(X, Y, s + 0.5, s + 0.5);
    if (v !== '0') { cx.globalAlpha = 0.55; cx.fillStyle = pic.pal[v.charCodeAt(0) - 97]; cx.fillRect(X + s * 0.12, Y + s * 0.12, s * 0.76, s * 0.76); cx.globalAlpha = 1; }
    if (showNum) { cx.fillStyle = isSel ? '#4b2a6e' : v !== '0' ? '#6a4a8e' : '#a891c6'; cx.fillText(k + 1, X + s / 2, Y + s / 2 + 1); }
  }
  if (s >= 8) { cx.strokeStyle = 'rgba(140,110,200,.16)'; cx.lineWidth = 1; cx.beginPath();
    for (let x = x0; x <= x1; x++) { cx.moveTo(ox + x * s, oy + y0 * s); cx.lineTo(ox + x * s, oy + y1 * s); }
    for (let y = y0; y <= y1; y++) { cx.moveTo(ox + x0 * s, oy + y * s); cx.lineTo(ox + x1 * s, oy + y * s); } cx.stroke(); }
  if (findRing) { const k = Math.min(1, (performance.now() - findRing.t) / 1400); cx.strokeStyle = `rgba(255,79,154,${1 - k})`; cx.lineWidth = 4; cx.beginPath(); cx.arc(ox + (findRing.x + .5) * s, oy + (findRing.y + .5) * s, s * (0.8 + k * 2.5), 0, 7); cx.stroke(); if (k >= 1) findRing = null; }
  if (flash) { const k = Math.min(1, (performance.now() - flash) / 700); cx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; cx.fillRect(0, 0, W, H); if (k >= 1) flash = null; }
}
function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

function fillCell(i, k, drag = false) {
  const { pic, fill } = cur, c = pic.px[i];
  if (c === '.' || fill[i] === '1' || state !== 'play') return false;
  const want = c.charCodeAt(0) - 97;
  if (want !== k) { if (drag) return false; fill[i] = CH[k]; snd.untap(); dirty = true; return false; }
  fill[i] = '1'; need[k]--; dirty = true; streakN++;
  if (streakN % 2 === 0) snd.paint(streakN / 2);
  if (need[k] === 0) colourDone(k);
  paintProg();
  if (need.every(n => n === 0)) finish();
  return true;
}
function colourDone(k) {
  snd.good(k % 4); paintPal();
  const b = palEl.children[k]; if (b) { const r = b.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 16, { colors: [cur.pic.pal[k], '#fff', '#ffd24d'] }); }
  const nx = need.findIndex((n, j) => n > 0 && j > k), any = need.findIndex(n => n > 0);
  if (any >= 0) setTimeout(() => selectColour(nx >= 0 ? nx : any), 250);
}
function saveFill(force = false) { if (!cur || !dirty) return; clearTimeout(saveT); const go = () => { if (!cur) return; st.fills[cur.pic.id] = cur.fill.join(''); st.ms[cur.pic.id] = (st.ms[cur.pic.id] || 0) + (performance.now() - tOpen); tOpen = performance.now(); save('fills', 'ms'); dirty = false; }; if (force) go(); else saveT = setTimeout(go, 700); }

// ---------------------------------------------------------------- input: tap fills, drag paints matching cells, two fingers / wheel zoom
const ptrs = new Map(); let gest = null;
const cellAt = (x, y) => { const r = cv.getBoundingClientRect(), gx = Math.floor((x - r.left - vw.ox) / vw.s), gy = Math.floor((y - r.top - vw.oy) / vw.s); return gx >= 0 && gy >= 0 && gx < cur.pic.w && gy < cur.pic.h ? gy * cur.pic.w + gx : -1; };
cv.addEventListener('pointerdown', e => {
  if (!cur) return; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
  const i = cellAt(e.clientX, e.clientY), pan = e.button === 1 || e.button === 2 || i < 0 || cur.pic.px[i] === '.' || spaceDown;
  gest = { mode: pan ? 'pan' : 'paint', x: e.clientX, y: e.clientY, moved: false, last: i, i };
});
cv.addEventListener('pointermove', e => {
  if (!gest || !ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gest.mode === 'pinch' && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), c2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r = cv.getBoundingClientRect();
    vw.ox += c2.x - gest.cx; vw.oy += c2.y - gest.cy; zoomAt(c2.x - r.left, c2.y - r.top, d / gest.d); gest.d = d; gest.cx = c2.x; gest.cy = c2.y; return; }
  if (Math.hypot(e.clientX - gest.x, e.clientY - gest.y) > 7) gest.moved = true;
  if (gest.mode === 'pan') { vw.ox += dx; vw.oy += dy; clampView(); return; }
  if (gest.mode === 'paint' && gest.moved) {      // walk the line from the last cell so fast drags don't skip
    const steps = Math.ceil(Math.hypot(dx, dy) / Math.max(2, vw.s / 2));
    for (let s = 1; s <= steps; s++) { const i = cellAt(p.x + dx * s / steps, p.y + dy * s / steps); if (i >= 0 && i !== gest.last) { fillCell(i, sel, true); gest.last = i; } }
    if (gest.i >= 0) { fillCell(gest.i, sel, true); gest.i = -1; }
  }
});
const up = e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (gest && gest.mode === 'paint' && !gest.moved && ptrs.size === 0) { const i = cellAt(e.clientX, e.clientY); if (i >= 0) { if (!fillCell(i, sel) && cur && cur.pic.px[i] !== '.' && cur.fill[i] !== '1' && cur.fill[i] !== CH[sel]) {} } }
  if (ptrs.size === 0) { gest = null; saveFill(); streakN = 0; } else if (gest && gest.mode === 'pinch') gest = { mode: 'pan', x: 0, y: 0, moved: true };
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { e.preventDefault(); if (!cur) return; const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0018)); }, { passive: false });
let spaceDown = false; addEventListener('keydown', e => { if (e.code === 'Space') spaceDown = true; if (view === 'play' && /^[1-9]$/.test(e.key) && +e.key <= cur.pic.pal.length) selectColour(+e.key - 1); }); addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });

// tools
play.querySelector('[data-fit]').onclick = () => { snd.tap(); const r = cv.getBoundingClientRect(), { w, h } = cur.pic, s = Math.min((r.width - 90) / w, (r.height - 30) / h, 60); vw.s = s; vw.ox = (r.width - w * s) / 2; vw.oy = (r.height - h * s) / 2; };
play.querySelector('[data-find]').onclick = async () => {
  if (!cur || state !== 'play') return;
  let f = st.finds[cur.pic.id] ?? 3;
  if (f <= 0) { if (!M.spend(10, 'find')) { if (!(await M.rewarded('hint', { what: '3 more finds for this picture' }))) return; f = 3; st.finds[cur.pic.id] = 3; } else f = 1; }
  const i = cur.pic.px.split('').findIndex((c, j) => c !== '.' && c.charCodeAt(0) - 97 === sel && cur.fill[j] !== '1');
  if (i < 0) return;
  st.finds[cur.pic.id] = f - 1; save('finds'); paintTools();
  const r = cv.getBoundingClientRect(), x = i % cur.pic.w, y = Math.floor(i / cur.pic.w);
  if (vw.s < 22) zoomAt(r.width / 2, r.height / 2, 24 / vw.s);
  vw.ox = r.width / 2 - (x + .5) * vw.s; vw.oy = r.height / 2 - (y + .5) * vw.s; clampView();
  findRing = { x, y, t: performance.now() }; snd.sparkle();
};
play.querySelector('[data-bucket]').onclick = () => {
  if (!cur || state !== 'play' || need[sel] === 0) return;
  if (!M.spend(30, 'bucket')) { M.shop(); return; }
  snd.sparkle(); const k = sel;
  cur.pic.px.split('').forEach((c, i) => { if (c !== '.' && c.charCodeAt(0) - 97 === k && cur.fill[i] !== '1') fillCell(i, k, true); });
  saveFill();
};

// ---------------------------------------------------------------- finishing
let lastFin = null;
async function finish() {
  if (state !== 'play') return;
  state = 'won'; flash = performance.now(); saveFill(true);
  const pic = cur.pic, first = !st.done[pic.id], ms = st.ms[pic.id] || (performance.now() - tOpen);
  st.done[pic.id] = TODAY; delete st.fills[pic.id];
  const coins = first ? 10 + Math.round(pic.cells / 40) : 3;
  M.add(coins, 'picture');
  let used = 0, isDailyWin = false;
  if (cur.isDaily && pic.id === dailyPic(TODAY).id && !st.daily[TODAY]) { st.daily[TODAY] = 1; used = streakOnDaily(); isDailyWin = true; }
  const before = PACKS.filter(p => finished() - (first ? 1 : 0) >= p.need).length, newPack = first && PACKS.filter(p => finished() >= p.need).length > before ? PACKS.filter(p => finished() >= p.need).pop() : null;
  let packBonus = null;
  const pl = PICS.filter(p => p.pack === pic.pack); if (first && pl.every(p => st.done[p.id]) && !st.packsPaid.includes(pic.pack)) { st.packsPaid.push(pic.pack); packBonus = PACKS.find(p => p.id === pic.pack); M.add(150, 'pack'); }
  save();
  if (first) { F.level(true, 1); B.submit(1, { ms }); }
  lastFin = { pic, coins, newPack, packBonus, isDailyWin, used };
  snd.win(); rain(80); await wait(800); finCard();
}
function finCard() {
  const { pic, coins, newPack, packBonus, isDailyWin } = lastFin;
  const nextPic = PICS.find(p => p.pack === pic.pack && !st.done[p.id] && unlocked(p.pack)) || PICS.find(p => !st.done[p.id] && unlocked(p.pack));
  closeOv(); ovKind = 'fin';
  ov = $(`<div class="ov"><div class="sheet"><h3 class="outline">${['Kawaii!', 'So cute!', 'Pixel perfect!', 'Iconic!'][finished() % 4]}</h3>
    <p><b style="color:var(--ink)">${pic.name}</b> · ${pic.cells} pixels${isDailyWin ? ` · 🔥 ${st.streak.n}-day streak` : ''}</p>
    <div class="vox"><div class="hint">Tap to continue · drag to spin</div></div>
    <div class="reward"><span class="pill"><span class="coin"></span>+${coins}</span><span class="pill">📒 Sticker added</span></div>
    ${newPack ? `<p>🎉 New pack unlocked: <b>${newPack.name}</b></p>` : ''}${packBonus ? `<p>🏆 ${packBonus.name} complete! +150 coins</p>` : ''}
    <div class="row">${nextPic ? `<button class="btn pink" data-next>Next: ${nextPic.name} ▸</button>` : `<button class="btn pink" data-home>Gallery ▸</button>`}</div>
    <div class="row" data-offer>${isDailyWin ? `<button class="btn lilac" data-share>Share 💌</button>` : ''}</div></div></div>`);
  document.body.appendChild(ov);
  ['pointerdown', 'touchstart'].forEach(t => ov.addEventListener(t, e => e.stopPropagation()));
  popUp(ov.querySelector('.vox'), pic);
  let downAt = null;
  ov.addEventListener('pointerdown', e => downAt = { x: e.clientX, y: e.clientY });
  ov.addEventListener('click', e => { if (e.target.closest('button')) return; if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return; advance(nextPic); });
  const nb = ov.querySelector('[data-next]'); if (nb) nb.onclick = () => advance(nextPic);
  const hb = ov.querySelector('[data-home]'); if (hb) hb.onclick = () => advance(null);
  const sb = ov.querySelector('[data-share]'); if (sb) sb.onclick = () => share();
  if (coins >= 10 && !isDailyWin) {   // one offer on this screen: double the coins
    const b = $(`<button class="btn soft">📺 Double coins <small>+${coins}</small></button>`); ov.querySelector('[data-offer]').append(b);
    b.onclick = async () => { b.disabled = true; if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); toast(`+${coins} coins 💰`); snd.coin(); b.remove(); } else b.disabled = false; };
  }
}
async function advance(nextPic) {
  if (ovKind !== 'fin') return;
  closeOv(); stopPop();
  await M.breakAd('level-end', { level: finished() });
  if (nextPic) open(nextPic.id); else goHome();
}
function closeOv() { if (ov) { ov.remove(); ov = null; ovKind = null; } }
function overlay(kind, html) {
  closeOv(); ovKind = kind; ov = $(`<div class="ov"><div class="sheet">${html}</div></div>`); document.body.appendChild(ov);
  ['pointerdown', 'touchstart'].forEach(t => ov.addEventListener(t, e => e.stopPropagation()));
  ov.addEventListener('click', e => { if (e.target === ov) closeOv(); });
  const x = ov.querySelector('[data-x]'); if (x) x.onclick = () => closeOv();
}

// ---------------------------------------------------------------- share (spoiler-free: palette squares, never the picture)
function shareText() {
  const p = dailyPic(TODAY), sq = [['🟥', [230, 70, 90]], ['🟧', [250, 150, 60]], ['🟨', [250, 220, 90]], ['🟩', [110, 210, 140]], ['🟦', [110, 170, 240]], ['🟪', [170, 120, 230]], ['🟫', [140, 100, 70]], ['⬜', [245, 240, 245]], ['⬛', [60, 50, 70]]];
  const near = hex => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return sq.reduce((a, b) => (b[1].reduce((s, v, i) => s + (v - c[i]) ** 2, 0) < a[1].reduce((s, v, i) => s + (v - c[i]) ** 2, 0) ? b : a))[0]; };
  return `Pastel Pixel daily #${setNo(TODAY)} 🎨\n${[...new Set(p.pal.map(near))].join('')} ${p.cells} pixels${st.streak.n > 1 ? `\n🔥 ${st.streak.n}-day streak` : ''}`;
}
async function share() {
  const text = shareText(), url = location.origin + location.pathname + '?daily=1';
  try { if (navigator.share) { await navigator.share({ title: NAME, text, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Copied! Paste it to your bestie 💌'); } catch (e) { toast('Could not copy'); }
}

// ---------------------------------------------------------------- album + streak
function albumCard(pi = 0) {
  const P = PACKS[pi], list = PICS.filter(p => p.pack === P.id), have = list.filter(p => st.done[p.id]).length;
  overlay('album', `<button class="xbtn" data-x>×</button><h3>Sticker album</h3><p>${finished()}/${PICS.length} stickers · finish a pack: +150 coins</p>
    <div class="tabs">${PACKS.map((p, i) => `<button class="${i === pi ? 'on' : ''}" data-pg="${i}">${p.name}${st.packsPaid.includes(p.id) ? ' ✓' : ''}</button>`).join('')}</div>
    <div class="prog"><b style="width:${have / list.length * 100}%"></b></div><div class="album">${list.map(p => `<div class="s ${st.done[p.id] ? '' : 'no'}"><canvas data-a="${p.id}"></canvas></div>`).join('')}</div>`);
  ov.querySelectorAll('[data-a]').forEach(c => preview(c, byId[c.dataset.a], null, true));
  ov.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { snd.tap(); albumCard(+b.dataset.pg); });
}
function streakCard() {
  const s = st.streak, n = st.daily[TODAY] ? s.n : streakNow().n, wd = (fromNum(TODAY).getDay() + 6) % 7, mon = addDays(TODAY, -wd);
  const strip = [...Array(7).keys()].map(i => { const d = addDays(mon, i), on = st.daily[d], fz = s.frozen.includes(d); return `<span><i class="${on ? 'on' : fz ? 'fz' : ''}">${on ? '🔥' : fz ? '🧊' : ''}</i>${'MTWTFSS'[i]}</span>`; }).join('');
  overlay('streak', `<button class="xbtn" data-x>×</button><div style="font-size:60px">🔥</div><h3 class="outline">${n} day${n === 1 ? '' : 's'}</h3><p>Colour the daily pixel to keep it going. Best: <b>${s.best}</b></p><div class="week">${strip}</div>
    <div class="row2"><span>🧊 Freezes ready: ${freezes()}<small>One free every week, used automatically for a missed day.</small></span></div>
    <div class="row2"><span>Extra freeze<small>Keep up to 2 extra</small></span><button class="btn soft" data-buy style="padding:9px 14px;font-size:15px" ${s.extra >= 2 ? 'disabled' : ''}><span class="coin"></span> 60</button></div>`);
  ov.querySelector('[data-buy]').onclick = () => { if (st.streak.extra < 2 && M.spend(60, 'freeze')) { st.streak.extra++; save('streak'); snd.coin(); toast('🧊 Freeze added'); streakCard(); paintHome(); } else M.shop(); };
}

// ---------------------------------------------------------------- loop + boot
function tick(t) { pulse = t / 1000; draw(); fxTick(); requestAnimationFrame(tick); }
setView('home'); paintHome(); requestAnimationFrame(tick);
{ const ld = document.getElementById('load'); setTimeout(() => { ld.style.opacity = 0; setTimeout(() => ld.remove(), 500); }, 400); }
if (D.isDaily && !st.daily[TODAY]) setTimeout(() => open(dailyPic(TODAY).id, true), 600);
addEventListener('pagehide', () => saveFill(true));
setTimeout(() => { try { warm(); } catch (e) {} }, 1200);   // load Mallow + the voxel renderer before the first finish

// ---------------------------------------------------------------- test hooks + bot (paints ~2 cells a beat, like a quick finger)
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first picture, until the first
// touch, a short stroke of the selected colour paints itself in (4 matching pixels, one by one), so "paint the number" is shown
demo(() => {
  if (need.reduce((a, b) => a + b, 0) < 16) return false;
  const k = sel, c0 = cur, cells = []; for (let i = 0; i < c0.pic.px.length && cells.length < 4; i++) { const c = c0.pic.px[i]; if (c !== '.' && c.charCodeAt(0) - 97 === k && c0.fill[i] !== '1') cells.push(i); }
  if (!cells.length) return false;
  cells.forEach((i, j) => setTimeout(() => { if (cur === c0 && state === 'play') { fillCell(i, k, true); saveFill(); } }, j * 110));
}, { ready: () => view === 'play' && state === 'play' && cur && !cur.isDaily && finished() === 0 && !ov, wait: 1800, every: 1400, max: 3 });
window.__game = {
  // the shell's autostart: a brand-new player goes straight into the first picture of the pack (so the first seconds play themselves)
  autostart() { if (view !== 'home' || ov) return false; if (finished() > 0) return; const p = PICS.find(q => q.pack === pack && unlocked(q.pack) && !st.done[q.id]); if (p) open(p.id); },
  get state() { return state; },
  get level() { return finished(); },
  get score() { return finished(); },
  get view() { return { view, pic: cur && cur.pic.id, ov: ovKind }; },
  bot() {
    if (ov) { if (ovKind !== 'fin') closeOv(); return; }
    if (view === 'home') { const p = PICS.filter(q => unlocked(q.pack) && !st.done[q.id]).sort((a, b) => a.cells - b.cells)[0]; if (p) open(p.id); return; }
    if (state !== 'play' || !cur) return;
    if (need[sel] === 0) { const k = need.findIndex(n => n > 0); if (k >= 0) selectColour(k); return; }
    let n = 0; for (let i = 0; i < cur.pic.px.length && n < 2; i++) { const c = cur.pic.px[i]; if (c !== '.' && c.charCodeAt(0) - 97 === sel && cur.fill[i] !== '1') { fillCell(i, sel, true); n++; } }
    saveFill();
  },
};

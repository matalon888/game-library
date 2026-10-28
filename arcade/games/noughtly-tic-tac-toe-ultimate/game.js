// Noughtly — tic-tac-toe vs a CPU owl called Pebble, in two flavours: the classic 3×3 and the 9-board "ultimate" game
// (where your cell picks which small board Pebble must play next). Easy / Normal / Hard. Wins vs CPU go on the world board.
import { createUI, store, buzz, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, fx2d, arp, soft } from './calm.js';
import { LINES, lineOf, classicResult, classicScores, classicMove, uNew, uClone, uLegal, uPlay, mcts, ultimateMove } from './ai.js';

const NAME = 'Noughtly: Tic Tac Toe & Ultimate';
const S = store('noughtly');
const F = flow('noughtly');
const MODES = ['Classic 3×3', 'Ultimate 9×9'], DIFFS = ['Easy', 'Normal', 'Hard'];
const XC = '#ff6b6b', OC = '#20b2a3', INK = '#2f2a4a', ACC = '#7a5cf0';

const ui = createUI({ title: 'Noughtly', hint: 'Tap to play', hand: '', score: false, progress: false });
cardTheme({ accent: ACC });
const D = daily('noughtly', ui, { name: NAME });
const B = board({ game: 'noughtly', label: 'Wins vs CPU', limits: { maxRun: 1, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });
const fx = fx2d(11);

let mode = S.get('mode', 0), diff = S.get('diff', 1);
let wins = S.get('wins', 0), draws = S.get('draws', 0), losses = S.get('losses', 0), games = S.get('games', 0);

// ---------------------------------------------------------------- start card: kicker + two chip rows
{
  const card = ui.els.start, h1 = card.querySelector('h1'), hint = card.querySelector('.hint');
  const k = document.createElement('p'); k.className = 'calm-kicker'; k.textContent = 'tic tac toe vs computer'; h1.after(k);
  const owl = document.createElement('canvas'); owl.width = owl.height = 260; owl.style.cssText = 'width:130px;height:130px;margin:10px 0 0'; k.after(owl);
  drawOwl(owl.getContext('2d'), 130, 125, 200, 'happy', 0);
  const row = (items, get, set) => {
    const r = document.createElement('div'); r.className = 'calm-row'; r.addEventListener('pointerdown', e => e.stopPropagation());
    const draw = () => { r.innerHTML = ''; items.forEach((c, i) => { const b = document.createElement('button'); b.className = 'calm-chip' + (i === get() ? ' on' : ''); b.textContent = c; b.onclick = e => { e.stopPropagation(); set(i); draw(); soft.click(); }; r.appendChild(b); }); };
    draw(); return r;
  };
  hint.before(row(MODES, () => mode, i => { mode = i; S.set('mode', i); }));
  hint.before(row(DIFFS, () => diff, i => { diff = i; S.set('diff', i); }));
  const tip = document.createElement('p'); tip.style.cssText = 'font-size:14px;opacity:.75;margin-top:10px;max-width:320px';
  tip.textContent = 'Three in a row wins. In Ultimate, the cell you pick sends Pebble to that small board.'; hint.before(tip);
}
ui.els.win.querySelector('p').innerHTML = 'Game <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'You win!';

css(`
body{background:radial-gradient(130% 80% at 50% 0%,#fff6ec,#efe6ff);color:${INK}}
body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(122,92,240,.10) 1.3px,transparent 1.7px);background-size:24px 24px;pointer-events:none}
#nt{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
#nt-bar{position:fixed;left:0;right:0;bottom:calc(18px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:26px;z-index:5}
.nt-b{display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit;font-size:11px;font-weight:750;color:${INK};background:none;border:0;cursor:pointer;letter-spacing:1px;text-transform:uppercase;padding:0}
.nt-b .c{width:54px;height:54px;border-radius:50%;background:#fff;box-shadow:0 6px 18px rgba(60,40,110,.14);display:flex;align-items:center;justify-content:center;transition:transform .12s}
.nt-b:active .c{transform:scale(.9)} .nt-b.dim{opacity:.4}
.nt-b svg{width:24px;height:24px;stroke:${INK};fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hc-pop{color:${INK}!important;text-shadow:0 0 14px #fff,0 0 4px #fff!important}
`);
const cv = document.createElement('canvas'); cv.id = 'nt'; document.body.appendChild(cv);
const g = cv.getContext('2d');
const bar = document.createElement('div'); bar.id = 'nt-bar'; document.body.appendChild(bar);
const SVG = {
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  again: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};
function button(label, svg, fn) {
  const b = document.createElement('button'); b.className = 'nt-b'; b.innerHTML = `<div class="c">${svg}</div>${label}`;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state === 'play') fn(); });
  bar.appendChild(b); return b;
}
const undoBtn = button('Undo', SVG.undo, undo);
button('Restart', SVG.again, () => { soft.swish(); newGame(); });
button('Menu', SVG.menu, () => { state = 'ready'; ui.start(); });

// ---------------------------------------------------------------- game state
let state = 'ready', classic = null, U = null, curMode = 0, curDiff = 1, turn = 1, thinking = false, result = 0, winLine = null, history = [];
let marks = new Map(), subAnim = new Map(), t0 = 0, recorded = false, r = Math.random, starter = 2, mood = 'idle', moodAt = 0, beatenShown = false, endAt = 0;

function newGame() {
  curMode = mode; curDiff = diff; games++; S.set('games', games);
  const seed = D.seed ? D.seed * 13 + games : (Date.now() ^ (games * 7919)) >>> 0;   // >>> 0: a negative seed (Date.now() ^ x goes negative 10-28 → 11-21) made rng() negative
  r = rng(seed);
  starter = 3 - starter; turn = starter;
  classic = new Array(9).fill(0); U = uNew(); U.turn = turn;
  result = 0; winLine = null; history = []; marks = new Map(); subAnim = new Map(); recorded = false; thinking = false; endAt = 0;
  mood = 'idle'; state = 'play'; t0 = performance.now(); B.start();
  undoBtn.style.display = curDiff === 0 ? '' : 'none';
  layout();
  if (turn === 2) cpuSoon(); else soft.click();
}
const cpuDelay = () => (curMode ? 420 : 380) + r() * 250;
function cpuSoon() { thinking = true; mood = 'think'; setTimeout(cpuMove, cpuDelay()); }

function legalNow() {
  if (curMode === 0) { const a = []; classic.forEach((v, i) => !v && a.push(i)); return a; }
  return uLegal(U).slice();
}
function snapshot() { return { classic: classic.slice(), U: uClone(U), marks: new Map(marks), subAnim: new Map(subAnim) }; }
function place(i, who) {
  if (curMode === 0) {
    history.push(snapshot()); classic[i] = who; marks.set(i, performance.now());
    const res = classicResult(classic); if (res) { result = res; winLine = lineOf(classic); }
  } else {
    history.push(snapshot());
    const sub = (i / 9) | 0, before = U.macro[sub];
    uPlay(U, i); marks.set(i, performance.now());
    if (!before && U.macro[sub]) { subAnim.set(sub, performance.now()); if (U.macro[sub] < 3) { const [x, y] = subCenter(sub); fx.sparks(x, y, [U.macro[sub] === 1 ? XC : OC, '#fff', '#ffd66b'], 18, { speed: 3.4 }); chimeFor(who, true); buzz(18); } }
    if (U.result) { result = U.result; winLine = lineOf(U.macro); }
  }
  turn = 3 - who;
  if (who === 1) { tone(660, 0.06, 'triangle', 0.11, 1.4); tone(990, 0.04, 'sine', 0.05, 0.9); buzz(8); }
  else { tone(420, 0.09, 'sine', 0.12, 1.5); }
  if (result) finish();
}
const chimeFor = (who, big) => arp(who === 1 ? [72, 76, 79] : [67, 64, 60], 70, big ? 0.1 : 0.07, 0.4);

function playerTap(i) {
  if (state !== 'play' || thinking || turn !== 1 || result) return;
  if (!legalNow().includes(i)) { soft.err(); buzz([6, 30, 6]); return; }
  place(i, 1);
  if (!result) cpuSoon();
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in your first game, until the first
// touch, your X goes on the best square by itself (the bot's own pick) and Pebble answers; the next move is yours
demo(() => { window.__game.bot(); return false; },
  { ready: () => state === 'play' && games === 1 && !thinking && turn === 1 && !result && history.length <= 1, wait: 1800, max: 1 });
function cpuMove() {
  if (state !== 'play' || result) { thinking = false; return; }
  const fk = F.k();
  const m = curMode === 0 ? classicMove(classic, 2, curDiff, r, fk) : ultimateMove(U, curDiff, r, fk);
  thinking = false; mood = 'idle';
  place(m, 2);
}
function undo() {
  if (curDiff !== 0 || thinking || result) { soft.err(); return; }
  // roll back to just before your last move (your move + Pebble's answer)
  let snap = null;
  while (history.length) { const s = history.pop(); const whoseTurn = curMode === 0 ? turnFrom(s.classic) : s.U.turn; snap = s; if (whoseTurn === 1) break; }
  if (!snap) { soft.err(); return; }
  classic = snap.classic; U = snap.U; marks = snap.marks; subAnim = snap.subAnim; turn = 1; soft.swish(); buzz(6);
}
function turnFrom(c) { const n1 = c.filter(v => v === 1).length, n2 = c.filter(v => v === 2).length; return starter === 1 ? (n1 === n2 ? 1 : 2) : (n2 === n1 ? 2 : 1); }

function finish() {
  state = result === 1 ? 'won' : 'lost'; endAt = performance.now();
  const ms = performance.now() - t0;
  if (!recorded) { recorded = true; F.level(result === 1, result === 3 ? 0.8 : 0.2); }
  if (result === 1) {
    wins++; S.set('wins', wins); mood = 'sad';
    B.submit(1, { ms });
    arp([67, 72, 76, 79, 84], 90, 0.12, 0.8); buzz([20, 40, 20]); setTimeout(() => fx.confetti(), 250);
    if (!beatenShown && D.beaten(wins)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', INK, 40, 30), 400); }
    D.won(wins, 'won'); ui.win(games, `${DIFFS[curDiff]} · ${MODES[curMode]} · ${wins} win${wins === 1 ? '' : 's'}`);
  } else if (result === 3) {
    draws++; S.set('draws', draws); mood = 'idle';
    arp([67, 65, 67], 110, 0.09, 0.5); ui.lose('Draw!', 'Nobody got three in a row. Again?');
  } else {
    losses++; S.set('losses', losses); mood = 'happy';
    [64, 60, 55].forEach((n, i) => setTimeout(() => note(n, 0.35, 0.1), i * 150)); ui.lose('Pebble wins', 'So close. One more?');
  }
}
ui.onTap(() => newGame());

// ---------------------------------------------------------------- layout + input
let dpr = 1, W = 0, H = 0, geo = { x: 0, y: 0, s: 300 }, hud = { y: 70 };
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const top = 150, bottom = H - 150, s = Math.floor(Math.min(W - 28, bottom - top, 560));
  geo = { s, x: Math.round((W - s) / 2), y: Math.round(top + Math.max(0, (bottom - top - s) * 0.42)) };
  hud = { y: Math.max(62, geo.y - 92) };
}
addEventListener('resize', layout);
const PAD = 0.035;   // ultimate: gap between small boards (fraction of board)
function cellRect(i) {
  const { x, y, s } = geo;
  if (curMode === 0) { const c = s / 3; return [x + (i % 3) * c, y + ((i / 3) | 0) * c, c]; }
  const b = (i / 9) | 0, k = i % 9, bs = (s - PAD * s * 2) / 3, cs = (bs - 8) / 3;
  const bx = x + (b % 3) * (bs + PAD * s), by = y + ((b / 3) | 0) * (bs + PAD * s);
  return [bx + 4 + (k % 3) * cs, by + 4 + ((k / 3) | 0) * cs, cs];
}
function subRect(b) { const { x, y, s } = geo, bs = (s - PAD * s * 2) / 3; return [x + (b % 3) * (bs + PAD * s), y + ((b / 3) | 0) * (bs + PAD * s), bs]; }
function subCenter(b) { const [x, y, s] = subRect(b); return [x + s / 2, y + s / 2]; }
function cellAt(px, py) {
  const n = curMode === 0 ? 9 : 81;
  for (let i = 0; i < n; i++) { const [x, y, c] = cellRect(i); if (px >= x && px < x + c && py >= y && py < y + c) return i; }
  return -1;
}
cv.addEventListener('pointerdown', e => { if (state !== 'play') return; const i = cellAt(e.clientX, e.clientY); if (i >= 0) playerTap(i); });

// ---------------------------------------------------------------- drawing
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function drawX(cx, cy, s, k, lw, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = XC; g.lineWidth = lw; g.lineCap = 'round';
  g.shadowColor = 'rgba(255,107,107,.35)'; g.shadowBlur = lw * 0.8; g.shadowOffsetY = lw * 0.25;
  const a = Math.min(1, k * 2), b = Math.max(0, k * 2 - 1), h = s / 2;
  g.beginPath(); g.moveTo(cx - h, cy - h); g.lineTo(cx - h + 2 * h * ease(a), cy - h + 2 * h * ease(a)); g.stroke();
  if (b > 0) { g.beginPath(); g.moveTo(cx + h, cy - h); g.lineTo(cx + h - 2 * h * ease(b), cy - h + 2 * h * ease(b)); g.stroke(); }
  g.restore();
}
function drawO(cx, cy, s, k, lw, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = OC; g.lineWidth = lw; g.lineCap = 'round';
  g.shadowColor = 'rgba(32,178,163,.35)'; g.shadowBlur = lw * 0.8; g.shadowOffsetY = lw * 0.25;
  g.beginPath(); g.arc(cx, cy, s / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ease(k)); g.stroke(); g.restore();
}
function mark(who, cx, cy, s, k, lw, a) { who === 1 ? drawX(cx, cy, s, k, lw, a) : drawO(cx, cy, s, k, lw, a); }

/** Pebble: a round lilac owl (original). mood: idle | think | happy | sad */
function drawOwl(c, cx, cy, s, md, t) {
  const k = s / 100; c.save(); c.translate(cx, cy); c.scale(k, k);
  const bob = md === 'happy' ? Math.sin(t * 8) * 3 : Math.sin(t * 2) * 1.5; c.translate(0, bob);
  c.fillStyle = 'rgba(40,20,70,.15)'; c.beginPath(); c.ellipse(0, 46, 34, 6, 0, 0, 7); c.fill();
  c.fillStyle = '#9b84f5'; c.beginPath(); c.moveTo(-34, -30); c.lineTo(-26, -50); c.lineTo(-12, -38); c.lineTo(12, -38); c.lineTo(26, -50); c.lineTo(34, -30); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(0, 4, 42, 44, 0, 0, 7); c.fill();
  c.fillStyle = '#d9cefd'; c.beginPath(); c.ellipse(0, 22, 26, 22, 0, 0, 7); c.fill();
  c.strokeStyle = '#b6a6f7'; c.lineWidth = 2.5; for (const [x, y] of [[-10, 16], [10, 16], [0, 26], [-12, 30], [12, 30]]) { c.beginPath(); c.arc(x, y, 5, 0.2, Math.PI - 0.2); c.stroke(); }
  for (const sx of [-1, 1]) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * 17, -8, 15, 0, 7); c.fill();
    c.strokeStyle = '#7a5cf0'; c.lineWidth = 3; c.stroke();
    if (md === 'happy') { c.strokeStyle = INK; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(sx * 17, -4, 7, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    else if (md === 'sad') { c.strokeStyle = INK; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(sx * 17, -14, 7, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
    else { const lx = md === 'think' ? Math.sin(t * 3) * 5 : 0, ly = md === 'think' ? -4 : 0; c.fillStyle = INK; c.beginPath(); c.arc(sx * 17 + lx, -8 + ly, 7, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * 17 + lx + 2.5, -11 + ly, 2.4, 0, 7); c.fill(); }
  }
  c.fillStyle = '#ffb547'; c.beginPath(); c.moveTo(-6, 6); c.lineTo(6, 6); c.lineTo(0, 15); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,120,150,.35)'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 30, 10, 6, 4, 0, 0, 7); c.fill(); }
  c.fillStyle = '#ffb547'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 12, 47, 7, 4, 0, 0, 7); c.fill(); }
  c.restore();
}
function hudDraw(t) {
  const y = hud.y, w = Math.min(W - 24, 420), x0 = (W - w) / 2, h = 64;
  // you
  const you = turn === 1 && state === 'play' && !result, cpu = turn === 2 && state === 'play' && !result;
  const chipW = (w - 80) / 2;
  const card = (x, on, col) => { g.save(); g.shadowColor = 'rgba(60,40,110,.13)'; g.shadowBlur = 16; g.shadowOffsetY = 5; rr(x, y, chipW, h, 18); g.fillStyle = '#fff'; g.fill(); g.restore(); if (on) { rr(x, y, chipW, h, 18); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); } };
  card(x0, you, XC); card(x0 + w - chipW, cpu, OC);
  g.textBaseline = 'middle';
  drawX(x0 + 30, y + h / 2, 22, 1, 6);
  g.fillStyle = INK; g.textAlign = 'left'; g.font = '700 17px -apple-system,system-ui,sans-serif'; g.fillText('You', x0 + 54, y + h / 2 - 9);
  g.font = '600 13px -apple-system,system-ui,sans-serif'; g.globalAlpha = 0.6; g.fillText(you ? 'your turn' : `${wins} win${wins === 1 ? '' : 's'}`, x0 + 54, y + h / 2 + 11); g.globalAlpha = 1;
  const cx = x0 + w - chipW;
  drawOwl(g, cx + chipW - 30, y + h / 2 + 1, 46, mood, t);
  g.textAlign = 'right'; g.font = '700 17px -apple-system,system-ui,sans-serif'; g.fillText('Pebble', cx + chipW - 58, y + h / 2 - 9);
  g.font = '600 13px -apple-system,system-ui,sans-serif'; g.globalAlpha = 0.6; g.fillText(cpu ? 'thinking…' : DIFFS[curDiff], cx + chipW - 58, y + h / 2 + 11); g.globalAlpha = 1;
  // middle: tally
  g.textAlign = 'center'; g.font = '800 20px -apple-system,system-ui,sans-serif'; g.fillStyle = INK;
  g.fillText(`${wins}–${losses}`, W / 2, y + h / 2 - 6); g.font = '600 11px -apple-system,system-ui,sans-serif'; g.globalAlpha = 0.55; g.fillText(`${draws} draw${draws === 1 ? '' : 's'}`, W / 2, y + h / 2 + 14); g.globalAlpha = 1;
}
function draw(t) {
  const now = performance.now(), { x, y, s } = geo;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!classic) return;
  hudDraw(t);
  // board card
  g.save(); g.shadowColor = 'rgba(60,40,110,.18)'; g.shadowBlur = 30; g.shadowOffsetY = 12; rr(x - 10, y - 10, s + 20, s + 20, 26); g.fillStyle = '#fffdfa'; g.fill(); g.restore();
  const legal = state === 'play' && turn === 1 && !thinking && !result ? new Set(legalNow()) : new Set();
  if (curMode === 0) {
    const c = s / 3;
    for (const i of legal) { const [cx, cy, cs] = cellRect(i); rr(cx + 6, cy + 6, cs - 12, cs - 12, 16); g.fillStyle = 'rgba(122,92,240,.05)'; g.fill(); }
    g.strokeStyle = '#e3dcf3'; g.lineWidth = 7; g.lineCap = 'round';
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x + k * c, y + 14); g.lineTo(x + k * c, y + s - 14); g.moveTo(x + 14, y + k * c); g.lineTo(x + s - 14, y + k * c); g.stroke(); }
    for (let i = 0; i < 9; i++) if (classic[i]) { const [cx, cy, cs] = cellRect(i), k = (now - (marks.get(i) || 0)) / 260; const win = winLine && winLine.includes(i);
      const pulse = win ? 1 + Math.sin(now / 140) * 0.05 : 1; mark(classic[i], cx + cs / 2, cy + cs / 2, cs * 0.5 * pulse, Math.min(1, k), cs * 0.12, winLine && !win ? 0.35 : 1); }
    if (winLine) strike(winLine.map(i => { const [cx, cy, cs] = cellRect(i); return [cx + cs / 2, cy + cs / 2]; }), result, 12);
  } else {
    const active = new Set(); for (const i of legal) active.add((i / 9) | 0);
    for (let b = 0; b < 9; b++) {
      const [bx, by, bs] = subRect(b), mw = U.macro[b];
      rr(bx, by, bs, bs, 14);
      g.fillStyle = active.has(b) ? 'rgba(122,92,240,.13)' : mw === 1 ? 'rgba(255,107,107,.10)' : mw === 2 ? 'rgba(32,178,163,.10)' : 'rgba(47,42,74,.035)'; g.fill();
      if (active.has(b)) { g.strokeStyle = `rgba(122,92,240,${0.55 + Math.sin(now / 220) * 0.25})`; g.lineWidth = 2.5; g.stroke(); }
      const cs = (bs - 8) / 3; g.strokeStyle = '#ddd5ef'; g.lineWidth = 2.5; g.lineCap = 'round';
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(bx + 4 + k * cs, by + 9); g.lineTo(bx + 4 + k * cs, by + bs - 9); g.moveTo(bx + 9, by + 4 + k * cs); g.lineTo(bx + bs - 9, by + 4 + k * cs); g.stroke(); }
      for (let k = 0; k < 9; k++) { const i = b * 9 + k, v = U.cells[i]; if (!v) continue; const [cx, cy, c2] = cellRect(i), a = (now - (marks.get(i) || 0)) / 220;
        mark(v, cx + c2 / 2, cy + c2 / 2, c2 * 0.5, Math.min(1, a), Math.max(2.5, c2 * 0.13), mw ? 0.3 : 1);
        if (i === U.last && !result) { g.strokeStyle = 'rgba(255,190,70,.9)'; g.lineWidth = 2; rr(cx + 2, cy + 2, c2 - 4, c2 - 4, 6); g.stroke(); } }
      if (mw && mw < 3) { const k = (now - (subAnim.get(b) || 0)) / 380, sc = 1 + Math.max(0, 1 - k) * 0.25; mark(mw, bx + bs / 2, by + bs / 2, bs * 0.56 * sc, Math.min(1, k), bs * 0.1, 1);
        const L = lineOf(U.cells, b * 9); if (L) strike(L.map(i => { const [cx, cy, c2] = cellRect(b * 9 + i); return [cx + c2 / 2, cy + c2 / 2]; }), mw, 3, 0.45, subAnim.get(b)); }
      if (mw === 3) { g.fillStyle = 'rgba(255,255,255,.55)'; rr(bx, by, bs, bs, 14); g.fill(); }
    }
    if (winLine) strike(winLine.map(b => subCenter(b)), result, 14);
  }
  // status line under the board
  const sy = y + s + 38; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '650 15px -apple-system,system-ui,sans-serif'; g.fillStyle = INK; g.globalAlpha = 0.7;
  let msg = '';
  if (state === 'play' && !result) msg = turn === 1 ? (curMode === 1 ? (U.next >= 0 && !U.macro[U.next] ? 'Your turn · play in the glowing board' : 'Your turn · play in any open board') : 'Your turn · tap a square') : 'Pebble is thinking…';
  if (msg && sy < H - 110) g.fillText(msg, W / 2, sy);
  g.globalAlpha = 1;
}
function strike(pts, who, lw, alpha = 1, at = endAt) {
  const k = ease((performance.now() - at) / 420), [a, , b] = pts;
  const ex = (b[0] - a[0]) * 0.18, ey = (b[1] - a[1]) * 0.18;
  g.save(); g.globalAlpha = alpha; g.strokeStyle = who === 1 ? XC : who === 2 ? OC : '#aaa'; g.lineWidth = lw; g.lineCap = 'round';
  g.shadowColor = 'rgba(0,0,0,.15)'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(a[0] - ex, a[1] - ey); g.lineTo(a[0] - ex + (b[0] - a[0] + 2 * ex) * k, a[1] - ey + (b[1] - a[1] + 2 * ey) * k); g.stroke(); g.restore();
}
function frame(t) { draw(t / 1000); requestAnimationFrame(frame); }
layout(); classic = new Array(9).fill(0); U = uNew();
requestAnimationFrame(frame);
ui.start();

window.__game = {
  get state() { return state; }, get level() { return games; }, get score() { return wins; },
  bot() {   // plays your side well: perfect minimax in classic, a Monte Carlo search in ultimate
    if (state !== 'play' || thinking || turn !== 1 || result) return;
    let m;
    if (curMode === 0) { const sc = classicScores(classic, 1), top = Math.max(...sc.map(x => x.s)); const best = sc.filter(x => x.s === top); m = best[Math.floor(Math.random() * best.length)].m; }
    else m = mcts(U, 700, Math.random, 250);
    playerTap(m);
  },
};

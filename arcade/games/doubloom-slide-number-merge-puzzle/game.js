// Doubloom — slide-and-merge number tiles. Swipe (or arrow keys) to slide every tile; two equal tiles that meet merge into
// their sum. After each move a 2 (sometimes a 4) appears. Reach 2048 and keep going; the run ends when no move is left.
// One undo per game. ?daily=1 plays today's spawn sequence (same moves → same game for everyone).
import { createUI, store, buzz, note, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Doubloom: Slide Number Merge Puzzle', KEY = 'doubloom', SLIDE = 110;
const S = store(KEY);
const F = flow(KEY, { par: 2500, warmup: 0 });
const ui = createUI({ title: 'Doubloom', hint: 'Tap to play', hand: '', score: false, progress: false });
cardTheme({ accent: '#e0705a' });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'doubloom', label: 'Score', limits: { maxRun: 160000, maxPerSec: 150 }, corner: 'tl' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily start · same tiles for everyone' : 'number merge puzzle', doneLine: doneToday ? `Today's daily best: ${doneToday}` : null });
{ const p = document.createElement('p'); p.className = 'pz-rule'; p.textContent = 'Swipe to slide all tiles. Equal numbers merge and double.'; ui.els.start.querySelector('.calm-kicker').after(p); }
const winH1 = ui.els.win.querySelector('h1'), winP = ui.els.win.querySelector('p');
const pop0 = ui.pop; ui.pop = (t, c = '#4a3a35', ...rest) => pop0(t, c === '#fff' ? '#4a3a35' : c, ...rest);

css(`
body{background:radial-gradient(120% 70% at 50% 0%,#fff8ef,#f3e3d6);color:#4a3a35}
body:before{content:'';position:fixed;inset:0;background-image:radial-gradient(rgba(255,255,255,.6) 1.2px,transparent 1.6px);background-size:22px 22px;opacity:.6;pointer-events:none}
.pz-rule{font-size:15px!important;opacity:.8!important;max-width:320px;line-height:1.35;margin-top:6px!important}
.hc-pop{text-shadow:0 0 14px rgba(255,255,255,.95),0 0 4px rgba(255,255,255,.9)!important}
#db-head{position:fixed;left:0;right:0;top:calc(14px + env(safe-area-inset-top));display:flex;justify-content:center;gap:10px;z-index:5;pointer-events:none}
#db-head div{position:relative;background:#8f6f66;color:#fff;border-radius:14px;min-width:96px;padding:6px 14px 7px;text-align:center;box-shadow:0 4px 12px rgba(90,50,40,.15)}
#db-head div.best{background:rgba(255,255,255,.9);color:#8f6f66}
#db-head small{display:block;font-size:10px;letter-spacing:2px;font-weight:800;opacity:.8}
#db-head b{display:block;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
#db-head .plus{position:absolute;right:-10px;top:-6px;background:#fff;border-radius:10px;padding:0 6px;box-shadow:0 2px 6px rgba(90,50,40,.15);font-size:15px;font-weight:800;color:#e0705a;animation:dbup .7s ease-out forwards}
@keyframes dbup{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-26px)}}
#db-goal{position:fixed;left:0;right:0;top:calc(80px + env(safe-area-inset-top));text-align:center;font-size:13px;font-weight:700;letter-spacing:1px;color:#8f6f66;opacity:.8;z-index:5;pointer-events:none}
#db-cv{position:fixed;inset:0;width:100%;height:100%;z-index:2;touch-action:none}
#db-bar{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(18px,8vw,40px);z-index:5}
.db-b{display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit;font-size:11px;font-weight:750;color:#4a3a35;background:none;border:0;cursor:pointer;letter-spacing:1px;text-transform:uppercase;position:relative;padding:0}
.db-b .c{width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:0 6px 18px rgba(90,50,40,.13),inset 0 -2px 0 rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;transition:transform .12s}
.db-b svg{width:24px;height:24px;stroke:#4a3a35;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.db-b:active .c{transform:scale(.9)}
.db-b i{position:absolute;top:-4px;right:-6px;font-style:normal;background:#e0705a;color:#fff;font-size:11px;font-weight:800;border-radius:10px;padding:1px 6px}
.db-b i.off{background:#b5a7a2}
`);
const head = document.createElement('div'); head.id = 'db-head'; head.innerHTML = '<div><small>SCORE</small><b data-s>0</b></div><div class="best"><small>BEST</small><b data-b>0</b></div>'; document.body.appendChild(head);
const goal = document.createElement('div'); goal.id = 'db-goal'; document.body.appendChild(goal);
const cv = document.createElement('canvas'); cv.id = 'db-cv'; document.body.appendChild(cv); const g = cv.getContext('2d');
const bar = document.createElement('div'); bar.id = 'db-bar'; document.body.appendChild(bar);
function button(label, svg, fn) { const b = document.createElement('button'); b.className = 'db-b'; b.innerHTML = `<div class="c">${svg}</div>${label}`; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (state === 'play') fn(b); }); bar.appendChild(b); return b; }
const undoBtn = button('Undo', '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>', () => undo());
undoBtn.insertAdjacentHTML('beforeend', '<i>1</i>');
button('New', '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg>', () => { if (moves > 0) endRun(true); });

// ---------------------------------------------------------------- state
let state = 'ready', grid = [], tiles = [], score = 0, best = S.get('best', 0), moves = 0, maxTile = 0, undoLeft = 1, prev = null, seedState = 1, nextId = 1, recorded = false, beatenShown = false, reached = new Set(), t0 = 0, playMs = 0, lastSubmit = 0;
let geo = { x: 0, y: 0, s: 80, gap: 10 }, dpr = 1, W = 0, H = 0, bumpAt = 0, bumpDir = [0, 0];
const rnd = () => { seedState ^= seedState << 13; seedState >>>= 0; seedState ^= seedState >> 17; seedState ^= seedState << 5; seedState >>>= 0; return seedState / 4294967296; };
function newGame() {
  seedState = ((D.seed ? D.seed * 2654435761 : (Math.random() * 4294967295)) >>> 0) || 7;
  for (let i = 0; i < 5; i++) rnd();
  grid = new Array(16).fill(null); tiles = []; score = 0; moves = 0; maxTile = 0; undoLeft = 1; prev = null; recorded = false; beatenShown = false; reached = new Set(); playMs = 0; lastSubmit = 0;
  spawn(0); spawn(0); hud(); B.start(); t0 = performance.now();
}
function spawn(delay = SLIDE) {
  const empty = []; for (let i = 0; i < 16; i++) if (!grid[i]) empty.push(i);
  if (!empty.length) return;
  const fourChance = Math.min(0.2, 0.1 * (D.isDaily ? 1 : F.k()));   // flow knob: how often a 4 appears instead of a 2
  const c = empty[Math.floor(rnd() * empty.length)], v = rnd() < fourChance ? 4 : 2;
  const t = { id: nextId++, v, r: (c / 4) | 0, c: c % 4, fr: (c / 4) | 0, fc: c % 4, t0: performance.now(), born: performance.now() + delay, merged: 0 };
  grid[c] = t; tiles.push(t);
}
function snapshot() { return { g: grid.map(t => t && t.v), score, seed: seedState, moves, maxTile }; }
function restore(sn) {
  grid = new Array(16).fill(null); tiles = [];
  sn.g.forEach((v, i) => { if (v) { const t = { id: nextId++, v, r: (i / 4) | 0, c: i % 4, fr: (i / 4) | 0, fc: i % 4, t0: 0, born: performance.now(), merged: 0 }; grid[i] = t; tiles.push(t); } });
  score = sn.score; seedState = sn.seed; moves = sn.moves; maxTile = sn.maxTile; hud();
}
function undo() {
  if (!undoLeft || !prev) { soft.err(); ui.pop(undoLeft ? 'Nothing to undo' : 'Undo used', '#4a3a35', 22, 76); return; }
  restore(prev); prev = null; undoLeft = 0; soft.swish(); buzz(8); hud();
}
const DIRS = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };
/** pure move on values (for the bot + game-over test) */
function slideValues(vals, dir) {
  const [dr, dc] = DIRS[dir], out = new Array(16).fill(0); let gained = 0, moved = false;
  for (let line = 0; line < 4; line++) {
    const cells = []; for (let k = 0; k < 4; k++) { const kk = (dr + dc) > 0 ? 3 - k : k; cells.push(dr ? kk * 4 + line : line * 4 + kk); }
    const vs = cells.map(c => vals[c]).filter(Boolean), res = [];
    for (let i = 0; i < vs.length; i++) { if (vs[i] === vs[i + 1]) { res.push(vs[i] * 2); gained += vs[i] * 2; i++; } else res.push(vs[i]); }
    cells.forEach((c, k) => { out[c] = res[k] || 0; if (out[c] !== vals[c]) moved = true; });
  }
  return { out, gained, moved };
}
function canMove() { const vals = grid.map(t => t ? t.v : 0); return Object.keys(DIRS).some(d => slideValues(vals, d).moved); }
function move(dir) {
  if (state !== 'play') return;
  const now = performance.now();
  tiles = tiles.filter(t => !t.dead);                                   // finish any running animation at once
  for (const t of tiles) { t.fr = t.r; t.fc = t.c; t.t0 = 0; if (t.born > now) t.born = now; }
  const [dr, dc] = DIRS[dir], before = snapshot(); let moved = false, gained = 0, best1 = 0, merges = 0;
  for (let line = 0; line < 4; line++) {
    const cells = []; for (let k = 0; k < 4; k++) { const kk = (dr + dc) > 0 ? 3 - k : k; cells.push(dr ? kk * 4 + line : line * 4 + kk); }
    let w = 0, last = null;
    for (const c of cells) {
      const t = grid[c]; if (!t) continue; grid[c] = null;
      if (last && last.v === t.v && !last.justMerged) {
        // t slides onto `last`; both vanish after the slide and a doubled tile pops in
        const dest = cells[w - 1];
        t.fr = t.r; t.fc = t.c; t.r = (dest / 4) | 0; t.c = dest % 4; t.t0 = now; t.dead = true; t.deadUntil = now + SLIDE;
        last.dead = true; last.deadUntil = now + SLIDE;
        const m = { id: nextId++, v: t.v * 2, r: t.r, c: t.c, fr: t.r, fc: t.c, t0: 0, born: now + SLIDE, merged: now + SLIDE, justMerged: true };
        grid[dest] = m; tiles.push(m); gained += m.v; merges++; best1 = Math.max(best1, m.v); moved = true; last = m;
      } else {
        const dest = cells[w++]; if (dest !== c) moved = true;
        t.fr = t.r; t.fc = t.c; t.r = (dest / 4) | 0; t.c = dest % 4; t.t0 = now; grid[dest] = t; last = t;
      }
    }
  }
  for (const t of tiles) t.justMerged = false;
  if (!moved) { bumpAt = now; bumpDir = [dr, dc]; tone(160, 0.05, 'sine', 0.05, 0.8); return; }
  prev = before; moves++; score += gained;
  spawn();
  // feel: a soft slide click, merge notes climbing with the tile size, haptics
  tone(300, 0.04, 'triangle', 0.06, 0.7);
  if (merges) { const e = Math.log2(best1); setTimeout(() => { note(57 + e * 2, 0.35, 0.12); if (merges > 1) note(64 + e * 2, 0.3, 0.08); }, SLIDE * 0.6); buzz(merges > 1 ? [8, 20, 8] : 8); }
  if (gained) plusPop(gained);
  if (best1 > maxTile) {
    maxTile = best1;
    if (best1 >= 128) { const msg = best1 >= 2048 ? `${best1}!` : `${best1}`; setTimeout(() => { ui.pop(msg, best1 >= 2048 ? '#e0705a' : '#4a3a35', best1 >= 2048 ? 54 : 38, 74); if (best1 >= 512) fx.confetti(best1 >= 2048 ? 140 : 50); arp([67, 71, 74, 79].slice(0, best1 >= 1024 ? 4 : 3), 70, 0.1, 0.6); }, SLIDE); }
    if (best1 >= 64) checkpoint();
  }
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#e0705a', 40, 74); fx.confetti(60); }
  hud();
  if (!canMove()) { state = 'over'; setTimeout(() => endRun(false), 700); }
}
function plusPop(n) { const s = head.querySelector('[data-s]'); const p = document.createElement('span'); p.className = 'plus'; p.textContent = '+' + n; s.parentNode.querySelectorAll('.plus').forEach(x => x.remove()); s.parentNode.appendChild(p); setTimeout(() => p.remove(), 700); }
function hud() {
  head.querySelector('[data-s]').textContent = score;
  if (score > best) { best = score; S.set('best', best); }
  head.querySelector('[data-b]').textContent = best;
  const next = maxTile >= 2048 ? maxTile * 2 : 2048; goal.textContent = D.isDaily ? `DAILY · BEST TILE ${Math.max(maxTile, 2)}` : `BEST TILE ${Math.max(maxTile, 2)} · GOAL ${next}`;
  const i = undoBtn.querySelector('i'); i.textContent = undoLeft; i.classList.toggle('off', !undoLeft || !prev);
}
/** a long run reports its score so far at big-tile milestones, so leaving mid-game never loses a good run (scores only go up) */
function checkpoint() { const ms = playMs + (performance.now() - t0); if (score > lastSubmit) { lastSubmit = score; B.submit(score, { ms }); } }
function endRun(gaveUp) {
  if (recorded) return; recorded = true;
  const ms = playMs + (performance.now() - t0);
  if (score > 0) { F.endless(score); B.submit(score, { ms }); }
  if (D.isDaily) { const pd = S.get('daily_' + todayKey(), 0); if (score > pd) S.set('daily_' + todayKey(), score); }
  const prevBest = S.get('runbest', 0), isBest = score > prevBest && score > 0;
  if (isBest) S.set('runbest', score);
  state = isBest ? 'won' : 'lost';
  const line = `Score ${score} · best tile ${maxTile || 2}`;
  if (isBest) {
    winH1.textContent = 'New best!'; winP.innerHTML = 'No moves left<span data-l hidden></span>';
    D.won(score); arp([67, 72, 76, 79, 84], 95, 0.12, 0.9); setTimeout(() => fx.confetti(), 250); buzz([20, 50, 20]);
    ui.win('', line);
  } else {
    soft.err(); ui.lose(gaveUp ? 'New game' : 'No moves left', line + (best ? ` · best ${best}` : ''));
  }
}
addEventListener('pagehide', () => { if (state === 'play' && score > lastSubmit) checkpoint(); });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (state === 'play') { playMs += performance.now() - t0; if (score > lastSubmit) checkpoint(); } } else t0 = performance.now(); });

ui.onTap((which) => {
  if (which === 'start') { if (!tiles.length) newGame(); state = 'play'; B.start(); t0 = performance.now(); return; }
  newGame(); state = 'play';
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): at the start of a run, until the
// first touch, the board slides itself three times (the bot's greedy pick), so tiles visibly glide and merge
demo(() => {
  const vals = grid.map(t => t ? t.v : 0); let bestD = null, bv = -1e9;
  for (const d of ['up', 'left', 'right', 'down']) { const r = slideValues(vals, d); if (!r.moved) continue; const sc = evalBoard(r.out) + r.gained * 0.02 - (d === 'down' ? 4 : 0); if (sc > bv) { bv = sc; bestD = d; } }
  if (!bestD) return false; move(bestD);
}, { ready: () => state === 'play' && moves < 3, wait: 1800, every: 1000, max: 3 });

// ---------------------------------------------------------------- input
let sw = null;
cv.addEventListener('pointerdown', e => { if (state !== 'play') return; sw = { x: e.clientX, y: e.clientY, done: false }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
cv.addEventListener('pointermove', e => {
  if (!sw || sw.done) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) > 26) { sw.done = true; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }
});
const upH = () => { sw = null; }; cv.addEventListener('pointerup', upH); cv.addEventListener('pointercancel', upH);
addEventListener('keydown', e => {
  const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }[e.key];
  if (k && state === 'play') { e.preventDefault(); move(k); }
  if ((e.key === 'z' || e.key === 'u') && state === 'play') undo();
});

// ---------------------------------------------------------------- drawing
const PAL = {
  2: ['#f7efe9', '#7a6259'], 4: ['#f3e3d3', '#7a6259'], 8: ['#ffc58f', '#fff'], 16: ['#ffa86e', '#fff'], 32: ['#ff8a6b', '#fff'], 64: ['#f4665a', '#fff'],
  128: ['#ffd56b', '#fff'], 256: ['#ffc94d', '#fff'], 512: ['#f9b934', '#fff'], 1024: ['#6fd0a2', '#fff'], 2048: ['#38b98a', '#fff'],
  4096: ['#5b9df0', '#fff'], 8192: ['#7b6cf0', '#fff'], 16384: ['#4c4370', '#fff'],
};
const pal = (v) => PAL[v] || PAL[16384];
function rrect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function layout() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const top = 112, bot = H - 104, size = Math.min(W - 28, bot - top - 20, 520), gap = Math.round(size * 0.028);
  const s = (size - gap * 5) / 4;
  geo = { x: Math.round((W - size) / 2), y: Math.round(top + Math.max(0, (bot - top - size) * 0.45)), s, gap, size };
}
addEventListener('resize', layout); layout();
const cellXY = (r, c) => [geo.x + geo.gap + c * (geo.s + geo.gap), geo.y + geo.gap + r * (geo.s + geo.gap)];
const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function frame() {
  const now = performance.now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  let bx = 0, by = 0; if (now - bumpAt < 180) { const k = Math.sin((now - bumpAt) / 180 * Math.PI) * 5; bx = bumpDir[1] * k; by = bumpDir[0] * k; }
  g.save(); g.translate(bx, by);
  const { x, y, size, s, gap } = geo, rad = Math.max(8, s * 0.12);
  g.save(); g.shadowColor = 'rgba(110,60,40,.22)'; g.shadowBlur = 28; g.shadowOffsetY = 12; rrect(x, y, size, size, rad + 6); g.fillStyle = '#c9aca0'; g.fill(); g.restore();
  rrect(x, y, size, size, rad + 6); g.fillStyle = '#c4a69a'; g.fill();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const [cx, cy] = cellXY(r, c); rrect(cx, cy, s, s, rad); g.fillStyle = 'rgba(255,248,240,.35)'; g.fill(); }
  // tiles: sliding ones first, then merged/new ones on top
  const list = tiles.slice().sort((a, b) => (a.dead ? 0 : 1) - (b.dead ? 0 : 1) || a.v - b.v);
  for (const t of list) {
    if (t.dead && now > t.deadUntil) continue;
    if (now < t.born) continue;
    const k = t.t0 ? easeOut((now - t.t0) / SLIDE) : 1;
    const r = t.fr + (t.r - t.fr) * k, c = t.fc + (t.c - t.fc) * k;
    let sc = 1;
    if (t.merged) { const p = (now - t.merged) / 200; if (p < 1) sc = 1 + Math.sin(p * Math.PI) * 0.18; }
    else if (!t.t0 || t.fr === t.r && t.fc === t.c) { const p = (now - t.born) / 160; if (p < 1 && t.born > 0) sc = easeOut(p) * 0.9 + 0.1; }
    const [cx, cy] = cellXY(r, c), [bg, fg] = pal(t.v);
    g.save(); g.translate(cx + s / 2, cy + s / 2); g.scale(sc, sc);
    if (t.v >= 128) { g.shadowColor = bg; g.shadowBlur = Math.min(30, 6 + Math.log2(t.v) * 2); }
    else { g.shadowColor = 'rgba(110,60,40,.18)'; g.shadowBlur = 6; g.shadowOffsetY = 3; }
    rrect(-s / 2, -s / 2, s, s, rad); g.fillStyle = bg; g.fill(); g.shadowColor = 'transparent';
    const gr = g.createLinearGradient(0, -s / 2, 0, s / 2); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.06)');
    rrect(-s / 2, -s / 2, s, s, rad); g.fillStyle = gr; g.fill();
    const digits = String(t.v).length, fs = s * (digits <= 2 ? 0.48 : digits === 3 ? 0.4 : digits === 4 ? 0.32 : 0.26);
    g.font = `800 ${Math.round(fs)}px -apple-system,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (fg === '#fff') { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillText(t.v, 0, 3); }
    g.fillStyle = fg; g.fillText(t.v, 0, 1);
    g.restore();
  }
  g.restore();
  // first-game swipe hint
  if (state === 'play' && moves === 0 && !S.get('played', 0)) {
    const a = (now / 900) % 1, hx = W / 2 - 40 + a * 80, hy = geo.y + geo.size + 36;
    if (hy < H - 110) { g.globalAlpha = Math.sin(a * Math.PI); g.font = '30px system-ui'; g.textAlign = 'center'; g.fillText('👆', hx, hy); g.globalAlpha = 1; }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
newGame(); state = 'ready';

// ---------------------------------------------------------------- test hook: greedy 1-ply bot (empties + corner + smoothness)
function evalBoard(v) {
  let e = 0, mono = 0, smooth = 0; for (let i = 0; i < 16; i++) if (!v[i]) e++;
  const L = (x) => x ? Math.log2(x) : 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const a = L(v[r * 4 + c]), b = L(v[r * 4 + c + 1]); mono += a >= b ? 0 : (a - b); smooth -= Math.abs(a - b) * (a && b ? 1 : 0); }
  for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) { const a = L(v[r * 4 + c]), b = L(v[(r + 1) * 4 + c]); mono += a >= b ? 0 : (a - b) * 0.5; smooth -= Math.abs(a - b) * (a && b ? 1 : 0); }
  const corner = L(v[0]) >= Math.max(...v.map(L)) ? 3 : 0;
  return e * 2.7 + mono * 1.0 + smooth * 0.1 + corner;
}
window.__game = {
  get state() { return state === 'over' ? 'play' : state; }, get level() { return maxTile; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    S.set('played', 1);
    const vals = grid.map(t => t ? t.v : 0); let bestD = null, bv = -1e9;
    for (const d of ['up', 'left', 'right', 'down']) { const r = slideValues(vals, d); if (!r.moved) continue; const sc = evalBoard(r.out) + r.gained * 0.02 - (d === 'down' ? 4 : 0); if (sc > bv) { bv = sc; bestD = d; } }
    if (bestD) move(bestD);
  },
};
cv.addEventListener('pointerdown', () => S.set('played', 1), { once: true });

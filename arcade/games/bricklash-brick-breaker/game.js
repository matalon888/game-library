// Bricklash — the classic brick breaker: a paddle, a ball, a wall of glowing bricks. Every level is a fresh
// symmetric layout built from a seed. Catch falling capsules for multi-ball, a wide paddle, fireball, lasers,
// slow-mo and extra lives. Endless; three lives.
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, N as NLV } from './levels2.js';
import { css, BASE_CSS, stage2d, rr, sprite, blit, fx as mkfx, hud as mkhud, keys, touchy, dressStart, paused } from './neo.js';

const NAME = 'Bricklash: Brick Breaker';
const READY = true;                                   // v2 (deep) reaches players only when true; ?deep=1 forces it for QA
const DEEP = (READY && ab('deep-bricklash')) || /[?&]deep=1/.test(location.search);
const SAVE = store('bricklash');
let best = SAVE.get('best', 0);
const F = flow('bricklash', { par: 3000, warmup: 400 });
css(BASE_CSS + `body{--acc:#3dd6ff;--acc2:#ffd84d;--bgA:#0a0f2a;--bgB:#123a6e;--bgC:#050818}
.bl-pad{position:fixed;left:16px;right:16px;bottom:calc(12px + env(safe-area-inset-bottom));height:62px;z-index:3;border-radius:22px;border:1.5px dashed rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;gap:10px;font:800 12px 'Baloo 2',system-ui;letter-spacing:.2em;color:rgba(255,255,255,.4);pointer-events:none}
.bl-pad i{display:block;width:44px;height:4px;border-radius:4px;background:rgba(255,255,255,.18)}`);
const ui = createUI({ title: 'BRICKLASH', hint: 'Tap to play', hand: '👆', progress: false, score: false });
const D = daily('bricklash', ui, { name: NAME });
const B = board({ game: 'bricklash', label: 'Points', limits: { maxRun: 400000, maxPerSec: 600 }, corner: 'tl' });
const SD = dressStart(ui, { kicker: 'BRICK BREAKER', line: (DEEP ? '30 hand-made levels · bombs · gold bricks · stars<br>' : '') + 'Drag anywhere to move the paddle · tap to launch<br>catch the capsules', best });
ui.els.lose.querySelector('.hint').textContent = 'Tap to play again';
const S = stage2d(), ctx = S.ctx, FX = mkfx(), H = mkhud('SCORE');
const padHint = document.createElement('div'); padHint.className = 'bl-pad'; padHint.innerHTML = '<i></i>DRAG<i></i>'; document.body.appendChild(padHint);

// ---------------------------------------------------------------- world (logical units, scaled to fit)
const FW = 360, FH = 640, COLS = 10, BW = 34, BH = 15, GAP = 2, BX0 = (FW - COLS * (BW + GAP) + GAP) / 2, BY0 = 92;
const PY = FH - 46, BR = 6;
const ROWC = ['#ff5fa8', '#ff7a59', '#ffb43d', '#ffe14d', '#b8ff4a', '#3dffc0', '#3dd6ff', '#5f8bff', '#9a7bff', '#d77bff', '#ff5fd0', '#ff6b8b'];
const PU = {
  multi: { c: '#ff5fd0', t: '3×', name: 'MULTI-BALL' }, wide: { c: '#3dffc0', t: '⟷', name: 'WIDE PADDLE' }, fire: { c: '#ff8a3d', t: 'F', name: 'FIREBALL' },
  laser: { c: '#ff4d6d', t: 'L', name: 'LASERS' }, slow: { c: '#5fb8ff', t: 'S', name: 'SLOW-MO' }, life: { c: '#b8ff4a', t: '+1', name: 'EXTRA LIFE' },
};
let maxChain = 0, totBricks = 0, botMiss = 0.36, camp = null, net = 0, lostBalls = 0, sessionPts = 0, levelT2 = 0;   // v2: camp = authored level number (1..30) or null for the daily/endless run
let state = 'ready', score = 0, lives = 3, level = 1, recorded = false, beatenShown = false, seed = 1;
let idleT = 0, bricks = [], balls = [], caps = [], shots = [], chain = 0, levelT = 0, intro = 0, clearT = -1, stuckT = 0;
let pad = { x: FW / 2, w: 66, tw: 66, sq: 0, kv: 0 }, timers = { wide: 0, fire: 0, laser: 0, slow: 0 }, laserCD = 0, botT = null, botErr = 0, botDesc = false;

function genLevel(lv) {
  const r = rng(seed * 7919 + lv * 104729), rows = Math.min(13, 7 + lv), half = COLS / 2;
  const kinds = ['noise', 'diamond', 'stripes', 'checker', 'pyramid', 'rings', 'waves', 'columns', 'arrow', 'frame'];
  const kind = lv === 1 ? 'stripes' : kinds[Math.floor(r() * kinds.length)];
  const pTough = Math.min(0.45, (lv - 1) * 0.07), pTri = Math.min(0.25, Math.max(0, lv - 3) * 0.05), pSteel = lv >= 4 ? Math.min(0.1, (lv - 3) * 0.025) : 0;
  const out = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < half; x++) {
    const cx = half - 1 - x + 0.5, cy = y - (rows - 1) / 2; let on;
    switch (kind) {
      case 'noise': on = r() < 0.62; break;
      case 'diamond': on = Math.abs(cx) / half + Math.abs(cy) / (rows / 2) < 1.15; break;
      case 'stripes': on = y % 3 !== 2 || r() < 0.3; break;
      case 'checker': on = (x + y) % 2 === 0; break;
      case 'pyramid': on = x >= y * half / rows - 0.5 - 0 && (half - 1 - x) < (rows - y) * half / rows + 0.6; break;
      case 'rings': { const d = Math.hypot(cx * 1.1, cy * 1.6); on = Math.floor(d) % 2 === 0; break; }
      case 'waves': on = Math.abs(y - (rows / 2 + Math.sin(x * 1.1) * rows / 3)) < 1.6; break;
      case 'columns': on = x % 2 === 0 || y === 0; break;
      case 'arrow': on = Math.abs(cx) <= y * 0.7 + 0.6 || (Math.abs(cx) < 1.2); break;
      case 'frame': on = y === 0 || y === rows - 1 || x === 0 || (y % 3 === 1 && x % 2 === 1); break;
    }
    if (!on) continue;
    let hp = 1; const q = r(); if (q < pSteel && y > 0) hp = -1; else if (q < pSteel + pTri) hp = 3; else if (q < pSteel + pTri + pTough) hp = 2;
    const pu = hp !== -1 && r() < 0.11 ? pickPU(r) : null;
    for (const gx of [x, COLS - 1 - x]) out.push({ gx, gy: y, x: BX0 + gx * (BW + GAP), y: BY0 + y * (BH + GAP), hp, max: hp, c: ROWC[y % ROWC.length], pu, hit: 0, alive: true, delay: (y * 0.05 + Math.abs(gx - 4.5) * 0.025) });
  }
  if (out.filter(b => b.hp > 0).length < 12) return genLevel(lv + 100);
  return out;
}
function buildAuthored(n) {
  const L = LEVELS[n - 1], r = rng(n * 7717 + 11), out = [], rowsX = {};
  L.rows.forEach((row, y) => {
    for (let x = 0; x < COLS; x++) {
      const ch = row[x]; if (ch === '.' || ch === ' ') continue;
      const hp = ch === '#' ? -1 : ch === 'X' || ch === 'G' ? 1 : +ch; if (!hp) continue;
      const kind = ch === 'X' ? 'bomb' : ch === 'G' ? 'gold' : '';
      const b = { gx: x, gy: y, x: BX0 + x * (BW + GAP), y: BY0 + y * (BH + GAP), hp, max: hp, c: kind === 'gold' ? '#ffd23f' : kind === 'bomb' ? '#ff5a3d' : ROWC[(y + n) % ROWC.length], kind, pu: ch === 'G' ? pickPU(r) : null, hit: 0, alive: true, delay: y * 0.05 + Math.abs(x - 4.5) * 0.025 };
      b.x0 = b.x; out.push(b); (rowsX[y] = rowsX[y] || []).push(b);
    }
  });
  const sl = L.slide || [];
  sl.forEach((y, i) => {
    const row = rowsX[y]; if (!row) return; const lo = Math.min(...row.map(b => b.gx)), hi = Math.max(...row.map(b => b.gx));
    const amp = Math.min(BW + GAP, lo * (BW + GAP) + BX0 - 3, FW - 3 - (BX0 + hi * (BW + GAP) + BW));
    if (amp < 6) return; for (const b of row) { b.amp = amp; b.ph = (i % 2) * Math.PI; b.sp = 0.8 + i * 0.12; }
  });
  return out;
}
function pickPU(r) { const q = r(); return q < 0.24 ? 'multi' : q < 0.44 ? 'wide' : q < 0.6 ? 'fire' : q < 0.76 ? 'laser' : q < 0.93 ? 'slow' : 'life'; }
const baseSpeed = () => Math.min(640, (camp ? 410 + Math.min(camp - 1, 29) * 5 : 370 + (level - 1) * 15) * F.k(score)) * (timers.slow > 0 ? 0.72 : 1);
function newBall(stuck = true) { return { x: pad.x, y: PY - BR - 7, vx: 0, vy: 0, stuck, off: (Math.random() - 0.5) * 20, trail: [], sp: baseSpeed() }; }
function launch() {
  for (const b of balls) if (b.stuck) { b.stuck = false; const a = -Math.PI / 2 + (b.off / 40) * 0.9 + (Math.random() - 0.5) * 0.2; b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; tone(660, 0.08, 'triangle', 0.1, 1.4); buzz(8); }
}
function startLevel(lv) {
  level = lv; bricks = camp ? buildAuthored(camp) : genLevel(lv); caps = []; lostBalls = 0; maxChain = 0; levelT2 = 0; net = camp ? (LEVELS[camp - 1].net || 0) : 0; shots = []; balls = [newBall()]; intro = 1; totBricks = bricks.filter(b => b.hp > 0).length; clearT = -1; chain = 0; stuckT = 0; idleT = 0;
  for (const k in timers) timers[k] = 0;
  if (camp && typeof ui !== 'undefined' && ui && ui.pop) try { ui.pop(`${camp}  ·  ${LEVELS[camp - 1].name.toUpperCase()}`, '#3dd6ff', 30, 30); } catch (e) {}
  if (camp && lv > 1 && typeof ui !== 'undefined' && ui && ui.pop) try { ui.pop('★★★ no ball lost · chain 6', '#ffd84a', 26, 40); } catch (e) {}
}
function reset() { seed = D.seed || (Date.now() % 1e6) + 3; score = 0; lives = 3; recorded = false; beatenShown = false; pad.x = FW / 2; H.score(0); startLevel(1); }
function addScore(n) { score += n; H.score(score); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(FW / 2, FH * 0.4); sfx.win(); } }
function confetti(x, y) { const [sx, sy] = toScr(x, y); FX.burst(sx, sy, ['#ff5fa8', '#ffe14d', '#3dffc0', '#3dd6ff', '#9a7bff', '#fff'], 60, { speed: 420, life: 1.3, size: 6, grav: 380, drag: 1.4 }); }

let brk = 0, luckyDone = false;
function breakBrick(b, ball) {
  idleT = 0;
  if (b.hp === -1) { b.hit = 1; tone(900, 0.04, 'square', 0.04, 1); return; }
  b.hp--; b.hit = 1;
  if (b.hp > 0) { tone(420 + b.hp * 80, 0.05, 'triangle', 0.09, 0.9); buzz(5); return; }
  b.alive = false; chain++; brk++; if (chain > maxChain) maxChain = chain;
  if (DEEP && camp && !luckyDone && brk === (camp <= 2 ? (camp === 1 ? 2 : 3) : 6 + (camp % 4)) && !b.pu) { b.pu = camp <= 2 || camp % 2 === 0 ? 'multi' : 'fire'; luckyDone = true; }
  const mult = 1 + Math.floor(chain / 5);
  const pts = 10 * b.max * mult + (b.kind === 'gold' ? 200 : 0); addScore(pts);
  if (b.kind === 'bomb') blast(b);
  const [sx, sy] = toScr(b.x + BW / 2, b.y + BH / 2);
  FX.burst(sx, sy, [b.c, '#ffffff'], 14, { speed: 240, life: 0.6, size: 4 * L.k, grav: 500 });
  FX.ring(sx, sy, b.c, 4, 30 * L.k, 0.35, 3);
  FX.shake(2 + Math.min(4, chain * 0.3));
  note(64 + (chain % 12) + (chain > 12 ? 12 : 0), 0.14, 0.11); buzz(8);
  if (mult > 1 && chain % 5 === 0) FX.text(sx, sy - 6, `×${mult}`, '#ffe14d', 24);
  if (DEEP && chain === 5) { FX.text(sx, sy - 22, 'NICE!', '#3dffc0', 22, 0.8); tone(880, 0.1, 'triangle', 0.08, 1.4); }
  if (DEEP && chain === 8) { ui.pop('FEVER!', '#ff5a3d', 38, 30); FX.flash('#ff5a3d', 0.15); stopT = 0.08; tone(1040, 0.2, 'sawtooth', 0.09, 1.6); }
  if (DEEP && chain > 8) stopT = Math.max(stopT, 0.03);
  if (DEEP && chain >= 10) FX.shake(3 + Math.min(6, chain * 0.2));
  if (DEEP && chain > 0 && chain % 10 === 0) { ui.pop(chain >= 30 ? 'UNSTOPPABLE!' : chain >= 20 ? 'ON FIRE!' : 'COMBO ' + chain, '#ff8a3d', 30, 24); FX.flash('#ffe14d', 0.08); }
  if (DEEP && b.kind === 'gold') { ui.pop('STAR STORM!', '#ffd23f', 34, 26); FX.flash('#ffd23f', 0.15); confetti(b.x + BW / 2, b.y); tone(660, 0.12, 'triangle', 0.1, 1.6); spawnMulti(); }
  if (DEEP && chain >= 3) { comboPulse = 1; FX.burst(sx, sy, ['#ffe14d', '#fff', '#3dffc0'], Math.min(40, chain * 2), { speed: 200 + chain * 12, life: 0.7, size: 3 * L.k, grav: 300 }); }
  if (b.pu) caps.push({ x: b.x + BW / 2, y: b.y + BH / 2, t: b.pu, vy: 110, rot: 0 });
  if (!bricks.some(q => q.alive && q.hp > 0)) levelClear();
}
function blast(b) {
  const [sx, sy] = toScr(b.x + BW / 2, b.y + BH / 2);
  FX.ring(sx, sy, '#ff8a3d', 8, 120 * L.k, 0.5, 5); FX.burst(sx, sy, ['#ffcf3f', '#ff7a1a', '#ff3d3d', '#fff'], 26, { speed: 380, life: 0.7, size: 5 * L.k, grav: 200 });
  if (DEEP) stopT = 0.09;
  FX.shake(9); FX.flash('#ff8a3d', 0.12); tone(110, 0.28, 'sawtooth', 0.14, 0.4); buzz([14, 20, 30]);
  for (const k of bricks) if (k.alive && k !== b && Math.abs(k.gx - b.gx) <= 1 && Math.abs(k.gy - b.gy) <= 1 && k.hp !== -1) { k.hp = 1; k.fuse = 0.07; }
}
function levelClear() {
  if (camp) return campClear();
  clearT = 0; const bonus = 250 * level; addScore(bonus);
  ui.pop(`LEVEL ${level} CLEAR!`, '#ffe14d', 38, 30); sfx.win(); buzz([20, 30, 40]); confetti(FW / 2, FH * 0.35); FX.flash('#ffffff', 0.25);
  FX.text(S.w / 2, S.h * 0.42, `+${bonus}`, '#3dffc0', 30, 1.4);
}
function loseBall() {
  if (camp && net > 0) { net--; FX.text(S.w / 2, S.h * 0.72, 'SAVED!', '#3dffc0', 28, 1); FX.flash('#3dffc0', 0.15); tone(660, 0.15, 'triangle', 0.1, 1.5); balls = [newBall()]; caps = []; shots = []; stuckT = 0; return; }
  lostBalls++;
  if (DEEP && camp && bricks.filter(q => q.alive && q.hp > 0).length <= 3 && bricks.some(q => q.alive && q.hp > 0)) ui.pop('SO CLOSE!', '#ff7a9a', 34, 30);
  lives--; FX.shake(10); FX.flash('#ff3d6e', 0.25); sfx.fail(); buzz([40, 30, 60]); chain = 0;
  for (const k in timers) timers[k] = 0;
  if (lives <= 0) return camp ? campFail() : gameOver();
  balls = [newBall()]; caps = []; shots = []; stuckT = 0;
  ui.pop(lives === 1 ? 'LAST BALL!' : `${lives} BALLS LEFT`, '#ff7a9a', 32, 40);
}
function gameOver() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); if (DEEP && score > SAVE.get('dbest', 0)) SAVE.set('dbest', score); }
  const nb = score > best && score > 0; best = Math.max(best, score); SAVE.set('best', best); SD.setBest(best);
  ui.lose(nb ? 'NEW BEST!' : 'GAME OVER', `Score ${score.toLocaleString('en-US')} · Level ${level} · Best ${best.toLocaleString('en-US')}`);
}
function spawnMulti() { const nb = []; for (const b of balls.slice(0, 6)) { if (b.stuck) { launch(); } for (const da of [-0.5, 0.5]) { const a = Math.atan2(b.vy || -1, b.vx) + da; const sp = b.sp; nb.push({ ...b, trail: [], stuck: false, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); } } balls.push(...nb); }
function catchCap(c) {
  const p = PU[c.t]; FX.text(...toScr(c.x, PY - 30), p.name, p.c, 22, 1.1); FX.ring(...toScr(c.x, PY), p.c, 6, 60 * L.k, 0.45, 4);
  tone(523, 0.08, 'triangle', 0.1, 1.5); setTimeout(() => tone(784, 0.12, 'triangle', 0.1, 1.3), 70); buzz(14); addScore(50);
  if (c.t === 'multi') spawnMulti();
  else if (c.t === 'wide') timers.wide = 15; else if (c.t === 'fire') timers.fire = 8; else if (c.t === 'laser') { timers.laser = 10; laserCD = 0; }
  else if (c.t === 'slow') { timers.slow = 10; for (const b of balls) { const s = Math.hypot(b.vx, b.vy) || 1; b.sp = baseSpeed(); b.vx *= b.sp / s; b.vy *= b.sp / s; } }
  else if (c.t === 'life') lives = Math.min(5, lives + 1);
}

// ---------------------------------------------------------------- physics
function stepBall(b, dt) {
  if (b.stuck) { b.x = pad.x + b.off; b.y = PY - BR - 7; return true; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); tone(300, 0.03, 'sine', 0.05, 1); }
  if (b.x > FW - BR) { b.x = FW - BR; b.vx = -Math.abs(b.vx); tone(300, 0.03, 'sine', 0.05, 1); }
  if (b.y < BR + 30) { b.y = BR + 30; b.vy = Math.abs(b.vy); tone(300, 0.03, 'sine', 0.05, 1); }
  // paddle
  const hw = pad.w / 2;
  if (b.vy > 0 && b.y + BR >= PY - 6 && b.y - BR <= PY + 6 && b.x >= pad.x - hw - BR && b.x <= pad.x + hw + BR) {
    const off = Math.max(-1, Math.min(1, (b.x - pad.x) / (hw + BR))), a = -Math.PI / 2 + off * 1.05 + (camp ? (Math.random() - 0.5) * 0.12 : 0);
    b.sp = Math.min(b.sp + 3, baseSpeed() * 1.25); b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; b.y = PY - 6 - BR;
    const few = bricks.filter(k => k.alive && k.hp > 0).length <= 4, i0 = few ? 1.5 : 5;
    if (camp && idleT > i0) { // gentle aim help when the ball has been wandering: steer toward the nearest breakable brick
      let tb = null, bd = 1e9; for (const k of bricks) if (k.alive && k.hp > 0) { const d = Math.abs(k.x + BW / 2 - b.x) + (PY - k.y) * 0.2; if (d < bd) { bd = d; tb = k; } }
      if (tb) { const ta = Math.atan2(tb.y + BH / 2 - PY, tb.x + BW / 2 - b.x), w = Math.min(few ? 0.95 : 0.85, (idleT - i0) / (few ? 3 : 8)), ang = Math.atan2(b.vy, b.vx); const na = a + (ta - a) * w; b.vx = Math.cos(na) * b.sp; b.vy = Math.sin(na) * b.sp; }
    }
    if (DEEP && camp) { // visible skill: centre hits build a streak, edge hits show the steep angle
      if (Math.abs(off) < 0.18) { perfStreak++; if (perfStreak >= 2) { FX.text(...toScr(pad.x, PY - 34), perfStreak >= 4 ? 'PERFECT x' + perfStreak : 'CENTER!', '#7fe8ff', 18 + Math.min(perfStreak, 8), 0.7); FX.ring(...toScr(pad.x, PY), '#7fe8ff', 6, 40 * L.k, 0.35, 3); } }
      else { perfStreak = 0; if (Math.abs(off) > 0.75) FX.text(...toScr(pad.x, PY - 34), off < 0 ? '◀ SHARP' : 'SHARP ▶', '#ffe14d', 15, 0.5); }
    }
    pad.sq = 1; chain = 0; tone(440 + Math.abs(off) * 200, 0.06, 'triangle', 0.1, 1.2); buzz(6);
    FX.burst(...toScr(b.x, PY - 6), ['#ffffff', '#3dd6ff'], 6, { speed: 140, life: 0.35, size: 3, grav: 200 });
  }
  // bricks
  for (const k of bricks) {
    if (!k.alive) continue;
    const nx = Math.max(k.x, Math.min(b.x, k.x + BW)), ny = Math.max(k.y, Math.min(b.y, k.y + BH)), dx = b.x - nx, dy = b.y - ny;
    if (dx * dx + dy * dy > BR * BR) continue;
    const fire = timers.fire > 0 && k.hp !== -1;
    if (!fire) {
      const px = b.x - b.vx * dt, py = b.y - b.vy * dt;
      if (px + BR <= k.x || px - BR >= k.x + BW) { b.vx = -b.vx; b.x = px; } else { b.vy = -b.vy; b.y = py; }
    }
    if (fire) { k.hp = 1; }
    breakBrick(k, b);
    if (!fire) break;
  }
  // keep it from going flat
  const s = Math.hypot(b.vx, b.vy) || 1; if (Math.abs(b.vy) < s * 0.28) { b.vy = Math.sign(b.vy || -1) * s * 0.28; b.vx = Math.sign(b.vx) * Math.sqrt(s * s - b.vy * b.vy); }
  const k = b.sp / s; b.vx *= k; b.vy *= k;
  return b.y < FH + 20;
}
function update(dt) {
  if (state !== 'play') return;
  if (intro > 0) intro = Math.max(0, intro - dt * 1.2);
  if (clearT >= 0) { clearT += dt; if (clearT > 1.6 && !camp) startLevel(level + 1); return; }
  for (const k in timers) timers[k] = Math.max(0, timers[k] - dt);
  pad.tw = timers.wide > 0 ? 104 : 66; pad.w += (pad.tw - pad.w) * Math.min(1, dt * 10);
  if (pad.kv) pad.x += pad.kv * 560 * dt;
  if (botT !== null) { const d = botT - pad.x, m = 620 * dt; pad.x += Math.max(-m, Math.min(m, d)); }
  pad.x = Math.max(pad.w / 2, Math.min(FW - pad.w / 2, pad.x));
  pad.sq = Math.max(0, pad.sq - dt * 5);
  if (balls.some(b => b.stuck)) { stuckT += dt; if (stuckT > 2.5) { launch(); stuckT = 0; } }
  const n = 4; for (let i = 0; i < n; i++) balls = balls.filter(b => stepBall(b, dt / n));
  for (const b of balls) { b.trail.push([b.x, b.y]); if (b.trail.length > 8) b.trail.shift(); }
  if (!balls.length) { loseBall(); return; }
  for (const c of caps) { c.y += c.vy * dt; c.rot += dt * 3; if (c.y > PY - 8 && c.y < PY + 10 && Math.abs(c.x - pad.x) < pad.w / 2 + 12) { c.dead = true; catchCap(c); } if (c.y > FH + 20) c.dead = true; }
  caps = caps.filter(c => !c.dead);
  if (timers.laser > 0) { laserCD -= dt; if (laserCD <= 0) { laserCD = 0.32; shots.push({ x: pad.x - pad.w / 2 + 6, y: PY - 8 }, { x: pad.x + pad.w / 2 - 6, y: PY - 8 }); tone(1200, 0.04, 'square', 0.035, 0.6); } }
  for (const s of shots) { s.y -= 640 * dt; for (const k of bricks) if (k.alive && s.x > k.x && s.x < k.x + BW && s.y > k.y && s.y < k.y + BH) { s.dead = true; breakBrick(k); break; } if (s.y < 30) s.dead = true; }
  shots = shots.filter(s => !s.dead);
  for (const k of bricks) k.hit = Math.max(0, k.hit - dt * 6);
  for (const k of bricks) if (k.fuse > 0 && k.alive) { k.fuse -= dt; if (k.fuse <= 0) breakBrick(k); }
  idleT += dt; levelT2 += dt; if (camp) for (const k of bricks) if (k.amp) k.x = k.x0 + Math.sin(levelT2 * k.sp + k.ph) * k.amp;
}

// ---------------------------------------------------------------- input
let drag = null;
S.cv.addEventListener('pointerdown', e => { if (state !== 'play') return; drag = { x: e.clientX, id: e.pointerId, moved: 0, t: performance.now(), mouse: e.pointerType === 'mouse' }; botT = null; });
addEventListener('pointermove', e => {
  if (state !== 'play') return;
  if (e.pointerType === 'mouse' && !touchy()) { botT = null; pad.x = (e.clientX - L.ox) / L.k; return; }
  if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx); pad.x += dx / L.k * 1.25;
});
addEventListener('pointerup', () => { if (drag && drag.moved < 10 && performance.now() - drag.t < 350) launch(); drag = null; });
addEventListener('pointercancel', () => drag = null);
keys({
  'ArrowLeft|a|A': { press: () => { pad.kv = -1; botT = null; }, release: () => { if (pad.kv < 0) pad.kv = 0; } },
  'ArrowRight|d|D': { press: () => { pad.kv = 1; botT = null; }, release: () => { if (pad.kv > 0) pad.kv = 0; } },
  ' |ArrowUp|w|W': { press: () => { if (state === 'play') launch(); else cardGo(); } }, 'Enter': { press: () => cardGo() },
});
function cardGo() {
  const o = ov && ov.classList.contains('on') && (ov.querySelector('.bl-btn:not(.alt)') || ov.querySelector('.bl-n.next')); if (o) return o.click(); for (const k of ['start', 'lose']) { const c = ui.els[k]; if (!c.classList.contains('hc-hidden')) { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return; } } }
ui.onTap(() => { if (DEEP) return state === 'lost' && !camp ? startDaily() : cleared() === 0 ? startCampaign(1) : showMap(); reset(); state = 'play'; B.start(); });

// ---------------------------------------------------------------- layout + drawing
const L = { k: 1, ox: 0, oy: 0 };
const toScr = (x, y) => [L.ox + x * L.k, L.oy + y * L.k];
S.onResize = (w, h) => {
  const t = touchy(); padHint.style.display = t ? 'flex' : 'none';
  const top = 64, bottom = t ? 84 : 16;
  L.k = Math.min((w - 16) / FW, (h - top - bottom) / FH); L.ox = (w - FW * L.k) / 2; L.oy = top + (h - top - bottom - FH * L.k) / 2;
};
S.fit();
function brickSprite(c, hp, max, k, kind = '') {
  return sprite('b' + c + hp + max + kind, Math.round(BW * k), Math.round(BH * k), S.dpr, Math.ceil(10 * k), (x, w, h) => {
    if (hp === -1) {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d8deef'); g.addColorStop(1, '#7d86a3'); rr(x, 0, 0, w, h, h * 0.3); x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.stroke(); x.fillStyle = 'rgba(40,46,70,.5)'; for (const px of [0.18, 0.82]) { x.beginPath(); x.arc(w * px, h / 2, h * 0.12, 0, 7); x.fill(); } return;
    }
    if (kind === 'bomb') { x.shadowColor = '#ff5a3d'; x.shadowBlur = 10 * k; rr(x, 0.5, 0.5, w - 1, h - 1, h * 0.32); x.fillStyle = '#2a0f14'; x.fill(); x.shadowBlur = 0; x.strokeStyle = '#ff7a3d'; x.lineWidth = 1.6 * k; x.stroke(); x.fillStyle = '#ff9a3d'; x.beginPath(); x.arc(w / 2, h / 2, h * 0.28, 0, 7); x.fill(); x.fillStyle = '#fff3b0'; x.beginPath(); x.arc(w / 2 - h * 0.06, h / 2 - h * 0.06, h * 0.12, 0, 7); x.fill(); return; }
    if (kind === 'gold') { x.shadowColor = '#ffd23f'; x.shadowBlur = 12 * k; rr(x, 0.5, 0.5, w - 1, h - 1, h * 0.32); const gg = x.createLinearGradient(0, 0, 0, h); gg.addColorStop(0, '#fff3a8'); gg.addColorStop(0.5, '#ffc531'); gg.addColorStop(1, '#c98a10'); x.fillStyle = gg; x.fill(); x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? h * 0.16 : h * 0.38, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } x.closePath(); x.fill(); return; }
    x.shadowColor = c; x.shadowBlur = 8 * k; rr(x, 0.5, 0.5, w - 1, h - 1, h * 0.32); x.fillStyle = c; x.globalAlpha = hp < max ? 0.75 : 1; x.fill(); x.shadowBlur = 0; x.globalAlpha = 1;
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
    rr(x, 0.5, 0.5, w - 1, h - 1, h * 0.32); x.fillStyle = g; x.fill();
    if (max > 1) { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.6 * k; rr(x, 2 * k, 2 * k, w - 4 * k, h - 4 * k, h * 0.25); x.stroke(); }
    if (max === 3) { x.strokeStyle = 'rgba(255,255,255,.6)'; rr(x, 4 * k, 4 * k, w - 8 * k, h - 8 * k, h * 0.2); x.stroke(); }
    if (hp < max) { x.strokeStyle = 'rgba(20,10,40,.6)'; x.lineWidth = 1.3 * k; x.beginPath(); x.moveTo(w * 0.3, 0); x.lineTo(w * 0.42, h * 0.5); x.lineTo(w * 0.34, h); x.moveTo(w * 0.42, h * 0.5); x.lineTo(w * 0.6, h * 0.42); if (max - hp > 1) { x.moveTo(w * 0.7, 0); x.lineTo(w * 0.64, h * 0.6); x.lineTo(w * 0.78, h); } x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,.7)'; rr(x, w * 0.1, h * 0.16, w * 0.3, h * 0.16, h * 0.08); x.fill();
  });
}
function draw(t) {
  S.begin(); const k = L.k, [sx, sy] = FX.offset();
  ctx.save(); ctx.translate(sx, sy);
  // field
  const fx0 = L.ox, fy0 = L.oy, fw = FW * k, fh = FH * k;
  ctx.save(); ctx.shadowColor = '#3dd6ff'; ctx.shadowBlur = 24; rr(ctx, fx0 - 4, fy0 + 26 * k, fw + 8, fh - 26 * k + 4, 18); ctx.fillStyle = 'rgba(6,10,30,.72)'; ctx.fill(); ctx.restore();
  rr(ctx, fx0 - 4, fy0 + 26 * k, fw + 8, fh - 26 * k + 4, 18); ctx.strokeStyle = 'rgba(61,214,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); rr(ctx, fx0 - 4, fy0 + 26 * k, fw + 8, fh - 26 * k + 4, 18); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let gx = 0; gx <= FW; gx += 24) { ctx.moveTo(fx0 + gx * k, fy0); ctx.lineTo(fx0 + gx * k, fy0 + fh); } for (let gy = 30; gy <= FH; gy += 24) { ctx.moveTo(fx0, fy0 + gy * k); ctx.lineTo(fx0 + fw, fy0 + gy * k); } ctx.stroke();
  // bricks (fly in on level start)
  const ie = intro;
  for (const b of bricks) {
    if (!b.alive) continue; const d = Math.max(0, Math.min(1, (ie * 1.6 - b.delay * 2))), oy = -d * d * 220;
    const [x, y] = toScr(b.x, b.y + oy / k * 0 ); const yy = y + oy;
    const sp = brickSprite(b.c, b.hp, b.max, k, b.kind); ctx.globalAlpha = 1 - d * 0.8;
    const s = 1 + b.hit * 0.12; blit(ctx, sp, x - BW * k * (s - 1) / 2, yy - BH * k * (s - 1) / 2, BW * k * s, BH * k * s);
    if (b.pu) { ctx.fillStyle = '#fff'; ctx.globalAlpha = (0.55 + 0.45 * Math.sin(t * 6 + b.gx)) * (1 - d); ctx.beginPath(); ctx.arc(x + BW * k / 2, yy + BH * k / 2, 2.6 * k, 0, 7); ctx.fill(); }
    if (b.hit > 0) { ctx.globalAlpha = b.hit * 0.6; ctx.fillStyle = '#fff'; rr(ctx, x, yy, BW * k, BH * k, BH * k * 0.3); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // capsules
  for (const c of caps) {
    const [x, y] = toScr(c.x, c.y), p = PU[c.t], w = 30 * k, h = 14 * k;
    ctx.save(); ctx.translate(x, y); ctx.shadowColor = p.c; ctx.shadowBlur = 14; rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = p.c; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(ctx, -w / 2 + 3, -h / 2 + 2, w - 6, h * 0.3, h * 0.15); ctx.fill();
    ctx.fillStyle = '#16102e'; ctx.font = `800 ${Math.round(11 * k)}px 'Baloo 2',system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.t, 0, 1 * k); ctx.restore();
  }
  // lasers
  ctx.fillStyle = '#ff4d6d'; ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 10; for (const s of shots) { const [x, y] = toScr(s.x, s.y); ctx.fillRect(x - 1.5, y - 8 * k, 3, 10 * k); } ctx.shadowBlur = 0;
  // paddle
  { const [x, y] = toScr(pad.x, PY), w = pad.w * k * (1 + pad.sq * 0.08), h = 12 * k * (1 - pad.sq * 0.25), col = timers.fire > 0 ? '#ff8a3d' : timers.laser > 0 ? '#ff4d6d' : skinC();
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 22; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, col); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    if (timers.laser > 0) { ctx.fillStyle = '#ffd0da'; for (const s of [-1, 1]) { rr(ctx, x + s * (w / 2 - 6 * k) - 3 * k, y - h / 2 - 6 * k, 6 * k, 8 * k, 2 * k); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; rr(ctx, x - w / 2 + h * 0.6, y - h / 2 + h * 0.18, w * 0.35, h * 0.2, h * 0.1); ctx.fill(); }
  // balls
  for (const b of balls) {
    const col = timers.fire > 0 ? '#ff8a3d' : '#ffffff';
    ctx.globalCompositeOperation = 'lighter';
    b.trail.forEach(([tx, ty], i) => { const [x, y] = toScr(tx, ty); ctx.globalAlpha = (i / b.trail.length) * 0.35; ctx.fillStyle = timers.fire > 0 ? '#ff6a2a' : '#3dd6ff'; ctx.beginPath(); ctx.arc(x, y, BR * k * (0.4 + 0.6 * i / b.trail.length), 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const [x, y] = toScr(b.x, b.y); ctx.save(); ctx.shadowColor = timers.fire > 0 ? '#ff6a2a' : '#7fe8ff'; ctx.shadowBlur = DEEP && chain >= 8 ? 34 : 18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, BR * k, 0, 7); ctx.fill(); ctx.restore();
    if (timers.fire > 0 && Math.random() < 0.6) FX.burst(x, y, ['#ffcf3f', '#ff7a1a', '#ff3d3d'], 1, { speed: 40, life: 0.35, size: 4 * k, grav: -60 });
  }
  if (state === 'play' && balls.some(b => b.stuck) && clearT < 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.35 * Math.sin(t * 5)) + ')'; ctx.font = `800 ${Math.round(16 * k)}px 'Baloo 2',system-ui`; ctx.textAlign = 'center'; ctx.fillText(touchy() ? 'TAP TO LAUNCH' : 'CLICK OR SPACE TO LAUNCH', fx0 + fw / 2, fy0 + (PY - 70) * k); }
  ctx.restore();
  // lives + level + active power timers (top strip of the field)
  ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(13 * k)}px 'Baloo 2',system-ui`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(camp ? 'LEVEL ' + camp + (LEVELS[camp - 1].hard ? ' · HARD' : '') : 'LEVEL ' + level, fx0 + 4, fy0 + 12 * k);
  for (let i = 0; i < lives; i++) { const x = fx0 + fw - 8 - i * 22 * k; ctx.save(); ctx.shadowColor = '#3dd6ff'; ctx.shadowBlur = 8; rr(ctx, x - 16 * k, fy0 + 9 * k, 16 * k, 6 * k, 3 * k); ctx.fillStyle = '#3dd6ff'; ctx.fill(); ctx.restore(); }
  let tx = fx0 + fw / 2 - 60 * k; for (const [key, v] of Object.entries(timers)) if (v > 0) { const p = PU[key]; ctx.fillStyle = p.c; ctx.globalAlpha = v < 2 ? 0.5 + 0.5 * Math.sin(t * 16) : 1; rr(ctx, tx, fy0 + 5 * k, 26 * k, 14 * k, 7 * k); ctx.fill(); ctx.fillStyle = '#16102e'; ctx.textAlign = 'center'; ctx.fillText(p.t, tx + 13 * k, fy0 + 12.5 * k); ctx.textAlign = 'left'; ctx.globalAlpha = 1; tx += 30 * k; }
  if (DEEP && state === 'play' && chain >= 3) { comboPulse = Math.max(0, comboPulse - 0.05); const sc = 1 + comboPulse * 0.35; ctx.save(); ctx.translate(fx0 + fw / 2, fy0 + 40 * k); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.font = `900 ${Math.round((22 + Math.min(14, chain)) * k)}px 'Baloo 2',system-ui`; ctx.fillStyle = chain >= 20 ? '#ff5a3d' : chain >= 10 ? '#ff8a3d' : '#ffe14d'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; ctx.fillText('x' + chain, 0, 0); ctx.restore(); }
  FX.draw(ctx); ctx.restore(); FX.drawFlash(ctx, S.w, S.h);
}

let stopT = 0, comboPulse = 0, perfStreak = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.04, (now - last) / 1000); last = now;
  let sdt = dt; if (DEEP && stopT > 0) { stopT -= dt; sdt = dt * 0.15; }
  if (!paused()) update(sdt);
  FX.update(dt); H.stats([['BEST', Math.max(best, score).toLocaleString('en-US')]]); draw(now / 1000);
  requestAnimationFrame(frame);
}
reset(); requestAnimationFrame(frame);


// ---------------------------------------------------------------- v2: level map, stars, chests, paddle skins, daily
const SKINS = [['#3dd6ff', 'Ice'], ['#ff5fa8', 'Bubblegum'], ['#b8ff4a', 'Lime'], ['#ffb43d', 'Amber'], ['#9a7bff', 'Violet'], ['#ff5a5a', 'Ruby'], ['#ffffff', 'Pearl'], ['#ffd23f', 'Gold']];
let skinI = SAVE.get('skin', 0);
const skinC = () => (DEEP ? SKINS[skinI][0] : '#3dd6ff');
const starsOf = () => SAVE.get('st', {});
const totalStars = () => Object.values(starsOf()).reduce((a, b) => a + b, 0);
const cleared = () => Math.max(0, ...Object.keys(starsOf()).map(Number));
const STAR = on => `<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.12em;margin:0 .03em"><path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z" fill="${on ? '#ffd84d' : 'rgba(255,255,255,.22)'}"/></svg>`;
const STARS = n => STAR(n > 0) + STAR(n > 1) + STAR(n > 2);
const owned = () => SAVE.get('own', [0]);
const chestsEarned = () => Math.min(SKINS.length - 1, Math.floor(totalStars() / 10));
let sessionBoard = false, mode = 'map', ov = null;
if (DEEP) {
  css(`.bl-ov{position:fixed;inset:0;z-index:30;display:none;flex-direction:column;align-items:center;background:rgba(5,8,24,.9);backdrop-filter:blur(6px);font-family:'Baloo 2',system-ui;color:#fff;overflow:auto;padding:calc(58px + env(safe-area-inset-top)) 14px 24px}
.bl-ov.on{display:flex}.bl-ov h2{margin:6px 0 2px;font-size:26px;letter-spacing:.06em}.bl-ov small{opacity:.7}
.bl-top{display:flex;gap:8px;align-items:center;width:100%;max-width:420px;justify-content:space-between;margin-bottom:6px}
.bl-chip{background:rgba(255,255,255,.1);border-radius:14px;padding:6px 12px;font-weight:800;font-size:14px}
.bl-w{width:100%;max-width:420px;margin:10px 0 0;border-radius:18px;padding:10px 10px 12px;background:rgba(255,255,255,.05);border:1.5px solid var(--wc)}
.bl-w b{color:var(--wc);letter-spacing:.12em;font-size:14px}.bl-w small{margin-left:8px}
.bl-g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px}
.bl-n{position:relative;border:0;border-radius:14px;height:56px;background:var(--wc);color:#0a0f2a;font:800 20px 'Baloo 2',system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.bl-n i{font-style:normal;font-size:11px;letter-spacing:1px;margin-top:3px;color:#7a4a00}.bl-n.lock{background:rgba(255,255,255,.08);color:rgba(255,255,255,.3)}
.bl-n.next{animation:blp 1s ease-in-out infinite;box-shadow:0 0 0 3px #fff}.bl-n.hard{outline:2px solid #ff4d6d}
@keyframes blp{50%{transform:scale(1.1)}}
.bl-btn{border:0;border-radius:18px;padding:12px 22px;font:800 18px 'Baloo 2',system-ui;background:#ffd84d;color:#1a1030;margin:6px}.bl-btn.alt{background:rgba(255,255,255,.14);color:#fff}
.bl-card{margin:auto;text-align:center;max-width:340px}.bl-st{font-size:54px;letter-spacing:6px}.bl-st s{text-decoration:none;opacity:.2}
.bl-sk{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:10px 0}.bl-sk button{width:44px;height:26px;border-radius:13px;border:2px solid transparent}.bl-sk button.on{border-color:#fff}.bl-sk button.no{opacity:.25}
.bl-mapbtn{position:fixed;left:10px;top:calc(56px + env(safe-area-inset-top));z-index:6;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff;font:800 13px 'Baloo 2',system-ui;padding:6px 10px}`);
  ov = document.createElement('div'); ov.className = 'bl-ov'; document.body.appendChild(ov);
  ['pointerdown', 'touchstart', 'mousedown'].forEach(t => ov.addEventListener(t, e => e.stopPropagation()));
  const mb = document.createElement('button'); mb.className = 'bl-mapbtn'; mb.textContent = 'MAP'; mb.onclick = e => { e.stopPropagation(); showMap(); }; mb.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(mb);
}
const hideOv = () => { ov.classList.remove('on'); ov.innerHTML = ''; mode = 'play'; };
function showMap() {
  state = 'map'; mode = 'map'; const st = starsOf(), nextN = Math.min(NLV, cleared() + 1), tot = totalStars(), toChest = chestsEarned() < SKINS.length - 1 ? 10 - (tot % 10) : 0;
  const openable = chestsEarned() - (owned().length - 1);
  let h = `<div class="bl-top"><span class="bl-chip">${STAR(1)} ${tot}/${NLV * 3}</span><span class="bl-chip">${openable > 0 ? '🎁 chest ready!' : toChest ? '🎁 ' + toChest + ' stars to chest' : '🎁 all skins'}</span><button class="bl-btn alt" style="margin:0;padding:6px 12px;font-size:14px" data-a="skins">PADDLES</button></div><h2>BRICKLASH</h2><small>${cleared() >= NLV ? 'All worlds cleared' : 'World ' + (LEVELS[nextN - 1].w || Math.ceil(nextN / 10)) + ' · level ' + nextN}</small>`;
  WORLDS.forEach((w, wi) => {
    h += `<div class="bl-w" style="--wc:${w.c}"><b>${w.name}</b><small>${w.sub}</small><div class="bl-g">`;
    for (let i = 1; i <= 10; i++) { const n = wi * 10 + i, s = st[n] || 0, lock = n > cleared() + 1; h += `<button class="bl-n ${lock ? 'lock' : ''} ${n === nextN && !lock ? 'next' : ''} ${LEVELS[n - 1].hard ? 'hard' : ''}" data-l="${n}" ${lock ? 'disabled' : ''}>${lock ? '🔒' : n}<i>${lock ? '' : STARS(s)}</i></button>`; }
    h += '</div></div>';
  });
  h += `<div class="bl-w" style="--wc:#ffd84d"><b>DAILY LASH</b><small>${D.streak > 1 ? '🔥 ' + D.streak + '-day streak' : 'new layout every day'} · best ${SAVE.get('dbest', 0).toLocaleString('en-US')}</small><div style="margin-top:8px"><button class="bl-btn" data-a="daily">PLAY DAILY</button></div></div><small style="margin-top:10px">Tomorrow: a new Daily Lash · day ${D.streak + 1}</small>`;
  ov.innerHTML = h; ov.classList.add('on'); ui.els.start && ui.els.start.classList.add('hc-hidden'); H.show(false); padHint.style.display = 'none';
  ov.querySelector('.bl-n.next')?.scrollIntoView({ block: 'center' });
}
ov && ov.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const l = b.dataset.l, a = b.dataset.a;
  if (l) startCampaign(+l); else if (a === 'daily') startDaily(); else if (a === 'map') showMap(); else if (a === 'retry') startCampaign(camp);
  else if (a === 'next') startCampaign(Math.min(NLV, camp + 1)); else if (a === 'skins') showSkins(); else if (a === 'chest') openChest();
  else if (a === 'skin') { skinI = +b.dataset.i; SAVE.set('skin', skinI); showSkins(); }
});
function showSkins(msg = '') {
  const o = owned(); ov.innerHTML = `<div class="bl-card"><h2>PADDLES</h2><small>${msg || 'A chest every 10 stars'}</small><div class="bl-sk">${SKINS.map((s, i) => `<button data-a="skin" data-i="${i}" class="${i === skinI ? 'on' : ''} ${o.includes(i) ? '' : 'no'}" style="background:${s[0]}" ${o.includes(i) ? '' : 'disabled'}></button>`).join('')}</div><small>${o.length}/${SKINS.length} collected</small><br>${chestsEarned() - (o.length - 1) > 0 ? '<button class="bl-btn" data-a="chest">🎁 OPEN CHEST</button>' : ''}<button class="bl-btn alt" data-a="map">MAP</button></div>`;
  ov.classList.add('on');
}
function openChest() {
  const o = owned(), locked = SKINS.map((_, i) => i).filter(i => !o.includes(i)); if (!locked.length) return showSkins();
  const i = locked[Math.floor(Math.random() * locked.length)]; SAVE.set('own', [...o, i]); skinI = i; SAVE.set('skin', i);
  sfx.win(); buzz([20, 30, 40]); showSkins(`NEW PADDLE: ${SKINS[i][1].toUpperCase()}!`);
}
function begin() { hideOv(); H.show(true); padHint.style.display = touchy() ? 'flex' : 'none'; ui.els.start && ui.els.start.classList.add('hc-hidden'); ui.els.lose && ui.els.lose.classList.add('hc-hidden'); score = 0; lives = 3; recorded = false; beatenShown = true; pad.x = FW / 2; H.score(0); if (!sessionBoard) { sessionBoard = true; B.start(); } }
function startCampaign(n) { brk = 0; luckyDone = false; camp = n; seed = n; begin(); startLevel(n); state = 'play'; }
function startDaily() { camp = null; begin(); seed = D.seed || (Number(day8()) ); beatenShown = false; startLevel(1); state = 'play'; }
const day8 = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function campClear() {
  clearT = 0; const bonus = 100 * camp; addScore(bonus); const n = camp, stars = lostBalls === 0 && maxChain >= (n === 1 ? 8 : 6) ? 3 : lostBalls <= 1 ? 2 : 1, goal = `${lostBalls === 0 ? '✓' : '✗'} lose no ball · ${maxChain >= (n === 1 ? 8 : 6) ? '✓' : '✗'} chain ${n === 1 ? 8 : 6} (best ${maxChain})`;
  const st = starsOf(), before = totalStars(); if ((st[n] || 0) < stars) { st[n] = stars; SAVE.set('st', st); }
  sessionPts += score; B.submit(sessionPts); const gained = totalStars() - before;
  ui.pop(stars === 3 ? 'PERFECT!' : `LEVEL ${n} CLEAR!`, '#ffe14d', 38, 30); sfx.win(); buzz([20, 30, 40]); confetti(FW / 2, FH * 0.35); FX.flash('#ffffff', 0.25);
  const chestNow = chestsEarned() - (owned().length - 1) > 0, toChest = 10 - (totalStars() % 10);
  setTimeout(() => {
    if (camp !== n || clearT < 0) return; mode = 'win';
    ov.innerHTML = `<div class="bl-card"><small>${LEVELS[n - 1].name.toUpperCase()}</small><div class="bl-st">${STARS(stars)}</div><h2>${score.toLocaleString('en-US')}</h2><small>${gained ? '+' + gained + (gained > 1 ? ' stars' : ' star') : stars < 3 ? goal : 'perfect'}</small><br>${chestNow ? '<button class="bl-btn" data-a="chest">🎁 OPEN CHEST</button><br>' : `<small>${chestsEarned() < SKINS.length - 1 ? toChest + ' stars to the next chest' : ''}</small><br>`}${n < NLV ? `<small>next: ${LEVELS[n].name}${LEVELS[n].why ? ' · ' + LEVELS[n].why : ''}</small><br><button class="bl-btn" data-a="next">NEXT</button>` : ''}<button class="bl-btn alt" data-a="retry">RETRY</button><button class="bl-btn alt" data-a="map">MAP</button><br><small>Tomorrow: new Daily Lash · day ${D.streak + 1}</small></div>`;
    ov.classList.add('on');
  }, 1300);
}
function campFail() {
  state = 'lost'; mode = 'fail'; const left = bricks.filter(b => b.alive && b.hp > 0).length, tot = Math.max(totBricks, left), n = camp;
  FX.shake(8);
  setTimeout(() => {
    if (camp !== n || state !== 'lost') return;
    ov.innerHTML = `<div class="bl-card"><h2>${left <= 4 ? 'SO CLOSE!' : 'OUT OF BALLS'}</h2><div class="bl-st" style="font-size:40px">${left}</div><small>brick${left === 1 ? '' : 's'} left of ${tot}</small><br><button class="bl-btn" data-a="retry">TRY AGAIN</button><button class="bl-btn alt" data-a="map">MAP</button><br><small>${LEVELS[n - 1].why}</small></div>`;
    ov.classList.add('on');
  }, 500);
}

// ---------------------------------------------------------------- test hooks + bot (tracks the ball, sometimes misjudges)
function landX(b) {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  if (vy <= 0) { const t = (y - 40) / -vy; x += vx * t; y = 40; vy = -vy; }
  x += vx * (PY - y) / vy; const P = FW - 2 * BR; let m = ((x - BR) % (2 * P) + 2 * P) % (2 * P); return BR + (m > P ? 2 * P - m : m);
}
window.__game = {
  get state() { return state; }, get camp() { return camp; }, get bricksLeft() { return bricks.filter(b => b.alive && b.hp > 0).length; },
  stars: () => starsOf(), startCampaign: n => startCampaign(n),
  // QA: play level n with the bot in fixed 1/60 s steps, no waiting. Returns { cleared, lost, t }.
  sim(n, maxSec = 240, err = 0) {
    startCampaign(n); botMiss = err; let t = 0, clearedOk = false;
    while (t < maxSec) {
      if (Math.floor(t * 60) % 6 === 0) { window.__game.bot(); }
      update(1 / 60); t += 1 / 60;
      if (clearT >= 0) { clearedOk = true; break; } if (state === 'lost') break;
    }
    return { cleared: clearedOk, lost: lostBalls, t: Math.round(t), left: bricks.filter(b => b.alive && b.hp > 0).length };
  }, get level() { return level; }, get score() { return score; }, get lives() { return lives; },
  bot() {
    if (state !== 'play') return;
    if (balls.some(b => b.stuck)) { if (Math.random() < 0.5) launch(); return; }
    const live = balls.filter(b => !b.stuck); if (!live.length) return;
    const b = live.reduce((a, c) => (c.vy > 0 && (a.vy <= 0 || c.y > a.y) ? c : a), live[0]);
    const desc = b.vy > 0; if (desc && !botDesc) botErr = Math.random() < botMiss ? (Math.random() < 0.5 ? -1 : 1) * (pad.w * 0.6 + 14) : (Math.random() - 0.5) * pad.w * 0.5; botDesc = desc;
    let tx = landX(b) + botErr;
    const cap = caps.find(c => c.y > PY - 160); if (cap && (!desc || b.y < PY - 260)) tx = cap.x;
    botT = tx;
  },
};

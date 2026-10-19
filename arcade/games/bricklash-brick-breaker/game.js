// Bricklash — the classic brick breaker: a paddle, a ball, a wall of glowing bricks. Every level is a fresh
// symmetric layout built from a seed. Catch falling capsules for multi-ball, a wide paddle, fireball, lasers,
// slow-mo and extra lives. Endless; three lives.
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, BASE_CSS, stage2d, rr, sprite, blit, fx as mkfx, hud as mkhud, keys, touchy, dressStart, paused } from './neo.js';

const NAME = 'Bricklash: Brick Breaker';
const SAVE = store('bricklash');
let best = SAVE.get('best', 0);
const F = flow('bricklash', { par: 3000, warmup: 400 });
css(BASE_CSS + `body{--acc:#3dd6ff;--acc2:#ffd84d;--bgA:#0a0f2a;--bgB:#123a6e;--bgC:#050818}
.bl-pad{position:fixed;left:16px;right:16px;bottom:calc(12px + env(safe-area-inset-bottom));height:62px;z-index:3;border-radius:22px;border:1.5px dashed rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;gap:10px;font:800 12px 'Baloo 2',system-ui;letter-spacing:.2em;color:rgba(255,255,255,.4);pointer-events:none}
.bl-pad i{display:block;width:44px;height:4px;border-radius:4px;background:rgba(255,255,255,.18)}`);
const ui = createUI({ title: 'BRICKLASH', hint: 'Tap to play', hand: '👆', progress: false, score: false });
const D = daily('bricklash', ui, { name: NAME });
const B = board({ game: 'bricklash', label: 'Points', limits: { maxRun: 400000, maxPerSec: 600 }, corner: 'tl' });
const SD = dressStart(ui, { kicker: 'BRICK BREAKER', line: 'Drag anywhere to move the paddle · tap to launch<br>catch the capsules', best });
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
let state = 'ready', score = 0, lives = 3, level = 1, recorded = false, beatenShown = false, seed = 1;
let bricks = [], balls = [], caps = [], shots = [], chain = 0, levelT = 0, intro = 0, clearT = -1, stuckT = 0;
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
function pickPU(r) { const q = r(); return q < 0.24 ? 'multi' : q < 0.44 ? 'wide' : q < 0.6 ? 'fire' : q < 0.76 ? 'laser' : q < 0.93 ? 'slow' : 'life'; }
const baseSpeed = () => Math.min(640, (370 + (level - 1) * 15) * F.k(score)) * (timers.slow > 0 ? 0.72 : 1);
function newBall(stuck = true) { return { x: pad.x, y: PY - BR - 7, vx: 0, vy: 0, stuck, off: (Math.random() - 0.5) * 20, trail: [], sp: baseSpeed() }; }
function launch() {
  for (const b of balls) if (b.stuck) { b.stuck = false; const a = -Math.PI / 2 + (b.off / 40) * 0.9 + (Math.random() - 0.5) * 0.2; b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; tone(660, 0.08, 'triangle', 0.1, 1.4); buzz(8); }
}
function startLevel(lv) {
  level = lv; bricks = genLevel(lv); caps = []; shots = []; balls = [newBall()]; intro = 1; clearT = -1; chain = 0; stuckT = 0;
  for (const k in timers) timers[k] = 0;
}
function reset() { seed = D.seed || (Date.now() % 1e6) + 3; score = 0; lives = 3; recorded = false; beatenShown = false; pad.x = FW / 2; H.score(0); startLevel(1); }
function addScore(n) { score += n; H.score(score); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(FW / 2, FH * 0.4); sfx.win(); } }
function confetti(x, y) { const [sx, sy] = toScr(x, y); FX.burst(sx, sy, ['#ff5fa8', '#ffe14d', '#3dffc0', '#3dd6ff', '#9a7bff', '#fff'], 60, { speed: 420, life: 1.3, size: 6, grav: 380, drag: 1.4 }); }

function breakBrick(b, ball) {
  if (b.hp === -1) { b.hit = 1; tone(900, 0.04, 'square', 0.04, 1); return; }
  b.hp--; b.hit = 1;
  if (b.hp > 0) { tone(420 + b.hp * 80, 0.05, 'triangle', 0.09, 0.9); buzz(5); return; }
  b.alive = false; chain++;
  const mult = 1 + Math.floor(chain / 5);
  const pts = 10 * b.max * mult; addScore(pts);
  const [sx, sy] = toScr(b.x + BW / 2, b.y + BH / 2);
  FX.burst(sx, sy, [b.c, '#ffffff'], 14, { speed: 240, life: 0.6, size: 4 * L.k, grav: 500 });
  FX.ring(sx, sy, b.c, 4, 30 * L.k, 0.35, 3);
  FX.shake(2 + Math.min(4, chain * 0.3));
  note(64 + (chain % 12) + (chain > 12 ? 12 : 0), 0.14, 0.11); buzz(8);
  if (mult > 1 && chain % 5 === 0) FX.text(sx, sy - 6, `×${mult}`, '#ffe14d', 24);
  if (b.pu) caps.push({ x: b.x + BW / 2, y: b.y + BH / 2, t: b.pu, vy: 110, rot: 0 });
  if (!bricks.some(q => q.alive && q.hp > 0)) levelClear();
}
function levelClear() {
  clearT = 0; const bonus = 250 * level; addScore(bonus);
  ui.pop(`LEVEL ${level} CLEAR!`, '#ffe14d', 38, 30); sfx.win(); buzz([20, 30, 40]); confetti(FW / 2, FH * 0.35); FX.flash('#ffffff', 0.25);
  FX.text(S.w / 2, S.h * 0.42, `+${bonus}`, '#3dffc0', 30, 1.4);
}
function loseBall() {
  lives--; FX.shake(10); FX.flash('#ff3d6e', 0.25); sfx.fail(); buzz([40, 30, 60]); chain = 0;
  for (const k in timers) timers[k] = 0;
  if (lives <= 0) return gameOver();
  balls = [newBall()]; caps = []; shots = []; stuckT = 0;
  ui.pop(lives === 1 ? 'LAST BALL!' : `${lives} BALLS LEFT`, '#ff7a9a', 32, 40);
}
function gameOver() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best && score > 0; best = Math.max(best, score); SAVE.set('best', best); SD.setBest(best);
  ui.lose(nb ? 'NEW BEST!' : 'GAME OVER', `Score ${score.toLocaleString('en-US')} · Level ${level} · Best ${best.toLocaleString('en-US')}`);
}
function catchCap(c) {
  const p = PU[c.t]; FX.text(...toScr(c.x, PY - 30), p.name, p.c, 22, 1.1); FX.ring(...toScr(c.x, PY), p.c, 6, 60 * L.k, 0.45, 4);
  tone(523, 0.08, 'triangle', 0.1, 1.5); setTimeout(() => tone(784, 0.12, 'triangle', 0.1, 1.3), 70); buzz(14); addScore(50);
  if (c.t === 'multi') { const nb = []; for (const b of balls.slice(0, 6)) { if (b.stuck) { launch(); } for (const da of [-0.5, 0.5]) { const a = Math.atan2(b.vy || -1, b.vx) + da; const sp = b.sp; nb.push({ ...b, trail: [], stuck: false, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); } } balls.push(...nb); }
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
    const off = Math.max(-1, Math.min(1, (b.x - pad.x) / (hw + BR))), a = -Math.PI / 2 + off * 1.05;
    b.sp = Math.min(b.sp + 3, baseSpeed() * 1.25); b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; b.y = PY - 6 - BR;
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
  if (clearT >= 0) { clearT += dt; if (clearT > 1.6) startLevel(level + 1); return; }
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
function cardGo() { for (const k of ['start', 'lose']) { const c = ui.els[k]; if (!c.classList.contains('hc-hidden')) { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return; } } }
ui.onTap(() => { reset(); state = 'play'; B.start(); });

// ---------------------------------------------------------------- layout + drawing
const L = { k: 1, ox: 0, oy: 0 };
const toScr = (x, y) => [L.ox + x * L.k, L.oy + y * L.k];
S.onResize = (w, h) => {
  const t = touchy(); padHint.style.display = t ? 'flex' : 'none';
  const top = 64, bottom = t ? 84 : 16;
  L.k = Math.min((w - 16) / FW, (h - top - bottom) / FH); L.ox = (w - FW * L.k) / 2; L.oy = top + (h - top - bottom - FH * L.k) / 2;
};
S.fit();
function brickSprite(c, hp, max, k) {
  return sprite('b' + c + hp + max, Math.round(BW * k), Math.round(BH * k), S.dpr, Math.ceil(10 * k), (x, w, h) => {
    if (hp === -1) {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d8deef'); g.addColorStop(1, '#7d86a3'); rr(x, 0, 0, w, h, h * 0.3); x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.stroke(); x.fillStyle = 'rgba(40,46,70,.5)'; for (const px of [0.18, 0.82]) { x.beginPath(); x.arc(w * px, h / 2, h * 0.12, 0, 7); x.fill(); } return;
    }
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
    const sp = brickSprite(b.c, b.hp, b.max, k); ctx.globalAlpha = 1 - d * 0.8;
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
  { const [x, y] = toScr(pad.x, PY), w = pad.w * k * (1 + pad.sq * 0.08), h = 12 * k * (1 - pad.sq * 0.25), col = timers.fire > 0 ? '#ff8a3d' : timers.laser > 0 ? '#ff4d6d' : '#3dd6ff';
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 22; rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, col); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    if (timers.laser > 0) { ctx.fillStyle = '#ffd0da'; for (const s of [-1, 1]) { rr(ctx, x + s * (w / 2 - 6 * k) - 3 * k, y - h / 2 - 6 * k, 6 * k, 8 * k, 2 * k); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; rr(ctx, x - w / 2 + h * 0.6, y - h / 2 + h * 0.18, w * 0.35, h * 0.2, h * 0.1); ctx.fill(); }
  // balls
  for (const b of balls) {
    const col = timers.fire > 0 ? '#ff8a3d' : '#ffffff';
    ctx.globalCompositeOperation = 'lighter';
    b.trail.forEach(([tx, ty], i) => { const [x, y] = toScr(tx, ty); ctx.globalAlpha = (i / b.trail.length) * 0.35; ctx.fillStyle = timers.fire > 0 ? '#ff6a2a' : '#3dd6ff'; ctx.beginPath(); ctx.arc(x, y, BR * k * (0.4 + 0.6 * i / b.trail.length), 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const [x, y] = toScr(b.x, b.y); ctx.save(); ctx.shadowColor = timers.fire > 0 ? '#ff6a2a' : '#7fe8ff'; ctx.shadowBlur = 18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, BR * k, 0, 7); ctx.fill(); ctx.restore();
    if (timers.fire > 0 && Math.random() < 0.6) FX.burst(x, y, ['#ffcf3f', '#ff7a1a', '#ff3d3d'], 1, { speed: 40, life: 0.35, size: 4 * k, grav: -60 });
  }
  if (state === 'play' && balls.some(b => b.stuck) && clearT < 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + 0.35 * Math.sin(t * 5)) + ')'; ctx.font = `800 ${Math.round(16 * k)}px 'Baloo 2',system-ui`; ctx.textAlign = 'center'; ctx.fillText(touchy() ? 'TAP TO LAUNCH' : 'CLICK OR SPACE TO LAUNCH', fx0 + fw / 2, fy0 + (PY - 70) * k); }
  ctx.restore();
  // lives + level + active power timers (top strip of the field)
  ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(13 * k)}px 'Baloo 2',system-ui`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('LEVEL ' + level, fx0 + 4, fy0 + 12 * k);
  for (let i = 0; i < lives; i++) { const x = fx0 + fw - 8 - i * 22 * k; ctx.save(); ctx.shadowColor = '#3dd6ff'; ctx.shadowBlur = 8; rr(ctx, x - 16 * k, fy0 + 9 * k, 16 * k, 6 * k, 3 * k); ctx.fillStyle = '#3dd6ff'; ctx.fill(); ctx.restore(); }
  let tx = fx0 + fw / 2 - 60 * k; for (const [key, v] of Object.entries(timers)) if (v > 0) { const p = PU[key]; ctx.fillStyle = p.c; ctx.globalAlpha = v < 2 ? 0.5 + 0.5 * Math.sin(t * 16) : 1; rr(ctx, tx, fy0 + 5 * k, 26 * k, 14 * k, 7 * k); ctx.fill(); ctx.fillStyle = '#16102e'; ctx.textAlign = 'center'; ctx.fillText(p.t, tx + 13 * k, fy0 + 12.5 * k); ctx.textAlign = 'left'; ctx.globalAlpha = 1; tx += 30 * k; }
  FX.draw(ctx); ctx.restore(); FX.drawFlash(ctx, S.w, S.h);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.04, (now - last) / 1000); last = now;
  if (!paused()) update(dt);
  FX.update(dt); H.stats([['BEST', Math.max(best, score).toLocaleString('en-US')]]); draw(now / 1000);
  requestAnimationFrame(frame);
}
reset(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks + bot (tracks the ball, sometimes misjudges)
function landX(b) {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  if (vy <= 0) { const t = (y - 40) / -vy; x += vx * t; y = 40; vy = -vy; }
  x += vx * (PY - y) / vy; const P = FW - 2 * BR; let m = ((x - BR) % (2 * P) + 2 * P) % (2 * P); return BR + (m > P ? 2 * P - m : m);
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get lives() { return lives; },
  bot() {
    if (state !== 'play') return;
    if (balls.some(b => b.stuck)) { if (Math.random() < 0.5) launch(); return; }
    const live = balls.filter(b => !b.stuck); if (!live.length) return;
    const b = live.reduce((a, c) => (c.vy > 0 && (a.vy <= 0 || c.y > a.y) ? c : a), live[0]);
    const desc = b.vy > 0; if (desc && !botDesc) botErr = Math.random() < 0.36 ? (Math.random() < 0.5 ? -1 : 1) * (pad.w * 0.6 + 14) : (Math.random() - 0.5) * pad.w * 0.5; botDesc = desc;
    let tx = landX(b) + botErr;
    const cap = caps.find(c => c.y > PY - 160); if (cap && (!desc || b.y < PY - 260)) tx = cap.x;
    botT = tx;
  },
};

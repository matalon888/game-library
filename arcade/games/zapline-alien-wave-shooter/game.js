// Zapline — the classic alien wave shooter. Rows of aliens march side to side and step down at the edges,
// faster as their numbers shrink. Drag to slide your ship; it fires on its own. Hide behind the four shields
// (bombs crumble them; your own shots pass through). Round bombs can be shot down, zigzag bolts can't., and tag the bonus saucer that zips across the top. Endless waves, three ships.
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, BASE_CSS, stage2d, rr, sprite, blit, fx as mkfx, hud as mkhud, keys, touchy, dressStart, paused } from './neo.js';

const NAME = 'Zapline: Alien Wave Shooter';
const SAVE = store('zapline');
let best = SAVE.get('best', 0);
const F = flow('zapline', { par: 2500, warmup: 300 });
css(BASE_CSS + `body{--acc:#b45bff;--acc2:#5effc8;--bgA:#05071a;--bgB:#1c1250;--bgC:#020310}
.zl-pad{position:fixed;left:16px;right:16px;bottom:calc(12px + env(safe-area-inset-bottom));height:62px;z-index:3;border-radius:22px;border:1.5px dashed rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;gap:10px;font:800 12px 'Baloo 2',system-ui;letter-spacing:.2em;color:rgba(255,255,255,.4);pointer-events:none}
.zl-pad i{display:block;width:44px;height:4px;border-radius:4px;background:rgba(255,255,255,.18)}`);
const ui = createUI({ title: 'ZAPLINE', hint: 'Tap to play', hand: '👆', progress: false, score: false });
const D = daily('zapline', ui, { name: NAME });
const B = board({ game: 'zapline', label: 'Points', limits: { maxRun: 200000, maxPerSec: 300 }, corner: 'tl' });
const SD = dressStart(ui, { kicker: 'ALIEN WAVE SHOOTER', line: 'Drag anywhere to slide your ship · it fires itself<br>shoot round bombs · dodge zigzag bolts', best });
ui.els.lose.querySelector('.hint').textContent = 'Tap to play again';
const S = stage2d(), FX = mkfx(), H = mkhud('SCORE');
let ctx = S.ctx;
const padHint = document.createElement('div'); padHint.className = 'zl-pad'; padHint.innerHTML = '<i></i>DRAG<i></i>'; document.body.appendChild(padHint);

const FW = 360, FH = 640, SHIPY = FH - 42, COLS = 9, ROWS = 5, AW = 34, AH = 30, TOP = 96;
const KINDS = [
  { name: 'Zibb', c: '#ff5fd0', pts: 30 },   // three-eyed jelly orb (top row)
  { name: 'Flapper', c: '#5effc8', pts: 20 }, // winged bat-orb (rows 2-3)
  { name: 'Blobbo', c: '#ffc84d', pts: 10 },  // antenna slime (rows 4-5)
];
const rowKind = r => r === 0 ? 0 : r < 3 ? 1 : 2;
let state = 'ready', score = 0, lives = 3, wave = 1, recorded = false, beatenShown = false, R = Math.random, runT0 = 0;
let aliens = [], dirX = 1, stepT = 0, frame2 = 0, dropPending = false, bullets = [], bombs = [], shields = [], ufo = null, ufoT = 0, fireCD = 0;
let ship = { x: FW / 2, kv: 0, dead: 0, inv: 0, flash: 0 }, botT = null, clearT = -1, stars = [], marchI = 0;
for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * FW, y: Math.random() * FH, z: 0.3 + Math.random() * 0.7 });

function buildShields() {
  shields = [];
  const shape = ['..XXXXXXX..', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXX.....XXX', 'XX.......XX'];
  for (let s = 0; s < 4; s++) { const x0 = 30 + s * 86, y0 = SHIPY - 92; shape.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'X') shields.push({ x: x0 + rx * 4, y: y0 + ry * 4, hp: 2 }); })); }
}
function buildWave(w) {
  wave = w; aliens = []; const drop = Math.min(5, w - 1) * 12;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) aliens.push({ r, c, x: 24 + c * AW + AW / 2, y: TOP + drop + r * AH, k: rowKind(r), alive: true, hit: 0, born: (r * COLS + c) * 0.012 });
  dirX = 1; stepT = 0; bullets = []; bombs = []; clearT = -1; ufo = null; ufoT = 14 + R() * 8;
  if (w === 1 || w % 3 === 1) buildShields();
}
const aliveN = () => aliens.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
const stepInterval = () => Math.max(0.035, (0.62 * aliveN() / (ROWS * COLS) + 0.03) / (1 + (wave - 1) * 0.1) / F.k(score));
function reset() { R = rng(D.seed || (Date.now() % 1e9) + 13); score = 0; lives = 3; recorded = false; beatenShown = false; ship = { x: FW / 2, kv: 0, dead: 0, inv: 0, flash: 0 }; H.score(0); buildWave(1); }
function addScore(n) { score += n; H.score(score); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(); sfx.win(); } }
function confetti() { FX.burst(S.w / 2, S.h * 0.4, ['#ff5fd0', '#5effc8', '#ffc84d', '#7aa2ff', '#fff'], 60, { speed: 420, life: 1.3, size: 6, grav: 380, drag: 1.4 }); }
const toScr = (x, y) => [L.ox + x * L.k, L.oy + y * L.k];

function march() {
  const live = aliens.filter(a => a.alive); if (!live.length) return;
  frame2 ^= 1; tone([98, 92, 87, 82][marchI++ % 4], 0.09, 'square', 0.05, 0.9);
  if (dropPending) { for (const a of live) a.y += 12; dirX = -dirX; dropPending = false; }
  else { for (const a of live) a.x += dirX * 6; const minX = Math.min(...live.map(a => a.x)), maxX = Math.max(...live.map(a => a.x)); if (maxX + AW / 2 > FW - 8 || minX - AW / 2 < 8) dropPending = true; }
  const low = Math.max(...live.map(a => a.y));
  for (const s of shields) if (s.hp > 0 && live.some(a => Math.abs(a.x - s.x) < AW / 2 && Math.abs(a.y - s.y) < AH / 2)) s.hp = 0;
  if (low + AH / 2 >= SHIPY - 14) { ship.dead = 99; lives = 0; boom(ship.x, SHIPY, '#7aa2ff', 40); gameOver('INVADED!'); }
}
function fire() {
  if (bullets.length >= 2 || ship.dead > 0) return;
  bullets.push({ x: ship.x, y: SHIPY - 16 }); fireCD = 0.36; ship.flash = 1; tone(880, 0.06, 'square', 0.035, 0.5);
}
function dropBomb() {
  const live = aliens.filter(a => a.alive); if (!live.length) return;
  const cols = {}; for (const a of live) if (!cols[a.c] || a.y > cols[a.c].y) cols[a.c] = a;
  const shooters = Object.values(cols); let a = shooters[Math.floor(R() * shooters.length)];
  if (R() < 0.35) a = shooters.reduce((m, s) => Math.abs(s.x - ship.x) < Math.abs(m.x - ship.x) ? s : m, shooters[0]);
  bombs.push({ x: a.x, y: a.y + AH / 2 - 4, vy: 170 + wave * 12, t: 0, kind: Math.floor(R() * 2) });
}
function boom(x, y, c, n = 18) { const [sx, sy] = toScr(x, y); FX.burst(sx, sy, [c, '#ffffff'], n, { speed: 240, life: 0.6, size: 4 * L.k, grav: 80 }); FX.ring(sx, sy, c, 4, 34 * L.k, 0.35, 3); }
function hitShield(x, y, r) { let hit = false; for (const s of shields) if (s.hp > 0 && Math.abs(s.x + 2 - x) < r && Math.abs(s.y + 2 - y) < r) { s.hp--; hit = true; } return hit; }
function shieldAt(x, y) { return shields.find(s => s.hp > 0 && x >= s.x - 1 && x <= s.x + 5 && y >= s.y - 1 && y <= s.y + 5); }
function killShip() {
  if (ship.dead > 0 || ship.inv > 0) return;
  lives--; ship.dead = 1.6; bombs = []; boom(ship.x, SHIPY, '#7aa2ff', 36); FX.shake(12); FX.flash('#ff3d6e', 0.3); sfx.smash(); buzz([40, 30, 90]);
  if (lives <= 0) setTimeout(() => gameOver('SHOT DOWN!'), 900);
  else ui.pop(lives === 1 ? 'LAST SHIP!' : `${lives} SHIPS LEFT`, '#ff7ad9', 30, 40);
}
function gameOver(why) {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best && score > 0; best = Math.max(best, score); SAVE.set('best', best); SD.setBest(best);
  sfx.fail(); ui.lose(nb ? 'NEW BEST!' : why, `Score ${score.toLocaleString('en-US')} · Wave ${wave} · Best ${best.toLocaleString('en-US')}`);
}
function update(dt) {
  for (const s of stars) { s.y += s.z * 22 * dt; if (s.y > FH) { s.y = 0; s.x = Math.random() * FW; } }
  if (state !== 'play') return;
  if (clearT >= 0) { clearT += dt; if (clearT > 1.6) buildWave(wave + 1); return; }
  // ship
  if (ship.dead > 0) { ship.dead -= dt; if (ship.dead <= 0 && lives > 0) { ship.inv = 1.5; ship.x = FW / 2; } }
  else {
    if (ship.kv) ship.x += ship.kv * 330 * dt;
    if (botT !== null) { const d = botT - ship.x, m = 330 * dt; ship.x += Math.max(-m, Math.min(m, d)); }
    ship.x = Math.max(18, Math.min(FW - 18, ship.x));
    fireCD -= dt; if (fireCD <= 0) fire();
  }
  ship.inv = Math.max(0, ship.inv - dt); ship.flash = Math.max(0, ship.flash - dt * 8);
  // aliens
  stepT += dt; const iv = stepInterval(); if (stepT >= iv) { stepT = 0; march(); if (state !== 'play') return; }
  const bombRate = Math.min(2.8, 0.75 + wave * 0.2) * F.k(score);
  if (bombs.length < 3 + Math.floor(wave / 2) && R() < bombRate * dt) dropBomb();
  for (const a of aliens) { a.hit = Math.max(0, a.hit - dt * 5); a.born = Math.max(0, a.born - dt); }
  // ufo
  ufoT -= dt; if (!ufo && ufoT <= 0) { const l = R() < 0.5; ufo = { x: l ? -24 : FW + 24, v: (l ? 1 : -1) * (80 + wave * 4), pts: [50, 100, 150, 200, 300][Math.floor(R() * 5)] }; ufoT = 16 + R() * 10; }
  if (ufo) { ufo.x += ufo.v * dt; if (Math.random() < 0.1) tone(ufo.x % 2 > 1 ? 1200 : 1000, 0.05, 'sine', 0.025, 1.2); if (ufo.x < -40 || ufo.x > FW + 40) ufo = null; }
  // bullets
  for (const b of bullets) {
    b.y -= 640 * dt;
    for (const a of aliens) if (a.alive && Math.abs(a.x - b.x) < AW * 0.42 && Math.abs(a.y - b.y) < AH * 0.42) {
      a.alive = false; b.dead = true; const K = KINDS[a.k]; addScore(K.pts * (1 + Math.floor((wave - 1) / 3)));
      boom(a.x, a.y, K.c); FX.text(...toScr(a.x, a.y - 8), '' + K.pts, K.c, 16, 0.6); FX.shake(2.5); buzz(8);
      tone(300 + a.k * 60, 0.12, 'sawtooth', 0.06, 0.4); note(76 - a.k * 5, 0.1, 0.07);
      if (!aliens.some(q => q.alive)) waveClear();
      break;
    }
    if (!b.dead && ufo && Math.abs(ufo.x - b.x) < 22 && Math.abs(64 - b.y) < 12) {
      b.dead = true; addScore(ufo.pts); boom(ufo.x, 64, '#ff4d6d', 34); FX.text(...toScr(ufo.x, 64), '+' + ufo.pts, '#ffe14d', 28, 1.2); FX.flash('#ffe14d', 0.15); sfx.coin(); buzz([10, 20, 10]); ufo = null;
    }
    for (const m of bombs) if (!m.dead && !m.kind && Math.abs(m.x - b.x) < 5 && Math.abs(m.y - b.y) < 10) { m.dead = true; b.dead = true; FX.burst(...toScr(m.x, m.y), ['#fff', '#ff7ad9'], 6, { speed: 120, life: 0.3, size: 3 }); }
    if (b.y < 40) b.dead = true;
  }
  bullets = bullets.filter(b => !b.dead);
  // bombs
  for (const m of bombs) {
    m.y += m.vy * dt; m.t += dt;
    if (shieldAt(m.x, m.y)) { hitShield(m.x, m.y, 6); m.dead = true; FX.burst(...toScr(m.x, m.y), '#ff7ad9', 5, { speed: 90, life: 0.3, size: 3 }); continue; }
    if (ship.dead <= 0 && Math.abs(m.x - ship.x) < 16 && m.y > SHIPY - 12 && m.y < SHIPY + 10) { m.dead = true; killShip(); }
    if (m.y > FH) m.dead = true;
  }
  bombs = bombs.filter(m => !m.dead);
}
function waveClear() {
  clearT = 0; const bonus = 300 * wave; addScore(bonus); ui.pop(`WAVE ${wave} CLEAR!`, '#5effc8', 36, 30); sfx.win(); confetti(); FX.text(S.w / 2, S.h * 0.45, '+' + bonus, '#ffe14d', 30, 1.3);
}

// ---------------------------------------------------------------- input
let drag = null;
S.cv.addEventListener('pointerdown', e => { if (state !== 'play') return; drag = { x: e.clientX }; botT = null; });
addEventListener('pointermove', e => {
  if (state !== 'play') return;
  if (e.pointerType === 'mouse' && !touchy()) { botT = null; ship.x = (e.clientX - L.ox) / L.k; return; }
  if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; ship.x += dx / L.k * 1.3;
});
addEventListener('pointerup', () => drag = null); addEventListener('pointercancel', () => drag = null);
keys({
  'ArrowLeft|a|A': { press: () => { ship.kv = -1; botT = null; }, release: () => { if (ship.kv < 0) ship.kv = 0; } },
  'ArrowRight|d|D': { press: () => { ship.kv = 1; botT = null; }, release: () => { if (ship.kv > 0) ship.kv = 0; } },
  ' |Enter': { press: () => { for (const k of ['start', 'lose']) { const c = ui.els[k]; if (!c.classList.contains('hc-hidden')) { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return; } } } },
});
ui.onTap(() => { reset(); state = 'play'; B.start(); runT0 = performance.now(); });

// ---------------------------------------------------------------- drawing
const L = { k: 1, ox: 0, oy: 0 };
S.onResize = (w, h) => {
  const t = touchy(); padHint.style.display = t ? 'flex' : 'none';
  const top = 62, bottom = t ? 84 : 16;
  L.k = Math.min((w - 12) / FW, (h - top - bottom) / FH); L.ox = (w - FW * L.k) / 2; L.oy = top + (h - top - bottom - FH * L.k) / 2;
};
S.fit();
function alienSprite(k, f, z) {
  const K = KINDS[k], w = Math.round(AW * z), h = Math.round(AH * z);
  return sprite('al' + k + f, w, h, S.dpr, Math.ceil(10 * z), (x) => {
    x.translate(w / 2, h / 2); const s = z, c = K.c;
    x.shadowColor = c; x.shadowBlur = 10 * s; x.fillStyle = c; x.strokeStyle = c; x.lineCap = 'round'; x.lineWidth = 2.2 * s;
    if (k === 0) {   // three-eyed jelly orb with dangling frills
      x.beginPath(); x.arc(0, -2 * s, 10 * s, Math.PI, 0); x.quadraticCurveTo(10 * s, 6 * s, 0, 6 * s); x.quadraticCurveTo(-10 * s, 6 * s, -10 * s, -2 * s); x.fill();
      for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(i * 5 * s, 5 * s); x.quadraticCurveTo(i * 5 * s + (f ? 3 : -3) * s, 9 * s, i * 5 * s, 12 * s); x.stroke(); }
      x.shadowBlur = 0; for (let i = -1; i <= 1; i++) { x.fillStyle = '#fff'; x.beginPath(); x.arc(i * 4.5 * s, -2 * s - Math.abs(i) * -1 * s, 2.4 * s, 0, 7); x.fill(); x.fillStyle = '#2a0b30'; x.beginPath(); x.arc(i * 4.5 * s, -1.6 * s, 1.2 * s, 0, 7); x.fill(); }
    } else if (k === 1) {   // bat-winged orb
      const wy = f ? -6 : 2; x.beginPath(); x.moveTo(-5 * s, 0); x.quadraticCurveTo(-14 * s, wy * s, -16 * s, (wy + 6) * s); x.quadraticCurveTo(-11 * s, 3 * s, -5 * s, 5 * s); x.fill();
      x.beginPath(); x.moveTo(5 * s, 0); x.quadraticCurveTo(14 * s, wy * s, 16 * s, (wy + 6) * s); x.quadraticCurveTo(11 * s, 3 * s, 5 * s, 5 * s); x.fill();
      x.beginPath(); x.arc(0, 1 * s, 8 * s, 0, 7); x.fill(); x.shadowBlur = 0;
      x.fillStyle = '#0b2a22'; x.beginPath(); x.ellipse(-3 * s, 0, 2 * s, 2.6 * s, 0, 0, 7); x.ellipse(3 * s, 0, 2 * s, 2.6 * s, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.fillRect(-2 * s, 4.5 * s, 1.4 * s, 2 * s); x.fillRect(0.6 * s, 4.5 * s, 1.4 * s, 2 * s);
    } else {   // antenna slime
      x.beginPath(); x.moveTo(-12 * s, 8 * s); x.quadraticCurveTo(-13 * s, -8 * s, 0, -8 * s); x.quadraticCurveTo(13 * s, -8 * s, 12 * s, 8 * s);
      for (let i = 0; i < 4; i++) x.quadraticCurveTo((9 - i * 6) * s, (f ? 12 : 10) * s - (i % 2) * 2 * s, (6 - i * 6) * s, 8 * s); x.fill();
      x.beginPath(); x.moveTo(0, -8 * s); x.lineTo((f ? 4 : -4) * s, -14 * s); x.stroke(); x.beginPath(); x.arc((f ? 4 : -4) * s, -14 * s, 2.4 * s, 0, 7); x.fill();
      x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(-4.5 * s, 0, 3.2 * s, 0, 7); x.arc(4.5 * s, 0, 3.2 * s, 0, 7); x.fill();
      x.fillStyle = '#3a2400'; x.beginPath(); x.arc(-4.5 * s, 0.8 * s, 1.6 * s, 0, 7); x.arc(4.5 * s, 0.8 * s, 1.6 * s, 0, 7); x.fill();
    }
  });
}
function drawShip(x, y, k, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.globalCompositeOperation = 'lighter'; const fl = 6 + Math.sin(t * 40) * 2; const g = ctx.createRadialGradient(0, 12, 0, 0, 12, 10 + fl); g.addColorStop(0, 'rgba(94,255,200,.9)'); g.addColorStop(1, 'rgba(94,255,200,0)'); ctx.fillStyle = g; ctx.fillRect(-14, 4, 28, 26); ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = '#7aa2ff'; ctx.shadowBlur = 14; ctx.fillStyle = '#7aa2ff';
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(6, -10, 7, -2); ctx.lineTo(17, 6); ctx.quadraticCurveTo(18, 11, 13, 11); ctx.lineTo(-13, 11); ctx.quadraticCurveTo(-18, 11, -17, 6); ctx.lineTo(-7, -2); ctx.quadraticCurveTo(-6, -10, 0, -16); ctx.fill();
  ctx.shadowBlur = 0; const gg = ctx.createLinearGradient(0, -16, 0, 11); gg.addColorStop(0, 'rgba(255,255,255,.6)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gg; ctx.fill();
  ctx.fillStyle = '#5effc8'; ctx.beginPath(); ctx.ellipse(0, -4, 3.6, 5.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-1, -6, 1.2, 2, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawUfo(x, y, k, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 16; ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.ellipse(0, 2, 22, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd0da'; ctx.beginPath(); ctx.ellipse(0, -3, 10, 8, 0, Math.PI, 0); ctx.fill(); ctx.shadowBlur = 0;
  for (let i = -2; i <= 2; i++) { ctx.fillStyle = Math.floor(t * 8 + i) % 2 ? '#ffe14d' : '#fff'; ctx.beginPath(); ctx.arc(i * 8, 3, 1.8, 0, 7); ctx.fill(); }
  ctx.restore();
}
function draw(t) {
  S.begin(); const k = L.k, [sx, sy] = FX.offset(); ctx.save(); ctx.translate(sx, sy);
  const fx0 = L.ox, fy0 = L.oy, fw = FW * k, fh = FH * k;
  // starfield
  for (const s of stars) { const [x, y] = toScr(s.x, s.y); ctx.globalAlpha = 0.25 + s.z * 0.6 * (0.7 + 0.3 * Math.sin(t * 3 + s.x)); ctx.fillStyle = '#cfd8ff'; ctx.fillRect(x, y, s.z * 2, s.z * 2); }
  ctx.globalAlpha = 1;
  // field frame + ground line
  rr(ctx, fx0 - 4, fy0 + 30 * k, fw + 8, fh - 30 * k + 4, 18); ctx.strokeStyle = 'rgba(180,91,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  const gy = fy0 + (SHIPY + 22) * k; const g = ctx.createLinearGradient(fx0, 0, fx0 + fw, 0); g.addColorStop(0, 'rgba(94,255,200,0)'); g.addColorStop(0.5, 'rgba(94,255,200,.7)'); g.addColorStop(1, 'rgba(94,255,200,0)'); ctx.fillStyle = g; ctx.fillRect(fx0, gy, fw, 2);
  // shields
  ctx.save(); ctx.shadowColor = '#5effc8'; ctx.shadowBlur = 8;
  for (const s of shields) if (s.hp > 0) { ctx.fillStyle = s.hp === 2 ? '#5effc8' : 'rgba(94,255,200,.5)'; const [x, y] = toScr(s.x, s.y); ctx.fillRect(x, y, 4 * k + 0.5, 4 * k + 0.5); }
  ctx.restore();
  // aliens
  for (const a of aliens) {
    if (!a.alive) continue; const [x, y] = toScr(a.x, a.y), sp = alienSprite(a.k, frame2, k);
    const pop = a.born > 0 ? 0 : 1; if (!pop) continue;
    blit(ctx, sp, x - AW * k / 2, y - AH * k / 2, AW * k, AH * k);
  }
  if (ufo) drawUfo(...toScr(ufo.x, 64), k, t);
  // bullets + bombs
  ctx.save(); ctx.shadowColor = '#5effc8'; ctx.shadowBlur = 10; ctx.fillStyle = '#d6fff2';
  for (const b of bullets) { const [x, y] = toScr(b.x, b.y); rr(ctx, x - 1.6 * k, y - 8 * k, 3.2 * k, 14 * k, 1.6 * k); ctx.fill(); }
  ctx.shadowColor = '#ff7ad9'; ctx.fillStyle = '#ff7ad9'; ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 2.4 * k;
  for (const m of bombs) { const [x, y] = toScr(m.x, m.y); if (m.kind) { ctx.beginPath(); for (let i = 0; i < 4; i++) ctx.lineTo(x + ((i + Math.floor(m.t * 12)) % 2 ? 3 : -3) * k, y - 8 * k + i * 4 * k); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(x, y, 3.4 * k, 0, 7); ctx.fill(); } }
  ctx.restore();
  // ship
  if (ship.dead <= 0 && !(ship.inv > 0 && Math.sin(t * 30) > 0)) {
    const [x, y] = toScr(ship.x, SHIPY); drawShip(x, y, k, t);
    if (ship.flash > 0) { ctx.globalAlpha = ship.flash; ctx.fillStyle = '#d6fff2'; ctx.beginPath(); ctx.arc(x, y - 18 * k, 5 * k, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  }
  // top strip: wave + ships left
  ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(13 * k)}px 'Baloo 2',system-ui`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText('WAVE ' + wave, fx0 + 4, fy0 + 14 * k);
  for (let i = 0; i < Math.max(0, lives - (ship.dead > 0 ? 0 : 1)); i++) drawShip(fx0 + fw - 14 * k - i * 26 * k, fy0 + 14 * k, k * 0.55, t);
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

// start card: meet the aliens
{
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:14px;justify-content:center;margin-top:10px;font:800 12px "Baloo 2",system-ui';
  KINDS.forEach((K, i) => {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;width:70px';
    const c = document.createElement('canvas'); c.width = 120; c.height = 100; c.style.cssText = 'width:60px;height:50px;border-radius:14px;background:rgba(255,255,255,.07)';
    const x = c.getContext('2d'), sp = alienSprite(i, 0, 1.4 * S.dpr / S.dpr); x.scale(2, 2); x.drawImage(sp.c, 30 - AW * 0.7 - sp.pad, 25 - AH * 0.7 - sp.pad, AW * 1.4 + sp.pad * 2, AH * 1.4 + sp.pad * 2);
    d.appendChild(c); d.insertAdjacentHTML('beforeend', `<span style="color:${K.c}">${K.name}</span><small style="opacity:.7;font-weight:600">${K.pts} pts</small>`); row.appendChild(d);
  });
  const u = document.createElement('div'); u.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;width:70px';
  const c = document.createElement('canvas'); c.width = 120; c.height = 100; c.style.cssText = 'width:60px;height:50px;border-radius:14px;background:rgba(255,255,255,.07)';
  { const real = ctx; ctx = c.getContext('2d'); ctx.scale(2, 2); drawUfo(30, 27, 1, 0.2); ctx = real; }
  u.appendChild(c); u.insertAdjacentHTML('beforeend', '<span style="color:#ff4d6d">Saucer</span><small style="opacity:.7;font-weight:600">? pts</small>'); row.appendChild(u);
  ui.els.start.querySelector('.neo-best').after(row);
}

// ---------------------------------------------------------------- test hooks + bot (aims under the lowest alien, dodges bombs)
window.__game = {
  get state() { return state; }, get level() { return wave; }, get score() { return score; }, get lives() { return lives; },
  get dbg() { return { ship: [Math.round(ship.x), ship.dead, ship.inv], botT, bombs: bombs.map(m => [Math.round(m.x), Math.round(m.y)]), alive: aliveN(), bullets: bullets.length, clearT, low: Math.max(...aliens.filter(a => a.alive).map(a => a.y)) }; },
  bot() {
    if (state !== 'play' || ship.dead > 0) return;
    const el = (performance.now() - runT0) / 1000, careful = el < 4 ? 0.95 : 0.3;   // QA only: later in a test run it dodges less so runs finish
    const live = aliens.filter(a => a.alive); if (!live.length) return;
    let tx = ufo && Math.abs(ufo.x - ship.x) < 120 ? ufo.x + ufo.v * 0.25 : live.reduce((m, a) => (a.y > m.y + 4 || (Math.abs(a.y - m.y) <= 4 && Math.abs(a.x - ship.x) < Math.abs(m.x - ship.x))) ? a : m, live[0]).x;
    const threat = bombs.filter(m => m.y > SHIPY - 200 && Math.abs(m.x - ship.x) < 24);
    if (threat.length && Math.random() < careful) { const m = threat[0]; tx = ship.x + (m.x < ship.x ? 1 : -1) * 46; if (tx < 20 || tx > FW - 20) tx = ship.x + (m.x < ship.x ? -1 : 1) * 46; }
    if (el > 4) { const open = bombs.filter(m => !shields.some(q => q.hp > 0 && Math.abs(q.x + 2 - m.x) < 5 && q.y > m.y) && Math.abs(m.x - ship.x) / 330 < (SHIPY - m.y) / m.vy + 0.05); if (open.length) tx = open.reduce((a, b) => b.y > a.y ? b : a).x; }   // QA only: late in a test run it stops dodging so runs finish
    botT = Math.max(18, Math.min(FW - 18, tx));
  },
};

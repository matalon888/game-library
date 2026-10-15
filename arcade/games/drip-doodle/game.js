// Drip Doodle — original game. Draw lines with limited ink so the water from the pipe ends up in the glass.
// Fill it to the dashed line and the glass grins. 2D canvas rendering, own position-based water (physics.js).
import { createUI, input, loop, sfx, tone, buzz, store, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { Water } from './physics.js';
import { W, H, GLASS, makeLevel, staticSegs, inGlass, glassPts, blockPoly, insideBlocks, pipeBox, emit } from './levels.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const save = store('dripdoodle');
const F = flow('dripdoodle');
const WB = worldBoard({ game: 'drip-doodle', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });
let level = save.get('level', 1), stars = save.get('stars', 0);
const ui = createUI({ title: 'DRIP<br>DOODLE', hint: 'Draw a line to fill the glass', hand: '✏️', progress: false, score: false });
const starP = ui.els.win.querySelector('[data-x]'); starP.style.cssText = 'font-size:48px;letter-spacing:6px;color:#ffd23f;text-shadow:0 4px 0 rgba(0,0,0,.2)';

// ---------------------------------------------------------------- layout
const HUD = 104;
let dpr = 1, s = 1, ox = 0, oy = 0, paper = null;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  s = Math.min(innerWidth / (W + 14), (innerHeight - HUD - 6) / H);
  ox = (innerWidth - W * s) / 2; oy = HUD + (innerHeight - HUD - H * s) * 0.55;
  paper = makePaper();
}
function makePaper() {
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d');
  g.fillStyle = '#fbfcfd'; g.fillRect(0, 0, c.width, c.height);
  const step = 13 * dpr;
  for (let i = 0, x = 0; x < c.width; x += step, i++) { g.fillStyle = i % 5 ? 'rgba(150,175,200,.16)' : 'rgba(150,175,200,.3)'; g.fillRect(Math.round(x), 0, Math.max(1, dpr * 0.6), c.height); }
  for (let i = 0, y = 0; y < c.height; y += step, i++) { g.fillStyle = i % 5 ? 'rgba(150,175,200,.16)' : 'rgba(150,175,200,.3)'; g.fillRect(0, Math.round(y), c.width, Math.max(1, dpr * 0.6)); }
  return c;
}
addEventListener('resize', resize); resize();
const toWorld = (cx, cy) => [(cx - ox) / s, (cy - oy) / s];

// ---------------------------------------------------------------- state
let L, sim, state = 'ready', strokes = [], cur = null, inkUsed = 0, tapOpen = false, tapT = 0, emitted = 0, full = 0, endT = 0, frame = 0;
let fill = 0, shownFill = 0, happyT = 0, glassBounce = 0, pencil = null, botI = 0, botDone = false, fx = [], lastSplash = 0, shake = 0, scratch = 0;
function startLevel() {
  L = makeLevel(level); L.water = Math.max(Math.round(L.target * 1.55), Math.round(L.water / F.k()));   // flow: spare water shrinks for players on a streak
  sim = new Water({ r: 4 }); staticSegs(L, sim);
  strokes = []; cur = null; inkUsed = 0; tapOpen = false; tapT = 0; emitted = 0; full = 0; endT = 0; fill = 0; shownFill = 0; happyT = 0;
  glassBounce = 0; pencil = null; botI = 0; botDone = false; fx = []; frame = 0;
}
startLevel();
ui.start();
ui.onTap((which) => { WB.start();
  if (which === 'win') { level++; save.set('level', level); startLevel(); }
  else if (which === 'lose') startLevel();
  state = 'play';
});

// ---------------------------------------------------------------- drawing
const inkLeft = () => clamp(1 - inkUsed / L.ink, 0, 1);
const starsFor = (left) => left >= 0.4 ? 3 : left >= 0.15 ? 2 : 1;
function blocked(x, y) {
  if (x < 2 || x > W - 2 || y < 4 || y > H + 30) return true;
  if (insideBlocks(L, x, y, 3.5)) return true;
  const b = pipeBox(L.tap); if (x > b.x0 - 4 && x < b.x1 + 4 && y > b.y0 - 4 && y < b.y1 + 4) return true;
  const g = L.glass; if (Math.abs(x - g.x) < GLASS.wt / 2 + 4 && y > g.y - GLASS.h + 16 && y < g.y + 4) return true;
  return false;
}
function beginStroke(x, y) { cur = null; if (!blocked(x, y) && inkLeft() > 0) { cur = [[x, y]]; strokes.push(cur); } pencil = [x, y]; }
function addPoint(x, y) {
  pencil = [x, y];
  if (inkLeft() <= 0) return;
  if (!cur) { if (!blocked(x, y)) { cur = [[x, y]]; strokes.push(cur); } return; }
  const [lx, ly] = cur[cur.length - 1]; let dx = x - lx, dy = y - ly, len = Math.hypot(dx, dy);
  if (len < 4) return;
  // walk along in small steps so we never cut through an obstacle
  const n = Math.ceil(len / 3);
  for (let i = 1; i <= n; i++) { const px = lx + dx * i / n, py = ly + dy * i / n; if (blocked(px, py)) { if (cur.length < 2) strokes.pop(); cur = null; return; } }
  const room = L.ink - inkUsed;
  if (len > room) { x = lx + dx * room / len; y = ly + dy * room / len; len = room; }
  cur.push([x, y]); inkUsed += len;
  sim.addSeg(lx, ly, x, y, 3, 0.02);
  if ((scratch += len) > 14) { scratch = 0; tone(900 + Math.random() * 500, 0.025, 'triangle', 0.025, 0.7); }
  if (inkLeft() <= 0) { ui.pop('OUT OF INK', '#ff6b6b', 24, 16); buzz(20); }
}
function endStroke() {
  if (cur && cur.length < 2) strokes.splice(strokes.indexOf(cur), 1);
  cur = null; pencil = null;
  if (!tapOpen && strokes.some(st => st.length >= 2) && state === 'play') { tapOpen = true; tapT = 0; sfx.tap(); tone(300, 0.18, 'sine', 0.1, 1.6); buzz(10); }
}
const restartBtn = { x: 34, y: 38, r: 22 };
input({
  onDown(e) {
    if (Math.hypot(e.clientX - restartBtn.x, e.clientY - restartBtn.y) < restartBtn.r + 6) { if (state === 'play') { sfx.tap(); startLevel(); } return; }
    if (state !== 'play') return;
    beginStroke(...toWorld(e.clientX, e.clientY));
  },
  onMove(dx, dy, e) { if (state === 'play' && pencil) addPoint(...toWorld(e.clientX, e.clientY)); },
  onUp() { if (pencil || cur) endStroke(); },
});

// ---------------------------------------------------------------- fx (2D particles)
function spray(x, y, n, col, sp = 2, up = 2, size = 2.4, g = 0.15, kind = 'dot') {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * sp; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up * Math.random(), g, life: 1, size: size * (0.6 + Math.random() * 0.8), col: Array.isArray(col) ? col[i % col.length] : col, kind, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 }); }
}
const CONF = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#ff8c42'];
function confettiRain() { for (let i = 0; i < 70; i++) fx.push({ x: Math.random() * W, y: -20 - Math.random() * 120, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 2, g: 0.04, life: 2.2, size: 5 + Math.random() * 4, col: CONF[i % CONF.length], kind: 'conf', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 }); }

// ---------------------------------------------------------------- update
function update() {
  frame++;
  if (state === 'play' || state === 'won') {
    if (tapOpen) {
      tapT++;
      if (tapT > 8 && emitted < L.water && state === 'play') { emit(sim, L.tap, emitted++); if (emitted >= L.water) endT = 0; }
    }
    sim.step(3);
    let c = 0;
    for (let i = 0; i < sim.n; i++) {
      const inside = inGlass(L.glass, sim.x[i], sim.y[i]);
      if (inside) {
        c++;
        if (!sim.inGlass[i]) {
          sim.inGlass[i] = 1;
          if (frame - lastSplash > 5) { lastSplash = frame; spray(sim.x[i], sim.y[i] - 3, 3, '#69bdf3', 1.4, 1.6, 2.2); tone(420 + fill * 520, 0.05, 'sine', 0.05, 1.3); }
        }
      }
    }
    fill = c / L.target;
    if (state === 'play') {
      if (fill >= 1) {
        if (full === 0) { glassBounce = 1; ui.pop('FULL!', '#3a86ff', 34, 22); buzz(15); }
        full++;
        if (full > 70) win();
      } else full = Math.max(0, full - 2);
      if (tapOpen && emitted >= L.water) {
        endT++;
        let moving = 0; for (let i = 0; i < sim.n; i++) if (Math.abs(sim.vx[i]) + Math.abs(sim.vy[i]) > 0.25) moving++;
        if (fill < 1 && (endT > 300 || (endT > 50 && moving < 3))) lose();
      }
    }
  }
  shownFill = lerp(shownFill, Math.min(1, fill), 0.12);
  if (state === 'won') happyT += 1;
  glassBounce *= 0.9;
  for (const p of fx) { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.kind === 'conf' ? 0.008 : 0.03; if (p.kind === 'conf') p.vx *= 0.99; }
  fx = fx.filter(p => p.life > 0 && p.y < H + 60);
}
function win() {
  state = 'won'; F.level(true); WB.submit(1);
  const st = starsFor(inkLeft()); stars += st; save.set('stars', stars);
  sfx.win(); buzz([20, 40, 30]); ui.flash(0.45);
  ui.pop(st === 3 ? 'PERFECT!' : st === 2 ? 'GREAT!' : 'NICE!', '#ffd23f', 46, 20);
  const g = L.glass; spray(g.x, g.y - GLASS.h, 26, CONF, 4, 3, 4, 0.12, 'star'); confettiRain();
  glassBounce = 1.4;
  ui.win(level, '★'.repeat(st) + '☆'.repeat(3 - st));
}
function lose() { state = 'lost'; F.level(false, clamp(fill, 0, 1)); sfx.fail(); buzz([40, 30, 40]); shake = 1; ui.lose('SO THIRSTY!', 'Fill it to the dashed line'); }

// ---------------------------------------------------------------- render
const TEAL = '#5aaca1', TEAL_D = '#3f8a80';
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(paper, 0, 0);
  const sh = shake > 0.01 ? (Math.random() - 0.5) * 8 * shake : 0; shake *= 0.9;
  ctx.setTransform(s * dpr, 0, 0, s * dpr, (ox + sh) * dpr, oy * dpr);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // blocks
  for (const b of L.blocks) {
    const p = blockPoly(b); ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = TEAL; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = TEAL_D; ctx.stroke();
  }
  drawGlassBack();
  drawWater();
  drawGlassFront();
  drawTap();
  // ink lines
  ctx.strokeStyle = '#1e1e22'; ctx.lineWidth = 6;
  for (const st of strokes) { if (st.length < 2) continue; ctx.beginPath(); st.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  if (pencil) drawPencil(pencil[0], pencil[1]);
  // fx
  for (const p of fx) {
    ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.col;
    if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
    else if (p.kind === 'star') { star(p.x, p.y, p.size * 1.6, p.rot); }
    else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.5 + Math.abs(Math.sin(p.rot * 2)))); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  drawHud();
}
function star(x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
// water: additive soft sprites into a low-res field, then alpha-threshold into a flat liquid with a darker rim
const FS = 1.5, SR = 14, FH = H + 60;
const field = document.createElement('canvas'); field.width = Math.ceil(W * FS); field.height = Math.ceil(FH * FS);
const fctx = field.getContext('2d', { willReadFrequently: true });
const sprite = (() => {
  const c = document.createElement('canvas'), r = Math.ceil(SR * FS); c.width = c.height = r * 2; const g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (let i = 0; i <= 10; i++) { const t = i / 10; gr.addColorStop(t, `rgba(0,0,0,${((1 - t) ** 2).toFixed(3)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
})();
const T1 = 0.24 * 255, T2 = 0.4 * 255;
function drawWater() {
  const { x, y, n } = sim; if (!n) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i]; if (y[i] < y0) y0 = y[i]; if (y[i] > y1) y1 = y[i]; }
  const bx = Math.max(0, Math.floor((x0 - SR) * FS)), by = Math.max(0, Math.floor((y0 - SR) * FS));
  const bw = Math.min(field.width, Math.ceil((x1 + SR) * FS)) - bx, bh = Math.min(field.height, Math.ceil((y1 + SR) * FS)) - by;
  if (bw <= 0 || bh <= 0) return;
  fctx.clearRect(bx, by, bw, bh);
  fctx.globalCompositeOperation = 'lighter';
  const r = sprite.width / 2;
  for (let i = 0; i < n; i++) fctx.drawImage(sprite, x[i] * FS - r, y[i] * FS - r);
  fctx.globalCompositeOperation = 'source-over';
  const img = fctx.getImageData(bx, by, bw, bh), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a > T2) { d[i] = 108; d[i + 1] = 193; d[i + 2] = 245; d[i + 3] = 255; }
    else if (a > T1) { d[i] = 52; d[i + 1] = 146; d[i + 2] = 220; d[i + 3] = 255; }
    else d[i + 3] = 0;
  }
  fctx.putImageData(img, bx, by);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(field, bx, by, bw, bh, bx / FS, by / FS, bw / FS, bh / FS);
}
function glassTransform() {
  const g = L.glass, b = glassBounce, jump = state === 'won' ? Math.abs(Math.sin(happyT * 0.12)) * 10 * Math.max(0, 1 - happyT / 160) : 0;
  ctx.save(); ctx.translate(g.x, g.y - jump); ctx.scale(1 + 0.07 * b * Math.sin(frame * 0.5), 1 - 0.07 * b * Math.sin(frame * 0.5)); ctx.translate(-g.x, -g.y);
}
function drawGlassBack() {
  glassTransform();
  const p = glassPts(L.glass);
  ctx.beginPath(); ctx.moveTo(...p.tl); ctx.lineTo(...p.bl); ctx.lineTo(...p.br); ctx.lineTo(...p.tr); ctx.closePath();
  ctx.fillStyle = 'rgba(214,232,244,.45)'; ctx.fill();
  ctx.restore();
}
function drawGlassFront() {
  glassTransform();
  const g = L.glass, p = glassPts(g), { h, wb, wt, line } = GLASS;
  // dashed fill line
  const ly = g.y - h * line, f = line, half = wb / 2 + (wt - wb) / 2 * f - 3;
  ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.strokeStyle = fill >= 1 ? '#2a9d8f' : '#555'; ctx.beginPath(); ctx.moveTo(g.x - half, ly); ctx.lineTo(g.x + half, ly); ctx.stroke(); ctx.setLineDash([]);
  // walls
  ctx.beginPath(); ctx.moveTo(...p.tl); ctx.lineTo(p.bl[0], p.bl[1] - 1); ctx.lineTo(p.br[0], p.br[1] - 1); ctx.lineTo(...p.tr);
  ctx.lineWidth = 7.5; ctx.strokeStyle = '#5d6469'; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = '#aab3b8'; ctx.stroke();
  ctx.lineWidth = 7.5; ctx.strokeStyle = '#5d6469'; ctx.beginPath(); ctx.moveTo(p.tl[0] - 2, p.tl[1]); ctx.lineTo(p.tl[0] + 1, p.tl[1]); ctx.moveTo(p.tr[0] - 1, p.tr[1]); ctx.lineTo(p.tr[0] + 2, p.tr[1]); ctx.stroke();
  // face
  const cx = g.x, cy = g.y - h * 0.4, happy = state === 'won' || fill >= 1, worried = (shownFill < 0.35 || state === 'lost') && !happy;
  const look = L.tap.x < g.x ? -1 : 1, blink = (frame % 200) < 6;
  ctx.lineWidth = 2.6; ctx.strokeStyle = '#1e1e22';
  for (const sx of [-1, 1]) {
    const ex = cx + sx * 12, ey = cy - 8;
    if (happy) { ctx.beginPath(); ctx.arc(ex, ey + 2, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (blink) { ctx.beginPath(); ctx.moveTo(ex - 6, ey); ctx.lineTo(ex + 6, ey); ctx.stroke(); }
    else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 7.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.arc(ex + look * 2.4, ey + (worried ? -1.5 : 1), 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look * 2.4 + 1.2, ey - 1.2 + (worried ? -1.5 : 1), 1.1, 0, 7); ctx.fill();
    }
    if (worried) { ctx.beginPath(); ctx.moveTo(ex - sx * 6, ey - 17); ctx.lineTo(ex + sx * 5, ey - 13); ctx.stroke(); }
  }
  if (happy) {
    ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.moveTo(cx - 11, cy + 4); ctx.quadraticCurveTo(cx, cy + 4, cx + 11, cy + 4); ctx.quadraticCurveTo(cx + 10, cy + 18, cx, cy + 18); ctx.quadraticCurveTo(cx - 10, cy + 18, cx - 11, cy + 4); ctx.fill();
    ctx.fillStyle = '#ff6b8b'; ctx.beginPath(); ctx.ellipse(cx, cy + 14.5, 5.5, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,107,139,.45)'; ctx.beginPath(); ctx.ellipse(cx - 20, cy + 2, 5, 3, 0, 0, 7); ctx.ellipse(cx + 20, cy + 2, 5, 3, 0, 0, 7); ctx.fill();
  } else if (state === 'lost') {
    ctx.beginPath(); ctx.arc(cx, cy + 16, 8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.fillStyle = '#6cc1f5'; ctx.beginPath(); ctx.ellipse(cx + 15, cy + 2 + (frame % 60) * 0.25, 2.5, 3.5, 0, 0, 7); ctx.fill();
  } else {
    const o = 3 + shownFill * 3;
    ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.ellipse(cx, cy + 9, o * 0.8, o, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawTap() {
  const t = L.tap, b = pipeBox(t), pulse = tapOpen ? Math.max(0, 1 - tapT / 14) : 0;
  ctx.save();
  if (t.kind === 'down') {
    ctx.translate(t.x, t.y); ctx.scale(1 + pulse * 0.12, 1 - pulse * 0.1); ctx.translate(-t.x, -t.y);
    rr(t.x - 21, b.y0, 42, 46, 3, '#9aa3a7', '#4f5659');
    rr(t.x - 25, t.y - 18, 50, 18, 3, '#7f888c', '#4f5659');
    // arrow
    ctx.fillStyle = '#fff'; ctx.beginPath(); const ay = b.y0 + 12;
    ctx.moveTo(t.x - 4, ay); ctx.lineTo(t.x + 4, ay); ctx.lineTo(t.x + 4, ay + 10); ctx.lineTo(t.x + 9, ay + 10); ctx.lineTo(t.x, ay + 21); ctx.lineTo(t.x - 9, ay + 10); ctx.lineTo(t.x - 4, ay + 10); ctx.closePath(); ctx.fill();
  } else {
    const d = Math.sign(t.vx);
    ctx.translate(t.x, t.y); ctx.scale(1 - pulse * 0.1, 1 + pulse * 0.12); ctx.translate(-t.x, -t.y);
    const x0 = d > 0 ? b.x0 : t.x - 4, x1 = d > 0 ? t.x + 4 : b.x1;
    rr(Math.min(x0, x1), t.y - 18, Math.abs(x1 - x0), 36, 3, '#9aa3a7', '#4f5659');
    rr(d > 0 ? t.x - 18 : t.x, t.y - 22, 18, 44, 3, '#7f888c', '#4f5659');
    ctx.fillStyle = '#fff'; ctx.beginPath(); const ax = d > 0 ? t.x - 50 : t.x + 50;
    ctx.moveTo(ax, t.y - 4); ctx.lineTo(ax + d * 10, t.y - 4); ctx.lineTo(ax + d * 10, t.y - 9); ctx.lineTo(ax + d * 21, t.y); ctx.lineTo(ax + d * 10, t.y + 9); ctx.lineTo(ax + d * 10, t.y + 4); ctx.lineTo(ax, t.y + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function rr(x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
}
function drawPencil(x, y) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 4 - 0.15);
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#7a2a22';
  ctx.fillStyle = '#f2d3a2'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -5); ctx.lineTo(14, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -1.8); ctx.lineTo(5, 1.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8473c'; ctx.fillRect(14, -5, 42, 10); ctx.strokeRect(14, -5, 42, 10);
  ctx.fillStyle = '#c4362d'; ctx.fillRect(14, 1.5, 42, 3.5);
  ctx.fillStyle = '#b9bec2'; ctx.fillRect(56, -5, 6, 10); ctx.strokeRect(56, -5, 6, 10);
  ctx.fillStyle = '#ff9fb0'; ctx.beginPath(); ctx.roundRect(62, -5, 7, 10, [0, 3, 3, 0]); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawHud() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = innerWidth / 2, top = 18;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2b2d33'; ctx.font = '600 25px "Baloo 2", system-ui, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
  ctx.fillText('Level ' + level, cx, top + 22);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // ink bar
  const bw = Math.min(170, innerWidth * 0.44), bx = cx - bw / 2 + 8, by = top + 48, left = inkLeft();
  ctx.font = '600 13px "Baloo 2", system-ui, sans-serif'; ctx.fillStyle = '#555'; ctx.textAlign = 'right';
  ctx.fillText(Math.round(left * 100) + '%', bx - 24, by + 7);
  // tiny pencil icon
  ctx.save(); ctx.translate(bx - 12, by + 7); ctx.rotate(-Math.PI / 4); ctx.strokeStyle = '#555'; ctx.lineWidth = 1.4; ctx.strokeRect(-2, -7, 4, 11); ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(0, 8); ctx.lineTo(2, 4); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#a7adb2'; ctx.fillRect(bx, by, bw, 14);
  ctx.fillStyle = left > 0.4 ? '#9ad84f' : left > 0.15 ? '#d9d84a' : '#f08a4b'; ctx.fillRect(bx, by, bw * left, 14);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bx, by + 2, bw * left, 3);
  ctx.fillStyle = '#c0392b'; for (const t of [0.15, 0.4]) ctx.fillRect(bx + bw * t - 1, by, 2, 14);
  ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 14);
  const st = starsFor(left);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < st ? '#ffd23f' : '#d6d9dc'; ctx.strokeStyle = '#a07a00'; star(bx + bw + 14 + i * 17, by + 7, 8, 0); ctx.lineWidth = 1; ctx.stroke(); }
  // restart button
  const r = restartBtn; ctx.strokeStyle = '#2b2d33'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(r.x, r.y, 11, -0.3, Math.PI * 1.55); ctx.stroke();
  ctx.fillStyle = '#2b2d33'; ctx.beginPath(); const ax = r.x + Math.cos(-0.3) * 11, ay = r.y + Math.sin(-0.3) * 11; ctx.moveTo(ax + 6, ay - 1); ctx.lineTo(ax - 4, ay - 6); ctx.lineTo(ax - 2, ay + 5); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = '#2b2d33'; ctx.font = '800 16px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('★ ' + stars, innerWidth - 16, 39);
}

let acc = 0;
loop((dt) => { acc += dt; let k = 0; while (acc >= 1 && k++ < 3) { update(); acc -= 1; } if (acc > 3) acc = 0; render(); });

// ---------------------------------------------------------------- test hooks
function bot() {
  if (state !== 'play' || botDone || tapOpen && botI === 0) return;
  const sol = L.solution;
  if (botI === 0) { beginStroke(...sol[0]); botI = 1; return; }
  for (let k = 0; k < 2 && botI < sol.length; k++, botI++) addPoint(...sol[botI]);
  if (botI >= sol.length) { endStroke(); botDone = true; }
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return stars; }, bot,
  load(n) { level = n; ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); startLevel(); state = 'play'; },
  dbg: () => ({ n: sim.n, fill, emitted, water: L.water, ink: L.ink, used: inkUsed, salt: L.salt, tap: L.tap.kind }),
};

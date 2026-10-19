// Sipling — a dig-the-water puzzle. Swipe through the dirt so the water (a particle fluid) runs down to Sipling's
// pipe. Fill the three bath turtles on the way, and keep the water away from algae and hot rocks.
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, arp, soft } from './calm.js';

const NAME = 'Sipling: Dig the Water Puzzle';
const S = store('sipling');
const F = flow('sipling');
const ui = createUI({ title: 'Sipling', hint: 'Tap, then swipe to dig', hand: '👆', score: false, progress: false });
cardTheme({ accent: '#2f9be8' });
const D = daily('sipling', ui, { name: NAME });
const B = board({ game: 'sipling', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.25 }, mode: 'sum', corner: 'tl', accent: '#6fd0ff' });
const fx = fx2d(30);
startCard(ui, D, { kicker: D.isDaily ? 'Daily dig · same level for everyone' : 'Dig the water puzzle', dailySub: 'Same level for everyone today' });
{ const p = document.createElement('p'); const L = S.get('level', 1); p.textContent = L > 1 ? `Level ${L} · ${S.get('turtles', 0)} 🐢 collected` : 'Dig a path so the water reaches Sipling'; p.style.marginTop = '6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
ui.els.win.querySelector('h1').textContent = 'Splash!';
ui.els.lose.querySelector('.hint').textContent = 'Tap to try again';

// ---------------------------------------------------------------- DOM
css(`
body{background:#2a1a10}
#cv{position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none}
#top{position:fixed;top:calc(10px + env(safe-area-inset-top));left:max(62px,calc(50% - 250px));right:max(10px,calc(50% - 260px));z-index:5;display:flex;align-items:center;gap:8px;pointer-events:none}
#lvl{font-weight:800;font-size:18px;color:#fff;background:rgba(0,0,0,.35);border-radius:14px;padding:6px 12px;white-space:nowrap}
#meter{flex:1;height:22px;border-radius:11px;background:rgba(0,0,0,.35);overflow:hidden;position:relative}
#meter i{position:absolute;inset:0 auto 0 0;width:0;background:linear-gradient(90deg,#6fd0ff,#2f9be8);transition:width .2s}
#meter b{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;color:#fff;letter-spacing:1px}
#tur{font-size:20px;background:rgba(0,0,0,.35);border-radius:14px;padding:4px 8px;white-space:nowrap;letter-spacing:-2px}
#tur span{opacity:.3}#tur span.on{opacity:1}
#redo{position:fixed;z-index:6;bottom:calc(12px + env(safe-area-inset-bottom));right:12px;width:44px;height:44px;border-radius:50%;border:0;background:rgba(0,0,0,.4);color:#fff;font-size:22px;cursor:pointer}
`);
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const cv = document.createElement('canvas'); cv.id = 'cv'; document.body.prepend(cv); const g = cv.getContext('2d');
document.body.appendChild($(`<div id="top"><div id="lvl">Level 1</div><div id="meter"><i></i><b>💧 0 / 0</b></div><div id="tur"><span>🐢</span><span>🐢</span><span>🐢</span></div></div>`));
const redo = $(`<button id="redo" aria-label="Restart level">↻</button>`); document.body.appendChild(redo);
const dirtC = document.createElement('canvas'), dg = dirtC.getContext('2d');

// ---------------------------------------------------------------- grid + level
const C = 60, EMPTY = 0, DIRT = 1, ROCK = 2, ALGAE = 3, HOT = 4, DRAIN = 5;
let W, H, dpr, cs, ox, oy, RW;
let grid, level = S.get('level', 1), R = Math.random, state = 'ready';
let P = { n: 0, x: null, y: null, vx: null, vy: null }, MAXP = 420;
let target = 0, delivered = 0, startN = 0, turtles = [], got = 0, path = [], botI = 0, kx = 30, pipeRow = 0, chamber = null, res = null;
let steam = [], drops = [], runT0 = 0, recorded = false, happy = 0, t = 0, stuckT = 0, beatShown = false;
const idx = (c, r) => r * C + c;
const at = (c, r) => (c < 0 || c >= C || r < 0 || r >= RW) ? ROCK : grid[idx(c, r)];
const solid = (x, y) => { const v = at(Math.floor(x), Math.floor(y)); return v === DIRT || v === ROCK || v === ALGAE || v === HOT; };
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const top = 62, bot = 14, aw = Math.min(W, 520);
  cs = aw / C; RW = RW || Math.floor((H - top - bot) / cs);
  cs = Math.min(aw / C, (H - top - bot) / RW); ox = (W - cs * C) / 2; oy = top;
  dirtC.width = Math.ceil(C * cs * dpr); dirtC.height = Math.ceil((RW || 1) * cs * dpr);
  if (grid) redrawDirt();
}
addEventListener('resize', resize); resize();

function build() {
  RW = Math.max(90, Math.min(130, Math.floor((innerHeight - 76) / (Math.min(innerWidth, 520) / C)))); resize();
  let s = ((D.seed || 0) * 13 + level * 7919 + 17) % 2147483647 || 1; R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const fk = F.k();
  grid = new Uint8Array(C * RW).fill(DIRT);
  for (let r = 0; r < RW; r++) { grid[idx(0, r)] = ROCK; grid[idx(C - 1, r)] = ROCK; }
  for (let c = 0; c < C; c++) { grid[idx(c, RW - 1)] = ROCK; grid[idx(c, 0)] = ROCK; }
  // reservoir (top): a rock bowl full of water, a dirt plug under it
  const cx = 14 + Math.floor(R() * (C - 28)), rh = 9, top = 3, hw = 9;
  for (let r = top - 1; r <= top + rh; r++) for (let c = cx - hw - 2; c <= cx + hw + 2; c++) { const inside = c >= cx - hw && c <= cx + hw && r >= top && r < top + rh; grid[idx(c, r)] = inside ? EMPTY : (r === top + rh ? DIRT : ROCK); }
  for (let c = cx - hw; c <= cx + hw; c++) for (let r = top + rh; r < top + rh + 3; r++) grid[idx(c, r)] = DIRT;
  res = { cx, top, rh, hw };
  // Sipling's chamber (bottom) + the pipe intake above it
  kx = 10 + Math.floor(R() * (C - 20)); if (Math.abs(kx - cx) < 8 && level > 1) kx = cx < C / 2 ? Math.min(C - 11, cx + 18) : Math.max(10, cx - 18);
  const ch = { c0: kx - 9, c1: kx + 9, r0: RW - 15, r1: RW - 2 }; chamber = ch;
  for (let r = ch.r0; r <= ch.r1; r++) for (let c = ch.c0; c <= ch.c1; c++) grid[idx(c, r)] = (r === ch.r0 || c === ch.c0 || c === ch.c1) ? ROCK : EMPTY;
  pipeRow = ch.r0 - 2;
  for (let c = kx - 4; c <= kx + 4; c++) { grid[idx(c, pipeRow + 1)] = ROCK; grid[idx(c, ch.r0)] = ROCK; }
  for (let c = kx - 2; c <= kx + 2; c++) grid[idx(c, pipeRow)] = DRAIN;
  grid[idx(kx - 3, pipeRow)] = ROCK; grid[idx(kx + 3, pipeRow)] = ROCK;
  // the guaranteed path (for ledge placement, turtles and the bot)
  const wps = [{ c: cx, r: top + rh + 1 }], n = 2 + Math.min(4, Math.floor(level / 2)), r0 = top + rh + 6, r1 = pipeRow - 6;
  for (let i = 1; i <= n; i++) wps.push({ c: 6 + Math.floor(R() * (C - 12)), r: Math.round(r0 + (r1 - r0) * i / (n + 1)) });
  wps.push({ c: kx, r: pipeRow - 3 }, { c: kx, r: pipeRow - 1 });
  path = [];
  for (let i = 1; i < wps.length; i++) { const a = wps[i - 1], b = wps[i], L = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r)); for (let k = 0; k < L; k += 1.5) path.push({ c: a.c + (b.c - a.c) * k / L, r: a.r + (b.r - a.r) * k / L }); }
  path.push(wps[wps.length - 1]);
  const nearPath = (c, r, d) => path.some(p => Math.hypot(p.c - c, p.r - r) < d);
  const free = (c, r) => !(r < top + rh + 4 && Math.abs(c - cx) < hw + 4) && !(r > pipeRow - 3 && Math.abs(c - kx) < 12);
  // rock ledges
  const ledges = Math.min(10, 3 + Math.floor(level / 2));
  for (let k = 0, tries = 0; k < ledges && tries < 300; tries++) {
    const r = top + rh + 5 + Math.floor(R() * (pipeRow - top - rh - 10)), c = 2 + Math.floor(R() * (C - 20)), len = 8 + Math.floor(R() * 16), th = 2 + Math.floor(R() * 2);
    let ok = true; for (let i = 0; i < len && ok; i++) for (let j = 0; j < th; j++) if (c + i >= C - 1 || nearPath(c + i, r + j, 4.5) || !free(c + i, r + j)) ok = false;
    if (!ok) continue; k++;
    for (let i = 0; i < len; i++) for (let j = 0; j < th; j++) grid[idx(c + i, r + j)] = ROCK;
  }
  // caves, algae and hot rocks off the path
  const blob = (type, rad, dmin, dmax) => {
    for (let tries = 0; tries < 200; tries++) {
      const c = 4 + Math.floor(R() * (C - 8)), r = top + rh + 6 + Math.floor(R() * (pipeRow - top - rh - 12));
      const d = Math.min(...path.map(p => Math.hypot(p.c - c, p.r - r)));
      if (d < dmin || d > dmax || !free(c, r)) continue;
      for (let j = -rad; j <= rad; j++) for (let i = -rad - 1; i <= rad + 1; i++) if (i * i / ((rad + 1) * (rad + 1)) + j * j / (rad * rad) <= 1 && at(c + i, r + j) === DIRT) grid[idx(c + i, r + j)] = type;
      return;
    }
  };
  for (let i = 0; i < 2; i++) blob(EMPTY, 2 + Math.floor(R() * 2), 7, 20);
  const haz = Math.round(Math.min(5, Math.floor((level - 1) / 2) + (level > 1 ? 1 : 0)) * fk);
  for (let i = 0; i < haz; i++) blob(level > 2 && i % 2 ? HOT : ALGAE, 1 + Math.floor(R() * 2), 5.5, 11);
  // turtles on the path
  turtles = [0.3, 0.55, 0.8].map(f => { const p = path[Math.floor(f * (path.length - 1))]; return { x: p.c + (R() - 0.5) * 2, y: p.r + (R() - 0.5) * 1.5, fill: 0, got: false, pop: 0 }; });
  for (const tu of turtles) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (at(Math.floor(tu.x) + i, Math.floor(tu.y) + j) === ROCK && i * i + j * j < 6) grid[idx(Math.floor(tu.x) + i, Math.floor(tu.y) + j)] = DIRT;
  // water
  P.n = 0; P.x = new Float32Array(MAXP); P.y = new Float32Array(MAXP); P.vx = new Float32Array(MAXP); P.vy = new Float32Array(MAXP);
  for (let r = top; r < top + rh; r++) for (let c = cx - hw; c <= cx + hw; c++) for (let k = 0; k < 2 && P.n < MAXP; k++) { if (r < top + 1) continue; P.x[P.n] = c + 0.25 + k * 0.5; P.y[P.n] = r + 0.3 + R() * 0.4; P.vx[P.n] = 0; P.vy[P.n] = 0; P.n++; }
  startN = P.n;
  const ratio = Math.min(0.66, (0.4 + level * 0.012) * fk);
  target = Math.round(startN * ratio); delivered = 0; got = 0; steam = []; drops = []; botI = path.length - 1; happy = 0; stuckT = 0;
  recorded = false; beatShown = false; runT0 = performance.now();
  redrawDirt(); hud();
}

// ---------------------------------------------------------------- dirt canvas (redrawn in patches when you dig)
const hash = (c, r) => { let h = (c * 374761393 + r * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
const COL = { [DIRT]: ['#6e3f1c', '#b97a3f', '#a86c35'], [ROCK]: ['#38424f', '#7b8796', '#6a7685'], [ALGAE]: ['#1f6b2a', '#4cbf4f', '#3aa840'], [HOT]: ['#7a1f0f', '#ff6a2a', '#e8511c'] };
function redrawDirt(c0 = 0, r0 = 0, c1 = C - 1, r1 = RW - 1) {
  const k = cs * dpr; dg.save(); dg.setTransform(1, 0, 0, 1, 0, 0);
  c0 = Math.max(0, c0 - 2); r0 = Math.max(0, r0 - 2); c1 = Math.min(C - 1, c1 + 2); r1 = Math.min(RW - 1, r1 + 2);
  dg.beginPath(); dg.rect(c0 * k, r0 * k, (c1 - c0 + 1) * k, (r1 - r0 + 1) * k); dg.clip(); dg.clearRect(c0 * k, r0 * k, (c1 - c0 + 1) * k, (r1 - r0 + 1) * k);
  for (let pass = 0; pass < 3; pass++) for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = c0 - 1; c <= c1 + 1; c++) {
    const v = at(c, r); if (v === EMPTY || v === DRAIN || !COL[v]) continue;
    if (c < 0 || r < 0 || c >= C || r >= RW) continue;
    const x = (c + 0.5) * k, y = (r + 0.5) * k;
    if (pass === 0) { dg.fillStyle = COL[v][0]; dg.beginPath(); dg.arc(x, y + k * 0.15, k * 0.82, 0, 7); dg.fill(); }
    else if (pass === 1) { dg.fillStyle = COL[v][1]; dg.beginPath(); dg.arc(x, y, k * 0.7, 0, 7); dg.fill(); }
    else { const h = hash(c, r); if (h < 0.18) { dg.fillStyle = h < 0.06 ? 'rgba(255,255,255,.18)' : COL[v][2]; dg.beginPath(); dg.arc(x + (h - 0.09) * k * 4, y, k * (0.22 + h), 0, 7); dg.fill(); } }
  }
  dg.restore();
}

// ---------------------------------------------------------------- digging
let digging = false, lx = 0, ly = 0;
function digAt(px, py, rad = 2.8) {
  const c = (px - ox) / cs, r = (py - oy) / cs; let n = 0;
  for (let j = -Math.ceil(rad); j <= Math.ceil(rad); j++) for (let i = -Math.ceil(rad); i <= Math.ceil(rad); i++) {
    if (i * i + j * j > rad * rad) continue; const cc = Math.floor(c + i), rr2 = Math.floor(r + j);
    if (at(cc, rr2) === DIRT && cc > 0 && cc < C - 1 && rr2 > 0 && rr2 < RW - 1) { grid[idx(cc, rr2)] = EMPTY; n++; }
  }
  if (n) { redrawDirt(Math.floor(c - rad), Math.floor(r - rad), Math.ceil(c + rad), Math.ceil(r + rad)); if (Math.random() < 0.5) fx.sparks(px, py, ['#b97a3f', '#6e3f1c', '#d9a066'], 3, { speed: 2.4, size: 2.4, kind: 'dot', g: 0.15 }); }
  return n;
}
function digLine(x0, y0, x1, y1, rad) { const d = Math.hypot(x1 - x0, y1 - y0), st = Math.max(1, Math.ceil(d / (cs * 1.2))); let n = 0; for (let i = 0; i <= st; i++) n += digAt(x0 + (x1 - x0) * i / st, y0 + (y1 - y0) * i / st, rad); if (n) scrape(); return n; }
let scrapeT = 0; function scrape() { const now = performance.now(); if (now - scrapeT < 60) return; scrapeT = now; tone(140 + Math.random() * 90, 0.05, 'sawtooth', 0.025, 0.6); buzz(4); }
cv.addEventListener('pointerdown', e => { if (state !== 'play') return; digging = true; lx = e.clientX; ly = e.clientY; digLine(lx, ly, lx, ly); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (!digging || state !== 'play') return; digLine(lx, ly, e.clientX, e.clientY); lx = e.clientX; ly = e.clientY; });
addEventListener('pointerup', () => digging = false);
redo.addEventListener('pointerdown', e => e.stopPropagation());
redo.addEventListener('click', e => { e.stopPropagation(); if (state !== 'play') return; lose('Fresh start', 'Same level, new dig.'); });

// ---------------------------------------------------------------- water
const hgrid = new Map();
function stepWater() {
  const n = P.n, X = P.x, Y = P.y, VX = P.vx, VY = P.vy, h = 1.05;
  hgrid.clear();
  for (let i = 0; i < n; i++) { const k = (Math.floor(X[i]) << 8) | Math.floor(Y[i]); let a = hgrid.get(k); if (!a) hgrid.set(k, a = []); a.push(i); }
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(X[i]), cy = Math.floor(Y[i]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = hgrid.get(((cx + dx) << 8) | (cy + dy)); if (!a) continue;
      for (const j of a) { if (j <= i) continue;
        let ddx = X[j] - X[i], ddy = Y[j] - Y[i], d2 = ddx * ddx + ddy * ddy; if (d2 >= h * h) continue;
        let d = Math.sqrt(d2); if (d < 1e-4) { ddx = Math.random() - 0.5; ddy = -0.5; d = 0.5; }
        const push = (h - d) / d * 0.22, px = ddx * push, py = ddy * push;
        VX[i] -= px; VY[i] -= py; VX[j] += px; VY[j] += py;
        const mx = (VX[j] - VX[i]) * 0.04, my = (VY[j] - VY[i]) * 0.04; VX[i] += mx; VY[i] += my; VX[j] -= mx; VY[j] -= my;
      }
    }
  }
  let moving = 0;
  for (let i = 0; i < n; i++) {
    VY[i] += 0.03; VX[i] *= 0.985;
    const sp = Math.hypot(VX[i], VY[i]); if (sp > 0.6) { VX[i] *= 0.6 / sp; VY[i] *= 0.6 / sp; }
    if (sp > 0.04) moving++;
    const nx = X[i] + VX[i]; if (solid(nx, Y[i])) VX[i] *= -0.25; else X[i] = nx;
    const ny = Y[i] + VY[i]; if (solid(X[i], ny)) { if (VY[i] > 0) VX[i] += (Math.random() - 0.5) * 0.08; VY[i] *= -0.1; } else Y[i] = ny;
    if (solid(X[i], Y[i])) { Y[i] -= 0.5; }       // popped into something: nudge up
  }
  // contacts: drain, turtles, algae, hot rocks
  for (let i = n - 1; i >= 0; i--) {
    const c = Math.floor(X[i]), r = Math.floor(Y[i]);
    let kill = 0;
    if (at(c, r) === DRAIN || at(c, r + 1) === DRAIN) { kill = 1; delivered++; drops.push({ x: kx + (Math.random() - 0.5) * 2, y: pipeRow + 3, vy: 0.2 }); if (delivered % 3 === 0) note(76 + (delivered / 3 % 5) * 2, 0.12, 0.04); }
    else {
      for (const tu of turtles) if (!tu.got && Math.hypot(tu.x - X[i], tu.y - Y[i]) < 1.9) { kill = 1; tu.fill++; tu.pop = 1; if (tu.fill >= 8) collect(tu); break; }
      if (!kill) for (const [ox2, oy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = at(Math.floor(X[i] + ox2 * 0.7), Math.floor(Y[i] + oy2 * 0.7));
        if (v === ALGAE) { kill = 1; grow(Math.floor(X[i] + ox2 * 0.7), Math.floor(Y[i] + oy2 * 0.7)); break; }
        if (v === HOT) { kill = 1; steam.push({ x: X[i], y: Y[i], life: 1, r: 0.6 + Math.random() * 0.6 }); if (Math.random() < 0.2) tone(1800, 0.08, 'sine', 0.02, 0.3); break; } }
    }
    if (kill) { const L = P.n - 1; X[i] = X[L]; Y[i] = Y[L]; VX[i] = VX[L]; VY[i] = VY[L]; P.n--; }
  }
  return moving;
}
function grow(c, r) {
  if (Math.random() < 0.55) for (const [a, b] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]].sort(() => Math.random() - 0.5)) if (at(c + a, r + b) === EMPTY) { grid[idx(c + a, r + b)] = ALGAE; redrawDirt(c + a, r + b, c + a, r + b); break; }
  if (Math.random() < 0.1) tone(90, 0.1, 'sine', 0.03, 0.7);
}
function collect(tu) {
  tu.got = true; got++; hud();
  const p = toS(tu.x, tu.y); fx.sparks(p.x, p.y, ['#ffd35c', '#7ee08a', '#fff'], 22, { speed: 5 }); fx.ring(p.x, p.y, '#ffd35c', 30);
  arp([79, 84, 88], 60, 0.1); buzz(20); ui.pop(['Turtle!', 'Two!', 'All three!'][got - 1], '#ffd35c', 30, 26);
}
const toS = (c, r) => ({ x: ox + c * cs, y: oy + r * cs });

// ---------------------------------------------------------------- win / lose
function hud() {
  document.getElementById('lvl').textContent = (D.isDaily ? 'Daily' : 'Level ' + level);
  document.querySelector('#meter i').style.width = Math.min(100, delivered / target * 100) + '%';
  document.querySelector('#meter b').textContent = `💧 ${Math.min(delivered, target)} / ${target}`;
  document.querySelectorAll('#tur span').forEach((e, i) => e.classList.toggle('on', i < got));
}
function win() {
  state = 'won'; happy = 1;
  if (!recorded) { recorded = true; F.level(true); }
  S.set('turtles', S.get('turtles', 0) + got);
  const cleared = S.get('cleared', 0) + 1; S.set('cleared', cleared);
  B.submit(1, { ms: performance.now() - runT0 });
  D.won(cleared, 'cleared');
  if (!beatShown && D.beaten(cleared)) { beatShown = true; ui.pop('BEATEN!', '#ffd35c', 44, 30); }
  ui.win(D.isDaily ? 'Daily' : level, `${'🐢'.repeat(got)}${'·'.repeat(3 - got)}  ${got}/3 turtles`);
  if (!D.isDaily) { level++; S.set('level', level); }
  fx.confetti(130); arp([72, 76, 79, 84, 88], 80, 0.12); buzz([30, 40, 30]);
}
function lose(title, line) {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, Math.min(1, delivered / target)); }
  ui.lose(title, line); tone(220, 0.3, 'triangle', 0.08, 0.5); setTimeout(() => tone(150, 0.5, 'triangle', 0.08, 0.5), 200); buzz([50, 30, 50]);
}
ui.els.win.querySelector('p').innerHTML = 'LEVEL <span data-l>1</span>';
ui.onTap(w => { build(); state = 'play'; B.start(); });

// ---------------------------------------------------------------- drawing
function ell(x, y, rx, ry, c) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); }
function drawSipling(x, y, s) {
  const thirsty = !happy && delivered < target * 0.3, bob = Math.sin(t * (thirsty ? 3 : 6)) * (thirsty ? 1 : 2.5);
  g.save(); g.translate(x, y); g.scale(s, s);
  ell(0, 2, 30, 6, 'rgba(0,0,0,.3)');
  // pot body
  g.beginPath(); g.moveTo(-26, -40); g.lineTo(26, -40); g.lineTo(20, 0); g.lineTo(-20, 0); g.closePath(); g.fillStyle = '#d9774a'; g.fill();
  g.fillStyle = '#c4633a'; g.beginPath(); g.roundRect(-30, -48, 60, 12, 6); g.fill();
  // face
  g.translate(0, bob);
  const eo = thirsty ? 0.5 : 1;
  ell(-9, -24, 4, 4 * eo + 0.5, '#2b1a12'); ell(9, -24, 4, 4 * eo + 0.5, '#2b1a12');
  if (!thirsty) { ell(-8, -25.5, 1.3, 1.3, '#fff'); ell(10, -25.5, 1.3, 1.3, '#fff'); }
  ell(-17, -16, 4, 2.4, 'rgba(255,130,130,.6)'); ell(17, -16, 4, 2.4, 'rgba(255,130,130,.6)');
  g.strokeStyle = '#2b1a12'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath();
  if (thirsty) { g.arc(0, -10, 5, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); ell(4, -6 + Math.sin(t * 5) * 1, 2.5, 3, '#ff7a9a'); }
  else { g.arc(0, -16, 6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  // sprout
  const droop = thirsty ? 0.9 : happy ? -0.2 + Math.sin(t * 8) * 0.15 : 0.1;
  g.strokeStyle = '#3e9b4f'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(2, -62, droop * 10, -72 + droop * 8); g.stroke();
  for (const sd of [-1, 1]) { g.save(); g.translate(droop * 10, -72 + droop * 8); g.rotate(sd * (0.9 + droop * 0.6)); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sd * 10, -10, sd * 2, -20); g.quadraticCurveTo(sd * -4, -10, 0, 0); g.fillStyle = sd > 0 ? '#5cc46a' : '#4fb35d'; g.fill(); g.restore(); }
  if (happy) { g.save(); g.translate(droop * 10, -76); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t; ell(Math.cos(a) * 7, Math.sin(a) * 7 - 14, 5, 5, '#ff8fb8'); } ell(0, -14, 4, 4, '#ffd35c'); g.restore(); }
  g.restore();
}
function drawTurtle(tu) {
  const p = toS(tu.x, tu.y), s = cs / 6.5 * (1 + tu.pop * 0.15); tu.pop = Math.max(0, tu.pop - 0.08);
  g.save(); g.translate(p.x, p.y); g.scale(s, s);
  ell(10, -2, 6, 5, '#ffd35c'); ell(12, -3, 1.2, 1.2, '#2b1a12');
  ell(-6, 4, 3.5, 2.5, '#ffd35c'); ell(6, 4, 3.5, 2.5, '#ffd35c');
  g.beginPath(); g.ellipse(0, 0, 10, 8, 0, Math.PI, 0); g.lineTo(10, 2); g.lineTo(-10, 2); g.closePath(); g.fillStyle = '#4cbf6a'; g.fill();
  g.fillStyle = '#2f9a4c'; for (const [a, b] of [[-4, -3], [3, -4], [0, -6.5]]) { g.beginPath(); g.arc(a, b, 2, 0, 7); g.fill(); }
  // fill ring
  g.strokeStyle = '#6fd0ff'; g.lineWidth = 2; g.beginPath(); g.arc(0, -1, 13, -Math.PI / 2, -Math.PI / 2 + tu.fill / 8 * Math.PI * 2); g.stroke();
  g.restore();
}
function render(dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // sky strip + tunnel background
  const sk = g.createLinearGradient(0, 0, 0, oy); sk.addColorStop(0, '#7fd0ff'); sk.addColorStop(1, '#c9ecff'); g.fillStyle = sk; g.fillRect(0, 0, W, oy + 2);
  g.fillStyle = '#5cb85c'; g.fillRect(0, oy - 6, W, 8);
  g.fillStyle = '#3a2416'; g.fillRect(0, oy, W, H - oy);
  if (!grid) return;
  // brick hint on the tunnel wall
  g.fillStyle = 'rgba(255,255,255,.035)'; const bw = cs * 6, bh = cs * 3;
  for (let y = oy, row = 0; y < oy + RW * cs; y += bh, row++) for (let x = ox - (row % 2) * bw / 2; x < ox + C * cs; x += bw) g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
  // chamber glow + pipe
  const c0 = toS(chamber.c0, chamber.r0), c1 = toS(chamber.c1 + 1, chamber.r1 + 1);
  const cg = g.createLinearGradient(0, c0.y, 0, c1.y); cg.addColorStop(0, '#6b4a8a'); cg.addColorStop(1, '#3d2a58'); g.fillStyle = cg; g.fillRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
  const pp = toS(kx - 2.5, pipeRow), pw = cs * 6;
  g.fillStyle = '#9aa7b4'; g.fillRect(pp.x - cs * 0.5, pp.y - cs * 0.6, pw, cs * 1.4); g.fillStyle = '#c7d1db'; g.fillRect(pp.x - cs * 0.5, pp.y - cs * 0.6, pw, cs * 0.5);
  const pipeX = toS(kx, 0).x, sh = toS(kx, chamber.r0 + 3);
  g.fillStyle = '#8a97a4'; g.fillRect(pipeX - cs * 1.2, pp.y + cs * 0.8, cs * 2.4, sh.y - pp.y); g.beginPath(); g.ellipse(pipeX, sh.y + cs * 0.4, cs * 3.2, cs * 1.3, 0, Math.PI, 0); g.fill();
  // dirt + rock
  g.drawImage(dirtC, ox, oy, C * cs, RW * cs);
  // water
  const X = P.x, Y = P.y, rr = cs * 1.05;
  g.fillStyle = '#1f78c8'; for (let i = 0; i < P.n; i++) { g.beginPath(); g.arc(ox + X[i] * cs, oy + Y[i] * cs, rr * 1.05, 0, 7); g.fill(); }
  g.fillStyle = '#3fa9f5'; for (let i = 0; i < P.n; i++) { g.beginPath(); g.arc(ox + X[i] * cs, oy + Y[i] * cs - cs * 0.1, rr * 0.82, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < P.n; i += 3) { g.beginPath(); g.arc(ox + X[i] * cs - cs * 0.3, oy + Y[i] * cs - cs * 0.4, cs * 0.22, 0, 7); g.fill(); }
  // shower drops on Sipling
  for (const d of drops) { d.vy += 0.03 * dt; d.y += d.vy * dt; const p = toS(d.x, d.y); ell(p.x, p.y, cs * 0.35, cs * 0.6, '#6fd0ff'); }
  drops = drops.filter(d => d.y < chamber.r1 - 3);
  // steam puffs
  for (const s of steam) { s.y -= 0.12 * dt; s.life -= 0.012 * dt; const p = toS(s.x, s.y); g.globalAlpha = Math.max(0, s.life * 0.7); ell(p.x, p.y, cs * (s.r + (1 - s.life) * 2), cs * (s.r + (1 - s.life) * 2), '#f2f2f2'); }
  g.globalAlpha = 1; steam = steam.filter(s => s.life > 0);
  // hot rock shimmer
  for (const tu of turtles) if (!tu.got) drawTurtle(tu);
  const sp = toS(kx, chamber.r1 + 0.5); drawSipling(sp.x, sp.y, cs / 6.2);
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(2.5, (now - last) / 16.67); last = now; t += dt / 60;
  if (state === 'play' && grid) {
    let moving = 0; for (let k = 0; k < 2; k++) moving = stepWater();
    hud();
    if (delivered >= target) win();
    else if (P.n + delivered < target) lose('Out of water!', `${delivered} of ${target} drops reached Sipling.`);
  }
  render(dt); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui.start();

// ---------------------------------------------------------------- bot: digs the level's path from the pipe up to the water
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return S.get('cleared', 0); },
  bot() {
    if (state !== 'play' || botI < 0) return;
    const a = path[botI], b = path[Math.max(0, botI - 5)];
    const pa = toS(a.c, a.r), pb = toS(b.c, b.r); digLine(pa.x, pa.y, pb.x, pb.y, 2.4);
    botI -= 5; if (botI < 0) { const p0 = toS(res.cx, res.top + res.rh + 1); digLine(p0.x, p0.y, p0.x, p0.y + cs * 3, 2.6); }
  },
};

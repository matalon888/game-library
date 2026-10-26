// Doublink — original chain merge puzzle. Drag a line through two equal tiles, then through tiles equal to or double the
// last one; on release the chain merges into the last tile as the next power of two that holds the sum.
import { createUI, store, buzz, note, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, arp, soft, todayKey } from './calm.js';

const NAME = 'Doublink: Chain Merge Puzzle';
const S = store('doublink');
const F = flow('doublink', { par: 6000, warmup: 800 });
const ui = createUI({ title: 'Doublink', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#ff5e9c', font: "'Baloo 2',ui-rounded,system-ui,sans-serif", serif: "'Baloo 2',ui-rounded,system-ui,sans-serif" });
const D = daily('doublink', ui, { name: NAME });
const B = board({ game: 'doublink', label: 'Points', limits: { maxRun: 10000000, maxPerSec: 3000 } });
let runT0 = performance.now();   // world board: a run lasts across milestones until no links are left
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily board' : 'chain merge puzzle', doneLine: doneToday ? (D.isDaily ? `Today's best · ${doneToday.s.toLocaleString()} pts` : `Daily board played ✓`) : null });
const winP = ui.els.win.querySelector('p'); winP.innerHTML = 'MILESTONE <span data-l>1</span>';

const COLS = 5, ROWS = 8;
// one candy colour per exponent (2^1 .. 2^24), cycling with a darker twin after 2^12
const HUES = ['#ff5e7e', '#ffae3b', '#3fd39b', '#3fa3ff', '#a57bff', '#ff7340', '#20c6d8', '#f6c531', '#ff4fae', '#72d64a', '#5c6cff', '#ff5a5a'];
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
const colorOf = (e) => { const b = HUES[(e - 1) % 12]; return e > 12 ? shade(b, -0.22) : b; };
const label = (e) => { const v = 2 ** e; return v >= 1e6 ? (v / 1048576 | 0) + 'M' : v >= 1e4 ? (v / 1024 | 0) + 'K' : String(v); };

css(`
body{background:#141a3a}
#cv{position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none}
.hc-top{z-index:40}.hc-top .hc-lvl{width:30px;height:30px;font-size:14px;font-weight:800;color:#fff;background:#ff5e9c;box-shadow:0 3px 0 #b8326b}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.14);color:#fff;box-shadow:none;font-size:11px;width:auto;min-width:30px;padding:0 6px;border-radius:15px}
.hc-top .hc-lvl:not(.next){font-size:11px;width:auto;min-width:30px;padding:0 6px;border-radius:15px}
.hc-top .hc-bar{background:rgba(255,255,255,.14);height:10px}.hc-top .hc-bar i{background:linear-gradient(90deg,#ff5e9c,#ffae3b)}
#hud{position:fixed;left:0;right:0;top:calc(50px + env(safe-area-inset-top));z-index:5;text-align:center;pointer-events:none;color:#fff}
#hud .sc{font-weight:800;font-size:44px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.25);font-variant-numeric:tabular-nums}
#hud .lab{font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:.6;font-weight:700}
#foot{position:fixed;left:0;right:0;z-index:5;text-align:center;pointer-events:none;color:rgba(255,255,255,.62);font-weight:700;font-size:14px;letter-spacing:.5px}
#foot b{color:#fff}
.hc-card h1{font-weight:800}
`);
const cv = document.createElement('canvas'); cv.id = 'cv'; document.body.prepend(cv);
const g = cv.getContext('2d');
const hud = document.createElement('div'); hud.id = 'hud'; hud.innerHTML = '<div class="sc">0</div><div class="lab">score</div>'; document.body.appendChild(hud);
const foot = document.createElement('div'); foot.id = 'foot'; document.body.appendChild(foot);

// ---------------------------------------------------------------- rng (seeded so ?daily=1 gives everyone the same tiles)
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
let R = rngf(1);

// ---------------------------------------------------------------- state
let state = 'ready', level = 1, score = 0, best = S.get('best', 0), bestTile = S.get('bestTile', 0);
let grid = [], minE = 1, maxE = 1, runMax = 0, targetE = 7, chain = [], recorded = false, beatenShown = false, botChain = null, uid = 1, ghosts = [], overT = 0;
const L = { cs: 70, gx: 0, gy: 0, W: 390, H: 844 };

function spread(sc) { return Math.max(3, Math.min(6, Math.round(4 * F.k(sc)))); }   // flow knob: how many tile values can spawn
function spawnE() {
  const n = spread(score); let tot = 0; const w = [];
  for (let i = 0; i < n; i++) { w.push(n - i + 1); tot += n - i + 1; }
  let r = R() * tot; for (let i = 0; i < n; i++) { r -= w[i]; if (r < 0) return minE + i; } return minE;
}
const tile = (e, row) => ({ e, id: uid++, ry: row, vy: 0, sc: 1, sv: 0, flash: 0 });

function newRun() {
  const seed = D.seed ? D.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  R = rngf(seed * 2654435761 + 7);
  runT0 = performance.now();
  level = 1; score = 0; minE = 1; targetE = 7; runMax = 0; chain = []; recorded = false; beatenShown = false; botChain = null; ghosts = []; overT = 0;
  grid = [];
  for (let c = 0; c < COLS; c++) { grid.push([]); for (let r = 0; r < ROWS; r++) { const t = tile(spawnE(), r - ROWS - 1 - c * 0.4); grid[c].push(t); } }
  // a fresh board always has at least a few matching neighbours; reroll a cell if it doesn't
  let guard = 0; while (!hasMove() && guard++ < 50) grid[R() * COLS | 0][R() * ROWS | 0].e = minE;
  maxE = Math.max(...grid.flat().map(t => t.e)); runMax = maxE;
  ui.levels(level); levelLabels(); refresh();
}
function levelLabels() { ui.els.top.querySelector('[data-a]').textContent = D.isDaily && level === 1 ? '★' : label(targetE - 1 < 6 ? 6 : targetE - 1); ui.els.top.querySelector('[data-b]').textContent = label(targetE); }

function refresh() {
  hud.firstChild.textContent = score.toLocaleString();
  const tops = grid.flat().map(t => 2 ** t.e).sort((a, b) => b - a);
  ui.progress(Math.min(0.98, (tops[0] + tops[1] * 0.5 + tops[2] * 0.25) / 2 ** targetE));
  foot.innerHTML = `best <b>${Math.max(best, score).toLocaleString()}</b> &nbsp;·&nbsp; top tile <b>${label(Math.max(bestTile, maxE))}</b>`;
}

// ---------------------------------------------------------------- rules
const adjacent = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;
const at = (p) => grid[p[0]][p[1]];
function canAdd(ch, p) {
  if (!ch.length) return true;
  const last = ch[ch.length - 1];
  if (!adjacent(last, p) || ch.some(q => q[0] === p[0] && q[1] === p[1])) return false;
  const le = at(last).e, e = at(p).e;
  return ch.length === 1 ? e === le : (e === le || e === le + 1);
}
const chainSum = (ch) => ch.reduce((s, p) => s + 2 ** at(p).e, 0);
const resultE = (ch) => Math.ceil(Math.log2(chainSum(ch)) - 1e-9);
function hasMove() {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
    if (!dc && !dr) continue; const c2 = c + dc, r2 = r + dr;
    if (c2 >= 0 && c2 < COLS && r2 >= 0 && r2 < ROWS && grid[c][r].e === grid[c2][r2].e) return true;
  }
  return false;
}

// ---------------------------------------------------------------- merge
function merge(ch) {
  if (ch.length < 2) return;
  const sum = chainSum(ch), ne = resultE(ch), last = ch[ch.length - 1];
  score += sum;
  // ghosts fly into the last tile
  for (let i = 0; i < ch.length - 1; i++) { const p = ch[i]; ghosts.push({ e: at(p).e, x: p[0], y: p[1], tx: last[0], ty: last[1], t: 0, d: i * 0.025 }); }
  const lt = at(last); lt.e = ne; lt.sc = 1.45; lt.sv = 0; lt.flash = 1;
  const removed = new Set(ch.slice(0, -1).map(p => p[0] * 100 + p[1]));
  const { x, y } = center(last[0], last[1]);
  fx.sparks(x, y, [colorOf(ne), '#fff', shade(colorOf(ne), 0.4)], 10 + ch.length * 2, { speed: 3 + ch.length * 0.3, size: 3.2 });
  fx.ring(x, y, colorOf(ne), L.cs * 0.5);
  arp([60 + ne * 2, 67 + ne * 2], 60, 0.1, 0.5); buzz(ch.length > 4 ? [10, 30, 15] : 12);
  if (ch.length >= 5) ui.pop(ch.length >= 9 ? `MEGA CHAIN ×${ch.length}` : `CHAIN ×${ch.length}`, '#ffd76a', 26 + Math.min(ch.length, 12) * 1.4, 16);
  // gravity: each column keeps its survivors, new tiles drop in from above
  for (let c = 0; c < COLS; c++) {
    const keep = grid[c].filter((t, r) => !removed.has(c * 100 + r));
    const need = ROWS - keep.length, fresh = [];
    for (let i = 0; i < need; i++) fresh.push(tile(spawnE(), -need + i - 0.6));
    grid[c] = [...fresh, ...keep];
  }
  if (ne > maxE) maxE = ne;
  if (ne > runMax && ne >= 7) { runMax = ne; setTimeout(() => { ui.pop(`NEW ${label(ne)}!`, '#fff', 40, 30); fx.confetti(70, [colorOf(ne), '#fff', '#ffd76a', '#ff5e9c']); arp([72, 76, 79, 84], 80, 0.12, 0.8); }, 260); }
  runMax = Math.max(runMax, ne);
  // retire the smallest value once the top tile is far enough ahead
  if (maxE >= minE + 9) setTimeout(retire, 450);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); }, 500); }
  if (score > best) { best = score; S.set('best', best); }
  if (maxE > bestTile) { bestTile = maxE; S.set('bestTile', bestTile); }
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  refresh();
  if (ne >= targetE) return setTimeout(milestone, 420);
  if (!hasMove()) setTimeout(() => { if (state === 'play' && !hasMove()) gameOver(); }, 600);
}
function retire() {
  if (maxE < minE + 9) return;
  const old = minE; minE++;
  let n = 0;
  for (let c = 0; c < COLS; c++) {
    const keep = [];
    grid[c].forEach((t, r) => { if (t.e <= old) { n++; const { x, y } = center(c, r); fx.sparks(x, y, [colorOf(t.e), '#fff'], 6, { speed: 2.5, size: 2.6 }); } else keep.push(t); });
    const need = ROWS - keep.length, fresh = [];
    for (let i = 0; i < need; i++) fresh.push(tile(spawnE(), -need + i - 0.6));
    grid[c] = [...fresh, ...keep];
  }
  chain = []; botChain = null;
  ui.pop(`${label(old)}s retired!`, '#9fe7ff', 26, 30); soft.swish();
  refresh();
}
function milestone() {
  if (state !== 'play') return;
  state = 'won';
  D.won(score); B.submit(score, { ms: performance.now() - runT0 });   // best run today (the run goes on)
  ui.els.win.querySelector('h1').textContent = `${label(targetE)}!`;
  arp([67, 71, 74, 79, 83, 86], 100, 0.12, 0.9); fx.confetti(140, [colorOf(targetE), '#fff', '#ffd76a', '#ff5e9c', '#3fa3ff']); buzz([20, 60, 20]);
  ui.win(level, `${score.toLocaleString()} pts · next goal ${label(targetE + 1)}`);
}
function gameOver() {
  if (state !== 'play') return;
  state = 'lost';
  if (!recorded) { recorded = true; if (!D.isDaily) F.endless(score); }
  B.submit(score, { ms: performance.now() - runT0 });                   // world board: best run today
  soft.err();
  ui.lose('No links left', `${score.toLocaleString()} pts · top tile ${label(maxE)}`);
}

// ---------------------------------------------------------------- layout + drawing
function layout() {
  const dpr = Math.min(devicePixelRatio || 1, 2); L.W = innerWidth; L.H = innerHeight;
  cv.width = L.W * dpr; cv.height = L.H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = Math.max(172, L.H * 0.205), bottom = 62;
  L.cs = Math.floor(Math.min((Math.min(L.W, 520) - 26) / COLS, (L.H - top - bottom) / ROWS));
  L.gx = (L.W - L.cs * COLS) / 2; L.gy = top;
  foot.style.top = L.gy + L.cs * ROWS + 18 + 'px';
}
addEventListener('resize', layout);
const center = (c, r) => ({ x: L.gx + (c + 0.5) * L.cs, y: L.gy + (r + 0.5) * L.cs });
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawTile(x, y, e, s = 1, glow = 0, alpha = 1) {
  const w = L.cs * 0.8 * s, r = w * 0.24, col = colorOf(e);
  g.globalAlpha = alpha;
  if (glow) { g.shadowColor = col; g.shadowBlur = 22 * glow; }
  g.fillStyle = shade(col, -0.32); rr(x - w / 2, y - w / 2 + w * 0.07, w, w, r); g.fill();
  g.shadowBlur = 0;
  const gr = g.createLinearGradient(0, y - w / 2, 0, y + w / 2); gr.addColorStop(0, shade(col, 0.22)); gr.addColorStop(1, col);
  g.fillStyle = gr; rr(x - w / 2, y - w / 2, w, w, r); g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)'; rr(x - w / 2 + w * 0.1, y - w / 2 + w * 0.06, w * 0.8, w * 0.26, r * 0.7); g.fill();
  const t = label(e), fs = w * (t.length <= 2 ? 0.46 : t.length === 3 ? 0.38 : 0.3);
  g.font = `800 ${fs}px 'Baloo 2',ui-rounded,system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillText(t, x, y + fs * 0.12 + 2);
  g.fillStyle = '#fff'; g.fillText(t, x, y + fs * 0.12);
  g.globalAlpha = 1;
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(2.5, (now - lastT) / 16.67); lastT = now;
  const { W, H, cs, gx, gy } = L;
  // background: navy gradient + soft glow + dots
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b2250'); bg.addColorStop(1, '#0e1230'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const gl = g.createRadialGradient(W / 2, gy + cs * 4, 10, W / 2, gy + cs * 4, W * 0.9); gl.addColorStop(0, 'rgba(120,90,255,.18)'); gl.addColorStop(1, 'rgba(120,90,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  // board panel + slots
  g.fillStyle = 'rgba(255,255,255,.05)'; rr(gx - 8, gy - 8, cs * COLS + 16, cs * ROWS + 16, 20); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)';
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const w = cs * 0.8; rr(gx + c * cs + (cs - w) / 2, gy + r * cs + (cs - w) / 2, w, w, w * 0.24); g.fill(); }
  // tile physics
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const t = grid[c] && grid[c][r]; if (!t) continue;
    if (t.ry < r) { t.vy += 0.018 * dt; t.ry += t.vy * dt; if (t.ry >= r) { t.ry = r; if (t.vy > 0.12) { t.sc = 0.86; } t.vy = 0; } }
    else if (t.ry > r) t.ry = r;
    t.sv += (1 - t.sc) * 0.22 * dt; t.sv *= Math.pow(0.72, dt); t.sc += t.sv * dt; t.flash = Math.max(0, t.flash - 0.04 * dt);
  }
  // chain line under tiles
  g.save(); g.beginPath(); rr(gx - 8, gy - 8, cs * COLS + 16, cs * ROWS + 16, 20); g.clip();
  const inChain = new Set(chain.map(p => p[0] * 100 + p[1]));
  if (chain.length > 1) {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = cs * 0.24; g.strokeStyle = colorOf(at(chain[0]).e);
    g.beginPath(); chain.forEach((p, i) => { const { x, y } = center(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.lineWidth = cs * 0.08; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
  }
  const pulse = 1 + Math.sin(now / 90) * 0.03;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const t = grid[c] && grid[c][r]; if (!t) continue;
    const x = gx + (c + 0.5) * cs, y = gy + (t.ry + 0.5) * cs, on = inChain.has(c * 100 + r);
    if (y < gy - cs) continue;
    drawTile(x, y, t.e, t.sc * (on ? 1.08 * pulse : 1), on ? 1 : t.flash);
    if (on) { const w = cs * 0.8 * t.sc * 1.08 * pulse + 6; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; rr(x - w / 2, y - w / 2, w, w + 2, w * 0.26); g.stroke(); }
    if (t.flash > 0) { g.globalAlpha = t.flash * 0.5; g.fillStyle = '#fff'; const w = cs * 0.8 * t.sc; rr(x - w / 2, y - w / 2, w, w, w * 0.24); g.fill(); g.globalAlpha = 1; }
  }
  // merge ghosts
  ghosts = ghosts.filter(gh => { gh.t += 0.09 * dt; const k = Math.max(0, Math.min(1, (gh.t - gh.d) / 1)); const a = center(gh.x, gh.y), b = center(gh.tx, gh.ty); const ease = k * k;
    drawTile(a.x + (b.x - a.x) * ease, a.y + (b.y - a.y) * ease, gh.e, 1 - k * 0.6, 0.6, 1 - k * 0.7); return k < 1; });
  g.restore();
  // preview bubble of the merge result while chaining
  if (chain.length > 1) {
    const ne = resultE(chain), y = gy - 32, s = 0.62;
    g.font = "800 15px 'Baloo 2',system-ui"; g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText(`${chain.length} linked  →`, W / 2 - cs * 0.3, y + 2);
    const w0 = L.cs; L.cs = w0 * s; drawTile(W / 2 + w0 * 0.12, y, ne, 1, 0.8); L.cs = w0;
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- input (drag a chain)
function cellAt(px, py, tight = 0.42) {
  const fx_ = (px - L.gx) / L.cs, fy = (py - L.gy) / L.cs, c = Math.floor(fx_), r = Math.floor(fy);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  if (Math.hypot(fx_ - c - 0.5, fy - r - 0.5) > tight) return null;
  return [c, r];
}
let dragging = false;
function linkSound(n) { note(60 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31][Math.min(n, 13)], 0.25, 0.11); }
cv.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return;
  const p = cellAt(e.clientX, e.clientY, 0.6); if (!p) return;
  dragging = true; chain = [p]; botChain = null; linkSound(0); at(p).sc = 1.12; cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!dragging || state !== 'play') return;
  // sample along the move so fast swipes don't skip cells
  const p = cellAt(e.clientX, e.clientY); if (!p) return;
  const last = chain[chain.length - 1]; if (p[0] === last[0] && p[1] === last[1]) return;
  const prev = chain[chain.length - 2];
  if (prev && p[0] === prev[0] && p[1] === prev[1]) { chain.pop(); soft.click(); return; }
  if (canAdd(chain, p)) { chain.push(p); linkSound(chain.length - 1); at(p).sc = 1.15; buzz(6); }
});
const release = () => { if (!dragging) return; dragging = false; const ch = chain; chain = []; if (state === 'play' && ch.length >= 2) merge(ch); else if (ch.length === 1) tone(300, 0.05, 'sine', 0.05, 0.8); };
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);

ui.onTap((which) => {
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win') { level++; targetE = Math.max(targetE + 1, maxE + 1); ui.levels(level); levelLabels(); refresh(); state = 'play'; if (!hasMove()) gameOver(); return; }
  newRun(); state = 'play';
});
layout(); newRun(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hook: the bot finds a strong chain, shows it, then merges it
function bestChain(limit = 30000) {
  let best = null, bestScore = -1, nodes = 0;
  const rec = (ch) => {
    if (++nodes > limit) return;
    if (ch.length >= 2) { const s = resultE(ch) * 100 + ch.length - (2 ** resultE(ch) - chainSum(ch)) / 2 ** resultE(ch) * 50; if (s > bestScore) { bestScore = s; best = ch.slice(); } }
    const [c, r] = ch[ch.length - 1];
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const p = [c + dc, r + dr]; if ((!dc && !dr) || p[0] < 0 || p[0] >= COLS || p[1] < 0 || p[1] >= ROWS) continue;
      if (canAdd(ch, p)) { ch.push(p); rec(ch); ch.pop(); }
    }
  };
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) rec([[c, r]]);
  return best;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// a short chain links itself tile by tile and merges (twice, never the goal tile, points given back), so the board shows the swipe
demo(() => {
  const ch = (bestChain(4000) || []).slice(0, 3); if (ch.length < 2 || resultE(ch) >= targetE) return false;
  const cur = []; chain = cur;
  ch.forEach((p, i) => setTimeout(() => { if (chain !== cur || state !== 'play' || dragging) return; cur.push(p); linkSound(i); at(p).sc = 1.15;
    if (i === ch.length - 1) setTimeout(() => { if (chain !== cur || state !== 'play' || dragging) return; chain = []; const s0 = score, b0 = best; merge(ch); score = s0; if (best !== b0) { best = b0; S.set('best', b0); } refresh(); }, 280); }, i * 260));
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !dragging && !chain.length, wait: 1800, every: 2000, max: 2 });

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || dragging) return;
    if (botChain) { const ch = botChain; botChain = null; chain = []; if (ch.every((p, i) => canAdd(ch.slice(0, i), p))) merge(ch); return; }
    const ch = bestChain(); if (!ch) return;
    botChain = ch; chain = ch.slice(); ch.forEach((p, i) => setTimeout(() => { if (botChain === ch) linkSound(i); }, i * 12));
  },
};

// Orrery — original colour-circle puzzle. Concentric rings carry glowing colour arcs; spin a ring one step at a time.
// When one colour lines up across every ring in the same spoke, the spoke bursts away. Clear every spoke within the moves.
// Levels are generated (seeded): each ring holds the same colours at random places, so every level can always be solved;
// the move budget is the greedy solver's cost plus a little slack. Our own code, MIT.
import { createUI, store, buzz, loop, rng, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as scoreboard } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Orrery: Color Circle Puzzle';
const S = store('orrery');
const F = flow('orrery');
const ui = createUI({ title: 'Orrery', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#5b7cff' });
const D = daily('orrery', ui, { name: NAME });
const B = scoreboard({ game: 'orrery', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.6 }, mode: 'sum', corner: 'tl' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily colour puzzle' : 'Spin · align · burst', doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s} pts` : 'Daily solved ✓') : null });
{ const p = document.createElement('p'); p.textContent = 'Line up one colour across every ring'; p.style.cssText = 'margin-top:14px;font-size:15px;opacity:.85'; (ui.els.start.querySelector('.calm-kicker') || ui.els.start.querySelector('h1')).after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Aligned!';

const COLORS = ['#ff4f7b', '#ffc93c', '#36c2ff', '#4be08a', '#a274ff', '#ff8a3d'];
const SKIES = [
  { bg: ['#1b2350', '#0b1026'], glow: '#3a5bff', acc: '#5b7cff', name: 'Blue Hour' },
  { bg: ['#2a1a4a', '#0e0a20'], glow: '#a24bff', acc: '#a274ff', name: 'Violet Dusk' },
  { bg: ['#0f3340', '#06151b'], glow: '#1fc8b4', acc: '#22b8a6', name: 'Deep Lagoon' },
  { bg: ['#3a1938', '#140a18'], glow: '#ff4d8d', acc: '#ff5d8f', name: 'Rose Night' },
  { bg: ['#25243e', '#0d0e1c'], glow: '#ffb648', acc: '#f0a63a', name: 'Amber Moon' },
];

css(`
body{background:#0b1026}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(8,10,26,.72) 0%,rgba(8,10,26,.5) 55%,rgba(8,10,26,.7) 100%)}
.hc-top{z-index:6}
.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;box-shadow:0 0 14px var(--ui);font-weight:700}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.16);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.14);height:8px}
.hc-top .hc-bar i{box-shadow:0 0 10px var(--ui)}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;opacity:.7}
#sc{position:fixed;z-index:5;right:12px;top:calc(56px + env(safe-area-inset-top));background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:14px;padding:3px 11px;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}
#tip{position:fixed;left:0;right:0;z-index:4;text-align:center;font-size:14px;font-weight:600;letter-spacing:.3px;color:rgba(255,255,255,.72);pointer-events:none;transition:opacity .5s}
`);
const bgc = document.createElement('canvas'); bgc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0'; document.body.prepend(bgc);
const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none'; bgc.after(cv);
const g = cv.getContext('2d');
const scEl = document.createElement('div'); scEl.id = 'sc'; document.body.appendChild(scEl);
const tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip);

// ---------------------------------------------------------------- level model
const SEC = 8, STEP = Math.PI * 2 / SEC;
const mod = (a, n) => ((a % n) + n) % n;
const cellAt = (ring, j) => ring.cells[mod(j - ring.off, SEC)];            // colour shown in sector j (-1 = gap)
function spokes(rings) {                                                    // sectors where every ring shows the same colour
  const out = [];
  for (let j = 0; j < SEC; j++) { const c = cellAt(rings[0], j); if (c < 0) continue; if (rings.every(r => cellAt(r, j) === c)) out.push(j); }
  return out;
}
function clearSpokes(rings) { const js = spokes(rings); for (const j of js) for (const r of rings) r.cells[mod(j - r.off, SEC)] = -1; return js; }
// greedy: the (colour, sector) target closest to complete, and one step toward it. The min cost drops by 1 every step.
function greedyStep(rings) {
  let best = null;
  const colours = new Set(rings[0].cells.filter(c => c >= 0));
  for (const c of colours) for (let j = 0; j < SEC; j++) {
    let cost = 0, steps = [];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]; let bd = 99, bs = 0;
      for (let p = 0; p < SEC; p++) { if (r.cells[p] !== c) continue; const s = mod(p + r.off, SEC), d = mod(j - s, SEC), dd = d <= SEC / 2 ? d : d - SEC; if (Math.abs(dd) < bd) { bd = Math.abs(dd); bs = dd; } }
      cost += bd; steps.push(bs);
    }
    if (!best || cost < best.cost) best = { cost, steps, c, j };
  }
  if (!best || best.cost === 0) return null;
  const i = best.steps.findIndex(s => s !== 0);
  return { ring: i, dir: Math.sign(best.steps[i]), target: best };
}
function cloneRings(rings) { return rings.map(r => ({ cells: r.cells.slice(), off: r.off })); }
function solveCost(rings) { const rs = cloneRings(rings); let n = 0; while (rs[0].cells.some(c => c >= 0) && n < 300) { const s = greedyStep(rs); if (!s) { clearSpokes(rs); continue; } rs[s.ring].off += s.dir; n++; clearSpokes(rs); } return n; }

function makeLevel(seed, lvl, fk) {
  const r = rng(seed * 7919 + 13);
  const R = lvl <= 2 ? 3 : lvl <= 7 ? 4 : 5;
  const N = Math.max(3, Math.min(R >= 5 ? 7 : 6, Math.round((2 + lvl * 0.42) * fk)));
  const K = Math.max(3, Math.min(6, 3 + Math.floor((lvl - 1) / 3)));
  for (let tries = 0; tries < 60; tries++) {
    const cols = Array.from({ length: N }, (_, k) => k < K ? k : Math.floor(r() * K));
    const rings = [];
    for (let i = 0; i < R; i++) {
      const pos = [...Array(SEC).keys()]; for (let k = SEC - 1; k > 0; k--) { const q = Math.floor(r() * (k + 1)); [pos[k], pos[q]] = [pos[q], pos[k]]; }
      const cells = Array(SEC).fill(-1); cols.forEach((c, k) => cells[pos[k]] = c);
      rings.push({ cells, off: 0 });
    }
    if (spokes(rings).length) continue;
    const cost = solveCost(rings);
    if (cost < N + R - 1) continue;                                        // too trivial: try another shuffle
    const slack = Math.max(1, Math.min(9, Math.round((lvl <= 2 ? 4 : 2 + N * 0.35) / fk)));
    return { R, N, rings, moves: cost + slack, par: cost };
  }
  return null;
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = S.get('score', 0), dailyScore = 0;
let lv, rings, movesLeft, cleared, recorded, beatenShown, sky, firstMove, t0 = 0;
let geo = { cx: 0, cy: 0, Rhub: 40, band: 30, tw: 20, Rout: 160 };
const pops = [];          // bursting arcs {i, ang, c, t}
let drag = null, shake = 0, winSpin = 0, hubPulse = 0, dimT = 0;

function build() {
  const fk = D.isDaily ? 1 : F.k();
  const seed = D.seed ? D.seed : level * 4099 + 17;
  lv = makeLevel(seed, D.isDaily ? 8 : level, fk) || makeLevel(seed + 1, 1, 1);
  rings = lv.rings.map(r => ({ cells: r.cells.slice(), off: 0, ang: 0, v: 0, flash: 0, wob: 0 }));
  movesLeft = lv.moves; cleared = 0; recorded = false; beatenShown = false; dailyScore = 0; firstMove = true; pops.length = 0; dimT = 0; winSpin = 0;
  sky = SKIES[(D.isDaily ? D.seed : level - 1) % SKIES.length];
  document.body.style.setProperty('--ui', sky.acc);
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  ui.sub(D.isDaily ? 'Daily · ' + sky.name : sky.name);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  layout(); hud();
}
function layout() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  for (const c of [cv, bgc]) { c.width = W * dpr; c.height = H * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const Rout = Math.min(W * 0.45, H * 0.3, 300), Rhub = Rout * 0.26, R = lv ? lv.R : 4;
  geo = { cx: W / 2, cy: H * 0.5, Rout, Rhub, band: (Rout - Rhub) / R, tw: (Rout - Rhub) / R * 0.66 };
  tip.style.top = geo.cy + Rout + 34 + 'px';
  if (sky) paintSky();
}
addEventListener('resize', () => lv && layout());
function paintSky() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight, b = bgc.getContext('2d'), r = rng((D.seed || level) * 31 + 5);
  b.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky.bg[0]); gr.addColorStop(1, sky.bg[1]); b.fillStyle = gr; b.fillRect(0, 0, W, H);
  const gl = b.createRadialGradient(geo.cx, geo.cy, geo.Rhub, geo.cx, geo.cy, geo.Rout * 1.9); gl.addColorStop(0, sky.glow + '40'); gl.addColorStop(1, sky.glow + '00'); b.fillStyle = gl; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) { b.globalAlpha = 0.15 + r() * 0.5; b.fillStyle = '#fff'; b.beginPath(); b.arc(r() * W, r() * H, r() * 1.2 + 0.2, 0, 7); b.fill(); }
  b.globalAlpha = 1;
  // faint orbit lines, like an old brass orrery drawing
  b.strokeStyle = 'rgba(255,255,255,.05)'; b.lineWidth = 1;
  for (let k = 1; k <= 3; k++) { b.beginPath(); b.arc(geo.cx, geo.cy, geo.Rout + 26 * k, 0, 7); b.stroke(); }
  b.setLineDash([2, 6]); b.beginPath(); b.arc(geo.cx, geo.cy, geo.Rout + 12, 0, 7); b.stroke(); b.setLineDash([]);
  const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); b.fillStyle = vg; b.fillRect(0, 0, W, H);
}
function hud() {
  const s = D.isDaily ? dailyScore : score;
  scEl.textContent = s.toLocaleString();
  ui.progress(cleared / lv.N);
  tip.textContent = firstMove && (D.isDaily || level <= 2) ? 'Drag a ring around · or tap it to turn one step' : `${lv.N - cleared} spoke${lv.N - cleared === 1 ? '' : 's'} to clear`;
}
const ringR = (i) => geo.Rhub + geo.band * (i + 0.5);

// ---------------------------------------------------------------- drawing
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b); return `rgb(${r},${gg},${b})`; }
function tube(cx, cy, r, a0, a1, col, tw, alpha = 1, glow = 1) {
  g.globalAlpha = alpha; g.lineCap = 'round';
  g.shadowColor = col; g.shadowBlur = 16 * glow;
  g.strokeStyle = shade(col, -0.35); g.lineWidth = tw; g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = col; g.lineWidth = tw * 0.74; g.beginPath(); g.arc(cx, cy, r + tw * 0.04, a0, a1); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = tw * 0.2; g.beginPath(); g.arc(cx, cy, r + tw * 0.18, a0 + 0.02, a1 - 0.02); g.stroke();
  g.globalAlpha = 1;
}
function draw(time) {
  const W = innerWidth, H = innerHeight; g.clearRect(0, 0, W, H);
  if (!lv) return;
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0, cx = geo.cx + sx, cy = geo.cy + sy;
  // spoke guides + near-complete hints (all rings but one agree)
  for (let j = 0; j < SEC; j++) {
    const a = -Math.PI / 2 + j * STEP;
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + Math.cos(a) * geo.Rhub, cy + Math.sin(a) * geo.Rhub); g.lineTo(cx + Math.cos(a) * (geo.Rout + 8), cy + Math.sin(a) * (geo.Rout + 8)); g.stroke();
  }
  if (state === 'play' && !drag) for (let j = 0; j < SEC; j++) {
    const cnt = {}; for (const r of rings) { const c = cellAt(r, j); if (c >= 0) cnt[c] = (cnt[c] || 0) + 1; }
    for (const c in cnt) if (cnt[c] === rings.length - 1 && rings.length >= 3) {
      const a = -Math.PI / 2 + (j + 0.5) * STEP, pul = 0.25 + 0.15 * Math.sin(time * 4);
      const gr = g.createLinearGradient(cx + Math.cos(a) * geo.Rhub, cy + Math.sin(a) * geo.Rhub, cx + Math.cos(a) * geo.Rout, cy + Math.sin(a) * geo.Rout);
      gr.addColorStop(0, COLORS[c] + '00'); gr.addColorStop(0.5, COLORS[c]); gr.addColorStop(1, COLORS[c] + '00');
      g.globalAlpha = pul; g.strokeStyle = gr; g.lineWidth = geo.tw * 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * geo.Rhub, cy + Math.sin(a) * geo.Rhub); g.lineTo(cx + Math.cos(a) * geo.Rout, cy + Math.sin(a) * geo.Rout); g.stroke(); g.globalAlpha = 1;
    }
  }
  const inset = (r) => (geo.tw * 0.5 + 3) / r;
  rings.forEach((ring, i) => {
    const r = ringR(i) * (1 + ring.wob * 0.04), sel = drag && drag.i === i;
    g.strokeStyle = sel ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)'; g.lineWidth = geo.tw * 1.05; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    const base = -Math.PI / 2 + ring.ang + winSpin * (i % 2 ? -1 : 1) * (1 + i * 0.3);
    for (let p = 0; p < SEC; p++) {
      const c = ring.cells[p], a0 = base + p * STEP;
      if (c < 0) { g.fillStyle = 'rgba(255,255,255,.12)'; const am = a0 + STEP / 2; g.beginPath(); g.arc(cx + Math.cos(am) * r, cy + Math.sin(am) * r, 2, 0, 7); g.fill(); continue; }
      tube(cx, cy, r, a0 + inset(r), a0 + STEP - inset(r), COLORS[c], geo.tw, dimT ? 1 - dimT * 0.55 : 1, sel ? 1.6 : 1);
    }
    if (ring.flash > 0) { g.globalAlpha = ring.flash * 0.6; g.strokeStyle = '#fff'; g.lineWidth = geo.tw * 1.1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.globalAlpha = 1; }
  });
  for (const p of pops) {
    const r = ringR(p.i) + p.t * 18, a = p.ang, k = 1 - p.t;
    tube(cx, cy, r, a - STEP * 0.32 * (1 + p.t), a + STEP * 0.32 * (1 + p.t), p.t < 0.25 ? '#ffffff' : COLORS[p.c], geo.tw * (1 + p.t * 0.6) * k + 1, k, 2);
  }
  // hub: moves left
  const hr = geo.Rhub * 0.86 * (1 + hubPulse * 0.08);
  const hg = g.createRadialGradient(cx - hr * 0.3, cy - hr * 0.4, hr * 0.1, cx, cy, hr);
  hg.addColorStop(0, 'rgba(255,255,255,.22)'); hg.addColorStop(1, 'rgba(255,255,255,.05)');
  g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, hr, 0, 7); g.fill();
  g.strokeStyle = movesLeft <= 2 && state === 'play' ? '#ff6b81' : sky.acc; g.lineWidth = 2.5; g.shadowColor = g.strokeStyle; g.shadowBlur = 12; g.beginPath(); g.arc(cx, cy, hr, 0, 7); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(hr * 0.78)}px ui-serif,'New York',Georgia,serif`; g.fillText(movesLeft, cx, cy - hr * 0.1);
  g.font = `700 ${Math.max(9, Math.round(hr * 0.2))}px system-ui,-apple-system,sans-serif`; g.globalAlpha = 0.7; g.fillText('MOVES', cx, cy + hr * 0.48); g.globalAlpha = 1;
  // first-level hand hint: a curved arrow on the ring the solver would turn first
  if (state === 'play' && firstMove && !drag && (level <= 2 || D.isDaily)) {
    const s = greedyStep(rings); if (s) {
      const r = ringR(s.ring) + geo.tw * 0.95, a = -Math.PI / 2 - 0.5 + ((time * 0.9) % 1) * 0.9 * s.dir, a0 = -Math.PI / 2 - 0.5;
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, r, Math.min(a0, a), Math.max(a0, a)); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 7, 0, 7); g.fill();
    }
  }
}

// ---------------------------------------------------------------- moves
function commit(i, steps) {
  if (!steps) return;
  const ring = rings[i]; ring.off += steps; movesLeft -= Math.abs(steps); firstMove = false; hubPulse = 1;
  soft.wood(); buzz(6);
  const cols = spokes(rings).map(j => cellAt(rings[0], j)), js = clearSpokes(rings);
  if (js.length) setTimeout(() => burstSpokes(js, cols), 140);
  cleared += js.length;
  if (js.length) {
    const pts = 100 * js.length * js.length; score += pts; dailyScore += pts; S.set('score', score);
    if (js.length > 1) ui.pop(js.length === 2 ? 'DOUBLE!' : 'TRIPLE!', '#fff', 36, 22);
    else ui.pop(['Aligned', 'Lovely', 'Clean', 'Bright'][cleared % 4], '#fff', 26, 22);
  }
  hud(); checkBeat();
  if (cleared >= lv.N) return setTimeout(win, 420);
  if (movesLeft <= 0) setTimeout(lose, 520);
}
function burstSpokes(js, cols) {
  js.forEach((j, n) => setTimeout(() => {
    const a = -Math.PI / 2 + (j + 0.5) * STEP;
    rings.forEach((r, i) => {
      const rr = ringR(i), x = geo.cx + Math.cos(a) * rr, y = geo.cy + Math.sin(a) * rr;
      pops.push({ i, ang: a, c: cols[n], t: 0 });
      setTimeout(() => { fx.sparks(x, y, ['#fff', COLORS[cols[n]]], 7, { speed: 3.4, size: 3 }); chime(i + 2 + n * 2, 72, 0.1); }, i * 55);
      r.flash = 0.7; r.wob = 1;
    });
    fx.ring(geo.cx, geo.cy, '#fff', geo.Rhub); shake = 5; buzz(14);
  }, n * 160));
}
function checkBeat() { const s = D.isDaily ? dailyScore : score; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
function win() {
  if (state !== 'play') return; state = 'won';
  const ms = performance.now() - t0;
  if (!recorded) { recorded = true; B.submit(1, { ms }); if (!D.isDaily) F.level(true); }
  const bonus = movesLeft * 25 + 100; score += bonus; dailyScore += bonus; S.set('score', score); hud(); checkBeat();
  winSpin = 0.0001; arp([67, 72, 76, 79, 84], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const shown = D.isDaily ? dailyScore : score;
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyScore > prev.s) S.set(k, { s: dailyScore }); }
  else { level++; S.set('level', level); }
  D.won(shown);
  ui.win(D.isDaily ? '' : level - 1, `${lv.N} spokes · ${movesLeft} move${movesLeft === 1 ? '' : 's'} spare · ${shown.toLocaleString()} pts`);
}
function lose() {
  if (state !== 'play') return; state = 'lost'; dimT = 0.0001;
  if (!recorded) { recorded = true; B.submit(0, { ms: performance.now() - t0 }); if (!D.isDaily) F.level(false, cleared / lv.N); }
  soft.err(); buzz([30, 40, 30]);
  ui.lose('Out of moves', `${lv.N - cleared} spoke${lv.N - cleared === 1 ? '' : 's'} left · try another order`);
}

// ---------------------------------------------------------------- input: drag a ring around the centre, or tap it
const angOf = (e) => Math.atan2(e.clientY - geo.cy, e.clientX - geo.cx);
cv.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return;
  const d = Math.hypot(e.clientX - geo.cx, e.clientY - geo.cy);
  if (d < geo.Rhub * 0.9 || d > geo.Rout + geo.band * 0.9) return;
  const i = Math.max(0, Math.min(rings.length - 1, Math.floor((d - geo.Rhub) / geo.band)));
  drag = { i, a: angOf(e), sum: 0, base: rings[i].off, t: performance.now(), tick: 0, x: e.clientX, y: e.clientY };
  cv.setPointerCapture(e.pointerId); soft.click();
});
cv.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const a = angOf(e); let da = a - drag.a; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
  drag.a = a; drag.sum += da;
  const lim = movesLeft * STEP + STEP * 0.4; drag.sum = Math.max(-lim, Math.min(lim, drag.sum));
  const ring = rings[drag.i]; ring.ang = drag.base * STEP + drag.sum; ring.v = 0;
  const tk = Math.round(drag.sum / STEP); if (tk !== drag.tick) { drag.tick = tk; tone(900 + Math.abs(tk) * 60, 0.025, 'sine', 0.05, 0.7); buzz(3); }
});
const endDrag = (e) => {
  if (!drag) return; const dd = drag; drag = null;
  let steps = Math.round(dd.sum / STEP);
  const moved = Math.hypot(e.clientX - dd.x, e.clientY - dd.y);
  if (!steps && moved < 12 && performance.now() - dd.t < 450) steps = 1;   // tap = one step clockwise
  steps = Math.max(-movesLeft, Math.min(movesLeft, steps));
  if (steps) commit(dd.i, steps);
  rings[dd.i].v = (rings[dd.i].off * STEP - rings[dd.i].ang) * 0.35;      // springy snap
};
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

ui.onTap((which) => {
  B.start(); t0 = performance.now();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});

build();

loop((dt, t) => {
  if (!lv) return;
  for (const r of rings) {
    if (!drag || drag.i !== rings.indexOf(r)) { r.v += (r.off * STEP - r.ang) * 0.22 * dt; r.v *= Math.pow(0.68, dt); r.ang += r.v * dt; }
    r.flash = Math.max(0, r.flash - 0.04 * dt); r.wob *= Math.pow(0.86, dt);
  }
  for (const p of pops) p.t += 0.035 * dt;
  for (let k = pops.length - 1; k >= 0; k--) if (pops[k].t >= 1) pops.splice(k, 1);
  shake = Math.max(0, shake - 0.4 * dt); hubPulse = Math.max(0, hubPulse - 0.06 * dt);
  if (winSpin) winSpin += 0.006 * dt * Math.max(0.2, 1 - winSpin * 0.3);
  if (dimT) dimT = Math.min(1, dimT + 0.04 * dt);
  draw(t);
});

// ---------------------------------------------------------------- test hook: the bot turns one ring one step toward the closest spoke
let botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyScore : score; },
  bot() {
    if (state !== 'play' || drag || movesLeft <= 0) return;
    const now = performance.now(); if (now - botTick < 330) return; botTick = now;   // about a human's pace: one turn every third of a second
    const s = greedyStep(rings); if (!s) return;
    commit(s.ring, s.dir);
  },
};

// Railknot — a subway map builder. Stations pop up around a river city; drag between stations to draw lines,
// trains carry shape passengers to a station of their shape. A station that stays overcrowded ends the run.
// Every week you pick a reward: a new line, an extra train, a carriage or tunnels.
import { createUI, store, buzz, tone, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, arp, soft } from './calm.js';

const NAME = 'Railknot: Subway Map Puzzle';
const S = store('railknot');
const F = flow('railknot', { par: 300, warmup: 0 });
const ui = createUI({ title: 'Railknot', hint: 'Tap to open the first stations', hand: '', score: false, progress: false });
cardTheme({ accent: '#e8453c' });
const D = daily('railknot', ui, { name: NAME });
const B = board({ game: 'railknot', label: 'Passengers', limits: { maxRun: 4000, maxPerSec: 4 }, corner: 'tl', accent: '#f5b800' });
const fx = fx2d(30);
startCard(ui, D, { kicker: D.isDaily ? 'Daily city · same map for everyone' : 'Subway map puzzle', dailySub: 'Same city and riders for everyone' });
{ const p = document.createElement('p'); const b = S.get('best', 0); p.textContent = b ? `Best: ${b} passengers` : 'Drag between stations to draw lines'; p.style.marginTop = '6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
ui.els.win.querySelector('p').innerHTML = 'WEEK <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Week done!';
ui.els.win.querySelector('.hint').textContent = 'Tap to pick a reward';
ui.els.lose.querySelector('.hint').textContent = D.isDaily ? 'Tap to retry today\'s city' : 'Tap for a new city';

const COLORS = ['#e8453c', '#f5b800', '#2c7be5', '#2bb673', '#9b59d0', '#ff7f2a', '#1fb5c9'];
const SHAPES = ['circle', 'triangle', 'square', 'star', 'diamond', 'cross', 'drop'];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_S = 3.2, CAP = 6, OVER_S = 16, TRAIN_V = 72;

css(`
body{background:#f4f1ea;color:#2b2b33}
#map{position:fixed;inset:0;width:100%;height:100%;z-index:1;touch-action:none}
#hud{position:fixed;top:calc(10px + env(safe-area-inset-top));right:10px;left:62px;display:flex;justify-content:flex-end;gap:8px;z-index:5;pointer-events:none}
.pill{background:#fff;border-radius:16px;padding:6px 12px;font-weight:800;font-size:17px;box-shadow:0 2px 8px rgba(0,0,0,.12);display:flex;align-items:center;gap:6px;white-space:nowrap;color:#2b2b33}
#clock{width:42px;height:42px;border-radius:50%;background:conic-gradient(#2b2b33 var(--p,0%),#e3dfd5 0);display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.12)}
#clock span{width:34px;height:34px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;letter-spacing:.5px}
#bar{position:fixed;left:0;right:0;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;justify-content:center;align-items:center;gap:8px;z-index:5;padding:0 10px}
.lt{width:38px;height:38px;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2);cursor:pointer;display:grid;place-items:center;color:#fff;font-weight:800;font-size:16px;transition:transform .15s}
.lt.off{opacity:.28;box-shadow:none;cursor:default}
.lt.arm{transform:scale(1.18);animation:arm .5s infinite alternate}
@keyframes arm{to{box-shadow:0 0 0 5px rgba(232,69,60,.35)}}
.res{background:#fff;border-radius:14px;padding:6px 10px;font-weight:800;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.12);white-space:nowrap}
#spd{font:inherit;border:0;cursor:pointer}
#tipl{position:fixed;left:0;right:0;bottom:calc(64px + env(safe-area-inset-bottom));text-align:center;z-index:5;font-weight:700;font-size:14px;color:#6b6760;pointer-events:none;transition:opacity .4s}
#rew{position:fixed;inset:0;z-index:25;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(244,241,234,.86);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:20px}
#rew[hidden]{display:none}
#rew h2{margin:0;font-family:ui-serif,Georgia,serif;font-size:34px;font-weight:600;color:#2b2b33}
#rew p{margin:0;color:#6b6760;font-weight:600}
#rew .row{display:flex;gap:14px}
.rw{width:150px;background:#fff;border-radius:20px;padding:18px 10px;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.12);cursor:pointer;transition:transform .15s;color:#2b2b33}
.rw:active{transform:scale(.96)}.rw i{font-style:normal;font-size:44px;display:block}.rw b{display:block;font-size:18px;margin-top:6px}.rw span{font-size:13px;color:#6b6760}
`);
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const cv = document.createElement('canvas'); cv.id = 'map'; document.body.prepend(cv);
const g = cv.getContext('2d');
document.body.appendChild($(`<div id="hud"><div class="pill" id="pax">👤 0</div><div id="clock"><span>MON</span></div></div>`));
const bar = $(`<div id="bar"></div>`); document.body.appendChild(bar);
const tipl = $(`<div id="tipl">Drag from a station to another to draw a line</div>`); document.body.appendChild(tipl);
const rew = $(`<div id="rew" hidden><h2>New week</h2><p>Pick one for your network</p><div class="row"></div></div>`); document.body.appendChild(rew);
rew.addEventListener('pointerdown', e => e.stopPropagation()); bar.addEventListener('pointerdown', e => e.stopPropagation());
let W, H, dpr;
function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; }
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- state
let state = 'ready', phase = 'play', R = Math.random, seed = 1;
let stations = [], lines = [], river = [], tunnels = 2, maxLines = 3, spare = { train: 0, carriage: 0 };
let time = 0, nextStation = 0, nextPax = 0, delivered = 0, week = 1, speed = 1, runT0 = 0, recorded = false, beatShown = false;
let cam = { x: 0, y: 0, s: 1, ts: 1, tx: 0, ty: 0 }, drag = null, armed = -1, armT = 0, rings = [], dist = {};
let sid = 0;
const rnd = () => R();

function newGame() {
  const n = S.get('runs', 0) + 1; S.set('runs', n);
  seed = D.seed || (Date.now() % 1e9) + n * 7919; let s = seed % 2147483647 || 1; R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  stations = []; lines = []; tunnels = 2; maxLines = 3; spare = { train: 0, carriage: 0 }; time = 0; delivered = 0; week = 1; rings = [];
  recorded = false; beatShown = false; runT0 = performance.now(); phase = 'play';
  // a river winding across the city
  const amp = 40 + rnd() * 40, f = 0.006 + rnd() * 0.004, ph = rnd() * 6, off = (rnd() - 0.5) * 60, tilt = (rnd() - 0.5) * 0.4;
  river = []; for (let x = -900; x <= 900; x += 20) river.push({ x, y: off + x * tilt + Math.sin(x * f + ph) * amp });
  for (const sh of [0, 1, 2]) addStation(sh, 110);
  nextStation = DAY_S * 1.4; nextPax = 1.2;
  cam.s = cam.ts = fitScale(); cam.x = cam.tx; cam.y = cam.ty;
  state = 'play'; B.start(); drawBar(); hud();
  tipl.style.opacity = 1;
}
function riverDist(x, y) { let m = 1e9; for (let i = 0; i < river.length - 1; i++) m = Math.min(m, segDist(x, y, river[i], river[i + 1])); return m; }
function segDist(px, py, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy; let t = l ? ((px - a.x) * dx + (py - a.y) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - a.x - t * dx, py - a.y - t * dy); }
function addStation(shape, R0) {
  const aspect = Math.max(0.45, Math.min(2.2, W / Math.max(1, H - 160)));
  const rad = R0 || Math.min(420, 120 + stations.length * 13);
  for (let tries = 0; tries < 200; tries++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * rad, x = Math.cos(a) * r * Math.sqrt(aspect), y = Math.sin(a) * r / Math.sqrt(aspect);
    if (riverDist(x, y) < 34) continue;
    if (stations.some(s => Math.hypot(s.x - x, s.y - y) < 64)) continue;
    if (shape == null) { const v = rnd(); const present = new Set(stations.map(s => s.shape));
      shape = v < 0.5 ? 0 : v < 0.78 ? 1 : v < 0.9 ? 2 : 3 + Math.floor(rnd() * 4);
      if (shape >= 3 && present.has(shape)) shape = Math.floor(rnd() * 3); }
    const st = { id: sid++, x, y, shape, q: [], over: 0, born: time };
    stations.push(st); rings.push({ x, y, t: 0, c: '#2b2b33' });
    if (state === 'play') { tone(880, 0.12, 'sine', 0.06, 1.2); }
    recalc(); return st;
  }
}
const lineHas = (L, st) => L.stops.includes(st);
const isLoop = L => L.stops.length > 2 && L.stops[0] === L.stops[L.stops.length - 1];
function corner(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax > ay) return { x: b.x - Math.sign(dx) * ay, y: a.y };
  return { x: a.x, y: b.y - Math.sign(dy) * ax };
}
function buildPath(L) {
  const pts = [], sd = [0]; let d = 0;
  for (let i = 0; i < L.stops.length; i++) {
    const s = L.stops[i];
    if (i > 0) { const p = L.stops[i - 1], c = corner(p, s); d += Math.hypot(c.x - p.x, c.y - p.y); pts.push({ x: c.x, y: c.y, d }); d += Math.hypot(s.x - c.x, s.y - c.y); sd.push(d); }
    pts.push({ x: s.x, y: s.y, d });
  }
  L.pts = pts; L.sd = sd;
}
function posOn(L, dd) {
  const p = L.pts; if (p.length < 2) return { x: p[0].x, y: p[0].y, a: 0 };
  for (let i = 1; i < p.length; i++) if (p[i].d >= dd || i === p.length - 1) { const a = p[i - 1], b = p[i], l = b.d - a.d || 1, t = Math.max(0, Math.min(1, (dd - a.d) / l)); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, a: Math.atan2(b.y - a.y, b.x - a.x) }; }
}
function segCross(a, b, c, d) { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); }
function crossesRiver(a, b) { const c = corner(a, b); for (let i = 0; i < river.length - 1; i++) if (segCross(a, c, river[i], river[i + 1]) || segCross(c, b, river[i], river[i + 1])) return true; return false; }
function tunnelsUsed() { let n = 0; for (const L of lines) for (let i = 1; i < L.stops.length; i++) if (crossesRiver(L.stops[i - 1], L.stops[i])) n++; return n; }
function canLink(a, b) { return !crossesRiver(a, b) || tunnelsUsed() < tunnels; }

// routing: hops from every station to the nearest station of each shape over the line network
function recalc() {
  const adj = new Map(stations.map(s => [s, new Set()]));
  for (const L of lines) for (let i = 1; i < L.stops.length; i++) { adj.get(L.stops[i - 1]).add(L.stops[i]); adj.get(L.stops[i]).add(L.stops[i - 1]); }
  dist = {};
  for (let sh = 0; sh < SHAPES.length; sh++) {
    const m = new Map(), q = stations.filter(s => s.shape === sh); q.forEach(s => m.set(s, 0));
    for (let i = 0; i < q.length; i++) for (const n of adj.get(q[i])) if (!m.has(n)) { m.set(n, m.get(q[i]) + 1); q.push(n); }
    dist[sh] = m;
  }
}
const dOf = (sh, st) => { const v = dist[sh] && dist[sh].get(st); return v == null ? Infinity : v; };

// ---------------------------------------------------------------- lines + trains
function newLine(a, b) {
  const used = new Set(lines.map(l => l.ci)); let ci = 0; while (used.has(ci)) ci++;
  const L = { ci, color: COLORS[ci], stops: [a, b], trains: [] };
  buildPath(L); lines.push(L); addTrain(L); recalc(); drawBar(); hud(); tipl.style.opacity = 0; return L;
}
function addTrain(L) { L.trains.push({ seg: 0, f: 0, dir: 1, cap: CAP, load: [], dwell: 0.3 }); }
function extend(L, end, st) {
  if (end === 0) { L.stops.unshift(st); for (const t of L.trains) t.seg++; }
  else L.stops.push(st);
  buildPath(L); recalc();
}
function removeLine(L) {
  for (const t of L.trains) { const s = L.stops[Math.min(L.stops.length - 1, t.seg + (t.f > 0.5 ? 1 : 0))]; for (const p of t.load) s.q.push(p); }
  lines = lines.filter(l => l !== L); recalc(); drawBar(); soft.swish(); buzz(10);
}
function nextStopAfter(L, i, dir) {
  const n = L.stops.length;
  if (isLoop(L)) { let j = i + dir; if (j >= n) j = 1; if (j < 0) j = n - 2; return L.stops[j]; }
  let j = i + dir; if (j >= n || j < 0) j = i - dir; return L.stops[j];
}
function arrive(L, t, i) {
  const st = L.stops[i];
  // which way will we leave?
  let dir = t.dir; const n = L.stops.length;
  if (!isLoop(L) && (i + dir >= n || i + dir < 0)) dir = -dir;
  const nxt = nextStopAfter(L, i, t.dir);
  let moved = 0;
  // drop off
  for (let k = t.load.length - 1; k >= 0; k--) {
    const sh = t.load[k];
    if (st.shape === sh) { t.load.splice(k, 1); moved++; deliver(st); }
    else if (dOf(sh, nxt) >= dOf(sh, st) && dOf(sh, st) < Infinity) { t.load.splice(k, 1); st.q.push(sh); moved++; }
  }
  // pick up
  for (let k = 0; k < st.q.length && t.load.length < t.cap; k++) {
    const sh = st.q[k];
    if (dOf(sh, nxt) < dOf(sh, st)) { t.load.push(sh); st.q.splice(k, 1); k--; moved++; }
  }
  t.dwell = 0.25 + moved * 0.08;
}
function deliver(st) {
  delivered++; hud();
  rings.push({ x: st.x, y: st.y, t: 0, c: '#2bb673', small: true });
  note(72 + [0, 2, 4, 7, 9, 12][delivered % 6], 0.18, 0.05);
  if (!beatShown && D.beaten(delivered)) { beatShown = true; ui.pop('BEATEN!', '#e8453c', 40, 22); fx.confetti(80); }
}
function stepTrains(dt) {
  for (const L of lines) {
    const n = L.stops.length; if (n < 2) continue;
    for (const t of L.trains) {
      if (t.seg > n - 2) { t.seg = n - 2; t.f = 1; }
      if (t.dwell > 0) { t.dwell -= dt; continue; }
      const segLen = (L.sd[t.seg + 1] - L.sd[t.seg]) || 1;
      t.f += t.dir * TRAIN_V * dt / segLen;
      if (t.dir > 0 && t.f >= 1) {
        const i = t.seg + 1;
        if (isLoop(L) && i === n - 1) { t.seg = 0; t.f = 0; arrive(L, t, 0); }
        else if (i === n - 1) { t.f = 1; arrive(L, t, i); t.dir = -1; }
        else { t.seg = i; t.f = 0; arrive(L, t, i); }
      } else if (t.dir < 0 && t.f <= 0) {
        const i = t.seg;
        if (isLoop(L) && i === 0) { t.seg = n - 2; t.f = 1; arrive(L, t, n - 1); }
        else if (i === 0) { t.f = 0; arrive(L, t, 0); t.dir = 1; }
        else { t.seg = i - 1; t.f = 1; arrive(L, t, i); }
      }
    }
  }
}

// ---------------------------------------------------------------- sim
function step(dt) {
  time += dt;
  const day = time / DAY_S, fk = F.k();
  if (time >= nextStation) { addStation(null); nextStation = time + DAY_S * (1.5 + Math.min(1.5, day * 0.04)) / Math.sqrt(fk); }
  if (time >= nextPax) {
    const shapes = [...new Set(stations.map(s => s.shape))];
    const st = stations[Math.floor(rnd() * stations.length)];
    const opts = shapes.filter(s => s !== st.shape), w = opts.map(s => s === 0 ? 4 : s === 1 ? 3 : s === 2 ? 2 : 1);
    let r = rnd() * w.reduce((a, b) => a + b, 0), k = 0; while (r >= w[k]) { r -= w[k]; k++; }
    st.q.push(opts[k]);
    nextPax = time + 5.5 / stations.length / (1 + day * 0.04) / fk;
  }
  stepTrains(dt);
  for (const s of stations) {
    if (s.q.length > CAP) { s.over += dt / OVER_S; if (s.over >= 1) return gameOver(s); }
    else s.over = Math.max(0, s.over - dt / OVER_S * 0.5);
  }
  if (day >= week * 7) weekDone();
}
function weekDone() {
  phase = 'week'; state = 'won';
  S.set('best', Math.max(S.get('best', 0), delivered)); B.submit(delivered, { ms: performance.now() - runT0 }); D.won(delivered, 'delivered');
  ui.win(week, `${delivered} passengers so far`); fx.confetti(90); arp([67, 72, 76, 79], 90, 0.1); buzz([20, 30, 20]);
}
function showRewards() {
  phase = 'reward'; state = 'play';
  const A = maxLines < 7 && rnd() < 0.6 ? 'line' : 'train', Bk = rnd() < 0.5 ? 'carriage' : 'tunnel';
  const info = { line: ['🛤️', 'New line', 'One more colour to draw'], train: ['🚇', 'Train', 'An extra train on your busiest line'], carriage: ['🚃', 'Carriage', '+6 seats on your busiest train'], tunnel: ['🌉', '2 Tunnels', 'Cross the river twice more'] };
  const row = rew.querySelector('.row'); row.innerHTML = '';
  rew.querySelector('h2').textContent = `Week ${week + 1}`;
  for (const k of [A, Bk]) { const e = $(`<div class="rw"><i>${info[k][0]}</i><b>${info[k][1]}</b><span>${info[k][2]}</span></div>`); e.addEventListener('click', ev => { ev.stopPropagation(); takeReward(k); }); row.appendChild(e); }
  rew.hidden = false; rew.dataset.opts = [A, Bk].join();
}
function busiest() { let best = null, bw = -1; for (const L of lines) { const w = L.stops.reduce((a, s) => a + s.q.length, 0) / L.trains.length; if (w > bw) { bw = w; best = L; } } return best; }
function takeReward(k) {
  if (k === 'line') maxLines++;
  else if (k === 'tunnel') tunnels += 2;
  else { const L = busiest(); if (!L) spare[k]++; else if (k === 'train') addTrain(L); else { const t = L.trains.reduce((a, b) => (a.cap <= b.cap ? a : b)); t.cap += 6; } }
  rew.hidden = true; week++; phase = 'play'; drawBar(); hud(); arp([72, 79], 80, 0.1); soft.wood();
}
function gameOver(st) {
  phase = 'over'; state = 'lost'; st.over = 1;
  if (!recorded) { recorded = true; F.endless(delivered); }
  S.set('best', Math.max(S.get('best', 0), delivered)); B.submit(delivered, { ms: performance.now() - runT0 });
  ui.lose('Overcrowded!', `A station waited too long. ${delivered} passengers in ${week} week${week > 1 ? 's' : ''}.`);
  tone(220, 0.3, 'triangle', 0.1, 0.5); setTimeout(() => tone(150, 0.5, 'triangle', 0.1, 0.5), 200); buzz([60, 40, 60]);
  cam.focus = st;
}

// ---------------------------------------------------------------- HUD
function hud() {
  document.getElementById('pax').textContent = '👤 ' + delivered;
  const day = time / DAY_S, d = Math.floor(day) % 7;
  const c = document.getElementById('clock'); c.style.setProperty('--p', ((day % 1) * 100).toFixed(1) + '%'); c.querySelector('span').textContent = DAYS[d];
}
function drawBar() {
  bar.innerHTML = '';
  for (let i = 0; i < maxLines; i++) {
    const L = lines.find(l => l.ci === i), e = $(`<div class="lt ${L ? '' : 'off'} ${armed === i ? 'arm' : ''}"></div>`);
    e.style.background = COLORS[i]; if (armed === i) e.textContent = '✕';
    e.addEventListener('click', ev => { ev.stopPropagation(); if (!L) return; if (armed === i) { armed = -1; removeLine(L); } else { armed = i; armT = performance.now(); soft.click(); drawBar(); tipl.textContent = 'Tap again to remove this line'; tipl.style.opacity = 1; } });
    bar.appendChild(e);
  }
  bar.appendChild($(`<div class="res">🌉 ${Math.max(0, tunnels - tunnelsUsed())}</div>`));
  const sp = $(`<button class="res" id="spd">${speed === 1 ? '▶' : '▶▶'}</button>`); sp.addEventListener('click', e => { e.stopPropagation(); speed = speed === 1 ? 2 : 1; soft.click(); drawBar(); }); bar.appendChild(sp);
}

// ---------------------------------------------------------------- camera + input
const PAD_T = 70, PAD_B = 90;
function fitScale() {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const s of stations) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
  const m = 52; x0 -= m; x1 += m; y0 -= m; y1 += m;
  cam.tx = (x0 + x1) / 2; cam.ty = (y0 + y1) / 2;
  return Math.min(2, (W - 20) / (x1 - x0), (H - PAD_T - PAD_B) / (y1 - y0));
}
const toS = (x, y) => ({ x: (x - cam.x) * cam.s + W / 2, y: (y - cam.y) * cam.s + PAD_T + (H - PAD_T - PAD_B) / 2 });
const toW = (x, y) => ({ x: (x - W / 2) / cam.s + cam.x, y: (y - PAD_T - (H - PAD_T - PAD_B) / 2) / cam.s + cam.y });
function stationAt(px, py, r = 26) { let best = null, bd = r; for (const s of stations) { const p = toS(s.x, s.y), d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = s; } } return best; }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || phase !== 'play') return;
  if (armed >= 0) { armed = -1; drawBar(); }
  const st = stationAt(e.clientX, e.clientY); if (!st) return;
  // a line end here? extend it. otherwise start a new line
  let L = null, end = 1;
  for (const l of lines) { if (isLoop(l)) continue; if (l.stops[l.stops.length - 1] === st) { L = l; end = 1; break; } if (l.stops[0] === st) { L = l; end = 0; break; } }
  if (!L && lines.length >= maxLines) { tipl.textContent = 'All lines in use: extend a line from its end, or tap a colour to remove one'; tipl.style.opacity = 1; soft.err(); return; }
  drag = { L, end, from: st, x: e.clientX, y: e.clientY, made: false };
  cv.setPointerCapture(e.pointerId); soft.click();
});
cv.addEventListener('pointermove', e => {
  if (!drag) return; drag.x = e.clientX; drag.y = e.clientY;
  const st = stationAt(e.clientX, e.clientY, 22); if (!st || st === drag.from) return;
  tryLink(st);
});
function tryLink(st) {
  if (drag.L && lineHas(drag.L, st) && !(st === drag.L.stops[drag.end === 0 ? drag.L.stops.length - 1 : 0] && drag.L.stops.length >= 3)) return;
  if (!canLink(drag.from, st)) { if (!drag.warned) { drag.warned = 1; tipl.textContent = 'No tunnels left to cross the river'; tipl.style.opacity = 1; soft.err(); buzz(20); } return; }
  if (!drag.L) { drag.L = newLine(drag.from, st); drag.end = 1; }
  else extend(drag.L, drag.end, st);
  drag.from = st; drag.made = true; tipl.style.opacity = 0;
  if (isLoop(drag.L)) { drag = null; arp([72, 79, 84], 60, 0.08); }
  tone(600 + 40 * (drag ? drag.L.stops.length : 0), 0.06, 'triangle', 0.08, 1.2); buzz(8); drawBar();
}
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointercancel', () => { drag = null; });

// ---------------------------------------------------------------- drawing
function shapePath(sh, x, y, r) {
  g.beginPath();
  switch (SHAPES[sh]) {
    case 'circle': g.arc(x, y, r, 0, Math.PI * 2); break;
    case 'triangle': g.moveTo(x, y - r * 1.15); g.lineTo(x + r * 1.1, y + r * 0.75); g.lineTo(x - r * 1.1, y + r * 0.75); g.closePath(); break;
    case 'square': g.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.55 : r * 1.25; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); break;
    case 'diamond': g.moveTo(x, y - r * 1.25); g.lineTo(x + r * 1.05, y); g.lineTo(x, y + r * 1.25); g.lineTo(x - r * 1.05, y); g.closePath(); break;
    case 'cross': { const a = r * 0.42, b = r * 1.1; g.moveTo(x - a, y - b); g.lineTo(x + a, y - b); g.lineTo(x + a, y - a); g.lineTo(x + b, y - a); g.lineTo(x + b, y + a); g.lineTo(x + a, y + a); g.lineTo(x + a, y + b); g.lineTo(x - a, y + b); g.lineTo(x - a, y + a); g.lineTo(x - b, y + a); g.lineTo(x - b, y - a); g.lineTo(x - a, y - a); g.closePath(); break; }
    case 'drop': g.moveTo(x, y - r * 1.3); g.quadraticCurveTo(x + r * 1.2, y + r * 0.1, x, y + r); g.quadraticCurveTo(x - r * 1.2, y + r * 0.1, x, y - r * 1.3); break;
  }
}
function render(dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, W, H);
  if (!stations.length) return;
  if (phase === 'play' || phase === 'week') cam.ts = fitScale();
  const k = Math.min(1, 0.04 * dt); cam.s += (cam.ts - cam.s) * k; cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k;
  // river
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#c4e2f2'; g.lineWidth = Math.max(14, 28 * cam.s); g.beginPath(); river.forEach((p, i) => { const s = toS(p.x, p.y); i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); }); g.stroke();
  // lines
  const LW = Math.max(5, Math.min(8, 7 * cam.s));
  lines.forEach((L, li) => {
    const off = (li - (lines.length - 1) / 2) * 0; g.strokeStyle = L.color; g.lineWidth = LW;
    g.beginPath(); L.pts.forEach((p, i) => { const s = toS(p.x, p.y); i ? g.lineTo(s.x + off, s.y + off) : g.moveTo(s.x + off, s.y + off); }); g.stroke();
    if (!isLoop(L)) for (const [a, b] of [[L.stops[0], L.stops[1]], [L.stops[L.stops.length - 1], L.stops[L.stops.length - 2]]]) { // end caps (T-bar), like a map
      const pa = toS(a.x, a.y), c = corner(b, a), pc = toS(c.x, c.y); let ang = Math.atan2(pa.y - pc.y, pa.x - pc.x); if (Math.hypot(pa.y - pc.y, pa.x - pc.x) < 1) { const pb = toS(b.x, b.y); ang = Math.atan2(pa.y - pb.y, pa.x - pb.x); }
      const ex = pa.x + Math.cos(ang) * 22, ey = pa.y + Math.sin(ang) * 22; g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(ex, ey); g.stroke();
      g.beginPath(); g.moveTo(ex - Math.sin(ang) * 9, ey + Math.cos(ang) * 9); g.lineTo(ex + Math.sin(ang) * 9, ey - Math.cos(ang) * 9); g.stroke();
    }
    // river crossings → tunnel marks
    for (let i = 1; i < L.stops.length; i++) if (crossesRiver(L.stops[i - 1], L.stops[i])) { const a = toS(L.stops[i - 1].x, L.stops[i - 1].y), b = toS(L.stops[i].x, L.stops[i].y); }
  });
  // drag preview
  if (drag) { const a = toS(drag.from.x, drag.from.y), col = drag.L ? drag.L.color : COLORS[(() => { const u = new Set(lines.map(l => l.ci)); let c = 0; while (u.has(c)) c++; return c; })()];
    g.strokeStyle = col; g.globalAlpha = 0.6; g.lineWidth = LW; g.setLineDash([2, 10]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(drag.x, drag.y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  // trains
  const TR = Math.max(9, Math.min(14, 13 * cam.s));
  for (const L of lines) for (const t of L.trains) {
    if (L.stops.length < 2) continue;
    const seg = Math.min(t.seg, L.stops.length - 2), d = L.sd[seg] + (L.sd[seg + 1] - L.sd[seg]) * Math.max(0, Math.min(1, t.f)), p = posOn(L, d), s = toS(p.x, p.y);
    const len = TR * (2.2 + (t.cap - CAP) / 6 * 1.2);
    g.save(); g.translate(s.x, s.y); g.rotate(p.a); g.fillStyle = L.color; g.beginPath(); g.roundRect(-len / 2, -TR * 0.62, len, TR * 1.24, 3); g.fill();
    g.fillStyle = '#fff'; const per = Math.ceil(t.cap / 2);
    t.load.forEach((sh, i) => { const cx = -len / 2 + 5 + (i % per) * ((len - 10) / Math.max(1, per - 1 || 1)), cy = i < per ? -TR * 0.27 : TR * 0.27; g.save(); g.translate(cx, cy); g.rotate(-p.a); shapePath(sh, 0, 0, TR * 0.2); g.fill(); g.restore(); });
    g.restore();
  }
  // stations
  const SR = Math.max(9, Math.min(13, 12 * cam.s));
  for (const s of stations) {
    const p = toS(s.x, s.y), age = Math.min(1, (time - s.born) / 0.5), r = SR * (age < 1 ? 0.4 + 0.6 * Math.sin(age * Math.PI / 2) * 1.1 : 1);
    if (s.over > 0) { g.fillStyle = 'rgba(80,80,90,.18)'; g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, SR * 3.1, -Math.PI / 2, -Math.PI / 2 + s.over * Math.PI * 2); g.closePath(); g.fill();
      if (s.over > 0.5) { g.strokeStyle = `rgba(232,69,60,${0.4 + 0.4 * Math.sin(time * 10)})`; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, SR * 3.1, 0, Math.PI * 2); g.stroke(); } }
    shapePath(s.shape, p.x, p.y, r); g.fillStyle = '#fff'; g.fill(); g.lineWidth = Math.max(3, SR * 0.32); g.strokeStyle = '#2b2b33'; g.stroke();
    // waiting riders
    g.fillStyle = '#2b2b33';
    s.q.forEach((sh, i) => { const cx = p.x + SR * 1.7 + (i % 6) * SR * 0.85, cy = p.y - SR * 0.6 + Math.floor(i / 6) * SR * 0.9; shapePath(sh, cx, cy, SR * 0.32); g.fill(); });
  }
  // rings
  for (const r of rings) { r.t += dt / 40; const p = toS(r.x, r.y); g.strokeStyle = r.c; g.globalAlpha = Math.max(0, 1 - r.t); g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, (r.small ? 14 : 18) + r.t * (r.small ? 16 : 40), 0, Math.PI * 2); g.stroke(); }
  g.globalAlpha = 1; rings = rings.filter(r => r.t < 1);
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(2.5, (now - last) / 16.67); last = now;
  if (state === 'play' && phase === 'play') { for (let i = 0; i < speed; i++) step(dt / 60); hud(); }
  if (armed >= 0 && performance.now() - armT > 2000) { armed = -1; drawBar(); tipl.style.opacity = 0; }
  render(dt); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui.onTap(w => { if (w === 'start' || w === 'lose') newGame(); else if (w === 'win') showRewards(); });
ui.start();

// ---------------------------------------------------------------- bot
window.__game = {
  get state() { return state; }, get level() { return week; }, get score() { return delivered; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'reward') { const o = rew.dataset.opts.split(','); return takeReward(o.includes('line') ? 'line' : o[0]); }
    if (phase !== 'play') return;
    if (speed < 2) { speed = 2; drawBar(); return; }
    const used = new Set(lines.flatMap(l => l.stops));
    const lone = stations.filter(s => !used.has(s)); if (!lone.length) return;
    const s = lone[0];
    if (lines.length < maxLines) {
      const others = stations.filter(o => o !== s && o.shape !== s.shape && canLink(s, o)).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
      if (others.length) { newLine(others[0], s); tone(700, 0.06, 'triangle', 0.08, 1.2); return; }
    }
    let best = null, bd = 1e9;
    for (const L of lines) { if (isLoop(L)) continue; for (const end of [0, 1]) { const e = L.stops[end ? L.stops.length - 1 : 0], d = Math.hypot(e.x - s.x, e.y - s.y); if (d < bd && canLink(e, s)) { bd = d; best = [L, end]; } } }
    if (best) { extend(best[0], best[1], s); tone(700, 0.06, 'triangle', 0.08, 1.2); drawBar(); }
  },
};

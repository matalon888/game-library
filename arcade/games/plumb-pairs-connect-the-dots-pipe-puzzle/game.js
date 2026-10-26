// Plumb Pairs — connect every pair of matching dots with a pipe. Pipes may not cross, and the board is only solved
// when every cell is filled. Boards are cut from a random space-filling path, so each one has a full-cover solution.
import { createUI, store, buzz, note, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Plumb Pairs: Connect the Dots Pipe Puzzle';
const S = store('plumbpairs');
const F = flow('plumbpairs');
const ui = createUI({ title: 'Plumb Pairs', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#3d8bff', serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('plumbpairs', ui, { name: NAME });
const B = board({ game: 'plumb-pairs', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.3 }, mode: 'sum' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily puzzle' : 'connect the dots', doneLine: doneToday ? (D.isDaily ? `Solved today in ${doneToday.m} moves` : 'Daily puzzle solved ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'All plumbed!';

const COLS = ['#ff4d5e', '#3d8bff', '#3ccf6e', '#ffd23f', '#ff8c2a', '#2fd8e8', '#e04dff', '#ffa3d1', '#8a5cff', '#b6e34a', '#c98552', '#f2f2f2', '#a8324f', '#178f7c'];

css(`
body{background:radial-gradient(120% 80% at 50% 0%,#26305a 0%,#141a2e 60%,#0e1222 100%)}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:800;color:#fff;background:#3d8bff}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.14);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.14);height:8px}.hc-top .hc-bar i{background:linear-gradient(90deg,#3d8bff,#2fd8e8)}
#bd{position:fixed;left:0;top:0;z-index:2;touch-action:none}
#hud{position:fixed;left:0;right:0;z-index:5;display:flex;justify-content:center;gap:10px;pointer-events:none;font-family:'Baloo 2',system-ui,sans-serif}
#hud div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 14px;text-align:center;min-width:86px}
#hud b{display:block;font-size:22px;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}
#hud span{display:block;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.6);font-weight:700}
#btns{position:fixed;left:0;right:0;bottom:calc(26px + env(safe-area-inset-bottom));z-index:5;display:flex;justify-content:center;gap:14px}
#btns button{font:inherit;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:17px;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:26px;padding:10px 22px;cursor:pointer;display:flex;align-items:center;gap:8px}
#btns button:active{transform:translateY(2px);background:rgba(255,255,255,.18)}
#btns button em{font-style:normal;background:#ffd23f;color:#1b1f33;border-radius:10px;padding:0 7px;font-size:13px}
#title{position:fixed;left:0;right:0;z-index:5;text-align:center;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:15px;letter-spacing:3px;color:rgba(255,255,255,.55);text-transform:uppercase;pointer-events:none}
`);
const cv = document.createElement('canvas'); cv.id = 'bd'; document.body.appendChild(cv);
const g = cv.getContext('2d');
const hud = document.createElement('div'); hud.id = 'hud'; hud.innerHTML = '<div><b data-p>0/0</b><span>pipes</span></div><div><b data-f>0%</b><span>filled</span></div><div><b data-m>0</b><span>moves</span></div>'; document.body.appendChild(hud);
const title = document.createElement('div'); title.id = 'title'; document.body.appendChild(title);
const btns = document.createElement('div'); btns.id = 'btns'; btns.innerHTML = '<button data-r>↺ Restart</button><button data-h>💡 Hint <em>3</em></button>'; document.body.appendChild(btns);
btns.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- generator: random Hamiltonian path (backbite moves) cut into pipes
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hamPath(n, r) {
  let p = [];
  for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) p.push(y * n + (y % 2 ? n - 1 - i : i));
  const pos = new Int32Array(n * n);
  const nb = (c) => { const x = c % n, y = (c / n) | 0, o = []; if (x > 0) o.push(c - 1); if (x < n - 1) o.push(c + 1); if (y > 0) o.push(c - n); if (y < n - 1) o.push(c + n); return o; };
  for (let it = 0; it < n * n * 30; it++) {
    if (r() < 0.5) p.reverse();
    const L = p.length - 1, end = p[L], ns = nb(end);
    const q = ns[Math.floor(r() * ns.length)];
    p.forEach((c, i) => pos[c] = i);
    const i = pos[q]; if (i === L - 1) continue;
    const tail = p.slice(i + 1).reverse(); p = p.slice(0, i + 1).concat(tail);
  }
  return p;
}
const adjc = (a, b, n) => (Math.abs(a - b) === 1 && ((a / n) | 0) === ((b / n) | 0)) || Math.abs(a - b) === n;
function makeBoard(n, seed, avgLen) {
  let best = null;
  for (let tries = 0; tries < 40; tries++) {
    const r = rngf(seed * 31 + tries * 977 + 7), p = hamPath(n, r), segs = [];
    let i = 0;
    while (i < p.length) {
      const rem = p.length - i;
      let len = Math.max(3, Math.round(avgLen * (0.55 + r() * 0.9)));
      if (rem - len < 3) len = rem;
      segs.push(p.slice(i, i + len)); i += len;
    }
    if (segs.length > COLS.length) continue;
    // a pipe whose two dots touch, or a pipe that is a dead-straight line, makes a dull board: score them
    let bad = 0;
    for (const s of segs) { if (adjc(s[0], s[s.length - 1], n)) bad += 2; let straight = true; for (let k = 2; k < s.length; k++) if (s[k] - s[k - 1] !== s[1] - s[0]) straight = false; if (straight && s.length > 3) bad++; }
    if (!best || bad < best.bad) best = { segs, bad };
    if (bad === 0) break;
  }
  // shuffle colour order so the same colour isn't always the first pipe
  const r = rngf(seed + 5), order = COLS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return best.segs.map((s, k) => ({ col: COLS[order[k]], a: s[0], b: s[s.length - 1], sol: s }));
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), total = S.get('score', 0), n = 5, pairs = [], paths = [], owner = [], dotAt = [], moves = 0, lastMoved = -1;
let active = -1, hints = 3, usedHint = false, recorded = false, beatenShown = false, nagged = false, ptr = null, pulse = [], winT = 0, botC = -1;
const G = { x: 0, y: 0, s: 400, c: 80 };

function layout() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  G.s = Math.min(W - 24, 500, H - 300); G.c = G.s / n; G.x = (W - G.s) / 2; G.y = Math.max(120, (H - G.s) / 2 - 10);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  hud.style.top = (G.y + G.s + 22) + 'px'; title.style.top = (G.y - 34) + 'px';
}
addEventListener('resize', () => { layout(); });

function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 7 : level;
  n = D.isDaily ? 7 : Math.max(5, Math.min(10, Math.round(5 + (L - 1) * 0.3 * fk)));
  const avg = Math.max(3.2, Math.min(n * 1.6, n * (0.85 + Math.min(0.35, (L - 1) * 0.03)) * fk));
  pairs = makeBoard(n, D.seed || level * 7919 + 13, avg);
  paths = pairs.map(() => []); dotAt = new Array(n * n).fill(-1);
  pairs.forEach((p, i) => { dotAt[p.a] = i; dotAt[p.b] = i; });
  moves = 0; lastMoved = -1; active = -1; hints = 3; usedHint = false; recorded = false; beatenShown = false; nagged = false; winT = 0; botC = -1; pulse = [];
  recompute(); layout();
  title.textContent = D.isDaily ? 'Daily puzzle · ' + n + '×' + n : n + '×' + n + ' · ' + pairs.length + ' pipes';
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  refresh();
}
const complete = (i) => { const p = paths[i]; return p.length > 1 && dotAt[p[p.length - 1]] === i && p[p.length - 1] !== p[0]; };
function recompute() { owner = new Array(n * n).fill(-1); paths.forEach((p, i) => p.forEach(c => owner[c] = i)); }
function filledFrac() { let f = 0; for (let c = 0; c < n * n; c++) if (owner[c] >= 0 || dotAt[c] >= 0) f++; return f / (n * n); }
function refresh() {
  const done = pairs.filter((_, i) => complete(i)).length, ff = filledFrac();
  hud.querySelector('[data-p]').textContent = done + '/' + pairs.length;
  hud.querySelector('[data-f]').textContent = Math.floor(ff * 100) + '%';
  hud.querySelector('[data-m]').textContent = moves;
  btns.querySelector('em').textContent = hints; btns.querySelector('[data-h]').style.opacity = hints ? 1 : 0.45;
  ui.progress(ff);
}

// ---------------------------------------------------------------- drawing pipes
function startAt(c) {
  if (state !== 'play' || c < 0) return false;
  if (dotAt[c] >= 0) { active = dotAt[c]; paths[active] = [c]; }
  else if (owner[c] >= 0) { active = owner[c]; const p = paths[active]; paths[active] = p.slice(0, p.indexOf(c) + 1); }
  else return false;
  if (active !== lastMoved) { moves++; lastMoved = active; }
  recompute(); refresh(); soft.click(); buzz(5);
  return true;
}
function stepTo(c) {
  if (active < 0 || c < 0) return;
  const p = paths[active], last = p[p.length - 1];
  if (c === last) return;
  if (!adjc(c, last, n)) {   // fast drag: walk there one cell at a time
    const lx = last % n, ly = (last / n) | 0, cx = c % n, cy = (c / n) | 0;
    const nx = Math.abs(cx - lx) >= Math.abs(cy - ly) ? lx + Math.sign(cx - lx) : lx, ny = nx === lx ? ly + Math.sign(cy - ly) : ly;
    const mid = ny * n + nx; stepTo(mid); if (paths[active][paths[active].length - 1] === mid) stepTo(c); return;
  }
  const idx = p.indexOf(c);
  if (idx >= 0) { paths[active] = p.slice(0, idx + 1); recompute(); refresh(); tone(500 + idx * 20, 0.03, 'sine', 0.04, 0.8); return; }
  if (complete(active)) return;
  if (dotAt[c] >= 0 && dotAt[c] !== active) return;
  const o = owner[c];
  if (o >= 0 && o !== active) { const q = paths[o]; paths[o] = q.slice(0, q.indexOf(c)); if (paths[o].length === 1) paths[o] = []; soft.swish(); }
  p.push(c); recompute(); refresh();
  tone(420 + p.length * 26, 0.04, 'triangle', 0.05, 1.1);
  if (dotAt[c] === active) connected(active);
}
function connected(i) {
  const k = pairs.filter((_, j) => complete(j)).length;
  chime(k + 2, 69, 0.13); buzz(14);
  const p = pairs[i]; for (const c of [p.a, p.b]) { const [x, y] = cellXY(c); fx.sparks(x, y, [p.col, '#fff'], 12, { speed: 3, size: 3 }); fx.ring(x, y, p.col, G.c * 0.55); }
  pulse.push({ i, t: 1 });
}
function endDrag() {
  if (active < 0) return; active = -1;
  if (state !== 'play') return;
  const all = pairs.every((_, i) => complete(i));
  if (all && filledFrac() === 1) return win();
  if (all && !nagged) { nagged = true; ui.pop('Fill every cell!', '#ffd23f', 26, 74); soft.err(); }
}
const cellXY = (c) => [G.x + (c % n + 0.5) * G.c, G.y + (((c / n) | 0) + 0.5) * G.c];
function cellAt(px, py) { const x = Math.floor((px - G.x) / G.c), y = Math.floor((py - G.y) / G.c); return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x; }

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the shortest pipe draws itself from one dot to its twin (the solver's path); the move is not counted
let demoI = -1;
demo(() => {
  if (demoI < 0) {
    if (pairs.length < 2 || paths.some(p => p.length)) return false;
    demoI = pairs.reduce((b, p, i) => p.sol.length < pairs[b].sol.length ? i : b, 0); startAt(pairs[demoI].a); return;
  }
  if (active !== demoI) return false;
  stepTo(pairs[demoI].sol[paths[demoI].length]);
  if (complete(demoI)) { endDrag(); moves = Math.max(0, moves - 1); lastMoved = -1; refresh(); return false; }
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && (demoI >= 0 || active < 0), wait: 1800, every: 280, max: 14 });

cv.addEventListener('pointerdown', e => { if (state !== 'play') return; ptr = [e.clientX, e.clientY]; startAt(cellAt(e.clientX, e.clientY)); });
addEventListener('pointermove', e => { if (active < 0 || !ptr) return; ptr = [e.clientX, e.clientY]; stepTo(cellAt(e.clientX, e.clientY)); });
const up = () => { ptr = null; endDrag(); };
addEventListener('pointerup', up); addEventListener('pointercancel', up);

btns.querySelector('[data-r]').onclick = () => {
  if (state !== 'play') return;
  if (!recorded && paths.some(p => p.length)) { recorded = true; if (!D.isDaily) F.level(false, filledFrac()); }
  paths = pairs.map(() => []); recompute(); moves = 0; lastMoved = -1; nagged = false; botC = -1; recorded = false; refresh(); soft.swish();
};
btns.querySelector('[data-h]').onclick = () => {
  if (state !== 'play' || !hints) return;
  const i = pairs.findIndex((p, j) => paths[j].join() !== p.sol.join()); if (i < 0) return;
  hints--; usedHint = true;
  for (const c of pairs[i].sol) { const o = owner[c]; if (o >= 0 && o !== i) { const q = paths[o]; paths[o] = q.slice(0, q.indexOf(c)); if (paths[o].length === 1) paths[o] = []; recompute(); } }
  paths[i] = pairs[i].sol.slice(); recompute(); refresh(); connected(i); active = i; endDrag();
};

// ---------------------------------------------------------------- win
function win() {
  if (state !== 'play') return;
  state = 'won'; winT = 1;
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  const perfect = moves === pairs.length && !usedHint, pts = 100 * pairs.length + n * n * 10 + (perfect ? 500 : 0);
  total += pts; S.set('score', total);
  arp([72, 76, 79, 84, 88, 91], 90, 0.12, 0.8); fx.confetti(140, pairs.map(p => p.col).concat('#fff')); buzz([20, 50, 20]);
  if (!beatenShown && D.beaten(total)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); }
  else if (perfect) ui.pop('PERFECT!', '#ffd23f', 40, 30);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || moves < prev.m) S.set(k, { m: moves }); }
  else { level++; S.set('level', level); }
  D.won(total); B.submit(1);   // world board: puzzles solved today
  ui.win(D.isDaily ? '' : level - 1, `${moves} moves${perfect ? ' · perfect' : ''} · +${pts} pts`);
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});

// ---------------------------------------------------------------- render
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function frame(t) {
  const W = innerWidth, H = innerHeight; g.clearRect(0, 0, W, H);
  const c = G.c, pad = Math.max(1.5, c * 0.04);
  // board plate
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 10; g.fillStyle = '#1b2240'; rr(G.x - 8, G.y - 8, G.s + 16, G.s + 16, 18); g.fill(); g.restore();
  for (let i = 0; i < n * n; i++) {
    const x = G.x + (i % n) * c, y = G.y + ((i / n) | 0) * c, o = owner[i];
    g.fillStyle = o >= 0 ? pairs[o].col + (complete(o) ? '40' : '26') : 'rgba(255,255,255,.045)';
    rr(x + pad, y + pad, c - pad * 2, c - pad * 2, c * 0.16); g.fill();
  }
  // win wave
  if (winT > 0) { winT = Math.max(0, winT - 0.012); }
  // pipes
  g.lineCap = 'round'; g.lineJoin = 'round';
  paths.forEach((p, i) => {
    if (p.length < 2) return;
    const pl = pulse.find(q => q.i === i), w = c * (0.34 + (pl ? Math.sin(pl.t * Math.PI) * 0.12 : 0));
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = w; g.beginPath(); p.forEach((cc, k) => { const [x, y] = cellXY(cc); k ? g.lineTo(x, y + 3) : g.moveTo(x, y + 3); }); g.stroke();
    g.strokeStyle = pairs[i].col; g.lineWidth = w; g.beginPath(); p.forEach((cc, k) => { const [x, y] = cellXY(cc); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = w * 0.28; g.beginPath(); p.forEach((cc, k) => { const [x, y] = cellXY(cc); k ? g.lineTo(x - w * 0.12, y - w * 0.12) : g.moveTo(x - w * 0.12, y - w * 0.12); }); g.stroke();
  });
  pulse.forEach(q => q.t -= 0.04); pulse = pulse.filter(q => q.t > 0);
  // dots
  pairs.forEach((p, i) => {
    const done = complete(i);
    for (const cc of [p.a, p.b]) {
      const [x, y] = cellXY(cc), wave = winT > 0 ? Math.max(0, Math.sin((1 - winT) * 10 - (x + y) / 140)) * 0.18 : 0;
      const r = c * (0.36 + (done ? 0.02 + Math.sin(t * 3 + i) * 0.015 : 0) + wave);
      if (done) { g.fillStyle = p.col + '55'; g.beginPath(); g.arc(x, y, r * 1.35, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x, y + 3, r, 0, 7); g.fill();
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, p.col); gr.addColorStop(1, p.col);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
  // finger halo while drawing
  if (active >= 0 && ptr) { g.fillStyle = pairs[active].col + '44'; g.beginPath(); g.arc(ptr[0], ptr[1], c * 0.9, 0, 7); g.fill(); }
  requestAnimationFrame(() => frame(performance.now() / 1000));
}
build(); requestAnimationFrame(() => frame(0));

// ---------------------------------------------------------------- test hook: the bot draws the generator's solution, one cell per call
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play') return;
    for (let k = 0; k < 2; k++) {
      if (botC < 0) {
        botC = pairs.findIndex((p, j) => paths[j].join() !== p.sol.join()); if (botC < 0) return;
        startAt(pairs[botC].a); ptr = cellXY(pairs[botC].a); continue;
      }
      const sol = pairs[botC].sol, p = paths[botC];
      if (active !== botC) { botC = -1; continue; }
      const nx = sol[p.length]; ptr = cellXY(nx); stepTo(nx);
      if (complete(botC)) { botC = -1; ptr = null; endDrag(); return; }
    }
  },
};

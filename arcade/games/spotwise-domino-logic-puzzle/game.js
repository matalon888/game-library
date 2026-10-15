// Spotwise — original domino logic puzzle. Place every domino on the board so each coloured region meets its rule:
// an exact sum, less than / more than a target, all equal, or all different. Boards are generated from a seed:
// a random shape is tiled with dominoes, values are dealt, regions are carved and their rules read off that layout,
// then a solver counts solutions and the generator keeps the tightest board it finds (unique where it can).
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';

const NAME = 'Spotwise: Domino Logic Puzzle';
const S = store('spotwise');
const F = flow('spotwise');
const ui = createUI({ title: 'Spotwise', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#2f8f83' });
const D = daily('spotwise', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily domino puzzle' : 'Domino logic puzzle', doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s} pts` : 'Daily puzzle solved ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily puzzle<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'All set!';

const INK = '#3b3226';
const REG = [ // tint, strong
  ['#f6c1cc', '#d9577a'], ['#bfe3d8', '#2f8f83'], ['#d6cbf4', '#7a5fd0'], ['#f9d9a6', '#d98a1f'], ['#bfd9f6', '#3b7fcc'], ['#f1cdb5', '#b8673e'], ['#d7ecb4', '#5e9a35'],
];

css(`
body{background:#f5ede1;color:${INK}}
#bg{position:fixed;inset:0;width:100%;height:100%;z-index:0}
#table{position:fixed;inset:0;z-index:2}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#2f8f83;box-shadow:none}
.hc-top .hc-lvl.next{background:rgba(59,50,38,.1);color:${INK}}
.hc-top .hc-bar{background:rgba(59,50,38,.1);height:8px}.hc-top .hc-bar i{background:#2f8f83}
.hc-pop{color:${INK}}
#hud{position:fixed;left:0;right:0;top:calc(52px + env(safe-area-inset-top));z-index:5;display:flex;justify-content:center;gap:18px;pointer-events:none;color:${INK};font-weight:700;font-size:15px;letter-spacing:.3px;font-variant-numeric:tabular-nums}
#hud span{opacity:.62;font-weight:600}
.dm{position:absolute;left:0;top:0;width:calc(var(--cs) * 2);height:var(--cs);transform-origin:calc(var(--cs) / 2) calc(var(--cs) / 2);transition:transform .28s cubic-bezier(.3,1.2,.4,1);cursor:grab;touch-action:none;z-index:20}
.dm .in{position:absolute;inset:calc(var(--cs) * .05);border-radius:calc(var(--cs) * .17);background:linear-gradient(170deg,#fffdf8,#f1e9dc);box-shadow:0 1px 0 #fff inset,0 -2px 0 rgba(0,0,0,.06) inset,0 3px 7px rgba(60,40,20,.22);display:flex;border:1px solid rgba(60,40,20,.12)}
.dm .in:after{content:'';position:absolute;left:50%;top:16%;bottom:16%;width:2px;margin-left:-1px;background:rgba(60,40,20,.16);border-radius:2px}
.dm .h{position:relative;flex:1}
.dm .p{position:absolute;width:calc(var(--cs) * .16);height:calc(var(--cs) * .16);margin:calc(var(--cs) * -.08) 0 0 calc(var(--cs) * -.08);border-radius:50%;background:radial-gradient(circle at 35% 30%,#5a4d3d,#231c14)}
.dm.drag{transition:none;z-index:60;cursor:grabbing}.dm.drag .in{box-shadow:0 1px 0 #fff inset,0 14px 22px rgba(60,40,20,.28)}
.dm.sel .in{box-shadow:0 0 0 3px #2f8f83,0 6px 14px rgba(47,143,131,.35)}
.dm.hop .in{animation:hop .5s cubic-bezier(.3,1.4,.5,1)}
@keyframes hop{40%{transform:translateY(-12px) scale(1.06)}}
.dm.nope .in{animation:nope .3s}
@keyframes nope{25%{transform:translateX(-4px)}50%{transform:translateX(4px)}75%{transform:translateX(-2px)}}
.bd{position:absolute;z-index:30;width:30px;height:30px;margin:-15px 0 0 -15px;pointer-events:none;display:flex;align-items:center;justify-content:center;transition:transform .25s}
.bd:before{content:'';position:absolute;inset:3px;border-radius:6px;transform:rotate(45deg);background:var(--c);box-shadow:0 2px 5px rgba(0,0,0,.2);transition:background .25s}
.bd b{position:relative;color:#fff;font-weight:800;font-size:14px;letter-spacing:-.5px;font-family:-apple-system,'SF Pro Display',system-ui,sans-serif}
.bd.ok:before{background:#3aa66a}.bd.bad:before{background:#c94141}.bd.ok{transform:scale(1.15)}
.bd.bad{animation:nope .3s}
#tray{position:fixed;left:12px;right:12px;z-index:1;border-radius:22px;background:rgba(255,255,255,.42);box-shadow:0 1px 0 rgba(255,255,255,.7) inset}
#cap{position:fixed;left:0;right:0;z-index:3;text-align:center;font-size:12.5px;font-weight:600;letter-spacing:.3px;color:rgba(59,50,38,.5);pointer-events:none}
#tools{position:fixed;left:0;right:0;z-index:5;display:flex;justify-content:center;gap:12px}
#tools button{font:inherit;font-weight:700;font-size:15px;color:${INK};background:rgba(255,255,255,.7);border:1px solid rgba(59,50,38,.12);border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 2px 6px rgba(60,40,20,.08)}
`);
const bgc = document.createElement('canvas'); bgc.id = 'bg'; document.body.prepend(bgc);
const trayEl = document.createElement('div'); trayEl.id = 'tray'; document.body.appendChild(trayEl);
const table = document.createElement('div'); table.id = 'table'; document.body.appendChild(table);
const hud = document.createElement('div'); hud.id = 'hud'; document.body.appendChild(hud);
const cap = document.createElement('div'); cap.id = 'cap'; cap.textContent = 'Drag dominoes onto the board · tap one to turn it'; document.body.appendChild(cap);
const tools = document.createElement('div'); tools.id = 'tools'; tools.innerHTML = '<button data-r>↺ Reset</button>'; document.body.appendChild(tools);
tools.querySelector('[data-r]').addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play') resetAll(); });

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // o: direction from half a to half b (right, down, left, up)

// ---------------------------------------------------------------- generator
function makeShape(r, n, R, C) {
  const on = new Set(), key = (y, x) => y * 16 + x, pairs = [];
  const y0 = Math.floor(R / 2) - (r() < 0.5 ? 1 : 0), x0 = Math.floor(C / 2) - 1;
  on.add(key(y0, x0)); on.add(key(y0, x0 + 1)); pairs.push([[y0, x0], [y0, x0 + 1]]);
  for (let tries = 0; pairs.length < n && tries < 400; tries++) {
    const cand = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) for (const [dy, dx] of [[0, 1], [1, 0]]) {
      const y2 = y + dy, x2 = x + dx; if (y2 >= R || x2 >= C || on.has(key(y, x)) || on.has(key(y2, x2))) continue;
      let touch = 0;
      for (const [a, b] of [[y, x], [y2, x2]]) for (const [ey, ex] of DIRS) if (on.has(key(a + ey, b + ex))) touch++;
      if (touch) cand.push([[y, x], [y2, x2], touch]);
    }
    if (!cand.length) break;
    // prefer compact growth (more contact) but keep some ragged edges
    cand.sort((a, b) => b[2] - a[2]); const pick = cand[Math.floor(Math.pow(r(), 1.6) * cand.length)];
    on.add(key(...pick[0])); on.add(key(...pick[1])); pairs.push([pick[0], pick[1]]);
  }
  return pairs;
}
function generate(seed, L, fk) {
  const r = rngf(seed * 2654435761 + 17);
  const n = Math.max(3, Math.min(14, Math.round((3 + L * 0.85) * fk)));
  const C = n <= 4 ? 4 : n <= 7 ? 5 : n <= 10 ? 6 : 7, R = n <= 4 ? 4 : n <= 6 ? 5 : n <= 9 ? 6 : 7;
  const pAny = Math.max(0.05, Math.min(0.5, (0.42 - L * 0.04) / fk)), pIneq = Math.max(0.08, Math.min(0.45, (0.08 + L * 0.035) * fk));
  let best = null;
  for (let att = 0; att < 14; att++) {
    const pairs = makeShape(r, n, R, C);
    // cells, indexed row-major
    const list = []; pairs.forEach(p => p.forEach(c => list.push(c)));
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const idx = new Map(list.map((c, i) => [c[0] * 16 + c[1], i]));
    const cells = list.map(([y, x]) => ({ r: y, c: x, region: -1, nb: [] }));
    cells.forEach(c => DIRS.forEach(([dy, dx], o) => { const j = idx.get((c.r + dy) * 16 + c.c + dx); c.nb[o] = j === undefined ? -1 : j; }));
    // deal distinct dominoes
    const deck = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) deck.push([a, b]);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const doms = deck.slice(0, pairs.length).map(([a, b]) => r() < 0.5 ? [a, b] : [b, a]);
    const val = new Array(cells.length), sol = [];
    pairs.forEach((p, k) => {
      const ia = idx.get(p[0][0] * 16 + p[0][1]), ib = idx.get(p[1][0] * 16 + p[1][1]);
      val[ia] = doms[k][0]; val[ib] = doms[k][1]; sol.push({ a: ia, o: p[1][0] > p[0][0] ? 1 : 0 });
    });
    for (let carve = 0; carve < 3; carve++) {
      cells.forEach(c => c.region = -1);
      const regions = [], order = cells.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (const s of order) {
        if (cells[s].region >= 0) continue;
        const size = [1, 2, 2, 2, 3, 3, 3, 4, 4, 5][Math.floor(r() * 10)], reg = [s]; cells[s].region = regions.length;
        while (reg.length < size) {
          const fr = []; reg.forEach(i => cells[i].nb.forEach(j => { if (j >= 0 && cells[j].region < 0 && !fr.includes(j)) fr.push(j); }));
          if (!fr.length) break; const j = fr[Math.floor(r() * fr.length)]; cells[j].region = regions.length; reg.push(j);
        }
        regions.push({ cells: reg });
      }
      // read each region's rule off the dealt layout
      for (const g of regions) {
        const vs = g.cells.map(i => val[i]), sum = vs.reduce((a, b) => a + b, 0), allEq = vs.every(v => v === vs[0]), allNe = new Set(vs).size === vs.length;
        const roll = r();
        if (g.cells.length >= 2 && allEq) g.rule = { t: 'eq' };
        else if (roll < pAny) g.rule = { t: 'any' };
        else if (g.cells.length >= 3 && allNe && roll < pAny + 0.18) g.rule = { t: 'ne' };
        else if (roll < pAny + pIneq) {
          if ((r() < 0.5 && sum > 0) || sum >= 6 * g.cells.length) g.rule = { t: 'gt', n: Math.max(0, sum - 1 - Math.floor(r() * 2)) };
          else g.rule = { t: 'lt', n: sum + 1 + Math.floor(r() * 2) };
        } else g.rule = { t: 'sum', n: sum };
      }
      const P = { cells: cells.map(c => ({ ...c })), regions, doms, sol, val, n: pairs.length, R, C };
      const count = countSolutions(P, 2, 60000);
      const sc = count === 1 ? 0 : count === 2 ? 1 : 2;
      if (!best || sc < best.sc) best = { P, sc };
      if (sc === 0) return P;
    }
  }
  // tighten: open rules become exact sums until (near) unique
  const P = best.P;
  for (const g of P.regions) if (g.rule.t === 'any' && countSolutions(P, 2, 60000) > 1) g.rule = { t: 'sum', n: g.cells.reduce((a, i) => a + P.val[i], 0) };
  return P;
}

// ---------------------------------------------------------------- rule checks + solver
function regionState(g, vals) {   // vals: cell values (-1 = empty) → 'open' | 'ok' | 'bad' | 'live' (partial, still possible)
  let sum = 0, filled = 0; const seen = [];
  for (const i of g.cells) { const v = vals[i]; if (v < 0) continue; filled++; sum += v; seen.push(v); }
  const rem = g.cells.length - filled, full = rem === 0, t = g.rule.t, n = g.rule.n;
  let possible = true, ok = true;
  if (t === 'sum') { possible = sum <= n && sum + 6 * rem >= n; ok = sum === n; }
  else if (t === 'lt') { possible = sum < n; ok = possible; }
  else if (t === 'gt') { possible = sum + 6 * rem > n; ok = sum > n; }
  else if (t === 'eq') { possible = seen.every(v => v === seen[0]); ok = possible; }
  else if (t === 'ne') { possible = new Set(seen).size === seen.length; ok = possible; }
  if (!possible) return 'bad';
  return full ? (ok ? 'ok' : 'bad') : filled ? 'live' : 'open';
}
function countSolutions(P, cap, limit) {
  const vals = new Array(P.cells.length).fill(-1), used = new Array(P.doms.length).fill(false);
  let count = 0, nodes = 0;
  const okAt = i => regionState(P.regions[P.cells[i].region], vals) !== 'bad';
  (function rec() {
    if (count >= cap || nodes > limit) return;
    const i = vals.indexOf(-1); if (i < 0) { count++; return; }
    nodes++;
    for (const o of [0, 1]) {
      const j = P.cells[i].nb[o]; if (j < 0 || vals[j] >= 0) continue;
      for (let d = 0; d < P.doms.length; d++) {
        if (used[d]) continue; const [a, b] = P.doms[d];
        for (const [x, y] of a === b ? [[a, b]] : [[a, b], [b, a]]) {
          vals[i] = x; vals[j] = y; used[d] = true;
          if (okAt(i) && okAt(j)) rec();
          vals[i] = -1; vals[j] = -1; used[d] = false;
          if (count >= cap || nodes > limit) return;
        }
      }
    }
  })();
  return nodes > limit ? cap + 1 : count;
}

// ---------------------------------------------------------------- state + layout
let state = 'ready', level = S.get('level', 1), score = 0, P = null, doms = [], badges = [], regionSt = [], recorded = false, t0 = 0, elapsed = 0, sel = null, busy = 0, beatenShown = false;
const G = { cs: 50, bx: 0, by: 0, minR: 0, minC: 0, ts: 0.7, trayTop: 0, trayH: 0 };
const cellXY = (i) => { const c = P.cells[i]; return [G.bx + (c.c - G.minC + 0.5) * G.cs, G.by + (c.r - G.minR + 0.5) * G.cs]; };

function layout() {
  const W = innerWidth, H = innerHeight;
  let minR = 99, maxR = 0, minC = 99, maxC = 0; P.cells.forEach(c => { minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r); minC = Math.min(minC, c.c); maxC = Math.max(maxC, c.c); });
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const top = 96, bottom = H * 0.6;
  G.cs = Math.floor(Math.min(64, (W - 44) / cols, (bottom - top) / rows));
  G.minR = minR; G.minC = minC; G.bx = (W - cols * G.cs) / 2; G.by = top + (bottom - top - rows * G.cs) / 2;
  table.style.setProperty('--cs', G.cs + 'px');
  // tray: rows of horizontal dominoes
  G.trayTop = bottom + 20; G.trayH = H - 74 - G.trayTop;
  const n = doms.length;
  let s = Math.min(0.9, 46 / G.cs), perRow, rowsT;
  for (; ; s *= 0.94) { const w = 2 * G.cs * s + 14; perRow = Math.max(1, Math.floor((W - 44) / w)); rowsT = Math.ceil(n / perRow); if (rowsT * (G.cs * s + 14) <= G.trayH - 36 || s < 0.4) break; }
  G.ts = s; G.perRow = perRow; G.rowsT = rowsT;
  trayEl.style.top = G.trayTop + 'px'; cap.style.top = (G.trayTop + 10) + 'px'; trayEl.style.height = G.trayH + 'px';
  tools.style.top = (H - 58) + 'px';
  paint();
  doms.forEach(position);
  placeBadges();
}
addEventListener('resize', () => P && layout());
function traySlot(k) {
  const W = innerWidth, w = 2 * G.cs * G.ts + 14, h = G.cs * G.ts + 14;
  const row = Math.floor(k / G.perRow), inRow = Math.min(G.perRow, doms.length - row * G.perRow), col = k % G.perRow;
  const y = G.trayTop + 28 + (G.trayH - 32 - G.rowsT * h) / 2 + h * (row + 0.5);
  const x = W / 2 + (col - (inRow - 1) / 2) * w;
  return [x, y];
}
function transform(d, px, py, s) { d.el.style.transform = `translate(${px - G.cs / 2}px,${py - G.cs / 2}px) rotate(${d.rot}deg) scale(${s})`; }
function position(d) {
  if (d.cell >= 0) { const [x, y] = cellXY(d.cell); transform(d, x, y, 1); }
  else { const [x, y] = traySlot(d.k); const [dx, dy] = DIRS[d.o]; transform(d, x - dx * G.cs * G.ts / 2, y - dy * G.cs * G.ts / 2, G.ts); }
}

function paint() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  bgc.width = W * dpr; bgc.height = H * dpr; const g = bgc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#f8f1e7'); sk.addColorStop(1, '#efe2d0'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
  // soft dotted paper texture
  g.fillStyle = 'rgba(120,90,60,.05)'; for (let y = 12; y < H; y += 22) for (let x = (y / 22) % 2 ? 12 : 23; x < W; x += 22) { g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); }
  const cs = G.cs, inset = cs * 0.045;
  const at = new Map(P.cells.map((c, i) => [c.r * 16 + c.c, i]));
  const reg = (r, c) => { const i = at.get(r * 16 + c); return i === undefined ? -2 : P.cells[i].region; };
  // board shadow + cells
  g.save(); g.shadowColor = 'rgba(80,55,30,.22)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
  P.cells.forEach((c, i) => { const [x, y] = cellXY(i); g.fillStyle = '#e6d8c3'; g.beginPath(); g.roundRect(x - cs / 2 + 1, y - cs / 2 + 1, cs - 2, cs - 2, cs * 0.14); g.fill(); });
  g.restore();
  P.cells.forEach((c, i) => { const [x, y] = cellXY(i); g.fillStyle = '#efe4d3'; g.beginPath(); g.roundRect(x - cs / 2 + inset, y - cs / 2 + inset, cs - 2 * inset, cs - 2 * inset, cs * 0.12); g.fill(); });
  // regions: tint + dashed outline
  P.cells.forEach((c, i) => {
    const R = P.regions[c.region]; if (R.rule.t === 'any') return;
    const [cx, cy] = cellXY(i), col = REG[R.col], st = regionSt[c.region];
    const x0 = cx - cs / 2, y0 = cy - cs / 2, x1 = x0 + cs, y1 = y0 + cs, k = c.region, I = cs * 0.07;
    const same = (dr, dc) => reg(c.r + dr, c.c + dc) === k;
    g.fillStyle = st === 'ok' ? '#bfe6c9' : col[0]; g.globalAlpha = st === 'ok' ? 0.95 : 0.85;
    g.fillRect(same(0, -1) ? x0 : x0 + I, same(-1, 0) ? y0 : y0 + I, (same(0, 1) ? x1 : x1 - I) - (same(0, -1) ? x0 : x0 + I), (same(1, 0) ? y1 : y1 - I) - (same(-1, 0) ? y0 : y0 + I));
    g.globalAlpha = 1; g.strokeStyle = st === 'ok' ? '#3aa66a' : st === 'bad' ? '#c94141' : col[1]; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineCap = 'round';
    const line = (a, b, c2, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); };
    const ext = (sideSame, diagSame, base, inner, outer) => !sideSame ? inner : diagSame ? outer : base;
    if (!same(-1, 0)) line(ext(same(0, -1), same(-1, -1), x0, x0 + I, x0 - I), y0 + I, ext(same(0, 1), same(-1, 1), x1, x1 - I, x1 + I), y0 + I);
    if (!same(1, 0)) line(ext(same(0, -1), same(1, -1), x0, x0 + I, x0 - I), y1 - I, ext(same(0, 1), same(1, 1), x1, x1 - I, x1 + I), y1 - I);
    if (!same(0, -1)) line(x0 + I, ext(same(-1, 0), same(-1, -1), y0, y0 + I, y0 - I), x0 + I, ext(same(1, 0), same(1, -1), y1, y1 - I, y1 + I));
    if (!same(0, 1)) line(x1 - I, ext(same(-1, 0), same(-1, 1), y0, y0 + I, y0 - I), x1 - I, ext(same(1, 0), same(1, 1), y1, y1 - I, y1 + I));
    g.setLineDash([]);
  });
}
function placeBadges() {
  badges.forEach(b => b && b.remove()); badges = [];
  P.regions.forEach((R, k) => {
    if (R.rule.t === 'any') { badges.push(null); return; }
    const last = R.cells.reduce((a, i) => { const c = P.cells[i], A = P.cells[a]; return c.r > A.r || (c.r === A.r && c.c > A.c) ? i : a; });
    const [x, y] = cellXY(last), b = document.createElement('div'); b.className = 'bd';
    b.style.left = (x + G.cs * 0.42) + 'px'; b.style.top = (y + G.cs * 0.42) + 'px'; b.style.setProperty('--c', REG[R.col][1]);
    const t = R.rule.t; b.innerHTML = `<b>${t === 'sum' ? R.rule.n : t === 'lt' ? '<' + R.rule.n : t === 'gt' ? '>' + R.rule.n : t === 'eq' ? '=' : '≠'}</b>`;
    if (regionSt[k] === 'ok') b.classList.add('ok'); else if (regionSt[k] === 'bad') b.classList.add('bad');
    table.appendChild(b); badges.push(b);
  });
}

// ---------------------------------------------------------------- dominoes
const SPOTS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const half = (v) => `<div class="h">${SPOTS[v].map(p => `<i class="p" style="left:${25 + (p % 3) * 25}%;top:${25 + Math.floor(p / 3) * 25}%"></i>`).join('')}</div>`;
function makeDom(a, b, k) {
  const el = document.createElement('div'); el.className = 'dm'; el.innerHTML = `<div class="in">${half(a)}${half(b)}</div>`;
  table.appendChild(el);
  const d = { a, b, k, el, cell: -1, o: 0, rot: 0 };
  el.addEventListener('pointerdown', e => grab(e, d));
  return d;
}
const occ = () => { const m = new Array(P.cells.length).fill(-1); doms.forEach((d, k) => { if (d.cell >= 0) { m[d.cell] = k; m[P.cells[d.cell].nb[d.o]] = k; } }); return m; };
const vals = () => { const v = new Array(P.cells.length).fill(-1); doms.forEach(d => { if (d.cell >= 0) { v[d.cell] = d.a; v[P.cells[d.cell].nb[d.o]] = d.b; } }); return v; };
function fits(d, cell, o) {
  if (cell < 0) return false; const j = P.cells[cell].nb[o]; if (j < 0) return false;
  const m = occ(); return (m[cell] < 0 || m[cell] === d.k) && (m[j] < 0 || m[j] === d.k);
}
function setO(d, o) { const step = ((o - d.o) % 4 + 4) % 4; d.rot += step * 90; d.o = o; }

let drag = null;
function grab(e, d) {
  e.preventDefault(); e.stopPropagation();
  if (state !== 'play' || busy) return;
  const [px, py] = d.cell >= 0 ? cellXY(d.cell) : [0, 0];
  drag = { d, sx: e.clientX, sy: e.clientY, moved: false, from: d.cell, off: d.cell >= 0 ? [px - e.clientX, py - e.clientY] : null, target: -1 };
}
addEventListener('pointermove', e => {
  if (!drag) return; const d = drag.d;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
  if (!drag.moved) { drag.moved = true; d.el.classList.add('drag'); soft.click(); if (sel) { sel.el.classList.remove('sel'); sel = null; } }
  const [dx, dy] = DIRS[d.o];
  const ax = drag.off ? e.clientX + drag.off[0] : e.clientX - dx * G.cs / 2, ay = drag.off ? e.clientY + drag.off[1] : e.clientY - dy * G.cs / 2 - G.cs * 0.15;
  transform(d, ax, ay, 1.04);
  drag.target = nearestCell(ax, ay); drag.ax = ax; drag.ay = ay;
});
function nearestCell(x, y) {
  let best = -1, bd = G.cs * 0.72;
  P.cells.forEach((c, i) => { const [cx, cy] = cellXY(i), dd = Math.hypot(cx - x, cy - y); if (dd < bd) { bd = dd; best = i; } });
  return best;
}
addEventListener('pointerup', () => {
  if (!drag) return; const { d, moved } = drag, tgt = drag.target; drag = null; d.el.classList.remove('drag');
  if (!moved) { if (d.cell >= 0) rotate(d); else select(d); return; }
  if (tgt >= 0 && tryPlace(d, tgt, true)) return;
  toTray(d);
});
addEventListener('pointerdown', e => {   // tap a free cell with a selected domino
  if (state !== 'play' || !sel || drag) return;
  const c = nearestCell(e.clientX, e.clientY); if (c < 0) return;
  const d = sel; sel.el.classList.remove('sel'); sel = null;
  if (!tryPlace(d, c, true)) { d.el.classList.remove('nope'); void d.el.offsetWidth; d.el.classList.add('nope'); soft.err(); }
});
function select(d) {
  if (sel === d) { d.el.classList.remove('sel'); sel = null; return; }
  if (sel) sel.el.classList.remove('sel'); sel = d; d.el.classList.add('sel'); soft.click(); buzz(5);
}
function tryPlace(d, cell, anyO) {
  const os = anyO ? [0, 1, 2, 3].map(k => (d.o + k) % 4) : [d.o];
  for (const o of os) if (fits(d, cell, o)) { setO(d, o); d.cell = cell; afterMove(d, true); return true; }
  return false;
}
function rotate(d) {
  for (let k = 1; k <= 3; k++) { const o = (d.o + k) % 4; if (fits(d, d.cell, o)) { setO(d, o); afterMove(d, false); soft.swish(); return; } }
  d.el.classList.remove('nope'); void d.el.offsetWidth; d.el.classList.add('nope'); soft.err();
}
function toTray(d) {
  const was = d.cell; d.cell = -1; setO(d, 0); d.rot = Math.round(d.rot / 360) * 360; position(d); soft.swish();
  if (was >= 0) evaluate();
}
function afterMove(d, placed) {
  position(d); d.el.style.zIndex = 20;
  if (placed) { soft.wood(); buzz(8); const [x, y] = cellXY(d.cell); fx.sparks(x + DIRS[d.o][1] * G.cs / 2, y + DIRS[d.o][0] * G.cs / 2, ['#fff', '#f2d9a8'], 6, { speed: 2, size: 2.5 }); }
  evaluate();
}
function resetAll() { doms.forEach(d => { d.cell = -1; setO(d, 0); d.rot = Math.round(d.rot / 360) * 360; position(d); }); if (sel) { sel.el.classList.remove('sel'); sel = null; } soft.swish(); evaluate(); }

function evaluate() {
  const v = vals(); let okN = 0, ruled = 0;
  P.regions.forEach((R, k) => {
    if (R.rule.t === 'any') return; ruled++;
    const st = regionState(R, v), prev = regionSt[k]; regionSt[k] = st; if (st === 'ok') okN++;
    const b = badges[k]; if (!b) return;
    b.classList.toggle('ok', st === 'ok'); b.classList.toggle('bad', st === 'bad');
    if (st === 'ok' && prev !== 'ok') { const r = b.getBoundingClientRect(); chime(okN + 1, 72, 0.1); fx.sparks(r.left + 15, r.top + 15, ['#3aa66a', '#fff', '#bfe6c9'], 12, { speed: 3, size: 3 }); }
    if (st === 'bad' && prev !== 'bad') { soft.err(); buzz(15); }
  });
  paint();
  const placed = doms.filter(d => d.cell >= 0).length;
  ui.progress(0.5 * placed / doms.length + 0.5 * (ruled ? okN / ruled : placed / doms.length));
  if (placed === doms.length) {
    if (okN === ruled) { busy = 1; setTimeout(win, 380); }
    else ui.pop('Not quite…', INK, 22, 11.5);
  }
}

// ---------------------------------------------------------------- level flow
function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 9 : level, seed = D.seed || level * 7919 + 101;
  P = generate(seed, L, fk);
  // colour regions so neighbours differ
  P.regions.forEach((R, k) => {
    const near = new Set(); R.cells.forEach(i => P.cells[i].nb.forEach(j => { if (j >= 0 && P.cells[j].region !== k && P.regions[P.cells[j].region].col !== undefined) near.add(P.regions[P.cells[j].region].col); }));
    let c = (k * 3) % REG.length; while (near.has(c)) c = (c + 1) % REG.length; R.col = c;
  });
  table.querySelectorAll('.dm,.bd').forEach(e => e.remove()); badges = [];
  regionSt = P.regions.map(() => 'open'); sel = null; drag = null; busy = 0; recorded = false; beatenShown = false; score = 0;
  // tray order: shuffled so it doesn't give the answer away
  const r = rngf(seed + 99), ord = P.doms.map((_, i) => i); for (let i = ord.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  doms = ord.map((i, k) => { const d = makeDom(P.doms[i][0], P.doms[i][1], k); d.src = i; return d; });
  layout();
  doms.forEach((d, k) => { d.el.style.transition = 'none'; const [x, y] = traySlot(k); transform(d, x - G.cs * G.ts / 2, y + 160, G.ts); d.el.style.opacity = 0; });
  void table.offsetWidth;
  doms.forEach((d, k) => setTimeout(() => { d.el.style.transition = ''; d.el.style.opacity = 1; position(d); if (k % 2 === 0) soft.click(); }, 60 + k * 45));
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  ui.progress(0); t0 = performance.now(); elapsed = 0; hudTick();
}
function hudTick() {
  if (state === 'play') elapsed = (performance.now() - t0) / 1000;
  hud.innerHTML = `<div><span>${D.isDaily ? 'Daily' : 'Level ' + level}</span> · ${doms.length} dominoes</div><div>${fmtTime(elapsed)}</div>`;
}
setInterval(hudTick, 500);
function win() {
  if (state !== 'play') return;
  state = 'won'; hudTick();
  const n = doms.length, par = n * 12;
  score = n * 100 + Math.max(0, Math.round((par - elapsed) * 10));
  if (!recorded) { recorded = true; if (!D.isDaily) { if (elapsed <= par) F.level(true); else F.level(false, Math.max(0.2, Math.min(1, par / elapsed))); } }
  doms.forEach((d, k) => setTimeout(() => { d.el.classList.remove('hop'); void d.el.offsetWidth; d.el.classList.add('hop'); chime(k, 74, 0.07); }, k * 70));
  arp([67, 71, 74, 79, 83], 110, 0.12, 0.9); setTimeout(() => fx.confetti(130, ['#d9577a', '#2f8f83', '#7a5fd0', '#d98a1f', '#3b7fcc', '#fff']), 200); buzz([20, 60, 20]);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', INK, 40, 30), 300); }
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  D.won(score);
  ui.win(D.isDaily ? '' : level - 1, `${fmtTime(elapsed)} · ${score.toLocaleString()} pts`);
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; t0 = performance.now(); return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot plays the generator's own answer, one domino per call
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || busy || drag) return;
    const want = (d) => P.sol[d.src];
    const right = (d) => { const w = want(d); return d.cell === w.a && d.o === w.o; };
    const wrong = doms.find(d => d.cell >= 0 && !right(d)); if (wrong) return toTray(wrong);
    const next = doms.find(d => d.cell < 0); if (!next) return;
    const w = want(next); if (!fits(next, w.a, w.o)) return;
    setO(next, w.o); next.cell = w.a; afterMove(next, true);
  },
};

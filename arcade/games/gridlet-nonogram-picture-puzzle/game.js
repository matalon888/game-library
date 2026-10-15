// Gridlet — picture logic: the numbers beside each row and above each column are the runs of filled squares in it.
// Fill the right squares and a little pixel picture appears and colours itself in. 5×5 grows to 8×8 and 10×10.
// Every picture is checked to be solvable one line at a time (no guessing); if line logic ever stalls, a square is pre-filled.
import { board } from './kit/board.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, note } from './puzzle.js';
import { generate, step } from './gridgen.js';

let N = 5, sol = [], col = [], rc = [], cc = [], given = [], st = [], name = '', mode = 1, geo = {}, drag = null, anim = new Map(), wonAt = 0, hintCell = -1, hintAt = 0, doneR = [], doneC = [];
const FILL_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3" style="fill:currentColor;stroke:none"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const B = board({ game: 'gridlet', label: 'Puzzle points', limits: { maxRun: 1500, maxPerSec: 100 }, mode: 'sum' });
const P = shell({
  B,
  key: 'gridlet', name: 'Gridlet: Nonogram Picture Puzzle', brand: 'Gridlet', kicker: 'picture logic puzzle', accent: '#7a5cf0', ink: '#2b2a45',
  bg: ['#f6f2ff', '#e4f1f7'], winWord: 'Revealed!', dailyLevel: 10,
  buttons: [{ id: 'mode', label: 'Fill', svg: FILL_SVG, onPress: () => setMode(mode ? 0 : 1) }],
  build(level, seed, fk) {
    const p = generate(level, seed, fk, rngf);
    N = p.N; sol = p.sol; col = p.col; rc = p.rc; cc = p.cc; given = p.given; name = p.name;
    st = given.slice(); anim = new Map(); wonAt = 0; hintCell = -1; setMode(1, true); recount();
    return { label: `${N} × ${N} picture`, sizeKey: 'n' + N, cells: N * N };
  },
  layout(a) {
    const rmax = Math.max(1, ...rc.map(c => c.length)), cmax = Math.max(1, ...cc.map(c => c.length));
    const s = Math.floor(Math.min(a.w / (N + rmax * 0.5 + 0.3), (a.h - 40) / (N + cmax * 0.55 + 0.3), 64));
    const lw = Math.ceil(rmax * s * 0.5 + s * 0.3), th = Math.ceil(cmax * s * 0.55 + s * 0.3), B = s * N;
    const x = Math.round(a.x + (a.w - (lw + B)) / 2 + lw), y = Math.round(a.y + Math.max(4, (a.h - 30 - (th + B)) * 0.45) + th);
    geo = { s, x, y, lw, th, B };
  },
  snapshot: () => st.slice(),
  restore(s) { st = s; recount(); },
  isEmpty: () => st.every((v, i) => v === given[i]),
  clear() { st = given.slice(); recount(); },
  hint() {
    for (let c = 0; c < N * N; c++) if (st[c] !== -1 && st[c] !== sol[c]) { P.push(); put(c, sol[c]); flag(c); P.ui.pop(sol[c] ? 'This square is filled' : 'This square stays empty', '#fff', 22, 40); return true; }
    const s = step(N, rc, cc, st); if (!s) return false;
    // prefer revealing a filled square: keep stepping (on a scratch copy) until logic fills one
    const t = st.slice(); let pick = s;
    for (let guard = 0; guard < N * N; guard++) { const q = step(N, rc, cc, t); if (!q) break; t[q.c] = q.v; if (q.v === 1) { pick = q; break; } }
    P.push(); put(pick.c, pick.v); flag(pick.c); return true;
  },
  down(x, y) {
    const c = cellAt(x, y); if (c < 0) return;
    if (given[c] !== -1) { soft.err(); return; }
    // what this drag paints: fill/✕ into empties, or erase when starting on the same mark
    const target = mode === 1 ? 1 : 0, paint = st[c] === target ? -1 : target;
    P.push(); drag = { c0: c, paint, axis: null, last: c }; put(c, paint);
  },
  move(x, y) {
    if (!drag) return; let c = cellAt(x, y, true); if (c < 0) return;
    const x0 = drag.c0 % N, y0 = (drag.c0 / N) | 0; let cx = c % N, cy = (c / N) | 0;
    if (!drag.axis && (cx !== x0 || cy !== y0)) drag.axis = Math.abs(cx - x0) >= Math.abs(cy - y0) ? 'h' : 'v';
    if (drag.axis === 'h') cy = y0; else if (drag.axis === 'v') cx = x0;
    c = cy * N + cx; if (c === drag.last) return; drag.last = c;
    // paint every square between the start and here (fast swipes skip nothing)
    const sx = Math.sign(cx - x0), sy = Math.sign(cy - y0);
    for (let i = 0, xx = x0, yy = y0; i <= N; i++, xx += sx, yy += sy) {
      const d = yy * N + xx; if (given[d] === -1 && st[d] !== drag.paint && (drag.paint === -1 ? st[d] === (mode === 1 ? 1 : 0) : st[d] === -1)) put(d, drag.paint, true);
      if (xx === cx && yy === cy) break;
    }
  },
  up() { drag = null; },
  draw,
  debug: () => ({ geo, N, st: st.slice(), sol, given }),
  bot() {
    for (let c = 0; c < N * N; c++) if (st[c] !== -1 && st[c] !== sol[c] && given[c] === -1) { put(c, -1); return; }
    const c = sol.findIndex((v, i) => v === 1 && st[i] !== 1); if (c >= 0) { P.push(); put(c, 1); }
  },
});

function setMode(m, quiet) {
  mode = m; const b = P.btns.mode; if (!b) return;
  b.classList.toggle('on', m === 0);
  b.querySelector('.c').innerHTML = m ? FILL_SVG : X_SVG; b.lastChild.textContent = m ? 'Fill' : 'Cross';
  b.querySelector('svg').style.color = '#2b2a45';
  if (!quiet) soft.click();
}
function cellAt(x, y, clampIt) {
  let cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s);
  if (clampIt) { cx = Math.max(0, Math.min(N - 1, cx)); cy = Math.max(0, Math.min(N - 1, cy)); }
  return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx;
}
const center = (c) => [geo.x + (c % N + 0.5) * geo.s, geo.y + (((c / N) | 0) + 0.5) * geo.s];
function flag(c) { hintCell = c; hintAt = performance.now(); }
function put(c, v, quiet) {
  if (st[c] === v) return;
  st[c] = v; anim.set(c, performance.now());
  if (v === 1) tone(560 + ((c % N) + ((c / N) | 0)) * 18, 0.05, 'triangle', quiet ? 0.07 : 0.1, 1.15);
  else if (v === 0) tone(1250, 0.03, 'sine', 0.05, 0.7);
  else tone(400, 0.03, 'sine', 0.05, 0.8);
  if (!quiet) buzz(5);
  recount(c);
}
const lineOf = (isRow, i) => [...Array(N).keys()].map(j => isRow ? st[i * N + j] === 1 ? 1 : 0 : st[j * N + i] === 1 ? 1 : 0);
const runs = (a) => { const o = []; let r = 0; for (const v of a) { if (v) r++; else if (r) { o.push(r); r = 0; } } if (r) o.push(r); return o; };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
function recount(c = -1) {
  const pr = doneR, pc = doneC;
  doneR = rc.map((cl, i) => same(runs(lineOf(true, i)), cl)); doneC = cc.map((cl, i) => same(runs(lineOf(false, i)), cl));
  const n = doneR.filter(Boolean).length + doneC.filter(Boolean).length; P.progress(n / (2 * N));
  if (c >= 0) {
    const y = (c / N) | 0, x = c % N;
    if (doneR[y] && !pr[y] && rc[y].length) { chime(y % 5 + 2, 72, 0.06); const [, yy] = center(c); P.fx.sparks(geo.x - geo.lw * 0.5, yy, ['#b59cf2', '#fff'], 5, { speed: 1.8, size: 2.4 }); }
    if (doneC[x] && !pc[x] && cc[x].length) { chime(x % 5 + 3, 72, 0.06); const [xx] = center(c); P.fx.sparks(xx, geo.y - geo.th * 0.5, ['#7cc6a4', '#fff'], 5, { speed: 1.8, size: 2.4 }); }
  }
  if (P.state === 'play' && doneR.every(Boolean) && doneC.every(Boolean)) win();
}
function win() {
  wonAt = performance.now();
  // colour wave + a little melody
  [0, 4, 7, 12, 16].forEach((n, i) => setTimeout(() => note(72 + n, 0.5, 0.1), 200 + i * 90));
  setTimeout(() => P.ui.pop(name + '!', '#7a5cf0', 34, 20), 450);
  P.solved(name, 800);
}

// ---------------------------------------------------------------- drawing
function draw(g, t) {
  const { s, x: X, y: Y, lw, th, B } = geo, now = performance.now(), W = wonAt ? Math.min(1, (now - wonAt) / 1100) : 0;
  // card behind clues + grid
  g.save(); g.shadowColor = 'rgba(60,50,110,.16)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(g, X - lw - 6, Y - th - 6, lw + B + 14, th + B + 14, 18); g.fillStyle = '#fffefb'; g.fill(); g.restore();
  // pointer row / column highlight
  if (drag && !wonAt) { const y = (drag.last / N) | 0, x = drag.last % N; g.fillStyle = 'rgba(122,92,240,.07)'; g.fillRect(X - lw, Y + y * s, lw + B, s); g.fillRect(X + x * s, Y - th, s, th + B); }
  // clues
  const fs = Math.max(10, Math.round(s * 0.42));
  g.font = `750 ${fs}px -apple-system,system-ui,sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'center';
  for (let i = 0; i < N; i++) {
    const r = rc[i].length ? rc[i] : [0]; g.fillStyle = doneR[i] ? 'rgba(43,42,69,.28)' : '#2b2a45';
    r.forEach((v, k) => g.fillText(v, X - s * 0.32 - (r.length - 1 - k) * s * 0.5, Y + (i + 0.5) * s + 1));
    const q = cc[i].length ? cc[i] : [0]; g.fillStyle = doneC[i] ? 'rgba(43,42,69,.28)' : '#2b2a45';
    q.forEach((v, k) => g.fillText(v, X + (i + 0.5) * s, Y - s * 0.34 - (q.length - 1 - k) * s * 0.55));
  }
  // cells
  for (let c = 0; c < N * N; c++) {
    const cx = X + (c % N) * s, cy = Y + ((c / N) | 0) * s, a0 = anim.get(c), k = a0 ? ease.back((now - a0) / 200) : 1;
    const wave = wonAt ? Math.max(0, Math.min(1, (now - wonAt) / 380 - ((c % N) + ((c / N) | 0)) / (2 * N) * 1.2)) : 0;
    g.fillStyle = wonAt ? `rgba(243,241,248,${1 - W})` : '#f3f1f8'; g.fillRect(cx + 1, cy + 1, s - 2, s - 2);
    if (st[c] === 1) {
      const m = s * 0.06 * (1 - wave), sz = (s - 2 - 2 * m) * k;
      g.fillStyle = wave > 0 && col[c] ? col[c] : '#3d3a66';
      if (wave > 0 && wave < 1) { g.fillStyle = '#3d3a66'; g.fillRect(cx + s / 2 - sz / 2, cy + s / 2 - sz / 2, sz, sz); g.globalAlpha = wave; g.fillStyle = col[c]; }
      g.fillRect(cx + s / 2 - sz / 2, cy + s / 2 - sz / 2, sz + (wave ? 0.6 : 0), sz + (wave ? 0.6 : 0)); g.globalAlpha = 1;
      if (given[c] === 1 && !wonAt) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(cx + s / 2, cy + s / 2, Math.max(1.5, s * 0.07), 0, 7); g.fill(); }
    } else if (st[c] === 0 && !wonAt) {
      const r = s * 0.17 * k; g.strokeStyle = 'rgba(43,42,69,.45)'; g.lineWidth = Math.max(1.5, s * 0.06); g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx + s / 2 - r, cy + s / 2 - r); g.lineTo(cx + s / 2 + r, cy + s / 2 + r); g.moveTo(cx + s / 2 + r, cy + s / 2 - r); g.lineTo(cx + s / 2 - r, cy + s / 2 + r); g.stroke();
    }
  }
  // grid lines (every 5th thicker), fading out on solve
  g.globalAlpha = 1 - W * 0.9;
  for (let i = 0; i <= N; i++) {
    const strong = i % 5 === 0 || i === N; g.strokeStyle = strong ? 'rgba(43,42,69,.55)' : 'rgba(43,42,69,.14)'; g.lineWidth = strong ? 1.6 : 1;
    g.beginPath(); g.moveTo(X + i * s, Y); g.lineTo(X + i * s, Y + B); g.moveTo(X, Y + i * s); g.lineTo(X + B, Y + i * s); g.stroke();
  }
  g.globalAlpha = 1;
  if (hintCell >= 0 && now - hintAt < 1500) { const k = 1 - (now - hintAt) / 1500, [x, y] = center(hintCell); g.strokeStyle = `rgba(255,180,60,${k})`; g.lineWidth = 3.5; g.strokeRect(x - s / 2 - (1 - k) * 6, y - s / 2 - (1 - k) * 6, s + (1 - k) * 12, s + (1 - k) * 12); }
  if (!wonAt && P.level <= 2 && !P.D.isDaily) { g.fillStyle = 'rgba(43,42,69,.5)'; g.font = '600 13px -apple-system,system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('Numbers = runs of filled squares, in order', P.area().W / 2, Y + B + 30); }
}

P.start();

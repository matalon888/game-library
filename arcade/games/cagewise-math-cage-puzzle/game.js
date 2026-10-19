// Cagewise — the math cage puzzle. Fill the grid with 1..N so no number repeats in a row or column, and the numbers in
// every outlined cage make its target with the shown operation (+ − × ÷). Sizes 4×4 to 6×6; every puzzle has one solution.
import { board } from './kit/board.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, SVG, css } from './puzzle.js';
import { generate, OPS } from './cagegen.js';

const SIZES = [4, 5, 6];
let sizeI = Math.max(0, Math.min(2, +(localStorage.getItem('cagewise_size') || 0)));
let n = 4, sol = [], cages = [], cageOf = [], val = [], notes = [], sel = -1, notesMode = false, geo = { x: 0, y: 0, s: 60 }, wonAt = 0, builtSize = -1;
let popAt = new Map(), shakeAt = new Map(), cageDoneAt = new Map(), hintCell = -1, hintAt = 0, botTick = 0;

const B = board({ game: 'cagewise', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum', corner: 'tl' });
const P = shell({
  B,
  key: 'cagewise', name: 'Cagewise: Math Cage Puzzle', brand: 'Cagewise', kicker: 'math cage puzzle', accent: '#7a55d6', ink: '#2c2540',
  bg: ['#f7f3fc', '#e7def4'], winWord: 'Caged!', dailyLevel: 9, bottom: 186,
  rule: 'No repeats in a row or column. Each cage must make its target with its sign.',
  chips: { items: SIZES.map(s => `${s} × ${s}`), get: () => sizeI, set: (i) => { sizeI = i; localStorage.setItem('cagewise_size', i); } },
  needsRebuild: () => builtSize !== sizeI,
  tools: [
    'undo',
    { id: 'erase', label: 'Erase', svg: SVG.erase, onPress: () => erase() },
    { id: 'notes', label: 'Notes', svg: SVG.notes, onPress: () => toggleNotes() },
    'hint',
    { id: 'menu', label: 'Size', svg: SVG.grid, onPress: () => P.menu() },
  ],
  build(level, seed, fk) {
    n = P.D.isDaily ? 5 : SIZES[sizeI]; builtSize = sizeI;
    const hard = Math.max(0, Math.min(1, ((level - 1) * 0.07) * fk));
    const r = rngf(seed + n * 1000);
    const p = generate(n, r, hard) || generate(n, rngf(seed + 1), 0);
    sol = p.sol; cages = p.cages; cageOf = p.cageOf;
    val = new Array(n * n).fill(0); notes = new Array(n * n).fill(0); sel = -1; wonAt = 0; popAt = new Map(); shakeAt = new Map(); cageDoneAt = new Map(); hintCell = -1;
    // cage label goes in the cage's top-left cell
    for (const c of cages) c.head = Math.min(...c.cells);
    buildPad(); refresh();
    const grade = hard < 0.25 ? 'easy' : hard < 0.6 ? 'medium' : 'hard';
    return { label: `${n} × ${n} · ${grade}`, sizeKey: 'n' + n, cells: n * n * 2, value: 1 };
  },
  layout(a) {
    const s = Math.floor(Math.min(a.w - 4, a.h - 8, 540) / n);
    geo = { s, x: Math.round(a.x + (a.w - s * n) / 2), y: Math.round(a.y + Math.max(6, (a.h - s * n) * 0.5)) };
  },
  snapshot: () => ({ v: val.slice(), n: notes.slice() }),
  restore(s) { val = s.v; notes = s.n; refresh(); },
  isEmpty: () => val.every(v => !v) && notes.every(m => !m),
  clear() { val = new Array(n * n).fill(0); notes = new Array(n * n).fill(0); refresh(); },
  hint() {
    let c = val.findIndex((v, i) => v && v !== sol[i]);
    if (c < 0 && sel >= 0 && !val[sel]) c = sel;
    if (c < 0) c = bestEmpty();
    if (c < 0) return false;
    P.push(); sel = c; place(c, sol[c], true); hintCell = c; hintAt = performance.now(); return true;
  },
  down(x, y) { const c = cellAt(x, y); if (c >= 0) { sel = c; soft.click(); refreshPad(); } },
  draw,
  debug: () => ({ n, filled: val.filter(Boolean).length, cages: cages.length }),
  bot() {
    if (wonAt) return;
    if (++botTick % 4) return;
    if (notesMode) toggleNotes();
    let c = val.findIndex((v, i) => v && v !== sol[i]);
    if (c < 0) c = bestEmpty(); if (c < 0) return;
    sel = c; P.push(); place(c, sol[c]);
  },
});

function bestEmpty() { let best = -1, bk = 99; for (const cg of cages) { const e = cg.cells.filter(c => !val[c]); if (e.length && e.length < bk) { bk = e.length; best = e[0]; } } return best; }
function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cy * n + cx; }
function center(c) { return [geo.x + (c % n + 0.5) * geo.s, geo.y + (((c / n) | 0) + 0.5) * geo.s]; }
const sameLine = (a, b) => ((a / n) | 0) === ((b / n) | 0) || a % n === b % n;

// ---------------------------------------------------------------- number pad (DOM)
css(`
#cg-pad{position:fixed;left:0;right:0;bottom:calc(112px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px;z-index:5;padding:0 14px}
#cg-pad button{flex:1;max-width:62px;height:56px;border:0;border-radius:16px;background:rgba(255,255,255,.95);box-shadow:0 5px 14px rgba(50,30,90,.12),inset 0 -3px 0 rgba(0,0,0,.05);font:800 26px/1 -apple-system,system-ui,sans-serif;color:#7a55d6;cursor:pointer;transition:transform .1s,opacity .2s;position:relative;-webkit-tap-highlight-color:transparent}
#cg-pad button:active{transform:scale(.92)}
#cg-pad.notes button{color:#8b84a0;font-weight:650;font-size:22px}
#cg-pad button small{position:absolute;right:6px;top:4px;font-size:10px;font-weight:700;color:#b3abc6}
#cg-pad button.done{opacity:.35}
.pz-b .badge{position:absolute;top:-4px;right:-8px;font-style:normal;background:#a39fae;color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:1px 5px;letter-spacing:0}
.pz-b.on .badge{background:#7a55d6}
`);
const pad = document.createElement('div'); pad.id = 'cg-pad'; document.body.appendChild(pad);
function buildPad() {
  pad.innerHTML = '';
  for (let k = 1; k <= n; k++) {
    const b = document.createElement('button'); b.innerHTML = `${k}<small></small>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (P.state !== 'play') return; press(k); });
    pad.appendChild(b);
  }
  const nb = P.btns.notes; if (nb && !nb.querySelector('.badge')) nb.insertAdjacentHTML('beforeend', '<span class="badge">OFF</span>');
  refreshPad();
}
function refreshPad() {
  pad.classList.toggle('notes', notesMode);
  const cnt = new Array(n + 1).fill(0); val.forEach(v => v && cnt[v]++);
  [...pad.children].forEach((b, i) => { b.classList.toggle('done', cnt[i + 1] >= n); });
  const nb = P.btns.notes; if (nb) { nb.classList.toggle('on', notesMode); const bd = nb.querySelector('.badge'); if (bd) bd.textContent = notesMode ? 'ON' : 'OFF'; }
}
function toggleNotes() { notesMode = !notesMode; soft.click(); buzz(5); refreshPad(); }
pad.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- moves
function press(k) {
  if (sel < 0) { sel = val.findIndex(v => !v); if (sel < 0) return; }
  if (notesMode) {
    if (val[sel]) return;
    P.push(); notes[sel] ^= 1 << k; soft.click(); refresh(); return;
  }
  P.push();
  if (val[sel] === k) { val[sel] = 0; soft.swish(); refresh(); return; }
  place(sel, k);
}
function erase() { if (sel < 0 || (!val[sel] && !notes[sel])) return; P.push(); val[sel] = 0; notes[sel] = 0; soft.swish(); refresh(); }
function place(c, k, fromHint = false) {
  val[c] = k; notes[c] = 0;
  for (let i = 0; i < n * n; i++) if (i !== c && sameLine(i, c)) notes[i] &= ~(1 << k);   // tidy notes in the row / column
  popAt.set(c, performance.now());
  const clash = clashes().has(c);
  if (clash) { shakeAt.set(c, performance.now()); soft.err(); buzz([8, 30, 8]); }
  else { chime(k + 1, 69, 0.1); buzz(6); const [x, y] = center(c); P.fx.sparks(x, y, ['#c9b6ff', '#ffd36e', '#fff'], 6, { speed: 2.2, size: 2.6 }); }
  // a cage that is now complete and right gets a little glow
  const cg = cages[cageOf[c]];
  if (cg.cells.every(i => val[i]) && cageRight(cg) && !clash) { cageDoneAt.set(cageOf[c], performance.now()); if (cg.cells.length > 1) arp([72, 76, 79], 60, 0.07, 0.5); }
  refresh();
  if (val.every((v, i) => v === sol[i])) win();
}
function cageRight(cg) {
  const v = cg.cells.map(c => val[c]); if (v.some(x => !x)) return false;
  if (cg.op === '') return v[0] === cg.target;
  if (cg.op === '+') return v.reduce((a, b) => a + b, 0) === cg.target;
  if (cg.op === 'x') return v.reduce((a, b) => a * b, 1) === cg.target;
  const hi = Math.max(...v), lo = Math.min(...v); return cg.op === '-' ? hi - lo === cg.target : hi === lo * cg.target;
}
function clashes() {
  const out = new Set();
  for (let i = 0; i < n * n; i++) if (val[i]) for (let j = i + 1; j < n * n; j++) if (val[j] === val[i] && sameLine(i, j)) { out.add(i); out.add(j); }
  return out;
}
function refresh() {
  let ok = 0; for (let i = 0; i < n * n; i++) if (val[i] && val[i] === sol[i]) ok++;
  P.progress(ok / (n * n)); refreshPad();
}
function win() {
  wonAt = performance.now(); sel = -1;
  arp([67, 71, 74, 79, 83], 90, 0.11, 0.8);
  P.solved(`${n}×${n}`, 1000);
}
addEventListener('keydown', (e) => {
  if (P.state !== 'play') return;
  const k = +e.key;
  if (k >= 1 && k <= n) press(k);
  else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
  else if (e.key === 'n' || e.key === 'N') toggleNotes();
  else if (e.key.startsWith('Arrow')) { if (sel < 0) sel = 0; const r = (sel / n) | 0, c = sel % n; sel = e.key === 'ArrowUp' ? ((r + n - 1) % n) * n + c : e.key === 'ArrowDown' ? ((r + 1) % n) * n + c : e.key === 'ArrowLeft' ? r * n + (c + n - 1) % n : r * n + (c + 1) % n; }
});

// ---------------------------------------------------------------- drawing
function draw(g) {
  const { x: X, y: Y, s } = geo, now = performance.now(), BW = s * n;
  const cl = clashes(), selV = sel >= 0 ? val[sel] : 0;
  g.save(); g.shadowColor = 'rgba(60,30,110,.2)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rrect(g, X - 6, Y - 6, BW + 12, BW + 12, 18); g.fillStyle = '#fff'; g.fill(); g.restore();
  g.save(); rrect(g, X, Y, BW, BW, 12); g.clip();
  g.fillStyle = '#fdfcff'; g.fillRect(X, Y, BW, BW);
  for (let c = 0; c < n * n; c++) {
    const cx = X + (c % n) * s, cy = Y + ((c / n) | 0) * s;
    let bg = null;
    if (sel >= 0 && c !== sel && sameLine(c, sel)) bg = '#f1ecfb';
    if (sel >= 0 && cageOf[c] === cageOf[sel] && c !== sel) bg = '#ebe3fb';
    if (selV && val[c] === selV && c !== sel) bg = '#e0d4fb';
    if (c === sel) bg = '#d2c2fa';
    if (cl.has(c)) bg = '#fde4e6';
    const cd = cageDoneAt.get(cageOf[c]); if (cd && now - cd < 700) { const k = 1 - (now - cd) / 700; g.fillStyle = `rgba(255,214,110,${0.55 * k})`; g.fillRect(cx, cy, s, s); }
    if (bg) { g.fillStyle = bg; g.fillRect(cx, cy, s, s); }
    if (wonAt) { const k = Math.max(0, 1 - Math.abs((now - wonAt) / 900 - ((c % n) + ((c / n) | 0)) / (2 * n)) * 5); if (k > 0) { g.fillStyle = `rgba(255,214,110,${0.5 * k})`; g.fillRect(cx, cy, s, s); } }
  }
  // thin grid
  g.strokeStyle = '#e1dbee'; g.lineWidth = 1;
  for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(X + i * s, Y); g.lineTo(X + i * s, Y + BW); g.moveTo(X, Y + i * s); g.lineTo(X + BW, Y + i * s); g.stroke(); }
  // cage borders
  g.strokeStyle = '#3b2f5c'; g.lineWidth = Math.max(2.5, s * 0.05); g.lineCap = 'round'; g.beginPath();
  for (let c = 0; c < n * n; c++) {
    const i = c % n, j = (c / n) | 0, cx = X + i * s, cy = Y + j * s;
    if (i < n - 1 && cageOf[c] !== cageOf[c + 1]) { g.moveTo(cx + s, cy); g.lineTo(cx + s, cy + s); }
    if (j < n - 1 && cageOf[c] !== cageOf[c + n]) { g.moveTo(cx, cy + s); g.lineTo(cx + s, cy + s); }
  }
  g.stroke(); g.restore();
  rrect(g, X, Y, BW, BW, 12); g.strokeStyle = '#3b2f5c'; g.lineWidth = Math.max(3, s * 0.06); g.stroke();
  // cage labels
  g.textAlign = 'left'; g.textBaseline = 'top';
  cages.forEach((cg, ci) => {
    const c = cg.head, cx = X + (c % n) * s, cy = Y + ((c / n) | 0) * s, full = cg.cells.every(i => val[i]);
    const wrong = full && !cageRight(cg);
    g.font = `750 ${Math.round(s * 0.2)}px -apple-system,system-ui,sans-serif`;
    g.fillStyle = wrong ? '#e0454f' : full ? '#9a90b4' : '#3b2f5c';
    g.fillText(`${cg.target}${OPS[cg.op]}`, cx + s * 0.08, cy + s * 0.07);
  });
  // values + notes
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let c = 0; c < n * n; c++) {
    const [cx, cy0] = center(c), cy = cy0 + s * 0.06;
    if (val[c]) {
      const pa = popAt.get(c), k = pa ? ease.back((now - pa) / 260) : 1;
      let ox = 0; const sh = shakeAt.get(c); if (sh && now - sh < 400) ox = Math.sin((now - sh) / 25) * s * 0.06 * (1 - (now - sh) / 400);
      g.save(); g.translate(cx + ox, cy); g.scale(k, k);
      g.font = `700 ${Math.round(s * 0.5)}px -apple-system,system-ui,sans-serif`;
      g.fillStyle = cl.has(c) ? '#e0454f' : '#5a3fbf'; g.fillText(val[c], 0, 2); g.restore();
    } else if (notes[c]) {
      const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), fs = Math.round(s * 0.19);
      g.font = `650 ${fs}px -apple-system,system-ui,sans-serif`; g.fillStyle = '#8b84a0';
      for (let k = 1; k <= n; k++) if (notes[c] & (1 << k)) {
        const ix = (k - 1) % cols, iy = ((k - 1) / cols) | 0;
        g.fillStyle = selV === k ? '#7a55d6' : '#8b84a0';
        g.fillText(k, cx + (ix - (cols - 1) / 2) * s * 0.24, cy + s * 0.04 + (iy - (rows - 1) / 2) * s * 0.22);
      }
    }
  }
  // hint glow
  if (hintCell >= 0 && now - hintAt < 1400) { const k = 1 - (now - hintAt) / 1400, [cx, cy] = center(hintCell); g.strokeStyle = `rgba(122,85,214,${k})`; g.lineWidth = 3; rrect(g, cx - s / 2 - (1 - k) * 8, cy - s / 2 - (1 - k) * 8, s + (1 - k) * 16, s + (1 - k) * 16, 10); g.stroke(); }
}

if (P.D.isDaily && P.btns.menu) P.btns.menu.style.display = 'none';   // the daily puzzle has one fixed size
P.start();

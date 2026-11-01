// Cagewise deep v2 — the same cage puzzle (fill 1..N, no repeats in a row or column, every cage hits its target with its sign),
// wrapped in a campaign: 30 authored levels in 3 worlds (levels.js), 3 stars per level (no slip + under par), "?" cages that hide
// their sign, a golden cage per bonus level, cage chains, a chest every 8 stars that unlocks board themes, a daily streak.
import { board } from './kit/board.js';
import { store } from './kit/hc.js';
import { shell, rngf, rrect, ease, buzz, tone, soft, chime, arp, SVG, css, fmtTime } from './puzzle.js';
import { generate, OPS } from './cagegen.js';
import { LEVELS, WORLDS } from './levels.js';

const NL = LEVELS.length, CHEST_AT = 8;
const SK = store('cagewise');
const THEMES = [
  { id: 'lilac', name: 'Lilac', val: '#5a3fbf', line: '#3b2f5c', sel: '#d2c2fa', row: '#f1ecfb', cage: '#ebe3fb', same: '#e0d4fb', pad: '#7a55d6' },
  { id: 'mint', name: 'Mint', val: '#1f8a6a', line: '#1f4d44', sel: '#b9ecd8', row: '#e9f8f1', cage: '#dcf3e8', same: '#c9ecdd', pad: '#1f8a6a' },
  { id: 'peach', name: 'Peach', val: '#d1562c', line: '#5a3326', sel: '#ffd0b8', row: '#fff1e9', cage: '#ffe6d8', same: '#ffdcc9', pad: '#d1562c' },
  { id: 'sky', name: 'Sky', val: '#2468c9', line: '#1f3a63', sel: '#bcd9ff', row: '#ecf4ff', cage: '#dfecff', same: '#cfe2ff', pad: '#2468c9' },
  { id: 'rose', name: 'Rose', val: '#c2336f', line: '#5c2842', sel: '#ffc4da', row: '#fff0f6', cage: '#ffe3ee', same: '#ffd5e6', pad: '#c2336f' },
  { id: 'slate', name: 'Slate', val: '#3a4a5e', line: '#1d2733', sel: '#cdd6e2', row: '#eef1f5', cage: '#e2e8ef', same: '#d8e0ea', pad: '#3a4a5e' },
  { id: 'sun', name: 'Sunrise', val: '#c77700', line: '#5c3d12', sel: '#ffe19a', row: '#fff8e4', cage: '#fff0c4', same: '#ffe8ad', pad: '#c77700' },
  { id: 'gold', name: 'Golden', val: '#a67200', line: '#6b4a00', sel: '#ffd86b', row: '#fff3c9', cage: '#ffeaa0', same: '#ffe07a', pad: '#a67200', rare: 1 },
];
const dst = () => SK.get('dst', {});          // best stars per level
const dbt = () => SK.get('dbt', {});          // best time per level
const starsTotal = () => Object.values(dst()).reduce((a, b) => a + b, 0);
const keys = () => SK.get('keys', 0);
const owned = () => SK.get('themes', ['lilac']);
const chestsOpened = () => SK.get('chests', 0);
const meter = () => starsTotal() + keys();
const chestsReady = () => Math.floor(meter() / CHEST_AT) - chestsOpened();
const frontier = () => { const d = dst(); let k = 1; while (d[k]) k++; return k; };   // first level not cleared
let T = THEMES.find(t => t.id === SK.get('theme', 'lilac')) || THEMES[0];
const todayN = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

const STAR_D = 'M12 2l3 6.9 7.5.7-5.7 5 1.8 7.3L12 17.8 5.4 21.9l1.8-7.3-5.7-5 7.5-.7z';
const STAR = `<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.12em"><path fill="currentColor" d="${STAR_D}"/></svg>`;
const SIZES = [4, 5, 6];
let n = 4, sol = [], cages = [], cageOf = [], val = [], notes = [], sel = -1, notesMode = false, geo = { x: 0, y: 0, s: 60 }, wonAt = 0;
let popAt = new Map(), shakeAt = new Map(), cageDoneAt = new Map(), hintCell = -1, hintAt = 0, botTick = 0, sweeps = [];
let cur = null, slips = 0, chain = 0, bestChain = 0, parNoted = false, goldCage = -1, goldDone = false, lastHud = '', purposeAt = 0, tipOn = false, curLevel = 1;

const B = board({ game: 'cagewise', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum', corner: 'tl' });
const P = shell({
  B, campaign: true, fresh: () => curLevel >= frontier(),
  key: 'cagewise', name: 'Cagewise: Math Cage Puzzle', brand: 'Cagewise', kicker: 'math cage puzzle', accent: '#7a55d6', ink: '#2c2540',
  bg: ['#f7f3fc', '#e7def4'], winWord: 'Caged!', dailyLevel: 9, bottom: 186, top: 136,
  rule: 'No repeats in a row or column. Each cage must make its target with its sign.',
  tools: [
    'undo',
    { id: 'erase', label: 'Erase', svg: SVG.erase, onPress: () => erase() },
    { id: 'notes', label: 'Notes', svg: SVG.notes, onPress: () => toggleNotes() },
    'hint',
    { id: 'menu', label: 'Map', svg: SVG.grid, onPress: () => showMap() },
  ],
  build(level, seed, fk) {
    curLevel = level; cur = null;
    let L = null;
    if (P.D.isDaily) { n = 5; const hard = 0.45, p = generate(5, rngf(seed + 5000), hard) || generate(5, rngf(seed + 1), 0); load(p.sol, p.cages.map(c => ({ cells: c.cells, op: c.op, target: c.target }))); cur = { par: 150, label: '5 × 5 · daily', daily: 1 }; }
    else if (level <= NL) {
      L = LEVELS[level - 1]; n = L.n;
      load(L.sol.split('').map(Number), L.cages.map(c => ({ cells: c.c.slice(), op: c.o, target: c.t })));
      goldCage = L.gold; cur = { par: L.par, label: `${level} · ${L.n}×${L.n}`, L };
    } else {   // after the campaign: endless generated puzzles with everything unlocked
      n = level % 3 === 0 ? 6 : 5; const hard = Math.min(1, 0.5 + (level - NL) * 0.03);
      const p = generate(n, rngf(level * 7919 + 13), hard, { q: 0.3, minq: 1 }) || generate(n, rngf(level + 1), 0);
      load(p.sol, p.cages.map(c => ({ cells: c.cells, op: c.op, target: c.target })));
      cur = { par: n === 6 ? 300 : 160, label: `${level} · ${n}×${n}`, L: { purpose: 'Endless: everything unlocked.', boss: 0, hard: 0, gold: -1 }, endless: 1 };
    }
    slips = 0; chain = 0; bestChain = 0; parNoted = false; goldDone = false; lastHud = ''; sweeps = [];
    if (!(cur.L && cur.L.gold >= 0)) goldCage = -1; else goldCage = cur.L.gold;
    buildPad(); refresh();
    if (!P.D.isDaily && level <= 3) { const e = bestEmpty(); if (e >= 0) sel = e; }
    setPurpose(P.D.isDaily ? 'Daily: same puzzle for everyone today.' : (cur.L && cur.L.purpose) || '');
    tipOn = !P.D.isDaily && level === 1 && !SK.get('tipDone', 0);
    return { label: P.D.isDaily ? '5 × 5 · daily' : `${WORLD_OF(level)} · level ${level}`, sizeKey: 'n' + n, cells: n * n * 2, value: 1 };
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
    P.push(); sel = c; place(c, sol[c], true); hintCell = c; hintAt = performance.now(); chain = 0; return true;
  },
  down(x, y) { const c = cellAt(x, y); if (c >= 0) { sel = c; soft.click(); refreshPad(); } },
  tick() { hud(); },
  onWin(r) { winCard(r); },
  draw,
  debug: () => ({ n, filled: val.filter(Boolean).length, cages: cages.length, level: curLevel, slips, chain, stars: starsNow() }),
  bot() {
    if (wonAt) return;
    if (notesMode) toggleNotes();
    let c = val.findIndex((v, i) => v && v !== sol[i]);
    if (c < 0) c = bestEmpty(); if (c < 0) return;
    sel = c; P.push(); place(c, sol[c]);
  },
});
const WORLD_OF = (l) => l > NL ? 'Endless' : WORLDS[Math.floor((l - 1) / 10)].name;

function load(solution, cs) {
  sol = solution; cages = cs; cageOf = new Array(n * n).fill(0);
  cages.forEach((c, i) => c.cells.forEach(x => cageOf[x] = i));
  val = new Array(n * n).fill(0); notes = new Array(n * n).fill(0); sel = -1; wonAt = 0; popAt = new Map(); shakeAt = new Map(); cageDoneAt = new Map(); hintCell = -1;
  for (const c of cages) c.head = Math.min(...c.cells);
}
function bestEmpty() { let best = -1, bk = 99; for (const cg of cages) { const e = cg.cells.filter(c => !val[c]); if (e.length && e.length < bk) { bk = e.length; best = e[0]; } } return best; }
function cellAt(x, y) { const cx = Math.floor((x - geo.x) / geo.s), cy = Math.floor((y - geo.y) / geo.s); return cx < 0 || cy < 0 || cx >= n || cy >= n ? -1 : cy * n + cx; }
function center(c) { return [geo.x + (c % n + 0.5) * geo.s, geo.y + (((c / n) | 0) + 0.5) * geo.s]; }
const sameLine = (a, b) => ((a / n) | 0) === ((b / n) | 0) || a % n === b % n;

// ---------------------------------------------------------------- stars (live) + purpose line
function starsNow() { if (!cur) return 3; const bad = (slips + P.hintsUsed) > 0, late = P.secs > cur.par; return Math.max(1, 3 - (bad ? 1 : 0) - (late ? 1 : 0)); }
css(`
#cg-purpose{position:fixed;left:50%;transform:translateX(-50%);top:calc(104px + env(safe-area-inset-top));width:min(340px,92vw);text-align:center;font:650 13px/1.25 -apple-system,system-ui,sans-serif;color:#2c2540;z-index:5;pointer-events:none;transition:opacity .6s}
#cg-purpose b{display:inline-block;background:#7a55d6;color:#fff;border-radius:9px;padding:1px 7px;margin-right:6px;font-size:11px;letter-spacing:1px}
#cg-purpose.boss b{background:#d6558a}#cg-purpose.hard b{background:#d64545}
#pz-time span.stars{font-weight:800;letter-spacing:2px}
#pz-time span.stars i{font-style:normal;color:#d8d2e6}#pz-time span.stars i.on{color:#f2a900}
#pz-time span.best{display:none!important}
#pz-time span.chain{background:#7a55d6;color:#fff;font-weight:800;display:none}
`);
const purposeEl = document.createElement('div'); purposeEl.id = 'cg-purpose'; document.body.appendChild(purposeEl);
function setPurpose(t) {
  const tag = P.D.isDaily ? 'DAILY' : cur && cur.L && cur.L.boss ? 'BOSS' : cur && cur.L && cur.L.hard ? 'HARD' : `LEVEL ${curLevel}`;
  purposeEl.className = cur && cur.L && cur.L.boss ? 'boss' : cur && cur.L && cur.L.hard ? 'hard' : '';
  purposeEl.innerHTML = `<b>${tag}</b>${t}`; purposeEl.style.opacity = 1; purposeAt = performance.now();
}
const timeEl = document.getElementById('pz-time');
const starsEl = document.createElement('span'); starsEl.className = 'stars'; const chainEl = document.createElement('span'); chainEl.className = 'chain';
timeEl.appendChild(starsEl); timeEl.appendChild(chainEl);
function hud() {
  if (P.state === 'play' && !parNoted && cur && !cur.daily && P.secs > cur.par && !wonAt) { parNoted = true; soft.err(); P.ui.pop('PAR PASSED', '#d64545', 20, 22); }
  const s = P.D.isDaily ? 3 : starsNow(), par = cur ? fmtTime(Math.max(0, Math.ceil(cur.par - P.secs))) : '';
  const k = P.D.isDaily ? '' : `${s}|${P.secs > (cur ? cur.par : 9e9) ? 'late' : par}|${chain}`;
  if (k !== lastHud) {
    lastHud = k;
    starsEl.innerHTML = P.D.isDaily ? '' : [1, 2, 3].map(i => `<i class="${i <= s ? 'on' : ''}">${STAR}</i>`).join('') + (cur && P.secs <= cur.par ? ` <small style="font-weight:600;letter-spacing:0">${par}</small>` : '');
    starsEl.style.display = P.D.isDaily ? 'none' : '';
    chainEl.style.display = chain >= 2 ? '' : 'none'; chainEl.textContent = `⛓ x${chain}`;
  }
  if (performance.now() - purposeAt > 6000 && purposeEl.style.opacity !== '0.5') purposeEl.style.opacity = 0.5;
}

// ---------------------------------------------------------------- number pad (DOM)
css(`
#cg-pad{position:fixed;left:0;right:0;bottom:calc(112px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px;z-index:5;padding:0 14px}
#cg-pad button{flex:1;max-width:62px;height:56px;border:0;border-radius:16px;background:rgba(255,255,255,.95);box-shadow:0 5px 14px rgba(50,30,90,.12),inset 0 -3px 0 rgba(0,0,0,.05);font:800 26px/1 -apple-system,system-ui,sans-serif;color:var(--pad,#7a55d6);cursor:pointer;transition:transform .1s,opacity .2s;position:relative;-webkit-tap-highlight-color:transparent}
#cg-pad button:active{transform:scale(.92)}
#cg-pad.notes button{color:#8b84a0;font-weight:650;font-size:22px}
#cg-pad.tip button:first-child{animation:cgp 1s infinite}
@keyframes cgp{50%{transform:scale(1.12);box-shadow:0 0 0 6px rgba(122,85,214,.25)}}
#cg-pad button.done{opacity:.35}
.pz-b .badge{position:absolute;top:-4px;right:-8px;font-style:normal;background:#a39fae;color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:1px 5px;letter-spacing:0}
.pz-b.on .badge{background:#7a55d6}
`);
const pad = document.createElement('div'); pad.id = 'cg-pad'; document.body.appendChild(pad);
function buildPad() {
  pad.innerHTML = ''; pad.style.setProperty('--pad', T.pad);
  for (let k = 1; k <= n; k++) {
    const b = document.createElement('button'); b.textContent = k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (P.state !== 'play') return; press(k); });
    pad.appendChild(b);
  }
  const nb = P.btns.notes; if (nb && !nb.querySelector('.badge')) nb.insertAdjacentHTML('beforeend', '<span class="badge">OFF</span>');
  refreshPad();
}
function refreshPad() {
  pad.classList.toggle('notes', notesMode); pad.classList.toggle('tip', tipOn && !val.some(Boolean));
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
function cageRight(cg) {
  const v = cg.cells.map(c => val[c]); if (v.some(x => !x)) return false;
  if (cg.op === '') return v[0] === cg.target;
  const sum = v.reduce((a, b) => a + b, 0), prod = v.reduce((a, b) => a * b, 1), hi = Math.max(...v), lo = Math.min(...v);
  if (cg.op === '+') return sum === cg.target;
  if (cg.op === 'x') return prod === cg.target;
  if (cg.op === '-') return hi - lo === cg.target;
  if (cg.op === '/') return hi === lo * cg.target;
  return sum === cg.target || prod === cg.target || (v.length === 2 && (hi - lo === cg.target || hi === lo * cg.target));   // '?'
}
function place(c, k, fromHint = false) {
  val[c] = k; notes[c] = 0; if (tipOn) { tipOn = false; SK.set('tipDone', 1); }
  for (let i = 0; i < n * n; i++) if (i !== c && sameLine(i, c)) notes[i] &= ~(1 << k);
  const now = performance.now(); popAt.set(c, now);
  const clash = clashes().has(c), [x, y] = center(c);
  const cgi = cageOf[c], cg = cages[cgi], full = cg.cells.every(i => val[i]), right = full && cageRight(cg);
  if (clash) {
    shakeAt.set(c, now); soft.err(); buzz([8, 30, 8]); if (!fromHint) { slips++; chain = 0; P.ui.pop('REPEAT!', '#e0454f', 24, 22); }
  } else if (full && !right) {
    cg.cells.forEach(i => shakeAt.set(i, now)); soft.err(); buzz([8, 30, 8]); if (!fromHint) { slips++; chain = 0; P.ui.pop('NOT QUITE', '#e0454f', 24, 22); }
  } else {
    chime(k + 1, 69, 0.1); buzz(6);
    P.fx.sparks(x, y, ['#c9b6ff', '#ffd36e', '#fff'], 6 + Math.min(10, chain * 2), { speed: 2.2 + Math.min(2, chain * 0.3), size: 2.6 });
  }
  if (right && !clash) {
    cageDoneAt.set(cgi, now);
    if (!fromHint) { chain++; bestChain = Math.max(bestChain, chain); }
    if (cg.cells.length > 1) {
      arp([72 + Math.min(chain, 8), 76 + Math.min(chain, 8), 79 + Math.min(chain, 8)], 55, 0.07 + Math.min(0.06, chain * 0.01), 0.5);
      cg.cells.forEach(i => { const [px, py] = center(i); P.fx.sparks(px, py, ['#ffd36e', '#fff', '#c9b6ff'], 5 + Math.min(8, chain * 2), { speed: 3, size: 3 }); });
    }
    if (chain >= 2 && !fromHint) { P.ui.pop(chain >= 5 ? `ON FIRE x${chain}` : `CHAIN x${chain}`, chain >= 5 ? '#e0742b' : '#7a55d6', 22 + Math.min(14, chain * 2), 22); if (chain >= 5) { P.ui.flash(0.25); buzz(15); } }
    if (cgi === goldCage && !goldDone) {
      goldDone = true; SK.set('keys', keys() + 1); P.ui.pop('GOLD CAGE! +1 KEY', '#c98a00', 26, 22); P.fx.confetti(30); arp([79, 83, 86, 91], 70, 0.1, 0.6);
    }
  }
  // a finished row / column with no repeats sweeps a glow along itself
  const r = (c / n) | 0, col = c % n;
  if (!clash) {
    if (lineDone(r, true)) sweeps.push({ t: now, line: r, row: true });
    if (lineDone(col, false)) sweeps.push({ t: now, line: col, row: false });
  }
  refresh();
  if (val.every((v, i) => v === sol[i])) win();
}
function lineDone(i, row) { const s = new Set(); for (let k = 0; k < n; k++) { const v = val[row ? i * n + k : k * n + i]; if (!v) return false; s.add(v); } return s.size === n; }
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
  P.solved(`${n}×${n}`, 1100);
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
    if (cageOf[c] === goldCage && !goldDone) bg = '#fff4cf';
    if (sel >= 0 && c !== sel && sameLine(c, sel)) bg = T.row;
    if (sel >= 0 && cageOf[c] === cageOf[sel] && c !== sel) bg = T.cage;
    if (selV && val[c] === selV && c !== sel) bg = T.same;
    if (c === sel) bg = T.sel;
    if (cl.has(c)) bg = '#fde4e6';
    if (bg) { g.fillStyle = bg; g.fillRect(cx, cy, s, s); }
    const cd = cageDoneAt.get(cageOf[c]); if (cd && now - cd < 700) { const k = 1 - (now - cd) / 700; g.fillStyle = `rgba(255,214,110,${0.6 * k})`; g.fillRect(cx, cy, s, s); }
    if (wonAt) { const k = Math.max(0, 1 - Math.abs((now - wonAt) / 900 - ((c % n) + ((c / n) | 0)) / (2 * n)) * 5); if (k > 0) { g.fillStyle = `rgba(255,214,110,${0.5 * k})`; g.fillRect(cx, cy, s, s); } }
  }
  sweeps = sweeps.filter(w => now - w.t < 700);
  for (const w of sweeps) {
    const k = (now - w.t) / 700;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i / n - k * 1.3 + 0.15); const a = Math.max(0, 0.5 - d * 2.2); if (a <= 0) continue;
      g.fillStyle = `rgba(255,255,255,${a})`; w.row ? g.fillRect(X + i * s, Y + w.line * s, s, s) : g.fillRect(X + w.line * s, Y + i * s, s, s);
    }
  }
  g.strokeStyle = '#e1dbee'; g.lineWidth = 1;
  for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(X + i * s, Y); g.lineTo(X + i * s, Y + BW); g.moveTo(X, Y + i * s); g.lineTo(X + BW, Y + i * s); g.stroke(); }
  g.strokeStyle = T.line; g.lineWidth = Math.max(2.5, s * 0.05); g.lineCap = 'round'; g.beginPath();
  for (let c = 0; c < n * n; c++) {
    const i = c % n, j = (c / n) | 0, cx = X + i * s, cy = Y + j * s;
    if (i < n - 1 && cageOf[c] !== cageOf[c + 1]) { g.moveTo(cx + s, cy); g.lineTo(cx + s, cy + s); }
    if (j < n - 1 && cageOf[c] !== cageOf[c + n]) { g.moveTo(cx, cy + s); g.lineTo(cx + s, cy + s); }
  }
  g.stroke(); g.restore();
  rrect(g, X, Y, BW, BW, 12); g.strokeStyle = T.line; g.lineWidth = Math.max(3, s * 0.06); g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'top';
  cages.forEach((cg, ci) => {
    const c = cg.head, cx = X + (c % n) * s, cy = Y + ((c / n) | 0) * s, full = cg.cells.every(i => val[i]);
    const wrong = full && !cageRight(cg);
    g.font = `750 ${Math.round(s * 0.2)}px -apple-system,system-ui,sans-serif`;
    g.fillStyle = wrong ? '#e0454f' : full ? '#9a90b4' : cg.op === '?' ? '#c2336f' : T.line;
    g.fillText(`${cg.target}${OPS[cg.op]}`, cx + s * 0.08, cy + s * 0.07);
    if (ci === goldCage && !goldDone) { g.save(); g.translate(cx + s * 0.76, cy + s * 0.05); g.scale(s * 0.2 / 24, s * 0.2 / 24); g.fillStyle = '#e0a000'; g.fill(new Path2D(STAR_D)); g.restore(); }
  });
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let c = 0; c < n * n; c++) {
    const [cx, cy0] = center(c), cy = cy0 + s * 0.06;
    if (val[c]) {
      const pa = popAt.get(c), k = pa ? ease.back((now - pa) / 260) : 1;
      let ox = 0; const sh = shakeAt.get(c); if (sh && now - sh < 400) ox = Math.sin((now - sh) / 25) * s * 0.06 * (1 - (now - sh) / 400);
      g.save(); g.translate(cx + ox, cy); g.scale(k, k);
      g.font = `700 ${Math.round(s * 0.5)}px -apple-system,system-ui,sans-serif`;
      g.fillStyle = cl.has(c) ? '#e0454f' : T.val; g.fillText(val[c], 0, 2); g.restore();
    } else if (notes[c]) {
      const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), fs = Math.round(s * 0.19);
      g.font = `650 ${fs}px -apple-system,system-ui,sans-serif`;
      for (let k = 1; k <= n; k++) if (notes[c] & (1 << k)) {
        const ix = (k - 1) % cols, iy = ((k - 1) / cols) | 0;
        g.fillStyle = selV === k ? T.pad : '#8b84a0';
        g.fillText(k, cx + (ix - (cols - 1) / 2) * s * 0.24, cy + s * 0.04 + (iy - (rows - 1) / 2) * s * 0.22);
      }
    }
  }
  if (hintCell >= 0 && now - hintAt < 1400) { const k = 1 - (now - hintAt) / 1400, [cx, cy] = center(hintCell); g.strokeStyle = `rgba(122,85,214,${k})`; g.lineWidth = 3; rrect(g, cx - s / 2 - (1 - k) * 8, cy - s / 2 - (1 - k) * 8, s + (1 - k) * 16, s + (1 - k) * 16, 10); g.stroke(); }
  // first-level tip: a finger tapping the selected cell until the first number goes in
  if (tipOn && sel >= 0 && !val[sel] && P.state === 'play') { const [cx, cy] = center(sel), b = Math.sin(now / 250) * 5; g.font = `${Math.round(s * 0.5)}px serif`; g.fillText('👆', cx + s * 0.15, cy + s * 0.55 + b); }
}

// ---------------------------------------------------------------- campaign UI: map, win card, chest
css(`
.cg-ov{position:fixed;inset:0;z-index:9;display:none;overflow:auto;background:linear-gradient(180deg,rgba(247,243,252,.97),rgba(231,222,244,.98));color:#2c2540;font-family:-apple-system,system-ui,sans-serif;-webkit-overflow-scrolling:touch}
.cg-ov.on{display:block}
.cg-wrap{max-width:430px;margin:0 auto;padding:calc(20px + env(safe-area-inset-top)) 16px 40px}
.cg-h{display:flex;align-items:center;justify-content:space-between}
.cg-h h1{font:600 30px/1 ui-serif,Georgia,serif;margin:0 0 0 54px;letter-spacing:-.5px}
.cg-st{font-weight:800;font-size:16px;background:#fff;border-radius:16px;padding:6px 12px;box-shadow:0 2px 10px rgba(40,30,70,.08)}
.cg-st i{color:#f2a900;font-style:normal}
.cg-chest{margin-top:12px;background:#fff;border-radius:16px;padding:10px 12px;box-shadow:0 2px 10px rgba(40,30,70,.08);display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px}
.cg-chest .bar{flex:1;height:10px;border-radius:6px;background:#e7e0f3;overflow:hidden}.cg-chest .bar i{display:block;height:100%;background:linear-gradient(90deg,#9b7bff,#f2a900);width:0}
.cg-chest button,.cg-daily,.cg-btn{font:inherit;font-weight:800;border:0;border-radius:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cg-chest button{background:#f2a900;color:#fff;padding:8px 12px;animation:cgp 1s infinite}
.cg-daily{margin-top:10px;width:100%;text-align:left;background:linear-gradient(135deg,#7a55d6,#a47bff);color:#fff;padding:12px 14px;font-size:15px;display:flex;justify-content:space-between;align-items:center}
.cg-daily small{display:block;font-weight:600;opacity:.85;font-size:12px;margin-top:2px}
.cg-w{margin-top:18px}
.cg-w h2{font-size:13px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;display:flex;justify-content:space-between;color:var(--c)}
.cg-w h2 span{letter-spacing:1px;opacity:.7}
.cg-g{display:grid;grid-template-columns:repeat(5,1fr);gap:10px 8px}
.cg-n{position:relative;aspect-ratio:1;border-radius:50%;background:#fff;box-shadow:0 3px 10px rgba(40,30,70,.12);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px;color:#2c2540;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cg-n.lock{background:#e3deec;color:#a9a1bd;box-shadow:none;cursor:default}
.cg-n.boss{box-shadow:0 0 0 3px var(--c),0 3px 10px rgba(40,30,70,.12)}
.cg-n.hard{box-shadow:0 0 0 3px #d64545,0 3px 10px rgba(40,30,70,.12)}
.cg-n.next{background:var(--c);color:#fff;animation:cgp 1.1s infinite}
.cg-n u{text-decoration:none;position:absolute;bottom:-9px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:0;color:#f2a900;white-space:nowrap}
.cg-n u s{text-decoration:none;color:#d8d2e6}
.cg-n em{position:absolute;top:-6px;right:-3px;font-style:normal;font-size:13px}
.cg-th{margin-top:22px}.cg-th h2{font-size:13px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px}
.cg-sw{display:flex;gap:8px;flex-wrap:wrap}
.cg-sw div{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;box-shadow:0 2px 8px rgba(40,30,70,.12);cursor:pointer}
.cg-sw div.lk{background:#e3deec!important;color:#b5adc8!important;cursor:default}
.cg-sw div.on{outline:3px solid #2c2540}
.cg-card{position:fixed;inset:0;z-index:10;display:none;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:#fff;background:linear-gradient(180deg,rgba(14,16,22,.66),rgba(14,16,22,.84));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font-family:-apple-system,system-ui,sans-serif;padding:20px}
.cg-card.on{display:flex}
.cg-card h1{font:600 clamp(40px,12vw,60px)/1 ui-serif,Georgia,serif;margin:0 0 8px}
.cg-stars{font-size:54px;letter-spacing:6px;color:#4b4766;margin:6px 0 10px}
.cg-stars i{font-style:normal;display:inline-block;transition:transform .3s}.cg-stars i.on{color:#ffc933;transform:scale(1.18);text-shadow:0 0 18px rgba(255,201,51,.7)}
.cg-card p{margin:3px 0;font-size:16px;opacity:.92}
.cg-card p.near{color:#ffd36e;font-weight:800;opacity:1}
.cg-btns{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;justify-content:center}
.cg-btn{padding:13px 26px;font-size:18px;background:#fff;color:#2c2540}.cg-btn.pri{background:#7a55d6;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.3)}
.cg-btn.sm{padding:10px 18px;font-size:15px;background:rgba(255,255,255,.16);color:#fff}
.cg-cb{display:flex;gap:12px;margin:18px 0 6px}.cg-cb div{width:84px;height:96px;border-radius:18px;background:linear-gradient(160deg,#ffd36e,#e0891d);display:flex;align-items:center;justify-content:center;flex-direction:column;font-size:34px;cursor:pointer;color:#fff;font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,.35);transition:transform .25s,opacity .25s}
.cg-cb div small{font-size:12px;margin-top:4px}.cg-cb div:active{transform:scale(.94)}.cg-cb div.no{opacity:.35}.cg-cb div.pick{transform:scale(1.15)}
`);
const mapEl = document.createElement('div'); mapEl.className = 'cg-ov'; document.body.appendChild(mapEl);
const winEl = document.createElement('div'); winEl.className = 'cg-card'; document.body.appendChild(winEl);
const chestEl = document.createElement('div'); chestEl.className = 'cg-card'; document.body.appendChild(chestEl);
const starStr = (k) => [1, 2, 3].map(i => i <= k ? STAR : `<s>${STAR}</s>`).join('');

function showMap() {
  if (P.D.isDaily) { const u = new URL(location.href); u.searchParams.delete('daily'); location.href = u.href; return; }
  P.state = 'ready'; P.ui.hideStart(); winEl.classList.remove('on');
  const d = dst(), fr = frontier(), tot = starsTotal(), m = meter(), ready = chestsReady(), have = owned();
  const dailyDone = SK.get('daily_' + todayN(), null);
  let h = `<div class="cg-wrap"><div class="cg-h"><h1>Cagewise</h1><div class="cg-st"><i>${STAR}</i> ${tot}/${NL * 3}</div></div>`;
  h += `<div class="cg-chest"><span>🎁</span><div class="bar"><i style="width:${((m % CHEST_AT) / CHEST_AT) * 100}%"></i></div>${ready > 0 ? '<button data-chest>OPEN</button>' : `<span>${CHEST_AT - (m % CHEST_AT)} ${STAR} to go</span>`}</div>`;
  h += `<button class="cg-daily" data-daily><span>Daily puzzle${dailyDone ? ' ✓' : ''}<small>${P.D.streak > 1 ? `day ${P.D.streak} streak · ` : ''}${dailyDone ? 'solved today, a new one tomorrow' : 'same 5×5 for everyone today'}</small></span><span>›</span></button>`;
  WORLDS.forEach((w, wi) => {
    const ws = Array.from({ length: 10 }, (_, k) => d[wi * 10 + k + 1] || 0).reduce((a, b) => a + b, 0);
    h += `<div class="cg-w" style="--c:${w.col}"><h2><b>${wi + 1} · ${w.name}</b><span>${ws}/30 ${STAR}</span></h2><div class="cg-g">`;
    for (let k = 1; k <= 10; k++) {
      const l = wi * 10 + k, L = LEVELS[l - 1], st = d[l] || 0, lock = l > fr;
      h += `<div class="cg-n ${lock ? 'lock' : ''} ${l === fr ? 'next' : ''} ${L.boss ? 'boss' : L.hard ? 'hard' : ''}" data-l="${l}">${lock ? '🔒' : l}${L.boss ? '<em>👑</em>' : L.hard ? '<em>🔥</em>' : ''}${!lock && st ? `<u>${starStr(st)}</u>` : ''}</div>`;
    }
    h += '</div></div>';
  });
  if (fr > NL) h += `<div class="cg-w"><h2><b>Endless</b><span>everything unlocked</span></h2><div class="cg-g"><div class="cg-n next" data-l="${Math.max(fr, NL + 1)}">∞</div></div></div>`;
  h += `<div class="cg-th"><h2>Board themes · ${have.length}/${THEMES.length}</h2><div class="cg-sw">${THEMES.map(t => `<div data-th="${t.id}" class="${have.includes(t.id) ? '' : 'lk'} ${T.id === t.id ? 'on' : ''}" style="background:${t.sel};color:${t.val}">${have.includes(t.id) ? (t.rare ? STAR : '1') : '?'}</div>`).join('')}</div></div></div>`;
  mapEl.innerHTML = h; mapEl.classList.add('on'); mapEl.scrollTop = 0;
  const nx = mapEl.querySelector('.cg-n.next'); if (nx && fr > 12) nx.scrollIntoView({ block: 'center' });
}
mapEl.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('[data-l],[data-daily],[data-chest],[data-th]'); if (!t) return;
  if (t.dataset.l) { const l = +t.dataset.l; if (l > Math.max(frontier(), 1)) { soft.err(); return; } startLevel(l); }
  else if ('daily' in t.dataset) { const u = new URL(location.href); u.searchParams.set('daily', '1'); location.href = u.href; }
  else if ('chest' in t.dataset) openChest();
  else if (t.dataset.th) { const id = t.dataset.th; if (owned().includes(id)) { setTheme(id); showMap(); soft.click(); } }
});
function setTheme(id) { T = THEMES.find(t => t.id === id) || THEMES[0]; SK.set('theme', T.id); pad.style.setProperty('--pad', T.pad); }
function startLevel(l) {
  mapEl.classList.remove('on'); winEl.classList.remove('on'); chestEl.classList.remove('on');
  P.setLevel(l); P.rebuild(); P.state = 'play'; P.ui.hideStart(); soft.click();
  if (cur && cur.L && cur.L.boss) P.ui.pop('BOSS', '#d6558a', 40, 16);
}

function winCard(r) {
  const L = cur.L, par = cur.par, t = r.t, bad = slips + r.hintsUsed;
  const stars = Math.max(1, 3 - (bad > 0 ? 1 : 0) - (t > par ? 1 : 0));
  const d = dst(), bt = dbt(), before = d[curLevel] || 0, newStars = Math.max(0, stars - before);
  if (stars > before) { d[curLevel] = stars; SK.set('dst', d); }
  if (!bt[curLevel] || t < bt[curLevel]) { bt[curLevel] = t; SK.set('dbt', bt); }
  const cleared = d, ready = chestsReady();
  let near = '';
  if (stars < 3) {
    const causes = []; if (bad > 0) causes.push(`${bad} slip${bad > 1 ? 's' : ''}`); if (t > par) causes.push(`${t - par}s over par`);
    near = causes.length === 1 ? `SO CLOSE: ${causes[0]} cost you a star` : `3 stars need no slips and under ${fmtTime(par)}`;
  }
  const next = curLevel + 1;
  const title = stars === 3 ? (bad === 0 && bestChain >= 3 ? 'Flawless!' : 'Caged!') : stars === 2 ? 'Neat!' : 'Solved';
  winEl.innerHTML = `<h1>${title}</h1><div class="cg-stars">${[1, 2, 3].map(i => `<i>${STAR}</i>`).join('')}</div>
    <p>${fmtTime(t)} · par ${fmtTime(par)}${bt[curLevel] === t && t < (r.prev || 1e9) ? ' · new best' : ''}</p>
    <p>${bad ? `${slips} slip${slips === 1 ? '' : 's'}${r.hintsUsed ? ` · ${r.hintsUsed} hint${r.hintsUsed > 1 ? 's' : ''}` : ''}` : 'no slips'}${bestChain >= 3 ? ` · best chain x${bestChain}` : ''}${goldDone ? ' · gold cage' : ''}</p>
    ${near ? `<p class="near">${near}</p>` : ''}
    <p style="margin-top:10px;opacity:.75">${ready > 0 ? '🎁 A chest is ready on the map' : `🎁 ${CHEST_AT - (meter() % CHEST_AT)} stars to the next chest`}</p>
    <p style="opacity:.75">${tomorrowLine(next)}</p>
    <div class="cg-btns"><button class="cg-btn pri" data-go="next">${next > NL && !cur.endless ? 'Endless ∞' : 'Next level'}</button>${stars < 3 ? `<button class="cg-btn" data-go="retry">${STAR}${STAR}${STAR} retry</button>` : ''}<button class="cg-btn sm" data-go="map">Map</button></div>`;
  winEl.classList.add('on');
  P.fx.confetti(stars * 20);
  [...winEl.querySelectorAll('.cg-stars i')].forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('on'); chime(i * 2 + 2, 74, 0.13); buzz(8); }, 350 + i * 300); });
  if (stars === 3) setTimeout(() => arp([72, 76, 79, 84, 88], 80, 0.12, 0.8), 1300);
}
function tomorrowLine(next) {
  const dd = SK.get('daily_' + todayN(), null);
  const bits = [];
  if (next <= NL) { const L = LEVELS[next - 1]; bits.push(`Next: ${L.boss ? 'BOSS ' : ''}level ${next} (${L.n}×${L.n})`); }
  if (!dd) bits.push('daily puzzle waiting'); else bits.push('tomorrow: a new daily');
  if (P.D.streak > 1) bits.push(`day ${P.D.streak} streak`);
  return bits.join(' · ');
}
winEl.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-go]'); if (!b) return; e.stopPropagation();
  const go = b.dataset.go;
  if (go === 'next') startLevel(curLevel + 1);
  else if (go === 'retry') startLevel(curLevel);
  else showMap();
});
function openChest() {
  const have = owned(), pool = THEMES.filter(t => !have.includes(t.id));
  if (!pool.length) { SK.set('chests', chestsOpened() + 1); showMap(); return; }
  const rr = rngf(Date.now() & 0xffff), opts = [];
  const bag = pool.slice(); // the rare golden theme is a 1-in-4 draw into a box
  while (opts.length < Math.min(3, pool.length)) { const i = Math.floor(rr() * bag.length); const t = bag[i]; if (t.rare && rr() > 0.4) continue; opts.push(t); bag.splice(i, 1); }
  chestEl.innerHTML = `<h1>Chest!</h1><p>Pick one</p><div class="cg-cb">${opts.map(t => `<div data-pick="${t.id}">🎁<small>tap</small></div>`).join('')}</div>`;
  chestEl.classList.add('on'); mapEl.classList.remove('on'); arp([72, 76, 79], 90, 0.1, 0.5);
  chestEl.onpointerdown = (e) => {
    const b = e.target.closest('[data-pick]'); if (!b) { if (chestEl.dataset.done) { chestEl.classList.remove('on'); delete chestEl.dataset.done; showMap(); } return; }
    if (chestEl.dataset.done) return; chestEl.dataset.done = 1;
    const id = b.dataset.pick, t = THEMES.find(x => x.id === id);
    SK.set('themes', [...have, id]); SK.set('chests', chestsOpened() + 1); setTheme(id);
    [...chestEl.querySelectorAll('[data-pick]')].forEach(el => { const th = THEMES.find(x => x.id === el.dataset.pick); el.innerHTML = `<span style="font-size:22px">${th.rare ? STAR : '▦'}</span><small>${th.name}</small>`; el.style.background = th.sel; el.style.color = th.val; el.classList.add(el === b ? 'pick' : 'no'); });
    chestEl.querySelector('p').textContent = `${t.name} board unlocked${t.rare ? ' (rare!)' : ''} · tap to continue`; P.fx.confetti(60); arp([76, 79, 83, 88], 80, 0.12, 0.8);
  };
}

if (P.D.isDaily) { /* the daily keeps the shell's start card */ } else { P.ui.hideStart(); }
P.start();
if (!P.D.isDaily) { if (starsTotal() === 0) startLevel(1); else showMap(); }
window.__cg = { go: (l) => { mapEl.classList.remove('on'); startLevel(l); }, map: showMap, get stars() { return dst(); }, levels: LEVELS };

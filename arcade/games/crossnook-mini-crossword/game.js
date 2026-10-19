// Crossnook — original 5×5 mini crossword. Grids are filled (offline, by our own filler in puzzles.js) only from words
// we wrote clues for ourselves (clues.js), so every answer has a plain, kid-friendly clue. Tap a square, type; tap it
// again (or the clue bar) to switch Across/Down. Daily mini = the same grid for everyone today.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { CLUES } from './clues.js';
import { BANK } from './puzzles.js';

const NAME = 'Crossnook: Mini Crossword';
const S = store('crossnook');
const F = flow('crossnook');
const ui = createUI({ title: 'Crossnook', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#3d6fd1' });
const D = daily('crossnook', ui, { name: NAME });
const B = board({ game: 'crossnook', label: 'Puzzles solved', limits: { maxRun: 1, maxPerSec: 0.3 }, mode: 'sum' });   // world board: minis solved today (RULES.md part C)
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily mini crossword' : '5×5 mini crossword', doneLine: doneToday ? `Solved today in ${fmtTime(doneToday.t)}` : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily mini<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'PUZZLE <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Solved!';

// ---------------------------------------------------------------- puzzle
const rngf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
function pickPuzzle() {
  // endless: walk the bank in a seeded order; every second pass uses the grid flipped on its diagonal (across ↔ down)
  let idx, flip;
  if (D.isDaily) { const r = rngf(D.seed * 3 + 1); r(); idx = Math.floor(r() * BANK.length); flip = r() < 0.5; }
  else { const n = level - 1, pass = Math.floor(n / BANK.length), r = rngf(pass * 101 + 7), order = BANK.map((_, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]); idx = order[n % BANK.length]; flip = pass % 2 === 1; }
  let rows = BANK[idx].split('/');
  if (flip) rows = rows.map((_, r) => rows.map(row => row[r]).join(''));
  return rows;
}
function parse(rows) {
  const sol = rows.join('').split(''), black = sol.map(c => c === '#'), num = new Array(25).fill(0), words = [];
  let n = 0;
  for (let i = 0; i < 25; i++) {
    if (black[i]) continue;
    const r = Math.floor(i / 5), c = i % 5;
    const ac = (c === 0 || black[i - 1]) && c < 4 && !black[i + 1], dn = (r === 0 || black[i - 5]) && r < 4 && !black[i + 5];
    if (ac || dn) num[i] = ++n;
    if (ac) { const cells = []; for (let k = c; k < 5 && !black[r * 5 + k]; k++) cells.push(r * 5 + k); words.push({ d: 0, n, cells }); }
    if (dn) { const cells = []; for (let k = r; k < 5 && !black[k * 5 + c]; k++) cells.push(k * 5 + c); words.push({ d: 1, n, cells }); }
  }
  for (const w of words) { w.ans = w.cells.map(i => sol[i]).join(''); w.clue = CLUES[w.ans] || '(no clue)'; }
  words.sort((a, b) => a.d - b.d || a.n - b.n);
  return { sol, black, num, words };
}

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#232a3b}
body{background:radial-gradient(120% 70% at 50% 0%,#fffdf8 0%,#f4efe4 60%,#ebe3d2 100%)}
body:before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(60,80,120,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(60,80,120,.05) 1px,transparent 1px);background-size:22px 22px;pointer-events:none}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#3d6fd1;box-shadow:0 2px 6px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:#fff;color:#3d6fd1}.hc-top .hc-bar{background:rgba(40,60,100,.1);height:8px}.hc-top .hc-bar i{background:#3d6fd1}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#7d8597;text-shadow:none;opacity:1}
#clock{position:fixed;z-index:6;right:12px;top:calc(60px + env(safe-area-inset-top));height:30px;display:flex;align-items:center;border-radius:16px;font-weight:800;font-size:15px;padding:0 12px;background:#fff;color:#3d6fd1;box-shadow:0 2px 8px rgba(40,60,100,.12);pointer-events:none;font-variant-numeric:tabular-nums}
#grid{position:fixed;z-index:3;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(5,1fr);gap:0;background:#232a3b;border:3px solid #232a3b;border-radius:10px;overflow:hidden;box-shadow:0 14px 34px rgba(30,40,70,.2)}
#grid .q{position:relative;min-width:0;min-height:0;line-height:1;overflow:hidden;background:#fff;border:1px solid #c9cfdb;display:flex;align-items:center;justify-content:center;font-weight:800;text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;color:#232a3b;cursor:pointer;transition:background .12s}
#grid .q.k{background:#232a3b;border-color:#232a3b;cursor:default}
#grid .q i{position:absolute;left:4px;top:2px;font-style:normal;font-size:calc(var(--cs) * .2);font-weight:700;color:#4f5870}
#grid .q.word{background:#d6e4ff}#grid .q.sel{background:#ffd75e}
#grid .q.bad{color:#d0453d}#grid .q.bad:after{content:'';position:absolute;left:12%;right:12%;top:50%;height:2px;background:#d0453d;transform:rotate(-30deg)}
#grid .q.rev{color:#3d6fd1}
#grid .q.pop span{animation:pop .2s ease-out}
#grid.win .q:not(.k){animation:wave .6s ease both;background:#c9f0d6}
@keyframes pop{0%{transform:scale(.5)}100%{transform:scale(1)}}
@keyframes wave{40%{transform:scale(1.12)}}
#clue{position:fixed;z-index:4;left:12px;right:12px;min-height:56px;display:flex;align-items:center;gap:6px;background:#d6e4ff;border-radius:14px;padding:6px 6px;cursor:pointer;box-shadow:0 4px 12px rgba(40,60,100,.1)}
#clue .t{flex:1;font-weight:650;font-size:17px;line-height:1.25;text-align:center}
#clue .t b{color:#3d6fd1;margin-right:6px}
#clue button{width:40px;height:44px;border:0;border-radius:10px;background:rgba(255,255,255,.6);font-size:18px;font-weight:800;color:#3d6fd1;cursor:pointer;flex:none}
#tools{position:fixed;z-index:4;left:0;right:0;display:flex;justify-content:center;gap:10px}
#tools button{height:36px;border-radius:18px;border:1.5px solid #cfd6e4;background:#fff;font:inherit;font-weight:800;font-size:14px;color:#4f5870;padding:0 16px;cursor:pointer}
#kb{position:fixed;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 6px}
#kb .kr{display:flex;gap:5px;width:100%;max-width:520px;justify-content:center}
#kb button{flex:1;max-width:46px;height:var(--kh);border:0;border-radius:9px;background:#fff;color:#232a3b;font-weight:800;font-size:18px;text-transform:uppercase;box-shadow:0 3px 0 #d3cbb9,0 4px 10px rgba(80,60,30,.08);cursor:pointer;padding:0;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
#kb button.wide{max-width:66px;flex:1.5}
#kb button:active{transform:translateY(2px);box-shadow:0 1px 0 #d3cbb9}
#kb svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(24,34,64,.74),rgba(18,26,50,.88))}
`);
const gridEl = document.createElement('div'); gridEl.id = 'grid'; document.body.appendChild(gridEl);
const clueEl = document.createElement('div'); clueEl.id = 'clue'; clueEl.innerHTML = '<button data-p>‹</button><div class="t"></div><button data-n>›</button>'; document.body.appendChild(clueEl);
const toolsEl = document.createElement('div'); toolsEl.id = 'tools'; document.body.appendChild(toolsEl);
const kb = document.createElement('div'); kb.id = 'kb'; document.body.appendChild(kb);
const clockEl = document.createElement('div'); clockEl.id = 'clock'; document.body.appendChild(clockEl);
const cellEls = Array.from({ length: 25 }, (_, i) => { const d = document.createElement('div'); d.className = 'q'; d.innerHTML = '<i></i><span></span>'; d.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tapCell(i); }); gridEl.appendChild(d); return d; });
const eat = (el, fn) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(e); });
eat(clueEl.querySelector('[data-p]'), () => jump(-1)); eat(clueEl.querySelector('[data-n]'), () => jump(1));
eat(clueEl.querySelector('.t'), () => { if (state === 'play') { dir = 1 - dir; if (!wordAt(sel, dir)) dir = 1 - dir; paint(); soft.click(); } });
const tool = (label, fn) => { const b = document.createElement('button'); b.textContent = label; eat(b, fn); toolsEl.appendChild(b); };
tool('Check word', () => check(false)); tool('Check all', () => check(true)); tool('Reveal letter', () => reveal());
for (const r of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm<']) {
  const d = document.createElement('div'); d.className = 'kr';
  for (const ch of r) {
    const b = document.createElement('button');
    if (ch === '<') { b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6"/></svg>'; b.className = 'wide'; b.setAttribute('aria-label', 'Delete'); }
    else b.textContent = ch;
    eat(b, () => (ch === '<' ? back() : put(ch)));
    d.appendChild(b);
  }
  kb.appendChild(d);
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || state !== 'play') return;
  if (e.key === 'Backspace') back(); else if (/^[a-zA-Z]$/.test(e.key)) put(e.key.toLowerCase());
  else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); jump(e.shiftKey ? -1 : 1); }
  else if (e.key === ' ') { e.preventDefault(); dir = 1 - dir; if (!wordAt(sel, dir)) dir = 1 - dir; paint(); }
  else if (e.key.startsWith('Arrow')) { const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -5, ArrowDown: 5 }[e.key]; const nd = Math.abs(d) === 1 ? 0 : 1; if (nd !== dir) { dir = nd; } else { let j = sel + d; while (j >= 0 && j < 25 && P.black[j] && Math.abs((j % 5) - (sel % 5)) <= 4) j += d; if (j >= 0 && j < 25 && !P.black[j] && (Math.abs(d) === 5 || Math.floor(j / 5) === Math.floor(sel / 5))) sel = j; } paint(); }
});

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), P = null, fill = [], sel = 0, dir = 0, t0 = 0, elapsed = 0, reveals = 0, recorded = false, beatenShown = false, marks = new Set(), revd = new Set();

function build() {
  P = parse(pickPuzzle());
  fill = new Array(25).fill(''); marks = new Set(); revd = new Set(); reveals = 0; recorded = false; beatenShown = false; elapsed = 0;
  sel = P.words[0].cells[0]; dir = 0;
  cellEls.forEach((el, i) => { el.className = 'q' + (P.black[i] ? ' k' : ''); el.querySelector('i').textContent = P.num[i] || ''; el.querySelector('span').textContent = ''; });
  gridEl.className = '';
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const d = new Date();
  ui.sub(D.isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `Puzzle #${level}`);
  layout(); paint();
}
function layout() {
  const W = innerWidth, H = innerHeight;
  const kh = Math.max(44, Math.min(54, H * 0.062)); kb.style.setProperty('--kh', kh + 'px');
  const kbH = kh * 3 + 16, pad = Math.max(14, H * 0.02); kb.style.bottom = `calc(${pad}px + env(safe-area-inset-bottom))`;
  const kbTop = H - pad - kbH;
  const toolsY = kbTop - 14 - 36; toolsEl.style.top = toolsY + 'px';
  const clueY = toolsY - 12 - 58; clueEl.style.top = clueY + 'px';
  const top = 104, gs = Math.floor(Math.min(W - 40, 380, clueY - 16 - top) / 5) * 5 + 6;
  Object.assign(gridEl.style, { left: (W - gs) / 2 + 'px', top: top + Math.max(0, (clueY - 16 - top - gs) / 2) + 'px', width: gs + 'px', height: gs + 'px' });
  const cs = (gs - 6) / 5; gridEl.style.setProperty('--cs', cs + 'px'); cellEls.forEach(el => (el.style.fontSize = cs * 0.58 + 'px'));
  clueEl.style.maxWidth = '560px'; clueEl.style.margin = '0 auto';
}
addEventListener('resize', () => P && layout());
const wordAt = (i, d) => P.words.find(w => w.d === d && w.cells.includes(i));
function paint() {
  const w = wordAt(sel, dir) || wordAt(sel, 1 - dir); if (w && w.d !== dir) dir = w.d;
  cellEls.forEach((el, i) => {
    if (P.black[i]) return;
    el.classList.toggle('sel', i === sel); el.classList.toggle('word', !!w && w.cells.includes(i) && i !== sel);
    el.classList.toggle('bad', marks.has(i)); el.classList.toggle('rev', revd.has(i));
    const sp = el.querySelector('span'); if (sp.textContent !== fill[i]) sp.textContent = fill[i];
  });
  if (w) clueEl.querySelector('.t').innerHTML = `<b>${w.n}${w.d ? 'D' : 'A'}</b>${w.clue}`;
  const filled = P.sol.filter((c, i) => !P.black[i] && fill[i]).length, total = P.sol.filter(c => c !== '#').length;
  ui.progress(filled / total);
}
function tapCell(i) {
  if (state !== 'play' || P.black[i]) return;
  if (i === sel) { if (wordAt(i, 1 - dir)) dir = 1 - dir; }
  else { sel = i; if (!wordAt(i, dir)) dir = 1 - dir; }
  soft.click(); paint();
}
function nextEmptyIn(w, from) { const k = w.cells.indexOf(from); for (let j = k + 1; j < w.cells.length; j++) if (!fill[w.cells[j]]) return w.cells[j]; for (let j = 0; j < k; j++) if (!fill[w.cells[j]]) return w.cells[j]; return -1; }
function jump(step) {
  if (state !== 'play') return;
  const cur = wordAt(sel, dir), k = P.words.indexOf(cur);
  for (let t = 1; t <= P.words.length; t++) {
    const w = P.words[(k + step * t + P.words.length * 2) % P.words.length];
    const e = w.cells.find(i => !fill[i]);
    if (e !== undefined || t === P.words.length) { dir = w.d; sel = e !== undefined ? e : w.cells[0]; break; }
  }
  soft.click(); paint();
}
function put(ch) {
  if (state !== 'play') return;
  fill[sel] = ch; marks.delete(sel); chime(Math.floor(Math.random() * 5), 69, 0.07); buzz(4);
  const el = cellEls[sel]; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  if (solvedCheck()) return;
  const w = wordAt(sel, dir), n = nextEmptyIn(w, sel);
  if (n >= 0 && w.cells.indexOf(n) > w.cells.indexOf(sel)) sel = n;
  else if (w.cells.indexOf(sel) < w.cells.length - 1 && n < 0) sel = w.cells[w.cells.indexOf(sel) + 1];
  else { paint(); return jump(1); }
  paint();
}
function back() {
  if (state !== 'play') return;
  if (fill[sel] && !revd.has(sel)) { fill[sel] = ''; marks.delete(sel); }
  else { const w = wordAt(sel, dir), k = w.cells.indexOf(sel); if (k > 0) { sel = w.cells[k - 1]; if (!revd.has(sel)) { fill[sel] = ''; marks.delete(sel); } } }
  soft.click(); paint();
}
function check(all) {
  if (state !== 'play') return;
  const cells = all ? P.sol.map((_, i) => i).filter(i => !P.black[i]) : wordAt(sel, dir).cells;
  let wrong = 0; for (const i of cells) if (fill[i] && fill[i] !== P.sol[i]) { marks.add(i); wrong++; }
  if (wrong) { soft.err(); ui.pop(`${wrong} to fix`, '#d0453d', 24, 13); } else { chime(3, 72, 0.1); ui.pop('All good so far', '#3d6fd1', 22, 13); }
  paint();
}
function reveal() {
  if (state !== 'play') return;
  if (fill[sel] === P.sol[sel]) return jump(1);
  fill[sel] = P.sol[sel]; revd.add(sel); marks.delete(sel); reveals++; soft.click(); paint(); solvedCheck();
}
function solvedCheck() {
  const full = P.sol.every((c, i) => P.black[i] || fill[i]);
  if (!full) return false;
  if (P.sol.every((c, i) => P.black[i] || fill[i] === c)) { win(); return true; }
  ui.pop('Almost! Something is off', '#d0453d', 22, 13); soft.err(); return false;
}
function win() {
  state = 'won'; paint();
  const secs = Math.round(elapsed);
  if (!recorded) { recorded = true; B.submit(1); if (!D.isDaily) F.level(true); }
  const pts = Math.max(10, 100 + Math.max(0, 300 - secs) - reveals * 20);
  gridEl.className = 'win'; cellEls.forEach((el, i) => (el.style.animationDelay = ((i % 5) + Math.floor(i / 5)) * 50 + 'ms'));
  arp([67, 72, 76, 79, 84], 90, 0.12, 0.8); fx.confetti(); buzz([20, 40, 20]);
  if (!beatenShown && D.beaten(pts)) { beatenShown = true; setTimeout(() => ui.pop('BEATEN!', '#3d6fd1', 40, 13), 400); }
  D.won(pts, `solved ${D.isDaily ? "today's mini crossword" : `mini #${level}`} in ${fmtTime(secs)}${reveals ? ` (${reveals} reveal${reveals > 1 ? 's' : ''})` : ''} for`);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || secs < prev.t) S.set(k, { t: secs }); }
  else { level++; S.set('level', level); }
  setTimeout(() => ui.win(D.isDaily ? '' : level - 1, `${fmtTime(secs)}${reveals ? ` · ${reveals} reveal${reveals > 1 ? 's' : ''}` : ' · no help'} · ${pts} pts`), 600);
}
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000); lastT = t;
  if (state === 'play' && document.visibilityState === 'visible') elapsed += dt;
  const s = fmtTime(Math.floor(elapsed)); if (clockEl.textContent !== '⏱ ' + s) clockEl.textContent = '⏱ ' + s;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui.onTap((which) => {
  B.start(); lastT = performance.now();
  if (which === 'start') { state = 'play'; return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot types the next missing letter of the
// current word every ~0.25 s (it reads the solution, like someone who knows every answer)
let botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return S.get('level', 1) - 1; },
  bot() {
    if (state !== 'play' || (botTick++ % 2)) return;
    if (fill[sel]) { const e = P.sol.findIndex((c, i) => !P.black[i] && !fill[i]); if (e < 0) return; sel = e; if (!wordAt(e, dir)) dir = 1 - dir; }
    put(P.sol[sel]);
  },
};

// Tenpair — original digit-pairs puzzle. Cross out two digits that are equal or add up to 10 when they touch
// (side, above/below, diagonal, or end-of-row to start-of-next) with only crossed-out cells between them.
// Boards are built backwards from nested pairs, so every stage can be cleared without the + button.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Tenpair: Digit Pairs Puzzle', COLS = 9;
const S = store('tenpair');
const F = flow('tenpair');
const ui = createUI({ title: 'Tenpair', hint: 'Tap to start', hand: '', score: false });
cardTheme({ accent: '#4f6bed' });
const D = daily('tenpair', ui, { name: NAME });
const WB = board({ game: 'tenpair', label: 'Boards cleared', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum', corner: 'bl' });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily board' : 'pairs · sums of ten', doneLine: doneToday ? (D.isDaily ? `Cleared today · ${doneToday.s.toLocaleString()} pts` : 'Daily board cleared ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily board<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Board clear!';
{ // a small rules line on the start card
  const p = document.createElement('p'); p.className = 'tp-rules';
  p.innerHTML = '<b>7·7</b> equal &nbsp;or&nbsp; <b>3·7</b> makes ten<br>touching, or with only crossed-out cells between';
  ui.els.start.querySelector('.hint').before(p);
}

css(`
body{background:linear-gradient(180deg,#f7f5f0,#ecebf6);color:#1f2540}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:800;color:#fff;background:#4f6bed;box-shadow:none}
.hc-top .hc-lvl.next{background:#e2e5f3;color:#4f6bed}
.hc-top .hc-bar{background:#e2e5f3;height:8px}.hc-top .hc-bar i{background:linear-gradient(90deg,#6f8af7,#4f6bed)}
.hc-pop{color:#4f6bed}
.tp-rules{font-size:15px!important;line-height:1.5;margin-top:22px!important;opacity:.85!important}
.tp-rules b{display:inline-block;background:rgba(255,255,255,.16);border-radius:7px;padding:0 7px;letter-spacing:2px}
#hdr{position:fixed;left:0;right:0;z-index:5;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;padding:0 18px;pointer-events:none}
#hdr .k{font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:#8a90a8}
#hdr .v{font-size:19px;font-weight:800;color:#1f2540;font-variant-numeric:tabular-nums}
#hdr .mid{text-align:center}#hdr .mid .v{font-size:34px;line-height:1;letter-spacing:-.5px}
#hdr .rt{text-align:right}
#wrap{position:fixed;left:50%;transform:translateX(-50%);overflow-y:auto;overflow-x:hidden;touch-action:pan-y;z-index:3;border-radius:18px;background:#fff;
 box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 10px 30px rgba(52,60,110,.12),0 2px 6px rgba(52,60,110,.08);scrollbar-width:none}
#wrap::-webkit-scrollbar{display:none}
#grid{position:relative;background-image:linear-gradient(#edf0f6 1px,transparent 1px),linear-gradient(90deg,#edf0f6 1px,transparent 1px);background-size:var(--cs) var(--cs);background-position:-1px -1px}
.c{position:absolute;left:0;top:0;width:var(--cs);height:var(--cs);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(var(--cs)*.56);
 font-family:-apple-system,'SF Pro Rounded','SF Pro Display',system-ui,sans-serif;color:#1f2540;font-variant-numeric:tabular-nums;cursor:pointer;
 transition:transform .32s cubic-bezier(.3,1.2,.4,1),color .25s,opacity .3s}
.c i{position:absolute;inset:3px;border-radius:9px;background:transparent;transition:background .15s,box-shadow .15s;z-index:-1}
.c.sel i{background:#dfe6ff;box-shadow:0 0 0 2px #4f6bed inset}
.c.sel{color:#3049c9}
.c.hint i{animation:hintp .8s ease-in-out 3}
@keyframes hintp{50%{background:#ffe9a8;box-shadow:0 0 0 2px #f2b632 inset}}
.c.ok i{animation:okp .45s ease-out}
@keyframes okp{0%{background:#c9f1dc;box-shadow:0 0 0 2px #3fbf86 inset}100%{background:transparent}}
.c.x{color:#d3d7e2;cursor:default}
.c.bad{animation:shk .3s}
@keyframes shk{25%{margin-left:-4px}50%{margin-left:4px}75%{margin-left:-2px}}
.c.new{animation:pin .38s cubic-bezier(.3,1.5,.5,1) both}
@keyframes pin{0%{opacity:0;scale:.3}100%{opacity:1;scale:1}}
.c.out{opacity:0;scale:1 .1;transition:opacity .3s,scale .3s}
.ln{position:absolute;height:6px;border-radius:3px;background:linear-gradient(90deg,#7fd6b0,#4f6bed);transform-origin:0 50%;pointer-events:none;opacity:.85;animation:lnf .5s ease-out forwards;z-index:2}
@keyframes lnf{0%{opacity:.9}100%{opacity:0}}
#bar{position:fixed;left:0;right:0;z-index:5;display:flex;justify-content:center;gap:34px}
.tb{position:relative;width:62px;height:62px;border-radius:50%;border:0;background:#fff;color:#4f6bed;font:inherit;font-size:34px;font-weight:600;line-height:1;cursor:pointer;
 box-shadow:0 6px 18px rgba(52,60,110,.16),0 2px 0 #e2e5f3;display:flex;align-items:center;justify-content:center;transition:transform .15s}
.tb:active{transform:scale(.92)}
.tb svg{width:28px;height:28px}
.tb b{position:absolute;right:-4px;top:-4px;min-width:24px;height:24px;border-radius:12px;background:#4f6bed;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 6px;border:2px solid #fff}
.tb.off{opacity:.4}
.tb.nudge{animation:ndg 1s ease-in-out infinite}
@keyframes ndg{50%{transform:scale(1.12);box-shadow:0 0 0 8px rgba(79,107,237,.18),0 6px 18px rgba(52,60,110,.16)}}
#msg{position:fixed;left:0;right:0;z-index:5;text-align:center;font-size:14px;font-weight:600;color:#8a90a8;pointer-events:none;transition:opacity .3s}
`);

const hdr = document.createElement('div'); hdr.id = 'hdr';
hdr.innerHTML = '<div><div class="k" data-sl>Stage</div><div class="v" data-st>1</div></div><div class="mid"><div class="v" data-sc>0</div></div><div class="rt"><div class="k">Best</div><div class="v" data-bs>0</div></div>';
document.body.appendChild(hdr);
const wrap = document.createElement('div'); wrap.id = 'wrap'; const grid = document.createElement('div'); grid.id = 'grid'; wrap.appendChild(grid); document.body.appendChild(wrap);
const bar = document.createElement('div'); bar.id = 'bar';
bar.innerHTML = `<button class="tb" data-add>+<b>4</b></button><button class="tb" data-hint><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg><b>3</b></button>`;
document.body.appendChild(bar);
const msg = document.createElement('div'); msg.id = 'msg'; document.body.appendChild(msg);
const addBtn = bar.querySelector('[data-add]'), hintBtn = bar.querySelector('[data-hint]');
for (const b of [addBtn, hintBtn]) b.addEventListener('pointerdown', e => e.stopPropagation());
addBtn.addEventListener('click', () => addRows());
hintBtn.addEventListener('click', () => hint());

// ---------------------------------------------------------------- rng + board builder
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** nested pair insertion: each new pair goes in side by side (reading order) at a random spot. Undoing in reverse order
 *  always works, because anything that ends up between a pair's two halves was inserted later (and so cleared first). */
function build(seed, n) {
  const r = rngf(seed), seq = [], pairs = [];
  let id = 0;
  for (let p = 0; p < n / 2; p++) {
    const a = 1 + Math.floor(r() * 9), b = r() < 0.5 ? a : 10 - a;
    // bias insertion away from the very ends so pairs interleave
    const at = Math.floor(r() * (seq.length + 1));
    const A = { id: id++, d: a }, B = { id: id++, d: b };
    seq.splice(at, 0, A, B); pairs.push([A.id, B.id]);
  }
  // scramble the look: swap halves of some pairs (order inside a pair does not matter)
  for (const [x, y] of pairs) if (r() < 0.5) { const i = seq.findIndex(c => c.id === x), j = seq.findIndex(c => c.id === y); [seq[i].d, seq[j].d] = [seq[j].d, seq[i].d]; }
  return { seq, plan: pairs.reverse() };
}

// ---------------------------------------------------------------- model
let state = 'ready', level = S.get('level', 1), score = 0, best = S.get('best', 0), cells = [], adds = 4, hints = 3, sel = -1, combo = 0, lastT = 0,
  recorded = false, beatenShown = false, plan = [], total = 0, crossed = 0, cs = 40, nextId = 0;
const fit = (a, b) => a === b || a + b === 10;
const live = (i) => i >= 0 && i < cells.length && !cells[i].x;
function link(i, j) {           // can cells i < j be paired (path-wise)?
  if (i > j) [i, j] = [j, i];
  let ok = true; for (let k = i + 1; k < j; k++) if (!cells[k].x) { ok = false; break; }
  if (ok) return 'flat';
  const ri = Math.floor(i / COLS), ci = i % COLS, rj = Math.floor(j / COLS), cj = j % COLS, dr = rj - ri, dc = cj - ci;
  if (dr <= 0) return null;
  let step = 0;
  if (dc === 0) step = COLS; else if (dc === dr) step = COLS + 1; else if (dc === -dr) step = COLS - 1; else return null;
  for (let k = i + step; k < j; k += step) if (!cells[k].x) return null;
  return 'line';
}
function moves(limit = 999) {
  const out = [];
  for (let i = 0; i < cells.length && out.length < limit; i++) {
    if (cells[i].x) continue;
    const ri = Math.floor(i / COLS), ci = i % COLS;
    // reading order (covers side-by-side and row wrap)
    for (let k = i + 1; k < cells.length; k++) if (!cells[k].x) { if (fit(cells[i].d, cells[k].d)) out.push([i, k]); break; }
    for (const [step, dcol] of [[COLS, 0], [COLS + 1, 1], [COLS - 1, -1]]) {
      for (let k = i + step, t = 1; k < cells.length; k += step, t++) {
        if ((ci + dcol * t) < 0 || (ci + dcol * t) >= COLS) break;
        if (!cells[k].x) { if (fit(cells[i].d, cells[k].d) && !out.some(m => m[0] === i && m[1] === k)) out.push([i, k]); break; }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- view
const rows = () => Math.ceil(cells.length / COLS);
const pos = (i) => [(i % COLS) * cs, Math.floor(i / COLS) * cs];
function layout() {
  const W = innerWidth, H = innerHeight;
  const gw = Math.min(W - 24, 480); cs = Math.floor(gw / COLS); const w = cs * COLS;
  const top = 108, bottom = 150;
  const vis = Math.max(6, Math.floor((H - top - bottom - 14) / cs));
  wrap.style.top = top + 'px'; wrap.style.width = w + 'px'; wrap.style.height = vis * cs + 'px';
  grid.style.setProperty('--cs', cs + 'px'); grid.style.height = Math.max(vis, rows() + 1) * cs + 'px';
  hdr.style.top = '52px';
  bar.style.top = (top + vis * cs + Math.max(18, (H - top - vis * cs - 62) / 2 - 10)) + 'px';
  msg.style.top = (top + vis * cs + 6) + 'px';
  cells.forEach((c, i) => place(c, i));
}
addEventListener('resize', layout);
function place(c, i) { if (!c.el) return; const [x, y] = pos(i); c.el.style.transform = `translate(${x}px,${y}px)`; }
function mk(c, i, delay = 0) {
  const e = document.createElement('div'); e.className = 'c new'; e.innerHTML = `<i></i>${c.d}`; e.style.animationDelay = delay + 'ms';
  c.el = e; grid.appendChild(e); place(c, i);
  e.addEventListener('click', () => tap(cells.indexOf(c)));
  return e;
}
function refresh() {
  hdr.querySelector('[data-st]').textContent = D.isDaily ? '★' : level; hdr.querySelector('[data-sl]').textContent = D.isDaily ? 'Daily' : 'Stage';
  hdr.querySelector('[data-sc]').textContent = score.toLocaleString(); hdr.querySelector('[data-bs]').textContent = Math.max(best, score).toLocaleString();
  addBtn.querySelector('b').textContent = adds; addBtn.classList.toggle('off', !adds);
  hintBtn.querySelector('b').textContent = hints; hintBtn.classList.toggle('off', !hints);
  ui.progress(total ? crossed / total : 0);
}
const center = (i) => { const b = cells[i].el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };

// ---------------------------------------------------------------- stage
function stage() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 6 : level;
  let n = D.isDaily ? 62 : Math.round((24 + Math.min(L - 1, 8) * 8 + Math.max(0, L - 9) * 2) * fk / 2) * 2;
  n = Math.max(16, Math.min(n % COLS === 0 ? n + 2 : n, 96));
  adds = D.isDaily ? 4 : Math.max(2, Math.min(6, Math.round((L <= 2 ? 5 : 4) / fk)));
  hints = 3;
  const seed = D.seed || level * 15485863 + 7;
  const b = build(seed, n);
  grid.innerHTML = ''; cells = b.seq.map(c => ({ ...c, x: false })); nextId = n; plan = b.plan;
  score = 0; sel = -1; combo = 0; recorded = false; beatenShown = false; total = n; crossed = 0;
  layout(); cells.forEach((c, i) => mk(c, i, i * 12)); wrap.scrollTop = 0;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  say(''); refresh();
}
let sayT;
function say(t) { msg.textContent = t; msg.style.opacity = t ? 1 : 0; clearTimeout(sayT); if (t) sayT = setTimeout(() => msg.style.opacity = 0, 2600); }

function tap(i) {
  if (state !== 'play' || !live(i)) return;
  idle = 0; clearHints();
  if (sel === i) { cells[i].el.classList.remove('sel'); sel = -1; soft.click(); return; }
  if (sel < 0) { sel = i; cells[i].el.classList.add('sel'); soft.click(); buzz(5); return; }
  const a = sel, A = cells[a], B = cells[i];
  if (fit(A.d, B.d) && link(a, i)) return pair(a, i);
  // not a pair: shake both, keep the new one selected
  A.el.classList.remove('sel'); for (const c of [A, B]) { c.el.classList.remove('bad'); void c.el.offsetWidth; c.el.classList.add('bad'); }
  soft.err(); buzz(18); combo = 0;
  sel = i; B.el.classList.add('sel');
  if (!fit(A.d, B.d)) say(`${A.d} and ${B.d} are not equal and don't make 10`);
  else say('Those two are blocked — only crossed-out cells may sit between');
}
function pair(a, b) {
  const A = cells[a], B = cells[b];
  sel = -1; A.el.classList.remove('sel'); B.el.classList.remove('sel');
  A.x = B.x = true; crossed += 2;
  const now = performance.now(); combo = now - lastT < 2600 ? combo + 1 : 1; lastT = now;
  const far = Math.abs(b - a) > 1 && !(Math.abs(b - a) === COLS) ? 1 : 0;
  const pts = 10 * Math.min(combo, 8) + far * 5; score += pts;
  for (const c of [A, B]) { c.el.classList.add('x', 'ok'); }
  // connecting stroke
  const [x1, y1] = pos(a), [x2, y2] = pos(b), ln = document.createElement('div'); ln.className = 'ln';
  const dx = x2 - x1, dy = y2 - y1; ln.style.left = x1 + cs / 2 + 'px'; ln.style.top = y1 + cs / 2 - 3 + 'px'; ln.style.width = Math.hypot(dx, dy) + 'px'; ln.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  grid.appendChild(ln); setTimeout(() => ln.remove(), 520);
  const [p1, q1] = center(a), [p2, q2] = center(b);
  fx.sparks(p1, q1, ['#4f6bed', '#7fd6b0', '#ffd166'], 7 + Math.min(combo, 6), { speed: 2.4 + combo * 0.2, size: 3 });
  fx.sparks(p2, q2, ['#4f6bed', '#7fd6b0', '#ffd166'], 7 + Math.min(combo, 6), { speed: 2.4 + combo * 0.2, size: 3 });
  chime(combo - 1, 69, 0.12); buzz(8);
  if (combo >= 3) ui.pop(`COMBO ×${combo}`, '#4f6bed', 22 + Math.min(combo, 8) * 2, 76);
  setTimeout(() => collapse(), 260);
  checkBeat(); refresh();
  if (cells.every(c => c.x)) return;   // collapse() will finish the stage
  afterMove();
}
function collapse() {
  const dead = [];
  for (let r = rows() - 1; r >= 0; r--) {
    const lo = r * COLS, hi = Math.min(cells.length, lo + COLS);
    let all = true; for (let k = lo; k < hi; k++) if (!cells[k].x) { all = false; break; }
    if (all) dead.push(r);
  }
  if (!dead.length) return finishCheck();
  let gone = [];
  for (const r of dead) gone = gone.concat(cells.splice(r * COLS, COLS));
  gone.forEach(c => { c.el.classList.add('out'); setTimeout(() => c.el.remove(), 320); });
  const bonus = 40 * dead.length * dead.length; score += bonus;
  const wb = wrap.getBoundingClientRect();
  fx.ring(wb.left + wb.width / 2, wb.top + Math.min(wb.height - 20, (dead[dead.length - 1] + 0.5) * cs - wrap.scrollTop), '#4f6bed', 80);
  fx.sparks(wb.left + wb.width / 2, wb.top + Math.min(wb.height - 20, (dead[dead.length - 1] + 0.5) * cs - wrap.scrollTop), ['#4f6bed', '#ffd166', '#7fd6b0', '#fff'], 22, { speed: 5, size: 4 });
  ui.pop(dead.length > 1 ? `${dead.length} ROWS +${bonus}` : `ROW +${bonus}`, '#3fbf86', 30, 76);
  arp([76, 79, 84], 60, 0.1, 0.5); buzz([10, 30, 10]);
  setTimeout(() => { cells.forEach((c, i) => place(c, i)); grid.style.height = Math.max(Math.floor(wrap.clientHeight / cs), rows() + 1) * cs + 'px'; }, 120);
  checkBeat(); refresh(); finishCheck();
}
function finishCheck() {
  if (state !== 'play') return;
  if (!cells.some(c => !c.x)) setTimeout(win, 380);
}
function afterMove() {
  if (moves(1).length) return;
  if (adds > 0) { addBtn.classList.add('nudge'); say('No pairs left — tap + to add the remaining digits'); return; }
  setTimeout(() => { if (state === 'play' && !moves(1).length && adds === 0 && cells.some(c => !c.x)) lose(); }, 500);
}
function checkBeat() { if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#4f6bed', 40, 79); fx.confetti(60); } }

function addRows() {
  if (state !== 'play' || !adds) { if (state === 'play') { soft.err(); say('No more + this stage'); } return; }
  const rest = cells.filter(c => !c.x).map(c => c.d);
  if (!rest.length) return;
  adds--; addBtn.classList.remove('nudge'); clearHints();
  if (sel >= 0) { cells[sel].el.classList.remove('sel'); sel = -1; }
  plan = [];   // the built-in solution no longer covers the copies
  const start = cells.length;
  rest.forEach((d, k) => { const c = { id: nextId++, d, x: false }; cells.push(c); mk(c, start + k, 60 + k * 22); });
  total += rest.length;
  grid.style.height = Math.max(Math.floor(wrap.clientHeight / cs), rows() + 1) * cs + 'px';
  wrap.scrollTo({ top: Math.max(0, Math.floor(start / COLS) * cs - cs * 2), behavior: 'smooth' });
  soft.swish(); arp([62, 66, 69], 50, 0.08, 0.4); buzz(10);
  say(`${rest.length} digits added`); refresh(); afterMove();
}
function clearHints() { grid.querySelectorAll('.hint').forEach(e => e.classList.remove('hint')); }
function bestMove() {
  // follow the built-in solution when it still applies, else any open pair
  while (plan.length) {
    const [x, y] = plan[0], i = cells.findIndex(c => c.id === x), j = cells.findIndex(c => c.id === y);
    if (i < 0 || j < 0 || cells[i].x || cells[j].x) { plan.shift(); continue; }
    if (fit(cells[i].d, cells[j].d) && link(i, j)) return [i, j];
    plan = []; break;
  }
  const m = moves(); if (!m.length) return null;
  // prefer pairs that finish a row
  m.sort((p, q) => rowGain(q) - rowGain(p));
  return m[0];
}
function rowGain([i, j]) { let g = 0; for (const k of [i, j]) { const r = Math.floor(k / COLS); let left = 0; for (let t = r * COLS; t < Math.min(cells.length, r * COLS + COLS); t++) if (!cells[t].x) left++; if (left <= 2) g++; } return g; }
function hint() {
  if (state !== 'play') return;
  if (!hints) { soft.err(); say('No hints left this stage'); return; }
  const m = bestMove();
  if (!m) { if (adds) { addBtn.classList.add('nudge'); say('No pairs — tap +'); } return; }
  hints--; clearHints();
  for (const k of m) { const e = cells[k].el; e.classList.add('hint'); }
  const r = Math.floor(m[0] / COLS) * cs; if (r < wrap.scrollTop || r > wrap.scrollTop + wrap.clientHeight - cs) wrap.scrollTo({ top: Math.max(0, r - cs * 2), behavior: 'smooth' });
  soft.wood(); refresh();
}
let idle = 0;
setInterval(() => { if (state === 'play' && ++idle === 12 && hints) { const m = moves(1); if (!m.length && adds) addBtn.classList.add('nudge'); } }, 1000);

function win() {
  if (state !== 'play') return;
  state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
  const bonus = 100 + adds * 50 + hints * 20; score += bonus; refresh();
  arp([67, 71, 74, 79, 83, 86], 100, 0.12, 0.9); fx.confetti(140, ['#4f6bed', '#7fd6b0', '#ffd166', '#ef7a85', '#ffffff']); buzz([20, 60, 20]);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  if (score > best) { best = score; S.set('best', best); }
  D.won(score); WB.submit(1);   // world board: boards cleared today
  ui.win(D.isDaily ? '' : level - 1, `${score.toLocaleString()} pts · +${bonus} clear bonus${adds ? ` · ${adds} + unused` : ''}`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; const frac = total ? crossed / total : 0;
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, frac); }
  if (score > best) { best = score; S.set('best', best); }
  soft.err(); buzz([30, 40, 30]);
  ui.lose('No pairs left', `${cells.filter(c => !c.x).length} digits remain · ${score.toLocaleString()} pts`);
}
ui.onTap((which) => {
  WB.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  stage(); state = 'play';
});
stage();

// ---------------------------------------------------------------- test hook: the bot plays one pair per call (or presses +)
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const m = bestMove();
    if (!m) return addRows();
    if (sel >= 0 && sel !== m[0] && sel !== m[1]) tap(sel);
    if (sel !== m[0]) tap(m[0]);
    tap(m[1]);
  },
};

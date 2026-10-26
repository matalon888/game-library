// Shakeword — original 4×4 letter-dice word hunt. Shake sixteen dice, then drag through touching letters (sideways,
// up/down or diagonal, each die once per word) to spell words of 3+ letters before the two-minute clock runs out.
// Reach the level's target score to clear it. Grids are seeded; our solver lists every word a grid holds.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { SAFE } from './safe.js';

const NAME = 'Shakeword: 4x4 Word Hunt';
const S = store('shakeword');
const F = flow('shakeword');
const ui = createUI({ title: 'Shakeword', hint: 'Tap to shake', hand: '', score: false });
cardTheme({ accent: '#ff9f43' });
const D = daily('shakeword', ui, { name: NAME });
const B = board({ game: 'shakeword', label: 'Points', limits: { maxRun: 250, maxPerSec: 4 }, mode: 'best', corner: 'tl' });   // world board: best round today (RULES.md part C)
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily grid · two minutes' : '4×4 word hunt · two minutes', doneLine: doneToday ? `Best today · ${doneToday.s} pts` : null });
{ const p = document.createElement('p'); p.textContent = 'Drag through touching letters to make words'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily grid<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Time!';
ui.els.lose.querySelector('.hint').textContent = 'Tap to shake again';

// ---------------------------------------------------------------- dice + dictionary
// our own sixteen dice (one face is "Qu", which counts as two letters)
const DICE = ['AEINOS', 'AEIRST', 'EEILNR', 'AOTTHW', 'DENRST', 'ACELMP', 'BDGOUY', 'EHILNR', 'CKMOPU', 'AEHRST', 'FGINSU', 'EILTVY', 'ABLORT', 'DEHNOS', 'AIMRTW', 'BFJKQX'];
const DICT = new Set(SAFE.filter(w => w.length >= 3));
const PRE = new Set(); for (const w of DICT) for (let i = 1; i <= w.length; i++) PRE.add(w.slice(0, i));
const NB = []; for (let i = 0; i < 16; i++) { const r = i >> 2, c = i & 3, n = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < 4 && cc >= 0 && cc < 4) n.push(rr * 4 + cc); } NB.push(n); }
const PTS = (w) => [0, 0, 0, 1, 2, 3, 5, 8, 11][Math.min(8, w.length)];
const rngf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const face = (ch) => ch === 'q' ? 'qu' : ch;
function solveGrid(G) {
  const out = new Set(), used = new Array(16).fill(false);
  const go = (i, s) => { s += face(G[i]); if (!PRE.has(s)) return; used[i] = true; if (s.length >= 3 && DICT.has(s)) out.add(s); for (const j of NB[i]) if (!used[j]) go(j, s); used[i] = false; };
  for (let i = 0; i < 16; i++) go(i, '');
  return [...out];
}
function shake(seed) {
  const r = rngf(seed); r();
  for (let t = 0; t < 60; t++) {
    const order = DICE.map((d, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const G = order.map(i => DICE[i][Math.floor(r() * 6)].toLowerCase());
    const sol = solveGrid(G);
    if (sol.length >= 40) return { G, sol };
  }
  const G = 'serstaliendroatp'.split(''); return { G, sol: solveGrid(G) };
}
function findPath(G, w) {
  const used = new Array(16).fill(false), path = [];
  const go = (i, k) => { const f = face(G[i]); if (w.slice(k, k + f.length) !== f) return false; used[i] = true; path.push(i); if (k + f.length === w.length) return true; for (const j of NB[i]) if (!used[j] && go(j, k + f.length)) return true; used[i] = false; path.pop(); return false; };
  for (let i = 0; i < 16; i++) if (go(i, 0)) return path;
  return null;
}

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#fff}
body{background:radial-gradient(140% 90% at 50% 0%,#4b6fc0 0%,#2c4a8a 50%,#1d3366 100%)}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#3a2206;background:#ffb85c;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.16);color:#ffb85c}.hc-top .hc-bar{background:rgba(255,255,255,.16);height:8px}.hc-top .hc-bar i{background:#ffb85c}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#c9d7ff;text-shadow:none;opacity:1}
.pill{position:fixed;z-index:6;top:calc(60px + env(safe-area-inset-top));height:30px;display:flex;align-items:center;gap:6px;border-radius:16px;font-weight:800;font-size:15px;padding:0 12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);color:#fff;pointer-events:none;font-variant-numeric:tabular-nums}
#clock{right:12px}#clock.hot{background:#e0524a;border-color:#e0524a;animation:tick 1s infinite}#pts{left:12px}
@keyframes tick{50%{transform:scale(1.08)}}
#word{position:fixed;left:50%;z-index:4;transform:translateX(-50%);min-width:60px;height:44px;padding:0 18px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.12);font-weight:800;font-size:24px;letter-spacing:3px;text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;transition:background .15s;white-space:nowrap}
#word small{font-size:13px;letter-spacing:1px;opacity:.85}
#word.good{background:#3fbf7f}#word.old{background:#7d8aa8}#word.bad{background:#e0524a;animation:shake .35s}
@keyframes shake{20%{transform:translateX(calc(-50% - 7px))}40%{transform:translateX(calc(-50% + 7px))}60%{transform:translateX(calc(-50% - 4px))}80%{transform:translateX(calc(-50% + 3px))}}
#tray{position:fixed;z-index:3;border-radius:26px;background:linear-gradient(180deg,#1a2c5a,#22397a);box-shadow:inset 0 4px 14px rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.15);touch-action:none}
#tray svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:visible}
.die{position:absolute;border-radius:18%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#26304a;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;
  background:linear-gradient(160deg,#fffdf6,#efe6d2);box-shadow:inset 0 -6px 0 rgba(120,100,60,.18),0 5px 0 #b9ad92,0 9px 16px rgba(0,0,0,.35);transition:background .12s,color .12s,transform .12s;pointer-events:none;text-transform:uppercase}
.die span{display:block}.die.qu span{font-size:.82em;text-transform:none}
.die.on{background:linear-gradient(160deg,#ffc36e,#ff9f43);color:#fff;transform:scale(.94);box-shadow:inset 0 -6px 0 rgba(150,70,0,.25),0 3px 0 #c76f1c,0 6px 12px rgba(0,0,0,.3)}
.die.hint{animation:pulse .6s 2}
.die.roll{animation:roll .55s cubic-bezier(.3,1.4,.5,1) both}
@keyframes roll{0%{transform:translateY(-30px) rotate(-90deg) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes pulse{50%{transform:scale(1.1)}}
#found{position:fixed;z-index:3;left:12px;right:12px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-content:flex-start;overflow:hidden;pointer-events:none}
#found span{background:rgba(255,255,255,.14);border-radius:10px;padding:3px 9px;font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;animation:pin .35s cubic-bezier(.3,1.6,.5,1)}
#found span b{color:#ffb85c;font-size:11px;margin-left:4px}
#found span.miss{background:transparent;border:1px dashed rgba(255,255,255,.3);color:#c9d7ff}
@keyframes pin{0%{transform:scale(.3)}100%{transform:none}}
#ctl{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;gap:12px}
#ctl button{height:50px;border:0;border-radius:25px;font:inherit;font-weight:800;font-size:16px;letter-spacing:.5px;cursor:pointer;display:flex;align-items:center;gap:8px;padding:0 20px;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)}
#ctl button svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ctl button.done{background:#ffb85c;color:#3a2206;border:0;box-shadow:0 4px 0 #c77f2a}
#ctl button:active{transform:translateY(2px)}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(16,26,56,.74),rgba(12,20,44,.88))}
`);
const wordEl = document.createElement('div'); wordEl.id = 'word'; document.body.appendChild(wordEl);
const tray = document.createElement('div'); tray.id = 'tray'; tray.innerHTML = '<svg><polyline fill="none" stroke="#fff" stroke-opacity=".5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; document.body.appendChild(tray);
const line = tray.querySelector('polyline');
const foundEl = document.createElement('div'); foundEl.id = 'found'; document.body.appendChild(foundEl);
const ctl = document.createElement('div'); ctl.id = 'ctl'; document.body.appendChild(ctl);
const clockEl = document.createElement('div'); clockEl.className = 'pill'; clockEl.id = 'clock'; document.body.appendChild(clockEl);
const ptsEl = document.createElement('div'); ptsEl.className = 'pill'; ptsEl.id = 'pts'; document.body.appendChild(ptsEl);
const mk = (cls, html, fn) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = html; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); ctl.appendChild(b); return b; };
mk('', '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5"/></svg>Turn', () => turn());
mk('done', 'Done ✓', () => { if (state === 'play' && found.size) endRound(); });
const dice = Array.from({ length: 16 }, () => { const d = document.createElement('div'); d.className = 'die'; d.innerHTML = '<span></span>'; tray.appendChild(d); return d; });

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), tries = S.get('tries', 0), G = [], SOL = [], found = new Set(), score = 0, target = 10, timeLeft = 120, recorded = false, beatenShown = false;
let sel = [], dragging = false, moved = false, geo = { x: 0, y: 0, cs: 80, s: 340 }, lastTick = 0, wordT = 0;

function build() {
  const seed = D.isDaily ? D.seed * 13 + 1 : level * 7907 + tries * 389 + 3;
  ({ G, sol: SOL } = shake(seed));
  SOL.sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  const maxPts = SOL.reduce((a, w) => a + PTS(w), 0);
  // flow (honest difficulty): the level's target score. With the world board on, F.k() is 1 for everyone.
  target = D.isDaily ? Math.min(20, Math.round(maxPts * 0.3)) : Math.max(6, Math.min(Math.round(maxPts * 0.35), Math.round((8 + level * 2) * (F.k()))));
  found = new Set(); score = 0; timeLeft = 120; recorded = false; beatenShown = false; sel = [];
  foundEl.innerHTML = '';
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  ui.sub(`${D.isDaily ? 'Daily' : 'Level ' + level} · target ${target}`);
  paintDice(true); layout(); hud(); showWord();
}
function paintDice(roll) {
  dice.forEach((d, i) => { d.querySelector('span').textContent = G[i] === 'q' ? 'Qu' : G[i]; d.classList.toggle('qu', G[i] === 'q');
    if (roll) { d.classList.remove('roll'); void d.offsetWidth; d.style.animationDelay = (i * 0.03) + 's'; d.classList.add('roll'); } });
  if (roll) for (let i = 0; i < 6; i++) setTimeout(() => tone(300 + Math.random() * 300, 0.04, 'triangle', 0.06, 0.7), i * 60);
}
function hud() {
  ptsEl.textContent = `★ ${score}`;
  clockEl.textContent = '⏱ ' + fmtTime(Math.max(0, Math.ceil(timeLeft)));
  clockEl.classList.toggle('hot', timeLeft <= 15 && state === 'play');
  ui.progress(score / target);
}
function layout() {
  const W = innerWidth, H = innerHeight;
  const s = Math.min(W - 28, 420, H * 0.46), x = (W - s) / 2, y = 168, pad = s * 0.045, cs = (s - pad * 2) / 4;
  geo = { x, y, s, cs, pad };
  Object.assign(tray.style, { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px' });
  dice.forEach((d, i) => { const r = i >> 2, c = i & 3, m = cs * 0.07; Object.assign(d.style, { left: pad + c * cs + m + 'px', top: pad + r * cs + m + 'px', width: cs - 2 * m + 'px', height: cs - 2 * m + 'px', fontSize: cs * 0.5 + 'px' }); });
  line.setAttribute('stroke-width', cs * 0.11);
  wordEl.style.top = y - 58 + 'px';
  const ctlY = H - Math.max(18, H * 0.03) - 50; ctl.style.top = ctlY + 'px';
  foundEl.style.top = y + s + 16 + 'px'; foundEl.style.height = ctlY - (y + s + 16) - 12 + 'px';
}
addEventListener('resize', () => G.length && layout());
const center = (i) => [geo.pad + ((i & 3) + 0.5) * geo.cs, geo.pad + ((i >> 2) + 0.5) * geo.cs];
const cur = () => sel.map(i => face(G[i])).join('');
function showWord(cls = '', text = null) {
  const w = text ?? cur();
  wordEl.className = cls; clearTimeout(wordT);
  wordEl.innerHTML = w ? w.toUpperCase() + (cls === 'good' ? ` <small>+${PTS(w)}</small>` : '') : `<small>${found.size} of ${SOL.length} words</small>`;
}
function drawSel(px, py) {
  const pts = sel.map(i => center(i).join(','));
  if (px !== undefined && sel.length) pts.push(px + ',' + py);
  line.setAttribute('points', pts.join(' '));
  dice.forEach((d, i) => d.classList.toggle('on', sel.includes(i)));
}

// ---------------------------------------------------------------- input: drag (or tap die by die, tap the last one again to submit)
function hit(px, py) {
  const c = Math.floor((px - geo.pad) / geo.cs), r = Math.floor((py - geo.pad) / geo.cs);
  if (c < 0 || r < 0 || c > 3 || r > 3) return -1;
  const i = r * 4 + c, [cx, cy] = center(i);
  return Math.hypot(px - cx, py - cy) < geo.cs * 0.42 ? i : -1;   // inner circle only, so diagonals are easy
}
function add(i) {
  if (i < 0) return;
  if (sel.length >= 2 && sel[sel.length - 2] === i) { sel.pop(); soft.click(); showWord(); return; }
  if (sel.includes(i)) return;
  if (sel.length && !NB[sel[sel.length - 1]].includes(i)) return;
  sel.push(i); chime(sel.length - 1, 64, 0.08); buzz(5); showWord();
}
const local = (e) => { const r = tray.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
tray.addEventListener('pointerdown', (e) => {
  if (state !== 'play') return; e.preventDefault(); botPlan = null;
  const [x, y] = local(e), i = hit(x, y);
  tray.setPointerCapture(e.pointerId); dragging = true; moved = false;
  if (i >= 0 && sel.length && i === sel[sel.length - 1]) { dragging = false; submit(); return; }   // tap mode: tap the last die to send
  if (i >= 0 && sel.length && NB[sel[sel.length - 1]].includes(i) && !sel.includes(i)) { add(i); drawSel(); return; }   // tap mode: extend
  sel = []; add(i); drawSel(x, y);
});
tray.addEventListener('pointermove', (e) => { if (!dragging) return; const [x, y] = local(e); const n = sel.length; add(hit(x, y)); if (sel.length !== n) moved = true; drawSel(x, y); });
const up = () => { if (!dragging) return; dragging = false; if (moved || sel.length > 2) submit(); else drawSel(); };
tray.addEventListener('pointerup', up); tray.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => {   // desktop: type a word and press Enter
  if (state !== 'play' || e.metaKey || e.ctrlKey) return;
  if (e.key === 'Enter') { if (typed.length >= 3) { const p = findPath(G, typed); sel = p || []; if (p) submit(); else { showWord('bad', typed); soft.err(); } } typed = ''; return; }
  if (e.key === 'Backspace') { typed = typed.slice(0, -1); showWord('', typed); return; }
  if (/^[a-zA-Z]$/.test(e.key)) { typed += e.key.toLowerCase(); const p = findPath(G, typed); sel = p || []; drawSel(); showWord(p ? '' : 'bad', typed); }
});
let typed = '';
function submit() {
  const w = cur(), done = (cls, ms = 450) => { showWord(cls, w); setTimeout(() => { if (!dragging) { sel = []; drawSel(); } }, 160); wordT = setTimeout(() => { if (!sel.length) showWord(); }, ms); };
  if (state !== 'play') return;
  if (w.length < 3) { sel = []; drawSel(); showWord(); return; }
  if (found.has(w)) { soft.click(); return done('old'); }
  if (!DICT.has(w)) { soft.err(); buzz(20); return done('bad'); }
  found.add(w); const p = PTS(w), before = score; score += p;
  const chip = document.createElement('span'); chip.innerHTML = `${w}<b>+${p}</b>`; foundEl.prepend(chip);
  const [cx, cy] = center(sel[sel.length - 1]), r = tray.getBoundingClientRect();
  fx.sparks(r.left + cx, r.top + cy, ['#fff', '#ffb85c', '#7fd6ff'], 8 + p * 2, { speed: 2.6 + p * 0.3, size: 2.8 });
  arp([64, 67, 71, 74, 79, 83].slice(0, Math.min(6, w.length - 1)), 55, 0.1); buzz(12);
  if (w.length >= 6) ui.pop(w.length >= 7 ? 'AMAZING!' : 'SUPERB!', '#ffb85c', 34, 14);
  else if (w.length === 5) ui.pop('Nice!', '#fff', 26, 14);
  if (before < target && score >= target) { ui.pop('Target reached!', '#7fe0a8', 30, 14); fx.confetti(50); chime(9, 72, 0.12); }
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#ffb85c', 40, 14); fx.confetti(60); }
  hud(); done('good', 600);
}
function turn() {
  if (state !== 'play') return;
  const N = G.slice(); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) N[r * 4 + c] = G[(3 - c) * 4 + r];
  G = N; sel = []; drawSel(); showWord();
  tray.animate([{ transform: 'rotate(-90deg) scale(.92)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.3,1.3,.5,1)' });
  paintDice(false); soft.swish();
}

// ---------------------------------------------------------------- round end
function endRound() {
  if (state !== 'play') return;
  const won = score >= target;
  state = won ? 'won' : 'lost'; sel = []; drawSel(); clockEl.classList.remove('hot');
  if (!recorded) { recorded = true; B.submit(score); if (!D.isDaily) { if (won) F.level(true); else F.level(false, score / target); } }
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  const best = [...found].sort((a, b) => b.length - a.length)[0];
  // show a few of the longest words that were hiding
  const missed = SOL.filter(w => !found.has(w)).slice(0, 8);
  for (const w of missed) { const c = document.createElement('span'); c.className = 'miss'; c.textContent = w; foundEl.appendChild(c); }
  const line = `${score} pts · ${found.size} word${found.size === 1 ? '' : 's'}${best ? ` · best ${best.toUpperCase()}` : ''}`;
  if (won) {
    arp([67, 72, 76, 79, 84], 90, 0.12, 0.8); fx.confetti(); buzz([20, 40, 20]);
    D.won(score);
    if (!D.isDaily) { level++; tries = 0; S.set('level', level); S.set('tries', 0); }
    ui.els.win.querySelector('h1').textContent = timeLeft > 0 ? 'Cleared!' : 'Time!';
    if (!D.isDaily) ui.els.win.querySelector('p').innerHTML = 'LEVEL <span data-l>1</span>';
    setTimeout(() => ui.win(D.isDaily ? '' : level - 1, line), 700);
  } else {
    soft.err(); buzz([40, 60, 40]);
    if (!D.isDaily) { tries++; S.set('tries', tries); }
    setTimeout(() => ui.lose("Time's up!", `${line} · target was ${target}`), 900);
  }
}
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000); lastT = t;
  if (state === 'play') {
    timeLeft -= dt;
    const s = Math.ceil(timeLeft); if (s !== lastTick) { lastTick = s; hud(); if (s <= 10 && s > 0) tone(s <= 5 ? 1200 : 900, 0.04, 'sine', 0.05, 1); }
    if (timeLeft <= 0) { timeLeft = 0; hud(); endRound(); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in round 1, until the first real touch,
// the shortest hidden word traces itself die by die and is sent (a few points of the target), so the drag-a-word move is shown
let demoPath = null;
demo(() => {
  if (!demoPath) { const w = SOL.filter(w => !found.has(w)).sort((a, b) => a.length - b.length)[0]; demoPath = w && findPath(G, w); sel = []; if (!demoPath) return false; }
  if (sel.length < demoPath.length) { add(demoPath[sel.length]); const p = center(sel[sel.length - 1]); drawSel(p[0], p[1]); }
  else { submit(); return false; }
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !dragging && !found.size, wait: 1800, every: 380, max: 8 });
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; lastT = performance.now(); paintDice(true); return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play'; lastT = performance.now();
});
build();

// ---------------------------------------------------------------- test hook: the bot traces one die every ~0.25 s, then
// presses Done once it has passed the target (like a player banking the level)
let botPlan = null, botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || dragging || (botTick++ % 2)) return;
    if (score >= target && found.size >= 3 && !botPlan) return endRound();
    if (!botPlan) {
      const open = SOL.filter(w => !found.has(w)); if (!open.length) return endRound();
      const w = open[Math.floor(Math.random() * Math.min(open.length, 25))];
      botPlan = findPath(G, w); sel = []; if (!botPlan) return;
    }
    if (sel.length < botPlan.length) { add(botPlan[sel.length]); const p = center(sel[sel.length - 1]); drawSel(p[0], p[1]); }
    else { botPlan = null; submit(); }
  },
};

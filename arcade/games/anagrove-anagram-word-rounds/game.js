// Anagrove — original anagram rounds. Six letters, a wall of empty word slots (3 to 6 letters) and a clock.
// Find any six-letter word to unlock the next round; every word you find fills its slot. Rounds are generated
// (seeded) from our common-word list; rarer real words count as bonus words. Daily round = the same letters for everyone.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { WORDS } from './words.js';
import { SAFE } from './safe.js';

const NAME = 'Anagrove: Anagram Word Rounds';
const S = store('anagrove');
const F = flow('anagrove');
const ui = createUI({ title: 'Anagrove', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#e0a63c' });
const D = daily('anagrove', ui, { name: NAME });
const B = board({ game: 'anagrove', label: 'Words found', limits: { maxRun: 40, maxPerSec: 1 }, mode: 'sum' });   // world board: words found today (RULES.md part C)
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily six letters' : 'six letters · find every word',
  doneLine: doneToday ? `Played today · ${doneToday.f} words` : null,
});
{ const p = document.createElement('p'); p.textContent = 'Find a six-letter word to unlock the next round'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily round<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'ROUND <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Round cleared!';
ui.els.lose.querySelector('.hint').textContent = 'Tap for new letters';

// ---------------------------------------------------------------- words
const SAFESET = new Set(SAFE);
const CORE = WORDS.slice(0, 5911).filter(w => SAFESET.has(w));          // SCOWL levels 10 + 20: everyday words fill the slots
const ALL = new Set(SAFE.filter(w => w.length >= 3 && w.length <= 6));   // rarer real words still count as bonus words
const SIXES = CORE.filter(w => w.length === 6);
const SUBS = CORE.filter(w => w.length >= 3 && w.length <= 6);
const counts = (w) => { const c = {}; for (const ch of w) c[ch] = (c[ch] || 0) + 1; return c; };
const fits = (w, pc) => { const c = {}; for (const ch of w) { c[ch] = (c[ch] || 0) + 1; if (c[ch] > (pc[ch] || 0)) return false; } return true; };
const rngf = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
function makeRound(seed) {
  const r = rngf(seed); r(); r();
  for (let t = 0; t < 500; t++) {
    const base = SIXES[Math.floor(r() * SIXES.length)], pc = counts(base);
    const subs = SUBS.filter(w => fits(w, pc));
    if (subs.length < 9 || subs.length > 24) continue;
    const letters = base.split(''); for (let k = 5; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [letters[k], letters[j]] = [letters[j], letters[k]]; }
    if (letters.join('') === base) letters.reverse();
    const words = subs.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    return { base, letters, words, pc };
  }
}

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#f4efe2}
body{background:radial-gradient(130% 80% at 50% 0%,#2f7a63 0%,#1d5547 45%,#143d36 100%)}
#leaf{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#1d3b33;background:#f3c45e;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#f3c45e}.hc-top .hc-bar{background:rgba(255,255,255,.14);height:8px}.hc-top .hc-bar i{background:#f3c45e}
.hc-sub{top:calc(52px + env(safe-area-inset-top));font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#bfe3cf;text-shadow:none;opacity:1}
.pill{position:fixed;z-index:6;top:calc(52px + env(safe-area-inset-top));height:30px;display:flex;align-items:center;gap:6px;border-radius:16px;font-weight:800;font-size:15px;padding:0 12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);color:#fff3d6;pointer-events:none;font-variant-numeric:tabular-nums}
#clock{right:12px}#clock.hot{background:#d9534a;border-color:#d9534a;animation:tick 1s infinite}
#pts{left:12px;top:calc(60px + env(safe-area-inset-top))}#clock{top:calc(60px + env(safe-area-inset-top))}
@keyframes tick{50%{transform:scale(1.08)}}
#wall{position:fixed;z-index:2;left:0;right:0;pointer-events:none}
#wall .w{position:absolute;display:flex;gap:2px}
#wall .c{width:var(--cs);height:var(--cs);border-radius:5px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:calc(var(--cs) * .62);text-transform:uppercase;color:#1d3b33;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
#wall .w.got .c{background:#f6ecd2;border-color:#f6ecd2;box-shadow:0 2px 0 #cdb98a;animation:flip .45s cubic-bezier(.3,1.5,.5,1) both}
#wall .w.six .c{background:#f3c45e;border-color:#f3c45e;box-shadow:0 2px 0 #c39432}
#wall .w.miss .c{background:rgba(255,255,255,.08);color:#ffb3a8;border-color:rgba(255,179,168,.35)}
#wall .w.flash .c{animation:glow .6s ease}
@keyframes flip{0%{transform:scale(.3) rotate(-12deg)}100%{transform:scale(1)}}
@keyframes glow{40%{transform:scale(1.25);filter:brightness(1.2)}}
#tray{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;gap:8px;pointer-events:none}
#tray .t{width:var(--ts);height:var(--ts);border-radius:12px;border:2px dashed rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:calc(var(--ts) * .56);color:#1d3b33;text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif}
#tray .t.on{border:0;background:#fff7e6;box-shadow:0 4px 0 #d7c39a,0 6px 14px rgba(0,0,0,.2);animation:drop .2s ease-out}
#tray.bad{animation:shake .4s}#tray.good .t.on{background:#9fe0b4;box-shadow:0 4px 0 #5fae7c}#tray.old .t.on{background:#d9d4c6}#tray.bonus .t.on{background:#ffd98a}
@keyframes drop{0%{transform:translateY(40px) scale(.6)}100%{transform:none}}
@keyframes shake{20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
#tiles{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;gap:10px}
#tiles button{width:var(--ls);height:var(--ls);border-radius:50%;border:0;padding:0;cursor:pointer;font-weight:800;font-size:calc(var(--ls) * .5);color:#4a2f14;text-transform:uppercase;font-family:ui-rounded,'SF Pro Rounded','Baloo 2',system-ui,sans-serif;
  background:radial-gradient(circle at 38% 30%,#ffe9b8,#f0c27a 55%,#d99f52);box-shadow:inset 0 -5px 0 rgba(120,70,20,.25),0 6px 0 #9c6a2f,0 10px 18px rgba(0,0,0,.3);transition:transform .15s,opacity .15s}
#tiles button:active{transform:translateY(3px)}
#tiles button.used{opacity:.14;transform:scale(.8);pointer-events:none}
#tiles button.spin{animation:spin .4s ease-out}
@keyframes spin{0%{transform:rotate(-200deg) scale(.5)}100%{transform:none}}
#ctl{position:fixed;z-index:3;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:10px}
#ctl button{height:52px;border:0;border-radius:26px;cursor:pointer;font:inherit;font-weight:800;font-size:17px;letter-spacing:.5px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 18px}
#ctl .round{width:52px;padding:0;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.2)}
#ctl .round svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ctl .go{background:#f6ecd2;color:#1d3b33;box-shadow:0 4px 0 #cdb98a;min-width:112px}
#ctl .next{background:#f3c45e;color:#3a2a08;box-shadow:0 4px 0 #c39432;animation:pulse 1.1s infinite}
#ctl .next.off{display:none}
#ctl button:active{transform:translateY(2px)}
@keyframes pulse{50%{transform:scale(1.06)}}
#toast{position:fixed;left:50%;z-index:9;transform:translateX(-50%);background:#f6ecd2;color:#1d3b33;font-weight:800;font-size:15px;padding:8px 16px;border-radius:12px;opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.25)}
#toast.show{opacity:1}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(12,36,30,.72),rgba(10,28,24,.88))}
`);
const leaf = document.createElement('canvas'); leaf.id = 'leaf'; document.body.prepend(leaf);
const wall = document.createElement('div'); wall.id = 'wall'; document.body.appendChild(wall);
const tray = document.createElement('div'); tray.id = 'tray'; document.body.appendChild(tray);
const tilesEl = document.createElement('div'); tilesEl.id = 'tiles'; document.body.appendChild(tilesEl);
const ctl = document.createElement('div'); ctl.id = 'ctl'; document.body.appendChild(ctl);
const clockEl = document.createElement('div'); clockEl.className = 'pill'; clockEl.id = 'clock'; document.body.appendChild(clockEl);
const ptsEl = document.createElement('div'); ptsEl.className = 'pill'; ptsEl.id = 'pts'; document.body.appendChild(ptsEl);
const toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast);
let toastT = 0;
function say(t, ms = 1300) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), ms); }
const mk = (cls, html, fn) => { const b = document.createElement('button'); b.className = cls; b.innerHTML = html; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); ctl.appendChild(b); return b; };
const shuffleBtn = mk('round', '<svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>', () => shuffle());
const backBtn = mk('round', '<svg viewBox="0 0 24 24"><path d="M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6"/></svg>', () => back());
const goBtn = mk('go', 'ENTER', () => enter());
const nextBtn = mk('next off', 'NEXT ▸', () => endRound('next'));
shuffleBtn.setAttribute('aria-label', 'Shuffle'); backBtn.setAttribute('aria-label', 'Delete');

// soft drifting leaves in the background
function paintLeaves() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight; leaf.width = W * dpr; leaf.height = H * dpr;
  const g = leaf.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const r = rngf(17);
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, s = 10 + r() * 22, a = r() * 7;
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 0.05 + r() * 0.07; g.fillStyle = r() < 0.5 ? '#9fe0b4' : '#f3c45e';
    g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.7, 0, 0, s); g.quadraticCurveTo(-s * 0.7, 0, 0, -s); g.fill(); g.restore();
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), tries = S.get('tries', 0), points = S.get('points', 0);
let R = null, found = new Set(), bonus = new Set(), pick = [], qualified = false, timeLeft = 150, roundLen = 150, recorded = false, beatenShown = false, roundPts = 0;
let wordEls = new Map(), tileBtns = [], trayEls = [], lastTick = 0;

function build() {
  const seed = D.isDaily ? D.seed * 7 + 3 : level * 9973 + tries * 131 + 17;
  R = makeRound(seed);
  // flow (honest difficulty): the round clock. With the world board on, F.k() is 1 for everyone → 2:30.
  roundLen = Math.round(150 / (D.isDaily ? 1 : F.k())); timeLeft = roundLen;
  found = new Set(); bonus = new Set(); pick = []; qualified = false; recorded = false; beatenShown = false; roundPts = 0;
  wall.innerHTML = ''; wordEls = new Map();
  for (const w of R.words) {
    const d = document.createElement('div'); d.className = 'w';
    for (let i = 0; i < w.length; i++) { const c = document.createElement('div'); c.className = 'c'; d.appendChild(c); }
    wall.appendChild(d); wordEls.set(w, d);
  }
  tilesEl.innerHTML = ''; tileBtns = R.letters.map((ch, i) => {
    const b = document.createElement('button'); b.textContent = ch;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); tap(i); });
    tilesEl.appendChild(b); return b;
  });
  tray.innerHTML = ''; trayEls = R.letters.map(() => { const t = document.createElement('div'); t.className = 't'; tray.appendChild(t); return t; });
  nextBtn.classList.add('off');
  ui.levels(D.isDaily ? 1 : level); ui.progress(0);
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  const d = new Date();
  ui.sub(D.isDaily ? `Daily · ${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}` : `Round ${level}`);
  hud(); layout(); paintTray();
}
function hud() {
  ptsEl.textContent = `★ ${points.toLocaleString()}`;
  clockEl.textContent = '⏱ ' + fmtTime(Math.max(0, Math.ceil(timeLeft)));
  clockEl.classList.toggle('hot', timeLeft <= 10 && state === 'play');
  ui.progress(found.size / R.words.length);
}
function layout() {
  const W = innerWidth, H = innerHeight;
  paintLeaves();
  const pad = Math.max(18, H * 0.03), ctlY = H - pad - 52;
  ctl.style.top = ctlY + 'px';
  const ls = Math.min(58, Math.floor((Math.min(W, 460) - 32 - 50) / 6)); tilesEl.style.setProperty('--ls', ls + 'px');
  const tilesY = ctlY - 22 - ls; tilesEl.style.top = tilesY + 'px';
  const ts = Math.min(48, Math.floor((Math.min(W, 460) - 40 - 40) / 6)); tray.style.setProperty('--ts', ts + 'px');
  const trayY = tilesY - 22 - ts; tray.style.top = trayY + 'px';
  toast.style.top = trayY - 44 + 'px';
  // word wall: columns of slots, shortest words first, biggest cells that fit
  const top = 104, bottom = trayY - 54, areaH = bottom - top, areaW = W - 28;
  const words = R.words;
  let best = null;
  for (let nc = 1; nc <= 5; nc++) {
    const rows = Math.ceil(words.length / nc), cols = [];
    for (let i = 0; i < words.length; i += rows) cols.push(words.slice(i, i + rows));
    const lens = cols.map(c => Math.max(...c.map(w => w.length))), L = lens.reduce((a, b) => a + b, 0);
    // biggest cell that fits both ways (cell + 2px gap; columns 0.7 cell apart; rows 6px apart)
    const cs = Math.floor(Math.min(34, (areaH + 6) / rows - 6, (areaW + 2 * L) / (L + 0.7 * (cols.length - 1)) - 2));
    const colGap = Math.max(10, cs * 0.7), widths = lens.map(l => l * (cs + 2));
    const tw = widths.reduce((a, b) => a + b, 0) + colGap * (cols.length - 1);
    const score = cs - 1.5 * Math.max(0, rows - 8) - (cols.length - 1) * 0.5;   // big cells, but no tall skinny towers
    if (cs >= 12 && (!best || score > best.score)) best = { cs, rowH: cs + 6, rows, cols, widths, colGap, tw, score };
  }
  if (!best) best = { cs: 12, rowH: 18, rows: Math.ceil(words.length / 3), cols: [], widths: [], colGap: 8, tw: areaW };
  wall.style.setProperty('--cs', best.cs + 'px');
  const usedRows = Math.min(best.rows, words.length), totalH = usedRows * best.rowH - 6;
  let x = (W - best.tw) / 2; const y0 = top + Math.max(0, (areaH - totalH) / 2);
  best.cols.forEach((col, ci) => {
    col.forEach((w, ri) => { const el = wordEls.get(w); el.style.left = x + 'px'; el.style.top = y0 + ri * best.rowH + 'px'; });
    x += best.widths[ci] + best.colGap;
  });
}
addEventListener('resize', () => R && layout());
function paintTray() {
  trayEls.forEach((t, i) => { const k = pick[i]; const ch = k === undefined ? '' : R.letters[k]; if (t.textContent !== ch) { t.textContent = ch; t.classList.toggle('on', !!ch); } });
  tileBtns.forEach((b, i) => b.classList.toggle('used', pick.includes(i)));
}

// ---------------------------------------------------------------- input
function tap(i) { if (state !== 'play' || pick.includes(i) || tray.className) return; pick.push(i); chime(pick.length - 1, 67, 0.09); buzz(5); paintTray(); }
function back() { if (state !== 'play' || !pick.length || tray.className) return; pick.pop(); soft.click(); paintTray(); }
function shuffle() {
  if (state !== 'play') return;
  const word = pick.map(i => R.letters[i]);
  const idx = R.letters.map((_, i) => i); for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
  R.letters = idx.map(i => R.letters[i]);
  // keep the letters already in the tray (same letters, new tile positions)
  const free = R.letters.map((_, i) => i); pick = word.map(ch => { const k = free.findIndex(i => R.letters[i] === ch); return free.splice(k, 1)[0]; });
  tileBtns.forEach((b, i) => { b.textContent = R.letters[i]; b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); });
  soft.swish(); paintTray();
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || state !== 'play') return;
  if (e.key === 'Enter') enter(); else if (e.key === 'Backspace') back(); else if (e.key === ' ') shuffle();
  else if (/^[a-zA-Z]$/.test(e.key)) { const ch = e.key.toLowerCase(), i = R.letters.findIndex((c, k) => c === ch && !pick.includes(k)); if (i >= 0) tap(i); }
});
function settle(cls, ms) { tray.className = cls; setTimeout(() => { tray.className = ''; pick = []; paintTray(); }, ms); }
function enter() {
  if (state !== 'play' || tray.className) return;
  const w = pick.map(i => R.letters[i]).join('');
  if (w.length < 3) { if (w.length) { say('Three letters or more'); settle('bad', 380); soft.err(); } return; }
  const el = wordEls.get(w);
  if (el && !found.has(w)) {
    found.add(w); const pts = w.length * w.length * 10 + (w.length === 6 ? 100 : 0); points += pts; roundPts += pts; S.set('points', points);
    el.classList.add('got'); if (w.length === 6) el.classList.add('six');
    [...el.children].forEach((c, i) => { c.textContent = w[i]; c.style.animationDelay = i * 50 + 'ms'; });
    const b = el.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 2, ['#fff', '#f3c45e', '#9fe0b4'], 10, { speed: 2.6, size: 2.8 });
    arp([67, 71, 74, 79].slice(0, w.length - 2), 60, 0.1); buzz(12);
    settle('good', 330); hud(); checkBeat();
    if (w.length === 6 && !qualified) {
      qualified = true; nextBtn.classList.remove('off'); ui.pop('Next round unlocked!', '#f3c45e', 28, 22); fx.confetti(50);
    } else if (w.length >= 5) ui.pop(w.length === 6 ? 'SIX!' : 'Great word!', '#fff', 28, 40);
    if (found.size === R.words.length) setTimeout(() => endRound('all'), 500);
    return;
  }
  if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); say('Already found'); settle('old', 380); soft.click(); return; }
  if (ALL.has(w) && fits(w, R.pc)) {
    if (bonus.has(w)) { say('Already found'); settle('old', 380); return; }
    bonus.add(w); const pts = w.length * 5; points += pts; roundPts += pts; S.set('points', points); hud(); checkBeat();
    say(`Bonus word +${pts}`); arp([79, 84], 60, 0.08); settle('bonus', 420); return;
  }
  say('Not in our word list'); settle('bad', 380); soft.err(); buzz(20);
}
function checkBeat() { if (!beatenShown && D.beaten(roundPts)) { beatenShown = true; ui.pop('BEATEN!', '#f3c45e', 40, 30); fx.confetti(60); } }

// ---------------------------------------------------------------- round end
function revealMissing() {
  for (const w of R.words) if (!found.has(w)) { const el = wordEls.get(w); el.classList.add('miss'); [...el.children].forEach((c, i) => (c.textContent = w[i])); }
}
function endRound(why) {
  if (state !== 'play') return;
  const won = qualified;
  state = won ? 'won' : 'lost';
  nextBtn.classList.add('off'); clockEl.classList.remove('hot');
  if (!recorded) { recorded = true; B.submit(found.size); if (!D.isDaily) { if (won) F.level(true); else F.level(false, found.size / R.words.length); } }
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || found.size > prev.f) S.set(k, { f: found.size }); }
  revealMissing();
  const line = `${found.size}/${R.words.length} words${bonus.size ? ` · ${bonus.size} bonus` : ''} · +${roundPts.toLocaleString()} ★`;
  if (won) {
    if (why === 'all') { const b = 250; points += b; roundPts += b; S.set('points', points); ui.pop('Every word! +250', '#f3c45e', 30, 40); }
    hud(); arp([67, 72, 76, 79, 84], 90, 0.12, 0.8); fx.confetti(); buzz([20, 40, 20]);
    D.won(roundPts, `found ${found.size} words in ${D.isDaily ? "today's six letters" : `round ${level}`} and scored`);
    if (!D.isDaily) { level++; tries = 0; S.set('level', level); S.set('tries', 0); }
    setTimeout(() => ui.win(D.isDaily ? '' : level - 1, line), 900);
  } else {
    soft.err(); buzz([40, 60, 40]);
    if (!D.isDaily) { tries++; S.set('tries', tries); }
    const six = R.words.filter(w => w.length === 6).map(w => w.toUpperCase()).join(' / ');
    setTimeout(() => ui.lose("Time's up!", `The six-letter word was ${six} · ${found.size} words found`), 1400);
  }
}
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.25, (t - lastT) / 1000); lastT = t;
  if (state === 'play') {
    timeLeft -= dt;
    const s = Math.ceil(timeLeft); if (s !== lastTick) { lastTick = s; hud(); if (s <= 10 && s > 0) tone(s <= 5 ? 1200 : 900, 0.04, 'sine', 0.05, 1); }
    if (timeLeft <= 0) { timeLeft = 0; hud(); endRound('time'); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; lastT = performance.now(); return; }
  if (D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play'; lastT = performance.now();
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on round 1, until the first real touch,
// one short word is spelled tile by tile and fills its slot (its points and the clock time are given back)
const DA = demo(() => {
  const w = R.words.filter(q => !found.has(q)).sort((a, b) => a.length - b.length)[0]; if (!w) return false;
  const used = new Set(), plan = [...w].map(ch => { const i = R.letters.findIndex((c, k) => c === ch && !used.has(k)); used.add(i); return i; });
  const p0 = points, r0 = roundPts, t0 = timeLeft; pick = []; paintTray();
  plan.forEach((i, k) => setTimeout(() => { if (state === 'play' && !tray.className && !DA.touched) tap(i); }, k * 380));
  setTimeout(() => { if (state !== 'play' || pick.length !== plan.length || DA.touched) return; enter(); points = p0; roundPts = r0; S.set('points', points); timeLeft = Math.max(timeLeft, t0); hud(); }, plan.length * 380 + 150);
}, { ready: () => state === 'play' && level === 1 && !D.isDaily && !found.size && !pick.length && !tray.className, wait: 2000, max: 1 });
build();

// ---------------------------------------------------------------- test hook: the bot taps one letter every ~0.36 s like a
// quick player: a couple of short words, then a six-letter word, a few more, then NEXT
let botPlan = null, botTick = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return points; },
  bot() {
    if (state !== 'play' || tray.className || (botTick++ % 3)) return;
    if (qualified && found.size >= 5) return endRound('next');
    if (!botPlan) {
      const open = R.words.filter(w => !found.has(w)); if (!open.length) return;
      const six = open.find(w => w.length === 6);
      const w = found.size >= 2 && six ? six : open[Math.floor(Math.random() * Math.min(open.length, 6))];
      const used = new Set(); botPlan = [...w].map(ch => { const i = R.letters.findIndex((c, k) => c === ch && !used.has(k)); used.add(i); return i; });
      pick = []; paintTray();
    }
    if (pick.length < botPlan.length) tap(botPlan[pick.length]); else { botPlan = null; enter(); }
  },
};

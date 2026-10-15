// Cipherleaf — original code-breaking quote puzzle. A public-domain quote is hidden behind a number code (each number = one letter).
// Tap a blank, type the letter; right letters fill every matching blank, wrong ones cost one of three mistakes.
// Some letters start revealed (more on early levels). ?daily=1 = today's quote for everyone.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { QUOTES } from './quotes.js';

const NAME = 'Cipherleaf: Quote Code Puzzle';
const S = store('cipherleaf');
const F = flow('cipherleaf');
const ui = createUI({ title: 'Cipherleaf', hint: 'Tap to play', hand: '', score: false });
cardTheme({ accent: '#4f8a5b' });
const D = daily('cipherleaf', ui, { name: NAME });
const fx = fx2d(11);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily quote code' : 'crack the quote', doneLine: doneToday ? (D.isDaily ? `Cracked today · ${doneToday.s} pts` : 'Daily quote cracked ✓') : null });
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily quote<span data-l hidden></span>';
ui.els.win.querySelector('h1').textContent = 'Cracked!';

function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffled(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// play order: the 60 shortest quotes first (gentle start), then everything else
const byLen = QUOTES.map((q, i) => i).sort((a, b) => QUOTES[a].text.length - QUOTES[b].text.length);
const ORDER = [...shuffled(byLen.slice(0, 60), rngf(77)), ...shuffled(byLen.slice(60), rngf(78))];

// ---------------------------------------------------------------- styles + DOM
css(`
html,body{color:#33283d}
body{background:linear-gradient(180deg,#f3f6ec 0%,#e8efdc 100%)}
body:before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.5;background:
 radial-gradient(60px 30px at 8% 12%,rgba(120,170,110,.18),transparent 70%),radial-gradient(80px 36px at 92% 30%,rgba(120,170,110,.14),transparent 70%),
 radial-gradient(70px 30px at 12% 78%,rgba(120,170,110,.14),transparent 70%),radial-gradient(90px 40px at 88% 88%,rgba(120,170,110,.16),transparent 70%)}
.hc-top{z-index:6}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#4f8a5b;box-shadow:0 2px 6px rgba(0,0,0,.12)}
.hc-top .hc-lvl.next{background:#fff;color:#4f8a5b}.hc-top .hc-bar{background:rgba(40,70,30,.1);height:8px}.hc-top .hc-bar i{background:#4f8a5b}
.hc-card,.hc-card.dim{background:linear-gradient(180deg,rgba(28,54,36,.8),rgba(20,38,26,.88))}
#mist{position:fixed;left:0;right:0;top:calc(50px + env(safe-area-inset-top));z-index:5;text-align:center;font-size:11px;letter-spacing:3px;font-weight:800;color:#8a8f7a;text-transform:uppercase}
#mist div{display:flex;justify-content:center;gap:7px;margin-top:4px}
#mist i{width:15px;height:15px;border-radius:50%;box-shadow:inset 0 0 0 2px #b9bfa8;display:inline-block;transition:background .25s,transform .25s}
#mist i.x{background:#d9604f;box-shadow:none;transform:scale(1.1)}
#paper{position:fixed;z-index:2;background:#fffdf7;border-radius:20px;box-shadow:0 18px 44px -18px rgba(40,60,30,.35),0 0 0 1px rgba(60,80,40,.06)}
#quote{position:absolute;inset:0}
.c{position:absolute;display:flex;flex-direction:column;align-items:center;cursor:pointer}
.c .l{width:100%;display:flex;align-items:flex-end;justify-content:center;font-weight:800;color:#33283d;border-bottom:2.5px solid #cfc7d8;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif;border-radius:6px 6px 2px 2px;transition:background .15s,border-color .15s}
.c .n{font-size:11px;font-weight:700;color:#9a90a6;margin-top:2px;font-variant-numeric:tabular-nums}
.c.p{cursor:default}.c.p .l{border:0;color:#6b6175}
.c.given .l{color:#7a8f6e;border-color:#dfe6d6}
.c.same .l{background:#eef5e6;border-color:#a9c99a}
.c.sel .l{background:#5ea86b;border-color:#3f7f4b;color:#fff}
.c.sel .n{color:#3f7f4b}
.c.got .l{animation:got .5s cubic-bezier(.3,1.6,.5,1)}
.c.bad .l{animation:bad .4s;background:#f7d8d2;border-color:#d9604f}
@keyframes got{40%{transform:translateY(-6px) scale(1.15)}}
@keyframes bad{20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
#by{position:absolute;left:0;right:0;text-align:right;padding-right:18px;font-style:italic;font-weight:600;color:#7a8f6e;opacity:0;transition:opacity .6s;font-family:ui-serif,Georgia,serif}
#by.show{opacity:1}
#kb{position:fixed;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:7px;padding:0 5px}
#kb .kr{display:flex;gap:5px;width:100%;max-width:500px;justify-content:center}
#kb button{flex:1;max-width:44px;height:var(--kh);border:0;border-radius:9px;background:#fffdf7;color:#33283d;font:inherit;font-weight:800;font-size:18px;box-shadow:0 3px 0 #d3d9c4,0 4px 10px rgba(60,80,40,.08);cursor:pointer;transition:opacity .25s,transform .08s;padding:0;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif}
#kb button:active{transform:translateY(2px);box-shadow:0 1px 0 #d3d9c4}
#kb button.done{opacity:.28}
#kb button.nav{max-width:60px;flex:1.4;color:#4f8a5b}
#kb svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle}
.btn{position:fixed;z-index:4;width:50px;height:50px;border-radius:16px;background:#4f8a5b;box-shadow:0 4px 0 #3a6a44,0 8px 18px rgba(40,70,30,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0}
.btn svg{width:26px;height:26px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.btn i{position:absolute;top:-6px;right:-6px;font-style:normal;background:#e2a33b;color:#fff;font-size:12px;font-weight:800;border-radius:10px;padding:1px 6px}
.btn i.off{background:#aaa}
#pts{position:fixed;z-index:6;left:12px;top:calc(46px + env(safe-area-inset-top));height:30px;border-radius:16px;font-weight:800;font-size:13px;padding:0 12px;display:flex;align-items:center;background:#fff;color:#4f8a5b;box-shadow:0 2px 8px rgba(40,70,30,.12)}
`);
const mist = document.createElement('div'); mist.id = 'mist'; document.body.appendChild(mist);
const paper = document.createElement('div'); paper.id = 'paper'; paper.innerHTML = '<div id="quote"></div><div id="by"></div>'; document.body.appendChild(paper);
const qEl = paper.querySelector('#quote'), byEl = paper.querySelector('#by');
const kb = document.createElement('div'); kb.id = 'kb'; document.body.appendChild(kb);
const hintBtn = document.createElement('button'); hintBtn.className = 'btn'; hintBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"/></svg><i>3</i>'; document.body.appendChild(hintBtn);
const ptsEl = document.createElement('div'); ptsEl.id = 'pts'; document.body.appendChild(ptsEl);
const keyEl = {};
for (const r of ['QWERTYUIOP', 'ASDFGHJKL', '<ZXCVBNM>']) {
  const d = document.createElement('div'); d.className = 'kr';
  for (const ch of r) {
    const b = document.createElement('button');
    if (ch === '<' || ch === '>') { b.className = 'nav'; b.dataset.k = ch; b.innerHTML = ch === '<' ? '<svg viewBox="0 0 24 24"><path d="M5 5v14M19 12H9M13 7l-5 5 5 5"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M19 5v14M5 12h10M11 7l5 5-5 5"/></svg>'; }
    else { b.textContent = ch; b.dataset.k = ch; keyEl[ch] = b; }
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); press(b.dataset.k); });
    d.appendChild(b);
  }
  kb.appendChild(d);
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase()); else if (e.key === 'ArrowLeft') press('<'); else if (e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); press('>'); }
});

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), points = S.get('points', 0), Q, code = {}, cells = [], solvedL = new Set(), givenL = new Set(), sel = -1, mistakes = 0, hints = 3, hintUsedAt = -1, recorded = false, beatenShown = false, dailyPts = 0, busy = false;
const MAXM = 3;
function build(force) {
  const idx = force !== undefined ? force : D.isDaily ? ORDER[(Math.floor(rngf(D.seed)() * 1e6)) % ORDER.length] : ORDER[(level - 1) % ORDER.length];
  Q = QUOTES[idx];
  const r = rngf((D.seed || level * 6007) + 11);
  // the code: every letter gets its own number 1..26 (never its alphabet position, so A is never 1)
  let nums; do { nums = shuffled(Array.from({ length: 26 }, (_, i) => i + 1), r); } while (nums.some((n, i) => n === i + 1));
  code = {}; [...AZ].forEach((c, i) => (code[c] = nums[i]));
  const used = [...new Set(Q.text.toUpperCase().replace(/[^A-Z]/g, ''))];
  // flow: how many letters start revealed (fewer for steady solvers, more for players who keep running out)
  const L = D.isDaily ? 10 : level;
  const frac = Math.max(0.1, Math.min(0.55, (0.44 - Math.min(L - 1, 25) * 0.011) / (D.isDaily ? 1 : F.k())));
  givenL = new Set(shuffled(used, r).slice(0, Math.max(1, Math.round(used.length * frac))));
  solvedL = new Set(givenL);
  mistakes = 0; hints = 3; hintUsedAt = -1; recorded = false; beatenShown = false; dailyPts = 0; busy = false; sel = -1;
  qEl.innerHTML = ''; cells = [];
  for (const ch of Q.text) {
    const up = ch.toUpperCase(), isL = /[A-Z]/.test(up);
    const d = document.createElement('div'); d.className = 'c' + (isL ? '' : ' p');
    d.innerHTML = `<div class="l"></div><div class="n"></div>`;
    if (isL) { d.querySelector('.n').textContent = code[up]; d.addEventListener('pointerdown', (e) => { e.stopPropagation(); pick(cells.indexOf(cell)); }); }
    else d.querySelector('.l').textContent = ch === ' ' ? '' : ch;
    const cell = { el: d, ch: up, isL, space: ch === ' ' };
    cells.push(cell); qEl.appendChild(d);
  }
  byEl.textContent = '— ' + Q.by; byEl.style.transition = 'none'; byEl.classList.remove('show'); void byEl.offsetWidth; byEl.style.transition = '';
  ui.levels(D.isDaily ? 1 : level); ui.sub('');
  if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  layout(); paint(); select(next(-1));
}
// lay the quote out as wrapped words of letter cells, shrinking the cells until it fits the paper
function layout() {
  const W = innerWidth, H = innerHeight;
  const kh = Math.max(44, Math.min(54, H * 0.064)); kb.style.setProperty('--kh', kh + 'px');
  const kbH = kh * 3 + 14, bottom = Math.max(14, H * 0.02);
  kb.style.bottom = `calc(${bottom}px + env(safe-area-inset-bottom))`;
  const pw = Math.min(W - 20, 520), top = 98, ph = H - kbH - bottom - top - 78;
  Object.assign(paper.style, { left: (W - pw) / 2 + 'px', top: top + 'px', width: pw + 'px', height: ph + 'px' });
  Object.assign(hintBtn.style, { left: (W + pw) / 2 - 56 + 'px', top: top + ph + 14 + 'px' });
  const words = []; let cur = [];
  cells.forEach((c, i) => { if (c.space) { if (cur.length) words.push(cur); cur = []; } else cur.push(i); }); if (cur.length) words.push(cur);
  // largest tile size whose wrapped lines fit both the width (with side padding) and the height of the paper
  const maxW = pw - 32;
  const plan = (cw) => {
    const gap = Math.max(1.5, cw * 0.1), lh = cw * 1.25 + Math.max(13, cw * 0.62), sp = cw * 0.55;
    const wW = (w) => w.reduce((a, i) => a + (cells[i].isL ? cw : cw * 0.5) + gap, -gap);
    const lines = [[]]; let x = 0, widest = 0;
    for (const w of words) { const ww = wW(w); if (x > 0 && x + sp + ww > maxW) { lines.push([]); x = 0; } lines[lines.length - 1].push(w); x += (x > 0 ? sp : 0) + ww; widest = Math.max(widest, x); }
    return { cw, gap, lh, sp, wW, lines, ok: widest <= maxW && lines.length * lh + 44 <= ph };
  };
  let P = null;
  for (let cw = 34; cw >= 10; cw -= 0.5) { P = plan(cw); if (P.ok) break; }
  const { cw, gap, lh, sp, wW, lines } = P;
  const totalH = lines.length * lh, oy = Math.max(10, (ph - 30 - totalH) / 2);
  lines.forEach((ln, li) => {
    const lw = ln.reduce((a, w) => a + wW(w), 0) + sp * (ln.length - 1); let xx = Math.max(16, (pw - lw) / 2);
    ln.forEach(w => { w.forEach(i => { const c = cells[i], wdt = c.isL ? cw : cw * 0.5; Object.assign(c.el.style, { left: xx + 'px', top: oy + li * lh + 'px', width: wdt + 'px' }); Object.assign(c.el.querySelector('.l').style, { height: cw * 1.25 + 'px', fontSize: cw * 0.78 + 'px' }); c.el.querySelector('.n').style.fontSize = Math.max(8, Math.min(11, cw * 0.42)) + 'px'; xx += wdt + gap; }); xx += sp - gap; });
  });
  byEl.style.top = oy + totalH + 4 + 'px'; byEl.style.fontSize = Math.max(12, Math.min(18, cw * 0.55)) + 'px';
  for (const c of cells) if (c.space) c.el.style.display = 'none';
}
addEventListener('resize', () => Q && layout());
function paint() {
  cells.forEach((c, i) => {
    if (!c.isL) return;
    const shown = solvedL.has(c.ch);
    c.el.querySelector('.l').textContent = shown ? c.ch : '';
    c.el.classList.toggle('given', givenL.has(c.ch));
    c.el.classList.toggle('sel', i === sel);
    c.el.classList.toggle('same', sel >= 0 && i !== sel && cells[sel].ch === c.ch && !shown);
  });
  for (const k in keyEl) keyEl[k].classList.toggle('done', solvedL.has(k));
  mist.innerHTML = `Mistakes<div>${Array.from({ length: MAXM }, (_, i) => `<i class="${i < mistakes ? 'x' : ''}"></i>`).join('')}</div>`;
  const hi = hintBtn.querySelector('i'); hi.textContent = hints; hi.classList.toggle('off', !hints);
  ptsEl.textContent = '★ ' + (D.isDaily ? dailyPts : points).toLocaleString();
  const letters = cells.filter(c => c.isL), done = letters.filter(c => solvedL.has(c.ch)).length;
  ui.progress(done / letters.length);
}
const open = (i) => i >= 0 && cells[i].isL && !solvedL.has(cells[i].ch);
function next(from, dir = 1) { const n = cells.length; for (let k = 1; k <= n; k++) { const i = (((from + dir * k) % n) + n) % n; if (open(i)) return i; } return -1; }
function select(i) { sel = i; paint(); }
function pick(i) { if (state !== 'play' || !open(i)) return; select(i); soft.click(); }
function press(k) {
  if (state !== 'play' || busy) return;
  if (k === '<') { select(next(sel, -1)); soft.click(); return; }
  if (k === '>') { select(next(sel, 1)); soft.click(); return; }
  if (sel < 0 || !open(sel)) select(next(sel));
  if (sel < 0) return;
  const c = cells[sel];
  if (solvedL.has(k)) { ui.pop(`${k} is already placed`, '#7a8f6e', 20, 46); soft.err(); return; }
  if (k === c.ch) return reveal(c.ch, true);
  // wrong letter: one mistake
  mistakes++; soft.err(); buzz([30, 40, 30]);
  c.el.classList.remove('bad'); void c.el.offsetWidth; c.el.classList.add('bad');
  c.el.querySelector('.l').textContent = k; setTimeout(() => { c.el.classList.remove('bad'); paint(); }, 450);
  paint(); c.el.querySelector('.l').textContent = k;
  if (mistakes >= MAXM) lose();
}
function reveal(L, byPlayer) {
  solvedL.add(L);
  const hits = cells.map((c, i) => (c.isL && c.ch === L ? i : -1)).filter(i => i >= 0);
  hits.forEach((i, k) => setTimeout(() => {
    const el = cells[i].el; el.classList.remove('got'); void el.offsetWidth; el.classList.add('got');
    const b = el.getBoundingClientRect(); fx.sparks(b.left + b.width / 2, b.top + b.height / 3, ['#fff', '#9ad19f', '#4f8a5b'], 4, { speed: 2, size: 2.4 });
  }, k * 60));
  chime(solvedL.size % 10, 69, 0.1); buzz(8);
  if (byPlayer) { const p = 5 + hits.length * 2; points += p; dailyPts += p; S.set('points', points); checkBeat(); }
  const left = cells.some((c) => c.isL && !solvedL.has(c.ch));
  sel = left ? next(sel) : -1; paint();
  if (!left) win();
}
hintBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation(); if (state !== 'play' || !hints || busy) return;
  if (sel < 0 || !open(sel)) select(next(sel)); if (sel < 0) return;
  hints--; if (hintUsedAt < 0) hintUsedAt = progressFrac();
  reveal(cells[sel].ch, false);
});
const progressFrac = () => { const ls = cells.filter(c => c.isL); return ls.filter(c => solvedL.has(c.ch) && !givenL.has(c.ch)).length / Math.max(1, ls.filter(c => !givenL.has(c.ch)).length); };
function checkBeat() { const s = D.isDaily ? dailyPts : points; if (!beatenShown && D.beaten(s)) { beatenShown = true; ui.pop('BEATEN!', '#d9604f', 40, 14); fx.confetti(60); } }
function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; if (!D.isDaily) { if (hintUsedAt < 0) F.level(true); else F.level(false, hintUsedAt); } }
  const bonus = (MAXM - mistakes) * 10; points += bonus; dailyPts += bonus; S.set('points', points); paint();
  byEl.classList.add('show');
  cells.forEach((c, i) => setTimeout(() => { c.el.classList.remove('got'); void c.el.offsetWidth; c.el.classList.add('got'); }, i * 18));
  arp([67, 71, 74, 79, 83], 100, 0.12, 0.9); fx.confetti(); buzz([20, 50, 20]);
  const shown = D.isDaily ? dailyPts : points;
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || dailyPts > prev.s) S.set(k, { s: dailyPts }); }
  else { level++; S.set('level', level); }
  D.won(shown, `cracked a ${Q.by === 'Proverb' || /proverb/i.test(Q.by) ? 'proverb' : 'quote by ' + Q.by} with ${mistakes} mistake${mistakes === 1 ? '' : 's'} and scored`);
  setTimeout(() => ui.win(D.isDaily ? '' : level - 1, `“${Q.text}” — ${Q.by}`), 1100);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost';
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, progressFrac()); }
  ui.lose('Out of mistakes', 'Same quote, fresh start');
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
build();

// ---------------------------------------------------------------- test hook: the bot fills the selected blank with the right letter
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return D.isDaily ? dailyPts : points; },
  showQuote(i) { build(i); state = 'play'; ui.els.start.classList.add('hc-hidden'); },   // QA: lay out a specific quote
  bot() {
    if (state !== 'play' || busy) return;
    if (sel < 0 || !open(sel)) { select(next(sel)); return; }
    // a careful solver, but now and then a wrong guess like a real person
    if (mistakes < 1 && Math.random() < 0.06) { const wrong = [...AZ].find(x => x !== cells[sel].ch && !solvedL.has(x)); press(wrong); return; }
    press(cells[sel].ch);
  },
};

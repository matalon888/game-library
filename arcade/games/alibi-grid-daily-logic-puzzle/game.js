// Alibi Grid — original daily deduction puzzle. Twenty townsfolk, each innocent or a criminal. Every revealed card
// gives one true clue; mark people using logic only. The generator guarantees there is always a next card you can prove.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey, fmtTime } from './calm.js';
import { generate, forced, deducible, N, COLS, ROWS, rc, LETTER } from './logic.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
const B = board({ game: 'alibi-grid', label: 'Cases solved', limits: { maxRun: 2, maxPerSec: 0.05 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Alibi Grid: Daily Logic Puzzle';
const S = store('alibigrid');
const F = flow('alibigrid');
const ui = createUI({ title: 'Alibi Grid', hint: 'Tap to open the case', hand: '', score: false });
cardTheme({ accent: '#c8553d' });
const D = daily('alibigrid', ui, { name: NAME });
const fx = fx2d(31);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Today\'s case' : 'deduction puzzle', doneLine: doneToday ? (D.isDaily ? `Solved today · ${doneToday.s} pts` : 'Today\'s case solved ✓') : 'Same case for everyone today' });
{ const p = document.createElement('p'); p.style.cssText = 'font-size:15px;opacity:.82;margin-top:14px;line-height:1.5;max-width:330px'; p.innerHTML = 'Each revealed person tells one true clue.<br>Mark everyone innocent or criminal — no guessing allowed: you need proof.'; ui.els.start.querySelector('.calm-kicker').after(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Today\'s case<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'CASE <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Case closed!';

css(`
body{background:#efe5d3}
#paper{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 110% 70% at 50% 30%,#fbf5ea,#efe4cf 70%,#e2d3b8);}
#paper:after{content:'';position:absolute;inset:0;opacity:.35;background:repeating-linear-gradient(0deg,rgba(120,90,50,.05) 0 1px,transparent 1px 4px)}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:700;color:#fff;background:#c8553d;box-shadow:0 2px 0 rgba(0,0,0,.15)}
.hc-top .hc-lvl.next{background:rgba(42,37,34,.12);color:#6e5f52}
.hc-top .hc-bar{background:rgba(42,37,34,.12);height:8px}.hc-top .hc-bar i{background:#c8553d}
#hdr{position:fixed;left:12px;right:12px;z-index:5;display:flex;align-items:center;justify-content:space-between;color:#2a2522;font-weight:700;font-size:13px;letter-spacing:.5px}
#hdr .mx{display:flex;gap:5px;align-items:center}#hdr .mx i{width:14px;height:14px;border-radius:50%;border:2px solid #c8553d;display:inline-block}#hdr .mx i.on{background:#c8553d}
#hdr .tm{font-variant-numeric:tabular-nums;opacity:.7}
#hdr button{font:inherit;font-weight:800;color:#2a2522;background:#fff;border:1px solid #e0d2bb;border-radius:14px;padding:4px 12px;box-shadow:0 2px 0 #e0d2bb;cursor:pointer}
#grid{position:fixed;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.pc{position:relative;border-radius:14px;background:#fffbf3;border:1.5px solid #e6d9c4;box-shadow:0 3px 0 #e2d3bb,0 6px 12px rgba(80,60,30,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;transition:transform .18s,background .3s,border-color .3s,box-shadow .2s;color:#2a2522;overflow:hidden}
.pc .av{font-size:30px;line-height:1.1;width:44px;height:44px;border-radius:50%;background:#f3e8d6;display:flex;align-items:center;justify-content:center;transition:background .3s}
.pc .nm{font-weight:800;font-size:15px;line-height:1.1;margin-top:3px}
.pc .jb{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.55;font-weight:700}
.pc .co{position:absolute;left:6px;top:4px;font-size:10px;font-weight:800;opacity:.35}
.pc .bd{position:absolute;left:0;right:0;bottom:0;font-size:9.5px;font-weight:900;letter-spacing:1.5px;text-align:center;padding:2px 0;color:#fff;transform:translateY(100%);transition:transform .3s}
.pc .sp{position:absolute;right:5px;top:3px;font-size:12px;opacity:0;transition:opacity .3s}
.pc.inn{background:#e3f4e7;border-color:#7cc394;box-shadow:0 3px 0 #a9d8b8}.pc.inn .av{background:#c6ead0}.pc.inn .bd{background:#3f9a62;transform:none}
.pc.crim{background:#fbe2dd;border-color:#e08a7b;box-shadow:0 3px 0 #efb5aa}.pc.crim .av{background:#f6c4ba}.pc.crim .bd{background:#c8553d;transform:none}
.pc.inn .sp,.pc.crim .sp{opacity:.8}
.pc.inn,.pc.crim{padding-bottom:17px}
.pc.sel{transform:translateY(-3px) scale(1.04);box-shadow:0 0 0 3px #2a2522,0 10px 18px rgba(80,60,30,.2);z-index:2}
.pc.ref{box-shadow:0 0 0 3px #f0b13c,0 6px 12px rgba(80,60,30,.15)}
.pc.flip{animation:flp .5s}
@keyframes flp{0%{transform:rotateY(0)}50%{transform:rotateY(90deg) scale(1.05)}100%{transform:rotateY(0)}}
.pc.shake{animation:shk .36s}
@keyframes shk{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
.pc.wob{animation:wob .45s}
@keyframes wob{30%{transform:rotate(-3deg)}60%{transform:rotate(3deg)}}
.pc.hint{animation:hnt 1s ease-in-out 3}
@keyframes hnt{50%{box-shadow:0 0 0 4px #f0b13c,0 0 22px rgba(240,177,60,.9);transform:scale(1.05)}}
#panel{position:fixed;left:10px;right:10px;z-index:3;background:#fffbf3;border:1.5px solid #e6d9c4;border-radius:18px;box-shadow:0 4px 0 #e2d3bb;display:flex;flex-direction:column;overflow:hidden;color:#2a2522}
#panel h3{margin:0;padding:8px 14px 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.55}
#clues{overflow-y:auto;padding:0 10px 10px;display:flex;flex-direction:column;gap:6px;touch-action:pan-y}
.cl{display:flex;gap:9px;align-items:flex-start;padding:7px 9px;border-radius:12px;background:#f6eedf;font-size:14.5px;line-height:1.35;cursor:pointer;animation:clin .4s}
.cl.new{background:#fff1cf;box-shadow:0 0 0 2px #f0b13c inset}
.cl .a{font-size:20px;line-height:1;flex:none;margin-top:1px}
.cl b{font-weight:800}.cl i{font-style:normal;font-weight:800}.cl i.c{color:#c8553d}.cl i.n{color:#3f9a62}
@keyframes clin{from{opacity:0;transform:translateY(-8px)}}
#ask{position:fixed;left:10px;right:10px;z-index:20;background:#2a2522;color:#fff;border-radius:20px;padding:14px;display:none;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);animation:clin .25s}
#ask .q{text-align:center;font-weight:700;font-size:16px}
#ask .r{display:flex;gap:10px}
#ask button{flex:1;font:inherit;font-weight:800;font-size:18px;border:0;border-radius:14px;padding:13px 0;cursor:pointer;color:#fff}
#ask .bi{background:#3f9a62;box-shadow:0 4px 0 #2b7146}#ask .bc{background:#c8553d;box-shadow:0 4px 0 #94392a}
#ask .x{background:none;color:#fff;opacity:.6;font-size:14px;padding:2px;flex:none}
#toast{position:fixed;left:50%;transform:translateX(-50%);z-index:30;background:#2a2522;color:#fff;font-weight:700;font-size:15px;padding:9px 16px;border-radius:18px;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap}
`);
const paper = document.createElement('div'); paper.id = 'paper'; document.body.prepend(paper);
const hdr = document.createElement('div'); hdr.id = 'hdr'; hdr.innerHTML = '<div class="mx">MISTAKES <i></i><i></i><i></i></div><div class="tm">0:00</div><button>💡 Hint</button>'; document.body.appendChild(hdr);
const grid = document.createElement('div'); grid.id = 'grid'; document.body.appendChild(grid);
const panel = document.createElement('div'); panel.id = 'panel'; panel.innerHTML = '<h3>Clues</h3><div id="clues"></div>'; document.body.appendChild(panel);
const cluesEl = panel.querySelector('#clues');
const ask = document.createElement('div'); ask.id = 'ask'; ask.innerHTML = '<div class="q"></div><div class="r"><button class="bi">😇 Innocent</button><button class="bc">🦹 Criminal</button></div><button class="x">cancel</button>'; document.body.appendChild(ask);
const toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl);
let toastT = 0; const toast = (t, ms = 1500) => { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => toastEl.style.opacity = 0, ms); };
for (const el of [hdr, grid, panel, ask]) el.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, PZ = null, known = [], mistakes = 0, hints = 0, sel = -1, t0 = 0, recorded = false, beatenShown = false, cards = [];
const MAXM = 3;
function layout() {
  const W = innerWidth, H = innerHeight, gw = Math.min(W - 20, 470);
  hdr.style.top = '54px';
  const top = 88, ch = Math.min(108, Math.max(82, (H - top - 230) / ROWS - 7));
  Object.assign(grid.style, { left: (W - gw) / 2 + 'px', width: gw + 'px', top: top + 'px', gridAutoRows: ch + 'px' });
  const gb = top + ROWS * (ch + 7);
  Object.assign(panel.style, { top: gb + 6 + 'px', bottom: '12px', left: (W - gw) / 2 + 'px', right: (W - gw) / 2 + 'px' });
  Object.assign(ask.style, { bottom: '18px', left: (W - gw) / 2 + 6 + 'px', right: (W - gw) / 2 + 6 + 'px' });
  toastEl.style.top = gb - 40 + 'px';
}
addEventListener('resize', layout);

function cons() { const out = []; for (let i = 0; i < N; i++) if (known[i] >= 0) out.push(PZ.clues[i]); return out; }
function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 4 : level;
  const diff = Math.max(0, Math.min(0.95, (0.08 + (L - 1) * 0.1) * fk));
  PZ = generate(D.seed || level * 104729 + 7, diff);
  known = new Array(N).fill(-1); known[PZ.start] = PZ.truth[PZ.start];
  mistakes = 0; hints = 0; sel = -1; score = 0; t0 = 0; recorded = false; beatenShown = false;
  grid.innerHTML = ''; cluesEl.innerHTML = ''; cards = [];
  PZ.people.forEach((p, i) => {
    const [r, c] = rc(i), d = document.createElement('div'); d.className = 'pc';
    d.innerHTML = `<span class="co">${LETTER[c]}${r + 1}</span><span class="sp">💬</span><div class="av">${p.jobInfo.e}</div><div class="nm">${p.name}</div><div class="jb">${p.job}</div><div class="bd"></div>`;
    d.addEventListener('pointerdown', (e) => { e.preventDefault(); tapCard(i); });
    grid.appendChild(d); cards.push(d);
  });
  reveal(PZ.start, true);
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  refresh(); closeAsk();
  cards.forEach((c, i) => { c.style.opacity = 0; c.style.transform = 'translateY(14px)'; setTimeout(() => { c.style.opacity = 1; c.style.transform = ''; }, 40 + i * 28); });
}
function refresh() {
  hdr.querySelectorAll('.mx i').forEach((e, i) => e.classList.toggle('on', i < mistakes));
  ui.progress(known.filter(v => v >= 0).length / N);
}
setInterval(() => { if (state === 'play' && t0) hdr.querySelector('.tm').textContent = fmtTime((performance.now() - t0) / 1000); }, 500);

function reveal(i, silent = false) {
  const v = PZ.truth[i]; known[i] = v;
  const c = cards[i]; c.classList.add(v ? 'crim' : 'inn', 'flip'); c.querySelector('.bd').textContent = v ? 'CRIMINAL' : 'INNOCENT';
  setTimeout(() => c.classList.remove('flip'), 520);
  cluesEl.querySelectorAll('.new').forEach(e => e.classList.remove('new'));
  const cl = document.createElement('div'); cl.className = 'cl new'; cl.dataset.i = i;
  cl.innerHTML = `<span class="a">${PZ.people[i].jobInfo.e}</span><span><b>${PZ.people[i].name}:</b> ${PZ.clues[i].text}</span>`;
  cl.addEventListener('pointerdown', () => showRefs(i));
  cluesEl.prepend(cl); cluesEl.scrollTop = 0;
  if (!silent) {
    const b = c.getBoundingClientRect();
    fx.sparks(b.left + b.width / 2, b.top + b.height / 2, v ? ['#c8553d', '#f0b13c', '#fff'] : ['#3f9a62', '#f0b13c', '#fff'], 14, { speed: 3.2, size: 3.5 });
  }
}
let refT = 0;
function showRefs(i) {
  clearTimeout(refT); cards.forEach(c => c.classList.remove('ref'));
  for (const k of PZ.clues[i].cells) cards[k].classList.add('ref');
  soft.click(); refT = setTimeout(() => cards.forEach(c => c.classList.remove('ref')), 1600);
}

// ---------------------------------------------------------------- input
function tapCard(i) {
  if (state !== 'play') return;
  if (known[i] >= 0) { const cl = cluesEl.querySelector(`[data-i="${i}"]`); if (cl) { cl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); cl.animate([{ background: '#fff1cf' }, { background: '#f6eedf' }], 900); } showRefs(i); return; }
  cards.forEach(c => c.classList.remove('sel')); sel = i; cards[i].classList.add('sel'); soft.click();
  ask.querySelector('.q').innerHTML = `Is <b>${PZ.people[i].name}</b> the ${PZ.people[i].job} innocent or a criminal?`;
  ask.style.display = 'flex';
}
function closeAsk() { ask.style.display = 'none'; cards.forEach(c => c.classList.remove('sel')); sel = -1; }
ask.querySelector('.bi').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (sel >= 0) mark(sel, 0); });
ask.querySelector('.bc').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (sel >= 0) mark(sel, 1); });
ask.querySelector('.x').addEventListener('pointerdown', (e) => { e.stopPropagation(); closeAsk(); });
hdr.querySelector('button').addEventListener('pointerdown', (e) => { e.stopPropagation(); hint(); });

function mark(i, v) {
  if (state !== 'play' || known[i] >= 0) return;
  if (!t0) t0 = performance.now();
  const c = cards[i]; closeAsk();
  if (PZ.truth[i] !== v) {   // wrong: a mistake
    mistakes++; refresh(); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    soft.err(); buzz([30, 40, 30]); ui.flash(0.25); toast(mistakes >= MAXM ? 'Three mistakes — the trail goes cold' : `Wrong! ${PZ.people[i].name} is ${v ? 'not a criminal' : 'not innocent'}… ${MAXM - mistakes} left`);
    if (mistakes >= MAXM) setTimeout(lose, 700);
    return;
  }
  if (forced(cons(), known, i) !== v) {   // right, but not provable yet: no guessing allowed
    c.classList.remove('wob'); void c.offsetWidth; c.classList.add('wob'); soft.wood(); toast('Not enough evidence yet 🤔'); return;
  }
  reveal(i); score += 100; refresh();
  const n = known.filter(x => x >= 0).length; chime(n % 10, 67, 0.12); buzz(8);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#c8553d', 40, 30); fx.confetti(60); }
  if (n === N) setTimeout(win, 450);
}
function hint() {
  if (state !== 'play') return;
  const d = deducible(cons(), known); if (!d.length) return;
  const [i] = d[Math.floor(Math.random() * d.length)]; hints++;
  cards[i].classList.remove('hint'); void cards[i].offsetWidth; cards[i].classList.add('hint');
  toast(`Look closely at ${PZ.people[i].name}`); soft.click();
}

// ---------------------------------------------------------------- end states
function win() {
  if (state !== 'play') return;
  state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); B.submit(1); }
  const secs = t0 ? (performance.now() - t0) / 1000 : 0;
  score = Math.max(0, score + (MAXM - mistakes) * 150 - hints * 50);
  fx.confetti(140, ['#c8553d', '#3f9a62', '#f0b13c', '#2a2522', '#fff']); arp([67, 71, 74, 79, 83], 100, 0.12, 0.9); buzz([20, 60, 20]);
  if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
  else { level++; S.set('level', level); }
  const best = S.get('best', 0); if (score > best) S.set('best', score);
  const crim = PZ.truth.reduce((a, b) => a + b, 0);
  D.won(score);
  ui.win(D.isDaily ? '' : level - 1, `${crim} criminals caught · ${mistakes} mistake${mistakes === 1 ? '' : 's'} · ${fmtTime(secs)} · ${score} pts`);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; const fr = known.filter(x => x >= 0).length / N;
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, fr); }
  ui.lose('Case gone cold', `${Math.round(fr * N)} of ${N} people cleared · tap to reopen the case`);
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play';
});
layout(); build();
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first case, until the first
// touch, the opening clue lights up the people it talks about, then one of them is picked and asked about (never answered)
const DM = demo((n) => {
  const refs = PZ.clues[PZ.start].cells.filter(k => known[k] < 0);
  if (n === 1) { showRefs(PZ.start); return; }
  const i = refs[0]; if (i === undefined) return false;
  tapCard(i); setTimeout(() => { if (!DM.touched && sel === i) closeAsk(); }, 2200); return false;
}, { ready: () => level === 1 && !D.isDaily && state === 'play' && !t0 && sel < 0 && known.filter(v => v >= 0).length === 1, wait: 1800, every: 1900, max: 2 });

// ---------------------------------------------------------------- test hook: the bot marks one provable person per call
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const d = deducible(cons(), known); if (!d.length) return;
    const [i, v] = d[0]; mark(i, v);
  },
};

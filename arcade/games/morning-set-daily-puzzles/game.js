// Morning Set: Daily Puzzles — three puzzles a day (Wordrise: 5-letter word guess, Sunny Side: logic grid, Perfect
// Blend: number target), the same for everyone, seeded by date. Streak with a weekly freeze, spoiler-free share grid,
// archive of past days, sticker album, and a breakfast nook you decorate with stars. Host: Bijou (Hero Lab).
import { THREE, store, loop, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { createScene, DECOR } from './scene.js';
import { createBoards } from './boards.js';
import { snd } from './audio.js';
import * as P from './puzzles.js';

let money;
try { ({ money } = await import('./kit/money.js')); } catch (e) { ({ money } = await import('./money-local.js')); }

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Morning Set: Daily Puzzles';
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const Q = new URLSearchParams(location.search);
const TODAY = P.dayNum();
const YESTERDAY = P.addDays(TODAY, -1);
const week = n => Math.floor((P.setNo(n) + 3) / 7);
const fmtDate = (n, o = { month: 'long', day: 'numeric' }) => P.fromNum(n).toLocaleDateString('en-US', o);

// ---------------------------------------------------------------- saved state
const S = store('morningset');
const sg = (k, d) => { try { return S.get(k, d); } catch (e) { return d; } };
const st = {
  days: sg('days', {}), streak: sg('streak', { n: 0, best: 0, last: 0, freeWeek: -1, extra: 0, frozen: [], broken: null }),
  stars: sg('stars', 0), earned: sg('earned', 0), decor: sg('decor', []), album: sg('album', []), solved: sg('solved', 0), sets: sg('sets', 0),
  seen: sg('seen', {}), hc: sg('hc', false), unlocked: sg('unlocked', []),
};
const save = (...ks) => { for (const k of (ks.length ? ks : Object.keys(st))) try { S.set(k, st[k]); } catch (e) {} };
{ const keys = Object.keys(st.days).map(Number).sort((a, b) => b - a); for (const k of keys.slice(70)) delete st.days[k]; }
const rec = n => st.days[n] || (st.days[n] = { w: { g: [], done: 0, won: 0, hints: 0, extra: 0, hint: [] }, l: { cells: null, done: 0, hints: 0 }, n: { steps: [], done: 0, hints: 0 }, stars: { w: 0, l: 0, n: 0 }, complete: 0 });
const sets = {}; const setOf = n => sets[n] || (sets[n] = P.setFor(n));
const KINDS = ['w', 'l', 'n'];
const META = {
  w: { name: 'Wordrise', rule: 'Guess the word in 6 tries', icon: 'ic-word', glyph: 'W' },
  l: { name: 'Sunny Side', rule: 'One egg per row, column, colour', icon: 'ic-logic' },
  n: { name: 'Perfect Blend', rule: 'Blend numbers into the target', icon: 'ic-number' },
};
const STICKERS = 'f01 f02 f03 f04 f05 f06 f07 f08 f09 f15 f16 f17 g09 g10 g11 g13 g14 g15 t01 t02 t03 t04 t05 t06 t07 t20 t23 t28 t17 h19'.split(' ');
const STICK_NAME = { f01: 'Cappuccino', f02: 'Croissant', f03: 'Pancakes', f04: 'Sprinkle donut', f05: 'Macarons', f06: 'Chocolate cake', f07: 'Milkshake', f08: 'Bubble tea', f09: 'Club sandwich', f15: 'Smoothie', f16: 'Waffle', f17: 'Cinnamon roll', g09: 'Teacup', g10: 'Teapot', g11: 'Tea stand', g13: 'Cupcake', g14: 'Cake slice', g15: 'Strawberry cake', t01: 'Apple', t02: 'Banana', t03: 'Strawberry', t04: 'Watermelon', t05: 'Pineapple', t06: 'Lemon', t07: 'Avocado', t20: 'Ice cream', t23: 'Cherries', t28: 'Sunflower', t17: 'Cactus', h19: 'Marmalade' };
const newbie = () => st.sets < 5;           // first 5 sets: hints are free (near-certain wins)

// ---------------------------------------------------------------- kit layers
const F = flow('morningset');               // records every puzzle; no knob: the daily set is the same for everyone
const D = daily('morningset', null, { name: NAME });
const B = worldBoard({ game: 'morning-set', label: 'Stars from the daily set', limits: { maxRun: 6, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr', accent: '#f5a623' });
const M = money({ game: 'morning-set', style: 'A' });

// ---------------------------------------------------------------- 3D
const SC = createScene();
const BD = createBoards(SC);
SC.onFlip = (m, i) => snd.flip(m, i);

// ---------------------------------------------------------------- DOM
const home = $(`<div id="home">
  <div class="hd"><div class="date"><div class="wd"></div><div class="dt"></div><div class="no"></div></div>
    <div class="right"><button class="chip" data-shop aria-label="Coins and shop"><span class="coin"></span><b data-coins>0</b></button></div></div>
  <div class="chips"><button class="chip streak" data-streak><span class="ic">🔥</span><b>0</b></button><button class="chip" data-starsbtn><span class="ic">⭐</span><b>0</b></button><button class="chip" data-mute aria-label="Sound"><span class="ic">🔊</span></button></div>
  <div id="sheet"></div>
</div>`);
const play = $(`<div id="play" class="hide">
  <div class="ph"><button class="round" data-back aria-label="Back">‹</button><div class="ttl"><b></b><span></span><div class="dots"><i></i><i></i><i></i></div></div><button class="chip" data-shop aria-label="Coins"><span class="coin"></span><b data-coins>0</b></button></div>
  <div class="rule"></div>
  <div id="target" class="hide"><small>Make exactly</small><b>0</b></div>
  <div id="steps" class="hide"></div>
  <div id="ops" class="hide"><button data-op="+">+</button><button data-op="−">−</button><button data-op="×">×</button><button data-op="÷">÷</button></div>
  <div class="tools"></div>
  <div id="kb" class="hide"></div>
</div>`);
document.body.append(home, play);
const sheet = home.querySelector('#sheet');
const el = {
  wd: home.querySelector('.wd'), dt: home.querySelector('.dt'), no: home.querySelector('.no'),
  streak: home.querySelector('[data-streak] b'), starsN: home.querySelector('[data-starsbtn] b'), mute: home.querySelector('[data-mute] .ic'),
  ttl: play.querySelector('.ttl b'), ttlSub: play.querySelector('.ttl span'), dots: [...play.querySelectorAll('.dots i')],
  rule: play.querySelector('.rule'), tools: play.querySelector('.tools'), kb: play.querySelector('#kb'),
  target: play.querySelector('#target'), targetN: play.querySelector('#target b'), ops: play.querySelector('#ops'), steps: play.querySelector('#steps'),
};
for (const b of document.querySelectorAll('[data-shop]')) b.onclick = () => { snd.tap(); M.shop(); };
const paintCoins = () => document.querySelectorAll('[data-coins]').forEach(e => e.textContent = M.coins().toLocaleString());
M.onChange(paintCoins); paintCoins();
el.mute.textContent = snd.muted ? '🔇' : '🔊';
home.querySelector('[data-mute]').onclick = () => { el.mute.textContent = snd.toggle() ? '🔇' : '🔊'; };
home.querySelector('[data-streak]').onclick = () => { snd.tap(); streakCard(); };
home.querySelector('[data-starsbtn]').onclick = () => { snd.tap(); nookCard(); };
play.querySelector('[data-back]').onclick = () => { snd.tap(); goHome(); };
// keep taps on DOM controls from reaching the canvas handlers
for (const t of ['pointerdown', 'pointerup']) { home.addEventListener(t, e => { if (e.target !== home) e.stopPropagation(); }); }

function toast(text, ms = 1500) { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = $(`<div class="toast">${text}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 3200) { bubbleEl?.remove(); bubbleEl = $(`<div class="bubble">${text}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000; placeBubble(); }
function placeBubble() {
  if (!bubbleEl) return; const p = SC.hostScreen(); if (!p || view === 'play') { bubbleEl.style.opacity = 0; return; }
  bubbleEl.style.opacity = 1; bubbleEl.style.left = Math.max(120, Math.min(innerWidth - 120, p.x)) + 'px'; bubbleEl.style.top = Math.max(150, p.y - 6) + 'px';
}
function confetti(n = 70) {
  const cols = ['#ff7d93', '#ffcf5a', '#55b46a', '#6fb1ff', '#c49bff', '#ffa45c'];
  for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'conf'; c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length];
    c.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px'); c.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg'); c.style.animationDuration = 1.6 + Math.random() * 1.4 + 's'; c.style.animationDelay = Math.random() * 0.3 + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 3400); }
}
function coinFly(n, fromX, fromY) {
  const to = [...document.querySelectorAll('[data-shop]')].find(b => b.offsetParent)?.getBoundingClientRect(); if (!to) return;
  for (let i = 0; i < Math.min(10, n); i++) { const c = $(`<span class="burst"><span class="coin"></span></span>`); c.style.left = fromX + (Math.random() - 0.5) * 60 + 'px'; c.style.top = fromY + (Math.random() - 0.5) * 30 + 'px';
    c.style.setProperty('--dx', (to.left + 14 - fromX) + 'px'); c.style.setProperty('--dy', (to.top + 14 - fromY) + 'px'); c.style.animationDelay = i * 0.05 + 's'; document.body.appendChild(c); setTimeout(() => { c.remove(); snd.coin(); }, 1000 + i * 50); }
}

// ---------------------------------------------------------------- overlays (one at a time)
let ov = null, ovKind = '';
function overlay(kind, html, { clear = false, onTap = null } = {}) {
  closeOv(); ovKind = kind;
  ov = $(`<div class="ov ${clear ? 'clear' : ''} ${view === 'play' ? 'mid' : ''}"><div class="card">${html}</div></div>`); document.body.appendChild(ov);
  ['pointerdown', 'pointerup', 'touchstart', 'mousedown'].forEach(t => ov.addEventListener(t, e => e.stopPropagation()));
  const x = ov.querySelector('.x'); if (x) x.onclick = () => { snd.tap(); closeOv(); };
  if (onTap) ov.addEventListener('click', e => { if (!e.target.closest('button')) onTap(); });
  else ov.addEventListener('click', e => { if (e.target === ov && x) closeOv(); });
  return ov;
}
function closeOv() { if (ov) ov.remove(); ov = null; ovKind = ''; }

// ---------------------------------------------------------------- streak (with a free freeze every week)
const freezes = () => (st.streak.freeWeek !== week(TODAY) ? 1 : 0) + st.streak.extra;
function streakNow() {
  const s = st.streak; if (!s.last) return { n: 0, safe: true };
  if (s.last === TODAY || s.last === YESTERDAY) return { n: s.n, safe: true, done: s.last === TODAY };
  const missed = P.daysBetween(s.last, TODAY) - 1;
  return missed <= freezes() ? { n: s.n, safe: true, frozen: missed } : { n: 0, safe: false, lost: s.n };
}
function streakOnComplete() {   // only today's set moves the streak
  const s = st.streak; if (s.last === TODAY) return null;
  let used = 0, broke = null;
  if (!s.last || s.last === YESTERDAY) s.n = s.last ? s.n + 1 : 1;
  else {
    const missed = P.daysBetween(s.last, TODAY) - 1;
    if (missed <= freezes()) {
      for (let i = 1; i <= missed; i++) { s.frozen.push(P.addDays(s.last, i)); if (s.freeWeek !== week(TODAY)) s.freeWeek = week(TODAY); else s.extra--; used++; }
      s.n++;
    } else { broke = s.n; s.broken = { prev: s.n, at: TODAY }; s.n = 1; }
  }
  s.frozen = s.frozen.slice(-30); s.last = TODAY; s.best = Math.max(s.best, s.n); save('streak');
  return { used, broke };
}

// ---------------------------------------------------------------- views
let view = 'home', day = TODAY, kind = null, state = 'ready', t0 = 0;
const isDaily = () => day === TODAY;
function band() {
  const desk = innerWidth >= 900;
  const card = ov?.querySelector('.card');
  if (view === 'result') return desk ? { top: 40, bottom: 40, right: (card?.offsetWidth || 460) + 40 } : { top: 70, bottom: (card?.offsetHeight || 340) - 10 };
  return desk ? { top: 40, bottom: 40, right: sheet.offsetWidth + 40 } : { top: 140, bottom: sheet.offsetHeight + 4 };
}
function setView(v) {
  view = v;
  home.classList.toggle('hide', v !== 'home'); play.classList.toggle('hide', v !== 'play');
  BD.show(v === 'play'); SC.setMode(v === 'play' ? 'play' : 'home', band());
  if (v !== 'play') { el.kb.classList.add('hide'); }
}
function paintHome() {
  const s = setOf(day), r = rec(day), sn = streakNow();
  el.wd.textContent = P.weekday(day); el.dt.textContent = fmtDate(day);
  el.no.textContent = (isDaily() ? `Set #${s.no}` : `From the archive · Set #${s.no}`) + (s.hard ? ' · Hard day' : '');
  el.streak.textContent = sn.n; el.starsN.textContent = st.stars;
  home.querySelector('[data-streak]').classList.toggle('dim', !sn.n);
  const done = KINDS.filter(k => r[k].done).length, next = KINDS.find(k => !r[k].done);
  const line = k => {
    const x = r[k];
    if (!x.done) return `<span class="st ${k === next ? '' : 'go'}">Play</span>`;
    if (k === 'w' && !x.won) return `<span class="st miss">Missed</span>`;
    return `<span class="st done">${'★'.repeat(r.stars[k])}<br><small>Solved</small></span>`;
  };
  const icon = k => `<span class="icon ${META[k].icon}">${META[k].glyph || ''}</span>`;
  const sub = k => k === 'l' ? `${s.logic.N}×${s.logic.N} · ${META[k].rule}` : k === 'n' ? `${s.number.ops} steps · ${META[k].rule}` : META[k].rule;
  const nextDecor = DECOR.find(d => !st.decor.includes(d.id));
  let tail = '';
  if (r.complete) {
    const ms = (() => { const t = new Date(); t.setHours(24, 0, 0, 0); return t - Date.now(); })();
    tail = isDaily() ? `<div class="row2"><span>☀️ Set complete! New set in ${Math.floor(ms / 36e5)}h ${Math.floor(ms / 6e4) % 60}m</span><button class="btn honey" data-share>Share</button></div>`
      : `<div class="row2"><span>Archive set complete</span><button class="btn soft" data-today>Today</button></div>`;
  } else if (!isDaily()) tail = `<div class="row2"><span>Playing ${fmtDate(day, { weekday: 'short', month: 'short', day: 'numeric' })}</span><button class="btn soft" data-today>Back to today</button></div>`;
  sheet.innerHTML = `<h2>${isDaily() ? "Today's set" : 'Archive set'} <span class="tag ${s.hard ? '' : 'easy'}">${s.hard ? 'Hard' : P.weekday(day) === 'Monday' ? 'Gentle' : done + ' of 3'}</span></h2>
    <div class="sub">${nextDecor ? `⭐ ${Math.min(st.stars, nextDecor.cost)}/${nextDecor.cost} to unlock the ${nextDecor.name.toLowerCase()}` : 'Your nook is complete. Beautiful!'}</div>
    ${KINDS.map(k => `<button class="pz" data-k="${k}">${icon(k)}<span class="nm"><b>${META[k].name}</b><span>${sub(k)}</span></span>${line(k)}</button>`).join('')}
    ${tail}
    <div class="tabs"><button data-tab="archive"><img src="assets/ui/t10.webp" alt="">Archive</button><button data-tab="album"><img src="assets/ui/f05.webp" alt="">Album</button><button data-tab="nook"><img src="assets/ui/h02.webp" alt="">Nook${nextDecor && st.stars >= nextDecor.cost ? '<i class="dot"></i>' : ''}</button><button data-tab="shop"><img src="assets/ui/g18.webp" alt="">Shop</button><button data-tab="more"><span style="font-size:30px;line-height:38px">⚙️</span>More</button></div>`;
  sheet.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { snd.tap(); start(b.dataset.k); });
  sheet.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { snd.tap(); ({ archive: archiveCard, album: albumCard, nook: nookCard, shop: () => M.shop(), more: moreCard })[b.dataset.tab](); });
  const sh = sheet.querySelector('[data-share]'); if (sh) sh.onclick = () => share(day);
  const td = sheet.querySelector('[data-today]'); if (td) td.onclick = () => { day = TODAY; paintHome(); };
  requestAnimationFrame(() => SC.setMode('home', band()));
}
function goHome(msg) {
  closeOv(); kind = null; state = 'ready'; setView('home'); paintHome(); SC.host?.play('idle');
  if (msg) say(msg);
}
function greet() {
  const h = new Date().getHours(), r = rec(day);
  if (r.complete) return say(['All done for today. See you tomorrow! ☕', 'Lovely work. Fresh set at midnight!'][TODAY % 2]);
  const sn = streakNow();
  if (sn.frozen) return say(`A freeze saved your ${sn.n}-day streak 🧊`);
  if (!sn.safe && sn.lost > 1) return say(`New streak starts today. You've got this!`);
  say(h < 12 ? (sn.n > 1 ? `Morning! Day ${sn.n + 1} of your streak ☕` : 'Good morning! Coffee\'s hot ☕') : h < 18 ? 'Afternoon puzzle break? ☀️' : 'Evening set by lamplight 🌙');
}

// ---------------------------------------------------------------- start a puzzle
let W = null, L = null, N = null;     // per-puzzle runtime state
function start(k) {
  const r = rec(day);
  if (r[k].done) return result(k, true);
  closeOv(); kind = k; state = 'play'; t0 = performance.now(); setView('play');
  el.ttl.textContent = META[k].name; el.ttlSub.textContent = `${isDaily() ? P.weekday(day) : fmtDate(day, { month: 'short', day: 'numeric' })} · ${KINDS.indexOf(k) + 1} of 3`;
  el.dots.forEach((d, i) => { d.className = KINDS[i] === k ? 'on' : r[KINDS[i]].done ? 'ok' : ''; });
  [el.kb, el.target, el.ops, el.steps].forEach(e => e.classList.add('hide')); el.rule.textContent = ''; el.tools.innerHTML = '';
  if (isDaily()) B.start();
  if (k === 'w') startWord(); else if (k === 'l') startLogic(); else startNumber();
  layout();
  if (!st.seen[k]) tutorial(k);
}
function tools(list) {
  el.tools.innerHTML = list.map(([id, label, cls = 'soft']) => `<button class="btn ${cls}" data-t="${id}">${label}</button>`).join('');
  el.tools.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { snd.tap(); act(b.dataset.t); });
}
const hintLabel = () => newbie() ? '💡 Hint <small>free</small>' : '💡 Hint';
function act(id) {
  if (id === 'hint') return askHint();
  if (kind === 'l') { if (id === 'undo') logicUndo(); if (id === 'clear') logicClear(); }
  if (kind === 'n') { if (id === 'undo') numUndo(); if (id === 'reset') numReset(); }
}
function tutorial(k) {
  const T = {
    w: [['🔤', 'Type any 5-letter word and press <b>Enter</b>.'], ['🟩', '<span class="sw"><b style="background:#55b46a">A</b></span> right letter, right spot. <span class="sw"><b style="background:#f2b03a">B</b></span> in the word, wrong spot. <span class="sw"><b style="background:#a59d95">C</b></span> not in the word.'], ['☕', 'Six tries. No timer, take your time.']],
    l: [['🍳', 'Place one egg in every <b>row</b>, every <b>column</b> and every <b>colour</b>.'], ['🚫', 'Eggs never touch, not even at the corners.'], ['👆', 'Tap once for ×, twice for an egg. Drag to mark × fast.']],
    n: [['🎯', 'Combine the numbers to make the target exactly.'], ['➕', 'Tap a number, an operation, then another number.'], ['↩️', 'Whole numbers only. Undo any time; you have all the time you need.']],
  };
  overlay('tut', `<div class="kick">How to play</div><h3>${META[k].name}</h3><div class="tut">${T[k].map(([i, t]) => `<div><i>${i}</i><span>${t}</span></div>`).join('')}</div><div class="btns"><button class="btn green" data-ok>Got it</button></div>`);
  ov.querySelector('[data-ok]').onclick = () => { snd.tap(); st.seen[k] = 1; save('seen'); closeOv(); };
}

// ---------------------------------------------------------------- layout (px rects for the 3D boards + DOM controls)
function layout() {
  const Wd = innerWidth, H = innerHeight, sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  const head = play.querySelector('.ph').getBoundingClientRect().bottom + 10, col = Math.min(Wd - 24, 480), x0 = (Wd - col) / 2;
  if (!kind) return;
  if (kind === 'w') {
    const kbTop = H - el.kb.offsetHeight - 10;
    const toolsTop = kbTop - 54; el.tools.style.top = toolsTop + 'px';
    el.rule.style.top = (toolsTop - 2) + 'px'; el.rule.style.display = W && W.hintText ? '' : 'none';
    const bottom = toolsTop - (W && W.hintText ? 26 : 10);
    const bw = Math.min(col - 10, 360, (bottom - head) * 0.83); W.board.layout({ x: (Wd - bw) / 2, y: head + 4, w: bw, h: bottom - head - 8 });
  } else if (kind === 'l') {
    const size = Math.min(col - 4, H - head - 210, 560);
    L.board.layout({ x: (Wd - size) / 2, y: head + 14, w: size, h: size });
    el.rule.style.display = ''; el.rule.style.top = (head + size + 34) + 'px';
    el.tools.style.top = Math.min(H - 70, head + size + 96) + 'px';
  } else {
    el.target.style.top = head + 'px';
    const tBottom = head + el.target.offsetHeight + 8;
    const toolsTop = H - 66 - 14; el.tools.style.top = toolsTop + 'px';
    const opsTop = toolsTop - 86; el.ops.style.top = opsTop + 'px';
    const bw = Math.min(col - 4, 420), bh = Math.min(opsTop - tBottom - 64, bw * 0.7);
    const by = tBottom + Math.max(0, (opsTop - tBottom - 56 - bh) / 2);
    el.steps.style.top = (by + bh + 10) + 'px';
    N.board.layout({ x: (Wd - bw) / 2, y: by, w: bw, h: bh });
  }
}

// ---------------------------------------------------------------- Wordrise (5-letter word)
const KB = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'];
function startWord() {
  const r = rec(day).w, ans = setOf(day).word;
  W = { ans, cur: '', rows: 6 + r.extra, busy: false, keys: {}, hintText: '' };
  W.board = BD.word(W.rows); W.board.setHC(st.hc);
  el.kb.classList.remove('hide'); el.kb.classList.toggle('hc', st.hc);
  el.kb.innerHTML = KB.map(row => `<div class="r">${[...row].map(c => c === '>' ? '<button class="wide" data-key="enter">ENTER</button>' : c === '<' ? '<button class="wide" data-key="back" aria-label="Delete">⌫</button>' : `<button data-key="${c}">${c}</button>`).join('')}</div>`).join('');
  el.kb.querySelectorAll('[data-key]').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); key(b.dataset.key); }));
  tools([['hint', hintLabel()]]);
  layout();
  r.g.forEach((g, y) => { for (let x = 0; x < 5; x++) W.board.type(y, x, g[x]); W.board.reveal(y, P.mark(g, ans), g, true); paintKeys(g, P.mark(g, ans)); });
  if (r.hint.length) showWordHint();
}
function paintKeys(g, m) {
  for (let i = 0; i < 5; i++) { const c = g[i]; W.keys[c] = Math.max(W.keys[c] ?? -1, m[i]); }
  el.kb.querySelectorAll('[data-key]').forEach(b => { const v = W.keys[b.dataset.key]; b.classList.remove('k0', 'k1', 'k2'); if (v != null && v >= 0) b.classList.add('k' + v); });
}
function key(k) {
  if (kind !== 'w' || state !== 'play' || W.busy || ov) return;
  const r = rec(day).w, y = r.g.length;
  if (k === 'enter') return submitWord();
  if (k === 'back') { if (!W.cur.length) return; W.cur = W.cur.slice(0, -1); W.board.type(y, W.cur.length, ''); snd.key(); return; }
  if (W.cur.length >= 5 || !/^[a-z]$/.test(k)) return;
  W.board.type(y, W.cur.length, k); W.cur += k; snd.key(); buzz(6);
}
addEventListener('keydown', e => {
  if (kind !== 'w' || e.metaKey || e.ctrlKey) return;
  if (e.key === 'Enter') key('enter'); else if (e.key === 'Backspace') key('back'); else if (/^[a-zA-Z]$/.test(e.key)) key(e.key.toLowerCase());
});
async function submitWord() {
  const r = rec(day).w, y = r.g.length, g = W.cur;
  if (g.length < 5) { W.board.shake(y); snd.bad(); return toast('Not enough letters'); }
  if (!P.VALID.has(g) && g !== W.ans) { W.board.shake(y); snd.bad(); buzz([10, 40, 10]); return toast('Not in word list'); }
  W.busy = true; const m = P.mark(g, W.ans);
  r.g.push(g); W.cur = ''; save('days');
  await W.board.reveal(y, m, g);
  paintKeys(g, m);
  if (!m.every(v => v === 2)) W.busy = false;
  if (m.every(v => v === 2)) {
    await W.board.dance(y);
    const n = r.g.length, stars = Math.max(1, (r.extra ? 1 : n <= 3 ? 3 : n <= 5 ? 2 : 1) - r.hints);
    return finish('w', true, stars, ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!', 'Saved it!'][Math.min(6, n - 1)]);
  }
  if (r.g.length >= W.rows) outOfGuesses();
}
function outOfGuesses() {
  const r = rec(day).w;
  overlay('oog', `<div class="kick">Out of guesses</div><h3>So close!</h3><p>Want one more try at it?</p><div class="btns">${!r.extra ? `<button class="btn honey" data-more>▶ One more guess <small>short video</small></button>` : ''}<button class="btn soft" data-reveal>Show the word</button></div>`);
  const mo = ov.querySelector('[data-more]');
  if (mo) mo.onclick = async () => { closeOv(); if (await M.rewarded('moves', { title: 'One more guess', what: "A 7th try at today's word" })) { r.extra = 1; save('days'); startWord(); layout(); toast('One more guess!'); } else outOfGuesses(); };
  ov.querySelector('[data-reveal]').onclick = () => { closeOv(); finish('w', false, 0); };
}
function showWordHint() {
  const r = rec(day).w; const pos = r.hint;
  W.hintText = '💡 ' + pos.map(i => `Letter ${i + 1} is <b>${W.ans[i].toUpperCase()}</b>`).join(' · ');
  el.rule.innerHTML = W.hintText; for (const i of pos) { W.keys[W.ans[i]] = 2; } paintKeys('     ', [-1, -1, -1, -1, -1]); layout();
}
function hintWord() {
  const r = rec(day).w, known = new Set(r.hint);
  for (const g of r.g) for (let i = 0; i < 5; i++) if (g[i] === W.ans[i]) known.add(i);
  const free = [0, 1, 2, 3, 4].filter(i => !known.has(i)); if (!free.length) return toast('You already have every letter!');
  r.hint.push(free[0]); r.hints++; save('days'); showWordHint(); snd.sparkle();
}

// ---------------------------------------------------------------- Sunny Side (logic grid)
function startLogic() {
  const s = setOf(day).logic, r = rec(day).l;
  if (!r.cells) r.cells = [...Array(s.N)].map(() => new Array(s.N).fill(0));
  L = { s, hist: [], drag: null };
  L.board = BD.logic(s.N, s.reg);
  tools([['undo', '↩ Undo'], ['clear', 'Clear'], ['hint', hintLabel()]]);
  el.rule.innerHTML = 'One egg in every row, column and colour.<br>Eggs never touch, not even diagonally.';
  layout();
  for (let y = 0; y < s.N; y++) for (let x = 0; x < s.N; x++) if (r.cells[y][x]) L.board.set(y, x, r.cells[y][x], true);
  logicCheck(false);
}
function logicSet(y, x, v, record = true) {
  const c = rec(day).l.cells; if (c[y][x] === v) return;
  if (record) L.hist.push([y, x, c[y][x]]);
  c[y][x] = v; L.board.set(y, x, v); if (v === 2) { snd.egg(); buzz(10); } else snd.mark();
}
function logicCheck(final = true) {
  const s = L.s, c = rec(day).l.cells, Nn = s.N, eggs = [];
  for (let y = 0; y < Nn; y++) for (let x = 0; x < Nn; x++) if (c[y][x] === 2) eggs.push([y, x]);
  const bad = new Set();
  for (let i = 0; i < eggs.length; i++) for (let j = i + 1; j < eggs.length; j++) {
    const [a, b] = [eggs[i], eggs[j]];
    if (a[0] === b[0] || a[1] === b[1] || s.reg[a[0]][a[1]] === s.reg[b[0]][b[1]] || (Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1)) { bad.add(a.join()); bad.add(b.join()); }
  }
  L.board.conflicts(bad);
  if (final && eggs.length === Nn && !bad.size) {
    const r = rec(day).l; save('days');
    L.board.celebrate(); finish('l', true, Math.max(1, 3 - r.hints), ['Sunny side up!', 'Egg-cellent!', 'Perfectly placed!'][P.setNo(day) % 3]);
    return true;
  }
  save('days'); return false;
}
function logicUndo() { const h = L.hist.pop(); if (!h) return; const [y, x, v] = h; logicSet(y, x, v, false); logicCheck(); }
function logicClear() { const c = rec(day).l.cells; for (let y = 0; y < L.s.N; y++) for (let x = 0; x < L.s.N; x++) if (c[y][x]) logicSet(y, x, 0); logicCheck(); }
function hintLogic() {
  const s = L.s, c = rec(day).l.cells, r = rec(day).l;
  for (let y = 0; y < s.N; y++) for (let x = 0; x < s.N; x++) if (c[y][x] === 2 && s.sol[y] !== x) { logicSet(y, x, 0); logicCheck(); r.hints++; save('days'); return toast("That egg doesn't belong there"); }
  const rows = [...Array(s.N).keys()].filter(y => c[y][s.sol[y]] !== 2);
  if (!rows.length) return;
  // the row whose region is smallest is the most "teachable" next step
  const size = g => s.reg.flat().filter(v => v === g).length;
  rows.sort((a, b) => size(s.reg[a][s.sol[a]]) - size(s.reg[b][s.sol[b]]));
  const y = rows[0], x = s.sol[y]; logicSet(y, x, 2); r.hints++; save('days'); snd.sparkle();
  logicCheck();
}
// pointer: tap cycles empty → × → egg; drag across cells marks ×
SC.R.domElement.addEventListener('pointerdown', e => {
  if (view !== 'play' || state !== 'play' || ov) return;
  if (kind === 'l') { const p = L.board.pick(e.clientX, e.clientY); if (!p) return; L.drag = { start: p, moved: false, last: p.y + ',' + p.x }; }
  if (kind === 'n') numTap(N.board.pick(e.clientX, e.clientY));
});
SC.R.domElement.addEventListener('pointermove', e => {
  if (kind !== 'l' || !L || !L.drag) return; const p = L.board.pick(e.clientX, e.clientY); if (!p) return;
  const k = p.y + ',' + p.x; if (k === L.drag.last) return; L.drag.last = k;
  const c = rec(day).l.cells;
  if (!L.drag.moved) { L.drag.moved = true; const s0 = L.drag.start; if (!c[s0.y][s0.x]) logicSet(s0.y, s0.x, 1); }
  if (!c[p.y][p.x]) logicSet(p.y, p.x, 1);
});
addEventListener('pointerup', () => {
  if (kind !== 'l' || !L || !L.drag) return; const d = L.drag; L.drag = null;
  if (!d.moved && state === 'play') { const c = rec(day).l.cells; logicSet(d.start.y, d.start.x, (c[d.start.y][d.start.x] + 1) % 3); }
  if (state === 'play') logicCheck();
});

// ---------------------------------------------------------------- Perfect Blend (numbers)
function startNumber() {
  const s = setOf(day).number, r = rec(day).n;
  N = { s, vals: s.nums.slice(), sel: -1, op: null, busy: false, hist: [] };
  for (const [a, op, b] of r.steps) applyStep(a, op, b, true);
  N.board = BD.number();
  el.target.classList.remove('hide'); el.ops.classList.remove('hide'); el.steps.classList.remove('hide');
  el.targetN.textContent = s.target;
  el.ops.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { snd.tap(); numOp(b.dataset.op); });
  tools([['undo', '↩ Undo'], ['reset', 'Reset'], ['hint', hintLabel()]]);
  el.rule.style.display = 'none';
  layout(); numPaint();
}
function applyStep(ai, op, bi, silent) {   // indices into vals
  const a = N.vals[ai], b = N.vals[bi], v = P.apply(a, op, b);
  N.hist.push({ vals: N.vals.slice(), step: [a, op, b, v] });
  N.vals[bi] = v; N.vals[ai] = null; return v;
}
function numPaint() {
  N.board.show(N.vals, N.sel);
  el.ops.querySelectorAll('[data-op]').forEach(b => b.classList.toggle('on', b.dataset.op === N.op));
  el.steps.innerHTML = N.hist.map(h => `<span>${h.step[0]} ${h.step[1]} ${h.step[2]} = <b>${h.step[3]}</b></span>`).join('') || '<span style="opacity:.75">Tap a number to start</span>';
}
async function numTap(i) {
  if (i < 0 || N.busy || state !== 'play') return;
  if (N.sel < 0) { N.sel = i; snd.tap(); N.board.lift(i, true); return numPaint(); }
  if (N.sel === i) { N.board.lift(i, false); N.sel = -1; N.op = null; return numPaint(); }
  if (!N.op) { N.board.lift(N.sel, false); N.sel = i; N.board.lift(i, true); snd.tap(); return numPaint(); }
  const a = N.vals[N.sel], b = N.vals[i], v = P.apply(a, N.op, b);
  if (!(v > 0) || !Number.isInteger(v)) { N.board.wobble(i); snd.bad(); toast(N.op === '÷' ? "That doesn't divide evenly" : 'Whole numbers above zero only'); return; }
  N.busy = true; const ai = N.sel;
  await N.board.merge(ai, i);
  applyStep(ai, N.op, i); rec(day).n.steps.push([ai, N.op, i]); save('days');
  N.sel = i; N.op = null; numPaint(); N.board.pop(i); snd.merge(N.hist.length); buzz(12); N.busy = false;
  if (v === N.s.target) {
    N.busy = true; N.sel = -1; numPaint(); await N.board.celebrate(i);
    const r = rec(day).n; finish('n', true, Math.max(1, 3 - r.hints), ['Perfect blend!', 'Right on target!', 'Just right!'][P.setNo(day) % 3]);
  }
}
function numOp(op) { if (state !== 'play') return; if (N.sel < 0) return toast('Pick a number first'); N.op = N.op === op ? null : op; numPaint(); }
function numUndo() { const h = N.hist.pop(); if (!h) return; N.vals = h.vals; rec(day).n.steps.pop(); save('days'); N.sel = -1; N.op = null; numPaint(); snd.swap(); }
function numReset() { if (!N.hist.length) return; N.vals = N.s.nums.slice(); N.hist = []; rec(day).n.steps = []; save('days'); N.sel = -1; N.op = null; numPaint(); snd.swap(); }
function hintNumber() {
  const r = rec(day).n, pool = N.vals.filter(v => v != null);
  let step = null;
  if (!N.hist.length) step = N.s.steps[0];
  else if (pool.length <= 5) { const p = P.solveNum(pool, N.s.target, pool.length - 1); if (p) step = p[0]; }
  if (!step) { numReset(); step = N.s.steps[0]; toast('That path is stuck. Fresh start!'); }
  const [a, op, b] = step, ai = N.vals.indexOf(a); let bi = N.vals.findIndex((v, k) => v === b && k !== ai);
  r.hints++; save('days'); snd.sparkle();
  N.sel = ai; N.op = op; numPaint(); N.board.lift(ai, true);
  if (bi >= 0) N.board.wobble(bi);
  setTimeout(() => toast(`Try ${a} ${op} ${b}`, 2200), 60);
  N.hintNext = bi;
}

// ---------------------------------------------------------------- hints (free for new players, then coins or an opt-in video)
const HINT_COST = 20;
function askHint() {
  if (state !== 'play') return;
  if (newbie()) return useHint();
  overlay('hint', `<button class="x" aria-label="Close">✕</button><div class="kick">Need a nudge?</div><h3>Use a hint</h3><p>A hint costs one ★ on this puzzle.</p><div class="btns"><button class="btn honey" data-coins ${M.coins() < HINT_COST ? 'disabled style="opacity:.5"' : ''}><span class="coin"></span> Use ${HINT_COST} coins</button><button class="btn soft" data-ad>▶ Free hint <small>short video</small></button></div>`);
  ov.querySelector('[data-coins]').onclick = () => { if (M.spend(HINT_COST, 'hint')) { closeOv(); useHint(); } };
  ov.querySelector('[data-ad]').onclick = async () => { closeOv(); if (await M.rewarded('hint', { what: 'One hint on this puzzle' })) useHint(); };
}
function useHint() { if (kind === 'w') hintWord(); else if (kind === 'l') hintLogic(); else hintNumber(); }

// ---------------------------------------------------------------- finishing a puzzle
async function finish(k, won, stars, cheer = '') {
  const r = rec(day); if (r[k].done) return;
  r[k].done = 1; if (k === 'w') r.w.won = won ? 1 : 0; r.stars[k] = won ? stars : 0; r[k].ms = Math.round(performance.now() - t0);
  F.level(won, won ? 1 : 0.5);
  let coins = 0;
  if (won) {
    st.stars += stars; st.earned += stars; st.solved++; coins = 5 + stars * 5; M.add(coins, 'solve');
    if (isDaily()) B.submit(stars, { ms: r[k].ms });
    snd.win(); confetti(60); buzz([20, 40, 30]);
  } else snd.lose();
  r.lastCoins = coins; save();
  state = won ? 'won' : 'lost';
  await wait(won ? 700 : 500);
  result(k, false, cheer);
}
function starsHtml(n) { return `<div class="stars">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}" style="transition-delay:${0.15 + i * 0.18}s">⭐</i>`).join('')}</div>`; }
function result(k, review = false, cheer = '') {
  const r = rec(day), x = r[k], won = k !== 'w' || x.won, s = setOf(day);
  if (!review) state = won ? 'won' : 'lost';
  const nextK = KINDS.find(q => !r[q].done);
  const detail = k === 'w' ? `<div class="big">${s.word.toUpperCase()}</div><p>${won ? `Solved in ${r.w.g.length}/${6 + r.w.extra}` : 'The word of the day'}${r.w.hints ? ` · ${r.w.hints} hint${r.w.hints > 1 ? 's' : ''}` : ''}</p>`
    : k === 'l' ? `<p>${s.logic.N}×${s.logic.N} grid${x.ms ? ` · ${Math.floor(x.ms / 60000)}:${String(Math.floor(x.ms / 1000) % 60).padStart(2, '0')}` : ''}${x.hints ? ` · ${x.hints} hint${x.hints > 1 ? 's' : ''}` : ' · no hints'}</p>`
    : `<p>${s.number.target} in ${x.steps.length} steps${x.hints ? ` · ${x.hints} hint${x.hints > 1 ? 's' : ''}` : ''}</p>`;
  const coins = review ? 0 : r.lastCoins || 0;
  overlay('result', `<div class="kick">${META[k].name} · ${won ? 'Solved' : 'Not this time'}</div><h3>${won ? (cheer || 'Lovely!') : 'Better luck tomorrow'}</h3>${starsHtml(won ? r.stars[k] : 0)}${detail}
    ${coins ? `<div><span class="reward"><span class="coin"></span>+${coins}</span><span class="reward">⭐ +${r.stars[k]}</span></div>` : ''}
    <div class="btns">${coins ? `<button class="btn soft" data-double>▶ Double coins <small>short video</small></button>` : ''}<button class="btn green" data-next>${nextK ? `Next: ${META[nextK].name} →` : r.complete ? 'Done' : 'See your set →'}</button></div>`, { onTap: () => cont() });
  requestAnimationFrame(() => ov && ov.querySelectorAll('.stars i').forEach(i => i.classList.contains('on') && (i.style.transform = 'scale(1)')));
  ov.querySelectorAll('.stars i.on').forEach((s2, i) => setTimeout(() => snd.star(i), 250 + i * 180));
  const dbl = ov.querySelector('[data-double]');
  if (dbl) dbl.onclick = async () => { const ok = await M.rewarded('double'); if (ok) { M.add(coins, 'double'); r.lastCoins = 0; save('days'); dbl.remove(); const rc = dbl.getBoundingClientRect(); coinFly(coins, innerWidth / 2, innerHeight * 0.6); toast(`+${coins} coins`); } };
  ov.querySelector('[data-next]').onclick = () => cont();
  if (coins) setTimeout(() => coinFly(coins, innerWidth / 2, innerHeight * 0.62), 500);
  r.lastCoins = 0;
  function cont() { snd.tap(); closeOv(); if (nextK) start(nextK); else if (!review && !r.complete) setDone(); else goHome(); }
  view = 'result'; home.classList.add('hide'); play.classList.add('hide'); BD.show(false); el.kb.classList.add('hide');
  SC.setMode('home', band());
  if (SC.host) { SC.host.play(won ? 'cheer' : 'fall', true); }
  say(won ? ['Yes! ✨', 'Brilliant!', 'You did it!', 'So smart!'][(P.setNo(day) + KINDS.indexOf(k)) % 4] : 'Oof! Tomorrow is a new word 💛', 2600);
}

// ---------------------------------------------------------------- the whole set is done
function setDone() {
  const r = rec(day); r.complete = 1; st.sets++;
  const total = r.stars.w + r.stars.l + r.stars.n;
  const sticker = STICKERS[st.album.length % STICKERS.length]; st.album.push({ d: day, s: sticker, gold: total === 9 ? 1 : 0 });
  M.add(20, 'set'); const sk = isDaily() ? streakOnComplete() : null;
  save(); state = 'won';
  const sn = st.streak;
  overlay('set', `<div class="kick">${isDaily() ? `Set #${setOf(day).no} complete` : `Archive · ${fmtDate(day)}`}</div><h3>${total >= 8 ? 'What a morning!' : total >= 5 ? 'Lovely set!' : 'Set complete!'}</h3>
    <div style="display:flex;justify-content:center;gap:14px;align-items:center;margin:8px 0">
      <div><img src="assets/stickers/${sticker}.webp" style="width:84px;height:84px;object-fit:contain;filter:drop-shadow(0 6px 6px rgba(100,60,20,.3));animation:stk .8s cubic-bezier(.3,1.8,.5,1)"><div style="font-weight:800;font-size:13px;color:#9a6a3c">${total === 9 ? 'Gold sticker!' : 'New sticker'}<br>${STICK_NAME[sticker]}</div></div>
      <div style="text-align:left"><div class="reward">⭐ ${total}/9</div><br>${isDaily() ? `<div class="reward">🔥 ${sn.n} day${sn.n > 1 ? 's' : ''}</div>` : ''}<br><div class="reward"><span class="coin"></span>+20</div></div></div>
    ${sk && sk.used ? `<p>🧊 A streak freeze covered the day you missed.</p>` : ''}
    ${sk && sk.broke > 1 ? `<p>Your ${sk.broke}-day streak had a gap. <button class="btn soft" data-revive style="font-size:15px;padding:8px 12px;margin-top:6px">▶ Bring back ${sk.broke + 1} days <small>video</small></button></p>` : ''}
    <div class="grid">${shareText(day, false)}</div>
    <div class="btns"><button class="btn honey" data-share>Share my grid</button><button class="btn soft" data-home>Back to the nook</button></div>`, { onTap: () => { closeOv(); goHome(); afterSet(); } });
  ov.querySelector('[data-share]').onclick = () => share(day);
  ov.querySelector('[data-home]').onclick = () => { snd.tap(); closeOv(); goHome(); afterSet(); };
  const rv = ov.querySelector('[data-revive]');
  if (rv) rv.onclick = async () => { if (await M.rewarded('revive', { title: 'Streak rescue', what: `Your ${sk.broke + 1}-day streak back` })) { st.streak.n = st.streak.broken.prev + 1; st.streak.best = Math.max(st.streak.best, st.streak.n); st.streak.broken = null; save('streak'); rv.parentElement.innerHTML = `🔥 Streak restored: ${st.streak.n} days!`; snd.win(); } };
  confetti(110); snd.win(); SC.host?.play('cheer', true); say('A whole set! I\'m so proud ☀️', 3000);
  B.open && 0;
}
async function afterSet() {
  const d = DECOR.find(x => !st.decor.includes(x.id) && (!x.needs || st.decor.includes(x.needs)));
  if (d && st.stars >= d.cost) say(`You have ⭐ ${st.stars}. Shall we add the ${d.name.toLowerCase()}? Tap Nook!`, 4200);
  await M.breakAd('level-end', { level: st.solved });
}

// ---------------------------------------------------------------- share grid (spoiler-free)
function shareText(n, withUrl = true) {
  const r = rec(n), s = setOf(n), hc = st.hc;
  const sq = [hc ? '⬜' : '⬜', hc ? '🟦' : '🟨', hc ? '🟧' : '🟩'];
  const rows = r.w.g.map(g => P.mark(g, s.word).map(v => sq[v]).join('')).join('\n');
  const wl = `Wordrise ${r.w.won ? r.w.g.length : 'X'}/${6 + r.w.extra}${r.w.hints ? ' 💡' : ''}`;
  const ll = `Sunny Side ${r.l.done ? '🥚' : '—'} ${s.logic.N}×${s.logic.N}${r.l.hints ? ' 💡' + r.l.hints : ''}`;
  const nl = `Perfect Blend ${r.n.done ? '🎯' : '—'} ${r.n.steps.length} step${r.n.steps.length === 1 ? '' : 's'}${r.n.hints ? ' 💡' + r.n.hints : ''}`;
  const tot = r.stars.w + r.stars.l + r.stars.n, sn = streakNow().n;
  const url = location.origin + location.pathname;
  return `Morning Set #${s.no} ☀️\n${wl}\n${rows}\n${ll}\n${nl}\n⭐ ${tot}/9${n === TODAY && sn ? `  🔥 ${sn}` : ''}${withUrl ? '\n' + url : ''}`;
}
async function share(n) {
  snd.tap(); const text = shareText(n);
  try { if (navigator.share) { await navigator.share({ title: NAME, text }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text); toast('Copied! Paste it anywhere 📋'); } catch (e) { toast('Could not copy'); }
}

// ---------------------------------------------------------------- side cards: streak, archive, album, nook, more
function streakCard() {
  const s = st.streak, sn = streakNow(), fz = freezes(), strip = [];
  for (let i = 13; i >= 0; i--) { const n = P.addDays(TODAY, -i), r = st.days[n]; strip.push(`<button class="${r && r.complete ? 'done' : s.frozen.includes(n) ? 'frz' : ''} ${n === TODAY ? 'today' : ''}" disabled style="opacity:1">${P.fromNum(n).getDate()}<small>${r && r.complete ? '✓' : s.frozen.includes(n) ? '🧊' : ''}</small></button>`); }
  overlay('streak', `<button class="x" aria-label="Close">✕</button><div class="kick">Your streak</div><h3>🔥 ${sn.n} day${sn.n === 1 ? '' : 's'}</h3><p>Best: ${s.best} · Finish today's set to keep it going.</p>
    <div class="cal">${strip.join('')}</div>
    <div class="row2"><span>🧊 Freezes ready: <b>${fz}</b><br><small style="font-weight:700;color:#7a675d">One free every week. A freeze covers a day you miss.</small></span></div>
    <div class="row2"><span>Extra freeze</span><button class="btn honey" data-buy ${s.extra >= 2 || M.coins() < 60 ? 'disabled style="opacity:.5"' : ''}><span class="coin"></span> 60</button></div>`);
  ov.querySelector('[data-buy]').onclick = () => { if (st.streak.extra < 2 && M.spend(60, 'freeze')) { st.streak.extra++; save('streak'); snd.coin(); streakCard(); } };
}
const ARCH_FREE = 7, ARCH_COST = 40;
function archiveCard() {
  const cells = [], start = P.addDays(TODAY, -(34 - (6 - P.fromNum(TODAY).getDay())));
  for (let i = 0; i < 35; i++) {
    const n = P.addDays(start, i), r = st.days[n], fut = n > TODAY, age = P.daysBetween(n, TODAY);
    const lock = !fut && age > ARCH_FREE && !st.unlocked.includes(n) && !M.hasPass() && !(r && KINDS.some(k => r[k].done));
    const cls = fut ? '' : r && r.complete ? 'done' : r && KINDS.some(k => r[k].done) ? 'part' : lock ? 'lock' : '';
    cells.push(`<button data-d="${n}" class="${cls} ${n === TODAY ? 'today' : ''}" ${fut ? 'disabled' : ''}>${P.fromNum(n).getDate()}<small>${fut ? '' : r && r.complete ? '★' + (r.stars.w + r.stars.l + r.stars.n) : lock ? '🔒' : ''}</small></button>`);
  }
  overlay('archive', `<button class="x" aria-label="Close">✕</button><div class="kick">Archive</div><h3>Past sets</h3><p>The last ${ARCH_FREE} days are free. Older sets unlock for ${ARCH_COST} coins (free with the season pass).</p>
    <div class="cal">${'SMTWTFS'.split('').map(c => `<span class="h">${c}</span>`).join('')}${cells.join('')}</div>`);
  ov.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    const n = +b.dataset.d; snd.tap();
    if (b.classList.contains('lock')) {
      overlay('unlock', `<button class="x" aria-label="Close">✕</button><div class="kick">${fmtDate(n, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h3>Unlock this set?</h3><p>Three puzzles from the archive, yours to keep.</p><div class="btns"><button class="btn honey" data-y ${M.coins() < ARCH_COST ? 'disabled style="opacity:.5"' : ''}><span class="coin"></span> ${ARCH_COST} coins</button><button class="btn soft" data-back>Back</button></div>`);
      ov.querySelector('[data-y]').onclick = () => { if (M.spend(ARCH_COST, 'archive')) { st.unlocked.push(n); save('unlocked'); openDay(n); } };
      ov.querySelector('[data-back]').onclick = () => archiveCard();
      return;
    }
    openDay(n);
  });
}
function openDay(n) { closeOv(); day = n; goHome(); say(n === TODAY ? "Back to today's set!" : `${fmtDate(n, { weekday: 'long' })}'s set. Enjoy! 📅`); }
function albumCard() {
  const got = st.album, page = Math.floor(Math.max(0, got.length - 1) / STICKERS.length), base = page * STICKERS.length;
  overlay('album', `<button class="x" aria-label="Close">✕</button><div class="kick">Sticker album${page ? ` · page ${page + 1}` : ''}</div><h3>Breakfast club</h3><p>${got.length - base}/${STICKERS.length} stickers. Finish a set to earn one; ⭐ 9/9 makes it gold.</p>
    <div class="album">${STICKERS.map((id, i) => { const g = got[base + i]; return `<div class="${g ? (g.gold ? 'gold' : '') : 'no'} ${g && base + i === got.length - 1 ? 'new' : ''}" title="${g ? STICK_NAME[id] : '?'}"><img src="assets/stickers/${id}.webp" alt=""></div>`; }).join('')}</div>`);
}
function nookCard() {
  overlay('nook', `<button class="x" aria-label="Close">✕</button><div class="kick">Decorate the nook</div><h3>⭐ ${st.stars} to spend</h3><p>Every solved puzzle earns stars. Spend them to make the nook yours.</p>
    <div class="nook">${DECOR.map(d => { const own = st.decor.includes(d.id), need = d.needs && !st.decor.includes(d.needs);
      return `<div class="it ${own ? 'own' : ''}"><b>${d.name}</b>${own ? '<span class="no">Placed ✓</span>' : need ? `<span class="no">Needs the ${DECOR.find(x => x.id === d.needs).name.toLowerCase()}</span>` : `<button class="btn ${st.stars >= d.cost ? 'honey' : 'soft'}" data-buy="${d.id}" ${st.stars < d.cost ? 'disabled style="opacity:.6"' : ''}>⭐ ${d.cost}</button>`}</div>`; }).join('')}</div>`);
  ov.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyDecor(b.dataset.buy));
}
async function buyDecor(id) {
  const d = DECOR.find(x => x.id === id); if (!d || st.stars < d.cost || st.decor.includes(id)) return;
  st.stars -= d.cost; st.decor.push(id); save('stars', 'decor'); closeOv();
  if (view !== 'home') goHome(); else paintHome();
  await SC.placeDecor(d, true); snd.place(); confetti(40); SC.host?.play('cheer', true);
  say(['I love it! 😍', 'So cozy!', 'Perfect spot!', 'The nook is glowing!'][st.decor.length % 4]);
}
function moreCard() {
  overlay('more', `<button class="x" aria-label="Close">✕</button><div class="kick">Settings</div><h3>Make it yours</h3>
    <div class="row2"><span>Sound &amp; music</span><button class="btn soft" data-snd>${snd.muted ? 'Off' : 'On'}</button></div>
    <div class="row2"><span>High-contrast tiles<br><small style="font-weight:700;color:#7a675d">Orange &amp; blue instead of green &amp; gold</small></span><button class="btn soft" data-hc>${st.hc ? 'On' : 'Off'}</button></div>
    <div class="row2"><span>How to play</span><span><button class="btn soft" data-tut="w">W</button> <button class="btn soft" data-tut="l">🍳</button> <button class="btn soft" data-tut="n">±</button></span></div>
    <p style="font-size:13px;margin-top:12px">Same three puzzles for everyone, every day. Untimed. Unrigged. Word list: SCOWL (see words.js).</p>`);
  ov.querySelector('[data-snd]').onclick = () => { el.mute.textContent = snd.toggle() ? '🔇' : '🔊'; moreCard(); };
  ov.querySelector('[data-hc]').onclick = () => { st.hc = !st.hc; save('hc'); moreCard(); };
  ov.querySelectorAll('[data-tut]').forEach(b => b.onclick = () => tutorial(b.dataset.tut));
}

// ---------------------------------------------------------------- loop, resize, boot
addEventListener('resize', () => { SC.resize(); if (view === 'play') layout(); else SC.setMode('home', band()); });
let last = performance.now();
loop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  SC.update(dt); BD.update(dt); SC.render(dt);
  if (bubbleEl) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) { bubbleEl.remove(); bubbleEl = null; } }
});
document.addEventListener('pointerdown', () => { snd.unlock(); snd.music(true); }, { once: true });

async function boot() {
  const bar = document.querySelector('#load b'); let n = 0; const tick = () => { n++; bar.style.width = Math.min(100, n / 4 * 100) + '%'; };
  await document.fonts.load('800 40px Nunito').catch(() => {}); tick();
  setOf(TODAY); tick();
  await SC.ready; tick();
  await Promise.all(DECOR.filter(d => st.decor.includes(d.id)).map(d => SC.placeDecor(d)));
  await SC.hostReady; tick();
  const dq = +Q.get('date'); if (dq && dq <= TODAY && dq > 20251231 && P.fromNum(dq).getDate()) day = dq;
  setView('home'); paintHome(); SC.snap();
  const ld = document.getElementById('load'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 500);
  setTimeout(greet, 700);
  if (D.isDaily || Q.get('date')) { const k = KINDS.find(q => !rec(day)[q].done); if (k) setTimeout(() => start(k), 900); }
}
boot().catch(e => console.error(e));

// ---------------------------------------------------------------- test hooks + bot
function botWordGuess() {
  const r = rec(day).w, cands = P.ANSWERS.slice(0, 1200).filter(c => r.g.every(g => P.mark(g, c).join() === P.mark(g, W.ans).join()) && !r.g.includes(c));
  return cands[0] || W.ans;
}
window.__game = {
  get state() { return state; },
  get level() { return st.solved; },
  get score() { const r = st.days[TODAY]; return r ? r.stars.w + r.stars.l + r.stars.n : 0; },
  bot() {
    if (ov) {
      if (ovKind === 'tut') return ov.querySelector('[data-ok]').click();
      if (ovKind === 'oog') return ov.querySelector('[data-reveal]').click();
      if (ovKind === 'result' || ovKind === 'set') return;
      return closeOv();
    }
    if (view === 'home') {
      const k = KINDS.find(q => !rec(day)[q].done);
      if (k) return start(k);
      for (let i = 0; i <= ARCH_FREE; i++) { const n = P.addDays(TODAY, -i); if (!(st.days[n] && st.days[n].complete)) { day = n; paintHome(); return; } }
      return;
    }
    if (view !== 'play' || state !== 'play') return;
    if (kind === 'w') {
      if (W.busy) return;
      if (!W.botWord || W.cur.length === 0) W.botWord = botWordGuess();
      if (W.cur.length < 5) key(W.botWord[W.cur.length]); else { key('enter'); W.botWord = null; }
    } else if (kind === 'l') {
      const s = L.s, c = rec(day).l.cells; const y = [...Array(s.N).keys()].find(y => c[y][s.sol[y]] !== 2);
      if (y == null) return; logicSet(y, s.sol[y], 2); logicCheck();
    } else if (kind === 'n') {
      if (N.busy) return;
      const done = N.hist.length, st0 = N.s.steps[done]; if (!st0) return numReset();
      const [a, op, b] = st0, ai = N.vals.indexOf(a), bi = N.vals.findIndex((v, k) => v === b && k !== ai);
      if (ai < 0 || bi < 0) return numReset();
      if (N.sel !== ai) { if (N.sel >= 0) { N.sel = -1; N.op = null; } return numTap(ai); }
      if (N.op !== op) return numOp(op);
      return numTap(bi);
    }
  },
};

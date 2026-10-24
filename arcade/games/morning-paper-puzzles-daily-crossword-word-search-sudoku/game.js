// Morning Paper Puzzles: a daily set of three (mini crossword, themed word search, sudoku), the same for everyone,
// seeded by the date. Untimed, large print, painted storybook look. Streak with a weekly freeze, spoiler-free share,
// archive, stamp album, and a reader's garden that fills with the stars you earn.
import { store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { snd } from './audio.js';
import * as P from './puzzles.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Morning Paper Puzzles';
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const Q = new URLSearchParams(location.search);
const TODAY = P.dayNum(), YESTERDAY = P.addDays(TODAY, -1);
const week = n => Math.floor((P.issueNo(n) + 3) / 7);
const fmt = (n, o = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) => P.fromNum(n).toLocaleDateString('en-US', o);
const IC = n => `assets/ic/${n}.webp`;
const starImgs = (k, size = '') => [1, 2, 3].map(i => `<img src="assets/ui/${i <= k ? 'star-full' : 'star-empty'}.webp" alt="" ${size}>`).join('');
const ARCH_FREE = 7, HINT_COST = 25, ARCH_COST = 40, FREEZE_COST = 60;
const KINDS = ['c', 'w', 's'];
const META = {
  c: { name: 'The Mini Crossword', short: 'Mini Crossword', icon: '📰' },
  w: { name: 'The Word Search', short: 'Word Search', icon: '🔎' },
  s: { name: 'The Sudoku', short: 'Sudoku', icon: '🔢' },
};
const STAMPS = 'robin teacup rose cottage bluebells hedgehog teapot butterfly peony bluetit lighthouse cat sunflower swan hydrangea beehive fox lavender owl strawberry sailboat squirrel tulip kingfisher'.split(' ');
const STAMP_NAME = { bluetit: 'Blue tit', bluebells: 'Bluebells' };
const stampName = s => STAMP_NAME[s] || s[0].toUpperCase() + s.slice(1);
// the reader's garden: decor bought with stars, placed on the painted lawn (x, y = base point in % of the painting, w = width %)
const DECOR = [
  { id: 'birdhouse', name: 'Birdhouse', cost: 3, x: 24, y: 47, w: 10 },
  { id: 'watering-can', name: 'Watering can', cost: 5, x: 36, y: 76, w: 11 },
  { id: 'lantern', name: 'Garden lantern', cost: 7, x: 75, y: 55, w: 7 },
  { id: 'bench', name: 'Garden bench', cost: 9, x: 52, y: 45, w: 20 },
  { id: 'birdbath', name: 'Birdbath', cost: 12, x: 31, y: 61, w: 13 },
  { id: 'beehive', name: 'Beehive', cost: 14, x: 70, y: 43, w: 10 },
  { id: 'trellis', name: 'Clematis trellis', cost: 17, x: 78, y: 40, w: 11 },
  { id: 'urn', name: 'Flower urn', cost: 20, x: 24, y: 70, w: 12 },
  { id: 'wheelbarrow', name: 'Wheelbarrow of blooms', cost: 24, x: 67, y: 73, w: 17 },
  { id: 'sundial', name: 'Sundial', cost: 28, x: 66, y: 60, w: 11 },
  { id: 'rose-arch', name: 'Rose arch', cost: 32, x: 36, y: 40, w: 15 },
  { id: 'fountain', name: 'Tiered fountain', cost: 40, x: 49, y: 63, w: 22 },
];

// ---------------------------------------------------------------- saved state
const S = store('mpaper');
const sg = (k, d) => { try { return S.get(k, d); } catch (e) { return d; } };
const st = {
  days: sg('days', {}), streak: sg('streak', { n: 0, best: 0, last: 0, freeWeek: -1, extra: 0, frozen: [], broken: null }),
  stars: sg('stars', 0), earned: sg('earned', 0), decor: sg('decor', []), album: sg('album', {}), solved: sg('solved', 0), sets: sg('sets', 0),
  seen: sg('seen', {}), big: sg('big', false), mistakes: sg('mistakes', false), unlocked: sg('unlocked', []),
};
const save = (...ks) => { for (const k of (ks.length ? ks : Object.keys(st))) try { S.set(k, st[k]); } catch (e) {} };
{ const keys = Object.keys(st.days).map(Number).sort((a, b) => b - a); for (const k of keys.slice(120)) delete st.days[k]; }
const rec = n => st.days[n] || (st.days[n] = { c: { v: [], rev: [], hints: 0, done: 0, stars: 0 }, w: { found: [], hints: 0, done: 0, stars: 0 }, s: { v: [], notes: [], hints: 0, done: 0, stars: 0 }, complete: 0, perfect: 0, coins: 0 });
const sets = {}; const setOf = n => sets[n] || (sets[n] = P.setFor(n));
const newbie = () => st.sets < 5;     // first five sets: hints are free, so the first days are near-certain wins
const starsFor = h => h === 0 ? 3 : h <= 2 ? 2 : 1;
document.documentElement.classList.toggle('big', st.big);

// ---------------------------------------------------------------- kit layers
const F = flow('morningpaper');   // records every puzzle; no knob: the daily set is the same for everyone (RULES 5)
const D = daily('morningpaper', null, { name: NAME });
const B = worldBoard({ game: 'morning-paper', label: 'Stars from the daily paper', limits: { maxRun: 3, maxPerSec: 0.3 }, mode: 'sum', corner: 'tl', accent: '#b08834' });
const M = money({ game: 'morning-paper', style: 'C' });
addEventListener('ap:ad', e => snd.pause(e.detail?.phase === 'start'));

// ---------------------------------------------------------------- background (portrait or wide painting)
const bg = document.getElementById('bg');
function paintBg() {
  const wide = innerWidth / innerHeight >= 1, small = Math.max(innerWidth, innerHeight) * (devicePixelRatio || 1) < 1100;
  bg.style.backgroundImage = `url(assets/bg/morning-paper${wide ? '-wide' : ''}${small ? '-s' : ''}.webp)`;
}
paintBg();

// ---------------------------------------------------------------- DOM shells
const home = $(`<section id="home">
  <header class="top"><span class="slot56"></span>
    <button class="ribbon" data-streak aria-label="Daily streak"><small>Daily streak</small><b data-sn>0 days</b></button>
    <button class="coinpill" data-shop aria-label="Coins and shop"><img src="assets/ui/coin.webp" alt=""><b data-coins>0</b><span class="plus">+</span></button></header>
  <article class="paper front">
    <div class="mast"><div class="eyebrow">Puzzles for a quiet morning</div><h1>The Morning <i>Paper</i></h1></div>
    <div class="dateline"><span data-date></span><span data-no></span></div>
    <div data-rows></div>
    <div class="frontfoot" data-foot></div>
  </article>
  <nav class="dock">
    <button data-tab="archive"><img src="${IC('calendar')}" alt="">Archive</button>
    <button data-tab="album"><img src="${IC('album')}" alt="">Stamps</button>
    <button data-tab="garden"><img src="${IC('home')}" alt="">Garden</button>
    <button data-tab="shop"><img src="${IC('shop')}" alt="">Shop</button>
    <button data-tab="more"><img src="${IC('settings')}" alt="">Settings</button>
  </nav>
</section>`);
const play = $(`<section id="play" class="hide">
  <header class="top"><button class="round" data-back aria-label="Back to the paper"><img src="${IC('home')}" alt=""></button>
    <div class="ttl"><b></b><span></span></div>
    <button class="coinpill" data-shop aria-label="Coins and shop"><img src="assets/ui/coin.webp" alt=""><b data-coins>0</b></button></header>
  <div id="stage"></div>
</section>`);
document.body.append(home, play);
const stage = play.querySelector('#stage');
for (const b of document.querySelectorAll('[data-shop]')) b.onclick = () => { snd.tap(); M.shop(); };
const paintCoins = () => document.querySelectorAll('[data-coins]').forEach(e => e.textContent = M.coins().toLocaleString());
M.onChange(paintCoins); paintCoins();
home.querySelector('[data-streak]').onclick = () => { snd.tap(); streakCard(); };
home.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { snd.tap(); ({ archive: archiveCard, album: albumCard, garden: openGarden, shop: () => M.shop(), more: settingsCard })[b.dataset.tab](); });
play.querySelector('[data-back]').onclick = () => { snd.tap(); goHome(); };
addEventListener('pointerdown', () => snd.unlock(), { once: true });

function toast(text, ms = 1800) { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = $(`<div class="toast">${text}</div>`); document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function petals(n = 46) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cols = ['#e7a9b3', '#f3d2d6', '#b8cfa8', '#f1e1a6', '#c9b6dc', '#fff6ea'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div'); c.className = 'petal'; c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length];
    c.style.setProperty('--dx', (Math.random() - 0.5) * 220 + 'px'); c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
    c.style.animationDuration = 3.2 + Math.random() * 2.4 + 's'; c.style.animationDelay = Math.random() * 0.8 + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 7000);
  }
}
function coinFly(n, from) {
  const to = [...document.querySelectorAll('[data-shop]')].find(b => b.offsetParent)?.getBoundingClientRect(); if (!to || !from) return;
  const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
  for (let i = 0; i < Math.min(8, n); i++) {
    const c = $(`<img class="coinfly" src="assets/ui/coin.webp" alt="">`); c.style.left = fx + (Math.random() - 0.5) * 60 + 'px'; c.style.top = fy + (Math.random() - 0.5) * 30 + 'px';
    c.style.setProperty('--dx', (to.left + 20 - fx) + 'px'); c.style.setProperty('--dy', (to.top + 10 - fy) + 'px'); c.style.animationDelay = i * 0.06 + 's';
    document.body.appendChild(c); setTimeout(() => { c.remove(); if (i % 2 === 0) snd.coin(); }, 900 + i * 60);
  }
}

// ---------------------------------------------------------------- overlays (one at a time)
let ov = null, ovKind = '';
function overlay(kind, html, { onTap = null, low = false, close = true } = {}) {
  closeOv(); ovKind = kind; document.body.classList.add('sheet-open');
  ov = $(`<div class="ov ${low ? 'low' : ''}"><div class="card paper">${close ? `<button class="x" aria-label="Close"><img src="${IC('close')}" alt=""></button>` : ''}${html}</div></div>`);
  document.body.appendChild(ov);
  ['pointerdown', 'pointerup', 'touchstart', 'mousedown'].forEach(t => ov.addEventListener(t, e => e.stopPropagation()));
  const x = ov.querySelector('.x'); if (x) x.onclick = () => { snd.tap(); closeOv(); };
  if (onTap) ov.addEventListener('click', e => { if (!e.target.closest('button')) onTap(); });
  else ov.addEventListener('click', e => { if (e.target === ov && x) closeOv(); });
  return ov;
}
function closeOv() { if (ov) ov.remove(); ov = null; ovKind = ''; document.body.classList.remove('sheet-open'); }
addEventListener('keydown', e => { if (e.key === 'Escape' && ov && ov.querySelector('.x')) closeOv(); });

// ---------------------------------------------------------------- streak (one free freeze every week)
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

// ---------------------------------------------------------------- home: the front page
let view = 'home', day = TODAY, kind = null, state = 'ready', t0 = 0;
const isToday = () => day === TODAY;
function setView(v) {
  view = v; home.classList.toggle('hide', v !== 'home'); play.classList.toggle('hide', v !== 'play');
  document.body.classList.toggle('playing', v === 'play');
}
function thumb(k) {
  const s = setOf(day), r = rec(day);
  if (k === 'c') { const g = s.cw.rows, sz = g.length; return `<div class="thumb" style="grid-template-columns:repeat(${sz},1fr)">${g.join('').split('').map((ch, i) => ch === '#' ? '<i class="k"></i>' : `<i>${r.c.done ? ch.toUpperCase() : ''}</i>`).join('')}</div>`; }
  if (k === 'w') { const g = s.ws.grid.slice(0, 5).map(x => x.slice(0, 5)).join(''); return `<div class="thumb ws" style="grid-template-columns:repeat(5,1fr)">${[...g].map((ch, i) => `<i class="${i >= 5 && i < 9 ? `h h${i - 4}` : ""}">${ch}</i>`).join('')}</div>`; }
  const g = s.su.grid; const cells = [0, 1, 2, 9, 10, 11, 18, 19, 20]; return `<div class="thumb su" style="grid-template-columns:repeat(3,1fr)">${cells.map(i => `<i>${g[i] || ''}</i>`).join('')}</div>`;
}
function paintHome() {
  const s = setOf(day), r = rec(day), sn = streakNow();
  home.querySelector('[data-date]').textContent = fmt(day, { weekday: 'long', month: 'short', day: 'numeric' });
  home.querySelector('[data-no]').innerHTML = `No. ${s.no} · <span class="lv ${s.level <= 2 ? 'easy' : ''}">${s.levelName}</span>`;
  home.querySelector('[data-sn]').textContent = sn.n ? `${sn.n} day${sn.n === 1 ? '' : 's'}` : 'Start today';
  home.querySelector('[data-streak]').classList.toggle('cold', !sn.n);
  const sub = k => k === 'c' ? `${s.cw.entries.length} clues · ${s.levelName.toLowerCase()}` : k === 'w' ? `${s.ws.words.length} words · ${s.ws.title.replace(/^(The|A|An) /, '')}` : `${s.su.givens} givens · ${s.levelName.toLowerCase()}`;
  const next = KINDS.find(k => !r[k].done);
  const status = k => r[k].done ? `<span class="stars">${starImgs(r[k].stars)}</span><small>Solved</small>`
    : `<span class="go ${k === next ? '' : 'soft'}">${(k === 'c' && r.c.v.some(Boolean)) || (k === 'w' && r.w.found.length) || (k === 's' && r.s.v.some(Boolean)) ? 'Resume' : 'Play'}</span>`;
  home.querySelector('[data-rows]').innerHTML = KINDS.map(k => `<button class="pz" data-k="${k}">${thumb(k)}<span class="nm"><b>${META[k].name}</b><span>${sub(k)}</span></span><span class="st">${status(k)}</span></button>`).join('');
  home.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { snd.tap(); start(b.dataset.k); });
  const foot = home.querySelector('[data-foot]');
  const nextDecor = DECOR.find(d => !st.decor.includes(d.id));
  if (r.complete) {
    const ms = (() => { const t = new Date(); t.setHours(24, 0, 0, 0); return t - Date.now(); })();
    foot.innerHTML = isToday() ? `<span>Today's paper is done. Next edition in <b>${Math.floor(ms / 36e5)}h ${Math.floor(ms / 6e4) % 60}m</b></span><button class="go soft" data-share>Share</button>`
      : `<span>Archive edition complete</span><button class="go soft" data-today>Today</button>`;
  } else if (!isToday()) foot.innerHTML = `<span>From the archive: ${fmt(day, { month: 'short', day: 'numeric' })}</span><button class="go soft" data-today>Today</button>`;
  else foot.innerHTML = nextDecor ? `<span><b>${Math.min(st.stars, nextDecor.cost)} of ${nextDecor.cost} stars</b> to plant the ${nextDecor.name.toLowerCase()}</span>` : `<span>Your garden is in full bloom.</span>`;
  const sh = foot.querySelector('[data-share]'); if (sh) sh.onclick = () => share(day);
  const td = foot.querySelector('[data-today]'); if (td) td.onclick = () => { day = TODAY; snd.page(); paintHome(); };
  home.querySelector('[data-tab="garden"]').insertAdjacentHTML('beforeend', '');
  const gb = home.querySelector('[data-tab="garden"]'); gb.querySelector('.dot')?.remove(); if (nextDecor && st.stars >= nextDecor.cost) gb.insertAdjacentHTML('beforeend', '<i class="dot"></i>');
}
function goHome() { closeOv(); teardown(); kind = null; state = 'ready'; setView('home'); paintHome(); }

// ---------------------------------------------------------------- start a puzzle
let C = null, Wd = null, Su = null, lastLayout = null;
function teardown() { stage.innerHTML = ''; play.className = ''; C = Wd = Su = null; document.querySelector('#kb')?.remove(); document.querySelector('#pad')?.remove(); document.querySelectorAll('.tools').forEach(t => t.remove()); }
function start(k) {
  const r = rec(day);
  if (r[k].done) return solvedCard(k, true);
  closeOv(); teardown(); kind = k; state = 'play'; t0 = performance.now(); setView('play');
  play.querySelector('.ttl b').textContent = META[k].short;
  play.querySelector('.ttl span').textContent = `${fmt(day, { weekday: 'long', month: 'short', day: 'numeric' })} · ${KINDS.indexOf(k) + 1} of 3`;
  if (isToday()) B.start();
  M.level(st.solved + 1);
  if (k === 'c') startCW(); else if (k === 'w') startWS(); else startSU();
  if (!st.seen[k]) tutorial(k);
}
function toolsRow(list) {
  const row = $(`<div class="tools">${list.map(([id, label, icon]) => `<button class="tool" data-t="${id}">${icon ? `<img src="${IC(icon)}" alt="">` : ''}<span>${label}</span></button>`).join('')}</div>`);
  const ctl = play.querySelector('#kb,#pad'); if (ctl) play.insertBefore(row, ctl); else play.appendChild(row);
  row.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { snd.tap(); act(b.dataset.t, b); });
  return row;
}
const hintLabel = () => newbie() ? 'Hint <small>free</small>' : 'Hint';
function act(id, btn) {
  if (state !== 'play') return;
  if (id === 'hint') return askHint();
  if (kind === 'c') { if (id === 'check') cwCheck(); if (id === 'clues') cwClueSheet(); }
  if (kind === 's') { if (id === 'notes') { Su.notes = !Su.notes; btn.classList.toggle('on', Su.notes); play.querySelector('#pad').classList.toggle('notes', Su.notes); } if (id === 'undo') suUndo(); if (id === 'erase') suErase(); }
}
// hints: free for the first five sets, then 25 coins, or an opt-in video when coins are short. One offer, never a wall.
async function askHint() {
  if (state !== 'play') return;
  if (!hintAvailable()) return toast('Nothing left to hint here');
  if (newbie()) return giveHint();
  if (M.spend(HINT_COST, 'hint')) { toast(`Hint for ${HINT_COST} coins`); return giveHint(); }
  if (await M.rewarded('hint', { what: 'one hint for this puzzle' })) return giveHint();
}
const hintAvailable = () => kind === 'c' ? !!cwHintCell() : kind === 'w' ? Wd.left().length > 0 : !!suHintCell();
function giveHint() { const r = rec(day)[kind]; r.hints++; save('days'); if (kind === 'c') cwHint(); else if (kind === 'w') wsHint(); else suHint(); }
function tutorial(k) {
  const T = {
    c: [['1', 'Tap a square, then type. Tap the same square again to switch between <b>Across</b> and <b>Down</b>.'], ['2', 'The clue for your word sits in the blue bar. Use ‹ › to move between clues.'], ['3', 'No clock and no rush. <b>Check</b> marks any wrong letters, free.']],
    w: [['1', `Find the hidden words. They run ${setOf(day).level <= 1 ? 'across and down' : setOf(day).level >= 4 ? 'in any direction, even backwards' : 'across, down and on the diagonal'}.`], ['2', 'Drag along a word, or tap its first letter and then its last.'], ['3', 'Found words are crossed off the list below the grid.']],
    s: [['1', 'Fill the grid so every row, column and 3×3 box holds 1 to 9 once each.'], ['2', 'Tap a square, then a number. <b>Notes</b> lets you pencil in small guesses.'], ['3', 'Every puzzle has one answer and can be solved by logic alone. Take all the time you like.']],
  };
  overlay('tut', `<div class="kick">How to play</div><h3>${META[k].name}</h3><div class="tut">${T[k].map(([i, t]) => `<div><i>${i}</i><span>${t}</span></div>`).join('')}</div><div class="btns"><button class="go" data-ok>Begin</button></div>`, { close: false });
  ov.querySelector('[data-ok]').onclick = () => { snd.tap(); st.seen[k] = 1; save('seen'); closeOv(); };
}
function layoutBox() {   // free space for the board, under the top bar and above the controls
  const top = play.querySelector('.top').getBoundingClientRect().bottom;
  const ctrl = [...play.querySelectorAll('#kb,#pad,.tools')].reduce((a, e) => a + e.offsetHeight + 10, 0);
  return { w: Math.min(innerWidth - 20, 560), h: innerHeight - top - ctrl - 16 };
}

// ================================================================ mini crossword
function startCW() {
  const s = setOf(day).cw, r = rec(day).c, N = s.size;
  if (r.v.length !== N * N) r.v = new Array(N * N).fill('');
  play.className = 'cw';
  stage.innerHTML = `<div class="paper sheet"><div class="cluebar"><button data-prev aria-label="Previous clue">‹</button><div class="cl"><small></small><span></span></div><button data-next aria-label="Next clue">›</button></div><div class="cwgrid"></div></div><div class="paper cluelist"></div>`;
  C = { s, N, y: 0, x: 0, dir: 'a', grid: stage.querySelector('.cwgrid'), cells: [] };
  C.grid.style.gridTemplateColumns = `repeat(${N},1fr)`;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = s.rows[y][x] === '#', n = s.num[y][x];
    const c = $(`<div class="cell ${k ? 'k' : ''}">${n ? `<span class="n">${n}</span>` : ''}<b></b></div>`);
    if (!k) c.addEventListener('pointerdown', e => { e.preventDefault(); cwTap(y, x); });
    C.grid.appendChild(c); C.cells.push(c);
  }
  stage.querySelector('[data-prev]').onclick = () => { snd.tap(); cwJump(-1); };
  stage.querySelector('[data-next]').onclick = () => { snd.tap(); cwJump(1); };
  const kb = $(`<div id="kb"></div>`);
  kb.innerHTML = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'].map(row => `<div class="r">${[...row].map(c => c === '>' ? '<button class="wide" data-key="next">Next ›</button>' : c === '<' ? '<button class="wide" data-key="back" aria-label="Delete">⌫</button>' : `<button data-key="${c}">${c.toUpperCase()}</button>`).join('')}</div>`).join('');
  kb.querySelectorAll('[data-key]').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); cwKey(b.dataset.key); }));
  play.appendChild(kb);
  toolsRow([['check', 'Check', 'check'], ['hint', hintLabel(), 'hint'], ['clues', 'All clues', 'pencil']]);
  // start on the first empty square of 1 Across
  const first = s.entries.find(e => e.cells.some(([y, x]) => !r.v[y * N + x])) || s.entries[0];
  C.dir = first.dir; [C.y, C.x] = first.cells.find(([y, x]) => !r.v[y * N + x]) || first.cells[0];
  cwLayout(); cwPaint();
}
function cwLayout() {
  if (!C) return;
  const b = layoutBox(), bar = stage.querySelector('.cluebar').offsetHeight + 12 + 28;
  const desk = innerWidth >= 900;
  const size = Math.max(200, Math.min(b.w - 28, b.h - bar, desk ? 420 : 400));
  C.grid.style.width = C.grid.style.height = size + 'px';
  stage.querySelector('.sheet').style.width = (size + 28) + 'px';
  C.grid.style.gridTemplateRows = `repeat(${C.N},1fr)`;
  const fs = size / C.N * 0.5; C.cells.forEach(c => c.style.fontSize = Math.min(fs * (st.big ? 1.1 : 1), size / C.N * 0.62) + 'px');
}
const cwEntry = (y = C.y, x = C.x, dir = C.dir) => C.s.entries.find(e => e.dir === dir && e.cells.some(([a, b]) => a === y && b === x));
function cwPaint() {
  const r = rec(day).c, e = cwEntry() || cwEntry(C.y, C.x, C.dir === 'a' ? 'd' : 'a');
  if (e && e.dir !== C.dir) C.dir = e.dir;
  C.cells.forEach((c, i) => {
    const y = Math.floor(i / C.N), x = i % C.N; if (C.s.rows[y][x] === '#') return;
    c.querySelector('b').textContent = (r.v[i] || '').toUpperCase();
    c.classList.toggle('w', !!e && e.cells.some(([a, b]) => a === y && b === x));
    c.classList.toggle('cur', y === C.y && x === C.x);
    c.classList.toggle('rev', r.rev.includes(i));
  });
  if (e) { stage.querySelector('.cl small').textContent = `${e.n} ${e.dir === 'a' ? 'Across' : 'Down'}`; stage.querySelector('.cl span').textContent = e.clue; }
  const list = stage.querySelector('.cluelist');
  if (list && innerWidth >= 900) {
    const item = en => `<div class="${en === e ? 'on' : ''} ${en.cells.every(([a, b]) => r.v[a * C.N + b]) ? 'done' : ''}" data-e="${C.s.entries.indexOf(en)}"><b>${en.n}</b><span>${en.clue}</span></div>`;
    list.innerHTML = `<section><h4>Across</h4>${C.s.entries.filter(x => x.dir === 'a').map(item).join('')}</section><section><h4>Down</h4>${C.s.entries.filter(x => x.dir === 'd').map(item).join('')}</section>`;
    list.querySelectorAll('[data-e]').forEach(d => d.onclick = () => { const en = C.s.entries[+d.dataset.e]; cwGoEntry(en); });
  }
}
function cwGoEntry(en) { const r = rec(day).c; C.dir = en.dir; [C.y, C.x] = en.cells.find(([y, x]) => !r.v[y * C.N + x]) || en.cells[0]; snd.tap(); cwPaint(); }
function cwTap(y, x) {
  if (state !== 'play' || ov) return;
  if (y === C.y && x === C.x) C.dir = C.dir === 'a' ? 'd' : 'a';
  else { C.y = y; C.x = x; if (!cwEntry()) C.dir = C.dir === 'a' ? 'd' : 'a'; }
  snd.tap(); cwPaint();
}
function cwJump(d) {
  const E = C.s.entries, e = cwEntry(), i = E.indexOf(e);
  const order = [...E.filter(x => x.dir === 'a'), ...E.filter(x => x.dir === 'd')], j = order.indexOf(E[i]);
  cwGoEntry(order[(j + d + order.length) % order.length]);
}
function cwKey(k) {
  if (kind !== 'c' || state !== 'play' || ov) return;
  const r = rec(day).c, N = C.N, e = cwEntry();
  if (k === 'next') return cwJump(1);
  if (k === 'back') {
    const i = C.y * N + C.x;
    if (r.v[i] && !r.rev.includes(i)) { r.v[i] = ''; }
    else { const p = e.cells.findIndex(([a, b]) => a === C.y && b === C.x); if (p > 0) { [C.y, C.x] = e.cells[p - 1]; const j = C.y * N + C.x; if (!r.rev.includes(j)) r.v[j] = ''; } }
    snd.key(); save('days'); return cwPaint();
  }
  if (!/^[a-z]$/.test(k)) return;
  const i = C.y * N + C.x;
  if (!r.rev.includes(i)) r.v[i] = k;
  C.cells[i].classList.remove('bad'); C.cells[i].classList.add('pop'); setTimeout(() => C.cells[i]?.classList.remove('pop'), 300);
  snd.key(); buzz(5);
  // move on: next empty square in this word, else the next word with a gap
  const p = e.cells.findIndex(([a, b]) => a === C.y && b === C.x);
  const rest = e.cells.slice(p + 1).find(([a, b]) => !r.v[a * N + b]);
  if (rest) [C.y, C.x] = rest;
  else if (p + 1 < e.cells.length && e.cells.slice(0, p + 1).every(([a, b]) => r.v[a * N + b])) [C.y, C.x] = e.cells[p + 1];
  else {
    const order = [...C.s.entries.filter(x => x.dir === 'a'), ...C.s.entries.filter(x => x.dir === 'd')], j = order.indexOf(e);
    const nx = [...order.slice(j + 1), ...order.slice(0, j + 1)].find(en => en.cells.some(([a, b]) => !r.v[a * N + b]));
    if (nx) { C.dir = nx.dir; [C.y, C.x] = nx.cells.find(([a, b]) => !r.v[a * N + b]); }
  }
  save('days'); cwPaint(); cwMaybeDone();
}
function cwMaybeDone() {
  const r = rec(day).c, N = C.N, rows = C.s.rows;
  let full = true, right = true;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (rows[y][x] === '#') continue; const v = r.v[y * N + x]; if (!v) full = false; else if (v !== rows[y][x]) right = false; }
  if (!full) return;
  if (right) { C.grid.classList.add('win'); C.cells.forEach((c, i) => c.style.animationDelay = (i % N + Math.floor(i / N)) * 0.06 + 's'); return solved('c'); }
  snd.soft(); toast('Almost! A letter or two is not quite right');
}
function cwCheck() {
  const r = rec(day).c, N = C.N; let bad = 0;
  C.cells.forEach((c, i) => { const y = Math.floor(i / N), x = i % N; if (C.s.rows[y][x] === '#' || !r.v[i]) return; const wrong = r.v[i] !== C.s.rows[y][x]; c.classList.toggle('bad', wrong); if (wrong) bad++; });
  if (bad) { snd.bad(); toast(bad === 1 ? 'One letter is crossed out' : `${bad} letters are crossed out`); } else { snd.soft(); toast('All good so far'); }
}
function cwHintCell() {
  if (!C) return null; const r = rec(day).c, N = C.N, e = cwEntry();
  const pick = cells => cells.find(([y, x]) => r.v[y * N + x] !== C.s.rows[y][x]);
  return (e && pick(e.cells)) || pick(C.s.entries.flatMap(en => en.cells));
}
function cwHint() {
  const r = rec(day).c, N = C.N, c = cwHintCell(); if (!c) return;
  const [y, x] = c, i = y * N + x; r.v[i] = C.s.rows[y][x]; if (!r.rev.includes(i)) r.rev.push(i);
  C.y = y; C.x = x; C.cells[i].classList.remove('bad'); C.cells[i].classList.add('pop');
  snd.place(5); save('days'); cwPaint(); cwMaybeDone();
}
function cwClueSheet() {
  const r = rec(day).c, e = cwEntry();
  const item = en => `<button class="row" data-e="${C.s.entries.indexOf(en)}" style="width:100%;${en === e ? 'background:#f3dc9a;' : ''}"><span><b>${en.n}</b>&nbsp; ${en.clue}</span>${en.cells.every(([a, b]) => r.v[a * C.N + b]) ? '<span style="color:#567854">✓</span>' : ''}</button>`;
  overlay('clues', `<div class="kick">${fmt(day, { weekday: 'long' })}</div><h3>All clues</h3><div style="text-align:left"><div class="kick" style="margin-top:8px">Across</div>${C.s.entries.filter(x => x.dir === 'a').map(item).join('')}<div class="kick" style="margin-top:12px">Down</div>${C.s.entries.filter(x => x.dir === 'd').map(item).join('')}</div>`);
  ov.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { closeOv(); cwGoEntry(C.s.entries[+b.dataset.e]); });
}
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || view !== 'play' || state !== 'play') return;
  if (kind === 'c') {
    if (e.key === 'Backspace') cwKey('back'); else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); cwJump(e.shiftKey ? -1 : 1); }
    else if (e.key === ' ') { e.preventDefault(); C.dir = C.dir === 'a' ? 'd' : 'a'; cwPaint(); }
    else if (e.key.startsWith('Arrow')) { const [dy, dx] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; let y = C.y + dy, x = C.x + dx; while (y >= 0 && x >= 0 && y < C.N && x < C.N && C.s.rows[y][x] === '#') { y += dy; x += dx; } if (y >= 0 && x >= 0 && y < C.N && x < C.N) { C.y = y; C.x = x; C.dir = dy ? 'd' : 'a'; if (!cwEntry()) C.dir = dy ? 'a' : 'd'; cwPaint(); } }
    else if (/^[a-zA-Z]$/.test(e.key)) cwKey(e.key.toLowerCase());
  } else if (kind === 's') {
    if (/^[1-9]$/.test(e.key)) suNum(+e.key); else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') suErase();
    else if (e.key.startsWith('Arrow')) { const [dy, dx] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key]; const i = Su.sel < 0 ? 0 : Su.sel, y = Math.min(8, Math.max(0, Math.floor(i / 9) + dy)), x = Math.min(8, Math.max(0, i % 9 + dx)); suSelect(y * 9 + x); }
    else if (e.key === 'n') act('notes', play.querySelector('[data-t="notes"]'));
  }
});

// ================================================================ word search
const INK = ['#d98a96', '#93b48a', '#8fa6d4', '#e0bf6a', '#b39ad0', '#e6a07a', '#7fb7b0', '#c88fb0', '#a8b86a', '#9fb3c8', '#d9a5a0'];
function startWS() {
  const s = setOf(day).ws, r = rec(day).w, N = s.size;
  stage.innerHTML = `<div class="paper sheet"><div class="theme"><span class="rb"></span><i></i></div><div class="wsgrid"><svg></svg></div><div class="words"></div></div>`;
  stage.querySelector('.rb').textContent = s.title; stage.querySelector('.theme i').textContent = s.line;
  const grid = stage.querySelector('.wsgrid'), svg = grid.querySelector('svg');
  grid.style.gridTemplateColumns = `repeat(${N},1fr)`;
  const L = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const l = $(`<div class="l">${s.grid[y][x]}</div>`); grid.appendChild(l); L.push(l); }
  Wd = { s, N, grid, svg, L, cell: 36, drag: null, tapStart: null, live: null, left: () => s.words.filter(w => !rec(day).w.found.includes(w.w)) };
  toolsRow([['hint', hintLabel(), 'hint']]);
  const at = e => { const b = grid.getBoundingClientRect(); const x = Math.floor((e.clientX - b.left) / (b.width / N)), y = Math.floor((e.clientY - b.top) / (b.height / N)); return x >= 0 && y >= 0 && x < N && y < N ? [y, x] : null; };
  grid.addEventListener('pointerdown', e => { if (state !== 'play' || ov) return; const p = at(e); if (!p) return; e.preventDefault(); grid.setPointerCapture?.(e.pointerId); Wd.drag = { a: p, b: p, moved: false }; wsLive(); snd.select(0); });
  grid.addEventListener('pointermove', e => { if (!Wd?.drag) return; const p = at(e) || Wd.drag.b; const s2 = snapEnd(Wd.drag.a, p); if (s2.join() !== Wd.drag.b.join()) { Wd.drag.b = s2; Wd.drag.moved = true; wsLive(); snd.select(Math.max(Math.abs(s2[0] - Wd.drag.a[0]), Math.abs(s2[1] - Wd.drag.a[1]))); } });
  const up = () => {
    if (!Wd?.drag) return; const d = Wd.drag; Wd.drag = null;
    if (!d.moved) {   // tap-tap mode: first tap marks a start, second tap the end
      if (!Wd.tapStart) { Wd.tapStart = d.a; wsLive(d.a, d.a); return; }
      const a = Wd.tapStart; Wd.tapStart = null; const b = snapEnd(a, d.a);
      if (a.join() === b.join()) { wsLive(null); return; }
      return wsCommit(a, b);
    }
    Wd.tapStart = null; wsCommit(d.a, d.b);
  };
  grid.addEventListener('pointerup', up); grid.addEventListener('pointercancel', up);
  wsPaint(); wsLayout();
}
function snapEnd(a, p) {
  let dy = p[0] - a[0], dx = p[1] - a[1]; const ay = Math.abs(dy), ax = Math.abs(dx);
  if (ay && ax && Math.abs(ay - ax) > Math.max(ay, ax) / 2) { if (ay > ax) dx = 0; else dy = 0; }   // closer to straight
  const len = Math.max(Math.abs(dy), Math.abs(dx)); if (!len) return a;
  const sy = Math.sign(dy), sx = Math.sign(dx); const k = Math.min(len, ...[sy ? (sy > 0 ? Wd.N - 1 - a[0] : a[0]) : 99, sx ? (sx > 0 ? Wd.N - 1 - a[1] : a[1]) : 99]);
  return [a[0] + sy * k, a[1] + sx * k];
}
function wsLayout() {
  if (!Wd) return;
  const b = layoutBox(), th = stage.querySelector('.theme').offsetHeight + 10, wl = stage.querySelector('.words').offsetHeight + 14;
  const size = Math.max(220, Math.min(b.w - 28, b.h - th - wl - 48, 520));
  Wd.grid.style.width = Wd.grid.style.height = size + 'px'; Wd.cell = size / Wd.N;
  Wd.L.forEach(l => l.style.fontSize = Math.min(Wd.cell * 0.62, Math.max(20, Wd.cell * 0.56) * (st.big ? 1.08 : 1)) + 'px');
  stage.querySelector('.sheet').style.width = Math.max(size + 28, Math.min(innerWidth - 20, 420)) + 'px';
  wsPaint();
}
const capsule = (a, b, col, op = 0.5) => { const c = Wd.cell; return `<line x1="${(a[1] + 0.5) * c}" y1="${(a[0] + 0.5) * c}" x2="${(b[1] + 0.5) * c}" y2="${(b[0] + 0.5) * c}" stroke="${col}" stroke-opacity="${op}" stroke-width="${c * 0.78}" stroke-linecap="round"/>`; };
function wsPaint() {
  const r = rec(day).w;
  const found = Wd.s.words.filter(w => r.found.includes(w.w)).map(w => capsule([w.y, w.x], [w.y + w.dy * (w.w.length - 1), w.x + w.dx * (w.w.length - 1)], INK[Wd.s.words.indexOf(w) % INK.length], 0.55)).join('');
  Wd.svg.innerHTML = found + (Wd.live ? capsule(Wd.live[0], Wd.live[1], '#b08834', 0.35) : '');
  stage.querySelector('.words').innerHTML = Wd.s.words.map((w, i) => `<span class="${r.found.includes(w.w) ? 'f' : ''}" ${r.found.includes(w.w) ? `style="text-decoration-color:${INK[i % INK.length]}"` : ''}>${w.w[0] + w.w.slice(1).toLowerCase()}</span>`).join('');
}
function wsLive(a = Wd.drag?.a, b = Wd.drag?.b) { Wd.live = a ? [a, b] : null; wsPaint(); }
function wsCommit(a, b) {
  const r = rec(day).w, N = Wd.N, len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) + 1, dy = Math.sign(b[0] - a[0]), dx = Math.sign(b[1] - a[1]);
  let str = ''; for (let i = 0; i < len; i++) str += Wd.s.grid[a[0] + dy * i][a[1] + dx * i];
  const rev = [...str].reverse().join('');
  const hit = Wd.s.words.find(w => !r.found.includes(w.w) && (w.w === str || w.w === rev) && ((w.y === a[0] && w.x === a[1]) || (w.y === b[0] && w.x === b[1])));
  Wd.live = null;
  if (!hit) { wsPaint(); if (len > 2) { snd.soft(); } return false; }
  r.found.push(hit.w); save('days'); snd.word(r.found.length); buzz(12);
  wsPaint();
  const spans = stage.querySelectorAll('.words span'); const sp = spans[Wd.s.words.indexOf(hit)]; sp?.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
  if (r.found.length >= Wd.s.words.length) { setTimeout(() => solved('w'), 500); }
  return true;
}
function wsHint() {
  const left = Wd.left(); if (!left.length) return;
  const w = left[Math.floor(Math.random() * left.length)], l = Wd.L[w.y * Wd.N + w.x];
  l.classList.remove('hint'); void l.offsetWidth; l.classList.add('hint');
  Wd.live = [[w.y, w.x], [w.y, w.x]]; wsPaint(); setTimeout(() => { if (Wd && !Wd.drag) { Wd.live = null; wsPaint(); } }, 3200);
  snd.place(3); toast(`${w.w[0] + w.w.slice(1).toLowerCase()} starts at the glowing letter`, 2600);
}

// ================================================================ sudoku
function startSU() {
  const s = setOf(day).su, r = rec(day).s;
  if (r.v.length !== 81) { r.v = s.grid.slice(); r.notes = new Array(81).fill(0); }
  stage.innerHTML = `<div class="paper sheet"><div class="sugrid"></div></div>`;
  const grid = stage.querySelector('.sugrid'), cells = [];
  for (let i = 0; i < 81; i++) {
    const y = Math.floor(i / 9), x = i % 9;
    const c = $(`<div class="sc ${s.grid[i] ? 'g' : ''} ${x === 2 || x === 5 ? 'br' : ''} ${y === 2 || y === 5 ? 'bb' : ''}"></div>`);
    c.addEventListener('pointerdown', e => { e.preventDefault(); if (state === 'play' && !ov) { snd.tap(); suSelect(i); } });
    grid.appendChild(c); cells.push(c);
  }
  Su = { s, grid, cells, sel: -1, notes: false, undo: [] };
  const pad = $(`<div id="pad">${[1, 2, 3, 4, 5].map(d => `<button data-d="${d}">${d}<small></small></button>`).join('')}${[6, 7, 8, 9].map(d => `<button data-d="${d}">${d}<small></small></button>`).join('')}<button class="x" data-d="0">Erase</button></div>`);
  pad.querySelectorAll('[data-d]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const d = +b.dataset.d; if (d) suNum(d); else suErase(); }));
  play.appendChild(pad);
  toolsRow([['notes', 'Notes', 'pencil'], ['undo', 'Undo', 'undo'], ['hint', hintLabel(), 'hint']]);
  suLayout(); suSelect(r.v.findIndex(v => !v)); suPaint();
}
function suLayout() {
  if (!Su) return;
  const b = layoutBox(), size = Math.max(250, Math.min(b.w - 28, b.h - 28, 520));
  Su.grid.style.width = Su.grid.style.height = size + 'px'; Su.grid.style.gridTemplateRows = 'repeat(9,1fr)';
  Su.cells.forEach(c => c.style.fontSize = Math.min(size / 9 * 0.62, Math.max(20, size / 9 * 0.56) * (st.big ? 1.08 : 1)) + 'px');
  stage.querySelector('.sheet').style.width = (size + 28) + 'px';
}
function suSelect(i) { if (!Su) return; Su.sel = i; suPaint(); }
function conflicts(v) { const bad = new Set(); for (let i = 0; i < 81; i++) if (v[i]) for (const p of P.PEERS[i]) if (v[p] === v[i]) { bad.add(i); bad.add(p); } return bad; }
function suPaint() {
  const r = rec(day).s, v = r.v, sel = Su.sel, sv = sel >= 0 ? v[sel] : 0, bad = conflicts(v);
  const sy = Math.floor(sel / 9), sx = sel % 9;
  Su.cells.forEach((c, i) => {
    const y = Math.floor(i / 9), x = i % 9, peer = sel >= 0 && (y === sy || x === sx || (Math.floor(y / 3) === Math.floor(sy / 3) && Math.floor(x / 3) === Math.floor(sx / 3)));
    c.classList.toggle('cur', i === sel); c.classList.toggle('peer', peer && i !== sel); c.classList.toggle('same', !!sv && v[i] === sv && i !== sel);
    const wrong = !Su.s.grid[i] && v[i] && (bad.has(i) || (st.mistakes && v[i] !== Su.s.sol[i]));
    c.classList.toggle('bad', !!wrong);
    if (v[i]) c.textContent = v[i];
    else if (r.notes[i]) { c.innerHTML = `<div class="nt">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<i>${r.notes[i] & (1 << d) ? d : ''}</i>`).join('')}</div>`; }
    else c.textContent = '';
  });
  const pad = play.querySelector('#pad');
  if (pad) pad.querySelectorAll('[data-d]').forEach(b => { const d = +b.dataset.d; if (!d) return; const n = v.filter(x => x === d).length; b.classList.toggle('done', n >= 9); b.querySelector('small').textContent = n >= 9 ? '' : 9 - n; });
}
function suNum(d) {
  if (kind !== 's' || state !== 'play' || ov) return;
  const r = rec(day).s, i = Su.sel; if (i < 0 || Su.s.grid[i]) { if (i >= 0) { snd.soft(); toast('That number was printed in the paper'); } return; }
  Su.undo.push([i, r.v[i], r.notes[i]]); if (Su.undo.length > 200) Su.undo.shift();
  if (Su.notes) { if (r.v[i]) return; r.notes[i] ^= (1 << d); snd.key(); }
  else {
    r.v[i] = r.v[i] === d ? 0 : d; r.notes[i] = 0;
    if (r.v[i]) { for (const p of P.PEERS[i]) r.notes[p] &= ~(1 << d); Su.cells[i].classList.add('pop'); setTimeout(() => Su?.cells[i]?.classList.remove('pop'), 300); snd.place(d); buzz(6); }
    else snd.key();
  }
  save('days'); suPaint(); suMaybeDone();
}
function suErase() { if (kind !== 's' || state !== 'play') return; const r = rec(day).s, i = Su.sel; if (i < 0 || Su.s.grid[i]) return; Su.undo.push([i, r.v[i], r.notes[i]]); r.v[i] = 0; r.notes[i] = 0; snd.key(); save('days'); suPaint(); }
function suUndo() { const u = Su.undo.pop(); if (!u) return toast('Nothing to undo'); const r = rec(day).s; [Su.sel, r.v[u[0]], r.notes[u[0]]] = [u[0], u[1], u[2]]; save('days'); suPaint(); }
function suMaybeDone() {
  const r = rec(day).s; if (r.v.some(v => !v)) return;
  if (r.v.every((v, i) => v === Su.s.sol[i])) { Su.grid.classList.add('win'); Su.cells.forEach((c, i) => c.style.animationDelay = (i % 9 + Math.floor(i / 9)) * 0.035 + 's'); return solved('s'); }
  snd.soft(); toast('The grid is full, but something does not add up');
}
// hint: the easiest square to see (only one number fits), and say why
function suHintCell() {
  if (!Su) return null; const v = rec(day).s.v;
  let best = null;
  for (let i = 0; i < 81; i++) { if (v[i] === Su.s.sol[i] && v[i]) continue; const used = new Set(P.PEERS[i].map(p => v[p]).filter(Boolean)); const n = 9 - used.size; if (!best || n < best.n) best = { i, n }; }
  return best;
}
function suHint() {
  const h = suHintCell(); if (!h) return; const r = rec(day).s, i = h.i, d = Su.s.sol[i];
  r.v[i] = d; r.notes[i] = 0; for (const p of P.PEERS[i]) r.notes[p] &= ~(1 << d);
  Su.sel = i; save('days'); suPaint(); Su.cells[i].classList.add('pop'); snd.place(d);
  toast(h.n === 1 ? `Only ${d} fits here: its row, column and box hold the rest` : `${d} goes here`, 2800);
  suMaybeDone();
}

// ================================================================ solving + rewards
function solved(k) {
  if (state !== 'play') return;
  state = 'won';
  const r = rec(day), x = r[k], ms = performance.now() - t0;
  x.done = 1; x.stars = starsFor(x.hints); st.solved++;
  const coins = 10 + 5 * x.stars; r.coins = (r.coins || 0) + coins;
  st.stars += x.stars; st.earned += x.stars; save();
  F.level(true);
  if (isToday()) B.submit(x.stars, { ms });
  M.add(coins, 'solve');
  snd.solve(); buzz([10, 40, 10]);
  const allDone = KINDS.every(q => r[q].done);
  setTimeout(() => { if (allDone) setDone(); else solvedCard(k); }, 900);
}
function solvedCard(k, review = false) {
  const r = rec(day), x = r[k], nk = KINDS.find(q => !r[q].done);
  const words = ['', 'Well solved', 'Nicely done', 'Splendid'];
  overlay('result', `<div class="ribbonh ${k === 'w' ? 'sage' : k === 's' ? 'rose' : ''}">${words[x.stars]}</div>
    <div class="bigstars">${starImgs(x.stars)}</div>
    <p>${META[k].name}${x.hints ? ` · ${x.hints} hint${x.hints > 1 ? 's' : ''}` : ' · no hints'}</p>
    ${review ? '' : `<div class="gain"><img src="assets/ui/coin.webp" alt="">+${10 + 5 * x.stars} coins</div>`}
    <div class="btns">${nk ? `<button class="go" data-goon>Next: ${META[nk].short}</button>` : ''}<button class="go soft" data-home>Back to the paper</button></div>`, { onTap: () => nk ? goNext() : goHome(), close: review });
  const g = ov.querySelector('.gain'); if (g) coinFly(6, g.getBoundingClientRect());
  ov.querySelector("[data-goon]")?.addEventListener('click', goNext);
  ov.querySelector('[data-home]').onclick = () => { snd.tap(); goHome(); };
  function goNext() { snd.page(); M.breakAd('level-end', { level: st.solved }).finally(() => {}); start(nk); }
}
function setDone() {
  const r = rec(day), today = isToday(), first = !r.complete;
  let sres = null, stamp = null;
  if (first) {
    r.complete = 1; r.perfect = KINDS.every(q => r[q].stars === 3) ? 1 : 0; st.sets++;
    stamp = STAMPS[(st.sets - 1) % STAMPS.length];
    const a = st.album[stamp] || { n: 0, gold: 0 }; a.n++; if (r.perfect) a.gold = 1; st.album[stamp] = a;
    r.stamp = stamp; M.add(30, 'set'); r.coins = (r.coins || 0) + 30;
    if (today) sres = streakOnComplete();
    save();
  } else stamp = r.stamp || STAMPS[0];
  const total = KINDS.reduce((a, q) => a + r[q].stars, 0), sn = streakNow();
  overlay('set', `<div class="kick">${fmt(day, { weekday: 'long', month: 'long', day: 'numeric' })}</div><h3>${today ? "Today's paper is done" : 'Edition complete'}</h3>
    <div class="stampbig ${r.perfect ? 'gold' : ''}"><img src="assets/stamps/stamp-${stamp}.webp" alt=""><div class="pm">${r.perfect ? 'First<br>class' : 'Morning<br>post'}<br>No. ${P.issueNo(day)}</div></div>
    <p style="margin-top:14px">${stampName(stamp)} stamp for your album · <b>${total}</b> of 9 stars</p>
    ${today ? `<p style="margin:0 0 6px"><b>${sn.n}-day streak</b>${sres && sres.used ? ' · a freeze kept it safe' : sres && sres.broke > 1 ? ` · a fresh start after ${sres.broke} days` : ''}</p>` : ''}
    <div class="btns">${today ? '<button class="go" data-share>Share my morning</button>' : ''}
      ${first ? `<button class="go sage" data-double><img src="${IC('video')}" alt="" style="width:30px;height:30px;margin:-6px 6px -6px -8px">Double today's ${r.coins} coins</button>` : ''}
      <button class="go soft" data-home>Back to the paper</button></div>`, { onTap: () => leave(), close: false });
  if (first) petals(30);
  snd.stamp(); setTimeout(() => snd.solve(), 500);
  ov.querySelector('[data-share]')?.addEventListener('click', e => { e.stopPropagation(); share(day); });
  ov.querySelector('[data-home]').onclick = () => { snd.tap(); leave(); };
  const dbl = ov.querySelector('[data-double]');
  if (dbl) dbl.onclick = async () => { snd.tap(); const n = r.coins; if (await M.rewarded('double', { what: `${n * 2} coins instead of ${n}` })) { M.add(n, 'double'); dbl.remove(); toast(`+${n} coins`); coinFly(8, ov?.querySelector('h3')?.getBoundingClientRect()); } };
  function leave() { closeOv(); goHome(); M.breakAd('level-end', { level: st.solved }); if (!today) { /* stay on the archive page */ } }
}
function shareText(n) {
  const r = rec(n), s = setOf(n), sn = streakNow();
  const line = k => `${META[k].icon} ${META[k].short.padEnd(14, ' ')} ${r[k].done ? '★'.repeat(r[k].stars) + '☆'.repeat(3 - r[k].stars) : '—'}`;
  return `The Morning Paper · No. ${s.no} · ${fmt(n, { weekday: 'short', month: 'short', day: 'numeric' })}\n${KINDS.map(line).join('\n')}\n${sn.n > 1 ? `🔥 ${sn.n}-day streak\n` : ''}${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
}
async function share(n) {
  snd.tap(); const text = shareText(n);
  try { if (navigator.share && !navigator.webdriver) { await navigator.share({ title: NAME, text }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text); toast('Copied, ready to paste'); } catch (e) { toast('Could not copy'); }
}

// ================================================================ cards: streak, archive, album, garden, settings
function streakCard() {
  const s = st.streak, sn = streakNow(), fz = freezes();
  const days = [...Array(7)].map((_, i) => P.addDays(TODAY, i - 6));
  const cell = n => { const done = st.days[n]?.complete, fr = s.frozen.includes(n); return `<div style="text-align:center"><div style="font:700 13px var(--serif);color:var(--gold);letter-spacing:.08em">${fmt(n, { weekday: 'short' }).toUpperCase()}</div><div style="width:40px;height:40px;margin:4px auto;border-radius:50%;display:grid;place-items:center;font:700 18px var(--serif);${done ? 'background:var(--sage);color:#fff' : fr ? 'background:#cfe0ef;color:var(--navy)' : 'background:#efe7d3;color:#a99c7c'}">${done ? '✓' : fr ? '❄' : P.fromNum(n).getDate()}</div></div>`; };
  overlay('streak', `<div class="ribbonh rose">${sn.n} day streak</div><p>Finish all three puzzles in today's paper to keep it going. Best so far: <b>${Math.max(s.best, sn.n)}</b> days.</p>
    <div style="display:flex;justify-content:space-between;margin:6px 0 10px">${days.map(cell).join('')}</div>
    <div class="row"><span><b>Streak freezes: ${fz}</b><br><small style="font-size:16px;color:var(--ink2)">One free each week. It is used for you if you miss a day.</small></span></div>
    <div class="btns">${s.extra < 2 ? `<button class="go soft" data-buy>Keep a spare freeze · ${FREEZE_COST} coins</button>` : ''}${s.broken && s.broken.prev > 2 && P.daysBetween(s.broken.at, TODAY) <= 1 && !s.broken.saved ? `<button class="go sage" data-rescue>Bring back my ${s.broken.prev}-day streak</button>` : ''}</div>`);
  ov.querySelector('[data-buy]')?.addEventListener('click', () => { if (M.spend(FREEZE_COST, 'freeze')) { s.extra++; save('streak'); toast('A spare freeze is tucked away'); streakCard(); } else M.shop(); });
  ov.querySelector('[data-rescue]')?.addEventListener('click', async () => { if (await M.rewarded('revive', { what: `your ${s.broken.prev}-day streak back` })) { s.n = s.broken.prev + (s.last === TODAY ? 1 : 0); s.broken.saved = 1; s.best = Math.max(s.best, s.n); save('streak'); toast('Your streak is back'); closeOv(); paintHome(); } });
}
let archMonth = null;
const archOpen = n => P.daysBetween(n, TODAY) < ARCH_FREE || st.unlocked.includes(n) || M.hasPass();
function archiveCard() {
  const base = archMonth || TODAY, d0 = P.fromNum(base), y = d0.getFullYear(), m = d0.getMonth();
  const first = new Date(y, m, 1, 12), days = new Date(y, m + 1, 0).getDate(), pad = first.getDay();
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push('<span></span>');
  for (let dd = 1; dd <= days; dd++) {
    const n = y * 10000 + (m + 1) * 100 + dd, future = n > TODAY, early = P.issueNo(n) < 1, r = st.days[n];
    const dots = r ? KINDS.map(k => `<i class="${r[k].done ? 'on' : ''}"></i>`).join('') : '';
    cells.push(`<button data-n="${n}" class="${n === TODAY ? 'today' : ''} ${r?.complete ? 'done' : ''}" ${future || early ? 'disabled' : ''}>${dd}${!future && !early && !archOpen(n) ? `<img class="lk" src="${IC('lock')}" alt="">` : ''}<span class="d">${dots}</span></button>`);
  }
  const prev = new Date(y, m - 1, 15, 12), next = new Date(y, m + 1, 15, 12);
  overlay('archive', `<div class="kick">The archive</div><h3>Past editions</h3><p style="font-size:calc(17px * var(--fs))">The last ${ARCH_FREE} days are free. Older papers open for ${ARCH_COST} coins.</p>
    <div class="calnav"><button class="round" data-pm aria-label="Previous month" ${P.issueNo(P.dayNum(prev)) < -30 ? 'disabled' : ''}><img src="${IC('undo')}" alt=""></button><b>${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b><button class="round" data-nm aria-label="Next month" ${P.dayNum(next) > TODAY + 31 ? 'disabled' : ''} style="transform:scaleX(-1)"><img src="${IC('undo')}" alt=""></button></div>
    <div class="cal">${'SMTWTFS'.split('').map(c => `<span class="h">${c}</span>`).join('')}${cells.join('')}</div>`);
  ov.querySelector('[data-pm]').onclick = () => { archMonth = P.dayNum(prev); snd.page(); archiveCard(); };
  const nm = ov.querySelector('[data-nm]'); if (P.dayNum(next) > TODAY + 31 || (next.getFullYear() * 100 + next.getMonth()) > (Math.floor(TODAY / 10000) * 100 + Math.floor(TODAY / 100) % 100 - 1)) nm.style.visibility = 'hidden'; nm.onclick = () => { archMonth = P.dayNum(next); snd.page(); archiveCard(); };
  ov.querySelectorAll('[data-n]').forEach(b => b.onclick = () => openDay(+b.dataset.n));
}
function openDay(n) {
  if (archOpen(n)) { archMonth = null; day = n; closeOv(); snd.page(); paintHome(); return; }
  overlay('unlock', `<div class="kick">${fmt(n)}</div><h3>Open this edition?</h3><p>Three puzzles from No. ${P.issueNo(n)}. It stays open for good.</p><div class="btns"><button class="go" data-y><img src="assets/ui/coin.webp" alt="" style="width:30px;height:30px;margin-right:6px">${ARCH_COST} coins</button><button class="go soft" data-n>Not now</button></div>`);
  ov.querySelector('[data-y]').onclick = () => { if (M.spend(ARCH_COST, 'archive')) { st.unlocked.push(n); save('unlocked'); openDay(n); } else { closeOv(); M.shop(); } };
  ov.querySelector('[data-n]').onclick = () => { snd.tap(); archiveCard(); };
}
function albumCard() {
  const have = STAMPS.filter(s => st.album[s]).length;
  overlay('album', `<div class="kick">Stamp album</div><h3>${have} of ${STAMPS.length} stamps</h3><p style="font-size:calc(17px * var(--fs))">Every finished paper sends you a stamp. Solve all three without hints for a gold <i>first class</i> edge.</p>
    <div class="album">${STAMPS.map((s, i) => { const a = st.album[s]; return a ? `<div class="s ${a.gold ? 'gold' : ''}"><img src="assets/stamps/stamp-${s}.webp" alt="${stampName(s)}">${a.n > 1 ? `<em>×${a.n}</em>` : ''}<span>${stampName(s)}</span></div>` : `<div class="s empty">No. ${i + 1}</div>`; }).join('')}</div><div style="height:24px"></div>`);
}
// ---------------------------------------------------------------- the reader's garden
let gardenEl = null;
function openGarden(fresh = null) {
  closeOv(); gardenEl?.remove(); document.body.classList.add('sheet-open');
  const wide = innerWidth / innerHeight > 0.9;
  gardenEl = $(`<div id="garden"><div class="gwrap" style="position:absolute;overflow:hidden"></div>
    <div class="gtop"><button class="round" data-x aria-label="Back"><img src="${IC('close')}" alt=""></button><span class="starpill"><img src="assets/ui/star-full.webp" alt=""><b>${st.stars}</b></span></div>
    <div class="paper gpanel"></div></div>`);
  if (wide) gardenEl.style.background = `#dfe7d0 url(assets/bg/meta-garden-wide-s.webp) center/cover no-repeat`;
  document.body.appendChild(gardenEl);
  ['pointerdown', 'pointerup'].forEach(t => gardenEl.addEventListener(t, e => e.stopPropagation()));
  const wrap = gardenEl.querySelector('.gwrap');
  const fit = () => {   // the portrait painting: cover on a phone, a framed painting on a wide screen
    const W = innerWidth, H = innerHeight; let w, h;
    if (wide) { h = H - 40; w = h / 1.5; wrap.style.borderRadius = '10px'; wrap.style.boxShadow = '0 0 0 6px #fbf7ee,0 0 0 8px #d9bd77,0 30px 60px rgba(31,45,84,.35)'; }
    else { const s = Math.max(W / 1024, H / 1536); w = 1024 * s; h = 1536 * s; }
    Object.assign(wrap.style, { width: w + 'px', height: h + 'px', left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px', background: `url(assets/bg/meta-garden${w * (devicePixelRatio || 1) < 1100 ? '-s' : ''}.webp) center/cover` });
  };
  fit();
  for (const d of DECOR) if (st.decor.includes(d.id)) wrap.insertAdjacentHTML('beforeend', `<img class="decor ${d.id === fresh ? 'new' : ''}" src="assets/decor/${d.id}.webp" alt="${d.name}" style="left:${d.x}%;top:${d.y}%;width:${d.w}%;z-index:${d.y | 0}">`);
  const panel = gardenEl.querySelector('.gpanel'), next = DECOR.find(d => !st.decor.includes(d.id));
  panel.innerHTML = next ? `<h3>The reader's garden</h3><p>${st.decor.length ? `${st.decor.length} of ${DECOR.length} pieces placed.` : 'An empty lawn, waiting for you.'} Next: the <b>${next.name.toLowerCase()}</b>.</p>
      <button class="go ${st.stars >= next.cost ? '' : 'soft'}" data-buy ${st.stars >= next.cost ? '' : 'disabled'} style="width:100%"><img src="assets/ui/star-full.webp" alt="" style="width:30px;height:30px;margin-right:8px">${st.stars >= next.cost ? `Place it for ${next.cost} stars` : `${next.cost - st.stars} more stars to go`}</button>`
    : `<h3>The reader's garden</h3><p>Every piece is in place. What a lovely spot for the morning paper.</p>`;
  panel.querySelector('[data-buy]')?.addEventListener('click', () => { if (st.stars < next.cost) return; st.stars -= next.cost; st.decor.push(next.id); save('stars', 'decor'); snd.solve(); petals(16); openGarden(next.id); });
  gardenEl.querySelector('[data-x]').onclick = () => { snd.tap(); closeGarden(); };
  addEventListener('resize', fit);
}
function closeGarden() { gardenEl?.remove(); gardenEl = null; document.body.classList.remove('sheet-open'); paintHome(); }
function settingsCard() {
  const sw = on => `<span class="sw ${on ? 'on' : ''}"></span>`;
  overlay('settings', `<div class="kick">Settings</div><h3>Your paper, your way</h3>
    <button class="row" style="width:100%" data-s="big"><span><b>Larger print</b><br><small style="font-size:16px;color:var(--ink2)">Bigger letters everywhere</small></span>${sw(st.big)}</button>
    <button class="row" style="width:100%" data-s="sound"><span><b>Sound</b></span>${sw(!snd.muted)}</button>
    <button class="row" style="width:100%" data-s="music"><span><b>Harp music</b></span>${sw(!snd.musicOff)}</button>
    <button class="row" style="width:100%" data-s="mistakes"><span><b>Show sudoku mistakes</b><br><small style="font-size:16px;color:var(--ink2)">Wrong numbers turn rose as you go</small></span>${sw(st.mistakes)}</button>
    <button class="row" style="width:100%" data-s="board"><span><b>World leaderboard</b><br><small style="font-size:16px;color:var(--ink2)">Stars from today's paper, everyone the same puzzles</small></span><img src="${IC('trophy')}" alt="" style="width:44px"></button>
    <button class="row" style="width:100%" data-s="help"><span><b>How to play</b></span><img src="${IC('hint')}" alt="" style="width:44px"></button>`);
  ov.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    const k = b.dataset.s; snd.tap();
    if (k === 'big') { st.big = !st.big; save('big'); document.documentElement.classList.toggle('big', st.big); }
    if (k === 'sound') snd.toggle();
    if (k === 'music') snd.toggleMusic();
    if (k === 'mistakes') { st.mistakes = !st.mistakes; save('mistakes'); }
    if (k === 'board') { closeOv(); return B.open(); }
    if (k === 'help') { closeOv(); return helpCard(); }
    settingsCard();
  });
}
function helpCard() {
  overlay('help', `<div class="kick">How to play</div><h3>Three puzzles a day</h3><div class="tut">
    <div><i>1</i><span><b>Mini crossword.</b> Tap a square and type. Tap it again to turn between Across and Down.</span></div>
    <div><i>2</i><span><b>Word search.</b> Drag along a word, or tap its first and last letters.</span></div>
    <div><i>3</i><span><b>Sudoku.</b> Every row, column and box holds 1 to 9 once.</span></div>
    <div><i>★</i><span>Three stars for a puzzle solved without hints. Stars plant your garden.</span></div>
    <div><i>☀</i><span>Monday is gentle and the week builds to a harder Saturday. There is never a clock.</span></div></div>`);
}

// ---------------------------------------------------------------- resize
addEventListener('resize', () => { paintBg(); if (kind === 'c') { cwLayout(); cwPaint(); } else if (kind === 'w') wsLayout(); else if (kind === 's') suLayout(); });
new MutationObserver(() => { if (kind === 'c') cwLayout(); else if (kind === 'w') wsLayout(); else if (kind === 's') suLayout(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

// ---------------------------------------------------------------- boot
function boot() {
  const qd = +Q.get('date'); if (qd && qd <= TODAY && P.issueNo(qd) >= 1 && archOpen(qd)) day = qd;
  setView('home'); paintHome();
  const ld = document.getElementById('load'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 500);
  const sn = streakNow();
  if (sn.frozen) setTimeout(() => toast(`A streak freeze kept your ${sn.n}-day streak safe`, 2600), 900);
  if (D.isDaily || qd) { const k = KINDS.find(q => !rec(day)[q].done); if (k) setTimeout(() => start(k), 700); }
}
boot();

// ---------------------------------------------------------------- test hooks + bot (paced like a person, one move at a time)
let botT = 0;
window.__game = {
  get state() { return state; },
  get level() { return st.solved; },
  get score() { const r = st.days[TODAY]; return r ? r.c.stars + r.w.stars + r.s.stars : 0; },
  bot() {
    if (ov) {
      if (ovKind === 'tut') return ov.querySelector('[data-ok]').click();
      if (ovKind === 'result' || ovKind === 'set') return;
      return closeOv();
    }
    if (gardenEl) return closeGarden();
    if (view === 'home') {
      const k = KINDS.find(q => !rec(day)[q].done); if (k) return start(k);
      for (let i = 0; i < ARCH_FREE; i++) { const n = P.addDays(TODAY, -i); if (!(st.days[n] && st.days[n].complete)) { day = n; paintHome(); return; } }
      return;
    }
    if (view !== 'play' || state !== 'play') return;
    const now = performance.now(); if (now - botT < (kind === 'w' ? 1600 : 560)) return; botT = now;
    if (kind === 'c') {
      const r = rec(day).c, N = C.N, e = C.s.entries.find(en => en.cells.some(([y, x]) => r.v[y * N + x] !== C.s.rows[y][x])); if (!e) return;
      const [y, x] = e.cells.find(([a, b]) => r.v[a * N + b] !== C.s.rows[a][b]);
      if (C.y !== y || C.x !== x || C.dir !== e.dir) { C.y = y; C.x = x; C.dir = e.dir; cwPaint(); }
      cwKey(C.s.rows[y][x]);
    } else if (kind === 'w') {
      const w = Wd.left()[0]; if (!w) return;
      wsCommit([w.y, w.x], [w.y + w.dy * (w.w.length - 1), w.x + w.dx * (w.w.length - 1)]);
    } else if (kind === 's') {
      const v = rec(day).s.v, i = v.findIndex((d, k) => d !== Su.s.sol[k]); if (i < 0) return;
      suSelect(i); suNum(Su.s.sol[i]);
    }
  },
};

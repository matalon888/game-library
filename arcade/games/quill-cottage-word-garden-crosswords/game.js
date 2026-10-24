// Quill Cottage: Word Garden Crosswords. Swipe the letter wheel to fill a hand-painted crossword, find bonus words,
// collect album stamps and bring a cottage garden back to life. Calm by design: no timers, no fail state, big type.
// Our own code, MIT. Art: assets/storybook (our own painted library, copied into art/).
import { LEVELS } from './levels.js';
import { makeLevel, schedule, isHard, wordsIn, isWord } from './gen.js';
import { snd } from './audio.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rng = seed => { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; };
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ------------------------------------------------------------ the journey: eight painted gardens × 15 puzzles
const GARDENS = [
  { bg: 'quill-cottage', name: 'Quill Cottage' },
  { bg: 'garden-gather', name: 'Foxglove Lane' },
  { bg: 'bluebell-bingo', name: 'Bluebell Wood' },
  { bg: 'hub', name: 'Terrace View' },
  { bg: 'peony-mahjong', name: 'Gazebo Garden' },
  { bg: 'larkspur-manor', name: 'Larkspur Walk' },
  { bg: 'robins-rescue', name: 'Orchard Gate' },
  { bg: 'rosewick', name: 'The Walled Garden' },
];
const PER = 15, JOURNEY = LEVELS.length;                 // 120, then endless "Wandering Paths"
const gardenOf = n => Math.floor((n - 1) / PER) % GARDENS.length;
const STAMPS = ['robin', 'rose', 'teapot', 'cottage', 'bluebells', 'butterfly', 'peony', 'hedgehog', 'teacup', 'cat', 'sunflower', 'bluetit',
  'hydrangea', 'swan', 'beehive', 'lighthouse', 'fox', 'lavender', 'owl', 'strawberry', 'sailboat', 'squirrel', 'tulip', 'kingfisher'];
// the garden to restore: [sprite, x%, y% (feet), width% of the painting]
const DECOR = [
  ['decor/bench', 50, 47, 24], ['decor/birdbath', 27, 63, 15], ['decor/plant-rose', 13, 57, 14], ['decor/fountain', 64, 67, 21],
  ['decor/rose-arch', 52, 37, 17], ['decor/plant-lavender', 41, 77, 13], ['decor/sundial', 79, 53, 12], ['decor/plant-peony', 89, 66, 12],
  ['decor/beehive', 20, 45, 10], ['decor/plant-hydrangea', 72, 79, 14], ['decor/urn', 35, 49, 8], ['decor/lantern', 67, 43, 5],
  ['decor/plant-foxglove', 7, 72, 9], ['decor/trellis', 84, 41, 11], ['decor/wheelbarrow', 55, 80, 16], ['decor/plant-tulip', 44, 61, 9],
  ['decor/birdhouse', 93, 49, 7], ['decor/plant-sunflower', 24, 80, 11], ['decor/watering-can', 59, 54, 9], ['decor/plant-sweet-pea', 77, 66, 10],
];
const DECOR_NAMES = ['a garden bench', 'a birdbath', 'a rose bush', 'a fountain', 'a rose arch', 'lavender', 'a sundial', 'peonies', 'a beehive', 'hydrangeas',
  'a stone urn', 'a lantern', 'foxgloves', 'a trellis', 'a wheelbarrow', 'tulips', 'a birdhouse', 'sunflowers', 'a watering can', 'sweet peas'];
const starsFor = i => 6 + i * 17;                        // stars needed for decor piece i (6, 23, 40 … 329)

// ------------------------------------------------------------ save
const KEY = 'quill-cottage';
const sget = (k, d) => { try { const v = localStorage.getItem(KEY + '_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const sset = (k, v) => { try { localStorage.setItem(KEY + '_' + k, JSON.stringify(v)); } catch (e) {} };
const FIELDS = { level: 1, stars: {}, total: 0, jar: 0, cur: null, daily: {}, dstreak: 0, dlast: 0, freezeWeek: -1, placed: 0, stamps: 0, big: false, words: 0 };
const S = {}; for (const k in FIELDS) S[k] = sget(k, FIELDS[k]);
{ const q = new URLSearchParams(location.search); if (q.has('level') && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) { S.level = +q.get('level') || 1; S.cur = null; S.stamps = Math.floor((S.level - 1) / 5); } }
const save = () => { for (const k in FIELDS) sset(k, S[k]); };
document.documentElement.classList.toggle('big', !!S.big);

// ------------------------------------------------------------ kit layers
const toastEl = $('toast'); let toastT = 0;
function toast(t, ms = 1800) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); }
const D = daily(KEY, null, { name: 'Quill Cottage' });
const F = flow(KEY);
const B = board({ game: 'quill-cottage', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 1 }, corner: 'tl' });
const M = money({ game: 'quill-cottage', style: 'C' });
const dayNum = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
const TODAY = dayNum(), week = d => Math.floor((d + 3) / 7);
const todayKey = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();
// daily streak with one free "streak freeze" a week: a single missed day is forgiven once per week
if (S.dstreak > 0 && TODAY - S.dlast >= 2) {
  if (TODAY - S.dlast === 2 && S.freezeWeek !== week(TODAY)) { S.freezeWeek = week(TODAY); S.dlast = TODAY - 1; save(); setTimeout(() => toast(`Your weekly streak freeze kept your ${S.dstreak}-day streak`, 3200), 1400); }
  else { S.dstreak = 0; save(); }
}
addEventListener('ap:ad', e => snd.pause(e.detail && e.detail.phase === 'start'));
const coinEl = $('coinn');
function showCoins(bump = false) { coinEl.textContent = M.coins().toLocaleString('en-US'); if (bump) { const c = $('coins'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } hintTag(); }
M.onChange(() => showCoins(true));
$('coins').addEventListener('click', e => { e.stopPropagation(); snd.tap(); M.shop(); });

// ------------------------------------------------------------ background painting (portrait / wide, cross-fade)
let bgCur = '', bgFlip = 0;
const portrait = () => innerWidth / innerHeight < 1;
function setBg(name, instant = false) {
  const url = `art/bg/${name}${portrait() ? '' : '-wide'}.webp`;
  if (url === bgCur) return Promise.resolve(); bgCur = url;
  return new Promise(res => {
    const img = new Image(); img.onload = img.onerror = () => {
      const a = $('bg' + bgFlip), b = $('bg' + (1 - bgFlip)); bgFlip = 1 - bgFlip;
      b.style.backgroundImage = `url(${url})`; if (instant) { b.style.transition = 'none'; a.style.transition = 'none'; }
      b.classList.add('on'); a.classList.remove('on');
      if (instant) requestAnimationFrame(() => { a.style.transition = ''; b.style.transition = ''; });
      res();
    }; img.src = url;
  });
}

// ------------------------------------------------------------ levels
function parse(str) { const [l, rows, cols, ws] = str.split('|'); return { l, rows: +rows, cols: +cols, w: ws.split(' ').map(s => { const [w, r, c, a] = s.split(','); return [w, +r, +c, +a]; }) }; }
function levelData(n, isDaily) {
  if (isDaily) {   // same for everyone today; a 6-letter wheel of common words, not adapted (tuned for ~80% to finish unaided)
    const L = makeLevel(rng(D.seed || todayKey), { letters: 6, min: 5, max: 7 }) || makeLevel(rng(todayKey + 1), { letters: 5, min: 4, max: 6 });
    if (L) return L;
  }
  if (n <= JOURNEY) return parse(LEVELS[n - 1]);
  const sc = schedule(n), L = makeLevel(rng(n * 7919 + 31), { ...sc, max: clamp(Math.round(sc.max * F.k()), sc.min, 10) });
  return L || parse(LEVELS[(n - 1) % JOURNEY]);
}

// ------------------------------------------------------------ build a puzzle
const gridEl = $('grid'), prevEl = $('preview'), wheelEl = $('wheel'), lineEl = $('line'), playEl = $('play'), titleEl = $('title'), winEl = $('win');
let state = 'ready', P = null, L = {}, ready = false;
function startLevel(isDaily = false) {
  const n = S.level, data = levelData(n, isDaily);
  const gi = isDaily ? TODAY % GARDENS.length : gardenOf(n), hard = !isDaily && n <= JOURNEY && isHard(n);
  setBg(GARDENS[gi].bg);
  const key = isDaily ? 'd' + todayKey : 'L' + n;
  const cells = new Map(), words = data.w.map(([w, r, c, a]) => {
    const ks = []; for (let i = 0; i < w.length; i++) { const rr = r + (a ? 0 : i), cc = c + (a ? i : 0), k = rr * 16 + cc; ks.push(k); if (!cells.has(k)) cells.set(k, { r: rr, c: cc, ch: w[i], on: false, shown: false, gift: false, el: null }); }
    return { w, r, c, a, cells: ks, found: false };
  });
  const gridSet = new Set(words.map(x => x.w));
  const bonus = new Set(wordsIn(data.l).filter(w => !gridSet.has(w)));
  const letters = data.l.toUpperCase().split('');
  P = { n, key, isDaily, gi, hard, letters, rows: data.rows, cols: data.cols, words, cells, bonus, bonusFound: new Set(), hints: 0, t0: performance.now(), lastFind: performance.now(), recorded: false };
  if (S.cur && S.cur.key === key) {
    for (const w of S.cur.found || []) { const x = words.find(y => y.w === w); if (x) { x.found = true; for (const k of x.cells) cells.get(k).on = true; } }
    for (const k of S.cur.shown || []) if (cells.has(k)) cells.get(k).shown = true;
    for (const k of S.cur.gift || []) if (cells.has(k)) { cells.get(k).shown = true; cells.get(k).gift = true; }
    for (const w of S.cur.bonus || []) P.bonusFound.add(w);
    P.hints = S.cur.hints || 0;
  } else {
    // honest adaptive help (kit/flow.js): a player who has needed hints lately gets one free gift letter on journey
    // puzzles after the first five. Off for world-board players (flow returns 1), never on the daily.
    if (!isDaily && n > 5 && F.k() < 0.97) {
      const w = words.filter(x => x.w.length >= 4).sort((a, b) => b.w.length - a.w.length)[1] || words[words.length - 1];
      const c = cells.get(w.cells[0]); c.shown = true; c.gift = true;
    }
    S.cur = { key, found: [], shown: [], gift: [...cells].filter(([, c]) => c.gift).map(([k]) => k), bonus: [], hints: 0 }; save();
  }
  buildGrid(); buildWheel();
  state = 'play'; botQ = null; botNext = performance.now() + 900;
  titleEl.classList.add('hide'); winEl.classList.add('hide'); playEl.classList.remove('hide');
  $('bandl').innerHTML = isDaily ? 'Daily <em>Puzzle</em>' : `Puzzle <em>${n}</em>` + (hard ? ' <i class="hard">Hard</i>' : '');
  ribbon(); updateJar(); layout();
  M.level(n); B.start(); snd.music(true);
  if (n <= 2 && !isDaily && !words.some(w => w.found)) setTimeout(tutorial, 900);
}
function saveCur() {
  if (!P) return;
  S.cur = { key: P.key, found: P.words.filter(w => w.found).map(w => w.w), shown: [...P.cells].filter(([, c]) => c.shown && !c.on && !c.gift).map(([k]) => k),
    gift: [...P.cells].filter(([, c]) => c.gift && !c.on).map(([k]) => k), bonus: [...P.bonusFound], hints: P.hints };
  save();
}
function buildGrid() {
  gridEl.innerHTML = '';
  for (const [, c] of P.cells) {
    const el = document.createElement('div'); el.className = 'tile' + (c.on ? ' on' : c.gift ? ' hint gift' : c.shown ? ' hint' : '');
    el.innerHTML = `<span>${c.ch.toUpperCase()}</span>`; c.el = el; gridEl.appendChild(el);
  }
}
let wl = [], order = [];
function buildWheel() {
  wheelEl.querySelectorAll('.wl').forEach(e => e.remove());
  wl = P.letters.map((ch, i) => { const e = document.createElement('div'); e.className = 'wl'; e.innerHTML = `<span>${ch}</span>`; wheelEl.appendChild(e); return e; });
  wheelEl.classList.toggle('many', P.letters.length >= 6);
  order = P.letters.map((_, i) => i);
  // never show a wheel that already spells an answer clockwise from the top
  if (P.words.some(w => w.w.toUpperCase() === P.letters.join(''))) order.push(order.shift());
  placeWheel();
}
function placeWheel() {
  const n = P.letters.length, R = L.D * (n >= 6 ? 0.36 : n === 3 ? 0.29 : 0.33), c = L.D / 2;
  wl.forEach((e, i) => { const a = -Math.PI / 2 + order[i] / n * Math.PI * 2; e._x = c + Math.cos(a) * R; e._y = c + Math.sin(a) * R; e.style.left = e._x + 'px'; e.style.top = e._y + 'px'; });
}
function ribbon() {
  const r = $('ribbon'), solved = !!S.daily[todayKey];
  r.classList.toggle('sage', !S.dstreak);
  r.querySelector('small').textContent = S.dstreak ? 'Daily streak' : 'Daily puzzle';
  r.querySelector('b').textContent = S.dstreak ? `${S.dstreak} day${S.dstreak > 1 ? 's' : ''}` : solved ? 'Solved' : 'Fresh today';
  $('dailyb').classList.toggle('done', solved);
}

// ------------------------------------------------------------ layout (phone portrait first, desktop landscape)
const sab = document.createElement('div'); sab.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top)'; document.body.appendChild(sab);
const insetB = () => parseFloat(getComputedStyle(sab).paddingBottom) || 0, insetT = () => parseFloat(getComputedStyle(sab).paddingTop) || 0;
function layout() {
  const W = innerWidth, H = innerHeight, port = W / H < 0.9, band = 62 + insetB();
  let D, cx, wcy, gx0, gx1, gy0, gy1;
  if (port) {
    D = clamp(Math.min(W * 0.6, H * 0.29), 180, 250); cx = W / 2; wcy = H - band - 30 - D / 2;
    gx0 = 10; gx1 = W - 10; gy0 = insetT() + 96; gy1 = wcy - D / 2 - 84;
  } else {
    D = clamp(Math.min(H * 0.42, W * 0.25), 210, 320); cx = W * 0.74; wcy = (H - band) / 2 + 52;
    gx0 = W * 0.06; gx1 = W * 0.56; gy0 = insetT() + 100; gy1 = H - band - 36;
  }
  L = { D, cx, wcy, port };
  document.documentElement.style.setProperty('--D', D + 'px');
  Object.assign(wheelEl.style, { left: cx - D / 2 + 'px', top: wcy - D / 2 + 'px' });
  const sx = port ? Math.min(D / 2 + 50, W / 2 - 42) : D / 2 + 74, sy = D * (port ? 0.27 : 0.25);
  const side = (id, dx, dy) => Object.assign($(id).style, { left: cx + dx - 40 + 'px', top: wcy + dy - 46 + 'px' });
  side('hintb', -sx, -sy); side('shufb', -sx, sy); side('bonusb', sx, -sy); side('dailyb', sx, sy);
  const pY = wcy - D / 2 - 46; prevEl.style.top = pY - 26 + 'px'; prevEl.style.left = cx + 'px';
  Object.assign($('robin').style, port ? { left: Math.max(4, cx - sx - 44) + 'px', top: wcy - sy - 46 - 104 + 'px' } : { left: cx - sx - 56 + 'px', top: wcy + sy + 84 + 'px' });
  if (P) {
    const aw = gx1 - gx0, ah = gy1 - gy0;
    const t = Math.floor(Math.min(port ? 58 : 84, aw / (P.cols * 1.08 - 0.08), ah / (P.rows * 1.08 - 0.08)));
    const p = t * 1.08, gw = P.cols * p - t * 0.08, gh = P.rows * p - t * 0.08;
    const gcx = (gx0 + gx1) / 2, gTop = gy0 + Math.max(0, (ah - gh) * (port ? 0.55 : 0.45));
    document.documentElement.style.setProperty('--t', t + 'px');
    Object.assign(gridEl.style, { left: gcx - gw / 2 + 'px', top: gTop + 'px', width: gw + 'px', height: gh + 'px' });
    for (const [, c] of P.cells) { c.el.style.left = c.c * p + 'px'; c.el.style.top = c.r * p + 'px'; }
    L.gTop = gTop; L.gh = gh; L.gcx = gcx;
    placeWheel();
  }
  sizeFx();
}
addEventListener('resize', () => { layout(); if (P && state !== 'ready') setBg(GARDENS[P.gi].bg, true); else setBg(GARDENS[gardenOf(S.level)].bg, true); if (!$('garden').classList.contains('hide')) drawGarden(); });

// ------------------------------------------------------------ wheel input (drag across letters; tap-tap also works)
let sel = [], dragging = false, ptr = null;
function letterAt(x, y) {
  const r = wheelEl.getBoundingClientRect(), lx = x - r.left, ly = y - r.top;
  let best = -1, bd = L.D * (P.letters.length >= 6 ? 0.13 : 0.15);
  wl.forEach((e, i) => { const d = Math.hypot(e._x - lx, e._y - ly); if (d < bd) { bd = d; best = i; } });
  return best;
}
function beginSel(i) { sel = []; dragging = true; addSel(i); hideTut(); }
function addSel(i) {
  if (i < 0) return;
  if (sel.length >= 2 && sel[sel.length - 2] === i) { const j = sel.pop(); wl[j].classList.remove('sel'); snd.letter(sel.length - 1); }
  else if (!sel.includes(i)) { sel.push(i); wl[i].classList.add('sel'); snd.letter(sel.length - 1); buzz(5); }
  drawPreview(); drawLine();
}
function drawPreview(cls = '') {
  const w = sel.map(i => P.letters[i]).join('');
  prevEl.innerHTML = [...w].map(c => `<span>${c}</span>`).join('');
  prevEl.className = w ? cls : 'empty';
}
function drawLine() {
  const k = 100 / L.D, pts = sel.map(i => `${wl[i]._x * k},${wl[i]._y * k}`);
  if (dragging && ptr && sel.length) { const r = wheelEl.getBoundingClientRect(); pts.push(`${(ptr.x - r.left) * k},${(ptr.y - r.top) * k}`); }
  lineEl.setAttribute('points', pts.join(' '));
}
lineEl.style.vectorEffect = 'non-scaling-stroke'; lineEl.setAttribute('vector-effect', 'non-scaling-stroke');
function endSel() {
  dragging = false; ptr = null;
  const w = sel.map(i => P.letters[i]).join('').toLowerCase();
  const spans = [...prevEl.children].map(s => s.getBoundingClientRect());
  wl.forEach(e => e.classList.remove('sel')); lineEl.setAttribute('points', '');
  sel = [];
  if (w.length < 3) { setTimeout(() => { if (!dragging) drawPreview(); }, w.length ? 250 : 0); return; }
  submit(w, spans);
}
wheelEl.addEventListener('pointerdown', e => {
  if (state !== 'play') return; e.preventDefault(); snd.unlock();
  ptr = { x: e.clientX, y: e.clientY }; const i = letterAt(e.clientX, e.clientY);
  if (i >= 0) beginSel(i);
  else if (Math.hypot(e.clientX - (L.cx), e.clientY - L.wcy) < L.D * 0.16) shuffle();   // the centre ornament shuffles
});
addEventListener('pointermove', e => { if (!dragging) return; ptr = { x: e.clientX, y: e.clientY }; addSel(letterAt(e.clientX, e.clientY)); drawLine(); });
addEventListener('pointerup', () => { if (dragging) endSel(); });
addEventListener('pointercancel', () => { if (dragging) endSel(); });

// ------------------------------------------------------------ words
const PRAISE = { 4: 'Lovely', 5: 'Splendid', 6: 'Wonderful', 7: 'Magnificent' };
function submit(w, spans) {
  const gw = P.words.find(x => x.w === w);
  if (gw && !gw.found) { prevEl.className = 'good'; setTimeout(() => drawPreview(), 420); found(gw, spans); return; }
  if (gw) { prevEl.className = 'gold'; for (const k of gw.cells) bump(P.cells.get(k).el, 'shake'); snd.again(); toast('Already in the crossword'); setTimeout(() => drawPreview(), 450); return; }
  if (P.bonus.has(w) || isWord(w)) {
    if (P.bonusFound.has(w)) { toast('You found that bonus word already'); snd.again(); prevEl.className = 'gold'; setTimeout(() => drawPreview(), 450); return; }
    P.bonusFound.add(w); prevEl.className = 'gold'; setTimeout(() => drawPreview(), 480); bonusWord(w); return;
  }
  prevEl.className = 'bad'; snd.wrong(); buzz([8, 40, 8]); setTimeout(() => drawPreview(), 420);
}
function bump(el, cls = 'pop') { el.classList.remove('pop', 'glow', 'shake'); void el.offsetWidth; el.classList.add(cls); }
function found(gw, spans) {
  gw.found = true; P.lastFind = performance.now(); S.words++;
  snd.word(gw.w.length); buzz(12);
  if (PRAISE[Math.min(7, gw.w.length)]) praise(PRAISE[Math.min(7, gw.w.length)]);
  const robin = $('robin'); robin.classList.remove('hop'); void robin.offsetWidth; robin.classList.add('hop');
  gw.cells.forEach((k, i) => {
    const c = P.cells.get(k), tr = c.el.getBoundingClientRect(), from = spans[i] || prevEl.getBoundingClientRect();
    const fly = document.createElement('div'); fly.className = 'fly'; fly.textContent = c.ch.toUpperCase();
    Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', fontSize: from.height * 0.7 + 'px' });
    document.body.appendChild(fly);
    const dx = tr.left - from.left, dy = tr.top - from.top, s = tr.width / Math.max(1, from.width);
    const a = fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 26}px) scale(${(1 + s) / 2 * 1.1})`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0.7 }], { duration: RM ? 10 : 460 + i * 55, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
    a.onfinish = () => { fly.remove(); c.on = true; c.shown = false; c.el.className = 'tile on'; bump(c.el); snd.tile(i); sparkle(tr.left + tr.width / 2, tr.top + tr.height / 2, 5); };
  });
  if (gw.w.length >= 5 || Math.random() < 0.3) butterfly(gw);
  setTimeout(afterReveal, 520 + gw.w.length * 55);
  saveCur();
}
function afterReveal() {
  if (!P || state !== 'play') return;
  for (const w of P.words) if (!w.found && w.cells.every(k => P.cells.get(k).on || P.cells.get(k).shown)) {
    w.found = true; w.cells.forEach((k, i) => { const c = P.cells.get(k); c.on = true; c.shown = false; setTimeout(() => { c.el.className = 'tile on'; bump(c.el, 'glow'); snd.tile(i); }, i * 60); });
  }
  saveCur();
  if (P.words.every(w => w.found)) win();
}
const JAR = 10, JAR_COINS = 50;
function bonusWord(w) {
  snd.bonus(); S.jar++; buzz(8);
  const jr = $('bonusb').querySelector('.round').getBoundingClientRect(), from = prevEl.getBoundingClientRect();
  const fly = document.createElement('div'); fly.className = 'fly'; fly.textContent = w.toUpperCase();
  Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', height: from.height + 'px', padding: '0 14px', fontSize: '26px', background: '#f8efd4' });
  document.body.appendChild(fly);
  fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${jr.left + jr.width / 2 - from.left - from.width / 2}px,${jr.top + jr.height / 2 - from.top - from.height / 2}px) scale(.25)`, opacity: 0.3 }],
    { duration: RM ? 10 : 600, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => { fly.remove(); bump($('bonusb'), 'bump'); updateJar(); };
  toast(`${w.toUpperCase()} · bonus word`);
  if (S.jar >= JAR) setTimeout(() => { S.jar = 0; coinsFly($('bonusb'), JAR_COINS, 'bonus words'); toast(`Ten bonus words! +${JAR_COINS} coins`, 2200); snd.hint(); updateJar(); save(); }, 800);
  saveCur();
}
function updateJar() { $('bonusn').textContent = `${S.jar}/${JAR}`; }
function coinsFly(fromEl, n, reason) {
  const fr = fromEl.getBoundingClientRect(), to = $('coins').querySelector('img').getBoundingClientRect(), k = RM ? 1 : Math.min(9, Math.ceil(n / 6));
  for (let i = 0; i < k; i++) {
    const s = document.createElement('img'); s.src = 'art/ui/coin.webp'; s.className = 'flycoin';
    s.style.left = fr.left + fr.width / 2 + 'px'; s.style.top = fr.top + fr.height / 2 + 'px'; document.body.appendChild(s);
    const mx = (Math.random() - 0.5) * 120, my = -50 - Math.random() * 60;
    s.animate([{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${mx}px,${my}px) scale(1.1)`, offset: 0.35 }, { transform: `translate(${to.left + to.width / 2 - fr.left - fr.width / 2}px,${to.top + to.height / 2 - fr.top - fr.height / 2}px) scale(.8)` }],
      { duration: 750 + i * 70, easing: 'cubic-bezier(.4,0,.5,1)', fill: 'forwards' }).onfinish = () => { s.remove(); snd.coin(); if (i === k - 1) M.add(n, reason); };
  }
}
let praiseT = 0;
function praise(t) {
  const c = $('praise'); c.textContent = t + '!';
  c.style.top = (L.port ? Math.max(70, (L.gTop || 300) - 52) : (L.gTop || 120) - 56) + 'px'; c.style.left = (L.port ? innerWidth / 2 : L.gcx) + 'px';
  c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); clearTimeout(praiseT); praiseT = setTimeout(() => c.classList.remove('go'), 1200);
}
function butterfly(gw) {
  if (RM) return;
  const last = P.cells.get(gw.cells[gw.cells.length - 1]).el.getBoundingClientRect();
  const b = document.createElement('div'); b.className = 'bfly flap'; document.body.appendChild(b);
  const sx = L.cx - 20, sy = L.wcy - L.D / 2, ex = last.left + last.width, ey = last.top - 30, fx = innerWidth + 60, fy = -60;
  b.animate([{ transform: `translate(${sx}px,${sy}px) rotate(-10deg)` }, { transform: `translate(${(sx + ex) / 2 - 40}px,${(sy + ey) / 2}px) rotate(12deg)`, offset: 0.35 },
    { transform: `translate(${ex}px,${ey}px) rotate(-8deg)`, offset: 0.6 }, { transform: `translate(${fx}px,${fy}px) rotate(20deg)` }],
    { duration: 3200, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => b.remove();
  b.style.left = '0'; b.style.top = '0';
}

// ------------------------------------------------------------ hint, shuffle, bonus, daily buttons
const HINT = 60;
function hintTag() {
  const t = $('hintb').querySelector('.tag'); if (!t) return;
  const free = M.coins() < HINT;
  t.classList.toggle('vid', free); t.innerHTML = free ? '▶ Free' : `<img src="art/ui/coin.webp" alt="">${HINT}`;
}
function hiddenCells() { const out = []; for (const w of P.words) if (!w.found) for (const k of w.cells) { const c = P.cells.get(k); if (!c.on && !c.shown && !out.includes(k)) out.push(k); } return out; }
function giveHint() {
  const w = P.words.filter(x => !x.found).sort((a, b) => a.w.length - b.w.length)[0]; if (!w) return false;
  const k = w.cells.find(k => { const c = P.cells.get(k); return !c.on && !c.shown; }); if (k == null) return false;
  const c = P.cells.get(k); c.shown = true; P.hints++; c.el.className = 'tile hint'; bump(c.el); snd.hint();
  const r = c.el.getBoundingClientRect(); sparkle(r.left + r.width / 2, r.top + r.height / 2, 8);
  setTimeout(afterReveal, 320); saveCur(); return true;
}
$('hintb').addEventListener('click', async e => {
  e.stopPropagation(); if (state !== 'play' || !hiddenCells().length) return; snd.unlock(); snd.tap();
  if (M.spend(HINT, 'hint')) { giveHint(); return; }
  if (await M.rewarded('hint', { what: 'one letter revealed in the crossword' }) && state === 'play') giveHint();
});
function shuffle() {
  if (state !== 'play') return; snd.unlock(); snd.shuffle();
  const n = order.length; let o; do { o = order.slice(); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } } while (n > 2 && o.every((v, i) => v === order[i]));
  order = o; placeWheel();
}
$('shufb').addEventListener('click', e => { e.stopPropagation(); shuffle(); bump($('shufb'), 'bump'); });
$('bonusb').addEventListener('click', e => { e.stopPropagation(); if (!P) return; snd.tap(); const b = [...P.bonusFound];
  toast(b.length ? 'Bonus words: ' + b.map(w => w.toUpperCase()).join(' · ') : `Extra real words fill the bonus book: ${JAR} = ${JAR_COINS} coins`, 2600); });
function openDaily() {
  if (S.daily[todayKey]) { toast('Today\'s puzzle is solved. A new one blooms tomorrow.', 2400); return; }
  if (P && state === 'play' && P.isDaily) return;
  if (P && state === 'play') saveCur();
  snd.unlock(); snd.page(); startLevel(true);
}
$('dailyb').addEventListener('click', e => { e.stopPropagation(); openDaily(); });
$('ribbon').addEventListener('click', e => { e.stopPropagation(); openDaily(); });

// ------------------------------------------------------------ tutorial finger (puzzles 1–2)
let tutEl = null;
function tutorial() {
  if (!P || state !== 'play' || P.words.some(w => w.found) || dragging) return;
  const w = P.words.slice().sort((a, b) => a.w.length - b.w.length)[0].w.toUpperCase(), used = new Set(), idx = [];
  for (const ch of w) { const i = P.letters.findIndex((c, j) => c === ch && !used.has(j)); used.add(i); idx.push(i); }
  tutEl = document.createElement('div');
  Object.assign(tutEl.style, { position: 'absolute', zIndex: 5, width: '46px', height: '46px', margin: '-23px 0 0 -23px', borderRadius: '50%', background: 'rgba(176,74,92,.35)', border: '3px solid #B04A5C', pointerEvents: 'none' });
  wheelEl.appendChild(tutEl);
  const kf = idx.map((i, k) => ({ left: wl[i]._x + 'px', top: wl[i]._y + 'px', offset: 0.1 + k / Math.max(1, idx.length - 1) * 0.65 }));
  tutEl.animate([{ ...kf[0], offset: 0, opacity: 0 }, ...kf, { ...kf[kf.length - 1], offset: 1, opacity: 0 }], { duration: 2600, iterations: Infinity });
  toast('Slide across the letters to spell a word', 3200);
}
function hideTut() { if (tutEl) { tutEl.remove(); tutEl = null; } }

// ------------------------------------------------------------ win
let wonAt = 0, winReward = 0, doubled = false, shareText = '';
function win() {
  if (state !== 'play') return;
  state = 'won'; hideTut();
  const stars = P.hints === 0 ? 3 : P.hints <= 2 ? 2 : 1, ms = performance.now() - P.t0;
  const prev = (P.isDaily ? S.daily[todayKey] : S.stars[P.n]) || 0;
  if (stars > prev) { S.total += stars - prev; if (P.isDaily) S.daily[todayKey] = stars; else S.stars[P.n] = stars; }
  if (P.isDaily && !prev) { S.dstreak = S.dlast === TODAY - 1 ? S.dstreak + 1 : S.dlast === TODAY ? S.dstreak : 1; S.dlast = TODAY; }
  if (!P.recorded) { P.recorded = true; F.level(P.hints === 0, P.hints === 0 ? 1 : clamp(1 - P.hints / Math.max(1, P.cells.size), 0, 1)); }
  B.submit(stars, { ms });
  const gardenDone = !P.isDaily && P.n % PER === 0 && P.n <= JOURNEY;
  let stamp = null;
  if (!P.isDaily && P.n % 5 === 0 && P.n / 5 > S.stamps && S.stamps < STAMPS.length) { S.stamps = P.n / 5; stamp = STAMPS[S.stamps - 1]; }
  winReward = 20 + (gardenDone ? 100 : 0) + (P.isDaily ? 30 : 0); doubled = false;
  S.cur = null; save();
  snd.win(); petals(RM ? 0 : 90);
  if (P.isDaily) shareText = shareGrid(stars);
  setTimeout(() => {
    if (state !== 'won') return;
    const g = GARDENS[P.gi];
    $('wsub').textContent = P.isDaily ? 'Daily Puzzle' : P.n > JOURNEY ? `Wandering Paths · Puzzle ${P.n}` : `${g.name} · ${(P.n - 1) % PER + 1} of ${PER}`;
    $('wtitle').textContent = gardenDone ? 'Garden complete!' : P.isDaily ? 'Today\'s garden is done' : ['Splendid!', 'Lovely work!', 'Beautifully done!', 'Wonderful!'][P.n % 4];
    const nextDecor = DECOR.findIndex((_, i) => S.total < starsFor(i));
    const unlockedNew = S.placed < DECOR.length && S.total >= starsFor(S.placed);
    $('wline').textContent = gardenDone ? `Next, the path leads on to ${GARDENS[(P.gi + 1) % GARDENS.length].name}.`
      : unlockedNew ? `You can plant ${DECOR_NAMES[S.placed]} in your garden!`
      : `${P.words.length} words` + (P.bonusFound.size ? ` and ${P.bonusFound.size} bonus` : '') + (nextDecor >= 0 ? ` · ${starsFor(nextDecor) - S.total} ★ to ${DECOR_NAMES[nextDecor]}` : '');
    $('wcoins').textContent = winReward; $('wdbl').textContent = winReward * 2;
    $('wstamp').classList.toggle('hide', !stamp);
    if (stamp) { $('wstampi').src = `art/stamps/stamp-${stamp}.webp`; $('wstampt').textContent = `A new stamp for your album: the ${stamp}`; setTimeout(snd.stamp, 500); }
    $('wdouble').classList.toggle('hide', false); $('wdouble').disabled = false; $('wdouble').style.opacity = 1;
    $('wshare').classList.toggle('hide', !P.isDaily);
    const sv = [...$('wstars').children]; sv.forEach(s => s.classList.remove('on'));
    sv.forEach((s, i) => { if (i < stars) setTimeout(() => { s.classList.add('on'); snd.star(i); }, 250 + i * 280); });
    winEl.classList.remove('hide'); wonAt = performance.now();
  }, 700);
}
// a spoiler-free share grid: the crossword's shape, no letters
function shareGrid(stars) {
  const g = Array.from({ length: P.rows }, () => Array(P.cols).fill('▫️'));
  for (const [, c] of P.cells) g[c.r][c.c] = c.shown && !c.gift ? '🌼' : '🌿';
  const d = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Quill Cottage · Daily Puzzle ${d}\n${g.map(r => r.join('')).join('\n')}\n${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${P.words.length} words · ${P.bonusFound.size} bonus · ${P.hints ? P.hints + ' hint' + (P.hints > 1 ? 's' : '') : 'no hints'}` +
    (S.dstreak > 1 ? ` · ${S.dstreak}-day streak` : '');
}
async function share() {
  const u = new URL(location.href); u.search = '?daily=1';
  try { if (navigator.share) { await navigator.share({ title: 'Quill Cottage', text: shareText, url: u.href }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(shareText + '\n' + u.href); toast('Copied. Paste it to a friend!'); } catch (e) { toast('Sharing is not available here'); }
}
$('wshare').addEventListener('click', e => { e.stopPropagation(); share(); });
$('wdouble').addEventListener('click', async e => {
  e.stopPropagation(); if (doubled || state !== 'won') return; snd.tap();
  if (await M.rewarded('double', { what: `${winReward * 2} coins instead of ${winReward}` })) { doubled = true; winReward *= 2; $('wcoins').textContent = winReward; $('wdouble').disabled = true; $('wdouble').style.opacity = 0.45; snd.coin(); }
});
let advancing = false;
async function next() {
  if (state !== 'won' || advancing || performance.now() - wonAt < 350) return;
  advancing = true; snd.tap();
  coinsFly($('wcoins'), winReward, P.isDaily ? 'daily' : 'win');
  winEl.classList.add('hide');
  const wasDaily = P.isDaily, n = P.n;
  if (!wasDaily) S.level++;
  save();
  await M.breakAd('level-end', { level: n });       // natural break only; the kit decides (none before level 4 etc.)
  advancing = false;
  if (wasDaily) showTitle(); else startLevel(false);
}
$('wnext').addEventListener('click', e => { e.stopPropagation(); next(); });
winEl.addEventListener('pointerup', e => { if (e.target.closest('#wdouble,#wshare')) return; if (wonAt && !$('win').classList.contains('hide')) next(); });

// ------------------------------------------------------------ title
function showTitle() {
  state = 'ready'; dragging = false; hideTut();
  if (P && state === 'play') saveCur();
  playEl.classList.add('hide'); winEl.classList.add('hide'); titleEl.classList.remove('hide');
  const n = S.level, gi = gardenOf(n), inG = n > JOURNEY ? 0 : (n - 1) % PER;
  setBg(GARDENS[gi].bg);
  $('tch').textContent = n > JOURNEY ? 'Wandering Paths' : `Garden ${gi + 1} of ${GARDENS.length}`;
  $('tname').textContent = GARDENS[gi].name;
  $('tbar').style.width = (n > JOURNEY ? 100 : inG / PER * 100) + '%';
  $('tlv').textContent = n > JOURNEY ? `Puzzle ${n}` : `Puzzle ${inG + 1} of ${PER}`;
  $('tstars').textContent = S.total;
  const dfirst = D.isDaily && !S.daily[todayKey];
  $('goplay').innerHTML = dfirst ? 'Play<small>Today\'s daily puzzle</small>' : `Play<small>Puzzle ${n}</small>`;
  $('ddot').classList.toggle('hide', !!S.daily[todayKey]);
  $('gdot').classList.toggle('hide', !(S.placed < DECOR.length && S.total >= starsFor(S.placed)));
  snd.music(false);
}
function play() { if (!ready) return false; snd.unlock(); snd.page(); startLevel(D.isDaily && !S.daily[todayKey]); return true; }
$('goplay').addEventListener('click', e => { e.stopPropagation(); play(); });
$('godaily').addEventListener('click', e => { e.stopPropagation(); openDaily(); });
titleEl.addEventListener('click', e => { if (state === 'ready' && !e.target.closest('button')) play(); });
$('homeb').addEventListener('click', e => { e.stopPropagation(); snd.tap(); if (state === 'play') { saveCur(); showTitle(); } });

// ------------------------------------------------------------ the garden (meta: restore it with stars)
function drawGarden(fresh = -1) {
  const box = $('gbox'); box.querySelectorAll('.deco,.ghostlab').forEach(e => e.remove());
  const items = DECOR.map((d, i) => [d, i]).sort((a, b) => a[0][2] - b[0][2]);
  for (const [[src, x, y, w], i] of items) {
    if (i > S.placed) continue;
    const ready = i === S.placed, can = ready && S.total >= starsFor(i);
    if (i === S.placed && i >= DECOR.length) continue;
    const el = document.createElement('div'); el.className = 'deco' + (ready ? ' ghost' : '') + (i === fresh ? ' new' : '');
    Object.assign(el.style, { left: x + '%', top: y + '%', width: w + '%', aspectRatio: '1 / 1.1', backgroundImage: `url(art/${src}.webp)` });
    box.appendChild(el);
    if (ready) {
      const lab = document.createElement('button'); lab.className = 'ghostlab'; Object.assign(lab.style, { left: x + '%', top: y + '%' });
      lab.textContent = can ? 'Tap to plant' : `★ ${starsFor(i)}`; box.appendChild(lab);
      if (can) { el.style.opacity = 0.75; el.style.cursor = 'pointer'; const go = ev => { ev.stopPropagation(); plant(); }; el.addEventListener('click', go); lab.addEventListener('click', go); }
    }
  }
  const left = DECOR.length - S.placed;
  $('gline').textContent = left <= 0 ? 'Every corner of the garden is in bloom. Thank you!'
    : S.total >= starsFor(S.placed) ? `You have ${S.total} ★. Tap the faded ${DECOR_NAMES[S.placed].replace(/^an? /, '')} to plant it.`
    : `${S.placed} of ${DECOR.length} planted · ${starsFor(S.placed) - S.total} more ★ for ${DECOR_NAMES[S.placed]}`;
}
function plant() {
  if (S.placed >= DECOR.length || S.total < starsFor(S.placed)) return;
  S.placed++; save(); snd.stamp(); buzz(14);
  drawGarden(S.placed - 1);
  const d = DECOR[S.placed - 1], r = $('gbox').getBoundingClientRect();
  sparkle(r.left + r.width * d[1] / 100, r.top + r.height * d[2] / 100 - 30, 16); petals(RM ? 0 : 30);
}
$('gogarden').addEventListener('click', e => { e.stopPropagation(); snd.tap(); $('garden').classList.remove('hide'); drawGarden(); });
$('gback').addEventListener('click', e => { e.stopPropagation(); snd.tap(); $('garden').classList.add('hide'); showTitle(); });

// ------------------------------------------------------------ stamp album (collection)
function drawAlbum() {
  const g = $('stamps'); g.innerHTML = '';
  STAMPS.forEach((s, i) => {
    const d = document.createElement('div'), got = i < S.stamps; d.className = 'stamp' + (got ? '' : ' lock');
    d.innerHTML = `<img src="art/stamps/stamp-${s}.webp" alt="${s}">` + (got ? '' : `<b>Puzzle ${(i + 1) * 5}</b>`); g.appendChild(d);
  });
  $('aline').textContent = `${S.stamps} of ${STAMPS.length} stamps · one for every five puzzles`;
}
$('goalbum').addEventListener('click', e => { e.stopPropagation(); snd.page(); drawAlbum(); $('album').classList.remove('hide'); });
$('aback').addEventListener('click', e => { e.stopPropagation(); snd.tap(); $('album').classList.add('hide'); });

// ------------------------------------------------------------ settings (Larger text, sound, music)
function syncSw() { $('sw-big').classList.toggle('on', !!S.big); $('sw-snd').classList.toggle('on', snd.sound); $('sw-mus').classList.toggle('on', snd.musicOn); }
const openSet = e => { e.stopPropagation(); snd.tap(); syncSw(); $('settings').classList.remove('hide'); };
$('setb').addEventListener('click', openSet); $('goset').addEventListener('click', openSet);
$('o-big').addEventListener('click', e => { e.stopPropagation(); S.big = !S.big; save(); document.documentElement.classList.toggle('big', S.big); syncSw(); layout(); });
$('o-snd').addEventListener('click', e => { e.stopPropagation(); snd.setSound(!snd.sound); syncSw(); });
$('o-mus').addEventListener('click', e => { e.stopPropagation(); snd.setMusic(!snd.musicOn); syncSw(); });
$('sclose').addEventListener('click', e => { e.stopPropagation(); $('settings').classList.add('hide'); });
$('settings').addEventListener('click', e => { if (e.target === $('settings')) $('settings').classList.add('hide'); });
document.addEventListener('pointerdown', () => snd.unlock(), { capture: true });

// ------------------------------------------------------------ petals + sparkles (2D overlay, gentle, no flashing)
const fx = $('fx'), fctx = fx.getContext('2d'); let parts = [];
function sizeFx() { const k = Math.min(2, devicePixelRatio || 1); fx.width = innerWidth * k; fx.height = innerHeight * k; }
const PET = ['#e8a3ae', '#f3c6cc', '#d98a96', '#fbf3e6', '#b8cba8', '#e9cf8a'];
function petals(n) {
  for (let i = 0; i < n; i++) parts.push({ k: 'p', x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - 0.5) * 40, vy: 50 + Math.random() * 60,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s: 6 + Math.random() * 7, sw: Math.random() * 6, c: PET[i % PET.length], life: 7 });
}
function sparkle(x, y, n) {
  if (RM) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70; parts.push({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, s: 2 + Math.random() * 3, life: 0.8 + Math.random() * 0.4, max: 1.2 }); }
}
function stepFx(dt) {
  if (!parts.length) return;
  const k = fx.width / innerWidth; fctx.setTransform(k, 0, 0, k, 0, 0); fctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.life -= dt;
    if (p.k === 'p') {
      p.sw += dt * 1.6; p.x += (p.vx + Math.sin(p.sw) * 30) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.sw)));
      fctx.globalAlpha = Math.min(1, p.life) * 0.95; fctx.fillStyle = p.c; fctx.beginPath(); fctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, Math.PI * 2); fctx.fill(); fctx.restore();
    } else {
      p.vy += 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      fctx.globalAlpha = Math.max(0, p.life / p.max); fctx.fillStyle = '#d9b765'; fctx.beginPath(); fctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); fctx.fill();
    }
  }
  fctx.globalAlpha = 1;
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 30);
  if (!parts.length) fctx.clearRect(0, 0, innerWidth, innerHeight);
}

// ------------------------------------------------------------ loop
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  stepFx(dt);
  if (state === 'play' && P && t - P.lastFind > 30000 && t - (frame.nudge || 0) > 4000 && hiddenCells().length) { frame.nudge = t; bump($('hintb'), 'bump'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------ bot (for check.cjs): traces real words at a human pace
let botQ = null, botN = 0, botNext = 0;
function bot() {
  if (state !== 'play' || !P) return;
  const now = performance.now(); if (now < botNext) return;
  if (!botQ) {
    const left = P.words.filter(w => !w.found); if (!left.length) return;
    let word = left.sort((a, b) => a.w.length - b.w.length)[0].w;
    const bon = [...P.bonus].filter(w => !P.bonusFound.has(w));
    if (bon.length && ++botN % 4 === 0) word = bon[0];
    const used = new Set(), idx = [];
    for (const ch of word.toUpperCase()) { const i = P.letters.findIndex((c, j) => c === ch && !used.has(j)); if (i < 0) return; used.add(i); idx.push(i); }
    botQ = { idx, k: 0 };
  }
  const r = wheelEl.getBoundingClientRect();
  if (botQ.k < botQ.idx.length) { const e = wl[botQ.idx[botQ.k]]; ptr = { x: r.left + e._x, y: r.top + e._y }; if (botQ.k === 0) beginSel(botQ.idx[botQ.k++]); else { addSel(botQ.idx[botQ.k++]); drawLine(); } botNext = now + 300; return; }
  botQ = null; endSel(); botNext = now + 1100;
}
window.__game = {
  get state() { return state; }, get level() { return S.level; }, get score() { return S.total; }, bot,
  autostart() { if (!ready) return false; if (state === 'ready') return play(); if (state === 'won') { next(); return true; } return true; },
  get info() { return P && { level: P.n, words: P.words.length, found: P.words.filter(w => w.found).length, coins: M.coins(), stars: S.total, placed: S.placed, stamps: S.stamps }; },
};
window.__dbg = { S, get P() { return P; }, layout, M, plant, drawGarden };

// ------------------------------------------------------------ boot
showCoins();
await setBg(GARDENS[gardenOf(S.level)].bg, true);
ready = true;
layout(); showTitle();
setTimeout(() => { $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 500); }, 120);

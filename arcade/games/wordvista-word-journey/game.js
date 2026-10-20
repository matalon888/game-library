// Wordvista: Word Journey. Swipe the letter wheel to spell words, fill the crossword, and travel across twelve
// AI-modelled 3D diorama islands that turn slowly behind the puzzle. Our own code, MIT.
import { createWorld } from './world.js';
import { LEVELS } from './levels.js';
import { makeLevel, schedule, wordsIn, isWord } from './gen.js';
import { snd } from './audio.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rng = seed => { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; };
const BASE = new URL('./', import.meta.url).href;

// ------------------------------------------------------------ islands (the journey)
const ISLANDS = [
  { id: 'd01', name: 'Beacon Bluff', sky: { top: '#6fc3f7', mid: '#bfe6ff', bot: '#ffe3c0' }, acc: '#ff6b6b', accd: '#c8414b', accl: '#ff9f94' },
  { id: 'd02', name: 'Blossom Shrine', sky: { top: '#f7a8cb', mid: '#ffd9e8', bot: '#fff1dc' }, acc: '#f2679a', accd: '#b8386b', accl: '#ff9cc0' },
  { id: 'd03', name: 'Rue des Fleurs', sky: { top: '#93a8f5', mid: '#d4dcff', bot: '#ffe2d4' }, acc: '#5e7cf0', accd: '#3a52c4', accl: '#93a8ff' },
  { id: 'd04', name: 'Azure Cliffs', sky: { top: '#4fb4f2', mid: '#b4e3ff', bot: '#effaff' }, acc: '#2f8fe0', accd: '#1d64a8', accl: '#6fb8f5' },
  { id: 'd05', name: 'Canal Lane', sky: { top: '#ffa77a', mid: '#ffd2b0', bot: '#fff0d6' }, acc: '#f0843c', accd: '#b85f1d', accl: '#ffaf73' },
  { id: 'd06', name: 'Pinecrest Lodge', sky: { top: '#8aa6f0', mid: '#cfdcff', bot: '#fdf1ff' }, acc: '#7a5cff', accd: '#5236c4', accl: '#a892ff' },
  { id: 'd07', name: 'Palm Cay', sky: { top: '#3ccbe0', mid: '#a8ecf2', bot: '#fff3cf' }, acc: '#14b8a6', accd: '#0b7f73', accl: '#5fd9c9' },
  { id: 'd08', name: 'Lantern Souk', sky: { top: '#ff9470', mid: '#ffc9a0', bot: '#ffe9c4' }, acc: '#e0663a', accd: '#a8401c', accl: '#ff9b70' },
  { id: 'd09', name: 'Rosewall Cottage', sky: { top: '#8fd6a6', mid: '#d2f1d8', bot: '#fff5dc' }, acc: '#e95b8b', accd: '#b03363', accl: '#ff93b5' },
  { id: 'd10', name: 'Oasis Dunes', sky: { top: '#ffbf5c', mid: '#ffe0a6', bot: '#fff4de' }, acc: '#e39a12', accd: '#a86d00', accl: '#ffc64f' },
  { id: 'd11', name: 'Toadstool Hollow', sky: { top: '#ff9a68', mid: '#ffcfa4', bot: '#ffeccd' }, acc: '#e2483d', accd: '#a8261f', accl: '#ff7f73' },
  { id: 'd12', name: 'Tulip Mill', sky: { top: '#7fcaf7', mid: '#cbeaff', bot: '#ffeaf3' }, acc: '#ff5d8f', accd: '#c8336a', accl: '#ff94b5' },
];
const PER = 24, JOURNEY = LEVELS.length;           // 12 islands × 24 levels, then the endless Grand Tour
const islandOf = n => Math.floor((n - 1) / PER) % ISLANDS.length;
const thumb = i => `${BASE}assets/thumbs/${ISLANDS[i].id}.webp`;

// ------------------------------------------------------------ save
const KEY = 'wordvista';
const sget = (k, d) => { try { const v = localStorage.getItem(KEY + '_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const sset = (k, v) => { try { localStorage.setItem(KEY + '_' + k, JSON.stringify(v)); } catch (e) {} };
const S = { level: sget('level', 1), coins: sget('coins', 80), stars: sget('stars', {}), total: sget('total', 0), jar: sget('jar', 0), cur: sget('cur', null), daily: sget('daily', {}), words: sget('words', 0) };
{ const q = new URLSearchParams(location.search); if (q.has('level') && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) { S.level = +q.get('level') || 1; S.cur = null; } }
const save = () => { for (const k of ['level', 'coins', 'stars', 'total', 'jar', 'cur', 'daily', 'words']) sset(k, S[k]); };

// ------------------------------------------------------------ kit layers
const toastEl = $('toast'); let toastT = 0;
function toast(t, ms = 1500) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), ms); }
const D = daily(KEY, { els: { start: $('title').querySelector('.logo'), win: $('wpanel') }, pop: toast }, { name: 'Wordvista' });
const F = flow(KEY);
const B = board({ game: 'wordvista', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 2 }, corner: 'tl' });
const today = (() => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();

// ------------------------------------------------------------ 3D world
const W3 = createWorld();
let ready = false, state = 'ready', P = null, islandIdx = -1;
const loadBar = $('load').querySelector('b');
loadBar.style.width = '30%';
function theme(i) {
  const t = ISLANDS[i], r = document.documentElement.style;
  r.setProperty('--acc', t.acc); r.setProperty('--accd', t.accd); r.setProperty('--accl', t.accl);
  document.querySelector('meta[name=theme-color]').content = t.sky.top;
  document.body.style.background = `linear-gradient(180deg,${t.sky.top},${t.sky.bot})`;
}
async function goIsland(i, instant = false) {
  if (i === islandIdx) return; islandIdx = i; theme(i);
  await W3.show(ISLANDS[i].id, ISLANDS[i], instant);
  W3.load(ISLANDS[(i + 1) % ISLANDS.length].id);   // prefetch the next stop
}

// ------------------------------------------------------------ levels
function parse(str) { const [l, rows, cols, ws] = str.split('|'); return { l, rows: +rows, cols: +cols, w: ws.split(' ').map(s => { const [w, r, c, a] = s.split(','); return [w, +r, +c, +a]; }) }; }
function levelData(n, isDaily) {
  if (isDaily) {
    const L = makeLevel(rng(D.seed || today), { letters: 6, min: 6, max: clamp(Math.round(8 * F.k()), 6, 10) });
    if (L) return L;
  }
  if (n <= JOURNEY) return parse(LEVELS[n - 1]);
  const sc = schedule(n), L = makeLevel(rng(n * 7919 + 13), { ...sc, max: clamp(Math.round(sc.max * F.k()), sc.min, 11) });
  return L || parse(LEVELS[(n - 1) % JOURNEY]);
}

// ------------------------------------------------------------ DOM refs
const gridEl = $('grid'), prevEl = $('preview'), wheelEl = $('wheel'), lineEl = $('line'), playEl = $('play'), titleEl = $('title'), winEl = $('win');
const coinEl = $('coinn'), jarEl = $('jar');
let L = {};                // current layout numbers

// ------------------------------------------------------------ build a puzzle
function startLevel(isDaily = false) {
  const n = S.level, data = levelData(n, isDaily);
  const isl = isDaily ? (today % ISLANDS.length) : islandOf(n);
  goIsland(isl);
  const key = isDaily ? 'd' + today : 'L' + n;
  const cells = new Map(), words = data.w.map(([w, r, c, a]) => {
    const ks = []; for (let i = 0; i < w.length; i++) { const rr = r + (a ? 0 : i), cc = c + (a ? i : 0), k = rr * 16 + cc; ks.push(k); if (!cells.has(k)) cells.set(k, { r: rr, c: cc, ch: w[i], on: false, shown: false, el: null }); }
    return { w, r, c, a, cells: ks, found: false };
  });
  const gridSet = new Set(words.map(x => x.w));
  const bonus = new Set(wordsIn(data.l).filter(w => !gridSet.has(w)));
  P = { n, key, isDaily, isl, letters: data.l.toUpperCase().split(''), rows: data.rows, cols: data.cols, words, cells, bonus, bonusFound: new Set(), hints: 0, t0: performance.now(), lastFind: performance.now() };
  // resume a level left half way
  if (S.cur && S.cur.key === key) {
    for (const w of S.cur.found || []) { const x = words.find(y => y.w === w); if (x) { x.found = true; for (const k of x.cells) cells.get(k).on = true; } }
    for (const k of S.cur.shown || []) if (cells.has(k)) cells.get(k).shown = true;
    for (const w of S.cur.bonus || []) P.bonusFound.add(w);
    P.hints = S.cur.hints || 0;
  } else { S.cur = { key, found: [], shown: [], bonus: [], hints: 0 }; save(); }
  buildGrid(); buildWheel();
  state = 'play'; botQ = null;
  titleEl.classList.add('hide'); winEl.classList.add('hide'); playEl.classList.remove('hide');
  $('lvlb').textContent = isDaily ? 'Daily Puzzle' : `Level ${n}`;
  $('lvls').textContent = isDaily ? ISLANDS[isl].name : n > JOURNEY ? `Grand Tour · ${ISLANDS[isl].name}` : `${(n - 1) % PER + 1}/${PER} · ${ISLANDS[isl].name}`;
  $('lvlico').style.backgroundImage = `url(${thumb(isl)})`;
  updateJar(); layout(true);
  B.start();
  snd.music(true);
  if (n <= 2 && !isDaily && !words.some(w => w.found)) setTimeout(tutorial, 700);
}
function saveCur() {
  if (!P) return;
  S.cur = { key: P.key, found: P.words.filter(w => w.found).map(w => w.w), shown: [...P.cells].filter(([, c]) => c.shown && !c.on).map(([k]) => k), bonus: [...P.bonusFound], hints: P.hints };
  save();
}
function buildGrid() {
  gridEl.innerHTML = '';
  for (const [, c] of P.cells) {
    const el = document.createElement('div'); el.className = 'tile' + (c.on ? ' on' : c.shown ? ' hint' : '');
    el.innerHTML = `<span>${c.ch.toUpperCase()}</span>`; c.el = el; gridEl.appendChild(el);
  }
}
let wl = [];               // wheel letter elements
function buildWheel() {
  wheelEl.querySelectorAll('.wl').forEach(e => e.remove());
  wl = P.letters.map((ch, i) => { const e = document.createElement('div'); e.className = 'wl'; e.innerHTML = `<span>${ch}</span>`; e.dataset.i = i; wheelEl.appendChild(e); return e; });
  wheelEl.classList.toggle('many', P.letters.length >= 6);
  order = P.letters.map((_, i) => i);
  placeWheel();
}
let order = [];            // wheel slot of each letter
function placeWheel() {
  const n = P.letters.length; if (order.length !== n) order = P.letters.map((_, i) => i);
  const R = L.D * (n >= 6 ? 0.355 : n === 3 ? 0.27 : 0.32), c = L.D / 2;
  wl.forEach((e, i) => { const a = -Math.PI / 2 + order[i] / n * Math.PI * 2; e.style.left = c + Math.cos(a) * R + 'px'; e.style.top = c + Math.sin(a) * R + 'px'; e._x = c + Math.cos(a) * R; e._y = c + Math.sin(a) * R; });
}

// ------------------------------------------------------------ layout (phone portrait, desktop landscape)
const sab = document.createElement('div'); sab.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)'; document.body.appendChild(sab);
const insetB = () => parseFloat(getComputedStyle(sab).paddingBottom) || 0;
function layout(instant = false) {
  const Wd = innerWidth, H = innerHeight, portrait = Wd / H < 1;
  const colW = portrait ? Wd : Math.min(460, Wd * 0.42), cx = portrait ? Wd / 2 : Wd * 0.71;
  const DD = portrait ? clamp(Math.min(Wd * 0.62, H * 0.29), 180, 262) : clamp(H * 0.31, 190, 262);
  const wcy = H - insetB() - (portrait ? 24 : 34) - DD / 2;
  L = { D: DD, cx, wcy, portrait, colW };
  document.documentElement.style.setProperty('--D', DD + 'px');
  Object.assign(wheelEl.style, { left: cx - DD / 2 + 'px', top: wcy - DD / 2 + 'px' });
  const sx = Math.min(DD / 2 + 44, colW / 2 - 36);
  const side = (id, dx, dy) => Object.assign($(id).style, { left: cx + dx - 27 + 'px', top: wcy + dy - 27 + 'px' });
  side('jar', -sx, -DD * 0.3); side('shuf', -sx, DD * 0.3); side('rocket', sx, -DD * 0.3); side('hint', sx, DD * 0.3);
  const pTop = wcy - DD / 2 - 58; prevEl.style.top = pTop + 'px'; prevEl.style.left = cx + 'px';
  if (P) {
    const top = portrait ? 62 : 84, bot = pTop - 12, aw = Math.min(colW - 24, 520), ah = bot - top;
    const t = Math.floor(Math.min(portrait ? 50 : 56, aw / (P.cols * 1.1 - 0.1), ah / (P.rows * 1.1 - 0.1)));
    const p = t * 1.1, gw = P.cols * p - t * 0.1, gh = P.rows * p - t * 0.1;
    const gTop = portrait ? bot - gh : top + Math.max(0, (ah - gh) * 0.6);
    document.documentElement.style.setProperty('--t', t + 'px');
    Object.assign(gridEl.style, { left: cx - gw / 2 + 'px', top: gTop + 'px', width: gw + 'px', height: gh + 'px' });
    for (const [, c] of P.cells) { c.el.style.left = c.c * p + 'px'; c.el.style.top = c.r * p + 'px'; }
    L.gTop = gTop; L.gh = gh;
    placeWheel();
  }
  const pb = $('panelbg');
  if (!portrait) Object.assign(pb.style, { left: cx - colW / 2 - 14 + 'px', width: colW + 28 + 'px', top: '64px', height: H - 76 + 'px' });
  frameIsland(instant);
}
function frameIsland(instant = false) {
  const Wd = innerWidth, H = innerHeight;
  if (!L.portrait) { W3.frame(Wd * 0.29, H * 0.53, Math.min(Wd * 0.42, H * 0.74), instant); return; }
  if (state === 'ready') {
    const lb = titleEl.querySelector('.logo').getBoundingClientRect().bottom, ct = $('tcard').getBoundingClientRect().top;
    const room = Math.max(160, ct - lb);
    W3.frame(Wd / 2, lb + room * 0.5, clamp(Math.min(Wd * 0.9, room * 0.95), 200, 400), instant); return;
  }
  const top = 56, botv = (L.gTop || H * 0.4) + (L.gh || 0) * 0.32;
  const room = Math.max(150, botv - top);
  W3.frame(Wd / 2, top + room * 0.5, clamp(Math.min(Wd * 0.95, room * 1.3), 210, 390), instant);
}
addEventListener('resize', () => layout(true));

// ------------------------------------------------------------ wheel input
let sel = [], dragging = false, ptr = null;
function letterAt(x, y) {
  const r = wheelEl.getBoundingClientRect(), lx = x - r.left, ly = y - r.top;
  let best = -1, bd = L.D * (P.letters.length >= 6 ? 0.135 : 0.15);
  wl.forEach((e, i) => { const d = Math.hypot(e._x - lx, e._y - ly); if (d < bd) { bd = d; best = i; } });
  return best;
}
function beginSel(i) { sel = []; dragging = true; addSel(i); hideTut(); }
function addSel(i) {
  if (i < 0) return;
  if (sel.length >= 2 && sel[sel.length - 2] === i) { const j = sel.pop(); wl[j].classList.remove('sel'); snd.letter(sel.length - 1); }
  else if (!sel.includes(i)) { sel.push(i); wl[i].classList.add('sel'); snd.letter(sel.length - 1); buzz(6); }
  drawPreview(); drawLine();
}
function drawPreview(cls = '') {
  const w = sel.map(i => P.letters[i]).join('');
  prevEl.innerHTML = [...w].map(c => `<span>${c}</span>`).join('');
  prevEl.className = w ? cls : 'empty';
}
function drawLine() {
  const pts = sel.map(i => `${wl[i]._x},${wl[i]._y}`);
  if (dragging && ptr && sel.length) { const r = wheelEl.getBoundingClientRect(); pts.push(`${ptr.x - r.left},${ptr.y - r.top}`); }
  lineEl.setAttribute('points', pts.join(' '));
}
function endSel() {
  dragging = false; ptr = null;
  const w = sel.map(i => P.letters[i]).join('').toLowerCase();
  const spans = [...prevEl.children].map(s => s.getBoundingClientRect());
  wl.forEach(e => e.classList.remove('sel')); lineEl.setAttribute('points', '');
  sel = [];
  if (w.length < 3) { drawPreview(); if (w.length) { prevEl.className = 'empty'; } return; }
  submit(w, spans);
}
wheelEl.addEventListener('pointerdown', e => {
  if (state !== 'play') return; e.preventDefault(); snd.unlock();
  ptr = { x: e.clientX, y: e.clientY }; const i = letterAt(e.clientX, e.clientY); if (i >= 0) beginSel(i);
});
addEventListener('pointermove', e => { if (!dragging) return; ptr = { x: e.clientX, y: e.clientY }; addSel(letterAt(e.clientX, e.clientY)); drawLine(); });
addEventListener('pointerup', () => { if (dragging) endSel(); });
addEventListener('pointercancel', () => { if (dragging) endSel(); });
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ------------------------------------------------------------ words
const PRAISE = { 3: '', 4: 'Nice!', 5: 'Great!', 6: 'Brilliant!', 7: 'Superb!' };
function submit(w, spans) {
  const gw = P.words.find(x => x.w === w);
  if (gw && !gw.found) {
    prevEl.className = 'good'; setTimeout(() => drawPreview(), 380);
    found(gw, spans); return;
  }
  if (gw) { prevEl.className = 'gold'; for (const k of gw.cells) shake(P.cells.get(k).el); snd.again(); toast('Already found'); setTimeout(() => drawPreview(), 400); return; }
  if (P.bonus.has(w) || isWord(w)) {
    if (P.bonusFound.has(w)) { toast('Already in your jar'); snd.again(); prevEl.className = 'gold'; setTimeout(() => drawPreview(), 400); return; }
    P.bonusFound.add(w); prevEl.className = 'gold'; setTimeout(() => drawPreview(), 450);
    bonusWord(w, spans); return;
  }
  prevEl.className = 'bad'; snd.wrong(); buzz([10, 40, 10]); setTimeout(() => drawPreview(), 380);
}
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function pop(el, cls = 'pop') { el.classList.remove('pop', 'glow'); void el.offsetWidth; el.classList.add(cls); }
function found(gw, spans) {
  gw.found = true; P.lastFind = performance.now(); S.words++;
  snd.word(gw.w.length); buzz(14);
  if (PRAISE[gw.w.length]) combo(PRAISE[gw.w.length]);
  W3.kick(0.04 + gw.w.length * 0.008); W3.burst(16 + gw.w.length * 6);
  gw.cells.forEach((k, i) => {
    const c = P.cells.get(k), tr = c.el.getBoundingClientRect(), from = spans[i] || prevEl.getBoundingClientRect();
    const fly = document.createElement('div'); fly.className = 'fly'; fly.textContent = c.ch.toUpperCase();
    Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', fontSize: from.height * 0.8 + 'px' });
    document.body.appendChild(fly);
    const dx = tr.left - from.left, dy = tr.top - from.top, s = tr.width / Math.max(1, from.width);
    const a = fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 30}px) scale(${(1 + s) / 2 * 1.15})`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0.6 }], { duration: 380 + i * 45, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
    a.onfinish = () => { fly.remove(); c.on = true; c.shown = false; c.el.className = 'tile on'; pop(c.el); snd.tile(i); };
  });
  setTimeout(afterReveal, 420 + gw.w.length * 45);
  saveCur();
}
function afterReveal() {
  if (!P || state !== 'play') return;
  for (const w of P.words) if (!w.found && w.cells.every(k => P.cells.get(k).on || P.cells.get(k).shown)) {
    w.found = true; w.cells.forEach((k, i) => { const c = P.cells.get(k); c.on = true; c.shown = false; setTimeout(() => { c.el.className = 'tile on'; pop(c.el, 'glow'); snd.tile(i); }, i * 50); });
  }
  saveCur();
  if (P.words.every(w => w.found)) win();
}
function bonusWord(w, spans) {
  snd.bonus(); S.coins += 1; S.jar++; buzz(8);
  const jr = jarEl.getBoundingClientRect(), from = prevEl.getBoundingClientRect();
  const fly = document.createElement('div'); fly.className = 'fly'; fly.textContent = w.toUpperCase();
  Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', height: from.height + 'px', padding: '0 12px', fontSize: '26px', background: '#ffb72b' });
  document.body.appendChild(fly);
  fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${jr.left + jr.width / 2 - from.left - from.width / 2}px,${jr.top - from.top}px) scale(.25)`, opacity: 0.3 }],
    { duration: 520, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => { fly.remove(); jarEl.classList.remove('bump'); void jarEl.offsetWidth; jarEl.classList.add('bump'); updateJar(); };
  toast(`Bonus word: ${w.toUpperCase()}  +1`);
  if (S.jar >= 8) setTimeout(() => { S.jar = 0; coinsFly(jarEl, 25); toast('Bonus jar full! +25 coins', 1800); snd.hint(); updateJar(); save(); }, 700);
  updateCoins(); saveCur();
}
function updateJar() { $('jarn').textContent = S.jar; $('jarfill').style.height = (S.jar / 8) * 30 + 'px'; }
function updateCoins(bump = true) { coinEl.textContent = S.coins; if (bump) { const c = $('coins'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
function coinsFly(fromEl, n) {
  const fr = fromEl.getBoundingClientRect(), to = $('coins').getBoundingClientRect(), k = Math.min(10, Math.ceil(n / 3));
  for (let i = 0; i < k; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'flycoin'); s.innerHTML = '<use href="#coin"/>';
    s.style.left = fr.left + fr.width / 2 + 'px'; s.style.top = fr.top + fr.height / 2 + 'px'; document.body.appendChild(s);
    const mx = (Math.random() - 0.5) * 120, my = -60 - Math.random() * 60;
    s.animate([{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${mx}px,${my}px) scale(1.1)`, offset: 0.35 }, { transform: `translate(${to.left + 20 - fr.left - fr.width / 2}px,${to.top + 20 - fr.top - fr.height / 2}px) scale(.8)` }],
      { duration: 700 + i * 60, easing: 'cubic-bezier(.4,0,.5,1)', fill: 'forwards' }).onfinish = () => { s.remove(); if (i === k - 1) { S.coins += n; updateCoins(); save(); } snd.coin(); };
  }
}
let comboT = 0;
function combo(t) {
  const c = $('combo'); c.textContent = t; c.style.top = (L.portrait ? (L.gTop || 300) - 6 : innerHeight * 0.18) + 'px';
  if (!L.portrait) c.style.left = L.cx + 'px'; else c.style.left = '50%';
  c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); clearTimeout(comboT); comboT = setTimeout(() => c.classList.remove('go'), 1000);
}

// ------------------------------------------------------------ boosters (bought with coins earned by play)
function hiddenCells() { const out = []; for (const w of P.words) if (!w.found) for (const k of w.cells) { const c = P.cells.get(k); if (!c.on && !c.shown && !out.includes(k)) out.push(k); } return out; }
function reveal(k, delay = 0) { const c = P.cells.get(k); c.shown = true; setTimeout(() => { c.el.className = 'tile hint'; pop(c.el); }, delay); }
$('hint').addEventListener('click', e => {
  e.stopPropagation(); if (state !== 'play') return; snd.unlock();
  if (S.coins < 25) { toast('Find bonus words to earn coins'); shake($('hint')); snd.wrong(); return; }
  // the first hidden letter of the shortest unsolved word
  const w = P.words.filter(x => !x.found).sort((a, b) => a.w.length - b.w.length)[0]; if (!w) return;
  const k = w.cells.find(k => { const c = P.cells.get(k); return !c.on && !c.shown; }); if (k == null) return;
  S.coins -= 25; P.hints++; updateCoins(); reveal(k); snd.hint(); W3.kick(0.03);
  setTimeout(afterReveal, 300);
});
$('rocket').addEventListener('click', e => {
  e.stopPropagation(); if (state !== 'play') return; snd.unlock();
  if (S.coins < 60) { toast('Find bonus words to earn coins'); shake($('rocket')); snd.wrong(); return; }
  const hid = hiddenCells(); if (!hid.length) return;
  S.coins -= 60; P.hints += 2; updateCoins(); snd.hint();
  for (let i = hid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [hid[i], hid[j]] = [hid[j], hid[i]]; }
  hid.slice(0, 5).forEach((k, i) => { reveal(k, 120 + i * 110); setTimeout(() => snd.tile(i), 120 + i * 110); });
  W3.burst(40);
  setTimeout(afterReveal, 800);
});
$('shuf').addEventListener('click', e => {
  e.stopPropagation(); if (state !== 'play') return; snd.unlock(); snd.shuffle();
  const n = order.length; let o; do { o = order.slice(); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } } while (n > 2 && o.every((v, i) => v === order[i]));
  order = o; placeWheel();
});
jarEl.addEventListener('click', e => { e.stopPropagation(); if (!P) return; const b = [...P.bonusFound]; toast(b.length ? 'Bonus: ' + b.map(w => w.toUpperCase()).join(' · ') : 'Extra words fill the jar: 8 = 25 coins', 2200); });

// ------------------------------------------------------------ tutorial finger (levels 1–2)
let tutEl = null;
function tutorial() {
  if (!P || state !== 'play' || P.words.some(w => w.found) || dragging) return;
  const w = P.words.slice().sort((a, b) => a.w.length - b.w.length)[0].w.toUpperCase(), used = new Set(), idx = [];
  for (const ch of w) { const i = P.letters.findIndex((c, j) => c === ch && !used.has(j)); used.add(i); idx.push(i); }
  tutEl = document.createElement('div');
  Object.assign(tutEl.style, { position: 'absolute', width: '44px', height: '44px', margin: '-22px 0 0 -22px', borderRadius: '50%', background: 'rgba(255,255,255,.55)', border: '3px solid #fff', boxShadow: '0 4px 14px rgba(75,53,96,.35)', pointerEvents: 'none', zIndex: 5 });
  wheelEl.appendChild(tutEl);
  const kf = idx.map((i, k) => ({ left: wl[i]._x + 'px', top: wl[i]._y + 'px', offset: 0.1 + k / (idx.length - 1) * 0.65 }));
  tutEl.animate([{ ...kf[0], offset: 0, opacity: 0 }, ...kf, { ...kf[kf.length - 1], offset: 1, opacity: 0 }], { duration: 2200, iterations: Infinity });
  toast('Swipe the letters to make words', 2600);
}
function hideTut() { if (tutEl) { tutEl.remove(); tutEl = null; } }

// ------------------------------------------------------------ win
let wonAt = 0;
function win() {
  if (state !== 'play') return;
  state = 'won'; hideTut();
  const stars = Math.max(1, 3 - Math.min(2, P.hints)), ms = performance.now() - P.t0;
  const key = P.isDaily ? 'd' + today : String(P.n), prev = (P.isDaily ? S.daily[today] : S.stars[key]) || 0;
  if (stars > prev) { S.total += stars - prev; if (P.isDaily) S.daily[today] = stars; else S.stars[key] = stars; }
  const islandDone = !P.isDaily && P.n % PER === 0;
  const reward = 10 + (islandDone ? 50 : 0) + (P.isDaily ? 20 : 0);
  F.level(true);
  B.submit(stars, { ms });
  D.won(S.total, 'collected');
  if (D.beaten(S.total) && !beatenShown) { beatenShown = true; toast('BEATEN!'); }
  S.cur = null; save();
  W3.celebrate(); snd.win(); confetti(140);
  setTimeout(() => {
    if (state !== 'won') return;
    $('wtitle').textContent = islandDone ? 'Island complete!' : P.isDaily ? 'Daily solved!' : ['Splendid!', 'Wonderful!', 'Lovely!', 'Brilliant!'][P.n % 4];
    $('wsub').textContent = P.isDaily ? 'Daily Puzzle' : P.n > JOURNEY ? `Grand Tour · Level ${P.n}` : `${ISLANDS[P.isl].name} · Level ${(P.n - 1) % PER + 1}`;
    $('wline').textContent = islandDone ? `Postcard collected! Next stop: ${ISLANDS[(P.isl + 1) % ISLANDS.length].name}` : `${P.words.length} words` + (P.bonusFound.size ? ` + ${P.bonusFound.size} bonus` : '') + (stars < 3 ? ' · fewer hints = more stars' : '');
    $('wbonus').textContent = P.bonusFound.size; $('wbonusw').style.display = P.bonusFound.size ? '' : 'none';
    $('wcoins').textContent = reward;
    const st = $('wstamp'); st.style.display = islandDone ? 'block' : 'none'; if (islandDone) { st.style.backgroundImage = `url(${thumb(P.isl)}),radial-gradient(circle at 50% 40%,#fff,#ffe9f1)`; snd.island(); }
    $('wstars').style.display = islandDone ? 'none' : 'flex';
    const sv = [...$('wstars').children]; sv.forEach(s => s.classList.remove('on'));
    if (!islandDone) sv.forEach((s, i) => { if (i < stars) setTimeout(() => { s.classList.add('on'); snd.star(i); }, 250 + i * 260); });
    winEl.classList.remove('hide'); wonAt = performance.now();
    setTimeout(() => coinsFly($('wcoins'), reward), 900);
  }, 900);
}
let beatenShown = false;
function next() {
  if (state !== 'won') return;
  if (P && P.isDaily) { /* back to the journey */ } else S.level++;
  save(); startLevel(false);
}
winEl.addEventListener('pointerdown', e => { e.stopPropagation(); if (performance.now() - wonAt < 500) return; snd.tap(); next(); });

// ------------------------------------------------------------ title / journey
const dailyDone = () => !!S.daily[today];
function showTitle() {
  state = 'ready'; dragging = false; hideTut();
  if (P && P.words.some(w => w.found)) saveCur();
  playEl.classList.add('hide'); winEl.classList.add('hide'); titleEl.classList.remove('hide');
  const n = S.level, isl = islandOf(n), inIsl = n > JOURNEY ? 0 : (n - 1) % PER;
  goIsland(isl);
  $('tisl').textContent = n > JOURNEY ? 'Grand Tour' : `Island ${isl + 1} of ${ISLANDS.length}`;
  $('tname').textContent = ISLANDS[isl].name;
  $('tbar').style.width = (n > JOURNEY ? 100 : inIsl / PER * 100) + '%';
  $('tlv').textContent = n > JOURNEY ? `Level ${n}` : `Level ${inIsl + 1} / ${PER}`;
  $('tstars').textContent = `★ ${S.total}`;
  $('lvlb').textContent = `Level ${n}`; $('lvls').textContent = ISLANDS[isl].name; $('lvlico').style.backgroundImage = `url(${thumb(isl)})`;
  const dfirst = D.isDaily && !dailyDone();
  $('goplay').innerHTML = dfirst ? 'Play<small>Today\'s daily puzzle</small>' : `Play<small>Level ${n}</small>`;
  $('goday').textContent = dailyDone() ? '☀ Daily solved · come back tomorrow' : '☀ Daily Puzzle';
  $('goday').classList.toggle('done', dailyDone());
  const j = $('journey'); j.innerHTML = '';
  const reached = Math.min(ISLANDS.length - 1, Math.floor((Math.min(n, JOURNEY) - 1) / PER));
  ISLANDS.forEach((I, i) => {
    const b = document.createElement('button'); const done = n > (i + 1) * PER, lock = i > reached && n <= JOURNEY;
    b.className = 'stamp' + (i === isl ? ' cur' : '') + (lock ? ' lock' : done ? ' done' : '');
    b.innerHTML = `<i style="background-image:url(${thumb(i)}),radial-gradient(circle at 50% 40%,#fff,#f1e6f3)"></i><span>${lock ? '???' : I.name}</span>`;
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); snd.unlock(); snd.tap(); if (lock) { toast(`Finish ${ISLANDS[i - 1].name} to sail here`); return; } goIsland(i); $('tname').textContent = I.name; $('tisl').textContent = i === isl ? `Island ${i + 1} of ${ISLANDS.length}` : 'Visiting'; });
    j.appendChild(b);
  });
  requestAnimationFrame(() => { const c = j.children[isl]; if (c) j.scrollLeft = c.getBoundingClientRect().left - j.getBoundingClientRect().left + j.scrollLeft - j.clientWidth / 2 + 31; layout(); });
  snd.music(false);
}
function play() { if (!ready) return false; snd.unlock(); startLevel(D.isDaily && !dailyDone()); return true; }
$('goplay').addEventListener('click', e => { e.stopPropagation(); play(); });
$('goday').addEventListener('click', e => { e.stopPropagation(); if (dailyDone()) { toast('Come back tomorrow for a new puzzle'); return; } snd.unlock(); startLevel(true); });
$('goplay').addEventListener('pointerdown', e => e.stopPropagation()); $('goday').addEventListener('pointerdown', e => e.stopPropagation());
// tap anywhere else on the title starts; a horizontal drag spins the island
{ let st = null;
  titleEl.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: 0 }; });
  addEventListener('pointermove', e => { if (!st || state !== 'ready') return; const dx = e.clientX - st.lx; st.lx = e.clientX; st.moved += Math.abs(dx); W3.drag(dx * 0.05); });
  addEventListener('pointerup', e => { if (!st) return; const s = st; st = null; if (state === 'ready' && s.moved < 12 && !(e.target.closest && e.target.closest('button,#journey'))) play(); });
}
$('home').addEventListener('click', e => { e.stopPropagation(); snd.tap(); if (state === 'play') showTitle(); });
$('mute').addEventListener('click', e => { e.stopPropagation(); const m = snd.toggle(); $('mute').innerHTML = `<svg viewBox="0 0 24 24"><use href="#${m ? 'snd-off' : 'snd-on'}"/></svg>`; });
for (const id of ['hud', 'mute', 'home', 'coins', 'lvl']) $(id).addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); });
if (snd.muted) $('mute').innerHTML = '<svg viewBox="0 0 24 24"><use href="#snd-off"/></svg>';
document.addEventListener('pointerdown', () => snd.unlock(), { capture: true });

// ------------------------------------------------------------ confetti (2D overlay)
const fx = $('fx'), fctx = fx.getContext('2d'); let conf = [];
function sizeFx() { fx.width = innerWidth * Math.min(2, devicePixelRatio); fx.height = innerHeight * Math.min(2, devicePixelRatio); }
sizeFx(); addEventListener('resize', sizeFx);
function confetti(n) {
  const cols = ['#ff6b6b', '#ffd23f', '#3ab795', '#5e7cf0', '#ff8fd0', '#ffffff', ISLANDS[islandIdx]?.acc || '#ff5d8f'];
  for (let i = 0; i < n; i++) conf.push({ x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 900, vy: -500 - Math.random() * 700, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 6 + Math.random() * 7, h: 9 + Math.random() * 8, c: cols[i % cols.length], life: 2.6 + Math.random() });
}
function stepFx(dt) {
  if (!conf.length) return;
  const k = fx.width / innerWidth; fctx.setTransform(k, 0, 0, k, 0, 0); fctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of conf) {
    p.vy += 900 * dt; p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 0.6; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life -= dt;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.scale(1, Math.cos(p.r * 1.7)); fctx.globalAlpha = Math.min(1, p.life); fctx.fillStyle = p.c; fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fctx.restore();
  }
  conf = conf.filter(p => p.life > 0 && p.y < innerHeight + 40);
  if (!conf.length) fctx.clearRect(0, 0, innerWidth, innerHeight);
}

// ------------------------------------------------------------ idle nudge: the hint button breathes after 25 s without a word
let nudgeT = 0;
function idle(t) {
  if (state !== 'play' || !P) return;
  if (t - P.lastFind > 25000 && t - nudgeT > 2500 && S.coins >= 25) { nudgeT = t; const h = $('hint'); h.classList.remove('bump'); void h.offsetWidth; h.style.animation = 'bump .5s'; setTimeout(() => h.style.animation = '', 520); }
}

// ------------------------------------------------------------ loop
const PERF = { calls: 0, tris: 0 };
W3.renderer.info.autoReset = false;
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  W3.update(dt); W3.renderer.info.reset(); W3.render(dt); PERF.calls = W3.renderer.info.render.calls; PERF.tris = W3.renderer.info.render.triangles;
  stepFx(dt); idle(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------ bot (for check.cjs): traces real words on the wheel, one letter per call
let botQ = null, botN = 0;
function bot() {
  if (state !== 'play' || !P) return;
  if (!botQ) {
    const left = P.words.filter(w => !w.found);
    if (!left.length) return;
    let word = left.sort((a, b) => a.w.length - b.w.length)[0].w;
    const bon = [...P.bonus].filter(w => !P.bonusFound.has(w));
    if (bon.length && ++botN % 3 === 0) word = bon[0];
    const used = new Set(), idx = [];
    for (const ch of word.toUpperCase()) { const i = P.letters.findIndex((c, j) => c === ch && !used.has(j)); if (i < 0) return; used.add(i); idx.push(i); }
    botQ = { idx, k: 0 };
  }
  if (botQ.k === 0) { const e = wl[botQ.idx[0]], r = wheelEl.getBoundingClientRect(); ptr = { x: r.left + e._x, y: r.top + e._y }; beginSel(botQ.idx[botQ.k++]); return; }
  if (botQ.k < botQ.idx.length) { const e = wl[botQ.idx[botQ.k]], r = wheelEl.getBoundingClientRect(); ptr = { x: r.left + e._x, y: r.top + e._y }; addSel(botQ.idx[botQ.k++]); drawLine(); return; }
  botQ = null; endSel();
}
window.__dbg = { PERF, W3, get P() { return P; }, S, layout };
window.__game = {
  get state() { return state; }, get level() { return S.level; }, get score() { return S.total; }, bot,
  autostart() { if (!ready) return false; if (state === 'ready') return play(); if (state === 'won') { next(); return true; } return true; },
  get info() { return P && { level: P.n, words: P.words.length, found: P.words.filter(w => w.found).length, coins: S.coins, calls: PERF.calls, tris: PERF.tris }; },
};

// ------------------------------------------------------------ boot
updateCoins(false);
await goIsland(islandOf(S.level), true);
loadBar.style.width = '100%';
ready = true;
layout(true);
showTitle();
layout(true);
setTimeout(() => { $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 500); }, 150);

// Garden Gather: Match 3 Garden. A calm storybook match-3 (swap, specials, blockers, move-limited goals, a level path)
// with a garden-restore meta: stars bring a painted English garden back to colour. Style C · Storybook Garden.
import { createBoard, GEMS } from './m3.js';
import { makeLevel, dailyLevel, isHard } from './levels.js';
import { CHAPTERS, scenePieces } from './garden.js';
import { snd, music, setSfx, pauseAll } from './audio.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';

const SLUG = 'garden-gather', A = 'assets/';
const $ = (s, r = document) => r.querySelector(s);
const h = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const Q = new URLSearchParams(location.search);
const BOT = navigator.webdriver || Q.has('demo');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- saved state
const KEY = 'gg_state';
const fresh = () => ({ level: 1, best: {}, stars: 0, earned: 0, chapter: 0, done: {}, album: [], claimed: [], boost: { trowel: 2, can: 1, shuffle: 1 },
  dly: { last: 0, n: 0, freeWeek: -1, extra: 0, days: {}, frozen: [] }, set: { big: false, sfx: true, music: true }, tips: {}, wins: 0, seenIntro: false });
let st; try { st = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { st = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
document.documentElement.classList.toggle('big', !!st.set.big);
setSfx(st.set.sfx); music.set(st.set.music);

// days (local calendar) for the daily streak
const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const TODAY = dayNum(), week = d => Math.floor((d + 3) / 7);
const dateInt = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

// ---------------------------------------------------------------- kit layers
const M = money({ game: SLUG, style: 'C' });
const F = flow(SLUG);
const D = daily(SLUG, null, { name: 'Garden Gather' });
const B = board({ game: 'garden-gather', label: 'Stars', mode: 'sum', limits: { maxRun: 6, maxPerSec: 1 }, corner: 'tr', accent: '#d9b45a' });
addEventListener('ap:ad', e => pauseAll(e.detail.phase === 'start'));

// ---------------------------------------------------------------- art
const IMG = {};
const M3 = ['rose', 'leaf', 'cornflower', 'buttercup', 'lavender', 'daisy', 'special-bee', 'special-butterfly', 'special-ladybird', 'special-posy-h', 'special-posy-v', 'special-wreath',
  'crate', 'crate-cracked', 'bramble-thick', 'bramble-thin', 'cloche', 'cloche-cracked', 'stone', 'stone-cracked', 'mud', 'pot', 'snail', 'hose'];
function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
const GOAL_IMG = g => A + 'm3/' + (g.k === 'color' ? GEMS[g.c] : g.k === 'bramble' ? 'bramble-thick' : g.k) + '.webp';
const GOAL_NAME = (g, n) => g.k === 'color' ? ['roses', 'leaves', 'cornflowers', 'buttercups', 'lavender sprigs', 'daisies'][g.c] : { crate: 'crates', bramble: 'brambles', cloche: 'cloches', mud: 'muddy squares', pot: 'pots' }[g.k];
const STAMPS = ['robin', 'rose', 'teapot', 'cottage', 'bluebells', 'butterfly', 'peony', 'hedgehog', 'lighthouse', 'cat', 'sunflower', 'bluetit',
  'hydrangea', 'swan', 'beehive', 'teacup', 'fox', 'lavender', 'owl', 'strawberry', 'sailboat', 'squirrel', 'tulip', 'kingfisher'];
const BOOST = { trowel: { name: 'Trowel', img: A + 'items/trowel.webp', price: 150, what: 'Dig up any one square, even a crate or a bramble.', tip: 'Tap any square to dig it up' },
  can: { name: 'Watering can', img: A + 'decor/watering-can.webp', price: 200, what: 'Water a whole row: every square in it is cleared.', tip: 'Tap a row to water it' },
  shuffle: { name: 'Shuffle', img: A + 'icons/shuffle.webp', price: 100, what: 'Re-plant the flowers in a new order. Free of moves.', tip: '' } };

// ---------------------------------------------------------------- DOM
const bgEl = $('#bg'), canvas = $('#board');
let screen = 'home', state = 'ready', cur = null;           // cur: the running level
const topbar = h(`<div class="topbar">
  <button class="icon-btn" data-set aria-label="Settings"><img src="${A}icons/settings.webp" alt=""></button>
  <button class="pill" data-lives aria-label="Lives"><img src="${A}ui/heart.webp" alt=""><span data-n>5</span><small data-t></small></button>
  <button class="pill" data-coins aria-label="Coins and shop"><img src="${A}ui/coin.webp" alt=""><span data-n>0</span><img class="plus" src="${A}icons/plus.webp" alt=""></button>
  <span class="grow"></span></div>`);
const home = h(`<div id="home"><div id="deskframe"></div><div id="scene"><img class="paint" alt=""></div></div>`);
const chap = h(`<div class="chap"><div class="rib"><b></b></div><div class="prog"><i></i></div><div class="sub"></div></div>`);
const homebar = h(`<div class="homebar">
  <div class="playrow">
    <div class="side-btn"><button class="icon-btn" data-daily aria-label="Daily puzzle"><img src="${A}icons/calendar.webp" alt=""></button><span class="lbl" data-dl>Daily</span></div>
    <button class="btn sage" data-play><span data-pl>Level 1</span><small data-ps>Tap to play</small></button>
    <div class="task-btn"><button class="icon-btn" data-tasks aria-label="Garden tasks"><img src="${A}icons/star.webp" alt=""></button><span class="lbl" data-sl>0 ★</span></div>
  </div>
  <nav class="nav">
    <button data-nav="home" class="on"><img src="${A}icons/home.webp" alt="">Garden</button>
    <button data-nav="map"><img src="${A}icons/play.webp" alt="">Levels</button>
    <button data-nav="album"><img src="${A}icons/album.webp" alt="">Album<span class="badge hide" data-ab>!</span></button>
    <button data-nav="shop"><img src="${A}icons/shop.webp" alt="">Shop</button>
  </nav></div>`);
const mapEl = h(`<div id="map" class="hide"><div class="track"></div></div>`);
const hud = h(`<div id="hud" class="hide">
  <div class="hudtop">
    <div class="hudpanel moves"><small>MOVES</small><b data-m>20</b></div>
    <div class="hudpanel goals"><small>GOALS</small><div class="row" data-g></div></div>
    <button class="icon-btn" data-pause aria-label="Pause"><img src="${A}icons/menu.webp" alt=""></button>
  </div>
  <div class="lvltag" data-lt>Level 1</div>
  <div class="boosters">
    <button class="boost" data-b="trowel"><img src="${BOOST.trowel.img}" alt="">Trowel<span class="badge navy" data-c></span></button>
    <button class="boost" data-b="can"><img src="${BOOST.can.img}" alt="">Water<span class="badge navy" data-c></span></button>
    <button class="boost" data-b="shuffle"><img src="${BOOST.shuffle.img}" alt="" style="width:44px;height:44px">Shuffle<span class="badge navy" data-c></span></button>
  </div>
  <div class="banner hide" data-bn></div>
</div>`);
document.body.append(home, mapEl, chap, topbar, homebar, hud);

function toast(t, ms = 2600) { document.querySelectorAll('.toast').forEach(e => e.remove()); const e = h(`<div class="toast"></div>`); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), ms); }
let robinT = 0;
function robin(text, ms = 5200) {
  document.querySelectorAll('.robin').forEach(e => e.remove()); clearTimeout(robinT);
  if (screen !== 'home') return;
  const e = h(`<div class="robin"><img src="${A}ui/robin.webp" alt=""><div class="say"></div></div>`); e.querySelector('.say').textContent = text; document.body.appendChild(e);
  robinT = setTimeout(() => e.remove(), ms);
}

// ---------------------------------------------------------------- cards (one at a time)
let openCard = null;
function card({ rib = 'navy', title = '', html = '', x = true, tall = false, onClose = null }) {
  closeCard();
  const ov = h(`<div class="ov"><div class="card ${tall ? 'tall' : ''}"><img class="corner tl" src="${A}ui/corner-roses.webp" alt=""><img class="corner br" src="${A}ui/corner-roses.webp" alt="">
    ${title ? `<div class="rib" style="background-image:url(${A}ui/ribbon-${rib}.webp)"><b></b></div>` : ''}
    ${x ? `<button class="x" aria-label="Close"><img src="${A}icons/close.webp" alt=""></button>` : ''}${html}</div></div>`);
  if (title) ov.querySelector('.rib b').textContent = title;
  ov.addEventListener('pointerdown', e => e.stopPropagation());
  const close = () => { if (openCard === ov) { closeCard(); onClose && onClose(); } };
  if (x) ov.querySelector('.x').onclick = () => { snd.tap(); close(); };
  ov.addEventListener('pointerdown', e => { if (e.target === ov && x) close(); });
  document.body.appendChild(ov); openCard = ov; ov.close = close;
  return ov;
}
function closeCard() { if (openCard) { openCard.remove(); openCard = null; } }

// ---------------------------------------------------------------- top bar: lives + coins
function paintMoney() {
  topbar.querySelector('[data-coins] [data-n]').textContent = M.coins().toLocaleString('en-GB');
  const L = M.lives(); topbar.querySelector('[data-lives] [data-n]').textContent = L.unlimited ? '∞' : L.n;
  topbar.querySelector('[data-lives] [data-t]').textContent = L.unlimited || L.n >= L.max ? '' : mmss(L.nextAt - Date.now());
}
const mmss = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
M.onChange(paintMoney); setInterval(paintMoney, 1000);
topbar.querySelector('[data-coins]').onclick = () => { snd.tap(); M.shop(); };
topbar.querySelector('[data-lives]').onclick = () => { snd.tap(); livesCard(); };
topbar.querySelector('[data-set]').onclick = () => { snd.tap(); settingsCard(); };

// ---------------------------------------------------------------- garden (home)
const chapter = () => CHAPTERS[Math.min(st.chapter, CHAPTERS.length - 1)];
const doneSet = ch => new Set(st.done[ch.id] || []);
const allDone = () => st.chapter >= CHAPTERS.length;
function nextTasks() { if (allDone()) return []; const ch = chapter(), d = doneSet(ch); return ch.tasks.filter(t => !d.has(t.id)).slice(0, 3); }
function canRestore() { const t = nextTasks(); return t.length && st.stars >= Math.min(...t.map(x => x.cost)); }
let sceneSize = { w: 0, h: 0 };
function layoutScene() {
  const sc = $('#scene'), vw = innerWidth, vh = innerHeight; let w, hh;
  if (vw / vh < 1) { w = Math.max(vw, vh * 2 / 3); hh = w * 1.5; } else { hh = vh - 24; w = hh * 2 / 3; }
  sc.style.width = w + 'px'; sc.style.height = hh + 'px'; sceneSize = { w, h: hh };
}
function renderScene(fresh = null) {
  const ch = chapter(), d = doneSet(ch), sc = $('#scene');
  const paint = sc.querySelector('.paint'), src = A + 'bg/' + ch.scene + '.webp';
  if (!paint.src.endsWith(src)) paint.src = src;
  $('#deskframe').style.backgroundImage = `url(${A}bg/${ch.scene === 'meta-garden' ? 'meta-garden-wide' : 'rosewick'}.webp)`;
  sc.querySelectorAll('.pc').forEach(e => { if (!e.classList.contains('gone')) e.remove(); });
  for (const p of scenePieces(ch, d)) {
    const e = h(`<img class="pc ${p.flat ? 'flat' : ''}" alt="">`); e.src = A + p.src + '.webp';
    e.style.left = p.x / 10.24 + '%'; e.style.top = p.y / 15.36 + '%'; e.style.width = p.w / 10.24 + '%';
    if (fresh && p.task === fresh) e.classList.add('new');
    sc.appendChild(e);
  }
  const k = allDone() ? 1 : d.size / ch.tasks.length;
  sc.style.filter = `saturate(${0.32 + 0.68 * k}) sepia(${0.22 * (1 - k)}) brightness(${1.04 - 0.04 * k})`;
  chap.querySelector('b').textContent = allDone() ? 'Every garden restored' : ch.name;
  chap.querySelector('i').style.width = (k * 100) + '%';
  chap.querySelector('.sub').textContent = allDone() ? 'More gardens are being painted' : `${d.size} of ${ch.tasks.length} restored`;
}
function sparkles(xPct, yPct, n = 18) {
  const sc = $('#scene');
  for (let i = 0; i < (reduce ? 4 : n); i++) {
    const s = h(`<i class="sparkle"></i>`), a = Math.random() * 6.28, r = 40 + Math.random() * 90;
    s.style.left = xPct + '%'; s.style.top = yPct + '%'; s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r - 30 + 'px');
    s.style.animationDelay = Math.random() * 0.4 + 's'; sc.appendChild(s); setTimeout(() => s.remove(), 2000);
  }
}
function paintHome() {
  const n = st.level, hard = isHard(n);
  homebar.querySelector('[data-pl]').textContent = 'Level ' + n;
  homebar.querySelector('[data-ps]').textContent = hard ? 'Hard level' : 'Tap to play';
  homebar.querySelector('[data-play]').classList.toggle('hard', hard);
  homebar.querySelector('[data-sl]').textContent = st.stars + ' ★';
  homebar.querySelector('.task-btn').classList.toggle('ready', !!canRestore());
  const sn = streakNow(); homebar.querySelector('[data-dl]').textContent = st.dly.days[TODAY] ? 'Done ✓' : sn.n ? sn.n + '-day' : 'Daily';
  homebar.querySelector('[data-ab]').classList.toggle('hide', !albumClaimable());
  paintMoney();
}
homebar.querySelector('[data-play]').onclick = () => { snd.tap(); preview(st.level); };
homebar.querySelector('[data-tasks]').onclick = () => { snd.tap(); tasksCard(); };
homebar.querySelector('[data-daily]').onclick = () => { snd.tap(); dailyCard(); };
homebar.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
  snd.tap(); const k = b.dataset.nav;
  if (k === 'home') show('home'); else if (k === 'map') show('map'); else if (k === 'album') albumCard(); else if (k === 'shop') M.shop();
});

function tasksCard() {
  if (allDone()) return card({ rib: 'sage', title: 'All restored', html: `<p>Every garden is back in bloom. New gardens are being painted. Your stars will wait for them.</p><div class="rewards"><span class="reward"><img src="${A}ui/star-full.webp" alt="">${st.stars}</span></div>` });
  const ch = chapter(), list = nextTasks();
  const ov = card({ rib: 'sage', title: ch.name, html: `<p>You have <b>${st.stars} ★</b> to spend. Win levels to earn more.</p><div class="tasks">${list.map(t => {
    const th = t.clear ? 'm3/bramble-thick' : t.swap ? t.swap[0][1] : t.put[0][0];
    return `<div class="task"><div class="th"><img src="${A}${th}.webp" alt=""></div><div class="nm">${t.name}</div><button class="btn ${st.stars >= t.cost ? 'sage' : 'ivory'}" data-t="${t.id}" ${st.stars >= t.cost ? '' : 'disabled'}>${t.cost} <img src="${A}ui/star-full.webp" alt=""></button></div>`;
  }).join('')}</div>${list.length && st.stars < Math.min(...list.map(t => t.cost)) ? `<div class="btns"><button class="btn sage" data-go>Play Level ${st.level}</button></div>` : ''}` });
  ov.querySelectorAll('[data-t]').forEach(b => b.onclick = () => restore(list.find(t => t.id === b.dataset.t)));
  const go = ov.querySelector('[data-go]'); if (go) go.onclick = () => { closeCard(); preview(st.level); };
}
function restore(t, quiet = false) {
  if (!t || st.stars < t.cost) return;
  const ch = chapter();
  st.stars -= t.cost; (st.done[ch.id] = st.done[ch.id] || []).push(t.id); save(); closeCard();
  if (t.clear) { $('#scene').querySelectorAll('.pc.flat').forEach(e => e.classList.add('gone')); setTimeout(() => $('#scene').querySelectorAll('.gone').forEach(e => e.remove()), 900); }
  renderScene(t.id); paintHome();
  if (!quiet) {
    snd.restore();
    const spots = t.put || (t.swap ? [] : ch.weeds); for (const [, x, y] of spots.slice(0, 4)) sparkles(x / 10.24, y / 15.36 - 4, 10);
    if (t.swap) for (const e of $('#scene').querySelectorAll('.pc')) if (e.classList.contains('new')) sparkles(parseFloat(e.style.left), parseFloat(e.style.top) - 4, 8);
    robin(t.say);
  }
  if (doneSet(ch).size === ch.tasks.length) setTimeout(() => chapterDone(ch, quiet), quiet ? 0 : 1800);
}
function chapterDone(ch, quiet) {
  st.chapter++; M.add(500, 'chapter'); st.boost.trowel += 2; st.boost.can += 1; const s = giveStamp(); save();
  if (quiet) { renderScene(); paintHome(); return; }
  snd.win();
  card({ rib: 'rose', title: 'Restored!', x: false, html: `<h3>${ch.name}</h3><p>It looks just as it did in Granny's day.</p>
    <div class="rewards"><span class="reward"><img src="${A}ui/coin.webp" alt="">+500</span><span class="reward"><img src="${BOOST.trowel.img}" alt="">+2</span><span class="reward"><img src="${BOOST.can.img}" alt="">+1</span></div>
    ${s ? `<div class="stamps" style="grid-template-columns:1fr;width:120px;margin:8px auto"><div class="new"><img src="${A}stamps/stamp-${s}.webp" alt=""></div></div><p>A new stamp for your album.</p>` : ''}
    <div class="btns"><button class="btn sage" data-ok>${st.chapter < CHAPTERS.length ? 'On to ' + CHAPTERS[st.chapter].name : 'Lovely'}</button></div>` })
    .querySelector('[data-ok]').onclick = () => { closeCard(); renderScene(); paintHome(); if (st.chapter < CHAPTERS.length) robin('A new garden! It needs a lot of love, so let us begin.'); };
}

// ---------------------------------------------------------------- level path
function renderMap() {
  const tr = mapEl.querySelector('.track'), top = st.level + 14, lo = Math.max(1, st.level - 14), N = top - lo + 1, gap = 128;
  const W = Math.min(420, innerWidth), H = N * gap + 360;
  tr.style.height = H + 'px';
  const pos = n => { const i = n - lo; return [W / 2 + Math.sin(n * 0.85) * W * 0.27, H - 230 - i * gap]; };
  let d = '', nodes = '';
  for (let n = lo; n <= top; n++) { const [x, y] = pos(n); d += (n === lo ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; }
  for (let n = lo; n <= top; n++) {
    const [x, y] = pos(n), s = st.best[n] || 0, cls = n < st.level ? 'done' : n === st.level ? 'cur' : 'lock';
    nodes += `<button class="node ${cls} ${isHard(n) ? 'hardn' : ''}" data-n="${n}" style="left:${x}px;top:${y}px">${n}
      ${isHard(n) && n >= st.level ? '<span class="tag">Hard</span>' : ''}
      ${n < st.level ? `<span class="st">${[0, 1, 2].map(i => `<img src="${A}ui/${i < s ? 'star-full' : 'star-empty'}.webp" alt="">`).join('')}</span>` : ''}
      ${n % 3 === 0 && n >= st.level ? `<img class="stamp" src="${A}stamps/stamp-${STAMPS[(n / 3 - 1) % STAMPS.length]}.webp" alt="">` : ''}</button>`;
  }
  tr.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#fbf6ea" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><path d="${d}" fill="none" stroke="#b08834" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round"/></svg>${nodes}`;
  tr.querySelectorAll('.node').forEach(b => b.onclick = () => { const n = +b.dataset.n; if (n > st.level) { toast('Finish level ' + st.level + ' first'); return; } snd.tap(); preview(n); });
  const [, cy] = pos(st.level); mapEl.scrollTop = cy - innerHeight * 0.55;
}

// ---------------------------------------------------------------- screens
function show(s) {
  screen = s; closeCard();
  document.querySelectorAll('.robin').forEach(e => e.remove());
  home.classList.toggle('hide', s !== 'home'); chap.classList.toggle('hide', s !== 'home');
  mapEl.classList.toggle('hide', s !== 'map');
  topbar.classList.toggle('hide', s === 'play'); homebar.classList.toggle('hide', s === 'play'); hud.classList.toggle('hide', s !== 'play');
  canvas.classList.toggle('hide', s !== 'play');
  const tro = $('.bd-trophy'); if (tro) tro.classList.toggle('hide', s === 'play');
  homebar.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === s));
  homebar.querySelector('.playrow').classList.toggle('hide', s !== 'home');
  setBg(s === 'home' ? null : 'garden-gather');
  if (s === 'home') { layoutScene(); renderScene(); paintHome(); }
  if (s === 'map') { renderMap(); paintHome(); }
  if (s !== 'play') state = 'ready';
}
function setBg(name) {
  if (!name) { bgEl.style.backgroundImage = 'none'; return; }
  const wide = innerWidth / innerHeight >= 1;
  bgEl.style.backgroundImage = `url(${A}bg/${name}${wide ? '-wide' : ''}.webp)`;
}

// ---------------------------------------------------------------- level preview
const INTRO = { crate: 'Crates break when you make a match right next to them.', mud: 'Make matches on the muddy squares to clean them.',
  cloche: 'Match the flower under a glass cloche to lift the glass.', pot: 'Bring the pots down to the bottom row. You can always slide a pot down one square.',
  bramble: 'Brambles need two matches next to them.' };
function preview(n, { dailyL = null } = {}) {
  const L = dailyL || makeLevel(n, n > 5 ? F.k() : 1);
  const kinds = L.goals.map(g => g.k).filter(k => k !== 'color'), news = kinds.find(k => !st.tips['i_' + k]);
  const ov = card({ rib: dailyL ? 'rose' : L.hard ? 'rose' : 'navy', title: dailyL ? "Today's Puzzle" : 'Level ' + n, tall: false, html: `
    ${L.hard ? '<p><b style="color:var(--rose)">Hard level.</b> Short and tricky. Double coins.</p>' : dailyL ? '<p>The same garden puzzle for everyone today.</p>' : '<p>Collect these to finish:</p>'}
    <div class="goalrow">${L.goals.map(g => `<div class="goal"><img src="${GOAL_IMG(g)}" alt=""><b>${g.n}</b></div>`).join('')}</div>
    <p>in <b>${L.moves} moves</b>, no timer.</p>
    ${news ? `<p style="font-size:calc(18px * var(--fs))">${INTRO[news]}</p>` : ''}
    <div class="btns"><button class="btn sage" data-go>Play</button></div>` });
  ov.querySelector('[data-go]').onclick = () => { snd.tap(); begin(n, L); };
}

// ---------------------------------------------------------------- play
const ctxImgs = IMG;
let E = null, t0 = 0, recorded = false, continued = false, lastBot = 0, layoutBox = null;
function engine() {
  if (E) return E;
  E = createBoard({ canvas, img: ctxImgs, hooks: {
    goals: renderGoals, moves: paintMoves, score: () => {},
    goal: (i, g, x, y) => goalFly(i, g, x, y),
    sfx: k => snd[k] && snd[k](),
    match: (c) => snd.match(c),
    made: kind => tipSpecial(kind),
    special: () => {},
    praise: c => praise(['Lovely!', 'Splendid!', 'Delightful!', 'Marvellous!', 'Glorious!'][Math.min(4, c - 3)]),
    toast: t => toast(t),
    shake: v => E.shake(v),
    won: onWon, lost: onLost,
    boosterUsed: (k, c) => applyBooster(k, c),
  } });
  E.setReduce(reduce);
  const loopF = now => { if (screen === 'play') E.frame(now); requestAnimationFrame(loopF); }; requestAnimationFrame(loopF);
  // input
  const pt = e => [e.clientX, e.clientY];
  canvas.addEventListener('pointerdown', e => { snd.unlock(); if (state !== 'play') return; E.down(...pt(e)); });
  canvas.addEventListener('pointermove', e => { if (state === 'play') E.move(...pt(e)); });
  addEventListener('pointerup', () => E && E.up());
  return E;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s of a still screen): on level 1, until the
// first real touch, one plain three-in-a-row of a flower the goals don't ask for swaps itself (a free move, the counter is given back)
function demoMove() {   // no goal flowers and no 4s, Ls or squares, so the level's goals are left whole for the player
  const g = E.debug().cells, want = new Set(E.goals.filter(q => q.k === 'color' && q.left > 0).map(q => q.c)), C = (x, y) => g[y]?.[x];
  const info = (x, y) => { const c = C(x, y); if (typeof c !== 'number') return null; let h = 1, v = 1, sq = false;
    for (let i = 1; C(x - i, y) === c; i++) h++; for (let i = 1; C(x + i, y) === c; i++) h++; for (let i = 1; C(x, y - i) === c; i++) v++; for (let i = 1; C(x, y + i) === c; i++) v++;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) if (C(x + dx, y + dy) === c && C(x + dx + 1, y + dy) === c && C(x + dx, y + dy + 1) === c && C(x + dx + 1, y + dy + 1) === c) sq = true;
    return { c, h, v, sq }; };
  for (const m of E.validMoves()) { if (m.sp || m.nudge) continue;
    const [a, b] = [m.a, m.b], t = g[a[1]][a[0]]; g[a[1]][a[0]] = g[b[1]][b[0]]; g[b[1]][b[0]] = t;
    const ia = info(...a), ib = info(...b), hit = [ia, ib].filter(i => i && (i.h >= 3 || i.v >= 3 || i.sq));
    g[b[1]][b[0]] = g[a[1]][a[0]]; g[a[1]][a[0]] = t;
    if (hit.length === 1 && !hit[0].sq && hit[0].h + hit[0].v === 4 && !want.has(hit[0].c)) return m; }
  return null;
}
demo(() => { const m = demoMove(); if (!m) return false; E.addMoves(1); E.trySwap(m.a, m.b); return false; },
  { ready: () => screen === 'play' && state === 'play' && E && !E.busy && !E.over && !openCard && cur && !cur.daily && cur.n === 1 && E.moves === E.movesStart, wait: 2200 });
function layoutPlay() {
  if (!E) return;
  const dpr = Math.min(2, devicePixelRatio || 1); E.resize(innerWidth, innerHeight, dpr);
  const side = innerWidth / innerHeight >= 1.15 && innerWidth >= 760, ht = hud.querySelector('.hudtop'), bs = hud.querySelector('.boosters');
  hud.classList.toggle('side', side);
  if (side) {
    // desktop: goals on the left, boosters on the right, the board takes the full height
    layoutBox = E.layout(250, 70, innerWidth - 500, innerHeight - 100, 84);
    ht.style.left = Math.max(12, layoutBox.x - 236) + 'px'; ht.style.top = (layoutBox.y + 6) + 'px';
    bs.style.left = Math.min(innerWidth - 182, layoutBox.x + layoutBox.w + 40) + 'px'; bs.style.top = (layoutBox.y + 6) + 'px';
  } else {
    ht.style.left = ht.style.top = bs.style.left = bs.style.top = '';
    const top = ht.getBoundingClientRect().bottom + 46, bot = bs.getBoundingClientRect().top - 22;
    layoutBox = E.layout(10, top, innerWidth - 20, bot - top, 76);
  }
  const lt = hud.querySelector('[data-lt]'); lt.style.top = (layoutBox.y - 58) + 'px';
}
function begin(n, L) {
  const lives = M.lives();
  if (!lives.unlimited && lives.n <= 0) { livesCard({ then: () => begin(n, L) }); return; }
  closeCard(); snd.unlock(); music.start();
  cur = { n, L, daily: !!L.daily, startStars: st.best[n] || 0 };
  show('play'); state = 'play'; recorded = false; continued = false; t0 = performance.now();
  engine(); hud.querySelector('[data-lt]').textContent = L.daily ? "Today's puzzle" : 'Level ' + n + (L.hard ? ' · Hard' : '');
  hud.querySelector('[data-lt]').classList.toggle('hard', !!L.hard);
  E.load(L); renderGoals(E.goals); paintMoves(E.moves); paintBoosters(); layoutPlay();
  M.level(L.daily ? Math.max(1, st.level) : n); B.start();
  for (const g of L.goals) if (g.k !== 'color') st.tips['i_' + g.k] = 1; save();
  if (n === 1 && !L.daily && !st.tips.first) { st.tips.first = 1; save(); setTimeout(() => toast('Swap two flowers to line up three of a kind'), 900); }
}
function renderGoals(goals) {
  const row = hud.querySelector('[data-g]');
  row.innerHTML = goals.map((g, i) => `<div class="goal ${g.left <= 0 ? 'ok' : ''}" data-i="${i}"><img src="${GOAL_IMG(g)}" alt=""><b>${Math.max(0, g.left)}</b>${g.left <= 0 ? `<img class="tick" src="${A}icons/check.webp" alt="">` : ''}</div>`).join('');
}
function paintGoal(i, g) {
  const el = hud.querySelector(`.goal[data-i="${i}"]`); if (!el) return;
  el.querySelector('b').textContent = Math.max(0, g.left);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if (g.left <= 0 && !el.classList.contains('ok')) { el.classList.add('ok'); el.insertAdjacentHTML('beforeend', `<img class="tick" src="${A}icons/check.webp" alt="">`); snd.tick(); }
}
function paintMoves(n) { const m = hud.querySelector('[data-m]'); m.textContent = n; m.parentElement.classList.toggle('low', n <= 5); }
let flying = 0;
function goalFly(i, g, x, y) {
  const shown = Math.max(0, g.left);
  const el = hud.querySelector(`.goal[data-i="${i}"]`);
  if (!el || flying > 10 || reduce) { paintGoal(i, { ...g, left: shown }); return; }
  const r = el.querySelector('img').getBoundingClientRect(), f = h(`<img class="flyer" src="${GOAL_IMG(g)}" alt="">`);
  f.style.left = x - 20 + 'px'; f.style.top = y - 20 + 'px'; document.body.appendChild(f); flying++;
  requestAnimationFrame(() => { f.style.transform = `translate(${r.left + r.width / 2 - x}px,${r.top + r.height / 2 - y}px) scale(.9)`; });
  setTimeout(() => { f.remove(); flying--; paintGoal(i, { ...g, left: shown }); snd.goal(); }, 720);
}
function praise(t) { document.querySelectorAll('.praise').forEach(e => e.remove()); const e = h(`<div class="praise"></div>`); e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 1400); }
const TIPS = { ph: 'A posy! Swap it, or match beside it, to clear a whole row.', pv: 'A posy! Swap it, or match beside it, to clear a whole column.',
  fly: 'A butterfly! It flutters off to help with your goals.', bee: 'Bees! They buzz away everything around them.',
  wreath: 'A wreath! Swap it with a flower to clear every flower of that kind.' };
function tipSpecial(kind) { snd.made(); const k = kind === 'pv' ? 'ph' : kind; if (!st.tips['s_' + k]) { st.tips['s_' + k] = 1; save(); toast(TIPS[kind], 3600); } }

// boosters
function paintBoosters() {
  hud.querySelectorAll('.boost').forEach(b => { const k = b.dataset.b, n = st.boost[k] || 0, c = b.querySelector('[data-c]'); c.textContent = n || '+'; c.classList.toggle('plus', !n); c.classList.toggle('navy', !!n); b.classList.toggle('on', E && E.boosterMode === k); });
}
hud.querySelectorAll('.boost').forEach(b => b.onclick = () => {
  if (state !== 'play' || !E || E.busy) return; snd.tap();
  const k = b.dataset.b;
  if (E.boosterMode === k) { E.setBooster(null); banner(''); paintBoosters(); return; }
  if (!(st.boost[k] > 0)) return boosterCard(k);
  if (k === 'shuffle') { st.boost.shuffle--; save(); paintBoosters(); E.freeze(true); E.freeze(false); shuffleNow(); return; }
  E.setBooster(k); banner(BOOST[k].tip); paintBoosters();
});
function shuffleNow() { toast('Re-planting the flowers…', 1400); E.useBooster('shuffle', 0, 0); }
function applyBooster(k, [x, y]) {
  if (!(st.boost[k] > 0)) return; st.boost[k]--; save(); banner(''); paintBoosters(); E.useBooster(k, x, y);
}
function banner(t) { const b = hud.querySelector('[data-bn]'); b.textContent = t; b.classList.toggle('hide', !t); }
function boosterCard(k) {
  const bo = BOOST[k], rich = M.coins() >= bo.price;
  const ov = card({ rib: 'navy', title: bo.name, html: `<img src="${bo.img}" alt="" style="width:110px;height:110px;object-fit:contain"><p>${bo.what}</p>
    <div class="btns">${rich ? `<button class="btn sage" data-buy>Buy 1 for ${bo.price} <img src="${A}ui/coin.webp" alt="" style="width:30px"></button>` : `<button class="btn ivory" data-vid><img src="${A}icons/video.webp" alt="">Watch a short video for 1 free</button>`}
    <button class="btn link" data-no>Not now</button></div>` });
  ov.querySelector('[data-no]').onclick = () => closeCard();
  const buy = ov.querySelector('[data-buy]'); if (buy) buy.onclick = () => { if (M.spend(bo.price, 'booster-' + k)) { st.boost[k] = (st.boost[k] || 0) + 1; save(); snd.coin(); closeCard(); paintBoosters(); } };
  const vid = ov.querySelector('[data-vid]'); if (vid) vid.onclick = async () => { closeCard(); if (await M.rewarded('hint', { what: '1 free ' + bo.name, title: bo.name })) { st.boost[k] = (st.boost[k] || 0) + 1; save(); paintBoosters(); toast('A free ' + bo.name + ' is yours'); } };
}
hud.querySelector('[data-pause]').onclick = () => { if (state !== 'play') return; snd.tap(); pauseCard(); };

// ---------------------------------------------------------------- win / lose
const starsFor = (left, start) => { const f = left / start; return f >= 0.3 ? 3 : f >= 0.12 ? 2 : 1; };
async function onWon({ moves, movesStart }) {
  const n = cur.n, s = starsFor(moves, movesStart), ms = performance.now() - t0;
  E.setBooster(null); banner('');
  if (!recorded) { recorded = true; if (!cur.daily) F.level(true); }
  praise(moves > 0 ? 'Garden party!' : 'Well done!'); snd.win();
  await wait(700);
  if (moves > 0) await E.finale(8);
  await wait(500);
  // rewards
  const isNew = !cur.daily && n === st.level;
  let gain = 0; if (!cur.daily) { gain = Math.max(0, s - (st.best[n] || 0)); st.best[n] = Math.max(st.best[n] || 0, s); }
  let coins = 10 + Math.min(30, moves * 2); if (cur.L.hard) coins *= 2;
  let stamp = null, dly = null;
  if (cur.daily) {
    coins += 40; const first = !st.dly.days[TODAY]; dly = dailyWin(s); if (first) { gain = 1; stamp = giveStamp(); }
  } else {
    if (isNew) { st.level++; st.wins++; if (n % 3 === 0) stamp = giveStamp(); if (cur.L.hard) st.boost.trowel++; }
  }
  st.stars += gain; st.earned += gain; save();
  M.add(coins, cur.daily ? 'daily' : 'win');
  B.submit(s, { ms });
  state = 'won';
  winCard({ s, coins, gain, stamp, dly, hard: cur.L.hard });
}
function winCard({ s, coins, gain, stamp, dly, hard }) {
  const ov = card({ rib: 'sage', title: cur.daily ? 'Puzzle solved!' : 'Well done!', x: false, tall: true, html: `
    <div class="stars">${[0, 1, 2].map(() => `<img src="${A}ui/star-full.webp" alt="">`).join('')}</div>
    <p>${cur.daily ? 'Today\'s garden puzzle, solved.' : 'Level ' + cur.n + ' complete' + (hard ? ', and it was a hard one!' : '.')}</p>
    <div class="rewards">${gain ? `<span class="reward"><img src="${A}ui/star-full.webp" alt="">+${gain} for the garden</span>` : ''}<span class="reward" data-cn><img src="${A}ui/coin.webp" alt="">+${coins}</span>
    ${hard ? `<span class="reward"><img src="${BOOST.trowel.img}" alt="">+1</span>` : ''}</div>
    ${stamp ? `<div style="display:flex;align-items:center;justify-content:center;gap:10px"><img src="${A}stamps/stamp-${stamp}.webp" alt="" style="width:76px;animation:stampin .8s cubic-bezier(.3,1.6,.5,1)"><p style="margin:0;text-align:left">A new stamp<br>for your album!</p></div>` : ''}
    ${dly ? `<div class="share">${dly.grid}</div>${dly.frozen ? '<p style="margin:0">A streak freeze kept your streak going.</p>' : ''}` : ''}
    <span class="grow"></span>
    <div class="btns">
      ${dly ? `<button class="btn ivory" data-share><img src="${A}icons/share.webp" alt="">Share my garden</button>` : `<button class="btn ivory" data-dbl><img src="${A}icons/video.webp" alt="">Double my coins</button>`}
      <button class="btn sage" data-next>Continue</button>
    </div>` });
  const imgs = ov.querySelectorAll('.stars img');
  imgs.forEach((im, i) => { if (i < s) setTimeout(() => { im.classList.add('on'); snd.star(i); }, 250 + i * 330); else { im.src = A + 'ui/star-empty.webp'; setTimeout(() => im.classList.add('on'), 250 + i * 330); } });
  const dbl = ov.querySelector('[data-dbl]');
  if (dbl) dbl.onclick = async () => { dbl.disabled = true; if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); ov.querySelector('[data-cn]').innerHTML = `<img src="${A}ui/coin.webp" alt="">+${coins * 2}`; snd.coin(); dbl.remove(); } else dbl.disabled = false; };
  const sh = ov.querySelector('[data-share]'); if (sh) sh.onclick = () => shareDaily(dly.grid);
  ov.querySelector('[data-next]').onclick = async () => {
    snd.tap(); closeCard();
    await M.breakAd('level-end', { level: cur.n });
    show('home');
    if (canRestore() && !st.tips.restore) { st.tips.restore = 1; save(); robin('You have stars! Tap the star button to restore the garden.'); }
  };
}
async function onLost({ goals, frac }) {
  state = 'lost'; E.setBooster(null); banner(''); snd.lose();
  const left = goals.filter(g => g.left > 0);
  const line = left.length === 1 ? `Only ${left[0].left} more ${GOAL_NAME(left[0], left[0].left)} to go.` : 'So close. The garden can wait for you.';
  await wait(500);
  const ov = card({ rib: 'rose', title: 'Out of moves', x: false, tall: true, html: `
    <p>${line}</p>
    <div class="goalrow">${left.map(g => `<div class="goal"><img src="${GOAL_IMG(g)}" alt=""><b>${g.left}</b></div>`).join('')}</div>
    <p style="font-size:calc(17px * var(--fs))">Trying again uses one life.</p>
    <span class="grow"></span>
    <button class="btn link" data-home>Back to the garden</button>
    <div class="btns" style="margin-top:4px">
      <button class="btn ivory" data-more style="visibility:hidden"><img src="${A}icons/video.webp" alt="">5 more moves</button>
      <button class="btn sage" data-retry>Try again</button>
    </div>` });
  const more = ov.querySelector('[data-more]');
  // the iOS app shows its own card in the first 1.2 s after a loss, so the offer waits; one continue per try
  if (!continued) setTimeout(() => { if (more.isConnected) more.style.visibility = 'visible'; }, 1250); else more.remove();
  more.onclick = async () => {
    more.disabled = true;
    if (await M.rewarded('moves', { what: '5 more moves on this level' })) { continued = true; closeCard(); E.addMoves(5); state = 'play'; toast('5 more moves. You can do it!'); }
    else more.disabled = false;
  };
  const giveUp = () => { if (!recorded) { recorded = true; if (!cur.daily) F.level(false, frac); } M.useLife(); };
  ov.querySelector('[data-retry]').onclick = () => { snd.tap(); giveUp(); const { n, L } = cur; const lv = L.daily ? dailyLevel(D.seed || dateInt()) : makeLevel(n, n > 5 ? F.k() : 1); begin(n, lv); };
  ov.querySelector('[data-home]').onclick = () => { snd.tap(); giveUp(); show('home'); };
}

// ---------------------------------------------------------------- cards: pause, settings, lives, album, daily
function toggles() {
  return `<button class="toggle" data-tg="big">Larger text<span class="sw ${st.set.big ? 'on' : ''}"></span></button>
  <button class="toggle" data-tg="music">Music<span class="sw ${st.set.music ? 'on' : ''}"></span></button>
  <button class="toggle" data-tg="sfx">Sounds<span class="sw ${st.set.sfx ? 'on' : ''}"></span></button>`;
}
function wireToggles(ov) {
  ov.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => {
    const k = b.dataset.tg; st.set[k] = !st.set[k]; save(); b.querySelector('.sw').classList.toggle('on', st.set[k]);
    if (k === 'big') { document.documentElement.classList.toggle('big', st.set.big); if (screen === 'play') layoutPlay(); }
    if (k === 'music') { music.set(st.set.music); if (st.set.music) music.start(); }
    if (k === 'sfx') setSfx(st.set.sfx);
  });
}
function pauseCard() {
  E.freeze(true);
  const ov = card({ rib: 'navy', title: 'Paused', onClose: () => E.freeze(false), html: `${toggles()}
    <div class="btns"><button class="btn sage" data-res>Keep playing</button><button class="btn ivory" data-how>How to play</button><button class="btn link" data-quit>Leave level (uses a life)</button></div>` });
  wireToggles(ov);
  ov.querySelector('[data-res]').onclick = () => { closeCard(); E.freeze(false); };
  ov.querySelector('[data-how]').onclick = () => { howCard(() => pauseCard()); };
  ov.querySelector('[data-quit]').onclick = () => { if (!recorded) { recorded = true; if (!cur.daily) F.level(false, E.frac()); } M.useLife(); E.freeze(false); show('home'); };
}
function settingsCard() {
  const ov = card({ rib: 'navy', title: 'Settings', html: `${toggles()}<div class="btns"><button class="btn ivory" data-how>How to play</button></div>
    <p style="font-size:calc(16px * var(--fs))">Garden Gather is free. No timers, and nothing is ever rushed.</p>` });
  wireToggles(ov); ov.querySelector('[data-how]').onclick = () => howCard(() => settingsCard());
}
function howCard(back) {
  const r = (img, t) => `<div><img src="${A}${img}.webp" alt=""><span>${t}</span></div>`;
  const ov = card({ rib: 'sage', title: 'How to play', html: `<div class="how">
    ${r('m3/rose', 'Swap two flowers to line up three or more of a kind.')}
    ${r('m3/special-posy-h', 'Four in a row makes a posy. It clears a whole line.')}
    ${r('m3/special-butterfly', 'A square of four makes a butterfly. It flies to a goal.')}
    ${r('m3/special-bee', 'An L or T shape makes bees. They clear all around.')}
    ${r('m3/special-wreath', 'Five in a row makes a wreath. Swap it with a flower to clear that kind.')}
    ${r('m3/pot', 'Bring pots to the bottom row. You can slide one down a square.')}
    ${r('m3/crate', 'Match next to crates and brambles to break them.')}
    ${r('ui/star-full', 'Win levels for stars, then spend them on the garden.')}</div>
    <div class="btns"><button class="btn sage" data-ok>Got it</button></div>` });
  ov.querySelector('[data-ok]').onclick = () => { closeCard(); back && back(); };
}
let livesTimer = 0;
function livesCard({ then = null } = {}) {
  const paint = ov => {
    const L = M.lives(); ov.querySelector('.hearts').innerHTML = Array.from({ length: L.max }, (_, i) => `<img src="${A}ui/heart.webp" class="${L.unlimited || i < L.n ? '' : 'off'}" alt="">`).join('');
    ov.querySelector('[data-t]').textContent = L.unlimited ? 'Unlimited lives today.' : L.n >= L.max ? 'Your lives are full.' : `Next life in ${mmss(L.nextAt - Date.now())}`;
    const v = ov.querySelector('[data-vid]'); if (v) v.classList.toggle('hide', L.unlimited || L.n >= L.max);
  };
  const ov = card({ rib: 'rose', title: 'Lives', tall: !!then, x: !then, onClose: () => clearInterval(livesTimer), html: `<div class="hearts"></div><p data-t></p>
    <p style="font-size:calc(17px * var(--fs))">A life is only used when a level isn't finished. One comes back every 20 minutes.</p><span class="grow"></span>
    ${then ? '<button class="btn link" data-back>Back to the garden</button>' : ''}<div class="btns"><button class="btn ivory" data-vid><img src="${A}icons/video.webp" alt="">Refill my lives</button></div>` });
  paint(ov); clearInterval(livesTimer); livesTimer = setInterval(() => ov.isConnected ? paint(ov) : clearInterval(livesTimer), 1000);
  ov.querySelector('[data-vid]').onclick = async () => { if (await M.rewarded('lives')) { paintMoney(); toast('Lives refilled'); if (then) { closeCard(); then(); } else paint(ov); } };
  const bk = ov.querySelector('[data-back]'); if (bk) bk.onclick = () => { closeCard(); show('home'); };
}
// album: 24 stamps on two pages of 12
function giveStamp() { const next = STAMPS.find(s => !st.album.includes(s)); if (!next) return null; st.album.push(next); return next; }
const albumClaimable = () => [0, 1].some(p => !st.claimed.includes(p) && STAMPS.slice(p * 12, p * 12 + 12).every(s => st.album.includes(s)));
function albumCard(page = st.album.length >= 12 && st.album.length < 24 ? 1 : 0) {
  const set = STAMPS.slice(page * 12, page * 12 + 12), have = set.filter(s => st.album.includes(s)).length, full = have === 12, claimed = st.claimed.includes(page);
  const ov = card({ rib: 'navy', title: page ? 'Garden Friends II' : 'Garden Friends', html: `<p>${have} of 12 stamps. A new one every third level and every daily puzzle.</p>
    <div class="stamps">${set.map(s => `<div class="${st.album.includes(s) ? '' : 'no'} ${st.album[st.album.length - 1] === s ? 'new' : ''}"><img src="${A}stamps/stamp-${s}.webp" alt=""></div>`).join('')}</div>
    <div class="btns">${full && !claimed ? `<button class="btn sage" data-claim>Claim 250 coins</button>` : `<p style="margin:0">Fill the page: <b>250 coins</b>${claimed ? ' (claimed)' : ''}</p>`}
    <button class="btn ivory" data-pg>${page ? '‹ Page 1' : 'Page 2 ›'}</button></div>` });
  ov.querySelector('[data-pg]').onclick = () => { snd.page(); albumCard(1 - page); };
  const c = ov.querySelector('[data-claim]'); if (c) c.onclick = () => { st.claimed.push(page); save(); M.add(250, 'album'); snd.coin(); paintHome(); albumCard(page); };
}
// daily streak with one free freeze each week (+ extra freezes bought with coins)
const freezes = () => (st.dly.freeWeek !== week(TODAY) ? 1 : 0) + st.dly.extra;
function streakNow() {
  const d = st.dly; if (!d.last) return { n: 0 };
  const missed = TODAY - d.last - 1;
  if (missed <= 0) return { n: d.n, safe: true };
  return missed <= freezes() ? { n: d.n, safe: true, needs: missed } : { n: 0, lost: d.n };
}
function dailyWin(stars) {
  const d = st.dly; let frozen = 0;
  if (d.last !== TODAY) {
    const missed = d.last ? TODAY - d.last - 1 : 0;
    if (!d.last) d.n = 1;
    else if (missed <= 0) d.n++;
    else if (missed <= freezes()) {
      for (let i = 0; i < missed; i++) { if (d.freeWeek !== week(TODAY)) d.freeWeek = week(TODAY); else d.extra--; d.frozen.push(d.last + 1 + i); }
      frozen = missed; d.n++;
    } else d.n = 1;
    d.last = TODAY;
  }
  d.days[TODAY] = Math.max(d.days[TODAY] || 0, stars); save();
  const used = cur.L.moves + (continued ? 5 : 0) - E.moves, total = cur.L.moves + (continued ? 5 : 0);
  const k = Math.max(1, Math.min(5, Math.round(used / total * 5)));
  const dt = new Date(), ds = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const grid = `Garden Gather · ${ds}\n${'🌸'.repeat(k)}${'🌿'.repeat(5 - k)}\n${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${d.n}-day streak 🌹`;
  return { grid, n: d.n, frozen };
}
async function shareDaily(grid) {
  const u = new URL(location.href); u.search = ''; u.searchParams.set('daily', '1');
  try { if (navigator.share) { await navigator.share({ title: 'Garden Gather', text: grid, url: u.href }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(grid + '\n' + u.href); toast('Copied. Paste it to a friend.'); } catch (e) { toast('Sharing is not available here'); }
}
function dailyCard() {
  const sn = streakNow(), solved = st.dly.days[TODAY], days = [];
  for (let i = 6; i >= 0; i--) { const d = TODAY - i, wd = new Date(d * 864e5).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2); days.push(`<div><i class="${st.dly.days[d] ? 'ok' : st.dly.frozen.includes(d) ? 'frz' : ''} ${d === TODAY ? 'today' : ''}">${st.dly.days[d] ? '✓' : st.dly.frozen.includes(d) ? '❄' : ''}</i>${wd}</div>`); }
  const ov = card({ rib: 'rose', title: sn.n ? `Daily streak: ${sn.n} day${sn.n > 1 ? 's' : ''}` : 'Daily puzzle', html: `
    <p>${solved ? 'Solved today. A new puzzle grows overnight.' : 'One new garden puzzle every day, the same one for everyone.'}</p>
    <div class="week">${days.join('')}</div>
    <p style="font-size:calc(18px * var(--fs))">Streak freezes ready: <b>${freezes()}</b>. One is free every week; it covers a day you miss.${sn.lost ? ` Your ${sn.lost}-day streak ended, so let's start a new one.` : ''}</p>
    <div class="btns">${solved ? `<button class="btn ivory" data-share><img src="${A}icons/share.webp" alt="">Share today's result</button>` : `<button class="btn sage" data-go>Play today's puzzle</button>`}
    ${st.dly.extra < 2 ? `<button class="btn ivory" data-frz ${M.coins() < 200 ? 'disabled' : ''}>Buy a streak freeze · 200 <img src="${A}ui/coin.webp" alt="" style="width:30px;margin:0"></button>` : ''}</div>` });
  const go = ov.querySelector('[data-go]'); if (go) go.onclick = () => { closeCard(); playDaily(); };
  const sh = ov.querySelector('[data-share]'); if (sh) sh.onclick = () => { const s = st.dly.days[TODAY]; shareDaily(`Garden Gather · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}\n${'⭐'.repeat(s)}${'☆'.repeat(3 - s)} · ${st.dly.n}-day streak 🌹`); };
  const fz = ov.querySelector('[data-frz]'); if (fz) fz.onclick = () => { if (M.spend(200, 'streak-freeze')) { st.dly.extra++; save(); snd.coin(); dailyCard(); } };
}
function playDaily() { preview(0, { dailyL: dailyLevel(D.seed || dateInt()) }); }

// ---------------------------------------------------------------- test hooks + bot (plays at a human pace)
window.__game = {
  get state() { return state; }, get level() { return st.level; }, get score() { return st.earned; },
  bot() {
    if (state === 'ready') {
      if (openCard && openCard.querySelector('[data-go]')) { openCard.querySelector('[data-go]').click(); return; }
      closeCard();
      const t = nextTasks().find(t => st.stars >= t.cost); if (t && screen === 'home' && Math.random() < 0.5) { restore(t, false); return; }
      begin(st.level, makeLevel(st.level, st.level > 5 ? F.k() : 1)); return;
    }
    if (state !== 'play' || !E || E.busy || E.over || openCard) return;
    if (performance.now() - lastBot < 1500) return;
    const m = E.bestMove(); if (m) { lastBot = performance.now(); E.trySwap(m.a, m.b); }
  },
  debug: () => ({ st, money: M.debug(), engine: E && E.debug() }),
  // the arcade shell starts every game by itself: from the garden screen, jump straight into the next level (false = still loading)
  autostart() { if (!IMG.paper || $('#load') || screen !== 'home' || state !== 'ready' || openCard || innerHeight < 300) return false; requestAnimationFrame(() => screen === 'home' && state === 'ready' && begin(st.level, makeLevel(st.level, st.level > 5 ? F.k() : 1))); },
  get E() { return E; },
};

// ---------------------------------------------------------------- boot
addEventListener('resize', () => { if (screen === 'home') { layoutScene(); } if (screen === 'play') { layoutPlay(); setBg('garden-gather'); } if (screen === 'map') renderMap(); });
addEventListener('pointerdown', () => { snd.unlock(); if (st.set.music) music.start(); }, { once: true });
addEventListener('pointerdown', e => { if (!e.target.closest('.robin')) document.querySelectorAll('.robin').forEach(r => r.remove()); });
(async () => {
  const bar = $('#load b'); let done = 0;
  const list = [...M3.map(n => ['m3/' + n, n]), ['ui/paper', 'paper']];
  const pre = [A + 'bg/' + chapter().scene + '.webp', A + 'bg/garden-gather.webp'];
  await Promise.all([...list.map(async ([p, k]) => { IMG[k] = await loadImg(A + p + '.webp'); bar.style.width = (++done / (list.length + pre.length)) * 100 + '%'; }),
    ...pre.map(async p => { await loadImg(p); bar.style.width = (++done / (list.length + pre.length)) * 100 + '%'; })]);
  try { await document.fonts.ready; } catch (e) {}
  show('home');
  const ld = $('#load'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 650);
  if (Q.get('daily') === '1') { playDaily(); return; }
  if (!st.seenIntro && !BOT) { st.seenIntro = true; save(); setTimeout(() => robin('Welcome! This old garden needs love. Win levels for stars, then spend them to bring it back.', 7000), 700); }
  else if (canRestore()) setTimeout(() => robin(`You have ${st.stars} stars. Tap the star to restore the garden.`), 700);
})();

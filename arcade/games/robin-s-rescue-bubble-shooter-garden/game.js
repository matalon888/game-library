// Robin's Rescue: Bubble Shooter Garden. Original bubble shooter in the Storybook Garden style (style C, BATCH12).
// Aim, match three berries of a colour, free the chicks tangled in the hedgerow; saga levels with a berry budget and an
// aim line, no timers. Stars restore a painted garden, stamps fill an album, a daily puzzle keeps a streak.
// Art: assets/storybook (painted WebP, copied into ./assets). Shape marks, UI layout, motion and sound: code.
import { createUI, store } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';
import { COLS, RH, W as GW, DEAD, XWALL, LAUNCH_Y, cellPos, bestShot } from './grid.js';
import { makeLevel, nextBerry, BERRIES, CHICKS, isHard, rng } from './levels.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason && (e.reason.stack || e.reason))));
const NAME = "Robin's Rescue: Bubble Shooter Garden", SLUG = 'robins-rescue';
const BOT = !!navigator.webdriver, Q = new URLSearchParams(location.search);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = store('rr');
const st = {
  level: S.get('level', 1), stars: S.get('stars', 0), starsAll: S.get('starsAll', 0), chicks: S.get('chicks', 0), garden: S.get('garden', 0),
  boosts: S.get('boosts', { acorn: 1, pearl: 1 }), best: S.get('best', {}), stamps: S.get('stamps', []), seenStamps: S.get('seenStamps', 0),
  dly: S.get('dly', { last: 0, streak: 0, freezeWeek: -1, wins: 0, best: 0 }), opts: S.get('opts', { big: false, marks: true }),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow(SLUG);
const M = money({ game: SLUG, style: 'C' });
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const A = p => './assets/' + p + '.webp';
if (st.opts.big) document.documentElement.classList.add('rr-big');

// ---------------------------------------------------------------- calendar
const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const weekOf = n => Math.floor((n + 3) / 7);
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

// ---------------------------------------------------------------- images
const IMG = {};
const NEED = ['bg/robins-rescue', 'bg/robins-rescue-wide', 'bubble/robin', 'bubble/nest', 'bubble/acorn-bomb', 'bubble/pearl-rainbow', 'bubble/bramble-thick',
  'kit/garland', 'kit/sprig', 'kit/paper', 'kit/round-ivory', ...BERRIES.map(b => 'bubble/' + b.id), ...CHICKS.map(c => 'bubble/' + c.id)];
function load(p) { return IMG[p] || (IMG[p] = new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = A(p); }).then(i => (IMG[p] = i))); }
const img = p => (IMG[p] && !(IMG[p] instanceof Promise)) ? IMG[p] : null;

// ---------------------------------------------------------------- canvas + layout
const cv = document.getElementById('rr-cv'), cx2 = cv.getContext('2d');
let DPR = 1, VW = 0, VH = 0, U = 38, CX = 0, CEIL = 0, LPX = 0, wide = false;
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; wide = VW / VH > 1;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const top = 150, safeB = 0;
  LPX = VH - safeB - 104 - 50;                       // launcher centre (px)
  U = Math.min((VW - 18) / GW, (LPX - top - 8) / -LAUNCH_Y, 64);
  LPX = Math.min(LPX, top + 8 + -LAUNCH_Y * U + 40);
  CX = VW / 2; CEIL = LPX + LAUNCH_Y * U;
  placeHud();
}
const px = x => CX + x * U, py = y => CEIL - y * U;

// ---------------------------------------------------------------- UI (kit cards restyled) + layers
const ui = createUI({ title: "Robin's Rescue", hint: '', hand: '', progress: false, score: false });
const D = daily(SLUG, ui, { name: NAME });
const B = worldBoard({ game: 'robins-rescue', label: 'Stars earned', limits: { maxRun: 6, maxPerSec: 1 }, mode: 'sum', corner: 'tr', accent: '#B08834' });

const hud = $(`<div>
  <div id="rr-top" class="rr-hidden">
    <div class="row"><button class="rr-ic home" aria-label="Home" style="background-image:url(${A('icons/home')})"></button>
      <div class="rr-ribbon"><b>Level 1</b></div>
      <button class="rr-coins" aria-label="Coins and shop"><img src="${A('kit/coin')}" alt=""><span>0</span><i>+</i></button></div>
    <div id="rr-goal"><div class="rr-nest" aria-label="Chicks rescued"><img src="${A('bubble/nest')}" alt=""><b>0/0</b></div>
      <div class="rr-stars" aria-label="Stars"><img src="${A('kit/star-full')}" alt=""><img src="${A('kit/star-full')}" alt=""><img src="${A('kit/star-full')}" alt=""></div></div>
  </div>
  <div id="rr-bot" class="rr-hidden">
    <div class="rr-tool rr-shots" aria-label="Berries left"><div class="disc"><b>0</b></div><span>berries</span></div>
    <button class="rr-tool" data-b="acorn" aria-label="Acorn: bursts everything around it"><div class="disc"><img src="${A('bubble/acorn-bomb')}" alt=""><em></em></div><span>Acorn</span></button>
    <button class="rr-tool" data-b="pearl" aria-label="Rainbow pearl: matches any colour"><div class="disc"><img src="${A('bubble/pearl-rainbow')}" alt=""><em></em></div><span>Pearl</span></button>
    <button class="rr-tool" data-b="hint" aria-label="Hint: shows a good shot"><div class="disc"><img src="${A('icons/hint')}" alt="" style="width:56px;height:56px"><em class="buy"></em></div><span>Hint</span></button>
  </div>
  <div id="rr-toast"></div>
</div>`);
document.body.appendChild(hud);
const H = {
  top: hud.querySelector('#rr-top'), bot: hud.querySelector('#rr-bot'), ribbon: hud.querySelector('.rr-ribbon'), ribbonT: hud.querySelector('.rr-ribbon b'),
  coins: hud.querySelector('.rr-coins'), coinsN: hud.querySelector('.rr-coins span'), home: hud.querySelector('.home'),
  nest: hud.querySelector('.rr-nest'), nestN: hud.querySelector('.rr-nest b'), stars: [...hud.querySelectorAll('.rr-stars img')],
  shots: hud.querySelector('.rr-shots'), shotsN: hud.querySelector('.rr-shots b'), tools: [...hud.querySelectorAll('.rr-tool[data-b]')], toast: hud.querySelector('#rr-toast'),
};
function placeHud() { /* the HUD is CSS-positioned; nothing to do but keep the hook */ }
let toastT = 0;
function toast(t, ms = 1300) { H.toast.textContent = t; H.toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => H.toast.classList.remove('on'), ms); }
const stop = el => { el.addEventListener('pointerdown', e => e.stopPropagation()); return el; };

// coins
let shownCoins = M.coins();
M.onChange(s => { shownCoins = s.coins; H.coinsN.textContent = shownCoins.toLocaleString(); toolsHud(); });
H.coinsN.textContent = shownCoins.toLocaleString();
H.coins.onclick = () => { snd.tap(); M.shop(); };
let adOn = false;
addEventListener('ap:ad', e => { adOn = e.detail.phase === 'start'; snd.playMusic(!adOn && musicWanted()); });
const musicWanted = () => snd.music && !snd.muted;

// ---------------------------------------------------------------- title card
const start = ui.els.start; start.classList.add('rr-title');
const h1 = start.querySelector('h1'), streakP = start.querySelector('p');
const logo = $(`<div class="rr-logo"><img class="gar" src="${A('kit/garland')}" alt=""></div>`);
h1.innerHTML = 'Robin&rsquo;s Rescue'; logo.append(h1, $(`<div class="sub"><img src="${A('kit/sprig')}" style="transform:rotate(-90deg)" alt="">A bubble shooter garden<img src="${A('kit/sprig')}" style="transform:rotate(90deg) scaleX(-1)" alt=""></div>`));
const tTop = $('<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:34px"></div>'); tTop.append(logo);
if (streakP) { streakP.classList.add('rr-streak'); tTop.append(streakP); }
const tRobin = $(`<img class="rr-robin" src="${A('bubble/robin')}" alt="Robin">`);
const tPlay = stop($(`<button class="rr-pill" style="min-width:250px;min-height:68px;font-size:calc(27px*var(--k))"><img src="${A('icons/play')}" alt=""><span>Play</span></button>`));
const tMenu = $(`<div class="rr-menu">
  <button data-m="daily"><img src="${A('icons/calendar')}" alt=""><span>Daily</span><em class="rr-hidden">!</em></button>
  <button data-m="garden"><img src="${A('icons/home')}" alt=""><span>Garden</span><em class="rr-hidden"></em></button>
  <button data-m="album"><img src="${A('icons/album')}" alt=""><span>Album</span><em class="rr-hidden"></em></button>
  <button data-m="board"><img src="${A('icons/trophy')}" alt=""><span>Leaders</span></button>
  <button data-m="settings" class="rr-gear" aria-label="Settings"><img src="${A('icons/settings')}" alt=""></button></div>`);
const tBottom = $('<div style="display:flex;flex-direction:column;align-items:center;gap:18px;margin-bottom:6px"></div>'); tBottom.append(tPlay, tMenu);
start.innerHTML = ''; start.append(tTop, tRobin, tBottom);
for (const b of tMenu.querySelectorAll('button')) { stop(b); b.onclick = () => { snd.unlock(); snd.tap(); ({ daily: () => beginLevel(true), garden: openGarden, album: openAlbum, settings: openSettings, board: () => B.open() })[b.dataset.m](); }; }
tPlay.onclick = () => { snd.unlock(); beginLevel(false); };
function titleHud() {
  const dl = st.dly, today = dayNum();
  tPlay.querySelector('span').textContent = `Play level ${st.level}`;
  tMenu.querySelector('[data-m=daily] em').classList.toggle('rr-hidden', dl.last === today);
  const gT = nextTask(), gEm = tMenu.querySelector('[data-m=garden] em');
  gEm.classList.toggle('rr-hidden', !(gT && st.stars >= gT.cost)); gEm.textContent = '★';
  const newS = st.stamps.length - st.seenStamps, aEm = tMenu.querySelector('[data-m=album] em');
  aEm.classList.toggle('rr-hidden', newS <= 0); aEm.textContent = newS;
}

// ---------------------------------------------------------------- win + lose cards
const winC = ui.els.win, loseC = ui.els.lose;
const winP = $(`<div class="rr-panel"><img class="roses tl" src="${A('kit/corner-roses')}" alt=""><img class="roses br" src="${A('kit/corner-roses')}" alt=""></div>`);
const kitShare = winC.querySelector('.hc-btn');
const wLvl = winC.querySelector('p'), wH = winC.querySelector('h1'), wX = winC.querySelector('[data-x]');
const wStars = $(`<div class="rr-wstars"><img src="${A('kit/star-full')}" alt=""><img src="${A('kit/star-full')}" alt=""><img src="${A('kit/star-full')}" alt=""></div>`);
const wLine = $(`<div class="rr-wline"><span><img src="${A('kit/coin')}" alt=""><b class="c">+0</b></span><span class="sc"></span></div>`);
const wDouble = stop($(`<button class="rr-pill ivory half"><img src="${A('icons/video')}" alt=""><span>2× coins</span></button>`));
const wGrid = stop($(`<button class="rr-pill ivory half"><img src="${A('icons/share')}" alt=""><span>Share my day</span></button>`));
const wGarden = stop($(`<button class="rr-pill rose half"><img src="${A('icons/home')}" alt=""><span>Garden</span></button>`));
const wNext = $(`<button class="rr-pill" style="min-width:250px;min-height:70px"><span>Continue</span></button>`);
const wRow = $('<div class="rr-row"></div>');
const wNestArt = $(`<div class="rr-wnest"><img class="n" src="${A('bubble/nest')}" alt=""><img class="c1" src="${A('bubble/chick-bluetit')}" alt=""><img class="c2" src="${A('bubble/chick-wren')}" alt=""><img class="rb" src="${A('bubble/robin')}" alt=""></div>`);
if (kitShare) { stop(kitShare); kitShare.className = 'rr-pill ivory half'; kitShare.innerHTML = `<img src="${A('icons/share')}" alt=""><span>Share</span>`; }
wRow.append(wDouble, wGrid); if (kitShare) wRow.append(kitShare);
wRow.append(wGarden); winP.append(wLvl, wH, wNestArt, wStars, wLine, wX, wNext, wRow);
winC.innerHTML = ''; winC.classList.add('dim', 'rr-wincard'); winC.append(winP);
const loseP = $(`<div class="rr-panel"><img class="roses tl" src="${A('kit/corner-roses')}" alt=""></div>`);
const lH = loseC.querySelector('h1'), lX = loseC.querySelector('[data-x]');
const lChick = $(`<img src="${A('bubble/chick-wren')}" alt="" style="width:96px;height:96px;object-fit:contain">`);
const lMore = stop($(`<button class="rr-pill ivory" style="visibility:hidden"><img src="${A('icons/video')}" alt=""><span>5 more berries<small>watch a short video</small></span></button>`));
const lAgain = $(`<button class="rr-pill" style="min-height:70px;min-width:250px"><span>Try again</span></button>`);
const lHome = stop($(`<button class="rr-pill ivory" style="min-width:160px"><span>Home</span></button>`));
loseP.append(lChick, lH, lX, lMore, lAgain, lHome);
loseC.innerHTML = ''; loseC.classList.add('rr-losecard'); loseC.append(loseP);

// ---------------------------------------------------------------- game state
let state = 'ready', L = null, grid = null, shotsLeft = 0, cur = 0, nxt = 0, special = null, score = 0, freed = 0, total = 0, isDaily = false;
let busy = false, aiming = false, aimA = Math.PI / 2, aimOk = false, hintA = null, hintUntil = 0, runT0 = 0, recorded = false, levelN = 1, usedRevive = 0;
let shotLog = [], lastWin = null, rnd = Math.random;
const fx = { fly: null, pops: [], falls: [], petals: [], texts: [], birds: [], swapT: 1, robinT: 0, shake: 0 };

function starsFor(left, total0, hard) { const f = left / total0; return f >= (hard ? 0.3 : 0.4) ? 3 : f >= (hard ? 0.12 : 0.2) ? 2 : 1; }
function hudLevel() {
  H.ribbon.classList.toggle('hard', !!(L && L.hard)); H.ribbon.classList.toggle('daily', isDaily);
  H.ribbonT.textContent = isDaily ? 'Daily puzzle' : L && L.hard ? `Hard · ${levelN}` : `Level ${levelN}`;
  H.nestN.textContent = `${freed}/${total}`;
  H.shotsN.textContent = shotsLeft; H.shots.classList.toggle('low', shotsLeft <= 3);
  const s = L ? starsFor(shotsLeft, L.shots, L.hard) : 3; H.stars.forEach((im, i) => im.classList.toggle('off', i >= s));
  toolsHud();
}
const PRICE = { acorn: 150, pearl: 120, hint: 60 };
function toolsHud() {
  for (const t of H.tools) {
    const k = t.dataset.b, em = t.querySelector('em'); t.classList.toggle('on', special === k || (k === 'hint' && hintUntil > performance.now()));
    if (k === 'hint') { em.textContent = PRICE.hint; continue; }
    const n = st.boosts[k] || 0; em.textContent = n > 0 ? n : '+'; em.classList.toggle('buy', n <= 0);
  }
}
function showPlayHud(on) { H.top.classList.toggle('rr-hidden', !on); H.bot.classList.toggle('rr-hidden', !on); document.body.classList.toggle('rr-playing', on); }

// ---------------------------------------------------------------- level start / end
function beginLevel(dailyRun) {
  if (state === 'play') return;
  const today = dayNum();
  if (!dailyRun && st.level >= 6) { const lv = M.lives(); if (!lv.unlimited && lv.n <= 0) { outOfLives(); return; } }
  isDaily = !!dailyRun; levelN = isDaily ? 1 : st.level;
  const seed = isDaily ? (D.seed || ymd()) : null;
  L = makeLevel(isDaily ? 20 : levelN, F.k(), seed, { daily: isDaily });
  grid = L.grid; shotsLeft = L.shots; total = L.chicks; freed = 0; score = 0; special = null; hintA = null; usedRevive = 0; shotLog = [];
  rnd = rng((L.seed || 1) * 13 + 7);
  cur = nextBerry(grid, rnd); nxt = nextBerry(grid, rnd);
  fx.pops = []; fx.falls = []; fx.petals = []; fx.texts = []; fx.birds = []; fx.fly = null; busy = false; recorded = false;
  ui.hideStart(); winC.classList.add('hc-hidden'); loseC.classList.add('hc-hidden');
  state = 'play'; runT0 = performance.now(); M.level(levelN); B.start();
  showPlayHud(true); hudLevel();
  snd.playMusic(musicWanted());
  if (L.hard) toast('A hard one: short and tight', 1800);
  else if (levelN === 1 && !isDaily) toast('Drag to aim, let go to flick', 2200);
}
function goTitle() {
  state = 'ready'; showPlayHud(false); winC.classList.add('hc-hidden'); loseC.classList.add('hc-hidden');
  titleHud(); ui.start(); snd.playMusic(false);
}
ui.onTap(async which => {
  snd.unlock();
  if (which === 'start') { beginLevel(false); return; }
  if (which === 'win') { await afterWin(); return; }
  if (which === 'lose') { retry(); }
});
async function afterWin() {
  state = 'ready';
  if (!lastWin || !lastWin.daily) await M.breakAd('level-end', { level: levelN });
  if (lastWin && lastWin.daily) { goTitle(); return; }
  beginLevel(false);
}
function retry() {
  if (!isDaily && levelN >= 6) M.useLife();
  state = 'ready';
  if (isDaily) { beginLevel(true); return; }
  const lv = M.lives(); if (!lv.unlimited && lv.n <= 0 && levelN >= 6) { goTitle(); outOfLives(); return; }
  beginLevel(false);
}
wNext.onclick = () => {};   // the card's own tap handler continues
wDouble.onclick = async () => { if (!lastWin) return; wDouble.disabled = true; if (await M.rewarded('double', { what: `${lastWin.coins * 2} coins instead of ${lastWin.coins}` })) { M.add(lastWin.coins, 'double'); wLine.querySelector('.c').textContent = '+' + lastWin.coins * 2; snd.coin(); } wDouble.style.display = 'none'; };
wGrid.onclick = () => shareGrid();
wGarden.onclick = () => { winC.classList.add('hc-hidden'); state = 'ready'; showPlayHud(false); openGarden(); };
lMore.onclick = async () => {
  lMore.disabled = true;
  if (await M.rewarded('moves', { what: '5 more berries for this level' })) {
    usedRevive++; loseC.classList.add('hc-hidden'); shotsLeft += 5; state = 'play'; recorded = false; hudLevel(); toast('+5 berries'); snd.boost();
  }
  lMore.disabled = false;
};
lHome.onclick = () => { if (!isDaily && levelN >= 6) M.useLife(); goTitle(); };

function recordRun(won) {
  if (recorded) return; recorded = true;
  F.level(won, total ? freed / total : 0);
}
async function winLevel() {
  state = 'won'; busy = true; recordRun(true);
  // leftover berries fly back to the basket as a bonus
  const left = shotsLeft, stars = starsFor(left, L.shots, L.hard);
  if (left > 0) { score += left * 40; fx.texts.push({ x: 0, y: LAUNCH_Y + 1.6, t: 0, s: `+${left * 40} berry bonus` }); }
  const ms = performance.now() - runT0;
  st.chicks += total;
  let coins = 10 + stars * 5;
  if (isDaily) {
    coins = 60; const dl = st.dly, today = dayNum();
    if (dl.last !== today) {
      const gap = today - dl.last, wk = weekOf(today);
      if (gap === 1) dl.streak++; else if (gap === 2 && dl.freezeWeek !== wk) { dl.streak++; dl.freezeWeek = wk; toast('Streak freeze used', 1600); } else dl.streak = 1;
      dl.last = today; dl.wins = (dl.wins || 0) + 1;
    }
    dl.best = Math.max(dl.best || 0, score);
  } else {
    const prev = st.best[levelN] || 0; if (stars > prev) { st.stars += stars - prev; st.starsAll += stars - prev; st.best[levelN] = stars; }
    st.level = levelN + 1;
  }
  const newStamps = checkStamps();
  save();
  B.submit(stars, { ms });
  D.won(score, isDaily ? 'solved the daily puzzle with' : 'scored');
  M.add(coins, 'win');
  lastWin = { stars, coins, score, daily: isDaily, ms, used: L.shots - left + usedRevive * 0 };
  snd.win(); burstConfetti();
  await wait(BOT ? 400 : 900);
  // card
  wLvl.textContent = isDaily ? `Daily puzzle · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : `Level ${levelN}`;
  wH.textContent = total > 1 ? 'Chicks rescued!' : 'Chick rescued!';
  wLine.querySelector('.c').textContent = '+' + coins;
  wLine.querySelector('.sc').textContent = `Score ${score.toLocaleString()}`;
  const gT = nextTask();
  wX.textContent = isDaily ? `${st.dly.streak}-day daily streak` + (st.dly.freezeWeek === weekOf(dayNum()) ? '' : ' · 1 freeze ready') :
    newStamps.length ? `New stamp for your album: ${newStamps[0].name}` : gT ? `${st.stars} of ${gT.cost} stars for the ${gT.name.toLowerCase()}` : 'The garden is fully restored';
  wDouble.style.display = ''; wDouble.disabled = false;
  const gardenReady = !isDaily && gT && st.stars >= gT.cost;
  wGrid.style.display = isDaily ? '' : 'none'; if (kitShare) kitShare.style.display = isDaily || gardenReady ? 'none' : '';
  wGarden.style.display = gardenReady ? '' : 'none';
  setTimeout(() => { if (state === 'won') winC.classList.remove('hc-hidden'); }, 650);
  wStars.querySelectorAll('img').forEach(i => i.classList.remove('in'));
  setTimeout(() => wStars.querySelectorAll('img').forEach((im, i) => { if (i < stars) setTimeout(() => { im.classList.add('in'); snd.star(i); }, i * 260); else { im.style.opacity = .3; im.style.filter = 'grayscale(1)'; im.style.transform = 'scale(.8)'; } }), 700);
  wStars.querySelectorAll('img').forEach((im, i) => { if (i < stars) { im.style.opacity = ''; im.style.filter = ''; im.style.transform = ''; } });
  showPlayHud(false); busy = false;
}
async function loseLevel(why) {
  state = 'lost'; busy = true; recordRun(false);
  snd.lose();
  lH.textContent = why === 'full' ? 'The hedge is full' : 'Out of berries';
  lX.textContent = `${total - freed} ${total - freed === 1 ? 'chick is' : 'chicks are'} still waiting in the hedge.`;
  lMore.style.visibility = 'hidden';
  ui.lose(lH.textContent, lX.textContent);
  // the revive offer comes after 1.2 s (the app may show its own card first), and only for running out of berries
  setTimeout(() => { if (state === 'lost' && why !== 'full' && usedRevive < 2) lMore.style.visibility = 'visible'; }, 1250);
  busy = false;
}

// ---------------------------------------------------------------- shooting
const LAUNCH = { x: 0, y: LAUNCH_Y }, NEXT = { x: -2.05, y: LAUNCH_Y - 0.25 };
function angleTo(mx, my) {
  const x = (mx - CX) / U, y = (CEIL - my) / U; let a = Math.atan2(y - LAUNCH.y, x - LAUNCH.x);
  return a;
}
const okAngle = a => a > 0.17 && a < Math.PI - 0.17;
const clampA = a => Math.max(0.17, Math.min(Math.PI - 0.17, a < -Math.PI / 2 ? Math.PI - 0.17 : a < 0 ? 0.17 : a));
function shotKind() { return special === 'acorn' ? { acorn: true } : special === 'pearl' ? { pearl: true } : { color: cur }; }
function fire(a) {
  if (state !== 'play' || busy || shotsLeft <= 0) return;
  a = clampA(a); busy = true; aiming = false; hintA = null; hintUntil = 0;
  const tr = grid.trace(LAUNCH.x, LAUNCH.y, a), kind = shotKind();
  if (!special) shotsLeft--;
  fx.fly = { pts: tr.pts, kind, t: 0, seg: 0, cell: tr.cell, bounces: 0 };
  fx.robinT = 1; snd.shoot(); hudLevel();
}
function swap() {
  if (state !== 'play' || busy || special) return;
  [cur, nxt] = [nxt, cur]; fx.swapT = 0; snd.swap();
}
function landed() {
  const f = fx.fly; fx.fly = null;
  let [r, c] = f.cell; if (grid.get(r, c)) { const p = cellPos(r, c); [r, c] = grid.snap(p.x, p.y - 0.3); }
  const res = grid.land(r, c, f.kind);
  const usedSpecial = special; if (special) { st.boosts[special] = Math.max(0, (st.boosts[special] || 0) - 1); special = null; save(); }
  const lp = cellPos(r, c);
  let gotChick = 0;
  if (res.popped.length) {
    res.popped.sort((a, b) => (a.r - r) ** 2 + (a.c - c) ** 2 - ((b.r - r) ** 2 + (b.c - c) ** 2));
    res.popped.forEach((v, i) => { fx.pops.push({ v, t: -i * 0.045 }); score += 10; if (v.chick >= 0) { gotChick++; freeChick(v, i * 0.045); } });
    res.dropped.forEach((v, i) => { const p = cellPos(v.r, v.c); fx.falls.push({ v, x: p.x, y: p.y, vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 2, rot: 0, vr: (Math.random() - 0.5) * 5, t: 0, i }); score += 20 + i * 5; if (v.chick >= 0) { gotChick++; freeChick(v, 0.25 + i * 0.02); } });
    const n = res.popped.length + res.dropped.length;
    for (let i = 0; i < Math.min(6, res.popped.length); i++) setTimeout(() => snd.pop(i), i * 55);
    if (res.dropped.length) setTimeout(() => snd.drop(res.dropped.length), 200);
    fx.texts.push({ x: lp.x, y: lp.y, t: 0, s: '+' + (res.popped.length * 10 + res.dropped.reduce((a, _, i) => a + 20 + i * 5, 0)) });
    if (n >= 12) toastSoon(n >= 20 ? 'Splendid!' : 'Lovely!');
    if (usedSpecial === 'acorn') { fx.shake = 0.35; snd.thud(); }
    shotLog.push(gotChick ? 2 : 1);
  } else { snd.stick(); fx.pops.push({ v: res.placed, t: 0, settle: true }); shotLog.push(0); }
  // the next berry: keep only colours still in the hedge
  const cols = grid.colours();
  cur = cols.has(nxt) ? nxt : nextBerry(grid, rnd); nxt = nextBerry(grid, rnd);
  if (!cols.size) { cur = 0; nxt = 0; }
  hudLevel();
  const wait0 = res.popped.length ? 420 + res.popped.length * 45 : 120;
  setTimeout(() => {
    busy = false;
    if (state !== 'play') return;
    if (grid.chicks() === 0) { setTimeout(() => winLevel(), 500); busy = true; return; }
    if (grid.lowest() >= DEAD) {    // too low: the berries below the line fall off the branch (no fail, no points)
      for (const v of grid.cells()) if (v.r >= DEAD - 1 && v.chick < 0) { const p = cellPos(v.r, v.c); grid.del(v.r, v.c); fx.falls.push({ v, x: p.x, y: p.y, vx: (Math.random() - 0.5) * 2, vy: 1, rot: 0, vr: (Math.random() - 0.5) * 4, t: 0, i: 0 }); }
      for (const v of grid.loose()) { const p = cellPos(v.r, v.c); grid.del(v.r, v.c); fx.falls.push({ v, x: p.x, y: p.y, vx: 0, vy: 1, rot: 0, vr: 1, t: 0, i: 0 }); }
      toast('Too heavy! The low berries fell', 1500); snd.drop(3);
    }
    if (shotsLeft <= 0) { busy = true; setTimeout(() => { busy = false; if (state === 'play' && grid.chicks() > 0) loseLevel('shots'); }, 700); }
  }, wait0);
}
let toastQ = 0; function toastSoon(t) { clearTimeout(toastQ); toastQ = setTimeout(() => toast(t, 1000), 250); }
function freeChick(v, delay) {
  const p = cellPos(v.r, v.c);
  fx.birds.push({ sp: v.chick, x0: p.x, y0: p.y, t: -delay, dur: 1.15 + Math.random() * 0.2 });
}
function nestPoint() { const r = H.nest.querySelector('img').getBoundingClientRect(); return { X: r.left + r.width / 2, Y: r.top + r.height * 0.45 }; }

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// Robin swings the aim line over and flicks one berry into its colour group (never one that frees a chick); the berry is given back
let demoA = null, demoT = 0;
demo(() => {
  if (fx.fly) return false;
  const now = performance.now();
  if (demoA === null) {
    let best = null;
    for (let deg = 20; deg <= 160; deg += 1.5) {
      const a = deg * Math.PI / 180, tr = grid.trace(LAUNCH.x, LAUNCH.y, a), [r, c] = tr.cell; if (grid.get(r, c)) continue;
      const res = grid.clone().land(r, c, { color: cur }), all = [...res.popped, ...res.dropped];
      if (all.some(v => v.chick >= 0)) continue;
      const v = all.length - tr.bounces * 0.5; if (!best || v > best.v) best = { v, a };
    }
    if (!best) return false;
    demoA = best.a; demoT = now; aiming = true; aimOk = true; aimA = Math.PI / 2; return;
  }
  const k = Math.min(1, (now - demoT) / 650); aimA = Math.PI / 2 + (demoA - Math.PI / 2) * (k * k * (3 - 2 * k)); aiming = true; aimOk = true;
  if (k >= 1) { fire(demoA); demoA = null; if (fx.fly) { shotsLeft++; hudLevel(); } return false; }
}, { ready: () => state === 'play' && levelN === 1 && !isDaily && !special && (demoA !== null || (!busy && !fx.fly && !aiming && grid && shotsLeft > 1)), wait: 1800, every: 120, max: 12 });

// pointer: drag to aim, let go to flick; tap the next berry (or the current one) to swap
let downOn = null;
cv.addEventListener('pointerdown', e => {
  snd.unlock();
  if (state !== 'play') return;
  const x = (e.clientX - CX) / U, y = (CEIL - e.clientY) / U;
  if (Math.hypot(x - NEXT.x, y - NEXT.y) < 0.95 || Math.hypot(x - LAUNCH.x, y - LAUNCH.y) < 0.8) { downOn = 'swap'; return; }
  if (busy) return;
  downOn = 'aim'; aiming = true; aimA = angleTo(e.clientX, e.clientY); aimOk = e.clientY < LPX - U * 0.5;
});
addEventListener('pointermove', e => {
  if (downOn !== 'aim' || !aiming) return;
  const a = angleTo(e.clientX, e.clientY); if (Math.abs(a - aimA) > 0.03) snd.aim(); aimA = a; aimOk = e.clientY < LPX - U * 0.5;
});
addEventListener('pointerup', e => {
  if (downOn === 'swap') { downOn = null; const x = (e.clientX - CX) / U, y = (CEIL - e.clientY) / U; if (Math.hypot(x - NEXT.x, y - NEXT.y) < 1.1 || Math.hypot(x - LAUNCH.x, y - LAUNCH.y) < 1) swap(); return; }
  if (downOn !== 'aim') return; downOn = null;
  if (aiming && aimOk && state === 'play' && !busy) fire(aimA);
  aiming = false;
});
addEventListener('pointercancel', () => { downOn = null; aiming = false; });

// boosters + hint
for (const t of H.tools) { stop(t); t.onclick = () => useTool(t.dataset.b); }
async function useTool(k) {
  if (state !== 'play' || busy) return; snd.unlock();
  if (k === 'hint') {
    if (hintUntil > performance.now()) return;
    let ok = M.spend(PRICE.hint, 'hint');
    if (!ok) ok = await M.rewarded('hint', { what: 'one hint: Robin shows you a good shot' });
    if (!ok) return;
    const b = bestShot(grid, [shotKind()], { step: 1 });
    if (b) { hintA = b.a; hintUntil = performance.now() + 4000; snd.boost(); toolsHud(); setTimeout(toolsHud, 4100); }
    return;
  }
  if (special === k) { special = null; toolsHud(); snd.tap(); return; }       // tap again to put it back
  if ((st.boosts[k] || 0) <= 0) {
    if (M.spend(PRICE[k], k)) { st.boosts[k] = 1; save(); toast(`${k === 'acorn' ? 'Acorn' : 'Pearl'} for ${PRICE[k]} coins`); }
    else { M.shop(); return; }
  }
  special = k; snd.boost(); toolsHud();
  toast(k === 'acorn' ? 'Acorn: bursts all around it' : 'Pearl: matches any colour', 1400);
}
H.home.onclick = () => {
  if (state === 'play') { snd.tap(); if (!isDaily && levelN >= 6 && shotsLeft < L.shots) M.useLife(); recordRun(false); }
  goTitle();
};

// ---------------------------------------------------------------- effects
const PETAL = ['#e7a1b0', '#f4d58a', '#b9cf8f', '#f7efe0', '#c9b3d9', '#9fb7dd'];
function petals(x, y, color, n = 7) {
  if (RM) n = 2;
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.4;
    fx.petals.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 1.5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, life: 1, max: 0.9 + Math.random() * 0.6, c: i % 3 === 0 ? PETAL[(Math.random() * 6) | 0] : color, s: 0.12 + Math.random() * 0.1 }); }
}
function burstConfetti() { const n = RM ? 10 : 46; for (let i = 0; i < n; i++) petals((Math.random() - 0.5) * 8, -2 - Math.random() * 4, PETAL[i % PETAL.length], 1); }

// ---------------------------------------------------------------- drawing
const MARKS = {
  heart(c, s) { c.beginPath(); c.moveTo(0, s * 0.75); c.bezierCurveTo(-s * 1.25, -s * 0.1, -s * 0.55, -s * 1.05, 0, -s * 0.4); c.bezierCurveTo(s * 0.55, -s * 1.05, s * 1.25, -s * 0.1, 0, s * 0.75); c.fill(); },
  drop(c, s) { c.beginPath(); c.moveTo(0, -s * 0.95); c.bezierCurveTo(s * 0.3, -s * 0.45, s * 0.75, 0, s * 0.72, s * 0.3); c.arc(0, s * 0.3, s * 0.72, 0, Math.PI); c.bezierCurveTo(-s * 0.75, 0, -s * 0.3, -s * 0.45, 0, -s * 0.95); c.fill(); },
  star(c, s) { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i & 1 ? s * 0.42 : s * 0.95, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); },
  leaf(c, s) { c.beginPath(); c.moveTo(0, -s * 0.9); c.lineTo(s * 0.9, s * 0.7); c.lineTo(-s * 0.9, s * 0.7); c.closePath(); c.fill(); },
  diamond(c, s) { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.72, 0); c.lineTo(0, s); c.lineTo(-s * 0.72, 0); c.closePath(); c.fill(); },
  square(c, s) { const k = s * 0.7; c.beginPath(); c.roundRect ? c.roundRect(-k, -k, 2 * k, 2 * k, k * 0.25) : c.rect(-k, -k, 2 * k, 2 * k); c.fill(); },
};
function drawMark(c, color, x, y, r) {
  const b = BERRIES[color]; if (!b) return;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(250,246,236,.95)'; c.strokeStyle = 'rgba(31,45,84,.55)'; c.lineWidth = Math.max(1, r * 0.09);
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#1F2D54'; MARKS[b.mark](c, r * 0.62); c.restore();
}
function drawBerry(c, color, x, y, d, { alpha = 1, scale = 1, marks = st.opts.marks, rot = 0 } = {}) {
  const im = img('bubble/' + (BERRIES[color] || BERRIES[0]).id); if (!im) return;
  const s = d * scale; c.save(); c.globalAlpha = alpha; c.translate(x, y); if (rot) c.rotate(rot);
  c.drawImage(im, -s / 2, -s / 2, s, s);
  if (marks && scale > 0.6) drawMark(c, color, s * 0.27, s * 0.27, s * 0.2);
  c.restore();
}
function drawSpecial(c, kind, x, y, d) {
  const im = img(kind === 'acorn' ? 'bubble/acorn-bomb' : 'bubble/pearl-rainbow'); if (im) c.drawImage(im, x - d / 2, y - d / 2, d, d);
}
function drawCell(c, v, X, Y, d, t, extra = {}) {
  if (v.bramble) {
    const im = img('bubble/bramble-thick'); c.save(); c.translate(X, Y); c.beginPath(); c.arc(0, 0, d * 0.5, 0, Math.PI * 2); c.closePath();
    c.fillStyle = '#5b4a3a'; c.fill(); c.clip(); if (im) c.drawImage(im, -d * 0.62, -d * 0.62, d * 1.24, d * 1.24); c.restore();
    c.save(); c.strokeStyle = 'rgba(60,40,30,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y, d * 0.49, 0, Math.PI * 2); c.stroke(); c.restore(); return;
  }
  if (v.color === -2) { drawSpecial(c, 'acorn', X, Y, d); return; }
  if (v.chick >= 0) {
    const b = BERRIES[v.color]; c.save(); c.translate(X, Y);
    const g = c.createRadialGradient(-d * 0.15, -d * 0.18, d * 0.05, 0, 0, d * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.7, hexA(b.ink, 0.22)); g.addColorStop(1, hexA(b.ink, 0.45));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, d * 0.5, 0, Math.PI * 2); c.fill();
    c.lineWidth = Math.max(2, d * 0.07); c.strokeStyle = b.ink; c.stroke();
    const im = img('bubble/' + CHICKS[v.chick].id), br = Math.sin(t * 2.2 + v.r + v.c) * 0.03;
    if (im) { const s = d * (0.98 + br); c.drawImage(im, -s / 2, -s / 2 - d * 0.02, s, s * im.height / im.width); }
    // a glint so it reads as a dewdrop
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-d * 0.22, -d * 0.27, d * 0.09, d * 0.05, -0.6, 0, Math.PI * 2); c.fill();
    c.restore();
    if (st.opts.marks) drawMark(c, v.color, X + d * 0.3, Y + d * 0.3, d * 0.2);
    return;
  }
  drawBerry(c, v.color, X, Y, d * 1.04, extra);
}
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

let bgCache = null, bgKey = '';
function drawBackground(c, panel) {
  const k = `${VW}x${VH}x${DPR}x${panel ? 1 : 0}`, im = img(wide ? 'bg/robins-rescue-wide' : 'bg/robins-rescue') || img('bg/robins-rescue');
  if (!im) { c.fillStyle = '#F4EEE0'; c.fillRect(0, 0, VW, VH); return; }
  if (bgKey !== k + im.src) {
    bgCache = document.createElement('canvas'); bgCache.width = cv.width; bgCache.height = cv.height; const b = bgCache.getContext('2d');
    b.scale(DPR, DPR); const s = Math.max(VW / im.width, VH / im.height), w = im.width * s, h = im.height * s;
    b.drawImage(im, (VW - w) / 2, (VH - h) * (wide ? 0.5 : 0.4), w, h);
    if (panel) {
    // board panel: cream paper behind the hedge so berries read clearly over the painting
    const x0 = px(-GW / 2) - 10, x1 = px(GW / 2) + 10, y0 = CEIL - 12, y1 = LPX + U * 1.2;
    b.save(); b.shadowColor = 'rgba(31,45,84,.18)'; b.shadowBlur = 24; b.shadowOffsetY = 6;
    rr(b, x0, y0, x1 - x0, y1 - y0, 22); const pg = b.createLinearGradient(0, y0, 0, y1); pg.addColorStop(0, 'rgba(250,246,236,.86)'); pg.addColorStop(0.55, 'rgba(250,246,236,.74)'); pg.addColorStop(1, 'rgba(250,246,236,.5)'); b.fillStyle = pg; b.fill(); b.restore();
    const pap = img('kit/paper'); if (pap) { b.save(); rr(b, x0, y0, x1 - x0, y1 - y0, 22); b.clip(); b.globalAlpha = 0.25; const pat = b.createPattern(pap, 'repeat'); b.fillStyle = pat; b.fillRect(x0, y0, x1 - x0, y1 - y0); b.restore(); }
    b.lineWidth = 2; b.strokeStyle = '#cdb27a'; rr(b, x0, y0, x1 - x0, y1 - y0, 22); b.stroke();
    b.lineWidth = 1; b.strokeStyle = 'rgba(205,178,122,.7)'; rr(b, x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12, 17); b.stroke();
    // a branch for the ceiling, with sprigs
    b.save(); b.strokeStyle = '#7a5b3d'; b.lineCap = 'round'; b.lineWidth = Math.max(3, U * 0.12);
    b.beginPath(); b.moveTo(x0 + 10, CEIL - 3); b.bezierCurveTo(x0 + (x1 - x0) * 0.3, CEIL + 4, x0 + (x1 - x0) * 0.6, CEIL - 8, x1 - 10, CEIL - 1); b.stroke(); b.restore();
    const sp = img('kit/sprig'); if (sp) for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, X = x0 + 16 + (x1 - x0 - 32) * t, s = U * 0.9; b.save(); b.translate(X, CEIL - 4); b.rotate((i & 1 ? 1 : -1) * 1.9 + (i & 1 ? 0.3 : -0.3)); b.globalAlpha = 0.9; b.drawImage(sp, -s * 0.32, -s, s * 0.64, s); b.restore(); }
    const gar = img('kit/garland'); if (gar) { const w2 = Math.min(U * 5.5, 260), h2 = w2 * gar.height / gar.width; b.drawImage(gar, CX - w2 / 2, CEIL - h2 * 0.55, w2, h2); }
    // the robin's twig under the launcher
    b.save(); b.strokeStyle = '#7a5b3d'; b.lineCap = 'round'; b.lineWidth = Math.max(3, U * 0.13);
    b.beginPath(); b.moveTo(px(1.1), py(LAUNCH_Y - 0.95)); b.quadraticCurveTo(px(2.6), py(LAUNCH_Y - 0.75), px(4.3), py(LAUNCH_Y - 0.95)); b.stroke(); b.restore();
    }
    bgKey = k + im.src;
  }
  c.drawImage(bgCache, 0, 0, VW, VH);
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

function drawAim(c, a, t, ghost = false) {
  const tr = grid.trace(LAUNCH.x, LAUNCH.y, a), pts = tr.pts;
  const col = special ? '#B08834' : BERRIES[cur].ink;
  // walk the polyline, dropping a dot every 0.42 units
  let carry = (t * 1.4) % 0.42; c.save();
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i], L0 = Math.hypot(p1.x - p0.x, p1.y - p0.y); let d = 0.42 - carry;
    while (d < L0) { const k = d / L0, x = p0.x + (p1.x - p0.x) * k, y = p0.y + (p1.y - p0.y) * k;
      const fromStart = Math.hypot(x - LAUNCH.x, y - LAUNCH.y); if (fromStart > 0.8) {
        c.globalAlpha = ghost ? 0.85 : 0.95; c.fillStyle = '#FAF6EC'; c.beginPath(); c.arc(px(x), py(y), U * 0.12, 0, Math.PI * 2); c.fill();
        c.fillStyle = col; c.beginPath(); c.arc(px(x), py(y), U * 0.085, 0, Math.PI * 2); c.fill(); }
      d += 0.42; }
    carry = 0.42 - (d - L0);
  }
  const [r, cc] = tr.cell, p = cellPos(r, cc);
  c.globalAlpha = 0.9; c.setLineDash([U * 0.12, U * 0.09]); c.lineWidth = Math.max(2, U * 0.06); c.strokeStyle = col;
  c.beginPath(); c.arc(px(p.x), py(p.y), U * 0.46, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  c.globalAlpha = 0.2; c.fillStyle = col; c.fill(); c.restore();
}

let lastT = performance.now(), T = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; T += dt;
  update(dt); render();
  requestAnimationFrame(frame);
}
function update(dt) {
  // flying berry
  const f = fx.fly;
  if (f) {
    let move = 26 * dt;
    while (move > 0 && fx.fly) {
      const a = f.pts[f.seg], b = f.pts[f.seg + 1]; if (!b) { landed(); break; }
      const L0 = Math.hypot(b.x - a.x, b.y - a.y), left = L0 * (1 - f.t);
      if (move >= left) { move -= left; f.seg++; f.t = 0; if (f.seg < f.pts.length - 1) snd.bounce(); }
      else { f.t += move / Math.max(1e-6, L0); move = 0; }
    }
  }
  for (const p of fx.pops) p.t += dt;
  fx.pops = fx.pops.filter(p => p.t < (p.settle ? 0.25 : 0.3));
  for (const p of fx.pops) if (!p.settle && p.t >= 0 && !p.burst) { p.burst = true; const q = cellPos(p.v.r, p.v.c); petals(q.x, q.y, p.v.color >= 0 ? BERRIES[p.v.color].ink : '#8a6a44'); }
  for (const b of fx.falls) { b.t += dt; b.vy -= 22 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (Math.abs(b.x) > XWALL) { b.x = Math.sign(b.x) * XWALL; b.vx *= -0.5; } }
  fx.falls = fx.falls.filter(b => b.y > LAUNCH_Y - 3);
  for (const p of fx.petals) { p.life -= dt / p.max; p.vy -= 3.2 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
  fx.petals = fx.petals.filter(p => p.life > 0);
  for (const t of fx.texts) t.t += dt; fx.texts = fx.texts.filter(t => t.t < 1.1);
  for (const b of fx.birds) { const was = b.t; b.t += dt; if (was < b.dur && b.t >= b.dur) { freed++; hudLevel(); H.nest.classList.remove('bump'); void H.nest.offsetWidth; H.nest.classList.add('bump'); snd.freed(); } if (was < 0 && b.t >= 0) snd.freed(); }
  fx.birds = fx.birds.filter(b => b.t < b.dur + 0.05);
  fx.swapT = Math.min(1, fx.swapT + dt * 6); fx.robinT = Math.max(0, fx.robinT - dt * 3); fx.shake = Math.max(0, fx.shake - dt);
}
function render() {
  const c = cx2; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const inLevel = !!grid && state !== 'ready';
  drawBackground(c, inLevel);
  if (!inLevel) return;
  c.save();
  if (fx.shake > 0) c.translate((Math.random() - 0.5) * fx.shake * 10, (Math.random() - 0.5) * fx.shake * 6);
  const d = U;
  // danger line, only once the hedge hangs low
  if (grid.lowest() >= DEAD - 3) { const y = py(-0.5 - DEAD * RH + 0.5); c.save(); c.strokeStyle = 'rgba(176,74,92,.55)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.beginPath(); c.moveTo(px(-GW / 2), y); c.lineTo(px(GW / 2), y); c.stroke(); c.restore(); }
  // aim line
  if (state === 'play' && !busy && !fx.fly) {
    if (aiming && aimOk) drawAim(c, clampA(aimA), T);
    else if (hintA != null && hintUntil > performance.now()) drawAim(c, hintA, T, true);
  }
  // shadows then berries
  c.fillStyle = 'rgba(31,45,84,.12)';
  for (const v of grid.m.values()) { const p = cellPos(v.r, v.c); c.beginPath(); c.ellipse(px(p.x) + d * 0.05, py(p.y) + d * 0.1, d * 0.46, d * 0.42, 0, 0, Math.PI * 2); c.fill(); }
  const popping = new Set(fx.pops.filter(p => p.settle).map(p => p.v));
  for (const v of grid.m.values()) {
    const p = cellPos(v.r, v.c); let sc = 1;
    if (popping.has(v)) { const pp = fx.pops.find(q => q.v === v); sc = 1 + Math.sin(Math.min(1, pp.t / 0.25) * Math.PI) * 0.12; }
    drawCell(c, v, px(p.x), py(p.y), d * sc, T);
  }
  for (const p of fx.pops) { if (p.settle || p.t < 0) { if (!p.settle && p.t < 0) { const q = cellPos(p.v.r, p.v.c); drawCell(c, p.v, px(q.x), py(q.y), d, T); } continue; }
    const k = p.t / 0.3, q = cellPos(p.v.r, p.v.c);
    if (p.v.chick >= 0) continue;
    if (p.v.color >= 0) drawBerry(c, p.v.color, px(q.x), py(q.y), d * 1.04, { alpha: 1 - k, scale: 1 + k * 0.4, marks: false });
    else if (p.v.color === -2) drawSpecial(c, 'acorn', px(q.x), py(q.y), d * (1 + k));
  }
  for (const b of fx.falls) { const a = Math.max(0, Math.min(1, (b.y - (LAUNCH_Y - 3)) / 2)); if (b.v.chick >= 0) continue; c.save(); c.globalAlpha = a; drawCell(c, b.v, px(b.x), py(b.y), d, T, { rot: b.rot }); c.restore(); }
  // flying shot
  if (fx.fly) { const f = fx.fly, a = f.pts[f.seg], b = f.pts[f.seg + 1] || a, x = a.x + (b.x - a.x) * f.t, y = a.y + (b.y - a.y) * f.t;
    if (f.kind.acorn || f.kind.pearl) drawSpecial(c, f.kind.acorn ? 'acorn' : 'pearl', px(x), py(y), d * 1.04); else drawBerry(c, f.kind.color, px(x), py(y), d * 1.04); }
  // launcher: ivory cradle, current berry, next berry, robin
  const cradle = img('kit/round-ivory'), LX = px(LAUNCH.x), LY = py(LAUNCH.y), NX = px(NEXT.x), NY = py(NEXT.y);
  if (cradle) { c.save(); c.shadowColor = 'rgba(31,45,84,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 3; c.drawImage(cradle, LX - d * 0.78, LY - d * 0.78, d * 1.56, d * 1.56); c.drawImage(cradle, NX - d * 0.55, NY - d * 0.55, d * 1.1, d * 1.1); c.restore(); }
  if (state === 'play' && !fx.fly && shotsLeft > 0) {
    const k = fx.swapT, e = 1 - Math.pow(1 - k, 3);
    const cx0 = NX + (LX - NX) * e, cy0 = NY + (LY - NY) * e - Math.sin(e * Math.PI) * d * 0.6;
    if (special) drawSpecial(c, special, LX, LY, d * 1.04 * (1 + Math.sin(T * 4) * 0.04));
    else drawBerry(c, cur, cx0, cy0, d * 1.04);
    if (shotsLeft > 1 || special) drawBerry(c, nxt, LX + (NX - LX) * e, LY + (NY - LY) * e, d * 0.78);
  } else if (state === 'play' && fx.fly && shotsLeft > 0 && !special) drawBerry(c, nxt, NX, NY, d * 0.78);
  // swap arrows hint under the next berry
  if (state === 'play') { c.save(); c.strokeStyle = 'rgba(31,45,84,.55)'; c.lineWidth = 2; c.beginPath(); c.arc((LX + NX) / 2, LY + d * 0.15, d * 0.95, Math.PI * 0.25, Math.PI * 0.75); c.stroke();
    const ax = (LX + NX) / 2 + Math.cos(Math.PI * 0.25) * d * 0.95, ay = LY + d * 0.15 + Math.sin(Math.PI * 0.25) * d * 0.95; c.fillStyle = 'rgba(31,45,84,.55)'; c.beginPath(); c.moveTo(ax + 5, ay - 6); c.lineTo(ax + 3, ay + 4); c.lineTo(ax - 6, ay - 1); c.fill(); c.restore(); }
  const rob = img('bubble/robin');
  if (rob) { const h = d * 2.5, w = h * rob.width / rob.height, bob = Math.sin(T * 2) * 0.03 * d, fl = fx.robinT;
    c.save(); c.translate(px(2.55), py(LAUNCH_Y - 0.95) + bob + d * 0.05); c.rotate(-0.08 - fl * 0.18); c.scale(-1, 1);
    c.drawImage(rob, -w * 0.45, -h * 0.98 - fl * d * 0.15, w, h); c.restore(); }
  // petals + texts
  for (const p of fx.petals) { c.save(); c.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); c.translate(px(p.x), py(p.y)); c.rotate(p.r); c.fillStyle = p.c; c.beginPath(); c.ellipse(0, 0, U * p.s, U * p.s * 0.55, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const t of fx.texts) { const a = 1 - t.t / 1.1; c.save(); c.globalAlpha = a; c.font = `700 ${Math.round(26 * (st.opts.big ? 1.15 : 1))}px 'Cormorant Garamond', Georgia, serif`;
    c.lineWidth = 4; c.strokeStyle = 'rgba(250,246,236,.95)'; const X = px(t.x), Y = py(t.y) - t.t * 40; c.strokeText(t.s, X, Y); c.fillStyle = '#B08834'; c.fillText(t.s, X, Y); c.restore(); }
  c.restore();
  // freed chicks fly to the nest (screen space)
  if (fx.birds.length) { const n = nestPoint();
    for (const b of fx.birds) { if (b.t < 0) continue; const k = Math.min(1, b.t / b.dur), e = k * k * (3 - 2 * k), X0 = px(b.x0), Y0 = py(b.y0);
      const X = X0 + (n.X - X0) * e, Y = Y0 + (n.Y - Y0) * e - Math.sin(e * Math.PI) * 90; const im = img('bubble/' + CHICKS[b.sp].id); if (!im) continue;
      const s = d * (1.1 - 0.45 * e), flap = 1 + Math.sin(b.t * 30) * 0.12; c.save(); c.translate(X, Y); c.scale(n.X < X0 ? -1 : 1, flap); c.drawImage(im, -s / 2, -s / 2, s, s * im.height / im.width); c.restore(); } }
}

// ---------------------------------------------------------------- meta: the garden
const GARDEN = [
  { ch: 'The Lawn', story: 'The chicks are safe. Robin would like the lawn to feel like home again.', tasks: [
    { id: 'birdbath', name: 'Birdbath', src: 'decor/birdbath', x: .34, y: .63, w: .17, cost: 2 }, { id: 'bench', name: 'Garden bench', src: 'decor/bench', x: .64, y: .52, w: .24, cost: 2 },
    { id: 'roses', name: 'Rose bed', src: 'plants/rose-bloom', x: .2, y: .74, w: .12, cost: 3 }, { id: 'birdhouse', name: 'Birdhouse', src: 'decor/birdhouse', x: .82, y: .64, w: .11, cost: 3 }] },
  { ch: 'The Borders', story: 'Bees and butterflies are coming back. Fill the borders with colour.', tasks: [
    { id: 'lavender', name: 'Lavender', src: 'plants/lavender-bloom', x: .3, y: .8, w: .13, cost: 3 }, { id: 'foxglove', name: 'Foxgloves', src: 'plants/foxglove-bloom', x: .1, y: .5, w: .1, cost: 3 },
    { id: 'trellis', name: 'Clematis trellis', src: 'decor/trellis', x: .9, y: .46, w: .15, cost: 3 }, { id: 'lantern', name: 'Lantern', src: 'decor/lantern', x: .54, y: .74, w: .07, cost: 4 }] },
  { ch: 'The Rose Walk', story: 'An arch of roses for slow evening walks.', tasks: [
    { id: 'arch', name: 'Rose arch', src: 'decor/rose-arch', x: .5, y: .4, w: .2, cost: 3 }, { id: 'peony', name: 'Peonies', src: 'plants/peony-bloom', x: .7, y: .78, w: .11, cost: 4 },
    { id: 'urn', name: 'Stone urn', src: 'decor/urn', x: .17, y: .43, w: .12, cost: 4 }, { id: 'sundial', name: 'Sundial', src: 'decor/sundial', x: .47, y: .55, w: .13, cost: 4 }] },
  { ch: 'The Bee Garden', story: 'A hive, tall sunflowers and the gentle hum of summer.', tasks: [
    { id: 'beehive', name: 'Beehive', src: 'decor/beehive', x: .86, y: .36, w: .12, cost: 4 }, { id: 'sunflower', name: 'Sunflowers', src: 'plants/sunflower-bloom', x: .64, y: .37, w: .09, cost: 4 },
    { id: 'hydrangea', name: 'Hydrangea', src: 'plants/hydrangea-bloom', x: .42, y: .9, w: .15, cost: 4 }, { id: 'sweetpea', name: 'Sweet peas', src: 'plants/sweet-pea-bloom', x: .93, y: .6, w: .09, cost: 5 }] },
  { ch: 'The Fountain', story: 'One last wish: a fountain where every bird in the valley can drink.', tasks: [
    { id: 'fountain', name: 'Fountain', src: 'decor/fountain', x: .5, y: .69, w: .2, cost: 4 }, { id: 'barrow', name: 'Flower barrow', src: 'decor/wheelbarrow', x: .25, y: .55, w: .17, cost: 5 },
    { id: 'can', name: 'Watering can', src: 'decor/watering-can', x: .78, y: .88, w: .11, cost: 5 }, { id: 'tulips', name: 'Tulips', src: 'plants/tulip-bloom', x: .07, y: .8, w: .09, cost: 5 }] },
];
const ALLT = GARDEN.flatMap((g, ci) => g.tasks.map((t, ti) => ({ ...t, ci, ti })));
const nextTask = () => ALLT[st.garden] || null;
function openGarden() {
  const sh = $(`<div class="rr-sheet"><div class="bgimg" style="background-image:url(${A('bg/meta-garden-wide-s')});filter:blur(6px) saturate(.9);transform:scale(1.06)"></div>
    <div class="rr-garden-stage"></div>
    <div class="head"><button class="rr-ic" aria-label="Back" style="background-image:url(${A('icons/close')})"></button><h2></h2><div class="rr-gstars"><img src="${A('kit/star-full')}" alt=""><span></span></div></div>
    <div class="rr-gstory"></div><div class="rr-gtask"></div></div>`);
  document.body.appendChild(sh); stop(sh);
  const stage = sh.querySelector('.rr-garden-stage'), head = sh.querySelector('h2'), story = sh.querySelector('.rr-gstory'), task = sh.querySelector('.rr-gtask'), starsN = sh.querySelector('.rr-gstars span');
  const els = ALLT.map((t, i) => { const im = $(`<img class="it${i < st.garden ? '' : ' pending'}" src="${A(t.src)}" alt="${t.name}" style="left:${t.x * 100}%;top:${t.y * 100}%;width:${t.w * 100}%">`); stage.append(im); return im; });
  const nChick = Math.min(8, Math.floor(st.chicks / 3));
  const spots = [[.42, .62], [.6, .66], [.3, .52], [.7, .74], [.52, .78], [.58, .44], [.36, .72], [.78, .56]];
  for (let i = 0; i < nChick; i++) { const ch = $(`<img class="chick" src="${A('bubble/' + CHICKS[i % 2].id)}" alt="" style="left:${spots[i][0] * 100}%;top:${spots[i][1] * 100}%;animation-delay:${(i * 0.37) % 2.6}s">`); stage.append(ch); }
  const draw = () => {
    const t = nextTask(), g = t ? GARDEN[t.ci] : GARDEN[GARDEN.length - 1];
    head.innerHTML = t ? `<small>Chapter ${t.ci + 1}</small>${g.ch}` : 'The garden is restored';
    story.textContent = t ? g.story : 'Thank you! Every bird in the valley has a home. New levels keep coming, and the daily puzzle is waiting.';
    starsN.textContent = st.stars;
    task.innerHTML = '';
    if (!t) { const b = stop($('<button class="rr-pill" style="flex:1">Play on</button>')); b.onclick = () => { sh.remove(); goTitle(); }; task.append(b); return; }
    const can = st.stars >= t.cost;
    task.append($(`<img src="${A(t.src)}" alt="">`), $(`<div class="t"><b>${t.name}</b><span>${t.cost} stars · task ${t.ti + 1} of 4</span></div>`));
    const b = stop($(`<button class="rr-pill ${can ? '' : 'ivory'}"><img src="${A('kit/star-full')}" alt="" style="width:28px;height:28px">${can ? 'Restore' : 'Play'}</button>`));
    b.onclick = () => {
      if (!can) { sh.remove(); goTitle(); beginLevel(false); return; }
      st.stars -= t.cost; st.garden++; const el = els[st.garden - 1]; el.classList.remove('pending'); el.classList.add('pop'); snd.win();
      if (t.ti === 3) { checkStamps(); setTimeout(() => toast(`${GARDEN[t.ci].ch} restored`, 1800), 500); }
      save(); draw();
    };
    task.append(b);
  };
  draw();
  sh.querySelector('.head .rr-ic').onclick = () => { snd.tap(); sh.remove(); goTitle(); };
}

// ---------------------------------------------------------------- collection: stamp album
const STAMPS = [
  ['robin', 'Robin', { lv: 1 }], ['rose', 'Rose', { lv: 2 }], ['teapot', 'Teapot', { lv: 3 }], ['bluetit', 'Blue tit', { chicks: 12 }], ['cottage', 'Cottage', { lv: 5 }],
  ['bluebells', 'Bluebells', { lv: 8 }], ['butterfly', 'Butterfly', { garden: 1 }], ['peony', 'Peony', { lv: 11 }], ['hedgehog', 'Hedgehog', { daily: 1 }], ['lighthouse', 'Lighthouse', { lv: 14 }],
  ['cat', 'Cat', { lv: 17 }], ['sunflower', 'Sunflower', { garden: 2 }], ['hydrangea', 'Hydrangea', { lv: 20 }], ['swan', 'Swan', { daily: 3 }], ['beehive', 'Beehive', { garden: 3 }],
  ['teacup', 'Teacup', { lv: 24 }], ['fox', 'Fox', { lv: 28 }], ['lavender', 'Lavender', { chicks: 80 }], ['owl', 'Owl', { daily: 7 }], ['strawberry', 'Strawberry', { lv: 32 }],
  ['sailboat', 'Sailboat', { garden: 4 }], ['squirrel', 'Squirrel', { lv: 36 }], ['tulip', 'Tulip', { garden: 5 }], ['kingfisher', 'Kingfisher', { lv: 40 }],
].map(([id, name, need]) => ({ id, name, need }));
const needText = n => n.lv ? `Clear level ${n.lv}` : n.chicks ? `Rescue ${n.chicks} chicks` : n.daily ? `Win ${n.daily} daily puzzle${n.daily > 1 ? 's' : ''}` : `Restore garden chapter ${n.garden}`;
function checkStamps() {
  const chaptersDone = Math.floor(st.garden / 4), cleared = st.level - 1, got = [];
  for (const s of STAMPS) {
    if (st.stamps.includes(s.id)) continue; const n = s.need;
    const ok = n.lv ? cleared >= n.lv : n.chicks ? st.chicks >= n.chicks : n.daily ? (st.dly.wins || 0) >= n.daily : chaptersDone >= n.garden;
    if (ok) { st.stamps.push(s.id); got.push(s); }
  }
  return got;
}
function openAlbum() {
  st.seenStamps = st.stamps.length; save();
  const sh = $(`<div class="rr-sheet"><div class="bgimg" style="background-image:url(${A('kit/paper')});background-size:420px;background-repeat:repeat"></div>
    <div class="head"><button class="rr-ic" aria-label="Back" style="background-image:url(${A('icons/close')})"></button><h2><small>${st.stamps.length} of 24 collected</small>Stamp album</h2><div style="width:56px"></div></div>
    <div class="rr-scroll"><p class="rr-small" style="text-align:center;margin:0 0 12px">Every stamp is earned by playing: levels, chicks, daily puzzles and the garden.</p><div class="rr-stamps"></div></div></div>`);
  document.body.appendChild(sh); stop(sh);
  const grid0 = sh.querySelector('.rr-stamps');
  for (const s of STAMPS) { const have = st.stamps.includes(s.id); grid0.append($(`<div class="rr-stamp ${have ? '' : 'lock'}"><img src="${A('stamps/stamp-' + s.id)}" alt=""><span>${have ? s.name : needText(s.need)}</span></div>`)); }
  sh.querySelector('.head .rr-ic').onclick = () => { snd.tap(); sh.remove(); titleHud(); };
}

// ---------------------------------------------------------------- settings
function openSettings() {
  const sh = $(`<div class="rr-sheet"><div class="bgimg" style="background-image:url(${A('kit/paper')});background-size:420px;background-repeat:repeat"></div>
    <div class="head"><button class="rr-ic" aria-label="Back" style="background-image:url(${A('icons/close')})"></button><h2>Settings</h2><div style="width:56px"></div></div>
    <div class="rr-scroll">
      <div class="rr-set"><div><b>Larger text</b><small>Bigger words and numbers everywhere</small></div><button class="rr-tog" data-o="big" aria-label="Larger text"></button></div>
      <div class="rr-set"><div><b>Berry shapes</b><small>A small shape on every berry, so colour is never the only clue</small></div><button class="rr-tog" data-o="marks" aria-label="Berry shapes"></button></div>
      <div class="rr-set"><div><b>Sound</b><small>Harp plucks and birdsong</small></div><button class="rr-tog" data-o="sound" aria-label="Sound"></button></div>
      <div class="rr-set"><div><b>Music</b><small>A slow harp lullaby while you play</small></div><button class="rr-tog" data-o="music" aria-label="Music"></button></div>
      <div class="rr-set" style="flex-direction:column;align-items:stretch"><b>The berries</b><div class="rr-key"></div></div>
      <div class="rr-set" style="flex-direction:column;align-items:stretch"><b>How to play</b><small style="font-size:calc(19px*var(--k))">Drag above Robin to aim and let go to flick a berry. Three or more of the same berry burst, and anything left hanging falls. Free every chick before the berries run out. Tap the small berry to swap. There is no timer: take all the time you like.</small></div>
      <div style="display:flex;justify-content:center;margin:14px 0"><button class="rr-pill ivory shop"><img src="${A('icons/shop')}" alt="">The shop</button></div>
    </div></div>`);
  document.body.appendChild(sh); stop(sh);
  const val = { big: () => st.opts.big, marks: () => st.opts.marks, sound: () => !snd.muted, music: () => snd.music };
  const set = { big: v => { st.opts.big = v; document.documentElement.classList.toggle('rr-big', v); }, marks: v => { st.opts.marks = v; }, sound: v => { if (v === snd.muted) snd.toggle(); }, music: v => snd.setMusic(v) };
  for (const t of sh.querySelectorAll('.rr-tog')) { const k = t.dataset.o; t.classList.toggle('on', val[k]()); t.onclick = () => { set[k](!val[k]()); t.classList.toggle('on', val[k]()); save(); snd.tap(); }; }
  const key = sh.querySelector('.rr-key');
  BERRIES.forEach((b, i) => { const cvs = document.createElement('canvas'); cvs.width = cvs.height = 88; const k = cvs.getContext('2d'); drawBerry(k, i, 44, 44, 80, { marks: true }); const d = $(`<div></div>`); d.append(cvs, document.createTextNode(b.name)); key.append(d); });
  sh.querySelector('.shop').onclick = () => M.shop();
  sh.querySelector('.head .rr-ic').onclick = () => { snd.tap(); sh.remove(); titleHud(); };
}
function outOfLives() {
  const lv = M.lives(), mins = lv.nextAt ? Math.max(1, Math.ceil((lv.nextAt - Date.now()) / 60000)) : 20;
  const sh = $(`<div class="hc-card dim" style="z-index:21"><div class="rr-panel"><img class="roses tl" src="${A('kit/corner-roses')}" alt="">
    <img src="${A('kit/heart')}" alt="" style="width:84px"><h1 style="font-size:calc(40px*var(--k))">Time for tea</h1>
    <p>Your hearts are refilling. The next one is ready in about ${mins} minute${mins > 1 ? 's' : ''}.</p>
    <button class="rr-pill ivory vid"><img src="${A('icons/video')}" alt=""><span>Fill my hearts<small>watch a short video</small></span></button>
    <button class="rr-pill dly"><img src="${A('icons/calendar')}" alt=""><span>Play the daily puzzle</span></button>
    <button class="rr-pill ivory cl" style="min-width:160px">Close</button></div></div>`);
  document.body.appendChild(sh); stop(sh);
  sh.querySelector('.vid').onclick = async () => { if (await M.rewarded('lives')) { sh.remove(); beginLevel(false); } };
  sh.querySelector('.dly').onclick = () => { sh.remove(); beginLevel(true); };
  sh.querySelector('.cl').onclick = () => { sh.remove(); goTitle(); };
}

// ---------------------------------------------------------------- daily share grid (spoiler-free)
function shareGrid() {
  const d = new Date(), rows = [];
  const sym = ['🍃', '🫐', '🐣'];
  for (let i = 0; i < shotLog.length; i += 6) rows.push(shotLog.slice(i, i + 6).map(x => sym[x]).join(''));
  const stars = lastWin ? '⭐'.repeat(lastWin.stars) : '';
  const text = `Robin's Rescue · daily ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}\n${total} chicks home in ${shotLog.length} berries ${stars}\n${rows.join('\n')}\n🔥 ${st.dly.streak}-day streak`;
  const u = new URL(location.href); u.search = '?daily=1';
  (async () => {
    try { if (navigator.share) { await navigator.share({ title: NAME, text, url: u.href }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text + '\n' + u.href); toast('Copied to share'); } catch (e) { toast('Could not copy'); }
  })();
}

// ---------------------------------------------------------------- test hooks + bot (paced like a person)
let botPlan = null, botNext = 0;
window.__game = {
  get state() { return state; }, get level() { return levelN; }, get score() { return score; }, dbg: () => grid && JSON.stringify({ low: grid.lowest(), n: grid.size, shotsLeft }),
  bot() {
    if (state !== 'play' || busy || fx.fly) { botPlan = null; return; }
    const now = performance.now(); if (now < botNext) return;
    if (!botPlan) {
      const b = bestShot(grid, [{ color: cur }, shotsLeft > 1 ? { color: nxt } : null], { step: 1.5, noise: 0.6 });
      if (!b) return; if (b.swap) { swap(); botNext = now + 450; return; }
      botPlan = { a: b.a + (Math.random() - 0.5) * 0.012, t: now }; aiming = true; aimOk = true; aimA = Math.PI / 2; return;
    }
    const k = Math.min(1, (now - botPlan.t) / 600); aimA = Math.PI / 2 + (botPlan.a - Math.PI / 2) * (k * k * (3 - 2 * k)); aiming = true; aimOk = true;
    if (k >= 1) { fire(botPlan.a); botPlan = null; botNext = now + 750; }
  },
};

// ---------------------------------------------------------------- boot
(async () => {
  layout(); addEventListener('resize', () => { layout(); bgKey = ''; });
  await Promise.all(NEED.map(load));
  load('bg/meta-garden'); load('bg/meta-garden-wide-s');
  document.getElementById('rr-load').style.opacity = 0; setTimeout(() => document.getElementById('rr-load').remove(), 500);
  titleHud(); requestAnimationFrame(frame);
  if (Q.get('daily') === '1') { setTimeout(() => { ui.hideStart(); beginLevel(true); }, 50); }
  document.addEventListener('visibilitychange', () => snd.playMusic(!document.hidden && state === 'play' && musicWanted() && !adOn));
})();

// Pantry Sort: Jam Jar Puzzle. A calm sorting puzzle in a painted country pantry (style C, Storybook Garden).
// Tap a jar to lift its top fruit, tap another to pour it in: same fruit on same fruit, or into an empty jar. Four of a
// kind and the jar gets its gingham lid and turns to jam. Undo, hints and an extra jar; no timer, no move limit.
// Stars put Nana Rose's larder back together; wins fill a stamp album; the Daily puzzle is the same for everyone.
// Inspired by Water Sort / Ball Sort puzzles (IEC Global, et al.): mechanic only. All code ours; art from our own library.
import { money } from './kit/money.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { A, $, wait, dayNum, ymd, rng, store, injectCSS, prefs, background, sheet, sheetOpen, toast, word, fx, fxMount, flyTo, bump, buzz, audio, streak, share, album, settingsSheet, preload, reduced } from './sb.js';
import { CAP, KINDS, JAM, top, done, run, canPour, useful, pour, won, clone, moves, stuck, solve, makeLevel } from './logic.js';
import { LARDER, larderScene } from './larder.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason && (e.reason.stack || e.reason))));
const SLUG = 'pantry-sort', NAME = 'Pantry Sort', Q = new URLSearchParams(location.search);
const S = store(SLUG);
const st = {
  level: S.get('level', 1), stars: S.get('stars', 0), spent: S.get('spent', 0), larder: S.get('larder', []), wins: S.get('wins', 0),
  boosts: S.get('boosts', { hint: 3, undo: 5, jar: 2 }), dLast: S.get('dLast', 0), dRes: S.get('dRes', null), seenHow: S.get('seenHow', false),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const starsLeft = () => st.stars - st.spent;
const PRICE = { hint: 50, undo: 30, jar: 80 };
const EMO = { strawberry: '🍓', blueberry: '🫐', apricot: '🍑', lemon: '🍋', plum: '🟣', lime: '🍈', rhubarb: '🌱', honey: '🍯' };

const M = money({ game: SLUG, style: 'C' });
const F = flow(SLUG);
const D = daily(SLUG, null, { name: NAME });
const B = worldBoard({ game: 'pantry-sort', label: 'Stars earned', limits: { maxRun: 3, maxPerSec: 1.5 }, mode: 'sum', corner: 'tr', accent: '#d6b46a' });
const P = prefs(SLUG);
const STREAK = streak(S);
const ALB = album(S, { M, onChange: () => paintHome() });

injectCSS(`
.ps-layer{position:fixed;inset:0;z-index:5;pointer-events:none}.ps-layer>*{pointer-events:auto}
.ps-top{position:absolute;left:0;right:0;top:calc(10px + env(safe-area-inset-top));height:58px;display:flex;align-items:center;gap:10px;padding:0 76px 0 10px}.ps-top .sp{flex:1}
.ps-title{position:absolute;left:0;right:0;top:calc(72px + env(safe-area-inset-top));text-align:center;pointer-events:none}
.ps-title h1{margin:0;font:700 calc(62px*var(--fs))/0.9 var(--disp);color:var(--navy);text-shadow:0 2px 0 #fffaf0,0 0 18px rgba(255,250,235,.95),0 0 36px rgba(255,250,235,.9)}
.ps-title h1 i{color:var(--rose)}
.ps-title p{margin:22px 0 0;font:700 calc(17px*var(--fs))/1 var(--serif);letter-spacing:3px;color:var(--sage);text-shadow:0 0 10px #fffaf0,0 0 18px #fffaf0}
.ps-title .sprig{width:150px;display:block;margin:2px auto 0}
.ps-larder{position:fixed;z-index:2;pointer-events:none}
.ps-shelf{position:absolute;filter:drop-shadow(0 6px 6px rgba(60,50,30,.3))}
.ps-item{position:absolute;transform:translate(-50%,-100%);filter:drop-shadow(0 4px 4px rgba(60,40,20,.3))}
.ps-ghost{opacity:.4;filter:grayscale(.7) brightness(1.2);animation:psghost 1.6s ease-in-out infinite}@keyframes psghost{50%{opacity:.7}}
.ps-menu{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));width:min(430px,calc(100% - 20px));padding:16px 14px 14px;border-radius:24px;text-align:center;
  background:rgba(251,246,234,.94) url(${A('kit/paper')}) center/360px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 4px rgba(251,246,234,.95),inset 0 0 0 5.5px rgba(176,136,52,.55),0 16px 40px rgba(31,45,84,.3)}
.ps-menu .play{width:100%}.ps-menu .two{display:flex;gap:10px;margin-top:12px}.ps-menu .two .sb-btn{flex:1;padding:8px 10px}
.ps-menu .icons{display:flex;justify-content:space-around;margin-top:12px}
.ps-menu .icons label{display:flex;flex-direction:column;align-items:center;gap:2px;font:700 calc(18px*var(--fs))/1.1 var(--serif);color:var(--navy);cursor:pointer}
.ps-card{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:8px 10px 8px 8px;border-radius:16px;background:rgba(176,74,92,.07);border:1.5px solid rgba(176,74,92,.3);text-align:left;cursor:pointer}
.ps-card img{width:54px;height:54px;object-fit:contain;flex:none}.ps-card div{flex:1;font:700 calc(19px*var(--fs))/1.25 var(--serif)}.ps-card small{display:block;font-weight:400;font-size:calc(17px*var(--fs))}
.ps-card .bar{height:9px;border-radius:5px;background:rgba(31,45,84,.12);margin-top:5px;overflow:hidden}.ps-card .bar i{display:block;height:100%;background:var(--rose)}
.ps-starpill{display:inline-flex;align-items:center;gap:4px;height:50px;padding:0 14px 0 4px;border-radius:25px;background:linear-gradient(180deg,#fffdf6,#f2e7cf);border:2px solid #c6a35a;box-shadow:inset 0 0 0 2px #fffaf0,0 4px 10px rgba(31,45,84,.2);font:700 calc(21px*var(--fs))/1 var(--serif);color:var(--navy)}
.ps-starpill img{width:40px;height:40px}
.ps-story{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));width:min(430px,calc(100% - 20px));padding:14px;border-radius:22px;text-align:center;
  background:rgba(251,246,234,.95) url(${A('kit/paper')}) center/360px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 4px rgba(251,246,234,.95),inset 0 0 0 5.5px rgba(176,136,52,.55),0 16px 40px rgba(31,45,84,.3);font-size:calc(20px*var(--fs))}
.ps-story h3{margin:0 0 4px;font:700 calc(28px*var(--fs))/1.1 var(--disp)}.ps-story p{margin:0 0 10px}.ps-story .row{display:flex;gap:10px}.ps-story .row .sb-btn{flex:1}
.ps-story p.q{font-style:italic}
@media (min-aspect-ratio:1/1){.ps-menu{left:auto;right:max(24px,calc(50% - 600px));transform:translateY(50%);bottom:50%;width:400px}.ps-title{right:auto;left:max(24px,calc(50% - 600px));width:520px;top:calc(36px + env(safe-area-inset-top))}}
/* play */
.ps-goal{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 16px;border-radius:18px;min-height:70px;
  background:rgba(251,246,234,.95) url(${A('kit/paper')}) center/300px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 3px rgba(251,246,234,.95),inset 0 0 0 4.5px rgba(176,136,52,.5),0 8px 20px rgba(31,45,84,.22)}
.ps-goal .lv{font:700 calc(24px*var(--fs))/1.05 var(--disp);color:var(--navy);white-space:nowrap}.ps-goal .lv small{display:block;font:700 calc(15px*var(--fs))/1.3 var(--serif);letter-spacing:1px;color:var(--rose);text-transform:uppercase}
.ps-goal .made{display:flex;gap:2px;align-items:flex-end;flex:1;min-width:0;justify-content:center}.ps-goal .lv,.ps-goal .meter{flex:none}.ps-goal .made img{width:var(--mw,30px);flex:0 1 var(--mw,30px);min-width:0;height:36px;object-fit:contain}.ps-goal .made img.off{opacity:.22;filter:grayscale(1)}
.ps-goal .meter{text-align:right;font:700 calc(19px*var(--fs))/1.2 var(--serif);color:var(--navy);white-space:nowrap}.ps-goal .meter .st{display:flex;justify-content:flex-end}.ps-goal .meter img{width:24px;height:24px}.ps-goal .meter img.off{filter:grayscale(1);opacity:.35}
.ps-shelves{position:absolute;inset:0;pointer-events:none}
.ps-shelves .shelf{position:absolute;pointer-events:none;filter:drop-shadow(0 8px 8px rgba(60,50,30,.3))}
.ps-jar{position:absolute;cursor:pointer;pointer-events:auto;transition:transform .18s cubic-bezier(.2,1.4,.4,1)}
.ps-jar .glass{position:absolute;left:0;bottom:0;width:100%;height:100%;opacity:.42;pointer-events:none}
.ps-jar .jam{position:absolute;left:-6%;bottom:0;width:112%;pointer-events:none;filter:drop-shadow(0 5px 6px rgba(60,30,20,.3))}
.ps-jar .f{position:absolute;pointer-events:none;filter:drop-shadow(0 2px 2px rgba(60,30,10,.28));transition:transform .18s}
.ps-jar.sel{transform:translateY(-14px)}
.ps-jar.sel .f.up{transform:translateY(-22px)}
.ps-jar.sel::after,.ps-jar.hint::after,.ps-jar.hint2::after{content:'';position:absolute;inset:-6px -6px -4px;border-radius:18px;box-shadow:0 0 0 3px #e2bd5f,0 0 18px rgba(255,214,110,.85);pointer-events:none}
.ps-jar.hint::after,.ps-jar.hint2::after{box-shadow:0 0 0 3px #567854,0 0 18px rgba(86,120,84,.85);animation:oihl .8s ease-in-out infinite}
@keyframes oihl{50%{opacity:.45}}
.ps-jar.new{animation:psnew .5s cubic-bezier(.2,1.5,.4,1)}@keyframes psnew{from{transform:scale(.3);opacity:0}}
.ps-fly{position:fixed;left:0;top:0;z-index:50;pointer-events:none;filter:drop-shadow(0 8px 8px rgba(40,25,5,.3))}
.ps-boost{position:absolute;display:flex;gap:14px;justify-content:center}
.ps-boost label{display:flex;flex-direction:column;align-items:center;font:700 calc(18px*var(--fs))/1.1 var(--serif);color:var(--navy);text-shadow:0 0 6px #fffaf0,0 0 10px #fffaf0,0 0 14px #fffaf0;cursor:pointer}
.ps-boost .sb-round{width:62px;height:62px}.ps-boost .sb-round b.coin{background:#fbf3df;color:var(--navy);box-shadow:0 0 0 2px #c6a35a;font-size:15px}
.ps-tip{position:absolute;left:50%;transform:translateX(-50%);width:min(380px,calc(100% - 24px));padding:10px 14px;border-radius:16px;background:rgba(251,246,234,.96);border:2px solid #c6a35a;text-align:center;font:700 calc(19px*var(--fs))/1.3 var(--serif);color:var(--navy);box-shadow:0 8px 20px rgba(31,45,84,.22);pointer-events:none;z-index:6}
.oi-card{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;background:rgba(31,45,84,.34);animation:sbfade .3s}
.oi-card .sb-ribbon{margin:-6px auto 2px}
.oi-card .reward{display:flex;align-items:center;justify-content:center;gap:8px;font:700 calc(28px*var(--fs))/1 var(--serif);margin:4px 0}.oi-card .reward img{width:42px;height:42px}
.oi-card .stamp{display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0;font-size:calc(19px*var(--fs))}
.oi-card .stamp img{width:86px;animation:sbstamp .7s cubic-bezier(.2,1.5,.4,1) both;animation-delay:.9s;filter:drop-shadow(0 6px 8px rgba(31,45,84,.3))}
.oi-card .jams{display:flex;justify-content:center;flex-wrap:wrap;gap:2px;margin:2px 0}.oi-card .jams img{width:40px;height:48px;object-fit:contain;animation:sbstamp .5s cubic-bezier(.2,1.5,.4,1) both}
.oi-card .stack{display:flex;flex-direction:column;gap:12px;align-items:stretch;margin-top:12px}.oi-card .stack .sb-btn{width:100%}
.oi-card .lnk{background:none;border:0;font:700 calc(19px*var(--fs))/1 var(--serif);color:var(--navy);text-decoration:underline;text-underline-offset:4px;padding:14px;cursor:pointer;min-height:48px}
.ps-banner{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:40;pointer-events:none;text-align:center;animation:psbanner 1.6s ease-in-out forwards}
@keyframes psbanner{0%{opacity:0;transform:translate(-50%,-30%) scale(.8)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%)}}
`);

// ---------------------------------------------------------------- DOM
const bgEl = $('<div class="sb-bg"></div>'); document.body.appendChild(bgEl);
const BG = background(bgEl);
const LD = larderScene(document.body);
fxMount();
const coinPill = () => `<button class="sb-pill" data-shop aria-label="Coins and shop"><img src="${A('kit/coin')}" alt=""><span data-coins>0</span><span class="plus">+</span></button>`;
const home = $(`<div class="ps-layer sb-hidden">
  <div class="ps-top"><button class="sb-round" data-set aria-label="Settings"><img src="${A('icons/menu')}" alt=""></button><div class="sp"></div><div class="ps-starpill"><img src="${A('kit/star-full')}" alt=""><span data-stars>0</span></div>${coinPill()}</div>
  <div class="ps-title"><h1>Pantry <i>Sort</i></h1><p>JAM JAR PUZZLE</p><img class="sprig" src="${A('kit/divider')}" alt=""><div data-streak></div></div>
  <div class="ps-menu">
    <div class="ps-card" data-larder role="button" aria-label="Restore Nana's larder"><img data-limg alt=""><div><span data-lname>Nana Rose's Larder</span><small data-lnext></small><div class="bar"><i data-lbar></i></div></div></div>
    <button class="sb-btn navy big play" data-play></button>
    <div class="two"><button class="sb-btn" data-daily><img src="${A('icons/calendar')}" alt=""><span>Daily<small data-dsub></small></span></button><button class="sb-btn" data-album2><img src="${A('icons/album')}" alt=""><span>Album<small data-acount></small></span></button></div>
    <div class="icons"><label><button class="sb-round" data-larder2 aria-label="Larder"><img src="${A('icons/home')}" alt=""></button>Larder</label>
      <label><button class="sb-round" data-shop aria-label="Shop"><img src="${A('icons/shop')}" alt=""></button>Shop</label>
      <label><button class="sb-round" data-board aria-label="World board"><img src="${A('icons/trophy')}" alt=""></button>Board</label></div>
  </div></div>`);
const lview = $(`<div class="ps-layer sb-hidden">
  <div class="ps-top"><button class="sb-round" data-back aria-label="Back"><img src="${A('icons/home')}" alt=""></button><div class="sp"></div><div class="ps-starpill"><img src="${A('kit/star-full')}" alt=""><span data-stars>0</span></div></div>
  <div class="ps-title" style="top:calc(78px + env(safe-area-inset-top))"><div class="sb-ribbon" data-ltitle style="display:inline-grid"></div></div>
  <div class="ps-story"><h3 data-lh></h3><p data-lp></p><div class="row"><button class="sb-btn" data-back2>Back</button><button class="sb-btn rose" data-place></button></div></div></div>`);
const play = $(`<div class="ps-layer sb-hidden">
  <div class="ps-top"><button class="sb-round" data-home aria-label="Home"><img src="${A('icons/home')}" alt=""></button><button class="sb-round" data-set aria-label="Settings"><img src="${A('icons/settings')}" alt=""></button><div class="sp"></div>${coinPill()}</div>
  <div class="ps-goal"></div>
  <div class="ps-shelves"></div>
  <div class="ps-boost">
    <label><button class="sb-round" data-b="undo" aria-label="Undo"><img src="${A('icons/undo')}" alt=""><b></b></button>Undo</label>
    <label><button class="sb-round" data-b="hint" aria-label="Hint"><img src="${A('icons/hint')}" alt=""><b></b></button>Hint</label>
    <label><button class="sb-round" data-b="jar" aria-label="Extra jar"><img src="${A('icons/plus')}" alt=""><b></b></button>Extra jar</label>
    <label><button class="sb-round" data-restart aria-label="Restart"><img src="${A('icons/shuffle')}" alt=""></button>Restart</label></div></div>`);
document.body.append(home, lview, play);
const q = (r, s) => r.querySelector(s), qa = s => document.querySelectorAll(s);
const goalEl = q(play, '.ps-goal'), shelvesEl = q(play, '.ps-shelves'), boostEl = q(play, '.ps-boost');
qa('[data-shop]').forEach(b => b.onclick = () => { audio.tap(); M.shop(); });
qa('[data-set]').forEach(b => b.onclick = () => { audio.tap(); settingsSheet(P, { M, howTo: 'Tap a jar to lift its top fruit, then tap another jar to pour it in. Fruit only goes onto the same fruit, or into an empty jar. Four of a kind and the jar turns to jam. Fill every jar with one kind to finish. There is no timer and no move limit: Undo is always there.' }); });
q(home, '[data-play]').onclick = () => { audio.tap(); startGame('level'); };
q(home, '[data-daily]').onclick = () => { audio.tap(); if (st.dLast === dayNum()) dailyDoneSheet(); else startGame('daily'); };
q(home, '[data-album2]').onclick = () => { audio.tap(); ALB.open(); };
q(home, '[data-board]').onclick = () => { audio.tap(); B.open(); };
q(home, '[data-larder]').onclick = q(home, '[data-larder2]').onclick = () => { audio.tap(); openLarder(); };
q(play, '[data-home]').onclick = () => { audio.tap(); if (busy) return; leaveToHome(); };
q(play, '[data-restart]').onclick = () => { if (busy || state !== 'play') return; audio.tap(); restart(); };
qa('.ps-boost [data-b]').forEach(b => b.onclick = () => useBooster(b.dataset.b));
M.onChange(() => paintCoins(true));
function paintCoins(b) { qa('[data-coins]').forEach(e => { const v = M.coins().toLocaleString(); if (e.textContent !== v) { e.textContent = v; if (b) bump(e.parentElement); } }); }

// ---------------------------------------------------------------- state + layout
let mode = 'title', state = 'ready', game = null, busy = false, sel = -1, card = null, bot = { plan: null, at: 0, phase: 0 }, hintOn = false;
let LAY = { w: 80, h: 112, pos: [] };
function layoutHome() {
  const W = innerWidth, H = innerHeight, wide = W / H >= 1;
  if (wide) { const w = Math.min(520, W * 0.36), h = Math.min(H * 0.6, w * 0.95); LD.layout({ x: W * 0.27, y: H * 0.3, w, h }); }
  else { const mr = q(home, '.ps-menu').getBoundingClientRect(), top = 222, menuTop = mr.height ? mr.top : H - 380, w = Math.min(W - 60, 360), h = Math.max(180, menuTop - top + 6); LD.layout({ x: (W - w) / 2, y: top, w, h }); }
}
function layout() {
  layoutHome();
  if (!game) return;
  const W = innerWidth, H = innerHeight, side = W / H > 0.95, top = 76, goalH = 74, boostH = side ? 0 : 100;
  const n = game.jars.length, perRow = side ? Math.min(n, n <= 6 ? n : Math.ceil(n / 2)) : n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3);
  const rows = Math.ceil(n / perRow);
  const areaTop = top + goalH + 18, areaH = H - areaTop - boostH - 24, areaW = Math.min(W - (side ? 240 : 16), side ? 900 : 560);
  const rowH = areaH / rows;
  const w = Math.floor(Math.min((areaW / perRow) * 0.8, (rowH - 50) / 1.42, side ? 120 : 98)), h = Math.round(w * 1.42);
  const gap = Math.min((areaW - perRow * w) / (perRow + 1), w * 0.6);
  const usedH = rows * (h + 46) - 46 + 20, y0 = areaTop + Math.max(0, (areaH - usedH) / 2) + 24;
  LAY = { w, h, pos: [], rows: [] };
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(perRow, n - r * perRow), rowW = inRow * w + (inRow - 1) * gap, x0 = (W - rowW) / 2, y = y0 + r * (h + 46);
    LAY.rows.push({ x: x0 - gap * 0.5 - 14, y: y + h - 6, w: rowW + gap + 28 });
    for (let c = 0; c < inRow; c++) LAY.pos.push({ x: x0 + c * (w + gap), y });
  }
  Object.assign(goalEl.style, { top: top + 4 + 'px', width: Math.min(W - 16, 520) + 'px' });
  if (side) Object.assign(boostEl.style, { left: 'auto', right: Math.max(20, (W - areaW) / 2 - 110) + 'px', top: areaTop + 20 + 'px', flexDirection: 'column', width: 'auto' });
  else Object.assign(boostEl.style, { left: '0px', right: '0px', top: H - boostH - 6 + 'px', flexDirection: 'row', width: '100%' });
  renderJars();
}
addEventListener('resize', layout);

// fruit placement inside a jar: a gentle pile, each fruit nudged a little (stable per position)
const jit = (j, i) => { const s = Math.sin((j + 1) * 12.9898 + (i + 1) * 78.233) * 43758.5453; return s - Math.floor(s); };
function fruitBox(j, i) { const w = LAY.w, h = LAY.h, fw = w * 0.8, step = h * 0.172; return { left: (w - fw) / 2 + (jit(j, i) - 0.5) * w * 0.1, bottom: h * 0.07 + i * step, w: fw, rot: (jit(i, j) - 0.5) * 22 }; }
let jarEls = [];
function renderJars() {
  shelvesEl.innerHTML = ''; jarEls = [];
  for (const r of LAY.rows) { const s = document.createElement('img'); s.src = A('pantry/shelf'); s.alt = ''; s.className = 'shelf'; Object.assign(s.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: Math.max(34, LAY.w * 0.42) + 'px' }); shelvesEl.appendChild(s); }
  game.jars.forEach((jar, j) => {
    const p = LAY.pos[j], el = document.createElement('div'); el.className = 'ps-jar'; el.dataset.j = j;
    Object.assign(el.style, { left: p.x + 'px', top: p.y + 'px', width: LAY.w + 'px', height: LAY.h + 'px' });
    paintJar(el, j); shelvesEl.appendChild(el); jarEls.push(el);
  });
  markSel();
}
function paintJar(el, j) {
  const jar = game.jars[j]; el.innerHTML = '';
  if (done(jar)) { const im = document.createElement('img'); im.className = 'jam'; im.src = A('pantry/jar-' + jar[0]); im.alt = JAM[jar[0]]; el.appendChild(im); el.setAttribute('aria-label', JAM[jar[0]]); return; }
  const rn = run(jar);
  jar.forEach((k, i) => { const b = fruitBox(j, i), im = document.createElement('img'); im.className = 'f' + (i >= jar.length - rn ? ' up' : ''); im.src = A('pantry/fruit-' + k); im.alt = k;
    Object.assign(im.style, { left: b.left + 'px', bottom: b.bottom + 'px', width: b.w + 'px', rotate: b.rot + 'deg' }); el.appendChild(im); });
  const g = document.createElement('img'); g.className = 'glass'; g.src = A('pantry/jar-empty'); g.alt = ''; el.appendChild(g);
  el.setAttribute('aria-label', jar.length ? `jar with ${jar.join(', ')}` : 'empty jar');
}
function markSel() { jarEls.forEach((e, j) => e.classList.toggle('sel', j === sel)); }

// ---------------------------------------------------------------- goal panel
const starsFor = g => g.moves <= g.L.par ? 3 : g.moves <= Math.round(g.L.par * 1.35) ? 2 : 1;
function paintGoal() {
  const g = game, s3 = g.moves <= g.L.par, s2 = g.moves <= Math.round(g.L.par * 1.35);
  const made = new Set(g.jars.filter(done).map(j => j[0]));
  goalEl.innerHTML = `<div class="lv">${g.kind === 'daily' ? 'Daily' : 'Level ' + g.n}${g.kind === 'daily' ? '<small>puzzle</small>' : g.L.hard ? '<small>hard · short</small>' : ''}</div>
    <div class="made" style="--mw:${Math.max(20, Math.min(30, (Math.min(innerWidth - 16, 520) - 210) / g.L.kinds.length))}px">${g.L.kinds.map(k => `<img class="${made.has(k) ? '' : 'off'}" src="${A('pantry/jar-' + k)}" alt="${JAM[k]}">`).join('')}</div>
    <div class="meter"><div class="st"><img src="${A('kit/star-full')}" alt=""><img class="${s2 ? '' : 'off'}" src="${A('kit/star-full')}" alt=""><img class="${s3 ? '' : 'off'}" src="${A('kit/star-full')}" alt=""></div>${g.moves} / ${g.L.par}</div>`;
}
function paintBoosts() { boostEl.querySelectorAll('[data-b]').forEach(b => { const k = b.dataset.b, n = st.boosts[k] || 0, badge = b.querySelector('b'); badge.className = n ? '' : 'coin'; badge.textContent = n ? n : PRICE[k]; }); }

// ---------------------------------------------------------------- start
function startGame(kind) {
  if (sheetOpen()) return;
  audio.unlock(); audio.music(true);
  const fk = kind === 'level' ? F.k() : 1, seed = kind === 'daily' ? (D.seed || ymd()) * 13 + 5 : st.level * 7919 + 29, r = rng(seed);
  const L = makeLevel(kind === 'daily' ? 14 : st.level, fk, r, { daily: kind === 'daily' });
  game = { kind, n: kind === 'daily' ? 0 : st.level, L, jars: clone(L.jars), start: clone(L.jars), moves: 0, undos: 0, hist: [], extra: 0, t0: performance.now(), recorded: false, over: false, order: [] };
  sel = -1; busy = false; mode = 'play'; state = 'play'; bot = { plan: null, at: performance.now() + 1500, phase: 0 };
  if (kind === 'level') M.level(st.level);
  B.start();
  home.classList.add('sb-hidden'); lview.classList.add('sb-hidden'); play.classList.remove('sb-hidden'); LD.el.classList.add('sb-hidden');
  layout(); paintGoal(); paintBoosts(); paintCoins();
  if (!reduced) jarEls.forEach((e, i) => e.animate([{ transform: 'translateY(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: i * 45, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' }));
  banner(kind === 'daily' ? 'Daily Puzzle' : `Level ${game.n}`, L.hard ? 'A hard one, but short' : `${L.kinds.length} jams to make`, L.hard ? 'navy' : 'rose');
  if (kind === 'level' && st.level <= 2 && !st.seenHow) tip('Tap a jar to lift its top fruit, then tap a jar with the same fruit on top, or an empty one.', 9000);
}
function restart() { const g = game; g.jars = clone(g.start); g.moves = 0; g.hist = []; g.extra = 0; sel = -1; bot.plan = null; layout(); paintGoal(); audio.gliss(); }
function banner(t, sub, color = 'rose') {
  const b = $(`<div class="ps-banner"><div class="sb-ribbon ${color}" style="min-width:280px;height:84px;font-size:calc(30px*var(--fs))">${t}</div><div style="font:italic 700 calc(24px*var(--fs))/1.2 var(--disp);color:var(--navy);text-shadow:0 0 10px #fffaf0,0 0 16px #fffaf0;margin-top:4px">${sub}</div></div>`);
  document.body.appendChild(b); setTimeout(() => b.remove(), 1700);
}
let tipEl = null;
function tip(text, ms = 5000) { if (tipEl) tipEl.remove(); tipEl = $(`<div class="ps-tip">${text}</div>`); tipEl.style.top = (LAY.pos.length ? Math.max(...LAY.pos.map(p => p.y)) + LAY.h + 40 : 500) + 'px'; play.appendChild(tipEl); const t = tipEl; setTimeout(() => { if (t === tipEl) { t.remove(); tipEl = null; } }, ms); }

// ---------------------------------------------------------------- input: tap a jar, tap another (or drag from one to another)
let downJ = -1;
shelvesEl.addEventListener('pointerdown', e => {
  const el = e.target.closest('.ps-jar'); if (!el || state !== 'play' || busy || sheetOpen()) return;
  e.preventDefault(); audio.unlock(); downJ = +el.dataset.j; tapJar(downJ);
});
addEventListener('pointerup', e => {
  if (downJ < 0) return; const from = downJ; downJ = -1;
  const t = document.elementFromPoint(e.clientX, e.clientY), el = t && t.closest && t.closest('.ps-jar');
  if (el && +el.dataset.j !== from && sel === from) tapJar(+el.dataset.j);   // drag-and-drop pour
});
function tapJar(j) {
  if (busy || state !== 'play') return; clearHint();
  const g = game, jar = g.jars[j];
  if (sel < 0) {
    if (!jar.length || done(jar)) { audio.bad(); nudge(j); return; }
    sel = j; audio.pick(); audio.pluck(76 + run(jar), { vol: 0.05, dur: 0.5 }); markSel(); return;
  }
  if (sel === j) { sel = -1; markSel(); audio.tap(); return; }
  if (canPour(g.jars, sel, j)) { const a = sel; sel = -1; return doPour(a, j); }
  // not allowed: pick the new jar instead if it has fruit, else a gentle shake
  if (jar.length && !done(jar)) { sel = j; audio.pick(); markSel(); }
  else { audio.bad(); nudge(j); toast(jar.length ? 'That jar is finished' : 'Only the same fruit can go on top'); }
}
function nudge(j) { const e = jarEls[j]; e && e.animate([{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '5px 0' }, { translate: '0 0' }], { duration: 260 }); }

async function doPour(a, b) {
  const g = game; busy = true; if (tipEl) { tipEl.remove(); tipEl = null; } if (!st.seenHow) { st.seenHow = true; save(); }
  const fromEl = jarEls[a], toEl = jarEls[b], kind = top(g.jars[a]);
  const n = Math.min(run(g.jars[a]), CAP - g.jars[b].length);
  const srcImgs = [...fromEl.querySelectorAll('.f')].slice(-n).reverse().map(im => ({ src: im.src, r: im.getBoundingClientRect(), rot: parseFloat(im.style.rotate) || 0 }));
  g.hist.push(clone(g.jars)); if (g.hist.length > 60) g.hist.shift();
  const bLen = g.jars[b].length; pour(g.jars, a, b); g.moves++;
  fromEl.classList.remove('sel'); paintJar(fromEl, a);
  // fly each fruit to its new place in an arc, then reveal
  const finished = done(g.jars[b]);
  if (finished) { const t = g.jars[b]; g.jars[b] = t.slice(0, bLen); paintJar(toEl, b); g.jars[b] = t; } else paintJar(toEl, b);
  const tr = toEl.getBoundingClientRect(), hidden = finished ? [] : [...toEl.querySelectorAll('.f')].slice(bLen);
  hidden.forEach(h => h.style.visibility = 'hidden');
  const flights = srcImgs.map((s, i) => {
    const fb = fruitBox(b, bLen + i), tx = tr.left + fb.left, ty = tr.top + LAY.h - fb.bottom - s.r.height;
    const im = document.createElement('img'); im.src = s.src; im.className = 'ps-fly'; im.style.width = s.r.width + 'px'; document.body.appendChild(im);
    const lift = Math.min(s.r.top, ty) - 70 - i * 10;
    return im.animate([{ transform: `translate(${s.r.left}px,${s.r.top}px) rotate(${s.rot}deg)` }, { transform: `translate(${(s.r.left + tx) / 2}px,${lift}px) rotate(${s.rot + 20}deg) scale(1.08)`, offset: 0.5 }, { transform: `translate(${tx}px,${ty}px) rotate(${fb.rot}deg)` }],
      { duration: 460, delay: i * 70, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' }).finished.then(() => { im.remove(); if (hidden[i]) hidden[i].style.visibility = ''; audio.wood({ vol: 0.12, f: 700 + i * 90 }); });
  });
  audio.pluck(72 + bLen * 2, { vol: 0.07, dur: 0.6 });
  await Promise.all(flights); buzz(8);
  if (finished) await finishJar(b, kind);
  paintGoal(); busy = false;
  if (won(g.jars)) return win();
  if (stuck(g.jars)) return stuckCard();
}
async function finishJar(b, kind) {
  const g = game, el = jarEls[b], r = el.getBoundingClientRect();
  // the gingham lid drops on, then it's jam
  const lid = document.createElement('img'); lid.src = A('pantry/jar-cover'); lid.className = 'ps-fly'; const lw = LAY.w * 1.05; lid.style.width = lw + 'px'; document.body.appendChild(lid);
  await lid.animate([{ transform: `translate(${r.left + LAY.w / 2 - lw / 2}px,${r.top - 120}px) rotate(-14deg)`, opacity: 0 }, { transform: `translate(${r.left + LAY.w / 2 - lw / 2}px,${r.top - LAY.w * 0.35}px) rotate(3deg)`, opacity: 1, offset: 0.8 }, { transform: `translate(${r.left + LAY.w / 2 - lw / 2}px,${r.top - LAY.w * 0.3}px) rotate(0deg)` }], { duration: 380, easing: 'cubic-bezier(.3,0,.3,1)' }).finished;
  lid.remove(); paintJar(el, b); el.classList.remove('new'); void el.offsetWidth; el.classList.add('new');
  audio.clear(2, 1 + g.order.length); buzz([10, 30, 14]); g.order.push(kind);
  fx.burst(r.left + r.width / 2, r.top + r.height * 0.4, 22, { speed: 5 }); fx.burst(r.left + r.width / 2, r.top + r.height * 0.2, 10, { kind: 'spark', speed: 4 });
  word(JAM[kind] + '!', Math.min(innerWidth - 120, Math.max(120, r.left + r.width / 2)), Math.max(150, r.top - 20), 36);
  await wait(250);
}

// ---------------------------------------------------------------- boosters
function clearHint() { if (!hintOn) return; hintOn = false; jarEls.forEach(e => e.classList.remove('hint', 'hint2')); }
async function useBooster(k) {
  if (state !== 'play' || busy || sheetOpen()) return; audio.tap();
  const g = game;
  if (k === 'undo' && !g.hist.length) { toast('Nothing to undo yet'); return; }
  if (k === 'jar' && g.extra >= 1) { toast('One extra jar per level'); return; }
  let hintMove = null;
  if (k === 'hint') { const sol = solve(g.jars, 30000); if (!sol) { toast('This one is tangled: try Undo or an extra jar'); return; } hintMove = sol[0]; }
  let paid = false;
  if (st.boosts[k] > 0) { st.boosts[k]--; paid = true; }
  else if (M.coins() >= PRICE[k]) paid = M.spend(PRICE[k], 'booster:' + k);
  else if (k === 'hint' || k === 'jar') { busy = true; paid = await M.rewarded(k === 'hint' ? 'hint' : 'revive', { what: k === 'hint' ? 'the next good pour, shown on the shelf' : 'an extra empty jar for this level', title: k === 'jar' ? 'An extra jar' : undefined }); busy = false; }
  else { toast(`That costs ${PRICE[k]} coins`); M.shop(); return; }
  if (!paid) return;
  save(); paintBoosts();
  if (k === 'undo') { g.jars = g.hist.pop(); g.moves = Math.max(0, g.moves - 1); g.undos++; sel = -1; bot.plan = null; renderJars(); paintGoal(); audio.gliss(); }
  if (k === 'hint') { sel = -1; markSel(); hintOn = true; jarEls[hintMove[0]].classList.add('hint'); jarEls[hintMove[1]].classList.add('hint2'); audio.chime(); }
  if (k === 'jar') { g.extra++; g.jars.push([]); bot.plan = null; layout(); const e = jarEls[jarEls.length - 1]; e.classList.add('new'); const r = e.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2, 14, { kind: 'spark' }); audio.chime(); }
}

// ---------------------------------------------------------------- cards
function showCard(html, onTap) {
  if (card) card.remove();
  card = $(`<div class="oi-card"><div class="sb-sheet"><img class="corner tl" src="${A('kit/corner-roses')}" alt=""><img class="corner br" src="${A('kit/corner-roses')}" alt="">${html}</div></div>`);
  card.addEventListener('click', e => { if (e.target.closest('[data-stop]')) return; const c = card; if (!c || c.dataset.locked) return; c.remove(); if (card === c) card = null; onTap(e.target.closest('[data-act]') ? e.target.closest('[data-act]').dataset.act : 'go'); });
  document.body.appendChild(card); return card;
}
async function win() {
  const g = game; if (g.over) return; g.over = true; state = 'won'; busy = true;
  const ms = performance.now() - g.t0, stars = starsFor(g);
  if (!g.recorded && g.kind === 'level') { F.level(true); g.recorded = true; }
  audio.win(); fx.rain(40); word(g.kind === 'daily' ? 'All sorted!' : 'Pantry tidy!', innerWidth / 2, innerHeight * 0.4, 50);
  jarEls.forEach((e, i) => e.animate([{ transform: 'none' }, { transform: 'translateY(-12px)' }, { transform: 'none' }], { duration: 420, delay: i * 60 }));
  const coins = g.kind === 'daily' ? 40 : 10 + stars * 5;
  st.stars += stars; st.wins++;
  let stamp = null;
  if (g.kind === 'daily') { const sk = STREAK.win(); st.dLast = dayNum(); st.dRes = { stars, moves: g.moves, undos: g.undos, order: g.order.slice(), streak: sk.n, froze: sk.froze }; stamp = ALB.award(); }
  else { st.level++; if (g.n % 2 === 0 || g.n === 1) stamp = ALB.award(); }
  save(); M.add(coins, g.kind === 'daily' ? 'daily' : 'win');
  D.won(stars, 'earned ⭐'); B.submit(stars, { ms });
  await wait(1200);
  const next = LARDER.find(it => !st.larder.includes(it.id)), canRestore = next && starsLeft() >= next.cost;
  const c = showCard(`<div class="sb-ribbon ${g.kind === 'daily' ? 'navy' : 'rose'}">${g.kind === 'daily' ? 'Daily Puzzle' : 'Level ' + g.n}</div>
    <h2 style="margin-top:6px">${['', 'Well done', 'Splendid!', 'Marvellous!'][stars]}</h2>
    <div class="sb-stars">${[0, 1, 2].map(k => `<img class="${k < stars ? 'on' : ''}" style="animation-delay:${0.25 + k * 0.28}s" src="${A(k < stars ? 'kit/star-full' : 'kit/star-empty')}" alt="">`).join('')}</div>
    <div class="jams">${g.order.map((k, i) => `<img style="animation-delay:${0.9 + i * 0.08}s" src="${A('pantry/jar-' + k)}" alt="${JAM[k]}">`).join('')}</div>
    <div class="reward"><img src="${A('kit/coin')}" alt=""><span data-cw>+${coins}</span></div>
    ${stamp ? `<div class="stamp"><img src="${A('stamps/stamp-' + stamp.id)}" alt=""><div style="text-align:left"><b>New stamp!</b><br>${stamp.pageName}${stamp.bonus ? `<br>Page complete: +${stamp.bonus}` : ''}</div></div>` : ''}
    ${g.kind === 'daily' ? `<p style="margin:4px 0">🔥 ${st.dRes.streak}-day streak${st.dRes.froze ? ' (your weekly freeze kept it)' : ''}</p>` : ''}
    <div class="stack">
      <button class="sb-btn rose" data-stop data-double><img src="${A('icons/video')}" alt=""><span>Double coins<small>short video · +${coins} more</small></span></button>
      ${g.kind === 'daily' ? `<button class="sb-btn" data-stop data-share><img src="${A('icons/share')}" alt="">Share result</button>` : ''}
      <button class="sb-btn navy big" data-act="${g.kind === 'level' ? 'next' : 'home'}">${g.kind === 'level' ? 'Next level' : 'Continue'}</button>
      ${canRestore ? `<button class="sb-btn sage" data-act="larder"><img src="${A('kit/star-full')}" alt="">Restore the larder</button>` : `<button class="lnk" data-act="home">Home</button>`}
    </div>`, async act => {
      state = 'ready';
      if (act === 'next') { await M.breakAd('level-end', { level: g.n }); startGame('level'); }
      else if (act === 'larder') { await M.breakAd('level-end', { level: g.n }); leaveToHome(); openLarder(); }
      else { if (g.kind === 'level') await M.breakAd('level-end', { level: g.n }); leaveToHome(); }
    });
  [0, 1, 2].slice(0, stars).forEach(k => setTimeout(() => audio.star(k), 250 + k * 280));
  const from = c.querySelector('.reward img').getBoundingClientRect(), pill = q(play, '[data-coins]');
  for (let k = 0; k < 6; k++) flyTo(A('kit/coin'), { x: from.left + 20, y: from.top + 20 }, pill.parentElement, { size: 34, delay: 700 + k * 70, dur: 600 }).then(() => k === 5 && audio.coin());
  const dbl = c.querySelector('[data-double]');
  dbl.onclick = async () => { dbl.disabled = true; c.dataset.locked = 1; const ok = await M.rewarded('double', { what: `${coins} more coins (${coins * 2} in all)` }); delete c.dataset.locked; if (ok) { M.add(coins, 'double'); c.querySelector('[data-cw]').textContent = '+' + coins * 2; audio.coin(); } dbl.remove(); };
  const sh = c.querySelector('[data-share]'); if (sh) sh.onclick = () => share(shareText());
  busy = false;
}
function shareText() {
  const r = st.dRes; if (!r) return '';
  const dd = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Pantry Sort · Daily ${dd}\n${'⭐'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} in ${r.moves} pours${r.undos ? '' : ' · no undos'}\n${r.order.map(k => EMO[k] || '🫙').join('')}\n🔥 ${r.streak}-day streak\n${location.origin}${location.pathname}?daily=1`;
}
function dailyDoneSheet() {
  const r = st.dRes, now = new Date(), nx = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), h = Math.ceil((nx - now) / 36e5);
  const sh = sheet({ html: `<h2>Today's puzzle is done</h2><img class="divider" src="${A('kit/divider')}" alt="">
    ${r ? `<div class="sb-stars">${[0, 1, 2].map(k => `<img src="${A(k < r.stars ? 'kit/star-full' : 'kit/star-empty')}" alt="">`).join('')}</div><p>Sorted in ${r.moves} pours · 🔥 ${STREAK.n}-day streak</p>` : ''}
    <p>A new one arrives in about ${h} hour${h === 1 ? '' : 's'}.</p><div class="row"><button class="sb-btn" data-share><img src="${A('icons/share')}" alt="">Share</button><button class="sb-btn navy" data-ok>Play a level</button></div>` });
  sh.q('[data-share]').onclick = () => share(shareText());
  sh.q('[data-ok]').onclick = () => { sh.close(); startGame('level'); };
}
async function stuckCard() {
  const g = game; state = 'lost'; busy = true; audio.lose();
  await wait(700);
  const c = showCard(`<div class="sb-ribbon navy">${g.kind === 'daily' ? 'Daily Puzzle' : 'Level ' + g.n}</div><h2 style="margin-top:6px">No pours left</h2>
    <p>Every jar is blocked. Step back a pour or two, or start the level again.</p>
    <div class="stack"><div data-offer style="min-height:72px"></div>
      <button class="sb-btn navy big" data-act="undo"><img src="${A('icons/undo')}" alt="">Undo a pour</button>
      <button class="lnk" data-act="restart">Start again</button></div>`, act => {
      state = 'play'; busy = false;
      if (act === 'restart') restart();
      else { g.jars = g.hist.pop() || g.jars; g.moves = Math.max(0, g.moves - 1); g.undos++; sel = -1; bot.plan = null; renderJars(); paintGoal(); audio.gliss(); }
    });
  // one offer, after 1.2 s: an extra jar for a short video (or free if one is in the cupboard)
  setTimeout(() => {
    if (card !== c || g.extra >= 1) return;
    const free = st.boosts.jar > 0;
    const b = $(`<button class="sb-btn rose" data-stop style="width:100%"><img src="${A(free ? 'icons/plus' : 'icons/video')}" alt=""><span>Extra jar<small>${free ? `use one of your ${st.boosts.jar}` : 'short video · one more empty jar'}</small></span></button>`);
    c.querySelector('[data-offer]').appendChild(b);
    b.onclick = async () => {
      b.disabled = true; c.dataset.locked = 1;
      const ok = free ? (st.boosts.jar--, save(), true) : await M.rewarded('revive', { what: 'an extra empty jar for this level', title: 'An extra jar' });
      delete c.dataset.locked;
      if (ok) { c.remove(); card = null; state = 'play'; busy = false; g.extra++; g.jars.push([]); bot.plan = null; layout(); paintBoosts(); jarEls[jarEls.length - 1].classList.add('new'); audio.chime(); } else b.remove();
    };
  }, 1250);
  busy = false;
}

// ---------------------------------------------------------------- home + larder
function leaveToHome() {
  if (card) { card.remove(); card = null; }
  if (game && !game.recorded && game.kind === 'level' && game.moves > 0 && !game.over) { F.level(false, game.jars.filter(done).length / game.L.kinds.length); game.recorded = true; }
  game = null; mode = 'title'; state = 'ready'; sel = -1;
  play.classList.add('sb-hidden'); lview.classList.add('sb-hidden'); home.classList.remove('sb-hidden'); LD.el.classList.remove('sb-hidden');
  BG.show('pantry-sort'); layoutHome(); const nx = LARDER.find(it => !st.larder.includes(it.id)); LD.set(st.larder, nx ? nx.id : null); paintHome(); audio.music(true);
}
function paintHome() {
  qa('[data-stars]').forEach(e => e.textContent = starsLeft());
  const next = LARDER.find(it => !st.larder.includes(it.id));
  q(home, '[data-play]').innerHTML = `<img src="${A('icons/play')}" alt="">Play · Level ${st.level}`;
  q(home, '[data-dsub]').textContent = st.dLast === dayNum() ? 'done ✓' : STREAK.n ? `🔥 ${STREAK.n} days` : 'new today';
  q(home, '[data-acount]').textContent = `${ALB.count} of 24${ALB.fresh ? ' · new' : ''}`;
  q(home, '[data-streak]').innerHTML = STREAK.n > 1 ? `<div class="sb-ribbon" style="display:inline-grid;font-size:calc(19px*var(--fs));height:60px;min-width:230px;margin-top:6px"><span><small>daily streak</small>${STREAK.n} days</span></div>` : '';
  q(home, '[data-lnext]').textContent = next ? (starsLeft() >= next.cost ? `Ready: ${next.name} (★${next.cost})` : `Next: ${next.name} · ★${next.cost}`) : 'Every shelf restored. Thank you!';
  q(home, '[data-lbar]').style.width = st.larder.length / LARDER.length * 100 + '%';
  q(home, '[data-limg]').src = A(next ? next.src : 'kit/rosette');
  q(home, '.ps-card').style.borderColor = next && starsLeft() >= next.cost ? '#b08834' : '';
  paintCoins();
}
function openLarder() {
  if (sheetOpen()) return;
  home.classList.add('sb-hidden'); lview.classList.remove('sb-hidden'); mode = 'larder';
  const draw = (said = null) => {
    const next = LARDER.find(it => !st.larder.includes(it.id));
    q(lview, '[data-ltitle]').innerHTML = `<span><small>${st.larder.length} of ${LARDER.length} restored</small>Nana Rose's Larder</span>`;
    qa('[data-stars]').forEach(e => e.textContent = starsLeft());
    LD.set(st.larder, next ? next.id : null);
    const pb = q(lview, '[data-place]'), lp = q(lview, '[data-lp]');
    lp.classList.toggle('q', !!said);
    if (said) { q(lview, '[data-lh]').textContent = said.name; lp.textContent = '“' + said.line + '”'; }
    if (!next) { if (!said) { q(lview, '[data-lh]').textContent = 'The larder is complete'; lp.textContent = 'Every shelf is full again. Nana would be proud.'; } pb.classList.add('sb-hidden'); return; }
    pb.classList.remove('sb-hidden');
    const can = starsLeft() >= next.cost;
    if (!said) { q(lview, '[data-lh]').textContent = next.name; lp.textContent = can ? `Put it back for ★${next.cost}. Its place is shimmering.` : `Needs ★${next.cost}. You have ★${starsLeft()}. Each level gives up to 3 stars.`; }
    pb.innerHTML = can ? `<img src="${A('kit/star-full')}" alt="">${said ? 'Next ★' + next.cost : 'Restore ★' + next.cost}` : `<img src="${A('icons/play')}" alt="">Play`;
    pb.onclick = async () => {
      audio.tap();
      if (!can) { lview.classList.add('sb-hidden'); startGame('level'); return; }
      pb.disabled = true; st.spent += next.cost; st.larder.push(next.id); save();
      const sp = LD.spot(next.id), pr = q(lview, '.ps-starpill').getBoundingClientRect();
      for (let k = 0; k < Math.min(next.cost, 6); k++) flyTo(A('kit/star-full'), { x: pr.left + 24, y: pr.top + 24 }, { getBoundingClientRect: () => ({ left: sp.x - 10, top: sp.y - 10, width: 20, height: 20 }) }, { size: 40, delay: k * 80, dur: 600, arc: -120 });
      qa('[data-stars]').forEach(e => e.textContent = starsLeft());
      await wait(700); await LD.place(next.id);
      if (st.larder.length === LARDER.length) { await wait(400); fx.rain(60); audio.win(); M.add(300, 'larder-complete'); toast('The larder is restored! +300 coins', 4000); }
      pb.disabled = false; draw(next);
    };
  };
  q(lview, '[data-back]').onclick = q(lview, '[data-back2]').onclick = () => { audio.tap(); leaveToHome(); };
  draw();
}

// ---------------------------------------------------------------- QA hooks
window.__game = {
  get state() { return state; }, get level() { return game ? (game.kind === 'level' ? game.n : 1) : st.level; }, get score() { return st.stars; },
  bot() {
    const now = performance.now();
    if (state === 'ready' && !game && !card && !sheetOpen()) { if (!this._idle) this._idle = now; if (now - this._idle > 1800) { this._idle = 0; startGame('level'); } return; }
    this._idle = 0;
    if (state !== 'play' || busy || sheetOpen() || !game || now < bot.at) return;
    if (!bot.plan || !bot.plan.length) { bot.plan = solve(game.jars, 40000) || []; if (!bot.plan.length) { const m = moves(game.jars)[0]; if (m) bot.plan = [m]; else return; } }
    const [a, b] = bot.plan[0];
    if (!canPour(game.jars, a, b)) { bot.plan = null; return; }
    if (sel !== a) { if (sel >= 0) { sel = -1; markSel(); } tapJar(a); bot.at = now + 420 + Math.random() * 200; return; }   // lift, look, pour: human pace
    bot.plan.shift(); tapJar(b); bot.at = now + 800 + Math.random() * 400;
  },
  // QA only: a careless player (any legal pour), to reach the "No pours left" card
  careless() { if (state !== 'play' || busy || !game) return; const ms = moves(game.jars); if (!ms.length) return; const [a, b] = ms[(Math.random() * ms.length) | 0]; sel = -1; tapJar(a); tapJar(b); },
};

// ---------------------------------------------------------------- boot
(async () => {
  const load = document.getElementById('ps-load'), bar = load.querySelector('b'), wide = innerWidth / innerHeight >= 1;
  const list = [A(`bg/pantry-sort${wide ? '-wide' : ''}-s`), A('pantry/jar-empty'), A('pantry/shelf'), A('pantry/jar-cover'), ...KINDS.map(k => A('pantry/fruit-' + k)), ...KINDS.map(k => A('pantry/jar-' + k)),
    ...['menu', 'home', 'settings', 'hint', 'undo', 'plus', 'shuffle', 'calendar', 'play', 'album', 'shop', 'trophy', 'close'].map(k => A('icons/' + k)),
    ...['coin', 'star-full', 'star-empty', 'paper', 'ribbon-rose', 'ribbon-navy', 'corner-roses', 'divider'].map(k => A('kit/' + k)), ...LARDER.map(i => A(i.src))];
  await Promise.race([preload(list, f => bar.style.width = f * 100 + '%'), wait(6000)]);
  P.init();
  if (D.isDaily && st.dLast !== dayNum()) { BG.show('pantry-sort'); startGame('daily'); }
  else leaveToHome();
  load.style.opacity = 0; setTimeout(() => load.remove(), 500);
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  setTimeout(() => preload([A('bg/pantry-sort' + (wide ? '-wide' : ''))]), 1500);
})();

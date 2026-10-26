// Oak & Ivy Blocks: Wood Block Puzzle. A calm wood block puzzle in a painted potting shed (style C, Storybook Garden).
// Drag three wooden pieces onto a 9×9 board; full rows, columns and 3×3 squares clear. Calm levels ask you to clear
// painted blossom blocks; Endless is for a best score; the Daily puzzle is the same for everyone with a forgiving
// streak and a spoiler-free share grid. Stars restore a cottage garden, wins fill a stamp album. No timer anywhere.
// Inspired by Woodoku (Tripledot Studios): mechanic only. All code ours; art from our own Storybook library.
import { money } from './kit/money.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import { A, $, wait, dayNum, ymd, rng, store, injectCSS, prefs, background, sheet, sheetOpen, toast, word, fx, fxMount, flyTo, bump, buzz, audio, streak, share, album, settingsSheet, preload, reduced } from './sb.js';
import { N, GOALS, emptyGrid, cloneGrid, fits, anyFit, wouldClear, clearCells, place, bestMove, makeDealer, makeLevel, endlessDealer, points } from './logic.js';
import { GARDEN, CHAPTERS, gardenScene } from './garden.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason && (e.reason.stack || e.reason))));
const SLUG = 'oak-ivy', NAME = 'Oak & Ivy Blocks', Q = new URLSearchParams(location.search);
const S = store(SLUG);
const st = {
  level: S.get('level', 1), stars: S.get('stars', 0), spent: S.get('spent', 0), garden: S.get('garden', []), best: S.get('best', 0), wins: S.get('wins', 0),
  boosts: S.get('boosts', { hint: 3, undo: 3, swap: 2 }), dLast: S.get('dLast', 0), dRes: S.get('dRes', null), endStamp: S.get('endStamp', 0), seenHow: S.get('seenHow', false),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const starsLeft = () => st.stars - st.spent;
const PRICE = { hint: 50, undo: 40, swap: 60 };

// ---------------------------------------------------------------- kit layers: money, flow, daily, world board
const M = money({ game: SLUG, style: 'C' });
const F = flow(SLUG);
const D = daily(SLUG, null, { name: NAME });
const B = worldBoard({ game: 'oak-ivy', label: 'Stars earned', limits: { maxRun: 3, maxPerSec: 1.5 }, mode: 'sum', corner: 'tr', accent: '#d6b46a' });
const P = prefs(SLUG);
const STREAK = streak(S);
const ALB = album(S, { M, onChange: () => paintHome() });

// ---------------------------------------------------------------- CSS
injectCSS(`
.oi-garden{position:fixed;inset:0;z-index:1;pointer-events:none}
.oi-garden img{filter:drop-shadow(0 6px 6px rgba(40,50,30,.28))}
.oi-ghost{opacity:.42;filter:grayscale(.6) brightness(1.15) drop-shadow(0 0 0 #fff)!important;animation:oighost 1.6s ease-in-out infinite}
@keyframes oighost{50%{opacity:.7}}
.oi-layer{position:fixed;inset:0;z-index:5;pointer-events:none}
.oi-layer>*{pointer-events:auto}
.oi-top{position:absolute;left:0;right:0;top:calc(10px + env(safe-area-inset-top));height:58px;display:flex;align-items:center;gap:10px;padding:0 76px 0 10px}
.oi-top .sp{flex:1}
/* home */
.oi-title{position:absolute;left:0;right:0;top:calc(74px + env(safe-area-inset-top));text-align:center;pointer-events:none}
.oi-title h1{margin:0;font:700 calc(64px*var(--fs))/0.9 var(--disp);color:var(--navy);text-shadow:0 2px 0 #fffaf0,0 0 18px rgba(255,250,235,.9),0 0 36px rgba(255,250,235,.8)}
.oi-title h1 i{font-style:italic;color:var(--rose);font-weight:700}
.oi-title p{margin:24px 0 0;font:700 calc(17px*var(--fs))/1 var(--serif);letter-spacing:3px;color:var(--sage);text-shadow:0 0 10px #fffaf0,0 0 18px #fffaf0}
.oi-title .sprig{width:150px;display:block;margin:2px auto 0;opacity:.95}
.oi-streak{display:inline-grid;margin-top:6px}
.oi-menu{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));width:min(430px,calc(100% - 20px));padding:16px 14px 14px;border-radius:24px;text-align:center;
  background:rgba(251,246,234,.93) url(${A('kit/paper')}) center/360px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 4px rgba(251,246,234,.95),inset 0 0 0 5.5px rgba(176,136,52,.55),0 16px 40px rgba(31,45,84,.3)}
.oi-menu .play{width:100%}
.oi-menu .two{display:flex;gap:10px;margin-top:12px}.oi-menu .two .sb-btn{flex:1;padding:8px 10px}
.oi-menu .icons{display:flex;justify-content:space-around;margin-top:12px}
.oi-menu .icons label{display:flex;flex-direction:column;align-items:center;gap:2px;font:700 calc(18px*var(--fs))/1.1 var(--serif);color:var(--navy);cursor:pointer}
.oi-garden-card{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:8px 10px 8px 8px;border-radius:16px;background:rgba(86,120,84,.1);border:1.5px solid rgba(86,120,84,.35);text-align:left;cursor:pointer}
.oi-garden-card img{width:54px;height:54px;object-fit:contain;flex:none}
.oi-garden-card div{flex:1;font:700 calc(19px*var(--fs))/1.25 var(--serif)}
.oi-garden-card small{display:block;font-weight:400;font-size:calc(17px*var(--fs))}
.oi-garden-card .bar{height:9px;border-radius:5px;background:rgba(31,45,84,.12);margin-top:5px;overflow:hidden}.oi-garden-card .bar i{display:block;height:100%;background:var(--sage)}
.oi-starpill{pointer-events:auto;display:inline-flex;align-items:center;gap:4px;height:50px;padding:0 14px 0 4px;border-radius:25px;background:linear-gradient(180deg,#fffdf6,#f2e7cf);border:2px solid #c6a35a;box-shadow:inset 0 0 0 2px #fffaf0,0 4px 10px rgba(31,45,84,.2);font:700 calc(21px*var(--fs))/1 var(--serif);color:var(--navy)}
.oi-starpill img{width:40px;height:40px}
@media (min-aspect-ratio:1/1){.oi-menu{left:auto;right:max(24px,calc(50% - 600px));transform:none;bottom:50%;transform:translateY(50%);width:400px}.oi-title{right:auto;left:max(24px,calc(50% - 600px));width:520px;top:calc(40px + env(safe-area-inset-top))}}
/* garden view */
.oi-gview-bot{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));width:min(430px,calc(100% - 20px));padding:14px;border-radius:22px;text-align:center;
  background:rgba(251,246,234,.94) url(${A('kit/paper')}) center/360px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 4px rgba(251,246,234,.95),inset 0 0 0 5.5px rgba(176,136,52,.55),0 16px 40px rgba(31,45,84,.3);font-size:calc(20px*var(--fs))}
.oi-gview-bot h3{margin:0 0 4px;font:700 calc(28px*var(--fs))/1.1 var(--disp)}
.oi-gview-bot p{margin:0 0 10px}
.oi-gview-bot .row{display:flex;gap:10px}.oi-gview-bot .row .sb-btn{flex:1}
.oi-gview-top{position:absolute;left:0;right:0;top:calc(76px + env(safe-area-inset-top));display:flex;justify-content:center;pointer-events:none}
/* play */
.oi-play{display:flex;flex-direction:column;align-items:center}
.oi-goal{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 14px;border-radius:18px;
  background:rgba(251,246,234,.95) url(${A('kit/paper')}) center/300px;border:2px solid #c6a35a;box-shadow:inset 0 0 0 3px rgba(251,246,234,.95),inset 0 0 0 4.5px rgba(176,136,52,.5),0 8px 20px rgba(31,45,84,.22)}
.oi-goal .lv{font:700 calc(22px*var(--fs))/1.05 var(--disp);color:var(--navy);white-space:nowrap}
.oi-goal .lv small{display:block;font:700 calc(15px*var(--fs))/1.2 var(--serif);letter-spacing:1px;color:var(--rose);text-transform:uppercase}
.oi-goal .chips{display:flex;gap:8px}
.oi-chip{position:relative;width:54px;height:54px;flex:none}
.oi-chip img{width:100%;height:100%;filter:drop-shadow(0 2px 2px rgba(60,35,10,.35))}
.oi-chip b{position:absolute;right:-8px;bottom:-6px;min-width:32px;height:30px;border-radius:15px;background:var(--navy);color:#fff6e0;font:700 calc(19px*var(--fs))/30px var(--serif);text-align:center;padding:0 6px;box-shadow:0 0 0 2px #e8cf8f}
.oi-chip.done b{background:var(--sage);font-size:20px}
.oi-chip.bump{animation:sbbump .35s}
.oi-goal .meter{text-align:right;font:700 calc(18px*var(--fs))/1.2 var(--serif);color:var(--navy);white-space:nowrap}
.oi-goal .meter .st{display:flex;gap:1px;justify-content:flex-end}.oi-goal .meter img{width:24px;height:24px}.oi-goal .meter img.off{filter:grayscale(1);opacity:.35}
.oi-goal .score{font:700 calc(34px*var(--fs))/1 var(--serif);color:var(--navy);text-align:center;min-width:120px}
.oi-goal .score small{display:block;font:400 calc(17px*var(--fs))/1.3 var(--serif)}
.oi-board{position:absolute;border-style:solid;border-image:url(${A('blocks/wood-board')}) 132 / var(--fw) / 0 round;filter:drop-shadow(0 14px 18px rgba(60,40,20,.35))}
.oi-grid{position:absolute;inset:0;padding:var(--gp);display:grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(9,1fr);gap:var(--gg);
  background:linear-gradient(135deg,#f4e3c0,#ead39f);box-shadow:inset 0 2px 6px rgba(90,55,15,.4)}
.oi-grid .c{position:relative;border-radius:5px;background:rgba(255,248,230,.42);box-shadow:inset 1px 1px 2px rgba(110,70,20,.28),inset -1px -1px 1px rgba(255,255,255,.55)}
.oi-grid .c.alt{background:rgba(196,150,80,.22)}
.oi-grid .c.blk{background:var(--img) center/100% 100% no-repeat;box-shadow:0 2px 3px rgba(60,35,10,.38);border-radius:4px}
.oi-grid .c.gh::after{content:'';position:absolute;inset:0;background:var(--gimg) center/100% 100% no-repeat;opacity:.5;border-radius:4px}
.oi-grid .c.hl::before{content:'';position:absolute;inset:-1px;border-radius:5px;z-index:2;background:rgba(255,226,140,.38);box-shadow:inset 0 0 0 2.5px #e2bd5f,0 0 10px rgba(255,214,110,.75);animation:oihl .9s ease-in-out infinite}
.oi-grid .c.hint::before{content:'';position:absolute;inset:-1px;border-radius:5px;z-index:2;box-shadow:inset 0 0 0 3px #567854,0 0 12px rgba(86,120,84,.8);background:rgba(86,120,84,.25);animation:oihl .8s ease-in-out infinite}
@keyframes oihl{50%{opacity:.55}}
.oi-grid .c.pop{animation:oipop .28s cubic-bezier(.2,1.6,.4,1)}
@keyframes oipop{from{transform:scale(1.22)}}
.oi-tray{position:absolute;display:flex;border-radius:22px;background:rgba(251,246,234,.72);border:2px solid rgba(198,163,90,.7);box-shadow:inset 0 0 0 3px rgba(251,246,234,.6),0 8px 22px rgba(31,45,84,.18);backdrop-filter:blur(2px)}
.oi-slot{flex:1;position:relative;display:grid;place-items:center;cursor:grab;touch-action:none}
.oi-slot.sel .pc{filter:drop-shadow(0 0 6px #f3d27b) drop-shadow(0 0 2px #b08834);transform:scale(1.08)}
.oi-slot.dim .pc{opacity:.38;filter:grayscale(.7)}
.oi-slot.hint .pc{animation:oibob .8s ease-in-out infinite}
@keyframes oibob{50%{transform:translateY(-8px)}}
.pc{position:relative;transition:transform .15s}
.pc i,.oi-float i{position:absolute;background:var(--img) center/100% 100% no-repeat;border-radius:3px;box-shadow:0 2px 3px rgba(60,35,10,.35)}
.oi-float{position:fixed;left:0;top:0;z-index:50;pointer-events:none;will-change:transform;filter:drop-shadow(0 16px 14px rgba(40,25,5,.35))}
.oi-boost{position:absolute;display:flex;gap:18px;justify-content:center}
.oi-boost label{display:flex;flex-direction:column;align-items:center;gap:0;font:700 calc(18px*var(--fs))/1.1 var(--serif);color:var(--navy);text-shadow:0 0 6px #fffaf0,0 0 10px #fffaf0;cursor:pointer}
.oi-boost .sb-round{width:62px;height:62px}
.oi-boost .sb-round b.coin{background:#fbf3df;color:var(--navy);box-shadow:0 0 0 2px #c6a35a;font-size:15px}
.oi-tip{position:absolute;left:50%;transform:translateX(-50%);width:min(380px,calc(100% - 24px));padding:10px 14px;border-radius:16px;background:rgba(251,246,234,.96);border:2px solid #c6a35a;text-align:center;font:700 calc(19px*var(--fs))/1.3 var(--serif);color:var(--navy);box-shadow:0 8px 20px rgba(31,45,84,.22);pointer-events:none;z-index:6}
/* cards */
.oi-card{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;background:rgba(31,45,84,.34);animation:sbfade .3s}
.oi-card .sb-sheet{animation:sbpop .45s cubic-bezier(.2,1.4,.4,1)}
.oi-card .sb-ribbon{margin:-6px auto 2px}
.oi-card .reward{display:flex;align-items:center;justify-content:center;gap:8px;font:700 calc(28px*var(--fs))/1 var(--serif);margin:4px 0}
.oi-card .reward img{width:42px;height:42px}
.oi-card .stamp{display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0;font-size:calc(19px*var(--fs))}
.oi-card .stamp img{width:86px;animation:sbstamp .7s cubic-bezier(.2,1.5,.4,1) both;animation-delay:.9s;filter:drop-shadow(0 6px 8px rgba(31,45,84,.3))}
.oi-card .stack{display:flex;flex-direction:column;gap:12px;align-items:stretch;margin-top:12px}
.oi-card .stack .sb-btn{width:100%}
.oi-card .lnk{background:none;border:0;font:700 calc(19px*var(--fs))/1 var(--serif);color:var(--navy);text-decoration:underline;text-underline-offset:4px;padding:14px;cursor:pointer;min-height:48px}
.oi-banner{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:40;pointer-events:none;text-align:center;animation:oibanner 1.6s ease-in-out forwards}
@keyframes oibanner{0%{opacity:0;transform:translate(-50%,-30%) scale(.8)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%)}}
`);

// ---------------------------------------------------------------- DOM
const bgEl = $('<div class="sb-bg"></div>'); document.body.appendChild(bgEl);
const BG = background(bgEl);
const GS = gardenScene(document.body);
fxMount();
const coinPill = () => `<button class="sb-pill" data-shop aria-label="Coins and shop"><img src="${A('kit/coin')}" alt=""><span data-coins>0</span><span class="plus">+</span></button>`;
const home = $(`<div class="oi-layer sb-hidden">
  <div class="oi-top"><button class="sb-round" data-set aria-label="Settings"><img src="${A('icons/menu')}" alt=""></button><div class="sp"></div>
    <div class="oi-starpill" data-stars-pill><img src="${A('kit/star-full')}" alt=""><span data-stars>0</span></div>${coinPill()}</div>
  <div class="oi-title"><h1>Oak <i>&amp;</i> Ivy</h1><p>WOOD BLOCK PUZZLE</p><img class="sprig" src="${A('kit/divider')}" alt=""><div data-streak></div></div>
  <div class="oi-menu">
    <div class="oi-garden-card" data-garden role="button" aria-label="Restore the garden"><img data-gimg alt=""><div><span data-gname></span><small data-gnext></small><div class="bar"><i data-gbar></i></div></div></div>
    <button class="sb-btn navy big play" data-play></button>
    <div class="two"><button class="sb-btn" data-daily><img src="${A('icons/calendar')}" alt=""><span>Daily<small data-dsub></small></span></button><button class="sb-btn" data-endless><img src="${A('icons/play')}" alt=""><span>Endless<small data-best></small></span></button></div>
    <div class="icons"><label><button class="sb-round" data-album aria-label="Stamp album"><img src="${A('icons/album')}" alt=""><b class="sb-hidden" data-anew></b></button>Album</label>
      <label><button class="sb-round" data-shop aria-label="Shop"><img src="${A('icons/shop')}" alt=""></button>Shop</label>
      <label><button class="sb-round" data-board aria-label="World board"><img src="${A('icons/trophy')}" alt=""></button>Board</label></div>
  </div></div>`);
const gview = $(`<div class="oi-layer sb-hidden">
  <div class="oi-top"><button class="sb-round" data-back aria-label="Back"><img src="${A('icons/home')}" alt=""></button><div class="sp"></div><div class="oi-starpill"><img src="${A('kit/star-full')}" alt=""><span data-stars>0</span></div></div>
  <div class="oi-gview-top"><div class="sb-ribbon sage" data-gtitle></div></div>
  <div class="oi-gview-bot"><h3 data-gh></h3><p data-gp></p><div class="row"><button class="sb-btn" data-back2>Back</button><button class="sb-btn sage" data-place></button></div></div></div>`);
const play = $(`<div class="oi-layer oi-play sb-hidden">
  <div class="oi-top"><button class="sb-round" data-home aria-label="Home"><img src="${A('icons/home')}" alt=""></button><button class="sb-round" data-set aria-label="Settings"><img src="${A('icons/settings')}" alt=""></button><div class="sp"></div>${coinPill()}</div>
  <div class="oi-goal"></div>
  <div class="oi-board"><div class="oi-grid"></div></div>
  <div class="oi-tray"><div class="oi-slot" data-i="0"></div><div class="oi-slot" data-i="1"></div><div class="oi-slot" data-i="2"></div></div>
  <div class="oi-boost">
    <label><button class="sb-round" data-b="hint" aria-label="Hint"><img src="${A('icons/hint')}" alt=""><b></b></button>Hint</label>
    <label><button class="sb-round" data-b="undo" aria-label="Undo"><img src="${A('icons/undo')}" alt=""><b></b></button>Undo</label>
    <label><button class="sb-round" data-b="swap" aria-label="New pieces"><img src="${A('icons/shuffle-arrows')}" alt=""><b></b></button>New</label></div>
</div>`);
document.body.append(home, gview, play);
const q = (root, s) => root.querySelector(s), qa = s => document.querySelectorAll(s);
const goalEl = q(play, '.oi-goal'), boardEl = q(play, '.oi-board'), gridEl = q(play, '.oi-grid'), trayEl = q(play, '.oi-tray'), boostEl = q(play, '.oi-boost');
const cells = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = document.createElement('div'); c.className = 'c' + (((Math.floor(x / 3) + Math.floor(y / 3)) % 2) ? ' alt' : ''); gridEl.appendChild(c); cells.push(c); }
const cellAt = (x, y) => cells[y * N + x];
const IMG = k => `url(${A('blocks/' + k)})`;

qa('[data-shop]').forEach(b => b.onclick = () => { audio.tap(); M.shop(); });
qa('[data-set]').forEach(b => b.onclick = () => { audio.tap(); settingsSheet(P, { M, howTo: 'Drag a wooden piece onto the board. Fill a whole row, a column or one of the nine 3×3 squares and it clears. In levels, clear the painted blossom blocks shown at the top. The game ends only when none of your three pieces fits. There is no timer.' }); });
q(home, '[data-play]').onclick = () => { audio.tap(); startGame('level'); };
q(home, '[data-endless]').onclick = () => { audio.tap(); startGame('endless'); };
q(home, '[data-daily]').onclick = () => { audio.tap(); if (st.dLast === dayNum()) dailyDoneSheet(); else startGame('daily'); };
q(home, '[data-album]').onclick = () => { audio.tap(); ALB.open(); };
q(home, '[data-board]').onclick = () => { audio.tap(); B.open(); };
q(home, '[data-garden]').onclick = () => { audio.tap(); openGarden(); };
q(play, '[data-home]').onclick = () => { audio.tap(); if (busy) return; leaveToHome(); };
qa('.oi-boost [data-b]').forEach(b => b.onclick = () => useBooster(b.dataset.b));
M.onChange(() => paintCoins(true));
function paintCoins(b) { qa('[data-coins]').forEach(e => { const v = M.coins().toLocaleString(); if (e.textContent !== v) { e.textContent = v; if (b) bump(e.parentElement); } }); }

// ---------------------------------------------------------------- layout
let LAY = { cell: 36, tc: 22 };
function layout() {
  const W = innerWidth, H = innerHeight, side = W / H > 0.95, top = 10 + 58 + 8;
  const goalH = 74, boostH = side ? 0 : 96, trayH = Math.round(Math.min(170, Math.max(118, H * 0.16)));
  const free = H - top - goalH - trayH - boostH - 16;
  const Bsz = Math.floor(Math.min(W - (side ? 260 : 12), free - 12, 640));
  const fw = Math.round(Math.max(16, Bsz * 0.05)), gp = Math.round(Math.max(4, Bsz * 0.012)), gg = Math.max(2, Math.round(Bsz * 0.006));
  const inner = Bsz - 2 * fw - 2 * gp, cell = (inner - 8 * gg) / 9;
  const slack = Math.max(0, free - 12 - Bsz), g1 = slack * 0.3;
  const goalTop = top + 4 + g1 * 0.4, boardTop = goalTop + goalH + 8 + g1 * 0.6, trayTop = boardTop + Bsz + slack * 0.25 + 6, boostTop = trayTop + trayH + slack * 0.15;
  Object.assign(boardEl.style, { left: (W - Bsz) / 2 + 'px', top: boardTop + 'px', width: Bsz + 'px', height: Bsz + 'px', borderWidth: fw + 'px' });
  boardEl.style.setProperty('--fw', fw + 'px'); gridEl.style.setProperty('--gp', gp + 'px'); gridEl.style.setProperty('--gg', gg + 'px');
  Object.assign(goalEl.style, { top: goalTop + 'px', width: Math.min(W - 16, Math.max(Bsz, 360)) + 'px', minHeight: goalH + 'px' });
  const trayW = Math.min(W - 12, Math.max(Bsz, 380));
  Object.assign(trayEl.style, { left: (W - trayW) / 2 + 'px', top: trayTop + 'px', width: trayW + 'px', height: trayH + 'px' });
  if (side) Object.assign(boostEl.style, { left: (W + Bsz) / 2 + 28 + 'px', top: boardTop + Bsz / 2 - 150 + 'px', flexDirection: 'column', width: 'auto' });
  else Object.assign(boostEl.style, { left: '0px', right: '0px', top: boostTop + 'px', flexDirection: 'row', width: '100%' });
  LAY = { cell, gg, slotW: trayW / 3, trayH, side, boardTop, trayTop, goalTop };
  if (game) paintTray();
}
addEventListener('resize', () => { layout(); });

// ---------------------------------------------------------------- game state
let mode = 'title', state = 'ready', game = null, busy = false, sel = -1, drag = null, botNext = 0, hintOn = null;
function pieceEl(p, size) {
  const el = document.createElement('div'); el.className = 'pc'; el.style.width = p.shape.w * size + 'px'; el.style.height = p.shape.h * size + 'px';
  const gap = Math.max(1, size * 0.05);
  p.shape.cells.forEach(([x, y], i) => { const b = document.createElement('i'); Object.assign(b.style, { left: x * size + gap / 2 + 'px', top: y * size + gap / 2 + 'px', width: size - gap + 'px', height: size - gap + 'px' }); b.style.setProperty('--img', IMG(i === p.goal ? p.gk : 'oak')); el.appendChild(b); });
  return el;
}
const trayCell = p => Math.min(LAY.cell * 0.78, (LAY.slotW - 18) / p.shape.w, (LAY.trayH - 20) / p.shape.h);
function paintTray() {
  trayEl.querySelectorAll('.oi-slot').forEach((s, i) => {
    s.innerHTML = ''; s.classList.toggle('sel', sel === i); const p = game && game.tray[i]; if (!p) return;
    s.appendChild(pieceEl(p, trayCell(p))); s.classList.toggle('dim', !anyFit(game.grid, p.shape));
  });
}
function paintCell(x, y) {
  const c = cellAt(x, y), v = game.grid[y][x];
  c.classList.toggle('blk', !!v); if (v) c.style.setProperty('--img', IMG(v.k)); else c.style.removeProperty('--img');
}
function paintBoard() { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) paintCell(x, y); }
function clearMarks() { cells.forEach(c => c.classList.remove('gh', 'hl', 'hint')); }
function showGhost(p, gx, gy) {
  clearMarks(); if (gx === null || !fits(game.grid, p.shape, gx, gy)) return false;
  p.shape.cells.forEach(([x, y], i) => { const c = cellAt(gx + x, gy + y); c.classList.add('gh'); c.style.setProperty('--gimg', IMG(i === p.goal ? p.gk : 'oak')); });
  const w = wouldClear(game.grid, p.shape, gx, gy); if (w.n) for (const [x, y] of clearCells(w)) cellAt(x, y).classList.add('hl');
  return true;
}

// ---------------------------------------------------------------- goal / score panel
function paintGoal(bumpK = null) {
  const g = game; if (!g) return;
  if (g.kind === 'endless') {
    goalEl.innerHTML = `<div class="lv">Endless<small>no timer</small></div><div class="score"><span data-score>${g.score.toLocaleString()}</span><small>Best ${Math.max(st.best, g.score).toLocaleString()}</small></div><div style="width:84px"></div>`;
    return;
  }
  const s3 = g.used <= g.L.par, s2 = g.used <= Math.round(g.L.par * 1.4);
  goalEl.innerHTML = `<div class="lv">${g.kind === 'daily' ? 'Daily' : 'Level ' + g.n}${g.kind === 'daily' ? '<small>puzzle</small>' : g.L.hard ? '<small>hard · short</small>' : ''}</div>
    <div class="chips">${g.goals.map(o => `<div class="oi-chip ${g.shown[o.k] <= 0 ? 'done' : ''}" data-k="${o.k}"><img src="${A('blocks/' + o.k)}" alt="${o.k} blocks"><b>${g.shown[o.k] <= 0 ? '✓' : g.shown[o.k]}</b></div>`).join('')}</div>
    <div class="meter"><div class="st"><img src="${A('kit/star-full')}" alt=""><img class="${s2 ? '' : 'off'}" src="${A('kit/star-full')}" alt=""><img class="${s3 ? '' : 'off'}" src="${A('kit/star-full')}" alt=""></div>${g.used} / ${g.L.par}</div>`;
  if (bumpK) bump(goalEl.querySelector(`[data-k="${bumpK}"]`));
}
function paintBoosts() {
  boostEl.querySelectorAll('[data-b]').forEach(b => { const k = b.dataset.b, n = st.boosts[k] || 0, badge = b.querySelector('b'); badge.className = n ? '' : 'coin'; badge.textContent = n ? n : PRICE[k]; });
}

// ---------------------------------------------------------------- start a game
function startGame(kind) {
  if (sheetOpen()) return;
  audio.unlock(); audio.music(true);
  const fk = kind === 'level' ? F.k() : 1;
  const seed = kind === 'daily' ? (D.seed || ymd()) * 7 + 3 : kind === 'level' ? st.level * 7919 + 13 : (Date.now() % 1e9);
  const r = rng(seed);
  const g = { kind, n: kind === 'level' ? st.level : 0, r, used: 0, score: 0, streak: 0, miss: 0, hist: [], revived: false, t0: performance.now(), boxes: new Set(), recorded: false, over: false };
  if (kind === 'endless') { g.grid = emptyGrid(); g.L = null; g.goals = []; g.need = {}; g.shown = {}; }
  else {
    g.L = makeLevel(kind === 'daily' ? 14 : st.level, fk, r, { daily: kind === 'daily' });
    if (kind === 'daily') g.L.dealer.help = 0.68;
    g.grid = g.L.grid; g.goals = g.L.goals; g.need = {}; g.shown = {}; for (const o of g.goals) { g.need[o.k] = o.n; g.shown[o.k] = o.n; }
  }
  g.dealer = makeDealer(r, kind === 'endless' ? endlessDealer(0, F.k(0)) : g.L.dealer);
  g.tray = g.dealer.deal(g.grid, needKinds(g));
  game = g; sel = -1; busy = false; mode = 'play'; state = 'play'; botNext = performance.now() + 1400;
  if (kind === 'level') M.level(st.level);
  B.start();
  home.classList.add('sb-hidden'); gview.classList.add('sb-hidden'); play.classList.remove('sb-hidden'); GS.layer.classList.add('sb-hidden');
  BG.show('oak-ivy'); layout(); paintBoard(); paintTray(); paintGoal(); paintBoosts(); paintCoins();
  // the board settles in, then the pieces slide up from the tray
  if (!reduced) { boardEl.animate([{ transform: 'scale(.92)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.2,.4,1)' }); dealAnim(); }
  const title = kind === 'daily' ? 'Daily Puzzle' : kind === 'endless' ? 'Endless' : `Level ${g.n}`;
  const sub = kind === 'level' && g.L.hard ? 'A hard one, but short' : kind === 'endless' ? 'Clear rows, columns and squares' : 'Clear the painted blocks';
  banner(title, sub, kind === 'level' && g.L.hard ? 'navy' : 'rose');
  if (kind === 'level' && st.level <= 2 && !st.seenHow) tip('Drag a piece onto the board. Fill a row, a column or a 3×3 square to clear it.', 9000);
}
const needKinds = g => Object.keys(g.need || {}).filter(k => g.need[k] > 0);
function banner(t, sub, color = 'rose') {
  const b = $(`<div class="oi-banner"><div class="sb-ribbon ${color}" style="min-width:280px;height:84px;font-size:calc(30px*var(--fs))">${t}</div><div style="font:italic 700 calc(24px*var(--fs))/1.2 var(--disp);color:var(--navy);text-shadow:0 0 10px #fffaf0,0 0 16px #fffaf0;margin-top:4px">${sub}</div></div>`);
  document.body.appendChild(b); setTimeout(() => b.remove(), 1700);
}
let tipEl = null;
function tip(text, ms = 5000) {
  if (tipEl) tipEl.remove(); tipEl = $(`<div class="oi-tip">${text}</div>`); tipEl.style.top = (LAY.trayTop - 74) + 'px'; play.appendChild(tipEl);
  const t = tipEl; setTimeout(() => { if (t === tipEl) { t.remove(); tipEl = null; } }, ms);
}
function dealAnim() {
  trayEl.querySelectorAll('.pc').forEach((pc, i) => pc.animate([{ transform: 'translateY(60px) scale(.6)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 380, delay: 80 * i, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' }));
}

// ---------------------------------------------------------------- input: drag a piece (or tap a piece, then tap the board)
const gridRect = () => gridEl.getBoundingClientRect();
function snap(px, py, p) {   // px,py = top-left of the floating piece in screen space → grid cell
  const r = gridRect(), gp = parseFloat(gridEl.style.getPropertyValue('--gp')) || 4, step = LAY.cell + LAY.gg;
  const gx = Math.round((px - r.left - gp) / step), gy = Math.round((py - r.top - gp) / step);
  if (gx < -1 || gy < -1 || gx > N || gy > N) return [null, null];
  return [gx, gy];
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// two wooden pieces glide from the tray onto the board (spots that clear nothing, so it never scores or wins by itself)
demo(() => {
  const g = game, b = bestMove(g.grid, g.tray, { want: g.need }), ok = (i, x, y) => g.tray[i] && fits(g.grid, g.tray[i].shape, x, y) && !wouldClear(g.grid, g.tray[i].shape, x, y).n;
  if (b && ok(b.i, b.x, b.y)) return void commit(b.i, b.x, b.y, null);
  for (let i = 0; i < 3; i++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (ok(i, x, y)) return void commit(i, x, y, null);
  return false;
}, { ready: () => state === 'play' && game && game.kind === 'level' && game.n === 1 && !busy && !drag && !card && !sheetOpen() && game.tray.filter(Boolean).length >= 2, wait: 1800, every: 1500, max: 2 });
trayEl.addEventListener('pointerdown', e => {
  if (state !== 'play' || busy || sheetOpen()) return;
  const slot = e.target.closest('.oi-slot'); if (!slot) return; const i = +slot.dataset.i, p = game.tray[i]; if (!p) return;
  e.preventDefault(); audio.unlock(); audio.pick(); clearHint();
  const step = LAY.cell + LAY.gg, fl = pieceEl(p, step); fl.classList.add('oi-float'); fl.classList.remove('pc'); document.body.appendChild(fl);
  const touch = e.pointerType !== 'mouse', lift = touch ? Math.max(70, step * 1.7) : 0;
  drag = { i, p, fl, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, lift, w: p.shape.w * step, h: p.shape.h * step, gx: null, gy: null };
  slot.querySelector('.pc').style.opacity = '0';
  moveDrag(e.clientX, e.clientY);
});
function moveDrag(x, y) {
  const d = drag; if (!d) return;
  const left = x - d.w / 2, top = y - d.h / 2 - d.lift - (d.lift ? d.h / 2 : 0);
  d.fl.style.transform = `translate(${left}px,${top}px)`;
  const [gx, gy] = snap(left, top, d.p); d.gx = gx; d.gy = gy;
  showGhost(d.p, gx, gy);
}
addEventListener('pointermove', e => { if (!drag) return; if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) drag.moved = true; moveDrag(e.clientX, e.clientY); });
addEventListener('pointerup', e => { if (drag) endDrag(e); });
addEventListener('pointercancel', e => { if (drag) endDrag(e, true); });
function endDrag(e, cancel = false) {
  const d = drag; drag = null; clearMarks();
  const slotPc = trayEl.querySelector(`.oi-slot[data-i="${d.i}"] .pc`);
  const quick = !d.moved && performance.now() - d.t0 < 400;
  if (!cancel && quick) { d.fl.remove(); if (slotPc) slotPc.style.opacity = ''; sel = sel === d.i ? -1 : d.i; paintTray(); if (sel >= 0) tip('Now tap the board where it should go.', 2600); return; }
  if (!cancel && d.gx !== null && fits(game.grid, d.p.shape, d.gx, d.gy)) { sel = -1; commit(d.i, d.gx, d.gy, d.fl); return; }
  // back to the tray
  audio.bad(); const r = trayEl.querySelector(`.oi-slot[data-i="${d.i}"]`).getBoundingClientRect();
  const a = d.fl.animate([{ transform: d.fl.style.transform }, { transform: `translate(${r.left + r.width / 2 - d.w / 2}px,${r.top + r.height / 2 - d.h / 2}px) scale(.6)`, opacity: 0.4 }], { duration: 220, easing: 'ease-in' });
  a.onfinish = () => { d.fl.remove(); if (slotPc) slotPc.style.opacity = ''; };
}
gridEl.addEventListener('pointerdown', e => {
  if (state !== 'play' || busy || sel < 0 || drag) return;
  const p = game.tray[sel]; if (!p) return;
  const r = gridRect(), step = LAY.cell + LAY.gg, cx = Math.floor((e.clientX - r.left) / step), cy = Math.floor((e.clientY - r.top) / step);
  const ox = Math.floor((p.shape.w - 1) / 2), oy = Math.floor((p.shape.h - 1) / 2);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const gx = cx - ox + dx, gy = cy - oy + dy;
    if (fits(game.grid, p.shape, gx, gy)) { const i = sel; sel = -1; commit(i, gx, gy, null); return; }
  }
  audio.bad(); boardEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 240 });
});

// ---------------------------------------------------------------- placing + clearing
function snapshot() { const g = game; return { grid: cloneGrid(g.grid), tray: g.tray.map(p => p && { ...p }), need: { ...g.need }, shown: { ...g.shown }, used: g.used, score: g.score, streak: g.streak, miss: g.miss, boxes: [...g.boxes] }; }
async function commit(i, gx, gy, fl) {
  const g = game, p = g.tray[i]; busy = true; clearHint(); if (tipEl) { tipEl.remove(); tipEl = null; }
  if (!st.seenHow) { st.seenHow = true; save(); }
  // the floating piece eases into its cells
  const r = gridRect(), gp = parseFloat(gridEl.style.getPropertyValue('--gp')) || 4, step = LAY.cell + LAY.gg;
  const tx = r.left + gp + gx * step, ty = r.top + gp + gy * step;
  if (!fl) { const sr = trayEl.querySelector(`.oi-slot[data-i="${i}"] .pc`).getBoundingClientRect(); fl = pieceEl(p, step); fl.className = 'oi-float'; document.body.appendChild(fl); trayEl.querySelector(`.oi-slot[data-i="${i}"] .pc`).style.opacity = '0';
    await fl.animate([{ transform: `translate(${sr.left}px,${sr.top}px) scale(${trayCell(p) / step})`, transformOrigin: '0 0' }, { transform: `translate(${(sr.left + tx) / 2}px,${Math.min(sr.top, ty) - 60}px) scale(1.05)`, transformOrigin: '0 0', offset: 0.55 }, { transform: `translate(${tx}px,${ty}px) scale(1)`, transformOrigin: '0 0' }], { duration: 430, easing: 'cubic-bezier(.4,0,.2,1)' }).finished; }
  else await fl.animate([{ transform: fl.style.transform }, { transform: `translate(${tx}px,${ty}px)` }], { duration: 90, easing: 'ease-out' }).finished;
  fl.remove();
  g.hist.push(snapshot()); if (g.hist.length > 4) g.hist.shift();
  const res = place(g.grid, p, gx, gy); g.tray[i] = null; g.used++;
  for (const b of res.boxes) g.boxes.add(b);
  p.shape.cells.forEach(([x, y], k) => { const c = cellAt(gx + x, gy + y); c.classList.add('blk'); c.style.setProperty('--img', IMG(k === p.goal ? p.gk : 'oak')); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); });
  audio.place(g.streak); buzz(8);
  let gained = points(p.shape.n, 0, 0, false);
  if (res.groups) {
    g.streak++; g.miss = 0; gained = points(p.shape.n, res.groups, g.streak, res.empty);
    await clearAnim(res, gx + p.shape.w / 2, gy + p.shape.h / 2);
  } else { g.miss++; if (g.miss >= 3) g.streak = 0; }
  g.score += gained;
  if (g.kind === 'endless') {
    const sc = goalEl.querySelector('[data-score]'); if (sc) { sc.textContent = g.score.toLocaleString(); bump(sc); }
    if (g.score > st.best && st.best > 0 && !g.bestPopped) { g.bestPopped = true; const br = boardEl.getBoundingClientRect(); word('New best!', br.left + br.width / 2, br.top + br.height * 0.3, 46); audio.chime(); }
    g.dealer = makeDealer(g.r, endlessDealer(g.score, F.k(g.score)));
  }
  paintGoal();
  // a level is won once every painted block it asked for is cleared
  if (g.kind !== 'endless' && needKinds(g).length === 0) { busy = false; return win(); }
  if (g.tray.every(t => !t)) { g.tray = g.dealer.deal(g.grid, needKinds(g)); paintTray(); dealAnim(); }
  else paintTray();
  busy = false;
  if (!g.tray.some(t => t && anyFit(g.grid, t.shape))) return lose();
}
async function clearAnim(res, cx, cy) {
  const g = game, br = gridRect(), step = LAY.cell + LAY.gg, gp = parseFloat(gridEl.style.getPropertyValue('--gp')) || 4;
  const words = ['', '', 'Lovely!', 'Splendid!', 'Marvellous!', 'Magnificent!'];
  audio.clear(res.groups, g.streak); buzz([10, 30, 14]);
  const sx = br.left + gp + cx * step, sy = br.top + gp + cy * step;
  const flights = [];
  for (const c of res.cleared) {
    const el = cellAt(c.x, c.y), rr = el.getBoundingClientRect(), d = Math.hypot(c.x + 0.5 - cx, c.y + 0.5 - cy);
    el.classList.remove('blk', 'pop'); el.style.removeProperty('--img');
    const k = c.k, isGoal = g.need && g.shown[k] !== undefined && g.shown[k] > 0 && g.kind !== 'endless';
    if (isGoal && g.need[k] > 0) {
      g.need[k]--;
      const chip = goalEl.querySelector(`[data-k="${k}"]`);
      if (chip) flights.push(flyTo(A('blocks/' + k), { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 }, chip, { size: rr.width, dur: 620, delay: d * 28, arc: -60 }).then(() => { g.shown[k] = Math.max(0, g.shown[k] - 1); paintGoal(k); audio.pluck(84 + (g.goals.findIndex(o => o.k === k)) * 3, { vol: 0.07, dur: 0.7 }); }));
      continue;
    }
    const clone = document.createElement('div'); clone.className = 'oi-float';
    Object.assign(clone.style, { width: rr.width + 'px', height: rr.height + 'px', background: `${IMG(k)} center/100% 100%`, borderRadius: '4px', filter: 'none', boxShadow: '0 2px 3px rgba(60,35,10,.35)' });
    document.body.appendChild(clone);
    const rot = (Math.random() - 0.5) * 50;
    clone.animate([{ transform: `translate(${rr.left}px,${rr.top}px) scale(1)` }, { transform: `translate(${rr.left}px,${rr.top - 6}px) scale(1.16)`, filter: 'brightness(1.25)', offset: 0.35 }, { transform: `translate(${rr.left + rr.width * 0.1}px,${rr.top + 8}px) scale(0) rotate(${rot}deg)`, opacity: 0 }],
      { duration: 460, delay: d * 34, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'backwards' }).onfinish = () => clone.remove();
  }
  // petals from each finished group
  const centres = [...res.rows.map(y => [4.5, y + 0.5]), ...res.cols.map(x => [x + 0.5, 4.5]), ...res.boxes.map(b => [(b % 3) * 3 + 1.5, Math.floor(b / 3) * 3 + 1.5])];
  centres.forEach(([x, y], k) => setTimeout(() => fx.burst(br.left + gp + x * step, br.top + gp + y * step, 14, { speed: 4.5 }), 120 + k * 90));
  const w = words[Math.min(5, res.groups + (g.streak >= 3 ? 1 : 0))];
  if (res.empty) { word('Clean board!', br.left + br.width / 2, br.top + br.height * 0.42, 50); fx.rain(30); }
  else if (w) word(w, br.left + br.width / 2, Math.max(br.top + 40, sy - 30), 44 + res.groups * 3);
  if (g.streak >= 2) setTimeout(() => word(`Streak ×${g.streak}`, br.left + br.width / 2, Math.max(br.top + 90, sy + 20), 30, '#f4dfa0'), 320);
  if (g.kind === 'endless') { const pts = points(0, res.groups, g.streak, res.empty); word('+' + pts, sx, sy, 30, '#fff3cf'); }
  await wait(flights.length ? 300 : 220);
  if (flights.length) await Promise.race([Promise.all(flights), wait(1400)]);
}

// ---------------------------------------------------------------- boosters (inventory first, then coins; hint can be a reward video)
function clearHint() { if (!hintOn) return; hintOn = null; clearMarks(); trayEl.querySelectorAll('.oi-slot').forEach(s => s.classList.remove('hint')); }
async function useBooster(k) {
  if (state !== 'play' || busy || sheetOpen()) return; audio.tap();
  const g = game;
  if (k === 'undo' && !g.hist.length) { toast('Nothing to undo yet'); return; }
  if (k === 'hint' && !bestMove(g.grid, g.tray, { want: g.need })) { toast('No piece fits: try New pieces'); return; }
  let paid = false;
  if (st.boosts[k] > 0) { st.boosts[k]--; paid = true; }
  else if (M.coins() >= PRICE[k]) paid = M.spend(PRICE[k], 'booster:' + k);
  else if (k === 'hint') { busy = true; paid = await M.rewarded('hint', { what: 'the best place for a piece, shown on the board' }); busy = false; }
  else { toast(`That costs ${PRICE[k]} coins`); M.shop(); return; }
  if (!paid) return;
  save(); paintBoosts();
  if (k === 'hint') {
    const b = bestMove(g.grid, g.tray, { want: g.need }); if (!b) return;
    clearMarks(); hintOn = b; const p = g.tray[b.i];
    p.shape.cells.forEach(([x, y]) => cellAt(b.x + x, b.y + y).classList.add('hint'));
    trayEl.querySelector(`.oi-slot[data-i="${b.i}"]`).classList.add('hint'); audio.chime();
  } else if (k === 'undo') {
    const s = g.hist.pop(); Object.assign(g, { grid: s.grid, tray: s.tray, need: s.need, shown: s.shown, used: s.used, score: s.score, streak: s.streak, miss: s.miss, boxes: new Set(s.boxes) });
    paintBoard(); paintTray(); paintGoal(); audio.gliss();
  } else if (k === 'swap') {
    g.tray = g.dealer.deal(g.grid, needKinds(g)); paintTray(); dealAnim(); audio.gliss();
  }
}

// ---------------------------------------------------------------- win / lose cards
let card = null;
function showCard(html, onTap) {
  if (card) card.remove();
  card = $(`<div class="oi-card"><div class="sb-sheet"><img class="corner tl" src="${A('kit/corner-roses')}" alt=""><img class="corner br" src="${A('kit/corner-roses')}" alt="">${html}</div></div>`);
  card.addEventListener('click', e => { if (e.target.closest('[data-stop]')) return; const c = card; if (!c || c.dataset.locked) return; c.remove(); if (card === c) card = null; onTap(e.target.closest('[data-act]') ? e.target.closest('[data-act]').dataset.act : 'go'); });
  document.body.appendChild(card); return card;
}
const starsFor = g => g.used <= g.L.par ? 3 : g.used <= Math.round(g.L.par * 1.4) ? 2 : 1;
async function win() {
  const g = game; if (g.over) return; g.over = true; state = 'won'; busy = true;
  const ms = performance.now() - g.t0, stars = starsFor(g);
  if (!g.recorded && g.kind === 'level') { F.level(true); g.recorded = true; }
  // celebrate on the board first
  const br = boardEl.getBoundingClientRect(); audio.win(); fx.rain(36); fx.burst(br.left + br.width / 2, br.top + br.height / 2, 30, { speed: 7 });
  word(g.kind === 'daily' ? 'Solved!' : 'Level complete!', br.left + br.width / 2, br.top + br.height * 0.45, 50);
  const coins = g.kind === 'daily' ? 40 : 10 + stars * 5;
  st.stars += stars; st.wins++;
  let stamp = null;
  if (g.kind === 'daily') {
    const sk = STREAK.win(); st.dLast = dayNum(); st.dRes = { stars, used: g.used, boxes: [...g.boxes], day: ymd(), streak: sk.n, froze: sk.froze }; stamp = ALB.award();
  } else { st.level++; if (g.n % 2 === 0 || g.n === 1) stamp = ALB.award(); }
  save(); M.add(coins, g.kind === 'daily' ? 'daily' : 'win');
  D.won(stars, 'earned ⭐'); B.submit(stars, { ms });
  await wait(1100);
  const nextG = GARDEN.find(it => !st.garden.includes(it.id));
  const canRestore = nextG && starsLeft() >= nextG.cost;
  const c = showCard(`<div class="sb-ribbon ${g.kind === 'daily' ? 'navy' : 'rose'}">${g.kind === 'daily' ? 'Daily Puzzle' : 'Level ' + g.n}</div>
    <h2 style="margin-top:6px">${['', 'Well done', 'Splendid!', 'Marvellous!'][stars]}</h2>
    <div class="sb-stars">${[0, 1, 2].map(k => `<img class="${k < stars ? 'on' : ''}" style="animation-delay:${0.25 + k * 0.28}s" src="${A(k < stars ? 'kit/star-full' : 'kit/star-empty')}" alt="">`).join('')}</div>
    <div class="reward"><img src="${A('kit/coin')}" alt=""><span data-cw>+${coins}</span></div>
    ${stamp ? `<div class="stamp"><img src="${A('stamps/stamp-' + stamp.id)}" alt=""><div style="text-align:left"><b>New stamp!</b><br>${stamp.pageName}${stamp.bonus ? `<br>Page complete: +${stamp.bonus}` : ''}</div></div>` : ''}
    ${g.kind === 'daily' ? `<p style="margin:4px 0">🔥 ${st.dRes.streak}-day streak${st.dRes.froze ? ' (your weekly freeze kept it)' : ''}</p>` : ''}
    <div class="stack">
      <button class="sb-btn rose" data-stop data-double><img src="${A('icons/video')}" alt=""><span>Double coins<small>short video · +${coins} more</small></span></button>
      ${g.kind === 'daily' ? `<button class="sb-btn" data-stop data-share><img src="${A('icons/share')}" alt="">Share result</button>` : ''}
      <button class="sb-btn navy big" data-act="${g.kind === 'level' ? 'next' : 'home'}">${g.kind === 'level' ? 'Next level' : 'Continue'}</button>
      ${canRestore ? `<button class="sb-btn sage" data-act="garden"><img src="${A('kit/star-full')}" alt="">Restore the garden</button>` : `<button class="lnk" data-act="home">Home</button>`}
    </div>`, async act => {
      state = 'ready';
      if (act === 'next') { await M.breakAd('level-end', { level: g.n }); startGame('level'); }
      else if (act === 'garden') { await M.breakAd('level-end', { level: g.n }); leaveToHome(); openGarden(); }
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
  const d = new Date(); const dd = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const grid = [0, 1, 2].map(row => [0, 1, 2].map(col => r.boxes.includes(row * 3 + col) ? '🌿' : '🟫').join('')).join('\n');
  return `Oak & Ivy · Daily ${dd}\n${'⭐'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} in ${r.used} pieces\n${grid}\n🔥 ${r.streak}-day streak\n${location.origin}${location.pathname}?daily=1`;
}
function dailyDoneSheet() {
  const r = st.dRes, now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), h = Math.ceil((next - now) / 36e5);
  const sh = sheet({ html: `<h2>Today's puzzle is done</h2><img class="divider" src="${A('kit/divider')}" alt="">
    ${r ? `<div class="sb-stars">${[0, 1, 2].map(k => `<img src="${A(k < r.stars ? 'kit/star-full' : 'kit/star-empty')}" alt="">`).join('')}</div><p>Solved in ${r.used} pieces · 🔥 ${STREAK.n}-day streak</p>` : ''}
    <p>A new one arrives in about ${h} hour${h === 1 ? '' : 's'}.</p><div class="row"><button class="sb-btn" data-share><img src="${A('icons/share')}" alt="">Share</button><button class="sb-btn navy" data-ok>Play a level</button></div>` });
  sh.q('[data-share]').onclick = () => share(shareText());
  sh.q('[data-ok]').onclick = () => { sh.close(); startGame('level'); };
}
async function lose() {
  const g = game; if (g.over) return; g.over = true; state = 'lost'; busy = true;
  const ms = performance.now() - g.t0; audio.lose();
  boardEl.animate([{ filter: 'drop-shadow(0 14px 18px rgba(60,40,20,.35)) saturate(1)' }, { filter: 'drop-shadow(0 14px 18px rgba(60,40,20,.35)) saturate(.4)' }], { duration: 600, fill: 'forwards' });
  // the run is recorded for flow.js only when the player leaves the card (a revive keeps the same run going)
  const record = () => {
    if (g.recorded) return; g.recorded = true;
    if (g.kind === 'level') { const tot = g.goals.reduce((a, o) => a + o.n, 0), left = Object.values(g.need).reduce((a, b) => a + Math.max(0, b), 0); F.level(false, tot ? 1 - left / tot : 0); }
    if (g.kind === 'endless') F.endless(g.score);
  };
  let stamp = null, coins = 0;
  if (g.kind === 'endless') {
    const newBest = g.score > st.best; if (newBest) st.best = g.score;
    coins = Math.min(60, Math.floor(g.score / 120)) - (g.coinsGiven || 0); g.coinsGiven = (g.coinsGiven || 0) + Math.max(0, coins); if (coins > 0) M.add(coins, 'endless'); else coins = 0;
    if (g.score >= 1000 && st.endStamp !== dayNum()) { st.endStamp = dayNum(); stamp = ALB.award(); }
    save();
  }
  await wait(900);
  const left = g.kind !== 'endless' ? Object.values(g.need).reduce((a, b) => a + Math.max(0, b), 0) : 0;
  const c = showCard(`<div class="sb-ribbon navy">${g.kind === 'endless' ? 'Endless' : g.kind === 'daily' ? 'Daily Puzzle' : 'Level ' + g.n}</div>
    <h2 style="margin-top:6px">${g.kind === 'endless' ? (g.score >= st.best && g.score > 0 ? 'A new best!' : 'Out of room') : 'Out of room'}</h2>
    ${g.kind === 'endless' ? `<div class="reward" style="font-size:calc(44px*var(--fs))">${g.score.toLocaleString()}</div><p style="margin:0">Best ${st.best.toLocaleString()}${coins ? ` · +${coins} coins` : ''}</p>` : `<p>Only ${left} painted block${left === 1 ? '' : 's'} left to clear.</p>`}
    ${stamp ? `<div class="stamp"><img src="${A('stamps/stamp-' + stamp.id)}" alt=""><div style="text-align:left"><b>New stamp!</b><br>${stamp.pageName}</div></div>` : ''}
    <div class="stack"><div data-offer style="min-height:72px"></div>
      <button class="sb-btn navy big" data-act="retry">${g.kind === 'endless' ? 'Play again' : 'Try again'}</button>
      <button class="lnk" data-act="home">Home</button></div>`, async act => {
      state = 'ready'; record();
      if (act === 'retry') { if (g.kind === 'daily') startGame('daily'); else startGame(g.kind); }
      else leaveToHome();
    });
  // one offer, never in the first 1.2 s after losing (the iOS app shows its own card then)
  if (!g.revived) setTimeout(() => {
    if (card !== c) return;
    const b = $(`<button class="sb-btn rose" data-stop style="width:100%"><img src="${A('icons/video')}" alt=""><span>Keep going<small>short video · clear a square + new pieces</small></span></button>`);
    c.querySelector('[data-offer]').appendChild(b); b.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300 });
    b.onclick = async () => { b.disabled = true; c.dataset.locked = 1; const ok = await M.rewarded('revive', { what: 'the fullest 3×3 square cleared and three fresh pieces' }); delete c.dataset.locked; if (ok) { c.remove(); card = null; revive(); } else b.remove(); };
  }, 1300);
  busy = false;
}
async function revive() {
  const g = game; g.revived = true; g.over = false; state = 'play';
  boardEl.getAnimations().forEach(a => a.cancel());
  let bestB = 0, bestN = -1;
  for (let b = 0; b < 9; b++) { let n = 0; for (let k = 0; k < 9; k++) if (g.grid[Math.floor(b / 3) * 3 + Math.floor(k / 3)][(b % 3) * 3 + k % 3]) n++; if (n > bestN) { bestN = n; bestB = b; } }
  const res = { rows: [], cols: [], boxes: [bestB], groups: 1, cleared: [], empty: false };
  for (let k = 0; k < 9; k++) { const x = (bestB % 3) * 3 + k % 3, y = Math.floor(bestB / 3) * 3 + Math.floor(k / 3); if (g.grid[y][x]) { res.cleared.push({ x, y, k: g.grid[y][x].k }); g.grid[y][x] = null; } }
  busy = true; await clearAnim(res, (bestB % 3) * 3 + 1.5, Math.floor(bestB / 3) * 3 + 1.5); busy = false;
  g.tray = makeDealer(g.r, { help: 1, big: 0.6, small: 1.2, goalRate: g.kind === 'endless' ? 0 : 0.5, sequential: true }).deal(g.grid, needKinds(g));
  paintTray(); dealAnim(); paintGoal();
  if (g.kind !== 'endless' && needKinds(g).length === 0) return win();
}

// ---------------------------------------------------------------- home + garden
function leaveToHome() {
  if (card) { card.remove(); card = null; }
  if (game && state === 'play' && !game.recorded && game.kind === 'level' && game.used > 0) { const tot = game.goals.reduce((a, o) => a + o.n, 0), left = Object.values(game.need).reduce((a, b) => a + Math.max(0, b), 0); F.level(false, tot ? 1 - left / tot : 0); game.recorded = true; }
  game = null; mode = 'title'; state = 'ready'; clearMarks();
  play.classList.add('sb-hidden'); gview.classList.add('sb-hidden'); home.classList.remove('sb-hidden'); GS.layer.classList.remove('sb-hidden');
  BG.show('meta-garden'); { const nx = GARDEN.find(it => !st.garden.includes(it.id)); GS.set(st.garden, nx ? nx.id : null); } paintHome(); audio.music(true);
}
function paintHome() {
  qa('[data-stars]').forEach(e => e.textContent = starsLeft());
  const next = GARDEN.find(it => !st.garden.includes(it.id)), chap = st.garden.length < 12 ? 0 : 1, ch = CHAPTERS[chap];
  q(home, '[data-play]').innerHTML = `<img src="${A('icons/play')}" alt="">Play · Level ${st.level}`;
  q(home, '[data-best]').textContent = st.best ? `best ${st.best.toLocaleString()}` : 'no timer';
  const dd = st.dLast === dayNum();
  q(home, '[data-dsub]').textContent = dd ? 'done ✓' : STREAK.n ? `🔥 ${STREAK.n} days` : 'new today';
  q(home, '[data-streak]').innerHTML = STREAK.n > 1 ? `<div class="sb-ribbon oi-streak" style="font-size:calc(19px*var(--fs));height:60px;min-width:230px"><span><small>daily streak</small>${STREAK.n} days</span></div>` : '';
  const doneIn = st.garden.filter(id => { const k = GARDEN.findIndex(i => i.id === id); return k >= ch.from && k < ch.to; }).length;
  q(home, '[data-gname]').textContent = next ? ch.name : 'Garden restored ✿';
  q(home, '[data-gnext]').textContent = next ? (starsLeft() >= next.cost ? `Ready: place the ${next.name} (★${next.cost})` : `Next: ${next.name} · ★${next.cost}`) : 'Every piece placed. Thank you!';
  q(home, '[data-gbar]').style.width = (next ? doneIn / 12 : 1) * 100 + '%';
  q(home, '[data-gimg]').src = A(next ? next.src : 'kit/rosette');
  q(home, '.oi-garden-card').style.borderColor = next && starsLeft() >= next.cost ? '#b08834' : '';
  const an = q(home, '[data-anew]'); an.textContent = ALB.fresh; an.classList.toggle('sb-hidden', !ALB.fresh);
  paintCoins();
}
function openGarden() {
  if (sheetOpen()) return;
  home.classList.add('sb-hidden'); gview.classList.remove('sb-hidden'); mode = 'garden';
  const draw = () => {
    const next = GARDEN.find(it => !st.garden.includes(it.id)), chap = st.garden.length < 12 ? 0 : 1, ch = CHAPTERS[chap];
    const doneIn = st.garden.filter(id => { const k = GARDEN.findIndex(i => i.id === id); return k >= ch.from && k < ch.to; }).length;
    q(gview, '[data-gtitle]').innerHTML = `<span><small>chapter ${chap + 1} · ${doneIn}/12</small>${ch.name}</span>`;
    qa('[data-stars]').forEach(e => e.textContent = starsLeft());
    GS.set(st.garden, next ? next.id : null);
    const pb = q(gview, '[data-place]');
    if (!next) { q(gview, '[data-gh]').textContent = 'The garden is complete'; q(gview, '[data-gp]').textContent = 'Every piece is in place. Keep playing for stamps and your best score.'; pb.classList.add('sb-hidden'); return; }
    pb.classList.remove('sb-hidden');
    q(gview, '[data-gh]').textContent = next.name;
    const can = starsLeft() >= next.cost;
    q(gview, '[data-gp]').textContent = can ? `Place it for ★${next.cost}. It goes where it shimmers.` : `Needs ★${next.cost}. You have ★${starsLeft()}. Win levels to earn up to 3 stars each.`;
    pb.innerHTML = can ? `<img src="${A('kit/star-full')}" alt="">Place ★${next.cost}` : `<img src="${A('icons/play')}" alt="">Play`;
    pb.onclick = async () => {
      audio.tap();
      if (!can) { gview.classList.add('sb-hidden'); startGame('level'); return; }
      pb.disabled = true; st.spent += next.cost; st.garden.push(next.id); save();
      const sp = GS.spot(next.id), pill = q(gview, '.oi-starpill');
      const pr = pill.getBoundingClientRect();
      for (let k = 0; k < Math.min(next.cost, 6); k++) flyTo(A('kit/star-full'), { x: pr.left + 24, y: pr.top + 24 }, { getBoundingClientRect: () => ({ left: sp.x - 10, top: sp.y - 10, width: 20, height: 20 }) }, { size: 40, delay: k * 80, dur: 600, arc: -120 });
      qa('[data-stars]').forEach(e => e.textContent = starsLeft());
      await wait(700); await GS.place(next.id);
      word(next.name, innerWidth / 2, Math.max(150, sp.y - 80), 40);
      const chDone = st.garden.length === 12 || st.garden.length === 24;
      if (chDone) { await wait(600); fx.rain(60); audio.win(); M.add(200, 'garden-chapter'); toast(`${CHAPTERS[st.garden.length === 12 ? 0 : 1].name} restored! +200 coins`, 4000); }
      await wait(500); pb.disabled = false; draw();
    };
  };
  q(gview, '[data-back]').onclick = q(gview, '[data-back2]').onclick = () => { audio.tap(); leaveToHome(); };
  draw();
}

// ---------------------------------------------------------------- QA hooks: state + a bot that plays like a person
window.__game = {
  get state() { return state; }, get level() { return game ? (game.kind === 'level' ? game.n : 1) : st.level; }, get score() { return game ? (game.kind === 'endless' ? game.score : st.stars) : st.stars; },
  bot() {
    const now = performance.now();
    // on the home or garden screen the QA player simply starts the next level (after a human-like pause)
    if (state === 'ready' && !game && !card && !sheetOpen()) { if (!this._idle) this._idle = now; if (now - this._idle > 1800) { this._idle = 0; startGame('level'); } return; }
    this._idle = 0;
    if (state !== 'play' || busy || drag || sheetOpen() || !game) return;
    if (now < botNext) return;
    botNext = now + 1150 + Math.random() * 500;   // human pace: about one piece a second and a bit
    const b = bestMove(game.grid, game.tray, { want: game.need }); if (!b) return;
    commit(b.i, b.x, b.y, null);
  },
  // QA only: a careless player (first spot that fits), to reach the out-of-room card quickly
  careless() { if (state !== 'play' || busy || !game) return; for (let i = 0; i < 3; i++) { const p = game.tray[i]; if (!p) continue; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fits(game.grid, p.shape, x, y) && (x + y) % 2 === 0) return commit(i, x, y, null); } },
};

// ---------------------------------------------------------------- boot
(async () => {
  const load = document.getElementById('oi-load'), bar = load.querySelector('b');
  const wide = innerWidth / innerHeight >= 1;
  const list = [A(`bg/meta-garden${wide ? '-wide' : ''}-s`), A(`bg/oak-ivy${wide ? '-wide' : ''}-s`), A('blocks/wood-board'), ...['oak', 'walnut', 'rose', 'sage', 'navy'].map(k => A('blocks/' + k)),
    ...['menu', 'home', 'settings', 'hint', 'undo', 'shuffle-arrows', 'calendar', 'play', 'album', 'shop', 'trophy', 'close'].map(k => A('icons/' + k)),
    ...['coin', 'star-full', 'star-empty', 'paper', 'ribbon-rose', 'ribbon-navy', 'ribbon-sage', 'corner-roses', 'divider'].map(k => A('kit/' + k)), ...GARDEN.filter(i => st.garden.includes(i.id)).map(i => A(i.src))];
  await Promise.race([preload(list, f => bar.style.width = f * 100 + '%'), wait(6000)]);
  P.init(); layout();
  if (D.isDaily && st.dLast !== dayNum()) { home.classList.add('sb-hidden'); startGame('daily'); }
  else leaveToHome();
  load.style.opacity = 0; setTimeout(() => load.remove(), 500);
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  // warm the rest of the art in the background
  setTimeout(() => preload([...GARDEN.map(i => A(i.src)), A('bg/meta-garden' + (wide ? '-wide' : '')), A('bg/oak-ivy' + (wide ? '-wide' : ''))]), 1500);
})();

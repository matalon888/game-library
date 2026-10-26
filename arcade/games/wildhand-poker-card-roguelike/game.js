// Wildhand — a poker-hand roguelike. Play hands from your deck to beat each blind's score target, earn ✦ stars,
// spend them at camp on charm cards that bend the scoring rules. Antes rise until your run runs out of hands.
import { createUI, store, buzz, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { css, cardTheme, startCard, fx2d, arp, soft } from './calm.js';

const NAME = 'Wildhand: Poker Card Roguelike';
const S = store('wildhand');
const F = flow('wildhand');
const ui = createUI({ title: 'Wildhand', hint: 'Tap to deal', hand: '', score: false, progress: false });
cardTheme({ accent: '#ff7a59' });
const D = daily('wildhand', ui, { name: NAME });
const B = board({ game: 'wildhand', label: 'Blinds beaten', limits: { maxRun: 60, maxPerSec: 0.5 }, corner: 'tl', accent: '#ffb347' });
const fx = fx2d(30);
startCard(ui, D, { kicker: D.isDaily ? 'Daily run · same deck for everyone' : 'Poker card roguelike', dailySub: 'Same deck and shops for everyone' });
{ const p = document.createElement('p'); const b = S.get('best', 0); p.textContent = b ? `Best run: ${b} blinds · Ante ${Math.floor(b / 3) + 1}` : 'Beat the score target with poker hands'; p.style.marginTop = '6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
ui.els.win.querySelector('p').innerHTML = 'BLIND <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'Beaten!';
ui.els.win.querySelector('.hint').textContent = 'Tap to visit camp';
ui.els.lose.querySelector('.hint').textContent = D.isDaily ? 'Tap to retry today\'s run' : 'Tap for a new run';

// ---------------------------------------------------------------- data
const SUIT = ['♠', '♥', '♦', '♣'], SCOL = ['#2f3a8f', '#e0475b', '#e58a1f', '#16907a'];
const RN = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }, rname = r => RN[r] || String(r);
const rpts = r => r === 14 ? 11 : r > 10 ? 10 : r;
const HT = [ // name, base pts, base mult, +pts / level, +mult / level
  ['High card', 5, 1, 10, 1], ['Pair', 10, 2, 15, 1], ['Two pair', 20, 2, 20, 1], ['Three of a kind', 30, 3, 20, 2],
  ['Straight', 30, 4, 30, 3], ['Flush', 35, 4, 15, 2], ['Full house', 40, 4, 25, 2], ['Four of a kind', 60, 7, 30, 3], ['Straight flush', 100, 8, 40, 4]];
// charms: our own modifier set. card(c, a, ctx) runs per scored card, hand(h, a, ctx) once per hand, after the cards.
const CH = [
  { id: 'plus', n: 'Plus Four', i: '➕', c: 4, d: '+4 mult', hand: (h, a) => a.mult(4) },
  { id: 'pair', n: 'Pair Pal', i: '👯', c: 4, d: '+8 mult if the hand has a pair', hand: (h, a) => h.pair && a.mult(8) },
  { id: 'twin', n: 'Twin Peaks', i: '⛰️', c: 5, d: '+12 mult if the hand has two pair', hand: (h, a) => h.two && a.mult(12) },
  { id: 'bell', n: 'Three Bells', i: '🔔', c: 5, d: '+14 mult if the hand has three of a kind', hand: (h, a) => h.three && a.mult(14) },
  { id: 'arrow', n: 'Straight Arrow', i: '🏹', c: 5, d: '+12 mult if the hand has a straight', hand: (h, a) => h.straight && a.mult(12) },
  { id: 'fan', n: 'Flush Fan', i: '🪭', c: 5, d: '+12 mult if the hand has a flush', hand: (h, a) => h.flush && a.mult(12) },
  { id: 'heart', n: 'Heart Lamp', i: '🏮', c: 5, d: 'Scored ♥ cards give +3 mult', card: (c, a) => c.s === 1 && a.mult(3) },
  { id: 'dia', n: 'Amber Drill', i: '🔶', c: 5, d: 'Scored ♦ cards give +3 mult', card: (c, a) => c.s === 2 && a.mult(3) },
  { id: 'spade', n: 'Night Spade', i: '🌙', c: 4, d: 'Scored ♠ cards give +30 pts', card: (c, a) => c.s === 0 && a.pts(30) },
  { id: 'club', n: 'Clover Cushion', i: '🍀', c: 4, d: 'Scored ♣ cards give +30 pts', card: (c, a) => c.s === 3 && a.pts(30) },
  { id: 'face', n: 'Face Painter', i: '🎭', c: 5, d: 'Scored J, Q, K give +30 pts', card: (c, a) => c.r > 10 && c.r < 14 && a.pts(30) },
  { id: 'even', n: 'Even Steven', i: '⚖️', c: 5, d: 'Scored 2, 4, 6, 8, 10 give +4 mult', card: (c, a) => c.r <= 10 && c.r % 2 === 0 && a.mult(4) },
  { id: 'odd', n: 'Odd Owl', i: '🦉', c: 5, d: 'Scored A, 3, 5, 7, 9 give +31 pts', card: (c, a) => (c.r === 14 || (c.r < 10 && c.r % 2 === 1)) && a.pts(31) },
  { id: 'ace', n: 'Ace Kite', i: '🪁', c: 4, d: 'Scored aces give +20 pts and +4 mult', card: (c, a) => c.r === 14 && (a.pts(20), a.mult(4)) },
  { id: 'half', n: 'Half Hand', i: '✋', c: 5, d: '+20 mult if you play 3 or fewer cards', hand: (h, a) => h.n <= 3 && a.mult(20) },
  { id: 'five', n: 'High Five', i: '🖐️', c: 4, d: '+60 pts if you play exactly 5 cards', hand: (h, a) => h.n === 5 && a.pts(60) },
  { id: 'spool', n: 'Spare Spool', i: '🧵', c: 5, d: '+3 mult for each discard left', hand: (h, a, x) => x.discards && a.mult(3 * x.discards) },
  { id: 'vine', n: 'Growing Vine', i: '🌱', c: 6, d: 'Gains +1 mult every hand you play', hand: (h, a, x, ch) => { if (!x.dry) ch.g = (ch.g || 0) + 1; a.mult((ch.g || 0) + (x.dry ? 1 : 0)); }, extra: ch => ` (now +${ch.g || 0})` },
  { id: 'drum', n: 'Steady Drum', i: '🥁', c: 6, d: '×1.5 mult', hand: (h, a) => a.x(1.5) },
  { id: 'kite', n: 'Rainbow Kite', i: '🌈', c: 7, d: '×2 mult if the played cards hold all 4 suits', hand: (h, a) => h.suits === 4 && a.x(2) },
  { id: 'gasp', n: 'Last Gasp', i: '🕯️', c: 6, d: '×3 mult on the final hand of a blind', hand: (h, a, x) => x.hands === 1 && a.x(3) },
  { id: 'clover', n: 'Lucky Bug', i: '🐞', c: 5, d: 'Each scored card: 1 in 4 chance of +10 mult', card: (c, a, x) => !x.dry && x.luck() < 0.25 && a.mult(10) },
  { id: 'seed', n: 'Star Seed', i: '🌟', c: 4, d: '+2 ✦ after every blind you beat', end: () => 2 },
];
const CHI = Object.fromEntries(CH.map(c => [c.id, c]));
const BOSS = [
  { n: 'The Grey Moth', d: '♥ cards score nothing', suit: 1 }, { n: 'The Iron Owl', d: '♠ cards score nothing', suit: 0 },
  { n: 'The Dust Hare', d: '♦ cards score nothing', suit: 2 }, { n: 'The Bog Toad', d: '♣ cards score nothing', suit: 3 },
  { n: 'The Squeeze', d: 'One hand fewer', hands: -1 }, { n: 'The Hush', d: 'No discards', disc: -9 }, { n: 'The Pinch', d: 'Hand size −1', hs: -1 },
];
const BASE = [240, 700, 1800, 4200, 9000, 17000, 30000, 50000, 80000, 120000];
const targetFor = (ante, bi) => { const b = ante <= BASE.length ? BASE[ante - 1] : BASE[BASE.length - 1] * Math.pow(1.5, ante - BASE.length); return Math.round(b * [1, 1.5, 2][bi] * F.k() / 10) * 10; };

// ---------------------------------------------------------------- styles + DOM
css(`
body{background:#1d1840;color:#fff}
#bg{position:fixed;inset:0;z-index:0;overflow:hidden;background:radial-gradient(120% 80% at 50% 10%,#3b2f86 0%,#241d57 45%,#15112f 100%)}
#bg i{position:absolute;border-radius:50%;filter:blur(40px);opacity:.55;animation:drift 18s ease-in-out infinite alternate}
#bg i:nth-child(1){width:60vmax;height:60vmax;left:-20vmax;top:-10vmax;background:#ff6f91;opacity:.25}
#bg i:nth-child(2){width:50vmax;height:50vmax;right:-20vmax;top:30vh;background:#3fd2c7;opacity:.18;animation-duration:23s}
#bg i:nth-child(3){width:40vmax;height:40vmax;left:10vw;bottom:-20vmax;background:#ffb347;opacity:.2;animation-duration:29s}
@keyframes drift{to{transform:translate(8vmax,6vmax) scale(1.15)}}
#col{position:fixed;top:0;bottom:0;left:50%;width:min(100vw,440px);transform:translateX(-50%);z-index:2;pointer-events:none}
#col *{pointer-events:auto}
#hdr{position:absolute;top:calc(10px + env(safe-area-inset-top));left:62px;right:12px;height:44px;display:flex;align-items:center;gap:10px}
#blind{flex:1;min-width:0;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:4px 12px;line-height:1.15}
#blind b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#blind span{font-size:12px;opacity:.75}
#stars{font-weight:800;font-size:19px;color:#ffd35c;background:rgba(0,0,0,.25);border-radius:14px;padding:8px 12px;white-space:nowrap}
#charms{position:absolute;left:10px;right:10px;display:flex;gap:6px;justify-content:center}
.ch{position:relative;width:var(--hw);height:calc(var(--hw)*1.32);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:1.05;padding:4px;box-shadow:0 4px 0 rgba(0,0,0,.25),inset 0 0 0 2px rgba(255,255,255,.25);cursor:pointer;transition:transform .15s}
.ch .ic{font-size:calc(var(--hw)*.42);line-height:1;filter:drop-shadow(0 2px 0 rgba(0,0,0,.2))}
.ch.r0{background:linear-gradient(160deg,#2bb5a0,#137a6c)}.ch.r1{background:linear-gradient(160deg,#4f7bff,#2b47b8)}.ch.r2{background:linear-gradient(160deg,#ff6fae,#a8338a)}
.ch.empty{background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 2px rgba(255,255,255,.12);border:0;cursor:default}
.ch.kick{animation:kick .35s}
@keyframes kick{30%{transform:translateY(-8px) rotate(-6deg) scale(1.12)}70%{transform:rotate(4deg)}}
#panel{position:absolute;left:12px;right:12px;background:rgba(10,8,30,.42);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:10px 14px}
#rs{display:flex;align-items:baseline;justify-content:space-between}
#rs span{font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.7;font-weight:700}
#rs b{font-size:28px;font-variant-numeric:tabular-nums}#rs em{font-style:normal;opacity:.7;font-size:15px;font-weight:700}
.bar{height:8px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;margin:4px 0 8px}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffb347,#ff6f91);border-radius:6px;transition:width .35s}
#hname{text-align:center;font-weight:800;font-size:18px;height:24px}
#hname small{font-size:12px;opacity:.7;font-weight:700;margin-left:4px}
#calc{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:4px}
#calc div{min-width:110px;text-align:center;border-radius:12px;padding:4px 10px;font-weight:800;font-size:26px;font-variant-numeric:tabular-nums;box-shadow:0 4px 0 rgba(0,0,0,.25);transition:transform .12s}
#pts{background:#2f8cff}#mult{background:#ff4f6d}#calc span{font-size:22px;font-weight:800;opacity:.85}
#calc div.bump{transform:scale(1.14)}
#counts{display:flex;justify-content:center;gap:10px;margin-top:10px}
#counts div{background:rgba(255,255,255,.08);border-radius:10px;padding:2px 12px;text-align:center;min-width:76px}
#counts b{display:block;font-size:20px;line-height:1.2}#counts span{font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.7;font-weight:700}
#hands b{color:#6fb4ff}#discs b{color:#ff8a9c}
#rule{text-align:center;font-size:13px;color:#ffd35c;font-weight:700;margin-top:8px;min-height:16px}
.cd{position:fixed;left:0;top:0;width:var(--cw);height:var(--ch);border-radius:calc(var(--cw)*.13);background:linear-gradient(165deg,#fffdf7,#f1eadb);box-shadow:0 3px 0 rgba(0,0,0,.18),0 6px 14px rgba(0,0,0,.25);z-index:20;transition:transform .28s cubic-bezier(.25,.9,.3,1.15),opacity .3s,filter .2s;cursor:pointer;touch-action:manipulation;font-family:-apple-system,'SF Pro Rounded',system-ui,sans-serif}
.cd .rk{position:absolute;left:7%;top:3%;font-weight:800;font-size:calc(var(--cw)*.36);line-height:1;letter-spacing:-1px}
.cd .s1{position:absolute;left:9%;top:36%;font-size:calc(var(--cw)*.24);line-height:1}
.cd .s2{position:absolute;right:8%;bottom:6%;font-size:calc(var(--cw)*.56);line-height:1}
.cd.sel{box-shadow:0 0 0 3px #ffd35c,0 10px 20px rgba(0,0,0,.35)}
.cd.dead{filter:grayscale(1) brightness(.75)}
.cd.hit{animation:hit .3s}
@keyframes hit{40%{scale:1.18}}
.pop2{position:fixed;z-index:35;font-weight:800;font-size:20px;pointer-events:none;padding:1px 8px;border-radius:8px;box-shadow:0 3px 0 rgba(0,0,0,.25);animation:p2 .8s ease-out forwards;white-space:nowrap;transform:translate(-50%,0)}
@keyframes p2{0%{opacity:0;transform:translate(-50%,8px) scale(.6)}25%{opacity:1;transform:translate(-50%,-6px) scale(1.15)}100%{opacity:0;transform:translate(-50%,-34px) scale(1)}}
#btns{position:absolute;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;gap:8px}
#btns button{font:inherit;font-weight:800;font-size:18px;color:#fff;border:0;border-radius:16px;padding:14px 0;box-shadow:0 5px 0 rgba(0,0,0,.3);cursor:pointer}
#btns button:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.3)}
#bplay{flex:2;background:#2f8cff}#bdisc{flex:2;background:#ff4f6d}#bsort{flex:1;background:rgba(255,255,255,.16);font-size:14px!important}
#btns button:disabled{opacity:.35}
#tip{position:fixed;z-index:45;max-width:230px;background:#fff;color:#1d1840;border-radius:12px;padding:8px 12px;font-size:14px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;transition:opacity .2s}
#tip b{display:block;font-size:15px}
#shop{position:fixed;inset:0;z-index:25;display:flex;flex-direction:column;align-items:center;padding:calc(64px + env(safe-area-inset-top)) 16px 20px;background:linear-gradient(180deg,rgba(20,14,48,.86),rgba(20,14,48,.96));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#shop[hidden]{display:none}
#shop h2{margin:0;font-family:ui-serif,Georgia,serif;font-size:36px;font-weight:600}
#shop .sub{opacity:.75;font-size:14px;margin:2px 0 14px;text-align:center}
#offers{display:flex;gap:10px;justify-content:center;width:100%;max-width:420px}
.of{flex:1;max-width:128px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;cursor:pointer;transition:transform .15s}
.of:active{transform:scale(.96)}
.of .ch{--hw:66px;pointer-events:none}
.of .ds{font-size:12px;line-height:1.25;opacity:.88;min-height:46px}
.of .pr{font-weight:800;color:#1d1840;background:#ffd35c;border-radius:10px;padding:2px 12px;font-size:16px}
.of.no .pr{background:rgba(255,255,255,.25);color:#fff}
.of.sold{opacity:.25;pointer-events:none}
.study{width:66px;height:87px;border-radius:10px;background:linear-gradient(160deg,#ffd35c,#ff9f43);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#3b2a00;font-weight:800;font-size:11px;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.study i{font-style:normal;font-size:30px}
#mine{margin-top:16px;width:100%;max-width:420px;text-align:center}
#mine p{font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.6;font-weight:700;margin:0 0 6px}
#mine .row{display:flex;gap:6px;justify-content:center;--hw:58px}
#shopbtns{display:flex;gap:10px;margin-top:auto;width:100%;max-width:420px}
#shopbtns button{flex:1;font:inherit;font-weight:800;font-size:18px;color:#fff;border:0;border-radius:16px;padding:14px 0;box-shadow:0 5px 0 rgba(0,0,0,.3);cursor:pointer}
#reroll{background:rgba(255,255,255,.16)}#next{background:#2bb5a0;flex:2!important}
#levels{margin-top:12px;font-size:13px;opacity:.75;text-align:center;line-height:1.5}
`);
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
document.body.prepend($('<div id="bg"><i></i><i></i><i></i></div>'));
const col = $(`<div id="col">
  <div id="hdr"><div id="blind"><b id="bname">Small blind</b><span id="bsub">Ante 1</span></div><div id="stars">✦ 4</div></div>
  <div id="charms"></div>
  <div id="panel"><div id="rs"><span>Round score</span><div><b id="rscore">0</b> <em id="rtarget">/ 240</em></div></div><div class="bar"><i id="rbar"></i></div>
    <div id="hname">Pick up to 5 cards</div><div id="calc"><div id="pts">0</div><span>×</span><div id="mult">0</div></div>
    <div id="counts"><div id="hands"><b>4</b><span>Hands</span></div><div id="discs"><b>3</b><span>Discards</span></div><div id="deckc"><b>44</b><span>Deck</span></div></div>
    <div id="rule"></div></div>
  <div id="btns"><button id="bplay">Play hand</button><button id="bsort">Sort: rank</button><button id="bdisc">Discard</button></div>
</div>`);
document.body.appendChild(col);
const tip = $('<div id="tip" style="opacity:0"></div>'); document.body.appendChild(tip);
const shop = $(`<div id="shop" hidden><h2>Camp</h2><div class="sub">Spend your ✦ stars on charms. Tap a charm you own to trade it back for half.</div>
  <div id="offers"></div><div id="mine"><p>Your charms</p><div class="row"></div></div><div id="levels"></div>
  <div id="shopbtns"><button id="reroll">Reroll ✦1</button><button id="next">Next blind ▸</button></div></div>`);
document.body.appendChild(shop);
const E = id => document.getElementById(id);

// ---------------------------------------------------------------- state
let state = 'ready', phase = 'blind', busy = false;
let R, runRng, luck;                     // run state + seeded rngs
let hand = [], deck = [], played = [], sortBy = S.get('sort', 'rank');
let blindNo = 1, ante = 1, bi = 0, target = 0, roundScore = 0, hands = 4, discards = 3, handSize = 8, boss = null;
let stars = 4, charms = [], levels = {}, beaten = 0, runT0 = 0, recorded = false, beatShown = false, offers = [], rerollCost = 1;
let L = {};                              // layout
let uid = 0;

function layout() {
  const W = Math.min(innerWidth, 440), H = innerHeight, x0 = (innerWidth - W) / 2;
  const cw = Math.min(66, (W - 24) / 6.1), ch = cw * 1.4, hw = Math.min(64, (W - 20 - 4 * 6) / 5);
  const top = 62, chTop = top, panelTop = chTop + hw * 1.32 + 10;
  const btnTop = H - 16 - 52, handY = btnTop - 30 - ch, playY = panelTop + 222 + (handY - 24 - (panelTop + 222) - ch) / 2;
  L = { W, H, x0, cw, ch, hw, chTop, panelTop, handY, playY };
  document.body.style.setProperty('--cw', cw + 'px'); document.body.style.setProperty('--ch', ch + 'px'); col.style.setProperty('--hw', hw + 'px');
  E('charms').style.top = chTop + 'px'; E('panel').style.top = panelTop + 'px';
}
addEventListener('resize', () => { layout(); place(); });
layout();

// ---------------------------------------------------------------- cards
function cardEl(c) {
  const d = $(`<div class="cd"><div class="rk"></div><div class="s1"></div><div class="s2"></div></div>`);
  d.querySelector('.rk').textContent = rname(c.r); d.querySelector('.s1').textContent = SUIT[c.s]; d.querySelector('.s2').textContent = SUIT[c.s];
  d.style.color = SCOL[c.s];
  d.addEventListener('click', e => { e.stopPropagation(); if (state === 'play' && phase === 'blind' && !busy && hand.includes(c)) toggle(c); });
  document.body.appendChild(d); c.el = d; return d;
}
const mkDeck = () => { const d = []; for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s, id: uid++ }); return d; };
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sortHand() { hand.sort(sortBy === 'rank' ? (a, b) => b.r - a.r || a.s - b.s : (a, b) => a.s - b.s || b.r - a.r); }
function place() {
  const n = hand.length, step = n > 1 ? Math.min(L.cw + 4, (L.W - 24 - L.cw) / (n - 1)) : 0, w = L.cw + step * (n - 1), left = L.x0 + (L.W - w) / 2;
  hand.forEach((c, i) => {
    const x = left + i * step, rot = (i - (n - 1) / 2) * 2.2, y = L.handY + Math.abs(i - (n - 1) / 2) * 2.5 - (c.sel ? 24 : 0);
    c.el.style.transform = `translate(${x}px,${y}px) rotate(${c.sel ? 0 : rot}deg)`; c.el.style.zIndex = 20 + i; c.el.classList.toggle('sel', !!c.sel);
  });
  const m = played.length, pw = L.cw + (L.cw + 6) * (m - 1), pl = L.x0 + (L.W - pw) / 2;
  played.forEach((c, i) => { c.el.style.transform = `translate(${pl + i * (L.cw + 6)}px,${L.playY}px)`; c.el.style.zIndex = 30 + i; c.el.classList.remove('sel'); });
}
function draw() {
  const need = handSize - hand.length;
  for (let i = 0; i < need && deck.length; i++) {
    const c = deck.pop(); cardEl(c); c.el.style.transition = 'none'; c.el.style.transform = `translate(${L.x0 + L.W + 40}px,${L.handY + 40}px) rotate(20deg)`;
    c.el.getBoundingClientRect(); c.el.style.transition = ''; c.sel = false; hand.push(c);
  }
  sortHand(); place(); hud(); preview();
  if (need > 0) soft.swish();
}
function toggle(c) {
  if (!c.sel && hand.filter(h => h.sel).length >= 5) { c.el.classList.add('hit'); setTimeout(() => c.el.classList.remove('hit'), 300); soft.err(); return; }
  c.sel = !c.sel; tone(c.sel ? 700 + c.r * 25 : 500, 0.05, 'triangle', 0.08, 1.1); buzz(6); place(); preview();
}

// ---------------------------------------------------------------- scoring
function classify(cards) {
  const n = cards.length, byR = {}, byS = {};
  for (const c of cards) { (byR[c.r] = byR[c.r] || []).push(c); (byS[c.s] = byS[c.s] || []).push(c); }
  const groups = Object.values(byR).sort((a, b) => b.length - a.length || b[0].r - a[0].r);
  const flush = n === 5 && Object.keys(byS).length === 1;
  let straight = false;
  if (n === 5 && groups.length === 5) { const rs = cards.map(c => c.r).sort((a, b) => a - b); straight = rs[4] - rs[0] === 4 || rs.join() === '2,3,4,5,14'; }
  const g0 = groups[0] ? groups[0].length : 0, g1 = groups[1] ? groups[1].length : 0;
  let t, sc;
  if (straight && flush) { t = 8; sc = cards; } else if (g0 === 4) { t = 7; sc = groups[0]; } else if (g0 === 3 && g1 >= 2) { t = 6; sc = cards; }
  else if (flush) { t = 5; sc = cards; } else if (straight) { t = 4; sc = cards; } else if (g0 === 3) { t = 3; sc = groups[0]; }
  else if (g0 === 2 && g1 === 2) { t = 2; sc = groups[0].concat(groups[1]); } else if (g0 === 2) { t = 1; sc = groups[0]; }
  else { t = 0; sc = n ? [cards.reduce((a, b) => (b.r > a.r ? b : a))] : []; }
  return { t, sc, n, pair: g0 >= 2, two: (g0 >= 2 && g1 >= 2), three: g0 >= 3, straight, flush, suits: Object.keys(byS).length };
}
const lvl = t => levels[t] || 1;
const baseOf = t => [HT[t][1] + (lvl(t) - 1) * HT[t][3], HT[t][2] + (lvl(t) - 1) * HT[t][4]];
/** full score of a played set. dry = no side effects (preview + bot). Returns { total, steps } for the animation. */
function score(cards, dry) {
  const h = classify(cards); let [pts, mult] = baseOf(h.t);
  const steps = [], ctx = { dry, discards, hands, luck: () => luck() };
  let tgt = null;
  const a = { pts: v => { pts += v; steps.push({ tgt, k: 'p', v, pts, mult }); }, mult: v => { mult += v; steps.push({ tgt, k: 'm', v, pts, mult }); }, x: v => { mult = Math.round(mult * v * 10) / 10; steps.push({ tgt, k: 'x', v, pts, mult }); } };
  steps.push({ tgt: 'base', k: 'b', pts, mult });
  for (const c of h.sc) {
    if (boss && boss.suit === c.s) { steps.push({ tgt: c, k: 'dead', pts, mult }); continue; }
    tgt = c; a.pts(rpts(c.r));
    for (const ch of charms) { const d = CHI[ch.id]; if (d.card) { tgt = ch; d.card(c, a, ctx, ch); } }
  }
  for (const ch of charms) { const d = CHI[ch.id]; if (d.hand) { tgt = ch; d.hand(h, a, ctx, ch); } }
  return { h, total: Math.floor(pts * mult), pts, mult, steps };
}
function preview() {
  if (busy) return;
  const sel = hand.filter(c => c.sel);
  if (!sel.length) { E('hname').innerHTML = 'Pick up to 5 cards'; E('pts').textContent = 0; E('mult').textContent = 0; }
  else { const h = classify(sel), [p, m] = baseOf(h.t); E('hname').innerHTML = `${HT[h.t][0]}<small>lvl ${lvl(h.t)}</small>`; E('pts').textContent = p; E('mult').textContent = m; }
  E('bplay').disabled = !sel.length || !hands; E('bdisc').disabled = !sel.length || !discards;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function popAt(el, text, bg) {
  const r = el.getBoundingClientRect(), d = $(`<div class="pop2"></div>`); d.textContent = text; d.style.background = bg; d.style.left = r.left + r.width / 2 + 'px'; d.style.top = r.top - 26 + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 820);
}
const bump = id => { const e = E(id); e.classList.add('bump'); setTimeout(() => e.classList.remove('bump'), 120); };
async function play() {
  if (busy || state !== 'play' || phase !== 'blind') return;
  const sel = hand.filter(c => c.sel); if (!sel.length || !hands) return;
  busy = true; E('bplay').disabled = E('bdisc').disabled = true;
  hand = hand.filter(c => !c.sel); played = sel.sort((a, b) => b.r - a.r); played.forEach(c => c.sel = false);
  hands--; hud(); place(); tone(330, 0.12, 'triangle', 0.1, 1.5);
  await sleep(320);
  const res = score(played, false);
  E('hname').innerHTML = `${HT[res.h.t][0]}<small>lvl ${lvl(res.h.t)}</small>`;
  for (const c of played) if (!res.h.sc.includes(c) || (boss && boss.suit === c.s)) c.el.classList.add('dead');
  let ni = 0;
  for (const st of res.steps) {
    E('pts').textContent = fmt(st.pts); E('mult').textContent = fmt(st.mult);
    if (st.k === 'b') { bump('pts'); bump('mult'); await sleep(220); continue; }
    if (st.k === 'dead') { popAt(st.tgt.el, 'blank', '#555'); soft.err(); await sleep(200); continue; }
    const el = st.tgt.el || st.tgt.dom; if (!el) continue;
    if (st.tgt.dom) { el.classList.remove('kick'); void el.offsetWidth; el.classList.add('kick'); } else { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
    popAt(el, st.k === 'p' ? `+${st.v}` : st.k === 'm' ? `+${st.v} mult` : `×${st.v}`, st.k === 'p' ? '#2f8cff' : '#ff4f6d');
    bump(st.k === 'p' ? 'pts' : 'mult');
    note(st.k === 'p' ? 67 + Math.min(ni, 12) : 74 + Math.min(ni, 12), 0.25, 0.1); ni++; buzz(5);
    await sleep(st.k === 'x' ? 360 : 200);
  }
  // the total
  const total = res.total, r0 = roundScore;
  E('hname').innerHTML = `<span style="color:#ffd35c;font-size:24px">${fmt(total)}</span>`;
  ui.pop(fmt(total), total >= target - r0 ? '#ffd35c' : '#fff', Math.min(64, 30 + Math.log10(total + 1) * 7), 40);
  const pr = E('panel').getBoundingClientRect(); fx.sparks(pr.left + pr.width / 2, pr.top + 120, ['#ffd35c', '#ff6f91', '#6fb4ff', '#fff'], 22, { speed: 6 });
  arp([72, 76, 79], 60, 0.1); buzz(20);
  const t0 = performance.now();
  await new Promise(done => { const f = () => { const k = Math.min(1, (performance.now() - t0) / 450); roundScore = Math.floor(r0 + total * k); hud(); k < 1 ? requestAnimationFrame(f) : done(); }; f(); });
  if (!beatShown && D.beaten(beaten + (roundScore >= target ? 1 : 0))) { beatShown = true; ui.pop('BEATEN!', '#ffd35c', 44, 30); fx.confetti(80); }
  await sleep(250);
  for (const c of played) { c.el.style.transform += ` translate(${L.W}px,-40px) rotate(30deg)`; c.el.style.opacity = 0; const e = c.el; setTimeout(() => e.remove(), 400); }
  played = []; E('pts').textContent = 0; E('mult').textContent = 0;
  await sleep(220);
  busy = false;
  if (roundScore >= target) return blindWon();
  if (!hands) return runLost();
  draw();
}
async function discard() {
  if (busy || state !== 'play' || phase !== 'blind' || !discards) return;
  const sel = hand.filter(c => c.sel); if (!sel.length) return;
  busy = true; discards--; hud();
  for (const c of sel) { c.el.style.transform = `translate(${L.x0 - 120}px,${L.handY + 30}px) rotate(-40deg)`; c.el.style.opacity = 0; const e = c.el; setTimeout(() => e.remove(), 350); }
  hand = hand.filter(c => !c.sel); soft.swish(); buzz(8); place();
  await sleep(260); busy = false; draw();
}
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n).toLocaleString() : String(Math.round(n * 10) / 10);

// ---------------------------------------------------------------- HUD
function charmEl(ch, onClick) {
  const d = CHI[ch.id], r = d.c >= 7 ? 2 : d.c >= 5 ? 1 : 0;
  const e = $(`<div class="ch r${r}"><div class="ic">${d.i}</div><div>${d.n}</div></div>`);
  e.addEventListener('click', ev => { ev.stopPropagation(); onClick ? onClick(e) : showTip(e, d.n, d.d + (d.extra ? d.extra(ch) : '')); });
  return e;
}
let tipT = 0;
function showTip(el, title, text) {
  const r = el.getBoundingClientRect(); tip.innerHTML = `<b></b><span></span>`; tip.querySelector('b').textContent = title; tip.querySelector('span').textContent = text;
  tip.style.left = Math.max(8, Math.min(innerWidth - 240, r.left + r.width / 2 - 115)) + 'px'; tip.style.top = r.bottom + 8 + 'px'; tip.style.opacity = 1;
  clearTimeout(tipT); tipT = setTimeout(() => tip.style.opacity = 0, 2200); soft.click();
}
function drawCharms() {
  const box = E('charms'); box.innerHTML = '';
  for (let i = 0; i < 5; i++) { if (charms[i]) { const e = charmEl(charms[i]); charms[i].dom = e; box.appendChild(e); } else box.appendChild($('<div class="ch empty"></div>')); }
}
function hud() {
  E('bname').textContent = boss ? boss.n : bi === 0 ? 'Small blind' : 'Big blind';
  E('bsub').textContent = `Ante ${ante} · blind ${bi + 1} of 3 · reach ${fmt(target)}`;
  E('stars').textContent = '✦ ' + stars;
  E('rscore').textContent = fmt(roundScore); E('rtarget').textContent = '/ ' + fmt(target);
  E('rbar').style.width = Math.min(100, roundScore / target * 100) + '%';
  E('hands').querySelector('b').textContent = hands; E('discs').querySelector('b').textContent = discards; E('deckc').querySelector('b').textContent = deck.length;
  E('rule').textContent = boss ? '☠ ' + boss.d : '';
  E('bsort').textContent = sortBy === 'rank' ? '⇅ Rank' : '⇅ Suit';
}

// ---------------------------------------------------------------- run flow
function clearCards() { document.querySelectorAll('.cd').forEach(e => e.remove()); hand = []; played = []; }
function newRun() {
  const n = S.get('runs', 0) + 1; S.set('runs', n);
  const seed = D.seed || (Date.now() % 1e9) + n * 7919;
  runRng = rng(seed); luck = rng(seed * 3 + 11);
  stars = 4; charms = []; levels = {}; beaten = 0; blindNo = 1; recorded = false; beatShown = false; runT0 = performance.now();
  B.start(); startBlind();
}
function startBlind() {
  ante = Math.floor((blindNo - 1) / 3) + 1; bi = (blindNo - 1) % 3;
  boss = bi === 2 ? BOSS[Math.floor(runRng() * BOSS.length)] : null;
  target = targetFor(ante, bi); roundScore = 0;
  hands = 4 + (boss && boss.hands || 0); discards = Math.max(0, 3 + (boss && boss.disc || 0)); handSize = 8 + (boss && boss.hs || 0);
  clearCards(); deck = shuffle(mkDeck(), runRng);
  state = 'play'; phase = 'blind'; busy = false; recorded = false; shop.hidden = true;
  drawCharms(); hud(); draw();
  ui.pop(boss ? boss.n : bi ? 'Big blind' : 'Small blind', boss ? '#ffd35c' : '#fff', 30, 52);
  if (boss) { tone(110, 0.4, 'sawtooth', 0.06, 0.8); buzz([20, 40, 20]); }
}
function blindWon() {
  phase = 'won'; beaten++; let earn = [3, 4, 5][bi] + hands;
  for (const ch of charms) { const d = CHI[ch.id]; if (d.end) earn += d.end(); }
  stars += earn;
  if (!recorded) { recorded = true; F.level(true); }
  const best = S.get('best', 0); if (beaten > best) S.set('best', beaten);
  B.submit(beaten, { ms: performance.now() - runT0 });
  D.won(beaten, 'beat');
  state = 'won'; ui.win(blindNo, `+${earn} ✦ · Ante ${ante}${boss ? ' boss down!' : ''}`);
  if (boss) ui.els.win.querySelector('h1').textContent = 'Boss beaten!'; else ui.els.win.querySelector('h1').textContent = 'Beaten!';
  fx.confetti(boss ? 140 : 70); arp([67, 72, 76, 79, 84], 90, 0.12); buzz([30, 40, 30]);
}
function runLost() {
  if (!recorded) { recorded = true; F.level(false, roundScore / target); }
  B.submit(beaten, { ms: performance.now() - runT0 });
  state = 'lost'; ui.lose('Run over', `Ante ${ante} · ${beaten} blind${beaten === 1 ? '' : 's'} beaten · ${fmt(roundScore)} of ${fmt(target)}`);
  tone(220, 0.3, 'triangle', 0.1, 0.5); setTimeout(() => tone(150, 0.5, 'triangle', 0.1, 0.5), 200); buzz([60, 40, 60]);
}

// ---------------------------------------------------------------- camp (shop)
function rollOffers() {
  const pool = CH.filter(c => !charms.some(o => o.id === c.id)); offers = [];
  for (let i = 0; i < 2 && pool.length; i++) { const j = Math.floor(runRng() * pool.length); const c = pool.splice(j, 1)[0]; offers.push({ kind: 'charm', id: c.id, cost: c.c }); }
  const W = [0, 3, 2, 2, 3, 3, 2, 1, 1]; let sum = W.reduce((a, b) => a + b), r = runRng() * sum, t = 0; while (r >= W[t]) { r -= W[t]; t++; }
  offers.push({ kind: 'study', t, cost: 3 });
}
function openShop() {
  state = 'play'; phase = 'shop'; clearCards(); rerollCost = 1; rollOffers(); renderShop(); shop.hidden = false; chimeOpen();
}
const chimeOpen = () => arp([60, 64, 67, 72], 70, 0.08);
function renderShop() {
  const box = E('offers'); box.innerHTML = '';
  for (const o of offers) {
    const afford = stars >= o.cost && (o.kind === 'study' || charms.length < 5);
    const e = $(`<div class="of ${o.sold ? 'sold' : ''} ${afford ? '' : 'no'}"></div>`);
    if (o.kind === 'charm') { const d = CHI[o.id]; e.appendChild(charmEl({ id: o.id })); e.appendChild($(`<div class="ds"></div>`)).textContent = d.d; }
    else { e.appendChild($(`<div class="study"><i>📖</i>STUDY</div>`)); e.appendChild($(`<div class="ds"></div>`)).textContent = `${HT[o.t][0]} +1 level (lvl ${lvl(o.t)} → ${lvl(o.t) + 1})`; }
    e.appendChild($(`<div class="pr">✦ ${o.cost}</div>`));
    e.addEventListener('click', ev => { ev.stopPropagation(); buy(o, e); });
    box.appendChild(e);
  }
  const row = shop.querySelector('#mine .row'); row.innerHTML = '';
  for (let i = 0; i < 5; i++) { if (charms[i]) { const ch = charms[i]; row.appendChild(charmEl(ch, () => sell(ch))); } else row.appendChild($('<div class="ch empty"></div>')); }
  E('reroll').textContent = `Reroll ✦${rerollCost}`; E('reroll').disabled = stars < rerollCost;
  E('stars').textContent = '✦ ' + stars;
  shop.querySelector('h2').textContent = `Camp · ✦ ${stars}`;
  const lv = Object.entries(levels).map(([t, l]) => `${HT[t][0]} lvl ${l}`).join(' · ');
  E('levels').textContent = lv ? 'Studied: ' + lv : `Next: ${blindNo % 3 === 2 ? 'the boss blind' : (blindNo % 3 === 1 ? 'big blind' : 'small blind')} · Ante ${Math.floor(blindNo / 3) + 1}`;
}
function buy(o, e) {
  if (o.sold) return;
  if (stars < o.cost || (o.kind === 'charm' && charms.length >= 5)) { soft.err(); if (e) { e.style.transform = 'translateX(-6px)'; setTimeout(() => e.style.transform = '', 120); } return; }
  stars -= o.cost; o.sold = true;
  if (o.kind === 'charm') charms.push({ id: o.id }); else levels[o.t] = lvl(o.t) + 1;
  sfxBuy(); buzz(15); if (e) { const r = e.getBoundingClientRect(); fx.sparks(r.left + r.width / 2, r.top + 40, ['#ffd35c', '#fff'], 16); }
  renderShop();
}
const sfxBuy = () => { tone(988, 0.06, 'triangle', 0.08, 1); setTimeout(() => tone(1318, 0.12, 'triangle', 0.08, 1), 60); };
function sell(ch) { const d = CHI[ch.id]; charms = charms.filter(c => c !== ch); stars += Math.floor(d.c / 2); soft.wood(); renderShop(); }
E('reroll').addEventListener('click', e => { e.stopPropagation(); if (stars < rerollCost) return soft.err(); stars -= rerollCost; rerollCost++; rollOffers(); renderShop(); soft.swish(); });
E('next').addEventListener('click', e => { e.stopPropagation(); nextBlind(); });
function nextBlind() { if (phase !== 'shop') return; blindNo++; startBlind(); }
shop.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- input
E('bplay').addEventListener('click', e => { e.stopPropagation(); play(); });
E('bdisc').addEventListener('click', e => { e.stopPropagation(); discard(); });
E('bsort').addEventListener('click', e => { e.stopPropagation(); sortBy = sortBy === 'rank' ? 'suit' : 'rank'; S.set('sort', sortBy); sortHand(); place(); hud(); soft.click(); });
ui.onTap(w => {
  if (w === 'start') newRun();
  else if (w === 'win') openShop();
  else if (w === 'lose') newRun();
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first blind, until the first
// touch, the best poker hand in the deal lifts card by card so its name and chips show, then the cards drop back (no hand spent)
let demoPick = null;
demo(n => {
  if (!demoPick) { const b = bestPlay(); if (!b || b.t < 1) return false; hand.forEach(c => c.sel = false); demoPick = b.cards; }
  if (n <= demoPick.length) { toggle(demoPick[n - 1]); return; }
  hand.forEach(c => c.sel = false); place(); preview(); return false;
}, { ready: () => state === 'play' && phase === 'blind' && blindNo === 1 && !busy && hands === 4 + 0 && roundScore === 0 && hand.length > 0, wait: 1800, every: 650, max: 7 });
ui.start();
hud(); drawCharms(); E('bplay').disabled = E('bdisc').disabled = true;

// ---------------------------------------------------------------- bot (for the automated checker)
function combos(arr, k, from = 0, cur = [], out = []) { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = from; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); } return out; }
function bestPlay() {
  let best = null;
  for (let k = 1; k <= 5; k++) for (const c of combos(hand, k)) { const s = score(c, true); if (!best || s.total > best.total || (s.total === best.total && c.length < best.cards.length)) best = { cards: c, total: s.total, t: s.h.t }; }
  return best;
}
window.__game = {
  get state() { return state; }, get level() { return blindNo; }, get score() { return beaten; },
  bot() {
    if (state !== 'play' || busy) return;
    if (phase === 'shop') {
      const o = offers.find(o => !o.sold && stars >= o.cost && (o.kind === 'study' || charms.length < 5));
      if (o) return buy(o); return nextBlind();
    }
    if (phase !== 'blind' || !hand.length) return;
    const b = bestPlay(), need = target - roundScore;
    hand.forEach(c => c.sel = false);
    if (discards > 0 && b.total * hands < need * 1.2 && b.t < 4) {
      const keep = new Set(b.t >= 1 ? b.cards : []);
      const bySuit = [0, 1, 2, 3].map(s => hand.filter(c => c.s === s).length), fs = bySuit.indexOf(Math.max(...bySuit));
      if (bySuit[fs] >= 3) hand.filter(c => c.s === fs).forEach(c => keep.add(c));
      const toss = hand.filter(c => !keep.has(c)).sort((a, b) => a.r - b.r).slice(0, 5);
      if (toss.length) { toss.forEach(c => c.sel = true); place(); return discard(); }
    }
    b.cards.forEach(c => c.sel = true); place(); preview(); play();
  },
};

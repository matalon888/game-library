// Huebound — original colour-matching card game in the crazy-eights family, you vs three CPU players.
// Match the top card by colour or by number/symbol; Skip, Reverse, +2, Wild and Wild +4 shake things up.
// With two cards left, tap ZING! before you play — forget, and a sharp-eyed rival can catch you for +2.
import { createUI, store, buzz, tone } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';

const NAME = 'Huebound: Crazy Eights Card Game';
const S = store('huebound');
const F = flow('huebound');
const ui = createUI({ title: 'Huebound', hint: 'Tap to deal', hand: '', score: false });
cardTheme({ accent: '#ff5a5f', font: "'Baloo 2',system-ui,sans-serif", serif: "'Baloo 2',system-ui,sans-serif" });
const D = daily('huebound', ui, { name: NAME });
const fx = fx2d(31);
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, { kicker: D.isDaily ? 'Daily table' : 'Colour card game', doneLine: doneToday ? (D.isDaily ? `Won today · ${doneToday.s} pts` : 'Daily table won ✓') : null });
{ const p = document.createElement('p'); p.className = 'hb-rule'; p.innerHTML = 'Match colour or symbol · first to empty their hand wins<br>Two cards left? Tap <b>ZING!</b> before you play'; ui.els.start.querySelector('.calm-daily, .calm-link').before(p); }
if (D.isDaily) ui.els.win.querySelector('p').innerHTML = 'Daily table<span data-l hidden></span>';
else ui.els.win.querySelector('p').innerHTML = 'ROUND <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'You win!';

const COLS = ['#ff5a5f', '#ffb627', '#21b38f', '#3a7bfd'], CNAME = ['Coral', 'Sun', 'Mint', 'Sky'];
const SYM = { S: '⦸', R: '⇄', D: '+2', W: '', W4: '+4' };
const SEATS = [null, { name: 'Mara', face: '🦉' }, { name: 'Tobi', face: '🐻' }, { name: 'Zuzu', face: '🐙' }];

css(`
body{background:#1d1640}
#felt{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse 90% 60% at 50% 46%,#4b3d9a 0%,#2f2670 45%,#1b1442 100%)}
#felt:before{content:'';position:absolute;left:50%;top:46%;width:118vw;height:118vw;max-width:640px;max-height:640px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.07) 0 40%,rgba(255,255,255,0) 41%),repeating-conic-gradient(from 0deg,rgba(255,255,255,.035) 0 6deg,transparent 6deg 12deg)}
.hb-rule{font-size:15px!important;opacity:.8!important;margin-top:14px!important;line-height:1.45}
.hb-rule b{color:#ffb627}
.hc-top{z-index:40}.hc-top .hc-lvl{width:28px;height:28px;font-size:14px;font-weight:800;color:#2a2050;background:#ffb627}
.hc-top .hc-lvl.next{background:rgba(255,255,255,.18);color:#fff}
.hc-top .hc-bar{background:rgba(255,255,255,.16);height:8px}.hc-top .hc-bar i{background:#ffb627}
#tbl{position:fixed;inset:0;z-index:2;font-family:'Baloo 2',system-ui,sans-serif}
.hc{position:absolute;left:0;top:0;width:var(--w);height:var(--h);border-radius:calc(var(--w) * .16);transition:transform .32s cubic-bezier(.25,.9,.3,1.05),opacity .2s,filter .2s;will-change:transform}
.hc .fc{position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:linear-gradient(155deg,var(--c1),var(--c2));box-shadow:0 0 0 2px #fff inset,0 3px 10px rgba(0,0,0,.35)}
.hc .fc:before{content:'';position:absolute;inset:8%;border-radius:calc(var(--w) * .12);background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.28) 0 30%,rgba(255,255,255,0) 31%),repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,.10) 0 2px,transparent 2px 9px);border:1.5px solid rgba(255,255,255,.45)}
.hc .big{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:calc(var(--w) * .6);line-height:1;padding-top:6%;-webkit-text-stroke:1.5px rgba(0,0,0,.18);text-shadow:0 3px 0 rgba(0,0,0,.28)}
.hc .big.sym{font-size:calc(var(--w) * .5)}
.hc .cn{position:absolute;color:#fff;font-weight:800;font-size:calc(var(--w) * .24);line-height:1;text-shadow:0 1px 0 rgba(0,0,0,.3)}
.hc .cn.a{left:9%;top:6%}.hc .cn.b{right:9%;bottom:6%;transform:rotate(180deg)}
.hc.wild .fc{background:#22203a}
.hc .wheel{position:absolute;left:50%;top:50%;width:64%;aspect-ratio:1;transform:translate(-50%,-50%) rotate(45deg);border-radius:50%;background:conic-gradient(#ff5a5f 0 25%,#ffb627 0 50%,#21b38f 0 75%,#3a7bfd 0);box-shadow:0 0 0 3px #fff}
.hc.wild .big{z-index:2}
.hc .bk{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(150deg,#3b2f86,#1c1648);box-shadow:0 0 0 2px #fff inset,0 3px 8px rgba(0,0,0,.35);display:none;overflow:hidden}
.hc .bk:after{content:'H';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-12deg);width:58%;aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1c1648;font-size:calc(var(--w) * .38);background:conic-gradient(#ff5a5f 0 25%,#ffb627 0 50%,#21b38f 0 75%,#3a7bfd 0)}
.hc.back .bk{display:block}.hc.back .fc{display:none}
.hc.dim{filter:brightness(.55) saturate(.7)}
.hc.mine{cursor:pointer}
.hc.shake{animation:shk .32s}
@keyframes shk{20%{margin-left:-6px}40%{margin-left:6px}60%{margin-left:-3px}80%{margin-left:2px}}
.seat{position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;color:#fff;transition:transform .25s}
.seat .av{width:58px;height:58px;border-radius:50%;background:linear-gradient(160deg,#fff,#e9e3ff);display:flex;align-items:center;justify-content:center;font-size:32px;box-shadow:0 4px 0 rgba(0,0,0,.25);position:relative;transition:box-shadow .25s}
.seat.on .av{box-shadow:0 0 0 4px #ffb627,0 0 22px rgba(255,182,39,.8)}
.seat.on{transform:scale(1.08)}
.seat .nm{font-weight:800;font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.seat .ct{position:absolute;right:-8px;top:-6px;min-width:26px;height:26px;border-radius:13px;background:#ff5a5f;color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 rgba(0,0,0,.25);padding:0 6px}
.seat .fan{position:relative;height:30px;width:70px;margin-top:2px}
.seat .fan i{position:absolute;top:0;left:50%;width:20px;height:30px;border-radius:4px;background:linear-gradient(150deg,#3b2f86,#1c1648);box-shadow:0 0 0 1.5px #fff inset,0 2px 4px rgba(0,0,0,.3);transform-origin:50% 120%}
.seat .catch{position:absolute;top:-34px;left:50%;transform:translateX(-50%);font:inherit;font-weight:800;font-size:15px;color:#2a2050;background:#ffb627;border:0;border-radius:16px;padding:3px 12px;box-shadow:0 3px 0 rgba(0,0,0,.25);cursor:pointer;animation:hcpulse .6s infinite;white-space:nowrap}
.seat .bub{position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:#fff;color:#2a2050;font-weight:800;font-size:15px;border-radius:14px;padding:2px 10px;white-space:nowrap;animation:bub 1.3s forwards}
@keyframes bub{0%{opacity:0;transform:translate(-50%,8px) scale(.6)}15%{opacity:1;transform:translate(-50%,0) scale(1.1)}80%{opacity:1}100%{opacity:0}}
#ring{position:absolute;border-radius:50%;border:3px dashed rgba(255,255,255,.18);animation:spin 14s linear infinite;pointer-events:none}
#ring.ccw{animation-direction:reverse}
#ring b{position:absolute;font-size:22px;color:rgba(255,255,255,.45);line-height:1}
@keyframes spin{to{transform:rotate(360deg)}}
#glow{position:absolute;border-radius:50%;pointer-events:none;transition:background .3s,box-shadow .3s}
#deckHit{position:absolute;cursor:pointer;border-radius:12px}
#deckHit.go{animation:hcpulse 1s infinite}
#deckHit.go:after{content:'Draw';position:absolute;left:50%;bottom:-26px;transform:translateX(-50%);color:#fff;font-weight:800;font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.3)}
#turn{position:absolute;left:0;right:0;text-align:center;color:#fff;font-weight:800;font-size:18px;text-shadow:0 2px 0 rgba(0,0,0,.3);pointer-events:none;transition:opacity .2s}
#zing{position:absolute;width:84px;height:84px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:22px;color:#2a2050;background:radial-gradient(circle at 35% 30%,#fff3c4,#ffb627 60%,#e48a00);box-shadow:0 5px 0 #a35f00,0 8px 18px rgba(0,0,0,.35);cursor:pointer;transform:rotate(-8deg);transition:transform .15s,opacity .2s;letter-spacing:.5px}
#zing.ready{animation:zg .7s ease-in-out infinite}
#zing.off{opacity:.35;filter:grayscale(.6)}
#zing.done{background:radial-gradient(circle at 35% 30%,#d6ffe9,#21b38f 60%,#14866a);box-shadow:0 5px 0 #0d5e4a,0 8px 18px rgba(0,0,0,.35);color:#fff}
@keyframes zg{50%{transform:rotate(6deg) scale(1.1)}}
#pass{position:absolute;font:inherit;font-weight:800;font-size:17px;color:#fff;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.4);border-radius:20px;padding:6px 18px;cursor:pointer;display:none}
#pick{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;background:rgba(10,6,30,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
#pick .w{display:grid;grid-template-columns:110px 110px;gap:12px;transform:rotate(45deg)}
#pick button{width:110px;height:110px;border:0;cursor:pointer;box-shadow:0 6px 0 rgba(0,0,0,.25);font:inherit}
#pick button:nth-child(1){border-radius:110px 10px 10px 10px}#pick button:nth-child(2){border-radius:10px 110px 10px 10px}
#pick button:nth-child(3){border-radius:10px 10px 10px 110px}#pick button:nth-child(4){border-radius:10px 10px 110px 10px}
#pick .t{position:absolute;top:22%;left:0;right:0;text-align:center;color:#fff;font-weight:800;font-size:24px}
#score{position:fixed;top:54px;right:14px;z-index:6;color:#fff;font-weight:800;font-size:15px;background:rgba(0,0,0,.22);border-radius:14px;padding:2px 12px;pointer-events:none}
`);
const felt = document.createElement('div'); felt.id = 'felt'; document.body.prepend(felt);
const tbl = document.createElement('div'); tbl.id = 'tbl'; document.body.appendChild(tbl);
const ring = document.createElement('div'); ring.id = 'ring'; ring.innerHTML = '<b style="left:50%;top:-14px;transform:translateX(-50%) rotate(90deg)">➤</b><b style="left:50%;bottom:-14px;transform:translateX(-50%) rotate(-90deg)">➤</b>'; tbl.appendChild(ring);
const glow = document.createElement('div'); glow.id = 'glow'; tbl.appendChild(glow);
const deckHit = document.createElement('div'); deckHit.id = 'deckHit'; tbl.appendChild(deckHit);
const turnEl = document.createElement('div'); turnEl.id = 'turn'; tbl.appendChild(turnEl);
const zingB = document.createElement('button'); zingB.id = 'zing'; zingB.textContent = 'ZING!'; tbl.appendChild(zingB);
const passB = document.createElement('button'); passB.id = 'pass'; passB.textContent = 'Keep it ›'; tbl.appendChild(passB);
const pickEl = document.createElement('div'); pickEl.id = 'pick'; pickEl.innerHTML = '<div class="t">Pick a colour</div><div class="w">' + COLS.map((c, i) => `<button data-c="${i}" style="background:${c}"></button>`).join('') + '</div>'; document.body.appendChild(pickEl);
const scoreEl = document.createElement('div'); scoreEl.id = 'score'; document.body.appendChild(scoreEl);
const seatEls = [null];
for (let p = 1; p <= 3; p++) {
  const s = document.createElement('div'); s.className = 'seat'; s.innerHTML = `<div class="av">${SEATS[p].face}<div class="ct">7</div></div><div class="nm">${SEATS[p].name}</div><div class="fan"></div>`;
  tbl.appendChild(s); seatEls.push(s);
}
for (const el of [tbl, pickEl]) el.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- deck
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
let R = Math.random;
function newDeck() {
  const d = []; let id = 0;
  for (let c = 0; c < 4; c++) {
    d.push({ id: id++, c, v: 0 });
    for (let k = 0; k < 2; k++) { for (let v = 1; v <= 9; v++) d.push({ id: id++, c, v }); for (const v of ['S', 'R', 'D']) d.push({ id: id++, c, v }); }
  }
  for (let k = 0; k < 4; k++) { d.push({ id: id++, c: 4, v: 'W' }); d.push({ id: id++, c: 4, v: 'W4' }); }
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const pts = (c) => typeof c.v === 'number' ? c.v : c.c === 4 ? 50 : 20;
const isWild = (c) => c.c === 4;
const label = (c) => typeof c.v === 'number' ? String(c.v) : SYM[c.v];

// ---------------------------------------------------------------- state
let state = 'ready', level = S.get('level', 1), score = 0, total = S.get('total', 0);
let deck = [], pile = [], hands = [[], [], [], []], turn = 0, dir = 1, color = 0, busy = false, drawnPending = null, zinged = [false, false, false, false];
let recorded = false, beatenShown = false, skill = 0.4, startN = 7, catchT = null, vulnerable = -1, lastPlayAt = 0;
const els = new Map();
let G = { w: 64, h: 96, cx: 195, cy: 380 };

function cardDiv(c, back = false) {
  const d = document.createElement('div'); d.className = 'hc' + (isWild(c) ? ' wild' : '') + (back ? ' back' : '');
  const c1 = isWild(c) ? '#2b2850' : COLS[c.c], c2 = isWild(c) ? '#15132a' : shade(COLS[c.c], -0.18);
  d.style.setProperty('--c1', c1); d.style.setProperty('--c2', c2);
  const sym = typeof c.v !== 'number';
  d.innerHTML = `<div class="fc">${isWild(c) ? '<div class="wheel"></div>' : ''}<div class="big${sym ? ' sym' : ''}">${label(c)}</div><div class="cn a">${label(c) || '★'}</div><div class="cn b">${label(c) || '★'}</div></div><div class="bk"></div>`;
  tbl.appendChild(d); return d;
}
function shade(hex, a) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (x) => Math.round(Math.max(0, Math.min(255, x + x * a))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
const elOf = (c) => { let e = els.get(c.id); if (!e) { e = cardDiv(c); els.set(c.id, e); e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); tapCard(c); }); } return e; };
const setT = (e, x, y, r = 0, s = 1, z = 1) => { e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`; e.style.zIndex = z; };

function seatPos(p) {
  const W = innerWidth, H = innerHeight;
  if (p === 1) return { x: 44, y: H * 0.34 };
  if (p === 2) return { x: W / 2, y: 112 };
  return { x: W - 44, y: H * 0.34 };
}
function layout() {
  const W = innerWidth, H = innerHeight;
  G.w = Math.min(78, W * 0.17); G.h = G.w * 1.5; G.cx = W / 2; G.cy = H * 0.47;
  tbl.style.setProperty('--w', G.w + 'px'); tbl.style.setProperty('--h', G.h + 'px');
  const rr = Math.min(W * 0.36, 170); Object.assign(ring.style, { left: G.cx - rr + 'px', top: G.cy - rr + 'px', width: rr * 2 + 'px', height: rr * 2 + 'px' });
  const gr = G.h * 0.95; Object.assign(glow.style, { left: G.cx + G.w * 0.15 - gr / 2 + G.w / 2 + 'px', top: G.cy - gr / 2 + 'px', width: gr + 'px', height: gr + 'px' });
  Object.assign(deckHit.style, { left: G.cx - G.w * 1.25 + 'px', top: G.cy - G.h / 2 + 'px', width: G.w + 'px', height: G.h + 'px' });
  for (let p = 1; p <= 3; p++) { const s = seatPos(p), e = seatEls[p]; e.style.left = s.x - 40 + 'px'; e.style.top = s.y - 30 + 'px'; e.style.width = '80px'; }
  const handY = H - G.h * 1.22 - 30;
  turnEl.style.top = handY - 44 + 'px';
  Object.assign(zingB.style, { left: W - 98 + 'px', top: handY - 100 + 'px' });
  Object.assign(passB.style, { left: 16 + 'px', top: handY - 48 + 'px' });
  render();
}
addEventListener('resize', layout);
const deckXY = () => ({ x: G.cx - G.w * 1.25, y: G.cy - G.h / 2 });
const pileXY = () => ({ x: G.cx + G.w * 0.15, y: G.cy - G.h / 2 });

let deckBacks = [];
function render() {
  const W = innerWidth, H = innerHeight;
  // draw pile: three stacked backs
  if (!deckBacks.length) for (let i = 0; i < 3; i++) { const e = cardDiv({ id: -1, c: 0, v: 0 }, true); e.style.pointerEvents = 'none'; deckBacks.push(e); }
  const dp = deckXY(); deckBacks.forEach((e, i) => { setT(e, dp.x - i * 2, dp.y - i * 2, 0, 1, 5 + i); e.style.opacity = deck.length > i * 8 ? 1 : 0.15; });
  // discard pile: last few, slightly rotated
  const pp = pileXY();
  pile.forEach((c, i) => { const e = elOf(c), k = pile.length - 1 - i; if (k > 5) { e.style.display = 'none'; return; } e.style.display = ''; e.classList.remove('dim', 'mine', 'back'); setT(e, pp.x + (c.ox || 0), pp.y + (c.oy || 0), c.rot || 0, 1, 20 + i); });
  // my hand
  const HS = 1.22, hw = G.w * HS, h = hands[0], n = h.length, avail = Math.min(W, 560) - 20 - hw, sp = n > 1 ? Math.min(hw * 0.78, avail / (n - 1)) : 0;
  const x0 = (W - (sp * (n - 1) + hw)) / 2 + (hw - G.w) / 2, y0 = H - G.h - 26 - (hw - G.w) * 0.75;
  const myTurn = state === 'play' && turn === 0 && !busy;
  h.forEach((c, i) => {
    const e = elOf(c), t = n > 1 ? i / (n - 1) - 0.5 : 0, ok = canPlay(c);
    e.style.display = ''; e.classList.remove('back'); e.classList.add('mine');
    const lift = myTurn && ok && (!drawnPending || drawnPending === c) ? -16 : 0;
    e.classList.toggle('dim', myTurn && !ok || (drawnPending && drawnPending !== c));
    setT(e, x0 + i * sp, y0 + t * t * 30 + lift, t * 14, HS, 100 + i);
  });
  // CPU seats
  for (let p = 1; p <= 3; p++) {
    const e = seatEls[p], n2 = hands[p].length; e.querySelector('.ct').textContent = n2; e.classList.toggle('on', state === 'play' && turn === p);
    const fan = e.querySelector('.fan'); const m = Math.min(n2, 7);
    if (fan.childElementCount !== m) { fan.innerHTML = ''; for (let i = 0; i < m; i++) { const b = document.createElement('i'); b.style.transform = `translateX(-50%) rotate(${(i - (m - 1) / 2) * 10}deg)`; fan.appendChild(b); } }
  }
  glow.style.background = `radial-gradient(circle,${COLS[color]}88 0%,${COLS[color]}00 70%)`;
  ring.classList.toggle('ccw', dir < 0);
  deckHit.classList.toggle('go', myTurn && !drawnPending && !h.some(canPlay));
  turnEl.textContent = state !== 'play' ? '' : turn === 0 ? (drawnPending ? 'Play it or keep it' : h.some(canPlay) ? 'Your turn' : 'No match — draw a card') : `${SEATS[turn].name}'s turn`;
  turnEl.style.opacity = turn === 0 ? 1 : 0.6;
  passB.style.display = myTurn && drawnPending ? 'block' : 'none';
  const zr = state === 'play' && hands[0].length === 2 && !zinged[0] && turn === 0, zv = vulnerable === 0;
  zingB.className = zinged[0] && hands[0].length <= 2 ? 'done' : (zr || zv) ? 'ready' : 'off';
  zingB.style.display = state === 'play' && hands[0].length <= 3 ? '' : 'none';
  scoreEl.textContent = `★ ${score}`;
  ui.progress(1 - hands[0].length / Math.max(startN, hands[0].length + 1));
}

// ---------------------------------------------------------------- rules
function canPlay(c) { const t = pile[pile.length - 1]; if (!t) return true; if (isWild(c)) return true; return c.c === color || c.v === t.v; }
function next(p, k = 1) { return ((p + dir * k) % 4 + 4) % 4; }
function drawCards(p, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!deck.length) { const topC = pile.pop(); deck = pile; pile = [topC]; for (const c of deck) { c.rot = 0; c.ox = c.oy = 0; els.get(c.id) && (els.get(c.id).style.display = 'none'); } for (let k = deck.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [deck[k], deck[j]] = [deck[j], deck[k]]; } }
    if (!deck.length) break;
    const c = deck.pop(); hands[p].push(c); got.push(c);
    const dp = deckXY();
    if (p === 0) { const e = elOf(c); e.style.transition = 'none'; e.classList.add('back'); setT(e, dp.x, dp.y, 0, 1, 300); e.style.display = ''; void e.offsetWidth; e.style.transition = ''; setTimeout(() => e.classList.remove('back'), 120); }
    else flyBack(dp, seatPos(p), i * 70);
  }
  if (hands[p].length > 2) zinged[p] = false;
  if (p === 0) sortHand();
  soft.swish(); return got;
}
function flyBack(from, to, delay = 0) {
  const e = cardDiv({ id: -1, c: 0, v: 0 }, true); e.style.transition = 'none'; setT(e, from.x, from.y, 0, 1, 400); e.style.opacity = delay ? 0 : 1;
  setTimeout(() => { e.style.opacity = 1; e.style.transition = ''; setT(e, to.x - G.w / 2, to.y - G.h / 2, 20, 0.45, 400); setTimeout(() => e.remove(), 360); }, 30 + delay);
}
function sortHand() { hands[0].sort((a, b) => (a.c - b.c) || (String(a.v).localeCompare(String(b.v), 'en', { numeric: true }))); }

function play(p, c, chosen = null) {
  const h = hands[p], i = h.indexOf(c); if (i < 0) return;
  h.splice(i, 1); drawnPending = null; lastPlayAt = performance.now();
  c.rot = (R() - 0.5) * 30; c.ox = (R() - 0.5) * 10; c.oy = (R() - 0.5) * 10;
  const e = elOf(c);
  if (p !== 0) { const s = seatPos(p); e.style.transition = 'none'; e.classList.remove('back'); setT(e, s.x - G.w / 2, s.y - G.h / 2, 0, 0.5, 300); e.style.display = ''; void e.offsetWidth; e.style.transition = ''; }
  e.classList.remove('dim', 'mine');
  pile.push(c);
  if (isWild(c)) color = chosen ?? 0; else color = c.c;
  render();
  const pp = pileXY();
  setTimeout(() => fx.ring(pp.x + G.w / 2, pp.y + G.h / 2, COLS[color], 40), 260);
  tone(300 + (typeof c.v === 'number' ? c.v : 10) * 40, 0.08, 'triangle', 0.12, 1.3); buzz(8);
  if (p === 0) { score += pts(c); if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); fx.confetti(60); } }
  if (isWild(c)) setTimeout(() => { ui.pop(c.v === 'W4' ? `+4 · ${CNAME[color]}!` : `${CNAME[color]}!`, COLS[color], 34, 36); arp([72, 76, 79], 60, 0.08); }, 200);
  // last-card shout check
  if (h.length === 1) {
    if (zinged[p]) bubble(p, 'ZING!');
    else { vulnerable = p; if (p === 0) armCatch(); else offerCatch(p); }
  }
  if (!h.length) return setTimeout(() => endRound(p), 500);
  // effects
  let skip = false;
  const nx = () => next(p);
  if (c.v === 'S') { skip = true; bubble(nx(), 'Skipped!'); }
  if (c.v === 'R') { dir = -dir; ui.pop('⇄ Reverse', '#fff', 28, 36); }
  if (c.v === 'D') { const v = nx(); drawCards(v, 2); bubble(v, '+2'); skip = true; }
  if (c.v === 'W4') { const v = nx(); drawCards(v, 4); bubble(v, '+4'); skip = true; }
  turn = next(p, skip ? 2 : 1);
  busy = true; render();
  setTimeout(() => { busy = false; startTurn(); }, p === 0 ? 520 : 560);
}
function bubble(p, t) {
  if (p === 0) { ui.pop(t, '#ffb627', 34, 62); return; }
  const e = seatEls[p], b = document.createElement('div'); b.className = 'bub'; b.textContent = t; e.appendChild(b); setTimeout(() => b.remove(), 1300);
}
// you forgot to ZING: the rivals may notice
function armCatch() {
  clearTimeout(catchT);
  const delay = 1400 - skill * 800 + R() * 500;
  catchT = setTimeout(() => {
    if (vulnerable !== 0 || state !== 'play') return;
    if (R() < 0.45 + skill * 0.5) { vulnerable = -1; const who = 1 + Math.floor(R() * 3); bubble(who, 'Caught you!'); ui.pop('No ZING! +2', '#ff5a5f', 32, 58); soft.err(); buzz([30, 40, 30]); drawCards(0, 2); render(); }
  }, delay);
}
// a rival forgot: tap their seat's Catch button
function offerCatch(p) {
  const forgot = R() > 0.3 + skill * 0.5;
  if (!forgot) { zinged[p] = true; bubble(p, 'ZING!'); vulnerable = -1; return; }
  const b = document.createElement('button'); b.className = 'catch'; b.textContent = 'Catch!'; seatEls[p].appendChild(b);
  const done = () => { b.remove(); if (vulnerable === p) vulnerable = -1; };
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (vulnerable !== p) return done(); bubble(p, '+2 😳'); ui.pop('Caught!', '#ffb627', 34, 36); arp([79, 84], 70, 0.1); drawCards(p, 2); done(); render(); });
  setTimeout(() => { if (vulnerable === p) { zinged[p] = true; bubble(p, 'ZING!'); } done(); }, 2200);
}
zingB.addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (state !== 'play') return;
  if (vulnerable === 0) { vulnerable = -1; clearTimeout(catchT); zinged[0] = true; ui.pop('ZING!', '#ffb627', 46, 52); arp([76, 83, 88], 60, 0.1); render(); return; }
  if (hands[0].length === 2 && !zinged[0]) { zinged[0] = true; ui.pop('ZING!', '#ffb627', 46, 52); arp([76, 83, 88], 60, 0.1); fx.sparks(innerWidth - 56, zingB.offsetTop + 42, ['#ffb627', '#fff'], 14, { speed: 4 }); buzz(12); render(); }
});

function startTurn() {
  if (state !== 'play') return;
  render();
  if (turn !== 0) setTimeout(cpuTurn, 380 + R() * 200);
}
function cpuTurn() {
  if (state !== 'play' || turn === 0) return;
  const p = turn, h = hands[p]; let legal = h.filter(canPlay);
  if (!legal.length) {
    const [c] = drawCards(p, 1); render();
    if (c && canPlay(c)) { setTimeout(() => play(p, c, bestColor(p)), 420); return; }
    turn = next(p); busy = true; setTimeout(() => { busy = false; startTurn(); }, 420); return;
  }
  const smart = R() < skill;
  let pick = legal[Math.floor(R() * legal.length)];
  if (smart) {
    const nextN = hands[next(p)].length, threat = nextN <= 2;
    const score = (c) => (isWild(c) ? (h.length <= 2 ? 30 : -20) : 0) + (threat && (c.v === 'D' || c.v === 'S' || c.v === 'W4') ? 40 : 0) + (typeof c.v === 'number' ? c.v : 8) + (c.c === color ? 2 : 0) + (threat && c.v === 'R' ? 20 : 0);
    pick = legal.slice().sort((a, b) => score(b) - score(a))[0];
  }
  if (h.length === 2) zinged[p] = false;
  play(p, pick, bestColor(p, pick));
}
function bestColor(p, except = null) {
  const cnt = [0, 0, 0, 0]; for (const c of hands[p]) if (c !== except && c.c < 4) cnt[c.c]++;
  if (R() > skill) return Math.floor(R() * 4);
  return cnt.indexOf(Math.max(...cnt));
}

// ---------------------------------------------------------------- your input
let pickCb = null;
pickEl.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); const c = +b.dataset.c; pickEl.style.display = 'none'; const cb = pickCb; pickCb = null; cb && cb(c); }));
function tapCard(c) {
  if (state !== 'play' || turn !== 0 || busy || pickCb) return;
  if (!hands[0].includes(c)) return;
  if (drawnPending && c !== drawnPending) return shake(c);
  if (!canPlay(c)) return shake(c);
  if (isWild(c)) { pickCb = (col) => play(0, c, col); pickEl.style.display = 'flex'; soft.click(); return; }
  play(0, c);
}
function shake(c) { const e = elOf(c); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); soft.err(); buzz(15); }
deckHit.addEventListener('pointerdown', (e) => { e.stopPropagation(); myDraw(); });
function myDraw() {
  if (state !== 'play' || turn !== 0 || busy || drawnPending || pickCb) return;
  const [c] = drawCards(0, 1); render();
  if (c && canPlay(c)) { drawnPending = c; render(); return; }
  turn = next(0); busy = true; render(); setTimeout(() => { busy = false; startTurn(); }, 450);
}
passB.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!drawnPending) return; drawnPending = null; turn = next(0); busy = true; render(); setTimeout(() => { busy = false; startTurn(); }, 350); });

// ---------------------------------------------------------------- round flow
function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 4 : level;
  skill = Math.max(0.15, Math.min(0.97, (0.32 + Math.min(L, 10) * 0.05) * fk));
  startN = L <= 2 ? 5 : L <= 4 ? 6 : 7;
  R = rngf(D.seed || level * 7177 + 13);
  for (const e of els.values()) e.remove(); els.clear(); tbl.querySelectorAll('.catch').forEach(e => e.remove());
  deck = newDeck(); pile = []; hands = [[], [], [], []]; zinged = [false, false, false, false]; vulnerable = -1; clearTimeout(catchT);
  dir = 1; turn = 0; drawnPending = null; busy = false; recorded = false; beatenShown = false; score = 0; pickCb = null; pickEl.style.display = 'none';
  for (let k = 0; k < startN; k++) for (let p = 0; p < 4; p++) hands[p].push(deck.pop());
  sortHand();
  let f = deck.pop(); while (typeof f.v !== 'number') { deck.unshift(f); f = deck.pop(); }
  pile.push(f); color = f.c; f.rot = -6;
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  render();
  // deal animation
  const dp = deckXY();
  hands[0].forEach((c, i) => { const e = elOf(c), tr = e.style.transform; e.style.transition = 'none'; e.classList.add('back'); setT(e, dp.x, dp.y, 0, 1, 200); void e.offsetWidth; e.style.transition = ''; setTimeout(() => { e.style.transform = tr; e.style.zIndex = 100 + i; soft.click(); }, 80 + i * 90); setTimeout(() => e.classList.remove('back'), 260 + i * 90); });
  for (let p = 1; p <= 3; p++) for (let i = 0; i < 3; i++) flyBack(dp, seatPos(p), 80 + i * 120 + p * 30);
}
function endRound(p) {
  if (state !== 'play') return;
  clearTimeout(catchT);
  if (p === 0) {
    let bonus = 0; for (let q = 1; q <= 3; q++) for (const c of hands[q]) bonus += pts(c);
    score += bonus; state = 'won';
    if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); }
    fx.confetti(140, COLS.concat(['#fff'])); arp([67, 71, 74, 79, 83, 86], 100, 0.12, 0.9); buzz([20, 60, 20]);
    total += score; S.set('total', total);
    if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || score > prev.s) S.set(k, { s: score }); }
    else { level++; S.set('level', level); }
    D.won(score); render();
    ui.win(D.isDaily ? '' : level - 1, `${score} pts · +${bonus} from rivals' hands`);
  } else {
    state = 'lost'; const frac = Math.max(0, 1 - hands[0].length / (startN + 4));
    if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, frac); }
    bubble(p, 'Out! 🎉'); soft.err(); render();
    ui.lose(`${SEATS[p].name} wins`, `You had ${hands[0].length} card${hands[0].length === 1 ? '' : 's'} left`);
  }
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; startTurn(); return; }
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  build(); state = 'play'; setTimeout(startTurn, 700);
});
layout(); build();

// ---------------------------------------------------------------- test hook
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const catchBtn = tbl.querySelector('.catch'); if (catchBtn && R() < 0.5) return catchBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    if (turn !== 0 || busy) return;
    if (pickCb) { const cnt = [0, 0, 0, 0]; hands[0].forEach(c => c.c < 4 && cnt[c.c]++); const b = pickEl.querySelector(`[data-c="${cnt.indexOf(Math.max(...cnt))}"]`); return b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
    if (hands[0].length === 2 && !zinged[0]) return zingB.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    if (drawnPending) return tapCard(drawnPending);
    const legal = hands[0].filter(canPlay);
    if (!legal.length) return myDraw();
    legal.sort((a, b) => (isWild(a) - isWild(b)) || ((typeof b.v === 'number' ? 0 : 1) - (typeof a.v === 'number' ? 0 : 1)));
    tapCard(legal[0]);
  },
};

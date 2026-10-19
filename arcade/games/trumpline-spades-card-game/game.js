// Trumpline — the classic Spades card game (public partnership rules). You and your computer partner (across) against
// two computer players. Everyone bids how many tricks they'll take (or Nil); spades are always trump and can't be led
// until broken; follow suit. Make your team's bid: 10 a trick plus 1 per overtrick (bag); miss it: minus 10 a trick.
// Nil: ±100. Every 10 bags costs 100. First team to 200 (or 300) wins. Computer players only see their own hand.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { tableCSS } from './cards.js';
import { trickTable } from './trick.js';

const NAME = 'Trumpline: Spades Card Game';
const S = store('trumpline');
const F = flow('trumpline');
const ui = createUI({ title: 'Trumpline', hint: 'Tap to deal', hand: '', score: false, progress: false });
cardTheme({ accent: '#2a9d8f' });
const D = daily('trumpline', ui, { name: NAME });
const B = board({ game: 'trumpline', label: 'Wins vs CPU (Hard ×2)', limits: { maxRun: 2, maxPerSec: 0.05 }, mode: 'sum' });   // world board: games won today
const fx = fx2d(11);
let diff = S.get('diff', 1), target = S.get('target', innerWidth < 700 ? 200 : 300);
const doneToday = S.get('daily_' + todayKey(), null);
const sc = startCard(ui, D, {
  kicker: D.isDaily ? 'Daily game · same deals for everyone' : 'spades card game',
  doneLine: doneToday ? (D.isDaily ? `Won today by ${doneToday.m}` : 'Daily game won ✓') : null,
  chips: { items: ['Easy', 'Normal', 'Hard'], get: () => diff, set: (i) => { diff = i; S.set('diff', i); } },
});
{ // second chip row: match length
  const row = document.createElement('div'); row.className = 'calm-row'; row.style.marginTop = '8px';
  row.addEventListener('pointerdown', e => e.stopPropagation());
  const draw = () => { row.innerHTML = ''; [200, 300].forEach(t => { const b = document.createElement('button'); b.className = 'calm-chip' + (t === target ? ' on' : ''); b.textContent = t === 200 ? 'Quick · to 200' : 'Classic · to 300'; b.onclick = (e) => { e.stopPropagation(); target = t; S.set('target', t); draw(); }; row.appendChild(b); }); };
  draw(); sc.row.after(row);
  const p = document.createElement('p'); p.textContent = 'You + Bea vs Rook + Vega · ♠ always trump'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p);
}
ui.els.win.querySelector('p').innerHTML = 'GAME <span data-l>1</span>';
ui.els.lose.querySelector('.hint').textContent = 'Tap for a new game';
ui.els.win.querySelector('.hint').textContent = 'Tap for a new game';

const TH = { felt: ['#1f706a', '#124a47', '#061d1d'], back: ['#2a8c84', '#0f3f3c'], trim: '#f5d27a', accentDark: '#14776d',
  motif: 'polygon(50% 2%,86% 40%,95% 58%,87% 74%,71% 79%,58% 72%,65% 99%,35% 99%,42% 72%,29% 79%,13% 74%,5% 58%,14% 40%)' };
tableCSS(TH);
css(`.hc-card{padding-top:calc(90px + env(safe-area-inset-top))}
#bidpad{position:fixed;left:50%;transform:translateX(-50%);z-index:9;width:min(370px,calc(100% - 16px));background:rgba(6,24,24,.86);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:10px 10px 12px;box-shadow:0 14px 40px rgba(0,0,0,.4);text-align:center;color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#bidpad[hidden]{display:none}
#bidpad .t{font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:750;opacity:.75;margin:2px 0 8px}
#bidpad .g{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
#bidpad button{font:inherit;font-weight:800;font-size:17px;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:12px;height:40px;cursor:pointer;padding:0}
#bidpad button.sug{background:${TH.trim};color:#1d2a26;border-color:${TH.trim}}
#bidpad button.nil{font-size:13px}
#teams{position:fixed;left:0;right:0;top:calc(14px + env(safe-area-inset-top));z-index:5;display:flex;justify-content:center;gap:10px;pointer-events:none}
#teams div{background:rgba(0,0,0,.24);border-radius:14px;padding:4px 12px;color:#fff;font-weight:750;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
#teams div small{opacity:.7;font-weight:650;font-size:11px;margin-left:4px}
#teams div.us{box-shadow:inset 0 0 0 2px rgba(245,210,122,.55)}
body #tinfo{display:none}
@media (max-width:560px){#teams div.h{display:none}}
#teams div.h{background:none;opacity:.7;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;padding:6px 0 0}`);
const felt = document.createElement('div'); felt.id = 'felt'; document.body.prepend(felt);
const deco = document.createElement('canvas'); deco.id = 'deco'; felt.after(deco);
const teamsEl = document.createElement('div'); teamsEl.id = 'teams'; teamsEl.innerHTML = '<div class="us" data-u></div><div class="h" data-h></div><div data-t></div>'; document.body.appendChild(teamsEl);
const pad = document.createElement('div'); pad.id = 'bidpad'; pad.hidden = true; document.body.appendChild(pad);
pad.addEventListener('pointerdown', e => e.stopPropagation());

const NAMES = ['You', 'Rook', 'Bea', 'Vega'], COLORS = ['#3f8f6b', '#c0583a', '#d0a23a', '#5a6fd6'], INIT = ['★', 'R', 'B', 'V'];
const T = trickTable({ names: NAMES, colors: COLORS, initials: INIT, theme: TH, onCard: (id) => tapCard(id) });

function paintDeco() {   // a faint trump-line grid of spade pips
  const c = deco, dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = c.clientHeight || innerHeight * 0.34;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = 'rgba(200,255,240,.05)'; g.font = '22px system-ui'; g.textAlign = 'center';
  for (let y = H * 0.3, row = 0; y < H + 20; y += 46, row++) for (let x = (row % 2) * 30; x < W + 30; x += 60) g.fillText('♠', x, y);
}

// ---------------------------------------------------------------- cards
const SUIT = (c) => (c / 13) | 0, VAL = (c) => (c % 13 === 0 ? 14 : c % 13 + 1);
const SP = 0, HE = 1, DI = 2, CL = 3;
const ORDER = [DI, CL, HE, SP];
const sortHand = (h) => h.sort((a, b) => ORDER.indexOf(SUIT(a)) - ORDER.indexOf(SUIT(b)) || VAL(a) - VAL(b));
const team = (s) => s % 2;   // 0: you + Bea, 1: Rook + Vega
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- game state
let state = 'ready', level = S.get('level', 1), scores = [0, 0], bags = [0, 0], handNo = 0, dealer = 3, hands = [[], [], [], []], phase = 'idle';
let bids = [-1, -1, -1, -1], won = [0, 0, 0, 0], leader = 0, trick = [], trickNo = 0, broken = false, played = new Set(), voids = [0, 1, 2, 3].map(() => [false, false, false, false]);
let recorded = false, tricksTotal = 0, busy = false, rand = Math.random, gameSeed = 0, bidTurn = 0;
let lastBot = 0; const FAST = () => performance.now() - lastBot < 1500, wait = (ms, fast) => FAST() ? fast : ms;

function layout() { T.layout(); paintDeco(); showHand(); pad.style.bottom = (innerHeight - T.G.handY + 14) + 'px'; }
addEventListener('resize', layout);
function paintTeams() {
  teamsEl.querySelector('[data-u]').innerHTML = `Us ${scores[0]}<small>${bags[0]} bag${bags[0] === 1 ? '' : 's'}</small>`;
  teamsEl.querySelector('[data-t]').innerHTML = `Them ${scores[1]}<small>${bags[1]} bag${bags[1] === 1 ? '' : 's'}</small>`;
}
function paintSeats() {
  for (let s = 0; s < 4; s++) T.score(s, bids[s] < 0 ? '–' : bids[s] === 0 ? `Nil · ${won[s]}` : `${won[s]} / ${bids[s]}`);
}

function newGame() {
  scores = [0, 0]; bags = [0, 0]; handNo = 0; dealer = 3; recorded = false; tricksTotal = 0;
  gameSeed = D.seed ? D.seed * 89 + 11 : (level * 7919 + (S.get('games', 0) * 104729) + ((Math.random() * 1e6) | 0));
  rand = rngf(gameSeed * 37 + 5);
  paintTeams(); B.start(); newHand();
}
function newHand() {
  const r = rngf(gameSeed + handNo * 7717 + 3), deck = [...Array(52).keys()];
  for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  hands = [0, 1, 2, 3].map(s => sortHand(deck.slice(s * 13, s * 13 + 13)));
  bids = [-1, -1, -1, -1]; won = [0, 0, 0, 0]; trick = []; trickNo = 0; broken = false; played = new Set(); voids = [0, 1, 2, 3].map(() => [false, false, false, false]);
  dealer = (dealer + 1) % 4;
  T.clearAll(); for (let s = 1; s < 4; s++) T.fan(s, 13); for (let s = 0; s < 4; s++) T.badge(s, '');
  T.badge(dealer, 'dealer');
  teamsEl.querySelector('[data-h]').textContent = `Hand ${handNo + 1} · to ${target}`;
  paintSeats(); paintTeams(); soft.swish();
  phase = 'bid'; bidTurn = (dealer + 1) % 4; showHand(); nextBid();
}
function nextBid() {
  if (phase !== 'bid') return;
  if (bids.every(b => b >= 0)) return startPlay();
  const s = bidTurn; T.turn(s);
  if (s === 0) { openPad(); return; }
  T.msg(`${NAMES[s]} is bidding…`); busy = true;
  setTimeout(() => { busy = false; if (phase !== 'bid' || bidTurn !== s) return; placeBid(s, cpuBid(s)); }, wait(650, 25));
}
function placeBid(s, b) {
  bids[s] = b; pad.hidden = true; T.badge(s, b === 0 ? 'NIL' : `bid ${b}`); paintSeats();
  if (s === 0) soft.wood(); else soft.click();
  if (b === 0) chime(4, 79, 0.08);
  bidTurn = (s + 1) % 4; setTimeout(nextBid, wait(220, 10));
}
function openPad() {
  const sug = estimate(0, 1).bid, pb = bids[2];
  T.msg('');
  pad.innerHTML = `<div class="t">Your bid${pb >= 0 ? ` · Bea bid ${pb === 0 ? 'Nil' : pb}` : ''} · we'd say ${sug === 0 ? 'Nil' : sug}</div><div class="g">${[...Array(14).keys()].map(n => `<button data-b="${n}" class="${n === sug ? 'sug' : ''} ${n === 0 ? 'nil' : ''}">${n === 0 ? 'Nil' : n}</button>`).join('')}</div>`;
  pad.querySelectorAll('button').forEach(b => b.onclick = (e) => { e.stopPropagation(); if (phase === 'bid' && bidTurn === 0) placeBid(0, +b.dataset.b); });
  pad.style.bottom = (innerHeight - T.G.handY + 14) + 'px';
  pad.hidden = false;
}
function startPlay() {
  phase = 'play'; trickNo = 0; trick = []; leader = (dealer + 1) % 4;
  for (let s = 0; s < 4; s++) T.badge(s, '');
  const us = bids[0] + bids[2], them = bids[1] + bids[3];
  T.msg(`Us bid ${us} · them ${them}`);
  setTimeout(next, wait(700, 30));
}
const turnSeat = () => (leader + trick.length) % 4;
function showHand() {
  const my = phase === 'play' && turnSeat() === 0 && !busy;
  T.setHand(hands[0], { legal: phase === 'play' && turnSeat() === 0 ? new Set(legal(0)) : null, lift: my });
}
function next() {
  if (phase !== 'play') return;
  if (trick.length === 4) return resolve();
  const s = turnSeat(); T.turn(s);
  if (s === 0) {
    const L = legal(0), led = trick.length ? SUIT(trick[0].c) : -1;
    T.msg(!trick.length ? (broken ? 'Your lead' : 'Your lead · spades not broken yet') : SUIT(L[0]) === led ? `Follow ${T.SUITS[led]}` : `No ${T.SUITS[led]} · trump or throw off`);
    showHand(); return;
  }
  T.msg(''); showHand(); busy = true;
  setTimeout(() => { busy = false; if (phase !== 'play' || turnSeat() !== s) return; playCard(s, cpuChoose(s)); }, wait(560, 25));
}
function legal(s) {
  const h = hands[s];
  if (!trick.length) { if (!broken) { const ns = h.filter(c => SUIT(c) !== SP); if (ns.length) return ns; } return h.slice(); }
  const led = SUIT(trick[0].c), f = h.filter(c => SUIT(c) === led);
  return f.length ? f : h.slice();
}
function winnerOf(tr) {
  const led = SUIT(tr[0].c); let w = tr[0];
  for (const t of tr) { const ws = SUIT(w.c), ts = SUIT(t.c);
    if (ts === SP && ws !== SP) w = t; else if (ts === ws && VAL(t.c) > VAL(w.c)) w = t; }
  return w; void led;
}
function playCard(s, c) {
  hands[s] = hands[s].filter(x => x !== c);
  if (trick.length && SUIT(c) !== SUIT(trick[0].c)) voids[s][SUIT(trick[0].c)] = true;
  trick.push({ s, c }); played.add(c);
  if (SUIT(c) === SP && !broken) { broken = true; setTimeout(() => T.msg('Spades broken ♠'), 50); chime(2, 74, 0.08); }
  if (s !== 0) T.fan(s, hands[s].length);
  T.play(s, c); soft.wood(); if (s === 0) buzz(6);
  if (trick.length > 1 && SUIT(c) === SP && SUIT(trick[0].c) !== SP) setTimeout(() => fx.sparks(T.G.cx, T.G.cy, ['#f5d27a', '#fff'], 8, { speed: 2.4 }), 200);
  showHand();
  setTimeout(next, wait(260, 10));
}
function resolve() {
  const w = winnerOf(trick); busy = true;
  setTimeout(() => {
    won[w.s]++; T.sweep(w.s, wait(380, 60)); tricksTotal++; paintSeats();
    const [x, y] = T.seatXY(w.s);
    if (team(w.s) === 0) { chime(won[0] + won[2], 69, 0.08); fx.sparks(x, y, ['#f5d27a', '#fff', '#9fe3b0'], 8, { speed: 2 }); } else soft.click();
    // a nil that just failed / a team that just made its bid
    if (bids[w.s] === 0 && won[w.s] === 1) ui.pop(w.s === 0 ? 'Your nil is broken' : `${NAMES[w.s]}'s nil is broken`, '#fff', 22, 40);
    const tb = (t) => [0, 1, 2, 3].filter(k => team(k) === t && bids[k] > 0).reduce((a, k) => a + bids[k], 0), tw = (t) => [0, 1, 2, 3].filter(k => team(k) === t && bids[k] > 0).reduce((a, k) => a + won[k], 0);
    if (team(w.s) === 0 && tb(0) > 0 && tw(0) === tb(0) && bids[w.s] > 0) { ui.pop('BID MADE!', '#f5d27a', 30, 34); arp([72, 76, 79], 70, 0.1); }
    trick = []; leader = w.s; trickNo++; busy = false;
    if (trickNo === 13) setTimeout(endHand, wait(450, 30)); else next();
  }, wait(900, 70));
}
function teamResult(t) {
  const seatsT = [0, 1, 2, 3].filter(k => team(k) === t);
  let pts = 0, bag = 0; const notes = [];
  const contract = seatsT.filter(k => bids[k] > 0).reduce((a, k) => a + bids[k], 0), got = seatsT.filter(k => bids[k] > 0).reduce((a, k) => a + won[k], 0);
  if (contract > 0) { if (got >= contract) { pts += contract * 10 + (got - contract); bag += got - contract; notes.push(`made ${contract}${got > contract ? ` +${got - contract} bag${got - contract > 1 ? 's' : ''}` : ''}`); } else { pts -= contract * 10; notes.push(`set (${got} of ${contract})`); } }
  for (const k of seatsT) if (bids[k] === 0) { if (won[k] === 0) { pts += 100; notes.push(`${NAMES[k]} nil +100`); } else { pts -= 100; bag += won[k]; pts += won[k]; notes.push(`${NAMES[k]} nil −100`); } }
  return { pts, bag, notes };
}
function endHand() {
  phase = 'summary'; T.turn(-1); T.msg('');
  const res = [teamResult(0), teamResult(1)], before = scores.slice();
  for (const t of [0, 1]) {
    scores[t] += res[t].pts; bags[t] += res[t].bag;
    if (bags[t] >= 10) { bags[t] -= 10; scores[t] -= 100; res[t].notes.push('10 bags −100'); }
  }
  handNo++; paintTeams();
  if (res[0].pts > 0) { fx.sparks(innerWidth * 0.4, 30, ['#f5d27a', '#fff'], 14, { speed: 3 }); arp([72, 76, 79, 84], 70, 0.1); } else soft.err();
  const over = (scores[0] >= target || scores[1] >= target) && scores[0] !== scores[1];
  const row = (t, nm) => `<tr class="${t === 0 ? 'me' : ''}"><td>${nm}<div style="font-weight:500;font-size:12px;opacity:.7">${res[t].notes.join(' · ') || '—'}</div></td><td>${res[t].pts >= 0 ? '+' : ''}${res[t].pts}</td><td><b>${scores[t]}</b><div style="font-size:11px;opacity:.6">${bags[t]} bag${bags[t] === 1 ? "" : "s"}</div></td></tr>`;
  const line = over ? `${scores[0] > scores[1] ? 'You and Bea' : 'Rook and Vega'} passed ${target}.` : `First team to ${target} wins.`;
  setTimeout(() => {
    T.sheet(`<h2>Hand ${handNo}</h2><p>${line}</p><table><tr><th></th><th>hand</th><th>total</th></tr>${row(0, 'You + Bea')}${row(1, 'Rook + Vega')}</table><button class="hc-btn">${over ? 'See result' : 'Next hand'}</button>`, () => over ? gameOver() : newHand());
  }, wait(500, 30));
  void before;
}
function gameOver() {
  phase = 'over'; T.msg(''); pad.hidden = true;
  const win = scores[0] > scores[1], margin = scores[0] - scores[1];
  S.set('games', S.get('games', 0) + 1);
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(win, Math.max(0, Math.min(1, 0.5 + margin / (2 * target)))); }
  if (win) {
    state = 'won'; level++; S.set('level', level);
    if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || margin > prev.m) S.set(k, { m: margin }); }
    B.submit(diff === 2 ? 2 : 1);   // world board: wins vs CPU today (Hard counts 2)
    D.won(margin, 'won Spades by');
    if (D.beaten(margin)) setTimeout(() => ui.pop('BEATEN!', '#fff', 40, 30), 300);
    fx.confetti(130, ['#f5d27a', '#fff', '#2a9d8f', '#9fe3b0', '#ff8f6b']); arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); buzz([20, 60, 20]);
    ui.els.win.querySelector('h1').textContent = 'You win!';
    ui.win(level - 1, `Us ${scores[0]} · Them ${scores[1]} · ${['Easy', 'Normal', 'Hard'][diff]}`);
  } else {
    state = 'lost';
    ui.lose('Rook + Vega win', `Us ${scores[0]} · Them ${scores[1]}`);
  }
}

// ---------------------------------------------------------------- your taps
function tapCard(id) {
  if (state !== 'play' || phase !== 'play' || turnSeat() !== 0 || busy || trick.length === 4) return;
  if (!hands[0].includes(id)) return;
  if (!legal(0).includes(id)) {
    const e = T.els[id]; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); soft.err(); buzz(15);
    T.msg(!trick.length ? 'Spades are not broken yet' : `You must follow ${T.SUITS[SUIT(trick[0].c)]}`); return;
  }
  T.turn(-1); playCard(0, id);
}

// ---------------------------------------------------------------- computer players (own hand + the table only)
function estimate(s, lvl) {
  const h = hands[s], len = (su) => h.filter(c => SUIT(c) === su).length, has = (su, v) => h.some(c => SUIT(c) === su && VAL(c) === v);
  const sp = len(SP); let t = 0;
  if (has(SP, 14)) t += 1; if (has(SP, 13)) t += sp >= 2 ? 1 : 0.4; if (has(SP, 12)) t += sp >= 3 ? 0.8 : 0.2;
  if (sp > 3) t += (sp - 3) * 0.9;
  for (const su of [HE, DI, CL]) {
    const n = len(su);
    if (has(su, 14)) t += n >= 7 ? 0.5 : 1; if (has(su, 13)) t += n >= 2 && n <= 5 ? 0.75 : 0.3; if (has(su, 12)) t += n >= 3 && n <= 4 ? 0.25 : 0;
    if (sp >= 2) { if (n === 0) t += 0.9; else if (n === 1) t += 0.45; }
  }
  const highs = h.filter(c => VAL(c) >= 13).length, spHigh = h.some(c => SUIT(c) === SP && VAL(c) >= 10);
  let bid = Math.max(1, Math.round(t));
  const nilOk = t < 1.4 && highs === 0 && !spHigh && sp <= 3;
  if (nilOk && lvl > 0) bid = 0;
  // a partner who already bid Nil needs cover: bid a touch more
  const pb = bids[(s + 2) % 4]; if (pb === 0 && bid > 0) bid += 1;
  return { bid: Math.min(13, bid), raw: t };
}
function cpuBid(s) {
  const e = estimate(s, diff);
  if (diff === 0) return Math.max(1, Math.min(13, Math.round(e.raw + (rand() - 0.5) * 2)));
  return e.bid;
}
function cpuChoose(s, lvl = diff) {
  const L = legal(s); if (L.length === 1) return L[0];
  const fk = D.isDaily ? 1 : F.k(), slip = [0.35, 0.06, 0.015][lvl] / fk;   // honest skill: how often a player of this level slips
  if (rand() < slip) return L[Math.floor(rand() * L.length)];
  return choose(s, L, lvl);
}
const hi = (arr) => arr.reduce((a, b) => (VAL(b) > VAL(a) ? b : a)), lo = (arr) => arr.reduce((a, b) => (VAL(b) < VAL(a) ? b : a));
function topOut(s, c) { // is c the highest card of its suit still out (not played, not in my hand above it)?
  for (let v = VAL(c) + 1; v <= 14; v++) { const id = SUIT(c) * 13 + (v === 14 ? 0 : v - 1); if (!played.has(id) && !hands[s].includes(id)) return false; }
  return true;
}
function choose(s, L, lvl) {
  const me = bids[s], partner = (s + 2) % 4, t = team(s);
  const teamBid = [s, partner].filter(k => bids[k] > 0).reduce((a, k) => a + bids[k], 0), teamWon = [s, partner].filter(k => bids[k] > 0).reduce((a, k) => a + won[k], 0);
  const oppSeats = [0, 1, 2, 3].filter(k => team(k) !== t), oppBid = oppSeats.filter(k => bids[k] > 0).reduce((a, k) => a + bids[k], 0), oppWon = oppSeats.reduce((a, k) => a + won[k], 0);
  const left = 13 - trickNo;
  let want = me === 0 ? false : teamWon < teamBid;
  if (!want && me !== 0 && lvl === 2 && oppBid - oppWon > 0 && oppBid - oppWon >= left - 1) want = true;   // hard: try to set them
  const coverNil = bids[partner] === 0 && won[partner] === 0;
  const oppNil = oppSeats.find(k => bids[k] === 0 && won[k] === 0);
  if (!trick.length) {
    if (me === 0) return lo(L.filter(c => SUIT(c) !== SP).length ? L.filter(c => SUIT(c) !== SP) : L);
    if (want || coverNil) {
      const sure = L.filter(c => topOut(s, c) && (SUIT(c) === SP || !voidsAgainst(s, SUIT(c))));
      if (sure.length) return hi(sure);
      if (coverNil) return hi(L.filter(c => SUIT(c) !== SP).length ? L.filter(c => SUIT(c) !== SP) : L);
    }
    if (oppNil !== undefined && lvl >= 1) { const lows = L.filter(c => SUIT(c) !== SP); if (lows.length) return lo(lows); }
    // lead low from the longest side suit
    const side = L.filter(c => SUIT(c) !== SP); const pool = side.length ? side : L;
    const len = (su) => hands[s].filter(c => SUIT(c) === su).length;
    return pool.reduce((a, b) => (len(SUIT(b)) * 20 - VAL(b) > len(SUIT(a)) * 20 - VAL(a) ? b : a));
  }
  const w = winnerOf(trick), led = SUIT(trick[0].c), last = trick.length === 3;
  const beats = (c) => winnerOf([...trick, { s, c }]).c === c;
  const winners = L.filter(beats), losers = L.filter(c => !beats(c));
  const partnerWinning = team(w.s) === t && w.s !== s;
  if (me === 0) { // nil: stay under
    if (losers.length) return hi(losers);
    return lo(L);
  }
  if (coverNil && !partnerWinning && winners.length) return last ? lo(winners) : hi(winners);
  if (partnerWinning && !coverNil) {
    const safe = last || topOut(s, w.c) || (SUIT(w.c) === SP && SUIT(trick[0].c) !== SP && lvl >= 1);
    if (safe || !want) return losers.length ? lo(losers) : lo(L);
  }
  if (oppNil !== undefined && w.s === oppNil && losers.length) return lo(losers);   // let the nil bidder take it
  if (want && winners.length) {
    if (last) return lo(winners);
    const top = winners.filter(c => topOut(s, c) && SUIT(c) === led); if (top.length) return lo(top);
    return SUIT(lo(winners)) === SP && led !== SP ? lo(winners) : hi(winners);
  }
  // avoid bags: shed the highest card that still loses, else the cheapest winner
  if (losers.length) return SUIT(L[0]) === led ? hi(losers) : hi(losers.filter(c => SUIT(c) !== SP).length ? losers.filter(c => SUIT(c) !== SP) : losers);
  return lo(L);
}
const voidsAgainst = (s, su) => [1, 3].some(k => voids[(s + k) % 4][su] && hands[(s + k) % 4].length && !voids[(s + k) % 4][SP]);

// ---------------------------------------------------------------- start / end cards
ui.onTap((which) => {
  if ((which === 'win' || which === 'lose') && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  state = 'play'; newGame();
});
T.layout(); paintDeco(); paintTeams(); paintSeats(); T.info('');
for (let s = 1; s < 4; s++) T.fan(s, 13);

// ---------------------------------------------------------------- test hook: the bot plays your seat like a careful normal player
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return tricksTotal; },
  bot() {
    lastBot = performance.now();
    if (state !== 'play') return;
    if (T.sheetOpen) return T.closeSheet();
    if (phase === 'bid' && bidTurn === 0 && !pad.hidden) return placeBid(0, estimate(0, 1).bid);
    if (phase === 'play' && turnSeat() === 0 && !busy && trick.length < 4 && hands[0].length) { const L = legal(0); tapCard(L.length === 1 ? L[0] : choose(0, L, 1)); }
  },
};

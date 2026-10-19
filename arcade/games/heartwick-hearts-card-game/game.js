// Heartwick — the classic Hearts card game (public rules) against three computer players. Pass three cards (left, right,
// across, hold), 2♣ leads, follow suit, hearts can't be led until broken, no points on the first trick. Every heart is
// 1 point, the queen of spades 13; take all 26 to shoot the moon. First to 100 ends it: lowest score wins.
// The computer players only ever see their own hand and the cards on the table.
import { createUI, store, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, cardTheme, startCard, fx2d, chime, arp, soft, todayKey } from './calm.js';
import { tableCSS } from './cards.js';
import { trickTable } from './trick.js';

const NAME = 'Heartwick: Hearts Card Game';
const S = store('heartwick');
const F = flow('heartwick');
const ui = createUI({ title: 'Heartwick', hint: 'Tap to deal', hand: '', score: false, progress: false });
cardTheme({ accent: '#c8466a' });
const D = daily('heartwick', ui, { name: NAME });
const B = board({ game: 'heartwick', label: 'Wins vs CPU (Hard ×2)', limits: { maxRun: 2, maxPerSec: 0.05 }, mode: 'sum' });   // world board: games won today
const fx = fx2d(11);
let diff = S.get('diff', 1);   // 0 easy · 1 normal · 2 hard
const doneToday = S.get('daily_' + todayKey(), null);
startCard(ui, D, {
  kicker: D.isDaily ? 'Daily game · same deals for everyone' : 'hearts card game',
  doneLine: doneToday ? (D.isDaily ? `Won today by ${doneToday.m}` : 'Daily game won ✓') : null,
  chips: { items: ['Easy', 'Normal', 'Hard'], get: () => diff, set: (i) => { diff = i; S.set('diff', i); } },
});
{ const p = document.createElement('p'); p.textContent = 'Dodge every ♥ and the Q♠ · lowest score wins'; p.style.cssText = 'font-size:15px;opacity:.8;margin-top:6px'; ui.els.start.querySelector('.calm-kicker').after(p); }
ui.els.win.querySelector('p').innerHTML = 'GAME <span data-l>1</span>';
ui.els.lose.querySelector('.hint').textContent = 'Tap for a new game';
ui.els.win.querySelector('.hint').textContent = 'Tap for a new game';

const TH = { felt: ['#8a2c4a', '#5e1a33', '#2a0a17'], back: ['#c8466a', '#6a1631'], trim: '#ffc9a8', accentDark: '#b0284f',
  motif: 'polygon(50% 96%,10% 58%,1% 38%,4% 18%,17% 5%,33% 4%,50% 20%,67% 4%,83% 5%,96% 18%,99% 38%,90% 58%)' };
tableCSS(TH);
css(`.hc-card{padding-top:calc(96px + env(safe-area-inset-top))}`);
const felt = document.createElement('div'); felt.id = 'felt'; document.body.prepend(felt);
const deco = document.createElement('canvas'); deco.id = 'deco'; felt.after(deco);

const NAMES = ['You', 'Wren', 'Otto', 'Juno'], COLORS = ['#3f8f6b', '#d98a3a', '#5a6fd6', '#a05ad0'], INIT = ['★', 'W', 'O', 'J'];
const T = trickTable({ names: NAMES, colors: COLORS, initials: INIT, theme: TH, onCard: (id) => tapCard(id) });

function paintDeco() {   // a soft candle glow and a few drifting hearts in the felt
  const c = deco, dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = c.clientHeight || innerHeight * 0.34;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = H * (0.25 + r() * 0.7), k = 6 + r() * 14; g.fillStyle = `rgba(255,190,200,${0.04 + r() * 0.05})`;
    g.beginPath(); g.moveTo(x, y + k * 0.9); g.bezierCurveTo(x - k * 1.2, y, x - k * 0.6, y - k * 0.8, x, y - k * 0.25); g.bezierCurveTo(x + k * 0.6, y - k * 0.8, x + k * 1.2, y, x, y + k * 0.9); g.fill();
  }
}

// ---------------------------------------------------------------- cards
const SUIT = (c) => (c / 13) | 0, VAL = (c) => (c % 13 === 0 ? 14 : c % 13 + 1);   // ace high
const SP = 0, HE = 1, DI = 2, CL = 3, QS = 11, TWO_C = 3 * 13 + 1;
const pts = (c) => (SUIT(c) === HE ? 1 : c === QS ? 13 : 0);
const ORDER = [CL, DI, SP, HE];   // hand sort: clubs, diamonds, spades, hearts
const sortHand = (h) => h.sort((a, b) => ORDER.indexOf(SUIT(a)) - ORDER.indexOf(SUIT(b)) || VAL(a) - VAL(b));
function rngf(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------------------------------------------------------------- game state
let state = 'ready', level = S.get('level', 1), totals = [0, 0, 0, 0], handNo = 0, hands = [[], [], [], []], phase = 'idle';
let leader = 0, trick = [], trickNo = 0, broken = false, taken = [0, 0, 0, 0], played = new Set(), voids = [[], [], [], []].map(() => [false, false, false, false]);
let passed = [[], [], [], []], passSel = new Set(), fresh = new Set(), recorded = false, tricksTotal = 0, busy = false, rand = Math.random, gameSeed = 0;
const FAST = () => performance.now() - lastBot < 1500;
const wait = (ms, fast) => FAST() ? fast : ms;

function layout() { T.layout(); paintDeco(); showHand(); }
addEventListener('resize', layout);

function newGame() {
  totals = [0, 0, 0, 0]; handNo = 0; recorded = false; tricksTotal = 0;
  gameSeed = D.seed ? D.seed * 97 + 5 : (level * 7919 + (S.get('games', 0) * 104729) + ((Math.random() * 1e6) | 0));
  rand = rngf(gameSeed * 31 + 3);
  for (let s = 0; s < 4; s++) T.score(s, 0);
  B.start(); newHand();
}
const passDir = () => [1, 3, 2, 0][handNo % 4];   // left, right, across, hold
const DIRNAME = { 1: 'left to Wren', 3: 'right to Juno', 2: 'across to Otto', 0: '' };
function newHand() {
  const r = rngf(gameSeed + handNo * 7717 + 1), deck = [...Array(52).keys()];
  for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  hands = [0, 1, 2, 3].map(s => sortHand(deck.slice(s * 13, s * 13 + 13)));
  trick = []; trickNo = 0; broken = false; taken = [0, 0, 0, 0]; played = new Set(); voids = [0, 1, 2, 3].map(() => [false, false, false, false]);
  passed = [[], [], [], []]; passSel = new Set(); fresh = new Set();
  T.clearAll(); for (let s = 1; s < 4; s++) T.fan(s, 13); for (let s = 0; s < 4; s++) { T.badge(s, ''); T.score(s, totals[s]); }
  T.info(`Hand ${handNo + 1} · game to 100${D.isDaily ? ' · daily' : ''}`);
  soft.swish();
  const d = passDir();
  if (d) { phase = 'pass'; T.msg(`Pick 3 cards to pass ${DIRNAME[d]}`); T.turn(-1); showHand(); updatePassBtn(); }
  else { phase = 'hold'; T.msg('No passing this hand'); showHand(); setTimeout(startPlay, wait(900, 60)); }
}
function updatePassBtn() {
  if (phase !== 'pass') { T.button(''); return; }
  const arrow = { 1: '←', 3: '→', 2: '↑' }[passDir()];
  T.button(passSel.size === 3 ? `Pass ${arrow}` : '', doPass);
}
function showHand() {
  const legalSet = phase === 'play' && turnSeat() === 0 && !busy ? new Set(legal(0)) : null;
  T.setHand(hands[0], { legal: phase === 'play' && turnSeat() === 0 ? legalSet : null, sel: phase === 'pass' ? passSel : null, fresh, lift: true });
}
function doPass() {
  if (phase !== 'pass' || passSel.size !== 3) return;
  const d = passDir(), give = [[...passSel], cpuPass(1), cpuPass(2), cpuPass(3)];
  for (let s = 0; s < 4; s++) { passed[s] = give[s]; hands[s] = hands[s].filter(c => !give[s].includes(c)); }
  for (let s = 0; s < 4; s++) hands[(s + d) % 4].push(...give[s]);
  hands.forEach(sortHand); fresh = new Set(give[(4 - d) % 4]);   // what the seat passing to you sent
  { const [tx, ty] = T.seatXY(d); give[0].forEach(id => { const e = T.els[id]; e.classList.remove('up', 'dim', 'fresh'); e.classList.add('trk'); e.style.transform = `translate(${tx - T.G.cw / 2}px,${ty - T.G.ch / 2}px) scale(.4)`; e.style.opacity = 0; setTimeout(() => { e.style.visibility = 'hidden'; e.style.opacity = 1; e.classList.remove('trk'); }, 380); }); }
  passSel = new Set(); T.button(''); phase = 'passed';
  T.msg(`You got ${[...fresh].map(cardName).join(' ')}`); soft.swish(); buzz(8);
  showHand();
  setTimeout(() => { fresh = new Set(); startPlay(); }, wait(1500, 80));
}
const RN = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardName = (c) => RN[c % 13 + 1] + T.SUITS[SUIT(c)];
function startPlay() {
  phase = 'play'; trickNo = 0; trick = [];
  leader = hands.findIndex(h => h.includes(TWO_C));
  next();
}
const turnSeat = () => (leader + trick.length) % 4;
function next() {
  if (phase !== 'play') return;
  if (trick.length === 4) return resolve();
  const s = turnSeat(); T.turn(s);
  if (s === 0) {
    const L = legal(0), led = trick.length ? SUIT(trick[0].c) : -1;
    T.msg(trickNo === 0 && !trick.length ? 'Lead the 2♣' : !trick.length ? (broken ? 'Your lead' : 'Your lead · hearts not broken yet') : L.length && SUIT(L[0]) === led ? `Follow ${T.SUITS[led]}` : `No ${T.SUITS[led]} · play any card`);
    showHand(); return;
  }
  T.msg(''); showHand();
  busy = true;
  setTimeout(() => { busy = false; if (phase !== 'play' || turnSeat() !== s) return; playCard(s, cpuChoose(s)); }, wait(560, 25));
}
function legal(s) {
  const h = hands[s];
  if (!trick.length) {
    if (trickNo === 0) return h.includes(TWO_C) ? [TWO_C] : h.slice();
    if (!broken) { const nh = h.filter(c => SUIT(c) !== HE); if (nh.length) return nh; }
    return h.slice();
  }
  const led = SUIT(trick[0].c), f = h.filter(c => SUIT(c) === led);
  if (f.length) return f;
  if (trickNo === 0) { const safe = h.filter(c => !pts(c)); if (safe.length) return safe; const nh = h.filter(c => SUIT(c) !== HE); if (nh.length) return nh; }
  return h.slice();
}
function playCard(s, c) {
  hands[s] = hands[s].filter(x => x !== c);
  if (trick.length && SUIT(c) !== SUIT(trick[0].c)) voids[s][SUIT(trick[0].c)] = true;
  trick.push({ s, c }); played.add(c);
  if (SUIT(c) === HE && !broken) { broken = true; setTimeout(() => T.msg('Hearts broken ♥'), 50); tone2(); }
  if (s !== 0) T.fan(s, hands[s].length);
  T.play(s, c); soft.wood(); if (s === 0) buzz(6);
  if (c === QS) { setTimeout(() => { fx.sparks(T.G.cx, T.G.cy, ['#1f2433', '#fff', '#c8466a'], 12, { speed: 3 }); }, 200); }
  showHand();
  setTimeout(next, wait(260, 10));
}
const tone2 = () => chime(2, 76, 0.08);
function resolve() {
  const led = SUIT(trick[0].c); let w = trick[0];
  for (const t of trick) if (SUIT(t.c) === led && VAL(t.c) > VAL(w.c)) w = t;
  const p = trick.reduce((a, t) => a + pts(t.c), 0);
  busy = true;
  setTimeout(() => {
    taken[w.s] += p; T.sweep(w.s, wait(380, 60)); tricksTotal++;
    T.badge(w.s, ''); for (let s = 0; s < 4; s++) T.score(s, totals[s], taken[s] ? `+${taken[s]}` : '');
    const [x, y] = T.seatXY(w.s);
    if (p) {
      ui.pop(`+${p}${p >= 13 ? ' ♠Q' : ' ♥'}`, w.s === 0 ? '#ffd0d8' : '#fff', p >= 13 ? 30 : 24, Math.max(8, Math.min(80, (y - 40) / innerHeight * 100)));
      if (w.s === 0) { soft.err(); buzz([10, 40, 10]); } else { fx.sparks(x, y, ['#ffc9a8', '#fff'], 8, { speed: 2 }); chime(3, 79, 0.07); }
    } else if (w.s === 0) chime(1, 72, 0.06);
    trick = []; leader = w.s; trickNo++; busy = false;
    if (trickNo === 13) setTimeout(endHand, wait(450, 30)); else next();
  }, wait(900, 70));
}
function endHand() {
  phase = 'summary'; T.turn(-1); T.msg('');
  const shooter = taken.findIndex(t => t === 26);
  const add = shooter >= 0 ? taken.map((t, s) => (s === shooter ? 0 : 26)) : taken.slice();
  const before = totals.slice(); totals = totals.map((t, s) => t + add[s]); handNo++;
  for (let s = 0; s < 4; s++) T.score(s, totals[s]);
  const over = Math.max(...totals) >= 100;
  if (shooter >= 0) { ui.pop(shooter === 0 ? 'YOU SHOT THE MOON!' : `${NAMES[shooter]} shot the moon`, '#ffc9a8', 30, 30); if (shooter === 0) { fx.confetti(90); arp([72, 76, 79, 84, 88], 80, 0.12); } }
  const order = [0, 1, 2, 3].sort((a, b) => totals[a] - totals[b]);
  const rows = order.map(s => `<tr class="${s === 0 ? 'me' : ''}"><td><span class="dot" style="background:${COLORS[s]}"></span>${NAMES[s]}</td><td>${add[s] ? '+' + add[s] : '0'}</td><td><b>${totals[s]}</b></td></tr>`).join('');
  const title = shooter >= 0 ? (shooter === 0 ? 'Moon shot! 🌙' : `${NAMES[shooter]} shot the moon`) : `Hand ${handNo}`;
  const line = shooter >= 0 ? 'All 26 points: everyone else takes 26.' : (over ? 'Someone reached 100: the game is over.' : `${100 - Math.max(...totals)} to go before someone reaches 100.`);
  setTimeout(() => {
    T.sheet(`<h2>${title}</h2><p>${line}</p><table><tr><th></th><th>hand</th><th>total</th></tr>${rows}</table><button class="hc-btn">${over ? 'See result' : 'Next hand'}</button>`, () => over ? gameOver() : newHand());
  }, wait(500, 30));
  void before;
}
function gameOver() {
  phase = 'over'; T.button(''); T.msg('');
  const mine = totals[0], best = Math.min(...totals), won = mine === best;
  const second = Math.min(...totals.filter((t, s) => s !== 0)), margin = second - mine;
  S.set('games', S.get('games', 0) + 1);
  if (!recorded) { recorded = true; if (!D.isDaily) F.level(won, Math.max(0, Math.min(1, 0.5 + (second - mine) / 100))); }
  if (won) {
    state = 'won'; level++; S.set('level', level);
    const wins = S.get('wins', 0) + 1; S.set('wins', wins);
    if (D.isDaily) { const k = 'daily_' + todayKey(), prev = S.get(k, null); if (!prev || margin > prev.m) S.set(k, { m: Math.max(0, margin) }); }
    B.submit(diff === 2 ? 2 : 1);   // world board: wins vs CPU today (Hard counts 2)
    D.won(Math.max(0, margin), 'won Hearts by');
    if (D.beaten(margin)) setTimeout(() => ui.pop('BEATEN!', '#fff', 40, 30), 300);
    fx.confetti(130, ['#ffc9a8', '#fff', '#c8466a', '#9fe3b0', '#ffd96a']); arp([67, 71, 74, 79, 83, 86, 91], 100, 0.12, 0.9); buzz([20, 60, 20]);
    ui.els.win.querySelector('h1').textContent = margin > 0 ? 'You win!' : 'Shared win!';
    ui.win(level - 1, `You ${mine} · ${[1, 2, 3].map(s => `${NAMES[s]} ${totals[s]}`).join(' · ')} · ${['Easy', 'Normal', 'Hard'][diff]}`);
  } else {
    state = 'lost';
    const w = [1, 2, 3].find(s => totals[s] === best);
    ui.lose(`${NAMES[w]} wins`, `You ${mine} · ${[1, 2, 3].map(s => `${NAMES[s]} ${totals[s]}`).join(' · ')}`);
  }
}

// ---------------------------------------------------------------- your taps
function tapCard(id) {
  if (state !== 'play') return;
  if (phase === 'pass') {
    if (!hands[0].includes(id)) return;
    if (passSel.has(id)) passSel.delete(id); else if (passSel.size < 3) passSel.add(id); else { T.els[id].classList.add('shake'); soft.err(); return; }
    soft.click(); showHand(); updatePassBtn(); return;
  }
  if (phase !== 'play' || turnSeat() !== 0 || busy || trick.length === 4) return;
  if (!hands[0].includes(id)) return;
  if (!legal(0).includes(id)) {
    const e = T.els[id]; e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); soft.err(); buzz(15);
    T.msg(trickNo === 0 && !trick.length ? 'The 2♣ leads the first trick' : !trick.length ? 'Hearts are not broken yet' : trickNo === 0 && !pts(id) ? `Follow ${T.SUITS[SUIT(trick[0].c)]}` : trick.length && hands[0].some(c => SUIT(c) === SUIT(trick[0].c)) ? `You must follow ${T.SUITS[SUIT(trick[0].c)]}` : 'No points on the first trick');
    return;
  }
  T.turn(-1); playCard(0, id);
}

// ---------------------------------------------------------------- computer players (they see only their own hand + the table)
function cpuPass(s, lvl = diff) {
  const h = hands[s];
  if (lvl === 0) return h.slice().sort((a, b) => VAL(b) - VAL(a)).slice(0, 3);
  const spades = h.filter(c => SUIT(c) === SP), lowSp = spades.filter(c => VAL(c) < 12).length;
  const count = (su) => h.filter(c => SUIT(c) === su).length;
  const keepQ = lvl === 2 && lowSp >= 4;   // a long spade guard can hold the queen safely
  const score = (c) => {
    const v = VAL(c), su = SUIT(c);
    if (c === QS) return keepQ ? 20 : 100;
    if (su === SP && v > 12) return keepQ ? 15 : 90 + v;
    if (su === SP) return v;
    if (su === HE) return v * 4 + (v > 10 ? 10 : 0);
    return v * 3 + (count(su) <= 2 ? 12 : 0) + (su === CL && h.includes(TWO_C) && c === TWO_C ? -20 : 0);
  };
  return h.slice().sort((a, b) => score(b) - score(a)).slice(0, 3);
}
function cpuChoose(s, lvl = diff) {
  const L = legal(s);
  if (L.length === 1) return L[0];
  const fk = D.isDaily ? 1 : F.k();
  const slip = [0.4, 0.06, 0.015][lvl] / fk;   // honest skill: how often a player of this level slips
  if (rand() < slip) return L[Math.floor(rand() * L.length)];
  return trick.length ? follow(s, L, lvl) : lead(s, L, lvl);
}
const outstanding = (s, su) => { const out = []; for (let r = 0; r < 13; r++) { const c = su * 13 + r; if (!played.has(c) && !hands[s].includes(c)) out.push(c); } return out; };
function lead(s, L, lvl) {
  const h = hands[s], qsOut = !played.has(QS) && !h.includes(QS);
  let best = L[0], bv = 1e9;
  for (const c of L) {
    const su = SUIT(c), v = VAL(c); let sc = v;
    if (c === QS) sc += 60;
    if (su === SP && v > 12 && !played.has(QS)) sc += 45;
    if (su === SP && v < 12 && qsOut) sc -= 4;            // smoke out the queen
    if (su === HE) sc += 5;
    if (lvl === 2) {
      const out = outstanding(s, su);
      if (out.length && out.every(o => VAL(o) > v)) sc -= 6;   // nobody can duck under this one
      if (!out.length) sc += 20;                               // we'd surely win our own lead
      if ([1, 2, 3].some(k => k !== s && voids[(s + k) % 4][su])) sc += 4;
    }
    sc += h.filter(x => SUIT(x) === su).length * 0.3;
    if (sc < bv) { bv = sc; best = c; }
  }
  return best;
}
function follow(s, L, lvl) {
  const led = SUIT(trick[0].c), last = trick.length === 3, p = trick.reduce((a, t) => a + pts(t.c), 0);
  let win = trick[0]; for (const t of trick) if (SUIT(t.c) === led && VAL(t.c) > VAL(win.c)) win = t;
  const hi = (arr) => arr.reduce((a, b) => (VAL(b) > VAL(a) ? b : a)), lo = (arr) => arr.reduce((a, b) => (VAL(b) < VAL(a) ? b : a));
  // hard players defend against a moon: if one rival holds every point so far, take a point trick from them
  const threat = lvl === 2 ? [0, 1, 2, 3].find(k => k !== s && taken[k] >= 10 && taken.reduce((a, b) => a + b, 0) === taken[k]) : undefined;
  if (SUIT(L[0]) === led) {
    if (led === SP && L.includes(QS) && trick.some(t => t.c === win.c && VAL(t.c) > 12)) return QS;
    const below = L.filter(c => VAL(c) < VAL(win.c));
    if (threat !== undefined && win.s === threat && p > 0) { const over = L.filter(c => VAL(c) > VAL(win.c) && c !== QS); if (over.length) return lo(over); }
    if (last && p === 0) { const safe = L.filter(c => c !== QS); return hi(safe.length ? safe : L); }
    if (below.length) { const nb = below.filter(c => !(led === SP && c === QS && !trick.some(t => VAL(t.c) > 12))); return hi(nb.length ? nb : below); }
    const safe = L.filter(c => c !== QS && !(led === SP && VAL(c) > 12 && !played.has(QS)));
    if (lvl === 2 && !last) return lo(safe.length ? safe : L);
    return led === HE || trickNo > 6 ? lo(safe.length ? safe : L) : hi(safe.length ? safe : L);
  }
  // can't follow: unload
  if (threat !== undefined && win.s === threat) { const nh = L.filter(c => !pts(c)); if (nh.length) return hi(nh); }
  if (L.includes(QS)) return QS;
  const bigSp = L.filter(c => SUIT(c) === SP && VAL(c) > 12); if (bigSp.length && !played.has(QS)) return hi(bigSp);
  const hearts = L.filter(c => SUIT(c) === HE); if (hearts.length) return hi(hearts);
  const cnt = (su) => hands[s].filter(c => SUIT(c) === su).length;
  return L.reduce((a, b) => (VAL(b) * 2 - cnt(SUIT(b)) > VAL(a) * 2 - cnt(SUIT(a)) ? b : a));
}

// ---------------------------------------------------------------- start / end cards
ui.onTap((which) => {
  if ((which === 'win' || which === 'lose') && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  state = 'play'; newGame();
});
T.layout(); paintDeco();
T.info('');
for (let s = 0; s < 4; s++) T.score(s, 0);
for (let s = 1; s < 4; s++) T.fan(s, 13);

// ---------------------------------------------------------------- test hook: the bot plays your seat like a careful normal player
let lastBot = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return tricksTotal; },
  bot() {
    lastBot = performance.now();
    if (state !== 'play') return;
    if (T.sheetOpen) return T.closeSheet();
    if (phase === 'pass' && !passSel.size) { cpuPass(0, 1).forEach(c => passSel.add(c)); showHand(); updatePassBtn(); return; }
    if (phase === 'pass' && passSel.size === 3) return doPass();
    if (phase === 'play' && turnSeat() === 0 && !busy && trick.length < 4 && hands[0].length) {
      const L = legal(0); const c = L.length === 1 ? L[0] : trick.length ? follow(0, L, 1) : lead(0, L, 1);
      tapCard(c);
    }
  },
};

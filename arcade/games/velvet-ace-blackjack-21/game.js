// Velvet Ace: Blackjack 21 — honest free-play blackjack. 6-deck crypto-shuffled shoe, dealer stands on soft 17, 3:2.
// No flow / adaptive difficulty: the cards are the cards. Progress = tables (reach the chip goal, next table has higher stakes).
import { THREE, createStage, createUI, loop, store, confetti, buzz } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import * as C from './casino.js';

const NAME = 'Velvet Ace: Blackjack 21';
C.installCSS();
const stage = createStage({ fov: 38, shadowSize: 5 });
const { scene, camera, sun } = stage;
C.studio(stage);
const ui = createUI({ title: 'VELVET<br>ACE', hint: 'Tap to take a seat', hand: '', progress: true, score: true });
const D = daily('velvetace', ui, { name: NAME });
C.startExtras(ui, 'Blackjack 21 · 6-deck shoe · blackjack pays 3:2');
ui.els.win.querySelector('p').innerHTML = 'TABLE <span data-l>1</span>';
const S = store('velvetace');
const msg = C.message(); document.body.style.setProperty('--msg-top', '57%');

// ---------------------------------------------------------------- tables (stakes ladder)
const UNITS = [25, 100, 500, 1000, 5000, 25000];
const FELTS = [['#23885c', '#0b3b27'], ['#1f6a9a', '#0a2a40'], ['#8a2440', '#36091a'], ['#3a3646', '#121019'], ['#6a3596', '#220c38']];
function tableCfg(n) {
  const u = n <= UNITS.length ? UNITS[n - 1] : 25000 * Math.pow(2, n - UNITS.length), start = u * 40;
  const mult = [1.5, 1.6, 1.7, 1.8, 1.9][n - 1] || 2;
  return { n, u, min: u, max: u * 20, start, target: Math.round(start * mult / u) * u, felt: FELTS[(n - 1) % FELTS.length] };
}
let tableN = Math.max(1, S.get('table', 1)), T = tableCfg(tableN), chips = T.start, best = S.get('best', 0);

// ---------------------------------------------------------------- world
const W = 8, H = 11, TX = 1024, TY = 1408;
const FZ = 2.0, toC = (x, z) => [(x + W / 2) / W * TX, (z - FZ + H / 2) / H * TY];
const DEALER_Z = -1.4, PLAYER_Z = 0.9, BET_Z = 2.2, CS = 1.22, SHOE = new THREE.Vector3(1.85, 0.32, -2.3), DISCARD = new THREE.Vector3(-1.85, 0.1, -2.3);
let felt;
function buildFelt() {
  if (felt) { scene.remove(felt); felt.material.map.dispose(); felt.material.dispose(); }
  const [c1, c2] = T.felt;
  const tex = C.feltTexture(TX, TY, c1, c2, (x) => {
    const [cx, cy] = toC(0, -3.4);
    C.arcText(x, 'BLACKJACK PAYS 3 TO 2', cx, cy, 452, 34);
    C.arcText(x, 'DEALER STANDS ON ALL 17s', cx, cy, 380, 22, 'rgba(255,255,255,.5)');
    x.strokeStyle = 'rgba(244,206,120,.5)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 498, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    x.beginPath(); x.arc(cx, cy, 508, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    const [bx, by] = toC(0, BET_Z);
    x.lineWidth = 5; x.strokeStyle = 'rgba(244,206,120,.8)'; x.beginPath(); x.arc(bx, by, 62, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(bx, by, 52, 0, Math.PI * 2); x.stroke();
    const [sx, sy] = toC(DISCARD.x, DISCARD.z); x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 3; C.rr(x, sx - 52, sy - 70, 104, 140, 12); x.stroke();
  });
  felt = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
  felt.rotation.x = -Math.PI / 2; felt.position.z = FZ; felt.receiveShadow = true; scene.add(felt);
}
// rail with the dealer's chip float
const railMat = new THREE.MeshPhysicalMaterial({ color: '#3a1d14', roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.3 });
const wood = new THREE.MeshPhysicalMaterial({ color: '#4a2716', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 });
const rail = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 9, 8, 20), railMat); rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.22, -3.5); rail.castShadow = true; scene.add(rail);
const tray = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.62), wood); tray.position.set(0, 0.06, -2.85); tray.receiveShadow = true; scene.add(tray);
let rack;
function buildRack() {
  if (rack) scene.remove(rack);
  const vals = [100000, 25000, 5000, 1000, 500, 100, 25, 5].filter(v => v <= T.max * 2).slice(0, 7).reverse();
  rack = C.chipRack(vals.map((v, i) => ({ v, n: 9, x: (i - (vals.length - 1) / 2) * 0.43, z: 0 })));
  rack.position.set(0, 0.12, -2.85); rack.rotation.x = 0; scene.add(rack);
  rack.children.forEach(im => { im.rotation.x = 0; });
}
// card shoe
const shoe = new THREE.Group();
{ const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 1.25), new THREE.MeshPhysicalMaterial({ color: '#1b1a22', roughness: 0.3, clearcoat: 1 }));
  body.castShadow = true; shoe.add(body);
  const deckBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.9), new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.6 })); deckBox.position.set(0, 0.1, 0.12); deckBox.rotation.x = -0.35; shoe.add(deckBox);
  const backTop = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.9), new THREE.MeshStandardMaterial({ map: C.backTex('#8c1c2c', 'V'), alphaTest: .5 })); backTop.rotation.x = -Math.PI / 2 - 0.35; backTop.position.set(0, 0.29, 0.06); shoe.add(backTop);
  shoe.position.copy(SHOE).setY(0.25); shoe.rotation.y = -0.35; scene.add(shoe); }
const discardPile = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.01, 0.92), new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: .7 }));
discardPile.position.copy(DISCARD).setY(0.005); discardPile.visible = false; discardPile.castShadow = true; scene.add(discardPile);

// camera: player's seat looking across the felt to the dealer
function placeCam() {
  const a = innerWidth / innerHeight, back = a < 0.6 ? 1.0 : a < 0.8 ? 0.6 : 0;
  camera.position.set(0, 7.3 + back * 1.3, 5.0 + back * 0.9); camera.lookAt(0, 0, -0.12 + back * 0.1);
}
addEventListener('resize', placeCam); placeCam();
sun.position.set(2.5, 12, 5); sun.target.position.set(0, 0, 0);
const spot = new THREE.PointLight('#ffd9a8', 5, 14, 1.6); spot.position.set(0, 6, 0.2); scene.add(spot);

// ---------------------------------------------------------------- shoe of cards
const DECKS = 6, CUT = Math.round(DECKS * 52 * 0.25);
let shoeCards = [];
function newShoe() { shoeCards = C.shuffle(C.makeDeck(DECKS)); discardPile.visible = false; discardPile.scale.y = 1; }
newShoe();
const draw = () => shoeCards.pop();

// ---------------------------------------------------------------- blackjack logic
const val = c => c.r === 14 ? 11 : Math.min(10, c.r);
function total(cards) { let t = 0, aces = 0; for (const c of cards) { t += val(c); if (c.r === 14) aces++; } while (t > 21 && aces) { t -= 10; aces--; } return { t, soft: aces > 0 }; }
const isBJ = cards => cards.length === 2 && total(cards).t === 21;

// basic strategy for 6 decks, S17, DAS, no surrender. returns 'H','S','D','P'
function basic(hand, up, canDouble, canSplit) {
  const u = val(up), { t, soft } = total(hand.cards), c = hand.cards;
  if (canSplit && c.length === 2 && val(c[0]) === val(c[1])) {
    const p = val(c[0]);
    if (p === 11 || p === 8) return 'P';
    if (p === 9 && ![7, 10, 11].includes(u)) return 'P';
    if ((p === 7 || p === 3 || p === 2) && u <= 7) return 'P';
    if (p === 6 && u <= 6) return 'P';
    if (p === 4 && (u === 5 || u === 6)) return 'P';
  }
  const D_ = (cond, alt = 'H') => cond ? (canDouble ? 'D' : alt) : null;
  if (soft) {
    if (t >= 20) return 'S';
    if (t === 19) return D_(u === 6, 'S') || 'S';
    if (t === 18) return D_(u <= 6, 'S') || (u <= 8 ? 'S' : 'H');
    if (t === 17) return D_(u >= 3 && u <= 6) || 'H';
    if (t >= 15) return D_(u >= 4 && u <= 6) || 'H';
    return D_(u >= 5 && u <= 6) || 'H';
  }
  if (t >= 17) return 'S';
  if (t >= 13) return u <= 6 ? 'S' : 'H';
  if (t === 12) return u >= 4 && u <= 6 ? 'S' : 'H';
  if (t === 11) return D_(u !== 11) || 'H';
  if (t === 10) return D_(u <= 9) || 'H';
  if (t === 9) return D_(u >= 3 && u <= 6) || 'H';
  return 'H';
}

// ---------------------------------------------------------------- round state
const B = worldBoard({ game: 'velvet-ace', label: 'Tables cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: 1 point per table cleared today
let state = 'ready', phase = 'idle', bet = 0, lastBet = 0, hands = [], active = 0, dealer = { cards: [], meshes: [] }, beatenShown = false, botOn = false;
const dLabel = C.label(); dLabel.position.set(0, 0.5, DEALER_Z + 0.82); scene.add(dLabel);
let betStack = null; const betLabel = C.label(0.8, 0.3); betLabel.position.set(0, 0.55, BET_Z + 0.55); scene.add(betLabel);
const handX = (i, n) => (i - (n - 1) / 2) * (n > 2 ? 0.92 : 1.45);
const glow = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.74, 48), new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.7 }));
glow.rotation.x = -Math.PI / 2; glow.position.y = 0.004; glow.visible = false; scene.add(glow);

function cardSlot(hand, j, n, z, x0) {
  const k = hands.length > 2 && hand !== dealer ? 0.72 : 1, step = 0.33 * k, x = x0 + (j - (n - 1) / 2) * step;
  return new THREE.Vector3(x, 0.012 + j * 0.006, z - j * 0.06 * k);
}
async function dealCard(target, faceUp = true, { sideways = false, dur = 0.42 } = {}) {
  const card = draw(), m = C.cardMesh(card, '#8c1c2c', 'V'); m.scale.setScalar(target !== dealer && hands.length > 2 ? CS * 0.72 : CS);
  m.position.copy(SHOE).setY(0.55); m.rotation.set(0, -0.35, Math.PI); scene.add(m);
  target.cards.push(card); target.meshes.push(m);
  const isDealer = target === dealer, n = target.cards.length;
  const z = isDealer ? DEALER_Z : PLAYER_Z, x0 = isDealer ? 0 : target.x;
  // slide earlier cards to keep the hand centred
  target.meshes.forEach((mm, j) => { if (mm !== m) C.fly(mm, cardSlot(target, j, n, z, x0), { dur: 0.2, lift: 0 }); });
  C.csfx.card();
  await C.fly(m, cardSlot(target, n - 1, n, z, x0), { dur, lift: 0.6, rot: { x: 0, y: sideways ? Math.PI / 2 : (((n * 7) % 5) - 2) * 0.02, z: faceUp ? 0 : Math.PI } });
  m.position.y = 0.012 + (n - 1) * 0.006;
  return card;
}
function showTotals() {
  hands.forEach(hd => {
    const { t, soft } = total(hd.cards);
    if (!hd.cards.length) return hd.label.set('');
    if (isBJ(hd.cards) && hands.length === 1) hd.label.set('BLACKJACK', '#e3a62a');
    else if (t > 21) hd.label.set('BUST ' + t, '#c8243a');
    else hd.label.set(soft && t < 21 ? `${t - 10} / ${t}` : String(t), hd === hands[active] && phase === 'act' ? 'rgba(227,166,42,.95)' : 'rgba(16,14,20,.82)');
  });
  const vis = dealer.cards.filter((c, i) => Math.abs(dealer.meshes[i].rotation.z) < 0.1);
  if (!vis.length) return dLabel.set('');
  const dt = total(vis); dLabel.set(dt.t > 21 ? 'BUST ' + dt.t : isBJ(vis) && vis.length === dealer.cards.length ? 'BLACKJACK' : (dt.soft && dt.t < 21 ? `${dt.t - 10} / ${dt.t}` : String(dt.t)), dt.t > 21 ? '#c8243a' : 'rgba(16,14,20,.82)');
}

// ---------------------------------------------------------------- HUD + controls
function hud() {
  ui.score(C.fmt(chips)); ui.levels(tableN); ui.progress(chips / T.target);
  ui.sub(`Table ${tableN} · goal ${C.fmt(T.target)} · bets ${C.fmt(T.min)}–${C.fmt(T.max)}`);
  if (D.beaten(chips) && !beatenShown && state === 'play') { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 48, 30); confetti(scene, new THREE.Vector3(0, 1, 1), 60); }
}
const chipVals = () => [1, 5, 25, 100, 500, 1000, 5000, 25000, 100000].filter(v => v >= T.min && v <= T.max).slice(0, 4);
const chipsBar = C.chipBar(chipVals(), v => addBet(v));
const betBar = C.bar([{ id: 'clear', text: 'Clear', cls: 'dark', on: () => clearBet() }, { id: 'deal', text: 'Deal', cls: 'green', on: () => startRound() }]);
const actBar = C.bar([
  { id: 'hit', text: 'Hit', cls: 'green', on: () => act('H') }, { id: 'stand', text: 'Stand', cls: 'red', on: () => act('S') },
  { id: 'double', text: 'Double', cls: '', on: () => act('D') }, { id: 'split', text: 'Split', cls: 'blue', on: () => act('P') }]);
const odds = C.oddsPanel(`<h2>House rules & odds</h2>
<p>Real blackjack rules, real odds. Every shuffle uses your browser's cryptographic random generator, the same for every player, every hand. Nothing adapts to you.</p>
<h3>Rules</h3><table>
<tr><td>Shoe</td><td>6 decks, reshuffled at 75%</td></tr><tr><td>Dealer</td><td>stands on all 17s (soft 17 too)</td></tr>
<tr><td>Dealer peeks</td><td>with an Ace or 10 up</td></tr><tr><td>Double</td><td>any first two cards, also after a split</td></tr>
<tr><td>Split</td><td>pairs, up to 4 hands; split Aces get one card</td></tr><tr><td>Not offered</td><td>insurance, surrender</td></tr></table>
<h3>Payouts</h3><table><tr><td>Blackjack</td><td>3 to 2</td></tr><tr><td>Win</td><td>1 to 1</td></tr><tr><td>Push</td><td>bet returned</td></tr></table>
<div class="edge">House edge ≈ 0.4% with perfect basic strategy (about 4 chips lost per 1,000 bet, on average, over the long run).</div>
<p>Free play only: chips have no cash value and can't be bought.</p>`);
odds.btn.classList.add('hc-hidden');

function setBetVisual() {
  if (betStack) { scene.remove(betStack); betStack = null; }
  if (bet > 0) { betStack = C.chipStack(bet); betStack.position.set(0, 0.002, BET_Z); scene.add(betStack); betLabel.set(C.fmt(bet), 'rgba(16,14,20,.78)'); }
  else betLabel.set('');
  betBar.text('deal', 'Deal', bet ? C.fmt(bet) : 'place a bet'); betBar.enable('deal', bet >= T.min && bet <= chips); betBar.enable('clear', bet > 0);
  chipsBar.limit(Math.min(T.max - bet, chips - bet));
}
function addBet(v) {
  if (phase !== 'bet' || bet + v > T.max || bet + v > chips) return;
  bet += v; C.csfx.chip(1); buzz(8);
  setBetVisual();
  const top = betStack.children[betStack.children.length - 1]; if (top) { const y = top.position.y; top.position.y += 0.6; C.tween(0.18, k => { top.position.y = y + 0.6 * (1 - k); }, C.ease.out); }
}
function clearBet() { if (phase !== 'bet') return; bet = 0; C.csfx.chip(2); setBetVisual(); }
function enterBet() {
  phase = 'bet'; actBar.show(false); betBar.show(true); chipsBar.show(true); odds.btn.classList.remove('hc-hidden');
  chipsBar.set(chipVals()); chipsBar.select(-1);
  bet = lastBet && lastBet <= Math.min(chips, T.max) ? lastBet : Math.min(T.min, chips);
  setBetVisual(); msg('Place your bet', 900);
}
function updateActs() {
  const hd = hands[active]; if (!hd) return;
  const two = hd.cards.length === 2 && !hd.aceSplit;
  actBar.enable('double', two && chips >= hd.bet);
  actBar.enable('split', two && hands.length < 4 && val(hd.cards[0]) === val(hd.cards[1]) && chips >= hd.bet);
  actBar.enable('hit', true); actBar.enable('stand', true);
}

// ---------------------------------------------------------------- the round
async function startRound() {
  if (phase !== 'bet' || bet < T.min || bet > chips) return;
  phase = 'busy'; betBar.show(false); chipsBar.show(false); odds.btn.classList.add('hc-hidden');
  lastBet = bet; chips -= bet; hud();
  if (shoeCards.length < CUT) { msg('Shuffling the shoe…', 1000); C.csfx.flip(); await C.wait(0.9); newShoe(); }
  const hd = { cards: [], meshes: [], bet, x: 0, stack: betStack, label: C.label(), done: false };
  hd.label.position.set(0, 0.55, PLAYER_Z - 0.82); scene.add(hd.label);
  betStack = null; betLabel.set('');
  hd.stackLabel = C.label(0.7, 0.26); hd.stackLabel.position.set(0, 0.5, BET_Z + 0.5); hd.stackLabel.set(C.fmt(hd.bet)); scene.add(hd.stackLabel);
  hands = [hd]; active = 0; dealer = { cards: [], meshes: [] };
  await dealCard(hd); await dealCard(dealer); await dealCard(hd); showTotals(); await dealCard(dealer, false); showTotals();
  const up = dealer.cards[0];
  if (val(up) >= 10) {   // peek
    msg('Dealer checks…', 700); await peekWiggle();
    if (isBJ(dealer.cards)) { await revealHole(); return settle(); }
  }
  if (isBJ(hd.cards)) { hd.done = true; ui.pop('BLACKJACK!', '#ffd23f', 46, 34); C.csfx.big(); buzz([20, 40, 20]); await revealHole(); return settle(); }
  phase = 'act'; focusHand(); showTotals();
}
async function peekWiggle() { const m = dealer.meshes[1], z = m.position.z; await C.tween(0.35, k => { m.rotation.x = Math.sin(k * Math.PI) * 0.18; m.position.z = z - Math.sin(k * Math.PI) * 0.05; }); m.rotation.x = 0; }
function focusHand() {
  const hd = hands[active]; glow.visible = hands.length > 1; glow.position.x = hd.x; glow.position.z = PLAYER_Z;
  actBar.show(true); updateActs(); showTotals();
}
async function act(a) {
  if (phase !== 'act') return; const hd = hands[active]; if (!hd) return;
  if (a === 'D' && (hd.cards.length !== 2 || chips < hd.bet || hd.aceSplit)) return;
  if (a === 'P' && (hd.cards.length !== 2 || hands.length >= 4 || val(hd.cards[0]) !== val(hd.cards[1]) || chips < hd.bet)) return;
  phase = 'busy'; actBar.show(false);
  if (a === 'H') { await dealCard(hd); showTotals(); const t = total(hd.cards).t; if (t > 21) { C.csfx.lose(); buzz(30); await shake(hd); return nextHand(); } if (t === 21) return nextHand(); }
  else if (a === 'S') return nextHand();
  else if (a === 'D') {
    chips -= hd.bet; hd.bet *= 2; hud(); await growStack(hd); await dealCard(hd, true, { sideways: true }); showTotals();
    if (total(hd.cards).t > 21) { C.csfx.lose(); await shake(hd); } return nextHand();
  } else if (a === 'P') { await split(hd); return; }
  phase = 'act'; focusHand();
}
async function growStack(hd) {
  const extra = C.chipStack(hd.bet / 2); extra.position.set(hd.x + 0.5, 0.002, BET_Z + 0.9); scene.add(extra); C.csfx.chip(3);
  await C.fly(extra, new THREE.Vector3(hd.x + 0.42, 0.002, BET_Z), { dur: 0.3, lift: 0.2 });
  hd.stack.add(...extra.children.map(c => { c.position.x += 0.42; return c; })); scene.remove(extra);
  hd.stackLabel.set(C.fmt(hd.bet));
}
async function split(hd) {
  chips -= hd.bet; hud();
  const nh = { cards: [hd.cards.pop()], meshes: [hd.meshes.pop()], bet: hd.bet, label: C.label(), stack: C.chipStack(hd.bet), done: false, stackLabel: C.label(0.7, 0.26) };
  nh.stack.position.copy(hd.stack.position); scene.add(nh.label, nh.stack, nh.stackLabel);
  hands.splice(active + 1, 0, nh);
  const aces = hd.cards[0].r === 14; hd.aceSplit = nh.aceSplit = aces;
  C.csfx.chip(3); await relayout();
  await dealCard(hd); showTotals();
  if (aces) { await C.wait(0.15); active++; await dealCard(nh); showTotals(); hd.done = nh.done = true; active = hands.length; return dealerTurn(); }
  if (total(hd.cards).t === 21) return nextHand();
  phase = 'act'; focusHand();
}
async function relayout() {
  const n = hands.length, ps = [];
  hands.forEach((hd, i) => {
    hd.x = handX(i, n); hd.label.position.set(hd.x, 0.55, PLAYER_Z - 0.82);
    hd.meshes.forEach((m, j) => m.scale.setScalar(n > 2 ? CS * 0.72 : CS));
    hd.meshes.forEach((m, j) => ps.push(C.fly(m, cardSlot(hd, j, hd.cards.length, PLAYER_Z, hd.x), { dur: 0.3, lift: 0.1 })));
    if (!hd.stack.parent) scene.add(hd.stack);
    ps.push(C.fly(hd.stack, new THREE.Vector3(hd.x, 0.002, BET_Z), { dur: 0.3, lift: 0.1 }));
    hd.stackLabel.position.set(hd.x, 0.5, BET_Z + 0.5); hd.stackLabel.set(C.fmt(hd.bet));
  });
  await Promise.all(ps);
}
async function shake(hd) { const ms = hd.meshes, xs = ms.map(m => m.position.x); await C.tween(0.3, k => ms.forEach((m, i) => { m.position.x = xs[i] + Math.sin(k * 40) * 0.04 * (1 - k); })); }
async function nextHand() {
  if (hands.length > 1 && active < hands.length - 1) {
    active++; const hd = hands[active];
    if (hd.cards.length < 2) await dealCard(hd);
    showTotals();
    if (total(hd.cards).t === 21) return nextHand();
    phase = 'act'; focusHand(); return;
  }
  active = hands.length; glow.visible = false; return dealerTurn();
}
async function revealHole() {
  const m = dealer.meshes[1]; C.csfx.flip();
  await C.tween(0.38, k => { m.rotation.z = Math.PI * (1 - k); m.position.y = 0.02 + Math.sin(k * Math.PI) * 0.35; }, C.ease.inOut);
  m.rotation.z = 0; m.position.y = 0.018; showTotals();
}
async function dealerTurn() {
  phase = 'busy'; actBar.show(false); showTotals();
  await revealHole(); await C.wait(0.25);
  const live = hands.some(hd => total(hd.cards).t <= 21);
  if (live) while (total(dealer.cards).t < 17) { await C.wait(0.2); await dealCard(dealer); showTotals(); }
  if (total(dealer.cards).t > 21) { msg('Dealer busts!', 1000, '#ffe08a'); C.csfx.win(); }
  await C.wait(0.3);
  settle();
}
const RACK = new THREE.Vector3(0, 0.3, -2.85), PLAYER_OUT = new THREE.Vector3(0, 0.3, 5.0);
async function settle() {
  phase = 'busy'; actBar.show(false);
  const d = total(dealer.cards).t, dBJ = isBJ(dealer.cards), anims = [];
  let net = 0;
  for (const hd of hands) {
    const p = total(hd.cards).t, pBJ = isBJ(hd.cards) && hands.length === 1;
    let pay = 0, res;   // pay = amount returned to player incl. stake
    if (p > 21) res = 'lose';
    else if (pBJ && dBJ) { res = 'push'; pay = hd.bet; }
    else if (pBJ) { res = 'bj'; pay = hd.bet + hd.bet * 1.5; }
    else if (dBJ) res = 'lose';
    else if (d > 21 || p > d) { res = 'win'; pay = hd.bet * 2; }
    else if (p === d) { res = 'push'; pay = hd.bet; }
    else res = 'lose';
    net += pay - hd.bet;
    hd.label.set(res === 'lose' ? (p > 21 ? 'BUST' : 'LOSE') : res === 'push' ? 'PUSH' : res === 'bj' ? '+' + C.fmt(pay - hd.bet) : 'WIN +' + C.fmt(pay - hd.bet),
      res === 'lose' ? '#c8243a' : res === 'push' ? 'rgba(60,60,80,.9)' : '#1d9a5b');
    anims.push(payOut(hd, res, pay));
    chips += pay;
  }
  await Promise.all(anims);
  if (net > 0) { C.csfx.win(); buzz(25); confetti(scene, new THREE.Vector3(0, 0.6, PLAYER_Z), 26); ui.pop('+' + C.fmt(net), '#ffe08a', 40, 36); }
  else if (net < 0) C.csfx.lose(); else C.csfx.push();
  hud();
  best = Math.max(best, chips); S.set('best', best);
  await C.wait(0.75);
  await clearTable();
  if (chips >= T.target) return tableWon();
  if (chips < T.min) return tableLost();
  enterBet();
}
async function payOut(hd, res, pay) {
  if (res === 'lose') { C.csfx.chip(2); await C.fly(hd.stack, RACK, { dur: 0.5, lift: 0.5 }); scene.remove(hd.stack); hd.stackLabel.set(''); return; }
  if (res !== 'push') {
    const win = C.chipStack(pay - hd.bet); win.position.copy(RACK); scene.add(win);
    await C.fly(win, new THREE.Vector3(hd.x + 0.45, 0.002, BET_Z), { dur: 0.45, lift: 0.5 }); C.csfx.chip(4);
    hd.stackLabel.set(C.fmt(pay), '#1d9a5b'); await C.wait(0.35);
    C.fly(win, PLAYER_OUT, { dur: 0.45, lift: 0.3 }).then(() => scene.remove(win));
  }
  await C.fly(hd.stack, PLAYER_OUT, { dur: 0.45, lift: 0.3 }); scene.remove(hd.stack); hd.stackLabel.set('');
}
async function clearTable() {
  const all = [...dealer.meshes, ...hands.flatMap(h => h.meshes)];
  hands.forEach(hd => { hd.label.set(''); scene.remove(hd.label, hd.stackLabel); }); dLabel.set('');
  if (all.length) C.csfx.card();
  await Promise.all(all.map((m, i) => C.wait(i * 0.03).then(() => C.fly(m, new THREE.Vector3(DISCARD.x, 0.05, DISCARD.z), { dur: 0.35, lift: 0.3, rot: { x: 0, y: 0, z: Math.PI } }))));
  all.forEach(m => { scene.remove(m); m.dispose(); });
  const used = DECKS * 52 - shoeCards.length; discardPile.visible = used > 0; discardPile.scale.y = 1 + used * 0.25; discardPile.position.y = discardPile.scale.y * 0.005;
  hands = []; dealer = { cards: [], meshes: [] };
}
function tableWon() {
  state = 'won'; phase = 'idle'; B.submit(1); betBar.show(false); chipsBar.show(false); odds.btn.classList.add('hc-hidden');
  C.csfx.big(); buzz([30, 50, 30]); confetti(scene, new THREE.Vector3(0, 1, 0.5), 90); ui.flash(0.4);
  D.won(chips, 'cashed out');
  S.set('table', tableN + 1);
  ui.win(tableN, `${C.fmt(chips)} chips · next: Table ${tableN + 1}, bets up to ${C.fmt(tableCfg(tableN + 1).max)}`);
}
function tableLost() {
  state = 'lost'; phase = 'idle'; betBar.show(false); chipsBar.show(false); odds.btn.classList.add('hc-hidden');
  ui.lose('OUT OF CHIPS', `Retry refills your ${C.fmt(T.start)} free chips`);
}
function setupTable(n) {
  tableN = n; T = tableCfg(n); chips = T.start; lastBet = 0; beatenShown = false;
  C.backdrop(T.felt[0] + '', '#06080a'); C.backdrop(shade(T.felt[1], 0.9), '#040506');
  buildFelt(); buildRack(); hud();
}
function shade(hex, k) { const c = new THREE.Color(hex).multiplyScalar(k); return '#' + c.getHexString(); }

ui.onTap(which => {
  B.start();
  if (which === 'start') { state = 'play'; enterBet(); }
  else if (which === 'win') { setupTable(tableN + 1); state = 'play'; enterBet(); }
  else if (which === 'lose') { setupTable(tableN); state = 'play'; enterBet(); }
});
setupTable(tableN);
odds.btn.classList.remove('hc-hidden');
ui.start();

let tPrev = performance.now();
loop((dt, t) => {
  const now = performance.now(); C.updateTweens(Math.min(0.05, (now - tPrev) / 1000)); tPrev = now;
  glow.material.opacity = 0.45 + Math.sin(t * 5) * 0.25;
});

// ---------------------------------------------------------------- test hook: bold play to the goal + basic strategy
window.__game = {
  get state() { return state; }, get level() { return tableN; }, get score() { return chips; },
  bot() {
    if (!botOn) { botOn = true; C.setSpeed(1.6); }
    if (state !== 'play') return;
    if (phase === 'bet') {
      const need = T.target - chips, want = Math.max(T.min, Math.min(T.max, chips, Math.ceil(need / T.min) * T.min));
      if (bet !== want) { bet = 0; const vals = chipVals().slice().reverse(); let left = want; for (const v of vals) while (left >= v) { bet += v; left -= v; } setBetVisual(); return; }
      startRound();
    } else if (phase === 'act') {
      const hd = hands[active]; const a = basic(hd, dealer.cards[0], hd.cards.length === 2 && !hd.aceSplit && chips >= hd.bet, hands.length < 4 && chips >= hd.bet);
      act(a);
    }
  },
};

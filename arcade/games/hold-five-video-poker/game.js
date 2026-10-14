// Hold Five: Video Poker — Jacks or Better, full-pay 9/6 table (99.54% return with perfect play). Free play only.
// Fresh crypto-shuffled 52-card deck every hand; the draw comes from the same deck, in order. No flow: the odds never adapt.
import { THREE, createStage, createUI, loop, store, confetti, buzz } from './kit/hc.js';
import { daily } from './kit/daily.js';
import * as C from './casino.js';

const NAME = 'Hold Five: Video Poker';
C.installCSS();
const stage = createStage({ fov: 40, shadowSize: 4 });
const { scene, camera, renderer, sun } = stage;
C.studio(stage);
const ui = createUI({ title: 'HOLD<br>FIVE', hint: 'Tap to play', hand: '', progress: true, score: true });
const D = daily('holdfive', ui, { name: NAME });
C.startExtras(ui, 'Video Poker · Jacks or Better · full-pay 9/6');
ui.els.win.querySelector('p').innerHTML = 'TABLE <span data-l>1</span>';
const S = store('holdfive');
const msg = C.message();

// ---------------------------------------------------------------- paytable (per coin) — 9/6 Jacks or Better
const PAYS = [
  { k: 'RF', n: 'Royal Flush', p: [250, 500, 750, 1000, 4000] }, { k: 'SF', n: 'Straight Flush', p: 50 }, { k: '4K', n: 'Four of a Kind', p: 25 },
  { k: 'FH', n: 'Full House', p: 9 }, { k: 'FL', n: 'Flush', p: 6 }, { k: 'ST', n: 'Straight', p: 4 }, { k: '3K', n: 'Three of a Kind', p: 3 },
  { k: '2P', n: 'Two Pair', p: 2 }, { k: 'JB', n: 'Jacks or Better', p: 1 },
];
const payFor = (row, coins) => Array.isArray(row.p) ? row.p[coins - 1] : row.p * coins;
function classify(cards) {
  const v = C.evalHand(cards), cat = C.handCat(v), top = C.handKey(v, 0);
  if (cat === 8) return top === 14 ? 'RF' : 'SF';
  return ({ 7: '4K', 6: 'FH', 5: 'FL', 4: 'ST', 3: '3K', 2: '2P' })[cat] || (cat === 1 && top >= 11 ? 'JB' : null);
}

// ---------------------------------------------------------------- tables (stakes ladder)
const UNITS = [5, 25, 100, 500, 1000, 5000, 25000];
const FELTS = [['#22357e', '#0a1233'], ['#5a2486', '#1a0830'], ['#0f6e6a', '#032726'], ['#8a1f3c', '#2a0612'], ['#2c2c38', '#0b0b10']];
function tableCfg(n) {
  const u = n <= UNITS.length ? UNITS[n - 1] : 25000 * Math.pow(2, n - UNITS.length);
  const mult = [1.5, 1.6, 1.7, 1.8, 1.9][n - 1] || 2;
  return { n, u, start: u * 100, target: u * Math.round(100 * mult), felt: FELTS[(n - 1) % FELTS.length] };
}
let tableN = Math.max(1, S.get('table', 1)), T = tableCfg(tableN), chips = T.start, best = S.get('best', 0);

// ---------------------------------------------------------------- world
const CS = 1.3, GAP = 0.9, CARD_Z = 0;
let felt;
function buildFelt() {
  if (felt) { scene.remove(felt); felt.material.map.dispose(); felt.material.dispose(); }
  const tex = C.feltTexture(1024, 1024, T.felt[0], T.felt[1], (x, Wd, Hd) => {
    const P = 1024 / 12, X = v => 512 + v * P;
    C.goldText(x, 'HOLD FIVE', 512, X(2.2), 30, { track: 10, color: 'rgba(244,206,120,.6)' });
    C.goldText(x, 'JACKS OR BETTER · 9/6 FULL PAY', 512, X(2.55), 14, { track: 5, color: 'rgba(255,255,255,.38)' });
    x.strokeStyle = 'rgba(244,206,120,.3)'; x.lineWidth = 2; C.rr(x, X(-2.62), X(-1.26), 5.24 * P, 2.52 * P, 24); x.stroke();
  });
  felt = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
}
// gold frame around the play area
const frameMat = new THREE.MeshPhysicalMaterial({ color: '#d9a640', metalness: 0.85, roughness: 0.28, clearcoat: 0.6 });
const frame = new THREE.Group(); scene.add(frame);
{ const bar = (w, x, z, rotY = 0) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, w, 6, 12), frameMat); m.rotation.z = Math.PI / 2; m.rotation.y = rotY; m.position.set(x, 0.05, z); m.castShadow = true; frame.add(m); };
  bar(4.8, 0, -1.1); bar(4.8, 0, 1.1); bar(2.2, -2.45, 0, Math.PI / 2); bar(2.2, 2.45, 0, Math.PI / 2); }
// the deck (where cards come from / go back to)
const DECK = new THREE.Vector3(0, 0.6, -3.2);
function placeCam() {
  const a = innerWidth / innerHeight, tv = Math.tan(camera.fov * Math.PI / 360), dist = Math.max(5.2, 2.62 / (tv * a));
  camera.position.set(0, dist * 0.96, dist * 0.2 - 0.3); camera.lookAt(0, 0, a < 0.75 ? -0.75 : 0.3);
}
addEventListener('resize', () => setTimeout(placeCam)); setTimeout(placeCam);
sun.position.set(2, 12, 6);
const spot = new THREE.PointLight('#ffe2b8', 6, 14, 1.6); spot.position.set(0, 5, 1); scene.add(spot);

// ---------------------------------------------------------------- paytable DOM (lit machine glass)
const css = document.createElement('style'); css.textContent = `
.vp-pay{transition:opacity .3s;position:fixed;left:50%;transform:translateX(-50%);top:calc(126px + env(safe-area-inset-top));width:min(372px,94vw);z-index:5;pointer-events:none;
  background:linear-gradient(180deg,rgba(16,20,60,.92),rgba(8,10,34,.92));border:2px solid #d9a640;border-radius:14px;padding:5px 8px;box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 0 18px rgba(80,120,255,.25)}
.vp-pay table{width:100%;border-collapse:collapse;font:800 13.5px/1.16 'Baloo 2',system-ui;color:#ffd96a;text-shadow:0 1px 0 rgba(0,0,0,.5)}
.vp-pay td{padding:1px 3px;text-align:right}.vp-pay td:first-child{text-align:left;color:#fff;font-weight:700;white-space:nowrap}
.vp-pay td.col{background:rgba(255,64,96,.32)}.vp-pay tr.hit td{background:#ffd96a;color:#2a1a00}.vp-pay tr.hit td:first-child{color:#2a1a00}
.vp-pay tr.blink td{animation:vpb .3s steps(2) 6}@keyframes vpb{50%{background:#fff;color:#000}}
.vp-res{position:fixed;left:0;right:0;top:calc(316px + env(safe-area-inset-top));text-align:center;z-index:5;pointer-events:none;font:800 24px 'Baloo 2',system-ui;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.4)}
`; document.head.appendChild(css);
const payEl = C.h(`<div class="vp-pay"><table>${PAYS.map(r => `<tr data-k="${r.k}"><td>${r.n}</td>${[1, 2, 3, 4, 5].map(c => `<td data-c="${c}">${payFor(r, c)}</td>`).join('')}</tr>`).join('')}</table></div>`);
const resEl = C.h(`<div class="vp-res"></div>`);
document.body.append(payEl, resEl);
function payCol(coins) { payEl.querySelectorAll('td[data-c]').forEach(td => td.classList.toggle('col', +td.dataset.c === coins)); }
function payHit(k) { payEl.querySelectorAll('tr').forEach(tr => { tr.classList.toggle('hit', tr.dataset.k === k); tr.classList.remove('blink'); if (tr.dataset.k === k) { void tr.offsetWidth; tr.classList.add('blink'); } }); }

// ---------------------------------------------------------------- hand state
let state = 'ready', phase = 'idle', coins = 5, deck = [], hand = [], meshes = [], held = [false, false, false, false, false], beatenShown = false, botOn = false;
const heldLabels = [0, 1, 2, 3, 4].map(i => { const l = C.label(0.78, 0.29); l.position.set((i - 2) * GAP, 0.3, CARD_Z + 0.9); scene.add(l); return l; });
const slot = i => new THREE.Vector3((i - 2) * GAP, 0.012, CARD_Z);
// five face-down cards waiting on the felt
for (let i = 0; i < 5; i++) { const m = C.cardMesh(null, '#1f2f8a', 'H'); m.scale.setScalar(CS); m.position.copy(slot(i)); m.rotation.z = Math.PI; scene.add(m); meshes.push(m); }

const bars = C.bar([
  { id: 'one', text: 'Bet One', cls: 'dark', on: () => betOne() }, { id: 'max', text: 'Bet Max', cls: 'blue', on: () => betMax() },
  { id: 'go', text: 'Deal', cls: 'green', on: () => go() }]);
const odds = C.oddsPanel(`<h2>Paytable & odds</h2>
<p>Jacks or Better, the full-pay "9/6" machine. Every hand is a fresh 52-card deck shuffled with your browser's cryptographic random generator; replacement cards come off the top of that same deck. The machine never knows who you are or how you've been doing.</p>
<h3>Pays per coin</h3><table>${PAYS.map(r => `<tr><td>${r.n}</td><td>${Array.isArray(r.p) ? '250 (4,000 for 5 coins)' : r.p}</td></tr>`).join('')}</table>
<h3>How often (perfect play)</h3><table><tr><td>Royal flush</td><td>1 in 40,390</td></tr><tr><td>Straight flush</td><td>1 in 9,148</td></tr><tr><td>Four of a kind</td><td>1 in 423</td></tr>
<tr><td>Full house</td><td>1 in 87</td></tr><tr><td>Flush</td><td>1 in 91</td></tr><tr><td>Straight</td><td>1 in 89</td></tr><tr><td>Three of a kind</td><td>1 in 13</td></tr><tr><td>Two pair</td><td>1 in 8</td></tr><tr><td>Jacks or better</td><td>1 in 4.7</td></tr></table>
<div class="edge">Return 99.54% with perfect strategy, house edge 0.46%. Bet 5 coins: the royal pays 4,000 instead of 1,250.</div>
<p>Free play only: chips have no cash value and can't be bought.</p>`);

function hud() {
  ui.score(C.fmt(chips)); ui.levels(tableN); ui.progress(chips / T.target);
  ui.sub(`Table ${tableN} · goal ${C.fmt(T.target)} · 1 coin = ${C.fmt(T.u)}`);
  bars.text('one', 'Bet One', `${coins} coin${coins > 1 ? 's' : ''}`); bars.text('max', 'Bet Max', C.fmt(T.u * 5));
  bars.text('go', phase === 'hold' ? 'Draw' : 'Deal', phase === 'hold' ? 'keep the held' : C.fmt(coins * T.u));
  bars.enable('one', phase === 'bet'); bars.enable('max', phase === 'bet'); bars.enable('go', (phase === 'bet' && chips >= coins * T.u) || phase === 'hold');
  payCol(coins);
  if (D.beaten(chips) && !beatenShown && state === 'play') { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 48, 30); confetti(scene, new THREE.Vector3(0, 1, 0), 60); }
}
function betOne() { if (phase !== 'bet') return; coins = coins % 5 + 1; while (coins > 1 && coins * T.u > chips) coins--; C.csfx.chip(1); hud(); }
function betMax() { if (phase !== 'bet') return; coins = 5; while (coins > 1 && coins * T.u > chips) coins--; C.csfx.chip(3); hud(); go(); }
function toggleHold(i) {
  if (phase !== 'hold') return; held[i] = !held[i]; C.csfx.tick(); buzz(8);
  const m = meshes[i]; heldLabels[i].set(held[i] ? 'HELD' : '', '#ffd96a', '#2a1a00');
  const y0 = m.position.y, z0 = m.position.z, y1 = held[i] ? 0.16 : 0.012, z1 = held[i] ? CARD_Z - 0.12 : CARD_Z;
  C.tween(0.16, k => { m.position.y = y0 + (y1 - y0) * k; m.position.z = z0 + (z1 - z0) * k; }, C.ease.out);
}
// tap a card on the felt to hold it
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
  if (phase !== 'hold') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(meshes, true)[0]; if (!hit) return;
  const i = meshes.findIndex(m => m === hit.object.parent); if (i >= 0) toggleHold(i);
});

async function flipTo(i, card, delay = 0) {
  const m = meshes[i]; await C.wait(delay);
  // fly back to the deck face-down, swap, deal in and flip
  if (Math.abs(m.rotation.z) < 0.1) await C.tween(0.16, k => { m.rotation.z = Math.PI * k; m.position.y = 0.012 + Math.sin(k * Math.PI) * 0.25; });
  m.setCard(card); C.csfx.card();
  await C.tween(0.24, k => { m.rotation.z = Math.PI * (1 - k); m.position.y = 0.012 + Math.sin(k * Math.PI) * 0.4; m.position.z = CARD_Z - Math.sin(k * Math.PI) * 0.2; }, C.ease.inOut);
  m.rotation.z = 0; m.position.set(slot(i).x, 0.012, CARD_Z);
}
async function go() {
  if (phase === 'bet') return deal();
  if (phase === 'hold') return drawCards();
}
async function deal() {
  const cost = coins * T.u; if (chips < cost) return;
  phase = 'busy'; chips -= cost; hud(); C.csfx.chip(Math.min(4, coins)); resEl.textContent = ''; payHit(null);
  deck = C.shuffle(C.makeDeck(1)); hand = deck.splice(0, 5); held = [false, false, false, false, false];
  heldLabels.forEach(l => l.set('')); meshes.forEach(m => { m.position.y = 0.012; m.position.z = CARD_Z; });
  await Promise.all(hand.map((c, i) => flipTo(i, c, i * 0.07)));
  const k = classify(hand); if (k) { payHit(k); resEl.textContent = PAYS.find(r => r.k === k).n; }
  phase = 'hold'; hud(); bars.text('go', 'Draw', 'keep the held');
}
async function drawCards() {
  phase = 'busy'; hud();
  const jobs = []; let d = 0;
  for (let i = 0; i < 5; i++) if (!held[i]) { hand[i] = deck.shift(); jobs.push(flipTo(i, hand[i], (d++) * 0.08)); }
  await Promise.all(jobs);
  heldLabels.forEach(l => l.set('')); meshes.forEach((m, i) => { m.position.y = 0.012; m.position.z = CARD_Z; });
  const k = classify(hand), row = PAYS.find(r => r.k === k), win = row ? payFor(row, coins) * T.u : 0;
  payHit(k);
  if (win) {
    resEl.textContent = `${row.n}  +${C.fmt(win)}`;
    const big = ['RF', 'SF', '4K', 'FH', 'FL'].includes(k);
    (big ? C.csfx.big : C.csfx.win)(); buzz(big ? [30, 40, 30] : 20);
    hand.forEach((c, i) => glowCard(i));
    if (big) { confetti(scene, new THREE.Vector3(0, 0.8, 0), 70); ui.flash(0.35); ui.pop(row.n.toUpperCase() + '!', '#ffd96a', 40, 33); }
    await countUp(win);
  } else { resEl.textContent = ''; C.csfx.lose(); await C.wait(0.3); }
  best = Math.max(best, chips); S.set('best', best);
  await C.wait(0.35);
  if (chips >= T.target) return tableWon();
  if (chips < T.u) return tableLost();
  while (coins > 1 && coins * T.u > chips) coins--;
  phase = 'bet'; hud();
}
function glowCard(i) { const m = meshes[i]; C.tween(0.5, k => { m.position.y = 0.012 + Math.sin(k * Math.PI) * 0.18; }, C.ease.out); }
async function countUp(win) {
  const steps = Math.min(16, Math.max(3, Math.round(win / T.u))), per = win / steps, start = chips;
  for (let s = 1; s <= steps; s++) { chips = Math.round(start + per * s); hud(); C.csfx.chip(1); await C.wait(0.045); }
  chips = start + win; hud();
}
function tableWon() {
  state = 'won'; phase = 'idle'; bars.show(false); C.csfx.big(); confetti(scene, new THREE.Vector3(0, 1, 0), 90); ui.flash(0.4);
  D.won(chips, 'cashed out'); S.set('table', tableN + 1);
  ui.win(tableN, `${C.fmt(chips)} chips · next: Table ${tableN + 1}, 1 coin = ${C.fmt(tableCfg(tableN + 1).u)}`);
}
function tableLost() { state = 'lost'; phase = 'idle'; bars.show(false); ui.lose('OUT OF CHIPS', `Retry refills your ${C.fmt(T.start)} free chips`); }
function setupTable(n) {
  tableN = n; T = tableCfg(n); chips = T.start; coins = 5; beatenShown = false;
  C.backdrop(shade(T.felt[1], 1.25), '#030409'); buildFelt(); phase = 'bet'; resEl.textContent = ''; payHit(null);
  meshes.forEach((m, i) => { m.rotation.z = Math.PI; m.position.copy(slot(i)); }); heldLabels.forEach(l => l.set(''));
  hud();
}
function shade(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }
function begin() { payEl.style.opacity = 1; state = 'play'; phase = 'bet'; bars.show(true); hud(); msg('Bet Max deals instantly', 1200); }
ui.onTap(which => {
  if (which === 'start') begin();
  else if (which === 'win') { setupTable(tableN + 1); begin(); }
  else if (which === 'lose') { setupTable(tableN); begin(); }
});
setupTable(tableN); phase = 'idle'; hud(); payEl.style.opacity = 0;
ui.start();

let tPrev = performance.now();
loop(() => { const now = performance.now(); C.updateTweens(Math.min(0.05, (now - tPrev) / 1000)); tPrev = now; });

// ---------------------------------------------------------------- strategy (simple 9/6 Jacks or Better strategy, used by the bot)
const HI = r => r >= 11;
function holdStrategy(c) {
  const idx = [0, 1, 2, 3, 4], k = classify(c), byRank = {}, bySuit = [[], [], [], []];
  idx.forEach(i => { (byRank[c[i].r] = byRank[c[i].r] || []).push(i); bySuit[c[i].s].push(i); });
  const pairs = Object.entries(byRank).filter(([, v]) => v.length === 2), trips = Object.values(byRank).find(v => v.length === 3);
  const mask = sel => idx.map(i => sel.includes(i));
  // n cards to a royal / straight flush (same suit, span <= 4)
  const royal = n => { for (const s of bySuit) { const r = s.filter(i => c[i].r >= 10); if (r.length >= n) return r.slice(0, n); } return null; };
  const sfDraw = n => {
    for (const s of bySuit) { if (s.length < n) continue;
      const combos = choose(s, n); for (const cb of combos) { const rs = cb.map(i => c[i].r === 14 && cb.some(j => c[j].r <= 5) ? 1 : c[i].r); if (Math.max(...rs) - Math.min(...rs) <= 4 && new Set(rs).size === n) return cb; } }
    return null;
  };
  if (['RF', 'SF', 'FH', 'FL', 'ST'].includes(k)) return mask(idx);
  if (k === '4K') return mask(Object.values(byRank).find(v => v.length === 4));
  let h;
  if ((h = royal(4))) return mask(h);
  if (trips) return mask(trips);
  if ((h = sfDraw(4))) return mask(h);
  if (pairs.length === 2) return mask(pairs.flatMap(p => p[1]));
  const hp = pairs.find(p => +p[0] >= 11); if (hp) return mask(hp[1]);
  if ((h = royal(3))) return mask(h);
  const fl = bySuit.find(s => s.length === 4); if (fl) return mask(fl);
  if (pairs.length) return mask(pairs[0][1]);
  // 4 to an outside straight
  for (let lo = 2; lo <= 10; lo++) { const need = [lo, lo + 1, lo + 2, lo + 3]; if (lo === 2 || lo + 3 === 14) continue; if (need.every(r => byRank[r])) return mask(need.map(r => byRank[r][0])); }
  for (const s of bySuit) { const hs = s.filter(i => HI(c[i].r)); if (hs.length >= 2) return mask(hs.slice(0, 2)); }
  if ((h = sfDraw(3))) return mask(h);
  const highs = idx.filter(i => HI(c[i].r)).sort((a, b) => c[a].r - c[b].r);
  if (highs.length >= 2) return mask(highs.slice(0, 2));
  for (const s of bySuit) { const t = s.find(i => c[i].r === 10), f = s.find(i => c[i].r >= 11 && c[i].r <= 13); if (t !== undefined && f !== undefined) return mask([t, f]); }
  if (highs.length) return mask([highs[0]]);
  return mask([]);
}
function choose(a, n) { if (n === 0) return [[]]; if (a.length < n) return []; const [f, ...r] = a; return [...choose(r, n - 1).map(x => [f, ...x]), ...choose(r, n)]; }

window.__game = {
  get state() { return state; }, get level() { return tableN; }, get score() { return chips; },
  bot() {
    if (!botOn) { botOn = true; C.setSpeed(1.6); }
    if (state !== 'play') return;
    if (phase === 'bet') betMax();
    else if (phase === 'hold') { const want = holdStrategy(hand); const i = want.findIndex((w, j) => w !== held[j]); if (i >= 0) toggleHold(i); else drawCards(); }
  },
};

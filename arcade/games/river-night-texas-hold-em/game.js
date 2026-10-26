// River Night: Texas Hold'em — no-limit sit-and-go vs 3–5 AI players, free play only. Last one with chips wins the table.
// Cards: a fresh crypto-shuffled 52-card deck every hand. The AIs never see your cards or the deck; they estimate their own odds
// by simulation. The only adaptive part is flow on the AIs' aggression/skill (F.k()), recorded once per sit-and-go.
import { THREE, createStage, createUI, loop, store, confetti, buzz, rng } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { flow } from './kit/flow.js';
import { demo } from './kit/demo.js';
import * as C from './casino.js';

const NAME = "River Night: Texas Hold'em";
C.installCSS();
const stage = createStage({ fov: 40, shadowSize: 5 });
const { scene, camera, sun } = stage;
C.studio(stage);
const ui = createUI({ title: 'RIVER<br>NIGHT', hint: 'Tap to sit down', hand: '', progress: true, score: true });
const D = daily('rivernight', ui, { name: NAME });
const F = flow('rivernight');
C.startExtras(ui, "Texas Hold'em · sit-and-go vs AI players");
ui.els.win.querySelector('p').innerHTML = 'TABLE <span data-l>1</span>';
ui.els.win.querySelector('h1').textContent = 'TABLE WON!';
const S = store('rivernight');
const msg = C.message();

// ---------------------------------------------------------------- tables
const SCALE = [1, 5, 25, 100, 500, 2500];
const FELTS = [['#7c1f37', '#2b0613'], ['#1d6d4f', '#06261a'], ['#244f8f', '#091833'], ['#4c2f7a', '#170a2c'], ['#2f3340', '#0b0c10']];
const BLINDS = [[10, 20], [15, 30], [25, 50], [40, 80], [60, 120], [100, 200], [150, 300], [250, 500], [400, 800], [600, 1200], [1000, 2000], [1500, 3000], [2500, 5000]];
function tableCfg(n) {
  const s = SCALE[Math.min(n, SCALE.length) - 1] * Math.pow(2, Math.max(0, n - SCALE.length));
  return { n, s, opp: Math.min(5, 2 + n), stack: 1000 * s, every: 4, felt: FELTS[(n - 1) % FELTS.length] };
}
let tableN = Math.max(1, S.get('table', 1)), T = tableCfg(tableN);

// ---------------------------------------------------------------- table model
const RX = 2.15, RZ = 3.35;
let feltMesh;
function buildTable() {
  if (feltMesh) { scene.remove(feltMesh); feltMesh.material.map.dispose(); feltMesh.material.dispose(); }
  const tex = C.feltTexture(768, 1200, T.felt[0], T.felt[1], (x, W, H) => {
    x.strokeStyle = 'rgba(244,206,120,.45)'; x.lineWidth = 3; x.beginPath(); x.ellipse(W / 2, H / 2, W * 0.4, H * 0.41, 0, 0, Math.PI * 2); x.stroke();
    C.goldText(x, 'RIVER NIGHT', W / 2, H * 0.62, 34, { color: 'rgba(255,255,255,.1)', track: 10 });
    const U = (X, Z) => [(X / RX + 1) / 2 * W, (Z / RZ + 1) / 2 * H], sx = W / (2 * RX), sz = H / (2 * RZ);
    x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const [cx, cy] = U((i - 2) * 0.74, COMM_Z); C.rr(x, cx - 0.36 * sx, cy - 0.5 * sz, 0.72 * sx, 1.0 * sz, 8); x.stroke(); }
  });
  feltMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  feltMesh.scale.set(RX, RZ, 1); feltMesh.rotation.x = -Math.PI / 2; feltMesh.receiveShadow = true; scene.add(feltMesh);
}
{
  const railM = new THREE.MeshPhysicalMaterial({ color: '#241411', roughness: 0.5, clearcoat: 0.9, clearcoatRoughness: 0.35 });
  const woodM = new THREE.MeshPhysicalMaterial({ color: '#5b3219', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const ellipse = (rx, rz, y) => new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => { const a = i / 96 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * rx, y, Math.sin(a) * rz); }), true);
  const rail = new THREE.Mesh(new THREE.TubeGeometry(ellipse(RX + 0.16, RZ + 0.16, 0.12), 240, 0.17, 18, true), railM); rail.castShadow = true; rail.receiveShadow = true; scene.add(rail);
  const rim = new THREE.Mesh(new THREE.TubeGeometry(ellipse(RX - 0.03, RZ - 0.03, 0.02), 240, 0.035, 10, true), woodM); scene.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 96), woodM); base.scale.set(RX + 0.3, 1, RZ + 0.3); base.position.y = -0.16; base.receiveShadow = true; scene.add(base);
}
function placeCam() {
  const a = innerWidth / innerHeight, tv = Math.tan(camera.fov * Math.PI / 360), d = Math.max(6, (RX + 0.62) / (tv * Math.min(a, 1.1)));
  camera.position.set(0, d * 0.97, d * 0.24); camera.lookAt(0, 0, a < 0.75 ? 0.05 : 0);
}
addEventListener('resize', () => setTimeout(placeCam)); placeCam();
sun.position.set(2, 12, 4);
const lamp = new THREE.PointLight('#ffd8a0', 6, 13, 1.5); lamp.position.set(0, 5, 0); scene.add(lamp);

const ANCHORS = {
  3: [[-2.05, 1.05], [0, -3.3], [2.05, 1.05]],
  4: [[-2.05, 1.1], [-1.45, -2.85], [1.45, -2.85], [2.05, 1.1]],
  5: [[-2.05, 1.35], [-2.0, -1.75], [0, -3.3], [2.0, -1.75], [2.05, 1.35]],
};
const YOU = [0, 3.2];
const COMM_Z = -0.55, POT = new THREE.Vector3(0, 0, 0.42), DEAL_FROM = new THREE.Vector3(0, 0.6, -1.2);

// ---------------------------------------------------------------- DOM seats
const css = document.createElement('style'); css.textContent = `
.ph-seat{position:fixed;z-index:5;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;transition:opacity .3s}
.ph-av{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 22px 'Baloo 2',system-ui;color:#fff;border:3px solid rgba(255,255,255,.85);box-shadow:0 6px 14px rgba(0,0,0,.45);text-shadow:0 2px 0 rgba(0,0,0,.25);position:relative}
.ph-av i{position:absolute;right:-8px;bottom:-4px;font-style:normal;font-size:17px}
.ph-seat.turn .ph-av{border-color:#ffd96a;box-shadow:0 0 0 4px rgba(255,217,106,.45),0 0 22px rgba(255,217,106,.7)}
.ph-seat.fold{opacity:.42}.ph-seat.out{opacity:.18;filter:grayscale(1)}
.ph-plate{margin-top:-6px;background:rgba(10,8,14,.82);border-radius:10px;padding:1px 9px 2px;text-align:center;min-width:64px;border:1px solid rgba(255,255,255,.12)}
.ph-n{font:700 12px/1.1 'Baloo 2',system-ui;color:#e8e2f0;white-space:nowrap}.ph-s{font:800 14px/1.1 'Baloo 2',system-ui;color:#ffd96a}
.ph-act{position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#fff;color:#1c1b24;border-radius:10px;padding:0 8px;font:800 12.5px/20px 'Baloo 2',system-ui;white-space:nowrap;opacity:0;transition:opacity .2s;box-shadow:0 3px 8px rgba(0,0,0,.35)}
.ph-act.on{opacity:1}.ph-act.fold{background:#5a5566;color:#ddd}.ph-act.raise{background:#ffb02e}.ph-act.allin{background:#e8314b;color:#fff}.ph-act.win{background:#2fd17d;color:#05301a}
.ph-btn{position:absolute;top:2px;left:-10px;width:20px;height:20px;border-radius:50%;background:#fff;color:#111;font:800 11px/20px system-ui;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.4);display:none}
.ph-seat.dealer .ph-btn{display:block}
.ph-hand{position:fixed;left:0;right:0;z-index:5;text-align:center;pointer-events:none;font:800 18px 'Baloo 2',system-ui;color:#ffd96a;text-shadow:0 2px 0 rgba(0,0,0,.5)}
`; document.head.appendChild(css);
const handEl = C.h(`<div class="ph-hand"></div>`); document.body.appendChild(handEl);
const AV_COL = ['#ff6b6b', '#4dabf7', '#51cf66', '#cc5de8', '#ff922b', '#20c997', '#f06595', '#fcc419', '#748ffc'];
const NAMES = ['Mara', 'Otto', 'Juno', 'Rafe', 'Ines', 'Kofi', 'Lena', 'Bao', 'Tess', 'Ravi', 'Nico', 'Zola', 'Ivo', 'Pia', 'Hugo', 'Sana'];
const BADGE = ['🦊', '🦉', '🐻', '🦁', '🐺', '🐯', '🐼', '🦝', '🐸'];
const STYLE = [{ n: 'Rock', t: 1.25, a: 0.75, b: 0.02 }, { n: 'Shark', t: 1.05, a: 1.25, b: 0.07 }, { n: 'Maniac', t: 0.75, a: 1.5, b: 0.12 }, { n: 'Calling station', t: 0.8, a: 0.55, b: 0.02 }, { n: 'Steady', t: 1.0, a: 1.0, b: 0.05 }];

// ---------------------------------------------------------------- game state
const B = worldBoard({ game: 'river-night', label: 'Tables won', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });   // world board: 1 point per table won vs the AI players today
let state = 'ready', players = [], btn = 0, handNo = 0, deck = [], board = [], boardMeshes = [], pot = 0, curBet = 0, minRaise = 0;
let busy = false, waiting = null, recorded = false, beatenShown = false, botOn = false, elimOrder = [], aiK = 1, totalChips = 0, potStack = null;
const potLabel = C.label(0.9, 0.32); potLabel.position.set(POT.x, 0.5, POT.z + 0.42); scene.add(potLabel);
const blinds = () => { const lv = Math.min(BLINDS.length - 1, Math.floor((handNo - 1) / T.every)); return BLINDS[lv].map(b => b * T.s); };
const alive = () => players.filter(p => !p.out);
const inHand = p => !p.out && !p.folded;
const nextIdx = (i, pred) => { for (let k = 1; k <= players.length; k++) { const j = (i + k) % players.length; if (pred(players[j])) return j; } return -1; };

function makeSeat(p) {
  const el = C.h(`<div class="ph-seat"><div class="ph-act"></div><div class="ph-av" style="background:radial-gradient(circle at 35% 30%,${p.color}, ${shade(p.color, .55)})">${p.name[0]}<i>${p.badge}</i></div><div class="ph-btn">D</div><div class="ph-plate"><div class="ph-n">${p.name}</div><div class="ph-s"></div></div></div>`);
  document.body.appendChild(el); return el;
}
function shade(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }
const _v = new THREE.Vector3();
function placeSeats() {
  for (const p of players) {
    if (!p.el) continue; _v.set(p.anchor[0], 0.25, p.anchor[1]).project(camera);
    const x = Math.max(44, Math.min(innerWidth - 44, (_v.x + 1) / 2 * innerWidth)), y = (1 - _v.y) / 2 * innerHeight;
    p.el.style.left = x + 'px'; p.el.style.top = y + 'px';
  }
  _v.set(0, 0.2, 1.65).project(camera); handEl.style.top = ((1 - _v.y) / 2 * innerHeight - 12) + 'px';
}
function seatUI(p) {
  if (!p.el) return;
  p.el.querySelector('.ph-s').textContent = p.out ? 'out' : p.stack === 0 && p.allIn ? 'ALL-IN' : C.fmt(p.stack);
  p.el.classList.toggle('fold', !!p.folded && !p.out); p.el.classList.toggle('out', !!p.out);
}
function say(p, text, cls = '') {
  if (!p.el) { if (text) ui.pop(text, '#fff', 26, 80); return; }
  const a = p.el.querySelector('.ph-act'); a.className = 'ph-act ' + cls + (text ? ' on' : ''); a.textContent = text;
}
function setTurn(p) { players.forEach(q => q.el && q.el.classList.toggle('turn', q === p)); }

function setupTable(n) {
  tableN = n; T = tableCfg(n); aiK = F.k(); recorded = false; beatenShown = false; elimOrder = []; handNo = 0;
  for (const p of players) { p.el && p.el.remove(); clearCards(p); if (p.stackMesh) scene.remove(p.stackMesh); }
  clearBoard(); if (potStack) scene.remove(potStack); potStack = null; pot = 0; potLabel.set('');
  // seating: daily challenge = same opponents for everyone today
  const r = rng((D.seed || 7919 * n + 13) + 1);
  const pool = NAMES.slice(); const opps = [];
  for (let i = 0; i < T.opp; i++) {
    const name = pool.splice(Math.floor(r() * pool.length), 1)[0], st = STYLE[Math.floor(r() * STYLE.length)];
    opps.push({ name, color: AV_COL[Math.floor(r() * AV_COL.length)], badge: BADGE[Math.floor(r() * BADGE.length)], style: st, ai: true });
  }
  players = [{ name: 'You', you: true, anchor: YOU, style: { n: 'You', t: 1, a: 1, b: 0.04 } }, ...opps.map((o, i) => ({ ...o, anchor: ANCHORS[T.opp][i] }))];
  for (const p of players) { p.stack = T.stack; p.out = false; p.folded = false; p.hole = []; p.cardMeshes = []; if (!p.you) p.el = makeSeat(p); seatUI(p); }
  totalChips = T.stack * players.length;
  btn = Math.floor(r() * players.length);
  C.backdrop(shade(T.felt[1], 1.3), '#030304'); buildTable(); placeSeats(); hud();
}
function hud() {
  const you = players[0]; if (!you) return;
  ui.score(C.fmt(you.stack)); ui.levels(tableN); ui.progress(you.stack / totalChips);
  const [sb, bb] = handNo ? blinds() : [10 * T.s, 20 * T.s];
  ui.sub(`Your stack · blinds ${C.fmt(sb)}/${C.fmt(bb)} · ${alive().length} players left`);
  if (D.beaten(you.stack) && !beatenShown && state === 'play') { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 48, 30); confetti(scene, new THREE.Vector3(0, 1, 2), 50); }
}

// ---------------------------------------------------------------- 3D: cards, bets, pot
const seatV = (p, k) => new THREE.Vector3(p.anchor[0] * k, 0, p.anchor[1] * k);
function betAnchor(p) { return p.you ? new THREE.Vector3(0.95, 0, 1.55) : seatV(p, 0.6); }
function cardAnchor(p, j) {
  if (p.you) return new THREE.Vector3((j - 0.5) * 0.62, 0.015 + j * 0.006, 2.35);
  const v = seatV(p, 0.8); v.x += (j - 0.5) * 0.3 - Math.sign(p.anchor[0]) * 0.05; v.y = 0.015 + j * 0.006; return v;
}
function redrawBet(p) {
  if (p.stackMesh) scene.remove(p.stackMesh); p.stackMesh = null;
  if (!p.bet) return;
  p.stackMesh = C.chipStack(p.bet, { cap: 7, col: 7 }); p.stackMesh.scale.setScalar(0.8); p.stackMesh.position.copy(betAnchor(p)); scene.add(p.stackMesh);
}
function redrawPot() {
  if (potStack) scene.remove(potStack); potStack = null;
  if (pot > 0) { potStack = C.chipStack(pot, { cap: 12, col: 6 }); potStack.scale.setScalar(0.85); potStack.position.copy(POT); scene.add(potStack); potLabel.set('Pot ' + C.fmt(pot), 'rgba(16,14,20,.82)', '#ffd96a'); }
  else potLabel.set('');
}
function clearCards(p) { (p.cardMeshes || []).forEach(m => { scene.remove(m); m.dispose(); }); p.cardMeshes = []; }
function clearBoard() { boardMeshes.forEach(m => { scene.remove(m); m.dispose(); }); boardMeshes = []; }
async function dealHole(p, j) {
  const c = deck.pop(); p.hole.push(c);
  const m = C.cardMesh(c, '#2b1b4a', 'R'); m.scale.setScalar(p.you ? 1.38 : 0.72);
  m.position.copy(DEAL_FROM); m.rotation.set(0, 0, Math.PI); scene.add(m); p.cardMeshes.push(m); C.csfx.card();
  const to = cardAnchor(p, j);
  await C.fly(m, to, { dur: 0.3, lift: 0.4, rot: { x: 0, y: p.you ? (j - 0.5) * -0.12 : (j - 0.5) * 0.2, z: p.you ? 0 : Math.PI } });
}
async function dealBoard(n) {
  deck.pop();   // burn
  const jobs = [];
  for (let k = 0; k < n; k++) {
    const c = deck.pop(), i = board.length; board.push(c);
    const m = C.cardMesh(c, '#2b1b4a', 'R'); m.scale.setScalar(1.06); m.position.copy(DEAL_FROM); m.rotation.set(0, 0, Math.PI); scene.add(m); boardMeshes.push(m);
    jobs.push(C.wait(k * 0.12).then(() => { C.csfx.card(); return C.fly(m, new THREE.Vector3((i - 2) * 0.74, 0.012, COMM_Z), { dur: 0.36, lift: 0.45, rot: { x: 0, y: 0, z: 0 } }); }));
  }
  await Promise.all(jobs);
}
async function collectBets() {
  const jobs = [];
  for (const p of players) if (p.stackMesh) { const m = p.stackMesh; p.stackMesh = null; jobs.push(C.fly(m, POT, { dur: 0.3, lift: 0.15 }).then(() => scene.remove(m))); }
  if (jobs.length) C.csfx.chip(3);
  await Promise.all(jobs);
  for (const p of players) { pot += p.bet; p.bet = 0; }
  curBet = 0; redrawPot();
}
function put(p, amt) { amt = Math.min(amt, p.stack); p.stack -= amt; p.bet += amt; p.total += amt; if (p.stack === 0) p.allIn = true; redrawBet(p); seatUI(p); return amt; }

// ---------------------------------------------------------------- equity by simulation (AI only ever uses its own cards + board)
let xs = 1;
function seedX() { const a = new Uint32Array(1); crypto.getRandomValues(a); xs = a[0] || 1; }
const xr = n => { xs ^= xs << 13; xs >>>= 0; xs ^= xs >>> 17; xs ^= xs << 5; xs >>>= 0; return xs % n; };
function equity(hole, brd, nOpp, iters) {
  seedX();
  const used = new Set([...hole, ...brd].map(c => c.r * 4 + c.s)), rest = C.makeDeck(1).filter(c => !used.has(c.r * 4 + c.s));
  let score = 0;
  for (let it = 0; it < iters; it++) {
    const d = rest.slice(); const take = () => d.splice(xr(d.length), 1)[0];
    const b = brd.slice(); while (b.length < 5) b.push(take());
    const me = C.evalHand([...hole, ...b]); let best = 0, ties = 0, lose = false;
    for (let o = 0; o < nOpp; o++) { const v = C.evalHand([take(), take(), ...b]); if (v > me) { lose = true; break; } if (v === me) ties++; }
    if (!lose) score += 1 / (1 + ties);
    void best;
  }
  return score / iters;
}

// ---------------------------------------------------------------- decisions
function decideAI(p) {
  const [, bb] = blinds(), toCall = curBet - p.bet, potNow = pot + players.reduce((a, q) => a + q.bet, 0);
  const opp = players.filter(q => inHand(q) && q !== p).length;
  const skill = p.you ? 1 : aiK, st = p.style;
  const eqRaw = equity(p.hole, board, Math.max(1, opp), Math.round(140 + 160 * Math.min(1.3, skill)));
  const noise = (0.09 / skill) * (C.sfloat() - 0.5) * 2, eq = eqRaw + noise;
  const fair = 1 / (opp + 1), odds = toCall > 0 ? toCall / (potNow + toCall) : 0;
  const aggr = st.a * (p.you ? 1 : skill), tight = st.t;
  const stackBB = p.stack / bb, effAllIn = toCall >= p.stack;
  const strong = eq > Math.min(0.88, fair * (1.55 + 0.25 * tight) + 0.05);
  const good = eq > fair * (1.05 + 0.15 * tight);
  const bluff = C.sfloat() < st.b * aggr * (opp <= 2 ? 1.6 : 0.6);
  const raiseTo = (frac) => {
    let to = Math.round(curBet + Math.max(minRaise, potNow * frac));
    if (board.length === 0 && curBet <= bb) to = Math.round(bb * (2.5 + C.sfloat() * 1.5) + bb * players.filter(q => q.bet >= bb && q !== p && inHand(q)).length * 0.5);
    to = Math.max(to, curBet + minRaise);
    if (to >= p.bet + p.stack * 0.7) return { a: 'allin' };
    return { a: 'raise', to };
  };
  // short stack: push or fold
  if (stackBB <= 10 && board.length === 0) {
    if (eq > fair * (1.15 + 0.15 * tight) - (stackBB < 5 ? 0.06 : 0) || (toCall === 0 && bluff)) return { a: 'allin' };
    return toCall === 0 ? { a: 'check' } : { a: 'fold' };
  }
  if (toCall === 0) {
    if (strong && C.sfloat() < 0.55 + 0.3 * Math.min(1.3, aggr)) return raiseTo(0.5 + 0.35 * C.sfloat() * aggr);
    if ((good && C.sfloat() < 0.25 * aggr) || bluff) return raiseTo(0.45 + 0.2 * C.sfloat());
    return { a: 'check' };
  }
  if (effAllIn) return eq > odds + 0.04 * tight ? { a: 'call' } : { a: 'fold' };
  if (strong && C.sfloat() < 0.4 + 0.35 * Math.min(1.3, aggr)) return raiseTo(0.6 + 0.4 * C.sfloat() * aggr);
  if (eq > odds * (0.95 + 0.25 * tight) + 0.02 || (good && toCall <= bb)) return { a: 'call' };
  if (bluff && toCall < potNow * 0.5 && opp <= 2) return raiseTo(0.7);
  return { a: 'fold' };
}
async function getAction(p) {
  if (p.you) {
    showBar(p);
    const a = await new Promise(res => { waiting = res; });
    waiting = null; actBar.show(false); raiseBar.show(false); return a;
  }
  setTurn(p);
  await C.wait(0.35 + C.sfloat() * 0.45);
  return decideAI(p);
}
function apply(p, a) {
  const toCall = curBet - p.bet;
  if (a.a === 'check' && toCall > 0) a = { a: 'call' };
  if (a.a === 'fold') { p.folded = true; say(p, 'Fold', 'fold'); C.csfx.flip(); foldCards(p); if (p.you) handEl.textContent = ''; }
  else if (a.a === 'check') { say(p, 'Check'); C.csfx.tick(); }
  else if (a.a === 'call') { const amt = put(p, toCall); say(p, p.allIn ? 'All-in' : 'Call ' + C.fmt(amt), p.allIn ? 'allin' : ''); C.csfx.chip(2); }
  else {
    let to = a.a === 'allin' ? p.bet + p.stack : Math.min(a.to, p.bet + p.stack);
    if (to <= curBet) { const amt = put(p, toCall); say(p, p.allIn ? 'All-in' : 'Call ' + C.fmt(amt), p.allIn ? 'allin' : ''); C.csfx.chip(2); }
    else {
      const raiseBy = to - curBet; if (raiseBy >= minRaise) minRaise = raiseBy;
      put(p, to - p.bet); curBet = to;
      players.forEach(q => { if (q !== p) q.acted = false; });
      say(p, p.allIn ? 'All-in ' + C.fmt(to) : (curBet > 0 && toCall > 0 ? 'Raise ' : 'Bet ') + C.fmt(to), p.allIn ? 'allin' : 'raise'); C.csfx.chip(4); buzz(10);
    }
  }
  p.acted = true; seatUI(p); hud();
}
function foldCards(p) {
  for (const m of p.cardMeshes) C.fly(m, DEAL_FROM.clone().setY(0.02), { dur: 0.35, lift: 0.3, rot: { x: 0, y: 0, z: Math.PI } }).then(() => { m.visible = false; });
}
async function bettingRound(start) {
  players.forEach(p => { p.acted = false; });
  let i = start, guard = 0;
  while (guard++ < 200) {
    if (players.filter(inHand).length <= 1) break;
    const actors = players.filter(p => inHand(p) && !p.allIn);
    if (actors.length === 0) break;
    if (actors.every(p => p.acted && p.bet === curBet)) break;
    if (actors.length === 1 && actors[0].bet >= curBet && players.filter(inHand).every(q => q.allIn || q === actors[0])) break;
    const p = players[i];
    if (inHand(p) && !p.allIn && !(p.acted && p.bet === curBet)) { const a = await getAction(p); apply(p, a); }
    i = (i + 1) % players.length;
  }
  setTurn(null);
}

// ---------------------------------------------------------------- the hand
async function playHand() {
  handNo++;
  const [sb, bb] = blinds();
  if (handNo > 1 && (handNo - 1) % T.every === 0) msg(`Blinds up: ${C.fmt(sb)}/${C.fmt(bb)}`, 1300, '#ffd96a');
  btn = nextIdx(btn, q => !q.out);
  const two = alive().length === 2, sbI = two ? btn : nextIdx(btn, q => !q.out), bbI = nextIdx(sbI, q => !q.out);
  players.forEach(p => { p.folded = p.out; p.allIn = false; p.bet = 0; p.total = 0; p.hole = []; clearCards(p); say(p, ''); seatUI(p); p.el && p.el.classList.toggle('dealer', players.indexOf(p) === btn); });
  youDealer.visible = btn === 0;
  clearBoard(); board = []; pot = 0; redrawPot(); handEl.textContent = '';
  deck = C.shuffle(C.makeDeck(1));
  put(players[sbI], sb); put(players[bbI], bb); curBet = bb; minRaise = bb; C.csfx.chip(2);
  say(players[sbI], 'SB ' + C.fmt(players[sbI].bet)); say(players[bbI], 'BB ' + C.fmt(players[bbI].bet));
  hud();
  for (let j = 0; j < 2; j++) { let i = sbI; for (let k = 0; k < players.length; k++) { const p = players[(i + k) % players.length]; if (!p.out) await dealHole(p, j); } }
  showYourHand();
  await bettingRound(nextIdx(bbI, q => !q.out));
  for (const n of [3, 1, 1]) {
    if (players.filter(inHand).length <= 1) break;
    await collectBets(); players.forEach(p => { if (inHand(p)) say(p, ''); });
    await dealBoard(n); showYourHand(); minRaise = bb;
    if (players.filter(p => inHand(p) && !p.allIn).length >= 2) await bettingRound(nextIdx(btn, inHand));
    else await C.wait(0.5);
  }
  await collectBets();
  await showdown();
}
function showYourHand() {
  const you = players[0]; if (!inHand(you) || you.hole.length < 2) { handEl.textContent = ''; return; }
  if (board.length === 0) { const [a, b] = you.hole; handEl.textContent = a.r === b.r ? 'Pocket pair' : (a.s === b.s ? 'Suited' : ''); return; }
  handEl.textContent = C.HAND_NAMES[C.handCat(C.evalHand([...you.hole, ...board]))];
}
async function showdown() {
  const live = players.filter(inHand);
  if (live.length > 1) {
    while (board.length < 5) await dealBoard(1);   // run it out after all-ins
    for (const p of live) if (!p.you) {
      await Promise.all(p.cardMeshes.map((m, j) => C.fly(m, cardAnchor(p, j).setY(0.02), { dur: 0.3, lift: 0.25, rot: { x: 0, y: 0, z: 0 } })));
      C.csfx.flip();
    }
    for (const p of live) say(p, C.HAND_NAMES[C.handCat(C.evalHand([...p.hole, ...board]))]);
    await C.wait(0.9);
  }
  // pots by contribution level
  const levels = [...new Set(live.map(p => p.total))].sort((a, b) => a - b);
  let prev = 0; const winners = new Map();
  for (const L of levels) {
    let amt = 0; for (const p of players) amt += Math.max(0, Math.min(p.total, L) - Math.min(p.total, prev));
    const elig = live.filter(p => p.total >= L);
    let best = -1, ws = [];
    for (const p of elig) { const v = live.length === 1 ? 0 : C.evalHand([...p.hole, ...board]); if (v > best) { best = v; ws = [p]; } else if (v === best) ws.push(p); }
    const share = Math.floor(amt / ws.length); let rem = amt - share * ws.length;
    for (const w of ws) { const g = share + (rem-- > 0 ? 1 : 0); winners.set(w, (winners.get(w) || 0) + g); }
    prev = L;
  }
  const jobs = [];
  for (const [w, amt] of winners) {
    const s = C.chipStack(amt, { cap: 10, col: 5 }); s.scale.setScalar(0.85); s.position.copy(POT); scene.add(s);
    jobs.push(C.fly(s, w.you ? new THREE.Vector3(0, 0.3, 3.0) : seatV(w, 0.9), { dur: 0.55, lift: 0.5 }).then(() => scene.remove(s)));
    say(w, (live.length > 1 ? 'Wins ' : 'Takes ') + C.fmt(amt), 'win');
  }
  if (potStack) { scene.remove(potStack); potStack = null; } pot = 0; potLabel.set('');
  C.csfx.chip(4);
  await Promise.all(jobs);
  for (const [w, amt] of winners) { w.stack += amt; seatUI(w); }
  const youWon = winners.has(players[0]);
  if (youWon) { C.csfx.win(); buzz(25); ui.pop('+' + C.fmt(winners.get(players[0])), '#ffe08a', 40, 52); if (live.length > 1) confetti(scene, new THREE.Vector3(0, 0.6, 2.2), 30); }
  hud(); await C.wait(1.0);
  // eliminations
  for (const p of players) if (!p.out && p.stack === 0) { p.out = true; elimOrder.push(p); seatUI(p); say(p, p.you ? '' : 'Busted', 'fold'); if (!p.you) { clearCards(p); msg(`${p.name} is out`, 1000); } }
  hud();
}
async function runTable() {
  while (state === 'play') {
    await playHand();
    const you = players[0];
    if (you.out) {
      const place = alive().length + 1, frac = elimOrder.length > 1 ? (elimOrder.length - 1) / T.opp : 0;
      if (!recorded) { recorded = true; F.level(false, frac); }
      state = 'lost'; actBar.show(false);
      ui.lose('BUSTED', `Finished ${ordinal(place)} of ${players.length} · retry refills ${C.fmt(T.stack)} chips`); C.csfx.lose();
      return;
    }
    if (alive().length === 1) {
      if (!recorded) { recorded = true; F.level(true); B.submit(1); }
      state = 'won'; actBar.show(false); C.csfx.big(); confetti(scene, new THREE.Vector3(0, 1, 1.5), 90); ui.flash(0.4);
      S.set('table', tableN + 1);
      D.won(you.stack, 'won a table with');
      ui.win(tableN, `You took all ${C.fmt(you.stack)} chips · next: ${tableCfg(tableN + 1).opp} opponents, bigger blinds`);
      return;
    }
  }
}
const ordinal = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';

// your dealer button (3D puck in front of you)
const youDealer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32), new THREE.MeshPhysicalMaterial({ map: C.canvasTex(128, 128, x => { x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#111'; x.font = 'bold 72px Georgia'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('D', 64, 70); }), clearcoat: 1, roughness: 0.3 }));
youDealer.position.set(-1.0, 0.03, 2.05); youDealer.castShadow = true; youDealer.visible = false; scene.add(youDealer);

// ---------------------------------------------------------------- your controls
const actBar = C.bar([{ id: 'fold', text: 'Fold', cls: 'red', on: () => choose({ a: 'fold' }) }, { id: 'call', text: 'Check', cls: 'green', on: () => choose({ a: curBet - players[0].bet > 0 ? 'call' : 'check' }) }, { id: 'raise', text: 'Raise', cls: '', on: () => raiseBar.show(!raiseBar.el.classList.contains('off') ? false : true) }]);
const raiseBar = C.bar([{ id: 'min', text: 'Min', cls: 'dark', on: () => raiseFrac(0) }, { id: 'half', text: '½ Pot', cls: 'dark', on: () => raiseFrac(0.5) }, { id: 'pot', text: 'Pot', cls: 'dark', on: () => raiseFrac(1) }, { id: 'all', text: 'All-in', cls: 'red', on: () => choose({ a: 'allin' }) }], { row2: true });
function choose(a) { if (waiting) { const w = waiting; waiting = null; raiseBar.show(false); w(a); } }
function raiseTarget(f) { const p = players[0], potNow = pot + players.reduce((s, q) => s + q.bet, 0), toCall = curBet - p.bet; return f === 0 ? curBet + minRaise : Math.round(curBet + Math.max(minRaise, (potNow + toCall) * f)); }
function raiseFrac(f) { choose({ a: 'raise', to: raiseTarget(f) }); }
function showBar(p) {
  const toCall = curBet - p.bet;
  actBar.text('fold', 'Fold'); actBar.text('call', toCall > 0 ? (toCall >= p.stack ? 'All-in' : 'Call') : 'Check', toCall > 0 ? C.fmt(Math.min(toCall, p.stack)) : '');
  const canRaise = p.stack > toCall;
  actBar.enable('raise', canRaise); actBar.text('raise', curBet > 0 ? 'Raise' : 'Bet', '▴ size');
  actBar.enable('fold', toCall > 0);
  const lim = p.bet + p.stack;
  raiseBar.text('min', 'Min', C.fmt(Math.min(lim, raiseTarget(0)))); raiseBar.text('half', '½ Pot', C.fmt(Math.min(lim, raiseTarget(0.5)))); raiseBar.text('pot', 'Pot', C.fmt(Math.min(lim, raiseTarget(1)))); raiseBar.text('all', 'All-in', C.fmt(lim));
  actBar.show(true); setTurn(null); ui.pop('Your turn', '#ffd96a', 24, 80);
}
const odds = C.oddsPanel(`<h2>Rules & fairness</h2>
<p>No-limit Texas Hold'em, sit-and-go: everyone starts with the same stack, blinds rise every few hands, last player with chips wins the table.</p>
<h3>Fair cards</h3><p>A fresh 52-card deck every hand, shuffled with your browser's cryptographic random generator. There is no house and no rake: chips only move between players.</p>
<h3>Honest opponents</h3><p>The AI players never see your cards or the deck. Each one estimates its own odds by simulating random hands, then decides with its own style (tight, loose, aggressive…). As you win more tables, they play a little sharper and more aggressively; if you keep busting, a little softer. Your cards are never touched.</p>
<h3>Hand ranking</h3><table><tr><td>Straight flush</td><td>best</td></tr><tr><td>Four of a kind</td><td></td></tr><tr><td>Full house</td><td></td></tr><tr><td>Flush</td><td></td></tr><tr><td>Straight</td><td></td></tr><tr><td>Three of a kind</td><td></td></tr><tr><td>Two pair</td><td></td></tr><tr><td>Pair</td><td></td></tr><tr><td>High card</td><td>lowest</td></tr></table>
<div class="edge">No house edge: you play the AIs, not the house. Free play only: chips have no cash value and can't be bought.</div>`);

ui.onTap(which => {
  B.start();
  if (which === 'start') { state = 'play'; runTable(); }
  else if (which === 'win') { setupTable(tableN + 1); state = 'play'; runTable(); }
  else if (which === 'lose') { setupTable(tableN); state = 'play'; runTable(); }
});
setupTable(tableN); ui.start();
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): at the first table, until the first touch,
// when it's your turn and it costs nothing, your seat plays by itself: a free check, or a fold of a weak hand with no chips in
let freeMemo = { w: null, a: null };
const freeMove = () => { const p = players[0]; if (!p || !waiting) return null; if (curBet - p.bet === 0) return { a: 'check' };
  if (freeMemo.w !== waiting) freeMemo = { w: waiting, a: p.total === 0 && decideAI(p).a === 'fold' ? { a: 'fold' } : null }; return freeMemo.a; };
demo(() => { const a = freeMove(); if (a) choose(a); }, { ready: () => state === 'play' && tableN === 1 && !!freeMove(), wait: 1600, every: 1300, max: 2, ms: 12000 });

let tPrev = performance.now();
loop(() => { const now = performance.now(); C.updateTweens(Math.min(0.05, (now - tPrev) / 1000)); tPrev = now; placeSeats(); });

// ---------------------------------------------------------------- test hook: sensible equity-based play for your seat
window.__game = {
  get state() { return state; }, get level() { return tableN; }, get score() { return players[0] ? players[0].stack : 0; },
  bot() {
    if (!botOn) { botOn = true; C.setSpeed(2.4); }
    if (state !== 'play' || !waiting) return;
    choose(decideAI(players[0]));
  },
};

// Pourly — tap a tube, tap another: the liquid pours over. Gather every shade into a tube of its own.
// Glass tubes on shelves, glossy layered liquids, a tilted pour with a stream, corks pop on finished tubes.
import { THREE, createStage, createUI, loop, glossy, mat, rounded, burst, confetti, sfx, tone, note, buzz, store, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { CAP, top, run, done, legal, pourN, solve, deal } from './levels.js';

const NAME = 'Pourly: Liquid Tube Game';
const S = createStage({ fov: 34, shadowSize: 9 });
const { scene, camera, sun, hemi } = S;
sun.position.set(3, 10, 9); sun.intensity = 1.5; hemi.intensity = 1.25;
const ui = createUI({ title: 'POURLY', hint: 'Tap a tube, then tap where to pour', hand: '👆', score: false });
const D = daily('pourly', ui, { name: NAME });
const save = store('pourly');
const F = flow('pourly');
let level = save.get('level', 1), sortedTotal = save.get('sorted', 0);

const COLORS = ['#ff4d6d', '#ffb703', '#3a86ff', '#38c95c', '#9b5de5', '#ff8fc8', '#00c4d6', '#ff7a1a', '#8d5a3b', '#b5e61d', '#25306b', '#9aa3ad'];
const BGS = [['#cfc4ff', '#ffe3f4'], ['#b9ecff', '#e9fff6'], ['#ffd6c9', '#fff4d6'], ['#c9f2dc', '#eef9ff'], ['#ffd1e8', '#e8e0ff']];
const LMAT = COLORS.map((c) => glossy(c, { roughness: 0.16, emissive: c, emissiveIntensity: 0.14 }));

// ---------------------------------------------------------------- HUD bits
const css = document.createElement('style'); css.textContent = `
.pl-bar{position:fixed;left:0;right:0;bottom:calc(22px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:26px;z-index:6;pointer-events:none}
.pl-btn{pointer-events:auto;position:relative;width:64px;height:64px;border-radius:20px;border:0;background:#fff;color:#5b4a9e;font:800 30px 'Baloo 2',system-ui;box-shadow:0 5px 0 rgba(60,40,120,.22),0 10px 22px rgba(60,40,120,.15);cursor:pointer;display:flex;align-items:center;justify-content:center}
.pl-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(60,40,120,.22)}
.pl-btn b{position:absolute;top:-8px;right:-8px;min-width:24px;height:24px;border-radius:12px;background:var(--ui,#7b5cff);color:#fff;font-size:14px;line-height:24px;padding:0 6px}
.pl-btn.off{opacity:.45}
.pl-btn.nudge{animation:plnudge .6s ease-in-out 3}
@keyframes plnudge{50%{transform:scale(1.15)}}
.hc-sub{top:calc(56px + env(safe-area-inset-top));font-size:17px;color:#5b4a9e;text-shadow:none;opacity:.8}
.hc-card h1,.hc-card p{color:#fff}
.hc-card{background:rgba(70,50,140,.18)}
.hc-pop{-webkit-text-stroke:5px rgba(80,50,150,.35);paint-order:stroke fill}
`; document.head.appendChild(css);
const bar = document.createElement('div'); bar.className = 'pl-bar';
bar.innerHTML = `<button class="pl-btn" data-u><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><b>5</b></button><button class="pl-btn" data-t>+<b>1</b></button>`;
document.body.appendChild(bar);
const undoBtn = bar.querySelector('[data-u]'), tubeBtn = bar.querySelector('[data-t]');
for (const b of [undoBtn, tubeBtn]) b.addEventListener('pointerdown', (e) => e.stopPropagation());
undoBtn.addEventListener('click', () => undo());
tubeBtn.addEventListener('click', () => addTube());

// ---------------------------------------------------------------- geometry
const U = 0.5, GR = 0.3, LR = 0.262, BASE = 0.3, H = BASE + CAP * U + 0.38, SX = 0.98, RS = H + 1.05;
const GLASS = (() => {
  const pts = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * GR + 0.001, GR + Math.sin(a) * GR)); }
  pts.push(new THREE.Vector2(GR, H - 0.06), new THREE.Vector2(GR + 0.035, H));
  return new THREE.LatheGeometry(pts, 32);
})();
const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
const backMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false });
const RIM = new THREE.TorusGeometry(GR + 0.03, 0.035, 8, 32); RIM.rotateX(Math.PI / 2); RIM.translate(0, H, 0);
const rimMat = glossy('#ffffff', { roughness: 0.25 });
const SHINE = new THREE.PlaneGeometry(0.055, H - 0.75); SHINE.translate(-0.16, BASE + (H - 0.75) / 2 + 0.05, GR - 0.04);
const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
const LIQ = new THREE.CylinderGeometry(LR, LR, 1, 28, 1); LIQ.translate(0, 0.5, 0);
const CUP = new THREE.SphereGeometry(LR, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const CORK = rounded(0.5, 0.26, 0.5, 0.1); const corkMat = mat('#c98b55', { roughness: 0.75 });
const STREAM = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); STREAM.translate(0, -0.5, 0);
const shelfMat = mat('#ffffff', { roughness: 0.55 });

const world = new THREE.Group(); scene.add(world);
let tubes = [], shelves = [], T = [], history = [], moves = 0, undos = 5, extraUsed = false, selected = -1, anims = [], state = 'ready', recorded = false, nColors = 3, beatenShown = false;
let bounds = { l: -3, r: 3 }, camT = { y: 0, d: 10 }, stuckShown = false;

function makeTube(i) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(GR * 1.6, H - 0.2), backMat); back.position.set(0, H / 2 + 0.05, -0.12); g.add(back);
  const cup = new THREE.Mesh(CUP, LMAT[0]); cup.position.y = BASE; cup.castShadow = true; g.add(cup);
  const slots = [];
  for (let k = 0; k < CAP; k++) { const m = new THREE.Mesh(LIQ, LMAT[0]); m.position.y = BASE + k * U; m.castShadow = true; g.add(m); slots.push({ m, s: 0, c: -1 }); }
  const glass = new THREE.Mesh(GLASS, glassMat); glass.renderOrder = 2; g.add(glass);
  const rim = new THREE.Mesh(RIM, rimMat); g.add(rim);
  const shine = new THREE.Mesh(SHINE, shineMat); shine.renderOrder = 3; g.add(shine);
  const cork = new THREE.Mesh(CORK, corkMat); cork.visible = false; cork.castShadow = true; g.add(cork);
  world.add(g);
  return { i, g, cup, slots, cork, home: new THREE.Vector3(), lift: 0, busy: false, corkT: 0, squash: 0, wob: 0 };
}

function layout(instant) {
  const n = T.length, perRow = n <= 5 ? n : Math.ceil(n / Math.ceil(n / 7)), rows = Math.ceil(n / perRow);
  for (const s of shelves) world.remove(s); shelves = [];
  for (let r = 0; r < rows; r++) {
    const cnt = Math.min(perRow, n - r * perRow), w = cnt * SX + 0.3;
    const sh = new THREE.Mesh(rounded(w, 0.16, 1.0, 0.07), shelfMat); sh.position.set(0, -r * RS - 0.08, 0); sh.receiveShadow = true; sh.castShadow = true;
    world.add(sh); shelves.push(sh);
    for (let k = 0; k < cnt; k++) { const tb = tubes[r * perRow + k]; tb.home.set((k - (cnt - 1) / 2) * SX, -r * RS, 0); if (instant) tb.g.position.copy(tb.home); }
  }
  const W = perRow * SX + 0.5, Ht = (rows - 1) * RS + H + 0.4, tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dH = (Ht / 0.6) / (2 * tn), dW = (W / 0.94) / (2 * tn * camera.aspect);
  camT = { y: -(rows - 1) * RS / 2 + H / 2 - 0.15, d: Math.max(dH, dW, 7) };
  const half = tn * camT.d * camera.aspect; bounds = { l: -half + 0.4, r: half - 0.4 };
  if (instant) placeCam(1);
}
function placeCam(a) {
  camera.position.x = 0; camera.position.y = lerp(camera.position.y, camT.y + camT.d * 0.12, a); camera.position.z = lerp(camera.position.z, camT.d, a);
  camera.lookAt(0, camera.position.y - camT.d * 0.12 - 0.12, 0);
}

function syncTube(tb, keepAnim) {
  const t = T[tb.i];
  for (let k = 0; k < CAP; k++) {
    const sl = tb.slots[k];
    if (k < t.length) { sl.c = t[k]; sl.m.material = LMAT[t[k]]; if (!keepAnim) sl.s = 1; }
    else if (!keepAnim) { sl.c = -1; sl.s = 0; }
  }
  applySlots(tb);
}
function applySlots(tb) {
  for (const sl of tb.slots) { sl.m.visible = sl.s > 0.004; sl.m.scale.set(1, Math.max(0.001, sl.s) * U, 1); }
  tb.cup.visible = tb.slots[0].s > 0.004 || T[tb.i].length > 0; tb.cup.material = tb.slots[0].m.material;
}

// ---------------------------------------------------------------- level
function build() {
  const fk = F.k();
  nColors = clamp(Math.round((2.6 + level * 0.55) * fk), 3, 12);
  const seed = D.seed ? D.seed : level * 7919 + 13;
  const d = deal(nColors, seed, 2);
  T = d.T.map((t) => t.slice());
  for (const tb of tubes) world.remove(tb.g);
  tubes = T.map((_, i) => makeTube(i));
  tubes.forEach((tb) => syncTube(tb));
  history = []; moves = 0; undos = clamp(Math.round(5 / fk), 3, 6); extraUsed = false; selected = -1; anims = []; recorded = false; stuckShown = false; beatenShown = false;
  const bg = BGS[(level - 1) % BGS.length]; document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]);
  document.body.style.setProperty('--ui', ['#8a63e8', '#2f9fd8', '#ff7a59', '#2fb37a', '#e05aa8'][(level - 1) % 5]);
  layout(true);
  ui.levels(level); updateHud();
}
function updateHud() {
  const complete = T.filter((t) => t.length === CAP && run(t) === CAP).length;
  ui.progress(complete / nColors);
  ui.sub(D.isDaily ? `Daily · ${moves} moves` : `${moves} moves`);
  undoBtn.querySelector('b').textContent = undos; undoBtn.classList.toggle('off', undos <= 0 || !history.length);
  tubeBtn.querySelector('b').textContent = extraUsed ? 0 : 1; tubeBtn.classList.toggle('off', extraUsed);
}

// ---------------------------------------------------------------- picking
const v = new THREE.Vector3();
function tubeAt(x, y) {
  let best = -1, bd = 1e9;
  for (const tb of tubes) {
    v.copy(tb.home).setY(tb.home.y + 0.0).project(camera); const bx = (v.x + 1) / 2 * innerWidth, by = (1 - v.y) / 2 * innerHeight;
    v.copy(tb.home).setY(tb.home.y + H + 0.4).project(camera); const ty = (1 - v.y) / 2 * innerHeight;
    v.copy(tb.home).setX(tb.home.x + SX / 2).project(camera); const hw = Math.abs((v.x + 1) / 2 * innerWidth - bx);
    if (Math.abs(x - bx) <= hw && y >= ty - 30 && y <= by + 26) { const dd = Math.abs(x - bx); if (dd < bd) { bd = dd; best = tb.i; } }
  }
  return best;
}
addEventListener('pointerdown', (e) => { if (state !== 'play') return; const i = tubeAt(e.clientX, e.clientY); if (i >= 0) tap(i); else if (selected >= 0) { tubes[selected].lift = 0; selected = -1; } });

function tap(i) {
  const tb = tubes[i];
  if (tb.busy) return;
  if (selected < 0) {
    if (!T[i].length || done(T[i]) && T[i].length) { tb.wob = 1; tone(240, 0.08, 'triangle', 0.08, 0.8); return; }
    selected = i; tb.lift = 1; sfx.tap(); buzz(8); return;
  }
  if (selected === i) { tb.lift = 0; selected = -1; sfx.tap(); return; }
  const a = selected;
  if (legal(T, a, i)) { selected = -1; pour(a, i); return; }
  tubes[a].lift = 0; tubes[a].wob = 1; tone(200, 0.1, 'square', 0.06, 0.8); buzz(15);
  if (T[i].length && !done(T[i])) { selected = i; tb.lift = 1; } else selected = -1;
}

function pour(a, b, fromBot) {
  const n = pourN(T, a, b), c = top(T[a]), la = T[a].length, lb = T[b].length;
  T[a] = T[a].slice(0, -n); T[b] = T[b].concat(Array(n).fill(c));
  history.push([a, b, n]); moves++;
  const A = tubes[a], B = tubes[b]; A.busy = B.busy = true; A.lift = 0;
  for (let k = 0; k < n; k++) { const sl = B.slots[lb + k]; sl.c = c; sl.s = 0; sl.m.material = LMAT[c]; }
  // which side to come from: keep the tilted tube on screen
  let side = A.home.x >= B.home.x ? 1 : -1;
  if (B.home.x - 2.6 < bounds.l) side = 1; else if (B.home.x + 2.6 > bounds.r) side = -1;
  const stream = new THREE.Mesh(STREAM, LMAT[c]); stream.visible = false; world.add(stream);
  anims.push({ a, b, n, c, la, lb, t: 0, side, stream, from: A.g.position.clone(), poured: 0 });
  sfx.pick(1); updateHud();
}

const T1 = 0.3, T3 = 0.28, TU = 0.17;
function stepAnim(an, dt) {
  const A = tubes[an.a], B = tubes[an.b], T2 = TU * an.n + 0.08;
  an.t += dt;
  const th = an.side * 1.22, mouth = new THREE.Vector3(B.home.x + an.side * 0.1, B.home.y + H + 0.42, 0.25);
  const pose = new THREE.Vector3(mouth.x + Math.sin(th) * H, mouth.y - Math.cos(th) * H, 0.25);
  if (an.t < T1) {
    const k = ease(an.t / T1); A.g.position.lerpVectors(an.from, pose, k); A.g.rotation.z = th * k;
  } else if (an.t < T1 + T2) {
    A.g.position.copy(pose); A.g.rotation.z = th + Math.sin(an.t * 30) * 0.012;
    const p = clamp((an.t - T1 - 0.04) / (T2 - 0.08), 0, 1) * an.n;
    for (let k = 0; k < an.n; k++) { const f = clamp(p - k, 0, 1); A.slots[an.la - 1 - k].s = 1 - f; B.slots[an.lb + k].s = f; }
    const surf = B.home.y + BASE + (an.lb + p) * U;
    an.stream.visible = true; const w = 0.055 * Math.min(1, (an.t - T1) / 0.06) * (p >= an.n - 0.05 ? 0.4 : 1);
    an.stream.position.set(mouth.x, mouth.y - 0.02, 0.0); an.stream.scale.set(w, Math.max(0.05, mouth.y - surf), w);
    if (Math.floor(p * 3) !== an.poured) { an.poured = Math.floor(p * 3); tone(300 + Math.random() * 260, 0.05, 'sine', 0.05, 0.7); }
    B.squash = 0.02;
  } else if (an.t < T1 + T2 + T3) {
    an.stream.visible = false;
    for (let k = 0; k < an.n; k++) { A.slots[an.la - 1 - k].s = 0; B.slots[an.lb + k].s = 1; }
    const k = ease((an.t - T1 - T2) / T3); A.g.position.lerpVectors(pose, A.home, k); A.g.rotation.z = th * (1 - k);
  } else {
    A.g.position.copy(A.home); A.g.rotation.z = 0; world.remove(an.stream);
    A.busy = B.busy = false; syncTube(A); syncTube(B);
    B.squash = 1; afterPour(an.b);
    return true;
  }
  applySlots(A); applySlots(B);
  return false;
}
const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function afterPour(b) {
  const t = T[b], tb = tubes[b];
  if (t.length === CAP && run(t) === CAP) {
    tb.cork.visible = true; tb.corkT = 0.001; sortedTotal++; save.set('sorted', sortedTotal);
    const p = tb.home.clone().setY(tb.home.y + H); burst(world, p, [COLORS[t[0]], '#ffffff'], 22, { speed: 0.09, up: 0.1, size: 0.6, shape: 'sphere' });
    [72, 76, 79, 84].forEach((m, k) => setTimeout(() => note(m + (b % 3), 0.3, 0.14), k * 70)); buzz(25);
    const left = nColors - T.filter((x) => x.length === CAP && run(x) === CAP).length;
    ui.pop(left === 0 ? 'ALL DONE!' : ['NICE!', 'SWEET!', 'GREAT!', 'COOL!'][b % 4], '#fff', 34, 22);
  }
  updateHud();
  checkEnd();
}
function anyLegal() { for (let a = 0; a < T.length; a++) for (let b = 0; b < T.length; b++) if (legal(T, a, b)) return true; return false; }
function checkEnd() {
  if (state !== 'play') return;
  if (T.every(done) && !anims.length) {
    state = 'won'; if (!recorded) { recorded = true; F.level(true); }
    sfx.win(); ui.flash(0.5); confetti(world, new THREE.Vector3(0, camT.y + 1.5, 1), 90);
    level++; save.set('level', level);
    if (!beatenShown && D.beaten(level - 1)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 24); }
    D.won(level - 1, 'cleared level'); ui.win(level - 1, `${moves} moves`);
    return;
  }
  if (!anims.length && !anyLegal()) {
    if (undos > 0 && history.length || !extraUsed) {
      if (!stuckShown) { stuckShown = true; ui.pop('NO MOVES!', '#fff', 32, 22); const btn = !extraUsed ? tubeBtn : undoBtn; btn.classList.add('nudge'); setTimeout(() => btn.classList.remove('nudge'), 1900); }
    } else lose();
  }
}
function lose() {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, T.filter((x) => x.length === CAP && run(x) === CAP).length / nColors); }
  sfx.fail(); buzz([30, 40, 30]); ui.lose('STUCK!', 'No pours left');
}

function undo() {
  if (state !== 'play' || undos <= 0 || !history.length || anims.length) return;
  const [a, b, n] = history.pop(), c = top(T[b]);
  T[b] = T[b].slice(0, -n); T[a] = T[a].concat(Array(n).fill(c)); undos--; moves++;
  for (const tb of tubes) { tb.cork.visible = done(T[tb.i]) && T[tb.i].length > 0; syncTube(tb); }
  if (selected >= 0) { tubes[selected].lift = 0; selected = -1; }
  tubes[a].squash = 1; tubes[b].squash = 1; tone(420, 0.1, 'triangle', 0.1, 0.7); stuckShown = false; updateHud();
}
function addTube() {
  if (state !== 'play' || extraUsed || anims.length) return;
  extraUsed = true; T.push([]); const tb = makeTube(T.length - 1); tubes.push(tb); syncTube(tb);
  layout(false); tb.g.position.copy(tb.home).setY(tb.home.y + 3); tb.squash = 1; stuckShown = false;
  burst(world, tb.home.clone().setY(tb.home.y + 1), ['#ffffff', '#cfc4ff'], 14, { speed: 0.07, size: 0.5, shape: 'sphere' });
  sfx.coin(); updateHud();
}

// ---------------------------------------------------------------- bot (follows the solver)
let plan = null, planKey = '';
function bot() {
  if (state !== 'play' || anims.length) return;
  const k = JSON.stringify(T);
  if (!plan || planKey !== k) { plan = solve(T, 30000); planKey = k; }
  if (!plan || !plan.length) {
    if (undos > 0 && history.length) { undo(); plan = null; return; }
    if (!extraUsed) { addTube(); plan = null; return; }
    return;
  }
  const [a, b] = plan[0];
  if (selected !== a) { if (selected >= 0) tap(selected); tap(a); return; }
  tap(b); plan.shift(); planKey = JSON.stringify(T);
}

// ---------------------------------------------------------------- loop
ui.onTap((which) => { if (which === 'start') { state = 'play'; return; } build(); state = 'play'; });
build(); ui.start();
addEventListener('resize', () => layout(false));
let time = 0;
loop((dt) => {
  time += dt / 60;
  placeCam(0.08 * dt);
  for (let i = anims.length - 1; i >= 0; i--) if (stepAnim(anims[i], dt / 60)) anims.splice(i, 1);
  for (const tb of tubes) {
    if (!tb.busy) {
      const ty = tb.home.y + (selected === tb.i ? 0.45 : 0);
      tb.g.position.x = lerp(tb.g.position.x, tb.home.x, 0.25 * dt); tb.g.position.y = lerp(tb.g.position.y, ty, 0.28 * dt); tb.g.position.z = lerp(tb.g.position.z, 0, 0.3 * dt);
      tb.g.rotation.z = tb.wob > 0 ? Math.sin(time * 50) * 0.07 * tb.wob : 0;
    }
    tb.wob = Math.max(0, tb.wob - 0.05 * dt);
    tb.squash = Math.max(0, tb.squash - 0.06 * dt);
    const sq = Math.sin(tb.squash * Math.PI) * 0.08; tb.g.scale.set(1 + sq, 1 - sq, 1 + sq);
    if (tb.corkT > 0) { tb.corkT = Math.min(1, tb.corkT + 0.05 * dt); const k = tb.corkT; tb.cork.position.y = H + 0.08 + (1 - k) * (1 - k) * 1.6; tb.cork.rotation.y = (1 - k) * 4; }
    else if (tb.cork.visible) tb.cork.position.y = H + 0.08;
  }
  if (state === 'play' && !anims.length) checkEnd();
});

window.__game = { get state() { return state; }, get level() { return level; }, get score() { return sortedTotal; }, bot, get tubes() { return T; } };

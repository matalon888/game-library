// Dialock — a glowing core is locked inside nested dials. Drag a dial to spin it; line every gap up with the exit slot
// and the core slides free. Dials lock in layer by layer from the outside. Later dials carry cogs: turning a dial with a
// cog also turns the dial in the cog's colour. Finish within the move limit.
import { THREE, createStage, createUI, loop, glossy, mat, rounded, burst, confetti, sfx, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
const B = board({ game: 'dialock', label: 'Locks cracked', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Dialock: Spin Lock Puzzle';
const S = createStage({ fov: 34, shadowSize: 7 });
const { scene, camera, sun, hemi } = S;
sun.position.set(-3, 14, 5); sun.intensity = 1.4; hemi.intensity = 1.3;
const ui = createUI({ title: 'DIALOCK', hint: 'Drag the dials to line up the gaps', hand: '👆', score: false });
const D = daily('dialock', ui, { name: NAME });
const save = store('dialock');
const F = flow('dialock');
let level = save.get('level', 1), solvedTotal = save.get('solved', 0);

const RING_COLORS = ['#ff5d8f', '#ffaf2e', '#2fb5ff', '#8a63ff', '#2fcf8a', '#ff7a45'];
const BGS = [['#ffe3cf', '#fff6ea'], ['#dff1ff', '#f4fbff'], ['#f0e2ff', '#fff4fb'], ['#dcf7e9', '#f6fff9'], ['#ffe0ea', '#fff5f0']];
const css = document.createElement('style'); css.textContent = `
.hc-card h1,.hc-card p{color:#fff}
.hc-card{background:rgba(110,70,40,.2)} .hc-card.dim{background:rgba(70,40,40,.42)}
.hc-pop{-webkit-text-stroke:7px rgba(110,70,40,.7);paint-order:stroke fill}
.dl-tip{position:fixed;left:0;right:0;bottom:calc(46px + env(safe-area-inset-bottom));text-align:center;color:#7a5137;font:700 17px 'Baloo 2',system-ui;opacity:.75;pointer-events:none;z-index:5;padding:0 24px}
.dl-moves{position:fixed;top:calc(58px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:rgba(255,255,255,.88);color:#7a5137;font:800 20px 'Baloo 2',system-ui;padding:2px 18px 0;border-radius:20px;box-shadow:0 4px 0 rgba(110,70,40,.14);z-index:5;pointer-events:none;white-space:nowrap}
.dl-moves b{color:var(--ui,#ff5d8f);font-size:24px}
.dl-moves.low b{color:#ff3b5c}
.dl-moves.bump{animation:dlb .3s}
@keyframes dlb{50%{transform:translateX(-50%) scale(1.15)}}
`; document.head.appendChild(css);
const movesEl = document.createElement('div'); movesEl.className = 'dl-moves'; document.body.appendChild(movesEl);
const tipEl = document.createElement('div'); tipEl.className = 'dl-tip'; document.body.appendChild(tipEl);

// ---------------------------------------------------------------- geometry
const STEPS = 12, STEP = Math.PI * 2 / STEPS, GAP = 0.62, RW = 0.4, RT = 0.34, R0 = 0.95, DR = 0.6;
const rIn = (i) => R0 + i * DR, rOut = (i) => R0 + i * DR + RW;
function ringGeo(i) {
  const a = rIn(i), b = rOut(i), g0 = GAP / 2 * (R0 + RW / 2) / (a + RW / 2) * 1.0 + 0.12, s = new THREE.Shape();
  s.absarc(0, 0, b, g0, Math.PI * 2 - g0, false); s.absarc(0, 0, a, Math.PI * 2 - g0, g0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: RT - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 64 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.06, 0);
  return g;   // the gap is centred on local +X
}
const base = new THREE.Group(); scene.add(base);
let maxR = 3;
function buildBase(n) {
  base.clear();
  maxR = rOut(n - 1) + 0.55;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(maxR, maxR + 0.05, 0.3, 72), mat('#ffffff', { roughness: 0.5 })); plate.position.y = -0.15; plate.receiveShadow = true; plate.castShadow = true; base.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(maxR, 0.09, 12, 72), glossy('#f1e4d8')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.0; base.add(rim);
  // exit channel toward the top of the screen (-Z)
  const len = maxR + 0.2, ch = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, len), mat('#e9dccf', { roughness: 0.8 })); ch.position.set(0, 0.005, -len / 2); ch.receiveShadow = true; base.add(ch);
  const rl = maxR - rOut(n - 1) + 0.05; for (const sx of [-1, 1]) { const w = new THREE.Mesh(rounded(0.1, 0.12, rl, 0.04), glossy('#d9c6b4')); w.position.set(sx * 0.4, 0.05, -(rOut(n - 1) + rl / 2 + 0.02)); base.add(w); }
  // a tiny flag at the exit
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), mat('#b08968')); post.position.set(0.5, 0.35, -maxR - 0.05); base.add(post);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.02), glossy('#36c98a')); flag.position.set(0.68, 0.58, -maxR - 0.05); base.add(flag);
}
const coreMat = glossy('#ffd23f', { emissive: '#ff9f1c', emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.3 });
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), coreMat); core.castShadow = true; scene.add(core);
const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.25, depthWrite: false })); scene.add(coreGlow);
const COG = (() => { const g = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16); return g; })();
const TOOTH = new THREE.BoxGeometry(0.08, 0.1, 0.1);

// ---------------------------------------------------------------- level
let rings = [], links = [], pos = [], movesLeft = 0, par = 0, state = 'ready', recorded = false, drag = null, anim = 0, escapeT = 0, locked = 0, beatenShown = false, movesUsed = 0;
function design(lv, seed, fk) {
  const R = rng(seed);
  const n = clamp(lv <= 1 ? 2 : lv <= 3 ? 3 : lv <= 7 ? 4 : 5, 2, 6);
  let nl = lv <= 2 ? 0 : lv <= 4 ? 1 : Math.min(n - 1 + (lv > 10 ? 1 : 0), Math.round((1 + (lv - 4) * 0.35) * fk));
  nl = clamp(nl, 0, n * (n - 1) / 2);
  const order = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const L = [], have = new Set();
  for (let t = 0; t < 40 && L.length < nl; t++) {
    const a = Math.floor(R() * n), b = Math.floor(R() * n); if (a === b) continue;
    const [from, to] = order.indexOf(a) < order.indexOf(b) ? [a, b] : [b, a]; const key = from + '>' + to; if (have.has(key)) continue;
    if (Math.abs(from - to) > 2 && R() < 0.6) continue;
    have.add(key); L.push({ from, to, k: R() < 0.5 ? 1 : -1, ang: R() * Math.PI * 2 });
  }
  // scramble: drive some rings by random amounts; the solved state is reachable by construction
  for (let tries = 0; tries < 60; tries++) {
    const x = [...Array(n)].map(() => R() < (lv <= 2 ? 1 : 0.8) ? (1 + Math.floor(R() * 5)) * (R() < 0.5 ? 1 : -1) : 0);
    const p = x.slice(); for (const l of L) p[l.to] += l.k * x[l.from];
    const pm = p.map((v) => ((v % STEPS) + STEPS) % STEPS);
    if (pm.every((v) => v !== 0)) { const sol = solveFor(pm, L, n, order); return { n, L, pos: pm, order, par: sol.filter((v) => v).length }; }
  }
  return { n, L: [], pos: [...Array(n)].map((_, i) => 1 + i), order, par: n };
}
function solveFor(p, L, n, order) {   // drive amounts x with (I + links) x = -p (mod 12); links only go forward in `order`
  const x = Array(n).fill(0);
  for (const i of order) {
    let b = -p[i]; for (const l of L) if (l.to === i) b -= l.k * x[l.from];
    x[i] = ((b % STEPS) + STEPS + STEPS / 2) % STEPS - STEPS / 2;   // shortest turn
  }
  return x;
}
let lvl = null;
function build() {
  const fk = F.k(), seed = D.seed ? D.seed : level * 6151 + 3;
  lvl = design(level, seed, fk);
  for (const r of rings) scene.remove(r.g);
  buildBase(lvl.n);
  rings = []; pos = lvl.pos.slice(); links = lvl.L;
  for (let i = 0; i < lvl.n; i++) {
    const g = new THREE.Group(), m = glossy(RING_COLORS[i], { roughness: 0.22, emissive: RING_COLORS[i], emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(ringGeo(i), m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    // gap end caps: small white key notches either side of the gap
    for (const sgn of [-1, 1]) { const a = sgn * (GAP / 2 * (R0 + RW / 2) / (rIn(i) + RW / 2) + 0.12) ; const k = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glossy('#ffffff')); k.position.set(Math.cos(a) * (rIn(i) + RW / 2), RT + 0.01, -Math.sin(a) * (rIn(i) + RW / 2)); g.add(k); }
    scene.add(g);
    rings.push({ g, m, ang: 0, vis: 0, flash: 0, bounce: 0, cogs: [] });
  }
  for (const l of links) {   // cog on the driving ring, coloured like the ring it drives
    const r = rings[l.from], c = new THREE.Group(), cm = glossy(RING_COLORS[l.to], { roughness: 0.25 });
    const body = new THREE.Mesh(COG, cm); body.castShadow = true; c.add(body);
    for (let t = 0; t < 8; t++) { const th = new THREE.Mesh(TOOTH, cm); th.position.set(Math.cos(t * Math.PI / 4) * 0.17, 0, Math.sin(t * Math.PI / 4) * 0.17); th.rotation.y = -t * Math.PI / 4; c.add(th); }
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 10), glossy(l.k > 0 ? '#ffffff' : '#2b2d42')); c.add(dot);
    const rr = rIn(l.from) + RW / 2, a = clamp(l.ang, 0.9, Math.PI * 2 - 0.9);
    c.position.set(Math.cos(a) * rr, RT + 0.06, -Math.sin(a) * rr); r.g.add(c); r.cogs.push({ c, k: l.k });
  }
  for (let i = 0; i < rings.length; i++) rings[i].vis = rings[i].ang = pos[i] * STEP;
  movesLeft = lvl.par + clamp(Math.round((level <= 3 ? 3 : 2) / fk), 1, 4); par = lvl.par; movesUsed = 0;
  state = state === 'won' || state === 'lost' ? 'play' : state; recorded = false; drag = null; anim = 0; escapeT = 0; beatenShown = false;
  core.position.set(0, 0.5, 0); core.scale.setScalar(1); coreGlow.position.copy(core.position);
  const bg = BGS[(level - 1) % BGS.length]; document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]);
  document.body.style.setProperty('--ui', RING_COLORS[(level - 1) % RING_COLORS.length]);
  tipEl.textContent = links.length ? 'A cog turns the dial of its colour too ⚙️' : level <= 2 ? 'Line up every gap with the exit slot' : '';
  fit(); ui.levels(level); updateLocks(true); hud();
}
function fit() {
  const tn = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), ang = 1.08;
  const d = Math.max((maxR * 2 + 0.8) / (2 * tn * camera.aspect * 0.95), (maxR * 2 + 2) / (2 * tn * 0.62));
  camera.position.set(0, Math.sin(ang) * d, Math.cos(ang) * d + 0.25); camera.lookAt(0, 0, 0.25);
}
addEventListener('resize', fit);
function hud() {
  movesEl.innerHTML = `MOVES <b>${movesLeft}</b>`; movesEl.classList.toggle('low', movesLeft <= 1);
  movesEl.classList.remove('bump'); void movesEl.offsetWidth; movesEl.classList.add('bump');
}
// rings lock in from the outside: ring i is locked when it and every ring outside it shows its gap at the exit
function updateLocks(silent) {
  let k = 0; for (let i = rings.length - 1; i >= 0; i--) { if (pos[i] % STEPS === 0) k++; else break; }
  if (!silent && k > locked) { for (let i = rings.length - k; i < rings.length - locked; i++) { rings[i].bounce = 1; } note(67 + k * 3, 0.25, 0.14); buzz(12); if (k < rings.length) ui.pop(k === 1 ? 'CLICK!' : `${k} LOCKED!`, '#fff', 30, 24); }
  locked = k; ui.progress(k / rings.length);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -RT), hit = new THREE.Vector3();
function at(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
const angOf = (p) => Math.atan2(-p.z, p.x);
addEventListener('pointerdown', (e) => {
  if (state !== 'play' || anim > 0) return; const p = at(e.clientX, e.clientY); if (!p) return;
  const r = Math.hypot(p.x, p.z); let best = -1, bd = 0.45;
  for (let i = 0; i < rings.length; i++) { const d = Math.abs(r - (rIn(i) + RW / 2)); if (d < bd) { bd = d; best = i; } }
  if (best < 0) return;
  drag = { i: best, a0: angOf(p), delta: 0, last: angOf(p) }; sfx.tap(); buzz(5);
  for (const l of links) if (l.from === best) rings[l.to].flash = 1;
  rings[best].flash = 0.6;
});
addEventListener('pointermove', (e) => {
  if (!drag) return; const p = at(e.clientX, e.clientY); if (!p) return;
  let a = angOf(p), d = a - drag.last; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; drag.last = a; drag.delta += d;
  const s = Math.round(drag.delta / STEP); if (s !== drag.tick) { if (drag.tick !== undefined) tone(900 + (s % 2) * 120, 0.025, 'square', 0.03, 1); drag.tick = s; }
});
// a tap (no real turn) turns the dial one notch clockwise; a drag turns it as far as it was dragged
addEventListener('pointerup', () => { if (!drag) return; const { i, delta } = drag; drag = null; commit(i, Math.abs(delta) < STEP * 0.35 ? -1 : Math.round(delta / STEP)); });

function commit(i, s) {
  for (let k = 0; k < rings.length; k++) rings[k].ang = pos[k] * STEP;
  if (((s % STEPS) + STEPS) % STEPS === 0) return;
  drive(i, s); movesLeft--; movesUsed++; hud(); anim = 0.25;
  tone(520, 0.06, 'triangle', 0.1, 1.3);
  updateLocks(false);
  if (pos.every((v) => v === 0)) return win();
  if (movesLeft <= 0) return lose();
}
function drive(i, s) {
  pos[i] = ((pos[i] + s) % STEPS + STEPS) % STEPS; rings[i].ang += s * STEP;
  for (const l of links) if (l.from === i) { pos[l.to] = ((pos[l.to] + l.k * s) % STEPS + STEPS) % STEPS; rings[l.to].ang += l.k * s * STEP; rings[l.to].flash = 1; }
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  solvedTotal++; save.set('solved', solvedTotal); escapeT = 0.0001;
  sfx.win(); buzz([20, 30, 60]);
  setTimeout(() => { confetti(scene, new THREE.Vector3(0, 1.5, -maxR), 90); ui.flash(0.5); }, 650);
  level++; save.set('level', level);
  if (!beatenShown && D.beaten(level - 1)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 24); }
  D.won(level - 1, 'cracked lock'); setTimeout(() => ui.win(level - 1, movesUsed <= par ? `Perfect · ${movesUsed} moves` : `${movesUsed} moves`), 500);
}
function lose() {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, locked / rings.length); }
  sfx.fail(); buzz([30, 40, 30]); ui.lose('OUT OF MOVES', `${locked}/${rings.length} dials locked`);
}

// ---------------------------------------------------------------- bot (solves the ring equations)
function bot() {
  if (state !== 'play' || drag || anim > 0) return;
  const x = solveFor(pos, links, rings.length, lvl.order);
  const i = lvl.order.find((k) => x[k] !== 0); if (i === undefined) return;
  commit(i, x[i]);
}

// ---------------------------------------------------------------- loop
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; return; } state = 'play'; build(); });
build(); ui.start();
let time = 0;
loop((dt) => {
  const h = dt / 60; time += h; anim = Math.max(0, anim - h);
  rings.forEach((r, i) => {
    let target = r.ang;
    if (drag) { if (drag.i === i) target = r.ang + drag.delta; for (const l of links) if (l.from === drag.i && l.to === i) target = r.ang + l.k * drag.delta; }
    r.vis = lerp(r.vis, target, drag ? 0.5 : 0.22 * dt);
    r.g.rotation.y = r.vis + Math.PI / 2;
    for (const c of r.cogs) c.c.rotation.y = -r.vis * 3 * c.k;
    r.flash = Math.max(0, r.flash - h * 1.8); r.bounce = Math.max(0, r.bounce - h * 2.5);
    const isLocked = i >= rings.length - locked;
    r.m.emissiveIntensity = r.flash * 0.35 + (isLocked ? 0.12 + Math.sin(time * 4) * 0.04 : 0);
    r.g.position.y = Math.sin(r.bounce * Math.PI) * 0.25 + (escapeT > 0 ? Math.min(1, escapeT * 1.5) * -0.02 : 0);
  });
  // core: bob, then escape through the channel and hop out
  if (escapeT > 0) {
    escapeT += h; const k = clamp(escapeT / 0.7, 0, 1);
    core.position.set(0, 0.5 + Math.sin(clamp((escapeT - 0.55) / 0.5, 0, 1) * Math.PI) * 1.6, -(k * k) * (maxR + 0.3));
    core.rotation.x += 0.2 * dt; core.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.2);
  } else { core.position.y = 0.5 + Math.sin(time * 2.4) * 0.07; core.rotation.y += 0.02 * dt; core.rotation.x = Math.sin(time) * 0.2; }
  coreGlow.position.copy(core.position); coreGlow.scale.setScalar(1 + Math.sin(time * 3) * 0.08 + locked / Math.max(1, rings.length) * 0.4);
});

window.__game = { get state() { return state; }, get level() { return level; }, get score() { return solvedTotal; }, bot, get pos() { return pos; } };

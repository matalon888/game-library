// Oche Ace — original darts duel. Drag to aim (your hand sways), release to throw. Three rounds of three darts vs a rival.
import { THREE, createStage, createUI, input, loop, mat, glossy, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const V3 = THREE.Vector3;
const S = createStage({ fov: 44, shadowSize: 4 });
const { scene, camera, sun, hemi } = S;
sun.position.set(2, 6, 9); hemi.intensity = 1.3; sun.intensity = 1.25;
const ui = createUI({ title: 'OCHE<br>ACE', hint: 'Drag to aim · release to throw', hand: '👆', score: false });
const D = daily('ocheace', ui, { name: 'Oche Ace: Darts Duel' });
ui.els.start.classList.add('dim');
const save = store('ocheace');
const F = flow('ocheace');
const B = board({ game: 'oche-ace', label: 'Points in won matches', limits: { maxRun: 600, maxPerSec: 25 }, mode: 'sum', corner: 'bl' });
let level = save.get('level', 1), best = save.get('best', 0), total = 0;

const THEMES = [
  { bg: ['#ffd1dc', '#ffe9b8'], wall: '#ffb3c7', back: '#ff5d8f', ui: '#ff5d8f', flight: '#ff5d8f', barrel: '#ffd23f' },
  { bg: ['#b8f2e6', '#e3f6ff'], wall: '#9fe3d3', back: '#2a9d8f', ui: '#2a9d8f', flight: '#3ab795', barrel: '#ff6b6b' },
  { bg: ['#d7c8ff', '#ffd6f5'], wall: '#c4b0ff', back: '#7b5cff', ui: '#7b5cff', flight: '#7b5cff', barrel: '#ffd166' },
  { bg: ['#ffe0b3', '#fff6d6'], wall: '#ffcf8f', back: '#ff8c42', ui: '#ff8c42', flight: '#ff8c42', barrel: '#3a86ff' },
];
let TH = THEMES[0];
const RIVALS = [['Big Lou', '🧔', '#3a86ff'], ['Dottie', '👵', '#52b788'], ['Ziggy', '🧑‍🎤', '#7b5cff'], ['Mags', '👩‍🦰', '#ff8c42'], ['Pip', '🧒', '#ff4d6d'], ['Rocco', '👨‍🦲', '#2b2d42'], ['Juno', '👩‍🚀', '#00a6fb'], ['Hank', '🤠', '#9a6b4a']];

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.oa-hud{position:fixed;top:calc(58px + env(safe-area-inset-top));left:10px;right:10px;display:flex;justify-content:space-between;align-items:stretch;gap:8px;z-index:6;pointer-events:none}
.oa-box{flex:1;max-width:150px;background:rgba(255,255,255,.92);color:#2b2d42;border-radius:16px;padding:5px 10px 6px;box-shadow:0 4px 0 rgba(0,0,0,.12);transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column}
.oa-box.on{transform:scale(1.06);box-shadow:0 0 0 4px var(--ui),0 4px 0 rgba(0,0,0,.12)}
.oa-box .n{font-size:13px;font-weight:800;opacity:.65;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oa-box .s{font-size:34px;font-weight:800;line-height:1}
.oa-box .d{font-size:13px;letter-spacing:2px;line-height:1}
.oa-box.r{text-align:right}
.oa-mid{align-self:center;text-align:center;font-weight:800;font-size:15px;line-height:1.05;text-shadow:0 2px 0 rgba(0,0,0,.15)}
.oa-mid b{display:block;font-size:24px}
.oa-turn{position:fixed;left:50%;top:68.5%;transform:translateX(-50%);z-index:6;pointer-events:none;font-weight:800;font-size:19px;padding:4px 18px;border-radius:30px;background:var(--ui);box-shadow:0 5px 0 rgba(0,0,0,.15);white-space:nowrap;transition:opacity .2s}
.hc-pop{-webkit-text-stroke:6px rgba(43,45,66,.75);paint-order:stroke fill}
.hc-card h1{-webkit-text-stroke:3px rgba(43,45,66,.2);paint-order:stroke fill}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const hud = H(`<div class="oa-hud"><div class="oa-box" data-y><span class="n">YOU</span><span class="s">0</span><span class="d"></span></div><div class="oa-mid">ROUND<b>1/3</b></div><div class="oa-box r" data-r><span class="n">RIVAL</span><span class="s">0</span><span class="d"></span></div></div>`);
const turnEl = H('<div class="oa-turn" style="opacity:0">YOUR TURN</div>');
const boxY = hud.querySelector('[data-y]'), boxR = hud.querySelector('[data-r]'), midEl = hud.querySelector('.oa-mid b');

// ---------------------------------------------------------------- board
const R = 1.22;                 // radius of the outer double wire, world units
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const RING = { bull: 6.35 / 170, obull: 15.9 / 170, tIn: 99 / 170, tOut: 107 / 170, dIn: 162 / 170 };
function boardTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), C = 512, K = 405;   // K = px for r=1
  g.fillStyle = '#1d1e2c'; g.beginPath(); g.arc(C, C, 512, 0, 7); g.fill();
  const W = Math.PI / 10;
  for (let i = 0; i < 20; i++) {
    const a0 = -Math.PI / 2 - W / 2 + i * W, a1 = a0 + W, dark = i % 2 === 0;
    const band = (r0, r1, col) => { g.fillStyle = col; g.beginPath(); g.arc(C, C, r1 * K, a0, a1); g.arc(C, C, r0 * K, a1, a0, true); g.closePath(); g.fill(); };
    band(RING.obull, 1, dark ? '#2b2d42' : '#fff1d6');
    band(RING.tIn, RING.tOut, dark ? '#ff4d6d' : '#2ec4b6');
    band(RING.dIn, 1, dark ? '#ff4d6d' : '#2ec4b6');
  }
  g.fillStyle = '#2ec4b6'; g.beginPath(); g.arc(C, C, RING.obull * K, 0, 7); g.fill();
  g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(C, C, RING.bull * K, 0, 7); g.fill();
  g.strokeStyle = 'rgba(220,224,235,.9)'; g.lineWidth = 2.2;
  for (const r of [RING.bull, RING.obull, RING.tIn, RING.tOut, RING.dIn, 1]) { g.beginPath(); g.arc(C, C, r * K, 0, 7); g.stroke(); }
  for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 - W / 2 + i * W; g.beginPath(); g.moveTo(C + Math.cos(a) * RING.obull * K, C + Math.sin(a) * RING.obull * K); g.lineTo(C + Math.cos(a) * K, C + Math.sin(a) * K); g.stroke(); }
  g.fillStyle = '#ffffff'; g.font = '800 58px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 + i * W; g.save(); g.translate(C + Math.cos(a) * 1.12 * K, C + Math.sin(a) * 1.12 * K); g.rotate(a + Math.PI / 2); g.fillText(ORDER[i], 0, 0); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const boardG = new THREE.Group(); boardG.position.set(0, 0.55, 0); scene.add(boardG);
const BR = R * 1.26;
const face = new THREE.Mesh(new THREE.CircleGeometry(BR, 96), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.85 }));
face.position.z = 0.12; face.receiveShadow = true; boardG.add(face);
const rim = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, 0.24, 96, 1, true), mat('#1d1e2c')); rim.rotation.x = Math.PI / 2; boardG.add(rim);
const trim = new THREE.Mesh(new THREE.TorusGeometry(BR + 0.04, 0.07, 12, 96), glossy('#c9ccd6', { metalness: 0.6, roughness: 0.25 })); trim.position.z = 0.1; boardG.add(trim);
const backing = new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.32, BR + 0.32, 0.12, 8), mat('#fff')); backing.rotation.x = Math.PI / 2; backing.rotation.y = Math.PI / 8; backing.position.z = -0.08; backing.castShadow = true; boardG.add(backing);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat('#fff', { roughness: 0.95 })); wall.position.set(0, 0, -0.2); wall.receiveShadow = true; scene.add(wall);
// wall decor: soft rounded panels + two lamps
const decor = new THREE.Group(); scene.add(decor);
const panelGeo = new THREE.PlaneGeometry(1.2, 6);
for (let i = -6; i <= 6; i++) { const p = new THREE.Mesh(panelGeo, mat('#ffffff', { transparent: true, opacity: 0.14 })); p.position.set(i * 1.5, 0, -0.18); decor.add(p); }
{ // soft spotlight glow behind the board
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(0.55, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); const glow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  glow.position.set(0, 0.6, -0.17); decor.add(glow);
}
// floor + oche strip visible at the bottom
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), mat('#e8d5c4')); floor.rotation.x = -Math.PI / 2; floor.position.y = -3.6; floor.receiveShadow = true;

// reticle
const ret = new THREE.Group();
ret.add(new THREE.Mesh(new THREE.RingGeometry(0.075, 0.105, 32), new THREE.MeshBasicMaterial({ color: '#2b2d42', transparent: true, opacity: 0.85 })));
ret.add(new THREE.Mesh(new THREE.RingGeometry(0.083, 0.097, 32), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
const dot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' })); ret.add(dot);
for (let i = 0; i < 4; i++) { const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.06), new THREE.MeshBasicMaterial({ color: '#ffffff' })); const a = i * Math.PI / 2; tick.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0); tick.rotation.z = a + Math.PI / 2; ret.add(tick); }
ret.position.z = 0.14; boardG.add(ret);

// ---------------------------------------------------------------- dart model
function flightGeo() { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.17, 0.06); s.quadraticCurveTo(0.2, 0.2, 0.15, 0.27); s.lineTo(0.02, 0.24); s.lineTo(0, 0.2); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; }
const FG = flightGeo();
function makeDart(col, barrel) {
  const d = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.2, 10), glossy('#d9dde6', { metalness: 0.8, roughness: 0.2 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.1;
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.3, 14), glossy(barrel, { metalness: 0.55, roughness: 0.25 })); br.rotation.x = Math.PI / 2; br.position.z = 0.15;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.1, 14), mat('#2b2d42')); grip.rotation.x = Math.PI / 2; grip.position.z = 0.15;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.26, 8), mat('#ffffff')); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.42;
  const fm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(FG, fm); f.rotation.z = i * Math.PI / 2; f.position.z = 0.36; const piv = new THREE.Group(); piv.add(f); piv.rotation.z = i * Math.PI / 2 + Math.PI / 4; d.add(piv); f.rotation.z = 0; }
  d.add(tip, br, grip, shaft); d.traverse(o => o.castShadow = true);
  return d;
}

// ---------------------------------------------------------------- scoring
function scoreAt(nx, ny) {                       // normalised board coords (1 = outer double wire), +y = up
  const r = Math.hypot(nx, ny);
  if (r > 1) return { pts: 0, label: 'MISS', mult: 0 };
  if (r < RING.bull) return { pts: 50, label: 'BULLSEYE!', mult: 2 };
  if (r < RING.obull) return { pts: 25, label: 'BULL 25', mult: 1 };
  let th = Math.atan2(nx, ny); th = (th + Math.PI / 20 + 4 * Math.PI) % (Math.PI * 2);
  const n = ORDER[Math.floor(th / (Math.PI / 10)) % 20];
  if (r >= RING.tIn && r < RING.tOut) return { pts: 3 * n, label: 'TREBLE ' + n, mult: 3 };
  if (r >= RING.dIn) return { pts: 2 * n, label: 'DOUBLE ' + n, mult: 2 };
  return { pts: n, label: '' + n, mult: 1 };
}
const T20 = new THREE.Vector2(0, (RING.tIn + RING.tOut) / 2);
const gauss = (r = Math.random) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// ---------------------------------------------------------------- game state
let state = 'ready', phase = 'you', round = 1, rounds = 3, dartsLeft = 3, aiLeft = 3, you = 0, riv = 0, turnPts = 0, recorded = false, beatenShown = false;
let aim = new THREE.Vector2(0, 0.45), aiming = false, swayAmp = 0.06, aiSigma = 0.2, aiBullBias = 0, rival = RIVALS[0], tPhase = 0, waitT = 0, shake = 0;
let flying = [], stuck = [], held = null;
const swayT0 = Math.random() * 100;
function sway(t) { t += swayT0; return new THREE.Vector2((Math.sin(1.3 * t) + 0.5 * Math.sin(3.1 * t + 1.3)) / 1.5, (Math.sin(1.7 * t + 0.7) + 0.45 * Math.sin(2.6 * t)) / 1.45).multiplyScalar(swayAmp); }
const now = () => performance.now() / 1000;

function boardWorld(nx, ny) { return new V3(nx * R, ny * R + boardG.position.y, 0.13); }
const HOLD_POS = new V3(0.25, -1.05, 5.3);

function buildLevel() {
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', TH.ui);
  wall.material.color.set(TH.wall); backing.material.color.set(TH.back);
  const r = rng((D.seed || level * 4241) + 7), fk = F.k();
  rival = RIVALS[Math.floor(r() * RIVALS.length)];
  aiSigma = clamp((0.215 - level * 0.012) / fk, 0.07, 0.28);                 // rival skill: tighter grouping each level
  aiBullBias = level >= 4 ? 0.25 : 0;
  swayAmp = clamp((0.05 + level * 0.006) * fk, 0.045, 0.14);                 // your hand sway grows each level
  rounds = 3; round = 1; you = 0; riv = 0; recorded = false;
  clearDarts(true);
  ui.levels(level); ui.progress(0);
  boxR.querySelector('.n').textContent = rival[1] + ' ' + rival[0].toUpperCase();
  boxY.querySelector('.n').textContent = '🎯 YOU';
  startPlayerTurn(true);
}
function clearDarts(instant) {
  for (const d of stuck) { if (instant) scene.remove(d.m); else flying.push({ m: d.m, out: true, t: 0, from: d.m.position.clone() }); }
  stuck = [];
}
function pips(n, col) { return '<span style="color:' + col + '">' + '➤'.repeat(n) + '</span><span style="opacity:.2">' + '➤'.repeat(3 - n) + '</span>'; }
function hudUpdate() {
  boxY.querySelector('.s').textContent = you; boxR.querySelector('.s').textContent = riv;
  boxY.querySelector('.d').innerHTML = pips(phase === 'you' ? dartsLeft : 0, TH.flight);
  boxR.querySelector('.d').innerHTML = pips(phase === 'ai' ? aiLeft : 0, rival[2]);
  boxY.classList.toggle('on', phase === 'you'); boxR.classList.toggle('on', phase === 'ai');
  midEl.textContent = round > 3 ? 'EXTRA' : `${round}/3`;
  const thrown = (round - 1) * 6 + (phase === 'you' ? 3 - dartsLeft : 3 + 3 - aiLeft);
  ui.progress(thrown / (rounds * 6));
}
function startPlayerTurn(first) {
  phase = 'you'; dartsLeft = 3; turnPts = 0; aiming = false;
  turnEl.textContent = round > 3 ? 'EXTRA ROUND · YOUR TURN' : 'YOUR TURN'; turnEl.style.background = TH.ui; turnEl.style.opacity = state === 'ready' ? 0 : 1;
  newHeld(); hudUpdate();
}
function newHeld() { held = makeDart(TH.flight, TH.barrel); held.position.copy(HOLD_POS); scene.add(held); held.userData.t = 0; }
function startAiTurn() {
  clearDarts(false);
  phase = 'ai'; aiLeft = 3; turnPts = 0; waitT = 0.3; ret.visible = false;
  turnEl.textContent = rival[0].toUpperCase() + "'S TURN"; turnEl.style.background = rival[2];
  hudUpdate();
}

function throwDart(dart, target, who) {
  const from = dart.position.clone();
  const to = boardWorld(target.x, target.y);
  flying.push({ m: dart, from, to, t: 0, dur: 0.28, who, target: target.clone() });
  tone(700, 0.12, 'sine', 0.06, 0.4);
}
function release() {
  if (state !== 'play' || phase !== 'you' || !held || !aiming) return;
  aiming = false;
  const sw = sway(now());
  const hit = aim.clone().add(sw).add(new THREE.Vector2(gauss() * 0.012, gauss() * 0.012));
  const d = held; held = null; dartsLeft--; hudUpdate();
  throwDart(d, hit, 'you'); sfx.tap(); buzz(8);
}
function aiThrow() {
  const r = Math.random;
  const tgt = r() < aiBullBias ? new THREE.Vector2(0, 0) : T20.clone();
  const hit = tgt.add(new THREE.Vector2(gauss() * aiSigma, gauss() * aiSigma));
  const d = makeDart(rival[2], '#c9ccd6'); d.position.set(1.5 + r() * 0.4, -2.0, 4.6); scene.add(d);
  aiLeft--; hudUpdate();
  throwDart(d, hit, 'ai');
}

function landed(f) {
  const sc = scoreAt(f.target.x, f.target.y);
  const m = f.m;
  if (sc.pts === 0 && Math.hypot(f.target.x, f.target.y) > 1.26) {              // off the board: bounce away
    flying.push({ m, out: true, t: 0, from: m.position.clone(), drop: true });
    tone(240, 0.1, 'square', 0.07, 0.6);
  } else { stuck.push({ m, wob: 1 }); }
  shake = 0.6;
  tone(150, 0.09, 'square', 0.13, 0.5); tone(1100, 0.03, 'triangle', 0.08, 1);
  const wp = m.position.clone();
  if (f.who === 'you') {
    you += sc.pts; turnPts += sc.pts; buzz(sc.pts >= 50 ? [20, 30, 40] : 14);
    const col = sc.label.startsWith('BULL') ? '#ffd23f' : sc.mult === 3 ? '#2ef0c2' : sc.mult === 2 ? '#ff8fab' : '#ffffff';
    ui.pop(sc.pts ? `${sc.label}  +${sc.pts}` : 'MISS', col, sc.mult >= 2 ? 40 : 32, 57);
    if (sc.pts >= 50 || sc.mult === 3) { burst(scene, wp, ['#ffd23f', '#ffffff', TH.flight], 22, { speed: 0.06, up: 0.05, size: 0.35, gravity: 0.003 }); ui.flash(0.3); }
    if (sc.pts === 50) { confetti(scene, wp, 50); sfx.win(); }
    else if (sc.mult === 3) sfx.coin(); else if (sc.pts) sfx.pick(Math.min(6, sc.pts / 8));
    if (dartsLeft === 0 && turnPts >= 100) setTimeout(() => ui.pop(turnPts === 180 ? 'ONE-EIGHTY!' : `TON ${turnPts}!`, '#ffd23f', 52, 40), 450);
  } else {
    riv += sc.pts; turnPts += sc.pts;
    ui.pop(`${rival[0]}: ${sc.pts ? sc.label : 'MISS'}`, sc.mult >= 2 ? '#ffd8e2' : '#ffffff', 26, 57);
  }
  hudUpdate();
  if (f.who === 'you') { if (dartsLeft > 0) newHeld(); else waitT = 0.45; }
}

function endLevel() {
  if (you > riv) {
    state = 'won'; if (!recorded) { recorded = true; F.level(true); }
    total += you; best = Math.max(best, total); save.set('best', best); B.submit(you);
    const lv = level; level++; save.set('level', level);
    sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, new V3(0, 0.6, 0.6), 90);
    if (D.beaten(total) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 48, 30); }
    D.won(total);
    ui.win(lv, `You ${you} – ${riv} ${rival[0]} · total ${total}`);
  } else {
    state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(you / Math.max(1, riv), 0, 1)); }
    sfx.fail(); buzz([40, 30, 60]); total = 0;
    ui.lose(`${rival[0].toUpperCase()} WINS`, `You ${you} – ${riv} ${rival[0]}`);
  }
  turnEl.style.opacity = 0; ret.visible = false;
}

// ---------------------------------------------------------------- input: drag aims, release throws
input({
  onDown: () => { if (state === 'play' && phase === 'you' && held) { aiming = true; } },
  onMove: (dx, dy) => { if (!aiming) return; aim.x = clamp(aim.x + dx * 0.0042, -1.15, 1.15); aim.y = clamp(aim.y - dy * 0.0042, -1.15, 1.15); },
  onUp: () => release(),
});
ui.onTap(which => {
  if (which === 'start') { state = 'play'; sfx.tap(); turnEl.style.opacity = 1; }
  else { buildLevel(); state = 'play'; }
  B.start();
});

// ---------------------------------------------------------------- loop
const tmp = new V3();
loop((dt, t) => {
  const dts = dt / 60;
  if (state === 'play') {
    if (phase === 'you') {
      if (dartsLeft === 0 && !flying.some(f => f.who === 'you')) { waitT -= dts; if (waitT <= 0) startAiTurn(); }
    } else if (phase === 'ai') {
      waitT -= dts;
      if (aiLeft > 0 && waitT <= 0) { aiThrow(); waitT = 0.4; }
      else if (aiLeft === 0 && !flying.some(f => f.who === 'ai') && waitT <= 0) {
        phase = 'clear'; waitT = 0.45;
      }
    } else if (phase === 'clear') {
      waitT -= dts;
      if (waitT <= 0) {
        if (round < rounds) { clearDarts(false); round++; startPlayerTurn(); }
        else if (you === riv) { clearDarts(false); rounds++; round++; ui.pop('TIE! EXTRA ROUND', '#ffd23f', 40, 40); startPlayerTurn(); }
        else { phase = 'end'; endLevel(); }
      }
    }
  }
  // reticle follows aim + live sway
  const showRet = state === 'play' && phase === 'you' && !!held;
  ret.visible = showRet;
  if (showRet) {
    const p = aim.clone().add(sway(now()));
    ret.position.set(p.x * R, p.y * R, 0.14); const pulse = aiming ? 1.12 : 1 + Math.sin(t * 6) * 0.05; ret.scale.setScalar(pulse);
  }
  // held dart: tracks aim, idle bob, pulls back while aiming
  if (held) {
    held.userData.t += dts;
    const ap = aim.clone().add(sway(now()));
    const target = boardWorld(ap.x, ap.y);
    const pos = HOLD_POS.clone().add(new V3(ap.x * 0.35, ap.y * 0.25 + Math.sin(t * 2.2) * 0.03, aiming ? 0.25 : 0));
    held.position.lerp(pos, 0.25 * dt);
    tmp.copy(target).sub(held.position).normalize(); held.quaternion.setFromUnitVectors(new V3(0, 0, -1), tmp);
    held.scale.setScalar(Math.min(1.2, held.userData.t * 8));
  }
  // flying darts
  for (const f of flying) {
    f.t += dts;
    if (f.out) {                             // pulled out / bounced: fly up and fade
      const k = f.t / 0.5; f.m.position.copy(f.from).add(new V3(0, f.drop ? -k * 3 : k * 1.2, f.drop ? k * 1.5 : k * 2.5));
      f.m.rotation.z += 0.3 * dt; if (k >= 1) { scene.remove(f.m); f.done = true; } continue;
    }
    const k = Math.min(1, f.t / f.dur), e = k;
    const p = f.from.clone().lerp(f.to, e); p.y += Math.sin(Math.PI * e) * 0.55;
    const prev = f.m.position.clone(); f.m.position.copy(p);
    if (k < 1) { tmp.copy(p).sub(prev); if (tmp.lengthSq() > 1e-6) f.m.quaternion.setFromUnitVectors(new V3(0, 0, -1), tmp.normalize()); f.m.scale.setScalar(1 - k * 0.15); }
    else { f.done = true; f.m.position.z = 0.13 + 0.12; f.m.quaternion.setFromEuler(new THREE.Euler(-0.25 + Math.random() * 0.15, (Math.random() - 0.5) * 0.2, 0)); f.m.position.copy(f.to).add(new V3(0, 0, 0.1)); landed(f); }
  }
  flying = flying.filter(f => !f.done);
  for (const d of stuck) { if (d.wob > 0) { d.wob = Math.max(0, d.wob - 0.03 * dt); d.m.rotation.y = Math.sin(t * 40) * 0.06 * d.wob; } }
  // camera: gentle breathing + impact shake
  shake = Math.max(0, shake - 0.05 * dt);
  boardG.position.x = (Math.random() - 0.5) * 0.02 * shake;
  camera.position.set(Math.sin(t * 0.4) * 0.08, -0.1, 8.3);
  camera.lookAt(0, -0.05, 0);
});

buildLevel();
ui.start();

// ---------------------------------------------------------------- test hooks
let botPlan = null;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play' || phase !== 'you' || !held || flying.some(f => f.who === 'you')) return;
    if (!aiming) { botPlan = T20.clone(); aim.copy(botPlan); aiming = true; return; }
    const sw = sway(now());
    if (sw.length() < swayAmp * 0.75) release();             // a steady player releases when the hand is calm
  },
};

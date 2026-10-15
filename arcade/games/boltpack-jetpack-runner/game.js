// Boltpack — original endless jetpack runner. A little rocket robot ("Bolt") escapes through a candy-coloured lab:
// hold to fire the bottle rockets, release to drop. Dodge tesla zappers and homing fireworks (with a warning first),
// grab golden bolts, and catch the Bubble for a short floaty ride that soaks up one hit.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, note, sfx, burst, confetti, lerp, clamp, rng, rounded, mat, glossy, stickman } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { glowSprite, sparks } from './_music/fx.js';

const NAME = 'Boltpack: Jetpack Runner';
const HC = 0.75, H = 9.5, HERO_R = 0.42, SECTOR = 300, ZPOOL = 12, MPOOL = 4, CPOOL = 180;
const S = store('boltpack');
let best = S.get('best', 0), totalBolts = S.get('bolts', 0);
const F = flow('boltpack', { par: 350, warmup: 120 });

const stage = createStage({ fov: 44, shadows: true, shadowSize: 10 });
const { scene, camera, sun } = stage;
stage.hemi.intensity = 1.25; sun.intensity = 1.35; sun.position.set(-4, 14, 12);
const ui = createUI({ title: 'BOLT<br>PACK', hint: 'Hold to fly', hand: '👆' });
const D = daily('boltpack', ui, { name: NAME });
ui.els.win.querySelector('p').innerHTML = 'SCORE <span data-l>0</span>';
ui.els.win.querySelector('h1').textContent = 'NEW BEST!'; ui.els.win.classList.add('dim');
const coinEl = document.createElement('div'); coinEl.className = 'bp-coin'; document.body.appendChild(coinEl);
const bubbleBar = document.createElement('div'); bubbleBar.className = 'bp-bubble hc-hidden'; bubbleBar.innerHTML = '<i></i>'; document.body.appendChild(bubbleBar);

// ---------------------------------------------------------------- sector palettes (pastel lab, one bold accent)
const PAL = [
  { bg: ['#bfe3ff', '#eaf6ff'], wall: '#c9dcff', panel: '#eef4ff', pillar: '#6f86ff', floor: '#5566e0', stripe: '#ffcf3f', win: '#9ff0ff', ui: '#5566e0' },
  { bg: ['#ffd3e2', '#fff1e6'], wall: '#ffd0df', panel: '#fff2f6', pillar: '#ff6f9c', floor: '#c64b84', stripe: '#ffe066', win: '#ffe3a3', ui: '#e0507f' },
  { bg: ['#c7f5e0', '#f0fff8'], wall: '#c4f0dc', panel: '#effff7', pillar: '#2fbf8f', floor: '#1f8f78', stripe: '#ff7a59', win: '#d4fffa', ui: '#1f9f80' },
  { bg: ['#e2d4ff', '#fff0fb'], wall: '#ddd0ff', panel: '#f7f2ff', pillar: '#8a63ff', floor: '#5b3fc4', stripe: '#53e0c2', win: '#ffd6f5', ui: '#7b5cff' },
  { bg: ['#ffe2bf', '#fff8e8'], wall: '#ffe0b8', panel: '#fff6ea', pillar: '#ff8a3d', floor: '#d0602a', stripe: '#3a86ff', win: '#c8f1ff', ui: '#f07a2e' },
];
const emi = (c, k = 0.45) => mat(c, { emissive: c, emissiveIntensity: k });
const M = { wall: emi('#c9dcff'), panel: emi('#eef4ff', 0.4), pillar: glossy('#6f86ff'), floor: glossy('#5566e0', { roughness: 0.25 }), stripe: mat('#ffcf3f', { emissive: '#ffcf3f', emissiveIntensity: 0.25 }), win: new THREE.MeshBasicMaterial({ color: '#9ff0ff' }), dark: mat('#2b2d42') };
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
let palI = 0, palT = 1;
function setPalette(i, instant) {
  palI = i % PAL.length; palT = instant ? 1 : 0;
  const p = PAL[palI]; const bs = document.body.style; bs.setProperty('--bg1', p.bg[0]); bs.setProperty('--bg2', p.bg[1]); bs.setProperty('--ui', p.ui);
  if (instant) for (const k of ['wall', 'panel', 'pillar', 'floor', 'stripe', 'win']) { M[k].color.set(p[k]); if (M[k].emissive && k !== 'pillar' && k !== 'floor') M[k].emissive.set(p[k]); }
  if (instant && M.slab) M.slab.color.set(p.stripe);
}
function blendPalette(dt) {
  if (palT >= 1) return; palT = Math.min(1, palT + dt * 0.03); const p = PAL[palI];
  for (const k of ['wall', 'panel', 'pillar', 'floor', 'stripe', 'win']) { M[k].color.lerp(_c1.set(p[k]), 0.08 * dt); if (M[k].emissive && k !== 'pillar' && k !== 'floor') M[k].emissive.copy(M[k].color); }
  M.slab.color.copy(M.stripe.color);
}

// ---------------------------------------------------------------- lab corridor (instanced, recycled chunks)
const CH = 12, NCH = 7;
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(CH * NCH, 40), M.wall); backWall.position.set(0, H / 2, -3); backWall.receiveShadow = true; scene.add(backWall);
const stripeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#c8c8d8';
  for (let i = -64; i < 128; i += 32) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 16, 64); g.lineTo(i + 80, 0); g.lineTo(i + 64, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(CH * NCH / 2.2, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
M.slab = mat('#6f86ff', { map: stripeTex });
const slabTop = new THREE.Mesh(new THREE.BoxGeometry(CH * NCH, 0.7, 0.25), M.slab);
const floor = new THREE.Mesh(new THREE.BoxGeometry(CH * NCH, 7, 7), [M.floor, M.floor, M.floor, M.floor, M.pillar, M.floor]); floor.position.set(0, -3.5, 0.3); floor.receiveShadow = true; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.BoxGeometry(CH * NCH, 7, 7), [M.floor, M.floor, M.floor, M.panel, M.pillar, M.floor]); ceil.position.set(0, H + 3.5, 0.3); scene.add(ceil);
const floorBand = slabTop; floorBand.position.set(0, -0.6, 3.9); scene.add(floorBand);
const ceilBand = slabTop.clone(); ceilBand.position.set(0, H + 0.6, 3.9); scene.add(ceilBand);
const floorStripe = new THREE.Mesh(new THREE.BoxGeometry(CH * NCH, 0.06, 0.35), M.stripe); floorStripe.position.set(0, 0.03, 3.2); scene.add(floorStripe);
const ceilStripe = new THREE.Mesh(new THREE.BoxGeometry(CH * NCH, 0.06, 0.35), M.stripe); ceilStripe.position.set(0, H - 0.03, 3.2); scene.add(ceilStripe);
const inst = (geo, m, n, shadow) => { const im = new THREE.InstancedMesh(geo, m, n); im.frustumCulled = false; if (shadow) { im.castShadow = true; im.receiveShadow = true; } scene.add(im); return im; };
const pillars = inst(rounded(1.1, H, 1.2, 0.18), M.pillar, NCH, true);
const panels = inst(rounded(4.2, 4.6, 0.3, 0.25), M.panel, NCH * 2);
const windows = inst(rounded(3.4, 2.6, 0.12, 0.3), M.win, NCH * 2);
const winBars = inst(new THREE.BoxGeometry(0.12, 2.6, 0.16), M.panel, NCH * 2);
const tiles = inst(new THREE.BoxGeometry(0.08, 0.02, 6.6), M.stripe, NCH * 4);
const pipes = inst(new THREE.CylinderGeometry(0.16, 0.16, CH, 10).rotateZ(Math.PI / 2), M.panel, NCH * 2);
const lamps = inst(new THREE.CylinderGeometry(0.5, 0.7, 0.25, 16), new THREE.MeshBasicMaterial({ color: '#fffbe0' }), NCH);
// lab props on the floor along the back wall: crates and tall flasks
const crates = inst(rounded(1.2, 1.2, 1.2, 0.12), mat('#ffb84d'), NCH, true);
const flasks = inst(new THREE.CylinderGeometry(0.28, 0.42, 1.6, 14), glossy('#7ef0ff', { transparent: true, opacity: 0.75 }), NCH, true);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
function hash(i, k) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
function layoutCorridor(cx) {
  const c0 = Math.floor(cx / CH) - 2;
  for (let n = 0; n < NCH; n++) {
    const ci = c0 + n, x = ci * CH;
    _m.makeTranslation(x, H / 2, -2.4); pillars.setMatrixAt(n, _m);
    lamps.setMatrixAt(n, _m.makeTranslation(x + CH / 2, H - 0.1, 0));
    for (let j = 0; j < 2; j++) {
      const wx = x + 3.3 + j * 5.4, k = n * 2 + j, isWin = hash(ci, j) > 0.18;
      _m.makeTranslation(wx, 4.6, -2.92); panels.setMatrixAt(k, _m);
      _m.compose(_p.set(wx, 4.6, -2.75), _q.identity(), _s.setScalar(isWin ? 1 : 0)); windows.setMatrixAt(k, _m);
      _m.compose(_p.set(wx, 4.6, -2.7), _q.identity(), _s.setScalar(isWin ? 1 : 0)); winBars.setMatrixAt(k, _m);
      _m.makeTranslation(x + CH / 2, j ? H - 0.45 : H - 0.95, -2.4 + j * 0.4); pipes.setMatrixAt(k, _m);
    }
    for (let j = 0; j < 4; j++) { _m.makeTranslation(x + j * 3, 0.005, 0.3); tiles.setMatrixAt(n * 4 + j, _m); }
    const h1 = hash(ci, 7);
    _m.compose(_p.set(x + 6 + h1 * 3, 0.6, -2.1), _q.setFromEuler(_e.set(0, h1, 0)), _s.setScalar(h1 > 0.45 ? 1 : 0)); crates.setMatrixAt(n, _m);
    _m.compose(_p.set(x + 2 + h1 * 2, 0.8, -2.3), _q.identity(), _s.setScalar(h1 < 0.6 ? 1 : 0)); flasks.setMatrixAt(n, _m);
  }
  for (const im of [pillars, panels, windows, winBars, tiles, pipes, lamps, crates, flasks]) im.instanceMatrix.needsUpdate = true;
  for (const o of [backWall, floor, ceil, floorStripe, ceilStripe, floorBand, ceilBand]) o.position.x = Math.floor(cx / CH) * CH + CH;
}

// ---------------------------------------------------------------- hero: Bolt, a round-shouldered courier robot with twin bottle rockets
const hero = new THREE.Group(); scene.add(hero); hero.scale.setScalar(1.1);
const rig = new THREE.Group(); hero.add(rig);
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d, r);   // rounded() grows by its bevel: this keeps the outer size exact
const shell = glossy('#fff6e8'), accent = glossy('#ff7a2f'), visorM = new THREE.MeshStandardMaterial({ color: '#1d2340', roughness: 0.12, metalness: 0.3 });
const eyeM = new THREE.MeshBasicMaterial({ color: '#5ff7ff' });
const torso = new THREE.Mesh(rbox(0.56, 0.44, 0.5, 0.14), accent); torso.position.y = 0.56; torso.castShadow = true; rig.add(torso);
const head = new THREE.Mesh(rbox(0.84, 0.62, 0.7, 0.2), shell); head.position.y = 1.06; head.castShadow = true; rig.add(head);
const visor = new THREE.Mesh(rbox(0.1, 0.42, 0.56, 0.05), visorM); visor.position.set(0.39, 1.06, 0); rig.add(visor);
const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 8), eyeM); eye.position.set(0.445, 1.09, 0.12); rig.add(eye);
const eye2 = eye.clone(); eye2.position.z = -0.12; rig.add(eye2);
const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff8fb1' })); cheek.position.set(0.42, 0.93, 0.24); cheek.scale.set(0.4, 0.6, 1); rig.add(cheek);
const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14).rotateX(Math.PI / 2), accent); ear.position.set(0, 1.06, 0.37); rig.add(ear);
const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), M.dark); ant.position.set(-0.08, 1.48, 0); rig.add(ant);
const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), new THREE.MeshBasicMaterial({ color: '#ff3b7f' })); antBall.position.set(-0.08, 1.64, 0); rig.add(antBall);
const pack = new THREE.Group(); pack.position.set(-0.4, 0.72, 0); rig.add(pack);
const flames = [];
for (const z of [-0.17, 0.17]) {
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 6, 12), glossy('#ff3b5c')); b.position.set(0, 0, z); b.castShadow = true; pack.add(b);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 12), shell); cap.position.set(0, 0.38, z); pack.add(cap);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.12, 10), M.dark); noz.position.set(0, -0.34, z); pack.add(noz);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.62, 10).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95 }));
  fl.position.set(0, -0.7, z); pack.add(fl);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.36, 8).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff' })); core.position.set(0, -0.56, z); pack.add(core);
  flames.push(fl, core);
}
const legs = [], arms = [];
for (const z of [-0.14, 0.14]) {
  const piv = new THREE.Group(); piv.position.set(0, 0.34, z); rig.add(piv);
  const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 4, 8), M.dark); l.position.y = -0.14; l.castShadow = true; piv.add(l);
  const foot = new THREE.Mesh(rbox(0.26, 0.1, 0.16, 0.04), shell); foot.position.set(0.05, -0.28, 0); piv.add(foot); legs.push(piv);
  const ap = new THREE.Group(); ap.position.set(0.02, 0.7, z * 2.4); rig.add(ap);
  const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), M.dark); a.position.y = -0.14; ap.add(a);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), shell); hand.position.y = -0.3; ap.add(hand); arms.push(ap);
}
const heroShadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false })); scene.add(heroShadow);
const heroGlow = glowSprite('#ffb347', 1.6, 'soft', 0); scene.add(heroGlow);
// bubble ride (vehicle power-up)
const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#c9f6ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.25, 32, 20), bubbleMat); bubble.visible = false; scene.add(bubble);
const bubbleHi = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.85 })); bubble.add(bubbleHi); bubbleHi.position.set(-0.45, 0.5, 0.6); bubbleHi.scale.set(1, 1.6, 1);
const token = new THREE.Group(); scene.add(token); token.visible = false;
const tokenBall = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), bubbleMat.clone()); tokenBall.material.opacity = 0.55; token.add(tokenBall);
const tokenStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: '#ff8fe0' })); token.add(tokenStar);
const tokenGlow = glowSprite('#ff8fe0', 2.6, 'soft', 0.8); token.add(tokenGlow);

// ---------------------------------------------------------------- zappers (two charged orbs + a crackling beam)
const zapOrbGeo = new THREE.SphereGeometry(0.28, 16, 12), zapRingGeo = new THREE.TorusGeometry(0.3, 0.07, 8, 20);
const beamGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 8), beamOuterGeo = new THREE.CylinderGeometry(0.34, 0.34, 1, 12, 1, true);
const zaps = [];
for (let i = 0; i < ZPOOL; i++) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const orbs = [0, 1].map(() => { const o = new THREE.Group(); const s = new THREE.Mesh(zapOrbGeo, glossy('#3d3f58', { metalness: 0.4 })); s.castShadow = true; const r = new THREE.Mesh(zapRingGeo, new THREE.MeshBasicMaterial({ color: '#ffe74a' })); o.add(s, r); const gl = glowSprite('#ffe74a', 1.6, 'soft', 0.9); o.add(gl); g.add(o); return o; });
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fffbd0' }));
  const outer = new THREE.Mesh(beamOuterGeo, new THREE.MeshBasicMaterial({ color: '#ffe74a', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
  const bolt = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#ffffff' })); bolt.frustumCulled = false;
  g.add(beam, outer, bolt);
  zaps.push({ g, orbs, beam, outer, bolt, on: false, x: 0, y: 0, l: 1, a: 0, w: 0, passed: false });
}
// ---------------------------------------------------------------- fireworks rockets (homing-height missiles)
const missiles = [];
for (let i = 0; i < MPOOL; i++) {
  const g = new THREE.Group(); g.visible = false; g.scale.setScalar(1.45); scene.add(g);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 6, 12).rotateZ(Math.PI / 2), glossy('#ff3b5c')); body.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.16, 14).rotateZ(Math.PI / 2), shell);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 14).rotateZ(Math.PI / 2), glossy('#ffd23f')); nose.position.x = -0.62;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.05), glossy('#ffd23f')); fin.position.x = 0.45;
  const fin2 = fin.clone(); fin2.rotation.x = Math.PI / 2;
  const fl = glowSprite('#ff9d3f', 1.4, 'soft', 1); fl.position.x = 0.8;
  g.add(body, band, nose, fin, fin2, fl);
  const warn = document.createElement('div'); warn.className = 'bp-warn hc-hidden'; warn.textContent = '!'; document.body.appendChild(warn);
  missiles.push({ g, warn, fl, phase: 'off', x: 0, y: 0, t: 0 });
}
// ---------------------------------------------------------------- bolts (coins): golden hex nuts
const nutGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 6).rotateX(Math.PI / 2);
const coinsIM = inst(nutGeo, glossy('#ffd23f', { metalness: 0.05, roughness: 0.3, emissive: '#ffb000', emissiveIntensity: 0.55 }), CPOOL);
const coins = [];
const fx = sparks(scene, 220);
// lab interns in white coats who wander the floor and scatter when Bolt zooms past (decor only)
const SKINS = ['#ffd7ba', '#c68c5f', '#8d5a3b', '#f2c6a0'], GOG = new THREE.MeshBasicMaterial({ color: '#5ff7ff' });
const interns = [];
for (let i = 0; i < 4; i++) {
  const g = stickman('#ffffff', SKINS[i], 0.85); scene.add(g);
  const gog = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.42), GOG); gog.position.set(0.06, 1.52, 0); g.add(gog);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.46), mat(['#ff5d8f', '#3ab795', '#7b5cff', '#ff8c42'][i])); tie.position.set(0, 1.0, 0); g.add(tie);
  interns.push({ g, x: 8 + i * 9, v: 0.6, flee: 0, z: -1.2 - (i % 2) * 0.5 });
}

// ---------------------------------------------------------------- run state
const B = worldBoard({ game: 'boltpack', label: 'Meters', limits: { maxRun: 10000, maxPerSec: 32 } });   // world board: best run today
let state = 'ready', R = rng(1), x0 = 0, px = 0, py = 0, vy = 0, speed = 7, score = 0, bolts = 0, sector = 1, clock = 0, runT = 0;
let genX = 0, nextMissile = 0, nextToken = 0, onFloor = true, holding = false, botHold = false, beatenShown = false, recorded = false;
let bubbleT = 0, invulnT = 0, deadT = 0, deadVx = 0, spin = 0, camX = 0, camY = 0, shake = 0, nearT = 0, coinStreak = 0, coinStreakT = 0, thrustSnd = 0;

function hideAll() {
  for (const z of zaps) { z.on = false; z.g.visible = false; }
  for (const m of missiles) { m.phase = 'off'; m.g.visible = false; m.warn.classList.add('hc-hidden'); }
  coins.length = 0; token.visible = false; bubble.visible = false;
}
function reset() {
  hideAll(); R = rng(D.seed || (Date.now() % 1e6) + 11);
  px = x0 = 0; py = 0; vy = 0; score = 0; bolts = 0; sector = 1; runT = 0; speed = 7 * F.k(0);
  genX = 26; nextMissile = 9 + R() * 4; nextToken = 260 + R() * 160; onFloor = true; beatenShown = false; recorded = false;
  bubbleT = 0; invulnT = 0; deadT = 0; spin = 0; camX = 0; camY = H / 2; coinStreak = 0;
  hero.rotation.set(0, 0, 0); rig.rotation.set(0, 0, 0); hero.visible = true;
  setPalette(0, true); ui.levels(1); ui.progress(0); ui.score('0m'); ui.sub(best ? `BEST ${best}m` : ''); ui.pill(D.isDaily ? 'DAILY' : '');
  coinEl.textContent = ''; bubbleBar.classList.add('hc-hidden');
}

// ---------------------------------------------------------------- generation
function freeZap() { return zaps.find(z => !z.on); }
function addZap(x, y, l, a, w = 0) {
  const z = freeZap(); if (!z) return;
  Object.assign(z, { on: true, x, y, l, a, w, passed: false }); z.g.visible = true;
}
function addCoinsRect(x, y, cols, rows) { for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) coins.push({ x: x + i * 0.62, y: y + j * 0.62, got: false, t: 0 }); }
function addCoinsWave(x, y, n, amp) { for (let i = 0; i < n; i++) coins.push({ x: x + i * 0.62, y: y + Math.sin(i * 0.5) * amp, got: false, t: 0 }); }
function generate() {
  const fk = F.k(score), dist = px - x0;
  while (genX < px + 34) {
    const r = R(), lvl = Math.min(1, dist / 1500);
    let len = 2;
    if (r < 0.16) {                                        // bolt bonanza (breather)
      const rows = 2 + Math.floor(R() * 3), y = 1 + R() * (H - 2.5 - rows * 0.62);
      if (R() < 0.5) addCoinsRect(genX, y, 8 + Math.floor(R() * 6), rows); else addCoinsWave(genX, H / 2 - 0.3 + (R() - 0.5) * 2, 16, 1.6 + R());
      len = 9;
    } else if (r < 0.42) {                                  // single zapper, any angle
      const a = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][Math.floor(R() * 4)], l = 1.1 + R() * (0.9 + lvl * 0.8);
      const ext = Math.abs(Math.sin(a)) * l + 0.5, y = ext + R() * (H - 2 * ext);
      addZap(genX, y, l, a);
      if (R() < 0.6) addCoinsWave(genX - 4.5, y > H / 2 ? 1.6 : H - 1.8, 6, 0.3);
      len = 3;
    } else if (r < 0.6) {                                   // floor + ceiling pair: weave
      const l = 1.3 + R() * 0.7 + lvl * 0.4;
      const first = R() < 0.5;
      addZap(genX, first ? l + 0.25 : H - l - 0.25, l, Math.PI / 2);
      addZap(genX + 4.6 / Math.sqrt(fk), first ? H - l - 0.25 : l + 0.25, l, Math.PI / 2);
      len = 6;
    } else if (r < 0.76) {                                  // gate: squeeze through a gap
      const gap = clamp(3.0 / fk - lvl * 0.4, 2.1, 3.6), gy = 1.2 + gap / 2 + R() * (H - 2.4 - gap);
      const lo = (gy - gap / 2) / 2, hi = (H - (gy + gap / 2)) / 2;
      if (lo > 0.3) addZap(genX, lo, lo, Math.PI / 2); if (hi > 0.3) addZap(genX, H - hi, hi, Math.PI / 2);
      addCoinsRect(genX - 1.2, gy - 0.31, 5, 2); len = 3;
    } else if (r < 0.9 || dist < 150) {                     // spinner
      const l = 1.5 + R() * 0.6, y = l + 0.4 + R() * (H - 2 * l - 0.8);
      addZap(genX + 1, y, l, R() * Math.PI, (R() < 0.5 ? -1 : 1) * (1.2 + R() * 0.6) * Math.min(1.25, fk));
      len = 4;
    } else {                                               // staircase of three diagonals
      const up = R() < 0.5;
      for (let k = 0; k < 3; k++) addZap(genX + k * 3.2, up ? 1.6 + k * 2.4 : H - 1.6 - k * 2.4, 1.1, up ? -Math.PI / 4 : Math.PI / 4);
      len = 9;
    }
    genX += len + Math.max(3.2, (8.6 - dist * 0.0028) / fk) * (0.8 + R() * 0.5);
  }
}

// ---------------------------------------------------------------- hazards: collision helpers
function zapEnds(z, t) { const a = z.a + z.w * t, c = Math.cos(a) * z.l, s = Math.sin(a) * z.l; return [z.x - c, z.y - s, z.x + c, z.y + s]; }
function segDist(x, y, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, u = L ? clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1) : 0; return Math.hypot(x - ax - dx * u, y - ay - dy * u); }
/** clearance from the hero centre (x, y) at time t (0 = now) to every hazard; < 0 means hit */
function clearance(x, y, t) {
  let c = 99;
  for (const z of zaps) { if (!z.on || Math.abs(z.x - x) > z.l + 1.5) continue; const [ax, ay, bx, by] = zapEnds(z, clock + t); c = Math.min(c, segDist(x, y, ax, ay, bx, by) - HERO_R - 0.12); }
  for (const m of missiles) {
    if (m.phase === 'fly') { const mx = m.x - m.v * t; c = Math.min(c, Math.hypot((mx - x) * 0.62, m.y - y) - HERO_R - 0.3); }
    else if (m.phase === 'warn' && m.t - t < 0) { const mx = px + 14 - (m.v) * (t - m.t); if (mx < x + 3) c = Math.min(c, Math.hypot((mx - x) * 0.62, (m.lockY ?? m.y) - y) - HERO_R - 0.3); }
  }
  return c;
}

// ---------------------------------------------------------------- actions
function launchMissile(n = 1) {
  let k = 0;
  for (const m of missiles) {
    if (m.phase !== 'off' || k >= n) continue;
    m.phase = 'warn'; m.t = 1.35 + k * 0.45; m.y = py + HC; m.lockY = null; m.v = speed * 1.15 + 6; m.off = (k - (n - 1) / 2) * 1.6; m.warn.classList.remove('hc-hidden'); m.warn.classList.remove('lock'); k++;
  }
  tone(880, 0.07, 'square', 0.07, 1); setTimeout(() => state === 'play' && tone(880, 0.07, 'square', 0.07, 1), 160);
}
function popBubble() {
  bubbleT = 0; invulnT = 1.3; bubble.visible = false; bubbleBar.classList.add('hc-hidden');
  burst(scene, new THREE.Vector3(px, py + HC, 0), ['#c9f6ff', '#ffffff', '#ff8fe0'], 22, { speed: 0.14, up: 0.08, size: 0.6, shape: 'sphere' });
  tone(1200, 0.12, 'sine', 0.14, 0.4); tone(600, 0.2, 'triangle', 0.1, 0.5); buzz(30); ui.flash(0.4); ui.pop('POP!', '#c9f6ff', 36, 34); shake = 0.3;
}
function die(why) {
  if (state !== 'play') return;
  state = 'dying'; deadT = 0; deadVx = speed; vy = Math.max(vy, 5); spin = 1;
  fx.emit(new THREE.Vector3(px, py + HC, 0.2), ['#ffe74a', '#ffffff', '#ff7a2f'], 26, { speed: 0.16, size: 0.6, up: 0.06 });
  burst(scene, new THREE.Vector3(px, py + HC, 0), ['#fdfaf3', '#ff7a2f', '#2b2d42', '#ff3b5c'], 16, { speed: 0.14, up: 0.12 });
  ui.flash(0.75); shake = 0.6; buzz([40, 30, 80]); sfx.smash(); tone(1400, 0.35, 'sawtooth', 0.06, 0.2);
  for (const m of missiles) m.warn.classList.add('hc-hidden');
  bubbleBar.classList.add('hc-hidden'); deathWhy = why;
}
let deathWhy = '';
function finish() {
  state = 'over';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  totalBolts += bolts; S.set('bolts', totalBolts);
  const prev = best;
  if (score > best) { best = score; S.set('best', best); }
  if (score > prev && score > 0) {
    state = 'won'; D.won(score); ui.win(`${score}m`, `${prev ? 'old best ' + prev + 'm · ' : ''}⬢ ${bolts} bolts`);
    confetti(scene, new THREE.Vector3(px + 2, H / 2, 0), 70); sfx.win();
  } else {
    state = 'lost'; ui.lose(`${score}m`, `BEST ${best}m · ⬢ ${bolts} bolts${deathWhy ? ' · ' + deathWhy : ''}`);
  }
}

input({ onDown: () => { holding = true; }, onUp: () => { holding = false; } });
addEventListener('pointercancel', () => { holding = false; });
ui.onTap(which => { B.start(); if (which !== 'start') reset(); state = 'play'; holding = false; runT = 0; tone(660, 0.08, 'triangle', 0.12, 1.4); });

// ---------------------------------------------------------------- loop
const tmpV = new THREE.Vector3();
function toScreen(x, y) { tmpV.set(x, y, 0).project(camera); return [(tmpV.x + 1) / 2 * innerWidth, (1 - tmpV.y) / 2 * innerHeight]; }
function screenRightX(y) { // world x at the right screen edge for height y on the hero plane (approx via bisection)
  let lo = px, hi = px + 30; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; tmpV.set(mid, y, 0).project(camera); if (tmpV.x < 0.92) lo = mid; else hi = mid; } return lo;
}
loop((dtf) => {
  const dt = dtf / 60; clock += dt;
  blendPalette(dtf);
  const thrust = (holding || botHold) && state === 'play';
  if (state === 'play') {
    runT += dt;
    speed = Math.min(15.5, (7.6 + (px - x0) * 0.0042) * F.k(score));
    px += speed * dt;
    // flight
    const g = bubbleT > 0 ? 15 : 27, up = bubbleT > 0 ? 30 : 52;
    vy += (thrust ? up - g : -g) * dt; vy = clamp(vy, bubbleT > 0 ? -6 : -12, bubbleT > 0 ? 6 : 9.5);
    py += vy * dt;
    if (py <= 0) { if (!onFloor && vy < -6) { burst(scene, new THREE.Vector3(px, 0.1, 0), '#ffffff', 6, { speed: 0.06, up: 0.03, size: 0.5 }); tone(200, 0.06, 'sine', 0.08, 0.6); } py = 0; vy = Math.max(0, vy); onFloor = true; }
    else onFloor = false;
    if (py >= H - 1.6) { py = H - 1.6; vy = Math.min(0, vy); }
    // score / sectors
    const m = Math.floor(px - x0);
    if (m !== score) {
      score = m; ui.score(score + 'm');
      const sc = Math.floor(score / SECTOR) + 1; ui.progress((score % SECTOR) / SECTOR);
      if (sc > sector) { sector = sc; ui.levels(sector); setPalette(sector - 1); ui.pop(`SECTOR ${sector}!`, '#fff', 40, 30); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s, 0.3, 0.13), i * 80)); confetti(scene, new THREE.Vector3(px + 3, H - 2, 0), 50); }
      if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, new THREE.Vector3(px + 2, H / 2, 0), 60); }
    }
    generate();
    // missiles timer
    if (px - x0 > 110) { nextMissile -= dt; if (nextMissile <= 0) { const d = px - x0; launchMissile(d > 900 && R() < 0.35 ? 3 : d > 450 && R() < 0.4 ? 2 : 1); nextMissile = (4.2 + R() * 4) / F.k(score); } }
    // bubble token
    if (!token.visible && bubbleT <= 0 && px - x0 > nextToken) { token.visible = true; token.position.set(px + 22, 2 + R() * (H - 4), 0); nextToken = px - x0 + 420 + R() * 260; }
    if (bubbleT > 0) { bubbleT -= dt; bubbleBar.firstChild.style.width = clamp(bubbleT / 9, 0, 1) * 100 + '%'; if (bubbleT <= 0) { popBubble(); invulnT = 1; } }
    invulnT = Math.max(0, invulnT - dt);
    // hit test
    const cx = px, cy = py + HC;
    const c = clearance(cx, cy, 0);
    if (c < 0 && invulnT <= 0) { if (bubbleT > 0) popBubble(); else die(''); }
    else if (c < 0.35 && nearT <= 0 && state === 'play') { nearT = 1.2; ui.pop('CLOSE!', '#fff', 28, 36); tone(1100, 0.05, 'triangle', 0.08, 1.3); }
    nearT -= dt;
    if (token.visible && Math.hypot(token.position.x - cx, token.position.y - cy) < 1.0) {
      token.visible = false; bubbleT = 9; bubble.visible = true; bubbleBar.classList.remove('hc-hidden');
      ui.pop('BUBBLE RIDE!', '#ff3fb4', 40, 30); ui.flash(0.35); [0, 5, 9, 12, 16].forEach((s, i) => setTimeout(() => note(76 + s, 0.25, 0.12), i * 60)); buzz(25);
    }
    // jetpack sound + exhaust
    if (thrust) {
      thrustSnd -= dt; if (thrustSnd <= 0) { thrustSnd = 0.09; tone(90 + Math.random() * 40, 0.09, 'sawtooth', 0.025, 0.7); }
      if (Math.random() < 0.7) fx.emit(new THREE.Vector3(px - 0.5, py + 0.05, 0), ['#ffd23f', '#ff7a2f', '#ffffff'], 1, { speed: 0.03, size: 0.45, up: -0.08, gravity: -0.001, life: 0.6 });
      if (Math.random() < 0.5) burst(scene, new THREE.Vector3(px - 0.5, py - 0.1, 0), '#ffe08a', 1, { speed: 0.02, up: -0.06, size: 0.35, gravity: 0.01, life: 0.4 });
    }
  } else if (state === 'dying') {
    deadT += dt; deadVx = Math.max(0, deadVx - 9 * dt); px += deadVx * dt;
    vy -= 26 * dt; py += vy * dt;
    if (py <= 0) { py = 0; if (vy < -3) { vy = -vy * 0.45; burst(scene, new THREE.Vector3(px, 0.2, 0), '#ffffff', 6, { speed: 0.08, up: 0.05, size: 0.5 }); tone(160, 0.08, 'sine', 0.1, 0.6); buzz(15); } else vy = 0; }
    spin = Math.max(0, spin - dt * 0.5);
    rig.rotation.z -= (deadVx * 0.9 + 1) * dt * (py > 0.05 ? 1.6 : 0.6);
    if (Math.random() < 0.3 && deadVx > 0.5) fx.emit(new THREE.Vector3(px, py + 0.4, 0.3), ['#ffe74a', '#ffffff'], 1, { speed: 0.05, size: 0.3 });
    if (deadT > 1.6 || (deadVx <= 0 && py <= 0 && deadT > 0.9)) finish();
  } else if (state === 'ready') {
    py = 0;
  }
  // coins: collect + magnet near the hero
  let ci = 0;
  for (const k of coins) {
    if (k.got) { k.t += dt * 3; if (k.t > 1) continue; }
    else if (state === 'play') {
      const dx = k.x - px, dy = k.y - (py + HC);
      if (Math.abs(dx) < 0.7 && Math.abs(dy) < 0.75) {
        k.got = true; k.t = 0; bolts++; coinEl.textContent = `⬢ ${bolts}`;
        coinStreak = coinStreakT > 0 ? coinStreak + 1 : 0; coinStreakT = 0.35;
        tone(1046 * Math.pow(2, (coinStreak % 12) / 12), 0.06, 'square', 0.045, 1.25);
        if (coinStreak && coinStreak % 10 === 0) ui.pop(`+${coinStreak} STREAK`, '#ffe066', 30, 40);
      }
    }
    if (k.x < px - 8 && !k.got) { k.got = true; k.t = 2; continue; }
    if (ci >= CPOOL) break;
    const s = k.got ? 1 + k.t * 0.8 : 1, yy = k.got ? k.y + k.t * 1.2 : k.y + Math.sin(clock * 3 + k.x) * 0.05;
    _m.compose(_p.set(k.got ? lerp(k.x, px, k.t) : k.x, yy, 0), _q.setFromEuler(_e.set(0, Math.sin(clock * 4 + k.x * 0.7) * 0.7, clock * 0.8)), _s.setScalar(k.got ? Math.max(0, s * (1 - k.t)) : s)); coinsIM.setMatrixAt(ci++, _m);
  }
  coinStreakT -= dt;
  for (let i = ci; i < CPOOL; i++) { _m.makeScale(0, 0, 0); coinsIM.setMatrixAt(i, _m); }
  coinsIM.instanceMatrix.needsUpdate = true;
  for (let i = coins.length - 1; i >= 0; i--) if (coins[i].got && coins[i].t > 1) coins.splice(i, 1);
  // zappers: animate + recycle
  for (const z of zaps) {
    if (!z.on) continue;
    if (z.x < px - 10) { z.on = false; z.g.visible = false; continue; }
    const [ax, ay, bx, by] = zapEnds(z, clock);
    z.orbs[0].position.set(ax, ay, 0); z.orbs[1].position.set(bx, by, 0);
    z.orbs[0].children[1].rotation.set(clock * 4, clock * 3, 0); z.orbs[1].children[1].rotation.set(-clock * 4, clock * 2, 0);
    const mx = (ax + bx) / 2, my = (ay + by) / 2, ang = Math.atan2(by - ay, bx - ax) - Math.PI / 2, L = z.l * 2 - 0.4;
    for (const b of [z.beam, z.outer]) { b.position.set(mx, my, 0); b.rotation.z = ang; b.scale.set(1, L, 1); }
    z.outer.material.opacity = 0.3 + Math.random() * 0.3; z.outer.scale.x = z.outer.scale.z = 0.8 + Math.random() * 0.5;
    const pa = z.bolt.geometry.attributes.position, nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
    for (let i = 0; i < 14; i++) { const u = i / 13, j = (i === 0 || i === 13) ? 0 : (Math.random() - 0.5) * 0.45; pa.setXYZ(i, ax + (bx - ax) * u + nx / nl * j, ay + (by - ay) * u + ny / nl * j, 0.3); }
    pa.needsUpdate = true;
  }
  // missiles
  for (const m of missiles) {
    if (m.phase === 'warn') {
      m.t -= dt;
      if (m.t > 0.55) m.y = lerp(m.y, py + HC + (m.off || 0), 0.12 * dtf); else if (m.lockY == null) { m.lockY = clamp(m.y, 0.5, H - 0.6); m.warn.classList.add('lock'); tone(1320, 0.05, 'square', 0.06, 1); }
      const yy = m.lockY ?? m.y, sx = screenRightX(yy), [, sy] = toScreen(sx, yy);
      m.warn.style.left = innerWidth - 8 + 'px'; m.warn.style.top = sy + 'px';
      m.warn.style.transform = `scale(${1 + Math.sin(clock * (m.lockY == null ? 14 : 30)) * 0.12})`;
      if (m.t <= 0) { m.phase = 'fly'; m.y = m.lockY ?? m.y; m.x = sx + 4; m.g.visible = true; m.warn.classList.add('hc-hidden'); tone(300, 0.4, 'sawtooth', 0.06, 2.2); }
      if (state !== 'play') { m.phase = 'off'; m.warn.classList.add('hc-hidden'); }
    } else if (m.phase === 'fly') {
      m.x -= m.v * dt; m.g.position.set(m.x, m.y, 0); m.g.rotation.x += dt * 8; m.fl.scale.setScalar(1.1 + Math.random() * 0.6);
      if (Math.random() < 0.6) fx.emit(new THREE.Vector3(m.x + 0.8, m.y, 0), ['#ffb347', '#ffffff', '#cccccc'], 1, { speed: 0.02, size: 0.5, up: 0.01, life: 0.7 });
      if (m.x < px - 14) { m.phase = 'off'; m.g.visible = false; }
    }
  }
  // interns
  for (const n of interns) {
    if (n.x < camX - 9) { n.x = camX + 14 + Math.random() * 10; n.flee = 0; n.v = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5); }
    const d = n.x - px;
    if (!n.flee && state === 'play' && d < 3.5 && d > -1) { n.flee = 1; if (Math.random() < 0.5) tone(900 + Math.random() * 300, 0.1, 'triangle', 0.05, 1.4); }
    const v = n.flee ? -3.2 : n.v; n.x += v * dt;
    n.g.position.set(n.x, 0, n.z); n.g.rotation.y = v > 0 ? Math.PI / 2 : -Math.PI / 2; n.g.run(clock + n.z * 3, n.flee ? 1.6 : 0.6);
    if (n.flee) { n.g.armL.rotation.x = Math.PI * 0.9; n.g.armR.rotation.x = Math.PI * 0.85; }
  }
  // token
  if (token.visible) { token.position.y += Math.sin(clock * 2.4) * 0.01; tokenStar.rotation.set(clock, clock * 1.6, 0); token.scale.setScalar(1 + Math.sin(clock * 5) * 0.06); if (token.position.x < px - 10) token.visible = false; }
  // hero pose
  hero.position.set(px, py, 0);
  if (state !== 'dying' && state !== 'over' && state !== 'lost' && state !== 'won') {
    const run = onFloor && state !== 'ready' ? 1 : 0, ph = clock * 16;
    legs[0].rotation.z = run ? Math.sin(ph) * 0.9 : lerp(legs[0].rotation.z, thrust ? -0.5 : 0.25, 0.2);
    legs[1].rotation.z = run ? -Math.sin(ph) * 0.9 : lerp(legs[1].rotation.z, thrust ? -0.3 : 0.4, 0.2);
    arms[0].rotation.z = run ? -Math.sin(ph) * 0.7 : lerp(arms[0].rotation.z, thrust ? 0.9 : -1.6, 0.15);
    arms[1].rotation.z = run ? Math.sin(ph) * 0.7 : lerp(arms[1].rotation.z, thrust ? 0.7 : -1.4, 0.15);
    rig.position.y = run ? Math.abs(Math.sin(ph)) * 0.06 : Math.sin(clock * 6) * 0.03;
    rig.rotation.z = lerp(rig.rotation.z, state === 'play' ? clamp(-vy * 0.035, -0.25, 0.3) - 0.08 : 0, 0.15);
    const sq = clamp(vy * 0.02, -0.08, 0.1); rig.scale.set(1 - sq, 1 + sq, 1);
  }
  hero.rotation.y = -0.5;
  const fOn = thrust ? 1 : 0;
  for (let i = 0; i < flames.length; i++) { const f = flames[i]; f.visible = fOn > 0; f.scale.set(1, 0.7 + Math.random() * 0.6, 1); }
  heroGlow.position.set(px - 0.5, py + 0.1, 0.3); heroGlow.material.opacity = thrust ? 0.7 + Math.random() * 0.2 : 0;
  heroShadow.position.set(px, 0.01, 0); const sh = clamp(1 - py / H, 0.25, 1); heroShadow.scale.setScalar(sh); heroShadow.material.opacity = 0.22 * sh;
  antBall.material.color.setHSL((clock * 0.3) % 1, 0.9, 0.62);
  if (bubble.visible) { bubble.position.set(px, py + HC, 0); const w = Math.sin(clock * 7) * 0.05; bubble.scale.set(1.05 + w, 1.05 - w, 1.05); }
  hero.visible = invulnT > 0 && state === 'play' ? Math.floor(clock * 14) % 2 === 0 : true;
  fx.update(dtf);
  // camera: side view with a slight forward yaw so more of the lab ahead is visible
  camX = state === 'ready' ? px : lerp(camX, px + (state === 'play' ? 0 : -1.6), (state === 'play' ? 0.25 : 0.05) * dtf);
  camY = lerp(camY, H / 2 + clamp((py - H / 2) * 0.12, -0.5, 0.5), 0.06 * dtf);
  shake = Math.max(0, shake - dt * 1.4);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.position.set(camX + 2.0 + sx, camY + 1.8 + sy, 19);
  camera.lookAt(camX + 2.8 + sx, camY - 0.4 + sy, 0);
  stage.followLight(_v.set(camX + 3, 2, 0));
  layoutCorridor(camX);
});

reset(); ui.start(); camX = px; layoutCorridor(0);

// ---------------------------------------------------------------- test hook + bot: tries every hold/release plan over the next ~0.8 s and keeps the safest
window.__game = {
  _qa: { missile: (n) => launchMissile(n), bubble: () => { token.visible = true; token.position.set(px + 3, py + HC, 0); } },
  get state() { return state === 'dying' || state === 'over' ? 'play' : state; }, get level() { return sector; }, get score() { return score; },
  bot() {
    if (state !== 'play') { botHold = false; return; }
    const STEP = 0.12, N = 7, sub = 4, h = STEP / sub;
    let bestPlan = 0, bestVal = -1e9;
    const g = bubbleT > 0 ? 15 : 27, up = bubbleT > 0 ? 30 : 52, vmin = bubbleT > 0 ? -6 : -12, vmax = bubbleT > 0 ? 6 : 9.5;
    for (let plan = 0; plan < (1 << N); plan++) {
      let y = py, v = vy, t = 0, x = px, worst = 99, coinsNear = 0;
      for (let s = 0; s < N; s++) {
        const on = (plan >> s) & 1;
        for (let k = 0; k < sub; k++) {
          v = clamp(v + (on ? up - g : -g) * h, vmin, vmax); y += v * h; t += h; x += speed * h;
          if (y < 0) { y = 0; v = Math.max(0, v); } if (y > H - 1.6) { y = H - 1.6; v = Math.min(0, v); }
          worst = Math.min(worst, clearance(x, y + HC, t));
        }
      }
      for (const k of coins) if (!k.got && k.x > px && k.x < px + 5 && Math.abs(k.y - (y + HC)) < 0.8) coinsNear++;
      const val = Math.min(worst, 1.2) * 10 - Math.abs(y + HC - H / 2) * 0.15 + coinsNear * 0.05;
      if (val > bestVal) { bestVal = val; bestPlan = plan; }
    }
    botHold = !!(bestPlan & 1);
  },
};

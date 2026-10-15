// Crackle Pick — original honeycomb-toffee carving game. Drag the pin along the pressed-in line to carve the shape out.
// Stray off the line while pressing and the toffee cracks; carve the whole outline before the timer runs out.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, burst, confetti, sfx, tone, note, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Crackle Pick: Honeycomb Carving Game';
const S = store('cracklepick');
const F = flow('cracklepick');
const B = board({ game: 'crackle-pick', label: 'Points', limits: { maxRun: 700, maxPerSec: 120 }, mode: 'sum' });
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 40, shadowSize: 5 });
const { scene, camera } = stage;
const ui = createUI({ title: 'CRACKLE<br>PICK', hint: 'Tap the line to carve · or drag along it', hand: '👆' });
const D = daily('cracklepick', ui, { name: NAME });
const crackEl = document.getElementById('crack'), crackFill = document.getElementById('crackFill');

const RD = 1.6, TH = 0.14, CS = 1024, STEP = 0.022, FINGER = 70;
const THEMES = [
  { bg: ['#ffd6a5', '#fff1e0'], cloth: ['#ff8fa3', '#ffffff'], plate: '#ffffff', pin: '#ff5d8f', ui: '#ff7b54' },
  { bg: ['#bde0fe', '#eef7ff'], cloth: ['#7fb3ff', '#ffffff'], plate: '#fff9ef', pin: '#7b5cff', ui: '#3a86ff' },
  { bg: ['#caffbf', '#f3fff0'], cloth: ['#52b788', '#ffffff'], plate: '#ffffff', pin: '#ff8c42', ui: '#2a9d8f' },
  { bg: ['#e2c6ff', '#fbefff'], cloth: ['#b388ff', '#ffffff'], plate: '#ffffff', pin: '#00a6fb', ui: '#7b5cff' },
];

// ---------------------------------------------------------------- shapes (closed polylines in disc space x,z; ~0.85 radius)
const poly = (pts) => pts;
function regular(n, r, rot = -Math.PI / 2) { const p = []; for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
function starPts(n, r1, r2) { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r2 : r1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; }
const SHAPES = [
  { name: 'Circle', pts: () => regular(64, 0.82) },
  { name: 'Triangle', pts: () => regular(3, 0.95, -Math.PI / 2).map(([x, z]) => [x, z + 0.12]) },
  { name: 'Diamond', pts: () => [[0, -0.95], [0.68, 0], [0, 0.95], [-0.68, 0]] },
  { name: 'Heart', pts: () => { const p = []; for (let i = 0; i < 80; i++) { const t = i / 80 * Math.PI * 2; p.push([0.052 * 16 * Math.sin(t) ** 3, -0.052 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 0.08]); } return p; } },
  { name: 'Star', pts: () => starPts(5, 0.98, 0.42).map(([x, z]) => [x, z + 0.07]) },
  { name: 'House', pts: () => [[0, -0.95], [0.78, -0.2], [0.6, -0.2], [0.6, 0.78], [-0.6, 0.78], [-0.6, -0.2], [-0.78, -0.2]] },
  { name: 'Moon', pts: () => { const p = []; for (let i = 0; i <= 40; i++) { const a = -2.3 + i / 40 * 4.6; p.push([Math.cos(a + Math.PI) * 0.85 + 0.05, Math.sin(a + Math.PI) * 0.85]); } for (let i = 40; i >= 0; i--) { const a = -1.9 + i / 40 * 3.8; p.push([Math.cos(a + Math.PI) * 0.62 + 0.36, Math.sin(a + Math.PI) * 0.62]); } return p; } },
  { name: 'Bolt', pts: () => [[0.15, -0.98], [0.62, -0.98], [0.28, -0.22], [0.66, -0.22], [-0.28, 0.98], [-0.02, 0.12], [-0.46, 0.12]] },
  { name: 'Clover', pts: () => { const p = []; for (let i = 0; i < 120; i++) { const t = i / 120 * Math.PI * 2, r = 0.6 + 0.3 * Math.abs(Math.cos(2 * t)); p.push([Math.cos(t) * r, Math.sin(t) * r]); } return p; } },
  { name: 'Six-star', pts: () => starPts(6, 0.95, 0.52) },
];
function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) out.push(new THREE.Vector2(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n));
  }
  return out;
}

// ---------------------------------------------------------------- toffee canvas (top face texture + bump)
const cv = document.createElement('canvas'); cv.width = cv.height = CS; const cx = cv.getContext('2d');
const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
tex.repeat.set(1 / (2 * RD), 1 / (2 * RD)); tex.offset.set(0.5, 0.5);
const bump = new THREE.CanvasTexture(cv); bump.repeat.copy(tex.repeat); bump.offset.copy(tex.offset);
const P = (x, z) => [(x / RD + 1) / 2 * CS, (z / RD + 1) / 2 * CS];
const PX = CS / (2 * RD);   // px per unit
function paintBase(r, path) {
  const g = cx.createRadialGradient(CS / 2, CS * 0.45, 0, CS / 2, CS / 2, CS / 2);
  g.addColorStop(0, '#ffcf6e'); g.addColorStop(0.75, '#f2ac3c'); g.addColorStop(1, '#d98a24');
  cx.fillStyle = g; cx.fillRect(0, 0, CS, CS);
  // honeycomb bubbles: light domes + dark pores
  for (let i = 0; i < 1400; i++) { const x = r() * CS, y = r() * CS, s = 2 + r() * 9; cx.fillStyle = `rgba(255,236,170,${0.15 + r() * 0.35})`; cx.beginPath(); cx.arc(x, y, s, 0, 7); cx.fill(); }
  for (let i = 0; i < 900; i++) { const x = r() * CS, y = r() * CS, s = 1 + r() * 4; cx.fillStyle = `rgba(150,80,10,${0.15 + r() * 0.3})`; cx.beginPath(); cx.arc(x, y, s, 0, 7); cx.fill(); }
  for (let i = 0; i < 300; i++) { const x = r() * CS, y = r() * CS; cx.fillStyle = 'rgba(255,255,255,0.35)'; cx.fillRect(x, y, 2, 2); }
  // pressed-in outline (embossed: dark lower lip + light upper lip)
  const line = (dx, dy, col, w) => { cx.strokeStyle = col; cx.lineWidth = w; cx.lineJoin = 'round'; cx.beginPath(); path.forEach((p, i) => { const [a, b] = P(p.x, p.y); i ? cx.lineTo(a + dx, b + dy) : cx.moveTo(a + dx, b + dy); }); cx.closePath(); cx.stroke(); };
  line(0, 3, 'rgba(140,70,5,0.75)', 9); line(0, -2, 'rgba(255,240,190,0.85)', 5); line(0, 0, 'rgba(170,95,15,0.85)', 4);
  tex.needsUpdate = bump.needsUpdate = true;
}
function paintGroove(x, z) {
  const [a, b] = P(x, z);
  cx.fillStyle = '#3f1f03'; cx.beginPath(); cx.arc(a, b + 1, 9, 0, 7); cx.fill();
  cx.fillStyle = '#6b3708'; cx.beginPath(); cx.arc(a, b - 1, 5, 0, 7); cx.fill();
  dirty = true;
}
function paintScratch(x, z) { const [a, b] = P(x, z); cx.fillStyle = 'rgba(110,55,5,0.55)'; cx.beginPath(); cx.arc(a, b, 4, 0, 7); cx.fill(); dirty = true; }
function paintCrack(x, z, len, r) {
  let [a, b] = P(x, z); let ang = Math.atan2(b - CS / 2, a - CS / 2) + (r() - 0.5) * 1.2;
  const seg = 12 + Math.floor(len * 18);
  const draw = (w, col) => { cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round'; };
  const pts = [[a, b]];
  for (let i = 0; i < seg; i++) { ang += (r() - 0.5) * 0.9; a += Math.cos(ang) * 14; b += Math.sin(ang) * 14; pts.push([a, b]); if (Math.hypot(a - CS / 2, b - CS / 2) > CS / 2) break; }
  for (const [w, col] of [[7, 'rgba(255,230,160,0.6)'], [4, '#3b1d03']]) { draw(w, col); cx.beginPath(); pts.forEach(([u, v], i) => i ? cx.lineTo(u, v) : cx.moveTo(u, v)); cx.stroke(); }
  // a little branch
  const k = Math.floor(pts.length / 2); if (k > 1) { draw(3, '#3b1d03'); cx.beginPath(); cx.moveTo(...pts[k]); let [u, v] = pts[k], an = ang + 1.2; for (let i = 0; i < 5; i++) { an += (r() - 0.5); u += Math.cos(an) * 10; v += Math.sin(an) * 10; cx.lineTo(u, v); } cx.stroke(); }
  dirty = true;
}
let dirty = false;

// ---------------------------------------------------------------- scene
const topMat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 2.2, roughness: 0.55, metalness: 0.0 });
const sideMat = new THREE.MeshStandardMaterial({ color: '#d9902a', roughness: 0.6, map: tex });
function extrudeShape(pts2) {          // pts2 in disc space (x,z); returns geometry lying flat with top at y = TH
  const s = new THREE.Shape(); pts2.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: TH - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 48 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0); return g;
}
const circlePts = regular(96, RD).map(p => p);
const disc = new THREE.Mesh(extrudeShape(circlePts), [topMat, sideMat]); disc.castShadow = true; disc.receiveShadow = true; scene.add(disc);
// plate + tablecloth
const plateMat = glossy('#ffffff');
const plate = new THREE.Mesh(new THREE.CylinderGeometry(RD + 0.35, RD + 0.1, 0.1, 64), plateMat); plate.position.y = -0.05; plate.receiveShadow = true; scene.add(plate);
const plateRim = new THREE.Mesh(new THREE.TorusGeometry(RD + 0.33, 0.05, 8, 64), plateMat); plateRim.rotation.x = Math.PI / 2; plateRim.position.y = 0.0; scene.add(plateRim);
function clothTex(c1, c2) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = c2; g.fillRect(0, 0, 256, 256); g.fillStyle = c1; g.globalAlpha = 0.55;
  for (let i = 0; i < 8; i++) { g.fillRect(i * 32, 0, 16, 256); g.fillRect(0, i * 32, 256, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.anisotropy = 8; return t;
}
const table = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ roughness: 0.9 })); table.rotation.x = -Math.PI / 2; table.position.y = -0.1; table.receiveShadow = true; scene.add(table);
// little props on the table: a cup of tea and a few toffee crumbs
const cup = new THREE.Group();
{ const cm = glossy('#ffffff'); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.36, 0.7, 28, 1, true), cm); c.position.y = 0.25; c.castShadow = true;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.43, 28), mat('#c26a2c')); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.48;
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 16), cm); h.position.set(0.5, 0.28, 0);
  const sauc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 0.06, 28), cm); sauc.position.y = -0.08; sauc.receiveShadow = true;
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.36, 20), cm); bot.rotation.x = -Math.PI / 2; bot.position.y = -0.1;
  cup.add(c, tea, h, sauc, bot); cup.position.set(-2.45, 0, -2.7); scene.add(cup); }

// a teaspoon resting on the cloth
{ const sm = new THREE.MeshStandardMaterial({ color: '#e8edf2', metalness: 0.8, roughness: 0.25 });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm); bowl.scale.set(1, 0.35, 1.4); bowl.rotation.x = Math.PI; bowl.position.set(0, 0.1, 0);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.5, 4, 8), sm); handle.rotation.x = Math.PI / 2; handle.position.set(0, 0.06, 1.15);
  const spoon = new THREE.Group(); spoon.add(bowl, handle); spoon.position.set(-2.0, -0.05, 2.3); spoon.rotation.y = 0.5; spoon.traverse(o => o.castShadow = true); scene.add(spoon); }
// the pin: steel needle with a big glossy pearl head
const pin = new THREE.Group();
const pinHeadMat = glossy('#ff5d8f', { roughness: 0.15 });
{ const steel = new THREE.MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.85, roughness: 0.22 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 10), steel); shaft.position.y = 0.95; shaft.castShadow = true;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 10), steel); tip.rotation.x = Math.PI; tip.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), pinHeadMat); head.position.y = 1.85; head.castShadow = true;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); shine.position.set(-0.08, 1.93, 0.13);
  pin.add(shaft, tip, head, shine); }
pin.rotation.set(-0.42, 0, -0.38);   // leans back toward the camera and to the right
scene.add(pin);
const tipDot = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false }));
tipDot.rotation.x = -Math.PI / 2; scene.add(tipDot);

let theme;
function applyTheme(t) {
  theme = t;
  document.body.style.setProperty('--bg1', t.bg[0]); document.body.style.setProperty('--bg2', t.bg[1]); document.body.style.setProperty('--ui', t.ui);
  if (table.material.map) table.material.map.dispose(); table.material.map = clothTex(t.cloth[0], t.cloth[1]); table.material.needsUpdate = true;
  plateMat.color.set(t.plate); pinHeadMat.color.set(t.pin);
}

// ---------------------------------------------------------------- state
let state = 'ready', path = [], carved = [], nCarved = 0, stress = 0, timeLeft = 30, timeMax = 30, tol = 0.08, stressRate = 0.8, score = 0;
let tip = new THREE.Vector3(0, TH, 1.0), tipTarget = tip.clone(), pressing = false, lift = 0.25, R = rng(1), shape = SHAPES[0];
let pieces = [], cutout = null, cutT = 0, shake = 0, beatShown = false, recorded = false, crackLevel = 0, scratchT = 0, crumbT = 0, botIdx = 0, lastWarn = 0;

function buildLevel() {
  R = rng((D.seed || level * 7333) + 3);
  applyTheme(THEMES[(level - 1) % THEMES.length]);
  pieces.forEach(p => scene.remove(p.m)); pieces = [];
  if (cutout) { scene.remove(cutout); cutout = null; }
  disc.visible = true; disc.position.set(0, 0, 0); disc.rotation.set(0, 0, 0);
  const fk = F.k();
  shape = SHAPES[level <= SHAPES.length ? level - 1 : Math.floor(R() * SHAPES.length)];
  let pts = shape.pts();
  const rot = level > 3 ? (R() - 0.5) * 0.5 : 0, sc = 1.04 + R() * 0.12;
  pts = pts.map(([x, z]) => [(x * Math.cos(rot) - z * Math.sin(rot)) * sc, (x * Math.sin(rot) + z * Math.cos(rot)) * sc]);
  path = resample(pts, STEP); carved = new Array(path.length).fill(false); nCarved = 0;
  let per = 0; for (let i = 0; i < path.length; i++) per += path[i].distanceTo(path[(i + 1) % path.length]);
  tol = clamp((0.1 - level * 0.0035) / fk, 0.05, 0.12);
  stressRate = clamp((0.5 + level * 0.04) * fk, 0.4, 1.6);
  timeMax = timeLeft = Math.round(clamp((10 + per * 2.6 - level * 0.4) / fk, 9, 40));
  stress = 0; crackLevel = 0; score = 0; beatShown = false; recorded = false; botIdx = 0;
  paintBase(rng(level * 31 + 7), path);
  ui.levels(level); ui.progress(0); ui.score('0%'); ui.sub(shape.name.toUpperCase() + (best ? ' · BEST ' + best : ''));
  updateCrack(); ui.pill('⏱ ' + timeLeft);
  tip.set(0.9, TH, 1.25); tipTarget.copy(tip);
}

function updateCrack() {
  crackFill.style.width = Math.min(1, stress) * 100 + '%';
  crackEl.classList.toggle('hot', stress > 0.66);
}

// carve / stress along the movement from the current tip to p
const _a = new THREE.Vector2();
function moveTip(nx, nz) {
  const dx = nx - tip.x, dz = nz - tip.z, L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / 0.02));
  let carvedNow = 0, offNow = 0;
  for (let s = 1; s <= n; s++) {
    const qx = tip.x + dx * s / n, qz = tip.z + dz * s / n;
    if (!pressing || state !== 'play') continue;
    if (Math.hypot(qx, qz) > RD - 0.05) continue;
    _a.set(qx, qz);
    let dmin = 1e9;
    for (let i = 0; i < path.length; i++) {
      const d = path[i].distanceTo(_a); if (d < dmin) dmin = d;
      if (d < tol * 0.85 && !carved[i]) { carved[i] = true; nCarved++; carvedNow++; paintGroove(path[i].x, path[i].y); }
    }
    if (dmin > tol) {
      const add = (L / n) * stressRate * (dmin > tol * 2.2 ? 1.25 : 0.8);
      stress += add; offNow += add;
      if ((scratchT += L / n) > 0.03) { scratchT = 0; paintScratch(qx, qz); }
      const lvl = stress >= 1 ? 3 : stress > 0.66 ? 2 : stress > 0.33 ? 1 : 0;
      if (lvl > crackLevel) { crackLevel = lvl; crack(qx, qz, lvl); }
    }
  }
  tip.x = nx; tip.z = nz;
  if (carvedNow) onCarve(carvedNow);
  if (offNow) { updateCrack(); const now = performance.now(); if (now - lastWarn > 140) { lastWarn = now; tone(140 + Math.random() * 60, 0.05, 'square', 0.04, 0.7); } }
  if (stress >= 1 && state === 'play') shatter();
}
let carveSnd = 0;
function onCarve(k) {
  const now = performance.now();
  if (now - carveSnd > 45) { carveSnd = now; tone(1500 + Math.random() * 900, 0.03, 'sawtooth', 0.03, 0.5); buzz(3); }
  if ((crumbT += k) > 6) { crumbT = 0; burst(scene, new THREE.Vector3(tip.x, TH + 0.02, tip.z), ['#ffd27a', '#e59a2f', '#fff1c4'], 3, { speed: 0.025, up: 0.035, size: 0.22, gravity: 0.004, life: 0.7 }); }
  const prog = nCarved / path.length;
  ui.progress(prog); ui.score(Math.floor(prog * 100) + '%');
  // milestone chimes at quarter marks
  const q = Math.floor(prog * 4); if (q > (onCarve.q || 0) && q < 4) { onCarve.q = q; note(72 + [0, 4, 7][q - 1], 0.25, 0.12); ui.pop(['NICE', 'STEADY', 'ALMOST'][q - 1], '#fff', 26, 30); }
  if (prog >= 0.985 && state === 'play') win();
}
function crack(x, z, lvl) {
  const r = rng(Math.floor(x * 1000 + z * 7777 + lvl) + 11);
  paintCrack(x, z, 0.5 + lvl * 0.4, r); if (lvl >= 2) paintCrack(x, z, 0.4 + lvl * 0.3, r);
  shake = 0.05 + lvl * 0.03; buzz(lvl >= 2 ? [30, 20, 30] : 25);
  tone(90, 0.18, 'square', 0.12, 0.5); tone(1200, 0.05, 'sawtooth', 0.05, 0.3);
  ui.flash(0.12 * lvl);
  if (lvl < 3) ui.pop(lvl === 1 ? 'CAREFUL!' : 'IT\'S CRACKING!', '#ff4d4d', 30, 34);
}

function shatter() {
  if (state !== 'play') return; state = 'lost'; pressing = false;
  if (!recorded) { recorded = true; F.level(false, nCarved / path.length); }
  disc.visible = false;
  // wedge pieces with jagged edges, same UVs so they keep the carved texture
  const n = 7, r = rng(level * 13 + 1), cxo = (r() - 0.5) * 0.4, czo = (r() - 0.5) * 0.4;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2 + r() * 0.2, a1 = (i + 1) / n * Math.PI * 2 + r() * 0.2, pts = [[cxo, czo]];
    for (let k = 1; k < 4; k++) { const t = k / 4; pts.push([cxo + (Math.cos(a0) * RD - cxo) * t + (r() - 0.5) * 0.12, czo + (Math.sin(a0) * RD - czo) * t + (r() - 0.5) * 0.12]); }
    for (let k = 0; k <= 10; k++) { const a = a0 + (a1 - a0) * k / 10; pts.push([Math.cos(a) * RD, Math.sin(a) * RD]); }
    for (let k = 3; k >= 1; k--) { const t = k / 4; pts.push([cxo + (Math.cos(a1) * RD - cxo) * t + (r() - 0.5) * 0.12, czo + (Math.sin(a1) * RD - czo) * t + (r() - 0.5) * 0.12]); }
    const gx = pts.reduce((a, q) => a + q[0], 0) / pts.length, gz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    const geo = extrudeShape(pts); geo.translate(-gx, 0, -gz);
    const m = new THREE.Mesh(geo, [topMat, sideMat]); m.position.set(gx, 0, gz); m.castShadow = true; scene.add(m);
    const am = (a0 + a1) / 2;
    pieces.push({ m, v: new THREE.Vector3(Math.cos(am) * 0.016, 0.035 + r() * 0.03, Math.sin(am) * 0.016), rv: new THREE.Vector3((r() - 0.5) * 0.03, (r() - 0.5) * 0.03, (r() - 0.5) * 0.03), landed: false });
  }
  burst(scene, new THREE.Vector3(tip.x, TH, tip.z), ['#ffd27a', '#e59a2f', '#fff1c4', '#a85d10'], 40, { speed: 0.09, up: 0.1, size: 0.4, gravity: 0.006 });
  shake = 0.35; ui.flash(0.5); sfx.smash(); buzz([60, 40, 90]);
  crackEl.classList.add('off'); ui.pill('');
  ui.lose('CRACKED!', `${Math.round(nCarved / path.length * 100)}% carved`);
}
function timeUp() {
  if (state !== 'play') return; state = 'lost'; pressing = false;
  if (!recorded) { recorded = true; F.level(false, nCarved / path.length); }
  sfx.fail(); buzz([40, 60, 40]); crackEl.classList.add('off');
  ui.lose('TIME\'S UP!', `${Math.round(nCarved / path.length * 100)}% carved`);
}
function win() {
  if (state !== 'play') return; state = 'won'; pressing = false;
  if (!recorded) { recorded = true; F.level(true); }
  for (let i = 0; i < path.length; i++) if (!carved[i]) { carved[i] = true; paintGroove(path[i].x, path[i].y); }
  ui.progress(1);
  const clean = 1 - Math.min(1, stress);
  score = 100 + Math.round(timeLeft) * 5 + Math.round(clean * 50); ui.score(score);
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff36b', 44, 40); }
  // pop the carved shape out of the disc
  cutout = new THREE.Mesh(extrudeShape(path.map(p => [p.x, p.y])), [topMat, sideMat]); cutout.castShadow = true; scene.add(cutout); cutT = 0;
  confetti(scene, new THREE.Vector3(0, 0.8, 0), 90);
  burst(scene, new THREE.Vector3(0, TH, 0), ['#ffd27a', '#fff1c4'], 30, { speed: 0.08, up: 0.08, size: 0.35, gravity: 0.005 });
  sfx.win(); buzz([20, 40, 20, 40, 60]); ui.flash(0.4);
  ui.pop(stress < 0.05 ? 'FLAWLESS!' : 'CARVED!', '#fff', 46, 26);
  crackEl.classList.add('off'); ui.pill('');
  level++; S.set('level', level);
  D.won(score); B.submit(score);
  ui.win(level - 1, `${score} pts · ${Math.round(timeLeft)}s left`);
}

// ---------------------------------------------------------------- input → pin tip (just above the finger)
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TH), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();
function screenToDisc(x, y) {
  _ndc.set(x / innerWidth * 2 - 1, -((y - FINGER) / innerHeight) * 2 + 1);
  ray.setFromCamera(_ndc, camera); return ray.ray.intersectPlane(plane, _hit) ? _hit : null;
}
input({
  onDown: (e) => { if (state !== 'play') return; trace = null; const h = screenToDisc(e.clientX, e.clientY); if (!h) return; tip.set(h.x, TH, h.z); pressing = true; tone(900, 0.03, 'triangle', 0.06, 0.8); moveTip(h.x, h.z); },
  onMove: (dx, dy, e) => { if (state !== 'play' || !pressing) return; const h = screenToDisc(e.clientX, e.clientY); if (h) moveTip(h.x, h.z); },
  onUp: (e, st) => {
    pressing = false; if (state !== 'play' || !st || Math.hypot(e.clientX - st.x, e.clientY - st.y) >= 12) return;
    // a tap near the line: the pin snaps onto it and carves a short stretch by itself
    const h = screenToDisc(e.clientX, e.clientY + FINGER); if (!h) return; _a.set(h.x, h.z);
    let bi = -1, bd = 0.3; path.forEach((p, i) => { const d = p.distanceTo(_a); if (d < bd) { bd = d; bi = i; } }); if (bi < 0) return;
    const P = path.length, dir = carved[(bi + 1) % P] && !carved[(bi - 1 + P) % P] ? -1 : 1;
    trace = { i: bi, dir, n: Math.ceil(P * 0.09) }; tip.set(path[bi].x, TH, path[bi].y); tone(900, 0.03, 'triangle', 0.06, 0.8);
  },
});
let trace = null;
ui.onTap(() => { buildLevel(); state = 'play'; B.start(); crackEl.classList.remove('off'); ui.els.sc.classList.remove('hc-hidden'); onCarve.q = 0; });

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  if (dirty) { tex.needsUpdate = bump.needsUpdate = true; dirty = false; }
  if (state === 'play') {
    if (trace && !pressing) { for (let k = 0; k < 2 && trace && trace.n > 0; k++, trace.n--) { const p = path[trace.i = (trace.i + trace.dir + path.length) % path.length]; pressing = true; moveTip(p.x, p.y); pressing = false; } if (trace && trace.n <= 0) trace = null; }
    timeLeft -= dt / 60;
    const s = Math.ceil(timeLeft); ui.pill('⏱ ' + Math.max(0, s));
    ui.els.pill.classList.toggle('low', timeLeft < 5);
    if (timeLeft < 5 && Math.ceil(timeLeft + dt / 60) !== s) tone(880, 0.06, 'square', 0.06, 1);
    if (timeLeft <= 0) timeUp();
  }
  // pin: tip follows the touch point; lifts when not pressing
  lift = lerp(lift, pressing ? 0 : 0.22, 0.3 * dt);
  const jitter = pressing ? (Math.random() - 0.5) * 0.004 : 0;
  pin.position.set(tip.x + jitter, TH + lift, tip.z + jitter);
  pin.visible = state !== 'won' || cutT < 0.2;
  tipDot.position.set(tip.x, TH + 0.012, tip.z); tipDot.material.opacity = state === 'play' && !pressing ? 0.6 + Math.sin(t * 6) * 0.3 : 0;
  // win: cutout lifts, tilts toward the camera, spins gently
  if (cutout) {
    cutT += dt / 60; const k = Math.min(1, cutT / 0.6), e = 1 - Math.pow(1 - k, 3);
    cutout.position.set(0, e * 1.1 + Math.sin(cutT * 3) * 0.05, e * 0.4);
    cutout.rotation.x = e * 0.9; cutout.rotation.z = Math.sin(cutT * 2) * 0.12 * e;
    cutout.scale.setScalar(1 + e * 0.15);
    disc.position.y = -e * 0.02;
  }
  // shatter pieces fall off the plate
  for (const p of pieces) { p.v.y -= 0.004 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.rv.x * dt; p.m.rotation.y += p.rv.y * dt; p.m.rotation.z += p.rv.z * dt; if (p.m.position.y < 0) { p.m.position.y = 0; p.v.y = Math.abs(p.v.y) * 0.25; p.v.x *= 0.6; p.v.z *= 0.6; p.rv.multiplyScalar(0.4); p.landed = true; } if (p.landed) { p.m.rotation.x = lerp(p.m.rotation.x, 0, 0.12 * dt); p.m.rotation.z = lerp(p.m.rotation.z, 0, 0.12 * dt); } }
  // camera
  shake = Math.max(0, shake - dt * 0.012);
  camera.position.set((Math.random() - 0.5) * shake, 6.9 + (Math.random() - 0.5) * shake, 6.0);
  camera.lookAt(0, -0.35, -0.45);
});

applyTheme(THEMES[(level - 1) % THEMES.length]);
buildLevel(); ui.start(); ui.els.sc.classList.add('hc-hidden'); ui.pill('');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    // walk the pin along the outline from the first uncarved point, a few points per call, with a slightly shaky hand
    if (!pressing) {
      let i = carved.indexOf(false); if (i < 0) return;
      botIdx = i; tip.set(path[i].x, TH, path[i].y); pressing = true; moveTip(path[i].x, path[i].y); return;
    }
    let j = botIdx; for (let k = 0; k < path.length && carved[j % path.length]; k++) j++;
    botIdx = (j + 9) % path.length;
    const p = path[botIdx], wob = Math.random() < 0.08 ? tol * 1.6 : tol * 0.35;
    moveTip(p.x + (Math.random() - 0.5) * wob, p.y + (Math.random() - 0.5) * wob);
    if (nCarved / path.length > 0.9) { const left = carved.indexOf(false); if (left >= 0) { pressing = false; } }
  },
};

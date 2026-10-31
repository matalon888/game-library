// Horde Blast v2 (deep). Same game as v1: hold to fire little blue fighters through multiplier gates and overrun the red
// fortress. Around it: 36 hand-made sieges in 3 worlds (levels.js), flip gates, boulders, heavy and bomber reds, laser lanes,
// supply crates, golden troops, a bomb button, stars per siege (troop spend), a level map and a squad-colour collection from
// star chests. Troop budgets and star pars are measured with a bot (qa/calibrate.cjs -> cal.js). Plan: DESIGN.md.
import { bake, vcMat } from './merge.js';
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapter } from './kit/adapt.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS } from './levels.js';
import CAL from './cal.js';
const WB = board({ game: 'horde-blast', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.3 }, mode: 'sum' });   // +1 only for a level's first clear
const save = store('hordeblast2');
const F = flow('hordeblast');
let fk = 1;
// in-round adaptation and flow.js exactly as v1 (kit/adapt.js, ADAPT_BRIEF.md): never harder on levels 1-2, ±25 % at most, off for
// ranked players, rescue at most once a round for a player who has been aiming well. Never touches the score.
const AD = adapter(); let inAt = -1e9, aimG = 0, aimB = 0, aimT = 0, rescued = false;
const QS = new URLSearchParams(location.search), FAST_QA = QS.has('qa');
const NL = LEVELS.length;
let stars = save.get('stars', []), chestProg = save.get('chest', 0), skins = save.get('skins', [0]), skin = save.get('skin', 0), best = save.get('best', 0);
const unlockedLv = () => { let n = 0; while (n < stars.length && stars[n] > 0) n++; return n + 1; };
let level = +QS.get('level') || Math.min(unlockedLv(), NL + 200), score = 0, state = 'ready';
const { scene, camera, renderer, sun, hemi, followLight } = createStage({ fov: 50, shadowSize: 30 });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); sun.shadow.mapSize.set(1024, 1024);
sun.position.set(8, 20, 6); sun.shadow.camera.far = 90; hemi.intensity = 1.2; sun.intensity = 1.6;
document.body.style.setProperty('--bg1', '#9fd8ff'); document.body.style.setProperty('--bg2', '#ffe2b0'); document.body.style.setProperty('--ui', '#2f7bff');
scene.fog = new THREE.Fog('#f6dfb3', 60, 140);
const ui = createUI({ title: 'HORDE<br>BLAST', hint: 'Tap left or right to fire · hold and drag to aim', hand: '👆' });
Object.assign(ui.els.sub.style, { color: '#fff', fontSize: '18px', fontWeight: '800', textShadow: '0 2px 5px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.5)' });
ui.levels(level);

const W = 5.2, LEN = 44, BASEZ = -LEN, MAXU = 700;
const SKINS = [{ n: 'Cobalt', c: '#2f86ff' }, { n: 'Mint', c: '#25cfa0' }, { n: 'Grape', c: '#8a5cff' }, { n: 'Rose', c: '#ff5fa8' }, { n: 'Lime', c: '#8ad02f' }, { n: 'Sunny', c: '#ffd23f' }, { n: 'Frost', c: '#a9d8ff' }, { n: 'Night Teal', c: '#0f8a9e' }];
// ---------------------------------------------------------------- ground + lane (re-coloured per world)
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const groundTex = (base, specks) => { const t = canvasTex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = specks[i % specks.length]; const s = 1 + Math.random() * 3; x.fillRect(Math.random() * w, Math.random() * h, s, s); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24); return t; };
const GT = [groundTex('#f2d39b', ['#e6c283', '#f7dfae', '#d9b57a', '#8fb35a']), groundTex('#eef6ff', ['#dbeaf7', '#ffffff', '#c8dcee', '#b4d4f0']), groundTex('#3a2630', ['#2a1a24', '#4a3038', '#ff7a3a', '#6a3a30'])];
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: GT[0], roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
const laneTex = canvasTex(128, 512, (x, w, h) => { x.fillStyle = '#b9bdc8'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = Math.random() < 0.5 ? '#b0b4bf' : '#c3c7d1'; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } x.fillStyle = '#ffffff'; for (let y = 0; y < h; y += 64) x.fillRect(w / 2 - 2, y, 4, 32); });
laneTex.wrapT = THREE.RepeatWrapping; laneTex.repeat.set(1, 6);
const lane = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.4, 0.3, LEN + 14), new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.9 }));
lane.position.set(0, 0, -LEN / 2 + 3); lane.receiveShadow = true; scene.add(lane);
const railGeo = rounded(0.5, 0.9, 1.7, 0.12);
const rails = new THREE.InstancedMesh(railGeo, mat('#ffffff'), 140); rails.castShadow = true; scene.add(rails);
let nRails = 0;
function paintRails(c1, c2) { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
  for (const sx of [-1, 1]) for (let z = 8; z > -LEN - 8; z -= 1.8) { m.compose(new THREE.Vector3(sx * (W + 0.55), 0.55, z), q, new THREE.Vector3(1, 1, 1)); rails.setMatrixAt(n, m); rails.setColorAt(n, c.set(n % 2 ? c1 : c2)); n++; }
  rails.count = nRails = n; rails.instanceMatrix.needsUpdate = true; rails.instanceColor.needsUpdate = true; }
paintRails('#3d8bff', '#e9f2ff');
const shrubGeo = bake([{ geo: new THREE.IcosahedronGeometry(0.5, 0), color: '#ffffff' }, { geo: new THREE.IcosahedronGeometry(0.35, 0), color: '#e8e8e8', pos: [0.35, 0.1, 0.1] }]);
const shrubs = new THREE.InstancedMesh(shrubGeo, vcMat({ flatShading: true, color: '#7fa64a' }), 160); shrubs.castShadow = true; scene.add(shrubs);
{ const m = new THREE.Matrix4(), q = new THREE.Quaternion(); const r = rng(99); let n = 0;
  for (let i = 0; i < 160; i++) { const sx = r() < 0.5 ? -1 : 1, x = sx * (W + 2 + r() * 30), z = 10 - r() * (LEN + 40), s = 0.6 + r() * 1.4;
    m.compose(new THREE.Vector3(x, 0.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s * 0.8, s)); shrubs.setMatrixAt(n++, m); }
  shrubs.instanceMatrix.needsUpdate = true; }
const THEMES = [
  { gt: 0, fog: '#f6dfb3', bg: ['#9fd8ff', '#ffe2b0'], ui: '#2f7bff', rails: ['#3d8bff', '#e9f2ff'], shrub: '#7fa64a', lane: '#ffffff', rock: '#c9a878', sun: '#ffffff', hemi: 1.2 },
  { gt: 1, fog: '#dff0ff', bg: ['#bfe6ff', '#f2fbff'], ui: '#3a8dff', rails: ['#7fbfff', '#ffffff'], shrub: '#e6f3ff', lane: '#e0efff', rock: '#cfe6ff', sun: '#ffffff', hemi: 1.35 },
  { gt: 2, fog: '#4a2230', bg: ['#4b2a3c', '#ff9a5c'], ui: '#ff6a2a', rails: ['#ff6a2a', '#3a3a4a'], shrub: '#3a2c30', lane: '#a8909a', rock: '#5a4044', sun: '#ffb48a', hemi: 0.95 },
];
let themeW = -1;
function setTheme(w) { if (w === themeW) return; themeW = w; const T = THEMES[w];
  ground.material.map = GT[T.gt]; ground.material.needsUpdate = true; scene.fog.color.set(T.fog);
  document.body.style.setProperty('--bg1', T.bg[0]); document.body.style.setProperty('--bg2', T.bg[1]); document.body.style.setProperty('--ui', T.ui);
  paintRails(...T.rails); shrubs.material.color.set(T.shrub); lane.material.color.set(T.lane); rockMat.color.set(T.rock); sun.color.set(T.sun); hemi.intensity = T.hemi;
  setFort(w); setBossLook(w); }

// ---------------------------------------------------------------- units (instanced crowds)
const unitGeo = bake([{ geo: new THREE.CapsuleGeometry(0.22, 0.28, 4, 10), color: '#ffffff', pos: [0, 0.38, 0] }, { geo: new THREE.SphereGeometry(0.2, 12, 10), color: '#ffffff', pos: [0, 0.82, 0] },
  { geo: new THREE.SphereGeometry(0.06, 6, 5), color: '#1b2140', pos: [-0.08, 0.86, -0.17] }, { geo: new THREE.SphereGeometry(0.06, 6, 5), color: '#1b2140', pos: [0.08, 0.86, -0.17] },
  { geo: new THREE.CapsuleGeometry(0.07, 0.2, 3, 6), color: '#ffffff', pos: [-0.27, 0.45, 0], rot: [0, 0, 0.4] }, { geo: new THREE.CapsuleGeometry(0.07, 0.2, 3, 6), color: '#ffffff', pos: [0.27, 0.45, 0], rot: [0, 0, -0.4] }]);
const crowd = (color, n = MAXU) => { const m = new THREE.InstancedMesh(unitGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, color }), n); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; };
const blueM = crowd(SKINS[skin].c), goldM = crowd('#ffc21f', 80), redM = crowd('#ff3048'), tankM = crowd('#a3122a', 120), bombM = crowd('#ff9a1f', 120);
let blues = [], reds = [];

function canvasSprite(text, bg = '#ff3048', w = 256, h = 96) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.renderOrder = 20;
  s.set = (txt) => { x.clearRect(0, 0, w, h); x.fillStyle = bg; x.beginPath(); x.roundRect(6, 10, w - 12, h - 20, 30); x.fill(); x.font = '800 58px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(txt, w / 2, h / 2 + 4); s.material.map.needsUpdate = true; };
  s.set(text); return s;
}
// ---------------------------------------------------------------- cannon (colour = the equipped squad)
const cannon = new THREE.Group(); scene.add(cannon);
const cannonGeo = (c1, c2) => bake([
  { geo: rounded(1.9, 0.7, 1.6, 0.25), color: c1, pos: [0, 0.75, 0] },
  { geo: new THREE.SphereGeometry(0.75, 20, 14), color: c2, pos: [0, 1.25, 0.1] },
  ...[-1, 1].flatMap(sx => [{ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), color: '#2b2f45', pos: [sx * 1.05, 0.42, -0.45], rot: [0, 0, Math.PI / 2] }, { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), color: '#2b2f45', pos: [sx * 1.05, 0.42, 0.55], rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12), color: '#c9d3e6', pos: [sx * 1.06, 0.42, -0.45], rot: [0, 0, Math.PI / 2] }, { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12), color: '#c9d3e6', pos: [sx * 1.06, 0.42, 0.55], rot: [0, 0, Math.PI / 2] }])]);
const barrelGeo = (c) => bake([{ geo: new THREE.CylinderGeometry(0.42, 0.5, 1.6, 20), color: c, rot: [Math.PI / 2, 0, 0] }, { geo: new THREE.TorusGeometry(0.46, 0.1, 8, 20), color: '#ffd23f', pos: [0, 0, -0.8] }]);
const cBody = new THREE.Mesh(cannonGeo('#2f86ff', '#5aa2ff'), vcMat({ roughness: 0.3 })); cBody.castShadow = true; cannon.add(cBody);
const barrel = new THREE.Mesh(barrelGeo('#3a8dff'), vcMat({ roughness: 0.25 }));
barrel.position.set(0, 1.35, -0.6); barrel.rotation.x = -0.12; barrel.castShadow = true; cannon.add(barrel);
const tint = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
function applySkin() { const c = SKINS[skin].c; blueM.material.color.set(c); cBody.geometry.dispose(); cBody.geometry = cannonGeo(c, tint(c, 1.25)); barrel.geometry.dispose(); barrel.geometry = barrelGeo(tint(c, 1.1)); }
const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 40), new THREE.MeshBasicMaterial({ color: '#3cff7a', transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.17; cannon.add(ring);
const flash = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0 })); flash.position.set(0, 1.4, -1.6); cannon.add(flash);
cannon.position.set(0, 0.15, 3.5);
const countTag = canvasSprite('0', '#2f6bff'); countTag.scale.set(2.2, 0.82, 1); countTag.position.set(0, 3.55, 0.3); cannon.add(countTag); let lastCount = -1;
const ammoTag = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.renderOrder = 21;
  s.set = (left, max) => { const f = max > 0 ? left / max : 0, low = f < 0.25;
    x.clearRect(0, 0, 256, 72); x.fillStyle = 'rgba(20,24,48,.82)'; x.beginPath(); x.roundRect(4, 6, 248, 60, 26); x.fill();
    x.fillStyle = low ? '#ff3b4e' : '#3cc8ff'; if (f > 0) { x.beginPath(); x.roundRect(10, 12, Math.max(28, 236 * Math.min(1, f)), 48, 22); x.fill(); }
    x.font = '800 44px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(left > 0 ? '🪖 ' + left : 'NO TROOPS', 128, 39); s.material.map.needsUpdate = true; };
  s.scale.set(2.9, 0.82, 1); s.position.set(0, 2.6, 0.3); cannon.add(s); return s; })();

// ---------------------------------------------------------------- fortress + boss (a look per world)
const fort = new THREE.Group(); scene.add(fort);
const fortGeo = (body, crenel, cone, flag) => bake([
  { geo: rounded(8.4, 4.2, 4, 0.3), color: body, pos: [0, 2.1, 0] },
  { geo: rounded(2.4, 1.0, 0.3, 0.1), color: '#4a1018', pos: [0, 0.9, 2.05] },
  ...[-3.6, -1.8, 0, 1.8, 3.6].map(x => ({ geo: rounded(1.0, 0.9, 1.0, 0.12), color: crenel, pos: [x, 4.6, 1.4] })),
  ...[-1, 1].flatMap(sx => [{ geo: new THREE.CylinderGeometry(1.25, 1.4, 6.4, 18), color: tint(body, 0.92), pos: [sx * 4.4, 3.2, 0.4] }, { geo: new THREE.ConeGeometry(1.6, 2.2, 18), color: cone, pos: [sx * 4.4, 7.5, 0.4] },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), color: '#555', pos: [sx * 4.4, 9.3, 0.4] }, { geo: new THREE.BoxGeometry(0.9, 0.55, 0.04), color: flag, pos: [sx * 4.4 + 0.45, 9.9, 0.4] }])]);
const FORTS = [fortGeo('#e8394d', '#ff5266', '#fff1f1', '#ffd23f'), fortGeo('#d9546c', '#bfe6ff', '#e8f6ff', '#7fd0ff'), fortGeo('#4a2a34', '#ff7a3a', '#ff4a2a', '#ffb43f')];
const fortBody = new THREE.Mesh(FORTS[0], vcMat({ roughness: 0.45 })); fortBody.castShadow = fortBody.receiveShadow = true; fort.add(fortBody);
const setFort = w => { fortBody.geometry = FORTS[w]; };
const fortHP = canvasSprite('100'); fortHP.scale.set(5, 1.9, 1); fortHP.position.set(0, 6.4, 2); fort.add(fortHP);
fort.position.set(0, 0, BASEZ - 1);
const bossGeoOf = (b, l) => bake([{ geo: new THREE.CapsuleGeometry(0.9, 1.0, 6, 16), color: b, pos: [0, 1.6, 0] }, { geo: new THREE.SphereGeometry(0.7, 16, 12), color: b, pos: [0, 3.1, 0] },
  { geo: new THREE.CapsuleGeometry(0.42, 1.0, 4, 10), color: l, pos: [-1.25, 2.0, 0], rot: [0, 0, 0.35] }, { geo: new THREE.CapsuleGeometry(0.42, 1.0, 4, 10), color: l, pos: [1.25, 2.0, 0], rot: [0, 0, -0.35] },
  { geo: new THREE.SphereGeometry(0.55, 12, 10), color: l, pos: [-1.45, 1.2, 0] }, { geo: new THREE.SphereGeometry(0.55, 12, 10), color: l, pos: [1.45, 1.2, 0] },
  { geo: new THREE.CapsuleGeometry(0.35, 0.6, 4, 10), color: l, pos: [-0.45, 0.45, 0] }, { geo: new THREE.CapsuleGeometry(0.35, 0.6, 4, 10), color: l, pos: [0.45, 0.45, 0] },
  { geo: new THREE.SphereGeometry(0.15, 8, 6), color: '#1b1b2f', pos: [-0.25, 3.2, -0.62] }, { geo: new THREE.SphereGeometry(0.15, 8, 6), color: '#1b1b2f', pos: [0.25, 3.2, -0.62] },
  { geo: new THREE.BoxGeometry(0.5, 0.12, 0.05), color: '#1b1b2f', pos: [-0.25, 3.45, -0.63], rot: [0, 0, -0.35] }, { geo: new THREE.BoxGeometry(0.5, 0.12, 0.05), color: '#1b1b2f', pos: [0.25, 3.45, -0.63], rot: [0, 0, 0.35] }]);
const BOSSES = [bossGeoOf('#ffcf33', '#ff3048'), bossGeoOf('#d8f0ff', '#5a8fd8'), bossGeoOf('#ff8a2a', '#3a2a34')];
const boss = new THREE.Mesh(BOSSES[0], vcMat({ roughness: 0.35 })); boss.castShadow = true; boss.rotation.y = Math.PI; scene.add(boss);
const setBossLook = w => { boss.geometry = BOSSES[w]; };
const bossHP = canvasSprite('150', '#7a1020'); bossHP.scale.set(3, 1.12, 1); scene.add(bossHP);

// ---------------------------------------------------------------- gates (x = blue multiplier, d = red divide, s = slider, f = flip)
const gateGroup = new THREE.Group(); scene.add(gateGroup);
const GTEX = new Map();
function gateTex(label, bad = false) {
  const key = label + bad; if (GTEX.has(key)) return GTEX.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bad ? 'rgba(255,70,80,0.6)' : 'rgba(70,140,255,0.55)'; x.fillRect(0, 0, 256, 128); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 120);
  x.font = '800 86px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(10,30,90,.35)'; x.strokeText(label, 128, 70); x.fillStyle = '#fff'; x.fillText(label, 128, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; GTEX.set(key, t); return t;
}
const gLabel = m => m < 1 ? '÷' + Math.round(1 / m) : 'x' + m;
let gates = [];
function makeGate(o, z) {
  const g = new THREE.Group(); g.position.set(o.x, 0, z);
  const mult = o.m, slide = o.k === 's', gold = slide;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(o.w, 1.5), new THREE.MeshBasicMaterial({ map: gateTex(gLabel(mult), mult < 1), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  panel.position.y = 1.0; panel.rotation.x = -0.25; g.add(panel);
  const pm = glossy(mult < 1 ? '#ff4b5a' : gold ? '#ffb82f' : '#4b8dff');
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(rounded(0.22, 1.9, 0.22, 0.08), pm); p.position.set(sx * o.w / 2, 0.95, 0); p.castShadow = true; g.add(p); }
  const bar = new THREE.Mesh(rounded(o.w + 0.2, 0.18, 0.22, 0.08), pm); bar.position.y = 1.85; g.add(bar);
  gateGroup.add(g);
  return { g, k: o.k, mult, m0: o.m, cx: o.x, w: o.w, z, move: slide, per: o.per || 3.2, fph: o.ph || 0, bit: 1 << gates.length, ph: Math.random() * 6, pulse: 0, panel, pm, blue: true };
}
const flipBlueAt = (g, t) => ((t + g.fph) % g.per) < g.per * 0.62;
function setFlip(g, blue) { g.blue = blue; g.mult = blue ? g.m0 : 0.5; g.panel.material.map = gateTex(gLabel(g.mult), !blue); g.pm.color.set(blue ? '#4b8dff' : '#ff4b5a'); g.panel.material.opacity = 1; g.pulse = 1; }

// ---------------------------------------------------------------- hazards: crushers, boulders, laser lanes, supply crates
const crushGeo = bake([{ geo: new THREE.CylinderGeometry(0.42, 0.42, 2.4, 16), color: '#3b3f57', rot: [0, 0, Math.PI / 2] },
  ...Array.from({ length: 18 }, (_, i) => { const a = (i % 6) / 6 * Math.PI * 2, xx = -1.0 + Math.floor(i / 6) * 1.0; return { geo: new THREE.ConeGeometry(0.16, 0.42, 6), color: '#ff3048', pos: [xx, Math.cos(a) * 0.55, Math.sin(a) * 0.55], rot: [a, 0, 0] }; }),
  ...[-1, 1].map(sx => ({ geo: new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), color: '#ffd23f', pos: [sx * 1.22, 0, 0], rot: [0, 0, Math.PI / 2] }))]);
const crushGroup = new THREE.Group(); scene.add(crushGroup);
let crushers = [];
function makeCrusher(z, cc, sp, amp) { const m = new THREE.Mesh(crushGeo, vcMat({ roughness: 0.4 })); m.castShadow = true; m.scale.setScalar(1.15); m.position.set(0, 0.7, z); crushGroup.add(m); return { m, z, x: cc, sp, ph: Math.random() * 6, cc, amp, spin: 0 }; }
const rockMat = vcMat({ flatShading: true, color: '#c9a878' });
const rockGeo = bake([{ geo: new THREE.IcosahedronGeometry(1, 0), color: '#a8a8a8', pos: [0, 0.7, 0], scl: [1, 0.85, 1] }, { geo: new THREE.IcosahedronGeometry(0.62, 0), color: '#c8c8c8', pos: [0.55, 0.4, 0.3] }, { geo: new THREE.IcosahedronGeometry(0.5, 0), color: '#8e8e8e', pos: [-0.5, 0.35, -0.3] }]);
const hazGroup = new THREE.Group(); scene.add(hazGroup);
let rocks = [], lasers = [], crates = [];
const laserWarn = new THREE.MeshBasicMaterial({ color: '#ff3040', transparent: true, opacity: 0, depthWrite: false }), laserBeam = new THREE.MeshBasicMaterial({ color: '#ff8a5a', transparent: true, opacity: 0, depthWrite: false });
const LZ0 = -34, LZ1 = -6;
function makeLaser(o) { const warn = new THREE.Mesh(new THREE.PlaneGeometry(2, LZ1 - LZ0), laserWarn.clone()); warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.22, (LZ0 + LZ1) / 2);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.7, 5, LZ1 - LZ0), laserBeam.clone()); beam.position.set(0, 2.5, (LZ0 + LZ1) / 2); warn.visible = beam.visible = false; hazGroup.add(warn, beam);
  return { xs: o.xs, per: o.per, ph: o.ph || 0, warn, beam, x: o.xs[0], st: 0, last: -1 }; }
const crateGeo = bake([{ geo: rounded(0.95, 0.8, 0.95, 0.1), color: '#ffb53f', pos: [0, 0.5, 0] }, { geo: rounded(1.0, 0.18, 1.0, 0.05), color: '#fff1c4', pos: [0, 0.95, 0] }, { geo: rounded(0.2, 0.82, 1.0, 0.04), color: '#e8394d', pos: [0, 0.5, 0] }]);

// ---------------------------------------------------------------- level data
let baseHP = 100, baseMax = 100, bossOn = false, bossHPv = 0, bossMax = 0, bossZ = 0, waveT = 0, fireT = 0, elapsed = 0, aimX = 0, firing = false, volley = 0, botOn = false, killed = 0, rnd = rng(1);
let lastDec = 10, flooded = false, gpN = 0, ammo = 0, ammoMax = 0, shots = 0, tipOn = false, LV = null, bombCharge = 0, bombTip = 0, flawless = 0, goldHits = 0, refund = 0;
function genLevel(n) {   // after the 36 hand-made sieges: a random mix of everything unlocked, bigger crowds and forts, a brute every 4th
  const r = rng(n * 911 + 5), s = r() < 0.5 ? -1 : 1, hi = r() < 0.5 ? 4 : 3, rows = [];
  [-10, -20, -29].forEach((z, i) => { const p = r(); rows.push({ z, g: p < 0.4 ? [{ k: 'x', m: hi, x: s * 3.6, w: 3 }, { k: 'd', m: 0.5, x: 0, w: 3.8 }, { k: 'x', m: 2, x: -s * 3.6, w: 3 }]
    : p < 0.7 ? [{ k: 'x', m: hi, x: s * 2.6, w: 4.9 }, { k: 'd', m: 0.5, x: -s * 2.6, w: 4.9 }] : [{ k: 'f', m: hi, x: 0, w: 9, per: 3.2 + r(), ph: r() * 3 }] }); });
  const o = { w: n % 3, name: 'Siege ' + n, hp: Math.min(2600, 1100 + (n - NL) * 30), wv: Math.min(16, 10 + ((n - NL) >> 2)), every: 2.8, rows, tank: n % 2 ? 2 : 1, bomb: n % 3 ? 2 : 0, hard: n % 4 === 0 ? 1 : 0 };
  if (n % 4 === 0) o.boss = 800 + (n - NL) * 20;
  const k = r(); if (k < 0.33) o.lasers = [{ xs: [-3.4, 3.4, 0], per: 3.2, ph: 0 }]; else if (k < 0.66) o.rocks = [[-2.4, -16, 1.3], [2.4, -24, 1.3]]; else o.cr = [[-17, -s * 1.3, 1.0, 2.6]];
  return o;
}
const getLevel = n => ({ ...(n <= NL ? LEVELS[n - 1] : genLevel(n)), ...(CAL[n] || {}), ...(FAST_QA && window.__ovr && window.__ovr[n] || {}) });
// troop budget when no measured number exists (generated sieges): what a good aimer needs times a margin
function troopsFallback() { const need = 46 + 0.76 * (baseHP + bossMax * 0.5) / colValue(bestColumn()) + 8.2 * Math.min(level, 40); return Math.round(need * 1.15); }
function buildLevel() {
  LV = getLevel(level); rnd = rng(level * 7717 + 3); fk = F.k(); AD.round(); rescued = false; aimG = aimB = 0; aimT = 0;
  setTheme(LV.w);
  gateGroup.clear(); gates = []; blues = []; reds = []; crushGroup.clear(); crushers = []; hazGroup.clear(); rocks = []; lasers = []; crates = [];
  for (const rw of LV.rows) for (const o of rw.g) { const g = makeGate(o, rw.z); gates.push(g); if (o.k === 'f') setFlip(g, flipBlueAt(g, 0)); }
  for (const c of LV.cr || []) crushers.push(makeCrusher(...c));
  for (const [x, z, r] of LV.rocks || []) { const m = new THREE.Mesh(rockGeo, rockMat); m.castShadow = true; m.position.set(x, 0, z); m.scale.setScalar(r); m.rotation.y = x * 7 + z; hazGroup.add(m); rocks.push({ x, z, r: r * 0.95 }); }
  for (const [x, z, amt] of LV.crates || []) { const m = new THREE.Mesh(crateGeo, vcMat({ roughness: 0.4 })); m.castShadow = true; m.position.set(x, 0.1, z); hazGroup.add(m); crates.push({ x, z, amt, m, ph: Math.random() * 6 }); }
  for (const o of LV.lasers || []) lasers.push(makeLaser(o));
  baseMax = baseHP = LV.hp;
  bossOn = !!LV.boss; bossMax = bossHPv = LV.boss || 0; bossZ = BASEZ + 4;
  boss.visible = bossHP.visible = bossOn; boss.scale.setScalar(1);
  fort.visible = true; fort.scale.set(1, 1, 1); fortHP.visible = true; fortHP.set(String(baseHP));
  collapse = 0; botAim = 0; botT = 1.2; waveT = 0.3; lastDec = 10; flooded = false; fireT = 0; volley = 0; elapsed = 0; aimX = 0; killed = 0; cannon.position.x = 0; flawless = 0; goldHits = 0; refund = 0; bigMark = 0; chainN = 0;
  ammoMax = ammo = LV.ammo || troopsFallback(); shots = 0; ammoTag.visible = true; ammoTag.set(ammo, ammoMax);
  bombCharge = level >= 3 ? 0.45 : 0; bombTip = level >= 3 && !save.get('bt', 0) ? 1 : 0; paintBomb();
  ui.levels(level); ui.progress(0); ui.score(''); paintStars();
  const tip = bossOn && !LV.tip ? 'BOSS LEVEL!' : LV.tip || '';
  ui.sub(tip); tipOn = !!tip;
}
// daily goals: three small goals a day (resets at midnight), each completed one is +1 star toward the squad chest
const dayKey = () => new Date().toISOString().slice(0, 10);
const GOALS = [{ k: 'w', n: 16, t: 'Win 16 sieges' }, { k: 'g', n: 24, t: 'Land 24 golden troops' }, { k: 'r', n: 1500, t: 'Smash 1500 reds' }];
function streak() {   // days in a row you played (counted when a siege is won)
  const st = save.get('streak', { last: '', n: 0 }), t = dayKey(), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return st.last === t || st.last === y ? st.n : 0;
}
function streakBump() { const st = save.get('streak', { last: '', n: 0 }), t = dayKey(), y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); if (st.last === t) return; save.set('streak', { last: t, n: st.last === y ? st.n + 1 : 1 }); }
function dailyGet() { const d = save.get('daily', null); return d && d.d === dayKey() ? d : { d: dayKey(), w: 0, g: 0, r: 0, done: [] }; }
function dailyAdd(reds, gold, win) {
  const d = dailyGet(); d.w += win; d.g += gold; d.r += reds; let nu = 0;
  GOALS.forEach((G, i) => { if (win && !d.done.includes(i) && d[G.k] >= G.n) { d.done.push(i); nu++; } });
  save.set('daily', d); return nu;
}
const parOf = () => ({ p3: LV.p3 || Math.round(ammoMax * 0.6), p2: LV.p2 || Math.round(ammoMax * 0.82) });
const starsFor = spent => { const p = parOf(); return spent <= p.p3 ? 3 : spent <= p.p2 ? 2 : 1; };

// ---------------------------------------------------------------- HUD: star meter, map button, bomb button, cards, map
const CSS = `
.sg{display:inline-block;width:1em;height:1em;background:currentColor;clip-path:polygon(50% 0,62% 36%,98% 38%,69% 60%,80% 96%,50% 74%,20% 96%,31% 60%,2% 38%,38% 36%);vertical-align:-.12em}.sg.o{opacity:.3}
.hb-st{position:fixed;top:calc(52px + env(safe-area-inset-top));left:0;right:0;text-align:center;font-size:22px;letter-spacing:4px;pointer-events:none;z-index:5;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.hb-st b{font-weight:800;color:#ffd23f;display:inline-block;transition:transform .2s,color .2s}.hb-st b.off{color:rgba(255,255,255,.45);transform:scale(.8)}
.hb-use{position:fixed;top:calc(80px + env(safe-area-inset-top));left:50%;width:120px;height:7px;margin-left:-60px;border-radius:4px;background:rgba(0,0,0,.3);pointer-events:none;z-index:5;overflow:hidden}.hb-use i{display:block;height:100%;background:#ffd23f}.hb-use.n2 i{background:#ffb52f}.hb-use.n1 i{background:#ff6a4f}.hb-use.warn{animation:hbpulse .4s infinite}
.hb-map{position:fixed;top:calc(14px + env(safe-area-inset-top));right:12px;z-index:7;width:42px;height:42px;border-radius:50%;border:0;background:rgba(20,30,70,.55);color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 rgba(0,0,0,.2)}
.hb-bomb{position:fixed;left:14px;bottom:calc(30vh + env(safe-area-inset-bottom));z-index:7;width:76px;height:76px;border-radius:50%;border:0;color:#fff;font-size:34px;display:flex;align-items:center;justify-content:center;background:conic-gradient(#ffb52f calc(var(--c,0)*1turn),rgba(20,30,70,.55) 0);box-shadow:0 4px 0 rgba(0,0,0,.25)}
.hb-bomb::before{content:'';position:absolute;inset:7px;border-radius:50%;background:#26305f}.hb-bomb span{position:relative}
.hb-bomb.rdy{animation:hbpulse .7s ease-in-out infinite;box-shadow:0 0 0 4px #ffe27a,0 0 24px 6px #ffb52f}.hb-bomb.rdy::before{background:#ff7a2f}
@keyframes hbpulse{50%{transform:scale(1.12)}}
.hc-sub{top:auto!important;bottom:calc(215px + env(safe-area-inset-bottom))!important;font-size:17px!important;font-weight:800!important;opacity:1!important}.hc-sub:not(:empty){width:max-content!important;max-width:86vw;margin:0 auto;padding:6px 16px;border-radius:18px;background:rgba(10,20,50,.6);color:#fff}
.hb-gp{position:fixed;z-index:6;pointer-events:none;font-weight:800;font-size:30px;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.3),0 0 10px rgba(80,160,255,.8);transform:translate(-50%,-50%);animation:hbgp .75s ease-out forwards}@keyframes hbgp{to{transform:translate(-50%,-190%) scale(1.5);opacity:0}}
.hb-card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:calc(110px + env(safe-area-inset-top)) 20px 30px;gap:10px;z-index:10;text-align:center;background:rgba(10,20,50,.55);animation:hbfade .25s}
@keyframes hbfade{from{opacity:0}}
.hb-card h1{margin:0;font-size:clamp(40px,12vw,64px);line-height:.95;font-weight:800;text-shadow:0 5px 0 rgba(0,0,0,.18)}
.hb-card p{margin:0;font-size:19px;font-weight:700;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.hb-card .big{display:flex;gap:6px;font-size:58px;margin:6px 0}.hb-card .big b{color:#ffd23f;text-shadow:0 4px 0 rgba(0,0,0,.2);animation:hbstar .45s both}.hb-card .big b.off{color:rgba(255,255,255,.3);animation:none}
@keyframes hbstar{0%{transform:scale(0) rotate(-40deg)}70%{transform:scale(1.35) rotate(8deg)}100%{transform:scale(1)}}
.hb-bar{width:min(260px,70vw);height:18px;border-radius:10px;background:rgba(0,0,0,.3);overflow:hidden}.hb-bar i{display:block;height:100%;background:#ffd23f;border-radius:10px}
.hb-btns{margin-top:auto;display:flex;gap:12px;align-items:center;margin-bottom:6vh}
.hb-go{white-space:nowrap;font:inherit;font-weight:800;font-size:28px;color:#fff;background:#3cc46a;border:0;border-radius:44px;padding:16px 38px;box-shadow:0 6px 0 #2a9a50;animation:hbpulse 1.4s ease-in-out infinite}
.hb-sm{font:inherit;font-weight:800;font-size:24px;color:#fff;background:rgba(20,30,70,.6);border:0;border-radius:50%;width:56px;height:56px;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.hb-pop{width:92px!important;height:92px!important;animation:hbchest 1s cubic-bezier(.2,1.6,.4,1) both}@keyframes hbchest{0%{transform:scale(0) rotate(-90deg)}100%{transform:scale(1) rotate(0)}}
.hb-sw{display:inline-block;width:46px;height:46px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.25)}
.hb-panel{position:fixed;inset:0;z-index:20;background:rgba(14,26,64,.93);display:flex;flex-direction:column;align-items:center;padding:calc(74px + env(safe-area-inset-top)) 14px 18px;gap:10px;overflow:auto}
.hb-tabs{display:flex;gap:8px}.hb-tab{font:inherit;font-weight:800;font-size:15px;color:#fff;background:rgba(255,255,255,.14);border:0;border-radius:18px;padding:8px 12px}.hb-tab.on{background:#3a8dff}
.hb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:min(360px,94vw);margin-top:4px}
.hb-node{position:relative;aspect-ratio:1;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:24px;color:#fff;background:#3a8dff;box-shadow:0 5px 0 rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
.hb-node.lock{background:#4a526e;color:#8f98b8}.hb-node.hard{background:#d9344a}.hb-node.boss{border:3px solid #ffd23f}.hb-node.next{animation:hbpulse 1s ease-in-out infinite;box-shadow:0 0 0 4px #ffe27a}
.hb-node small{position:absolute;bottom:-14px;left:0;right:0;font-size:12px;color:#ffd23f;letter-spacing:1px}
.hb-daily{display:flex;flex-direction:column;gap:6px;width:min(340px,92vw)}.hb-daily div{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.12);border-radius:14px;padding:8px 12px;font-weight:700;font-size:15px;text-align:left}.hb-daily span{min-width:54px;text-align:center;font-weight:800;color:#ffd23f}.hb-daily .ok{background:rgba(60,196,106,.35)}.hb-daily .ok span{color:#fff}
.hb-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:min(360px,94vw);margin-top:16px}
.hb-sk{width:42px;height:42px;border-radius:50%;border:3px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:800}.hb-sk.on{border-color:#fff;box-shadow:0 0 0 3px #ffd23f}.hb-sk.lock{background:#4a526e}
`;
{ const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const G = '<i class="sg"></i>', GO = '<i class="sg o"></i>';
const stEl = dom('<div class="hb-st"><b><i class="sg"></i></b><b><i class="sg"></i></b><b><i class="sg"></i></b></div>'), mapBtn = dom('<button class="hb-map" type="button">MAP</button>'), bombBtn = dom('<button class="hb-bomb" type="button"><span><svg viewBox="0 0 24 24" width="30" height="30"><circle cx="11" cy="14" r="8" fill="#222"/><path d="M16 6l3-3" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round"/><circle cx="8" cy="11" r="2" fill="#fff" opacity=".5"/></svg></span></button>');
document.body.append(stEl, mapBtn, bombBtn);
for (const b of [mapBtn, bombBtn]) for (const ev of ['pointerdown', 'pointerup']) b.addEventListener(ev, e => e.stopPropagation());
const useEl = dom('<div class="hb-use"><i></i></div>'); document.body.append(useEl);
function paintStars() { const p = parOf(), n = shots <= p.p3 ? 3 : shots <= p.p2 ? 2 : 1; [...stEl.children].forEach((b, i) => b.classList.toggle('off', i >= n));
  const lim = n === 3 ? p.p3 : p.p2; useEl.firstChild.style.width = Math.min(100, shots / Math.max(1, lim) * 100) + '%'; useEl.className = 'hb-use n' + n + (shots > 0 && lim - shots <= 4 && n > 1 ? ' warn' : '');
  if (shots > 0 && lim - shots === 3 && n > 1 && !FAST) ui.sub('Lift your thumb for ' + n + ' stars'); }
function paintBomb() { bombBtn.style.display = level >= 3 ? '' : 'none'; bombBtn.style.setProperty('--c', Math.min(1, bombCharge)); bombBtn.classList.toggle('rdy', bombCharge >= 1); }
mapBtn.addEventListener('click', () => openMap());
bombBtn.addEventListener('click', () => bomb());
let cardEl = null;
const closeCard = () => { if (cardEl) { cardEl.remove(); cardEl = null; } };
let cardAt = 0; const cardReady = () => performance.now() - cardAt > 650;
const showCard = (html, bind) => { closeCard(); cardAt = performance.now(); cardEl = dom(html); document.body.appendChild(cardEl); for (const ev of ['pointerdown', 'pointerup']) cardEl.addEventListener(ev, e => e.stopPropagation()); bind && bind(cardEl); return cardEl; };

// ---------------------------------------------------------------- meta: stars, chests, squads
function award() {   // a star chest: a random squad colour you do not own yet
  const left = SKINS.map((_, i) => i).filter(i => !skins.includes(i)); if (!left.length) return -1;
  const pick = left[Math.floor(Math.random() * left.length)]; skins.push(pick); skin = pick; save.set('skins', skins); save.set('skin', skin); applySkin(); return pick;
}
const totalStars = () => stars.reduce((a, b) => a + (b || 0), 0);
function openMap(tab) {
  const prev = state; if (state === 'play') { state = 'map'; firing = false; }
  const un = unlockedLv(); tab = tab ?? Math.min(2, Math.floor((Math.min(level, NL) - 1) / 12));
  const draw = () => {
    const P = showCard(`<div class="hb-panel"><div class="hb-tabs">${WORLDS.map((w, i) => `<button class="hb-tab ${i === tab ? 'on' : ''}" data-t="${i}">${w.name}</button>`).join('')}</div>
      <div style="font-weight:800;font-size:18px"><i class="sg"></i> ${totalStars()} / ${NL * 3}</div>
      <div class="hb-grid">${Array.from({ length: 12 }, (_, j) => { const n = tab * 12 + j + 1, L = LEVELS[n - 1], st = stars[n - 1] || 0, lock = n > un;
        return `<button class="hb-node ${lock ? 'lock' : ''} ${L.hard ? 'hard' : ''} ${L.boss ? 'boss' : ''} ${n === un ? 'next' : ''}" data-n="${n}">${lock ? '' : n}${L.boss && !lock ? '<em style="position:absolute;top:-8px;font-style:normal;font-size:12px;font-weight:800;color:#ffd23f">BOSS</em>' : ''}<small>${lock ? '' : G.repeat(st) + GO.repeat(3 - st)}</small></button>`; }).join('')}</div>
      <div style="font-weight:800;margin-top:14px">Today${streak() ? ' · ' + streak() + '-day streak' : ''}</div>
      <div class="hb-daily">${(() => { const d = dailyGet(); return GOALS.map((G, i) => `<div class="${d.done.includes(i) ? 'ok' : ''}"><span>${d.done.includes(i) ? 'DONE' : Math.min(d[G.k], G.n) + '/' + G.n}</span>${G.t}</div>`).join(''); })()}</div>
      <div style="font-weight:800;margin-top:14px">Squads · a chest every 5 <i class="sg"></i> (${chestProg}/5)</div>
      <div class="hb-row">${SKINS.map((s, i) => `<button class="hb-sk ${skins.includes(i) ? '' : 'lock'} ${i === skin ? 'on' : ''}" data-s="${i}" style="${skins.includes(i) ? 'background:' + s.c : ''}">${skins.includes(i) ? '' : '?'}</button>`).join('')}</div>
      <button class="hb-sm" data-x style="margin-top:auto">✕</button></div>`, P => {
      P.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = +b.dataset.t; draw(); });
      P.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { const n = +b.dataset.n; if (n > un) { tone(200, 0.1, 'square', 0.04, 0.7); return; } closeCard(); ui.hideStart(); WB.start(); level = n; buildLevel(); state = 'play'; });
      P.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const i = +b.dataset.s; if (!skins.includes(i)) return; skin = i; save.set('skin', i); applySkin(); draw(); });
      P.querySelector('[data-x]').onclick = () => { closeCard(); if (prev === 'play' || prev === 'map') { buildLevel(); state = 'play'; } else state = prev; };
    });
  };
  draw();
}

// ---------------------------------------------------------------- input
const absAim = cx => clamp((cx / innerWidth - 0.5) / 0.4 * (W - 1.1), -W + 1.1, W - 1.1);   // the cannon follows the thumb
input({
  onDown: (e) => { if (!e.isPrimary && state === 'play') { bomb(); return; } botOn = false; inAt = elapsed; if (state === 'play') { firing = true; aimX = absAim(e.clientX); } },
  onMove: (dx, dy, e) => { inAt = elapsed; if (state === 'play') aimX = absAim(e.clientX); },
  onUp: (e, st) => { firing = false; if (state === 'play' && st.y - e.clientY > 110 && performance.now() - st.t < 350) bomb(); if (state === 'play' && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12) { volley = 1.2; } },
});
const D = demo(null, { ready: () => state === 'play' && level === 1 });
let demoFire = false, demoShots = -1;
function demoShoot(sec, t) {
  if (D.on && !botOn) {
    if (!demoFire) { demoFire = true; demoShots = shots; }
    aimX = lerp(aimX, W * 0.5 + Math.sin(t * 1.8) * 0.5, 0.08);
    firing = Math.abs(aimX - W * 0.5) < 0.7 && shots - demoShots < 4;
  } else if (demoFire) { demoFire = false; ammo = Math.min(ammoMax, ammo + shots - demoShots); shots = demoShots; ammoTag.set(ammo, ammoMax); if (!D.touched) firing = false; }
}
// the press that closes the title is the first shot: the card eats pointerdown, so follow that finger here
let holdStart = false;
addEventListener('pointerdown', e => { if (state === 'start') { holdStart = true; aimX = absAim(e.clientX); } }, { capture: true });
addEventListener('pointermove', e => { if (holdStart && state === 'play') { inAt = elapsed; aimX = absAim(e.clientX); } });
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { if (holdStart) { holdStart = false; if (state === 'play') firing = false; } }, { capture: true });
ui.onTap(w => { WB.start(); if (w === 'start') { state = 'play'; botOn = false; firing = holdStart; } });

// ---------------------------------------------------------------- sim
const GRID = 1.2, hash = new Map();
const key = (x, z) => (Math.floor(x / GRID) + 64) * 4096 + Math.floor(z / GRID) + 2048;
function spawnBlue(x, z, passed = 0, gold = false) { if (blues.length >= MAXU) return; blues.push({ x, z, vx: (Math.random() - 0.5) * 3.2, passed, t: Math.random() * 6, born: 0, sp: 5.4 + Math.random() * 1.6, w: Math.random() * 6, gold, hp: gold ? 3 : 1 }); }
// k: 0 trooper, 1 heavy (3 hits, slow), 2 bomber (fast, blows up a clump of your crowd)
function spawnRed(x, z, k = 0) { if (reds.length >= MAXU) return; reds.push({ x, z, vx: 0, t: Math.random() * 6, k, hp: k === 1 ? 3 : 1 }); }
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), ZZ = new THREE.Vector3(0, 0, 1), tq2 = new THREE.Quaternion();
let FAST = false, hitStop = 0;
function poof(x, z, color, n = 3) { if (FAST) return; burst(scene, new THREE.Vector3(x, 0.6, z), color, n, { speed: 0.08, up: 0.08, size: 0.6, life: 0.7 }); }
let poofBudget = 0, recoil = 0, shake = 0, gateSnd = 0, chainT = 0, chainN = 0, bigMark = 0;
const say = (t, c, s, top) => { if (!FAST) ui.pop(t, c, s, top); };
const ringFx = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ringFx.rotation.x = -Math.PI / 2; ringFx.position.y = 0.4; scene.add(ringFx); let ringT = 0;
function popAt(wx, wz, text, color) {
  const v = new THREE.Vector3(wx, 1.2, wz).project(camera); const el = document.createElement('div'); el.className = 'hb-gp'; el.textContent = text; el.style.color = color;
  el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px'; document.body.appendChild(el); gpN++; setTimeout(() => { el.remove(); gpN--; }, 780);
}
function bomb() {
  if (state !== 'play' || bombCharge < 1) { if (state === 'play' && !FAST) tone(220, 0.08, 'square', 0.04, 0.7); return false; }
  bombCharge = 0; paintBomb(); let n = 0;
  for (const e of reds) if (e.z > -16) { e.dead = 1; killed++; if (n++ < 14) poof(e.x, e.z, ['#ffb52f', '#ff3048', '#ffffff'], 3); }
  reds = reds.filter(e => !e.dead);
  if (bossOn && bossHPv > 0 && bossZ > -16) bossHPv = Math.max(1, bossHPv - Math.round(bossMax * 0.12));
  if (!FAST) { shake = 1.1; ui.flash(0.55); sfx.smash(); buzz([40, 30, 60]); say('BOOM!', '#ffb52f', 46, 30); ringT = 1; ringFx.position.set(cannon.position.x, 0.4, cannon.position.z); }
  return true;
}
function step(sec) {
  elapsed += sec;
  if (tipOn && elapsed > 3.5) { tipOn = false; if (ammo > 0) ui.sub(''); }
  if (bombTip && bombCharge >= 1 && !FAST) { bombTip = 0; save.set('bt', 1); ui.sub('Tap the bomb: it blasts the red mob'); setTimeout(() => ui.sub(''), 3500); }
  if (volley > 0) volley -= sec;
  if (!flooded && (firing || volley > 0) && ammo > 0) { flooded = true; const nf = level <= 6 ? 14 : 8; for (let i = 0; i < nf; i++) spawnBlue(cannon.position.x + (Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 1.6, 0); if (!FAST) { say('SQUAD!', '#7dffb2', 36, 30); tone(500, 0.1, 'triangle', 0.06, 1.8); } }
  if ((firing || volley > 0) && ammo > 0) { fireT -= sec; while (fireT <= 0 && ammo > 0) { fireT += 1 / 9; ammo--; shots++; const gold = Math.random() < 1 / 45; spawnBlue(cannon.position.x + (Math.random() - 0.5) * 0.4, 0.6, 0, gold); recoil = 1; if (!FAST && Math.random() < 0.5) tone(700 + Math.random() * 80 + Math.min(300, blues.length), 0.03, 'triangle', 0.035, 0.7); }
    ammoTag.set(ammo, ammoMax); paintStars(); if (ammo === 0) { ui.sub('OUT OF TROOPS!'); if (!FAST) tone(180, 0.15, 'square', 0.05, 0.6); } }
  // enemy waves from the fortress door: troopers, plus heavies and bombers where the level has them
  const ak = FAST ? 1 : level < 3 ? Math.min(fk, AD.k(fk)) : AD.k(fk);
  if (baseHP > 0) { waveT -= sec; if (waveT <= 0) { const n = Math.round((LV.wv + Math.floor(Math.random() * 4)) * ak);
      for (let i = 0; i < n; i++) spawnRed((Math.random() - 0.5) * 3.4, BASEZ + 2 + Math.random() * 2.5);
      for (let i = 0; i < (LV.tank || 0); i++) spawnRed((Math.random() - 0.5) * 3.4, BASEZ + 1.5 + Math.random() * 3, 1);
      for (let i = 0; i < (LV.bomb || 0); i++) spawnRed((Math.random() - 0.5) * 3.4, BASEZ + 1.5 + Math.random() * 3, 2);
      waveT = Math.max(1.4, LV.every / ak); } }
  for (const g of gates) {
    if (g.move) { g.cx = Math.sin(elapsed * 0.9 + g.ph) * (W - g.w / 2 - 0.2); g.g.position.x = g.cx; }
    if (g.k === 'f') { const b = flipBlueAt(g, elapsed); if (b !== g.blue) setFlip(g, b); const left = g.per * (b ? 0.62 : 1) - ((elapsed + g.fph) % g.per); g.panel.material.opacity = left < 0.45 && Math.sin(elapsed * 40) > 0 ? 0.35 : 1; }
    g.pulse = Math.max(0, g.pulse - sec * 4); g.g.scale.setScalar(1 + g.pulse * 0.08); }
  // laser lanes: idle, a red strip warns for a second, then the lane burns for 0.35 s
  for (const L of lasers) { const t = elapsed + L.ph, i = Math.floor(t / L.per), p = t - i * L.per; L.x = L.xs[i % L.xs.length];
    L.st = p > L.per - 0.35 ? 2 : p > L.per - 1.35 ? 1 : 0;
    if (L.st === 1 && L.last !== i && !FAST) { L.last = i; tone(330, 0.12, 'sawtooth', 0.03, 0.6); }
    if (L.st === 2) for (const u of blues) if (!u.gone && Math.abs(u.x - L.x) < 1.0 && u.z < LZ1 && u.z > LZ0) { u.gone = true; aimB++; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ff8a5a', '#ffd23f'], 2); } } }
  for (const u of blues) {
    const pz = u.z; u.z -= u.sp * sec; u.x += (u.vx + Math.sin(u.t * 2 + u.w) * 0.6) * sec; u.vx *= 0.985; u.t += sec;
    if (Math.abs(u.x) > W - 0.3) { u.x = Math.sign(u.x) * (W - 0.3); u.vx *= -0.5; }
    for (const g of gates) if (pz > g.z && u.z <= g.z && !(u.passed & g.bit) && Math.abs(u.x - g.cx) < g.w / 2) {
      u.passed |= g.bit; g.pulse = 1;
      if (g.mult < 1) { aimB++; if (Math.random() > g.mult) { u.gone = true; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ff3048', '#ffffff'], 2); } } continue; }
      aimG++; chainT = 1.2; chainN++; if (!FAST && (g.popT || 0) < elapsed && gpN < 4) { g.popT = elapsed + 0.45; popAt(u.x, g.z, 'x' + (g.k === 'f' ? g.m0 : g.mult), g.mult >= 4 ? '#ffd23f' : '#fff'); }
      if (gateSnd <= 0 && !FAST) { gateSnd = 0.07; if (chainN % 6 === 1) buzz(6); tone(520 + Math.min(14, chainN / 6) * 45, 0.05, 'triangle', 0.04, 0.8); }
      for (let k = 1; k < g.mult; k++) { spawnBlue(u.x + (Math.random() - 0.5) * 1.2, u.z - Math.random() * 0.9, u.passed); blues[blues.length - 1] && (blues[blues.length - 1].vx = (Math.random() - 0.5) * 5); }
    }
  }
  gateSnd -= sec; chainT -= sec; if (chainT <= 0) chainN = 0;
  for (const c of crushers) { const nx = c.cc + Math.sin(elapsed * c.sp + c.ph) * c.amp; c.spin += (nx - c.x) * 2.2 + sec * 4; c.x = nx; c.m.position.x = nx; c.m.rotation.x = -c.spin;
    for (const u of blues) if (!u.gone && Math.abs(u.x - c.x) < 1.35 && Math.abs(u.z - c.z) < 0.6) { u.gone = true; aimB++; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ff3048', '#3b3f57']); } } }
  for (const r of rocks) for (const u of blues) if (!u.gone && (u.x - r.x) ** 2 + (u.z - r.z) ** 2 < (r.r + 0.15) ** 2) { u.gone = true; aimB++; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#8e8e8e', '#ffffff'], 2); } }
  for (const c of crates) if (!c.got) for (const u of blues) if (!u.gone && (u.x - c.x) ** 2 + (u.z - c.z) ** 2 < 1.1) { c.got = true; ammo += c.amt; ammoMax += c.amt; ammoTag.set(ammo, ammoMax); hazGroup.remove(c.m);
      if (!FAST) { say('+' + c.amt + ' troops', '#ffd23f', 30, 52); tone(900, 0.1, 'triangle', 0.06, 1.4); buzz(15); burst(scene, new THREE.Vector3(c.x, 1, c.z), ['#ffd23f', '#ffffff'], 16, { speed: 0.14, up: 0.14, size: 0.8 }); } break; }
  if (blues.some(u => u.gone)) blues = blues.filter(u => !u.gone);
  aimT += sec; if (aimT >= 1) { aimT = 0; if (aimG + aimB > 0) { if (aimG >= 2 * aimB) AD.good(1); else if (aimB > aimG) AD.bad(1); } aimG = aimB = 0; }
  const RSP = (3.6 + Math.min(level, 10) * 0.12) * ak;
  for (const e of reds) { e.z += RSP * sec * (e.k === 1 ? 0.7 : e.k === 2 ? 1.3 : 1); e.t += sec; e.x += (cannon.position.x - e.x) * 0.5 * sec; }
  hash.clear();
  blues.forEach((u, i) => { const k = key(u.x, u.z); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(i); });
  const deadB = new Uint8Array(blues.length), deadR = new Uint8Array(reds.length);
  reds.forEach((e, j) => {
    const cx = Math.floor(e.x / GRID), cz = Math.floor(e.z / GRID), rr = e.k === 1 ? 0.9 : 0.36;
    for (let dx = -1; dx <= 1 && !deadR[j]; dx++) for (let dz = -1; dz <= 1 && !deadR[j]; dz++) {
      const a = hash.get((cx + dx + 64) * 4096 + cz + dz + 2048); if (!a) continue;
      for (const i of a) { if (deadB[i]) continue; const u = blues[i]; if ((u.x - e.x) ** 2 + (u.z - e.z) ** 2 < rr) {
        deadB[i] = 1; e.hp -= u.gold ? 3 : 1;
        if (e.k === 2) { let n = 0; for (const dx2 of [-1, 0, 1]) for (const dz2 of [-1, 0, 1]) { const b = hash.get((cx + dx2 + 64) * 4096 + cz + dz2 + 2048); if (b) for (const i2 of b) if (!deadB[i2] && n < 5 && (blues[i2].x - e.x) ** 2 + (blues[i2].z - e.z) ** 2 < 3.2) { deadB[i2] = 1; n++; } }
          e.hp = 0; if (poofBudget > 0) { poofBudget--; poof(e.x, e.z, ['#ff9a1f', '#ffd23f', '#ff3048'], 6); } if (!FAST) { tone(140, 0.12, 'square', 0.05, 0.5); shake = Math.max(shake, 0.25); } }
        if (e.hp <= 0) { deadR[j] = 1; killed++; bombCharge = Math.min(1, bombCharge + (e.k === 1 ? 0.1 : e.k === 2 ? 0.06 : 0.035)); if (poofBudget > 0) { poofBudget--; poof(e.x, e.z, ['#ff3048', '#2f86ff', '#ffffff']); } }
        else if (e.k === 1 && poofBudget > 0) { poofBudget--; poof(e.x, e.z, ['#ffffff', '#ff3048'], 2); }
        break; } }
    }
  });
  if (!FAST) paintBombMaybe();
  if (bossOn && bossHPv > 0) {
    bossZ += 0.9 * sec;
    blues.forEach((u, i) => { if (!deadB[i] && Math.abs(u.z - bossZ) < 1.4 && Math.abs(u.x) < 5.4) { deadB[i] = 1; bossHPv -= u.gold ? 8 : 1; bossHit = 1; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ffcf33', '#2f86ff']); } } });
    if (bossHPv <= 0) { bossHPv = 0; score += 200; bombCharge = 1; if (!FAST) { sfx.smash(); buzz([40, 30, 60]); ui.flash(0.7); say('BOSS DOWN!', '#ffcf33', 50, 26); shake = 1.2; hitStop = 0.14;
      burst(scene, new THREE.Vector3(0, 2, bossZ), ['#ffcf33', '#ff3048', '#ffffff'], 50, { speed: 0.3, up: 0.25, size: 1.6 }); } boss.visible = bossHP.visible = false; }
    if (bossZ > -0.5 && bossHPv > 0) return lose('CRUSHED!', 'The brute reached your cannon');
  }
  blues.forEach((u, i) => { if (!deadB[i] && u.z < BASEZ + 2.2) { deadB[i] = 1; if (baseHP > 0 && (!bossOn || bossHPv <= 0)) { const dmg = u.gold ? 8 : 1; baseHP -= dmg; score += dmg; fortHit = 1; if (u.gold) { goldHits++; if (!FAST) { hitStop = Math.max(hitStop, 0.07); shake = Math.max(shake, 0.4); say('GOLD +8', '#ffd23f', 30, 45); tone(1200, 0.12, 'triangle', 0.06, 1.3); } } if (poofBudget > 0) { poofBudget--; poof(u.x, BASEZ + 2.2, u.gold ? ['#ffd23f', '#ffffff'] : ['#ffd23f', '#ff3048']); } } } });
  { const dec = Math.floor(10 * Math.max(0, baseHP) / Math.max(1, baseMax)); if (dec < lastDec) { lastDec = dec; if (!FAST && baseHP > 0) { shake = Math.max(shake, 0.7); hitStop = Math.max(hitStop, 0.05); tone(160 + dec * 25, 0.1, 'square', 0.05, 0.6); burst(scene, new THREE.Vector3((Math.random() - 0.5) * 4, 3, BASEZ + 1), ['#ffd23f', '#ff5266', '#ffffff'], 14, { speed: 0.2, up: 0.2, size: 1.2 }); } } }
  blues = blues.filter((_, i) => !deadB[i]);
  reds = reds.filter((_, j) => !deadR[j]);
  if (!rescued && reds.some(e => e.z > -1.5) && AD.sensible() && AD.rescue()) { rescued = true; let n = 0; for (const e of reds) if (e.z > -7) { e.dead = 1; n++; if (n < 12) poof(e.x, e.z, ['#7dffb2', '#ffffff', '#ff3048']); } reds = reds.filter(e => !e.dead); shake = 0.8; say('SHOCKWAVE!', '#7dffb2', 36, 30); if (!FAST) { tone(220, 0.25, 'sawtooth', 0.06, 0.4); buzz([30, 20, 30]); } }
  for (const e of reds) if (e.k === 2 && e.z > 1.2) {   // a bomber that slips past the crowd blows up on the cannon: costs troops, not the siege
    e.hp = 0; e.dead = 1; ammo = Math.max(0, ammo - 12); ammoTag.set(ammo, ammoMax); if (!FAST) { shake = Math.max(shake, 0.9); ui.flash(0.35); tone(120, 0.2, 'square', 0.06, 0.4); say('BOMBER HIT! -12', '#ffb52f', 32, 40); burst(scene, cannon.position.clone().setY(1), ['#ff9a1f', '#ffd23f', '#ff3048'], 24, { speed: 0.25, up: 0.2 }); } }
  reds = reds.filter(e => !e.dead);
  for (const e of reds) if (e.z > 1.2) return lose('OVERRUN!', ammo > 0 ? 'The red mob reached your cannon' : 'Out of troops: the red mob reached your cannon');
  if (ammo <= 0 && blues.length === 0 && baseHP > 0) {
    if (!rescued && baseHP <= baseMax * 0.3 && AD.sensible() && AD.rescue()) { rescued = true; ammo = Math.max(10, Math.round(ammoMax * 0.12)); ammoTag.set(ammo, ammoMax); ui.sub(''); say('REINFORCEMENTS!', '#7dffb2', 36, 30); if (!FAST) tone(880, 0.12, 'triangle', 0.05, 0.8); }
    else return lose('OUT OF TROOPS!', `The fort held with ${baseHP} left`);
  }
  // crowd call-outs: the first time the army passes 40 / 100 / 200 in a round
  const nb = blues.length; if (nb >= 200 && bigMark < 3) { bigMark = 3; say('HORDE!!', '#ffd23f', 54, 34); if (!FAST) { shake = Math.max(shake, 0.5); ui.flash(0.3); tone(660, 0.2, 'triangle', 0.07, 1.6); } } else if (nb >= 100 && bigMark < 2) { bigMark = 2; say('BIG HORDE!', '#ffffff', 44, 34); if (!FAST) tone(560, 0.15, 'triangle', 0.06, 1.4); } else if (nb >= 40 && bigMark < 1) { bigMark = 1; say('HORDE!', '#ffffff', 38, 34); }
  fortHP.set(String(Math.max(0, baseHP))); if (bossOn) bossHP.set(String(bossHPv));
  if (baseHP <= 0) win();
}
let lastBombRdy = false; const paintBombMaybe = () => { const r = bombCharge >= 1; if (r !== lastBombRdy || bombCharge < 1) { paintBomb(); if (r && !lastBombRdy && !FAST) { tone(800, 0.1, 'triangle', 0.06, 1.5); buzz(15); } } lastBombRdy = r; };
let bossHit = 0, fortHit = 0, botT = 0, botAim = 0, botSloppy = false;
// the demo/QA bot aims like a good player: the column whose gates multiply the most, away from crushers, boulders and the next laser
function colValue(x) {
  let v = 1;
  for (const g of gates) { if (g.move) { const p = Math.min(1, (g.w - 1) / (2 * W)); v *= 1 + (g.mult - 1) * p; } else if (g.k === 'f') { if (Math.abs(x - g.cx) < g.w / 2 - 0.5) v *= 1 + (g.m0 - 1) * 0.6; } else if (Math.abs(x - g.cx) < g.w / 2 - 0.5) v *= g.mult; }
  for (const c of crushers) if (Math.abs(x - c.cc) < c.amp + 1.6) v *= 0.6;
  for (const r of rocks) if (Math.abs(x - r.x) < r.r + 0.7) v *= 0.15;
  for (const L of lasers) if (Math.abs(x - L.x) < 1.6) v *= 0.35;
  return v;
}
function bestColumn() {
  let best = botAim, bv = colValue(botAim) * 1.2;
  for (let x = -W + 1.1; x <= W - 1.1 + 1e-6; x += 0.3) { const v = colValue(x); if (v > bv) { bv = v; best = x; } }
  return best;
}
function botTick(sec, t) {
  inAt = elapsed; botT -= sec;
  if (botT <= 0) { botT = botSloppy ? 2.5 : 1; botAim = botSloppy && Math.random() < 0.2 ? (Math.random() * 2 - 1) * (W - 1.1) : bestColumn(); }
  const f = botSloppy ? 0.04 : 0.12; aimX = lerp(aimX, clamp(botAim + Math.sin(t * (botSloppy ? 1.3 : 2.2)) * (botSloppy ? 1.4 : 0.35), -W + 1.1, W - 1.1), 1 - Math.pow(1 - f, sec * 60));
  let hold = false;   // a good player waits for a flip gate to be blue when the crowd will arrive
  const nearRed = reds.some(e => e.z > -14);
  if (!botSloppy && !nearRed) for (const g of gates) if (g.k === 'f' && Math.abs(aimX - g.cx) < g.w / 2 - 0.5 && !flipBlueAt(g, elapsed + (3.5 - g.z) / 6.2)) hold = true;
  if (!botSloppy && !hold && baseHP > 0) {   // and stops firing once the crowd already in flight will finish the fort (no wasted troops)
    let ex = 0; for (const u of blues) { let m = u.gold ? 8 : 1; for (const g of gates) if (g.z < u.z && Math.abs(u.x - g.cx) < g.w / 2) m *= g.k === 'f' ? 1 + (g.m0 - 1) * 0.6 : g.mult < 1 ? 0.5 : g.mult; ex += m; }
    let pess = 0; for (const u of blues) { let m = u.gold ? 8 : 1; for (const g of gates) if (g.z < u.z && Math.abs(u.x - g.cx) < g.w / 2) m *= g.k === 'f' ? 1 + (g.m0 - 1) * 0.6 : g.mult < 1 ? 0.5 : g.mult; for (const r of rocks) if (r.z < u.z && Math.abs(u.x - r.x) < r.r + 0.8) m = 0; for (const L of lasers) if (Math.abs(u.x - L.x) < 1.6 && u.z > LZ1) m *= 0.5; pess += m; }
    const near = reds.some(e => e.z > -14);
    if (!near && Math.min(ex, pess * 1.3) * 0.85 >= baseHP + (bossHPv > 0 ? bossHPv : 0) + 6) hold = true; }
  firing = !hold;
  if (!botSloppy && bombCharge >= 1 && reds.filter(e => e.z > -10).length >= 6) bomb();
}
let lastLose = ''; function lose(t, line) { if (state !== 'play') return; state = 'lost'; lastLose = t; if (!FAST) dailyAdd(killed, goldHits, 0); ui.sub(''); firing = false; if (FAST) return; AD.bad(2); F.level(false, 1 - Math.max(0, baseHP) / baseMax);
  sfx.fail(); buzz([60, 40, 80]); ui.flash(0.6); shake = 1; burst(scene, cannon.position.clone().setY(1), ['#2f86ff', '#ffffff', '#555'], 30, { speed: 0.25, up: 0.2 });
  const pct = Math.round(100 * (1 - Math.max(0, baseHP) / baseMax)), left = Math.max(0, baseHP);
  const hint = lastHint(t);
  setTimeout(() => { if (state !== 'lost') return; showCard(`<div class="hb-card"><h1>${t}</h1><p>${bossOn && bossHPv > 0 ? `The brute had ${bossHPv} left` : left <= 0 ? '' : pct >= 70 ? `SO CLOSE: fort had ${left} left!` : `Fort ${pct}% down`}</p>
    <div class="hb-bar"><i style="width:${pct}%"></i></div><p style="opacity:.85;font-size:16px">${hint}</p>
    <div class="hb-btns"><button class="hb-go" data-g>RETRY</button><button class="hb-sm" data-m>MAP</button></div></div>`, C => {
    C.querySelector('[data-g]').onclick = () => retry(); C.querySelector('[data-m]').onclick = () => openMap(); C.addEventListener('pointerdown', e => { if (!e.target.closest('[data-m]') && cardReady()) retry(); }); }); }, 450);
}
function lastHint(t) { if (t === 'CRUSHED!') return 'Fill the brute before he walks up'; if (LV.lasers && LV.lasers.length) return 'Aim away from the red strip'; if (crushers.length) return 'Wait for the crusher to pass'; if (LV.tank) return 'Dark reds take 3 hits: bring a crowd'; return 'Aim through the biggest blue gates'; }
function retry() { closeCard(); WB.start(); buildLevel(); state = 'play'; }
function nextLevel() { closeCard(); WB.start(); level++; save.set('level', level); buildLevel(); state = 'play'; }
function win() {
  if (state !== 'play') return;
  state = 'won'; ui.sub(''); firing = false; ammoTag.visible = false; if (FAST) return; AD.good(2); F.level(true);
  const st = starsFor(shots), prev = stars[level - 1] || 0, gain = Math.max(0, st - prev), first = prev === 0;
  if (first) WB.submit(1);
  stars[level - 1] = Math.max(prev, st); for (let i = 0; i < level - 1; i++) stars[i] = stars[i] || 0; save.set('stars', stars);
  score += 100 + level * 20; best = Math.max(best, score); save.set('best', best); save.set('level', Math.min(level + 1, NL + 200));
  streakBump(); const bonus = dailyAdd(killed, goldHits, 1);
  chestProg += gain + bonus; let got = -2; while (chestProg >= 5) { chestProg -= 5; got = award(); } save.set('chest', chestProg);
  sfx.smash(); setTimeout(() => sfx.win(), 200); buzz([40, 30, 80]); ui.flash(0.8); shake = 1.5;
  for (let i = 0; i < 4; i++) setTimeout(() => burst(scene, new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 3, BASEZ), ['#e8394d', '#ff5266', '#fff1f1', '#ffd23f'], 30, { speed: 0.35, up: 0.3, size: 2 }), i * 120);
  confetti(scene, new THREE.Vector3(0, 6, BASEZ + 4), 120); collapse = 1; fortHP.visible = false;
  say(st === 3 ? 'PERFECT!' : 'FORTRESS DOWN!', '#ffd23f', 44, 24);
  const p = parOf(), lvName = LV.name, nxt = level < NL ? getLevel(level + 1).name : 'Endless sieges';
  const goal = st === 3 ? (ammo > 0 ? `${ammo + blues.length} troops to spare` : 'Flawless') : `<i class="sg"></i><i class="sg"></i><i class="sg"></i> needs ${p.p3} troops · you used ${shots}`;
  const reveal = got >= 0 ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin:6px 0"><span class="hb-sw hb-pop" style="background:${SKINS[got].c}"></span><p style="font-size:24px;color:#ffd23f">SQUAD CHEST! ${SKINS[got].n}</p></div>` : got === -1 ? '<p>All squads collected!</p>' : '';
  setTimeout(() => { if (state !== 'won') return; showCard(`<div class="hb-card"><p>SIEGE ${level} · ${lvName}</p><h1>FORT DOWN!</h1>
    <div class="big">${[1, 2, 3].map(i => `<b class="${i <= st ? '' : 'off'}" style="animation-delay:${0.25 * i}s"><i class="sg"></i></b>`).join('')}</div><p>${goal}</p>${reveal}
    <div class="hb-bar" style="margin-top:6px"><i style="width:${chestProg * 20}%"></i></div><p style="font-size:15px;opacity:.9"><i class="sg"></i> ${chestProg}/5 → squad chest${bonus ? ' · DAILY GOAL +' + bonus : ''}</p><p style="font-size:15px;opacity:.8">Next: ${nxt}</p><p style="font-size:14px;color:#ffd23f">${streak()}-day streak · come back tomorrow for 3 new goals${chestProg >= 3 ? ' · chest is ' + (5 - chestProg) + ' away' : ''}</p>
    <div class="hb-btns"><button class="hb-sm" data-r>↺</button><button class="hb-go" data-g>NEXT ▶</button><button class="hb-sm" data-m>MAP</button></div></div>`, C => {
    if (got >= 0) { cardAt += 1000; if (!FAST_QA) { setTimeout(() => sfx.win(), 300); confetti(scene, new THREE.Vector3(0, 6, BASEZ + 4), 90); } }
    if (!FAST_QA) [...C.querySelectorAll('.big b:not(.off)')].forEach((b, i) => setTimeout(() => tone(600 + i * 150, 0.12, 'triangle', 0.07, 1.3), 250 * (i + 1)));
    C.querySelector('[data-g]').onclick = () => nextLevel(); C.querySelector('[data-r]').onclick = () => retry(); C.querySelector('[data-m]').onclick = () => openMap();
    C.addEventListener('pointerdown', e => { if (!e.target.closest('button') && cardReady()) nextLevel(); }); }); }, 800);
}
let collapse = 0;

// ---------------------------------------------------------------- render
function drawCrowd(mesh, arr, dir, pick, sc = 1.3) {
  let n = 0;
  for (const u of arr) {
    if (!pick(u)) continue;
    const bob = Math.abs(Math.sin(u.t * 14)) * 0.12, sw = Math.sin(u.t * 14) * 0.18;
    tmpP.set(u.x, 0.15 + bob, u.z); tmpQ.setFromAxisAngle(UP, dir).multiply(tq2.setFromAxisAngle(ZZ, sw));
    tmpS.setScalar(sc * (u.born !== undefined ? Math.min(1, (u.born += 0.08)) : 1));
    tmpM.compose(tmpP, tmpQ, tmpS); mesh.setMatrixAt(n++, tmpM);
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
}
const camPos = new THREE.Vector3(0, 13, 12); let fpsN = 0, fpsT = 0, fps = 0;
loop((dt, t) => {
  fpsN++; if (t - fpsT > 1) { fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; }
  let sec = Math.min(dt / 60, 1 / 30);
  if (hitStop > 0) { hitStop -= sec; sec *= 0.12; }
  poofBudget = 3;
  if (state === 'play') {
    if (botOn) botTick(sec, t);
    demoShoot(sec, t);
    AD.tick(elapsed - inAt < 6);
    step(sec);
    ui.progress(1 - baseHP / baseMax); if (blues.length !== lastCount) { lastCount = blues.length; countTag.set(String(blues.length)); }
  } else if (state === 'won' || state === 'lost') {
    for (const u of blues) { u.z -= 4 * sec; u.t += sec; } for (const e of reds) { e.t += sec; }
  }
  cannon.position.x = lerp(cannon.position.x, aimX, 0.35);
  recoil = Math.max(0, recoil - sec * 10); barrel.position.z = -0.6 + recoil * 0.25; cBody.scale.set(1 + recoil * 0.04, 1 - recoil * 0.05, 1 + recoil * 0.04);
  flash.material.opacity = (firing || volley > 0) && state === 'play' ? recoil * 0.9 : 0; ring.material.opacity = 0.55 + Math.sin(t * 6) * 0.25;
  drawCrowd(blueM, blues, 0, u => !u.gold); drawCrowd(goldM, blues, 0, u => u.gold, 1.9);
  drawCrowd(redM, reds, Math.PI, e => e.k === 0); drawCrowd(tankM, reds, Math.PI, e => e.k === 1, 2.0); drawCrowd(bombM, reds, Math.PI, e => e.k === 2, 1.5);
  for (const c of crates) if (!c.got) { c.m.position.y = 0.25 + Math.sin(t * 3 + c.ph) * 0.12; c.m.rotation.y = t + c.ph; }
  for (const L of lasers) { const on = state === 'play'; L.warn.visible = on && L.st === 1; L.beam.visible = on && L.st === 2; L.warn.position.x = L.beam.position.x = L.x; L.warn.material.opacity = 0.25 + 0.3 * Math.abs(Math.sin(t * 14)); L.beam.material.opacity = 0.6; }
  if (ringT > 0) { ringT = Math.max(0, ringT - sec * 2.2); const s = 1 + (1 - ringT) * 16; ringFx.scale.set(s, s, 1); ringFx.material.opacity = ringT * 0.9; }
  fortHit = Math.max(0, fortHit - sec * 8); fort.position.x = (Math.random() - 0.5) * fortHit * 0.25;
  if (collapse > 0) { collapse = Math.min(2, collapse + sec * 1.4); fort.scale.set(1 + (collapse - 1) * 0.15, Math.max(0.02, 2 - collapse), 1 + (collapse - 1) * 0.15); }
  if (bossOn && boss.visible) { bossHit = Math.max(0, bossHit - sec * 6); boss.position.set(Math.sin(t * 3) * 0.15, Math.abs(Math.sin(t * 3)) * 0.2, bossZ); boss.scale.setScalar(1.25 + bossHit * 0.08 + (LV.w === 2 ? 0.2 : 0)); bossHP.position.set(0, 5.4, bossZ); }
  const pb = Math.min(3.5, blues.length / 70), want = new THREE.Vector3(cannon.position.x * 0.25, 18.5 + pb, 14 + pb * 0.6);
  ammoTag.position.x = clamp(cannon.position.x, -3.1, 3.1) - cannon.position.x; countTag.position.x = clamp(cannon.position.x, -3.5, 3.5) - cannon.position.x;
  camPos.lerp(want, 0.08);
  camera.position.copy(camPos); if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.9; }
  camera.lookAt(camPos.x * 0.6, 0, -15);
  followLight(new THREE.Vector3(0, 0, -18));
});

applySkin(); buildLevel();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get fps() { return Math.round(fps); },
  get dbg() { return { blues: blues.length, reds: reds.length, baseHP, bossHPv, ammo, shots, ammoMax, charge: +bombCharge.toFixed(2), stars: starsFor(shots) }; },
  get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; },
  get meta() { return { stars: stars.slice(), chestProg, skins: skins.slice(), skin, un: unlockedLv() }; },
  bot(sloppy) { if (state === 'play') { botOn = true; botSloppy = !!sloppy; } },
  go(n) { closeCard(); ui.hideStart(); level = n; buildLevel(); state = 'play'; },
  // headless: play one level to its end with the bot at 60 steps a second (what a 60 fps phone runs), no drawing; returns the result (QA calibrate/playall)
  fast(n, sloppy = false, maxSec = 150) {
    FAST = true; closeCard(); ui.hideStart(); level = n; buildLevel(); state = 'play'; botSloppy = sloppy; botAim = 0; let t = 0;
    while (state === 'play' && t < maxSec) { t += 1 / 60; poofBudget = 0; botTick(1 / 60, t); cannon.position.x = lerp(cannon.position.x, aimX, 0.35); step(1 / 60); }
    const out = { n, state, why: lastLose, shots, ammoMax, ammoLeft: ammo, baseHP, hp: baseMax, bossHP: bossHPv, t: +t.toFixed(1), blues: blues.length, gold: goldHits, stars: state === 'won' ? starsFor(shots) : 0, charge: bombCharge };
    FAST = false; botOn = false; state = 'ready'; return out; },
  get dbg2() { return { bl: blues.slice(0, 40).map(u => [+u.x.toFixed(1), +u.z.toFixed(1), u.passed]), botAim, aimX, cx: cannon.position.x, best: bestColumn(), cv: [-3.6, 0, 3.6].map(colValue), gates: gates.map(g => [g.k, g.cx, g.w, g.mult, g.z]) }; },
  setStars(a) { stars = a; save.set('stars', a); },
};

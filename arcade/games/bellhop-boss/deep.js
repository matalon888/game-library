// Bellhop Boss deep v2 — original idle hotel tycoon, 30 hand-made hotels (levels.js). Drag to walk your bellhop: check guests
// in at the desk, clean and repair rooms, bring room service, scoop up the cash and pour it into upgrade pads. Stars, a hotel
// map and a uniform wardrobe carry over. Plan: DESIGN.md.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng, rounded, stickman, palette, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';

import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS, levelOf, worldOf } from './levels.js';
const WB = board({ game: 'bellhop-boss', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });
const S = store('bellhopboss2');
const F = flow('bellhopboss');
let fk = 1;
// saved: unlocked = next hotel to play, stars per hotel, uniforms owned/worn, stars toward the next chest
const SAVE = { unlocked: 1, stars: {}, suits: [0], suit: 0, chest: 0, ...S.get('save', {}) };
const save = () => S.set('save', SAVE);
const totalStars = () => Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
let level = Math.min(SAVE.unlocked, 400), L = levelOf(level);
const CHEST = 7;
// uniforms: jacket, hat, trim (code art only)
const SUITS = [
  { n: 'Classic', c: '#e63946', h: '#c1121f' }, { n: 'Navy', c: '#2b4c9b', h: '#1d3170' }, { n: 'Mint', c: '#2fb59a', h: '#1e8a74' },
  { n: 'Sunset', c: '#ff8a3d', h: '#d9531e' }, { n: 'Plum', c: '#8b4fd1', h: '#5f2a9c' }, { n: 'Gold', c: '#e5b422', h: '#a97a00' },
  { n: 'Sky', c: '#3aa0ff', h: '#1c6fc4' }, { n: 'Rose', c: '#ff6fa8', h: '#c93d78' }, { n: 'Night', c: '#262b3d', h: '#0d0f18' },
  { n: 'Lime', c: '#7ac943', h: '#4c8f1e' }, { n: 'Ice', c: '#9fe3f2', h: '#4fb3cc' }, { n: 'Royal', c: '#6d1f3f', h: '#e5b422' },
];
const stage = createStage({ fov: 46, shadowSize: 22 });
const { scene, camera, sun, hemi } = stage;
const ui = createUI({ title: 'BELLHOP<br>BOSS', hint: 'Tap where to walk · or drag', hand: '👆', score: false });
hemi.intensity = 1.35; sun.intensity = 1.6;

// ------------------------------------------------------------------ helpers
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, m, color] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); c.set(color);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}
const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02, ...o });
const rbox = (w, h, d, r = 0.08) => { const g = rounded(w - 1.8 * r, d - 1.8 * r, h, r); g.rotateX(-Math.PI / 2); return g; };   // centred on its origin
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } t.anisotropy = 8; t.userData = { c }; return t; }
function bubbleTex(icon, bg = '#ffffff') { return canvasTex(128, 140, (x) => { x.fillStyle = 'rgba(0,0,0,.15)'; x.beginPath(); x.ellipse(64, 128, 22, 7, 0, 0, 7); x.fill(); x.fillStyle = bg; x.beginPath(); x.arc(64, 58, 52, 0, 7); x.fill(); x.beginPath(); x.moveTo(50, 104); x.lineTo(78, 104); x.lineTo(64, 124); x.fill(); x.font = '60px system-ui,Apple Color Emoji'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(icon, 64, 62); }); }
const ICONS = { clean: bubbleTex('🧹'), sleep: bubbleTex('💤', '#d9e8ff'), bell: bubbleTex('🛎️', '#fff3c4'), bed: bubbleTex('🛏️', '#ffd9e1'), angry: bubbleTex('😠', '#ffc9c9'), tray: bubbleTex('🍽️', '#fff0c9'), fix: bubbleTex('🔧', '#e3e3ea'), vipbed: bubbleTex('🛏️', '#ffe9a0'), love: bubbleTex('❤️', '#ffe0ec') };
const MARKS = { r: bubbleTex('⚡', '#fff3c4'), v: bubbleTex('👑', '#ffe9a0'), c: bubbleTex('🧐', '#e0e0ea') };
const sprite = (tex, s = 1.3) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); sp.scale.set(s, s * 140 / 128, 1); sp.renderOrder = 20; return sp; };

// ------------------------------------------------------------------ themes per hotel
const THEMES = [
  { name: 'Sunny Inn', tile: ['#ffd1e0', '#fff4f8'], wall: '#ff8fb3', carpet: '#ff5d8f', wood: '#f1c28c', bed: '#7b9cff', out: '#8fd68a' },
  { name: 'Mint Lodge', tile: ['#c9f3e3', '#f4fffa'], wall: '#46c79a', carpet: '#2a9d8f', wood: '#e9c79a', bed: '#ff8fa3', out: '#9ad98e' },
  { name: 'Lilac Suites', tile: ['#e3d6ff', '#fbf8ff'], wall: '#9b7bff', carpet: '#7b5cff', wood: '#ead2b0', bed: '#ffd166', out: '#a6dd8f' },
  { name: 'Peach Resort', tile: ['#ffe0c2', '#fffaf2'], wall: '#ff9f5a', carpet: '#ff7b39', wood: '#e3b78a', bed: '#4fc3f7', out: '#93d48a' },
];

// ------------------------------------------------------------------ static meshes
const BILL_G = new THREE.BoxGeometry(0.62, 0.075, 0.34);
const billTop = canvasTex(128, 72, (x) => { x.fillStyle = '#4cc75a'; x.fillRect(0, 0, 128, 72); x.strokeStyle = '#d7ffd0'; x.lineWidth = 6; x.strokeRect(6, 6, 116, 60); x.fillStyle = '#2f9e44'; x.beginPath(); x.arc(64, 36, 18, 0, 7); x.fill(); x.fillStyle = '#e9ffe0'; x.font = '900 28px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 64, 37); });
const billSide = new THREE.MeshStandardMaterial({ color: '#3fae4e', roughness: 0.6 }), billTopM = new THREE.MeshStandardMaterial({ map: billTop, roughness: 0.5 });
const MAXB = 320;
const bills = new THREE.InstancedMesh(BILL_G, [billSide, billSide, billTopM, billSide, billSide, billSide], MAXB);
bills.castShadow = true; bills.frustumCulled = false; bills.count = 0; scene.add(bills);
const RINGS = Array.from({ length: 25 }, (_, i) => new THREE.RingGeometry(0.62, 0.8, 32, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, i / 24)).rotateX(-Math.PI / 2));
const ring = new THREE.Mesh(RINGS[0], new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })); ring.renderOrder = 6; scene.add(ring);
const ringBg = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); scene.add(ringBg);

let world = new THREE.Group(); scene.add(world);
const GRASS = canvasTex(256, 256, (x) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,80,0,.07)' : 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 0, 7); x.fill(); } }, [30, 30]);
const outside = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#9fe0a0', roughness: 1 }));
outside.rotation.x = -Math.PI / 2; outside.position.y = -0.02; outside.receiveShadow = true; scene.add(outside);

// ------------------------------------------------------------------ layout
const ROOM_W = 5, ROOM_D = 4.6, CORR = 1.5, LOBBY_Z1 = 9;
const DESK = { x: 0, z: 2.2, hw: 1.7, hd: 0.45 }, SERVE = { x: 0, z: 1.05 }, PILE = { x: -2.6, z: 2.2 };
const rowZ = j => -ROOM_D / 2 - j * ROOM_D;
let angry = 0, theme, rooms = [], pads = [], walls = [], guests = [], staff = [], billsL = [], cash = 0, state = 'ready', spawnT = 0, topZ = -10, served = 0;
let levelT = 0, streak = 0, bestStreak = 0, walkouts = 0, waveI = 0, kitchen = null, tips = 0, stationG = null;
const KITCH = { x: 4.6, z: 2.5 };
const mgr = { g: null, x: 0, z: 1.0, vx: 0, vz: 0, act: null, actT: 0, speed: 5.2, carry: [] };

function wallBox(x0, z0, x1, z1, h, color, parts) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  parts.push([rbox(w, h, d, 0.08), M((x0 + x1) / 2, h / 2, (z0 + z1) / 2), color]);
  walls.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
}
function roomMesh(rm) {
  const s = rm.side, zc = rm.z, xi = s * CORR, xo = s * (CORR + ROOM_W), parts = [], H = 1.1, wc = theme.wall;
  const wl = []; const keep = walls; walls = wl;
  wallBox(xo - s * 0.12, zc - ROOM_D / 2, xo + s * 0.12, zc + ROOM_D / 2, H, wc, parts);
  wallBox(xi, zc - ROOM_D / 2 - 0.12, xo, zc - ROOM_D / 2 + 0.12, H, wc, parts);
  wallBox(xi, zc + ROOM_D / 2 - 0.12, xo, zc + ROOM_D / 2 + 0.12, H, wc, parts);
  wallBox(xi - 0.12, zc - ROOM_D / 2, xi + 0.12, zc - 0.95, H, wc, parts);
  wallBox(xi - 0.12, zc + 0.95, xi + 0.12, zc + ROOM_D / 2, H, wc, parts);
  walls = keep; rm.walls = wl;
  const bx = s * (CORR + ROOM_W - 1.35);
  parts.push([rbox(2.2, 0.42, 1.9, 0.12), M(bx, 0.3, zc), theme.wood], [rbox(1.8, 0.2, 1.8, 0.12), M(bx - s * 0.1, 0.6, zc), '#ffffff'],
    [rbox(0.55, 0.22, 1.5, 0.1), M(bx + s * 0.7, 0.75, zc), '#ffffff'], [rbox(0.25, 0.9, 1.9, 0.1), M(bx + s * 1.15, 0.65, zc), theme.wood],
    [rbox(0.7, 0.55, 0.6, 0.08), M(bx + s * 0.75, 0.28, zc - 1.35), theme.wood], [new THREE.CylinderGeometry(0.16, 0.2, 0.3, 12), M(bx + s * 0.75, 0.7, zc - 1.35), '#fff3c4'],
    [new THREE.CylinderGeometry(1.1, 1.1, 0.03, 28), M(s * (CORR + 1.6), 0.02, zc, 0, 0, 0, 1, 1, 0.8), rm.suite ? '#ffd23f' : theme.carpet],
    [new THREE.CylinderGeometry(0.28, 0.22, 0.45, 10), M(s * (CORR + 0.55), 0.22, zc - 1.75), '#d98c5f'], [new THREE.IcosahedronGeometry(0.42, 1), M(s * (CORR + 0.55), 0.75, zc - 1.75), '#4caf50']);
  const g = new THREE.Group(), m = new THREE.Mesh(merge(parts), vmat()); m.castShadow = true; m.receiveShadow = true; g.add(m);
  if (rm.suite) parts.push([rbox(0.5, 1.1, 0.5, 0.08), M(s * (CORR + 0.7), 0.55, zc + 1.5), '#ffd23f'], [new THREE.SphereGeometry(0.28, 12, 8), M(s * (CORR + 0.7), 1.3, zc + 1.5), '#fff3c4'], [rbox(0.7, 0.8, 0.12, 0.05), M(s * (CORR + ROOM_W - 0.25), 1.9, zc - 1.2), '#ffd23f']);
  const blanket = new THREE.Mesh(rbox(1.85, 0.12, 1.86, 0.06), new THREE.MeshStandardMaterial({ color: rm.suite ? '#ffb300' : theme.bed, roughness: 0.6 })); blanket.position.set(bx - s * 0.25, 0.75, zc); blanket.castShadow = true; g.add(blanket);
  const mess = new THREE.Group(); for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: ['#c7b89a', '#9aa0a6', '#e8d9b5'][i % 3], flatShading: true })); t.position.set(s * (CORR + 1 + Math.random() * 2.5), 0.12, zc + (Math.random() - 0.5) * 3); mess.add(t); } g.add(mess);
  rm.blanket = blanket; rm.mess = mess; rm.bed = { x: bx - s * 0.2, z: zc };
  return g;
}

function setLabel(p) {
  const c = p.tex.userData.c, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '64px system-ui,Apple Color Emoji'; x.fillText(p.icon, 128, 62);
  x.font = '900 34px "Baloo 2",system-ui'; x.fillText(p.title, 128, 128);
  x.font = '900 46px "Baloo 2",system-ui'; x.fillStyle = '#fff6a8'; x.fillText('$' + Math.max(0, p.cost - p.paid), 128, 186);
  p.tex.needsUpdate = true;
}
function makePad(kind, x, z, cost, title, icon, extra = {}) {
  const g = new THREE.Group(); g.position.set(x, 0.03, z);
  const tex = canvasTex(256, 230, () => {});
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c) => { c.fillStyle = 'rgba(40,50,90,.45)'; c.beginPath(); c.roundRect(4, 4, 120, 120, 18); c.fill(); c.setLineDash([14, 9]); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.roundRect(8, 8, 112, 112, 16); c.stroke(); }), transparent: true, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#59e36f', transparent: true, opacity: 0.85, depthWrite: false }));
  fill.position.y = 0.01; fill.scale.z = 0.001; fill.position.z = 1.05;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); lab.position.y = 0.02;
  g.add(base, fill, lab); world.add(g);
  const p = { kind, x, z, cost, paid: 0, title, icon, g, fill, tex, done: false, feedT: 0, ...extra }; setLabel(p); pads.push(p); return p;
}

function buildLevel() {
  world.traverse(o => { if (o.geometry && !RINGS.includes(o.geometry)) o.geometry.dispose(); }); scene.remove(world); world = new THREE.Group(); scene.add(world);
  for (const g of guests) { scene.remove(g.g); scene.remove(g.icon); } for (const s of staff) scene.remove(s.g); guests = []; staff = []; pads = []; rooms = []; walls = []; billsL = []; cash = 0; served = 0; spawnT = 0.5; angry = 0; fk = F.k(); updHearts();
  L = levelOf(level); levelT = 0; streak = 0; bestStreak = 0; walkouts = 0; timers.length = 0; waveI = 0; kitchen = null; tips = 0; stationG = null; updStreak(); hideToast();
  const wi = worldOf(level), W = WORLDS[wi]; theme = { ...THEMES[(level - 1) % THEMES.length], name: L.name, out: W.out }; applyPalette(palette(level)); outside.material.color.set(W.out); outside.material.map = wi === 0 ? GRASS : null; outside.material.needsUpdate = true;
  const roomPads = L.pads.filter(p => p[0] === 'room' || p[0] === 'suite'), ordOf = p => L.pads.indexOf(p), nRooms = 1 + roomPads.length, rowsN = Math.ceil(nRooms / 2); topZ = rowZ(rowsN - 1) - ROOM_D / 2;
  // floors: lobby tiles, corridor carpet, room wood
  const tiles = canvasTex(128, 128, (x) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = theme.tile[(i + j) % 2]; x.fillRect(i * 64, j * 64, 64, 64); } }, [13 / 2, LOBBY_Z1 / 2]);
  const lobby = new THREE.Mesh(new THREE.PlaneGeometry(13, LOBBY_Z1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 })); lobby.position.set(0, 0, LOBBY_Z1 / 2); lobby.receiveShadow = true; world.add(lobby);
  const carpetT = canvasTex(64, 128, (x) => { x.fillStyle = theme.carpet; x.fillRect(0, 0, 64, 128); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(6, 0, 5, 128); x.fillRect(53, 0, 5, 128); for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(32, 16 + i * 32, 6, 0, 7); x.fill(); } }, [1, -topZ / 2]);
  const corr = new THREE.Mesh(new THREE.PlaneGeometry(CORR * 2, -topZ).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: carpetT, roughness: 0.8 })); corr.position.set(0, 0.005, topZ / 2); corr.receiveShadow = true; world.add(corr);
  const woodT = canvasTex(128, 128, (x) => { x.fillStyle = theme.wood; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; x.fillRect(0, i * 16, 128, 16); x.fillStyle = 'rgba(90,50,20,.18)'; x.fillRect(((i * 37) % 128), i * 16, 2, 16); } }, [2, 2]);
  const lockedT = canvasTex(64, 64, (x) => { x.fillStyle = '#d9dbe4'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#cfd2dc'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); }, [3, 3]);
  // shell: outer walls around lobby + wall between lobby and rooms
  const sp = [], wc = theme.wall;
  wallBox(-6.6, topZ, -6.4, LOBBY_Z1, 0.7, wc, sp); wallBox(6.4, topZ, 6.6, LOBBY_Z1, 0.7, wc, sp); wallBox(-6.6, topZ - 0.2, 6.6, topZ, 0.7, wc, sp);
  wallBox(-6.6, -0.12, -CORR, 0.12, 1.1, wc, sp); wallBox(CORR, -0.12, 6.6, 0.12, 1.1, wc, sp);
  wallBox(-6.6, LOBBY_Z1 - 0.12, -1.8, LOBBY_Z1 + 0.12, 0.7, wc, sp); wallBox(1.8, LOBBY_Z1 - 0.12, 6.6, LOBBY_Z1 + 0.12, 0.7, wc, sp);
  // desk + decor
  sp.push([rbox(DESK.hw * 2, 1.0, DESK.hd * 2, 0.14), M(DESK.x, 0.5, DESK.z), theme.wood], [rbox(DESK.hw * 2 + 0.2, 0.12, DESK.hd * 2 + 0.25, 0.06), M(DESK.x, 1.05, DESK.z), '#ffffff'],
    [rbox(0.5, 0.35, 0.35, 0.05), M(0.9, 1.25, DESK.z - 0.1), '#3a3d4a'], [new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(-0.8, 1.11, DESK.z), '#ffd23f'],
    [new THREE.CylinderGeometry(1.1, 1.1, 0.03, 32), M(0, 0.02, 7.4, 0, 0, 0, 1.4, 1, 0.7), theme.carpet]);
  walls.push({ x0: DESK.x - DESK.hw, x1: DESK.x + DESK.hw, z0: DESK.z - DESK.hd, z1: DESK.z + DESK.hd });
  for (const [px, pz] of [[-5.6, 8.2], [5.6, 8.2], [-5.6, 0.9], [5.6, 0.9]]) sp.push([new THREE.CylinderGeometry(0.35, 0.28, 0.6, 12), M(px, 0.3, pz), '#e98a5b'], [new THREE.IcosahedronGeometry(0.62, 1), M(px, 1.05, pz), '#3fae4e'], [new THREE.IcosahedronGeometry(0.4, 1), M(px + 0.2, 1.45, pz - 0.1), '#56c25f']);
  sp.push([new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20), M(PILE.x, 0.03, PILE.z), '#ffffff']);
  // lobby lounge: sofa + coffee table, entrance walkway, garden outside
  sp.push([rbox(2.6, 0.45, 0.9, 0.15), M(-4.3, 0.3, 3.2), theme.carpet], [rbox(2.6, 0.7, 0.3, 0.12), M(-4.3, 0.55, 2.8), theme.carpet], [rbox(0.3, 0.6, 0.9, 0.1), M(-5.5, 0.45, 3.2), theme.carpet],
    [new THREE.CylinderGeometry(0.5, 0.5, 0.08, 20), M(-4.3, 0.42, 4.3), '#ffffff'], [new THREE.CylinderGeometry(0.08, 0.12, 0.4, 8), M(-4.3, 0.2, 4.3), '#9aa0aa'],
    [rbox(0.9, 1.6, 0.6, 0.1), M(5.6, 0.8, 3.2), '#4cc9f0'], [rbox(0.7, 0.5, 0.05, 0.05), M(5.6, 1.15, 3.52), '#e0fbff'],
    [rbox(3.4, 0.04, 9, 0.02), M(0, 0.01, LOBBY_Z1 + 4.6), '#f3e9dc'], [rbox(4.2, 0.18, 0.5, 0.08), M(0, 0.09, LOBBY_Z1 + 0.35), '#c9b8a6']);
  // back garden by world: 0 pool + palms, 1 frozen pond + pines + snowmen, 2 plaza fountain + towers
  if (wi === 0) {
    sp.push([rbox(8, 0.3, 4.2, 0.6), M(0, 0.05, topZ - 3.6), '#f3e9dc'], [rbox(6.6, 0.32, 2.9, 0.5), M(0, 0.07, topZ - 3.6), '#4fc3f7'], [rbox(5.6, 0.33, 1.9, 0.4), M(0, 0.075, topZ - 3.6), '#81d4fa']);
    for (const sd of [-1, 1]) sp.push([rbox(0.9, 0.25, 2, 0.1), M(sd * 5.2, 0.25, topZ - 3.4), '#ffffff'], [rbox(0.9, 0.5, 0.5, 0.1), M(sd * 5.2, 0.45, topZ - 4.2, 0.5, 0, 0), '#ffffff'], [new THREE.ConeGeometry(0.9, 0.4, 12), M(sd * 5.2, 2.2, topZ - 2.9), sd > 0 ? '#ff8fab' : '#ffd166'], [new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), M(sd * 5.2, 1.05, topZ - 2.9), '#ffffff']);
    for (let i = 0; i < 9; i++) { const x = -8 + i * 2; sp.push([new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), M(x, 0.7, topZ - 7 - (i % 2)), '#8d6e63'], [new THREE.IcosahedronGeometry(1.3, 1), M(x, 2.3, topZ - 7 - (i % 2)), i % 2 ? '#43a047' : '#5cb85c']); }
  } else if (wi === 1) {
    sp.push([rbox(8, 0.3, 4.2, 0.6), M(0, 0.05, topZ - 3.6), '#ffffff'], [rbox(6.2, 0.32, 2.7, 0.5), M(0, 0.07, topZ - 3.6), '#b9e4f7'], [rbox(4.4, 0.33, 1.5, 0.4), M(0, 0.075, topZ - 3.6), '#dff4fd']);
    for (const sd of [-1, 1]) sp.push([new THREE.SphereGeometry(0.6, 12, 8), M(sd * 5.2, 0.5, topZ - 3.4), '#ffffff'], [new THREE.SphereGeometry(0.42, 12, 8), M(sd * 5.2, 1.3, topZ - 3.4), '#ffffff'], [new THREE.ConeGeometry(0.1, 0.35, 8), M(sd * 5.2, 1.3, topZ - 3.0, Math.PI / 2, 0, 0), '#ff8a3d']);
    for (let i = 0; i < 9; i++) { const x = -8 + i * 2, z = topZ - 7 - (i % 2); sp.push([new THREE.CylinderGeometry(0.2, 0.26, 1, 8), M(x, 0.5, z), '#7a5a43'], [new THREE.ConeGeometry(1.2, 2.2, 9), M(x, 1.8, z), '#2f7d52'], [new THREE.ConeGeometry(0.9, 1.7, 9), M(x, 3.0, z), '#3b9566'], [new THREE.ConeGeometry(0.5, 1.0, 9), M(x, 3.9, z), '#ffffff']); }
  } else {
    sp.push([rbox(8, 0.3, 4.2, 0.6), M(0, 0.05, topZ - 3.6), '#c9ced9'], [new THREE.CylinderGeometry(1.5, 1.6, 0.4, 24), M(0, 0.3, topZ - 3.6), '#e8ecf5'], [new THREE.CylinderGeometry(1.2, 1.2, 0.2, 24), M(0, 0.5, topZ - 3.6), '#4fc3f7'], [new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), M(0, 1.0, topZ - 3.6), '#e8ecf5']);
    for (let i = 0; i < 8; i++) { const x = -9.5 + i * 2.7, h = 3 + ((i * 37) % 5) * 1.3; sp.push([rbox(2.2, h, 2.2, 0.1), M(x, h / 2, topZ - 8 - (i % 3)), ['#6b7a99', '#8795b3', '#5b6a88'][i % 3]], [rbox(1.6, 0.3, 0.05, 0.02), M(x, h * 0.7, topZ - 8 - (i % 3) + 1.12), '#ffe9a0'], [rbox(1.6, 0.3, 0.05, 0.02), M(x, h * 0.4, topZ - 8 - (i % 3) + 1.12), '#ffe9a0']); }
    for (const sd of [-1, 1]) sp.push([new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), M(sd * 5.2, 1.3, topZ - 3.4), '#40475a'], [new THREE.SphereGeometry(0.25, 10, 8), M(sd * 5.2, 2.7, topZ - 3.4), '#ffe9a0']);
  }
  for (const sd of [-1, 1]) {
    sp.push([rbox(0.25, 2.4, 0.25, 0.06), M(sd * 1.9, 1.2, LOBBY_Z1), '#ffffff'], [rbox(0.3, 0.3, 0.3, 0.06), M(sd * 1.9, 2.5, LOBBY_Z1), '#ffd23f']);
    for (let i = 0; i < 7; i++) { const z = topZ + 2 + i * ((LOBBY_Z1 - topZ) / 7); sp.push([new THREE.IcosahedronGeometry(0.75 + (i % 3) * 0.15, 1), M(sd * (7.4 + (i % 2) * 0.6), 0.55, z), i % 2 ? '#4caf50' : '#66bb6a']); }
    for (let i = 0; i < 4; i++) sp.push([new THREE.IcosahedronGeometry(0.55, 1), M(sd * (2.6 + i * 1.1), 0.4, LOBBY_Z1 + 1.1), ['#ff8fab', '#ffd166', '#66bb6a', '#a0c4ff'][i]]);
    sp.push([new THREE.CylinderGeometry(0.25, 0.32, 1.6, 8), M(sd * 4.5, 0.8, LOBBY_Z1 + 4), '#8d6e63'], [new THREE.IcosahedronGeometry(1.5, 1), M(sd * 4.5, 2.6, LOBBY_Z1 + 4), '#43a047'], [new THREE.IcosahedronGeometry(1.0, 1), M(sd * 4.2, 3.6, LOBBY_Z1 + 3.8), '#5cb85c']);
  }
  const shell = new THREE.Mesh(merge(sp), vmat()); shell.castShadow = true; shell.receiveShadow = true; world.add(shell);
  // rooms
  for (let i = 0; i < nRooms; i++) {
    const side = i % 2 ? 1 : -1, j = Math.floor(i / 2), z = rowZ(j), cx = side * (CORR + ROOM_W / 2);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: i === 0 ? woodT : lockedT, roughness: 0.7 })); fl.position.set(cx, 0.004, z); fl.receiveShadow = true; world.add(fl);
    const suite = i > 0 && roomPads[i - 1][0] === 'suite', rm = { i, side, z, cx, open: i === 0, suite, state: 'free', guest: null, cleanT: 0, floor: fl, wood: woodT, icon: sprite(ICONS.clean), pop: 0 };
    rm.icon.position.set(cx, 2.6, z); rm.icon.visible = false; world.add(rm.icon);
    rooms.push(rm);
    if (i === 0) { rm.g = roomMesh(rm); world.add(rm.g); walls.push(...rm.walls); setRoomLook(rm); }
    else makePad(suite ? 'suite' : 'room', cx, z, roomPads[i - 1][1], suite ? 'SUITE' : 'ROOM ' + (i + 1), suite ? '👑' : '🛏️', { room: rm, ord: ordOf(roomPads[i - 1]) });
  }
  const SLOT = { recep: [-4.4, 5.6, 'RECEPTION', '🧑‍💼'], maid: [4.4, 5.6, 'HOUSEKEEP', '🧽'], speed: [4.4, 7.9, 'FAST SHOES', '👟'], kitchen: [-4.4, 7.9, 'KITCHEN', '🍽️'], cook: [4.4, 4.0, 'COOK', '👨‍🍳'] };
  for (const pd of L.pads) { const [k, cost] = pd; if (SLOT[k]) makePad(k, SLOT[k][0], SLOT[k][1], cost, SLOT[k][2], SLOT[k][3], { ord: ordOf(pd) }); }
  // starting cash on the desk pile
  for (let i = 0; i < 6; i++) addBill('pile');
  // manager
  if (mgr.g) scene.remove(mgr.g);
  mgr.g = person(SUITS[SAVE.suit].c, '#ffd7ba', true, SUITS[SAVE.suit].h); scene.add(mgr.g); dressMgr(); Object.assign(mgr, { x: 0, z: 1.0, vx: 0, vz: 0, act: null, actT: 0, speed: 5.2, carry: [], tray: 0 });
  ui.levels(level); updCash(); updGoal(); camZ = 2; announce();
}
function person(color, skin, hat, hatColor = '#c1121f') {
  const g = stickman(color, skin, 1.3);
  for (const l of [g.armL, g.armR, g.legL, g.legR]) l.traverse(o => { o.castShadow = false; });
  if (hat) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.2, 16), new THREE.MeshStandardMaterial({ color: hatColor })); h.position.y = 1.7; h.castShadow = true; g.add(h); h.scale.setScalar(1); const b = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: '#ffd23f' })); b.rotation.x = Math.PI / 2; b.position.y = 1.62; g.add(b); }
  return g;
}
// ------------------------------------------------------------------ my hero (Hero Lab): only the bellhop's look changes
// The stickman group stays (position, facing, the bill stack and every rule read it); its meshes are hidden and the
// hero hangs inside it. The group is scaled 1.3, so the hero is built at 2.0 / 1.3 (the bellhop's head top is 2.2; heroes are bulkier).
let hero = null, heroTok = 0, heroSig, heroClip = 'idle';
function dressMgr() {
  if (!mgr.g) return;
  for (const o of mgr.g.children) if (!hero || o !== hero.object) o.visible = !hero;
  if (hero && hero.object.parent !== mgr.g) mgr.g.add(hero.object);
}
async function buildHero() {
  const t = ++heroTok, h = selectedHero(); heroSig = JSON.stringify(h);
  if (hero) { hero.dispose(); hero = null; dressMgr(); }
  if (!h) return;
  try {
    const next = await loadHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: 2.0 / 1.3, clip: 'idle' });
    if (t !== heroTok) { next.dispose(); return; }
    hero = next; heroClip = 'idle'; dressMgr();
  } catch (e) { console.warn('hero', e); }
}
const syncHero = () => { if (JSON.stringify(selectedHero()) !== heroSig) buildHero(); };
function animHero(mv, sec) {
  if (!hero) return;
  const moving = heroClip === 'run' || heroClip === 'sprint' ? mv > 0.35 : mv > 0.6;
  const want = state === 'won' ? 'cheer' : state === 'lost' ? 'fall' : !moving ? 'idle' : mv > 6 ? 'sprint' : 'run';
  if (want !== heroClip) { heroClip = want; hero.play(want, { fade: 0.15, once: want === 'fall' }); }
  if (want === 'run' || want === 'sprint') hero.actions[want].timeScale = clamp(mv / (want === 'run' ? 4.2 : 6.5), 0.55, 1.35);
  hero.mixer.update(sec);
}
function setRoomLook(rm) {
  rm.mess.visible = rm.state === 'dirty'; rm.icon.visible = rm.state === 'dirty' || rm.state === 'broken'; rm.icon.material.map = rm.state === 'broken' ? ICONS.fix : ICONS.clean;
  rm.blanket.rotation.y = rm.state === 'dirty' || rm.state === 'broken' ? 0.35 : 0; rm.blanket.position.y = rm.state === 'dirty' || rm.state === 'broken' ? 0.72 : 0.75;
}

// ------------------------------------------------------------------ cash bills (one InstancedMesh)
function addBill(where, from) { const b = { where, t: 0, x: 0, y: 0, z: 0 }; if (from) { b.fx = from.x; b.fy = from.y; b.fz = from.z; b.fly = 0; } billsL.push(b); return b; }
function pileCount() { return billsL.filter(b => b.where === 'pile').length; }
const cashEl = document.createElement('div'); cashEl.className = 'bb-cash'; document.body.appendChild(cashEl);
const goalEl = document.createElement('div'); goalEl.className = 'bb-goal'; document.body.appendChild(goalEl);
let gainAcc = 0, gainT = 0;
function gainChip(n) { gainAcc += n; if (gainT) return; gainT = setTimeout(() => { gainT = 0; const c = document.createElement('div'); c.textContent = '+$' + gainAcc; gainAcc = 0; c.style.cssText = 'position:fixed;left:50%;top:calc(98px + env(safe-area-inset-top));transform:translateX(-50%);font:800 24px Baloo 2,system-ui,sans-serif;color:#9dff8a;text-shadow:0 2px 0 rgba(0,0,0,.35);pointer-events:none;z-index:6;transition:transform .7s ease-out,opacity .7s';document.body.appendChild(c); requestAnimationFrame(() => { c.style.transform = 'translate(-50%,-34px) scale(1.2)'; c.style.opacity = '0'; }); setTimeout(() => c.remove(), 750); }, 200); }
function flyCoin(x, y, z) {
  const v = V(x, y, z).project(camera); if (v.z > 1) return;
  const r = cashEl.getBoundingClientRect(), sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
  const c = document.createElement('div'); c.textContent = '🪙'; c.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;font-size:22px;pointer-events:none;z-index:6;transition:transform .5s cubic-bezier(.5,-0.3,.8,.6),opacity .5s;will-change:transform`;
  document.body.appendChild(c); requestAnimationFrame(() => { c.style.transform = `translate(${r.left + 20 - sx}px,${r.top + 10 - sy}px) scale(.6)`; c.style.opacity = '.6'; }); setTimeout(() => c.remove(), 560);
}
let lastFly = 0;
function updCash(bump) { cashEl.innerHTML = `<b>$</b>${cash}`; if (bump) { cashEl.classList.remove('bump'); void cashEl.offsetWidth; cashEl.classList.add('bump'); } }
function updHearts() { heartsEl.textContent = '❤️'.repeat(3 - angry) + '🖤'.repeat(angry); }
const heartsEl = document.createElement('div'); heartsEl.style.cssText = 'position:fixed;right:12px;top:calc(60px + env(safe-area-inset-top));font-size:20px;z-index:5;pointer-events:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.2))'; document.body.appendChild(heartsEl);
function updGoal() { const d = pads.filter(p => p.done).length; goalEl.textContent = `${theme.name} · upgrades ${d}/${pads.length}`; ui.progress(d / pads.length); }

// ------------------------------------------------------------------ guests + staff
const SHIRTS = ['#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0', '#fb5607', '#ff006e', '#118ab2'], SKINS = ['#ffd7ba', '#f1c27d', '#c68642', '#8d5524', '#ffdbac'];
// guest kinds: t tourist, r rusher ⚡ (short patience, double pay when checked in fast), v VIP 👑 (suite, 4x), c critic 🧐 (3x, a walkout is 2 bad reviews)
const KIND = { t: { pat: 1, pay: 1 }, r: { pat: 0.62, pay: 1 }, v: { pat: 1.3, pay: 4 }, c: { pat: 0.75, pay: 3 } };
const patOf = gu => Math.max(8, L.pat * KIND[gu.kind].pat / fk) * (gu.coach ? 1.3 : 1);
const timers = [];
const later = (sec, fn) => timers.push({ t: sec, fn });
const openSuite = () => rooms.some(r => r.open && r.suite);
const vipWaiting = () => guests.some(g => g.kind === 'v' && (g.st === 'queue' || g.st === 'desk'));
function pickKind() {
  const mix = Object.entries(L.mix).filter(([k]) => k !== 'v' || (rooms.some(r => r.open && r.suite && r.state === 'free') && !vipWaiting()) ).filter(([k]) => k !== 'c' || guests.filter(g => g.kind === 'c' && g.st !== 'gone' && g.st !== 'leave').length < 1);
  const tot = mix.reduce((a, [, w]) => a + w, 0); let r = Math.random() * tot;
  for (const [k, w] of mix) { r -= w; if (r <= 0) return k; } return 't';
}
const GOLDMARK = bubbleTex('🌟', '#fff3a0');
function spawnGuest(kind = 't', coach = false) {
  if (kind === 'v' && !openSuite()) kind = 'r';
  const gold = kind === 't' && !coach && ((level === 1 && served === 1 && !SAVE.stars[1]) || (served >= 2 && Math.random() < 0.11));
  const shirt = gold ? '#ffd23f' : kind === 'v' ? '#ffcf33' : kind === 'c' ? '#2a2d3a' : kind === 'r' ? '#ff8a3d' : SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const g = person(shirt, SKINS[Math.floor(Math.random() * SKINS.length)]);
  const bag = new THREE.Mesh(rounded(0.45, 0.35, 0.18, 0.05), new THREE.MeshStandardMaterial({ color: ['#ff5d8f', '#3ab795', '#ffd23f', '#7b5cff'][Math.floor(Math.random() * 4)] })); bag.position.set(0.38, 0.45, 0); g.add(bag);
  if (kind === 'v') { const cr = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.22, 5), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9a00', emissiveIntensity: 0.4 })); cr.position.y = 1.78; g.add(cr); }
  if (kind === 'c') { const gl = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), new THREE.MeshStandardMaterial({ color: '#111' })); gl.position.set(0, 1.52, 0.19); g.add(gl); }
  const icon = sprite(ICONS.bell, 1.0); icon.visible = false; scene.add(icon);
  let mark = null; if (kind !== 't') { mark = sprite(MARKS[kind], 0.62); scene.add(mark); } else if (gold) { mark = sprite(GOLDMARK, 1.0); scene.add(mark); }
  g.traverse(o => { o.castShadow = false; });
  scene.add(g);
  const gu = { g, x: 0, z: LOBBY_Z1 + 3, path: [], st: 'queue', icon, mark, room: null, t: 0, bag, speed: 4.4, kind, coach, gold };
  guests.push(gu); return gu;
}
const queueSpot = k => ({ x: 0, z: DESK.z + 1.05 + k * 0.95 });
function roomRoute(rm, inside = true) { const r = [{ x: 0, z: -0.5 }, { x: 0, z: rm.z }, { x: rm.side * (CORR + 0.4), z: rm.z }]; if (inside) r.push({ x: rm.bed.x, z: rm.bed.z }); return r; }
function freeRoom(gu) {
  const ok = r => r.open && r.state === 'free';
  if (gu && gu.kind === 'v') return rooms.find(r => ok(r) && r.suite);
  return rooms.find(r => ok(r) && !r.suite) || (vipWaiting() ? null : rooms.find(r => ok(r) && r.suite));
}
function hireStaff(kind) {
  const col = { recep: '#7b5cff', maid: '#06d6a0', cook: '#f4f4f4' }[kind];
  const g = person(col, SKINS[Math.floor(Math.random() * SKINS.length)], kind === 'recep' || kind === 'cook', kind === 'cook' ? '#ffffff' : undefined);
  scene.add(g); const pos = { recep: [-4.4, 5.6], maid: [4.4, 5.6], cook: [KITCH.x - 1.3, KITCH.z - 0.2] }[kind];
  const s = { kind, g, x: pos[0], z: pos[1], home: { x: pos[0], z: pos[1] }, path: kind === 'recep' ? [{ x: -2.2, z: 1.0 }, { x: SERVE.x, z: SERVE.z }] : [], st: 'idle', t: 0, room: null, speed: 2.8 };
  staff.push(s); return s;
}
// a staff member walks to a room's inside: from the lobby or from the room they are in
function sendTo(s, rm) {
  const cur = rooms.find(r => r.open && inRoom(s, r)); s.room = rm; s.st = 'go';
  s.path = [...(cur ? [{ x: cur.side * (CORR + 0.4), z: cur.z }, { x: 0, z: cur.z }] : [{ x: 3.6, z: 0.8 }, { x: 0, z: 0.8 }, { x: 0, z: -0.5 }]), { x: 0, z: rm.z }, { x: rm.side * (CORR + 0.4), z: rm.z }, { x: rm.cx, z: rm.z }];
}
function walk(o, dt, sec) {
  if (!o.path.length) return true;
  const p = o.path[0], dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), step = o.speed * sec;
  if (d <= step) { o.x = p.x; o.z = p.z; o.path.shift(); } else { o.x += dx / d * step; o.z += dz / d * step; o.face = Math.atan2(dx, dz); }
  return !o.path.length;
}

// ------------------------------------------------------------------ input: floating joystick
const joy = document.createElement('div'); joy.className = 'bb-joy'; joy.innerHTML = '<i></i>'; document.body.appendChild(joy);
let joyV = { x: 0, y: 0 }, joyOn = false, botUntil = 0, botDir = { x: 0, z: 0 }, goal = null;   // goal: tap-to-walk target on the floor
const fRay = new THREE.Raycaster(), fPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fHit = new THREE.Vector3();
function floorAt(x, y) { fRay.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return fRay.ray.intersectPlane(fPlane, fHit) ? { x: fHit.x, z: fHit.z } : null; }
input({
  onDown: (e, st) => { if (state !== 'play') return; joyOn = true; joy.style.display = 'block'; joy.style.left = st.x + 'px'; joy.style.top = st.y + 'px'; joyV = { x: 0, y: 0 }; joy.firstChild.style.transform = ''; },
  onMove: (dx, dy, e, st) => { if (!joyOn) return; let vx = e.clientX - st.x, vy = e.clientY - st.y; const d = Math.hypot(vx, vy), m = 46; if (d > m) { vx *= m / d; vy *= m / d; } joyV = { x: vx / m, y: vy / m }; joy.firstChild.style.transform = `translate(${vx}px,${vy}px)`; },
  onUp: (e, st) => { joyOn = false; joy.style.display = 'none'; joyV = { x: 0, y: 0 }; if (state === 'play' && st && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12) { const g = floorAt(e.clientX, e.clientY); if (g && !(mgr.act && Math.hypot(g.x - mgr.x, g.z - mgr.z) < 2)) goal = g; } },
});
ui.onTap(w => { WB.start(); if (w === 'start') { state = 'play'; announce(); } });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the manager walks (tap-to-walk) over to the cash pile, scoops up the first bills and walks back to the desk
let demoWent = false;
demo(() => {
  if (!demoWent) { if (!pileCount()) return; goal = { x: PILE.x + 0.3, z: PILE.z }; demoWent = true; return; }
  goal = { x: SERVE.x, z: SERVE.z }; return false;
}, { ready: () => level === 1 && state === 'play' && !joyOn && !goal, wait: 1200, every: 700, max: 12 });

function collide(o, r = 0.35) {
  for (const w of walls) {
    const cx = clamp(o.x, w.x0, w.x1), cz = clamp(o.z, w.z0, w.z1), dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
    if (d < r) { if (d > 1e-4) { o.x = cx + dx / d * r; o.z = cz + dz / d * r; } else { o.z = w.z1 + r; } }
  }
  o.x = clamp(o.x, -6.1, 6.1); o.z = clamp(o.z, topZ + 0.4, LOBBY_Z1 + 1.2);
}

// ------------------------------------------------------------------ main loop
let camZ = 2, camX = 0;
const near = (o, p, r) => Math.hypot(o.x - p.x, o.z - p.z) < r;
const inRoom = (o, rm) => Math.abs(o.z - rm.z) < ROOM_D / 2 - 0.15 && o.x * rm.side > CORR + 0.1 && o.x * rm.side < CORR + ROOM_W;
let stuckT = 0, stuckSide = 0, simK = 1, shake = 0, botOn = false;
const trayIcon = sprite(ICONS.tray, 1.1); trayIcon.visible = false; scene.add(trayIcon);   // QA: run the simulation k steps per frame

// ---- next-action arrow (points at what to do next when it is off screen, bounces over it when it is not) + tap marker
const hintEl = document.createElement('div'); hintEl.className = 'bb-hint'; hintEl.textContent = '▼'; document.body.appendChild(hintEl);
const tapMark = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.8 })); tapMark.visible = false; scene.add(tapMark);
const hv = new THREE.Vector3(); let hintT = 0, idleT = 0;
function updHint(sec, t) {
  tapMark.visible = !!goal && state === 'play'; if (goal) { tapMark.position.set(goal.x, 0.08, goal.z); tapMark.scale.setScalar(1 + Math.sin(t * 8) * 0.12); }
  if (state !== 'play' || levelT < 1) { hintEl.style.display = 'none'; return; }
  idleT = (joyOn || goal || Math.hypot(mgr.vx, mgr.vz) > 0.5) ? 0 : idleT + sec;
  const away = joyOn || goal || Math.hypot(mgr.vx, mgr.vz) > 0.5;
  hintT -= sec; if (hintT > 0 && hintEl.style.display === 'block') { /* keep last pos, refresh below */ }
  let tg; try { tg = pickTarget(); } catch (e) {}
  if (!tg || (!away && Math.hypot(tg.x - mgr.x, tg.z - mgr.z) < 1.2)) { hintEl.style.display = 'none'; return; }
  hv.set(tg.x, 1.2, tg.z).project(camera); let x = (hv.x * 0.5 + 0.5) * innerWidth, y = (-hv.y * 0.5 + 0.5) * innerHeight, off = false, ch = '▼';
  const m = 46; if (x < m || x > innerWidth - m || y < 150 || y > innerHeight - m) { off = true; const cx = innerWidth / 2, cy = innerHeight / 2, ang = Math.atan2(y - cy, x - cx); const k = Math.min((innerWidth / 2 - m) / Math.max(1e-3, Math.abs(Math.cos(ang))), (innerHeight / 2 - m) / Math.max(1e-3, Math.abs(Math.sin(ang)))); x = cx + Math.cos(ang) * k; y = cy + Math.sin(ang) * k; hintEl.style.transform = `translate(-50%,-50%) rotate(${ang + Math.PI / 2}rad)`; ch = '▲'; }
  else { hintEl.style.transform = `translate(-50%,-100%) translateY(${Math.sin(t * 7) * 6}px)`; y -= 18; }
  hintEl.textContent = ch; hintEl.style.left = x + 'px'; hintEl.style.top = y + 'px'; hintEl.style.display = (off || idleT > 2 || levelT < 40) ? 'block' : 'none';
}
loop((dt, t) => { for (let k = 0; k < simK; k++) step(dt, t + k * 0.001); updHint(dt / 60, t); });
function step(dt, t) {
  const sec = dt / 60;
  if (!mgr.g) return;
  if (state === 'play') { levelT += sec; for (const tm of timers) tm.t -= sec; while (timers.length && timers.some(x => x.t <= 0)) { const i = timers.findIndex(x => x.t <= 0); timers.splice(i, 1)[0].fn(); } }
  // ---- manager movement
  let mx = 0, mz = 0;
  if (state === 'play') {
    if (joyOn) { mx = joyV.x; mz = joyV.y; goal = null; } else if (botOn || performance.now() < botUntil) { if (botOn) window.__game.bot(); mx = botDir.x; mz = botDir.z; }
    else if (goal) { const wp = routeTo(mgr, goal), dx = wp.x - mgr.x, dz = wp.z - mgr.z, d = Math.hypot(dx, dz); if (Math.hypot(goal.x - mgr.x, goal.z - mgr.z) < 0.25 || d < 0.05) goal = null; else { const sp = Math.min(1, d * 1.5 + 0.3); mx = dx / d * sp; mz = dz / d * sp;
      // stuck on a wall corner: side-step along the wall for a moment, then try again
      if (Math.hypot(mgr.vx, mgr.vz) < 0.25 * mgr.speed) stuckT += sec; else stuckT = Math.max(0, stuckT - sec * 2);
      if (stuckT > 0.35) { const sg = stuckSide || (stuckSide = (mgr.x * dz - mgr.z * dx) > 0 ? 1 : -1); mx = -dz / d * sg; mz = dx / d * sg; if (stuckT > 0.8) { stuckT = 0; stuckSide = -sg; } } else stuckSide = 0; } }
  }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  mgr.vx = lerp(mgr.vx, mx * mgr.speed, 0.3 * dt); mgr.vz = lerp(mgr.vz, mz * mgr.speed, 0.3 * dt);
  mgr.x += mgr.vx * sec; mgr.z += mgr.vz * sec; collide(mgr);
  const mv = Math.hypot(mgr.vx, mgr.vz);
  if (mv > 0.3) mgr.face = Math.atan2(mgr.vx, mgr.vz);
  mgr.g.position.set(mgr.x, 0, mgr.z); mgr.g.rotation.y = lerp(mgr.g.rotation.y, mgr.face ?? 0, 0.25); mgr.g.run(t, Math.min(1, mv / 3)); animHero(mv, sec);
  // tray carried over the head
  trayIcon.visible = mgr.tray > 0 && state === 'play'; if (mgr.tray) { trayIcon.position.set(mgr.x, 2.9 + Math.sin(t * 6) * 0.06, mgr.z); trayIcon.scale.set(1.1 + 0.3 * (mgr.tray - 1), (1.1 + 0.3 * (mgr.tray - 1)) * 140 / 128, 1); }
  // ---- guests spawn + flow
  if (state === 'play') {
    spawnT -= sec;
    const queued = guests.filter(g => g.st === 'queue' || g.st === 'desk');
    if (spawnT <= 0 && queued.length < Math.min(5, 1 + rooms.filter(r => r.open).length)) { spawnGuest(pickKind()); spawnT = Math.max(L.gap, 7.5 / Math.pow(Math.max(1, rooms.filter(r => r.open).length), 0.9)); }
    // tour coaches: a crowd that arrives one after another
    const waves = L.waves || [];
    while (waveI < waves.length && levelT >= waves[waveI][0]) { const [, n, kind] = waves[waveI++]; coachBanner(); for (let i = 0; i < n; i++) later(0.9 + i * 0.5, () => { if (state === 'play') spawnGuest(kind === 'v' && !rooms.some(r => r.open && r.suite && r.state === 'free') ? 't' : kind, true); }); }
  }
  let qi = 0;
  const recep = staff.find(s => s.kind === 'recep' && !s.path.length);
  let serving = false;
  for (const gu of guests) {
    if (gu.st === 'queue' || gu.st === 'desk') {
      const spot = queueSpot(qi); if (qi === 0) gu.st = 'desk'; qi++;
      gu.path = [spot]; walk(gu, dt, sec);
      gu.icon.visible = gu.st === 'desk' && near(gu, spot, 0.1);
      const patience = patOf(gu); if (state === 'play') gu.wait = (gu.wait || 0) + sec;
      if (gu.wait > patience * 0.55) { gu.icon.visible = true; gu.icon.material.map = ICONS.angry; gu.icon.scale.setScalar(1 + Math.sin(t * 12) * 0.08); }
      if (gu.wait > patience) {
        gu.st = 'leave'; gu.icon.material.map = ICONS.angry; gu.path = [{ x: gu.x + 1.2, z: gu.z + 0.5 }, { x: 4.2, z: gu.z + 0.5 }, { x: 4.2, z: LOBBY_Z1 + 3 }];
        if (!L.safe) {
          const cost = gu.kind === 'c' ? 2 : 1; angry += cost; walkouts++; streak = 0; updStreak(); updHearts(); ui.pop(gu.kind === 'c' ? 'CRITIC WALKED OUT!' : 'GUEST WALKED OUT!', '#ff6b6b', 30, 30); sfx.fail(); buzz([40, 30, 40]); shake = 0.5;
          if (angry === 2 && state === 'play') { ui.pop('ONE MORE AND IT\'S OVER!', '#ffb347', 26, 30); } if (angry >= 3 && state === 'play') { state = 'lost'; F.level(false, pads.filter(x => x.done).length / Math.max(1, pads.length)); lose(); }
        }
        continue;
      }
      if (gu.st === 'desk' && near(gu, spot, 0.1)) {
        const room = freeRoom(gu);
        if (gu.wait <= patience * 0.55) gu.icon.material.map = room ? ICONS.bell : (gu.kind === 'v' ? ICONS.vipbed : ICONS.bed);
        const mgrServes = Math.abs(mgr.x - SERVE.x) < 1.6 && mgr.z < DESK.z - 0.2 && mgr.z > 0.2;
        if (room && (mgrServes || recep)) {
          serving = true; gu.t += sec * (mgrServes ? 1.6 : 1.0);
          if (mgrServes) { mgr.act = 'desk'; mgr.actT = gu.t / 0.7; }
          if (gu.t >= 0.7) checkIn(gu, room);
        }
      }
    } else if (gu.st === 'toroom') { if (walk(gu, dt, sec)) { gu.st = 'sleep'; gu.t = 0; gu.icon.material.map = ICONS.sleep; gu.icon.visible = true; gu.bag.visible = false;
        const rm = gu.room; if (kitchen && gu.kind !== 'c' && Math.random() < (L.svc || 0)) { gu.req = true; gu.reqT = 0; rm.req = true; gu.icon.material.map = ICONS.tray; ui.pop('🍽️ ROOM SERVICE!', '#fff3c4', 26, 38); tone(1200, 0.08, 'triangle', 0.08, 1); } } }
    else if (gu.st === 'sleep') {
      const rm = gu.room;
      gu.g.position.set(rm.bed.x - rm.side * 0.75, 0.9, rm.bed.z); gu.g.rotation.set(-Math.PI / 2, -rm.side * Math.PI / 2, 0, 'YXZ'); gu.icon.position.set(rm.bed.x, 2.2 + Math.sin(t * 3) * 0.1, rm.bed.z);
      if (gu.req) { gu.reqT += sec; gu.icon.scale.setScalar(1 + Math.sin(t * 10) * 0.07); if (gu.reqT > 14) { gu.req = false; rm.req = false; gu.icon.material.map = ICONS.sleep; gu.icon.scale.setScalar(1); streak = 0; updStreak(); ui.pop('TRAY TOO LATE', '#ffd0a0', 26, 38); } }
      else gu.t += sec;
      if (!gu.req && gu.t > (gu.kind === 'v' ? 4.2 : 2.6)) { gu.st = 'leave'; gu.g.rotation.set(0, 0, 0, 'XYZ'); gu.icon.visible = false; rm.state = L.brk && Math.random() < L.brk ? 'broken' : 'dirty'; setRoomLook(rm); rm.guest = null;
        gu.speed = 4.4; gu.path = [...roomRoute(rm, false).reverse(), { x: 0, z: 0.8 }, { x: 4.2, z: 0.8 }, { x: 4.2, z: LOBBY_Z1 + 2 }]; }
      continue;
    } else if (gu.st === 'leave') { if (walk(gu, dt, sec)) { gu.st = 'gone'; scene.remove(gu.g); gu.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); scene.remove(gu.icon); if (gu.mark) scene.remove(gu.mark); } }
    if (gu.st !== 'gone') { gu.icon.position.set(gu.x, 2.4 + Math.sin(t * 4) * 0.08, gu.z); if (gu.hop > 0) gu.hop = Math.max(0, gu.hop - sec * 2.2); gu.g.position.set(gu.x, Math.abs(Math.sin(gu.hop * Math.PI * 2)) * 0.5 * gu.hop, gu.z); if (gu.mark) { gu.mark.visible = gu.st === 'queue' || gu.st === 'desk' || gu.st === 'toroom'; gu.mark.position.set(gu.x + 0.5, 2.05 + Math.sin(t * 5 + gu.z) * 0.06, gu.z); } if (gu.face !== undefined) gu.g.rotation.y = lerp(gu.g.rotation.y, gu.face, 0.3); gu.g.run(t + gu.x, gu.path.length ? 1 : 0); }
  }
  guests = guests.filter(g => g.st !== 'gone');
  if (!serving && mgr.act === 'desk') mgr.act = null;
  // ---- kitchen: pick up a tray when someone upstairs ordered; deliver it by walking into that room
  if (kitchen) {
    const pending = rooms.filter(r => r.req).length;
    kitchen.spr.visible = pending > mgr.tray; kitchen.spr.position.y = 2.6 + Math.sin(t * 6) * 0.12;
    if (state === 'play' && pending > mgr.tray && mgr.tray < 2 && near(mgr, KITCH, 1.25)) { mgr.tray++; sfx.pick(3 + mgr.tray); buzz(10); ui.pop(mgr.tray > 1 ? '🍽️🍽️ 2 TRAYS!' : '🍽️ TRAY!', '#fff3c4', 26, 38); }
  }
  // ---- cleaning / repairs (manager or housekeeper standing in a dirty room)
  let cleaning = false;
  for (const rm of rooms) {
    if (!rm.open) continue;
    if (rm.pop > 0) { rm.pop = Math.max(0, rm.pop - sec * 2); const s = 1 + Math.sin((1 - rm.pop) * Math.PI) * 0.12 * rm.pop * 2; rm.g.scale.set(s, Math.min(1, 1.6 - rm.pop * 1.6) + 0.0001, s); }
    rm.icon.position.y = 2.6 + Math.sin(t * 4 + rm.i) * 0.12;
    if (rm.req && mgr.tray > 0 && inRoom(mgr, rm)) deliver(rm, true);
    if (rm.state !== 'dirty' && rm.state !== 'broken') continue;
    const maid = rm.state === 'dirty' && staff.find(s => s.kind === 'maid' && s.room === rm && !s.path.length);
    const byMgr = inRoom(mgr, rm), need = rm.state === 'broken' ? 2.2 : 1;
    if (byMgr || maid) {
      rm.cleanT += sec * (byMgr ? 1.4 : 0.8); if (byMgr) { cleaning = true; mgr.act = 'clean'; mgr.actT = rm.cleanT / need; }
      if (Math.random() < 0.3) burst(scene, V(rm.cx + (Math.random() - 0.5) * 3, 0.5, rm.z + (Math.random() - 0.5) * 2.5), rm.state === 'broken' ? ['#ffd23f', '#ffffff'] : ['#ffffff', '#bde0fe'], 1, { speed: 0.03, up: 0.04, size: 0.5, shape: 'sphere', gravity: 0 });
      if (rm.cleanT >= need) {
        const wasBroken = rm.state === 'broken';
        rm.cleanT = 0; rm.state = 'free'; setRoomLook(rm); if (maid) { maid.room = null; maid.st = 'idle'; }
        sfx.pick(5); buzz(10); burst(scene, V(rm.cx, 1, rm.z), ['#ffffff', '#ffd23f', '#a0e7ff'], 14, { speed: 0.08, up: 0.1, size: 0.6, shape: 'sphere' });
        const v = wasBroken ? 10 : 5;
        if (byMgr) { addBill('carry', V(rm.bed.x, 1, rm.bed.z)); if (wasBroken) addBill('carry', V(rm.bed.x, 1.2, rm.bed.z)); cash += v; updCash(true); ui.pop(wasBroken ? '🔧 FIXED +$10' : '+$5', '#d8ffcf', 26, 42); } else addBill('pile', V(rm.cx, 1, rm.z));
      }
    } else rm.cleanT = Math.max(0, rm.cleanT - sec * 0.5);
  }
  if (!cleaning && mgr.act === 'clean') mgr.act = null;
  // ---- staff behaviour
  for (const s of staff) {
    if (s.kind === 'maid' && s.st === 'idle') { const rm = rooms.find(r => r.open && r.state === 'dirty' && !staff.some(o => o.room === r)); if (rm) sendTo(s, rm); }
    if (s.kind === 'cook' && s.st === 'idle') { const rm = rooms.find(r => r.open && r.req && !staff.some(o => o.room === r)); if (rm) { sendTo(s, rm); s.t = 0; } }
    if (s.kind === 'cook' && s.st === 'go' && !s.path.length) { if (s.room && s.room.req && inRoom(s, s.room)) { deliver(s.room, false); } const rm = s.room; s.st = 'back'; s.room = null; s.path = [{ x: rm.side * (CORR + 0.4), z: rm.z }, { x: 0, z: rm.z }, { x: 0, z: -0.5 }, { x: 0, z: 0.8 }, { x: 3.6, z: 0.8 }, { x: s.home.x, z: s.home.z }]; }
    if (s.kind === 'cook' && s.st === 'back' && !s.path.length) s.st = 'idle';
    walk(s, dt, sec); s.g.position.set(s.x, 0, s.z); if (s.face !== undefined) s.g.rotation.y = lerp(s.g.rotation.y, s.path.length ? s.face : (s.kind === 'recep' ? Math.PI : s.face), 0.2); s.g.run(t + 3, s.path.length ? 1 : 0);
  }
  // ---- cash: pick up the desk pile by walking near it
  if (state === 'play' && near(mgr, PILE, 1.35)) {
    mgr.pickT = (mgr.pickT || 0) - sec;
    if (mgr.pickT <= 0) { const pb = [...billsL].reverse().find(b => b.where === 'pile'); if (pb) { const top = pileTop(pileCount() - 1); pb.where = 'carry'; pb.fx = top.x; pb.fy = top.y; pb.fz = top.z; pb.fly = 0; cash += 5; gainChip(5); updCash(true); { const nw = performance.now(); if (nw - lastFly > 70) { lastFly = nw; flyCoin(mgr.x, 1.4, mgr.z); } } tone(900 + Math.min(20, mgr.carry.length) * 25, 0.04, 'square', 0.04, 1.3); mgr.pickT = 0.045; } }
  }
  // ---- pads: stand on one to pour cash in
  const nextOrd = Math.min(...pads.filter(q => !q.done).map(q => q.ord ?? 0));
  for (const p of pads) {
    if (p.done) continue;
    const lit = (p.ord ?? 0) === nextOrd;
    p.lit = lit;
    const on = lit && state === 'play' && Math.abs(mgr.x - p.x) < 1.15 && Math.abs(mgr.z - p.z) < 1.15;
    p.g.scale.setScalar(lerp(p.g.scale.x, on ? 1.08 : lit ? 1 : 0.8, 0.2));
    if (on && cash > 0) {
      p.feedT -= sec;
      if (p.feedT <= 0) {
        const cb = [...billsL].reverse().find(b => b.where === 'carry');
        if (cb) { cb.where = 'pad'; cb.pad = p; cb.fx = cb.x; cb.fy = cb.y; cb.fz = cb.z; cb.fly = 0; }
        cash -= 5; p.paid += 5; updCash(); setLabel(p); tone(600 + p.paid / p.cost * 500, 0.04, 'triangle', 0.06, 1.1); p.feedT = 0.04;
        if (p.paid >= p.cost) unlock(p);
      }
    }
    const k = p.paid / p.cost; p.fill.scale.z = Math.max(0.001, k); p.fill.position.z = 1.05 * (1 - k);
  }
  // ---- bills render
  let n = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);
  let pi = 0, ci = 0;
  const back = V(-Math.sin(mgr.g.rotation.y), 0, -Math.cos(mgr.g.rotation.y));
  const billBack = hero?.hero.items.back ? 0.85 : 0.55;   // clear a hero's backpack/wings
  for (const b of billsL) {
    let tx, ty, tz, rot = 0;
    if (b.where === 'pile') { const p = pileTop(pi++); tx = p.x; ty = p.y; tz = p.z; rot = p.r; }
    else if (b.where === 'carry') { const lag = ci * 0.012; tx = mgr.x + back.x * billBack - mgr.vx * lag; ty = 1.25 + ci * 0.085; tz = mgr.z + back.z * billBack - mgr.vz * lag; rot = mgr.g.rotation.y; ci++; }
    else { tx = b.pad.x; ty = 0.3; tz = b.pad.z; }
    if (b.fly !== undefined && b.fly < 1) { b.fly = Math.min(1, b.fly + sec * 4.5); const k = b.fly; b.x = lerp(b.fx, tx, k); b.z = lerp(b.fz, tz, k); b.y = lerp(b.fy, ty, k) + Math.sin(k * Math.PI) * 1.4; if (b.fly >= 1 && b.where === 'pad') b.dead = true; }
    else { b.x = tx; b.y = ty; b.z = tz; }
    if (b.dead) continue;
    e.set(0, rot + (b.fly < 1 ? b.fly * 6 : 0), 0); q.setFromEuler(e); m4.compose(V(b.x, b.y, b.z), q, one); if (n < MAXB) bills.setMatrixAt(n++, m4);
  }
  billsL = billsL.filter(b => !b.dead);
  mgr.carry.length = ci;
  bills.count = n; bills.instanceMatrix.needsUpdate = true;
  // ---- action ring under the manager
  const showRing = mgr.act && state === 'play';
  ring.visible = ringBg.visible = !!showRing;
  if (showRing) { ring.geometry = RINGS[clamp(Math.round(mgr.actT * 24), 0, 24)]; ring.position.set(mgr.x, 0.06, mgr.z); ringBg.position.set(mgr.x, 0.055, mgr.z); }
  // ---- camera follows (tilted top-down)
  { const tz = clamp(mgr.z, topZ + 5.5, 6), dz = clamp(camZ, tz - 2.4, tz + 2.4); camZ = lerp(camZ, dz, 0.06 * dt); const tx = clamp(mgr.x * 0.3, -1.2, 1.2); camX = lerp(camX, clamp(camX, tx - 0.5, tx + 0.5), 0.04 * dt); } // dead zone: the view holds still while you tap, so the next target stays under the finger
  shake = Math.max(0, shake - sec * 2.2); const sh = shake * shake * 0.35;
  camera.position.set(camX + (Math.random() - 0.5) * sh, 19.5 + (Math.random() - 0.5) * sh, camZ + 10); camera.lookAt(camX, 0, camZ - 2.6);
  stage.followLight(V(camX, 0, camZ));
  for (const p of pads) p.g.children[2].material.opacity = p.lit === false ? 0.3 : 0.9 + Math.sin(t * 5) * 0.1;
  updHud(sec);
}
function pileTop(i) { const col = i % 4, lay = Math.floor(i / 4); return { x: PILE.x + (col % 2 - 0.5) * 0.36, y: 0.1 + lay * 0.085, z: PILE.z + (Math.floor(col / 2) - 0.5) * 0.4, r: 0 }; }
function unlock(p) {
  p.done = true; p.g.visible = false; sfx.win(); buzz([20, 30, 20]); ui.flash(0.4); shake = 0.7;
  confetti(scene, V(p.x, 1.5, p.z), 50);
  if (p.kind === 'room' || p.kind === 'suite') { const rm = p.room; rm.open = true; rm.floor.material.map = rm.wood; rm.floor.material.needsUpdate = true; rm.g = roomMesh(rm); world.add(rm.g); walls.push(...rm.walls); rm.pop = 1; setRoomLook(rm); ui.pop(rm.suite ? '👑 NEW SUITE!' : 'NEW ROOM!', rm.suite ? '#ffe27a' : '#fff', 40, 30); }
  else if (p.kind === 'recep') { hireStaff('recep'); ui.pop('RECEPTIONIST HIRED!', '#fff', 32, 30); }
  else if (p.kind === 'maid') { hireStaff('maid'); ui.pop('HOUSEKEEPER HIRED!', '#fff', 32, 30); }
  else if (p.kind === 'cook') { hireStaff('cook'); ui.pop('🍳 COOK HIRED!', '#fff', 32, 30); }
  else if (p.kind === 'kitchen') { buildKitchen(); ui.pop('🍽️ KITCHEN OPEN!', '#fff3c4', 34, 30); }
  else if (p.kind === 'speed') { mgr.speed = 7; ui.pop('SPEED UP!', '#fff', 40, 30); }
  // push the manager off walls that just appeared
  collide(mgr);
  updGoal();
  if (pads.every(x => x.done) && state === 'play') win();
}
function buildKitchen() {
  const parts = [[rbox(2.0, 0.9, 0.8, 0.12), M(KITCH.x, 0.45, KITCH.z - 1.1), '#e8e2d6'], [rbox(2.1, 0.1, 0.9, 0.05), M(KITCH.x, 0.95, KITCH.z - 1.1), '#ffffff'], [new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(KITCH.x - 0.5, 1.0, KITCH.z - 1.1), '#d9dde8'], [new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(KITCH.x + 0.5, 1.0, KITCH.z - 1.1), '#d9dde8']];
  const m = new THREE.Mesh(merge(parts), vmat()); m.castShadow = true; world.add(m);
  walls.push({ x0: KITCH.x - 1.0, x1: KITCH.x + 1.0, z0: KITCH.z - 1.5, z1: KITCH.z - 0.7 });
  const spr = sprite(ICONS.tray, 1.1); spr.visible = false; spr.position.set(KITCH.x, 2.6, KITCH.z - 1.1); world.add(spr);
  kitchen = { spr };
}
function coachBanner() { ui.pop('🚌 TOUR COACH!', '#fff3c4', 38, 28); tone(220, 0.25, 'sawtooth', 0.09, 1.2); setTimeout(() => tone(330, 0.3, 'sawtooth', 0.09, 1.1), 180); shake = 0.45; buzz([30, 40, 30]); }
function checkIn(gu, room) {
  const pat = patOf(gu), happy = gu.wait < pat * 0.5, fast = gu.wait < pat * 0.4;
  gu.hop = 1; room.state = 'booked'; room.guest = gu; gu.room = room; gu.st = 'toroom'; gu.icon.visible = false; gu.t = 0; served++;
  gu.path = [{ x: 2.4, z: DESK.z + 1.05 }, { x: 2.4, z: 0.7 }, ...roomRoute(room)];
  streak = happy ? streak + 1 : 0; bestStreak = Math.max(bestStreak, streak); updStreak();
  let nb = L.bills * KIND[gu.kind].pay; const fastBonus = gu.kind === 'r' && fast; if (fastBonus) nb *= 2; if (gu.gold) nb *= 6;
  const fever = streak >= 5; if (fever) nb *= 2;
  const tip = happy ? Math.min(5, Math.floor(streak / 2)) : 0; nb += tip; tips += tip * 5;
  const gap = nb > 12 ? 0.045 : 0.09;
  for (let k = 0; k < nb; k++) later(k * gap, () => addBill('pile', V(gu.x, 1.2, gu.z)));
  sfx.coin(); buzz(8); tone(880 + Math.min(streak, 10) * 55, 0.06, 'triangle', 0.08, 1.2);
  if (gu.gold) { ui.pop('🌟 GOLDEN GUEST +$' + nb * 5, '#ffe45e', 36, 33); confetti(scene, V(gu.x, 1.5, gu.z), 60); shake = 0.5; buzz([20, 30, 20, 30, 40]); for (let q = 0; q < 5; q++) setTimeout(() => tone(660 + q * 150, 0.1, 'triangle', 0.08, 1.2), q * 70); }
  else if (fastBonus) ui.pop('⚡ FAST x2', '#fff3a0', 34, 33);
  else if (gu.kind === 'v') ui.pop('👑 VIP +$' + nb * 5, '#ffe27a', 34, 33);
  else if (gu.kind === 'c') ui.pop('🧐 HAPPY CRITIC +$' + nb * 5, '#e8eaff', 30, 33);
  else if (streak >= 2) { const W = ['NICE', 'GREAT', 'SUPER', 'AMAZING', 'INCREDIBLE', 'LEGENDARY']; const w = W[Math.min(W.length - 1, Math.floor((streak - 2) / 2))]; ui.pop(`🔥 ${w} x${streak}`, streak >= 8 ? '#ff7a59' : '#ffb36b', Math.min(46, 28 + streak * 2), 33); for (let q = 0; q < Math.min(4, 1 + (streak >> 2)); q++) setTimeout(() => tone(700 + streak * 40 + q * 120, 0.07, 'triangle', 0.07, 1.2), q * 60); }
  if (streak === 5) { shake = 0.3; ui.flash(0.25); ui.pop('🔥 FEVER! DOUBLE CASH', '#ffcf5a', 40, 28); for (let q = 0; q < 4; q++) setTimeout(() => tone(500 + q * 160, 0.1, 'sawtooth', 0.07, 1.2), q * 70); }
  else if (streak >= 5 && streak % 5 === 0) { shake = 0.3; ui.flash(0.25); }
  if (gu.kind !== 't') { gu.mark.material.map = ICONS.love; }
}
function deliver(rm, byMgr) {
  const gu = rm.guest; rm.req = false; if (byMgr) mgr.tray = Math.max(0, mgr.tray - 1); if (!gu) return;
  gu.req = false; gu.icon.material.map = ICONS.love; gu.icon.scale.setScalar(1); later(1.0, () => { if (gu.st === 'sleep') gu.icon.material.map = ICONS.sleep; });
  const nb = 3 + (gu.kind === 'v' ? 3 : 0); tips += nb * 5; for (let k = 0; k < nb; k++) later(k * 0.08, () => addBill('pile', V(rm.cx, 1.2, rm.z)));
  ui.pop(`🍽️ TIP +$${nb * 5}`, '#fff3c4', 30, 38); sfx.coin(); buzz(12); tone(1320, 0.1, 'triangle', 0.08, 1.2);
}

// ------------------------------------------------------------------ stars, win / lose cards, map, uniforms
const css = document.createElement('style');
css.textContent = `
.bb-hint{position:fixed;display:none;z-index:6;pointer-events:none;font-size:34px;line-height:1;color:#ffe45e;text-shadow:0 3px 0 #b8741a,0 0 12px rgba(0,0,0,.35)}
.bb-card{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;font-family:'Baloo 2',system-ui,'Apple Symbols','Segoe UI Symbol',sans-serif;font-weight:800;background:rgba(40,20,60,.42);padding:20px;box-sizing:border-box;animation:bbfade .3s both}
@keyframes bbfade{from{opacity:0}to{opacity:1}}
.bb-card h1{margin:2px 0;font-size:54px;line-height:1;text-shadow:0 5px 0 #d0436f,0 10px 22px rgba(120,20,60,.25)}
.bb-card .sm{font-size:15px;opacity:.9;letter-spacing:1px}
.bb-stars{font-size:62px;letter-spacing:8px;margin:2px 0;color:rgba(255,255,255,.35)}
.bb-stars b{color:#ffd23f;text-shadow:0 4px 0 #c08a00;display:inline-block;animation:bbpop .45s both}
@keyframes bbpop{0%{transform:scale(0) rotate(-40deg)}70%{transform:scale(1.4)}100%{transform:scale(1)}}
.bb-line{font-size:17px;margin:2px 0;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.bb-line.no{opacity:.65}
.bb-bar{width:240px;height:16px;border-radius:9px;background:rgba(0,0,0,.25);margin:10px auto 2px;overflow:hidden;position:relative}
.bb-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffd23f,#ff8c42);border-radius:9px;transition:width 1s ease-out}
.bb-btn{pointer-events:auto;margin-top:14px;font:inherit;font-weight:800;font-size:26px;color:#fff;background:linear-gradient(#ff6fa0,#e8447c);border:0;border-radius:30px;padding:8px 34px 6px;box-shadow:0 6px 0 #a82a58;cursor:pointer;animation:hcpulse 1.1s ease-in-out infinite}
.bb-btn2{pointer-events:auto;margin:12px 5px 0;font:inherit;font-weight:800;font-size:16px;color:#fff;background:rgba(0,0,0,.28);border:0;border-radius:20px;padding:6px 16px;cursor:pointer}
.bb-new{margin-top:8px;font-size:26px;box-shadow:0 0 28px 6px rgba(255,220,80,.8);background:rgba(255,255,255,.18);border-radius:16px;padding:4px 16px;animation:bbpop .5s 1.2s both}
.bb-streak{position:fixed;left:12px;top:calc(60px + env(safe-area-inset-top));font-size:20px;z-index:5;pointer-events:none;color:#fff;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.3);transition:transform .12s}
.bb-time{position:fixed;left:50%;transform:translateX(-50%);top:calc(126px + env(safe-area-inset-top));font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:13px;color:#fff;background:rgba(30,40,70,.35);border-radius:10px;padding:0 10px;pointer-events:none;z-index:5;white-space:nowrap}
.bb-time.late{color:#ffd0a0}
.bb-hard{background:#ff3b4e;border-radius:6px;padding:0 6px;margin-right:6px;font-size:12px}
.bb-toast{position:fixed;left:8%;right:8%;top:calc(11% + env(safe-area-inset-top));z-index:9;pointer-events:none;text-align:center;color:#fff;font-family:'Baloo 2',system-ui,sans-serif;font-weight:800;font-size:22px;line-height:1.15;text-shadow:0 3px 0 rgba(0,0,0,.35);background:rgba(30,40,70,.45);border-radius:18px;padding:8px 14px;animation:bbfade .3s both;transition:opacity .5s}
.bb-toast small{display:block;font-size:14px;opacity:.9;margin-top:2px}
.bb-mapbtn{position:fixed;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:7;width:54px;height:54px;border-radius:50%;border:0;background:rgba(30,40,70,.45);font-size:26px;color:#fff;cursor:pointer;pointer-events:auto}
.bb-map{position:fixed;inset:0;z-index:20;background:linear-gradient(#3a2a6e,#143a52);color:#fff;font-family:"Baloo 2",system-ui,sans-serif;font-weight:800;overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 30px;box-sizing:border-box}
.bb-map h2{margin:14px 0 4px;font-size:22px}
.bb-map .row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:8px 0}
.bb-node{position:relative;aspect-ratio:1;border-radius:18px;border:0;font:inherit;font-weight:800;font-size:20px;color:#fff;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.bb-node small{position:absolute;bottom:2px;left:0;right:0;font-size:11px;color:#ffd23f;letter-spacing:1px}
.bb-node.lock{opacity:.35;cursor:default}
.bb-node.hard{outline:3px solid #ff3b4e}
.bb-node.next{animation:hcpulse 1.2s ease-in-out infinite;outline:3px solid #fff}
.bb-top{padding-left:64px;display:flex;justify-content:space-between;align-items:center;font-size:18px}
.bb-x{font:inherit;font-weight:800;font-size:22px;border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:44px;height:44px;cursor:pointer}
.bb-suits{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:8px 0}
.bb-suit{border:0;border-radius:16px;padding:8px 4px;font:inherit;font-size:12px;font-weight:800;color:#fff;background:rgba(255,255,255,.1);cursor:pointer}
.bb-suit i{display:block;width:34px;height:44px;margin:0 auto 4px;border-radius:17px 17px 12px 12px;position:relative}
.bb-suit i:after{content:'';position:absolute;left:6px;right:6px;top:-6px;height:12px;border-radius:5px;background:var(--h)}
.bb-suit.on{outline:3px solid #ffd23f}
.bb-suit.lock i{background:#555!important}
.bb-suit.lock i:after{background:#444}
.bb-small{font-size:14px;opacity:.9;font-weight:600}
`;
document.head.appendChild(css);
const elOf = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const feverEl = elOf('<div style="position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .4s;box-shadow:inset 0 0 90px 20px rgba(255,140,40,.55)"></div>'); document.body.appendChild(feverEl);
const streakEl = document.createElement('div'); streakEl.className = 'bb-streak'; document.body.appendChild(streakEl);
const timeEl = document.createElement('div'); timeEl.className = 'bb-time'; document.body.appendChild(timeEl);
const mapBtn = elOf('<button class="bb-mapbtn" aria-label="Hotels">🗺️</button>'); document.body.appendChild(mapBtn);
mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); openMap(); });
let toastEl = null, toastT = 0, hudT = 0;
function hideToast() { if (toastEl) { toastEl.remove(); toastEl = null; } }
function toast(h, ms = 3600) { hideToast(); toastEl = elOf(`<div class="bb-toast">${h}</div>`); document.body.appendChild(toastEl); const me = toastEl; setTimeout(() => { if (toastEl === me) { me.style.opacity = 0; setTimeout(() => { if (toastEl === me) hideToast(); }, 500); } }, ms); }
function updStreak() { streakEl.textContent = streak >= 5 ? `🔥 FEVER x${streak} · $$ x2` : streak >= 2 ? `🔥 x${streak}` : ''; feverEl.style.opacity = streak >= 5 ? 1 : 0; streakEl.style.transform = 'scale(1.25)'; setTimeout(() => streakEl.style.transform = '', 120); }
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function updHud(sec) {
  hudT -= sec; if (hudT > 0) return; hudT = 0.25;
  const late = levelT > L.par; timeEl.textContent = `⏱ ${fmt(levelT)} · ⭐⭐⭐ ${fmt(L.par)}`; timeEl.classList.toggle('late', late);
}
const NEWS = { 2: '🧹 Stand in a messy room to clean it', 3: 'Guests can walk out now: keep the desk covered', 4: '⚡ RUSHERS pay double if you check them in fast', 6: '🍽️ ROOM SERVICE: grab a tray at the kitchen, walk it into the room', 8: '🚌 TOUR COACHES drop a crowd at once', 11: '👑 VIPs need a free Suite and pay 4x', 15: '🔧 Rooms can break: stand in them to repair', 21: '🧐 CRITICS pay 3x, but a walkout is 2 bad reviews' };
function announce() {
  const n = level, w = worldOf(n), pos = ((n - 1) % 10) + 1;
  const head = L.bonus ? L.name : `${w + 1}-${pos} · ${L.name}`;
  toast(`${L.hard ? '<span class="bb-hard">HARD</span>' : ''}${head}${NEWS[n] ? `<small>${NEWS[n]}</small>` : L.hard ? '<small>thin patience, big payout</small>' : ''}`, NEWS[n] ? 4200 : 2400);
}
function starsFor() { if (walkouts > 1 && !L.safe) return 1; if (walkouts > 0 && !L.safe) return 2; return levelT <= L.par ? 3 : 2; }
const stars3 = (n, anim) => `<div class="bb-stars">${[0, 1, 2].map(i => i < n ? `<b style="animation-delay:${anim ? 0.35 + i * 0.35 : 0}s">⭐</b>` : '⭐').join('')}</div>`;
let cardEl = null;
function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; } }
function showCard(h, onMain) {
  closeCard(); cardEl = elOf(`<div class="bb-card">${h}</div>`); document.body.appendChild(cardEl);
  cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b && b.dataset.map !== undefined) return openMap(); if (b && b.dataset.again !== undefined) return goLevel(level); if (!b || b.dataset.main !== undefined) onMain(); });
}
function win() {
  state = 'won'; F.level(true);
  const st = starsFor(), old = SAVE.stars[level] || 0, gained = Math.max(0, st - old);
  if (!old) { WB.submit(1); }
  SAVE.stars[level] = Math.max(old, st); SAVE.unlocked = Math.max(SAVE.unlocked, level + 1); SAVE.chest += gained;
  let gift = -1; if (SAVE.chest >= CHEST) { SAVE.chest -= CHEST; const pool = SUITS.map((_, i) => i).filter(i => !SAVE.suits.includes(i)); if (pool.length) { gift = pool[Math.floor(Math.random() * pool.length)]; SAVE.suits.push(gift); SAVE.suit = gift; } }
  save();
  const worldDone = level % 10 === 0 && level <= 30 && !old;
  setTimeout(() => { for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, V(camX, 2, camZ), 45), i * 160); }, 200);
  const l2 = L.safe || walkouts === 0 ? `<div class="bb-line">⭐⭐ no walkouts ✓</div>` : walkouts === 1 ? `<div class="bb-line">⭐⭐ one walkout is fine ✓</div>` : `<div class="bb-line no">⭐⭐ needs 1 walkout or fewer</div>`;
  const ok3 = st === 3, l3 = `<div class="bb-line${ok3 ? '' : ' no'}">⭐⭐⭐ under ${fmt(L.par)} ${ok3 ? '✓ ' + fmt(levelT) : (walkouts ? '(no walkouts too)' : '· you ' + fmt(levelT) + ' · ' + Math.ceil(levelT - L.par) + ' s over')}</div>`;
  const bar = `<div class="bb-bar"><i style="width:${Math.min(1, (SAVE.chest - gained + (gift >= 0 ? CHEST : 0)) / CHEST) * 100}%"></i></div><div class="bb-small">🎁 uniform chest: ${gift >= 0 ? 'OPEN!' : SAVE.chest + '/' + CHEST + ' ⭐'}</div>`;
  const nextName = levelOf(level + 1).name;
  setTimeout(() => {
    showCard(`<div class="sm">${L.bonus ? 'BONUS' : 'HOTEL ' + level} · ${L.name.toUpperCase()}</div><h1>${worldDone ? WORLDS[worldOf(level)].name.toUpperCase() + ' DONE!' : 'CLEARED!'}</h1>${stars3(st, true)}${st < 3 ? (st < 2 ? l2 : l3) : ''}${bar}<div class="bb-small">${level % 10 === 0 ? 'NEW WORLD NEXT!' : ''}</div>${gift >= 0 ? `<div class="bb-new">🎁 NEW UNIFORM: ${SUITS[gift].n}</div>` : ''}<button class="bb-btn" data-main>${nextName.toUpperCase()} ▶</button><div><button class="bb-btn2" data-again>↻ Replay for ⭐</button><button class="bb-btn2" data-map>🗺️ Map</button></div>`, () => goLevel(level + 1));
    if (gift >= 0) { sfx.win(); for (let i = 0; i < 5; i++) setTimeout(() => { confetti(scene, V(camX, 2, camZ), 60); tone(520 + i * 140, 0.16, 'triangle', 0.14, 1.2); buzz(25); }, 1200 + i * 150); }
    const fill = cardEl && cardEl.querySelector('.bb-bar i'); if (fill) setTimeout(() => fill.style.width = (gift >= 0 ? 100 : SAVE.chest / CHEST * 100) + '%', 700);
    for (let i = 0; i < st; i++) setTimeout(() => { tone(660 + i * 180, 0.14, 'triangle', 0.12, 1.1); buzz(15); }, 350 + i * 350);
  }, 750);
}
function lose() {
  const open = pads.filter(p => !p.done), nxt = open.sort((a, b) => (a.cost - a.paid) - (b.cost - b.paid))[0], done = pads.length - open.length;
  const near = !nxt ? '' : nxt.cost - nxt.paid <= 25 ? `So close: $${nxt.cost - nxt.paid} from ${nxt.title}!` : `${done}/${pads.length} upgrades done`;
  setTimeout(() => showCard(`<div class="sm">HOTEL ${level} · ${L.name.toUpperCase()}</div><h1>BAD REVIEWS!</h1><div class="bb-line">${near}</div><div class="bb-small">Tip: serve the desk first, then cash</div><button class="bb-btn" data-main>↻ TRY AGAIN</button><div><button class="bb-btn2" data-map>🗺️ Map</button></div>`, () => goLevel(level)), 600);
}
function dailyGift() {
  const d = new Date().toISOString().slice(0, 10); if (SAVE.day === d) return;
  const first = !SAVE.day; SAVE.day = d; SAVE.chest += 1; save();
  if (!first) setTimeout(() => toast(`🎁 Daily gift: +1⭐ in your uniform chest (${SAVE.chest}/${CHEST})`, 4200), 1200);
}
function goLevel(lv) {
  dailyGift();
  closeMap(true); closeCard(); level = lv; L = levelOf(level); ui.hideStart(); WB.start();
  buildLevel(); state = 'play';
}
let mapEl = null, prevState = null;
function openMap() {
  if (mapEl) return; prevState = state; if (state === 'play') state = 'paused';
  const node = lv => {
    const st = SAVE.stars[lv] || 0, lock = lv > SAVE.unlocked, spec = LEVELS[lv - 1], col = ['#2fa8ff', '#6a8fb0', '#8a5cff'][worldOf(lv)];
    return `<button class="bb-node${lock ? ' lock' : ''}${spec && spec.hard ? ' hard' : ''}${lv === SAVE.unlocked ? ' next' : ''}" data-lv="${lv}" style="background:${lock ? '#556' : col}">${lock ? '🔒' : lv}<small>${lock ? '' : '⭐'.repeat(st) + '<span style="opacity:.3">' + '⭐'.repeat(3 - st) + '</span>'}</small></button>`;
  };
  let h = `<div class="bb-top"><span>⭐ ${totalStars()} / ${LEVELS.length * 3}</span><span>🎁 ${SAVE.chest}/${CHEST}</span><button class="bb-x" data-close>✕</button></div>`;
  WORLDS.forEach((W, wi) => {
    const lv0 = wi * 10 + 1, st = Array.from({ length: 10 }, (_, k) => SAVE.stars[lv0 + k] || 0).reduce((a, b) => a + b, 0);
    h += `<h2>${W.icon} ${W.name} <span class="bb-small">⭐ ${st}/30</span></h2>`;
    for (let r = 0; r < 2; r++) h += `<div class="row">${Array.from({ length: 5 }, (_, k) => node(lv0 + r * 5 + k)).join('')}</div>`;
  });
  if (SAVE.unlocked > LEVELS.length) h += `<h2>🏨 Bonus hotels</h2><div class="row">${node(SAVE.unlocked)}</div>`;
  h += `<h2>Uniforms <span class="bb-small">${SAVE.suits.length}/${SUITS.length} · every ${CHEST} ⭐ opens a chest</span></h2><div class="bb-suits">`;
  SUITS.forEach((s, i) => { const own = SAVE.suits.includes(i); h += `<button class="bb-suit${own ? '' : ' lock'}${SAVE.suit === i ? ' on' : ''}" style="--h:${s.h}" data-suit="${i}"><i style="background:${s.c}"></i>${own ? s.n : '?'}</button>`; });
  h += '</div>';
  mapEl = elOf(`<div class="bb-map">${h}</div>`); document.body.appendChild(mapEl);
  mapEl.addEventListener('pointerdown', e => e.stopPropagation());
  mapEl.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close !== undefined) return closeMap();
    if (t.dataset.lv) { const lv = +t.dataset.lv; if (lv > SAVE.unlocked) return; goLevel(lv); }
    if (t.dataset.suit) { const i = +t.dataset.suit; if (!SAVE.suits.includes(i)) return; SAVE.suit = i; save(); wearSuit(); closeMap(); openMap(); }
  });
}
function closeMap(leaving) { if (!mapEl) return; mapEl.remove(); mapEl = null; if (!leaving && prevState === 'play') state = 'play'; else if (!leaving) state = prevState; }
function wearSuit() {
  const c = SUITS[SAVE.suit]; const pos = mgr.g.position.clone(), ry = mgr.g.rotation.y;
  scene.remove(mgr.g); mgr.g = person(c.c, '#ffd7ba', true, c.h); mgr.g.position.copy(pos); mgr.g.rotation.y = ry; scene.add(mgr.g); dressMgr();
}

buildLevel();
ui.start();
{ // hero bar at the foot of the start card, so the picked hero stays in view (taps on it never start the game)
  const slot = document.createElement('div'); slot.style.cssText = 'width:min(360px,100%)'; ui.els.start.appendChild(slot);
  heroBar({ parent: slot, onPick: syncHero }); onHeroesChange(syncHero); syncHero();
}

// ------------------------------------------------------------------ test hooks + bot (greedy: desk → cash → clean → buy)
function routeTo(o, target) {
  if (kitchen && o.x > 2.7 && o.z > 0.6 && o.z < 3.4 && target.x < 2.6) return { x: 2.0, z: Math.max(o.z, 2.2) };   // step round the kitchen counter
  const inR = rooms.find(r => r.open && inRoom(o, r)), tR = rooms.find(r => inRoom(target, r));
  if (inR && inR !== tR) { const din = { x: inR.side * (CORR + 0.5), z: inR.z }; return Math.hypot(o.x - din.x, o.z - din.z) > 0.35 ? din : { x: 0, z: inR.z }; }
  if (target.z < -0.1 && o.z > -0.1) { if (Math.abs(o.x) > 0.6 || o.z > 1.2) { if (o.z < DESK.z - DESK.hd - 0.3 || Math.abs(o.x) > DESK.hw + 0.4) return { x: Math.abs(o.x) > 0.6 && o.z > DESK.z - DESK.hd - 0.3 ? o.x : 0, z: Math.min(o.z, 0.8) - (o.z > DESK.z - DESK.hd - 0.3 ? 0 : 0) } ; return { x: o.x > 0 ? DESK.hw + 0.7 : -DESK.hw - 0.7, z: o.z }; } return { x: 0, z: -0.6 }; }
  if (target.z > -0.1 && o.z < -0.1) { if (Math.abs(o.x) > 0.6) return { x: 0, z: o.z }; return { x: 0, z: 0.8 }; }
  if (tR && !inR) { if (Math.abs(o.z - tR.z) > 0.35 && Math.abs(o.x) > 0.3) return { x: 0, z: o.z }; if (Math.abs(o.z - tR.z) > 0.35) return { x: 0, z: tR.z }; return target; }
  // lobby: go around the desk
  const blockZ = (o.z - DESK.z) * (target.z - DESK.z) < 0 || (Math.abs(o.z - DESK.z) < DESK.hd + 0.4);
  if (blockZ && Math.abs(o.x) < DESK.hw + 0.5 && Math.abs(target.x) < DESK.hw + 0.4 && Math.abs(o.z - target.z) > 0.6) { const sx = (o.x || 1) > 0 ? DESK.hw + 0.8 : -DESK.hw - 0.8; return Math.abs(o.x - sx) > 0.3 ? { x: sx, z: o.z } : { x: sx, z: target.z }; }
  if (Math.abs(o.x) > DESK.hw + 0.5 && Math.abs(target.x) < DESK.hw && (o.z - DESK.z) * (target.z - DESK.z) < 0 && Math.abs(o.z - target.z) > 0.4) return { x: o.x, z: target.z };
  return target;
}
function pickTarget() {
  const open = pads.filter(p => !p.done).sort((a, b) => a.ord - b.ord);
  const nextPad = open[0], need = nextPad ? nextPad.cost - nextPad.paid : 0;
  const front = guests.find(g => g.st === 'desk'), recep = staff.some(s => s.kind === 'recep'), cook = staff.some(s => s.kind === 'cook');
  const dirty = rooms.find(r => r.open && (r.state === 'dirty' ? !staff.some(s => s.room === r) : r.state === 'broken'));
  const req = rooms.find(r => r.req && !staff.some(s => s.room === r)), canServe = front && freeRoom(front);
  let target;
  if (mgr.tray > 0 && req) target = { x: req.cx, z: req.z };
  else if (nextPad && cash >= need) target = nextPad;
  else if (req && kitchen && rooms.filter(r => r.req).length > mgr.tray && mgr.tray < 2 && !cook) target = { x: KITCH.x, z: KITCH.z };
  else if (canServe && !recep && (front.wait || 0) > patOf(front) * 0.2) target = { x: SERVE.x, z: SERVE.z };
  else if (dirty && (front || pileCount() * 5 + cash < need || rooms.every(r => !r.open || r.state !== 'free'))) target = { x: dirty.cx, z: dirty.z };
  else if (pileCount() > 0 && (pileCount() * 5 + cash >= need || !front || recep)) target = { x: PILE.x + 0.3, z: PILE.z };
  else if (canServe && !recep) target = { x: SERVE.x, z: SERVE.z };
  else if (dirty) target = { x: dirty.cx, z: dirty.z };
  else if (nextPad && cash > 0) target = nextPad;
  else target = { x: SERVE.x, z: SERVE.z };
  if (canServe && !recep && (front.wait || 0) > patOf(front) * 0.3 && !(nextPad && cash >= need) && !mgr.tray) target = { x: SERVE.x, z: SERVE.z };
  return target;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return served; },
  get stars() { return starsFor(); }, get time() { return levelT; }, get par() { return L.par; }, get walkouts() { return walkouts; }, get cash() { return cash; }, get dump() { return { rooms: rooms.map(r => r.open ? r.state + (r.req ? '+req' : '') : '-').join(','), q: guests.filter(g => g.st === 'queue' || g.st === 'desk').map(g => g.kind + ':' + (g.wait || 0).toFixed(0) + '/' + patOf(g).toFixed(0)).join(' '), angry }; },
  get pads() { return pads.filter(p => p.done).length + '/' + pads.length; }, get save() { return SAVE; },
  fast(k) { simK = k; }, auto(on) { botOn = on; }, go(n) { SAVE.unlocked = Math.max(SAVE.unlocked, n); goLevel(n); }, openMap, closeMap,
  bot() {
    if (state !== 'play') return;
    const target = pickTarget();
    const wp = routeTo(mgr, target), dx = wp.x - mgr.x, dz = wp.z - mgr.z, d = Math.hypot(dx, dz);
    botDir = d < 0.15 ? { x: 0, z: 0 } : { x: dx / d * Math.min(1, d * 1.5), z: dz / d * Math.min(1, d * 1.5) };
    botUntil = performance.now() + 250;
  },
};

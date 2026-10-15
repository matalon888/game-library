// Bellhop Boss — original idle hotel tycoon. Drag to walk your bellhop: check guests in at the desk, clean rooms,
// scoop up the cash stacks and pour them into upgrade pads (new rooms, a receptionist, a housekeeper).
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng, rounded, stickman, palette, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';

const S = store('bellhopboss');
const F = flow('bellhopboss');
let fk = 1;
let level = S.get('level', 1);
const stage = createStage({ fov: 46, shadowSize: 22 });
const { scene, camera, sun, hemi } = stage;
const ui = createUI({ title: 'BELLHOP<br>BOSS', hint: 'Drag to walk', hand: '👆', score: false });
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
const ICONS = { clean: bubbleTex('🧹'), sleep: bubbleTex('💤', '#d9e8ff'), bell: bubbleTex('🛎️', '#fff3c4'), bed: bubbleTex('🛏️', '#ffd9e1'), angry: bubbleTex('😠', '#ffc9c9') };
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
    [new THREE.CylinderGeometry(1.1, 1.1, 0.03, 28), M(s * (CORR + 1.6), 0.02, zc, 0, 0, 0, 1, 1, 0.8), theme.carpet],
    [new THREE.CylinderGeometry(0.28, 0.22, 0.45, 10), M(s * (CORR + 0.55), 0.22, zc - 1.75), '#d98c5f'], [new THREE.IcosahedronGeometry(0.42, 1), M(s * (CORR + 0.55), 0.75, zc - 1.75), '#4caf50']);
  const g = new THREE.Group(), m = new THREE.Mesh(merge(parts), vmat()); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const blanket = new THREE.Mesh(rbox(1.85, 0.12, 1.86, 0.06), new THREE.MeshStandardMaterial({ color: theme.bed, roughness: 0.6 })); blanket.position.set(bx - s * 0.25, 0.75, zc); blanket.castShadow = true; g.add(blanket);
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
  theme = THEMES[(level - 1) % THEMES.length]; const pal = palette(level); applyPalette(pal); outside.material.color.set(theme.out); outside.material.map = GRASS;
  const nRooms = Math.min(8, 1 + level), rowsN = Math.ceil(nRooms / 2); topZ = rowZ(rowsN - 1) - ROOM_D / 2;
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
  // back garden: pool, loungers, palms
  sp.push([rbox(8, 0.3, 4.2, 0.6), M(0, 0.05, topZ - 3.6), '#f3e9dc'], [rbox(6.6, 0.32, 2.9, 0.5), M(0, 0.07, topZ - 3.6), '#4fc3f7'], [rbox(5.6, 0.33, 1.9, 0.4), M(0, 0.075, topZ - 3.6), '#81d4fa']);
  for (const sd of [-1, 1]) sp.push([rbox(0.9, 0.25, 2, 0.1), M(sd * 5.2, 0.25, topZ - 3.4), '#ffffff'], [rbox(0.9, 0.5, 0.5, 0.1), M(sd * 5.2, 0.45, topZ - 4.2, 0.5, 0, 0), '#ffffff'], [new THREE.ConeGeometry(0.9, 0.4, 12), M(sd * 5.2, 2.2, topZ - 2.9), sd > 0 ? '#ff8fab' : '#ffd166'], [new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), M(sd * 5.2, 1.05, topZ - 2.9), '#ffffff']);
  for (let i = 0; i < 9; i++) { const x = -8 + i * 2; sp.push([new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), M(x, 0.7, topZ - 7 - (i % 2)), '#8d6e63'], [new THREE.IcosahedronGeometry(1.3, 1), M(x, 2.3, topZ - 7 - (i % 2)), i % 2 ? '#43a047' : '#5cb85c']); }
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
    const rm = { i, side, z, cx, open: i === 0, state: 'free', guest: null, cleanT: 0, floor: fl, wood: woodT, icon: sprite(ICONS.clean), pop: 0 };
    rm.icon.position.set(cx, 2.6, z); rm.icon.visible = false; world.add(rm.icon);
    rooms.push(rm);
    if (i === 0) { rm.g = roomMesh(rm); world.add(rm.g); walls.push(...rm.walls); setRoomLook(rm); }
    else makePad('room', cx, z, Math.round((8 + i * 8) * (1 + (level - 1) * 0.3) / 5) * 5, 'ROOM ' + (i + 1), '🛏️', { room: rm });
  }
  makePad('recep', -4.4, 5.6, Math.round((18 + level * 7) / 5) * 5, 'RECEPTION', '🧑‍💼');
  if (level >= 2) makePad('maid', 4.4, 5.6, Math.round((30 + level * 12) / 5) * 5, 'HOUSEKEEP', '🧽');
  if (level >= 3) makePad('speed', 4.4, 3.0, Math.round((30 + level * 8) / 5) * 5, 'FAST SHOES', '👟');
  // starting cash on the desk pile
  for (let i = 0; i < 6; i++) addBill('pile');
  // manager
  if (mgr.g) scene.remove(mgr.g);
  mgr.g = person('#e63946', '#ffd7ba', true); scene.add(mgr.g); Object.assign(mgr, { x: 0, z: 1.0, vx: 0, vz: 0, act: null, actT: 0, speed: 5.2, carry: [] });
  ui.levels(level); updCash(); updGoal(); camZ = 2;
}
function person(color, skin, hat) {
  const g = stickman(color, skin, 1.3);
  for (const l of [g.armL, g.armR, g.legL, g.legR]) l.traverse(o => { o.castShadow = false; });
  if (hat) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#c1121f' })); h.position.y = 1.7; h.castShadow = true; g.add(h); h.scale.setScalar(1); const b = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: '#ffd23f' })); b.rotation.x = Math.PI / 2; b.position.y = 1.62; g.add(b); }
  return g;
}
function setRoomLook(rm) {
  rm.mess.visible = rm.state === 'dirty'; rm.icon.visible = rm.state === 'dirty';
  rm.blanket.rotation.y = rm.state === 'dirty' ? 0.35 : 0; rm.blanket.position.y = rm.state === 'dirty' ? 0.72 : 0.75;
}

// ------------------------------------------------------------------ cash bills (one InstancedMesh)
function addBill(where, from) { const b = { where, t: 0, x: 0, y: 0, z: 0 }; if (from) { b.fx = from.x; b.fy = from.y; b.fz = from.z; b.fly = 0; } billsL.push(b); return b; }
function pileCount() { return billsL.filter(b => b.where === 'pile').length; }
const cashEl = document.createElement('div'); cashEl.className = 'bb-cash'; document.body.appendChild(cashEl);
const goalEl = document.createElement('div'); goalEl.className = 'bb-goal'; document.body.appendChild(goalEl);
function updCash(bump) { cashEl.innerHTML = `<b>$</b>${cash}`; if (bump) { cashEl.classList.remove('bump'); void cashEl.offsetWidth; cashEl.classList.add('bump'); } }
function updHearts() { heartsEl.textContent = '⭐'.repeat(3 - angry) + '✖️'.repeat(angry); }
const heartsEl = document.createElement('div'); heartsEl.style.cssText = 'position:fixed;right:12px;top:calc(60px + env(safe-area-inset-top));font-size:20px;z-index:5;pointer-events:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.2))'; document.body.appendChild(heartsEl);
function updGoal() { const d = pads.filter(p => p.done).length; goalEl.textContent = `${theme.name} · upgrades ${d}/${pads.length}`; ui.progress(d / pads.length); }

// ------------------------------------------------------------------ guests + staff
const SHIRTS = ['#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0', '#fb5607', '#ff006e', '#118ab2'], SKINS = ['#ffd7ba', '#f1c27d', '#c68642', '#8d5524', '#ffdbac'];
function spawnGuest() {
  const g = person(SHIRTS[Math.floor(Math.random() * SHIRTS.length)], SKINS[Math.floor(Math.random() * SKINS.length)]);
  const bag = new THREE.Mesh(rounded(0.45, 0.35, 0.18, 0.05), new THREE.MeshStandardMaterial({ color: ['#ff5d8f', '#3ab795', '#ffd23f', '#7b5cff'][Math.floor(Math.random() * 4)] })); bag.position.set(0.38, 0.45, 0); g.add(bag);
  const icon = sprite(ICONS.bell, 1.0); icon.visible = false; scene.add(icon);
  scene.add(g);
  const gu = { g, x: 0, z: LOBBY_Z1 + 3, path: [], st: 'queue', icon, room: null, t: 0, bag, speed: 3.2 };
  guests.push(gu); return gu;
}
const queueSpot = k => ({ x: 0, z: DESK.z + 1.05 + k * 0.95 });
function roomRoute(rm, inside = true) { const r = [{ x: 0, z: -0.5 }, { x: 0, z: rm.z }, { x: rm.side * (CORR + 0.4), z: rm.z }]; if (inside) r.push({ x: rm.bed.x, z: rm.bed.z }); return r; }
function freeRoom() { return rooms.find(r => r.open && r.state === 'free'); }
function hireStaff(kind) {
  const g = person(kind === 'recep' ? '#7b5cff' : '#06d6a0', SKINS[Math.floor(Math.random() * SKINS.length)], kind === 'recep');
  scene.add(g); const s = { kind, g, x: kind === 'recep' ? -4.4 : 4.4, z: 5.6, path: kind === 'recep' ? [{ x: -2.2, z: 1.0 }, { x: SERVE.x, z: SERVE.z }] : [], st: 'idle', t: 0, room: null, speed: 2.8 };
  staff.push(s); return s;
}
function walk(o, dt, sec) {
  if (!o.path.length) return true;
  const p = o.path[0], dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), step = o.speed * sec;
  if (d <= step) { o.x = p.x; o.z = p.z; o.path.shift(); } else { o.x += dx / d * step; o.z += dz / d * step; o.face = Math.atan2(dx, dz); }
  return !o.path.length;
}

// ------------------------------------------------------------------ input: floating joystick
const joy = document.createElement('div'); joy.className = 'bb-joy'; joy.innerHTML = '<i></i>'; document.body.appendChild(joy);
let joyV = { x: 0, y: 0 }, joyOn = false, botUntil = 0, botDir = { x: 0, z: 0 };
input({
  onDown: (e, st) => { if (state !== 'play') return; joyOn = true; joy.style.display = 'block'; joy.style.left = st.x + 'px'; joy.style.top = st.y + 'px'; joyV = { x: 0, y: 0 }; joy.firstChild.style.transform = ''; },
  onMove: (dx, dy, e, st) => { if (!joyOn) return; let vx = e.clientX - st.x, vy = e.clientY - st.y; const d = Math.hypot(vx, vy), m = 46; if (d > m) { vx *= m / d; vy *= m / d; } joyV = { x: vx / m, y: vy / m }; joy.firstChild.style.transform = `translate(${vx}px,${vy}px)`; },
  onUp: () => { joyOn = false; joy.style.display = 'none'; joyV = { x: 0, y: 0 }; },
});
ui.onTap(w => { if (w === 'start') state = 'play'; else { buildLevel(); state = 'play'; } });

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
loop((dt, t) => {
  const sec = dt / 60;
  if (!mgr.g) return;
  // ---- manager movement
  let mx = 0, mz = 0;
  if (state === 'play') {
    if (joyOn) { mx = joyV.x; mz = joyV.y; } else if (performance.now() < botUntil) { mx = botDir.x; mz = botDir.z; }
  }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  mgr.vx = lerp(mgr.vx, mx * mgr.speed, 0.3 * dt); mgr.vz = lerp(mgr.vz, mz * mgr.speed, 0.3 * dt);
  mgr.x += mgr.vx * sec; mgr.z += mgr.vz * sec; collide(mgr);
  const mv = Math.hypot(mgr.vx, mgr.vz);
  if (mv > 0.3) mgr.face = Math.atan2(mgr.vx, mgr.vz);
  mgr.g.position.set(mgr.x, 0, mgr.z); mgr.g.rotation.y = lerp(mgr.g.rotation.y, mgr.face ?? 0, 0.25); mgr.g.run(t, Math.min(1, mv / 3));
  // ---- guests spawn + flow
  if (state === 'play') {
    spawnT -= sec;
    const queued = guests.filter(g => g.st === 'queue' || g.st === 'desk');
    if (spawnT <= 0 && queued.length < Math.min(5, 1 + Math.ceil(rooms.filter(r => r.open).length * 1.5))) { spawnGuest(); spawnT = Math.max(1.4, 2.6 - level * 0.12); }
  }
  let qi = 0;
  const recep = staff.find(s => s.kind === 'recep' && !s.path.length);
  let serving = false;
  for (const gu of guests) {
    if (gu.st === 'queue' || gu.st === 'desk') {
      const spot = queueSpot(qi); if (qi === 0) gu.st = 'desk'; qi++;
      gu.path = [spot]; walk(gu, dt, sec);
      gu.icon.visible = gu.st === 'desk' && near(gu, spot, 0.1);
      const patience = Math.max(10, (24 - level * 1.2) / fk); if (state === 'play') gu.wait = (gu.wait || 0) + sec;
      if (gu.wait > patience * 0.55) { gu.icon.visible = true; gu.icon.material.map = ICONS.angry; gu.icon.scale.setScalar(1 + Math.sin(t * 12) * 0.08); }
      if (gu.wait > patience) {
        gu.st = 'leave'; gu.icon.material.map = ICONS.angry; gu.path = [{ x: gu.x + 1.2, z: gu.z + 0.5 }, { x: 4.2, z: gu.z + 0.5 }, { x: 4.2, z: LOBBY_Z1 + 3 }];
        angry++; updHearts(); ui.pop('GUEST WALKED OUT!', '#ff6b6b', 30, 30); sfx.fail(); buzz([40, 30, 40]);
        if (angry >= 3 && state === 'play') { state = 'lost'; F.level(false, pads.filter(x => x.done).length / Math.max(1, pads.length)); ui.lose('BAD REVIEWS!', 'Three guests walked out'); }
        continue;
      }
      if (gu.st === 'desk' && near(gu, spot, 0.1)) {
        const room = freeRoom();
        if (gu.wait <= Math.max(12, 24 - level * 1.2) * 0.55) gu.icon.material.map = room ? ICONS.bell : ICONS.bed;
        const mgrServes = Math.abs(mgr.x - SERVE.x) < 1.6 && mgr.z < DESK.z - 0.2 && mgr.z > 0.2;
        if (room && (mgrServes || recep)) {
          serving = true; gu.t += sec * (mgrServes ? 1.6 : 1.0);
          if (mgrServes) { mgr.act = 'desk'; mgr.actT = gu.t / 0.7; }
          if (gu.t >= 0.7) {
            room.state = 'booked'; room.guest = gu; gu.room = room; gu.st = 'toroom'; gu.icon.visible = false; gu.t = 0; served++;
            gu.path = [{ x: 2.4, z: DESK.z + 1.05 }, { x: 2.4, z: 0.7 }, ...roomRoute(room)];
            for (let k = 0; k < 3 + Math.floor(level / 3); k++) setTimeout(() => addBill('pile', V(gu.x, 1.2, gu.z)), k * 90);
            sfx.coin(); buzz(8); tone(880, 0.06, 'triangle', 0.08, 1.2);
          }
        }
      }
    } else if (gu.st === 'toroom') { if (walk(gu, dt, sec)) { gu.st = 'sleep'; gu.t = 0; gu.icon.material.map = ICONS.sleep; gu.icon.visible = true; gu.bag.visible = false; } }
    else if (gu.st === 'sleep') {
      gu.t += sec; gu.g.position.set(gu.room.bed.x - gu.room.side * 0.75, 0.9, gu.room.bed.z); gu.g.rotation.set(-Math.PI / 2, -gu.room.side * Math.PI / 2, 0, 'YXZ'); gu.icon.position.set(gu.room.bed.x, 2.2 + Math.sin(t * 3) * 0.1, gu.room.bed.z);
      if (gu.t > Math.min(4, 2.6 + level * 0.2)) { gu.st = 'leave'; gu.g.rotation.set(0, 0, 0, 'XYZ'); gu.icon.visible = false; gu.room.state = 'dirty'; setRoomLook(gu.room); gu.room.guest = null;
        gu.speed = 4.4; gu.path = [...roomRoute(gu.room, false).reverse(), { x: 0, z: 0.8 }, { x: 4.2, z: 0.8 }, { x: 4.2, z: LOBBY_Z1 + 2 }]; }
      continue;
    } else if (gu.st === 'leave') { if (walk(gu, dt, sec)) { gu.st = 'gone'; scene.remove(gu.g); scene.remove(gu.icon); } }
    if (gu.st !== 'gone') { gu.icon.position.set(gu.x, 2.4 + Math.sin(t * 4) * 0.08, gu.z); gu.g.position.set(gu.x, 0, gu.z); if (gu.face !== undefined) gu.g.rotation.y = lerp(gu.g.rotation.y, gu.face, 0.3); gu.g.run(t + gu.x, gu.path.length ? 1 : 0); }
  }
  guests = guests.filter(g => g.st !== 'gone');
  if (!serving && mgr.act === 'desk') mgr.act = null;
  // ---- cleaning (manager or housekeeper standing in a dirty room)
  let cleaning = false;
  for (const rm of rooms) {
    if (!rm.open) continue;
    if (rm.pop > 0) { rm.pop = Math.max(0, rm.pop - sec * 2); const s = 1 + Math.sin((1 - rm.pop) * Math.PI) * 0.12 * rm.pop * 2; rm.g.scale.set(s, Math.min(1, 1.6 - rm.pop * 1.6) + 0.0001, s); }
    rm.icon.position.y = 2.6 + Math.sin(t * 4 + rm.i) * 0.12;
    if (rm.state !== 'dirty') continue;
    const maid = staff.find(s => s.kind === 'maid' && s.room === rm && !s.path.length);
    const byMgr = inRoom(mgr, rm);
    if (byMgr || maid) {
      rm.cleanT += sec * (byMgr ? 1.4 : 0.8); if (byMgr) { cleaning = true; mgr.act = 'clean'; mgr.actT = rm.cleanT; }
      if (Math.random() < 0.3) burst(scene, V(rm.cx + (Math.random() - 0.5) * 3, 0.5, rm.z + (Math.random() - 0.5) * 2.5), ['#ffffff', '#bde0fe'], 1, { speed: 0.03, up: 0.04, size: 0.5, shape: 'sphere', gravity: 0 });
      if (rm.cleanT >= 1) {
        rm.cleanT = 0; rm.state = 'free'; setRoomLook(rm); if (maid) { maid.room = null; maid.st = 'idle'; }
        sfx.pick(5); buzz(10); burst(scene, V(rm.cx, 1, rm.z), ['#ffffff', '#ffd23f', '#a0e7ff'], 14, { speed: 0.08, up: 0.1, size: 0.6, shape: 'sphere' });
        if (byMgr) { const b = addBill('carry', V(rm.bed.x, 1, rm.bed.z)); cash += 5; updCash(true); ui.pop('+$5', '#d8ffcf', 26, 42); } else addBill('pile', V(rm.cx, 1, rm.z));
      }
    } else rm.cleanT = Math.max(0, rm.cleanT - sec * 0.5);
  }
  if (!cleaning && mgr.act === 'clean') mgr.act = null;
  // ---- staff behaviour
  for (const s of staff) {
    if (s.kind === 'maid' && s.st === 'idle') { const rm = rooms.find(r => r.open && r.state === 'dirty' && !staff.some(o => o.room === r)); if (rm) { const cur = rooms.find(r => r.open && inRoom(s, r)); s.room = rm; s.st = 'go';
      s.path = [...(cur ? [{ x: cur.side * (CORR + 0.4), z: cur.z }, { x: 0, z: cur.z }] : [{ x: 3.6, z: 0.8 }, { x: 0, z: 0.8 }, { x: 0, z: -0.5 }]), { x: 0, z: rm.z }, { x: rm.side * (CORR + 0.4), z: rm.z }, { x: rm.cx, z: rm.z }]; } }
    walk(s, dt, sec); s.g.position.set(s.x, 0, s.z); if (s.face !== undefined) s.g.rotation.y = lerp(s.g.rotation.y, s.path.length ? s.face : (s.kind === 'recep' ? Math.PI : s.face), 0.2); s.g.run(t + 3, s.path.length ? 1 : 0);
  }
  // ---- cash: pick up the desk pile by walking near it
  if (state === 'play' && near(mgr, PILE, 1.35)) {
    mgr.pickT = (mgr.pickT || 0) - sec;
    if (mgr.pickT <= 0) { const pb = [...billsL].reverse().find(b => b.where === 'pile'); if (pb) { const top = pileTop(pileCount() - 1); pb.where = 'carry'; pb.fx = top.x; pb.fy = top.y; pb.fz = top.z; pb.fly = 0; cash += 5; updCash(true); tone(900 + Math.min(20, mgr.carry.length) * 25, 0.04, 'square', 0.04, 1.3); mgr.pickT = 0.045; } }
  }
  // ---- pads: stand on one to pour cash in
  for (const p of pads) {
    if (p.done) continue;
    const on = state === 'play' && Math.abs(mgr.x - p.x) < 1.15 && Math.abs(mgr.z - p.z) < 1.15;
    p.g.scale.setScalar(lerp(p.g.scale.x, on ? 1.08 : 1, 0.2));
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
  for (const b of billsL) {
    let tx, ty, tz, rot = 0;
    if (b.where === 'pile') { const p = pileTop(pi++); tx = p.x; ty = p.y; tz = p.z; rot = p.r; }
    else if (b.where === 'carry') { const lag = ci * 0.012; tx = mgr.x + back.x * 0.55 - mgr.vx * lag; ty = 1.25 + ci * 0.085; tz = mgr.z + back.z * 0.55 - mgr.vz * lag; rot = mgr.g.rotation.y; ci++; }
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
  camZ = lerp(camZ, clamp(mgr.z, topZ + 5.5, 6), 0.08 * dt); camX = lerp(camX, clamp(mgr.x * 0.7, -2.6, 2.6), 0.08 * dt);
  camera.position.set(camX, 16.5, camZ + 8.4); camera.lookAt(camX, 0, camZ - 2.6);
  stage.followLight(V(camX, 0, camZ));
  for (const p of pads) p.g.children[2].material.opacity = 0.9 + Math.sin(t * 5) * 0.1;
});
function pileTop(i) { const col = i % 4, lay = Math.floor(i / 4); return { x: PILE.x + (col % 2 - 0.5) * 0.36, y: 0.1 + lay * 0.085, z: PILE.z + (Math.floor(col / 2) - 0.5) * 0.4, r: 0 }; }
function unlock(p) {
  p.done = true; p.g.visible = false; sfx.win(); buzz([20, 30, 20]); ui.flash(0.4);
  confetti(scene, V(p.x, 1.5, p.z), 50);
  if (p.kind === 'room') { const rm = p.room; rm.open = true; rm.floor.material.map = rm.wood; rm.floor.material.needsUpdate = true; rm.g = roomMesh(rm); world.add(rm.g); walls.push(...rm.walls); rm.pop = 1; setRoomLook(rm); ui.pop('NEW ROOM!', '#fff', 40, 30); }
  else if (p.kind === 'recep') { hireStaff('recep'); ui.pop('RECEPTIONIST HIRED!', '#fff', 32, 30); }
  else if (p.kind === 'maid') { hireStaff('maid'); ui.pop('HOUSEKEEPER HIRED!', '#fff', 32, 30); }
  else if (p.kind === 'speed') { mgr.speed = 7; ui.pop('SPEED UP!', '#fff', 40, 30); }
  // push the manager off walls that just appeared
  collide(mgr);
  updGoal();
  if (pads.every(x => x.done) && state === 'play') {
    state = 'won'; F.level(true); setTimeout(() => { for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, V(camX, 2, camZ), 45), i * 160); }, 200);
    ui.win(level, `${theme.name} complete · ${served} guests`); level++; S.set('level', level);
  }
}

buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks + bot (greedy: desk → cash → clean → buy)
function routeTo(o, target) {
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
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return served; },
  bot() {
    if (state !== 'play') return;
    const open = pads.filter(p => !p.done).sort((a, b) => (a.cost - a.paid) - (b.cost - b.paid));
    const nextPad = open[0], need = nextPad ? nextPad.cost - nextPad.paid : 0;
    const front = guests.find(g => g.st === 'desk'), recep = staff.some(s => s.kind === 'recep');
    const dirty = rooms.find(r => r.open && r.state === 'dirty' && !staff.some(s => s.room === r));
    let target;
    if (nextPad && cash >= need) target = nextPad;
    else if (pileCount() > 0 && (pileCount() * 5 + cash >= need || !front || recep)) target = { x: PILE.x + 0.3, z: PILE.z };
    else if (front && !recep && freeRoom()) target = { x: SERVE.x, z: SERVE.z };
    else if (dirty) target = { x: dirty.cx, z: dirty.z };
    else if (nextPad && cash > 0) target = nextPad;
    else target = { x: SERVE.x, z: SERVE.z };
    if (front && !recep && freeRoom() && (front.wait || 0) > 6 && !(nextPad && cash >= need)) target = { x: SERVE.x, z: SERVE.z };
    const wp = routeTo(mgr, target), dx = wp.x - mgr.x, dz = wp.z - mgr.z, d = Math.hypot(dx, dz);
    botDir = d < 0.15 ? { x: 0, z: 0 } : { x: dx / d * Math.min(1, d * 1.5), z: dz / d * Math.min(1, d * 1.5) };
    botUntil = performance.now() + 250;
  },
};

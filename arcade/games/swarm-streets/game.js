// Swarm Streets — original game. Lead your coloured mob around a toy city, recruit every grey pedestrian you touch,
// swallow smaller rival mobs, dodge bigger ones. Biggest mob when the clock hits zero wins.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, store, lerp, clamp, rng } from './kit/hc.js';
import { bake, vcMat, crowdMesh } from './people.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
const B = board({ game: 'swarm-streets', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const ST = store('swarmstreets');
let level = ST.get('level', 1), best = ST.get('best', 0);
const F = flow('swarmstreets'); let fk = 1;
const { scene, camera, sun, followLight } = createStage({ fov: 40, shadowSize: 46 });
sun.shadow.camera.far = 120;
const ui = createUI({ title: 'SWARM<br>STREETS', hint: 'Tap where to go · or hold & drag', hand: '👆', score: false });
document.body.style.setProperty('--bg1', '#9aa3bd'); document.body.style.setProperty('--bg2', '#cfd5e6'); document.body.style.setProperty('--ui', '#7b4dff');
const $ = id => document.getElementById(id);
const NEUTRAL = '#dfe2ea';
const COLORS = ['#7b4dff', '#ff4fa3', '#22c3f5', '#ffae1a', '#38d27a', '#ff5a3c'];
const NAMES = ['You', 'Rosa', 'Kai', 'Mango', 'Leaf', 'Blaze'];
const MAX = 1400;

// ---------------------------------------------------------------- static city (rebuilt per level)
let city, bounds = 36, boxes = [];
const PITCH = 24, BLOCK = 16;
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const FACADES = ['#ffc9c9', '#ffe2a8', '#bfe6ff', '#f4f4f8', '#d6cbff', '#ffc7a3', '#bdf0cf', '#f6c8ff'];
const ROOFS = ['#c4c9d8', '#b9bfd0', '#d2d6e2'];
function buildCity(R) {
  if (city) scene.remove(city);
  city = new THREE.Group(); scene.add(city); boxes = [];
  const n = level < 3 ? 3 : level < 6 ? 4 : 5;           // blocks per side
  bounds = n * PITCH / 2;
  const S = bounds * 2 + 8, px = 1024 / S, parks = [];
  const centers = []; for (let i = 0; i < n; i++) centers.push(-bounds + PITCH / 2 + i * PITCH);
  const kinds = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const mid = n % 2 === 1 && i === (n - 1) / 2 && j === (n - 1) / 2;
    kinds.push({ x: centers[i], z: centers[j], k: mid ? 'plaza' : R() < 0.24 ? 'park' : R() < 0.5 ? 'one' : 'split' });
  }
  // ground texture: asphalt, sidewalks, lane dashes, crosswalks, parks
  const tex = canvasTex(1024, 1024, (x) => {
    const W = v => (v + S / 2) * px;
    x.fillStyle = '#4c5161'; x.fillRect(0, 0, 1024, 1024);
    x.strokeStyle = '#f4f4f4'; x.lineWidth = 0.35 * px; x.setLineDash([2.2 * px, 2.2 * px]);
    for (let i = 0; i <= n; i++) { const c = -bounds + i * PITCH; x.beginPath(); x.moveTo(W(c), 0); x.lineTo(W(c), 1024); x.stroke(); x.beginPath(); x.moveTo(0, W(c)); x.lineTo(1024, W(c)); x.stroke(); }
    x.setLineDash([]);
    for (const b of kinds) {
      const s = BLOCK + 2.4; x.fillStyle = '#c9cdd9'; x.fillRect(W(b.x - s / 2), W(b.z - s / 2), s * px, s * px);
      x.fillStyle = '#b5bac8'; for (let k = 0; k < 4; k++) x.fillRect(W(b.x - s / 2), W(b.z - s / 2 + k * s / 4), s * px, 1);
      if (b.k === 'park' || b.k === 'plaza') {
        x.fillStyle = b.k === 'park' ? '#8edc8f' : '#e9dcc8'; x.fillRect(W(b.x - BLOCK / 2), W(b.z - BLOCK / 2), BLOCK * px, BLOCK * px);
        if (b.k === 'plaza') { x.fillStyle = '#f3e9da'; x.beginPath(); x.arc(W(b.x), W(b.z), 5 * px, 0, 7); x.fill(); x.strokeStyle = '#d7c6ad'; x.lineWidth = 3; x.stroke(); }
        else { x.strokeStyle = '#f0e2c4'; x.lineWidth = 1.6 * px; x.beginPath(); x.moveTo(W(b.x - BLOCK / 2), W(b.z - BLOCK / 2)); x.lineTo(W(b.x + BLOCK / 2), W(b.z + BLOCK / 2)); x.stroke(); }
      }
    }
    // crosswalks
    x.fillStyle = '#f4f4f4';
    for (const b of kinds) for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const cx = b.x + dx * (BLOCK / 2 + 4), cz = b.z + dz * (BLOCK / 2 + 4);
      if (Math.abs(cx) > bounds || Math.abs(cz) > bounds) continue;
      for (let k = -3; k <= 3; k++) {
        const ox = dx ? cx - 2.6 : b.x - BLOCK / 2 + 1.5, oz = dz ? cz - 2.6 : b.z - BLOCK / 2 + 1.5;
        if (dx) x.fillRect(W(ox + (k + 3) * 0.8), W(oz), 0.45 * px, 2.2 * px); else x.fillRect(W(ox), W(oz + (k + 3) * 0.8), 2.2 * px, 0.45 * px);
      }
    }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; city.add(ground);
  // outer void edge: low wall + far ground so the map reads as an island
  const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#9ed99a', { roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = -0.05; city.add(far);
  // buildings → one baked mesh
  const parts = [], trees = [];
  const addBuilding = (x0, z0, x1, z1) => {
    const h = 4.4 + Math.floor(R() * 4) * 1.6 + (level > 4 ? R() * 3 : 0), w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const f = FACADES[Math.floor(R() * FACADES.length)], roof = ROOFS[Math.floor(R() * ROOFS.length)];
    parts.push({ geo: new THREE.BoxGeometry(w, h, d), color: f, pos: [cx, h / 2, cz] });
    const rc = new THREE.Color(f).lerp(new THREE.Color(roof), 0.45).getStyle(), deck = new THREE.Color(f).lerp(new THREE.Color('#8790a8'), 0.55).getStyle();
    parts.push({ geo: new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), color: rc, pos: [cx, h + 0.25, cz] });
    parts.push({ geo: new THREE.BoxGeometry(w - 0.7, 0.3, d - 0.7), color: deck, pos: [cx, h + 0.42, cz] });
    const roofType = R();
    if (roofType < 0.35) parts.push({ geo: new THREE.BoxGeometry(w * 0.45, 0.25, d * 0.45), color: '#7fd18b', pos: [cx + w * 0.15, h + 0.6, cz - d * 0.15] });
    for (let q = 0; q < 2 + Math.floor(R() * 3); q++) parts.push({ geo: new THREE.BoxGeometry(1.3, 0.8, 1.1), color: '#f4f5f9', pos: [cx + (R() - 0.5) * (w - 2.4), h + 0.9, cz + (R() - 0.5) * (d - 2.4)] });
    if (roofType > 0.6) { parts.push({ geo: new THREE.CylinderGeometry(0.8, 0.8, 1.6, 14), color: '#ffffff', pos: [cx - w / 4, h + 1.3, cz + d / 4] }); parts.push({ geo: new THREE.ConeGeometry(0.9, 0.6, 14), color: '#ff6b8a', pos: [cx - w / 4, h + 2.4, cz + d / 4] }); }
    if (roofType > 0.35 && roofType < 0.6) parts.push({ geo: new THREE.CylinderGeometry(1.6, 1.6, 0.12, 20), color: '#ffd23f', pos: [cx + w / 5, h + 0.62, cz - d / 5] });
    // window bands on the 4 facades
    const win = R() < 0.5 ? '#6fa8dc' : '#5b7fb8';
    for (let y = 2.2; y < h - 0.8; y += 1.6) {
      parts.push({ geo: new THREE.BoxGeometry(w - 1, 0.7, 0.08), color: win, pos: [cx, y, z1 + 0.03] });
      parts.push({ geo: new THREE.BoxGeometry(w - 1, 0.7, 0.08), color: win, pos: [cx, y, z0 - 0.03] });
      parts.push({ geo: new THREE.BoxGeometry(0.08, 0.7, d - 1), color: win, pos: [x1 + 0.03, y, cz] });
      parts.push({ geo: new THREE.BoxGeometry(0.08, 0.7, d - 1), color: win, pos: [x0 - 0.03, y, cz] });
    }
    // shop front + awning on the camera-facing side
    const aw = COLORS[1 + Math.floor(R() * 5)];
    parts.push({ geo: new THREE.BoxGeometry(w - 1.2, 1.1, 0.1), color: '#3c4a66', pos: [cx, 0.75, z1 + 0.04] });
    parts.push({ geo: new THREE.BoxGeometry(w - 1, 0.18, 0.9), color: aw, pos: [cx, 1.55, z1 + 0.45], rot: [0.3, 0, 0] });
    boxes.push({ x0: x0 - 0.15, x1: x1 + 0.15, z0: z0 - 0.15, z1: z1 + 0.15 });
  };
  for (const b of kinds) {
    const h = BLOCK / 2 - 0.6;
    if (b.k === 'one') addBuilding(b.x - h, b.z - h, b.x + h, b.z + h);
    else if (b.k === 'split') {
      if (R() < 0.5) { addBuilding(b.x - h, b.z - h, b.x - 0.6, b.z + h); addBuilding(b.x + 0.6, b.z - h, b.x + h, b.z + h); }
      else { addBuilding(b.x - h, b.z - h, b.x + h, b.z - 0.6); addBuilding(b.x - h, b.z + 0.6, b.x + h, b.z + h); }
    } else if (b.k === 'park') { for (let k = 0; k < 6; k++) trees.push([b.x + (R() - 0.5) * 12, b.z + (R() - 0.5) * 12, 0.8 + R() * 0.5]); }
    else { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; trees.push([b.x + Math.cos(a) * 6.3, b.z + Math.sin(a) * 6.3, 0.75]); } }
    // sidewalk trees at block corners
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (R() < 0.5) trees.push([b.x + sx * (BLOCK / 2 + 0.6), b.z + sz * (BLOCK / 2 + 0.6), 0.6]);
  }
  const bm = new THREE.Mesh(bake(parts), vcMat({ roughness: 0.6 })); bm.castShadow = true; bm.receiveShadow = true; city.add(bm);
  const tg = bake([
    { geo: new THREE.CylinderGeometry(0.16, 0.22, 1.4, 8), color: '#9b6b43', pos: [0, 0.7, 0] },
    { geo: new THREE.IcosahedronGeometry(1, 1), color: '#4fc46a', pos: [0, 2.1, 0], scl: [1.05, 1, 1.05] },
    { geo: new THREE.IcosahedronGeometry(0.7, 1), color: '#6bd77e', pos: [0.3, 2.8, 0.2] },
  ]);
  const tm = new THREE.InstancedMesh(tg, vcMat({ flatShading: true }), trees.length); tm.castShadow = true;
  const M = new THREE.Matrix4();
  trees.forEach(([x, z, s], i) => tm.setMatrixAt(i, M.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))));
  city.add(tm);
  // little fence posts around the map edge
  const posts = Math.floor(bounds * 8 / 2.5), pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1, 0.3), mat('#ffffff'), posts * 1);
  let pi = 0; for (let k = 0; k < posts; k++) { const t = k / posts * 4, side = Math.floor(t), f = (t - side) * 2 * bounds - bounds; const [x, z] = side === 0 ? [f, -bounds - 2] : side === 1 ? [bounds + 2, f] : side === 2 ? [-f, bounds + 2] : [-bounds - 2, -f]; pm.setMatrixAt(pi++, M.makeTranslation(x, 0.5, z)); }
  city.add(pm);
}
const LIM = () => bounds + 1.5;
function solid(x, z, r) { for (const b of boxes) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return b; return null; }
function pushOut(p, r) {   // p: {x,z}; resolve vs buildings + map edge, returns true if moved
  let hit = false;
  for (const b of boxes) {
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r) {
      const dl = p.x - (b.x0 - r), dr = b.x1 + r - p.x, dt = p.z - (b.z0 - r), db = b.z1 + r - p.z, m = Math.min(dl, dr, dt, db);
      if (m === dl) p.x = b.x0 - r; else if (m === dr) p.x = b.x1 + r; else if (m === dt) p.z = b.z0 - r; else p.z = b.z1 + r;
      hit = true;
    }
  }
  const L = LIM(); if (p.x < -L) { p.x = -L; hit = true; } if (p.x > L) { p.x = L; hit = true; } if (p.z < -L) { p.z = -L; hit = true; } if (p.z > L) { p.z = L; hit = true; }
  return hit;
}

// ---------------------------------------------------------------- people + crowds
const crowd = crowdMesh(MAX); scene.add(crowd.mesh);
// per-person state
const PX = new Float32Array(MAX), PZ = new Float32Array(MAX), VX = new Float32Array(MAX), VZ = new Float32Array(MAX), RY = new Float32Array(MAX), OWN = new Int8Array(MAX), POP = new Float32Array(MAX), WT = new Float32Array(MAX);
let N = 0, crowds = [], state = 'ready', T = 0, dur = 15, kills = 0, R, spawnAcc = 0, endT = 0, ringMesh, labels = [];
const pTmp = { x: 0, z: 0 };
function freeSpot(near = null, rad = 0) {
  for (let k = 0; k < 60; k++) {
    const x = near ? near.x + (R() - 0.5) * rad : (R() - 0.5) * 2 * bounds, z = near ? near.z + (R() - 0.5) * rad : (R() - 0.5) * 2 * bounds;
    if (Math.abs(x) < bounds && Math.abs(z) < bounds && !solid(x, z, 0.5)) return { x, z };
  }
  return near ? freeSpot() : { x: bounds - 2, z: bounds - 2 };
}
function addPerson(x, z, owner) {
  if (N >= MAX) return -1;
  const i = N++; PX[i] = x; PZ[i] = z; OWN[i] = owner; POP[i] = 0; RY[i] = R() * 6.28; const a = R() * 6.28; VX[i] = Math.cos(a); VZ[i] = Math.sin(a); WT[i] = R() * 3;
  crowd.color(i, owner < 0 ? NEUTRAL : crowds[owner].color); crowd.run.array[i] = owner < 0 ? 0.35 : 1; return i;
}
function labelSprite(c) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.renderOrder = 10; s.scale.set(4.4, 1.93, 1); scene.add(s);
  return { s, cv, tex, last: -1, c };
}
function drawLabel(L, name, n) {
  const x = L.cv.getContext('2d'); x.clearRect(0, 0, 256, 112);
  x.font = '800 34px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,.45)'; x.strokeText(name, 128, 26); x.fillStyle = '#fff'; x.fillText(name, 128, 26);
  const w = 150; x.fillStyle = 'rgba(30,30,40,.55)'; rr(x, 128 - w / 2, 52, w, 46, 23); x.fill();
  x.fillStyle = L.c; rr(x, 128 - w / 2 + 4, 56, w - 8, 38, 19); x.fill();
  x.font = '800 36px "Baloo 2", system-ui'; x.fillStyle = '#fff'; x.fillText(n, 128, 77);
  L.tex.needsUpdate = true;
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
const ringGeo = new THREE.RingGeometry(0.86, 1, 48);
function newCrowd(k, at, size) {
  const c = { k, color: COLORS[k], name: NAMES[k], x: at.x, z: at.z, dx: 0, dz: 1, tx: 0, tz: 1, members: [], alive: true, think: 0, eat: 0, smart: k === 0 ? 1 : clamp((0.1 + level * 0.1) * fk, 0.2, 0.98), speed: k === 0 ? 7.2 : Math.min(7.05, (5.2 + level * 0.25) * fk), moving: true, bump: 0 };
  crowds.push(c);
  for (let j = 0; j < size; j++) { const i = addPerson(at.x + (R() - 0.5) * 2, at.z + (R() - 0.5) * 2, k); c.members.push(i); }
  c.label = labelSprite(c.color);
  c.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: k === 0 ? 0.85 : 0.45, depthWrite: false }));
  c.ring.rotation.x = -Math.PI / 2; c.ring.position.y = 0.05; scene.add(c.ring);
  return c;
}
const crowdR = c => 0.48 * Math.sqrt(c.members.length) + 0.55;
function slot(k) { if (k === 0) return [0, 0]; const r = 0.62 * Math.sqrt(k + 0.4), a = k * 2.39996; return [Math.cos(a) * r, Math.sin(a) * r]; }

let edges = [];
function buildLevel() { tapDir = null;
  R = rng(level * 977 + 13); fk = F.k();
  for (const c of crowds) { scene.remove(c.label.s); scene.remove(c.ring); c.label.tex.dispose(); }
  for (const e of edges) e.remove(); edges = [];
  crowds = []; N = 0; kills = 0; T = 0; endT = 0; spawnAcc = 0;
  buildCity(R);
  dur = Math.min(60, 8 + level * 7);
  const rivals = Math.min(5, 2 + Math.floor(level / 2));
  newCrowd(0, { x: 0, z: 2 }, 1);
  const spots = [[1, 1], [-1, -1], [1, -1], [-1, 1], [0, -1]];
  for (let k = 1; k <= rivals; k++) { const s = spots[k - 1]; let at = freeSpot({ x: s[0] * bounds * 0.62, z: s[1] * bounds * 0.62 }, 8); for (let q = 0; q < 30 && Math.hypot(at.x, at.z - 2) < bounds * 0.5; q++) at = freeSpot(); newCrowd(k, at, level < 3 ? 1 : 1 + Math.floor(R() * Math.min(12, level))); }
  const target = Math.floor((bounds * 2) ** 2 * 0.095);
  for (let k = 0; k < target; k++) { const p = freeSpot(); addPerson(p.x, p.z, -1); }
  for (let k = 1; k < crowds.length; k++) { const d = document.createElement('div'); d.className = 'edge'; d.style.background = crowds[k].color; d.innerHTML = `<b></b><i style="position:absolute;left:50%;top:50%;width:0;height:0;border:6px solid transparent;border-left:9px solid ${crowds[k].color};margin:-6px 0 0 -4px"></i>`; document.body.appendChild(d); edges.push(d); }
  ui.levels(level); ui.progress(0); hud();
  camD = 38; camT.set(crowds[0].x, 0, crowds[0].z);
}
function hud() {
  const left = Math.max(0, dur - T), s = Math.ceil(left);
  $('timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; $('timer').classList.toggle('hot', left < 5 && state === 'play');
  $('kills').textContent = '☠ ' + kills;
  const me = crowds[0]; if (me) $('rank').textContent = '#' + rankOf(me) + ' · ' + me.members.length;
}
function rankOf(c) { return 1 + crowds.filter(o => o !== c && o.alive && o.members.length > c.members.length).length; }

// ---------------------------------------------------------------- input: virtual joystick
let joy = null, botDir = null, tapDir = null;   // tapDir: a tap sends the mob walking toward the tapped spot (until the next tap / drag)
input({
  onDown(e) { joy = { x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY }; botDir = null; tapDir = null; },
  onMove(dx, dy, e) { if (joy) { joy.cx = e.clientX; joy.cy = e.clientY; const d = Math.hypot(joy.cx - joy.x, joy.cy - joy.y); if (d > 70) { joy.x = joy.cx - (joy.cx - joy.x) / d * 70; joy.y = joy.cy - (joy.cy - joy.y) / d * 70; } } },
  onUp() { joy = null; },
  onTap(e) { const c = crowds[0]; if (state !== 'play' || !c) return; const p = new THREE.Vector3(c.x, 0, c.z).project(camera), jx = e.clientX - (p.x + 1) / 2 * innerWidth, jy = e.clientY - (1 - p.y) / 2 * innerHeight, l = Math.hypot(jx, jy); if (l > 8) { tapDir = [jx / l, jy / l]; sfx.tap(); } },
});
ui.onTap(w => { B.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); buildLevel(); state = 'play'; }
  else { buildLevel(); state = 'play'; }
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// your mob walks by itself toward the nearest grey crowd (the game's own bot) for a few seconds, then stands still again
const DM = demo(null, { ready: () => state === 'play' && level === 1 && !joy && !tapDir, wait: 1200, ms: 3500 });
let demoWalk = false;

// ---------------------------------------------------------------- AI (rivals + bot)
function think(c) {
  const me = c.members.length, rad = 16 + c.smart * 14;
  let best = null, bs = -1e9;
  // threats + prey
  let fx = 0, fz = 0;
  for (const o of crowds) {
    if (o === c || !o.alive) continue;
    const d = Math.hypot(o.x - c.x, o.z - c.z), on = o.members.length;
    if (on > me * 1.05 && d < 9 + crowdR(o) * 2) { fx -= (o.x - c.x) / (d + 0.1) * (on / me); fz -= (o.z - c.z) / (d + 0.1) * (on / me); }
    else if (on < me * 0.85 && d < rad * 1.3) { const s = on * 2.2 - d * 0.9 + 6; if (s > bs) { bs = s; best = { x: o.x, z: o.z }; } }
  }
  if (Math.hypot(fx, fz) > 0.4 * (1.1 - c.smart * 0.5)) { const l = Math.hypot(fx, fz); return { x: c.x + fx / l * 10, z: c.z + fz / l * 10 }; }
  // densest neutral pocket nearby (sample)
  const samp = Math.min(N, 120);
  for (let s = 0; s < samp; s++) {
    const i = Math.floor(R() * N); if (OWN[i] !== -1) continue;
    const d = Math.hypot(PX[i] - c.x, PZ[i] - c.z); if (d > rad || d < 0.5) continue;
    let dens = 0; for (let t = 0; t < 20; t++) { const j = Math.floor(R() * N); if (OWN[j] === -1 && Math.abs(PX[j] - PX[i]) < 6 && Math.abs(PZ[j] - PZ[i]) < 6) dens++; }
    // prefer things ahead (no zig-zag) and close
    const ahead = ((PX[i] - c.x) * c.dx + (PZ[i] - c.z) * c.dz) / d;
    const sc = dens * 1.6 - d * 0.5 + ahead * 2.5;
    if (sc > bs) { bs = sc; best = { x: PX[i], z: PZ[i] }; }
  }
  if (!best || R() > c.smart + 0.25) best = freeSpot();
  return best;
}
function steer(c, goal) {
  let dx = goal.x - c.x, dz = goal.z - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  // look-ahead obstacle avoidance: try rotations
  for (const a of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
    const ca = Math.cos(a), sa = Math.sin(a), rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
    if (!solid(c.x + rx * 3, c.z + rz * 3, 0.8) && Math.abs(c.x + rx * 3) < LIM() && Math.abs(c.z + rz * 3) < LIM()) return [rx, rz];
  }
  return [dx, dz];
}

// ---------------------------------------------------------------- end states
function finish(why) {
  if (state !== 'play') return;
  const me = crowds[0];
  if (why === 'dead') { state = 'lost'; F.level(false, clamp(T / dur, 0, 1)); sfx.fail(); buzz([60, 40, 80]); ui.flash(0.5); ui.lose('SWALLOWED!', `A bigger mob ate yours · ☠ ${kills}`); return; }
  const r = rankOf(me);
  if (r === 1) {
    if (state === 'play') B.submit(1); state = 'won'; F.level(true); best = Math.max(best, me.members.length); ST.set('best', best);
    sfx.win(); buzz([20, 40, 20, 40]); ui.flash(0.7); ui.progress(1);
    for (let k = 0; k < 3; k++) setTimeout(() => confetti(scene, new THREE.Vector3(me.x, 4, me.z), 90), k * 260);
    ui.win(level, `Biggest mob · ${me.members.length} people · ☠ ${kills}`);
  } else {
    state = 'lost'; sfx.fail(); buzz([40, 30, 60]);
    const top = crowds.filter(o => o.alive).sort((a, b) => b.members.length - a.members.length)[0];
    F.level(false, clamp(me.members.length / Math.max(1, top.members.length), 0, 1));
    ui.lose(`#${r} PLACE`, `${top.name} had ${top.members.length} · you had ${me.members.length}`);
  }
}

// ---------------------------------------------------------------- frame
let camD = 38, popAcc = 0, pitch = 0, shake = 0;
const camT = new THREE.Vector3(), V = new THREE.Vector3();
loop((dt, t) => {
  const s = dt / 60, play = state === 'play';
  if (DM.on && play) { window.__game.bot(); demoWalk = true; } else if (demoWalk) { demoWalk = false; botDir = null; }
  if (play) {
    T += s; ui.progress(T / dur);
    if (T >= dur) { hud(); finish('time'); }
  }
  // move crowd centres
  for (const c of crowds) {
    if (!c.alive) continue;
    let want = null;
    if (play) {
      if (c.k === 0) {
        if (joy) { const jx = joy.cx - joy.x, jy = joy.cy - joy.y, l = Math.hypot(jx, jy); if (l > 6) want = [jx / l, jy / l]; }
        else if (tapDir) want = tapDir;
        else if (botDir) want = steer(c, botDir);
      } else {
        c.think -= s; if (c.think <= 0 || !c.goal || Math.hypot(c.goal.x - c.x, c.goal.z - c.z) < 1.5) { c.goal = think(c); c.think = 0.5 + R() * 0.6; }
        want = steer(c, c.goal);
      }
    }
    c.moving = !!want;
    if (want) { c.dx = lerp(c.dx, want[0], 0.18 * dt); c.dz = lerp(c.dz, want[1], 0.18 * dt); const l = Math.hypot(c.dx, c.dz) || 1; c.dx /= l; c.dz /= l;
      pTmp.x = c.x + c.dx * c.speed * s; pTmp.z = c.z + c.dz * c.speed * s; pushOut(pTmp, 0.6); c.x = pTmp.x; c.z = pTmp.z; }
    // members chase their slot
    const fa = Math.atan2(c.dx, c.dz), ca = Math.cos(fa), sa = Math.sin(fa);
    c.members.forEach((i, k) => {
      const [ox, oz] = slot(k), tx = c.x + ox * ca + oz * sa, tz = c.z - ox * sa + oz * ca;
      let vx = (tx - PX[i]) * 5, vz = (tz - PZ[i]) * 5; const v = Math.hypot(vx, vz), mx = c.speed * 1.6;
      if (v > mx) { vx *= mx / v; vz *= mx / v; }
      pTmp.x = PX[i] + vx * s; pTmp.z = PZ[i] + vz * s; pushOut(pTmp, 0.25); PX[i] = pTmp.x; PZ[i] = pTmp.z;
      const moving = v > 0.6 || c.moving; crowd.run.array[i] = lerp(crowd.run.array[i], moving ? 1 : 0, 0.15 * dt);
      RY[i] = moving && v > 0.6 ? Math.atan2(vx, vz) : fa;
    });
  }
  // neutrals wander
  for (let i = 0; i < N; i++) {
    if (OWN[i] !== -1) continue;
    WT[i] -= s; if (WT[i] < 0) { const a = R() * 6.28; VX[i] = Math.cos(a); VZ[i] = Math.sin(a); WT[i] = 1.5 + R() * 3; }
    pTmp.x = PX[i] + VX[i] * 1.1 * s; pTmp.z = PZ[i] + VZ[i] * 1.1 * s;
    if (pushOut(pTmp, 0.25)) { VX[i] = -VX[i]; VZ[i] = -VZ[i]; }
    PX[i] = pTmp.x; PZ[i] = pTmp.z; RY[i] = Math.atan2(VX[i], VZ[i]);
  }
  // recruiting + clashes
  if (play) {
    let got = 0;
    for (const c of crowds) {
      if (!c.alive) continue; const r = crowdR(c) + 0.35, r2 = r * r;
      for (let i = 0; i < N; i++) {
        if (OWN[i] !== -1) continue; const dx = PX[i] - c.x, dz = PZ[i] - c.z; if (dx * dx + dz * dz > r2) continue;
        OWN[i] = c.k; c.members.push(i); crowd.color(i, c.color); POP[i] = 1; crowd.run.array[i] = 1;
        if (c.k === 0) got++;
      }
    }
    if (got) { popAcc += got; c0bump(); }
    for (const a of crowds) for (const b of crowds) {
      if (a === b || !a.alive || !b.alive || a.members.length <= b.members.length) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z); if (d > (crowdR(a) + crowdR(b)) * 0.82) continue;
      a.eat += s * (10 + b.members.length * 1.2);
      while (a.eat >= 1 && b.members.length) {
        a.eat -= 1; const i = b.members.pop(); OWN[i] = a.k; a.members.push(i); crowd.color(i, a.color); POP[i] = 1;
        if (a.k === 0 || b.k === 0) popAcc += a.k === 0 ? 1 : 0;
      }
      if (b.members.length === 0) {
        b.alive = false; b.label.s.visible = false; b.ring.visible = false;
        burst(scene, new THREE.Vector3(b.x, 1.5, b.z), [b.color, '#ffffff'], 30, { speed: 0.25, up: 0.15, size: 1.2 });
        if (a.k === 0) { kills++; sfx.smash(); buzz([30, 20, 50]); ui.flash(0.35); shake = 0.6; ui.pop(`☠ ${b.name.toUpperCase()} SWALLOWED!`, '#ffffff', 30, 26); }
        if (b.k === 0) finish('dead');
        if (crowds.every(o => o.k === 0 || !o.alive) && state === 'play') { T = dur; finish('time'); }
      }
      if (b.k === 0 && state === 'play') { buzz(8); if (R() < 0.08) tone(200, 0.08, 'square', 0.06, 0.6); }
    }
  }
  // recruit juice (throttled chime that climbs)
  if (popAcc > 0 && (pitch -= s) <= 0) { const n = crowds[0].members.length; tone(420 + Math.min(600, n * 3), 0.06, 'triangle', 0.11, 1.25); buzz(5); pitch = 0.07; if (popAcc >= 6) ui.pop('+' + popAcc, '#fff', 30 + Math.min(16, popAcc), 34); popAcc = 0; }
  // write instances
  for (let i = 0; i < N; i++) {
    POP[i] = Math.max(0, POP[i] - 0.06 * dt); crowd.pop.array[i] = POP[i] * Math.sin(POP[i] * 3.1);
    crowd.set(i, PX[i], 0, PZ[i], RY[i]);
  }
  crowd.commit(N, t);
  // labels, rings, edge markers
  const me = crowds[0];
  crowds.forEach((c, k) => {
    if (!c.alive) { if (k > 0) edges[k - 1].style.opacity = 0; return; }
    const n = c.members.length, r = crowdR(c);
    if (n !== c.label.last) { c.label.last = n; drawLabel(c.label, c.name, n); c.bump = 1; }
    c.bump = Math.max(0, c.bump - 0.08 * dt);
    const sc = (1 + c.bump * 0.25 + Math.min(0.5, n / 400)) * camD / 30;
    c.label.s.position.set(c.x, 2.6 + r * 0.4 + sc * 1.2, c.z); c.label.s.scale.set(4.4 * sc, 1.93 * sc, 1);
    c.ring.position.set(c.x, 0.05, c.z); c.ring.scale.setScalar(r + 0.4);
    if (k > 0) {
      const e = edges[k - 1]; V.set(c.x, 1, c.z).project(camera);
      const on = Math.abs(V.x) < 0.95 && Math.abs(V.y) < 0.9 && V.z < 1;
      if (on || !play) { e.style.opacity = 0; return; }
      const ax = V.z > 1 ? -V.x : V.x, ay = V.z > 1 ? -V.y : V.y, l = Math.max(Math.abs(ax) / 0.88, Math.abs(ay) / 0.8);
      const ex = (ax / l * 0.5 + 0.5) * innerWidth, ey = (-ay / l * 0.5 + 0.5) * innerHeight;
      e.style.opacity = 1; e.style.left = ex + 'px'; e.style.top = ey + 'px'; e.querySelector('b').textContent = n;
      e.querySelector('i').style.transform = `rotate(${Math.atan2(-ay, ax)}rad) translateX(20px)`;
    }
  });
  if (play) hud();
  // camera: steep 3/4 view, zooms out as the mob grows
  const n = me ? me.members.length : 1;
  const want = 38 + Math.sqrt(n) * 1.3;
  camD = lerp(camD, state === 'won' ? want * 0.8 : want, 0.04 * dt);
  if (me) camT.lerp(V.set(me.x, 0, me.z), Math.min(1, 0.14 * dt));
  shake = Math.max(0, shake - 0.03 * dt);
  if (state === 'won') endT += s;
  const sx = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake;
  camera.position.set(camT.x + sx + Math.sin(endT * 0.5) * camD * 0.3, camD * 1.0, camT.z + camD * 0.48 + sz);
  camera.lookAt(camT.x, 0, camT.z + 1.5);
  followLight(camT);
});
function c0bump() { crowds[0].bump = 1; }

// ---------------------------------------------------------------- spawn top-up (fresh pedestrians stream in)
setInterval(() => {
  if (state !== 'play') return;
  let free = 0; for (let i = 0; i < N; i++) if (OWN[i] === -1) free++;
  const target = Math.floor((bounds * 2) ** 2 * 0.07);
  for (let k = 0; k < Math.min(25, target - free); k++) { const p = freeSpot(); addPerson(p.x, p.z, -1); }
}, 1000);

buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return crowds[0] ? crowds[0].members.length : 0; },
  bot() {
    if (state !== 'play') return;
    const c = crowds[0]; if (!c || !c.alive) return;
    if (!c.botGoal || Math.hypot(c.botGoal.x - c.x, c.botGoal.z - c.z) < 1.5 || R() < 0.12) { const sm = c.smart; c.smart = 1; c.botGoal = think(c); c.smart = sm; }
    botDir = c.botGoal; tapDir = null;
  },
};

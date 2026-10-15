// Cover Clash — original timing shooter. Hold to pop out and fire, release to duck before the enemy's shot lands.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { flow } from './kit/flow.js';

const S = createStage({ fov: 50, shadowSize: 18 });
const { scene, camera, sun, hemi } = S;
sun.position.set(8, 16, 6); sun.intensity = 1.8; hemi.intensity = 1.15; sun.shadow.mapSize.set(2048, 2048);
scene.add(camera);
const ui = createUI({ title: 'COVER<br>CLASH', hint: 'Hold to shoot · release to hide', hand: '👆', score: false });
const save = store('cclash');
const F = flow('cclash');
let fk = 1;
let level = save.get('level', 1);

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.cc-hud{position:fixed;top:calc(54px + env(safe-area-inset-top));left:12px;right:12px;display:flex;justify-content:space-between;z-index:6;pointer-events:none}
.cc-box{display:flex;align-items:center;gap:8px;background:rgba(20,30,50,.55);border-radius:14px;padding:4px 10px;font-weight:800;font-size:16px}
.cc-hp{width:92px;height:12px;border-radius:7px;background:rgba(255,255,255,.25);overflow:hidden}
.cc-hp i{display:block;height:100%;background:linear-gradient(90deg,#3ddc84,#a6f5c8);transition:width .25s}
.cc-hp.low i{background:linear-gradient(90deg,#ff4d6d,#ffb3c1)}
.cc-banner{position:fixed;left:50%;top:calc(110px + env(safe-area-inset-top));transform:translateX(-50%);z-index:6;pointer-events:none;font-weight:800;font-size:19px;padding:5px 16px;border-radius:10px;background:rgba(20,30,50,.72);white-space:nowrap;transition:opacity .15s;opacity:0}
.cc-banner.on{opacity:1}
.cc-banner.hide{background:#ff3355;font-size:30px;animation:hcpulse .25s infinite}
.cc-cross{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border:3px solid rgba(255,255,255,.9);border-radius:50%;z-index:5;pointer-events:none;opacity:0;transition:opacity .1s;box-shadow:0 0 0 2px rgba(0,0,0,.15)}
.cc-cross::before,.cc-cross::after{content:'';position:absolute;background:#fff;left:50%;top:50%}
.cc-cross::before{width:2px;height:62px;margin:-31px 0 0 -1px}.cc-cross::after{width:62px;height:2px;margin:-1px 0 0 -31px}
.cc-cross.hit{border-color:#ff4d6d}
.cc-wave{position:fixed;left:0;right:0;top:38%;text-align:center;font-weight:800;font-size:52px;z-index:6;pointer-events:none;opacity:0;text-shadow:0 5px 0 rgba(0,0,0,.25)}
.cc-vign{position:fixed;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 120px 40px rgba(255,0,40,.0);transition:box-shadow .2s}
.hc-pop{-webkit-text-stroke:6px #1d2b44;paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(20,30,60,.35)!important}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const hud = H('<div class="cc-hud"><div class="cc-box">🛡️<div class="cc-hp"><i style="width:100%"></i></div></div><div class="cc-box">🎯 <span>0</span></div></div>');
const banner = H('<div class="cc-banner"></div>'), cross = H('<div class="cc-cross"></div>'), waveEl = H('<div class="cc-wave"></div>'), vign = H('<div class="cc-vign"></div>');
const setHP = () => { const el = hud.querySelector('.cc-hp'); el.querySelector('i').style.width = (hp / maxHP * 100) + '%'; el.classList.toggle('low', hp <= 1); };

// ---------------------------------------------------------------- themes
const THEMES = [
  { name: 'beach', sky: ['#4fb3f6', '#d8f3ff'], ground: '#f2d7a0', ground2: '#e8c98d', sea: true, prop: 'palm', barrel: '#ffcc33', cover: '#b9b4ac' },
  { name: 'city', sky: ['#6cc2ff', '#e9f6ff'], ground: '#5b5f6b', ground2: '#6a6e7a', city: true, prop: 'tree', barrel: '#e63946', cover: '#c9c2b8' },
  { name: 'desert', sky: ['#69b9f2', '#fff0d6'], ground: '#e7b77d', ground2: '#dca86a', desert: true, prop: 'cactus', barrel: '#3a86ff', cover: '#c8a27a' },
];
let TH = THEMES[0];

// ---------------------------------------------------------------- shared geometry
const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), sph = new THREE.SphereGeometry(1, 16, 12), cone = new THREE.ConeGeometry(1, 1, 10);
const GEO = {
  palm: merge([...[0, 1, 2, 3, 4, 5].map(i => part(cyl, i % 2 ? '#9a6b3f' : '#8a5d34', { x: i * 0.06, y: 0.5 + i * 0.9, sx: 0.2 - i * 0.012, sz: 0.2 - i * 0.012, sy: 0.92, rz: -0.05 })),
    ...[0, 1, 2, 3, 4, 5, 6].map(i => part(box, i % 2 ? '#3fae5a' : '#2f9a4c', { x: 0.36 + Math.cos(i * 0.9) * 1.1, y: 5.3, z: Math.sin(i * 0.9) * 1.1, ry: -i * 0.9, rz: -0.35, sx: 2.3, sy: 0.08, sz: 0.5 })), part(sph, '#6b4a2b', { x: 0.36, y: 5.2, s: 0.28 })]),
  tree: merge([part(cyl, '#7a5230', { y: 1, sx: 0.16, sz: 0.16, sy: 2 }), part(sph, '#58c26b', { y: 2.6, s: 1.1 }), part(sph, '#4cb35f', { x: 0.5, y: 2.2, s: 0.7 })]),
  cactus: merge([part(new THREE.CapsuleGeometry(0.35, 2.4, 4, 8), '#3fa34d', { y: 1.5 }), part(new THREE.CapsuleGeometry(0.22, 0.8, 4, 8), '#3fa34d', { x: 0.55, y: 1.8 }), part(new THREE.CapsuleGeometry(0.2, 0.7, 4, 8), '#3fa34d', { x: -0.5, y: 2.2 }), part(box, '#3fa34d', { x: 0.35, y: 1.4, sx: 0.4, sy: 0.25, sz: 0.25 }), part(box, '#3fa34d', { x: -0.3, y: 1.9, sx: 0.35, sy: 0.22, sz: 0.22 })]),
  barrel: merge([part(cyl, '#ffffff', { y: 0.55, sx: 0.4, sz: 0.4, sy: 1.1 }), part(cyl, '#2b2d42', { y: 0.3, sx: 0.41, sz: 0.41, sy: 0.06 }), part(cyl, '#2b2d42', { y: 0.8, sx: 0.41, sz: 0.41, sy: 0.06 })]),
  crate: merge([part(rounded(1.7, 1.55, 1.2, 0.06), '#c98e52', { y: 0.78 }), part(box, '#8a5a32', { y: 0.78, z: 0.61, sx: 1.9, sy: 0.14, sz: 0.02, rz: 0.72 }), part(box, '#8a5a32', { y: 0.78, z: 0.61, sx: 1.9, sy: 0.14, sz: 0.02, rz: -0.72 }), part(box, '#a8733f', { y: 1.5, sx: 1.72, sy: 0.08, sz: 1.22 })]),
  sandbags: merge([...[-0.6, 0, 0.6].map(x => part(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), '#c2a46e', { x, y: 0.22, rz: Math.PI / 2 })), ...[-0.3, 0.3].map(x => part(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), '#b8995f', { x, y: 0.6, rz: Math.PI / 2 })), ...[-0.6, 0, 0.6].map(x => part(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), '#c9ad78', { x, y: 0.98, rz: Math.PI / 2 })), ...[-0.3, 0.3].map(x => part(new THREE.CapsuleGeometry(0.22, 0.4, 4, 8), '#b8995f', { x, y: 1.36, rz: Math.PI / 2 }))]),
  car: merge([part(rounded(4, 0.9, 1.9, 0.2), '#e63946', { y: 0.75 }), part(rounded(2.2, 0.75, 1.7, 0.2), '#e63946', { x: -0.2, y: 1.45 }), part(box, '#a8d8ff', { x: -0.2, y: 1.45, sx: 2.25, sy: 0.5, sz: 1.6 }), ...[[-1.3, 1], [1.3, 1], [-1.3, -1], [1.3, -1]].map(([x, z]) => part(cyl, '#222', { x, y: 0.38, z: z * 0.85, rx: Math.PI / 2, sx: 0.38, sz: 0.38, sy: 0.3 }))]),
  building: merge([part(box, '#ffffff', { y: 5, sx: 6, sy: 10, sz: 6 }), ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => part(box, '#7fc4ee', { y: i * 1.15, sx: 6.05, sy: 0.6, sz: 6.05 }))]),
  rock: merge([part(new THREE.DodecahedronGeometry(1, 0), '#c48d5a', { sx: 1.4, sy: 1, sz: 1.2 })]),
};
const BRICK = rounded(0.58, 0.27, 0.42, 0.05);

// ---------------------------------------------------------------- characters (chunky toy soldiers, original)
function soldier({ shirt = '#e8e2d6', pants = '#3d5a80', skin = '#e0ac80', hat = '#2b2d42', gun = '#2b2d42', bandana = null, vest = null } = {}) {
  const g = new THREE.Group(), M = c => mat(c);
  const hips = new THREE.Group(); hips.position.y = 0.95; g.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 14), M(shirt)); body.position.y = 0.38; body.scale.z = 0.8; body.castShadow = true; torso.add(body);
  if (vest) { const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.26, 6, 14), M(vest)); v.position.y = 0.42; v.scale.z = 0.85; v.castShadow = true; torso.add(v); }
  const head = new THREE.Group(); head.position.y = 0.98; torso.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), M(skin)); hm.castShadow = true; head.add(hm);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M('#1d1d28')); e.position.set(s * 0.085, 0.02, 0.215); head.add(e); }
  if (hat) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.255, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M(hat)); h.position.y = 0.04; head.add(h); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, -Math.PI / 2, Math.PI), M(hat)); brim.position.set(0, 0.05, 0.12); head.add(brim); }
  if (bandana) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.05, 6, 20), M(bandana)); b.rotation.x = Math.PI / 2; b.position.y = 0.1; head.add(b); }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.32, 0.66, 0); torso.add(sh);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 4, 8), M(shirt)); a.position.y = -0.26; a.castShadow = true; sh.add(a);
    const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M(skin)); hnd.position.y = -0.52; sh.add(hnd);
    arms.push(sh);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(s * 0.14, 0, 0); hips.add(hp);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), M(pants)); l.position.y = -0.4; l.castShadow = true; hp.add(l);
    const b = new THREE.Mesh(rounded(0.2, 0.14, 0.32, 0.05), M('#3a2d25')); b.position.set(0, -0.82, 0.05); b.castShadow = true; hp.add(b);
    legs.push(hp);
  }
  // rifle held in front
  const rifle = new THREE.Group(); rifle.position.set(0.12, 0.52, 0.3); torso.add(rifle);
  const gm = mat(gun);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), gm); barrel.rotation.x = Math.PI / 2;
  rifle.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.75), gm), barrel);
  rifle.children[1].position.z = 0.55;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.25), mat('#8a5a32')); stock.position.set(0, -0.02, -0.45); rifle.add(stock);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), gm); mag.position.set(0, -0.14, 0.12); mag.rotation.x = 0.2; rifle.add(mag);
  rifle.traverse(o => o.isMesh && (o.castShadow = true));
  const muzzle = new THREE.Object3D(); muzzle.position.z = 0.8; rifle.add(muzzle);
  arms[0].rotation.set(-1.35, 0, 0.35); arms[1].rotation.set(-1.25, 0, -0.25);
  Object.assign(g, { hips, torso, head, arms, legs, rifle, muzzle, mats: [] });
  g.traverse(o => o.isMesh && g.mats.push(o.material));
  return g;
}

// ---------------------------------------------------------------- world
let world = new THREE.Group(); scene.add(world);
const disp = [];
function buildArena() {
  scene.remove(world); disp.forEach(d => d.dispose()); disp.length = 0; world = new THREE.Group(); scene.add(world);
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.sky[0]); document.body.style.setProperty('--bg2', TH.sky[1]); document.body.style.setProperty('--ui', '#ff3355');
  scene.fog = new THREE.Fog(TH.sky[1], 40, 110);
  const gt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = TH.ground; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = Math.random() < 0.5 ? TH.ground2 : 'rgba(255,255,255,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 3); }
    if (TH.city) { g.fillStyle = 'rgba(255,255,255,.75)'; for (let x = 0; x < w; x += 42) g.fillRect(x, 96, 24, 64); }
  }, true); gt.repeat.set(12, 12); disp.push(gt);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.z = -30; ground.receiveShadow = true; world.add(ground);
  const r = rng(level * 31 + 7), inst = {};
  const put = (k, x, z, s = 1, ry = 0, y = 0) => (inst[k] = inst[k] || []).push({ x, y, z, s, ry });
  if (TH.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshStandardMaterial({ color: '#2aa7e0', roughness: 0.15, metalness: 0.1 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, -92); world.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(400, 1.2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.07, -32); world.add(foam); world.userData.foam = foam;
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 1.2, 24), mat('#f2d7a0')); isl.position.set(-14, -0.2, -80); world.add(isl);
    for (let i = 0; i < 10; i++) put('palm', (r() < 0.5 ? -1 : 1) * (9 + r() * 10), -8 - r() * 22, 0.9 + r() * 0.5, r() * 6);
    put('palm', -14, -80, 1.3, 0.5, 0.4); put('palm', -11, -78, 1.0, 2, 0.4);
  }
  if (TH.city) {
    for (let i = 0; i < 9; i++) for (const s of [-1, 1]) put('building', s * (17 + r() * 4), -6 - i * 9, 0.9 + r() * 0.5, 0);
    for (let i = 0; i < 4; i++) put('tree', (r() < 0.5 ? -1 : 1) * (10 + r() * 3), -6 - r() * 26, 0.9 + r() * 0.3, r() * 6);
    put('car', -8, -27, 1, 0.3); put('car', 9, -33, 1, -0.2);
  }
  if (TH.desert) {
    for (let i = 0; i < 12; i++) put(r() < 0.6 ? 'cactus' : 'rock', (r() < 0.5 ? -1 : 1) * (9 + r() * 14), -6 - r() * 40, 0.8 + r() * 1.2, r() * 6);
    for (let i = 0; i < 6; i++) put('rock', (r() - 0.5) * 120, -70 - r() * 20, 6 + r() * 6, r() * 6, -1);
  }
  for (const [k, list] of Object.entries(inst)) {
    const im = new THREE.InstancedMesh(GEO[k], k === 'rock' ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }) : VC, list.length), o = new THREE.Object3D();
    list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.ry, 0); o.scale.setScalar(t.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    if (k === 'building') { const cols = ['#ffffff', '#ffe3c9', '#d9ecff', '#e7ddff', '#ffd6d6']; list.forEach((_, i) => im.setColorAt(i, new THREE.Color(cols[i % cols.length]))); }
    im.castShadow = k !== 'building'; im.receiveShadow = true; world.add(im);
  }
  // player's brick wall (each brick can be knocked off)
  bricks = [];
  for (let row = 0; row < 5; row++) for (let c = 0; c < 6; c++) {
    const b = new THREE.Mesh(BRICK, mat(new THREE.Color(TH.cover).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08)));
    b.position.set(-1.5 + c * 0.6 + (row % 2 ? 0.3 : 0), 0.14 + row * 0.28, -0.95); b.castShadow = b.receiveShadow = true; world.add(b);
    bricks.push({ m: b, home: b.position.clone(), v: null, row });
  }
  for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(GEO.barrel, mat(TH.barrel)); bl.position.set(-2.4 - (i % 2) * 0.5, 0, -0.6 - i * 0.7); bl.castShadow = true; world.add(bl); }
}
let bricks = [];

// ---------------------------------------------------------------- player
const player = soldier({ shirt: '#c0392b', pants: '#4a5a3a', skin: '#e9b48a', hat: null, bandana: '#2b2d42', vest: '#556b2f', gun: '#222' });
player.position.set(0, 0, 0); scene.add(player);
const pack = new THREE.Mesh(rounded(0.42, 0.5, 0.25, 0.08), mat('#6b5a3a')); pack.position.set(0, 0.45, -0.28); player.torso.add(pack);
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff1a8', transparent: true })); muzzleFlash.visible = false; scene.add(muzzleFlash);
const flashLight = new THREE.PointLight('#ffcf6b', 0, 6, 2); scene.add(flashLight);

// ---------------------------------------------------------------- enemies
let enemies = [], waves = [], wave = 0, killed = 0, totalEnemies = 0;
const ENEMY_LOOKS = [{ shirt: '#f2efe9', pants: '#2b2d42', hat: '#e63946', vest: '#3d405b' }, { shirt: '#ffd166', pants: '#3d5a80', hat: '#2b2d42' }, { shirt: '#8ecae6', pants: '#33415c', bandana: '#ff006e', hat: null }, { shirt: '#ffffff', pants: '#6c584c', hat: '#7b5cff', vest: '#2b2d42' }];
const laserMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.0, depthWrite: false });
function spawnWave() {
  const n = waves[wave], r = rng(level * 100 + wave * 7 + 1);
  enemies.forEach(e => scene.remove(e.g, e.cover, e.laser, e.ring)); enemies = [];
  const slots = [];
  for (let i = 0; i < n; i++) slots.push({ x: (i - (n - 1) / 2) * (n > 3 ? 2.9 : 3.6) + (r() - 0.5) * 0.8, z: -10.5 - r() * 4 - (i % 2) * 1.5 });
  slots.forEach((s, i) => {
    const look = ENEMY_LOOKS[(i + wave + level) % ENEMY_LOOKS.length];
    const g = soldier({ ...look, skin: ['#e0ac80', '#c68c5d', '#f1c7a5', '#8d5a3c'][(i + level) % 4] });
    g.position.set(s.x + (r() - 0.5) * 4, 0, s.z - 6); g.rotation.y = Math.atan2(-s.x, -s.z) + Math.PI; scene.add(g);
    const ck = ['crate', 'sandbags', 'crate'][(i + wave) % 3];
    const cover = new THREE.Mesh(GEO[ck], ck === 'crate' ? VC : VC); cover.position.set(s.x, 0, s.z + 0.95); cover.castShadow = cover.receiveShadow = true; scene.add(cover);
    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), laserMat.clone()); laser.visible = false; scene.add(laser);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTex, transparent: true, depthTest: false })); ring.scale.setScalar(0.9); ring.visible = false; scene.add(ring);
    const hpMax = 3 + Math.floor((level - 1) / 2);
    enemies.push({ g, cover, laser, ring, home: new THREE.Vector3(s.x, 0, s.z), st: 'run', t: 0, up: 0, hp: hpMax, hpMax, hide: 0.3 + r() * 1.0 + i * 0.6, aimDur: Math.max(0.52, (1.25 - level * 0.06) / fk), dead: false, rag: null, flash: 0 });
  });
  showWave(`WAVE ${wave + 1}`);
}
const alertTex = canvasTex(128, 128, (g) => { g.fillStyle = '#ff3355'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = '900 78px sans-serif'; g.textAlign = 'center'; g.fillText('!', 64, 92); });
function showWave(t) { waveEl.textContent = t; waveEl.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.1)', offset: 0.25 }, { opacity: 1, transform: 'scale(1)', offset: 0.75 }, { opacity: 0, transform: 'scale(1)' }], { duration: 1200 }); }

// ---------------------------------------------------------------- game state
let state = 'ready', hp = 3, maxHP = 3, holding = false, botHold = false, up = 0, fireT = 0, target = null, slow = 1, slowT = 0, killCam = null, shake = 0, hurtT = 0, winPending = false;
function startLevel() {
  buildArena(); fk = F.k();
  const nw = 2 + Math.floor((level - 1) / 2);
  waves = []; for (let i = 0; i < nw; i++) waves.push(Math.min(5, (level === 1 ? 2 : 2 + Math.floor(level / 2)) + (i === nw - 1 ? 1 : 0)));
  totalEnemies = waves.reduce((a, b) => a + b, 0); wave = 0; killed = 0; hp = maxHP; up = 0; slow = 1; slowT = 0; killCam = null; winPending = false;
  player.rotation.set(0, Math.PI, 0); player.position.set(0, 0, 0); player.visible = true; player.dying = 0;
  ui.levels(level); ui.progress(0); setHP(); hud.querySelector('span').textContent = totalEnemies;
  spawnWave();
}
ui.onTap(w => { if (w === 'win') level++; startLevel(); state = 'play'; });
input({ onDown: () => { holding = true; }, onUp: () => { holding = false; } });
addEventListener('pointercancel', () => holding = false);
addEventListener('keydown', e => { if (e.code === 'Space') holding = true; });
addEventListener('keyup', e => { if (e.code === 'Space') holding = false; });

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const alerp = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); };
const exposed = e => !e.dead && (e.st === 'run' || e.up > 0.45);
const headPos = (g, out) => g.head.getWorldPosition(out);
function tracer(from, to, color = '#ffe08a') {
  const len = from.distanceTo(to), m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(from).lerp(to, 0.5); m.scale.y = len; m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.copy(to).sub(from).normalize());
  scene.add(m); fx.push({ m, life: 1, k: 9 });
}
const fx = [];
function knockBrick(hard = false) {
  const live = bricks.filter(b => !b.v && b.row >= 3); if (!live.length) return;
  const b = live[Math.floor(Math.random() * live.length)];
  b.v = new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 2, 2 + Math.random() * 2); b.spin = (Math.random() - 0.5) * 12; b.t = 0;
  burst(scene, b.m.position.clone(), [TH.cover, '#ffffff', '#d9cfc2'], 10, { speed: 0.08, up: 0.08, size: 0.6 });
}
function shoot() {
  if (!target) return;
  player.muzzle.getWorldPosition(tmp);
  muzzleFlash.position.copy(tmp); muzzleFlash.visible = true; muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.6); flashLight.position.copy(tmp); flashLight.intensity = 6;
  const e = target, head = Math.random() < 0.22;
  const aimAt = head ? headPos(e.g, tmp2) : e.g.torso.getWorldPosition(tmp2).add(new THREE.Vector3(0, 0.35, 0));
  tone(140 + Math.random() * 30, 0.07, 'square', 0.1, 0.4); tone(900, 0.03, 'sawtooth', 0.04, 0.3); buzz(6); shake = Math.max(shake, 0.12);
  player.rifle.position.z = 0.18;
  if (exposed(e)) {
    tracer(tmp.clone(), aimAt.clone());
    const dmg = head ? 2 : 1; e.hp -= dmg; e.flash = 1;
    burst(scene, aimAt.clone(), ['#ffd166', '#ff8c42', '#ffffff'], 8, { speed: 0.07, up: 0.05, size: 0.45, life: 0.6 });
    ui.pop(head ? 'BULLSEYE!' : '-' + dmg * 10, head ? '#ffd166' : '#ffffff', head ? 34 : 24, 30 + Math.random() * 6);
    if (e.hp <= 0) kill(e, aimAt);
  } else {
    // bullet hits their cover: splinters
    const c = e.cover.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.5, 0.6));
    tracer(tmp.clone(), c); burst(scene, c, ['#c98e52', '#e7c39a'], 5, { speed: 0.05, up: 0.04, size: 0.4, life: 0.5 });
  }
}
function kill(e, at) {
  e.dead = true; e.st = 'dead'; killed++; e.laser.visible = false; e.ring.visible = false;
  hud.querySelector('span').textContent = totalEnemies - killed;
  ui.progress(killed / totalEnemies);
  const dir = tmp.copy(e.g.position).sub(player.position).setY(0).normalize();
  e.rag = { v: dir.multiplyScalar(3.2).setY(2.6), w: -6 - Math.random() * 2, rot: 0, y0: e.g.position.y, bounced: false, spinY: (Math.random() - 0.5) * 3 };
  sfx.smash(); buzz([20, 20, 30]); burst(scene, at.clone(), ['#ffd166', '#ff5d5d', '#ffffff'], 18, { speed: 0.12, up: 0.1, size: 0.6 });
  const last = killed === totalEnemies;
  if (last) { slow = 0.14; slowT = 1.5; killCam = e; ui.pop('FINAL HIT!', '#ffd166', 44, 28); winPending = true; }
  else ui.pop(['ELIMINATED!', 'DOWN!', 'NICE SHOT!'][Math.floor(Math.random() * 3)], '#ffffff', 34, 24);
  if (!last && enemies.every(x => x.dead)) setTimeout(() => { if (state === 'play') { wave++; spawnWave(); } }, 1200);
}
function playerHit(e) {
  hp--; setHP(); hurtT = 1; shake = 0.7; ui.flash(0.25); sfx.fail(); buzz([40, 30, 40]);
  vign.style.boxShadow = 'inset 0 0 120px 50px rgba(255,0,40,.55)'; setTimeout(() => vign.style.boxShadow = 'inset 0 0 120px 40px rgba(255,0,40,0)', 250);
  ui.pop('OUCH!', '#ff4d6d', 40, 40);
  if (hp <= 0 && state === 'play') F.level(false, killed / totalEnemies);
  if (hp <= 0) { state = 'lost'; player.dying = 0.001; ui.lose('TAKEN DOWN', `Wave ${wave + 1} · ${killed}/${totalEnemies} cleared — hide when the laser locks!`); }
}

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(1.3, 3.5, 5.0), camLook = new THREE.Vector3(0, 0.3, -11);
loop((dtRaw, t) => {
  const real = dtRaw / 60;
  if (slowT > 0) { slowT -= real; if (slowT <= 0) { slow = 1; if (winPending && state === 'play') { F.level(true); state = 'won'; save.set('level', level + 1); sfx.win(); buzz([20, 40, 20]); confetti(scene, player.position.clone().add(new THREE.Vector3(0, 2.5, -3)), 70); ui.win(level, `All ${totalEnemies} enemies down · ${hp}/${maxHP} armour left`); } } }
  const sec = real * slow;
  const wantUp = state === 'play' && (holding || botHold) && !winPending;
  up = clamp(up + (wantUp ? 8 : -9) * sec, 0, 1);
  // player pose: crouched behind the wall -> standing aiming
  const u = up * up * (3 - 2 * up);
  player.hips.position.y = lerp(0.36, 0.95, u);
  player.legs.forEach((l, i) => { l.rotation.x = lerp(-1.5, 0, u); l.children[0].position.z = 0; });
  player.legs[0].rotation.x = lerp(-1.45, -0.1, u); player.legs[1].rotation.x = lerp(0.2, 0.15, u);
  player.torso.rotation.x = lerp(0.42, 0, u);
  // target: nearest exposed enemy (prefer the one aiming at us)
  target = null; let best = 1e9;
  for (const e of enemies) { if (!exposed(e)) continue; const d = e.g.position.distanceTo(player.position) - (e.st === 'aim' ? 20 : 0); if (d < best) { best = d; target = e; } }
  if (!target) { const alive = enemies.filter(e => !e.dead); if (alive.length) target = alive.reduce((a, b) => a.g.position.z > b.g.position.z ? a : b); }
  if (target) { const yaw = Math.atan2(target.g.position.x - player.position.x, target.g.position.z - player.position.z); player.rotation.y = alerp(player.rotation.y, yaw, 0.25 * dtRaw); }
  player.rifle.position.z = lerp(player.rifle.position.z, 0.3, 0.3);
  fireT -= sec;
  if (state === 'play' && up > 0.85 && target && fireT <= 0 && !target.dead) { fireT = 0.15; shoot(); }
  muzzleFlash.visible = muzzleFlash.visible && Math.random() < 0.5; flashLight.intensity *= 0.6;
  // crosshair over the target while popped out
  if (target && up > 0.5 && state === 'play') { headPos(target.g, tmp).project(camera); cross.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; cross.style.top = ((1 - tmp.y) / 2 * innerHeight + 18) + 'px'; cross.style.opacity = 1; cross.classList.toggle('hit', exposed(target)); }
  else cross.style.opacity = 0;
  // enemies
  let aimingAtMe = null;
  const aimers = enemies.filter(e => e.st === 'aim' && !e.dead).length;
  for (const e of enemies) {
    const g = e.g;
    if (e.dead) {
      const R = e.rag; if (!R) continue;
      R.v.y -= 16 * sec; g.position.addScaledVector(R.v, sec); R.rot = Math.max(-Math.PI / 2 - 0.05, R.rot + R.w * sec);
      g.rotation.x = R.rot; g.rotation.y += R.spinY * sec;
      g.arms[0].rotation.x = lerp(g.arms[0].rotation.x, -2.8, 0.1); g.arms[1].rotation.x = lerp(g.arms[1].rotation.x, -2.4, 0.1); g.legs[0].rotation.x = lerp(g.legs[0].rotation.x, 0.6, 0.1);
      if (g.position.y < 0.25) { g.position.y = 0.25; if (!R.bounced) { R.bounced = true; R.v.y = 2.2; R.v.x *= 0.4; R.v.z *= 0.4; R.w *= 0.3; burst(scene, g.position.clone(), [TH.ground, TH.ground2], 10, { speed: 0.06, up: 0.05, size: 0.6 }); tone(80, 0.12, 'sine', 0.12, 0.5); } else { R.v.set(0, 0, 0); R.w = 0; R.spinY *= 0.8; } }
      continue;
    }
    e.t += sec; e.flash = Math.max(0, e.flash - sec * 6);
    g.mats.forEach(m => m.emissive && m.emissive.setRGB(e.flash, e.flash, e.flash));
    if (e.st === 'run') {
      tmp.copy(e.home).sub(g.position).setY(0); const d = tmp.length();
      if (d < 0.15 || state !== 'play') { e.st = 'hide'; e.t = 0; }
      else { g.position.addScaledVector(tmp.normalize(), Math.min(d, 5.5 * sec)); g.rotation.y = Math.atan2(tmp.x, tmp.z); const w = t * 14; g.legs[0].rotation.x = Math.sin(w) * 0.8; g.legs[1].rotation.x = -Math.sin(w) * 0.8; g.hips.position.y = 0.95 + Math.abs(Math.sin(w)) * 0.06; }
      continue;
    }
    // face the player
    g.rotation.y = alerp(g.rotation.y, Math.atan2(player.position.x - g.position.x, player.position.z - g.position.z), 0.2);
    const goUp = e.st === 'peek' || e.st === 'aim' || e.st === 'fire';
    e.up = clamp(e.up + (goUp ? 7 : -7) * sec, 0, 1);
    const eu = e.up * e.up * (3 - 2 * e.up);
    g.hips.position.y = lerp(0.25, 0.95, eu); g.legs[0].rotation.x = lerp(-1.7, 0, eu); g.legs[1].rotation.x = lerp(-1.5, 0, eu); g.torso.rotation.x = lerp(0.5, 0, eu);
    if (state !== 'play') { if (e.st !== 'hide') { e.st = 'hide'; e.t = 0; } e.laser.visible = false; e.ring.visible = false; continue; }
    if (e.st === 'hide' && e.t > e.hide && (aimers < (level >= 3 ? 2 : 1))) { e.st = 'peek'; e.t = 0; }
    else if (e.st === 'peek' && e.t > 0.35) { e.st = 'aim'; e.t = 0; tone(600, 0.08, 'square', 0.05, 1.5); }
    else if (e.st === 'aim') {
      const k = e.t / e.aimDur;
      // telegraph: laser grows bright, alert ring pulses
      e.g.muzzle.getWorldPosition(tmp); headPos(player, tmp2); tmp2.y -= 0.2;
      e.laser.visible = true; e.laser.position.copy(tmp).lerp(tmp2, 0.5); e.laser.scale.y = tmp.distanceTo(tmp2); e.laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp2.clone().sub(tmp).normalize());
      e.laser.material.opacity = 0.25 + k * 0.6 + (k > 0.7 ? Math.sin(t * 50) * 0.2 : 0); e.laser.scale.x = e.laser.scale.z = 1 + k * 1.5;
      headPos(g, e.ring.position); e.ring.position.y += 0.75; e.ring.visible = true; e.ring.scale.setScalar(0.7 + Math.sin(t * 20) * 0.08 + k * 0.3);
      if (!aimingAtMe || k > aimingAtMe.k) aimingAtMe = { e, k };
      if (k > 0.55 && Math.floor(e.t * 12) !== Math.floor((e.t - sec) * 12)) tone(1200, 0.03, 'square', 0.04, 1);
      if (e.t >= e.aimDur) {
        e.st = 'fire'; e.t = 0; e.laser.visible = false; e.ring.visible = false;
        e.g.muzzle.getWorldPosition(tmp); tone(200, 0.1, 'square', 0.1, 0.4);
        if (up > 0.35) { headPos(player, tmp2); tracer(tmp.clone(), tmp2.clone(), '#ff6b6b'); playerHit(e); }
        else { tmp2.set((Math.random() - 0.5) * 2, 0.9, -0.9); tracer(tmp.clone(), tmp2.clone(), '#ff6b6b'); knockBrick(); shake = 0.25; ui.pop('BLOCKED!', '#ffffff', 26, 46); }
      }
    } else if (e.st === 'fire' && e.t > 0.3) { e.st = 'hide'; e.t = 0; e.hide = 0.5 + Math.random() * 1.6 - Math.min(0.4, level * 0.04); }
    if (e.st !== 'aim') { e.laser.visible = false; e.ring.visible = false; }
  }
  // banner
  if (state === 'play' && aimingAtMe) { const late = aimingAtMe.k > 0.62 && up > 0.3; banner.textContent = late ? 'HIDE!' : 'ENEMY IS SHOOTING!'; banner.classList.add('on'); banner.classList.toggle('hide', late); }
  else banner.classList.remove('on', 'hide');
  // falling bricks
  for (const b of bricks) if (b.v) { b.t += sec; b.v.y -= 14 * sec; b.m.position.addScaledVector(b.v, sec); b.m.rotation.x += b.spin * sec; if (b.m.position.y < 0.13) { b.m.position.y = 0.13; b.v.multiplyScalar(0.4); b.v.y = Math.abs(b.v.y) > 1 ? -b.v.y * 0.3 : 0; b.spin *= 0.5; } }
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= sec * f.k; f.m.material.opacity = Math.max(0, f.life); if (f.life <= 0) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); } }
  // player death
  if (player.dying) { player.dying += sec; player.rotation.x = Math.min(Math.PI / 2, player.dying * 4); player.position.z = Math.min(0.9, player.dying * 2); }
  // foam waves
  if (world.userData.foam) world.userData.foam.position.z = -32 + Math.sin(t * 0.8) * 0.6;
  // camera: over-the-shoulder; leans in while aiming; kill-cam on the final kill
  shake = Math.max(0, shake - real * 2.5);
  let cp, cl;
  if (killCam && slowT > 0) { const p = killCam.g.position, sd = killCam.home.x > 0 ? 1 : -1; cp = tmp.set(killCam.home.x + sd * 7.5, 2.6, killCam.home.z + 2.5); cl = tmp2.set(p.x, 0.9, p.z - 0.3); }
  else { cp = tmp.set(lerp(1.3, 1.05, u), lerp(3.5, 3.4, u), lerp(5.0, 4.0, u)); cl = tmp2.set(target ? target.g.position.x * 0.45 : 0, 0.3, target ? target.g.position.z * 0.85 : -11); }
  camPos.lerp(cp, 1 - Math.pow(0.002, real)); camLook.lerp(cl, 1 - Math.pow(0.004, real));
  camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3, 0));
  camera.lookAt(camLook);
  const baseF = camera.aspect < 0.7 ? 54 : 46;
  camera.fov = lerp(camera.fov, baseF - u * 8 - (killCam && slowT > 0 ? 4 : 0), 0.15); camera.updateProjectionMatrix();
  S.followLight(new THREE.Vector3(0, 0, -9));
});

startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return killed; },
  bot() {
    if (state !== 'play') { botHold = false; return; }
    const danger = enemies.some(e => !e.dead && e.st === 'aim' && e.aimDur - e.t < 0.5);
    const shootable = enemies.some(e => exposed(e) && e.st !== 'run');
    botHold = !danger && shootable;
  },
};

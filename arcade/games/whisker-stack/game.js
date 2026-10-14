// Whisker Stack — original triple-tile puzzle. Tap a free tile to send it to the 7-slot tray; three alike clear.
// Fill the tray and you lose, clear the stack and you win. A kitten watches every move.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { makeCat } from './cat.js';
import { ICONS, iconCanvas } from './icons.js';

const S = createStage({ fov: 34, shadowSize: 9 });
const { scene, camera, sun, hemi, renderer } = S;
S.autoRender = false;
sun.position.set(-4, 16, 9); sun.intensity = 1.35; hemi.intensity = 1.35; sun.shadow.bias = -0.0006; sun.shadow.mapSize.set(2048, 2048);
const ui = createUI({ title: 'WHISKER<br>STACK', hint: 'Tap tiles · match 3 alike', hand: '👆', score: false });
const save = store('whiskerstack');
let level = save.get('level', 1);

const TW = 1.0, TD = 1.2, TH = 0.36, SLOTS = 7, SP = 0.84, TRAY_S = 0.78;
let TZ = 4.75;
document.body.style.setProperty('--bg1', '#ffe1ea'); document.body.style.setProperty('--bg2', '#ffe8cf'); document.body.style.setProperty('--ui', '#ff6f9f');

// ---------------------------------------------------------------- room: parquet floor, rug, tray shelf
const floorTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#f2d2b0'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#ecc8a2' : '#f6dcbf'; g.fillRect(j * 128 + ((i % 2) * 64), i * 32, 128, 31); g.fillStyle = 'rgba(140,90,50,.25)'; g.fillRect(j * 128 + ((i % 2) * 64), i * 32 + 31, 128, 1.5); g.fillRect(j * 128 + ((i % 2) * 64), i * 32, 1.5, 32); }
}, true);
floorTex.repeat.set(8, 8);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.08; floor.receiveShadow = true; scene.add(floor);
const rugTex = canvasTex(512, 640, (g, w, h) => {
  g.fillStyle = '#b9e6dc'; g.beginPath(); g.roundRect(0, 0, w, h, 60); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.beginPath(); g.roundRect(22, 22, w - 44, h - 44, 44); g.stroke();
  g.strokeStyle = '#8fd3c4'; g.lineWidth = 5; g.beginPath(); g.roundRect(40, 40, w - 80, h - 80, 32); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let x = 80; x < w - 40; x += 70) for (let y = 80; y < h - 40; y += 70) { g.save(); g.translate(x, y); g.beginPath(); g.ellipse(0, 6, 10, 8, 0, 0, 7); g.fill(); for (const [a, b] of [[-10, -8], [-3, -13], [4, -13], [11, -8]]) { g.beginPath(); g.ellipse(a, b, 4, 5, 0, 0, 7); g.fill(); } g.restore(); }
});
const rug = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 11.5), new THREE.MeshStandardMaterial({ map: rugTex, transparent: true, roughness: 0.95 }));
rug.rotation.x = -Math.PI / 2; rug.position.set(0, -0.05, -1.25); rug.receiveShadow = true; scene.add(rug);
function rr(w, d, r) { const s = new THREE.Shape(), x = -w / 2, y = -d / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function slab(w, d, h, r, bev = 0.06) { const g = new THREE.ExtrudeGeometry(rr(w - bev * 2, d - bev * 2, Math.max(0.02, r - bev)), { depth: h - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 }); g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); return g; }
const trayParts = [part(slab(6.45, 1.55, 0.34, 0.45, 0.1), '#b97845'), part(slab(6.15, 1.28, 0.36, 0.36, 0.08), '#ffe9cf', { y: 0.0 })];
for (let i = 0; i < SLOTS; i++) trayParts.push(part(slab(0.78, 0.98, 0.05, 0.14, 0.02), '#f3d3ae', { x: (i - 3) * SP, y: 0.34 }));
const tray = new THREE.Mesh(merge(trayParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
tray.position.set(0, -0.05, TZ); tray.receiveShadow = true; tray.castShadow = true; scene.add(tray);
const warn = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.75), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (g, w, h) => { g.strokeStyle = '#ff3355'; g.lineWidth = 10; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 22); g.stroke(); }), transparent: true, opacity: 0, depthWrite: false }));
warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.33, TZ); scene.add(warn);

// ---------------------------------------------------------------- tiles (instanced)
const CAP = 170;
const tileGeo = merge([
  part(slab(TW * 0.96, TD * 0.96, 0.16, 0.2, 0.05), '#7fcfb6'),
  part(slab(TW * 0.96, TD * 0.96, 0.24, 0.2, 0.07), '#fffaf0', { y: 0.12 }),
]);
const body = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.02 }), CAP);
body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false; body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(body);
body.setColorAt(0, new THREE.Color('#fff'));
const iconGeo = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2).translate(0, TH + 0.003, 0);
const iconMeshes = ICONS.map((_, i) => {
  const tex = new THREE.CanvasTexture(iconCanvas(i, 128)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.InstancedMesh(iconGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 }), 60);
  m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color('#fff')); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m;
});
const rings = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 36), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); rings.push({ m, t: 1 }); }
let ringI = 0; function shock(x, y, z, s = 1, c = '#ffffff') { const r = rings[ringI++ % rings.length]; r.t = 0; r.s = s; r.m.material.color.set(c); r.m.position.set(x, y, z); r.m.visible = true; }

// ---------------------------------------------------------------- kitten (overlay, ortho px units)
const ov = new THREE.Scene(), ocam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
ov.add(new THREE.HemisphereLight(0xffffff, 0xffe0c8, 1.3)); { const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(-200, 400, 600); ov.add(d); }
const kitty = makeCat({ fur: '#fffaf4', stripe: '#ffc9a0', belly: '#ffffff', iris: '#2a4f9a', eyeRing: '#3d78d8', hat: 'bow', bowColor: '#ff6f9f', collar: '#ff6f9f', tailTip: '#ffc9a0', inner: '#ffb3c8' });
kitty.rotation.x = 0.1; ov.add(kitty);
const cushion = new THREE.Mesh(merge([part(new THREE.SphereGeometry(1, 24, 12), '#ff8fb5', { sx: 1, sy: 0.32, sz: 0.7 }), part(new THREE.TorusGeometry(0.85, 0.12, 8, 30), '#ffd23f', { y: 0.06, rx: Math.PI / 2, sz: 0.7 })]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
ov.add(cushion);

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.ws-left{position:fixed;top:calc(60px + env(safe-area-inset-top));right:14px;z-index:6;background:#fff;color:#ff5d8f;border-radius:16px;padding:2px 12px;font-weight:800;font-size:18px;box-shadow:0 4px 0 rgba(200,60,110,.25);pointer-events:none}
.ws-streak{position:fixed;top:calc(60px + env(safe-area-inset-top));left:14px;z-index:6;background:#ff6f9f;color:#fff;border-radius:16px;padding:2px 12px;font-weight:800;font-size:18px;box-shadow:0 4px 0 rgba(160,30,80,.3);pointer-events:none;transition:transform .15s}
.hc-pop{-webkit-text-stroke:7px #d0306f;paint-order:stroke fill}
.hc-card h1{-webkit-text-stroke:9px #e0457f;paint-order:stroke fill;text-shadow:0 6px 0 rgba(150,30,80,.3)!important}
.hc-card p,.hc-card .hint{-webkit-text-stroke:5px #e0457f;paint-order:stroke fill}
`; document.head.appendChild(css);
const leftEl = document.createElement('div'); leftEl.className = 'ws-left'; document.body.appendChild(leftEl);
const streakEl = document.createElement('div'); streakEl.className = 'ws-streak'; document.body.appendChild(streakEl);
ui.els.start.style.background = 'radial-gradient(circle at 50% 45%,rgba(120,40,80,.08),rgba(120,40,80,.38))';

// ---------------------------------------------------------------- level
let state = 'ready', tiles = [], trayL = [], total = 0, cleared = 0, shake = 0, streak = 0, streakT = 0, score = 0, busyT = 0;
function genLevel() {
  const r = rng(level * 4099 + 13);
  const layers = Math.min(4, 2 + Math.floor(level / 4)), c0 = Math.min(7, 5 + Math.floor(level / 4)), r0 = Math.min(7, 4 + Math.floor(level / 3));
  const nTypes = Math.min(ICONS.length, 5 + Math.floor(level * 0.8)), K = level <= 3 ? 2 : 3;
  const pos = [];
  for (let L = 0; L < layers; L++) {
    const cols = Math.max(1, c0 - L), rows = Math.max(1, r0 - L);
    const top = L === layers - 1 && L > 0;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const mi = Math.min(i, cols - 1 - i), corner = (i === 0 || i === cols - 1) && (j === 0 || j === rows - 1);
      if (L === 0 && corner && level > 2 && r() < 0.5) continue;
      if (top && ((mi * 7 + j * 3 + level) % 4 === 0)) continue;   // symmetric holes on the top layer
      pos.push({ x: (i - (cols - 1) / 2) * TW, z: (j - (rows - 1) / 2) * TD - 1.25, layer: L });
    }
  }
  // trim to a multiple of 3 (remove from the top layer, keep symmetry roughly)
  while (pos.length % 3) { const topL = Math.max(...pos.map(p => p.layer)); const cand = pos.filter(p => p.layer === topL).sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || Math.abs(a.z + 1.25) - Math.abs(b.z + 1.25)); pos.splice(pos.indexOf(cand[0]), 1); }
  tiles = pos.map((p, i) => ({ i, x: p.x, z: p.z, layer: p.layer, y: p.layer * TH, type: 0, st: 'board', px: p.x, py: p.layer * TH + 0.9 + p.layer * 0.35, delay: p.layer * 0.12 + Math.random() * 0.25, op: 0, pz: p.z, vy: 0, dim: 0, sc: 1, rot: 0, t: 0, wob: 0, land: 0, drop: true }));
  // removal order simulation → triples assigned along it, K types interleaved per window (always solvable)
  const gone = new Set(), order = [];
  while (order.length < tiles.length) { const free = tiles.filter(t => !gone.has(t.i) && !coveredBy(t, gone)); const t = free[Math.floor(r() * free.length)]; order.push(t); gone.add(t.i); }
  const typeBag = []; for (let i = 0; i < nTypes; i++) typeBag.push(i);
  for (let i = typeBag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [typeBag[i], typeBag[j]] = [typeBag[j], typeBag[i]]; }
  let tb = 0;
  for (let s = 0; s < order.length; s += 3 * K) {
    const chunk = order.slice(s, s + 3 * K), labels = [];
    for (let k = 0; k < chunk.length / 3; k++) { const ty = typeBag[tb++ % typeBag.length]; labels.push(ty, ty, ty); }
    for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [labels[i], labels[j]] = [labels[j], labels[i]]; }
    chunk.forEach((t, i) => t.type = labels[i]);
  }
  fitBox(); layout();
  trayL = []; total = tiles.length; cleared = 0; streak = 0; streakT = 0; score = 0;
  ui.levels(level); ui.progress(0); updateHud(); kitty.reset();
  for (const t of tiles) t.dim = coveredBy(t) ? 1 : 0;
}
function coveredBy(t, gone) { for (const o of tiles) { if (o === t || o.layer <= t.layer) continue; if (gone ? gone.has(o.i) : o.st !== 'board') continue; if (Math.abs(o.x - t.x) < TW * 0.98 && Math.abs(o.z - t.z) < TD * 0.98) return true; } return false; }
function updateHud() { const left = tiles.filter(t => t.st === 'board').length; leftEl.textContent = `🐾 ${left}`; streakEl.textContent = streak > 1 ? `combo x${streak}` : `Lv ${level}`; ui.progress(cleared / Math.max(1, total)); }

// ---------------------------------------------------------------- tray logic
const slotX = i => (i - 3) * SP;
const active = () => trayL.filter(t => t.st !== 'clear' && !t.clearing);
function pick(t) {
  if (state !== 'play' || !t || t.st !== 'board' || t.drop) return false;
  if (coveredBy(t)) { t.wob = 1; tone(200, 0.07, 'square', 0.05); buzz(8); return false; }
  if (trayL.length >= SLOTS) return false;
  // insert next to tiles of the same type
  let idx = trayL.length; for (let i = trayL.length - 1; i >= 0; i--) if (trayL[i].type === t.type) { idx = i + 1; break; }
  trayL.splice(idx, 0, t);
  t.st = 'fly'; t.t = 0; t.from = { x: t.px, y: t.py, z: t.pz };
  sfx.pick(Math.min(6, active().length)); buzz(8);
  const same = trayL.filter(o => o.type === t.type && !o.clearing && o.st !== 'clear');
  if (same.length >= 3) {
    const trio = same.slice(0, 3); trio.forEach(o => { o.st = o === t ? 'fly' : o.st; o.clearing = true; }); t.clearing = true;
    t.trio = trio;
  } else if (active().length >= SLOTS) { lose(); }
  updateHud();
  return true;
}
function resolveTrio(trio) {
  // called when the last of a trio has landed
  trio.forEach(o => { o.st = 'clear'; o.t = 0; });
  const mid = trio[1];
  setTimeout(() => {
    trayL = trayL.filter(o => !trio.includes(o));
    cleared += 3; score += 30 * Math.max(1, streak); updateHud();
    const p = new THREE.Vector3(mid.px, 0.6, mid.pz);
    burst(scene, p, ['#ffffff', '#ffd23f', '#ff8fb5', '#8fe3ff'], 22, { speed: 0.13, up: 0.13, size: 0.5, shape: 'sphere' });
    shock(p.x, 0.45, p.z, 1.6, '#ffd23f');
    streak = streakT > 0 ? streak + 1 : 1; streakT = 3.2;
    const base = 72 + Math.min(streak, 6) * 2; [0, 4, 7, 12].forEach((d, i) => setTimeout(() => note(base + d, 0.25, 0.12), i * 45));
    buzz(18); shake = 0.25; kitty.cheer(Math.min(1, 0.4 + streak * 0.2));
    if (streak >= 2) ui.pop(['', '', 'Purr-fect!', 'Meow-gical!', 'Paw-some!', 'Clawsome!', 'Whisker-tastic!'][Math.min(streak, 6)], ['#fff', '#ffe066', '#9dffcf', '#ffb3e0'][streak % 4], 34 + Math.min(streak, 6) * 3, 22);
    if (tiles.every(o => o.st === 'gone' || o.st === 'clear') && active().length === 0) win();
  }, 260);
}
function win() {
  if (state !== 'play') return;
  state = 'won'; save.set('level', level + 1); sfx.win(); buzz([20, 40, 20]); ui.flash(0.5); kitty.party(true);
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3((i - 1) * 2.5, 3, 0), 70), i * 170);
  ui.win(level, `${total} tiles cleared!`);
}
function lose() {
  state = 'lost'; sfx.fail(); buzz([40, 30, 60]); shake = 0.6; kitty.sad(); warnT = 1;
  ui.lose('TRAY FULL!', `${total - cleared} tiles to go — plan your triples!`);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({ onTap: e => {
  if (state !== 'play') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); body.boundingSphere = null;
  const hits = ray.intersectObject(body, false).filter(h => h.instanceId < tiles.length && tiles[h.instanceId].st === 'board');
  if (!hits.length) return;
  pick(tiles[hits[0].instanceId]);
} });
ui.onTap(w => { if (w === 'win') level++; genLevel(); state = 'play'; });

// ---------------------------------------------------------------- camera fit
let camD = 20, TILT = 0.36, offY = 0, kittyRect = { x: 0, y: 0, s: 40 };
let box = [];
let BX = null;
function fitBox(gap = 1.25) {
  let x0 = -3.3, x1 = 3.3, z0 = 1e9, z1 = -1e9;
  for (const t of tiles) { x0 = Math.min(x0, t.x - 0.6); x1 = Math.max(x1, t.x + 0.6); z0 = Math.min(z0, t.z - 0.7); z1 = Math.max(z1, t.z + 0.7); }
  const maxY = Math.max(0, ...tiles.map(t => t.y)) + TH + 0.3;
  BX = { x0, x1, z0, z1 }; TZ = z1 + gap; tray.position.z = TZ; warn.position.z = TZ;
  rug.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2); rug.scale.set((x1 - x0 + 1.0) / 9.2, (z1 - z0 + 1.1) / 11.5, 1);
  box = []; for (const x of [x0, x1]) for (const z of [z0 - 0.3, TZ + 0.85]) for (const y of [0, maxY]) box.push(new THREE.Vector3(x, y, z));
}
function placeCam(d) { camera.position.set(0, d * Math.cos(TILT), d * Math.sin(TILT) + 0.2); camera.lookAt(0, 0, 0.2); camera.updateMatrixWorld(); }
function bounds() { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of box) { const v = p.clone().project(camera); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); } return { x0, x1, y0, y1 }; }
function layout() {
  const W = innerWidth, H = innerHeight, topRes = Math.min(190, H * 0.2), botRes = 14;
  camera.fov = 34; camera.aspect = W / H; camera.clearViewOffset(); camera.updateProjectionMatrix();
  const fit = () => { let lo = 5, hi = 120; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; placeCam(m); const b = bounds(); if (b.x1 - b.x0 <= W * 0.98 && b.y1 - b.y0 <= H - topRes - botRes) hi = m; else lo = m; } camD = hi; placeCam(camD); return bounds(); };
  if (BX) fitBox(1.25);
  let b = fit();
  const spare = (H - topRes - botRes) - (b.y1 - b.y0);
  if (BX && spare > 40) { const upp = (BX.z1 + 2.1 - BX.z0) / (b.y1 - b.y0); fitBox(1.25 + Math.min(4, spare * 0.7 * upp)); b = fit(); }
  offY = (b.y0 + b.y1) / 2 - (topRes + (H - botRes)) / 2;
  camera.setViewOffset(W, H, 0, offY, W, H); camera.updateProjectionMatrix();
  ocam.left = 0; ocam.right = W; ocam.top = 0; ocam.bottom = -H; ocam.updateProjectionMatrix();
  const s = Math.min(38, topRes * 0.22), ky = Math.max(topRes - 6, 150);
  kitty.position.set(W / 2, -ky + s * 0.25, 0); kitty.scale.setScalar(s);
  cushion.position.set(W / 2, -ky + s * 0.18, -200); cushion.scale.set(s * 1.1, s * 1.1, s * 1.1);
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- loop
const D = new THREE.Object3D(), DIM = new THREE.Color('#9a93b4'), DIMI = new THREE.Color('#aaa5bf'), WHITE = new THREE.Color('#ffffff'), C = new THREE.Color();
let warnT = 0;
loop((dt, T) => {
  const sec = dt / 60;
  streakT = Math.max(0, streakT - sec); if (streakT === 0 && streak) { streak = 0; updateHud(); }
  const counts = iconMeshes.map(() => 0);
  let anyBoard = false;
  for (const t of tiles) {
    let x = t.px, y = t.py, z = t.pz, s = 1, ry = 0, rz = 0;
    if (t.st === 'board') {
      anyBoard = true;
      if (t.drop) { if (t.delay > 0) { t.delay -= sec; } else { t.vy -= 0.012 * dt; t.py += t.vy * dt; if (t.py <= t.y) { t.py = t.y; t.vy = 0; t.drop = false; t.land = 1; } } }
      t.px = t.x; t.pz = t.z; x = t.px; y = t.py; z = t.pz;
      if (t.drop) s = t.delay > 0 ? 0.001 : Math.min(1, 1.15 - (t.py - t.y) * 0.3);
      const tgt = coveredBy(t) ? 1 : 0; t.dim = lerp(t.dim, tgt, Math.min(1, 0.18 * dt));
      if (t.wob > 0) { t.wob = Math.max(0, t.wob - sec * 3); x += Math.sin(t.wob * 30) * 0.07 * t.wob; }
    } else if (t.st === 'fly' || t.st === 'tray') {
      const i = trayL.indexOf(t), tx = slotX(Math.max(0, i)), tz = TZ, ty = 0.3;
      if (t.st === 'fly') {
        t.t = Math.min(1, t.t + sec * 3.4); const k = t.t, e = 1 - Math.pow(1 - k, 3);
        t.px = lerp(t.from.x, tx, e); t.pz = lerp(t.from.z, tz, e); t.py = lerp(t.from.y, ty, e) + Math.sin(k * Math.PI) * 1.6;
        s = lerp(1.12, TRAY_S, e); rz = Math.sin(k * Math.PI) * 0.35;
        if (k >= 1) {
          t.st = 'tray'; t.land = 1; tone(420 + i * 30, 0.05, 'sine', 0.08, 0.8);
          if (t.trio) { const trio = t.trio; t.trio = null; if (trio.every(o => o.st === 'tray')) resolveTrio(trio); else trio.forEach(o => { if (o.st === 'fly') o.trio = trio; }); }
        }
      } else { t.px = lerp(t.px, tx, Math.min(1, 0.3 * dt)); t.pz = tz; t.py = ty; s = TRAY_S; }
      t.dim = lerp(t.dim, 0, 0.3);
      x = t.px; y = t.py; z = t.pz;
    } else if (t.st === 'clear') {
      t.t += sec * 4; const mid = t.trioMid || t;
      const trio = trayL.filter(o => o.st === 'clear' && o.type === t.type);
      const m = trio[1] || t;
      t.px = lerp(t.px, m.px, Math.min(1, 0.25 * dt)); t.py = 0.3 + Math.sin(Math.min(1, t.t) * Math.PI) * 0.5;
      x = t.px; y = t.py; z = t.pz; s = TRAY_S * (t.t < 0.6 ? 1 + t.t * 0.4 : Math.max(0, 1.24 * (1 - (t.t - 0.6) / 0.5)));
      if (t.t > 1.1) { t.st = 'gone'; }
    } else continue;
    if (t.st === 'gone') continue;
    if (t.land > 0) { t.land = Math.max(0, t.land - sec * 5); const q = Math.sin(t.land * Math.PI) * t.land; s *= 1; D.scale.set(s * (1 + q * 0.12), s * (1 - q * 0.25), s * (1 + q * 0.12)); } else D.scale.setScalar(s);
    D.position.set(x, y, z); D.rotation.set(0, ry, rz); D.updateMatrix();
    body.setMatrixAt(t.i, D.matrix); C.copy(WHITE).lerp(DIM, t.dim); body.setColorAt(t.i, C);
    const im = iconMeshes[t.type], k = counts[t.type]++; im.setMatrixAt(k, D.matrix); C.copy(WHITE).lerp(DIMI, t.dim); im.setColorAt(k, C);
  }
  // hide unused body instances
  D.scale.setScalar(0); D.updateMatrix(); for (const t of tiles) if (t.st === 'gone') body.setMatrixAt(t.i, D.matrix);
  body.count = tiles.length; body.instanceMatrix.needsUpdate = true; body.instanceColor.needsUpdate = true;
  iconMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  // tray danger glow
  const n = active().length; warnT = Math.max(warnT - sec, 0);
  warn.material.opacity = state === 'play' && n >= SLOTS - 2 ? 0.45 + Math.sin(T * 10) * 0.35 : warnT > 0 ? warnT : 0;
  for (const r of rings) if (r.m.visible) { r.t += sec * 3; r.m.scale.setScalar(r.s * (0.3 + r.t)); r.m.material.opacity = Math.max(0, 0.8 * (1 - r.t)); if (r.t >= 1) r.m.visible = false; }
  shake = Math.max(0, shake - sec * 2);
  placeCam(camD); if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.3; camera.position.z += (Math.random() - 0.5) * shake * 0.3; }
  kitty.update(dt, T);
  renderer.autoClear = true; renderer.render(scene, camera);
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(ov, ocam); renderer.autoClear = true;
});

// ---------------------------------------------------------------- boot + test hooks
genLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (trayL.length >= SLOTS) return;
    const free = tiles.filter(t => t.st === 'board' && !t.drop && !coveredBy(t)); if (!free.length) return;
    const inTray = {}; for (const t of active()) inTray[t.type] = (inTray[t.type] || 0) + 1;
    const freeBy = {}; for (const t of free) freeBy[t.type] = (freeBy[t.type] || 0) + 1;
    const room = SLOTS - active().length;
    let best = null, bs = -1e9;
    for (const t of free) {
      const have = inTray[t.type] || 0, need = 3 - have, can = freeBy[t.type] >= need;
      let s = have * 10 + (can ? 20 : 0) - (need > room ? 100 : 0);
      s += tiles.filter(o => o.st === 'board' && o.layer < t.layer && Math.abs(o.x - t.x) < TW && Math.abs(o.z - t.z) < TD).length * 2;   // uncovers more
      s += t.layer;
      if (s > bs) { bs = s; best = t; }
    }
    pick(best);
  },
};

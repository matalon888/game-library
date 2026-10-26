// Skyline Scope — original rooftop sniper. Hold to scope in, drag to aim, release to fire. Take down the marked targets, spare the civilians.
import { THREE, createStage, createUI, input, loop, mat, glossy, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { flow } from './kit/flow.js';
import { demo } from './kit/demo.js';
import { board } from './kit/board.js';

const S = createStage({ fov: 62, shadowSize: 90 });
const { scene, camera, sun, hemi } = S;
camera.far = 700; camera.updateProjectionMatrix();
sun.intensity = 1.9; hemi.intensity = 1.05; sun.shadow.camera.far = 260; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05; sun.shadow.camera.updateProjectionMatrix();
scene.add(camera);
const ui = createUI({ title: 'SKYLINE<br>SCOPE', hint: 'Tap a red cap to shoot · or hold, aim, release', hand: '🎯', score: false });
const save = store('skyscope');
let level = save.get('level', 1);
const F = flow('skyscope'); let fk = 1;
const B = board({ game: 'skyline-scope', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });
document.body.style.setProperty('--bg1', '#4aa8f0'); document.body.style.setProperty('--bg2', '#dff2ff'); document.body.style.setProperty('--ui', '#ff7a1a');
scene.fog = new THREE.Fog('#cfe9fb', 140, 420);

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.sn-hud{position:fixed;top:calc(56px + env(safe-area-inset-top));left:12px;right:12px;display:flex;justify-content:space-between;z-index:6;pointer-events:none}
.sn-box{background:rgba(15,22,35,.62);border-radius:12px;padding:3px 11px;font-weight:800;font-size:17px;display:flex;gap:6px;align-items:center}
.sn-box.warn{background:#ff3355;animation:hcpulse .5s infinite}
.sn-brief{position:fixed;top:calc(96px + env(safe-area-inset-top));left:0;right:0;text-align:center;z-index:6;pointer-events:none;font-weight:800;font-size:16px;color:#ffb347;text-shadow:0 2px 0 rgba(0,0,0,.45),0 0 6px rgba(0,0,0,.35);letter-spacing:.5px}
.sn-ammo{position:fixed;left:12px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:6;pointer-events:none;background:rgba(15,22,35,.66);border:2px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 10px;display:flex;gap:4px}
.sn-ammo b{width:7px;height:24px;border-radius:4px 4px 1px 1px;background:linear-gradient(#fff 0 30%,#e9e2cf 30%);box-shadow:0 1px 0 rgba(0,0,0,.3)}
.sn-ammo b.used{opacity:.18}
.sn-zoom{position:fixed;left:14px;top:34%;height:26%;width:10px;border-radius:6px;background:rgba(15,22,35,.45);z-index:6;pointer-events:none;overflow:hidden;border:2px solid rgba(255,255,255,.35)}
.sn-zoom i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#ffd166,#ff7a1a);height:0}
.sn-zl{position:fixed;left:6px;top:calc(34% + 27% + 4px);font-weight:800;font-size:11px;z-index:6;pointer-events:none;color:#ffb347;text-shadow:0 1px 0 #000}
.sn-scope{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle at 50% 50%,transparent 0,transparent 44vmin,rgba(0,0,0,.55) 44.6vmin,#07090d 45.8vmin)}
.sn-scope .ring{position:absolute;left:50%;top:50%;width:89.6vmin;height:89.6vmin;margin:-44.8vmin;border-radius:50%;box-shadow:inset 0 0 36px 14px rgba(0,0,0,.55)}
.sn-scope .h,.sn-scope .v{position:absolute;left:50%;top:50%;background:#111}
.sn-scope .h{width:89vmin;height:2px;margin:-1px 0 0 -44.5vmin}.sn-scope .v{height:89vmin;width:2px;margin:-44.5vmin 0 0 -1px}
.sn-scope .h2,.sn-scope .v2{position:absolute;left:50%;top:50%;background:#111}
.sn-scope .h2{width:89vmin;height:6px;margin:-3px 0 0 -44.5vmin;-webkit-mask:linear-gradient(90deg,#000 0 30%,transparent 30% 70%,#000 70%);mask:linear-gradient(90deg,#000 0 30%,transparent 30% 70%,#000 70%)}
.sn-scope .v2{height:89vmin;width:6px;margin:-44.5vmin 0 0 -3px;-webkit-mask:linear-gradient(#000 0 30%,transparent 30% 70%,#000 70%);mask:linear-gradient(#000 0 30%,transparent 30% 70%,#000 70%)}
.sn-scope .dot{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px;border-radius:50%;background:#ff2d2d;box-shadow:0 0 6px #ff2d2d}
.sn-scope .st{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;--p:0;background:conic-gradient(rgba(80,255,140,.85) calc(var(--p)*1turn),transparent 0);-webkit-mask:radial-gradient(circle,transparent 27px,#000 28px);mask:radial-gradient(circle,transparent 27px,#000 28px);opacity:.9}
.sn-scope .lbl{position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);font-weight:800;font-size:13px;color:#50ff8c;text-shadow:0 1px 0 #000;letter-spacing:1px}
.sn-hint{position:fixed;left:0;right:0;bottom:calc(84px + env(safe-area-inset-bottom));text-align:center;font-weight:800;font-size:20px;z-index:6;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.4);animation:hcpulse 1.1s infinite}
.sn-bars{position:fixed;left:0;right:0;height:0;background:#000;z-index:4;pointer-events:none;transition:height .3s}
.hc-pop{-webkit-text-stroke:6px #1c2433;paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(20,30,60,.4)!important}
.hc-card p{text-shadow:0 2px 0 rgba(0,0,0,.35)!important}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const hud = H('<div class="sn-hud"><div class="sn-box">🎯 <span data-k>0/1</span></div><div class="sn-box" data-tb>⏱ <span data-t>40</span></div></div>');
const brief = H('<div class="sn-brief"></div>'), ammoEl = H('<div class="sn-ammo"></div>');
const zoomEl = H('<div class="sn-zoom"><i></i></div>'); H('<div class="sn-zl">ZOOM</div>');
const scopeEl = H('<div class="sn-scope"><div class="ring"></div><div class="h"></div><div class="v"></div><div class="h2"></div><div class="v2"></div><div class="st"></div><div class="dot"></div><div class="lbl">STEADY</div></div>');
const hintEl = H('<div class="sn-hint">TAP A RED CAP</div>');
const barT = H('<div class="sn-bars" style="top:0"></div>'), barB = H('<div class="sn-bars" style="bottom:0"></div>');

// ---------------------------------------------------------------- textures + materials
const winTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9e4dc'; g.fillRect(0, 54, w, 4);
  g.fillStyle = '#7d8ea3'; g.fillRect(13, 12, 38, 38);
  const gr = g.createLinearGradient(0, 14, 0, 48); gr.addColorStop(0, '#d9f0ff'); gr.addColorStop(1, '#8ec6ec');
  g.fillStyle = gr; g.fillRect(15, 14, 34, 34);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(17, 46); g.lineTo(29, 16); g.lineTo(35, 16); g.lineTo(23, 46); g.fill();
  g.fillStyle = '#7d8ea3'; g.fillRect(31, 14, 2, 34);
}, true);
const cityMat = new THREE.MeshStandardMaterial({ map: winTex, vertexColors: true, roughness: 0.8 });
const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
const groundTex = canvasTex(512, 512, (g, w, h) => {
  const k = w / 26, m = v => v * k;
  g.fillStyle = '#626a77'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ddd6c9'; g.fillRect(m(4), m(4), m(18), m(18));
  g.fillStyle = '#cfc7b8'; g.fillRect(m(6), m(6), m(14), m(14));
  g.fillStyle = '#b9b2a5'; for (let i = 0; i < 4; i++) { g.fillRect(m(4), m(4) + i * m(6), m(18), 2); g.fillRect(m(4) + i * m(6), m(4), 2, m(18)); }
  g.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 26; i += 3) { g.fillRect(m(i), m(0) - 2, m(1.6), 4); g.fillRect(m(0) - 2, m(i), 4, m(1.6)); g.fillRect(m(i), h - 2, m(1.6), 4); g.fillRect(w - 2, m(i), 4, m(1.6)); }
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 6; i++) { const o = m(0.6) + i * m(0.55); g.fillRect(m(4.4), o, m(0.3) * 1.2, m(0.3)); }
  for (const [x0, y0, hor] of [[4.6, 0.3, 0], [4.6, 22.3, 0], [0.3, 4.6, 1], [22.3, 4.6, 1]]) for (let i = 0; i < 7; i++) {
    if (hor) g.fillRect(m(x0), m(y0 + i * 0.5), m(3.4), m(0.28)); else g.fillRect(m(x0 + i * 0.5), m(y0), m(0.28), m(3.4));
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
}, true);
groundTex.repeat.set(16, 16);

// ---------------------------------------------------------------- shared prop geometry
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), sph = new THREE.SphereGeometry(1, 14, 10);
const GEO = {
  tree: merge([part(cyl, '#7a5230', { y: 1.2, sx: 0.22, sz: 0.22, sy: 2.4 }), part(new THREE.IcosahedronGeometry(1, 1), '#5cc46a', { y: 3.4, s: 1.6 }), part(new THREE.IcosahedronGeometry(1, 1), '#4cb35f', { x: 0.7, y: 2.8, s: 1.0 })]),
  palm: merge([...[0, 1, 2, 3, 4].map(i => part(cyl, '#a0754a', { x: i * 0.08, y: 0.6 + i * 1.1, sx: 0.2, sz: 0.2, sy: 1.15 })), ...[0, 1, 2, 3, 4, 5].map(i => part(box, i % 2 ? '#3fae5a' : '#2f9a4c', { x: 0.35 + Math.cos(i) * 1.1, y: 5.7, z: Math.sin(i) * 1.1, ry: -i, rz: -0.35, sx: 2.4, sy: 0.08, sz: 0.55 }))]),
  cloud: new THREE.IcosahedronGeometry(1, 1),
};
const BUILD_COLS = ['#f6e7d4', '#ffd2bd', '#cfe3f5', '#f3c9b0', '#e8e1f5', '#fff1c9', '#d7ecd9', '#f2b8a0', '#ffe0e6', '#c9dcef'];

// ---------------------------------------------------------------- world build (seeded per level)
const BLK = 26;
const bx = i => i * BLK, bz = j => -10 - j * BLK;
let world = null, buildings = [], people = [], cars = [], regions = {}, fountainWater = null;
function wallBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 6; v++) {
    const i = f * 6 + v; let u = uv.getX(i), vv = uv.getY(i);
    if (f === 2 || f === 3) { u = 0.02; vv = 0.02; } else { u *= (f < 2 ? d : w) / 3.6; vv *= h / 3.4; }
    uv.setXY(i, u, vv);
  }
  return g;
}
function buildCity() {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry && o.geometry !== GEO.tree && o.geometry !== GEO.palm) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  buildings = []; cars = [];
  const r = rng(level * 977 + 13);
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(416, 416), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(13, 0, -101); ground.receiveShadow = true; world.add(ground);
  const parts = [], trees = [], palms = [];
  const addB = (x, z, w, d, h, col) => {
    parts.push(part(wallBox(w, h, d), col, { x, y: h / 2, z }));
    parts.push(part(box, new THREE.Color(col).multiplyScalar(0.72).getStyle(), { x, y: h + 0.25, z, sx: w + 0.5, sy: 0.5, sz: d + 0.5 }));
    parts.push(part(box, '#d9d4cc', { x, y: h + 0.08, z, sx: w - 0.6, sy: 0.12, sz: d - 0.6 }));
    if (w > 5 && r() < 0.8) parts.push(part(box, '#b8bec7', { x: x + (r() - 0.5) * w * 0.4, y: h + 0.7, z: z + (r() - 0.5) * d * 0.4, sx: 1.6, sy: 1.2, sz: 1.2 }));
    if (w > 5 && r() < 0.4) { const tx = x + (r() - 0.5) * w * 0.4, tz = z + (r() - 0.5) * d * 0.4; parts.push(part(cyl, '#a8794f', { x: tx, y: h + 1.6, z: tz, sx: 0.9, sz: 0.9, sy: 1.6 }), part(new THREE.ConeGeometry(1, 1, 14), '#8a5f3d', { x: tx, y: h + 2.7, z: tz, sx: 1, sz: 1, sy: 0.6 })); }
    buildings.push({ min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, h + 0.5, z + d / 2) });
  };
  const parkJ = 2, parkI = 0;
  for (let j = 0; j <= 8; j++) for (let i = -4; i <= 4; i++) {
    const cx = bx(i), cz = bz(j);
    if (i === 0 && j === 0) { addB(0, -10, 16, 16, 22, '#e4d5c3'); continue; }        // our rooftop
    if (i === 0 && j === 1) continue;                                                  // plaza
    if (i === parkI && j === parkJ) continue;                                          // park
    const midCol = i === 0 && j <= 4;
    const hBase = midCol ? 8 : j <= 1 ? 4 : j === 2 ? 12 : j === 3 ? 18 : 22, hVar = midCol ? 8 : j <= 1 ? (Math.abs(i) <= 1 ? 4 : 9) : j === 2 ? 12 : 30;
    const near = j <= 1 && Math.abs(i) <= 1;
    const k = r();
    const col = () => BUILD_COLS[Math.floor(r() * BUILD_COLS.length)];
    if (k < 0.3 || j >= 4) addB(cx, cz, 14, 14, hBase + r() * hVar * (near ? 0.5 : 1) + (j >= 4 && !midCol && r() < 0.35 ? 25 : 0), col());
    else if (k < 0.65) { addB(cx - 3.6, cz, 6.6, 14, hBase + r() * hVar, col()); addB(cx + 3.6, cz, 6.6, 14, hBase + r() * hVar, col()); }
    else for (const [ox, oz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) addB(cx + ox, cz + oz, 6.4, 6.4, hBase * 0.8 + r() * hVar, col());
    if (j <= 3) for (const s of [-1, 1]) if (r() < 0.5) trees.push([cx + s * 8.2, cz + 8.2 * (r() < 0.5 ? 1 : -1), 0.6 + r() * 0.2]);
  }
  // plaza (0,1)
  const pz = bz(1);
  parts.push(part(cyl, '#efe6d6', { x: 0, y: 0.03, z: pz, sx: 8.6, sz: 8.6, sy: 0.06 }));
  parts.push(part(new THREE.TorusGeometry(1, 0.08, 6, 40), '#c9b99c', { x: 0, y: 0.07, z: pz, rx: Math.PI / 2, s: 6.2, sz: 1 }));
  parts.push(part(cyl, '#d8cbb4', { x: 0, y: 0.35, z: pz, sx: 3.2, sz: 3.2, sy: 0.7 }), part(cyl, '#bfae92', { x: 0, y: 0.72, z: pz, sx: 3.35, sz: 3.35, sy: 0.12 }));
  parts.push(part(cyl, '#d8cbb4', { x: 0, y: 1.4, z: pz, sx: 0.4, sz: 0.4, sy: 1.6 }), part(cyl, '#d8cbb4', { x: 0, y: 2.2, z: pz, sx: 1.2, sz: 1.2, sy: 0.18 }));
  for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2 + 0.39; parts.push(part(box, '#9b6b43', { x: Math.cos(an) * 7.4, y: 0.35, z: pz + Math.sin(an) * 7.4, ry: -an + Math.PI / 2, sx: 2, sy: 0.2, sz: 0.6 })); }
  for (let a = 0; a < 6; a++) { const an = a / 6 * Math.PI * 2; palms.push([Math.cos(an) * 8.6, pz + Math.sin(an) * 8.6, 0.5]); }
  fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.1, 28), new THREE.MeshStandardMaterial({ color: '#5cc8f2', roughness: 0.1, metalness: 0.1, emissive: '#1a6c9a', emissiveIntensity: 0.25 }));
  fountainWater.position.set(0, 0.66, pz); world.add(fountainWater);
  // park
  const ppx = bx(parkI), ppz = bz(parkJ);
  parts.push(part(box, '#7fd36b', { x: ppx, y: 0.12, z: ppz, sx: 16.5, sy: 0.24, sz: 16.5 }));
  parts.push(part(box, '#e7dcc4', { x: ppx, y: 0.25, z: ppz, sx: 2.2, sy: 0.04, sz: 16.4 }), part(box, '#e7dcc4', { x: ppx, y: 0.25, z: ppz, sx: 16.4, sy: 0.04, sz: 2.2 }));
  for (const [ox, oz] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [-6.5, 0.5], [6.4, -1]]) trees.push([ppx + ox + (r() - 0.5), ppz + oz + (r() - 0.5), 0.8 + r() * 0.3, 0.24]);
  // mountains + clouds far away
  const mts = [];
  for (let i = 0; i < 9; i++) mts.push(part(new THREE.ConeGeometry(1, 1, 6), ['#9fb9d6', '#a9c3de', '#94afcf'][i % 3], { x: -260 + i * 65 + r() * 20, y: 30, z: -330 - r() * 40, sx: 70 + r() * 40, sz: 50, sy: 60 + r() * 50 }));
  const mt = new THREE.Mesh(merge(mts), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false })); world.add(mt);
  const city = new THREE.Mesh(merge(parts), cityMat); city.castShadow = city.receiveShadow = true; world.add(city);
  const inst = (geo, list) => { const im = new THREE.InstancedMesh(geo, VC, list.length), o = new THREE.Object3D(); list.forEach((t, i) => { o.position.set(t[0], t[3] || 0, t[1]); o.rotation.set(0, i * 1.7, 0); o.scale.setScalar(t[2]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.castShadow = true; im.receiveShadow = true; world.add(im); };
  inst(GEO.tree, trees); inst(GEO.palm, palms);
  const cl = new THREE.InstancedMesh(GEO.cloud, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 1, fog: false }), 12), o = new THREE.Object3D();
  for (let i = 0; i < 12; i++) { o.position.set(-220 + i * 40 + r() * 20, 90 + r() * 40, -260 - r() * 60); o.scale.set(18 + r() * 14, 5 + r() * 3, 10); o.updateMatrix(); cl.setMatrixAt(i, o.matrix); }
  world.add(cl);
  // cars along the two horizontal roads
  const CAR_COLS = ['#ff4d4d', '#ffd23f', '#3a86ff', '#ffffff', '#3ab795', '#ff8c42', '#7b5cff', '#2b2d42'];
  for (let c = 0; c < 10; c++) {
    const col = CAR_COLS[c % CAR_COLS.length];
    const g = merge([part(box, col, { y: 0.7, sx: 4.2, sy: 0.9, sz: 1.9 }), part(box, col, { x: -0.2, y: 1.4, sx: 2.3, sy: 0.7, sz: 1.7 }), part(box, '#9ed4f5', { x: -0.2, y: 1.42, sx: 2.36, sy: 0.5, sz: 1.6 }),
      ...[[-1.35, 1], [1.35, 1], [-1.35, -1], [1.35, -1]].map(([x, z]) => part(cyl, '#222', { x, y: 0.4, z: z * 0.85, rx: Math.PI / 2, sx: 0.4, sz: 0.4, sy: 0.3 }))]);
    const m = new THREE.Mesh(g, VC); m.castShadow = true; world.add(m);
    const road = c % 3, dir = c % 2 ? 1 : -1, z = (road === 0 ? -23 : road === 1 ? -49 : -75) + dir * 2;
    m.position.set(-110 + r() * 220, 0, z); m.rotation.y = dir > 0 ? 0 : Math.PI;
    cars.push({ m, dir, sp: 7 + r() * 5 });
  }
  regions = {
    plaza: { x0: -7.5, x1: 7.5, z0: pz - 7.5, z1: pz + 7.5, y: 0.06, avoid: [0, pz, 3.8] },
    park: { x0: ppx - 7, x1: ppx + 7, z0: ppz - 7, z1: ppz + 7, y: 0.26 },
    walkA: { x0: -40, x1: 40, z0: -28.6, z1: -27.4, y: 0 },
    walkB: { x0: -40, x1: 40, z0: -44.8, z1: -43.6, y: 0 },
    walkC: { x0: -40, x1: 40, z0: -54.6, z1: -53.4, y: 0 },
  };
}

// ---------------------------------------------------------------- people (stylised low-poly, no blood)
const PS = 1.45;
const SHIRTS = ['#ff8fab', '#ffd166', '#8ecae6', '#90e0a5', '#ffffff', '#c3a6ff', '#ffb37a', '#7bdff2', '#f6f7d7'], PANTS = ['#3d5a80', '#5c4d3c', '#2b2d42', '#6c757d', '#355070'], SKINS = ['#f1c7a5', '#e0ac80', '#c68c5d', '#8d5a3c'];
const markTex = canvasTex(128, 160, (g) => {
  g.fillStyle = '#ff2d3d'; g.strokeStyle = '#fff'; g.lineWidth = 10; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(14, 20); g.lineTo(114, 20); g.lineTo(64, 120); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 54, 13, 0, 7); g.fill();
});
const legGeo = new THREE.CapsuleGeometry(0.095, 0.44, 4, 8); legGeo.translate(0, -0.3, 0);
const legMats = {};
function person(kind, r) {
  const T = kind === 'target', g = new THREE.Group();
  const shirt = T ? '#2b2d42' : SHIRTS[Math.floor(r() * SHIRTS.length)], pants = T ? '#1b1d2a' : PANTS[Math.floor(r() * PANTS.length)], skin = SKINS[Math.floor(r() * SKINS.length)];
  const hair = T ? '#ff2d3d' : ['#2b1d14', '#5a3a22', '#e8c26a', '#111', '#a0522d'][Math.floor(r() * 5)];
  const P = [
    part(new THREE.CapsuleGeometry(0.23, 0.38, 4, 10), shirt, { y: 1.04, sz: 0.8 }),
    part(sph, skin, { y: 1.52, s: 0.2 }),
    part(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, { y: 1.55, s: 0.212 }),
    part(new THREE.CapsuleGeometry(0.07, 0.42, 4, 6), shirt, { x: -0.3, y: 1.0, rz: 0.12 }), part(new THREE.CapsuleGeometry(0.07, 0.42, 4, 6), shirt, { x: 0.3, y: 1.0, rz: -0.12 }),
    part(sph, skin, { x: -0.34, y: 0.73, s: 0.07 }), part(sph, skin, { x: 0.34, y: 0.73, s: 0.07 }),
  ];
  if (T) P.push(part(box, '#ff2d3d', { y: 1.62, z: 0.13, sx: 0.3, sy: 0.04, sz: 0.2 }), part(box, '#111', { y: 1.53, z: 0.18, sx: 0.3, sy: 0.07, sz: 0.04 }), part(box, '#ff2d3d', { y: 1.22, z: 0.17, sx: 0.07, sy: 0.3, sz: 0.04 }));
  const body = new THREE.Mesh(merge(P), VC); body.castShadow = true; g.add(body);
  const lm = legMats[pants] = legMats[pants] || mat(pants);
  const legL = new THREE.Mesh(legGeo, lm), legR = new THREE.Mesh(legGeo, lm); legL.position.set(-0.11, 0.68, 0); legR.position.set(0.11, 0.68, 0); legL.castShadow = legR.castShadow = true; g.add(legL, legR);
  g.scale.setScalar(PS); g.rotation.order = 'YXZ';
  let marker = null;
  if (T) { marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, depthTest: false, transparent: true })); marker.scale.set(0.55, 0.69, 1); marker.position.y = 2.25; marker.renderOrder = 5; g.add(marker); }
  world.add(g);
  return { g, body, legL, legR, kind, marker, alive: true, dest: null, wait: 0, panic: 0, fall: null, sp: 1 + r() * 0.4, ph: r() * 10 };
}
function pickDest(p, r = Math.random) {
  const R = regions[p.region];
  for (let k = 0; k < 10; k++) {
    const x = lerp(R.x0, R.x1, r()), z = lerp(R.z0, R.z1, r());
    if (R.avoid && Math.hypot(x - R.avoid[0], z - R.avoid[1]) < R.avoid[2]) continue;
    return new THREE.Vector3(x, R.y, z);
  }
  return new THREE.Vector3(R.x0, R.y, R.z0);
}
function spawnPeople() {
  const r = rng(level * 131 + 5);
  people = [];
  const nT = Math.min(4, 1 + Math.floor((level - 1) / 2)), nC = 12 + Math.min(12, level * 2);
  for (let i = 0; i < nT; i++) { const p = person('target', r); p.region = i % 2 === 0 ? 'plaza' : 'park'; people.push(p); }
  const regs = ['plaza', 'plaza', 'plaza', 'park', 'park', 'walkA', 'walkB', 'walkC'];
  for (let i = 0; i < nC; i++) { const p = person('civ', r); p.region = regs[i % regs.length]; people.push(p); }
  for (const p of people) { const d = pickDest(p, r); p.g.position.copy(d); p.dest = pickDest(p, r); p.wait = r() * 2; }
  // level 1: the target is out in the open at the front of the plaza, chatting (still)
  const t0 = people[0]; if (level === 1) { t0.g.position.set(-3.2, 0.06, bz(1) - 4.6); t0.still = true; }
  return nT;
}

// ---------------------------------------------------------------- first-person rifle
const rifle = new THREE.Group();
{
  const dk = '#454c57', dk2 = '#59616d';
  const P = [
    part(box, dk, { y: 0, z: 0, sx: 0.07, sy: 0.085, sz: 0.5 }),
    part(cyl, dk2, { z: -0.52, rx: Math.PI / 2, sx: 0.016, sz: 0.016, sy: 0.6 }),
    part(cyl, dk, { z: -0.84, rx: Math.PI / 2, sx: 0.026, sz: 0.026, sy: 0.08 }),
    part(box, '#7a5a3a', { y: -0.025, z: 0.36, sx: 0.06, sy: 0.12, sz: 0.3 }),
    part(box, '#6a4c30', { y: -0.09, z: 0.1, rx: 0.35, sx: 0.05, sy: 0.12, sz: 0.06 }),
    part(box, dk, { y: -0.075, z: -0.05, sx: 0.04, sy: 0.08, sz: 0.06 }),
    part(cyl, dk, { y: 0.085, z: -0.02, rx: Math.PI / 2, sx: 0.03, sz: 0.03, sy: 0.32 }),
    part(new THREE.CylinderGeometry(1, 0.7, 1, 16), dk, { y: 0.085, z: -0.22, rx: -Math.PI / 2, sx: 0.046, sz: 0.046, sy: 0.1 }),
    part(new THREE.CylinderGeometry(0.75, 1, 1, 16), dk, { y: 0.085, z: 0.16, rx: -Math.PI / 2, sx: 0.04, sz: 0.04, sy: 0.07 }),
    part(cyl, dk2, { y: 0.045, z: 0, sx: 0.012, sz: 0.012, sy: 0.04 }),
    part(cyl, '#e8303d', { y: 0.085, z: 0.197, rx: Math.PI / 2, sx: 0.033, sz: 0.033, sy: 0.004 }),
    part(box, '#3f4a2c', { x: 0.05, y: -0.15, z: 0.12, rx: 0.5, ry: -0.3, sx: 0.09, sy: 0.08, sz: 0.36 }),
    part(sph, '#4a3a2c', { x: 0.01, y: -0.1, z: 0.07, sx: 0.05, sy: 0.045, sz: 0.06 }),
    part(sph, '#4a3a2c', { x: -0.01, y: -0.05, z: -0.3, sx: 0.045, sy: 0.04, sz: 0.07 }),
    part(box, '#3f4a2c', { x: -0.07, y: -0.13, z: -0.22, rx: 0.4, ry: 0.5, sx: 0.08, sy: 0.08, sz: 0.36 }),
  ];
  const m = new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.35 }));
  rifle.add(m); camera.add(rifle);
}
const rifleHome = new THREE.Vector3(0.16, -0.17, -0.4); rifle.scale.setScalar(0.5);
rifle.position.copy(rifleHome); rifle.rotation.set(0.03, 0.06, 0);
const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff1a8', transparent: true })); muzzleFlash.position.set(0, 0, -0.88); muzzleFlash.visible = false; rifle.add(muzzleFlash);
const bullet = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), glossy('#e2b04a', { metalness: 0.7 })); bullet.visible = false; scene.add(bullet);
const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.045, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })); trail.visible = false; scene.add(trail);

// ---------------------------------------------------------------- ray tests
const ray = new THREE.Ray(), tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), tv3 = new THREE.Vector3();
function sphereT(o, d, c, rad) { tv.copy(c).sub(o); const b = tv.dot(d); if (b < 0) return Infinity; const q = tv.lengthSq() - b * b; if (q > rad * rad) return Infinity; return b - Math.sqrt(rad * rad - q); }
function rayHit(o, d) {
  let best = { t: Infinity };
  ray.set(o, d);
  for (const b of buildings) { const hit = ray.intersectBox(new THREE.Box3(b.min, b.max), tv2); if (hit) { const t = hit.distanceTo(o); if (t < best.t && t > 2) best = { t, type: 'wall', point: hit.clone() }; } }
  if (d.y < 0) { const t = -o.y / d.y; if (t < best.t) best = { t, type: 'ground', point: o.clone().addScaledVector(d, t) }; }
  for (const p of people) {
    if (!p.alive) continue; const P = p.g.position;
    const th = sphereT(o, d, tv3.set(P.x, P.y + 1.52 * PS, P.z), 0.25 * PS);
    const tb = Math.min(sphereT(o, d, tv3.set(P.x, P.y + 1.08 * PS, P.z), 0.34 * PS), sphereT(o, d, tv3.set(P.x, P.y + 0.55 * PS, P.z), 0.24 * PS));
    const t = Math.min(th, tb);
    if (t < best.t) best = { t, type: 'person', p, head: th <= tb, point: o.clone().addScaledVector(d, t) };
  }
  return best;
}

// ---------------------------------------------------------------- state
let state = 'ready', mode = 'aim', yaw = 0, pitch = -0.5, scope = 0, holding = false, botHold = false, wasHold = false, steadyT = 0, moveAcc = 0;
let nT = 1, killed = 0, ammo = 5, ammoMax = 5, timeLeft = 40, ts = 1, cam = null, shake = 0, recoil = 0, endT = 0;
const BASE_FOV = 62, SCOPE_FOV = 19;
function renderAmmo() { ammoEl.innerHTML = Array.from({ length: ammoMax }, (_, i) => `<b class="${i >= ammo ? 'used' : ''}"></b>`).join(''); }
function setHud() { hud.querySelector('[data-k]').textContent = `${killed}/${nT}`; ui.progress(killed / nT); }
function startLevel() {
  fk = F.k(); buildCity(); nT = spawnPeople(); killed = 0; ammoMax = ammo = nT + 3; timeLeft = (32 + nT * 8) / fk; mode = 'aim'; cam = null; ts = 1; scope = 0; endT = 0;
  yaw = 0; pitch = -0.5; holding = botHold = wasHold = false; tapAim = null;
  ui.levels(level); setHud(); renderAmmo(); bullet.visible = trail.visible = false; rifle.visible = true;
  const names = ['RED CAP', 'RED CAPS'];
  brief.textContent = `TARGET: ${nT > 1 ? nT + ' ' + names[1] : names[0]} · SPARE CIVILIANS`;
  barT.style.height = barB.style.height = '0';
}
ui.onTap(w => { if (w === 'win') level++; startLevel(); state = 'play'; if (w !== 'lose') B.start(); });
// a tap (no drag) swings the scope to the tapped spot (snapping to a red cap near it), zooms in and fires by itself
let tapAim = null, downPlay = false; const tapRay = new THREE.Raycaster(), tapN = new THREE.Vector2();
function tapShot(x, y) {
  if (state !== 'play' || mode !== 'aim' || ammo <= 0) return;
  tapN.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); tapRay.setFromCamera(tapN, camera);
  let d = tapRay.ray.direction.clone(), bd = 0.09;
  for (const p of people) { if (!p.alive || p.kind !== 'target') continue; const q = p.g.position.clone().add(new THREE.Vector3(0, 1.1 * PS, 0)).sub(camPos0).normalize(); const e = q.angleTo(tapRay.ray.direction); if (e < bd && rayHit(camPos0, q).p === p) { bd = e; d = q; } }
  tapAim = { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y), t: 0.85 }; buzz(5);
}
input({
  onDown: () => { downPlay = state === 'play'; if (downPlay) holding = true; },
  onTap: (e) => { if (downPlay) tapShot(e.clientX, e.clientY); },
  onMove: (dx, dy) => {
    if (state !== 'play' || mode !== 'aim') return;
    const k = 0.0042 * (camera.fov / BASE_FOV) * (scope > 0.5 ? 0.75 : 1);
    yaw -= dx * k; pitch -= dy * k; moveAcc += Math.hypot(dx, dy);
  },
  onUp: () => { holding = false; },
});
addEventListener('pointercancel', () => holding = false);
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s of a still screen): on level 1, until the
// first real touch, the scope zooms in and pans slowly onto the red cap and steadies there, then lowers again without firing
const D = demo(null, { ready: () => state === 'play' && level === 1 && mode === 'aim' && killed === 0 && ammo === ammoMax, ms: 4500 }); let demoHeld = false;
function demoAim(real) {
  for (const p of people) { if (!p.alive || p.kind !== 'target') continue;
    const d = p.g.position.clone().add(new THREE.Vector3(0, 1.1 * PS, 0)).sub(camPos0).normalize(); if (rayHit(camPos0, d).p !== p) continue;
    const k = Math.min(1, real * 1.6); yaw = lerp(yaw, Math.atan2(-d.x, -d.z), k); pitch = lerp(pitch, Math.asin(d.y), k); return; }
}

function panic(at, rad = 30) { for (const p of people) if (p.alive && p.g.position.distanceTo(at) < rad && !(p.still && level === 1)) { p.panic = 2.5 + Math.random() * 1.5; p.dest = pickDest(p); p.wait = 0; } }
function kill(p, dir, head) {
  p.alive = false; if (p.marker) p.marker.visible = false;
  p.fall = { t: 0, dir: dir.clone().setY(0).normalize(), popped: false };
  p.g.rotation.y = Math.atan2(p.fall.dir.x, p.fall.dir.z);
  const hp = p.g.position.clone().add(new THREE.Vector3(0, (head ? 1.52 : 1.05) * PS, 0));
  burst(scene, hp, ['#ffd23f', '#ffffff', '#ff8fab', '#7bdff2'], 22, { speed: 0.16, up: 0.12, size: 1.2, shape: 'sphere', gravity: 0.008 });
  burst(scene, hp, ['#ffffff'], 8, { speed: 0.06, up: 0.05, size: 2.2, shape: 'sphere', gravity: 0, life: 0.6 });
}
function fire() {
  if (state !== 'play' || mode !== 'aim' || ammo <= 0) return;
  ammo--; renderAmmo();
  const o = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
  const h = rayHit(o, d);
  tone(70, 0.35, 'sawtooth', 0.16, 0.4); tone(160, 0.12, 'square', 0.12, 0.3); tone(1400, 0.05, 'sawtooth', 0.05, 0.2); buzz(25);
  recoil = 1; shake = 0.6; muzzleFlash.visible = true; ui.flash(0.12);
  if (h.type === 'person' && h.p.kind === 'target') {
    const lastOne = people.filter(p => p.kind === 'target' && p.alive).length === 1;
    if (lastOne) { startCam(h, o, d); return; }
    kill(h.p, d, h.head); killed++; setHud(); sfx.smash(); buzz([20, 30, 40]);
    ui.pop(h.head ? 'HEADSHOT!' : 'TARGET DOWN!', h.head ? '#ffd166' : '#ffffff', h.head ? 42 : 36, 27);
    ts = 0.25; setTimeout(() => ts = 1, 450); panic(h.point, 40);
  } else if (h.type === 'person') {
    kill(h.p, d, h.head); sfx.fail(); buzz([60, 40, 60]); panic(h.point, 40);
    lose('CIVILIAN HIT!', 'Only take down the red caps');
  } else {
    if (h.point) {
      const c = h.type === 'wall' ? ['#e7ddd0', '#bdb3a6', '#ffffff'] : ['#cfc7b8', '#9b958a', '#ffffff'];
      burst(scene, h.point, c, 12, { speed: 0.09, up: 0.08, size: 0.9, gravity: 0.006 });
      panic(h.point, 32);
    }
    ui.pop('MISSED', '#ffffff', 26, 62); tone(1800, 0.1, 'sine', 0.03, 0.2);
    if (ammo <= 0) lose('OUT OF AMMO', `${killed}/${nT} targets down`);
  }
}
function lose(t, line) { if (state !== 'play') return; state = 'lost'; F.level(false, killed / nT); mode = 'aim'; ui.lose(t, line); }
function startCam(h, o, d) {
  mode = 'cam'; ts = 0.06;
  cam = { t: 0, from: o.clone().addScaledVector(d, 1.5), to: h.point.clone(), d: d.clone(), p: h.p, head: h.head, hit: false, dur: 1.7, side: Math.random() < 0.5 ? -1 : 1 };
  bullet.visible = true; trail.visible = true; rifle.visible = false;
  barT.style.height = barB.style.height = '9vh';
  ui.pop('FINAL SHOT', '#ffd166', 34, 16);
  tone(220, 1.6, 'sine', 0.07, 0.25); tone(90, 1.5, 'triangle', 0.06, 0.6);
}

// ---------------------------------------------------------------- loop
const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
const camPos0 = new THREE.Vector3(0, 24, -17.5);
loop((dtRaw, t) => {
  const real = dtRaw / 60;
  // input → scope, release fires
  if (tapAim) { if (state !== 'play' || mode !== 'aim') tapAim = null; else { const sw = window.__sway || { sx: 0, sy: 0 }, k = Math.min(1, real * 14); yaw = lerp(yaw, tapAim.yaw - sw.sx, k); pitch = lerp(pitch, tapAim.pitch - sw.sy, k); moveAcc = 0; if ((tapAim.t -= real) <= 0) tapAim = null; } }
  const dm = D.on && state === 'play' && mode === 'aim' && !holding; if (dm) { demoAim(real); demoHeld = true; }
  else if (demoHeld) { demoHeld = false; if (!holding) wasHold = false; }   // demo over: the scope lowers without a shot
  const hold = state === 'play' && mode === 'aim' && (holding || botHold || !!tapAim || dm);
  if (wasHold && !hold && scope > 0.55 && state === 'play' && mode === 'aim') fire();
  wasHold = hold;
  scope = clamp(scope + (hold ? 5 : -6) * real, 0, 1);
  const se = scope * scope * (3 - 2 * scope);
  // steadiness: hold still while scoped
  if (scope > 0.8) { steadyT = moveAcc > 6 ? Math.max(0, steadyT - real * 2) : steadyT + real; } else steadyT = 0;
  moveAcc = 0;
  const steady = clamp(steadyT / 0.9, 0, 1);
  pitch = clamp(pitch, -1.0, 0.12); yaw = clamp(yaw, -0.85, 0.85);
  // timer
  if (state === 'play' && mode === 'aim') {
    timeLeft -= real; const tl = Math.max(0, Math.ceil(timeLeft));
    hud.querySelector('[data-t]').textContent = tl; hud.querySelector('[data-tb]').classList.toggle('warn', tl <= 8);
    if (timeLeft <= 0) lose("TIME'S UP", `${killed}/${nT} targets down`);
  }
  const sec = real * ts;
  // people
  for (const p of people) {
    const g = p.g;
    if (p.fall) {
      const f = p.fall; f.t += sec;
      const k = clamp(f.t / 0.45, 0, 1);
      g.rotation.x = (Math.PI / 2) * (1 - Math.pow(1 - k, 3)) + (k >= 1 ? Math.sin(Math.min(1, (f.t - 0.45) * 3) * Math.PI) * 0.12 * Math.max(0, 1 - (f.t - 0.45)) * -1 : 0);
      if (f.t < 0.45) g.position.addScaledVector(f.dir, sec * 2.2);
      p.legL.rotation.x = lerp(p.legL.rotation.x, 0.5, 0.1); p.legR.rotation.x = lerp(p.legR.rotation.x, -0.3, 0.1);
      if (!f.popped && k >= 1) { f.popped = true; burst(scene, g.position.clone().add(new THREE.Vector3(0, 0.3, 0)), ['#ffd23f', '#ffffff'], 10, { speed: 0.08, up: 0.1, size: 0.8, shape: 'sphere' }); tone(120, 0.12, 'sine', 0.1, 0.5); }
      continue;
    }
    if (p.marker) { p.marker.position.y = 2.25 + Math.sin(t * 5 + p.ph) * 0.08; p.marker.visible = scope < 0.5 && mode === 'aim'; }
    if (state !== 'play' && state !== 'ready') { p.legL.rotation.x = p.legR.rotation.x = 0; }
    if (p.still) { g.rotation.y = Math.sin(t * 0.7) * 0.8 + 0.6; p.body.rotation.z = Math.sin(t * 2.2) * 0.04; continue; }
    p.panic = Math.max(0, p.panic - sec);
    if (p.wait > 0) { p.wait -= sec; p.legL.rotation.x = lerp(p.legL.rotation.x, 0, 0.2); p.legR.rotation.x = lerp(p.legR.rotation.x, 0, 0.2); continue; }
    tv.copy(p.dest).sub(g.position).setY(0); const dist = tv.length();
    const tgtMul = p.kind === 'target' ? Math.min(1.85, (0.6 + level * 0.12) * fk) : 1;
    const sp = (p.panic > 0 ? 5.2 : 1.3 * p.sp) * tgtMul;
    if (dist < 0.3) { p.dest = pickDest(p); p.wait = p.panic > 0 ? 0 : 0.5 + Math.random() * 2.5; continue; }
    g.position.addScaledVector(tv.normalize(), Math.min(dist, sp * sec));
    g.rotation.y = Math.atan2(tv.x, tv.z);
    const w = (p.ph + t) * (p.panic > 0 ? 16 : 8); p.legL.rotation.x = Math.sin(w) * 0.7; p.legR.rotation.x = -Math.sin(w) * 0.7;
    p.body.position.y = Math.abs(Math.sin(w)) * 0.03;
  }
  for (const c of cars) { c.m.position.x += c.dir * c.sp * sec; if (c.m.position.x > 120) c.m.position.x = -120; if (c.m.position.x < -120) c.m.position.x = 120; }
  if (fountainWater) fountainWater.scale.setScalar(1 + Math.sin(t * 3) * 0.01);
  // camera
  recoil = Math.max(0, recoil - real * 5); shake = Math.max(0, shake - real * 3);
  const swayAmp = (0.0045 + Math.min(0.004, level * 0.0004)) * fk * (1 - 0.8 * steady) * se + 0.0006;
  const sx = (Math.sin(t * 0.9) * 0.6 + Math.sin(t * 1.73 + 1) * 0.4) * swayAmp, sy = (Math.sin(t * 1.21 + 2) * 0.6 + Math.sin(t * 0.67) * 0.4) * swayAmp;
  window.__sway = { sx, sy };
  if (mode === 'cam' && cam) {
    cam.t += real;
    const u = clamp(cam.t / cam.dur, 0, 1), e = 1 - Math.pow(1 - u, 2.4);
    const bp = tv.copy(cam.from).lerp(cam.to, cam.hit ? 1 : e);
    bullet.position.copy(bp); bullet.quaternion.setFromUnitVectors(up, cam.d); bullet.rotateY(cam.t * 20);
    trail.position.copy(bp).addScaledVector(cam.d, -1.6); trail.scale.set(1, 3.2, 1); trail.quaternion.setFromUnitVectors(up, cam.d);
    side.crossVectors(cam.d, up).normalize();
    if (!cam.hit) {
      camera.position.copy(bp).addScaledVector(cam.d, -1.3 - 3.2 * e).addScaledVector(up, 0.28 + 0.9 * e).addScaledVector(side, (0.32 + 1.2 * e) * cam.side);
      camera.lookAt(tv2.copy(bp).addScaledVector(cam.d, 3));
      camera.fov = lerp(camera.fov, 42, 0.2);
      if (u >= 1) {
        cam.hit = true; cam.t2 = 0; ts = 0.3; bullet.visible = trail.visible = false;
        kill(cam.p, cam.d, cam.head); killed++; setHud(); sfx.smash(); buzz([30, 30, 60]); shake = 1; ui.flash(0.5);
        ui.pop(cam.head ? 'HEADSHOT!' : 'MISSION COMPLETE!', '#ffd166', cam.head ? 52 : 38, 22);
        panic(cam.to, 40);
        cam.orbit = Math.atan2(-cam.d.x, -cam.d.z);
      }
    } else {
      cam.t2 += real; cam.orbit += real * 0.5 * cam.side;
      const P = cam.p.g.position;
      camera.position.set(P.x + Math.sin(cam.orbit) * 4.2, P.y + 7, P.z + Math.cos(cam.orbit) * 4.2);
      camera.lookAt(P.x, P.y + 0.8, P.z);
      if (cam.t2 > 1.6 && state === 'play') {
        state = 'won'; F.level(true); B.submit(1); save.set('level', level + 1); sfx.win(); buzz([20, 40, 20]);
        confetti(scene, P.clone().add(new THREE.Vector3(0, 4, 0)), 80);
        ui.win(level, `${nT} target${nT > 1 ? 's' : ''} down · ${ammo} round${ammo === 1 ? '' : 's'} left`);
      }
    }
    camera.updateProjectionMatrix();
  } else {
    camera.position.copy(camPos0);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch + sy + recoil * 0.035 + (Math.random() - 0.5) * shake * 0.01, yaw + sx + (Math.random() - 0.5) * shake * 0.01, 0);
    const baseF = camera.aspect < 0.7 ? BASE_FOV * 1.08 : BASE_FOV;
    camera.fov = lerp(baseF, SCOPE_FOV, se); camera.updateProjectionMatrix();
    rifle.visible = se < 0.6;
    rifle.position.set(rifleHome.x - se * 0.1, rifleHome.y - se * 0.08 + Math.sin(t * 1.4) * 0.003, rifleHome.z + recoil * 0.07);
    rifle.rotation.x = 0.03 + recoil * 0.12;
  }
  muzzleFlash.visible = muzzleFlash.visible && recoil > 0.75;
  // overlays
  scopeEl.style.opacity = mode === 'aim' ? clamp((se - 0.45) * 3, 0, 1) : 0;
  scopeEl.querySelector('.st').style.setProperty('--p', steady.toFixed(2));
  scopeEl.querySelector('.lbl').style.opacity = steady >= 1 ? 1 : 0;
  zoomEl.firstElementChild.style.height = (se * 100) + '%';
  hintEl.style.display = state === 'play' && mode === 'aim' && scope < 0.1 && killed === 0 && ammo === ammoMax ? '' : 'none';
  brief.style.opacity = mode === 'aim' && se < 0.5 ? 1 : 0;
  S.followLight(new THREE.Vector3(0, 0, -60));
  sun.position.set(60, 110, -10);
});

startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return killed; },
  bot() {
    if (state !== 'play' || mode !== 'aim') { botHold = false; return; }
    const alive = people.filter(p => p.kind === 'target' && p.alive);
    if (!alive.length) return;
    const o = camPos0;
    const aimAt = p => tv3.copy(p.g.position).add(new THREE.Vector3(0, 1.1 * PS, 0));
    const ang = p => { const d = aimAt(p).clone().sub(o).normalize(); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y), d }; };
    let best = null, bd = 1e9;
    for (const p of alive) { const a = ang(p); const vis = rayHit(o, a.d); if (vis.p !== p) continue; const e = Math.hypot(a.yaw - yaw, a.pitch - pitch); if (e < bd) { bd = e; best = a; } }
    if (!best) { botHold = false; return; }
    botHold = true;
    const sw = window.__sway || { sx: 0, sy: 0 };
    const ty = best.yaw - sw.sx, tp = best.pitch - sw.sy;
    const err = Math.hypot(ty - yaw, tp - pitch);
    yaw = lerp(yaw, ty, 0.75); pitch = lerp(pitch, tp, 0.75);
    if (scope > 0.95 && err < 0.004) {
      const d = camera.getWorldDirection(new THREE.Vector3()), h = rayHit(camera.getWorldPosition(new THREE.Vector3()), d);
      const safe = !people.some(q => q.alive && q.kind === 'civ' && (() => { tv2.copy(q.g.position).add(new THREE.Vector3(0, 1.0 * PS, 0)).sub(camPos0); const along = tv2.dot(d); return along > 0 && along < h.t + 3 && tv2.addScaledVector(d, -along).length() < 1.3; })());
      if (h.type === 'person' && h.p.kind === 'target' && safe) botHold = false;
    }
  },
};

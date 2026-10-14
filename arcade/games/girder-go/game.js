// Girder Go — original game. Drag beams between joints to bridge the gap under budget, press GO and watch the
// little car cross while every beam glows green→red with stress. Over-stressed beams snap.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, lerp, clamp, mat, rounded, burst, confetti } from './kit/hc.js';
import { createSim, stepSim, MATS } from './sim.js';
import { makeLevel, solution, budgetFor, designCost } from './levels.js';

const stage = createStage({ fov: 40, shadows: true, shadowSize: 16 });
const { scene, camera, sun, renderer } = stage;
const ui = createUI({ title: 'GIRDER<br>GO', hint: 'Drag from a red anchor to build', hand: '👆', score: false });
const save = store('girdergo');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), score = save.get('score', 0);
const bot = { i: 0, cleared: false, wait: 0 };
let state = 'ready', mode = 'build', lv, design, sim = null, budget = 0, material = 'road', undoStack = [];

const css = document.createElement('style');
css.textContent = `
.hc-sub{top:calc(54px + env(safe-area-inset-top));font-size:17px;font-weight:800;color:#2f4858;text-shadow:none}
.hc-sub.over{color:#e63946}
.hc-card h1{color:#ff7a3d;text-shadow:0 6px 0 rgba(120,50,0,.18)} .hc-card p,.hc-card .hint{color:#2f4858;text-shadow:none}
.hc-card.dim{background:rgba(30,50,70,.28)} .hc-card.dim p,.hc-card.dim .hint{color:#fff}
.hc-lvl.next{color:#ff7a3d}
.gg-bar{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:center;align-items:flex-end;gap:8px;z-index:7;pointer-events:none;transition:transform .35s cubic-bezier(.3,1.4,.5,1),opacity .3s}
.gg-bar.hide{transform:translateY(140px);opacity:0}
.gg-chip{pointer-events:auto;border:0;font:inherit;background:#fff;border-radius:18px;width:66px;height:70px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#2f4858;font-weight:800;font-size:13px;line-height:1;box-shadow:0 4px 0 rgba(30,60,80,.18);cursor:pointer;transition:transform .15s}
.gg-chip i{display:block;width:40px;height:9px;border-radius:5px}
.gg-chip small{font-size:11px;opacity:.6;font-weight:600}
.gg-chip.on{transform:translateY(-8px);box-shadow:0 0 0 3px #ff7a3d,0 8px 0 rgba(30,60,80,.18)}
.gg-undo{width:50px}
.gg-go{pointer-events:auto;border:0;font:inherit;font-weight:800;font-size:26px;color:#fff;background:#3ccf6e;border-radius:22px;width:86px;height:70px;box-shadow:0 5px 0 #23944b;cursor:pointer}
.gg-go:active,.gg-chip:active{transform:translateY(3px)}
.gg-hint{position:fixed;left:0;right:0;bottom:calc(104px + env(safe-area-inset-bottom));text-align:center;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.18);pointer-events:none;z-index:6;transition:opacity .3s}
.gg-go.pulse{animation:ggp 1s ease-in-out infinite}
@keyframes ggp{50%{transform:scale(1.08)}}
`;
document.head.appendChild(css);
const bar = document.createElement('div'); bar.className = 'gg-bar hide';
bar.innerHTML = `<button class="gg-chip" data-m="road"><i style="background:#555b6e"></i>ROAD<small>$200/m</small></button>
<button class="gg-chip" data-m="wood"><i style="background:#d9984a"></i>WOOD<small>$100/m</small></button>
<button class="gg-chip" data-m="steel"><i style="background:#d94f45"></i>STEEL<small>$320/m</small></button>
<button class="gg-chip gg-undo" data-u>↶<small>undo</small></button>
<button class="gg-go">GO</button>`;
document.body.appendChild(bar);
const hintEl = document.createElement('div'); hintEl.className = 'gg-hint'; document.body.appendChild(hintEl);
const chips = [...bar.querySelectorAll('[data-m]')], goBtn = bar.querySelector('.gg-go');
bar.addEventListener('pointerdown', e => {
  e.stopPropagation();
  const c = e.target.closest('button'); if (!c || state !== 'play' || mode !== 'build') return;
  if (c.dataset.m) { setMaterial(c.dataset.m); tone(600, 0.05, 'triangle', 0.1, 1.3); }
  else if (c.dataset.u !== undefined) undo();
  else if (c === goBtn) go();
});
function setMaterial(m) { material = m; chips.forEach(c => c.classList.toggle('on', c.dataset.m === m)); }
setMaterial('road');

// ------------------------------------------------------------------ themes (low-poly pastel)
const THEMES = [
  { bg: ['#9fd8e8', '#e9f7ef'], fog: '#cfeeea', grass: '#8fd16a', rock: '#e8c79a', rock2: '#d4a877', water: '#4cc3c9', mtn: ['#b9d9c9', '#a5ccbb'], tree: '#4fa36a', ui: '#ff7a3d' },
  { bg: ['#ffc9a8', '#ffefd2'], fog: '#ffe2c4', grass: '#f3d38a', rock: '#e99a6b', rock2: '#cf7d55', water: '#3fb7c4', mtn: ['#f2b48e', '#e8a27d'], tree: '#6fb36a', ui: '#ff7a3d' },
  { bg: ['#bcd3f5', '#f1f5ff'], fog: '#e3ebfa', grass: '#ffffff', rock: '#b4bfd6', rock2: '#9aa6c2', water: '#5aa9d6', mtn: ['#dfe7f7', '#cbd6ee'], tree: '#3f8f78', ui: '#ff7a3d' },
];
const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...o });

let world = new THREE.Group(); scene.add(world);
const water = new THREE.Mesh(new THREE.PlaneGeometry(140, 70, 46, 24), flat('#4cc3c9', { transparent: true, opacity: 0.92, roughness: 0.35 }));
water.rotation.x = -Math.PI / 2; water.receiveShadow = true; scene.add(water);
const wBase = water.geometry.attributes.position.array.slice();

function cliffMesh(side, lvd, th, r) {
  // profile in x,y; extruded along z. side -1 = left cliff (face at L), +1 = right cliff (face at R)
  const edge = side < 0 ? lvd.L : lvd.R, far = edge + side * 22, bot = -lvd.cliffDepth - 4;
  const pts = [[far, 0], [edge, 0]];
  const ys = [-0.5, -1, -1.6, -2.3, -3.1, -4, bot];
  for (const y of ys) { const anchorHere = lvd.anchors.some(a => a.x === edge && a.y === y); pts.push([edge + side * (anchorHere ? 0 : (r() * 0.35 + (y < -2 ? 0.25 : 0.05)) * (y < -2.5 ? -1 : 1)), y]); }
  pts.push([far, bot]);
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  const g = new THREE.ExtrudeGeometry(s, { depth: 16, bevelEnabled: false }); g.translate(0, 0, -10);
  const m = new THREE.Mesh(g, flat(th.rock)); m.castShadow = m.receiveShadow = true; world.add(m);
  const top = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 16), flat(th.grass)); top.position.set(edge + side * 11, -0.13, -2); top.receiveShadow = true; world.add(top);
  // strata stripe
  const st = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 16.04), flat(th.rock2)); st.position.set(edge + side * 11.05, -1.9, -2); world.add(st);
  // trees / rocks dressing
  for (let i = 0; i < 5; i++) {
    const x = edge + side * (2.2 + r() * 9), z = -8 + r() * 6;
    if (lvd.theme === 1 && r() < 0.6) { // cactus
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 6), flat(th.tree)); c.position.set(x, 0.8, z); c.castShadow = true; world.add(c);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 6), flat(th.tree)); a.position.set(x + 0.35, 1.0, z); world.add(a);
    } else {
      const s2 = 0.7 + r() * 0.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s2, 0.1 * s2, 0.5 * s2, 5), flat('#8a6a4a')); trunk.position.set(x, 0.25 * s2, z); world.add(trunk);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((0.75 - k * 0.18) * s2, 0.9 * s2, 6), flat(lvd.theme === 2 && k === 2 ? '#ffffff' : th.tree)); c.position.set(x, (0.75 + k * 0.45) * s2, z); c.castShadow = true; world.add(c); }
    }
  }
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + r() * 0.3, 0), flat(th.rock2)); b.position.set(edge + side * (1.5 + r() * 6), 0.1, -3 + r() * 5 - 2); b.castShadow = true; world.add(b); }
}

// ------------------------------------------------------------------ bridge rendering (instanced)
const MAXB = 120, MAXN = 120;
const sideGeo = new THREE.BoxGeometry(1, 0.17, 0.17), roadGeo = new THREE.BoxGeometry(1, 0.2, 1.7), jointGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.86, 10);
jointGeo.rotateX(Math.PI / 2);
const sideIM = new THREE.InstancedMesh(sideGeo, mat('#ffffff', { roughness: 0.6 }), MAXB * 2);
const roadIM = new THREE.InstancedMesh(roadGeo, mat('#ffffff', { roughness: 0.7 }), MAXB);
const railIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.1), mat('#ffffff', { roughness: 0.5 }), MAXB * 2);
const jointIM = new THREE.InstancedMesh(jointGeo, mat('#ffffff', { roughness: 0.4, metalness: 0.2 }), MAXN);
for (const m of [sideIM, roadIM, railIM, jointIM]) { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); }
const BASE = { road: new THREE.Color('#555b6e'), wood: new THREE.Color('#d9984a'), steel: new THREE.Color('#d94f45') };
const RAIL = new THREE.Color('#f2c14e'), JOINT = new THREE.Color('#e8edf3');
const _o = new THREE.Object3D(), _c = new THREE.Color(), _c2 = new THREE.Color();
function stressColor(s, out) { s = clamp(s, 0, 1); return out.setHSL(lerp(0.36, 0.0, s), 0.85, lerp(0.55, 0.52, s)); }

// anchors + grid + preview
const anchorGroup = new THREE.Group(); scene.add(anchorGroup);
const anchorGeo = new THREE.CylinderGeometry(0.24, 0.24, 2.1, 16); anchorGeo.rotateX(Math.PI / 2);
const anchorMat = mat('#ff4d5e', { roughness: 0.35, emissive: '#5a0010', emissiveIntensity: 0.25 });
const dotIM = new THREE.InstancedMesh(new THREE.CircleGeometry(0.055, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }), 600);
dotIM.frustumCulled = false; scene.add(dotIM);
const preview = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 1.9), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }));
preview.renderOrder = 4; preview.visible = false; scene.add(preview);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false }));
ring.visible = false; ring.renderOrder = 5; scene.add(ring);

// vehicle
const car = new THREE.Group(); scene.add(car);
const carBody = new THREE.Group(); car.add(carBody);
const wheelsM = [];
function buildVehicle(v) {
  carBody.clear(); wheelsM.forEach(w => car.remove(w)); wheelsM.length = 0;
  const truck = v.kind === 'truck', col = truck ? '#3a86ff' : '#ffcf3f';
  const len = v.axle + 0.9;
  const b = new THREE.Mesh(rounded(len, 0.5, 1.2, 0.16), mat(col, { roughness: 0.35 })); b.position.y = 0.35; b.castShadow = true; carBody.add(b);
  if (truck) {
    const cab = new THREE.Mesh(rounded(0.8, 0.65, 1.15, 0.14), mat(col, { roughness: 0.35 })); cab.position.set(len / 2 - 0.45, 0.9, 0); cab.castShadow = true; carBody.add(cab);
    const win = new THREE.Mesh(rounded(0.3, 0.32, 1.18, 0.08), mat('#2b3a55', { roughness: 0.15 })); win.position.set(len / 2 - 0.22, 0.98, 0); carBody.add(win);
    const box = new THREE.Mesh(rounded(len - 0.95, 0.9, 1.2, 0.08), mat('#f4f1ea', { roughness: 0.6 })); box.position.set(-0.45, 1.05, 0); box.castShadow = true; carBody.add(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len - 0.9, 0.14, 1.22), mat('#ff7a3d')); stripe.position.set(-0.45, 1.05, 0); carBody.add(stripe);
  } else {
    const cab = new THREE.Mesh(rounded(1.05, 0.5, 1.05, 0.2), mat(col, { roughness: 0.35 })); cab.position.set(-0.1, 0.78, 0); cab.castShadow = true; carBody.add(cab);
    const win = new THREE.Mesh(rounded(1.0, 0.32, 1.08, 0.12), mat('#2b3a55', { roughness: 0.15 })); win.position.set(-0.1, 0.8, 0); carBody.add(win);
    for (const z of [-0.3, 0.3]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat('#fff6c8', { emissive: '#fff2a0', emissiveIntensity: 0.7 })); l.position.set(len / 2, 0.4, z); carBody.add(l); }
  }
  for (let i = 0; i < 2; i++) for (const z of [-0.62, 0.62]) {
    const w = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r, 0.3, 14), mat('#2a2a33', { roughness: 0.8 })); t.rotation.x = Math.PI / 2; t.castShadow = true; w.add(t);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(v.r * 0.45, v.r * 0.45, 0.32, 8), mat('#e8edf3')); hub.rotation.x = Math.PI / 2; w.add(hub);
    w.userData = { i, z }; car.add(w); wheelsM.push(w);
  }
}
// finish flag
const flag = new THREE.Group(); scene.add(flag);
{ const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), mat('#ffffff')); pole.position.y = 1.1; pole.castShadow = true; flag.add(pole);
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 40; const cx = cv.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { cx.fillStyle = (i + j) % 2 ? '#222' : '#fff'; cx.fillRect(i * 8, j * 8, 8, 8); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56, 6, 1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 })); f.position.set(0.47, 1.9, 0); flag.add(f); flag.cloth = f; }

// background: low-poly mountains + clouds
const bgGroup = new THREE.Group(); scene.add(bgGroup);
function buildBackground(th, r) {
  bgGroup.clear();
  for (let i = 0; i < 9; i++) {
    const h = 6 + r() * 9, m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h, 5 + Math.floor(r() * 2)), flat(th.mtn[i % 2]));
    m.position.set(-36 + i * 9 + r() * 4, h / 2 - 3, -34 - r() * 10); m.rotation.y = r() * 3; bgGroup.add(m);
    if (lv.theme === 2 || r() < 0.3) { const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9 * 0.28, h * 0.28, m.geometry.parameters.radialSegments), flat('#ffffff')); cap.position.set(m.position.x, m.position.y + h * 0.36, m.position.z); cap.rotation.y = m.rotation.y; bgGroup.add(cap); }
  }
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group(); for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + r() * 0.6, 0), flat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.25 })); s.position.set(k * 1.1 - 1.1, (k === 1 ? 0.4 : 0), 0); c.add(s); }
    c.position.set(-24 + i * 12 + r() * 5, 9 + r() * 5, -26 - r() * 6); c.userData.sp = 0.2 + r() * 0.3; bgGroup.add(c);
  }
}

// ------------------------------------------------------------------ level / design management
function rngf(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
let th = THEMES[0], gridPts = [];
function buildLevel(keepDesign = false) {
  lv = makeLevel(level); th = THEMES[lv.theme];
  document.body.style.setProperty('--bg1', th.bg[0]); document.body.style.setProperty('--bg2', th.bg[1]); document.body.style.setProperty('--ui', th.ui);
  scene.fog = new THREE.Fog(th.fog, 40, 90);
  scene.remove(world); world = new THREE.Group(); scene.add(world);
  const r = rngf(lv.seed);
  cliffMesh(-1, lv, th, r); cliffMesh(1, lv, th, r);
  if (lv.pillar) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.3, lv.cliffDepth + 4, 6), flat(th.rock)); p.position.set(0, -(lv.cliffDepth + 4) / 2, -0.2); p.castShadow = p.receiveShadow = true; world.add(p);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 6), flat(th.grass)); cap.position.set(0, -0.15, -0.2); world.add(cap);
  }
  water.material.color.set(th.water); water.position.y = -lv.cliffDepth;
  buildBackground(th, r);
  // anchors
  anchorGroup.clear();
  for (const a of lv.anchors) { const m = new THREE.Mesh(anchorGeo, anchorMat); m.position.set(a.x, a.y, 0); m.castShadow = true; anchorGroup.add(m); }
  // grid dots
  gridPts = [];
  for (let x = lv.L - 1; x <= lv.R + 1; x++) for (let y = -lv.cliffDepth + 1; y <= 4; y++) if (!inRock(x, y)) gridPts.push([x, y]);
  dotIM.count = gridPts.length; gridPts.forEach(([x, y], i) => { _o.position.set(x, y, 0.95); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix(); dotIM.setMatrixAt(i, _o.matrix); }); dotIM.instanceMatrix.needsUpdate = true;
  budget = budgetFor(lv);
  if (!keepDesign || !design) { design = { nodes: lv.anchors.map(a => ({ x: a.x, y: a.y, fixed: true })), beams: [] }; undoStack = []; }
  buildVehicle(lv.vehicle);
  flag.position.set(lv.R + 1.7, 0, -1.0);
  sim = null; mode = 'build'; simT = 0; carPos(lv.L - 3.2, lv.L - 3.2 + lv.vehicle.axle, lv.vehicle.r, lv.vehicle.r);
  ui.levels(level); ui.progress(0); updateBudget(); setBar(true); dotIM.visible = true; anchorGroup.visible = true;
  bot.i = 0; bot.cleared = false; bot.wait = 0;
  frameCam(true);
}
function inRock(x, y) {
  if (lv.anchors.some(a => a.x === x && a.y === y)) return false;
  if ((x <= lv.L || x >= lv.R) && y <= 0) return true;
  if (lv.pillar && Math.abs(x) <= 0.5 && y <= 0) return true;
  return false;
}
function cost() { return Math.round(designCost(design)); }
function updateBudget() {
  const c = cost(); ui.sub(`$${c.toLocaleString()} / $${budget.toLocaleString()}`); ui.els.sub.classList.toggle('over', c > budget);
  goBtn.classList.toggle('pulse', design.beams.some(b => b.type === 'road') && mode === 'build');
}
function setBar(show) { bar.classList.toggle('hide', !show); hintEl.style.opacity = show ? 1 : 0;
  hintEl.textContent = !show ? '' : level === 1 ? 'Drag from the red anchors · make triangles!' : level === 2 ? 'Tap a beam to delete it' : lv.low ? 'Lower anchors can prop the deck' : lv.pillar ? 'Use the rock in the middle' : lv.vehicle.kind === 'truck' ? 'Heavy truck – go stronger' : ''; }
function nodeAt(x, y) { return design.nodes.findIndex(n => n.x === x && n.y === y); }
function beamLen(b) { const A = design.nodes[b.a], B = design.nodes[b.b]; return Math.hypot(A.x - B.x, A.y - B.y); }
function addBeam(x1, y1, x2, y2, type, quiet = false) {
  if (x1 === x2 && y1 === y2) return false;
  if (Math.hypot(x2 - x1, y2 - y1) > MATS[type].maxLen + 1e-6) return false;
  let a = nodeAt(x1, y1), b = nodeAt(x2, y2);
  const exists = a >= 0 && b >= 0 && design.beams.some(bm => (bm.a === a && bm.b === b) || (bm.a === b && bm.b === a));
  if (exists) return false;
  const addCost = Math.hypot(x2 - x1, y2 - y1) * MATS[type].cost;
  if (cost() + addCost > budget + 0.5) { if (!quiet) { ui.pop('OVER BUDGET', '#e63946', 30, 30); buzz(30); tone(180, 0.15, 'square', 0.08, 0.7); } return false; }
  const before = design.nodes.length;
  if (a < 0) { design.nodes.push({ x: x1, y: y1 }); a = design.nodes.length - 1; }
  if (b < 0) { design.nodes.push({ x: x2, y: y2 }); b = design.nodes.length - 1; }
  design.beams.push({ a, b, type, born: performance.now() });
  undoStack.push({ kind: 'add', nodes: design.nodes.length - before });
  tone(type === 'steel' ? 300 : type === 'road' ? 220 : 420, 0.08, 'triangle', 0.13, 1.4); buzz(8);
  burst(scene, new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, 0.6), [BASE[type].getStyle(), '#ffffff'], 6, { speed: 0.05, up: 0.04, size: 0.4, life: 0.5 });
  updateBudget(); return true;
}
function removeBeam(i) {
  const b = design.beams[i]; design.beams.splice(i, 1);
  // drop orphan nodes (re-index)
  const used = new Set(); design.beams.forEach(bm => { used.add(bm.a); used.add(bm.b); });
  const keep = design.nodes.map((n, k) => n.fixed || used.has(k)), map = []; let j = 0;
  design.nodes.forEach((n, k) => { map[k] = keep[k] ? j++ : -1; });
  design.nodes = design.nodes.filter((n, k) => keep[k]); design.beams.forEach(bm => { bm.a = map[bm.a]; bm.b = map[bm.b]; });
  tone(260, 0.1, 'sine', 0.12, 0.5); updateBudget(); return b;
}
function undo() {
  if (!design.beams.length) return;
  removeBeam(design.beams.length - 1); undoStack.pop(); buzz(6);
}

// ------------------------------------------------------------------ input (drag to build, tap a beam to delete)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3();
function toWorld(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hitP) ? { x: hitP.x, y: hitP.y } : null; }
let drag = null;
function snapEnd(sx, sy, wx, wy) {
  const maxL = MATS[material].maxLen; let dx = wx - sx, dy = wy - sy; const d = Math.hypot(dx, dy);
  if (d > maxL) { dx *= maxL / d; dy *= maxL / d; }
  let best = null, bd = 1e9;
  for (let x = Math.floor(sx - maxL); x <= Math.ceil(sx + maxL); x++) for (let y = Math.floor(sy - maxL); y <= Math.ceil(sy + maxL); y++) {
    if (x === sx && y === sy) continue; if (Math.hypot(x - sx, y - sy) > maxL + 1e-6) continue; if (inRock(x, y) || y > 4) continue;
    const e = Math.hypot(x - (sx + dx), y - (sy + dy)); if (e < bd) { bd = e; best = [x, y]; }
  }
  return best;
}
input({
  onDown(e) {
    if (state !== 'play' || mode !== 'build') return;
    const w = toWorld(e.clientX, e.clientY); if (!w) return;
    let bi = -1, bd = 0.75;
    design.nodes.forEach((n, i) => { const d = Math.hypot(n.x - w.x, n.y - w.y); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) { const n = design.nodes[bi]; drag = { sx: n.x, sy: n.y, end: null }; ring.visible = true; ring.position.set(n.x, n.y, 1.1); tone(500, 0.04, 'sine', 0.1, 1.2); }
    else drag = { tapOnly: true, w };
  },
  onMove(dx, dy, e) {
    if (!drag || drag.tapOnly) return;
    const w = toWorld(e.clientX, e.clientY); if (!w) return;
    const end = snapEnd(drag.sx, drag.sy, w.x, w.y);
    if (end && (!drag.end || end[0] !== drag.end[0] || end[1] !== drag.end[1])) tone(700 + end[1] * 30, 0.025, 'sine', 0.05, 1);
    drag.end = end;
  },
  onUp(e) {
    const d = drag; drag = null; ring.visible = false; preview.visible = false;
    if (!d || state !== 'play' || mode !== 'build') return;
    if (d.tapOnly) {   // tap near a beam → delete it
      let bi = -1, bd = 0.35;
      design.beams.forEach((b, i) => { const A = design.nodes[b.a], B = design.nodes[b.b]; const ex = B.x - A.x, ey = B.y - A.y, L2 = ex * ex + ey * ey; let t = ((d.w.x - A.x) * ex + (d.w.y - A.y) * ey) / L2; t = clamp(t, 0, 1); const dd = Math.hypot(A.x + ex * t - d.w.x, A.y + ey * t - d.w.y); if (dd < bd) { bd = dd; bi = i; } });
      if (bi >= 0) { const b = design.beams[bi], A = design.nodes[b.a], B = design.nodes[b.b]; burst(scene, new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, 0.6), BASE[b.type].getStyle(), 8, { speed: 0.08, size: 0.5 }); removeBeam(bi); buzz(12); }
      return;
    }
    if (d.end) addBeam(d.sx, d.sy, d.end[0], d.end[1], material);
  },
});

// ------------------------------------------------------------------ simulation
let simT = 0, shake = 0, debris = [], stuckT = 0, lastX = 0, broken = 0;
function go() {
  if (!design.beams.some(b => b.type === 'road')) { ui.pop('BUILD A ROAD FIRST', '#2f4858', 26, 30); buzz(20); return; }
  const v = lv.vehicle;
  sim = createSim(design, [[lv.L - 14, 0, lv.L, 0], [lv.R, 0, lv.R + 14, 0], ...(lv.pillar ? [] : [])], { x: lv.L - 3.2, y: v.r, axle: v.axle, r: v.r, wheelMass: v.wheelMass, speed: v.speed });
  mode = 'sim'; simT = 0; stuckT = 0; lastX = sim.wheels[1].x; broken = 0;
  setBar(false); dotIM.visible = false;
  tone(330, 0.12, 'square', 0.07, 1); setTimeout(() => tone(330, 0.12, 'square', 0.07, 1), 160);
  ui.pop('GO!', '#3ccf6e', 52, 30); buzz(15);
}
function snap(b) {
  const A = sim.nodes[b.a], B = sim.nodes[b.b], mid = new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, 0);
  broken++; shake = Math.min(0.7, shake + 0.35); buzz([25, 20, 25]); ui.flash(0.25);
  tone(160 + Math.random() * 60, 0.18, 'sawtooth', 0.11, 0.4); tone(900, 0.06, 'square', 0.06, 0.3);
  burst(scene, mid.clone().setZ(0.8), [BASE[b.type].getStyle(), '#ffffff', '#ffd23f'], 14, { speed: 0.14, up: 0.08, size: 0.55 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.rest / 2, 0.17, 0.17), mat(BASE[b.type].getStyle()));
    m.position.set(mid.x + s * 0.25, mid.y, 0.8); m.rotation.z = Math.atan2(B.y - A.y, B.x - A.x); m.castShadow = true; scene.add(m);
    debris.push({ m, vx: s * (1 + Math.random()), vy: 1 + Math.random() * 2, vr: (Math.random() - 0.5) * 8 });
  }
  if (broken === 1) ui.pop('SNAP!', '#e63946', 44, 30);
}
function carPos(x0, x1, y0, y1, roll = 0) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ang = Math.atan2(y1 - y0, x1 - x0);
  car.position.set(cx, cy, 0); car.rotation.z = ang;
  carBody.position.y = 0.0 + Math.sin(simT * 30) * 0.008;
  const half = Math.hypot(x1 - x0, y1 - y0) / 2;
  for (const w of wheelsM) { w.position.set(w.userData.i ? half : -half, 0, w.userData.z); w.rotation.z = -roll; }
}
let roll = 0;
function win() {
  state = 'won'; mode = 'done'; sfx.win(); buzz([20, 40, 20]);
  confetti(scene, new THREE.Vector3(lv.R + 1.7, 2.5, 0), 90);
  const c = cost(), saved = Math.max(0, budget - c), pts = 100 + Math.round(saved / 10) - broken * 10;
  score += Math.max(10, pts); save.set('score', score);
  if (score > best) { best = score; save.set('best', best); }
  ui.pop(broken ? 'MADE IT!' : 'PERFECT BRIDGE!', '#ffd23f', 44, 28);
  setTimeout(() => solution(makeLevel(level + 1)), 900);   // precompute next level's reference design while the card shows
  ui.win(level, `$${c.toLocaleString()} spent · ${broken ? broken + ' beams snapped' : 'nothing snapped'}`);
}
function lose(why) {
  state = 'lost'; mode = 'done'; sfx.fail(); buzz([40, 30, 60]);
  ui.lose(why === 'stuck' ? 'STUCK!' : 'SPLASH!', why === 'stuck' ? 'The car can\'t get across' : 'Add triangles to stiffen it');
}

// ------------------------------------------------------------------ frame
ui.onTap(w => {
  if (w === 'start') { state = 'play'; buildLevel(); }
  else if (w === 'win') { level++; save.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; buildLevel(true); }
});
const camPos = new THREE.Vector3(), camAt = new THREE.Vector3();
let camFocusX = 0;
function frameCam(instant) {
  const W = lv.gap + 5.2, asp = camera.aspect, vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * asp);
  let D = W / 2 / Math.tan(hfov / 2); D = Math.max(D, 11);
  const fx = mode === 'sim' && sim ? clamp((sim.wheels[0].x + sim.wheels[1].x) / 2, lv.L, lv.R) * (D > 26 ? 0.25 : 0) : 0;
  camFocusX = fx;
  camPos.set(fx, 2.6 + D * 0.16, D); camAt.set(fx, 0.4 - D * 0.02, 0);
  if (instant) { camera.position.copy(camPos); camera.lookAt(camAt); }
}
let t = 0;
const camCur = new THREE.Vector3(), atCur = new THREE.Vector3();
loop((dt60, ts) => {
  const dt = Math.min(dt60 / 60, 1 / 30); t += dt;
  // water waves
  const pa = water.geometry.attributes.position.array;
  for (let i = 0; i < pa.length; i += 3) pa[i + 2] = Math.sin(wBase[i] * 0.5 + t * 1.3) * 0.12 + Math.cos(wBase[i + 1] * 0.6 + t * 1.1) * 0.1;
  water.geometry.attributes.position.needsUpdate = true; water.geometry.computeVertexNormals();
  for (const c of bgGroup.children) if (c.userData.sp) { c.position.x += c.userData.sp * dt; if (c.position.x > 40) c.position.x = -40; }
  flag.cloth.rotation.y = Math.sin(t * 4) * 0.25;

  let nodes = design.nodes, beams = design.beams, stress = null;
  if (mode === 'sim' && sim) {
    simT += dt;
    stepSim(sim, 1 / 60, 30);
    for (const b of sim.broke.splice(0)) snap(b);
    nodes = sim.nodes; beams = sim.beams; stress = true;
    const [w0, w1] = sim.wheels; roll += (w1.vx * dt) / lv.vehicle.r;
    carPos(w0.x, w1.x, w0.y, w1.y, roll);
    const prog = clamp((w0.x - (lv.L - 3.2)) / (lv.R + 0.9 - (lv.L - 3.2)), 0, 1); ui.progress(prog);
    if (w1.x - lastX > 0.3) { lastX = w1.x; stuckT = 0; } else stuckT += dt;
    if (state === 'play') {
      if (w0.x > lv.R + 0.9) win();
      else if (w0.y < -lv.cliffDepth + 0.2 || w1.y < -lv.cliffDepth + 0.2) { burst(scene, new THREE.Vector3(car.position.x, -lv.cliffDepth + 0.3, 0.5), ['#ffffff', th.water, '#bff3f5'], 30, { speed: 0.16, up: 0.22, shape: 'sphere', size: 0.8 }); shake = 0.6; tone(120, 0.4, 'sine', 0.2, 0.4); lose('fall'); }
      else if (stuckT > 4) lose('stuck');
    }
  } else if (mode === 'done' && sim) {
    stepSim(sim, 1 / 60, 30); for (const b of sim.broke.splice(0)) snap(b);
    nodes = sim.nodes; beams = sim.beams; stress = true;
    const [w0, w1] = sim.wheels; if (w0.y > -lv.cliffDepth - 1) { roll += (w1.vx * dt) / lv.vehicle.r; carPos(w0.x, w1.x, w0.y, w1.y, roll); }
    if (state === 'won') sim.drive = 1.5;
  }
  // bridge instances
  let si = 0, ri = 0, rli = 0; const now = performance.now();
  for (const b of beams) {
    if (b.broken) continue;
    const A = nodes[b.a], B = nodes[b.b], len = Math.hypot(B.x - A.x, B.y - A.y), ang = Math.atan2(B.y - A.y, B.x - A.x);
    const pop = b.born ? clamp((now - b.born) / 220, 0, 1) : 1, sq = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.6 : 1;
    const base = BASE[b.type];
    if (stress) { stressColor(b.stress, _c2); _c.copy(base).lerp(_c2, 0.8); } else _c.copy(base);
    if (b.type === 'road') {
      _o.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, 0); _o.rotation.set(0, 0, ang); _o.scale.set(len * pop, sq, 1); _o.translateY(-0.1); _o.updateMatrix(); roadIM.setMatrixAt(ri, _o.matrix); roadIM.setColorAt(ri++, _c);
      for (const z of [-0.88, 0.88]) { _o.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, z); _o.rotation.set(0, 0, ang); _o.scale.set(len * pop, 1, 1); _o.translateY(-0.02); _o.updateMatrix(); railIM.setMatrixAt(rli, _o.matrix); railIM.setColorAt(rli++, stress ? _c2 : RAIL); }
    } else {
      for (const z of [-0.8, 0.8]) { _o.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, z); _o.rotation.set(0, 0, ang); _o.scale.set(len * pop, sq, sq); _o.updateMatrix(); sideIM.setMatrixAt(si, _o.matrix); sideIM.setColorAt(si++, _c); }
    }
  }
  sideIM.count = si; roadIM.count = ri; railIM.count = rli;
  let ji = 0;
  nodes.forEach((n, i) => { if (design.nodes[i] && design.nodes[i].fixed) return; _o.position.set(n.x, n.y, 0); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix(); jointIM.setMatrixAt(ji, _o.matrix); jointIM.setColorAt(ji++, JOINT); });
  jointIM.count = ji;
  for (const m of [sideIM, roadIM, railIM, jointIM]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  // anchors pulse in build mode
  anchorGroup.children.forEach((a, i) => a.scale.setScalar(mode === 'build' ? 1 + Math.sin(t * 4 + i) * 0.06 : 1));
  // drag preview
  if (drag && !drag.tapOnly && drag.end) {
    const [ex, ey] = drag.end, len = Math.hypot(ex - drag.sx, ey - drag.sy), over = cost() + len * MATS[material].cost > budget;
    preview.visible = true; preview.position.set((drag.sx + ex) / 2, (drag.sy + ey) / 2, 0); preview.rotation.set(0, 0, Math.atan2(ey - drag.sy, ex - drag.sx)); preview.scale.set(len, 1, material === 'road' ? 1 : 0.15);
    preview.material.color.set(over ? '#ff4d5e' : BASE[material]); ring.scale.setScalar(1 + Math.sin(t * 10) * 0.08);
  } else preview.visible = false;
  // debris
  for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.vy -= 9.8 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.rotation.z += d.vr * dt;
    if (d.m.position.y < -lv.cliffDepth) { burst(scene, d.m.position.clone().setY(-lv.cliffDepth + 0.1), ['#ffffff', '#bff3f5'], 8, { speed: 0.08, up: 0.12, shape: 'sphere', size: 0.5 }); tone(300, 0.08, 'sine', 0.06, 0.5); scene.remove(d.m); d.m.geometry.dispose(); debris.splice(i, 1); } }
  // camera
  frameCam(false);
  const k = 1 - Math.pow(0.05, dt);
  camCur.lerp(camPos, k); atCur.lerp(camAt, k);
  if (camCur.lengthSq() === 0) { camCur.copy(camPos); atCur.copy(camAt); }
  shake = Math.max(0, shake - dt * 1.6);
  camera.position.copy(camCur).add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.4, (Math.random() - 0.5) * shake * 0.4, 0)); camera.lookAt(atCur);
  stage.followLight(new THREE.Vector3(0, 0, 0));
});
buildLevel();
camCur.copy(camPos); atCur.copy(camAt);
ui.start();

// ------------------------------------------------------------------ test hooks: bot builds the known-good design one beam per call, then presses GO
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  screen(x, y) { const v = new THREE.Vector3(x, y, 0).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
  get info() { return { mode, cost: cost(), budget, beams: design.beams.length }; },
  bot() {
    if (state !== 'play' || mode !== 'build') return;
    const sol = solution(lv);
    if (!bot.cleared) { while (design.beams.length) removeBeam(design.beams.length - 1); bot.cleared = true; return; }
    if (bot.i < sol.beams.length) {
      const b = sol.beams[bot.i++], A = sol.nodes[b.a], B = sol.nodes[b.b];
      setMaterial(b.type); addBeam(A.x, A.y, B.x, B.y, b.type, true); return;
    }
    if (bot.wait++ > 2) go();
  },
};

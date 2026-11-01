// Girder Go deep v2 — same bridge game, now 36 hand-made crossings in 3 worlds, stars, a map, a garage and a daily bridge.
// (v1 = v1.js.) Original game. Drag beams between joints to bridge the gap under budget, press GO and watch the
// little car cross while every beam glows green→red with stress. Over-stressed beams snap.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, lerp, clamp, mat, rounded, burst, confetti } from './kit/hc.js';
import { createSim, stepSim, MATS } from './sim.js';
import { WORLDS, NL, levelOf, dailyLevel, groundOf, solution, budgetFor, parOf, designCost } from './levels2.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { adapter } from './kit/adapt.js';
import { demo } from './kit/demo.js';

const stage = createStage({ fov: 40, shadows: true, shadowSize: 16 });
const { scene, camera, sun, renderer } = stage;
const ui = createUI({ title: 'GIRDER<br>GO', hint: 'Tap a red anchor, then tap where to build · or drag', hand: '👆', score: false });
const save = store('girdergo2');
const F = flow('girdergo');
const B = board({ game: 'girder-go', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });
let runProg = 0;
// ------------------------------------------------------------------ in-round adaptation (ADAPT_BRIEF.md): honest + bounded
// Signals: beams placed, OVER BUDGET bumps, snapped beams, failed and passed tests in the last 20 s. Knobs (set at each build /
// retry and each GO, never mid-drive): budget slack (AD.k with flow.js, ±25 % in total, never below the reference design's
// cost) and the vehicle's weight (±12 %; the reference design holds 40 % more). Level 1, and any level after a failed test,
// never gets harder; a retry's budget never shrinks. Scores use the unadapted budget. Rescue: once a round and 60 s apart,
// for an active player whose deck spans the gap and is braced: when the deck first snaps under the car, it creaks and holds. QA reads window.__game.adapt.
const AD = adapter(); let inAt = 0, budget0 = 0, fails = 0;   // fails = failed tests on this level: after one it never gets harder
addEventListener('pointerdown', () => { inAt = performance.now(); }, true);
const adk = (fk, r) => { const k = AD.k(fk, r); return level < 2 || fails ? Math.min(k, fk) : k; };
const Q = new URLSearchParams(location.search);
let prog = save.get('p', {}), garageSel = save.get('car', 0), seenCars = save.get('seenCars', 1), dly = save.get('daily', { last: 0, streak: 0, days: 0, best: 0 });
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const yest = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayNum(d); };
const persist = () => { save.set('p', prog); save.set('car', garageSel); save.set('seenCars', seenCars); save.set('daily', dly); };
const starsOf = n => (prog[n] && prog[n].s) || 0;
const totalStars = () => { let t = 0; for (let i = 1; i <= NL; i++) t += starsOf(i); return t + (dly.days || 0); };
const isOpen = n => n === 1 || starsOf(n - 1) >= 1 || starsOf(n) >= 1;
const nextOpen = () => { for (let i = 1; i <= NL; i++) if (starsOf(i) < 1) return i; return NL; };
const GARAGE = [
  { name: 'Sunny Car', need: 0, col: '#ffcf3f' }, { name: 'Mint Mini', need: 3, col: '#4fd6a0' }, { name: 'Cherry Rod', need: 8, col: '#e63946' },
  { name: 'Taxi', need: 14, col: '#ffd60a', roof: '#222' }, { name: 'Sky Cruiser', need: 22, col: '#4cc9f0' }, { name: 'Grape Racer', need: 32, col: '#9d4edd', stripe: '#fff' },
  { name: 'Night Rider', need: 44, col: '#2b2d42', stripe: '#ff7a3d' }, { name: 'Gold Champ', need: 60, col: '#ffd23f', stripe: '#e63946' },
];
const unlockedCars = () => GARAGE.filter(g => totalStars() >= g.need).length;
const nextCar = () => GARAGE.find(g => g.need > totalStars());
let gold = null, goldGot = false, goldCoins = +(save.get('gold') || 0);
let level = Math.min(NL, +Q.get('level') || nextOpen()), isDaily = false, best = save.get('best', 0), score = save.get('score', 0), weak = new Set();
const bot = { i: 0, cleared: false, wait: 0 };
let state = 'ready', mode = 'build', lv, design, sim = null, budget = 0, material = 'road', undoStack = [], par = 0, hot = new Set();

const css = document.createElement('style');
css.textContent = `
.hc-sub{top:calc(54px + env(safe-area-inset-top));font-size:17px;font-weight:800;color:#2f4858;text-shadow:none}
.hc-sub.over{color:#e63946}
.hc-card h1{color:#ff7a3d;text-shadow:0 6px 0 rgba(120,50,0,.18)} .hc-card p,.hc-card .hint{color:#2f4858;text-shadow:none}
.hc-card.dim{background:rgba(30,50,70,.28)} .hc-card.dim p,.hc-card.dim .hint{color:#fff}
.hc-lvl.next{color:#ff7a3d}
.gg-bar{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;justify-content:center;align-items:flex-end;gap:6px;z-index:7;pointer-events:none;transition:transform .35s cubic-bezier(.3,1.4,.5,1),opacity .3s}
.gg-bar.hide{transform:translateY(140px);opacity:0}
.gg-chip{pointer-events:auto;border:0;font:inherit;background:#fff;border-radius:18px;width:58px;height:70px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#2f4858;font-weight:800;font-size:13px;line-height:1;box-shadow:0 4px 0 rgba(30,60,80,.18);cursor:pointer;transition:transform .15s}
.gg-chip i{display:block;width:40px;height:9px;border-radius:5px}
.gg-chip small{font-size:11px;opacity:.6;font-weight:600}
.gg-chip.on{transform:translateY(-8px);box-shadow:0 0 0 3px #ff7a3d,0 8px 0 rgba(30,60,80,.18)}
.gg-undo{width:50px}
.gg-go{pointer-events:auto;border:0;font:inherit;font-weight:800;font-size:26px;color:#fff;background:#3ccf6e;border-radius:22px;width:92px;height:70px;box-shadow:0 5px 0 #23944b;cursor:pointer}
.gg-go:active,.gg-chip:active{transform:translateY(3px)}
.gg-hint{position:fixed;left:0;right:0;bottom:calc(104px + env(safe-area-inset-bottom));text-align:center;font-weight:800;font-size:15px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.18);pointer-events:none;z-index:6;transition:opacity .3s}
.gg-fast{position:fixed;right:14px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:8;border:0;font:inherit;font-weight:800;font-size:24px;color:#fff;background:#ff7a3d;border-radius:20px;width:84px;height:62px;box-shadow:0 5px 0 #b8501f;cursor:pointer;display:none}.gg-fast.on{display:block}
.gg-go.pulse{animation:ggp 1s ease-in-out infinite}
@keyframes ggp{50%{transform:scale(1.08)}}
`;
document.head.appendChild(css);
const bar = document.createElement('div'); bar.className = 'gg-bar hide';
bar.innerHTML = `<button class="gg-chip" data-m="road"><i style="background:#555b6e"></i>ROAD<small>$200/m</small></button>
<button class="gg-chip" data-m="wood"><i style="background:#d9984a"></i>WOOD<small>$100/m</small></button>
<button class="gg-chip" data-m="steel"><i style="background:#d94f45"></i>STEEL<small>$320/m</small></button>
<button class="gg-chip gg-undo gg-brace" data-b style="display:none">▲<small>brace</small></button>
<button class="gg-chip gg-undo" data-u>↶<small>undo</small></button>
<button class="gg-go">GO</button>`;
document.body.appendChild(bar);
const fastBtn = document.createElement('button'); fastBtn.className = 'gg-fast'; fastBtn.textContent = '»'; document.body.appendChild(fastBtn);
let speedMul = 1;
fastBtn.addEventListener('pointerdown', e => { e.stopPropagation(); speedMul = speedMul === 1 ? 2 : speedMul === 2 ? 4 : 1; fastBtn.textContent = speedMul === 1 ? '»' : speedMul === 2 ? '»»' : '»»»»'; tone(500 + speedMul * 150, 0.06, 'triangle', 0.1, 1.2); });
const hintEl = document.createElement('div'); hintEl.className = 'gg-hint'; document.body.appendChild(hintEl);
const chips = [...bar.querySelectorAll('[data-m]')], goBtn = bar.querySelector('.gg-go');
bar.addEventListener('pointerdown', e => {
  e.stopPropagation();
  const c = e.target.closest('button'); if (!c || state !== 'play' || mode !== 'build') return;
  if (c.dataset.m) { setMaterial(c.dataset.m); tone(600, 0.05, 'triangle', 0.1, 1.3); }
  else if (c.dataset.u !== undefined) undo();
  else if (c.dataset.b !== undefined) brace();
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
  // profile in x,y; extruded along z. side -1 = left cliff (face at L), +1 = right cliff (face at R). Built with its top at y=0 inside a group lifted to the cliff height.
  const edge = side < 0 ? lvd.L : lvd.R, topY = side < 0 ? 0 : lvd.yR, far = edge + side * 22, bot = -lvd.cliffDepth - 4 - topY;
  const grp = new THREE.Group(); grp.position.y = topY; world.add(grp);
  const pts = [[far, 0], [edge, 0]];
  const ys = [-0.5, -1, -1.6, -2.3, -3.1, -4, bot];
  for (const y of ys) { const anchorHere = lvd.anchors.some(a => a.x === edge && a.y === y + topY); pts.push([edge + side * (anchorHere ? 0 : (r() * 0.35 + (y < -2 ? 0.25 : 0.05)) * (y < -2.5 ? -1 : 1)), y]); }
  pts.push([far, bot]);
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  const g = new THREE.ExtrudeGeometry(s, { depth: 16, bevelEnabled: false }); g.translate(0, 0, -10);
  const m = new THREE.Mesh(g, flat(th.rock)); m.castShadow = m.receiveShadow = true; grp.add(m);
  const top = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 16), flat(th.grass)); top.position.set(edge + side * 11, -0.13, -2); top.receiveShadow = true; grp.add(top);
  const st = new THREE.Mesh(new THREE.BoxGeometry(22, 0.25, 16.04), flat(th.rock2)); st.position.set(edge + side * 11.05, -1.9, -2); grp.add(st);
  for (let i = 0; i < 5; i++) {
    const x = edge + side * (2.2 + r() * 9), z = -8 + r() * 6;
    if (lvd.theme === 1 && r() < 0.6) { // cactus
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 6), flat(th.tree)); c.position.set(x, 0.8, z); c.castShadow = true; grp.add(c);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 6), flat(th.tree)); a.position.set(x + 0.35, 1.0, z); grp.add(a);
    } else {
      const s2 = 0.7 + r() * 0.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s2, 0.1 * s2, 0.5 * s2, 5), flat('#8a6a4a')); trunk.position.set(x, 0.25 * s2, z); grp.add(trunk);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry((0.75 - k * 0.18) * s2, 0.9 * s2, 6), flat(lvd.theme === 2 && k === 2 ? '#ffffff' : th.tree)); c.position.set(x, (0.75 + k * 0.45) * s2, z); c.castShadow = true; grp.add(c); }
    }
  }
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + r() * 0.3, 0), flat(th.rock2)); b.position.set(edge + side * (1.5 + r() * 6), 0.1, -3 + r() * 5 - 2); b.castShadow = true; grp.add(b); }
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
const culprit = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 28), new THREE.MeshBasicMaterial({ color: '#ff4d5e', transparent: true, opacity: 0.95, depthTest: false }));
culprit.visible = false; culprit.renderOrder = 6; scene.add(culprit);

// vehicle
const car = new THREE.Group(); scene.add(car);
const carBody = new THREE.Group(); car.add(carBody);
const wheelsM = [];
function buildVehicle(v) {
  carBody.clear(); wheelsM.forEach(w => car.remove(w)); wheelsM.length = 0;
  const truck = v.kind === 'truck', bus = v.kind === 'bus', gar = GARAGE[garageSel] || GARAGE[0], col = gar.col;
  const len = v.axle + 0.9;
  const b = new THREE.Mesh(rounded(len, 0.5, 1.2, 0.16), mat(col, { roughness: 0.35 })); b.position.y = 0.35; b.castShadow = true; carBody.add(b);
  if (bus) {
    const bb = new THREE.Mesh(rounded(len + 0.2, 0.95, 1.2, 0.14), mat(col, { roughness: 0.4 })); bb.position.set(0, 0.95, 0); bb.castShadow = true; carBody.add(bb);
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(rounded(0.42, 0.34, 1.24, 0.06), mat('#2b3a55', { roughness: 0.15 })); w.position.set(-len / 2 + 0.55 + i * 0.62, 1.1, 0); carBody.add(w); }
    const st = new THREE.Mesh(new THREE.BoxGeometry(len + 0.22, 0.12, 1.22), mat(gar.stripe || '#ffffff')); st.position.set(0, 0.75, 0); carBody.add(st);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#fff6c8', { emissive: '#fff2a0', emissiveIntensity: 0.7 })); for (const z of [-0.4, 0.4]) { const l = hl.clone(); l.position.set(len / 2 + 0.1, 0.55, z); carBody.add(l); }
  } else if (truck) {
    const cab = new THREE.Mesh(rounded(0.8, 0.65, 1.15, 0.14), mat(col, { roughness: 0.35 })); cab.position.set(len / 2 - 0.45, 0.9, 0); cab.castShadow = true; carBody.add(cab);
    const win = new THREE.Mesh(rounded(0.3, 0.32, 1.18, 0.08), mat('#2b3a55', { roughness: 0.15 })); win.position.set(len / 2 - 0.22, 0.98, 0); carBody.add(win);
    const box = new THREE.Mesh(rounded(len - 0.95, 0.9, 1.2, 0.08), mat('#f4f1ea', { roughness: 0.6 })); box.position.set(-0.45, 1.05, 0); box.castShadow = true; carBody.add(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len - 0.9, 0.14, 1.22), mat(gar.stripe || '#ff7a3d')); stripe.position.set(-0.45, 1.05, 0); carBody.add(stripe);
  } else {
    const cab = new THREE.Mesh(rounded(1.05, 0.5, 1.05, 0.2), mat(col, { roughness: 0.35 })); cab.position.set(-0.1, 0.78, 0); cab.castShadow = true; carBody.add(cab);
    const win = new THREE.Mesh(rounded(1.0, 0.32, 1.08, 0.12), mat('#2b3a55', { roughness: 0.15 })); win.position.set(-0.1, 0.8, 0); carBody.add(win);
    if (gar.roof) { const sg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3), mat('#fff6c8', { emissive: '#fff2a0', emissiveIntensity: 0.6 })); sg.position.set(-0.1, 1.1, 0); carBody.add(sg); }
    if (gar.stripe) { const sp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.3), mat(gar.stripe)); sp.position.set(0, 0.62, 0); carBody.add(sp); }
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
let th = THEMES[0], gridPts = [], dailyLv = null;
function dailyToday() { if (dailyLv && dailyLv.forDay === dayNum()) return dailyLv; for (let k = 0; k < 8; k++) { const d = dailyLevel(dayNum() + k * 1000003); if (solution(d)) { d.forDay = dayNum(); return dailyLv = d; } } dailyLv = levelOf(12); dailyLv.forDay = dayNum(); return dailyLv; }
function buildLevel(keepDesign = false) {
  lv = isDaily ? dailyToday() : levelOf(level); th = THEMES[lv.theme]; weakMarks(keepDesign);
  document.body.style.setProperty('--bg1', th.bg[0]); document.body.style.setProperty('--bg2', th.bg[1]); document.body.style.setProperty('--ui', th.ui);
  scene.fog = new THREE.Fog(th.fog, 40, 90);
  scene.remove(world); world = new THREE.Group(); scene.add(world);
  const r = rngf(lv.seed);
  cliffMesh(-1, lv, th, r); cliffMesh(1, lv, th, r);
  for (const pl of lv.pillars) {
    const hgt = lv.cliffDepth + 4 + pl.y, p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.3, hgt, 6), flat(th.rock)); p.position.set(pl.x, pl.y - hgt / 2, -0.2); p.castShadow = p.receiveShadow = true; world.add(p);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 6), flat(th.grass)); cap.position.set(pl.x, pl.y - 0.15, -0.2); world.add(cap);
  }
  water.material.color.set(th.water); water.position.y = -lv.cliffDepth;
  buildBackground(th, r);
  // anchors
  anchorGroup.clear();
  for (const a of lv.anchors) { const m = new THREE.Mesh(anchorGeo, anchorMat); m.position.set(a.x, a.y, 0); m.castShadow = true; anchorGroup.add(m); }
  // grid dots
  gridPts = [];
  for (let x = lv.L - 1; x <= lv.R + 1; x++) for (let y = -lv.cliffDepth + 1; y <= Math.max(0, lv.yR) + 4; y++) if (!inRock(x, y)) gridPts.push([x, y]);
  dotIM.count = gridPts.length; gridPts.forEach(([x, y], i) => { _o.position.set(x, y, 0.95); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix(); dotIM.setMatrixAt(i, _o.matrix); }); dotIM.instanceMatrix.needsUpdate = true;
  par = parOf(lv); bar.querySelector('.gg-brace').style.display = level >= 3 || isDaily ? '' : 'none'; chips.forEach(c => { c.style.display = !c.dataset.m || lv.mats.includes(c.dataset.m) ? '' : 'none'; }); if (!lv.mats.includes(material)) setMaterial(lv.mats.includes('wood') ? 'wood' : lv.mats[0]);
  const floor = Math.ceil(designCost(solution(lv)) / 100) * 100, fk = F.k();
  budget0 = Math.max(floor, Math.ceil(budgetFor(lv) / fk / 100) * 100); const was = budget; budget = Math.max(floor, Math.ceil(budgetFor(lv) / adk(fk) / 100) * 100); runProg = 0;
  if (!keepDesign) { AD.round(); fails = 0; } else { budget = Math.max(budget, was); }
  if (!keepDesign || !design) { design = { nodes: lv.anchors.map(a => ({ x: a.x, y: a.y, fixed: true })), beams: [] }; undoStack = []; }
  else budget = Math.max(budget, Math.ceil(cost() / 100) * 100);   // a retry never puts the kept bridge over budget
  buildVehicle(lv.vehicle);
  flag.position.set(lv.R + 1.7, lv.yR, -1.0);
  if (!gold) { gold = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20), mat('#ffd23f')); gold.rotation.x = Math.PI / 2; scene.add(gold); }
  goldGot = false; gold.visible = level >= 2 || isDaily; gold.position.set((lv.L + lv.R) / 2, (lv.yR) / 2 + 1.25, 0.4); gold.scale.setScalar(1);
  sim = null; mode = 'build'; simT = 0; carPos(lv.L - 3.2, lv.L - 3.2 + lv.vehicle.axle, lv.vehicle.r, lv.vehicle.r);
  ui.levels(isDaily ? 'D' : level); ui.progress(0); updateBudget(); setBar(true); dotIM.visible = true; anchorGroup.visible = true;
  bot.i = 0; bot.cleared = false; bot.wait = 0; sel = null; ring.visible = false; culprit.visible = false;
  if (keepDesign && budget > was && was > 0) setTimeout(() => ui.pop('BUDGET +$' + (budget - was), '#2f4858', 26, 30), 250);
  predT = 0; pred = null; predPeak = new Map(); predVerdict = ''; if (keepDesign) predictSoon();
  if (keepDesign && fails >= 2 && fails % 2 === 0 && design.beams.length && !design.beams.some(b => b.type !== 'road') && lv.mats.some(m => m !== 'road')) setTimeout(() => { brace(); ui.pop('FREE HELP: BRACED FOR YOU', '#3ccf6e', 24, 40); }, 500);
  frameCam(true);
}
function inRock(x, y) {
  if (lv.anchors.some(a => a.x === x && a.y === y)) return false;
  if (x <= lv.L && y <= 0) return true;
  if (x >= lv.R && y <= lv.yR) return true;
  for (const p of lv.pillars) if (Math.abs(x - p.x) <= 0.5 && y <= p.y) return true;
  return false;
}
function cost() { return Math.round(designCost(design)); }
function updateBudget() {
  const c = cost(); ui.sub(`$${c.toLocaleString()} / $${budget.toLocaleString()} · par $${par.toLocaleString()}`); ui.els.sub.classList.toggle('over', c > budget);
  goBtn.classList.toggle('pulse', design.beams.some(b => b.type === 'road') && mode === 'build');
}
function setBar(show) { bar.classList.toggle('hide', !show); hintEl.style.opacity = show ? 1 : 0;
  hintEl.textContent = !show ? '' : predVerdict === 'ok' && design.beams.length > 2 ? (Math.max(0, ...predPeak.values()) >= 0.85 ? 'Tight: red beams near the limit · GO or brace' : 'Looks strong · press GO') : predVerdict === 'snap' ? 'Red beams look weak: brace them' : predVerdict === 'fail' ? 'It would not hold: add triangles' : level === 1 && !isDaily ? (design.beams.length ? 'Now press GO!' : 'Drag from a red anchor to the other side') : level === 2 && !isDaily && !design.beams.length ? 'Tap a red anchor, then tap a spot · or drag' : weak.size ? 'Orange beams were the weak links: brace them' : lv.tip || ''; }
function nodeAt(x, y) { return design.nodes.findIndex(n => n.x === x && n.y === y); }
function beamLen(b) { const A = design.nodes[b.a], B = design.nodes[b.b]; return Math.hypot(A.x - B.x, A.y - B.y); }
function addBeam(x1, y1, x2, y2, type, quiet = false) {
  if (x1 === x2 && y1 === y2) return false;
  if (Math.hypot(x2 - x1, y2 - y1) > MATS[type].maxLen + 1e-6) return false;
  let a = nodeAt(x1, y1), b = nodeAt(x2, y2);
  const exists = a >= 0 && b >= 0 && design.beams.some(bm => (bm.a === a && bm.b === b) || (bm.a === b && bm.b === a));
  if (exists) return false;
  const addCost = Math.hypot(x2 - x1, y2 - y1) * MATS[type].cost;
  if (cost() + addCost > budget + 0.5) { if (!quiet) { AD.bad(0.5); ui.pop('OVER BUDGET', '#e63946', 30, 30); buzz(30); tone(180, 0.15, 'square', 0.08, 0.7); } return false; }
  const before = design.nodes.length;
  if (a < 0) { design.nodes.push({ x: x1, y: y1 }); a = design.nodes.length - 1; }
  if (b < 0) { design.nodes.push({ x: x2, y: y2 }); b = design.nodes.length - 1; }
  design.beams.push({ a, b, type, born: performance.now() });
  undoStack.push({ kind: 'add', nodes: design.nodes.length - before });
  chainN = performance.now() - lastAdd < 2500 ? Math.min(chainN + 1, 9) : 0; lastAdd = performance.now();
  tone((type === 'steel' ? 300 : type === 'road' ? 220 : 420) * Math.pow(1.0595, chainN * 2), 0.08, 'triangle', 0.13, 1.4); buzz(8);
  burst(scene, new THREE.Vector3((x1 + x2) / 2, (y1 + y2) / 2, 0.6), [BASE[type].getStyle(), '#ffffff'], 6, { speed: 0.05, up: 0.04, size: 0.4, life: 0.5 });
  AD.good(0.1); updateBudget(); if (!quiet) predictSoon(); return true;
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
  const g = design.beams[design.beams.length - 1].grp;
  do { removeBeam(design.beams.length - 1); undoStack.pop(); } while (g && design.beams.length && design.beams[design.beams.length - 1].grp === g);
  buzz(6); predictSoon();
}
// one-tap brace: every flat deck plank gets a triangle on top (apex 1 m above its higher end, two diagonals in the picked material,
// a chord to the neighbour apex). Costs real money; the player still picks materials, order and where NOT to brace.
let grpN = 0, chainN = 0, lastAdd = 0;
function brace() {
  const m = material === 'road' ? (lv.mats.includes('wood') ? 'wood' : 'steel') : material, g = ++grpN, snapshot = design.beams.length;
  const roads = design.beams.filter(b => b.type === 'road').map(b => [design.nodes[b.a], design.nodes[b.b]]).filter(([A, B]) => Math.abs(A.x - B.x) === 2).map(([A, B]) => A.x < B.x ? [A, B] : [B, A]).sort((p, q) => p[0].x - q[0].x);
  const tops = [];
  for (const [A, B] of roads) {
    const ay = Math.max(A.y, B.y) + 1, cx = (A.x + B.x) / 2;
    if (ay > 4 || inRock(cx, ay)) continue;
    const a1 = addBeam(A.x, A.y, cx, ay, m, true), a2 = addBeam(cx, ay, B.x, B.y, m, true);
    tops.push({ x: cx, y: ay });
  }
  for (let i = 0; i + 1 < tops.length; i++) if (tops[i + 1].x - tops[i].x === 2 && tops[i].y === tops[i + 1].y) addBeam(tops[i].x, tops[i].y, tops[i + 1].x, tops[i + 1].y, m, true);
  const added = design.beams.length - snapshot;
  for (let i = snapshot; i < design.beams.length; i++) design.beams[i].grp = g;
  if (!added) { ui.pop(roads.length ? 'ALREADY BRACED / OVER BUDGET' : 'BUILD THE ROAD FIRST', '#2f4858', 22, 30); tone(180, 0.12, 'square', 0.07, 0.7); return; }
  ui.pop('BRACED!', '#3ccf6e', 36, 24); sfx.tap(); predictSoon();
}

// ------------------------------------------------------------------ input (drag to build, tap a beam to delete)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3();
function toWorld(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hitP) ? { x: hitP.x, y: hitP.y } : null; }
let drag = null, sel = null;   // sel = node picked by a tap (tap-to-build: tap node, then tap a spot)
function beamNear(w) {
  let bi = -1, bd = 0.3;
  design.beams.forEach((b, i) => { const A = design.nodes[b.a], B = design.nodes[b.b]; const ex = B.x - A.x, ey = B.y - A.y, L2 = ex * ex + ey * ey; let t = ((w.x - A.x) * ex + (w.y - A.y) * ey) / L2; t = clamp(t, 0, 1); const dd = Math.hypot(A.x + ex * t - w.x, A.y + ey * t - w.y); if (dd < bd) { bd = dd; bi = i; } });
  return bi;
}
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
    if (bi >= 0) { const n = design.nodes[bi]; drag = { sx: n.x, sy: n.y, end: null, cx: e.clientX, cy: e.clientY }; ring.visible = true; ring.position.set(n.x, n.y, 1.1); tone(500, 0.04, 'sine', 0.1, 1.2); }
    else drag = { tapOnly: true, w, cx: e.clientX, cy: e.clientY };
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
    if (!d || state !== 'play' || mode !== 'build') { sel = null; return; }
    const pick = (x, y) => { sel = { x, y }; ring.visible = true; ring.position.set(x, y, 1.1); };
    if (!d.tapOnly && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 12) {   // tap on a joint: select / deselect / build to it
      if (!sel) { pick(d.sx, d.sy); return; }
      if (sel.x === d.sx && sel.y === d.sy) { sel = null; tone(300, 0.05, 'sine', 0.08, 0.8); return; }
      const end = snapEnd(sel.x, sel.y, d.sx, d.sy); if (end && addBeam(sel.x, sel.y, end[0], end[1], material)) pick(end[0], end[1]); else pick(d.sx, d.sy); return;
    }
    if (d.tapOnly && sel && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 12 && !beamNear(d.w)) {   // tap an empty spot with a joint picked → build a beam toward it, keep chaining from its end
      const end = snapEnd(sel.x, sel.y, d.w.x, d.w.y); if (end && addBeam(sel.x, sel.y, end[0], end[1], material)) pick(end[0], end[1]); else pick(sel.x, sel.y); return;
    }
    sel = null;
    if (d.tapOnly) {   // tap near a beam → delete it
      const bi = beamNear(d.w);
      if (bi >= 0) { const b = design.beams[bi], A = design.nodes[b.a], B = design.nodes[b.b]; burst(scene, new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, 0.6), BASE[b.type].getStyle(), 8, { speed: 0.08, size: 0.5 }); removeBeam(bi); buzz(12); predictSoon(); }
      return;
    }
    if (d.end && addBeam(d.sx, d.sy, d.end[0], d.end[1], material)) pick(d.end[0], d.end[1]);
  },
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s of a still screen): on level 1, until the
// first real touch, the left red anchor gets picked and one road plank is laid from it (tap anchor, tap a spot), the way a tap builds
demo(n => { const x = lv.L, y = 0;
  if (n === 1) { sel = { x, y }; ring.visible = true; ring.position.set(x, y, 1.1); tone(500, 0.04, 'sine', 0.1, 1.2); return; }
  return false;
}, { ready: () => state === 'play' && level === 1 && mode === 'build' && !drag && !design.beams.length, every: 900, max: 2 });

// ------------------------------------------------------------------ live preview: a quiet test drive of the bridge as built, stepped a little each frame
// (same physics and car weight as GO, without the rescue); beams tint by their peak load, the ones that would snap glow red.
let predT = 0, pred = null, predPeak = new Map(), predVerdict = '';
function predictSoon() { predT = performance.now() + 450; pred = null; predPeak = new Map(); predVerdict = ''; if (mode === 'build') setBar(true); }
function predictTick() {
  if (mode !== 'build' || state !== 'play') { pred = null; return; }
  if (!pred) {
    if (!predT || performance.now() < predT || drag) return; predT = 0;
    if (!design.beams.some(b => b.type === 'road')) return;
    const v = lv.vehicle; pred = { sim: createSim(design, groundOf(lv), { x: lv.L - 3.2, y: v.r, axle: v.axle, r: v.r, wheelMass: v.wheelMass * adk(1, 0.12), speed: v.speed }), n: 0, done: false };
    return;
  }
  const s = pred.sim; if (pred.done) return;
  for (let i = 0; i < 8; i++) {
    stepSim(s, 1 / 60, 30); pred.n++;
    for (const b of s.beams) { const pk = Math.max(predPeak.get(b.src) || 0, b.broken ? 1.2 : b.stress); predPeak.set(b.src, pk); }
    const w0 = s.wheels[0], fell = w0.y < -lv.cliffDepth + 0.3, won = w0.x > lv.R + 0.9, snapped = s.beams.some(b => b.broken);
    if (fell || won || pred.n > 16 * 60) {
      pred.done = true; predVerdict = won && !snapped ? 'ok' : won ? 'snap' : 'fail'; setBar(true); break;
    }
  }
}
// ------------------------------------------------------------------ simulation
let honk = 0, simT = 0, shake = 0, debris = [], stuckT = 0, lastX = 0, broken = 0, creak = 0, slowT = 0, slowTick = 0;
function go() {
  if (!design.beams.some(b => b.type === 'road')) { ui.pop('BUILD A ROAD FIRST', '#2f4858', 26, 30); buzz(20); return; }
  const v = lv.vehicle;
  sel = null; ring.visible = false; culprit.visible = false;
  sim = createSim(design, groundOf(lv), { x: lv.L - 3.2, y: v.r, axle: v.axle, r: v.r, wheelMass: v.wheelMass * adk(1, 0.12), speed: v.speed });
  mode = 'sim'; fastBtn.classList.add('on'); simT = 0; stuckT = 0; lastX = sim.wheels[1].x; broken = 0; rescued = false; firstSnap = null; hot = new Set(); weak = new Set(); creak = 0;
  setBar(false); dotIM.visible = false;
  tone(330, 0.12, 'square', 0.07, 1); setTimeout(() => tone(330, 0.12, 'square', 0.07, 1), 160);
  ui.pop('GO!', '#3ccf6e', 52, 30); buzz(15);
}
// rescue (once a round, deserved only): the deck's first snap while the car is on it (a splash coming) creaks and holds
let rescued = false;
function braced() { const n = design.beams.filter(b => b.type !== 'road').length, r = solution(lv).beams.filter(b => b.type !== 'road').length; return n >= 0.6 * r; }
function deckSpans() { const xs = new Set(); for (const b of design.beams) if (b.type === 'road') { const A = design.nodes[b.a], B = design.nodes[b.b]; for (let x = Math.min(A.x, B.x); x < Math.max(A.x, B.x); x++) xs.add(x); } for (let x = lv.L; x < lv.R; x++) if (!xs.has(x)) return false; return true; }
function hold(list) {
  const cx = (sim.wheels[0].x + sim.wheels[1].x) / 2;
  if (broken || rescued || state !== 'play' || cx < lv.L - 0.5 || cx > lv.R + 0.5 || !list.some(b => b.type === 'road') || !deckSpans() || !braced() || !AD.sensible(0.8) || !AD.rescue()) return list;
  rescued = true; for (const b of list) { b.broken = false; b.stress = 0.5; b.M = { ...b.M, strength: b.M.strength * 1.25 }; }
  ui.pop('CREAK… IT HELD! 🍀', '#3ccf6e', 34, 30); buzz([10, 30, 10]); tone(140, 0.25, 'sawtooth', 0.08, 0.6); return [];
}
let firstSnap = null;
function snap(b) {
  if (!firstSnap) firstSnap = { type: b.type, pct: Math.round(Math.abs(b.force) / (b.force > 0 ? b.M.strength : b.M.strength * 0.85) * 100) };
  const A = sim.nodes[b.a], B = sim.nodes[b.b], mid = new THREE.Vector3((A.x + B.x) / 2, (A.y + B.y) / 2, 0);
  broken++; shake = Math.min(0.7, shake + 0.35); buzz([25, 20, 25]); ui.flash(0.25);
  tone(160 + Math.random() * 60, 0.18, 'sawtooth', 0.11, 0.4); tone(900, 0.06, 'square', 0.06, 0.3);
  burst(scene, mid.clone().setZ(0.8), [BASE[b.type].getStyle(), '#ffffff', '#ffd23f'], 14, { speed: 0.14, up: 0.08, size: 0.55 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.rest / 2, 0.17, 0.17), mat(BASE[b.type].getStyle()));
    m.position.set(mid.x + s * 0.25, mid.y, 0.8); m.rotation.z = Math.atan2(B.y - A.y, B.x - A.x); m.castShadow = true; scene.add(m);
    debris.push({ m, vx: s * (1 + Math.random()), vy: 1 + Math.random() * 2, vr: (Math.random() - 0.5) * 8 });
  }
  if (broken === 1) { culprit.position.set(mid.x, mid.y, 1.2); culprit.visible = true; }
  if (broken === 1) { ui.pop('SNAP!', '#e63946', 44, 30); slowT = 0.7; }
}
function carPos(x0, x1, y0, y1, roll = 0) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ang = Math.atan2(y1 - y0, x1 - x0);
  car.position.set(cx, cy, 0); car.rotation.z = ang;
  carBody.position.y = 0.0 + Math.sin(simT * 30) * 0.008 + (honk > 0 ? Math.abs(Math.sin(honk * 14)) * 0.18 * honk : 0);
  const half = Math.hypot(x1 - x0, y1 - y0) / 2;
  for (const w of wheelsM) { w.position.set(w.userData.i ? half : -half, 0, w.userData.z); w.rotation.z = -roll; }
}
let roll = 0;
function win() {
  if (state === 'won' || state === 'lost') return;
  F.level(true); B.submit(1); AD.good(3);
  fastBtn.classList.remove('on'); state = 'won'; mode = 'done'; sfx.win(); buzz([20, 40, 20]);
  const c = cost(), stars = broken ? 1 : c <= par ? 3 : 2;
  confetti(scene, new THREE.Vector3(lv.R + 1.7, lv.yR + 2.5, 0), 70 + stars * 40);
  if (stars === 3) setTimeout(() => confetti(scene, new THREE.Vector3(lv.R + 0.5, lv.yR + 3.5, 0), 80), 350);
  const saved = Math.max(0, budget0 - c), pts = 100 + Math.round(saved / 10) - broken * 10;
  score += Math.max(10, pts); save.set('score', score);
  if (score > best) { best = score; save.set('best', best); }
  ui.pop(stars === 3 ? 'PERFECT BRIDGE!' : broken ? 'MADE IT!' : 'CLEAN CROSSING!', '#ffd23f', 44, 28);
  for (let i = 0; i < stars; i++) setTimeout(() => tone(660 * Math.pow(1.26, i), 0.14, 'triangle', 0.14, 1.4), 300 + i * 200);
  const first = isDaily ? dly.last !== dayNum() : starsOf(level) < 1, prevStars = isDaily ? 0 : starsOf(level), hadCars = unlockedCars(), hadW = worldsOpen();
  if (isDaily) { if (first) { dly.streak = dly.last === yest() ? dly.streak + 1 : 1; dly.days++; dly.last = dayNum(); } dly.best = Math.max(dly.best || 0, stars); }
  else if (stars > prevStars) prog[level] = { s: stars, c: c };
  else if (prog[level] && c < (prog[level].c || 1e9) && stars === prog[level].s) prog[level].c = c;
  if (unlockedCars() > hadCars) { garageSel = unlockedCars() - 1; buildVehicle(lv.vehicle); }
  persist();
  setTimeout(() => showResult(true, { stars, c, first, prevStars, newCar: unlockedCars() > hadCars, newWorld: worldsOpen() > hadW }), 900);
}
function lose(why) {
  if (state === 'won' || state === 'lost') return;
  F.level(false, runProg); AD.bad(2); fails++;
  fastBtn.classList.remove('on'); state = 'lost'; mode = 'done'; sfx.fail(); buzz([40, 30, 60]);
  weak = new Set(); for (const b of hot) weak.add(b); for (const b of sim.beams) if (b.broken) weak.add(b.src);
  setTimeout(() => showResult(false, { why }), 800);
}

// ------------------------------------------------------------------ frame
ui.onTap(w => { if (w === 'start') startLevel(level, false); });
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
let t = 0, wf = 0;
const camCur = new THREE.Vector3(), atCur = new THREE.Vector3();
loop((dt60, ts) => {
  const dt = Math.min(dt60 / 60, 1 / 30); t += dt;
  // water waves
  const pa = water.geometry.attributes.position.array;
  for (let i = 0; i < pa.length; i += 3) pa[i + 2] = Math.sin(wBase[i] * 0.5 + t * 1.3) * 0.12 + Math.cos(wBase[i + 1] * 0.6 + t * 1.1) * 0.1;
  water.geometry.attributes.position.needsUpdate = true; if ((wf = wf + 1) % 6 === 0) water.geometry.computeVertexNormals();
  for (const c of bgGroup.children) if (c.userData.sp) { c.position.x += c.userData.sp * dt; if (c.position.x > 40) c.position.x = -40; }
  flag.cloth.rotation.y = Math.sin(t * 4) * 0.25;

  if (honk > 0) { honk = Math.max(0, honk - dt * 0.9); if (mode === 'build') carPos(lv.L - 3.2, lv.L - 3.2 + lv.vehicle.axle, lv.vehicle.r, lv.vehicle.r); }
  predictTick();
  if (state === 'play') AD.tick(mode === 'sim' || performance.now() - inAt < 8000);
  let nodes = design.nodes, beams = design.beams, stress = null;
  if (mode === 'sim' && sim) {
    simT += dt;
    if (slowT > 0) { slowT -= dt; slowTick ^= 1; } else slowTick = 0;
    if (!slowTick) for (let r = slowT > 0 ? 1 : speedMul; r > 0; r--) stepSim(sim, 1 / 60, 30);
    let ms = 0; for (const b of sim.beams) if (!b.broken) { if (b.stress > ms) ms = b.stress; if (b.stress > 0.8) hot.add(b.src); }
    creak -= dt; if (ms > 0.6 && creak <= 0 && state === 'play') { creak = 0.55 - ms * 0.25; tone(110 + ms * 160, 0.22, 'sawtooth', 0.05 + ms * 0.04, 0.8); }
    for (const b of hold(sim.broke.splice(0))) { snap(b); if (state === 'play' && broken <= 4) AD.bad(0.25); }
    nodes = sim.nodes; beams = sim.beams; stress = true;
    const [w0, w1] = sim.wheels; roll += (w1.vx * dt) / lv.vehicle.r;
    carPos(w0.x, w1.x, w0.y, w1.y, roll);
    if (gold && gold.visible && !goldGot && Math.abs(w1.x - gold.position.x) < 1.0 && Math.abs(w1.y - gold.position.y) < 1.7) {
      goldGot = true; gold.visible = false; goldCoins++; save.set('gold', goldCoins); score += 50; save.set('score', score); buzz([15, 20, 15]);
      burst(scene, gold.position.clone().setZ(0.9), ['#ffd23f', '#ffffff', '#fff3a0'], 22, { speed: 0.16, up: 0.16, size: 0.5 });
      ui.pop('GOLD! +50', '#ffd23f', 34, 34); tone(988, 0.1, 'triangle', 0.14, 1.2); setTimeout(() => tone(1318, 0.16, 'triangle', 0.14, 1.2), 90);
    }
    const prog = clamp((w0.x - (lv.L - 3.2)) / (lv.R + 0.9 - (lv.L - 3.2)), 0, 1); ui.progress(prog); runProg = Math.max(runProg, prog);
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
    if (stress) { stressColor(b.stress, _c2); _c.copy(base).lerp(_c2, 0.8); } else { _c.copy(base); const pk = predPeak.get(b); if (pk !== undefined && mode === 'build') { stressColor(pk, _c2); _c.lerp(_c2, pk >= 0.95 ? 0.85 : 0.5); if (pk >= 0.95) _c.lerp(_c2.set('#ff3d2e'), 0.4 + Math.sin(t * 9) * 0.3); } if (weak.has(b)) _c.lerp(_c2.set('#ff3d2e'), 0.55 + Math.sin(t * 8) * 0.3); }
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
  if (sel && !drag) ring.scale.setScalar(1.15 + Math.sin(t * 8) * 0.15);
  if (culprit.visible) culprit.scale.setScalar(1 + Math.abs(Math.sin(t * 6)) * 0.35);
  if (gold && gold.visible) { gold.rotation.y += dt * 3; gold.position.y += Math.sin(performance.now() / 300) * dt * 0.3; }
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
// ------------------------------------------------------------------ cards, map, garage, daily (v2 meta)
const gcss = document.createElement('style'); gcss.textContent = `
.gg-btn{pointer-events:auto;font:inherit;font-weight:800;font-size:18px;color:#fff;background:#ff7a3d;border:0;border-radius:30px;padding:9px 22px;box-shadow:0 4px 0 rgba(0,0,0,.2);cursor:pointer}
.gg-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}
.gg-btn.big{font-size:26px;padding:14px 54px;background:#3ccf6e;box-shadow:0 5px 0 #23944b}
.gg-btn.sm{font-size:15px;padding:6px 16px;background:rgba(0,0,0,.28);box-shadow:none}
.gg-map{position:fixed;right:12px;top:calc(12px + env(safe-area-inset-top));z-index:6;width:42px;height:42px;border-radius:14px;border:0;background:rgba(0,0,0,.25);color:#fff;cursor:pointer}
.gg-ov{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;padding:calc(34px + env(safe-area-inset-top)) 16px 24px;gap:10px;text-align:center;background:rgba(28,46,66,.92);color:#fff;overflow:auto}
.gg-ov h2{margin:0;font-size:32px;font-weight:800;text-shadow:0 4px 0 rgba(0,0,0,.2)}
.gg-ov p{margin:0;font-size:16px;font-weight:600}
.gg-res{z-index:11;background:rgba(20,36,52,.55);justify-content:flex-start;padding-top:calc(90px + env(safe-area-inset-top))}
.gg-stars{display:flex;gap:6px;justify-content:center}
.gg-stars svg{width:64px;height:64px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.2));animation:ggstar .5s cubic-bezier(.3,1.8,.5,1) both}
.gg-stars svg.dim{opacity:.35;animation:none}
@keyframes ggstar{0%{transform:scale(0) rotate(-40deg)}100%{transform:scale(1) rotate(0)}}
.gg-tabs{display:flex;gap:6px}
.gg-tab{font:inherit;font-weight:800;font-size:13px;color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:14px;padding:6px 10px;cursor:pointer}
.gg-tab.on{background:#ff7a3d} .gg-tab.lk{opacity:.4}
.gg-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;width:min(340px,92vw)}
.gg-lv{font:inherit;position:relative;border:0;border-radius:16px;background:#fff;color:#2f4858;font-weight:800;font-size:22px;padding:8px 0 4px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.22)}
.gg-lv small{display:block;font-size:12px;color:#e0a000;letter-spacing:1px;min-height:15px}
.gg-lv.lk{background:rgba(255,255,255,.25);color:#ffffff88;pointer-events:none;box-shadow:none}
.gg-lv.nx{background:#3ccf6e;color:#fff;animation:ggp 1s ease-in-out infinite} .gg-lv.nx small{color:#fff}
.gg-lv.boss{background:#ffe14d} .gg-lv i{position:absolute;right:4px;top:2px;font-size:9px;font-style:normal;color:#b3261e}
.gg-bar2{width:min(300px,80vw);height:12px;border-radius:8px;background:rgba(255,255,255,.25);overflow:hidden} .gg-bar2 b{display:block;height:100%;background:#ffe14d}
.gg-sk{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;width:min(340px,92vw)}
.gg-o{font:inherit;border:3px solid transparent;border-radius:14px;background:rgba(255,255,255,.16);color:#fff;font-weight:700;font-size:13px;padding:8px 2px;cursor:pointer}
.gg-o.on{border-color:#ffe14d} .gg-o.lk{opacity:.4}
.gg-o span{display:block;width:70px;height:24px;border-radius:10px;margin:0 auto 5px;border:3px solid #fff}
.gg-new{color:#ffe14d;font-weight:800;font-size:20px;animation:ggp 1s ease-in-out infinite}
`; document.head.appendChild(gcss);
const dom = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const STAR = (on, z = 64, delay = 0) => `<svg viewBox="0 0 24 24" class="${on ? '' : 'dim'}" style="width:${z}px;height:${z}px;animation-delay:${delay}s"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="${on ? '#ffd23f' : '#ffffff'}" stroke="#b07a00" stroke-width="1"/></svg>`;
const SS = (on, z = 13) => `<svg viewBox="0 0 24 24" style="width:${z}px;height:${z}px;vertical-align:-1px"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="${on ? '#ffc400' : '#c9cbe0'}"/></svg>`;
const mapBtn = dom('<button class="gg-map hc-hidden" aria-label="Levels"><svg width="22" height="22" viewBox="0 0 22 22" fill="#fff" style="margin-top:3px"><rect x="2" y="2" width="7" height="7" rx="2"/><rect x="13" y="2" width="7" height="7" rx="2"/><rect x="2" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></button>');
document.body.append(mapBtn);
mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
mapBtn.addEventListener('click', () => { if (state === 'play' || state === 'won' || state === 'lost') showMap(); });
let resEl = null, mapWorld = 0;
function closeOverlays() { document.querySelectorAll('.gg-ov').forEach(x => x.remove()); resEl = null; }
const worldOpen = i => i === 0 || starsOf(i * 12) >= 1;
const worldsOpen = () => WORLDS.filter((w, i) => worldOpen(i)).length;
const wStars = i => { let t = 0; for (let k = 1; k <= 12; k++) t += starsOf(i * 12 + k); return t; };
function startLevel(n, daily = false, keep = false) {
  closeOverlays(); isDaily = daily; if (!daily) level = Math.max(1, Math.min(NL, n));
  state = 'play'; ui.hideStart(); mapBtn.classList.remove('hc-hidden'); buildLevel(keep); B.start(); ui.levels(daily ? 'D' : level); save.set('level', level);
}
function weakMarks(keep) { if (!keep) weak = new Set(); }
function tomorrowLine() { return dly.last === dayNum() ? `Tomorrow: a new Daily Bridge · day ${dly.streak + 1}` : 'Today\'s Daily Bridge is waiting on the map'; }
function carBar() {
  const no = nextCar(), have = totalStars(); if (!no) return '<p style="font-size:13px">Garage complete!</p>';
  const prev = GARAGE[Math.max(0, GARAGE.indexOf(no) - 1)];
  return `<div class="gg-bar2"><b style="width:${Math.min(100, (have - prev.need) / (no.need - prev.need) * 100)}%"></b></div><p style="font-size:13px">${no.need - have} ${SS(true, 13)} to the ${no.name}</p>`;
}
function showResult(won, o) {
  closeOverlays(); ui.sub(''); let html;
  if (won) {
    const { stars, c } = o;
    html = `<h2>${isDaily ? 'DAILY BRIDGE!' : 'LEVEL ' + level + ' CLEARED!'}</h2>
      <div class="gg-stars">${[0, 1, 2].map(i => STAR(i < stars, 64, 0.15 + i * 0.25)).join('')}</div>
      <p>$${c.toLocaleString()} spent · par $${par.toLocaleString()}${broken ? ' · ' + broken + ' snapped' : ''}</p>
      ${stars < 3 ? `<p style="opacity:.85;font-size:14px">${broken ? 'Nothing snaps = 2 stars. Brace the weak spots' : 'Spend $' + (c - par).toLocaleString() + ' less for the 3rd star'}</p>` : '<p class="gg-new">3 STARS!</p>'}
      ${o.newWorld ? `<div class="gg-new">NEW WORLD: ${WORLDS[worldsOpen() - 1].name}!</div>` : ''}
      ${o.newCar ? `<div class="gg-new">NEW VEHICLE: ${GARAGE[unlockedCars() - 1].name}!</div>` : ''}
      ${carBar()}<p style="font-size:13px">${tomorrowLine()}</p>
      <button class="gg-btn big" data-a="next">${isDaily || level >= NL ? 'Map' : 'Next'}</button>
      <div style="display:flex;gap:8px"><button class="gg-btn sm" data-a="again">${stars < 3 ? 'Again for more stars' : 'Replay'}</button><button class="gg-btn sm" data-a="map">Map</button></div>`;
    seenCars = unlockedCars(); persist();
  } else {
    const pct = Math.round(runProg * 100), near = runProg >= 0.6;
    const tip = o.why === 'stuck' ? 'The road has to reach the far cliff' : firstSnap ? `A ${firstSnap.type} beam took ${firstSnap.pct}% of its strength and snapped. ${lv.mats.includes('steel') ? 'Brace it or use steel there' : 'Add triangles around it'}` : weak.size ? 'Orange beams snapped first: brace them' : 'Add triangles to stiffen it';
    html = `<h2>${near ? 'SO CLOSE!' : o.why === 'stuck' ? 'STUCK!' : 'SPLASH!'}</h2><p>${pct}% across${near ? ' · one more try!' : ''}</p><p style="font-size:14px;opacity:.9">${tip}</p>
      <button class="gg-btn big" data-a="again">Fix it</button><button class="gg-btn sm" data-a="map">Map</button>`;
  }
  resEl = dom(`<div class="gg-ov gg-res">${html}</div>`);
  resEl.addEventListener('pointerdown', e => { e.stopPropagation(); const b = e.target.closest('[data-a]'); act(b ? b.dataset.a : won ? 'next' : 'again'); });
  document.body.appendChild(resEl);
}
function act(a) {
  if (state !== 'won' && state !== 'lost') return;
  const won = state === 'won', d = isDaily;
  if (a === 'again') { if (won) startLevel(level, d); else { closeOverlays(); state = 'play'; buildLevel(true); setBar(true); } }
  else if (a === 'next') { if (won) { if (d || level >= NL) showMap(); else startLevel(level + 1); } }
  else if (a === 'map') showMap();
}
function showMap(wi) {
  closeOverlays(); const fromState = state; if (state === 'play') state = 'menu';
  mapWorld = wi == null ? Math.min(2, Math.floor((nextOpen() - 1) / 12)) : wi; const nx = nextOpen();
  const lvb = k => { const n = mapWorld * 12 + k + 1, s = starsOf(n), open = isOpen(n);
    return `<button class="gg-lv ${!open ? 'lk' : n === nx ? 'nx' : ''} ${k === 11 ? 'boss' : ''}" data-l="${n}">${n}<small>${open ? [0, 1, 2].map(i => SS(i < s)).join('') : '🔒'}</small>${k === 11 ? '<i>BOSS</i>' : ''}</button>`; };
  const doneToday = dly.last === dayNum();
  const el = dom(`<div class="gg-ov"><h2>${WORLDS[mapWorld].name}</h2><p style="font-size:13px;opacity:.8">${WORLDS[mapWorld].blurb}</p>
    <div class="gg-tabs">${WORLDS.map((w, i) => `<button class="gg-tab ${i === mapWorld ? 'on' : ''} ${worldOpen(i) ? '' : 'lk'}" data-w="${i}">${i + 1} · ${wStars(i)}/36 ${SS(true, 12)}</button>`).join('')}</div>
    <div class="gg-grid" style="${worldOpen(mapWorld) ? '' : 'opacity:.5;pointer-events:none'}">${Array.from({ length: 12 }, (_, k) => lvb(k)).join('')}</div>
    ${carBar()}
    <button class="gg-btn" data-a="daily" style="background:${doneToday ? '#5b6b8a' : '#ff5d8f'}">Daily Bridge ${doneToday ? '· done · day ' + dly.streak : dly.streak && dly.last === yest() ? '· day ' + (dly.streak + 1) + ' streak' : ''}</button>
    <div style="display:flex;gap:8px"><button class="gg-btn sm" data-a="garage">Garage</button><button class="gg-btn sm" data-a="back">Back</button></div></div>`);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.l) { sfx.tap(); startLevel(+b.dataset.l, false); }
    else if (b.dataset.w) { if (worldOpen(+b.dataset.w)) showMap(+b.dataset.w); else tone(180, 0.1, 'square', 0.08, 0.7); }
    else if (b.dataset.a === 'daily') { sfx.tap(); startLevel(level, true); }
    else if (b.dataset.a === 'garage') showGarage();
    else if (b.dataset.a === 'back') { closeOverlays(); if (state === 'menu') state = 'play'; else if (fromState === 'won') startLevel(level + 1 > NL ? level : level + 1); else if (fromState === 'lost') { state = 'play'; buildLevel(true); } }
  });
  document.body.appendChild(el);
}
function showGarage() {
  closeOverlays(); const have = totalStars();
  const el = dom(`<div class="gg-ov"><h2>Garage</h2><p>${have} ${SS(true, 14)} collected</p><div class="gg-sk">${GARAGE.map((o, i) => `<button class="gg-o ${have < o.need ? 'lk' : ''} ${i === garageSel ? 'on' : ''}" data-o="${i}"><span style="background:${o.col}"></span>${have >= o.need ? o.name : o.need + ' ★'}</button>`).join('')}</div><button class="gg-btn" data-a="map">Back</button></div>`);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.o != null) { const i = +b.dataset.o; if (have < GARAGE[i].need) { tone(180, 0.1, 'square', 0.08, 0.7); return; } garageSel = i; persist(); buildVehicle(lv.vehicle); sfx.tap(); showGarage(); }
    else showMap();
  });
  document.body.appendChild(el);
}

buildLevel();
camCur.copy(camPos); atCur.copy(camAt);
startLevel(level, false);   // no title card: the first touch is already a build (Oct 26 / critic: first drag was eaten by the start tap)
setTimeout(() => { if (level === 1 && !design.beams.length) { tone(520, 0.08, 'square', 0.07, 1); setTimeout(() => tone(660, 0.12, 'square', 0.07, 1), 110); honk = 1; } }, 250);

// ------------------------------------------------------------------ test hooks: bot builds the known-good design one beam per call, then presses GO
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  screen(x, y) { const v = new THREE.Vector3(x, y, 0).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
  get info() { return { mode, cost: cost(), budget, budget0, beams: design.beams.length }; },
  get stars() { return totalStars(); }, get prog() { return prog; }, get broken() { return broken; }, get par() { return par; }, get weak() { return weak.size; }, NL, map: showMap, act, garage: showGarage,
  predict: predictSoon, get verdict() { return predVerdict; }, load: (n, d) => startLevel(n, !!d), reset() { prog = {}; dly = { last: 0, streak: 0, days: 0, best: 0 }; garageSel = 0; persist(); },
  get dump() { return JSON.stringify({ n: design.nodes, b: design.beams.map(b => [b.a, b.b, b.type]), lvn: level, mass: lv.vehicle.wheelMass * adk(1, 0.12) }); },
  get simInfo() { return sim ? JSON.stringify({ t: sim.t, wx: sim.wheels.map(w => [w.x, w.y]), brk: sim.beams.map((b, i) => b.broken ? [i, b.type] : null).filter(Boolean), m: sim.wheels[0].w, car: sim.car }) : ''; },
  get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; },
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

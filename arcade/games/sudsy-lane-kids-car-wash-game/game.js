// Sudsy Lane — original kids car wash. A muddy toy vehicle rolls in; rub it with each tool in turn:
// soap the mud into foam, rinse the foam, dry the drops, then stick on shiny stickers. A new vehicle every level.
import { THREE, createStage, createUI, store, loop, buzz, note, tone, burst, confetti, lerp, clamp, rng, palette, applyPalette, mat, glossy, rounded } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';

const NAME = 'Sudsy Lane: Kids Car Wash Game';
const S = store('sudsylane');
let level = S.get('level', 1), best = S.get('best', 0);
// No flow.js here: a car wash has no fail state or skill element (FLOW_BRIEF rule 4) — kids always finish.

const stage = createStage({ fov: 40, shadowSize: 8 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'SUDSY<br>LANE', hint: 'Rub rub rub!', hand: '👆' });
const D = daily('sudsylane', ui, { name: NAME });

// ---------------------------------------------------------------- DOM: tool row, tool cursor, helper hand
const css = document.createElement('style');
css.textContent = `
.sl-tools{position:fixed;left:0;right:0;bottom:calc(18px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:12px;z-index:5;pointer-events:none}
.sl-tool{position:relative;width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 4px 0 rgba(0,0,0,.12);opacity:.55;transition:transform .2s,opacity .2s}
.sl-tool.on{opacity:1;background:#fff;transform:scale(1.22);animation:slbob 1s ease-in-out infinite}
.sl-tool.done{opacity:1}
.sl-tool.done:after{content:'✔';position:absolute;right:-4px;top:-6px;width:24px;height:24px;border-radius:50%;background:#3ccf7a;color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center;font-weight:800}
@keyframes slbob{50%{transform:scale(1.3) translateY(-4px)}}
.sl-cursor{position:fixed;font-size:64px;pointer-events:none;z-index:7;transform:translate(-50%,-80%);filter:drop-shadow(0 6px 4px rgba(0,0,0,.2));display:none}
.sl-hand{position:fixed;font-size:52px;pointer-events:none;z-index:7;transform:translate(-30%,-10%);animation:slhand 0.9s ease-in-out infinite;display:none}
@keyframes slhand{50%{margin-top:16px;margin-left:10px}}
.sl-hidden{display:none!important}`;
document.head.appendChild(css);
const toolRow = document.createElement('div'); toolRow.className = 'sl-tools sl-hidden'; document.body.appendChild(toolRow);
const cursor = document.createElement('div'); cursor.className = 'sl-cursor'; document.body.appendChild(cursor);
const hand = document.createElement('div'); hand.className = 'sl-hand'; hand.textContent = '👆'; document.body.appendChild(hand);
const TOOLS = { soap: '🧽', rinse: '🚿', dry: '💨', stick: '⭐' };

// ---------------------------------------------------------------- the wash bay
function fit() {
  const vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2);
  const d = Math.max(2.45 / (th * camera.aspect), 4.6 / th);
  camera.position.set(0, 2.0 + d * 0.17, d); camera.lookAt(0, 1.85, 0);
}
addEventListener('resize', fit); fit();
function tileTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#bfe6ff' : '#e6f6ff'; c.beginPath(); c.roundRect(x * 64 + 3, y * 64 + 3, 58, 58, 10); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 1.6); return t;
}
const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 6.2), new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.6 }));
wall.position.set(0, 3.1, -3.2); wall.receiveShadow = true; scene.add(wall);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), mat('#dfe9f3')); floor.rotation.x = -Math.PI / 2; floor.position.z = 2; floor.receiveShadow = true; scene.add(floor);
for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), mat(i % 2 ? '#ffd23f' : '#3a3d4a')); s.rotation.x = -Math.PI / 2; s.position.set(i * 1.1, 0.005, 2.4); scene.add(s); }
const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: '#9fd8ff', roughness: 0.05, transparent: true, opacity: 0.55 }));
puddle.rotation.x = -Math.PI / 2; puddle.scale.set(2.6, 1.0, 1); puddle.position.set(0, 0.01, 0.6); scene.add(puddle);
// arch with two spinning brush rollers
const archM = mat('#ffffff');
for (const s of [-1, 1]) { const post = new THREE.Mesh(rounded(0.45, 5.6, 0.45, 0.12), archM); post.position.set(s * 3.4, 2.8, -1.6); post.castShadow = true; scene.add(post); }
const beam = new THREE.Mesh(rounded(7.3, 0.55, 0.5, 0.18), archM); beam.position.set(0, 5.6, -1.6); scene.add(beam);
function stripeTex(a, b) { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d'); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? a : b; c.fillRect(0, i * 16, 64, 16); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1); return t; }
const rollers = [];
for (const s of [-1, 1]) {
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.2, 24, 1), new THREE.MeshStandardMaterial({ map: stripeTex('#ff7eb3', '#7ad7ff'), roughness: 0.9 }));
  r.position.set(s * 3.0, 3.0, -1.2); r.castShadow = true; scene.add(r); rollers.push(r);
}
// floating soap bubbles in the air
const AIRB = 18, airIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, transparent: true, opacity: 0.4 }), AIRB);
const airD = Array.from({ length: AIRB }, (_, i) => ({ x: (Math.random() - 0.5) * 8, y: Math.random() * 7, s: 0.08 + Math.random() * 0.16, v: 0.004 + Math.random() * 0.006, ph: Math.random() * 6 }));
scene.add(airIM);

// ---------------------------------------------------------------- vehicles (original toy designs built from primitives)
const KINDS = ['dump', 'bus', 'fire', 'icecream', 'mixer'];
const BODY_COLS = { dump: ['#ffb703', '#3a86ff'], bus: ['#ffd23f', '#ff8c42'], fire: ['#ff4d4d', '#ffffff'], icecream: ['#ff9ecb', '#7ad7ff'], mixer: ['#3ccf7a', '#ff8c42'] };
let truck = null, paint = [], wheels = [], eyes = [], mouth = null, bodyMats = [];
function buildTruck(kind) {
  const g = new THREE.Group(); paint = []; wheels = []; eyes = []; bodyMats = [];
  const [ca, cb] = BODY_COLS[kind];
  const mA = glossy(ca), mB = glossy(cb), glass = glossy('#bfe9ff', { roughness: 0.1 }), dark = mat('#3a3d4a'), grey = mat('#cfd6e0');
  bodyMats.push({ m: mA, c: new THREE.Color(ca) }, { m: mB, c: new THREE.Color(cb) });
  const add = (geo, m, x, y, z, p = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); if (p) paint.push(o); return o; };
  add(rounded(4.0, 0.35, 1.6, 0.12), dark, 0, 0.72, 0, false);
  if (kind === 'bus') {
    add(rounded(4.1, 2.0, 1.8, 0.32), mA, 0, 1.9, 0);
    for (let i = 0; i < 3; i++) add(rounded(0.85, 0.7, 0.06, 0.12), glass, -1.35 + i * 1.05, 2.25, 0.9, false);
    add(rounded(0.06, 0.8, 1.4, 0.12), glass, 2.05, 2.3, 0, false);
    add(rounded(4.12, 0.22, 1.82, 0.08), mB, 0, 1.35, 0);
  } else {
    add(rounded(1.5, 1.7, 1.8, 0.24), mA, 1.2, 1.75, 0);
    add(rounded(0.85, 0.65, 0.06, 0.12), glass, 1.3, 2.15, 0.9, false);
    add(rounded(0.06, 0.65, 1.4, 0.12), glass, 1.96, 2.15, 0, false);
    if (kind === 'dump') { add(rounded(2.4, 1.3, 1.8, 0.16), mB, -0.85, 1.55, 0); add(rounded(2.5, 0.16, 1.9, 0.06), mA, -0.85, 2.22, 0); }
    if (kind === 'fire') {
      add(rounded(2.4, 1.45, 1.8, 0.16), mA, -0.85, 1.62, 0); add(rounded(2.42, 0.18, 1.82, 0.06), mB, -0.85, 1.75, 0);
      for (const z of [-0.45, 0.45]) add(new THREE.BoxGeometry(2.6, 0.08, 0.08), grey, -0.7, 2.45, z, false);
      for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.06, 0.06, 0.9), grey, -1.85 + i * 0.36, 2.45, 0, false);
      const siren = add(new THREE.SphereGeometry(0.16, 12, 8), glossy('#3a86ff', { emissive: '#3a86ff', emissiveIntensity: 0.5 }), 1.2, 2.65, 0, false); siren.scale.y = 0.7;
    }
    if (kind === 'icecream') {
      add(rounded(2.4, 1.9, 1.8, 0.2), mA, -0.85, 1.85, 0); add(rounded(1.1, 0.6, 0.06, 0.1), glass, -0.85, 2.15, 0.9, false);
      const cone = add(new THREE.ConeGeometry(0.32, 0.8, 18), glossy('#f4b860'), -0.85, 3.05, 0, false); cone.rotation.z = Math.PI;
      add(new THREE.SphereGeometry(0.38, 18, 12), glossy('#ff7eb3'), -0.85, 3.5, 0, false); add(new THREE.SphereGeometry(0.1, 10, 8), glossy('#ff4d4d'), -0.85, 3.9, 0, false);
    }
    if (kind === 'mixer') {
      const drum = add(new THREE.CapsuleGeometry(0.82, 1.1, 8, 20), mB, -0.8, 1.95, 0); drum.rotation.z = Math.PI / 2 + 0.22;
      for (const x of [-1.25, -0.8, -0.35]) { const ring = add(new THREE.TorusGeometry(0.8, 0.06, 8, 24), mA, x, 1.95 + (x + 0.8) * -0.22, 0, false); ring.rotation.y = Math.PI / 2; ring.rotation.x = 0.22; }
    }
  }
  add(rounded(0.26, 0.32, 1.84, 0.1), grey, 2.0, 0.86, 0, false);                  // bumper
  // wheels
  const wx = kind === 'bus' ? [-1.35, 1.35] : [-1.3, -0.3, 1.25];
  for (const x of wx) for (const z of [-0.82, 0.82]) {
    const w = new THREE.Group(); w.position.set(x, 0.5, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 24), dark); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.38, 16), glossy(cb === '#ffffff' ? '#ffd23f' : cb)); hub.rotation.x = Math.PI / 2;
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.4), grey);
    w.add(tyre, hub, bolt); g.add(w); wheels.push(w); paint.push(tyre);
  }
  // friendly face on the front: headlight eyes + grille smile
  const whiteM = glossy('#ffffff'), pupilM = glossy('#28203a');
  for (const z of [-0.45, 0.45]) {
    const e = new THREE.Group(); e.position.set(2.0, kind === 'bus' ? 1.3 : 1.28, z);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), whiteM); w.scale.set(0.55, 1, 1);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), pupilM); p.position.x = 0.14;
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), whiteM); gl.position.set(0.24, 0.06, 0.05);
    e.add(w, p, gl); g.add(e); eyes.push({ e, w, p, gl, z });
  }
  // sit the face exactly on the front surface, whatever the body shape
  g.updateMatrixWorld(true);
  const frontX = (y, z) => { const rc = new THREE.Raycaster(new THREE.Vector3(6, y, z), new THREE.Vector3(-1, 0, 0)); const h = rc.intersectObjects(paint, false)[0]; return h ? h.point.x : 2.0; };
  for (const e of eyes) e.e.position.x = frontX(e.e.position.y, e.e.position.z) - 0.05;
  const sm = new THREE.TorusGeometry(0.28, 0.05, 8, 18, Math.PI); sm.rotateZ(Math.PI); sm.rotateY(Math.PI / 2);
  mouth = new THREE.Mesh(sm, pupilM); mouth.position.set(frontX(1.08, 0) + 0.02, 1.08, 0); g.add(mouth);
  return g;
}

// ---------------------------------------------------------------- dirt / foam / drops / stickers (instanced, children of the truck)
const MAXP = 18;
const mudIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.95 }), MAXP * 3);
const foamIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }), MAXP * 5);
const dropIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#7fd0ff', roughness: 0.05, transparent: true, opacity: 0.85 }), MAXP * 3);
const ghostIM = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.08, 6, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), 8);
for (const im of [mudIM, foamIM, dropIM, ghostIM]) im.frustumCulled = false;
const MUDC = ['#8b5a2b', '#7a4e24', '#9c6b3f'];
function starShape(kind) {
  const s = new THREE.Shape();
  if (kind === 0) { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.42 : 1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (kind === 1) { s.moveTo(0, -0.9); s.bezierCurveTo(-1.3, 0, -0.7, 1.1, 0, 0.45); s.bezierCurveTo(0.7, 1.1, 1.3, 0, 0, -0.9); }
  else { for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, r = 0.62 + 0.38 * Math.abs(Math.cos(a * 2.5)); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); return g;
}
const STICK_GEO = [starShape(0), starShape(1), starShape(2)], STICK_COL = ['#ffd23f', '#ff4d6d', '#a35cff', '#3ab7ff', '#3ccf7a'];

let patches = [], spots = [], steps = [], stepI = 0, stuck = [];
const ray = new THREE.Raycaster(), Z = new THREE.Vector3(0, 0, 1);
function surfacePoints(n, r, sidePrefer, minGap) {
  const pts = [], box = new THREE.Box3().setFromObject(truck);
  for (let tries = 0; pts.length < n && tries < 400; tries++) {
    const front = !sidePrefer && r() < 0.18;
    let o, d;
    if (front) { o = new THREE.Vector3(5, 0.9 + r() * 1.7, (r() - 0.5) * 1.5); d = new THREE.Vector3(-1, 0, 0); }
    else { o = new THREE.Vector3(box.min.x + 0.3 + r() * (box.max.x - box.min.x - 0.6), 0.35 + r() * (Math.min(box.max.y, 3.2) - 0.55), 5); d = new THREE.Vector3(0, 0, -1); }
    ray.set(o, d); const hit = ray.intersectObjects(paint, false)[0]; if (!hit) continue;
    const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (nrm.dot(d) > -0.5) continue;
    if (pts.some(p => p.p.distanceTo(hit.point) < minGap)) continue;
    if (eyes.some(e => e.e.position.distanceTo(hit.point) < 0.45)) continue;
    pts.push({ p: hit.point.clone(), q: new THREE.Quaternion().setFromUnitVectors(Z, nrm), n: nrm });
  }
  return pts;
}

// ---------------------------------------------------------------- state
const B = worldBoard({ game: 'sudsy-lane', label: 'Points', limits: { maxRun: 1500, maxPerSec: 100 }, mode: 'sum' });
let levelStart = 0;   // score when this wash started: the world board counts each finished wash's points
let state = 'ready', score = 0, sessionLv = 0, enter = 0, driveOff = 0, happy = 0, idle = 0, now = 0, kind = 'dump', rubbing = null, botRub = 0, botTarget = null;
const lookP = new THREE.Vector3(3, 1.5, 4);

function build() {
  const seed = D.seed ? D.seed + sessionLv * 61 : level * 7919 + 11, r = rng(seed);
  applyPalette(palette(level));
  if (truck) scene.remove(truck);
  kind = KINDS[(level - 1 + (D.seed ? Math.floor(r() * 5) : 0)) % KINDS.length];
  truck = buildTruck(kind); truck.updateMatrixWorld(true);
  // the sequence of tools for this level
  steps = level === 1 ? ['soap', 'rinse'] : level === 2 ? ['soap', 'rinse', 'dry'] : ['soap', 'rinse', 'dry', 'stick'];
  const n = clamp(4 + level, 5, MAXP);
  patches = surfacePoints(n, r, false, 0.75).map(pt => ({ ...pt, r: 0.3 + r() * 0.14, mud: 1, foam: 0, wet: 0, offs: [0, 1, 2, 3, 4].map(() => new THREE.Vector3((r() - 0.5) * 0.9, (r() - 0.5) * 0.8, 0)), mc: Math.floor(r() * 3) }));
  spots = steps.includes('stick') ? surfacePoints(clamp(2 + Math.floor(level / 3), 3, 6), r, true, 1.1).map((pt, i) => ({ ...pt, r: 0.32, done: 0, shape: Math.floor(r() * 3), col: STICK_COL[Math.floor(r() * STICK_COL.length)] })) : [];
  stuck.forEach(m => m.parent && m.parent.remove(m)); stuck = [];
  truck.add(mudIM, foamIM, dropIM, ghostIM);
  for (const im of [mudIM, foamIM, dropIM]) { for (let i = 0; i < im.count; i++) im.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
  patches.forEach((p, i) => p.offs.slice(0, 3).forEach((_, k) => mudIM.setColorAt(i * 3 + k, new THREE.Color(MUDC[(p.mc + k) % 3]))));
  if (mudIM.instanceColor) mudIM.instanceColor.needsUpdate = true;
  stepI = 0; enter = 1; driveOff = 0; happy = 0; idle = 0;
  truck.position.set(-11, 0, 0); truck.rotation.y = -0.72;
  scene.add(truck);
  renderTools(); ui.levels(level); ui.progress(0); ui.score(score);
}
function renderTools() {
  toolRow.innerHTML = steps.map((s, i) => `<div class="sl-tool ${i < stepI ? 'done' : i === stepI ? 'on' : ''}">${TOOLS[s]}</div>`).join('');
  cursor.textContent = TOOLS[steps[stepI]] || '';
}
const stepVal = (p) => { const s = steps[stepI]; return s === 'soap' ? p.mud : s === 'rinse' ? p.foam : s === 'dry' ? p.wet : 0; };
function stepTargets() { return steps[stepI] === 'stick' ? spots.filter(s => s.done < 1) : patches.filter(p => stepVal(p) > 0); }

// ---------------------------------------------------------------- rubbing
const _w = new THREE.Vector3();
function rubAt(local, amt) {
  if (state !== 'play' || enter > 0) return;
  const s = steps[stepI]; let any = false;
  if (s === 'stick') {
    for (const sp of spots) if (sp.done < 1 && sp.p.distanceTo(local) < 0.7) { sp.done = 1; any = true; placeSticker(sp); }
  } else {
    for (const p of patches) {
      if (p.p.distanceTo(local) > 0.62 + p.r * 0.5) continue;
      const before = stepVal(p); if (before <= 0) continue; any = true;
      const v = Math.max(0, before - amt);
      if (s === 'soap') { p.mud = v < 0.05 ? 0 : v; p.foam = Math.max(p.foam, 1 - p.mud); }
      else if (s === 'rinse') { p.foam = v < 0.05 ? 0 : v; p.wet = Math.max(p.wet, 1 - p.foam); }
      else if (s === 'dry') { p.wet = v < 0.05 ? 0 : v; }
      if (stepVal(p) === 0) { score += 10; ui.score(score); patchDone(p); }
    }
  }
  // juice while rubbing
  _w.copy(local).applyMatrix4(truck.matrixWorld);
  if (Math.random() < 0.5) {
    if (s === 'soap') burst(scene, _w.clone().setZ(_w.z + 0.3), ['#ffffff', '#e8f6ff', '#ffd6f0'], 2, { speed: 0.03, up: 0.03, size: 0.7, shape: 'sphere', gravity: -0.0008 });
    if (s === 'rinse') burst(scene, _w.clone().add(new THREE.Vector3(0.4, 0.8, 0.6)), ['#7fd0ff', '#bfe9ff'], 3, { speed: 0.04, up: -0.02, size: 0.45, shape: 'sphere', gravity: 0.01 });
    if (s === 'dry') burst(scene, _w.clone().setZ(_w.z + 0.4), ['#ffffff'], 2, { speed: 0.06, up: 0.02, size: 0.6, shape: 'sphere', gravity: -0.001 });
  }
  if (any) { idle = 0; if (Math.random() < 0.25) tone(s === 'soap' ? 700 + Math.random() * 300 : s === 'rinse' ? 300 + Math.random() * 200 : 1200, 0.05, s === 'dry' ? 'triangle' : 'sine', 0.05, s === 'rinse' ? 0.6 : 1.4); }
  checkStep();
}
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
let doneCount = 0;
function patchDone(p) {
  doneCount++; note(67 + PENTA[doneCount % PENTA.length], 0.2, 0.12); buzz(8);
  _w.copy(p.p).applyMatrix4(truck.matrixWorld);
  burst(scene, _w, ['#ffffff', '#ffd23f'], 6, { speed: 0.05, up: 0.06, size: 0.4, shape: 'sphere', gravity: 0.003 });
}
function placeSticker(sp) {
  const m = new THREE.Mesh(STICK_GEO[sp.shape], glossy(sp.col)); m.position.copy(sp.p).addScaledVector(sp.n, 0.03); m.quaternion.copy(sp.q); m.scale.setScalar(0.01);
  m.userData.grow = 0; truck.add(m); stuck.push(m);
  score += 15; ui.score(score); [0, 7, 12].forEach((s, i) => setTimeout(() => note(76 + s, 0.18, 0.12), i * 60)); buzz(12);
  _w.copy(sp.p).applyMatrix4(truck.matrixWorld); confetti(scene, _w, 18);
}
function checkStep() {
  if (state !== 'play') return;
  const s = steps[stepI];
  const total = s === 'stick' ? spots.length : patches.length, left = stepTargets().length;
  ui.progress((stepI + (total ? 1 - left / total : 1)) / steps.length);
  if (left > 0) return;
  stepI++; score += 50; ui.score(score); happy = 1;
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, new THREE.Vector3(0, 3, 1), 50); }
  if (stepI >= steps.length) return win();
  [0, 4, 7, 12].forEach((k, i) => setTimeout(() => note(72 + k, 0.25, 0.13), i * 80));
  ui.pop('⭐', '#fff', 60, 24); ui.flash(0.15);
  renderTools();
}
let beatenShown = false;
function win() {
  state = 'won'; renderTools(); B.submit(score - levelStart);
  const done = level; level++; sessionLv++; if (!D.seed) S.set('level', level);
  best = Math.max(best, score); S.set('best', best);
  // beep beep! then drive off sparkling
  tone(440, 0.14, 'square', 0.08, 1); setTimeout(() => tone(440, 0.2, 'square', 0.08, 1), 200);
  setTimeout(() => [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(72 + s, 0.35, 0.15), i * 90)), 380);
  confetti(scene, new THREE.Vector3(0, 3, 1), 110); ui.flash(0.35); buzz([20, 30, 20]); happy = 1;
  setTimeout(() => { driveOff = 0.001; }, 500);
  D.won(score); ui.win(done, '⭐⭐⭐');
}

// ---------------------------------------------------------------- input: rub with a finger
const ndc = new THREE.Vector2();
function hitLocal(cx, cy) {
  if (!truck) return null;
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(truck, true).find(x => x.object.isMesh && !x.object.isInstancedMesh);
  if (h) { lookP.copy(h.point); return truck.worldToLocal(h.point.clone()); }
  // forgiving: project onto the truck's side plane
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(truck.quaternion), truck.localToWorld(new THREE.Vector3(0, 0, 0.9)));
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(pl, p)) return null; lookP.copy(p); return truck.worldToLocal(p);
}
let down = false;
addEventListener('pointerdown', e => {
  if (state !== 'play') return; down = true; cursor.style.display = 'block'; moveCursor(e.clientX, e.clientY);
  rubbing = hitLocal(e.clientX, e.clientY); if (rubbing) rubAt(rubbing, steps[stepI] === 'stick' ? 1 : 0.2);
});
addEventListener('pointermove', e => { if (!down) return; moveCursor(e.clientX, e.clientY); rubbing = hitLocal(e.clientX, e.clientY); });
const up = () => { down = false; rubbing = null; cursor.style.display = 'none'; };
addEventListener('pointerup', up); addEventListener('pointercancel', up);
function moveCursor(x, y) { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; cursor.style.rotate = (Math.sin(now * 20) * 14) + 'deg'; }
ui.onTap(() => { build(); state = 'play'; ui.hideStart(); toolRow.classList.remove('sl-hidden'); levelStart = score; B.start(); });

// ---------------------------------------------------------------- loop
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
let blinkT = 2; const REST = -0.3; const DIRT = new THREE.Color('#8a6a4a');
loop((dt, t) => {
  now = t;
  rollers.forEach((r, i) => r.rotation.y += (i ? -1 : 1) * 0.05 * dt);
  airD.forEach((d, i) => { d.y += d.v * dt; if (d.y > 7.5) d.y = 0; _m.compose(_p.set(d.x + Math.sin(t + d.ph) * 0.3, d.y, -0.8 + Math.cos(d.ph) * 1.5), _q.identity(), _s.setScalar(d.s)); airIM.setMatrixAt(i, _m); });
  airIM.instanceMatrix.needsUpdate = true;
  if (!truck) return;
  // drive in / drive off
  let speed = 0;
  if (enter > 0) { const x = truck.position.x; truck.position.x = lerp(x, REST, 0.06 * dt); speed = truck.position.x - x; if (Math.abs(truck.position.x - REST) < 0.02) { truck.position.x = REST; enter = 0; tone(520, 0.08, 'triangle', 0.08, 1.3); } }
  if (driveOff > 0) { driveOff += dt; const x = truck.position.x; truck.position.x += Math.min(0.25, driveOff * 0.004) * dt; speed = truck.position.x - x; }
  wheels.forEach(w => w.rotation.z -= speed / 0.5);
  happy = Math.max(0, happy - dt * 0.03);
  truck.position.y = Math.abs(Math.sin(happy * Math.PI * 3)) * 0.35 * happy + (Math.abs(speed) > 0.01 ? Math.abs(Math.sin(t * 25)) * 0.03 : 0);
  truck.rotation.z = Math.sin(t * 1.6) * 0.008 + (speed > 0.01 ? -0.02 : 0);
  // rub every frame while held (holding still also scrubs)
  if (down && rubbing && state === 'play') rubAt(rubbing, steps[stepI] === 'stick' ? 0 : 0.05 * dt);
  if (botRub > 0 && botTarget) { botRub -= dt; rubAt(botTarget, steps[stepI] === 'stick' ? 1 : 0.05 * dt); }
  // dirt tint on the body follows the mud left
  const mud = patches.length ? patches.reduce((a, p) => a + p.mud, 0) / patches.length : 0;
  for (const b of bodyMats) b.m.color.copy(b.c).lerp(DIRT, mud * 0.35);
  // instances: mud splats, foam clusters, water drops, sticker ghost rings
  patches.forEach((p, i) => {
    for (let k = 0; k < 3; k++) { const o = p.offs[k], sc = p.mud * p.r * (k ? 0.65 : 1); _p.set(o.x * p.r, o.y * p.r, 0.02).applyQuaternion(p.q).add(p.p); _m.compose(_p, p.q, _s.set(sc, sc * 0.85, sc * 0.18)); mudIM.setMatrixAt(i * 3 + k, _m); }
    for (let k = 0; k < 5; k++) { const o = p.offs[k], sc = p.foam * p.r * (0.55 + 0.12 * Math.sin(t * 3 + k + i)); _p.set(o.x * p.r * 1.1, o.y * p.r * 1.1, 0.06).applyQuaternion(p.q).add(p.p); _m.compose(_p, p.q, _s.set(sc, sc, sc * 0.75)); foamIM.setMatrixAt(i * 5 + k, _m); }
    for (let k = 0; k < 3; k++) { const o = p.offs[k + 2], sc = p.wet * 0.085 * (k ? 0.8 : 1.2); _p.set(o.x * p.r * 1.2, o.y * p.r * 1.2 - (1 - p.wet) * 0.1, 0.03).applyQuaternion(p.q).add(p.p); _m.compose(_p, p.q, _s.set(sc, sc * 1.25, sc * 0.6)); dropIM.setMatrixAt(i * 3 + k, _m); }
  });
  mudIM.count = patches.length * 3; foamIM.count = patches.length * 5; dropIM.count = patches.length * 3;
  const showGhost = steps[stepI] === 'stick' && state === 'play';
  let gn = 0; for (const sp of spots) if (showGhost && sp.done < 1) { const sc = 0.32 + Math.sin(t * 5) * 0.04; _p.copy(sp.p).addScaledVector(sp.n, 0.03); _m.compose(_p, sp.q, _s.set(sc, sc, sc)); ghostIM.setMatrixAt(gn++, _m); }
  ghostIM.count = gn;
  for (const im of [mudIM, foamIM, dropIM, ghostIM]) im.instanceMatrix.needsUpdate = true;
  for (const m of stuck) { m.userData.grow = Math.min(1, m.userData.grow + dt * 0.08); const k = m.userData.grow, e = 1 + Math.sin(k * Math.PI) * 0.5; m.scale.setScalar(0.3 * k * e); }
  // eyes follow the finger, blink, squint when happy
  blinkT -= dt / 60; const blink = blinkT < 0.12 ? 0.12 : 1; if (blinkT < 0) blinkT = 2 + Math.random() * 3;
  const loc = truck.worldToLocal(lookP.clone());
  for (const e of eyes) {
    const dy = clamp((loc.y - e.e.position.y) * 0.05, -0.09, 0.09), dz = clamp((loc.z - e.e.position.z) * 0.05, -0.09, 0.09);
    e.p.position.set(0.13, dy, dz); e.gl.position.set(0.24, dy + 0.06, dz + 0.05);
    e.e.scale.y = lerp(e.e.scale.y, happy > 0.2 ? 0.3 : blink, 0.35);
  }
  if (mouth) mouth.scale.setScalar(lerp(mouth.scale.x, happy > 0.1 ? 1.35 : 1, 0.2));
  // helper hand: after a few idle seconds, point at the next spot to rub
  idle += state === 'play' && !down && enter === 0 ? dt / 60 : -idle;
  const tg = state === 'play' && idle > 2.5 ? stepTargets()[0] : null;
  if (tg) { _v.copy(tg.p).applyMatrix4(truck.matrixWorld).project(camera); hand.style.display = 'block'; hand.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; hand.style.top = ((1 - _v.y) / 2 * innerHeight) + 'px'; }
  else hand.style.display = 'none';
  sun.position.set(4, 10, 8);
});

build(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // rub the nearest spot that still needs this tool
    if (state !== 'play' || enter > 0) return;
    const ts = stepTargets(); if (!ts.length) return;
    let pick = ts[0]; if (botTarget) { let bd = 1e9; for (const p of ts) { const d = p.p.distanceTo(botTarget); if (d < bd) { bd = d; pick = p; } } }
    botTarget = pick.p.clone(); botRub = 7;
    _v.copy(pick.p).applyMatrix4(truck.matrixWorld); lookP.copy(_v); _v.project(camera);
    cursor.style.display = 'block'; moveCursor((_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight);
  },
};

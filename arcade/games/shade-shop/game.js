// Shade Shop — original game. Look at the object, mix drops of paint until your shade matches, then spray it on.
import { THREE, createStage, createUI, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, store, lerp, clamp, rng } from './kit/hc.js';

const ST = store('shadeshop');
let level = ST.get('level', 1), best = ST.get('best', 0), score = ST.get('score', 0);
const { scene, camera, renderer, sun } = createStage({ fov: 38, shadowSize: 8 });
renderer.localClippingEnabled = true;
const ui = createUI({ title: 'SHADE<br>SHOP', hint: 'Tap paints to mix the colour', hand: '🎨', score: false });
document.body.style.setProperty('--bg1', '#c4b0ff'); document.body.style.setProperty('--bg2', '#f3e6ff'); document.body.style.setProperty('--ui', '#ff4f9a');
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- paint model (artist RYB cube: red + yellow = orange, yellow + blue = green, red + blue = purple)
const PAINTS = [
  { name: 'red', hex: '#ec2a3a', ryb: [1, 0, 0] },
  { name: 'yellow', hex: '#ffd21f', ryb: [0, 1, 0] },
  { name: 'blue', hex: '#1f63e8', ryb: [0, 0, 1] },
  { name: 'white', hex: '#ffffff' },
  { name: 'black', hex: '#26262e' },
];
const CUBE = [[1, 1, 1], [0.93, 0.14, 0.17], [1, 0.84, 0.1], [0.12, 0.39, 0.91], [1, 0.52, 0.06], [0.58, 0.16, 0.74], [0.16, 0.72, 0.28], [0.22, 0.12, 0.05]];
function ryb2rgb(r, y, b) {   // trilinear interpolation in the RYB colour cube (sRGB out)
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const w = (i, j, k) => CUBE[i + j * 2 + k * 4 === 0 ? 0 : [0, 1, 2, 4, 3, 5, 6, 7][i + j * 2 + k * 4]][c];
    out[c] = w(0,0,0)*(1-r)*(1-y)*(1-b) + w(1,0,0)*r*(1-y)*(1-b) + w(0,1,0)*(1-r)*y*(1-b) + w(0,0,1)*(1-r)*(1-y)*b
           + w(1,1,0)*r*y*(1-b) + w(1,0,1)*r*(1-y)*b + w(0,1,1)*(1-r)*y*b + w(1,1,1)*r*y*b;
  }
  return out;
}
const lin = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
function mix(counts) {
  const nC = counts[0] + counts[1] + counts[2], nW = counts[3], nB = counts[4] * 1.6, tot = nC + nW + nB; if (!tot) return null;
  let col = [0, 0, 0];
  if (nC) { const v = [counts[0], counts[1], counts[2]], m = Math.max(...v); col = ryb2rgb(v[0] / m, v[1] / m, v[2] / m); }
  const out = [0, 1, 2].map(c => (col[c] * nC + 1 * nW + 0.1 * nB) / tot);
  return out.map(lin);   // linear rgb 0..1
}
const toColor = r => new THREE.Color().setRGB(r[0], r[1], r[2], THREE.LinearSRGBColorSpace);
function lab(r) {   // linear rgb -> CIE Lab
  const X = (r[0] * 0.4124 + r[1] * 0.3576 + r[2] * 0.1805) / 0.95047, Y = r[0] * 0.2126 + r[1] * 0.7152 + r[2] * 0.0722, Z = (r[0] * 0.0193 + r[1] * 0.1192 + r[2] * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function dist(a, b) { if (!a) return 1e9; const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
function match(a, b) { if (!a || !b) return 0; const A = lab(a), B = lab(b); const d = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); return clamp(Math.round(100 - d * 1.1), 0, 100); }

// ---------------------------------------------------------------- objects (built from primitives; paint parts get the colour)
const fixed = (c, o) => mat(c, o);
function lathe(points, seg = 40) { return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg); }
const OBJECTS = [
  function apple() {
    const g = new THREE.Group(), paint = [];
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; const r = Math.sin(a) * (1.05 + 0.12 * Math.sin(a * 2)) ; pts.push([Math.max(0.001, r), -Math.cos(a) * 1.0 + 0.12 * Math.pow(Math.sin(a), 6) - (i === 24 ? 0.18 : 0)]); }
    pts[24][1] -= 0; const body = new THREE.Mesh(lathe(pts), null); body.scale.set(1, 0.95, 1); paint.push(body); g.add(body);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.55, 8), fixed('#6b3e1f')); stem.position.set(0.04, 1.05, 0); stem.rotation.z = -0.25; g.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 8), fixed('#3fae3a')); leaf.scale.set(1, 0.18, 0.5); leaf.position.set(0.32, 1.12, 0); leaf.rotation.z = 0.5; g.add(leaf);
    return { g, paint };
  },
  function duck() {
    const g = new THREE.Group(), paint = [];
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), null); body.scale.set(1.15, 0.78, 0.95); body.position.y = -0.25;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 16), null); tail.position.set(-1.05, 0.05, 0); tail.rotation.z = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 22), null); head.position.set(0.45, 0.78, 0);
    paint.push(body, head, tail); g.add(body, head, tail);
    const beak = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), fixed('#ff8a1e')); beak.scale.set(1.3, 0.45, 0.9); beak.position.set(1.05, 0.7, 0); g.add(beak);
    for (const z of [-0.3, 0.3]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), fixed('#1b1b22')); e.position.set(0.82, 0.95, z * 1.05); g.add(e); }
    g.rotation.y = -0.5;
    return { g, paint };
  },
  function cupcake() {
    const g = new THREE.Group(), paint = [];
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.72, 0.95, 24, 1, false), fixed('#ffffff', { flatShading: true })); liner.position.y = -0.62; g.add(liner);
    const f1 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.32, 16, 32), null); f1.rotation.x = Math.PI / 2; f1.position.y = 0.0;
    const f2 = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.28, 16, 28), null); f2.rotation.x = Math.PI / 2; f2.position.y = 0.42;
    const f3 = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.22, 14, 24), null); f3.rotation.x = Math.PI / 2; f3.position.y = 0.76;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 16), null); tip.position.y = 1.08;
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.5, 24), null); fill.position.y = -0.05;
    paint.push(f1, f2, f3, tip, fill); g.add(f1, f2, f3, tip, fill);
    const cols = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#ffffff'];
    for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fixed(cols[i % 5])); const a = i * 2.4, r = 0.35 + (i % 3) * 0.2; s.position.set(Math.cos(a) * r, 0.45 + (2 - i % 3) * 0.2, Math.sin(a) * r); g.add(s); }
    g.position.y = 0.1;
    return { g, paint };
  },
  function balloon() {
    const g = new THREE.Group(), paint = [];
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; pts.push([Math.max(0.001, Math.sin(a) * (0.95 - 0.18 * (1 - Math.cos(a)) / 2)), -Math.cos(a) * 1.22]); }
    const b = new THREE.Mesh(lathe(pts), null); b.rotation.x = Math.PI; b.position.y = 0.2;
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 12), null); knot.position.y = -1.08;
    paint.push(b, knot); g.add(b, knot);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4), fixed('#ffffff')); str.position.y = -1.6; g.add(str);
    return { g, paint };
  },
  function mushroom() {
    const g = new THREE.Group(), paint = [];
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2), null); cap.scale.set(1, 0.78, 1); cap.position.y = 0.15;
    const under = new THREE.Mesh(new THREE.CircleGeometry(1.15, 36), fixed('#f1dcc0')); under.rotation.x = Math.PI / 2; under.position.y = 0.15;
    paint.push(cap); g.add(cap, under);
    const stem = new THREE.Mesh(lathe([[0.001, -1.1], [0.5, -1.1], [0.42, -0.4], [0.38, 0.15], [0.001, 0.15]]), fixed('#fff4e0')); g.add(stem);
    for (let i = 0; i < 6; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), fixed('#ffffff')); const a = i * 1.05 + 0.3, r = i === 5 ? 0 : 0.65; d.position.set(Math.cos(a) * r, 0.15 + (i === 5 ? 0.88 : 0.62), Math.sin(a) * r); d.scale.set(1, 0.4, 1); d.lookAt(d.position.clone().multiplyScalar(2)); g.add(d); }
    g.position.y = 0.2;
    return { g, paint };
  },
  function heart() {
    const g = new THREE.Group(), paint = [];
    const s = new THREE.Shape(); s.moveTo(0, -0.95); s.bezierCurveTo(0.9, -0.2, 1.25, 0.35, 0.95, 0.8); s.bezierCurveTo(0.7, 1.15, 0.2, 1.05, 0, 0.62); s.bezierCurveTo(-0.2, 1.05, -0.7, 1.15, -0.95, 0.8); s.bezierCurveTo(-1.25, 0.35, -0.9, -0.2, 0, -0.95);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.22, bevelSegments: 6, curveSegments: 24 }); geo.translate(0, -0.05, -0.225);
    const h = new THREE.Mesh(geo, null); paint.push(h); g.add(h); g.scale.setScalar(1.1);
    return { g, paint };
  },
];

// ---------------------------------------------------------------- scene: pedestal + object (top), bowl of paint (bottom)
const objRoot = new THREE.Group(); scene.add(objRoot);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.32, 40), glossy('#8f6bff')); pedestal.receiveShadow = true; pedestal.castShadow = true; scene.add(pedestal);
const bowlRoot = new THREE.Group(); scene.add(bowlRoot);
const bowl = new THREE.Mesh(lathe([[0.001, -0.75], [1.0, -0.75], [1.45, -0.45], [1.7, 0.1], [1.78, 0.42], [1.68, 0.46], [1.58, 0.1], [1.35, -0.38], [0.95, -0.6], [0.001, -0.6]], 48), glossy('#ffffff'));
bowl.castShadow = bowl.receiveShadow = true; bowlRoot.add(bowl);
const liquidMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.12, metalness: 0.0 });
const liquid = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), liquidMat); liquid.rotation.x = -Math.PI / 2; liquid.position.y = 0.05; bowlRoot.add(liquid);
const swirlTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.translate(128, 128); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineCap = 'round';
  for (let i = 0; i < 3; i++) { x.lineWidth = 9 - i * 2; x.beginPath(); for (let a = 0; a < 9; a += 0.05) { const r = 12 + a * 12; x.lineTo(Math.cos(a + i * 2.1) * r, Math.sin(a + i * 2.1) * r); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.55, 48), new THREE.MeshBasicMaterial({ map: swirlTex, transparent: true, opacity: 0, depthWrite: false })); swirl.rotation.x = -Math.PI / 2; swirl.position.y = 0.06; bowlRoot.add(swirl);
const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.15, transparent: true })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.07; blob.visible = false; bowlRoot.add(blob);
const brush = new THREE.Group();   // a wooden stirring stick that swirls after every drop
{ const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 10), fixed('#d9a066')); stick.position.y = 1.2; brush.add(stick); const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12), glossy('#c0c0d0', { metalness: 0.6 })); ferr.position.y = 0.0; brush.add(ferr); brush.tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 12), mat('#fff')); brush.tip.rotation.x = Math.PI; brush.tip.position.y = -0.3; brush.add(brush.tip); }
brush.rotation.z = -0.5; bowlRoot.add(brush);
const DROP_G = new THREE.SphereGeometry(0.2, 20, 14);
const can = new THREE.Group();   // spray can for the paint phase
{ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 24), glossy('#e8273b')); can.body = b; const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#dddde6', { metalness: 0.5 })); top.position.y = 0.6; const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10), mat('#fff')); noz.position.y = 0.95; can.add(b, top, noz); }
can.visible = false; scene.add(can);

// ---------------------------------------------------------------- layout (screen-anchored)
const ray = new THREE.Raycaster(), plane0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tmpV = new THREE.Vector3();
function toWorld(px, py, z = 0) { ray.setFromCamera(new THREE.Vector2(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1), camera); plane0.constant = -z; return ray.ray.intersectPlane(plane0, new THREE.Vector3()); }
let objY = 2.5, bowlY = -3, camBase = new THREE.Vector3(0, 0, 15), camLook = new THREE.Vector3();
function layout() {
  camera.position.copy(camBase); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  objY = toWorld(innerWidth / 2, innerHeight * 0.27).y; bowlY = toWorld(innerWidth / 2, innerHeight * 0.83).y;
  const half = toWorld(innerWidth, innerHeight / 2).x, s = clamp(half / 2.4, 0.75, 1.25);
  objRoot.position.set(0, objY, 0); objRoot.scale.setScalar(s); pedestal.position.set(0, objY - 1.42 * s, 0); pedestal.scale.setScalar(s);
  bowlRoot.position.set(0, bowlY, 0); bowlRoot.scale.setScalar(s * 0.92); bowlRoot.rotation.x = 0.55;
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- level state
let state = 'ready', phase = 'mix', obj, target, recipe, counts, cur = null, shown = null, drops = [], pct = 0, paintT = 0, clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), painted = [], bounds, stir = 0, resultPct = 0, R;
const targetMat = mat('#fff', { roughness: 0.35 }), baseMat = mat('#f7f5fb', { roughness: 0.45 }), paintMat = mat('#fff', { roughness: 0.35, clippingPlanes: [clipPlane] });

function makeRecipe() {
  R = rng(level * 4111 + 7);
  const nCol = level <= 2 ? 2 : level <= 5 ? 2 + (R() < 0.5 ? 1 : 0) : 3 + (R() < 0.35 ? 1 : 0);
  const maxEach = level <= 2 ? 1 : level <= 4 ? 2 : 3;
  const pool = level <= 3 ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  for (let tries = 0; tries < 50; tries++) {
    const cols = []; while (cols.length < nCol) { const c = pool[Math.floor(R() * pool.length)]; if (!cols.includes(c)) cols.push(c); }
    if (cols.includes(4) && cols.includes(3) && nCol < 4) continue;          // grey is boring
    if (level <= 2 && cols.includes(3)) continue;                              // first levels: clear hue mixes
    const r = [0, 0, 0, 0, 0]; cols.forEach(c => r[c] = 1 + Math.floor(R() * maxEach));
    if (r[4] > 1) r[4] = 1;
    const m = mix(r), L = lab(m);
    if (L[0] < 22 || Math.hypot(L[1], L[2]) < 12) continue;                  // skip mud
    return r;
  }
  return [1, 1, 0, 0, 0];
}

function buildLevel() {
  if (obj) objRoot.remove(obj.g);
  for (const p of painted) p.parent && p.parent.remove(p); painted = [];
  obj = OBJECTS[(level - 1) % OBJECTS.length]();
  for (const m of obj.paint) { m.material = targetMat; m.castShadow = true; }
  obj.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  objRoot.add(obj.g);
  recipe = makeRecipe(); target = mix(recipe);
  targetMat.color.copy(toColor(target));
  counts = [0, 0, 0, 0, 0]; cur = null; shown = [0.96, 0.96, 0.96]; pct = 0; phase = 'mix'; paintT = 0; drops.forEach(d => scene.remove(d.m)); drops = [];
  liquidMat.color.setRGB(0.93, 0.93, 0.95); blob.visible = false;
  $('swT').style.background = '#' + toColor(target).getHexString(THREE.SRGBColorSpace);
  $('swM').style.background = '#f4f4f4'; $('pct').textContent = '0%';
  $('paints').classList.remove('off'); $('cmp').style.opacity = 1; $('rst').classList.remove('hidden'); $('done').classList.add('hidden'); $('banner').className = 'banner';
  can.visible = false; ui.levels(level); ui.progress(0); ui.sub('');
  const pal = [0, 1, 2, 3, 4].filter(i => level > 3 || i !== 4);
  $('paints').innerHTML = '';
  pal.forEach(i => { const b = document.createElement('button'); b.style.background = PAINTS[i].hex; b.dataset.i = i; b.setAttribute('aria-label', PAINTS[i].name);
    b.addEventListener('pointerdown', e => { e.stopPropagation(); addDrop(i, b); }); $('paints').appendChild(b); });
  camBase.set(0, 0, 15); layout();
}

// ---------------------------------------------------------------- actions
function addDrop(i, btn) {
  if (state !== 'play' || phase !== 'mix' || drops.length > 3) return;
  if (counts.reduce((a, b) => a + b, 0) + drops.length >= 14) { ui.pop('POT FULL!', '#fff', 28, 40); return; }
  const r = btn.getBoundingClientRect(), p = toWorld(r.left + r.width / 2, r.top + r.height / 2, 1.5);
  const m = new THREE.Mesh(DROP_G, glossy(PAINTS[i].hex)); m.position.copy(p); m.castShadow = true; scene.add(m);
  const end = bowlRoot.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.1, (Math.random() - 0.5) * 0.6));
  drops.push({ m, i, p0: p.clone(), end, t: 0 });
  btn.classList.add('hit'); setTimeout(() => btn.classList.remove('hit'), 90);
  tone(700 + i * 60, 0.05, 'sine', 0.1, 1.3); buzz(6);
}
function landDrop(d) {
  counts[d.i]++; cur = mix(counts);
  blob.material.color.set(PAINTS[d.i].hex); blob.visible = true; blob.scale.setScalar(0.05); blob.material.opacity = 1;
  const lp = bowlRoot.worldToLocal(d.end.clone()); blob.position.x = lp.x; blob.position.z = lp.z; blob.t = 0;
  stir = 1; burst(scene, d.end, [PAINTS[d.i].hex, PAINTS[d.i].hex, '#ffffff'], 10, { speed: 0.07, up: 0.1, size: 0.7, shape: 'sphere', gravity: 0.012 });
  const n = counts.reduce((a, b) => a + b, 0);
  note(64 + [0, 4, 7, 12, 16, 19, 24][Math.min(6, n - 1)], 0.3, 0.12); buzz(10);
  const prev = pct; pct = match(cur, target);
  $('pct').textContent = pct + '%'; $('done').classList.remove('hidden');
  ui.progress(pct / 100);
  if (pct >= 90 && prev < 90) { ui.pop(pct >= 97 ? 'PERFECT!' : 'GREAT MATCH!', '#fff', 36, 38); sfx.coin(); }
}
function resetPot() {
  if (state !== 'play' || phase !== 'mix') return;
  counts = [0, 0, 0, 0, 0]; cur = null; pct = 0; $('pct').textContent = '0%'; ui.progress(0); $('done').classList.add('hidden');
  sfx.bounce(); stir = 1; burst(scene, bowlRoot.position.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffffff', 12, { speed: 0.08, up: 0.1, shape: 'sphere' });
}
$('rst').addEventListener('pointerdown', e => { e.stopPropagation(); resetPot(); });
$('done').addEventListener('pointerdown', e => { e.stopPropagation(); startPaint(); });

function startPaint() {
  if (state !== 'play' || phase !== 'mix' || !cur || drops.length) return;
  phase = 'paint'; paintT = 0; resultPct = pct;
  $('paints').classList.add('off'); $('done').classList.add('hidden'); $('rst').classList.add('hidden'); $('cmp').style.opacity = 0;
  for (const m of obj.paint) {
    m.material = baseMat;
    const c = m.clone(); c.material = paintMat; c.scale.multiplyScalar(1.006); c.castShadow = false; m.parent.add(c); painted.push(c);
  }
  paintMat.color.copy(toColor(cur));
  obj.g.updateMatrixWorld(true); bounds = new THREE.Box3().setFromObject(obj.g);
  clipPlane.constant = bounds.min.y - 0.05;
  can.visible = true; can.body.material.color.copy(toColor(cur)); sfx.tap();
}

function finish() {
  phase = 'result';
  const ok = resultPct >= 90;
  const b = $('banner'); b.textContent = resultPct + '% ACCURATE'; b.className = 'banner on' + (ok ? '' : ' bad');
  can.visible = false;
  if (ok) {
    state = 'won'; score += resultPct; best = Math.max(best, resultPct); ST.set('score', score); ST.set('best', best);
    sfx.win(); buzz([20, 40, 20]); ui.flash(0.5); ui.progress(1);
    confetti(scene, objRoot.position.clone().add(new THREE.Vector3(0, 1.5, 1)), 90);
    ui.win(level, resultPct >= 97 ? 'Perfect shade!' : 'Nice eye!');
  } else {
    state = 'lost'; sfx.fail(); buzz([40, 30, 60]);
    ui.lose('NOT QUITE', `${resultPct}% — need 90%`);
  }
}

ui.onTap(w => {
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});

// ---------------------------------------------------------------- loop
const sprayCols = [];
loop((dt, t) => {
  // drops: arc from the paint button into the bowl
  for (const d of drops) {
    d.t += 0.045 * dt; const k = Math.min(1, d.t);
    d.m.position.lerpVectors(d.p0, d.end, k); d.m.position.y += Math.sin(k * Math.PI) * 0.9;
    d.m.scale.set(1 - k * 0.2, 1 + k * 0.5, 1 - k * 0.2);
    if (k >= 1) { d.done = true; scene.remove(d.m); landDrop(d); }
  }
  drops = drops.filter(d => !d.done);
  // liquid colour eases to the mix; the new drop spreads out as a blob and dissolves
  const want = cur || [0.93, 0.93, 0.95];
  for (let c = 0; c < 3; c++) shown[c] = lerp(shown[c], want[c], 0.06 * dt);
  liquidMat.color.copy(toColor(shown));
  $('swM').style.background = cur ? '#' + toColor(cur).getHexString(THREE.SRGBColorSpace) : '#f4f4f4';
  if (blob.visible) { blob.t += 0.03 * dt; blob.scale.setScalar(0.1 + Math.min(1, blob.t * 2) * 0.9); blob.material.opacity = Math.max(0, 1 - blob.t); if (blob.t >= 1) blob.visible = false; }
  stir = Math.max(0, stir - 0.012 * dt);
  swirl.material.opacity = stir * 0.7; swirl.rotation.z -= (0.03 + stir * 0.12) * dt;
  brush.position.set(Math.cos(t * 5) * 0.6 * stir + 0.9 * (1 - stir), 0.35, Math.sin(t * 5) * 0.4 * stir);
  brush.rotation.z = -0.5 + stir * 0.2;
  // the target object turns slowly on its pedestal
  if (obj) obj.g.rotation.y += (phase === 'paint' ? 0.045 : 0.008) * dt;
  // camera: zoom in on the object while painting
  if (phase === 'paint' || phase === 'result') camLook.lerp(tmpV.set(0, objY - 0.3, 0), 0.06 * dt); else camLook.lerp(tmpV.set(0, 0, 0), 0.1 * dt);
  const zoom = phase === 'mix' ? 0 : 1;
  camera.position.set(0, camLook.y + zoom * 0.6, lerp(camera.position.z, 15 - zoom * 5, 0.06 * dt)); camera.lookAt(0, camLook.y, 0);
  if (phase === 'paint') {
    paintT += dt / 120;
    const h = lerp(bounds.min.y - 0.05, bounds.max.y + 0.05, Math.min(1, paintT));
    clipPlane.constant = h;
    const a = t * 3; const rr = (bounds.max.x - bounds.min.x) * 0.5 + 1.0;
    can.position.set(bounds.max.x + 0.35 + Math.sin(a) * 0.1, h + 0.2, 1.0); can.rotation.z = 0.65; can.scale.setScalar(objRoot.scale.x * 0.5);
    if (Math.random() < 0.7 * dt) {
      const nozzle = can.localToWorld(new THREE.Vector3(0, 0.95, 0));
      burst(scene, nozzle.lerp(new THREE.Vector3(objRoot.position.x, h, 0.8), 0.45), ['#' + paintMat.color.getHexString(THREE.SRGBColorSpace)], 2, { speed: 0.03, up: 0.01, size: 0.5, shape: 'sphere', gravity: 0, life: 0.6 });
    }
    if (Math.floor(t * 12) !== Math.floor((t - dt / 60) * 12)) tone(2400 + Math.random() * 1200, 0.04, 'sawtooth', 0.015, 0.9);
    if (paintT >= 1) finish();
  }
  sun.position.set(4, 12, 9); sun.target.position.set(0, objY - 2, 0);
});

layout(); buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || phase !== 'mix' || drops.length) return;
    const avail = [...$('paints').children].map(b => +b.dataset.i);
    const need = [0, 1, 2, 3, 4].find(i => counts[i] < recipe[i]);
    if (need !== undefined && pct < 99) addDrop(need, [...$('paints').children].find(b => +b.dataset.i === need));
    else if (pct >= 90) startPaint();
    else resetPot();
  },
};

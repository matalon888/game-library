// Time Knives — original game. Hold to freeze time, trace a line of knives, release to let them all fly.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp } from './kit/hc.js';
import { createBloom, neonMat } from './bloom.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
const B = board({ game: 'time-knives', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const stage = createStage({ fov: 46, shadows: false, clear: '#04040c' });
const { scene, camera, renderer } = stage;
stage.autoRender = false;
scene.background = new THREE.Color('#03030a');
const bloom = createBloom(renderer, scene, camera, { strength: 1.25, threshold: 0.55 });
const ui = createUI({ title: 'TIME<br>KNIVES', hint: 'Hold · draw · release', hand: '☝️' });
document.body.style.setProperty('--bg1', '#04040c'); document.body.style.setProperty('--bg2', '#0b0b26'); document.body.style.setProperty('--ui', '#2f7bff');
const save = store('timeknives');
const F = flow('timeknives'); let fk = 1;
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';

// ------------------------------------------------------------------ DOM extras: slow-mo vignette + time meter
const css = document.createElement('style');
css.textContent = `.tk-vig{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .18s;
  background:radial-gradient(ellipse at 50% 55%,rgba(0,0,0,0) 45%,rgba(30,90,255,.38) 100%)}
.tk-meter{position:fixed;left:50%;bottom:calc(46px + env(safe-area-inset-bottom));width:min(240px,60vw);height:10px;margin-left:calc(min(240px,60vw)/-2);
  border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;z-index:5;opacity:0;transition:opacity .2s;box-shadow:0 0 14px rgba(70,150,255,.5)}
.tk-meter i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#4aa8ff,#bfe3ff);border-radius:6px}
.tk-count{position:fixed;left:0;right:0;bottom:calc(62px + env(safe-area-inset-bottom));text-align:center;font-weight:800;font-size:18px;color:#bfe3ff;z-index:5;opacity:0;transition:opacity .2s;text-shadow:0 0 10px #2f7bff}
.hc-score{color:#fff;text-shadow:0 0 18px rgba(80,160,255,.9),0 3px 0 rgba(0,0,0,.4)}
.hc-card h1{color:#ffd23f;text-shadow:0 0 22px rgba(255,190,40,.85),0 5px 0 rgba(0,0,0,.35);letter-spacing:1px}
.hc-card p,.hc-card .hint{text-shadow:0 0 12px rgba(80,160,255,.9)}
.hc-pop{text-shadow:0 0 16px currentColor,0 3px 0 rgba(0,0,0,.4)!important}`;
document.head.appendChild(css);
const vig = Object.assign(document.createElement('div'), { className: 'tk-vig' });
const meter = Object.assign(document.createElement('div'), { className: 'tk-meter', innerHTML: '<i></i>' });
const countEl = Object.assign(document.createElement('div'), { className: 'tk-count' });
document.body.append(vig, meter, countEl);

// ------------------------------------------------------------------ world: neon grid floor + horizon
const floorMat = new THREE.ShaderMaterial({
  uniforms: { c1: { value: new THREE.Color('#19e0c8') }, c2: { value: new THREE.Color('#8a3dff') }, slow: { value: 0 } },
  vertexShader: `varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 c1, c2; uniform float slow; varying vec3 wp;
    void main(){ vec2 q = wp.xz / 2.5; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
      float line = 1. - min(min(g.x, g.y), 1.);
      float d = length(wp.xz - vec2(0., 6.)); float fade = exp(-d * 0.045);
      vec3 col = mix(c2, c1, smoothstep(-40., 4., wp.z));
      col = mix(col, vec3(0.35, 0.6, 1.4), slow * 0.6);
      vec3 base = vec3(0.004, 0.005, 0.022) * (0.5 + fade);
      gl_FragColor = vec4(base + col * line * (0.25 + fade * 1.5), 1.); }`,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 120), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.z = -40; scene.add(floor);
const horizon = new THREE.Mesh(new THREE.PlaneGeometry(200, 14), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec2 vUv; void main(){ float h = exp(-abs(vUv.y - 0.08) * 9.); gl_FragColor = vec4(vec3(0.18, 0.08, 0.45) * h, 1.); }`,
}));
horizon.position.set(0, 0, -99); horizon.visible = false;
{ // neon gate frames marching into the distance, for depth (like an arena tunnel)
  const fm = neonMat('#3b5bff', { core: 0.02, gain: 2.2 }), post = new THREE.BoxGeometry(0.12, 7, 0.12), beam = new THREE.BoxGeometry(15, 0.12, 0.12);
  for (let i = 0; i < 4; i++) { const z = -26 - i * 14; for (const x of [-7.5, 7.5]) { const m = new THREE.Mesh(post, fm); m.position.set(x, 3.5, z); scene.add(m); } const b = new THREE.Mesh(beam, fm); b.position.set(0, 7, z); scene.add(b); }
  const sg = new THREE.BufferGeometry(), sp = []; const r = rng(5); for (let i = 0; i < 260; i++) sp.push((r() - 0.5) * 220, 6 + r() * 70, -60 - r() * 40);
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#8fa8ff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55 })));
}

// ------------------------------------------------------------------ shared geometry/materials
const M = {
  yellow: neonMat('#ffc928'), white: neonMat('#cfe6ff', { gain: 2.4 }), red: neonMat('#ff3355', { gain: 3 }), pink: neonMat('#ff4fd8', { gain: 3 }),
  gold: neonMat('#ffd84a', { core: 0.25, gain: 2.4 }), rope: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.4) }),
};
const G = {
  torso: new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), head: new THREE.SphereGeometry(0.2, 20, 14),
  arm: new THREE.CapsuleGeometry(0.065, 0.5, 4, 8), leg: new THREE.CapsuleGeometry(0.075, 0.6, 4, 8),
  barrel: new THREE.CylinderGeometry(0.42, 0.42, 1.0, 20, 1), saucer: new THREE.SphereGeometry(0.85, 24, 12), dome: new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  ball: new THREE.IcosahedronGeometry(0.62, 1), rope: new THREE.CylinderGeometry(0.025, 0.025, 1, 6), ring: new THREE.TorusGeometry(1.15, 0.07, 10, 40),
};

// knife: flat blade + handle, pointing +Z. Instanced.
function knifeGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.05, 0.03); s.lineTo(0.05, 0.2); s.lineTo(0, 0.3); s.lineTo(-0.02, 0.2); s.lineTo(-0.02, 0.03); s.lineTo(0, 0);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }); blade.translate(-0.015, 0, -0.006);
  const handle = new THREE.BoxGeometry(0.045, 0.11, 0.03); handle.translate(0, -0.055, 0);
  const guard = new THREE.BoxGeometry(0.11, 0.018, 0.035);
  const merge = (gs) => { const pos = [], idx = []; let off = 0; for (const g of gs) { const ng = g.index ? g : g; const p = ng.attributes.position.array; for (let i = 0; i < p.length; i++) pos.push(p[i]); const ix = ng.index ? ng.index.array : [...Array(p.length / 3).keys()]; for (const i of ix) idx.push(i + off); off += p.length / 3; } const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); out.computeVertexNormals(); return out; };
  const g = merge([blade, handle, guard]); g.rotateX(Math.PI / 2); return g;   // blade now points along +Z
}
const MAXK = 90;
const knifeMesh = new THREE.InstancedMesh(knifeGeo(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.62, 2.0), side: THREE.DoubleSide }), MAXK);
knifeMesh.frustumCulled = false; knifeMesh.count = 0; scene.add(knifeMesh);
const trailGeo = new THREE.BoxGeometry(0.018, 0.018, 1); trailGeo.translate(0, 0, -0.5);
const trailMesh = new THREE.InstancedMesh(trailGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.2, 2.0), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), MAXK);
trailMesh.frustumCulled = false; trailMesh.count = 0; scene.add(trailMesh);

// sparks: one Points draw call
const NP = 900, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pSize = new Float32Array(NP);
const parts = []; for (let i = 0; i < NP; i++) parts.push({ life: 0, v: new THREE.Vector3(), c: new THREE.Color(), s: 1, g: 0 });
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const points = new THREE.Points(pGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  vertexShader: `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * 260. / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC * (1. - d * 2.) * 1.6, 1.); }`,
}));
points.frustumCulled = false; scene.add(points);
let pi = 0;
function sparks(pos, color, n = 30, speed = 6, { up = 2, size = 0.12, g = 9 } = {}) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const idx = pi, p = parts[pi]; pi = (pi + 1) % NP;
    p.life = 0.6 + Math.random() * 0.6; p.c.copy(c); p.s = size * (0.5 + Math.random()); p.g = g;
    p.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7)); p.v.y += up * Math.random();
    pPos[idx * 3] = pos.x; pPos[idx * 3 + 1] = pos.y; pPos[idx * 3 + 2] = pos.z;
  }
}
function updateSparks(dt) {
  for (let i = 0; i < NP; i++) {
    const p = parts[i];
    if (p.life <= 0) { pSize[i] = 0; continue; }
    p.life -= dt; p.v.y -= p.g * dt; p.v.multiplyScalar(1 - 1.5 * dt);
    pPos[i * 3] += p.v.x * dt; pPos[i * 3 + 1] = Math.max(0.02, pPos[i * 3 + 1] + p.v.y * dt); pPos[i * 3 + 2] += p.v.z * dt;
    const k = Math.min(1, p.life * 2); pCol[i * 3] = p.c.r * k; pCol[i * 3 + 1] = p.c.g * k; pCol[i * 3 + 2] = p.c.b * k; pSize[i] = p.s;
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
}
// expanding rings (shockwaves)
const waves = [];
const waveGeo = new THREE.RingGeometry(0.85, 1, 48);
function shock(pos, color, r = 3, vertical = false) {
  const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos); if (!vertical) m.rotation.x = -Math.PI / 2; m.position.y = vertical ? pos.y : 0.05;
  scene.add(m); waves.push({ m, t: 0, r });
}

// ------------------------------------------------------------------ actors
function makeMan(mat, s = 1) {
  const g = new THREE.Group(), meshes = [];
  const add = (geo, parent, x, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); parent.add(m); meshes.push(m); return m; };
  const torso = add(G.torso, g, 0, 1.08), head = add(G.head, g, 0, 1.64);
  const piv = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };
  const aL = piv(-0.29, 1.38), aR = piv(0.29, 1.38), lL = piv(-0.12, 0.78), lR = piv(0.12, 0.78);
  add(G.arm, aL, 0, -0.3); add(G.arm, aR, 0, -0.3); add(G.leg, lL, 0, -0.38); add(G.leg, lR, 0, -0.38);
  g.scale.setScalar(s);
  return { g, meshes, torso, head, aL, aR, lL, lR };
}

let enemies = [], props = [], knives = [], debris = [], plan = null, spawnT = 0, waveIdx = 0, killed = 0, total = 0;
const TYPES = {
  walker: { mat: 'yellow', speed: 1.5, hp: 1, s: 1 },
  runner: { mat: 'yellow', speed: 3.0, hp: 1, s: 0.92 },
  leaper: { mat: 'pink', speed: 1.7, hp: 1, s: 0.95 },
  brute: { mat: 'white', speed: 1.0, hp: 4, s: 1.4 },
  ufo: { mat: 'yellow', speed: 1.2, hp: 1, s: 1 },
};
function spawnEnemy(type, x, z) {
  const T = TYPES[type], e = { type, hp: T.hp, x, z, y: 0, t: Math.random() * 6, speed: T.speed * (1 + Math.min(0.7, (level - 1) * 0.04)) * fk, s: T.s, alive: true, leap: 0, flash: 0, kb: 0 };
  e.mat = T.hp > 1 ? M[T.mat].clone() : M[T.mat];
  if (type === 'ufo') {
    const g = new THREE.Group(); const sauc = new THREE.Mesh(G.saucer, e.mat); sauc.scale.set(1, 0.28, 1); const dome = new THREE.Mesh(G.dome, e.mat); dome.position.y = 0.12;
    g.add(sauc, dome); e.body = { g, meshes: [sauc, dome] }; e.y = 3.2 + Math.random() * 1.2; e.hover = Math.random() * 6;
  } else e.body = makeMan(e.mat, T.s);
  e.body.g.position.set(x, e.y, z); scene.add(e.body.g); enemies.push(e); return e;
}
function addProp(kind, x, z, extra = {}) {
  const p = { kind, x, z, alive: true, ...extra };
  if (kind === 'barrel') { p.m = new THREE.Mesh(G.barrel, M.red); p.m.position.set(x, 0.5, z); scene.add(p.m); }
  if (kind === 'weight') {
    p.y = 4.6; p.vy = 0; p.cut = false;
    p.m = new THREE.Mesh(G.ball, M.gold); p.m.position.set(x, p.y, z);
    p.rope = new THREE.Mesh(G.rope, M.rope); p.rope.scale.y = 9; p.rope.position.set(x, p.y + 0.6 + 4.5, z);
    scene.add(p.m, p.rope);
  }
  if (kind === 'gate') { p.m = new THREE.Mesh(G.ring, M.pink); p.m.position.set(x, 1.6, z); p.y = 1.6; scene.add(p.m); p.t = 0; }
  props.push(p); return p;
}

// ------------------------------------------------------------------ level generation (seeded, endless)
function genLevel(n) {
  const r = rng(n * 7919 + 13), waves = [];
  const nw = Math.min(2 + Math.floor((n - 1) / 2), 6);
  const pool = ['walker']; if (n >= 2) pool.push('runner'); if (n >= 3) pool.push('leaper'); if (n >= 4) pool.push('ufo'); if (n >= 5) pool.push('brute');
  for (let w = 0; w < nw; w++) {
    const cnt = Math.min(2 + Math.floor(n / 3) + Math.floor(r() * 2), 7), cx = (r() - 0.5) * 4, z0 = -11 - r() * 4 - Math.min(7, n * 0.5);
    const list = [];
    for (let i = 0; i < cnt; i++) {
      let t = pool[Math.floor(r() * pool.length)]; if (w === 0 && i < 2) t = 'walker';
      list.push({ t, x: cx + (r() - 0.5) * 3.2, z: z0 - r() * 3 });
    }
    const pr = [];
    if (n >= 2 && r() < 0.65) pr.push({ k: 'barrel', x: cx + (r() - 0.5) * 1.5, z: z0 + 4 + r() * 2 });
    if (n >= 3 && r() < 0.45) pr.push({ k: 'weight', x: cx + (r() - 0.5), z: z0 + 7 + r() * 2 });
    if (n >= 4 && w === 0 && r() < 0.6) pr.push({ k: 'gate', x: (r() - 0.5) * 1.5, z: -6.5 });
    waves.push({ list, pr });
  }
  return waves;
}
function clearWorld() {
  for (const e of enemies) scene.remove(e.body.g);
  for (const p of props) { scene.remove(p.m); p.rope && scene.remove(p.rope); }
  for (const d of debris) scene.remove(d.m);
  for (const w of waves) scene.remove(w.m);
  enemies = []; props = []; knives = []; debris = []; waves.length = 0; stroke = null;
}
function buildLevel() {
  clearWorld();
  fk = F.k(); plan = genLevel(level); waveIdx = 0; spawnT = 0; killed = 0; cine = 0;
  total = plan.reduce((a, w) => a + w.list.length, 0);
  ui.levels(level); ui.progress(0); ui.score(score); ui.sub(best ? 'BEST ' + best : '');
  spawnWave();
}
function spawnWave() {
  const w = plan[waveIdx++]; if (!w) return;
  for (const e of w.list) spawnEnemy(e.t, e.x, e.z);
  for (const p of w.pr) addProp(p.k, p.x, p.z);
  spawnT = 0;
}

// ------------------------------------------------------------------ input: hold = slow time, drag = lay knives, release = throw
let stroke = null, timeScale = 1, hitStop = 0, slowAmt = 0, shake = 0, cine = 0, cineTarget = new THREE.Vector3(), comboKills = 0, comboTimer = 0;
const MAX_STROKE_KNIVES = 18, STROKE_TIME = 2.6, SPACING = 26;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function screenToWorld(x, y, dist = 2.6) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  return { p: ray.ray.origin.clone().addScaledVector(ray.ray.direction, dist), d: ray.ray.direction.clone() };
}
function addKnife(x, y, tx, ty) {
  if (!stroke || stroke.count >= MAX_STROKE_KNIVES || knives.length >= MAXK - 4) return;
  const { p, d } = screenToWorld(x, y);
  const tan = new THREE.Vector3(tx, -ty, 0).normalize();
  const hover = d.clone().multiplyScalar(0.25).add(tan.applyQuaternion(camera.quaternion)).normalize();
  knives.push({ p, d, hover, dir: hover.clone(), v: 0, flying: false, age: 0, pop: 0, hits: new Set(), tripled: false, dead: false, born: performance.now() });
  stroke.count++;
  tone(780 + stroke.count * 38, 0.035, 'triangle', 0.06, 1.15);
  countEl.textContent = '🗡 ' + (MAX_STROKE_KNIVES - stroke.count);
}
function release() {
  if (!stroke) return;
  const any = knives.some(k => !k.flying);
  for (const k of knives) if (!k.flying) { k.flying = true; k.age = 0; }
  stroke = null; meter.style.opacity = countEl.style.opacity = 0;
  if (any) { tone(260, 0.28, 'sawtooth', 0.06, 3.2); tone(520, 0.2, 'sine', 0.05, 2.4); buzz(12); }
}
input({
  onDown(e) {
    if (state !== 'play' || cine) return;
    stroke = { count: 0, t0: performance.now(), lx: e.clientX, ly: e.clientY, acc: SPACING };
    tone(320, 0.35, 'sine', 0.08, 0.45); meter.style.opacity = countEl.style.opacity = 1; countEl.textContent = '🗡 ' + MAX_STROKE_KNIVES;
    addKnife(e.clientX, e.clientY, 0, -1);
  },
  onMove(dx, dy, e) {
    if (!stroke) return;
    const len = Math.hypot(e.clientX - stroke.lx, e.clientY - stroke.ly);
    if (len >= SPACING) {
      const n = Math.floor(len / SPACING), ux = (e.clientX - stroke.lx) / len, uy = (e.clientY - stroke.ly) / len;
      for (let i = 1; i <= n; i++) addKnife(stroke.lx + ux * SPACING * i, stroke.ly + uy * SPACING * i, ux, uy);
      stroke.lx += ux * SPACING * n; stroke.ly += uy * SPACING * n;
    }
  },
  onUp() { release(); },
});
ui.onTap(w => { B.start();
  if (w === 'start') { state = 'play'; buildLevel(); }
  else if (w === 'win') { level++; save.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { score = 0; state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ hits
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function segSegDist(p1, q1, p2, q2) {   // distance between segments (Ericson)
  const d1 = _a.subVectors(q1, p1), d2 = _b.subVectors(q2, p2), r = _c.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r); let s, t;
  if (a <= 1e-8 && e <= 1e-8) return p1.distanceTo(p2);
  if (a <= 1e-8) { s = 0; t = clamp(f / e, 0, 1); } else {
    const c = d1.dot(r); if (e <= 1e-8) { t = 0; s = clamp(-c / a, 0, 1); } else {
      const b = d1.dot(d2), den = a * e - b * b; s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = p1.clone().addScaledVector(_a, s), c2 = p2.clone().addScaledVector(_b, t); return c1.distanceTo(c2);
}
function enemyAxis(e) {
  if (e.type === 'ufo') { const c = new THREE.Vector3(e.x, e.y, e.z); return [c.clone().add(new THREE.Vector3(-0.7, 0, 0)), c.clone().add(new THREE.Vector3(0.7, 0, 0)), 0.42]; }
  const s = e.s; return [new THREE.Vector3(e.x, e.y + 0.25 * s, e.z), new THREE.Vector3(e.x, e.y + 1.7 * s, e.z), 0.34 * s];
}
function addScore(n, at) { score += n; ui.score(score); if (score > best) { best = score; save.set('best', best); } }
function killEnemy(e, dir, how = 'knife') {
  if (!e.alive) return; e.alive = false; killed++; comboKills++; comboTimer = 0.6;
  const col = e.type === 'brute' ? '#cfe6ff' : e.type === 'leaper' ? '#ff4fd8' : '#ffc928';
  const c = new THREE.Vector3(e.x, e.y + (e.type === 'ufo' ? 0 : 1.1 * e.s), e.z);
  // break the figure into its neon parts and fling them along the knife's direction
  for (const m of e.body.meshes) {
    scene.attach(m);
    const v = dir.clone().multiplyScalar(5 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 5, (Math.random() - 0.5) * 3));
    debris.push({ m, v, w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14), life: 1.6 });
  }
  scene.remove(e.body.g);
  sparks(c, col, 36, 7); sparks(c, '#ffffff', 14, 9, { size: 0.08 });
  shock(c, col, 1.8, true);
  const pts = 10 * Math.min(5, comboKills); addScore(pts);
  sfx.pick(comboKills); tone(140, 0.14, 'square', 0.08, 0.5); buzz(18);
  hitStop = Math.max(hitStop, 0.07); shake = Math.max(shake, 0.18);
  if (comboKills >= 2) ui.pop(['', '', 'DOUBLE!', 'TRIPLE!', 'QUAD!', 'MEGA!'][Math.min(5, comboKills)] || 'x' + comboKills, comboKills >= 4 ? '#ff4fd8' : '#ffd23f', 34 + comboKills * 4, 24);
  else if (how === 'boom') ui.pop('BOOM!', '#ff3355', 40, 24);
  else if (how === 'crush') ui.pop('CRUSH!', '#ffd84a', 40, 24);
  ui.progress(killed / total);
  const remaining = enemies.filter(x => x.alive).length + plan.slice(waveIdx).reduce((a, w) => a + w.list.length, 0);
  if (remaining === 0) { cine = 1.6; cineTarget.copy(c); ui.flash(0.35); tone(110, 0.6, 'sine', 0.12, 0.5); }
}
function hurtEnemy(e, dir) {
  e.hp--; e.flash = 1; e.kb = 0.7;
  sparks(new THREE.Vector3(e.x, e.y + 1.2 * e.s, e.z), '#bfe3ff', 16, 6, { size: 0.08 }); tone(1200, 0.05, 'square', 0.05, 0.6); tone(900, 0.08, 'triangle', 0.06, 0.8);
  if (e.hp <= 0) killEnemy(e, dir);
}
function explode(p) {
  if (!p.alive) return; p.alive = false; scene.remove(p.m);
  const c = new THREE.Vector3(p.x, 0.6, p.z);
  sparks(c, '#ff3355', 70, 11, { up: 5 }); sparks(c, '#ffd23f', 40, 8, { up: 4 }); shock(c, '#ff3355', 5); shock(c.clone().setY(1), '#ff9a3c', 3.6, true);
  sfx.smash(); buzz([30, 20, 40]); ui.flash(0.4); shake = 0.45; hitStop = 0.12;
  for (const e of enemies) if (e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 3.4) killEnemy(e, new THREE.Vector3(e.x - p.x, 0.6, e.z - p.z).normalize(), 'boom');
  for (const q of props) if (q.kind === 'barrel' && q.alive && Math.hypot(q.x - p.x, q.z - p.z) < 3.4) setTimeout(() => explode(q), 90);
  addScore(5);
}

// ------------------------------------------------------------------ main loop
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1);
const camBase = new THREE.Vector3(0, 2.0, 6.5), camLook = new THREE.Vector3(0, 1.25, -6);
let camPos = camBase.clone(), camAt = camLook.clone();
function lose() {
  if (state !== 'play') return;
  state = 'lost'; F.level(false, killed / total); release(); sfx.fail(); buzz([60, 40, 80]); shake = 0.8;
  ui.flash(0.5); document.querySelector('.hc-flash').style.background = '#ff3355'; setTimeout(() => document.querySelector('.hc-flash').style.background = '#fff', 400);
  ui.lose('TOO CLOSE!', `${Math.round(killed / total * 100)}% cleared`);
}
function win() {
  if (state === 'play') B.submit(1); state = 'won'; F.level(true); sfx.win(); buzz([20, 40, 20]);
  for (let i = 0; i < 4; i++) setTimeout(() => sparks(cineTarget.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, 0)), ['#ffd23f', '#4aa8ff', '#ff4fd8', '#19e0c8'][i], 60, 9, { up: 6 }), i * 120);
  addScore(50 * level);
  ui.win(level, `${score} pts`);
}

loop((dt60) => {
  const rdt = dt60 / 60;                                                         // real seconds
  // ---- time scale: frozen while drawing, hit-stop on kills, cinematic on the final blow
  let target = 1;
  if (stroke) target = 0.045;
  if (cine > 0) target = 0.12;
  if (hitStop > 0) { hitStop -= rdt; target = Math.min(target, 0.08); }
  timeScale = lerp(timeScale, target, 1 - Math.pow(0.0005, rdt));
  slowAmt = lerp(slowAmt, stroke ? 1 : 0, 1 - Math.pow(0.001, rdt));
  vig.style.opacity = slowAmt.toFixed(3); floorMat.uniforms.slow.value = slowAmt; bloom.uniforms.sat.value = 1 - slowAmt * 0.35;
  const dt = state === 'ready' ? rdt * 0.4 : rdt * timeScale;

  if (stroke && state === 'play') {
    const el = (performance.now() - stroke.t0) / 1000; meter.firstChild.style.width = Math.max(0, 1 - el / (STROKE_TIME / fk)) * 100 + '%';
    if (el > STROKE_TIME / fk || stroke.count >= MAX_STROKE_KNIVES && el > 0.25) release();
  }

  // ---- waves
  if (state === 'play' && !cine) {
    spawnT += dt;
    const aliveN = enemies.filter(e => e.alive).length;
    if (waveIdx < plan.length && (aliveN <= 1 || spawnT > 9)) spawnWave();
  }

  // ---- enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += dt;
    const b = e.body;
    if (e.kb > 0) { e.z -= e.kb * dt * 4; e.kb = Math.max(0, e.kb - dt * 3); }
    if (e.flash > 0) { e.flash = Math.max(0, e.flash - dt * 4); e.mat.uniforms.flash.value = e.flash * 1.5; }
    if (state === 'ready') { b.aL.rotation.z = Math.sin(e.t * 2) * 0.2; continue; }
    if (e.type === 'ufo') {
      e.z += e.speed * 0.8 * dt; e.x += Math.sin(e.t * 1.3) * dt * 1.4; b.g.rotation.y += dt * 2; b.g.position.set(e.x, e.y + Math.sin(e.t * 3) * 0.2, e.z); b.g.rotation.z = Math.sin(e.t * 1.3) * 0.2;
      if (e.z > 0.5 && state === 'play') lose();
      continue;
    }
    if (e.type === 'leaper' && e.z > -8.5 && !e.leap) { e.leap = 0.001; e.lz = e.z; e.lx = e.x; tone(600, 0.2, 'sine', 0.06, 1.8); }
    if (e.leap) {
      e.leap += dt / 1.5; const k = Math.min(1, e.leap);
      e.z = lerp(e.lz, 3.5, k); e.x = lerp(e.lx, 0, k); e.y = Math.sin(k * Math.PI) * 3.4;
      b.aL.rotation.x = b.aR.rotation.x = -2.6; b.lL.rotation.x = 1.1; b.lR.rotation.x = 0.4; b.g.rotation.x = -0.5 + k * 0.3;
      if (k >= 1 && state === 'play') lose();
    } else {
      const sp = e.speed; e.z += sp * dt; e.x += (0 - e.x) * dt * 0.06;
      const runK = e.type === 'runner' ? 1.25 : e.type === 'brute' ? 0.6 : 1; const ph = e.t * (5 + sp * 2.2);
      b.aL.rotation.x = Math.sin(ph) * 0.9 * runK; b.aR.rotation.x = -Math.sin(ph) * 0.9 * runK; b.lL.rotation.x = -Math.sin(ph) * 0.8 * runK; b.lR.rotation.x = Math.sin(ph) * 0.8 * runK;
      b.aL.rotation.z = -0.15; b.aR.rotation.z = 0.15; b.g.rotation.x = e.type === 'runner' ? -0.25 : -0.05;
      e.y = Math.abs(Math.sin(ph)) * 0.06;
      if (e.z > 2.3 && state === 'play') lose();
    }
    b.g.position.set(e.x, e.y, e.z); b.g.rotation.y = Math.atan2(-e.x, 6 - e.z) * 0.5;
  }

  // ---- props
  for (const p of props) {
    if (!p.alive) continue;
    if (p.kind === 'barrel') p.m.rotation.y += dt * 0.6;
    if (p.kind === 'gate') { p.t += dt; p.m.position.x = p.x + Math.sin(p.t * 0.9) * 1.2; p.m.rotation.z += dt; }
    if (p.kind === 'weight') {
      p.m.rotation.y += dt;
      if (p.cut) {
        p.vy -= 22 * dt; p.y += p.vy * dt; p.m.position.y = p.y; p.rope.position.y += 2 * dt;
        if (p.y < 0.62) {
          p.alive = false; scene.remove(p.m); scene.remove(p.rope);
          const c = new THREE.Vector3(p.x, 0.3, p.z);
          shock(c, '#ffd84a', 5.5); sparks(c, '#ffd84a', 80, 10, { up: 6 }); sfx.smash(); shake = 0.55; buzz([40, 30, 40]); ui.flash(0.3);
          for (const e of enemies) if (e.alive && e.type !== 'ufo' && Math.hypot(e.x - p.x, e.z - p.z) < 2.6) killEnemy(e, new THREE.Vector3(e.x - p.x, 0.8, e.z - p.z).normalize(), 'crush');
        }
      }
    }
  }

  // ---- knives
  const newK = [];
  for (const k of knives) {
    if (k.dead) continue;
    k.pop = Math.min(1, k.pop + rdt * 7);
    if (!k.flying) { k.age += rdt; continue; }
    k.age += dt; k.v = Math.min(55, k.v + dt * 260);
    k.dir.lerp(k.d, 1 - Math.pow(0.0001, dt * 4)).normalize();
    const p0 = k.p.clone(); k.p.addScaledVector(k.d, k.v * dt);
    // hits
    for (const e of enemies) {
      if (!e.alive || k.hits.has(e)) continue;
      const [a, b, r] = enemyAxis(e);
      if (segSegDist(p0, k.p, a, b) < r) { k.hits.add(e); if (e.type === 'brute' && e.hp > 1) { hurtEnemy(e, k.d); k.dead = true; break; } else killEnemy(e, k.d); }
    }
    for (const p of props) {
      if (!p.alive) continue;
      if (p.kind === 'barrel' && segSegDist(p0, k.p, new THREE.Vector3(p.x, 0, p.z), new THREE.Vector3(p.x, 1, p.z)) < 0.5) { explode(p); k.dead = true; }
      if (p.kind === 'weight' && !p.cut && segSegDist(p0, k.p, new THREE.Vector3(p.x, p.y + 0.5, p.z), new THREE.Vector3(p.x, 12, p.z)) < 0.32) {
        p.cut = true; sparks(new THREE.Vector3(p.x, p.y + 1.3, p.z), '#ffd84a', 20, 4); tone(1500, 0.08, 'triangle', 0.08, 0.5); ui.pop('CUT!', '#ffd84a', 34, 24);
      }
      if (p.kind === 'weight' && segSegDist(p0, k.p, p.m.position, p.m.position) < 0.7 && !p.cut) { p.cut = true; tone(1500, 0.08, 'triangle', 0.08, 0.5); }
      if (p.kind === 'gate' && !k.tripled && p0.z > p.m.position.z && k.p.z <= p.m.position.z) {
        const t = (p0.z - p.m.position.z) / (p0.z - k.p.z), hit = p0.clone().lerp(k.p, t);
        if (Math.hypot(hit.x - p.m.position.x, hit.y - p.m.position.y) < 1.15) {
          k.tripled = true;
          for (const s of [-1, 1]) {
            const d = k.d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s * 0.09);
            newK.push({ p: hit.clone(), d, dir: d.clone(), hover: d.clone(), v: k.v, flying: true, age: 1, pop: 1, hits: new Set(k.hits), tripled: true, dead: false });
          }
          sparks(hit, '#ff4fd8', 8, 3, { size: 0.08 }); tone(1100, 0.06, 'sine', 0.05, 1.3);
          if (!p.popT || performance.now() - p.popT > 600) { ui.pop('x3', '#ff4fd8', 40, 24); p.popT = performance.now(); }
        }
      }
    }
    if (k.p.z < -70 || k.p.y < -0.5) k.dead = true;
    if (k.p.y < 0.05 && !k.dead) { k.dead = true; sparks(k.p, '#4aa8ff', 4, 2, { size: 0.06 }); }
  }
  knives = knives.filter(k => !k.dead).concat(newK).slice(-MAXK);
  let ki = 0;
  for (const k of knives) {
    const dir = k.flying ? k.dir : k.hover;
    const wob = k.flying ? 0 : Math.sin(performance.now() / 160 + k.p.x * 20) * 0.08;
    _q.setFromUnitVectors(_up, dir); _s.setScalar((0.25 + k.pop * 0.37) * (k.flying ? 1 : 1 + (1 - k.pop) * 0.6));
    _m.compose(k.p, _q.multiply(new THREE.Quaternion().setFromAxisAngle(_up, wob)), _s); knifeMesh.setMatrixAt(ki, _m);
    _s.set(1, 1, k.flying ? Math.min(3.5, k.v * 0.07) : 0.001); _q.setFromUnitVectors(_up, k.d); _m.compose(k.p, _q, _s); trailMesh.setMatrixAt(ki, _m);
    ki++;
  }
  knifeMesh.count = trailMesh.count = ki; knifeMesh.instanceMatrix.needsUpdate = trailMesh.instanceMatrix.needsUpdate = true;

  // ---- debris + waves + sparks (game time, so they hang in slow-mo too)
  for (const d of debris) {
    d.v.y -= 14 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
    if (d.m.position.y < 0.08) { d.m.position.y = 0.08; d.v.y *= -0.35; d.v.x *= 0.7; d.v.z *= 0.7; d.w.multiplyScalar(0.7); }
    d.life -= dt; if (d.life < 0.5) d.m.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
  }
  debris = debris.filter(d => d.life > 0 || (scene.remove(d.m), false));
  for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.t += dt * 2.2; w.m.scale.setScalar(0.2 + w.t * w.r); w.m.material.opacity = Math.max(0, 1 - w.t); if (w.t >= 1) { scene.remove(w.m); w.m.material.dispose(); waves.splice(i, 1); } }
  updateSparks(dt);
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) comboKills = 0; }

  // ---- cinematic last kill
  if (cine > 0 && state === 'play') { cine -= rdt; if (cine <= 0) { cine = 0; win(); } }

  // ---- camera: gentle sway, dolly toward the final kill, shake on impacts
  const tPos = camBase.clone(), tAt = camLook.clone();
  if (cine > 0 || state === 'won') { const k = state === 'won' ? 1 : 1 - cine / 1.6; tPos.lerp(cineTarget.clone().add(new THREE.Vector3(2.2, 0.8, 4.5)), 0.65 * Math.min(1, k * 2)); tAt.lerp(cineTarget, 0.8); }
  if (state === 'ready') { const t = performance.now() / 1000; tPos.x += Math.sin(t * 0.4) * 0.6; }
  camPos.lerp(tPos, 1 - Math.pow(0.02, rdt)); camAt.lerp(tAt, 1 - Math.pow(0.02, rdt));
  shake = Math.max(0, shake - rdt * 1.8);
  camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.35, (Math.random() - 0.5) * shake * 0.35, 0));
  camera.lookAt(camAt);
  bloom.render();
});

// ------------------------------------------------------------------ attract mode: a few idle figures behind the title
function attract() { plan = genLevel(level); for (const e of plan[0].list) spawnEnemy('walker', e.x, e.z + 6); }
attract(); ui.levels(level);

// ------------------------------------------------------------------ test hooks
let botPlan = null;
const _v = new THREE.Vector3();
function toScreen(v) { _v.copy(v).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight, _v.z]; }
window.__dbg = () => enemies.filter(e => e.alive).map(e => e.type[0] + e.z.toFixed(1)).join(" ") + " k" + knives.length;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || cine) return;
    const fire = (type, x, y) => dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
    if (botPlan && botPlan.length) { const n = botPlan.splice(0, 4); for (const [x, y] of n) fire('pointermove', x, y); if (!botPlan.length) { fire('pointerup', n[n.length - 1][0], n[n.length - 1][1]); botPlan = null; } return; }
    const live = enemies.filter(e => e.alive).sort((a, b) => b.z - a.z);
    if (!live.length || knives.some(k => k.flying)) return;
    if (live[0].z < -13 && !live[0].leap && live.length < 3 && Math.random() < 0.5) return;   // wait for them to come closer sometimes
    // aim at a barrel if enemies stand near it, else trace through the nearest figures
    const pts = [];
    const bar = props.find(p => p.kind === 'barrel' && p.alive && live.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 3));
    if (bar) pts.push(toScreen(new THREE.Vector3(bar.x, 0.5, bar.z)));
    for (const e of live.slice(0, 3)) { const [a, b] = enemyAxis(e); const mid = a.clone().lerp(b, 0.55); pts.push(toScreen(mid)); }
    const path = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]; if (i === 0) { path.push([x, y - 30]); path.push([x, y + 30]); continue; }
      const [px, py] = path[path.length - 1]; const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 28));
      for (let s = 1; s <= steps; s++) path.push([lerp(px, x, s / steps), lerp(py, y, s / steps)]);
      path.push([x, y + 28]);
    }
    fire('pointerdown', path[0][0], path[0][1]); botPlan = path.slice(1);
  },
};

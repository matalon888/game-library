// Ring Peel — original game. Hold to pour balls down the pier into a striped tower; every hit peels off a ring.
// Orbiting guard walls circle the tower: a ball that hits one ends the run.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';

const stage = createStage({ fov: 34, shadows: true, shadowSize: 9 });
const { scene, camera, sun, hemi } = stage;
const ui = createUI({ title: 'RING<br>PEEL', hint: 'Hold to fire', hand: '👆' });
const css = document.createElement('style');
css.textContent = `.hc-card h1{letter-spacing:1px;color:#fff}.hc-score{font-size:46px;text-shadow:0 3px 0 rgba(0,0,0,.25),0 0 10px rgba(0,0,0,.25);top:calc(60px + env(safe-area-inset-top))}
.hc-sub{top:calc(110px + env(safe-area-inset-top));font-size:20px;letter-spacing:6px;text-shadow:0 0 8px rgba(0,0,0,.3)}
.hc-pop{text-shadow:0 3px 0 rgba(0,0,0,.25),0 0 14px rgba(0,0,0,.18)!important}`;
document.head.appendChild(css);
const save = store('ringpeel');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';
const F = flow('ringpeel');

// ------------------------------------------------------------------ themes (sea, sky, tower stripes, guard walls)
const THEMES = [
  { sea: '#53bfd0', sky: ['#9fdcf0', '#ffd7a0'], a: '#ff5d73', b: '#ffe26a', ob: '#474a5c', rock: '#f0dcc0', ui: '#ff5d73' },
  { sea: '#8d6b8e', sky: ['#c8a6c7', '#ffc98f'], a: '#ffd23f', b: '#4b4f5e', ob: '#3a86ff', rock: '#e8cfc4', ui: '#ffb300' },
  { sea: '#5c7fa8', sky: ['#a9c3e6', '#e9f0ff'], a: '#9a5cff', b: '#ffffff', ob: '#7b3fe4', rock: '#e6eef8', ui: '#8a4dff' },
  { sea: '#56c7c0', sky: ['#9ff0e6', '#e6fff8'], a: '#7f5cff', b: '#6fe3c4', ob: '#5a35c8', rock: '#c9e3f5', ui: '#6b4dff' },
  { sea: '#e39a7c', sky: ['#ffc4a8', '#ffe9c2'], a: '#2ec4b6', b: '#ffffff', ob: '#ff5964', rock: '#fff0dc', ui: '#22b3a6' },
  { sea: '#6fb07f', sky: ['#bfe8c0', '#fff3c4'], a: '#ff8c42', b: '#ffffff', ob: '#2d3142', rock: '#f6ead2', ui: '#ff7a2f' },
];
let T = THEMES[0];

// ------------------------------------------------------------------ world: faceted sea + rocks
const seaGeo = (() => {
  const g = new THREE.PlaneGeometry(220, 220, 70, 70); const r = rng(3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (r() - 0.5) * 0.55);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
})();
const seaMat = new THREE.MeshStandardMaterial({ color: T.sea, roughness: 0.85, metalness: 0, flatShading: true });
const sea = new THREE.Mesh(seaGeo, seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.6, -40); sea.receiveShadow = true; scene.add(sea);
scene.fog = new THREE.Fog('#ffd7a0', 30, 95);

const rockMat = new THREE.MeshStandardMaterial({ color: T.rock, roughness: 0.75, flatShading: true });
const iceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, flatShading: true, transparent: true, opacity: 0.85 });
const pillarGeo = new THREE.CylinderGeometry(0.7, 1.1, 1, 6, 1); pillarGeo.translate(0, 0.5, 0);
const chunkGeo = new THREE.DodecahedronGeometry(0.6, 0);
const pillars = new THREE.InstancedMesh(pillarGeo, rockMat, 60), chunks = new THREE.InstancedMesh(chunkGeo, iceMat, 60);
pillars.castShadow = true; scene.add(pillars, chunks);
{
  const r = rng(11), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  let ip = 0, ic = 0;
  for (let i = 0; i < 120; i++) {
    const side = r() < 0.5 ? -1 : 1, x = side * (4.5 + r() * 26), z = 14 - r() * 90;
    if (i % 2 === 0 && ip < 60) {
      const h = 1.5 + r() * (Math.abs(x) > 9 ? 9 : 3); e.set((r() - 0.5) * 0.15, r() * 6, (r() - 0.5) * 0.15); q.setFromEuler(e);
      s.set(0.6 + r() * 1.4, h, 0.6 + r() * 1.4); p.set(x, -1.8, z); m.compose(p, q, s); pillars.setMatrixAt(ip++, m);
    } else if (ic < 60) {
      e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e); const k = 0.5 + r() * 1.2; s.set(k * 1.4, k * 0.8, k);
      p.set(x * 0.8, -1.55, z); m.compose(p, q, s); chunks.setMatrixAt(ic++, m);
    }
  }
  pillars.count = ip; chunks.count = ic;
}

// ------------------------------------------------------------------ pier + platforms
const white = mat('#f7f9fc', { roughness: 0.55 }), legMat = mat('#c7ccd6'), groove = mat('#e3e7ef');
const SPACING = 17, PR = 3.5, OR = 2.55, TR = 1.3, RH = 0.36;   // platform radius, guard-wall radius, tower radius, ring height
const pierGroup = new THREE.Group(); scene.add(pierGroup);
function buildPier(n) {
  pierGroup.clear();
  const len = (n - 1) * SPACING + 12, w = new THREE.Mesh(rounded(1.9, 0.5, len, 0.06), white);
  w.position.set(0, -0.3, -(n - 1) * SPACING / 2 + 6); w.receiveShadow = true; pierGroup.add(w);
  for (let s = 0; s < n; s++) {
    const z = -s * SPACING;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 0.5, 64), white); plat.position.set(0, -0.24, z); plat.receiveShadow = true; plat.castShadow = true; pierGroup.add(plat);
    for (const rr of [OR - 0.42, OR + 0.42, PR - 0.25]) {
      const g = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.035, 6, 72), groove); g.rotation.x = Math.PI / 2; g.position.set(0, 0.01, z); pierGroup.add(g);
    }
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, l = new THREE.Mesh(rounded(0.9, 1.6, 0.9, 0.08), legMat);
      l.position.set(Math.sin(a) * (PR - 0.8), -1.2, z + Math.cos(a) * (PR - 0.8)); l.rotation.y = a; pierGroup.add(l);
    }
  }
  for (let z = 8; z > -(n - 1) * SPACING; z -= 5) for (const x of [-0.7, 0.7]) {
    if (((-z) % SPACING + SPACING) % SPACING < PR + 0.5 || ((-z) % SPACING + SPACING) % SPACING > SPACING - PR - 0.5) continue;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.35), legMat); l.position.set(x, -1.1, z); pierGroup.add(l);
  }
}

// counter painted on the pier (rings left)
const cnv = document.createElement('canvas'); cnv.width = 256; cnv.height = 128;
const ctx = cnv.getContext('2d'), cTex = new THREE.CanvasTexture(cnv); cTex.colorSpace = THREE.SRGBColorSpace;
const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: cTex, transparent: true, depthWrite: false }));
counter.rotation.x = -Math.PI / 2; scene.add(counter);
function drawCounter(n) {
  ctx.clearRect(0, 0, 256, 128); ctx.fillStyle = 'rgba(120,128,145,0.55)'; ctx.font = '800 96px "Baloo 2", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 128, 70); cTex.needsUpdate = true;
}

// ------------------------------------------------------------------ cannon (stepped block, like a little bunker)
const cannon = new THREE.Group(); scene.add(cannon);
const cMat = mat('#5d6373', { roughness: 0.6 }), cDark = mat('#41465a');
{
  const base = new THREE.Mesh(rounded(1.5, 0.75, 1.25, 0.1), cMat); base.position.y = 0.38; base.castShadow = true;
  const top = new THREE.Mesh(rounded(0.85, 0.55, 0.85, 0.1), cMat); top.position.y = 0.95; top.castShadow = true;
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 20), cDark); mouth.rotation.x = Math.PI / 2; mouth.position.set(0, 0.42, -0.63);
  cannon.add(base, top, mouth); cannon.body = base; cannon.top = top;
}
let cannonZ = 8, cannonKick = 0;

// ------------------------------------------------------------------ tower (instanced rounded rings)
function ringGeo(seg) {
  const pts = [], r = TR, h = RH, b = 0.05;
  pts.push(new THREE.Vector2(0, 0.0)); pts.push(new THREE.Vector2(r - b, 0.0));
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, b + Math.sin(a) * b)); }
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, h - b + Math.sin(a) * b)); }
  pts.push(new THREE.Vector2(0, h));
  const g = new THREE.LatheGeometry(pts, seg); if (seg === 4) g.rotateY(Math.PI / 4); g.computeVertexNormals(); return g;
}
const RING_GEOS = { 48: ringGeo(48), 6: ringGeo(6), 4: ringGeo(4) };
const MAXR = 70;
let towerMesh = null;
const lidMat = mat('#000000', { transparent: true, opacity: 0.22 });
const lid = new THREE.Mesh(new THREE.CircleGeometry(TR * 0.72, 40), lidMat); lid.rotation.x = -Math.PI / 2; scene.add(lid);
const glow = new THREE.Mesh(new THREE.RingGeometry(TR + 0.05, TR + 0.75, 64), new THREE.MeshBasicMaterial({ color: '#ff5d8f', transparent: true, opacity: 0, depthWrite: false }));
glow.rotation.x = -Math.PI / 2; scene.add(glow);
let rings = [], removed = 0, towerZ = 0, towerSquash = 0, towerShape = 48, twist = 0;

// shards
const SHN = 360;
const shardMesh = new THREE.InstancedMesh(rounded(0.62, 0.34, 0.28, 0.06), mat('#ffffff'), SHN);
shardMesh.castShadow = true; shardMesh.frustumCulled = false; scene.add(shardMesh);
const shards = []; for (let i = 0; i < SHN; i++) shards.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 });
let shi = 0;
const _c = new THREE.Color();
function shatter(y, color) {
  _c.set(color);
  for (let k = 0; k < 9; k++) {
    const sh = shards[shi], idx = shi; shi = (shi + 1) % SHN;
    const a = (k / 9) * Math.PI * 2 + Math.random() * 0.3, sp = 5 + Math.random() * 5;
    sh.life = 1.4; sh.p.set(Math.sin(a) * TR, y + RH / 2, towerZ + Math.cos(a) * TR);
    sh.v.set(Math.sin(a) * sp, 2.5 + Math.random() * 4, Math.cos(a) * sp * 0.8 - 1.5);
    sh.r.set(0, a, 0); sh.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14); sh.s = 0.8 + Math.random() * 0.5;
    shardMesh.setColorAt(idx, _c);
  }
  shardMesh.instanceColor.needsUpdate = true;
}

// balls
const MAXB = 48;
const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 22, 16), glossy("#363a47", { roughness: 0.22, metalness: 0.35 }), MAXB);
ballMesh.castShadow = true; ballMesh.frustumCulled = false; scene.add(ballMesh);
let balls = [];
const BALL_SPEED = 24, FIRE_DT = 0.1;

// guard walls
let guards = [];
function arcGeo(w) {
  const s = new THREE.Shape(), r0 = OR - 0.17, r1 = OR + 0.17, a0 = -Math.PI / 2 - w / 2, a1 = -Math.PI / 2 + w / 2;
  s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.07, 0); g.computeVertexNormals(); return g;
}
const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
function guardAngle(g, t) {
  if (g.mode === 'spin') return g.a0 + g.sp * t;
  if (g.mode === 'swing') return g.a0 + g.amp * Math.sin(g.sp * t + g.ph);
  // 'surge': spin with speed pulses (fast/slow)
  return g.a0 + g.sp * t + 0.9 * Math.sin(g.sp2 * t + g.ph);
}
function blocked(t, margin = 0) {   // is the path (angle 0) covered at guard-time t?
  for (const g of guards) if (Math.abs(wrap(guardAngle(g, t))) < g.w / 2 + 0.085 + margin) return g;
  return null;
}

// ------------------------------------------------------------------ level gen (seeded)
function genLevel(n, fk = 1) {
  const r = rng(n * 104729 + 7), stages = n === 1 ? 2 : n < 5 ? 3 : 3 + (r() < 0.4 ? 1 : 0), out = [];
  for (let s = 0; s < stages; s++) {
    const d = (n - 1) + s * 0.6, rings = Math.min(MAXR, Math.round(15 + d * 2.4 + r() * 4));
    const shape = n < 3 ? 48 : [48, 48, 6, 4][Math.floor(r() * 4)];
    const tw = shape !== 48 && r() < 0.6 ? 0.12 + r() * 0.12 : 0;
    const ng = d < 1.5 ? 1 : d < 5 ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2), gs = [];
    const dir = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < ng; k++) {
      const modes = d < 2 ? ['spin'] : d < 4 ? ['spin', 'swing'] : ['spin', 'swing', 'surge'];
      const mode = ng > 1 ? (k === 0 ? modes[Math.floor(r() * modes.length)] : gs[0].mode) : modes[Math.floor(r() * modes.length)];
      const w = clamp((0.55 + r() * 0.35 + d * 0.03) * fk, 0.45, 1.3);
      const base = mode === 'swing' ? 0 : k * (Math.PI * 2 / ng) + 1.2;
      gs.push({
        mode, w, a0: mode === 'swing' ? (k - (ng - 1) / 2) * 1.6 : base, sp: (mode === 'swing' ? 1.1 + d * 0.08 + r() * 0.4 : dir * (1.0 + d * 0.11 + r() * 0.35)) * fk,
        amp: 1.0 + r() * 0.6, ph: r() * 6, sp2: 1.5 + r(),
      });
      if (mode === 'swing' && ng > 1) gs[k].ph = gs[0].ph + k * 1.4;
    }
    out.push({ rings, shape, tw, guards: gs });
  }
  return out;
}

let plan = [], stageIdx = 0, totalRings = 0, doneRings = 0, gt = 0, fireT = 0, holding = false, combo = 0, comboT = 0, shake = 0, camZ = 0, travel = 0;
const guardMats = [];
function setupStage(s) {
  const S = plan[s]; towerZ = -s * SPACING; towerShape = S.shape; twist = S.tw;
  if (towerMesh) { scene.remove(towerMesh); towerMesh.dispose(); }
  towerMesh = new THREE.InstancedMesh(RING_GEOS[S.shape], mat('#ffffff', { roughness: 0.42 }), S.rings);
  towerMesh.castShadow = true; towerMesh.receiveShadow = true; scene.add(towerMesh);
  rings = []; removed = 0;
  for (let i = 0; i < S.rings; i++) { rings.push({ y: i * RH + 1.2 + i * 0.12, alive: true }); towerMesh.setColorAt(i, _c.set(i % 2 ? T.b : T.a)); }
  towerMesh.instanceColor.needsUpdate = true;
  for (const g of guards) scene.remove(g.m);
  guards = S.guards.map((G, i) => {
    const m = new THREE.Mesh(arcGeo(G.w), guardMats[i] || (guardMats[i] = mat(T.ob, { roughness: 0.45 })));
    m.material.color.set(T.ob); m.material.emissive.set('#000000');
    m.castShadow = true; m.position.set(0, -0.6, towerZ); scene.add(m); return { ...G, m, rise: 0 };
  });
  gt = 0; combo = 0;
  counter.position.set(0, 0.02, towerZ + PR + 0.75); drawCounter(S.rings);
  lid.position.set(0, 0, towerZ); glow.position.set(0, 0.02, towerZ);
  ui.sub(plan.map((_, i) => i < s ? '●' : i === s ? '◉' : '○').join(' '));
}
function buildLevel() {
  T = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', T.sky[0]); document.body.style.setProperty('--bg2', T.sky[1]); document.body.style.setProperty('--ui', T.ui);
  seaMat.color.set(T.sea); scene.fog.color.set(T.sky[1]); rockMat.color.set(T.rock); glow.material.color.set(T.a);
  hemi.groundColor.set(T.sea).lerp(new THREE.Color('#ffffff'), 0.6);
  plan = genLevel(level, F.k()); totalRings = plan.reduce((a, s) => a + s.rings, 0); doneRings = 0; stageIdx = 0;
  buildPier(plan.length); balls = []; travel = 0;
  cannonZ = 8; camZ = cannonZ;
  setupStage(0); ui.levels(level); ui.progress(0); score = 0; ui.score(0);
}

// ------------------------------------------------------------------ game flow
function hitTower() {
  const i = removed; if (i >= rings.length) return;
  rings[i].alive = false; removed++;
  const col = i % 2 ? T.b : T.a; shatter(rings[i].y, col);
  towerSquash = 1; doneRings++; score++; combo++; comboT = 0.5;
  ui.score(score); ui.progress(doneRings / totalRings); drawCounter(rings.length - removed);
  glow.material.opacity = 0.75;
  note(60 + [0, 2, 4, 7, 9, 12, 14, 16][combo % 8] + Math.floor(combo / 8) % 2 * 12, 0.18, 0.1); tone(140, 0.07, 'square', 0.05, 0.5);
  buzz(8);
  if (combo > 0 && combo % 10 === 0) ui.pop(combo >= 30 ? 'UNSTOPPABLE!' : combo >= 20 ? 'ON FIRE!' : 'COMBO x' + combo, T.ui, 36, 30);
  if (removed >= rings.length) stageClear();
}
function stageClear() {
  sfx.coin(); confetti(scene, new THREE.Vector3(0, 1.5, towerZ), 70); ui.flash(0.35); buzz([30, 30, 30]);
  ui.pop(stageIdx + 1 < plan.length ? 'TOWER DOWN!' : 'PERFECT!', T.ui, 44, 30);
  for (const g of guards) g.sink = true;
  for (const b of balls) if (!b.dead) { b.hit = true; burst(scene, new THREE.Vector3(b.x, b.y, b.z), '#ffffff', 2, { speed: 0.04, up: 0.04, size: 0.5, shape: 'sphere' }); }
  holding = false;
  if (stageIdx + 1 < plan.length) { stageIdx++; travel = 1; state = 'travel'; setTimeout(() => { setupStage(stageIdx); }, 450); }
  else { state = 'won'; F.level(true); level++; save.set('level', level); best = Math.max(best, score); save.set('best', best); setTimeout(sfx.win, 200); ui.win(level - 1, 'Score ' + score); }
}
function fail(g, b) {
  if (state !== 'play') return;
  state = 'lost'; F.level(false, doneRings / Math.max(1, totalRings)); holding = false;
  b.vz = 9; b.vy = 7; b.vx = (Math.random() - 0.5) * 6; b.dead = true;
  g.flash = 1; shake = 0.9; ui.flash(0.4); sfx.fail(); buzz([60, 40, 90]);
  burst(scene, new THREE.Vector3(0, 0.5, towerZ + OR), [T.ob, '#ffffff'], 16, { speed: 0.12, up: 0.12, size: 0.8 });
  best = Math.max(best, score); save.set('best', best);
  ui.lose('OOPS!', 'Rings left: ' + (rings.length - removed));
}
function fire() {
  if (balls.length >= MAXB) return;
  balls.push({ x: 0, y: 0.34, z: cannonZ - 0.75, vx: 0, vy: 0, vz: -BALL_SPEED, dead: false, spin: 0 });
  cannonKick = 1; tone(300 + Math.random() * 40, 0.04, 'triangle', 0.05, 0.6);
}

input({ onDown: () => { if (state === 'play') { holding = true; if (fireT <= 0) { fire(); fireT = FIRE_DT; } } }, onUp: () => { holding = false; } });
ui.onTap(which => {
  if (which === 'start') { state = 'play'; }
  else { buildLevel(); state = 'play'; }
});

// ------------------------------------------------------------------ loop
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const camPos = new THREE.Vector3(0, 8, 16), camAt = new THREE.Vector3();
loop((d) => {
  const dt = d / 60;
  if (state === 'play' || state === 'ready' || state === 'travel') gt += dt;
  // fire stream
  fireT -= dt;
  if (holding && state === 'play' && fireT <= 0) { fire(); fireT = FIRE_DT; }
  comboT -= dt; if (comboT <= 0) combo = 0;

  // travel to next platform
  if (state === 'travel') {
    const target = -stageIdx * SPACING + 8; cannonZ = lerp(cannonZ, target, 1 - Math.pow(0.03, dt));
    if (Math.abs(cannonZ - target) < 0.05) { cannonZ = target; state = 'play'; }
  }
  cannonKick = Math.max(0, cannonKick - dt * 9);
  cannon.position.set(0, 0, cannonZ + cannonKick * 0.12); cannon.scale.setScalar(0.82);
  cannon.body.scale.set(1 + cannonKick * 0.06, 1 - cannonKick * 0.1, 1 + cannonKick * 0.06);
  cannon.top.position.y = 0.95 - cannonKick * 0.08;

  // guards
  for (const g of guards) {
    g.rise = g.sink ? Math.max(0, g.rise - dt * 2) : Math.min(1, g.rise + dt * 3);
    g.m.position.y = -0.62 + g.rise * 0.62 - (1 - g.rise) * 0.2; g.m.visible = g.rise > 0.01;
    if (state !== 'lost') g.m.rotation.y = guardAngle(g, gt);
    if (g.flash) { g.flash = Math.max(0, g.flash - dt * 1.2); g.m.material.emissive.setRGB(g.flash * 0.9, g.flash * 0.15, g.flash * 0.15); }
  }

  // balls
  let bi = 0;
  for (const b of balls) {
    const pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.spin += dt * 30;
    if (b.dead) b.vy -= 22 * dt;
    else {
      const rel = b.z - towerZ;
      // guard wall band
      if (rel < OR + 0.4 && rel > OR - 0.4) { const g = blocked(gt); if (g && state === 'play') fail(g, b); }
      if (rel <= TR + 0.15 && state === 'play' && removed < rings.length) {
        b.hit = true; b.dead = true; hitTower();
        burst(scene, new THREE.Vector3(0, 0.5, towerZ + TR), '#ffffff', 3, { speed: 0.05, up: 0.04, size: 0.5, shape: 'sphere' });
      } else if (rel <= TR + 0.15) { b.dead = true; b.vz = 4; b.vy = 4; }
    }
    if (b.y < -3 || b.hit || b.z > cannonZ + 20) { b.gone = true; continue; }
    _p.set(b.x, b.y, b.z); _e.set(b.spin, 0, 0); _q.setFromEuler(_e); _s.setScalar(1); _m.compose(_p, _q, _s); ballMesh.setMatrixAt(bi++, _m);
  }
  balls = balls.filter(b => !b.gone); ballMesh.count = bi; ballMesh.instanceMatrix.needsUpdate = true;

  // tower: rings drop into place, squash on hit
  towerSquash = Math.max(0, towerSquash - dt * 7);
  if (towerMesh) {
    let top = 0;
    for (let i = 0; i < rings.length; i++) {
      const R = rings[i];
      if (!R.alive) { _s.setScalar(0); _m.compose(_p.set(0, -50, 0), _q.identity(), _s); towerMesh.setMatrixAt(i, _m); continue; }
      const ty = (i - removed) * RH; R.y = lerp(R.y, ty, 1 - Math.pow(0.0005, dt));
      const sq = i === removed ? towerSquash : towerSquash * 0.4;
      _s.set(1 + sq * 0.08, 1 - sq * 0.12, 1 + sq * 0.08); _q.setFromAxisAngle(_p.set(0, 1, 0), i * twist + (towerShape === 48 ? 0 : 0.3));
      _m.compose(_p.set(0, R.y * (1 - towerSquash * 0.04), towerZ), _q, _s); towerMesh.setMatrixAt(i, _m); top = R.y + RH;
    }
    towerMesh.instanceMatrix.needsUpdate = true;
    lid.position.y = top + 0.003; lid.visible = removed < rings.length; lid.rotation.z = (rings.length - 1) * twist + (towerShape === 48 ? 0 : 0.3);
  }
  glow.material.opacity = Math.max(0, glow.material.opacity - dt * 2.2); glow.scale.setScalar(1 + (0.75 - glow.material.opacity) * 0.1);

  // shards
  for (let i = 0; i < SHN; i++) {
    const s = shards[i];
    if (s.life <= 0) { _s.setScalar(0); _m.compose(_p.set(0, -50, 0), _q.identity(), _s); shardMesh.setMatrixAt(i, _m); continue; }
    s.life -= dt; s.v.y -= 20 * dt; s.p.addScaledVector(s.v, dt); s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
    if (s.p.y < -1.4) { s.p.y = -1.4; s.v.multiplyScalar(0.3); s.life = Math.min(s.life, 0.3); }
    _q.setFromEuler(s.r); _s.setScalar(s.s * Math.min(1, s.life * 3)); _m.compose(s.p, _q, _s); shardMesh.setMatrixAt(i, _m);
  }
  shardMesh.instanceMatrix.needsUpdate = true;

  // camera: behind the cannon, looking up the pier at the tower
  camZ = lerp(camZ, cannonZ, 1 - Math.pow(0.02, dt));
  const tp = new THREE.Vector3(0, 8, camZ + 13.5), ta = new THREE.Vector3(0, 0, camZ - 9);
  if (state === 'ready') tp.x += Math.sin(gt * 0.6) * 0.5;
  camPos.lerp(tp, 1 - Math.pow(0.01, dt)); camAt.lerp(ta, 1 - Math.pow(0.01, dt));
  shake = Math.max(0, shake - dt * 2);
  camera.position.copy(camPos).add(_p.set((Math.random() - 0.5) * shake * 0.4, (Math.random() - 0.5) * shake * 0.4, 0));
  camera.lookAt(camAt);
  stage.followLight(new THREE.Vector3(0, 0, camZ - 6));
  sea.position.z = camZ - 40;
});

buildLevel(); camPos.set(0, 8, camZ + 13.5); camAt.set(0, 0, camZ - 9);

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state === 'travel' ? 'play' : state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') { if (holding) dispatchEvent(new PointerEvent('pointerup', { clientX: 195, clientY: 600, pointerId: 1, bubbles: true })); return; }
    // fire only if every ball shot in the next ~0.2 s crosses the guard ring while the path is clear
    const tA = (cannonZ - 0.75 - (towerZ + OR + 0.45)) / BALL_SPEED, tB = (cannonZ - 0.75 - (towerZ + OR - 0.45)) / BALL_SPEED;
    let safe = true;
    for (let f = 0; f <= 0.24 && safe; f += 0.02) for (let t = tA; t <= tB; t += 0.01) if (blocked(gt + f + t, 0.12)) { safe = false; break; }
    const ev = (type) => dispatchEvent(new PointerEvent(type, { clientX: 195, clientY: 600, pointerId: 1, bubbles: true }));
    if (safe && !holding) ev('pointerdown');
    else if (!safe && holding) ev('pointerup');
  },
};

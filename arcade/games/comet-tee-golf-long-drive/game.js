// Comet Tee — original long-drive golf. An arrow sweeps across a power fan: tap when it's in the green to drive.
// The ball flies, bounces off springs, plops in sand or water, and loops round little planets that fling it on faster.
// Reach the goal distance with one of your three balls to clear the hole.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { canvasTex } from './geo.js';

const NAME = 'Comet Tee: Golf Long Drive';
const S = createStage({ fov: 42, shadowSize: 14 });
const { scene, camera, sun, hemi } = S;
camera.far = 6000; camera.updateProjectionMatrix();
sun.intensity = 1.5; hemi.intensity = 1.3;
const ui = createUI({ title: 'COMET<br>TEE', hint: 'Tap when the arrow is in the green', hand: '👆' });
const D = daily('comettee', ui, { name: NAME });
const B = board({ game: 'comet-tee', label: 'Holes cleared', limits: { maxRun: 2, maxPerSec: 0.6 }, mode: 'sum' });   // world board: holes cleared today (RULES.md)
const save = store('comettee');
const F = flow('comettee');
let level = save.get('level', 1), bestDrive = save.get('best', 0);

const css = document.createElement('style'); css.textContent = `
.hc-pop{-webkit-text-stroke:6px rgba(30,40,90,.5);paint-order:stroke fill}
.hc-score{font-size:46px;-webkit-text-stroke:5px rgba(30,40,90,.35);paint-order:stroke fill}
.hc-sub{font-size:17px;font-weight:800;top:calc(104px + env(safe-area-inset-top))}
.hc-card h1{text-shadow:0 6px 0 rgba(30,40,90,.3)}
.ct-balls{position:fixed;top:calc(130px + env(safe-area-inset-top));left:0;right:0;text-align:center;z-index:5;pointer-events:none;font-size:20px;letter-spacing:6px}
`; document.head.appendChild(css);
const ballsEl = document.createElement('div'); ballsEl.className = 'ct-balls'; document.body.appendChild(ballsEl);

// ---------------------------------------------------------------- physics constants (units = yards)
const G = 30, VMAX = 88, BR = 0.5, A0 = 12 * Math.PI / 180, A1 = 78 * Math.PI / 180, AC = 45 * Math.PI / 180;
let ph1 = 0, ph2 = 0, amp = 1;
function groundY(x) { const k = clamp((x - 12) / 40, 0, 1); return amp * k * (3.2 * Math.sin(x * 0.026 + ph1) + 1.6 * Math.sin(x * 0.067 + ph2) + 0.6 * Math.sin(x * 0.19)); }
function slope(x) { return (groundY(x + 0.5) - groundY(x - 0.5)); }

// level features
let pads = [], sands = [], waters = [], planets = [], goal = 200, perfectDist = 0;
function surfaceAt(x) { for (const s of sands) if (x > s.a && x < s.b) return 'sand'; for (const w of waters) if (x > w.a && x < w.b) return 'water'; return 'grass'; }

/** one physics step for ball b (mutated). h = seconds. returns an event string or null */
function step(b, h, live = false) {
  if (b.mode === 'orbit') {
    const p = b.orb.p; b.orb.a += b.orb.w * h; b.orb.swept += Math.abs(b.orb.w * h);
    b.x = p.x + Math.cos(b.orb.a) * b.orb.r; b.y = p.y + Math.sin(b.orb.a) * b.orb.r;
    if (b.orb.swept >= Math.PI * 2) {
      const sp = b.orb.speed * 1.28 + 10, s = Math.sign(b.orb.w);
      b.vx = -Math.sin(b.orb.a) * sp * s; b.vy = Math.cos(b.orb.a) * sp * s; b.mode = 'fly'; return 'sling';
    }
    return null;
  }
  if (b.mode === 'stop') return null;
  b.vy -= G * h; b.x += b.vx * h; b.y += b.vy * h;
  if (b.mode === 'fly') for (const p of planets) {
    if (b.used && b.used.has(p)) continue;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
    if (d < p.cap) {
      (b.used = b.used || new Set()).add(p);
      const speed = Math.hypot(b.vx, b.vy), cr = dx * b.vy - dy * b.vx;
      const r = Math.max(d, p.r + 1.5);
      b.mode = 'orbit'; b.orb = { p, r, a: Math.atan2(dy, dx), w: Math.sign(cr || 1) * Math.max(speed, 55) / r * 1.4, swept: 0, speed };
      return 'orbit';
    }
  }
  for (const pd of pads) if (b.vy < 0 && Math.abs(b.x - pd.x) < 1.6 && b.y < groundY(pd.x) + 1.3 + BR) { b.vy = Math.max(-b.vy * 0.9, 34); b.vx = Math.max(b.vx * 1.08, 12); b.y = groundY(pd.x) + 1.3 + BR; b.mode = 'fly'; return 'pad'; }
  const gy = groundY(b.x);
  if (b.y < gy + BR) {
    const surf = surfaceAt(b.x);
    if (surf === 'water') { b.mode = 'stop'; b.y = gy - 0.4; b.vx = b.vy = 0; return 'water'; }
    const sl = slope(b.x), nl = Math.hypot(1, sl), nx = -sl / nl, ny = 1 / nl;
    const vn = b.vx * nx + b.vy * ny, tx = ny, ty = -nx; let vt = b.vx * tx + b.vy * ty;
    b.y = gy + BR;
    if (surf === 'sand') { b.mode = 'stop'; b.vx = b.vy = 0; return 'sand'; }
    if (vn < -6) {   // bounce
      const e = 0.42, f = 0.8; vt *= f; const nvn = -vn * e;
      b.vx = tx * vt + nx * nvn; b.vy = ty * vt + ny * nvn; b.mode = 'fly'; return Math.abs(vn) > 14 ? 'bounce' : 'tick';
    }
    // roll
    b.mode = 'roll'; vt += -G * ty * h * 0.6; vt *= Math.pow(0.3, h); vt -= Math.sign(vt) * Math.min(Math.abs(vt), 12 * h);
    b.vx = tx * vt; b.vy = ty * vt;
    if (Math.abs(vt) < 0.6) { b.mode = 'stop'; b.vx = b.vy = 0; return 'stop'; }
  }
  return null;
}
function launchVel(angle, q) { const sp = VMAX * (0.5 + 0.5 * q); return { vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp }; }
function simulate(angle, q, maxT = 40) {
  const b = { x: 0, y: groundY(0) + BR, ...launchVel(angle, q), mode: 'fly' }; const tr = [];
  for (let t = 0; t < maxT && b.mode !== 'stop'; t += 1 / 60) { step(b, 1 / 60); tr.push({ x: b.x, y: b.y, m: b.mode }); }
  return { dist: b.x, tr };
}

// ---------------------------------------------------------------- world: themes, chunks of terrain, scenery
const THEMES = [
  { sky: ['#6cc4ff', '#d8f1ff'], lip: '#6fd45a', dirt: '#b77a4a', deep: '#8a5634', hill: '#9fe0a8', tree: '#38b26b' },
  { sky: ['#ff9e7a', '#ffe3b8'], lip: '#a6d64a', dirt: '#c9824a', deep: '#94572f', hill: '#ffc7a0', tree: '#e0884d' },
  { sky: ['#9d8cff', '#ffd6f2'], lip: '#62d1a0', dirt: '#9a6fc4', deep: '#6d4a96', hill: '#c8b4ff', tree: '#ff7eb6' },
  { sky: ['#5fd3c7', '#e6fff6'], lip: '#7ad65a', dirt: '#a8794f', deep: '#7a5434', hill: '#9ae6d4', tree: '#2fae86' },
];
let TH = THEMES[0];
const chunks = new Map(), CH = 120;
const lipMat = mat('#6fd45a'), dirtMat = mat('#b77a4a'), deepMat = mat('#8a5634'), topMat = mat('#5cc24a'), hillMat = new THREE.MeshBasicMaterial({ color: '#9fe0a8' }), treeMat = mat('#38b26b'), trunkMat = mat('#8a5634');
const sandMat = mat('#f3d58a'), waterMat = glossy('#3fb6ff', { transparent: true, opacity: 0.9 }), padMat = glossy('#ffd23f'), padTopMat = glossy('#ff5d8f');
function profileShape(x0, x1, off0, off1) {
  const s = new THREE.Shape(); const n = Math.ceil((x1 - x0) / 2);
  s.moveTo(x0, groundY(x0) - off1);
  for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); s.lineTo(x, groundY(x) - off0); }
  for (let i = n; i >= 0; i--) { const x = lerp(x0, x1, i / n); s.lineTo(x, groundY(x) - off1); }
  return s;
}
function signTex(txt) { return canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 26); g.fill(); g.fillStyle = '#3a3a5a'; g.font = '800 70px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 6); }); }
function makeChunk(ci) {
  const g = new THREE.Group(), x0 = ci * CH, x1 = x0 + CH + 0.5;
  const ext = (shape, depth, m, z) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }); const me = new THREE.Mesh(geo, m); me.position.z = z; me.receiveShadow = true; g.add(me); return me; };
  ext(profileShape(x0, x1, 0, 60), 40, topMat, -38);              // body (its top face is the fairway seen from above)
  ext(profileShape(x0, x1, -0.05, 2.2), 0.6, lipMat, 2.05);        // green lip
  ext(profileShape(x0, x1, 2.2, 12), 0.6, dirtMat, 2.0);          // dirt
  ext(profileShape(x0, x1, 12, 60), 0.6, deepMat, 2.0);
  for (const s of sands) if (s.b > x0 && s.a < x1) ext(profileShape(Math.max(s.a, x0), Math.min(s.b, x1), -0.1, 1.6), 3.4, sandMat, -0.8);
  for (const w of waters) if (w.b > x0 && w.a < x1) ext(profileShape(Math.max(w.a, x0), Math.min(w.b, x1), -0.15, 1.4), 3.6, waterMat, -0.9);
  for (const p of pads) if (p.x > x0 && p.x < x1) { const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.9, 20), padMat); base.position.set(p.x, groundY(p.x) + 0.45, 0); const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.35, 20), padTopMat); top.position.set(p.x, groundY(p.x) + 1.05, 0); base.castShadow = top.castShadow = true; g.add(base, top); p.top = top; }
  const r = rng(ci * 131 + level * 7 + 3);
  for (let i = 0; i < 6; i++) {        // trees behind the fairway
    const x = x0 + r() * CH, z = -14 - r() * 24, s = 1.6 + r() * 2.2; if (x < 30) continue;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s, 8), trunkMat); tr.position.set(x, groundY(x) + s, z);
    const cr = new THREE.Mesh(new THREE.SphereGeometry(1.4 * s, 12, 10), treeMat); cr.position.set(x, groundY(x) + 2.6 * s, z); cr.castShadow = true;
    g.add(tr, cr);
  }
  for (let i = 0; i < 2; i++) { const x = x0 + r() * CH, s = 60 + r() * 60; const hl = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 12), hillMat); hl.scale.set(1.6, 0.42, 0.3); hl.position.set(x, -s * 0.1, -260 - r() * 80); g.add(hl); }
  for (let x = Math.ceil(x0 / 50) * 50; x < x1; x += 50) if (x > 0) {   // yardage boards
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: signTex(x + ''), transparent: true })); sg.position.set(x, groundY(x) + 4.2, -3);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), mat('#ffffff')); pole.position.set(x, groundY(x) + 1.5, -3.05); g.add(sg, pole);
  }
  scene.add(g); return g;
}
function ensureChunks(xc, span) {
  const a = Math.floor((xc - span) / CH) - 1, b = Math.floor((xc + span) / CH) + 1;
  for (let i = Math.max(-1, a); i <= b; i++) if (!chunks.has(i)) chunks.set(i, makeChunk(i));
  for (const [i, g] of chunks) if (i < a - 2 || i > b + 2) { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); chunks.delete(i); }
}
function clearChunks() { for (const [i, g] of chunks) { scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } chunks.clear(); }

// clouds + stars
const clouds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 }), 120); clouds.frustumCulled = false; scene.add(clouds);
const starGeo = new THREE.BufferGeometry(); { const a = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { a[i * 3] = (Math.random() - 0.5) * 1600; a[i * 3 + 1] = (Math.random() - 0.5) * 1600; a[i * 3 + 2] = -400 - Math.random() * 200; } starGeo.setAttribute('position', new THREE.BufferAttribute(a, 3)); }
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(stars);
function placeClouds(seed) { const r = rng(seed), m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(); let k = 0; for (let c = 0; c < 30; c++) { const cx = -60 + c * 70 + r() * 40, cy = 30 + r() * 90, cz = -30 - r() * 50; for (let j = 0; j < 4; j++) { const sc = 4 + r() * 5; m.compose(v.set(cx + (j - 1.5) * 5.5, cy + (j % 2) * 2, cz), q, s.set(sc * 1.2, sc * 0.8, sc)); clouds.setMatrixAt(k++, m); } } clouds.instanceMatrix.needsUpdate = true; }

// planets
const planetGroup = new THREE.Group(); scene.add(planetGroup);
function planetTex(a, b) { return canvasTex(256, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; for (let i = 0; i < 5; i++) g.fillRect(0, i * 26 + 8, w, 10 + (i % 2) * 6); g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 8, 0, 7); g.fill(); } }); }
const PCOL = [['#ff8fb1', '#ffc4d6'], ['#7bd3ff', '#c7efff'], ['#ffd166', '#ffe9a8'], ['#9b8cff', '#d0c8ff'], ['#6fe3b0', '#c4f7e0']];
function buildPlanets() {
  planetGroup.clear();
  planets.forEach((p, i) => {
    const [a, b] = PCOL[i % PCOL.length];
    const sp = new THREE.Mesh(new THREE.SphereGeometry(p.r, 32, 20), mat('#ffffff', { map: planetTex(a, b) })); sp.position.set(p.x, p.y, 0); sp.rotation.z = 0.4; sp.castShadow = false;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 1.55, 0.35, 8, 48), glossy(b)); ring.rotation.x = 1.25; ring.position.copy(sp.position);
    const halo = new THREE.Mesh(new THREE.RingGeometry(p.cap - 0.4, p.cap, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false })); halo.position.set(p.x, p.y, -0.5);
    planetGroup.add(sp, ring, halo); p.mesh = sp; p.halo = halo;
  });
}

// goal flag
const goalG = new THREE.Group(); scene.add(goalG);
{ const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 10), mat('#ffffff')); pole.position.y = 6; pole.castShadow = true;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: canvasTex(128, 80, (g, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { g.fillStyle = (i + j) % 2 ? '#ffffff' : '#ff3d6e'; g.fillRect(i * 16, j * 16, 16, 16); } }) }));
  flag.position.set(2.6, 10.2, 0); const beamM = new THREE.Mesh(new THREE.PlaneGeometry(3, 400), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); beamM.position.set(0, 200, -1);
  goalG.add(pole, flag, beamM); goalG.flag = flag; }
const bestG = new THREE.Group(); scene.add(bestG);
{ const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), mat('#ffffff')); pole.position.y = 3; const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide })); fl.position.set(1.35, 5.1, 0); bestG.add(pole, fl); bestG.visible = false; }

// ---------------------------------------------------------------- golfer (round fellow in a bucket hat) + ball + trail
const golfer = new THREE.Group(); scene.add(golfer);
const club = new THREE.Group();
{
  const shirt = glossy('#7b5cff'), skin = mat('#ffcfa8');
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 1.1, 8, 16), shirt); body.position.y = 2.4; body.castShadow = true;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 0.4, 6, 12), mat('#ffffff')); legs.position.y = 1.2; legs.castShadow = true;
  for (const s of [-1, 1]) { const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat('#2b2d42')); shoe.scale.set(1.5, 0.6, 1); shoe.position.set(s * 0.5, 0.25, 0.2); golfer.add(shoe); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 16), skin); head.position.y = 4.3; head.castShadow = true;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 0.75, 20), mat('#ffd23f')); hat.position.y = 5.05;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.1, 24), mat('#ffd23f')); brim.position.y = 4.72;
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat('#2b2d42')); e.position.set(0.82, 4.4, s * 0.3); golfer.add(e); }
  const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat('#ff9eb0')); cheek.position.set(0.8, 4.05, 0.5);
  golfer.add(body, legs, head, hat, brim, cheek);
  // arms + club pivot at the shoulders
  club.position.set(0.3, 3.1, 0.6);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 4, 8), shirt); arm.position.y = -0.7; arm.castShadow = true;
  const glovem = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), mat('#ffffff')); glovem.position.y = -1.45;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), mat('#cfd6e6', { metalness: 0.6, roughness: 0.3 })); shaft.position.y = -2.6;
  const headc = new THREE.Mesh(rounded(0.9, 0.42, 0.5, 0.12), glossy('#3a3f5c')); headc.position.set(0.3, -3.8, 0);
  club.add(arm, glovem, shaft, headc); golfer.add(club);
  golfer.position.set(-2.2, 0, 0.6); golfer.rotation.y = 0;
}
const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 20, 14), glossy('#ffffff')); ball.castShadow = true; scene.add(ball);
const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.06, 0.6, 8), mat('#ff5d8f')); scene.add(tee);
const TRAIL = 40, trail = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }), TRAIL); trail.frustumCulled = false; scene.add(trail);
let trailPts = [];

// power fan (3D, beside the golfer)
const fan = new THREE.Group(); scene.add(fan);
const needle = new THREE.Group(); fan.add(needle);
let greenHalf = 0.09, needleSpeed = 1.2;
function buildFan() {
  fan.clear(); fan.add(needle);
  const R = 4.6, bands = [[0.5, '#ff4d6d'], [greenHalf + 0.22, '#ff9f43'], [greenHalf + 0.09, '#ffd23f'], [greenHalf, '#3ddc84']];
  bands.forEach(([hw, col], i) => {   // hw = half width as a fraction of the fan's sweep, centred
    const span = (A1 - A0), a = AC - hw * span, b = AC + hw * span;
    const m = new THREE.Mesh(new THREE.RingGeometry(1.1, R - i * 0.02, 40, 1, Math.max(A0, a), Math.min(A1, b) - Math.max(A0, a)), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, depthWrite: false }));
    m.position.z = i * 0.01; m.renderOrder = 2 + i; fan.add(m);
  });
  const rim = new THREE.Mesh(new THREE.RingGeometry(R, R + 0.28, 40, 1, A0, A1 - A0), new THREE.MeshBasicMaterial({ color: '#ffffff' })); fan.add(rim);
  needle.clear();
  const sh = new THREE.Shape(); sh.moveTo(1.0, -0.16); sh.lineTo(R - 0.9, -0.1); sh.lineTo(R - 0.9, -0.38); sh.lineTo(R + 0.25, 0); sh.lineTo(R - 0.9, 0.38); sh.lineTo(R - 0.9, 0.1); sh.lineTo(1.0, 0.16); sh.lineTo(1.0, -0.16);
  const nm = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: '#ffffff' })); nm.position.z = 0.1; nm.renderOrder = 8;
  const hub = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 24), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hub.position.z = 0.12; hub.renderOrder = 8;
  needle.add(nm, hub);
}

// ---------------------------------------------------------------- level build
let state = 'ready', sub = 'aim', ballsLeft = 3, best = 0, b = null, np = 0, ndir = 1, t = 0, swingT = 0, doneT = 0, recorded = false, botPending = false;
let camX = 0, camY = 6, camD = 30, shake = 0, beatenShown = false, prevEvt = null, flightT = 0;
function build() {
  TH = THEMES[(level - 1) % THEMES.length];
  lipMat.color.set(TH.lip); dirtMat.color.set(TH.dirt); deepMat.color.set(TH.deep); topMat.color.set(TH.lip).offsetHSL(0, 0, -0.06); hillMat.color.set(TH.hill).lerp(new THREE.Color(TH.sky[1]), 0.35); treeMat.color.set(TH.tree);
  const seed = D.seed ? D.seed + level : level * 4241 + 11, r = rng(seed), fk = F.k();
  ph1 = r() * 6; ph2 = r() * 6; amp = Math.min(1.6, 0.6 + level * 0.12);
  pads = []; sands = []; waters = []; planets = [];
  // hazards scattered along the fairway; more water/sand as levels go on
  const hz = Math.min(8, 1 + Math.floor(level * 0.8 * fk));
  for (let i = 0; i < hz; i++) { const x = 90 + r() * 420, w = 8 + r() * 14 * fk; (r() < 0.45 ? waters : sands).push({ a: x, b: x + w }); }
  for (let i = 0; i < 2 + Math.floor(level / 3); i++) { let x = 70 + r() * 380; if (surfaceAt(x) !== 'grass' || surfaceAt(x + 3) !== 'grass' || surfaceAt(x - 3) !== 'grass') continue; pads.push({ x }); }
  // planets: from level 3, placed along a good drive's flight so a well-timed swing loops through them
  const np2 = level >= 3 ? Math.min(4, 1 + Math.floor((level - 3) / 2)) : 0;
  if (np2) {
    for (let k = 0; k < np2; k++) {
      const sim = simulate(AC + (r() - 0.5) * 0.12, 0.92), tr = sim.tr.filter(p => p.m === 'fly');
      const startX = k === 0 ? 0 : planets[k - 1].x + 30;
      const cand = tr.filter(p => p.x > startX + 40 && p.y > 35);
      if (!cand.length) break;
      const p = cand[Math.floor(cand.length * (0.25 + r() * 0.4))], rad = 5 + r() * 3.5;
      const off = (r() < 0.5 ? 1 : -1) * (rad + 3.5);
      planets.push({ x: p.x, y: Math.max(rad + 25, p.y + off), r: rad, cap: rad + 6.5 / Math.sqrt(fk), used: false });
    }
  }
  perfectDist = simulate(AC, 1).dist;
  const good = simulate(AC + 0.05, 0.85).dist;
  goal = Math.round(Math.max(150, Math.min(perfectDist * 0.9, good * clamp(0.82 + level * 0.012, 0.85, 1.0) * fk)) / 5) * 5;
  greenHalf = clamp(0.085 / fk - level * 0.0015, 0.045, 0.11); needleSpeed = clamp((1.1 + level * 0.04) * fk, 0.9, 2.3);
  clearChunks(); buildPlanets(); buildFan(); placeClouds(seed);
  for (const p of planets) p.used = false;
  goalG.position.set(goal, groundY(goal), -1.5); bestG.visible = false;
  ballsLeft = 3; best = 0; recorded = false; beatenShown = false;
  const bs = document.body.style; bs.setProperty('--ui', '#ff5d8f');
  ui.levels(level); ui.progress(0); ui.score('0 yd'); ui.sub('GOAL ' + goal + ' yd'); setBalls();
  resetBall();
}
function setBalls() { ballsEl.textContent = '⚪'.repeat(ballsLeft) + '⚫'.repeat(3 - ballsLeft); }
function resetBall() {
  b = { x: 0, y: groundY(0) + BR + 0.3, vx: 0, vy: 0, mode: 'tee' }; for (const p of planets) p.used = false;
  sub = 'aim'; np = 0; ndir = 1; swingT = 0; flightT = 0; trailPts = []; botPending = false;
  ball.position.set(b.x, b.y, 0); ball.scale.setScalar(1); tee.position.set(0, groundY(0) + 0.15, 0);
  fan.visible = true; fan.position.set(0, groundY(0) + BR + 0.3, 1.0);
  club.rotation.z = -1.5; camX = 1.6; camY = groundY(0) + 4.2; camD = 30;
  for (const p of planets) if (p.halo) p.halo.material.opacity = 0.35;
}

// ---------------------------------------------------------------- swing / results
function swing() {
  if (state !== 'play' || sub !== 'aim') return;
  const ang = lerp(A0, A1, np), q = clamp(1 - Math.abs(ang - AC) / ((A1 - A0) / 2), 0, 1);
  const inGreen = Math.abs(np - 0.5) <= greenHalf;
  const v = launchVel(ang, inGreen ? 1 : q * 0.95);
  b.vx = v.vx; b.vy = v.vy; b.mode = 'fly';
  sub = 'swing'; swingT = 0; fan.visible = false;
  if (inGreen) { ui.pop('PERFECT!', '#fff', 46, 30); note(84, 0.3, 0.16); ui.flash(0.3); shake = 0.6; buzz(30); }
  else if (q > 0.7) { ui.pop('GOOD', '#fff', 36, 30); buzz(18); }
  else { ui.pop(q > 0.45 ? 'OK' : 'SLICED!', '#fff', 32, 30); buzz(10); }
  tone(180, 0.08, 'square', 0.12, 2.2); tone(1200, 0.12, 'triangle', 0.1, 0.5);
  burst(scene, ball.position.clone(), ['#ffffff', '#ffd23f', '#3ddc84'], 14, { speed: 0.6, up: 0.4, size: 3, gravity: 0.03 });
}
function shotDone(evt) {
  if (demoShot) { demoShot = false; sub = 'done'; doneT = 0; ui.score('0 yd'); ui.progress(0); ui.pop(`${goal - Math.max(0, Math.round(b.x))} yd short`, '#fff', 32, 30); return; }   // demo ball: given back
  sub = 'done'; doneT = 0;
  const d = Math.max(0, Math.round(b.x));
  ui.score(d + ' yd');
  if (d > best) { best = d; bestG.visible = d > 5; bestG.position.set(d, groundY(d), -1); }
  if (d > bestDrive) { bestDrive = d; save.set('best', bestDrive); }
  if (!beatenShown && D.beaten(best)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 46, 24); confetti(scene, ball.position.clone().add(new THREE.Vector3(0, 6, 0)), 50); }
  if (d >= goal) {
    state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
    confetti(scene, ball.position.clone().add(new THREE.Vector3(0, 8, 0)), 90); sfx.win(); buzz([20, 40, 20]); ui.pop(d + ' yd!', '#fff', 50, 26);
    level++; save.set('level', level); D.won(best, 'drove a');
    ui.win(level - 1, `Longest drive ${best} yd`);
    return;
  }
  ballsLeft--; setBalls();
  if (ballsLeft <= 0) {
    state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(best / goal, 0, 1)); }
    sfx.fail(); buzz([40, 30, 60]); ui.lose('SO CLOSE!', `Best ${best} yd · goal ${goal} yd`);
  } else { ui.pop(evt === 'water' ? 'SPLASH!' : evt === 'sand' ? 'BUNKERED' : `${goal - d} yd short`, '#fff', 32, 30); }
}

input({ onDown: () => { if (state === 'play') swing(); } });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the club swings once on an off-green arrow: a short drive lands well short of the goal, and that ball is handed back
const DM = demo(null, { ready: () => state === 'play' && level === 1 && ballsLeft === 3 && sub === 'aim', wait: 1800, ms: 3000 });
let demoUsed = false, demoShot = false;
ui.onTap(() => { B.start(); build(); state = 'play'; ui.hideStart(); });

// ---------------------------------------------------------------- loop
scene.fog = new THREE.Fog('#d8f1ff', 200, 900);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const skyLow = [new THREE.Color(), new THREE.Color()], skyHigh = [new THREE.Color('#1b1450'), new THREE.Color('#3b2a8a')], tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
let lastSky = '';
loop((dt, now) => {
  t += dt / 60; const h = dt / 60;
  if (state === 'play' && sub === 'aim') {
    np += ndir * needleSpeed * h; if (np > 1) { np = 1; ndir = -1; } else if (np < 0) { np = 0; ndir = 1; }
    needle.rotation.z = lerp(A0, A1, np);
    if (DM.on && !demoUsed && ndir > 0 && np < 0.5) { const ang = lerp(A0, A1, np), q = clamp(1 - Math.abs(ang - AC) / ((A1 - A0) / 2), 0, 1);
      if (q > 0.4 && q < 0.65 && simulate(ang, q * 0.95).dist < goal * 0.8) { demoUsed = demoShot = true; swing(); } }
    club.rotation.z = lerp(club.rotation.z, -1.5 + Math.sin(t * 3) * 0.08, 0.1 * dt);   // waggle at the top of the backswing
  }
  if (sub === 'swing') {
    swingT += h; club.rotation.z = lerp(-1.5, 2.6, clamp(swingT / 0.16, 0, 1));
    if (swingT > 0.06 && b.mode === 'fly' && state === 'play') sub = 'fly';
  } else if (state === 'play' || sub === 'fly') club.rotation.z = lerp(club.rotation.z, sub === 'aim' ? club.rotation.z : 2.3, 0.05 * dt);
  if (sub === 'fly' && state === 'play') {
    flightT += h;
    const N = 5; let evt = null;
    for (let i = 0; i < N && !evt; i++) evt = step(b, h * 1.4 / N, true);
    if (b.mode === 'stop') evt = evt || 'stop';
    if (evt === 'orbit') { ui.pop('ORBIT!', '#fff', 42, 30); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(76 + s, 0.25, 0.14), i * 80)); buzz(20); shake = 0.8; }
    else if (evt === 'sling') { ui.pop('SLINGSHOT ×1.3', '#ffd23f', 38, 30); tone(300, 0.4, 'sawtooth', 0.1, 3); ui.flash(0.25); burst(scene, ball.position.clone(), ['#ffd23f', '#ffffff', '#ff5d8f'], 20, { speed: 0.8, up: 0.3, size: 3.5, gravity: 0 }); buzz(30); }
    else if (evt === 'pad') { ui.pop('BOING!', '#fff', 36, 32); tone(300, 0.2, 'sine', 0.15, 2.5); buzz(15); const pd = pads.find(p => Math.abs(p.x - b.x) < 3); if (pd && pd.top) pd.top.scale.y = 0.3; }
    else if (evt === 'bounce') { sfx.bounce(); burst(scene, ball.position.clone().setY(groundY(b.x)), [TH.lip, '#ffffff'], 8, { speed: 0.3, up: 0.25, size: 2, gravity: 0.03 }); }
    else if (evt === 'water') { burst(scene, ball.position.clone(), ['#3fb6ff', '#ffffff', '#a8e4ff'], 26, { speed: 0.35, up: 0.6, size: 2.6, gravity: 0.04 }); tone(500, 0.3, 'sine', 0.12, 0.3); }
    else if (evt === 'sand') { burst(scene, ball.position.clone(), ['#f3d58a', '#e3be6b'], 22, { speed: 0.3, up: 0.45, size: 2.4, gravity: 0.04 }); tone(160, 0.2, 'triangle', 0.12, 0.6); }
    if (flightT > 60 && b.mode !== 'stop') { b.mode = 'stop'; evt = 'stop'; }
    if (b.mode === 'stop') shotDone(evt);
    else { const d = Math.max(0, Math.round(b.x)); ui.score(d + ' yd'); ui.progress(d / goal); if (!beatenShown && D.beaten(d)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 46, 24); confetti(scene, ball.position.clone(), 50); } }
  }
  if (sub === 'done' && state === 'play') { doneT += h; if (doneT > 1.4) resetBall(); }
  for (const p of pads) if (p.top) p.top.scale.y = lerp(p.top.scale.y, 1, 0.15 * dt);
  // ball + trail
  ball.position.set(b ? b.x : 0, b ? b.y : 0, 0);
  const zoom = camD / 34; ball.scale.setScalar(clamp(zoom * 0.75, 1, 8));
  if (sub === 'fly' || sub === 'done') { if (sub === 'fly') { trailPts.push(ball.position.clone()); if (trailPts.length > TRAIL) trailPts.shift(); } }
  for (let i = 0; i < TRAIL; i++) { const p = trailPts[i]; if (!p) { _m.makeScale(0, 0, 0); } else { const k = i / TRAIL; _m.compose(p, _q, _s.setScalar(BR * ball.scale.x * (0.2 + 0.7 * k))); } trail.setMatrixAt(i, _m); }
  trail.instanceMatrix.needsUpdate = true;
  for (const p of planets) { if (p.mesh) p.mesh.rotation.y += 0.01 * dt; if (p.halo) { p.halo.material.opacity = p.used || (b && b.used && b.used.has(p)) ? 0.08 : 0.25 + Math.sin(t * 4) * 0.12; } }
  goalG.flag.rotation.y = Math.sin(t * 3) * 0.2;
  // camera: close on the tee, then follows the ball, pulling back with height and speed
  let tx, ty, td;
  if (sub === 'aim' || sub === 'swing' || !b) { tx = 1.6; ty = groundY(0) + 4.2; td = 30; }
  else {
    const sp = Math.hypot(b.vx, b.vy), orbR = b.mode === 'orbit' ? b.orb.r * 2.2 : 0;
    td = clamp(55 + Math.max(0, b.y - groundY(b.x)) * 1.15 + sp * 0.55 + orbR, 55, 420);
    tx = (b.mode === 'orbit' ? b.orb.p.x : b.x) + td * 0.1; ty = (b.mode === 'orbit' ? b.orb.p.y : b.y) * 0.85 + td * 0.12 + groundY(b.x) * 0.15;
  }
  camX = lerp(camX, tx, clamp(0.12 * dt, 0, 1)); camY = lerp(camY, ty, clamp(0.08 * dt, 0, 1)); camD = lerp(camD, td, clamp(0.05 * dt, 0, 1));
  shake = Math.max(0, shake - dt * 0.03);
  camera.position.set(camX + (Math.random() - 0.5) * shake, camY + camD * 0.16 + (Math.random() - 0.5) * shake, camD);
  camera.lookAt(camX, camY, 0);
  ensureChunks(camX, camD * 0.6 + 40);
  S.followLight(new THREE.Vector3(b ? b.x : 0, groundY(b ? b.x : 0), 0));
  // sky: blue → deep space with altitude
  const alt = clamp(((b ? b.y : 0) - 40) / 140, 0, 1);
  skyLow[0].set(TH.sky[0]); skyLow[1].set(TH.sky[1]);
  const c1 = '#' + tmpC.copy(skyLow[0]).lerp(skyHigh[0], alt).getHexString(), c2 = '#' + tmpC2.copy(skyLow[1]).lerp(skyHigh[1], alt).getHexString();
  if (c1 + c2 !== lastSky) { lastSky = c1 + c2; const bs = document.body.style; bs.setProperty('--bg1', c1); bs.setProperty('--bg2', c2); }
  stars.material.opacity = alt; scene.fog.color.set(c2); scene.fog.near = camD + 120; scene.fog.far = camD + 650; stars.position.set(camX, camY, 0);
  if (needle) fan.visible = sub === 'aim' && state === 'play' || (state === 'ready');
});

build(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return best; },
  bot() {   // tap when the arrow reaches the green, with a small human timing error
    if (state !== 'play' || sub !== 'aim' || botPending) return;
    const v = needleSpeed / 1000; let tms;
    if (ndir > 0) tms = np <= 0.5 ? (0.5 - np) / v : ((1 - np) + 0.5) / v; else tms = np >= 0.5 ? (np - 0.5) / v : (np + 0.5) / v;
    if (tms < 150) { botPending = true; const err = (Math.random() - 0.5) * (Math.random() < 0.2 ? 260 : 70); setTimeout(() => { botPending = false; swing(); }, Math.max(0, tms + err)); }
  },
};

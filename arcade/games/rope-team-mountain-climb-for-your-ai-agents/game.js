// Rope Team — a RIFFCADE "Connect your AI" original. All art is drawn in code below.
// The player's AI agents are a rope team on a giant peak. Finished tool calls climb, failures slip (the rope
// catches them), passed tests set camps, commits lay fixed ropes, deploys push for the summit. The player is the
// expedition leader: picks the line at route forks, anchors the team through gusts, spends gear points.
import { THREE, createStage, mat, rounded, stickman, burst, tone, note, loop, clamp, lerp } from './kit/hc.js';
import { agents, toolName, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const TAU = Math.PI * 2;
const dstr = d => d.toLocaleDateString('en-CA');
const today = () => dstr(new Date());
const yesterday = () => { const y = new Date(); y.setDate(y.getDate() - 1); return dstr(y); };
const fmt = n => Math.round(n).toLocaleString('en-US');
const PHONE = () => innerWidth < 640;
const now = () => performance.now();
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = s => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ peaks
const YB = -16, Y0 = 3;
const PEAKS = [
  { id: 'glacier', name: 'Glacier Peak', h: 4800, shape: 'cone', R: 30, YT: 46, turns: 1.15, th0: 0.4, rough: 1, rock: '#6c7891', rock2: '#8a95ab', snow: '#f6f9ff', ice: '#a6dcff', snowline: 0.42 },
  { id: 'spire', name: 'Desert Spire', h: 5600, shape: 'spire', R: 30, YT: 48, turns: 1.3, th0: 2.0, rough: 0.8, rock: '#c45f3a', rock2: '#e8945c', snow: '#fff3e2', ice: '#ffd0a8', snowline: 0.86 },
  { id: 'volcano', name: 'Ember Volcano', h: 6500, shape: 'volcano', R: 34, YT: 42, turns: 1.1, th0: 4.1, rough: 1.1, rock: '#3c3338', rock2: '#57474a', snow: '#e4dfe2', ice: '#ff7a3d', snowline: 0.82, lava: true },
  { id: 'tower', name: 'Ice Tower', h: 7600, shape: 'tower', R: 23, YT: 54, turns: 1.6, th0: 1.2, rough: 0.6, rock: '#5fa7dd', rock2: '#8fcdf5', snow: '#ffffff', ice: '#c9ecff', snowline: 0.3 },
  { id: 'crown', name: 'Aurora Crown', h: 8800, shape: 'crown', R: 31, YT: 50, turns: 1.4, th0: 5.0, rough: 1, rock: '#4a3f72', rock2: '#665a9e', snow: '#f4ecff', ice: '#c7a8ff', snowline: 0.5, aurora: true },
];
const FORKS = [[0.27, 0.41], [0.6, 0.74]];
const STEP = 12;                       // metres per finished step
const SHOP = [
  { id: 'o2', icon: '🫧', name: 'Oxygen bottle', about: 'Tap O₂ BOOST: the whole team climbs twice as fast for 20 s. Tokens also refill bottles.', costs: [12] },
  { id: 'cr', icon: '🦶', name: 'Crampons', about: '+6% per step and slips lose 15% less, per level.', costs: [15, 30, 55, 90, 140] },
  { id: 'tent', icon: '⛺', name: 'Expedition tents', about: 'Camps pay +2 gear and the team rests longer (×1.5 steps), per level.', costs: [12, 25, 45, 75, 120] },
  { id: 'screw', icon: '🔩', name: 'Ice screws', about: 'Wider anchor timing and gusts hurt 20% less, per level.', costs: [20, 45, 90] },
];
const COLORS = ['#ff5a5f', '#3a86ff', '#ffd23f', '#2ec4b6', '#b06bff', '#ff8fd1', '#7bd64a', '#ff9f1c', '#00d0ff', '#f4f1de'];

// ------------------------------------------------------------------ save (live and demo kept apart)
const KEYS = { live: 'agent_summit_v1', demo: 'agent_summit_demo_v1' };
const newDay = () => ({ date: today(), m: 0, moves: 0, slips: 0, camps: 0, ropes: 0, deploys: 0, summits: 0, tokens: 0, perfect: 0, agents: {}, from: null });
const freshP = () => ({ m: 0, fixed: 0, camps: [], forks: [null, null], moves: 0 });
const fresh = () => ({ peak: 0, unlocked: 1, gear: 10, o2: 1, o2g: 0, lv: { cr: 0, tent: 0, screw: 0 }, P: PEAKS.map(freshP), summits: PEAKS.map(() => 0), best: PEAKS.map(() => 0),
  life: { m: 0, moves: 0, slips: 0, camps: 0, ropes: 0, deploys: 0, summits: 0, perfect: 0, tokens: 0 }, day: newDay(), bestDay: 0, streak: 0, lastClimb: '' });
function load(m) {
  const s = fresh();
  try { const j = JSON.parse(localStorage.getItem(KEYS[m])); if (j && j.P) { Object.assign(s, j, { lv: { ...s.lv, ...j.lv }, life: { ...s.life, ...j.life }, day: { ...newDay(), ...j.day } }); while (s.P.length < PEAKS.length) s.P.push(freshP()); while (s.summits.length < PEAKS.length) { s.summits.push(0); s.best.push(0); } } } catch (e) {}
  return s;
}
let mode = 'demo', S = load('demo');
const save = () => { try { localStorage.setItem(KEYS[mode], JSON.stringify(S)); } catch (e) {} };
const PK = () => PEAKS[S.peak];
const curP = () => S.P[S.peak];

// ------------------------------------------------------------------ stage
const stage = createStage({ fov: 50, shadowSize: 14, clear: '#8fc4ff' });
const { scene, camera, renderer, sun, hemi } = stage;
scene.fog = new THREE.Fog('#bcdcff', 80, 300);

// sky dome + stars + sun / moon discs
const skyU = { top: { value: new THREE.Color('#3d7fe0') }, bot: { value: new THREE.Color('#cfe8ff') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying float vy; void main(){ vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vy; void main(){ float t = smoothstep(-0.05, 0.55, vy); gl_FragColor = vec4(mix(bot, top, t), 1.0); }' }));
scene.add(sky);
const starG = new THREE.BufferGeometry(), starP = [];
for (let i = 0; i < 900; i++) { const a = Math.random() * TAU, e = Math.random() * 1.3 + 0.08, r = 400; starP.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
starG.setAttribute('position', new THREE.Float32BufferAttribute(starP, 3));
const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
scene.add(stars);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 12), new THREE.MeshBasicMaterial({ color: '#fff4c8', fog: false }));
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 12), new THREE.MeshBasicMaterial({ color: '#eef3ff', fog: false }));
scene.add(sunDisc, moonDisc);

// cloud sea + far peaks (shared by every mountain)
const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.12 });
const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, 460);
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < clouds.count; i++) {
    const a = Math.random() * TAU, r = 26 + Math.pow(Math.random(), 0.7) * 170, sc = 3 + Math.random() * 7;
    p.set(Math.cos(a) * r, -1.5 + Math.random() * 2.5, Math.sin(a) * r); s.set(sc * 1.3, sc * 0.5, sc);
    q.setFromEuler(new THREE.Euler(0, Math.random() * TAU, 0)); m4.compose(p, q, s); clouds.setMatrixAt(i, m4);
  }
}
clouds.receiveShadow = true;
const cloudFloor = new THREE.Mesh(new THREE.CircleGeometry(460, 48), new THREE.MeshStandardMaterial({ color: '#f2f6ff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.1 }));
cloudFloor.rotation.x = -Math.PI / 2; cloudFloor.position.y = -0.6;
const cloudGroup = new THREE.Group(); cloudGroup.add(clouds, cloudFloor); scene.add(cloudGroup);
const farPeaks = new THREE.Group(); scene.add(farPeaks);
for (let i = 0; i < 14; i++) {
  const a = i / 14 * TAU + Math.random() * 0.3, r = 140 + Math.random() * 110, h = 30 + Math.random() * 45, w = 18 + Math.random() * 22;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), new THREE.MeshStandardMaterial({ color: '#7d8aa6', flatShading: true, roughness: 0.9 }));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.42, h * 0.42, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 }));
  rock.position.set(Math.cos(a) * r, h / 2 - 10, Math.sin(a) * r); cap.position.set(rock.position.x, h - 10 - h * 0.21 + 0.3, rock.position.z);
  rock.rotation.y = cap.rotation.y = Math.random() * 3; farPeaks.add(rock, cap);
}

// drifting snow
const SNOW = 700, snowPos = new Float32Array(SNOW * 3), snowV = new Float32Array(SNOW);
for (let i = 0; i < SNOW; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 60; snowPos[i * 3 + 1] = (Math.random() - 0.5) * 36; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 60; snowV[i] = 0.5 + Math.random(); }
const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.2, map: dotTex, transparent: true, opacity: 0.9, depthWrite: false }));
scene.add(snow);

// ------------------------------------------------------------------ terrain
function profile(pk, u, th) {
  const v = 1 - u;
  switch (pk.shape) {
    case 'spire': { const f = (u * 7) % 1; return pk.R * (0.55 * v ** 3 + 0.2 * v ** 0.45) * (1 + 0.09 * smooth(0.7, 0.92, f)); }
    case 'volcano': return 4.2 + (pk.R - 4.2) * v ** 1.7;
    case 'tower': return pk.R * (0.22 + 0.78 * v ** 3) * v ** 0.3;
    case 'crown': return pk.R * v ** 1.15 * (1 + 0.5 * u * u * Math.max(0, Math.sin(5 * th)));
    default: return pk.R * v ** 1.3;
  }
}
const noise = (pk, th, u) => 1 + pk.rough * (0.07 * Math.sin(5 * th + 4 * u) + 0.05 * Math.sin(9 * th - 11 * u + 1.3) + 0.035 * Math.sin(17 * th + 23 * u + 0.7) + 0.02 * Math.sin(31 * th - 37 * u));
const uOf = (pk, y) => clamp((y - YB) / (pk.YT - YB), 0, 1);
const surfR = (pk, th, y) => { const u = uOf(pk, y); return profile(pk, u, th) * noise(pk, th, u); };

function buildMountain(pk) {
  const NT = 128, NY = 76, grid = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NT; i++) {
    const th = i / NT * TAU, u = j / NY, y = YB + u * (pk.YT - YB), r = profile(pk, u, th) * noise(pk, th, u);
    grid.push([Math.cos(th) * r, y, Math.sin(th) * r, th, u]);
  }
  const pos = [], col = [], c = new THREE.Color(), A3 = new THREE.Vector3(), B3 = new THREE.Vector3(), C3 = new THREE.Vector3(), n = new THREE.Vector3();
  const rock = new THREE.Color(pk.rock), rock2 = new THREE.Color(pk.rock2), snowC = new THREE.Color(pk.snow), iceC = new THREE.Color(pk.ice);
  const tri = (a, b, d) => {
    A3.set(a[0], a[1], a[2]); B3.set(b[0], b[1], b[2]); C3.set(d[0], d[1], d[2]);
    n.subVectors(B3, A3).cross(C3.clone().sub(A3)).normalize();
    const u = (a[4] + b[4] + d[4]) / 3, th = (a[3] + b[3] + d[3]) / 3, hsh = hash(pos.length) % 1000 / 1000;
    const line = pk.snowline + 0.06 * Math.sin(7 * th + 2) + 0.04 * Math.sin(19 * th);
    const snowy = (u > line && n.y > 0.12) || u > line + 0.2;
    if (snowy) c.copy(hsh < 0.08 ? iceC : snowC).multiplyScalar(0.94 + hsh * 0.08);
    else c.copy(hsh < 0.5 ? rock : rock2).multiplyScalar(0.85 + hsh * 0.25 - (u < 0.25 ? 0.15 : 0));
    if (pk.lava && !snowy && u > 0.55 && Math.sin(3 * th + u * 4) > 0.93) c.set('#ff6a2b');
    for (const p of [A3, B3, C3]) { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); }
  };
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) {
    const a = grid[j * (NT + 1) + i], b = grid[j * (NT + 1) + i + 1], cc = grid[(j + 1) * (NT + 1) + i + 1], d = grid[(j + 1) * (NT + 1) + i];
    tri(a, d, b); tri(b, d, cc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ route
const _v = new THREE.Vector3();
function pathTh(pk, s, forks) {
  let th = pk.th0 + TAU * pk.turns * s;
  for (let k = 0; k < 2; k++) { const [a, b] = FORKS[k]; if (s > a && s < b) th += ((forks[k] || 'r') === 'c' ? -1 : 1) * 0.32 * Math.sin(Math.PI * (s - a) / (b - a)); }
  return th;
}
const CAP = { r: 2.6, h: 1.43, dy: 0.8 };
const capR = (pk, y) => { if (pk.lava) return 0; const k = (y - (pk.YT - CAP.dy)) / CAP.h; return Math.abs(k) >= 1 ? 0 : CAP.r * Math.sqrt(1 - k * k); };
function pathAt(s, out = new THREE.Vector3(), forks = curP().forks, pk = PK(), lift = 0.28) {
  s = clamp(s, 0, 1);
  const th = pathTh(pk, s, forks), y = Y0 + (pk.YT - 0.4 - Y0) * s, r = Math.max(surfR(pk, th, y), capR(pk, y)) + lift;
  return out.set(Math.cos(th) * r, y, Math.sin(th) * r);
}
let pathLen = 200, gapS = 0.01;
function measurePath() { let L = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(); pathAt(0, a); for (let i = 1; i <= 400; i++) { pathAt(i / 400, b); L += a.distanceTo(b); a.copy(b); } pathLen = L; gapS = 1.9 / L; }

// ------------------------------------------------------------------ world (rebuilt per peak)
let world = new THREE.Group(); scene.add(world);
let rvReady = false;   // set once the rival module below is initialised
let fixedMesh = null, summitFlag = null, lavaLight = null, aurora = null, campGroup = null;
const flagMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide });
function makeFlag(color, h = 1.4, w = 0.6) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 6), mat('#e8e8e8')); pole.position.y = h / 2; pole.castShadow = true;
  const fg = new THREE.PlaneGeometry(w, w * 0.6, 6, 1); fg.translate(w / 2, 0, 0);
  const f = new THREE.Mesh(fg, flagMat(color)); f.position.y = h - w * 0.3; f.castShadow = true;
  g.add(pole, f); g.flag = f; return g;
}
const wavers = [];
function makeTent(color, big = 1) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.05 * big, 1.15 * big, 0.25, 12), mat('#ffffff')); pad.position.y = -0.05; pad.receiveShadow = true;
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.8 * big, 0.95 * big, 4), mat(color, { flatShading: true })); t.rotation.y = Math.PI / 4; t.position.y = 0.55 * big; t.castShadow = true;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * big, 0.5 * big), mat('#2b2140')); door.position.set(0, 0.32 * big, 0.57 * big); door.rotation.x = -0.3;
  const f = makeFlag(color, 1.5 * big, 0.5 * big); f.position.set(0.7 * big, 0, -0.2); wavers.push(f.flag);
  g.add(pad, t, door, f); return g;
}
function placeOnRoute(obj, s, out = 0.9, face = true) {
  const p = pathAt(s, new THREE.Vector3()), th = Math.atan2(p.z, p.x), o = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
  obj.position.copy(p).addScaledVector(o, out); obj.position.y -= 0.2;
  if (face) obj.lookAt(obj.position.x + o.x, obj.position.y, obj.position.z + o.z);
}
function buildFixed() {
  if (fixedMesh) { world.remove(fixedMesh); fixedMesh.traverse(o => o.geometry && o.geometry.dispose()); fixedMesh = null; }
  const P = curP(), sF = P.fixed / PK().h; if (sF < 0.004) return;
  const pts = [], n = Math.max(8, Math.ceil(sF * 160)); fixedMesh = new THREE.Group();
  for (let i = 0; i <= n; i++) { const p = pathAt(sF * i / n, new THREE.Vector3(), P.forks, PK(), 0.42); p.y += 0.12; pts.push(p); }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 3, 0.06, 5), mat('#ff7a3d', { emissive: '#ff4a10', emissiveIntensity: 0.25 }));
  fixedMesh.add(tube);
  const pg = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), pm = mat('#c9ced8', { metalness: 0.6, roughness: 0.3 });
  for (let i = 0; i <= n; i += 4) { const peg = new THREE.Mesh(pg, pm); peg.position.copy(pts[i]); fixedMesh.add(peg); }
  world.add(fixedMesh);
}
function buildCamps() {
  if (campGroup) world.remove(campGroup);
  campGroup = new THREE.Group(); world.add(campGroup);
  for (const [m, c] of curP().camps.slice(-14)) { const t = makeTent(c); placeOnRoute(t, m / PK().h, 1.0); campGroup.add(t); }
}
function buildWorld() {
  scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  world = new THREE.Group(); scene.add(world); wavers.length = 0; lavaLight = aurora = null;
  const pk = PK(), P = curP();
  measurePath();
  world.add(buildMountain(pk));
  // route wands, couloir ice ribbons, fork signposts
  const wandG = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), wandM = mat('#2b2b38'), wflag = new THREE.PlaneGeometry(0.22, 0.14);
  const addWand = (s, br, col) => {
    const f = P.forks.map((x, k) => x || br); const p = pathAt(s, new THREE.Vector3(), f, pk, 0.55);
    const w = new THREE.Mesh(wandG, wandM); w.position.copy(p); w.position.y += 0.2; const fl = new THREE.Mesh(wflag, flagMat(col)); fl.position.set(0.11, 0.33, 0); w.add(fl); world.add(w);
  };
  for (let s = 0.01; s < 0.985; s += 0.018) {
    const inF = FORKS.findIndex(([a, b]) => s > a && s < b);
    if (inF < 0) addWand(s, 'r', '#ff4d4d'); else { if (P.forks[inF] !== 'c') addWand(s, 'r', '#ff4d4d'); }
  }
  for (let k = 0; k < 2; k++) {
    const [a, b] = FORKS[k], verts = [], idx = [], N = 50, fc = [...P.forks]; fc[k] = 'c';
    for (let i = 0; i <= N; i++) {
      const s = a + (b - a) * i / N, c = pathAt(s, new THREE.Vector3(), fc, pk, 0.06), c2 = pathAt(s + 0.002, new THREE.Vector3(), fc, pk, 0.06);
      const o = new THREE.Vector3(c.x, 0, c.z).normalize(), t = c2.sub(c).normalize(), side = new THREE.Vector3().crossVectors(t, o).normalize();
      const w = 1.1 * Math.sin(Math.PI * i / N) + 0.25;
      verts.push(...c.clone().addScaledVector(side, -w).toArray(), ...c.clone().addScaledVector(side, w).toArray());
      if (i < N) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
    const chosen = P.forks[k];
    world.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#9fe2ff', emissive: '#3aa8ff', emissiveIntensity: chosen === 'r' ? 0.05 : 0.35, roughness: 0.15, transparent: true, opacity: chosen === 'r' ? 0.45 : 0.92, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })));
    if (chosen === 'c') for (let s = a + 0.012; s < b; s += 0.018) addWand(s, 'c', '#3ad0ff');
    const sign = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat('#7a5230')); post.position.y = 0.8; sign.add(post);
    for (const [y, c, r] of [[1.35, '#3ad0ff', 0.3], [1.0, '#c98a4b', -0.3]]) { const pl = new THREE.Mesh(rounded(0.9, 0.24, 0.08, 0.04), mat(c)); pl.position.set(0, y, 0.05); pl.rotation.z = r * 0.3; pl.castShadow = true; sign.add(pl); }
    placeOnRoute(sign, a, 1.0); world.add(sign);
  }
  // base camp: two big tents, crates, the expedition banner
  const bc = new THREE.Group(); placeOnRoute(bc, 0, 0.6); world.add(bc);
  const t1 = makeTent('#ff7a3d', 1.4); t1.position.set(-1.6, 0, 0.8); const t2 = makeTent('#3a86ff', 1.2); t2.position.set(1.7, 0, 1.0);
  const crate = new THREE.Mesh(rounded(0.7, 0.5, 0.5, 0.06), mat('#c08a4a')); crate.position.set(0, 0.25, 2.2); crate.castShadow = true;
  const crate2 = crate.clone(); crate2.position.set(0.5, 0.25, 2.8); crate2.rotation.y = 0.5;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 0.6, 18), mat('#ffffff')); pad.position.y = -0.3; pad.receiveShadow = true;
  bc.add(pad, t1, t2, crate, crate2);
  buildFixed(); buildCamps();
  // summit
  if (!pk.lava) { const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(CAP.r, 2), mat(pk.snow, { flatShading: true })); cap.scale.y = CAP.h / CAP.r; cap.position.y = pk.YT - CAP.dy; cap.castShadow = cap.receiveShadow = true; world.add(cap); }
  const top = pk.lava ? new THREE.Vector3(Math.cos(pathTh(pk, 1, P.forks)) * 4.6, pk.YT, Math.sin(pathTh(pk, 1, P.forks)) * 4.6) : new THREE.Vector3(0, pk.YT - CAP.dy + CAP.h - 0.15, 0);
  summitFlag = makeFlag('#ff7a3d', 2.8, 1.3); summitFlag.position.copy(top); summitFlag.visible = S.summits[S.peak] > 0; wavers.push(summitFlag.flag); world.add(summitFlag);
  summitFlag.home = top.clone();
  if (pk.lava) {
    const lava = new THREE.Mesh(new THREE.CircleGeometry(4.6, 28), new THREE.MeshBasicMaterial({ color: '#ff5a1f' })); lava.rotation.x = -Math.PI / 2; lava.position.y = pk.YT - 1.3; world.add(lava);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.0, 1.4, 28, 1, true), mat('#2a2226', { side: THREE.DoubleSide })); wall.position.y = pk.YT - 0.6; world.add(wall);
    lavaLight = new THREE.PointLight('#ff6a2b', 60, 40, 1.6); lavaLight.position.set(0, pk.YT + 2, 0); world.add(lavaLight);
  }
  if (pk.aurora) {
    aurora = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(260, 50, 40, 1), cols = [];
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) { p.setZ(k, Math.sin(p.getX(k) * 0.03 + i) * 25); const top = p.getY(k) > 0; cols.push(...(top ? [0.5, 0.2, 0.9] : [0.2, 1, 0.6])); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.position.set(-40 + i * 40, 120 + i * 12, -160 + i * 30); m.rotation.set(0.2, i * 0.6, 0); aurora.add(m);
    }
    world.add(aurora);
  }
  for (const c of climbers.values()) { c.s = c.sT = clamp(G.teamS, 0, 1); }
  if (rvReady && RV.on) { RV.route = null; rvRoute(); }
}

// ------------------------------------------------------------------ climbers
const climbers = new Map(); let rope = [];      // rope = main climbers in clip-in order
const tagsEl = $('tags');
function colorFor(label) {
  const used = new Set([...climbers.values()].filter(c => !c.porter && c.label !== label).map(c => c.color));
  let i = hash(label) % COLORS.length; for (let k = 0; k < COLORS.length && used.has(COLORS[i]); k++) i = (i + 1) % COLORS.length;
  return COLORS[i];
}
function makeClimber(e) {
  const porter = !!e.parent;
  const parent = porter ? climbers.get(e.parent) : null;
  const color = parent ? parent.color : colorFor(e.label);
  const g = stickman(color, ['#ffd7ba', '#e0a77c', '#c58a5c', '#8d5a3b'][hash(e.agent) % 4], porter ? 0.72 : 1);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 8, 0, TAU, 0, Math.PI / 2), mat(porter ? '#ffd23f' : '#ffffff')); helmet.position.y = 1.55; helmet.castShadow = true;
  const eyeM = mat('#1b1b26'); for (const x of [-0.07, 0.07]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); ey.position.set(x, 1.5, 0.18); g.add(ey); }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff6c0', emissive: '#ffe680', emissiveIntensity: 0.2 })); lamp.position.set(0, 1.62, 0.2);
  const pack = new THREE.Mesh(porter ? rounded(0.55, 0.62, 0.38, 0.06) : rounded(0.36, 0.44, 0.22, 0.06), mat(porter ? '#c08a4a' : new THREE.Color(color).multiplyScalar(0.6)));
  pack.position.set(0, porter ? 1.12 : 1.0, porter ? -0.33 : -0.25); pack.castShadow = true;
  g.add(helmet, lamp, pack);
  if (!porter) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), mat('#4a3a2a')); shaft.position.set(0, -0.62, 0.1); shaft.rotation.x = 1.3;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), mat('#d0d6e0', { metalness: 0.7, roughness: 0.3 })); head.position.set(0, -0.6, 0.38);
    g.armR.add(shaft, head);
  }
  g.position.y = -0.1; const root = new THREE.Group(); root.add(g); scene.add(root);
  const tag = document.createElement('div'); tag.className = 'tag' + (porter ? ' porter' : ''); tag.style.setProperty('--c', color);
  tag.innerHTML = `${esc(porter ? 'porter' : e.label)}<span class="st"></span>`; tagsEl.appendChild(tag);
  const c = { id: e.agent, parent: e.parent, label: e.label, color, porter, root, g, lamp, tag, st: tag.querySelector('.st'), s: G.teamS, sT: G.teamS, swing: 0, dangle: 0, sit: false, leaving: 0, seen: e.t, moves: 0, born: now(), cheer: 0 };
  climbers.set(e.agent, c);
  if (!porter) rope.push(c.id);
  burst(scene, pathAt(c.s), color, 10, { speed: 0.08, up: 0.08, size: 0.6 });
  return c;
}
function removeClimber(c) {
  scene.remove(c.root); c.tag.remove(); climbers.delete(c.id); rope = rope.filter(id => id !== c.id);
  for (const [k, r] of ropes) if (k.includes(c.id)) { scene.remove(r.mesh); r.mesh.geometry.dispose(); ropes.delete(k); }
}
function climberFor(e) {
  let c = climbers.get(e.agent);
  if (!c) { if (e.kind === 'end') return null; c = makeClimber(e); }
  c.seen = Math.max(c.seen, e.t);
  return c;
}
const liveClimbers = () => [...climbers.values()].filter(c => !c.leaving);

// verlet ropes between consecutive roped climbers
const ropes = new Map();
const ropeMat = mat('#ff3d6e', { roughness: 0.45 });
function ropeStep(key, a, b, dt, rmat = ropeMat) {
  let r = ropes.get(key);
  const N = 12;
  if (!r) { r = { p: [], o: [], mesh: new THREE.Mesh(new THREE.BufferGeometry(), rmat) }; for (let i = 0; i < N; i++) { const q = a.clone().lerp(b, i / (N - 1)); r.p.push(q); r.o.push(q.clone()); } r.mesh.castShadow = true; scene.add(r.mesh); ropes.set(key, r); }
  const pk = PK(), rest = Math.max(a.distanceTo(b) * 1.04, 2.2) / (N - 1), wind = G.wind.clone().multiplyScalar(0.004 * (1 + G.gustAmt * 5));
  r.p[0].copy(a); r.p[N - 1].copy(b);
  for (let i = 1; i < N - 1; i++) { const p = r.p[i], o = r.o[i], vx = (p.x - o.x) * 0.97, vy = (p.y - o.y) * 0.97, vz = (p.z - o.z) * 0.97; o.copy(p); p.x += vx + wind.x * dt; p.y += vy - 0.012 * dt; p.z += vz + wind.z * dt; }
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < N - 1; i++) {
      const p1 = r.p[i], p2 = r.p[i + 1]; _v.subVectors(p2, p1); const d = _v.length() || 1e-6, diff = (d - rest) / d;
      if (d <= rest) continue;
      if (i === 0) p2.addScaledVector(_v, -diff); else if (i + 1 === N - 1) p1.addScaledVector(_v, diff); else { p1.addScaledVector(_v, diff * 0.5); p2.addScaledVector(_v, -diff * 0.5); }
    }
    for (let i = 1; i < N - 1; i++) { const p = r.p[i], th = Math.atan2(p.z, p.x), rr = Math.hypot(p.x, p.z), min = surfR(pk, th, p.y) + 0.12; if (rr < min) { p.x *= min / rr; p.z *= min / rr; } }
  }
  r.mesh.geometry.dispose(); r.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r.p), 22, 0.045, 5);
  r.alive = true;
}

// ------------------------------------------------------------------ game state (not saved)
const G = { teamS: 0, phase: 'climb', phaseT: 0, held: 0, fork: null, forkT: 0, gust: null, nextGust: now() + 30000, gustAmt: 0, wind: new THREE.Vector3(1, 0, 0.4),
  o2Until: 0, rested: 0, shake: 0, camAz: 0, camEl: 0, zoom: 1, panel: null, okCount: 0, lastStepSnd: 0, focus: new THREE.Vector3(), look: new THREE.Vector3(), camPos: new THREE.Vector3(30, 20, 30), anyInput: false };
G.teamS = curP().m / PK().h;
const inCouloir = () => { const s = curP().m / PK().h, k = FORKS.findIndex(([a, b]) => s >= a && s < b); return k >= 0 && curP().forks[k] === 'c'; };
const mult = () => (inCouloir() ? 1.7 : 1) * (now() < G.o2Until ? 2 : 1) * (G.rested > 0 ? 1.5 : 1) * (1 + 0.06 * S.lv.cr) * (mode === 'demo' ? 2 : 1);

// ------------------------------------------------------------------ HUD helpers
const feedEl = $('feed');
function feed(c, text) {
  const d = document.createElement('div'); d.style.setProperty('--c', c ? c.color : '#ffd166');
  d.innerHTML = (c ? `<b>${esc(c.porter ? 'porter' : c.label)}</b> ` : '') + text; feedEl.appendChild(d);
  while (feedEl.children.length > 6) feedEl.firstChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 7000);
}
let popT = 0, popPr = 0;
function pop(text, small = '', color = '#fff', pr = 1) {
  const t = now(); if (t - popT < 1500 && pr < popPr) return; popT = t; popPr = pr;
  $('pop').innerHTML = `<div style="color:${color};animation-duration:${pr >= 3 ? 3.2 : 1.6}s">${text}${small ? `<small>${small}</small>` : ''}</div>`;
}
function floater(c, text) {
  if (!c || !c.screen) return;
  const d = document.createElement('div'); d.className = 'fl'; d.textContent = text; d.style.left = c.screen.x + 'px'; d.style.top = (c.screen.y - 28) + 'px';
  tagsEl.appendChild(d); setTimeout(() => d.remove(), 1100);
}
let bannerT = 0;
function banner(text) { const b = $('banner'); b.textContent = text; b.hidden = false; bannerT = now() + 6000; }
const sfx = {
  step() { const t = now(); if (t - G.lastStepSnd < 110) return; G.lastStepSnd = t; tone(620 + Math.random() * 260, 0.035, 'triangle', 0.035, 0.7); },
  slip() { tone(520, 0.3, 'sawtooth', 0.04, 0.35); setTimeout(() => tone(200, 0.25, 'sine', 0.06, 2.2), 260); },
  camp() { [72, 76, 79].forEach((n, i) => setTimeout(() => note(n, 0.3, 0.07), i * 90)); },
  rope() { tone(330, 0.09, 'square', 0.03, 1.5); setTimeout(() => tone(440, 0.09, 'square', 0.03, 1.5), 90); },
  summit() { [72, 76, 79, 84, 88].forEach((n, i) => setTimeout(() => note(n, 0.45, 0.09), i * 120)); },
  pop() { tone(900 + Math.random() * 500, 0.12, 'square', 0.025, 0.3); },
  gust() { tone(160, 0.9, 'sawtooth', 0.025, 0.55); },
  ping() { note(88, 0.25, 0.06); setTimeout(() => note(83, 0.35, 0.06), 140); },
};

// ------------------------------------------------------------------ progress rules
function rollDay() {
  if (S.day.date === today()) return false;
  if (S.day.m > S.bestDay) S.bestDay = S.day.m;
  const P = curP(), camp = Math.max(0, ...P.camps.map(c => c[0]).filter(m => m <= P.m));
  const was = P.m; P.m = Math.max(P.fixed, camp);
  S.day = newDay(); S.day.from = P.m; G.teamS = P.m / PK().h; save();
  if (was > P.m + 1) toast(`New day, new summit push. Overnight the team regrouped at ${fmt(P.m)} m. Commits lay fixed ropes that keep your height.`, 7000);
  return true;
}
function addMeters(dm, anim) {
  if (dm <= 0) return;
  if (anim && (G.phase !== 'climb' || G.fork != null)) { G.held += dm; return; }
  const pk = PK(), P = curP(); let to = P.m + dm;
  for (let k = 0; k < 2; k++) {
    const a = FORKS[k][0] * pk.h;
    if (P.forks[k] == null && P.m <= a + 0.01 && to >= a) {
      if (anim) { S.day.m += a - P.m; S.life.m += a - P.m; P.m = a; G.held += to - a; openFork(k); return; }
      P.forks[k] = 'r';
    }
  }
  S.day.m += to - P.m; S.life.m += to - P.m; P.m = to;
  if (P.m >= pk.h) summit(anim);
}
function loseMeters(dm) {
  const P = curP(), k = FORKS.findIndex(([a, b]) => P.m / PK().h >= a && P.m / PK().h < b);
  const br = k >= 0 ? P.forks[k] : null;
  dm *= (br === 'c' ? 1.5 : br === 'r' ? 0.5 : 1) * (1 - 0.15 * S.lv.cr);
  const lost = Math.min(dm, Math.max(0, P.m - P.fixed)); P.m -= lost; return lost;
}
function gearUp(n) { S.gear += n; }
function addCamp(c, anim) {
  const P = curP(), last = P.camps.length ? P.camps[P.camps.length - 1][0] : -1e9;
  gearUp(4 + 2 * S.lv.tent); G.rested = 6 + 2 * S.lv.tent; S.day.camps++; S.life.camps++;
  if (Math.abs(P.m - last) < 160 || P.m < 60) { if (anim) { feed(c, '⛺ restocked camp · +gear'); floater(c, '⛺'); } return; }
  P.camps.push([P.m, c ? c.color : '#ff7a3d']); if (P.camps.length > 30) P.camps.shift();
  if (!anim) return;
  const t = makeTent(c ? c.color : '#ff7a3d'); placeOnRoute(t, P.m / PK().h, 1.0); t.scale.setScalar(0.01); t.pop = 0; campGroup.add(t); popping.push(t);
  burst(scene, t.position.clone().add(new THREE.Vector3(0, 1, 0)), [c ? c.color : '#ff7a3d', '#ffffff', '#ffd23f'], 26, { speed: 0.12, up: 0.14, size: 0.7 });
  pop('⛺ CAMP SET!', `${fmt(P.m)} m · tests passed · team rests (×1.5)`, '#ffe7b0'); sfx.camp(); feed(c, `⛺ tests passed · camp at ${fmt(P.m)} m`); G.shake = Math.max(G.shake, 0.15);
}
const popping = [];
function fixRope(c, anim) {
  const P = curP(); if (P.m <= P.fixed + 1) { gearUp(1); return; }
  P.fixed = P.m; gearUp(3); S.day.ropes++; S.life.ropes++;
  if (!anim) return;
  buildFixed(); sfx.rope(); pop('🪢 FIXED ROPES', `to ${fmt(P.m)} m · slips never fall below this`, '#ffb27a'); feed(c, `🪢 commit · fixed ropes to ${fmt(P.m)} m`);
}
function summit(anim) {
  const pk = PK(), P = curP(), i = S.peak;
  S.summits[i]++; S.day.summits++; S.life.summits++; gearUp(25);
  if (anim && rvReady && RV.on && RV.st) { RV.st.me++; rvSave(); feed(null, `🏁 you beat ${esc(RV.r.flag + ' ' + RV.r.name)} to the top of ${pk.name}`); }
  if (!S.best[i] || P.moves < S.best[i]) S.best[i] = P.moves;
  const unlockedNew = S.unlocked < PEAKS.length && i === S.unlocked - 1;
  if (unlockedNew) S.unlocked++;
  const over = Math.max(0, P.m - pk.h);
  S.P[i] = freshP();
  const next = unlockedNew ? i + 1 : i;
  if (!anim) { S.peak = next; return; }
  G.phase = 'summit'; G.phaseT = now(); G.held += over; G.next = next; G.unlockedNew = unlockedNew;
  summitFlag.visible = true; summitFlag.position.copy(summitFlag.home).y -= 3; summitFlag.rise = 0;
  sfx.summit(); G.shake = 0.6;
  pop('🚩 SUMMIT!', `${pk.name} · ${fmt(pk.h)} m${unlockedNew && next < PEAKS.length ? ` · ${PEAKS[next].name} unlocked` : ''}`, '#ffd166', 3);
  feed(null, `🚩 <b style="--c:#ffd166">SUMMIT</b> ${pk.name}!`);
}
function endSummit() {
  G.phase = 'climb'; S.peak = G.next; G.teamS = 0; buildWorld(); save();
  pop(`⛰️ ${PK().name.toUpperCase()}`, `New expedition · ${fmt(PK().h)} m`, '#fff', 3);
  const h = G.held; G.held = 0; addMeters(h, true);
}
function openFork(k) {
  G.fork = k; G.forkT = now();
  $('forkAlt').textContent = `· ${fmt(FORKS[k][0] * PK().h)} m`; $('fork').hidden = false; tone(500, 0.12, 'triangle', 0.05, 1.4);
}
function chooseFork(b) {
  if (G.fork == null) return;
  const P = curP(); P.forks[G.fork] = b; G.fork = null; $('fork').hidden = true;
  buildWorld(); save();
  pop(b === 'c' ? '❄️ COULOIR!' : '🪨 RIDGE', b === 'c' ? 'Fast and icy. Watch for gusts.' : 'Slow and steady.', b === 'c' ? '#9fe2ff' : '#ffd8a8', 2);
  if (b === 'c') G.nextGust = Math.min(G.nextGust, now() + 9000);
  const h = G.held; G.held = 0; addMeters(h, true);
}
document.querySelectorAll('#fork [data-b]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); G.anyInput = true; chooseFork(b.dataset.b); }));

// ------------------------------------------------------------------ agent events → the climb
function onAgentBatch(list, info) {
  const m = info.demo ? 'demo' : 'live';
  if (m !== mode) switchMode(m);
  rollDay();
  const anim = !info.backfill;
  const m0 = S.day.m, mv0 = S.day.moves, c0 = S.day.camps, r0 = S.day.ropes, su0 = S.life.summits;
  for (const e of list) {
    const c = e.live ? climberFor(e) : null;
    if (c) {
      if (e.kind === 'done' && !c.porter) { c.sit = true; if (anim) { banner(`👋 ${c.label} is waiting for you`); sfx.ping(); feed(c, '👋 sits on a ledge, waiting for you'); } }
      else if (e.kind === 'end') { c.leaving = c.leaving || now(); if (anim) feed(c, '📦 supplies delivered, heading down'); }
      else if (e.kind !== 'tokens') c.sit = false;
    }
    if (anim && c) animate(e, c);
    if (!e.counted) continue;
    applyEvent(e, c, anim);
  }
  if (!anim) {
    const dm = S.day.m - m0;
    if (S.day.moves - mv0 > 0) pop(`+${fmt(dm)} m`, `today so far · ${S.day.moves - mv0} steps · ${S.day.camps - c0} camps · ${S.day.ropes - r0} fixed ropes${S.life.summits > su0 ? ` · ${S.life.summits - su0} summits` : ''}`, '#ffe7b0');
    G.teamS = curP().m / PK().h; buildWorld();
  }
  if (B && mode === 'live') B.submit(S.day.m);
  save();
}
function applyEvent(e, c, anim) {
  const P = curP();
  if (e.kind === 'tokens') {
    S.day.tokens += e.tokens; S.life.tokens += e.tokens; S.o2g += e.tokens;
    if (S.o2g >= 25000) { S.o2g -= 25000; if (S.o2 < 9) { S.o2++; if (anim) feed(c, '🫧 tokens refilled an O₂ bottle'); } }
    addMeters(e.tokens / 1000 * 1.5 * mult(), anim);
    return;
  }
  if (e.kind !== 'result') return;
  if (e.ok) {
    const dm = STEP * mult(); if (G.rested > 0) G.rested--;
    P.moves++; S.day.moves++; S.life.moves++; G.okCount++;
    if (G.okCount % 10 === 0) gearUp(1);
    const lb = e.label || 'agent'; S.day.agents[lb] = S.day.agents[lb] || { moves: 0, color: c ? c.color : COLORS[hash(lb) % COLORS.length] }; S.day.agents[lb].moves++;
    if (S.lastClimb !== today()) { S.streak = S.lastClimb === yesterday() ? S.streak + 1 : 1; S.lastClimb = today(); }
    addMeters(dm, anim);
    if (e.cat === 'test') addCamp(c, anim);
    else if (e.cat === 'commit') fixRope(c, anim);
    else if (e.cat === 'deploy') { S.day.deploys++; S.life.deploys++; gearUp(10); addMeters(150 * mult(), anim); if (anim && G.phase === 'climb') { pop('🚀 SUMMIT PUSH!', 'deploy · +150 m', '#ffd166'); fireworks(3); feed(c, '🚀 deploy · summit push +150 m'); } }
    else if (e.cat === 'delegate') { gearUp(2); if (anim) feed(c, '📦 porters hired · +2 gear'); }
  } else {
    const lost = loseMeters(STEP * 2); S.day.slips++; S.life.slips++;
    if (anim && c) { c.dangle = 1; c.dangleLost = lost; }
    if (anim) { sfx.slip(); G.shake = Math.max(G.shake, 0.25); feed(c, `😱 slipped! the rope caught them${lost > 0 ? ` · −${fmt(lost)} m` : ' · fixed rope held'}`); if (c) floater(c, 'SLIP!'); }
  }
}
const ICON = { edit: '⛏️', read: '🔭', run: '⚙️', test: '🧪', commit: '🪢', deploy: '🚀', web: '📡', delegate: '📦', other: '✨' };
function animate(e, c) {
  if (e.kind === 'tool') { if (Math.random() < 0.6) floater(c, ICON[e.cat] || '✨'); c.reach = 1; }
  else if (e.kind === 'result' && e.ok) {
    c.swing = 1; c.moves++; sfx.step();
    if (c.screen) burst(scene, c.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), ['#ffffff', '#cfefff'], 5, { speed: 0.07, up: 0.06, size: 0.35 });
    if (c.moves % 8 === 0) feed(c, `⛏️ ${c.moves} steps up`);
  }
  else if (e.kind === 'prompt' && !c.porter) { floater(c, '📻'); feed(c, '📻 new orders from the leader'); }
  else if (e.kind === 'think') { if (Math.random() < 0.25) floater(c, '💭'); }
}

function switchMode(m) {
  save(); mode = m; S = load(m);
  for (const c of [...climbers.values()]) removeClimber(c);
  G.teamS = curP().m / PK().h; G.fork = null; G.phase = 'climb'; G.held = 0; G.gust = null; $('fork').hidden = true; $('anchor').hidden = true;
  rollDay(); buildWorld();
}

// ------------------------------------------------------------------ player actions
function useO2() {
  G.anyInput = true;
  if (S.o2 <= 0) { toast('No O₂ bottles. Buy one in 🎒 Gear, or let your agents burn tokens.'); return; }
  if (now() < G.o2Until) return;
  S.o2--; G.o2Until = now() + 20000; save();
  pop('🫧 O₂ BOOST!', 'whole team ×2 for 20 s', '#9fe2ff'); tone(400, 0.4, 'sine', 0.05, 2);
  for (const c of liveClimbers()) burst(scene, c.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), ['#9fe2ff', '#ffffff'], 10, { shape: 'sphere', speed: 0.05, up: 0.1, size: 0.6, gravity: -0.002 });
}
$('bO2').addEventListener('click', e => { e.stopPropagation(); useO2(); });
function startGust() {
  G.gust = { hit: now() + 2300, pressed: null, done: false }; $('anchor').hidden = false; sfx.gust();
}
function pressAnchor() {
  const g = G.gust; if (!g || g.pressed != null) return;
  G.anyInput = true; g.pressed = now(); tone(300, 0.06, 'square', 0.04, 1);
  if (g.pressed > g.hit) resolveGust();
}
function resolveGust() {
  const g = G.gust; if (!g || g.done) return; g.done = true;
  const d = g.pressed == null ? 1e9 : Math.abs(g.pressed - g.hit), wide = 1 + 0.35 * S.lv.screw;
  $('anchor').hidden = true; G.gust = null; G.gustAmt = 1.2;
  G.nextGust = now() + (inCouloir() ? 16000 + Math.random() * 12000 : 32000 + Math.random() * 24000);
  if (d < 140 * wide) { gearUp(3); S.day.perfect++; S.life.perfect++; pop('🔩 ROCK SOLID!', 'perfect anchor · +3 gear', '#9fffb0', 2); note(84, 0.3, 0.08); G.shake = 0.2; }
  else if (d < 380 * wide) { gearUp(1); pop('ANCHORED', 'the team held on · +1 gear', '#e6f6ff', 2); note(79, 0.25, 0.07); G.shake = 0.3; }
  else {
    let lost = 0; for (const c of liveClimbers()) if (!c.porter) { c.dangle = 1; }
    lost = loseMeters(STEP * 3 * (1 - 0.2 * S.lv.screw)); S.day.slips++; S.life.slips++;
    pop('💨 BLOWN OFF!', lost > 0 ? `the ropes caught everyone · −${fmt(lost)} m` : 'the fixed ropes held', '#ffb0a0', 2); sfx.slip(); G.shake = 0.7;
  }
  save();
}
$('bAnchor').addEventListener('pointerdown', e => { e.stopPropagation(); pressAnchor(); });
addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); if (G.gust) pressAnchor(); }
  if (e.key === 'o' || e.key === 'O') useO2();
});

// camera drag / zoom; tapping the scene during a gust anchors too
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { if (G.gust) { pressAnchor(); return; } drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!drag) return; G.camAz -= (e.clientX - drag.x) * 0.006; G.camEl = clamp(G.camEl + (e.clientY - drag.y) * 0.04, -3, 10); drag.x = e.clientX; drag.y = e.clientY; G.dragT = now(); });
addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('wheel', e => { G.zoom = clamp(G.zoom * (e.deltaY > 0 ? 1.08 : 0.92), 0.6, 2.2); }, { passive: true });

// ------------------------------------------------------------------ panels
function openPanel(p) { G.panel = p; $('panel').hidden = false; renderPanel(); }
function closePanel() { G.panel = null; $('panel').hidden = true; }
$('panel').addEventListener('pointerdown', e => { if (e.target === $('panel')) closePanel(); });
document.querySelector('#panel .x').onclick = closePanel;
document.querySelectorAll('#menu [data-p]').forEach(b => b.onclick = () => openPanel(b.dataset.p));
function renderPanel() {
  const el = $('pbody'), p = G.panel;
  if (p === 'gear') {
    el.innerHTML = `<h2>🎒 GEAR</h2><p>You have <b>⛏️ ${fmt(S.gear)}</b> gear points. Earn them from camps, fixed ropes, deploys, perfect anchors and summits.</p>` +
      SHOP.map(it => {
        const lvl = it.id === 'o2' ? null : S.lv[it.id], max = it.costs.length, cost = it.id === 'o2' ? it.costs[0] : it.costs[lvl];
        const dots = lvl == null ? `<span class="lv">${'🫧'.repeat(S.o2) || '—'}</span>` : `<span class="lv">${it.costs.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
        const can = it.id === 'o2' ? S.o2 < 9 && S.gear >= cost : lvl < max && S.gear >= cost;
        return `<div class="row"><div class="ic">${it.icon}</div><div><b>${it.name}</b>${dots}<small>${it.about}</small></div><button class="buy" data-buy="${it.id}" ${can ? '' : 'disabled'}>${lvl != null && lvl >= max ? 'MAX' : `⛏️ ${cost}`}</button></div>`;
      }).join('');
    el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(b.dataset.buy));
  } else if (p === 'peaks') {
    el.innerHTML = `<h2>⛰️ PEAKS</h2><p>Summit a peak to unlock the next one. Progress on each peak is kept.</p>` +
      PEAKS.map((pk, i) => {
        const lock = i >= S.unlocked, pr = S.P[i].m / pk.h;
        return `<div class="row"><div class="ic">${lock ? '🔒' : ['🏔️', '🏜️', '🌋', '🧊', '🌌'][i]}</div><div><b>${pk.name}</b> <small>${fmt(pk.h)} m · ${lock ? 'summit the peak before it' : `${Math.round(pr * 100)}% · ${S.summits[i]} summit${S.summits[i] === 1 ? '' : 's'}${S.best[i] ? ` · best ${S.best[i]} steps` : ''}`}</small></div>
          <button class="buy" data-peak="${i}" ${lock || i === S.peak ? 'disabled' : ''}>${i === S.peak ? 'CLIMBING' : 'CLIMB'}</button></div>`;
      }).join('') +
      `<h2 style="margin-top:12px;font-size:20px">🏅 RECORDS</h2><div class="grid">
        <div><b>${S.life.summits}</b><small>summits</small></div><div><b>${fmt(S.life.m)}</b><small>metres climbed</small></div><div><b>${fmt(Math.max(S.bestDay, S.day.m))}</b><small>best day (m)</small></div>
        <div><b>${S.streak}</b><small>day streak</small></div><div><b>${S.life.perfect}</b><small>perfect anchors</small></div><div><b>${S.life.slips}</b><small>slips caught</small></div></div>`;
    el.querySelectorAll('[data-peak]').forEach(b => b.onclick = () => { S.peak = +b.dataset.peak; G.teamS = curP().m / PK().h; buildWorld(); save(); closePanel(); pop(`⛰️ ${PK().name.toUpperCase()}`, 'expedition moved', '#fff'); });
  } else if (p === 'today') {
    const d = S.day, ags = Object.entries(d.agents).sort((a, b) => b[1].moves - a[1].moves);
    const pf = B && B.profile(), rk = rank();
    el.innerHTML = `<h2>📅 TODAY'S SUMMIT PUSH</h2><p>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · ${PK().name}${pf && rk ? ` · ${flag(pf.country)} #${rk} today` : ''}</p>
      <div class="grid"><div><b>${fmt(d.m)}</b><small>metres climbed</small></div><div><b>${d.moves}</b><small>steps</small></div><div><b>${d.camps}</b><small>camps set</small></div>
      <div><b>${d.ropes}</b><small>fixed ropes</small></div><div><b>${d.summits}</b><small>summits</small></div><div><b>${d.slips}</b><small>slips caught</small></div></div>
      <p style="margin:6px 0 2px">Rope team today:</p><div class="ags">${ags.length ? ags.slice(0, 10).map(([l, a]) => `<span style="--c:${a.color}">${esc(l)} · ${a.moves}</span>`).join('') : '<small style="opacity:.7">nobody yet, start an agent session</small>'}</div>
      <button class="big" id="pShare">📤 Share today's summit card</button>`;
    $('pShare').onclick = shareCard;
  }
}
function buy(id) {
  const it = SHOP.find(x => x.id === id);
  if (id === 'o2') { if (S.gear < it.costs[0] || S.o2 >= 9) return; S.gear -= it.costs[0]; S.o2++; }
  else { const l = S.lv[id]; if (l >= it.costs.length || S.gear < it.costs[l]) return; S.gear -= it.costs[l]; S.lv[id]++; }
  tone(880, 0.08, 'square', 0.04, 1.3); save(); renderPanel();
}
const rank = () => { try { return JSON.parse(localStorage.getItem('board_rank_agent-summit')); } catch (e) { return null; } };

// ------------------------------------------------------------------ share card
async function shareCard() {
  renderer.render(scene, camera);
  const src = renderer.domElement, out = document.createElement('canvas'); out.width = 1200; out.height = 630; const x = out.getContext('2d');
  const sc = Math.max(1200 / src.width, 630 / src.height) * 1.3, w = src.width * sc, h = src.height * sc;
  x.drawImage(src, (1200 - w) / 2 + 160, (630 - h) / 2, w, h);
  const gr = x.createLinearGradient(0, 0, 760, 0); gr.addColorStop(0, 'rgba(12,18,38,.94)'); gr.addColorStop(0.7, 'rgba(12,18,38,.7)'); gr.addColorStop(1, 'rgba(12,18,38,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 1200, 630);
  const d = S.day, f = (s, px, c = '#f7f3ea', wt = 800) => { x.font = `${wt} ${px}px 'Baloo 2', system-ui, sans-serif`; x.fillStyle = c; };
  f('', 26, '#ff7a3d'); x.fillText('ROPE TEAM', 56, 70);
  f('', 58); x.fillText('My AI agents today', 56, 132);
  f('', 26, '#cfe0ff', 600); x.fillText(`${PK().name} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`, 56, 172);
  const stats = [[fmt(d.m) + ' m', 'climbed'], [d.moves, 'steps'], [d.camps, 'camps'], [d.ropes, 'fixed ropes'], [d.summits, 'summits'], [d.slips, 'slips caught']];
  stats.forEach(([v, l], i) => { const cx = 56 + (i % 3) * 210, cy = 260 + Math.floor(i / 3) * 110; f('', 52); x.fillText(String(v), cx, cy); f('', 22, '#b9c6e6', 600); x.fillText(l, cx, cy + 30); });
  // altimeter
  const pr = clamp(curP().m / PK().h, 0, 1); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(56, 470, 600, 14); x.fillStyle = '#ffffff'; x.fillRect(56, 470, 600 * pr, 14);
  x.fillStyle = '#ff7a3d'; x.fillRect(56, 470, 600 * clamp(curP().fixed / PK().h, 0, 1), 14);
  f('', 22, '#fff', 700); x.fillText(`${fmt(curP().m)} m of ${fmt(PK().h)} m · ${S.life.summits} summits all time`, 56, 518);
  const ags = Object.entries(d.agents).sort((a, b) => b[1].moves - a[1].moves).slice(0, 5); let ax = 56;
  f('', 20, '#fff', 700); for (const [l, a] of ags) { const t = l.slice(0, 14), tw = x.measureText(t).width + 22; x.fillStyle = a.color; x.fillRect(ax, 548, tw, 32); x.fillStyle = '#121a33'; x.fillText(t, ax + 11, 571); ax += tw + 10; }
  const pf = B && B.profile(), rk = rank();
  if (pf && rk && mode === 'live') { f('', 30, '#ffd166'); x.textAlign = 'right'; x.fillText(`${flag(pf.country)} #${rk} today`, 1160, 70); x.textAlign = 'left'; }
  f('', 22, 'rgba(255,255,255,.75)', 700); x.textAlign = 'right'; x.fillText('riffcade.com', 1160, 600); x.textAlign = 'left';
  const blob = await new Promise(r => out.toBlob(r, 'image/png')), file = new File([blob], 'rope-team-today.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents today', text: `My AI agents climbed ${fmt(d.m)} m today on Rope Team` }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rope-team-today.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('bShare').onclick = shareCard;

// ------------------------------------------------------------------ connect
let B = null;
const A = agents({
  game: 'agent-summit', title: 'ROPE TEAM', tagline: 'Your AI agents, roped together on a giant peak.', accent: '#ff7a3d', demoAgents: 4,
  about: 'Every agent clips into the rope. Finished steps climb, failures slip (the rope catches them), passed tests set camps, commits fix ropes, deploys push for the summit. You lead: pick the route, anchor through gusts, buy gear.',
  onEvents(list, info) { B && B.onAgentEvents(list); onAgentBatch(list, info); },
});
B = board({ game: 'agent-summit', label: 'Altitude (m)', A });
window.__A = A; window.__B = B; window.__G = G;
B.onRival((evs, r) => { rivalSync(); for (const e of evs) { try { rvEvent(e, r); } catch (er) { console.warn(er); } } });
setInterval(rivalSync, 1500); setTimeout(rivalSync, 300);
Object.defineProperty(window, 'tally', { get: () => ({ mode, peak: S.peak, m: Math.round(curP().m), day: { ...S.day, agents: Object.keys(S.day.agents).length }, life: S.life, climbers: climbers.size }) });
$('bConnect').onclick = () => A.open();
$('bBoard').onclick = () => B.open();

// ------------------------------------------------------------------ the rival's rope team (live duel)
// In a live duel the rival's agents climb the same mountain on a parallel route (wands in their team colour), one
// named climber per agent. Their finished steps move them up, tests set their camps, commits fix their ropes,
// deploys are their summit pushes, failures make them slip. A live camera window follows them; the altimeter shows both.
const RTH = 0.42, RCAP = 5;
const RVERB = { edit: 'edits', read: 'reads the map', run: 'runs a step', test: 'passes tests', commit: 'commits', deploy: 'deploys', web: 'radios for weather', delegate: 'hires a porter', other: 'finishes a step' };
const RV = { r: null, key: '', on: false, st: null, cl: new Map(), route: null, ticker: [], hudT: 0 };
const rcam = new THREE.PerspectiveCamera(42, 1.6, 0.1, 600);
const rvEl = document.createElement('div'); rvEl.id = 'rv'; rvEl.hidden = true;
rvEl.innerHTML = `<div class="rvh"><span class="rvn"></span><span class="rvs"></span></div><div class="rvv"><div class="rvo">😴 offline · their team is resting</div></div><div class="rvk"></div><div class="rvr"></div>`;
document.body.appendChild(rvEl);
const rvView = rvEl.querySelector('.rvv');
rvReady = true;
const altRv = document.createElement('div'); altRv.id = 'altRv'; altRv.hidden = true; $('alti').appendChild(altRv);
const rvLine = document.createElement('div'); rvLine.id = 'rvLine'; rvLine.hidden = true; $('peakBox').appendChild(rvLine);
const rvCol = () => RV.r ? (RV.r.sim ? '#c9ced8' : RV.r.color) : '#c9ced8';
const rvRopeMat = mat('#c9ced8', { roughness: 0.45 });
function rPathAt(s, out = new THREE.Vector3(), lift = 0.28) {
  s = clamp(s, 0, 1); const pk = PK(), th = pathTh(pk, s, ['r', 'r']) + RTH * (1 - smooth(0.9, 1, s)), y = Y0 + (pk.YT - 0.4 - Y0) * s;
  const rr = Math.max(surfR(pk, th, y), capR(pk, y)) + lift; return out.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
}
const rvLoad = key => {
  try { const j = JSON.parse(localStorage.getItem('agent_summit_rival')); if (j && j.key === key) return j; } catch (e) {}
  const L = mode === 'live' ? S : load('live'); return { key, peak: L.peak, m: L.P[L.peak].m, fixed: 0, camps: [], me: 0, them: 0 };
};
const rvSave = () => { if (RV.st) try { localStorage.setItem('agent_summit_rival', JSON.stringify(RV.st)); } catch (e) {} };
function rvRoute() {   // the rival's line up the mountain: wands with their team-colour flags, their camps
  if (!RV.on) return;
  if (RV.route) world.remove(RV.route);
  const g = new THREE.Group(), col = rvCol(), fm = flagMat(col), wm = mat('#2b2b38'), wg = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), fg = new THREE.PlaneGeometry(0.26, 0.16);
  for (let s = 0.02; s < 0.97; s += 0.022) { const p = rPathAt(s, new THREE.Vector3(), 0.55), w = new THREE.Mesh(wg, wm); w.position.copy(p); w.position.y += 0.2; const f = new THREE.Mesh(fg, fm); f.position.set(0.13, 0.33, 0); w.add(f); g.add(w); }
  for (const m of (RV.st.camps || []).slice(-RCAP)) g.add(rvTent(m, col));
  world.add(g); RV.route = g;
}
function rvTent(m, col) { const t = makeTent(col, 0.85), p = rPathAt(m / PK().h), th = Math.atan2(p.z, p.x), o = new THREE.Vector3(Math.cos(th), 0, Math.sin(th)); t.position.copy(p).addScaledVector(o, 0.9); t.position.y -= 0.2; t.lookAt(t.position.x + o.x, t.position.y, t.position.z + o.z); return t; }
function rvClimber(a) {
  let c = RV.cl.get(a.k); if (c) return c;
  const col = rvCol(), g = stickman(col, ['#ffd7ba', '#e0a77c', '#c58a5c', '#8d5a3b'][hash(a.k) % 4], 1);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 8, 0, TAU, 0, Math.PI / 2), mat(RV.r && RV.r.sim ? '#eef1f6' : new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.45))); helmet.position.y = 1.55; helmet.castShadow = true;
  const eyeM = mat('#1b1b26'); for (const x of [-0.07, 0.07]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); ey.position.set(x, 1.5, 0.18); g.add(ey); }
  const pack = new THREE.Mesh(rounded(0.36, 0.44, 0.22, 0.06), mat(new THREE.Color(col).multiplyScalar(0.6))); pack.position.set(0, 1.0, -0.25); pack.castShadow = true;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), mat('#4a3a2a')); shaft.position.set(0, -0.62, 0.1); shaft.rotation.x = 1.3; g.armR.add(shaft);
  g.add(helmet, pack); g.position.y = -0.1;
  const root = new THREE.Group(); root.add(g); scene.add(root);
  const tag = document.createElement('div'); tag.className = 'tag rvtag'; tag.style.setProperty('--c', col);
  tag.innerHTML = `<span class="rf"></span><span class="nm"></span><small>${a.src === 'codex' ? 'Codex' : 'Claude'}</small><span class="st"></span>`;
  tag.querySelector('.nm').textContent = a.name; tag.querySelector('.rf').textContent = RV.r ? RV.r.flag : '';
  tagsEl.appendChild(tag);
  c = { k: a.k, name: a.name, root, g, tag, st: tag.querySelector('.st'), s: RV.st.m / PK().h, sT: 0, swing: 0, dangle: 0, sit: false, born: now(), state: a.state, i: 0 };
  RV.cl.set(a.k, c); return c;
}
function rvRemove(c) { scene.remove(c.root); c.tag.remove(); RV.cl.delete(c.k); }
function rvClear() { for (const c of [...RV.cl.values()]) rvRemove(c); if (RV.route) world.remove(RV.route); RV.route = null; for (const [k, r] of ropes) if (k.startsWith('R:')) { scene.remove(r.mesh); r.mesh.geometry.dispose(); ropes.delete(k); } }
function rivalSync() {
  const r = B && B.rival ? B.rival() : null;
  RV.r = r;
  if (!r) { if (RV.on) { RV.on = false; rvClear(); rvEl.hidden = altRv.hidden = rvLine.hidden = true; stage.autoRender = true; document.body.classList.remove('rv-on'); } return; }
  const ck = r.sim ? 'sim' : r.color;
  if (!RV.on || RV.key !== r.key || RV.ck !== ck) {
    rvClear(); RV.on = true; RV.key = r.key; RV.ck = ck; RV.st = rvLoad(r.key); RV.ticker = [];
    rvEl.hidden = altRv.hidden = rvLine.hidden = false; stage.autoRender = false; document.body.classList.add('rv-on'); rvRoute();
  }
  if (RV.st.peak !== S.peak) { RV.st.peak = S.peak; RV.st.m = curP().m; RV.st.fixed = 0; RV.st.camps = []; rvSave(); rvRoute(); rvSay(`New race on ${PK().name}`); }
  rvEl.style.setProperty('--rc', rvCol()); altRv.style.setProperty('--rc', rvCol()); rvLine.style.setProperty('--rc', rvCol());
  const seen = new Set();
  (r.agents || []).slice(0, 5).forEach((a, i) => { seen.add(a.k); const c = rvClimber(a); c.i = i; c.state = a.state; });
  for (const [k, c] of RV.cl) if (!seen.has(k)) rvRemove(c);
  rvView.classList.toggle('off', !r.sim && !r.online);
  rvHud();
}
function rvSay(s, bad) { RV.ticker.unshift({ s, bad, t: Date.now() }); RV.ticker.splice(4); rvHud(); }
function rfeed(name, text) {
  const r = RV.r; if (!r) return;
  const d = document.createElement('div'); d.style.setProperty('--c', rvCol());
  d.innerHTML = `<b>${r.flag} ${esc(r.name)}'s ${esc(name)}</b> ${text}`; feedEl.appendChild(d);
  while (feedEl.children.length > 6) feedEl.firstChild.remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 7000);
}
function rvHud() {
  const r = RV.r; if (!r || !RV.st) return;
  const ags = r.agents || [], pk = PK(), them = RV.st.m, me = curP().m, d = me - them;
  rvEl.querySelector('.rvn').textContent = `${r.flag} ${r.name}'s rope team`;
  rvEl.querySelector('.rvs').textContent = r.sim ? `${ags.length} climbers · simulated` : r.online ? `🟢 ${ags.filter(a => a.state === 'working').length}/${ags.length} climbing` : '😴 offline';
  const tk = RV.ticker[0], k = rvEl.querySelector('.rvk');
  k.textContent = tk && Date.now() - tk.t < 20000 ? tk.s : (ags.length ? ags.map(a => a.name).join(' · ') : 'no climbers on the rope right now');
  k.classList.toggle('bad', !!(tk && tk.bad && Date.now() - tk.t < 20000));
  rvEl.querySelector('.rvr').innerHTML = `<b>${fmt(them)} m</b><span>${Math.abs(d) < 1 ? 'level with you' : d > 0 ? `${fmt(d)} m below you` : `${fmt(-d)} m above you`}</span><small>⚡ ${r.myScore}–${r.score}${RV.st.me || RV.st.them ? ` · summits ${RV.st.me}–${RV.st.them}` : ''}</small>`;
  rvLine.innerHTML = `⚔️ vs ${r.flag} <b></b> · ${fmt(them)} m ${d >= 0 ? '<i class="w">you lead</i>' : '<i class="l">they lead</i>'}`; rvLine.querySelector('b').textContent = r.name;
  altRv.style.bottom = clamp(them / pk.h, 0, 1) * 100 + '%'; altRv.textContent = r.flag;
}
function rvAdd(dm) {
  const pk = PK(), st = RV.st; st.m += dm;
  if (st.m >= pk.h) {
    st.them++; st.m = 0; st.fixed = 0; st.camps = []; rvRoute();
    pop(`🚩 ${RV.r.flag} ${RV.r.name.toUpperCase()} SUMMITS!`, `their rope team topped ${pk.name} first · they start again from the base`, rvCol(), 2);
    rvSay(`${RV.r.name}'s team summits ${pk.name}!`); fireworks(2);
  }
}
// one of the rival's agents finished a step
function rvEvent(e, r) {
  const c = RV.cl.get(e.agent.k); if (!c || !RV.st) return;
  const st = RV.st, name = c.name;
  if (!e.ok) {
    const lost = Math.min(STEP * 2, Math.max(0, st.m - st.fixed)); st.m -= lost; c.dangle = 1;
    rvSay(`${name} slipped! ${lost > 0 ? `−${fmt(lost)} m` : 'their fixed rope held'}`, true); rfeed(name, `😱 slipped${lost > 0 ? ` · −${fmt(lost)} m` : ' · fixed rope held'}`);
  } else {
    c.swing = 1; rvAdd(STEP);
    if (e.cat === 'test') { st.camps = [...(st.camps || []), st.m].slice(-RCAP); if (RV.route) RV.route.add(rvTent(st.m, rvCol())); rvSay(`${name} passes tests: camp at ${fmt(st.m)} m`); rfeed(name, `⛺ passes tests · camp at ${fmt(st.m)} m`); }
    else if (e.cat === 'commit') { st.fixed = st.m; rvSay(`${name} commits: fixed ropes to ${fmt(st.m)} m`); rfeed(name, `🪢 commits · fixed ropes to ${fmt(st.m)} m`); }
    else if (e.cat === 'deploy') { rvAdd(150); rvSay(`${name} deploys: summit push +150 m!`); rfeed(name, '🚀 deploys · summit push +150 m'); toast(`🚀 ${r.flag} ${r.name}'s ${name} deployed: their team pushes +150 m`, 3000); const lead = [...RV.cl.values()][0]; if (lead) burst(scene, lead.root.position.clone().add(new THREE.Vector3(0, 2, 0)), [rvCol(), '#ffffff', '#ffd23f'], 30, { speed: 0.14, up: 0.16, size: 0.7 }); }
    else if (Math.random() < 0.3) rvSay(`${name} ${RVERB[e.cat] || RVERB.other} · +${STEP} m`);
  }
  rvSave(); rvHud();
}
// per frame: move the rival climbers along their route, rope them, render the main view and their camera window
function rvFrame(dt, t) {
  if (!RV.on) return;
  const r = RV.r, off = r && !r.sim && !r.online, pk = PK(), list = [...RV.cl.values()].sort((a, b) => a.i - b.i);
  list.forEach((c, idx) => {
    c.sT = clamp(RV.st.m / pk.h - idx * gapS, 0, 1); const ds = c.sT - c.s; c.s += ds * Math.min(1, 0.06 * dt);
    const p = rPathAt(c.s, tmp), th = Math.atan2(p.z, p.x), out = tmp2.set(Math.cos(th), 0, Math.sin(th)), rt = c.root, g = c.g;
    rt.position.copy(p);
    const ahead = rPathAt(Math.min(1, c.s + 0.004), new THREE.Vector3()).sub(p).setY(0).normalize();
    const sit = off || c.state === 'waiting' || c.state === 'idle';
    const look = sit ? out.clone() : ahead.multiplyScalar(0.8).addScaledVector(out, -0.6); rt.lookAt(rt.position.x + look.x, rt.position.y, rt.position.z + look.z);
    g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.position.y = -0.1;
    if (c.dangle > 0) {
      c.dangle -= 0.012 * dt; const k = Math.sin(c.dangle * Math.PI); rt.position.y -= 1.6 * k; rt.position.addScaledVector(out, 0.7 * k);
      g.rotation.z = Math.sin(t * 9) * 0.5 * k; g.armL.rotation.set(0, 0, -2.6); g.armR.rotation.set(0, 0, 2.6); c.st.textContent = ' 😱';
    } else if (sit) {
      g.position.y = -0.55; g.legL.rotation.set(-1.45, 0, 0); g.legR.rotation.set(-1.45, 0, 0); g.armL.rotation.set(0, 0, 0);
      g.armR.rotation.set(0, 0, c.state === 'waiting' && !off ? 2.5 + Math.sin(t * 8) * 0.35 : 0.2); rt.position.addScaledVector(out, 0.45);
      c.st.textContent = off ? ' 😴' : c.state === 'waiting' ? ' 👋' : ' ☕';
    } else {
      g.armL.rotation.set(0, 0, 0); g.armR.rotation.set(0, 0, 0); g.legL.rotation.set(0, 0, 0); g.legR.rotation.set(0, 0, 0);
      g.run(t * 0.55, Math.abs(ds) * pathLen > 0.05 ? 0.7 : 0.08); g.armL.rotation.x = -1.2;
      if (c.swing > 0) { c.swing -= 0.06 * dt; const k = 1 - c.swing; g.armR.rotation.x = k < 0.35 ? lerp(0, -2.7, k / 0.35) : lerp(-2.7, -0.4, (k - 0.35) / 0.65); }
      c.st.textContent = '';
    }
    rt.scale.setScalar(Math.min(1, (now() - c.born) / 400));
  });
  for (let i = 0; i < list.length - 1; i++) { const a = list[i].root.position.clone(), b = list[i + 1].root.position.clone(); a.y += 0.85; b.y += 0.85; ropeStep('R:' + list[i].k + '|' + list[i + 1].k, a, b, dt, rvRopeMat); }
  rvRopeMat.color.set(rvCol());
  // the main view (its tags are placed by the main loop), then the camera window on their lead climber
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.render(scene, camera);
  const lead = list[0], focus = lead ? lead.root.position.clone() : rPathAt(RV.st.m / pk.h, new THREE.Vector3());
  if (list.length > 1) focus.lerp(list[list.length - 1].root.position, 0.3);
  RV.focus = RV.focus ? RV.focus.lerp(focus, 0.08 * dt) : focus.clone();
  const rc = rvView.getBoundingClientRect();
  if (rc.width > 10 && !rvEl.hidden) {
    const asp = rc.width / rc.height; if (Math.abs(rcam.aspect - asp) > 0.001) { rcam.aspect = asp; rcam.updateProjectionMatrix(); }
    const fth = Math.atan2(RV.focus.z, RV.focus.x), fr = Math.hypot(RV.focus.x, RV.focus.z), az = fth + 0.2 + Math.sin(t * 0.09) * 0.06, D = 6.6;
    rcam.position.set(Math.cos(az) * (fr + D), RV.focus.y + 2.2, Math.sin(az) * (fr + D)); rcam.lookAt(RV.focus.x, RV.focus.y + 0.9, RV.focus.z);
    const y = innerHeight - rc.bottom;
    renderer.setScissorTest(true); renderer.setViewport(rc.left, y, rc.width, rc.height); renderer.setScissor(rc.left, y, rc.width, rc.height);
    renderer.render(scene, rcam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  }
  // rival name tags: in the main view when they are on screen, otherwise inside their window
  for (const c of list) {
    const base = c.root.position.clone(); base.y += 2.15;
    tmp.copy(base).project(camera);
    let x, y, vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
    if (vis) { x = (tmp.x + 1) / 2 * innerWidth; y = (1 - tmp.y) / 2 * innerHeight; if (x > rc.left && x < rc.right && y > rc.top && y < rc.bottom) vis = false; }
    if (!vis) { tmp.copy(base).project(rcam); if (tmp.z < 1 && Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1) { x = rc.left + (tmp.x + 1) / 2 * rc.width; y = rc.top + (1 - tmp.y) / 2 * rc.height; vis = true; } }
    c.tag.style.display = vis ? '' : 'none'; c.scr = vis ? { x, y } : null;
  }
  const placed = [];   // nudge overlapping rival tags upward so every callsign stays readable
  for (const c of list.filter(c => c.scr).sort((a, b) => b.scr.y - a.scr.y)) {
    if (!c.tw || Math.random() < 0.01) { c.tw = c.tag.offsetWidth || 70; c.th = c.tag.offsetHeight || 20; }
    let y = c.scr.y;
    for (let pass = 0; pass < 4; pass++) { let hit = false; for (const o of placed) if (Math.abs(o.x - c.scr.x) < (o.w + c.tw) / 2 + 2 && Math.abs(o.y - y) < c.th + 1) { y = o.y - c.th - 1; hit = true; } if (!hit) break; }
    placed.push({ x: c.scr.x, y, w: c.tw }); c.tag.style.transform = `translate(${c.scr.x}px,${y}px) translate(-50%,-100%)`;
  }
  if ((RV.hudT += dt / 60) > 1) { RV.hudT = 0; rvHud(); }
}

// ------------------------------------------------------------------ sky by the real clock
const KEY = [ // hour, sky top, horizon, sun colour, sun int, hemi int, night
  [0, '#0b1230', '#1d2b55', '#8fa8ff', 0.35, 0.45, 1], [5, '#16204a', '#3b3f72', '#9fb0ff', 0.4, 0.5, 0.9], [6.5, '#5d74c8', '#ffb98a', '#ffc28a', 1.0, 0.85, 0.25],
  [8, '#3d82e8', '#cfe8ff', '#fff2dc', 1.6, 1.1, 0], [16.5, '#3d82e8', '#d6ecff', '#fff2dc', 1.6, 1.1, 0], [18.5, '#5a5fb8', '#ff9a6a', '#ffab70', 1.1, 0.85, 0.2],
  [20, '#1f2a62', '#6a4a86', '#a8b4ff', 0.5, 0.55, 0.75], [24, '#0b1230', '#1d2b55', '#8fa8ff', 0.35, 0.45, 1]];
const cA = new THREE.Color(), cB = new THREE.Color();
let hourNow = 12;
function skyTick() {
  const d = new Date(); hourNow = Q.has('hour') ? +Q.get('hour') : d.getHours() + d.getMinutes() / 60;
  let i = 0; while (i < KEY.length - 2 && KEY[i + 1][0] <= hourNow) i++;
  const a = KEY[i], b = KEY[i + 1], t = clamp((hourNow - a[0]) / (b[0] - a[0]), 0, 1);
  skyU.top.value.copy(cA.set(a[1])).lerp(cB.set(b[1]), t); skyU.bot.value.copy(cA.set(a[2])).lerp(cB.set(b[2]), t);
  sun.color.copy(cA.set(a[3])).lerp(cB.set(b[3]), t); sun.intensity = lerp(a[4], b[4], t); hemi.intensity = lerp(a[5], b[5], t);
  const night = lerp(a[6], b[6], t);
  hemi.color.set(night > 0.5 ? '#9fb3ff' : '#ffffff'); hemi.groundColor.set(night > 0.5 ? '#2a3360' : '#ffe8f0');
  scene.fog.color.copy(skyU.bot.value); renderer.setClearColor(skyU.bot.value);
  stars.material.opacity = night; cloudMat.emissiveIntensity = 0.12 - night * 0.1;
  const el = Math.sin((hourNow - 6) / 12 * Math.PI), az = (hourNow - 6) / 12 * Math.PI;
  const sd = new THREE.Vector3(Math.cos(az) * 0.8, Math.max(0.15, el), 0.6).normalize();
  sunDisc.position.copy(sd).multiplyScalar(360); sunDisc.visible = el > -0.05;
  const md = new THREE.Vector3(-0.6, 0.55, -0.6).normalize(); moonDisc.position.copy(md).multiplyScalar(360); moonDisc.visible = night > 0.3;
  G.lightDir = el > 0.05 ? sd : md; G.night = night;
  for (const c of climbers.values()) c.lamp.material.emissiveIntensity = 0.2 + night * 2.5;
  if (aurora) aurora.children.forEach(m => m.material.opacity = 0.12 + night * 0.4);
}
skyTick(); setInterval(skyTick, 30000);

// ------------------------------------------------------------------ main loop
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const sparks = [];
function fireworks(n = 1) {
  for (let i = 0; i < n; i++) setTimeout(() => {
    const base = summitFlag && G.phase === 'summit' ? summitFlag.home : (G.focus || tmp);
    const p = base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 6 + Math.random() * 8, (Math.random() - 0.5) * 14));
    const col = new THREE.Color().setHSL(Math.random(), 1, 0.6);
    for (let k = 0; k < 36; k++) {
      const m = new THREE.Mesh(SPARK, new THREE.MeshBasicMaterial({ color: col, transparent: true, fog: false })); m.position.copy(p); scene.add(m);
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.18 + Math.random() * 0.12); sparks.push({ m, v, life: 1 });
    }
    sfx.pop();
  }, i * 260);
}
const SPARK = new THREE.SphereGeometry(0.14, 6, 4);
let lastT = now(), gustLeanT = 0;
loop((dt, t) => {
  const T = now(), pk = PK(), P = curP();
  // phases
  if (G.phase === 'summit') {
    const e = (T - G.phaseT) / 1000;
    if (summitFlag) { summitFlag.rise = Math.min(1, (summitFlag.rise || 0) + 0.02 * dt); summitFlag.position.y = summitFlag.home.y - 3 * (1 - summitFlag.rise) ** 2; }
    if (Math.random() < 0.08 * dt) fireworks(1);
    if (e > 7.5) endSummit();
  }
  const targetS = G.phase === 'summit' ? 1 : P.m / pk.h;
  G.teamS = lerp(G.teamS, targetS, 0.045 * dt);
  // fork auto-choose
  if (G.fork != null) { const f = (T - G.forkT) / 12000; $('forkBar').style.width = (100 - f * 100) + '%'; if (f >= 1) chooseFork('r'); }
  // gusts
  const L = liveClimbers();
  if (!G.gust && G.phase === 'climb' && G.fork == null && !G.panel && L.some(c => !c.porter) && T > G.nextGust && !(A.connected.length === 0 && !A.demo)) startGust();
  if (G.gust) {
    const left = G.gust.hit - T, sc = 1 + 1.7 * Math.max(0, left / 2300);
    document.querySelector('#anchor .ring').style.transform = `scale(${sc})`;
    G.gustAmt = Math.max(G.gustAmt, clamp(1 - left / 2300, 0, 1) * 0.8);
    if (G.gust.pressed != null && T >= G.gust.hit) resolveGust();
    else if (T > G.gust.hit + 380 * (1 + 0.35 * S.lv.screw)) resolveGust();
  } else G.gustAmt = Math.max(0, G.gustAmt - 0.012 * dt);
  G.wind.set(Math.cos(t * 0.05), 0, Math.sin(t * 0.05));
  // climbers
  const main = rope.map(id => climbers.get(id)).filter(Boolean);
  let idx = 0;
  for (const c of main) {
    if (c.leaving) continue;
    c.sT = clamp(G.teamS - idx * gapS, 0, 1); idx++;
  }
  const kids = {};
  for (const c of climbers.values()) if (c.porter) {
    const par = climbers.get(c.parent); const k = (kids[c.parent] = (kids[c.parent] || 0) + 1);
    c.sT = clamp((par ? par.s : G.teamS - idx * gapS) - gapS * 0.55 * k, 0, 1);
  }
  const quietMs = 12 * 60e3, sitMs = 25 * 60e3, nowMs = Date.now();
  for (const c of [...climbers.values()]) {
    if (!c.leaving && nowMs - c.seen > (c.sit ? sitMs : quietMs)) c.leaving = T;
    if (c.leaving && T - c.leaving > 1800) { removeClimber(c); continue; }
    const ds = c.sT - c.s; c.s += ds * Math.min(1, 0.06 * dt);
    const moving = Math.abs(ds) * pathLen > 0.05;
    const p = pathAt(c.s, tmp), th = Math.atan2(p.z, p.x), out = tmp2.set(Math.cos(th), 0, Math.sin(th));
    const r = c.root; r.position.copy(p);
    if (c.porter) r.position.addScaledVector(out, 0.55);
    if (G.phase === 'summit' && c.s > 0.97 && summitFlag) {   // gather round the flag on the summit
      const all = [...climbers.values()], i = all.indexOf(c), a = i / all.length * TAU + 0.6, rr = pk.lava ? 0 : 1.25;
      const ring = new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr).add(summitFlag.home);
      if (!pk.lava) { ring.y = summitFlag.home.y - 0.2; r.position.lerpVectors(p, ring, smooth(0.97, 1, c.s)); }
    }
    const g = c.g;
    // facing: into the slope while climbing, out to the valley while sitting
    const ahead = pathAt(Math.min(1, c.s + 0.004), new THREE.Vector3()).sub(p).setY(0).normalize();
    const look = c.sit ? out.clone() : ahead.multiplyScalar(0.8).addScaledVector(out, -0.6);
    r.lookAt(r.position.x + look.x, r.position.y, r.position.z + look.z);
    g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1); g.position.y = -0.1;
    if (c.dangle > 0) {
      c.dangle -= 0.012 * dt; const k = Math.sin(c.dangle * Math.PI);
      r.position.y -= 1.6 * k; r.position.addScaledVector(out, 0.7 * k);
      g.rotation.z = Math.sin(t * 9) * 0.5 * k; g.rotation.x = 0.3 * k;
      g.armL.rotation.set(0, 0, -2.6 + Math.sin(t * 20) * 0.4); g.armR.rotation.set(0, 0, 2.6 + Math.cos(t * 20) * 0.4);
      g.legL.rotation.set(Math.sin(t * 18) * 0.8, 0, 0); g.legR.rotation.set(-Math.sin(t * 18) * 0.8, 0, 0);
      c.st.textContent = ' 😱';
    } else if (c.sit) {
      g.position.y = -0.55; g.legL.rotation.set(-1.45, 0, 0); g.legR.rotation.set(-1.45, 0, 0);
      g.armL.rotation.set(0, 0, 0); g.armR.rotation.set(0, 0, 2.5 + Math.sin(t * 8) * 0.35);
      r.position.addScaledVector(out, 0.45); c.st.textContent = ' 👋';
    } else {
      g.armL.rotation.set(0, 0, 0); g.armR.rotation.set(0, 0, 0); g.legL.rotation.set(0, 0, 0); g.legR.rotation.set(0, 0, 0);
      g.run(t * 0.55, moving ? 0.7 : 0.08);
      if (!c.porter) g.armL.rotation.x = -1.2 + Math.sin(t * 2 + c.born) * 0.1;
      if (c.swing > 0) {
        c.swing -= 0.06 * dt; const k = 1 - c.swing;
        g.armR.rotation.x = k < 0.35 ? lerp(0, -2.7, k / 0.35) : lerp(-2.7, -0.4, (k - 0.35) / 0.65);
        const sq = c.swing > 0.6 ? 1 - (c.swing - 0.6) * 0.3 : 1; g.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
      } else if (c.porter) { g.armL.rotation.x = g.armR.rotation.x = -0.4; }
      if (G.gustAmt > 0.3) { g.rotation.z = Math.sin(t * 6 + c.born) * 0.12 * G.gustAmt; g.rotation.x = 0.25 * G.gustAmt; }
      c.st.textContent = now() < G.o2Until ? ' 🫧' : '';
    }
    if (c.leaving) { const k = 1 - (T - c.leaving) / 1800; r.scale.setScalar(Math.max(0.01, k)); }
    else r.scale.setScalar(Math.min(1, (T - c.born) / 400));
    // name tag
    tmp.copy(r.position); tmp.y += c.porter ? 1.6 : 2.15; tmp.project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
    c.screen = vis ? { x: (tmp.x + 1) / 2 * innerWidth, y: (1 - tmp.y) / 2 * innerHeight } : null;
    c.tag.style.display = vis ? '' : 'none';
    c.tag.classList.toggle('wait', c.sit && !c.porter);
  }
  // name tags: nudge overlapping ones upward so every label stays readable
  const shown = [...climbers.values()].filter(c => c.screen).sort((a, b) => b.screen.y - a.screen.y), placed = [];
  for (const c of shown) {
    if (!c.tw || Math.random() < 0.01) { c.tw = c.tag.offsetWidth || 60; c.th = c.tag.offsetHeight || 20; }
    let y = c.screen.y;
    for (let pass = 0; pass < 4; pass++) { let hit = false; for (const o of placed) if (Math.abs(o.x - c.screen.x) < (o.w + c.tw) / 2 + 2 && Math.abs(o.y - y) < (o.h + c.th) / 2 + 1) { y = o.y - (o.h + c.th) / 2 - 2; hit = true; } if (!hit) break; }
    placed.push({ x: c.screen.x, y, w: c.tw, h: c.th });
    c.tag.style.transform = `translate(${c.screen.x}px,${y}px) translate(-50%,-100%)`;
  }
  // ropes
  for (const r of ropes.values()) r.alive = false;
  const roped = main.filter(c => !c.leaving);
  for (let i = 0; i < roped.length - 1; i++) {
    const a = roped[i].root.position.clone(), b = roped[i + 1].root.position.clone(); a.y += 0.85; b.y += 0.85;
    ropeStep(roped[i].id + '|' + roped[i + 1].id, a, b, dt);
  }
  for (const [k, r] of ropes) if (!r.alive && !(RV.on && k.startsWith('R:') && RV.cl.size > 1)) { scene.remove(r.mesh); r.mesh.geometry.dispose(); ropes.delete(k); }
  // tents popping in, flags waving
  for (let i = popping.length - 1; i >= 0; i--) { const o = popping[i]; o.pop += 0.04 * dt; const k = o.pop; o.scale.setScalar(k >= 1 ? 1 : Math.max(0.01, 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2)); if (k >= 1) { o.scale.setScalar(1); popping.splice(i, 1); } }
  for (const f of wavers) { f.rotation.y = Math.sin(t * 3 + f.id) * 0.35 * (1 + G.gustAmt); f.scale.y = 1 + Math.sin(t * 7 + f.id) * 0.05; }
  // sparks
  for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.v.y -= 0.003 * dt; s.v.multiplyScalar(0.985); s.m.position.addScaledVector(s.v, dt); s.life -= 0.016 * dt; s.m.material.opacity = s.life; if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); sparks.splice(i, 1); } }
  // lava + smoke
  if (lavaLight) { lavaLight.intensity = 50 + Math.sin(t * 3) * 15; if (Math.random() < 0.15 * dt) burst(scene, new THREE.Vector3((Math.random() - 0.5) * 4, pk.YT, (Math.random() - 0.5) * 4), ['#5a5258', '#7a7076', '#3a3236'], 1, { shape: 'sphere', speed: 0.02, up: 0.05, size: 4, gravity: -0.0006, life: 1 }); }
  if (aurora) aurora.children.forEach((m, i) => { m.position.x = -40 + i * 40 + Math.sin(t * 0.2 + i) * 10; });
  // snow drift
  const sp = snowGeo.attributes.position.array, ws = 0.03 + G.gustAmt * 0.35;
  for (let i = 0; i < SNOW; i++) {
    sp[i * 3] += (G.wind.x * ws + Math.sin(t + i) * 0.004) * snowV[i] * dt; sp[i * 3 + 1] -= (0.02 + G.gustAmt * 0.03) * snowV[i] * dt; sp[i * 3 + 2] += G.wind.z * ws * snowV[i] * dt;
    for (let a = 0; a < 3; a++) { const lim = a === 1 ? 18 : 30; if (sp[i * 3 + a] > lim) sp[i * 3 + a] -= lim * 2; else if (sp[i * 3 + a] < -lim) sp[i * 3 + a] += lim * 2; }
  }
  snowGeo.attributes.position.needsUpdate = true;
  cloudGroup.rotation.y += 0.00025 * dt; farPeaks.rotation.y += 0.00004 * dt;
  // camera
  const lead = roped[0];
  const focus = G.phase === 'summit' ? summitFlag.home.clone().add(new THREE.Vector3(0, 0.5, 0)) : lead ? lead.root.position.clone() : pathAt(clamp(G.teamS, 0, 1), new THREE.Vector3());
  if (roped.length > 1 && G.phase !== 'summit') focus.lerp(roped[roped.length - 1].root.position, 0.3);
  G.focus.lerp(focus, 0.06 * dt);
  snow.position.copy(G.focus);
  const fth = Math.atan2(G.focus.z, G.focus.x), fr = G.phase === 'summit' ? 0 : Math.hypot(G.focus.x, G.focus.z);
  const idle = !roped.length && G.phase !== 'summit';
  if (!drag && G.dragT && T - G.dragT > 6000) { G.camAz *= 0.99; G.camEl *= 0.99; }
  let D = (PHONE() ? 15 : 10.5) * G.zoom, az = fth + 0.55 + G.camAz + Math.sin(t * 0.07) * 0.12, h = 3.2 + G.camEl;
  if (G.phase === 'summit') { D = 13 * G.zoom; az = t * 0.3; h = 4; }
  else if (idle) { D = 22 * G.zoom; az = fth + 0.35 + Math.sin(t * 0.08) * 0.35 + G.camAz; h = 6; }
  const want = tmp.set(Math.cos(az) * (fr + D), G.focus.y + h, Math.sin(az) * (fr + D));
  G.camPos.lerp(want, 0.04 * dt);
  camera.position.copy(G.camPos);
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - 0.02 * dt); }
  G.look.lerp(tmp2.copy(G.focus).add(up), 0.08 * dt); camera.lookAt(G.look);
  sun.position.copy(G.focus).addScaledVector(G.lightDir || up, 40); sun.target.position.copy(G.focus); sun.shadow.camera.far = 90;
  // HUD
  hud(L, roped);
  rvFrame(dt, t);
});

let hudT = 0;
function hud(L, roped) {
  const T = now(); if (T - hudT < 120) return; hudT = T;
  const pk = PK(), P = curP(), dispM = G.phase === 'summit' ? pk.h : P.m;
  $('pkName').textContent = pk.name.toUpperCase(); $('pkBadge').textContent = S.summits[S.peak] ? `🚩×${S.summits[S.peak]}` : '';
  $('alt').textContent = fmt(dispM); $('altMax').textContent = fmt(pk.h);
  const sub = !roped.length ? 'Waiting for your rope team' : `${roped.length} climber${roped.length > 1 ? 's' : ''}${L.length > roped.length ? ` + ${L.length - roped.length} porter${L.length - roped.length > 1 ? 's' : ''}` : ''}${inCouloir() ? ' · ❄️ couloir' : ''}${G.rested > 0 ? ' · ⛺ rested' : ''}`;
  $('sub').textContent = sub;
  $('gear').textContent = fmt(S.gear); $('todayM').textContent = fmt(S.day.m);
  const pf = B && B.profile(), rk = rank(); const rc = $('rankChip'); if (pf && rk && mode === 'live') { rc.hidden = false; rc.textContent = `${flag(pf.country)} #${rk}`; } else rc.hidden = true;
  $('altFill').style.height = clamp(dispM / pk.h, 0, 1) * 100 + '%'; $('altRope').style.height = clamp(P.fixed / pk.h, 0, 1) * 100 + '%';
  $('altMe').style.bottom = clamp(dispM / pk.h, 0, 1) * 100 + '%'; $('altMe').style.background = roped[0] ? roped[0].color : '#ff7a3d';
  const marks = P.camps.map(c => `<span class="m" style="bottom:${c[0] / pk.h * 100}%">⛺</span>`).concat(FORKS.map(([a], k) => `<span class="m" style="bottom:${a * 100}%;left:-18px">${P.forks[k] === 'c' ? '❄️' : P.forks[k] === 'r' ? '🪨' : '⑂'}</span>`)).join('');
  if ($('altMarks').dataset.k !== marks) { $('altMarks').innerHTML = marks; $('altMarks').dataset.k = marks; }
  const boosting = T < G.o2Until;
  $('o2n').textContent = boosting ? Math.ceil((G.o2Until - T) / 1000) + 's' : '×' + S.o2;
  $('o2bar').style.width = boosting ? ((G.o2Until - T) / 200) + '%' : (S.o2g / 250) + '%';
  $('bO2').classList.toggle('off', S.o2 <= 0 && !boosting);
  $('idle').hidden = !!roped.length || !$('anchor').hidden || !document.querySelector('.ag-card[hidden]');
  if (bannerT && T > bannerT) { $('banner').hidden = true; bannerT = 0; }
  if (T - (G.saveT || 0) > 5000) { G.saveT = T; rollDay() && buildWorld(); }
}

buildWorld();
G.focus.copy(pathAt(G.teamS)); G.look.copy(G.focus); G.camPos.copy(G.focus).add(new THREE.Vector3(30, 10, 30));

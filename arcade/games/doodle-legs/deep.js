// Doodle Legs — original game. Scribble a shape in the pad: it becomes the spinning legs of your cube.
// Big legs vault walls and stairs, tiny legs fit under low roofs. Redraw any time. Beat three rivals to the flag.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, glossy, clamp, lerp, note } from './kit/hc.js';
import { makeRacer, setShape, step, course, floorAt, HALF } from './physics.js';
import { LEVELS, WORLDS, buildCourse, dailySpec, touchGem, HATS } from './levels.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';

const OMEGA = -2 * Math.PI * 0.9;            // player motor (rad/s, negative = forward)
const LANE_Z = [0, -1.75, -3.5, -5.25], LANE_D = 1.0;
const LANE_COLS = [['#ffc21a', '#ff8a1e'], ['#ff7a5c', '#ff4d6d'], ['#ffa94d', '#ff6b3d'], ['#ff8fb1', '#ff5d8f']];
const CUBE_COLS = ['#1e9bff', '#3ccf5a', '#ff4fa3', '#9b62ff'];
const NAMES = ['Mia', 'Leo', 'Zoe', 'Kai', 'Noa', 'Ava', 'Max', 'Ivy', 'Rex', 'Lua', 'Tom', 'Sky', 'Bo', 'Nia', 'Ray', 'Eva'];
const BGS = [['#8f9cf7', '#e9b9f4'], ['#7fb6ff', '#c7f0ff'], ['#ff9ec7', '#ffd9a8'], ['#8ad8c8', '#e2f7c9'], ['#a99cff', '#ffc2e2']];

const stage = createStage({ fov: 40, shadowSize: 9 });
const { scene, camera, renderer, sun } = stage;
const save = store('doodlelegs2');   // v2 progress is its own (v1 levels were a random pool)
const DAY = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
let stars = save.get('stars', {}), level = save.get('level', 1), wins = save.get('wins', 0), state = 'ready', hat = save.get('hat', 0), bonus = save.get('bonus', 0), isDaily = false;
let goldOrb = null, lookK = '', feverB = 0, cur = level, spec = null, gemMeshes = [], gemsGot = 0, fits = 0, falls = 0, raceClock = 0, stuckKind = '', feverT = 0;
const streak = () => save.get('streak', { last: 0, n: 0 });
const total = () => Object.values(stars).reduce((a, b) => a + b, 0) + bonus;
const hatsOpen = () => Math.min(HATS.length, 1 + Math.floor(total() / 4));
const F = flow('doodlelegs');
const WB = worldBoard({ game: 'doodle-legs', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });
const ui = createUI({ title: 'DOODLE<br>LEGS', hint: 'Tap the pad for legs, or draw your own. Race!', hand: '✍️', score: false });

// ---------------------------------------------------------------- shared assets
const tileGeo = new THREE.BoxGeometry(1, 1, 1);
const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.02 });
const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.02, transparent: true });
let roof = null;
const legMat = glossy('#17171f', { roughness: 0.32 });
const cubeGeo = rounded(0.64, 0.64, 0.64, 0.09);
const hubGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.06, 18).rotateX(Math.PI / 2);
const gold = glossy('#ffcf2e', { metalness: 0.35, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.2 });
function crownMesh() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.12, 14, 1, true), gold); band.material.side = THREE.DoubleSide; g.add(band);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.15, 6), gold); const a = i / 5 * Math.PI * 2; c.position.set(Math.cos(a) * 0.19, 0.12, Math.sin(a) * 0.19); g.add(c); }
  g.traverse(o => o.castShadow = true); return g;
}
function checkerTex(n = 8) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), s = 128 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? '#1d1d28' : '#ffffff'; x.fillRect(i * s, j * s, s, s); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
}
const CHECK = checkerTex();

// sparkles in the sky (one draw call)
const sparkG = new THREE.BufferGeometry(), SPN = 90, sparkP = new Float32Array(SPN * 3);
for (let i = 0; i < SPN; i++) { sparkP[i * 3] = Math.random() * 40 - 20; sparkP[i * 3 + 1] = Math.random() * 22 - 6; sparkP[i * 3 + 2] = -8 - Math.random() * 10; }
sparkG.setAttribute('position', new THREE.BufferAttribute(sparkP, 3));
const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.fillRect(30, 4, 4, 56); x.fillRect(4, 30, 56, 4); return new THREE.CanvasTexture(c); })();
const sparks = new THREE.Points(sparkG, new THREE.PointsMaterial({ size: 0.38, map: sparkTex, transparent: true, depthWrite: false, opacity: 0.85 }));
scene.add(sparks);

// ---------------------------------------------------------------- world build
let C, world = new THREE.Group(), racers = [], tiles, finishX = 0, raceOn = false, raceT = 0, lastRank = 1, stuckT = 0, nudged = false, endT = 0;
scene.add(world);

function buildTrack() {
  const list = [], roofList = [];
  for (let L = 0; L < LANE_Z.length; L++) {
    const cols = LANE_COLS[L];
    for (const q of C.rects) {
      const W = q.x1 - q.x0, H = q.y1 - q.y0, ceil = q.kind === 'ceil';
      const ts = ceil ? 0.62 : 0.5, nx = Math.max(1, Math.round(W / ts)), ny = Math.max(1, Math.round(H / (ceil ? 0.62 : 0.6)));
      const w = W / nx, h = H / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const gi = Math.round((q.x0 + i * w) / 0.5);   // global index keeps the checker continuous across rects
        const col = ceil ? ((i + j) % 2 ? '#c4c6d8' : '#f4f4fb') : ((gi + j) % 2 ? cols[1] : cols[0]);
        (ceil && L === 0 ? roofList : list).push([q.x0 + (i + 0.5) * w, q.y0 + (j + 0.5) * h, LANE_Z[L], w, h, ceil ? LANE_D + 0.3 : LANE_D, col]);
      }
    }
  }
  tiles = new THREE.InstancedMesh(tileGeo, tileMat, list.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach(([x, y, z, w, h, d, c], i) => { m.makeScale(w, h, d); m.setPosition(x, y, z); tiles.setMatrixAt(i, m); tiles.setColorAt(i, col.set(c)); });
  tiles.castShadow = true; tiles.receiveShadow = true; world.add(tiles);
  // the roof over YOUR lane goes see-through while you're under it
  roof = new THREE.InstancedMesh(tileGeo, roofMat, Math.max(1, roofList.length)); roof.count = roofList.length;
  roofList.forEach(([x, y, z, w, h, d, c], i) => { m.makeScale(w, h, d); m.setPosition(x, y, z); roof.setMatrixAt(i, m); roof.setColorAt(i, col.set(c)); });
  roof.castShadow = true; roof.receiveShadow = true; world.add(roof);
  // finish: checkered strip on every lane + a banner gate
  const top = floorAt(C, finishX + 0.5);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, LANE_Z.length * 1.75), new THREE.MeshStandardMaterial({ map: CHECK.clone(), roughness: 0.6 }));
  strip.material.map.repeat.set(1, 10); strip.material.map.needsUpdate = true;
  strip.position.set(finishX + 0.35, top + 0.02, -2.6); strip.receiveShadow = true; world.add(strip);
  const postM = mat('#ffffff'), postG = new THREE.CylinderGeometry(0.09, 0.09, 3.4, 12);
  for (const z of [0.75, -6.0]) { const p = new THREE.Mesh(postG, postM); p.position.set(finishX + 0.35, top + 1.7 - BEAMD, z); p.castShadow = true; world.add(p); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 6.75), new THREE.MeshStandardMaterial({ map: CHECK.clone(), roughness: 0.5 }));
  banner.material.map.repeat.set(1, 11); banner.material.map.needsUpdate = true;
  banner.position.set(finishX + 0.35, top + 3.1, -2.62); banner.castShadow = true; world.add(banner);
}
const BEAMD = 0.0;

function makeRacerView(i) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const cube = new THREE.Mesh(cubeGeo, glossy(CUBE_COLS[i], { roughness: 0.28 })); cube.castShadow = true; body.add(cube);
  const face = new THREE.Group(); body.add(face);   // tiny eyes on the camera side
  for (const ex of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat('#ffffff')); e.position.set(ex + 0.08, 0.1, 0.32); const p = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 6), mat('#14141c')); p.position.set(0.012, 0, 0.04); e.add(p); face.add(e); }
  for (const z of [0.35, -0.35]) { const hub = new THREE.Mesh(hubGeo, glossy(CUBE_COLS[i])); hub.position.z = z; body.add(hub); }
  const legs = new THREE.Group(); g.add(legs);
  const crown = crownMesh(); crown.position.y = 0.45; crown.visible = false; body.add(crown);
  return { g, body, cube, legs, crown };
}

function setLegs(R, pts) {
  for (const c of [...R.view.legs.children]) { R.view.legs.remove(c); c.geometry.dispose(); }
  if (pts.length < 2) return;
  const v = pts.map(([x, y]) => new THREE.Vector3(x, y, 0));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, Math.min(220, v.length * 3), 0.068, 8, false);
  for (const z of [0.42, -0.42]) {
    const t = new THREE.Mesh(geo, legMat); t.position.z = z; t.castShadow = true; R.view.legs.add(t);
    for (const end of [v[0], v[v.length - 1]]) { const cap = new THREE.Mesh(CAP, legMat); cap.position.set(end.x, end.y, z); R.view.legs.add(cap); }
  }
  // axle rods from the cube faces to the legs
  for (const z of [0.38, -0.38]) { const rod = new THREE.Mesh(ROD, legMat); rod.position.z = z; R.view.legs.add(rod); }
  R.view.legs.scale.setScalar(0.2); R.pop = 1;
}
const CAP = new THREE.SphereGeometry(0.068, 10, 8), ROD = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10).rotateX(Math.PI / 2);

// ---------------------------------------------------------------- hats (worn by your cube) and gems
const HAT_COL = { cap: '#3a86ff', party: '#ff5d8f', bow: '#ff4fa3', antenna: '#3ccf5a', tophat: '#2b2b3a', halo: '#ffe36b', horns: '#e0364a', flower: '#ffd23f', phones: '#7b5cff', wizard: '#5b3fd0', prop: '#ff8a1e' };
function hatMesh(name) {
  const g = new THREE.Group(), c = HAT_COL[name] || '#fff', M = () => glossy(c, { roughness: 0.35 });
  const add = (geo, x, y, z = 0, m = M()) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  if (name === 'cap') { add(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.02); add(new THREE.BoxGeometry(0.3, 0.04, 0.26), 0.2, 0.03); }
  else if (name === 'party') { add(new THREE.ConeGeometry(0.17, 0.42, 12), 0, 0.2); add(new THREE.SphereGeometry(0.05, 8, 6), 0, 0.43, 0, mat('#fff36b')); }
  else if (name === 'bow') { for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.12, 0.2, 10).rotateZ(sx * Math.PI / 2), sx * 0.12, 0.06); add(new THREE.SphereGeometry(0.06, 8, 6), 0, 0.06); }
  else if (name === 'antenna') { add(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), 0, 0.18, 0, mat('#555')); add(new THREE.SphereGeometry(0.07, 10, 8), 0, 0.38); }
  else if (name === 'tophat') { add(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), 0, 0.02); add(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 16), 0, 0.17); add(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 16), 0, 0.08, 0, mat('#ff5d8f')); }
  else if (name === 'halo') { add(new THREE.TorusGeometry(0.2, 0.025, 8, 24).rotateX(Math.PI / 2), 0, 0.24, 0, glossy(c, { emissive: '#aa8800', emissiveIntensity: 0.4 })); }
  else if (name === 'horns') { for (const sx of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.07, 0.26, 8), sx * 0.2, 0.15); h.rotation.z = -sx * 0.4; } }
  else if (name === 'flower') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.SphereGeometry(0.07, 8, 6), Math.cos(a) * 0.1, 0.1 + Math.sin(a) * 0.1, 0.05, mat('#ff8fb1')); } add(new THREE.SphereGeometry(0.06, 8, 6), 0, 0.1, 0.06); }
  else if (name === 'phones') { add(new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI), 0, 0.0, 0, mat('#222')); for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12).rotateZ(Math.PI / 2), sx * 0.31, 0.0); g.position.y = -0.02; }
  else if (name === 'wizard') { add(new THREE.ConeGeometry(0.2, 0.55, 12), 0, 0.27); add(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 16), 0, 0.02); add(new THREE.SphereGeometry(0.04, 8, 6), 0.05, 0.3, 0.18, mat('#ffe36b')); }
  else if (name === 'prop') { add(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), 0, 0.08, 0, mat('#555')); const b = new THREE.Group(); b.position.y = 0.17; g.add(b); for (const sx of [-1, 1]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.07), M()); bl.position.x = sx * 0.11; b.add(bl); } g.userData.spin = b; }
  g.position.y += 0.32; return g;
}
let hatView = null;
function wearHat() {
  const R = racers[0]; if (!R) return;
  if (hatView) { hatView.parent && hatView.parent.remove(hatView); hatView = null; }
  const name = HATS[Math.min(hat, hatsOpen() - 1)];
  if (!name || name === 'none') return;
  hatView = hatMesh(name); R.view.body.add(hatView);
}
const gemGeo = new THREE.OctahedronGeometry(0.2, 0), gemMat = glossy('#43e0ff', { metalness: 0.3, roughness: 0.15, emissive: '#0a6ea8', emissiveIntensity: 0.55 });

// ---------------------------------------------------------------- shapes (world units, around the axle)
const SH = {
  circle: (r, n = 26, wob = 0) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI * 2, rr = r * (1 + wob * Math.sin(a * 3)); return [Math.cos(a) * rr, Math.sin(a) * rr]; }),
  U: (w, h) => Array.from({ length: 21 }, (_, i) => { const a = Math.PI + i / 20 * Math.PI; return [Math.cos(a) * w / 2, Math.sin(a) * h + h / 2]; }).reverse().map(([x, y]) => [x, -y]),
  L: (s) => [[-s * 0.3, s * 0.6], [-s * 0.3, -s * 0.5], [s * 0.6, -s * 0.5]],
  Z: (s) => [[-s / 2, s / 2], [s / 2, s / 2], [-s / 2, -s / 2], [s / 2, -s / 2]],
  line: (L) => [[-L / 2, 0.05], [L / 2, -0.05]],
};
const BIG = [() => SH.U(2.4, 1.4), () => SH.L(2.1), () => SH.Z(1.9), () => SH.U(2.2, 1.6)];
const SMALL = [() => SH.circle(0.45), () => SH.U(1.0, 0.6), () => SH.circle(0.42, 22, 0.12)];
const centre = (pts) => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } const cx = (a + b) / 2, cy = (c + d) / 2; return pts.map(([x, y]) => [x - cx, y - cy]); };

function giveShape(R, pts) {
  const p = centre(pts);
  setShape(R.sim, p, C.rects); setLegs(R, p);
  R.sq = 0.55; if (R.me) { shake = Math.max(shake || 0, 0.12); tone(330, 0.09, 'triangle', 0.12, 2.2); }
  if (R.me) { sfx.pick(3); buzz(12); burst(scene, new THREE.Vector3(R.sim.x, R.sim.y, LANE_Z[R.lane] + 0.5), ['#ffffff', '#fff36b'], 10, { speed: 0.07, up: 0.06, size: 0.5, shape: 'sphere' }); }
  R.stuck = 0; R.lastX = R.sim.x;
}

// ---------------------------------------------------------------- level
const HINT = { wall: '🧱 draw a BIG loop', chicane: '🧱 BIG loop, then ⚪ small', tunnel: '🕳️ draw a SMALL circle', gap: '🌉 BIG loop bridges the gap', stairs: '🪜 any legs climb', step: '🪜 any legs climb' };
const hintFor = (sp) => { if (!sp) return ''; const f = C && C.features && (C.features.find(f => HINT[f.kind] && f.kind !== 'stairs' && f.kind !== 'step') || C.features.find(f => HINT[f.kind])); return f ? HINT[f.kind] : '✏️ draw legs'; };
const lossN = {};
function startLevel() {
  world.remove(...world.children); racers.forEach(R => R.tag && R.tag.remove());
  if (tiles) { tiles.dispose(); }
  spec = isDaily ? dailySpec(DAY()) : cur <= LEVELS.length ? LEVELS[cur - 1] : { ...dailySpec(cur * 977 + 5), p: 'endless road', rv: Math.min(0.88, 0.76 + (cur - 30) * 0.004) };
  const W = isDaily ? WORLDS[DAY() % 3] : WORLDS[Math.min(2, Math.floor((cur - 1) / 10))];
  document.body.style.setProperty('--bg1', W.bg[0]); document.body.style.setProperty('--bg2', W.bg[1]); document.body.style.setProperty('--ui', W.ui);
  C = buildCourse(spec); finishX = C.finish;
  buildTrack();
  gemMeshes = C.gems.map((g) => { const m = new THREE.Mesh(gemGeo, gemMat); m.position.set(g.x, g.y, LANE_Z[0]); m.castShadow = true; m.userData.g = g; world.add(m); return m; });
  goldOrb = null;
  if (isDaily || cur % 3 === 2) { const gx = finishX * 0.55, gy = floorAt(C, gx) + 0.9; const gm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), glossy('#ffd23d', { metalness: 0.5, roughness: 0.1, emissive: '#ff9a00', emissiveIntensity: 0.9 })); gm.position.set(gx, gy, LANE_Z[0]); world.add(gm); goldOrb = gm; }
  feverB = 0; window.__pf = 0; gemsGot = 0; fits = 0; falls = 0; raceClock = 0; lookK = ''; stuckKind = ''; feverT = 0; C.features.forEach((f) => { f.hit = false; });
  const r = rng((isDaily ? DAY() : cur) * 131 + 7), fk = F.k(), names = NAMES.slice().sort(() => r() - 0.5);
  racers = [];
  for (let i = 0; i < LANE_Z.length; i++) {
    const sim = makeRacer(-3.2, floorAt(C, -3.2) + HALF + 0.02), view = makeRacerView(i);
    const R = { sim, view, lane: i, me: i === 0, name: i ? names[i] : 'YOU', omega: OMEGA, stuck: 0, lastX: sim.x, done: false, pop: 0, contactT: 0, sq: 0 };
    if (!R.me) {
      R.omega = OMEGA * Math.min(0.97, (spec.rv + r() * 0.04) * fk) * (1 - 0.05 * Math.min(3, Math.max(0, (lossRun[isDaily ? 'd' : cur] || 0) - 2)));
      R.ai = { think: (0.5 + r() * 0.6) / fk, wait: 0.4 + r() * 0.9, mode: '', bigI: Math.floor(r() * BIG.length), smallI: Math.floor(r() * SMALL.length), dumb: r() < 0.35 / fk };
      R.tag = document.createElement('div'); R.tag.className = 'tag'; R.tag.innerHTML = `<i style="background:${CUBE_COLS[i]}"></i>${R.name}`; document.body.appendChild(R.tag);
      giveShape(R, (R.ai.dumb ? SMALL : BIG)[R.ai.bigI % (R.ai.dumb ? SMALL.length : BIG.length)]());
    }
    view.g.position.set(sim.x, sim.y, LANE_Z[i]); world.add(view.g); racers.push(R);
  }
  racers[0].view.legs.clear();
  ui.levels(cur); ui.progress(0); ui.pill(''); ui.sub((spec.hard ? '👑 BOSS RACE · ' : '') + hintFor(spec)); wearHat();
  raceOn = false; raceT = 0; lastRank = 1; stuckT = 0; nudged = false; endT = 0; botDraw = null; botMode = ''; botBig = 0;
  clearInk(); hint.style.opacity = 1; ghostT = 0;
  // bar markers for rivals
  const bar = ui.els.top.querySelector('.hc-bar'); bar.querySelectorAll('b').forEach(b => b.remove());
  for (let i = 1; i < racers.length; i++) { const b = document.createElement('b'); b.style.background = CUBE_COLS[i]; bar.appendChild(b); racers[i].mark = b; }
  const cam = racers[0].sim; camPos.set(cam.x + 0.2, cam.y + 4.4, 12.5); camLook.set(cam.x + 1.3, cam.y - 0.6, -2.2);
}

// ---------------------------------------------------------------- drawing pad
const pad = document.getElementById('pad'), ink = document.getElementById('ink'), ictx = ink.getContext('2d'), hint = document.getElementById('padHint');
let stroke = null, padRect = null, ghostT = 0, lastScribble = 0;
function fitPad() { padRect = pad.getBoundingClientRect(); ink.width = padRect.width * Math.min(2, devicePixelRatio); ink.height = padRect.height * Math.min(2, devicePixelRatio); ictx.setTransform(ink.width / padRect.width, 0, 0, ink.height / padRect.height, 0, 0); }
addEventListener('resize', fitPad); fitPad();
function clearInk() { ictx.clearRect(0, 0, padRect.width, padRect.height); }
function drawInk(pts, alpha = 1) {
  ictx.globalAlpha = alpha; ictx.strokeStyle = '#111118'; ictx.lineWidth = 9; ictx.lineCap = ictx.lineJoin = 'round';
  ictx.beginPath(); pts.forEach(([x, y], i) => i ? ictx.lineTo(x, y) : ictx.moveTo(x, y)); if (pts.length === 1) ictx.lineTo(pts[0][0] + 0.1, pts[0][1]); ictx.stroke(); ictx.globalAlpha = 1;
}
const inPad = (x, y) => padRect && x > padRect.left && x < padRect.right && y > padRect.top && y < padRect.bottom;
const K = () => 3.8 / padRect.width;   // world units per pad pixel
function commitStroke(pts) {
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (len < 18) return false;
  const k = K(), w = pts.map(([x, y]) => [x * k, -y * k]);
  // thin the stroke a bit (finger jitter) before it becomes geometry
  const thin = [w[0]]; for (const p of w) { const l = thin[thin.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.06) thin.push(p); }
  if (thin.length < 2) thin.push(w[w.length - 1]);
  giveShape(racers[0], thin);
  { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, y] of thin) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
    const sz = Math.max(b - a, d - c), small = sz < 0.95, nf = C.features.find(f => f.x1 > racers[0].sim.x), ok = !nf || (nf.kind === 'tunnel' ? small : (nf.kind === 'wall' || nf.kind === 'chicane' || nf.kind === 'gap') ? sz >= nf.h * 1.6 : true);
    if (raceOn) ui.pop(small ? '⚪ SMALL LEGS · SQUEEZE' : sz > 1.9 ? '⭕ HUGE LEGS · BRIDGE' : '🔵 BIG LEGS · CLIMB', ok ? '#bff7c8' : '#ffd0a0', 24, 18); }
  { let a2 = 1e9, b2 = -1e9, c2 = 1e9, d2 = -1e9; for (const [x, y] of thin) { a2 = Math.min(a2, x); b2 = Math.max(b2, x); c2 = Math.min(c2, y); d2 = Math.max(d2, y); }
    const sz2 = Math.max(b2 - a2, d2 - c2), e0 = thin[0], e1 = thin[thin.length - 1], closed = Math.hypot(e0[0] - e1[0], e0[1] - e1[1]) < sz2 * 0.3;
    note(70 + Math.min(14, Math.round(sz2 * 5)) + (closed ? 5 : 0), 0.16, 0.13);
    if (closed && sz2 > 0.5 && raceOn) { ui.pop(['ROUND!', 'NICE LOOP!', 'SMOOTH!'][(Math.random() * 3) | 0], '#fff36b', 26, 14); }
    pad.classList.remove('snap'); void pad.offsetWidth; pad.classList.add('snap'); }
  if (!raceOn) { raceOn = true; ui.pop('GO!', '#fff', 64, 30); tone(660, 0.12, 'triangle', 0.14, 1.4); }
  hint.style.opacity = 0; pad.classList.remove('nudge'); nudged = false; stuckT = 0;
  return true;
}
input({
  onDown(e) { if (state !== 'play' || !inPad(e.clientX, e.clientY)) return; botDraw = null; stroke = [[e.clientX - padRect.left, e.clientY - padRect.top]]; clearInk(); drawInk(stroke); pad.classList.add('hot'); hint.style.opacity = 0; },
  onMove(dx, dy, e) {
    if (!stroke) return; const p = [clamp(e.clientX - padRect.left, 4, padRect.width - 4), clamp(e.clientY - padRect.top, 4, padRect.height - 4)];
    const l = stroke[stroke.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2.5) return; stroke.push(p); clearInk(); drawInk(stroke);
    liveSize();
    const now = performance.now(); if (now - lastScribble > 55) { lastScribble = now; tone(260 + Math.random() * 140, 0.035, 'triangle', 0.035, 0.8); }
  },
  onUp(e, st) {
    if (!stroke) return; pad.classList.remove('hot'); hideLive();
    let plen = 0; for (let i = 1; i < stroke.length; i++) plen += Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]);
    if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12 && plen < 30) tapDraw();   // a tap draws ready-made legs (round in tunnels, else wheel / hook in turn)
    else if (!commitStroke(stroke)) { clearInk(); if (!raceOn) hint.style.opacity = 1; }
    stroke = null;
  },
});

// live shape feedback while drawing: SMALL / BIG / HUGE, green when it suits the next obstacle
let liveEl = null;
function liveSize() {
  if (!stroke || stroke.length < 6) return;
  if (!liveEl) { liveEl = document.createElement('div'); liveEl.style.cssText = 'position:absolute;left:0;right:0;top:4px;text-align:center;font:900 15px system-ui,sans-serif;letter-spacing:1px;pointer-events:none;text-shadow:0 1px 0 #fff;z-index:3'; pad.appendChild(liveEl); }
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, y] of stroke) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }
  const sz = Math.max(b - a, d - c) * K(), nf = C && C.features.find(f => f.x1 > racers[0].sim.x && f.kind !== 'stairs' && f.kind !== 'step');
  const small = sz < 0.95, huge = sz > 1.9, want = nf ? (nf.kind === 'tunnel' ? 's' : 'b') : '', ok = !want || (want === 's' ? small : !small);
  liveEl.textContent = (small ? 'SMALL' : huge ? 'HUGE' : 'BIG') + (ok ? ' ✓' : want === 's' ? ' · TOO BIG' : ' · TOO SMALL');
  liveEl.style.color = ok ? '#1c9a3a' : '#d9531e'; liveEl.style.opacity = 1;
}
function hideLive() { if (liveEl) liveEl.style.opacity = 0; }
// ghost hint: a dotted "U" being drawn until the first stroke
function drawGhost(dt) {
  ghostT += dt / 60; const w = padRect.width, h = padRect.height, t = (ghostT % 2.2) / 1.6;
  clearInk(); const pts = [];
  const f0 = C && C.features.find(f => f.kind !== 'stairs' && f.kind !== 'step'), tiny = f0 && f0.kind === 'tunnel', rx = tiny ? 0.07 : (lossN[cur] >= 2 ? 0.26 : 0.17), ry = tiny ? 0.12 : 0.3;
  for (let i = 0; i <= 30 * Math.min(1, t); i++) { const a = tiny ? Math.PI * 2 * i / 30 : Math.PI + (i / 30) * Math.PI; pts.push([w / 2 - Math.cos(a) * w * rx, h * 0.42 - Math.sin(a) * h * ry]); }
  if (pts.length > 1) drawInk(pts, 0.28);
}

// ---------------------------------------------------------------- rival AI + bot share this "what should I draw" logic
function needSmall(x) { return C.features.some(f => f.kind === 'tunnel' && x > f.x0 - 1.1 && x < f.x1 + 0.4); }
function aiUpdate(R, dt) {
  const a = R.ai; if (!raceOn || R.done) return;
  const want = needSmall(R.sim.x) ? 's' : 'b';
  if (a.mode === '' ) a.mode = R.ai.dumb ? 's' : 'b';
  if (want !== a.mode || R.stuck > 1.6) {
    a.wait -= dt / 60;
    if (a.wait <= 0) {
      if (R.stuck > 1.6 && want === a.mode) { if (want === 'b') a.bigI++; else a.smallI++; }
      a.mode = want; a.wait = a.think + Math.random() * 0.5;
      giveShape(R, want === 's' ? SMALL[a.smallI % SMALL.length]() : BIG[a.bigI % BIG.length]());
    }
  }
}
let botDraw = null, botMode = '', botBig = 0, tapN = 0;
function tapDraw() {
  const me = racers[0], w = (cur <= 4 && !isDaily && needSmall(me.sim.x + 1.2)) ? SH.circle(0.45) : (cur > 3 && !isDaily ? (tapN++ % 2 ? SH.L(1.5) : SH.U(1.7, 1.0)) : (tapN++ % 2 ? SH.L(2.1) : SH.U(2.4, 1.4))), k = K();
  const fine = []; for (let i = 0; i < w.length - 1; i++) for (let j = 0; j < 4; j++) { const t = j / 4; fine.push([w[i][0] + (w[i + 1][0] - w[i][0]) * t, w[i][1] + (w[i + 1][1] - w[i][1]) * t]); }
  fine.push(w[w.length - 1]); botDraw = { i: 0, tap: true, pts: fine.map(([x, y]) => [padRect.width / 2 + x / k, padRect.height / 2 - y / k]) };
}
function bot() {
  if (state !== 'play') return;
  const me = racers[0];
  if (botDraw) {   // keep "drawing" the planned stroke into the pad
    botDraw.i = Math.min(botDraw.pts.length, botDraw.i + 9); clearInk(); drawInk(botDraw.pts.slice(0, botDraw.i));
    if (botDraw.i >= botDraw.pts.length) { const p = botDraw.pts; botDraw = null; commitStroke(p); }
    return;
  }
  const want = needSmall(me.sim.x + 1.2) || (botMode === 's' && needSmall(me.sim.x)) ? 's' : 'b';
  if (want !== botMode || me.stuck > 1.3) {
    if (me.stuck > 1.3 && want === botMode) botBig++;
    botMode = want; me.stuck = 0;
    const w = want === 's' ? SH.circle(0.45) : (botBig % 2 ? SH.L(2.1) : SH.U(2.4, 1.4)), k = K();
    const fine = []; for (let i = 0; i < w.length - 1; i++) for (let j = 0; j < 4; j++) { const t = j / 4; fine.push([w[i][0] + (w[i + 1][0] - w[i][0]) * t, w[i][1] + (w[i + 1][1] - w[i][1]) * t]); }
    fine.push(w[w.length - 1]);
    botDraw = { i: 0, pts: fine.map(([x, y]) => [padRect.width / 2 + x / k, padRect.height / 2 - y / k]) };
  }
}

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// a leg shape scribbles itself into the pad (the bot's own stroke), the cube runs on it for a moment, then the level rewinds
let demoDrew = 0;
demo(() => {
  if (!demoDrew) { bot(); if (!botDraw) demoDrew = performance.now(); return; }
  if (performance.now() - demoDrew < 2600) return;
  botMode = ''; startLevel(); fitPad(); return false;
}, { ready: () => state === 'play' && cur === 1 && !isDaily && !stars[1], wait: 1500, every: 90, max: 80, ms: 7000 });

// ---------------------------------------------------------------- main loop
const lossRun = {}; // straight losses per level: after 2, rivals ease a little (5% per extra loss, max 15%)
const stuck0 = (R) => R.stuck;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();
let shake = 0;
const starsFor = (won, g, tm) => !won ? 0 : (g >= 3 && (!spec.par || tm <= spec.par * 0.76) ? 3 : g >= 2 ? 2 : 1);
function finish(won) {
  if (state !== 'play') return;
  { const lk = isDaily ? 'd' : cur; lossRun[lk] = won ? 0 : (lossRun[lk] || 0) + 1; }
  state = won ? 'won' : 'lost'; F.level(won, clamp((racers[0].sim.x + 3.2) / (finishX + 3.2), 0, 1));
  ui.sub('');
  if (won) {
    const tm = raceClock, st = starsFor(true, gemsGot, tm), key = isDaily ? 'd' : cur, was = stars[key] || 0, before = hatsOpen();
    if (!isDaily) { if (st > was) { stars[key] = st; save.set('stars', stars); } if (!was) { WB.submit(1); wins++; save.set('wins', wins); } if (cur === level) { level++; save.set('level', level); } }
    else { const sk = streak(), y = new Date(); y.setDate(y.getDate() - 1); const n = sk.last === DAY(y) ? sk.n + 1 : sk.last === DAY() ? sk.n : 1; if (sk.last !== DAY()) { bonus += 2; save.set('bonus', bonus); WB.submit(1); } save.set('streak', { last: DAY(), n }); }
    const chest = spec.hard && !isDaily && !was; if (chest) { bonus += 3; save.set('bonus', bonus); }
    const newHat = hatsOpen() > before ? HATS[hatsOpen() - 1] : '';
    sfx.win(); buzz([30, 40, 60]); ui.flash(0.55);
    const p = racers[0].sim; confetti(scene, new THREE.Vector3(p.x + 1, p.y + 1.5, 0), 90 + st * 30); confetti(scene, new THREE.Vector3(p.x + 1, p.y + 2.5, -3), 60);
    ui.pop('1st PLACE!', '#fff', 48, 26);
    const rv = racers.slice(1).map(R => ({ R, d: finishX + 0.3 - R.sim.x })).sort((a, b) => a.d - b.d)[0];
    const margin = rv && !rv.R.done ? `${rv.R.name} was ${(rv.d / Math.max(3, Math.abs(rv.R.omega) * 0.55)).toFixed(1)} s behind` : rv ? `${rv.R.name} was right behind!` : '';
    setTimeout(() => card({ win: true, st, was, tm, margin, newHat, chest }), 900);
  } else {
    sfx.fail(); buzz([60, 40, 60]); lossN[cur] = (lossN[cur] || 0) + 1;
    const w = racers.find(R => R.done && !R.me), hint = falls ? 'you fell in a pit: draw a BIGGER loop to bridge it' : stuckKind === 'tunnel' ? 'the roof stopped you: draw a SMALL circle' : stuckKind === 'wall' || stuckKind === 'chicane' || stuckKind === 'stairs' || stuckKind === 'step' ? 'stuck on a wall: draw a BIGGER loop' : 'redraw your legs when you stall';
    ui.pop(`${w ? w.name : 'A rival'} wins`, '#fff', 34, 26);
    if (w && w.tag) w.tag.dataset.e = ' 😎';
    const left = Math.max(0, finishX - racers[0].sim.x);
    setTimeout(() => card({ win: false, hint, left, who: w ? w.name : 'A rival' }), 600);
  }
}

// ---------------------------------------------------------------- cards + map (own DOM, tiny wordless where possible)
const css = document.createElement('style');
css.textContent = `
.dl-ov{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:14px;font-family:'Baloo 2',system-ui,sans-serif;color:#fff}
.dl-card{width:min(92vw,360px);border-radius:28px;padding:18px 16px 14px;text-align:center;background:rgba(60,48,140,.82);box-shadow:0 10px 30px rgba(30,20,90,.3);animation:dlpop .35s cubic-bezier(.2,1.5,.5,1)}
.dl-card.bad{background:rgba(40,30,80,.62)}
@keyframes dlpop{from{transform:scale(.7);opacity:0}}
.dl-card h2{margin:0;font-size:30px;font-weight:800;line-height:1.05}
.dl-st{font-size:50px;letter-spacing:4px;line-height:1.1;margin:4px 0}
.dl-st i{font-style:normal;display:inline-block;filter:grayscale(1) brightness(1.4);opacity:.3}.dl-st i.on{filter:none;opacity:1;animation:dlstar .5s both}
@keyframes dlstar{from{transform:scale(2.4) rotate(-30deg);opacity:0}}
.dl-row{font-weight:800;font-size:17px;margin:3px 0;opacity:.95}.dl-sm{font-size:14px;font-weight:600;opacity:.85;margin:3px 0}
.dl-btns{display:flex;gap:8px;margin-top:12px}.dl-b{flex:1;border:0;border-radius:18px;padding:11px 8px;font:800 20px 'Baloo 2',system-ui;color:#fff;background:rgba(255,255,255,.22);box-shadow:0 4px 0 rgba(0,0,0,.18);cursor:pointer}
.dl-b.main{flex:2;background:var(--ui,#ff5d8f)}.snap{animation:dlsnap .25s}@keyframes dlsnap{40%{transform:scale(1.05)}}
.dl-b:active{transform:translateY(3px);box-shadow:none}
.dl-map{align-items:flex-start;overflow-y:auto;background:linear-gradient(180deg,#6b57c9,#9b63bd);z-index:30}
.dl-mp{width:min(94vw,420px);margin:0 auto;padding:54px 0 30px}
.dl-top{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:20px;margin:4px 2px 8px}
.dl-hats{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 8px}.dl-hats span{flex:none;width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px}
.dl-hats span.sel{outline:3px solid #ffd23f}.dl-hats span.no{opacity:.4;font-size:12px}
.dl-w{margin:10px 0;border-radius:22px;padding:10px 10px 12px;background:rgba(255,255,255,.14)}.dl-w h3{margin:0 0 6px;font-size:19px}.dl-w h3 small{font-weight:600;opacity:.8;font-size:13px;margin-left:6px}
.dl-g{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.dl-n{position:relative;aspect-ratio:1;border-radius:16px;border:0;background:var(--c,#ff5d8f);color:#fff;font:800 20px 'Baloo 2',system-ui;box-shadow:0 4px 0 rgba(0,0,0,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;cursor:pointer}
.dl-n small{font-size:9px;letter-spacing:-1px;margin-top:2px;height:11px}.dl-n.lock{background:rgba(255,255,255,.18);box-shadow:none;color:rgba(255,255,255,.55);pointer-events:none}
.dl-n.now{animation:dlnow 1s ease-in-out infinite;outline:3px solid #fff}@keyframes dlnow{50%{transform:scale(1.1)}}
.tag[data-e]::after{content:attr(data-e)}
`;
document.head.appendChild(css);
let ov = null;
const closeOv = () => { if (ov) { ov.remove(); ov = null; } };
const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
let lastTip = '';
function go(n, daily = false) { const retry = lastTip && n === cur && !daily; closeOv(); ui.hideStart(); isDaily = daily; cur = n; startLevel(); fitPad(); state = 'play'; if (retry) { ui.pop(lastTip, '#ffe36b', 22, 30); } lastTip = ''; }
const nextLabel = () => cur < 30 ? 'Next ▶' : 'Next ▶';
function card(o) {
  closeOv(); const sk = streak();
  const tomorrow = sk.last === DAY() ? `Tomorrow: Daily Race · day ${sk.n + 1}` : isDaily ? '' : `Daily Race is waiting · ${sk.n ? 'streak ' + sk.n : 'start a streak'}`;
  if (o.win) {
    const dn = cur % 10 === 0 && !isDaily && cur <= 30;
    ov = el('dl-ov', `<div class="dl-card"><h2>${isDaily ? 'DAILY RACE' : 'LEVEL ' + cur} CLEARED</h2><div class="dl-st">${[1, 2, 3].map(i => `<i class="${i <= o.st ? 'on' : ''}" style="animation-delay:${0.15 * i}s">⭐</i>`).join('')}</div>
      <div class="dl-row">💎 ${gemsGot}/3 · ⏱ ${o.tm.toFixed(1)}s${spec.par ? ' / ' + spec.par + 's' : ''}</div>
      ${o.chest ? '<div class="dl-row" style="color:#ffe36b">🎁 BOSS CHEST +3</div>' : ''}<div class="dl-sm">${o.margin}${fits ? ' · ✨' + fits : ''}</div>
      ${o.newHat ? `<div class="dl-row" style="color:#ffe36b">NEW HAT! ${hatIcon(o.newHat)} ${o.newHat}</div>` : `<div class="dl-sm">next hat ${total() % 4}/4 ⭐</div><div style="height:8px;border-radius:5px;background:rgba(255,255,255,.25);margin:0 30px"><div style="height:100%;border-radius:5px;background:#ffd23f;width:${(total() % 4) * 25}%"></div></div>`}
      ${o.st < 3 ? `<div class="dl-sm">${gemsGot < 3 ? 'Catch all 3 💎 for ⭐⭐⭐' : 'Be 15% quicker for ⭐⭐⭐'}</div>` : ''}
      <div class="dl-btns"><button class="dl-b" data-a="map">🗺️</button><button class="dl-b" data-a="again">🔁</button><button class="dl-b main" style="flex:2;font-size:20px" data-a="next">${isDaily ? 'Map' : 'Next ▶'}</button></div>${!isDaily && sk.last !== DAY() ? `<button class="dl-b" style="width:100%;margin-top:8px;font-size:13px;padding:6px" data-d="1">📅 Daily Race now · ${sk.n ? 'keep streak ' + sk.n : 'start a streak'}</button>` : ''}</div>`);
  } else {
    ov = el('dl-ov', `<div class="dl-card bad"><h2>${o.who} won</h2><div class="dl-row" style="color:#ffe36b">${o.hint}</div><div class="dl-sm">${Math.round(o.left)} m from the flag</div>
      <div class="dl-sm">${gemsGot ? '💎 ' + gemsGot + '/3 so far' : ''}</div>
      <div class="dl-btns"><button class="dl-b" data-a="map">🗺️</button><button class="dl-b main" data-a="again">🔁 Again</button></div></div>`);
  }
  if (!o.win) { const me = ov; lastTip = o.hint; setTimeout(() => { if (ov === me && state !== 'play') go(cur, isDaily); }, 1900); }
  ov.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target.closest('[data-d]')) return go(1, true); const a = e.target.closest('[data-a]') || (!e.target.closest('button') ? { dataset: { a: o.win ? 'next' : 'again' } } : null); if (!a) return; a.dataset.a === 'map' ? openMap() : a.dataset.a === 'again' ? go(cur, isDaily) : (isDaily ? openMap() : go(cur + 1)); });
}
const hatIcon = (n) => ({ none: '🚫', cap: '🧢', party: '🎉', bow: '🎀', antenna: '📡', tophat: '🎩', halo: '😇', horns: '😈', flower: '🌼', phones: '🎧', wizard: '🧙', prop: '🚁' })[n] || '?';
function openMap() {
  closeOv(); const sk = streak(), doneToday = sk.last === DAY();
  const opened = hatsOpen();
  const worlds = WORLDS.map((W, w) => `<div class="dl-w" style="--c:${W.ui}"><h3>${W.ico} ${W.name}<small>${W.tag}</small></h3><div class="dl-g">${Array.from({ length: 10 }, (_, i) => {
    const n = w * 10 + i + 1, st = stars[n] || 0, open = n <= level;
    return `<button class="dl-n ${open ? '' : 'lock'} ${n === level ? 'now' : ''}" data-l="${n}">${open ? n : '🔒'}<small>${st ? '⭐'.repeat(st) : ''}</small></button>`; }).join('')}</div></div>`).join('');
  ov = el('dl-ov dl-map', `<div class="dl-mp"><div class="dl-top"><span>⭐ ${total()}</span><span style="font-size:15px">next hat ⭐ ${Math.min(HATS.length - 1, opened) * 4}</span></div>
    <div class="dl-hats">${HATS.map((h, i) => `<span class="${i === Math.min(hat, opened - 1) ? 'sel' : ''} ${i >= opened ? 'no' : ''}" data-h="${i}">${i < opened ? hatIcon(h) : '⭐' + i * 4}</span>`).join('')}</div>
    ${worlds}
    <div class="dl-w"><button class="dl-b main" style="width:100%" data-d="1">📅 Daily Race ${doneToday ? '✓' : ''} · streak ${sk.n}</button></div>
    ${level > 30 ? `<div class="dl-w"><button class="dl-b main" style="width:100%" data-l="${level}">∞ Endless road ${level - 30}</button></div>` : ''}
    <div class="dl-btns"><button class="dl-b main" data-l="${Math.min(level, 9999)}">▶ Play ${level}</button></div></div>`);
  ov.addEventListener('pointerdown', (e) => { e.stopPropagation(); const h = e.target.closest('[data-h]'), n = e.target.closest('[data-l]'), d = e.target.closest('[data-d]');
    if (h) { const i = +h.dataset.h; if (i < opened) { hat = i; save.set('hat', hat); wearHat(); ov.querySelectorAll('[data-h]').forEach((x) => x.classList.toggle('sel', +x.dataset.h === i)); sfx.pick(3); } }
    else if (d) go(cur, true); else if (n && !n.classList.contains('lock')) go(+n.dataset.l); });
  setTimeout(() => { const nowEl = ov && ov.querySelector('.now'); if (nowEl) nowEl.scrollIntoView({ block: 'center' }); }, 30);
}

loop((dt, t) => {
  let s = dt / 60;
  if (!racers.length) return;
  // photo finish: last 4 m with a rival within 1.5 m = slow motion
  if (raceOn && state === 'play' && racers[0].sim.x > finishX - 4 && racers.some((R, i) => i && !R.done && Math.abs(R.sim.x - racers[0].sim.x) < 1.5)) { s *= 0.55; if (!window.__pf) { window.__pf = 1; ui.pop('PHOTO FINISH!', '#fff36b', 34, 26); } }
  if (state === 'play' && botDraw && botDraw.tap) { botDraw.i = Math.min(botDraw.pts.length, botDraw.i + Math.ceil(2 * dt)); clearInk(); drawInk(botDraw.pts.slice(0, botDraw.i)); if (botDraw.i >= botDraw.pts.length) { const p = botDraw.pts; botDraw = null; commitStroke(p); } }
  if (state === 'play' && !raceOn && !botDraw && !stroke) drawGhost(dt);
  // physics
  for (const R of racers) {
    const sim = R.sim, prevC = sim.contact;
    if (state === 'play' || state === 'won' || (state === 'lost' && !R.me)) {
      if (raceOn || !R.me) {
        if (!raceOn) step(sim, C.rects, s, 0); else step(sim, C.rects, s, R.done ? R.omega * 0.6 : R.omega * (R.me && feverB > 0 ? 1.12 : 1));
      }
    }
    const gp = C.gaps.find(g => sim.x > g.x0 - 0.5 && sim.x < g.x1 + 0.5);
    if (gp ? sim.y < floorAt(C, gp.x0 - 0.5) - 3.5 : sim.y < floorAt(C, sim.x) - 6) {   // fell in a pit (or off the world): back to the edge
      const gx = gp ? gp.x0 - 1.2 : R.lastX - 1; sim.x = gx; sim.y = floorAt(C, gx) + 2; sim.vx = sim.vy = 0; R.lastX = gx; R.stuck = 0;
      if (R.me && raceOn) { falls++; ui.pop('SPLASH! Bigger loop', '#fff', 30, 24); sfx.fail(); buzz(30); shake = 0.25; burst(scene, new THREE.Vector3(sim.x + 1, sim.y, 0.3), ['#ffffff', '#9bd'], 10, { speed: 0.08, up: 0.1, size: 0.6, shape: 'sphere' }); }
    }
    // stuck tracking
    R.stuckClock = (R.stuckClock || 0) + s;
    if (R.stuckClock > 0.5) { R.stuck = sim.x - R.lastX < 0.25 && raceOn ? R.stuck + R.stuckClock : 0; R.lastX = sim.x; R.stuckClock = 0; }
    if (!R.me) aiUpdate(R, dt);
    // juice: step dust + thumps
    R.contactT -= s;
    if (sim.contact && !prevC && R.contactT < 0 && raceOn) {
      R.contactT = 0.16; R.sq = Math.min(0.22, R.sq + 0.1);
      if (R.lane < 2) burst(scene, new THREE.Vector3(sim.x + 0.2, floorAt(C, sim.x) + 0.05, LANE_Z[R.lane] + 0.4), '#ffffff', 3, { speed: 0.03, up: 0.03, size: 0.45, shape: 'sphere', gravity: 0.001 });
      if (R.me) tone(150 + Math.random() * 70, 0.05, 'sine', 0.09, 0.7);
    }
    if (sim.impact > 8) { R.sq = 0.35; if (R.me) { shake = Math.min(0.25, sim.impact * 0.02); sfx.bounce(); buzz(20); burst(scene, new THREE.Vector3(sim.x, sim.y - 0.3, LANE_Z[R.lane] + 0.3), '#ffffff', 8, { speed: 0.06, up: 0.04, size: 0.6, shape: 'sphere' }); } }
    // finish line
    if (!R.done && sim.x > finishX + 0.3) {
      R.done = true;
      if (R.me) finish(true);
      else if (state === 'play' && raceOn) { setTimeout(() => finish(false), 350); ui.pop(`${R.name} wins!`, '#fff', 34, 30); }
    }
    // view
    const v = R.view;
    v.g.position.set(sim.x, sim.y, LANE_Z[R.lane]);
    v.legs.rotation.z = sim.th;
    R.pop = Math.max(0, R.pop - s * 3.2); const ls = v.legs.scale.x; v.legs.scale.setScalar(lerp(ls, 1, 0.25) + Math.sin(R.pop * 9) * R.pop * 0.08);
    R.sq = Math.max(0, R.sq - s * 1.6);
    v.body.scale.set(1 + R.sq * 0.6, 1 - R.sq, 1 + R.sq * 0.6); v.body.position.y = -R.sq * 0.2;
    v.body.rotation.z = lerp(v.body.rotation.z, clamp(-sim.vx * 0.03 + sim.vy * 0.02, -0.35, 0.35), 0.15);
  }
  // gems, fits, fever, purpose line
  {
    const me0 = racers[0], pz = me0.sim;
    if (state === 'play' && raceOn) {
      raceClock += s; feverB = Math.max(0, feverB - s); if (feverB > 0) burst(scene, new THREE.Vector3(pz.x - 0.5, pz.y, 0.5), ['#ffffff', '#fff36b'], 2, { speed: 0.05, up: 0.01, size: 0.45, shape: 'sphere', gravity: 0 }); if (raceClock > 3.2 && spec) ui.sub('');
      for (const m of gemMeshes) { if (!m.visible) continue; if (touchGem({ x: pz.x, y: pz.y, th: pz.th, pts: pz.pts }, m.userData.g)) {
        m.visible = false; gemsGot++; note(72 + gemsGot * 4, 0.3, 0.2); buzz(10);
        burst(scene, new THREE.Vector3(pz.x, pz.y + 0.2, 0.3), ['#43e0ff', '#ffffff'], 14, { speed: 0.09, up: 0.08, size: 0.6, shape: 'sphere' });
        ui.pop(gemsGot === 3 ? 'ALL 3 GEMS!' : `💎 ${gemsGot}/3`, '#fff', gemsGot === 3 ? 36 : 28, 24); if (gemsGot === 3) { feverT = 99; ui.flash(0.3); }
      } }
      { const nx = C.features.find(f => !f.hit && HINT[f.kind] && f.x1 + 1 > pz.x && f.x0 - 7 < pz.x); const k = nx ? nx.kind : ''; if (k !== lookK) { lookK = k; if (k) ui.sub((spec.hard ? '👑 ' : '') + 'AHEAD ' + HINT[k]); } }
      for (const f of C.features) { if (f.hit || pz.x < f.x0 + 0.3 || pz.x > f.x1 + 1) continue; f.hit = true;
        const Rr = pz.R, fit = f.kind === 'tunnel' ? Rr > 0 && Rr <= f.h * 0.62 : f.kind === 'wall' || f.kind === 'chicane' ? Rr >= f.h * 1.1 : f.kind === 'gap' ? Rr >= f.h * 0.6 : false;
        if (fit) { fits++; feverB = 1.6;  ui.pop(fits > 1 ? `PERFECT FIT x${fits}!` : 'PERFECT FIT!', '#fff36b', 30 + Math.min(fits, 5) * 3, 26); note(76 + Math.min(fits, 8) * 2, 0.18, 0.16); }
      }
      if (pz.contact && stuck0(me0) > 1.2) { const f = C.features.find(f => pz.x > f.x0 - 1.2 && pz.x < f.x1 + 1.6); if (f) stuckKind = f.kind; }
      if (feverT > 0 && Math.random() < 0.5) burst(scene, new THREE.Vector3(pz.x - 0.3, pz.y - 0.1, 0.3), ['#43e0ff', '#fff36b'], 1, { speed: 0.02, up: 0.02, size: 0.5, shape: 'sphere', gravity: 0.0005 });
    }
    if (goldOrb) { goldOrb.rotation.y += 0.09 * dt; goldOrb.rotation.x += 0.04 * dt; goldOrb.position.y += Math.sin(t * 4) * 0.004;
      if (state === 'play' && raceOn && Math.hypot(pz.x - goldOrb.position.x, pz.y - goldOrb.position.y) < 0.9) { feverB = 4; ui.pop('GOLD TURBO!', '#ffd23d', 38, 28); ui.flash(0.25); note(88, 0.35, 0.22); buzz(20); burst(scene, goldOrb.position.clone(), ['#ffd23d', '#ffffff'], 22, { speed: 0.12, up: 0.1, size: 0.7, shape: 'sphere' }); world.remove(goldOrb); goldOrb = null; } }
    for (const m of gemMeshes) { m.rotation.y += 0.05 * dt; m.position.y = m.userData.g.y + Math.sin(t * 3 + m.userData.g.x) * 0.05; }
  }
  // ranking, crown, overtakes, progress
  const order = racers.slice().sort((a, b) => b.sim.x - a.sim.x);
  order.forEach((R, i) => R.view.crown.visible = i === 0 && raceOn);
  const me = racers[0], rank = order.indexOf(me) + 1;
  if (raceOn && state === 'play') {
    ui.pill(['1st', '2nd', '3rd', '4th'][rank - 1]);
    if (rank < lastRank) { ui.pop(rank === 1 ? 'TAKE THE LEAD!' : 'OVERTAKE!', '#fff', 34, 26); sfx.coin(); buzz(15);
      const beh = order[rank]; if (beh && beh.tag) { beh.tag.dataset.e = ' 😵'; setTimeout(() => { delete beh.tag.dataset.e; }, 1600); } }
    lastRank = rank;
    const prog = clamp((me.sim.x + 3.2) / (finishX + 3.2), 0, 1); ui.progress(prog);
    for (const R of racers) if (R.mark) R.mark.style.left = clamp((R.sim.x + 3.2) / (finishX + 3.2), 0, 1) * 100 + '%';
    // nudge to redraw when stuck
    if (me.stuck > 5 && !botDraw && !botMode && !isDaily && state === 'play' && racers.slice(1).some(R => R.sim.x > me.sim.x + 4)) { finish(false); }
    if (me.stuck > 1.4 && !nudged && !botDraw) { nudged = true; pad.classList.add('nudge'); ui.pop('DRAW AGAIN!', '#fff', 32, 24); }
    if (me.stuck < 0.1 && nudged) { nudged = false; pad.classList.remove('nudge'); }
  }
  // camera: side-on, a little above, legs and the next obstacle in view
  const p = me.sim, fy = floorAt(C, p.x + 1.5);
  const ty = lerp(p.y, Math.max(fy, p.y - 1), 0.3);
  camPos.lerp(tmp.set(p.x + 0.2, ty + 4.4, 12.5), 0.08);
  camLook.lerp(tmp.set(p.x + 1.3, ty - 0.6, -2.2), 0.1);
  shake *= 0.86;
  const under = C.features.some(f => f.kind === 'tunnel' && p.x > f.x0 - 3 && p.x < f.x1 + 1.5);
  roofMat.opacity = lerp(roofMat.opacity, under ? 0.3 : 1, 0.12); roofMat.depthWrite = roofMat.opacity > 0.95;
  camera.position.copy(camPos).add(tmp.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
  camera.lookAt(camLook);
  stage.followLight(new THREE.Vector3(p.x + 2, p.y, -2));
  sparks.position.set(camPos.x * 0.85, camPos.y * 0.85, 0);
  // name tags
  for (const R of racers) if (R.tag) {
    tmp.set(R.sim.x, R.sim.y + 0.75, LANE_Z[R.lane]).project(camera);
    const on = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && tmp.y < 1;
    R.tag.style.display = on && state !== 'ready' ? '' : 'none';
    R.tag.style.left = (tmp.x * 0.5 + 0.5) * innerWidth + 'px'; R.tag.style.top = (-tmp.y * 0.5 + 0.5) * innerHeight + 'px';
  }
});

ui.onTap((which) => { WB.start();
  if (which === 'start') { state = 'play'; fitPad(); return; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'm') openMap(); });
startLevel(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return wins; }, bot, openMap, go, get stars() { return stars; }, get gems() { return gemsGot; }, get falls() { return falls; }, get ov() { return !!ov; },
  dbg: () => racers.map(R => ({ x: +R.sim.x.toFixed(2), y: +R.sim.y.toFixed(2), stuck: +R.stuck.toFixed(2), R: +R.sim.R.toFixed(2) })),
};

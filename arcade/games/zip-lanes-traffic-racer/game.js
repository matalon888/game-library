// Zip Lanes — original highway traffic racer. Swipe (or tap a side) to switch lanes, weave through slower
// traffic, chain close passes for combo points. Reach the level distance; any crash ends the run.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Zip Lanes: Traffic Racer';
const S = store('ziplanes');
const F = flow('ziplanes');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 58, shadowSize: 16 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'ZIP<br>LANES', hint: 'Swipe to switch lanes', hand: '👆' });
const D = daily('ziplanes', ui, { name: NAME });
const B = board({ game: 'zip-lanes', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum' });
const spdEl = document.getElementById('spd');

const LANES = 4, LW = 2.3, LX = (i) => (i - (LANES - 1) / 2) * LW, ROAD_W = LANES * LW + 1.2;
const THEMES = [
  { bg: ['#ffc6a5', '#ffeccf'], fog: '#ffe3cb', grass: '#9bd36a', grass2: '#8cc75c', tree: ['#5fbf5a', '#7fd36a', '#ffb3c6'], hill: '#a8dc7a', ui: '#ff6b4a', car: '#ff4f6d' },
  { bg: ['#a5c9ff', '#e6f0ff'], fog: '#dce9ff', grass: '#8fd6a0', grass2: '#7fca92', tree: ['#46b38a', '#6fcf9b', '#ffd23f'], hill: '#9ad9b0', ui: '#3a86ff', car: '#ffb703' },
  { bg: ['#ffb3d1', '#ffe8f1'], fog: '#ffe2ee', grass: '#b5dd7a', grass2: '#a6d26a', tree: ['#7bc96f', '#ffa8c5', '#ff7bac'], hill: '#c3e48e', ui: '#e8456b', car: '#7b5cff' },
  { bg: ['#ffd98a', '#fff4d1'], fog: '#fff0c8', grass: '#c8d96a', grass2: '#bacd5c', tree: ['#e09f3e', '#9cc95a', '#ff7b54'], hill: '#d6e08a', ui: '#ff8c42', car: '#00a6fb' },
];

// ---------------------------------------------------------------- road + sides
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const roadTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#59606e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  const px = (x) => (x / ROAD_W + 0.5) * w;
  g.fillStyle = '#ffffff'; for (const s of [-1, 1]) g.fillRect(px(s * (LANES * LW / 2)) - 5, 0, 10, h);
  g.fillStyle = '#ffd23f'; g.fillRect(px(-LANES * LW / 2) + 10, 0, 4, h);
  g.fillStyle = 'rgba(255,255,255,.92)'; for (let i = 1; i < LANES; i++) { const x = px((i - LANES / 2) * LW); g.fillRect(x - 4, 0, 8, h * 0.45); }
});
roadTex.repeat.set(1, 12);
const ROAD_L = 260;
const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_L), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }));
road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -ROAD_L / 2 + 20); road.receiveShadow = true; scene.add(road);
const grassTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * h / 8, w, h / 16); });
grassTex.repeat.set(4, 40);
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, color: '#9bd36a' });
const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, ROAD_L), grassMat); grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, -ROAD_L / 2 + 20); grass.receiveShadow = true; scene.add(grass);
// shoulders + rails
const shoulderMat = mat('#d9d4cc');
for (const s of [-1, 1]) {
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, ROAD_L), shoulderMat); sh.position.set(s * (ROAD_W / 2 + 0.3), 0.04, -ROAD_L / 2 + 20); sh.receiveShadow = true; scene.add(sh);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, ROAD_L), mat('#f4f4f8', { metalness: 0.3, roughness: 0.3 })); rail.position.set(s * (ROAD_W / 2 + 0.7), 0.62, -ROAD_L / 2 + 20); rail.castShadow = true; scene.add(rail);
}
const POSTS = 90, posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), mat('#c9c9d4'), POSTS), postZ = [];
for (let i = 0; i < POSTS; i++) postZ.push(20 - (i >> 1) * 5.6);
scene.add(posts);
// trees (instanced trunks + puffy crowns), lamp posts
const TREES = 70;
const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 1.2, 6), mat('#9c6b45'), TREES);
const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#ffffff', { flatShading: true, roughness: 0.8 }), TREES);
crowns.castShadow = true; trunks.castShadow = true; scene.add(trunks, crowns);
const trees = [];
{ const R = rng(9); for (let i = 0; i < TREES; i++) { const s = i % 2 ? 1 : -1; trees.push({ x: s * (ROAD_W / 2 + 3 + R() * 18), z: 20 - R() * 230, sc: 0.8 + R() * 1.1, c: Math.floor(R() * 3), cone: R() < 0.4 }); } }
const LAMPS = 12, lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), mat('#e8e8f0'), LAMPS), lampHead = new THREE.InstancedMesh(rounded(1.3, 0.18, 0.4, 0.08), mat('#ffffff', { emissive: '#fff6c8', emissiveIntensity: 0.6 }), LAMPS), lampZ = [];
for (let i = 0; i < LAMPS; i++) lampZ.push(20 - i * 22);
scene.add(lampPole, lampHead);
// distant hills
const hillMat = mat('#a8dc7a', { roughness: 1 });
{ const R = rng(4); for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(18 + R() * 16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat); h.scale.y = 0.35 + R() * 0.25; h.position.set((i - 4) * 32 + R() * 10, -1, -190 - R() * 30); scene.add(h); } }
// sky: sun + clouds (not fogged)
const skyG = new THREE.Group(); scene.add(skyG);
{
  const sunM = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false })); sunM.position.set(-50, 30, -230); sunM.scale.setScalar(0.7); skyG.add(sunM);
  const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1, fog: false }), R = rng(21);
  for (let i = 0; i < 7; i++) { const c = new THREE.Group(); for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(5 + R() * 4, 12, 10), cm); b.position.set(k * 6 - 12, R() * 3, 0); b.scale.y = 0.6; c.add(b); } c.position.set(-110 + i * 38 + R() * 10, 16 + R() * 16, -220); c.scale.setScalar(0.7); skyG.add(c); }
}
// speed streaks
const STREAKS = 26, streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }), STREAKS), streakD = [];
{ const R = rng(2); for (let i = 0; i < STREAKS; i++) streakD.push({ x: (R() < 0.5 ? -1 : 1) * (2 + R() * 6), y: 0.4 + R() * 4, z: -R() * 60 }); }
scene.add(streaks);

// ---------------------------------------------------------------- cars (chunky low-poly)
const wheelG = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14); wheelG.rotateZ(Math.PI / 2);
const tireM = mat('#2b2d42', { roughness: 0.7 }), hubM = mat('#e6e6ee'), glassM = glossy('#33415c', { roughness: 0.15 }), lightM = mat('#fff7d6', { emissive: '#fff2b0', emissiveIntensity: 0.8 }), tailM = mat('#ff3355', { emissive: '#ff2244', emissiveIntensity: 0.6 });
function makeCar(kind, color) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.body = body;
  const paint = glossy(color, { roughness: 0.3 });
  const dims = { sport: [1.9, 0.55, 4.1, 1.5, 0.45, 1.9, -0.2], sedan: [1.85, 0.7, 4.2, 1.6, 0.6, 2.2, 0.1], hatch: [1.8, 0.75, 3.6, 1.6, 0.65, 2.0, 0.35], van: [1.95, 1.4, 4.6, 1.85, 0.6, 1.4, -1.5], truck: [2.1, 1.0, 6.4, 2.0, 1.9, 4.6, 0.8], bus: [2.15, 2.2, 8.0, 2.1, 0.0, 0, 0] }[kind];
  const [w, h, l, cw, ch, cl, cz] = dims;
  const base = new THREE.Mesh(rounded(w, h, l, 0.22), paint); base.rotation.y = 0; base.position.y = 0.38 + h / 2; base.castShadow = true; body.add(base);
  // rounded() extrudes along z; it is built in x/y and extruded in z, which is what we want (length along z)
  if (kind === 'truck') {
    const cab = new THREE.Mesh(rounded(2.05, 1.3, 1.8, 0.2), paint); cab.position.set(0, 0.38 + h + 0.55, -l / 2 + 0.9); cab.castShadow = true; body.add(cab);
    const box = new THREE.Mesh(rounded(2.1, 1.9, 4.4, 0.12), mat('#ffffff')); box.position.set(0, 0.38 + h + 0.85, 0.9); box.castShadow = true; body.add(box);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.05), glassM); win.position.set(0, 0.38 + h + 0.85, -l / 2 - 0.01); body.add(win);
  } else if (kind === 'bus') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.17, 0.5, 7.6), glassM); stripe.position.set(0, 0.38 + h * 0.68, 0); body.add(stripe);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.12, 7.7), mat('#ffffff')); band.position.set(0, 0.38 + h * 0.4, 0); body.add(band);
  } else {
    const cab = new THREE.Mesh(rounded(cw, ch, cl, 0.2), paint); cab.position.set(0, 0.38 + h + ch / 2 - 0.08, cz); cab.castShadow = true; body.add(cab);
    const wf = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.12, ch * 0.62, cl + 0.04), glassM); wf.position.copy(cab.position); wf.position.y += 0.02; body.add(wf);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.02, ch * 0.55, cl - 0.5), glassM); ws.position.copy(cab.position); ws.position.y += 0.03; body.add(ws);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(cw - 0.3, ch * 0.55, 0.05), glassM); rw.position.set(0, cab.position.y + 0.02, cz + cl / 2 + 0.01); body.add(rw);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.04), mat('#ffffff')); plate.position.set(0, 0.38 + h * 0.35, l / 2 + 0.02); body.add(plate);
  }
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), lightM); hl.position.set(sx * (w / 2 - 0.35), 0.38 + h * 0.6, -l / 2 - 0.01); body.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), tailM); tl.position.set(sx * (w / 2 - 0.35), 0.38 + h * 0.65, l / 2 + 0.01); body.add(tl);
  }
  g.wheels = [];
  const wz = l / 2 - (kind === 'bus' ? 1.3 : 0.85);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wh = new THREE.Mesh(wheelG, tireM); wh.position.set(sx * (w / 2 - 0.08), 0.36, sz * wz); wh.castShadow = true; const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 8).rotateZ(Math.PI / 2), hubM); wh.add(hub); g.add(wh); g.wheels.push(wh); }
  g.len = l; g.wid = w; g.paint = paint;
  return g;
}
// player car: sporty, with racing stripes and a spoiler
const player = makeCar('sport', '#ff4f6d');
{
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 4.12), mat('#ffffff')); st.position.set(0, 0.38 + 0.55 + 0.005, 0); player.body.add(st);
  const sp = new THREE.Mesh(rounded(1.9, 0.1, 0.45, 0.04), mat('#2b2d42')); sp.position.set(0, 1.45, 1.85); player.body.add(sp);
  for (const sx of [-0.7, 0.7]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.15), mat('#2b2d42')); p.position.set(sx, 1.2, 1.85); player.body.add(p); }
}
scene.add(player);
const KINDS = ['sedan', 'sedan', 'hatch', 'hatch', 'van', 'truck', 'bus', 'sedan'];
const PAINTS = ['#74c0fc', '#ffd23f', '#ffffff', '#8ce99a', '#b197fc', '#ffa94d', '#63e6be', '#f783ac', '#ced4da'];
const pool = {}; function getCar(kind) { const p = pool[kind] || (pool[kind] = []); const c = p.pop() || makeCar(kind, '#fff'); scene.add(c); c.visible = true; return c; }
function freeCar(c) { scene.remove(c); (pool[c.kind] || (pool[c.kind] = [])).push(c); }

// ---------------------------------------------------------------- run state
let state = 'ready', score = 0, dist = 0, goal = 400, speed = 26, baseSpeed = 26, accel = 0.5, density = 1, R = rng(1), recorded = false, beatShown = false;
let lane = 1, px = LX(1), laneT = 0, combo = 0, comboT = 0, traffic = [], spawnZ = 0, crashed = false, crashV = null, shake = 0, nearCount = 0;
let theme, bonus = 0;

function buildLevel() {
  theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', theme.ui);
  scene.fog = new THREE.Fog(theme.fog, 60, 190);
  grassMat.color.set(theme.grass); hillMat.color.set(theme.hill); player.paint.color.set(theme.car);
  { const c = new THREE.Color(); for (let i = 0; i < TREES; i++) crowns.setColorAt(i, c.set(theme.tree[trees[i].c])); crowns.instanceColor.needsUpdate = true; }
  R = rng((D.seed || level * 7727) + 1);
  const fk = F.k();
  baseSpeed = clamp(24 + level * 1.2, 24, 44); speed = baseSpeed;
  accel = clamp((0.42 + level * 0.03) * fk, 0.3, 1.2);
  density = clamp((0.8 + level * 0.07) * fk, 0.6, 2.1);
  goal = 300 + level * 130;
  for (const c of traffic) freeCar(c); traffic = [];
  dist = 0; score = 0; bonus = 0; combo = 0; comboT = 0; nearCount = 0; crashed = false; recorded = false; beatShown = false;
  lane = 1; px = LX(1); player.position.set(px, 0, 0); player.rotation.set(0, 0, 0); player.body.rotation.set(0, 0, 0);
  spawnZ = -40;
  for (let z = -40; z > -170; z -= gapAt()) spawnRow(z);
  spawnZ = -170;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : '');
  updateSpd();
}
const gapAt = () => clamp((26 - level * 0.6) / density, 9, 30) * (0.75 + R() * 0.5);
// a row of 1-2 cars that always leaves at least one lane free, and never walls the lane the player must use
function spawnRow(z) {
  const n = R() < clamp(0.18 * density, 0.1, 0.5) ? 2 : 1;
  const lanes = [0, 1, 2, 3].sort(() => R() - 0.5).slice(0, n);
  for (const ln of lanes) {
    // don't stack on a car already there
    if (traffic.some(c => c.lane === ln && Math.abs(c.z - z) < 12)) continue;
    const kind = KINDS[Math.floor(R() * KINDS.length)], c = getCar(kind);
    c.kind = kind; c.lane = ln; c.z = z; c.x = LX(ln); c.passed = false; c.v = (0.42 + R() * 0.22);
    c.paint.color.set(PAINTS[Math.floor(R() * PAINTS.length)]);
    c.position.set(c.x, 0, z); c.rotation.set(0, 0, 0); c.body.rotation.set(0, 0, 0);
    traffic.push(c);
  }
}

function updateSpd() { spdEl.innerHTML = `${Math.round(speed * 3.6)}<small>km/h</small>`; }
function checkBeat() {
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff36b', 44, 40); confetti(scene, player.position.clone().setY(2), 60); }
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  level++; S.set('level', level);
  confetti(scene, player.position.clone().add(new THREE.Vector3(0, 2, -4)), 120); sfx.win(); buzz([20, 40, 20, 40, 60]);
  D.won(score); B.submit(1);                               // world board: levels cleared today
  ui.win(level - 1, `${score} pts · ${nearCount} close calls`);
}
function crash(c) {
  if (state !== 'play') return; state = 'lost'; crashed = true;
  if (!recorded) { recorded = true; F.level(false, clamp(dist / goal, 0, 1)); }
  crashV = { vx: (px - c.x) * 2 + (R() - 0.5) * 4, vy: 6, vz: 4, spin: 6 + R() * 4 };
  shake = 1.2; ui.flash(0.8); sfx.smash(); buzz([60, 40, 120]);
  const p = player.position.clone().setY(1);
  burst(scene, p, ['#ffffff', '#ffd23f', '#ff7b2e', '#59606e'], 40, { speed: 0.25, up: 0.25, size: 1.3 });
  burst(scene, p, ['#cfd3da', '#ffffff'], 20, { speed: 0.08, up: 0.08, size: 2, shape: 'sphere', gravity: -0.002 });
  c.hit = 1;
  ui.pop('CRASH!', '#fff', 60, 30);
  ui.lose('WRECKED!', `${Math.round(dist)} / ${goal} m · ${nearCount} close calls`);
}

function steer(d) {
  if (state !== 'play') return;
  const nl = clamp(lane + d, 0, LANES - 1); if (nl === lane) { player.body.rotation.z = -d * 0.06; return; }
  lane = nl; laneT = 0.35; tone(500 + d * 60, 0.06, 'sine', 0.07, 1.3); buzz(6);
}
let dragAcc = 0;
input({
  onDown: () => { dragAcc = 0; },
  onMove: (dx) => { if (state !== 'play') return; dragAcc += dx; if (Math.abs(dragAcc) > 42) { steer(Math.sign(dragAcc)); dragAcc = 0; } },
  onTap: (e) => { if (state !== 'play') return; steer(e.clientX < innerWidth / 2 ? -1 : 1); },
});
ui.onTap(() => { buildLevel(); state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden'); });

// ---------------------------------------------------------------- loop
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
let roadOff = 0;
loop((rawDt, t) => {
  const dt = rawDt / 60;
  const moving = state === 'play' ? speed : state === 'ready' ? 12 : state === 'won' ? speed * 0.6 : 0;
  if (state === 'play') {
    speed = Math.min(speed + accel * dt, 72);
    dist += speed * dt / 1.0;
    ui.progress(dist / goal);
    comboT -= dt; if (comboT <= 0 && combo > 0) combo = 0;
    score = Math.round(dist) + bonus; ui.score(score); checkBeat();
    if (dist >= goal) win();
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) updateSpd();
  }
  if (state === 'won') speed = Math.max(0, speed - 20 * dt);
  // traffic moves toward the camera at the speed difference; a car never drives into the one ahead in its lane
  for (const c of traffic) for (const o of traffic) if (o !== c && o.lane === c.lane && o.z < c.z && c.z - o.z < (c.len + o.len) / 2 + 2.5 && o.v < c.v) c.v = o.v;
  for (const c of traffic) {
    c.z += (moving - (state === 'lost' ? 0 : moving * c.v)) * dt;
    if (state === 'lost') c.z += 0;
    c.position.z = c.z; c.position.x = c.x;
    for (const w of c.wheels) w.rotation.x -= moving * c.v * dt / 0.36;
    if (state === 'play') {
      const dx = Math.abs(c.x - px), dz = Math.abs(c.z - 0);
      if (dx < (c.wid + 1.9) / 2 - 0.12 && dz < (c.len + 4.1) / 2 - 0.25) { crash(c); break; }
      if (!c.passed && c.z > c.len / 2 + 2.05) {
        c.passed = true;
        if (dx < LW * 1.25) {   // passed in the next lane over: close call
          combo++; comboT = 2.6; nearCount++; const pts = 10 * combo; bonus += pts;
          ui.pop(combo > 1 ? `CLOSE! ×${combo}` : 'CLOSE!', combo > 2 ? '#fff36b' : '#fff', 30 + Math.min(combo, 5) * 4, 30);
          tone(700 + combo * 80, 0.08, 'triangle', 0.1, 1.4); buzz(10);
          burst(scene, new THREE.Vector3((c.x + px) / 2, 0.8, 1), ['#ffffff', '#ffd23f'], 6 + combo * 2, { speed: 0.1, up: 0.05, size: 0.6 });
        }
      }
    }
  }
  for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].z > 30) { freeCar(traffic[i]); traffic.splice(i, 1); }
  if (state === 'play' || state === 'ready') {
    // keep spawning rows ahead
    const rel = moving * dt * (1 - 0.5);
    spawnZ += rel;
    while (spawnZ > -170) { spawnZ -= gapAt(); spawnRow(spawnZ); }
  }
  // player car
  if (!crashed) {
    const tx = LX(lane); const pre = px; px = lerp(px, tx, Math.min(1, dt * 11)); laneT = Math.max(0, laneT - dt);
    player.position.x = px; player.rotation.y = -(px - pre) / Math.max(dt, 0.001) * 0.012;
    player.body.rotation.z = lerp(player.body.rotation.z, (px - tx) * 0.05, 0.2);
    player.body.position.y = Math.sin(t * 30) * 0.008 * (moving / 30);
    for (const w of player.wheels) w.rotation.x -= moving * dt / 0.36;
  } else if (crashV) {
    crashV.vy -= 20 * dt; player.position.x += crashV.vx * dt; player.position.y = Math.max(0, player.position.y + crashV.vy * dt); player.position.z += crashV.vz * dt * 0.3;
    player.rotation.z += crashV.spin * dt * (player.position.y > 0 ? 1 : 0.1); player.rotation.y += crashV.spin * dt * 0.3;
    if (player.position.y <= 0) { crashV.vy = Math.abs(crashV.vy) > 2 ? -crashV.vy * 0.3 : 0; crashV.vx *= 0.9; crashV.spin *= 0.8; }
  }
  // scenery scroll
  roadOff = (roadOff + moving * dt / (ROAD_L / 12)) % 1; roadTex.offset.y = roadOff; grassTex.offset.y = (roadOff * 40 / 12 * 1) % 1;
  for (let i = 0; i < TREES; i++) {
    const tr = trees[i]; tr.z += moving * dt; if (tr.z > 25) tr.z -= 240;
    _q.identity(); _p.set(tr.x, 0.6 * tr.sc, tr.z); _s.setScalar(tr.sc); _m.compose(_p, _q, _s); trunks.setMatrixAt(i, _m);
    _p.set(tr.x, (1.2 + 0.9) * tr.sc, tr.z); _s.set(tr.sc * 1.3, tr.sc * (tr.cone ? 2.2 : 1.4), tr.sc * 1.3); _m.compose(_p, _q, _s); crowns.setMatrixAt(i, _m);
  }
  trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < POSTS; i++) { postZ[i] += moving * dt; if (postZ[i] > 22) postZ[i] -= 5.6 * (POSTS / 2); _q.identity(); _p.set((i % 2 ? 1 : -1) * (ROAD_W / 2 + 0.7), 0.35, postZ[i]); _s.set(1, 1, 1); _m.compose(_p, _q, _s); posts.setMatrixAt(i, _m); }
  posts.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < LAMPS; i++) {
    lampZ[i] += moving * dt; if (lampZ[i] > 22) lampZ[i] -= 22 * LAMPS;
    const sx = i % 2 ? 1 : -1; _q.identity(); _p.set(sx * (ROAD_W / 2 + 1.4), 2.5, lampZ[i]); _s.set(1, 1, 1); _m.compose(_p, _q, _s); lampPole.setMatrixAt(i, _m);
    _p.set(sx * (ROAD_W / 2 + 0.9), 5, lampZ[i]); _m.compose(_p, _q, _s); lampHead.setMatrixAt(i, _m);
  }
  lampPole.instanceMatrix.needsUpdate = true; lampHead.instanceMatrix.needsUpdate = true;
  const fast = clamp((moving - 30) / 30, 0, 1);
  streaks.material.opacity = fast * 0.6;
  for (let i = 0; i < STREAKS; i++) { const s = streakD[i]; s.z += moving * dt * 1.6; if (s.z > 12) s.z -= 70; _q.identity(); _p.set(s.x, s.y, s.z); _s.set(1, 1, 0.5 + fast * 1.5); _m.compose(_p, _q, _s); streaks.setMatrixAt(i, _m); }
  streaks.instanceMatrix.needsUpdate = true;
  // camera: chase cam, widens with speed
  shake = Math.max(0, shake - dt * 1.6);
  const cx = crashed ? player.position.x * 0.5 : px * 0.55;
  camera.position.set(cx + (Math.random() - 0.5) * shake, 6.6 + (Math.random() - 0.5) * shake, 11.5);
  camera.lookAt(px * 0.7, 0, -15);
  const fov = 58 * 1.12 + fast * 10; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = lerp(camera.fov, fov, 0.05); camera.updateProjectionMatrix(); }
  stage.followLight(_p.set(0, 0, -4));
});

theme = THEMES[(level - 1) % THEMES.length];
buildLevel(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || laneT > 0.12) return;
    // how far ahead is each lane clear (traffic closing at speed*(1-v))
    const clear = (ln) => { let m = 999; for (const c of traffic) if (c.lane === ln && c.z < c.len / 2 + 3 && c.z > -120) m = Math.min(m, -c.z - c.len / 2); return m; };
    const side = (ln) => !traffic.some(c => c.lane === ln && Math.abs(c.z) < (c.len + 4.1) / 2 + 1.5);
    const here = clear(lane);
    if (here > 26 + speed * 0.25) return;
    let bestL = lane, bestD = here;
    for (const d of [-1, 1]) { const ln = lane + d; if (ln < 0 || ln >= LANES || !side(ln)) continue; const c = clear(ln); if (c > bestD + 4) { bestD = c; bestL = ln; } }
    if (bestL !== lane) steer(bestL - lane);
  },
};

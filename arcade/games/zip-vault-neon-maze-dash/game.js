// Zip Vault — original maze dasher. Swipe and Zip shoots wall-to-wall until something stops him.
// Climb the vault, eat the dots, grab the three stars, reach the beacon at the top before the rising goo catches you.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, note, burst, confetti, lerp, clamp, rng, rounded, mat } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const W = 11, SPD = 0.62;
const S = store('zipvault');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('zipvault');

const stage = createStage({ fov: 46, shadowSize: 15 });
const { scene, camera, sun, hemi } = stage;
hemi.intensity = 0.9; sun.intensity = 1.5;
const ui = createUI({ title: 'ZIP<br>VAULT', hint: 'Swipe to dash', hand: '👆' });
const D = daily('zipvault', ui, { name: 'Zip Vault: Neon Maze Dash' });

// level looks: dark vault floor + one bright wall colour + goo colour
const LOOKS = [
  { wall: '#3be8b0', deep: '#1f6e63', floor: '#231c45', goo: '#ff4fa3', ui: '#21c99a', bg: ['#2a2156', '#16122e'] },
  { wall: '#ff7eb6', deep: '#7a2f63', floor: '#1d2147', goo: '#7cff6b', ui: '#ff5d9e', bg: ['#2b1f4f', '#130f2a'] },
  { wall: '#7fb2ff', deep: '#2f4688', floor: '#261b3f', goo: '#ffb13b', ui: '#4d8dff', bg: ['#251d4a', '#120e26'] },
  { wall: '#ffcf5c', deep: '#7a5a1e', floor: '#1f1d42', goo: '#3df2ff', ui: '#f2a800', bg: ['#262150', '#110f28'] },
  { wall: '#b58cff', deep: '#4b2f8a', floor: '#1a2240', goo: '#ff6b4a', ui: '#9a6bff', bg: ['#22204c', '#0f0f26'] },
];

// ---------------------------------------------------------------- shared geometry / materials
const WALL_G = rounded(1, 1, 1.1, 0.12), DEEP_G = new THREE.BoxGeometry(1, 1, 1.1);
const DOT_G = new THREE.SphereGeometry(0.1, 10, 8), SPIKE_G = new THREE.ConeGeometry(0.15, 0.44, 6);
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.17 : 0.38; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; })();
const STAR_G = new THREE.ExtrudeGeometry(starShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 }); STAR_G.center();
const wallMat = mat('#ffffff', { roughness: 0.55 }), deepMat = mat('#ffffff', { roughness: 0.8 });
const dotMat = new THREE.MeshBasicMaterial({ color: '#fff3a8' }), spikeMat = mat('#ff3b5c', { roughness: 0.3, metalness: 0.2, emissive: '#c4002a', emissiveIntensity: 0.45 });
const starMat = mat('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.1 });
const floorTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d9d6ee'; x.fillRect(0, 0, 64, 3); x.fillRect(0, 0, 3, 64); x.fillStyle = '#ecebf7'; x.fillRect(29, 29, 6, 6);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
const floorMat = mat('#ffffff', { map: floorTex, roughness: 0.9 });

// ---------------------------------------------------------------- hero: Zip, a chubby coral cube-bot with antenna and big eyes
const hero = new THREE.Group(); scene.add(hero);
const heroBody = new THREE.Mesh(rounded(0.78, 0.78, 0.78, 0.22), mat('#ff7a59', { roughness: 0.35, emissive: '#ff3d1f', emissiveIntensity: 0.18 }));
heroBody.castShadow = true; hero.add(heroBody);
const visor = new THREE.Mesh(rounded(0.62, 0.34, 0.1, 0.08), mat('#2b1d3a', { roughness: 0.2 })); visor.position.set(0, 0.06, 0.38); hero.add(visor);
const eyes = []; for (const sx of [-0.14, 0.14]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: '#7dfcff' })); e.position.set(sx, 0.06, 0.44); e.scale.set(1, 1.25, 0.5); hero.add(e); eyes.push(e); }
const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), mat('#2b1d3a')); ant.position.set(0.18, 0.5, 0); hero.add(ant);
const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshBasicMaterial({ color: '#7dfcff' })); antBall.position.set(0.18, 0.66, 0); hero.add(antBall);
const cheekG = new THREE.CircleGeometry(0.05, 10); for (const sx of [-0.27, 0.27]) { const c = new THREE.Mesh(cheekG, new THREE.MeshBasicMaterial({ color: '#ffb3a1' })); c.position.set(sx, -0.14, 0.4); hero.add(c); }
const heroLight = new THREE.PointLight('#ff9b7a', 2.2, 5, 1.6); heroLight.position.set(0, 0, 1.2); hero.add(heroLight);

// beacon (exit) — a ring + light shaft
const beacon = new THREE.Group(); scene.add(beacon);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 28), new THREE.MeshBasicMaterial({ color: '#ffffff' })); beacon.add(ring);
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
shaft.rotation.x = Math.PI / 2; shaft.position.z = 3; beacon.add(shaft);

// rising goo: wavy top edge + glow strip
const GOO_SEG = 44;
const gooGeo = new THREE.PlaneGeometry(W + 4, 40, GOO_SEG, 1);
const gooMat = new THREE.MeshBasicMaterial({ color: '#ff4fa3', transparent: true, opacity: 0.88 });
const goo = new THREE.Mesh(gooGeo, gooMat); goo.position.z = 1.35; scene.add(goo);
const gooEdge = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, 0.5, GOO_SEG, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
gooEdge.position.z = 1.37; scene.add(gooEdge);

// ---------------------------------------------------------------- level generation (guaranteed slide path + side pockets)
const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
let R, rows, grid, lock, spike, exit, dots, stars, startX, startY;
const idx = (x, y) => y * W + x;
const isOpen = (x, y) => x >= 0 && x < W && y >= 0 && y < R && grid[idx(x, y)] === 1;

function generate(r, nRows, spikeP) {
  rows = nRows; R = rows + 5;
  for (let attempt = 0; attempt < 80; attempt++) {
    grid = new Uint8Array(W * R); lock = new Uint8Array(W * R);
    for (let y = 0; y < R; y++) { lock[idx(0, y)] = 2; lock[idx(W - 1, y)] = 2; }
    for (let x = 0; x < W; x++) { lock[idx(x, 0)] = 2; lock[idx(x, R - 1)] = 2; }
    let x = 5, y = 1, prev = null, ok = true; const path = [[x, y]]; lock[idx(x, y)] = 1;
    while (y < rows) {
      let moved = false;
      for (let tries = 0; tries < 40 && !moved; tries++) {
        const pick = r(), dir = pick < 0.46 ? 'up' : pick < 0.72 ? 'left' : pick < 0.98 ? 'right' : 'down';
        if (dir === prev || dir === OPP[prev]) continue;
        const [dx, dy] = DIRS[dir];
        const maxL = dir === 'up' ? 6 : dir === 'down' ? 2 : dir === 'left' ? x - 1 : W - 2 - x;
        if (maxL < 1) continue;
        const L = dir === 'up' ? 2 + Math.floor(r() * 4) : 1 + Math.floor(r() * maxL);
        let good = true;
        for (let k = 1; k <= L && good; k++) { const cx = x + dx * k, cy = y + dy * k; if (cy < 1 || cy >= R - 1 || lock[idx(cx, cy)] === 2) good = false; }
        const sx = x + dx * (L + 1), sy = y + dy * (L + 1);
        if (!good || sy < 0 || sy >= R || lock[idx(sx, sy)] === 1) continue;
        for (let k = 1; k <= L; k++) { lock[idx(x + dx * k, y + dy * k)] = 1; path.push([x + dx * k, y + dy * k]); }
        lock[idx(sx, sy)] = 2; x += dx * L; y += dy * L; prev = dir; moved = true;
      }
      if (!moved || path.length > 900) { ok = false; break; }
    }
    if (!ok) continue;
    exit = [x, y];
    // side pockets and loops: carve short runs from random open cells through unknown cells
    const opens = () => { const o = []; for (let i = 0; i < lock.length; i++) if (lock[i] === 1) o.push(i); return o; };
    let o = opens();
    for (let n = 0; n < rows * 0.9; n++) {
      const i = o[Math.floor(r() * o.length)], dir = ['up', 'left', 'right', 'down'][Math.floor(r() * 4)], [dx, dy] = DIRS[dir];
      let cx = i % W, cy = Math.floor(i / W); const L = 1 + Math.floor(r() * 4);
      for (let k = 0; k < L; k++) { cx += dx; cy += dy; if (cy < 1 || cy >= Math.min(R - 1, rows + 1) || lock[idx(cx, cy)] !== 0) break; lock[idx(cx, cy)] = 1; o.push(idx(cx, cy)); }
    }
    for (let i = 0; i < lock.length; i++) grid[i] = lock[i] === 1 ? 1 : 0;
    // spikes on free walls that face an open cell (never on a stopper of the guaranteed path)
    spike = new Uint8Array(W * R);
    for (let yy = 3; yy < R - 1; yy++) for (let xx = 1; xx < W - 1; xx++) {
      const i = idx(xx, yy); if (grid[i] || lock[i] !== 0) continue;
      const faces = (isOpen(xx, yy + 1) ? 1 : 0) | (isOpen(xx, yy - 1) ? 2 : 0) | (isOpen(xx - 1, yy) ? 4 : 0) | (isOpen(xx + 1, yy) ? 8 : 0);
      if (faces && r() < spikeP) spike[i] = faces;
    }
    // dots on every open cell; three stars spread along the path
    dots = []; for (let i = 0; i < grid.length; i++) if (grid[i] && i !== idx(5, 1) && i !== idx(exit[0], exit[1])) dots.push(i);
    stars = [0.3, 0.58, 0.84].map(f => { const [sx, sy] = path[Math.floor(path.length * f)]; return idx(sx, sy); });
    startX = 5; startY = 1; return true;
  }
  return false;
}

// ---------------------------------------------------------------- build scene for the level
let wallMesh, deepMesh, dotMesh, spikeMesh, floor, starMeshes = [], look, dotAlive, starAlive;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const wx = (x) => x - (W - 1) / 2;
function clearLevel() {
  for (const m of [wallMesh, deepMesh, dotMesh, spikeMesh, floor, ...starMeshes]) if (m) { scene.remove(m); if (m.isInstancedMesh) m.dispose(); }
  starMeshes = [];
}
let state = 'ready', px = 5, py = 1, gx = 5, gy = 1, moving = null, queued = null, gooY = -3, gooOn = false, score = 0, maxY = 1, shake = 0;
let squash = 0, squashDir = [0, 1], camY = 4, recorded = false, beatenShown = false, combo = 0, starsGot = 0, t0 = 0;

function buildLevel() {
  clearLevel();
  look = LOOKS[(level - 1) % LOOKS.length];
  const bs = document.body.style; bs.setProperty('--bg1', look.bg[0]); bs.setProperty('--bg2', look.bg[1]); bs.setProperty('--ui', look.ui);
  const fk = F.k(), seed = D.seed ? D.seed : level * 7919 + 13;
  const nRows = Math.min(84, 24 + level * 5);
  generate(rng(seed), nRows, clamp((0.05 + level * 0.025) * fk, 0, 0.42));
  // walls: bright rounded blocks along corridors, darker plain blocks deeper in the rock
  const edge = [], deep = [];
  for (let y = 0; y < R; y++) for (let x = 0; x < W; x++) {
    if (grid[idx(x, y)]) continue;
    let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (isOpen(x + dx, y + dy)) { near = true; break; }
    (near ? edge : deep).push([x, y]);
  }
  wallMat.color.set(look.wall); deepMat.color.set(look.deep);
  wallMesh = new THREE.InstancedMesh(WALL_G, wallMat, edge.length); wallMesh.castShadow = true; wallMesh.receiveShadow = true;
  edge.forEach(([x, y], i) => { _c.set(look.wall).offsetHSL(0, 0, ((x * 7 + y * 13) % 5 - 2) * 0.012); wallMesh.setMatrixAt(i, _m.makeTranslation(wx(x), y, 0.55)); wallMesh.setColorAt(i, _c); });
  deepMesh = new THREE.InstancedMesh(DEEP_G, deepMat, Math.max(1, deep.length)); deepMesh.receiveShadow = true;
  deep.forEach(([x, y], i) => deepMesh.setMatrixAt(i, _m.makeTranslation(wx(x), y, 0.55)));
  if (!deep.length) deepMesh.count = 0;
  // spikes: three cones per open-facing side
  const sp = [];
  for (let i = 0; i < spike.length; i++) if (spike[i]) { const x = i % W, y = Math.floor(i / W);
    for (const [bit, ang, ox, oy] of [[1, 0, 0, 0.5], [2, Math.PI, 0, -0.5], [4, Math.PI / 2, -0.5, 0], [8, -Math.PI / 2, 0.5, 0]]) if (spike[i] & bit)
      for (const t of [-0.28, 0, 0.28]) sp.push([wx(x) + ox + (oy ? t : 0), y + oy + (ox ? t : 0), ang]); }
  spikeMesh = new THREE.InstancedMesh(SPIKE_G, spikeMat, Math.max(1, sp.length)); spikeMesh.castShadow = true;
  sp.forEach(([x, y, a], i) => { _q.setFromEuler(_e.set(0, 0, a)); _m.compose(_p.set(x + Math.sin(-a) * 0.2, y + Math.cos(a) * 0.2, 0.5), _q, _s.set(1, 1, 1)); spikeMesh.setMatrixAt(i, _m); });
  if (!sp.length) spikeMesh.count = 0;
  dotMesh = new THREE.InstancedMesh(DOT_G, dotMat, dots.length);
  dots.forEach((i, k) => dotMesh.setMatrixAt(k, _m.makeTranslation(wx(i % W), Math.floor(i / W), 0.4)));
  dotAlive = new Map(dots.map((i, k) => [i, k]));
  starAlive = new Map();
  stars.forEach(i => { const m = new THREE.Mesh(STAR_G, starMat); m.position.set(wx(i % W), Math.floor(i / W), 0.55); m.castShadow = true; scene.add(m); starMeshes.push(m); starAlive.set(i, m); dotAlive.has(i) && hideDot(i); });
  floor = new THREE.Mesh(new THREE.PlaneGeometry(W, R), floorMat); floorMat.color.set(look.floor); floorTex.repeat.set(W, R);
  floor.position.set(0, (R - 1) / 2, 0); floor.receiveShadow = true;
  scene.add(wallMesh, deepMesh, spikeMesh, dotMesh, floor);
  beacon.position.set(wx(exit[0]), exit[1], 0.5); ring.material.color.set(look.wall); shaft.material.color.set(look.wall);
  gooMat.color.set(look.goo); gooEdge.material.color.set(look.goo).lerp(new THREE.Color('#ffffff'), 0.55); gooEdge.material.opacity = 0.95;
  // reset run
  gx = px = startX; gy = py = startY; moving = null; queued = null; gooY = -3.5; gooOn = false; score = 0; maxY = 1; recorded = false; beatenShown = false;
  starsGot = 0; combo = 0; camY = py + 4; squash = 0; hero.visible = true; hero.scale.set(1, 1, 1);
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : '');
}
function hideDot(i) { const k = dotAlive.get(i); if (k === undefined) return; dotMesh.setMatrixAt(k, _m.makeScale(0, 0, 0)); dotMesh.instanceMatrix.needsUpdate = true; dotAlive.delete(i); }

// ---------------------------------------------------------------- movement
function slideEnd(x, y, dir) { const [dx, dy] = DIRS[dir]; while (isOpen(x + dx, y + dy)) { x += dx; y += dy; } return [x, y]; }
function dash(dir) {
  if (state !== 'play') return;
  if (moving) { queued = dir; return; }
  const [tx, ty] = slideEnd(gx, gy, dir);
  if (tx === gx && ty === gy) { squash = 0.5; squashDir = DIRS[dir]; tone(200, 0.05, 'sine', 0.06); return; }
  moving = { dir, tx, ty }; combo = 0; gooOn = true; tone(330, 0.06, 'triangle', 0.08, 1.6);
}
function arrive() {
  const { dir } = moving; const [dx, dy] = DIRS[dir];
  px = gx = moving.tx; py = gy = moving.ty; moving = null;
  squash = 1; squashDir = [dx, dy]; shake = 0.12; buzz(10);
  tone(140, 0.08, 'square', 0.07, 0.6);
  burst(scene, new THREE.Vector3(wx(px) + dx * 0.45, py + dy * 0.45, 0.5), [look.wall, '#ffffff'], 7, { speed: 0.06, up: 0.02, size: 0.5, gravity: 0.0 , life: 0.6 });
  const ni = idx(gx + dx, gy + dy);
  if (spike[ni]) return die('SPIKED!');
  if (gx === exit[0] && gy === exit[1]) return win();
  if (queued) { const q = queued; queued = null; dash(q); }
}
function enterCell(x, y) {
  const i = idx(x, y);
  if (dotAlive.has(i)) { hideDot(i); score++; combo++; ui.score(score); note(72 + Math.min(combo, 14) % 15, 0.12, 0.07);
    if (D.beaten(score) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, new THREE.Vector3(wx(x), y, 1), 50); } }
  if (starAlive.has(i)) { const m = starAlive.get(i); starAlive.delete(i); scene.remove(m); starsGot++; score += 10; ui.score(score);
    ui.pop(['★', '★★', '★★★'][starsGot - 1], '#ffd23f', 50, 24); [0, 4, 7].forEach((s, k) => setTimeout(() => note(79 + s, 0.25, 0.12), k * 70));
    burst(scene, m.position, ['#ffd23f', '#fff3a8', '#ffffff'], 18, { speed: 0.12, up: 0.04, gravity: 0, size: 0.7 }); ui.flash(0.18); buzz(15); }
  if (y > maxY) { maxY = y; ui.progress(maxY / exit[1]); }
}

// ---------------------------------------------------------------- outcomes
function record(won) { if (recorded) return; recorded = true; F.level(won, clamp(maxY / exit[1], 0, 1)); }
function die(why) {
  if (state !== 'play') return;
  state = 'lost'; record(false); hero.visible = false; shake = 0.5; buzz([40, 30, 70]);
  tone(180, 0.3, 'sawtooth', 0.12, 0.4); setTimeout(() => tone(90, 0.4, 'square', 0.1, 0.5), 120);
  burst(scene, new THREE.Vector3(wx(px), py, 0.6), ['#ff7a59', '#2b1d3a', '#7dfcff'], 26, { speed: 0.16, up: 0.05, gravity: 0.003 });
  best = Math.max(best, score); S.set('best', best);
  ui.lose(why, `${Math.round(clamp(maxY / exit[1], 0, 1) * 100)}% climbed`);
}
function win() {
  state = 'won'; record(true); ui.progress(1);
  score += 25 + starsGot * 10; ui.score(score); best = Math.max(best, score); S.set('best', best);
  confetti(scene, new THREE.Vector3(wx(px), py + 0.5, 1.2), 80); ui.flash(0.5); buzz([20, 40, 20]);
  [0, 4, 7, 12, 16].forEach((s, k) => setTimeout(() => note(67 + s, 0.4, 0.15), k * 90));
  D.won(score);
  ui.win(level, `${'★'.repeat(starsGot)}${'☆'.repeat(3 - starsGot)}  ·  ${score} pts`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- input
input({ onSwipe: (d) => dash(d) });
addEventListener('keydown', e => { const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key]; if (k) dash(k); });
ui.onTap(() => { buildLevel(); state = 'play'; t0 = performance.now(); });

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  if (state === 'play' && moving) {
    const [dx, dy] = DIRS[moving.dir]; let step = SPD * dt;
    while (step > 0 && moving) {
      const rem = Math.abs(moving.tx - px) + Math.abs(moving.ty - py), s = Math.min(step, rem);
      const ox = Math.round(px), oy = Math.round(py);
      px += dx * s; py += dy * s; step -= s;
      const nx = Math.round(px), ny = Math.round(py);
      if (nx !== ox || ny !== oy) enterCell(nx, ny);
      if (s >= rem - 1e-6) { arrive(); break; }
    }
    if (moving && Math.random() < 0.7) burst(scene, new THREE.Vector3(wx(px) - dx * 0.35, py - dy * 0.35, 0.5), ['#ff7a59', '#ffd0b8'], 1, { speed: 0.01, up: 0, gravity: 0, size: 0.6, life: 0.5 });
  }
  // goo rises once you start moving; it hurries up if you are far ahead so the pressure never fades
  if (state === 'play' && gooOn) {
    const gap = py - gooY, base = (0.017 + Math.min(level, 12) * 0.0016) * F.k();
    gooY += base * (gap > 11 ? 2.6 : 1) * dt;
    if (gooY > py - 0.25) die('GOO\'D!');
  }
  // goo surface waves
  const gp = gooGeo.attributes.position, ep = gooEdge.geometry.attributes.position;
  for (let i = 0; i <= GOO_SEG; i++) { const w = Math.sin(i * 0.7 + t * 4) * 0.12 + Math.sin(i * 0.31 - t * 2.3) * 0.1; gp.setY(i, 20 + w); ep.setY(i, 0.25 + w); ep.setY(i + GOO_SEG + 1, -0.25 + w); }
  gp.needsUpdate = true; ep.needsUpdate = true;
  goo.position.y = gooY - 20; gooEdge.position.y = gooY;
  // hero pose: stretch while dashing, squash on impact, eyes look where he's going
  squash = Math.max(0, squash - 0.08 * dt);
  const dir = moving ? DIRS[moving.dir] : squashDir;
  const st = moving ? 0.38 : -squash * 0.4, horiz = dir[0] !== 0;
  hero.scale.set(horiz ? 1 + st : 1 - st * 0.6, horiz ? 1 - st * 0.6 : 1 + st, 1);
  hero.position.set(wx(px) - (moving ? 0 : dir[0] * squash * 0.12), py - (moving ? 0 : dir[1] * squash * 0.12), 0.5 + Math.sin(t * 5) * 0.03);
  for (const e of eyes) { e.position.x = Math.sign(e.position.x) * 0.14 + dir[0] * 0.06; e.position.y = 0.06 + dir[1] * 0.05; }
  antBall.material.color.setHSL(0.5, 1, 0.65 + Math.sin(t * 8) * 0.15);
  // spinning stars + pulsing beacon
  for (const m of starMeshes) m.rotation.y = t * 2.4;
  ring.rotation.z = t * 1.5; ring.scale.setScalar(1 + Math.sin(t * 5) * 0.08); shaft.material.opacity = 0.14 + Math.sin(t * 4) * 0.06;
  // camera follows upward with a little look-ahead
  camY = lerp(camY, Math.max(py + 3.2, 5), 0.07 * dt);
  shake = Math.max(0, shake - 0.02 * dt);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.position.set(sx, camY - 9.5 + sy, 22.5); camera.lookAt(0, camY, 0);
  sun.position.set(wx(px) + 5, camY + 6, 16); sun.target.position.set(wx(px), camY, 0);
});

buildLevel(); ui.start();

// ---------------------------------------------------------------- bot: shortest safe slide path to the beacon
function plan() {
  const key = (x, y) => y * W + x, prev = new Map([[key(gx, gy), null]]), q = [[gx, gy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === exit[0] && y === exit[1]) break;
    for (const d of ['up', 'left', 'right', 'down']) {
      const [tx, ty] = slideEnd(x, y, d), [dx, dy] = DIRS[d];
      if (spike[idx(tx + dx, ty + dy)] || prev.has(key(tx, ty))) continue;
      prev.set(key(tx, ty), [key(x, y), d]); q.push([tx, ty]);
    }
  }
  let k = key(exit[0], exit[1]); if (!prev.has(k)) return null;
  let first = null; while (prev.get(k)) { const [pk, d] = prev.get(k); first = d; k = pk; }
  return first;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() { if (state !== 'play' || moving) return; const d = plan(); if (d) dash(d); },
};

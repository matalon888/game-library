// Paint Glide — original maze painter. Swipe to send the paint ball rolling until it hits a wall;
// every tile it crosses gets painted. Paint the whole maze to clear the level.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, note, burst, confetti, rng, lerp, clamp, rounded } from './kit/hc.js';

const THEMES = [
  { bg: '#6f86ff', bg2: '#8fa0ff', paint: '#8b2cf0', deco: '#5fd6ff' },
  { bg: '#eedc45', bg2: '#f6e870', paint: '#ff2a78', deco: '#ffa63a' },
  { bg: '#ff9bbb', bg2: '#ffc0d3', paint: '#1e9bff', deco: '#ffffff' },
  { bg: '#6fdcab', bg2: '#9cebc8', paint: '#ff4a2e', deco: '#fff07a' },
  { bg: '#ad8bff', bg2: '#c6adff', paint: '#ffb703', deco: '#ff7ae0' },
  { bg: '#ff9058', bg2: '#ffb184', paint: '#2f3dff', deco: '#ffe0c2' },
  { bg: '#4fc3e8', bg2: '#83d8f2', paint: '#ff3d6e', deco: '#d6f6ff' },
];
const FLOOR = '#b2d0dc', WALL_H = 0.55, SPEED = 0.30; // cells per frame at 60 fps (~18 cells/s at top speed)
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const S = store('paintglide');
let level = S.get('level', 1);
const stage = createStage({ fov: 40, shadowSize: 10 });
const { scene, camera, sun } = stage;
stage.hemi.intensity = 1.25; sun.intensity = 1.35;
const ui = createUI({ title: 'PAINT<br>GLIDE', hint: 'Swipe to roll', hand: '👆', score: false });

// ---------------------------------------------------------------- level generation (seeded, always solvable, never stuck)
function generate(lv) {
  const cols = clamp(5 + Math.floor((lv - 1) / 2), 5, 11) + 2, rows = clamp(7 + Math.floor((lv - 1) / 1.5), 7, 15) + 2;
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rng(lv * 7919 + attempt * 104729 + 13);
    const g = new Uint8Array(cols * rows), prot = new Uint8Array(cols * rows), id = (c, w) => w * cols + c;
    const inside = (c, w) => c > 0 && w > 0 && c < cols - 1 && w < rows - 1;
    let c = 1 + Math.floor(r() * (cols - 2)), w = 1 + Math.floor(r() * (rows - 2)); const sc = c, sw = w;
    g[id(c, w)] = 1;
    const target = Math.floor((cols - 2) * (rows - 2) * (0.5 + Math.min(lv, 12) * 0.012));
    let floor = 1, last = '', moves = 0;
    for (let k = 0; k < 600 && floor < target; k++) {
      const names = Object.keys(DIRS), dn = names[Math.floor(r() * 4)]; if (dn === last) continue;
      const [dx, dy] = DIRS[dn];
      let ec = c, ew = w; while (g[id(ec + dx, ew + dy)]) { ec += dx; ew += dy; }          // where it rolls now
      let nc = ec + dx, nw = ew + dy;
      if (!inside(nc, nw) || prot[id(nc, nw)]) continue;
      const len = 1 + Math.floor(r() * (r() < 0.5 ? 2 : 5));
      let L = 0;
      while (L < len && inside(nc, nw) && !prot[id(nc, nw)] && !g[id(nc, nw)]) { g[id(nc, nw)] = 1; floor++; L++; ec = nc; ew = nw; nc += dx; nw += dy; }
      if (!L) continue;
      if (g[id(nc, nw)]) { // ran into existing floor: keep rolling to the real stop
        while (g[id(ec + dx, ew + dy)]) { ec += dx; ew += dy; }
        nc = ec + dx; nw = ew + dy;
      }
      prot[id(nc, nw)] = 1;                                                               // this wall must stay a wall
      c = ec; w = ew; last = dn; moves++;
    }
    if (floor < target * 0.85 || moves < 4) continue;
    const lvl = { cols, rows, g, start: [sc, sw], floor };
    if (stronglyConnected(lvl)) return crop(lvl);
  }
  throw new Error('maze gen failed');
}
function crop(l) {            // trim unused wall margin so the maze fills the board
  let c0 = 1e9, c1 = -1, w0 = 1e9, w1 = -1;
  for (let w = 0; w < l.rows; w++) for (let c = 0; c < l.cols; c++) if (l.g[w * l.cols + c]) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
  const cols = c1 - c0 + 3, rows = w1 - w0 + 3, g = new Uint8Array(cols * rows);
  for (let w = w0; w <= w1; w++) for (let c = c0; c <= c1; c++) g[(w - w0 + 1) * cols + (c - c0 + 1)] = l.g[w * l.cols + c];
  return { cols, rows, g, start: [l.start[0] - c0 + 1, l.start[1] - w0 + 1], floor: l.floor };
}
function roll(lvl, c, w, dn) {           // returns [endC, endW, cells[]] ; no move if blocked
  const [dx, dy] = DIRS[dn], cells = []; const id = (a, b) => b * lvl.cols + a;
  while (lvl.g[id(c + dx, w + dy)]) { c += dx; w += dy; cells.push(id(c, w)); }
  return [c, w, cells];
}
function reach(lvl, from) {
  const seen = new Map(), q = [from]; seen.set(from.join(), true);
  while (q.length) { const [c, w] = q.shift(); for (const dn in DIRS) { const [a, b, cells] = roll(lvl, c, w, dn); if (!cells.length) continue; const k = a + ',' + b; if (!seen.has(k)) { seen.set(k, true); q.push([a, b]); } } }
  return seen;
}
function stronglyConnected(lvl) {
  const all = reach(lvl, lvl.start);
  for (const k of all.keys()) { const back = reach(lvl, k.split(',').map(Number)); if (!back.has(lvl.start.join())) return false; }
  // every floor cell must be crossed by some reachable move
  const cov = new Set([lvl.start[1] * lvl.cols + lvl.start[0]]);
  for (const k of all.keys()) { const [c, w] = k.split(',').map(Number); for (const dn in DIRS) roll(lvl, c, w, dn)[2].forEach(i => cov.add(i)); }
  return cov.size === lvl.floor;
}

// ---------------------------------------------------------------- scene objects
const board = new THREE.Group(); scene.add(board);
const wallGeo = new THREE.BoxGeometry(1.002, WALL_H, 1.002);
const wallMat = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.7 });
const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const paintGeo = new THREE.PlaneGeometry(1.01, 1.01).rotateX(-Math.PI / 2);
const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.8 });
const paintMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.05 });
let walls, tiles, paints, base;
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), new THREE.MeshStandardMaterial({ color: '#8b2cf0', roughness: 0.18, metalness: 0.1 }));
ball.castShadow = true; scene.add(ball);
const shine = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 }));
scene.add(shine);
// decorative floating tubes (soft arcs) behind the board
const decoMat = new THREE.MeshStandardMaterial({ color: '#5fd6ff', roughness: 0.45 });
const decos = [];
for (let i = 0; i < 5; i++) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.6 + (i % 2) * 0.6, 0.45, 18, 40, Math.PI * (0.7 + (i % 3) * 0.15)), decoMat);
  m.userData = { ph: i * 1.7, x: [-6, 6.5, -6.5, 6, 0][i], z: [-9, -6, 7, 10, -13][i] };
  m.position.set(m.userData.x, -3, m.userData.z); m.rotation.set(-Math.PI / 2 + 0.3, 0, i * 1.3); scene.add(m); decos.push(m);
}

// ---------------------------------------------------------------- level state
let state = 'ready', L, theme, painted, paintAnim, paintedN = 0, bc = 0, bw = 0, moving = null, squash = 0, sqDir = [0, 0], camFit = 20, total = 0, spin = new THREE.Quaternion(), clock = 0, winT = 0, queued = null;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const X = (c) => c - (L.cols - 1) / 2, Z = (w) => w - (L.rows - 1) / 2;

function buildLevel() {
  L = generate(level); theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg); document.body.style.setProperty('--bg2', theme.bg2); document.body.style.setProperty('--ui', theme.paint);
  decoMat.color.set(theme.deco); ball.material.color.set(theme.paint); paintMat.color.set(theme.paint);
  [walls, tiles, paints, base].forEach(m => { if (m) { board.remove(m); m.dispose && m.dispose(); } });
  const n = L.cols * L.rows; let nw = 0, nf = 0;
  for (let i = 0; i < n; i++) L.g[i] ? nf++ : nw++;
  walls = new THREE.InstancedMesh(wallGeo, wallMat, nw); walls.castShadow = true; walls.receiveShadow = true;
  tiles = new THREE.InstancedMesh(tileGeo, floorMat, nf); tiles.receiveShadow = true;
  paints = new THREE.InstancedMesh(paintGeo, paintMat, nf); paints.receiveShadow = true; paints.frustumCulled = false;
  base = new THREE.Mesh(rounded(L.cols + 0.3, 0.6, L.rows + 0.3, 0.12).rotateX(0), wallMat); base.position.y = -0.46; base.receiveShadow = true;
  base.geometry.rotateX(Math.PI / 2); base.geometry.rotateX(-Math.PI / 2);
  painted = new Int32Array(n).fill(-1); paintAnim = [];
  let a = 0, b = 0;
  for (let w = 0; w < L.rows; w++) for (let c = 0; c < L.cols; c++) {
    const i = w * L.cols + c;
    if (!L.g[i]) { _m.makeTranslation(X(c), WALL_H / 2, Z(w)); walls.setMatrixAt(a++, _m); }
    else { _m.makeTranslation(X(c), 0.0, Z(w)); tiles.setMatrixAt(b, _m); _m.makeScale(0, 0, 0); paints.setMatrixAt(b, _m); painted[i] = -2 - b; b++; }
  }
  board.add(base, walls, tiles, paints);
  total = nf; paintedN = 0; moving = null; queued = null; squash = 0;
  [bc, bw] = L.start; ball.position.set(X(bc), 0.36, Z(bw)); ball.scale.setScalar(1); ball.visible = true;
  paintCell(bw * L.cols + bc, true);
  // fit the board on screen (portrait first)
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
  camFit = Math.max((L.rows + 1.6) / 2 / Math.tan(vf) * 1.12, (L.cols + 1.4) / 2 / Math.tan(hf) * 1.06);
  ui.levels(level); ui.progress(paintedN / total);
  ui.sub('');
}
function paintCell(i, silent) {
  if (painted[i] >= 0 || painted[i] === -1) return false;
  const k = -2 - painted[i]; painted[i] = k; paintedN++;
  paintAnim.push({ k, i, t: 0 });
  if (!silent) {
    const c = i % L.cols, w = Math.floor(i / L.cols);
    if (Math.random() < 0.55) burst(scene, new THREE.Vector3(X(c), 0.1, Z(w)), theme.paint, 2, { speed: 0.03, up: 0.03, size: 0.35, shape: 'sphere', gravity: 0.004, life: 0.6 });
  }
  return true;
}

function go(dn) {
  if (state !== 'play') return;
  if (moving) { queued = dn; return; }
  const [ec, ew, cells] = roll(L, bc, bw, dn);
  if (!cells.length) { // bump against wall: tiny nudge
    sqDir = DIRS[dn]; squash = 0.5; tone(200, 0.05, 'sine', 0.08, 0.8); return;
  }
  moving = { dn, from: [bc, bw], to: [ec, ew], cells, d: 0, len: cells.length, v: 0.08, newPaint: 0 };
  tone(330, 0.06, 'triangle', 0.08, 1.4);
}
function arrive() {
  const m = moving; [bc, bw] = m.to; moving = null;
  sqDir = DIRS[m.dn]; squash = 1;
  buzz(10); tone(150 + Math.random() * 30, 0.09, 'sine', 0.18, 0.6);
  burst(scene, new THREE.Vector3(X(bc) + sqDir[0] * 0.4, 0.3, Z(bw) + sqDir[1] * 0.4), [theme.paint, '#ffffff'], 7, { speed: 0.06, up: 0.06, size: 0.4, shape: 'sphere', gravity: 0.006, life: 0.8 });
  if (m.newPaint >= 6) ui.pop(m.newPaint >= 10 ? 'SPLASH!' : 'NICE!', '#fff', 32, 20);
  ui.progress(paintedN / total);
  if (paintedN >= total) return win();
  if (queued) { const q = queued; queued = null; go(q); }
}
function win() {
  state = 'won'; winT = 0; level++; S.set('level', level);
  sfx_win(); buzz([20, 40, 30]); ui.flash(0.45);
  confetti(scene, new THREE.Vector3(0, 1.5, 0), 90);
  ui.win(level - 1, `${total} tiles painted`);
}
function sfx_win() { [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(67 + s, 0.45, 0.17), i * 85)); }

// ---------------------------------------------------------------- input: swipe (fires mid-drag for snappy feel) + arrows
let acc = null;
input({
  onDown: () => { acc = { x: 0, y: 0, used: false }; },
  onMove: (dx, dy) => {
    if (!acc || acc.used) return; acc.x += dx; acc.y += dy;
    if (Math.hypot(acc.x, acc.y) > 22) { acc.used = true; go(Math.abs(acc.x) > Math.abs(acc.y) ? (acc.x > 0 ? 'right' : 'left') : (acc.y > 0 ? 'down' : 'up')); }
  },
  onUp: () => { acc = null; },
});
addEventListener('keydown', e => { const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key]; if (k) go(k); });
ui.onTap(which => { if (which === 'win' || which === 'lose') buildLevel(); state = 'play'; });

// ---------------------------------------------------------------- loop
const AX = new THREE.Vector3();
loop((dt, t) => {
  clock += dt / 60;
  if (moving) {
    const m = moving; m.v = Math.min(SPEED, m.v + 0.035 * dt); m.d = Math.min(m.len, m.d + m.v * dt);
    const [dx, dy] = DIRS[m.dn];
    ball.position.x = X(m.from[0]) + dx * m.d; ball.position.z = Z(m.from[1]) + dy * m.d;
    const passed = Math.min(m.len, Math.floor(m.d + 0.5));
    for (let k = 0; k < passed; k++) if (paintCell(m.cells[k])) { m.newPaint++; if (m.newPaint % 2 === 0) tone(520 + m.newPaint * 22, 0.04, 'sine', 0.05, 1.1); }
    AX.set(dy, 0, -dx); _q.setFromAxisAngle(AX, m.v * dt / 0.36); spin.premultiply(_q);
    ui.progress(paintedN / total);
    if (m.d >= m.len) arrive();
  }
  // paint tiles splat in (overshoot pop)
  for (const a of paintAnim) {
    a.t = Math.min(1, a.t + dt * 0.09);
    const c = a.i % L.cols, w = Math.floor(a.i / L.cols), e = a.t < 1 ? 1 + Math.sin(a.t * Math.PI) * 0.18 - (1 - a.t) * 0.6 : 1;
    _m.compose(_p.set(X(c), 0.025, Z(w)), _q.identity(), _s.set(Math.max(0, e), 1, Math.max(0, e))); paints.setMatrixAt(a.k, _m);
  }
  if (paintAnim.length) { paints.instanceMatrix.needsUpdate = true; paintAnim = paintAnim.filter(a => a.t < 1); }
  // ball squash on impact, along the travel axis
  squash = Math.max(0, squash - dt * 0.09);
  const s = Math.sin(squash * Math.PI) * 0.3 * (squash > 0 ? 1 : 0);
  ball.quaternion.copy(spin);
  if (state === 'won') { winT += dt; ball.position.y = 0.36 + Math.abs(Math.sin(winT * 0.12)) * 1.2; }
  else ball.position.y = 0.36 - s * 0.08;
  ball.scale.set(1 - Math.abs(sqDir[0]) * s + s * 0.3 * Math.abs(sqDir[1]), 1 + s * 0.2, 1 - Math.abs(sqDir[1]) * s + s * 0.3 * Math.abs(sqDir[0]));
  shine.position.set(ball.position.x - 0.12, ball.position.y + 0.22, ball.position.z - 0.08);
  // floating deco tubes bob
  decos.forEach((d, i) => { d.position.y = -3.5 + Math.sin(clock * 0.8 + d.userData.ph) * 0.4; d.rotation.z += 0.0015 * dt * (i % 2 ? 1 : -1); });
  // camera: near top-down with a slight tilt, gentle drift toward the ball
  const tilt = 0.24, bx = ball.position.x * 0.08, bz = ball.position.z * 0.06;
  camera.position.set(bx, Math.cos(tilt) * camFit, Math.sin(tilt) * camFit + bz - 0.3);
  camera.lookAt(bx, 0, bz - 0.3);
  stage.followLight(new THREE.Vector3(0, 0, 0));
});

buildLevel(); ui.start();

// ---------------------------------------------------------------- test hook + bot (BFS over roll positions → nearest move that paints something new)
function plan() {
  const start = [bc, bw], seen = new Set([start.join()]), q = [{ p: start, first: null }];
  while (q.length) {
    const { p, first } = q.shift();
    for (const dn in DIRS) {
      const [a, b, cells] = roll(L, p[0], p[1], dn); if (!cells.length) continue;
      const f = first || dn;
      if (cells.some(i => painted[i] < -1)) return f;
      const k = a + ',' + b; if (!seen.has(k)) { seen.add(k); q.push({ p: [a, b], first: f }); }
    }
  }
  return null;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return paintedN; },
  bot() { if (state !== 'play' || moving) return; const d = plan(); if (d) go(d); },
};


// Brick Climb — original game. Grab bricks of your colour, lay them as stair steps, climb to the top before your rivals.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, palette, applyPalette, mat, glossy, rounded, stickman, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

const ST = store('brickclimb');
let level = ST.get('level', 1), best = ST.get('best', 0);
const F = flow('brickclimb'); let fk = 1;
const { scene, camera, followLight, renderer } = createStage({ fov: 48, shadowSize: 16 });
const ui = createUI({ title: 'BRICK<br>CLIMB', hint: 'Drag to run', hand: '👆', score: false });

// ---------------------------------------------------------------- constants
const FW = 13, FD = 13, BL = 10, RISE = 4.2, LW = 1.8, LANES = [-4.3, 0, 4.3];
const COLORS = ['#2f80ff', '#ff3d6e', '#22c55e', '#ffb000'];
const NAMES = ['YOU', 'RED', 'GREEN', 'GOLD'];
const SPEED = 6.4 / 60;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const BLOCK_G = rounded(0.74, 0.26, 0.4, 0.06);
const STACK_G = rounded(0.66, 0.2, 0.38, 0.05);
const POST_G = new THREE.CylinderGeometry(0.2, 0.24, 1.1, 14); POST_G.translate(0, 0.55, 0);
const KNOB_G = new THREE.SphereGeometry(0.27, 16, 12);
const blockMats = COLORS.map(c => mat(c, { roughness: 0.35 }));
const white = mat('#ffffff', { roughness: 0.6 });

// ---------------------------------------------------------------- dom bits
const joyEl = document.createElement('div'); joyEl.className = 'joy'; joyEl.innerHTML = '<i></i>'; document.body.appendChild(joyEl);
const pillEl = document.createElement('div'); pillEl.className = 'stackpill'; pillEl.innerHTML = `<b style="background:${COLORS[0]}"></b><span>0</span>`; document.body.appendChild(pillEl);

// ---------------------------------------------------------------- level state
let world, state = 'ready', score = 0, nF, S, stepD, stepH, blocks, steps, chars, player, builtMesh, ghostMesh, blockMeshes, finishCount, winT = 0, camT = new THREE.Vector3(), t0 = 0, R;
const zc = k => -k * (FD + BL);
const zStart = k => zc(k) - FD / 2;                // front edge of floor k = start of bridge k

function buildLevel() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  const pal = palette(level); applyPalette(pal); ui.levels(level); ui.progress(0);
  R = rng(level * 7919 + 3); fk = F.k();
  nF = level === 1 ? 1 : level < 4 ? 2 : 3;
  S = Math.min(16, 9 + level);
  stepD = BL / S; stepH = RISE / S;
  finishCount = 0; winT = 0; state = state === 'ready' ? 'ready' : 'play';

  // water far below for depth
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#7fd6ff', roughness: 0.25, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -7, -40); water.receiveShadow = true; world.add(water);

  // floors
  const floorMat = mat('#ffffff', { roughness: 0.7, map: tileTex(pal.ground) });
  const sideMat = mat('#e9dccb', { roughness: 0.8 });
  for (let k = 0; k <= nF; k++) {
    const last = k === nF, d = last ? 8 : FD;
    const f = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.5, d), last ? glossy('#ffd23f', { metalness: 0.25 }) : floorMat);
    f.position.set(0, k * RISE - 0.25, last ? zStart(k - 1) - BL - d / 2 : zc(k)); f.receiveShadow = true; world.add(f);
    const base = new THREE.Mesh(new THREE.BoxGeometry(FW - 0.6, 2.4, d - 0.6), sideMat);
    base.position.set(0, k * RISE - 1.6, f.position.z); world.add(base);
    if (last) {   // finish podium + flags
      const pod = new THREE.Group(); pod.position.set(0, k * RISE, f.position.z);
      [[0, 1.0, '#ffffff'], [-1.7, 0.65, '#e8f0ff'], [1.7, 0.4, '#fff1e8']].forEach(([x, h, c], i) => {
        const b = new THREE.Mesh(rounded(1.6, h, 1.6, 0.12), mat(c)); b.position.set(x, h / 2, -1.2); b.castShadow = b.receiveShadow = true; pod.add(b);
      });
      for (const x of [-FW / 2 + 0.6, FW / 2 - 0.6]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), white); pole.position.set(x, 1.6, 2.6); pod.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.04), mat(COLORS[0])); flag.position.set(x + (x < 0 ? 0.55 : -0.55), 2.85, 2.6); pod.add(flag);
      }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 10, 40, Math.PI), mat('#ffffff')); arch.position.set(0, 0, 3.6); pod.add(arch);
      world.add(pod);
    }
  }

  // bridges
  const nL = LANES.length, total = nF * nL * S;
  ghostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(LW, 1, stepD * 0.98), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, roughness: 0.6 }), total);
  builtMesh = new THREE.InstancedMesh(rounded(LW - 0.04, 1, stepD * 0.96, 0.05), mat('#ffffff', { roughness: 0.4 }), total);
  builtMesh.castShadow = true; builtMesh.receiveShadow = true;
  const posts = new THREE.InstancedMesh(POST_G, white, nF * nL * 4), knobs = new THREE.InstancedMesh(KNOB_G, white, nF * nL * 4);
  posts.castShadow = true; knobs.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  steps = []; let pi = 0;
  const slope = Math.atan2(RISE, BL), len = Math.hypot(RISE, BL);
  for (let k = 0; k < nF; k++) {
    steps[k] = [];
    for (let L = 0; L < nL; L++) {
      const x = LANES[L], z0 = zStart(k), y0 = k * RISE;
      steps[k][L] = new Array(S).fill(-1).map(() => ({ o: -1, pop: 0 }));
      for (let j = 0; j < S; j++) {
        const i = (k * nL + L) * S + j;
        m4.compose(v.set(x, y0 + (j + 0.5) * stepH, z0 - (j + 0.5) * stepD), q.identity(), sc.set(1, stepH, 1)); ghostMesh.setMatrixAt(i, m4);
        builtMesh.setColorAt(i, new THREE.Color('#ffffff'));
      }
      // slab under the stairs + two rails
      const slab = new THREE.Mesh(new THREE.BoxGeometry(LW + 0.5, 0.35, len), white);
      slab.position.set(x, y0 + RISE / 2 - 0.35, z0 - BL / 2); slab.rotation.x = slope; slab.castShadow = true; slab.receiveShadow = true; world.add(slab);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, len), white);
        rail.position.set(x + s * (LW / 2 + 0.12), y0 + RISE / 2 + 0.3, z0 - BL / 2); rail.rotation.x = slope; rail.castShadow = true; world.add(rail);
        for (const [pz, py] of [[z0 + 0.1, y0], [z0 - BL - 0.1, y0 + RISE]]) {
          m4.compose(v.set(x + s * (LW / 2 + 0.12), py, pz), q.identity(), sc.set(1, 1, 1)); posts.setMatrixAt(pi, m4);
          m4.compose(v.set(x + s * (LW / 2 + 0.12), py + 1.2, pz), q.identity(), sc.set(1, 1, 1)); knobs.setMatrixAt(pi, m4); pi++;
        }
      }
    }
  }
  world.add(ghostMesh, builtMesh, posts, knobs);

  // bricks on each floor (only the start floor is filled at the beginning; a colour's bricks appear on a floor when its runner arrives)
  blocks = [];
  const cols = 6, rows = 6;
  for (let k = 0; k < nF; k++) {
    const bag = []; for (let i = 0; i < cols * rows; i++) bag.push(i % 4);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -FW / 2 + 1.4 + c * ((FW - 2.8) / (cols - 1)) + (R() - 0.5) * 0.5;
      const z = zc(k) + FD / 2 - 2.6 - r * ((FD - 4.6) / (rows - 1)) + (R() - 0.5) * 0.5;
      blocks.push({ k, x, z, c: bag[r * cols + c], alive: false, active: false, respawn: 0, pop: 0, rot: R() < 0.5 ? 0 : Math.PI / 2 });
    }
  }
  blockMeshes = COLORS.map((c, ci) => { const m = new THREE.InstancedMesh(BLOCK_G, blockMats[ci], blocks.filter(b => b.c === ci).length); m.castShadow = true; world.add(m); return m; });

  // runners
  chars = [];
  const startX = [-1.6, -4.8, 1.6, 4.8];
  for (let ci = 0; ci < 4; ci++) {
    const g = stickman(COLORS[ci], COLORS[ci], 1.12);
    g.head.material = g.body.material;
    const stackMesh = new THREE.InstancedMesh(STACK_G, blockMats[ci], 48); stackMesh.count = 0; stackMesh.castShadow = true; g.add(stackMesh);
    const ch = { ci, g, stackMesh, stack: 0, x: startX[ci], z: zc(0) + FD / 2 - 1.1, y: 0, floor: 0, lane: -1, p: 0, vx: 0, vz: 0, face: Math.PI, lean: 0, stun: 0,
      blocked: false, mode: 'collect', want: 0, aLane: 0, done: false, pop: 0, speed: ci === 0 ? SPEED : SPEED * Math.min(1.03, (0.64 + level * 0.035) * fk), think: 0, tgt: null, cool: 0 };
    g.position.set(ch.x, 0, ch.z); g.rotation.y = Math.PI; world.add(g);
    chars.push(ch);
  }
  player = chars[0];
  for (const ch of chars) { activateFloor(0, ch.ci); pickWant(ch); }
  if (state !== 'play' || !player) score = score; ui.sub(''); pillEl.querySelector('span').textContent = 0;
  camT.set(player.x, player.y, player.z); placeCamera(1);
}

function tileTex(base) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const col = new THREE.Color(base), dark = col.clone().multiplyScalar(0.93);
  x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#' + dark.getHexString(); x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(FW / 4, FD / 4); t.anisotropy = 4;
  return t;
}
function activateFloor(k, ci) {
  for (const b of blocks) if (b.k === k && b.c === ci && !b.active) { b.active = true; b.alive = true; b.pop = 1 + Math.random() * 0.6; }
}

// ---------------------------------------------------------------- input: floating joystick
let joy = { x: 0, y: 0 }, botJoy = null, down = false;
input({
  onDown(e, st) { if (state !== 'play') return; down = true; botJoy = null; joyEl.style.display = 'block'; joyEl.style.left = st.x + 'px'; joyEl.style.top = st.y + 'px'; joy.x = joy.y = 0; },
  onMove(dx, dy, e, st) {
    if (!down) return; let jx = st.lx - st.x, jy = st.ly - st.y; const l = Math.hypot(jx, jy), m = 48;
    if (l > m) { jx *= m / l; jy *= m / l; }
    joy.x = jx / m; joy.y = jy / m; joyEl.firstChild.style.transform = `translate(${jx}px,${jy}px)`;
  },
  onUp() { down = false; joy.x = joy.y = 0; joyEl.style.display = 'none'; joyEl.firstChild.style.transform = ''; },
});

ui.onTap(w => {
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; score = 0; buildLevel(); }
});

// ---------------------------------------------------------------- AI (also drives the QA bot)
function laneNeed(ch, k, L) { let n = 0; for (const s of steps[k][L]) if (s.o !== ch.ci) n++; return n; }
function brain(ch) {
  if (ch.floor >= nF) return { x: -ch.x * 0.3, z: (zStart(nF - 1) - BL - 4.5 - ch.z) * 0.3 };
  const k = ch.floor;
  if (ch.mode === 'collect' && ch.lane < 0) {
    if (ch.stack >= ch.want && ch.stack > 0) ch.mode = 'climb';
  }
  if (ch.mode === 'climb') {
    if (ch.lane >= 0) {
      if (ch.blocked && ch.stack === 0) { ch.mode = 'collect'; pickWant(ch); }
      else return { x: (LANES[ch.lane] - ch.x) * 2, z: -1 };
    } else return { x: LANES[ch.aLane] - ch.x, z: (zStart(k) - 1.2 - ch.z) };
  }
  // collect: go to nearest live brick of my colour on this floor
  let bestB = null, bd = 1e9;
  for (const b of blocks) if (b.k === k && b.c === ch.ci && b.alive) { const d = Math.hypot(b.x - ch.x, b.z - ch.z) + (ch === player ? 0 : (b.x * 0.13 * ch.ci) % 1.2); if (d < bd) { bd = d; bestB = b; } }
  if (ch.lane >= 0) return { x: 0, z: 1 };            // walk back down off the bridge
  if (!bestB) return { x: -ch.x, z: zc(k) - ch.z };
  return { x: bestB.x - ch.x, z: bestB.z - ch.z };
}
function pickWant(ch) {
  const k = ch.floor;
  let bl = 0, bn = 1e9;
  for (let L = 0; L < LANES.length; L++) { const n = laneNeed(ch, k, L) + (ch === player ? 0 : R() * 3) + Math.abs(LANES[L] - ch.x) * 0.15; if (n < bn) { bn = n; bl = L; } }
  ch.aLane = bl;
  const need = laneNeed(ch, k, bl);
  ch.want = ch === player ? need : Math.max(3, need + Math.floor(R() * 4) - (level < 3 ? 1 : 2));
}

// ---------------------------------------------------------------- simulation
function moveChar(ch, dir, dt) {
  if (ch.stun > 0) { ch.stun -= dt; ch.vx *= 0.8; ch.vz *= 0.8; }
  else {
    let l = Math.hypot(dir.x, dir.z);
    const tx = l > 0.05 ? dir.x / Math.max(l, 1) : 0, tz = l > 0.05 ? dir.z / Math.max(l, 1) : 0;
    const a = 0.25 * dt;
    ch.vx = lerp(ch.vx, tx * ch.speed, a); ch.vz = lerp(ch.vz, tz * ch.speed, a);
  }
  let nx = ch.x + ch.vx * dt, nz = ch.z + ch.vz * dt;
  const k = ch.floor;
  ch.blocked = false;
  if (ch.floor >= nF) {   // finish platform
    const zf = zStart(nF - 1) - BL; nx = clamp(nx, -FW / 2 + 0.4, FW / 2 - 0.4); nz = clamp(nz, zf - 7.6, zf - 0.2);
  } else if (ch.lane < 0) {
    nx = clamp(nx, -FW / 2 + 0.35, FW / 2 - 0.35);
    nz = Math.min(nz, zc(k) + FD / 2 - 0.35);
    if (nz < zStart(k) + 0.1) {
      const L = LANES.findIndex(x => Math.abs(nx - x) < LW / 2 - 0.15);
      if (L >= 0 && ch.vz < 0) { ch.lane = L; ch.p = 0; }
      else nz = zStart(k) + 0.1;
    }
  }
  if (ch.lane >= 0 && ch.floor < nF) {
    const lx = LANES[ch.lane]; nx = clamp(nx, lx - LW / 2 + 0.3, lx + LW / 2 - 0.3);
    let p = zStart(k) - nz;
    if (p < -0.05) { ch.lane = -1; }
    else {
      const prevJ = Math.floor((ch.p + 0.25) / stepD), j = Math.min(S - 1, Math.floor((p + 0.25) / stepD));
      for (let s = Math.max(0, prevJ); s <= j; s++) {
        const st = steps[k][ch.lane][s];
        if (st.o === ch.ci) continue;
        if (ch.stack > 0) placeStep(ch, k, ch.lane, s);
        else { p = Math.min(p, s * stepD - 0.26); ch.blocked = true; if (ch === player && !ch.warned) { ch.warned = true; ui.pop('NEED BRICKS!', '#fff', 30, 30); buzz(15); } break; }
      }
      if (!ch.blocked) ch.warned = false;
      ch.p = p; nz = zStart(k) - p;
      if (p > BL) { arrive(ch, k + 1); }
    }
  }
  ch.x = nx; ch.z = nz;
  // height
  let ty = ch.floor * RISE;
  if (ch.lane >= 0 && ch.floor < nF) ty = ch.floor * RISE + Math.min(S, Math.max(0, Math.floor(ch.p / stepD) + 1)) * stepH;
  ch.y = lerp(ch.y, ty, 0.35 * dt);
}

function placeStep(ch, k, L, s) {
  const st = steps[k][L][s], stolen = st.o >= 0;
  st.o = ch.ci; st.pop = 1; ch.stack--; ch.pop = 0.6;
  builtMesh.setColorAt((k * LANES.length + L) * S + s, new THREE.Color(COLORS[ch.ci])); builtMesh.instanceColor.needsUpdate = true;
  if (ch === player) {
    score++; ui.score(score);
    const n = s % 7, o = Math.floor(s / 7);
    note(67 + MAJOR[n] + o * 12, 0.25, 0.13); buzz(6);
    burst(world, new THREE.Vector3(LANES[L], k * RISE + (s + 1) * stepH, zStart(k) - (s + 0.5) * stepD), [COLORS[0], '#ffffff'], stolen ? 10 : 5, { speed: 0.06, up: 0.06, size: 0.6 });
    if (stolen) ui.pop('STOLEN!', '#fff', 28, 30);
  }
}

function arrive(ch, k) {
  ch.lane = -1; ch.floor = k; ch.mode = 'collect'; ch.p = 0;
  if (k >= nF) {
    finishCount++; ch.done = true;
    if (ch === player && finishCount === 1) return win();
    if (ch !== player && finishCount === 1 && state === 'play') return lose(ch);
    return;
  }
  ch.z = zc(k) + FD / 2 - 0.4;
  activateFloor(k, ch.ci); pickWant(ch);
  if (ch === player) { sfx.coin(); ui.pop('FLOOR ' + (k + 1) + '!', '#fff', 40, 26); ui.flash(0.25); buzz(20); }
}

function knock(a, b) {   // a has more bricks; b drops its stack
  const lost = b.stack; b.stack = 0; b.stun = 55; b.mode = 'collect'; pickWant(b);
  const p = new THREE.Vector3(b.x, b.y + 1.2, b.z);
  burst(world, p, COLORS[b.ci], Math.min(22, 6 + lost), { speed: 0.16, up: 0.14, size: 1.3, gravity: 0.01 });
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  b.vx = dx / l * 0.22; b.vz = dz / l * 0.22;
  if (b === player) { ui.pop('KNOCKED!', '#ff3d6e', 38, 26); sfx.fail(); buzz([30, 30, 50]); ui.flash(0.3); }
  else if (a === player) { ui.pop('SMASH!', '#ffd23f', 42, 26); sfx.smash(); buzz(25); }
}

function win() {
  state = 'won'; F.level(true); winT = 0; score += 20 * level; ui.score(score); best = Math.max(best, score); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
  const p = new THREE.Vector3(player.x, player.y + 2, player.z);
  confetti(world, p, 90); setTimeout(() => confetti(world, p, 70), 300);
  ui.win(level, '1st place!');
}
function lose(ch) {
  state = 'lost'; F.level(false, (player.floor + (player.lane >= 0 ? player.p / BL : 0)) / nF); winT = 0; sfx.fail(); buzz([40, 30, 60]);
  ui.lose(NAMES[ch.ci] + ' WON', 'So close! Grab more bricks.');
}

// ---------------------------------------------------------------- render helpers
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), E = new THREE.Euler();
function updateMeshes(t, dt) {
  const counts = [0, 0, 0, 0];
  for (const b of blocks) {
    const mesh = blockMeshes[b.c], i = counts[b.c]++;
    if (!b.alive) { b.respawn -= dt; if (b.active && b.respawn <= 0) { b.alive = true; b.pop = 1; } }
    let s = b.alive ? 1 : 0;
    if (b.alive && b.pop > 0) { b.pop = Math.max(0, b.pop - 0.05 * dt); s = b.pop > 1 ? 0 : 1 - Math.sin(b.pop * Math.PI) * 0.4 - b.pop * 0.6; s = Math.max(0, s); }
    M.compose(V.set(b.x, b.k * RISE + 0.1 + (b.alive ? Math.sin(t * 3 + b.x) * 0.0 : 0), b.z), Q.setFromEuler(E.set(0, b.rot, 0)), SC.setScalar(s)); mesh.setMatrixAt(i, M);
  }
  for (const m of blockMeshes) m.instanceMatrix.needsUpdate = true;
  for (let k = 0; k < nF; k++) for (let L = 0; L < LANES.length; L++) for (let s = 0; s < S; s++) {
    const st = steps[k][L][s], i = (k * LANES.length + L) * S + s;
    if (st.pop > 0) st.pop = Math.max(0, st.pop - 0.08 * dt);
    const sc = st.o < 0 ? 0 : 1 + Math.sin(st.pop * Math.PI) * 0.35;
    M.compose(V.set(LANES[L], k * RISE + (s + 0.5) * stepH + st.pop * 0.25, zStart(k) - (s + 0.5) * stepD), Q.identity(), SC.set(sc, stepH * sc, sc)); builtMesh.setMatrixAt(i, M);
  }
  builtMesh.instanceMatrix.needsUpdate = true;
  for (const ch of chars) {
    const g = ch.g, sp = Math.hypot(ch.vx, ch.vz) / SPEED;
    g.position.set(ch.x, ch.y, ch.z);
    if (sp > 0.08 && ch.stun <= 0) { const f = Math.atan2(ch.vx, ch.vz); let d = f - ch.face; d = Math.atan2(Math.sin(d), Math.cos(d)); ch.lean = lerp(ch.lean, -d * 0.6, 0.15); ch.face += d * 0.25 * dt; }
    else ch.lean = lerp(ch.lean, 0, 0.1);
    g.rotation.y = ch.face;
    g.rotation.x = ch.stun > 0 ? lerp(g.rotation.x, -1.35, 0.3) : lerp(g.rotation.x, ch.stack > 0 ? 0.06 : 0, 0.2);
    if (ch.done && state !== 'play') { g.run(t * 0.5, 0); g.armL.rotation.z = -2.6 - Math.sin(t * 10) * 0.3; g.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.3; g.position.y += Math.abs(Math.sin(t * 8)) * 0.4; }
    else {
      g.armL.rotation.z = g.armR.rotation.z = 0;
      g.run(t, Math.min(1, sp));
      if (ch.stack > 0) { g.armL.rotation.x = -1.3 + Math.sin(t * 12) * 0.1; g.armR.rotation.x = -1.3 - Math.sin(t * 12) * 0.1; }
    }
    ch.pop = Math.max(0, ch.pop - 0.06 * dt);
    const n = Math.min(48, ch.stack); ch.stackMesh.count = n;
    for (let i = 0; i < n; i++) {
      const top = i === n - 1 ? 1 + ch.pop * 0.5 : 1, sway = ch.lean * i * i * 0.004 + Math.sin(t * 6 + i * 0.3) * 0.004 * i * Math.min(1, sp);
      M.compose(V.set(sway, 0.62 + i * 0.205, -0.42 - Math.min(0.25, i * i * 0.0008) * Math.min(1, sp)), Q.setFromEuler(E.set(0, 0, sway * 0.4)), SC.setScalar(top)); ch.stackMesh.setMatrixAt(i, M);
    }
    ch.stackMesh.instanceMatrix.needsUpdate = true;
  }
}

function placeCamera(a) {
  const p = player;
  camT.lerp(V.set(p.x * 0.75, p.y, p.z), a);
  if (state === 'won') {
    winT += 0.012;
    camera.position.set(camT.x + Math.sin(winT) * 7, camT.y + 6, camT.z + Math.cos(winT) * 7); camera.lookAt(camT.x, camT.y + 1.5, camT.z);
  } else {
    camera.position.set(camT.x, camT.y + 9.2, camT.z + 7.6); camera.lookAt(camT.x, camT.y + 0.4, camT.z - 2.4);
  }
  followLight(V.set(p.x, p.y, p.z - 3));
}

let rankTxt = '';
function rankOf() {
  const prog = ch => ch.floor + (ch.lane >= 0 ? ch.p / BL : 0) + ch.stack * 0.004;
  const me = prog(player); let r = 1; for (const ch of chars) if (ch !== player && prog(ch) > me) r++;
  return r;
}

loop((dt, t) => {
  if (!world) return;
  if (state === 'play') {
    for (const ch of chars) {
      let dir;
      if (ch === player) {
        if (down) dir = { x: joy.x, z: joy.y };
        else if (botJoy) dir = botJoy;
        else dir = { x: 0, z: 0 };
      } else {
        ch.think -= dt; if (ch.think <= 0 || !ch.tgt) { ch.think = 6 + Math.random() * 8; ch.tgt = brain(ch); }
        dir = ch.tgt;
      }
      moveChar(ch, dir, dt);
      if (state !== 'play') break;
      // pickups
      if (ch.lane < 0 && ch.floor < nF) {
        for (const b of blocks) {
          if (!b.alive || b.c !== ch.ci || b.k !== ch.floor) continue;
          if (Math.abs(b.x - ch.x) < 0.75 && Math.abs(b.z - ch.z) < 0.75) {
            b.alive = false; b.respawn = 200 + Math.random() * 120; ch.stack = Math.min(60, ch.stack + 1); ch.pop = 1;
            if (ch === player) { sfx.pick(ch.stack % 10); buzz(5); pillEl.querySelector('span').textContent = ch.stack; }
          }
        }
      }
    }
    // bumps
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const a = chars[i], b = chars[j];
      if (a.floor !== b.floor || a.floor >= nF || a.stun > 0 || b.stun > 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.75 && d > 0.001) {
        const push = (0.75 - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
        if (a.lane < 0 && b.lane < 0 && a.cool <= 0 && b.cool <= 0 && a.stack !== b.stack) {
          const [big, small] = a.stack > b.stack ? [a, b] : [b, a];
          if (small.stack > 0 && big.stack >= small.stack + (level < 3 ? 4 : 2)) { knock(big, small); a.cool = b.cool = 90; }
        }
      }
    }
    for (const ch of chars) ch.cool = Math.max(0, ch.cool - dt);
    if (state === 'play') {
      ui.progress((player.floor + (player.lane >= 0 ? player.p / BL : 0)) / nF);
      pillEl.querySelector('span').textContent = player.stack;
      const r = rankOf(), txt = ['1ST', '2ND', '3RD', '4TH'][r - 1] + ' PLACE';
      if (txt !== rankTxt) { rankTxt = txt; ui.sub(txt); }
    }
  }
  updateMeshes(t, dt);
  placeCamera(state === 'won' ? 0.05 : 0.12 * dt);
});

buildLevel();
ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (player.mode === 'collect' && player.lane < 0 && player.want === 0) pickWant(player);
    if (player.mode === 'collect' && player.lane < 0) { pickWant(player); if (player.stack >= player.want) player.mode = 'climb'; }
    botJoy = brain(player);
  },
};

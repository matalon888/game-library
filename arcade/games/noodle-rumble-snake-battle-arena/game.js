// Noodle Rumble — original snake-battle arena. Drag to steer a jelly noodle-snake: eat orbs to grow,
// swallow any smaller snake you touch, dodge bigger ones, and grow big enough to swallow the crowned boss.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, sfx, note, burst, confetti, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const KEY = 'noodle', NAME = 'Noodle Rumble: Snake Battle Arena';
const S = store(KEY);
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow(KEY);

const stage = createStage({ fov: 46, shadowSize: 26 });
const { scene, camera, sun, hemi } = stage;
hemi.intensity = 1.25; hemi.groundColor.set('#8a7fb8'); sun.intensity = 1.6;
const ui = createUI({ title: 'NOODLE<br>RUMBLE', hint: 'Drag to steer', hand: '👆' });
const D = daily(KEY, ui, { name: NAME });

// ---------------------------------------------------------------- palettes
const ACCENTS = ['#ff4f9a', '#2bd4a8', '#8b6bff', '#ff8a3d', '#3d8bff', '#ffbf1f'];
const ME = ['#45e3b8', '#e9fff6'];
const AI_COLS = [['#ff6fae', '#ffe0ee'], ['#9b6bff', '#e3d8ff'], ['#ff8a3d', '#ffe0c4'], ['#3d8bff', '#d2e5ff'], ['#a6e22e', '#f4ffcf'], ['#ff4d5e', '#ffd0d5'], ['#21c7e8', '#d4f7ff']];
const BOSS = ['#ff3d6e', '#2b2440'];
const FLOORS = [['#3a3552', '#433d5e'], ['#2c3557', '#35406a'], ['#40304f', '#4b3a5e'], ['#283c52', '#304862']];

// ---------------------------------------------------------------- floor + arena wall
function floorTex(c1, c2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, 256, 256);
  g.fillStyle = c2; g.fillRect(4, 4, 120, 120); g.fillRect(132, 132, 120, 120);
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(4, 4, 120, 3); g.fillRect(132, 132, 120, 3);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const arenaMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const arena = new THREE.Mesh(new THREE.CircleGeometry(1, 96), arenaMat); arena.rotation.x = -Math.PI / 2; arena.position.y = 0.01; arena.receiveShadow = true; scene.add(arena);
const rimMat = new THREE.MeshStandardMaterial({ color: '#ff4f9a', roughness: 0.35, emissive: '#ff4f9a', emissiveIntensity: 0.35 });
const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 10, 160), rimMat); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.35; scene.add(rim);
const POSTS = 64;
const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, 1.3, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), POSTS);
posts.castShadow = true; scene.add(posts);

// ---------------------------------------------------------------- body segments (one instanced mesh for every snake)
const MAXSEG = 2400;
const segMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.04 }), MAXSEG);
segMesh.castShadow = true; segMesh.frustumCulled = false; scene.add(segMesh);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
for (let i = 0; i < MAXSEG; i++) segMesh.setColorAt(i, _c.set('#fff'));

// ---------------------------------------------------------------- food orbs
const MAXF = 300;
const foodMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.2, emissive: '#ffb300', emissiveIntensity: 0.35 }), MAXF);
foodMesh.castShadow = true; foodMesh.frustumCulled = false; scene.add(foodMesh);
let food = [];

// ---------------------------------------------------------------- splat decals (paint splash when a snake is swallowed)
function splatGeo() {
  const s = new THREE.Shape(), n = 22;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = 1 + (i % 2 ? 0.35 : 0) * Math.random() + Math.random() * 0.15; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); }
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g;
}
const splats = [];
for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(splatGeo(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.position.y = 0.03; m.visible = false; scene.add(m); splats.push({ m, t: 1 }); }
function splat(x, z, col, size) {
  const s = splats.find(s => s.t >= 1) || splats[0]; s.t = 0; s.size = size; s.m.visible = true;
  s.m.position.set(x, 0.03 + Math.random() * 0.01, z); s.m.rotation.y = Math.random() * 6; s.m.material.color.set(col);
}

// ---------------------------------------------------------------- snake heads: round jelly noodle head with big eyes + mouth (crown on the boss)
const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 }), black = new THREE.MeshStandardMaterial({ color: '#1b1830', roughness: 0.3 });
const mouthMat = new THREE.MeshStandardMaterial({ color: '#7a0f2b', roughness: 0.5 }), gold = new THREE.MeshStandardMaterial({ color: '#ffc21a', roughness: 0.25, metalness: 0.4, emissive: '#7a5200', emissiveIntensity: 0.3 });
const SPH = new THREE.SphereGeometry(1, 20, 14);
function makeHead(col, boss) {
  const g = new THREE.Group();
  const skull = new THREE.Mesh(SPH, new THREE.MeshStandardMaterial({ color: col, roughness: 0.25 })); skull.scale.set(1.35, 1.05, 1.2); skull.position.y = 1.0; skull.castShadow = true;
  const mouth = new THREE.Mesh(SPH, mouthMat); mouth.scale.set(0.35, 0.18, 0.75); mouth.position.set(1.18, 0.75, 0);
  g.add(skull, mouth);
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(SPH, white); eye.scale.setScalar(0.42); eye.position.set(0.62, 1.62, sz * 0.5);
    const pup = new THREE.Mesh(SPH, black); pup.scale.setScalar(0.21); pup.position.set(0.95, 1.68, sz * 0.52);
    g.add(eye, pup);
  }
  if (boss) {
    const crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.32, 16, 1, true), gold); band.material.side = THREE.DoubleSide;
    crown.add(band);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 6), gold); c.position.set(Math.cos(a) * 0.6, 0.34, Math.sin(a) * 0.6); crown.add(c); }
    crown.position.set(-0.1, 2.1, 0); crown.rotation.z = 0.12; g.add(crown);
  }
  g.mouth = mouth; scene.add(g); return g;
}

// ---------------------------------------------------------------- snake model
const STEP = 0.12;                                     // trail sample spacing
const radius = (len) => 0.42 + Math.min(1.25, len * 0.013);
const spacing = (r) => r * 0.72;
let snakes = [], player = null, boss = null, R = 30, state = 'ready', score = 0, kills = 0, beatShown = false, recorded = false;
let camH = 22, shake = 0, aiSpeedK = 1, chaseR = 12, respawnQ = [], clock = 0, foodCombo = 0, foodComboT = 0, wonAt = 0;

function makeSnake({ x, z, ang, len, cols, ai = true, isBoss = false }) {
  const s = { x, z, ang, tAng: ang, len, cols, ai, isBoss, alive: true, dying: null, popped: 0, pts: [], head: makeHead(cols[0], isBoss), squash: 0, plan: 0, gulp: 0, id: snakes.length };
  const tag = document.createElement('div'); tag.className = 'tag'; document.body.appendChild(tag); s.tag = tag;
  // pre-fill a straight trail behind the head
  const r = radius(len), n = Math.ceil((len + 3) * spacing(r) / STEP);
  for (let i = n; i >= 0; i--) s.pts.push({ x: x - Math.cos(ang) * i * STEP, z: z - Math.sin(ang) * i * STEP });
  snakes.push(s); return s;
}
function removeSnake(s) { scene.remove(s.head); s.tag.remove(); s.alive = false; }

function segCount(s) { return Math.max(3, Math.round(s.len)); }
function segPos(s, i, out) {                            // i = 0 first body segment behind the head
  const r = radius(s.len), k = s.pts.length - 1 - Math.round((i + 1) * spacing(r) / STEP);
  const p = s.pts[Math.max(0, k)]; out.x = p.x; out.z = p.z; return out;
}

// ---------------------------------------------------------------- level
function clearLevel() {
  for (const s of snakes) if (s.alive) removeSnake(s);
  snakes = []; respawnQ = []; food = [];
}
function buildLevel() {
  clearLevel();
  const seed = D.seed || level * 7919 + 31, r = rng(seed), fk = F.k();
  aiSpeedK = clamp(fk, 0.85, 1.25); chaseR = (9 + Math.min(level, 6)) * fk;
  R = 28 + Math.min(level, 10) * 1.4;
  const acc = ACCENTS[(level - 1) % ACCENTS.length], fl = FLOORS[(level - 1) % FLOORS.length];
  document.body.style.setProperty('--ui', acc);
  floor.material.map = floorTex(fl[0], '#2a263d'); floor.material.map.repeat.set(60, 60); floor.material.color.set('#9a94b8'); floor.material.needsUpdate = true;
  arenaMat.map = floorTex(fl[0], fl[1]); arenaMat.map.repeat.set(R / 2.2, R / 2.2); arenaMat.needsUpdate = true;
  arena.scale.setScalar(R); rim.scale.setScalar(R); rimMat.color.set(acc); rimMat.emissive.set(acc);
  for (let i = 0; i < POSTS; i++) { const a = i / POSTS * Math.PI * 2; _m.compose(_p.set(Math.cos(a) * (R + 0.6), 0.65, Math.sin(a) * (R + 0.6)), _q.identity(), _s.set(1, 1, 1)); posts.setMatrixAt(i, _m); posts.setColorAt(i, _c.set(i % 2 ? '#ffffff' : acc)); }
  posts.instanceMatrix.needsUpdate = true; posts.instanceColor.needsUpdate = true;

  player = makeSnake({ x: 0, z: 0, ang: -Math.PI / 2, len: 10, cols: ME, ai: false });
  const bossLen = Math.round(clamp((26 + level * 5) * fk, 22, 140));
  const ba = r() * Math.PI * 2;
  boss = makeSnake({ x: Math.cos(ba) * R * 0.62, z: Math.sin(ba) * R * 0.62, ang: ba + Math.PI / 2, len: bossLen, cols: BOSS, isBoss: true });
  const nAi = 4 + Math.min(level, 5);
  for (let i = 0; i < nAi; i++) spawnAI(r, i);
  for (let i = 0; i < 230; i++) addFood(r);
  score = 0; kills = 0; beatShown = false; recorded = false; wonAt = 0;
  camH = 22; ui.levels(level); ui.progress(player.len / boss.len); ui.score(Math.round(player.len)); ui.sub(best ? 'BEST ' + best : '');
}
function spawnAI(r = Math.random, i = 0) {
  let x, z, tries = 0;
  do { const a = r() * Math.PI * 2, d = R * (0.3 + r() * 0.6); x = Math.cos(a) * d; z = Math.sin(a) * d; tries++; }
  while (tries < 30 && player && Math.hypot(x - player.x, z - player.z) < 14);
  const base = player ? player.len : 10;
  const mult = [0.45, 0.6, 0.75, 1.3, 0.5, 1.7, 0.65, 0.9, 2.1][i % 9];
  const len = Math.max(4, Math.round(base * mult * (0.9 + r() * 0.2)));
  return makeSnake({ x, z, ang: r() * Math.PI * 2, len: Math.min(len, boss ? boss.len - 4 : len), cols: AI_COLS[(i + level) % AI_COLS.length] });
}
function addFood(r = Math.random, x, z) {
  if (x === undefined) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - 1.5); x = Math.cos(a) * d; z = Math.sin(a) * d; }
  const f = food.find(f => !f.alive);
  if (f) { f.x = x; f.z = z; f.alive = true; f.t = 0; f.ph = Math.random() * 6; return; }
  if (food.length < MAXF) food.push({ x, z, alive: true, t: 0, ph: Math.random() * 6 });
}

// ---------------------------------------------------------------- swallowing
function startEat(eater, prey) {
  if (prey.dying || eater.dying) return;
  prey.dying = eater; prey.popped = 0; prey.popT = 0;
  splat(prey.x, prey.z, prey.cols[0], radius(prey.len) * 3);
  prey.head.visible = false; prey.tag.style.display = 'none';
  burst(scene, new THREE.Vector3(prey.x, 1, prey.z), [prey.cols[0], prey.cols[1], '#fff'], 16, { speed: 0.16, up: 0.12, size: 1.1, shape: 'sphere' });
  eater.gulp = 1;
  const near = Math.hypot(prey.x - player.x, prey.z - player.z) < 20;
  if (eater === player) {
    kills++; sfx.smash(); buzz([20, 30, 40]); shake = 0.5; ui.flash(0.25);
    ui.pop(prey.isBoss ? 'BOSS SWALLOWED!' : ['GULP!', 'CHOMP!', 'YUM!', 'DEVOURED!'][kills % 4], '#fff', prey.isBoss ? 40 : 36, 30);
  } else if (near) tone(160, 0.2, 'sawtooth', 0.06, 0.5);
  if (prey === player) lose();
  if (prey.isBoss && eater === player) { wonAt = clock + 0.9; }
  else if (prey.isBoss) {                                  // boss eaten by someone else: the eater inherits the crown
    eater.isBoss = true; boss = eater; const hd = eater.head; scene.remove(hd); eater.head = makeHead(eater.cols[0], true);
  }
  if (prey.ai && !prey.isBoss) respawnQ.push(clock + 3);
}

function lose() {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(player.len / boss.len, 0, 1)); }
  buzz([60, 40, 90]); sfx.fail(); shake = 0.8; ui.flash(0.4);
  score = Math.round(player.len); best = Math.max(best, score); S.set('best', best);
  ui.lose('SWALLOWED!', `${score} long · boss was ${Math.round(boss.len)}`);
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); }
  score = Math.round(player.len) + level * 10; best = Math.max(best, score); S.set('best', best);
  confetti(scene, new THREE.Vector3(player.x, 2, player.z), 90); sfx.win(); buzz([30, 50, 30]);
  D.won(score); ui.score(score);
  ui.win(level, `Length ${Math.round(player.len)} · ${kills} swallowed`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- AI + steering
function bigger(a, b) { return a.len > b.len + 0.5; }
function nearestFood(s, maxD = 1e9) {
  let bf = null, bd = maxD;
  for (const f of food) { if (!f.alive) continue; const d = (f.x - s.x) ** 2 + (f.z - s.z) ** 2; if (d < bd) { bd = d; bf = f; } }
  return bf;
}
function nearestSeg(s, o) {                              // closest point of snake o to s's head (head or any segment)
  let bx = o.x, bz = o.z, bd = (o.x - s.x) ** 2 + (o.z - s.z) ** 2; const n = segCount(o), q = { x: 0, z: 0 };
  for (let i = o.popped; i < n; i += 2) { segPos(o, i, q); const d = (q.x - s.x) ** 2 + (q.z - s.z) ** 2; if (d < bd) { bd = d; bx = q.x; bz = q.z; } }
  return { x: bx, z: bz, d: Math.sqrt(bd) };
}
/** decide a heading for snake s; used by AI every few frames and by the player bot */
function think(s, botMode) {
  let fx = 0, fz = 0, danger = false;
  const look = botMode ? 10 + radius(s.len) * 4 : 6 + radius(s.len) * 2;
  for (const o of snakes) {
    if (o === s || !o.alive || o.dying) continue;
    if (Math.abs(o.x - s.x) > 60 || Math.abs(o.z - s.z) > 60) continue;
    if (bigger(o, s) || (!botMode && Math.abs(o.len - s.len) <= 0.5)) {
      const n = nearestSeg(s, o);
      if (n.d < look) { const w = (look - n.d) / look * (botMode ? 2 : 1); fx -= (n.x - s.x) / (n.d + 0.01) * w * 3; fz -= (n.z - s.z) / (n.d + 0.01) * w * 3; danger = true; }
    }
  }
  // wall
  const dc = Math.hypot(s.x, s.z);
  if (dc > R - 7) { const w = (dc - (R - 7)) / 4; fx -= s.x / dc * w * 2; fz -= s.z / dc * w * 2; }
  if (!danger) {
    let prey = null, pd = botMode ? 26 : s.isBoss ? chaseR * Math.min(1, 0.45 + level * 0.08) : chaseR;
    if (botMode && boss && boss.alive && !boss.dying && bigger(s, boss)) { prey = nearestSeg(s, boss); prey.boss = true; pd = prey.d; }
    for (const o of snakes) {
      if (prey && botMode && prey.boss) break;
      if (o === s || !o.alive || o.dying || !bigger(s, o)) continue;
      const n = nearestSeg(s, o);
      if (n.d < pd) { pd = n.d; prey = n; }
    }
    if (prey) { fx += (prey.x - s.x) / (pd + 0.01) * 2; fz += (prey.z - s.z) / (pd + 0.01) * 2; }
    else { const f = nearestFood(s); if (f) { const d = Math.hypot(f.x - s.x, f.z - s.z) + 0.01; fx += (f.x - s.x) / d; fz += (f.z - s.z) / d; } }
  }
  if (Math.abs(fx) + Math.abs(fz) > 0.001) s.tAng = Math.atan2(fz, fx);
}

// ---------------------------------------------------------------- simulation
const tmp = { x: 0, z: 0 };
function moveSnake(s, dt) {
  const r = radius(s.len);
  const base = s.ai ? 0.165 * aiSpeedK * (s.isBoss ? 0.9 : 1) : 0.2;
  const sp = base * (1 + Math.min(0.2, r * 0.05)) * dt;
  const turn = (s.ai ? 0.07 : 0.13) * dt / (1 + r * 0.25);
  let da = s.tAng - s.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  s.ang += clamp(da, -turn, turn);
  s.x += Math.cos(s.ang) * sp; s.z += Math.sin(s.ang) * sp;
  const dc = Math.hypot(s.x, s.z);
  if (dc > R - r * 0.6) {                                // slide along the fence and turn inwards
    s.x *= (R - r * 0.6) / dc; s.z *= (R - r * 0.6) / dc;
    const inward = Math.atan2(-s.z, -s.x); let d2 = inward - s.ang; while (d2 > Math.PI) d2 -= Math.PI * 2; while (d2 < -Math.PI) d2 += Math.PI * 2;
    s.ang += clamp(d2, -0.08 * dt, 0.08 * dt); if (!s.ai) s.tAng = s.ang;
  }
  // record trail by distance
  let last = s.pts[s.pts.length - 1], dx = s.x - last.x, dz = s.z - last.z, d = Math.hypot(dx, dz);
  while (d >= STEP) { last = { x: last.x + dx / d * STEP, z: last.z + dz / d * STEP }; s.pts.push(last); dx = s.x - last.x; dz = s.z - last.z; d = Math.hypot(dx, dz); }
  const need = Math.ceil((segCount(s) + 3) * spacing(r) / STEP) + 4;
  if (s.pts.length > need + 200) s.pts.splice(0, s.pts.length - need);
}

function eatFood(s) {
  const r = radius(s.len), reach = r * 1.25 + 0.4, mag = r * 2.6 + 1.2;
  for (const f of food) {
    if (!f.alive) continue;
    const dx = s.x - f.x, dz = s.z - f.z;
    if (Math.abs(dx) > mag || Math.abs(dz) > mag) continue;
    const d = Math.hypot(dx, dz);
    if (d < reach) {
      f.alive = false; s.len += s.isBoss ? 0.12 : s.ai ? 0.3 : 0.45; s.gulp = Math.max(s.gulp, 0.5);
      if (s === player) {
        foodCombo = clock - foodComboT < 0.6 ? foodCombo + 1 : 0; foodComboT = clock;
        note(72 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(foodCombo, 7)], 0.18, 0.09); buzz(4);
        burst(scene, new THREE.Vector3(f.x, 0.6, f.z), ['#ffd23f', '#fff'], 4, { speed: 0.06, up: 0.06, size: 0.5, shape: 'sphere' });
      }
      setTimeout(() => state === 'play' && addFood(), 1500 + Math.random() * 2500);
    } else if (d < mag && s === player) { f.x += dx / d * 0.12; f.z += dz / d * 0.12; }   // little magnet pull
  }
}

function collide() {
  for (const a of snakes) {
    if (!a.alive || a.dying) continue;
    const ra = radius(a.len);
    for (const b of snakes) {
      if (b === a || !b.alive || b.dying || a.dying) continue;
      const rb = radius(b.len), reachB = segCount(b) * spacing(rb) + rb + ra + 2;
      if (Math.abs(b.x - a.x) > reachB || Math.abs(b.z - a.z) > reachB) continue;
      let hit = Math.hypot(b.x - a.x, b.z - a.z) < (ra + rb) * 0.95;
      if (!hit) { const n = segCount(b); for (let i = 1; i < n; i++) { segPos(b, i, tmp); if ((tmp.x - a.x) ** 2 + (tmp.z - a.z) ** 2 < (ra * 0.85 + rb * 0.9) ** 2) { hit = true; break; } } }
      if (!hit) continue;
      if (a.len > b.len) startEat(a, b); else startEat(b, a);      // bigger always wins (a tie goes to the snake that was touched)
    }
  }
}

function stepDying(s, dt) {
  s.popT += dt;
  const eater = s.dying, n = segCount(s);
  while (s.popT > 1.1 && s.popped < n) {
    s.popT -= 1.1; segPos(s, s.popped, tmp); s.popped++;
    if (eater.alive) {
      eater.len += eater.isBoss ? 0.15 : eater.ai ? 0.3 : 0.5; eater.gulp = 1;
      if (eater === player) { if (s.popped % 3 === 0) tone(240 + Math.min(s.popped, 40) * 12, 0.05, 'triangle', 0.09, 1.3); }
      if (s.popped % 2 === 0) burst(scene, new THREE.Vector3(tmp.x, 0.6, tmp.z), [s.cols[0], s.cols[1]], 2, { speed: 0.07, up: 0.08, size: 0.7, shape: 'sphere' });
    }
  }
  if (s.popped >= n) { removeSnake(s); }
}

// ---------------------------------------------------------------- render
const proj = new THREE.Vector3();
function draw(t) {
  let k = 0;
  for (const s of snakes) {
    if (!s.alive) continue;
    const r = radius(s.len), n = segCount(s), sq = 1 + s.gulp * 0.18;
    // body (tail first so the head end overlaps), stripes in bands of 2
    for (let i = n - 1; i >= s.popped && k < MAXSEG; i--) {
      segPos(s, i, tmp);
      const taper = i > n - 6 ? 0.55 + 0.45 * (n - i) / 6 : 1, rr = r * taper * (i < 3 ? 1.05 : 1);
      const wob = 1 + Math.sin(t * 10 - i * 0.6) * 0.04 + (i < 6 ? s.gulp * 0.12 * (6 - i) / 6 : 0);
      _m.compose(_p.set(tmp.x, rr * 0.82, tmp.z), _q.identity(), _s.set(rr * wob, rr * 0.82 / wob, rr * wob));
      segMesh.setMatrixAt(k, _m);
      const band = Math.floor(i / 2) % 2;
      _c.set(s.cols[band]); if (band === 0) _c.offsetHSL(0, 0, Math.sin(i * 0.35) * 0.04);
      segMesh.setColorAt(k, _c); k++;
    }
    if (!s.dying) {
      const h = s.head; h.position.set(s.x, 0, s.z); h.rotation.y = -s.ang;
      h.scale.set(r * 0.92 * sq, r * 0.92 / sq, r * 0.92 * sq);
      h.mouth.scale.set(0.35, 0.18 + s.gulp * 0.35, 0.75);
      s.gulp = Math.max(0, s.gulp - 0.05);
      // tag
      proj.set(s.x, r * 2.6 + 0.6, s.z).project(camera);
      if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) s.tag.style.display = 'none';
      else {
        s.tag.style.display = '';
        const L = Math.round(s.len);
        const cls = s === player ? 'tag me' : s.isBoss ? 'tag boss' : bigger(s, player) ? 'tag big' : 'tag small';
        const txt = s === player ? `YOU ${L}` : s.isBoss ? `BOSS ${L}` : String(L);
        if (s.tag.className !== cls) s.tag.className = cls;
        if (s.tag.textContent !== txt) s.tag.textContent = txt;
        s.tag.style.transform = `translate(${clamp((proj.x * 0.5 + 0.5) * innerWidth, 44, innerWidth - 44)}px,${(-proj.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
      }
    }
  }
  segMesh.count = k; segMesh.instanceMatrix.needsUpdate = true; segMesh.instanceColor.needsUpdate = true;
  let j = 0;
  for (const f of food) {
    if (!f.alive) continue; f.t = Math.min(1, f.t + 0.06);
    const s = f.t * (1 + Math.sin(t * 4 + f.ph) * 0.08);
    _m.compose(_p.set(f.x, 0.42 + Math.sin(t * 3 + f.ph) * 0.12, f.z), _q.identity(), _s.set(s, s, s)); foodMesh.setMatrixAt(j++, _m);
  }
  foodMesh.count = j; foodMesh.instanceMatrix.needsUpdate = true;
  for (const sp of splats) { if (sp.t >= 1) { sp.m.visible = false; continue; } sp.t = Math.min(1, sp.t + 0.003); const g = Math.min(1, sp.t * 25); sp.m.scale.setScalar(sp.size * (0.4 + 0.6 * (1 - (1 - g) ** 3))); sp.m.material.opacity = 0.85 * (1 - Math.max(0, sp.t - 0.6) / 0.4); }
}

// ---------------------------------------------------------------- input: drag = virtual joystick around the touch point
input({
  onDown: () => {},
  onMove: (dx, dy, e, st) => {
    if (state !== 'play') return;
    const vx = e.clientX - st.x, vy = e.clientY - st.y, d = Math.hypot(vx, vy);
    if (d > 6) player.tAng = Math.atan2(vy, vx);
    if (d > 70) { st.x = e.clientX - vx / d * 70; st.y = e.clientY - vy / d * 70; }   // anchor follows the finger
  },
});
ui.onTap((which) => {
  if (which === 'win' || which === 'lose' || !player) buildLevel();
  state = 'play'; ui.hideStart(); sfx.tap();
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  clock = t;
  if (state === 'play') {
    for (const s of snakes) {
      if (!s.alive) continue;
      if (s.dying) { stepDying(s, dt); continue; }
      if (s.ai && (s.plan -= dt) <= 0) { think(s, false); s.plan = 8 + Math.random() * 6; }
      moveSnake(s, dt); eatFood(s);
      if (s.ai && !s.isBoss && boss && s.len > boss.len - 3) s.len = Math.max(4, boss.len - 3);   // the crowned boss stays the biggest AI
    }
    collide();
    snakes = snakes.filter(s => s.alive);
    if (!boss || !boss.alive) { const ai = snakes.filter(s => s.ai && !s.dying).sort((a, b) => b.len - a.len)[0]; if (ai && !wonAt) { ai.isBoss = true; boss = ai; scene.remove(ai.head); ai.head = makeHead(ai.cols[0], true); } }
    while (respawnQ.length && respawnQ[0] < clock) { respawnQ.shift(); if (state === 'play') spawnAI(Math.random, Math.floor(Math.random() * 9)); }
    if (state === 'play') {
      const L = Math.round(player.len);
      ui.score(L); ui.progress(boss && boss.alive && !wonAt ? player.len / boss.len : 1);
      if (!beatShown && D.beaten(L)) { beatShown = true; ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, new THREE.Vector3(player.x, 2, player.z), 60); }
      if (boss && player.len > boss.len && !player.overBoss) { player.overBoss = true; ui.pop('NOW EAT THE BOSS!', '#ffd23f', 30, 36); note(84, 0.3, 0.15); setTimeout(() => note(91, 0.4, 0.15), 120); }
      if (wonAt && clock > wonAt) win();
    }
  } else if (state === 'lost' || state === 'won') {
    for (const s of snakes) if (s.alive && s.dying) stepDying(s, dt);
    snakes = snakes.filter(s => s.alive);
  }
  if (player) {
    const r = radius(player.len), want = 19 + r * 15;
    camH = lerp(camH, want, 0.03 * dt);
    const sx = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - 0.03 * dt);
    const px = player.alive ? player.x : camera.position.x, pz = player.alive ? player.z - camH * 0.5 : camera.position.z - camH * 0.5;
    const tx = px + sx, tz = pz + camH * 0.5 + camH * 0.5 + sz;
    camera.position.x = lerp(camera.position.x, tx, 0.12 * dt); camera.position.y = camH; camera.position.z = lerp(camera.position.z, tz, 0.12 * dt);
    camera.lookAt(camera.position.x, 0, camera.position.z - camH * 0.5);
    stage.followLight(new THREE.Vector3(camera.position.x, 0, camera.position.z - camH * 0.5));
  }
  draw(t);
});

// ---------------------------------------------------------------- boot
buildLevel();
camera.position.set(player.x, camH, player.z + camH * 0.5); camera.lookAt(player.x, 0, player.z);
ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return player ? Math.round(player.len) : 0; },
  bot() { if (state === 'play' && player && player.alive && !player.dying) think(player, true); },
};

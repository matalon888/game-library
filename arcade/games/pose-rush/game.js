// Pose Rush — original game. Run, and when time slows, drag your fighter's limbs into the perfect pose: kick, punch, dodge bullets.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';

const ST = store('poserush');
let level = ST.get('level', 1), best = ST.get('best', 0);
const { scene, camera, followLight, sun } = createStage({ fov: 50, shadowSize: 10 });
const ui = createUI({ title: 'POSE<br>RUSH', hint: 'Drag limbs in slow-mo', hand: '👆', score: true });
document.body.style.setProperty('--bg1', '#14cfff'); document.body.style.setProperty('--bg2', '#c4f5ff'); document.body.style.setProperty('--ui', '#ff7a1a');
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- environment (instanced, cheap)
const env = new THREE.Group(); scene.add(env);
{
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(220, 600), mat('#6fd25a', { roughness: 0.9 })); grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, -250); grass.receiveShadow = true; env.add(grass);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 600), mat('#8d93a3', { roughness: 0.85 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -250); road.receiveShadow = true; env.add(road);
  for (const x of [-3.4, 3.4]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 600), mat('#e3e6ee')); sw.position.set(x, 0.05, -250); sw.receiveShadow = true; env.add(sw); }
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 1.4), mat('#ffffff'), 120), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < 120; i++) { m4.compose(new THREE.Vector3(-1.3, 0.01, 20 - i * 4), q, new THREE.Vector3(1, 1, 1)); dash.setMatrixAt(i, m4); } env.add(dash);
  const R = rng(99), N = 46;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 8), mat('#8a5a3b'), N), crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, 0), mat('#3fbf4a', { flatShading: true }), N), houses = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('#ffffff'), 30), roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 0.5, 4), mat('#ffffff', { flatShading: true }), 30);
  const hc = ['#ffd6a5', '#bde0fe', '#ffc8dd', '#fdffb6', '#caffbf', '#e0c3fc'], rc = ['#3d5a80', '#ef476f', '#2a9d8f', '#7b5cff'];
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, x = side * (6 + R() * 14), z = 20 - i * 6.5 - R() * 3, s = 0.8 + R() * 0.6;
    m4.compose(new THREE.Vector3(x, 0.8 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 2.4 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R(), 0)), new THREE.Vector3(s, s, s)); crowns.setMatrixAt(i, m4);
  }
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1, w = 4 + R() * 3, h = 2.6 + R() * 2.5, d = 4 + R() * 2, x = side * (9 + w / 2 + R() * 6), z = 10 - i * 9;
    m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); houses.setMatrixAt(i, m4); houses.setColorAt(i, new THREE.Color(hc[i % hc.length]));
    m4.compose(new THREE.Vector3(x, h + w * 0.25, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(w * 0.95, w, d * 0.95)); roofs.setMatrixAt(i, m4); roofs.setColorAt(i, new THREE.Color(rc[i % rc.length]));
  }
  for (const m of [trunks, crowns, houses, roofs]) { m.castShadow = true; env.add(m); }
}

// ---------------------------------------------------------------- people: segment rig + 2-bone IK in the sagittal plane (local +z = forward)
const UP = new THREE.Vector3(0, 1, 0);
const A1 = 0.3, A2 = 0.32, L1 = 0.44, L2 = 0.44;
function makePerson({ shirt, pants, skin = '#f5c9a6', hair = '#2b2d42', shoes = '#22223b', bulk = 1 }) {
  const g = new THREE.Group(), ms = mat(shirt), mp = mat(pants), mk = mat(skin), mh = mat(hair), mo = mat(shoes);
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; g.add(o); return o; };
  const p = { g, lean: 0.15, hipY: 0.92, phase: 0, hands: [[0.1, 1.0], [0.1, 1.0]], feet: [[0, 0.08], [0, 0.08]], cur: null };
  p.torso = add(new THREE.CapsuleGeometry(0.2 * bulk, 0.36, 4, 12), ms); p.torso.scale.set(1.25, 1, 0.9);
  p.pelvis = add(new THREE.SphereGeometry(0.2 * bulk, 14, 10), mp); p.pelvis.scale.set(1.2, 0.8, 0.9);
  p.head = add(new THREE.SphereGeometry(0.17, 18, 14), mk);
  p.hair = add(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mh);
  p.seg = [];
  for (let s = 0; s < 2; s++) {
    p.seg.push({ ua: add(new THREE.CapsuleGeometry(0.075 * bulk, A1, 4, 8), ms), la: add(new THREE.CapsuleGeometry(0.068, A2 - 0.04, 4, 8), mk),
      ul: add(new THREE.CapsuleGeometry(0.1 * bulk, L1, 4, 8), mp), ll: add(new THREE.CapsuleGeometry(0.088 * bulk, L2 - 0.06, 4, 8), mp), shoe: add(rounded(0.17, 0.12, 0.3, 0.05), mo) });
  }
  p.world = { hands: [new THREE.Vector3(), new THREE.Vector3()], feet: [new THREE.Vector3(), new THREE.Vector3()], head: new THREE.Vector3(), chest: new THREE.Vector3(), hips: new THREE.Vector3() };
  p.joints = {};
  return p;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
function place(mesh, x1, y1, z1, x2, y2, z2) {
  _a.set(x1, y1, z1); _b.set(x2, y2, z2); mesh.position.copy(_a).add(_b).multiplyScalar(0.5);
  _d.copy(_b).sub(_a); const l = _d.length(); if (l > 1e-4) mesh.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / l));
}
function ik(rz, ry, tz, ty, a, b, bend) {
  let dz = tz - ry * 0 - rz, dy = ty - ry, d = Math.hypot(dz, dy); const mx = a + b - 0.003;
  if (d > mx) { dz *= mx / d; dy *= mx / d; d = mx; } if (d < 0.08) { d = 0.08; dy = -0.08; dz = 0; }
  const base = Math.atan2(dy, dz), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * bend;
  return [rz + Math.cos(base + al) * a, ry + Math.sin(base + al) * a, rz + dz, ry + dy];
}
function pose(p) {
  const L = p.lean, hy = p.hipY, sx = Math.sin(L), cy = Math.cos(L);
  const sh = [sx * 0.5, hy + cy * 0.5], nk = [sx * 0.62, hy + cy * 0.62], hd = [sx * 0.82, hy + cy * 0.82];
  place(p.torso, 0, hy + cy * 0.08, sx * 0.08, 0, hy + cy * 0.5, sx * 0.5);
  p.pelvis.position.set(0, hy, 0);
  p.head.position.set(0, hd[1], hd[0]); p.hair.position.copy(p.head.position).add(_a.set(0, 0.015, -0.02)); p.hair.rotation.x = L - 0.25;
  p.world.headL = [hd[0], hd[1]]; p.world.neckL = [nk[0], nk[1]];
  for (let s = 0; s < 2; s++) {
    const x = s ? 0.27 : -0.27, hx = s ? 0.11 : -0.11, sg = p.seg[s], h = p.hands[s], f = p.feet[s];
    const [ez, ey, wz, wy] = ik(sh[0], sh[1], h[0], h[1], A1, A2, -1);
    place(sg.ua, x, sh[1], sh[0], x * 1.05, ey, ez); place(sg.la, x * 1.05, ey, ez, x * 1.05, wy, wz);
    const [kz, ky, az, ay] = ik(0, hy - 0.05, f[0], f[1], L1, L2, 1);
    place(sg.ul, hx, hy - 0.05, 0, hx, ky, kz); place(sg.ll, hx, ky, kz, hx, ay, az);
    sg.shoe.position.set(hx, ay - 0.02, az + 0.07); sg.shoe.rotation.x = Math.atan2(az - kz, ky - ay) * 0.4;
    p.joints[s] = { hand: [wz, wy], foot: [az, ay], sh, hip: [0, hy - 0.05] };
    p.g.localToWorld(p.world.hands[s].set(x * 1.05, wy, wz)); p.g.localToWorld(p.world.feet[s].set(hx, ay, az));
  }
  p.g.localToWorld(p.world.head.set(0, hd[1], hd[0])); p.g.localToWorld(p.world.chest.set(0, sh[1] - 0.1 * cy, sh[0] - 0.1 * sx)); p.g.localToWorld(p.world.hips.set(0, hy, 0));
}
function runCycle(p, ph, amt = 1) {
  const out = { hipY: 0.9 + Math.abs(Math.cos(ph)) * 0.06 * amt, lean: 0.2 * amt, hands: [], feet: [] };
  for (let s = 0; s < 2; s++) {
    const q = ph + s * Math.PI;
    out.feet.push([Math.sin(q) * 0.42 * amt + 0.05, 0.07 + Math.max(0, Math.cos(q)) * 0.3 * amt]);
    out.hands.push([-Math.sin(q) * 0.34 * amt + 0.18, 0.98 + Math.max(0, -Math.sin(q)) * 0.2 * amt]);
  }
  return out;
}
const STANCE = { hipY: 0.86, lean: 0.05, hands: [[0.32, 1.38], [0.22, 1.32]], feet: [[0.25, 0.07], [-0.2, 0.07]] };

// ---------------------------------------------------------------- dom handles
const HNAMES = ['hand0', 'hand1', 'foot0', 'foot1', 'chest'];
const handles = HNAMES.map(() => { const d = document.createElement('div'); d.className = 'hdl'; document.body.appendChild(d); return d; });
const tgtEl = document.createElement('div'); tgtEl.className = 'tgt'; document.body.appendChild(tgtEl);
const toScreen = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };

// ---------------------------------------------------------------- level
const RUN = 7.5;
let snapCam = true, state = 'ready', score = 0, runner, events, finishZ, ts = 1, tsT = 1, hitStop = 0, active = null, locks, grabbed = null, camShake = 0, worldG, winT = 0, R, endT = 0, finishArch;
const ENEMY_LOOKS = [{ shirt: '#e63946', pants: '#ffffff' }, { shirt: '#22223b', pants: '#22223b', hair: '#111' }, { shirt: '#2a9d8f', pants: '#264653' }, { shirt: '#ffb703', pants: '#3d405b', hair: '#6b3e1f' }, { shirt: '#ffffff', pants: '#e63946', hair: '#c1121f' }];
const BULLET_G = new THREE.CapsuleGeometry(0.05, 0.14, 4, 8); BULLET_G.rotateX(Math.PI / 2);

function buildLevel() {
  if (worldG) scene.remove(worldG);
  worldG = new THREE.Group(); scene.add(worldG);
  R = rng(level * 337 + 11);
  runner = makePerson({ shirt: '#8e44ff', pants: '#2f6fe4', hair: '#2b2d42', bulk: 1.05 });
  runner.g.rotation.y = Math.PI; runner.g.position.set(0, 0, 0); worldG.add(runner.g);
  runner.cur = runCycle(runner, 0); runner.dead = false; runner.vel = null;
  locks = { hand0: null, hand1: null, foot0: null, foot1: null, chest: null };
  const n = Math.min(7, 2 + Math.floor(level / 2)); events = [];
  let z = -16;
  for (let i = 0; i < n; i++) {
    const gun = level >= 2 && (i % 2 === 1 || (level > 4 && R() < 0.4));
    const look = ENEMY_LOOKS[Math.floor(R() * ENEMY_LOOKS.length)];
    const e = makePerson({ ...look, bulk: 1.1 });
    e.g.position.set(0, 0, z); worldG.add(e.g);
    e.cur = { ...STANCE, hands: STANCE.hands.map(h => h.slice()), feet: STANCE.feet.map(f => f.slice()) };
    const h = [1.68, 1.3, 1.0][Math.floor(R() * (level < 2 ? 2 : 3))];
    const ev = { type: gun ? 'gun' : 'kick', z, h, e, st: 'wait', fired: false, bullet: null };
    if (gun) {
      const gunM = new THREE.Mesh(rounded(0.1, 0.16, 0.3, 0.03), mat('#2b2d42')); gunM.castShadow = true; e.g.add(gunM); ev.gun = gunM;
      e.cur.hands[0] = [0.62, 1.42]; e.cur.hands[1] = [0.5, 1.38];
    }
    events.push(ev); z -= 17 + R() * 4;
  }
  finishZ = z + 6;
  finishArch = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 10, 36, Math.PI), glossy('#ff7a1a')); finishArch.add(arch);
  const ck = document.createElement('canvas'); ck.width = 64; ck.height = 16; const cx = ck.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { cx.fillStyle = (i + j) % 2 ? '#222' : '#fff'; cx.fillRect(i * 4, j * 4, 4, 4); }
  const tex = new THREE.CanvasTexture(ck); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: tex })); line.rotation.x = -Math.PI / 2; line.position.y = 0.02; finishArch.add(line);
  finishArch.position.z = finishZ; worldG.add(finishArch);
  ts = tsT = 1; active = null; grabbed = null; winT = 0; endT = 0; hitStop = 0;
  ui.levels(level); ui.progress(0); ui.score(score); ui.sub(best ? 'BEST ' + best : '');
  hideHandles(); snapCam = true;
}

function hideHandles() { handles.forEach(h => h.classList.remove('on', 'grab')); tgtEl.classList.remove('on'); $('tip').classList.remove('on'); $('slow').classList.remove('on'); }

// ---------------------------------------------------------------- input: grab nearest handle, drag it in the runner's body plane
const ray = new THREE.Raycaster(), bodyPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
function handlePoints() { const w = runner.world; return [w.hands[0], w.hands[1], w.feet[0], w.feet[1], w.chest]; }
function dragTo(name, px, py) {
  ray.setFromCamera(new THREE.Vector2(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1), camera);
  bodyPlane.constant = -runner.g.position.x;
  const hit = ray.ray.intersectPlane(bodyPlane, new THREE.Vector3()); if (!hit) return;
  setLock(name, runner.g.worldToLocal(hit));
}
function setLock(name, local) {
  if (name === 'chest') { locks.chest = clamp(Math.atan2(local.z, local.y - runner.hipY), -1.25, 1.25); return; }
  locks[name] = [local.z, Math.max(0.03, local.y)];
}
input({
  onDown(e) {
    if (state !== 'play' || !active || active.phase !== 'slow') return;
    let bi = -1, bd = 80; handlePoints().forEach((v, i) => { const [x, y] = toScreen(v); const d = Math.hypot(x - e.clientX, y - e.clientY); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) { grabbed = HNAMES[bi]; handles[bi].classList.add('grab'); tone(600, 0.04, 'sine', 0.08, 1.4); buzz(5); }
  },
  onMove(dx, dy, e) { if (grabbed && state === 'play') dragTo(grabbed, e.clientX, e.clientY); },
  onUp() { grabbed = null; handles.forEach(h => h.classList.remove('grab')); },
});

ui.onTap(w => {
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; score = 0; buildLevel(); }
});

// ---------------------------------------------------------------- encounters
function startSlow(ev, tip) {
  active = ev; ev.phase = 'slow'; tsT = ev.type === 'gun' && !ev.dodged ? 0.09 : 0.12;
  $('slow').classList.add('on'); $('tip').textContent = tip; $('tip').classList.add('on');
  handles.forEach(h => h.classList.add('on'));
  tone(180, 0.5, 'sine', 0.14, 0.5); buzz(10);
}
function endSlow() {
  active = null; tsT = 1; hideHandles(); grabbed = null;
  locks = { hand0: null, hand1: null, foot0: null, foot1: null, chest: null };
}
const BANGS = ['BANG!', 'POW!', 'WHAM!', 'BOOM!', 'KO!'];
function hitEnemy(ev, at) {
  ev.st = 'done'; const e = ev.e;
  e.vel = new THREE.Vector3((R() - 0.5) * 0.04, 0.12, -0.3); e.spin = 0.12 + R() * 0.08; e.dead = true;
  hitStop = 9; score += 100; ui.score(score);
  const b = $('bang'); b.textContent = BANGS[Math.floor(Math.random() * BANGS.length)]; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 520);
  burst(worldG, at, ['#ffe14d', '#ffffff', '#ff7a1a'], 22, { speed: 0.12, up: 0.08, size: 0.8, gravity: 0.003 });
  sfx.smash(); buzz([30, 20, 40]); ui.flash(0.55); camShake = 1;
  endSlow();
  ui.progress(events.filter(x => x.st === 'done').length / events.length);
}
function die(reason, push) {
  if (state !== 'play') return;
  state = 'lost'; runner.dead = true; runner.vel = push; runner.spin = -0.1; endSlow(); tsT = 0.35;
  sfx.fail(); buzz([60, 40, 80]); ui.flash(0.4); camShake = 1;
  best = Math.max(best, score); ST.set('best', best);
  ui.lose(reason, `${events.filter(x => x.st === 'done').length} / ${events.length} enemies`);
}
function win() {
  state = 'won'; tsT = 1; score += 50 * level; ui.score(score); best = Math.max(best, score); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1);
  const p = runner.g.position.clone().add(new THREE.Vector3(0, 2, -1)); confetti(worldG, p, 100); setTimeout(() => confetti(worldG, p, 70), 300);
  ui.win(level, `${score} points`);
}

function segDist(p, a, b) { const ab = _d.copy(b).sub(a), t = clamp(_a.copy(p).sub(a).dot(ab) / ab.lengthSq(), 0, 1); return _b.copy(a).addScaledVector(ab, t).distanceTo(p); }
function bulletHits(bp) {
  const w = runner.world;
  if (bp.distanceTo(w.head) < 0.27) return true;
  if (segDist(bp, w.hips, w.chest) < 0.24) return true;
  return false;
}

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(5, 3, 6), camLook = new THREE.Vector3(), tv = new THREE.Vector3();
loop((dt, t) => {
  if (!runner) return;
  if (hitStop > 0) { hitStop -= dt; ts = 0.02; } else ts = lerp(ts, tsT, (tsT > ts ? 0.12 : 0.2) * dt);
  const wdt = dt / 60 * ts;     // world seconds this frame
  const r = runner;
  if (state === 'play') {
    r.g.position.z -= RUN * wdt;
    for (const ev of events) {
      if (ev.st === 'done') continue;
      const d = r.g.position.z - ev.z;
      if (ev.type === 'gun' && !ev.dodged) {
        if (!ev.fired && d < 13) {
          ev.fired = true; const bm = new THREE.Mesh(BULLET_G, glossy('#ffcf33', { metalness: 0.6 })); bm.position.set(0, 1.72, ev.z + 0.7);
          const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); trail.rotation.x = Math.PI / 2; worldG.add(bm, trail);
          ev.bullet = bm; ev.trail = trail; ev.bz0 = bm.position.z; sfx.smash(); burst(worldG, bm.position, ['#ffe14d', '#ff7a1a'], 8, { speed: 0.05, up: 0.02, size: 0.5 });
        }
        if (ev.bullet) {
          const prevZ = ev.bullet.position.z; ev.bullet.position.z += 17 * wdt;
          ev.trail.position.set(0, 1.72, (ev.bullet.position.z + ev.bz0) / 2 - 0.0); ev.trail.scale.y = Math.min(6, ev.bullet.position.z - ev.bz0); ev.trail.position.z = ev.bullet.position.z - ev.trail.scale.y / 2;
          if (!active && r.g.position.z - ev.bullet.position.z < 6) startSlow(ev, 'DRAG TO DODGE!');
          if (prevZ < r.g.position.z && ev.bullet.position.z >= r.g.position.z) {
            if (bulletHits(ev.bullet.position)) { die('SHOT!', new THREE.Vector3(0, 0.05, 0.12)); burst(worldG, ev.bullet.position, '#ff3d3d', 14, { speed: 0.08 }); }
            else { ev.dodged = true; score += 50; ui.score(score); ui.pop('DODGED!', '#fff', 40, 26); sfx.coin(); buzz(15); endSlow(); worldG.remove(ev.bullet, ev.trail); ev.bullet = null; }
          }
        }
        break;
      }
      if (!active && d < 3.6) startSlow(ev, 'DRAG A LIMB TO HIT!');
      if (active === ev) {
        const target = ev.e.g.localToWorld(new THREE.Vector3(0, ev.h, 0.28));
        ev.tgt = target;
        for (const v of [...r.world.hands, ...r.world.feet]) if (v.distanceTo(target) < 0.38) { hitEnemy(ev, target); break; }
        if (ev.st !== 'done' && d < 0.85) { ev.e.cur.hands[0] = [0.75, 1.55]; die('KNOCKED OUT!', new THREE.Vector3(0, 0.1, 0.22)); }
      }
      break;
    }
    if (!active && events.every(e => e.st === 'done') && r.g.position.z < finishZ) win();
    if (state === 'play') ui.progress(Math.min(0.98, -r.g.position.z / -finishZ));
  }
  // runner pose
  if (r.dead && r.vel) {
    r.vel.y -= 0.006 * dt; r.g.position.addScaledVector(r.vel, dt); if (r.g.position.y < 0) { r.g.position.y = 0; r.vel.multiplyScalar(0.6); r.vel.y = Math.abs(r.vel.y) * 0.3; }
    r.g.rotation.x = Math.max(-1.45, r.g.rotation.x + r.spin * dt);
  } else if (state === 'won') {
    endT += dt / 60; const c = r.cur;
    c.hipY = 0.92 + Math.abs(Math.sin(endT * 7)) * 0.25; c.lean = 0; c.hands = [[0.05, 2.0], [0.05, 2.0]]; c.feet = [[0.05, 0.07 + Math.abs(Math.sin(endT * 7)) * 0.2], [-0.05, 0.07 + Math.abs(Math.sin(endT * 7)) * 0.2]];
    r.g.rotation.y = lerp(r.g.rotation.y, 0, 0.05 * dt);
  } else {
    r.phase += wdt * 11.5;
    const anim = runCycle(r, r.phase), c = r.cur, k = Math.min(1, 0.35 * dt);
    c.hipY = lerp(c.hipY, anim.hipY, k);
    c.lean = lerp(c.lean, locks.chest ?? anim.lean, k);
    for (let s = 0; s < 2; s++) {
      const h = locks['hand' + s] || anim.hands[s], f = locks['foot' + s] || anim.feet[s];
      c.hands[s] = [lerp(c.hands[s][0], h[0], k), lerp(c.hands[s][1], h[1], k)];
      c.feet[s] = [lerp(c.feet[s][0], f[0], k), lerp(c.feet[s][1], f[1], k)];
    }
    // a kick lifts the hips a little; a deep lean drops them (matrix dodge)
    const kickUp = Math.max(...[0, 1].map(s => locks['foot' + s] ? Math.max(0, locks['foot' + s][1] - 0.4) : 0));
    c.hipY += Math.min(0.35, kickUp * 0.3) - Math.max(0, Math.abs(c.lean) - 0.6) * 0.25;
  }
  Object.assign(r, { hipY: r.cur.hipY, lean: r.cur.lean, hands: r.cur.hands, feet: r.cur.feet });
  r.g.updateMatrixWorld(); pose(r);
  // enemies
  for (const ev of events) {
    const e = ev.e;
    if (e.dead) { e.vel.y -= 0.005 * dt * Math.max(ts, 0.05); e.g.position.addScaledVector(e.vel, dt * Math.max(ts, 0.05)); e.g.rotation.x = Math.max(-1.5, e.g.rotation.x - e.spin * dt * Math.max(ts, 0.05)); if (e.g.position.y < 0) { e.g.position.y = 0; e.vel.set(0, 0, e.vel.z * 0.85); } }
    else { e.phase += wdt * 3; e.cur.hipY = 0.86 + Math.sin(e.phase * 2) * 0.02; }
    Object.assign(e, { hipY: e.cur.hipY, lean: e.cur.lean, hands: e.cur.hands, feet: e.cur.feet });
    if (Math.abs(e.g.position.z - r.g.position.z) < 40) {
      e.g.visible = true; e.g.updateMatrixWorld(); pose(e);
      if (ev.gun) { ev.gun.position.set(-0.29, e.joints[0].hand[1] + 0.02, e.joints[0].hand[0] + 0.06); }
    } else e.g.visible = false;
  }
  // handles + target ring
  if (active && active.phase === 'slow' && state === 'play') {
    handlePoints().forEach((v, i) => { const [x, y] = toScreen(v); handles[i].style.left = x + 'px'; handles[i].style.top = y + 'px'; });
    if (active.type === 'kick' && active.tgt) { const [x, y] = toScreen(active.tgt); tgtEl.style.left = x + 'px'; tgtEl.style.top = y + 'px'; tgtEl.classList.add('on'); } else tgtEl.classList.remove('on');
  }
  // camera: behind-right over the shoulder; closer and lower in slow-mo
  const rp = r.g.position, slow = active ? 1 : 0;
  if (state === 'won') { winT += dt / 60; tv.set(rp.x + Math.sin(winT * 0.8 + 0.6) * 4.5, 2.2, rp.z - Math.cos(winT * 0.8 + 0.6) * 4.5); camLook.lerp(_a.set(rp.x, 1.1, rp.z), 0.08 * dt); }
  else {
    tv.set(rp.x + lerp(4.4, 3.1, slow), lerp(3.0, 1.9, slow), rp.z + lerp(5.0, 2.6, slow));
    const focus = active ? active.z * 0.45 + rp.z * 0.55 : rp.z - 3;
    camLook.lerp(_a.set(rp.x - 0.3, lerp(1.2, 1.15, slow), focus), 0.1 * dt);
  }
  if (snapCam) { camPos.copy(tv); camLook.set(rp.x - 0.3, 1.2, rp.z - 3); snapCam = false; }
  camPos.lerp(tv, 0.08 * dt); camera.position.copy(camPos);
  if (camShake > 0) { camera.position.x += (Math.random() - 0.5) * camShake * 0.25; camera.position.y += (Math.random() - 0.5) * camShake * 0.25; camShake = Math.max(0, camShake - 0.06 * dt); }
  camera.lookAt(camLook);
  followLight(rp);
});

buildLevel();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || !active || active.phase !== 'slow') return;
    if (active.type === 'gun' && !active.dodged) { locks.chest = -1.1; locks.hand0 = [-0.2, 1.7]; locks.hand1 = [-0.1, 1.65]; return; }
    if (!active.tgt) return;
    const loc = runner.g.worldToLocal(active.tgt.clone());
    const useFoot = active.h < 1.5;
    setLock(useFoot ? 'foot1' : 'hand1', loc);
    if (useFoot) locks.chest = -0.35;
  },
};

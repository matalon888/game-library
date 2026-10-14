// Twist Drop — original game. Twist the tower, drop the ball through the gaps, never touch the dark slices.
import * as THREE from './three.module.min.js';
import { flow } from './kit/flow.js';

const $ = (id) => document.getElementById(id);
const SEG = 12, SEGA = Math.PI * 2 / SEG, GAP = 3.2, R_OUT = 2.25, R_IN = 0.55, THICK = 0.36, BALL_R = 0.3, BALL_D = 1.45;
const GRAV = -0.0105, JUMP = 0.19, MAXFALL = -0.42;

// one palette per level, cycled: background gradient, pole, safe slices, danger slices, ball, ui accent
const PALETTES = [
  { bg: ['#ffd1dc', '#ffe9b8'], pole: '#fff4e6', safe: '#ff5d8f', danger: '#2b2d42', ball: '#ffd23f', ui: '#ff5d8f' },
  { bg: ['#b8f2e6', '#e3f6ff'], pole: '#ffffff', safe: '#3ab795', danger: '#3d3a4b', ball: '#ff6b6b', ui: '#2a9d8f' },
  { bg: ['#d7c8ff', '#ffd6f5'], pole: '#fff8ff', safe: '#7b5cff', danger: '#22223b', ball: '#ffd166', ui: '#7b5cff' },
  { bg: ['#ffe0b3', '#fff6d6'], pole: '#ffffff', safe: '#ff8c42', danger: '#3a2e39', ball: '#3a86ff', ui: '#ff8c42' },
  { bg: ['#c9f0ff', '#e8fff4'], pole: '#ffffff', safe: '#00a6fb', danger: '#1b263b', ball: '#ff4d6d', ui: '#0582ca' },
];

// ---------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0xffe4f0, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
scene.add(sun, sun.target);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.7 ? 46 : 38;   // phones get a little more tower in view
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------- geometry (shared)
function sliceGeo() {
  const s = new THREE.Shape(), a0 = 0, a1 = SEGA - 0.012;
  s.absarc(0, 0, R_OUT, a0, a1, false);
  s.absarc(0, 0, R_IN, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: THICK, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);          // shape plane -> horizontal; extrusion goes up
  g.translate(0, -THICK, 0);         // top face at y = 0
  return g;
}
const SLICE = sliceGeo();
const SPLAT = new THREE.CircleGeometry(0.34, 18);
const SHARD = new THREE.BoxGeometry(0.22, 0.12, 0.22);

let pal, mats;
function makeMats(p) {
  return {
    safe: new THREE.MeshStandardMaterial({ color: p.safe, roughness: 0.45, metalness: 0.05 }),
    danger: new THREE.MeshStandardMaterial({ color: p.danger, roughness: 0.35, metalness: 0.2 }),
    finish: new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.3, metalness: 0.35, emissive: '#7a5200', emissiveIntensity: 0.25 }),
    pole: new THREE.MeshStandardMaterial({ color: p.pole, roughness: 0.55, emissive: p.pole, emissiveIntensity: 0.18 }),
    ball: new THREE.MeshStandardMaterial({ color: p.ball, roughness: 0.22, metalness: 0.1, emissive: '#000000' }),
    splat: new THREE.MeshBasicMaterial({ color: p.ball, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
}

// ---------- world state
const tower = new THREE.Group(); scene.add(tower);
const F = flow('twist');
let pole, rings = [], ball, ballShadowCaster, level = +(localStorage.getItem('twist_level') || 1), best = +(localStorage.getItem('twist_best') || 0);
let score = 0, combo = 0, fire = false, state = 'ready', vy = 0, by = 0, squash = 0, camY = 0, shards = [], trail = [], passed = 0;

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function buildLevel() {
  pal = PALETTES[(level - 1) % PALETTES.length];
  mats = makeMats(pal);
  document.body.style.setProperty('--bg1', pal.bg[0]); document.body.style.setProperty('--bg2', pal.bg[1]); document.body.style.setProperty('--ui', pal.ui);
  for (const r of rings) tower.remove(r.group);
  if (pole) tower.remove(pole);
  rings = []; shards.forEach(s => scene.remove(s.m)); shards = [];
  const r = rng(level * 9973 + 17), count = 10 + Math.min(level * 2, 26), fk = F.k();
  pole = new THREE.Mesh(new THREE.CylinderGeometry(R_IN + 0.02, R_IN + 0.02, count * GAP + 12, 32), mats.pole);
  pole.position.y = -(count * GAP) / 2 + 2; pole.receiveShadow = true; tower.add(pole);
  for (let i = 0; i <= count; i++) {
    const finish = i === count, kinds = new Array(SEG).fill('safe');
    if (!finish) {
      const gLen = 1 + Math.floor(r() * (level < 3 ? 3 : 2)), gStart = Math.floor(r() * SEG);
      for (let k = 0; k < gLen; k++) kinds[(gStart + k) % SEG] = 'gap';
      if (i > 0) {
        const nd = Math.min(6, Math.floor((r() * (1.2 + level * 0.45) + (i / count) * 1.6) * fk));
        for (let k = 0; k < nd; k++) { const s = Math.floor(r() * SEG); if (kinds[s] === 'safe') kinds[s] = 'danger'; }
        if (level > 2 && r() < (0.18 + level * 0.02) * fk) {                       // a run of dark slices: the "wall"
          const s = Math.floor(r() * SEG); for (let k = 0; k < 3; k++) if (kinds[(s + k) % SEG] === 'safe') kinds[(s + k) % SEG] = 'danger';
        }
      }
    }
    const group = new THREE.Group(); group.position.y = -i * GAP; group.rotation.y = r() * Math.PI * 2;
    const slices = [];
    kinds.forEach((k, s) => {
      if (k === 'gap') return;
      const m = new THREE.Mesh(SLICE, finish ? mats.finish : mats[k]);
      m.rotation.y = s * SEGA; m.castShadow = true; m.receiveShadow = true;
      group.add(m); slices.push({ m, k: finish ? 'finish' : k, s });
    });
    tower.add(group);
    rings.push({ group, kinds, slices, y: -i * GAP, finish, done: false });
  }
  if (!ball) {
    ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), mats.ball); ball.castShadow = true; scene.add(ball);
  }
  ball.material = mats.ball; ball.visible = true;
  by = 1.6; vy = 0; combo = 0; fire = false; passed = 0; camY = by; tower.rotation.y = 0; squash = 0;
  ball.position.set(0, by, BALL_D);
  $('lvA').textContent = level; $('lvB').textContent = level + 1; $('bar').style.width = '0%';
  $('score').textContent = score; $('best').textContent = best ? 'BEST ' + best : '';
}

// which slice of a ring is under the ball (ball sits on +Z in world space)
const tmp = new THREE.Vector3();
function sliceUnderBall(ring) {
  const worldRot = tower.rotation.y + ring.group.rotation.y;
  // slice s spans local angles [s*SEGA, (s+1)*SEGA] in the shape plane; after rotateX(-90°) a shape angle a points to (cos a, 0, -sin a)
  // world direction of the ball (+Z) in ring-local shape angle:
  let a = Math.atan2(-Math.cos(worldRot) * 1, 0);  // placeholder, replaced below
  // exact: rotate world +Z by -worldRot around Y -> (−sin(−worldRot)... ) ; do it with vectors to stay correct
  tmp.set(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -worldRot);
  a = Math.atan2(-tmp.z, tmp.x); if (a < 0) a += Math.PI * 2;
  return Math.floor(a / SEGA) % SEG;
}

// ---------- juice
let actx;
function tone(f, t = 0.08, type = 'sine', vol = 0.18) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, n); o.frequency.exponentialRampToValueAtTime(f * 0.6, n + t);
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + t);
    o.connect(g); g.connect(actx.destination); o.start(n); o.stop(n + t);
  } catch (e) {}
}
const buzz = (ms) => navigator.vibrate && navigator.vibrate(ms);
let lastPop;
function pop(text, color = '#fff', size = 34, top = 34) {
  if (lastPop) lastPop.remove();
  const d = lastPop = document.createElement('div'); d.className = 'pop'; d.textContent = text;
  d.style.color = color; d.style.fontSize = size + 'px'; d.style.top = top + '%'; document.body.appendChild(d);
  setTimeout(() => d.remove(), 950);
}
function splat(ring) {
  const s = new THREE.Mesh(SPLAT, mats.splat); s.rotation.x = -Math.PI / 2;
  // place in ring-local space under the ball
  tmp.set(0, 0, BALL_D).applyAxisAngle(new THREE.Vector3(0, 1, 0), -(tower.rotation.y + ring.group.rotation.y));
  s.position.set(tmp.x, 0.012, tmp.z); s.rotation.z = Math.random() * 6.28; s.scale.setScalar(0.8 + Math.random() * 0.5);
  ring.group.add(s);
  for (let i = 0; i < 6; i++) {             // little droplets
    const d = new THREE.Mesh(SPLAT, mats.splat); d.rotation.x = -Math.PI / 2;
    const a = Math.random() * 6.28, rr = 0.3 + Math.random() * 0.3;
    d.position.set(tmp.x + Math.cos(a) * rr, 0.013, tmp.z + Math.sin(a) * rr); d.scale.setScalar(0.12 + Math.random() * 0.14); ring.group.add(d);
  }
}
function shatter(ring, strength = 1) {
  ring.done = true;
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
  for (const { m } of ring.slices) {
    m.getWorldPosition(wp); m.getWorldQuaternion(wq);
    const piece = m.clone(); piece.material = m.material.clone(); piece.material.transparent = true;
    ring.group.remove(m); scene.add(piece); piece.position.copy(wp); piece.quaternion.copy(wq);
    const dir = new THREE.Vector3(Math.cos(m.rotation.y + tower.rotation.y + ring.group.rotation.y + SEGA / 2), 0, -Math.sin(m.rotation.y + tower.rotation.y + ring.group.rotation.y + SEGA / 2));
    shards.push({ m: piece, v: dir.multiplyScalar(0.07 * strength).add(new THREE.Vector3(0, 0.05 + Math.random() * 0.04, 0)), spin: (Math.random() - 0.5) * 0.2, life: 1 });
  }
  ring.slices = [];
}
function burst(color, n = 18) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(SHARD, new THREE.MeshStandardMaterial({ color, transparent: true, roughness: 0.4 }));
    m.position.copy(ball.position);
    const a = Math.random() * 6.28;
    shards.push({ m, v: new THREE.Vector3(Math.cos(a) * 0.08, 0.06 + Math.random() * 0.08, Math.sin(a) * 0.08), spin: 0.3, life: 1 }); scene.add(m);
  }
}
function setFire(on) {
  fire = on;
  ball.material.emissive.set(on ? '#ff5a00' : '#000000'); ball.material.emissiveIntensity = on ? 0.9 : 0;
  if (on) { pop('ON FIRE!', '#ffb703', 40, 19); tone(220, 0.25, 'sawtooth', 0.12); buzz(30); }
}

// ---------- input: horizontal drag twists the tower
let dragX = null, twistV = 0;
addEventListener('pointerdown', e => { dragX = e.clientX; tapped(); });
addEventListener('pointermove', e => { if (dragX === null || state !== 'play') return; const d = (e.clientX - dragX) * 0.0105; tower.rotation.y += d; twistV = d; dragX = e.clientX; });
addEventListener('pointerup', () => { dragX = null; });

function tapped() {
  if (state === 'ready') { state = 'play'; $('start').classList.add('hidden'); tone(520, 0.06); }
  else if (state === 'won') { level++; localStorage.setItem('twist_level', level); $('win').classList.add('hidden'); buildLevel(); state = 'play'; }
  else if (state === 'lost') { score = 0; $('lose').classList.add('hidden'); buildLevel(); state = 'play'; }
}

function lose() {
  state = 'lost'; F.level(false, passed / (rings.length - 1)); buzz([40, 30, 60]); tone(140, 0.35, 'square', 0.12); burst(pal.ball, 22); ball.visible = false;
  setTimeout(() => {
    const pct = Math.round(passed / (rings.length - 1) * 100);
    $('losePct').textContent = `${pct}% completed`;
    $('lose').classList.remove('hidden');
  }, 700);
}
function win() {
  state = 'won'; F.level(true); score += 50 * level; best = Math.max(best, score); localStorage.setItem('twist_best', best);
  $('score').textContent = score; $('winLv').textContent = level; tone(660, 0.12); setTimeout(() => tone(880, 0.18), 120);
  buzz([20, 40, 20]); $('flash').style.opacity = 0.7; setTimeout(() => $('flash').style.opacity = 0, 120);
  for (let i = 0; i < 3; i++) setTimeout(() => burst(['#ffd23f', pal.safe, '#ffffff'][i], 26), i * 140);
  setTimeout(() => $('win').classList.remove('hidden'), 650);
}

// ---------- main loop
let last = performance.now();
function frame(t) {
  const dt = Math.min(2.2, (t - last) / 16.67); last = t;
  if (dragX === null && state === 'play') { tower.rotation.y += twistV; twistV *= 0.86; }   // a little flick momentum
  if (state === 'play') {
    const prev = by;
    vy = Math.max(MAXFALL, vy + GRAV * dt); by += vy * dt * 1.0;
    for (const ring of rings) {
      if (ring.done) continue;
      const top = ring.y + BALL_R;
      if (prev >= top && by < top && vy < 0) {
        const s = sliceUnderBall(ring), kind = ring.finish ? 'finish' : ring.kinds[s];
        if (kind === 'gap') {                                           // fall through: shatter the ring behind us
          combo++; passed++; const pts = combo * level; score += pts; $('score').textContent = score;
          shatter(ring, 1); tone(300 + combo * 70, 0.07, 'triangle', 0.14);
          if (combo >= 2) pop('+' + pts, '#fff', 28 + combo * 3, 19);
          if (combo === 3) setFire(true);
          continue;
        }
        if (kind === 'finish') { by = top; vy = 0; splat(ring); return win(), requestAnimationFrame(frame); }
        if (fire) {                                                     // fire smashes whatever it lands on
          shatter(ring, 1.8); passed++; score += 10 * level; $('score').textContent = score;
          pop(['SMASH!', 'BOOM!', 'WOW!'][Math.floor(Math.random() * 3)], '#ffb703', 42, 19);
          buzz(25); tone(90, 0.2, 'square', 0.15); $('flash').style.opacity = 0.35; setTimeout(() => $('flash').style.opacity = 0, 80);
          setFire(false); combo = 0; by = top; vy = JUMP * 0.7; squash = 1;
          continue;
        }
        if (kind === 'danger') { by = top; return lose(), requestAnimationFrame(frame); }
        by = top; vy = JUMP; squash = 1; combo = 0; splat(ring); tone(420, 0.06, 'sine', 0.12); buzz(8);
        break;
      }
    }
    $('bar').style.width = Math.min(100, passed / (rings.length - 1) * 100) + '%';
  }
  // ball: squash on impact, stretch while falling fast
  squash = Math.max(0, squash - 0.09 * dt);
  const stretch = Math.min(0.35, Math.max(0, -vy * 1.1));
  ball.scale.set(1 + squash * 0.35 - stretch * 0.25, 1 - squash * 0.4 + stretch, 1 + squash * 0.35 - stretch * 0.25);
  ball.position.y = by - squash * 0.08;
  if (fire && state === 'play' && Math.random() < 0.8) {               // fire trail
    const m = new THREE.Mesh(SPLAT, new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? '#ff7b00' : '#ffd000', transparent: true, depthWrite: false }));
    m.position.copy(ball.position).add(new THREE.Vector3((Math.random() - .5) * .16, .05 + Math.random() * .12, (Math.random() - .5) * .16)); m.scale.setScalar(0.22 + Math.random() * 0.22); m.material.blending = THREE.AdditiveBlending;
    m.lookAt(camera.position); scene.add(m); trail.push({ m, life: 1 });
  }
  for (const p of trail) { p.life -= 0.11 * dt; p.m.position.y += 0.012 * dt; p.m.material.opacity = p.life; p.m.scale.multiplyScalar(0.97); }
  trail = trail.filter(p => p.life > 0 || (scene.remove(p.m), false));
  for (const s of shards) {
    s.v.y -= 0.004 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += s.spin * dt; s.m.rotation.z += s.spin * dt;
    s.life -= 0.022 * dt; s.m.material.opacity = Math.max(0, s.life);
  }
  shards = shards.filter(s => s.life > 0 || (scene.remove(s.m), false));
  // camera follows the ball down only (never back up), slightly from above
  camY = Math.min(camY, by);
  const cy = camY + 0.15 * (by - camY);
  camera.position.set(0, cy + 6.2, 13.2); camera.lookAt(0, cy - 2.2, 0);
  sun.position.set(2.5, cy + 8, 5); sun.target.position.set(0, cy - 2, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
buildLevel();
requestAnimationFrame(frame);

// test hooks for automated QA
window.__twist = { get state() { return state; }, get passed() { return passed; }, get score() { return score; }, get level() { return level; },
  aim() { const r = rings.find(r => !r.done && r.y < by + 0.01 && !r.finish) || rings.find(r => !r.done); if (!r) return; const g = r.kinds.indexOf('gap'); if (g < 0) return;
    // rotate so the gap's centre sits at the ball (+Z): shape angle of +Z is 3π/2
    tower.rotation.y = 3 * Math.PI / 2 - (g + 0.5) * SEGA - r.group.rotation.y; } };

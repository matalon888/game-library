// Boop Board — original pop-it fidget game for kids. Every level is a squishy rainbow critter board full of bubbles:
// press (or swipe across) them to pop them all before the sun-clock runs out. From level 3 a few bubbles puff back up.
import { THREE, createStage, createUI, store, loop, buzz, note, tone, burst, confetti, lerp, clamp, rng, palette, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Boop Board: Pop It Fidget Game';
const S = store('boopboard');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('boopboard');

const stage = createStage({ fov: 38, shadowSize: 6 });
const { scene, camera } = stage;
const ui = createUI({ title: 'BOOP<br>BOARD', hint: 'Pop!', hand: '👆' });
const D = daily('boopboard', ui, { name: NAME });

// ---------------------------------------------------------------- timer ring (no reading needed: a pie that empties)
const css = document.createElement('style');
css.textContent = `.bb-clock{position:fixed;top:calc(62px + env(safe-area-inset-top));left:16px;width:56px;height:56px;border-radius:50%;z-index:5;pointer-events:none;
  background:conic-gradient(#ffd23f calc(var(--p)*1turn),rgba(255,255,255,.55) 0);box-shadow:0 4px 0 rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;font-size:30px;transition:transform .15s}
.bb-clock.low{animation:bbtick .5s ease-in-out infinite}@keyframes bbtick{50%{transform:scale(1.12)}}
.bb-clock.hide{display:none}`;
document.head.appendChild(css);
const clock = document.createElement('div'); clock.className = 'bb-clock hide'; clock.textContent = '☀️'; document.body.appendChild(clock);

// ---------------------------------------------------------------- critter shapes (unions of circles / polar curves), in unit space, y up
const C = (x, y, r) => [x, y, r];
const uni = (cs) => (th) => { const dx = Math.cos(th), dy = Math.sin(th); let m = 0; for (const [x, y, r] of cs) { const b = dx * x + dy * y, d = b * b - (x * x + y * y) + r * r; if (d >= 0) m = Math.max(m, b + Math.sqrt(d)); } return m; };
const angd = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const polar = (f, n = 160) => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2, r = f(t); return [Math.cos(t) * r, Math.sin(t) * r]; });
const SHAPES = [
  { pts: polar(uni([C(0, -0.1, 0.9), C(-0.68, 0.62, 0.34), C(0.68, 0.62, 0.34)])), eyes: [[-0.33, 0.05], [0.33, 0.05]], mouth: [0, -0.32] },              // bear
  { pts: polar(uni([C(0, -0.3, 0.78), C(-0.3, 0.45, 0.24), C(-0.33, 0.8, 0.22), C(-0.35, 1.1, 0.19), C(0.3, 0.45, 0.24), C(0.33, 0.8, 0.22), C(0.35, 1.1, 0.19)]), 220), eyes: [[-0.3, -0.18], [0.3, -0.18]], mouth: [0, -0.52] }, // bunny
  { pts: polar(t => 0.86 + 0.6 * Math.exp(-((angd(t, 1.02) / 0.2) ** 2)) + 0.6 * Math.exp(-((angd(t, Math.PI - 1.02) / 0.2) ** 2)), 220), eyes: [[-0.33, 0.08], [0.33, 0.08]], mouth: [0, -0.3] }, // cat
  { pts: polar(uni([C(0, -0.12, 0.78), C(-0.72, 0.58, 0.44), C(0.72, 0.58, 0.44)])), eyes: [[-0.3, 0], [0.3, 0]], mouth: [0, -0.4] },                     // mouse
  { pts: polar(uni([C(0.15, 0, 0.72), C(0.62, 0, 0.5), C(-0.8, 0.42, 0.3), C(-0.8, -0.42, 0.3), C(-0.58, 0, 0.3)]), 200), eyes: [[0.3, 0.22], [0.72, 0.18]], mouth: [0.62, -0.22] }, // fish
  { pts: polar(uni([C(0, -0.05, 0.78), C(0, 0.98, 0.34), C(-0.7, 0.52, 0.26), C(0.7, 0.52, 0.26), C(-0.7, -0.62, 0.26), C(0.7, -0.62, 0.26), C(0, -0.92, 0.16)]), 220), eyes: [[-0.14, 1.0], [0.14, 1.0]], mouth: null }, // turtle
  { pts: polar(t => 0.56 + 0.44 * Math.pow(0.5 + 0.5 * Math.cos(5 * (t - Math.PI / 2)), 1.5), 240), eyes: [[-0.2, 0.06], [0.2, 0.06]], mouth: [0, -0.2] }, // star
  { pts: Array.from({ length: 180 }, (_, i) => { const t = i / 180 * Math.PI * 2; return [16 * Math.sin(t) ** 3 / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; }), eyes: [[-0.36, 0.2], [0.36, 0.2]], mouth: [0, -0.15] }, // heart
  { pts: polar(t => 0.8 + 0.2 * Math.cos(6 * t), 220), eyes: [[-0.24, 0.08], [0.24, 0.08]], mouth: [0, -0.22] },                                          // flower
  { pts: polar(uni([C(0, 0.25, 0.74), C(-0.62, -0.55, 0.22), C(-0.21, -0.62, 0.22), C(0.21, -0.62, 0.22), C(0.62, -0.55, 0.22), C(-0.4, -0.3, 0.3), C(0.4, -0.3, 0.3)]), 220), eyes: [[-0.27, 0.32], [0.27, 0.32]], mouth: [0, 0.0] }, // octopus
  { pts: polar(uni([C(-0.62, -0.1, 0.45), C(0, 0.15, 0.6), C(0.62, -0.05, 0.5), C(-0.22, -0.32, 0.45), C(0.3, -0.32, 0.45)])), eyes: [[-0.25, 0.02], [0.25, 0.02]], mouth: [0, -0.28] }, // cloud
];
const SCHEMES = [
  ['#ff4d6d', '#ff8c42', '#ffd23f', '#5cd65c', '#3ab7ff', '#7b5cff', '#ff5dc8'],   // rainbow
  ['#ff5dc8', '#c56bff', '#7b5cff', '#3ab7ff'],                                     // candy
  ['#00c2a8', '#3ab7ff', '#5c7cff', '#9d6bff'],                                     // ocean
  ['#ffd23f', '#ff9f1c', '#ff5d5d', '#ff4d9a'],                                     // sunset
  ['#7ee081', '#3ab795', '#ffd23f', '#ff8c42'],                                     // jungle
];
const gradAt = (sc, t) => { const n = sc.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i; return new THREE.Color(sc[i]).lerp(new THREE.Color(sc[i + 1]), f); };

function inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function edgeDist(pts, x, y) { let m = 1e9; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i], dx = bx - ax, dy = by - ay; const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); m = Math.min(m, Math.hypot(ax + dx * t - x, ay + dy * t - y)); } return m; }

// ---------------------------------------------------------------- scene dressing
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);
const board = new THREE.Group(); scene.add(board);
// soft floating bubbles around the board (decor)
const FLO = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.32 }), 16);
const floD = Array.from({ length: 16 }, (_, i) => ({ a: i / 16 * Math.PI * 2, r: 3.3 + (i % 3) * 0.7, s: 0.12 + (i % 4) * 0.07, ph: i * 1.7 }));
scene.add(FLO);
const DEPTH = 0.22, BEV = 0.14, TOP = DEPTH + BEV * 2 - 0.02;
const DOME = new THREE.SphereGeometry(1, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const RIM = new THREE.TorusGeometry(1, 0.13, 8, 26); RIM.rotateX(Math.PI / 2);
const bubMat = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.02, side: THREE.DoubleSide });
const rimMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
let bubMesh = null, rimMesh = null, base = null, eyes = [], mouth = null;
let bubbles = [], spacing = 0.7, rad = 0.3, scheme = SCHEMES[0];

const EYE_W = new THREE.SphereGeometry(1, 22, 14), EYE_P = new THREE.SphereGeometry(1, 16, 10);
const whiteM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 }), pupilM = new THREE.MeshStandardMaterial({ color: '#2b2140', roughness: 0.2 });

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, popped = 0, timeLeft = 0, timeMax = 1, combo = 0, lastPop = 0, popBackEvery = 0, popBackT = 0;
let sessionLv = 0, recorded = false, beatenShown = false, now = 0, spin = 0, jump = 0, mood = 0, blinkT = 2, lookAt = new THREE.Vector3(0, 0, 3);
let shake = 0, botLast = null;

function fitCamera(w, h) {
  const vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2), tilt = 0.5;                   // tilt from straight-down
  const dw = (w / 2 + 0.42) / (th * camera.aspect), dh = (h / 2 * Math.cos(tilt) + 1.1) / th;
  const d = Math.max(dw, dh, 7);
  camera.position.set(0, Math.cos(tilt) * d, Math.sin(tilt) * d + 0.35); camera.lookAt(0, 0, 0.15);
}
let fitW = 4.6, fitH = 5.4;
addEventListener('resize', () => fitCamera(fitW, fitH));

function build() {
  const seed = D.seed ? D.seed + sessionLv * 101 : level * 7919 + 13, r = rng(seed), fk = F.k();
  applyPalette(palette(level));
  // clear old
  if (bubMesh) { board.remove(bubMesh, rimMesh, base); base.geometry.dispose(); }
  eyes.forEach(e => board.remove(e.g)); eyes = []; if (mouth) board.remove(mouth), mouth = null;
  const shp = SHAPES[(level === 1 && !D.seed) ? 0 : Math.floor(r() * SHAPES.length)];
  scheme = SCHEMES[(level - 1 + Math.floor(r() * 2)) % SCHEMES.length];
  // fit shape into W x H box
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of shp.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const W = 4.5, H = 5.3, sc = Math.min(W / (x1 - x0), H / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const T = ([x, y]) => [(x - cx) * sc, (y - cy) * sc];
  const pts = shp.pts.map(T);
  fitW = (x1 - x0) * sc; fitH = (y1 - y0) * sc; fitCamera(fitW, fitH);
  // board: rounded extrude with a vertical rainbow baked into vertex colours
  const shape = new THREE.Shape(); pts.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 4, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, BEV, 0);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), zs = fitH / 2;
  for (let i = 0; i < pos.count; i++) { const c = gradAt(scheme, clamp((pos.getZ(i) + zs) / (2 * zs), 0, 1)).lerp(new THREE.Color('#ffffff'), 0.18); if (pos.getY(i) < 0.15) c.multiplyScalar(0.8); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  base = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 })); base.castShadow = true; base.receiveShadow = true;
  // bubble spacing: big bubbles early, smaller (more of them) later
  spacing = clamp(0.86 - (level - 1) * 0.045, 0.56, 0.86); rad = spacing * 0.4;
  const feat = [...shp.eyes.map(T), ...(shp.mouth ? [T(shp.mouth)] : [])];
  // try a few grid offsets and keep the one that packs the most bubbles into this critter
  const rowH = spacing * 0.866;
  const grid = (ox, oy) => { const out = [];
    for (let j = 0, y = fitH / 2 - spacing * 0.3 - oy; y > -fitH / 2; j++, y -= rowH) {
      for (let k = -12; k <= 12; k++) { const x = (k + ((j + ox) % 2) * 0.5) * spacing;
        if (!inside(pts, x, y) || edgeDist(pts, x, y) < rad * 1.12) continue;
        if (feat.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < spacing * 0.74)) continue;
        out.push({ x, z: -y, row: j, up: true, s: 1, v: 0, sq: 0, popAt: -9 });
      } }
    return out; };
  bubbles = [];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 6; b++) { const g2 = grid(a, b / 6 * rowH); if (g2.length > bubbles.length) bubbles = g2; }
  // center the grid inside the shape a touch better: nothing fancy, the edge test already keeps it neat
  const rows = Math.max(1, ...bubbles.map(b => b.row));
  bubMesh = new THREE.InstancedMesh(DOME, bubMat, bubbles.length); bubMesh.castShadow = true;
  rimMesh = new THREE.InstancedMesh(RIM, rimMat, bubbles.length);
  const m = new THREE.Matrix4();
  bubbles.forEach((b, i) => {
    b.col = gradAt(scheme, clamp((b.z + zs) / (2 * zs), 0, 1)); b.dark = b.col.clone().multiplyScalar(0.62);
    bubMesh.setColorAt(i, b.col); rimMesh.setColorAt(i, b.col.clone().lerp(new THREE.Color('#ffffff'), 0.12));
    m.compose(new THREE.Vector3(b.x, TOP, b.z), new THREE.Quaternion(), new THREE.Vector3(rad * 1.06, rad * 0.9, rad * 1.06)); rimMesh.setMatrixAt(i, m);
  });
  board.add(base, bubMesh, rimMesh);
  // googly eyes + smile
  const er = clamp(spacing * 0.42, 0.24, 0.34);
  for (const [ex, ey] of shp.eyes.map(T)) {
    const gr = new THREE.Group(); gr.position.set(ex, TOP, -ey);
    const w = new THREE.Mesh(EYE_W, whiteM); w.scale.set(er, er * 0.55, er); w.castShadow = true;
    const p = new THREE.Mesh(EYE_P, pupilM); p.scale.set(er * 0.5, er * 0.28, er * 0.5);
    const gl = new THREE.Mesh(EYE_P, whiteM); gl.scale.setScalar(er * 0.16);
    gr.add(w, p, gl); board.add(gr); eyes.push({ g: gr, w, p, gl, er });
  }
  if (shp.mouth) {
    const [mx, my] = T(shp.mouth), tg = new THREE.TorusGeometry(er * 0.55, er * 0.13, 8, 18, Math.PI);
    tg.rotateZ(Math.PI); tg.rotateX(-Math.PI / 2);
    mouth = new THREE.Mesh(tg, pupilM); mouth.position.set(mx, TOP + 0.02, -my); board.add(mouth);
  }
  // knobs: time limit (easier when bigger -> / fk) and puff-back rate (harder when bigger -> * fk)
  timeMax = timeLeft = clamp((bubbles.length * 0.95 + 9) / fk, 8, 140);
  popBackEvery = level >= 3 ? clamp(5.2 - level * 0.22, 1.6, 4.6) / fk : 0; popBackT = popBackEvery;
  popped = 0; combo = 0; recorded = false; spin = 0; jump = 0; mood = 0;
  ui.levels(level); ui.progress(0); ui.score(score); ui.sub('');
  writeBubbles();
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function writeBubbles() {
  bubbles.forEach((b, i) => {
    const sy = b.s * 0.85, sxz = 1 + b.sq * 0.18;
    _m.compose(_p.set(b.x, TOP - 0.01, b.z), _q, _s.set(rad * sxz, rad * sy, rad * sxz)); bubMesh.setMatrixAt(i, _m);
  });
  bubMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- sounds (all synthesized, voice-free)
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
function popSound(i) {
  tone(900 + Math.random() * 260, 0.045, 'sine', 0.22, 0.3);
  tone(2300 + Math.random() * 400, 0.018, 'triangle', 0.05, 1);
  note(67 + PENTA[i % PENTA.length], 0.22, 0.07);
}

function popBubble(b, byBot) {
  if (state !== 'play' || !b.up) return;
  b.up = false; b.v = -0.5; b.sq = 1; b.popAt = now; popped++;
  combo = now - lastPop < 0.45 ? combo + 1 : 0; lastPop = now;
  score += 1 + (combo >= 6 ? 1 : 0); ui.score(score);
  bubMesh.setColorAt(bubbles.indexOf(b), b.dark); bubMesh.instanceColor.needsUpdate = true;
  popSound(combo); buzz(8);
  const wp = new THREE.Vector3(b.x, TOP + 0.2, b.z).applyMatrix4(board.matrixWorld);
  burst(scene, wp, ['#ffffff', '#' + b.col.getHexString()], 5, { speed: 0.05, up: 0.05, size: 0.35, shape: 'sphere', gravity: 0.004 });
  if (combo > 0 && combo % 8 === 0) { ui.pop(['Wow!', 'Yay!', 'Super!', '⭐⭐⭐'][(combo / 8 - 1) % 4], '#fff', 40, 30); ui.flash(0.15); }
  if (score > best && best > 0 && score === best + 1) ui.pop('🏆', '#fff', 46, 22);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, new THREE.Vector3(0, 2, 0), 50); }
  ui.progress(popped / bubbles.length);
  if (popped >= bubbles.length) win();
}

function win() {
  state = 'won'; mood = 1; spin = 1; jump = 1;
  if (!recorded) { recorded = true; F.level(true); }
  const frac = timeLeft / timeMax, stars = frac > 0.45 ? 3 : frac > 0.2 ? 2 : 1;
  const done = level; level++; sessionLv++; if (!D.seed) S.set('level', level);
  best = Math.max(best, score); S.set('best', best);
  confetti(scene, new THREE.Vector3(0, 1.5, 0), 90); ui.flash(0.4); buzz([20, 30, 20]);
  [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(72 + s, 0.35, 0.16), i * 95));
  clock.classList.add('hide');
  D.won(score); ui.win(done, '⭐'.repeat(stars));
}
function lose() {
  state = 'lost'; mood = -1;
  if (!recorded) { recorded = true; F.level(false, popped / bubbles.length); }
  best = Math.max(best, score); S.set('best', best);
  [67, 64, 60].forEach((n, i) => setTimeout(() => note(n, 0.4, 0.12), i * 160));      // soft, friendly "aww"
  clock.classList.add('hide');
  ui.lose('Try again!', '💪 🙂');
}

// ---------------------------------------------------------------- input: press or swipe across bubbles
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
function toWorld(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; }
function pressAt(p, first) {
  if (!p) return; lookAt.copy(p);
  let hit = null, bd = spacing * (first ? 0.62 : 0.5);
  for (const b of bubbles) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd && b.up) { bd = d; hit = b; } }
  if (hit) popBubble(hit);
  else if (first) tone(300, 0.04, 'sine', 0.06, 0.8);
}
let down = false, lastXY = null;
addEventListener('pointerdown', e => { if (state !== 'play') return; down = true; lastXY = [e.clientX, e.clientY]; pressAt(toWorld(e.clientX, e.clientY), true); });
addEventListener('pointermove', e => {
  if (!down || state !== 'play') { const p = toWorld(e.clientX, e.clientY); if (p) lookAt.copy(p); return; }
  // sample along the swipe so fast fingers don't skip bubbles
  const [lx, ly] = lastXY, n = Math.ceil(Math.hypot(e.clientX - lx, e.clientY - ly) / 8);
  for (let i = 1; i <= n; i++) pressAt(toWorld(lerp(lx, e.clientX, i / n), lerp(ly, e.clientY, i / n)), false);
  lastXY = [e.clientX, e.clientY];
});
addEventListener('pointerup', () => { down = false; });
addEventListener('pointercancel', () => { down = false; });

ui.onTap((which) => {
  if (which === 'lose') score = 0;
  build(); state = 'play'; ui.hideStart(); clock.classList.remove('hide');
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  now = t;
  if (state === 'play') {
    timeLeft -= dt / 60;
    const p = clamp(timeLeft / timeMax, 0, 1); clock.style.setProperty('--p', p); clock.classList.toggle('low', p < 0.22);
    clock.textContent = p > 0.22 ? '☀️' : '🌙';
    if (timeLeft <= 0) lose();
    if (popBackEvery && popped > 2) {
      popBackT -= dt / 60;
      if (popBackT <= 0) {
        popBackT = popBackEvery;
        const cands = bubbles.filter(b => !b.up && now - b.popAt > 1.2);
        if (cands.length) {
          const b = cands[Math.floor(Math.random() * cands.length)]; b.up = true; b.v = 0.45; b.sq = 0.8; popped--;
          bubMesh.setColorAt(bubbles.indexOf(b), b.col); bubMesh.instanceColor.needsUpdate = true;
          tone(260, 0.16, 'sine', 0.12, 2.2);
          burst(scene, new THREE.Vector3(b.x, TOP + 0.3, b.z), ['#ffffff', '#ffd23f'], 6, { speed: 0.04, up: 0.06, size: 0.4, shape: 'sphere' });
          ui.progress(popped / bubbles.length);
        }
      }
    }
  }
  // bubble springs: up = dome (1), popped = dimple (-0.55)
  for (const b of bubbles) {
    const tgt = b.up ? 1 : 0.16; b.v += (tgt - b.s) * 0.28 * dt; b.v *= Math.pow(0.68, dt); b.s += b.v * dt;
    b.sq = Math.max(0, b.sq - 0.08 * dt);
  }
  if (bubMesh) writeBubbles();
  floD.forEach((d, i) => { const a = d.a + t * 0.05; _m.compose(_p.set(Math.cos(a) * d.r * 0.8, 0.6 + Math.sin(t + d.ph) * 0.25, Math.sin(a) * d.r * 1.15), _q, _s.setScalar(d.s)); FLO.setMatrixAt(i, _m); });
  FLO.instanceMatrix.needsUpdate = true;
  // board: idle breathing, win spin + hop
  spin = Math.max(0, spin - dt * 0.018); jump = Math.max(0, jump - dt * 0.025);
  board.rotation.y = (1 - spin) * 0 + (spin > 0 ? (1 - spin) * Math.PI * 2 : 0);
  board.position.y = Math.sin(jump * Math.PI) * 1.4;
  const breathe = 1 + Math.sin(t * 2) * 0.008; board.scale.set(breathe, 1, breathe);
  // eyes: look at the finger, blink, squint on win, look down on lose
  blinkT -= dt / 60; const blink = blinkT < 0.12 ? 0.15 : 1; if (blinkT < 0) blinkT = 2 + Math.random() * 3;
  for (const e of eyes) {
    const local = board.worldToLocal(lookAt.clone()), dx = local.x - e.g.position.x, dz = local.z - e.g.position.z, l = Math.hypot(dx, dz) || 1;
    const k = e.er * 0.42, px = mood === -1 ? 0 : dx / l * k, pz = mood === -1 ? k : dz / l * k;
    e.p.position.set(lerp(e.p.position.x, px, 0.2), e.er * 0.4, lerp(e.p.position.z, pz, 0.2));
    e.gl.position.set(e.p.position.x - e.er * 0.14, e.er * 0.62, e.p.position.z - e.er * 0.14);
    const sy = mood === 1 ? 0.25 : blink; e.g.scale.set(1, 1, lerp(e.g.scale.z, sy, 0.3));
  }
  if (mouth) mouth.scale.z = lerp(mouth.scale.z, mood === -1 ? -0.6 : mood === 1 ? 1.5 : 1, 0.15);
});

build(); ui.start(); ui.score(0);
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // pop like a kid swiping: the closest standing bubble to the last one
    if (state !== 'play') return;
    const left = bubbles.filter(b => b.up); if (!left.length) return;
    let pick = left[0];
    if (botLast) { let bd = 1e9; for (const b of left) { const d = Math.hypot(b.x - botLast.x, b.z - botLast.z); if (d < bd) { bd = d; pick = b; } } }
    botLast = pick; lookAt.set(pick.x, TOP, pick.z); popBubble(pick, true);
    if (state === 'play') { const nb = bubbles.filter(b => b.up); if (nb.length) { let q = nb[0], bd = 1e9; for (const b of nb) { const d = Math.hypot(b.x - pick.x, b.z - pick.z); if (d < bd) { bd = d; q = b; } } botLast = q; popBubble(q, true); } }
  },
};

// Gulp Garden — original game. Slide a hole around a tiny diorama, swallow the small stuff to grow,
// then gulp the big target treats before the timer runs out.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, store, rng, lerp, clamp, mat, glossy, rounded, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { buildModels, THEMES } from './models.js';
import { board as worldBoard } from './kit/board.js';
const B = worldBoard({ game: 'gulp-garden', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const stage = createStage({ fov: 42, shadows: true, shadowSize: 13 });
const { scene, camera, sun, renderer } = stage;
const ui = createUI({ title: 'GULP<br>GARDEN', hint: 'Tap where the hole should go · or drag', hand: '👆' });
const css = document.createElement('style');
css.textContent = `.hc-score{display:none}
.gg-goals{position:fixed;left:12px;top:calc(58px + env(safe-area-inset-top));display:flex;gap:8px;z-index:5;pointer-events:none}
.gg-goal{width:56px;height:62px;border-radius:12px;background:linear-gradient(180deg,#5b6bd6,#3f4ab0);box-shadow:0 3px 0 rgba(0,0,0,.25),inset 0 0 0 3px rgba(255,255,255,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:transform .15s}
.gg-goal b{font-size:26px;line-height:1.1}.gg-goal span{font-weight:800;font-size:16px;line-height:1}
.gg-goal.done{background:linear-gradient(180deg,#5fd06a,#2fa043)} .gg-goal.bump{transform:scale(1.18)}
.gg-time{position:fixed;right:12px;top:calc(58px + env(safe-area-inset-top));z-index:5;background:rgba(0,0,0,.28);border-radius:16px;padding:4px 12px;font-weight:800;font-size:20px;pointer-events:none}
.gg-time.low{background:#ff4d6d;animation:hcpulse .5s infinite}
.gg-lv{position:fixed;z-index:5;pointer-events:none;font-weight:800;font-size:17px;color:#ff8a1f;transform:translate(-50%,0);
  -webkit-text-stroke:1px rgba(110,40,0,.6);text-shadow:0 2px 0 rgba(110,40,0,.4)}
.gg-plus{position:fixed;z-index:6;pointer-events:none;font-weight:800;font-size:18px;color:#fff;transform:translate(-50%,-50%);animation:ggp .7s ease-out forwards;
  text-shadow:0 2px 0 rgba(0,0,0,.35)}
@keyframes ggp{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}20%{opacity:1;transform:translate(-50%,-80%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-260%) scale(1)}}
.hc-card h1{text-shadow:0 6px 0 rgba(0,0,0,.18)}
.hc-pop{-webkit-text-stroke:1.5px rgba(120,50,0,.55);text-shadow:0 3px 0 rgba(120,50,0,.35)!important}`;
document.head.appendChild(css);
const goalsEl = Object.assign(document.createElement('div'), { className: 'gg-goals' });
const timeEl = Object.assign(document.createElement('div'), { className: 'gg-time' });
const lvEl = Object.assign(document.createElement('div'), { className: 'gg-lv' });
document.body.append(goalsEl, timeEl, lvEl);
const save = store('gulpgarden');
const F = flow('gulpgarden');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), state = 'ready';

// ------------------------------------------------------------------ models (one InstancedMesh per type)
const MODELS = buildModels();
const objMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.02 });
sun.position.set(5, 16, 9); sun.intensity = 1.6; stage.hemi.intensity = 1.2;

// ------------------------------------------------------------------ hole: ground with a cut-out + a dark well underneath
const HOLE = { x: 0, z: 4, r: 0.45, R: 0.45, lv: 1, xp: 0 };
const LV_R = [0, 0.45, 0.62, 0.82, 1.05, 1.32, 1.65, 2.0, 2.4];
const LV_XP = [0, 0, 10, 26, 52, 95, 160, 260, 400];
const holeU = { value: new THREE.Vector3(0, 4, 0.45) };
function holeCut(m) {   // discard ground fragments inside the hole
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHole = holeU;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uHole; varying vec3 vWp;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (distance(vWp.xz, uHole.xy) < uHole.z) discard;');
  };
  return m;
}
const well = new THREE.Group(); scene.add(well);
const wellWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true), new THREE.ShaderMaterial({ side: THREE.BackSide,
  vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying float vY; void main(){ float k = smoothstep(-0.5, 0.5, vY); gl_FragColor = vec4(vec3(0.02, 0.02, 0.05) + vec3(0.16, 0.14, 0.2) * k * k, 1.); }` }));
wellWall.position.y = -0.5; well.add(wellWall);
const wellBottom = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#05050a' })); wellBottom.rotation.x = -Math.PI / 2; wellBottom.position.y = -0.99; well.add(wellBottom);
const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 56), glossy('#ffffff')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; well.add(rim);
const arcMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { p: { value: 0 }, pulse: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float p, pulse; varying vec2 vUv; void main(){ vec2 q = vUv - 0.5; float a = atan(q.x, q.y) / 6.2831853 + 0.5; float on = step(1. - p, a);
    vec3 c = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.55, 0.12), on); gl_FragColor = vec4(c + pulse, on > 0.5 ? 0.95 : 0.35); }` });
const arc = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.3, 64), arcMat); arc.rotation.x = -Math.PI / 2; arc.position.y = 0.03; well.add(arc);

// ------------------------------------------------------------------ board (diorama tray floating on the pastel background)
let board = null, BW = 12, BD = 17, objs = [], meshes = {}, goals = [], timeLeft = 60, timeMax = 60, eaten = 0, combo = 0, comboT = 0, theme = THEMES[0];
function groundTex(th, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  if (th.decor === 'tiles') {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? th.ground[0] : th.ground[1]; g.fillRect(x * 64, y * 64, 64, 64); }
    g.strokeStyle = 'rgba(200,150,120,.25)'; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke(); }
  } else if (th.decor === 'rug') {
    for (let x = 0; x < 8; x++) { g.fillStyle = x % 2 ? th.ground[0] : th.ground[1]; g.fillRect(x * 64, 0, 64, 512); }
    g.strokeStyle = 'rgba(90,50,20,.25)'; g.lineWidth = 3; for (let x = 0; x <= 8; x++) { g.beginPath(); g.moveTo(x * 64, 0); g.lineTo(x * 64, 512); g.stroke(); }
    const r = rng(seed); g.fillStyle = 'rgba(90,50,20,.18)'; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(r() * 8) * 64 + 4, r() * 512, 56, 2);
  } else {
    for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? th.ground[0] : th.ground[1]; g.fillRect(0, y * 64, 512, 64); }
    const r = rng(seed); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,110,20'},${0.08 + r() * 0.1})`; g.fillRect(r() * 512, r() * 512, 2, 4 + r() * 4); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function buildBoard() {
  if (board) { scene.remove(board); board.traverse(o => { if (o.material && o.material.map) o.material.map.dispose(); }); }
  board = new THREE.Group(); scene.add(board);
  const tex = groundTex(theme, level); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(BW / 8, BD / 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), holeCut(mat('#ffffff', { map: tex, roughness: 0.9 }))); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; board.add(ground);
  const base = new THREE.Mesh(rounded(BW + 1.0, 1.1, BD + 1.0, 0.25), holeCut(mat(theme.base, { roughness: 0.8 }))); base.position.y = -0.86; base.receiveShadow = true; board.add(base);
  // raised rim around the tray
  const rm = mat(theme.rim, { roughness: 0.7 });
  for (const [w, d, x, z] of [[BW + 1.0, 0.5, 0, -BD / 2 - 0.25], [BW + 1.0, 0.5, 0, BD / 2 + 0.25], [0.5, BD, -BW / 2 - 0.25, 0], [0.5, BD, BW / 2 + 0.25, 0]]) {
    const m = new THREE.Mesh(rounded(w, 0.45, d, 0.18), rm); m.position.set(x, 0.12, z); m.castShadow = m.receiveShadow = true; board.add(m);
  }
  if (theme.decor === 'blanket') {   // a checkered picnic blanket patch (decor only)
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#ff5d6c' : '#ffffff'; g.fillRect(x * 16, y * 16, 16, 16); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), holeCut(mat('#ffffff', { map: t, roughness: 0.9 }))); bl.rotation.x = -Math.PI / 2; bl.rotation.z = 0.15; bl.position.set(-2.2, 0.01, -3.5); bl.receiveShadow = true; board.add(bl);
  }
}

// ------------------------------------------------------------------ level generation: patterns of props, seeded
function genLevel(n) {
  const r = rng(n * 7121 + 3); theme = THEMES[(n - 1) % THEMES.length];
  BW = 11 + Math.min(4, Math.floor(n / 3)); BD = 16 + Math.min(6, Math.floor(n / 2));
  const list = [];
  const pick = (a) => a[Math.floor(r() * a.length)];
  const fits = (x, z, rr) => Math.abs(x) < BW / 2 - rr - 0.15 && Math.abs(z) < BD / 2 - rr - 0.15;
  const free = (x, z, rr) => list.every(o => Math.hypot(o.x - x, o.z - z) > o.r + rr - 0.04);
  const put = (key, x, z, ry = (r() - 0.5) * 0.9) => { const m = MODELS[key]; if (fits(x, z, m.r) && free(x, z, m.r) && Math.hypot(x - 0, z - (BD / 2 - 2.2)) > 1.2) list.push({ key, x, z, r: m.r, ry }); };
  // big centre pieces first (they need a grown hole)
  const nBig = n === 1 ? 0 : Math.min(1 + Math.floor(n / 4), 3);
  for (let i = 0; i < nBig; i++) put(pick(theme.big), (r() - 0.5) * (BW - 4), -BD / 2 + 3 + r() * (BD - 8));
  const nMid = 1 + Math.min(4, Math.floor(n / 2));
  for (let i = 0; i < nMid; i++) {   // rings of mid items around a centre
    const key = pick(theme.mid), cx = (r() - 0.5) * (BW - 4), cz = (r() - 0.5) * (BD - 5), R = 1.2 + r() * 1.2, N = Math.floor(2 * Math.PI * R / (MODELS[key].r * 2.1));
    for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2; put(key, cx + Math.cos(a) * R, cz + Math.sin(a) * R, -a + Math.PI / 2); }
  }
  // small stuff: spirals, rows and heaps (the bulk, like a snack field)
  const nPat = 6 + Math.min(7, n);
  for (let i = 0; i < nPat; i++) {
    const key = pick(theme.small), m = MODELS[key], kind = r(), cx = (r() - 0.5) * (BW - 2), cz = (r() - 0.5) * (BD - 2);
    if (kind < 0.35) { for (let k = 0; k < 40; k++) { const a = k * 0.5, R = 0.45 + k * 0.09; put(key, cx + Math.cos(a) * R, cz + Math.sin(a) * R); } }
    else if (kind < 0.7) { const ang = r() * Math.PI, len = 5 + Math.floor(r() * 6); for (let row = 0; row < 2; row++) for (let k = 0; k < len; k++) { const d = (k - len / 2) * m.r * 2.15, o = (row - 0.5) * m.r * 2.2; put(key, cx + Math.cos(ang) * d - Math.sin(ang) * o, cz + Math.sin(ang) * d + Math.cos(ang) * o); } }
    else { for (let k = 0; k < 22; k++) { const a = r() * 6.28, R = Math.sqrt(r()) * 1.6; put(key, cx + Math.cos(a) * R, cz + Math.sin(a) * R); } }
  }
  // goals: the biggest available type that exists + one small type
  const counts = {}; for (const o of list) counts[o.key] = (counts[o.key] || 0) + 1;
  const g = [];
  const bigK = Object.keys(counts).sort((a, b) => MODELS[b].r - MODELS[a].r)[0];
  g.push(bigK);
  const smallKs = Object.keys(counts).filter(k => k !== bigK && MODELS[k].r < 0.35).sort((a, b) => counts[b] - counts[a]);
  if (smallKs.length && (n === 1 || r() < 0.8)) g.push(smallKs[0]);
  const xpAll = list.reduce((a, o) => a + xpOf(o.r), 0);
  return { list, goals: g, counts, time: Math.round(clamp((22 + list.length * 0.08 + nBig * 5) / F.k(), 24, 75)), xpAll };
}
const xpOf = (r) => Math.max(1, Math.round(r * r * 14));

function buildLevel() {
  for (const k in meshes) scene.remove(meshes[k]);
  meshes = {}; objs = [];
  const L = genLevel(level);
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', '#ff8a1f');
  buildBoard();
  const byKey = {};
  for (const o of L.list) (byKey[o.key] = byKey[o.key] || []).push(o);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (const key in byKey) {
    const arr = byKey[key], im = new THREE.InstancedMesh(MODELS[key].geo, objMat, arr.length);
    im.castShadow = true; im.receiveShadow = true; scene.add(im); meshes[key] = im;
    arr.forEach((o, i) => { o.i = i; o.im = im; o.y = 0; o.state = 0; o.tilt = 0; o.goal = L.goals.includes(key); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry); im.setMatrixAt(i, m4.compose(p.set(o.x, 0, o.z), q, s)); objs.push(o); });
    im.instanceMatrix.needsUpdate = true;
  }
  goals = L.goals.map(k => ({ key: k, left: L.counts[k], total: L.counts[k] }));
  goalsEl.innerHTML = goals.map(g => `<div class="gg-goal" data-k="${g.key}"><b>${MODELS[g.key].emoji}</b><span>${g.left}</span></div>`).join('');
  tapTo = null; Object.assign(HOLE, { x: 0, z: BD / 2 - 2.2, lv: 1, xp: 0, r: LV_R[1], R: LV_R[1] });
  timeLeft = timeMax = L.time; eaten = 0; combo = 0;
  ui.levels(level); ui.progress(0); ui.sub(''); updateTime();
}
function updateTime() { timeEl.textContent = '⏱ ' + Math.ceil(timeLeft); timeEl.classList.toggle('low', timeLeft < 10 && state === 'play'); }
const goalTotal = () => goals.reduce((a, g) => a + g.total, 0), goalLeft = () => goals.reduce((a, g) => a + g.left, 0);

// ------------------------------------------------------------------ input: relative drag
let dragK = 0.02;
let tapTo = null;   // a plain tap glides the hole to the tapped spot on the lawn
const tapRay = new THREE.Raycaster(), tapNdc = new THREE.Vector2(), tapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tapHit = new THREE.Vector3();
const inp = input({
  onDown() { tapTo = null; },
  onTap(e) {
    if (state !== 'play') return;
    tapNdc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); tapRay.setFromCamera(tapNdc, camera);
    if (tapRay.ray.intersectPlane(tapPlane, tapHit)) tapTo = { x: clamp(tapHit.x, -BW / 2 + HOLE.r * 0.6, BW / 2 - HOLE.r * 0.6), z: clamp(tapHit.z, -BD / 2 + HOLE.r * 0.6, BD / 2 - HOLE.r * 0.6) };
  },
  onMove(dx, dy) {
    if (state !== 'play') return;
    HOLE.x = clamp(HOLE.x + dx * dragK, -BW / 2 + HOLE.r * 0.6, BW / 2 - HOLE.r * 0.6);
    HOLE.z = clamp(HOLE.z + dy * dragK, -BD / 2 + HOLE.r * 0.6, BD / 2 - HOLE.r * 0.6);
  },
});
ui.onTap(w => { B.start();
  if (w === 'start') { state = 'play'; }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; }
  else if (w === 'lose') { buildLevel(); state = 'play'; }
});

// ------------------------------------------------------------------ eating
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
function screenOf(x, y, z) { _v.set(x, y, z).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; }
function plus(text, x, z, color = '#fff', size = 18) {
  const [sx, sy] = screenOf(x, 0.6, z); const d = document.createElement('div'); d.className = 'gg-plus'; d.textContent = text; d.style.left = sx + (Math.random() - 0.5) * 30 + 'px'; d.style.top = sy + 'px'; d.style.color = color; d.style.fontSize = size + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 700);
}
let lastTooBig = 0, pulse = 0;
function swallowed(o) {
  eaten++; combo++; comboT = 0.5;
  HOLE.xp += xpOf(o.r);
  plus('+1', HOLE.x, HOLE.z, o.goal ? '#ffe14d' : '#ffffff', o.goal ? 22 : 18);
  note(72 + Math.min(14, combo) + (o.goal ? 5 : 0), 0.12, 0.07); if (o.r > 0.5) { tone(160, 0.2, 'sine', 0.14, 0.5); buzz(25); shake = 0.25; }
  else buzz(4);
  if (o.goal) {
    const g = goals.find(g => g.key === o.key); g.left = Math.max(0, g.left - 1);
    const el = goalsEl.querySelector(`[data-k="${o.key}"]`); el.querySelector('span').textContent = g.left; el.classList.toggle('done', g.left === 0); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 140);
    ui.progress(1 - goalLeft() / goalTotal());
    if (goalLeft() === 0 && state === 'play') win();
  }
  // grow
  while (HOLE.lv < LV_R.length - 1 && HOLE.xp >= LV_XP[HOLE.lv + 1]) {
    HOLE.lv++; HOLE.R = LV_R[HOLE.lv]; pulse = 1;
    ui.pop('LEVEL UP!', '#ffe14d', 38, 30); sfx.win(); buzz([15, 30, 15]);
  }
  if (combo === 15 || combo === 30 || combo === 60) ui.pop(combo === 15 ? 'YUMMY!' : combo === 30 ? 'GULP x30!' : 'UNSTOPPABLE!', '#ffe14d', 36, 24);
}
function win() {
  if (state === 'play') B.submit(1); state = 'won'; F.level(true); sfx.win(); buzz([20, 40, 20]); ui.flash(0.4);
  confetti(scene, new THREE.Vector3(HOLE.x, 1.5, HOLE.z), 90);
  const t = Math.ceil(timeLeft); ui.win(level, `${eaten} gulped · ${t}s left`);
}
function lose() { state = 'lost'; F.level(false, (goalTotal() - goalLeft()) / goalTotal()); sfx.fail(); buzz([40, 30, 60]); ui.lose("TIME'S UP!", `${goalTotal() - goalLeft()} / ${goalTotal()} targets`); }

// ------------------------------------------------------------------ main loop
let shake = 0;
const camPos = new THREE.Vector3(0, 14, 14), camAt = new THREE.Vector3();
loop((dt60) => {
  const dt = Math.min(dt60 / 60, 0.05);
  if (state === 'play') { timeLeft -= dt; updateTime(); if (timeLeft <= 0) { timeLeft = 0; lose(); } }
  if (tapTo && state === 'play') { const dx = tapTo.x - HOLE.x, dz = tapTo.z - HOLE.z, L = Math.hypot(dx, dz), st = Math.min(L, 7 * dt); if (L < 0.05) tapTo = null; else { HOLE.x += dx / L * st; HOLE.z += dz / L * st; } }
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  // hole grows smoothly
  HOLE.r = lerp(HOLE.r, HOLE.R, 1 - Math.pow(0.02, dt)); pulse = Math.max(0, pulse - dt * 2);
  const hr = HOLE.r * (1 + pulse * 0.08);
  holeU.value.set(HOLE.x, HOLE.z, hr);
  well.position.set(HOLE.x, 0, HOLE.z); wellWall.scale.set(hr, 1, hr); wellBottom.scale.setScalar(hr); rim.scale.set(hr, hr, 1); arc.scale.set(hr, hr, 1);
  const need = HOLE.lv < LV_R.length - 1 ? (HOLE.xp - LV_XP[HOLE.lv]) / (LV_XP[HOLE.lv + 1] - LV_XP[HOLE.lv]) : 1;
  arcMat.uniforms.p.value = lerp(arcMat.uniforms.p.value, clamp(need, 0, 1), 0.2); arcMat.uniforms.pulse.value = pulse * 0.6;

  // props
  const touched = new Set();
  for (const o of objs) {
    if (o.state === 2) continue;
    const dx = o.x - HOLE.x, dz = o.z - HOLE.z, d = Math.hypot(dx, dz);
    if (o.state === 0) {
      if (d > hr + o.r) { if (o.tilt) { o.tilt = lerp(o.tilt, 0, 0.2); if (Math.abs(o.tilt) < 0.005) o.tilt = 0; touched.add(o); } continue; }
      const canEat = o.r <= hr * 0.92;
      if (canEat && d < hr - o.r * 0.25) { o.state = 1; o.vy = 0; o.ox = dx; o.oz = dz; o.spin = (Math.random() - 0.5) * 8; o.t = 0; }
      else if (state === 'play') {   // teeter at the edge
        const over = clamp((hr + o.r - d) / (o.r * 2), 0, 1);
        o.tilt = canEat ? over * 0.6 : Math.sin(performance.now() / 50 + o.i) * 0.06 * over;
        if (canEat) { o.x -= dx / (d || 1) * over * dt * 2.5; o.z -= dz / (d || 1) * over * dt * 2.5; }
        else if (performance.now() - lastTooBig > 900 && over > 0.4) { lastTooBig = performance.now(); const need = LV_R.findIndex(rr => rr * 0.92 >= o.r); plus('Lv.' + need, o.x, o.z, '#ffb3b3', 18); tone(200, 0.06, 'square', 0.04, 0.8); }
        touched.add(o);
      }
    }
    if (o.state === 1) {   // falling into the hole: drift toward the centre and drop
      o.t += dt; o.vy -= 22 * dt; o.y += o.vy * dt; o.ox *= Math.pow(0.05, dt); o.oz *= Math.pow(0.05, dt);
      o.x = HOLE.x + o.ox; o.z = HOLE.z + o.oz; o.tilt += o.spin * dt;
      if (o.y < -1.0 - o.r) { o.state = 2; swallowed(o); _m.makeScale(0, 0, 0); o.im.setMatrixAt(o.i, _m); o.im.instanceMatrix.needsUpdate = true; continue; }
      touched.add(o);
    }
  }
  for (const o of touched) {
    const dx = o.x - HOLE.x, dz = o.z - HOLE.z, a = Math.atan2(dz, dx);
    _q.setFromEuler(_e.set(0, o.ry, 0)); const tq = new THREE.Quaternion().setFromAxisAngle(_v.set(Math.sin(a), 0, -Math.cos(a)), o.tilt);
    const sc = o.state === 1 ? Math.max(0.3, 1 + o.y * 0.3) : 1;
    o.im.setMatrixAt(o.i, _m.compose(_s.set(o.x, o.y, o.z), tq.multiply(_q), new THREE.Vector3(sc, sc, sc))); o.im.instanceMatrix.needsUpdate = true;
  }

  // camera: tilted top-down, follows the hole, pulls back as it grows
  const asp = camera.aspect, base = (asp < 0.7 ? 11.5 : 9) + HOLE.r * 3.2;
  const tx = lerp(0, HOLE.x, 0.55), tz = lerp(0, HOLE.z, 0.6);
  camAt.lerp(_v.set(tx, 0, tz - 0.6), 1 - Math.pow(0.05, dt));
  camPos.lerp(_v.set(camAt.x, base * 1.05, camAt.z + base * 0.62), 1 - Math.pow(0.05, dt));
  shake = Math.max(0, shake - dt * 2);
  camera.position.copy(camPos).add(_v.set((Math.random() - 0.5) * shake * 0.3, 0, (Math.random() - 0.5) * shake * 0.3)); camera.lookAt(camAt);
  stage.followLight(camAt);
  // drag scale = world units per pixel at the ground
  dragK = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.distanceTo(camAt) / innerHeight * 1.15;
  // "Lv. N" label under the hole
  const [lx, ly] = screenOf(HOLE.x, 0, HOLE.z + hr + 0.25); lvEl.style.left = lx + 'px'; lvEl.style.top = ly + 'px'; lvEl.textContent = 'Lv. ' + HOLE.lv;
});
buildLevel(); window.__scene = scene;

// ------------------------------------------------------------------ test hooks
let botDown = false;
window.__dbg = () => ({ lv: HOLE.lv, xp: HOLE.xp, t: Math.round(timeLeft), goals: goals.map(g => g.key + g.left).join(' '), xpAll: objs.reduce((a, o) => a + (o.state === 2 ? 0 : xpOf(o.r)), 0) });
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return eaten; },
  bot() {
    if (state !== 'play') { botDown = false; return; }
    if (!botDown || !inp.down) { dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 700 })); botDown = true; bx = 200; by = 700; return; }
    const hr = HOLE.r; let best = null, bd = 1e9;
    for (const o of objs) {
      if (o.state !== 0 || o.r > hr * 0.92) continue;
      const d = Math.hypot(o.x - HOLE.x, o.z - HOLE.z) - (o.goal ? 2.5 : 0) - o.r * 3;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    let dx = best.x - HOLE.x, dz = best.z - HOLE.z; const L = Math.hypot(dx, dz), step = Math.min(L, 1.1);
    if (L > 0.001) { dx = dx / L * step; dz = dz / L * step; }
    bx += dx / dragK; by += dz / dragK;
    dispatchEvent(new PointerEvent('pointermove', { clientX: bx, clientY: by }));
  },
};
let bx = 200, by = 700;

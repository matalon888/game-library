// Doodle Legs — original game. Scribble a shape in the pad: it becomes the spinning legs of your cube.
// Big legs vault walls and stairs, tiny legs fit under low roofs. Redraw any time. Beat three rivals to the flag.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, glossy, clamp, lerp } from './kit/hc.js';
import { makeRacer, setShape, step, course, floorAt, HALF } from './physics.js';

const OMEGA = -2 * Math.PI * 0.9;            // player motor (rad/s, negative = forward)
const LANE_Z = [0, -1.75, -3.5, -5.25], LANE_D = 1.0;
const LANE_COLS = [['#ffc21a', '#ff8a1e'], ['#ff7a5c', '#ff4d6d'], ['#ffa94d', '#ff6b3d'], ['#ff8fb1', '#ff5d8f']];
const CUBE_COLS = ['#1e9bff', '#3ccf5a', '#ff4fa3', '#9b62ff'];
const NAMES = ['Mia', 'Leo', 'Zoe', 'Kai', 'Noa', 'Ava', 'Max', 'Ivy', 'Rex', 'Lua', 'Tom', 'Sky', 'Bo', 'Nia', 'Ray', 'Eva'];
const BGS = [['#8f9cf7', '#e9b9f4'], ['#7fb6ff', '#c7f0ff'], ['#ff9ec7', '#ffd9a8'], ['#8ad8c8', '#e2f7c9'], ['#a99cff', '#ffc2e2']];

const stage = createStage({ fov: 40, shadowSize: 9 });
const { scene, camera, renderer, sun } = stage;
const save = store('doodlelegs');
let level = save.get('level', 1), wins = save.get('wins', 0), state = 'ready';
const ui = createUI({ title: 'DOODLE<br>LEGS', hint: 'Draw legs. Race. Climb!', hand: '✍️', score: false });

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
  if (R.me) { sfx.pick(3); buzz(12); burst(scene, new THREE.Vector3(R.sim.x, R.sim.y, LANE_Z[R.lane] + 0.5), ['#ffffff', '#fff36b'], 10, { speed: 0.07, up: 0.06, size: 0.5, shape: 'sphere' }); }
  R.stuck = 0; R.lastX = R.sim.x;
}

// ---------------------------------------------------------------- level
function startLevel() {
  world.remove(...world.children); racers.forEach(R => R.tag && R.tag.remove());
  if (tiles) { tiles.dispose(); }
  const bg = BGS[(level - 1) % BGS.length]; document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]); document.body.style.setProperty('--ui', '#ff5d8f');
  C = course(level); finishX = C.finish;
  buildTrack();
  const r = rng(level * 131 + 7), names = NAMES.slice().sort(() => r() - 0.5);
  racers = [];
  for (let i = 0; i < LANE_Z.length; i++) {
    const sim = makeRacer(-3.2, floorAt(C, -3.2) + HALF + 0.02), view = makeRacerView(i);
    const R = { sim, view, lane: i, me: i === 0, name: i ? names[i] : 'YOU', omega: OMEGA, stuck: 0, lastX: sim.x, done: false, pop: 0, contactT: 0, sq: 0 };
    if (!R.me) {
      R.omega = OMEGA * (0.72 + Math.min(0.14, level * 0.018) + r() * 0.06);
      R.ai = { think: 0.5 + r() * 0.6, wait: 0.4 + r() * 0.9, mode: '', bigI: Math.floor(r() * BIG.length), smallI: Math.floor(r() * SMALL.length), dumb: r() < 0.35 };
      R.tag = document.createElement('div'); R.tag.className = 'tag'; R.tag.innerHTML = `<i style="background:${CUBE_COLS[i]}"></i>${R.name}`; document.body.appendChild(R.tag);
      giveShape(R, (R.ai.dumb ? SMALL : BIG)[R.ai.bigI % (R.ai.dumb ? SMALL.length : BIG.length)]());
    }
    view.g.position.set(sim.x, sim.y, LANE_Z[i]); world.add(view.g); racers.push(R);
  }
  racers[0].view.legs.clear();
  ui.levels(level); ui.progress(0); ui.pill('');
  raceOn = false; raceT = 0; lastRank = 1; stuckT = 0; nudged = false; endT = 0; botDraw = null;
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
  if (!raceOn) { raceOn = true; ui.pop('GO!', '#fff', 64, 30); tone(660, 0.12, 'triangle', 0.14, 1.4); }
  hint.style.opacity = 0; pad.classList.remove('nudge'); nudged = false; stuckT = 0;
  return true;
}
input({
  onDown(e) { if (state !== 'play' || !inPad(e.clientX, e.clientY)) return; botDraw = null; stroke = [[e.clientX - padRect.left, e.clientY - padRect.top]]; clearInk(); drawInk(stroke); pad.classList.add('hot'); hint.style.opacity = 0; },
  onMove(dx, dy, e) {
    if (!stroke) return; const p = [clamp(e.clientX - padRect.left, 4, padRect.width - 4), clamp(e.clientY - padRect.top, 4, padRect.height - 4)];
    const l = stroke[stroke.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2.5) return; stroke.push(p); clearInk(); drawInk(stroke);
    const now = performance.now(); if (now - lastScribble > 55) { lastScribble = now; tone(260 + Math.random() * 140, 0.035, 'triangle', 0.035, 0.8); }
  },
  onUp() { if (!stroke) return; pad.classList.remove('hot'); if (!commitStroke(stroke)) { clearInk(); if (!raceOn) hint.style.opacity = 1; } stroke = null; },
});

// ghost hint: a dotted "U" being drawn until the first stroke
function drawGhost(dt) {
  ghostT += dt / 60; const w = padRect.width, h = padRect.height, t = (ghostT % 2.2) / 1.6;
  clearInk(); const pts = [];
  for (let i = 0; i <= 30 * Math.min(1, t); i++) { const a = Math.PI + (i / 30) * Math.PI; pts.push([w / 2 - Math.cos(a) * w * 0.17, h * 0.42 - Math.sin(a) * h * 0.3]); }
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
let botDraw = null, botMode = '', botBig = 0;
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

// ---------------------------------------------------------------- main loop
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();
let shake = 0;
function finish(won) {
  if (state !== 'play') return;
  state = won ? 'won' : 'lost';
  if (won) {
    wins++; level++; save.set('level', level); save.set('wins', wins);
    sfx.win(); buzz([30, 40, 60]); ui.flash(0.55);
    const p = racers[0].sim; confetti(scene, new THREE.Vector3(p.x + 1, p.y + 1.5, 0), 90); confetti(scene, new THREE.Vector3(p.x + 1, p.y + 2.5, -3), 60);
    ui.pop('1st PLACE!', '#fff', 48, 26); ui.win(level - 1, `Race won · ${wins} total`);
  } else {
    sfx.fail(); buzz([60, 40, 60]);
    const w = racers.find(R => R.done && !R.me);
    ui.lose('TOO SLOW!', `${w ? w.name : 'A rival'} reached the flag first`);
  }
}

loop((dt, t) => {
  const s = dt / 60;
  if (!racers.length) return;
  if (state === 'play' && !raceOn && !botDraw && !stroke) drawGhost(dt);
  // physics
  for (const R of racers) {
    const sim = R.sim, prevC = sim.contact;
    if (state === 'play' || state === 'won' || (state === 'lost' && !R.me)) {
      if (raceOn || !R.me) {
        if (!raceOn) step(sim, C.rects, s, 0); else step(sim, C.rects, s, R.done ? R.omega * 0.6 : R.omega);
      }
    }
    if (sim.y < floorAt(C, sim.x) - 8) { sim.x = R.lastX - 1; sim.y = floorAt(C, sim.x) + 2; sim.vx = sim.vy = 0; }
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
  // ranking, crown, overtakes, progress
  const order = racers.slice().sort((a, b) => b.sim.x - a.sim.x);
  order.forEach((R, i) => R.view.crown.visible = i === 0 && raceOn);
  const me = racers[0], rank = order.indexOf(me) + 1;
  if (raceOn && state === 'play') {
    ui.pill(['1st', '2nd', '3rd', '4th'][rank - 1]);
    if (rank < lastRank) { ui.pop(rank === 1 ? 'TAKE THE LEAD!' : 'OVERTAKE!', '#fff', 34, 26); sfx.coin(); buzz(15); }
    lastRank = rank;
    const prog = clamp((me.sim.x + 3.2) / (finishX + 3.2), 0, 1); ui.progress(prog);
    for (const R of racers) if (R.mark) R.mark.style.left = clamp((R.sim.x + 3.2) / (finishX + 3.2), 0, 1) * 100 + '%';
    // nudge to redraw when stuck
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

ui.onTap((which) => {
  if (which === 'start') { state = 'play'; fitPad(); return; }
  startLevel(); fitPad(); state = 'play';
});
startLevel(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return wins; }, bot,
  dbg: () => racers.map(R => ({ x: +R.sim.x.toFixed(2), y: +R.sim.y.toFixed(2), stuck: +R.stuck.toFixed(2), R: +R.sim.R.toFixed(2) })),
};

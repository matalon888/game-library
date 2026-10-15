// Squish Gate — original game. A wobbly jelly slides down a runway; drag up to make it tall and thin, down to make it
// short and wide, and squeeze through every cut-out gate. Snug fits build combos and fever; the finish ladder pays out.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng, palette, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';

const ST = store('squishgate');
const F = flow('squishgate');
let fk = 1;
let level = ST.get('level', 1), best = ST.get('best', 0), score = 0;
const { scene, camera, sun, followLight } = createStage({ fov: 50, shadowSize: 9 });
const ui = createUI({ title: '<span class="sg-title"><b>SQUISH</b><i>GATE</i></span>', hint: 'Drag up & down to squish', hand: '↕️' });
const $ = id => document.getElementById(id);
ui.els.start.querySelector('.hand').style.animation = 'none';

// ---------------------------------------------------------------- constants
const A = 1.5;                 // jelly front area (w * h stays constant: squish one way, it spreads the other)
const HMIN = 0.5, HMAX = 3.0, DEPTH = 1.0, TRACK_W = 3.4, WALL_H = 3.9, WALL_T = 0.36;
const hOf = s => HMIN * Math.pow(HMAX / HMIN, s);          // log mapping: equal drag = equal "feel"
const sOf = h => Math.log(h / HMIN) / Math.log(HMAX / HMIN);
const JELLY_COLORS = ['#3ddc84', '#ff5d8f', '#ffb020', '#5b8cff', '#b45cff', '#20c9c0'];

// ---------------------------------------------------------------- shared assets
const geoUnit = rounded(1, 1, 1, 0.26);
const gateMat = mat('#2c2f63', { roughness: 0.38 });
const gateEdge = mat('#4a4f9a', { roughness: 0.4 });
const trackTop = mat('#ffffff', { roughness: 0.7 });
const trackSide = mat('#a9abd8', { roughness: 0.6 });
const cakeMats = { plate: mat('#ffffff'), sponge: mat('#ffd38a'), cream: mat('#ff8fb1'), top: mat('#fff4f7'), berry: glossy('#ff2d55') };
const CAKE_G = { plate: new THREE.CylinderGeometry(0.42, 0.36, 0.06, 24), sponge: new THREE.CylinderGeometry(0.3, 0.3, 0.32, 24), cream: new THREE.CylinderGeometry(0.31, 0.31, 0.08, 24), berry: new THREE.SphereGeometry(0.09, 12, 10) };
const POST_G = new THREE.CylinderGeometry(0.11, 0.11, 1, 12);
const DROP_G = new THREE.SphereGeometry(0.12, 10, 8);

// ---------------------------------------------------------------- world
const world = new THREE.Group(); scene.add(world);
let jelly, jellyMat, face, eyes = [], gates = [], cakes = [], posts = null, ladder = null, finishZ = 0, levelLen = 0;
let state = 'ready', s = 0.35, sDisp = 0.35, hV = 0, wV = 0, hD = hOf(0.35), wD = A / hOf(0.35);
let z = 0, speed = 0, baseSpeed = 0.13, bounce = 0, crashT = 0, hearts = 3, combo = 0, perfectRun = 0, fever = 0, feverMeter = 0;
let finishing = false, slideV = 0, multiplier = 1, perfects = 0, gatesTotal = 0, cakesGot = 0, t0 = 0, drops = [], shards = [], camShake = 0, lastShapeTone = 0;

function buildJelly(color) {
  if (jelly) world.remove(jelly);
  jellyMat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color('#ffffff'), emissive: new THREE.Color(color).multiplyScalar(0.18), transparent: true, opacity: 0.95 });
  jelly = new THREE.Group();
  const body = new THREE.Mesh(geoUnit, jellyMat); body.castShadow = true; jelly.add(body); jelly.body = body;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
  jelly.add(shine); jelly.shine = shine;
  face = new THREE.Group(); jelly.add(face); eyes = [];
  const white = mat('#ffffff', { roughness: 0.3 }), black = mat('#1d1d2b', { roughness: 0.2 }), blush = new THREE.MeshBasicMaterial({ color: '#ff7aa2', transparent: true, opacity: 0.55 });
  for (const zz of [-0.2, 0.2]) {
    const e = new THREE.Group(); const w = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), white); w.scale.set(0.45, 1.1, 1);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), black); p.position.set(-0.05, -0.02, -0.03); p.scale.set(0.6, 1.1, 1);
    e.add(w, p); e.position.z = zz; face.add(e); eyes.push(e);
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.08, 14), blush); b.rotation.y = -Math.PI / 2; b.position.set(-0.01, -0.2, zz * 1.55); b.scale.set(1, 0.6, 1); face.add(b);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 14, Math.PI), black); smile.rotation.set(0, -Math.PI / 2, Math.PI); smile.position.set(-0.02, -0.16, 0); face.add(smile);
  world.add(jelly);
}

function wallBox(w, h, x, y, zz, m = gateMat) {
  const mesh = new THREE.Mesh(rounded(w, h, WALL_T, 0.07), m); mesh.position.set(x, y, zz); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

function buildLevel() {
  const p = palette(level); applyPalette(p);
  const r = rng(level * 7919 + 13); fk = F.k();
  for (const g of gates) world.remove(g.group); for (const c of cakes) world.remove(c.g); for (const sh of shards) world.remove(sh.m);
  gates = []; cakes = []; shards = []; drops.forEach(d => world.remove(d.m)); drops = [];
  if (posts) world.remove(posts); if (ladder) world.remove(ladder);
  [...world.children].filter(o => o.userData.track).forEach(o => world.remove(o));

  const nGates = Math.min(6 + level, 18), gap = Math.max(8.5, 12 - level * 0.35);
  const tol = Math.max(0.085, (0.34 - level * 0.025) / fk);
  levelLen = 9 + nGates * gap + 4; finishZ = -levelLen;
  // track: lilac body + white top, then the finish ladder
  const total = levelLen + 30;
  const body = new THREE.Mesh(rounded(TRACK_W, 1.2, total, 0.14), trackSide); body.position.set(0, -0.76, -total / 2 + 6); body.receiveShadow = true; body.userData.track = 1;
  const top = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W - 0.16, 0.06, total - 0.3), trackTop); top.position.set(0, -0.03, -total / 2 + 6); top.receiveShadow = true; top.userData.track = 1;
  world.add(body, top);
  // finish line (checker) + multiplier ladder
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const cx = cv.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { cx.fillStyle = (i + j) % 2 ? '#2c2f63' : '#ffffff'; cx.fillRect(i * 16, j * 16, 16, 16); }
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W - 0.16, 0.42), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.6 }));
  chk.rotation.x = -Math.PI / 2; chk.position.set(0, 0.006, finishZ); chk.userData.track = 1; world.add(chk);
  const arch = new THREE.Group(); arch.userData.track = 1;
  for (const sx of [-1, 1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 12), mat('#ffffff')); pole.position.set(sx * (TRACK_W / 2 + 0.1), 2.1, finishZ); pole.castShadow = true; arch.add(pole); }
  const banner = new THREE.Mesh(rounded(TRACK_W + 0.6, 0.6, 0.16, 0.08), mat(p.a)); banner.position.set(0, 4.1, finishZ); arch.add(banner); world.add(arch);
  const L = document.createElement('canvas'); L.width = 256; L.height = 2560; const lx = L.getContext('2d');
  const RAIN = ['#ff4f7b', '#ff7a45', '#ffb020', '#f7d51d', '#8bd346', '#3ad07a', '#20c9c0', '#3a9bff', '#6a6cff', '#b45cff'];
  for (let i = 0; i < 10; i++) {
    const y = 2560 - (i + 1) * 256; lx.fillStyle = RAIN[i]; lx.fillRect(0, y, 256, 256); lx.fillStyle = 'rgba(255,255,255,.18)'; lx.fillRect(0, y, 256, 18);
    lx.font = '800 120px "Baloo 2", system-ui, sans-serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillStyle = 'rgba(0,0,0,.16)'; lx.fillText('x' + (i + 1), 132, y + 138); lx.fillStyle = '#fff'; lx.fillText('x' + (i + 1), 128, y + 132);
  }
  ladder = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W - 0.16, 22), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(L), roughness: 0.55 }));
  ladder.rotation.x = -Math.PI / 2; ladder.position.set(0, 0.008, finishZ - 1.2 - 11); ladder.receiveShadow = true; world.add(ladder);

  // gates: a full cut-out (both dims), a low bar (be short), or a fence of posts with a gap (be thin)
  const postSpots = [];
  let prevH = 1.2;
  for (let i = 0; i < nGates; i++) {
    const zz = -9 - i * gap - (r() - 0.5) * 1.4;
    const roll = r();
    let type = i < 1 ? 'hole' : roll < 0.6 ? 'hole' : roll < 0.8 ? 'bar' : 'posts';
    let ht;
    if (type === 'hole') { do { ht = 0.62 + r() * 2.0; } while (Math.abs(Math.log(ht / prevH)) < 0.45); }
    else if (type === 'bar') ht = 0.58 + r() * 0.3; else ht = 2.25 + r() * 0.55;
    prevH = ht;
    const wt = A / ht, k = 1 + tol;
    let hh = type === 'posts' ? WALL_H : ht * k, hw = type === 'bar' ? TRACK_W + 0.2 : Math.min(TRACK_W - 0.05, wt * k);
    const g = new THREE.Group(); g.position.z = zz; world.add(g);
    if (type === 'hole') {
      const P = 0.5;   // chunky frame around the cut-out
      g.add(wallBox(P, hh + P, -hw / 2 - P / 2, (hh + P) / 2, 0), wallBox(P, hh + P, hw / 2 + P / 2, (hh + P) / 2, 0), wallBox(hw + P * 2, P, 0, hh + P / 2, 0));
      const o = new THREE.Mesh(new THREE.BoxGeometry(hw + 0.02, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff' })); o.position.set(0, hh - 0.02, WALL_T / 2 + 0.06); g.add(o);
    } else if (type === 'bar') {
      g.add(wallBox(0.5, WALL_H, -TRACK_W / 2 - 0.3, WALL_H / 2, 0, gateEdge), wallBox(0.5, WALL_H, TRACK_W / 2 + 0.3, WALL_H / 2, 0, gateEdge), wallBox(TRACK_W + 1.1, 0.42, 0, hh + 0.21, 0));
    } else {
      // fence of posts, leaving a gap of width hw in the middle
      for (let x = hw / 2 + 0.12; x < TRACK_W / 2 + 0.2; x += 0.34) for (const sx of [-1, 1]) postSpots.push([sx * x, zz, 3.4 + r() * 0.5]);
      const cap = new THREE.Group(); g.add(cap);
    }
    gates.push({ group: g, z: zz, type, hh, hw, ht, done: false, hit: false, shake: 0 });
    // a treat between gates
    if (i < nGates - 1 || true) {
      const cz = zz - gap * 0.5 + (r() - 0.5);
      const c = new THREE.Group(); c.position.set(0, 0, cz);
      const pl = new THREE.Mesh(CAKE_G.plate, cakeMats.plate); pl.position.y = 0.03;
      const sp = new THREE.Mesh(CAKE_G.sponge, cakeMats.sponge); sp.position.y = 0.22; sp.castShadow = true;
      const cr = new THREE.Mesh(CAKE_G.cream, cakeMats.cream); cr.position.y = 0.42;
      const be = new THREE.Mesh(CAKE_G.berry, cakeMats.berry); be.position.y = 0.52;
      c.add(pl, sp, cr, be); world.add(c); cakes.push({ g: c, z: cz, got: false });
    }
  }
  if (postSpots.length) {
    posts = new THREE.InstancedMesh(POST_G, gateMat, postSpots.length); posts.castShadow = true;
    const m4 = new THREE.Matrix4();
    postSpots.forEach(([x, zz, h], i) => { m4.compose(new THREE.Vector3(x, h / 2, zz), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)); posts.setMatrixAt(i, m4); });
    world.add(posts);
  } else posts = null;
  gatesTotal = nGates;
  buildJelly(JELLY_COLORS[(level - 1) % JELLY_COLORS.length]);
  z = 2; speed = 0; s = sDisp = 0.35; hD = hOf(s); wD = A / hD; hV = wV = 0; hearts = 3; combo = 0; perfectRun = 0; fever = 0; feverMeter = 0;
  finishing = false; slideV = 0; multiplier = 1; perfects = 0; cakesGot = 0; crashT = 0; bounce = 0; score = 0;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : ''); updHearts(); updFever();
  placeJelly(0);
}

function updHearts() { $('hearts').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts); }
function updFever() { $('feverBar').style.width = (fever > 0 ? fever / 300 : feverMeter / 3) * 100 + '%'; $('fever').classList.toggle('on', fever > 0); }

// ---------------------------------------------------------------- input: vertical drag = squish
input({
  onMove(dx, dy) { if (state !== 'play' || finishing) return; s = clamp(s - dy * 0.0062, 0, 1); },
});
ui.onTap(which => {
  if (which === 'start') { state = 'play'; t0 = performance.now(); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); buildLevel(); state = 'play'; }
  else { buildLevel(); state = 'play'; }
});

// ---------------------------------------------------------------- game events
function passGate(g) {
  g.done = true;
  const ratio = Math.abs(Math.log(hD / g.ht));
  const perfect = g.type === 'hole' ? ratio < 0.11 : g.type === 'bar' ? hD > g.hh * 0.78 : wD > g.hw * 0.78;
  combo++; score += 5;
  if (perfect) {
    perfects++; perfectRun++; feverMeter = Math.min(3, feverMeter + 1); score += 5 * Math.min(perfectRun, 5);
    ui.pop(perfectRun > 1 ? `PERFECT x${perfectRun}` : 'PERFECT!', '#fff', 38 + Math.min(perfectRun, 4) * 3, 24);
    [72, 76, 79, 84].slice(0, 2 + Math.min(perfectRun, 2)).forEach((m, i) => setTimeout(() => note(m + Math.min(perfectRun, 5), 0.25, 0.14), i * 55));
    burst(scene, new THREE.Vector3(0, hD * 0.6, z - 0.4), ['#ffffff', jellyMat.color.getStyle(), '#ffd23f'], 16, { speed: 0.14, up: 0.06, size: 0.6, shape: 'sphere', gravity: 0.004 });
    buzz(14); ui.flash(0.25);
    if (feverMeter >= 3 && fever <= 0) startFever();
  } else {
    perfectRun = 0; feverMeter = Math.max(0, feverMeter - 0.5);
    ui.pop(['NICE', 'GOOD', 'COOL'][combo % 3], '#fff', 30, 24); sfx.pick(Math.min(combo, 8)); buzz(8);
  }
  updFever(); ui.score(score);
  squish(0.35);
}
function smashGate(g) {
  g.done = true; combo++; score += 12; ui.score(score);
  const wp = new THREE.Vector3();
  for (const m of [...g.group.children]) {
    m.getWorldPosition(wp); g.group.remove(m); world.add(m); m.position.copy(wp);
    shards.push({ m, v: new THREE.Vector3((m.position.x) * 0.06 + (Math.random() - 0.5) * 0.05, 0.12 + Math.random() * 0.1, -0.12 - Math.random() * 0.1), spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.18), life: 1 });
  }
  if (g.type === 'posts' && posts) { // knock the fence posts flat by scaling them down near this gate
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < posts.count; i++) { posts.getMatrixAt(i, m4); m4.decompose(p, q, sc); if (Math.abs(p.z - g.z) < 0.5) { sc.y = 0.001; m4.compose(p, q, sc); posts.setMatrixAt(i, m4); burst(scene, new THREE.Vector3(p.x, 1.4, p.z), '#2c2f63', 3, { speed: 0.1, up: 0.12, size: 0.6 }); } }
    posts.instanceMatrix.needsUpdate = true;
  }
  burst(scene, new THREE.Vector3(0, 1.6, g.z), ['#2c2f63', '#4a4f9a', '#ffffff'], 18, { speed: 0.2, up: 0.14 });
  sfx.smash(); buzz(25); camShake = 0.35; ui.pop(['SMASH!', 'BOOM!', 'WOW!'][combo % 3], '#ffd23f', 44, 24);
}
function startFever() {
  fever = 300; feverMeter = 0; ui.pop('FEVER!', '#ffd23f', 54, 30); sfx.win(); buzz([20, 30, 20]); ui.flash(0.5);
}
function crash(g) {
  hearts--; updHearts(); combo = 0; perfectRun = 0; feverMeter = 0; updFever();
  g.shake = 1; crashT = 40; speed = -0.16; camShake = 0.6;
  sfx.smash(); buzz([40, 30, 60]); ui.flash(0.45);
  burst(scene, new THREE.Vector3(0, Math.min(hD, g.hh) * 0.6, z - 0.5), jellyMat.color.getStyle(), 22, { speed: 0.13, up: 0.1, shape: 'sphere', size: 0.8 });
  squish(-0.9);
  if (hearts <= 0) {
    state = 'lost'; F.level(false, clamp((2 - z) / (2 - finishZ), 0, 1));
    ui.lose('SPLAT!', `${Math.round(clamp((2 - z) / (2 - finishZ), 0, 1) * 100)}% completed`);
  } else ui.pop('OUCH!', '#ff4f7b', 42, 24);
}
let squishK = 0;
function squish(k) { squishK = k; hV += k * 0.06; }
function collect(c) {
  c.got = true; cakesGot++; score += 2; ui.score(score);
  burst(scene, c.g.position.clone().setY(0.5), ['#ff8fb1', '#ffd38a', '#ff2d55', '#ffffff'], 12, { speed: 0.09, up: 0.08, size: 0.5, shape: 'sphere' });
  sfx.coin(); c.g.visible = false;
}
function finish() {
  finishing = true; slideV = 0.16 + (perfects / Math.max(1, gatesTotal)) * 0.2 + (fever > 0 ? 0.08 : 0); fever = 0; updFever();
  ui.pop('FINISH!', '#fff', 46, 24); sfx.win(); buzz(20);
  confetti(scene, new THREE.Vector3(0, 3.5, finishZ), 50);
}
function settle() {
  multiplier = clamp(Math.floor((finishZ - 1.2 - z) / 2.2) + 1, 1, 10);
  state = 'won'; F.level(true); const total = score * multiplier; score = total; best = Math.max(best, total); ST.set('best', best);
  ui.score(score); ui.pop('x' + multiplier + '!', '#fff', 64, 30);
  [60, 64, 67, 72, 76].forEach((m, i) => setTimeout(() => note(m + Math.min(multiplier, 8), 0.3, 0.15), i * 80));
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3(0, 2.5, z - 1), 40), i * 160);
  buzz([20, 40, 20]); ui.flash(0.6); squish(0.8);
  ui.win(level, `${cakesGot} cakes · ${perfects} perfect · x${multiplier}`);
}

// ---------------------------------------------------------------- per-frame
const camPos = new THREE.Vector3(-4.5, 6, 10), camLook = new THREE.Vector3(0, 1, -4);
function placeJelly(t) {
  const lean = clamp(speed * 1.6, -0.25, 0.25);
  jelly.position.set(0, bounce, z);
  const jig = Math.sin(t * 22) * 0.03 * Math.min(1, Math.abs(hV) * 30 + Math.abs(speed) * 2);
  const w = wD * (1 + jig), h = hD * (1 - jig), d = DEPTH * (1 + jig * 0.5) * (1 + Math.max(0, -squishK) * 0.2);
  jelly.body.scale.set(w, h, d); jelly.body.position.y = h / 2;
  jelly.body.rotation.x = -lean * 0.4; jelly.shine.scale.set(w * 0.28, h * 0.12, d * 0.2); jelly.shine.position.set(-w * 0.18, h * 0.86, d * 0.1);
  face.position.set(-w / 2 - 0.01, h * 0.62 + 0.04, 0.0); const es = clamp(Math.min(w, h) / 1.2, 0.6, 1.25); face.scale.setScalar(es);
  const blink = (Math.sin(t * 1.3) > 0.985) ? 0.15 : 1; eyes.forEach(e => e.scale.y = blink);
}
let tPrev = 0;
loop((dt, t) => {
  // spring the visible shape toward the target (overshoot = jiggle)
  sDisp = s; const hT = hOf(s), wT = A / hT;
  hV += (hT - hD) * 0.16 * dt; hV *= Math.pow(0.78, dt); hD += hV * dt;
  wV += (wT - wD) * 0.16 * dt; wV *= Math.pow(0.78, dt); wD += wV * dt;
  hD = Math.max(0.3, hD); wD = Math.max(0.3, wD);
  squishK *= Math.pow(0.9, dt);
  if (state === 'play' && Math.abs(hT - (t ? hD : hT)) > 0.15 && t - lastShapeTone > 0.07) { lastShapeTone = t; tone(180 + s * 380, 0.06, 'sine', 0.05, 1.25); }

  if (state === 'play') {
    if (!finishing) {
      if (crashT > 0) { crashT -= dt; speed += (0 - speed) * 0.08 * dt; if (crashT <= 0) speed = 0.02; }
      else { const target = (baseSpeed * (fever > 0 ? 1.7 : 1) + Math.min(level, 10) * 0.004) * fk; speed += (target - speed) * 0.05 * dt; }
      const prevZ = z; z -= speed * dt;
      // gates
      for (const g of gates) {
        if (g.done) continue;
        const front = z - DEPTH / 2, wallBack = g.z + WALL_T / 2;
        if (front <= wallBack && prevZ - DEPTH / 2 > wallBack - 0.6) {
          if (fever > 0) { smashGate(g); continue; }
          const fits = hD <= g.hh * 1.03 && wD <= g.hw * 1.03;
          if (fits) passGate(g);
          else { z = wallBack + DEPTH / 2 + 0.02; crash(g); break; }
        }
      }
      for (const c of cakes) if (!c.got && z < c.z + 0.3) collect(c);
      if (fever > 0) { fever -= dt; updFever(); if (fever <= 0) { fever = 0; ui.pop('', '#fff'); } }
      if (z <= finishZ) finish();
      ui.progress((2 - z) / (2 - finishZ));
    } else {
      slideV = Math.max(0, slideV - 0.0016 * dt); z -= slideV * dt; speed = slideV;
      if (z < finishZ - 1.2 - 21.5) { z = finishZ - 1.2 - 21.5; slideV = 0; }
      if (slideV <= 0) settle();
    }
  } else if (state === 'ready') { s = 0.35 + Math.sin(t * 2.2) * 0.25; }
  else if (state === 'won') { bounce = Math.abs(Math.sin(t * 6)) * 0.35; }

  // fever: rainbow jelly + trail droplets
  if (fever > 0 || (state === 'play' && speed > 0.05 && Math.random() < 0.25)) {
    const m = new THREE.Mesh(DROP_G, new THREE.MeshBasicMaterial({ color: fever > 0 ? new THREE.Color().setHSL((t * 1.5) % 1, 0.9, 0.6) : jellyMat.color, transparent: true, opacity: 0.8 }));
    m.position.set((Math.random() - 0.5) * wD * 0.8, 0.08 + Math.random() * (fever > 0 ? hD : 0.15), z + DEPTH / 2); m.scale.setScalar(0.5 + Math.random() * 0.7);
    world.add(m); drops.push({ m, life: 1 });
  }
  for (const d of drops) { d.life -= 0.035 * dt; d.m.material.opacity = d.life * 0.8; d.m.scale.multiplyScalar(Math.pow(0.97, dt)); }
  drops = drops.filter(d => d.life > 0 || (world.remove(d.m), d.m.material.dispose(), false));
  if (fever > 0) jellyMat.emissive.setHSL((t * 1.5) % 1, 0.9, 0.35); else jellyMat.emissive.copy(jellyMat.color).multiplyScalar(0.18);
  for (const sh of shards) { sh.v.y -= 0.007 * dt; sh.m.position.addScaledVector(sh.v, dt); sh.m.rotation.x += sh.spin.x * dt; sh.m.rotation.y += sh.spin.y * dt; sh.life -= 0.012 * dt; if (sh.life <= 0) sh.m.visible = false; }
  for (const g of gates) if (g.shake > 0) { g.shake -= 0.04 * dt; g.group.position.x = Math.sin(t * 60) * g.shake * 0.08; }
  for (const c of cakes) if (!c.got) { c.g.rotation.y = t * 1.8; c.g.position.y = 0.08 + Math.sin(t * 3 + c.z) * 0.08; }

  placeJelly(t);
  // camera: behind and to the left, looking down the runway (diagonal composition)
  camShake *= Math.pow(0.88, dt);
  const fin = finishing || state === 'won';
  camPos.lerp(new THREE.Vector3(fin ? -3.2 : -3.9, fin ? 5.4 : 7.6, z + (fin ? 7.2 : 8.6)), 0.08 * dt);
  camLook.lerp(new THREE.Vector3(fin ? 0 : 0.9, 0.6, z - (fin ? 3 : 7)), 0.1 * dt);
  camera.position.copy(camPos).add(new THREE.Vector3((Math.random() - 0.5) * camShake, (Math.random() - 0.5) * camShake, 0));
  camera.lookAt(camLook);
  followLight(new THREE.Vector3(0, 0, z - 3));
  $('gaugeK').style.top = (1 - s) * 140 - 2 + 'px';
});

buildLevel();
ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || finishing) return;
    const g = gates.find(g => !g.done && g.z < z + 0.5);
    if (!g || g.z < z - 14) return;
    const want = g.type === 'hole' ? sOf(g.ht) : g.type === 'bar' ? sOf(g.hh * 0.86) : sOf(A / (g.hw * 0.86));
    s = clamp(s + clamp(want - s, -0.22, 0.22), 0, 1);
  },
};

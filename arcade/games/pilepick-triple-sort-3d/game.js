// Pilepick — tap toys in a 3D pile to move them onto a 7-slot shelf; three alike clear. Empty the pile before time runs out.
// Shelf full with no triple = lose. Levels are seeded; every toy kind comes in multiples of three.
import { THREE, createStage, createUI, store, loop, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, glossy, mat, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Pilepick: Triple Sort 3D';
const S = store('pilepick');
const F = flow('pilepick');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 42, shadowSize: 7 });
const { scene, camera, sun, renderer } = stage;
stage.autoRender = false; sun.shadow.mapSize.set(1024, 1024);
const ui = createUI({ title: 'PILEPICK', hint: 'Tap toys · match three on the shelf', hand: '👆' });
const D = daily('pilepick', ui, { name: NAME });
const B = board({ game: 'pilepick', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });
const shelfEl = document.getElementById('shelf'), slotEls = [...shelfEl.children];
const BGS = [['#bfe6ff', '#fff3e0'], ['#ffd3e2', '#fff6dc'], ['#d6f7e3', '#f4fff1'], ['#e2d8ff', '#ffeefa'], ['#ffe2bd', '#fffbe8'], ['#c4f0ff', '#f0fbff']];

// ---------------------------------------------------------------- toy kinds (shared geometry + material per kind)
function extr(shape, d = 0.3) { const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 }); g.center(); return g; }
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.22 : 0.48, a = Math.PI / 2 + i * Math.PI / 5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; })();
const heartShape = (() => { const s = new THREE.Shape(); s.moveTo(0, -0.42); s.bezierCurveTo(-0.15, -0.28, -0.5, -0.08, -0.46, 0.16); s.bezierCurveTo(-0.42, 0.42, -0.08, 0.44, 0, 0.2); s.bezierCurveTo(0.08, 0.44, 0.42, 0.42, 0.46, 0.16); s.bezierCurveTo(0.5, -0.08, 0.15, -0.28, 0, -0.42); return s; })();
const KINDS = [
  { n: 'ball', r: 0.42, parts: [[new THREE.SphereGeometry(0.4, 24, 16), '#ff4d5e']] },
  { n: 'donut', r: 0.44, parts: [[new THREE.TorusGeometry(0.3, 0.15, 14, 28), '#ff8fc8'], [new THREE.TorusGeometry(0.3, 0.07, 8, 28), '#fff1f7', [0, 0, 0.09]]] },
  { n: 'die', r: 0.44, parts: [[(() => { const g = rounded(0.62, 0.62, 0.62, 0.14); g.center(); return g; })(), '#3d8bff']] },
  { n: 'star', r: 0.46, parts: [[extr(starShape, 0.2), '#ffcc2e']] },
  { n: 'heart', r: 0.44, parts: [[extr(heartShape, 0.22), '#e93fb0']] },
  { n: 'can', r: 0.42, parts: [[new THREE.CylinderGeometry(0.26, 0.26, 0.66, 22), '#2fc47a'], [new THREE.CylinderGeometry(0.27, 0.27, 0.12, 22), '#e9fff3', [0, 0.18, 0]]] },
  { n: 'cone', r: 0.44, parts: [[new THREE.ConeGeometry(0.32, 0.72, 20), '#ff8a2b'], [new THREE.CylinderGeometry(0.25, 0.25, 0.1, 20), '#ffffff', [0, -0.05, 0]]] },
  { n: 'mushroom', r: 0.44, parts: [[new THREE.SphereGeometry(0.38, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#e8344a', [0, 0.02, 0]], [new THREE.CylinderGeometry(0.14, 0.17, 0.36, 14), '#fff4df', [0, -0.16, 0]]] },
  { n: 'gem', r: 0.42, parts: [[new THREE.OctahedronGeometry(0.42, 0), '#28d3e0']] },
  { n: 'pill', r: 0.44, parts: [[new THREE.CapsuleGeometry(0.2, 0.42, 6, 16), '#a259ff']] },
  { n: 'apple', r: 0.42, parts: [[new THREE.SphereGeometry(0.36, 22, 16), '#7bd23c'], [new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), '#7a4a22', [0, 0.38, 0]], [new THREE.SphereGeometry(0.1, 10, 6), '#3fa02a', [0.1, 0.4, 0], [1.4, 0.4, 0.8]]] },
  { n: 'cupcake', r: 0.44, parts: [[new THREE.CylinderGeometry(0.3, 0.22, 0.32, 16), '#ffd29a', [0, -0.14, 0]], [new THREE.SphereGeometry(0.33, 18, 12), '#8f5cf0', [0, 0.08, 0], [1, 0.75, 1]], [new THREE.SphereGeometry(0.08, 10, 8), '#ff3d5a', [0, 0.36, 0]]] },
];
for (const k of KINDS) k.mats = k.parts.map(p => glossy(p[1], { roughness: 0.32, emissive: p[1], emissiveIntensity: 0.08 }));
function makeToy(ki) {
  const k = KINDS[ki], g = new THREE.Group();
  k.parts.forEach((p, i) => { const m = new THREE.Mesh(p[0], k.mats[i]); if (p[2]) m.position.set(...p[2]); if (p[3]) m.scale.set(...p[3]); m.castShadow = true; m.receiveShadow = true; g.add(m); });
  g.scale.setScalar(TOY); return g;
}

// ---------------------------------------------------------------- tray
const TX = 2.15, TZ = 3.45, TOY = 1.32;
const trayG = new THREE.Group(); scene.add(trayG);
const base = new THREE.Mesh((() => { const g = rounded(TX * 2 + 1, TZ * 2 + 1, 0.5, 0.45); g.rotateX(Math.PI / 2); return g; })(), mat('#f4f1ff')); base.position.y = -0.5; base.receiveShadow = true; trayG.add(base);
const floorM = new THREE.Mesh(new THREE.PlaneGeometry(TX * 2 + 0.2, TZ * 2 + 0.2), mat('#e6e9fb')); floorM.rotation.x = -Math.PI / 2; floorM.position.y = 0.001; floorM.receiveShadow = true; trayG.add(floorM);
const rimM = glossy('#7b8cff', { roughness: 0.4 });
for (const [w, d, x, z] of [[TX * 2 + 1, 0.4, 0, -TZ - 0.3], [TX * 2 + 1, 0.4, 0, TZ + 0.3], [0.4, TZ * 2 + 1, -TX - 0.3, 0], [0.4, TZ * 2 + 1, TX + 0.3, 0]]) {
  const g = rounded(w, d, 0.5, 0.18); g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, rimM); m.position.set(x, 0.0, z); m.castShadow = true; m.receiveShadow = true; trayG.add(m);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true; scene.add(ground);

// overlay scene for the shelf (screen pixels, orthographic)
const over = new THREE.Scene(), ocam = new THREE.OrthographicCamera(0, 1, 0, -1, -500, 500); ocam.position.z = 200;
over.add(new THREE.HemisphereLight(0xffffff, 0xd8d0ff, 1.3)); { const l = new THREE.DirectionalLight(0xffffff, 1.4); l.position.set(-0.4, 1, 1.2); over.add(l); }

function frame() {
  const asp = innerWidth / innerHeight, vf = camera.fov * Math.PI / 180, tilt = 0.55;
  const sh = Math.min(96, Math.max(66, (Math.min(innerWidth * 0.94, 560) - 18) / 7 + 18)); shelfEl.style.setProperty('--sh', sh + 'px');
  const usable = (innerHeight - 130 - sh - 40) / innerHeight;                       // fraction of the screen the tray may use
  const needW = (TX * 2 + 2.8) / asp, needH = (TZ * 2 + 2.2) * Math.cos(tilt) / usable;
  const d = Math.max(needW, needH) / (2 * Math.tan(vf / 2)) * (asp > 1 ? 1.12 : 1);
  const shift = ((130 - sh - 40) / 2) / innerHeight * 2 * Math.tan(vf / 2) * d;      // centre the tray between HUD and shelf
  camera.position.set(0, d * Math.cos(tilt), d * Math.sin(tilt)); camera.lookAt(0, 0, 0);
  camera.position.y += shift * Math.sin(tilt); camera.position.z -= shift * Math.cos(tilt);
  ocam.right = innerWidth; ocam.bottom = -innerHeight; ocam.updateProjectionMatrix();
  sun.position.set(-3, 12, 5); sun.target.position.set(0, 0, 0);
}
addEventListener('resize', frame);

// ---------------------------------------------------------------- state
let items = [], shelf = [], state = 'ready', score = 0, timeLeft = 60, recorded = false, beatenShown = false, total = 0, cleared = 0, combo = 0, lastTriple = 0, lvStart = 0, warned = false;
function build() {
  for (const it of items) { scene.remove(it.g); over.remove(it.g); } for (const it of shelf) over.remove(it.g);
  items = []; shelf = []; cleared = 0; combo = 0; recorded = false; beatenShown = false; warned = false;
  const fk = F.k(), lv = D.seed ? 7 : level, r = rng(D.seed ? D.seed * 7 + level : level * 9176 + 31);
  const bg = BGS[(level - 1) % BGS.length], bs = document.body.style; bs.setProperty('--bg1', bg[0]); bs.setProperty('--bg2', bg[1]); bs.setProperty('--ui', '#6c63ff');
  const nk = clamp(Math.round((3.4 + lv * 0.6) * fk), 4, KINDS.length), sets = clamp(Math.round((1.6 + lv * 0.15) * fk), 2, 3);
  const kinds = KINDS.map((_, i) => i).sort(() => r() - 0.5).slice(0, nk);
  const list = []; for (const k of kinds) { const n = 3 * (sets + (r() < 0.3 && lv > 2 ? 1 : 0)); for (let i = 0; i < n; i++) list.push(k); }
  list.sort(() => r() - 0.5);
  list.forEach((ki, i) => {
    const g = makeToy(ki); g.rotation.set(r() * 6.3, r() * 6.3, r() * 6.3); scene.add(g);
    const p = new THREE.Vector3((r() * 2 - 1) * (TX - 0.5), 0.5 + i * 0.12 + r() * 0.5, (r() * 2 - 1) * (TZ - 0.5));
    items.push({ g, k: ki, r: KINDS[ki].r * TOY, p, v: new THREE.Vector3(), spin: new THREE.Vector3((r() - 0.5) * 0.04, (r() - 0.5) * 0.04, (r() - 0.5) * 0.04), sq: 0 });
  });
  for (let i = 0; i < 400; i++) physics(1 / 60);
  for (const it of items) it.v.set(0, 0, 0);
  total = items.length; timeLeft = Math.round(clamp((25 + total * 2.4) / fk, 30, 240));
  ui.levels(level); ui.progress(0); ui.els.sc.classList.remove('low'); showTime(); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : `${total} toys`);
  frame();
}
function showTime() { const s = Math.max(0, Math.ceil(timeLeft)); ui.score(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); }

function physics(dt) {
  const n = items.length;
  for (const it of items) {
    it.v.y -= 22 * dt; it.p.addScaledVector(it.v, dt);
    if (it.p.y < it.r * 0.82) { it.p.y = it.r * 0.82; if (it.v.y < 0) it.v.y *= -0.15; it.v.x *= 0.86; it.v.z *= 0.86; }
    const lx = TX - it.r * 0.8, lz = TZ - it.r * 0.8;
    if (Math.abs(it.p.x) > lx) { it.p.x = Math.sign(it.p.x) * lx; it.v.x *= -0.2; }
    if (Math.abs(it.p.z) > lz) { it.p.z = Math.sign(it.p.z) * lz; it.v.z *= -0.2; }
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = items[i], b = items[j], dx = a.p.x - b.p.x, dy = a.p.y - b.p.y, dz = a.p.z - b.p.z, md = (a.r + b.r) * 0.84, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= md * md || d2 < 1e-8) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, push = (md - d) * 0.5;
    a.p.x += nx * push; a.p.y += ny * push; a.p.z += nz * push; b.p.x -= nx * push; b.p.y -= ny * push; b.p.z -= nz * push;
    const rv = (a.v.x - b.v.x) * nx + (a.v.y - b.v.y) * ny + (a.v.z - b.v.z) * nz;
    if (rv < 0) { const imp = -rv * 0.55; a.v.x += nx * imp; a.v.y += ny * imp; a.v.z += nz * imp; b.v.x -= nx * imp; b.v.y -= ny * imp; b.v.z -= nz * imp; }
  }
  for (const it of items) it.v.multiplyScalar(0.985);
}

// ---------------------------------------------------------------- shelf
const slotPos = i => { const rc = slotEls[i].getBoundingClientRect(); return [rc.left + rc.width / 2, rc.top + rc.height / 2, rc.width]; };
const toScreen = p => { const v = p.clone().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
const SHELF_ROT = new THREE.Euler(0.45, -0.35, 0);
function pick(it) {
  if (state !== 'play' || shelf.filter(s => !s.dying).length >= 7) return;
  items.splice(items.indexOf(it), 1);
  // move the toy into the overlay scene at the same spot and size on screen
  const [sx, sy] = toScreen(it.p), right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const [ex] = toScreen(it.p.clone().addScaledVector(right, 1)), ppu = Math.abs(ex - sx);
  scene.remove(it.g); over.add(it.g); it.g.position.set(sx, -sy, 50); it.g.scale.setScalar(ppu * TOY);
  it.from = [sx, sy, ppu * TOY]; it.fly = 0; it.rot0 = it.g.quaternion.clone();
  let idx = shelf.length; for (let i = shelf.length - 1; i >= 0; i--) if (shelf[i].k === it.k && !shelf[i].dying) { idx = i + 1; break; }
  shelf.splice(idx, 0, it);
  tone(620 + shelf.length * 40, 0.06, 'triangle', 0.12, 1.4); buzz(8);
  for (const o of items) if (o.p.distanceTo(it.p) < 1.6) o.v.y += 0.6;   // the pile shifts a little
  const same = shelf.filter(s => s.k === it.k && !s.dying);
  if (same.length >= 3) { const tri = same.slice(0, 3); tri.forEach(s => s.dying = true); it.tri = tri; }
  else if (shelf.filter(s => !s.dying).length >= 7) setTimeout(() => lose('SHELF FULL!'), 380);
}
function tripleDone(tri) {
  const [mx, my] = slotPos(Math.min(6, shelf.indexOf(tri[1])));
  const col = KINDS[tri[0].k].parts[0][1];
  for (const s of tri) { over.remove(s.g); shelf.splice(shelf.indexOf(s), 1); }
  cleared += 3; const now = performance.now(); combo = now - lastTriple < 3000 ? combo + 1 : 1; lastTriple = now;
  const pts = 30 * combo; score += pts;
  // a burst in the 3D world just above the tray front edge, plus screen pop
  const p = new THREE.Vector3(((mx / innerWidth) * 2 - 1) * TX, 0.8, TZ + 0.6);
  burst(scene, p, [col, '#ffffff', '#ffe66d'], 16, { speed: 0.12, up: 0.12, size: 0.5 });
  [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s + Math.min(combo, 5) * 2, 0.22, 0.13), i * 55));
  buzz([12, 20, 12]); ui.flash(0.15);
  ui.pop(combo > 1 ? `TRIPLE ×${combo} +${pts}` : `TRIPLE! +${pts}`, col, 30 + Math.min(combo, 5) * 3, (my / innerHeight) * 100 - 12);
  ui.progress(cleared / total); ui.sub(`${total - cleared} toys left`);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 2, 0), 50); }
  if (cleared >= total) win();
}
function win() {
  if (state !== 'play') return;
  state = 'won'; const bonus = Math.ceil(timeLeft); score += bonus;
  if (!recorded) { recorded = true; F.level(true); B.submit(1, { ms: performance.now() - lvStart }); }
  best = Math.max(best, score); S.set('best', best);
  sfx.win(); confetti(scene, new THREE.Vector3(0, 2, 0), 90); buzz([20, 30, 40]);
  D.won(level, 'cleared level'); ui.win(level, `+${bonus} time bonus · ${score} pts`);
  level++; S.set('level', level);
}
function lose(why) {
  if (state !== 'play') return;
  if (why === 'SHELF FULL!' && shelf.filter(s => !s.dying).length < 7) return;
  state = 'lost';
  if (!recorded) { recorded = true; F.level(false, cleared / total); }
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.35); shelfEl.classList.remove('warn'); void shelfEl.offsetWidth; shelfEl.classList.add('warn');
  ui.lose(why, `${cleared} / ${total} toys cleared`);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster();
function hitAt(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const h = ray.intersectObjects(items.map(i => i.g), true)[0]; if (!h) return null;
  let o = h.object; while (o.parent && o.parent !== scene) o = o.parent; return items.find(i => i.g === o) || null;
}
addEventListener('pointerdown', e => { if (state !== 'play') return; const it = hitAt(e.clientX, e.clientY); if (it) pick(it); });
ui.onTap(w => { if (w === 'win' || w === 'lose') build(); state = 'play'; lvStart = performance.now(); B.start(); });

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  const s = dt / 60;
  if (state === 'play') {
    timeLeft -= s; showTime();
    if (timeLeft <= 10 && !warned) { warned = true; ui.els.sc.classList.add('low'); ui.pop('HURRY!', '#ff4d6d', 34, 22); }
    if (timeLeft <= 0) { timeLeft = 0; showTime(); lose("TIME'S UP!"); }
  }
  physics(Math.min(s, 1 / 40));
  for (const it of items) { it.g.position.copy(it.p); it.g.rotation.x += it.spin.x * it.v.length(); it.g.rotation.z += it.spin.z * it.v.length(); }
  // shelf toys: fly in, then sit in their slot
  const used = [];
  shelf.forEach((it, i) => {
    const [tx, ty, w] = slotPos(Math.min(6, i)), sc = w * 0.33 / KINDS[it.k].r;
    if (it.fly < 1) {
      it.fly = Math.min(1, it.fly + s / 0.34); const e = 1 - Math.pow(1 - it.fly, 3);
      const x = lerp(it.from[0], tx, e), y = lerp(it.from[1], ty, e) - Math.sin(it.fly * Math.PI) * 90;
      it.g.position.set(x, -y, 50); it.g.scale.setScalar(lerp(it.from[2], sc, e) * (1 + Math.sin(it.fly * Math.PI) * 0.25));
      it.g.quaternion.slerpQuaternions(it.rot0, new THREE.Quaternion().setFromEuler(SHELF_ROT), e);
      if (it.fly >= 1) { it.sq = 1; tone(420, 0.05, 'sine', 0.1, 0.8); }
    } else {
      it.g.position.x = lerp(it.g.position.x, tx, Math.min(1, 0.3 * dt)); it.g.position.y = lerp(it.g.position.y, -ty, Math.min(1, 0.3 * dt));
      it.sq = Math.max(0, it.sq - 0.07 * dt); const q = Math.sin(it.sq * Math.PI) * 0.18;
      it.g.scale.set(sc * (1 + q), sc * (1 - q), sc * (1 + q));
      it.g.rotation.y = SHELF_ROT.y + Math.sin(t * 2 + i) * 0.12;
      if (it.tri && it.tri.every(o => o.fly >= 1) && !it.merge) it.merge = 0.0001;
    }
  });
  // triples: squeeze to the middle one, then pop
  for (const it of shelf.slice()) if (it.merge) {
    it.merge += s / 0.28; const mid = it.tri[1];
    for (const o of it.tri) { o.g.position.x = lerp(o.g.position.x, mid.g.position.x, 0.25 * dt); o.g.scale.multiplyScalar(1 + 0.015 * dt); }
    if (it.merge >= 1) { const tri = it.tri; it.merge = 0; it.tri = null; tripleDone(tri); }
  }
  stage.followLight(new THREE.Vector3(0, 0, 0)); sun.position.set(-3, 12, 5);
  renderer.autoClear = true; renderer.render(scene, camera);
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(over, ocam);
});

build(); ui.start();

// ---------------------------------------------------------------- test hook
const visible = it => { const h = hitAt(...toScreen(it.p)); return h === it; };
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// three matching toys hop from the pile onto the shelf one by one and pop as a triple (the clock gets the time back)
let demoK = null;
demo(() => {
  const vis = items.filter(visible), by = {}; for (const i of vis) by[i.k] = (by[i.k] || 0) + 1;
  if (demoK === null) { const k = Object.keys(by).find(k => by[k] >= 3); if (k === undefined) return false; demoK = +k; }
  const it = vis.find(i => i.k === demoK); if (!it) return false; pick(it); timeLeft += 1.3;
}, { ready: () => state === 'play' && level === 1 && !D.seed && cleared + 6 < total && shelf.filter(s => !s.dying).length < 4, wait: 2000, every: 1100, max: 3 });

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || shelf.filter(s => !s.dying).length >= 7) return;
    const vis = items.filter(visible); if (!vis.length) { if (items.length) pick(items.reduce((a, b) => a.p.y > b.p.y ? a : b)); return; }
    const cnt = k => shelf.filter(s => s.k === k && !s.dying).length;
    for (const need of [2, 1]) { const c = vis.find(i => cnt(i.k) === need); if (c) return pick(c); }
    const free = 7 - shelf.filter(s => !s.dying).length; if (free < 3) { const c = vis.find(i => cnt(i.k) > 0); if (c) return pick(c); }
    const by = {}; for (const i of vis) by[i.k] = (by[i.k] || 0) + 1;
    const k = +Object.keys(by).sort((a, b) => by[b] - by[a])[0]; pick(vis.find(i => i.k === k));
  },
};

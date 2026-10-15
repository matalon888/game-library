// Capy Hop — original endless road hopper. A very calm voxel capybara hops across a pastel seaside town:
// streets, log rivers, lily ponds and train tracks. Tap = hop forward, swipe = side / back. The camera creeps forward.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, sfx, burst, confetti, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';

const NAME = 'Capy Hop: Endless Road Hopper';
const S = store('capyhop');
let best = S.get('best', 0);
const F = flow('capyhop', { par: 40, warmup: 10 });

const stage = createStage({ fov: 34, shadows: true, shadowSize: 13 });
const { scene, camera, renderer } = stage;
stage.hemi.intensity = 1.25; stage.sun.intensity = 1.55;
stage.sun.shadow.camera.far = 60;
const ui = createUI({ title: 'CAPY<br>HOP', hint: 'Tap to hop · swipe to dodge', hand: '👆', progress: false });
const D = daily('capyhop', ui, { name: NAME });
document.body.style.setProperty('--bg1', '#9fdcff'); document.body.style.setProperty('--bg2', '#d8f4ff'); document.body.style.setProperty('--ui', '#ff8a3d');
// win card doubles as the "new best" card for this endless game
ui.els.win.querySelector('h1').textContent = 'NEW BEST!';
ui.els.win.querySelector('p').innerHTML = 'SCORE <span data-l></span>'; ui.els.win.classList.add('dim');

const COLS = 4, WRAP = 30, HOP_T = 0.13;           // playable columns -4..4
const VMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });
const _m4 = new THREE.Matrix4(), _c = new THREE.Color();

// ---------------------------------------------------------------- voxel model builder: many coloured boxes → one geometry
function model(parts) {   // parts: [w,h,d, x,y,z, color]  (y = bottom of box)
  const pos = [], nor = [], col = [];
  for (const [w, h, d, x, y, z, color] of parts) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y + h / 2, z);
    _c.set(color); const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const shade = n.getY(i) > 0.5 ? 1 : n.getY(i) < -0.5 ? 0.6 : 0.86;   // crisp voxel faces
      col.push(_c.r * shade, _c.g * shade, _c.b * shade);
    }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere(); return g;
}
const mesh = (g, shadow = true) => { const m = new THREE.Mesh(g, VMAT); m.castShadow = shadow; m.receiveShadow = true; return m; };

// ---------------------------------------------------------------- the hero: a chill capybara (faces -z)
const FUR = '#c27f45', FUR2 = '#9a5f33', SNOUT = '#5e3a22', TAN = '#e2ae78';
const capyGeo = model([
  [0.66, 0.5, 0.8, 0, 0.12, 0.08, FUR],                // body
  [0.6, 0.1, 0.7, 0, 0.06, 0.08, TAN],                 // light belly
  [0.6, 0.05, 0.7, 0, 0.6, 0.1, '#d9975a'],          // sunlit fluffy back
  [0.54, 0.46, 0.46, 0, 0.3, -0.42, FUR],              // head
  [0.04, 0.22, 0.3, -0.29, 0.3, -0.5, TAN], [0.04, 0.22, 0.3, 0.29, 0.3, -0.5, TAN],                   // light cheeks
  [0.48, 0.36, 0.28, 0, 0.24, -0.76, TAN],             // big blunt muzzle
  [0.34, 0.06, 0.14, 0, 0.6, -0.82, SNOUT],            // nose pad on top of the muzzle (shows from behind/above)
  [0.3, 0.12, 0.04, 0, 0.46, -0.915, SNOUT],           // nose front
  [0.16, 0.04, 0.03, 0, 0.32, -0.915, '#4a2c18'],      // mouth line
  [0.05, 0.1, 0.16, -0.29, 0.54, -0.52, '#1d120a'], [0.05, 0.1, 0.16, 0.29, 0.54, -0.52, '#1d120a'],   // dark eyes on the head sides
  [0.06, 0.04, 0.18, -0.29, 0.64, -0.52, FUR2], [0.06, 0.04, 0.18, 0.29, 0.64, -0.52, FUR2],          // sleepy lids
  [0.14, 0.18, 0.1, -0.2, 0.76, -0.28, SNOUT], [0.14, 0.18, 0.1, 0.2, 0.76, -0.28, SNOUT],            // dark ears poking up
  [0.08, 0.1, 0.02, -0.2, 0.8, -0.335, '#e9a08a'], [0.08, 0.1, 0.02, 0.2, 0.8, -0.335, '#e9a08a'],    // inner ears
  [0.16, 0.14, 0.16, -0.2, 0, -0.22, FUR2], [0.16, 0.14, 0.16, 0.2, 0, -0.22, FUR2],                  // legs
  [0.16, 0.14, 0.16, -0.2, 0, 0.36, FUR2], [0.16, 0.14, 0.16, 0.2, 0, 0.36, FUR2],
  [0.12, 0.08, 0.06, 0, 0.36, 0.5, FUR2],                                                             // stubby tail
]);
const hero = new THREE.Group(), heroBody = mesh(capyGeo); hero.add(heroBody); heroBody.scale.setScalar(1.2); scene.add(hero);
const orangeGeo = model([[0.26, 0.24, 0.26, 0, 0, 0, '#ff9a1f'], [0.06, 0.06, 0.06, 0, 0.24, 0, '#5a3a1a'], [0.12, 0.03, 0.07, 0.07, 0.25, 0, '#4fbf4a']]);
const stack = []; for (let i = 0; i < 6; i++) { const o = mesh(orangeGeo); o.position.set(0, 0.76 + i * 0.25, -0.42); o.rotation.y = i * 0.5; o.visible = false; heroBody.add(o); stack.push(o); }
const blobShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.95).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
scene.add(blobShadow);

// ---------------------------------------------------------------- props
const CAR_COL = ['#ff5d73', '#ffc93c', '#4fb3ff', '#7ee08a', '#b48cff', '#ff8f4f', '#f4f4f4'];
const carGeos = CAR_COL.map(c => model([
  [1.5, 0.42, 0.82, 0, 0.14, 0, c], [0.9, 0.36, 0.74, 0.12, 0.56, 0, '#ffffff'], [0.92, 0.26, 0.76, 0.12, 0.6, 0, '#3e4a63'],
  [0.94, 0.08, 0.78, 0.12, 0.88, 0, c],
  [0.3, 0.22, 0.86, -0.45, 0, 0, '#2b2b33'], [0.3, 0.22, 0.86, 0.45, 0, 0, '#2b2b33'],
  [0.06, 0.12, 0.18, 0.76, 0.32, -0.26, '#fff6c2'], [0.06, 0.12, 0.18, 0.76, 0.32, 0.26, '#fff6c2'],
  [0.06, 0.1, 0.16, -0.76, 0.32, -0.26, '#ff3b3b'], [0.06, 0.1, 0.16, -0.76, 0.32, 0.26, '#ff3b3b'],
]));
const truckGeos = ['#3fa7ff', '#ff7a59', '#2ec4a6', '#ffd23f'].map(c => model([
  [0.7, 0.8, 0.86, 0.95, 0.16, 0, c], [0.18, 0.34, 0.8, 1.22, 0.56, 0, '#3e4a63'],
  [1.9, 1.0, 0.9, -0.35, 0.18, 0, '#f6f1e7'], [1.9, 0.12, 0.92, -0.35, 0.66, 0, c],
  [0.32, 0.24, 0.94, 0.95, 0, 0, '#2b2b33'], [0.32, 0.24, 0.94, -0.9, 0, 0, '#2b2b33'], [0.32, 0.24, 0.94, -0.15, 0, 0, '#2b2b33'],
  [0.06, 0.12, 0.2, 1.31, 0.3, -0.28, '#fff6c2'], [0.06, 0.12, 0.2, 1.31, 0.3, 0.28, '#fff6c2'],
]));
const TRAIN_LEN = 15;
const trainGeo = (() => {
  const p = [[2.8, 1.3, 0.96, 6.1, 0.2, 0, '#e8455a'], [1.0, 0.5, 0.98, 6.6, 1.5, 0, '#ffffff'], [0.08, 0.2, 0.6, 7.52, 0.5, 0, '#fff6c2'], [0.6, 0.3, 0.6, 5.3, 1.5, 0, '#2b2b33']];
  for (let k = 0; k < 3; k++) { const x = 3.1 - k * 4.1; p.push([3.9, 1.25, 0.96, x, 0.2, 0, k % 2 ? '#ffd23f' : '#4fb3ff'], [3.9, 0.14, 1.0, x, 1.45, 0, '#f4f4f4'], [3.3, 0.36, 1.0, x, 0.85, 0, '#3e4a63']); }
  for (let x = -6.5; x <= 7; x += 1.3) p.push([0.4, 0.22, 1.0, x, 0, 0, '#2b2b33']);
  return model(p);
})();
const treeGeos = [0, 1, 2].map(k => model([
  [0.26, 0.34, 0.26, 0, 0, 0, '#8a5a35'], [0.72, 0.42 + k * 0.22, 0.72, 0, 0.34, 0, ['#4fbf6a', '#3fae5c', '#69cf6e'][k]],
  [0.46, 0.26, 0.46, 0, 0.76 + k * 0.22, 0, ['#69d47c', '#55c46b', '#86e086'][k]],
]));
const rockGeo = model([[0.7, 0.4, 0.66, 0, 0, 0, '#c9cbd6'], [0.42, 0.18, 0.4, 0.06, 0.4, -0.04, '#dfe1ea']]);
const flowerGeo = model([[0.08, 0.14, 0.08, 0, 0, 0, '#4fbf4a'], [0.16, 0.1, 0.16, 0, 0.14, 0, '#ff8fb4']]);
const logGeos = [2, 3, 4].map(L => model([[L, 0.36, 0.72, 0, -0.1, 0, '#a7683c'], [L - 0.1, 0.08, 0.6, 0, 0.26, 0, '#bd8150'], [0.08, 0.3, 0.6, L / 2, -0.07, 0, '#e6b88a'], [0.08, 0.3, 0.6, -L / 2, -0.07, 0, '#e6b88a']]));
const padGeo = model([[0.82, 0.06, 0.82, 0, -0.04, 0, '#56c75a'], [0.3, 0.07, 0.3, 0.2, -0.03, -0.2, '#7bdc72'], [0.12, 0.1, 0.12, -0.16, 0.02, 0.14, '#ffffff']]);
const lightGeo = model([[0.12, 1.3, 0.12, 0, 0, 0, '#5a5f73'], [0.5, 0.16, 0.16, 0, 1.2, 0, '#2b2b33']]);
const bulbMat = new THREE.MeshBasicMaterial({ color: '#552222' });
const bulbOn = new THREE.MeshBasicMaterial({ color: '#ff3030' });
const bulbGeo = new THREE.BoxGeometry(0.14, 0.14, 0.06);

// ground strips: one merged geometry per row type variant, shared
const STRIP_W = 40;
const strip = {
  grassA: model([[STRIP_W, 0.5, 1, 0, -0.5, 0, '#9be26b'], [STRIP_W, 0.5, 1, 0, -1, 0, '#c9965e']]),
  grassB: model([[STRIP_W, 0.5, 1, 0, -0.5, 0, '#8fd862'], [STRIP_W, 0.5, 1, 0, -1, 0, '#c9965e']]),
  road: model([[STRIP_W, 0.42, 1, 0, -0.56, 0, '#565b70'], [STRIP_W, 0.5, 1, 0, -1.06, 0, '#4a4e60']]),
  rail: model([[STRIP_W, 0.46, 1, 0, -0.52, 0, '#b9ab9b'], ...Array.from({ length: 40 }, (_, i) => [0.22, 0.08, 0.9, -19.5 + i, -0.08, 0, '#7a5638']),
               [STRIP_W, 0.08, 0.08, 0, 0, -0.28, '#9aa3b5'], [STRIP_W, 0.08, 0.08, 0, 0, 0.28, '#9aa3b5']]),
  water: model([[STRIP_W, 0.3, 1, 0, -0.7, 0, '#55c3f0'], [STRIP_W, 0.5, 1, 0, -1.2, 0, '#3aa6d6']]),
  dash: model(Array.from({ length: 14 }, (_, i) => [0.9, 0.02, 0.09, -19 + i * 3, -0.14, -0.5, '#f4f4f4'])),
  bank: model([[STRIP_W, 0.06, 0.12, 0, -0.42, 0.44, '#e8f8ff']]),
  edge: model([[STRIP_W, 0.08, 0.08, 0, -0.05, 0.46, '#7fcd55']]),
};

// ---------------------------------------------------------------- world rows
let R = rng(1), rows = new Map(), genRow = 0, lastType = 'grass', runLeft = 0, clock = 0;
const wrapX = (x) => ((x + WRAP / 2) % WRAP + WRAP) % WRAP - WRAP / 2;
function makeRow(i) {
  const fk = F.k(i), row = { i, type: 'grass', obs: [], blocked: new Set(), group: new THREE.Group(), orange: null, v: 0 };
  // choose type in runs
  if (i < 4) row.type = 'grass';
  else {
    if (runLeft <= 0) {
      const d = Math.min(1, i / 120), r = R();
      let t = lastType === 'grass' ? (r < 0.5 ? 'road' : r < 0.78 ? 'river' : 'rail') : 'grass';
      if (lastType !== 'grass' && R() < 0.15 + d * 0.3) t = r < 0.5 ? 'road' : r < 0.8 ? 'river' : 'rail';
      if (t === lastType) t = 'grass';
      lastType = t;
      runLeft = t === 'grass' ? 1 + Math.floor(R() * 2.4) : t === 'road' ? 2 + Math.floor(R() * (2 + d * 2)) : t === 'river' ? 2 + Math.floor(R() * (1.6 + d)) : 1 + (R() < 0.3 ? 1 : 0);
    }
    row.type = lastType; runLeft--;
  }
  const prev = rows.get(i - 1);
  row.group.position.z = -i;
  const g = row.group;
  if (row.type === 'grass') {
    g.add(mesh(i % 2 ? strip.grassA : strip.grassB, false));
    if (prev && prev.type !== 'grass') g.add(mesh(strip.edge, false));
    // framing trees outside the playable lane, obstacles inside
    for (let x = -12; x <= 12; x++) {
      const inside = Math.abs(x) <= COLS;
      if (!inside && R() < 0.6) { const t = mesh(treeGeos[Math.floor(R() * 3)]); t.position.x = x; g.add(t); continue; }
      if (inside && i < -1 && R() < 0.3) { const t = mesh(treeGeos[Math.floor(R() * 3)]); t.position.x = x; row.blocked.add(x); g.add(t); continue; }
      if (inside && i > 2 && R() < 0.2 && row.blocked.size < 3 && !(prev && prev.type === 'grass' && !prev.blocked.has(x) && [...prev.blocked].length >= 3)) {
        row.blocked.add(x); const t = mesh(R() < 0.7 ? treeGeos[Math.floor(R() * 3)] : rockGeo); t.position.x = x; t.rotation.y = Math.floor(R() * 4) * Math.PI / 2; g.add(t);
      } else if (inside && R() < 0.08) { const f = mesh(flowerGeo, false); f.position.set(x + (R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); g.add(f); }
    }
    if (i < 3) for (const x of [-1, 0, 1]) row.blocked.delete(x);
    if (i > 3 && R() < 0.22) { const free = [...Array(9)].map((_, k) => k - 4).filter(x => !row.blocked.has(x)); const x = free[Math.floor(R() * free.length)]; const o = mesh(orangeGeo); o.position.set(x, 0.25, 0); g.add(o); row.orange = { x, m: o }; }
  } else if (row.type === 'road') {
    g.add(mesh(strip.road, false));
    if (prev && prev.type === 'road') g.add(mesh(strip.dash, false));
    const dir = R() < 0.5 ? -1 : 1, truck = R() < 0.35, speed = clamp((1.7 + R() * 1.6 + Math.min(i, 150) * 0.012) * fk, 1.2, 6.2) * dir;
    const n = clamp(Math.round((truck ? 2 : 3) + R() * 1.4 + Math.min(i, 160) / 90 * fk), 2, truck ? 5 : 6), len = truck ? 2.7 : 1.55;
    const slot = WRAP / n;
    row.v = speed;
    for (let k = 0; k < n; k++) {
      const geo = truck ? truckGeos[Math.floor(R() * truckGeos.length)] : carGeos[Math.floor(R() * carGeos.length)];
      const m = mesh(geo); m.rotation.y = dir > 0 ? 0 : Math.PI; g.add(m);
      row.obs.push({ x0: k * slot + R() * Math.max(0, slot - len - 2.2), len, m });
    }
  } else if (row.type === 'rail') {
    g.add(mesh(strip.rail, false));
    const dir = R() < 0.5 ? -1 : 1, period = clamp((5.5 + R() * 3.5) / fk, 3.6, 11), phase = R() * period;
    const train = mesh(trainGeo); train.rotation.y = dir > 0 ? 0 : Math.PI; train.visible = false; g.add(train);
    const pole = mesh(lightGeo); pole.position.set(-COLS - 0.5, 0, 0.42); g.add(pole);
    const b1 = new THREE.Mesh(bulbGeo, bulbMat), b2 = new THREE.Mesh(bulbGeo, bulbMat); b1.position.set(-COLS - 0.66, 1.28, 0.5); b2.position.set(-COLS - 0.34, 1.28, 0.5); g.add(b1, b2);
    row.train = { dir, period, phase, m: train, b1, b2, rang: -1 };
  } else {   // river: logs drift, or a still lily-pad pond row
    g.add(mesh(strip.water, false)); if (!prev || prev.type !== 'river') g.add(mesh(strip.bank, false));
    const pads = prev && prev.type !== 'river' && R() < 0.3 && i > 6;
    if (pads) {
      row.pads = true; const xs = new Set(); while (xs.size < 5) xs.add(Math.floor(R() * 9) - 4);
      for (const x of xs) { const p = mesh(padGeo, false); p.position.x = x; p.rotation.y = R() * 6; g.add(p); row.obs.push({ x0: x, len: 0.9, m: p, pad: true }); }
    } else {
      const dir = prev && prev.type === 'river' && prev.v ? -Math.sign(prev.v) : (R() < 0.5 ? -1 : 1);
      const speed = clamp((1.0 + R() * 0.9 + Math.min(i, 150) * 0.006) * fk, 0.8, 3.4) * dir; row.v = speed;
      const n = 4 + (R() < 0.5 ? 1 : 0), slot = WRAP / n;
      for (let k = 0; k < n; k++) {
        const L = 2 + Math.floor(R() * 3) - (i > 80 && R() < 0.3 ? 1 : 0), Lc = clamp(L, 2, 4);
        const m = mesh(logGeos[Lc - 2]); g.add(m); row.obs.push({ x0: k * slot + R() * Math.max(0.2, slot - Lc - 1.2), len: Lc, m, ph: R() * 6 });
      }
    }
  }
  scene.add(g); rows.set(i, row); return row;
}
function obsX(row, o, t) { return o.pad ? o.x0 : wrapX(o.x0 + row.v * t); }
function trainSpan(row, t) {      // returns [min,max] x of the train, or null; also warning flag
  const T = row.train, tau = ((t + T.phase) % T.period + T.period) % T.period, pass = 46 / 42;
  if (tau < pass) { const front = -T.dir * 21 + T.dir * 42 * tau; return { a: Math.min(front, front - T.dir * TRAIN_LEN), b: Math.max(front, front - T.dir * TRAIN_LEN), front, warn: true }; }
  return { a: 99, b: 99, front: 99, warn: tau > T.period - 1.5 };
}
function ensureRows(upTo) { while (genRow <= upTo) makeRow(genRow++); }
function dropRows(below) {
  for (const [i, r] of rows) if (i < below) { scene.remove(r.group); rows.delete(i); }
}

// ---------------------------------------------------------------- run state
const B = worldBoard({ game: 'capy-hop', label: 'Hops', limits: { maxRun: 1000, maxPerSec: 8 } });   // world board: best run today
let state = 'ready', score = 0, oranges = 0, hx = 0, hr = 0, hop = null, queued = null, faceY = Math.PI + 0.7, camRow = 0, camX = 0, started = false, runT = 0;
let deathAnim = null, recorded = false, beatenShown = false, squash = 0, lastNear = 0, prevBest = best, idleT = 0;
function reset() {
  for (const [, r] of rows) scene.remove(r.group); rows.clear(); genRow = -8; lastType = 'grass'; runLeft = 0;
  R = rng(D.seed || (Date.now() % 1000003) + 11);
  ensureRows(30);
  state = 'ready'; score = 0; oranges = 0; hx = 0; hr = 0; hop = null; queued = null; faceY = Math.PI + 0.7; camRow = 0; camX = 0; started = false; runT = 0;
  deathAnim = null; recorded = false; beatenShown = false; squash = 0; prevBest = best; idleT = 0;
  hero.position.set(0, 0, 0); hero.rotation.set(0, Math.PI + 0.7, 0); heroBody.scale.setScalar(1.2); heroBody.position.set(0, 0, 0); hero.visible = true;
  stack.forEach(o => o.visible = false);
  ui.score(0); ui.sub(best ? 'BEST ' + best : ''); ui.pill(D.isDaily ? 'DAILY · 🍊 0' : '🍊 0');
}

// ---------------------------------------------------------------- hazards
function rowAt(i) { return rows.get(i); }
/** is (row i, x) deadly at time t? (for land: car/train overlap; for river: no support) */
function hazard(i, x, t) {
  const row = rowAt(i); if (!row) return null;
  if (row.type === 'road') { for (const o of row.obs) if (Math.abs(obsX(row, o, t) - x) < o.len / 2 + 0.28) return 'car'; }
  else if (row.type === 'rail') { const s = trainSpan(row, t); if (x > s.a - 0.35 && x < s.b + 0.35) return 'train'; }
  else if (row.type === 'river') { if (!support(row, x, t)) return 'water'; }
  return null;
}
function support(row, x, t, margin = 0.05) { for (const o of row.obs) if (Math.abs(obsX(row, o, t) - x) < o.len / 2 + (o.pad ? 0.12 : margin)) return o; return null; }

function tryHop(dx, dz) {
  if (state === 'ready') return;
  if (state !== 'play') return;
  if (hop) { queued = [dx, dz]; return; }
  const ti = hr + dz, row = rowAt(ti); if (!row) return;
  let tx = hx + dx;
  if (row.type !== 'river') tx = Math.round(tx);
  else if (rowAt(hr)?.type !== 'river') tx = Math.round(tx);
  faceY = dx > 0 ? -Math.PI / 2 : dx < 0 ? Math.PI / 2 : dz > 0 ? -0.5 : Math.PI + 0.7;   // forward/back turned a little toward the camera
  if (Math.abs(tx) > COLS + 0.4 || ti < camRow - 4.2 || (row.type === 'grass' && row.blocked.has(Math.round(tx)))) {   // bump: blocked
    squash = 0.6; tone(200, 0.06, 'square', 0.05, 0.8); buzz(8); return;
  }
  hop = { fx: hx, tx, fr: hr, tr: ti, t: 0 }; hr = ti; started = true; idleT = 0;
  tone(dz > 0 ? 540 : 470, 0.06, 'triangle', 0.1, 1.5); buzz(5);
}

function die(kind) {
  if (state !== 'play') return;
  state = 'dying'; deathAnim = { kind, t: 0 };
  buzz([40, 30, 80]); ui.flash(0.5);
  const p = hero.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  if (kind === 'water') { tone(380, 0.35, 'sine', 0.15, 0.3); burst(scene, p.setY(0), ['#ffffff', '#bfeaff', '#55c3f0'], 26, { speed: 0.07, up: 0.14, size: 0.6, gravity: 0.01 }); }
  else if (kind === 'slow') { sfx.fail(); }
  else { sfx.smash(); burst(scene, p, [FUR, FUR2, '#ffffff', '#ffd23f'], 24, { speed: 0.12, up: 0.1, size: 0.7 }); }
  setTimeout(gameOver, 550);
}
const CHILL_LINES = { car: 'Still chill, though.', train: 'Should\'ve heard the bell.', water: 'Capys can swim. Just not today.', slow: 'Too slow — even for a capybara.', swept: 'Drifted off. Very relaxing.' };
function gameOver() {
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const newBest = score > prevBest && score > 0, oj = oranges ? `🍊 ${oranges} · ` : '';
  setTimeout(() => (state === 'won' || state === 'lost') && ui.els.sc.classList.add('hc-hidden'), 650);
  best = Math.max(best, score); S.set('best', best);
  if (newBest) { state = 'won'; sfx.win(); confetti(scene, hero.position.clone().add(new THREE.Vector3(0, 1, 0)), 60); D.won(score); ui.win(score, oj + (CHILL_LINES[deathAnim.kind] || '')); }
  else { state = 'lost'; ui.lose(String(score), `BEST ${best} · ${oj}${CHILL_LINES[deathAnim.kind] || ''}`); }
}

input({
  onTap: () => { if (state === 'play') tryHop(0, 1); },
  onSwipe: (d) => { if (state !== 'play') return; if (d === 'left') tryHop(-1, 0); else if (d === 'right') tryHop(1, 0); else if (d === 'down') tryHop(0, -1); else tryHop(0, 1); },
});
addEventListener('keydown', e => { const k = { ArrowUp: [0, 1], KeyW: [0, 1], Space: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowDown: [0, -1], KeyS: [0, -1] }[e.code]; if (k) tryHop(...k); });
ui.onTap(which => { B.start(); if (which !== 'start') reset(); state = 'play'; ui.els.sc.classList.remove('hc-hidden'); });

// ---------------------------------------------------------------- loop
const camOff = new THREE.Vector3(4.6, 17.5, 12.2);
loop((dt) => {
  const ds = dt / 60; clock += ds;
  // hop motion
  if (hop) {
    hop.t += ds / HOP_T; const k = Math.min(1, hop.t);
    hx = lerp(hop.fx, hop.tx, k);
    if (k >= 1) {
      hx = hop.tx; hop = null; squash = 0.7;
      const row = rowAt(hr);
      burst(scene, new THREE.Vector3(hx, 0.05, -hr), row && row.type === 'river' ? ['#ffffff', '#bfeaff'] : ['#ffffff', '#f3ead8'], 5, { speed: 0.03, up: 0.02, size: 0.45, gravity: 0.002 });
      if (hr > score) {
        score = hr; ui.score(score);
        if (score % 25 === 0) { ui.pop(`${score}!`, '#fff', 44, 30); confetti(scene, new THREE.Vector3(hx, 1.2, -hr), 30); tone(880, 0.12, 'triangle', 0.1, 1.2); }
        if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 42, 28); confetti(scene, new THREE.Vector3(hx, 1.5, -hr), 50); }
        if (score === best + 1 && best > 0 && !beatenShown) ui.pop('NEW BEST!', '#ffd23f', 34, 30);
      }
      if (row && row.orange && Math.abs(row.orange.x - hx) < 0.5) {
        row.group.remove(row.orange.m); row.orange = null; oranges++; sfx.coin(); buzz(10);
        ui.pop(oranges % 5 === 0 ? 'chill 😌' : '+1 🍊', '#ffb03a', 30, 40); ui.pill((D.isDaily ? 'DAILY · ' : '') + '🍊 ' + oranges);
        burst(scene, new THREE.Vector3(hx, 0.9, -hr), ['#ff9a1f', '#ffd23f', '#ffffff'], 10, { speed: 0.05, up: 0.06, size: 0.4, gravity: 0.004 });
      }
      if (queued && state === 'play') { const q = queued; queued = null; tryHop(...q); }
    }
  }
  // ride logs
  const cur = rowAt(hr);
  if (state === 'play' && cur && cur.type === 'river' && !hop) { const o = support(cur, hx, clock, 0.1); if (o && !o.pad) hx += cur.v * ds; }
  // hazards
  if (state === 'play') {
    const landed = !hop || hop.t > 0.55;
    const hz = landed ? hazard(hr, hx, clock) : (rowAt(hr)?.type === 'river' ? null : hazard(hr, hx, clock));
    if (hz) die(hz);
    else if (Math.abs(hx) > COLS + 1.1) die('swept');
    else if (hr < camRow - 4.6) die('slow');
    // near miss: "chill" moment when a car brushes past
    if (state === 'play' && cur && cur.type === 'road' && clock - lastNear > 2) for (const o of cur.obs) { const d = Math.abs(obsX(cur, o, clock) - hx) - o.len / 2; if (d < 0.55 && d > 0.28) { lastNear = clock; ui.pop('chill', '#fff', 26, 44); break; } }
  }
  // camera creep (starts after the first hop)
  if (state === 'play') runT += ds;
  if (state === 'play' && (started || runT > 2.5)) { camRow += ds * clamp((0.3 + score * 0.004) * F.k(score), 0.25, 0.85); idleT += ds; }
  camRow = Math.max(camRow, lerp(camRow, hr - 1, 0.06 * dt));
  ensureRows(Math.floor(camRow) + 26); dropRows(Math.floor(camRow) - 10);
  // animate rows
  for (const [i, row] of rows) {
    if (row.type === 'road' || (row.type === 'river' && !row.pads)) for (const o of row.obs) { o.m.position.x = obsX(row, o, clock); if (o.ph !== undefined) o.m.position.y = Math.sin(clock * 2.4 + o.ph) * 0.03 - (o === support(row, hx, clock) && i === hr && !hop ? 0.06 : 0); }
    if (row.type === 'rail') {
      const s = trainSpan(row, clock), T = row.train; T.m.visible = s.front < 90; if (T.m.visible) T.m.position.x = s.front - T.dir * 7.6;
      const on = s.warn && Math.floor(clock * 6) % 2 === 0; T.b1.material = on ? bulbOn : bulbMat; T.b2.material = s.warn && !on ? bulbOn : bulbMat;
      const tau = ((clock + T.phase) % T.period + T.period) % T.period;
      if (s.warn && Math.abs(i - hr) < 7 && state === 'play') { const ring = Math.floor(tau * 4); if (ring !== T.rang) { T.rang = ring; tone(1480, 0.07, 'square', 0.035, 1); } }
      if (s.front < 90 && Math.abs(s.front) < 6 && Math.abs(i - hr) < 5 && T.whoosh !== Math.floor(clock / T.period)) { T.whoosh = Math.floor(clock / T.period); tone(140, 0.4, 'sawtooth', 0.06, 0.6); buzz(15); }
    }
    if (row.orange) { row.orange.m.rotation.y = clock * 2; row.orange.m.position.y = 0.25 + Math.sin(clock * 3 + i) * 0.06; }
  }
  // hero pose
  squash = Math.max(0, squash - ds * 6);
  const k = hop ? Math.min(1, hop.t) : 1, rz = hop ? lerp(hop.fr, hop.tr, k) : hr;
  let y = hop ? Math.sin(k * Math.PI) * 0.45 : 0;
  const crow = rowAt(hr); if (!hop && crow && crow.type === 'river') { const o = support(crow, hx, clock, 0.1); if (o) y = (o.pad ? 0 : 0.18 + o.m.position.y); }
  if (state === 'play' || state === 'ready') {
    hero.position.set(hx, y, -rz);
    let ry = hero.rotation.y, d = faceY - ry; d = Math.atan2(Math.sin(d), Math.cos(d)); hero.rotation.y = ry + d * Math.min(1, 0.4 * dt);
    const st = hop ? 1 + Math.sin(k * Math.PI) * 0.18 : 1 - squash * 0.28;
    heroBody.scale.set(1.2 / Math.sqrt(st), 1.2 * st, 1.2 / Math.sqrt(st));
    if (state === 'ready') heroBody.scale.y = 1.2 + Math.sin(clock * 2) * 0.03;   // slow capy breathing
  } else if (deathAnim) {
    deathAnim.t += ds; const t = deathAnim.t;
    if (deathAnim.kind === 'car') heroBody.scale.set(1.5, Math.max(0.13, 1.1 - t * 12), 1.5);
    else if (deathAnim.kind === 'train') { hero.position.x += 0.4 * dt * (rowAt(hr)?.train?.dir || 1); hero.position.y += 0.12 * dt; hero.rotation.z += 0.3 * dt; }
    else if (deathAnim.kind === 'water') { hero.position.y = -t * 1.6; }
    else if (deathAnim.kind === 'swept') { hero.position.y = -t * 1.2; }
  }
  const nStack = Math.min(6, 1 + oranges);   // the signature orange is always on top
  stack.forEach((o, i) => { o.visible = i < nStack; o.position.x = Math.sin(clock * 3 + i) * 0.015 * i; });
  blobShadow.position.set(hero.position.x, (crow && crow.type === 'river' ? 0.2 : 0.02), hero.position.z + 0.05); blobShadow.visible = state === 'play' || state === 'ready'; blobShadow.scale.setScalar(1 - y * 0.6);
  // camera: 3/4 view, rows run up-screen
  camX = lerp(camX, clamp(hx * 0.45, -1.6, 1.6), 0.05 * dt);
  const fz = -camRow - 2.0;
  camera.position.set(camX + camOff.x, camOff.y, fz + camOff.z); camera.lookAt(camX, 0, fz);
  stage.followLight(new THREE.Vector3(camX, 0, fz));
});

reset(); ui.start(); ui.els.sc.classList.add('hc-hidden');

// ---------------------------------------------------------------- test hook + bot
function safeWindow(i, x, t0, t1) { for (let t = t0; t <= t1; t += 0.03) if (hazard(i, x, clock + t)) return false; return true; }
function canStep(dx, dz) {
  const ti = hr + dz, row = rowAt(ti); if (!row) return false;
  let tx = hx + dx; if (row.type !== 'river' || rowAt(hr)?.type !== 'river') tx = Math.round(tx);
  if (Math.abs(tx) > COLS) return false;
  if (row.type === 'grass' && row.blocked.has(Math.round(tx))) return false;
  if (row.type === 'river') {
    const o = support(row, tx, clock + HOP_T, -0.25); if (!o) return false;
    if (!o.pad && Math.abs(tx + row.v * 1.2) > COLS) return false;
    return true;
  }
  return safeWindow(ti, tx, 0, row.type === 'rail' ? 1.7 : row.type === 'road' ? 0.75 : 0.3);
}
window.__game = {
  get state() { return state === 'dying' ? 'play' : state; }, get level() { return 1; }, get score() { return score; }, get why() { return deathAnim && deathAnim.kind; }, get dbg() { return { hx, hr, camRow, hop: !!hop, started, st: state, cur: rowAt(hr)?.type, nxt: rowAt(hr + 1)?.type }; },
  bot() {
    if (state !== 'play' || hop) return;
    const cur = rowAt(hr);
    const stayOK = cur.type === 'river' ? (() => { const o = support(cur, hx, clock, 0); return o && (o.pad || Math.abs(hx + cur.v * 0.5) < COLS + 0.5); })() : safeWindow(hr, hx, 0, 0.5);
    if (canStep(0, 1)) return tryHop(0, 1);
    const nxt = rowAt(hr + 1), cx = Math.round(hx);
    const blockedAhead = nxt && nxt.type === 'grass' && nxt.blocked.has(cx);
    if (blockedAhead && cur.type !== 'river') {     // walk toward the nearest open column of the next row
      let bestD = 99; for (let x = -COLS; x <= COLS; x++) if (!nxt.blocked.has(x) && Math.abs(x - cx) < Math.abs(bestD)) bestD = x - cx;
      const s = Math.sign(bestD) || 1; if (canStep(s, 0)) return tryHop(s, 0);
    }
    const sides = hx > 0 ? [-1, 1] : [1, -1];
    if (cur.type === 'river' && cur.v && Math.abs(hx) > 2.2 && Math.sign(hx) === Math.sign(cur.v)) { const s = -Math.sign(cur.v); if (canStep(s, 0)) return tryHop(s, 0); }
    if (!stayOK || hr < camRow - 2.8) {
      for (const s of sides) if (canStep(s, 0)) return tryHop(s, 0);
      if (!stayOK && canStep(0, -1)) return tryHop(0, -1);
    }
  },
};

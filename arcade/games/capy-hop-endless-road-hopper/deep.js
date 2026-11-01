// Capy Hop deep v2 (studio lane 33): 30 hand-made crossings in 3 worlds + stars + hats + daily dash + the endless run. Same capybara, same voxel town (v1.js is the old game).
// Capy Hop — original endless road hopper. A very calm voxel capybara hops across a pastel seaside town:
// streets, log rivers, lily ponds and train tracks. Tap = hop forward, swipe = side / back. The camera creeps forward.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, sfx, burst, confetti, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { LEVELS, WORLDS } from './levels.js';

const NAME = 'Capy Hop: Endless Road Hopper';
const S = store('capyhop'), P = store('capyhop2');   // v1 keeps 'capyhop' (endless best); v2 progress is separate
let best = S.get('best', 0);
const F = flow('capyhop', { par: 40, warmup: 10 });

const stage = createStage({ fov: 34, shadows: true, shadowSize: 13 });
const { scene, camera, renderer } = stage;
stage.hemi.intensity = 1.25; stage.sun.intensity = 1.55;
stage.sun.shadow.camera.far = 60;
const ui = createUI({ title: 'CAPY<br>HOP', hint: 'Tap to hop · tap an edge to sidestep', hand: '👆', progress: false });
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
  if (Lv && i >= 0 && i <= Lv.goal) return buildLevelRow(i);
  const fk = F.k(i), row = { i, type: 'grass', obs: [], blocked: new Set(), group: new THREE.Group(), orange: null, v: 0 };
  // choose type in runs
  if (i < 4 || Lv) row.type = 'grass';
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
      if (inside && !Lv && i > 2 && R() < 0.2 && row.blocked.size < 3 && !(prev && prev.type === 'grass' && !prev.blocked.has(x) && [...prev.blocked].length >= 3)) {
        row.blocked.add(x); const t = mesh(R() < 0.7 ? treeGeos[Math.floor(R() * 3)] : rockGeo); t.position.x = x; t.rotation.y = Math.floor(R() * 4) * Math.PI / 2; g.add(t);
      } else if (inside && R() < 0.08) { const f = mesh(flowerGeo, false); f.position.set(x + (R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); g.add(f); }
    }
    if (i < 3) for (const x of [-1, 0, 1]) row.blocked.delete(x);
    if (i > 3 && !Lv && R() < 0.22) { const free = [...Array(9)].map((_, k) => k - 4).filter(x => !row.blocked.has(x)); const x = free[Math.floor(R() * free.length)]; const o = mesh(orangeGeo); o.position.set(x, 0.25, 0); g.add(o); row.orange = { x, m: o }; }
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

// ---------------------------------------------------------------- v2: authored crossings (levels.js)
const SPD_R = [0, 1.2, 1.8, 2.5, 3.3, 4.2], SPD_W = [0, 0.8, 1.2, 1.7, 2.3];
function parseLevel(n, spec) {
  const toks = spec.rows.split(/\s+/);
  const rows = toks.map((tok) => {
    const [main, ora] = tok.split('*'), t = main[0], r = { t, ora: ora ? ora.split(',').map(Number) : [] };
    if (t === 'G') r.blocked = main.includes('/') ? main.split('/')[1].split(',').map(Number) : [];
    else if (t === 'C' || t === 'T' || t === 'W') { r.dir = main[1] === '>' ? 1 : -1; const [sp, k] = main.slice(2).split('x').map(Number); r.sp = sp; r.n = k; }
    else if (t === 'P') r.pads = main.slice(2).split(',').map(Number);
    else if (t === 'X') { const [per, ph] = main.slice(1).split('.'); r.per = +per; r.ph = ph ? +ph : 0; }
    return r;
  });
  const goal = rows.length - 1, total = rows.filter((r) => r.ora.length).length;
  return { n, ...spec, rows, goal, total, seed: 1000 + n * 7919, par: spec.par || Math.ceil(goal * 0.85 + 5) };
}
const flagGeo = model([[0.1, 1.5, 0.1, -3.7, 0, 0, '#f4f4f4'], [0.62, 0.38, 0.06, -3.4, 1.12, 0, '#ff5d73'], [0.3, 0.2, 0.07, -3.55, 1.2, 0, '#ffffff'],
  ...Array.from({ length: 9 }, (_, k) => [1, 0.02, 0.5, -4 + k, -0.03, k % 2 ? -0.25 : 0.25, '#ffffff']), ...Array.from({ length: 9 }, (_, k) => [1, 0.02, 0.5, -4 + k, -0.03, k % 2 ? 0.25 : -0.25, '#2b2b33'])]);
function buildLevelRow(i) {
  const sp = Lv.rows[i], prev = rows.get(i - 1), row = { i, type: 'grass', obs: [], blocked: new Set(), group: new THREE.Group(), orange: null, v: 0 }, g = row.group;
  g.position.z = -i;
  const t = sp.t;
  if (t === 'G') {
    g.add(mesh(i % 2 ? strip.grassA : strip.grassB, false));
    if (prev && prev.type !== 'grass') g.add(mesh(strip.edge, false));
    for (let x = -12; x <= 12; x++) {
      const inside = Math.abs(x) <= COLS;
      if (!inside && R() < 0.6) { const tr = mesh(treeGeos[Math.floor(R() * 3)]); tr.position.x = x; g.add(tr); continue; }
      if (inside && sp.blocked.includes(x)) { row.blocked.add(x); const tr = mesh(R() < 0.75 ? treeGeos[Math.floor(R() * 3)] : rockGeo); tr.position.x = x; tr.rotation.y = Math.floor(R() * 4) * Math.PI / 2; g.add(tr); }
      else if (inside && R() < 0.08) { const f = mesh(flowerGeo, false); f.position.set(x + (R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); g.add(f); }
    }
    if (i === Lv.goal) { const fl = mesh(flagGeo, false); fl.position.set(0, 0, 0); fl.scale.x = 1; g.add(fl); row.flag = fl; }
  } else if (t === 'C' || t === 'T') {
    row.type = 'road'; g.add(mesh(strip.road, false)); if (prev && prev.type === 'road') g.add(mesh(strip.dash, false));
    const truck = t === 'T', n = sp.n, len = truck ? 2.7 : 1.55, slot = WRAP / n; row.v = SPD_R[sp.sp] * sp.dir;
    for (let k = 0; k < n; k++) {
      const geo = truck ? truckGeos[Math.floor(R() * truckGeos.length)] : carGeos[Math.floor(R() * carGeos.length)];
      const m = mesh(geo); m.rotation.y = sp.dir > 0 ? 0 : Math.PI; g.add(m);
      row.obs.push({ x0: k * slot + R() * Math.max(0, slot - len - 2.6), len, m });
    }
  } else if (t === 'X') {
    row.type = 'rail'; g.add(mesh(strip.rail, false));
    const period = sp.per, phase = sp.ph, dir = (i + Lv.n) % 2 ? -1 : 1;
    const train = mesh(trainGeo); train.rotation.y = dir > 0 ? 0 : Math.PI; train.visible = false; g.add(train);
    const pole = mesh(lightGeo); pole.position.set(-COLS - 0.5, 0, 0.42); g.add(pole);
    const b1 = new THREE.Mesh(bulbGeo, bulbMat), b2 = new THREE.Mesh(bulbGeo, bulbMat); b1.position.set(-COLS - 0.66, 1.28, 0.5); b2.position.set(-COLS - 0.34, 1.28, 0.5); g.add(b1, b2);
    row.train = { dir, period, phase, m: train, b1, b2, rang: -1 };
  } else {   // W river with logs, P lily pads
    row.type = 'river'; g.add(mesh(strip.water, false)); if (!prev || prev.type !== 'river') g.add(mesh(strip.bank, false));
    if (t === 'P') {
      row.pads = true;
      for (const x of sp.pads) { const p = mesh(padGeo, false); p.position.x = x; p.rotation.y = R() * 6; g.add(p); row.obs.push({ x0: x, len: 0.9, m: p, pad: true }); }
    } else {
      row.v = SPD_W[sp.sp] * sp.dir; const n = sp.n, slot = WRAP / n;
      for (let k = 0; k < n; k++) {
        const Lc = 2 + Math.floor(R() * 3), m = mesh(logGeos[Lc - 2]); g.add(m);
        row.obs.push({ x0: k * slot + R() * Math.max(0.2, slot - Lc - 1.6), len: Lc, m, ph: R() * 6 });
      }
    }
  }
  if (sp.ora.length && t !== 'W' && t !== 'P') { const x = sp.ora[0]; const o = mesh(orangeGeo); o.position.set(x, 0.25, 0); g.add(o); const gold = mode === 'level' && (curN === 3 || curN % 7 === 0) && i % 5 === 0; row.orange = { x, m: o, gold }; if (gold) o.scale.setScalar(1.8); }
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
let Lv = null, mode = 'level', curN = 1, got = 0, lastSafe = 0, lvT = 0, usedSave = false, resultShown = false;
let hopCombo = 0, lastHopAt = 0;
let nearN = 0, state = 'ready', score = 0, oranges = 0, hx = 0, hr = 0, hop = null, queued = null, faceY = Math.PI + 0.7, camRow = 0, camX = 0, started = false, runT = 0;
let shake = 0, deathAnim = null, recorded = false, beatenShown = false, squash = 0, lastNear = 0, prevBest = best, idleT = 0;
function reset() {
  for (const [, r] of rows) scene.remove(r.group); rows.clear(); genRow = -8; lastType = 'grass'; runLeft = 0;
  R = Lv ? rng(Lv.seed) : rng(D.seed || (Date.now() % 1000003) + 11);
  ensureRows(30);
  state = 'ready'; nearN = 0; score = 0; oranges = 0; hx = 0; hr = 0; hop = null; queued = null; faceY = Math.PI + 0.7; camRow = 0; camX = 0; started = false; runT = 0;
  deathAnim = null; recorded = false; beatenShown = false; squash = 0; prevBest = best; idleT = 0;
  hero.position.set(0, 0, 0); hero.rotation.set(0, Math.PI + 0.7, 0); heroBody.scale.setScalar(1.2); heroBody.position.set(0, 0, 0); hero.visible = true;
  stack.forEach(o => o.visible = false);
  got = 0; lastSafe = 0; lvT = 0; usedSave = false; resultShown = false;
  if (Lv) { ui.score(''); ui.sub(''); hudPill(); setBar(0); } else { ui.score(0); ui.sub(best ? 'BEST ' + best : ''); ui.pill(D.isDaily ? 'DAILY · 🍊 0' : '🍊 0'); }
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
  if (Math.abs(tx) > COLS + 0.4 || ti < camRow - 4.2 || (Lv && ti > Lv.goal) || (row.type === 'grass' && row.blocked.has(Math.round(tx)))) {   // bump: blocked
    squash = 0.6; tone(200, 0.06, 'square', 0.05, 0.8); buzz(8); return;
  }
  hop = { fx: hx, tx, fr: hr, tr: ti, t: 0 }; hr = ti; started = true; idleT = 0;
  burst(scene, new THREE.Vector3(hx, 0.05, -hop.fr), ['#ffffff', '#e8dcc0'], 4, { speed: 0.035, up: 0.025, size: 0.45, gravity: 0.002 }); shake = Math.max(shake, 0.05);
  const nowT = performance.now(); hopCombo = nowT - lastHopAt < 650 ? hopCombo + 1 : 0; lastHopAt = nowT;
  tone((dz > 0 ? 540 : 470) * Math.pow(1.0595, Math.min(hopCombo, 12)), 0.07, 'triangle', 0.1, 1.5); buzz(5);
  if (hopCombo >= 2 && hopCombo % 8 !== 0 && state === 'play') ui.pop('×' + (hopCombo + 1), hopCombo >= 8 ? '#ffd23f' : '#fff', 18 + Math.min(hopCombo, 12) * 1.5, 14);
  if (hopCombo > 0 && hopCombo % 8 === 0 && state === 'play') { ui.pop(hopCombo >= 16 ? 'UNSTOPPABLE!' : 'ON A ROLL!', '#ffd23f', 34, 30); sfx.coin(); }
}

function die(kind) {
  if (state !== 'play') return;
  state = 'dying'; deathAnim = { kind, t: 0 };
  buzz([40, 30, 80]); ui.flash(0.5); shake = kind === 'car' || kind === 'train' ? 1 : 0.5;
  const p = hero.position.clone().add(new THREE.Vector3(0, 0.4, 0));
  if (kind === 'water') { tone(380, 0.35, 'sine', 0.15, 0.3); burst(scene, p.setY(0), ['#ffffff', '#bfeaff', '#55c3f0'], 26, { speed: 0.07, up: 0.14, size: 0.6, gravity: 0.01 }); }
  else if (kind === 'slow') { sfx.fail(); }
  else { sfx.smash(); burst(scene, p, [FUR, FUR2, '#ffffff', '#ffd23f'], 24, { speed: 0.12, up: 0.1, size: 0.7 }); }
  setTimeout(Lv ? levelLost : gameOver, 550);
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
  onTap: (e) => { if (state !== 'play') return; const fx = e.clientX / innerWidth; if (fx < 0.22) tryHop(-1, 0); else if (fx > 0.78) tryHop(1, 0); else tryHop(0, 1); },   // edge taps sidestep
  onSwipe: (d) => { if (state !== 'play') return; if (d === 'left') tryHop(-1, 0); else if (d === 'right') tryHop(1, 0); else if (d === 'down') tryHop(0, -1); else tryHop(0, 1); },
});
addEventListener('keydown', e => { const k = { ArrowUp: [0, 1], KeyW: [0, 1], Space: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowDown: [0, -1], KeyS: [0, -1] }[e.code]; if (k) tryHop(...k); });
ui.onTap(which => {
  B.start();
  if (which === 'start') return play(mode === 'endless' ? 0 : mode === 'daily' ? -1 : curN);
  play(mode === 'endless' ? 0 : mode === 'daily' ? -1 : curN);
});

// ---------------------------------------------------------------- loop
const camOff = new THREE.Vector3(4.6, 17.5, 12.2);
function tick(dt) {
  const ds = dt / 60; clock += ds;
  // hop motion
  if (hop) {
    hop.t += ds / HOP_T; const k = Math.min(1, hop.t);
    hx = lerp(hop.fx, hop.tx, k);
    if (k >= 1) {
      hx = hop.tx; hop = null; squash = 1.2; shake = Math.max(shake, 0.12);
      const row = rowAt(hr);
      if (row) { const ty = row.type; if (ty === 'river') { tone(300, 0.09, 'sine', 0.09, 0.5); tone(180, 0.12, 'sine', 0.06, 0.6); } else if (ty === 'road') tone(140, 0.05, 'square', 0.05, 0.9); else tone(240, 0.05, 'triangle', 0.06, 0.8); }
      if (hopCombo >= 10 && state === 'play') { ui.flash(0.08); if (hopCombo % 2 === 0) { oranges++; if (Lv) hudPill(); ui.pop('FEVER +1 🍊', '#ff7a3c', 30, 30); sfx.coin(); } }
      burst(scene, new THREE.Vector3(hx, 0.05, -hr), row && row.type === 'river' ? ['#ffffff', '#bfeaff'] : ['#ffffff', '#f3ead8'], (hopCombo >= 4 ? 9 : 5), { speed: 0.04, up: 0.03, size: 0.55, gravity: 0.002 });
      if (Lv && state === 'play') { if (hr > score) { score = hr; setBar(hr / Lv.goal); } if (row && row.type === 'grass') lastSafe = hr; if (hr === Lv.goal) levelWon(); }
      else if (hr > score) {
        score = hr; ui.score(score);
        if (score % 25 === 0) { ui.pop(`${score}!`, '#fff', 44, 30); confetti(scene, new THREE.Vector3(hx, 1.2, -hr), 30); tone(880, 0.12, 'triangle', 0.1, 1.2); }
        if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 42, 28); confetti(scene, new THREE.Vector3(hx, 1.5, -hr), 50); }
        if (score === best + 1 && best > 0 && !beatenShown) ui.pop('NEW BEST!', '#ffd23f', 34, 30);
      }
      if (row && row.orange && Math.abs(row.orange.x - hx) < 0.5) {
        row.gold = row.orange.gold; row.group.remove(row.orange.m); row.orange = null; oranges++; got++; if (Lv) hudPill(); sfx.coin(); buzz(10);
        if (row.gold) { oranges += 2; ui.pop('GOLDEN! +3 🍊', '#ffd23f', 40, 34); confetti(scene, new THREE.Vector3(hx, 1.2, -hr), 40); ui.flash(0.25); tone(1320, 0.25, 'triangle', 0.12, 1.5); } else ui.pop(oranges % 5 === 0 ? 'chill 😌' : '+1 🍊', '#ffb03a', 30, 40); if (!Lv) ui.pill((D.isDaily ? 'DAILY · ' : '') + '🍊 ' + oranges);
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
    if (state === 'play' && cur && cur.type === 'road' && clock - lastNear > 2) for (const o of cur.obs) { const d = Math.abs(obsX(cur, o, clock) - hx) - o.len / 2; if (d < 0.55 && d > 0.28) { lastNear = clock; nearN++; oranges++; if (Lv) hudPill(); sfx.coin(); tone(520 + nearN * 90, 0.18, 'triangle', 0.1, 1.6); buzz(15); ui.pop(nearN >= 3 ? 'CLOSE x' + nearN + '! +1 🍊' : 'CLOSE! +1 🍊', '#ffe36a', 34, 44); ui.flash(0.12); squash = 0.5; break; } }
  }
  // camera creep (starts after the first hop)
  if (state === 'play') runT += ds;
  if (Lv) {
    if (state === 'play' && started) { lvT += ds; if (Math.floor(lvT) !== hudSec) hudPill(); }
    if (state === 'play' && (started || runT > 3.5)) { camRow += ds * Lv.creep; idleT += ds; }
  } else if (state === 'play' && (started || runT > 2.5)) { camRow += ds * clamp((0.3 + score * 0.004) * F.k(score), 0.25, 0.85); idleT += ds; }
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
    const st = hop ? 1 + Math.sin(k * Math.PI) * 0.4 : 1 - squash * 0.3;
    heroBody.scale.set(1.2 / Math.sqrt(st), 1.2 * st, 1.2 / Math.sqrt(st));
    if (state === 'ready') heroBody.scale.y = 1.2 + Math.sin(clock * 2) * 0.03;   // slow capy breathing
  } else if (deathAnim) {
    deathAnim.t += ds; const t = deathAnim.t;
    if (deathAnim.kind === 'car') heroBody.scale.set(1.5, Math.max(0.13, 1.1 - t * 12), 1.5);
    else if (deathAnim.kind === 'train') { hero.position.x += 0.4 * dt * (rowAt(hr)?.train?.dir || 1); hero.position.y += 0.12 * dt; hero.rotation.z += 0.3 * dt; }
    else if (deathAnim.kind === 'water') { hero.position.y = -t * 1.6; }
    else if (deathAnim.kind === 'swept') { hero.position.y = -t * 1.2; hero.rotation.y += 0.3 * dt; }
    else if (deathAnim.kind === 'slow') { heroBody.scale.y = 1.2 - Math.min(0.5, t * 2); }
  }
  const nStack = Math.min(6, 1 + oranges);   // the signature orange is always on top
  stack.forEach((o, i) => { o.visible = i < nStack; o.position.x = Math.sin(clock * 3 + i) * 0.015 * i; });
  blobShadow.position.set(hero.position.x, (crow && crow.type === 'river' ? 0.2 : 0.02), hero.position.z + 0.05); blobShadow.visible = state === 'play' || state === 'ready'; blobShadow.scale.setScalar(1 - y * 0.6);
  // camera: 3/4 view, rows run up-screen
  camX = lerp(camX, clamp(hx * 0.45, -1.6, 1.6), 0.05 * dt);
  const fz = -camRow - 2.0;
  shake = Math.max(0, shake - ds * 3); const sk = shake * shake * 0.35; camera.position.set(camX + camOff.x + (Math.random() - 0.5) * sk, camOff.y + (Math.random() - 0.5) * sk, fz + camOff.z); camera.lookAt(camX, 0, fz);
  stage.followLight(new THREE.Vector3(camX, 0, fz));
}
loop(tick);

// ---------------------------------------------------------------- v2 meta: stars, hats, saves, map, daily dash, results
const dayNum = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const today = dayNum(), yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return dayNum(d); })();
let streak = P.get('streak', 0); { const last = P.get('lastDay', 0); if (last !== today) { streak = last === yest ? streak + 1 : 1; P.set('streak', streak); P.set('lastDay', today); } }
const dailyNo = Math.max(1, Math.floor((Date.now() - Date.UTC(2026, 9, 31)) / 864e5) + 1);
let unlocked = P.get('unlocked', 1), starsOf = P.get('stars', {}), saves = P.get('saves', 2), hatOn = P.get('hat', 0), hatsSeen = P.get('hatsSeen', 0), medals = P.get('medals', 0);
let dailyDone = P.get('dailyDone', 0) === today, hudSec = -1;
const worldOf = (n) => Math.min(2, Math.floor((n - 1) / 10));
const sumStars = () => Object.values(starsOf).reduce((a, b) => a + b, 0);
const starHtml = (n) => '⭐'.repeat(n) + '<span style="opacity:.28;filter:grayscale(1)">' + '⭐'.repeat(3 - n) + '</span>';
const ring = (n, r, f) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return f(Math.cos(a) * r[0], Math.sin(a) * r[1], k); });
const HATS = [
  { name: 'Bare', at: 0, ico: '🦫', h: 0, parts: [] },
  { name: 'Cap', at: 3, ico: '🧢', h: 0.14, parts: [[0.58, 0.12, 0.5, 0, 0.74, -0.4, '#3a86ff'], [0.34, 0.04, 0.22, 0, 0.76, -0.8, '#2a66c9']] },
  { name: 'Shades', at: 8, ico: '🕶️', h: 0, parts: [[0.68, 0.09, 0.2, 0, 0.55, -0.52, '#16161e'], [0.04, 0.05, 0.3, -0.35, 0.58, -0.4, '#16161e'], [0.04, 0.05, 0.3, 0.35, 0.58, -0.4, '#16161e']] },
  { name: 'Flowers', at: 15, ico: '🌸', h: 0.1, parts: ring(8, [0.3, 0.26], (x, z, k) => [0.13, 0.1, 0.13, x, 0.74, -0.4 + z, ['#ff8fb4', '#ffd23f', '#ffffff', '#b48cff'][k % 4]]) },
  { name: 'Top hat', at: 25, ico: '🎩', h: 0.36, parts: [[0.64, 0.05, 0.56, 0, 0.74, -0.4, '#1e1e28'], [0.4, 0.34, 0.36, 0, 0.79, -0.4, '#1e1e28'], [0.42, 0.07, 0.38, 0, 0.84, -0.4, '#d7263d']] },
  { name: 'Party', at: 38, ico: '🥳', h: 0.36, parts: [[0.34, 0.08, 0.34, 0, 0.74, -0.4, '#ff5da2'], [0.24, 0.1, 0.24, 0, 0.82, -0.4, '#ffd23f'], [0.14, 0.1, 0.14, 0, 0.92, -0.4, '#ff5da2'], [0.06, 0.08, 0.06, 0, 1.02, -0.4, '#ffffff']] },
  { name: 'Crown', at: 52, ico: '👑', h: 0.22, parts: [[0.5, 0.1, 0.44, 0, 0.74, -0.4, '#ffc61a'], [0.08, 0.14, 0.08, -0.2, 0.84, -0.2, '#ffc61a'], [0.08, 0.14, 0.08, 0.2, 0.84, -0.2, '#ffc61a'], [0.08, 0.14, 0.08, -0.2, 0.84, -0.6, '#ffc61a'], [0.08, 0.14, 0.08, 0.2, 0.84, -0.6, '#ffc61a'], [0.1, 0.1, 0.1, 0, 0.84, -0.4, '#ff3b6b']] },
  { name: 'Halo', at: 70, ico: '😇', h: 0.3, parts: [[0.5, 0.04, 0.06, 0, 1.0, -0.64, '#fff3a0'], [0.5, 0.04, 0.06, 0, 1.0, -0.16, '#fff3a0'], [0.06, 0.04, 0.4, -0.26, 1.0, -0.4, '#fff3a0'], [0.06, 0.04, 0.4, 0.26, 1.0, -0.4, '#fff3a0']] },
];
const hatMesh = new THREE.Mesh(new THREE.BufferGeometry(), VMAT); hatMesh.castShadow = true; heroBody.add(hatMesh);
function wearHat(i) {
  hatOn = i; P.set('hat', i); const H = HATS[i]; hatMesh.visible = H.parts.length > 0;
  if (H.parts.length) { hatMesh.geometry.dispose(); hatMesh.geometry = model(H.parts); }
  stack.forEach((o, k) => { o.position.y = 0.76 + k * 0.25 + H.h; });
}
const hatsOpen = () => HATS.filter((h) => h.at <= sumStars()).length;

// ---- the daily dash: one generated crossing per day (same for everyone), a medal + a 🛟 + streak
function dailySpec() {
  const r = rng(dayNum() % 2147483647), toks = ['G'];
  while (toks.length < 25) {
    const seg = r(), prog = toks.length / 25, sp = () => 1 + Math.floor(r() * 2 + prog * 2), dirs = () => (r() < 0.5 ? '>' : '<');
    if (seg < 0.42) { const k = 1 + Math.floor(r() * 3); let d = dirs(); for (let q = 0; q < k; q++) { toks.push(`${r() < 0.3 ? 'T' : 'C'}${d}${Math.min(5, sp() + 1)}x${r() < 0.3 ? 2 : 3}`); d = d === '>' ? '<' : '>'; } }
    else if (seg < 0.7) { const k = 1 + Math.floor(r() * 2); let d = dirs(); for (let q = 0; q < k; q++) { toks.push(`W${d}${Math.min(3, sp())}x4`); d = d === '>' ? '<' : '>'; } }
    else if (seg < 0.78) toks.push('P:-3,-1,1,3');
    else toks.push(`X${5 + Math.floor(r() * 3)}.${Math.floor(r() * 5)}`);
    toks.push(r() < 0.65 ? `G*${Math.floor(r() * 9) - 4}` : 'G');
  }
  toks.push('G');
  return { name: 'Daily Dash', purpose: 'a new crossing every day', rows: toks.join(' '), creep: 0.2 };
}

// ---- UI
const css2 = document.createElement('style');
css2.textContent = `.cp-btn{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));right:12px;z-index:6;border:0;border-radius:18px;font-weight:800;font-family:inherit;background:#fff;color:#3a5bd9;font-size:20px;padding:8px 14px;box-shadow:0 4px 0 rgba(0,0,0,.18)}
.hc-sub{padding:0 14px;box-sizing:border-box;font-size:14px;line-height:1.2}
.cp-res,.cp-map{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;color:#24335e;font-family:inherit;text-align:center}
.cp-res{justify-content:flex-start;padding:calc(70px + env(safe-area-inset-top)) 18px 30px;gap:9px;background:rgba(40,60,110,.34)}
.cp-res h1{margin:0;font-size:clamp(36px,10.5vw,58px);font-weight:800;line-height:.95;color:#fff;text-shadow:0 5px 0 rgba(0,0,0,.25)}
.cp-res .sub{font-size:19px;font-weight:700;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.cp-res .st{font-size:60px;letter-spacing:4px;line-height:1;text-shadow:0 5px 0 rgba(0,0,0,.2)}
.cp-res .st span{display:inline-block;opacity:0;transform:scale(3) rotate(-30deg)}.cp-res .st span.on{opacity:1;transform:none;transition:transform .35s cubic-bezier(.3,1.7,.5,1),opacity .15s}.cp-res .st span.off{opacity:.45;filter:grayscale(1);transform:none}
.cp-res .chip{background:#fff;border-radius:18px;padding:8px 16px;font-weight:800;font-size:17px;box-shadow:0 4px 0 rgba(0,0,0,.14)}
.cp-res .row{display:flex;gap:12px;margin-top:auto;margin-bottom:5vh;align-items:center}
.cp-bt{border:0;border-radius:26px;font-weight:800;font-family:inherit;color:#fff;background:#3cc46a;box-shadow:0 6px 0 #2a9a50;font-size:28px;padding:15px 40px;animation:hcpulse 1.4s ease-in-out infinite}
.cp-bt.sm{font-size:24px;padding:13px 20px;background:#fff;color:#3a7bff;box-shadow:0 5px 0 rgba(0,0,0,.16);animation:none}.cp-bt.red{background:#ff8a3d;box-shadow:0 6px 0 #d96a1d}
.cp-map{justify-content:flex-start;background:linear-gradient(#cfeaff,#f4fbff);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 30px;gap:6px}
.cp-map h2{margin:6px 0 0;font-size:22px;font-weight:800}.cp-map .wn{font-size:13px;opacity:.8;margin-bottom:4px}
.cp-map .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;width:min(94vw,440px)}
.cp-node{position:relative;aspect-ratio:1;border-radius:18px;border:0;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,.14);font-weight:800;font-size:22px;color:#3a5b9f;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.cp-node small{font-size:10px;color:#ffb81c;letter-spacing:0;margin-top:2px;min-height:11px}.cp-node.lock{opacity:.45;box-shadow:none}.cp-node.hard{outline:3px solid #ff4d5e}
.cp-node.next{background:#3cc46a;color:#fff;animation:hcpulse 1s ease-in-out infinite}.cp-node.done{background:#fff7d6}
.cp-hats{display:flex;gap:6px;margin:2px 0 6px;flex-wrap:wrap;justify-content:center;max-width:440px}.cp-hat{width:48px;height:48px;border-radius:14px;border:3px solid #fff;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.18);font-size:22px;font-weight:800;color:#3a5b9f;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;font-family:inherit}
.cp-hat small{font-size:9px;opacity:.8}.cp-hat.on{outline:3px solid #3cc46a}.cp-hat.lk{filter:grayscale(1);opacity:.5}
.cp-close{position:sticky;top:0;align-self:flex-end;border:0;background:#fff;border-radius:50%;width:40px;height:40px;font-size:20px;box-shadow:0 3px 0 rgba(0,0,0,.16)}
.cp-big{border:0;border-radius:20px;background:#ffb81c;color:#fff;font-weight:800;font-size:18px;padding:10px 20px;font-family:inherit;box-shadow:0 4px 0 #d9930b;margin:2px 4px}.cp-big.done{background:#c8d3e8;box-shadow:none}.cp-big.endl{background:#4fb3ff;box-shadow:0 4px 0 #2d86cf}`;
document.head.appendChild(css2);
const mk2 = (cls, tag = 'div') => { const d = document.createElement(tag); d.className = cls; document.body.appendChild(d); return d; };
const resEl = mk2('cp-res hc-hidden'), mapEl = mk2('cp-map hc-hidden'), mapBtn = mk2('cp-btn', 'button');
mapBtn.textContent = '🗺️'; mapBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); B.start(); openMap(); });
for (const el of [resEl, mapEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
const barEl = document.createElement('div'); barEl.style.cssText = 'position:fixed;left:0;top:0;height:6px;width:0;background:#ff8a3d;z-index:5;transition:width .2s;pointer-events:none;border-radius:0 3px 3px 0';
document.body.appendChild(barEl);
function setBar(p) { barEl.style.width = Math.max(0, Math.min(1, p)) * 100 + '%'; barEl.style.display = Lv ? '' : 'none'; }
function hudPill() { hudSec = Math.floor(lvT); if (!Lv) return; ui.pill(`${mode === 'daily' ? '📅' : curN} · 🍊 ${got}/${Lv.total}  ·  ⏱ ${hudSec}${hudSec <= Lv.par ? ' / ' + Lv.par : ' ⌛'}`); }
function applyWorld(w) { const k = WORLDS[w]; document.body.style.setProperty('--bg1', k.sky[0]); document.body.style.setProperty('--bg2', k.sky[1]); stage.hemi.intensity = k.hemi; }
const tomorrowLine = () => `Tomorrow: Daily Dash #${dailyNo + 1} · 🔥 day ${streak + 1}`;
let note = '';
function showSub(t, ms = 3600) { ui.sub(t); clearTimeout(showSub.t); showSub.t = setTimeout(() => ui.sub(''), ms); }

// ---- flow: setup / play / win / lose
function setup(n) {
  mode = n === 0 ? 'endless' : n < 0 ? 'daily' : 'level';
  if (n > 0) { curN = n; Lv = parseLevel(n, LEVELS[n - 1]); } else if (n < 0) Lv = parseLevel(0, dailySpec()); else Lv = null;
  applyWorld(n > 0 ? worldOf(n) : 0);
  reset();
  setBar(0);
  ui.els.sc.classList.toggle('hc-hidden', !!Lv || true);
  mapEl.classList.add('hc-hidden'); resEl.classList.add('hc-hidden');
}
function play(n) {
  if (n > unlocked) n = unlocked;
  setup(n); ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  state = 'play'; ui.els.sc.classList.toggle('hc-hidden', !!Lv);
  if (Lv) showSub(mode === 'daily' ? `📅 Daily Dash #${dailyNo}` : n === 1 ? 'tap to hop · swipe to sidestep' : `${LEVELS[n - 1].hard ? '🔥 ' : ''}${n}. ${Lv.name}: ${Lv.purpose}`, n === 1 ? 6000 : 3800);
}
function levelWon() {
  if (state !== 'play') return; state = 'won'; clearTimeout(showSub.t); ui.sub(''); resultShown = true;
  const s2 = got >= Lv.total ? 1 : 0, s3 = lvT <= Lv.par ? 1 : 0, st = 1 + s2 + s3, n = mode === 'daily' ? 0 : curN;
  sfx.win(); buzz([20, 30, 40]); confetti(scene, hero.position.clone().add(new THREE.Vector3(0, 1, 0)), 70); F.level(true);
  const oldTot = sumStars(); let first = false, gain = [], gainSave = 0, medal = false;
  if (n) { const was = starsOf[n] || 0; first = !was; if (st > was) { starsOf[n] = st; P.set('stars', starsOf); } if (n >= unlocked) { unlocked = n + 1; P.set('unlocked', unlocked); } if (first && n % 5 === 0) gainSave = 1; }
  else if (!dailyDone) { dailyDone = true; medals++; gainSave = 1; P.set('medals', medals); P.set('dailyDone', today); }
  if (gainSave) { saves += gainSave; P.set('saves', saves); }
  const nowTot = sumStars(); HATS.forEach((h, i) => { if (h.at > oldTot && h.at <= nowTot) gain.push(i); });
  if (gain.length) { wearHat(gain[gain.length - 1]); P.set('hatsSeen', hatsOpen()); }
  setTimeout(() => showResult({ st, s2, s3, first, gain, gainSave, n }), 450);
}
function showResult(r) {
  const w = r.n ? WORLDS[worldOf(r.n)] : { icon: '📅', name: 'Daily Dash' };
  const left = HATS.find((h) => h.at > sumStars()), chips = [
    `<div class="chip">🍊 ${got}/${Lv.total} ${r.s2 ? '✓' : ''} &nbsp; ⏱ ${Math.round(lvT)}s / ${Lv.par}s ${r.s3 ? '✓' : ''}</div>`,
    ...r.gain.map((i) => `<div class="chip" style="background:#fff3b0">${HATS[i].ico} New hat: ${HATS[i].name.replace(/ hat$/i, "")}!</div>`),
    r.gainSave ? `<div class="chip">🛟 +1 rescue</div>` : '',
    !r.n ? `<div class="chip" style="background:#fff3b0">📅 Daily medal #${medals}</div>` : '',
    left ? `<div class="chip" style="font-size:14px">${left.ico} ${left.name.replace(/ hat$/i, "")} hat at ${left.at}⭐ · you have ${sumStars()}</div>` : '',
    `<div class="chip" style="font-size:14px">${r.n ? (r.n % 10 === 0 ? 'Next: a new world!' : tomorrowLine()) : tomorrowLine()}</div>`,
  ].join('');
  const nextN = r.n ? Math.min(30, r.n + 1) : unlocked;
  resEl.innerHTML = `<div class="sub">${w.icon} ${w.name}${r.n ? ' · ' + r.n : ''}</div><h1>${r.n && LEVELS[r.n - 1].hard ? 'BOSS<br>BEATEN!' : 'CROSSED!'}</h1><div class="st">${[1, 1, 1].map((_, k) => `<span class="${k < r.st ? '' : 'off'}">⭐</span>`).join('')}</div>${chips}
    <div class="row"><button class="cp-bt sm" data-a="map">🗺️</button><button class="cp-bt" data-a="next">${r.n && r.n >= 30 ? '♾️' : (r.n ? nextN + ' ▶' : '▶')}</button><button class="cp-bt sm" data-a="again">🔁</button></div>`;
  resEl.classList.remove('hc-hidden');
  resEl.querySelectorAll('.st span:not(.off)').forEach((el, k) => setTimeout(() => { el.classList.add('on'); tone(520 + k * 160, 0.1, 'triangle', 0.12, 1.2); buzz(8); }, 250 + k * 280));
}
function levelLost() {
  if (state === 'won') return; state = 'lost'; clearTimeout(showSub.t); ui.sub(''); F.level(false, Lv.goal ? hr / Lv.goal : 0);
  const rowsLeft = Lv.goal - hr, kind = deathAnim && deathAnim.kind, line = rowsLeft <= 2 ? `SO CLOSE: ${rowsLeft} row${rowsLeft === 1 ? '' : 's'} to go!` : (CHILL_LINES[kind] || '');
  resEl.innerHTML = `<div class="sub">${mode === 'daily' ? '📅 Daily Dash' : curN + '. ' + Lv.name}</div><h1>${rowsLeft <= 2 ? 'SO<br>CLOSE!' : 'OOPS!'}</h1><div class="sub">${line}</div><div class="chip" style="width:210px;padding:6px"><div style="height:14px;border-radius:7px;background:#dfe6f5;overflow:hidden"><div style="height:100%;width:${Math.max(4, Math.round(hr / Lv.goal * 100))}%;background:#ff7a3c"></div></div></div>
    <div class="row"><button class="cp-bt sm" data-a="map">🗺️</button><button class="cp-bt red" data-a="again">🔁 Again</button>${saves > 0 && !usedSave ? `<button class="cp-bt sm" data-a="rescue">🛟 ${saves}</button>` : ''}</div>`;
  resEl.classList.remove('hc-hidden');
}
function rescue() {
  if (saves <= 0 || state !== 'lost') return; saves--; usedSave = true; P.set('saves', saves); resEl.classList.add('hc-hidden');
  deathAnim = null; hop = null; queued = null; hr = lastSafe; const row = rowAt(hr); let x = Math.max(-COLS, Math.min(COLS, Math.round(hx)));
  for (let d = 0; d <= 8; d++) { const a = x + d, b = x - d; if (Math.abs(a) <= COLS && !row.blocked.has(a)) { x = a; break; } if (Math.abs(b) <= COLS && !row.blocked.has(b)) { x = b; break; } }
  hx = x; camRow = Math.min(camRow, hr - 1); hero.position.set(hx, 0, -hr); hero.rotation.y = Math.PI + 0.7; heroBody.scale.setScalar(1.2); heroBody.position.set(0, 0, 0); hero.visible = true;
  state = 'play'; idleT = 0; sfx.coin(); ui.pop('🛟 back on the grass', '#fff', 28, 30);
}
resEl.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (!a) { if (state === 'lost') { B.start(); play(mode === 'daily' ? -1 : curN); } return; } B.start(); const k = a.dataset.a;
  if (k === 'map') openMap(); else if (k === 'rescue') rescue(); else if (k === 'next') play(mode === 'daily' ? unlocked : curN >= 30 ? 0 : curN + 1); else play(mode === 'daily' ? -1 : curN); });
function openMap() {
  const tot = sumStars(), done = Object.keys(starsOf).length;
  let h = `<button class="cp-close" data-a="close">❌</button><h2>⭐ ${tot} · 🛟 ${saves} · ${done}/30${(() => { const nx = HATS.find((H) => tot < H.at); return nx ? ` · <small>${nx.at - tot}⭐ → ${nx.ico}</small>` : ''; })()}</h2><div class="cp-hats">`;
  HATS.forEach((H, i) => { const ok = tot >= H.at; h += `<button class="cp-hat ${i === hatOn ? 'on' : ''} ${ok ? '' : 'lk'}" data-h="${i}">${H.ico}<small>${ok ? H.name : H.at + '⭐'}</small></button>`; });
  h += `</div><div><button class="cp-big ${dailyDone ? 'done' : ''}" data-d="1">📅 Daily Dash #${dailyNo}${dailyDone ? ' ✓' : ''} · 🔥 ${streak}</button><button class="cp-big endl" data-e="1">♾️ Endless · best ${best}</button></div><div class="wn">${dailyDone ? tomorrowLine() : 'A new crossing every day: a medal and a rescue'} · 🏅 ${medals}</div>`;
  WORLDS.forEach((w, wi) => {
    h += `<h2>${w.icon} ${w.name}</h2><div class="wn">${w.note}</div><div class="grid">`;
    for (let n = wi * 10 + 1; n <= wi * 10 + 10; n++) {
      const spec = LEVELS[n - 1], st = starsOf[n] || 0, ok = n <= unlocked;
      h += `<button class="cp-node ${ok ? '' : 'lock'} ${n === unlocked ? 'next' : st ? 'done' : ''} ${spec.hard ? 'hard' : ''}" data-n="${n}">${ok ? n : '🔒'}<small>${st ? starHtml(st) : spec.hard ? 'BOSS' : ''}</small></button>`;
    }
    h += '</div>';
  });
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden'); resEl.classList.add('hc-hidden');
  const nx = mapEl.querySelector('.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 30);
}
mapEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-n],[data-h],[data-a],[data-d],[data-e]'); if (!t) return; B.start();
  if (t.dataset.a === 'close') { mapEl.classList.add('hc-hidden'); if (state === 'won' || state === 'lost') resEl.classList.remove('hc-hidden'); return; }
  if (t.dataset.h !== undefined) { const i = +t.dataset.h; if (sumStars() >= HATS[i].at) { wearHat(i); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(); } return; }
  if (t.dataset.d) return play(-1);
  if (t.dataset.e) return play(0);
  const n = +t.dataset.n; if (n <= unlocked) play(n);
});

const urlLevel = +(/[?&]level=(\d+)/.exec(location.search) || [])[1];
wearHat(hatOn < HATS.length && HATS[hatOn].at <= sumStars() ? hatOn : 0);
setup(/[?&]daily=1/.test(location.search) ? -1 : urlLevel || Math.min(30, unlocked));
ui.start();


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
function padReach(i, x, seen = new Set()) {
  const key = i + ':' + x; if (seen.has(key)) return false; seen.add(key);
  const row = rowAt(i), nx = rowAt(i + 1); if (!row) return true;
  if (!nx || !nx.pads) return true;
  if (nx.obs.some((o) => o.x0 === x) && padReach(i + 1, x, seen)) return true;
  for (const d of [-1, 1]) if (row.obs.some((o) => o.x0 === x + d) && padReach(i, x + d, seen)) return true;
  return false;
}
window.__game = {
  get state() { return state === 'dying' ? 'play' : state; }, get level() { return curN; }, get mode() { return mode; }, get goal() { return Lv ? Lv.goal : 0; }, get got() { return got; }, get time() { return lvT; }, get lv() { return Lv && { total: Lv.total, par: Lv.par, name: Lv.name }; }, play, setup, qa(n) { setup(n); ui.hideStart(); state = 'play'; },
  sim(n, bot = true) { for (let i = 0; i < n; i++) { if (bot) this.bot(); tick(1); if (state !== 'play') break; } return state; }, get score() { return score; }, get why() { return deathAnim && deathAnim.kind; }, get dbg() { return { hx, hr, camRow, hop: !!hop, started, st: state, cur: rowAt(hr)?.type, nxt: rowAt(hr + 1)?.type }; },
  bot() {
    if (state !== 'play' || hop) return;
    const cur = rowAt(hr);
    const stayOK = cur.type === 'river' ? (() => { const o = support(cur, hx, clock, 0); return o && (o.pad || Math.abs(hx + cur.v * 0.5) < COLS + 0.5); })() : safeWindow(hr, hx, 0, 0.5);
    const nxt = rowAt(hr + 1), cx = Math.round(hx);
    if (nxt && nxt.pads && (cur.type !== 'river' || cur.pads)) {     // plan the pad path: stand where a whole chain of pads is reachable
      const ahead = nxt.obs.some((o) => o.x0 === cx) && padReach(hr + 1, cx);
      if (!ahead) {
        let bd = 99; for (const o of nxt.obs) if (padReach(hr + 1, o.x0) && Math.abs(o.x0 - cx) < Math.abs(bd)) bd = o.x0 - cx;
        const sg = Math.sign(bd);
        if (bd !== 99 && sg && (cur.type !== 'river' || cur.obs.some((o) => o.x0 === cx + sg)) && canStep(sg, 0)) return tryHop(sg, 0);
      }
    }
    if (canStep(0, 1)) return tryHop(0, 1);
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

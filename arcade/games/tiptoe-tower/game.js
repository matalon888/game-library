// Tiptoe Tower — original game. Strut down a rooftop runway, grab shoes to stack your heels sky-high, step over brick
// walls (they eat heel blocks), do the splits across rooftop rails, then spend what's left climbing the multiplier podium.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { bake, vcMat } from './bake.js';
import { adapt } from './kit/adapt.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, PER_WORLD, solve, solvePath, starSteps, genLevel, isFull } from './levels.js';

// v2 ("deep"): 36 hand-made levels in 3 worlds, gates / snip bars / sliding walls / golden shoes, star steps on the podium,
// a level map, a closet of looks (stars) and a gem jar of heel styles. READY stays false until v2 is finished and has
// passed the fun gate: until then no player ever sees it (?deep=1 is for QA only).
const READY = true;
const DEEP = (READY && ab('deep-tiptoe-tower')) || /[?&]deep=1(&|$)/.test(location.search);

const ST = store('tiptoetower');
const F = flow('tiptoetower');
const A = adapt({ minOk: 1 });   // in-round: strut speed ±20%, one lucky save per round (ADAPT_BRIEF.md)
const WB = worldBoard({ game: 'tiptoe-tower', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });
const DS = store('tiptoetower2'), SV = DEEP ? DS : ST;   // v2 keeps its own progress; v1's save is untouched
let unlocked = DS.get('unlocked', 1), starsBy = DS.get('stars', {}), lookI = DS.get('look', 0), heelI = DS.get('heel', 0), heelOwn = DS.get('heelown', [0]), jar = DS.get('jar', 0);
const dayN = () => Math.floor(Date.now() / 864e5); let streak = DS.get('streak', 0), lastDay = DS.get('lastday', 0); if (dayN() - lastDay > 1) streak = 0;
let level = DEEP ? (+new URLSearchParams(location.search).get('level') || unlocked) : ST.get('level', 1), best = SV.get('best', 0), total = SV.get('gems', 0);
const { scene, camera, followLight } = createStage({ fov: 50, shadowSize: 14 });
const ui = createUI({ title: 'TIPTOE<br>TOWER', hint: 'Tap a side · grab the shoes', hand: '👆', score: false });
const nextCard = w => (l, x) => { if (!DEEP) ui.els.win.querySelector('.hint').textContent = 'Level ' + (l + 1) + ' ▶'; w(l, x); }; ui.win = nextCard(ui.win);   // one tap → next level
const $ = id => document.getElementById(id);
const SKIES = [['#3fa9ff', '#c4ecff', '#ff4fa3'], ['#ff7eb6', '#ffe0ef', '#c13aff'], ['#8f6bff', '#ffd1f0', '#ff4fa3'], ['#25c2d9', '#d9fbff', '#ff5d8f']];
const TW = 5.4, BH = 0.34, SPEED = 9, LANES = [-1.7, 0, 1.7];
const HEEL_COLS = ['#ff4fa3', '#ff86c2'];

// ---------------------------------------------------------------- the strutter
const SKIN = '#ffcfb0';
function makeGirl() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const sk = mat(SKIN), top = glossy('#ffffff'), skirt = glossy('#ff4fa3'), hair = mat('#5a2d1a');
  const M = (geo, m, x, y, z, p = inner) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const legPiv = (x) => { const p = new THREE.Group(); p.position.set(x, 1.05, 0); inner.add(p); M(new THREE.CapsuleGeometry(0.085, 0.86, 4, 10), sk, 0, -0.5, 0, p); const shoe = M(new THREE.BoxGeometry(0.18, 0.1, 0.32), skirt, 0, -0.98, -0.04, p); return p; };
  const legL = legPiv(-0.12), legR = legPiv(0.12);
  M(new THREE.CylinderGeometry(0.14, 0.36, 0.42, 16), skirt, 0, 1.08, 0);
  const torso = M(new THREE.CapsuleGeometry(0.17, 0.34, 6, 14), top, 0, 1.47, 0); torso.scale.set(1, 1, 0.8);
  M(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), sk, 0, 1.78, 0);
  const head = M(new THREE.SphereGeometry(0.17, 20, 16), sk, 0, 1.95, 0);
  M(new THREE.SphereGeometry(0.185, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 1.97, 0.02);
  const pony = M(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), hair, 0, 1.78, 0.2); pony.rotation.x = 0.35;
  const armPiv = (x, sgn) => { const p = new THREE.Group(); p.position.set(x, 1.66, 0); p.rotation.z = sgn * 0.18; inner.add(p); M(new THREE.CapsuleGeometry(0.06, 0.52, 4, 8), sk, 0, -0.32, 0, p); return p; };
  const armL = armPiv(-0.24, -1), armR = armPiv(0.24, 1);
  Object.assign(g, { inner, legL, legR, armL, armR, pony, head, mats: { top, skirt, hair } });
  return g;
}
const girl = makeGirl(); scene.add(girl);
// heel blocks (both feet) + loose falling blocks, one instanced mesh
const heelGeo = rounded(0.26, BH * 0.92, 0.38, 0.05);
const heels = new THREE.InstancedMesh(heelGeo, glossy('#ffffff'), 140); heels.castShadow = true; heels.frustumCulled = false; scene.add(heels);
for (let i = 0; i < 140; i++) heels.setColorAt(i, new THREE.Color(HEEL_COLS[i % 2]));
// shoe pickup model
const shoeGeo = bake([
  { geo: new THREE.SphereGeometry(0.2, 16, 10), color: '#ff2d8a', pos: [0, 0.09, -0.36], scl: [0.85, 0.5, 1.45] },
  { geo: new THREE.BoxGeometry(0.28, 0.06, 0.66), color: '#ff2d8a', pos: [0, 0.3, 0.0], rot: [-0.72, 0, 0] },
  { geo: new THREE.BoxGeometry(0.3, 0.26, 0.1), color: '#ff7ab8', pos: [0, 0.6, 0.3] },
  { geo: new THREE.CylinderGeometry(0.045, 0.022, 0.52, 8), color: '#ff2d8a', pos: [0, 0.26, 0.31] },
  { geo: new THREE.TorusGeometry(0.15, 0.028, 6, 18), color: '#ffd23f', pos: [0, 0.5, 0.12], rot: [Math.PI / 2 - 0.7, 0, 0] },
  { geo: new THREE.SphereGeometry(0.05, 8, 6), color: '#ffffff', pos: [0, 0.22, -0.52] },
]);
const gemGeo = new THREE.OctahedronGeometry(0.22, 0); gemGeo.scale(1, 1.25, 1);

// ---------------------------------------------------------------- static scenery: city + clouds (built once)
const scenery = new THREE.Group(); scene.add(scenery);
{
  const parts = [], R = rng(42);
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1, x = side * (9 + R() * 30), z = 30 - i * 5.5 - R() * 4, w = 3 + R() * 4, h = 14 + R() * 30, c = ['#9fd3ff', '#b9ddff', '#8cc3f7', '#c7e6ff'][Math.floor(R() * 4)];
    parts.push({ geo: new THREE.BoxGeometry(w, h, w), color: c, pos: [x, -30 + h / 2, z] });
    for (let y = -26; y < -30 + h - 1; y += 2.2) parts.push({ geo: new THREE.BoxGeometry(w + 0.04, 0.5, w * 0.8), color: '#e8f5ff', pos: [x, y, z] });
    if (R() < 0.3) parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.1, 6, 6), color: '#ffffff', pos: [x, -30 + h + 3, z] });
  }
  const city = new THREE.Mesh(bake(parts), vcMat({ roughness: 0.7 })); scenery.add(city);
  const cl = [];
  for (let i = 0; i < 26; i++) { const x = (R() < 0.5 ? -1 : 1) * (7 + R() * 30), y = 13 + R() * 14, z = -i * 20 - R() * 10; for (let k = 0; k < 4; k++) cl.push({ geo: new THREE.SphereGeometry(1.6 + R() * 1.4, 12, 8), color: '#ffffff', pos: [x + k * 1.9 - 3, y + (k % 2) * 0.6, z], scl: [1, 0.65, 0.8] }); }
  scenery.add(new THREE.Mesh(bake(cl), vcMat({ roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 })));
}

// ---------------------------------------------------------------- level
let world, items = [], walls = [], rails = [], steps = [], debris = [], state = 'ready', G, R, finZ, gems = 0, mult = 1, endT = 0, camY = 4, podiumZ;
// v2 only (stay empty in v1): gates (+N/-N/xN), snip bars, golden shoes, the level's rows and the solver's star steps
let pTot = 0, gates = [], snips = [], LV = null, plan = null, rowZ = [], rowEnd = [], starAt = [99, 99], lt = 0, shk = 0, stopT = 0, combo = 0, comboT = 0, perfect = 0, fever = 0, starFx = [];
let pickMesh, gemMesh;
function buildLevel() {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } if (o.dispose && o.isInstancedMesh) o.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  R = rng(level * 4231 + 9); const fk = F.k(); A.round(level === 1 ? 0 : 1);
  if (DEEP) LV = level <= LEVELS.length ? LEVELS[level - 1] : genLevel(level, rng(level * 977 + 5), fk);
  const sky = DEEP ? WORLDS[worldOf(level) - 1].sky : SKIES[(level - 1) % SKIES.length];
  document.body.style.setProperty('--bg1', sky[0]); document.body.style.setProperty('--bg2', sky[1]); document.body.style.setProperty('--ui', sky[2]);
  items = []; walls = []; rails = []; steps = []; debris = []; gems = 0; mult = 1; endT = 0;
  gates = []; snips = []; rowZ = []; rowEnd = []; lt = 0; shk = 0; stopT = 0; combo = 0; perfect = 0; fever = 0; starFx = []; pTot = 0;
  let z = -10; const segs = [];
  const nSeg = Math.min(14, 6 + level);
  let heelBudget = 0;
  const pickRow = (zz, lane, n) => { for (let k = 0; k < n; k++) items.push({ kind: 'shoe', x: LANES[lane], z: zz - k * 1.6, got: false }); heelBudget += n; };
  const gemRow = (zz, lane, n) => { for (let k = 0; k < n; k++) items.push({ kind: 'gem', x: LANES[lane], z: zz - k * 1.2, got: false }); };
  if (DEEP) z = layoutDeep(LV.rows, z);
  else if (level === 1) {   // first run: shoes in every lane, one low wall, one easy splits, then the podium (~10 s)
    for (const [l, n] of [[1, 5], [0, 3], [2, 3]]) pickRow(z, l, n);
    gemRow(z - 9, 0, 3); z -= 14;
    addWall(z, -TW / 2, TW / 2, 1); heelBudget -= 1; z -= 10;
    for (const [l, n] of [[1, 4], [0, 2], [2, 2]]) pickRow(z, l, n);
    gemRow(z - 9, 2, 3); z -= 14;
    const need = 2, gap = 2 * (0.98 + need * BH) - 0.25, len = 10;
    rails.push({ z0: z, z1: z - len, gap, need });
    for (let k = 0; k < 4; k++) items.push({ kind: 'gem', x: (k % 2 ? 1 : -1) * gap / 2, z: z - 2 - k * 2.4, got: false, rail: true });
    z -= len + 4;
  } else for (let i = 0; i < nSeg; i++) {
    const kind = i < 1 ? 'pick' : (i % 3 === 2 && heelBudget > 5) ? 'rail' : (i % 2 ? 'wall' : 'pick');
    if (kind === 'pick') {
      const lane = Math.floor(R() * 3); pickRow(z, lane, 4 + Math.floor(R() * 3));
      if (R() < 0.6) { const l2 = (lane + 1 + Math.floor(R() * 2)) % 3; pickRow(z - 2, l2, 2 + Math.floor(R() * 2)); }
      gemRow(z - 9, Math.floor(R() * 3), 3);
      z -= 14;
    } else if (kind === 'wall') {
      if (R() < 0.45) { const k = Math.max(1, Math.round((1 + Math.floor(R() * Math.min(4, 1 + level * 0.5))) * fk)); addWall(z, -TW / 2, TW / 2, k); heelBudget -= k; }
      else { const free = Math.floor(R() * 3); for (let l = 0; l < 3; l++) if (l !== free) addWall(z, LANES[l] - 0.85, LANES[l] + 0.85, Math.round((3 + Math.floor(R() * (3 + level))) * fk)); pickRow(z + 3, free, 2); }
      z -= 10;
    } else {
      const need = Math.min(heelBudget - 2, Math.round((2 + Math.floor(R() * (2 + level * 0.6))) * fk)), gap = 2 * (0.98 + need * BH) - 0.25, len = 10 + R() * 6;
      rails.push({ z0: z, z1: z - len, gap, need });
      for (let k = 0; k < 4; k++) items.push({ kind: 'gem', x: (k % 2 ? 1 : -1) * gap / 2, z: z - 2 - k * 2.4, got: false, rail: true });
      z -= len + 4;
    }
  }
  finZ = z; podiumZ = z - 4;
  // runway pieces (broken where rails span a gap)
  const runwayTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff7fb'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#ffe4f1'; x.fillRect(54, 0, 20, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t; })();
  const runway = (za, zb) => {
    const len = za - zb; if (len <= 0.1) return;
    const tx = runwayTex.clone(); tx.needsUpdate = true; tx.repeat.set(1, len / 5);
    const m = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.5, len), mat('#ffffff', { map: tx })); m.position.set(0, -0.25, (za + zb) / 2); m.receiveShadow = true; world.add(m);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, len), glossy(sky[2])); e.position.set(sx * (TW / 2 + 0.11), -0.2, m.position.z); world.add(e); }
    const base = new THREE.Mesh(new THREE.BoxGeometry(TW + 1.6, 30, len), mat('#d8ecff', { roughness: 0.8 })); base.position.set(0, -15.6, m.position.z); world.add(base);
  };
  let cur = 14; for (const r of rails) { runway(cur, r.z0); cur = r.z1; } runway(cur, podiumZ - 30);
  for (const r of rails) {
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, r.z0 - r.z1 + 1, 12), glossy('#3a86ff')); rail.rotation.x = Math.PI / 2; rail.position.set(sx * r.gap / 2, -0.05, (r.z0 + r.z1) / 2); rail.castShadow = true; world.add(rail);
      for (let zz = r.z0; zz >= r.z1; zz -= 3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), mat('#ffffff')); p.position.set(sx * r.gap / 2, -3.1, zz); world.add(p); }
    }
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(TW, 0.6), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.01, r.z0 + 0.6); world.add(warn);
  }
  // walls
  for (const w of walls) {
    const n = Math.max(1, Math.round((w.x1 - w.x0) / 0.58)), cw = (w.x1 - w.x0) / n;
    const im = new THREE.InstancedMesh(rounded(cw * 0.94, BH * 0.94, 0.6, 0.05), glossy('#ffffff'), n * w.k); const M4 = new THREE.Matrix4(); let k = 0;
    for (let yy = 0; yy < w.k; yy++) for (let xx = 0; xx < n; xx++) { im.setMatrixAt(k, M4.makeTranslation(w.x0 + cw * (xx + 0.5), BH * (yy + 0.5), w.z)); im.setColorAt(k++, new THREE.Color((xx + yy) % 2 ? '#ff4d4d' : '#ff6b5e')); }
    im.castShadow = true; im.receiveShadow = true; world.add(im); w.m = im; w.n = n;
  }
  if (DEEP) buildDeepProps();
  // pickups
  const shoes = items.filter(i => i.kind === 'shoe'), gs = items.filter(i => i.kind === 'gem');
  pickMesh = new THREE.InstancedMesh(shoeGeo, vcMat({ roughness: 0.25 }), Math.max(1, shoes.length)); pickMesh.castShadow = true; world.add(pickMesh);
  gemMesh = new THREE.InstancedMesh(gemGeo, glossy('#29b6ff', { emissive: '#0a6fd0', emissiveIntensity: 0.4, flatShading: true }), Math.max(1, gs.length)); world.add(gemMesh);
  shoes.forEach((s, i) => s.i = i); gs.forEach((s, i) => s.i = i);
  // multiplier podium
  const COLS = ['#ff4d6d', '#ff8c42', '#ffd23f', '#9ef01a', '#3ab795', '#00c2ff', '#3a86ff', '#7b5cff', '#c77dff', '#ff5d8f'];
  for (let i = 0; i < 30; i++) {
    const y = (i + 1) * BH, sz = podiumZ - i * 0.9, m = 1 + i * 0.1;
    const c = document.createElement('canvas'); c.width = 256; c.height = 40; const x = c.getContext('2d'); x.fillStyle = COLS[i % 10]; x.fillRect(0, 0, 256, 40); x.fillStyle = '#fff'; x.font = '800 30px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('x' + m.toFixed(1), 128, 22);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const side = mat(COLS[i % 10]);
    const st = new THREE.Mesh(new THREE.BoxGeometry(TW, y, 0.9), [side, side, side, side, mat('#ffffff', { map: tx }), side]); st.position.set(0, y / 2, sz - 0.45); st.receiveShadow = true; st.castShadow = true; world.add(st);
    steps.push({ y, z: sz - 0.45, m, mesh: st });
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(TW / 2 + 0.3, 0.18, 10, 32, Math.PI), glossy(sky[2])); arch.position.set(0, 0, finZ + 1); world.add(arch);
  if (DEEP) podiumStars();
  const assist = DEEP && lossLv === level && lossRun >= 3 ? Math.min(4, lossRun - 1) : 0;
  G = { x: 0, tx: 0, z: 0, n: assist, dn: assist, y: 0, vy: 0, ph: 0, rail: null, climb: -1, fall: 0, hop: 0 };
  ui.levels(level); ui.progress(0); hud(); deepHud();
}
function addWall(z, x0, x1, k, slide) { walls.push({ z, x0, x1, k, done: false, slide }); }

// ---------------------------------------------------------------- v2: rows → props
function layoutDeep(rows, z) {
  const GAP = 6.5;
  rows.forEach((row, ri) => {
    rowZ.push(z);
    if (isFull(row)) {
      const c = row[0], n = +row.slice(1);
      rowEnd.push(c === 'R' ? z - (9 + n * 0.7) : z);
      if (c === 'W') { addWall(z, -TW / 2, TW / 2, n); z -= GAP + 1.5; }
      else if (c === 'M') { addWall(z, -0.85, 0.85, n, ri * 1.3); z -= GAP + 3; }
      else if (c === 'R') {
        const gap = 2 * (0.98 + n * BH) - 0.25, len = 9 + n * 0.7;
        rails.push({ z0: z, z1: z - len, gap, need: n });
        const ng = Math.max(4, Math.round(len / 2.4) - 1);
        for (let k = 0; k < ng; k++) items.push({ kind: 'gem', x: (k % 2 ? 1 : -1) * gap / 2, z: z - 2 - k * 2.4, got: false, rail: true });
        z -= len + GAP;
      }
      return;
    }
    let len = 1;
    row.split(' ').forEach((tok, l) => {
      const c = tok[0], n = +tok.slice(1) || 0, x = LANES[l], col = ri * 3 + l;
      if (c === 's') { for (let k = 0; k < n; k++) items.push({ kind: 'shoe', x, z: z - k * 1.6, got: false, col, colN: n }); len = Math.max(len, n * 1.6); }
      else if (c === 'g') { for (let k = 0; k < n; k++) items.push({ kind: 'gem', x, z: z - k * 1.2, got: false }); len = Math.max(len, n * 1.2); }
      else if (c === 'S') items.push({ kind: 'gold', x, z, got: false });
      else if (c === 'w') addWall(z, x - 0.85, x + 0.85, n);
      else if (c === '+' || c === '-' || c === 'x') gates.push({ z, x, op: c, n, row: ri, done: false });
      else if (c === 'c') snips.push({ z, x, n, row: ri, done: false });
    });
    rowEnd.push(z - len + 1);
    z -= len + GAP;
  });
  return z;
}
const labelTex = (text, bg, fg = '#fff', w = 256, h = 128, font = 84) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.fillStyle = fg; x.font = `800 ${font}px "Baloo 2", system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeText(text, w / 2, h / 2 + 4); x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const goldMat = glossy('#ffc93c', { emissive: '#b86e00', emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.25 });
function buildDeepProps() {
  for (const g of gates) {
    const good = g.op !== '-', col = good ? (g.op === 'x' ? '#7b5cff' : '#1fb5ff') : '#ff3b5c';
    const grp = new THREE.Group(); grp.position.set(g.x, 0, g.z); world.add(grp);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide })); panel.position.y = 1.6; grp.add(panel);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: labelTex((g.op === 'x' ? '×' : g.op) + g.n, null), transparent: true, depthWrite: false })); lab.position.set(0, 2.55, 0.02); grp.add(lab);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.3, 0.12), glossy(col)); p.position.set(sx * 0.8, 1.65, 0); grp.add(p); }
    g.grp = grp; g.panel = panel;
  }
  for (const c of snips) {
    const grp = new THREE.Group(); grp.position.set(c.x, 0, c.z); world.add(grp);
    const y = c.n * BH + 0.02;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, y + 0.5, 0.16), glossy('#3a3a4a')); p.position.set(sx * 0.82, (y + 0.5) / 2, 0); grp.add(p); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.64, 8), new THREE.MeshBasicMaterial({ color: '#ff2d55' })); beam.rotation.z = Math.PI / 2; beam.position.y = y; grp.add(beam);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.64, 10), new THREE.MeshBasicMaterial({ color: '#ff6b8a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.z = Math.PI / 2; halo.position.y = y; grp.add(halo);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: labelTex('✂' + c.n, null, '#ffd0da'), transparent: true, depthWrite: false })); lab.position.set(0, y + 0.45, 0); grp.add(lab);
    c.grp = grp; c.halo = halo;
  }
  for (const it of items) if (it.kind === 'gold') { it.m = new THREE.Mesh(shoeGeo, goldMat); it.m.castShadow = true; it.m.scale.setScalar(1.5); world.add(it.m); }
  for (const w of walls) if (w.slide !== undefined) {   // a sliding wall: a number on top so you know its height
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: labelTex(String(w.k), null), transparent: true, depthWrite: false })); lab.position.set(0, w.k * BH + 0.35, w.z); w.m.add(lab);
  }
  const r = solve(LV.rows); starAt = starSteps(r.ok ? r.best : 6); plan = solvePath(LV.rows);
}
function podiumStars() {     // ★ flags on the steps that earn the 2nd and 3rd star
  starAt.forEach((si, k) => {
    const st = steps[Math.min(si, steps.length - 1)]; if (!st) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(k ? '★★★' : '★★', null, '#ffd23f', 256, 96, 70), depthWrite: false }));
    sp.scale.set(2.2, 0.82, 1); sp.position.set(TW / 2 - 0.9, st.y + 0.75, st.z + 0.2); world.add(sp); starFx.push({ sp, si, k, hit: false });
  });
}
let lastN = 0;
function hud() { const he = $('heels'); if (G.n > lastN && he.animate) he.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 160 + Math.min(200, combo * 30), easing: 'ease-out' }); lastN = G.n; he.textContent = '👠 ' + G.n; $('gems').textContent = '💎 ' + (total + gems); }

// ---------------------------------------------------------------- input
let dragging = false, botX = null;
input({
  onDown() { if (state === 'play') { dragging = true; botX = null; A.input(); } },
  onMove(dx) { if (state === 'play' && dragging) G.tx = clamp(G.tx + dx * 0.02, -TW / 2 + 0.45, TW / 2 - 0.45); },
  onUp() { dragging = false; },
  onTap(e) { if (state === 'play') { botX = null; G.tx = clamp(G.tx + (e.clientX < innerWidth / 2 ? -1.7 : 1.7), -TW / 2 + 0.45, TW / 2 - 0.45); } },   // tap a side = step one lane that way
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on the first run, until the first
// real touch, she steps lane to lane like a tap does (left, middle, right) and scoops up the side shoes, then back to the middle
const D = demo(null, { ready: () => state === 'play' && level === 1 && G && !G.rail && G.climb < 0 && !G.fall, ms: 4000 });
let demoed = false;
function demoSteer(t) {
  if (D.on && !dragging) { demoed = true; G.tx = [0, -1.7, 0, 1.7][Math.floor(t * 0.9) % 4]; }
  else if (demoed) { demoed = false; if (!D.touched) G.tx = 0; }
}
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; if (!DEEP) ST.set('level', level); buildLevel(); state = 'play'; }
  else { buildLevel(); state = 'play'; }
});

// ---------------------------------------------------------------- events
function shed(k, z, fx = 0) {      // k blocks fall off each heel
  for (let s = 0; s < 2; s++) for (let j = 0; j < k; j++) debris.push({ x: G.x + (s ? 0.13 : -0.13), y: BH * (j + 0.5), z: z + 0.3, vx: (s ? 0.03 : -0.03) + fx, vy: 0.05 + Math.random() * 0.05, vz: 0.05, r: 0, s: (Math.random() - 0.5) * 0.3, c: j % 2 });
}
let lossLv = 0, lossRun = 0;
function lose(t, line) { if (state !== 'play') return; state = 'lost'; if (lossLv === level) lossRun++; else { lossLv = level; lossRun = 1; } F.level(false, clamp(G.z / podiumZ, 0, 1)); sfx.fail(); buzz([50, 30, 80]); ui.flash(0.4); ui.lose(t, DEEP && line ? line : `${gems} 💎 this run`); if (DEEP) deepLose(); }
function win() {
  if (state !== 'play') return;
  state = 'won'; F.level(true); WB.submit(1); const pts = Math.round(gems * mult) + Math.round(mult * 10); total += pts; SV.set('gems', total); best = Math.max(best, mult); SV.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1); hud();
  confetti(world, new THREE.Vector3(G.x, G.y + 3, G.z - 1), 120); setTimeout(() => confetti(world, new THREE.Vector3(G.x, G.y + 3, G.z - 1), 80), 300);
  ui.win(level, `x${mult.toFixed(1)} podium · +${pts} 💎`);
  if (DEEP) { ui.pop('x' + mult.toFixed(1) + '!', '#ffd23f', 64, 60); shk = 0.6; [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'square', 0.07, 1), i * 70)); setTimeout(() => confetti(world, new THREE.Vector3(G.x - 2, G.y + 3, G.z - 1), 60), 600); setTimeout(() => confetti(world, new THREE.Vector3(G.x + 2, G.y + 3, G.z - 1), 60), 900); }
  if (DEEP) deepWin(pts);
}

// ---------------------------------------------------------------- v2: events, feel, meta, map
const worldOf = lv => Math.min(WORLDS.length, Math.ceil(Math.min(lv, LEVELS.length) / PER_WORLD));
const hardOf = lv => lv <= LEVELS.length && !!LEVELS[lv - 1].hard;
const nameOf = lv => lv <= LEVELS.length ? LEVELS[lv - 1].n : 'Encore ' + (lv - LEVELS.length);
const LOOKS = [   // the closet: stars unlock looks (cosmetic only)
  { name: 'Runway', stars: 0, skirt: '#ff4fa3', top: '#ffffff', hair: '#5a2d1a' },
  { name: 'Lemonade', stars: 5, skirt: '#ffc93c', top: '#fff6d6', hair: '#3a2210' },
  { name: 'Mint', stars: 12, skirt: '#2fcf98', top: '#eafff6', hair: '#2b1a10' },
  { name: 'Ocean', stars: 20, skirt: '#3a86ff', top: '#e2ecff', hair: '#d9a441' },
  { name: 'Grape', stars: 30, skirt: '#7b5cff', top: '#f2ecff', hair: '#1f1a2e' },
  { name: 'Cherry', stars: 42, skirt: '#e8253c', top: '#24242c', hair: '#f2d16b' },
  { name: 'Noir', stars: 56, skirt: '#202028', top: '#ff4fa3', hair: '#e44f9a' },
  { name: 'Sunset', stars: 72, skirt: '#ff7a2a', top: '#ffe2c8', hair: '#7a2c12' },
  { name: 'Starlight', stars: 90, skirt: '#c3ccff', top: '#ffffff', hair: '#f4f4ff' },
];
const HEELS = [   // the gem jar: every full jar opens one at random
  { name: 'Bubblegum', c: ['#ff4fa3', '#ff86c2'] }, { name: 'Candy', c: ['#ff4d6d', '#ffffff'] }, { name: 'Lime', c: ['#8be03a', '#d8ff9e'] },
  { name: 'Sky', c: ['#29b6ff', '#bfe9ff'] }, { name: 'Gold', c: ['#ffc93c', '#fff1a8'] }, { name: 'Grape', c: ['#7b5cff', '#c9b8ff'] },
  { name: 'Zebra', c: ['#202028', '#ffffff'] }, { name: 'Lava', c: ['#ff5a1f', '#ffd23f'] }, { name: 'Ice', c: ['#bfefff', '#ffffff'] },
  { name: 'Rainbow', c: ['#ff4d6d', '#ff8c42', '#ffd23f', '#9ef01a', '#29b6ff', '#7b5cff'] },
];
const JAR = 150;
const totalStars = () => Object.values(starsBy).reduce((a, b) => a + b, 0);
const nextLook = () => LOOKS.find(l => l.stars > totalStars());
function dress() {
  if (!DEEP) return;
  const L0 = LOOKS[lookI] || LOOKS[0]; girl.mats.skirt.color.set(L0.skirt); girl.mats.top.color.set(L0.top); girl.mats.hair.color.set(L0.hair);
  const hc = (HEELS[heelI] || HEELS[0]).c, C = new THREE.Color();
  for (let i = 0; i < 140; i++) heels.setColorAt(i, C.set(hc[i % hc.length])); heels.instanceColor.needsUpdate = true;
}
function shoeCombo(it) {
  combo = lt - comboT < 0.45 ? combo + 1 : 1; comboT = lt;
  const got = items.filter(o => o.col === it.col && o.got).length;
  if (got === it.colN && it.colN >= 3) {
    perfect++; pTot++; tone(1047, 0.12, 'triangle', 0.1, 1.2); setTimeout(() => tone(1319, 0.14, 'triangle', 0.1, 1.2), 70);
    burst(world, new THREE.Vector3(G.x, G.n * BH + 0.5, G.z - 0.5), ['#ffd23f', '#ff4fa3', '#ffffff'], 16, { speed: 0.13, up: 0.1, size: 0.7, shape: 'sphere' });
    if (perfect >= 3 && fever <= 0) { fever = 6; ui.pop('RUNWAY FEVER!', '#ffd23f', 50, 26); ui.flash(0.3); buzz([20, 30, 20, 30]); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'square', 0.07, 1), i * 60)); }
    else ui.pop(perfect > 1 ? `PERFECT ×${perfect}` : 'PERFECT!', '#ffd23f', 40 + Math.min(4, perfect) * 3, 30);
  } else if (combo >= 8 && fever <= 0) { fever = 6; ui.pop('SHOE FEVER! ×2 💎', '#ffd23f', 50, 26); ui.flash(0.3); buzz([20, 30, 20, 30]); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'square', 0.07, 1), i * 60));
  } else { ui.pop('+' + combo + ' 👠', combo >= 5 ? '#ffd23f' : '#ff2d8a', 28 + Math.min(20, combo * 3), 34); buzz(Math.min(30, 6 + combo * 4)); if (combo < 2) { tone(420 + Math.min(G.n, 30) * 12, 0.08, 'triangle', 0.08, 1.15); burst(world, new THREE.Vector3(G.x, G.n * BH + 0.5, G.z - 0.3), ['#ff4fa3', '#ffffff'], 4, { speed: 0.08, up: 0.1, size: 0.5, shape: 'sphere' }); G.hop = Math.max(G.hop || 0, 0.15); } if (combo >= 2) { tone(500 + combo * 80, 0.09 + combo * 0.008, 'triangle', Math.min(0.14, 0.07 + combo * 0.01), 1.2); if (combo >= 4) burst(world, new THREE.Vector3(G.x, G.n * BH + 0.6, G.z - 0.4), ['#ffd23f', '#ff4fa3'], 6 + combo, { speed: 0.1, up: 0.1, size: 0.6, shape: 'sphere' }); G.hop = Math.max(G.hop || 0, Math.min(0.7, combo * 0.1)); } }
}
function goldHit(it) {
  G.n = Math.min(60, G.n + 3); hud(); G.hop = 0.8; stopT = 0.06; shk = 0.2;
  [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12, 1), i * 55)); buzz([10, 20, 30]);
  burst(world, new THREE.Vector3(it.x, 0.9, it.z), ['#ffd23f', '#fff1a8', '#ffffff'], 26, { speed: 0.15, up: 0.13, size: 0.8, shape: 'sphere' });
  ui.pop('GOLDEN! +3 👠', '#ffd23f', 44, 30); ui.flash(0.2);
}
function gateHit(g) {
  const before = G.n; let n = g.op === '+' ? before + g.n : g.op === '-' ? Math.max(0, before - g.n) : before * g.n; n = Math.min(60, n);
  if (n < before) shed(before - n, g.z);
  G.n = n; hud(); g.panel.material.opacity = 0.85; g.flash = 1;
  if (n >= before) {
    const d = n - before; G.hop = Math.min(1, 0.3 + d * 0.06);
    ui.pop(g.op === 'x' ? `×${g.n}! +${d} 👠` : `+${d} 👠`, g.op === 'x' ? '#c9b8ff' : '#7fe0ff', 40 + Math.min(16, d), 30);
    [659, 880, 1109].slice(0, g.op === 'x' ? 3 : 2).forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.11, 1.15), i * 60)); buzz([12, 20, 12]);
    burst(world, new THREE.Vector3(g.x, 1.6, g.z), g.op === 'x' ? ['#7b5cff', '#ffffff'] : ['#1fb5ff', '#ffffff'], 14 + d, { speed: 0.12, up: 0.08, size: 0.6 });
    if (g.op === 'x' && d >= 6) { stopT = 0.14; shk = 0.25; camKick = Math.min(5, 1.5 + d * 0.12); ui.pop('+' + d + '!', '#ffffff', 64 + Math.min(24, d), 40); }
  } else { ui.pop(`-${before - n} 👠`, '#ff3b4e', 40, 30); tone(220, 0.25, 'sawtooth', 0.08, 0.5); buzz([40, 20, 40]); shk = 0.3; perfect = 0; }
}
function snipHit(c) {
  if (G.n > c.n) {
    const cut = G.n - c.n; G.n = c.n; hud(); shed(cut, c.z, (Math.random() < 0.5 ? -1 : 1) * 0.05);
    ui.pop(`SNIP! -${cut} 👠`, '#ff6b8a', 40, 30); tone(2400, 0.06, 'square', 0.07, 0.3); tone(1600, 0.12, 'sawtooth', 0.06, 0.4); buzz([30, 15, 30]); shk = 0.3; stopT = 0.05;
    burst(world, new THREE.Vector3(c.x, c.n * BH, c.z), ['#ff2d55', '#ffffff'], 14, { speed: 0.14, up: 0.06, size: 0.5 });
  } else { ui.pop(G.n === c.n ? 'LIMBO! ✂' : 'UNDER!', '#7dffb0', 34, 30); tone(1400, 0.1, 'triangle', 0.09, 1.4); }
}
let camKick = 0;
let metaEl = null, mapEl = null, mapBtn = null, hardEl = null;
if (DEEP) {
  const st = document.createElement('style');
  st.textContent = `.tt-meta{position:fixed;top:calc(96px + env(safe-area-inset-top));left:0;right:0;text-align:center;z-index:5;pointer-events:none;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.tt-meta .nm{font-size:15px;letter-spacing:.5px}.tt-meta .tg{font-size:14px;opacity:.95;margin-top:1px}.tt-meta .tg b{color:#ffd23f}
.hc-card:not(.hc-hidden)~.tt-meta{opacity:0}
.tt-hardb{display:inline-block;background:#e8453c;border-radius:10px;padding:0 8px;margin-left:6px;font-size:12px;vertical-align:2px}
.tt-hard{position:fixed;inset:0;pointer-events:none;z-index:3;box-shadow:inset 0 0 0 6px rgba(232,69,60,.85),inset 0 0 40px rgba(232,69,60,.45)}
.tt-mapbtn{position:fixed;bottom:calc(14px + env(safe-area-inset-bottom));right:12px;width:50px;height:50px;border-radius:50%;border:0;z-index:7;font-size:24px;background:rgba(0,0,0,.25);color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.18);cursor:pointer}
.tt-map{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;padding:calc(16px + env(safe-area-inset-top)) 14px calc(20px + env(safe-area-inset-bottom));overflow-y:auto;background:linear-gradient(180deg,var(--m1),var(--m2));color:#fff}
.tt-map h2{margin:6px 0 0;font-size:30px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.2)}
.tt-map .tot{font-size:18px;font-weight:800;margin:4px 0 8px;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.tt-tabs{display:flex;gap:8px;margin:4px 0 10px}.tt-tabs button{font:inherit;font-weight:800;font-size:15px;border:0;border-radius:18px;padding:6px 14px;background:rgba(0,0,0,.2);color:#fff;cursor:pointer}
.tt-tabs button.on{background:#fff;color:#333}.tt-tabs button.lock{opacity:.45}
.tt-grid{display:grid;grid-template-columns:repeat(4,64px);gap:16px 16px;justify-content:center;margin:6px 0 12px}
.tt-node{position:relative;width:64px;height:64px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:24px;color:#fff;background:var(--ui,#ff4fa3);box-shadow:0 5px 0 rgba(0,0,0,.22);cursor:pointer}
.tt-node.hard{background:#e8453c;box-shadow:0 5px 0 #8f241e,0 0 0 3px #ffd23f}
.tt-node.lock{background:rgba(0,0,0,.2);box-shadow:none;color:rgba(255,255,255,.5);cursor:default}
.tt-node.next{animation:ttn 1s ease-in-out infinite}@keyframes ttn{50%{transform:scale(1.12)}}
.tt-node b{position:absolute;left:0;right:0;bottom:-17px;font-size:13px;letter-spacing:1px;color:#ffd23f;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.tt-node b i,.tt-st i{font-style:normal}.tt-node b i.off,.tt-st i.off{color:rgba(255,255,255,.35)}
.tt-sw{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:360px;margin:8px 0 6px}
.tt-it{width:58px;border:0;background:none;font:inherit;color:#fff;font-weight:800;font-size:12px;cursor:pointer;padding:0;text-shadow:0 1px 0 rgba(0,0,0,.3)}
.tt-it span{display:block;width:46px;height:46px;margin:0 auto 2px;border-radius:14px;box-shadow:0 4px 0 rgba(0,0,0,.2);border:3px solid transparent}
.tt-it.on span{border-color:#fff}.tt-it.lock{opacity:.5;cursor:default}
.tt-jar{width:220px;height:14px;border-radius:8px;background:rgba(0,0,0,.2);overflow:hidden;margin:4px auto}.tt-jar i{display:block;height:100%;background:linear-gradient(90deg,#29b6ff,#7fe0ff);border-radius:8px;transition:width .6s}
.tt-wst{font-size:46px;letter-spacing:6px;line-height:1;margin:2px 0}.tt-wst i{font-style:normal;color:rgba(255,255,255,.3);display:inline-block;transform:scale(.4);transition:transform .25s cubic-bezier(.3,1.8,.5,1),color .1s}
.tt-wst i.on{color:#ffd23f;transform:scale(1)}.tt-wst i.dim{transform:scale(.8)}
.tt-wst i,.tt-node b i,.tt-st i{display:inline-block;width:1em;height:1em;background:currentColor;clip-path:polygon(50% 0,62% 36%,100% 38%,70% 60%,80% 100%,50% 76%,20% 100%,30% 60%,0 38%,38% 36%);margin:0 .06em;vertical-align:-.1em}
.tt-row{display:flex;gap:10px;justify-content:center;margin-top:8px}.tt-small{font-size:18px;padding:10px 18px;background:rgba(0,0,0,.25)}
.tt-unl{font-size:16px!important;opacity:.95;margin:6px 0 0!important}
.tt-chest{position:fixed;inset:0;z-index:25;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(20,10,40,.55);color:#fff;font-weight:800;text-align:center}
.tt-chest .bx{font-size:84px;animation:ttc .7s cubic-bezier(.3,1.8,.5,1)}@keyframes ttc{0%{transform:scale(.2) rotate(-20deg)}100%{transform:scale(1)}}
.tt-chest .sw{width:90px;height:90px;border-radius:24px;margin:10px auto;box-shadow:0 6px 0 rgba(0,0,0,.25);animation:ttc .5s .5s both cubic-bezier(.3,1.8,.5,1)}`;
  document.head.appendChild(st);
  metaEl = Object.assign(document.createElement('div'), { className: 'tt-meta' }); document.body.appendChild(metaEl);
  hardEl = Object.assign(document.createElement('div'), { className: 'tt-hard hc-hidden' }); document.body.appendChild(hardEl);
  mapBtn = Object.assign(document.createElement('button'), { className: 'tt-mapbtn', textContent: '🗺️', type: 'button', ariaLabel: 'Levels' });
  mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
  mapBtn.addEventListener('click', e => { e.stopPropagation(); if (state !== 'play' || G.z > -2 || G.climb >= 0) openMap(); });
  document.body.appendChild(mapBtn);
}
const starRow = (n, max = 3) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? '' : 'off'}"></i>`).join('');
function deepHud() {
  if (!DEEP) return;
  metaEl.innerHTML = `<div class="nm">${level <= LEVELS.length ? level + ' · ' : ''}${nameOf(level)}${hardOf(level) ? '<span class="tt-hardb">HARD</span>' : ''}</div><div class="tg">★★ <b>${starAt[0]}</b>👠 &nbsp; ★★★ <b>${starAt[1]}</b>👠</div>`;
  hardEl.classList.toggle('hc-hidden', !hardOf(level));
  if (hardOf(level) && level > 1) setTimeout(() => { if (state === 'play' && G.z > -6) ui.pop('HARD LEVEL!', '#ff6a5c', 40, 40); }, 300);
}
let mapWorld = 1;
function openMap(w = worldOf(unlocked)) {
  if (!DEEP) return;
  mapWorld = w; state = 'map';
  for (const c of [ui.els.start, ui.els.win, ui.els.lose]) c.classList.add('hc-hidden');
  if (!mapEl) { mapEl = document.createElement('div'); mapEl.className = 'tt-map'; mapEl.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(mapEl); }
  const W0 = WORLDS[w - 1]; mapEl.style.setProperty('--m1', W0.sky[0]); mapEl.style.setProperty('--m2', W0.sky[1]); mapEl.style.setProperty('--ui', W0.sky[2]);
  const first = (w - 1) * PER_WORLD + 1, ts = totalStars(), nl = nextLook();
  let h = `<h2>${W0.name}</h2><div class="tot">★ ${ts} / ${LEVELS.length * 3}${streak ? ` · 🔥 ${streak} day${streak > 1 ? 's' : ''}${lastDay !== dayN() ? ' · play today: +' + Math.min(streak + 1, 5) + '💎' : ''}` : ''}</div><div class="tt-tabs">`;
  WORLDS.forEach((x, i) => { const open = unlocked >= i * PER_WORLD + 1; h += `<button data-w="${i + 1}" class="${i + 1 === w ? 'on' : ''} ${open ? '' : 'lock'}">${open ? '' : '🔒 '}${i + 1}</button>`; });
  h += `</div><div class="tt-grid">`;
  for (let lv = first; lv < first + PER_WORLD; lv++) {
    const open = lv <= unlocked, n = starsBy[lv] || 0;
    h += `<button class="tt-node ${hardOf(lv) ? 'hard' : ''} ${open ? '' : 'lock'} ${lv === unlocked ? 'next' : ''}" data-l="${open ? lv : ''}">${open ? lv : '🔒'}${open && n ? `<b>${starRow(n)}</b>` : ''}</button>`;
  }
  h += `</div>`;
  if (unlocked > LEVELS.length && w === WORLDS.length) h += `<button class="hc-btn" data-l="${unlocked}">Encore ▶ ${unlocked - LEVELS.length}</button>`;
  h += `<div class="tot" style="margin-top:12px">Closet${nl ? ` · ★ ${nl.stars - ts} more for ${nl.name}` : ''}</div><div class="tt-sw">`;
  LOOKS.forEach((l, i) => { const open = ts >= l.stars; h += `<button class="tt-it ${open ? '' : 'lock'} ${lookI === i ? 'on' : ''}" data-o="${open ? i : ''}"><span style="background:linear-gradient(180deg,${l.top} 0 45%,${l.skirt} 45%)"></span>${open ? l.name : '★' + l.stars}</button>`; });
  h += `</div><div class="tot" style="margin-top:10px">Heels · ${heelOwn.length}/${HEELS.length}</div><div class="tt-jar"><i style="width:${Math.round(jar / JAR * 100)}%"></i></div><div style="font-size:13px;font-weight:700;opacity:.9">💎 ${jar}/${JAR} → a new pair</div><div class="tt-sw">`;
  HEELS.forEach((x, i) => { const open = heelOwn.includes(i); h += `<button class="tt-it ${open ? '' : 'lock'} ${heelI === i ? 'on' : ''}" data-h="${open ? i : ''}"><span style="background:${open ? `repeating-linear-gradient(180deg,${x.c.map((c, k) => `${c} ${k * 8}px ${(k + 1) * 8}px`).join(',')})` : 'rgba(0,0,0,.2)'}"></span>${open ? x.name : '?'}</button>`; });
  h += `</div><button class="hc-btn" style="margin-top:12px" data-l="${Math.min(unlocked, w * PER_WORLD)}">PLAY ▶</button>`;
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden'); mapBtn.classList.add('hc-hidden');
  mapEl.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const x = +b.dataset.w; if (unlocked >= (x - 1) * PER_WORLD + 1) { sfx.tap(); openMap(x); } });
  mapEl.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const lv = +b.dataset.l; if (lv) { sfx.tap(); playLevel(lv); } });
  mapEl.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { if (b.dataset.o === '') return; lookI = +b.dataset.o; DS.set('look', lookI); dress(); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(mapWorld); });
  mapEl.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { if (b.dataset.h === '') return; heelI = +b.dataset.h; DS.set('heel', heelI); dress(); tone(1100, 0.08, 'triangle', 0.1, 1.3); openMap(mapWorld); });
}
function playLevel(lv) {
  level = lv; if (mapEl) mapEl.classList.add('hc-hidden'); mapBtn.classList.remove('hc-hidden');
  for (const c of [ui.els.start, ui.els.win, ui.els.lose]) c.classList.add('hc-hidden');
  WB.start(); buildLevel(); state = 'play';
}
function cardBtns(card, html, fns) {
  const hint = card.querySelector('.hint'); hint.innerHTML = html; hint.style.animation = 'none';
  for (const [sel, fn] of fns) { const b = hint.querySelector(sel); if (!b) continue; b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); card.classList.add('hc-hidden'); fn(); }); }
}
function deepWin(pts) {
  const lv = level, n = G.climb >= starAt[1] ? 3 : G.climb >= starAt[0] ? 2 : 1, before = totalStars();
  if (n > (starsBy[lv] || 0)) { starsBy[lv] = n; DS.set('stars', starsBy); }
  if (lv + 1 > unlocked) { unlocked = lv + 1; DS.set('unlocked', unlocked); }
  const got = LOOKS.filter(l => l.stars > before && l.stars <= totalStars()), nl = nextLook();
  if (got.length) { lookI = LOOKS.indexOf(got[got.length - 1]); DS.set('look', lookI); }
  let chest = null; jar += pts;
  if (lastDay !== dayN()) { streak = (dayN() - lastDay === 1 ? streak : 0) + 1; lastDay = dayN(); jar += Math.min(streak, 5); DS.set('streak', streak); DS.set('lastday', lastDay); }
  if (jar >= JAR || (lv === 2 && heelOwn.length === 1)) { jar = Math.max(0, jar - JAR); const left = HEELS.map((_, i) => i).filter(i => !heelOwn.includes(i)); if (left.length) { chest = left[Math.floor(Math.random() * left.length)]; heelOwn.push(chest); heelI = chest; DS.set('heelown', heelOwn); DS.set('heel', heelI); } }
  DS.set('jar', jar);
  const card = ui.els.win;
  let sx = card.querySelector('.tt-wst'); if (!sx) { sx = document.createElement('div'); sx.className = 'tt-wst'; card.querySelector('h1').after(sx); }
  sx.innerHTML = '<i></i><i></i><i></i>';
  [0, 1, 2].forEach(i => setTimeout(() => { const el = sx.children[i]; if (!el) return; if (i < n) { el.classList.add('on'); tone(660 + i * 220, 0.14, 'triangle', 0.12, 1.2); buzz(12); } else el.classList.add('dim'); }, 900 + i * 260));
  let un = card.querySelector('.tt-unl'); if (!un) { un = document.createElement('p'); un.className = 'tt-unl'; card.querySelector('[data-x]').after(un); }
  const bestN = Math.max(G.n, +(DS.get('bestn_' + lv, 0))); if (G.n >= +(DS.get('bestn_' + lv, 0))) DS.set('bestn_' + lv, G.n);
  const miss = n < 3 ? `${starAt[n === 1 ? 0 : 1] - G.climb} more 👠 for ${n === 1 ? '★★' : '★★★'} · ` : '';
  un.innerHTML = `<div>${G.n} 👠 · best ${bestN}${pTot ? ' · ' + pTot + ' PERFECT' : ''}</div>` + (got.length ? `New look: ${got[got.length - 1].name}!` : `${miss ? `<div>${miss.replace(' · ', '')}</div>` : ''}${nl ? `★ ${nl.stars - totalStars()} → ${nl.name} look` : ''}`) + `<div class="tt-jar"><i style="width:${Math.round(jar / JAR * 100)}%"></i></div><div style="font-size:13px;font-weight:800;${JAR - jar <= JAR * 0.3 ? 'color:#ffd23f;animation:ttp .7s infinite alternate' : 'opacity:.85'}">💎 ${JAR - jar} to new heels</div><style>@keyframes ttp{to{transform:scale(1.08)}}</style>`;
  cardBtns(card, `<span class="hc-btn">${lv + 1 <= LEVELS.length ? 'LEVEL ' + (lv + 1) : 'NEXT'} ▶</span><div class="tt-row"><button class="hc-btn tt-small" data-r>↺</button><button class="hc-btn tt-small" data-m>🗺️</button></div>`,
    [['[data-r]', () => playLevel(lv)], ['[data-m]', () => openMap(worldOf(lv + 1))]]);
  if (chest !== null) setTimeout(() => openChest(chest), 1900);
  else if (lv % PER_WORLD === 0 && lv < LEVELS.length) setTimeout(() => ui.pop(`${WORLDS[worldOf(lv + 1) - 1].name} open!`, '#ffd23f', 34, 14), 1600);
}
function openChest(i) {
  const d = document.createElement('div'); d.className = 'tt-chest';
  const x = HEELS[i];
  d.innerHTML = `<div class="bx">🎁</div><div style="font-size:30px">NEW HEELS!</div><div class="sw" style="background:repeating-linear-gradient(180deg,${x.c.map((c, k) => `${c} ${k * 12}px ${(k + 1) * 12}px`).join(',')})"></div><div style="font-size:24px">${x.name}</div>`;
  d.addEventListener('pointerdown', e => { e.stopPropagation(); d.remove(); });
  document.body.appendChild(d); dress();
  [523, 659, 784, 1047, 1319].forEach((f, k) => setTimeout(() => tone(f, 0.16, 'triangle', 0.12, 1), 450 + k * 70)); buzz([20, 30, 20, 30, 40]);
  setTimeout(() => d.remove(), 3200);
}
function deepLose() {
  const c = ui.els.lose;
  cardBtns(c, `<span class="hc-btn">RETRY ↺</span><div class="tt-row"><button class="hc-btn tt-small" data-m>🗺️</button></div>`, [['[data-m]', () => openMap(worldOf(level))]]);
  const t0 = performance.now();
  c.onpointerdown = e => { if (state === 'lost' && performance.now() - t0 > 500 && !e.target.closest('button')) { c.classList.add('hc-hidden'); playLevel(level); } };
}
function deepFrame(dt, t) {
  if (shk > 0) { camera.position.x += (Math.random() - 0.5) * shk; camera.position.y += (Math.random() - 0.5) * shk * 0.6; shk = Math.max(0, shk - 0.035 * dt); }
  for (const it of items) if (it.m && !it.got) { it.m.position.set(it.x, 0.3 + Math.sin(t * 4 + it.z) * 0.12, it.z); it.m.rotation.y = t * 3; }
  for (const c of snips) if (c.halo) c.halo.material.opacity = 0.25 + Math.sin(t * 10 + c.z) * 0.15;
  for (const g of gates) if (g.flash) { g.flash = Math.max(0, g.flash - 0.04 * dt); g.grp.scale.setScalar(1 + g.flash * 0.25); }
  for (const f of starFx) if (f.hit) { f.t += dt / 60; const k = 1 + Math.max(0, 0.6 - f.t) * 1.2; f.sp.scale.set(2.2 * k, 0.82 * k, 1); }
  if (fever > 0) {
    fever -= dt / 60; heels.material.emissive.set('#ffb000'); heels.material.emissiveIntensity = 0.35 + Math.sin(t * 14) * 0.2;
    if (Math.random() < 0.25 * dt && G.n) burst(world, new THREE.Vector3(G.x + (Math.random() - 0.5) * 0.5, G.y - Math.random() * G.n * BH, G.z + 0.3), ['#ffd23f', '#ffffff'], 2, { speed: 0.03, up: 0.03, size: 0.4 });
    if (fever <= 0) { heels.material.emissiveIntensity = 0; perfect = 0; }
  }
}

// ---------------------------------------------------------------- frame
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
let pitchI = 0;
loop((dt, t) => {
  if (!G) return;
  const s = dt / 60, play = state === 'play';
  if (play) A.tick(s);
  if (play && G.climb < 0 && !G.fall) {
    lt += s;
    if (stopT > 0) stopT -= s; else G.z -= SPEED * A.k() * s;
    for (const w of walls) if (w.slide !== undefined) { w.off = Math.sin(lt * 1.8 + w.slide) * 1.7; w.m.position.x = w.off; }
    const rail = rails.find(r => G.z < r.z0 && G.z > r.z1);
    if (rail && !G.rail) {
      G.rail = rail; G.tx = 0;
      const reach = 0.98 + G.n * BH;
      const short = reach * 2 < rail.gap - 0.2, lucky = short && A.rescue();
      if (lucky) { ui.pop('STRETCH! 🍀', '#7dffb0', 40, 30); sfx.coin(); buzz([10, 30, 10]); }
      else if (!short) { if (reach * 2 < rail.gap + BH) A.near(); else A.ok(); }
      if (short && !lucky) { A.miss(2); G.fall = 1; G.vy = 0; tone(600, 0.5, 'sine', 0.12, 0.3); buzz([60, 40, 60]); ui.pop(DEEP && rail.need - G.n === 1 ? 'SO CLOSE!' : 'TOO SHORT!', '#ff3b4e', 38, 30); const had = G.n; setTimeout(() => lose('FELL OFF!', `Rails need ${rail.need} 👠 · you had ${had}${rail.need - had === 1 ? ' · 1 short!' : ''}`), 700); }
      else if (DEEP && G.n === rail.need) { ui.pop('JUST MADE IT!', '#ffd23f', 40, 30); sfx.coin(); buzz([15, 20, 15]); stopT = 0.12; shk = 0.25; }
      else { ui.pop('SPLITS!', '#fff', 40, 30); sfx.coin(); buzz(15); }
    }
    if (!rail && G.rail) { G.rail = null; ui.pop('NAILED IT!', '#fff', 32, 30); }
    demoSteer(t);
    if (!G.rail) { if (botX !== null && !dragging) G.tx = lerp(G.tx, botX, 0.3 * dt); G.x = lerp(G.x, G.tx, 0.2 * dt); }
    else G.x = lerp(G.x, 0, 0.2 * dt);
    // walls
    for (const w of walls) {
      if (w.done || G.z > w.z + 0.35) continue;
      w.done = true;
      const wo = w.off || 0;
      if (G.x + 0.28 < w.x0 + wo || G.x - 0.28 > w.x1 + wo) { if (w.slide !== undefined && DEEP) { ui.pop('DODGED!', '#7dffb0', 30, 30); tone(1200, 0.08, 'triangle', 0.08, 1.4); } continue; }
      if (G.n < w.k && A.rescue()) {   // lucky: the top bricks were loose — the wall crumbles down to her heel height
        const keep = G.n; w.k = keep; w.m.count = w.n * keep; burst(world, new THREE.Vector3(G.x, (keep + 1) * BH, w.z), ['#ff4d4d', '#ffffff', '#7dffb0'], 18, { speed: 0.12, up: 0.1 }); ui.pop('LUCKY! 🍀', '#7dffb0', 40, 40);
      }
      if (w.k === 0) { G.hop = 1; continue; }
      if (G.n >= w.k) { if (G.n - w.k <= 1) A.near(); else A.ok(); G.n -= w.k; shed(w.k, w.z); G.hop = 1; sfx.smash(); buzz([20, 10, 20]); ui.pop(DEEP && G.n === 0 ? 'PHEW! 0 left' : '-' + w.k + ' 👠', '#ff3b4e', 34, 30); burst(world, new THREE.Vector3(G.x, w.k * BH, w.z), ['#ff4d4d', '#ffffff'], DEEP ? 10 + w.k * 5 : 12, { speed: DEEP ? 0.16 : 0.1, up: 0.08 }); hud();
        if (DEEP) { stopT = 0.05 + Math.min(0.05, w.k * 0.01); shk = Math.min(0.5, 0.12 + w.k * 0.04); tone(110 - w.k * 5, 0.18, 'square', 0.08, 0.5); } }
      else { A.miss(2); G.z = w.z + 0.45; const had = G.n; shed(G.n, w.z); G.n = 0; hud(); sfx.smash(); ui.flash(0.4); shk = DEEP ? 0.6 : 0; return lose('BONK!', `Wall ${w.k} · you had ${had} 👠${w.k - had === 1 ? ' · 1 short!' : ''}`); }
    }
    for (const g of gates) { if (g.done || G.z > g.z + 0.2) continue; g.done = true; if (Math.abs(G.x - g.x) > 0.85 || gates.some(o => o.row === g.row && o.hit)) continue; g.hit = true; gateHit(g); }
    for (const c of snips) { if (c.done || G.z > c.z + 0.2) continue; c.done = true; if (Math.abs(G.x - c.x) > 0.85 || snips.some(o => o.row === c.row && o.hit)) continue; c.hit = true; snipHit(c); }
    // pickups
    for (const it of items) {
      if (it.kind === 'shoe' && !it.got && !it.missed && it.z > G.z + 0.6 && Math.abs(it.x - G.x) < 1.8) { it.missed = true; A.near(0.15); if (DEEP && items.some(o => o.col === it.col && o.got)) perfect = 0; }   // a shoe slipped past nearby
      if (it.got || Math.abs(it.z - G.z) > 0.6) continue;
      if (it.kind === 'shoe' && Math.abs(it.x - G.x) < 0.75) { it.got = true; A.ok(0.25); G.n = Math.min(60, G.n + 1); note(64 + (pitchI++ % 12) * 1, 0.16, 0.12); buzz(6); burst(world, new THREE.Vector3(it.x, 0.6, it.z), ['#ff4fa3', '#ffffff'], 8, { speed: 0.08, up: 0.07, size: 0.6 }); if (DEEP) shoeCombo(it); else ui.pop('+1 👠', '#ff2d8a', 30, 34); hud(); }
      else if (it.kind === 'gold' && Math.abs(it.x - G.x) < 0.8) { it.got = true; it.m.visible = false; goldHit(it); }
      else if (it.kind === 'gem' && (it.rail ? true : Math.abs(it.x - G.x) < 0.75)) { it.got = true; gems += fever > 0 ? 2 : 1; sfx.coin(); buzz(4); burst(world, new THREE.Vector3(it.x, 0.6, it.z), fever > 0 ? ['#ffd23f', '#29b6ff'] : '#29b6ff', 6, { speed: 0.06, up: 0.06, size: 0.5 }); hud(); }
    }
    ui.progress(Math.min(0.92, G.z / podiumZ * 0.92));
    if (G.z < podiumZ + 0.6) { G.climb = 0; G.x = lerp(G.x, 0, 0.5); pitchI = 0; }
  } else if (play && G.climb >= 0) {
    // podium: every step eats one block from each heel
    const st = steps[G.climb];
    G.z = lerp(G.z, st.z, 0.2 * dt); G.x = lerp(G.x, 0, 0.1 * dt);
    if (Math.abs(G.z - st.z) < 0.1) {
      mult = st.m;
      if (G.n > 0 && G.climb < steps.length - 1) { G.n--; shed(1, st.z); G.climb++; note(60 + [0, 2, 4, 5, 7, 9, 11, 12][G.climb % 8] + Math.floor(G.climb / 8) * 12, 0.2, 0.13); buzz(8); ui.pop('x' + steps[G.climb].m.toFixed(1), '#fff', 38 + Math.min(20, G.climb), 30); hud();
        for (const f of starFx) if (!f.hit && G.climb >= f.si) { f.hit = true; f.t = 0; ui.pop(f.k ? '★★★!' : '★★', '#ffd23f', 54, 26); [784, 988, 1175].slice(0, f.k + 2).forEach((fq, i) => setTimeout(() => tone(fq, 0.16, 'triangle', 0.12, 1.1), i * 70)); buzz([15, 30, 15]); burst(world, new THREE.Vector3(TW / 2 - 0.9, steps[f.si].y + 0.8, steps[f.si].z), ['#ffd23f', '#ffffff'], 20, { speed: 0.12, up: 0.1, size: 0.7, shape: 'sphere' }); shk = 0.2; } }
      else return win();
    }
    ui.progress(0.92 + G.climb / steps.length * 0.08);
  }
  // falling off rails
  if (G.fall) { G.vy -= 0.012 * dt; G.y += G.vy * dt; girl.rotation.z += 0.05 * dt; }
  // heel stack spring
  G.dn = lerp(G.dn, G.n, 0.25 * dt);
  const base = G.climb >= 0 ? steps[G.climb].y : 0;
  const onRail = !!G.rail && !G.fall;
  G.hop = Math.max(0, G.hop - 0.05 * dt);
  const stackH = G.dn * BH;
  if (!G.fall) G.y = lerp(G.y, onRail ? 0.05 : base + stackH + Math.sin(G.hop * Math.PI) * 0.6, 0.3 * dt);
  // pose
  G.ph += s * (play ? 9 : 0);
  const sw = Math.sin(G.ph);
  girl.position.set(G.x, G.y, G.z);
  if (onRail || (G.fall && G.rail)) {
    girl.legL.rotation.set(0, 0, -1.5); girl.legR.rotation.set(0, 0, 1.5); girl.armL.rotation.set(0, 0, -1.2 + Math.sin(t * 6) * 0.15); girl.armR.rotation.set(0, 0, 1.2 - Math.sin(t * 6) * 0.15);
    girl.inner.position.y = lerp(girl.inner.position.y, -1.0, 0.3 * dt); girl.inner.rotation.z = Math.sin(t * 3) * 0.06;
  } else if (state === 'won') {
    endT += s; girl.legL.rotation.set(0, 0, 0); girl.legR.rotation.set(0, 0, 0); girl.armL.rotation.set(0, 0, -2.7 - Math.sin(endT * 9) * 0.25); girl.armR.rotation.set(0, 0, 2.7 + Math.sin(endT * 9) * 0.25); girl.inner.position.y = Math.abs(Math.sin(endT * 6)) * 0.12; girl.rotation.y = lerp(girl.rotation.y, Math.PI, 0.05 * dt);
  } else {
    const a = play ? 0.32 : 0.05;
    girl.legL.rotation.set(sw * a, 0, 0); girl.legR.rotation.set(-sw * a, 0, 0); girl.armL.rotation.set(-sw * 0.5 * a * 2, 0, -0.15); girl.armR.rotation.set(sw * 0.5 * a * 2, 0, 0.15);
    girl.inner.position.y = lerp(girl.inner.position.y, 0, 0.3 * dt); girl.inner.rotation.z = Math.sin(G.ph) * 0.06 * (play ? 1 : 0); girl.inner.rotation.y = Math.sin(G.ph) * 0.12 * (play ? 1 : 0);
    girl.pony.rotation.z = Math.sin(G.ph) * 0.3;
  }
  // heel stack instances
  let k = 0; const nn = Math.round(G.dn);
  for (const sgn of [-1, 1]) {
    const leg = sgn < 0 ? girl.legL : girl.legR, a = leg.rotation.x;
    for (let j = 0; j < nn && k < 120; j++) {
      if (onRail || (G.fall && G.rail)) M4.compose(V.set(G.x + sgn * (1.0 + (j + 0.5) * BH), G.y + 0.04, G.z), Q.setFromEuler(E.set(0, 0, Math.PI / 2)), S.set(1, 1, 1));
      else M4.compose(V.set(G.x + sgn * 0.12 + Math.sin(girl.inner.rotation.y) * 0, G.y - (j + 0.5) * BH, G.z - Math.sin(a) * 0.95), Q.identity(), S.set(1, 1, 1));
      heels.setMatrixAt(k++, M4);
    }
  }
  for (const d of debris) { d.vy -= 0.008 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt * 0.3; d.r += d.s * dt; if (d.y < BH / 2 && Math.abs(d.x) < TW / 2 && !rails.some(r => d.z < r.z0 && d.z > r.z1)) { d.y = BH / 2; d.vy = Math.abs(d.vy) * 0.25; d.vx *= 0.7; } if (k < 140) { M4.compose(V.set(d.x, d.y, d.z), Q.setFromEuler(E.set(d.r, 0, d.r * 0.6)), S.set(1, 1, 1)); heels.setMatrixAt(k++, M4); } }
  if (debris.length > 40) debris.splice(0, debris.length - 40);
  heels.count = k; heels.instanceMatrix.needsUpdate = true;
  // pickups spin
  for (const it of items) {
    const sc = it.got ? 0 : 1, mesh = it.kind === 'shoe' ? pickMesh : gemMesh;
    M4.compose(V.set(it.x, (it.kind === 'gem' ? 0.7 : 0.15) + Math.sin(t * 3 + it.z) * 0.08 + (it.rail ? 0.3 : 0), it.z), Q.setFromEuler(E.set(0, t * 2.2 + it.z, 0)), S.setScalar(sc * (it.kind === 'shoe' ? 1.15 : 1)));
    mesh.setMatrixAt(it.i, M4);
  }
  pickMesh.instanceMatrix.needsUpdate = true; gemMesh.instanceMatrix.needsUpdate = true;
  // camera: behind + above, rising with the heel stack
  const top = G.y + 2;
  camY = lerp(camY, Math.max(top, 2.6) + 2.6, 0.06 * dt);
  camKick *= Math.pow(0.97, dt);
  const back = 6.5 + Math.max(0, G.y) * 0.45 + Math.min(4, G.n * 0.08) + camKick + (state === 'won' ? 1.5 : 0);
  camera.position.set(G.x * 0.4 + (state === 'won' ? Math.sin(endT * 0.6) * 4 : 0), camY, G.z + back);
  camera.lookAt(G.x * 0.4, Math.max(G.y * 0.55, 0) + 0.8, G.z - 5);
  if (DEEP) deepFrame(dt, t);
  followLight(V.set(G.x, G.y, G.z - 2));
  scenery.position.z = G.z * 0.6;
});

dress();
buildLevel();

window.__game = {
  get deep() { return DEEP; }, get stars() { return DEEP ? { by: starsBy, total: totalStars(), at: starAt, climb: G && G.climb } : null; }, get heels() { return G && G.n; },
  get state() { return state; }, get level() { return level; }, get score() { return total + gems; }, get adapt() { return A.state; },
  bot() {
    if (state !== 'play' || G.rail || G.climb >= 0) return; A.input();
    if (DEEP && plan) {
      const i = rowEnd.findIndex(z => z < G.z - 0.2); if (i < 0) return;
      for (let j = i; j < plan.length; j++) {
        if (plan[j] !== null) { botX = LANES[plan[j]]; return; }
        if (LV.rows[j][0] === 'M') { const w = walls.find(o => o.slide !== undefined && Math.abs(o.z - rowZ[j]) < 0.01); const tt = (G.z - w.z) / SPEED, off = Math.sin((lt + tt) * 1.8 + w.slide) * 1.7; botX = off > 0 ? LANES[0] : LANES[2]; return; }
      }
      return;
    }
    let bx = G.x, bs = -1e9;
    for (let x = -TW / 2 + 0.5; x <= TW / 2 - 0.5; x += 0.25) {
      let sc = -Math.abs(x - G.x) * 0.25;
      for (const it of items) if (!it.got && !it.rail && it.z < G.z && it.z > G.z - 16 && Math.abs(it.x - x) < 0.6) sc += it.kind === 'shoe' ? 4 : 1;
      let n = G.n;
      for (const w of walls) { if (w.done || w.z > G.z || w.z < G.z - 14) continue; if (x + 0.35 > w.x0 && x - 0.35 < w.x1) { if (n < w.k) sc -= 200; else { sc -= w.k * 3; n -= w.k; } } }
      if (sc > bs) { bs = sc; bx = x; }
    }
    botX = bx;
  },
};

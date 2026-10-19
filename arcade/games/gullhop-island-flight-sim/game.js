// Gullhop — original arcade flight game. Fly a toy plane piloted by a goggled gull over a sunny island chain:
// ring runs, runway landings, crate drops and paint-blaster dogfights with buzzing drones. All art built in code.
import { THREE, createStage, createUI, loop, store, mat, rounded, burst, confetti, sfx, tone, note, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { bake, vcMat } from './bake.js';

const NAME = 'Gullhop: Island Flight Sim';
const S = store('gullhop');
const F = flow('gullhop');
let level = S.get('level', 1), best = S.get('best', 0), cleared = S.get('cleared', 0), starsBy = S.get('stars', {});
let planeId = S.get('plane', 0), liveryId = S.get('livery', 0), pilotMode = S.get('pilot', 0);
const totalStars = () => Object.values(starsBy).reduce((a, b) => a + b, 0);
const TAU = Math.PI * 2, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- stage
const stage = createStage({ fov: 62, shadowSize: 45 });
const { scene, camera, renderer, sun, hemi } = stage;
camera.near = 0.5; camera.far = 3200; camera.updateProjectionMatrix();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const SKY = '#d3efff';
scene.fog = new THREE.Fog(SKY, 380, 1700);
document.body.style.setProperty('--bg1', '#5fb6ff'); document.body.style.setProperty('--bg2', SKY); document.body.style.setProperty('--ui', '#ff5d8f');
hemi.color.set('#ffffff'); hemi.groundColor.set('#bfe6ff'); hemi.intensity = 1.2; sun.intensity = 1.8;
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 520 }); sun.shadow.camera.updateProjectionMatrix();
const LDIR = new THREE.Vector3(0.45, 1, 0.3).normalize();

const ui = createUI({ title: 'GULLHOP', hint: 'Tap to take off', hand: '✈️' });
const D = daily('gullhop', ui, { name: NAME });
const B = board({ game: 'gullhop', label: 'Mission score', limits: { maxRun: 5000, maxPerSec: 150 }, corner: 'tl' });
ui.els.top.style.top = 'calc(18px + env(safe-area-inset-top))';
Object.assign(ui.els.pill.style, { top: 'calc(70px + env(safe-area-inset-top))', right: '14px', fontSize: '20px' });

// ---------------------------------------------------------------- world: islands
const ISL = [];
const NAMES = ['Gullrock', 'Pebble Key', 'Coconut Cay', 'Lantern Isle', 'Driftwood Atoll', 'Sunnyside', 'Puffin Point', 'Shell Bay', 'Tidewhistle', 'Mango Reef', 'Kelp Knoll', 'Breezy Bluff', 'Starfish Spit', 'Hammock Isle', 'Clam Corner', 'Gusty Rock', 'Lobster Ledge', 'Sandal Isle', 'Pelican Perch'];
(function genIslands() {
  const r = rng(4242);
  const RW = [[0, 0, 98, 0.35], [640, -470, 88, -0.6], [-720, -420, 92, 1.1], [180, -1060, 86, 0.1], [-380, 760, 90, -0.9]];
  for (const [x, z, rad, a] of RW) ISL.push({ x, z, r: rad, runway: { a, len: 136, w: 13 }, hills: [] });
  let tries = 0;
  while (ISL.length < 19 && tries++ < 2000) {
    const ang = r() * TAU, d = 260 + r() * 1150, x = Math.cos(ang) * d, z = Math.sin(ang) * d, rad = 26 + r() * 40;
    if (ISL.some(o => Math.hypot(o.x - x, o.z - z) < o.r + rad + 90)) continue;
    ISL.push({ x, z, r: rad, runway: null, hills: [] });
  }
  ISL.forEach((o, i) => {
    o.name = NAMES[i % NAMES.length]; o.id = i;
    if (o.runway) {
      const a = o.runway.a, nx = Math.cos(a + Math.PI / 2), nz = -Math.sin(a + Math.PI / 2);
      const side = r() < 0.5 ? 1 : -1;
      o.hills.push({ x: o.x + nx * o.r * 0.58 * side, z: o.z + nz * o.r * 0.58 * side, rh: o.r * 0.3, hh: 16 + r() * 18 });
      if (r() < 0.6) o.hills.push({ x: o.x - nx * o.r * 0.6 * side + Math.cos(a) * 30, z: o.z - nz * o.r * 0.6 * side - Math.sin(a) * 30, rh: o.r * 0.22, hh: 9 + r() * 8 });
    } else {
      o.hills.push({ x: o.x + (r() - 0.5) * o.r * 0.3, z: o.z + (r() - 0.5) * o.r * 0.3, rh: o.r * (0.5 + r() * 0.2), hh: 10 + r() * (o.r > 45 ? 48 : 26) });
    }
  });
})();
// runway frame: dir (along) = (cos a, -sin a), normal = (sin a, cos a)
const rwDir = o => [Math.cos(o.runway.a), -Math.sin(o.runway.a)];
const rwLocal = (o, x, z) => { const [dx, dz] = rwDir(o), px = x - o.x, pz = z - o.z; return { along: px * dx + pz * dz, lat: px * -dz + pz * dx }; };
const GRASS_Y = 1.45, RUNWAY_Y = 1.56;
function ground(x, z, out) {
  let h = 0, type = 'sea', isl = null;
  for (const o of ISL) {
    const dx = x - o.x, dz = z - o.z; if (Math.abs(dx) > o.r + 5 || Math.abs(dz) > o.r + 5) continue;
    const d = Math.hypot(dx, dz); if (d > o.r) continue;
    isl = o;
    if (d < o.r * 0.86) { h = GRASS_Y; type = 'grass'; } else { h = 1.2; type = 'sand'; }
    for (const q of o.hills) { const dh = Math.hypot(x - q.x, z - q.z); if (dh < q.rh) { const hy = 1.4 + q.hh * Math.sqrt(1 - (dh / q.rh) ** 2); if (hy > h) { h = hy; type = 'hill'; } } }
    if (o.runway && type !== 'hill') { const L = rwLocal(o, x, z); if (Math.abs(L.along) < o.runway.len / 2 && Math.abs(L.lat) < o.runway.w / 2) { h = RUNWAY_Y; type = 'runway'; } }
  }
  if (out) { out.h = h; out.type = type; out.isl = isl; return out; }
  return h;
}

// sea with sparkle
function seaTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#2fb6ec'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.3})`; const w = 6 + Math.random() * 18; x.fillRect(Math.random() * 256, Math.random() * 256, w, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const sea = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.MeshStandardMaterial({ map: seaTex(), roughness: 0.28, metalness: 0.05 }));
sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; scene.add(sea);

const dummy = new THREE.Object3D(), tmpC = new THREE.Color(); dummy.rotation.order = 'YXZ';
function inst(geo, material, n, fn, shadow = false) {
  const m = new THREE.InstancedMesh(geo, material, n); let k = 0;
  fn((p, s, ry = 0, col = null, rx = 0, rz = 0) => { dummy.position.set(...p); dummy.rotation.set(rx, ry, rz); dummy.scale.set(...s); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); if (col) m.setColorAt(k, tmpC.set(col)); k++; });
  m.count = k; m.castShadow = shadow; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); return m;
}
const lagoonGeo = new THREE.CircleGeometry(1, 48); lagoonGeo.rotateX(-Math.PI / 2);
inst(lagoonGeo, mat('#62e3e0', { roughness: 0.3 }), ISL.length, put => ISL.forEach(o => put([o.x, 0.08, o.z], [o.r * 1.42, 1, o.r * 1.42])));
const lagoon2 = new THREE.CircleGeometry(1, 48); lagoon2.rotateX(-Math.PI / 2);
inst(lagoon2, mat('#9af0e4', { roughness: 0.3 }), ISL.length, put => ISL.forEach(o => put([o.x, 0.14, o.z], [o.r * 1.15, 1, o.r * 1.15])));
const cyl = new THREE.CylinderGeometry(1, 1.06, 1, 40);
inst(cyl, mat('#ffe2a0'), ISL.length, put => ISL.forEach(o => put([o.x, 1.2 - 1.5, o.z], [o.r, 3, o.r])));
inst(cyl, mat('#ffffff'), ISL.length, put => ISL.forEach((o, i) => put([o.x, GRASS_Y - 0.5, o.z], [o.r * 0.86, 1, o.r * 0.86], 0, ['#7ed957', '#86dc5f', '#74cf52'][i % 3])));
const hillGeo = new THREE.SphereGeometry(1, 28, 16, 0, TAU, 0, Math.PI / 2);
inst(hillGeo, mat('#ffffff', { flatShading: false }), 40, put => ISL.forEach(o => o.hills.forEach((q, j) => put([q.x, 1.4, q.z], [q.rh, q.hh, q.rh], j, q.hh > 40 ? '#5fae5a' : ['#69c45a', '#5dba55', '#78cc5c'][(o.id + j) % 3]))), true);
// rocky peak caps on the tall hills
const capGeo = new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, Math.PI / 2);
inst(capGeo, mat('#b9a58f'), 40, put => ISL.forEach(o => o.hills.forEach(q => { if (q.hh > 34) put([q.x, 1.4 + q.hh * 0.82, q.z], [q.rh * 0.42, q.hh * 0.2, q.rh * 0.42]); })));

// palms
const palmSpots = [];
(function () {
  const r = rng(77);
  for (const o of ISL) {
    const n = Math.round(o.r / 7);
    for (let i = 0, t = 0; i < n && t < 80; t++) {
      const a = r() * TAU, d = o.r * (0.35 + r() * 0.55), x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
      const g = ground(x, z, {}); if (g.type === 'hill' || g.type === 'runway') continue;
      if (o.runway) { const L = rwLocal(o, x, z); if (Math.abs(L.lat) < 22 && Math.abs(L.along) < o.runway.len / 2 + 30) continue; }
      palmSpots.push({ x, z, y: g.h, s: 0.8 + r() * 0.5, tilt: (r() - 0.5) * 0.5, ry: r() * TAU }); i++;
    }
  }
})();
const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 7, 7); trunkGeo.translate(0, 3.5, 0);
inst(trunkGeo, mat('#b47b45'), palmSpots.length, put => palmSpots.forEach(p => put([p.x, p.y, p.z], [p.s, p.s, p.s], p.ry, null, p.tilt, 0)), true);
const leafGeo = new THREE.SphereGeometry(1, 8, 5); leafGeo.scale(0.75, 0.14, 3); leafGeo.translate(0, 0, 2.6);
inst(leafGeo, mat('#3dbb5b'), palmSpots.length * 6, put => palmSpots.forEach(p => {
  const top = new THREE.Vector3(0, 7 * p.s, 0).applyEuler(new THREE.Euler(p.tilt, p.ry, 0, 'YXZ'));
  for (let k = 0; k < 6; k++) put([p.x + top.x, p.y + top.y, p.z + top.z], [p.s, p.s, p.s], k * TAU / 6 + p.ry, null, 0.35, 0);
}), true);

// runways, hangars, lighthouses, huts, windsocks — baked into one mesh
(function props() {
  const P = [], add = (geo, color, pos, rot, scl) => P.push({ geo, color, pos, rot, scl });
  const box = new THREE.BoxGeometry(1, 1, 1), cy = new THREE.CylinderGeometry(1, 1, 1, 14), cone = new THREE.ConeGeometry(1, 1, 14);
  const r = rng(99);
  for (const o of ISL) {
    if (o.runway) {
      const { a, len, w } = o.runway, [dx, dz] = rwDir(o);
      const at = (al, la) => [o.x + dx * al + dz * la, o.z + dz * al - dx * la];   // normal = (-dz? ) keep consistent with rwLocal
      const rot = [0, a, 0];
      add(box, '#5b6476', [o.x, RUNWAY_Y - 0.12, o.z], rot, [len, 0.24, w]);
      for (let al = -len / 2 + 14; al < len / 2 - 12; al += 9) { const [x, z] = at(al, 0); add(box, '#ffffff', [x, RUNWAY_Y + 0.01, z], rot, [4.2, 0.04, 0.45]); }
      for (const s of [-1, 1]) {
        for (let k = -4; k <= 4; k++) { const [x, z] = at(s * (len / 2 - 4), k * 1.3); add(box, '#ffffff', [x, RUNWAY_Y + 0.01, z], rot, [5, 0.04, 0.6]); }
        const [ex, ez] = at(0, s * (w / 2 - 0.5)); add(box, '#ffd23f', [ex, RUNWAY_Y + 0.01, ez], rot, [len - 2, 0.04, 0.35]);
        for (let al = -len / 2; al <= len / 2; al += 17) { const [x, z] = at(al, s * (w / 2 + 0.8)); add(cy, '#ff5d5d', [x, RUNWAY_Y + 0.25, z], 0, [0.28, 0.5, 0.28]); }
      }
      // hangar + tower beside the runway (opposite the big hill side is unknown; use lat 24 where palms are absent)
      const hs = o.hills[0], hl = rwLocal(o, hs.x, hs.z).lat > 0 ? -1 : 1;
      const [hx, hz] = at(-18, hl * 19);
      add(box, '#f3f0ea', [hx, GRASS_Y + 2.5, hz], rot, [14, 5, 9]);
      add(new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI), '#ff5d5d', [hx, GRASS_Y + 5, hz], [0, a, Math.PI / 2], [4.5, 14, 4.5]);
      add(box, '#3a4a6a', [hx + dz * hl * -4.6, GRASS_Y + 1.8, hz - dx * hl * -4.6], rot, [8, 3.6, 0.3]);
      const [tx, tz] = at(24, hl * 20);
      add(cy, '#f3f0ea', [tx, GRASS_Y + 4, tz], 0, [1.4, 8, 1.4]);
      add(cy, '#7fd4ff', [tx, GRASS_Y + 8.8, tz], 0, [2.2, 1.6, 2.2]);
      add(cone, '#3a86ff', [tx, GRASS_Y + 10.2, tz], 0, [2.6, 1.4, 2.6]);
      const [wx, wz] = at(40, hl * 12);
      add(cy, '#ffffff', [wx, GRASS_Y + 2.5, wz], 0, [0.1, 5, 0.1]);
      add(cone, '#ff8c42', [wx + 1, GRASS_Y + 4.8, wz], [0, 0, Math.PI / 2], [0.5, 2.2, 0.5]);
    }
    // huts
    const huts = o.runway ? 2 : Math.min(3, Math.floor(o.r / 18));
    for (let i = 0, t = 0; i < huts && t < 40; t++) {
      const an = r() * TAU, d = o.r * (0.55 + r() * 0.25), x = o.x + Math.cos(an) * d, z = o.z + Math.sin(an) * d;
      if (ground(x, z) !== GRASS_Y) continue;
      if (o.runway) { const L = rwLocal(o, x, z); if (Math.abs(L.lat) < 26 && Math.abs(L.along) < o.runway.len / 2 + 20) continue; }
      const c = ['#ff8fab', '#ffd166', '#8ecae6', '#cdb4db'][(i + o.id) % 4];
      add(box, '#fff6e6', [x, GRASS_Y + 1.6, z], [0, an, 0], [4.4, 3.2, 4.4]);
      add(new THREE.ConeGeometry(1, 1, 4), c, [x, GRASS_Y + 4.4, z], [0, an + Math.PI / 4, 0], [4.2, 2.6, 4.2]);
      add(box, '#7a5a3a', [x + Math.cos(an) * 2.21, GRASS_Y + 1.1, z - Math.sin(an) * 2.21], [0, an, 0], [0.1, 2, 1.2]);
      i++;
    }
  }
  // lighthouses on a few small islands
  ISL.filter((o, i) => !o.runway && i % 3 === 0).forEach(o => {
    const an = o.id * 1.7, x = o.x + Math.cos(an) * o.r * 0.78, z = o.z + Math.sin(an) * o.r * 0.78, b = 1.2;
    for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(1.9 - (k + 1) * 0.2, 1.9 - k * 0.2, 3, 16), k % 2 ? '#ff4d5e' : '#ffffff', [x, b + 1.5 + k * 3, z]);
    add(cy, '#2b2d42', [x, b + 15.6, z], 0, [1.4, 0.4, 1.4]);
    add(cy, '#fff3a0', [x, b + 16.9, z], 0, [0.95, 2.2, 0.95]);
    add(cone, '#ff4d5e', [x, b + 19, z], 0, [1.3, 2, 1.3]);
    o.light = new THREE.Vector3(x, b + 17, z);
  });
  const m = new THREE.Mesh(bake(P), vcMat()); m.castShadow = true; m.receiveShadow = true; scene.add(m);
})();

// boats
const boats = (function () {
  const P = [], r = rng(31);
  for (let i = 0; i < 14; i++) {
    let x, z, t = 0; do { const an = r() * TAU, d = 150 + r() * 1300; x = Math.cos(an) * d; z = Math.sin(an) * d; } while (ground(x, z) > 0 && t++ < 20);
    const a = r() * TAU, hull = ['#ffffff', '#ff6b6b', '#3a86ff', '#ffd23f'][i % 4];
    const M = new THREE.Matrix4().makeRotationY(a).setPosition(x, 0, z);
    P.push({ geo: rounded(2.6, 1.1, 7, 0.4), color: hull, pos: [0, 0.4, 0], mat: M });
    P.push({ geo: new THREE.BoxGeometry(1.6, 1, 2), color: '#fff6e6', pos: [0, 1.4, 0.8], mat: M });
    P.push({ geo: new THREE.CylinderGeometry(0.08, 0.08, 6, 6), color: '#7a5a3a', pos: [0, 3.6, -0.8], mat: M });
    P.push({ geo: new THREE.ConeGeometry(1.6, 5, 3), color: '#fff9f0', pos: [0, 3.9, -1.6], scl: [1, 1, 0.08], rot: [0, Math.PI / 2, 0], mat: M });
  }
  const m = new THREE.Mesh(bake(P), vcMat()); scene.add(m); return m;
})();

// clouds
(function () {
  const r = rng(5), g = new THREE.IcosahedronGeometry(1, 2);
  inst(g, new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35 }), 260, put => {
    for (let i = 0; i < 46; i++) {
      const an = r() * TAU, d = 120 + r() * 1500, x = Math.cos(an) * d, z = Math.sin(an) * d, y = 140 + r() * 90, s = 10 + r() * 12;
      for (let k = 0; k < 5; k++) put([x + (k - 2) * s * 0.9 + r() * 4, y + r() * s * 0.4, z + (r() - 0.5) * s], [s * (0.7 + r() * 0.6), s * (0.5 + r() * 0.3), s * (0.7 + r() * 0.4)]);
    }
  });
})();

// ---------------------------------------------------------------- planes
const LIVERIES = [
  { name: 'Sunrise', c: ['#ff5d5d', '#ffd23f', '#3a86ff'], need: 0 },
  { name: 'Lagoon', c: ['#2ec4b6', '#ffffff', '#ff8c42'], need: 3 },
  { name: 'Bubblegum', c: ['#ff7bc0', '#8c6bff', '#ffe066'], need: 8 },
  { name: 'Midnight', c: ['#33365a', '#ffd23f', '#ff5d8f'], need: 15 },
  { name: 'Gold Rush', c: ['#ffc531', '#ffffff', '#2b2d42'], need: 24 },
];
const PLANES = [
  { name: 'Hopper', need: 0, spd: 1, turn: 1, hp: 1, guns: 1, shape: { r: 0.62, len: 3.2, span: 7.4, chord: 1.4, wy: 0.62, sweep: 0 } },
  { name: 'Puffin', need: 3, spd: 1.12, turn: 1.15, hp: 0.9, guns: 1, shape: { r: 0.78, len: 2.4, span: 6.2, chord: 1.3, wy: -0.35, sweep: 0 } },
  { name: 'Pelican', need: 6, spd: 1.04, turn: 0.95, hp: 1.6, guns: 2, shape: { r: 0.8, len: 3.8, span: 9, chord: 1.6, wy: 0.7, sweep: 0, twin: true } },
  { name: 'Swift', need: 10, spd: 1.3, turn: 1.25, hp: 1, guns: 2, shape: { r: 0.5, len: 3.8, span: 6.4, chord: 1.5, wy: -0.1, sweep: 0.45 } },
];
function planeGeos(id, lv) {
  const t = PLANES[id].shape, [c1, c2, c3] = LIVERIES[lv].c, P = [], G = [], add = (L, geo, color, pos, rot, scl) => L.push({ geo, color, pos, rot, scl });
  const nose = -(t.len / 2 + t.r);
  add(P, new THREE.CapsuleGeometry(t.r, t.len, 8, 18), c1, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(P, new THREE.CylinderGeometry(t.r * 1.02, t.r * 1.06, 0.55, 22), c2, [0, 0, nose + 0.55], [Math.PI / 2, 0, 0]);
  add(P, new THREE.ConeGeometry(t.r * 0.42, 0.7, 14), c3, [0, 0, nose - 0.12], [-Math.PI / 2, 0, 0]);
  add(P, new THREE.CylinderGeometry(t.r * 1.03, t.r * 1.03, 0.3, 22), c3, [0, 0, t.len * 0.18], [Math.PI / 2, 0, 0]);
  // wings
  const half = t.span / 2;
  for (const s of [-1, 1]) {
    add(P, rounded(half, 0.2, t.chord, 0.09), c2, [s * half / 2, t.wy, -t.len * 0.12 + t.sweep * half / 2], [0, s * t.sweep * 0.55, 0]);
    add(P, new THREE.SphereGeometry(0.22, 12, 8), c3, [s * half * 0.98, t.wy, -t.len * 0.12 + t.sweep * half], [0, 0, 0], [1, 0.9, 2.2]);
  }
  if (t.wy > 0.3) for (const s of [-1, 1]) add(P, new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), '#e8e8f0', [s * 1.6, t.wy * 0.25, -t.len * 0.12], [0, 0, s * 0.9]);
  // tail
  const tz = t.len / 2 + t.r * 0.6;
  add(P, rounded(t.span * 0.36, 0.14, 0.9, 0.06), c2, [0, t.r * 0.25, tz]);
  if (t.twin) for (const s of [-1, 1]) add(P, rounded(0.14, 1.4, 1, 0.06), c3, [s * t.span * 0.17, t.r * 0.25 + 0.6, tz + 0.1]);
  else add(P, rounded(0.16, 1.5, 1.1, 0.07), c3, [0, t.r * 0.4 + 0.65, tz + 0.1], [-0.25, 0, 0]);
  // canopy + gull pilot with goggles
  const pz = -t.len * 0.1, py = t.r * 0.78;
  add(P, new THREE.SphereGeometry(0.46, 18, 12), '#a8ecff', [0, py + 0.05, pz - 0.55], [0, 0, 0], [1, 0.75, 1.15]);
  add(P, new THREE.SphereGeometry(0.36, 18, 14), '#ffffff', [0, py + 0.32, pz + 0.15]);
  add(P, new THREE.ConeGeometry(0.13, 0.5, 10), '#ff9f1c', [0, py + 0.24, pz - 0.32], [-Math.PI / 2 - 0.25, 0, 0]);
  for (const s of [-1, 1]) {
    add(P, new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), '#ffd23f', [s * 0.15, py + 0.42, pz - 0.12], [Math.PI / 2, 0, 0]);
    add(P, new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12), '#2b2d42', [s * 0.15, py + 0.42, pz - 0.15], [Math.PI / 2, 0, 0]);
  }
  add(P, new THREE.TorusGeometry(0.3, 0.06, 6, 16), c3, [0, py + 0.08, pz + 0.18], [Math.PI / 2, 0, 0]);
  add(P, new THREE.BoxGeometry(0.16, 0.06, 0.7), c3, [0.14, py + 0.08, pz + 0.55], [0.4, 0.3, 0]);
  // gear (separate)
  for (const s of [-1, 1]) {
    add(G, new THREE.CylinderGeometry(0.07, 0.07, 1, 6), '#d9dbe6', [s * 0.75, -t.r - 0.35, -t.len * 0.22], [0, 0, s * 0.35]);
    add(G, new THREE.CylinderGeometry(0.38, 0.38, 0.26, 16), '#2b2d42', [s * 0.95, -t.r - 0.78, -t.len * 0.22], [0, 0, Math.PI / 2]);
    add(G, new THREE.CylinderGeometry(0.18, 0.18, 0.28, 12), '#ffffff', [s * 0.95, -t.r - 0.78, -t.len * 0.22], [0, 0, Math.PI / 2]);
  }
  add(G, new THREE.CylinderGeometry(0.17, 0.17, 0.14, 12), '#2b2d42', [0, -t.r * 0.5 - 0.18, tz], [0, 0, Math.PI / 2]);
  return { body: bake(P), gear: bake(G), nose, gearDrop: t.r + 1.16 };
}
const plane = new THREE.Group(); scene.add(plane);
plane.rotation.order = 'YXZ';
const pBody = new THREE.Mesh(undefined, vcMat({ roughness: 0.35 })); pBody.castShadow = true; plane.add(pBody);
const pGear = new THREE.Mesh(undefined, vcMat()); pGear.castShadow = true; plane.add(pGear);
const propGeo = bake([{ geo: rounded(0.32, 3, 0.1, 0.05), color: '#3a3d52', pos: [0, 0, 0] }, { geo: rounded(0.32, 3, 0.1, 0.05), color: '#3a3d52', pos: [0, 0, 0], rot: [0, 0, Math.PI / 2] }]);
const prop = new THREE.Mesh(propGeo, vcMat()); plane.add(prop);
const propDisc = new THREE.Mesh(new THREE.CircleGeometry(1.55, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); plane.add(propDisc);
let geoInfo = null;
function buildPlane() {
  geoInfo = planeGeos(planeId, liveryId);
  pBody.geometry = geoInfo.body; pGear.geometry = geoInfo.gear;
  prop.position.z = propDisc.position.z = geoInfo.nose - 0.35;
}
buildPlane();

// ---------------------------------------------------------------- mission objects
const ringGeo = new THREE.TorusGeometry(1, 0.085, 10, 44);
const rings = new THREE.InstancedMesh(ringGeo, mat('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.25 }), 24); rings.count = 0; scene.add(rings);
const nextRing = new THREE.Group(); scene.add(nextRing);
const nrTorus = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 12, 56), mat('#ff7a1a', { emissive: '#ff5d00', emissiveIntensity: 0.5 })); nextRing.add(nrTorus);
const nrDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })); nextRing.add(nrDisc);
const arrowGeo = new THREE.ConeGeometry(0.45, 1.5, 14); arrowGeo.rotateX(Math.PI / 2);
const arrow = new THREE.Mesh(arrowGeo, mat('#ffe066', { emissive: '#ffb000', emissiveIntensity: 0.5 })); scene.add(arrow);
// drop pad + beacon
function padTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 5; i >= 1; i--) { x.fillStyle = i % 2 ? '#ff4d5e' : '#ffffff'; x.beginPath(); x.arc(128, 128, i * 25, 0, TAU); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const pad = new THREE.Group(); scene.add(pad);
const padDisc = new THREE.Mesh(new THREE.CircleGeometry(20, 40), new THREE.MeshStandardMaterial({ map: padTex(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })); padDisc.rotation.x = -Math.PI / 2; padDisc.receiveShadow = true; pad.add(padDisc);
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 90, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })); beacon.position.y = 45; pad.add(beacon);
pad.visible = false;
// runway target beacon (landing): two glowing gates at the threshold
const gate = new THREE.Group(); scene.add(gate); gate.visible = false;
for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 10, 1, true), beacon.material); g.position.set(0, 15, s * 9); gate.add(g); }
// crates
const crates = [];
const crateGeo = bake([{ geo: rounded(1.6, 1.6, 1.6, 0.15), color: '#c98a4b', pos: [0, 0, 0] }, { geo: new THREE.BoxGeometry(1.7, 0.3, 1.7), color: '#ff5d5d', pos: [0, 0, 0] }, { geo: new THREE.BoxGeometry(0.3, 1.7, 1.7), color: '#ff5d5d', pos: [0, 0, 0] }]);
const chuteGeo = bake([{ geo: new THREE.SphereGeometry(3, 16, 8, 0, TAU, 0, Math.PI / 2), color: '#ffffff', pos: [0, 4, 0], scl: [1, 0.7, 1] }, { geo: new THREE.CylinderGeometry(3.02, 3.02, 0.5, 16, 1, true), color: '#ff7bc0', pos: [0, 4.1, 0] }, ...[0, 1, 2, 3].map(k => ({ geo: new THREE.CylinderGeometry(0.03, 0.03, 4.2, 4), color: '#ffffff', pos: [Math.cos(k * 1.57) * 1.5, 2.2, Math.sin(k * 1.57) * 1.5], rot: [Math.sin(k * 1.57) * 0.62, 0, -Math.cos(k * 1.57) * 0.62] }))]);
for (let i = 0; i < 3; i++) {
  const g = new THREE.Group(), box = new THREE.Mesh(crateGeo, vcMat()), ch = new THREE.Mesh(chuteGeo, vcMat({ side: THREE.DoubleSide }));
  box.castShadow = true; g.add(box, ch); g.visible = false; scene.add(g); crates.push({ g, ch, v: new THREE.Vector3(), t: 0, live: false });
}
// drones (one instanced mesh)
const droneGeo = bake([
  { geo: new THREE.SphereGeometry(1.6, 20, 14), color: '#8c6bff', pos: [0, 0, 0], scl: [1, 0.85, 1] },
  { geo: new THREE.SphereGeometry(0.85, 16, 12), color: '#ffffff', pos: [0, 0.15, -1.15] },
  { geo: new THREE.SphereGeometry(0.42, 12, 10), color: '#2b2d42', pos: [0, 0.18, -1.82] },
  { geo: new THREE.ConeGeometry(0.3, 0.8, 8), color: '#ffd23f', pos: [0, 1.6, 0] },
  { geo: new THREE.SphereGeometry(0.2, 8, 6), color: '#ff5d8f', pos: [0, 2.05, 0] },
  ...[0, 1, 2, 3].flatMap(k => { const a = k * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 2.3, z = Math.sin(a) * 2.3; return [
    { geo: new THREE.BoxGeometry(2.2, 0.22, 0.3), color: '#5a4bb0', pos: [x / 2, 0.3, z / 2], rot: [0, -a, 0] },
    { geo: new THREE.CylinderGeometry(1, 1, 0.12, 16), color: '#d8f4ff', pos: [x, 0.5, z] }]; }),
]);
const drones = new THREE.InstancedMesh(droneGeo, vcMat({ roughness: 0.3 }), 12); drones.count = 0; drones.castShadow = true; scene.add(drones);
for (let i = 0; i < 12; i++) drones.setColorAt(i, tmpC.set('#ffffff'));
// paint bullets + foam balls
const shotGeo = new THREE.SphereGeometry(0.45, 10, 8);
const shots = new THREE.InstancedMesh(shotGeo, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.25 }), 90); shots.count = 0; scene.add(shots);
const SHOTC = ['#ff3d7f', '#ffd23f', '#3ab795', '#3a86ff', '#ff8c42'];
for (let i = 0; i < 90; i++) shots.setColorAt(i, tmpC.set(SHOTC[i % 5]));
const foamGeo = new THREE.IcosahedronGeometry(0.9, 1);
const foams = new THREE.InstancedMesh(foamGeo, mat('#ffc8f0', { emissive: '#ff7bc0', emissiveIntensity: 0.35 }), 40); foams.count = 0; scene.add(foams);
const SH = [], FO = [];
const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.35, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false, fog: true }), 160); puffs.count = 0; scene.add(puffs);
const PF = []; let puffT = 0;
function tickPuffs(s) {
  puffT -= s;
  if (puffT <= 0 && !PL.dead && plane.visible && !PL.onGround && (Math.abs(PL.bank) > 0.45 || PL.v > 40 || Math.abs(PL.pitch) > 0.5)) {
    puffT = 0.025; const half = PLANES[planeId].shape.span / 2;
    for (const sd of [-1, 1]) { const p = new THREE.Vector3(sd * half, PLANES[planeId].shape.wy, 0).applyEuler(plane.rotation).add(PL.pos); if (PF.length < 160) PF.push({ p, t: 0 }); }
  }
  let k = 0;
  for (let i = PF.length - 1; i >= 0; i--) { PF[i].t += s; if (PF[i].t > 0.9) PF.splice(i, 1); }
  for (const f of PF) { dummy.position.copy(f.p); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.6 + f.t * 2.2 - f.t * f.t * 1.5); dummy.updateMatrix(); puffs.setMatrixAt(k++, dummy.matrix); }
  puffs.count = k; puffs.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- HUD + input
const $ = id => document.getElementById(id);
const thrEl = $('thr'), actEl = $('act'), gearEl = $('gear'), flapsEl = $('flaps'), warnEl = $('warn'), stickEl = $('stick'), markEl = $('mark');
const hum = { pitch: 0, roll: 0, thr: 0.7, fire: false };
const bot = { pitch: 0, roll: 0, thr: 0.7, fire: false };
let botUntil = 0;
const keys = {};
let stickId = null, stickO = null, thrId = null;
const onControl = e => e.target && e.target.closest && e.target.closest('#thr,.gbtn,.hc-card,.bd-trophy,.bd-wrap,.bd-toast');
function setThrFromY(y) { const r = thrEl.getBoundingClientRect(); hum.thr = clamp(1 - (y - r.top) / r.height, 0, 1); }
addEventListener('pointerdown', e => {
  audioInit();
  if (state !== 'play') return;
  if (e.target.closest && e.target.closest('#thr')) { thrId = e.pointerId; setThrFromY(e.clientY); return; }
  if (onControl(e)) return;
  if (stickId === null) { stickId = e.pointerId; stickO = { x: e.clientX, y: e.clientY }; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.hidden = false; stickEl.firstElementChild.style.transform = ''; }
});
addEventListener('pointermove', e => {
  if (e.pointerId === thrId) setThrFromY(e.clientY);
  if (e.pointerId === stickId) {
    const dx = clamp((e.clientX - stickO.x) / 55, -1, 1), dy = clamp((e.clientY - stickO.y) / 55, -1, 1);
    hum.roll = dx; hum.pitch = pilotMode ? dy : -dy;
    stickEl.firstElementChild.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
  }
});
const endPtr = e => { if (e.pointerId === thrId) thrId = null; if (e.pointerId === stickId) { stickId = null; hum.roll = 0; hum.pitch = 0; stickEl.hidden = true; } };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
const btnDown = (el, fn) => { el.addEventListener('pointerdown', e => { e.stopPropagation(); audioInit(); fn(true); el.classList.add('on'); }); const up = () => { fn(false); el.classList.remove('on'); }; el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up); };
btnDown(actEl, d => { hum.fire = d; if (d) action(); });
btnDown(gearEl, d => { if (d) toggleGear(); });
btnDown(flapsEl, d => { if (d) toggleFlaps(); });
addEventListener('keydown', e => {
  audioInit(); keys[e.code] = true;
  if (state !== 'play') return;
  if (e.code === 'Space') { hum.fire = true; if (!e.repeat) action(); e.preventDefault(); }
  if (e.code === 'KeyG') toggleGear();
  if (e.code === 'KeyF') toggleFlaps();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') hum.fire = false; });
function keyInput(s) {
  const up = keys.KeyW || keys.ArrowUp, dn = keys.KeyS || keys.ArrowDown, l = keys.KeyA || keys.ArrowLeft, r = keys.KeyD || keys.ArrowRight;
  if (up || dn || l || r) { hum.pitch = ((up ? 1 : 0) - (dn ? 1 : 0)) * (pilotMode ? -1 : 1); hum.roll = (r ? 1 : 0) - (l ? 1 : 0); hum.k = true; }
  else if (hum.k && stickId === null) { hum.pitch = 0; hum.roll = 0; hum.k = false; }
  if (keys.ShiftLeft || keys.ShiftRight || keys.KeyE) hum.thr = clamp(hum.thr + s * 0.6, 0, 1);
  if (keys.ControlLeft || keys.ControlRight || keys.KeyQ) hum.thr = clamp(hum.thr - s * 0.6, 0, 1);
}

// ---------------------------------------------------------------- audio: engine drone + island music loop
let ac = null, eng = null;
function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -1200; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0;
    lfo.frequency.value = 18; lg.gain.value = 0.012; lfo.connect(lg); lg.connect(g.gain);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o1.start(); o2.start(); lfo.start();
    eng = { o1, o2, g, f, lfo };
  } catch (e) { ac = null; }
}
function engineSound() {
  if (!eng) return;
  const on = state === 'play' && !PL.dead, t = ac.currentTime, fr = 48 + PL.thr * 52 + PL.v * 0.7;
  eng.o1.frequency.setTargetAtTime(fr, t, 0.12); eng.o2.frequency.setTargetAtTime(fr * 1.5, t, 0.12); eng.lfo.frequency.setTargetAtTime(10 + PL.thr * 22, t, 0.2);
  eng.f.frequency.setTargetAtTime(380 + PL.thr * 700, t, 0.2); eng.g.gain.setTargetAtTime(on ? 0.028 + PL.thr * 0.02 : 0, t, 0.15);
}
let phrase = [], mStep = 0;
function makePhrase(seed) {
  const r = rng(seed * 13 + 5), PENT = [0, 2, 4, 7, 9, 12, 14, 16]; let k = 3; phrase = [];
  for (let i = 0; i < 32; i++) { k = clamp(k + Math.floor(r() * 5) - 2, 0, PENT.length - 1); phrase.push(r() < 0.72 ? PENT[k] : null); }
}
const ROOTS = [48, 45, 41, 43];
setInterval(() => {
  if (!ac || state !== 'play' || document.visibilityState === 'hidden') return;
  const i = mStep++ % 32, bar = Math.floor(i / 8) % 4;
  if (i % 4 === 0) note(ROOTS[bar], 0.5, 0.05);
  if (i % 8 === 4) note(ROOTS[bar] + 7, 0.35, 0.03);
  if (phrase[i] !== null && phrase[i] !== undefined) note(72 + phrase[i] - (bar === 1 ? 3 : 0) * 0, 0.26, 0.035);
}, 190);

// ---------------------------------------------------------------- flight model
const PL = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), head: 0, pitch: 0, bank: 0, v: 30, thr: 0.7, sink: 0, gear: false, flaps: false, onGround: false, dead: false, deadT: 0, hp: 100, inv: 0, stall: false };
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), G0 = {};
const forward = (out = fwd) => out.set(-Math.sin(PL.head) * Math.cos(PL.pitch), Math.sin(PL.pitch), -Math.cos(PL.head) * Math.cos(PL.pitch));
function toggleGear(v) { if (PL.onGround) return; PL.gear = v === undefined ? !PL.gear : v; gearEl.classList.toggle('dn', PL.gear); gearEl.textContent = PL.gear ? 'GEAR ▼' : 'GEAR ▲'; sfx.tap(); }
function toggleFlaps(v) { PL.flaps = v === undefined ? !PL.flaps : v; flapsEl.classList.toggle('dn', PL.flaps); flapsEl.textContent = PL.flaps ? 'FLAPS ▼' : 'FLAPS'; sfx.tap(); }
const stallSpeed = () => (PL.flaps ? 12.5 : 16.5);
let shake = 0;

function physics(s, I) {
  const st = PLANES[planeId], top = 42 * st.spd, Cd = 0.006;
  PL.thr = I.thr;
  if (PL.onGround) return groundRoll(s, I, st);
  const drag = Cd * (PL.flaps ? 1.6 : 1) * (PL.gear ? 1.2 : 1);
  const acc = PL.thr * Cd * top * top - drag * PL.v * PL.v - 9.8 * Math.sin(PL.pitch) * 0.75;
  PL.v = Math.max(6, PL.v + acc * s);
  PL.bank += (I.roll * 1.12 - PL.bank) * (1 - Math.exp(-3.2 * st.turn * s));
  const hr = clamp(Math.tan(PL.bank) * 9.8 * 1.3 / Math.max(PL.v, 14), -1.35 * st.turn, 1.35 * st.turn);
  PL.head -= hr * s;
  PL.pitch += I.pitch * 1.05 * st.turn * s;
  if (Math.abs(I.pitch) < 0.08) PL.pitch *= Math.exp(-0.45 * s);
  const ss = stallSpeed(); PL.stall = PL.v < ss;
  const agl = PL.pos.y - ground(PL.pos.x, PL.pos.z);
  if (PL.stall) { const k = (ss - PL.v) / ss; PL.sink = lerp(PL.sink, Math.min(4 + k * 22, agl < 8 ? 3.2 : 99), 1 - Math.exp(-2 * s)); PL.pitch -= (0.5 + k * 1.4) * s * (agl < 8 ? 0.3 : 1); }
  else PL.sink = lerp(PL.sink, 0, 1 - Math.exp(-2.5 * s));
  if (PL.pos.y > 330) PL.pitch -= 0.6 * s;
  PL.pitch = clamp(PL.pitch, -1.15, 1.15);
  forward(); PL.vel.copy(fwd).multiplyScalar(PL.v); PL.vel.y -= PL.sink;
  PL.pos.addScaledVector(PL.vel, s);
  // contact
  const g = ground(PL.pos.x, PL.pos.z, G0), clear = PL.gear ? geoInfo.gearDrop : 0.8;
  if (PL.pos.y - clear <= g.h) {
    const vy = PL.vel.y;
    const gentle = vy > -5.2 && Math.abs(PL.bank) < 0.4 && PL.pitch > -0.22;
    if (PL.gear && gentle && (g.type === 'runway' || g.type === 'grass')) touchdown(g, vy);
    else crash(g.type === 'sea' ? 'splash' : 'poof', !PL.gear && gentle && g.type !== 'sea' && g.type !== 'hill' ? 'Belly landing! Lower the gear' : '');
  }
}
function groundRoll(s, I, st) {
  const top = 42 * st.spd, Cd = 0.006;
  const brake = PL.thr < 0.15 ? 7 : 0;
  const acc = PL.thr * Cd * top * top - Cd * 1.6 * PL.v * PL.v - 2.2 - brake;
  PL.v = Math.max(0, PL.v + acc * s);
  PL.head -= I.roll * 0.45 * s * Math.min(1, PL.v / 6);
  PL.bank = lerp(PL.bank, 0, 1 - Math.exp(-8 * s)); PL.pitch = lerp(PL.pitch, 0.04, 1 - Math.exp(-6 * s)); PL.sink = 0;
  forward(); PL.vel.set(fwd.x, 0, fwd.z).normalize().multiplyScalar(PL.v);
  PL.pos.addScaledVector(PL.vel, s);
  const g = ground(PL.pos.x, PL.pos.z, G0);
  if (g.type === 'sea' || g.type === 'hill') { PL.onGround = false; return crash(g.type === 'sea' ? 'splash' : 'poof', 'Ran off the island!'); }
  PL.pos.y = g.h + geoInfo.gearDrop - 0.02;
  if (PL.v > stallSpeed() * 1.2 && I.pitch > 0.3) { PL.onGround = false; PL.pitch = 0.18; PL.pos.y += 0.3; ui.pop('Airborne!', '#fff', 28, 26); }
  M.groundTick && M.groundTick(s, g);
}
function touchdown(g, vy) {
  PL.onGround = true; PL.pos.y = g.h + geoInfo.gearDrop; shake = Math.min(0.6, -vy * 0.12);
  burst(scene, PL.pos.clone().setY(g.h + 0.3), ['#ffffff', '#e8e2d6'], 10, { speed: 0.1, up: 0.05, size: 1.3, shape: 'sphere' });
  tone(140, 0.12, 'sine', 0.15, 0.6); buzz(30);
  M.touchdown && M.touchdown(g, vy);
}
function crash(kind, msg = '') {
  if (PL.dead) return;
  PL.dead = true; PL.deadT = 0; plane.visible = false; shake = 1.2; buzz([60, 40, 90]); sfx.smash();
  const p = PL.pos.clone(); p.y = Math.max(p.y, 0.5);
  if (kind === 'splash') { burst(scene, p, ['#ffffff', '#bdf3ff', '#7fdcff'], 40, { speed: 0.25, up: 0.45, size: 2.2, shape: 'sphere', gravity: 0.02 }); tone(90, 0.5, 'sawtooth', 0.08, 0.4); }
  else burst(scene, p, ['#ffffff', '#d7d2c8', '#ffd23f', '#ff8c42'], 36, { speed: 0.3, up: 0.3, size: 2, shape: 'sphere', gravity: 0.008 });
  confetti(scene, p, 20);
  ui.pop(kind === 'splash' ? 'SPLASH!' : 'POOF!', '#fff', 46, 30);
  if (msg) setTimeout(() => ui.pop(msg, '#fff', 24, 38), 500);
  M.crashed && M.crashed(kind, msg);
}
function spawn(pos, head, alt = null, v = 32) {
  PL.pos.copy(pos); if (alt !== null) PL.pos.y = alt; PL.head = head; PL.pitch = 0; PL.bank = 0; PL.v = v; PL.sink = 0;
  PL.onGround = false; PL.dead = false; PL.inv = 2; plane.visible = true; toggleGear(false); if (PL.flaps) toggleFlaps(false);
}

// ---------------------------------------------------------------- autopilot (bot + attract mode)
function autopilot(I, tx, ty, tz, speedT, lead = 0) {
  const dx = tx - PL.pos.x, dz = tz - PL.pos.z, dist = Math.hypot(dx, dz);
  const desH = Math.atan2(-dx, -dz), err = wrapA(desH - PL.head);
  I.roll = clamp(-err * 2.4, -1, 1);
  // terrain look-ahead
  let minA = 0; for (const d of [0, 40, 90, 150]) { const x = PL.pos.x + fwd.x * d, z = PL.pos.z + fwd.z * d; minA = Math.max(minA, ground(x, z) + 16); }
  const alt = Math.max(ty, minA), desP = clamp(Math.atan2(alt - PL.pos.y, Math.max(dist, 35)), -0.45, 0.55);
  I.pitch = clamp((desP - PL.pitch) * 3.2, -1, 1);
  I.thr = clamp(0.55 + (speedT - PL.v) * 0.09, 0, 1);
  return { dist, err };
}

// ---------------------------------------------------------------- missions
const TYPES = ['rings', 'drop', 'land', 'dogfight'];
const TNAME = { rings: 'Ring Run', drop: 'Crate Drop', land: 'Landing', dogfight: 'Drone Dogfight' };
let state = 'ready', score = 0, M = {}, mTime = 0, mLeft = 0, recorded = false, beatShown = false, runStart = 0;
const missionLevel = () => (D.seed ? 7 : level);
function missionType() { return D.seed ? TYPES[D.seed % 4] : TYPES[(level - 1) % 4]; }
const reach = () => Math.min(ISL.length, 3 + Math.floor(missionLevel() / 2));     // islands unlock as you climb the ladder
function islandsInReach() { const n = reach(); return ISL.slice(0).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, Math.max(4, n)); }

function setupMission() {
  const L = missionLevel(), seed = D.seed || level * 7919 + 13, r = rng(seed), fk = F.k(), type = missionType();
  makePhrase(seed); score = 0; ui.score(0); recorded = false; beatShown = false; mTime = 0; PL.hp = 100;
  rings.count = 0; nextRing.visible = false; pad.visible = false; gate.visible = false; drones.count = 0; SH.length = 0; FO.length = 0;
  for (const c of crates) { c.live = false; c.g.visible = false; }
  M = { type, L, fk }; hooks();
  actEl.style.display = type === 'drop' || type === 'dogfight' ? '' : 'none';
  actEl.innerHTML = type === 'drop' ? 'DROP<small>space</small>' : 'FIRE<small>space</small>';
  const pool = islandsInReach();
  if (type === 'rings') {
    const n = Math.min(14, 6 + Math.floor(L / 2)), rr = clamp(8.5 / fk - L * 0.08, 5.2, 10);
    const start = pool[Math.floor(r() * pool.length)];
    let h = r() * TAU, p = new THREE.Vector3(start.x, 55, start.z).add(new THREE.Vector3(Math.sin(h), 0, Math.cos(h)).multiplyScalar(160));
    const list = [], sp = new THREE.Vector3(p.x, p.y, p.z);  // heading h points back toward the island
    spawn(sp, h, 55);
    let y = 55; p = sp.clone();
    for (let i = 0; i < n; i++) {
      h += (r() - 0.5) * (0.6 + Math.min(L, 12) * 0.05); y = clamp(y + (r() - 0.5) * 34, 24, 120);
      const d = 95 + r() * 30; p = p.clone().add(new THREE.Vector3(-Math.sin(h) * d, 0, -Math.cos(h) * d));
      let gmax = 0; for (let k = 0; k <= 4; k++) { const q = (list[i - 1] ? list[i - 1].c : sp).clone().lerp(p, k / 4); gmax = Math.max(gmax, ground(q.x, q.z)); }
      p.y = Math.max(y, gmax + 20); y = p.y;
      const prev = list[i - 1] ? list[i - 1].c : sp, n3 = p.clone().sub(prev).normalize();
      list.push({ c: p.clone(), n: n3, r: rr, done: false });
    }
    M.rings = list; M.next = 0; M.passed = 0; M.limit = Math.round((n * 4.2 + 8) / fk); M.need = Math.ceil(n * 0.6);
    M.prevSide = null; layRings();
    ui.sub(`Fly through ${n} rings`);
  } else if (type === 'drop') {
    const n = 2 + Math.min(2, Math.floor(L / 8)), spots = [];
    const cand = pool.filter(o => !o.runway || r() < 0.5).sort(() => r() - 0.5);
    for (const o of cand) { const sp = findPadSpot(o, r); if (sp) spots.push({ isl: o, p: sp }); if (spots.length >= n) break; }
    M.spots = spots; M.next = 0; M.done = 0; M.limit = Math.round((30 + n * 22) / fk);
    const first = spots[0].p, a = r() * TAU;
    spawn(new THREE.Vector3(first.x + Math.cos(a) * 330, 0, first.z + Math.sin(a) * 330), Math.atan2(Math.cos(a), Math.sin(a)), 48);
    placePad(); ui.sub(`Drop ${n} supply crates on the targets`);
  } else if (type === 'land') {
    const rws = ISL.filter(o => o.runway).slice(0, Math.min(5, 1 + Math.floor(L / 3)));
    const o = rws[Math.floor(r() * rws.length)], [dx, dz] = rwDir(o), end = r() < 0.5 ? 1 : -1;
    const thr = new THREE.Vector3(o.x - dx * end * o.runway.len / 2, RUNWAY_Y, o.z - dz * end * o.runway.len / 2);
    const ldir = new THREE.Vector3(dx * end, 0, dz * end);   // landing direction
    const off = (r() - 0.5) * Math.min(260, 40 + L * 18) / fk;
    const sp = thr.clone().addScaledVector(ldir, -720).add(new THREE.Vector3(-ldir.z, 0, ldir.x).multiplyScalar(off));
    spawn(sp, Math.atan2(-ldir.x, -ldir.z) + (r() - 0.5) * 0.3, 70 + r() * 20, 30);
    M.isl = o; M.thr = thr; M.ldir = ldir; M.limit = Math.round(80 / fk); M.startD = sp.distanceTo(thr); M.td = null;
    gate.visible = true; gate.position.copy(thr); gate.rotation.y = Math.atan2(-ldir.z, ldir.x);
    ui.sub(`Land on ${o.name} and stop on the runway`);
  } else {
    const n = Math.min(10, 3 + Math.floor(L / 4)), home = pool[Math.floor(r() * Math.min(3, pool.length))];
    M.drones = []; for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = 60 + r() * 140;
      M.drones.push({ anchor: new THREE.Vector3(home.x + Math.cos(a) * d, 0, home.z + Math.sin(a) * d), ang: r() * TAU, rad: 35 + r() * 50, alt: 45 + r() * 50, dir: r() < 0.5 ? 1 : -1, hp: L >= 8 ? 4 : 3, alive: true, cool: 2 + r() * 3, flash: 0, pos: new THREE.Vector3(), bob: r() * 10 });
    }
    M.popped = 0; M.speed = clamp(15 * fk, 10, 26); M.acc = clamp(0.5 * fk, 0.3, 0.85); M.fireGap = clamp(3 - L * 0.06, 1.6, 3) / fk; M.limit = Math.round(40 + n * 9);
    drones.count = n; const a = r() * TAU;
    spawn(new THREE.Vector3(home.x + Math.cos(a) * 420, 0, home.z + Math.sin(a) * 420), Math.atan2(Math.cos(a), Math.sin(a)), 65);
    ui.sub(`Pop ${n} buzz-drones with your paint blaster`);
  }
  mLeft = M.limit;
  ui.levels(D.seed ? 0 : level); ui.progress(0);
  camSnap = true;
}
function findPadSpot(o, r) {
  for (let t = 0; t < 40; t++) {
    const a = r() * TAU, d = o.r * (0.15 + r() * 0.55), x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
    if (ground(x, z) === GRASS_Y && ground(x + 10, z) === GRASS_Y && ground(x - 10, z) === GRASS_Y && ground(x, z + 10) === GRASS_Y && ground(x, z - 10) === GRASS_Y) return new THREE.Vector3(x, GRASS_Y, z);
  }
  return null;
}
function placePad() { const s = M.spots[M.next]; if (!s) { pad.visible = false; return; } pad.visible = true; pad.position.set(s.p.x, GRASS_Y + 0.06, s.p.z); }
function layRings() {
  let k = 0;
  M.rings.forEach((g, i) => {
    if (g.done || i === M.next) return;
    dummy.position.copy(g.c); dummy.lookAt(tmp.copy(g.c).add(g.n)); dummy.scale.setScalar(g.r); dummy.updateMatrix(); rings.setMatrixAt(k++, dummy.matrix);
  });
  rings.count = k; rings.instanceMatrix.needsUpdate = true;
  const g = M.rings[M.next];
  nextRing.visible = !!g; if (g) { nextRing.position.copy(g.c); nextRing.lookAt(tmp.copy(g.c).add(g.n)); nextRing.scale.setScalar(g.r); }
}
const addScore = n => { score += n; ui.score(score); if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#ffe066', 40, 24); confetti(scene, PL.pos.clone(), 50); } };

// mission tick: objective logic, returns the 3D target for the marker/arrow
function missionTick(s) {
  if (M.type === 'rings') {
    const g = M.rings[M.next]; if (!g) return null;
    const side = tmp.copy(PL.pos).sub(g.c).dot(g.n);
    if (M.prevSide !== null && M.prevSide < 0 && side >= 0) {
      const lat = tmp.copy(PL.pos).addScaledVector(g.n, -side).distanceTo(g.c);
      if (lat < g.r * 1.08) {
        const perfect = lat < g.r * 0.38; M.passed++;
        addScore(100 + (perfect ? 50 : 0)); mLeft += 1.5;
        ui.pop(perfect ? 'PERFECT! +150' : '+100', perfect ? '#ffe066' : '#fff', perfect ? 40 : 34, 24);
        sfx.coin(); note(76 + M.passed % 5 * 2, 0.3, 0.12); buzz(15);
        burst(scene, g.c.clone(), ['#ffd23f', '#ffffff', '#ff8c42'], 22, { speed: 0.25, up: 0.05, size: 1.4, gravity: 0 });
        g.done = true; M.next++; layRings();
      } else if (lat < g.r * 3) { ui.pop('MISSED', '#ffb3b3', 30, 24); sfx.fail(); g.done = true; M.next++; layRings(); }
      M.prevSide = null;
    } else M.prevSide = side;
    if (M.next !== M.ringSeen) { M.ringSeen = M.next; M.prevSide = null; }
    ui.progress(M.next / M.rings.length);
    if (M.next >= M.rings.length) { if (M.passed >= M.need) return finish(true); return finish(false, 'TOO MANY MISSES', `${M.passed}/${M.rings.length} rings`); }
    nrTorus.material.emissiveIntensity = 0.4 + Math.sin(performance.now() / 150) * 0.25;
    return M.rings[M.next] ? M.rings[M.next].c : null;
  }
  if (M.type === 'drop') {
    const sp = M.spots[M.next]; if (!sp) return null;
    beacon.material.opacity = 0.2 + Math.sin(performance.now() / 200) * 0.08;
    ui.progress(M.done / M.spots.length);
    return sp.p;
  }
  if (M.type === 'land') {
    const d = PL.pos.distanceTo(M.thr); ui.progress(PL.onGround ? 1 : clamp(1 - d / M.startD, 0, 0.95));
    beacon.material.opacity = 0.2 + Math.sin(performance.now() / 200) * 0.08;
    if (!PL.gear && !PL.onGround && d < 380 && !M.gearHint) { M.gearHint = true; ui.pop('Gear down! (G)', '#ffe066', 30, 26); }
    return PL.onGround ? null : M.thr;
  }
  if (M.type === 'dogfight') {
    tickDrones(s);
    ui.progress(M.popped / M.drones.length);
    ui.sub(`Drones ${M.drones.length - M.popped} left · Hull ${Math.max(0, Math.round(PL.hp))}%`);
    let bestD = 1e9, t = null; for (const d of M.drones) if (d.alive) { const q = d.pos.distanceTo(PL.pos); if (q < bestD) { bestD = q; t = d.pos; } }
    return t;
  }
}
function landingTouchdown(g, vy) {
  if (M.type !== 'land' || g.type !== 'runway' || ground(PL.pos.x, PL.pos.z, {}).isl !== M.isl || M.td) {
    if (M.type === 'land' && !M.td && g.type !== 'runway') ui.pop('Wrong strip! Take off again', '#fff', 24, 26);
    return;
  }
  const L = rwLocal(M.isl, PL.pos.x, PL.pos.z), soft = clamp(1 - (-vy) / 5.2, 0, 1), cent = clamp(1 - Math.abs(L.lat) / (M.isl.runway.w / 2), 0, 1);
  M.td = { soft, cent }; const pts = Math.round(soft * 500 + cent * 300); addScore(pts);
  ui.pop(soft > 0.75 ? 'BUTTER! +' + pts : soft > 0.4 ? 'Nice touchdown +' + pts : 'Bumpy! +' + pts, '#ffe066', 34, 24);
  sfx.coin();
}
function landingRoll(s, g) {
  if (M.type !== 'land' || !M.td) return;
  if (PL.v < 1.5) { if (g.type === 'runway') { addScore(200); ui.pop('STOPPED ON THE RUNWAY +200', '#fff', 26, 30); } finish(true); }
}
function dropCrate() {
  const c = crates.find(c => !c.live); if (!c) return;
  c.live = true; c.t = 0; c.g.visible = true; c.ch.visible = false; c.g.position.copy(PL.pos).y -= 1.4; c.v.copy(PL.vel).multiplyScalar(0.9);
  tone(300, 0.15, 'triangle', 0.12, 0.5); buzz(12);
}
function crateStep(c, s) {
  c.t += s;
  if (c.t < 0.55) c.v.y -= 9.8 * s; else { c.ch.visible = true; c.v.x *= Math.exp(-0.95 * s); c.v.z *= Math.exp(-0.95 * s); c.v.y = lerp(c.v.y, -7.5, 1 - Math.exp(-2.5 * s)); }
}
function predictCrate() {
  const p = PL.pos.clone(), v = PL.vel.clone().multiplyScalar(0.9), c = { t: 0, v, ch: {} }; p.y -= 1.4;
  for (let i = 0; i < 600; i++) { crateStep(c, 1 / 30); p.addScaledVector(v, 1 / 30); if (p.y <= ground(p.x, p.z) + 0.8) return p; }
  return p;
}
function tickCrates(s) {
  for (const c of crates) {
    if (!c.live) continue;
    crateStep(c, s); c.g.position.addScaledVector(c.v, s);
    c.ch.scale.setScalar(Math.min(1, (c.t - 0.55) * 4 + 0.2));
    const gy = ground(c.g.position.x, c.g.position.z);
    if (c.g.position.y <= gy + 0.8) {
      c.live = false; setTimeout(() => { c.g.visible = false; }, 900); c.ch.visible = false; c.g.position.y = gy + 0.8;
      const sp = M.spots && M.spots[M.next];
      if (gy <= 0.01) { burst(scene, c.g.position.clone(), ['#ffffff', '#bdf3ff'], 14, { speed: 0.15, up: 0.25, size: 1.2, shape: 'sphere' }); ui.pop('In the sea!', '#fff', 28, 26); continue; }
      burst(scene, c.g.position.clone(), ['#e8d5b0', '#ffffff'], 12, { speed: 0.12, up: 0.1, size: 1, shape: 'sphere' });
      if (M.type !== 'drop' || !sp) continue;
      const d = Math.hypot(c.g.position.x - sp.p.x, c.g.position.z - sp.p.z);
      if (d < 20) {
        const pts = d < 4 ? 300 : d < 10 ? 200 : 100; addScore(pts); M.done++;
        ui.pop(d < 4 ? 'BULLSEYE! +300' : d < 10 ? 'Great drop +200' : 'Delivered +100', '#ffe066', 34, 24);
        sfx.win(); confetti(scene, c.g.position.clone().setY(gy + 3), 40); buzz(25);
        M.next++; placePad();
        if (M.done >= M.spots.length) finish(true);
        else ui.pop(`Next: ${M.spots[M.next].isl.name}`, '#fff', 24, 32);
      } else ui.pop(`${Math.round(d)} m off, go around!`, '#fff', 26, 26);
    }
  }
}
// dogfight
let fireCool = 0;
function action() {
  if (state !== 'play' || PL.dead) return;
  if (M.type === 'drop') dropCrate();
}
function aimDir(out) {
  forward(out); let bestA = 0.22, tgt = null;
  if (M.type === 'dogfight') for (const d of M.drones) if (d.alive) {
    tmp2.copy(d.pos).sub(PL.pos); const dist = tmp2.length(); if (dist > 320) continue;
    const a = tmp2.normalize().angleTo(out); if (a < bestA) { bestA = a; tgt = d; }
  }
  if (tgt) { const dist = tgt.pos.distanceTo(PL.pos), tt = dist / (PL.v + 110); out.copy(tgt.pos).addScaledVector(tgt.vel || tmp2.set(0, 0, 0), tt).sub(PL.pos).normalize(); }
  return tgt;
}
function fire(s) {
  fireCool -= s;
  if (fireCool > 0 || PL.dead) return;
  const st = PLANES[planeId]; fireCool = 0.13;
  const dir = new THREE.Vector3(); aimDir(dir);
  const right = new THREE.Vector3(Math.cos(PL.head), 0, -Math.sin(PL.head));
  const offs = st.guns === 2 ? [-1.6, 1.6] : [0];
  for (const o of offs) {
    if (SH.length >= 90) SH.shift();
    SH.push({ p: PL.pos.clone().addScaledVector(right, o).addScaledVector(fwd, 3), v: dir.clone().multiplyScalar(PL.v + 110), t: 0, c: (SH.length + o) | 0 });
  }
  tone(700 + Math.random() * 200, 0.05, 'square', 0.04, 0.5);
}
function tickDrones(s) {
  const t = performance.now() / 1000;
  M.drones.forEach((d, i) => {
    if (!d.alive) return;
    const near = d.anchor.distanceTo(tmp.set(PL.pos.x, 0, PL.pos.z)) < 380;
    if (near) d.anchor.lerp(tmp.set(PL.pos.x, 0, PL.pos.z), 0.04 * s);
    const chased = near && tmp.copy(d.pos).sub(PL.pos).normalize().dot(fwd) > 0.85 && d.pos.distanceTo(PL.pos) < 140;   // a drone with you on its tail jinks away faster
    d.ang += d.dir * M.speed * (chased ? 1.7 : 1) / d.rad * s;
    const old = d.pos.clone();
    d.pos.set(d.anchor.x + Math.cos(d.ang) * d.rad, Math.max(d.alt + Math.sin(t * 1.3 + d.bob) * 6, ground(d.pos.x, d.pos.z) + 14), d.anchor.z + Math.sin(d.ang) * d.rad);
    d.vel = d.pos.clone().sub(old).divideScalar(Math.max(s, 1e-3));
    d.flash = Math.max(0, d.flash - s * 4);
    dummy.position.copy(d.pos); dummy.lookAt(PL.pos); dummy.rotateY(Math.PI); dummy.rotation.z += Math.sin(t * 3 + i) * 0.1; dummy.scale.setScalar(2.1); dummy.updateMatrix();
    drones.setMatrixAt(i, dummy.matrix); drones.setColorAt(i, tmpC.set(d.flash > 0 ? '#ff9a9a' : '#ffffff'));
    d.cool -= s;
    const dist = d.pos.distanceTo(PL.pos);
    if (d.cool <= 0 && dist < 230 && !PL.dead && state === 'play') {
      d.cool = M.fireGap * (0.8 + Math.random() * 0.6);
      const tt = dist / 60, aim = PL.pos.clone().addScaledVector(PL.vel, tt * M.acc);
      const err = (1 - M.acc) * dist * 0.22; aim.x += (Math.random() - 0.5) * err * 2; aim.y += (Math.random() - 0.5) * err; aim.z += (Math.random() - 0.5) * err * 2;
      if (FO.length < 40) FO.push({ p: d.pos.clone(), v: aim.sub(d.pos).normalize().multiplyScalar(60), t: 0 });
      tone(240, 0.12, 'sine', 0.05, 1.6);
    }
  });
  for (let i = M.drones.length; i < drones.count; i++) { }
  drones.instanceMatrix.needsUpdate = true; if (drones.instanceColor) drones.instanceColor.needsUpdate = true;
}
function popDrone(d, i) {
  d.alive = false; M.popped++; addScore(150);
  dummy.position.set(0, -999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); drones.setMatrixAt(i, dummy.matrix); drones.instanceMatrix.needsUpdate = true;
  burst(scene, d.pos.clone(), ['#8c6bff', '#ffd23f', '#ffffff', '#ff5d8f'], 26, { speed: 0.35, up: 0.15, size: 1.6, gravity: 0.004 });
  confetti(scene, d.pos.clone(), 40); sfx.smash(); setTimeout(() => sfx.coin(), 80); buzz(30); shake = Math.max(shake, 0.3);
  ui.pop(['POP! +150', 'BONK! +150', 'SPLAT! +150'][M.popped % 3], '#ffe066', 36, 24);
  ui.sub(M.popped >= M.drones.length ? 'All drones popped!' : `Drones ${M.drones.length - M.popped} left · Hull ${Math.max(0, Math.round(PL.hp))}%`);
  if (M.popped >= M.drones.length) finish(true);
}
function tickShots(s) {
  let k = 0;
  for (let i = SH.length - 1; i >= 0; i--) {
    const b = SH[i]; b.t += s; b.p.addScaledVector(b.v, s); b.v.y -= 6 * s;
    let hit = b.t > 1.6 || b.p.y < ground(b.p.x, b.p.z);
    if (!hit && M.type === 'dogfight') M.drones.forEach((d, j) => { if (!hit && d.alive && d.pos.distanceTo(b.p) < 3.6) { hit = true; d.hp--; d.flash = 1; tone(520, 0.05, 'triangle', 0.08, 1.5); burst(scene, b.p.clone(), SHOTC[j % 5], 5, { speed: 0.12, up: 0.03, size: 0.8, gravity: 0.003 }); if (d.hp <= 0) popDrone(d, j); } });
    if (hit) SH.splice(i, 1);
  }
  for (const b of SH) { dummy.position.copy(b.p); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); shots.setMatrixAt(k++, dummy.matrix); }
  shots.count = k; shots.instanceMatrix.needsUpdate = true;
  k = 0;
  for (let i = FO.length - 1; i >= 0; i--) {
    const b = FO[i]; b.t += s; b.p.addScaledVector(b.v, s);
    let gone = b.t > 4.5;
    if (!gone && !PL.dead && PL.inv <= 0 && b.p.distanceTo(PL.pos) < 3) {
      gone = true; PL.hp -= 13 / PLANES[planeId].hp; shake = Math.max(shake, 0.5); buzz(40); ui.flash(0.25);
      burst(scene, b.p.clone(), ['#ffc8f0', '#ffffff'], 12, { speed: 0.15, up: 0.05, size: 1.2, shape: 'sphere' }); tone(160, 0.2, 'sawtooth', 0.08, 0.6);
      if (PL.hp <= 0) crash('poof', 'Foamed!');
      ui.sub(`Drones ${M.drones.length - M.popped} left · Hull ${Math.max(0, Math.round(PL.hp))}%`);
    }
    if (gone) FO.splice(i, 1);
  }
  for (const b of FO) { dummy.position.copy(b.p); dummy.scale.setScalar(1 + Math.sin(b.t * 20) * 0.1); dummy.rotation.set(b.t * 3, b.t * 2, 0); dummy.updateMatrix(); foams.setMatrixAt(k++, dummy.matrix); }
  foams.count = k; foams.instanceMatrix.needsUpdate = true;
}

// crash / respawn rules
function onCrashed() {
  if (M.type === 'land') return finish(false, 'CRASHED!', 'Land gently with the gear down');
  if (M.type === 'dogfight' && PL.hp <= 0) return finish(false, 'FOAMED!', `${M.popped}/${M.drones.length} drones popped`);
  M.respawnAt = 1.3; mLeft = Math.max(0, mLeft - 5);
}
function respawn() {
  const t = M.type;
  if (t === 'rings') {
    const g = M.rings[M.next], prev = M.next > 0 ? M.rings[M.next - 1].c : null;
    const dir = g.n.clone().setY(0).normalize(), p = g.c.clone().addScaledVector(dir, -130);
    spawn(p, Math.atan2(-dir.x, -dir.z), Math.max(g.c.y, ground(p.x, p.z) + 25));
  } else if (t === 'drop') {
    const sp = M.spots[M.next].p, a = Math.random() * TAU;
    spawn(new THREE.Vector3(sp.x + Math.cos(a) * 280, 0, sp.z + Math.sin(a) * 280), Math.atan2(Math.cos(a), Math.sin(a)), 50);
  } else if (t === 'dogfight') {
    PL.hp -= 35 / PLANES[planeId].hp;
    if (PL.hp <= 0) return finish(false, 'FOAMED!', `${M.popped}/${M.drones.length} drones popped`);
    const a = Math.random() * TAU, c = M.drones.find(d => d.alive).anchor;
    spawn(new THREE.Vector3(c.x + Math.cos(a) * 300, 0, c.z + Math.sin(a) * 300), Math.atan2(Math.cos(a), Math.sin(a)), 70);
  }
  camSnap = true;
}

// ---------------------------------------------------------------- start card hangar
const hangar = document.createElement('div'); hangar.className = 'hangar';
hangar.addEventListener('pointerdown', e => e.stopPropagation());
ui.els.start.querySelector('.hint').before(hangar);
function renderHangar() {
  const ty = missionType();
  hangar.innerHTML = `<div class="ms">${D.seed ? 'Daily mission' : 'Mission ' + level} · ${TNAME[ty]}</div>
    <div class="row">${PLANES.map((p, i) => `<button class="pl ${i === planeId ? 'sel' : ''} ${cleared >= p.need ? '' : 'lock'}" data-p="${i}">${cleared >= p.need ? '' : '🔒 '}${p.name}<small>${cleared >= p.need ? ['all-rounder', 'quick & nimble', 'tough, twin blasters', 'fastest, twin blasters'][i] : 'clear ' + p.need + ' missions'}</small></button>`).join('')}</div>
    <div class="row">${LIVERIES.map((l, i) => `<button class="dot ${i === liveryId ? 'sel' : ''} ${totalStars() >= l.need ? '' : 'lock'}" data-l="${i}" title="${l.name}${totalStars() >= l.need ? '' : ' · ' + l.need + '★'}" style="background:linear-gradient(135deg,${l.c[0]} 50%,${l.c[1]} 50%)"></button>`).join('')}</div>
    <div class="row"><button class="tg" data-inv>${pilotMode ? 'Pilot stick: drag down to climb' : 'Easy stick: drag up to climb'} ⇄</button></div>`;
  hangar.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const i = +b.dataset.p; if (cleared < PLANES[i].need) return ui.pop(`Clear ${PLANES[i].need} missions to unlock`, '#fff', 24, 70); planeId = i; S.set('plane', i); buildPlane(); sfx.pick(i); renderHangar(); });
  hangar.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const i = +b.dataset.l; if (totalStars() < LIVERIES[i].need) return ui.pop(`Earn ${LIVERIES[i].need}★ to unlock`, '#fff', 24, 70); liveryId = i; S.set('livery', i); buildPlane(); sfx.pick(i); renderHangar(); });
  hangar.querySelector('[data-inv]').onclick = () => { pilotMode = pilotMode ? 0 : 1; S.set('pilot', pilotMode); sfx.tap(); renderHangar(); };
}
renderHangar();

function begin() {
  setupMission(); state = 'play'; runStart = performance.now(); B.start();
  document.body.classList.add('playing'); hum.thr = 0.7; hum.pitch = hum.roll = 0;
  ui.pop(TNAME[M.type].toUpperCase(), '#fff', 40, 30); sfx.tap();
}
function finish(won, title = '', line = '') {
  if (state !== 'play') return;
  if (won && mLeft > 0) { const tb = Math.round(mLeft) * 10; addScore(tb); }
  if (won && M.type === 'dogfight') addScore(Math.round(Math.max(0, PL.hp)) * 3);
  state = won ? 'won' : 'lost';
  document.body.classList.remove('playing'); stickEl.hidden = true; stickId = null; warnEl.hidden = true; markEl.hidden = true;
  if (!recorded) { recorded = true; F.level(won, progressFrac()); B.submit(score, { ms: performance.now() - runStart }); }
  if (score > best) { best = score; S.set('best', best); }
  if (won) {
    const th = { rings: [0.5, 0.75], drop: [0.55, 0.8], land: [0.55, 0.8], dogfight: [0.5, 0.75] }[M.type], maxS = maxScore();
    const st = 1 + (score >= maxS * th[0] ? 1 : 0) + (score >= maxS * th[1] ? 1 : 0), key = D.seed ? 'd' + D.seed : 'm' + level;
    const before = totalStars(), prevCleared = cleared;
    if ((starsBy[key] || 0) < st) { starsBy[key] = st; S.set('stars', starsBy); }
    if (!D.seed) { cleared = Math.max(cleared, level); S.set('cleared', cleared); level++; S.set('level', level); }
    const unl = PLANES.find(p => p.need > prevCleared && p.need <= cleared), unl2 = LIVERIES.find(l => l.need > before && l.need <= totalStars());
    sfx.win(); confetti(scene, PL.pos.clone().add(new THREE.Vector3(0, 4, 0)), 90); buzz([30, 40, 30]);
    D.won(score);
    ui.win(D.seed ? 'DAILY' : level - 1, `Score ${score} · ${'★'.repeat(st)}${'☆'.repeat(3 - st)}${unl ? ` · NEW PLANE: ${unl.name}!` : ''}${unl2 ? ` · NEW PAINT: ${unl2.name}!` : ''}`);
  } else { sfx.fail(); ui.lose(title || 'MISSION FAILED', `${line}${line ? ' · ' : ''}Score ${score}`); }
  renderHangar();
}
function progressFrac() {
  if (M.type === 'rings') return M.passed / M.rings.length;
  if (M.type === 'drop') return M.done / M.spots.length;
  if (M.type === 'dogfight') return M.popped / M.drones.length;
  return M.td ? 0.8 : clamp(1 - PL.pos.distanceTo(M.thr) / M.startD, 0, 0.7);
}
function maxScore() {
  if (M.type === 'rings') return M.rings.length * 150 + M.limit * 4;
  if (M.type === 'drop') return M.spots.length * 300 + M.limit * 4;
  if (M.type === 'land') return 1000 + M.limit * 4;
  return M.drones.length * 150 + 300 + M.limit * 4;
}
ui.onTap(w => {
  if (w === 'start' || w === 'win' || w === 'lose') { ui.hideStart(); begin(); }
});

// ---------------------------------------------------------------- camera
let camSnap = true;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(s) {
  const fl = tmp.set(-Math.sin(PL.head), 0, -Math.cos(PL.head));
  const back = PL.onGround ? 13 : 15 + PL.v * 0.06, up = PL.onGround ? 4 : 4.6 - Math.sin(PL.pitch) * 3;
  const want = tmp2.copy(PL.pos).addScaledVector(fl, -back * Math.cos(PL.pitch * 0.6)).add(new THREE.Vector3(0, up - Math.sin(PL.pitch) * back * 0.55, 0));
  if (camSnap) { camPos.copy(want); camSnap = false; }
  camPos.lerp(want, 1 - Math.exp(-4.5 * s));
  const gy = ground(camPos.x, camPos.z); if (camPos.y < gy + 1.5) camPos.y = gy + 1.5;
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - s * 2); }
  forward(); camLook.copy(PL.pos).addScaledVector(fwd, 10); camLook.y += 1.2;
  const a = PL.bank * 0.4, rgt = new THREE.Vector3(Math.cos(PL.head), 0, -Math.sin(PL.head));
  camera.up.set(0, Math.cos(a), 0).addScaledVector(rgt, Math.sin(a));
  camera.lookAt(camLook);
  const f = 62 + clamp((PL.v - 30) * 0.35, -4, 10);
  if (Math.abs(camera.fov - f * (camera.aspect < 0.7 ? 1.12 : 1)) > 0.05) { camera.fov = lerp(camera.fov, f * (camera.aspect < 0.7 ? 1.12 : 1), 0.05); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- bot (QA hook): autopilot to the mission objective
function botThink(I) {
  I.fire = false;
  if (state === 'ready') { const t = performance.now() / 6000; return autopilot(I, Math.cos(t) * 180, 60, Math.sin(t) * 180, 30); }
  if (PL.dead) return;
  if (M.type === 'rings') {
    const g = M.rings[M.next]; if (!g) return;
    const ap = tmp.copy(g.c).addScaledVector(g.n, -Math.max(0, Math.min(60, PL.pos.distanceTo(g.c) - 30)));
    autopilot(I, ap.x, ap.y, ap.z, 36);
  } else if (M.type === 'drop') {
    const sp = M.spots[M.next]; if (!sp) return;
    const r = autopilot(I, sp.p.x, 38, sp.p.z, 30);
    if (r.dist < 160 && !crates.some(c => c.live)) { const q = predictCrate(); if (Math.hypot(q.x - sp.p.x, q.z - sp.p.z) < 7) dropCrate(); }
  } else if (M.type === 'land') {
    if (PL.onGround) { I.roll = 0; I.pitch = 0; I.thr = 0; return; }
    const rel = tmp.copy(PL.pos).sub(M.thr), along = rel.dot(M.ldir), lat = rel.x * -M.ldir.z + rel.z * M.ldir.x;
    if (along < -900 || Math.abs(lat) > Math.max(120, -along * 0.6)) {          // too far out or off-line: fly to the approach fix
      const fix = M.thr.clone().addScaledVector(M.ldir, -480);
      autopilot(I, fix.x, 60, fix.z, 28); return;
    }
    const aimAl = along + 80, tgt = M.thr.clone().addScaledVector(M.ldir, aimAl + 40);
    const base = RUNWAY_Y + geoInfo.gearDrop, hAbove = PL.pos.y - base, glide = base + Math.max(0, 25 - aimAl) * 0.07;
    if (!PL.flaps && along > -620) toggleFlaps(true);
    if (!PL.gear && along > -560) toggleGear(true);
    const dxh = tgt.x - PL.pos.x, dzh = tgt.z - PL.pos.z, desH = Math.atan2(-dxh, -dzh), err = wrapA(desH - PL.head);
    I.roll = clamp(-err * 2.6, -0.8, 0.8);
    let desP = clamp(Math.atan2(glide - PL.pos.y, 80), -0.2, 0.2);
    if (along > -30 && hAbove < 2.5) desP = Math.asin(clamp(-(0.7 + hAbove * 0.5) / Math.max(PL.v, 10), -0.3, 0)) + 0.02;  // flare
    I.pitch = clamp((desP - PL.pitch) * 4, -1, 1);
    I.thr = along > -30 && hAbove < 2.5 ? 0.15 : clamp(0.45 + (22 - PL.v) * 0.08, 0, 1);
  } else if (M.type === 'dogfight') {
    let bestD = 1e9, t = null; for (const d of M.drones) if (d.alive) { const q = d.pos.distanceTo(PL.pos); if (q < bestD) { bestD = q; t = d; } }
    if (!t) return;
    const r = autopilot(I, t.pos.x, t.pos.y, t.pos.z, bestD < 120 ? 24 : 38);
    forward(); I.fire = bestD < 260 && tmp.copy(t.pos).sub(PL.pos).normalize().angleTo(fwd) < 0.3;
  }
}

// ---------------------------------------------------------------- main loop
const sideV = new THREE.Vector3();
let warnT = 0;
loop((dt) => {
  const s = Math.min(dt, 2.5) / 60;
  keyInput(s);
  const auto = state === 'ready' || performance.now() < botUntil;
  let I = hum;
  if (auto) { botThink(bot); I = bot; }
  if (state === 'ready' || state === 'play') {
    if (!PL.dead) physics(s, I);
    else if (state === 'play' && M.respawnAt !== undefined) { M.respawnAt -= s; if (M.respawnAt <= 0) { M.respawnAt = undefined; respawn(); } }
    if (state === 'ready' && PL.dead) spawn(new THREE.Vector3(180, 0, 0), 0, 60);
  } else if (!PL.dead && !PL.onGround) physics(s, { pitch: 0, roll: 0, thr: 0.6 });
  if (state === 'play') {
    PL.inv = Math.max(0, PL.inv - s);
    mTime += s;
    if (!PL.dead && !(M.type === 'land' && PL.onGround)) mLeft -= s;
    ui.pill(`⏱ ${Math.max(0, Math.ceil(mLeft))}`);
    if (mLeft <= 0) finish(false, 'TIME UP!', progressText());
    if (I.fire && M.type === 'dogfight') fire(s); else fireCool -= s;
    tickCrates(s);
    tickShots(s);
    const target = state === 'play' ? missionTick(s) : null;
    pointTo(target);
    if (PL.dead && PL.deadT === 0 && state === 'play') { PL.deadT = 1e-6; onCrashed(); }
    // warnings
    warnT -= s;
    const gh = ground(PL.pos.x + fwd.x * 40, PL.pos.z + fwd.z * 40), low = !PL.onGround && !PL.dead && fwd.y < -0.15 && PL.pos.y - gh < 30;
    const w = PL.dead ? '' : PL.stall && !PL.onGround ? 'STALL · speed up!' : low && !(M.type === 'land' && PL.gear) ? 'PULL UP!' : '';
    warnEl.hidden = !w; if (w) { warnEl.textContent = w; if (warnT <= 0) { warnT = 0.5; tone(880, 0.08, 'square', 0.05, 1); } }
    $('spd').textContent = Math.round(PL.v * 1.94); $('alt').textContent = Math.max(0, Math.round((PL.pos.y - 1) * 3.28));
    thrEl.firstElementChild.nextElementSibling.style.height = `calc(${Math.round(PL.thr * 100)}% - 10px)`;
    thrEl.lastElementChild.textContent = Math.round(PL.thr * 100);
  } else { arrow.visible = false; tickCrates(s); tickShots(s); if (M.type === 'dogfight' && M.drones) tickDrones(s); }
  // plane visuals
  plane.position.copy(PL.pos); plane.rotation.set(PL.pitch, PL.head, -PL.bank);
  pGear.visible = PL.gear || PL.onGround;
  prop.rotation.z += (0.3 + PL.thr * 0.9) * dt; propDisc.material.opacity = 0.08 + PL.thr * 0.16;
  if (!PL.dead && PL.inv > 0) plane.visible = Math.floor(PL.inv * 10) % 2 === 0; else if (!PL.dead) plane.visible = true;
  sea.material.map.offset.x += 0.00004 * dt; sea.material.map.offset.y += 0.00002 * dt;
  boats.position.y = Math.sin(performance.now() / 900) * 0.15;
  tickPuffs(s);
  updateCamera(s);
  sun.target.position.set(PL.pos.x, Math.max(0, PL.pos.y - 30), PL.pos.z); sun.position.copy(sun.target.position).addScaledVector(LDIR, 200);
  engineSound();
});
function progressText() {
  if (M.type === 'rings') return `${M.passed}/${M.rings.length} rings`;
  if (M.type === 'drop') return `${M.done}/${M.spots.length} crates`;
  if (M.type === 'dogfight') return `${M.popped}/${M.drones.length} drones`;
  return 'Find the runway faster';
}
const projV = new THREE.Vector3();
function pointTo(t) {
  if (!t || PL.dead) { arrow.visible = false; markEl.hidden = true; return; }
  const d = t.distanceTo(PL.pos);
  forward();
  arrow.position.copy(PL.pos).addScaledVector(fwd, 9).add(new THREE.Vector3(0, 3.2, 0)); arrow.lookAt(t);
  arrow.scale.setScalar(1 + Math.sin(performance.now() / 160) * 0.08);
  projV.copy(t).project(camera);
  const on = projV.z < 1 && Math.abs(projV.x) < 1 && Math.abs(projV.y) < 1;
  markEl.hidden = !on || d < 25; arrow.visible = !on && d > 40;
  if (on) { markEl.style.left = (projV.x + 1) / 2 * innerWidth + 'px'; markEl.style.top = (1 - projV.y) / 2 * innerHeight + 'px'; markEl.firstElementChild.textContent = Math.round(d) + ' m'; }
}

// attract mode: circle the home island under the start card
function hooks() { M.touchdown = landingTouchdown; M.groundTick = landingRoll; M.crashed = () => {}; }
hooks();
spawn(new THREE.Vector3(180, 0, 0), 0, 60);

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() { botUntil = performance.now() + 500; },
};

// Boltline Squad — original 4v4 team deathmatch with toy robots and foam blasters. All art built in code.
import { THREE, createStage, createUI, loop, rounded, tone, note, sfx, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { part, merge, vmat, canvasTex, G, hudCSS, H, btn, banner, feed, vignette, controls, Pool, healthBars, floaters, minimap, shaker, music, robot } from './lib.js';

const NAME = 'Boltline Squad: 4v4 Robot Arena Shooter';
const TAU = Math.PI * 2, HALF = 30, R = 0.6, KILLS_TO_WIN = 25, MATCH_S = 180;
const S = createStage({ fov: 62, shadowSize: 26 });
const { scene, camera, sun, hemi, renderer } = S;
sun.intensity = 1.9; hemi.intensity = 1.05; sun.shadow.mapSize.set(2048, 2048);
scene.add(camera);
hudCSS('#ffcf3a');
const ui = createUI({ title: 'BOLTLINE<br>SQUAD', hint: 'Tap to deploy', hand: '🤖', progress: false, score: false });
const D = daily('boltline', ui, { name: NAME });
const F = flow('boltline', { par: 1400, warmup: 0 });
const B = board({ game: 'boltline-squad', label: 'Match score', limits: { maxRun: 9000, maxPerSec: 60 }, corner: 'tl' });
const save = store('boltline');
const P = { xp: save.get('xp', 0), matches: save.get('matches', 0), wins: save.get('wins', 0), best: save.get('best', 0), kills: save.get('kills', 0), gun: save.get('gun', 0) };
const saveP = () => { for (const k in P) save.set(k, P[k]); };
const rankOf = xp => { let r = 1; while (xp >= 500 * r * (r + 1) / 2) r++; return r; };
const rankXp = r => 500 * (r - 1) * r / 2;

// ---------------------------------------------------------------- weapons (stylised foam blasters)
const GUNS = [
  { name: 'Foam Rifle', rank: 1, rate: 7.5, dmg: 15, spread: 0.022, speed: 62, range: 34, mag: 30, reload: 1.5, pellets: 1, col: '#ffe066' },
  { name: 'Spark SMG', rank: 2, rate: 12, dmg: 10, spread: 0.05, speed: 58, range: 24, mag: 40, reload: 1.3, pellets: 1, col: '#9ff3ff' },
  { name: 'Bolt Scatter', rank: 4, rate: 1.5, dmg: 13, spread: 0.11, speed: 52, range: 13, mag: 6, reload: 1.8, pellets: 7, col: '#ffb3d9' },
  { name: 'Rail Lance', rank: 6, rate: 1.1, dmg: 75, spread: 0.004, speed: 140, range: 50, mag: 5, reload: 1.9, pellets: 1, col: '#c7a6ff' },
];
const BOTGUNS = [0, 0, 1, 2, 0, 1, 3];

// ---------------------------------------------------------------- maps (mirrored for fairness)
// box: [x, z, w, d, h, type] — type c container, k crate, w low wall, p planter, q kiosk, i ice, t tower
const MAPS = [
  { name: 'Foundry Yard', sky: ['#78c4ff', '#ffe3bd'], fog: '#ffe3bd', g1: '#e8c898', g2: '#dcb887', lines: '#fff6e6', pal: ['#ff7b54', '#3aa6b9', '#ffd23f', '#7c83fd', '#5bbf72'], fence: '#8a5d34',
    half: [[-14, 10, 8, 3, 3, 'c'], [12, 14, 3, 8, 3, 'c'], [0, 8.5, 7, 1.2, 1.3, 'w'], [-5, 18, 2.2, 2.2, 2, 'k'], [20, 5, 2.4, 2.4, 2, 'k'], [-23, 19, 2.2, 6, 2.6, 'c'], [-20, 2.5, 2.2, 2.2, 1.7, 'k'], [6, 22, 5, 1.2, 1.3, 'w'], [24, 18, 2.2, 2.2, 1.7, 'k'], [-9, 3, 1.2, 4, 1.3, 'w']],
    center: [[0, 0, 4, 4, 2.6, 'k']], picks: [[0, 15], [-25, 0], [25, 0], [0, -15], [-13, -3], [13, 3]] },
  { name: 'Neon Plaza', sky: ['#9b8cff', '#ffd0ec'], fog: '#ffd0ec', g1: '#d9d4e8', g2: '#cbc4df', lines: '#ffffff', pal: ['#ff5d8f', '#00c2d1', '#ffd23f', '#7b5cff', '#3ddc84'], fence: '#4a4466',
    half: [[-12, 12, 4, 4, 2.4, 'q'], [12, 12, 4, 4, 2.4, 'q'], [0, 13, 6, 1.6, 1.3, 'p'], [-21, 6, 1.6, 6, 1.3, 'p'], [21, 6, 1.6, 6, 1.3, 'p'], [-6, 22, 3, 1.2, 1.3, 'w'], [7, 21, 2.2, 2.2, 1.8, 'k'], [-15, 21, 2.2, 2.2, 1.8, 'k'], [-8, 4, 1.4, 1.4, 1.3, 'p'], [24, 21, 2.2, 3, 2.4, 'q']],
    center: [[0, 0, 5, 5, 1.4, 'f']], picks: [[0, 18], [-26, 0], [26, 0], [0, -18], [-12, 3], [12, -3]] },
  { name: 'Frost Docks', sky: ['#8fd3ff', '#f2fbff'], fog: '#eaf8ff', g1: '#eef6fb', g2: '#dbe9f2', lines: '#a9c9dd', pal: ['#3a86ff', '#ff6b6b', '#ffd166', '#06d6a0', '#8338ec'], fence: '#5c7a91',
    half: [[-16, 8, 3, 9, 3, 'c'], [9, 10, 9, 3, 3, 'c'], [-2, 17, 2.4, 2.4, 2.2, 'i'], [2, 6, 3, 1.2, 1.3, 'w'], [20, 17, 2.4, 2.4, 2, 'k'], [-25, 22, 3, 3, 2.4, 'i'], [22, 3, 2.2, 5, 1.8, 'i'], [-8, 23, 4, 1.2, 1.3, 'w'], [-6, 1, 1.4, 1.4, 1.6, 'k']],
    center: [[0, 0, 2.6, 2.6, 3.2, 't']], picks: [[0, 14], [-26, 2], [26, -2], [0, -14], [-12, -2], [12, 2]] },
];

let boxes = [], mapGroup = null, mapIdx = 0, M = MAPS[0], pickups = [];
const disp = [];
function buildMap(i) {
  if (mapGroup) { scene.remove(mapGroup); }
  disp.forEach(d => d.dispose()); disp.length = 0;
  mapIdx = i; M = MAPS[i]; mapGroup = new THREE.Group(); scene.add(mapGroup);
  document.body.style.setProperty('--bg1', M.sky[0]); document.body.style.setProperty('--bg2', M.sky[1]);
  scene.fog = new THREE.Fog(M.fog, 45, 120);
  boxes = [];
  const list = [...M.center];
  for (const b of M.half) { list.push(b); list.push([-b[0], -b[1], b[2], b[3], b[4], b[5]]); }
  const parts = [], r = rng(i * 97 + 5);
  for (const [x, z, w, d, h, t] of list) {
    boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
    const col = M.pal[Math.floor(r() * M.pal.length)];
    if (t === 'c') {
      parts.push(part(rounded(w, h, d, 0.12), col, { x, y: h / 2, z }));
      const along = w > d, n = Math.floor((along ? w : d) / 0.7);
      for (let k = 1; k < n; k++) { const o = -((along ? w : d) / 2) + k * 0.7; parts.push(part(G.box, shade(col, -0.18), along ? { x: x + o, y: h / 2, z, sx: 0.12, sy: h * 0.86, sz: d + 0.06 } : { x, y: h / 2, z: z + o, sx: w + 0.06, sy: h * 0.86, sz: 0.12 })); }
      parts.push(part(G.box, '#ffffff', { x, y: h + 0.01, z, sx: w * 0.9, sy: 0.04, sz: d * 0.9 }));
    } else if (t === 'k' || t === 'i') {
      const c = t === 'i' ? '#bfe9ff' : '#c98e52';
      parts.push(part(rounded(w, h, d, 0.1), c, { x, y: h / 2, z }));
      if (t === 'k') for (const sgn of [-1, 1]) { parts.push(part(G.box, '#8a5a32', { x, y: h / 2, z: z + sgn * (d / 2 + 0.01), sx: Math.hypot(w, h) * 0.85, sy: 0.16, sz: 0.04, rz: Math.atan2(h, w) })); parts.push(part(G.box, '#8a5a32', { x: x + sgn * (w / 2 + 0.01), y: h / 2, z, sx: 0.04, sy: 0.16, sz: Math.hypot(d, h) * 0.85, rx: Math.atan2(h, d) })); }
      else parts.push(part(G.box, '#ffffff', { x, y: h + 0.02, z, sx: w * 0.8, sy: 0.08, sz: d * 0.8 }));
    } else if (t === 'w') {
      parts.push(part(rounded(w, h, d, 0.1), '#b9b4c4', { x, y: h / 2, z }));
      const along = w > d, n = Math.max(2, Math.floor((along ? w : d) / 0.6));
      for (let k = 0; k < n; k++) { const o = -((along ? w : d) / 2) + (k + 0.5) * ((along ? w : d) / n); parts.push(part(G.box, k % 2 ? '#2b2d42' : '#ffd23f', along ? { x: x + o, y: h - 0.12, z, sx: (w / n) * 0.98, sy: 0.18, sz: d + 0.04 } : { x, y: h - 0.12, z: z + o, sx: w + 0.04, sy: 0.18, sz: (d / n) * 0.98 })); }
    } else if (t === 'p') {
      parts.push(part(rounded(w, h * 0.7, d, 0.1), '#f4efe6', { x, y: h * 0.35, z }));
      parts.push(part(G.box, '#5bbf72', { x, y: h * 0.72, z, sx: w * 0.9, sy: 0.1, sz: d * 0.9 }));
      const n = Math.max(1, Math.round(Math.max(w, d) / 2));
      for (let k = 0; k < n; k++) { const o = (k + 0.5) / n - 0.5; parts.push(part(G.sph, k % 2 ? '#3ab795' : '#52b788', { x: x + (w > d ? o * w : 0), y: h + 0.35, z: z + (w > d ? 0 : o * d), s: 0.75 })); }
    } else if (t === 'q') {
      parts.push(part(rounded(w, h * 0.75, d, 0.12), col, { x, y: h * 0.375, z }));
      parts.push(part(G.box, '#ffffff', { x, y: h * 0.9, z, sx: w + 0.6, sy: 0.3, sz: d + 0.6 }));
      for (let k = 0; k < 6; k++) parts.push(part(G.box, k % 2 ? col : '#ffffff', { x: x - (w + 0.6) / 2 + (k + 0.5) * (w + 0.6) / 6, y: h * 0.78, z: z + d / 2 + 0.35, sx: (w + 0.6) / 6, sy: 0.22, sz: 0.06 }));
    } else if (t === 'f') {
      parts.push(part(new THREE.CylinderGeometry(w / 2 + 0.3, w / 2 + 0.5, h * 0.6, 24), '#f4efe6', { x, y: h * 0.3, z }));
      parts.push(part(new THREE.CylinderGeometry(w / 2, w / 2, 0.1, 24), '#5ad7ff', { x, y: h * 0.6, z }));
      parts.push(part(G.cyl, '#f4efe6', { x, y: h, z, sx: 0.4, sz: 0.4, sy: h * 0.9 }));
      parts.push(part(G.sph, '#5ad7ff', { x, y: h * 1.5, z, s: 0.55 }));
    } else if (t === 't') {
      parts.push(part(rounded(w, h, d, 0.12), '#5c7a91', { x, y: h / 2, z }));
      parts.push(part(G.box, '#ffd23f', { x, y: h + 0.05, z, sx: w + 0.2, sy: 0.1, sz: d + 0.2 }));
      parts.push(part(G.cyl, '#2b2d42', { x, y: h + 1.2, z, sx: 0.12, sz: 0.12, sy: 2.4 }));
      parts.push(part(G.sph, '#ff4d6d', { x, y: h + 2.5, z, s: 0.25 }));
    }
  }
  // perimeter fence + posts + team bases
  for (let k = -HALF; k <= HALF; k += 3) for (const [x, z] of [[k, -HALF - 0.5], [k, HALF + 0.5], [-HALF - 0.5, k], [HALF + 0.5, k]]) parts.push(part(G.box, M.fence, { x, y: 1.1, z, sx: 0.4, sy: 2.2, sz: 0.4 }));
  for (const s of [-1, 1]) { parts.push(part(G.box, shade(M.fence, 0.25), { x: 0, y: 0.9, z: s * (HALF + 0.5), sx: HALF * 2 + 1, sy: 1.2, sz: 0.2 })); parts.push(part(G.box, shade(M.fence, 0.25), { x: s * (HALF + 0.5), y: 0.9, z: 0, sx: 0.2, sy: 1.2, sz: HALF * 2 + 1 })); }
  const geo = merge(parts); disp.push(geo);
  const mesh = new THREE.Mesh(geo, vmat({ roughness: 0.65 })); mesh.castShadow = true; mesh.receiveShadow = true; mapGroup.add(mesh);
  // skyline outside the arena (no shadows)
  const sky = [], r2 = rng(i * 13 + 2);
  for (let k = 0; k < 44; k++) {
    const a = k / 44 * TAU, d = 52 + r2() * 20, w = 5 + r2() * 8, h = 6 + r2() * 18;
    sky.push(part(G.box, shade(M.pal[k % M.pal.length], 0.35), { x: Math.cos(a) * d, y: h / 2 - 0.5, z: Math.sin(a) * d, sx: w, sy: h, sz: w, ry: a }));
    if (i === 2 && k % 5 === 0) sky.push(part(G.box, '#ffd23f', { x: Math.cos(a) * (d - 4), y: h + 4, z: Math.sin(a) * (d - 4), sx: 0.6, sy: 8, sz: 0.6 }));
  }
  const sg = merge(sky); disp.push(sg); mapGroup.add(new THREE.Mesh(sg, vmat({ roughness: 0.9 })));
  // ground texture (whole arena on one canvas)
  const tex = canvasTex(1024, 1024, (g, W) => {
    const s = W / 80, X = x => (x + 40) * s;
    g.fillStyle = M.g2; g.fillRect(0, 0, W, W);
    g.fillStyle = M.g1; g.fillRect(X(-HALF), X(-HALF), HALF * 2 * s, HALF * 2 * s);
    g.globalAlpha = 0.5; for (let x = -HALF; x <= HALF; x += 4) { g.fillStyle = M.g2; g.fillRect(X(x) - 1, X(-HALF), 2, HALF * 2 * s); g.fillRect(X(-HALF), X(x) - 1, HALF * 2 * s, 2); }
    g.globalAlpha = 1;
    for (let k = 0; k < 2500; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.12)'; g.fillRect(Math.random() * W, Math.random() * W, 2 + Math.random() * 5, 2 + Math.random() * 4); }
    g.strokeStyle = M.lines; g.lineWidth = 6; g.strokeRect(X(-HALF + 1), X(-HALF + 1), (HALF * 2 - 2) * s, (HALF * 2 - 2) * s);
    g.beginPath(); g.arc(X(0), X(0), 7 * s, 0, TAU); g.stroke();
    for (const [z, c] of [[HALF - 4, '#3a86ff'], [-HALF + 4, '#ff7a3d']]) { g.fillStyle = c; g.globalAlpha = 0.28; g.beginPath(); g.ellipse(X(0), X(z), 12 * s, 3.5 * s, 0, 0, TAU); g.fill(); g.globalAlpha = 1; g.strokeStyle = c; g.lineWidth = 5; g.stroke(); }
  });
  disp.push(tex);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; mapGroup.add(ground); disp.push(ground.geometry, ground.material);
  const far = new THREE.Mesh(new THREE.CircleGeometry(160, 32), new THREE.MeshStandardMaterial({ color: M.g2, roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = -0.02; mapGroup.add(far); disp.push(far.geometry, far.material);
  // pickups
  pickups = M.picks.map(([x, z], k) => {
    const type = ['heal', 'over', 'speed', 'heal', 'bomb', 'over'][k % 6];
    const g = new THREE.Group(); g.position.set(x, 0, z); mapGroup.add(g);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.12, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: PK[type].c, emissiveIntensity: 0.5 })); pad.position.y = 0.06; g.add(pad);
    const icon = new THREE.Mesh(PK[type].geo, vmat({ emissive: new THREE.Color(PK[type].c), emissiveIntensity: 0.25 })); icon.position.y = 1.1; icon.castShadow = true; g.add(icon);
    return { x, z, type, g, icon, t: 0 };
  });
}
const shade = (c, a) => { const k = new THREE.Color(c); return a > 0 ? '#' + k.lerp(new THREE.Color('#ffffff'), a).getHexString() : '#' + k.multiplyScalar(1 + a).getHexString(); };
const PK = {
  heal: { c: '#3ddc84', label: 'REPAIR +60', geo: merge([part(rounded(0.7, 0.7, 0.3, 0.08), '#ffffff', {}), part(G.box, '#3ddc84', { sx: 0.5, sy: 0.14, sz: 0.34 }), part(G.box, '#3ddc84', { sx: 0.14, sy: 0.5, sz: 0.34 })]) },
  over: { c: '#ffb703', label: 'OVERCHARGE', geo: merge([part(G.box, '#ffb703', { sx: 0.18, sy: 0.6, sz: 0.18, rz: 0.4, x: 0.08, y: 0.12 }), part(G.box, '#ffb703', { sx: 0.18, sy: 0.6, sz: 0.18, rz: 0.4, x: -0.08, y: -0.2 }), part(G.sph, '#fff3b0', { s: 0.12, y: 0.35 })]) },
  speed: { c: '#00c2ff', label: 'SPEED BOOST', geo: merge([part(G.cone, '#00c2ff', { s: 0.32, sy: 0.5, rz: -Math.PI / 2 }), part(G.cone, '#7fe3ff', { s: 0.28, sy: 0.45, rz: -Math.PI / 2, x: -0.3 })]) },
  bomb: { c: '#ff5d8f', label: '+1 FOAM BOMB', geo: merge([part(G.sph, '#ff5d8f', { s: 0.32 }), part(G.cyl, '#ffffff', { s: 0.33, sy: 0.08 }), part(G.cyl, '#2b2d42', { y: 0.36, sx: 0.06, sz: 0.06, sy: 0.14 })]) },
};

// ---------------------------------------------------------------- geometry helpers
function segBox(ax, az, bx, bz, b, pad = 0) {   // 2D segment vs AABB, returns entry t in [0,1] or -1
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, b.x0 - pad, b.x1 + pad], [az, dz, b.z0 - pad, b.z1 + pad]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return -1; continue; }
    let u0 = (lo - p) / d, u1 = (hi - p) / d; if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) return -1;
  }
  return t0;
}
function los(a, b) { for (const bx of boxes) if (segBox(a.x, a.z, b.x, b.z, bx) >= 0) return false; return true; }
function blocked(x, z, r = R) { if (Math.abs(x) > HALF - r || Math.abs(z) > HALF - r) return true; for (const b of boxes) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true; return false; }
function collide(p, r = R) {
  p.x = clamp(p.x, -HALF + r, HALF - r); p.z = clamp(p.z, -HALF + r, HALF - r);
  for (const b of boxes) {
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { const o = [[b.x0 - r - p.x, 0], [b.x1 + r - p.x, 0], [0, b.z0 - r - p.z], [0, b.z1 + r - p.z]].sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]))[0]; p.x += o[0]; p.z += o[1]; }
    }
  }
}
const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ---------------------------------------------------------------- units
const TEAM = [{ name: 'Voltlings', col: '#3a86ff', body: '#3a86ff', trim: '#ffd23f', visor: '#9ff3ff', bar: '#4da3ff' }, { name: 'Rustbolts', col: '#ff7a3d', body: '#ff7a3d', trim: '#3d3a4b', visor: '#ffe066', bar: '#ff6a4d' }];
const CALL = ['Sprocket', 'Nimbus', 'Widget', 'Ferro', 'Gizmo', 'Rivet', 'Kepler', 'Tinker', 'Dynamo', 'Piston', 'Quark', 'Servo', 'Volta', 'Bramble'];
const KINDS = ['bolt', 'scout', 'heavy', 'tank'];
const units = [];
let player = null;
function makeUnits() {
  for (const u of units) scene.remove(u.mesh); units.length = 0;
  const r = rng((D.seed || Date.now()) % 99991 + 3), names = [...CALL].sort(() => r() - 0.5);
  const paint = PAINTS[Math.min(PAINTS.length - 1, Math.floor((rankOf(P.xp) - 1) / 2))];
  for (let t = 0; t < 2; t++) for (let i = 0; i < 4; i++) {
    const me = t === 0 && i === 0, T = TEAM[t];
    const mesh = robot(me ? { body: paint.body, trim: paint.trim, visor: paint.visor, kind: 'bolt' } : { body: T.body, trim: T.trim, visor: T.visor, kind: KINDS[(i + t) % 4], s: 0.98 });
    scene.add(mesh);
    const u = { id: units.length, team: t, me, name: me ? 'You' : (t ? 'Rust ' : 'Volt ') + names[units.length], mesh, p: new THREE.Vector3(), yaw: 0, hp: 100, alive: true, gun: me ? P.gun : BOTGUNS[(i * 3 + t) % BOTGUNS.length], ammo: 0, reload: 0, cd: 0,
      kills: 0, deaths: 0, streak: 0, respawn: 0, prot: 0, lastHit: 0, target: null, react: 0, think: 0, goal: null, goalT: 0, strafe: 1, strafeT: 0, stuckT: 0, lastP: new THREE.Vector3(), side: r() < 0.5 ? 1 : -1, walkT: r() * 10, vel: new THREE.Vector3(), boost: 0, over: 0, lastAttacker: null };
    u.ammo = GUNS[u.gun].mag;
    if (me) { player = u; const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; mesh.add(ring); }
    units.push(u); spawn(u, true);
  }
}
const PAINTS = [{ body: '#2f7bff', trim: '#ffd23f', visor: '#9ff3ff' }, { body: '#20c997', trim: '#ffd23f', visor: '#e8fffb' }, { body: '#7b5cff', trim: '#ffe066', visor: '#ffb3ff' }, { body: '#ffd23f', trim: '#2b2d42', visor: '#9ff3ff' }];
function spawn(u, first = false) {
  const zBase = u.team === 0 ? HALF - 4 : -HALF + 4, enemies = units.filter(e => e.team !== u.team && e.alive);
  let best = null, bs = -1;
  for (let k = 0; k < 8; k++) {
    const x = (k / 7 - 0.5) * 20, z = zBase + (Math.random() - 0.5) * 2;
    if (blocked(x, z)) continue;
    const s = enemies.reduce((m, e) => Math.min(m, Math.hypot(e.p.x - x, e.p.z - z)), 99) + Math.random() * 3 - (first ? Math.abs(x - (u.id % 4 - 1.5) * 5) * 3 : 0);
    if (s > bs) { bs = s; best = [x, z]; }
  }
  best = best || [(u.id % 4 - 1.5) * 4, zBase];
  u.p.set(best[0], 0, best[1]); u.yaw = u.team === 0 ? Math.PI : 0; u.hp = 100; u.alive = true; u.prot = 1.6; u.streak = 0; u.ammo = GUNS[u.gun].mag; u.reload = 0;
  u.target = null; u.goal = null; u.mesh.visible = true; u.mesh.position.copy(u.p); u.mesh.rotation.y = u.yaw; u.lastAttacker = null;
  if (!first) { u.mesh.flash('#9ff3ff', 1.5); spark(u.p.clone().setY(1), ['#9ff3ff', '#ffffff'], 14, 0.12); }
}

// ---------------------------------------------------------------- effects pools
const BULLET = new THREE.CapsuleGeometry(0.07, 0.7, 2, 6); BULLET.rotateX(Math.PI / 2);
const bullets = new Pool(scene, BULLET, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 260, { colors: true });
const sparks = new Pool(scene, new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 400, { colors: true });
const chunks = new Pool(scene, rounded(0.32, 0.22, 0.26, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), 120, { colors: true });
chunks.mesh.castShadow = true;
const flashes = new Pool(scene, new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.9 }), 40);
const rings = new Pool(scene, (() => { const g = new THREE.RingGeometry(0.85, 1, 32); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 30, { colors: true });
function spark(pos, cols, n = 10, sp = 0.1, up = 0.08) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, b = Math.random() * 0.9 + 0.1; sparks.spawn({ p: pos.clone(), v: new THREE.Vector3(Math.cos(a) * sp * b * 60, (up + Math.random() * up) * 60, Math.sin(a) * sp * b * 60), life: 0.5 + Math.random() * 0.4, color: cols[i % cols.length], s: 0.6 + Math.random() * 0.8, spin: 1 }); }
}
function ring(pos, color, size = 1, life = 0.5, grow = 8) { rings.spawn({ p: pos.clone().setY(0.08), v: new THREE.Vector3(), life, l0: life, color, s: size, grow }); }
const bars = healthBars(scene, camera, 16), fl = floaters(camera), shake = shaker();

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.bs-top{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:10px;padding:5px 12px;font:900 22px/1 'Baloo 2',system-ui,sans-serif;pointer-events:none}
.bs-top b{min-width:30px;text-align:center}.bs-top .bl{color:#7cb8ff}.bs-top .or{color:#ffa06b}.bs-top span{font-size:15px;opacity:.9;min-width:42px;text-align:center}
.bs-to{position:fixed;top:calc(48px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;font:800 11px/1 system-ui,sans-serif;letter-spacing:.08em;opacity:.85;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.5);white-space:nowrap}
.bs-bot{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none;font:800 13px/1 system-ui,sans-serif}
.bs-hp{width:170px;height:14px;border-radius:8px;background:rgba(14,20,36,.6);overflow:hidden;border:1px solid rgba(255,255,255,.3)}
.bs-hp i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#3ddc84,#b6f7d0);transition:width .15s}
.bs-hp.low i{background:linear-gradient(90deg,#ff4d6d,#ffb3c1)}
.bs-row{display:flex;gap:8px;white-space:nowrap;align-items:center;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.bs-pips{display:flex;gap:4px}.bs-pips i{width:12px;height:12px;border-radius:3px;background:rgba(255,255,255,.25);transform:rotate(45deg)}.bs-pips i.on{background:#ffcf3a;box-shadow:0 0 8px #ffcf3a}
.bs-cross{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;z-index:5;pointer-events:none}
.bs-cross i{position:absolute;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.6);border-radius:2px}
.bs-cross i:nth-child(1){left:16px;top:0;width:2px;height:10px}.bs-cross i:nth-child(2){left:16px;bottom:0;width:2px;height:10px}.bs-cross i:nth-child(3){top:16px;left:0;height:2px;width:10px}.bs-cross i:nth-child(4){top:16px;right:0;height:2px;width:10px}
.bs-cross.lock i{background:#ff5d5d}.bs-cross.hit{transform:rotate(45deg) scale(1.15)}.bs-cross.hit i{background:#fff}
.bs-dead{position:fixed;left:0;right:0;top:40%;z-index:9;text-align:center;pointer-events:none;font:900 34px/1.1 'Baloo 2',system-ui,sans-serif;-webkit-text-stroke:6px rgba(10,14,30,.85);paint-order:stroke fill;display:none}
.bs-dead small{display:block;font-size:18px;-webkit-text-stroke:4px rgba(10,14,30,.85)}
.bs-mute{position:fixed;left:calc(10px + env(safe-area-inset-left));top:calc(62px + env(safe-area-inset-top));z-index:8;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:16px;cursor:pointer}
.hc-card .bs-meta{font:800 15px/1.3 system-ui,sans-serif;opacity:.95}
.hc-card .bs-xp{width:220px;height:10px;border-radius:6px;background:rgba(0,0,0,.25);overflow:hidden;margin:2px auto}.hc-card .bs-xp i{display:block;height:100%;background:#ffcf3a}
.hc-card.dim,.hc-card.bs-dim{background:linear-gradient(180deg,rgba(10,14,40,.55),rgba(10,14,40,.25))}
`; document.head.appendChild(css);
const top = H('<div class="bs-top ax-glass"><b class="bl">0</b><span>3:00</span><b class="or">0</b></div>');
const toEl = H(`<div class="bs-to">FIRST TO ${KILLS_TO_WIN}</div>`);
const bot = H('<div class="bs-bot"><div class="bs-row"><span data-sc>0</span>·<span data-gun></span>·<span data-ammo></span></div><div class="bs-hp"><i></i></div><div class="bs-row"><div class="bs-pips"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>');
const cross = H('<div class="bs-cross"><i></i><i></i><i></i><i></i></div>');
const deadEl = H('<div class="bs-dead"></div>');
const mute = H('<div class="bs-mute ax-glass">🔊</div>');
const say = banner(), kfeed = feed({ right: 10, top: 120 }), vign = vignette();
const mm = minimap(100, { right: 10, top: 10 });
const ctl = controls({ mode: 'look', labels: ['MOVE', 'LOOK'], lockOnClick: true, canvas: renderer.domElement });
let fireHeld = false;
const fireB = btn('FIRE', { right: 16, bottom: 196, size: 78 }, () => { fireHeld = true; });
fireB.addEventListener('pointerup', () => { fireHeld = false; }); fireB.addEventListener('pointerleave', () => { fireHeld = false; }); fireB.addEventListener('pointercancel', () => { fireHeld = false; });
const bombB = btn('FOAM<br>BOMB', { right: 104, bottom: 236, size: 58 }, () => throwBomb(player));
const streakB = btn('PERK', { right: 20, bottom: 290, size: 62 }, () => useStreak());
const hudEls = [top, toEl, bot, cross, fireB, bombB, streakB, mm.el];
const FINE = matchMedia('(pointer: fine)').matches && !('ontouchstart' in window);
const showHud = v => { hudEls.forEach(e => e.style.display = v ? '' : 'none'); if (FINE) fireB.style.display = 'none'; ctl.enabled = v; ctl.refresh(); };
if (FINE) ui.els.start.querySelector('.hint').lastChild.textContent = 'Click to deploy · WASD + mouse';
mute.addEventListener('pointerdown', e => { e.stopPropagation(); mute.textContent = song.toggle() ? '🔊' : '🔈'; if (song.on && state === 'play') song.start(); });
const song = music({ bpm: 124, bars: [[57, 'min'], [53, 'maj'], [60, 'maj'], [55, 'maj']], lead: [69, 0, 72, 0, 74, 72, 0, 69, 67, 0, 69, 0, 72, 0, 76, 0, 77, 0, 76, 74, 0, 72, 0, 0, 74, 0, 72, 69, 0, 67, 69, 0] });
mute.textContent = song.on ? '🔊' : '🔈';
ctl.onKey = code => { if (state !== 'play') return; if (code === 'KeyQ' || code === 'KeyG') throwBomb(player); if (code === 'KeyE' || code === 'KeyF') useStreak(); if (code === 'KeyR') startReload(player); if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3' || code === 'Digit4') swapGun(+code.slice(-1) - 1); };

// start card: blaster pick (chips sit high so the start tap lands on the card)
const startMeta = H('<div class="bs-meta"></div>', ui.els.start);
const chips = H('<div class="ax-chips"></div>', ui.els.start);
ui.els.start.querySelector('h1').after(startMeta); startMeta.after(chips);
function paintStart() {
  const r = rankOf(P.xp), lo = rankXp(r), hi = rankXp(r + 1);
  startMeta.innerHTML = `RANK ${r} · ${P.wins} wins · best ${P.best}<div class="bs-xp"><i style="width:${Math.round((P.xp - lo) / (hi - lo) * 100)}%"></i></div>Next map: ${MAPS[nextMap()].name}`;
  chips.innerHTML = GUNS.map((g, i) => `<button class="ax-chip" data-g="${i}" aria-pressed="${i === P.gun}" ${r < g.rank ? 'disabled' : ''}>${g.name}<small>${r < g.rank ? '🔒 rank ' + g.rank : g.pellets > 1 ? 'close range' : g.rate > 10 ? 'fast fire' : g.dmg > 50 ? 'long range' : 'all-round'}</small></button>`).join('');
  chips.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); if (b.disabled) return; P.gun = +b.dataset.g; saveP(); paintStart(); sfx.tap(); }; });
}
const nextMap = () => D.seed ? D.seed % 3 : P.matches % 3;

// ---------------------------------------------------------------- game state
let state = 'ready', score = 0, teamK = [0, 0], tLeft = MATCH_S, matchN = P.matches + 1, recorded = false, beatenShown = false, fk = 1, t0 = 0;
let streaks = [], drone = null, shield = 0, bombs = 2, bombCd = 0, bombsLive = [], volley = [], deadT = 0, killer = null, hitT = 0, camYaw = 0, camPitch = 0.12, lastStreakPop = 0;
const PERKS = { 3: { id: 'drone', name: 'SCOUT DRONE', icon: '🛸' }, 5: { id: 'shield', name: 'BUBBLE SHIELD', icon: '🫧' }, 7: { id: 'volley', name: 'SKY VOLLEY', icon: '🎯' } };

function newMatch() {
  buildMap(nextMap()); fk = F.k(); makeUnits();
  state = 'ready'; score = 0; teamK = [0, 0]; tLeft = MATCH_S; recorded = false; beatenShown = false; matchN = P.matches + 1;
  streaks = []; shield = 0; bombs = 2; bombCd = 0; bombsLive.forEach(b => scene.remove(b.mesh)); bombsLive = []; volley = []; deadT = 0; killer = null;
  if (drone) { scene.remove(drone.mesh); drone = null; }
  bullets.clear(); sparks.clear(); chunks.clear(); fl.clear();
  camYaw = player.yaw; toEl.textContent = `FIRST TO ${KILLS_TO_WIN}${D.isDaily ? ' · DAILY' : ''}`;
  hud(); paintStart();
}
function begin() {
  state = 'play'; t0 = performance.now(); B.start(); showHud(true); song.start(); song.intensity = 0.5;
  say(M.name.toUpperCase(), `Team deathmatch · first to ${KILLS_TO_WIN}`, 1800); note(69, 0.3, 0.15); setTimeout(() => note(76, 0.4, 0.15), 160);
}

// ---------------------------------------------------------------- shooting
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function fwd(yaw, v = new THREE.Vector3()) { return v.set(Math.sin(yaw), 0, Math.cos(yaw)); }
function shoot(u, err = 0) {
  const g = GUNS[u.gun];
  if (u.reload > 0 || u.cd > 0) return;
  if (u.ammo <= 0) { startReload(u); return; }
  u.cd = 1 / (g.rate * (u.over > 0 ? 1.6 : 1)); u.ammo--;
  u.mesh.updateMatrixWorld(); u.mesh.muzzle.getWorldPosition(tmp); tmp.y = 1.25;
  for (let k = 0; k < g.pellets; k++) {
    const a = u.yaw + (Math.random() - 0.5) * 2 * (g.spread + err);
    bullets.spawn({ p: tmp.clone(), v: fwd(a).multiplyScalar(g.speed), life: g.range / g.speed, owner: u, dmg: g.dmg, color: u.team === 0 ? (u.me ? g.col : '#9fd0ff') : '#ffb07a', s: g.dmg > 50 ? 1.8 : 1 });
  }
  flashes.spawn({ p: tmp.clone(), v: new THREE.Vector3(), life: 0.06, s: g.pellets > 1 ? 1.8 : 1.2 });
  u.mesh.recoil();
  const d = u.me ? 0 : player ? u.p.distanceTo(player.p) : 30;
  if (d < 32) { const v = u.me ? 0.07 : 0.035 * (1 - d / 32); if (v > 0.004) tone(u.me ? (g.pellets > 1 ? 220 : g.dmg > 50 ? 1200 : 760) : 520, g.pellets > 1 ? 0.12 : 0.05, u.me ? 'square' : 'triangle', v, g.dmg > 50 ? 0.3 : 0.45); }
  if (u.me) { shake.kick(g.pellets > 1 ? 0.18 : g.dmg > 50 ? 0.25 : 0.03); buzz(g.pellets > 1 ? 18 : 6); }
  if (u.ammo <= 0) startReload(u);
}
function startReload(u) { if (u.reload > 0 || u.ammo >= GUNS[u.gun].mag) return; u.reload = GUNS[u.gun].reload; if (u.me) { tone(300, 0.08, 'square', 0.05, 1.4); setTimeout(() => tone(420, 0.06, 'square', 0.05, 1.2), 250); } }
function swapGun(i) { if (i < 0 || i >= GUNS.length || rankOf(P.xp) < GUNS[i].rank || player.gun === i) return; player.gun = P.gun = i; player.ammo = 0; player.reload = 0; startReload(player); saveP(); ui.pop(GUNS[i].name.toUpperCase(), '#fff', 24, 70); }
function damage(v, dmg, from, pos) {
  if (!v.alive || v.prot > 0 || state !== 'play') return;
  if (v.me && shield > 0) { spark(pos, ['#9ff3ff', '#ffffff'], 4, 0.08); return; }
  v.hp -= dmg; v.lastHit = 0; v.mesh.flash(v.me ? '#ff4d6d' : '#ffffff', 1);
  if (from) v.lastAttacker = from;
  if (from && from.me) { fl.add(Math.round(dmg), pos.clone().setY(2.1), dmg >= 40 ? '#ffcf3a' : '#ffffff', dmg >= 40 ? 26 : 18); hitT = 0.12; tone(1500, 0.03, 'square', 0.04, 0.8); }
  if (v.me) { hurtV = 0.7; shake.kick(0.12); buzz(12); if (from) camHurt = angTo(v.p, from.p); }
  if (!v.me && from && v.target !== from && !v.target) { v.target = from; v.react = 0.25; }
  if (v.hp <= 0) kill(v, from);
}
let camHurt = null, hurtV = 0;
function kill(v, by) {
  v.alive = false; v.hp = 0; v.deaths++; v.respawn = v.me ? 3.2 : 3.8; v.mesh.visible = false;
  const c = v.mesh.position.clone().setY(1.1), T = TEAM[v.team];
  spark(c, ['#ffd23f', '#ffffff', T.col, '#9ff3ff'], 26, 0.16, 0.12);
  for (let i = 0; i < 9; i++) { const a = Math.random() * TAU; chunks.spawn({ p: c.clone(), v: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 4), 4 + Math.random() * 5, Math.sin(a) * (2 + Math.random() * 4)), life: 1.6, color: i % 3 ? T.body : T.trim, s: 0.8 + Math.random() * 0.7, spin: 1 }); }
  ring(c, T.col, 0.5, 0.45, 9);
  if (by && by.team !== v.team) { by.kills++; by.streak++; teamK[by.team]++; }
  const d = player ? v.p.distanceTo(player.p) : 30;
  if (d < 35) { tone(180, 0.25, 'square', 0.08 * (1 - d / 40) + 0.02, 0.4); tone(90, 0.3, 'sawtooth', 0.05, 0.5); }
  kfeed(`<span style="color:${by ? TEAM[by.team].col : '#fff'}">${by ? by.name : '💥'}</span> ⚡ <span style="color:${T.col}">${v.name}</span>`);
  if (by && by.me) {
    let pts = 100 + Math.max(0, by.streak - 2) * 25; addScore(pts);
    const names = ['', 'DOWNED!', 'DOUBLE!', 'TRIPLE!', 'RAMPAGE!', 'UNSTOPPABLE!', 'BOLT STORM!'];
    ui.pop(`${names[Math.min(6, by.streak)] || 'DOWNED!'} +${pts}`, by.streak >= 3 ? '#ffcf3a' : '#fff', 30 + Math.min(by.streak, 6) * 2, 24);
    [0, 4, 7].forEach((s, i) => setTimeout(() => note(76 + s + Math.min(by.streak, 5), 0.18, 0.12), i * 60)); buzz([10, 20, 30]); shake.kick(0.2);
    const perk = PERKS[by.streak]; if (perk) { streaks.push(perk.id); say(`${perk.icon} ${perk.name}`, 'Perk ready: tap PERK (E)', 1600); sfx.win(); }
  }
  if (v.me) {
    killer = by; deadT = 0; streaks = streaks.slice(0, 1); vign(1); buzz([40, 30, 80]); sfx.fail();
    deadEl.style.display = 'block'; deadEl.innerHTML = `DOWNED<small>by ${by ? by.name : 'a foam bomb'}</small>`;
    if (drone) { scene.remove(drone.mesh); drone = null; } shield = 0;
  }
  hud();
  if (teamK[0] >= KILLS_TO_WIN || teamK[1] >= KILLS_TO_WIN) endMatch();
}
function addScore(n) {
  score += n; hud();
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); spark(player.p.clone().setY(2), ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff'], 40, 0.2, 0.15); }
  B.submit(score, { ms: performance.now() - t0 });   // best mode: today's best = best match score so far
}

// ---------------------------------------------------------------- foam bombs + perks
const BOMBGEO = PK.bomb.geo;
function throwBomb(u) {
  if (state !== 'play' || !u.alive || bombs <= 0 || bombCd > 0) return;
  bombs--; bombCd = 1.2;
  const m = new THREE.Mesh(BOMBGEO, vmat()); m.castShadow = true; scene.add(m);
  const f = fwd(u.yaw), tgt = aimTarget(u, 22), dist = tgt ? clamp(u.p.distanceTo(tgt.p), 5, 18) : 12;
  const p = u.p.clone().setY(1.6), v = f.multiplyScalar(dist / 0.9); v.y = 0.45 * 9.8;
  bombsLive.push({ mesh: m, p, v, t: 0, owner: u }); tone(400, 0.12, 'sine', 0.1, 1.8); hud();
}
function explode(b) {
  if (b.mesh) scene.remove(b.mesh);
  const c = b.p.clone(); c.y = 0.6;
  spark(c, ['#ff5d8f', '#ffffff', '#ffd6e8', '#ffd23f'], 34, 0.2, 0.12); ring(c, '#ff5d8f', 0.6, 0.5, 14); ring(c, '#ffffff', 0.3, 0.35, 10);
  sfx.smash(); shake.kick(Math.max(0, 0.5 - player.p.distanceTo(c) / 40)); buzz(30);
  for (const u of units) { if (!u.alive || u.team === b.owner.team) continue; const d = Math.hypot(u.p.x - c.x, u.p.z - c.z); if (d < 4.6 && los(c, u.p)) damage(u, 95 * (1 - d / 6), b.owner, u.p.clone().setY(1.2)); }
}
function useStreak() {
  if (state !== 'play' || !player.alive || !streaks.length) return;
  const id = streaks.shift(); sfx.win(); buzz(20);
  if (id === 'drone') {
    if (drone) scene.remove(drone.mesh);
    const g = new THREE.Group(), body = new THREE.Mesh(merge([part(G.sph, '#ffd23f', { sx: 0.4, sy: 0.22, sz: 0.4 }), part(G.box, '#2b2d42', { sx: 1.3, sy: 0.06, sz: 0.12 }), part(G.box, '#2b2d42', { sx: 0.12, sy: 0.06, sz: 1.3 }), part(G.box, '#9ff3ff', { z: 0.32, sx: 0.2, sy: 0.08, sz: 0.1 }), ...[[0.65, 0], [-0.65, 0], [0, 0.65], [0, -0.65]].map(([x, z]) => part(G.cyl, '#ffffff', { x, z, y: 0.06, sx: 0.28, sz: 0.28, sy: 0.02 }))]), vmat({ emissive: new THREE.Color('#ffd23f'), emissiveIntensity: 0.2 }));
    body.castShadow = true; g.add(body); scene.add(g);
    drone = { mesh: g, t: 15, cd: 0, a: 0 }; say('🛸 SCOUT DRONE', 'Covering you for 15 s', 1200);
  } else if (id === 'shield') { shield = 7; say('🫧 BUBBLE SHIELD', '7 s untouchable', 1200); }
  else if (id === 'volley') {
    say('🎯 SKY VOLLEY', 'Targets marked', 1200);
    for (const e of units) if (e.alive && e.team !== 0) { volley.push({ x: e.p.x, z: e.p.z, t: 1.5 }); ring(new THREE.Vector3(e.p.x, 0, e.p.z), '#ff4d6d', 3.2, 1.5, 0); }
  }
  hud();
}

// ---------------------------------------------------------------- AI
function aimTarget(u, range) {
  let best = null, bd = 1e9;
  for (const e of units) { if (e.team === u.team || !e.alive) continue; const d = u.p.distanceTo(e.p); if (d < range && d < bd && los(u.p, e.p)) { bd = d; best = e; } }
  return best;
}
function pickGoal(u) {
  const r = Math.random(), enemies = units.filter(e => e.team !== u.team && e.alive);
  if (r < 0.55 && enemies.length) { const e = enemies[Math.floor(Math.random() * enemies.length)]; return new THREE.Vector3(e.p.x + (Math.random() - 0.5) * 8, 0, e.p.z + (Math.random() - 0.5) * 8); }
  if (r < 0.75 && pickups.length) { const k = pickups[Math.floor(Math.random() * pickups.length)]; return new THREE.Vector3(k.x, 0, k.z); }
  for (let k = 0; k < 20; k++) { const x = (Math.random() - 0.5) * 50, z = (Math.random() - 0.5) * 50 * (u.team === 0 ? -0.6 : 0.6) + (u.team === 0 ? -4 : 4); if (!blocked(x, z, 1)) return new THREE.Vector3(x, 0, z); }
  return new THREE.Vector3(0, 0, 0);
}
const ANG = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3];
function steer(u, dir) {   // dir: desired world angle → free angle
  for (const a0 of ANG) { const a = dir + a0 * u.side, x = u.p.x + Math.sin(a) * 1.4, z = u.p.z + Math.cos(a) * 1.4; if (!blocked(x, z, R + 0.05)) return a; }
  u.side = -u.side; return dir + Math.PI;
}
// think: returns { move: angle|null, speed 0..1, yaw: wanted aim yaw, fire }
function think(u, dt) {
  const g = GUNS[u.gun], o = u.brain || (u.brain = { move: null, yaw: u.yaw, fire: false, speed: 1 });
  u.think -= dt;
  if (u.think <= 0) {
    u.think = 0.22 + Math.random() * 0.12;
    const t = aimTarget(u, g.range + 10);
    if (t !== u.target) { u.target = t; u.react = (0.32 + Math.random() * 0.25) / fk; }
    if (u.goal && (u.p.distanceTo(u.goal) < 2.5 || (u.goalT -= 0.3) < 0)) u.goal = null;
    if (!u.goal) { u.goal = pickGoal(u); u.goalT = 8 + Math.random() * 6; }
    if (u.hp < 35 && !u.me) { const hk = pickups.find(k => k.type === 'heal' && k.t <= 0); if (hk && u.p.distanceTo(tmp2.set(hk.x, 0, hk.z)) < 22) u.goal = new THREE.Vector3(hk.x, 0, hk.z); }
    if (u.p.distanceTo(u.lastP) < 0.4) { u.stuckT += 0.3; if (u.stuckT > 1.2) { u.goal = pickGoal(u); u.side = -u.side; u.stuckT = 0; } } else u.stuckT = 0;
    u.lastP.copy(u.p);
  }
  u.react -= dt; u.strafeT -= dt;
  if (u.strafeT <= 0) { u.strafe = Math.random() < 0.5 ? -1 : 1; u.strafeT = 0.8 + Math.random() * 1.6; }
  const t = u.target;
  if (t && t.alive) {
    const d = u.p.distanceTo(t.p), want = g.pellets > 1 ? 6 : g.dmg > 50 ? 20 : 12, lead = 0.5 * d / g.speed;
    o.yaw = Math.atan2(t.p.x + t.vel.x * lead - u.p.x, t.p.z + t.vel.z * lead - u.p.z);
    const toT = angTo(u.p, t.p), radial = d > want + 3 ? 1 : d < want - 3 ? -1 : 0;
    const mv = Math.atan2(Math.sin(toT) * radial + Math.sin(toT + Math.PI / 2) * u.strafe * 0.9, Math.cos(toT) * radial + Math.cos(toT + Math.PI / 2) * u.strafe * 0.9);
    o.move = steer(u, mv); o.speed = 0.85; o.fire = u.react <= 0 && Math.abs(angDiff(u.yaw, o.yaw)) < 0.14 && d < g.range + 2;
  } else {
    const ga = angTo(u.p, u.goal || u.p); o.move = steer(u, ga); o.yaw = o.move; o.speed = 1; o.fire = false;
    if (u.reload <= 0 && u.ammo < GUNS[u.gun].mag * 0.5) startReload(u);
  }
  return o;
}
const AIM_ERR = 0.06;

// ---------------------------------------------------------------- update
function updateUnit(u, dt) {
  const s = dt / 60;
  if (!u.alive) { u.respawn -= s; if (u.respawn <= 0 && state === 'play') { spawn(u); if (u.me) { deadEl.style.display = 'none'; vign(0); camYaw = u.yaw; } } return; }
  u.prot = Math.max(0, u.prot - s); u.cd -= s; u.lastHit += s; u.boost = Math.max(0, u.boost - s); u.over = Math.max(0, u.over - s);
  if (u.reload > 0) { u.reload -= s; if (u.reload <= 0) { u.ammo = GUNS[u.gun].mag; u.reload = 0; } }
  if (u.lastHit > 4 && u.hp < 100) u.hp = Math.min(100, u.hp + 22 * s);
  let mvx = 0, mvz = 0, sp = (u.me ? 6.6 : 6.1) * (u.boost > 0 ? 1.45 : 1);
  if (u.me) {
    const botOn = performance.now() < ctl.bot;
    if (botOn && u.brain) { u.yaw += clamp(angDiff(u.yaw, u.brain.yaw), -4.5 * s, 4.5 * s); }
    else { u.yaw -= ctl.lookX * 0.0058; }
    ctl.lookX = 0; ctl.lookY = 0;
    const f = fwd(u.yaw), rx = -f.z, rz = f.x;   // right = (-cos, sin)
    mvx = f.x * ctl.my + rx * ctl.mx; mvz = f.z * ctl.my + rz * ctl.mx;
    const l = Math.hypot(mvx, mvz); if (l > 1) { mvx /= l; mvz /= l; }
    // aim assist (gentle) + auto-fire when the crosshair is on a robot
    const g = GUNS[u.gun]; let onT = false;
    for (const e of units) {
      if (e.team === 0 || !e.alive) continue;
      const dx = e.p.x - u.p.x, dz = e.p.z - u.p.z, along = dx * f.x + dz * f.z; if (along < 0 || along > g.range + 2) continue;
      const lat = Math.abs(dx * f.z - dz * f.x); if (lat > 2.2 || !los(u.p, e.p)) continue;
      if (lat < 0.75 + along * 0.012) onT = true;
      if (!botOn && (ctl.mx || ctl.my || Math.abs(ctl.lookX) > 0)) u.yaw += clamp(angDiff(u.yaw, Math.atan2(dx, dz)), -0.9 * s, 0.9 * s);
    }
    cross.classList.toggle('lock', onT);
    if (onT || fireHeld || ctl.fire) shoot(u);
  } else {
    const o = think(u, s);
    u.yaw += clamp(angDiff(u.yaw, o.yaw), -5 * s * fk, 5 * s * fk);
    if (o.move !== null) { mvx = Math.sin(o.move) * o.speed; mvz = Math.cos(o.move) * o.speed; }
    if (o.fire) shoot(u, AIM_ERR / fk + (u.vel.lengthSq() > 4 ? 0.02 : 0));
  }
  u.vel.x = lerp(u.vel.x, mvx * sp, Math.min(1, 12 * s)); u.vel.z = lerp(u.vel.z, mvz * sp, Math.min(1, 12 * s));
  u.p.x += u.vel.x * s; u.p.z += u.vel.z * s;
  collide(u.p);
  for (const o of units) if (o !== u && o.alive) { const dx = u.p.x - o.p.x, dz = u.p.z - o.p.z, d = Math.hypot(dx, dz); if (d < 1.1 && d > 1e-4) { u.p.x += dx / d * (1.1 - d) * 0.5; u.p.z += dz / d * (1.1 - d) * 0.5; } }
  // pickups
  for (const k of pickups) if (k.t <= 0 && Math.hypot(k.x - u.p.x, k.z - u.p.z) < 1.3) grab(u, k);
  // mesh
  const m = u.mesh, spd = Math.hypot(u.vel.x, u.vel.z);
  m.position.set(u.p.x, 0, u.p.z); m.rotation.y = u.yaw; u.walkT += s * (0.4 + spd / 7);
  m.walk(u.walkT, Math.min(1, spd / 5)); m.update(dt);
  m.visible = u.prot > 0 ? Math.floor(u.prot * 10) % 2 === 0 : true;
}
function grab(u, k) {
  k.t = 14; k.g.visible = false;
  if (k.type === 'heal') u.hp = Math.min(100, u.hp + 60); else if (k.type === 'over') u.over = 8; else if (k.type === 'speed') u.boost = 8; else if (k.type === 'bomb') { if (u.me) bombs = Math.min(3, bombs + 1); }
  spark(new THREE.Vector3(k.x, 1.1, k.z), [PK[k.type].c, '#ffffff'], 14, 0.1); ring(new THREE.Vector3(k.x, 0, k.z), PK[k.type].c, 0.6, 0.4, 6);
  if (u.me) { ui.pop(PK[k.type].label, PK[k.type].c, 26, 64); sfx.coin(); buzz(10); hud(); }
}

function updateBullets(dt) {
  const s = dt / 60;
  bullets.update(dt, b => {
    b.life -= s; if (b.life <= 0) return false;
    const nx = b.p.x + b.v.x * s, nz = b.p.z + b.v.z * s;
    let tHit = 2, hitU = null;
    for (const bx of boxes) { const t = segBox(b.p.x, b.p.z, nx, nz, bx); if (t >= 0 && t < tHit) tHit = t; }
    if (Math.abs(nx) > HALF || Math.abs(nz) > HALF) tHit = Math.min(tHit, 1);
    const dx = nx - b.p.x, dz = nz - b.p.z, L2 = dx * dx + dz * dz || 1;
    for (const u of units) {
      if (!u.alive || u.team === b.owner.team) continue;
      const t = clamp(((u.p.x - b.p.x) * dx + (u.p.z - b.p.z) * dz) / L2, 0, 1), cx = b.p.x + dx * t - u.p.x, cz = b.p.z + dz * t - u.p.z;
      if (cx * cx + cz * cz < 0.62 * 0.62 && t < tHit) { tHit = t; hitU = u; }
    }
    if (tHit <= 1) {
      const hp = new THREE.Vector3(b.p.x + dx * tHit, b.p.y, b.p.z + dz * tHit);
      if (hitU) { damage(hitU, b.dmg, b.owner, hp); spark(hp, ['#ffffff', TEAM[hitU.team].col, '#ffd23f'], 5, 0.07); }
      else spark(hp, [b.color, '#ffffff'], 3, 0.05, 0.05);
      return false;
    }
    b.p.x = nx; b.p.z = nz;
  });
  sparks.update(dt, p => { p.life -= dt / 60; p.v.y -= 18 * dt / 60; p.p.addScaledVector(p.v, dt / 60); if (p.p.y < 0.05) { p.p.y = 0.05; p.v.y *= -0.4; p.v.x *= 0.7; p.v.z *= 0.7; } p.s = Math.max(0.01, p.life * 1.6); return p.life > 0; });
  chunks.update(dt, p => { p.life -= dt / 60; p.v.y -= 22 * dt / 60; p.p.addScaledVector(p.v, dt / 60); if (p.p.y < 0.12) { p.p.y = 0.12; p.v.y *= -0.35; p.v.x *= 0.6; p.v.z *= 0.6; } p.s = Math.min(1, p.life * 2) * (p.s0 || (p.s0 = p.s)); return p.life > 0; });
  flashes.update(dt, p => { p.life -= dt / 60; return p.life > 0; });
  rings.update(dt, p => { p.life -= dt / 60; p.s += p.grow * dt / 60; return p.life > 0; });
}

// ---------------------------------------------------------------- HUD paint
const hpEl = bot.querySelector('.bs-hp'), pips = [...bot.querySelectorAll('.bs-pips i')];
function hud() {
  top.querySelector('.bl').textContent = teamK[0]; top.querySelector('.or').textContent = teamK[1];
  const m = Math.max(0, Math.ceil(tLeft)); top.querySelector('span').textContent = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  if (!player) return;
  hpEl.querySelector('i').style.width = Math.max(0, player.hp) + '%'; hpEl.classList.toggle('low', player.hp < 35);
  const g = GUNS[player.gun];
  bot.querySelector('[data-sc]').textContent = `SCORE ${score}`; bot.querySelector('[data-gun]').textContent = g.name;
  bot.querySelector('[data-ammo]').textContent = player.reload > 0 ? 'RELOADING' : `${player.ammo}/${g.mag}`;
  pips.forEach((p, i) => p.classList.toggle('on', i < player.streak));
  bombB.querySelector('span').innerHTML = `FOAM<br>BOMB ×${bombs}`; bombB.style.opacity = bombs > 0 ? 1 : 0.45;
  const nx = streaks[0] ? Object.values(PERKS).find(p => p.id === streaks[0]) : null;
  streakB.querySelector('span').innerHTML = nx ? `${nx.icon}<br>${nx.name.split(' ')[1]}` : `PERK<br><small>${[3, 5, 7].find(n => n > player.streak) || 7} streak</small>`;
  streakB.cool(nx ? 0 : 1); streakB.style.opacity = nx ? 1 : 0.6;
}
function drawMini() {
  const g = mm.g, s = mm.size, k = s / (HALF * 2 + 2), X = x => (x + HALF + 1) * k;
  g.clearRect(0, 0, s, s); g.fillStyle = 'rgba(14,20,36,.7)'; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(255,255,255,.35)'; for (const b of boxes) g.fillRect(X(b.x0), X(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k);
  for (const k2 of pickups) if (k2.t <= 0) { g.fillStyle = PK[k2.type].c; g.fillRect(X(k2.x) - 1.5, X(k2.z) - 1.5, 3, 3); }
  for (const u of units) {
    if (!u.alive || u.me) continue;
    const seen = u.team === 0 || u.cd > -0.6 || units.some(a => a.team === 0 && a.alive && a.p.distanceTo(u.p) < 30 && los(a.p, u.p));
    if (!seen) continue;
    g.fillStyle = TEAM[u.team].col; g.beginPath(); g.arc(X(u.p.x), X(u.p.z), 3, 0, TAU); g.fill();
  }
  if (player.alive) { g.save(); g.translate(X(player.p.x), X(player.p.z)); g.rotate(-player.yaw + Math.PI); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.5, 4); g.lineTo(-3.5, 4); g.closePath(); g.fill(); g.restore(); }
}

// ---------------------------------------------------------------- match end
function endMatch() {
  if (state !== 'play') return;
  const won = teamK[0] > teamK[1], draw = teamK[0] === teamK[1];
  if (won) addScore(500);
  state = won ? 'won' : 'lost'; showHud(false); song.intensity = 0.2; deadEl.style.display = 'none';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: performance.now() - t0 }); }
  const r0 = rankOf(P.xp); P.xp += score; P.matches++; P.kills += player.kills; if (won) P.wins++; const nb = score > P.best; P.best = Math.max(P.best, score); saveP();
  const r1 = rankOf(P.xp), unlock = GUNS.find(g => g.rank > r0 && g.rank <= r1);
  const mvp = [...units].sort((a, b) => b.kills - a.kills)[0];
  const line = `${player.kills} downs · ${player.deaths} lost · score ${score}${nb ? ' · NEW BEST' : ''} · +${score} XP${r1 > r0 ? ` · RANK ${r1}!` : ''}${unlock ? ` · ${unlock.name} unlocked` : ''} · MVP ${mvp.name}`;
  if (won) { sfx.win(); D.won(score); ui.win(matchN, line); setTimeout(() => { ui.els.win.querySelector('h1').textContent = 'VICTORY!'; ui.els.win.querySelector('p').innerHTML = `MATCH ${matchN} · ${teamK[0]} – ${teamK[1]}`; }, 0); for (let i = 0; i < 3; i++) setTimeout(() => spark(player.p.clone().setY(2.5), ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#ffffff'], 40, 0.22, 0.2), i * 250); }
  else { sfx.fail(); ui.lose(draw ? 'DRAW' : 'DEFEAT', `${teamK[0]} – ${teamK[1]} · ` + line); }
  ui.els.lose.classList.add('bs-dim');
}

// ---------------------------------------------------------------- main loop
let tt = 0;
loop((dt, now) => {
  const s = dt / 60; tt += s;
  ctl.poll();
  if (DM.on) { demoWas = true; const o = think(player, s), rel = o.move === null ? 0 : o.move - player.yaw; ctl.drive({ mx: -Math.sin(rel) * o.speed, my: Math.cos(rel) * o.speed }); }
  else if (demoWas) { demoWas = false; ctl.mx = ctl.my = 0; ctl.bot = 0; }
  if (state === 'play') {
    tLeft -= s; if (tLeft <= 0) { tLeft = 0; endMatch(); }
    bombCd = Math.max(0, bombCd - s); shield = Math.max(0, shield - s);
    for (const u of units) updateUnit(u, dt);
    // bombs
    for (let i = bombsLive.length - 1; i >= 0; i--) {
      const b = bombsLive[i]; b.t += s; b.v.y -= 9.8 * s; b.p.addScaledVector(b.v, s);
      for (const bx of boxes) if (b.p.x > bx.x0 && b.p.x < bx.x1 && b.p.z > bx.z0 && b.p.z < bx.z1 && b.p.y < bx.h) { b.v.x *= -0.4; b.v.z *= -0.4; b.p.addScaledVector(b.v, s * 2); }
      if (b.p.y < 0.3) { b.p.y = 0.3; b.v.y *= -0.35; b.v.x *= 0.6; b.v.z *= 0.6; }
      b.mesh.position.copy(b.p); b.mesh.rotation.x += 8 * s;
      if (b.t > 1.4) { explode(b); bombsLive.splice(i, 1); }
    }
    for (let i = volley.length - 1; i >= 0; i--) { const v = volley[i]; v.t -= s; if (v.t <= 0) { volley.splice(i, 1); explode({ p: new THREE.Vector3(v.x, 0.5, v.z), mesh: null, owner: player }); } }
    if (drone) {
      drone.t -= s; drone.a += s * 1.6; drone.cd -= s;
      const dp = drone.mesh.position; dp.lerp(tmp.set(player.p.x + Math.cos(drone.a) * 1.8, 3 + Math.sin(tt * 3) * 0.2, player.p.z + Math.sin(drone.a) * 1.8), 0.15);
      drone.mesh.children[0].rotation.y += 0.4 * dt;
      const t = aimTarget({ p: dp, team: 0 }, 22);
      if (t && drone.cd <= 0) { drone.cd = 0.3; const v = tmp2.set(t.p.x - dp.x, 0, t.p.z - dp.z).normalize().multiplyScalar(55); bullets.spawn({ p: dp.clone().setY(1.25), v: v.clone(), life: 0.5, owner: player, dmg: 8, color: '#ffd23f', s: 0.8 }); tone(1100, 0.03, 'square', 0.03, 0.6); }
      if (drone.t <= 0) { spark(dp.clone(), ['#ffd23f', '#ffffff'], 12, 0.1); scene.remove(drone.mesh); drone = null; }
    }
    for (const k of pickups) { if (k.t > 0) { k.t -= s; if (k.t <= 0) { k.g.visible = true; ring(new THREE.Vector3(k.x, 0, k.z), PK[k.type].c, 0.4, 0.5, 4); } } k.icon.rotation.y += 2 * s; k.icon.position.y = 1.1 + Math.sin(tt * 3 + k.x) * 0.15; }
    song.intensity = 0.45 + Math.min(0.5, (teamK[0] + teamK[1]) / (KILLS_TO_WIN * 1.4)) + (tLeft < 30 ? 0.2 : 0);
    if (Math.floor(tt * 4) !== Math.floor((tt - s) * 4)) { hud(); drawMini(); }
  } else {
    for (const u of units) { u.mesh.update(dt); }
  }
  updateBullets(dt);
  // camera: over the right shoulder; orbit while waiting on the start card
  if (player) {
    if (state === 'ready') { camYaw = player.yaw + Math.sin(tt * 0.4) * 0.5; }
    else if (player.alive) camYaw = player.yaw;
    const f = fwd(camYaw), rx = -f.z, rz = f.x, base = player.alive ? player.p : (killer && killer.alive ? killer.p : player.p);
    let back = state === 'ready' ? -6.5 : 6.2, upY = state === 'ready' ? 2.6 : 3.7, side = state === 'ready' ? 1.2 : 1.35;
    if (!player.alive) { back = 6; upY = 4.5; side = 0; }
    const want = tmp.set(base.x - f.x * back + rx * side, upY, base.z - f.z * back + rz * side);
    if (!player.alive && killer && killer.alive) want.set(player.p.x - f.x * 3, 6, player.p.z - f.z * 3);
    // pull in if a box is between the robot and the camera
    let tMin = 1; for (const b of boxes) { if (b.h < 1.6) continue; const t = segBox(base.x, base.z, want.x, want.z, b, 0.25); if (t >= 0 && t < tMin) tMin = t; }
    if (tMin < 1 && state !== 'ready') { const k = Math.max(0.6, tMin - 0.05); want.x = base.x + (want.x - base.x) * k; want.z = base.z + (want.z - base.z) * k; want.y = Math.max(want.y, 4.6); }
    camera.position.lerp(want, state === 'play' && player.alive ? 0.35 : 0.08);
    const look = state === 'ready' ? tmp2.set(base.x, 2.5, base.z) : tmp2.set(base.x + f.x * 11 + rx * side * 0.5, 0.9, base.z + f.z * 11 + rz * side * 0.5);
    if (!player.alive && killer && killer.alive) look.set(killer.p.x, 1.2, killer.p.z);
    camera.lookAt(look); shake.apply(camera, dt);
    S.followLight(tmp.set(player.p.x, 0, player.p.z));
    // crosshair = where the blaster points 14 m ahead
    const cp = tmp.set(player.p.x + f.x * 14, 1.25, player.p.z + f.z * 14).project(camera);
    cross.style.transform = `translate(${(cp.x * 0.5 + 0.5) * innerWidth}px,${(-cp.y * 0.5 + 0.5) * innerHeight}px)`;
    hitT -= s; cross.classList.toggle('hit', hitT > 0); cross.style.display = state === 'play' && player.alive ? '' : 'none';
    // health bars over robots
    bars.begin();
    for (const u of units) if (u.alive && !u.me && u.mesh.visible) { const d = u.p.distanceTo(player.p); if (u.team === 1 && u.p.distanceTo(camera.position) > 7 && d < 30 && (u.hp < 100 || d < 16)) bars.add(tmp.set(u.p.x, 2.55, u.p.z), u.hp / 100, TEAM[u.team].bar, 0.9); }
    for (const u of units) if (!u.me && u.team === 0) { const near = u.alive && Math.hypot(u.p.x - camera.position.x, u.p.z - camera.position.z) < 4.5; if (near !== !!u.ghost) { u.ghost = near; u.mesh.mat.transparent = near; u.mesh.mat.opacity = near ? 0.3 : 1; u.mesh.mat.depthWrite = !near; u.mesh.mat.needsUpdate = true; } }
    bars.end();
    if (shield > 0) { shieldMesh.visible = true; shieldMesh.position.set(player.p.x, 1.1, player.p.z); shieldMesh.material.opacity = 0.25 + Math.sin(tt * 10) * 0.05 * (shield < 2 ? 3 : 1); } else shieldMesh.visible = false;
  }
  fl.update(dt);
  hurtV = Math.max(0, hurtV - s * 1.5);
  if (state === 'play' && player) vign(player.alive ? Math.max(hurtV, (60 - player.hp) / 100) : 0.35);
});
const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshStandardMaterial({ color: '#9ff3ff', transparent: true, opacity: 0.3, emissive: '#5ad7ff', emissiveIntensity: 0.4, depthWrite: false })); shieldMesh.visible = false; scene.add(shieldMesh);

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in match 1, until the first real touch,
// your robot drives, turns and fires at the nearest rival for about 4.5 s (the squad's own brain), so the controls are shown
let demoWas = false;
const DM = demo(null, { ready: () => state === 'play' && matchN === 1 && !D.seed && player && player.alive, wait: 1500, ms: 4500 });
ui.onTap(w => { if (w === 'win' || w === 'lose') newMatch(); begin(); });
newMatch(); showHud(false); ui.start();

window.__game = {
  get state() { return state; }, get level() { return matchN; }, get score() { return score; },
  get dbg() { return { teamK, tLeft: Math.round(tLeft), hp: player.hp, kills: player.kills, deaths: player.deaths, draw: renderer.info.render.calls }; },
  bot() {
    if (state !== 'play' || !player.alive) return;
    const o = think(player, 0.12);
    const rel = o.move === null ? 0 : o.move - player.yaw;
    ctl.drive({ mx: -Math.sin(rel) * o.speed, my: Math.cos(rel) * o.speed });
    if (bombs > 0 && player.target && player.target.alive && player.p.distanceTo(player.target.p) < 14 && Math.random() < 0.08) throwBomb(player);
    if (streaks.length) useStreak();
  },
};

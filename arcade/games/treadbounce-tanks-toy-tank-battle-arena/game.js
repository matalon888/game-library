// Treadbounce Tanks — original toy-tank arena: ricochet shells, toy blocks, mines and fair CPU tanks. All art built in code.
import { THREE, createStage, createUI, loop, rounded, tone, note, sfx, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { part, merge, vmat, canvasTex, G, hudCSS, H, btn, banner, controls, Pool, healthBars, floaters, shaker, music } from './lib.js';

const NAME = 'Treadbounce Tanks: Toy Tank Battle Arena';
const TAU = Math.PI * 2, COLS = 11, ROWS = 15, T = 1.2, TR = 0.44, LEVELS = 36;
const S = createStage({ fov: 42, shadowSize: 14 });
const { scene, camera, sun, hemi, renderer } = S;
sun.intensity = 1.75; hemi.intensity = 1.05; sun.color.set('#fff1dc'); sun.position.set(5, 16, 7);
hudCSS('#ffcf3a');
document.body.style.setProperty('--bg1', '#f3d9b1'); document.body.style.setProperty('--bg2', '#e2b98a');
const ui = createUI({ title: 'TREADBOUNCE<br>TANKS', hint: 'Tap to roll out', hand: '🛞', progress: true, score: false });
const D = daily('treadbounce', ui, { name: NAME });
const F = flow('treadbounce');
const B = board({ game: 'treadbounce-tanks', label: 'Arenas cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });
const save = store('treadbounce');
const P = { level: save.get('level', 1), stars: save.get('stars', {}), bestWave: save.get('bestWave', 0), mode: save.get('mode', 'campaign'), paint: save.get('paint', 0), cleared: save.get('cleared', 0) };
const saveP = () => { for (const k in P) save.set(k, P[k]); };
const starSum = () => Object.values(P.stars).reduce((a, b) => a + b, 0);
const PAINTS = [{ n: 'Sky', c: '#3a86ff', t: '#2a62c9', need: 0 }, { n: 'Mint', c: '#2ec4b6', t: '#1b8f86', need: 12 }, { n: 'Bubblegum', c: '#ff7eb6', t: '#d9548f', need: 30 }, { n: 'Sunny', c: '#ffcf3a', t: '#d9a520', need: 55 }, { n: 'Galaxy', c: '#7b5cff', t: '#4b2fd0', need: 85 }];

// ---------------------------------------------------------------- tank types (fair CPUs: no wallhacks beyond line traces anyone could do, no instant turns)
const TYPES = {
  pebble: { name: 'Pebble', col: '#b07a45', sp: 0, shell: 6, bounce: 1, reload: 2.8, err: 0.16, max: 1, turn: 1.6, bank: false },
  rover: { name: 'Rover', col: '#9aa3ad', sp: 1.6, shell: 6.5, bounce: 1, reload: 2.2, err: 0.13, max: 1, turn: 2, bank: false },
  ricochet: { name: 'Ricochet', col: '#2bb3a3', sp: 1.2, shell: 10.5, bounce: 2, reload: 2.6, err: 0.05, max: 1, turn: 2.2, bank: true },
  rattler: { name: 'Rattler', col: '#e64545', sp: 2.1, shell: 7, bounce: 1, reload: 2.4, err: 0.1, max: 3, burst: 3, turn: 2.6, bank: false },
  layer: { name: 'Layer', col: '#9b5de5', sp: 2.6, shell: 7, bounce: 1, reload: 2.4, err: 0.1, max: 2, mines: true, turn: 2.6, bank: false },
  ghost: { name: 'Ghost', col: '#f1f1f6', sp: 2.9, shell: 9, bounce: 1, reload: 1.7, err: 0.06, max: 2, turn: 3, bank: true, dodge: true },
  elite: { name: 'Elite', col: '#34364a', sp: 3.3, shell: 11.5, bounce: 0, reload: 1.5, err: 0.04, max: 2, turn: 3.4, bank: false, dodge: true, hp: 2 },
  titan: { name: 'Titan', col: '#f2b134', sp: 1.1, shell: 7.5, bounce: 1, reload: 2.6, err: 0.08, max: 6, spread: 5, turn: 1.6, bank: false, hp: 7, size: 1.5 },
};
const UNLOCK = [[1, 'pebble'], [2, 'rover'], [4, 'ricochet'], [7, 'rattler'], [11, 'layer'], [15, 'ghost'], [21, 'elite']];

// ---------------------------------------------------------------- arena geometry
let grid = [], blocks = [];   // grid[r][c]: 0 floor, 1 wall, 2 toy block, 3 hole
const cx = c => (c - (COLS - 1) / 2) * T, rz = r => (r - (ROWS - 1) / 2) * T;
const colOf = x => Math.round(x / T + (COLS - 1) / 2), rowOf = z => Math.round(z / T + (ROWS - 1) / 2);
const tile = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? 1 : grid[r][c];
const shellSolid = (x, z) => { const t = tile(colOf(x), rowOf(z)); return t === 1 || t === 2; };
const tankSolid = (c, r) => tile(c, r) !== 0;
function genArena(seed, level, endless = false) {
  const r = rng(seed);
  for (let tries = 0; tries < 60; tries++) {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const nWalls = 3 + Math.floor(r() * 4) + Math.min(3, Math.floor(level / 8));
    for (let k = 0; k < nWalls; k++) {
      const horiz = r() < 0.5, len = 2 + Math.floor(r() * 3), c0 = Math.floor(r() * (COLS - (horiz ? len : 1))), r0 = 2 + Math.floor(r() * (ROWS - 4 - (horiz ? 0 : len)));
      const kind = r() < 0.35 + Math.min(0.3, level * 0.01) ? 2 : 1;
      for (let i = 0; i < len; i++) { const c = horiz ? c0 + i : c0, rr = horiz ? r0 : r0 + i; grid[rr][c] = kind; grid[rr][COLS - 1 - c] = kind; }
    }
    if (level >= 5) for (let k = 0; k < 1 + Math.floor(r() * 2); k++) { const c = 1 + Math.floor(r() * (COLS - 2)), rr = 4 + Math.floor(r() * (ROWS - 8)); grid[rr][c] = 3; if (r() < 0.5) grid[rr][COLS - 1 - c] = 3; }
    for (let k = 0; k < 5 + Math.floor(r() * 5); k++) { const c = Math.floor(r() * COLS), rr = 2 + Math.floor(r() * (ROWS - 4)); if (grid[rr][c] === 0 && r() < 0.6) grid[rr][c] = 2; }
    // keep spawn rows clear
    for (let c = 0; c < COLS; c++) { grid[ROWS - 1][c] = 0; grid[ROWS - 2][c] = grid[ROWS - 2][c] === 3 ? 0 : grid[ROWS - 2][c]; grid[0][c] = 0; }
    // everything floor must be reachable from the player's spawn (walking through toy blocks counts: they can be shot away)
    const seen = new Set([`${5},${ROWS - 1}`]), q = [[5, ROWS - 1]];
    while (q.length) { const [c, rr] = q.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = rr + dr, k = `${nc},${nr}`; if (!seen.has(k) && tile(nc, nr) !== 1 && tile(nc, nr) !== 3) { seen.add(k); q.push([nc, nr]); } } }
    let ok = true; for (let rr = 0; rr < ROWS; rr++) for (let c = 0; c < COLS; c++) if ((grid[rr][c] === 0) && !seen.has(`${c},${rr}`)) ok = false;
    if (ok) break;
  }
  blocks = [];
  for (let rr = 0; rr < ROWS; rr++) for (let c = 0; c < COLS; c++) if (grid[rr][c] === 2) blocks.push({ c, r: rr, hp: 2, col: ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388eb'][(c * 7 + rr * 3) % 5] });
}
// enemy roster for an arena
function roster(seed, level, endless) {
  const r = rng(seed * 3 + 1), pool = UNLOCK.filter(([l]) => level >= l).map(([, t]) => t);
  const n = endless ? Math.min(8, 2 + Math.floor(level / 2)) : Math.min(7, 1 + Math.floor((level + 1) / 3));
  const out = [];
  if (!endless && level % 10 === 0) { out.push('titan'); for (let i = 0; i < Math.min(3, level / 10 + 1); i++) out.push(pool[Math.floor(r() * pool.length)]); return out; }
  for (let i = 0; i < n; i++) { const w = r(); out.push(pool[Math.min(pool.length - 1, Math.floor(Math.pow(w, 0.7) * pool.length))]); }
  if (level === 1) return ['pebble'];
  if (level === 2) return ['pebble', 'rover'];
  return out;
}

// ---------------------------------------------------------------- static scene: table, props
const table = new THREE.Group(); scene.add(table);
{
  const tex = canvasTex(1024, 1024, (g, W) => {
    g.fillStyle = '#d9a86c'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#d4a265' : '#ddb077'; g.fillRect(0, i * 64, W, 64); g.fillStyle = 'rgba(90,50,20,.18)'; g.fillRect(0, i * 64, W, 2); }
    for (let k = 0; k < 500; k++) { g.strokeStyle = `rgba(120,70,30,${0.04 + Math.random() * 0.06})`; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * W; g.beginPath(); g.moveTo(Math.random() * W, y); g.bezierCurveTo(Math.random() * W, y + 6, Math.random() * W, y - 6, Math.random() * W, y + Math.random() * 4); g.stroke(); }
  }, true); tex.repeat.set(3, 3);
  const tbl = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })); tbl.rotation.x = -Math.PI / 2; tbl.position.y = -0.02; tbl.receiveShadow = true; table.add(tbl);
  // arena floor mat + border
  const ft = canvasTex(512, 700, (g, w, h) => { g.fillStyle = '#f4e1bd'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(160,110,60,.25)'; g.lineWidth = 2; for (let c = 0; c <= COLS; c++) { g.beginPath(); g.moveTo(c / COLS * w, 0); g.lineTo(c / COLS * w, h); g.stroke(); } for (let r = 0; r <= ROWS; r++) { g.beginPath(); g.moveTo(0, r / ROWS * h); g.lineTo(w, r / ROWS * h); g.stroke(); } for (let k = 0; k < 2500; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.1)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(COLS * T, ROWS * T), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.005; fl.receiveShadow = true; table.add(fl);
  const P = [], W2 = COLS * T / 2 + 0.3, H2 = ROWS * T / 2 + 0.3;
  for (const s of [-1, 1]) { P.push(part(rounded(COLS * T + 1.2, 1.1, 0.6, 0.12), '#a8703c', { z: s * H2, y: 0.55 })); P.push(part(rounded(0.6, 1.1, ROWS * T + 0.6, 0.12), '#a8703c', { x: s * W2, y: 0.55 })); }
  // desk toys around the arena (decor only)
  P.push(part(G.cyl, '#ffd23f', { x: -W2 - 3, z: -4, y: 0.25, rz: Math.PI / 2, sx: 0.25, sz: 0.25, sy: 6, ry: 0.3 })); P.push(part(G.cone, '#f4c99b', { x: -W2 - 3 + 2.9, z: -4 - 0.9, y: 0.25, s: 0.25, sy: 0.7, rz: -Math.PI / 2, ry: 0.3 }));
  for (let k = 0; k < 6; k++) P.push(part(rounded(1, 1, 1, 0.15), ['#ff6b6b', '#4cc9f0', '#ffd166', '#06d6a0', '#b388eb', '#ff9f1c'][k], { x: W2 + 2.5 + (k % 2) * 1.1, y: 0.5 + Math.floor(k / 2) * 0, z: -6 + Math.floor(k / 2) * 1.2, ry: k * 0.3 }));
  P.push(part(rounded(1.1, 1.1, 1.1, 0.2), '#ffffff', { x: -W2 - 2.4, z: 6, y: 0.55, ry: 0.5 })); for (const [x, y, z] of [[0, 0.56, 0], [0.2, 0.56, 0.2], [-0.2, 0.56, -0.2]]) P.push(part(G.sph, '#2b2d42', { x: -W2 - 2.4 + x, y: 0.55 + y, z: 6 + z, s: 0.09 }));
  P.push(part(G.cyl, '#3a86ff', { x: W2 + 3, z: 7, y: 0.6, sx: 0.9, sz: 0.9, sy: 1.2 })); P.push(part(G.cyl, '#2b2d42', { x: W2 + 3, z: 7, y: 1.22, sx: 0.8, sz: 0.8, sy: 0.04 }));
  const m = new THREE.Mesh(merge(P), vmat({ roughness: 0.6 })); m.castShadow = true; m.receiveShadow = true; table.add(m);
  scene.fog = null;
}
// instanced walls / toy blocks / holes
const wallGeo = merge([part(rounded(T, 1.0, T, 0.1), '#c98e52', { y: 0.5 }), part(G.box, '#b07a45', { y: 0.5, sx: T * 1.01, sy: 0.08, sz: T * 1.01 }), part(G.box, '#e0aa6c', { y: 1.0, sx: T * 0.8, sy: 0.02, sz: T * 0.8 })]);
const walls = new THREE.InstancedMesh(wallGeo, vmat({ roughness: 0.65 }), COLS * ROWS); walls.castShadow = true; walls.receiveShadow = true; scene.add(walls);
const blockGeo = merge([part(rounded(T * 0.96, 0.95, T * 0.96, 0.12), '#ffffff', { y: 0.48 }), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => part(G.cyl, '#ffffff', { x: a * T * 0.22, z: b * T * 0.22, y: 1.0, sx: 0.17, sz: 0.17, sy: 0.12 }))]);
const blockM = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }), COLS * ROWS); blockM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COLS * ROWS * 3), 3); blockM.castShadow = true; blockM.receiveShadow = true; scene.add(blockM);
const holeGeo = merge([part(new THREE.CylinderGeometry(T * 0.46, T * 0.46, 0.04, 24), '#2b1d12', { y: 0.01 }), part(new THREE.TorusGeometry(T * 0.46, 0.07, 6, 24), '#8a5a32', { rx: Math.PI / 2, y: 0.03 })]);
const holes = new THREE.InstancedMesh(holeGeo, vmat(), 30); scene.add(holes);
const DM = new THREE.Object3D(), CC = new THREE.Color();
function drawArena() {
  let w = 0, h = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] === 1) { DM.position.set(cx(c), 0, rz(r)); DM.rotation.set(0, 0, 0); DM.scale.setScalar(1); DM.updateMatrix(); walls.setMatrixAt(w++, DM.matrix); }
    if (grid[r][c] === 3 && h < 30) { DM.position.set(cx(c), 0, rz(r)); DM.rotation.set(0, 0, 0); DM.scale.setScalar(1); DM.updateMatrix(); holes.setMatrixAt(h++, DM.matrix); }
  }
  walls.count = w; holes.count = h; walls.instanceMatrix.needsUpdate = true; holes.instanceMatrix.needsUpdate = true; drawBlocks();
}
function drawBlocks() {
  let b = 0;
  for (const k of blocks) { DM.position.set(cx(k.c), 0, rz(k.r)); DM.rotation.set(0, k.hp < 2 ? 0.12 : 0, k.hp < 2 ? 0.05 : 0); DM.scale.set(1, k.hp < 2 ? 0.86 : 1, 1); DM.updateMatrix(); blockM.setMatrixAt(b, DM.matrix); CC.set(k.col); if (k.hp < 2) CC.multiplyScalar(0.72); blockM.setColorAt(b++, CC); }
  blockM.count = b; blockM.instanceMatrix.needsUpdate = true; if (blockM.instanceColor) blockM.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- tank models
function tankMesh(col, trim, size = 1, player = false) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(merge([
    part(rounded(0.78, 0.32, 0.92, 0.1), col, { y: 0.3 }),
    ...[-1, 1].map(s => part(rounded(0.24, 0.3, 1.04, 0.1), '#3d3a4b', { x: s * 0.42, y: 0.17 })),
    ...[-1, 1].flatMap(s => [-0.34, 0, 0.34].map(z => part(G.cyl, '#6b6880', { x: s * 0.42, z, y: 0.17, rz: Math.PI / 2, sx: 0.12, sz: 0.12, sy: 0.26 }))),
    part(G.box, trim, { y: 0.47, z: 0.38, sx: 0.5, sy: 0.04, sz: 0.1 }),
  ]), vmat({ emissive: new THREE.Color(0) }));
  hull.castShadow = true; g.add(hull);
  const tur = new THREE.Group(); tur.position.y = 0.48; g.add(tur);
  const tm = new THREE.Mesh(merge([part(new THREE.SphereGeometry(0.3, 16, 10, 0, TAU, 0, Math.PI / 2), trim, { sy: 0.8 }), part(G.cyl, trim, { z: 0.36, y: 0.1, rx: Math.PI / 2, sx: 0.075, sz: 0.075, sy: 0.6 }), part(G.cyl, '#2b2d42', { z: 0.67, y: 0.1, rx: Math.PI / 2, sx: 0.095, sz: 0.095, sy: 0.08 }), part(G.sph, player ? '#ffffff' : '#ffe066', { y: 0.2, z: 0.12, s: 0.07 })]), hull.material);
  tm.castShadow = true; tur.add(tm);
  g.scale.setScalar(size); g.hull = hull; g.tur = tur; g.mat = hull.material; return g;
}

// ---------------------------------------------------------------- pools + fx
const SHELL = new THREE.CapsuleGeometry(0.09, 0.22, 3, 8); SHELL.rotateX(Math.PI / 2);
const shells = new Pool(scene, SHELL, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.2 }), 80, { colors: true });
shells.mesh.castShadow = true;
const puffs = new Pool(scene, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }), 400, { colors: true });
const sparks = new Pool(scene, new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 400, { colors: true });
const chunks = new Pool(scene, rounded(0.22, 0.16, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), 160, { colors: true }); chunks.mesh.castShadow = true;
const rings = new Pool(scene, (() => { const g = new THREE.RingGeometry(0.85, 1, 32); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 30, { colors: true });
const tracks = new Pool(scene, (() => { const g = new THREE.PlaneGeometry(0.12, 0.2); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#7a5230', transparent: true, opacity: 0.25, depthWrite: false }), 500);
const scorch = new Pool(scene, (() => { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; })(), new THREE.MeshBasicMaterial({ color: '#3a2a1a', transparent: true, opacity: 0.35, depthWrite: false }), 30);
const dots = new Pool(scene, new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }), 140);
const minesMesh = new Pool(scene, merge([part(G.cyl, '#ffd23f', { sx: 0.28, sz: 0.28, sy: 0.12, y: 0.06 }), part(G.cyl, '#2b2d42', { sx: 0.3, sz: 0.3, sy: 0.04, y: 0.02 })]), vmat(), 20);
const mineLights = new Pool(scene, new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }), 20, { colors: true });
const pups = new THREE.Group(); scene.add(pups);
function spark(pos, cols, n = 10, sp = 0.08, up = 0.07) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, b = Math.random() * 0.9 + 0.1; sparks.spawn({ p: pos.clone(), v: new THREE.Vector3(Math.cos(a) * sp * b * 60, (up + Math.random() * up) * 60, Math.sin(a) * sp * b * 60), life: 0.4 + Math.random() * 0.4, color: cols[i % cols.length], s: 0.7 + Math.random() * 0.9 }); } }
function ring(pos, color, size = 1, life = 0.4, grow = 6) { rings.spawn({ p: pos.clone().setY(0.06), v: new THREE.Vector3(), life, color, s: size, grow }); }
const bars = healthBars(scene, camera, 12), fl = floaters(camera, 16), shake = shaker();

// ---------------------------------------------------------------- HUD + controls
const css = document.createElement('style'); css.textContent = `
.tt-top{position:fixed;top:calc(52px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;display:flex;gap:12px;align-items:center;padding:5px 12px;font:900 17px/1 'Baloo 2',system-ui,sans-serif;pointer-events:none;white-space:nowrap}
.tt-top .hearts{letter-spacing:2px}
.tt-pw{position:fixed;left:50%;top:calc(90px + env(safe-area-inset-top));transform:translateX(-50%);z-index:6;display:flex;gap:6px;pointer-events:none;font:800 12px/1 system-ui,sans-serif}
.tt-pw span{padding:4px 8px;border-radius:9px;background:rgba(43,45,66,.6)}
.tt-mute{position:fixed;right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));z-index:8;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:16px;cursor:pointer}
.hc-card .tt-meta{font:800 15px/1.35 system-ui,sans-serif}.hc-card .tt-meta b{color:#ffe066}
.hc-card .tt-stars{font-size:34px;letter-spacing:4px;text-shadow:0 3px 0 rgba(0,0,0,.2)}
.ax-chip.paint{width:34px;height:34px;padding:0;border-radius:50%}
.hc-card.dim{background:linear-gradient(180deg,rgba(60,30,10,.5),rgba(20,10,0,.25))}
.hc-card p,.hc-card .hint{text-shadow:0 2px 4px rgba(60,30,0,.55)!important}
`; document.head.appendChild(css);
const top = H('<div class="tt-top ax-glass"><span data-l>ARENA 1</span><span class="hearts" data-h>❤️❤️❤️</span><span data-e>🎯 1</span></div>');
const pw = H('<div class="tt-pw"></div>');
const mute = H('<div class="tt-mute ax-glass">🔊</div>');
const say = banner();
const ctl = controls({ mode: 'stick', labels: ['DRIVE', 'AIM · RELEASE'] });
const mineB = btn('MINE<br>×2', { right: 14, bottom: 150, size: 58 }, () => layMine(player));
mute.addEventListener('pointerdown', e => { e.stopPropagation(); mute.textContent = song.toggle() ? '🔊' : '🔈'; if (song.on && state === 'play') song.start(); });
const song = music({ bpm: 116, bars: [[60, 'maj'], [57, 'min'], [53, 'maj'], [55, 'maj']], lead: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 74, 0, 72, 0, 0, 0, 69, 0, 72, 0, 76, 74, 72, 0, 71, 0, 74, 0, 79, 0, 0, 0] });
mute.textContent = song.on ? '🔊' : '🔈';
ctl.onKey = c => { if (state !== 'play') return; if (c === 'Space' || c === 'KeyE' || c === 'KeyQ') layMine(player); };
ctl.onRelease = () => { if (state === 'play' && player && player.alive && performance.now() > ctl.bot) fire(player, player.aim); };
const hudEls = [top, pw, mineB];
const showHud = v => { hudEls.forEach(e => e.style.display = v ? '' : 'none'); ctl.enabled = v; ctl.refresh(); };
const startMeta = H('<div class="tt-meta"></div>', ui.els.start), chips = H('<div class="ax-chips"></div>', ui.els.start), paints = H('<div class="ax-chips"></div>', ui.els.start);
ui.els.start.querySelector('h1').after(startMeta); startMeta.after(chips); chips.after(paints);
const winStars = H('<div class="tt-stars"></div>'); ui.els.win.querySelector('h1').after(winStars);
function paintStart() {
  const st = starSum();
  startMeta.innerHTML = D.isDaily ? `Daily arena run · same arenas for everyone today` : `⭐ <b>${st}</b> / ${LEVELS * 3} · arena ${Math.min(P.level, LEVELS)} of ${LEVELS} · best endless wave ${P.bestWave}`;
  chips.innerHTML = D.isDaily ? '' : [['campaign', `Campaign<small>arena ${Math.min(P.level, LEVELS)}${P.level > LEVELS ? ' · done!' : ''}</small>`], ['endless', `Endless<small>best wave ${P.bestWave}</small>`]].map(([k, t]) => `<button class="ax-chip" data-m="${k}" aria-pressed="${P.mode === k}">${t}</button>`).join('');
  chips.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); P.mode = b.dataset.m; saveP(); setupRun(); sfx.tap(); }; });
  paints.innerHTML = PAINTS.map((p, i) => `<button class="ax-chip paint" data-p="${i}" aria-pressed="${i === P.paint}" ${st < p.need ? 'disabled' : ''} title="${p.n}${st < p.need ? ' · ' + p.need + ' stars' : ''}" style="background:${st < p.need ? 'rgba(0,0,0,.3)' : p.c}">${st < p.need ? '🔒' : ''}</button>`).join('');
  paints.querySelectorAll('button').forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = e => { e.stopPropagation(); if (b.disabled) return; P.paint = +b.dataset.p; saveP(); setupRun(); sfx.tap(); }; });
}

// ---------------------------------------------------------------- game state
let state = 'ready', mode = 'campaign', level = 1, wave = 1, tanks = [], player = null, hearts = 3, minesLeft = 2, mines = [], powers = {}, fk = 1, arenaT = 0, hitsTaken = 0, recorded = false, t0 = 0, pupList = [], endlessSeed = 1, score = 0, beatenShown = false;
const isEndless = () => mode === 'endless' || mode === 'daily';
function setupRun() {
  mode = D.isDaily ? 'daily' : P.mode; endlessSeed = D.isDaily ? D.seed : (Date.now() % 1e6) + 5;
  wave = 1; hearts = 3; score = 0; level = Math.min(P.level, LEVELS);
  buildArena(); paintStart();
}
function buildArena() {
  const lvl = isEndless() ? 3 + wave * 2 : level, seed = isEndless() ? endlessSeed + wave * 101 : level * 7919 + 13;
  fk = F.k(); genArena(seed, lvl, isEndless()); drawArena();
  for (const t of tanks) scene.remove(t.mesh); tanks = []; shells.clear(); mines = []; for (const p of pupList) pups.remove(p.mesh); pupList = []; tracks.clear(); scorch.clear(); sparks.clear(); chunks.clear(); puffs.clear();
  if (!isEndless()) { hearts = 3; powers = {}; }
  minesLeft = 2; arenaT = 0; hitsTaken = 0; recorded = false;
  const pc = PAINTS[P.paint] || PAINTS[0];
  player = addTank('player', 5, ROWS - 1, pc.c, pc.t, Math.PI);
  const list = roster(seed, lvl, isEndless()), spots = [];
  const r = rng(seed + 5);
  for (const t of list) {
    for (let k = 0; k < 80; k++) { const c = Math.floor(r() * COLS), rr = Math.floor(r() * Math.min(ROWS - 6, 4 + lvl)); if (tile(c, rr) === 0 && !spots.some(([a, b]) => Math.abs(a - c) + Math.abs(b - rr) < 3)) { spots.push([c, rr]); addTank(t, c, rr); break; } }
  }
  ui.levels(isEndless() ? wave : level); ui.progress(0);
  // camera fits the arena on any screen
  fitCamera(); hud();
}
function addTank(type, c, r, col, trim, yaw = 0) {
  const me = type === 'player', ty = me ? null : TYPES[type], size = ty && ty.size ? ty.size : 1;
  const mesh = tankMesh(me ? col : ty.col, me ? trim : type === 'ghost' ? '#c9c9d6' : type === 'elite' ? '#ff4d6d' : shadeC(ty.col, -0.25), size, me);
  scene.add(mesh);
  const t = { me, type, ty, mesh, p: new THREE.Vector3(cx(c), 0, rz(r)), yaw: me ? Math.PI : 0, aim: me ? Math.PI : 0, alive: true, cd: 0.8 + Math.random() * 1.2, shellsOut: 0, hp: ty && ty.hp ? ty.hp : 1, r: TR * size, path: [], goal: null, think: Math.random() * 0.5, aimT: null, dodge: 0, dodgeDir: null, burst: 0, inv: 0, trackT: 0, mineCd: 3 + Math.random() * 4, vel: new THREE.Vector3() };
  mesh.position.copy(t.p); mesh.rotation.y = t.yaw; tanks.push(t); return t;
}
const shadeC = (c, a) => '#' + new THREE.Color(c).multiplyScalar(1 + a).getHexString();
function fitCamera() {
  const w = COLS * T + 1.5, h = ROWS * T + 1.8, asp = innerWidth / innerHeight, vf = camera.fov * Math.PI / 180;
  const hf = 2 * Math.atan(Math.tan(vf / 2) * asp), tilt = 0.4;   // radians away from straight down
  const dW = (w / 2) / Math.tan(hf / 2) * 1.02, dH = (h / 2) / Math.tan(vf / 2) * Math.cos(tilt) * 0.98 + 1.5, d = Math.max(dW, dH);
  camBase.set(0, d * Math.cos(tilt), d * Math.sin(tilt) + 0.6); camLook.set(0, 0, 0.6);
}
const camBase = new THREE.Vector3(), camLook = new THREE.Vector3();
addEventListener('resize', () => setTimeout(fitCamera, 50));

// ---------------------------------------------------------------- traces + firing
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
/** simulate a shell: returns { tank, len, pts } — first tank it would hit (or null) */
function trace(x, z, ang, bounces, maxLen = 40, skip = null, pts = null) {
  let vx = Math.sin(ang), vz = Math.cos(ang), len = 0, b = bounces; const st = 0.18;
  while (len < maxLen) {
    const nx = x + vx * st, nz = z + vz * st;
    if (shellSolid(nx, nz)) {
      if (b <= 0) return { tank: null, len };
      const hx = shellSolid(nx, z), hz = shellSolid(x, nz);
      if (hx) vx = -vx; if (hz) vz = -vz; if (!hx && !hz) { vx = -vx; vz = -vz; }
      b--; if (pts) pts.push(new THREE.Vector3(x, 0.4, z)); continue;
    }
    x = nx; z = nz; len += st;
    if (pts && Math.floor(len / 0.55) !== Math.floor((len - st) / 0.55)) pts.push(new THREE.Vector3(x, 0.4, z));
    for (const t of tanks) if (t.alive && (t !== skip || len > 1.2) && Math.hypot(t.p.x - x, t.p.z - z) < t.r + 0.06) return { tank: t, len };
  }
  return { tank: null, len };
}
function fire(t, ang) {
  if (!t.alive || state !== 'play') return false;
  const max = t.me ? (powers.rapid ? 8 : 5) : t.ty.max, reload = t.me ? (powers.rapid ? 0.12 : 0.28) : t.ty.reload / Math.max(0.6, fk);
  if (t.shellsOut >= max || t.cd > 0) return false;
  t.cd = t.me ? reload : (t.ty.burst && t.burst < t.ty.burst - 1 ? 0.28 : reload);
  if (!t.me && t.ty.burst) t.burst = (t.burst + 1) % t.ty.burst;
  const spread = t.me ? (powers.triple ? [-0.2, 0, 0.2] : [0]) : t.ty.spread ? [-0.5, -0.25, 0, 0.25, 0.5] : [0];
  const speed = t.me ? 8.5 : t.ty.shell * Math.sqrt(Math.max(0.7, fk)), bounce = t.me ? 1 + (powers.bounce ? 1 : 0) : t.ty.bounce;
  const mx = t.p.x + Math.sin(ang) * (0.62 * (t.ty && t.ty.size || 1)), mz = t.p.z + Math.cos(ang) * (0.62 * (t.ty && t.ty.size || 1));
  if (shellSolid(mx, mz)) { if (t.me) tone(200, 0.06, 'square', 0.04, 0.6); return false; }
  for (const o of spread) { const a = ang + o; shells.spawn({ p: new THREE.Vector3(mx, 0.48, mz), v: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(speed), owner: t, bounce, life: 9, color: t.me ? '#ffffff' : t.ty.col === '#f1f1f6' ? '#c9c9d6' : t.ty.col, s: 1, puffT: 0 }); t.shellsOut++; }
  spark(new THREE.Vector3(mx, 0.5, mz), ['#ffe066', '#ffffff'], 5, 0.05, 0.03); ring(new THREE.Vector3(mx, 0, mz), '#ffffff', 0.2, 0.2, 3);
  t.mesh.tur.position.z = -0.08; t.recoil = 1;
  const d = t.me ? 0 : t.p.distanceTo(player.p);
  tone(t.me ? 340 : 260, 0.09, 'square', t.me ? 0.07 : 0.04 * Math.max(0.3, 1 - d / 20), 0.45); tone(t.me ? 120 : 90, 0.12, 'sine', t.me ? 0.12 : 0.05, 0.6);
  if (t.me) { shake.kick(0.06); buzz(8); }
  return true;
}
function layMine(t) {
  if (!t.alive || state !== 'play') return;
  if (t.me) { if (minesLeft <= 0) return; minesLeft--; hud(); }
  if (mines.some(m => Math.hypot(m.x - t.p.x, m.z - t.p.z) < 1)) return;
  mines.push({ x: t.p.x, z: t.p.z, owner: t, t: 0, fuse: 9 }); tone(500, 0.08, 'sine', 0.06, 0.6); sfx.tap();
}
function boom(x, z, r = 1.9, owner = null) {
  const c = new THREE.Vector3(x, 0.4, z);
  spark(c, ['#ff9f1c', '#ffd23f', '#ffffff', '#ff4d6d'], 30, 0.14, 0.1); ring(c, '#ff9f1c', 0.4, 0.45, r * 3.5); scorch.spawn({ p: c.clone().setY(0.012), v: new THREE.Vector3(), life: 12, s: r * 0.8 });
  for (let i = 0; i < 6; i++) puffs.spawn({ p: c.clone().add(new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5))), v: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.2, (Math.random() - 0.5) * 1.5), life: 1, color: '#bfb3a4', s: 3 });
  sfx.smash(); shake.kick(0.35); buzz(30);
  for (const t of tanks) if (t.alive && Math.hypot(t.p.x - x, t.p.z - z) < r + t.r * 0.5) hitTank(t, owner, 9);
  for (let i = blocks.length - 1; i >= 0; i--) { const k = blocks[i]; if (Math.hypot(cx(k.c) - x, rz(k.r) - z) < r + 0.4) breakBlock(k); }
  for (const m of mines) if (!m.gone && Math.hypot(m.x - x, m.z - z) < r && m.t > 0.1) { m.gone = true; setTimeout(() => boom(m.x, m.z, 1.9, m.owner), 120); }
}
function breakBlock(k) {
  const i = blocks.indexOf(k); if (i < 0) return; blocks.splice(i, 1); grid[k.r][k.c] = 0;
  for (let j = 0; j < 8; j++) { const a = Math.random() * TAU; chunks.spawn({ p: new THREE.Vector3(cx(k.c), 0.5, rz(k.r)), v: new THREE.Vector3(Math.cos(a) * 3, 3 + Math.random() * 3, Math.sin(a) * 3), life: 1.3, color: k.col, s: 1 + Math.random() }); }
  tone(420, 0.12, 'triangle', 0.08, 0.5); drawBlocks();
  if (Math.random() < 0.14) dropPower(cx(k.c), rz(k.r));
}
function hitTank(t, by, dmg = 1) {
  if (!t.alive) return;
  if (t.me) {
    if (t.inv > 0) return;
    if (powers.shield) { powers.shield = 0; ring(t.p, '#9ff3ff', 0.6, 0.5, 6); spark(t.p.clone().setY(0.6), ['#9ff3ff', '#ffffff'], 16, 0.1); tone(900, 0.2, 'sine', 0.1, 0.5); t.inv = 1; hud(); return; }
    hearts--; hitsTaken++; t.inv = 1.6; t.mesh.mat.emissive.set('#ff3b3b'); shake.kick(0.5); buzz([40, 30, 60]); sfx.fail();
    spark(t.p.clone().setY(0.6), ['#ff4d6d', '#ffffff', '#ffd23f'], 20, 0.12); hud();
    if (hearts <= 0) { popTank(t); lose(); }
    return;
  }
  t.hp -= dmg; t.mesh.mat.emissive.set('#ffffff'); t.flash = 1;
  if (t.hp > 0) { fl.add(`${t.hp} left`, t.p.clone().setY(1.4), '#fff', 16); tone(700, 0.06, 'square', 0.06, 0.6); return; }
  popTank(t);
  if (by && by.me) { score++; fl.add(TYPES[t.type].name.toUpperCase() + '!', t.p.clone().setY(1.2), '#ffe066', 22); [0, 4, 7].forEach((s, i) => setTimeout(() => note(72 + s, 0.16, 0.12), i * 55)); }
  if (Math.random() < 0.3 || t.type === 'titan') dropPower(t.p.x, t.p.z);
  const left = tanks.filter(o => !o.me && o.alive).length;
  ui.progress(1 - left / Math.max(1, tanks.length - 1));
  if (left === 0) win(); else if (left === 1) ui.pop('LAST ONE!', '#fff', 30, 30);
  hud();
}
function popTank(t) {
  t.alive = false; t.mesh.visible = false;
  const c = t.p.clone().setY(0.5), col = t.me ? (PAINTS[P.paint] || PAINTS[0]).c : t.ty.col;
  spark(c, [col, '#ffd23f', '#ffffff', '#ff9f1c'], 26, 0.13, 0.1); ring(c, col, 0.4, 0.5, 7);
  for (let i = 0; i < 10; i++) { const a = Math.random() * TAU; chunks.spawn({ p: c.clone(), v: new THREE.Vector3(Math.cos(a) * 3.5, 3 + Math.random() * 4, Math.sin(a) * 3.5), life: 1.5, color: i % 3 ? col : '#3d3a4b', s: 1 + Math.random() * 0.8 }); }
  for (let i = 0; i < 5; i++) puffs.spawn({ p: c.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.4, (Math.random() - 0.5) * 1.2), life: 1.1, color: '#9b9b9b', s: 3 });
  scorch.spawn({ p: c.clone().setY(0.011), v: new THREE.Vector3(), life: 14, s: 0.8 }); sfx.smash(); shake.kick(0.3);
}
const PW = { triple: { icon: '🔱', col: '#ff7eb6', n: 'TRIPLE SHOT' }, bounce: { icon: '↩️', col: '#4cc9f0', n: 'EXTRA BOUNCE' }, speed: { icon: '💨', col: '#06d6a0', n: 'SPEED TREADS' }, shield: { icon: '🛡️', col: '#9ff3ff', n: 'SHIELD BUBBLE' }, rapid: { icon: '⚡', col: '#ffd166', n: 'RAPID RELOAD' } };
function dropPower(x, z) {
  const keys = Object.keys(PW), k = keys[Math.floor(Math.random() * keys.length)];
  const g = new THREE.Group(); g.position.set(x, 0.6, z);
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: PW[k].col, emissive: PW[k].col, emissiveIntensity: 0.5, roughness: 0.2 })); m.castShadow = true; g.add(m);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 20), new THREE.MeshBasicMaterial({ color: '#ffffff' })); halo.rotation.x = Math.PI / 2; g.add(halo);
  pups.add(g); pupList.push({ k, x, z, mesh: g, t: 0 });
}

// ---------------------------------------------------------------- AI
function bfs(from, to) {   // tile path (4-way), avoiding walls, blocks, holes
  const key = (c, r) => r * COLS + c, prev = new Map([[key(...from), -1]]), q = [from];
  while (q.length) { const [c, r] = q.shift(); if (c === to[0] && r === to[1]) break; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr, k = key(nc, nr); if (!prev.has(k) && !tankSolid(nc, nr)) { prev.set(k, key(c, r)); q.push([nc, nr]); } } }
  if (!prev.has(key(...to))) return [];
  const path = []; let k = key(...to); while (k !== -1 && k !== key(...from)) { path.unshift([k % COLS, Math.floor(k / COLS)]); k = prev.get(k); }
  return path;
}
function aimAt(t, target) {   // direct shot, else a bank shot for tanks that can bounce (and know how)
  const bounces = t.me ? 1 + (powers.bounce ? 1 : 0) : t.ty.bounce, dir = Math.atan2(target.p.x - t.p.x, target.p.z - t.p.z);
  const r0 = trace(t.p.x, t.p.z, dir, 0, 30, t); if (r0.tank === target) return dir;
  if (bounces > 0 && (t.me || t.ty.bank || Math.random() < 0.3)) {
    let best = null, bl = 1e9;
    for (let k = 0; k < 72; k++) { const a = k / 72 * TAU, r = trace(t.p.x, t.p.z, a, bounces, 26, t); if (r.tank === target && r.len < bl) { bl = r.len; best = a; } }
    if (best !== null) return best;
  }
  return null;
}
function threat(t) {   // nearest incoming shell that would pass close soon → dodge direction
  for (const s of shells.items) {
    const dx = t.p.x - s.p.x, dz = t.p.z - s.p.z, sp = s.v.length(), vx = s.v.x / sp, vz = s.v.z / sp, along = dx * vx + dz * vz;
    if (along < 0 || along > sp * 0.9) continue;
    const lat = dx * vz - dz * vx; if (Math.abs(lat) < 0.75) return new THREE.Vector3(vz * Math.sign(lat || 1), 0, -vx * Math.sign(lat || 1));
  }
  return null;
}
function think(t, s) {
  t.think -= s; const ty = t.ty;
  if (t.think <= 0) {
    t.think = 0.35 + Math.random() * 0.2;
    t.aimT = player.alive ? aimAt(t, player) : null;
    if (t.aimT !== null) t.aimT += (Math.random() - 0.5) * 2 * ty.err / Math.max(0.6, fk);
    if (ty.sp > 0 && (!t.path.length || Math.random() < 0.08)) {
      const c0 = colOf(t.p.x), r0 = rowOf(t.p.z), pc = colOf(player.p.x), pr = rowOf(player.p.z);
      let goal = null;
      for (let k = 0; k < 25; k++) { const c = clamp(c0 + Math.round((Math.random() - 0.5) * 8), 0, COLS - 1), r = clamp(r0 + Math.round((Math.random() - 0.5) * 8), 0, ROWS - 1); if (tankSolid(c, r)) continue; const d = Math.abs(c - pc) + Math.abs(r - pr); if (d >= 3 && (!goal || Math.abs(d - 6) < Math.abs(goal[2] - 6))) goal = [c, r, d]; }
      if (goal) t.path = bfs([c0, r0], [goal[0], goal[1]]).slice(0, 5);
    }
    if (ty.mines && (t.mineCd -= 0.4) <= 0 && Math.hypot(t.p.x - player.p.x, t.p.z - player.p.z) < 7) { t.mineCd = 6 + Math.random() * 4; layMine(t); }
  }
  // turret
  const want = t.aimT !== null ? t.aimT : t.yaw + Math.sin(arenaT * 0.7 + t.p.x) * 0.8;
  t.aim += clamp(angDiff(t.aim, want), -ty.turn * s, ty.turn * s);
  if (t.aimT !== null && Math.abs(angDiff(t.aim, t.aimT)) < 0.06 && arenaT > 1.2) {
    const chk = trace(t.p.x, t.p.z, t.aim, ty.bounce, 26, t);
    if (!chk.tank || chk.tank.me) fire(t, t.aim);   // never shoot a teammate on purpose
  }
  // move
  let mv = null;
  if (ty.dodge) { const th = threat(t); if (th) { t.dodge = 0.45; t.dodgeDir = th; } }
  if (t.dodge > 0) { t.dodge -= s; mv = t.dodgeDir; }
  else if (t.path.length) { const [c, r] = t.path[0], gx = cx(c), gz = rz(r), dx = gx - t.p.x, dz = gz - t.p.z, d = Math.hypot(dx, dz); if (d < 0.15) t.path.shift(); else mv = new THREE.Vector3(dx / d, 0, dz / d); }
  return mv;
}

// ---------------------------------------------------------------- update
function moveTank(t, mv, sp, s) {
  if (!mv) { t.vel.multiplyScalar(0.7); return; }
  const want = Math.atan2(mv.x, mv.z); let d = angDiff(t.yaw, want);
  if (Math.abs(d) > Math.PI / 2) { d = angDiff(t.yaw, want + Math.PI); }   // tanks drive both ways
  t.yaw += clamp(d, -7 * s, 7 * s);
  const k = Math.abs(d) > 0.9 ? 0.25 : 1;
  t.vel.set(mv.x * sp * k, 0, mv.z * sp * k);
  const nx = t.p.x + t.vel.x * s, nz = t.p.z + t.vel.z * s;
  t.p.x = nx; t.p.z = nz; pushOut(t);
  t.trackT += Math.hypot(t.vel.x, t.vel.z) * s;
  if (t.trackT > 0.28) { t.trackT = 0; for (const sd of [-1, 1]) { const ox = Math.cos(t.yaw) * 0.38 * sd, oz = -Math.sin(t.yaw) * 0.38 * sd; tracks.spawn({ p: new THREE.Vector3(t.p.x + ox, 0.012, t.p.z + oz), v: new THREE.Vector3(Math.sin(t.yaw), 0, Math.cos(t.yaw)).multiplyScalar(0.0001), life: 5, s: 1 }); } }
}
function pushOut(t) {
  const r = t.r, c0 = colOf(t.p.x), r0 = rowOf(t.p.z);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const c = c0 + dc, rr = r0 + dr; if (!tankSolid(c, rr)) continue;
    const x0 = cx(c) - T / 2, x1 = cx(c) + T / 2, z0 = rz(rr) - T / 2, z1 = rz(rr) + T / 2;
    const px = clamp(t.p.x, x0, x1), pz = clamp(t.p.z, z0, z1), dx = t.p.x - px, dz = t.p.z - pz, d = Math.hypot(dx, dz);
    if (d < r) { if (d > 1e-5) { t.p.x += dx / d * (r - d); t.p.z += dz / d * (r - d); } else { t.p.z += (t.p.z > rz(rr) ? 1 : -1) * r; } }
  }
  for (const o of tanks) if (o !== t && o.alive) { const dx = t.p.x - o.p.x, dz = t.p.z - o.p.z, d = Math.hypot(dx, dz), m = t.r + o.r; if (d < m && d > 1e-5) { t.p.x += dx / d * (m - d) * 0.5; t.p.z += dz / d * (m - d) * 0.5; } }
}
function updateShells(s, dt) {
  shells.update(dt, sh => {
    if (sh.dead) { sh.owner.shellsOut--; return false; }
    sh.life -= s; if (sh.life <= 0) { sh.owner.shellsOut--; return false; }
    const n = Math.ceil(sh.v.length() * s / 0.15);
    for (let i = 0; i < n; i++) {
      const st = s / n, nx = sh.p.x + sh.v.x * st, nz = sh.p.z + sh.v.z * st;
      if (shellSolid(nx, nz)) {
        const blk = blocks.find(k => k.c === colOf(nx) && k.r === rowOf(nz));
        if (blk) { blk.hp--; spark(new THREE.Vector3(nx, 0.5, nz), [blk.col, '#ffffff'], 8, 0.07); if (blk.hp <= 0) breakBlock(blk); else { drawBlocks(); tone(500, 0.06, 'triangle', 0.06, 0.6); } sh.owner.shellsOut--; return false; }
        if (sh.bounce <= 0) { spark(new THREE.Vector3(sh.p.x, 0.5, sh.p.z), ['#ffffff', '#ffd23f'], 8, 0.06); puffs.spawn({ p: sh.p.clone(), v: new THREE.Vector3(0, 0.6, 0), life: 0.6, color: '#d9d0c4', s: 2.5 }); sh.owner.shellsOut--; tone(180, 0.08, 'square', 0.03, 0.6); return false; }
        const hx = shellSolid(nx, sh.p.z), hz = shellSolid(sh.p.x, nz);
        if (hx) sh.v.x = -sh.v.x; if (hz) sh.v.z = -sh.v.z; if (!hx && !hz) { sh.v.x = -sh.v.x; sh.v.z = -sh.v.z; }
        sh.bounce--; sh.fresh = 0; spark(new THREE.Vector3(sh.p.x, 0.5, sh.p.z), ['#ffffff'], 4, 0.04); tone(900, 0.04, 'sine', 0.05, 1.3); continue;
      }
      sh.p.x = nx; sh.p.z = nz; sh.age = (sh.age || 0) + st;
      for (const t of tanks) if (t.alive && (t !== sh.owner || sh.age > 0.25) && Math.hypot(t.p.x - sh.p.x, t.p.z - sh.p.z) < t.r + 0.08) { sh.owner.shellsOut--; spark(sh.p.clone(), ['#ffffff', '#ffd23f'], 6, 0.06); hitTank(t, sh.owner); return false; }
      for (const o of shells.items) if (o !== sh && !o.dead && Math.abs(o.p.x - sh.p.x) < 0.22 && Math.abs(o.p.z - sh.p.z) < 0.22) { o.dead = true; sh.dead = true; spark(sh.p.clone(), ['#ffffff', '#ffd23f', '#ff9f1c'], 10, 0.08); ring(sh.p, '#ffffff', 0.2, 0.25, 3); tone(1200, 0.05, 'square', 0.05, 0.5); break; }
      if (sh.dead) { sh.owner.shellsOut--; return false; }
      for (const m of mines) if (!m.gone && Math.hypot(m.x - sh.p.x, m.z - sh.p.z) < 0.3) { m.gone = true; sh.owner.shellsOut--; boom(m.x, m.z, 1.9, sh.owner); return false; }
    }
    sh.puffT = (sh.puffT || 0) + s; if (sh.puffT > 0.04) { sh.puffT = 0; puffs.spawn({ p: sh.p.clone(), v: new THREE.Vector3(0, 0.15, 0), life: 0.5, color: sh.color === '#ffffff' ? '#e8e0d4' : sh.color, s: 1.2 }); }
  });
  shells.items = shells.items.filter(sh => !sh.dead || (sh.owner.shellsOut--, false));
  puffs.update(dt, p => { p.life -= s; p.p.addScaledVector(p.v, s); p.s += s * 2; return p.life > 0; });
  sparks.update(dt, p => { p.life -= s; p.v.y -= 14 * s; p.p.addScaledVector(p.v, s); if (p.p.y < 0.04) { p.p.y = 0.04; p.v.y *= -0.4; p.v.x *= 0.7; p.v.z *= 0.7; } p.s = Math.max(0.01, p.life * 2); return p.life > 0; });
  chunks.update(dt, p => { p.life -= s; p.v.y -= 16 * s; p.p.addScaledVector(p.v, s); if (p.p.y < 0.08) { p.p.y = 0.08; p.v.y *= -0.35; p.v.x *= 0.6; p.v.z *= 0.6; } p.s = Math.min(1, p.life * 2) * (p.s0 || (p.s0 = p.s)); return p.life > 0; });
  rings.update(dt, p => { p.life -= s; p.s += p.grow * s; return p.life > 0; });
  tracks.update(dt, p => { p.life -= s; return p.life > 0; });
  scorch.update(dt, p => { p.life -= s; return p.life > 0; });
}
function updateMines(s) {
  minesMesh.clear(); mineLights.clear();
  for (const m of mines) {
    if (m.gone) continue; m.t += s;
    if (m.t > m.fuse) { m.gone = true; boom(m.x, m.z, 1.9, m.owner); continue; }
    if (m.t > 1) for (const t of tanks) if (t.alive && t !== m.owner && Math.hypot(t.p.x - m.x, t.p.z - m.z) < 0.9) { m.gone = true; boom(m.x, m.z, 1.9, m.owner); break; }
    if (m.gone) continue;
    minesMesh.spawn({ p: new THREE.Vector3(m.x, 0, m.z), v: new THREE.Vector3(), s: 1 });
    const blink = m.t > m.fuse - 2 ? Math.floor(m.t * 8) % 2 : Math.floor(m.t * 2) % 2;
    mineLights.spawn({ p: new THREE.Vector3(m.x, 0.15, m.z), v: new THREE.Vector3(), s: 1, color: blink ? '#ff3b3b' : '#5a1010' });
  }
  mines = mines.filter(m => !m.gone);
  minesMesh.update(1, () => true); mineLights.update(1, () => true);
}
function aimFromMouse(mx, my) {
  const ndc = new THREE.Vector3(mx / innerWidth * 2 - 1, -(my / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
  const k = (0.48 - camera.position.y) / ndc.y; return Math.atan2(camera.position.x + ndc.x * k - player.p.x, camera.position.z + ndc.z * k - player.p.z);
}
let showPreview = false;
function updatePlayer(s) {
  const t = player; if (!t.alive) return;
  t.inv = Math.max(0, t.inv - s); t.cd -= s;
  const botOn = performance.now() < ctl.bot;
  let mx = ctl.mx, mz = -ctl.my; const l = Math.hypot(mx, mz);
  moveTank(t, l > 0.15 ? new THREE.Vector3(mx / Math.max(1, l), 0, mz / Math.max(1, l)) : null, 3.6 * (powers.speed ? 1.35 : 1) * Math.min(1, l * 1.2), s);
  showPreview = false;
  if (!botOn) {
    if (ctl.touch && ctl.aiming) { t.aim = Math.atan2(ctl.ax, -ctl.ay); showPreview = true; }
    else if (!ctl.touch && ctl.mouse) { t.aim = aimFromMouse(ctl.mouse.x, ctl.mouse.y); showPreview = true; if (ctl.fire) { fire(t, t.aim); } }
  }
}
function updateTanks(s) {
  for (const t of tanks) {
    if (!t.alive) continue;
    if (!t.me) { t.cd -= s; const mv = think(t, s); if (t.ty.sp > 0) moveTank(t, mv, t.ty.sp * Math.min(1.25, fk), s); }
    const m = t.mesh; m.position.set(t.p.x, Math.abs(Math.sin(arenaT * 20)) * 0.015 * Math.min(1, t.vel.length()), t.p.z); m.rotation.y = t.yaw; m.tur.rotation.y = t.aim - t.yaw;
    t.recoil = Math.max(0, (t.recoil || 0) - s * 6); m.tur.position.z = -0.08 * t.recoil;
    if (t.flash > 0) { t.flash -= s * 5; if (t.flash <= 0) m.mat.emissive.set('#000000'); }
    if (t.me) { if (t.inv > 0) { m.visible = Math.floor(t.inv * 12) % 2 === 0; if (t.inv < 1.4) m.mat.emissive.set('#000000'); } else m.visible = true; }
  }
}
function updatePowers(s, tt) {
  for (let i = pupList.length - 1; i >= 0; i--) {
    const p = pupList[i]; p.t += s; p.mesh.rotation.y += s * 2; p.mesh.position.y = 0.6 + Math.sin(tt * 3 + i) * 0.1;
    if (player.alive && Math.hypot(p.x - player.p.x, p.z - player.p.z) < 0.7) {
      powers[p.k] = 1; pups.remove(p.mesh); pupList.splice(i, 1); ui.pop(PW[p.k].n, PW[p.k].col, 28, 62); sfx.coin(); buzz(15); ring(player.p, PW[p.k].col, 0.4, 0.5, 6); hud();
    } else if (p.t > 14) { pups.remove(p.mesh); pupList.splice(i, 1); }
  }
}
function updatePreview() {
  dots.clear();
  if (!showPreview || !player.alive) return;
  const pts = []; trace(player.p.x, player.p.z, player.aim, 1 + (powers.bounce ? 1 : 0), 14, player, pts);
  for (const p of pts) dots.spawn({ p, v: new THREE.Vector3(), s: 1 });
}

// ---------------------------------------------------------------- win / lose
function hud() {
  top.querySelector('[data-l]').textContent = isEndless() ? (mode === 'daily' ? `DAILY · WAVE ${wave}` : `WAVE ${wave}`) : `ARENA ${level}`;
  top.querySelector('[data-h]').textContent = '❤️'.repeat(Math.max(0, hearts)) + '🤍'.repeat(Math.max(0, (isEndless() ? Math.max(3, hearts) : 3) - hearts));
  top.querySelector('[data-e]').textContent = `🎯 ${tanks.filter(t => !t.me && t.alive).length}`;
  pw.innerHTML = Object.keys(powers).filter(k => powers[k]).map(k => `<span style="color:${PW[k].col}">${PW[k].icon} ${PW[k].n}</span>`).join('');
  mineB.querySelector('span').innerHTML = `MINE<br>×${minesLeft}`; mineB.style.opacity = minesLeft ? 1 : 0.4;
}
function win() {
  if (state !== 'play') return;
  state = 'won';
  if (!recorded) { recorded = true; F.level(true); B.submit(1, { ms: arenaT * 1000 }); }
  const stars = hitsTaken === 0 && arenaT < 40 + tanks.length * 6 ? 3 : hitsTaken <= 1 ? 2 : 1;
  sfx.win(); buzz([20, 40, 20]); for (let i = 0; i < 3; i++) setTimeout(() => spark(new THREE.Vector3((i - 1) * 3, 1.5, 0), ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#ffffff'], 40, 0.18, 0.18), i * 200);
  P.cleared++;
  let line;
  if (isEndless()) {
    P.bestWave = Math.max(P.bestWave, wave); score = wave;
    line = `Wave ${wave} cleared in ${arenaT.toFixed(1)} s${wave % 3 === 0 && hearts < 5 ? ' · +1 ❤️' : ''}`;
    D.won(wave, 'cleared wave'); ui.win(wave, line); winStars.textContent = '';
    setTimeout(() => { ui.els.win.querySelector('h1').textContent = 'WAVE CLEARED!'; ui.els.win.querySelector('p').innerHTML = mode === 'daily' ? 'DAILY RUN' : 'ENDLESS'; }, 0);
  } else {
    const prev = P.stars[level] || 0; P.stars[level] = Math.max(prev, stars); P.level = Math.max(P.level, Math.min(LEVELS + 1, level + 1));
    const next = PAINTS.find(p => p.need > starSum() - (P.stars[level] - prev) && p.need <= starSum());
    line = `${arenaT.toFixed(1)} s · ${hitsTaken ? hitsTaken + ' hit' + (hitsTaken > 1 ? 's' : '') + ' taken' : 'no hits taken'}${next ? ` · ${next.n} paint unlocked!` : ''}${level === LEVELS ? ' · CAMPAIGN COMPLETE!' : ''}`;
    D.won(level, 'cleared arena'); ui.win(level, line); winStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    setTimeout(() => { ui.els.win.querySelector('h1').textContent = 'CLEARED!'; ui.els.win.querySelector('p').innerHTML = `ARENA <span data-l>${level}</span>`; }, 0);
  }
  saveP();
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; song.intensity = 0.2;
  const left = tanks.filter(t => !t.me && t.alive).length, total = tanks.length - 1;
  if (!recorded) { recorded = true; F.level(false, 1 - left / Math.max(1, total)); }
  if (isEndless()) { P.bestWave = Math.max(P.bestWave, wave - 1); saveP(); ui.lose('TANK DOWN!', `Reached wave ${wave} · best ${P.bestWave}`); }
  else ui.lose('TANK DOWN!', `${total - left} of ${total} tanks popped · try arena ${level} again`);
}
function next(w) {
  if (w === 'win') {
    if (isEndless()) { wave++; if ((wave - 1) % 3 === 0) hearts = Math.min(5, hearts + 1); }
    else level = Math.min(LEVELS, level + 1 > LEVELS ? 1 : level + 1);
  } else if (w === 'lose' && isEndless()) { wave = 1; hearts = 3; powers = {}; endlessSeed = D.isDaily ? D.seed : (Date.now() % 1e6) + 5; }
  buildArena();
}

// ---------------------------------------------------------------- main loop
let tt = 0;
loop((dt) => {
  const s = Math.min(dt / 60, 1 / 30); tt += dt / 60;
  ctl.poll();
  if (state === 'play') {
    arenaT += s;
    updatePlayer(s); updateTanks(s); updateMines(s); updatePowers(s, tt);
    song.intensity = 0.4 + Math.min(0.5, shells.items.length / 12);
    if (!beatenShown && D.beaten(isEndless() ? wave : level)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); }
  } else { updateTanks(0); }
  updateShells(state === 'play' ? s : s * 0.3, dt); updatePreview(); dots.update(1, () => true);
  const want = state === 'ready' ? camBase.clone().add(new THREE.Vector3(Math.sin(tt * 0.3) * 1.5, 1.5, 1.5)) : camBase;
  camera.position.lerp(want, 0.08); camera.lookAt(camLook); shake.apply(camera, dt);
  S.followLight(new THREE.Vector3(0, 0, 0));
  bars.begin(); for (const t of tanks) if (t.alive && !t.me && t.ty.hp > 1) bars.add(new THREE.Vector3(t.p.x, 1.25 * (t.ty.size || 1), t.p.z), t.hp / t.ty.hp, '#ff5d5d', 0.9); bars.end();
  fl.update(dt);
});
sun.shadow.camera.left = -11; sun.shadow.camera.right = 11; sun.shadow.camera.top = 13; sun.shadow.camera.bottom = -13; sun.shadow.camera.updateProjectionMatrix();

ui.onTap(w => {
  if (w === 'start') { state = 'play'; showHud(true); song.start(); B.start(); say(isEndless() ? `WAVE ${wave}` : `ARENA ${level}`, `${tanks.length - 1} enemy tank${tanks.length > 2 ? 's' : ''}`, 1300); return; }
  next(w); state = 'play'; showHud(true); song.intensity = 0.4; say(isEndless() ? `WAVE ${wave}` : `ARENA ${level}`, level % 10 === 0 && !isEndless() ? '👑 TITAN TANK!' : `${tanks.length - 1} enemy tank${tanks.length > 2 ? 's' : ''}`, 1300);
});
setupRun(); showHud(false); ui.start();

// ---------------------------------------------------------------- test hooks + bot
window.__game = {
  get state() { return state; }, get level() { return isEndless() ? wave : level; }, get score() { return isEndless() ? wave : P.cleared; },
  get dbg() { return { level, wave, hearts, enemies: tanks.filter(t => !t.me && t.alive).map(t => t.type).join(','), shells: shells.items.length, draw: renderer.info.render.calls }; },
  bot() {
    if (state !== 'play' || !player.alive) return;
    const foes = tanks.filter(t => !t.me && t.alive); if (!foes.length) return;
    foes.sort((a, b) => a.p.distanceTo(player.p) - b.p.distanceTo(player.p));
    let shot = null, tgt = null;
    for (const f of foes) { const a = aimAt(player, f); if (a !== null) { shot = a; tgt = f; break; } }
    let mv = { mx: 0, my: 0 };
    const th = threat(player);
    if (th) mv = { mx: th.x, my: -th.z };
    else if (shot === null) {   // walk toward a tile that sees the nearest foe
      const f = foes[0], path = bfs([colOf(player.p.x), rowOf(player.p.z)], [colOf(f.p.x), rowOf(f.p.z)]);
      if (path.length > 2) { const [c, r] = path[0], dx = cx(c) - player.p.x, dz = rz(r) - player.p.z, d = Math.hypot(dx, dz) || 1; mv = { mx: dx / d, my: -dz / d }; }
      else if (minesLeft > 0 && f.p.distanceTo(player.p) < 3) layMine(player);
    }
    ctl.drive(mv);
    if (shot !== null) { player.aim = shot + (Math.random() - 0.5) * 0.03; showPreview = true; fire(player, player.aim); }
  },
};

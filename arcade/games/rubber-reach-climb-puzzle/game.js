// Rubber Reach — original climbing puzzle. Drag Gummo's hands and feet to haul him to the exit.
// Limbs snap if stretched too far, saws and spikes slice any limb that crosses them, pits can't be gripped.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const V3 = THREE.Vector3;
const S = createStage({ fov: 50, shadowSize: 10 });
const { scene, camera, sun, hemi } = S;
hemi.intensity = 1.25; sun.intensity = 1.5;
const ui = createUI({ title: 'RUBBER<br>REACH', hint: 'Drag hands & feet to climb', hand: '👆', score: false });
const D = daily('rubberreach', ui, { name: 'Rubber Reach: Climb Puzzle' });
const save = store('rubberreach');
const F = flow('rubberreach');
const B = board({ game: 'rubber-reach', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.3 }, mode: 'sum' });
let level = save.get('level', 1), best = save.get('best', 0), total = 0;

const THEMES = [
  { bg: ['#ffe0b3', '#fff6d6'], f1: '#7fd6c2', f2: '#6cc8b3', wall: '#ffd23f', band: '#ffe98a', ui: '#ff8c42', limb: '#ff5d8f' },
  { bg: ['#c9f0ff', '#e8fff4'], f1: '#ffc2a8', f2: '#ffb393', wall: '#7b5cff', band: '#a48cff', ui: '#0582ca', limb: '#3a86ff' },
  { bg: ['#ffd1dc', '#ffe9b8'], f1: '#d4f5a8', f2: '#c6ec92', wall: '#ff8c42', band: '#ffb27a', ui: '#ff5d8f', limb: '#2ec4b6' },
  { bg: ['#d7c8ff', '#ffd6f5'], f1: '#ffe39e', f2: '#ffd97a', wall: '#2ec4b6', band: '#7fe3d6', ui: '#7b5cff', limb: '#ff4d6d' },
];
let TH = THEMES[0];
const css = document.createElement('style'); css.textContent = `
.hc-pop{-webkit-text-stroke:5px rgba(43,45,66,.6);paint-order:stroke fill}
.hc-card h1{-webkit-text-stroke:3px rgba(43,45,66,.22);paint-order:stroke fill}
.rr-moves{position:fixed;left:14px;top:calc(60px + env(safe-area-inset-top));z-index:6;pointer-events:none;background:rgba(255,255,255,.85);color:#2b2d42;border-radius:16px;padding:2px 12px;font-weight:800;font-size:16px;box-shadow:0 3px 0 rgba(0,0,0,.1)}
`; document.head.appendChild(css);
const movesEl = document.createElement('div'); movesEl.className = 'rr-moves'; document.body.appendChild(movesEl);

// ---------------------------------------------------------------- constants
const HALF = 3, LMAX = 3.3, BODY_R = 0.48, SAW_R = 0.58;
const ANCH = [[-0.42, -0.22], [0.42, -0.22], [-0.3, 0.32], [0.3, 0.32]];        // hand L, hand R, foot L, foot R (x,z offsets from body)
const HOME = [[-0.95, -1.15], [0.95, -1.15], [-0.75, 1.1], [0.75, 1.1]];

// ---------------------------------------------------------------- level data
let Lz = 24, pits = new Set(), spikes = [], saws = [], world = null, goalZ = -24;
const cellKey = (c, r) => c + ',' + r;
const cellOf = (x, z) => [Math.floor(x + HALF), Math.floor(-z)];
function isPit(x, z) { const [c, r] = cellOf(x, z); return pits.has(cellKey(c, r)); }
function inRect(x, z, R, m = 0) { return x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m; }
function canPlant(x, z) {
  if (Math.abs(x) > HALF - 0.22 || z > 3.5 || z < goalZ - 4.5) return false;
  if (isPit(x, z)) return false;
  for (const R of spikes) if (inRect(x, z, R, 0.2)) return false;
  return true;
}
function sawX(s, t) { return (s.xa + s.xb) / 2 + (s.xb - s.xa) / 2 * Math.sin(s.w * t + s.ph); }
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6; const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1); return Math.hypot(px - (ax + dx * t), pz - (az + dz * t)); }
function segHitsRect(ax, az, bx, bz, R, m) { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.12) + 1; for (let i = 0; i <= n; i++) { const t = i / n; if (inRect(ax + (bx - ax) * t, az + (bz - az) * t, R, m)) return true; } return false; }

function gen(r, fk) {
  Lz = Math.round(clamp(20 + level * 2.6, 20, 60)); goalZ = -Lz;
  pits = new Set(); spikes = []; saws = [];
  let z = -4.2;
  const pool = ['pit', 'saw', 'spike'];
  if (level >= 3) pool.push('saw2', 'pit');
  if (level >= 5) pool.push('combo', 'saw2');
  let first = true;
  while (z > goalZ + 4) {
    const kind = first ? (level === 1 ? 'pit' : pool[Math.floor(r() * pool.length)]) : pool[Math.floor(r() * pool.length)]; first = false;
    if (kind === 'pit') {
      const rows = r() < Math.min(0.75, (0.25 + level * 0.06) * fk) ? 2 : 1, r0 = Math.floor(-z);
      const bridge = level < 3 || r() < 0.3 ? Math.floor(r() * 6) : -1;
      for (let rr = r0; rr < r0 + rows; rr++) for (let c = 0; c < 6; c++) if (c !== bridge) pits.add(cellKey(c, rr));
      z -= rows + 2.4 / Math.min(1.2, fk);
    } else if (kind === 'saw' || kind === 'saw2' || kind === 'combo') {
      const len = clamp((1.7 + r() * 0.6 + level * 0.05) * fk, 1.5, 2.7), left = r() < 0.5;
      const mk = (lf, zz) => { const xa = lf ? -HALF + 0.55 : HALF - 0.55 - len, xb = xa + len; saws.push({ z: zz, xa, xb, w: clamp((1.4 + level * 0.08) * fk, 1.2, 3.2), ph: r() * 6.28, rot: 0, band: { x0: Math.min(xa, xb) - SAW_R - 0.12, x1: Math.max(xa, xb) + SAW_R + 0.12, z0: zz - SAW_R - 0.12, z1: zz + SAW_R + 0.12 } }); };
      mk(left, z - 0.5);
      if (kind === 'saw2') { z -= 3.4; mk(!left, z - 0.5); }
      if (kind === 'combo') { const r0 = Math.floor(-(z - 2.2)); for (let c = 0; c < 6; c++) if (r() < 0.6) pits.add(cellKey(c, r0)); }
      z -= 3.6 / Math.min(1.2, fk) + (kind === 'combo' ? 1.5 : 0);
    } else {
      const n = 1 + (r() < 0.35 * fk + level * 0.05 ? 1 : 0), used = new Set();
      for (let k = 0; k < n; k++) { let c = Math.floor(r() * 6); while (used.has(c)) c = (c + 1) % 6; used.add(c); const wide = r() < 0.4 && c < 5 && !used.has(c + 1) ? 2 : 1; if (wide === 2) used.add(c + 1); spikes.push({ x0: c - HALF + 0.05, x1: c - HALF + wide - 0.05, z0: z - 1 + 0.05, z1: z - 0.05 }); }
      z -= 3.2 / Math.min(1.2, fk);
    }
  }
}

// ---------------------------------------------------------------- meshes
const tileGeo = rounded(0.96, 0.96, 0.5, 0.08); tileGeo.rotateX(-Math.PI / 2); tileGeo.translate(0, -0.25, 0);
function stripeTex(col) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : col; g.fillRect(0, i * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sawGeo() {
  const s = new THREE.Shape(), n = 22;
  for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? SAW_R : SAW_R * 0.8; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  const h = new THREE.Path(); h.absarc(0, 0, 0.1, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
}
const SAWG = sawGeo();
function buildWorld() {
  if (world) { scene.remove(world); }
  world = new THREE.Group(); scene.add(world);
  // floor tiles (instanced), striped every two rows; the goal zone is a gold checkerboard
  const rows0 = -4, rows1 = Lz + 5, cells = [];
  for (let rr = rows0; rr < rows1; rr++) for (let c = 0; c < 6; c++) if (!pits.has(cellKey(c, rr))) cells.push([c, rr]);
  const tiles = new THREE.InstancedMesh(tileGeo, mat('#ffffff', { roughness: 0.75 }), cells.length); tiles.receiveShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach(([c, rr], i) => {
    m4.makeTranslation(c - HALF + 0.5, 0, -rr - 0.5); tiles.setMatrixAt(i, m4);
    const goal = rr >= Lz; col.set(goal ? ((c + rr) % 2 ? '#ffd23f' : '#fff4c2') : (Math.floor(rr / 2) % 2 ? TH.f1 : TH.f2)); tiles.setColorAt(i, col);
  });
  world.add(tiles);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6, Lz + 12), mat('#3a7bd5', { roughness: 0.2, emissive: '#1f4fa0', emissiveIntensity: 0.35 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.42, -Lz / 2); world.add(water);
  // side walls with stripes
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, Lz + 14), mat(TH.wall)); w.position.set(sx * (HALF + 0.7), 0.15, -Lz / 2); w.castShadow = true; w.receiveShadow = true; world.add(w);
    const bands = new THREE.InstancedMesh(rounded(1.5, 0.5, 0.5, 0.12), mat(TH.band), Math.ceil((Lz + 12) / 3));
    for (let i = 0; i < bands.count; i++) { m4.makeTranslation(sx * (HALF + 0.7), 0.82, 6 - i * 3); bands.setMatrixAt(i, m4); }
    bands.castShadow = true; world.add(bands);
  }
  // spikes
  const coneG = new THREE.ConeGeometry(0.16, 0.42, 10), metal = glossy('#dfe3ea', { metalness: 0.6, roughness: 0.25 });
  for (const R of spikes) {
    const w = R.x1 - R.x0, d = R.z1 - R.z0;
    const base = new THREE.Mesh(rounded(w, d, 0.32, 0.08), mat('#ff4d6d')); base.rotation.x = -Math.PI / 2; base.position.set((R.x0 + R.x1) / 2, 0.16, (R.z0 + R.z1) / 2); base.castShadow = true; world.add(base);
    const nx = Math.max(2, Math.round(w * 2)), nz = 2;
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const cn = new THREE.Mesh(coneG, metal); cn.position.set(R.x0 + (i + 0.5) * w / nx, 0.52, R.z0 + (k + 0.5) * d / nz); cn.castShadow = true; world.add(cn); }
  }
  // saws: groove + blade
  for (const s of saws) {
    const groove = new THREE.Mesh(rounded(s.xb - s.xa + 0.5, 0.3, 0.06, 0.05), mat('#2b2d42')); groove.rotation.x = -Math.PI / 2; groove.position.set((s.xa + s.xb) / 2, 0.02, s.z); world.add(groove);
    const blade = new THREE.Mesh(SAWG, glossy('#ff3b5c', { metalness: 0.3 })); blade.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 16), glossy('#dfe3ea', { metalness: 0.6 })); hub.position.y = 0.04;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), mat('#2b2d42')); post.position.y = -0.2;
    const g = new THREE.Group(); g.add(blade, hub, post); g.position.set(s.xa, 0.42, s.z); world.add(g); s.mesh = g; s.blade = blade;
  }
  // exit arch
  const arch = new THREE.Group(), am = glossy('#ff5d8f');
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 12), am); p.position.set(sx * 2.6, 1.2, 0); p.castShadow = true; arch.add(p); }
  const beam = new THREE.Mesh(rounded(5.8, 0.7, 0.4, 0.15), mat('#ffffff')); beam.position.y = 2.5; beam.castShadow = true; arch.add(beam);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 3), mat(['#ffd23f', '#3a86ff', '#ff5d8f'][i % 3])); f.rotation.x = Math.PI; f.position.set(-2.4 + i * 0.6, 2.0, 0); arch.add(f); }
  arch.position.set(0, 0, goalZ - 0.3); world.add(arch);
}

// ---------------------------------------------------------------- Gummo (our hero): lavender jelly cube, big eyes, candy-striped rubber limbs
const hero = new THREE.Group(); scene.add(hero);
const bodyM = glossy('#b69cff');
const body = new THREE.Mesh(rounded(1.0, 0.95, 0.8, 0.3), bodyM); body.rotation.x = -Math.PI / 2; body.castShadow = true;
const bodyG = new THREE.Group(); bodyG.add(body); hero.add(bodyG);
const eyeW = mat('#ffffff'), eyeB = mat('#2b2d42');
const eyes = [-0.21, 0.21].map(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), eyeW); e.scale.set(1, 0.55, 1); e.position.set(x, 0.4, -0.14); const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), eyeB); p.position.set(0, 0.12, 0); e.add(p); e.pupil = p; bodyG.add(e); return e; });
const cheekM = mat('#ff8fab'); for (const x of [-0.33, 0.33]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.08, 14), cheekM); c.rotation.x = -Math.PI / 2; c.position.set(x, 0.405, 0.08); bodyG.add(c); }
const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 16, Math.PI), eyeB); mouth.rotation.x = -Math.PI / 2; mouth.position.set(0, 0.405, 0.14); mouth.rotation.z = Math.PI; bodyG.add(mouth);
const oMouth = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), eyeB); oMouth.rotation.x = -Math.PI / 2; oMouth.position.set(0, 0.41, 0.15); oMouth.visible = false; bodyG.add(oMouth);
const sweat = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glossy('#7fd3ff')); sweat.scale.set(1, 1, 1.5); sweat.position.set(0.5, 0.42, -0.35); sweat.visible = false; bodyG.add(sweat);
const sprout = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 14, Math.PI * 1.3), mat('#8e74e6')); sprout.position.set(0, 0.47, -0.32); sprout.rotation.y = Math.PI / 2; bodyG.add(sprout);

const limbGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1, true);
const handGeo = new THREE.SphereGeometry(0.22, 16, 12), cuffGeo = new THREE.TorusGeometry(0.16, 0.05, 8, 16);
let limbTex = stripeTex('#ff5d8f');
const limbs = [0, 1, 2, 3].map(i => {
  const m = new THREE.MeshStandardMaterial({ map: limbTex, roughness: 0.45 });
  const seg = new THREE.Mesh(limbGeo, m); seg.castShadow = true; scene.add(seg);
  const tip = new THREE.Group(); const h = new THREE.Mesh(handGeo, mat('#ffffff')); h.castShadow = true; if (i >= 2) h.scale.set(1, 0.7, 1.35);
  const cuff = new THREE.Mesh(cuffGeo, mat('#2b2d42')); cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.02; if (i < 2) tip.add(cuff);
  tip.add(h); scene.add(tip);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
  return { i, seg, tip, ring, m, p: new V3(), prev: new V3(), y: 0, squash: 0, cut: false };
});

// ---------------------------------------------------------------- state
let state = 'ready', bodyT = new V3(), bodyV = new V3(), drag = null, moves = 0, recorded = false, beatenShown = false, camZ = 0, time = 0, slips = [], debris = [], deadT = 0, warnT = 0;
const groundPlane = new THREE.Plane(new V3(0, 1, 0), 0), ray = new THREE.Raycaster();
function centroid() { const c = new V3(); for (const l of limbs) c.add(l.p); c.divideScalar(4); c.y = 0; return c; }
function anchor(i, b) { return new V3(b.x + ANCH[i][0], 0.32, b.z + ANCH[i][1]); }

function buildLevel() {
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', TH.ui);
  const r = rng((D.seed || level * 6007) + 3), fk = F.k();
  gen(r, fk); buildWorld();
  limbTex = stripeTex(TH.limb);
  for (const l of limbs) { l.m.map = limbTex; l.m.needsUpdate = true; l.cut = false; l.seg.visible = true; l.tip.visible = true; }
  limbs.forEach((l, i) => { l.p.set(HOME[i][0], 0, HOME[i][1] + 0.5); l.y = 0; });
  for (const d of debris) scene.remove(d.m); debris = [];
  bodyT.copy(centroid()); bodyV.set(0, 0, 0); hero.position.set(bodyT.x, 0, bodyT.z); hero.rotation.set(0, 0, 0); hero.scale.setScalar(1); hero.visible = true;
  drag = null; moves = 0; recorded = false; camZ = bodyT.z; deadT = 0; slips = [];
  state = 'ready'; ui.levels(level); ui.progress(0); ui.score(total); ui.sub(best ? 'BEST ' + best : ''); movesEl.textContent = '✋ 0 moves';
}

function pointerWorld(e) {
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera); const p = new V3(); ray.ray.intersectPlane(groundPlane, p); return p;
}
function grab(i, from) { drag = { i, start: limbs[i].p.clone(), from: from.clone() }; limbs[i].prev.copy(limbs[i].p); tone(420, 0.06, 'triangle', 0.1, 1.4); buzz(6); }
function release() {
  if (!drag) return; const l = limbs[drag.i]; drag = null;
  if (state !== 'play') return;
  if (canPlant(l.p.x, l.p.z)) {
    if (l.p.distanceTo(l.prev) > 0.25) { moves++; movesEl.textContent = `✋ ${moves} move${moves > 1 ? 's' : ''}`; }
    l.squash = 1; sfx.pick(Math.min(5, moves % 6)); buzz(10);
    burst(scene, new V3(l.p.x, 0.1, l.p.z), ['#ffffff', TH.f1], 6, { speed: 0.05, up: 0.04, size: 0.4 });
  } else {
    slips.push({ l, from: l.p.clone(), to: l.prev.clone(), t: 0 }); sfx.bounce(); ui.pop(isPit(l.p.x, l.p.z) ? 'NO GRIP!' : 'BLOCKED!', '#fff', 30, 30);
  }
}
input({
  onDown: (e) => { if (state !== 'play' || drag) return; const w = pointerWorld(e); let bi = -1, bd = 1e9; limbs.forEach((l, i) => { if (l.cut) return; const d = Math.hypot(l.p.x - w.x, l.p.z - w.z); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0 && bd < 2.6) grab(bi, w); },
  onMove: (dx, dy, e) => { if (!drag || state !== 'play') return; const w = pointerWorld(e); const l = limbs[drag.i]; l.p.set(clamp(drag.start.x + w.x - drag.from.x, -HALF + 0.2, HALF - 0.2), 0, drag.start.z + w.z - drag.from.z); },
  onUp: () => release(),
});
ui.onTap(which => { if (which === 'start') { state = 'play'; sfx.tap(); } else { buildLevel(); state = 'play'; } B.start(); });

function die(kind, li) {
  if (state !== 'play') return;
  state = 'lost'; drag = null; deadT = 0;
  if (!recorded) { recorded = true; F.level(false, clamp(-bodyT.z / Lz, 0, 1)); }
  if (li !== undefined) {
    const l = limbs[li]; l.cut = true; l.seg.visible = false;
    const a = anchor(li, bodyT);
    for (const [p, len] of [[a, 0.6], [l.p, 0.6]]) {
      const m = new THREE.Mesh(limbGeo, l.m); m.scale.set(1.2, len, 1.2); m.position.copy(p).setY(0.4); m.rotation.z = Math.random() * 3; scene.add(m);
      debris.push({ m, v: new V3((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4), s: new V3(Math.random() * 9, 0, Math.random() * 9) });
    }
    burst(scene, l.p.clone().setY(0.4), [TH.limb, '#ffffff'], 16, { speed: 0.1, up: 0.1, size: 0.5 });
  }
  sfx.smash(); buzz([40, 30, 70]); ui.flash(0.5);
  const lines = { tear: ['SNAP!', 'Stretched too far — keep limbs out of the red'], saw: ['SLICED!', 'Cross saw rows on the free side'], spike: ['OUCH!', 'Limbs can\'t pass over spikes'], body: ['BONK!', 'Keep Gummo clear of the hazards'] };
  oMouth.visible = true; mouth.visible = false;
  ui.lose(...lines[kind]); total = 0;
}
function win() {
  state = 'won'; drag = null;
  if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  const pts = 20 * level + Math.max(0, Math.round(Lz * 0.8) - moves) * 5;
  total += pts; best = Math.max(best, total); save.set('best', best);
  const lv = level; level++; save.set('level', level);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, hero.position.clone().setY(1.5), 90);
  if (D.beaten(total) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 46, 26); } else ui.pop(moves <= Lz * 0.5 ? 'SMOOTH CLIMB!' : 'ESCAPED!', '#ffd23f', 42, 26);
  D.won(total); ui.score(total);
  ui.win(lv, `${moves} moves · +${pts}`);
}

// ---------------------------------------------------------------- loop
const UP = new V3(0, 1, 0), tmp = new V3(), tmp2 = new V3();
loop((dt, t) => {
  const dts = dt / 60; time += dts;
  for (const s of saws) { s.x = sawX(s, time); s.mesh.position.x = s.x; s.blade.rotation.y -= 0.5 * dt; }
  // slip-back tweens
  for (const sl of slips) { sl.t = Math.min(1, sl.t + dts * 5); sl.l.p.lerpVectors(sl.from, sl.to, 1 - (1 - sl.t) ** 3); }
  slips = slips.filter(sl => sl.t < 1);
  if (state === 'play' || state === 'ready') bodyT.copy(centroid());
  // spring the hero toward the limb centroid: wobbly, juicy follow
  const hp = hero.position; tmp.set(bodyT.x - hp.x, 0, bodyT.z - hp.z);
  if (state !== 'lost') { bodyV.addScaledVector(tmp, 0.06 * dt); bodyV.multiplyScalar(Math.pow(0.78, dt)); hp.add(tmp2.copy(bodyV).multiplyScalar(dt)); }
  const sp = bodyV.length();
  bodyG.scale.set(1 + sp * 0.6, 1 - sp * 0.5, 1 + sp * 0.6); bodyG.position.y = 0.55 + Math.sin(t * 3) * 0.03;
  // limbs
  let maxRatio = 0;
  limbs.forEach((l, i) => {
    if (l.cut) return;
    const lifted = drag && drag.i === i;
    l.y = lerp(l.y, lifted ? 0.55 : 0.12, 0.3 * dt);
    l.squash = Math.max(0, l.squash - 0.08 * dt);
    l.tip.position.set(l.p.x, l.y + 0.08, l.p.z); l.tip.scale.set(1 + l.squash * 0.4, 1 - l.squash * 0.4, 1 + l.squash * 0.4);
    const a = new V3(hp.x + ANCH[i][0], 0.48, hp.z + ANCH[i][1]), b = l.tip.position;
    tmp.copy(b).sub(a); const len = Math.max(0.05, tmp.length());
    const lenT = Math.hypot(l.p.x - (bodyT.x + ANCH[i][0]), l.p.z - (bodyT.z + ANCH[i][1]));
    const ratio = lenT / LMAX; maxRatio = Math.max(maxRatio, ratio);
    const th = clamp(Math.sqrt(1.0 / Math.max(0.6, len)), 0.42, 1.1);
    l.seg.position.copy(a).add(b).multiplyScalar(0.5); l.seg.quaternion.setFromUnitVectors(UP, tmp.normalize()); l.seg.scale.set(th, len, th);
    const danger = clamp((ratio - 0.7) / 0.3, 0, 1);
    l.m.color.setRGB(1, 1 - danger * 0.75, 1 - danger * 0.75); l.m.emissive.setRGB(danger * 0.5 * (0.6 + 0.4 * Math.sin(t * 20)), 0, 0);
    // planting preview ring under a dragged tip
    l.ring.position.set(l.p.x, 0.03, l.p.z); l.ring.material.opacity = lifted ? 0.9 : 0; l.ring.material.color.set(canPlant(l.p.x, l.p.z) ? '#ffffff' : '#ff3b3b');
  });
  // face: eyes look at the dragged hand, sweat + O-mouth near the limit
  const look = drag ? limbs[drag.i].p : new V3(hp.x, 0, hp.z - 2);
  for (const e of eyes) { tmp.set(look.x - hp.x, 0, look.z - hp.z).normalize().multiplyScalar(0.06); e.pupil.position.set(tmp.x, 0.12, tmp.z); }
  if (state !== 'lost') { sweat.visible = maxRatio > 0.78; oMouth.visible = maxRatio > 0.85; mouth.visible = !oMouth.visible; }
  if (sweat.visible) sweat.position.y = 0.42 + Math.abs(Math.sin(t * 8)) * 0.06;
  if (state === 'play' && maxRatio > 0.85) { warnT -= dts; if (warnT <= 0) { warnT = 0.25; tone(300 + maxRatio * 300, 0.05, 'square', 0.04, 1.2); } }
  // hazards + rules
  if (state === 'play') {
    for (let i = 0; i < 4; i++) {
      const l = limbs[i]; if (l.cut) continue;
      const ax = bodyT.x + ANCH[i][0], az = bodyT.z + ANCH[i][1];
      if (Math.hypot(l.p.x - ax, l.p.z - az) > LMAX) { die('tear', i); break; }
      let hit = null;
      for (const s of saws) if (segDist(s.x, s.z, ax, az, l.p.x, l.p.z) < SAW_R + 0.06) hit = 'saw';
      for (const R of spikes) if (segHitsRect(ax, az, l.p.x, l.p.z, R, 0.04)) hit = 'spike';
      if (hit) { die(hit, i); break; }
    }
    if (state === 'play') {
      for (const s of saws) if (Math.hypot(s.x - bodyT.x, s.z - bodyT.z) < SAW_R + BODY_R) die('body');
      for (const R of spikes) if (state === 'play' && inRect(bodyT.x, bodyT.z, R, BODY_R * 0.8)) die('body');
    }
    ui.progress(-bodyT.z / Lz);
    if (state === 'play' && bodyT.z < goalZ - 0.6) win();
  }
  if (state === 'lost') { deadT += dts; hero.rotation.z = Math.min(1.2, deadT * 3); }
  if (state === 'won') { hero.rotation.y += 0.15 * dt; bodyG.position.y = 0.55 + Math.abs(Math.sin(t * 9)) * 0.5; }
  for (const d of debris) { if (d.m.position.y > 0.1) { d.v.y -= 14 * dts; d.m.position.addScaledVector(d.v, dts); d.m.rotation.x += d.s.x * dts; d.m.rotation.z += d.s.z * dts; } }
  // camera follows the hero up the course
  camZ = lerp(camZ, hp.z, 0.06 * dt);
  camera.position.set(0, 13.5, camZ + 6.2); camera.lookAt(0, 0, camZ - 2.6);
  S.followLight(new V3(0, 0, camZ - 2));
});

buildLevel();
ui.start();

// ---------------------------------------------------------------- test hooks
// bot: picks the safest forward reach for the rear-most limb (never through saw rows' sweep, spikes, pits or the snap limit)
let botMove = null;
function safeAfter(i, nx, nz, plant = true) {
  // plant=true: final resting pose (mover must stay clear of the whole saw sweep); plant=false: a point on the drag path (only the saws' current spots)
  if (plant && !canPlant(nx, nz)) return null;
  const c = new V3(); limbs.forEach((l, k) => { c.x += (k === i ? nx : l.p.x) / 4; c.z += (k === i ? nz : l.p.z) / 4; });
  for (let k = 0; k < 4; k++) {
    const px = k === i ? nx : limbs[k].p.x, pz = k === i ? nz : limbs[k].p.z, ax = c.x + ANCH[k][0], az = c.z + ANCH[k][1];
    const mine = k === i, rest = mine && plant;
    if (Math.hypot(px - ax, pz - az) > LMAX * (rest ? 0.86 : 0.95)) return null;
    for (const s of saws) if (rest ? segHitsRect(ax, az, px, pz, s.band, 0.1) : segDist(s.x, s.z, ax, az, px, pz) < SAW_R + 0.45) return null;
    for (const R of spikes) if (segHitsRect(ax, az, px, pz, R, rest ? 0.18 : 0.06)) return null;
  }
  for (const s of saws) if (plant ? inRect(c.x, c.z, s.band, BODY_R + 0.1) : Math.hypot(s.x - c.x, s.z - c.z) < SAW_R + BODY_R + 0.4) return null;
  for (const R of spikes) if (inRect(c.x, c.z, R, BODY_R + 0.12)) return null;
  return c;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play' || drag || slips.length) return;
    if (botMove) return;
    const cur = centroid();
    // next obstacle row ahead (saw sweep or spikes): steer toward the widest free lane through it
    const obs = [...saws.map(s => s.band), ...spikes].filter(R => R.z1 < cur.z + 1.2 && R.z0 > cur.z - 6).sort((a, b) => b.z0 - a.z0);
    let laneX = null;
    if (obs.length) {
      const o = obs[0], row = [...saws.map(s => s.band), ...spikes].filter(R => R.z0 < o.z1 + 0.6 && R.z1 > o.z0 - 0.6);
      const cuts = row.map(R => [R.x0 - 0.2, R.x1 + 0.2]).sort((a, b) => a[0] - b[0]);
      let x = -HALF, lanes = [];
      for (const [x0, x1] of cuts) { if (x0 > x) lanes.push([x, x0]); x = Math.max(x, x1); }
      if (x < HALF) lanes.push([x, HALF]);
      lanes = lanes.filter(([a, b]) => b - a > 1.3);
      if (lanes.length) laneX = lanes.map(([a, b]) => (a + b) / 2).sort((a, b) => Math.abs(a - cur.x) - Math.abs(b - cur.x))[0];
    }
    const strain = (c, i, nx, nz) => { let t = 0; for (let k = 0; k < 4; k++) { const px = k === i ? nx : limbs[k].p.x, pz = k === i ? nz : limbs[k].p.z; t += Math.max(0, Math.hypot(px - c.x - ANCH[k][0], pz - c.z - ANCH[k][1]) - 1.7); } return t; };
    const value = (c, i = -1, nx = 0, nz = 0) => -c.z - (laneX !== null ? 0.6 * Math.abs(c.x - laneX) : 0.04 * Math.abs(c.x)) - 0.25 * strain(c, i, nx, nz);
    const base = value(cur);
    let bestM = null;
    const order = [0, 1, 2, 3].filter(i => !limbs[i].cut).sort((a, b) => limbs[b].p.z - limbs[a].p.z);
    for (const i of order) {                       // climb like a person: rear-most limb first
      const l = limbs[i]; let bestV = base + 0.02;
      for (let dz = -4.2; dz <= 1.2; dz += 0.3) for (let x = -HALF + 0.3; x <= HALF - 0.3; x += 0.3) {
        const nz = l.p.z + dz; const c = safeAfter(i, x, nz); if (!c) continue;
        let ok = true; for (let k = 1; k < 10 && ok; k++) if (!safeAfter(i, lerp(l.p.x, x, k / 10), lerp(l.p.z, nz, k / 10), false)) ok = false;
        if (!ok) continue;
        const v = value(c, i, x, nz);
        if (v > bestV) { bestV = v; bestM = { i, x, z: nz }; }
      }
      if (bestM) break;
    }
    if (!bestM) return;
    const l = limbs[bestM.i]; grab(bestM.i, l.p);
    const from = l.p.clone(), to = new V3(bestM.x, 0, bestM.z); let k = 0;
    botMove = setInterval(() => { k++; l.p.lerpVectors(from, to, Math.min(1, k / 5)); if (k >= 5 || state !== 'play') { clearInterval(botMove); botMove = null; release(); } }, 40);
  },
};

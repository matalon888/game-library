// Sticky Mitts — original draw-line heist. Drag the glove: a stretchy arm follows your finger across the vault floor.
// Lasers and spinning laser bars zap any part of the arm, sleeping bots wake if the arm brushes them, lookout bots spot the glove
// inside their torch beam. Reach the loot and the arm snaps back with it.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { canvasTex } from './geo.js';

const NAME = 'Sticky Mitts: Draw Line Heist';
const S = createStage({ fov: 40, shadowSize: 9 });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.55; hemi.intensity = 1.25;
const ui = createUI({ title: 'STICKY<br>MITTS', hint: 'Drag the glove to the loot', hand: '👆', score: false });
const D = daily('stickymitts', ui, { name: NAME });
const save = store('stickymitts');
const F = flow('stickymitts');
let level = save.get('level', 1), haul = save.get('haul', 0);

const css = document.createElement('style'); css.textContent = `
.hc-pop{-webkit-text-stroke:5px rgba(60,30,80,.55);paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(60,30,90,.3)}
.hc-pill{background:rgba(60,30,90,.35)}
.sm-tag{position:fixed;left:0;right:0;top:calc(58px + env(safe-area-inset-top));text-align:center;font-weight:800;font-size:18px;z-index:5;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.18)}
`; document.head.appendChild(css);
const tag = document.createElement('div'); tag.className = 'sm-tag'; document.body.appendChild(tag);

// ---------------------------------------------------------------- room geometry
const XW = 2.7, ZTOP = -5.0, ZBOT = 3.3, ARMY = 0.42, AR = 0.13;
const THEMES = [
  { bg: ['#ffd1e8', '#ffeccf'], t1: '#fff1f6', t2: '#ffe0ec', wall: '#ff7aa8', out: '#f7c7da', ui: '#ff5d8f' },
  { bg: ['#c8f1ff', '#eafff6'], t1: '#effcff', t2: '#d8f3fb', wall: '#3fb8d6', out: '#bfe6f0', ui: '#1f9cc0' },
  { bg: ['#e2d4ff', '#ffe1f4'], t1: '#f7f1ff', t2: '#e9ddff', wall: '#8b6cff', out: '#d6c8f5', ui: '#7b5cff' },
  { bg: ['#ffe2b8', '#fff7da'], t1: '#fff8ea', t2: '#ffeccc', wall: '#ff9446', out: '#f7d6b0', ui: '#ff8130' },
  { bg: ['#cdf5df', '#f0ffe8'], t1: '#f2fff6', t2: '#d9f6e4', wall: '#3cbf8a', out: '#c2ead3', ui: '#2fa877' },
];
let TH = THEMES[0];
const world = new THREE.Group(); scene.add(world);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#f7c7da')); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);

function tileTex(a, b) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.fillRect(i * 64, j * 64, 64, 64);
    g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
  }, true);
}
function textSprite(txt, color = '#fff', size = 90, stroke = 'rgba(0,0,0,.35)') {
  const t = canvasTex(256, 128, (g, w, h) => { g.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = stroke; g.strokeText(txt, w / 2, h / 2 + 6); g.fillStyle = color; g.fillText(txt, w / 2, h / 2 + 6); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(1.2, 0.6, 1); s.renderOrder = 10; return s;
}

// ---------------------------------------------------------------- hero (round bean burglar in a pom-pom beanie) + glove + arm
const heroPos = new THREE.Vector3(-1.75, 0, 4.45);
const hero = new THREE.Group(); scene.add(hero);
{
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), glossy('#ff8c42')); body.scale.set(1, 1.05, 0.95); body.position.y = 0.66; body.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), mat('#ffd6a8')); belly.scale.set(1, 1, 0.5); belly.position.set(0, 0.5, 0.42);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#2fb5a3')); hat.position.set(0, 1.08, -0.22); hat.scale.set(0.8, 0.7, 0.8); hat.rotation.x = -0.5;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 10, 28), mat('#ffffff')); band.rotation.x = Math.PI / 2 - 0.5; band.position.set(0, 1.08, -0.22); band.scale.setScalar(0.8);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), mat('#ffffff')); pom.position.set(0, 1.42, -0.5);
  hero.add(body, belly, hat, band, pom);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), mat('#ffffff')); eye.position.set(s * 0.23, 1.0, 0.42);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat('#2b2d42')); pup.position.set(s * 0.21 + 0.03, 1.07, 0.58);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat('#2b2d42')); foot.scale.set(1, 0.6, 1.4); foot.position.set(s * 0.28, 0.1, 0.18); foot.castShadow = true;
    hero.add(eye, pup, foot);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16, Math.PI), mat('#2b2d42')); mouth.position.set(0.02, 0.7, 0.6); mouth.rotation.z = Math.PI; hero.add(mouth);
  const armStub = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), glossy('#ff8c42')); armStub.position.set(0.58, 0.45, -0.05); hero.add(armStub);
  hero.position.copy(heroPos); hero.rotation.set(-0.35, 0.3, 0, 'YXZ');
}
const ARMCOL = '#ff8c42';
const armMat = glossy(ARMCOL);
let armMesh = null;
const glove = new THREE.Group(); scene.add(glove);
{
  const gm = glossy('#ffd23f');
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), gm); palm.scale.set(1, 0.75, 1.1); palm.castShadow = true;
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.14, 4, 8), gm); thumb.position.set(0.22, 0, 0.05); thumb.rotation.z = -1.0;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.07, 10, 20), mat('#ffffff')); cuff.position.z = 0.24;
  const fingers = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), gm); f.rotation.x = Math.PI / 2; f.position.set((i - 1) * 0.12, 0.02, -0.27); f.castShadow = true; fingers.push(f); glove.add(f); }
  glove.add(palm, thumb, cuff); glove.fingers = fingers;
}
const shoulder = new THREE.Vector3(heroPos.x + 0.55, ARMY, heroPos.z - 0.15);
const handStart = new THREE.Vector3(-0.9, ARMY, ZBOT - 0.1);

// ---------------------------------------------------------------- level objects
let obs = [], lootObj = null, lootPos = new THREE.Vector3(), lootVal = 0, pts = [], tip = new THREE.Vector3(), armDirty = true;
let state = 'ready', sub = 'reach', t = 0, finger = null, botPath = [], botI = 0, botOn = false, startDist = 1, progress = 0, recorded = false, shake = 0, beatenShown = false;
let lastStretch = 0, flashT = 0, caughtBy = null;
const laserMat = new THREE.MeshBasicMaterial({ color: '#ff2a55' });
const glowMat = new THREE.MeshBasicMaterial({ color: '#ff5d7a', transparent: true, opacity: 0.35, depthWrite: false });
const postMat = mat('#3a3550');
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1);

function beam(a, b) {   // a red laser beam between two floor points, plus posts
  const g = new THREE.Group(), len = Math.hypot(b.x - a.x, b.z - a.z);
  const core = new THREE.Mesh(CYL, laserMat); core.scale.set(0.035, len, 0.035);
  const glow = new THREE.Mesh(CYL, glowMat); glow.scale.set(0.1, len, 0.1);
  for (const m of [core, glow]) { m.rotation.z = Math.PI / 2; m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); m.position.set((a.x + b.x) / 2, ARMY, (a.z + b.z) / 2); g.add(m); }
  for (const p of [a, b]) { const post = new THREE.Mesh(rounded(0.22, 0.75, 0.22, 0.06), postMat); post.position.set(p.x, 0.37, p.z); post.castShadow = true; const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), laserMat); lamp.position.set(p.x, 0.78, p.z); g.add(post, lamp); }
  return g;
}
function botModel(sleep) {
  const g = new THREE.Group(), shell = sleep ? '#9aa3c7' : '#5b6bd6';
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), glossy(shell)); body.scale.set(1, 0.85, 1); body.position.y = 0.4; body.castShadow = true;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), glossy('#232338')); visor.rotation.x = Math.PI / 2; visor.position.set(0, 0.5, -0.17); visor.scale.set(1, 1, 0.6);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: sleep ? '#55607a' : '#ffe14d' })); eye.position.set(0, 0.52, -0.4); if (sleep) eye.scale.set(1.4, 0.25, 1);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), postMat); ant.position.y = 0.88; const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: sleep ? '#7a86b8' : '#ff4d6d' })); bulb.position.y = 1.05;
  g.add(body, visor, eye, ant, bulb); g.eye = eye; g.bulb = bulb; g.body = body; return g;
}
function lootModel(kind) {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 24), mat('#ffffff')); ped.position.y = 0.15; ped.castShadow = true; ped.receiveShadow = true;
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 24), mat('#e63e6d')); cushion.position.y = 0.34;
  g.add(ped, cushion);
  const item = new THREE.Group(); item.position.y = 0.75; g.add(item); g.item = item;
  if (kind === 0) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), glossy('#4de1ff', { emissive: '#1a7fa8', emissiveIntensity: 0.4, flatShading: true })); gem.scale.y = 1.3; gem.castShadow = true; item.add(gem); }
  else if (kind === 1) { for (let i = 0; i < 3; i++) { const bar = new THREE.Mesh(rounded(0.42, 0.16, 0.22, 0.04), glossy('#ffc531', { metalness: 0.5, emissive: '#7a5200', emissiveIntensity: 0.2 })); bar.position.set(i === 2 ? 0 : (i - 0.5) * 0.24, -0.15 + (i === 2 ? 0.17 : 0), 0); bar.castShadow = true; item.add(bar); } }
  else { const dn = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.13, 14, 28), mat('#e3a35f')); const ic = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.135, 14, 28, Math.PI * 2), mat('#ff7eb6')); ic.scale.z = 0.6; ic.position.z = 0.03; dn.castShadow = true; item.add(dn, ic); item.rotation.x = 0; }
  return g;
}

// ---------------------------------------------------------------- geometry helpers (2D on x/z)
function psd(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let u = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; u = clamp(u, 0, 1); return Math.hypot(px - ax - u * dx, pz - az - u * dz); }
function cross(ax, az, bx, bz, cx, cz) { return (bx - ax) * (cz - az) - (bz - az) * (cx - ax); }
function segDist(a, b, c, d) {
  const d1 = cross(a.x, a.z, b.x, b.z, c.x, c.z), d2 = cross(a.x, a.z, b.x, b.z, d.x, d.z), d3 = cross(c.x, c.z, d.x, d.z, a.x, a.z), d4 = cross(c.x, c.z, d.x, d.z, b.x, b.z);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
  return Math.min(psd(a.x, a.z, c.x, c.z, d.x, d.z), psd(b.x, b.z, c.x, c.z, d.x, d.z), psd(c.x, c.z, a.x, a.z, b.x, b.z), psd(d.x, d.z, a.x, a.z, b.x, b.z));
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
function spinEnds(o) { const c = Math.cos(o.th) * o.L, s = Math.sin(o.th) * o.L; return [{ x: o.x - c, z: o.z - s }, { x: o.x + c, z: o.z + s }]; }
function guardDir(o) { return o.base + o.amp * Math.sin(o.ph + t * o.spd); }
function inCone(o, x, z, extra = 0) { const d = Math.hypot(x - o.x, z - o.z); if (d > o.R + extra || d < 0.05) return false; return Math.abs(angDiff(Math.atan2(z - o.z, x - o.x), guardDir(o))) < o.half + extra * 0.3; }

// ---------------------------------------------------------------- level generation
function clearLevel() { world.clear(); obs = []; if (armMesh) { scene.remove(armMesh); armMesh.geometry.dispose(); armMesh = null; } }
function genLevel(seed) {
  const r = rng(seed), fk = F.k(), L = level;
  const rows = Math.min(5, 2 + Math.floor((L + 1) / 2));
  const list = [];
  let lastGap = handStart.x;
  const zs = []; for (let i = 0; i < rows; i++) zs.push(lerp(ZBOT - 1.3, ZTOP + 1.9, rows === 1 ? 0.5 : i / (rows - 1)));
  const pool = ['laser', 'laser'];
  if (L >= 2) pool.push('sleep'); if (L >= 3) pool.push('spin'); if (L >= 4) pool.push('guard'); if (L >= 6) pool.push('spin', 'guard', 'split');
  for (let i = 0; i < rows; i++) {
    const z = zs[i] + (r() - 0.5) * 0.3;
    let type = L === 1 ? 'laser' : L === 2 && i === 1 ? 'sleep' : pool[Math.floor(r() * pool.length)];
    if (L === 3 && i === 1) type = 'spin'; if (L === 4 && i === 1) type = 'guard';
    if (type === 'laser' || type === 'split') {
      const gap = clamp((1.75 - L * 0.025) / fk, 0.95, 2.1);
      let gx; let tries = 0;
      do { gx = lerp(-XW + gap / 2 + 0.25, XW - gap / 2 - 0.25, r()); } while (Math.abs(gx - lastGap) < 1.4 && tries++ < 20);
      lastGap = gx;
      if (gx - gap / 2 > -XW + 0.1) list.push({ type: 'laser', a: { x: -XW, z }, b: { x: gx - gap / 2, z } });
      if (gx + gap / 2 < XW - 0.1) list.push({ type: 'laser', a: { x: gx + gap / 2, z }, b: { x: XW, z } });
      if (type === 'split' && i < rows - 1) { const z2 = zs[i + 1]; const sx = gx + (r() < 0.5 ? -1 : 1) * (gap / 2 + 0.6); if (Math.abs(sx) < XW - 0.4) list.push({ type: 'laser', a: { x: sx, z: z - 0.05 }, b: { x: sx, z: lerp(z, z2, 0.7) } }); }
    } else if (type === 'sleep') {
      const n = L >= 5 && r() < 0.5 ? 2 : 1;
      for (let k = 0; k < n; k++) { const x = n === 1 ? lerp(-1.3, 1.3, r()) : (k ? 1 : -1) * lerp(0.9, 1.7, r()); list.push({ type: 'sleep', x, z, r: 0.5 }); }
      const gx = n === 1 ? (list[list.length - 1].x > 0 ? -XW + 0.8 : XW - 0.8) : 0; lastGap = gx;
      // a short laser stub so sleepers form a real row
      if (n === 1) { const sx = list[list.length - 1].x; list.push({ type: 'laser', a: { x: sx > 0 ? XW : -XW, z }, b: { x: sx + (sx > 0 ? 0.55 : -0.55), z } }); }
    } else if (type === 'spin') {
      const Ls = clamp(0.95 + r() * 0.3, 0.9, 1.3), x = lerp(-1.1, 1.1, r());
      list.push({ type: 'spin', x, z, L: Ls, th: r() * 6, w: (0.035 + L * 0.0012) * fk * (r() < 0.5 ? -1 : 1) });
      lastGap = x > 0 ? -1.6 : 1.6;
    } else if (type === 'guard') {
      const side = r() < 0.5 ? -1 : 1, x = side * (XW - 0.45);
      list.push({ type: 'guard', x, z, R: clamp((3.3 + L * 0.04) * fk, 2.8, 4.6), base: side < 0 ? 0 : Math.PI, amp: 0.75, spd: clamp((1.15 + L * 0.02) * fk, 0.9, 2.4), half: 0.36, ph: r() * 6 });
      lastGap = -side * 1.2;
    }
  }
  // a few crates for texture (they block the glove but don't trip anything)
  const nc = Math.min(3, Math.floor(L / 3));
  for (let k = 0; k < nc; k++) { const i = Math.floor(r() * (rows - 1)); const z = lerp(zs[i], zs[i + 1] ?? ZTOP + 1, 0.5); list.push({ type: 'crate', x: lerp(-1.8, 1.8, r()), z, hw: 0.32, hd: 0.32 }); }
  const lx = lerp(-1.6, 1.6, r());
  return { list, loot: { x: lx, z: ZTOP + 0.75 }, kind: Math.floor(r() * 3) };
}

// ---------------------------------------------------------------- pathfinding (for the bot + solvability)
const CELL = 0.18, GW = Math.ceil(2 * XW / CELL), GH = Math.ceil((ZBOT + 0.3 - ZTOP) / CELL);
const cx = (i) => -XW + (i + 0.5) * CELL, cz = (j) => ZTOP + (j + 0.5) * CELL;
function blockedAt(list, x, z, m = 0.33) {
  if (Math.abs(x) > XW - 0.22 || z < ZTOP + 0.2) return true;
  for (const o of list) {
    if (o.type === 'laser' && psd(x, z, o.a.x, o.a.z, o.b.x, o.b.z) < m) return true;
    if (o.type === 'sleep' && Math.hypot(x - o.x, z - o.z) < o.r + m) return true;
    if (o.type === 'spin' && Math.hypot(x - o.x, z - o.z) < o.L + m + 0.05) return true;
    if (o.type === 'crate' && Math.abs(x - o.x) < o.hw + m * 0.8 && Math.abs(z - o.z) < o.hd + m * 0.8) return true;
    if (o.type === 'guard' && Math.hypot(x - o.x, z - o.z) < 0.6) return true;
  }
  return false;
}
function zoneAt(list, x, z) { for (const o of list) if (o.type === 'guard') { const d = Math.hypot(x - o.x, z - o.z); if (d < o.R + 0.3 && Math.abs(angDiff(Math.atan2(z - o.z, x - o.x), o.base)) < o.amp + o.half + 0.15) return o; } return null; }
function findPath(list, from, to) {
  const N = GW * GH, blk = new Uint8Array(N), zone = new Uint8Array(N);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i; blk[k] = blockedAt(list, cx(i), cz(j)) ? 1 : 0; zone[k] = zoneAt(list, cx(i), cz(j)) ? 1 : 0; }
  const ci = (x) => clamp(Math.floor((x + XW) / CELL), 0, GW - 1), cj = (z) => clamp(Math.floor((z - ZTOP) / CELL), 0, GH - 1);
  const s = cj(from.z) * GW + ci(from.x), g = cj(to.z) * GW + ci(to.x);
  blk[s] = 0; blk[g] = 0;
  const dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  dist[s] = 0; const open = [s];
  const hx = (k) => Math.hypot((k % GW) - (g % GW), Math.floor(k / GW) - Math.floor(g / GW));
  while (open.length) {
    let bi = 0; for (let q = 1; q < open.length; q++) if (dist[open[q]] + hx(open[q]) < dist[open[bi]] + hx(open[bi])) bi = q;
    const k = open[bi]; open.splice(bi, 1); if (done[k]) continue; done[k] = 1; if (k === g) break;
    const i = k % GW, j = Math.floor(k / GW);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const nk = nj * GW + ni; if (blk[nk] || done[nk]) continue;
      if (di && dj && (blk[j * GW + ni] || blk[nj * GW + i])) continue;
      const c = dist[k] + (di && dj ? 1.414 : 1) * (zone[nk] ? 4 : 1);
      if (c < dist[nk]) { dist[nk] = c; prev[nk] = k; open.push(nk); }
    }
  }
  if (prev[g] < 0 && g !== s) return null;
  const path = []; for (let k = g; k >= 0; k = prev[k]) path.unshift({ x: cx(k % GW), z: cz(Math.floor(k / GW)) });
  // smooth: skip ahead while the straight line stays clear (and doesn't change guard-zone membership)
  const clear = (a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08); const za = !!zoneAt(list, a.x, a.z); for (let q = 1; q < n; q++) { const x = lerp(a.x, b.x, q / n), z = lerp(a.z, b.z, q / n); if (blockedAt(list, x, z, 0.3)) return false; if (!za && zoneAt(list, x, z) && !zoneAt(list, b.x, b.z)) return false; } return true; };
  const out = [path[0]]; let a = 0;
  while (a < path.length - 1) { let b = path.length - 1; while (b > a + 1 && !clear(path[a], path[b])) b--; out.push(path[b]); a = b; }
  out[out.length - 1] = { x: to.x, z: to.z };
  return out;
}

function build() {
  clearLevel();
  TH = THEMES[(level - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', TH.bg[0]); bs.setProperty('--bg2', TH.bg[1]); bs.setProperty('--ui', TH.ui);
  outer.material.color.set(TH.out);
  let seed = D.seed ? D.seed + level : level * 7919 + 13, lv = null, path = null;
  for (let tries = 0; tries < 30 && !path; tries++) { lv = genLevel(seed + tries * 101); path = (zoneAt(lv.list, handStart.x, handStart.z - 0.3) || zoneAt(lv.list, lv.loot.x, lv.loot.z)) ? null : findPath(lv.list, handStart, lv.loot); }
  if (!path) lv.list = lv.list.filter(o => o.type !== 'laser');
  // floor + walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, ZBOT - ZTOP + 0.6), mat('#ffffff', { map: tileTex(TH.t1, TH.t2) }));
  floor.material.map.repeat.set(XW * 2 / 1.2, (ZBOT - ZTOP + 0.6) / 1.2); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (ZBOT + 0.6 + ZTOP) / 2); floor.receiveShadow = true; world.add(floor);
  const wm = glossy(TH.wall), wh = 0.7, wt = 0.3;
  const wall = (w, d, x, z) => { const m = new THREE.Mesh(rounded(w, wh, d, 0.1), wm); m.position.set(x, wh / 2, z); m.castShadow = true; m.receiveShadow = true; world.add(m); };
  wall(2 * XW + 2 * wt, wt, 0, ZTOP - wt / 2);
  wall(wt, ZBOT - ZTOP + 0.6, -XW - wt / 2, (ZBOT + 0.6 + ZTOP) / 2); wall(wt, ZBOT - ZTOP + 0.6, XW + wt / 2, (ZBOT + 0.6 + ZTOP) / 2);
  const fz = ZBOT + 0.6 + wt / 2, gapL = handStart.x - 0.5, gapR = handStart.x + 0.5;
  wall(gapL + XW + wt, wt, (-XW - wt + gapL) / 2, fz); wall(XW + wt - gapR, wt, (XW + wt + gapR) / 2, fz);
  // a couple of paintings on the back wall for flavour
  for (const px of [-1.5, 1.5]) { const fr = new THREE.Mesh(rounded(0.9, 0.55, 0.08, 0.04), mat('#c9973f')); fr.position.set(px, 0.95, ZTOP - 0.2); const cv = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.38), mat(px < 0 ? '#7bd3ff' : '#ffb3c7')); cv.position.set(px, 0.95, ZTOP - 0.15); world.add(fr, cv); }
  for (const o of lv.list) {
    if (o.type === 'laser') { o.mesh = beam(o.a, o.b); world.add(o.mesh); }
    else if (o.type === 'sleep') { o.mesh = botModel(true); o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = Math.PI; world.add(o.mesh); o.z1 = textSprite('Z', '#ffffff', 80); o.z2 = textSprite('z', '#ffffff', 70); o.z1.scale.set(0.6, 0.3, 1); o.z2.scale.set(0.45, 0.22, 1); world.add(o.z1, o.z2); }
    else if (o.type === 'spin') {
      const g = new THREE.Group(); g.position.set(o.x, 0, o.z);
      const disc = new THREE.Mesh(new THREE.RingGeometry(o.L - 0.06, o.L + 0.06, 40), new THREE.MeshBasicMaterial({ color: '#ff2a55', transparent: true, opacity: 0.25, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.012;
      const fill = new THREE.Mesh(new THREE.CircleGeometry(o.L, 40), new THREE.MeshBasicMaterial({ color: '#ff5d7a', transparent: true, opacity: 0.08, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.01;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.62, 16), postMat); post.position.y = 0.31; post.castShadow = true;
      const bar = new THREE.Group(); bar.position.y = ARMY;
      const core = new THREE.Mesh(CYL, laserMat); core.scale.set(0.035, o.L * 2, 0.035); core.rotation.z = Math.PI / 2;
      const glow = new THREE.Mesh(CYL, glowMat); glow.scale.set(0.1, o.L * 2, 0.1); glow.rotation.z = Math.PI / 2;
      bar.add(core, glow); for (const s of [-1, 1]) { const tipm = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), laserMat); tipm.position.x = s * o.L; bar.add(tipm); }
      g.add(disc, fill, post, bar); o.mesh = g; o.bar = bar; world.add(g);
    } else if (o.type === 'guard') {
      const g = botModel(false); g.position.set(o.x, 0, o.z); world.add(g); o.mesh = g;
      const cone = new THREE.Mesh(new THREE.CircleGeometry(o.R, 32, -o.half, o.half * 2), new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.38, depthWrite: false }));
      cone.rotation.x = -Math.PI / 2; const cg = new THREE.Group(); cg.position.set(o.x, 0.02, o.z); cg.add(cone); world.add(cg); o.cone = cg; o.coneMat = cone.material;
      const sweep = new THREE.Mesh(new THREE.CircleGeometry(o.R, 40, o.base - o.amp - o.half, 2 * (o.amp + o.half)), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.12, depthWrite: false }));
      sweep.rotation.x = -Math.PI / 2; sweep.scale.y = -1; sweep.position.set(o.x, 0.008, o.z); world.add(sweep);
    } else if (o.type === 'crate') { const m = new THREE.Mesh(rounded(o.hw * 2, 0.6, o.hd * 2, 0.07), mat('#d9a066')); m.position.set(o.x, 0.3, o.z); m.castShadow = true; m.receiveShadow = true; const st = new THREE.Mesh(rounded(o.hw * 2 + 0.02, 0.12, o.hd * 2 + 0.02, 0.03), mat('#b97a3f')); st.position.set(o.x, 0.42, o.z); world.add(m, st); }
  }
  obs = lv.list;
  lootPos.set(lv.loot.x, ARMY, lv.loot.z);
  lootObj = lootModel(lv.kind); lootObj.position.set(lv.loot.x, 0, lv.loot.z); world.add(lootObj);
  lootVal = (5 + level * 3 + Math.floor(rng(seed)() * 5)) * 50;
  // arm
  pts = [shoulder.clone(), handStart.clone()]; tip.copy(handStart); armDirty = true;
  glove.position.copy(tip); glove.rotation.set(0, 0, 0); glove.visible = true;
  botPath = path || []; botI = 1; botOn = false; finger = null;
  startDist = Math.hypot(lootPos.x - tip.x, lootPos.z - tip.z); progress = 0; recorded = false; sub = 'reach'; caughtBy = null; beatenShown = false;
  ui.levels(level); ui.progress(0); tag.textContent = (D.isDaily ? 'DAILY HEIST · ' : '') + (haul ? '💰 $' + haul.toLocaleString() : '');
  laserMat.color.set('#ff2a55');
}

// ---------------------------------------------------------------- arm
function rebuildArm() {
  if (armMesh) { scene.remove(armMesh); armMesh.geometry.dispose(); }
  const cps = [pts[0].clone().setY(ARMY + 0.05), ...pts.slice(1), tip.clone()];
  if (cps.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(cps, false, 'centripetal');
  const segs = Math.min(400, Math.max(8, cps.length * 3));
  armMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, AR, 10, false), armMat); armMesh.castShadow = true; scene.add(armMesh);
  armDirty = false;
}
function armSegs() { const a = [...pts, tip]; const out = []; for (let i = 1; i < a.length - 1; i++) out.push([a[i], a[i + 1]]); return out; }
function moveTip(target, dt) {
  const dx = target.x - tip.x, dz = target.z - tip.z, d = Math.hypot(dx, dz);
  if (d < 0.01) return false;
  const step = Math.min(d, 0.17 * dt);
  let nx = tip.x + dx / d * step, nz = tip.z + dz / d * step;
  nx = clamp(nx, -XW + 0.2, XW - 0.2); nz = clamp(nz, ZTOP + 0.22, ZBOT + 0.45);
  for (const o of obs) if (o.type === 'crate') { const ex = o.hw + 0.2, ez = o.hd + 0.2; if (Math.abs(nx - o.x) < ex && Math.abs(nz - o.z) < ez) { const px = ex - Math.abs(nx - o.x), pz = ez - Math.abs(nz - o.z); if (px < pz) nx = o.x + Math.sign(nx - o.x) * ex; else nz = o.z + Math.sign(nz - o.z) * ez; } }
  if (Math.hypot(nx - tip.x, nz - tip.z) < 0.002) return false;
  // glove faces travel direction
  glove.rotation.y = Math.atan2(-(nx - tip.x), -(nz - tip.z));
  tip.set(nx, ARMY, nz);
  const last = pts[pts.length - 1];
  if (pts.length > 2 && Math.hypot(tip.x - pts[pts.length - 2].x, tip.z - pts[pts.length - 2].z) < 0.14) pts.pop();   // drag back = retract
  else if (Math.hypot(tip.x - last.x, tip.z - last.z) > 0.16) pts.push(tip.clone());
  armDirty = true;
  if (t - lastStretch > 0.07) { lastStretch = t; tone(260 + Math.min(pts.length, 80) * 5, 0.06, 'sine', 0.05, 1.25); }
  return true;
}

// ---------------------------------------------------------------- hazards
function checkHazards() {
  const segs = armSegs();
  for (const o of obs) {
    if (o.type === 'laser') { for (const [a, b] of segs) if (segDist(a, b, o.a, o.b) < AR + 0.03) return caught(o, 'Laser tripped!', a, b); }
    else if (o.type === 'spin') { const [e1, e2] = spinEnds(o); for (const [a, b] of segs) if (segDist(a, b, e1, e2) < AR + 0.03) return caught(o, 'Zapped by the spinner!', a, b); }
    else if (o.type === 'sleep') { for (const [a, b] of segs) if (psd(o.x, o.z, a.x, a.z, b.x, b.z) < o.r + AR - 0.04) return caught(o, 'You woke the bot!', a, b); }
    else if (o.type === 'guard') { if (inCone(o, tip.x, tip.z)) return caught(o, 'Spotted!', tip, tip); }
  }
  return false;
}
function caught(o, why, a, b) {
  if (state !== 'play') return true;
  state = 'lost'; sub = 'caught'; caughtBy = o; shake = 0.35; flashT = 1;
  const p = new THREE.Vector3((a.x + b.x) / 2, ARMY, (a.z + b.z) / 2);
  burst(scene, p, ['#ffffff', '#ff2a55', '#ffe14d'], 22, { speed: 0.12, up: 0.08, size: 0.6 });
  if (o.mesh) { const bang = textSprite('!', '#ff2a55', 110, '#ffffff'); bang.position.set(o.mesh.position.x, 1.6, o.mesh.position.z); bang.scale.set(1.2, 0.6, 1); world.add(bang); o.bang = bang; }
  if (o.type === 'sleep') { o.mesh.eye.material.color.set('#ff2a55'); o.mesh.eye.scale.set(1, 1, 1); o.mesh.bulb.material.color.set('#ff2a55'); }
  if (o.type === 'guard') { o.coneMat.color.set('#ff2a55'); o.coneMat.opacity = 0.5; }
  tone(880, 0.12, 'square', 0.1, 1); setTimeout(() => tone(660, 0.12, 'square', 0.1, 1), 150); setTimeout(() => tone(880, 0.12, 'square', 0.1, 1), 300); setTimeout(() => tone(660, 0.2, 'square', 0.1, 1), 450);
  tone(120, 0.35, 'sawtooth', 0.12, 0.5); buzz([40, 30, 80]); ui.flash(0.35);
  if (!recorded) { recorded = true; F.level(false, progress); }
  ui.lose('BUSTED!', why);
  return true;
}
function grab() {
  sub = 'retract'; sfx.coin(); buzz(25); ui.pop('GOT IT!', '#fff', 40, 30); ui.flash(0.25);
  burst(scene, lootPos.clone().setY(0.9), ['#ffffff', '#ffe14d', '#4de1ff'], 16, { speed: 0.1, up: 0.1, size: 0.5 });
  [0, 4, 7].forEach((s, i) => setTimeout(() => note(72 + s, 0.25, 0.14), i * 70));
}
function winLevel() {
  state = 'won'; haul += lootVal; save.set('haul', haul);
  if (!recorded) { recorded = true; F.level(true); }
  confetti(scene, hero.position.clone().add(new THREE.Vector3(0, 1.4, -0.5)), 70); sfx.win(); buzz([20, 40, 20]);
  if (!beatenShown && D.beaten(haul)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 26); }
  else ui.pop('+$' + lootVal.toLocaleString(), '#fff', 44, 26);
  tag.textContent = '💰 $' + haul.toLocaleString();
  level++; save.set('level', level);
  D.won(haul, 'stole');
  ui.win(level - 1, `Haul $${haul.toLocaleString()}`);
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ARMY), _v = new THREE.Vector2(), _hit = new THREE.Vector3();
function toWorld(e) { _v.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(_v, camera); return ray.ray.intersectPlane(plane, _hit) ? _hit.clone() : null; }
let dragging = false, grabOff = new THREE.Vector3();
input({
  onDown: (e) => {
    if (state !== 'play' || sub !== 'reach') return; const w = toWorld(e); if (!w) return;
    botOn = false;
    // you can grab anywhere, the glove keeps its offset to your finger so it never jumps (and stays visible above your thumb)
    grabOff.set(tip.x - w.x, 0, tip.z - w.z); if (grabOff.length() > 1.6) grabOff.setLength(1.6);
    dragging = true; finger = w.add(grabOff); glove.fingers.forEach(f => f.rotation.x = Math.PI / 2 + 0.5);
  },
  onMove: (dx, dy, e) => { if (!dragging) return; const w = toWorld(e); if (w) finger = w.add(grabOff); },
  onUp: () => { dragging = false; finger = null; glove.fingers.forEach(f => f.rotation.x = Math.PI / 2); },
});
ui.onTap((which) => { build(); state = 'play'; ui.hideStart(); });

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(0, 13.4, 9.2), camLook = new THREE.Vector3(0, 0, -0.35);
camera.position.copy(camPos); camera.lookAt(camLook);
loop((dt) => {
  t += dt / 60;
  if (state === 'play' && sub === 'reach') {
    const tgt = finger || (botOn && botPath[botI] ? new THREE.Vector3(botPath[botI].x, ARMY, botPath[botI].z) : null);
    if (tgt) moveTip(tgt, dt);
  }
  // animate hazards
  for (const o of obs) {
    if (o.type === 'spin') { o.th += o.w * dt; o.bar.rotation.y = -o.th; }
    else if (o.type === 'guard') { const a = state === 'lost' && caughtBy === o ? Math.atan2(tip.z - o.z, tip.x - o.x) : guardDir(o); o.cone.rotation.y = -a; o.mesh.rotation.y = -a - Math.PI / 2; if (state === 'lost' && caughtBy === o) { o.ph = Math.asin(clamp((a - o.base) / o.amp, -1, 1)) - t * o.spd; } }
    else if (o.type === 'sleep') { const b = 1 + Math.sin(t * 2.4 + o.x) * 0.04; o.mesh.body.scale.set(b, 0.85 / b, b); const k = (t * 0.5 + o.x) % 1, k2 = (t * 0.5 + o.x + 0.5) % 1; if (caughtBy !== o) { o.z1.position.set(o.x + 0.3 + k * 0.3, 1.0 + k * 0.8, o.z); o.z1.material.opacity = 1 - k; o.z2.position.set(o.x + 0.3 + k2 * 0.3, 1.0 + k2 * 0.8, o.z); o.z2.material.opacity = 1 - k2; } else { o.z1.visible = o.z2.visible = false; } }
    if (o.bang) o.bang.position.y = 1.5 + Math.abs(Math.sin(t * 8)) * 0.2;
  }
  if (state === 'play' && sub === 'reach') {
    if (!checkHazards()) {
      const d = Math.hypot(lootPos.x - tip.x, lootPos.z - tip.z);
      progress = clamp(1 - d / startDist, 0, 1); ui.progress(progress);
      if (d < 0.5) grab();
    }
  }
  if (sub === 'retract') {   // the arm snaps back along its own path, carrying the loot
    for (let k = 0; k < 3; k++) {
      const target = pts[pts.length - 1];
      const dx = target.x - tip.x, dz = target.z - tip.z, d = Math.hypot(dx, dz), step = 0.3 * dt;
      if (d <= step) { tip.copy(target); if (pts.length > 2) pts.pop(); else { sub = 'home'; break; } } else { tip.x += dx / d * step; tip.z += dz / d * step; }
    }
    armDirty = true; lootObj.item.position.set(tip.x - lootObj.position.x, 0.75, tip.z - lootObj.position.z);
    if (sub === 'home') { lootObj.item.visible = false; glove.visible = true; winLevel(); }
  }
  if (armDirty) rebuildArm();
  glove.position.set(tip.x, ARMY + (sub === 'reach' && (finger || botOn) ? 0.05 : 0), tip.z);
  if (lootObj) { lootObj.item.rotation.y += 0.03 * dt; if (sub === 'reach') lootObj.item.position.y = 0.75 + Math.sin(t * 3) * 0.06; }
  hero.position.y = Math.abs(Math.sin(t * (sub === 'retract' ? 14 : 3))) * (sub === 'retract' ? 0.12 : 0.03);
  if (flashT > 0) { flashT = Math.max(0, flashT - dt * 0.02); armMat.color.set(Math.floor(t * 12) % 2 ? '#ff2a55' : ARMCOL); if (!flashT) armMat.color.set(ARMCOL); }
  shake = Math.max(0, shake - dt * 0.012);
  camera.position.set(camPos.x + (Math.random() - 0.5) * shake, camPos.y + (Math.random() - 0.5) * shake, camPos.z);
  camera.lookAt(camLook);
  S.followLight(new THREE.Vector3(0, 0, -0.8));
});

build(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return haul; },
  bot() {
    if (state !== 'play' || sub !== 'reach' || dragging) return;
    botOn = true;
    const wp = botPath[botI]; if (!wp) return;
    if (Math.hypot(wp.x - tip.x, wp.z - tip.z) < 0.12) { botI++; return; }
    // wait outside a lookout's sweep until its torch is turned away and moving away
    const here = zoneAt(obs, tip.x, tip.z);
    let enter = null; for (let q = 1; q <= 8 && !enter; q++) { const x = lerp(tip.x, wp.x, q / 8), z = lerp(tip.z, wp.z, q / 8); const zo = zoneAt(obs, x, z); if (zo && zo !== here) enter = { zo, x, z }; }
    if (enter) {
      const o = enter.zo, a = Math.atan2(enter.z - o.z, enter.x - o.x), cur = guardDir(o), vel = Math.cos(o.ph + t * o.spd);
      const away = Math.sign(angDiff(cur, a)) === Math.sign(vel) || Math.abs(vel) < 0.15;
      if (!(Math.abs(angDiff(cur, a)) > o.half + 0.45 && away)) { botOn = false; return; }
    }
  },
};

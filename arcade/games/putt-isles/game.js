// Putt Isles — original sky mini-golf battle. Drag back like a slingshot to aim + power, release to putt. Beat the rivals to the cup.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { part, merge, canvasTex } from './geo.js';

const S = createStage({ fov: 55, shadowSize: 16 });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.8; hemi.intensity = 1.2;
const ui = createUI({ title: 'PUTT<br>ISLES', hint: 'Drag back · release to putt', hand: '👇', score: false });
const save = store('puttisles');
const F = flow('puttisles');
let fk = 1;
let level = save.get('level', 1);
const THEMES = [
  { sky: ['#62b8ff', '#e3f4ff'], g1: '#74d64e', g2: '#62c43f', side: '#8a5a36', rock: '#a9845f', rail: '#a8693a', decor: 'pine', fog: '#d6eefc' },
  { sky: ['#ffb27a', '#ffe9c9'], g1: '#c9d65a', g2: '#b6c44a', side: '#b0643a', rock: '#d0875a', rail: '#8a4e2c', decor: 'cactus', fog: '#ffe2c4' },
  { sky: ['#7ec9ff', '#f0fbff'], g1: '#3fc4b4', g2: '#33b1a2', side: '#6c7a8a', rock: '#c9d6e3', rail: '#7a5236', decor: 'snowpine', fog: '#e6f4ff' },
  { sky: ['#b49cff', '#ffe0f4'], g1: '#78d877', g2: '#66c565', side: '#7d5a9a', rock: '#9b86c0', rail: '#9a5a3a', decor: 'mushroom', fog: '#f0dcf6' },
];
let TH = THEMES[0];

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.pi-hud{position:fixed;top:calc(54px + env(safe-area-inset-top));left:10px;right:10px;display:flex;justify-content:space-between;align-items:flex-start;z-index:6;pointer-events:none}
.pi-box{background:rgba(20,40,80,.5);border-radius:12px;padding:3px 10px;font-weight:800;font-size:16px;line-height:1.2}
.pi-place{font-size:30px;font-weight:800;line-height:1;text-shadow:0 3px 0 rgba(0,0,0,.25)}
.pi-place sup{font-size:15px}
.pi-timer{position:fixed;left:50%;top:calc(52px + env(safe-area-inset-top));transform:translateX(-50%);font-weight:800;font-size:30px;z-index:6;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,.25)}
.pi-timer.warn{color:#ff4d6d}
.pi-lbl{position:fixed;z-index:5;pointer-events:none;font-weight:800;font-size:13px;transform:translate(-50%,-100%);white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.pi-pow{position:fixed;z-index:6;pointer-events:none;font-weight:800;font-size:20px;transform:translate(-50%,-50%);text-shadow:0 2px 0 rgba(0,0,0,.35)}
.hc-pop{-webkit-text-stroke:6px #24406b;paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(20,40,90,.35)!important}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const hud = H('<div class="pi-hud"><div class="pi-box">⛳ <span data-s>0</span> / PAR <span data-p>3</span></div><div class="pi-place" data-pl>1<sup>st</sup></div></div>');
const timerEl = H('<div class="pi-timer">30</div>');
const powEl = H('<div class="pi-pow"></div>');

// ---------------------------------------------------------------- textures
const checker = (a, b) => { const t = canvasTex(128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }, true); return t; };

// ---------------------------------------------------------------- course generation
const T = 4, BR = 0.2, RAMP_H = 1.0;
let world = null, tiles = [], tileMap = new Map(), rails = [], bumpers = [], sliders = [], spinners = [], cup = null, flag = null, par = 3, pathLen = 1;
const key = (x, z) => x + ',' + z;
const DIRS = { F: [0, -1], L: [-1, 0], R: [1, 0] };
function genPath(r) {
  const n = Math.min(12, 4 + level);
  const path = [{ gx: 0, gz: 0, type: 'tee', d: 'F' }];
  const occ = new Set([key(0, 0)]);
  let d = 'F', sinceTurn = 0;
  const ok = (gx, gz, prev) => { if (occ.has(key(gx, gz))) return false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(gx + dx, gz + dz); if (occ.has(k) && k !== key(prev.gx, prev.gz)) return false; } return true; };
  let rampsLeft = level >= 2 ? 1 + (level >= 6 ? 1 : 0) : 0;
  while (path.length < n) {
    const prev = path[path.length - 1];
    let nd = d;
    if (sinceTurn >= 2 && r() < 0.42) nd = d === 'F' ? (r() < 0.5 ? 'L' : 'R') : 'F';
    // ramp jump: ramp + gap + landing in a straight line
    if (rampsLeft > 0 && nd === d && sinceTurn >= 1 && path.length >= 2 && path.length < n - 3 && r() < 0.5) {
      const [dx, dz] = DIRS[d], cells = [1, 2, 3].map(k => [prev.gx + dx * k, prev.gz + dz * k]);
      let good = true, p = prev; for (const [cx, cz] of cells) { if (!ok(cx, cz, p)) { good = false; break; } p = { gx: cx, gz: cz }; }
      if (good) { ['ramp', 'gap', 'land'].forEach((ty, i) => { path.push({ gx: cells[i][0], gz: cells[i][1], type: ty, d }); occ.add(key(cells[i][0], cells[i][1])); }); rampsLeft--; sinceTurn = 3; continue; }
    }
    const tryDirs = [nd, d, 'F', 'L', 'R'].filter((v, i, a) => a.indexOf(v) === i && !(d === 'L' && v === 'R') && !(d === 'R' && v === 'L'));
    let placed = false;
    for (const td of tryDirs) { const [dx, dz] = DIRS[td], gx = prev.gx + dx, gz = prev.gz + dz; if (ok(gx, gz, prev)) { if (td !== d) { sinceTurn = 0; } else sinceTurn++; d = td; path.push({ gx, gz, type: 'plain', d }); occ.add(key(gx, gz)); placed = true; break; } }
    if (!placed) break;
  }
  path[path.length - 1].type = 'cup';
  // obstacles on plain straight tiles
  const pool = ['bumpers'];
  if (level >= 2) pool.push('slider');
  if (level >= 3) pool.push('spinner', 'slider');
  if (level >= 5) pool.push('spinner', 'bumpers');
  let obst = Math.min(5, level === 1 ? 1 : 1 + Math.floor(level / 2));
  for (let i = 2; i < path.length - 1 && obst > 0; i++) {
    const t = path[i], pv = path[i - 1], nx = path[i + 1];
    if (t.type !== 'plain' || pv.d !== t.d || nx.d !== t.d || pv.type === 'land') continue;
    if (r() < 0.65) { t.obst = pool[Math.floor(r() * pool.length)]; obst--; }
  }
  return path;
}
function heightAt(x, z) {
  const gx = Math.round(x / T), gz = Math.round(z / T), t = tileMap.get(key(gx, gz));
  if (!t || t.type === 'gap') return null;
  const lx = x - gx * T, lz = z - gz * T;
  if (Math.abs(lx) > T / 2 + 0.001 || Math.abs(lz) > T / 2 + 0.001) return null;
  if (t.type === 'ramp') { const [dx, dz] = DIRS[t.d]; const s = clamp((lx * dx + lz * dz) / T + 0.5, 0, 1); return s * RAMP_H; }
  return 0;
}
function buildCourse() {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.sky[0]); document.body.style.setProperty('--bg2', TH.sky[1]); document.body.style.setProperty('--ui', '#ff8a1f');
  scene.fog = new THREE.Fog(TH.fog, 45, 120);
  const r = rng(level * 4242 + 17);
  tiles = genPath(r); tileMap = new Map(tiles.map(t => [key(t.gx, t.gz), t]));
  rails = []; bumpers = []; sliders = []; spinners = [];
  const turf = [], sides = [], railP = [], rocks = [], decor = [];
  const open = new Set();
  for (let i = 1; i < tiles.length; i++) { const a = tiles[i - 1], b = tiles[i]; open.add(key(a.gx, a.gz) + '>' + key(b.gx, b.gz)); open.add(key(b.gx, b.gz) + '>' + key(a.gx, a.gz)); }
  const uvTop = (g, ox, oz) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + ox) / 2, (p.getZ(i) + oz) / 2); };
  for (const t of tiles) {
    const cx = t.gx * T, cz = t.gz * T;
    t.cx = cx; t.cz = cz;
    if (t.type === 'gap') continue;
    // turf top
    const top = new THREE.PlaneGeometry(T, T, 1, 1); top.rotateX(-Math.PI / 2);
    if (t.type === 'ramp') { const [dx, dz] = DIRS[t.d], p = top.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, clamp((p.getX(i) * dx + p.getZ(i) * dz) / T + 0.5, 0, 1) * RAMP_H); top.computeVertexNormals(); }
    uvTop(top, cx, cz); top.translate(cx, 0, cz); turf.push(top);
    // soil block under
    const hh = t.type === 'ramp' ? RAMP_H : 0;
    sides.push(part(new THREE.BoxGeometry(T, 1.2, T), TH.side, { x: cx, y: -0.61, z: cz }));
    if (t.type === 'ramp') { const [dx, dz] = DIRS[t.d]; sides.push(part(new THREE.BoxGeometry(T * 0.98, 0.12, T * 0.4), '#ffffff', { x: cx + dx * T * 0.3, y: RAMP_H * 0.8, z: cz + dz * T * 0.3, ry: dx ? Math.PI / 2 : 0, sy: 0.01, s: 0 })); }
    // floating rock under the tile
    { const sy = 1.4 + r() * 1.0; rocks.push(part(new THREE.DodecahedronGeometry(1, 0), TH.rock, { x: cx + (r() - 0.5) * 0.6, y: -1.0 - sy, z: cz + (r() - 0.5) * 0.6, sx: T * 0.6, sy, sz: T * 0.6, ry: r() * 6 })); }
    rocks.push(part(new THREE.ConeGeometry(1, 1, 6), TH.rock, { x: cx, y: -4.2 - r(), z: cz, sx: T * 0.45, sy: -(2.6 + r() * 2), sz: T * 0.45, ry: r() * 6 }));
    // rails on closed edges
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = key(t.gx + dx, t.gz + dz);
      if (open.has(key(t.gx, t.gz) + '>' + nk)) continue;
      const ex = cx + dx * T / 2, ez = cz + dz * T / 2, len = T + 0.36, th = 0.36, ht = 0.5;
      const along = dx ? 'z' : 'x';
      const rx0 = along === 'x' ? ex - len / 2 : ex - th / 2, rx1 = along === 'x' ? ex + len / 2 : ex + th / 2;
      const rz0 = along === 'z' ? ez - len / 2 : ez - th / 2, rz1 = along === 'z' ? ez + len / 2 : ez + th / 2;
      if (t.type === 'ramp') {
        const [tdx, tdz] = DIRS[t.d];
        const slope = Math.atan2(RAMP_H, T);
        railP.push(part(rounded(along === 'x' ? len : th, ht, along === 'z' ? len : th, 0.08), TH.rail, { x: ex, y: RAMP_H / 2 + ht / 2, z: ez, rx: tdz ? -tdz * slope : 0, rz: tdx ? slope * tdx : 0 }));
      } else railP.push(part(rounded(along === 'x' ? len : th, ht, along === 'z' ? len : th, 0.08), TH.rail, { x: ex, y: ht / 2, z: ez }));
      railP.push(part(new THREE.BoxGeometry(along === 'x' ? len : th * 0.5, 0.04, along === 'z' ? len : th * 0.5), '#ffffff', { x: ex, y: (t.type === 'ramp' ? RAMP_H / 2 : 0) + ht + 0.01, z: ez, s: t.type === 'ramp' ? 0 : 1 }));
      rails.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1 });
    }
    // decor next to the course
    if (r() < 0.85) for (const s of [-1, 1]) {
      const [dx, dz] = DIRS[t.d], px = cx + (-dz) * s * (T * 0.9 + r() * 2.5), pz = cz + dx * s * (T * 0.9 + r() * 2.5);
      if (tileMap.has(key(Math.round(px / T), Math.round(pz / T)))) continue;
      decor.push([px, pz, 0.7 + r() * 0.6]);
    }
    // obstacles
    if (t.obst === 'bumpers') {
      const [dx, dz] = DIRS[t.d], nb = 1 + Math.floor(r() * 2) + (level > 4 ? 1 : 0);
      for (let k = 0; k < nb; k++) { const off = (k - (nb - 1) / 2) * 1.3 + (r() - 0.5) * 0.4, x = cx + (-dz) * off, z = cz + dx * off; const m = makeBumper(x, z); bumpers.push({ x, z, r: 0.38, m, hit: 0 }); }
    } else if (t.obst === 'slider') {
      const [dx, dz] = DIRS[t.d], w = 1.5, m = new THREE.Mesh(rounded(dx ? 0.8 : w, 0.8, dx ? w : 0.8, 0.12), glossy('#ff6b5b')); m.castShadow = true; world.add(m);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.82 : w + 0.02, 0.18, dx ? w + 0.02 : 0.82), mat('#ffffff')); stripe.position.y = 0.1; m.add(stripe);
      sliders.push({ m, cx, cz, ax: -dz, az: dx, hw: dx ? 0.4 : w / 2, hd: dx ? w / 2 : 0.4, amp: T / 2 - w / 2 - 0.2, sp: (1.2 + level * 0.08 + r() * 0.4) * fk, ph: r() * 6, x: cx, z: cz, vx: 0, vz: 0 });
    } else if (t.obst === 'spinner') {
      const g = new THREE.Group(); g.position.set(cx, 0, cz); world.add(g);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.0, 14), glossy('#ffd23f')); post.position.y = 0.5; post.castShadow = true; g.add(post);
      const bar = new THREE.Mesh(rounded(3.0, 0.32, 0.3, 0.1), glossy('#7b5cff')); bar.position.y = 0.32; bar.castShadow = true; g.add(bar);
      spinners.push({ g, bar, cx, cz, len: 1.5, ang: r() * 6, w: (r() < 0.5 ? -1 : 1) * (1.1 + level * 0.06) * fk });
    }
  }
  const turfM = new THREE.Mesh(merge(turf.map(g => part(g, '#ffffff'))), new THREE.MeshStandardMaterial({ map: checker(TH.g1, TH.g2), vertexColors: true, roughness: 0.85 }));
  turfM.receiveShadow = true; world.add(turfM);
  const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const sideM = new THREE.Mesh(merge(sides), VC); sideM.receiveShadow = true; world.add(sideM);
  const rockM = new THREE.Mesh(merge(rocks), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })); world.add(rockM);
  if (railP.length) { const rm = new THREE.Mesh(merge(railP), VC); rm.castShadow = true; rm.receiveShadow = true; world.add(rm); }
  // decor trees
  const dg = decorGeo(TH.decor);
  if (decor.length) { const im = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), decor.length), o = new THREE.Object3D(); decor.forEach((d, i) => { o.position.set(d[0], -0.3, d[1]); o.scale.setScalar(d[2]); o.rotation.y = i; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.castShadow = true; world.add(im); }
  // decor islands under the trees (so they float too)
  const di = decor.map(d => part(new THREE.CylinderGeometry(1, 0.2, 1.6, 7), TH.rock, { x: d[0], y: -1.1, z: d[1], s: d[2] * 1.3, sy: d[2] * 1.2 }));
  const di2 = decor.map(d => part(new THREE.CylinderGeometry(1, 1, 0.3, 7), TH.g2, { x: d[0], y: -0.32, z: d[1], s: d[2] * 1.3, sy: 1 }));
  if (di.length) { const m = new THREE.Mesh(merge([...di, ...di2]), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true })); m.receiveShadow = true; world.add(m); }
  // clouds and far islands
  const cl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 }), 26), o = new THREE.Object3D();
  const last = tiles[tiles.length - 1];
  for (let i = 0; i < 26; i++) { o.position.set((r() - 0.5) * 90 + last.gx * T * 0.5, -9 - r() * 10, -r() * 90 + 20); o.scale.set(4 + r() * 6, 1.6 + r() * 1.5, 3 + r() * 4); o.updateMatrix(); cl.setMatrixAt(i, o.matrix); }
  world.add(cl);
  // cup + flag
  cup = { x: last.gx * T, z: last.gz * T };
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), new THREE.MeshBasicMaterial({ color: '#15202b' })); hole.rotation.x = -Math.PI / 2; hole.position.set(cup.x, 0.012, cup.z); world.add(hole);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 28), new THREE.MeshBasicMaterial({ color: '#ffffff' })); rim.rotation.x = -Math.PI / 2; rim.position.set(cup.x, 0.011, cup.z); world.add(rim);
  flag = new THREE.Group(); flag.position.set(cup.x, 0, cup.z); world.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 8), mat('#ffffff')); pole.position.y = 1.3; pole.castShadow = true; flag.add(pole);
  for (let k = 0; k < 4; k++) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.18, 8), mat('#ff3b3b')); band.position.y = 0.3 + k * 0.5; flag.add(band); }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.65, 8, 2), new THREE.MeshStandardMaterial({ color: '#ff3b3b', side: THREE.DoubleSide, roughness: 0.6 }));
  cloth.geometry.translate(0.5, 0, 0); cloth.position.y = 2.25; cloth.castShadow = true; flag.add(cloth); flag.cloth = cloth;
  par = 2 + Math.floor(tiles.length / 4) + (tiles.some(t => t.type === 'ramp') ? 0 : 0);
  pathLen = tiles.length;
}
function makeBumper(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.55, 20), glossy('#ff4d6d')); base.position.y = 0.28; base.castShadow = true; g.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.06, 8, 24), glossy('#ffffff')); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#ffd23f')); cap.position.y = 0.55; g.add(cap);
  return g;
}
function decorGeo(kind) {
  const cone = new THREE.ConeGeometry(1, 1, 7), cyl = new THREE.CylinderGeometry(1, 1, 1, 7), sph = new THREE.IcosahedronGeometry(1, 1);
  if (kind === 'cactus') return merge([part(new THREE.CapsuleGeometry(0.3, 1.8, 3, 7), '#3fa34d', { y: 1.2 }), part(new THREE.CapsuleGeometry(0.18, 0.6, 3, 7), '#3fa34d', { x: 0.42, y: 1.5, rz: 0.2 }), part(new THREE.CapsuleGeometry(0.16, 0.5, 3, 7), '#3fa34d', { x: -0.4, y: 1.8, rz: -0.2 }), part(sph, '#ffd1dc', { y: 2.3, s: 0.14 })]);
  if (kind === 'mushroom') return merge([part(cyl, '#fff4e6', { y: 0.8, sx: 0.28, sz: 0.28, sy: 1.6 }), part(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ff5d8f', { y: 1.5, sx: 1.1, sy: 0.8, sz: 1.1 }), part(sph, '#ffffff', { x: 0.5, y: 2.0, z: 0.3, s: 0.16 }), part(sph, '#ffffff', { x: -0.4, y: 1.95, z: -0.3, s: 0.14 })]);
  const leaf = kind === 'snowpine' ? '#2f8f6a' : '#3c9a4a', tip = kind === 'snowpine' ? '#ffffff' : '#4fb35c';
  return merge([part(cyl, '#7a5230', { y: 0.4, sx: 0.16, sz: 0.16, sy: 0.8 }), part(cone, leaf, { y: 1.3, sx: 0.95, sz: 0.95, sy: 1.3 }), part(cone, leaf, { y: 2.0, sx: 0.75, sz: 0.75, sy: 1.1 }), part(cone, tip, { y: 2.6, sx: 0.5, sz: 0.5, sy: 0.8 })]);
}

// ---------------------------------------------------------------- balls (player + rivals)
const ballGeo = new THREE.SphereGeometry(BR, 24, 16);
const dimpleTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 4; y < h; y += 8) for (let x = (y / 8 % 2) * 4; x < w; x += 8) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } });
const RIVALS = [{ name: 'KAI', col: '#ff5d8f', trail: '#ff8fb1' }, { name: 'NORA', col: '#3a86ff', trail: '#7fb2ff' }, { name: 'BO', col: '#ffb627', trail: '#ffd166' }];
const balls = [];
function makeBall(name, col, trailCol, isPlayer) {
  const m = new THREE.Mesh(ballGeo, glossy(col, { map: dimpleTex, roughness: 0.25 })); m.castShadow = true; scene.add(m);
  const lbl = H(`<div class="pi-lbl" style="color:${isPlayer ? '#fff' : '#fff'}">${name}</div>`);
  const tr = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: trailCol, transparent: true, opacity: 0.7, depthWrite: false }), 26); tr.frustumCulled = false; scene.add(tr);
  const b = { name, m, lbl, tr, trail: [], isPlayer, x: 0, y: BR, z: 0, vx: 0, vy: 0, vz: 0, air: false, strokes: 0, done: false, sinkT: 0, lastSafe: { x: 0, z: 0 }, nextShot: 0, place: 0, aimErr: 0.08 };
  balls.push(b); return b;
}
const player = makeBall('YOU', '#ffffff', '#7fe3ff', true);
RIVALS.forEach(r => makeBall(r.name, r.col, r.trail, false));

// ---------------------------------------------------------------- physics
const G = 16;
function decel(v) { return 3.0 + 0.45 * v; }
function rollDist(v0) { let v = v0, d = 0; const h = 1 / 120; while (v > 0.05) { d += v * h; v -= decel(v) * h; } return d; }
function speedFor(d) { let lo = 0, hi = 20; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (rollDist(m) < d) lo = m; else hi = m; } return (lo + hi) / 2; }
function collideAABB(b, x0, x1, z0, z1, vx = 0, vz = 0, rest = 0.72) {
  const px = clamp(b.x, x0, x1), pz = clamp(b.z, z0, z1), dx = b.x - px, dz = b.z - pz, d2 = dx * dx + dz * dz;
  if (d2 >= BR * BR) return false;
  let nx, nz, d = Math.sqrt(d2);
  if (d < 1e-6) { // centre inside: push out along the smallest axis
    const l = b.x - x0, r = x1 - b.x, f = b.z - z0, k = z1 - b.z, m = Math.min(l, r, f, k);
    nx = m === l ? -1 : m === r ? 1 : 0; nz = m === f ? -1 : m === k ? 1 : 0; d = 0;
  } else { nx = dx / d; nz = dz / d; }
  b.x += nx * (BR - d); b.z += nz * (BR - d);
  const rv = (b.vx - vx) * nx + (b.vz - vz) * nz;
  if (rv < 0) { b.vx -= (1 + rest) * rv * nx; b.vz -= (1 + rest) * rv * nz; return Math.abs(rv); }
  return 0.01;
}
function stepBall(b, dt, fx) {
  if (b.done) return;
  let h = heightAt(b.x, b.z);
  if (!b.air) {
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0) { const ns = Math.max(0, sp - decel(sp) * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
    // ramp slope pulls the ball back down
    const t = tileMap.get(key(Math.round(b.x / T), Math.round(b.z / T)));
    let slopeV = 0;
    if (t && t.type === 'ramp' && h !== null) { const [dx, dz] = DIRS[t.d], gs = RAMP_H / T; b.vx -= dx * G * gs * dt * 0.9; b.vz -= dz * G * gs * dt * 0.9; slopeV = (b.vx * dx + b.vz * dz) * gs; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    const nh = heightAt(b.x, b.z);
    if (nh === null || (h !== null && nh < h - 0.15)) { b.air = true; b.vy = Math.max(0, slopeV); }
    else { b.y = nh + BR; if (nh <= 0.001 && Math.hypot(b.vx, b.vz) < 0.05) { b.vx = b.vz = 0; } if (nh <= 0.001) { b.lastSafe.x = b.x; b.lastSafe.z = b.z; } }
  } else {
    b.vy -= G * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    const nh = heightAt(b.x, b.z);
    if (nh !== null && b.y - BR <= nh && b.y - BR > nh - 0.6) {
      b.y = nh + BR;
      if (b.vy < -4) { b.vy = -b.vy * 0.28; if (fx) { tone(220, 0.06, 'sine', 0.1, 0.7); burst(scene, new THREE.Vector3(b.x, 0.1, b.z), [TH.g1, '#ffffff'], 6, { speed: 0.04, up: 0.04, size: 0.3 }); } }
      else { b.air = false; b.vy = 0; }
    }
    if (b.y < -7) return 'out';
  }
  // walls & obstacles (only near ground level)
  const ground = heightAt(b.x, b.z) ?? 0;
  if (b.y - BR < ground + 0.5) {
    for (const r of rails) { const v = collideAABB(b, r.x0, r.x1, r.z0, r.z1); if (v > 0.6 && fx) tone(300, 0.04, 'triangle', Math.min(0.12, v * 0.02), 0.8); }
    for (const s of sliders) { const v = collideAABB(b, s.x - s.hw, s.x + s.hw, s.z - s.hd, s.z + s.hd, s.vx, s.vz, 0.8); if (v > 0.6 && fx) tone(180, 0.06, 'square', 0.06, 0.6); }
    for (const p of bumpers) {
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
      if (d < p.r + BR && d > 1e-5) {
        const nx = dx / d, nz = dz / d; b.x = p.x + nx * (p.r + BR); b.z = p.z + nz * (p.r + BR);
        const rv = b.vx * nx + b.vz * nz;
        if (rv < 0) { b.vx -= 2 * rv * nx; b.vz -= 2 * rv * nz; b.vx += nx * 2.5; b.vz += nz * 2.5; if (fx) { p.hit = 1; tone(660, 0.08, 'square', 0.08, 1.4); burst(scene, new THREE.Vector3(p.x, 0.6, p.z), ['#ffd23f', '#ff4d6d', '#ffffff'], 8, { speed: 0.06, up: 0.05, size: 0.3 }); if (b.isPlayer) { ui.pop('BOING!', '#ffd23f', 26, 46); buzz(8); } } }
      }
    }
    for (const s of spinners) {
      const ex = Math.cos(s.ang) * s.len, ez = -Math.sin(s.ang) * s.len;
      const ax = s.cx - ex, az = s.cz - ez, bx = s.cx + ex, bz = s.cz + ez;
      const abx = bx - ax, abz = bz - az, t = clamp(((b.x - ax) * abx + (b.z - az) * abz) / (abx * abx + abz * abz), 0, 1);
      const px = ax + abx * t, pz = az + abz * t, dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz), rr = BR + 0.16;
      if (d < rr && d > 1e-5) {
        const nx = dx / d, nz = dz / d; b.x = px + nx * rr; b.z = pz + nz * rr;
        const rx = px - s.cx, rz = pz - s.cz, svx = s.w * rz * -1, svz = s.w * rx;   // tangential velocity of the bar at the contact
        const rv = (b.vx - svx) * nx + (b.vz - svz) * nz;
        if (rv < 0) { b.vx -= 1.7 * rv * nx; b.vz -= 1.7 * rv * nz; if (fx) { tone(240, 0.06, 'square', 0.07, 0.6); if (b.isPlayer) buzz(10); } }
      }
    }
  }
  return null;
}
const atRest = b => !b.air && Math.hypot(b.vx, b.vz) < 0.06;

// ---------------------------------------------------------------- aiming helpers (bot + rivals)
function onPathFloor(x, z) { const t = tileMap.get(key(Math.round(x / T), Math.round(z / T))); return t && Math.abs(x - t.gx * T) <= T / 2 && Math.abs(z - t.gz * T) <= T / 2 ? t : null; }
function nearestIdx(b) { let bi = 0, bd = 1e9; tiles.forEach((t, i) => { const d = Math.hypot(b.x - t.cx, b.z - t.cz); if (d < bd) { bd = d; bi = i; } }); return bi; }
function blockedByRail(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25);
  for (let i = 1; i <= n; i++) { const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n); for (const r of rails) if (x > r.x0 - BR && x < r.x1 + BR && z > r.z0 - BR && z < r.z1 + BR) return true; }
  return false;
}
function planShot(b) {
  const k = nearestIdx(b);
  let target = null, jump = false;
  for (let m = tiles.length - 1; m > k; m--) {
    const t = tiles[m];
    if (t.type === 'gap' || t.type === 'ramp') continue;
    const tx = m === tiles.length - 1 ? cup.x : t.cx, tz = m === tiles.length - 1 ? cup.z : t.cz;
    const n = Math.ceil(Math.hypot(tx - b.x, tz - b.z) / 0.3); let ok = true, sawGap = false;
    for (let i = 1; i <= n; i++) { const x = lerp(b.x, tx, i / n), z = lerp(b.z, tz, i / n), f = onPathFloor(x, z); if (!f) { ok = false; break; } if (f.type === 'gap') sawGap = true; }
    if (!ok || blockedByRail(b.x, b.z, tx, tz)) continue;
    // never try to skip over moving obstacles' centre line if far: fine, they bounce
    target = { x: tx, z: tz, cup: m === tiles.length - 1 }; jump = sawGap; break;
  }
  if (!target) { const t = tiles[Math.min(tiles.length - 1, k + 1)]; target = { x: t.cx, z: t.cz, cup: k + 1 >= tiles.length - 1 }; }
  const d = Math.hypot(target.x - b.x, target.z - b.z);
  let v = target.cup ? speedFor(d + 0.35) : speedFor(Math.max(0.5, d));
  if (jump) v = 17.5;
  return { ang: Math.atan2(target.z - b.z, target.x - b.x), v: Math.min(17.5, v), target };
}
function shootBall(b, ang, v) {
  b.vx = Math.cos(ang) * v; b.vz = Math.sin(ang) * v; b.strokes++;
  if (b.isPlayer) { hud.querySelector('[data-s]').textContent = b.strokes; tone(520, 0.06, 'triangle', 0.14, 1.3); tone(160, 0.08, 'sine', 0.12, 0.6); buzz(15); squash = 1; }
}

// ---------------------------------------------------------------- state
let state = 'ready', aimDir = new THREE.Vector3(0, 0, -1), drag = null, timeLeft = 40, finished = 0, squash = 0, shotLock = 0, endT = 0;
const camPos = new THREE.Vector3(0, 4, 6), camLook = new THREE.Vector3(0, 0, -3);
const MAXV = 17.5;
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 22); dots.frustumCulled = false; scene.add(dots);
const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 3), new THREE.MeshBasicMaterial({ color: '#ffffff' })); scene.add(arrow);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
function startLevel() {
  fk = F.k(); buildCourse();
  const tee = tiles[0];
  balls.forEach((b, i) => {
    const off = [0, -1.1, 1.1, 0][i], back = i === 3 ? 1.1 : 0.2;
    Object.assign(b, { x: tee.cx + off, y: BR, z: tee.cz + back + (i ? 0.5 : 0), vx: 0, vy: 0, vz: 0, air: false, strokes: 0, done: false, sinkT: 0, place: 0, trail: [] });
    b.lastSafe = { x: b.x, z: b.z }; b.m.visible = true; b.m.scale.setScalar(1); b.lbl.style.display = '';
    if (!b.isPlayer) { b.nextShot = 0.9 + i * 0.5 + Math.random() * 0.6; b.aimErr = Math.max(0.025, (0.16 - level * 0.012) / fk) + i * 0.02; b.powErr = Math.max(0.08, (0.22 - Math.min(0.12, level * 0.012)) / fk); }
  });
  finished = 0; timeLeft = (28 + tiles.length * 2.5) / fk; drag = null; endT = 0;
  hud.querySelector('[data-s]').textContent = 0; hud.querySelector('[data-p]').textContent = par;
  ui.levels(level); ui.progress(0);
  const p = planShot(player); aimDir.set(Math.cos(p.ang), 0, Math.sin(p.ang));
  camPos.set(player.x - aimDir.x * 5, 3.4, player.z - aimDir.z * 5); camLook.set(player.x + aimDir.x * 4, 0, player.z + aimDir.z * 4);
  updatePlace();
}
const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
function updatePlace() {
  // rank: finished first (by finish order), then by progress along the path
  const prog = b => b.done ? 1000 - b.place : nearestIdx(b) - b.strokes * 0.01;
  const sorted = [...balls].sort((a, c) => prog(c) - prog(a));
  const pl = sorted.indexOf(player) + 1;
  hud.querySelector('[data-pl]').innerHTML = `${pl}<sup>${ord(pl).slice(-2)}</sup>`;
  return pl;
}
function sink(b) {
  b.done = true; b.sinkT = 0.001; finished++; b.place = finished; b.vx = b.vz = 0;
  burst(scene, new THREE.Vector3(cup.x, 0.3, cup.z), ['#ffffff', '#ffd23f', b.isPlayer ? '#7fe3ff' : '#ff8fb1'], 16, { speed: 0.06, up: 0.1, size: 0.4, shape: 'sphere' });
  if (b.isPlayer) {
    const diff = b.strokes - par, word = b.strokes === 1 ? 'HOLE IN ONE!' : diff <= -2 ? 'EAGLE!' : diff === -1 ? 'BIRDIE!' : diff === 0 ? 'PAR!' : diff === 1 ? 'BOGEY' : 'IN THE HOLE!';
    ui.pop(word, '#ffd23f', 48, 30); sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(cup.x, 1.5, cup.z), 80); ui.flash(0.3);
    if (state === 'play') F.level(true); state = 'won'; save.set('level', level + 1);
    ui.win(level, `${ord(b.place)} place · ${b.strokes} stroke${b.strokes > 1 ? 's' : ''} (par ${par})`);
  } else tone(880, 0.1, 'triangle', 0.06, 1);
}
input({
  onDown: (e) => { if (state !== 'play' || !atRest(player) || player.done) return; drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; },
  onMove: (dx, dy, e) => { if (!drag) return; drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; },
  onUp: () => {
    if (!drag) return; const d = drag; drag = null;
    const len = Math.hypot(d.dx, d.dy); if (len < 18 || state !== 'play') return;
    const s = shotFromDrag(d); shootBall(player, s.ang, s.v);
  },
});
function shotFromDrag(d) {
  const fwd = new THREE.Vector3(camLook.x - camPos.x, 0, camLook.z - camPos.z).normalize(), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const len = Math.hypot(d.dx, d.dy), pw = clamp(len / (innerHeight * 0.32), 0, 1);
  const dir = fwd.clone().multiplyScalar(d.dy).addScaledVector(right, -d.dx).normalize();
  return { ang: Math.atan2(dir.z, dir.x), v: 1.2 + pw * (MAXV - 1.2), pw };
}
ui.onTap(w => { if (w === 'win') level++; startLevel(); state = 'play'; });

// ---------------------------------------------------------------- loop
const o3 = new THREE.Object3D(), tmp = new THREE.Vector3();
loop((dtRaw, t) => {
  const real = Math.min(dtRaw / 60, 1 / 30);
  // obstacles move
  for (const s of sliders) { const ph = Math.sin(t * s.sp + s.ph) * s.amp, px = s.x, pz = s.z; s.x = s.cx + s.ax * ph; s.z = s.cz + s.az * ph; s.vx = (s.x - px) / Math.max(real, 1e-3); s.vz = (s.z - pz) / Math.max(real, 1e-3); s.m.position.set(s.x, 0.4, s.z); }
  for (const s of spinners) { s.ang += s.w * real; s.bar.rotation.y = s.ang; }
  for (const p of bumpers) { p.hit = Math.max(0, p.hit - real * 5); p.m.scale.set(1 + p.hit * 0.25, 1 - p.hit * 0.15, 1 + p.hit * 0.25); }
  if (flag) { const pa = flag.cloth.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(x * 4 - t * 6) * 0.08 * x); } pa.needsUpdate = true; }
  // timer
  if (state === 'play') {
    timeLeft -= real; const tl = Math.max(0, Math.ceil(timeLeft)); timerEl.textContent = tl; timerEl.classList.toggle('warn', tl <= 5);
    if (timeLeft <= 0) { state = 'lost'; F.level(false, nearestIdx(player) / Math.max(1, tiles.length - 1)); sfx.fail(); ui.lose("TIME'S UP", `${ord(updatePlace())} place · ${player.strokes} strokes`); }
    else if (player.strokes >= par + 4 && atRest(player) && !player.done) { state = 'lost'; F.level(false, nearestIdx(player) / Math.max(1, tiles.length - 1)); sfx.fail(); ui.lose('OUT OF STROKES', `Par ${par} · max ${par + 4} strokes`); }
  }
  // physics
  const sub = 6, h = real / sub;
  for (const b of balls) {
    if (b.done) { if (b.sinkT > 0 && b.sinkT < 1) { b.sinkT += real * 3; b.x = lerp(b.x, cup.x, 0.3); b.z = lerp(b.z, cup.z, 0.3); b.y = BR - b.sinkT * 0.5; if (b.sinkT >= 1) { b.m.visible = false; b.lbl.style.display = 'none'; } } }
    else if (state === 'play' || state === 'ready') {
      for (let i = 0; i < sub; i++) {
        const r = stepBall(b, h, b.isPlayer || Math.hypot(b.x - player.x, b.z - player.z) < 8);
        if (r === 'out') {
          b.strokes++; b.x = b.lastSafe.x; b.z = b.lastSafe.z; b.y = BR + 1.2; b.vx = b.vz = 0; b.vy = 0; b.air = true;
          if (b.isPlayer) { ui.pop('SPLASH! +1', '#ff4d6d', 34, 40); sfx.fail(); hud.querySelector('[data-s]').textContent = b.strokes; }
          break;
        }
        // cup capture
        if (!b.air && Math.hypot(b.x - cup.x, b.z - cup.z) < 0.34) { const sp = Math.hypot(b.vx, b.vz); if (sp < 8.5) { sink(b); break; } else { b.vx *= 0.8; b.vz *= 0.8; } }
      }
    }
    // rivals: shoot when at rest
    if (!b.isPlayer && !b.done && state === 'play' && atRest(b)) {
      b.nextShot -= real;
      if (b.nextShot <= 0) { const p = planShot(b); shootBall(b, p.ang + (Math.random() - 0.5) * 2 * b.aimErr, p.v * (1 + (Math.random() - 0.5) * 2 * b.powErr)); b.nextShot = 1.8 + Math.random() * 1.6; }
    }
    // visuals
    b.m.position.set(b.x, b.y, b.z);
    const sp = Math.hypot(b.vx, b.vz); if (sp > 0.01) { b.m.rotation.x -= b.vz * real / BR; b.m.rotation.z += b.vx * real / BR; }
    if (sp > 1.2 || b.air) b.trail.unshift([b.x, b.y, b.z]); else if (b.trail.length) b.trail.pop();
    if (b.trail.length > 26) b.trail.length = 26;
    for (let i = 0; i < 26; i++) { const p = b.trail[i]; if (p) { o3.position.set(p[0], p[1], p[2]); o3.scale.setScalar(BR * 0.75 * (1 - i / 26)); } else o3.scale.setScalar(0); o3.updateMatrix(); b.tr.setMatrixAt(i, o3.matrix); }
    b.tr.instanceMatrix.needsUpdate = true;
  }
  squash = Math.max(0, squash - real * 4); player.m.scale.set(1 + squash * 0.25, 1 - squash * 0.25, 1 + squash * 0.25);
  if (state === 'play') { const k = nearestIdx(player); ui.progress(player.done ? 1 : k / (tiles.length - 1)); if (Math.floor(t * 4) !== Math.floor((t - real) * 4)) updatePlace(); }
  // camera: behind the ball, looking down the fairway
  const moving = !atRest(player);
  if (moving && !player.done) { const sp = Math.hypot(player.vx, player.vz); if (sp > 1) tmp.set(player.vx / sp, 0, player.vz / sp), aimDir.lerp(tmp, 0.03).normalize(); }
  else if (!drag && state === 'play' && !player.done) { const p = planShot(player); tmp.set(Math.cos(p.ang), 0, Math.sin(p.ang)); aimDir.lerp(tmp, 0.06).normalize(); }
  const cdist = 6.0, cy = 6.6 + (player.air ? 0.6 : 0);
  camPos.lerp(tmp.set(player.x - aimDir.x * cdist, Math.max(player.y, 0) + cy, player.z - aimDir.z * cdist), 1 - Math.pow(0.02, real));
  camLook.lerp(tmp.set(player.x + aimDir.x * 5.2, 0, player.z + aimDir.z * 5.2), 1 - Math.pow(0.01, real));
  camera.position.copy(camPos); camera.lookAt(camLook);
  // aim visuals
  const aiming = !!drag && state === 'play' && Math.hypot(drag.dx, drag.dy) > 10;
  dots.visible = arrow.visible = aiming; ring.visible = state === 'play' && atRest(player) && !player.done;
  ring.position.set(player.x, 0.02 + (heightAt(player.x, player.z) ?? 0), player.z); ring.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
  if (aiming) {
    const s = shotFromDrag(drag), dx = Math.cos(s.ang), dz = Math.sin(s.ang), dist = Math.min(13, rollDist(s.v));
    const col = new THREE.Color().setHSL(0.33 - s.pw * 0.33, 0.95, 0.55);
    dots.material.color.copy(col); arrow.material.color.copy(col);
    for (let i = 0; i < 22; i++) { const f = (i + 1) / 22 * dist; o3.position.set(player.x + dx * f, BR * 0.6 + (heightAt(player.x + dx * f, player.z + dz * f) ?? 0), player.z + dz * f); o3.scale.setScalar(i % 2 ? 0.0 : 1 - i / 30); o3.updateMatrix(); dots.setMatrixAt(i, o3.matrix); }
    dots.instanceMatrix.needsUpdate = true;
    arrow.position.set(player.x + dx * 0.65, 0.08, player.z + dz * 0.65); arrow.rotation.set(-Math.PI / 2, 0, 0); arrow.rotateZ(Math.atan2(dx, -dz) * -1); arrow.rotation.set(-Math.PI / 2, 0, -Math.atan2(dx, -dz));
    tmp.set(player.x, 0.8, player.z).project(camera); powEl.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; powEl.style.top = ((1 - tmp.y) / 2 * innerHeight + 64) + 'px';
    powEl.textContent = Math.round(s.pw * 100) + '%'; powEl.style.color = col.getStyle(); powEl.style.display = '';
  } else powEl.style.display = 'none';
  // name labels
  for (const b of balls) { if (b.done && b.sinkT >= 1) continue; tmp.set(b.x, b.y + 0.45, b.z).project(camera); const vis = tmp.z < 1 && Math.hypot(b.x - camPos.x, b.z - camPos.z) < 40; b.lbl.style.display = vis && state !== 'ready' ? '' : 'none'; b.lbl.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; b.lbl.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px'; b.lbl.style.fontSize = b.isPlayer ? '16px' : '13px'; }
  S.followLight(new THREE.Vector3(player.x, 0, player.z - 4));
});

startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
let botWait = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return player.strokes; },
  bot() {
    if (state !== 'play' || player.done || !atRest(player)) { botWait = 0; return; }
    if (++botWait < 3) return; botWait = 0;
    const p = planShot(player); shootBall(player, p.ang, p.v);
  },
};

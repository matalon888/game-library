// Mergie Dorm world: the dorm room shell (walls, floor, window), the board tray, moving-box clutter and every restore
// task of the three rooms (kawaii 3D furniture + code-built paint, curtains, fairy lights, polaroids, neon, bunting,
// star lights, disco ball). The game calls setRoom() / restore() / update().
import * as THREE from './kit/three.module.min.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { ROOMS } from './story.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(4242);
export const WALL_Z = -10, WALL_H = 8, SIDE_X = 9.6, WIN_X = 0, WIN_Y = 4.1, WIN_W = 3.2, WIN_H = 2.8;

export function canvasTex(w, h, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(rep, rep); return t;
}
export const radialTex = (inner = 'rgba(0,0,0,.55)') => canvasTex(128, 128, (x, w) => {
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.55, inner.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.55) + ')')); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
});
function heartPath(x, cx, cy, s) {
  x.beginPath(); x.moveTo(cx, cy + s * 0.35);
  x.bezierCurveTo(cx - s * 1.1, cy - s * 0.35, cx - s * 0.45, cy - s * 1.05, cx, cy - s * 0.45);
  x.bezierCurveTo(cx + s * 0.45, cy - s * 1.05, cx + s * 1.1, cy - s * 0.35, cx, cy + s * 0.35); x.closePath();
}
function starPath(x, cx, cy, r, k = 0.45) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * k : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); }
export function heartShape(s = 1) {
  const p = new THREE.Shape(); p.moveTo(0, -0.35 * s);
  p.bezierCurveTo(-1.1 * s, 0.35 * s, -0.45 * s, 1.05 * s, 0, 0.45 * s); p.bezierCurveTo(0.45 * s, 1.05 * s, 1.1 * s, 0.35 * s, 0, -0.35 * s); return p;
}

// wallpaper: pastel base, soft vertical stripes + a tiny repeating motif; old = dingy beige with scuffs
function wallTex(room, old) {
  return canvasTex(512, 512, (x, w, h) => {
    if (old) {
      x.fillStyle = room.old; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${R() < .5 ? '90,70,40' : '255,250,235'},${R() * 0.06})`; const s = R() * 6 + 1; x.fillRect(R() * w, R() * h, s, s); }
      for (let i = 0; i < 5; i++) { const g = x.createRadialGradient(R() * w, R() * h, 0, R() * w, R() * h, 60 + R() * 60); g.addColorStop(0, 'rgba(120,95,60,.12)'); g.addColorStop(1, 'rgba(120,95,60,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
      return;
    }
    const [base, stripe, accent] = room.wall;
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { x.fillStyle = stripe; x.globalAlpha = 0.35; x.fillRect(i * 64 + 22, 0, 20, h); }
    x.globalAlpha = 1;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cx = c * 128 + (r % 2 ? 96 : 32), cy = r * 128 + 64;
      x.globalAlpha = 0.55;
      if (room.pattern === 'hearts') { x.fillStyle = accent; heartPath(x, cx, cy, 14); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 64, cy + 30, 4, 0, 7); x.fill(); }
      else if (room.pattern === 'berries') { x.fillStyle = accent; x.beginPath(); x.ellipse(cx, cy + 4, 11, 13, 0, 0, 7); x.fill(); x.fillStyle = '#5fcf8f'; x.beginPath(); x.ellipse(cx, cy - 9, 9, 4, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 64, cy + 30, 4, 0, 7); x.fill(); }
      else { x.fillStyle = accent; starPath(x, cx, cy, 15); x.fill(); x.fillStyle = '#fff'; starPath(x, cx + 64, cy + 34, 6); x.fill(); }
    }
    x.globalAlpha = 1;
  });
}
function floorTex(color) {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    const ph = 64;
    for (let r = 0; r < h / ph; r++) {
      const off = (r % 2) * 170;
      for (let k = -1; k < 4; k++) { const L = 256 + (R() * 80 | 0); x.fillStyle = `rgba(255,255,255,${0.06 + R() * 0.08})`; x.fillRect(k * 256 + off, r * ph + 2, L - 4, ph - 4); }
      x.fillStyle = 'rgba(150,90,80,.22)'; x.fillRect(0, r * ph, w, 2);
      for (let k = 0; k < 3; k++) { x.fillRect(((k * 256 + off) % w), r * ph, 2, ph); }
    }
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(160,100,80,${R() * 0.035})`; x.fillRect(R() * w, R() * h, 18 + R() * 30, 1); }
  }, 1);
}
// little moving box with a tiny face (the "before" clutter)
function faceTex() {
  return canvasTex(128, 128, (x) => {
    x.fillStyle = '#c69567'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 0, 128, 8);
    x.fillStyle = '#3c2430'; x.beginPath(); x.arc(46, 70, 7, 0, 7); x.arc(82, 70, 7, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(48, 67, 2.5, 0, 7); x.arc(84, 67, 2.5, 0, 7); x.fill();
    x.strokeStyle = '#3c2430'; x.lineWidth = 3.5; x.lineCap = 'round'; x.beginPath(); x.arc(64, 78, 7, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke();
    x.fillStyle = 'rgba(255,120,150,.55)'; x.beginPath(); x.ellipse(34, 84, 8, 5, 0, 0, 7); x.ellipse(94, 84, 8, 5, 0, 0, 7); x.fill();
    x.fillStyle = '#e8cfa6'; x.fillRect(56, 0, 16, 34);
  });
}

export function buildDorm(scene, M, thumbs) {
  const W = { tweens: [], anim: [], room: -1, done: 0, objs: [], boxes: [] };
  scene.background = new THREE.Color('#f3e6ff');
  const hemi = new THREE.HemisphereLight('#fff4fb', '#b993e0', 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff6f0', 2.0); sun.position.set(6, 15, 9); sun.target.position.set(0, 0, -3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -12, near: 1, far: 50 });
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ffd6ec', 0.6); fill.position.set(-8, 6, 4); scene.add(fill);

  // ---------------------------------------------------------------- shell
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
  const floorMat = std('#ffffff', { roughness: 0.55 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_X * 2, 26), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, WALL_Z + 13); floor.receiveShadow = true; scene.add(floor);
  const wallGeo = new THREE.PlaneGeometry(SIDE_X * 2, WALL_H);
  const wallMat = std('#ffffff', { roughness: 0.9 }), oldMat = std('#ffffff', { roughness: 0.95, transparent: true });
  const wall = new THREE.Mesh(wallGeo, wallMat); wall.position.set(0, WALL_H / 2, WALL_Z); wall.receiveShadow = true; scene.add(wall);
  const oldWall = new THREE.Mesh(wallGeo, oldMat); oldWall.position.set(0, WALL_H / 2, WALL_Z + 0.01); oldWall.receiveShadow = true; scene.add(oldWall);
  const sideGeo = new THREE.PlaneGeometry(16, WALL_H);
  const sides = [-1, 1].map(s => { const m = new THREE.Mesh(sideGeo, wallMat); m.rotation.y = -s * Math.PI / 2; m.position.set(s * SIDE_X, WALL_H / 2, WALL_Z + 8); m.receiveShadow = true; scene.add(m);
    const o = new THREE.Mesh(sideGeo, oldMat); o.rotation.y = -s * Math.PI / 2; o.position.set(s * (SIDE_X - 0.01), WALL_H / 2, WALL_Z + 8); scene.add(o); return m; });
  // wainscot + baseboard + chair rail (white, glossy)
  const trimMat = new THREE.MeshPhysicalMaterial({ color: '#fffafd', roughness: 0.35, clearcoat: 0.6 });
  const wains = new THREE.Mesh(new THREE.BoxGeometry(SIDE_X * 2, 1.5, 0.08), std('#ffffff', { roughness: 0.6 })); wains.position.set(0, 0.75, WALL_Z + 0.06); wains.receiveShadow = true; scene.add(wains);
  const rail = new THREE.Mesh(new RoundedBoxGeometry(SIDE_X * 2, 0.16, 0.2, 2, 0.06), trimMat); rail.position.set(0, 1.55, WALL_Z + 0.1); scene.add(rail);
  const base = new THREE.Mesh(new RoundedBoxGeometry(SIDE_X * 2, 0.3, 0.16, 2, 0.05), trimMat); base.position.set(0, 0.15, WALL_Z + 0.1); scene.add(base);
  for (const s of [-1, 1]) {
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 16), wains.material); w2.position.set(s * (SIDE_X - 0.06), 0.75, WALL_Z + 8); scene.add(w2);
    const r2 = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.16, 16, 2, 0.06), trimMat); r2.position.set(s * (SIDE_X - 0.1), 1.55, WALL_Z + 8); scene.add(r2);
  }
  // wainscot panel tint follows the room accent
  W.wainsMat = wains.material;

  // window: rounded frame, sky with clouds, sill
  const skyTex = canvasTex(256, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd3ff'); g.addColorStop(0.6, '#cfe8ff'); g.addColorStop(1, '#ffd9ec'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.95)'; for (const [cx, cy, s] of [[60, 150, 26], [180, 90, 20], [120, 200, 18]]) { x.beginPath(); x.arc(cx, cy, s, 0, 7); x.arc(cx + s, cy + 4, s * 0.8, 0, 7); x.arc(cx - s, cy + 6, s * 0.7, 0, 7); x.arc(cx + s * 0.3, cy - s * 0.5, s * 0.8, 0, 7); x.fill(); }
    x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(205, 45, 16, 0, 7); x.fill();
  });
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false, color: '#f4f0ff' }));
  sky.position.set(WIN_X, WIN_Y, WALL_Z + 0.03); scene.add(sky);
  const frameMat = trimMat;
  const fr = new THREE.Group(); fr.position.set(WIN_X, WIN_Y, WALL_Z + 0.1); scene.add(fr);
  for (const [w, h, x, y] of [[WIN_W + 0.36, 0.2, 0, WIN_H / 2 + 0.1], [WIN_W + 0.36, 0.2, 0, -WIN_H / 2 - 0.1], [0.2, WIN_H, -WIN_W / 2 - 0.08, 0], [0.2, WIN_H, WIN_W / 2 + 0.08, 0], [0.1, WIN_H, 0, 0], [WIN_W, 0.1, 0, 0.25]]) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.18, 2, 0.05), frameMat); m.position.set(x, y, 0); m.castShadow = true; fr.add(m);
  }
  const sill = new THREE.Mesh(new RoundedBoxGeometry(WIN_W + 0.9, 0.16, 0.6, 2, 0.06), frameMat); sill.position.set(WIN_X, WIN_Y - WIN_H / 2 - 0.22, WALL_Z + 0.3); sill.castShadow = sill.receiveShadow = true; scene.add(sill);
  W.sillY = WIN_Y - WIN_H / 2 - 0.14;

  // ---------------------------------------------------------------- board tray (a jelly cushion) — the game shows/hides it
  const tray = new THREE.Group(); scene.add(tray); W.tray = tray;
  const trayMat = new THREE.MeshPhysicalMaterial({ color: '#8a5fd8', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: new THREE.Color('#ffd2f0') });
  const slab = new THREE.Mesh(new RoundedBoxGeometry(7.75, 0.5, 7.75, 4, 0.24), trayMat); slab.position.y = 0.12; slab.receiveShadow = slab.castShadow = true; tray.add(slab);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: '#ff9ccd', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 });
  // scalloped rim: a ring of glossy pink pearls
  const pearl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 16, 10), rimMat, 64); let pi = 0;
  { const m = new THREE.Matrix4(); for (let s = 0; s < 4; s++) for (let k = 0; k < 16; k++) { const t = -3.8 + k * (7.6 / 16); const [x, z] = [[t, -3.86], [3.86, t], [-t, 3.86], [-3.86, -t]][s]; m.makeTranslation(x, 0.4, z); pearl.setMatrixAt(pi++, m); } }
  pearl.castShadow = true; tray.add(pearl);
  const trayShadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex('rgba(80,30,90,.35)'), transparent: true, depthWrite: false }));
  trayShadow.position.y = 0.01; tray.add(trayShadow);

  // ---------------------------------------------------------------- props (GLB) helper
  function prop(id, t) {
    const m = M[id], g = new THREE.Group(), mesh = new THREE.Mesh(m.geo, m.mat);
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(m.mm); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    const s = t.w ? t.w / m.size.x : t.h; g.scale.setScalar(s); g.userData.s = s;
    g.position.set(...t.pos); if (t.wall) g.position.z = WALL_Z + 0.05 + m.size.z * s / 2;
    g.rotation.y = t.ry || 0; return g;
  }
  const boxTexF = faceTex(), boxMat = std('#c99a6c', { roughness: 0.85 }), boxFace = new THREE.MeshStandardMaterial({ map: boxTexF, roughness: 0.85 }), tapeMat = std('#ead2a8', { roughness: 0.6 });
  function boxes(t) {
    const g = new THREE.Group(), n = t.h > 2.5 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const s = 0.9 + R() * 0.45, b = new THREE.Mesh(new RoundedBoxGeometry(s * 1.15, s * 0.85, s, 2, 0.06), [boxMat, boxMat, boxMat, boxMat, boxFace, boxMat]);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22, 0.02, s * 1.01), tapeMat); tape.position.y = s * 0.43; b.add(tape);
      b.position.set((i - (n - 1) / 2) * 1.05 + (R() - 0.5) * 0.2, s * 0.425, (R() - 0.5) * 0.4); if (i === 2) { b.position.set(0, s * 0.425 + 0.85, 0.1); }
      b.rotation.y = (R() - 0.5) * 0.5; b.castShadow = b.receiveShadow = true; g.add(b);
    }
    g.position.set(t.pos[0], 0, t.wall ? WALL_Z + 1.2 : t.pos[2]); if (t.wall) g.scale.setScalar(0.75); return g;
  }

  // ---------------------------------------------------------------- code-built décor
  const bulbCols = ['#ff7eb6', '#ffe36e', '#8ff0cf', '#b89bff', '#7fd0ff'];
  function fairyLights(y = 6.6, n = 46) {
    const g = new THREE.Group(), pts = [];
    for (let i = 0; i <= 80; i++) { const u = i / 80, x = -SIDE_X + 0.2 + u * (SIDE_X * 2 - 0.4), sag = Math.abs(Math.sin(u * Math.PI * 3)) * 0.55; pts.push(V3(x, y - sag, WALL_Z + 0.18)); }
    const curve = new THREE.CatmullRomCurve3(pts); g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.025, 4), std('#6c8a5c')));
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), n);
    const m = new THREE.Matrix4(); for (let i = 0; i < n; i++) { const p = curve.getPoint((i + 0.5) / n); m.makeTranslation(p.x, p.y - 0.12, p.z + 0.04); bulbs.setMatrixAt(i, m); bulbs.setColorAt(i, new THREE.Color(bulbCols[i % bulbCols.length])); }
    g.add(bulbs); g.userData.tw = bulbs; return g;
  }
  function curtains(accent) {
    const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(1.25, WIN_H + 0.9, 24, 1); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), pinch = 1 - 0.45 * Math.exp(-Math.pow((y + 0.4) / 0.5, 2)); p.setX(i, x * pinch); p.setZ(i, Math.sin((x + 0.7) * 16) * 0.07 + 0.08); }
      geo.computeVertexNormals(); const c = new THREE.Mesh(geo, mat); c.position.set(WIN_X + s * (WIN_W / 2 + 0.35), WIN_Y - 0.25, WALL_Z + 0.35); c.castShadow = true; g.add(c);
      const tie = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.18), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), new THREE.MeshPhysicalMaterial({ color: '#ff5fa2', roughness: 0.25, clearcoat: 1 }));
      tie.position.set(WIN_X + s * (WIN_W / 2 + 0.35), WIN_Y - 0.45, WALL_Z + 0.55); g.add(tie);
    }
    const val = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, WIN_W + 1.9, 10), std('#fff6fb', { roughness: 0.3 })); val.rotation.z = Math.PI / 2; val.position.set(WIN_X, WIN_Y + WIN_H / 2 + 0.38, WALL_Z + 0.4); g.add(val);
    for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#ffd0e6', roughness: 0.2, clearcoat: 1 })); k.position.set(WIN_X + s * (WIN_W / 2 + 0.98), WIN_Y + WIN_H / 2 + 0.38, WALL_Z + 0.4); g.add(k); }
    return g;
  }
  function polaroids(cx, cy) {
    const g = new THREE.Group(), ids = ['k01', 'k02', 'k03', 'k04', 'k05'], bg = ['#ffd6ea', '#ffe8c2', '#cdf5e6', '#e3d6ff', '#fff3b5'];
    ids.forEach((id, i) => {
      const f = new THREE.Group();
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.12, 0.03), std('#ffffff', { roughness: 0.5 })); card.castShadow = true; f.add(card);
      const photoBg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshStandardMaterial({ color: bg[i], roughness: 0.6 })); photoBg.position.set(0, 0.09, 0.017); f.add(photoBg);
      if (thumbs[id]) { const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), new THREE.MeshStandardMaterial({ map: thumbs[id], transparent: true, roughness: 0.6 })); ph.position.set(0, 0.09, 0.02); f.add(ph); }
      const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.13), new THREE.MeshStandardMaterial({ color: bulbCols[i], transparent: true, opacity: 0.8 })); tape.position.set(0, 0.56, 0.03); tape.rotation.z = (i % 2 ? 1 : -1) * 0.12; f.add(tape);
      f.position.set(cx + (i - 2) * 0.98, cy + (i % 2 ? -0.18 : 0.12), WALL_Z + 0.06); f.rotation.z = (R() - 0.5) * 0.28; g.add(f);
    });
    return g;
  }
  function neon(cx, cy) {
    const g = new THREE.Group(), pts = heartShape(1).getPoints(60).map(p => V3(p.x, p.y, 0));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.07, 8, true), new THREE.MeshStandardMaterial({ color: '#ff5fb0', emissive: '#ff4fa8', emissiveIntensity: 3.2, toneMapped: false })));
    const back = new THREE.Mesh(new RoundedBoxGeometry(2.7, 2.1, 0.06, 2, 0.08), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.1, clearcoat: 1 })); back.position.set(0, 0.1, -0.06); g.add(back);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,90,170,.55)'), transparent: true, depthWrite: false, toneMapped: false })); glow.position.set(0, 0.1, -0.1); g.add(glow);
    g.position.set(cx, cy, WALL_Z + 0.2); g.userData.tw = g.children[0].material; return g;
  }
  function bunting(y = 6.7) {
    const g = new THREE.Group(), cols = ['#ff7eb6', '#ffe36e', '#8ff0cf', '#b89bff', '#ffffff'], flag = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0, -0.6)]));
    for (const [x0, x1] of [[-SIDE_X + 0.3, -0.3], [0.3, SIDE_X - 0.3]]) {
      const n = 11; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, sag = Math.sin(u * Math.PI) * 0.7;
        const f = new THREE.Mesh(flag, std(cols[i % cols.length], { side: THREE.DoubleSide, roughness: 0.6 })); f.position.set(x, y - sag, WALL_Z + 0.25); f.rotation.z = (u - 0.5) * 0.25; f.castShadow = true; g.add(f); }
      const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(V3(x0 + (x1 - x0) * u, y - Math.sin(u * Math.PI) * 0.7, WALL_Z + 0.25)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.02, 4), std('#ffffff')));
    }
    return g;
  }
  function starLights() {
    const g = new THREE.Group(), geo = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.16 : 0.36; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; })(), { depth: 0.08, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    for (let i = 0; i < 13; i++) {
      const x = -8 + i * 1.33 + (R() - 0.5) * 0.4, len = 0.6 + R() * 1.4, y = 7.7 - len, z = WALL_Z + 0.5 + R() * 1.6;
      const st = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: i % 3 ? '#ffd76a' : '#ffb3da', emissiveIntensity: 2.4, toneMapped: false })); st.position.set(x, y, z); st.rotation.y = (R() - 0.5) * 0.6; g.add(st);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 4), std('#ffffff')); str.position.set(x, y + len / 2 + 0.3, z); g.add(str);
      W.anim.push((t) => { st.rotation.y = Math.sin(t * 0.8 + i) * 0.4; });
    }
    return g;
  }
  function disco() {
    const g = new THREE.Group(), ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), new THREE.MeshStandardMaterial({ color: '#f4eaff', metalness: 1, roughness: 0.12, flatShading: true }));
    ball.position.set(-2.6, 6.3, -7.6); ball.castShadow = true; g.add(ball);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.6, 4), std('#ffffff')); str.position.set(-2.6, 7.4, -7.6); g.add(str);
    const glints = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,200,255,.4)'), transparent: true, depthWrite: false, toneMapped: false })); glints.position.copy(ball.position); g.add(glints);
    W.anim.push((t) => { ball.rotation.y = t * 0.9; glints.lookAt(0, 6, 10); });
    return g;
  }
  function paintSwap(i) { W.paintI = i; }

  // ---------------------------------------------------------------- per-room build
  function build(t, room) {
    if (t.kind === 'prop') return prop(t.id, t.id === 'h07' && room.key === 'room404' ? { ...t, pos: [WIN_X + 0.95, W.sillY, WALL_Z + 0.35], h: 0.9 } : t);
    if (t.kind === 'paint') return null;
    if (t.kind === 'curtains') return curtains(room.wall[2]);
    if (t.kind === 'lights') return fairyLights();
    if (t.kind === 'polaroids') return polaroids(-4.6, 5.3);
    if (t.kind === 'neon') return neon(-4.4, 5.1);
    if (t.kind === 'bunting') return bunting();
    if (t.kind === 'stars') return starLights();
    if (t.kind === 'disco') return disco();
    return null;
  }
  function setPaint(room, painted, k = 1) {
    wallMat.map = W.texNew; oldMat.map = W.texOld; wallMat.needsUpdate = oldMat.needsUpdate = true;
    oldMat.opacity = painted ? 1 - k : 1; oldWall.visible = oldMat.opacity > 0.001;
    W.wainsMat.color.set(painted ? room.wall[0] : '#f3ead9').lerp(new THREE.Color('#ffffff'), painted ? 0.55 : 0.3);
  }
  W.setRoom = (ri, done) => {
    const room = ROOMS[ri];
    for (const o of [...W.objs, ...W.boxes]) if (o) scene.remove(o);
    W.objs = []; W.boxes = []; W.anim.length = 0; W.room = ri; W.done = done;
    W.texNew = wallTex(room, false); W.texNew.repeat.set(4, 1.6); W.texOld = wallTex(room, true); W.texOld.repeat.set(3, 1.2);
    floorMat.map = floorTex(room.floor); floorMat.map.repeat.set(3, 4); floorMat.needsUpdate = true;
    room.tasks.forEach((t, i) => {
      const o = build(t, room); W.objs[i] = o;
      if (o) { o.visible = i < done; scene.add(o); }
      if (t.kind === 'prop' && i >= done && !(t.id === 'h07' && room.key === 'room404')) { const b = boxes(t); W.boxes[i] = b; scene.add(b); }
    });
    const pi = room.tasks.findIndex(t => t.kind === 'paint');
    setPaint(room, pi >= 0 && pi < done);
  };
  W.restore = (i) => {
    const room = ROOMS[W.room], t = room.tasks[i], o = W.objs[i], now = performance.now() / 1000;
    W.done = Math.max(W.done, i + 1);
    let p = t.pos ? V3(...t.pos) : V3(0, 4.5, WALL_Z + 0.5);
    if (t.kind === 'paint') { W.tweens.push({ t0: now, dur: 1.4, f: k => setPaint(room, true, k) }); p = V3(0, 4, WALL_Z + 0.5); }
    else if (t.kind === 'curtains') p = V3(WIN_X, WIN_Y, WALL_Z + 0.5);
    else if (t.kind === 'lights' || t.kind === 'bunting' || t.kind === 'stars') p = V3(0, 6.2, WALL_Z + 0.8);
    else if (t.kind === 'polaroids') p = V3(-4.6, 5.3, WALL_Z + 0.4);
    else if (t.kind === 'neon') p = V3(-4.4, 5.1, WALL_Z + 0.4);
    else if (t.kind === 'disco') p = V3(-2.6, 6.3, -7.6);
    if (o) {
      o.visible = true; const s0 = o.scale.x, y0 = o.position.y;
      if (o.userData.s) p = o.position.clone().setY(o.position.y + 1);
      W.tweens.push({ t0: now, dur: 0.75, f: k => { const e = k < 0.6 ? Math.sin(k / 0.6 * Math.PI / 2) * 1.18 : 1.18 - 0.18 * Math.sin((k - 0.6) / 0.4 * Math.PI / 2); o.scale.setScalar(Math.max(0.001, s0 * e)); o.position.y = y0 + (1 - Math.min(1, k * 1.6)) * 1.2; } });
    }
    const b = W.boxes[i]; if (b) { W.tweens.push({ t0: now, dur: 0.3, f: k => { b.scale.setScalar(Math.max(0.001, (1 - k) * (b.userData.s0 ??= b.scale.x))); if (k >= 1) b.visible = false; } }); }
    return p;
  };
  W.update = (dt, now) => {
    W.tweens = W.tweens.filter(tw => { const k = Math.min(1, (now - tw.t0) / tw.dur); tw.f(k); return k < 1; });
    for (const a of W.anim) a(now);
    for (const o of W.objs) if (o && o.visible && o.userData.tw) { const tw = o.userData.tw; if (tw.isMaterial) tw.emissiveIntensity = 2.8 + Math.sin(now * 3) * 0.6 + (Math.sin(now * 17) > 0.97 ? -1.5 : 0); }
  };
  return W;
}

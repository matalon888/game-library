// Mochi Match meta: kawaii rooms to decorate with stars. Each room is a dollhouse corner built in code (pastel walls,
// floor, window with a sky, fairy lights, a polaroid wall, move-in boxes) furnished with the kawaii AI 3D library.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { piece, prop } from './assets.js';

const PI = Math.PI;
// task kinds: clutter | walls | floor | window | lights | photos | item
export const ROOMS = [
  { id: 'dorm', name: 'My Dorm Room', W: 9, D: 7, H: 4.4, host: [3.1, 0, 2.2, 0.55],
    wall: { before: '#d2bff0', a: '#ffbfe0', b: '#ffffff', panel: '#c9a6ff', kind: 'hearts' },
    floor: { before: '#e6c7dc', a: '#ffd9ec', b: '#f3aed6', kind: 'check' },
    window: { x: 1.2, y: 2.75, w: 2.0, h: 1.8, curtain: '#ff9fcf' },
    boxes: [[2.6, 0, -2.6, 0.2, 1.0], [3.3, 0, -1.9, -0.3, 0.85], [2.9, 0.82, -2.5, 0.5, 0.7], [-0.6, 0, 1.6, 0.4, 0.95], [0.1, 0, 2.2, -0.2, 0.75], [-2.6, 0, -1.4, 0.1, 1.05]],
    tasks: [
      { id: 'clutter', name: 'Unpack the boxes', cost: 1, kind: 'clutter', icon: 'x01' },
      { id: 'bed', name: 'Strawberry bed', cost: 2, item: 'h01', at: [-2.75, 0, -1.75], rot: 0, size: 3.3 },
      { id: 'walls', name: 'Heart wallpaper', cost: 2, kind: 'walls', icon: 'm01' },
      { id: 'rug', name: 'Cloud rug', cost: 1, item: 'h05', at: [0.4, 0, 0.5], rot: 0.15, size: 3.4 },
      { id: 'desk', name: 'Study desk', cost: 2, item: 'h03', at: [1.25, 0, -2.75], rot: 0, size: 2.3 },
      { id: 'window', name: 'Dreamy curtains', cost: 1, kind: 'window', icon: 'm06' },
      { id: 'bear', name: 'Bear plushie', cost: 1, item: 'g15', at: [-2.35, 0.95, -2.55], rot: 0.25, size: 0.95 },
      { id: 'floor', name: 'Candy floor', cost: 2, kind: 'floor', icon: 'j01' },
      { id: 'lamp', name: 'Mushroom lamp', cost: 1, item: 'h06', at: [3.45, 0, -2.85], rot: -0.3, size: 1.45 },
      { id: 'lights', name: 'Fairy lights', cost: 1, kind: 'lights', icon: 'm03' },
      { id: 'vanity', name: 'Glam vanity', cost: 2, item: 'h04', at: [-3.85, 0, 1.45], rot: PI / 2, size: 2.4 },
      { id: 'beanbag', name: 'Heart beanbag', cost: 2, item: 'h02', at: [2.0, 0, 0.9], rot: -0.6, size: 1.75 },
      { id: 'shelf', name: 'Kawaii shelf', cost: 1, item: 'h08', at: [-4.28, 1.75, -0.35], rot: PI / 2, size: 1.7 },
      { id: 'photos', name: 'Polaroid wall', cost: 1, kind: 'photos', icon: 'r04' },
      { id: 'plant', name: 'Succulent pal', cost: 1, item: 'h07', at: [0.2, 1.62, -3.15], rot: 0, size: 0.55 },
      { id: 'bunny', name: 'Giant bunny', cost: 2, item: 'g17', at: [3.55, 0, -0.75], rot: -0.6, size: 1.55 },
      { id: 'pillow', name: 'Cat-loaf pillow', cost: 1, item: 'g16', at: [0.95, 0, 1.25], rot: 0.4, size: 0.75 },
    ] },
  { id: 'cafe', name: 'Mochi Café', W: 9, D: 7, H: 4.4, host: [2.9, 0, 2.2, 0.55],
    wall: { before: '#d5e2e6', a: '#c9f2e3', b: '#fff8ee', panel: '#ffc9df', kind: 'stripes' },
    floor: { before: '#ddd0d6', a: '#f4e6ff', b: '#d8c4f5', kind: 'check' },
    window: { x: -1.3, y: 2.75, w: 2.4, h: 1.7, curtain: '#7fd8b8' },
    boxes: [[1.7, 0, -2.4, 0.2, 1.0], [2.5, 0, -2.6, -0.3, 0.9], [2.1, 0.86, -2.5, 0.4, 0.75], [-2.3, 0, 0.6, 0.3, 1.0], [-1.6, 0, 1.3, -0.4, 0.8]],
    tasks: [
      { id: 'clutter', name: 'Clear the boxes', cost: 1, kind: 'clutter', icon: 'x01' },
      { id: 'counter', name: 'Café counter', cost: 3, item: 'h09', at: [2.2, 0, -2.45], rot: 0, size: 2.6 },
      { id: 'walls', name: 'Mint stripes', cost: 2, kind: 'walls', icon: 'm04' },
      { id: 'table', name: 'Tea table', cost: 2, item: 'h10', at: [-0.7, 0, 0.7], rot: 0.2, size: 2.9 },
      { id: 'teapot', name: 'Bunny teapot', cost: 1, item: 'f09', at: [-0.62, 1.12, 0.7], rot: 0.5, size: 0.6 },
      { id: 'window', name: 'Mint curtains', cost: 1, kind: 'window', icon: 'm06' },
      { id: 'cakes', name: 'Cake display', cost: 2, item: 'h11', at: [-3.6, 0, -2.4], rot: 0.5, size: 1.5 },
      { id: 'floor', name: 'Lilac tiles', cost: 2, item: null, kind: 'floor', icon: 'm05' },
      { id: 'cattree', name: 'Cat tower', cost: 2, item: 'h12', at: [-3.7, 0, 1.6], rot: 0.6, size: 2.3 },
      { id: 'kitten', name: 'Café kitten', cost: 1, item: 'p01', at: [-3.55, 1.38, 1.65], rot: 0.7, size: 0.6 },
      { id: 'lights', name: 'Fairy lights', cost: 1, kind: 'lights', icon: 'm03' },
      { id: 'tree', name: 'Blossom tree', cost: 2, item: 'r01', at: [-0.9, 0, -2.75], rot: 0.2, size: 2.4 },
      { id: 'boba', name: 'Boba buddy', cost: 1, item: 't01', at: [1.6, 1.42, -2.25], rot: 0.2, size: 0.42 },
      { id: 'photos', name: 'Menu board', cost: 1, kind: 'photos', icon: 'r04' },
      { id: 'pet', name: 'Bunny regular', cost: 1, item: 'p04', at: [1.2, 0, 1.7], rot: 0.4, size: 0.8 },
      { id: 'pom', name: 'Pom-pom pouf', cost: 1, item: 'g13', at: [1.6, 0, -0.4], rot: 0.3, size: 0.9 },
    ] },
];
export const roomStars = def => def.tasks.reduce((a, t) => a + t.cost, 0);

// ---------------------------------------------------------------- canvas textures
function canvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function heart(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s * 1.1, cy - s * 0.35, cx - s * 0.45, cy - s * 1.05, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.45, cy - s * 1.05, cx + s * 1.1, cy - s * 0.35, cx, cy + s * 0.35); x.fill(); }
function star(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
function wallTex(s, nice) {
  return canvas(512, 512, (x, w, h) => {
    if (!nice) { x.fillStyle = s.before; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${rnd(0.03, 0.08)})`; x.fillRect(rnd(0, w), rnd(0, h), rnd(2, 8), rnd(2, 8)); } return; }
    x.fillStyle = s.a; x.fillRect(0, 0, w, h);
    if (s.kind === 'hearts') {
      for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) { const cx = xx * 64 + (yy % 2 ? 32 : 0) + 32, cy = yy * 64 + 32;
        x.fillStyle = 'rgba(255,255,255,.9)'; if ((xx + yy) % 3 === 0) heart(x, cx, cy, 13); else if ((xx + yy) % 3 === 1) { x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill(); } else { x.fillStyle = 'rgba(255,240,170,.95)'; star(x, cx, cy, 9); } }
    } else {
      for (let i = 0; i < w; i += 64) { x.fillStyle = s.b; x.fillRect(i, 0, 30, h); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(i + 30, 0, 3, h); }
      for (let yy = 0; yy < 8; yy++) { x.fillStyle = 'rgba(255,150,200,.55)'; heart(x, 47 + (yy % 2) * 256, yy * 64 + 32, 7); heart(x, 175 + (yy % 2) * 256, yy * 64 + 32, 7); }
    }
  });
}
function floorTex(s, nice) {
  return canvas(512, 512, (x, w, h) => {
    if (!nice) {
      x.fillStyle = s.before; x.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, y, w, 2); for (let k = 0; k < 2; k++) x.fillRect(rnd(0, w), y, 2, 64); }
      return;
    }
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) % 2 ? s.b : s.a; x.fillRect(xx * 128, yy * 128, 128, 128);
      const g = x.createLinearGradient(xx * 128, yy * 128, xx * 128 + 128, yy * 128 + 128); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(xx * 128, yy * 128, 128, 128); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
  });
}
function skyTex(night = false) {
  return canvas(128, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd8ff'); g.addColorStop(0.65, '#ffd6f0'); g.addColorStop(1, '#fff1d6'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.95)'; for (const [cx, cy, s] of [[30, 40, 1], [92, 70, 0.8], [60, 100, 0.6]]) { for (const [dx, dy, r] of [[0, 0, 12], [12, -5, 10], [-11, 2, 9], [22, 3, 7]]) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 7); x.fill(); } }
    x.fillStyle = '#fff6a8'; star(x, 100, 22, 6); star(x, 18, 90, 4);
  });
}
function shaftTex() { return canvas(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,230,245,.6)'); g.addColorStop(1, 'rgba(255,230,245,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
function boxTex() {
  return canvas(256, 256, (x, w, h) => {
    x.fillStyle = '#e8c49a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(150,100,50,${rnd(0.03, 0.08)})`; x.fillRect(rnd(0, w), rnd(0, h), rnd(1, 4), rnd(4, 16)); }
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(w / 2 - 20, 0, 40, h);   // tape
    x.fillStyle = '#ff8fc6'; heart(x, 70, 190, 22); x.fillStyle = '#ffffff'; x.font = 'bold 26px sans-serif'; x.fillText('♡', 170, 80);
  });
}
function photoTex(i) {
  const pal = [['#ffc2df', '#ff6fae'], ['#c9f2e3', '#3fcf9e'], ['#e3d4ff', '#a77cff'], ['#fff0b3', '#ffc83d'], ['#c8e9ff', '#55b8ff'], ['#ffd9c2', '#ff9a5c']][i % 6];
  return canvas(128, 150, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = pal[0]; x.fillRect(10, 10, w - 20, 104);
    x.fillStyle = pal[1]; if (i % 3 === 0) heart(x, 64, 66, 30); else if (i % 3 === 1) star(x, 64, 62, 30); else { x.beginPath(); x.arc(64, 62, 26, 0, 7); x.fill(); x.fillStyle = '#5a3a5a'; x.beginPath(); x.arc(55, 58, 3.5, 0, 7); x.arc(73, 58, 3.5, 0, 7); x.fill(); }
    x.fillStyle = '#c88aa8'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText(['♡ besties', 'yay!', 'mochi', 'xoxo', 'cutie', '✿'][i % 6], 64, 138);
  });
}

// ---------------------------------------------------------------- room builder
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const J = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
export async function buildRoom(def) {
  const g = new THREE.Group(); g.name = def.id;
  const { W, D, H } = def, hw = W / 2, hd = D / 2;
  const R = { group: g, def, items: {}, apply: {} };
  // rounded candy slab under the room
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.7, 0.7, D + 0.7, 4, 0.3), J('#f7c6e4')); slab.position.set(-0.15, -0.36, -0.15); slab.receiveShadow = true; g.add(slab);
  const slab2 = new THREE.Mesh(new RoundedBoxGeometry(W + 0.95, 0.22, D + 0.95, 4, 0.11), J('#ffffff')); slab2.position.set(-0.15, -0.62, -0.15); g.add(slab2);
  // floor
  const fB = floorTex(def.floor, false), fN = floorTex(def.floor, true);
  fB.repeat.set(W / 4, D / 4); fN.repeat.set(W / 3, D / 3);
  const floorMat = M('#ffffff', { map: fB, roughness: 0.75 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -PI / 2; floor.position.y = 0.005; floor.receiveShadow = true; g.add(floor);
  R.apply.floor = nice => { floorMat.map = nice ? fN : fB; floorMat.roughness = nice ? 0.32 : 0.75; floorMat.needsUpdate = true; };
  // walls (back + left), rounded caps
  const wB = wallTex(def.wall, false), wN = wallTex(def.wall, true);
  wB.repeat.set(W / 3, H / 3); wN.repeat.set(W / 2.6, H / 2.6);
  const wallMat = M('#ffffff', { map: wB, roughness: 0.8 }), capMat = J('#fff4fb');
  const mkWall = (w, d, x, z, inner) => {
    const mats = [capMat, capMat, capMat, capMat, capMat, capMat]; mats[inner] = wallMat;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mats); m.position.set(x, H / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  mkWall(W + 0.6, 0.3, -0.15, -hd - 0.15, 4); mkWall(0.3, D, -hw - 0.15, 0, 0);
  // top trim (candy rope) on the wall tops
  const rope = J('#ff9fd0'); for (const [w, x, z, ry] of [[W + 0.7, -0.15, -hd - 0.15, 0], [D + 0.3, -hw - 0.15, 0, PI / 2]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, w, 16), rope); t.rotation.z = PI / 2; t.rotation.y = ry; t.position.set(x, H + 0.02, z); g.add(t); }
  // panelling under the wallpaper (shown with the new walls)
  const pan = new THREE.Group(), pm = J(def.wall.panel, { roughness: 0.4 }), trim = J('#ffffff');
  for (const [w, x, z, ry] of [[W, 0, -hd + 0.05, 0], [D, -hw + 0.05, 0, PI / 2]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.3, 0.08), pm); p.position.set(x, 0.65, z); p.rotation.y = ry; p.receiveShadow = true; pan.add(p);
    const rl = new THREE.Mesh(new RoundedBoxGeometry(w, 0.14, 0.18, 2, 0.06), trim); rl.position.set(x, 1.32, z); rl.rotation.y = ry; pan.add(rl);
    const n = Math.round(w / 1.2); for (let i = 0; i < n; i++) { const fr = new THREE.Mesh(new RoundedBoxGeometry(w / n - 0.28, 0.78, 0.06, 2, 0.05), trim); const off = -w / 2 + (i + 0.5) * w / n; fr.position.set(x + Math.cos(ry) * off, 0.68, z - Math.sin(ry) * off + (ry ? 0 : 0.03)); if (ry) fr.position.x += 0.03; fr.rotation.y = ry; pan.add(fr); }
  }
  pan.visible = false; g.add(pan);
  R.apply.walls = nice => { wallMat.map = nice ? wN : wB; wallMat.needsUpdate = true; pan.visible = nice; };
  // window
  const { x: wx, y: wy, w: ww, h: wh } = def.window, win = new THREE.Group(); win.position.set(wx, wy, -hd + 0.02);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false })); sky.position.z = 0.01; win.add(sky);
  const fm = J('#ffffff');
  const bar = (w, h, x, y) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.2, 2, Math.min(w, h) * 0.45), fm); b.position.set(x, y, 0.07); b.castShadow = true; win.add(b); };
  bar(ww + 0.32, 0.18, 0, wh / 2); bar(ww + 0.32, 0.22, 0, -wh / 2); bar(0.18, wh, -ww / 2, 0); bar(0.18, wh, ww / 2, 0); bar(0.08, wh, 0, 0);
  const sill = new THREE.Mesh(new RoundedBoxGeometry(ww + 0.7, 0.14, 0.5, 2, 0.06), fm); sill.position.set(0, -wh / 2 - 0.12, 0.22); sill.castShadow = true; win.add(sill);
  const curtains = new THREE.Group(), cm = J(def.window.curtain, { roughness: 0.6, clearcoat: 0.3, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  for (const s of [-1, 1]) {
    const cg = new THREE.CylinderGeometry(0.26, 0.4, wh + 0.9, 18, 6, true), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const a = Math.atan2(cp.getZ(i), cp.getX(i)), k = 1 + Math.sin(a * 6) * 0.12; cp.setX(i, cp.getX(i) * k); cp.setZ(i, cp.getZ(i) * k); } cg.computeVertexNormals();
    const c = new THREE.Mesh(cg, cm); c.scale.z = 0.5; c.position.set(s * (ww / 2 + 0.3), -0.1, 0.3); c.castShadow = true; curtains.add(c);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 8, 20), J('#ffffff')); tie.rotation.x = PI / 2; tie.scale.z = 0.6; tie.position.set(s * (ww / 2 + 0.3), -0.35, 0.3); curtains.add(tie);
  }
  const valance = new THREE.Mesh(new RoundedBoxGeometry(ww + 1.3, 0.38, 0.3, 3, 0.15), cm); valance.position.set(0, wh / 2 + 0.38, 0.28); curtains.add(valance);
  win.add(curtains);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(ww * 1.2, 7), new THREE.MeshBasicMaterial({ map: shaftTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.22 }));
  shaft.position.set(0.4, -2.2, 2.6); shaft.rotation.set(-1.0, 0.15, 0); win.add(shaft);
  g.add(win);
  R.apply.window = nice => { curtains.visible = nice; shaft.visible = nice; sky.material.color.set(nice ? '#ffffff' : '#c9c3cf'); };
  // fairy lights: two sagging strings with glowing bulbs (bloom makes them sparkle)
  const lights = new THREE.Group(), bulbG = new THREE.SphereGeometry(0.075, 10, 8), wireM = M('#ffffff');
  const BULB = ['#ffd6f0', '#fff3a8', '#c9f0ff', '#e7d2ff'], bulbMs = BULB.map(c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), toneMapped: false }));
  const strand = (a, b, n, sag) => {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(t * PI) * sag, 0))); }
    const curve = new THREE.CatmullRomCurve3(pts); lights.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.012, 4), wireM));
    for (let i = 1; i < n; i++) { const b = new THREE.Mesh(bulbG, bulbMs[i % 4]); b.position.copy(curve.getPoint(i / n)); b.position.y -= 0.06; lights.add(b); }
  };
  strand(new THREE.Vector3(-hw + 0.3, H - 0.35, -hd + 0.2), new THREE.Vector3(hw - 0.4, H - 0.35, -hd + 0.2), 26, 0.55);
  strand(new THREE.Vector3(-hw + 0.2, H - 0.35, -hd + 0.3), new THREE.Vector3(-hw + 0.2, H - 0.35, hd - 0.4), 20, 0.5);
  lights.visible = false; g.add(lights);
  R.apply.lights = nice => { lights.visible = nice; };
  // polaroid wall (left wall)
  const photos = new THREE.Group();
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), new THREE.MeshStandardMaterial({ map: photoTex(i + (def.id === 'cafe' ? 2 : 0)), roughness: 0.5 }));
    m.position.set(-hw + 0.04, 2.15 + (i % 2) * 0.82, 0.95 + Math.floor(i / 2) * 0.78); m.rotation.y = PI / 2; m.rotation.x = (Math.random() - 0.5) * 0.25; m.castShadow = true; photos.add(m);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), J(['#ff6fae', '#55c3ff', '#ffd23f'][i % 3])); pin.position.copy(m.position); pin.position.y += 0.3; pin.position.x += 0.04; photos.add(pin); }
  photos.visible = false; g.add(photos);
  R.apply.photos = nice => { photos.visible = nice; };
  // move-in boxes
  const clutter = new THREE.Group(), bt = boxTex(), bm = M('#ffffff', { map: bt, roughness: 0.85 }), bg = new RoundedBoxGeometry(0.85, 0.82, 0.85, 2, 0.04);
  for (const [x, y, z, r, s] of def.boxes) { const m = new THREE.Mesh(bg, bm); m.position.set(x, y + 0.41 * s, z); m.rotation.y = r; m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; clutter.add(m); }
  g.add(clutter); R.clutter = clutter;
  R.apply.clutter = nice => { clutter.visible = !nice; };
  // furniture (hidden until bought)
  for (const t of def.tasks) {
    if (!t.item) continue;
    await new Promise(r => setTimeout(r, 30));   // one piece per task, so a room build never blocks the screen in one go
    const m = await prop(t.item, t.size); m.position.set(...t.at); m.rotation.y = t.rot || 0;
    m.visible = false; m.userData.base = m.scale.clone(); g.add(m); R.items[t.id] = m;
  }
  return R;
}

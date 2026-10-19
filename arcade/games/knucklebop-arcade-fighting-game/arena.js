// Knucklebop arenas: three stages built in code (rooftop at sunset, blossom dojo, harbour pier) with a cheering crowd.
import { THREE, rounded } from './kit/hc.js';

export const ARENAS = [
  { name: 'Sunset Rooftop', bg: ['#ff8f7a', '#ffe1b3'], fog: '#ffc4a3', hemi: '#fff1e6', ground: '#ffc6a8' },
  { name: 'Blossom Dojo', bg: ['#a993ff', '#ffe0f1'], fog: '#e5d4ff', hemi: '#fff6ff', ground: '#e9d8ff' },
  { name: 'Harbour Pier', bg: ['#5cc8ff', '#e2f7ff'], fog: '#bfe9ff', hemi: '#ffffff', ground: '#bfe9ff' },
];

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02, ...o });
function tex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const planks = (a, b, line) => (x, w, h) => {
  x.fillStyle = a; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(0, i * h / 8, w, h / 8); x.fillStyle = line; x.fillRect(0, i * h / 8, w, 3); x.fillRect(((i * 37) % 5) * w / 5, i * h / 8, 3, h / 8); }
};
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), E = new THREE.Euler();
function inst(geo, mat, n, shadow = false) { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = false; return m; }
const put = (m, i, x, y, z, s = [1, 1, 1], ry = 0) => { M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), Sc.set(...s)); m.setMatrixAt(i, M4); };

function crowd(g, z0, colors, rnd) {
  const n = 30, body = inst(new THREE.CapsuleGeometry(0.28, 0.4, 4, 10), std('#ffffff'), n), head = inst(new THREE.SphereGeometry(0.24, 14, 10), std('#ffffff'), n);
  const skins = ['#ffd7ba', '#f1c19a', '#c98f65', '#8d5a3b', '#ffe0c7'], ppl = [];
  for (let i = 0; i < n; i++) {
    const row = i % 2, x = -8 + (i >> 1) * 1.1 + row * 0.55 + (rnd() - 0.5) * 0.3, z = z0 - row * 1.0, y = 0.3 + row * 0.55;
    ppl.push({ x, y, z, ph: rnd() * 6, sp: 3 + rnd() * 3, s: 0.85 + rnd() * 0.3 });
    body.setColorAt(i, new THREE.Color(colors[i % colors.length])); head.setColorAt(i, new THREE.Color(skins[(i * 7) % skins.length]));
  }
  g.add(body, head);
  // a bench / bleacher under them
  const bench = new THREE.Mesh(rounded(18, 0.5, 0.9, 0.1), std('#ffffff', { color: colors[0] }));
  bench.material.color.set('#f6f0ff'); bench.position.set(0, 0.0, z0); bench.receiveShadow = true; g.add(bench);
  const bench2 = bench.clone(); bench2.position.set(0, 0.55, z0 - 1); g.add(bench2);
  return (t, hype) => {
    for (let i = 0; i < n; i++) {
      const p = ppl[i], b = Math.abs(Math.sin(t * p.sp + p.ph)) * (0.06 + hype * 0.3);
      put(body, i, p.x, p.y + 0.55 + b, p.z, [p.s, p.s, p.s]); put(head, i, p.x, p.y + 1.15 * p.s + b, p.z, [p.s, p.s, p.s]);
    }
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
  };
}

export function buildArena(idx, rnd = Math.random) {
  const A = ARENAS[idx % ARENAS.length], g = new THREE.Group(), updates = [];
  // big ground that reaches the camera
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), std(A.ground)); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.32, 10); ground.receiveShadow = true; g.add(ground);
  let floorTex;
  if (idx === 0) floorTex = tex(256, 256, planks('#c98f5a', '#bd844f', '#8f5a34'), 6, 2);
  else if (idx === 1) floorTex = tex(256, 256, (x, w, h) => { x.fillStyle = '#d9e6a6'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8d98e'; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2); x.strokeStyle = '#3c5a3a'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h / 2 - 6); x.strokeRect(3, h / 2 + 3, w / 2 - 6, h / 2 - 6); x.strokeRect(w / 2 + 3, h / 2 + 3, w / 2 - 6, h / 2 - 6); }, 2.5, 1);
  else floorTex = tex(256, 256, planks('#e2b27a', '#d6a46d', '#a8754a'), 6, 2);
  floorTex.repeat.set(floorTex.repeat.x * 2, floorTex.repeat.y * 3);
  const floor = new THREE.Mesh(rounded(32, 0.4, 19, 0.12), std('#ffffff', { map: floorTex, roughness: 0.75 }));
  floor.position.set(0, -0.2, 6.6); floor.receiveShadow = true; g.add(floor);
  const trim = new THREE.Mesh(rounded(16.2, 0.18, 0.3, 0.06), std(idx === 0 ? '#7b4f8f' : idx === 1 ? '#c8323f' : '#2f6fb8'));
  trim.position.set(0, -0.12, -3.0); trim.scale.x = 2; trim.receiveShadow = true; g.add(trim);

  if (idx === 0) {
    // skyline at sunset
    const sky = inst(new THREE.BoxGeometry(1, 1, 1), std('#ffffff', { map: tex(64, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,240,170,.95)'; for (let r = 0; r < 10; r++) for (let c = 0; c < 4; c++) if ((r * 3 + c * 5) % 7 > 1) x.fillRect(6 + c * 15, 8 + r * 12, 8, 6); }) }), 34);
    const cols = ['#c86b98', '#e58f8f', '#9c7fd6', '#f2a76e', '#b35a8a', '#7d6bc9'];
    for (let i = 0; i < 34; i++) {
      const row = i % 2, w = 2 + rnd() * 2.5, h = 4 + rnd() * 9 + row * 4, x = -32 + i * 1.95 + rnd(), z = -12 - row * 7 - rnd() * 3;
      put(sky, i, x, h / 2 - 0.3, z, [w, h, 2 + rnd() * 2]); sky.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    }
    g.add(sky);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(4, 40), new THREE.MeshBasicMaterial({ color: '#ffe36e', fog: false })); sun.position.set(6, 6, -40); g.add(sun);
    // water tower + parapet + string lights
    const wt = new THREE.Group(); wt.position.set(-6.2, 0, -3.4);
    const wood = std('#8f5a34');
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.6, 20), wood); tank.position.y = 3; tank.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.8, 20), std('#5b3a5e')); roof.position.y = 4.2; roof.castShadow = true;
    wt.add(tank, roof);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), wood); l.position.set(x, 1.1, z); wt.add(l); }
    g.add(wt);
    const par = new THREE.Mesh(rounded(18, 0.7, 0.4, 0.08), std('#b5776a')); par.position.set(0, 0.2, -3.4); par.receiveShadow = true; g.add(par);
    const bulbs = inst(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 44), bc = ['#ffe36e', '#ff7aa8', '#7ff6ff', '#b0ff7a'];
    for (let i = 0; i < 44; i++) { const row = i < 22 ? 0 : 1, u = (i % 22) / 21, x = -9 + u * 18, y = 4.3 - row * 0.6 - Math.sin(u * Math.PI) * 0.9, z = -2.4 - row * 1.4; put(bulbs, i, x, y, z); bulbs.setColorAt(i, new THREE.Color(bc[i % 4])); }
    g.add(bulbs);
    for (const row of [0, 1]) { const pts = []; for (let k = 0; k <= 20; k++) { const u = k / 20; pts.push(new THREE.Vector3(-9 + u * 18, 4.3 - row * 0.6 - Math.sin(u * Math.PI) * 0.9 + 0.08, -2.4 - row * 1.4)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.015, 4), std('#3b2a3a'))); }
    for (const x of [-9, 9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6), std('#4a3a5a')); p.position.set(x, 2.1, -2.4); g.add(p); }
    for (const [x, z] of [[5.2, -3.2], [6.6, -3.6]]) { const ac = new THREE.Mesh(rounded(1.1, 0.8, 0.9, 0.1), std('#d9d4e8')); ac.position.set(x, 0.4, z); ac.castShadow = true; g.add(ac); }
    updates.push(crowd(g, -5.4, ['#ff5d8f', '#3a86ff', '#ffd23f', '#3ab795', '#7b5cff', '#ff8c42'], rnd));
  } else if (idx === 1) {
    // dojo: paper walls, red pillars, lanterns, blossom trees, falling petals
    const shoji = tex(128, 128, (x, w, h) => { x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a5a3c'; x.lineWidth = 5; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); } }, 6, 1);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.2), std('#ffffff', { map: shoji, emissive: '#fff2d6', emissiveIntensity: 0.25 })); wall.position.set(0, 2.1, -6.5); g.add(wall);
    const roofb = new THREE.Mesh(rounded(24, 0.6, 2.4, 0.15), std('#4a3a6a')); roofb.position.set(0, 4.5, -6); roofb.castShadow = true; g.add(roofb);
    const pil = inst(new THREE.CylinderGeometry(0.22, 0.22, 4.4, 12), std('#d8434f'), 6, true);
    [-9, -5.4, -1.8, 1.8, 5.4, 9].forEach((x, i) => put(pil, i, x, 2.2, -6.2)); g.add(pil);
    const lan = inst(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshStandardMaterial({ color: '#ff5d5d', emissive: '#ff4d3d', emissiveIntensity: 0.6 }), 5);
    [-7.2, -3.6, 0, 3.6, 7.2].forEach((x, i) => put(lan, i, x, 3.5, -5.7, [1, 1.25, 1])); g.add(lan);
    const trunk = std('#7a4b3a'), petal = std('#ffb7d5');
    const blos = inst(new THREE.SphereGeometry(1, 12, 10), petal, 24, true);
    let bi = 0;
    for (const [tx, tz] of [[-8.4, -4.2], [8.4, -4.4], [-11, -8], [11, -8.5]]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.2, 8), trunk); tr.position.set(tx, 1.6, tz); tr.castShadow = true; g.add(tr);
      for (let k = 0; k < 6; k++) put(blos, bi++, tx + (rnd() - 0.5) * 2.2, 3.4 + rnd() * 1.2, tz + (rnd() - 0.5) * 1.4, [0.8 + rnd() * 0.5, 0.7 + rnd() * 0.4, 0.8 + rnd() * 0.5]);
    }
    g.add(blos);
    const pet = inst(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshBasicMaterial({ color: '#ff9cc6', side: THREE.DoubleSide }), 40);
    const pp = Array.from({ length: 40 }, () => ({ x: (rnd() - 0.5) * 18, y: rnd() * 6, z: -4 + rnd() * 6, s: 0.3 + rnd() * 0.5, ph: rnd() * 6 }));
    g.add(pet);
    updates.push(t => { for (let i = 0; i < 40; i++) { const p = pp[i], y = 6 - ((t * p.s + p.y) % 6.4); M4.compose(V.set(p.x + Math.sin(t + p.ph) * 0.6, y, p.z), Q.setFromEuler(E.set(t * 2 + p.ph, t + p.ph, 0)), Sc.set(1, 1, 1)); pet.setMatrixAt(i, M4); } pet.instanceMatrix.needsUpdate = true; });
    updates.push(crowd(g, -4.9, ['#ffffff', '#ffd23f', '#7b5cff', '#3a86ff', '#ff5d8f', '#52b788'], rnd));
  } else {
    // pier: sea, lighthouse, boats, islands, gulls
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), std('#2fb8ec', { roughness: 0.25, map: tex(128, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(30,120,180,.25)'; x.lineWidth = 3; for (let i = 0; i < 9; i++) { const yy = rnd() * h, xx = rnd() * w; x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + 10, yy - 5, xx + 22, yy); x.stroke(); } }, 30, 18) }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.5, -40); g.add(sea);
    const lh = new THREE.Group(); lh.position.set(9, 0, -14);
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.9 - i * 0.08, 1.0 - i * 0.08, 1.2, 18), std(i % 2 ? '#ffffff' : '#ef4b5f')); s.position.y = 0.6 + i * 1.2; s.castShadow = true; lh.add(s); }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 14), new THREE.MeshStandardMaterial({ color: '#fff3a8', emissive: '#ffe066', emissiveIntensity: 0.9 })); lamp.position.y = 7.6; lh.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 14), std('#2b2d42')); cap.position.y = 8.4; lh.add(cap); g.add(lh);
    const isl = inst(new THREE.SphereGeometry(1, 16, 10), std('#7ed957'), 5);
    [[-14, -30, 6], [-4, -38, 4], [16, -34, 7], [-24, -26, 4], [26, -28, 3]].forEach(([x, z, s], i) => put(isl, i, x, -0.5, z, [s, s * 0.5, s * 0.7])); g.add(isl);
    const boats = [];
    for (const [x, z, c] of [[-7, -9, '#ffd23f'], [4, -12, '#ff5d8f'], [-13, -15, '#3a86ff']]) {
      const b = new THREE.Group(); b.position.set(x, -0.35, z);
      const hull = new THREE.Mesh(rounded(2.4, 0.6, 1.0, 0.25), std(c)); hull.castShadow = true;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), std('#ffffff')); mast.position.y = 1.2;
      const sail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), std('#ffffff')); sail.position.set(0.3, 1.3, 0); sail.scale.z = 0.12;
      b.add(hull, mast, sail); g.add(b); boats.push(b);
    }
    const posts = inst(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), std('#8f5a34'), 10);
    for (let i = 0; i < 10; i++) put(posts, i, -9 + i * 2, 0.3, -2.9); g.add(posts);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 18, 6), std('#e8d6b0')); rope.rotation.z = Math.PI / 2; rope.position.set(0, 0.9, -2.9); g.add(rope);
    const gull = inst(new THREE.ConeGeometry(0.12, 0.7, 3), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 6); g.add(gull);
    updates.push(t => {
      boats.forEach((b, i) => { b.rotation.z = Math.sin(t * 1.3 + i) * 0.06; b.position.y = -0.35 + Math.sin(t * 1.6 + i * 2) * 0.06; });
      for (let i = 0; i < 6; i++) { const a = t * 0.3 + i * 1.05; M4.compose(V.set(Math.cos(a) * 8 + (i - 3), 6.5 + Math.sin(t * 2 + i) * 0.4, -9 + Math.sin(a) * 3), Q.setFromEuler(E.set(Math.PI / 2, 0, -a)), Sc.set(1, 1, 1)); gull.setMatrixAt(i, M4); }
      gull.instanceMatrix.needsUpdate = true;
    });
    updates.push(crowd(g, -5.3, ['#ff8c42', '#3a86ff', '#ffffff', '#ff5d8f', '#ffd23f', '#2a9d8f'], rnd));
  }
  return { group: g, A, update(t, hype) { for (const u of updates) u(t, hype); } };
}

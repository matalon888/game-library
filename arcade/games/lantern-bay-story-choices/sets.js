// Lantern Bay — the four sets, built in code around the AI cozy props:
//   harbor     the quay at the head of the bay: water, boats, far town on the hill, the lighthouse on its point
//              variants: dusk, afternoon, night, festival (lanterns + bunting), stall (+ cake stall), launch (night + lanterns on the water)
//   tearoom    The Gull & Kettle: purple wainscot, bay window onto the sea, counter, tables, pendant lamps
//   bookshop   Marsh & Margins: walls of shelves, round window, sofa, rug, ladder, book stacks
//   lighthouse the lantern room: iron floor, glass walls, copper dome, the empty pedestal, candles
// Every set lives in its own Group at the origin; only one is visible. Floors at y = 0, people stand on the marks.
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

let THREE, PROTO;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02, ...o });
function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.userData.canvas = c; return t;
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function add(p, m, x = 0, y = 0, z = 0) { m.position.set(x, y, z); p.add(m); return m; }
// a cozy prop: normalised (largest side 1, centred, resting on y = 0), scaled so its largest side = size
function place(p, id, size, x, y, z, rot = 0, shadow = true) {
  const src = PROTO[id]; if (!src) return new THREE.Group();
  const o = src.clone(); o.scale.setScalar(size); o.position.set(x, y, z); o.rotation.y = rot; p.add(o);
  if (!shadow) o.traverse(m => { if (m.isMesh) m.castShadow = false; });
  return o;
}
const soft = () => tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
let SOFT;
function glow(p, color, size, x, y, z, op = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); s.position.set(x, y, z); p.add(s); return s;
}
function skyTex(stops) { return tex(8, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
function plankTex(base = [184, 132, 92], rows = 8) {
  return tex(512, 512, (x, w, h) => {
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let cx = -(r * 97 % 160);
      while (cx < w) { const len = 140 + (rnd() * 180 | 0), l = 0.82 + rnd() * 0.22;
        x.fillStyle = `rgb(${base[0] * l | 0},${base[1] * l | 0},${base[2] * l | 0})`; x.fillRect(cx, r * rh, len - 2, rh - 2);
        x.fillStyle = 'rgba(0,0,0,.06)'; for (let k = 0; k < 5; k++) x.fillRect(cx, r * rh + rnd() * rh, len - 2, 1);
        cx += len; }
    }
  });
}
function stoneTex(base = [176, 168, 156]) {
  return tex(512, 256, (x, w, h) => {
    x.fillStyle = '#6f675e'; x.fillRect(0, 0, w, h);
    const rows = 4, rh = h / rows;
    for (let r = 0; r < rows; r++) { let cx = -(r % 2) * 50; while (cx < w) { const len = 70 + rnd() * 70, l = 0.8 + rnd() * 0.25;
      x.fillStyle = `rgb(${base[0] * l | 0},${base[1] * l | 0},${base[2] * l | 0})`;
      x.beginPath(); x.roundRect(cx + 2, r * rh + 2, len - 4, rh - 4, 8); x.fill(); cx += len; } }
  });
}

// ---------------------------------------------------------------------------------------------- loading
export async function loadProps(T, GLTFLoader, ids, onEach) {
  THREE = T; PROTO = {}; SOFT = soft();
  const loader = new GLTFLoader();
  await Promise.all(ids.map(id => Promise.race([loader.loadAsync(`./assets/${id}.glb`), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))])
    .then(g => { PROTO[id] = norm(g.scene); })
    .catch(e => { console.warn('prop', id, e && e.message); PROTO[id] = new THREE.Group(); })
    .finally(() => onEach && onEach(id))));
  return PROTO;
}
// the cozy GLBs are stored Z-up: stand them up, centre on x/z, rest on y = 0, largest side = 1
function norm(scene) {
  scene.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(scene); w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(V()), c = bb.getCenter(V());
  scene.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(1 / Math.max(sz.x, sz.y, sz.z));
  const root = new THREE.Group(); root.add(w);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const m = o.material; if (m && m.metalness > 0.6) m.metalness = 0.6; } });
  return root;
}

// ---------------------------------------------------------------------------------------------- sets
export function buildSets(T, scene) {
  THREE = T;
  const S = { harbor: harbor(), tearoom: tearoom(), bookshop: bookshop(), lighthouse: lighthouse() };
  for (const s of Object.values(S)) { s.group.visible = false; scene.add(s.group); }
  return S;
}

// ------------------------------------------------------------------------------ the harbour
function harbor() {
  const G = new THREE.Group(), H = { group: G, name: 'harbor' };
  // quay (stone) + capstones + bollards
  const quayM = std('#ffffff', { map: stoneTex(), roughness: 0.85 }); quayM.map.wrapS = quayM.map.wrapT = THREE.RepeatWrapping; quayM.map.repeat.set(10, 1.2);
  const quay = add(G, new THREE.Mesh(new THREE.BoxGeometry(44, 1.7, 12), quayM), 0, -0.85, 4.4); quay.receiveShadow = true;
  const topT = stoneTex([196, 188, 172]); topT.wrapS = topT.wrapT = THREE.RepeatWrapping; topT.repeat.set(12, 3);
  const top = add(G, new THREE.Mesh(new THREE.PlaneGeometry(44, 12), std('#ffffff', { map: topT, roughness: 0.9 })), 0, 0.002, 4.4); top.rotation.x = -Math.PI / 2; top.receiveShadow = true;
  const cap = add(G, new THREE.Mesh(new THREE.BoxGeometry(44, 0.16, 0.5), std('#d9d0c0', { roughness: 0.8 })), 0, 0.08, -1.45); cap.receiveShadow = cap.castShadow = true;
  const bolG = new THREE.CylinderGeometry(0.13, 0.17, 0.5, 14), bolM = std('#2d3446', { roughness: 0.4, metalness: 0.4 });
  const bollards = new THREE.InstancedMesh(bolG, bolM, 9); { const m = new THREE.Matrix4(); let i = 0; for (const x of [-12, -8.5, -5.2, -2.7, 2.2, 5.6, 8.8, 12, 15]) { m.makeTranslation(x, 0.25, -1.3); bollards.setMatrixAt(i++, m); } }
  bollards.castShadow = true; G.add(bollards);
  // wooden pier into the water
  const pierM = std('#ffffff', { map: plankTex([168, 120, 82], 6), roughness: 0.75 }); pierM.map.wrapS = pierM.map.wrapT = THREE.RepeatWrapping; pierM.map.repeat.set(1, 4);
  const pier = add(G, new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 11), pierM), 3.6, -0.12, -7.0); pier.receiveShadow = pier.castShadow = true;
  const postG = new THREE.CylinderGeometry(0.11, 0.11, 1.6, 8), posts = new THREE.InstancedMesh(postG, std('#5b4535', { roughness: 0.9 }), 12);
  { const m = new THREE.Matrix4(); let i = 0; for (let k = 0; k < 6; k++) for (const s of [-1, 1]) { m.makeTranslation(3.6 + s * 1.15, -0.6, -2.5 - k * 1.8); posts.setMatrixAt(i++, m); } } G.add(posts);
  // water
  const nrm = tex(256, 256, (x, w, h) => { const id = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const a = Math.sin(i * 0.19 + Math.sin(j * 0.07) * 3) + Math.sin(j * 0.23 + i * 0.05) + Math.sin((i + j) * 0.11); const b = Math.cos(j * 0.17 + Math.sin(i * 0.09) * 2) + Math.cos(i * 0.21 - j * 0.04); const o = (j * w + i) * 4; id.data[o] = 128 + a * 22; id.data[o + 1] = 128 + b * 22; id.data[o + 2] = 255; id.data[o + 3] = 255; } x.putImageData(id, 0, 0); });
  nrm.colorSpace = THREE.NoColorSpace; nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(40, 40);
  const waterM = new THREE.MeshStandardMaterial({ color: '#2f7f95', roughness: 0.12, metalness: 0.15, normalMap: nrm, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.6 });
  const water = add(G, new THREE.Mesh(new THREE.PlaneGeometry(500, 500), waterM), 0, -0.9, -150); water.rotation.x = -Math.PI / 2; water.receiveShadow = true;
  // a glittering path of sun on the water
  const glit = add(G, new THREE.Mesh(new THREE.PlaneGeometry(9, 90), new THREE.MeshBasicMaterial({ map: tex(64, 512, (x, w, h) => { for (let i = 0; i < 900; i++) { const y = rnd() * h, a = Math.pow(1 - y / h, 0.6) * 0.6, xx = w / 2 + (rnd() - 0.5) * w * (0.3 + 0.7 * y / h); x.fillStyle = `rgba(255,236,190,${a * rnd()})`; x.fillRect(xx, y, 2 + rnd() * 6, 1.5); } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), -6, -0.88, -60);
  glit.rotation.x = -Math.PI / 2; glit.rotation.z = 0.06;
  // boats
  H.boats = [];
  const hullCols = ['#e8584f', '#2bb3c0', '#f4c542', '#ffffff', '#6d7ce0'];
  const boatAt = [[-3.4, -4.6, 1.2], [-9.0, -9.5, -0.3], [8.4, -6.0, 2.4], [1.6, -16, 1.4], [-14, -18, -0.8]];
  boatAt.forEach(([x, z, r], i) => {
    const b = new THREE.Group(); b.position.set(x, -1.05, z); b.rotation.y = r; G.add(b);
    const hg = new THREE.BoxGeometry(1.3, 0.62, 3.6, 2, 2, 8), hp = hg.attributes.position;
    for (let k = 0; k < hp.count; k++) { let x = hp.getX(k), y = hp.getY(k), z = hp.getZ(k); const bow = Math.max(0, (z - 0.6) / 1.2), stern = Math.max(0, (-z - 1.4) / 0.4);
      x *= (1 - Math.pow(bow, 1.6) * 0.95) * (1 - stern * 0.15) * (y < 0 ? 0.55 : 1); y += Math.pow(bow, 2) * 0.22 * (y > 0 ? 1 : 0.4); hp.setXYZ(k, x, y, z); }
    hg.computeVertexNormals();
    const hull = new THREE.Mesh(hg, std(hullCols[i], { roughness: 0.35 })); hull.position.y = 0.25; hull.castShadow = true; b.add(hull);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.08, 2.4), std('#f6efe2', { roughness: 0.5 })); rim.position.set(0, 0.58, -0.5); b.add(rim);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 2.6), std('#b98b5d', { roughness: 0.8 })); deck.position.set(0, 0.5, -0.3); b.add(deck);
    if (i % 2 === 0) { const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.2, 8), std('#e9e1d2')); mast.position.set(0, 2.0, 0.3); b.add(mast);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), std('#fff7ea', { side: THREE.DoubleSide, roughness: 0.9 })); sail.position.set(0, 2.2, -0.25); sail.rotation.y = Math.PI / 2; b.add(sail); }
    else { const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), std('#fffaf0', { roughness: 0.5 })); cab.position.set(0, 0.7, -0.3); cab.castShadow = true; b.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.95), std(hullCols[(i + 2) % 5])); roof.position.set(0, 1.0, -0.3); b.add(roof); }
    H.boats.push({ b, ph: i * 1.7, y: -1.05, r });
  });
  // far shore: hills + a town of pastel houses climbing the slope + church spire
  const hillM = std('#6f9a72', { roughness: 1 }); H.hillM = hillM;
  for (const [x, z, sx, sy] of [[-40, -105, 50, 12], [12, -112, 60, 15], [62, -100, 44, 10], [-85, -95, 40, 9], [-10, -140, 90, 24]]) {
    const h = add(G, new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hillM), x, -1, z); h.scale.set(sx, sy, sx * 0.35);
  }
  const houseCols = ['#f6c6d0', '#fff1cf', '#bfe3e8', '#c9b6ec', '#ffd9b0', '#cfe8c2', '#f9e3ea', '#b8d4f3'];
  const hb = [], hr = [], hw = [];
  for (let i = 0; i < 46; i++) {
    const x = -70 + i * 3.2 + rnd() * 1.2, base = Math.max(0, 9 - Math.abs(x - 6) * 0.16) * (0.5 + rnd() * 0.5), z = -92 + rnd() * 8 - base * 0.4;
    const w = 2.3 + rnd() * 0.9, h = 2.4 + rnd() * 1.8, d = 2.1;
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, base + h / 2 - 1, z); const c = new THREE.Color(houseCols[i % houseCols.length]);
    const cc = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < cc.length; k += 3) { cc[k] = c.r; cc[k + 1] = c.g; cc[k + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); hb.push(g);
    const r = new THREE.CylinderGeometry(0.01, (w + 0.3) * 0.72, 0.9, 4, 1); r.rotateY(Math.PI / 4); r.scale(1, 1, d / w); r.translate(x, base + h - 1 + 0.45, z); const rc = new THREE.Color(['#b4574b', '#5c6a8a', '#8b5e4a'][i % 3]);
    const rr = new Float32Array(r.attributes.position.count * 3); for (let k = 0; k < rr.length; k += 3) { rr[k] = rc.r; rr[k + 1] = rc.g; rr[k + 2] = rc.b; } r.setAttribute('color', new THREE.BufferAttribute(rr, 3)); hr.push(r);
    for (let k = 0; k < 2; k++) { const wg = new THREE.PlaneGeometry(0.5, 0.58); wg.translate(x - w * 0.22 + k * w * 0.44, base + h * 0.55 - 1, z + d / 2 + 0.01); hw.push(wg); }
  }
  const townM = std('#ffffff', { vertexColors: true, roughness: 0.85 }); H.townM = townM; const town = add(G, new THREE.Mesh(mergeGeometries([...hb, ...hr]), townM));
  const winM = new THREE.MeshStandardMaterial({ color: '#3a4152', emissive: '#ffc977', emissiveIntensity: 0 }); H.winM = winM;
  add(G, new THREE.Mesh(mergeGeometries(hw), winM));
  const spire = add(G, new THREE.Group(), 16, 5, -98); spire.scale.setScalar(1.5);
  add(spire, new THREE.Mesh(new THREE.BoxGeometry(2, 5, 2), std('#efe8dc')), 0, 2.5, 0); add(spire, new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 4), std('#5c6a8a')), 0, 7, 0).rotation.y = Math.PI / 4;
  // the lighthouse on its rocky point
  const LH = add(G, new THREE.Group(), -5.5, -1, -82); LH.scale.setScalar(1.15); H.lh = LH;
  const rockM = std('#8b8f97', { roughness: 0.95, flatShading: true });
  for (let i = 0; i < 14; i++) { const r = add(LH, new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rnd() * 1.6, 0), rockM), (rnd() - 0.5) * 9, rnd() * 0.8, (rnd() - 0.5) * 6); r.rotation.set(rnd() * 3, rnd() * 3, 0); r.scale.y = 0.6; }
  add(LH, new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 1.6, 20), std('#6d8a60', { roughness: 1 })), 0, 1.2, 0);
  const bandT = tex(64, 512, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#d9443d' : '#fbf6ee'; x.fillRect(0, i * h / 8, w, h / 8); } });
  const towerPts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; towerPts.push(new THREE.Vector2(1.25 - t * 0.42, t * 10)); }
  const tower = add(LH, new THREE.Mesh(new THREE.LatheGeometry(towerPts, 28), std('#ffffff', { map: bandT, roughness: 0.55 })), 0, 2, 0); tower.castShadow = true;
  add(LH, new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.22, 28), std('#2b2f3a', { metalness: 0.5, roughness: 0.4 })), 0, 12.1, 0);
  const lampM = new THREE.MeshStandardMaterial({ color: '#2a3446', emissive: '#ffd27a', emissiveIntensity: 0.05, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 }); H.lampM = lampM;
  add(LH, new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.2, 20), lampM), 0, 12.8, 0);
  add(LH, new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#c0392b', { roughness: 0.4, metalness: 0.3 })), 0, 13.4, 0);
  add(LH, new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), std('#2b2f3a')), 0, 14.3, 0);
  const cot = add(LH, new THREE.Group(), 2.3, 2, 0.6);
  add(cot, new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), std('#fbf6ee')), 0, 0.7, 0).castShadow = true;
  add(cot, new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.7, 1.1, 4), std('#c0392b')), 0, 1.95, 0).rotation.y = Math.PI / 4;
  H.lampGlow = glow(LH, '#ffd27a', 7, 0, 12.8, 0, 0); H.lampGlow.material.opacity = 0;
  const beamM = new THREE.MeshBasicMaterial({ map: tex(256, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,230,170,.9)'); g.addColorStop(1, 'rgba(255,230,170,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); const g2 = x.createLinearGradient(0, 0, 0, h); }), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = add(LH, new THREE.Group(), 0, 12.8, 0); H.beam = beam; H.beamM = beamM;
  const beamT = tex(256, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.35, 'rgba(255,226,170,.45)'); g.addColorStop(1, 'rgba(255,226,170,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in'; const v = x.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, w, h); });
  beamM.map = beamT;
  for (const s of [0, Math.PI]) for (const r of [0, Math.PI / 2]) { const g = new THREE.PlaneGeometry(60, 7); g.translate(30, 0, 0); const m = new THREE.Mesh(g, beamM); m.rotation.set(r, s, 0, 'YXZ'); beam.add(m); }
  // near-side dressing: lamp posts, bench, crates, flowers, the Gull & Kettle's purple front with its awning
  H.lamps = [];
  for (const [x, z] of [[-4.6, -0.9], [5.4, -0.9], [-10.5, -0.9]]) { place(G, 'h30', 3.1, x, 0, z, 0); H.lamps.push(glow(G, '#ffcf80', 0.9, x, 2.9, z, 0)); }
  place(G, 'h22', 1.7, -2.6, 0, 2.6, 0.1);
  place(G, 'm11', 0.62, 6.6, 0, -0.2, 0.3); place(G, 'm11', 0.62, 7.25, 0, 0.3, -0.2); place(G, 'm11', 0.55, 6.85, 0.62, 0.05, 0.6);
  place(G, 'h27', 1.25, -6.2, 0, 1.6, 0.4); place(G, 'h27', 1.0, 8.3, 0, 2.2, 1.2);
  const shop = add(G, new THREE.Group(), 10.5, 0, 4.2); shop.rotation.y = -0.65;
  add(shop, new THREE.Mesh(new THREE.BoxGeometry(5, 4.4, 3), std('#a77bd8', { roughness: 0.7 })), 0, 2.2, 0).castShadow = true;
  add(shop, new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.9, 1.8, 4), std('#5c3f8a', { roughness: 0.6 })), 0, 5.3, 0).rotation.y = Math.PI / 4;
  const shopWin = new THREE.MeshStandardMaterial({ color: '#433152', emissive: '#ffcf8a', emissiveIntensity: 0.2 }); H.shopWin = shopWin;
  add(shop, new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), shopWin), -1.2, 1.9, 1.51); add(shop, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), std('#3d2b55')), 1.1, 1.0, 1.51);
  place(shop, 'f18', 2.6, -1.1, 2.4, 1.85, 0, false);
  // festival: bunting + string lights + hanging lanterns; launch: floating lanterns on the water
  const fest = add(G, new THREE.Group()); H.fest = fest;
  const flagCols = ['#ff6f86', '#ffd166', '#5ec6c1', '#a77bff', '#ffffff', '#ff9f5a'], flags = [], bulbs = [];
  const strings = [[[-10.5, 3.0, -0.9], [-4.6, 3.0, -0.9]], [[-4.6, 3.0, -0.9], [5.4, 3.0, -0.9]], [[5.4, 3.0, -0.9], [10.0, 4.4, 2.6]], [[-4.6, 3.0, -0.9], [-9, 4.2, -9]], [[5.4, 3.0, -0.9], [3.6, 2.6, -8]]];
  for (const [a, b] of strings) {
    const A = V(...a), Bv = V(...b), n = Math.round(A.distanceTo(Bv) / 0.45);
    for (let i = 1; i < n; i++) { const t = i / n, p = A.clone().lerp(Bv, t); p.y -= Math.sin(t * Math.PI) * 0.45; (i % 2 ? flags : bulbs).push({ p, c: flagCols[i % flagCols.length], dir: Bv.clone().sub(A).normalize() }); }
  }
  const fg = new THREE.BufferGeometry(); { const pos = [], col = []; for (const f of flags) { const s = V(-f.dir.z, 0, f.dir.x).multiplyScalar(0); const a = f.p.clone().addScaledVector(f.dir, -0.12), b = f.p.clone().addScaledVector(f.dir, 0.12), c = f.p.clone(); c.y -= 0.26; pos.push(...a.toArray(), ...b.toArray(), ...c.toArray()); const cc = new THREE.Color(f.c); for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b); }
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fg.computeVertexNormals(); }
  add(fest, new THREE.Mesh(fg, std('#ffffff', { vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 })));
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffcf6a', emissiveIntensity: 2.2 }); H.bulbM = bulbM;
  const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulbM, bulbs.length); bulbs.forEach((b, i) => bi.setMatrixAt(i, new THREE.Matrix4().makeTranslation(b.p.x, b.p.y, b.p.z))); fest.add(bi);
  H.hung = [];
  for (const [x, y, z, s] of [[-2.2, 2.62, -0.9, 0.4], [2.6, 2.6, -0.9, 0.38], [-7.6, 2.6, -0.9, 0.4], [0.2, 2.58, -0.9, 0.34], [8.2, 3.5, 1.4, 0.42], [-9.5, 3.6, -5, 0.4]]) {
    const l = place(fest, 'z08', s, x, y - s, z, rnd() * 3, false); H.hung.push({ l, ph: rnd() * 6, y: y - s });
  }
  // the stall (festival afternoon): two café tables, cakes, a tea stand
  const stall = add(G, new THREE.Group()); H.stall = stall;
  place(stall, 'f12', 1.25, -2.7, 0, 0.4, 0.2); place(stall, 'g11', 0.55, -2.75, 0.74, 0.35, 0.4, false); place(stall, 'g13', 0.18, -2.35, 0.74, 0.62, 0, false); place(stall, 'f17', 0.2, -3.1, 0.74, 0.7, 0.5, false);
  // floating lanterns (launch): instanced cubes with a glow each
  const N = 70; H.floatN = N; H.floats = [];
  const flM = new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ff9a3c', emissiveIntensity: 2.4, roughness: 0.6 });
  const fl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), flM, N); H.flI = fl;
  const flGlowG = new THREE.BufferGeometry(), gp = new Float32Array(N * 3); flGlowG.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  const flGlow = new THREE.Points(flGlowG, new THREE.PointsMaterial({ map: SOFT, color: '#ffb35c', size: 1.6, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })); H.flGlow = flGlow;
  for (let i = 0; i < N; i++) H.floats.push({ x: (rnd() - 0.5) * 50, z: -3 - rnd() * 40, ph: rnd() * 6, sp: 0.1 + rnd() * 0.2, rise: i < 14 ? 0.2 + rnd() * 0.3 : 0, y0: i < 14 ? rnd() * 12 : 0 });
  const launch = add(G, new THREE.Group()); launch.add(fl, flGlow); H.launch = launch;
  // stars + moon (night)
  const starG = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 500; i++) { const a = rnd() * Math.PI - Math.PI, e = 0.05 + rnd() * 0.9; sp.push(Math.cos(a) * 180 * Math.cos(e), 180 * Math.sin(e) - 10, Math.sin(a) * 180 * Math.cos(e)); }
  starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = add(G, new THREE.Points(starG, new THREE.PointsMaterial({ color: '#fff7e0', size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false })));
  const moon = glow(G, '#fff2d6', 14, 30, 40, -150, 0.9); const moonDisc = add(G, new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: '#fff6e2' })), 30, 40, -151);
  const sunDisc = glow(G, '#ffd9a0', 40, -26, 6, -160, 0.95);
  const VAR = {
    dusk: { sky: [[0, '#5d6ab4'], [0.45, '#e98aa0'], [0.7, '#ffc58a'], [1, '#ffe2b8']], fog: '#f2b7a3', fogD: 0.0075, hemi: ['#ffd7c4', '#4d5b7a', 1.05], sun: ['#ffb27a', 2.2, [-22, 9, -40]], water: '#3b7891', hill: '#8a9a7c', town: '#ffe6dc', exp: 1.0, lamps: 0.55, wins: 0.55, lamp: 0, stars: 0.15, moon: 0, sunD: 1, glit: 0.9 },
    afternoon: { sky: [[0, '#5fa8e8'], [0.55, '#a9d8f2'], [1, '#e9f6f7']], fog: '#cfe7ee', fogD: 0.006, hemi: ['#fff8ec', '#7d8f7a', 1.25], sun: ['#fff1dc', 2.6, [12, 18, 10]], water: '#2f8ea8', exp: 1.0, lamps: 0, wins: 0, lamp: 0, stars: 0, moon: 0, sunD: 0, glit: 0.35 },
    night: { sky: [[0, '#0d1433'], [0.6, '#24325f'], [1, '#4f5b8a']], fog: '#2a3561', fogD: 0.0085, hemi: ['#8ea0dc', '#141a2c', 0.55], sun: ['#a9bcff', 0.8, [20, 25, -30]], water: '#1b3550', hill: '#304a55', town: '#7d84a8', exp: 1.08, lamps: 1, wins: 1.6, lamp: 0, stars: 1, moon: 1, sunD: 0, glit: 0.2 },
  };
  VAR.festival = { ...VAR.afternoon, sky: [[0, '#6aaee8'], [0.6, '#bfe2f4'], [1, '#fff1df']], fest: true };
  VAR.stall = { ...VAR.festival, sun: ['#ffe6c4', 2.5, [14, 12, 8]], stall: true };
  VAR.launch = { ...VAR.night, fest: true, launch: true, lamps: 1, hemi: ['#9fb0e8', '#2a1f2c', 0.7] };
  H.est = { pos: V(-0.4, 2.6, 9.6), look: V(-2.2, 2.1, -10), fov: 40 };
  H.marks = { L: V(-0.8, 0, 0.2), R: V(0.8, 0, 0.2), C: V(0, 0, 0.4), LL: V(-2.0, 0, 0.9), RR: V(2.0, 0, 0.9) };
  H.lightView = { pos: V(-1.2, 2.1, 3.6), look: V(-5.5, 10, -82), fov: 38 };
  H.lobby = { pos: V(0.2, 1.85, 6.6), look: V(-1.2, 2.1, -6), fov: 40 };
  H.set = v => {
    const c = VAR[v] || VAR.dusk; H.v = c;
    H.bg = skyTex(c.sky); H.fog = new THREE.FogExp2(c.fog, c.fogD); H.hemi = c.hemi; H.sun = c.sun; H.exp = c.exp;
    waterM.color.set(c.water); hillM.color.set(c.hill || '#7da57c'); townM.color.set(c.town || '#ffffff'); winM.emissiveIntensity = c.wins; shopWin.emissiveIntensity = 0.2 + c.wins * 0.8;
    H.lamps.forEach(l => l.material.opacity = c.lamps); stars.material.opacity = c.stars; moon.visible = moonDisc.visible = !!c.moon; sunDisc.visible = !!c.sunD;
    glit.material.opacity = c.glit; glit.position.x = c.moon ? 20 : -6; glit.rotation.z = c.moon ? -0.12 : 0.06;
    fest.visible = !!c.fest; stall.visible = !!c.stall; launch.visible = !!c.launch; bulbM.emissiveIntensity = c.lamps ? 2.6 : 0.6;
    H.setLight(0);
  };
  H.light = 0;
  H.setLight = k => { H.light = k; lampM.emissiveIntensity = 0.05 + k * 4; H.lampGlow.material.opacity = k * 0.9; beamM.opacity = k * 0.55; };
  H.update = (dt, t) => {
    nrm.offset.x = t * 0.004; nrm.offset.y = t * 0.006;
    for (const b of H.boats) { b.b.position.y = b.y + Math.sin(t * 1.1 + b.ph) * 0.05; b.b.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.04; b.b.rotation.x = Math.sin(t * 0.7 + b.ph) * 0.02; }
    for (const h of H.hung) { h.l.rotation.z = Math.sin(t * 1.2 + h.ph) * 0.06; h.l.position.y = h.y + Math.sin(t * 1.4 + h.ph) * 0.02; }
    if (launch.visible) {
      const m = new THREE.Matrix4(), a = flGlow.geometry.attributes.position;
      H.floats.forEach((f, i) => { const y = f.rise ? -0.6 + ((f.y0 + t * f.rise) % 14) : -0.78 + Math.sin(t * 1.3 + f.ph) * 0.04; const x = f.x + Math.sin(t * 0.1 + f.ph) * 1.5 + t * f.sp * 0.1 % 4, z = f.z;
        m.makeTranslation(x, y, z); fl.setMatrixAt(i, m); a.setXYZ(i, x, y + 0.1, z); });
      fl.instanceMatrix.needsUpdate = true; a.needsUpdate = true;
    }
    beam.rotation.y = -t * 0.9;
  };
  return H;
}

// ------------------------------------------------------------------------------ interiors: shared room shell
function room(G, { w = 9.4, d = 9, h = 3.8, floor, wall, wain, trim, ceiling = '#f7efe4' }) {
  const fl = add(G, new THREE.Mesh(new THREE.PlaneGeometry(w, d), floor), 0, 0, d / 2 - 4); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
  const back = add(G, new THREE.Mesh(new THREE.PlaneGeometry(w, h), wall), 0, h / 2, -4); back.receiveShadow = true;
  for (const s of [-1, 1]) { const sw = add(G, new THREE.Mesh(new THREE.PlaneGeometry(d, h), wall), s * w / 2, h / 2, d / 2 - 4); sw.rotation.y = -s * Math.PI / 2; sw.receiveShadow = true; }
  const ceil = add(G, new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(ceiling, { roughness: 0.9 })), 0, h, d / 2 - 4); ceil.rotation.x = Math.PI / 2;
  // wainscot + dado rail + skirting on all three walls
  const wM = std(wain, { roughness: 0.55 }), tM = std(trim, { roughness: 0.4 });
  add(G, new THREE.Mesh(new THREE.BoxGeometry(w, 1.05, 0.06), wM), 0, 0.525, -3.97);
  add(G, new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.12), tM), 0, 1.07, -3.94);
  add(G, new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.1), tM), 0, 0.07, -3.95);
  const pan = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.6, 0.03), std(wain, { roughness: 0.45 }), 12); { const m = new THREE.Matrix4(); for (let i = 0; i < 12; i++) { m.makeTranslation(-w / 2 + 0.45 + i * (w - 0.9) / 11, 0.55, -3.92); pan.setMatrixAt(i, m); } } G.add(pan);
  for (const s of [-1, 1]) { const a = add(G, new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, d), wM), s * (w / 2 - 0.03), 0.525, d / 2 - 4); const b = add(G, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, d), tM), s * (w / 2 - 0.06), 1.07, d / 2 - 4); }
  // crown moulding
  add(G, new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.16), tM), 0, h - 0.08, -3.92);
}
function paintView(x, w, h, kind) {
  // the sea view through a window, painted: sky, sea, the far town and the lighthouse
  const night = kind === 'night', eve = kind === 'evening';
  const g = x.createLinearGradient(0, 0, 0, h * 0.62);
  if (night) { g.addColorStop(0, '#111a3d'); g.addColorStop(1, '#3b4a7e'); } else if (eve) { g.addColorStop(0, '#6b6fb8'); g.addColorStop(0.6, '#f19aa5'); g.addColorStop(1, '#ffd29c'); } else { g.addColorStop(0, '#7cbcf0'); g.addColorStop(1, '#e8f6fb'); }
  x.fillStyle = g; x.fillRect(0, 0, w, h * 0.62);
  if (night) { x.fillStyle = '#fff6dc'; for (let i = 0; i < 60; i++) x.fillRect(rnd() * w, rnd() * h * 0.5, 1.5, 1.5); x.beginPath(); x.arc(w * 0.8, h * 0.16, 14, 0, 7); x.fill(); }
  const sg = x.createLinearGradient(0, h * 0.6, 0, h); sg.addColorStop(0, night ? '#22385a' : eve ? '#8a7ca8' : '#4aa3bd'); sg.addColorStop(1, night ? '#101c30' : eve ? '#4c5b86' : '#2b7891'); x.fillStyle = sg; x.fillRect(0, h * 0.6, w, h * 0.4);
  x.fillStyle = night ? '#2b3a5c' : '#7aa686'; x.beginPath(); x.moveTo(0, h * 0.62); x.quadraticCurveTo(w * 0.3, h * 0.48, w * 0.62, h * 0.6); x.lineTo(w * 0.62, h * 0.62); x.fill();
  // lighthouse
  const lx = w * 0.24, base = h * 0.6; x.fillStyle = night ? '#d7d3e6' : '#fbf6ee'; x.beginPath(); x.moveTo(lx - 9, base); x.lineTo(lx - 6, base - 70); x.lineTo(lx + 6, base - 70); x.lineTo(lx + 9, base); x.fill();
  x.fillStyle = '#d9443d'; for (let i = 0; i < 3; i++) x.fillRect(lx - 8 + i, base - 20 - i * 22, 16 - i * 2, 9);
  x.fillStyle = '#2b2f3a'; x.fillRect(lx - 8, base - 76, 16, 6); x.fillStyle = '#c0392b'; x.beginPath(); x.arc(lx, base - 76, 7, Math.PI, 0); x.fill();
  // boats + sparkles
  for (let i = 0; i < 4; i++) { const bx = w * (0.45 + i * 0.12), by = h * (0.72 + (i % 2) * 0.08); x.fillStyle = ['#e8584f', '#f4c542', '#fff', '#2bb3c0'][i]; x.beginPath(); x.ellipse(bx, by, 16, 5, 0, 0, Math.PI); x.fill(); x.fillStyle = '#fff7ea'; x.beginPath(); x.moveTo(bx, by - 2); x.lineTo(bx, by - 26); x.lineTo(bx + 12, by - 4); x.fill(); }
  x.fillStyle = night ? 'rgba(255,214,140,.5)' : 'rgba(255,255,255,.6)'; for (let i = 0; i < 70; i++) x.fillRect(rnd() * w, h * 0.62 + rnd() * h * 0.38, 4 + rnd() * 8, 1.4);
  if (night) { x.fillStyle = 'rgba(255,190,110,.9)'; for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(w * 0.35 + rnd() * w * 0.6, h * 0.66 + rnd() * h * 0.3, 2.5, 0, 7); x.fill(); } }
}

// ------------------------------------------------------------------------------ The Gull & Kettle
function tearoom() {
  const G = new THREE.Group(), H = { group: G, name: 'tearoom' };
  const floor = std('#ffffff', { map: plankTex([196, 146, 104], 10), roughness: 0.45 }); floor.map.wrapS = floor.map.wrapT = THREE.RepeatWrapping; floor.map.repeat.set(2.5, 2.2);
  const paper = tex(256, 256, (x, w, h) => { x.fillStyle = '#e9dcf6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e0d0f2' : '#efe5f9'; x.fillRect(i * 32, 0, 32, h); } x.fillStyle = 'rgba(167,123,216,.35)'; for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const cx = c * 64 + 32 + (r % 2) * 32, cy = r * 44 + 22; x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; x.ellipse(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5, 3, a, 0, 7); } x.fill(); } }, [5, 2]);
  room(G, { floor, wall: std('#ffffff', { map: paper, roughness: 0.85 }), wain: '#8a5fc4', trim: '#f6efe6' });
  // bay window onto the sea
  const view = tex(1024, 512, (x, w, h) => paintView(x, w, h, 'day')); H.view = view;
  const viewM = new THREE.MeshBasicMaterial({ map: view, toneMapped: false }); H.viewM = viewM;
  add(G, new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), viewM), 0, 2.15, -3.95);
  const frameM = std('#fbf6ee', { roughness: 0.4 });
  for (const x of [-2.1, -0.7, 0.7, 2.1]) add(G, new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.14), frameM), x, 2.15, -3.9);
  for (const y of [1.08, 2.15, 3.22]) add(G, new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.1, 0.14), frameM), 0, y, -3.9);
  add(G, new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.45), frameM), 0, 1.06, -3.75);
  // light shaft from the window
  const shaft = add(G, new THREE.Mesh(new THREE.PlaneGeometry(4, 5), new THREE.MeshBasicMaterial({ map: tex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,244,220,.32)'); g.addColorStop(1, 'rgba(255,244,220,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), 0.4, 1.5, -2.2);
  shaft.rotation.set(-1.0, 0, 0.1); H.shaft = shaft;
  // counter (right-back), espresso, register, cakes; chalkboard; shelves of jars (left)
  place(G, 'f11', 2.6, 3.2, 0, -2.7, -0.15);
  place(G, 'f10', 0.55, 2.55, 1.05, -2.95, 0.3, false); place(G, 'f14', 0.48, 4.0, 1.05, -2.75, -0.5, false);
  place(G, 'f13', 1.25, -3.6, 0, -2.2, 0.7);
  const shelfM = std('#f6efe6', { roughness: 0.5 });
  for (const y of [1.65, 2.25, 2.85]) add(G, new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 3.2), shelfM), -4.52, y, 0.2);
  const jarCols = ['#ffd166', '#ff9fb2', '#9fe3d0', '#c9b6ec', '#ffb38a', '#b5d99c'];
  const jars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12), std('#ffffff', { roughness: 0.15, transparent: true, opacity: 0.92 }), 30);
  { const m = new THREE.Matrix4(); let i = 0; for (const y of [1.65, 2.25, 2.85]) for (let k = 0; k < 10; k++) { m.makeTranslation(-4.45, y + 0.15, -1.2 + k * 0.3); jars.setMatrixAt(i, m); jars.setColorAt(i, new THREE.Color(jarCols[(i * 7) % jarCols.length])); i++; } } G.add(jars);
  place(G, 'g10', 0.32, -4.45, 2.85 + 0.03, 1.55, 1.2, false);
  place(G, 'h16', 1.1, -4.5, 2.35, 2.6, Math.PI / 2, false);
  // tables with tea things
  place(G, 'f12', 1.3, -2.4, 0, -1.3, 0.3); place(G, 'g09', 0.2, -2.55, 0.76, -1.2, 0, false); place(G, 'g11', 0.5, -2.2, 0.76, -1.45, 0.6, false);
  place(G, 'f12', 1.3, 2.6, 0, 1.7, -0.4); place(G, 'g13', 0.17, 2.45, 0.76, 1.65, 0, false); place(G, 'f17', 0.2, 2.8, 0.76, 1.8, 0.4, false); place(G, 'g09', 0.2, 2.6, 0.76, 1.45, 1, false);
  place(G, 'h05', 1.3, 4.1, 0, 0.6, 0.5); place(G, 'h04', 1.85, -4.0, 0, 1.6, 0);
  // pendant lamps
  H.bulbs = [];
  const shadeM = std('#f4c542', { roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }), bulbM = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffd08a', emissiveIntensity: 2.4 });
  for (const [x, z] of [[-2.4, -1.3], [0, 0.4], [2.6, 1.7]]) {
    add(G, new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), std('#333')), x, 3.2, z);
    add(G, new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 24, 1, true), shadeM), x, 2.55, z);
    add(G, new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bulbM), x, 2.45, z); H.bulbs.push(glow(G, '#ffd08a', 1.4, x, 2.4, z, 0.5));
  }
  H.est = { pos: V(2.8, 2.5, 5.6), look: V(-0.6, 1.1, -1.8), fov: 52 };
  H.marks = { L: V(-0.75, 0, 0.7), R: V(0.75, 0, 0.7), C: V(0, 0, 0.95), LL: V(-1.9, 0, 1.3), RR: V(1.9, 0, 1.3) };
  const VAR = { day: 'day', morning: 'day', festival: 'day', evening: 'evening', night: 'night' };
  H.set = v => {
    const k = VAR[v] || 'day'; paintView(view.userData.canvas.getContext('2d'), 1024, 512, k); view.needsUpdate = true;
    const night = k === 'night', eve = k === 'evening';
    H.bg = new THREE.Color(night ? '#1a1830' : '#f3e6d8'); H.fog = null; H.exp = night ? 0.98 : 1.0;
    H.hemi = night ? ['#ffd9b0', '#3a2a40', 0.75] : eve ? ['#ffe2cf', '#6a4a5e', 1.0] : ['#fff6ec', '#8a7060', 1.15];
    H.sun = night ? ['#ffcf9a', 1.1, [2, 6, 5]] : eve ? ['#ffb98a', 1.9, [-2, 5, -9]] : ['#fff1dc', 2.2, [-1.5, 6, -8]];
    shaft.visible = !night; H.bulbs.forEach(b => b.material.opacity = night ? 0.9 : 0.4); bulbM.emissiveIntensity = night ? 3 : 1.8;
  };
  H.update = () => {};
  return H;
}

// ------------------------------------------------------------------------------ Marsh & Margins
function bookshop() {
  const G = new THREE.Group(), H = { group: G, name: 'bookshop' };
  const floor = std('#ffffff', { map: plankTex([150, 102, 70], 10), roughness: 0.55 }); floor.map.wrapS = floor.map.wrapT = THREE.RepeatWrapping; floor.map.repeat.set(2.5, 2.2);
  const paper = tex(256, 256, (x, w, h) => { x.fillStyle = '#2f4a45'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(220,190,120,.18)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(i * 26, 0); x.lineTo(i * 26, h); x.stroke(); } }, [6, 2]);
  room(G, { floor, wall: std('#ffffff', { map: paper, roughness: 0.9 }), wain: '#6b4630', trim: '#c9a46a', ceiling: '#efe2cc' });
  // round window high on the back wall
  const view = tex(512, 512, (x, w, h) => paintView(x, w, h, 'day')); H.view = view;
  const rw = add(G, new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), new THREE.MeshBasicMaterial({ map: view, toneMapped: false })), 0, 2.6, -3.95);
  const ring = add(G, new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 10, 48), std('#c9a46a', { metalness: 0.6, roughness: 0.3 })), 0, 2.6, -3.9);
  for (const r of [0, Math.PI / 2]) { const b = add(G, new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.05), std('#c9a46a')), 0, 2.6, -3.9); b.rotation.z = r; }
  // shelves: a wall of them
  for (const [x, z, r] of [[-3.2, -3.55, 0], [-1.6, -3.55, 0], [1.6, -3.55, 0], [3.2, -3.55, 0], [-4.35, -1.6, Math.PI / 2], [-4.35, 0.2, Math.PI / 2], [4.35, -1.6, -Math.PI / 2], [4.35, 0.2, -Math.PI / 2]]) place(G, 'h07', 2.35, x, 0, z, r);
  // book stacks on the floor (instanced)
  const bookCols = ['#c0392b', '#2e86ab', '#f4c542', '#5e548e', '#2a9d8f', '#e76f51', '#f6efe6', '#264653'];
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.06, 0.25), std('#ffffff', { roughness: 0.7 }), 40);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let i = 0;
    for (const [sx, sz, n] of [[-2.6, 1.6, 9], [-2.15, 1.9, 6], [2.5, -0.9, 8], [3.0, 2.2, 10], [-1.0, -2.6, 7]]) for (let k = 0; k < n && i < 40; k++) { e.set(0, (rnd() - 0.5) * 0.6, 0); q.setFromEuler(e); m.compose(V(sx + (rnd() - 0.5) * 0.04, 0.03 + k * 0.062, sz), q, V(1, 1, 1)); books.setMatrixAt(i, m); books.setColorAt(i, new THREE.Color(bookCols[i % bookCols.length])); i++; }
    books.count = i; } books.castShadow = true; G.add(books);
  place(G, 'h08', 3.0, 0, 0.005, 0.6, 0, false);
  place(G, 'h01', 2.2, -2.7, 0, -1.6, 0.35); place(G, 'h02', 1.25, 2.8, 0, -1.2, -0.6);
  place(G, 'h10', 2.1, 3.95, 0, 1.8, -Math.PI / 2 + 0.2); place(G, 'h04', 1.85, -3.9, 0, 1.6, 0);
  // candles on a little table
  add(G, new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 24), std('#6b4630', { roughness: 0.4 })), 1.6, 0.55, 2.1); add(G, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.55, 10), std('#6b4630')), 1.6, 0.27, 2.1);
  place(G, 't27', 0.2, 1.5, 0.58, 2.1, 0, false); place(G, 't27', 0.16, 1.72, 0.58, 2.2, 0, false); H.candle = glow(G, '#ffb35c', 0.9, 1.6, 0.85, 2.15, 0.6);
  // rolling ladder against the back shelves
  const lad = add(G, new THREE.Group(), -2.4, 0, -3.1); lad.rotation.x = -0.18;
  for (const s of [-1, 1]) add(lad, new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.3, 0.06), std('#8a5a3a', { roughness: 0.5 })), s * 0.25, 1.65, 0);
  for (let i = 0; i < 9; i++) add(lad, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), std('#8a5a3a')), 0, 0.3 + i * 0.35, 0).rotation.z = Math.PI / 2;
  // hanging bulbs
  H.bulbs = []; const bulbM = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffbf6a', emissiveIntensity: 2.6 });
  for (const [x, z, y] of [[-1.6, -0.6, 2.7], [0.2, 0.9, 2.85], [1.8, -0.3, 2.6]]) { add(G, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.8 - y, 4), std('#222')), x, (3.8 + y) / 2, z); add(G, new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), bulbM), x, y, z); H.bulbs.push(glow(G, '#ffbf6a', 1.6, x, y, z, 0.6)); }
  H.est = { pos: V(-2.4, 2.3, 5.4), look: V(0.5, 1.4, -2.2), fov: 52 };
  H.marks = { L: V(-0.75, 0, 0.75), R: V(0.75, 0, 0.75), C: V(0, 0, 1.0), LL: V(-1.9, 0, 1.3), RR: V(1.9, 0, 1.3) };
  H.set = v => {
    const k = v === 'night' ? 'night' : v === 'evening' ? 'evening' : 'day'; paintView(view.userData.canvas.getContext('2d'), 512, 512, k); view.needsUpdate = true;
    const dark = k !== 'day';
    H.bg = new THREE.Color('#1c1a22'); H.fog = null; H.exp = dark ? 1.02 : 1.0;
    H.hemi = dark ? ['#ffd2a0', '#2b2228', 0.8] : ['#fff1de', '#5a4636', 1.05];
    H.sun = dark ? ['#ffc58a', 1.3, [1.5, 5, 5]] : ['#fff1dc', 2.0, [-2, 6, 6]];
    bulbM.emissiveIntensity = dark ? 3.2 : 2; H.bulbs.forEach(b => b.material.opacity = dark ? 0.85 : 0.45);
  };
  H.update = (dt, t) => { H.candle.material.opacity = 0.5 + Math.sin(t * 9) * 0.06 + Math.sin(t * 13.7) * 0.05; };
  return H;
}

// ------------------------------------------------------------------------------ the lantern room
function lighthouse() {
  const G = new THREE.Group(), H = { group: G, name: 'lighthouse' };
  const R = 3.3;
  const ironT = tex(512, 512, (x, w, h) => { x.fillStyle = '#4a4f5c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.beginPath(); x.arc(w / 2, h / 2, 30 + i * 32, 0, 7); x.stroke(); } x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 160; i++) { const a = rnd() * 7, r = 40 + (i % 8) * 32; x.beginPath(); x.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2.5, 0, 7); x.fill(); } });
  const fl = add(G, new THREE.Mesh(new THREE.CircleGeometry(R, 48), std('#ffffff', { map: ironT, roughness: 0.55, metalness: 0.5 })), 0, 0, 0); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true;
  const para = add(G, new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.0, 48, 1, true), std('#f2ead9', { side: THREE.BackSide, roughness: 0.7 })), 0, 0.5, 0); para.receiveShadow = true;
  add(G, new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.07, 8, 64), std('#c9a46a', { metalness: 0.7, roughness: 0.3 })), 0, 1.0, 0).rotation.x = Math.PI / 2;
  // glass + mullions + dome
  const glass = add(G, new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2.6, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false })), 0, 2.3, 0);
  const mull = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 2.6, 0.09), std('#2b2f3a', { metalness: 0.6, roughness: 0.35 }), 16);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; q.setFromAxisAngle(V(0, 1, 0), -a); m.compose(V(Math.cos(a) * R, 2.3, Math.sin(a) * R), q, V(1, 1, 1)); mull.setMatrixAt(i, m); } } G.add(mull);
  add(G, new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 8, 64), std('#2b2f3a', { metalness: 0.6 })), 0, 3.6, 0).rotation.x = Math.PI / 2;
  add(G, new THREE.Mesh(new THREE.SphereGeometry(R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#b5523c', { side: THREE.BackSide, roughness: 0.45, metalness: 0.35 })), 0, 3.6, 0).scale.y = 0.5;
  // the empty pedestal + lens cradle
  const ped = add(G, new THREE.Group(), 0, 0, -0.9); H.ped = ped;
  add(ped, new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.0, 24), std('#3b404c', { metalness: 0.6, roughness: 0.35 })), 0, 0.5, 0).castShadow = true;
  add(ped, new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 8, 40), std('#d8b16a', { metalness: 0.8, roughness: 0.25 })), 0, 1.0, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const arm = add(ped, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), std('#d8b16a', { metalness: 0.8, roughness: 0.25 })), Math.cos(a) * 0.5, 1.3, Math.sin(a) * 0.5); arm.rotation.z = Math.cos(a) * 0.3; arm.rotation.x = -Math.sin(a) * 0.3; }
  // candles (lit at night) around the pedestal
  H.candles = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const x = Math.cos(a) * 0.95, z = -0.9 + Math.sin(a) * 0.95; place(G, 't27', 0.16 + (i % 3) * 0.03, x, 0, z, a, false); H.candles.push(glow(G, '#ffb35c', 0.8, x, 0.28, z, 0)); }
  // keeper's desk, chest, the teacup on the sill
  const desk = add(G, new THREE.Group(), 2.1, 0, 0.6); desk.rotation.y = -1.1;
  add(desk, new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), std('#7a4e30', { roughness: 0.5 })), 0, 0.78, 0).castShadow = true;
  for (const [x, z] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]]) add(desk, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), std('#6a4028')), x, 0.39, z);
  add(desk, new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), std('#2e4a7a', { roughness: 0.8 })), -0.15, 0.84, 0);
  place(G, 'h21', 0.9, -2.3, 0, 0.3, 1.1);
  place(G, 'g09', 0.18, -1.6, 1.0, -2.75, 0.6, false);
  // the world outside: sea far below, far town lights, sky
  const sea = add(G, new THREE.Mesh(new THREE.PlaneGeometry(800, 800), std('#2c6b86', { roughness: 0.2 })), 0, -40, -200); sea.rotation.x = -Math.PI / 2; H.seaM = sea.material;
  const tl = new THREE.BufferGeometry(), tp = []; for (let i = 0; i < 160; i++) tp.push(-120 + rnd() * 260, -38 + rnd() * 10, -150 - rnd() * 40);
  tl.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); const townLights = add(G, new THREE.Points(tl, new THREE.PointsMaterial({ color: '#ffc977', size: 1.6, transparent: true, opacity: 0.9, depthWrite: false })));
  const starG = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 400; i++) { const a = rnd() * Math.PI * 2, e = 0.05 + rnd() * 1.2; sp.push(Math.cos(a) * 150 * Math.cos(e), 150 * Math.sin(e), Math.sin(a) * 150 * Math.cos(e)); }
  starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); const stars = add(G, new THREE.Points(starG, new THREE.PointsMaterial({ color: '#fff7e0', size: 0.8, transparent: true, opacity: 0.9, depthWrite: false })));
  H.glowC = glow(G, '#ffcf8a', 5, 0, 1.6, -0.9, 0);
  H.est = { pos: V(1.7, 2.1, 2.3), look: V(-0.9, 1.2, -1.3), fov: 60 };
  H.marks = { L: V(-0.8, 0, 0.75), R: V(0.8, 0, 0.75), C: V(0, 0, 0.9), LL: V(-1.7, 0, 0.5), RR: V(1.7, 0, 0.5) };
  H.set = v => {
    const night = v === 'night';
    H.bg = skyTex(night ? [[0, '#0b1230'], [0.6, '#1f2c58'], [1, '#3a4778']] : [[0, '#78b6ea'], [0.6, '#bfe3f5'], [1, '#f2f8f6']]); H.fog = new THREE.Fog(night ? '#24305a' : '#cfe7ee', 60, 260);
    H.exp = night ? 1.1 : 1.0;
    H.hemi = night ? ['#9fb0e8', '#3a2a24', 0.55] : ['#fff8ec', '#6a5a50', 1.15];
    H.sun = night ? ['#ffc37a', 1.6, [0.3, 2.2, -0.6]] : ['#fff1dc', 2.4, [6, 9, 4]];
    H.candles.forEach(c => c.material.opacity = night ? 0.85 : 0); H.glowC.material.opacity = night ? 0.55 : 0; stars.visible = townLights.visible = night;
    H.seaM.color.set(night ? '#14263c' : '#2c7a96');
  };
  H.update = (dt, t) => { if (H.candles[0].material.opacity > 0) H.candles.forEach((c, i) => c.material.opacity = 0.75 + Math.sin(t * 11 + i * 2) * 0.1); };
  return H;
}
export const PROP_IDS = ['h30', 'h22', 'm11', 'f18', 'h27', 'z08', 'f11', 'f10', 'f12', 'f13', 'f14', 'g09', 'g10', 'g11', 'f17', 'h04', 'h05', 'h16', 'g13', 'h07', 'h01', 'h10', 't27', 'h08', 'h02', 'h21'];

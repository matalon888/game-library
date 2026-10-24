// Dumpling Dash — the restaurant room, counters and kitchen machines, built in code (glossy jelly pastel) around the
// kawaii AI 3D props in assets/. One builder, themed per restaurant.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

export const ROOM = { backZ: -6.0, halfW: 4.6, aZ: -2.4, aH: 0.7, spotZ: -3.0, bZ: -0.2, bH: 0.88, cZ: 2.5, cH: 0.84, doorX: 0 };
export const KX = [-1.32, 0, 1.32];
export const FX = { 1: [0], 2: [-0.9, 0.9], 3: [-1.4, 0, 1.4], 4: [-1.62, -0.54, 0.54, 1.62] };
export const PLATE_X = [-0.7, 0.7, -1.95, 1.95, 0];

const JC = new Map();
export const jelly = (color, o = {}) => {   // cached: the same look shares one material (and merges into one draw call)
  const k = String(color) + JSON.stringify(o, (n, v) => (v && v.isTexture ? v.uuid : v));
  if (!JC.has(k)) JC.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18, ...o }));
  return JC.get(k);
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...o });
export function canvasTex(w, h, draw, rep = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
export const rbox = (w, h, d, r = 0.06, s = 4) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
function heart(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s * 1.1, cy - s * 0.35, cx - s * 0.45, cy - s * 1.05, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.45, cy - s * 1.05, cx + s * 1.1, cy - s * 0.35, cx, cy + s * 0.35); x.fill(); }
function star(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); }

export function buildWorld(scene, R, place) {
  const T = R.theme, G = new THREE.Group(); scene.add(G);
  const add = (geo, mat, x, y, z, parent = G, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const { backZ, halfW } = ROOM;

  // ---------------------------------------------------------------- textures
  const floorT = canvasTex(512, 512, (x, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = (i + j) % 2 ? T.floorA : T.floorB; x.fillRect(i * s, j * s, s, s);
      const g = x.createRadialGradient(i * s + s * 0.3, j * s + s * 0.3, 2, i * s + s * 0.5, j * s + s * 0.5, s * 0.75); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(i * s, j * s, s, s);
      if ((i + j) % 2 === 0) { x.fillStyle = 'rgba(255,255,255,.55)'; heart(x, i * s + s / 2, j * s + s / 2 + 6, 13); }
    }
    x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 4; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, w); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
  }, [5, 4]);
  const wallT = canvasTex(512, 512, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? T.wall2 : T.wall; x.fillRect(i * 64, 0, 64, h); }
    x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 8; i++) x.fillRect(i * 64 + 30, 0, 4, h);
    x.fillStyle = T.dots;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) { const cx = i * 64 + 32, cy = j * 86 + (i % 2 ? 43 : 0) + 20; x.globalAlpha = 0.85; if ((i + j) % 3 === 0) star(x, cx, cy, 9); else heart(x, cx, cy, 9); }
    x.globalAlpha = 1;
  }, [6, 1.2]);
  const panelT = canvasTex(512, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T.counter2); g.addColorStop(1, T.counter); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * 64 + 32, 0, 30, 0, Math.PI); x.fill(); }
    x.fillStyle = 'rgba(255,255,255,.65)'; for (let i = 0; i < 8; i++) heart(x, i * 64 + 32, 82, 11);
  }, [4, 1]);
  const topT = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = ['#ffb3d1', '#b8f0dc', '#d9c8ff', '#ffe9a3'][i % 4]; x.globalAlpha = 0.55; x.fillRect(Math.random() * w, Math.random() * h, 6, 2.4); } }, [4, 1]);

  // ---------------------------------------------------------------- room shell
  const floor = add(new THREE.PlaneGeometry(halfW * 2 + 4, 16), std(0xffffff, { map: floorT, roughness: 0.22 }), 0, 0, backZ + 8, G, false); floor.rotation.x = -Math.PI / 2;
  const wallMat = std(0xffffff, { map: wallT, roughness: 0.8 });
  add(new THREE.BoxGeometry(halfW * 2 + 4, 7, 0.2), wallMat, 0, 3.5, backZ - 0.1, G, false);
  for (const s of [-1, 1]) { const m = add(new THREE.PlaneGeometry(12, 7), wallMat, s * (halfW + 1.2), 3.5, backZ + 6, G, false); m.rotation.y = -s * Math.PI / 2; }
  const wains = jelly(new THREE.Color(T.trim).lerp(new THREE.Color('#ffffff'), 0.55));
  add(rbox(halfW * 2 + 4, 1.1, 0.12, 0.04), wains, 0, 0.55, backZ + 0.06, G, false);
  add(rbox(halfW * 2 + 4, 0.12, 0.2, 0.05), jelly(T.trim), 0, 1.12, backZ + 0.1);

  // door with a cloud window + sign
  const DX = ROOM.doorX;
  const frame = jelly('#ffffff');
  add(rbox(1.8, 2.95, 0.22, 0.12), frame, DX, 1.47, backZ + 0.1);
  add(rbox(1.46, 2.7, 0.12, 0.1), jelly(T.accent), DX, 1.37, backZ + 0.18);
  const skyT = canvasTex(128, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9ad8ff'); g.addColorStop(0.55, '#ffd1ec'); g.addColorStop(1, '#fff3c9'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, cy, r] of [[30, 70, 18], [52, 64, 22], [76, 72, 16], [90, 150, 14], [108, 146, 18]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } x.fillStyle = '#fffbe0'; star(x, 96, 30, 9); star(x, 22, 130, 6); });
  const skyMat = new THREE.MeshBasicMaterial({ map: skyT });
  { const m = add(new THREE.CircleGeometry(0.48, 32), skyMat, DX, 1.95, backZ + 0.25, G, false); m.scale.y = 1.25; }
  add(new THREE.TorusGeometry(0.5, 0.06, 10, 36), frame, DX, 1.95, backZ + 0.26).scale.y = 1.25;
  add(new THREE.SphereGeometry(0.07, 14, 10), jelly('#ffd36a', { metalness: 0.3 }), DX + 0.5, 1.15, backZ + 0.28);
  // windows either side
  for (const wx of [-2.75, 2.75]) {
    add(rbox(1.7, 1.9, 0.18, 0.5), frame, wx, 2.5, backZ + 0.08);
    const m = add(new THREE.PlaneGeometry(1.45, 1.66), skyMat, wx, 2.5, backZ + 0.18, G, false); void m;
    add(rbox(0.07, 1.66, 0.06, 0.03), frame, wx, 2.5, backZ + 0.2); add(rbox(1.45, 0.07, 0.06, 0.03), frame, wx, 2.5, backZ + 0.2);
    // scalloped awning
    for (let k = 0; k < 6; k++) { const sc = add(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), jelly(k % 2 ? '#ffffff' : T.sign), wx - 0.72 + k * 0.29, 3.55, backZ + 0.32); sc.rotation.x = Math.PI; }
    add(rbox(1.9, 0.12, 0.42, 0.05), jelly(T.sign), wx, 3.58, backZ + 0.22);
    // window box with flowers
    add(rbox(1.5, 0.22, 0.32, 0.08), jelly(T.counter), wx, 1.45, backZ + 0.3);
    for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(0.1, 12, 10), jelly(['#ff8fbf', '#fff27a', '#b9a2ff', '#7fe0c4', '#ffb37a'][k]), wx - 0.56 + k * 0.28, 1.62, backZ + 0.32);
  }
  // restaurant sign above the door
  const nameT = canvasTex(1024, 300, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.beginPath();
    for (const [cx, cy, r] of [[180, 160, 120], [340, 110, 130], [520, 95, 140], [700, 110, 130], [860, 160, 120], [520, 190, 150], [300, 190, 110], [740, 190, 110]]) { x.moveTo(cx + r, cy); x.arc(cx, cy, r, 0, 7); }
    x.fill();
    x.font = '400 128px "Lilita One", "Fredoka", "Arial Rounded MT Bold", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 26; x.strokeStyle = '#ffffff'; x.strokeText(R.n, w / 2, h / 2 + 10);
    x.lineWidth = 12; x.strokeStyle = '#6b3b8f'; x.strokeText(R.n, w / 2, h / 2 + 10);
    const g = x.createLinearGradient(0, 80, 0, 220); g.addColorStop(0, '#ffffff'); g.addColorStop(0.15, T.sign); g.addColorStop(1, T.sign); x.fillStyle = g; x.fillText(R.n, w / 2, h / 2 + 10);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('', 0, 0);
    x.fillStyle = '#ffd84d'; star(x, 120, 70, 26); star(x, 920, 230, 22); x.fillStyle = '#ff8fbf'; heart(x, 930, 70, 26); heart(x, 110, 240, 20);
  });
  const sign = add(new THREE.PlaneGeometry(3.6, 1.05), new THREE.MeshStandardMaterial({ map: nameT, transparent: true, roughness: 0.5, emissive: 0xffffff, emissiveMap: nameT, emissiveIntensity: 0.15 }), DX, 3.75, backZ + 0.3, G, false);
  sign.castShadow = false;
  // bunting garland
  const flagCols = ['#ff8fbf', '#fff27a', '#9be7ff', '#c9a8ff', '#8ff0c8'];
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
    const x0 = s * (1.9 + k * 0.36), y0 = 4.7 - Math.sin((k + 0.5) / 7 * Math.PI) * 0.35;
    const tri = new THREE.Shape(); tri.moveTo(-0.13, 0); tri.lineTo(0.13, 0); tri.lineTo(0, -0.26); tri.closePath();
    const f = add(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), jelly(flagCols[(k + (s > 0 ? 2 : 0)) % 5]), x0, y0, backZ + 0.35, G, false); f.rotation.z = s * 0.06;
  }
  // hanging lanterns
  const bulbs = [];
  for (const lx of [-2.2, 2.2]) {
    const lz = ROOM.aZ - 0.3;
    add(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 6), std(0xffffff), lx, 5.6, lz, G, false);
    const b = add(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshPhysicalMaterial({ color: T.lamp, emissive: T.lamp, emissiveIntensity: 0.9, roughness: 0.25, clearcoat: 1 }), lx, 4.6, lz, G, false); b.scale.y = 0.85; b.userData.dyn = true; bulbs.push(b);
    add(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 18), jelly(T.trim), lx, 4.92, lz, G, false);
  }

  // ---------------------------------------------------------------- counter A (customers' side)
  const panel = std(0xffffff, { map: panelT, roughness: 0.35 });
  const topMat = jelly(new THREE.Color(T.counter2).lerp(new THREE.Color('#ffffff'), 0.35), { map: topT });
  const trim = jelly(T.trim);
  function counter(w, h, z, depth) {
    add(rbox(w, h - 0.1, depth, 0.08), panel, 0, (h - 0.1) / 2, z);
    add(rbox(w + 0.2, 0.12, depth + 0.22, 0.06), topMat, 0, h - 0.05, z);
    add(rbox(w + 0.1, 0.06, 0.08, 0.03), trim, 0, h - 0.14, z + depth / 2 + 0.06);
    add(rbox(w, 0.1, depth - 0.04, 0.04), jelly(T.trim), 0, 0.05, z + 0.02);
  }
  counter(6.6, ROOM.aH, ROOM.aZ, 0.72);
  const plates = PLATE_X.map(x => new THREE.Vector3(x, ROOM.aH, ROOM.aZ + 0.12));
  // napkin cup + tiny bell on the customer counter
  add(new THREE.CylinderGeometry(0.11, 0.09, 0.22, 18), jelly(T.accent), 3.1, ROOM.aH + 0.11, ROOM.aZ);
  add(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), jelly('#ffd36a', { metalness: 0.4, roughness: 0.2 }), -3.1, ROOM.aH, ROOM.aZ);

  // ---------------------------------------------------------------- counter B: cook row
  counter(6.2, ROOM.bH, ROOM.bZ, 0.95);
  const machines = {};
  R.kitchen.forEach((key, i) => { machines[key] = buildStation(key, KX[i], ROOM.bZ, ROOM.bH); });

  // ---------------------------------------------------------------- counter C: grabs + topping jars (nearest the camera)
  counter(6.0, ROOM.cH, ROOM.cZ, 0.8);
  const fx = FX[R.front.length], grabs = {}, jars = {};
  R.front.forEach((f, i) => {
    const [kind, id] = f.split(':'), x = fx[i], y = ROOM.cH, z = ROOM.cZ;
    if (kind === 'g') {   // a cake stand holding three of the item
      const g = new THREE.Group(); g.position.set(x, y, z); G.add(g);
      add(new THREE.CylinderGeometry(0.5, 0.42, 0.06, 32), jelly('#ffffff'), 0, 0.2, 0, g);
      add(new THREE.CylinderGeometry(0.06, 0.12, 0.2, 16), jelly(T.trim), 0, 0.1, 0, g);
      add(new THREE.CylinderGeometry(0.46, 0.46, 0.02, 32), jelly(T.counter2), 0, 0.235, 0, g, false);
      grabs[id] = { g, pos: new THREE.Vector3(x, y + 0.24, z), anchor: new THREE.Vector3(x, y + 0.5, z) };
    } else {               // a glass jar of the topping
      const g = new THREE.Group(); g.position.set(x, y, z); G.add(g);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 28), jelly(T.trim), 0, 0.025, 0, g);
      const glass = add(new THREE.CylinderGeometry(0.27, 0.27, 0.5, 28, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide, clearcoat: 1 }), 0, 0.3, 0, g, false); glass.userData.dyn = true;
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 28), jelly(id === 'str' ? '#ff6f9c' : id === 'egg' ? '#ffd36a' : '#a46b4e'), 0, 0.6, 0, g);
      add(new THREE.SphereGeometry(0.08, 14, 10), jelly('#ffffff'), 0, 0.68, 0, g);
      jars[id] = { g, pos: new THREE.Vector3(x, y + 0.3, z), anchor: new THREE.Vector3(x, y + 0.45, z), fill: [] };
    }
  });

  // ---------------------------------------------------------------- stations (code-built jelly machines + AI props)
  function buildStation(key, x, z, h) {
    const g = new THREE.Group(); g.position.set(x, h, z); G.add(g);
    const sl = (dx, dz) => [x + dx, z + dz];
    const S = { g, top: h, key };
    if (key === 'tap') {   // boba tap: pink box, two taps, big boba sign on top
      add(rbox(1.15, 0.62, 0.55, 0.14), jelly('#ffb3d9'), 0, 0.31, -0.18, g);
      add(rbox(1.0, 0.1, 0.5, 0.05), jelly('#ffffff'), 0, 0.66, -0.18, g);
      for (const tx of [-0.25, 0.25]) { add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), jelly('#c9a8ff'), tx, 0.42, 0.12, g).rotation.x = Math.PI / 2; add(new THREE.SphereGeometry(0.06, 12, 8), jelly('#ffffff'), tx, 0.4, 0.2, g); }
      S.sign = place('t01', { size: 0.55, pos: [0, 0.71, -0.2], parent: g });
      S.slots = [sl(-0.34, 0.33), sl(0.34, 0.33), sl(0, 0.50)];
    } else if (key === 'griddle' || key === 'board') {
      const isB = key === 'board';
      add(rbox(1.2, isB ? 0.08 : 0.16, 0.85, isB ? 0.04 : 0.07), jelly(isB ? '#ffe2c0' : '#c9f2e3'), 0, isB ? 0.04 : 0.08, 0, g);
      if (!isB) {
        const plate = add(rbox(1.08, 0.04, 0.72, 0.03), jelly('#ffb8d6', { roughness: 0.4 }), 0, 0.175, 0, g);
        void plate;
        for (const kx of [-0.36, 0, 0.36]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14), jelly('#ff7fb0'), kx, 0.08, 0.44, g).rotation.x = Math.PI / 2;
        S.heat = add(new THREE.PlaneGeometry(1.1, 0.66), new THREE.MeshBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.2, 0, g, false); S.heat.rotation.x = -Math.PI / 2;
      } else {
        add(rbox(0.9, 0.03, 0.08, 0.015), jelly('#ff8f8f'), 0.05, 0.1, -0.32, g);
        add(rbox(0.36, 0.05, 0.11, 0.03), jelly('#ffffff', { metalness: 0.6, roughness: 0.15 }), -0.38, 0.11, -0.32, g);
      }
      const y = isB ? 0.08 : 0.19;
      S.top = h + y; S.slots = [[x - 0.34, z - 0.04], [x + 0.34, z - 0.04], [x, z + 0.24]];
    } else if (key === 'swirl') {   // soft-serve machine: rounded tower + nozzle
      add(rbox(0.9, 0.95, 0.6, 0.2), jelly('#bfe9ff'), 0, 0.48, -0.2, g);
      add(rbox(0.7, 0.3, 0.06, 0.1), jelly('#ffffff'), 0, 0.68, 0.12, g);
      add(new THREE.ConeGeometry(0.09, 0.18, 14), jelly('#ff9fd0'), 0, 0.42, 0.2, g).rotation.x = Math.PI;
      S.sign = place('t08', { size: 0.45, pos: [0, 0.96, -0.2], parent: g });
      S.slots = [sl(-0.34, 0.34), sl(0.34, 0.34), sl(0, 0.52)];
    } else if (key === 'steam' || key === 'steam2') {   // bamboo steamer prop on a little stove
      add(rbox(1.15, 0.2, 0.75, 0.08), jelly(key === 'steam' ? '#ffd1e3' : '#fff0b0'), 0, 0.1, -0.05, g);
      S.sign = place('f06', { size: 0.72, pos: [0, 0.2, -0.12], parent: g });
      S.slots = [sl(-0.34, 0.34), sl(0.34, 0.34), sl(0, 0.52)];
    } else if (key === 'pour') {   // teapot on a warmer
      add(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 28), jelly('#ffffff'), 0, 0.07, -0.15, g);
      add(new THREE.TorusGeometry(0.3, 0.035, 8, 28), jelly('#ff9fd0'), 0, 0.15, -0.15, g).rotation.x = Math.PI / 2;
      S.sign = place('f09', { size: 0.62, pos: [0, 0.14, -0.15], parent: g });
      S.slots = [sl(-0.34, 0.32), sl(0.34, 0.32), sl(0, 0.52)];
    } else if (key === 'pot') {   // ramen pot on a burner
      add(rbox(1.1, 0.16, 0.8, 0.07), jelly('#ffe3a8'), 0, 0.08, -0.08, g);
      add(new THREE.TorusGeometry(0.28, 0.03, 8, 28), std(0xff7a3a, { emissive: 0xff5a2a, emissiveIntensity: 0.8 }), 0, 0.17, -0.12, g, false).rotation.x = Math.PI / 2;
      const pot = add(new THREE.CylinderGeometry(0.36, 0.32, 0.42, 30), jelly('#ff9fbf'), 0, 0.38, -0.12, g);
      add(new THREE.TorusGeometry(0.36, 0.035, 8, 30), jelly('#ffffff'), 0, 0.59, -0.12, g).rotation.x = Math.PI / 2;
      S.broth = add(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 28), jelly('#ffd78a'), 0, 0.56, -0.12, g, false);
      for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.07, 0.025, 8, 14, Math.PI), jelly('#ffffff'), s * 0.4, 0.5, -0.12, g).rotation.y = s * Math.PI / 2;
      void pot; S.slots = [sl(-0.34, 0.36), sl(0.34, 0.36), sl(0, 0.4)];
    } else if (key === 'oven') {   // the kawaii stove/oven prop
      S.sign = place('f10', { size: 1.0, pos: [0, 0, -0.12], parent: g });
      S.slots = [sl(-0.34, 0.4), sl(0.34, 0.4), sl(0, 0.44)];
    }
    if (!S.top) S.top = h;
    S.anchor = new THREE.Vector3(x, h + 0.35, z + 0.1);
    return S;
  }

  for (const b of bulbs) b.userData.dyn = true;
  bake(G);
  return { G, machines, grabs, jars, plates, bulbs, sign };
}

// little topping meshes for plates (strawberry = AI prop; egg + soy dip built in code)
export function toppingMesh(id, place) {
  if (id === 'str') return place('t03', { size: 0.2 });
  const g = new THREE.Group();
  if (id === 'egg') {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), jelly('#fffaf0')); w.scale.set(1, 0.6, 1.25); g.add(w);
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), jelly('#ffb52e')); y.scale.set(1, 0.45, 1); y.position.y = 0.035; g.add(y);
  } else {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.05, 18), jelly('#ffffff')); g.add(d);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.01, 18), jelly('#7a4a32')); s.position.y = 0.022; g.add(s);
  }
  return g;
}

// merge static code-built meshes sharing a material into one draw call each (originals hidden)
function bake(G) {
  G.updateMatrixWorld(true);
  const groups = new Map();
  G.traverse(m => {
    if (!m.isMesh || m.userData.dyn || Array.isArray(m.material) || m.userData.prop) return;
    if (m.parent !== G && !m.parent.userData.bakeOk) return;
    const key = m.material.uuid + '|' + m.castShadow;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(m => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.applyMatrix4(m.matrixWorld); return g; });
    if (geos.some(g => !g.attributes.uv || !g.attributes.normal)) continue;
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = true;
    G.add(mesh); for (const m of list) m.visible = false;
  }
}

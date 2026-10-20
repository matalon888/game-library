// Sugarloaf Café — the room, counters and kitchen machines, built in code around the AI 3D props in assets/.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

export const ROOM = { frontWallZ: 3.7, backZ: -7.6, halfW: 6.4, frontZ: -3.45, frontH: 1.05, spotZ: -4.6, ownerZ: -2.3, barZ: -1.0, barH: 0.9, kitZ: 0.7, kitH: 0.95, caseZ: 2.3, caseH: 0.86, doorX: 0 };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });
function canvasTex(w, h, draw, rep = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const rbox = (w, h, d, r = 0.04, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2));

export function buildWorld(scene, M, place) {
  const G = new THREE.Group(); scene.add(G);
  const add = (geo, mat, x, y, z, parent = G, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };

  // ---------------------------------------------------------------- textures
  const floorT = canvasTex(512, 512, (x, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      x.fillStyle = (i + j) % 2 ? '#e7a48a' : '#fbefe2'; x.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(${(i + j) % 2 ? '160,90,70' : '170,140,110'},${Math.random() * 0.05})`; x.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 2 + Math.random() * 5, 2 + Math.random() * 5); }
      const g = x.createLinearGradient(i * s, j * s, i * s + s, j * s + s); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.03)'); x.fillStyle = g; x.fillRect(i * s, j * s, s, s);
    }
    x.strokeStyle = 'rgba(150,110,90,.35)'; x.lineWidth = 3; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, h); x.moveTo(0, i * s); x.lineTo(w, i * s); x.stroke(); }
  }, [5, 4]);
  const wallT = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#7fc4ad'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#8fd0b9' : '#7fc4ad'; x.fillRect(i * 64, 0, 64, h); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(i * 64 + 30, 0, 4, h); }
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const cx = i * 64 + 32, cy = j * 64 + (i % 2 ? 32 : 0);
      x.fillStyle = 'rgba(255,255,255,.75)'; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 3.6, 0, 7); x.fill(); }
      x.fillStyle = '#ffc2cf'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill(); }
  }, [6, 1.4]);
  const marbleT = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#fbf8f4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(170,160,175,${0.08 + Math.random() * 0.18})`; x.lineWidth = 0.6 + Math.random() * 1.8; x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py);
      for (let k = 0; k < 14; k++) x.lineTo(px += 10 + Math.random() * 30, py += (Math.random() - 0.5) * 26); x.stroke(); }
  }, [2, 1]);
  const woodT = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#c98a5a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(120,60,30,.12)' : 'rgba(255,220,180,.08)'; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(90,45,20,.35)'; x.fillRect(0, i * 32, w, 2); }
    for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(110,55,25,${Math.random() * 0.15})`; x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); x.stroke(); }
  }, [2, 1]);
  const flutedT = canvasTex(256, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, '#f39bb0'); g.addColorStop(0.5, '#ffd0db'); g.addColorStop(1, '#f39bb0');
    for (let i = 0; i < 8; i++) { x.save(); x.translate(i * 32, 0); x.fillStyle = g; x.fillRect(0, 0, 32, h); x.restore(); }
  }, [7, 1]);
  const mintPanelT = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#9fd8c4'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 5; x.strokeRect(i * 64 + 8, 14, 48, h - 28); x.strokeStyle = 'rgba(40,110,90,.25)'; x.lineWidth = 2; x.strokeRect(i * 64 + 12, 18, 40, h - 36); }
  }, [3, 1]);

  // ---------------------------------------------------------------- room shell
  const { backZ, halfW } = ROOM;
  const floor = add(new THREE.PlaneGeometry(halfW * 2, 16), std(0xffffff, { map: floorT, roughness: 0.32 }), 0, 0, backZ + 8, G, false); floor.rotation.x = -Math.PI / 2;
  const wallMat = std(0xffffff, { map: wallT, roughness: 0.85 });
  add(new THREE.BoxGeometry(halfW * 2, 6, 0.2), wallMat, 0, 3, backZ - 0.1, G, false);
  // side walls + a front "fourth wall" are one-sided planes facing in: the play camera (outside) never sees them, the lobby camera (inside) does
  const FW = ROOM.frontWallZ, depth = FW - backZ;
  for (const s of [-1, 1]) { const m = add(new THREE.PlaneGeometry(depth, 6), wallMat, s * halfW, 3, backZ + depth / 2, G, false); m.rotation.y = -s * Math.PI / 2; }
  { const m = add(new THREE.PlaneGeometry(halfW * 2, 6), wallMat, 0, 3, FW, G, false); m.rotation.y = Math.PI; }
  // wainscoting: cream panels + rail + skirting
  const wains = std(0xf7e3cc, { roughness: 0.6 }), rail = std(0xd9a066, { roughness: 0.4, metalness: 0.1 });
  add(new THREE.BoxGeometry(halfW * 2, 1.25, 0.08), wains, 0, 0.625, backZ + 0.04, G, false);
  add(rbox(halfW * 2, 0.09, 0.14, 0.03), rail, 0, 1.28, backZ + 0.07);
  add(rbox(halfW * 2, 0.16, 0.12, 0.03), std(0xb7774b), 0, 0.08, backZ + 0.06);
  for (let i = -7; i <= 7; i++) add(rbox(0.86, 0.85, 0.05, 0.02), std(0xfffaf2, { roughness: 0.5 }), i * 1.04, 0.66, backZ + 0.1, G, false);
  add(rbox(halfW * 2, 0.16, 0.18, 0.04), rail, 0, 5.2, backZ + 0.1);   // crown
  for (const s of [-1, 1]) {
    const m = add(new THREE.PlaneGeometry(depth, 1.25), wains, s * (halfW - 0.02), 0.625, backZ + depth / 2, G, false); m.rotation.y = -s * Math.PI / 2;
    const r = add(new THREE.PlaneGeometry(depth, 0.1), rail, s * (halfW - 0.03), 1.28, backZ + depth / 2, G, false); r.rotation.y = -s * Math.PI / 2;
  }
  { const m = add(new THREE.PlaneGeometry(halfW * 2, 1.25), wains, 0, 0.625, FW - 0.02, G, false); m.rotation.y = Math.PI;
    const r = add(new THREE.PlaneGeometry(halfW * 2, 0.1), rail, 0, 1.28, FW - 0.03, G, false); r.rotation.y = Math.PI; }

  // door (centre of the back wall) with a striped canopy and a glowing glass panel
  const DX = ROOM.doorX;
  const frame = std(0xffffff, { roughness: 0.45 });
  add(rbox(1.7, 0.18, 0.3, 0.05), frame, DX, 2.75, backZ + 0.12);
  for (const s of [-1, 1]) add(rbox(0.16, 2.75, 0.28, 0.05), frame, DX + s * 0.78, 1.375, backZ + 0.12);
  const door = add(rbox(1.36, 2.6, 0.1, 0.04), std(0x5fb59a, { roughness: 0.45 }), DX, 1.32, backZ + 0.08);
  add(rbox(1.0, 1.25, 0.04, 0.03), std(0xfff6d8, { emissive: 0xfff0c0, emissiveIntensity: 0.9, roughness: 0.1 }), DX, 1.85, backZ + 0.15, G, false);
  add(new THREE.SphereGeometry(0.06, 12, 8), std(0xe8b04a, { metalness: 0.8, roughness: 0.25 }), DX + 0.5, 1.2, backZ + 0.2);
  const openT = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#ff6f91'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 26); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.roundRect(14, 14, w - 28, h - 28, 18); x.stroke();
    x.fillStyle = '#fff'; x.font = '900 52px "Lilita One", "Arial Rounded MT Bold", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OPEN', w / 2, h / 2 + 3); });
  const sign = add(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshStandardMaterial({ map: openT, emissive: 0xffffff, emissiveMap: openT, emissiveIntensity: 0.35, transparent: true }), DX, 1.85, backZ + 0.19, G, false);
  sign.castShadow = false;
  // striped canopy over the door
  const stripeT = canvasTex(256, 64, (x, w) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff7a9a'; x.fillRect(i * 32, 0, 32, 64); } });
  const canopy = add(new THREE.CylinderGeometry(0.55, 0.55, 2.1, 24, 1, true, 0, Math.PI), std(0xffffff, { map: stripeT, side: THREE.DoubleSide, roughness: 0.7 }), DX, 3.05, backZ + 0.25);
  canopy.rotation.z = Math.PI / 2; canopy.rotation.y = 0; canopy.scale.set(1, 1, 0.75);
  for (let i = 0; i < 8; i++) { const sc = add(new THREE.SphereGeometry(0.135, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(i % 2 ? 0xffffff : 0xff7a9a, { roughness: 0.7 }), DX - 0.92 + i * 0.263, 3.05, backZ + 0.66); sc.rotation.x = Math.PI; }
  // café sign above the door
  const nameT = canvasTex(1024, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff6e6'); g.addColorStop(1, '#ffe2c4'); x.fillStyle = g; x.beginPath(); x.roundRect(10, 10, w - 20, h - 20, 70); x.fill();
    x.lineWidth = 14; x.strokeStyle = '#d9a066'; x.stroke(); x.lineWidth = 4; x.strokeStyle = '#ff8fab'; x.beginPath(); x.roundRect(34, 34, w - 68, h - 68, 50); x.stroke();
    x.font = '400 118px "Lilita One", "Arial Rounded MT Bold", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 16; x.strokeStyle = '#7a3d2a'; x.strokeText('Sugarloaf Café', w / 2, h / 2 + 6); x.fillStyle = '#ff5d8f'; x.fillText('Sugarloaf Café', w / 2, h / 2 + 6);
  });
  add(rbox(3.0, 0.75, 0.08, 0.06), std(0xd9a066), DX, 4.15, backZ + 0.12);
  add(new THREE.PlaneGeometry(2.92, 0.73), new THREE.MeshStandardMaterial({ map: nameT, roughness: 0.5, emissive: 0xffffff, emissiveMap: nameT, emissiveIntensity: 0.12 }), DX, 4.15, backZ + 0.17, G, false);

  // windows (AI arched windows) with a sky glow behind and light shafts
  const glowT = canvasTex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fd0ff'); g.addColorStop(0.6, '#d8f0ff'); g.addColorStop(1, '#fff3d6'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const shaftT = canvasTex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,200,.55)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.16 });
  const shafts = [];
  for (const wx of [-2.75, 2.75, -5.6, 5.6]) {
    add(new THREE.PlaneGeometry(1.25, 1.9), new THREE.MeshBasicMaterial({ map: glowT }), wx, 2.55, backZ + 0.02, G, false);
    place('h18', { size: 2.55, pos: [wx, 1.35, backZ + 0.35], parent: G });
    const sh = add(new THREE.PlaneGeometry(1.2, 3.2), shaftMat, wx + 0.25, 1.75, backZ + 0.9, G, false); sh.rotation.set(-0.5, 0.12, 0.08); sh.castShadow = false; shafts.push(sh);
  }
  const frontG = new THREE.Group(); G.add(frontG);   // only shown while the camera is on the customer side (lobby)
  for (const wx of [-3.0, 3.0]) {
    const gl = add(new THREE.PlaneGeometry(1.25, 1.9), new THREE.MeshBasicMaterial({ map: glowT }), wx, 2.55, FW - 0.03, frontG, false); gl.rotation.y = Math.PI;
    place('h18', { size: 2.55, pos: [wx, 1.35, FW - 0.35], rot: Math.PI, parent: frontG });
  }
  // pendant lamps
  const brass = std(0xe0a54a, { metalness: 0.75, roughness: 0.3 });
  const bulbs = [];
  for (const lx of [-2.6, 2.6]) {
    const lz = ROOM.frontZ - 0.6;
    add(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 6), std(0x333333), lx, 5.6, lz, G, false);
    add(new THREE.CylinderGeometry(0.09, 0.3, 0.26, 28, 1, true), std(0x6fc3a8, { side: THREE.DoubleSide, roughness: 0.4 }), lx, 4.85, lz);
    add(new THREE.TorusGeometry(0.3, 0.018, 8, 32), brass, lx, 4.72, lz).rotation.x = Math.PI / 2;
    bulbs.push(add(new THREE.SphereGeometry(0.085, 16, 10), new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd98a, emissiveIntensity: 2.6 }), lx, 4.75, lz, G, false));
  }
  // wall shelves either side of the door with cups + plants
  for (const s of [-1, 1]) {
    add(rbox(1.4, 0.07, 0.34, 0.025), std(0xffffff, { map: woodT }), s * 1.55, 2.35, backZ + 0.2);
    for (const bx of [-0.5, 0.5]) add(rbox(0.05, 0.18, 0.28, 0.02), brass, s * 1.55 + bx, 2.24, backZ + 0.18);
  }
  // menu board (AI chalkboard easel) and bistro tables
  place('f13', { size: 1.6, pos: [1.55, 0, backZ + 0.75], rot: -0.2, parent: G });
  place('f12', { size: 1.65, pos: [-3.1, 0, backZ + 1.5], rot: 0.5, parent: G });
  place('f12', { size: 1.65, pos: [3.1, 0, backZ + 1.5], rot: -0.5, parent: G });
  place('f12', { size: 1.7, pos: [-5.6, 0, -4.6], rot: 0.2, parent: G });
  place('f12', { size: 1.7, pos: [5.6, 0, -4.6], rot: -0.2, parent: G });
  place('f12', { size: 1.7, pos: [-5.8, 0, -1.4], rot: -0.3, parent: G });
  place('f12', { size: 1.7, pos: [5.8, 0, -1.4], rot: 0.3, parent: G });

  // ---------------------------------------------------------------- front (customer) counter
  const FZ = ROOM.frontZ, FH = ROOM.frontH;
  const fl = std(0xffffff, { map: flutedT, roughness: 0.5 });
  add(rbox(7.0, FH - 0.08, 0.7, 0.05), fl, -0.2, (FH - 0.08) / 2, FZ);
  add(rbox(7.2, 0.09, 0.95, 0.04), std(0xffffff, { map: marbleT, roughness: 0.18 }), -0.2, FH - 0.04, FZ - 0.02);
  add(rbox(7.1, 0.1, 0.72, 0.03), std(0xc0784e), -0.2, 0.05, FZ + 0.02);
  add(rbox(7.06, 0.04, 0.04, 0.015), brass, -0.2, FH - 0.12, FZ + 0.37);
  place('f14', { size: 0.6, pos: [-2.75, FH, FZ - 0.02], rot: 0.35, parent: G });
  place('f11', { size: 1.7, pos: [4.2, 0, FZ - 0.1], rot: -0.35, parent: G });
  place('g10', { size: 0.36, pos: [2.85, FH, FZ], rot: -0.5, parent: G });

  // ---------------------------------------------------------------- drink bar (behind the owner): espresso + three blender jugs
  const steel = std(0xd6dde3, { metalness: 0.85, roughness: 0.28 }), dark = std(0x3b3f47, { metalness: 0.6, roughness: 0.35 });
  const BZ = ROOM.barZ, BH = ROOM.barH;
  add(rbox(6.4, BH - 0.08, 0.9, 0.05), std(0xffffff, { map: mintPanelT, roughness: 0.55 }), 0, (BH - 0.08) / 2, BZ);
  add(rbox(6.6, 0.09, 1.05, 0.04), std(0xffffff, { map: woodT, roughness: 0.35 }), 0, BH - 0.04, BZ);
  add(rbox(6.5, 0.04, 0.04, 0.015), brass, 0, BH - 0.12, BZ + 0.46);
  const machines = {};
  machines.esp = { g: place('f10', { size: 1.0, pos: [-1.65, BH, BZ - 0.18], rot: 0.12, parent: G }), slots: [[-1.82, BZ + 0.33], [-1.45, BZ + 0.33], [-1.1, BZ + 0.36]], top: BH };
  const barG = new THREE.Group(); barG.position.set(0.15, BH, BZ - 0.15); G.add(barG);
  add(rbox(1.75, 0.3, 0.55, 0.08), std(0xffb4c6, { roughness: 0.35 }), 0, 0.15, 0, barG);
  add(rbox(1.77, 0.05, 0.57, 0.02), steel, 0, 0.31, 0, barG);
  const jugs = [];
  [0xff8fb1, 0xffa94d, 0xc9915f].forEach((col, i) => {
    const jx = -0.58 + i * 0.58, jg = new THREE.Group(); jg.position.set(jx, 0.33, 0); barG.add(jg);
    add(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 20), dark, 0, 0.06, 0, jg);
    const glass = add(new THREE.CylinderGeometry(0.19, 0.13, 0.52, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide }), 0, 0.39, 0, jg, false);
    const liquid = add(new THREE.CylinderGeometry(0.17, 0.125, 0.32, 20), std(col, { roughness: 0.3 }), 0, 0.29, 0, jg, false);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), std(0xffffff, { roughness: 0.3 }), 0, 0.67, 0, jg);
    for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.035, 10, 8), std(0xffffff, { emissive: 0x777777, emissiveIntensity: 0.4 }), -0.08 + k * 0.08, 0.06, 0.165, jg, false);
    jugs.push({ g: jg, liquid, glass });
  });
  const jx = i => 0.15 - 0.58 + i * 0.58;
  machines.shake = { g: jugs[0].g, jug: jugs[0], base: barG, slots: [[jx(0) - 0.1, BZ + 0.33], [jx(0) + 0.14, BZ + 0.38], [jx(0) - 0.25, BZ + 0.4]], top: BH };
  machines.smoo = { g: jugs[1].g, jug: jugs[1], slots: [[jx(1), BZ + 0.33], [jx(1) + 0.22, BZ + 0.4], [jx(1) - 0.2, BZ + 0.4]], top: BH };
  machines.boba = { g: jugs[2].g, jug: jugs[2], slots: [[jx(2) + 0.1, BZ + 0.33], [jx(2) + 0.32, BZ + 0.4], [jx(2) - 0.12, BZ + 0.4]], top: BH };
  // a cup stack + sugar jar at the right end of the bar
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), brass, 1.75, BH + 0.02, BZ - 0.1);
  for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(0.12, 0.09, 0.1, 18), std(0xffffff, { roughness: 0.2 }), 1.75, BH + 0.08 + k * 0.07, BZ - 0.1);
  place('g09', { size: 0.34, pos: [2.25, BH, BZ - 0.05], rot: -0.4, parent: G });

  // ---------------------------------------------------------------- cook line: griddle, waffle iron, panini press
  const KZ = ROOM.kitZ, KH = ROOM.kitH, T = KH;
  add(rbox(6.0, KH - 0.08, 0.95, 0.05), std(0xffffff, { map: flutedT, roughness: 0.5 }), 0, (KH - 0.08) / 2, KZ);
  add(rbox(6.2, 0.09, 1.1, 0.04), std(0xffffff, { map: marbleT, roughness: 0.2 }), 0, KH - 0.04, KZ);
  add(rbox(6.1, 0.04, 0.04, 0.015), brass, 0, KH - 0.12, KZ + 0.48);
  const grG = new THREE.Group(); grG.position.set(-1.35, T, KZ - 0.05); G.add(grG);
  add(rbox(1.05, 0.16, 0.8, 0.04), steel, 0, 0.08, 0, grG);
  add(rbox(0.99, 0.04, 0.74, 0.02), std(0x2a2a30, { metalness: 0.5, roughness: 0.45 }), 0, 0.17, 0, grG);
  for (const kx of [-0.3, 0, 0.3]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 14), std(0xff6f91), kx, 0.08, 0.41, grG).rotation.x = Math.PI / 2;
  const grHeat = add(new THREE.PlaneGeometry(0.9, 0.66), new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.195, 0, grG, false); grHeat.rotation.x = -Math.PI / 2;
  machines.grill = { g: grG, heat: grHeat, slots: [[-1.6, KZ - 0.1], [-1.1, KZ - 0.1], [-1.35, KZ + 0.18]], top: T + 0.19 };
  const wfG = new THREE.Group(); wfG.position.set(0, T, KZ - 0.1); G.add(wfG);
  add(rbox(0.86, 0.12, 0.62, 0.06), std(0xffd166, { roughness: 0.35 }), 0, 0.06, 0, wfG);
  add(rbox(0.74, 0.03, 0.52, 0.02), dark, 0, 0.13, 0, wfG);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.14, -0.3); wfG.add(lidPivot);
  add(rbox(0.86, 0.1, 0.62, 0.06), std(0xffd166, { roughness: 0.35 }), 0, 0.05, 0.3, lidPivot);
  add(rbox(0.3, 0.05, 0.08, 0.02), dark, 0, 0.08, 0.64, lidPivot);
  machines.waf = { g: wfG, lid: lidPivot, slots: [[0, KZ + 0.38], [-0.32, KZ + 0.42], [0.32, KZ + 0.42]], top: T };
  const prG = new THREE.Group(); prG.position.set(1.35, T, KZ - 0.1); G.add(prG);
  add(rbox(0.9, 0.14, 0.62, 0.04), steel, 0, 0.07, 0, prG);
  add(rbox(0.82, 0.03, 0.54, 0.02), dark, 0, 0.15, 0, prG);
  const plPivot = new THREE.Group(); plPivot.position.set(0, 0.16, -0.3); prG.add(plPivot);
  add(rbox(0.9, 0.1, 0.62, 0.04), steel, 0, 0.06, 0.3, plPivot);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 10), std(0x3b3f47), 0, 0.14, 0.66, plPivot).rotation.z = Math.PI / 2;
  machines.press = { g: prG, lid: plPivot, slots: [[1.35, KZ + 0.38], [1.03, KZ + 0.42], [1.67, KZ + 0.42]], top: T };

  // ---------------------------------------------------------------- pastry case (nearest the camera: big, thumb-friendly)
  const CZ = ROOM.caseZ, CH = ROOM.caseH;
  add(rbox(4.6, CH - 0.3, 0.75, 0.06), std(0xffffff, { map: woodT, roughness: 0.45 }), 0, (CH - 0.3) / 2, CZ);
  add(rbox(4.5, 0.26, 0.7, 0.03), new THREE.MeshPhysicalMaterial({ color: 0xe8fbff, roughness: 0.05, transparent: true, opacity: 0.32 }), 0, CH - 0.17, CZ, G, false);
  add(rbox(4.66, 0.06, 0.8, 0.03), std(0xfff3f6, { roughness: 0.2 }), 0, CH - 0.02, CZ);
  add(rbox(4.6, 0.04, 0.04, 0.015), brass, 0, CH - 0.32, CZ + 0.38);
  const lightStrip = add(new THREE.BoxGeometry(4.4, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), 0, CH - 0.06, CZ + 0.3, G, false); void lightStrip;
  const standMat = std(0xffffff, { roughness: 0.25 }), doily = std(0xfff6fa, { roughness: 0.6 });
  const pastrySpots = [];
  for (let i = 0; i < 7; i++) {
    const x = -1.86 + i * 0.62, z = CZ;
    add(new THREE.CylinderGeometry(0.26, 0.25, 0.03, 28), standMat, x, CH + 0.03, z);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.01, 18), doily, x, CH + 0.05, z, G, false);
    pastrySpots.push(new THREE.Vector3(x, CH + 0.05, z));
  }

  // small kitchen dressing: jars, a cup stack, a sugar bowl
  const jarMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35 });
  for (const [x, c] of [[2.45, 0xffc6d9], [-2.45, 0xfff0b3], [2.72, 0xc9f2e0]]) { add(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 18), jarMat, x, T + 0.16, KZ - 0.2, G, false); add(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 18), std(c), x, T + 0.12, KZ - 0.2); add(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 18), brass, x, T + 0.34, KZ - 0.2); }

  for (const b of bulbs) b.userData.dyn = true;
  bake(G);
  return { G, frontG, pastrySpots, machines, bulbs, shafts, door, brass };
}

// merge the static code-built meshes that share a look into one draw call each (originals are hidden, never removed)
function bake(G) {
  G.updateMatrixWorld(true);
  const groups = new Map();
  for (const m of G.children) {
    if (!m.isMesh || m.userData.dyn || Array.isArray(m.material)) continue;
    const t = m.material;
    const key = [t.type, t.color && t.color.getHex(), t.map && t.map.uuid, t.roughness, t.metalness, t.transparent, t.opacity, t.side, t.emissive && t.emissive.getHex(), t.emissiveIntensity, t.blending, t.emissiveMap && t.emissiveMap.uuid, m.castShadow, m.receiveShadow].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(m => { let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); g.applyMatrix4(m.matrixWorld); return g; });
    if (geos.some(g => !g.attributes.uv || !g.attributes.normal)) continue;
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    G.add(mesh); for (const m of list) m.visible = false;
  }
}

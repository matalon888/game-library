// Rooms to restore: data (tasks, item placement) + a builder that makes each room as a dollhouse slice in code
// (floor slab, walls, wainscoting, window with a light shaft, clutter) and furnishes it with the AI 3D library.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { piece, prop } from './assets.js';

const PI = Math.PI;
// task kinds: clutter | walls | floor | window | item
export const ROOMS = [
  { id: 'living', name: 'Living Room', W: 10, D: 8, H: 5, host: [2.7, 0, 1.2, -0.35],
    wall: { shabby: ['#d4bb9b', '#b99d7c'], nice: { kind: 'damask', a: '#efb9b4', b: '#e49f9c', c: '#fff1e4' }, wains: '#fffaf2' },
    floor: { shabby: '#a88d6f', nice: { kind: 'herring', a: '#c98a55', b: '#b5713f' } },
    window: { x: 2.6, y: 2.7, w: 2.0, h: 2.4 },
    sheets: [[-0.4, -2.9, 1.7, 1.1, 0.8, 0], [-2.8, 1.0, 0.8, 1.2, 0.8, 0.7]],
    clutter: [[2.6, 0, -2.8, 0.2, 1.05], [3.6, 0, -2.5, -0.3, 0.95], [3.0, 1.0, -2.75, 0.5, 0.85], [-1.4, 0, 1.6, 0.4, 1.0], [-0.6, 0, 2.2, -0.2, 0.8]],
    tasks: [
      { id: 'clutter', name: 'Clear the clutter', cost: 1, kind: 'clutter', icon: '🧹' },
      { id: 'window', name: 'Open the window', cost: 1, kind: 'window', icon: '🪟' },
      { id: 'sofa', name: 'Velvet sofa', cost: 2, item: 'h01', at: [-0.2, 0, -3.0], rot: 0, size: 3.5 },
      { id: 'walls', name: 'Rose wallpaper', cost: 2, kind: 'walls', icon: '🎨' },
      { id: 'rug', name: 'Woven rug', cost: 1, item: 'h08', at: [-0.2, 0, -0.5], rot: 0, size: 4.4, sy: 0.35 },
      { id: 'table', name: 'Coffee table', cost: 1, item: 'h03', at: [-0.2, 0.1, -0.6], rot: 0.3, size: 1.55 },
      { id: 'floor', name: 'Parquet floor', cost: 2, kind: 'floor', icon: '🪵' },
      { id: 'fire', name: 'Stone fireplace', cost: 2, item: 'h09', at: [-4.2, 0, -1.6], rot: PI / 2, size: 2.5 },
      { id: 'chair', name: 'Wingback armchair', cost: 2, item: 'h02', at: [-2.7, 0, 1.0], rot: 0.75, size: 1.75 },
      { id: 'lamp', name: 'Brass floor lamp', cost: 1, item: 'h04', at: [-2.6, 0, -3.35], rot: 0, size: 2.8 },
      { id: 'shelf', name: 'Bookshelf', cost: 2, item: 'h07', at: [-4.5, 0, 2.3], rot: PI / 2, size: 3.0 },
      { id: 'plant', name: 'Monstera', cost: 1, item: 'h05', at: [4.2, 0, -3.1], rot: 0, size: 1.9 },
      { id: 'art', name: 'Landscape painting', cost: 1, item: 'h16', at: [-0.2, 3.0, -3.83], rot: 0, size: 1.6 },
      { id: 'cat', name: 'Sleepy cat', cost: 2, item: 'h19', at: [-2.6, 0, -1.3], rot: 0.6, size: 1.1 },
    ] },
  { id: 'bedroom', name: 'Bedroom', W: 10, D: 8, H: 5, host: [2.4, 0, 1.6, -0.3],
    wall: { shabby: ['#cdb7a8', '#b29a8b'], nice: { kind: 'floral', a: '#f4c3d6', b: '#ea98b8', c: '#86c9a3' }, wains: '#fff7fb' },
    floor: { shabby: '#a08870', nice: { kind: 'planks', a: '#e6c39a', b: '#d4a877' } },
    window: { x: -2.6, y: 2.7, w: 1.8, h: 2.2 },
    sheets: [[0.6, -2.6, 1.7, 1.3, 1.4, 0], [3.7, -3.2, 0.9, 1.2, 0.6, 0]],
    clutter: [[3.2, 0, -2.9, 0.3, 1.0], [3.9, 0, -2.2, -0.2, 0.9], [-1.0, 0, 1.4, 0.1, 1.05], [-0.2, 0, 2.0, 0.6, 0.8], [-0.6, 1.0, 1.5, -0.3, 0.8]],
    tasks: [
      { id: 'clutter', name: 'Clear the boxes', cost: 1, kind: 'clutter', icon: '🧹' },
      { id: 'walls', name: 'Blossom wallpaper', cost: 2, kind: 'walls', icon: '🎨' },
      { id: 'bed', name: 'Canopy bed', cost: 3, item: 'h11', at: [0.6, 0, -2.6], rot: 0, size: 3.6 },
      { id: 'chest', name: 'Hope chest', cost: 1, item: 'h21', at: [0.6, 0, -0.35], rot: 0, size: 1.5 },
      { id: 'window', name: 'Open the window', cost: 1, kind: 'window', icon: '🪟' },
      { id: 'floor', name: 'Honey floorboards', cost: 2, kind: 'floor', icon: '🪵' },
      { id: 'drawers', name: 'Chest of drawers', cost: 2, item: 'h12', at: [3.7, 0, -3.3], rot: 0, size: 1.8 },
      { id: 'vanity', name: 'Vanity table', cost: 2, item: 'h13', at: [-4.15, 0, 1.2], rot: PI / 2, size: 2.3 },
      { id: 'rug', name: 'Pastel rug', cost: 1, item: 'h08', at: [0.6, 0, 1.4], rot: 0, size: 3.4, sy: 0.35 },
      { id: 'clock', name: 'Grandfather clock', cost: 2, item: 'h10', at: [-4.5, 0, -2.6], rot: PI / 2, size: 3.3 },
      { id: 'fig', name: 'Fiddle leaf fig', cost: 1, item: 'h06', at: [4.2, 0, 0.3], rot: 0, size: 2.3 },
      { id: 'gramo', name: 'Gramophone', cost: 2, item: 'h15', at: [3.3, 0, 2.3], rot: -0.6, size: 1.4 },
    ] },
  { id: 'garden', name: 'Garden', W: 12, D: 9, H: 2.2, garden: true, host: [1.4, 0, 2.6, -0.2],
    wall: { shabby: ['#8a7a4e', '#6f6239'], nice: { kind: 'hedge', a: '#4fa65a', b: '#3b8a48' } },
    floor: { shabby: '#a39a62', nice: { kind: 'lawn', a: '#7fcb63', b: '#6dbb55' } },
    clutter: [[3.6, 0, 0.4, 0.3, 1.0], [4.3, 0, 1.2, -0.2, 0.9], [-2.2, 0, 2.6, 0.2, 1.0], [-1.4, 0, 3.2, -0.5, 0.85], [0.6, 0, -3.3, 0.1, 0.9]],
    tasks: [
      { id: 'clutter', name: 'Clear the junk', cost: 1, kind: 'clutter', icon: '🧹' },
      { id: 'floor', name: 'Fresh lawn', cost: 2, kind: 'floor', icon: '🌱' },
      { id: 'fountain', name: 'Tiered fountain', cost: 3, item: 'h23', at: [0.3, 0, -0.4], rot: 0, size: 2.8 },
      { id: 'walls', name: 'Trim the hedges', cost: 2, kind: 'walls', icon: '✂️' },
      { id: 'bench', name: 'Garden bench', cost: 1, item: 'h22', at: [-3.2, 0, 2.2], rot: 0.5, size: 2.4 },
      { id: 'gazebo', name: 'Gazebo', cost: 3, item: 'h24', at: [-3.6, 0, -2.4], rot: 0.4, size: 4.2 },
      { id: 'roses', name: 'Rose bush', cost: 1, item: 'h26', at: [2.0, 0, -3.4], rot: 0, size: 2.0 },
      { id: 'swing', name: 'Swing seat', cost: 2, item: 'h25', at: [4.3, 0, -2.6], rot: -0.4, size: 3.0 },
      { id: 'hydra', name: 'Hydrangea', cost: 1, item: 'h27', at: [-5.3, 0, 0.6], rot: 0, size: 1.8 },
      { id: 'lav', name: 'Lavender planter', cost: 1, item: 'h28', at: [3.2, 0, 2.6], rot: -0.3, size: 1.7 },
      { id: 'bath', name: 'Bird bath', cost: 1, item: 'h34', at: [5.0, 0, 0.9], rot: -0.5, size: 1.6 },
      { id: 'barrow', name: 'Flower wheelbarrow', cost: 1, item: 'h35', at: [-1.2, 0, 3.4], rot: 0.9, size: 2.0 },
    ] },
  { id: 'dining', name: 'Music Room', W: 10, D: 8, H: 5, host: [2.6, 0, 1.8, -0.4],
    wall: { shabby: ['#c4bfa0', '#a8a283'], nice: { kind: 'stripe', a: '#b9dcc0', b: '#9fcaa8', c: '#fff6e0' }, wains: '#fffdf6' },
    floor: { shabby: '#9c8a74', nice: { kind: 'check', a: '#f4efe6', b: '#cdbfae' } },
    window: { x: 0.2, y: 2.8, w: 2.2, h: 2.4 },
    sheets: [[3.0, -3.3, 1.3, 1.4, 0.7, 0], [-4.3, -1.6, 0.6, 1.6, 1.2, 0]],
    clutter: [[-1.6, 0, -0.4, 0.3, 1.0], [-0.8, 0, 0.3, -0.3, 0.95], [-1.2, 1.0, -0.2, 0.2, 0.8], [3.2, 0, 1.2, 0.5, 0.9], [2.5, 0, 2.2, -0.1, 0.8]],
    tasks: [
      { id: 'clutter', name: 'Clear the clutter', cost: 1, kind: 'clutter', icon: '🧹' },
      { id: 'walls', name: 'Sage stripes', cost: 2, kind: 'walls', icon: '🎨' },
      { id: 'floor', name: 'Marble tiles', cost: 2, kind: 'floor', icon: '✨' },
      { id: 'rug', name: 'Round rug', cost: 1, item: 'h08', at: [-0.8, 0, 0.0], rot: 0, size: 4.4, sy: 0.35 },
      { id: 'table', name: 'Dining set', cost: 3, item: 'h14', at: [-0.8, 0.1, 0.0], rot: 0.2, size: 3.2 },
      { id: 'window', name: 'Open the window', cost: 1, kind: 'window', icon: '🪟' },
      { id: 'chand', name: 'Crystal chandelier', cost: 2, item: 'h17', at: [-0.8, 3.35, 0.0], rot: 0, size: 1.6, hang: true },
      { id: 'piano', name: 'Upright piano', cost: 3, item: 'h20', at: [3.0, 0, -3.25], rot: 0, size: 2.5 },
      { id: 'art', name: 'Gold-framed art', cost: 1, item: 'h16', at: [-2.4, 2.9, -3.83], rot: 0, size: 1.5 },
      { id: 'shelf', name: 'Bookshelf', cost: 2, item: 'h07', at: [-4.5, 0, -1.6], rot: PI / 2, size: 3.0 },
      { id: 'lamp', name: 'Floor lamp', cost: 1, item: 'h04', at: [-4.2, 0, 1.7], rot: 0, size: 2.8 },
      { id: 'plant', name: 'Fig in a basket', cost: 1, item: 'h06', at: [4.4, 0, 0.0], rot: 0, size: 2.3 },
    ] },
];

// ---------------------------------------------------------------- canvas textures
function canvas(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function grime(x, w, h, n = 50, a = 0.18) {
  for (let i = 0; i < n; i++) { const r = rnd(10, 70), px = rnd(0, w), py = rnd(0, h), g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(70,55,35,${rnd(0.04, a)})`); g.addColorStop(1, 'rgba(70,55,35,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
}
export function wallTex(spec, shabby) {
  return canvas(512, 512, (x, w, h) => {
    if (shabby) {
      const [a, b] = spec.shabby; x.fillStyle = a; x.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 64) { x.fillStyle = b; x.globalAlpha = 0.25; x.fillRect(i, 0, 30, h); }
      x.globalAlpha = 1; grime(x, w, h, 70, 0.22);
      // water stains + peeling strips
      for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(90,70,40,.25)'; x.lineWidth = rnd(1, 3); x.beginPath(); const sx = rnd(0, w); x.moveTo(sx, 0); for (let y = 0; y < h; y += 20) x.lineTo(sx + rnd(-6, 6), y); x.stroke(); }
      for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(235,225,205,.55)'; const px = rnd(0, w), py = rnd(0, h); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(20, 50), py + rnd(-10, 10)); x.lineTo(px + rnd(5, 30), py + rnd(30, 70)); x.fill(); }
      return;
    }
    const n = spec.nice; x.fillStyle = n.a; x.fillRect(0, 0, w, h);
    if (n.kind === 'damask' || n.kind === 'floral') {
      x.fillStyle = n.b; for (let i = 0; i < w; i += 128) x.fillRect(i + 52, 0, 24, h);
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
        const cx = xx * 128 + (yy % 2 ? 64 : 0), cy = yy * 128 + 64;
        if (n.kind === 'damask') { x.fillStyle = n.c; x.globalAlpha = 0.8; x.beginPath(); x.ellipse(cx, cy, 18, 30, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx, cy - 34, 7, 10, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx, cy + 34, 7, 10, 0, 0, 7); x.fill(); x.globalAlpha = 1; }
        else { for (let p = 0; p < 5; p++) { const a = p / 5 * PI * 2; x.fillStyle = n.b; x.beginPath(); x.ellipse(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, 10, 7, a, 0, 7); x.fill(); }
          x.fillStyle = '#fff2b8'; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill(); x.fillStyle = n.c; x.beginPath(); x.ellipse(cx + 22, cy + 18, 10, 4, 0.6, 0, 7); x.fill(); }
      }
    } else if (n.kind === 'stripe') {
      for (let i = 0; i < w; i += 64) { x.fillStyle = n.b; x.fillRect(i, 0, 32, h); x.fillStyle = n.c; x.globalAlpha = 0.6; x.fillRect(i + 30, 0, 4, h); x.globalAlpha = 1; }
    } else if (n.kind === 'hedge') {
      for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? n.b : '#68bf6a'; x.beginPath(); x.ellipse(rnd(0, w), rnd(0, h), rnd(5, 12), rnd(3, 7), rnd(0, 3), 0, 7); x.fill(); }
      for (let i = 0; i < 60; i++) { x.fillStyle = ['#ffd1e6', '#ffffff', '#ffe27a'][i % 3]; x.beginPath(); x.arc(rnd(0, w), rnd(0, h), 4, 0, 7); x.fill(); }
    }
    grime(x, w, h, 10, 0.03);
  });
}
export function floorTex(spec, shabby) {
  return canvas(512, 512, (x, w, h) => {
    if (shabby) {
      x.fillStyle = spec.shabby; x.fillRect(0, 0, w, h);
      if (spec.nice.kind === 'lawn') { for (let i = 0; i < 1400; i++) { x.fillStyle = ['#8a8550', '#b1a46a', '#7c7a46', '#6f8a45'][i % 4]; x.fillRect(rnd(0, w), rnd(0, h), 2, rnd(4, 10)); } grime(x, w, h, 40, 0.2); return; }
      for (let y = 0; y < h; y += 64) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, w, 3); for (let k = 0; k < 2; k++) { x.fillRect(rnd(0, w), y, 3, 64); } }
      for (let i = 0; i < 60; i++) { x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); const px = rnd(0, w), py = rnd(0, h); x.moveTo(px, py); x.lineTo(px + rnd(-40, 40), py + rnd(-6, 6)); x.stroke(); }
      grime(x, w, h, 60, 0.25); return;
    }
    const n = spec.nice;
    if (n.kind === 'herring') {
      x.fillStyle = n.b; x.fillRect(0, 0, w, h);
      for (let yy = -2; yy < 18; yy++) for (let xx = 0; xx < 8; xx++) {
        const bx = xx * 64, by = yy * 32 + (xx % 2) * 16; x.save(); x.translate(bx + 32, by); x.rotate(xx % 2 ? PI / 4 : -PI / 4);
        x.fillStyle = Math.random() < 0.5 ? n.a : n.b; x.fillRect(-44, -10, 88, 20); x.strokeStyle = 'rgba(80,40,10,.35)'; x.lineWidth = 2; x.strokeRect(-44, -10, 88, 20); x.restore();
      }
      x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 0, w, h);
    } else if (n.kind === 'planks') {
      for (let y = 0; y < h; y += 42) { for (let px = (y / 42 % 2) * -120; px < w; px += 240) { x.fillStyle = Math.random() < 0.5 ? n.a : n.b; x.fillRect(px, y, 240, 42); x.strokeStyle = 'rgba(110,70,30,.35)'; x.lineWidth = 2; x.strokeRect(px, y, 240, 42);
        for (let g = 0; g < 4; g++) { x.strokeStyle = 'rgba(120,80,40,.12)'; x.beginPath(); x.moveTo(px, y + rnd(6, 36)); x.bezierCurveTo(px + 80, y + rnd(6, 36), px + 160, y + rnd(6, 36), px + 240, y + rnd(6, 36)); x.stroke(); } } }
    } else if (n.kind === 'check') {
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = (xx + yy) % 2 ? n.b : n.a; x.fillRect(xx * 128, yy * 128, 128, 128);
        for (let v = 0; v < 6; v++) { x.strokeStyle = 'rgba(150,140,130,.25)'; x.beginPath(); x.moveTo(xx * 128 + rnd(0, 128), yy * 128); x.quadraticCurveTo(xx * 128 + rnd(0, 128), yy * 128 + 64, xx * 128 + rnd(0, 128), yy * 128 + 128); x.stroke(); } }
    } else if (n.kind === 'lawn') {
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? n.a : n.b; x.fillRect(i * 64, 0, 64, h); }
      for (let i = 0; i < 2500; i++) { x.fillStyle = ['#8fdc6f', '#5daa49', '#9ee67c'][i % 3]; x.fillRect(rnd(0, w), rnd(0, h), 2, rnd(3, 7)); }
      for (let i = 0; i < 40; i++) { x.fillStyle = ['#ffffff', '#ffe27a', '#ffb3d1'][i % 3]; x.beginPath(); x.arc(rnd(0, w), rnd(0, h), 3, 0, 7); x.fill(); }
    }
  });
}
function cobwebTex() {
  return canvas(256, 256, (x, w, h) => {
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); x.stroke(); }
    for (let r = 30; r < 250; r += 30) { x.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2, rr = r + Math.sin(i * 3) * 6; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); }
  });
}
function shaftTex() {
  return canvas(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,200,.55)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}
function skyTex() {
  return canvas(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7cc6ff'); g.addColorStop(0.7, '#cfeeff'); g.addColorStop(1, '#fff3d6'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(rnd(5, 59), rnd(40, 180), rnd(8, 16), rnd(3, 6), 0, 0, 7); x.fill(); } });
}

// ---------------------------------------------------------------- room builder
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
export async function buildRoom(def) {
  const g = new THREE.Group(); g.name = def.id;
  const { W, D, H } = def, hw = W / 2, hd = D / 2;
  const R = { group: g, def, items: {}, apply: {} };
  // floor slab
  const slabMat = M(def.garden ? '#8a6a4a' : '#e9d6bd', { roughness: 0.9 });
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.6, 0.7, D + 0.6, 3, 0.18), slabMat); slab.position.set(-0.15, -0.36, -0.15); slab.receiveShadow = true; g.add(slab);
  if (def.garden) { const soil = new THREE.Mesh(new RoundedBoxGeometry(W + 0.5, 0.3, D + 0.5, 2, 0.12), M('#5f9a45')); soil.position.set(-0.15, -0.1, -0.15); g.add(soil); }
  const floorShabby = floorTex(def.floor, true), floorNice = floorTex(def.floor, false);
  const rep = def.garden ? 2 : W / 4; floorShabby.repeat.set(rep, rep * D / W); floorNice.repeat.set(rep, rep * D / W);
  const floorMat = M('#ffffff', { map: floorShabby, roughness: 0.62 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -PI / 2; floor.position.y = 0.005; floor.receiveShadow = true; g.add(floor);
  R.apply.floor = (nice) => { floorMat.map = nice ? floorNice : floorShabby; floorMat.roughness = nice ? (def.floor.nice.kind === 'check' ? 0.25 : 0.5) : 0.85; floorMat.needsUpdate = true; };
  // stone path for the garden
  if (def.garden) {
    const pm = M('#e9e1d2', { roughness: 0.8 }), pg = new THREE.CylinderGeometry(0.42, 0.46, 0.08, 10);
    const path = new THREE.InstancedMesh(pg, pm, 9), m4 = new THREE.Matrix4();
    for (let i = 0; i < 9; i++) { const t = i / 8; m4.compose(new THREE.Vector3(0.3 + Math.sin(t * 3) * 0.7, 0.03, 4.1 - t * 2.7 - (i > 4 ? 0 : 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i, 0)), new THREE.Vector3(1 - (i % 2) * 0.2, 1, 0.8)); path.setMatrixAt(i, m4); }
    path.receiveShadow = true; g.add(path);
  }
  // walls
  const wallShabby = wallTex(def.wall, true), wallNice = wallTex(def.wall, false);
  const wrep = def.garden ? 3 : W / 3.2; wallShabby.repeat.set(wrep, H / 3.2); wallNice.repeat.set(wrep, H / 3.2);
  const wallMat = M('#ffffff', { map: wallShabby, roughness: 0.85 }), capMat = M(def.garden ? '#3f7f42' : '#fff5ea', { roughness: 0.7 });
  const mkWall = (w, d, x, z, inner) => {
    const mats = [capMat, capMat, capMat, capMat, capMat, capMat]; mats[inner] = wallMat;
    const geo = def.garden ? new RoundedBoxGeometry(w, H, d, 3, 0.25) : new THREE.BoxGeometry(w, H, d);
    const m = new THREE.Mesh(geo, def.garden ? wallMat : mats); m.position.set(x, H / 2, z); m.castShadow = !def.garden; m.receiveShadow = true; g.add(m); return m;
  };
  const back = mkWall(W + 0.6, def.garden ? 1.0 : 0.3, -0.15, -hd - (def.garden ? 0.5 : 0.15), 4);
  const left = mkWall(def.garden ? 1.0 : 0.3, D, -hw - (def.garden ? 0.5 : 0.15), 0, 0);
  R.apply.walls = (nice) => {
    wallMat.map = nice ? wallNice : wallShabby; wallMat.needsUpdate = true; if (wains) wains.visible = nice;
    if (def.garden) { for (const w of [back, left]) w.scale.set(1, nice ? 1 : 0.8, 1), w.position.y = H * (nice ? 0.5 : 0.4); capMat.color.set(nice ? '#3f8f45' : '#6b5d35'); }
  };
  // wainscoting, chair rail, skirting, crown (shown with the new wallpaper)
  let wains = null;
  if (!def.garden) {
    wains = new THREE.Group(); const wm = M(def.wall.wains, { roughness: 0.55 }), rail = M('#ffffff', { roughness: 0.4 });
    const panel = (w, x, z, ry) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, 0.08), wm); p.position.set(x, 0.75, z); p.rotation.y = ry; p.receiveShadow = true; wains.add(p);
      const cr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.16), rail); cr.position.set(x, 1.52, z); cr.rotation.y = ry; wains.add(cr);
      const sk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.14), rail); sk.position.set(x, 0.11, z); sk.rotation.y = ry; wains.add(sk);
      const cw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.2), rail); cw.position.set(x, H - 0.08, z); cw.rotation.y = ry; wains.add(cw);
      // raised panel frames
      const n = Math.round(w / 1.25); for (let i = 0; i < n; i++) { const fr = new THREE.Mesh(new RoundedBoxGeometry(w / n - 0.3, 0.9, 0.06, 2, 0.03), rail);
        const off = -w / 2 + (i + 0.5) * w / n; fr.position.set(x + Math.cos(ry) * off, 0.78, z - Math.sin(ry) * off); fr.rotation.y = ry; wains.add(fr); }
    };
    panel(W, 0, -hd + 0.04, 0); panel(D, -hw + 0.04, 0, PI / 2);
    wains.visible = false; g.add(wains);
  }
  // window: frame, sky, boards (shabby) and a warm light shaft (open)
  if (def.window) {
    const { x: wx, y: wy, w: ww, h: wh } = def.window, win = new THREE.Group(); win.position.set(wx, wy, -hd + 0.02);
    const frameM = M('#fffaf3', { roughness: 0.45 });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: skyTex(), toneMapped: false })); sky.position.z = 0.01; win.add(sky);
    const bar = (w, h, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), frameM); b.position.set(x, y, 0.06); b.castShadow = true; win.add(b); };
    bar(ww + 0.3, 0.16, 0, wh / 2); bar(ww + 0.3, 0.22, 0, -wh / 2); bar(0.16, wh, -ww / 2, 0); bar(0.16, wh, ww / 2, 0); bar(0.08, wh, 0, 0); bar(ww, 0.08, 0, 0.15);
    const sill = new THREE.Mesh(new RoundedBoxGeometry(ww + 0.6, 0.12, 0.45, 2, 0.04), frameM); sill.position.set(0, -wh / 2 - 0.12, 0.2); sill.castShadow = true; win.add(sill);
    // curtains
    const cm = M(def.id === 'bedroom' ? '#f7a6c2' : def.id === 'dining' ? '#8cc7a0' : '#f2a07b', { roughness: 0.9 });
    const curtains = new THREE.Group();
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, wh + 0.6, 10, 1, true), cm); c.scale.z = 0.5; c.position.set(s * (ww / 2 + 0.25), -0.1, 0.25); c.castShadow = true; curtains.add(c); }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, ww + 1.4, 8), M('#c8a04a', { metalness: 0.8, roughness: 0.3 })); rod.rotation.z = PI / 2; rod.position.set(0, wh / 2 + 0.35, 0.28); curtains.add(rod);
    win.add(curtains);
    const boards = new THREE.Group(), bm = M('#8a6b4c', { roughness: 0.95 });
    [[0.35, 0.25], [-0.3, -0.35], [0.05, 0.6]].forEach(([y, r], i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.5, 0.32, 0.08), bm); b.position.set(0, y * wh * 0.6, 0.2 + i * 0.03); b.rotation.z = r; b.castShadow = true; boards.add(b); });
    win.add(boards);
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(ww * 1.2, 7), new THREE.MeshBasicMaterial({ map: shaftTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.28 }));
    shaft.position.set(0.4, -2.2, 2.6); shaft.rotation.set(-1.0, 0.15, 0); win.add(shaft);
    g.add(win);
    R.apply.window = (nice) => { boards.visible = !nice; shaft.visible = nice; curtains.visible = nice; sky.material.color.set(nice ? '#ffffff' : '#7d8794'); };
    R.boards = boards;
  }
  // clutter: crates (m11), cobwebs, dust
  const clutter = new THREE.Group(); g.add(clutter);
  const crate = await piece('m11', 'base');
  for (const [x, y, z, r, s] of def.clutter) { const m = new THREE.Mesh(crate.geo, crate.mat); m.position.set(x, y, z); m.rotation.y = r; m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; clutter.add(m); }
  if (!def.garden) {
    const web = new THREE.MeshBasicMaterial({ map: cobwebTex(), transparent: true, depthWrite: false, opacity: 0.8 });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), web); w1.position.set(-hw + 0.95, H - 0.95, -hd + 0.06); w1.rotation.z = -PI / 2; clutter.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), web); w2.position.set(hw - 0.9, H - 0.85, -hd + 0.06); w2.rotation.z = PI; clutter.add(w2);
  } else {
    const weedM = M('#7a7a3a', { roughness: 1 }), wg = new THREE.ConeGeometry(0.18, 0.7, 5);
    const weeds = new THREE.InstancedMesh(wg, weedM, 30), m4 = new THREE.Matrix4();
    for (let i = 0; i < 30; i++) { m4.compose(new THREE.Vector3(rnd(-hw + 0.5, hw - 0.5), 0.25, rnd(-hd + 0.6, hd - 0.4)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4))), new THREE.Vector3(1, rnd(0.6, 1.4), 1)); weeds.setMatrixAt(i, m4); }
    clutter.add(weeds);
  }
  // dust sheets over old furniture
  if (!def.garden) {
    const sheetG = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), sp = sheetG.attributes.position;
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); sp.setXYZ(i, sp.getX(i) * (1 + Math.sin(i * 1.7) * 0.05), y * (0.9 + Math.sin(i * 0.9) * 0.08), sp.getZ(i) * (1 + Math.cos(i * 1.3) * 0.05)); }
    sheetG.computeVertexNormals();
    const sm = M('#efe6da', { roughness: 0.95 });
    for (const [x, z, sx, sy, sz, r] of def.sheets || []) { const m = new THREE.Mesh(sheetG, sm); m.position.set(x, 0, z); m.scale.set(sx, sy, sz); m.rotation.y = r; m.castShadow = m.receiveShadow = true; clutter.add(m); }
  }
  R.clutter = clutter;
  R.apply.clutter = (nice) => { clutter.visible = !nice; };
  // furniture (hidden until bought)
  for (const t of def.tasks) {
    if (!t.item) continue;
    const m = await prop(t.item, t.size); m.position.set(...t.at); m.rotation.y = t.rot || 0;
    if (t.sy) m.scale.y *= t.sy;
    if (t.hang) { const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), M('#c8a04a', { metalness: 0.8, roughness: 0.3 })); const top = H - 0.2, bot = t.at[1] + t.size * 0.95; chain.scale.y = (top - bot) / t.size; chain.position.y = (top + bot) / 2 / t.size - t.at[1] / t.size; chain.scale.y = (top - bot) / t.size; m.add(chain); }
    m.visible = false; m.userData.base = m.scale.clone(); g.add(m); R.items[t.id] = m;
  }
  return R;
}

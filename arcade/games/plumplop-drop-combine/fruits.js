// Plumplop art — every piece is a sphere with a painted canvas skin (pattern + a little face) plus a stem/leaf/crown.
import { THREE, glossy, mat } from './kit/hc.js';

// radius, skin colours, name, extra parts
export const FRUITS = [
  { r: 0.3, c: ['#5b6cff', '#3443c9'], name: 'Blueberry', pat: 'star' },
  { r: 0.38, c: ['#e83a7c', '#b0165a'], name: 'Cherry', stem: true },
  { r: 0.48, c: ['#ff5468', '#e0304a'], name: 'Strawberry', pat: 'seeds', crown: 'leafy' },
  { r: 0.57, c: ['#9be15d', '#4fb83a'], name: 'Lime', pat: 'dots' },
  { r: 0.69, c: ['#ffa53a', '#ff7d1a'], name: 'Orange', pat: 'dimples', leaf: true },
  { r: 0.83, c: ['#a86bf0', '#6f3cc0'], name: 'Plum', stem: true, leaf: true, pat: 'dots' },
  { r: 0.97, c: ['#ffc2a8', '#ff8d8d'], name: 'Peach', pat: 'crease', leaf: true },
  { r: 1.1, c: ['#ffe066', '#ffbd3a'], name: 'Mango', pat: 'blush2' },
  { r: 1.24, c: ['#a87a55', '#7a5235'], name: 'Coconut', pat: 'fuzz' },
  { r: 1.4, c: ['#ffd54a', '#f2a81d'], name: 'Pineapple', pat: 'diamond', crown: 'spiky' },
  { r: 1.58, c: ['#4fc76a', '#238a45'], name: 'Melon', pat: 'stripes' },
];

function skin(f, i) {
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, f.c[0]); gr.addColorStop(1, f.c[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let s = i * 977 + 3; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.save();
  if (f.pat === 'seeds') { g.fillStyle = '#ffe9a8'; for (let k = 0; k < 90; k++) { const x = R() * W, y = 30 + R() * (H - 60); g.beginPath(); g.ellipse(x, y, 3, 5, 0, 0, 7); g.fill(); } }
  if (f.pat === 'dots') { g.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 120; k++) { g.beginPath(); g.arc(R() * W, R() * H, 2 + R() * 2, 0, 7); g.fill(); } }
  if (f.pat === 'dimples') { g.fillStyle = 'rgba(160,60,0,.12)'; for (let k = 0; k < 220; k++) { g.beginPath(); g.arc(R() * W, R() * H, 1.5 + R() * 2, 0, 7); g.fill(); } }
  if (f.pat === 'crease') { g.strokeStyle = 'rgba(220,90,90,.35)'; g.lineWidth = 6; g.beginPath(); g.moveTo(W * 0.42, 10); g.bezierCurveTo(W * 0.38, H * 0.4, W * 0.4, H * 0.7, W * 0.43, H - 10); g.stroke(); }
  if (f.pat === 'fuzz') { g.strokeStyle = 'rgba(60,35,20,.35)'; g.lineWidth = 2; for (let k = 0; k < 500; k++) { const x = R() * W, y = R() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y + 6 + R() * 6); g.stroke(); } }
  if (f.pat === 'diamond') { g.strokeStyle = 'rgba(170,100,10,.5)'; g.lineWidth = 4; for (let k = -10; k < 20; k++) { g.beginPath(); g.moveTo(k * 40, 0); g.lineTo(k * 40 + H, H); g.stroke(); g.beginPath(); g.moveTo(k * 40 + H, 0); g.lineTo(k * 40, H); g.stroke(); } }
  if (f.pat === 'stripes') { g.fillStyle = '#1d6b35'; for (let k = 0; k < 14; k++) { const x = k * W / 14; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= H; y += 16) g.lineTo(x + Math.sin(y / 18 + k) * 7 + 10, y); for (let y = H; y >= 0; y -= 16) g.lineTo(x + Math.sin(y / 18 + k) * 7, y); g.fill(); } }
  if (f.pat === 'star') { g.fillStyle = '#26307f'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, rr = k % 2 ? 6 : 16; g.lineTo(W * 0.25 + Math.cos(a) * rr * 1.8, 14 + Math.sin(a) * rr * 0.6); } g.fill(); }
  g.restore();
  // face, centred on the front (u = 0.25)
  const cx = W * 0.25, cy = H * 0.52, sc = 1;
  g.fillStyle = '#2b1d2a';
  for (const dx of [-26, 26]) { g.beginPath(); g.ellipse(cx + dx * sc, cy - 6, 8.5, 11, 0, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; for (const dx of [-26, 26]) { g.beginPath(); g.arc(cx + dx * sc + 3, cy - 10, 3.4, 0, 7); g.fill(); }
  g.strokeStyle = '#2b1d2a'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy + 6, 10, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,120,150,.55)'; for (const dx of [-44, 44]) { g.beginPath(); g.ellipse(cx + dx, cy + 10, 11, 6.5, 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const SPH = new THREE.SphereGeometry(1, 36, 24);
const STEM = (() => { const g = new THREE.CylinderGeometry(0.05, 0.07, 0.42, 8); g.translate(0, 0.21, 0); g.rotateZ(-0.25); return g; })();
const LEAF = (() => { const g = new THREE.SphereGeometry(1, 12, 8); g.scale(0.26, 0.07, 0.13); g.translate(0.2, 0, 0); return g; })();
const stemMat = mat('#6b4a2b'), leafMat = glossy('#3fbf5a', { roughness: 0.35 });
const SPIKE = (() => { const g = new THREE.ConeGeometry(0.16, 0.7, 6); g.translate(0, 0.35, 0); return g; })();

let mats = null;
export function fruitMesh(type) {
  if (!mats) mats = FRUITS.map((f, i) => new THREE.MeshStandardMaterial({ map: skin(f, i), roughness: f.pat === 'fuzz' ? 0.8 : 0.3, metalness: 0.02 }));
  const f = FRUITS[type], g = new THREE.Group();
  const body = new THREE.Mesh(SPH, mats[type]); body.castShadow = true; body.receiveShadow = true;
  const k = f.name === 'Strawberry' ? [1, 1.06, 1] : f.name === 'Mango' ? [1.04, 0.97, 1] : f.name === 'Plum' || f.name === 'Peach' ? [1.03, 0.97, 1.03] : [1, 1, 1];
  body.scale.set(f.r * k[0], f.r * k[1], f.r * k[2]); g.add(body);
  if (f.stem) { const s = new THREE.Mesh(STEM, stemMat); s.position.y = f.r * 0.9; s.scale.setScalar(Math.max(0.8, f.r * 1.6)); g.add(s); }
  if (f.leaf) { const l = new THREE.Mesh(LEAF, leafMat); l.position.set(0.02, f.r * 0.97, 0); l.rotation.z = 0.5; l.scale.setScalar(Math.max(0.9, f.r * 1.5)); g.add(l); }
  if (f.crown === 'leafy') for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(LEAF, leafMat); l.position.set(0, f.r * 0.98, 0); l.rotation.set(0, i * 1.25, 0.35); l.scale.setScalar(0.8); g.add(l); }
  if (f.crown === 'spiky') for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(SPIKE, leafMat); s.position.set(0, f.r * 0.9, 0); s.rotation.set(0, 0, (i - 2) * 0.3); s.scale.set(1, 1 + (2 - Math.abs(i - 2)) * 0.25, 1); g.add(s); }
  g.rotation.y = 0; return g;
}

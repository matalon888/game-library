// Pondguard models: critter towers, slimes and props, all baked from three.js primitives into vertex-coloured geometry.
import { THREE } from './kit/hc.js';
import { bake } from './merge.js';

const PI = Math.PI;
const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const C = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const K = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const T = (r, t, rs = 8, ts = 20, arc = PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const up = new THREE.Vector3(0, 1, 0);
const rotTo = (dx, dy, dz) => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(dx, dy, dz).normalize())); return [e.x, e.y, e.z]; };
const DARK = '#2b2230';

const base = (c1 = '#a7b0a3', c2 = '#c3cbbf') => [
  { geo: C(0.42, 0.47, 0.14, 22), color: c1, pos: [0, 0.07, 0] },
  { geo: C(0.37, 0.37, 0.03, 22), color: c2, pos: [0, 0.15, 0] },
];
const eyes = (x, y, z, r = 0.042) => [-1, 1].map(s => ({ geo: S(r, 10, 8), color: DARK, pos: [s * x, y, z] }));
const glint = (x, y, z) => [-1, 1].map(s => ({ geo: S(0.016, 6, 4), color: '#ffffff', pos: [s * x + 0.012, y + 0.016, z] }));

function hog() {
  const p = [...base(), { geo: S(0.31), color: '#c98d5c', pos: [0, 0.42, -0.03], scl: [1, 0.86, 1.1] },
    { geo: S(0.2), color: '#f4dcbc', pos: [0, 0.39, 0.19], scl: [1, 0.9, 0.85] },
    { geo: K(0.1, 0.22, 10), color: '#f4dcbc', pos: [0, 0.4, 0.36], rot: [PI / 2, 0, 0] },
    { geo: S(0.05, 10, 8), color: DARK, pos: [0, 0.4, 0.47] },
    ...eyes(0.09, 0.5, 0.31), ...glint(0.09, 0.5, 0.345),
    { geo: S(0.04, 8, 6), color: '#ff9db5', pos: [-0.15, 0.42, 0.29] }, { geo: S(0.04, 8, 6), color: '#ff9db5', pos: [0.15, 0.42, 0.29] },
    { geo: S(0.075), color: '#8a5a3a', pos: [-0.15, 0.19, 0.14] }, { geo: S(0.075), color: '#8a5a3a', pos: [0.15, 0.19, 0.14] }];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
    const ph = 0.15 + i * 0.36, th = PI * 0.5 + (j / 6 - 0.5) * PI * (1.25 - i * 0.12) + (i % 2) * 0.12;
    const d = [Math.cos(th) * Math.cos(ph), Math.sin(ph), -Math.abs(Math.sin(th)) * Math.cos(ph) * 0.9 - 0.15];
    if (d[2] > -0.05 && i < 2) continue;
    p.push({ geo: K(0.058, 0.24, 6), color: i % 2 ? '#5f3d29' : '#714a32', pos: [d[0] * 0.3, 0.42 + d[1] * 0.27, -0.03 + d[2] * 0.3], rot: rotTo(...d) });
  }
  return p;
}
function frog() {
  return [{ geo: C(0.47, 0.47, 0.06, 22), color: '#4f9e44', pos: [0, 0.03, 0] }, { geo: C(0.42, 0.42, 0.02, 22), color: '#69bd59', pos: [0, 0.07, 0] },
    { geo: S(0.31), color: '#7ed957', pos: [0, 0.33, 0], scl: [1.12, 0.78, 1] },
    { geo: S(0.22), color: '#eaf7b0', pos: [0, 0.28, 0.14], scl: [1, 0.72, 0.85] },
    { geo: S(0.12), color: '#7ed957', pos: [-0.15, 0.55, 0.08] }, { geo: S(0.12), color: '#7ed957', pos: [0.15, 0.55, 0.08] },
    { geo: S(0.09), color: '#ffffff', pos: [-0.15, 0.58, 0.15] }, { geo: S(0.09), color: '#ffffff', pos: [0.15, 0.58, 0.15] },
    ...eyes(0.15, 0.585, 0.225, 0.047),
    { geo: T(0.13, 0.016, 6, 16, PI), color: '#c2486a', pos: [0, 0.4, 0.27], rot: [PI * 0.92, 0, PI] },
    { geo: S(0.05, 8, 6), color: '#ff9db5', pos: [-0.23, 0.4, 0.2] }, { geo: S(0.05, 8, 6), color: '#ff9db5', pos: [0.23, 0.4, 0.2] },
    { geo: S(0.11), color: '#64c045', pos: [-0.3, 0.17, 0.02], scl: [0.9, 0.55, 1.5] }, { geo: S(0.11), color: '#64c045', pos: [0.3, 0.17, 0.02], scl: [0.9, 0.55, 1.5] }];
}
function hive() {
  const p = [{ geo: C(0.42, 0.47, 0.14, 22), color: '#a8794e', pos: [0, 0.07, 0] }, { geo: C(0.37, 0.37, 0.03, 22), color: '#c99a68', pos: [0, 0.15, 0] },
    { geo: S(0.33, 18, 14), color: '#ffc93c', pos: [0, 0.5, 0], scl: [1, 1.12, 1] },
    { geo: C(0.09, 0.09, 0.06, 14), color: '#4a2f1a', pos: [0, 0.38, 0.31], rot: [PI / 2, 0, 0] }];
  for (let i = 0; i < 4; i++) { const y = -0.25 + i * 0.17, r = Math.sqrt(Math.max(0.01, 1 - (y / 0.37) ** 2)) * 0.33; p.push({ geo: T(r, 0.035, 6, 24), color: '#e99a1c', pos: [0, 0.5 + y, 0], rot: [PI / 2, 0, 0] }); }
  p.push({ geo: S(0.09), color: '#ffd23f', pos: [0, 0.96, 0.02], scl: [1, 0.95, 1.3] }, { geo: T(0.085, 0.022, 6, 14), color: DARK, pos: [0, 0.96, 0.0] },
    { geo: S(0.07, 10, 6), color: '#e6f7ff', pos: [-0.09, 1.04, -0.02], scl: [1, 0.25, 0.65] }, { geo: S(0.07, 10, 6), color: '#e6f7ff', pos: [0.09, 1.04, -0.02], scl: [1, 0.25, 0.65] },
    ...eyes(0.035, 0.98, 0.11, 0.02));
  return p;
}
function snail() {
  return [...base('#9aa39a', '#b9c2b6'),
    { geo: new THREE.CapsuleGeometry(0.12, 0.42, 6, 12), color: '#b6e07a', pos: [0, 0.27, 0.05], rot: [PI / 2, 0, 0] },
    { geo: S(0.28, 18, 14), color: '#ff9f6b', pos: [0, 0.48, -0.08] },
    { geo: T(0.14, 0.045, 8, 20), color: '#e46c45', pos: [-0.2, 0.48, -0.08], rot: [0, PI / 2, 0] }, { geo: T(0.14, 0.045, 8, 20), color: '#e46c45', pos: [0.2, 0.48, -0.08], rot: [0, PI / 2, 0] },
    { geo: T(0.06, 0.03, 6, 14), color: '#e46c45', pos: [-0.27, 0.48, -0.08], rot: [0, PI / 2, 0] }, { geo: T(0.06, 0.03, 6, 14), color: '#e46c45', pos: [0.27, 0.48, -0.08], rot: [0, PI / 2, 0] },
    { geo: C(0.075, 0.1, 0.3, 12), color: '#5b6170', pos: [0, 0.74, 0.0], rot: [0.55, 0, 0] }, { geo: T(0.075, 0.025, 6, 12), color: '#3d4250', pos: [0, 0.87, 0.07], rot: [PI / 2 + 0.55, 0, 0] },
    { geo: C(0.02, 0.025, 0.2, 6), color: '#a3d16a', pos: [-0.07, 0.42, 0.33], rot: [-0.3, 0, 0.2] }, { geo: C(0.02, 0.025, 0.2, 6), color: '#a3d16a', pos: [0.07, 0.42, 0.33], rot: [-0.3, 0, -0.2] },
    ...eyes(0.09, 0.52, 0.36, 0.045)];
}
function owl() {
  return [{ geo: C(0.4, 0.45, 0.12, 22), color: '#a7b0a3', pos: [0, 0.06, 0] }, { geo: C(0.12, 0.15, 0.32, 10), color: '#9b7048', pos: [0, 0.27, 0] },
    { geo: S(0.28, 18, 14), color: '#8b6a4f', pos: [0, 0.66, 0], scl: [1, 1.22, 0.95] },
    { geo: S(0.2), color: '#f0dcb8', pos: [0, 0.58, 0.12], scl: [1, 1.15, 0.6] },
    { geo: C(0.105, 0.105, 0.03, 18), color: '#ffffff', pos: [-0.1, 0.79, 0.24], rot: [PI / 2, 0, 0] }, { geo: C(0.105, 0.105, 0.03, 18), color: '#ffffff', pos: [0.1, 0.79, 0.24], rot: [PI / 2, 0, 0] },
    { geo: C(0.13, 0.13, 0.02, 18), color: '#d8a05c', pos: [-0.1, 0.79, 0.225], rot: [PI / 2, 0, 0] }, { geo: C(0.13, 0.13, 0.02, 18), color: '#d8a05c', pos: [0.1, 0.79, 0.225], rot: [PI / 2, 0, 0] },
    ...eyes(0.1, 0.79, 0.26, 0.055), ...glint(0.1, 0.8, 0.31),
    { geo: K(0.045, 0.12, 8), color: '#ff9f1c', pos: [0, 0.7, 0.29], rot: [PI * 0.62, 0, 0] },
    { geo: K(0.065, 0.18, 6), color: '#6e5039', pos: [-0.16, 1.02, 0], rot: [0, 0, 0.45] }, { geo: K(0.065, 0.18, 6), color: '#6e5039', pos: [0.16, 1.02, 0], rot: [0, 0, -0.45] },
    { geo: S(0.13), color: '#6e5039', pos: [-0.27, 0.62, -0.02], scl: [0.45, 1.2, 0.9] }, { geo: S(0.13), color: '#6e5039', pos: [0.27, 0.62, -0.02], scl: [0.45, 1.2, 0.9] },
    { geo: S(0.05, 8, 6), color: '#ff9f1c', pos: [-0.08, 0.44, 0.1] }, { geo: S(0.05, 8, 6), color: '#ff9f1c', pos: [0.08, 0.44, 0.1] }];
}
export const MODELS = { hog: { parts: hog, top: 0.72 }, frog: { parts: frog, top: 0.72 }, hive: { parts: hive, top: 1.12 }, snail: { parts: snail, top: 0.95 }, owl: { parts: owl, top: 1.12 } };

const cache = {};
/** tower geometry with upgrade badges: gold studs for path A, teal studs for path B, crown / halo at tier 3 */
export function towerGeo(type, a = 0, b = 0) {
  const key = type + a + b; if (cache[key]) return cache[key];
  const m = MODELS[type], p = m.parts();
  for (let i = 0; i < a; i++) { const t = PI * (0.62 + i * 0.16); p.push({ geo: S(0.055, 10, 8), color: '#ffcf33', pos: [Math.cos(t) * 0.42, 0.13, Math.sin(t) * 0.42] }); }
  for (let i = 0; i < b; i++) { const t = PI * (0.38 - i * 0.16); p.push({ geo: S(0.055, 10, 8), color: '#2ec4b6', pos: [Math.cos(t) * 0.42, 0.13, Math.sin(t) * 0.42] }); }
  if (a >= 3) { p.push({ geo: C(0.13, 0.11, 0.09, 6), color: '#ffcf33', pos: [0, m.top + 0.05, 0] }); for (let i = 0; i < 6; i++) p.push({ geo: K(0.035, 0.08, 4), color: '#ffcf33', pos: [Math.cos(i * PI / 3) * 0.11, m.top + 0.13, Math.sin(i * PI / 3) * 0.11] }); }
  if (b >= 3) p.push({ geo: T(0.16, 0.03, 6, 22), color: '#2ec4b6', pos: [0, m.top + 0.12, 0], rot: [PI / 2, 0, 0] });
  if (a + b >= 2) p.push({ geo: T(0.43, 0.028, 6, 28), color: a >= b ? '#ffcf33' : '#2ec4b6', pos: [0, 0.155, 0], rot: [PI / 2, 0, 0] });
  return (cache[key] = bake(p));
}

export const slimeGeo = () => bake([
  { geo: S(0.5, 22, 16), color: '#ffffff', pos: [0, 0.36, 0], scl: [1, 0.74, 1] },
  { geo: S(0.07, 10, 8), color: '#1d1b2a', pos: [-0.17, 0.42, 0.42] }, { geo: S(0.07, 10, 8), color: '#1d1b2a', pos: [0.17, 0.42, 0.42] },
]);
export const shellGeo = () => bake([
  { geo: new THREE.SphereGeometry(0.55, 18, 10, 0, PI * 2, 0, PI / 2), color: '#a2a9b4', pos: [0, 0.44, -0.03], scl: [1, 0.72, 1] },
  { geo: T(0.53, 0.05, 6, 26), color: '#6f7784', pos: [0, 0.45, -0.03], rot: [PI / 2, 0, 0] },
  { geo: S(0.09, 8, 6), color: '#6f7784', pos: [0, 0.83, -0.03] },
  { geo: S(0.07, 8, 6), color: '#6f7784', pos: [0.28, 0.72, -0.1] }, { geo: S(0.07, 8, 6), color: '#6f7784', pos: [-0.28, 0.72, -0.1] }, { geo: S(0.07, 8, 6), color: '#6f7784', pos: [0, 0.7, -0.33] },
]);
export const bulkGeo = () => bake([
  { geo: S(0.5, 24, 18), color: '#ffffff', pos: [0, 0.48, 0], scl: [1.3, 0.95, 1.3] },
  { geo: T(0.62, 0.07, 8, 32), color: '#d9dde6', pos: [0, 0.4, 0], rot: [PI / 2, 0, 0] },
  { geo: S(0.13, 12, 10), color: '#ffffff', pos: [-0.24, 0.66, 0.5] }, { geo: S(0.13, 12, 10), color: '#ffffff', pos: [0.24, 0.66, 0.5] },
  { geo: S(0.065, 10, 8), color: '#1d1b2a', pos: [-0.24, 0.65, 0.62] }, { geo: S(0.065, 10, 8), color: '#1d1b2a', pos: [0.24, 0.65, 0.62] },
  { geo: new THREE.BoxGeometry(0.22, 0.05, 0.06), color: '#1d1b2a', pos: [-0.23, 0.82, 0.56], rot: [0, 0, -0.35] }, { geo: new THREE.BoxGeometry(0.22, 0.05, 0.06), color: '#1d1b2a', pos: [0.23, 0.82, 0.56], rot: [0, 0, 0.35] },
  { geo: K(0.1, 0.22, 8), color: '#d9dde6', pos: [-0.3, 0.98, 0], rot: [0, 0, 0.4] }, { geo: K(0.1, 0.22, 8), color: '#d9dde6', pos: [0.3, 0.98, 0], rot: [0, 0, -0.4] },
]);
export const beeGeo = () => bake([
  { geo: S(0.09, 10, 8), color: '#ffd23f', scl: [1, 0.95, 1.35] }, { geo: T(0.085, 0.025, 6, 12), color: DARK, pos: [0, 0, -0.02] },
  { geo: S(0.07, 8, 6), color: '#e6f7ff', pos: [-0.08, 0.07, -0.02], scl: [1, 0.25, 0.65] }, { geo: S(0.07, 8, 6), color: '#e6f7ff', pos: [0.08, 0.07, -0.02], scl: [1, 0.25, 0.65] },
]);
export const quillGeo = () => bake([{ geo: K(0.035, 0.32, 6), color: '#5f3d29', rot: [PI / 2, 0, 0] }, { geo: C(0.02, 0.02, 0.1, 5), color: '#f4dcbc', pos: [0, 0, -0.18], rot: [PI / 2, 0, 0] }]);
export const shellShotGeo = () => bake([{ geo: S(0.15, 12, 10), color: '#ff9f6b' }, { geo: T(0.1, 0.035, 6, 14), color: '#e46c45', rot: [0, PI / 2, 0] }]);
export function treeGeo() { return bake([{ geo: C(0.12, 0.17, 0.7, 8), color: '#8a5a3a', pos: [0, 0.35, 0] }]); }
export function canopyGeo() { return bake([{ geo: S(0.75, 12, 9), color: '#ffffff', pos: [0, 1.15, 0] }, { geo: S(0.5, 10, 8), color: '#f2f2f2', pos: [0.32, 1.55, 0.1] }, { geo: S(0.45, 10, 8), color: '#e8e8e8', pos: [-0.35, 1.45, -0.15] }]); }

// ---------------------------------------------------------------- 2D icons for the shop cards (canvas, drawn in code)
export function icon(type, size = 92) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = size / 92;
  x.scale(s, s); x.lineJoin = 'round';
  const circ = (cx, cy, r, f) => { x.beginPath(); x.arc(cx, cy, r, 0, PI * 2); x.fillStyle = f; x.fill(); };
  const eye = (cx, cy, r = 5) => { circ(cx, cy, r, DARK); circ(cx + r * 0.35, cy - r * 0.35, r * 0.35, '#fff'); };
  if (type === 'hog') {
    x.fillStyle = '#6b4630'; for (let i = 0; i < 13; i++) { const a = PI * (0.95 + i * 0.09); x.beginPath(); x.moveTo(46 + Math.cos(a - 0.12) * 26, 54 + Math.sin(a - 0.12) * 26); x.lineTo(46 + Math.cos(a) * 42, 54 + Math.sin(a) * 42); x.lineTo(46 + Math.cos(a + 0.12) * 26, 54 + Math.sin(a + 0.12) * 26); x.fill(); }
    circ(46, 54, 28, '#c98d5c'); circ(46, 60, 19, '#f4dcbc'); circ(46, 62, 6, DARK); eye(37, 50); eye(55, 50); circ(30, 62, 4, '#ff9db5'); circ(62, 62, 4, '#ff9db5');
  } else if (type === 'frog') {
    circ(46, 60, 30, '#7ed957'); circ(31, 34, 13, '#7ed957'); circ(61, 34, 13, '#7ed957'); circ(31, 34, 9, '#fff'); circ(61, 34, 9, '#fff'); eye(32, 35, 5); eye(62, 35, 5);
    circ(46, 66, 18, '#eaf7b0'); x.strokeStyle = '#c2486a'; x.lineWidth = 3; x.beginPath(); x.arc(46, 56, 13, 0.2 * PI, 0.8 * PI); x.stroke(); circ(24, 58, 4, '#ff9db5'); circ(68, 58, 4, '#ff9db5');
  } else if (type === 'hive') {
    x.fillStyle = '#ffc93c'; x.beginPath(); x.ellipse(46, 54, 28, 32, 0, 0, PI * 2); x.fill();
    x.strokeStyle = '#e99a1c'; x.lineWidth = 5; for (const y of [36, 50, 64, 76]) { x.beginPath(); x.moveTo(46 - Math.sqrt(Math.max(0, 1 - ((y - 54) / 32) ** 2)) * 28, y); x.lineTo(46 + Math.sqrt(Math.max(0, 1 - ((y - 54) / 32) ** 2)) * 28, y); x.stroke(); }
    circ(46, 66, 7, '#4a2f1a'); circ(70, 22, 9, '#ffd23f'); x.fillStyle = DARK; x.fillRect(68, 14, 4, 16); x.fillStyle = 'rgba(230,247,255,.9)'; x.beginPath(); x.ellipse(64, 13, 7, 4, -0.5, 0, PI * 2); x.ellipse(77, 13, 7, 4, 0.5, 0, PI * 2); x.fill();
  } else if (type === 'snail') {
    x.fillStyle = '#b6e07a'; x.beginPath(); x.ellipse(46, 72, 34, 11, 0, 0, PI * 2); x.fill();
    circ(42, 48, 24, '#ff9f6b'); x.strokeStyle = '#e46c45'; x.lineWidth = 5; x.beginPath(); for (let a = 0; a < PI * 4; a += 0.2) { const r = 20 - a * 1.5; x.lineTo(42 + Math.cos(a) * r, 48 + Math.sin(a) * r); } x.stroke();
    x.fillStyle = '#5b6170'; x.save(); x.translate(50, 26); x.rotate(0.5); x.fillRect(-6, -16, 12, 22); x.restore();
    x.strokeStyle = '#a3d16a'; x.lineWidth = 4; x.beginPath(); x.moveTo(72, 68); x.lineTo(76, 50); x.moveTo(78, 68); x.lineTo(84, 52); x.stroke(); eye(76, 49, 4.5); eye(84, 51, 4.5);
  } else if (type === 'owl') {
    x.fillStyle = '#6e5039'; x.beginPath(); x.moveTo(24, 26); x.lineTo(30, 8); x.lineTo(40, 22); x.moveTo(68, 26); x.lineTo(62, 8); x.lineTo(52, 22); x.fill();
    x.fillStyle = '#8b6a4f'; x.beginPath(); x.ellipse(46, 52, 28, 36, 0, 0, PI * 2); x.fill(); x.fillStyle = '#f0dcb8'; x.beginPath(); x.ellipse(46, 64, 18, 22, 0, 0, PI * 2); x.fill();
    circ(35, 40, 12, '#d8a05c'); circ(57, 40, 12, '#d8a05c'); circ(35, 40, 9, '#fff'); circ(57, 40, 9, '#fff'); eye(35, 40, 5.5); eye(57, 40, 5.5);
    x.fillStyle = '#ff9f1c'; x.beginPath(); x.moveTo(41, 48); x.lineTo(51, 48); x.lineTo(46, 57); x.fill();
  }
  return c;
}

// Bramblebash models: woodland troops, towers and props baked from three.js primitives (one draw call per model).
import { THREE } from './kit/hc.js';
import { bake } from './merge.js';

const PI = Math.PI;
const S = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);
const HS = (r) => new THREE.SphereGeometry(r, 14, 8, 0, PI * 2, 0, PI / 2);
const C = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const K = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const T = (r, t, a = 6, b = 16, arc = PI * 2) => new THREE.TorusGeometry(r, t, a, b, arc);
const DK = '#241c2c';
const eyes = (y, z, x = 0.07, r = 0.035) => [-1, 1].flatMap(s => [{ geo: S(r, 8, 6), color: DK, pos: [s * x, y, z] }, { geo: S(r * 0.38, 6, 4), color: '#ffffff', pos: [s * x + r * 0.3, y + r * 0.35, z + r * 0.7] }]);
const pair = (geo, color, x, y, z, rot, scl) => [-1, 1].map(s => ({ geo, color, pos: [s * x, y, z], rot: rot ? [rot[0], rot[1] * s, rot[2] * s] : undefined, scl }));

// each unit builder gets the team colour tc; models face +z
const U = {
  knight: tc => [{ geo: S(0.24), color: '#c98d5c', pos: [0, 0.32, 0], scl: [1, 1.12, 1] },
    { geo: HS(0.25), color: '#7a4f2e', pos: [0, 0.46, 0], scl: [1, 0.85, 1] }, { geo: C(0.025, 0.03, 0.12, 6), color: '#5a3a20', pos: [0, 0.69, 0] },
    ...eyes(0.4, 0.21), { geo: T(0.19, 0.05), color: tc, pos: [0, 0.2, 0], rot: [PI / 2, 0, 0] },
    { geo: Bx(0.05, 0.05, 0.44), color: '#dfe6ee', pos: [0.26, 0.32, 0.14] }, { geo: Bx(0.16, 0.04, 0.05), color: '#8a6a3a', pos: [0.26, 0.32, -0.04] },
    { geo: C(0.15, 0.15, 0.04, 14), color: tc, pos: [-0.26, 0.32, 0.04], rot: [0, 0, PI / 2] }, { geo: S(0.04, 6, 4), color: '#ffd23f', pos: [-0.29, 0.32, 0.04] },
    ...pair(S(0.07, 8, 6), '#8a5a3a', 0.11, 0.07, 0.03)],
  brute: tc => [{ geo: S(0.4, 16, 12), color: '#3e3b78', pos: [0, 0.36, -0.05], scl: [1.05, 0.7, 1.3] },
    { geo: S(0.2), color: '#2c2a58', pos: [0, 0.34, 0.42] }, ...eyes(0.4, 0.58, 0.1, 0.045),
    { geo: K(0.08, 0.42, 8), color: '#22204a', pos: [0, 0.52, 0.66], rot: [PI / 2.7, 0, 0] },
    { geo: C(0.25, 0.25, 0.05, 16), color: tc, pos: [0, 0.65, -0.1] }, { geo: Bx(0.04, 0.02, 0.8), color: '#7b78c8', pos: [0, 0.64, -0.1] },
    ...[-0.25, 0.05, 0.35].flatMap(z => pair(C(0.035, 0.03, 0.34, 5), '#22204a', 0.38, 0.14, z, [0, 0, 0.9]))],
  bees: tc => [{ geo: S(0.15), color: '#ffd23f', pos: [0, 0, 0], scl: [1, 1, 1.3] }, { geo: T(0.145, 0.03), color: DK, pos: [0, 0, -0.03] }, { geo: T(0.12, 0.03), color: DK, pos: [0, 0, -0.12] },
    ...pair(S(0.1, 8, 6), '#e6f7ff', 0.12, 0.1, -0.02, null, [1, 0.25, 0.6]), ...eyes(0.04, 0.16, 0.06, 0.03), { geo: K(0.04, 0.12, 6), color: tc, pos: [0, 0, -0.24], rot: [-PI / 2, 0, 0] }],
  archers: tc => {
    const p = [{ geo: S(0.22), color: '#c98d5c', pos: [0, 0.27, -0.02], scl: [1, 0.9, 1.05] }, { geo: S(0.14), color: '#f4dcbc', pos: [0, 0.27, 0.14] }, ...eyes(0.33, 0.24, 0.07, 0.032), { geo: S(0.035, 6, 4), color: DK, pos: [0, 0.28, 0.29] },
      { geo: K(0.16, 0.24, 10), color: tc, pos: [0, 0.55, -0.02] }, { geo: T(0.17, 0.03, 5, 14, PI), color: '#8a5a3a', pos: [0.24, 0.3, 0.12], rot: [0, PI / 2, PI / 2] }];
    for (let i = 0; i < 9; i++) { const a = PI * (0.25 + i * 0.12), d = [Math.cos(a), 0.4 + (i % 3) * 0.25, -0.8]; p.push({ geo: K(0.04, 0.18, 5), color: '#6b4630', pos: [Math.cos(a) * 0.16, 0.3 + (i % 3) * 0.06, -0.15], rot: [-1.1, 0, -Math.cos(a) * 0.8] }); }
    return p;
  },
  mole: tc => [{ geo: S(0.26), color: '#6b5a6e', pos: [0, 0.3, 0], scl: [1, 1, 1.15] }, { geo: S(0.07, 8, 6), color: '#ff8fb1', pos: [0, 0.3, 0.3] }, ...eyes(0.4, 0.24, 0.08, 0.025),
    { geo: HS(0.2), color: tc, pos: [0, 0.48, -0.02] }, { geo: C(0.05, 0.05, 0.06, 8), color: '#fff3a0', pos: [0, 0.6, 0.12], rot: [PI / 2, 0, 0] },
    ...pair(S(0.08, 8, 6), '#f0d0c0', 0.22, 0.2, 0.18, null, [1, 0.5, 1.2])],
  frog: tc => [{ geo: S(0.26), color: '#7ed957', pos: [0, 0.25, 0], scl: [1.1, 0.8, 1] }, ...pair(S(0.1), '#7ed957', 0.12, 0.45, 0.06), ...pair(S(0.075), '#ffffff', 0.12, 0.47, 0.12), ...eyes(0.47, 0.17, 0.12, 0.04),
    { geo: T(0.2, 0.04), color: tc, pos: [0, 0.3, 0], rot: [PI / 2, 0, 0] }, { geo: S(0.13), color: '#2b2b35', pos: [0, 0.42, -0.2] }, { geo: C(0.015, 0.015, 0.1, 5), color: '#ffb000', pos: [0, 0.57, -0.2] }],
  squirrels: tc => [{ geo: S(0.16), color: '#e5813a', pos: [0, 0.2, 0], scl: [1, 1.1, 1] }, { geo: S(0.11), color: '#f7e2c4', pos: [0, 0.19, 0.08] }, ...eyes(0.27, 0.13, 0.06, 0.03),
    ...pair(K(0.05, 0.1, 5), '#e5813a', 0.08, 0.38, 0), { geo: S(0.14), color: '#d06c28', pos: [0, 0.38, -0.2], scl: [0.8, 1.6, 0.7] }, { geo: T(0.13, 0.035), color: tc, pos: [0, 0.14, 0], rot: [PI / 2, 0, 0] }],
  badger: tc => [{ geo: S(0.3), color: '#7d8590', pos: [0, 0.3, 0], scl: [1, 0.85, 1.25] }, { geo: S(0.18), color: '#e9ecef', pos: [0, 0.33, 0.3] }, { geo: Bx(0.07, 0.05, 0.5), color: '#22252a', pos: [0, 0.48, 0.2] },
    ...eyes(0.38, 0.42, 0.07, 0.03), { geo: S(0.04, 6, 4), color: DK, pos: [0, 0.32, 0.48] }, { geo: HS(0.24), color: tc, pos: [0, 0.48, -0.08], scl: [1, 0.6, 1.2] }, ...pair(K(0.05, 0.16, 6), '#fff8e8', 0.14, 0.62, 0.0)],
  moth: tc => [{ geo: S(0.12), color: '#efe3c8', pos: [0, 0, 0], scl: [1, 1, 1.5] }, ...pair(S(0.2, 10, 6), '#c8b6ff', 0.2, 0.04, -0.02, null, [1, 0.15, 0.8]),
    ...eyes(0.04, 0.14, 0.05, 0.03), ...pair(C(0.01, 0.01, 0.16, 4), DK, 0.04, 0.12, 0.14, [0.6, 0, 0.3]), ...pair(S(0.03, 6, 4), tc, 0.06, 0.19, 0.19), { geo: S(0.06, 8, 6), color: '#fff3a0', pos: [0, -0.05, -0.18] }],
  bear: tc => [{ geo: S(0.42, 16, 12), color: '#5a7a3e', pos: [0, 0.48, 0], scl: [1, 1.05, 0.95] }, { geo: S(0.26), color: '#6e8f4a', pos: [0, 0.82, 0.08] }, ...pair(S(0.08, 8, 6), '#5a7a3e', 0.18, 1.02, 0.04),
    { geo: S(0.1), color: '#c9d9a6', pos: [0, 0.78, 0.3] }, { geo: S(0.035, 6, 4), color: DK, pos: [0, 0.8, 0.4] }, ...eyes(0.88, 0.3, 0.09, 0.035),
    { geo: T(0.38, 0.06), color: tc, pos: [0, 0.4, 0], rot: [PI / 2, 0, 0] }, ...pair(S(0.13), '#4a6a32', 0.38, 0.45, 0.12), ...pair(S(0.12), '#4a6a32', 0.17, 0.1, 0.05),
    ...[0, 1, 2, 3].map(i => ({ geo: S(0.06, 6, 4), color: '#ff8fb1', pos: [Math.cos(i * 1.7) * 0.3, 0.6 + (i % 2) * 0.2, -0.3] }))],
  cannon: tc => [{ geo: C(0.16, 0.22, 0.42, 12), color: '#f4e6c8', pos: [0, 0.21, 0] }, { geo: HS(0.46), color: tc, pos: [0, 0.4, 0], scl: [1, 0.7, 1] },
    ...[0, 1, 2, 3, 4].map(i => ({ geo: S(0.06, 6, 4), color: '#ffffff', pos: [Math.cos(i * 1.26) * 0.3, 0.62, Math.sin(i * 1.26) * 0.3] })),
    { geo: C(0.09, 0.11, 0.5, 10), color: '#4a4f5c', pos: [0, 0.32, 0.3], rot: [PI / 2, 0, 0] }, { geo: T(0.1, 0.03), color: '#2e323c', pos: [0, 0.32, 0.55] }],
};
export const UNIT_KEYS = Object.keys(U);
export const unitGeo = (type, tc) => bake(U[type](tc));

export function towerGeo(kind, tc) {
  if (kind === 'small') return bake([
    { geo: C(0.62, 0.8, 1.3, 14), color: '#8a5a3a', pos: [0, 0.65, 0] }, ...[0, 1, 2, 3, 4, 5].map(i => ({ geo: Bx(0.08, 1.2, 0.08), color: '#714a2e', pos: [Math.cos(i) * 0.7, 0.6, Math.sin(i) * 0.7], rot: [0, -i, 0] })),
    { geo: C(0.85, 0.85, 0.14, 16), color: '#c99a68', pos: [0, 1.35, 0] }, ...Array.from({ length: 10 }, (_, i) => ({ geo: Bx(0.12, 0.25, 0.12), color: '#a8794e', pos: [Math.cos(i * PI / 5) * 0.78, 1.52, Math.sin(i * PI / 5) * 0.78] })),
    { geo: C(0.06, 0.06, 1.1, 6), color: '#5a3a20', pos: [0, 1.9, 0] }, { geo: K(0.6, 0.55, 8), color: tc, pos: [0, 2.35, 0] }, { geo: Bx(0.4, 0.25, 0.02), color: tc, pos: [0.22, 2.9, 0] },
    { geo: C(0.92, 1.0, 0.12, 18), color: '#9aa39a', pos: [0, 0.06, 0] }]);
  if (kind === 'hearth') return bake([
    { geo: C(0.9, 1.25, 1.6, 16), color: '#8a5a3a', pos: [0, 0.8, 0] }, ...[0, 1, 2, 3].map(i => ({ geo: K(0.35, 0.7, 6), color: '#714a2e', pos: [Math.cos(i * 1.57 + 0.8) * 1.15, 0.3, Math.sin(i * 1.57 + 0.8) * 1.15], rot: [Math.sin(i * 1.57 + 0.8) * 0.9, 0, -Math.cos(i * 1.57 + 0.8) * 0.9] })),
    { geo: C(1.25, 1.25, 0.16, 18), color: '#c99a68', pos: [0, 1.66, 0] }, { geo: Bx(1.3, 0.9, 1.1), color: '#f4e6c8', pos: [0, 2.2, 0] },
    { geo: Bx(0.3, 0.35, 0.04), color: '#ffd96b', pos: [-0.3, 2.25, 0.56] }, { geo: Bx(0.3, 0.35, 0.04), color: '#ffd96b', pos: [0.3, 2.25, 0.56] }, { geo: Bx(0.28, 0.5, 0.04), color: '#7a4f2e', pos: [0, 2.0, -0.56] },
    { geo: K(1.15, 0.9, 4), color: tc, pos: [0, 3.1, 0], rot: [0, PI / 4, 0] }, { geo: S(0.45, 10, 8), color: '#5dbb4c', pos: [0.75, 2.9, -0.3] }, { geo: S(0.35, 10, 8), color: '#4fae45', pos: [-0.8, 2.7, -0.4] },
    { geo: C(0.05, 0.05, 0.9, 6), color: '#5a3a20', pos: [0, 3.8, 0] }, { geo: Bx(0.5, 0.3, 0.02), color: '#ffd23f', pos: [0.27, 4.1, 0] },
    { geo: C(1.35, 1.45, 0.14, 20), color: '#9aa39a', pos: [0, 0.07, 0] }]);
  return bake([{ geo: C(0.8, 1.0, 0.25, 12), color: '#7a5a3e', pos: [0, 0.12, 0] }, ...[0, 1, 2, 3, 4, 5, 6].map(i => ({ geo: Bx(0.35, 0.18, 0.25), color: i % 2 ? '#8a5a3a' : '#a8794e', pos: [Math.cos(i * 0.9) * 0.55, 0.32, Math.sin(i * 0.9) * 0.55], rot: [0.3, i, 0.2] })), { geo: K(0.25, 0.4, 6), color: tc, pos: [0.2, 0.3, 0.1], rot: [0.8, 0, 0.6] }]);
}
export const bushGeo = () => bake([{ geo: S(0.42, 10, 8), color: '#ffffff' }, { geo: S(0.3, 8, 6), color: '#eeeeee', pos: [0.3, 0.05, 0.1] }, { geo: S(0.07, 6, 4), color: '#b0306a', pos: [0.15, 0.3, 0.3] }, { geo: S(0.07, 6, 4), color: '#b0306a', pos: [-0.2, 0.25, 0.28] }]);
export const treeGeo = () => bake([{ geo: C(0.12, 0.18, 0.8, 8), color: '#8a5a3a', pos: [0, 0.4, 0] }, { geo: S(0.75, 12, 9), color: '#5dbb4c', pos: [0, 1.25, 0] }, { geo: S(0.5, 10, 8), color: '#4fae45', pos: [0.35, 1.6, 0.1] }]);

// ---------------------------------------------------------------- card art (2D canvas, drawn in code)
export function cardArt(type, w = 120, h = 144) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), s = w / 120; x.scale(s, s);
  const circ = (cx, cy, r, f) => { x.beginPath(); x.arc(cx, cy, r, 0, PI * 2); x.fillStyle = f; x.fill(); };
  const ell = (cx, cy, rx, ry, f, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, PI * 2); x.fillStyle = f; x.fill(); };
  const eye = (cx, cy, r = 6) => { circ(cx, cy, r, DK); circ(cx + r * 0.35, cy - r * 0.35, r * 0.35, '#fff'); };
  const bgs = { knight: ['#ffe2b8', '#f6b26b'], brute: ['#c9c6ff', '#7b78c8'], bees: ['#fff3a0', '#ffc93c'], archers: ['#ffe1d0', '#e89a6b'], mole: ['#e8d8f0', '#a58cb5'], frog: ['#d6f7c0', '#7ed957'], squirrels: ['#ffe0c0', '#f0a050'], badger: ['#e3e7ec', '#9aa3ad'], moth: ['#ece4ff', '#b6a2ff'], bear: ['#d9edc0', '#86b35c'], cannon: ['#ffd9e0', '#ff8fa8'], volley: ['#e9dcc0', '#b58a52'], snare: ['#fff0c0', '#ffb000'], heal: ['#e0fff4', '#5fd7b0'], boulder: ['#e4e4e4', '#9aa0a8'] }[type] || ['#eee', '#bbb'];
  const g = x.createLinearGradient(0, 0, 0, 144); g.addColorStop(0, bgs[0]); g.addColorStop(1, bgs[1]); x.fillStyle = g; x.fillRect(0, 0, 120, 144);
  x.fillStyle = 'rgba(255,255,255,.25)'; circ(60, 62, 50, 'rgba(255,255,255,.25)');
  switch (type) {
    case 'knight': circ(60, 78, 34, '#c98d5c'); x.fillStyle = '#7a4f2e'; x.beginPath(); x.arc(60, 66, 36, PI, 0); x.fill(); x.fillRect(57, 22, 6, 10); eye(48, 78); eye(72, 78); x.fillStyle = '#dfe6ee'; x.fillRect(96, 40, 7, 60); x.fillStyle = '#8a6a3a'; x.fillRect(88, 92, 22, 6); break;
    case 'brute': ell(60, 84, 42, 32, '#3e3b78'); circ(60, 70, 22, '#2c2a58'); x.fillStyle = '#22204a'; x.beginPath(); x.moveTo(52, 56); x.lineTo(60, 14); x.lineTo(68, 56); x.fill(); eye(50, 72, 7); eye(70, 72, 7); break;
    case 'bees': for (const [bx, by, r] of [[40, 56, 16], [80, 50, 14], [62, 92, 18]]) { ell(bx - r * 0.5, by - r * 0.9, r * 0.6, r * 0.35, 'rgba(230,247,255,.95)'); ell(bx + r * 0.5, by - r * 0.9, r * 0.6, r * 0.35, 'rgba(230,247,255,.95)'); ell(bx, by, r * 1.2, r, '#ffd23f'); x.fillStyle = DK; x.fillRect(bx - 3, by - r, 5, r * 2); x.fillRect(bx + 7, by - r * 0.9, 4, r * 1.8); eye(bx - r * 0.6, by - 2, 3.5); } break;
    case 'archers': x.fillStyle = '#6b4630'; for (let i = 0; i < 12; i++) { const a = PI * (1.0 + i * 0.09); x.beginPath(); x.moveTo(60 + Math.cos(a - 0.12) * 28, 82 + Math.sin(a - 0.12) * 28); x.lineTo(60 + Math.cos(a) * 46, 82 + Math.sin(a) * 46); x.lineTo(60 + Math.cos(a + 0.12) * 28, 82 + Math.sin(a + 0.12) * 28); x.fill(); } circ(60, 82, 30, '#c98d5c'); circ(60, 90, 19, '#f4dcbc'); eye(50, 78); eye(70, 78); circ(60, 92, 5, DK); x.strokeStyle = '#8a5a3a'; x.lineWidth = 4; x.beginPath(); x.arc(98, 80, 26, -1.2, 1.2); x.stroke(); break;
    case 'mole': circ(60, 82, 34, '#6b5a6e'); x.fillStyle = '#3a86ff'; x.beginPath(); x.arc(60, 66, 32, PI, 0); x.fill(); circ(60, 44, 7, '#fff3a0'); circ(60, 92, 9, '#ff8fb1'); eye(48, 78, 4); eye(72, 78, 4); ell(28, 106, 12, 7, '#f0d0c0'); ell(92, 106, 12, 7, '#f0d0c0'); break;
    case 'frog': circ(60, 88, 32, '#7ed957'); circ(42, 58, 14, '#7ed957'); circ(78, 58, 14, '#7ed957'); circ(42, 58, 10, '#fff'); circ(78, 58, 10, '#fff'); eye(43, 59, 5); eye(79, 59, 5); circ(92, 40, 13, '#2b2b35'); x.fillStyle = '#ffb000'; x.fillRect(91, 18, 3, 12); x.strokeStyle = '#c2486a'; x.lineWidth = 3; x.beginPath(); x.arc(60, 84, 14, 0.2 * PI, 0.8 * PI); x.stroke(); break;
    case 'squirrels': for (const [sx, sy, r] of [[38, 70, 18], [82, 66, 17], [46, 108, 16], [84, 106, 17]]) { ell(sx + r, sy - r * 0.5, r * 0.6, r * 1.1, '#d06c28', 0.4); circ(sx, sy, r, '#e5813a'); circ(sx, sy + r * 0.25, r * 0.55, '#f7e2c4'); eye(sx - r * 0.35, sy - r * 0.2, 3); eye(sx + r * 0.35, sy - r * 0.2, 3); } break;
    case 'badger': ell(60, 84, 38, 34, '#7d8590'); ell(60, 92, 22, 20, '#e9ecef'); x.fillStyle = '#22252a'; x.fillRect(56, 50, 8, 34); eye(46, 82, 5); eye(74, 82, 5); circ(60, 100, 5, DK); x.fillStyle = '#fff8e8'; x.beginPath(); x.moveTo(30, 58); x.lineTo(22, 30); x.lineTo(40, 52); x.moveTo(90, 58); x.lineTo(98, 30); x.lineTo(80, 52); x.fill(); break;
    case 'moth': ell(34, 70, 28, 34, '#c8b6ff', -0.4); ell(86, 70, 28, 34, '#c8b6ff', 0.4); circ(34, 66, 9, '#fff3a0'); circ(86, 66, 9, '#fff3a0'); ell(60, 80, 13, 28, '#efe3c8'); eye(55, 66, 4); eye(65, 66, 4); x.strokeStyle = DK; x.lineWidth = 2; x.beginPath(); x.moveTo(56, 56); x.lineTo(46, 34); x.moveTo(64, 56); x.lineTo(74, 34); x.stroke(); break;
    case 'bear': circ(34, 44, 14, '#5a7a3e'); circ(86, 44, 14, '#5a7a3e'); circ(60, 80, 42, '#5a7a3e'); ell(60, 96, 20, 15, '#c9d9a6'); circ(60, 90, 6, DK); eye(45, 74, 5); eye(75, 74, 5); for (const [fx, fy] of [[30, 60], [92, 100], [40, 112]]) circ(fx, fy, 5, '#ff8fb1'); break;
    case 'cannon': x.fillStyle = '#f4e6c8'; x.fillRect(46, 76, 28, 46); x.fillStyle = '#ff5d8f'; x.beginPath(); x.arc(60, 80, 46, PI, 0); x.fill(); for (const [fx, fy, r] of [[40, 56, 8], [64, 46, 7], [84, 64, 7], [56, 68, 5]]) circ(fx, fy, r, '#fff'); x.fillStyle = '#4a4f5c'; x.fillRect(58, 84, 46, 16); break;
    case 'volley': for (const [px, py] of [[38, 50], [74, 40], [56, 82], [88, 86], [30, 100]]) { ell(px, py, 11, 16, '#8a5a3a', 0.4); x.strokeStyle = '#5a3a20'; x.lineWidth = 2; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(px - 9, py + k * 7); x.lineTo(px + 9, py + k * 7 - 4); x.stroke(); } } break;
    case 'snare': x.fillStyle = '#ffb000'; x.beginPath(); x.moveTo(60, 22); x.bezierCurveTo(100, 70, 96, 112, 60, 112); x.bezierCurveTo(24, 112, 20, 70, 60, 22); x.fill(); ell(48, 78, 8, 14, 'rgba(255,255,255,.55)', -0.4); break;
    case 'heal': for (const [px, py, r] of [[60, 70, 30], [36, 92, 18], [86, 94, 20], [60, 104, 16]]) circ(px, py, r, '#f4fff9'); x.fillStyle = '#5fd7b0'; x.fillRect(54, 52, 12, 36); x.fillRect(42, 64, 36, 12); break;
    case 'boulder': circ(60, 80, 40, '#9aa0a8'); circ(46, 66, 10, '#b8bec6'); circ(76, 94, 8, '#7d838c'); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 4; for (const y of [40, 60, 80]) { x.beginPath(); x.moveTo(6, y + 20); x.lineTo(18, y + 20); x.stroke(); } break;
  }
  return c;
}

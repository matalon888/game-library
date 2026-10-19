// karts.js — Skidsy's eight original drivers and their go-karts, each baked into one vertex-coloured mesh (1 draw call).
import { THREE, rounded } from './kit/hc.js';
import { bake } from './merge.js';

// unlock: earned by play only (see game.js unlocked())
export const DRIVERS = [
  { id: 'pip', name: 'Pip', kind: 'penguin', body: '#2b2d42', head: '#2b2d42', face: '#ffffff', kart: '#3a86ff', trim: '#ffd23f', emoji: '🐧' },
  { id: 'bun', name: 'Bunbun', kind: 'bunny', body: '#ffffff', head: '#ffffff', face: '#ffd6e4', kart: '#ff5d8f', trim: '#ffffff', emoji: '🐰' },
  { id: 'moko', name: 'Moko', kind: 'bear', body: '#a86b3c', head: '#b9783f', face: '#f0c99a', kart: '#ffb02e', trim: '#2b2d42', emoji: '🐻' },
  { id: 'fizz', name: 'Fizz', kind: 'frog', body: '#5cc94f', head: '#6fd65a', face: '#e8ffc8', kart: '#2ec4b6', trim: '#ffd23f', emoji: '🐸' },
  { id: 'mimi', name: 'Mimi', kind: 'cat', body: '#ff9a3d', head: '#ffa64f', face: '#fff1dd', kart: '#7b5cff', trim: '#ffd23f', emoji: '🐱', need: 'Finish 3 races' },
  { id: 'duck', name: 'Quackers', kind: 'duck', body: '#ffd23f', head: '#ffdd55', face: '#ffffff', kart: '#ff3b5c', trim: '#ffffff', emoji: '🦆', need: 'Win a race' },
  { id: 'bolt', name: 'Bolt', kind: 'robot', body: '#9aa7c7', head: '#c3cde6', face: '#4fe3ff', kart: '#ff7b2e', trim: '#2b2d42', emoji: '🤖', need: 'Win any cup trophy' },
  { id: 'tako', name: 'Tako', kind: 'octo', body: '#ff6fa8', head: '#ff7fb3', face: '#ffe0ee', kart: '#19c3e6', trim: '#ffffff', emoji: '🐙', need: 'Win a Mirror Cup trophy' },
];

const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const C = (r, l, s = 6, rs = 12) => new THREE.CapsuleGeometry(r, l, s, rs);
const Cy = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s);

/** one baked mesh: kart + driver, facing +z, wheels excluded (instanced separately) */
export function kartGeo(d) {
  const P = [], dark = '#2b2d42', chrome = '#e6e9f2';
  // ---- kart
  P.push({ geo: rounded(1.55, 0.32, 2.3, 0.12), color: d.kart, pos: [0, 0.42, 0.05] });
  P.push({ geo: rounded(1.2, 0.34, 0.75, 0.14), color: d.kart, pos: [0, 0.55, 1.05], rot: [-0.25, 0, 0] });
  P.push({ geo: rounded(1.7, 0.2, 0.32, 0.08), color: dark, pos: [0, 0.38, 1.42] });
  P.push({ geo: rounded(0.5, 0.26, 0.06, 0.03), color: '#ffffff', pos: [0, 0.6, 1.47] });
  for (const sx of [-1, 1]) P.push({ geo: rounded(0.32, 0.36, 1.45, 0.1), color: d.trim, pos: [sx * 0.8, 0.5, -0.05] });
  P.push({ geo: rounded(0.95, 0.75, 0.28, 0.1), color: dark, pos: [0, 0.92, -0.62], rot: [-0.22, 0, 0] });
  P.push({ geo: rounded(1.0, 0.5, 0.6, 0.1), color: '#7c8296', pos: [0, 0.78, -1.08] });
  for (const sx of [-1, 1]) P.push({ geo: Cy(0.11, 0.13, 0.55, 10), color: chrome, pos: [sx * 0.3, 0.8, -1.42], rot: [Math.PI / 2 - 0.3, 0, 0] });
  P.push({ geo: rounded(1.9, 0.12, 0.4, 0.05), color: d.kart, pos: [0, 1.38, -1.15] });          // little rear wing
  for (const sx of [-1, 1]) P.push({ geo: Cy(0.05, 0.05, 0.5, 6), color: dark, pos: [sx * 0.55, 1.12, -1.15] });
  P.push({ geo: new THREE.TorusGeometry(0.24, 0.05, 6, 16), color: dark, pos: [0, 1.05, 0.38], rot: [-0.9, 0, 0] });
  P.push({ geo: Cy(0.04, 0.04, 0.4, 6), color: dark, pos: [0, 0.9, 0.5], rot: [-0.9, 0, 0] });
  // ---- driver (big toy head)
  const k = d.kind, hy = 1.95;
  P.push({ geo: C(0.36, 0.35), color: d.body, pos: [0, 1.15, -0.32] });
  for (const sx of [-1, 1]) P.push({ geo: C(0.1, 0.42, 4, 8), color: d.body, pos: [sx * 0.3, 1.18, 0.02], rot: [1.15, 0, -sx * 0.35] });
  for (const sx of [-1, 1]) P.push({ geo: S(0.12, 10, 8), color: k === 'robot' ? '#7c8296' : d.face, pos: [sx * 0.22, 1.05, 0.33] });
  const head = (r, col, sc = [1, 1, 1]) => P.push({ geo: S(r, 22, 16), color: col, pos: [0, hy, -0.2], scl: sc });
  const eye = (x, y, z, r = 0.13) => { P.push({ geo: S(r, 12, 10), color: '#ffffff', pos: [x, y, z] }); P.push({ geo: S(r * 0.52, 10, 8), color: '#1b1b28', pos: [x, y, z + r * 0.65] }); P.push({ geo: S(r * 0.18, 6, 5), color: '#ffffff', pos: [x + r * 0.2, y + r * 0.25, z + r * 0.92] }); };
  if (k === 'penguin') {
    head(0.6, d.head); P.push({ geo: S(0.48, 18, 14), color: d.face, pos: [0, hy - 0.08, 0.08], scl: [1, 0.95, 0.75] });
    eye(-0.2, hy + 0.08, 0.37); eye(0.2, hy + 0.08, 0.37);
    P.push({ geo: new THREE.ConeGeometry(0.13, 0.32, 10), color: '#ff9b2e', pos: [0, hy - 0.12, 0.5], rot: [Math.PI / 2, 0, 0] });
    P.push({ geo: C(0.3, 0.1, 4, 10), color: '#ff3b5c', pos: [0, hy - 0.52, -0.15], rot: [0, 0, Math.PI / 2], scl: [1, 1.6, 1] });   // scarf
  } else if (k === 'bunny') {
    head(0.58, d.head); eye(-0.2, hy + 0.06, 0.36); eye(0.2, hy + 0.06, 0.36);
    for (const sx of [-1, 1]) { P.push({ geo: C(0.13, 0.7, 4, 10), color: d.head, pos: [sx * 0.22, hy + 0.85, -0.3], rot: [-0.2, 0, -sx * 0.18] }); P.push({ geo: C(0.07, 0.55, 4, 8), color: '#ffb3cc', pos: [sx * 0.22, hy + 0.85, -0.2], rot: [-0.2, 0, -sx * 0.18] }); }
    P.push({ geo: S(0.08, 8, 6), color: '#ff7fa8', pos: [0, hy - 0.1, 0.55] });
    for (const sx of [-1, 1]) P.push({ geo: S(0.11, 8, 6), color: '#ffc4d8', pos: [sx * 0.34, hy - 0.16, 0.38] });
  } else if (k === 'bear') {
    head(0.6, d.head); eye(-0.21, hy + 0.1, 0.38, 0.12); eye(0.21, hy + 0.1, 0.38, 0.12);
    for (const sx of [-1, 1]) { P.push({ geo: S(0.2, 12, 10), color: d.head, pos: [sx * 0.44, hy + 0.44, -0.25] }); P.push({ geo: S(0.11, 10, 8), color: d.face, pos: [sx * 0.44, hy + 0.44, -0.13] }); }
    P.push({ geo: S(0.27, 14, 10), color: d.face, pos: [0, hy - 0.15, 0.33], scl: [1, 0.8, 0.8] }); P.push({ geo: S(0.09, 8, 6), color: '#2b2d42', pos: [0, hy - 0.06, 0.53] });
  } else if (k === 'frog') {
    head(0.58, d.head, [1.15, 0.85, 1]); P.push({ geo: S(0.48, 16, 12), color: d.face, pos: [0, hy - 0.2, 0.06], scl: [1.1, 0.6, 0.9] });
    for (const sx of [-1, 1]) { P.push({ geo: S(0.22, 14, 10), color: d.head, pos: [sx * 0.3, hy + 0.38, 0.05] }); eye(sx * 0.3, hy + 0.42, 0.16, 0.15); }
    P.push({ geo: new THREE.TorusGeometry(0.22, 0.03, 6, 16, Math.PI), color: '#2b6b2b', pos: [0, hy - 0.12, 0.42], rot: [0, 0, Math.PI] });
  } else if (k === 'cat') {
    head(0.58, d.head); eye(-0.21, hy + 0.06, 0.37); eye(0.21, hy + 0.06, 0.37);
    for (const sx of [-1, 1]) { P.push({ geo: new THREE.ConeGeometry(0.2, 0.42, 4), color: d.head, pos: [sx * 0.33, hy + 0.58, -0.25], rot: [0, 0, -sx * 0.3] }); P.push({ geo: new THREE.ConeGeometry(0.1, 0.25, 4), color: '#ffc4d8', pos: [sx * 0.32, hy + 0.55, -0.17], rot: [0, 0, -sx * 0.3] }); }
    P.push({ geo: S(0.2, 12, 10), color: d.face, pos: [0, hy - 0.17, 0.36], scl: [1.3, 0.8, 0.8] }); P.push({ geo: S(0.07, 8, 6), color: '#ff7fa8', pos: [0, hy - 0.06, 0.55] });
    for (const sx of [-1, 1]) for (const dy of [-0.04, 0.06]) P.push({ geo: Cy(0.012, 0.012, 0.4, 4), color: '#2b2d42', pos: [sx * 0.42, hy - 0.14 + dy, 0.4], rot: [0, 0, Math.PI / 2] });
    P.push({ geo: new THREE.TorusGeometry(0.4, 0.07, 6, 14, Math.PI * 0.9), color: d.body, pos: [0, 1.1, -0.85], rot: [0, Math.PI / 2, 0] });
  } else if (k === 'duck') {
    head(0.56, d.head); eye(-0.19, hy + 0.1, 0.35); eye(0.19, hy + 0.1, 0.35);
    P.push({ geo: S(0.24, 14, 10), color: '#ff8c1a', pos: [0, hy - 0.16, 0.5], scl: [1.2, 0.45, 1.2] });
    P.push({ geo: C(0.06, 0.25, 4, 6), color: d.head, pos: [0, hy + 0.65, -0.1], rot: [0.5, 0, 0] });
    P.push({ geo: rounded(0.75, 0.16, 0.75, 0.07), color: '#3a86ff', pos: [0, hy + 0.5, -0.25] });          // sailor cap
  } else if (k === 'robot') {
    P.push({ geo: rounded(1.0, 0.9, 0.95, 0.2), color: d.head, pos: [0, hy, -0.2] });
    P.push({ geo: rounded(0.8, 0.36, 0.1, 0.1), color: '#22263a', pos: [0, hy + 0.05, 0.28] });
    for (const sx of [-1, 1]) P.push({ geo: S(0.08, 10, 8), color: d.face, pos: [sx * 0.18, hy + 0.05, 0.34] });
    P.push({ geo: Cy(0.03, 0.03, 0.45, 6), color: '#7c8296', pos: [0, hy + 0.65, -0.2] }); P.push({ geo: S(0.1, 10, 8), color: '#ff3b5c', pos: [0, hy + 0.9, -0.2] });
    for (const sx of [-1, 1]) P.push({ geo: Cy(0.14, 0.14, 0.12, 12), color: '#7c8296', pos: [sx * 0.54, hy, -0.2], rot: [0, 0, Math.PI / 2] });
  } else {   // octo
    head(0.62, d.head, [1, 1.12, 1]); eye(-0.2, hy - 0.02, 0.4, 0.14); eye(0.2, hy - 0.02, 0.4, 0.14);
    for (let i = 0; i < 4; i++) P.push({ geo: S(0.07 + (i % 2) * 0.02, 8, 6), color: '#ffd1e4', pos: [-0.28 + i * 0.18, hy + 0.42, 0.32] });
    for (const sx of [-1, 1]) P.push({ geo: C(0.09, 0.5, 4, 8), color: d.body, pos: [sx * 0.55, 1.3, -0.5], rot: [0.6, 0, sx * 0.9] });
    P.push({ geo: new THREE.TorusGeometry(0.12, 0.035, 6, 12), color: '#c2185b', pos: [0, hy - 0.3, 0.52] });
  }
  return bake(P);
}

/** wheel geometry (axis along x), shared by all karts via one InstancedMesh */
export function wheelGeo() {
  const g = bake([
    { geo: new THREE.CylinderGeometry(0.4, 0.4, 0.36, 18), color: '#23232e', rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.22, 0.22, 0.38, 12), color: '#e6e9f2', rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.TorusGeometry(0.4, 0.05, 6, 18), color: '#3a3a4a', rot: [0, Math.PI / 2, 0], pos: [0.18, 0, 0] },
    { geo: new THREE.BoxGeometry(0.4, 0.82, 0.1), color: '#2f2f3d' },
  ]);
  return g;
}
export const WHEELS = [[-0.86, 0.4, 0.88, 1], [0.86, 0.4, 0.88, 1], [-0.88, 0.4, -0.85, 0], [0.88, 0.4, -0.85, 0]];

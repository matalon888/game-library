// Zoomburst world: street circuits built from filleted polygons through a sunny, colourful toy-city: shops, palms, billboards, tunnels, a bridge.
// Everything is generated in code and merged into a handful of meshes (one material each) to stay cheap on phones.
import { THREE } from './kit/cine.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { rng } from './kit/hc.js';

export const W = 9;           // road half width (4 lanes)
const DS = 2;                 // sample spacing (m)

export const THEMES = [   // bright, sunny, saturated (Asphalt-meets-Subway-Surfers)
  { sky: ['#2f7cff', '#78b8ff', '#ffe2b8'], sun: '#fff0d0', sunEl: 0.75, sunAz: 0.6, hemi: ['#cfe6ff', '#f2c79a'], fog: '#cfe2f5', steel: '#ff4a3d', water: '#19b4d4', accent: ['#ff4a6e', '#ffc93c', '#2ec4ff', '#7bd651', '#a46bff'], bld: ['#ff8a7a', '#ffd36e', '#7fd8c4', '#8ec5ff', '#c9a7ff', '#ffb3d1', '#f6f0e4', '#9be37a', '#ffa94d'] },
  { sky: ['#5a6bff', '#a99bff', '#ffc4d8'], sun: '#ffe6e0', sunEl: 0.55, sunAz: 2.2, hemi: ['#e2d6ff', '#ffc2c8'], fog: '#e8d6f0', steel: '#ffffff', water: '#4cc8e0', accent: ['#ff4fa3', '#ffd23f', '#38e0d0', '#8c6bff', '#ff7a45'], bld: ['#ffb3d1', '#c9a7ff', '#ffe08a', '#a8f0e0', '#ff9a8a', '#fff4f8', '#b8d8ff', '#ffc78a'] },
  { sky: ['#3b5bd6', '#ff9a6b', '#ffd27a'], sun: '#ffc27a', sunEl: 0.28, sunAz: 4.0, hemi: ['#ffe6c8', '#b88a6a'], fog: '#ffd8b0', steel: '#d93a2b', water: '#2aa2c0', accent: ['#ff3b30', '#ffb000', '#ff6bb5', '#3ad1ff', '#7bd651'], bld: ['#ff9a6b', '#ffd27a', '#7fd8c4', '#f4e2c8', '#ffb38a', '#8ec5ff', '#ff7a7a', '#c9a7ff'] },
  { sky: ['#1e6cff', '#5cb0ff', '#d6f0ff'], sun: '#ffffff', sunEl: 0.95, sunAz: 5.2, hemi: ['#d6ecff', '#d8c8a8'], fog: '#d6ebff', steel: '#ffffff', water: '#12a8d8', accent: ['#2ec4ff', '#ff4a6e', '#ffd23f', '#5be37a', '#ff8a2a'], bld: ['#8ec5ff', '#f6f0e4', '#7fd8c4', '#ffd36e', '#b0b8ff', '#ff8a7a', '#c8f0ff', '#ffb3d1'] },
  { sky: ['#2a62d8', '#8ab8f0', '#ffd8a0'], sun: '#ffdcaa', sunEl: 0.42, sunAz: 1.2, hemi: ['#d8e8ff', '#e0b080'], fog: '#e8dcc8', steel: '#ffc21a', water: '#1a98b8', accent: ['#7bd651', '#ffd23f', '#2ec4ff', '#ff6b2b', '#ff4fa3'], bld: ['#9be37a', '#ffd36e', '#ff9a5a', '#8ec5ff', '#f6f0e4', '#e0a87a', '#7fd8c4', '#ff8a7a'] },
];

// pts: [x, z, cornerRadius]; tunnel / bridge: [edge, from, to] = part of the polygon edge from vertex `edge` to the next
export const TRACKS = [
  { id: 'harbor', name: 'Harbor Run', kind: 'sprint', theme: 0, pts: [[0, -60], [0, 250, 60], [150, 400, 55], [150, 740, 70], [-30, 910, 60], [-30, 1090]], bridge: [2, 0.12, 0.88], tunnel: [4, 0.0, 0.4] },
  { id: 'candy', name: 'Candy Mile', kind: 'circuit', laps: 2, theme: 1, pts: [[0, 0], [420, 0, 50], [500, 80, 45], [500, 300, 50], [300, 300, 40], [300, 450, 40], [-100, 450, 55], [-100, 100, 50]], tunnel: [0, 0.3, 0.85], bridge: [5, 0.2, 0.8] },
  { id: 'lantern', name: 'Lantern Ward', kind: 'circuit', laps: 2, theme: 2, pts: [[0, 0], [200, 0, 35], [200, 130, 35], [320, 130, 35], [320, -100, 40], [460, -100, 45], [460, 280, 55], [-60, 280, 50], [-60, 0, 40]], tunnel: [3, 0.15, 0.8], bridge: [6, 0.15, 0.85] },
  { id: 'skyline', name: 'Skyline Dash', kind: 'sprint', theme: 3, pts: [[0, -60], [0, 380, 60], [-190, 590, 60], [-190, 880, 55], [110, 1080, 60], [400, 1080, 55], [400, 1420]], tunnel: [0, 0.3, 0.75], bridge: [4, 0.1, 0.9] },
  { id: 'dock', name: 'Dockside Ring', kind: 'circuit', laps: 3, theme: 4, pts: [[0, 0], [360, 0, 55], [430, 150, 45], [360, 300, 55], [180, 300, 35], [120, 230, 30], [0, 300, 45], [-70, 150, 50]], bridge: [0, 0.2, 0.85], tunnel: [3, 0.1, 0.9] },
];

// ---------------------------------------------------------------- path
function fillet(P, closed) {
  const out = [], n = P.length;
  const corner = (p0, p1, p2) => {
    let d1x = p1[0] - p0[0], d1z = p1[1] - p0[1]; const l1 = Math.hypot(d1x, d1z); d1x /= l1; d1z /= l1;
    let d2x = p2[0] - p1[0], d2z = p2[1] - p1[1]; const l2 = Math.hypot(d2x, d2z); d2x /= l2; d2z /= l2;
    const phi = Math.atan2(d1x * d2z - d1z * d2x, d1x * d2x + d1z * d2z);
    if (Math.abs(phi) < 1e-3) { out.push([p1[0], p1[1]]); return; }
    let r = p1[2] || 45, tl = r * Math.tan(Math.abs(phi) / 2);
    tl = Math.min(tl, 0.48 * l1, 0.48 * l2); r = tl / Math.tan(Math.abs(phi) / 2);
    const ax = p1[0] - d1x * tl, az = p1[1] - d1z * tl, sg = Math.sign(phi);
    const cx = ax + -d1z * r * sg, cz = az + d1x * r * sg, vx = ax - cx, vz = az - cz;
    const steps = Math.max(2, Math.ceil(r * Math.abs(phi) / 1.5));
    for (let j = 0; j <= steps; j++) { const a = phi * j / steps, c = Math.cos(a), s = Math.sin(a); out.push([cx + vx * c - vz * s, cz + vx * s + vz * c]); }
  };
  if (closed) {
    out.push([(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2]);
    for (let k = 1; k <= n; k++) corner(P[k - 1], P[k % n], P[(k + 1) % n]);
    out.push([(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2]);
  } else {
    out.push([P[0][0], P[0][1]]);
    for (let k = 1; k < n - 1; k++) corner(P[k - 1], P[k], P[k + 1]);
    out.push([P[n - 1][0], P[n - 1][1]]);
  }
  return out;
}

export class Track {
  constructor(def, rev = false) {
    this.def = def; this.rev = rev; this.closed = def.kind === 'circuit'; this.name = def.name;
    let P = def.pts.map(p => [p[0], p[1], p[2] || 45]);
    if (rev) P = P.slice().reverse();
    const poly = fillet(P, this.closed);
    const cum = [0]; for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const total = cum[cum.length - 1];
    const n = this.closed ? Math.round(total / DS) : Math.floor(total / DS) + 1, ds = this.closed ? total / n : DS;
    this.n = n; this.ds = ds; this.L = this.closed ? total : (n - 1) * ds;
    const A = k => new Float32Array(n);
    this.X = A(); this.Z = A(); this.Y = A(); this.TX = A(); this.TZ = A(); this.RX = A(); this.RZ = A(); this.K = A(); this.F = new Uint8Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * ds; while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
      this.X[i] = poly[j][0] + (poly[j + 1][0] - poly[j][0]) * f; this.Z[i] = poly[j][1] + (poly[j + 1][1] - poly[j][1]) * f;
    }
    const idx = i => this.closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i));
    for (let i = 0; i < n; i++) {
      const a = idx(i - 1), b = idx(i + 1); let tx = this.X[b] - this.X[a], tz = this.Z[b] - this.Z[a]; const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l; this.TX[i] = tx; this.TZ[i] = tz; this.RX[i] = -tz; this.RZ[i] = tx;
    }
    const H = new Float32Array(n); for (let i = 0; i < n; i++) H[i] = Math.atan2(this.TX[i], this.TZ[i]);
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) { let d = H[idx(i + 2)] - H[idx(i - 2)]; d = Math.atan2(Math.sin(d), Math.cos(d)); raw[i] = d / (4 * ds); }
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -3; k <= 3; k++) s += raw[idx(i + k)]; this.K[i] = s / 7; }
    // features: flag samples that sit on a given polygon edge (works for reversed tracks too)
    const mark = (feat, flag) => {
      if (!feat) return; const [e, a, b] = feat, p0 = def.pts[e], p1 = def.pts[(e + 1) % def.pts.length];
      const ex = p1[0] - p0[0], ez = p1[1] - p0[1], el = ex * ex + ez * ez;
      for (let i = 0; i < n; i++) {
        const u = ((this.X[i] - p0[0]) * ex + (this.Z[i] - p0[1]) * ez) / el; if (u < a || u > b) continue;
        const px = p0[0] + ex * u - this.X[i], pz = p0[1] + ez * u - this.Z[i]; if (px * px + pz * pz < 1) this.F[i] = flag;
      }
    };
    mark(def.tunnel, 1); mark(def.bridge, 2);
    // bridge hump
    for (let i = 0; i < n; i++) if (this.F[i] === 2) {
      let a = i; while (this.F[idx(a - 1)] === 2 && a > 0) a--; let b = i; while (this.F[idx(b + 1)] === 2 && b < n - 1) b++;
      for (let k = a; k <= b; k++) { const u = (k - a) / Math.max(1, b - a); this.Y[k] = 4.5 * (1 - Math.cos(u * Math.PI * 2)) / 2; }
      i = b;
    }
    this.startS = this.closed ? 0 : 70;
    this.finishS = this.closed ? this.L : this.L - 120;
    // spatial grid for distance queries
    this.cell = 24; this.grid = new Map();
    for (let i = 0; i < n; i++) { const k = this.key(Math.floor(this.X[i] / this.cell), Math.floor(this.Z[i] / this.cell)); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i); }
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (let i = 0; i < n; i++) { minx = Math.min(minx, this.X[i]); maxx = Math.max(maxx, this.X[i]); minz = Math.min(minz, this.Z[i]); maxz = Math.max(maxz, this.Z[i]); }
    this.box = { minx, maxx, minz, maxz, cx: (minx + maxx) / 2, cz: (minz + maxz) / 2, r: Math.hypot(maxx - minx, maxz - minz) / 2 };
  }
  key(a, b) { return a * 73856 + b; }
  wrapI(i) { return this.closed ? ((i % this.n) + this.n) % this.n : Math.max(0, Math.min(this.n - 1, i)); }
  wrapS(s) { return this.closed ? ((s % this.L) + this.L) % this.L : s; }
  nearest(x, z, r = 60) {   // distance to the closest track sample within r (or r)
    const c = this.cell, a0 = Math.floor((x - r) / c), a1 = Math.floor((x + r) / c), b0 = Math.floor((z - r) / c), b1 = Math.floor((z + r) / c);
    let best = r * r, bi = -1;
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const L = this.grid.get(this.key(a, b)); if (!L) continue; for (const i of L) { const dx = this.X[i] - x, dz = this.Z[i] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } } }
    return { d: Math.sqrt(best), i: bi };
  }
  // project a world point onto the track near sample `hint` -> out {i, s, d}
  locate(x, z, hint, out) {
    let bi = 0, best = 1e18;
    if (hint < 0) { for (let i = 0; i < this.n; i++) { const dx = this.X[i] - x, dz = this.Z[i] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } } }
    else for (let k = -10; k <= 26; k++) { const i = this.wrapI(hint + k), dx = this.X[i] - x, dz = this.Z[i] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const dx = x - this.X[bi], dz = z - this.Z[bi];
    out.i = bi; out.s = this.wrapS(bi * this.ds + dx * this.TX[bi] + dz * this.TZ[bi]); out.d = dx * this.RX[bi] + dz * this.RZ[bi];
    return out;
  }
  at(s, out) {   // interpolated frame at distance s
    s = this.wrapS(s); if (!this.closed) s = Math.max(0, Math.min(this.L - 0.001, s));
    const f = s / this.ds, i = Math.floor(f), j = this.wrapI(i + 1), t = f - i, a = this.wrapI(i);
    out.x = this.X[a] + (this.X[j] - this.X[a]) * t; out.z = this.Z[a] + (this.Z[j] - this.Z[a]) * t; out.y = this.Y[a] + (this.Y[j] - this.Y[a]) * t;
    out.tx = this.TX[a]; out.tz = this.TZ[a]; out.rx = this.RX[a]; out.rz = this.RZ[a]; out.i = a; out.k = this.K[a];
    return out;
  }
  yAt(i, along) { const j = this.wrapI(i + 1); return this.Y[i] + (this.Y[j] - this.Y[i]) * Math.max(0, Math.min(1, along / this.ds)); }
}

// ---------------------------------------------------------------- stylised materials (toon ramp + inverted-hull outlines)
export const RAMP = (() => { const d = new Uint8Array([105, 180, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...o });
export const INK = '#1b1530';
// outline: pushes vertices along a baked 'onorm' attribute (box corners expand diagonally, so merged geometry gets a closed hull)
export function outlineMat(th = 0.06, color = INK) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.uniforms.uTh = { value: th };
    s.vertexShader = 'attribute vec3 onorm;\nuniform float uTh;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += onorm * uTh;');
  };
  m.customProgramCacheKey = () => 'outline';
  return m;
}

// ---------------------------------------------------------------- textures
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep = true) => { const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

function roadTexture(R) {
  const [c, x] = cv(512, 1024);
  x.fillStyle = '#545866'; x.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 16000; i++) { const v = 70 + R() * 40 | 0; x.fillStyle = `rgba(${v},${v},${v + 8},${0.35 + R() * 0.4})`; x.fillRect(R() * 512, R() * 1024, 2 + R() * 2, 2 + R() * 2); }
  for (const u of [0.125, 0.375, 0.625, 0.875]) { const g = x.createLinearGradient((u - 0.06) * 512, 0, (u + 0.06) * 512, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(30,30,40,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect((u - 0.06) * 512, 0, 0.12 * 512, 1024); }
  for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(40,42,52,${0.25 + R() * 0.2})`; x.beginPath(); x.roundRect(R() * 470, R() * 980, 30 + R() * 50, 40 + R() * 120, 8); x.fill(); }
  x.fillStyle = '#ffffff'; x.fillRect(0.02 * 512, 0, 10, 1024); x.fillRect(0.98 * 512 - 10, 0, 10, 1024);
  for (const u of [0.25, 0.75]) for (let y = 0; y < 1024; y += 256) x.fillRect(u * 512 - 4, y + 20, 8, 120);
  x.fillStyle = '#ffc81e'; x.fillRect(0.5 * 512 - 11, 0, 8, 1024); x.fillRect(0.5 * 512 + 3, 0, 8, 1024);
  // painted arrows
  x.fillStyle = 'rgba(255,255,255,.9)';
  for (const u of [0.125, 0.875]) { x.save(); x.translate(u * 512, 600); x.beginPath(); x.moveTo(-10, 80); x.lineTo(10, 80); x.lineTo(10, 0); x.lineTo(26, 0); x.lineTo(0, -40); x.lineTo(-26, 0); x.lineTo(-10, 0); x.fill(); x.restore(); }
  return tex(c);
}

function facadeTexture(R) {
  // white walls (tinted per building via vertex colour) with glassy blue windows, frames, a few curtains and plants
  const [c, x] = cv(512, 512);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(0,0,0,${0.02 + R() * 0.03})`; x.fillRect(R() * 512, R() * 512, 3, 3); }
  for (let gy = 0; gy < 8; gy++) {
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, gy * 64 + 60, 512, 4);
    for (let gx = 0; gx < 8; gx++) {
      const X = gx * 64, Y = gy * 64;
      x.fillStyle = '#eae4da'; x.fillRect(X + 8, Y + 10, 48, 44);
      const g = x.createLinearGradient(X, Y + 14, X + 40, Y + 52); g.addColorStop(0, '#5da8e8'); g.addColorStop(1, '#23466e'); x.fillStyle = g; x.fillRect(X + 12, Y + 14, 40, 36);
      x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(X + 14, Y + 48); x.lineTo(X + 30, Y + 16); x.lineTo(X + 37, Y + 16); x.lineTo(X + 21, Y + 48); x.fill();
      const r = R();
      if (r < 0.18) { x.fillStyle = ['#ff6b6b', '#ffd23f', '#5be37a', '#ff9de0'][(R() * 4) | 0]; x.fillRect(X + 12, Y + 14, 12, 36); x.fillRect(X + 40, Y + 14, 12, 36); }
      else if (r < 0.3) { x.fillStyle = '#f6f0e4'; x.fillRect(X + 12, Y + 14, 40, 14); }
      x.fillStyle = '#ffffff'; x.fillRect(X + 31, Y + 14, 2, 36);
      if (R() < 0.12) { x.fillStyle = '#3aa64a'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(X + 16 + k * 10, Y + 52, 6, 0, 7); x.fill(); } x.fillStyle = '#b5523b'; x.fillRect(X + 10, Y + 54, 44, 6); }
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(X + 8, Y + 54, 48, 3);
    }
  }
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 8, 8);
  return tex(c);
}

const SIGNS = ['NOODLE ROCKET', 'KAIJU BAR', 'HOTEL ORBIT', 'PIXEL DINER', 'ZAP ARCADE', 'MOON KARAOKE', 'BLUE LOTUS', '24/7 MART', 'SURF SHACK', 'NIGHT OWL', 'TACO LUX', 'DISCO 9', 'GELATO', 'GARAGE 88', 'BOBA', 'LUCKY CAT'];
const ADS = [['ZYNTH', 'FEEL THE BASS', '#ff2bd6', '#5b2bff'], ['AURORA AIR', 'FLY HAPPY', '#00c8ff', '#0060ff'], ['KIBO', 'NOODLES 24H', '#ffb000', '#ff4a2a'], ['PULSE 9', 'THE PHONE THAT POPS', '#38e0b0', '#0a9a8a'],
  ['ZOOMBURST', 'STREET LEAGUE', '#ff4d6d', '#ffb000'], ['VOLTRA', 'ENERGY SODA', '#a8ff2a', '#18a84a'], ['MIRA', 'HOTELS & POOLS', '#ffd6a0', '#ff7a45'], ['DRIFT CLUB', 'SATURDAY 6PM', '#b44dff', '#ff4fa3']];
const GW = ['ZOOM', 'VROOM', 'GO!', 'WOW', 'POW', 'YO!', 'FAST', 'HEY', 'ZAP', 'BURN'];
export const ROWS = 10;
export function signAtlas(lite) {
  const S = lite ? 0.5 : 1, [c, x] = cv(2048 * S, 256 * ROWS * S); x.scale(S, S);
  x.clearRect(0, 0, 2048, 256 * ROWS);
  const cell = (k, f) => { const cx = (k % 4) * 512, cy = Math.floor(k / 4) * 256; x.save(); x.translate(cx, cy); x.beginPath(); x.rect(0, 0, 512, 256); x.clip(); f(); x.restore(); };
  const pal = ['#ff4a6e', '#ffb000', '#2ec4ff', '#7bd651', '#a46bff', '#ff7a2a', '#ff4fa3', '#14b8a6'];
  SIGNS.forEach((t, k) => cell(k, () => {   // painted shop boards
    const bg = pal[k % pal.length], fg = k % 3 === 0 ? '#ffe680' : '#ffffff';
    x.fillStyle = INK; x.beginPath(); x.roundRect(4, 4, 504, 248, 40); x.fill();
    x.fillStyle = bg; x.beginPath(); x.roundRect(14, 14, 484, 228, 32); x.fill();
    x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.roundRect(26, 22, 460, 70, 26); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; const fs = Math.min(140, 860 / Math.max(4, t.length));
    x.font = `${k % 2 ? 'italic 900' : '900'} ${fs}px "Arial Black", Impact, sans-serif`; x.lineJoin = 'round';
    x.lineWidth = 16; x.strokeStyle = INK; x.strokeText(t, 256, 134); x.fillStyle = fg; x.fillText(t, 256, 134);
    x.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(40 + i * 54, 236, 5, 0, 7); x.fill(); }
  }));
  ADS.forEach(([t, s, c1, c2], k) => cell(16 + k, () => {   // billboards
    const g = x.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(380, 128); x.arc(380, 128, 300, i * 1.05, i * 1.05 + 0.4); x.fill(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(410, 128, 70, 0, 7); x.fill(); x.fillStyle = c2; x.beginPath(); x.arc(410, 128, 52, 0, 7); x.fill();
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    x.font = `italic 900 ${t.length > 7 ? 66 : 88}px "Arial Black", Impact, sans-serif`; x.lineWidth = 14; x.strokeStyle = INK; x.strokeText(t, 26, 140); x.fillStyle = '#fff'; x.fillText(t, 26, 140);
    x.font = '800 30px system-ui, sans-serif'; x.lineWidth = 8; x.strokeText(s, 30, 192); x.fillStyle = '#ffe680'; x.fillText(s, 30, 192);
    x.strokeStyle = INK; x.lineWidth = 12; x.strokeRect(6, 6, 500, 244);
  }));
  for (let k = 0; k < 4; k++) cell(24 + k, () => {   // shop windows (bright interiors)
    const tones = [['#fff4d6', '#ffcf8a'], ['#e6f6ff', '#9fd8ff'], ['#ffe6f4', '#ffb0d8'], ['#efffe0', '#b8f08a']][k];
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, tones[0]); g.addColorStop(1, tones[1]); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    const goods = ['#ff4a6e', '#ffb000', '#2ec4ff', '#7bd651', '#a46bff'];
    for (let i = 0; i < 4; i++) { x.fillStyle = '#c99a6a'; x.fillRect(16 + i * 124, 120, 100, 8); x.fillRect(16 + i * 124, 180, 100, 8);
      for (let j = 0; j < 5; j++) { x.fillStyle = goods[(i + j + k) % 5]; x.fillRect(20 + i * 124 + j * 19, 96, 14, 24); x.fillRect(22 + i * 124 + j * 19, 158, 14, 22); } }
    x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.moveTo(40, 256); x.lineTo(140, 0); x.lineTo(190, 0); x.lineTo(90, 256); x.fill();
    x.fillStyle = INK; x.fillRect(0, 0, 512, 12); x.fillRect(0, 244, 512, 12); for (let i = 0; i <= 4; i++) x.fillRect(i * 125, 0, 12, 256);
    x.fillStyle = '#fff'; x.font = '900 28px system-ui'; x.fillText('OPEN', 200, 60);
  });
  cell(28, () => { x.fillStyle = '#e8232f'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { x.beginPath(); const o = 60 + i * 150; x.moveTo(o, 30); x.lineTo(o + 90, 128); x.lineTo(o, 226); x.lineTo(o + 40, 226); x.lineTo(o + 130, 128); x.lineTo(o + 40, 30); x.fill(); } });
  for (const [k, t] of [[29, 'START'], [30, 'FINISH']]) cell(k, () => {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : INK; x.fillRect(i * 32, j * 24, 32, 24); x.fillStyle = (i + j) % 2 ? INK : '#fff'; x.fillRect(i * 32, 208 + j * 24, 32, 24); }
    x.fillStyle = '#ff2d55'; x.fillRect(0, 48, 512, 160); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'italic 900 118px "Arial Black", Impact, sans-serif';
    x.lineWidth = 14; x.strokeStyle = INK; x.strokeText(t, 256, 130); x.fillStyle = '#fff'; x.fillText(t, 256, 130);
  });
  cell(31, () => { x.fillStyle = '#ffc81e'; x.fillRect(0, 0, 512, 256); x.fillStyle = INK; for (let i = -4; i < 12; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 - 32, 256); x.lineTo(i * 64 - 64, 256); x.fill(); } });   // hazard stripes (ramps)
  const aw = [['#ff4a6e', '#ffffff'], ['#2ec4ff', '#ffffff'], ['#ffb000', '#ffffff'], ['#7bd651', '#ffffff']];
  aw.forEach(([a, b], k) => cell(32 + k, () => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 32, 0, 32, 256); } x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(0, 200, 512, 56);
    x.fillStyle = INK; x.fillRect(0, 244, 512, 12); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? b : a; x.beginPath(); x.arc(i * 32 + 16, 244, 16, 0, Math.PI); x.fill(); } }));
  for (let k = 0; k < 4; k++) cell(36 + k, () => {   // graffiti (transparent background)
    let r = k * 977 + 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const cols = ['#ff3d7f', '#2fd3ff', '#ffd23f', '#7cff6b', '#a45dff', '#ff8c1a'];
    for (let i = 0; i < 2; i++) { const word = GW[(k * 2 + i) % GW.length], col = cols[(k + i * 3) % 6];
      x.save(); x.translate(40 + i * 240, 160 + rnd() * 30); x.rotate((rnd() - 0.5) * 0.3); x.font = `900 ${90 + rnd() * 30}px Impact, "Arial Black", sans-serif`; x.lineJoin = 'round';
      x.lineWidth = 20; x.strokeStyle = INK; x.strokeText(word, 0, 0); x.lineWidth = 8; x.strokeStyle = '#fff'; x.strokeText(word, 0, 0); x.fillStyle = col; x.fillText(word, 0, 0);
      x.fillStyle = cols[(k + i * 3 + 2) % 6]; x.fillRect(4, -40, x.measureText(word).width - 8, 14);
      for (let d = 0; d < 6; d++) { x.fillStyle = col; x.fillRect(rnd() * 200, 10, 6, 10 + rnd() * 40); }
      x.restore(); }
    for (let d = 0; d < 14; d++) { x.fillStyle = cols[(d + k) % 6]; x.beginPath(); x.arc(rnd() * 512, rnd() * 256, 3 + rnd() * 8, 0, 7); x.fill(); }
  });
  return tex(c, false);
}
const cellUV = k => [(k % 4) / 4, 1 - (Math.floor(k / 4) + 1) / ROWS, 1 / 4, 1 / ROWS];

function barrierTexture(theme) {
  const [c, x] = cv(1024, 128);
  x.fillStyle = '#f2ede4'; x.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 1024; i += 128) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(i, 0, 4, 128); }
  const acc = theme.accent; for (let i = 0; i < 8; i++) { x.fillStyle = acc[i % acc.length]; x.fillRect(i * 128 + 4, 0, 124, 26); }
  let r = 5; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 5; i++) { const w = GW[(rnd() * GW.length) | 0], col = acc[(rnd() * acc.length) | 0];
    x.save(); x.translate(30 + i * 200 + rnd() * 30, 108); x.rotate((rnd() - 0.5) * 0.2); x.font = `900 ${58 + rnd() * 16}px Impact, "Arial Black", sans-serif`; x.lineJoin = 'round';
    x.lineWidth = 12; x.strokeStyle = INK; x.strokeText(w, 0, 0); x.lineWidth = 5; x.strokeStyle = '#fff'; x.strokeText(w, 0, 0); x.fillStyle = col; x.fillText(w, 0, 0); x.restore(); }
  return tex(c);
}
function curbTexture() { const [c, x] = cv(64, 128); for (let i = 0; i < 2; i++) { x.fillStyle = i ? '#ffffff' : '#ff2d3c'; x.fillRect(0, i * 64, 64, 64); } return tex(c); }
function paveTexture(R) {
  const [c, x] = cv(256, 256); x.fillStyle = '#d8cfc0'; x.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) { const v = R() * 20 | 0; x.fillStyle = `rgb(${210 - v},${200 - v},${186 - v})`; x.fillRect(i * 64 + (j % 2) * 32 + 2, j * 32 + 2, 60, 28); }
  return tex(c);
}
function tileTexture() {
  const [c, x] = cv(256, 256); x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) { x.fillStyle = j === 2 ? '#2ec4ff' : j === 3 ? '#ffffff' : '#f4f1ea'; x.fillRect(i * 16 + 1, j * 32 + 1, 14, 30); }
  return tex(c);
}

// ---------------------------------------------------------------- geometry helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _v = new THREE.Vector3();
const C = new THREE.Color();
// every geometry gets: position, normal, uv, color, onorm (outline direction)
export function fin(g, col = '#ffffff', k = 1) {
  if (!g.attributes.color) { C.set(col); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = C.r * k; a[i * 3 + 1] = C.g * k; a[i * 3 + 2] = C.b * k; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  if (!g.attributes.onorm) g.setAttribute('onorm', g.attributes.normal.clone());
  return g;
}
export function box(w, h, d) {   // box with corner-expanding outline normals
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, o = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { o[i * 3] = Math.sign(p.getX(i)); o[i * 3 + 1] = Math.sign(p.getY(i)); o[i * 3 + 2] = Math.sign(p.getZ(i)); }
  g.setAttribute('onorm', new THREE.BufferAttribute(o, 3)); return g;
}
export function place(g, x, y, z, yaw = 0, pitch = 0, roll = 0) {
  _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')); _m.compose(_p.set(x, y, z), _q, _s); g.applyMatrix4(_m);
  const o = g.attributes.onorm; if (o) for (let i = 0; i < o.count; i++) { _v.fromBufferAttribute(o, i).applyQuaternion(_q); o.setXYZ(i, _v.x, _v.y, _v.z); }
  return g;
}
function uvCell(g, k, flipU = false) { const [u0, v0, du, dv] = cellUV(k), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { let u = uv.getX(i); if (flipU) u = 1 - u; uv.setXY(i, u0 + (0.004 + u * 0.992) * du, v0 + (0.004 + uv.getY(i) * 0.992) * dv); } return g; }
function merge(list) { if (!list.length) return null; list.forEach(g => fin(g)); if (list.some(g => !g.index)) list = list.map(g => g.index ? g.toNonIndexed() : g); const g = mergeGeometries(list, false); list.forEach(x => x.dispose()); return g; }

function sweep(trk, i0, i1, segs, o = {}) {
  const loop = o.loop, cnt = loop ? trk.n + 1 : i1 - i0 + 1, S = (typeof segs === 'function' ? segs(i0) : segs).length;
  const pos = [], nor = [], uv = [], idx = [];
  for (let k = 0; k < S; k++) {
    const base = pos.length / 3;
    for (let j = 0; j < cnt; j++) {
      const i = loop ? j % trk.n : i0 + j, sg = (typeof segs === 'function' ? segs(i) : segs)[k], a = sg[0], b = sg[1];
      const x = trk.X[i], y = trk.Y[i], z = trk.Z[i], rx = trk.RX[i], rz = trk.RZ[i], tx = trk.TX[i], tz = trk.TZ[i];
      const ax = x + rx * a[0], az = z + rz * a[0], ay = y + a[1], bx = x + rx * b[0], bz = z + rz * b[0], by = y + b[1];
      pos.push(ax, ay, az, bx, by, bz);
      const ex = bx - ax, ey = by - ay, ez = bz - az; let nx = ey * tz, ny = ez * tx - ex * tz, nz = -ey * tx; const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l; nor.push(nx, ny, nz, nx, ny, nz);
      const v = (loop ? j : i) * trk.ds / (o.vScale || 8);
      if (o.unitU) uv.push(0, v, 1, v); else if (o.swap) uv.push(v, a[1] / (o.uScale || 1), v, b[1] / (o.uScale || 1)); else { const us = o.uScale || 4; uv.push((Math.abs(a[0]) + a[1]) / us, v, (Math.abs(b[0]) + b[1]) / us, v); }
    }
    for (let j = 0; j < cnt - 1; j++) { const p = base + j * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  if (o.color) fin(g, o.color, o.k || 1);
  return g;
}
const mirror = segs => segs.map(([a, b]) => [[-b[0], b[1]], [-a[0], a[1]]]);
const both = segs => segs.concat(mirror(segs));
function runs(trk) {
  const out = []; let st = 0;
  for (let i = 1; i <= trk.n; i++) if (i === trk.n || trk.F[i] !== trk.F[st]) { out.push([st, i - 1, trk.F[st]]); st = i; }
  if (trk.closed && out.length > 1 && out[0][2] === out[out.length - 1][2]) { const l = out.pop(); out[0] = [l[0] - trk.n, out[0][1], out[0][2]]; }
  return out;
}

// ---------------------------------------------------------------- environment + sky
export function skyEnv(renderer, theme) {   // bright sky + sun + colourful street for glossy paint reflections
  const s = new THREE.Scene();
  const skyM = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { a: { value: new THREE.Color(theme.sky[0]) }, b: { value: new THREE.Color(theme.sky[2]) } },
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 a,b; varying vec3 p; void main(){ float h = normalize(p).y; vec3 c = mix(b*1.2, a*1.1, smoothstep(0.0, 0.6, h)); if (h < 0.) c = mix(vec3(0.35,0.33,0.32), b*0.6, smoothstep(-0.4,0.,h)); gl_FragColor = vec4(c,1.); }' });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyM));
  const R = rng(7);
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4 + R() * 8, 6 + R() * 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.bld[i % theme.bld.length]).multiplyScalar(0.9), side: THREE.DoubleSide }));
    const a = R() * Math.PI * 2; m.position.set(Math.cos(a) * 30, 2 + R() * 6, Math.sin(a) * 30); m.lookAt(0, 3, 0); s.add(m);
  }
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.sun).multiplyScalar(30) }));
  sun.position.set(Math.cos(theme.sunAz) * 40 * Math.cos(theme.sunEl), Math.sin(theme.sunEl) * 40, Math.sin(theme.sunAz) * 40 * Math.cos(theme.sunEl)); s.add(sun);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(s, 0.02); pm.dispose();
  return rt.texture;
}
export function sunDir(theme) { return new THREE.Vector3(Math.cos(theme.sunAz) * Math.cos(theme.sunEl), Math.sin(theme.sunEl), Math.sin(theme.sunAz) * Math.cos(theme.sunEl)); }

function skyDome(theme) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cTop: { value: new THREE.Color(theme.sky[0]) }, cMid: { value: new THREE.Color(theme.sky[1]) }, cHor: { value: new THREE.Color(theme.sky[2]) }, sd: { value: sunDir(theme) }, sc: { value: new THREE.Color(theme.sun) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 cTop,cMid,cHor,sd,sc; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(cHor, cMid, smoothstep(0.0, 0.25, h)); c = mix(c, cTop, smoothstep(0.25, 0.85, h));
        float sm = max(dot(d, normalize(sd)), 0.);
        c += sc * (pow(sm, 900.) * 6. + pow(sm, 40.) * 0.35 + pow(sm, 6.) * 0.12);
        if (h < 0.) c = cHor;
        gl_FragColor = vec4(c, 1.); }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), m); s.frustumCulled = false; s.renderOrder = -10; return s;
}

// ---------------------------------------------------------------- world
export function buildWorld(scene, trk, theme, { lite = false, seed = 1 } = {}) {
  const R = rng(seed * 7919 + 13), G = new THREE.Group(); scene.add(G);
  const L = { road: [], pave: [], curb: [], barrier: [], bld: [], props: [], sign: [], steel: [], tunnel: [], glow: [], water: [], cloud: [], far: [] };
  const n = trk.n, F = trk.F, acc = () => theme.accent[(R() * theme.accent.length) | 0], bcol = () => theme.bld[(R() * theme.bld.length) | 0];
  const isB = i => F[trk.wrapI(i)] === 2, isT = i => F[trk.wrapI(i)] === 1;
  const bridgeIdx = []; for (let i = 0; i < n; i++) if (F[i] === 2) bridgeIdx.push(i);
  const distBridge = (x, z) => { let b = 1e9; for (let k = 0; k < bridgeIdx.length; k += 3) { const i = bridgeIdx[k]; b = Math.min(b, Math.hypot(trk.X[i] - x, trk.Z[i] - z)); } return b; };
  const yawAt = i => Math.atan2(trk.TX[i], trk.TZ[i]);
  const side = (i, sd, off) => [trk.X[i] + trk.RX[i] * sd * off, trk.Z[i] + trk.RZ[i] * sd * off];
  const cones = [], ramps = [];

  L.road.push(sweep(trk, 0, n - 1, [[[-W, 0.02], [W, 0.02]]], { loop: trk.closed, unitU: true, vScale: 24 }));
  // rumble curbs (corners)
  const outW = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let w = 64;
    if (bridgeIdx.length && F[i] !== 2) for (const sd of [-1, 1]) for (let t = 64; t > 8; t -= 8) { const [x, z] = side(i, sd, W + t); if (distBridge(x, z) > 34) { w = Math.min(w, t); break; } else w = Math.min(w, t - 8); }
    outW[i] = Math.max(9, w);
  }
  const each = (i0, i1, fn) => { if (i0 < 0) { fn(i0 + n, n - 1); fn(0, i1); } else fn(i0, i1); };
  for (const [a0, a1, f] of runs(trk)) {
    const i0 = Math.max(trk.closed ? a0 : 0, a0 - 1), i1 = Math.min(trk.closed ? a1 + 1 : n - 1, a1 + 1);
    if (f === 2) each(i0, i1, (a, b) => L.pave.push(sweep(trk, a, b, both([[[W + 0.7, 0.16], [W + 2.6, 0.16]], [[W + 2.6, 0.16], [W + 2.6, -1.6]]]).concat([[[W + 2.6, -1.6], [-W - 2.6, -1.6]]]), { vScale: 4 })));
    else each(i0, i1, (a, b) => L.pave.push(sweep(trk, a, b, i => { const o = W + outW[trk.wrapI(i)]; return both([[[W + 0.7, 0.16], [W + 6, 0.16]], [[W + 6, 0.16], [W + 6, 0.03]], [[W + 6, 0.03], [o, 0.03]], [[o, 0.03], [o, -7]]]); }, { vScale: 4 })));
    if (f !== 1) each(i0, i1, (a, b) => L.barrier.push(sweep(trk, a, b, both([[[W, 0.0], [W, 0.3]], [[W, 0.3], [W + 0.18, 0.95]], [[W + 0.18, 0.95], [W + 0.55, 0.95]], [[W + 0.55, 0.95], [W + 0.75, 0.0]]]), { vScale: 16, uScale: 0.95, swap: true })));
    if (f === 1) each(i0, i1, (a, b) => {
      L.tunnel.push(sweep(trk, a, b, [[[-W - 1, 7.2], [-W - 1, 0]], [[W + 1, 0], [W + 1, 7.2]], [[W + 1, 7.2], [-W - 1, 7.2]]], { vScale: 6, uScale: 6 }));
      L.pave.push(sweep(trk, a, b, [[[-W - 1.2, 0.16], [-W, 0.16]], [[W, 0.16], [W + 1.2, 0.16]], [[W, 0], [W, 0.16]], [[-W, 0.16], [-W, 0]]], { vScale: 4 }));
      L.bld.push(fin(sweep(trk, a, b, [[[-W - 7, 0], [-W - 7, 15]], [[-W - 7, 15], [W + 7, 15]], [[W + 7, 15], [W + 7, 0]]], { vScale: 3.5 * 8, uScale: 3.2 * 8 }), theme.bld[2]));
      L.props.push(fin(sweep(trk, a, b, [[[W + 7.2, 15], [W + 7.2, 15.8]], [[W + 7.2, 15.8], [-W - 7.2, 15.8]], [[-W - 7.2, 15.8], [-W - 7.2, 15]]]), '#7bd651'));
      for (let i = a; i <= b; i += 3) for (const sd of [-1, 1]) { const [x, z] = side(i, sd, W - 1.5); L.glow.push(fin(place(box(0.6, 0.14, 3.2), x, trk.Y[i] + 7.1, z, yawAt(i)), '#fff3c8', 3)); }
      for (let i = a; i <= b; i += 14) for (const sd of [-1, 1]) { const [x, z] = side(i, sd, W + 0.96); L.sign.push(uvCell(place(new THREE.PlaneGeometry(9, 4.5), x, trk.Y[i] + 2.6, z, yawAt(i) + sd * Math.PI / 2), 36 + ((R() * 4) | 0))); }
      for (const [i, dir] of [[a, -1], [b, 1]]) {
        const sh = new THREE.Shape(); sh.moveTo(-W - 7, 0); sh.lineTo(W + 7, 0); sh.lineTo(W + 7, 15); sh.lineTo(-W - 7, 15); sh.lineTo(-W - 7, 0);
        const hole = new THREE.Path(); hole.moveTo(-W - 1, 0); hole.lineTo(-W - 1, 7.2); hole.lineTo(W + 1, 7.2); hole.lineTo(W + 1, 0); sh.holes.push(hole);
        for (const flip of [0, Math.PI]) { const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.002, 0.998); L.bld.push(fin(place(g, trk.X[i], trk.Y[i], trk.Z[i], yawAt(i) + flip), '#f2ede4')); }
        const fx = trk.X[i] + trk.TX[i] * dir * 0.15, fz = trk.Z[i] + trk.TZ[i] * dir * 0.15, yaw = yawAt(i);
        L.props.push(fin(place(box(2 * W + 3, 0.9, 0.6), fx, trk.Y[i] + 7.6, fz, yaw), acc()));
        for (const sd of [-1, 1]) L.props.push(fin(place(box(0.9, 7.6, 0.6), fx + trk.RX[i] * sd * (W + 1.5), trk.Y[i] + 3.8, fz + trk.RZ[i] * sd * (W + 1.5), yaw), acc()));
        L.sign.push(uvCell(place(new THREE.PlaneGeometry(12, 6), fx + trk.TX[i] * dir * 0.4, trk.Y[i] + 11.2, fz + trk.TZ[i] * dir * 0.4, yaw + (dir < 0 ? Math.PI : 0)), 16 + ((R() * 8) | 0)));
      }
    });
  }
  // red/white kerbs on corners
  for (const sd of [-1, 1]) {
    let st = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && Math.abs(trk.K[i]) > 1 / 110 && !isT(i);
      if (on && st < 0) st = i; if (!on && st >= 0) { const a = Math.max(0, st - 4), b = Math.min(n - 1, i + 4); L.curb.push(sweep(trk, a, b, sd > 0 ? [[[W - 1.2, 0.05], [W, 0.09]]] : [[[-W, 0.09], [-W + 1.2, 0.05]]], { vScale: 4, unitU: true })); st = -1; }
    }
  }

  // street lamps + palms + planters along the sidewalks
  for (let i = 4; i < n; i += 9) {
    if (!trk.closed && (i < 6 || i > n - 6)) continue;
    if (isT(i) || isT(i + 4) || isT(i - 4)) continue;
    const sd = (Math.floor(i / 9) % 2) ? 1 : -1, yaw = yawAt(i), y = trk.Y[i];
    if (isB(i)) {   // bridge: light posts on the rail
      if (i % 18 < 9) { const [bx, bz] = side(i, sd, W + 1.4); L.steel.push(place(new THREE.CylinderGeometry(0.1, 0.12, 5, 8), bx, y + 2.5, bz)); L.props.push(fin(place(new THREE.SphereGeometry(0.35, 12, 8), bx, y + 5.1, bz), '#fff6d0')); }
      continue;
    }
    if ((i / 9 | 0) % 3 === 0) {   // lamp
      const [bx, bz] = side(i, sd, W + 1.6), [hx, hz] = side(i, sd, W - 1.6);
      L.steel.push(place(new THREE.CylinderGeometry(0.12, 0.18, 9, 10), bx, y + 4.5, bz));
      L.steel.push(place(box(0.16, 0.16, 3.4), (bx + hx) / 2, y + 8.85, (bz + hz) / 2, yaw + Math.PI / 2));
      L.props.push(fin(place(box(0.7, 0.3, 1.4), hx, y + 8.75, hz, yaw + Math.PI / 2), acc()));
      if (R() < 0.6) L.sign.push(uvCell(place(new THREE.PlaneGeometry(1.2, 2.4), bx - trk.TX[i] * 0.1, y + 6, bz - trk.TZ[i] * 0.1, yaw + Math.PI), 16 + ((R() * 8) | 0)));
    } else {   // palm tree
      const [px, pz] = side(i, sd, W + 3 + R() * 2), hgt = 7 + R() * 4, lean = (R() - 0.5) * 0.5;
      let cx = px, cz = pz, cy = y;
      for (let k = 0; k < 6; k++) { const seg = hgt / 6; const g = new THREE.CylinderGeometry(0.22 - k * 0.015, 0.28 - k * 0.015, seg + 0.05, 8); const nx = cx + Math.sin(lean) * seg * 0.3 * k / 6, nz = cz + Math.cos(lean) * seg * 0.3 * k / 6;
        L.props.push(fin(place(g, nx, cy + seg / 2, nz, 0, 0.0, lean * k * 0.08), k % 2 ? '#b57a45' : '#9a6436')); cx = nx; cz = nz; cy += seg; }
      for (let k = 0; k < 8; k++) {
        const g = new THREE.PlaneGeometry(1.3, 4.6, 1, 6), p = g.attributes.position;
        for (let v = 0; v < p.count; v++) { const yy = p.getY(v) + 2.3, t = yy / 4.6; p.setXYZ(v, p.getX(v) * Math.sin(Math.min(1, t * 1.6 + 0.15) * Math.PI) * 0.9, -t * t * 1.9, yy); }
        g.computeVertexNormals();
        L.props.push(fin(place(g, cx, cy + 0.2, cz, k * Math.PI / 4 + R() * 0.3, -0.35), k % 2 ? '#3fbf4f' : '#2fa043'));
      }
      L.props.push(fin(place(new THREE.SphereGeometry(0.45, 8, 6), cx, cy, cz), '#6b4a2a'));
    }
    if (R() < 0.45) {   // planter / umbrella / bench
      const [qx, qz] = side(i + 4, sd, W + 4), yi = trk.Y[trk.wrapI(i + 4)], ya = yawAt(trk.wrapI(i + 4));
      if (R() < 0.5) { L.props.push(fin(place(box(2.4, 0.8, 1.2), qx, yi + 0.55, qz, ya), '#e6dccb')); for (let k = -1; k <= 1; k++) L.props.push(fin(place(new THREE.IcosahedronGeometry(0.75, 0), qx + trk.TX[i] * k * 0.8, yi + 1.3, qz + trk.TZ[i] * k * 0.8), k ? '#4cc75a' : '#ff6fa8')); }
      else { L.steel.push(place(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), qx, yi + 1.4, qz)); L.props.push(fin(place(new THREE.ConeGeometry(1.8, 0.8, 10), qx, yi + 2.9, qz), acc())); L.props.push(fin(place(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 12), qx, yi + 0.9, qz), '#ffffff')); }
    }
  }

  // cones (dynamic) clustered at corner apexes, ramps on straights
  for (let i = 30; i < n - 20; i += 23) {
    const k = trk.K[i]; if (Math.abs(k) < 1 / 90 || isT(i) || isB(i)) continue;
    const sd = k > 0 ? 1 : -1;
    for (let c = 0; c < 3; c++) cones.push({ s: (i + c * 2) * trk.ds, d: sd * (W - 0.9 - (c % 2) * 0.5) });
  }
  if (!lite || true) for (let i = 120; i < n - 60; i += 160) {
    if (Math.abs(trk.K[i]) > 1 / 400 || Math.abs(trk.K[trk.wrapI(i + 15)]) > 1 / 400 || isT(i) || isT(i + 10) || isB(i + 10) || isB(i)) continue;
    const d = [-5, 0, 5][(R() * 3) | 0], s0 = i * trk.ds, len = 8, h = 1.25, w = 4.6;
    ramps.push({ s: s0, d, len, h, w });
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(len, h); sh.lineTo(0, 0.02);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2);
    // local: x across (-w/2..w/2), z along (0..len)
    const uv = g.attributes.uv, p = g.attributes.position; for (let v = 0; v < uv.count; v++) uv.setXY(v, (p.getX(v) / w + 0.5), p.getZ(v) / len);
    uvCell(g, 31); g.computeVertexNormals();
    const pt = trk.at(s0, {}); L.sign.push(place(g, pt.x + pt.rx * d, pt.y + 0.02, pt.z + pt.rz * d, Math.atan2(pt.tx, pt.tz)));
    for (const sd of [-1, 1]) L.props.push(fin(place(box(0.25, 0.25, len), pt.x + pt.rx * (d + sd * w / 2) + pt.tx * len / 2, pt.y + h / 2, pt.z + pt.rz * (d + sd * w / 2) + pt.tz * len / 2, Math.atan2(pt.tx, pt.tz), -Math.atan2(h, len)), '#2ec4ff'));
  }

  // buildings with shopfronts, awnings, signs, rooftop stuff
  const facade = (w, h, d, x, y, z, yaw, tint) => {
    const g = box(w, h, d), uv = g.attributes.uv, nW = Math.max(1, Math.round(w / 3.4)), nD = Math.max(1, Math.round(d / 3.4)), nF = Math.max(1, Math.round(h / 3.6));
    const ou = Math.floor(R() * 8) / 8, ov = Math.floor(R() * 8) / 8;
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const k = f * 4 + v; if (f === 2 || f === 3) { uv.setXY(k, 0.002, 0.998); continue; } const across = f < 2 ? nD : nW; uv.setXY(k, ou + uv.getX(k) * across / 8, ov + uv.getY(k) * nF / 8); }
    L.bld.push(fin(place(g, x, y + h / 2, z, yaw), tint));
    C.set(tint).offsetHSL(0, 0.05, -0.18); const lip = box(w + 0.7, 0.8, d + 0.7); const uv2 = lip.attributes.uv; for (let k = 0; k < uv2.count; k++) uv2.setXY(k, 0.002, 0.998);
    L.bld.push(fin(place(lip, x, y + h + 0.4, z, yaw), '#' + C.getHexString()));
  };
  for (const sd of [-1, 1]) {
    let s = trk.closed ? 0 : 10; const end = trk.closed ? trk.L : trk.L - 10;
    while (s < end) {
      const bw = 10 + R() * 10, i = trk.wrapI(Math.round((s + bw / 2) / trk.ds)); s += bw + 1 + R() * 2.5;
      if (isB(i) || isT(i) || isT(i + 6) || isT(i - 6)) continue;
      const depth = 12 + R() * 12, off = W + 6.5 + depth / 2, h = 8 + R() * R() * 34 + (R() < 0.1 ? 22 : 0);
      const tx = trk.TX[i], tz = trk.TZ[i], rx = trk.RX[i] * sd, rz = trk.RZ[i] * sd, cx = trk.X[i] + rx * off, cz = trk.Z[i] + rz * off, y = trk.Y[i], yaw = yawAt(i);
      let ok = true;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const px = cx + tx * a * bw / 2 + rx * b * depth / 2, pz = cz + tz * a * bw / 2 + rz * b * depth / 2; if (trk.nearest(px, pz, W + 5.6).i >= 0 || distBridge(px, pz) < 32) { ok = false; break; } }
      if (!ok) continue;
      const tint = bcol(); facade(bw, h, depth, cx, y, cz, yaw, tint);
      if (R() < 0.3 && h > 16) facade(bw * 0.65, 5 + R() * 12, depth * 0.65, cx + rx * 1.5, y + h + 0.8, cz + rz * 1.5, yaw, bcol());
      const fx = cx - rx * (depth / 2 + 0.06), fz = cz - rz * (depth / 2 + 0.06), fyaw = yaw + (sd > 0 ? Math.PI / 2 : -Math.PI / 2);
      L.sign.push(uvCell(place(new THREE.PlaneGeometry(bw * 0.86, 3.4), fx, y + 1.9, fz, fyaw), 24 + ((R() * 4) | 0)));
      const awn = uvCell(new THREE.PlaneGeometry(bw * 0.92, 2.0), 32 + ((R() * 4) | 0)); L.sign.push(place(awn, fx - rx * 0.85, y + 4.0, fz - rz * 0.85, fyaw, -0.95));
      if (R() < 0.8) L.sign.push(uvCell(place(new THREE.PlaneGeometry(Math.min(bw * 0.8, 7.5), Math.min(bw * 0.4, 3.75)), fx - rx * 0.05, y + 6.4, fz - rz * 0.05, fyaw), (R() * 16) | 0));
      if (R() < 0.55) {   // blade sign facing oncoming traffic
        const by = y + 7 + R() * 5, bx = fx - rx * 1.8 + tx * (R() - 0.5) * bw * 0.6, bz = fz - rz * 1.8 + tz * (R() - 0.5) * bw * 0.6;
        const g = uvCell(new THREE.PlaneGeometry(5.2, 2.6), (R() * 16) | 0); g.rotateZ(Math.PI / 2 * (R() < 0.5 ? 1 : -1)); L.sign.push(place(g, bx, by, bz, yaw + Math.PI));
        const g2 = uvCell(new THREE.PlaneGeometry(5.2, 2.6), (R() * 16) | 0); g2.rotateZ(Math.PI / 2); L.sign.push(place(g2, bx + tx * 0.13, by, bz + tz * 0.13, yaw));
        L.props.push(fin(place(box(2.8, 5.4, 0.1), bx + tx * 0.065, by, bz + tz * 0.065, yaw), INK));
      }
      if (R() < 0.3) L.sign.push(uvCell(place(new THREE.PlaneGeometry(Math.min(bw - 2, 9), 4.5), fx + tx * (R() - 0.5) * 2, y + 0.2 + 2.25 + 0.0, fz + tz * 0.0, fyaw), 36 + ((R() * 4) | 0)));
      if (h > 14 && R() < 0.25) {   // rooftop billboard
        const bwid = Math.min(14, bw * 1.05), by = y + h + 1.6 + bwid * 0.25;
        L.sign.push(uvCell(place(new THREE.PlaneGeometry(bwid, bwid / 2), cx - tx * 0.22, by, cz - tz * 0.22, yaw + Math.PI), 16 + ((R() * 8) | 0)));
        L.props.push(fin(place(box(bwid + 0.4, bwid / 2 + 0.4, 0.3), cx, by, cz, yaw), INK));
        for (const a of [-1, 1]) L.steel.push(place(box(0.3, bwid * 0.25 + 1.6, 0.3), cx + tx * a * bwid * 0.35, y + h + (bwid * 0.25 + 1.6) / 2, cz + tz * a * bwid * 0.35, yaw));
      } else if (R() < 0.5) {   // water tank / AC units
        const ox = cx + rx * (R() - 0.5) * depth * 0.5, oz = cz + rz * (R() - 0.5) * depth * 0.5;
        L.props.push(fin(place(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 12), ox, y + h + 2.6, oz), '#b07a50'));
        L.props.push(fin(place(new THREE.ConeGeometry(1.45, 0.8, 12), ox, y + h + 4.2, oz), '#8a5a3a'));
        for (let q = 0; q < 4; q++) L.steel.push(place(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 5), ox + (q % 2 ? 0.9 : -0.9), y + h + 0.7, oz + (q < 2 ? 0.9 : -0.9)));
      } else for (let q = 0; q < 2; q++) L.props.push(fin(place(box(1.6, 1.0, 1.6), cx + tx * (q - 0.5) * 4, y + h + 1.3, cz + tz * (q - 0.5) * 4, yaw), '#d8dde4'));
      if (R() < 0.85) {   // second row, taller
        const d2 = 14 + R() * 16, off2 = off + depth / 2 + 3 + d2 / 2, h2 = 22 + R() * 50, c2x = trk.X[i] + rx * off2, c2z = trk.Z[i] + rz * off2;
        if (trk.nearest(c2x, c2z, W + 10 + d2 / 2).i < 0 && distBridge(c2x, c2z) > 40 && off2 < W + outW[i] - 2) facade(bw * (0.9 + R() * 0.4), h2, d2, c2x, y, c2z, yaw, bcol());
      }
    }
  }

  // footbridges over straights (with an ad)
  for (let i = 70; i < n - 30; i += 170) {
    if (Math.abs(trk.K[i]) > 1 / 300 || isT(i) || isB(i) || isB(i + 20) || isB(i - 20)) continue;
    const yaw = yawAt(i), y = trk.Y[i], x = trk.X[i], z = trk.Z[i];
    const fc = acc(); L.props.push(fin(place(box(2 * W + 14, 0.8, 4), x, y + 12.2, z, yaw), fc));
    for (let k = -3; k <= 3; k++) L.props.push(fin(place(box(0.25, 2.2, 4.2), x + trk.RX[i] * k * 4.4, y + 13.6, z + trk.RZ[i] * k * 4.4, yaw), '#ffffff'));
    L.props.push(fin(place(box(2 * W + 14, 0.3, 4.3), x, y + 14.8, z, yaw), fc));
    for (const a of [-1, 1]) { L.props.push(fin(place(box(2 * W + 14, 0.25, 0.25), x + trk.TX[i] * a * 2, y + 13.3, z + trk.TZ[i] * a * 2, yaw), '#ffffff'));
      L.sign.push(uvCell(place(new THREE.PlaneGeometry(10, 5), x + trk.TX[i] * a * 2.4, y + 17.8, z + trk.TZ[i] * a * 2.4, yaw + (a < 0 ? Math.PI : 0)), 16 + ((R() * 8) | 0))); }
    L.steel.push(place(box(10.4, 5.4, 4.6), x, y + 17.8, z, yaw));
    for (const sd of [-1, 1]) { const [px, pz] = side(i, sd, W + 3.5); L.props.push(fin(place(box(1.4, 12.2, 1.4), px, y + 6.1, pz, yaw), fc)); L.props.push(fin(place(box(4, 15, 4), px + trk.RX[i] * sd * 2.5, y + 7.5, pz + trk.RZ[i] * sd * 2.5, yaw), '#f2ede4')); }
  }

  // start / finish gantries
  const gantry = (s, cellK) => {
    const p = trk.at(s, {}), yaw = Math.atan2(p.tx, p.tz);
    for (const sd of [-1, 1]) L.props.push(fin(place(box(0.9, 9.5, 0.9), p.x + p.rx * sd * (W + 1.3), p.y + 4.75, p.z + p.rz * sd * (W + 1.3), yaw), '#ff2d55'));
    L.props.push(fin(place(box(2 * W + 3.4, 2.8, 0.9), p.x, p.y + 9.4, p.z, yaw), INK));
    for (const f of [-1, 1]) L.sign.push(uvCell(place(new THREE.PlaneGeometry(10, 2.5), p.x + p.tx * f * 0.48, p.y + 9.4, p.z + p.tz * f * 0.48, yaw + (f < 0 ? Math.PI : 0)), cellK));
    for (let k = -4; k <= 4; k++) if (Math.abs(k) > 1) L.glow.push(fin(place(new THREE.SphereGeometry(0.32, 10, 8), p.x + p.rx * k * 2.1 - p.tx * 0.6, p.y + 8.0, p.z + p.rz * k * 2.1 - p.tz * 0.6), k % 2 ? '#ff2030' : '#30ff60', 3));
    const cg = new THREE.PlaneGeometry(2 * W, 1.6); const uv = cg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 9, uv.getY(k));
    const chk = new THREE.Mesh(place(cg, p.x, p.y + 0.05, p.z, yaw, -Math.PI / 2), checkerMat()); chk.receiveShadow = true; G.add(chk);
    // flags + balloons
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const q = p.x + p.rx * sd * (W + 3 + k * 1.5) + p.tx * (k - 1) * 3, qz = p.z + p.rz * sd * (W + 3 + k * 1.5) + p.tz * (k - 1) * 3;
      L.steel.push(place(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), q, p.y + 3, qz)); L.props.push(fin(place(box(0.05, 1.4, 2.2), q, p.y + 5.2, qz + 1.1 * 0, yaw), acc())); }
  };
  gantry(trk.startS + 0.5, 29); if (!trk.closed) gantry(trk.finishS, 30);
  // cheering crowds behind the barriers at the start (and finish)
  const skins = ['#f1c27d', '#e0ac69', '#8d5524', '#ffdbac', '#c68642'], shirts = theme.accent.concat(['#ffffff', '#1b1530', '#ffd23f']);
  const crowd = (s0, s1) => { for (let s = s0; s < s1; s += 1.3) for (const sd of [-1, 1]) for (let row = 0; row < 2; row++) {
    if (R() < 0.2) continue; const p = trk.at(s + R() * 0.6, {}), off = W + 1.6 + row * 1.3 + R() * 0.3, x = p.x + p.rx * sd * off, z = p.z + p.rz * sd * off, y = p.y + 0.16 + row * 0.35;
    if (trk.F[p.i]) continue;
    const h = 0.85 + R() * 0.25, sc = shirts[(R() * shirts.length) | 0];
    L.props.push(fin(place(new THREE.CapsuleGeometry(0.26, h * 0.7, 3, 8), x, y + 0.5 + h * 0.35, z), sc));
    L.props.push(fin(place(new THREE.SphereGeometry(0.24, 10, 8), x, y + 0.95 + h * 0.75, z), skins[(R() * skins.length) | 0]));
    const up = R() < 0.6; for (const a of [-1, 1]) L.props.push(fin(place(box(0.12, 0.6, 0.12), x - p.tx * 0 + p.rx * a * 0.3 * 0 + (-p.tz) * a * 0.32, y + (up ? 1.45 : 0.8) + h * 0.4, z + p.tx * a * 0.32, Math.atan2(p.tx, p.tz), 0, a * (up ? -0.5 : 0.25)), sc));
    if (R() < 0.15) L.props.push(fin(place(box(0.05, 0.9, 0.05), x, y + 2.3 + h * 0.5, z), '#ffffff'), fin(place(box(0.02, 0.4, 0.6), x, y + 2.55 + h * 0.5, z + 0.3), shirts[(R() * shirts.length) | 0]));
  } };
  crowd(trk.closed ? trk.L - 60 : 20, trk.closed ? trk.L - 2 : trk.startS + 30); if (trk.closed) crowd(2, 40); else crowd(trk.finishS - 50, trk.finishS + 20);
  // a blimp with an ad, and hot-air balloons
  { const a = R() * 6.28, x = trk.box.cx + Math.cos(a) * trk.box.r * 0.6, z = trk.box.cz + Math.sin(a) * trk.box.r * 0.6, yaw = a + 1.2, y = 120;
    const body = new THREE.SphereGeometry(1, 24, 14); body.scale(9, 9, 26); L.props.push(fin(place(body, x, y, z, yaw), '#f6f6f2'));
    for (const r of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) L.props.push(fin(place(box(0.6, 7, 6), x - Math.sin(yaw) * 22 + Math.cos(yaw) * Math.cos(r) * 0, y, z - Math.cos(yaw) * 22, yaw, 0, r), theme.accent[0]));
    L.props.push(fin(place(box(3, 2.4, 7), x, y - 10, z, yaw), theme.accent[1]));
    for (const sd of [-1, 1]) L.sign.push(uvCell(place(new THREE.PlaneGeometry(26, 13), x + Math.cos(yaw) * sd * 9.05, y, z - Math.sin(yaw) * sd * 9.05, yaw + sd * Math.PI / 2), 20)); }
  for (let k = 0; k < 4; k++) { const a = R() * 6.28, x = trk.box.cx + Math.cos(a) * (trk.box.r + 120 + R() * 200), z = trk.box.cz + Math.sin(a) * (trk.box.r + 120 + R() * 200), y = 60 + R() * 70;
    const g = new THREE.SphereGeometry(9, 16, 12); g.scale(1, 1.2, 1); L.props.push(fin(place(g, x, y, z), theme.accent[k % theme.accent.length]));
    const st = new THREE.SphereGeometry(9.15, 16, 12, 0, 0.6); st.scale(1, 1.2, 1); for (let q = 0; q < 4; q++) L.props.push(fin(place(st.clone(), x, y, z, q * Math.PI / 2), '#ffffff'));
    L.props.push(fin(place(box(2.4, 2, 2.4), x, y - 15, z), '#9a6436')); }

  // bridge
  if (bridgeIdx.length) {
    let a = bridgeIdx[0];
    if (trk.closed && F[0] === 2 && F[n - 1] === 2) { let k = n - 1; while (F[k] === 2) k--; a = k + 1; }
    const len = bridgeIdx.length - 1, at = f => trk.wrapI(a + Math.round(len * f)), TH = 28;
    for (const ti of [at(0.22), at(0.78)]) {
      const yaw = yawAt(ti), y = trk.Y[ti];
      for (const sd of [-1, 1]) { const [x, z] = side(ti, sd, W + 3.6); L.steel.push(place(box(1.8, TH + 8, 2.4), x, y + (TH + 8) / 2 - 7, z, yaw)); L.props.push(fin(place(box(2.2, 1.2, 2.8), x, y + TH + 1.4, z, yaw), INK)); }
      for (const h of [TH - 2, 13]) L.steel.push(place(box(2 * W + 9, 1.6, 1.8), trk.X[ti], y + h, trk.Z[ti], yaw));
      L.sign.push(uvCell(place(new THREE.PlaneGeometry(10, 5), trk.X[ti] - trk.TX[ti] * 1, y + TH + 3.6 - 6, trk.Z[ti] - trk.TZ[ti] * 1, yaw + Math.PI), 16 + ((R() * 8) | 0)));
    }
    for (const sd of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= len; k += 2) {
        const i = trk.wrapI(a + k), u = k / len; let h;
        if (u < 0.22) h = 2 + (TH - 2) * (u / 0.22) ** 1.6; else if (u > 0.78) h = 2 + (TH - 2) * ((1 - u) / 0.22) ** 1.6; else { const v = (u - 0.22) / 0.56; h = 3 + (TH - 3) * (2 * v - 1) ** 2; }
        const [x, z] = side(i, sd, W + 3.6); pts.push(new THREE.Vector3(x, trk.Y[i] + h, z));
        if (k % 4 === 0 && h > 2.5) L.steel.push(place(new THREE.CylinderGeometry(0.07, 0.07, h, 4), x, trk.Y[i] + h / 2, z));
      }
      L.steel.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.4, 6, false));
    }
    for (const f of [0.1, 0.5, 0.9]) { const i = at(f); L.steel.push(place(box(6, 9, 3.5), trk.X[i], trk.Y[i] - 6, trk.Z[i], yawAt(i) + Math.PI / 2)); }
    // sailboats on the water
    for (let k = 0; k < 7; k++) { const i = at(R()), sd = R() < 0.5 ? -1 : 1, [x, z] = side(i, sd, W + 25 + R() * 50), yaw = R() * 6;
      L.props.push(fin(place(box(2.2, 1, 6), x, -6.6, z, yaw), '#ffffff')); L.steel.push(place(new THREE.CylinderGeometry(0.08, 0.08, 7, 5), x, -3, z));
      const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 6, 0, 0, 0, 3.2], 3)); sail.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0], 2)); sail.computeVertexNormals();
      L.props.push(fin(place(sail, x + 0.05, -5.8, z, yaw), acc())); }
  }

  // clouds (toon puffs) + hazy far towers
  for (let k = 0; k < 16; k++) {
    const a = R() * Math.PI * 2, r = trk.box.r + 500 + R() * 600, x = trk.box.cx + Math.cos(a) * r, z = trk.box.cz + Math.sin(a) * r, y = 110 + R() * 120;
    for (let j = 0; j < 5; j++) L.cloud.push(fin(place(new THREE.IcosahedronGeometry(18 + R() * 16, 2), x + (j - 2) * 26 * Math.cos(a + 1.57), y + Math.sin(j * 2.1) * 8, z + (j - 2) * 26 * Math.sin(a + 1.57)), '#ffffff'));
  }
  for (let k = 0; k < 130; k++) {
    const a = R() * Math.PI * 2, r = trk.box.r + 240 + R() * 700, x = trk.box.cx + Math.cos(a) * r, z = trk.box.cz + Math.sin(a) * r;
    const w = 20 + R() * 34, d = 20 + R() * 34, h = 30 + R() * R() * 200;
    const g = box(w, h, d), uv = g.attributes.uv, ou = Math.floor(R() * 8) / 8;
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const q = f * 4 + v; if (f === 2 || f === 3) { uv.setXY(q, 0.002, 0.998); continue; } uv.setXY(q, ou + uv.getX(q) * w / 5 / 8, uv.getY(q) * h / 4 / 8); }
    L.far.push(fin(place(g, x, h / 2 - 7, z, R() * 3), bcol()));
  }

  // ---- materials + meshes
  const facTex = facadeTexture(R), atlas = signAtlas(lite);
  const OL = outlineMat(0.07), OLs = outlineMat(0.035);
  const add = (list, mat, o = {}) => {
    const g = merge(list); if (!g) return null; const m = new THREE.Mesh(g, mat); m.receiveShadow = o.rs !== false; m.castShadow = !!o.cs; m.matrixAutoUpdate = false; G.add(m);
    if (o.ol) { const ol = new THREE.Mesh(g, o.ol); ol.matrixAutoUpdate = false; G.add(ol); }
    return m;
  };
  add(L.road, new THREE.MeshStandardMaterial({ map: roadTexture(R), color: '#ece4d8', roughness: 0.66, metalness: 0, envMapIntensity: 0.45 }));
  add(L.curb, toon('#ffffff', { map: curbTexture(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  add(L.pave, toon('#ffffff', { map: paveTexture(R), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  add(L.barrier, toon('#ffffff', { map: barrierTexture(theme) }), { ol: OLs });
  add(L.bld, toon('#ffffff', { map: facTex, vertexColors: true }), { ol: OL, cs: !lite });
  add(L.props, toon('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), { ol: OLs, cs: !lite });
  add(L.steel, toon(theme.steel), { ol: OLs });
  add(L.sign, toon('#ffffff', { map: atlas, alphaTest: 0.35, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: atlas, emissiveIntensity: 0.25 }));
  if (L.tunnel.length) add(L.tunnel, toon('#ffffff', { map: tileTexture(), side: THREE.DoubleSide }));
  add(L.glow, new THREE.MeshBasicMaterial({ vertexColors: true }));
  add(L.cloud, toon('#ffffff', { emissive: '#b8c8e0', emissiveIntensity: 0.45, fog: false }), { rs: false });
  add(L.far, toon('#ffffff', { map: facTex, vertexColors: true }), { rs: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: theme.water, roughness: 0.08, metalness: 0.15, envMapIntensity: 1.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set(trk.box.cx, -7, trk.box.cz); water.receiveShadow = true; G.add(water);
  G.add(skyDome(theme));
  return { group: G, cones, ramps };
}

let _chk; function checkerMat() {
  if (_chk) return _chk; const [c, x] = cv(128, 64);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#1b1530'; x.fillRect(i * 16, j * 16, 16, 16); }
  return _chk = toon('#ffffff', { map: tex(c), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

// tracks.js — Skidsy circuits, all built in code: a closed centre line from a few harmonics, a smooth height field,
// road + curbs + dirt shortcut ribbons that follow the ground, jump ramps, boost pads, barriers and themed scenery.
import { THREE } from './kit/hc.js';
import { bake, vcMat } from './merge.js';

const TAU = Math.PI * 2;
export const W = 14;              // road width
export const WALL = W / 2 + 6;    // lateral distance of the barrier from the centre line
export const SW = 8;              // shortcut (dirt path) width
export const RAMP_LEN = 7, RAMP_H = 1.9;

export const TRACKS = [
  { id: 'meadow', name: 'Clover Meadow', theme: 'meadow', sc: 1, hill: { a: 2.4, f: 0.017, b: 1.3, g: 0.03 }, ramps: [0.3, 0.74], cut: { a: [104, -6], b: [104, 86], bend: [18, 0] },
    pts: [[-60, -80], [0, -84], [60, -80], [98, -50], [105, 0], [70, 12], [40, 26], [34, 52], [62, 70], [104, 84], [82, 118], [10, 112], [-50, 104], [-96, 64], [-104, 0], [-96, -50]] },
  { id: 'canyon', name: 'Sunbake Canyon', theme: 'canyon', sc: 0.92, hill: { a: 3.2, f: 0.014, b: 1.6, g: 0.026 }, ramps: [0.2, 0.6], cut: { a: [44, 112], b: [-86, 112], bend: [0, 22] },
    pts: [[-100, -100], [0, -106], [90, -100], [118, -60], [104, -10], [116, 40], [96, 94], [44, 112], [18, 94], [8, 66], [-14, 52], [-34, 70], [-52, 100], [-86, 112], [-116, 80], [-120, 0], [-114, -62]] },
  { id: 'coast', name: 'Taffy Coast', theme: 'coast', sc: 0.95, hill: { a: 1.6, f: 0.02, b: 1.0, g: 0.035, sea: 7 }, ramps: [0.36, 0.8],
    pts: [[-140, 0], [-122, -50], [-64, -64], [-36, -42], [-16, -20], [6, -24], [22, -48], [48, -68], [110, -76], [150, -30], [142, 30], [96, 58], [62, 40], [30, 44], [-10, 72], [-62, 82], [-122, 58]] },
  { id: 'frost', name: 'Frostbun Peaks', theme: 'frost', sc: 0.92, hill: { a: 3.6, f: 0.013, b: 1.5, g: 0.028 }, ramps: [0.42, 0.9],
    pts: [[-120, -100], [-20, -106], [60, -96], [112, -64], [86, -30], [44, -30], [16, -12], [14, 16], [44, 34], [112, 42], [124, 92], [60, 118], [-20, 106], [-62, 72], [-112, 62], [-132, 0], [-128, -62]] },
];

export const THEMES = {
  meadow: { sky: ['#62c4ff', '#dff5ff'], fog: '#d6f1ff', g1: '#7fd85a', g2: '#5fc24a', shoulder: '#c9b27a', road: '#5d6275', curb: ['#ff4d5e', '#ffffff'], wall: ['#ff4d5e', '#ffffff'], mtn: ['#8db8e0', '#ffffff'], hemiG: '#d8ffd0' },
  canyon: { sky: ['#ff9f5a', '#ffe3bd'], fog: '#ffd8ae', g1: '#f2b06a', g2: '#e39552', shoulder: '#f7d39a', road: '#6b5d63', curb: ['#ffffff', '#3a86ff'], wall: ['#ffd23f', '#3a2e39'], mtn: ['#d4704a', '#f0a070'], hemiG: '#ffe0c0' },
  coast: { sky: ['#4fd0ff', '#fff2f8'], fog: '#e2f6ff', g1: '#9be06a', g2: '#7ccf55', shoulder: '#ffe2a6', road: '#5f6a80', curb: ['#ff5d8f', '#ffffff'], wall: ['#2ec4b6', '#ffffff'], mtn: ['#7fc6a4', '#c8f0d8'], hemiG: '#fff0d8', sand: '#ffe2a6', sea: '#2fc4f2' },
  frost: { sky: ['#8fa2ff', '#ffe0ef'], fog: '#e8e6ff', g1: '#f6f9ff', g2: '#dfe8ff', shoulder: '#cfd9f2', road: '#4f5872', curb: ['#3a86ff', '#ffffff'], wall: ['#7b5cff', '#ffffff'], mtn: ['#b9c4ff', '#ffffff'], hemiG: '#e8eeff' },
};

// ---------------------------------------------------------------- textures (canvas, cached)
const texCache = {};
function canvasTex(key, w, h, draw, rep = true) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (texCache[key] = t);
}
function roadTex(col) {
  return canvasTex('road' + col, 256, 512, (x, w, h) => {
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(5, 0, 7, h); x.fillRect(w - 12, 0, 7, h);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(w / 2 - 3, 0, 6, h / 2);
    x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(w * 0.28, 0, 16, h); x.fillRect(w * 0.66, 0, 16, h);   // worn racing lines
  });
}
function curbTex(a, b) { return canvasTex('curb' + a + b, 64, 128, (x, w, h) => { x.fillStyle = a; x.fillRect(0, 0, w, h / 2); x.fillStyle = b; x.fillRect(0, h / 2, w, h / 2); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 0, 6, h); }); }
const dirtTex = () => canvasTex('dirt', 128, 256, (x, w, h) => {
  x.fillStyle = '#c99a5c'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,200,.18)' : 'rgba(90,50,20,.16)'; const s = 1 + Math.random() * 3; x.fillRect(Math.random() * w, Math.random() * h, s, s); }
  x.fillStyle = 'rgba(90,55,25,.22)'; x.fillRect(w * 0.27, 0, 10, h); x.fillRect(w * 0.66, 0, 10, h);
  x.fillStyle = '#8fd16a'; x.fillRect(0, 0, 6, h); x.fillRect(w - 6, 0, 6, h);
});
export const chevronTex = () => canvasTex('chev', 128, 128, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff3d8b'); g.addColorStop(0.5, '#ffb02e'); g.addColorStop(1, '#ff3d8b');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.9)';
  for (const y0 of [8, 72]) { x.beginPath(); x.moveTo(14, y0 + 44); x.lineTo(w / 2, y0); x.lineTo(w - 14, y0 + 44); x.lineTo(w - 34, y0 + 52); x.lineTo(w / 2, y0 + 22); x.lineTo(34, y0 + 52); x.closePath(); x.fill(); }
});
const checkTex = () => canvasTex('check', 128, 32, (x, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#1b1b28' : '#ffffff'; x.fillRect(i * 8, j * 8, 8, 8); } }, false);
export function bannerTex(text, bg = '#ff3d6e', fg = '#ffffff') {
  return canvasTex('ban' + text + bg, 512, 96, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
    x.font = '800 64px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(0,0,0,.2)'; x.fillText(text, w / 2 + 3, h / 2 + 6); x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + 3);
  }, false);
}

// ---------------------------------------------------------------- the track
export function buildTrack(def, mirror, seedRand = Math.random) {
  const th = THEMES[def.theme], H = def.hill;
  let Rx = 0, Rz = 0; for (const [x, z] of def.pts) { Rx = Math.max(Rx, Math.abs(x) * def.sc * 1.22); Rz = Math.max(Rz, Math.abs(z) * def.sc * 1.22); }
  const h = (x, z) => {
    if (mirror) x = -x;
    let y = H.a * Math.sin(x * H.f + 1.3) * Math.cos(z * H.f * 0.9 + 0.4) + H.b * Math.sin((x * 0.7 - z) * H.g + 0.8);
    const r = Math.hypot(x / Rx, z / Rz);
    if (H.sea) { if (r > 1.0) y -= (r - 1.0) * H.sea * 9; }
    else if (r > 1.1) y += (r - 1.1) * (r - 1.1) * 14;      // rolling hills rise away from the circuit
    return y;
  };
  // centre line: L samples exactly 1 unit apart, closed
  let pts = def.pts;
  for (let it = 0; it < 1; it++) { const o = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } pts = o; }   // round the corners
  const ctrl = pts.map(([x, z]) => new THREE.Vector3(x * def.sc * (mirror ? -1 : 1), 0, z * def.sc));
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const L = Math.round(curve.getLength());
  const P = curve.getSpacedPoints(L); P.pop();
  const T = [], R = [], K = [];
  for (let i = 0; i < L; i++) {
    const a = P[(i - 1 + L) % L], b = P[(i + 1) % L], t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    T.push(t); R.push(new THREE.Vector3(-t.z, 0, t.x));
  }
  for (let i = 0; i < L; i++) { const a = T[(i - 3 + L) % L], b = T[(i + 3) % L]; K.push(((b.x - a.x) * R[i].x + (b.z - a.z) * R[i].z) / 6); }
  for (let pass = 0; pass < 4; pass++) { const k2 = K.slice(); for (let i = 0; i < L; i++) K[i] = (k2[(i - 1 + L) % L] + 2 * k2[i] + k2[(i + 1) % L]) / 4; }
  const wrap = s => ((s % L) + L) % L;
  const ds = (a, b) => { let d = wrap(b - a); if (d > L / 2) d -= L; return d; };   // signed forward distance a→b

  const TR = { def, mirror, th, L, P, T, R, K, h, wrap, ds, name: (mirror ? 'Mirror ' : '') + def.name };
  /** nearest centre-line point: windowed search around `hint` (or global when hint < 0). Returns s, signed lateral d (right > 0) */
  TR.near = (x, z, hint = -1, out = {}) => {
    let bi = 0, bd = 1e18;
    if (hint < 0) { for (let i = 0; i < L; i++) { const dx = x - P[i].x, dz = z - P[i].z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } } }
    else { const h0 = Math.floor(hint); for (let k = -16; k <= 46; k++) { const i = (h0 + k + L * 4) % L, dx = x - P[i].x, dz = z - P[i].z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } } }
    const p = P[bi], t = T[bi], r = R[bi], dx = x - p.x, dz = z - p.z;
    out.s = wrap(bi + dx * t.x + dz * t.z); out.d = dx * r.x + dz * r.z; out.i = bi; return out;
  };
  TR.frame = (s, o = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), k: 0 }) => {
    s = wrap(s); const i = Math.floor(s), j = (i + 1) % L, f = s - i;
    o.p.lerpVectors(P[i], P[j], f); o.t.lerpVectors(T[i], T[j], f).normalize(); o.r.set(-o.t.z, 0, o.t.x); o.k = K[i] * (1 - f) + K[j] * f;
    o.p.y = h(o.p.x, o.p.z); return o;
  };
  TR.maxK = (s, a, b) => { let m = 0; for (let k = a; k <= b; k += 2) m = Math.max(m, Math.abs(K[Math.floor(wrap(s + k))])); return m; };

  // ---------------- shortcut: the chord with the biggest arc/chord ratio that stays clear of the road
  TR.short = null;
  const mkShort = (a, b, bz) => {
    const n = Math.max(10, Math.round(bz.getLength())), pts = bz.getSpacedPoints(n);
    const st = pts.map((p, q) => { const u = pts[Math.max(0, q - 1)], v = pts[Math.min(n, q + 1)]; return new THREE.Vector3(v.x - u.x, 0, v.z - u.z).normalize(); });
    return { a, b, arc: b - a, len: n, pts, tan: st, ratio: (b - a) / P[a].distanceTo(P[b]) };
  };
  if (def.cut) {
    const ni = ([x, z]) => { x *= def.sc * (mirror ? -1 : 1); z *= def.sc; let bi = 0, bd = 1e18; for (let i = 0; i < L; i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
    let a = ni(def.cut.a), b = ni(def.cut.b); if (wrap(b - a) > L / 2) [a, b] = [b, a];
    if (b < a) b += 0;   // features never straddle the start line (checked by design)
    const bend = new THREE.Vector3(def.cut.bend[0] * def.sc * (mirror ? -1 : 1), 0, def.cut.bend[1] * def.sc);
    const p0 = P[a].clone(), p3 = P[b].clone();
    TR.short = mkShort(a, b, new THREE.CubicBezierCurve3(p0, p0.clone().lerp(p3, 1 / 3).add(bend).addScaledVector(T[a], 6), p0.clone().lerp(p3, 2 / 3).add(bend).addScaledVector(T[b], -6), p3));
  } else {
    const cands = [];
    for (let a = 40; a < L - 60; a += 3) for (let len = Math.floor(L * 0.06); len <= Math.floor(L * 0.3); len += 3) {
      const b = a + len; if (b > L - 40) continue;
      const c = P[a].distanceTo(P[b]); if (c < 30) continue;
      const ratio = len / c; if (ratio > 1.3 && ratio < 2.05) cands.push({ a, b, c, ratio });
    }
    cands.sort((u, v) => Math.abs(u.ratio - 1.5) - Math.abs(v.ratio - 1.5));
    for (const cd of cands.slice(0, 1500)) {
      const bz = new THREE.CubicBezierCurve3(P[cd.a].clone(), P[cd.a].clone().addScaledVector(T[cd.a], cd.c * 0.14), P[cd.b].clone().addScaledVector(T[cd.b], -cd.c * 0.14), P[cd.b].clone());
      const pts = bz.getSpacedPoints(24);
      let ok = true;
      for (let q = 5; q <= 19 && ok; q++) for (let i = 0; i < L; i += 2) { const dx = pts[q].x - P[i].x, dz = pts[q].z - P[i].z; if (dx * dx + dz * dz < 17.5 * 17.5) { ok = false; break; } }
      if (ok) { TR.short = mkShort(cd.a, cd.b, bz); break; }
    }
  }
  /** distance to the shortcut path + fraction along it */
  TR.shortNear = (x, z, out = {}) => {
    const S = TR.short; out.dist = 1e9; out.f = 0; if (!S) return out;
    let bi = 0, bd = 1e18; for (let q = 0; q < S.pts.length; q++) { const dx = x - S.pts[q].x, dz = z - S.pts[q].z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = q; } }
    const p = S.pts[bi], t = S.tan[bi], dx = x - p.x, dz = z - p.z;
    out.dist = Math.abs(dx * t.z - dz * t.x); out.lat = -(dx * t.z - dz * t.x); out.f = Math.min(1, Math.max(0, (bi + dx * t.x + dz * t.z) / S.len)); out.q = bi; return out;
  };

  // ---------------- features along the lap: ramps, item rows, boost pads (kept apart)
  const taken = [[L - 40, L], [0, 30]];
  if (TR.short) taken.push([TR.short.a - 22, TR.short.b + 18]);
  const free = (s, r) => taken.every(([a, b]) => s + r < a || s - r > b);
  const pick = (frac, r, kTol) => {
    let best = -1, bk = 1e9;
    for (let k = -Math.floor(L * 0.12); k <= L * 0.12; k += 2) {
      const s = Math.floor(wrap(L * frac + k)); if (!free(s, r)) continue;
      const mk = TR.maxK(s, -10, 22) + Math.abs(k) * 0.00002; if (mk < bk) { bk = mk; best = s; }
    }
    if (best >= 0 && bk < kTol) { taken.push([best - r, best + r]); return best; } return -1;
  };
  TR.ramps = def.ramps.map(f => pick(f, 26, 0.03)).filter(s => s >= 0);
  TR.itemRows = [0.12, 0.5, 0.82].map(f => pick(f, 14, 0.08)).filter(s => s >= 0);
  TR.pads = [0.4, 0.68].map((f, i) => { const s = pick(f, 12, 0.06); return s < 0 ? null : { s, lat: i % 2 ? 3.2 : -3.2 }; }).filter(Boolean);
  TR.rampAt = (s, d) => { if (Math.abs(d) > W / 2 + 0.3) return -1; for (const r of TR.ramps) { const u = wrap(s - r); if (u < RAMP_LEN) return u / RAMP_LEN; } return -1; };
  return TR;
}

// ---------------------------------------------------------------- meshes
function ribbon(TR, pts, rights, offs, y0, vScale, uMap) {
  const pos = [], uv = [], idx = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], r = rights[i];
    for (let k = 0; k < offs.length; k++) { const x = p.x + r.x * offs[k], z = p.z + r.z * offs[k]; pos.push(x, TR.h(x, z) + y0, z); uv.push(uMap(k), i / vScale); }
  }
  const m = offs.length;
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < m - 1; k++) { const a = i * m + k, b = a + m; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildMeshes(TR, rnd) {
  const G = new THREE.Group(), th = TR.th, L = TR.L, P = TR.P, Rt = TR.R, h = TR.h;
  const loopPts = [...P, P[0]], loopR = [...Rt, Rt[0]];
  const flip = TR.mirror;                         // mirrored circuits run the other way round: keep winding consistent
  const sideMat = o => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  // road
  const road = new THREE.Mesh(ribbon(TR, loopPts, loopR, [-W / 2, 0, W / 2], 0.07, 8, k => k / 2), sideMat({ map: roadTex(th.road), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  road.receiveShadow = true; G.add(road);
  // curbs
  const cg = [ribbon(TR, loopPts, loopR, [-W / 2 - 1.5, -W / 2], 0.11, 3, k => k), ribbon(TR, loopPts, loopR, [W / 2, W / 2 + 1.5], 0.11, 3, k => k)];
  const curbs = new THREE.Mesh(mergeGeos(cg), sideMat({ map: curbTex(th.curb[0], th.curb[1]), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  curbs.receiveShadow = true; G.add(curbs);
  // start line
  const sl = new THREE.Mesh(ribbon(TR, [P[0], P[2]], [Rt[0], Rt[2]], [-W / 2, W / 2], 0.13, 1, k => k), new THREE.MeshStandardMaterial({ map: checkTex(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide }));
  G.add(sl);
  // shortcut dirt path
  const S = TR.short;
  if (S) {
    const rights = S.tan.map(t => new THREE.Vector3(-t.z, 0, t.x));
    const sg = ribbon(TR, S.pts, rights, [-SW / 2 - 0.6, SW / 2 + 0.6], 0.05, 8, k => k);
    const sm = new THREE.Mesh(sg, sideMat({ map: dirtTex(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })); sm.receiveShadow = true; G.add(sm);
  }
  // terrain (vertex coloured; shoulder tint near the road)
  const SIZE = 980, SEG = 150, tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, cols = [], c1 = new THREE.Color(th.g1), c2 = new THREE.Color(th.g2), cs = new THREE.Color(th.shoulder), sand = th.sand ? new THREE.Color(th.sand) : null, cc = new THREE.Color();
  const near = {};
  TR.distGrid = new Float32Array(tp.count);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), y = h(x, z); tp.setY(i, y - 0.03);
    let bd = 1e9; for (let j = 0; j < L; j += 3) { const dx = x - P[j].x, dz = z - P[j].z, d = dx * dx + dz * dz; if (d < bd) bd = d; }
    bd = Math.sqrt(bd); TR.distGrid[i] = bd;
    const n = 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.06 - x * 0.02);
    cc.copy(c1).lerp(c2, n);
    if (bd < WALL + 3) cc.lerp(cs, 0.55 * Math.min(1, (WALL + 3 - bd) / 4));
    if (sand && y < 0.6) cc.copy(sand).lerp(c2, Math.max(0, Math.min(0.5, (y - 0.1))));
    cols.push(cc.r, cc.g, cc.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); terrain.receiveShadow = true; G.add(terrain);
  const gridDist = (x, z) => { const fx = (x + SIZE / 2) / SIZE * SEG, fz = (z + SIZE / 2) / SIZE * SEG; const ix = Math.round(fx), iz = Math.round(fz); if (ix < 0 || iz < 0 || ix > SEG || iz > SEG) return 1e9; return TR.distGrid[iz * (SEG + 1) + ix]; };
  const shortDist = (x, z) => TR.shortNear(x, z, near).dist + (TR.short ? 0 : 1e9);
  if (th.sea) { const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: th.sea, roughness: 0.2, metalness: 0.1 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; sea.receiveShadow = true; G.add(sea); TR.sea = sea; }

  // barriers (instanced, alternating colours) along both sides and the shortcut
  const wallGeo = new THREE.BoxGeometry(2.1, 0.85, 0.7); wallGeo.translate(0, 0.42, 0);
  const wallXf = [];
  for (let s = 0; s < L; s += 2.4) {
    const i = Math.floor(s);
    for (const side of [-1, 1]) {
      const off = side * (WALL + 0.45), x = P[i].x + Rt[i].x * off, z = P[i].z + Rt[i].z * off;
      if (TR.short && shortDist(x, z) < SW / 2 + 4) continue;
      if (side === Math.sign(TR.K[i]) && 1 / Math.max(1e-4, Math.abs(TR.K[i])) < WALL + 5) continue;   // inside of a hairpin
      let clash = false; for (let j = 0; j < L; j += 3) { if (Math.abs(TR.ds(i, j)) < 40) continue; const dx = x - P[j].x, dz = z - P[j].z; if (dx * dx + dz * dz < (WALL + 1) * (WALL + 1)) { clash = true; break; } }
      if (clash) continue;                                   // would sit on another part of the road
      wallXf.push([x, h(x, z), z, Math.atan2(TR.T[i].x, TR.T[i].z), wallXf.length % 2]);
    }
  }
  if (S) for (let q = 6; q < S.pts.length - 6; q += 2.4) {
    const qi = Math.floor(q), t = S.tan[qi];
    for (const side of [-1, 1]) {
      const off = side * (SW / 2 + 2.9), x = S.pts[qi].x - t.z * off, z = S.pts[qi].z + t.x * off;
      if (gridDist(x, z) < WALL + 1) continue;
      wallXf.push([x, h(x, z), z, Math.atan2(t.x, t.z), 2 + (wallXf.length % 2)]);
    }
  }
  const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), wallXf.length);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3();
  const wallCols = [new THREE.Color(th.wall[0]), new THREE.Color(th.wall[1]), new THREE.Color('#a8743f'), new THREE.Color('#e9c28a')];
  wallXf.forEach(([x, y, z, yaw, ci], i) => { walls.setMatrixAt(i, m4.compose(v3.set(x, y, z), q4.setFromEuler(e3.set(0, yaw, 0)), one)); walls.setColorAt(i, wallCols[ci]); });
  walls.castShadow = true; walls.receiveShadow = true; G.add(walls);

  // ramps (world-space prism with stripes)
  if (TR.ramps.length) {
    const pos = [], col = [], ca = new THREE.Color('#ffd23f'), cb = new THREE.Color('#2b2d42'), cside = new THREE.Color('#ff7b2e');
    const tri = (a, b, c, cl) => { pos.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) col.push(cl.r, cl.g, cl.b); };
    const fr = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3() };
    for (const s0 of TR.ramps) {
      const NU = 8, stripes = 7, w0 = -W / 2, sw = W / stripes;
      const at = (u, w, top) => { TR.frame(s0 + u * RAMP_LEN, fr); const x = fr.p.x + fr.r.x * w, z = fr.p.z + fr.r.z * w; return [x, h(x, z) + (top ? 0.07 + RAMP_H * u : -0.4), z]; };
      for (let a = 0; a < NU; a++) for (let k = 0; k < stripes; k++) {
        const u0 = a / NU, u1 = (a + 1) / NU, wa = w0 + k * sw, wb = wa + sw, cl = (k + a) % 2 ? ca : cb;
        const A = at(u0, wa, 1), B = at(u0, wb, 1), C = at(u1, wa, 1), D = at(u1, wb, 1);
        tri(A, C, B, cl); tri(B, C, D, cl);
      }
      for (const w of [w0, -w0]) for (let a = 0; a < NU; a++) {     // sides
        const A = at(a / NU, w, 1), B = at((a + 1) / NU, w, 1), C = at(a / NU, w, 0), D = at((a + 1) / NU, w, 0);
        tri(A, B, C, cside); tri(B, D, C, cside); tri(A, C, B, cside); tri(B, C, D, cside);
      }
      for (let k = 0; k < stripes; k++) { const A = at(1, w0 + k * sw, 1), B = at(1, w0 + (k + 1) * sw, 1), C = at(1, w0 + k * sw, 0), D = at(1, w0 + (k + 1) * sw, 0); tri(A, B, C, cside); tri(B, D, C, cside); tri(A, C, B, cside); tri(B, C, D, cside); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); rg.computeVertexNormals();
    const rm = new THREE.Mesh(rg, vcMat({ side: THREE.DoubleSide, flatShading: true })); rm.castShadow = true; rm.receiveShadow = true; G.add(rm);
  }
  // boost pads (one geometry, animated chevron texture)
  if (TR.pads.length) {
    const pos = [], uv = [], idx = [], fr = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3() };
    for (const pd of TR.pads) {
      const base = pos.length / 3, NU = 4;
      for (let a = 0; a <= NU; a++) for (const w of [-1.6, 1.6]) { TR.frame(pd.s + a * 6 / NU, fr); const x = fr.p.x + fr.r.x * (pd.lat + w), z = fr.p.z + fr.r.z * (pd.lat + w); pos.push(x, h(x, z) + 0.16, z); uv.push(w < 0 ? 0 : 1, a / NU * 1.5); }
      for (let a = 0; a < NU; a++) { const i = base + a * 2; idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3); }
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pg.setIndex(idx);
    const tex = chevronTex().clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const pm = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5 })); G.add(pm); TR.padTex = tex;
  }

  // start arch + grandstand + balloons (baked)
  {
    const fr = TR.frame(1.5), yaw = Math.atan2(fr.t.x, fr.t.z), parts = [], arch = W / 2 + 1.8;
    const at = (lat, fwd) => [fr.p.x + fr.r.x * lat + fr.t.x * fwd, 0, fr.p.z + fr.r.z * lat + fr.t.z * fwd];
    for (const side of [-1, 1]) {
      const [x, , z] = at(side * arch, 0), y = h(x, z);
      parts.push({ geo: new THREE.CylinderGeometry(0.55, 0.7, 7.2, 12), color: '#ffffff', pos: [x, y + 3.6, z] });
      parts.push({ geo: new THREE.CylinderGeometry(0.72, 0.72, 0.5, 12), color: th.wall[0], pos: [x, y + 0.25, z] });
      parts.push({ geo: new THREE.SphereGeometry(0.8, 14, 10), color: th.wall[0], pos: [x, y + 7.4, z] });
    }
    const y0 = h(fr.p.x, fr.p.z);
    parts.push({ geo: new THREE.BoxGeometry(arch * 2 + 1, 2.1, 0.6), color: '#2b2d42', pos: [fr.p.x, y0 + 6.4, fr.p.z], rot: [0, yaw, 0] });
    // grandstand on the outside of the start straight
    const gs = (fr.k > 0 ? -1 : 1) * (WALL + 8);
    for (let row = 0; row < 4; row++) {
      const [x, , z] = at(gs + Math.sign(gs) * row * 1.6, -6), y = h(x, z);
      parts.push({ geo: new THREE.BoxGeometry(1.6, 0.8 + row * 0.9, 30), color: row % 2 ? '#e7e9f5' : '#cfd3ea', pos: [x, y + (0.8 + row * 0.9) / 2, z], rot: [0, yaw, 0] });
    }
    { const [x, , z] = at(gs + Math.sign(gs) * 7.4, -6), y = h(x, z); parts.push({ geo: new THREE.BoxGeometry(1.2, 9, 30.5), color: th.wall[0], pos: [x, y + 4.5, z], rot: [0, yaw, 0] }); parts.push({ geo: new THREE.BoxGeometry(9, 0.5, 31), color: '#ffffff', pos: [at(gs + Math.sign(gs) * 3.2, -6)[0], y + 7.8, at(gs + Math.sign(gs) * 3.2, -6)[2]], rot: [0, yaw, 0] }); }
    const g = bake(parts), m = new THREE.Mesh(g, vcMat()); m.castShadow = true; m.receiveShadow = true; G.add(m);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(arch * 2 - 0.4, 1.7), new THREE.MeshBasicMaterial({ map: bannerTex('SKIDSY GP', th.wall[0] === '#ffffff' ? '#ff3d6e' : th.wall[0]), side: THREE.DoubleSide }));
    ban.position.set(fr.p.x - fr.t.x * 0.32, y0 + 6.4, fr.p.z - fr.t.z * 0.32); ban.rotation.y = yaw + Math.PI; G.add(ban);
    // crowd: little capsule fans on the stand (instanced, coloured)
    const crowdGeo = new THREE.CapsuleGeometry(0.28, 0.35, 3, 8), crowd = new THREE.InstancedMesh(crowdGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 120), cc = new THREE.Color();
    const pal = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#ff8c42', '#ffffff', '#2ec4b6'];
    let n = 0; for (let row = 0; row < 4; row++) for (let k = 0; k < 30; k++) {
      const [x, , z] = at(gs + Math.sign(gs) * row * 1.6, -20.5 + k), y = h(x, z) + 0.8 + row * 0.9 + 0.45;
      crowd.setMatrixAt(n, m4.compose(v3.set(x, y, z), q4.identity(), one)); crowd.setColorAt(n, cc.set(pal[(row * 7 + k * 3) % pal.length])); n++;
    }
    crowd.castShadow = true; G.add(crowd); TR.crowd = { mesh: crowd, base: [], n };
    for (let i = 0; i < n; i++) { crowd.getMatrixAt(i, m4); TR.crowd.base.push(new THREE.Vector3().setFromMatrixPosition(m4)); }
  }

  // scenery: themed props (one baked prototype each, instanced), rocks, mountains, clouds
  const protoA = propGeo(TR.def.theme, 'a'), protoB = propGeo(TR.def.theme, 'b');
  const place = (count, minD, maxD, geoProto, scaleR, extra = 0) => {
    const xf = []; let tries = 0;
    while (xf.length < count && tries++ < count * 30) {
      const x = (rnd() - 0.5) * 820, z = (rnd() - 0.5) * 820, gd = gridDist(x, z);
      if (gd < minD || gd > maxD || shortDist(x, z) < SW / 2 + 6) continue;
      const y = h(x, z); if (TR.th.sea && y < 0.2) continue;
      if (xf.some(o => (o[0] - x) ** 2 + (o[2] - z) ** 2 < extra * extra)) continue;
      xf.push([x, y, z, rnd() * TAU, scaleR[0] + rnd() * (scaleR[1] - scaleR[0])]);
    }
    const im = new THREE.InstancedMesh(geoProto, vcMat(), xf.length);
    xf.forEach(([x, y, z, yaw, s], i) => im.setMatrixAt(i, m4.compose(v3.set(x, y, z), q4.setFromEuler(e3.set(0, yaw, 0)), new THREE.Vector3(s, s, s))));
    im.castShadow = true; im.receiveShadow = true; G.add(im); return im;
  };
  place(230, WALL + 4, 260, protoA, [0.8, 1.5], 3);
  place(50, WALL + 6, 200, protoB, [0.9, 1.3], 6);
  const rockG = bake([{ geo: new THREE.IcosahedronGeometry(1, 0), color: TR.def.theme === 'frost' ? '#c7d2ee' : TR.def.theme === 'canyon' ? '#b8613f' : '#a9a9b8', scl: [1.3, 0.8, 1] }]);
  place(50, WALL + 3, 230, rockG, [0.7, 2.2], 2);
  // mountains / mesas ring
  {
    const parts = [], [mc, cap] = th.mtn;
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU + rnd() * 0.15, r = 520 + rnd() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r, hh = 60 + rnd() * 90, rad = 50 + rnd() * 50;
      if (TR.def.theme === 'canyon') { parts.push({ geo: new THREE.CylinderGeometry(rad * 0.7, rad * 0.95, hh * 0.6, 9), color: mc, pos: [x, hh * 0.3 - 5, z] }); parts.push({ geo: new THREE.CylinderGeometry(rad * 0.72, rad * 0.72, 4, 9), color: cap, pos: [x, hh * 0.6 - 4, z] }); }
      else { parts.push({ geo: new THREE.ConeGeometry(rad, hh, 9), color: mc, pos: [x, hh / 2 - 6, z] }); parts.push({ geo: new THREE.ConeGeometry(rad * 0.36, hh * 0.36, 9), color: cap, pos: [x, hh - 6 - hh * 0.18 + 0.5, z] }); }
    }
    const mm = new THREE.Mesh(bake(parts), vcMat({ flatShading: true, fog: true })); G.add(mm);
  }
  {
    const cg = new THREE.SphereGeometry(1, 12, 8), clouds = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 }), 22 * 4);
    let n = 0; for (let i = 0; i < 22; i++) {
      const a = rnd() * TAU, r = 120 + rnd() * 380, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 70 + rnd() * 40, s = 9 + rnd() * 9;
      for (let k = 0; k < 4; k++) clouds.setMatrixAt(n++, m4.compose(v3.set(x + (k - 1.5) * s * 0.9, y + (k % 2) * s * 0.3, z + (rnd() - 0.5) * s), q4.identity(), new THREE.Vector3(s * (k % 3 ? 1 : 1.3), s * 0.6, s)));
    }
    G.add(clouds); TR.clouds = clouds;
  }
  return G;
}

function propGeo(theme, kind) {
  const P = [];
  if (theme === 'meadow') {
    if (kind === 'a') { P.push({ geo: new THREE.CylinderGeometry(0.3, 0.45, 3, 7), color: '#9a6a3a', pos: [0, 1.5, 0] }, { geo: new THREE.IcosahedronGeometry(2.1, 1), color: '#43b64f', pos: [0, 4.2, 0] }, { geo: new THREE.IcosahedronGeometry(1.5, 1), color: '#5ccc5a', pos: [0.9, 5.2, 0.4] }, { geo: new THREE.IcosahedronGeometry(1.2, 1), color: '#36a345', pos: [-1, 3.6, -0.5] }); }
    else { P.push({ geo: new THREE.IcosahedronGeometry(1.2, 1), color: '#58c45a', pos: [0, 0.7, 0], scl: [1.3, 0.8, 1.1] }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P.push({ geo: new THREE.SphereGeometry(0.25, 8, 6), color: ['#ff5d8f', '#ffd23f', '#ffffff'][i % 3], pos: [Math.cos(a) * 1.2, 1.25 + (i % 2) * 0.2, Math.sin(a) * 1.0] }); } }
  } else if (theme === 'canyon') {
    if (kind === 'a') { P.push({ geo: new THREE.CapsuleGeometry(0.5, 3, 4, 10), color: '#4caf50', pos: [0, 2, 0] }, { geo: new THREE.CapsuleGeometry(0.32, 1.1, 4, 8), color: '#58bb5c', pos: [0.85, 2.6, 0], rot: [0, 0, -0.2] }, { geo: new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), color: '#58bb5c', pos: [-0.8, 2.2, 0], rot: [0, 0, 0.25] }, { geo: new THREE.SphereGeometry(0.28, 8, 6), color: '#ff5d8f', pos: [0, 3.95, 0] }); }
    else { let y = 0; for (let i = 0; i < 4; i++) { const r = 2.6 - i * 0.45, hh = 1.6 + (i % 2) * 0.6; P.push({ geo: new THREE.CylinderGeometry(r * 0.9, r, hh, 8), color: ['#d4704a', '#f0a070', '#c25e3a', '#ffbf80'][i], pos: [0, y + hh / 2, 0] }); y += hh; } }
  } else if (theme === 'coast') {
    if (kind === 'a') {
      for (let i = 0; i < 5; i++) P.push({ geo: new THREE.CylinderGeometry(0.26, 0.32, 1.3, 7), color: i % 2 ? '#b5793f' : '#c98d50', pos: [i * 0.18, 0.65 + i * 1.22, 0], rot: [0, 0, -0.12] });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P.push({ geo: new THREE.ConeGeometry(0.55, 3.2, 4), color: i % 2 ? '#3dbb5b' : '#2fa54d', pos: [0.9 + Math.cos(a) * 1.3, 6.2, Math.sin(a) * 1.3], rot: [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3], scl: [1, 1, 0.3] }); }
    } else { P.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), color: '#ffffff', pos: [0, 1.3, 0] }, { geo: new THREE.ConeGeometry(1.8, 0.7, 10), color: '#ff5d8f', pos: [0, 2.7, 0] }, { geo: new THREE.BoxGeometry(1.6, 0.12, 0.8), color: '#3a86ff', pos: [1.4, 0.3, 0] }); }
  } else {
    if (kind === 'a') { P.push({ geo: new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6), color: '#7a5235', pos: [0, 0.7, 0] }); for (let i = 0; i < 3; i++) { P.push({ geo: new THREE.ConeGeometry(2.0 - i * 0.5, 2.4, 8), color: '#2f8f6a', pos: [0, 2.2 + i * 1.4, 0] }); P.push({ geo: new THREE.ConeGeometry(1.0 - i * 0.25, 0.9, 8), color: '#ffffff', pos: [0, 3.05 + i * 1.4, 0] }); } }
    else { P.push({ geo: new THREE.SphereGeometry(1.0, 14, 10), color: '#ffffff', pos: [0, 0.9, 0] }, { geo: new THREE.SphereGeometry(0.72, 14, 10), color: '#ffffff', pos: [0, 2.2, 0] }, { geo: new THREE.SphereGeometry(0.5, 14, 10), color: '#ffffff', pos: [0, 3.2, 0] }, { geo: new THREE.ConeGeometry(0.12, 0.6, 6), color: '#ff8c42', pos: [0, 3.2, 0.7], rot: [Math.PI / 2, 0, 0] }, { geo: new THREE.SphereGeometry(0.08, 6, 5), color: '#22223b', pos: [0.18, 3.35, 0.43] }, { geo: new THREE.SphereGeometry(0.08, 6, 5), color: '#22223b', pos: [-0.18, 3.35, 0.43] }, { geo: new THREE.TorusGeometry(0.55, 0.12, 6, 14), color: '#ff5d8f', pos: [0, 2.75, 0], rot: [Math.PI / 2, 0, 0] }); }
  }
  return bake(P);
}

function mergeGeos(gs) {
  const pos = [], uv = [], idx = []; let off = 0;
  for (const g of gs) { pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); o.setIndex(idx); o.computeVertexNormals(); return o;
}

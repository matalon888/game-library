// Lapwise track builder: a closed, banked circuit ribbon with kerbs, tyre walls, pit lane, garages,
// grandstands with a crowd, start gantry, trees and far hills. All geometry is generated in code.
import { THREE, rounded, mat, glossy, rng } from './kit/hc.js';

export const W = 14;                         // road width
export const LANES = [-4.5, -1.5, 1.5, 4.5];  // lateral lane centres (negative = driver's left)
export const PIT = { inR: 0, outR: 210, garage0: 58, slot: 9, slots: 10, before: 100 }; // r = metres after pit entry

export const TRACKS = [
  { id: 'harbor', name: 'Harbor Ring', need: 0, needTxt: '', bank: 9, maxBank: 0.3, hill: 2, scen: 'pine',
    sky: ['#6fc3ff', '#e4f6ff'], fog: '#cdeeff', grass: ['#71d05c', '#62c24e'], dirt: '#4f9a3f', trees: ['#2f9e44', '#3fb658', '#1f8a3c'], night: false,
    pts: [[-150, 0], [0, 0], [135, 0], [180, -30], [188, -85], [150, -122], [92, -112], [62, -72], [12, -62], [-28, -110], [-90, -134], [-152, -104], [-172, -44]] },
  { id: 'bowl', name: 'Desert Bowl', need: 2, needTxt: 'Finish 2 races', bank: 46, maxBank: 0.5, hill: 0, scen: 'rock',
    sky: ['#ff9f5a', '#ffe4b0'], fog: '#ffd9a8', grass: ['#f0c477', '#e6b665'], dirt: '#c98d4a', trees: ['#c97a45', '#b5653a', '#d99256'], night: false,
    pts: [[-125, 0], [0, 0], [125, 0], [182, -24], [206, -82], [182, -140], [125, -164], [0, -164], [-125, -164], [-182, -140], [-206, -82], [-182, -24]] },
  { id: 'alpine', name: 'Alpine Esses', need: 5, needTxt: 'Finish 5 races', bank: 8, maxBank: 0.3, hill: 7, scen: 'pine',
    sky: ['#8fd3ff', '#f4fbff'], fog: '#e3f4ff', grass: ['#93d978', '#83cc68'], dirt: '#5f9a48', trees: ['#2b7a4b', '#3c8f5c', '#1e6a3e'], night: false,
    pts: [[-140, 0], [0, 0], [130, 0], [178, -42], [160, -102], [98, -94], [64, -142], [104, -192], [44, -236], [-38, -206], [-30, -146], [-92, -124], [-152, -152], [-196, -92], [-178, -32]] },
  { id: 'night', name: 'Night Ring', need: 10, needTxt: 'Finish 10 races', bank: 9, maxBank: 0.3, hill: 2, scen: 'pine',
    sky: ['#070b2b', '#2b2766'], fog: '#1b1b4a', grass: ['#245c3e', '#1f5236'], dirt: '#173d2a', trees: ['#174a32', '#1d5a3b', '#123d29'], night: true,
    pts: [[-140, 0], [0, 0], [135, 0], [184, -40], [172, -102], [112, -130], [124, -190], [52, -222], [-20, -184], [-60, -122], [-122, -152], [-184, -112], [-180, -40]] },
];

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const roadTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5b5f6e'; g.fillRect(0, 0, w, h);
  const r = rng(7); for (let i = 0; i < 2200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(r() * w, r() * h, 2, 2); }
  g.fillStyle = 'rgba(30,30,40,.25)'; g.fillRect(w * 0.36, 0, w * 0.1, h); g.fillRect(w * 0.56, 0, w * 0.08, h);   // racing line rubber
  g.fillStyle = '#ffffff'; g.fillRect(3, 0, 7, h); g.fillRect(w - 10, 0, 7, h);
  g.fillStyle = 'rgba(255,255,255,.75)'; for (const x of [0.25, 0.5, 0.75]) g.fillRect(w * x - 2, 0, 4, h * 0.45);
}, true);
const wallTex = canvasTex(128, 32, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#2f6bff'; g.fillRect(i * 32, 0, 32, h); } g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 6, w, 6); }, true);
const checkTex = canvasTex(128, 32, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } });
const pitTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#7a7f8f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 4, h); g.fillStyle = '#ffffff'; g.fillRect(w - 4, 0, 4, h); }, true);
export function grassTex(a, b) { return canvasTex(64, 64, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 0, w, h / 2); }, true); }
export function signTex(text, bg = '#ff3b5c', fg = '#fff', w = 512, h = 96) {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `900 ${h * 0.62}px "Russo One",system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3); });
}

// ---------------------------------------------------------------- centre-line samples + banking
export function buildLine(def) {
  const pts = def.pts.map(([x, z], i) => new THREE.Vector3(x, def.hill * (0.5 + 0.5 * Math.sin(i * 1.9 + 1)) * (Math.abs(z) < 5 ? 0.2 : 1), z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const len = curve.getLength(), NS = Math.round(len / 1.0);
  let P = curve.getSpacedPoints(NS).slice(0, NS);
  let i0 = 0, best = 1e9; P.forEach((p, i) => { const d = p.x * p.x + p.z * p.z; if (d < best) { best = d; i0 = i; } });
  P = P.slice(i0).concat(P.slice(0, i0));
  const Y = new THREE.Vector3(0, 1, 0), Tn = [], Sf = [], K = [], S = [], U = [], B = [];
  for (let i = 0; i < NS; i++) Tn.push(P[(i + 1) % NS].clone().sub(P[(i - 1 + NS) % NS]).normalize());
  for (let i = 0; i < NS; i++) Sf.push(new THREE.Vector3().crossVectors(Tn[i], Y).normalize());
  const ds = len / NS;
  for (let i = 0; i < NS; i++) K.push(Tn[(i + 1) % NS].clone().sub(Tn[(i - 1 + NS) % NS]).dot(Sf[i]) / (2 * ds));
  const Ks = K.map((_, i) => { let s = 0; for (let j = -10; j <= 10; j++) s += K[(i + j + NS) % NS]; return s / 21; });
  for (let i = 0; i < NS; i++) {
    const b = THREE.MathUtils.clamp(Ks[i] * def.bank, -def.maxBank, def.maxBank); B.push(b);
    const u0 = new THREE.Vector3().crossVectors(Sf[i], Tn[i]).normalize();
    const u = u0.multiplyScalar(Math.cos(b)).addScaledVector(Sf[i], Math.sin(b)).normalize();
    U.push(u); S.push(new THREE.Vector3().crossVectors(Tn[i], u).normalize());
    P[i].y += 0.3 + Math.abs(Math.sin(b)) * (W / 2 + 1.6);
  }
  // which side is the infield?  (pit + garages go there, grandstands on the other side)
  const c = new THREE.Vector3(); P.forEach(p => c.add(p)); c.divideScalar(NS);
  const inside = Math.sign(c.clone().sub(P[0]).dot(S[0])) || -1;
  return { NS, L: len, ds, P, T: Tn, S, U, K: Ks, B, inside, centre: c, def };
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export function frameAt(T, s, out) {
  const u = ((s % T.L) + T.L) % T.L / T.ds, i = Math.floor(u) % T.NS, j = (i + 1) % T.NS, f = u - Math.floor(u);
  out.p.lerpVectors(T.P[i], T.P[j], f); out.t.lerpVectors(T.T[i], T.T[j], f).normalize();
  out.u.lerpVectors(T.U[i], T.U[j], f).normalize(); out.s.lerpVectors(T.S[i], T.S[j], f).normalize();
  out.k = T.K[i]; return out;
}
export const newFrame = () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), s: new THREE.Vector3(), k: 0 });
export const pitS = (T, r) => r - PIT.before;            // pit-relative metres -> track s (may be negative)

// a strip of quads between two lateral offsets, optional vertex colours, uv along the track
function strip(T, latA, latB, { lift = 0, colorFn = null, vScale = 10, from = 0, to = null, worldUp = 0 } = {}) {
  const n = to === null ? T.NS : to - from, pos = [], uv = [], col = [], idx = [];
  const ca = new THREE.Color();
  for (let k = 0; k <= n; k++) {
    const i = (from + k) % T.NS, p = T.P[i], s = T.S[i], u = T.U[i];
    const la = typeof latA === 'function' ? latA(i) : latA, lb = typeof latB === 'function' ? latB(i) : latB;
    _a.copy(p).addScaledVector(s, la).addScaledVector(u, lift);
    _b.copy(p).addScaledVector(s, lb).addScaledVector(u, lift);
    if (worldUp) { _b.copy(_a); _b.y += worldUp; }
    pos.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z);
    const v = (from + k) * T.ds / vScale; uv.push(0, v, 1, v);
    if (colorFn) { colorFn(i, ca); col.push(ca.r, ca.g, ca.b, ca.r, ca.g, ca.b); }
    if (k < n) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ---------------------------------------------------------------- the whole venue
export function buildVenue(T, theme) {
  const G = new THREE.Group(), r = rng(T.NS * 13 + 5), sideIn = T.inside, sideOut = -T.inside;
  const add = (m, shadow = true) => { if (shadow) { m.castShadow = true; m.receiveShadow = true; } G.add(m); return m; };
  const night = theme.night;
  // ground with mowing stripes
  const gt = grassTex(theme.grass[0], theme.grass[1]); gt.repeat.set(70, 70); gt.rotation = 0.6;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), mat('#ffffff', { map: gt, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.copy(T.centre).setY(-0.05); ground.receiveShadow = true; G.add(ground);
  // road (flip the strip so the face points up)
  const road = new THREE.Mesh(strip(T, W / 2, -W / 2, { vScale: 12 }), mat('#ffffff', { map: roadTex, roughness: 0.85, side: THREE.DoubleSide }));
  road.receiveShadow = true; G.add(road);
  // kerbs: red/white in corners, white on straights
  const kerbCol = (i, c) => { const corner = Math.abs(T.K[i]) > 0.008, band = Math.floor(i * T.ds / 2.6) % 2; c.set(corner ? (band ? '#ff3344' : '#ffffff') : (band ? '#e9eef5' : '#ffffff')); };
  for (const sg of [1, -1]) {
    const a = sg > 0 ? W / 2 : -W / 2 - 1.8, b = sg > 0 ? W / 2 + 1.8 : -W / 2;
    const kg = strip(T, b, a, { lift: 0.05, colorFn: kerbCol });
    G.add(Object.assign(new THREE.Mesh(kg, mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide })), { receiveShadow: true }));
    // embankment skirt so banked / raised road never floats
        const skirt = new THREE.BufferGeometry(), pos = [], idx = [];
    for (let i = 0; i <= T.NS; i++) {
      const k = i % T.NS; _a.copy(T.P[k]).addScaledVector(T.S[k], sg * (W / 2 + 1.8)).addScaledVector(T.U[k], 0.05);
      pos.push(_a.x, _a.y, _a.z, _a.x + T.S[k].x * sg * 4, -0.1, _a.z + T.S[k].z * sg * 4);
      if (i < T.NS) { const q = i * 2; sg > 0 ? idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2) : idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    skirt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); skirt.setIndex(idx); skirt.computeVertexNormals();
    add(new THREE.Mesh(skirt, mat(theme.dirt, { side: THREE.DoubleSide })), false).receiveShadow = true;
  }
  // tyre walls (skip the infield wall along the pit straight)
  const pitFrom = Math.round((T.L - PIT.before - 12) / T.ds) % T.NS, pitTo = Math.round((PIT.outR - PIT.before + 12) / T.ds);
  const wallMat = mat('#ffffff', { map: wallTex, side: THREE.DoubleSide });
  const wallOut = strip(T, sideOut * (W / 2 + 7), 0, { worldUp: 1.3, vScale: 8 });
  add(new THREE.Mesh(wallOut, wallMat));
  const inN = T.NS - (pitTo + (T.NS - pitFrom));
  add(new THREE.Mesh(strip(T, sideIn * (W / 2 + 18), 0, { worldUp: 1.3, vScale: 8, from: pitTo, to: pitTo + inN }), wallMat));
  // pit lane + pit wall
  const i0 = pitFrom, n = (pitTo - pitFrom + T.NS) % T.NS;
  const pe = i => { const r = ((i - i0 + T.NS) % T.NS) * T.ds; return Math.max(0, Math.min(1, Math.min(r, n * T.ds - r) / 30)); };
  const pl = strip(T, i => sideIn * (W / 2 + 1.8 + 5 * pe(i)), i => sideIn * (W / 2 + 2.2 + 11 * pe(i)),
    { lift: 0.07, from: i0, to: i0 + n, vScale: 6 });
  const plm = new THREE.Mesh(pl, mat('#ffffff', { map: pitTex, side: THREE.DoubleSide, roughness: 0.9 })); plm.receiveShadow = true; G.add(plm);
  const pw0 = (i0 + Math.round(40 / T.ds)) % T.NS, pwn = Math.round((PIT.outR - 80) / T.ds);
  add(new THREE.Mesh(strip(T, sideIn * (W / 2 + 2.6), 0, { worldUp: 0.9, from: pw0, to: pw0 + pwn, vScale: 4, lift: 0.05 }), mat('#ffffff', { map: wallTex, side: THREE.DoubleSide, color: '#ffd6d6' })));
  // garages
  const garages = [];
  const roofLen = PIT.slots * PIT.slot + 4;
  for (let g = 0; g < PIT.slots; g++) {
    const rr = PIT.garage0 + g * PIT.slot, s = pitS(T, rr), f = frameAt(T, s, newFrame());
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(PIT.slot - 0.4, 4.2, 6), mat(night ? '#3b3f5c' : '#eef1f7')); box.position.set(0, 2.1, 3); box.castShadow = box.receiveShadow = true;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(PIT.slot - 1.6, 3.2), mat('#c9cfdc')); door.position.set(0, 1.7, -0.03); door.rotation.y = Math.PI;
    grp.add(box, door);
    const base = f.p.clone().addScaledVector(f.s, sideIn * (W / 2 + 14)); base.y = Math.max(0, base.y - 0.25);
    const Yv = new THREE.Vector3(0, 1, 0), z = f.s.clone().setY(0).normalize().multiplyScalar(sideIn), x = new THREE.Vector3().crossVectors(Yv, z);
    grp.position.copy(base); grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, Yv, z));
    G.add(grp); garages.push({ grp, door, r: rr });
  }
  // pit roof + sign
  { const mid = pitS(T, PIT.garage0 + (PIT.slots - 1) * PIT.slot / 2), f = frameAt(T, mid, newFrame());
    const roof = new THREE.Mesh(rounded(roofLen, 0.6, 8, 0.2), mat('#ff3b5c')); const base = f.p.clone().addScaledVector(f.s, sideIn * (W / 2 + 17)); base.y = Math.max(0, base.y - 0.25) + 4.5;
    roof.position.copy(base); roof.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.t.clone().setY(0).normalize(), new THREE.Vector3(0, 1, 0), new THREE.Vector3().crossVectors(f.t.clone().setY(0).normalize(), new THREE.Vector3(0, 1, 0))));
    add(roof); }
  // start gantry with 5 lights + sign
  const lights = [];
  { const f = frameAt(T, 0, newFrame()), gan = new THREE.Group();
    const postM = mat('#2b2d42'); for (const sg of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), postM); p.position.set(sg * (W / 2 + 2), 4, 0); p.castShadow = true; gan.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 4.6, 1.6, 0.8), mat('#2b2d42')); beam.position.y = 7.6; gan.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, 1.3), new THREE.MeshBasicMaterial({ map: signTex('LAPWISE', '#ff3b5c') })); sign.position.set(0, 9.1, 0); gan.add(sign);
    const sign2 = sign.clone(); sign2.rotation.y = Math.PI; gan.add(sign2);
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 1.6, 0.3), mat('#2b2d42')); signBack.position.set(0, 9.1, 0); gan.add(signBack);
    sign.position.z = -0.2; sign2.position.z = 0.2;
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), new THREE.MeshStandardMaterial({ color: '#331111', emissive: '#000000' })); l.position.set((i - 2) * 1.5, 7.6, -0.5); gan.add(l); lights.push(l); }
    gan.position.copy(f.p); gan.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.s.clone().multiplyScalar(-1), f.u, f.t).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
    G.add(gan);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 2), new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.7 }));
    line.position.copy(f.p).addScaledVector(f.u, 0.06); line.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.s, f.t, f.u)); line.receiveShadow = true; G.add(line);
  }
  // grandstands with crowd along the main straight (outside)
  const crowdPos = [];
  for (const rr of [70, 104, 138]) {
    const s = pitS(T, rr), f = frameAt(T, s, newFrame());
    const st = new THREE.Group(), cols = ['#2f6bff', '#ff3b5c', '#ffd23f'];
    for (let k = 0; k < 4; k++) { const step = new THREE.Mesh(new THREE.BoxGeometry(30, 1 + k * 1.2, 2.2), mat(k % 2 ? '#d7dce8' : '#c3c9d8')); step.position.set(0, (1 + k * 1.2) / 2, 2 + k * 2.2); step.castShadow = step.receiveShadow = true; st.add(step);
      for (let c = 0; c < 26; c++) crowdPos.push({ st, x: -14 + c * 1.1 + (r() - 0.5) * 0.3, y: 1 + k * 1.2, z: 2 + k * 2.2 }); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(31, 0.4, 10), mat(cols[rr % 3])); roof.position.set(0, 9.6, 6); roof.rotation.x = -0.12; roof.castShadow = true; st.add(roof);
    for (const x of [-15, 15]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.6, 0.4), mat('#2b2d42')); p.position.set(x, 4.8, 10.5); st.add(p); }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(26, 1.1), new THREE.MeshBasicMaterial({ map: signTex(['GO TEAM', 'SHIP IT', 'BOX BOX'][rr % 3], cols[(rr + 1) % 3]) })); banner.position.set(0, 0.6, 0.85); st.add(banner);
    const base = f.p.clone().addScaledVector(f.s, sideOut * (W / 2 + 9)); base.y = 0;
    st.position.copy(base);
    const zDir = f.s.clone().setY(0).normalize().multiplyScalar(sideOut), xDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zDir);
    st.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xDir, new THREE.Vector3(0, 1, 0), zDir));
    G.add(st);
  }
  G.updateMatrixWorld(true);
  const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.32, 0.4, 3, 6), mat('#ffffff'), crowdPos.length);
  const cc = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#ffffff', '#ff8c42', '#2b2d42'], m4 = new THREE.Matrix4(), col = new THREE.Color();
  crowdPos.forEach((c, i) => { const v = new THREE.Vector3(c.x, c.y + 0.55, c.z).applyMatrix4(c.st.matrixWorld); c.w = v; c.ph = r() * 6; m4.makeTranslation(v.x, v.y, v.z); crowd.setMatrixAt(i, m4); crowd.setColorAt(i, col.set(cc[(r() * cc.length) | 0])); });
  crowd.castShadow = true; G.add(crowd);
  // trees / rocks, kept off the track
  const far = []; for (let i = 0; i < T.NS; i += 4) far.push(T.P[i]);
  const okSpot = (x, z, m) => far.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > m * m);
  const spots = []; let guard = 0;
  while (spots.length < 230 && guard++ < 6000) { const x = T.centre.x + (r() - 0.5) * 620, z = T.centre.z + (r() - 0.5) * 560; if (okSpot(x, z, W / 2 + 22)) spots.push([x, z, 0.7 + r() * 0.9]); }
  if (theme.scen === 'pine') {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, 2, 6), mat('#7a4a2a'), spots.length);
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 6.5, 7), mat('#ffffff', { flatShading: true }), spots.length);
    spots.forEach(([x, z, s], i) => { m4.compose(new THREE.Vector3(x, s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, s * 5, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s, s)); cone.setMatrixAt(i, m4); cone.setColorAt(i, col.set(theme.trees[i % 3])); });
    trunk.castShadow = cone.castShadow = true; G.add(trunk, cone);
  } else {
    const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.2, 0), mat('#ffffff', { flatShading: true }), spots.length);
    spots.forEach(([x, z, s], i) => { m4.compose(new THREE.Vector3(x, s * 0.8, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())), new THREE.Vector3(s * 1.4, s * (0.6 + r() * 0.8), s * 1.2)); rock.setMatrixAt(i, m4); rock.setColorAt(i, col.set(theme.trees[i % 3])); });
    rock.castShadow = true; G.add(rock);
  }
  // far hills ring
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, d = 430 + r() * 80, h = 50 + r() * 70;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(70 + r() * 50, h, 6), mat(night ? '#1c2150' : theme.id === 'bowl' ? '#e09a5c' : '#9fd4b0', { flatShading: true }));
    hill.position.set(T.centre.x + Math.cos(a) * d, h / 2 - 2, T.centre.z + Math.sin(a) * d); G.add(hill);
  }
  // floodlight towers (all tracks; they glow at night)
  const lamps = [];
  for (let i = 0; i < 10; i++) {
    const s = (i + 0.5) / 10 * T.L, f = frameAt(T, s, newFrame()), side = i % 2 ? sideOut : sideIn;
    const base = f.p.clone().addScaledVector(f.s, side * (W / 2 + 9)); base.y = 0;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 16, 6), mat('#4a4e69')); pole.position.copy(base).setY(8); pole.castShadow = true; G.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.6), new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: night ? '#fff3c4' : '#000000', emissiveIntensity: 1.4 })); head.position.copy(base).setY(16.4); head.lookAt(f.p.x, 16, f.p.z); G.add(head); lamps.push(head);
  }
  // TV camera spots
  const cams = []; for (let i = 0; i < 12; i++) { const s = i / 12 * T.L, f = frameAt(T, s, newFrame()), side = i % 3 ? sideOut : sideIn; cams.push(f.p.clone().addScaledVector(f.s, side * (W / 2 + 16)).add(new THREE.Vector3(0, 7 + (i % 2) * 4, 0))); }
  return { group: G, garages, lights, crowd, crowdPos, cams };
}

export function disposeGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map && m.map !== roadTex && m.map !== wallTex && m.map !== checkTex && m.map !== pitTex) m.map.dispose(); m.dispose(); }); });
}

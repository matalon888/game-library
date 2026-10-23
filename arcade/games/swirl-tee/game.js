// Swirl Tee — original tie-dye game. Pick the fold, bind the shirt, squirt dye into each section, unfold for the reveal.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, clamp, rng, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';

const $ = (id) => document.getElementById(id);
const ST = store('swirltee');
const F = flow('swirltee');
const WB = worldBoard({ game: 'swirl-tee', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });
let level = ST.get('level', 1), best = ST.get('best', 0), score = 0;
const ui = createUI({ title: 'SWIRL<br>TEE', hint: 'Tap the fold, rub the shirt', hand: '👆', score: false });
const stage = createStage({ fov: 38, shadowSize: 6 });
const { scene, camera } = stage;
stage.followLight(new THREE.Vector3(0, 0, 0));

// ------------------------------------------------------------------ sand background (canvas noise tile)
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 220; const x = c.getContext('2d');
  x.fillStyle = '#e6cda2'; x.fillRect(0, 0, 220, 220);
  for (let i = 0; i < 5200; i++) {
    const v = Math.random(); x.fillStyle = v < 0.5 ? `rgba(160,120,70,${0.08 + Math.random() * 0.18})` : `rgba(255,248,230,${0.1 + Math.random() * 0.3})`;
    x.fillRect(Math.random() * 220, Math.random() * 220, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
  }
  document.body.style.background = `radial-gradient(ellipse at 50% 45%, rgba(255,240,215,.35), rgba(120,80,40,.18) 95%), url(${c.toDataURL()}) #e6cda2`;
  document.body.style.backgroundSize = 'cover, 220px 220px';
})();

// ------------------------------------------------------------------ helpers
const DYES = ['#2f2bff', '#ffb400', '#ff1f8e', '#10cf96', '#a321ff', '#ff3b30', '#00aaff', '#ff7a00'];
const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const DRGB = DYES.map(rgbOf);
function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ------------------------------------------------------------------ table + props
function slabGeo(w, l, t, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -l / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + l - r);
  s.quadraticCurveTo(x + w, y + l, x + w - r, y + l); s.lineTo(x + r, y + l); s.quadraticCurveTo(x, y + l, x, y + l - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 4, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); g.translate(0, -t - 0.1, 0); return g;
}
const TW = 5.5, TL = 8.6, TZ = 0.35;
const table = new THREE.Mesh(slabGeo(TW, TL, 0.34, 0.75), mat('#ffd02e', { roughness: 0.55, emissive: '#ffb000', emissiveIntensity: 0.12 }));
table.position.z = TZ; table.receiveShadow = true; table.castShadow = true; scene.add(table);
const legM = mat('#f4f4f8', { roughness: 0.3, metalness: 0.3 });
for (const [x, z] of [[-2.1, 4.1], [2.1, 4.1], [-2.1, -3.4], [2.1, -3.4]]) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 10), legM); leg.position.set(x, -1.5, z + TZ); leg.castShadow = true; scene.add(leg);
  const bar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 6, 16, Math.PI), legM); bar.position.set(x, -2.55, z + TZ); bar.rotation.set(0, Math.PI / 2, Math.PI); scene.add(bar);
}
const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -2.6; floorShadow.receiveShadow = true; scene.add(floorShadow);
// dye splats on the table top
const SPC = document.createElement('canvas'); SPC.width = 330; SPC.height = 516; const spx = SPC.getContext('2d');
const spTex = new THREE.CanvasTexture(SPC); spTex.colorSpace = THREE.SRGBColorSpace;
const splats = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.4, TL - 0.4), new THREE.MeshStandardMaterial({ map: spTex, transparent: true, depthWrite: false, roughness: 0.6 }));
splats.rotation.x = -Math.PI / 2; splats.position.set(0, 0.006, TZ); splats.receiveShadow = true; scene.add(splats);
function tableSplat(wx, wz, col, a = 0.28, rad = 0.35) {
  const px = (wx / (TW - 0.4) + 0.5) * SPC.width, py = ((wz - TZ) / (TL - 0.4) + 0.5) * SPC.height, R = rad * SPC.width / (TW - 0.4);
  const [r, g, b] = rgbOf(col);
  for (let i = 0; i < 3; i++) {
    const ox = (Math.random() - 0.5) * R, oy = (Math.random() - 0.5) * R, rr = R * (0.4 + Math.random() * 0.7);
    const gr = spx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(0.7, `rgba(${r},${g},${b},${a * 0.7})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    spx.fillStyle = gr; spx.beginPath(); spx.arc(px + ox, py + oy, rr, 0, 7); spx.fill();
  }
  spTex.needsUpdate = true;
}

// ------------------------------------------------------------------ bottles (tip at group origin)
function makeBottle(col) {
  const g = new THREE.Group(), body = glossy(col, { roughness: 0.18 }), white = mat('#ffffff', { roughness: 0.35 });
  const parts = [
    [new THREE.ConeGeometry(0.075, 0.3, 14), body, -0.15],
    [new THREE.CylinderGeometry(0.13, 0.15, 0.18, 18), white, -0.38],
    [new THREE.CylinderGeometry(0.17, 0.25, 0.16, 20), white, -0.54],
    [new THREE.CylinderGeometry(0.25, 0.25, 0.78, 22), body, -1.0],
    [new THREE.CylinderGeometry(0.255, 0.255, 0.18, 22), white, -0.72],
  ];
  for (const [geo, m, y] of parts) { const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.castShadow = true; g.add(mesh); }
  g.userData.body = body; g.scale.setScalar(1.15); return g;
}
let slotBottles = [];
const hand = makeBottle(DYES[0]); scene.add(hand); hand.visible = false;
const handPos = new THREE.Vector3(2.2, 1.6, 1.6), handGoal = handPos.clone(); let squeeze = 0;

// ------------------------------------------------------------------ the shirt
const SX0 = -2.3, SY0 = 2.4, SSZ = 4.6;   // shirt texture square: x in [-2.3, 2.3], y in [-2.2, 2.4]
const SHIRT = [['m', -0.62, 2.08], ['q', 0, 1.42, 0.62, 2.08], ['l', 1.38, 1.86], ['q', 1.85, 1.6, 2.27, 0.98], ['l', 1.66, 0.36], ['l', 1.36, 0.72],
  ['l', 1.4, -2.0], ['q', 0, -2.22, -1.4, -2.0], ['l', -1.36, 0.72], ['l', -1.66, 0.36], ['l', -2.27, 0.98], ['q', -1.85, 1.6, -1.38, 1.86]];
function shirtPath(target, map) {   // works for THREE.Shape (map = identity) or a 2D context (map = shirt -> px)
  for (const c of SHIRT) {
    const p = c.slice(1).map((v, i) => map(v, i % 2));
    if (c[0] === 'm') target.moveTo(p[0], p[1]); else if (c[0] === 'l') target.lineTo(p[0], p[1]); else target.quadraticCurveTo(p[0], p[1], p[2], p[3]);
  }
  target.closePath && target.closePath();
}
const shirtGeo = (() => {
  const s = new THREE.Shape(); shirtPath(s, (v) => v);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 14 });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - SX0) / SSZ, (p.getY(i) - (SY0 - SSZ)) / SSZ);
  g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g;
})();
function fabricCanvas(S = 512) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#fbfbfd'; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(150,150,175,.16)'; x.lineCap = 'round';
  for (let i = 0; i < 14; i++) { x.lineWidth = 2 + Math.random() * 5; x.beginPath(); const a = Math.random() * S, b = Math.random() * S; x.moveTo(a, b); x.quadraticCurveTo(a + (Math.random() - .5) * 200, b + (Math.random() - .5) * 200, a + (Math.random() - .5) * 260, b + (Math.random() - .5) * 260); x.stroke(); }
  return c;
}
function collar(x, S) {
  const toPx = (v, i) => i === 0 ? (v - SX0) / SSZ * S : (SY0 - v) / SSZ * S;
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = S * 0.018; x.beginPath(); x.moveTo(toPx(-0.62, 0), toPx(2.08, 1)); x.quadraticCurveTo(toPx(0, 0), toPx(1.42, 1), toPx(0.62, 0), toPx(2.08, 1)); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = S * 0.006; x.beginPath(); x.moveTo(toPx(-0.66, 0), toPx(2.0, 1)); x.quadraticCurveTo(toPx(0, 0), toPx(1.32, 1), toPx(0.66, 0), toPx(2.0, 1)); x.stroke();
}
const whiteC = fabricCanvas(); collar(whiteC.getContext('2d'), 512);
const whiteTex = new THREE.CanvasTexture(whiteC); whiteTex.colorSpace = THREE.SRGBColorSpace;
const shirtMat = new THREE.MeshStandardMaterial({ map: whiteTex, roughness: 0.85 });
const shirt = new THREE.Mesh(shirtGeo, shirtMat); shirt.castShadow = true; shirt.receiveShadow = true; scene.add(shirt);
const patC = document.createElement('canvas'); patC.width = patC.height = 512;
const patTex = new THREE.CanvasTexture(patC); patTex.colorSpace = THREE.SRGBColorSpace;

// ------------------------------------------------------------------ level
const FOLDS = ['spiral', 'rings', 'stripes'];
function genLevel(lv) {
  // hook ramp: level 1 = 2 big stripes (one fold button, fat brush), level 2 = 2 rings; level 3+ = the old curve from its level 1
  if (lv === 1) return { fold: 'stripes', N: 2, cols: [2, 6], btns: [2, 6], thr: 0.6, twist: 5, seed: 11, brush: 0.62, folds: 1, guide: true };
  if (lv === 2) return { fold: 'rings', N: 2, cols: [1, 4], btns: [1, 4, 3], thr: 0.65, twist: 5, seed: 23, brush: 0.46, folds: 2, guide: true };
  lv = lv - 2;
  const r = rng(lv * 7919 + 13), fk = F.k();
  const fold = lv <= 3 ? FOLDS[lv - 1] : ['spiral', 'rings', 'stripes', 'spiral'][Math.floor(r() * 4)];
  const N = fold === 'spiral' ? Math.min(8, 3 + Math.floor((lv + 1) / 2)) : fold === 'rings' ? Math.min(5, 2 + Math.floor(lv / 3)) : Math.min(6, 3 + Math.floor(lv / 3));
  const order = DYES.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const nCol = Math.max(2, Math.min(N, 2 + Math.ceil(lv / 2), 5)), tpal = order.slice(0, nCol), cols = [];
  for (let i = 0; i < N; i++) {
    let c, tries = 0;
    do { c = tpal[Math.floor(r() * nCol)]; tries++; } while (tries < 30 && (c === cols[i - 1] || (fold === 'spiral' && i === N - 1 && c === cols[0]) || (i < nCol && cols.includes(c))));
    cols.push(c);
  }
  const btns = order.slice(0, Math.min(6, nCol + (lv >= 2 ? 1 : 0) + (lv >= 5 ? 1 : 0)));
  for (let i = btns.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [btns[i], btns[j]] = [btns[j], btns[i]]; }
  return { fold, N, cols, btns, thr: Math.min(0.9, (0.7 + (lv - 1) * 0.012) * fk), twist: 4.6 + r() * 2.2, seed: r() * 100, brush: Math.max(0.21, (0.34 - lv * 0.008) / fk), folds: 3, guide: false };
}

// bundle space: nx, nz in [-1, 1]; the bound shirt is an ellipse nx² + (nz/Q)² <= 1, world = n * EXT
let L, EXT = 1.5, Q = 1, BH = 0.62;
function secOf(nx, nz) {
  if (nx * nx + (nz / Q) ** 2 > 1) return -1;
  if (L.fold === 'spiral') return Math.min(L.N - 1, Math.floor((Math.atan2(nz, nx) + Math.PI) / (2 * Math.PI) * L.N));
  if (L.fold === 'rings') return Math.min(L.N - 1, Math.floor(Math.hypot(nx, nz) * L.N));
  return clamp(Math.floor((nx + 1) / 2 * L.N), 0, L.N - 1);
}
function bump(nx, nz) {
  const N = L.N;
  if (L.fold === 'spiral') return 0.1 * Math.abs(Math.sin((Math.atan2(nz, nx) + Math.PI) * N / 2)) * Math.min(1, Math.hypot(nx, nz) * 2.5);
  if (L.fold === 'rings') return 0.1 * Math.abs(Math.sin(Math.hypot(nx, nz) * N * Math.PI));
  return 0.1 * Math.abs(Math.sin((nx + 1) / 2 * N * Math.PI));
}
const surfY = (nx, nz) => { const s = 1 - nx * nx - (nz / Q) ** 2; return s > 0 ? BH * Math.sqrt(s) : 0; };

// pattern renderer: shared by the target thumbnail and the reveal (sample(nx, nz) -> [r, g, b])
function drawPattern(ctx, S, lv, sample) {
  const img = ctx.createImageData(S, S), d = img.data, N = lv.N, sd = lv.seed;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = SX0 + (px + 0.5) / S * SSZ, y = SY0 - (py + 0.5) / S * SSZ;
    const w1 = vnoise(x * 1.7 + sd, y * 1.7) - 0.5, w2 = vnoise(x * 5 + sd, y * 5 - sd) - 0.5;
    let nx, nz, bd;
    if (lv.fold === 'spiral') {
      const dx = x - 0.05, dy = y - 0.15, r = Math.hypot(dx, dy) / 2.6, th = Math.atan2(-dy, dx);
      const tb = th + lv.twist * Math.min(r, 1.3) + w1 * 0.35 + w2 * 0.08, rb = Math.min(0.96, 0.1 + 0.86 * Math.min(1, r));
      nx = rb * Math.cos(tb); nz = rb * Math.sin(tb);
      const f = (Math.atan2(nz, nx) + Math.PI) / (2 * Math.PI) * N; bd = Math.abs(f - Math.round(f)) * (2 * Math.PI / N) * Math.max(0.35, rb);
    } else if (lv.fold === 'rings') {
      const dx = x - 0.05, dy = y - 0.1, r = Math.hypot(dx, dy) / 2.5 + w1 * 0.1 + w2 * 0.03, th = Math.atan2(-dy, dx);
      const rb = clamp(r, 0, 0.98); nx = rb * Math.cos(th); nz = rb * Math.sin(th);
      const f = rb * N, k = Math.round(f); bd = (k > 0 && k < N) ? Math.abs(f - k) / N : 1;
    } else {
      const t = (SY0 - y) / SSZ; nx = clamp(-0.97 + 1.94 * t + w1 * 0.08 + w2 * 0.025 + Math.sin(x * 1.6 + sd) * 0.03, -0.98, 0.98);
      nz = (x / 2.3) * Q * 0.85 * Math.sqrt(Math.max(0, 1 - nx * nx));
      const f = (nx + 1) / 2 * N, k = Math.round(f); bd = (k > 0 && k < N) ? Math.abs(f - k) * 2 / N : 1;
    }
    let [cr, cg, cb] = sample(nx, nz);
    const lw = 0.022 + 0.035 * vnoise(x * 3 - sd, y * 3), wt = (1 - smooth(lw * 0.25, lw, bd)) * 0.9;     // resist lines where the strings were
    const ck = vnoise(x * 11 + sd, y * 11), crack = ck > 0.84 ? (ck - 0.84) * 2.2 : 0;               // fine crackle
    const lit = 1 + (vnoise(x * 2.3, y * 2.3 + sd) - 0.5) * 0.16, wf = Math.min(1, wt + crack);
    const i = (py * S + px) * 4;
    d[i] = clamp((cr * lit) * (1 - wf) + 255 * wf, 0, 255); d[i + 1] = clamp((cg * lit) * (1 - wf) + 252 * wf, 0, 255); d[i + 2] = clamp((cb * lit) * (1 - wf) + 252 * wf, 0, 255); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); collar(ctx, S);
}
const targetSampler = (lv) => (nx, nz) => { const s = secOf(nx, nz); return s < 0 ? [250, 250, 252] : DRGB[lv.cols[s]]; };
function drawTarget() {
  const S = 168, tmp = document.createElement('canvas'); tmp.width = tmp.height = S;
  drawPattern(tmp.getContext('2d'), S, L, targetSampler(L));
  const x = $('tgtc').getContext('2d'); x.clearRect(0, 0, S, S);
  const toPx = (v, i) => i === 0 ? (v - SX0) / SSZ * S : (SY0 - v) / SSZ * S;
  x.save(); x.beginPath(); shirtPath(x, toPx); x.clip(); x.drawImage(tmp, 0, 0); x.restore();
  x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.12)'; x.beginPath(); shirtPath(x, toPx); x.stroke();
}

// ------------------------------------------------------------------ bundle (bound shirt) with a paintable top
const CS = 512, BC = document.createElement('canvas'); BC.width = BC.height = CS; const bctx = BC.getContext('2d');
const bTex = new THREE.CanvasTexture(BC); bTex.colorSpace = THREE.SRGBColorSpace;
const bundleMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.8 });
const stringMat = mat('#2a1d33', { roughness: 0.6 });
let bundle = null, strings = [], markers = [], flying = [];
const G = 60; let cellSec, cellCol, secCells, secDone;
function buildBundle() {
  if (bundle) { scene.remove(bundle); bundle.geometry.dispose(); }
  strings.forEach(s => { scene.remove(s); s.geometry.dispose(); }); strings = [];
  markers.forEach(m => scene.remove(m)); markers = [];
  EXT = L.fold === 'stripes' ? 1.95 : 1.55; Q = L.fold === 'stripes' ? 0.5 : 1;
  const geo = new THREE.SphereGeometry(1, 112, 56), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i), nx = sx, nz = sz * Q;
    const ang = Math.atan2(nz, nx), rr = Math.hypot(nx, nz), crumple = (vnoise(nx * 4 + 3, nz * 4) - 0.5) * 0.14 + (vnoise(nx * 9, nz * 9 + 7) - 0.5) * 0.06 + Math.sin(ang * 23 + rr * 9) * 0.018 * rr;
    const y = sy > 0 ? sy * BH + bump(nx, nz) * sy + crumple * Math.min(1, sy * 2.5) : sy * 0.08;
    const rim = 1 + (sy > -0.2 && sy < 0.4 ? Math.sin(ang * 11 + 1.3) * 0.025 + (vnoise(ang * 3, 1) - 0.5) * 0.06 : 0);
    p.setXYZ(i, nx * EXT * rim, y, nz * EXT * rim); uv.setXY(i, (nx + 1) / 2, 1 - (nz + 1) / 2);
  }
  geo.computeVertexNormals();
  bundle = new THREE.Mesh(geo, bundleMat); bundle.castShadow = true; bundle.receiveShadow = true; scene.add(bundle);
  // white fabric with folds
  bctx.drawImage(fabricCanvas(CS), 0, 0);
  bctx.strokeStyle = 'rgba(140,140,170,.18)'; bctx.lineWidth = 6;
  for (let k = 0; k < 26; k++) { const a = k / 26 * 6.283; bctx.beginPath(); bctx.moveTo(CS / 2, CS / 2); bctx.quadraticCurveTo(CS / 2 + Math.cos(a + 0.5) * 120, CS / 2 + Math.sin(a + 0.5) * 120, CS / 2 + Math.cos(a) * 256, CS / 2 + Math.sin(a) * 256); bctx.stroke(); }
  bTex.needsUpdate = true;
  // strings
  const P = (nx, nz, lift = 0.04) => new THREE.Vector3(nx * EXT, surfY(nx, nz) + lift, nz * EXT);
  const tube = (pts, closed = false) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 64, 0.045, 6, closed), stringMat); m.castShadow = true; scene.add(m); strings.push(m); m.scale.setScalar(0.001); };
  for (let k = (L.fold === 'spiral' ? 0 : 1); k < L.N; k++) {
    const pts = [];
    if (L.fold === 'spiral') { const a = -Math.PI + k * 2 * Math.PI / L.N; for (let i = 0; i <= 16; i++) { const r = i / 16 * 0.99; pts.push(P(r * Math.cos(a), r * Math.sin(a))); } pts.push(new THREE.Vector3(Math.cos(a) * EXT * 1.03, 0.03, Math.sin(a) * EXT * 1.03)); }
    else if (L.fold === 'rings') { const rr = k / L.N; for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; pts.push(P(rr * Math.cos(a), rr * Math.sin(a))); } }
    else { const nx = -1 + 2 * k / L.N, zm = Q * Math.sqrt(1 - nx * nx); pts.push(new THREE.Vector3(nx * EXT, 0.03, -zm * EXT * 1.04)); for (let i = 0; i <= 14; i++) { const nz = -zm * 0.99 + i / 14 * zm * 1.98; pts.push(P(nx, nz)); } pts.push(new THREE.Vector3(nx * EXT, 0.03, zm * EXT * 1.04)); }
    tube(pts, L.fold === 'rings');
  }
  // section dots that show which colour goes where
  for (let k = 0; k < L.N; k++) {
    let nx, nz;
    if (L.fold === 'spiral') { const a = -Math.PI + (k + 0.5) * 2 * Math.PI / L.N; nx = 0.58 * Math.cos(a); nz = 0.58 * Math.sin(a); }
    else if (L.fold === 'rings') { const a = Math.PI / 2 - 0.5 + k * 0.7, r = k === 0 ? 0 : (k + 0.5) / L.N; nx = r * Math.cos(a); nz = r * Math.sin(a); }
    else { nx = -1 + (2 * k + 1) / L.N; nz = 0; }
    const g = new THREE.Group(), c = DYES[L.cols[k]];
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), glossy(c)); dot.scale.y = 0.7;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 24), mat('#ffffff')); ring.rotation.x = -Math.PI / 2;
    g.add(dot, ring); g.position.copy(P(nx, nz, 0.12)); g.userData.y = g.position.y; g.scale.setScalar(0.001); scene.add(g); markers.push(g);
  }
  // coverage grid
  cellSec = new Int8Array(G * G); cellCol = new Int8Array(G * G).fill(-1); secCells = new Array(L.N).fill(0); secDone = new Array(L.N).fill(false);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const s = secOf(-1 + (i + 0.5) * 2 / G, -1 + (j + 0.5) * 2 / G); cellSec[j * G + i] = s; if (s >= 0) secCells[s]++; }
  bundle.visible = false;
}
function sectionPath(ctx, s) {
  const c = CS / 2; ctx.beginPath();
  if (L.fold === 'spiral') { const a0 = -Math.PI + s * 2 * Math.PI / L.N; ctx.moveTo(c, c); ctx.arc(c, c, c * 1.05, a0, a0 + 2 * Math.PI / L.N); ctx.closePath(); }
  else if (L.fold === 'rings') { const r0 = s / L.N * c, r1 = s === L.N - 1 ? c * 1.05 : (s + 1) / L.N * c; ctx.arc(c, c, r1, 0, 6.2832); if (r0 > 0) { ctx.moveTo(c + r0, c); ctx.arc(c, c, r0, 0, 6.2832, true); } }
  else { ctx.rect(s / L.N * CS, 0, CS / L.N, CS); }
}
function secFrac(s, col = L.cols[s]) { let n = 0; for (let i = 0; i < G * G; i++) if (cellSec[i] === s && cellCol[i] === col) n++; return n / Math.max(1, secCells[s]); }

// ------------------------------------------------------------------ painting
let sel = -1, dripT = 0, doneN = 0, autoRev = 0;
function dab(nx, nz) {
  if (sel < 0) return false;
  const s = secOf(nx, nz); if (s < 0) return false;
  if (L.guide && sel !== L.cols[s] && L.btns.includes(L.cols[s])) selectDye(L.cols[s]);   // levels 1-2: the bottle picks the dot's colour for you
  const R = L.brush * CS / 2, px = (nx + 1) / 2 * CS, py = (nz + 1) / 2 * CS, [r, g, b] = DRGB[sel];
  bctx.save(); sectionPath(bctx, s); bctx.clip();
  for (let i = 0; i < 4; i++) {
    const ox = (Math.random() - 0.5) * R * 0.7, oy = (Math.random() - 0.5) * R * 0.7, rr = R * (0.55 + Math.random() * 0.55);
    const gr = bctx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
    gr.addColorStop(0, `rgba(${r},${g},${b},.95)`); gr.addColorStop(0.65, `rgba(${r},${g},${b},.8)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    bctx.fillStyle = gr; bctx.beginPath(); bctx.arc(px + ox, py + oy, rr, 0, 7); bctx.fill();
  }
  bctx.restore(); bTex.needsUpdate = true;
  const rad = L.brush * 0.92;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const k = j * G + i; if (cellSec[k] !== s) continue;
    const cx = -1 + (i + 0.5) * 2 / G, cz = -1 + (j + 0.5) * 2 / G; if ((cx - nx) ** 2 + (cz - nz) ** 2 < rad * rad) cellCol[k] = sel;
  }
  // juice
  const wp = new THREE.Vector3(nx * EXT, surfY(nx, nz) + 0.05, nz * EXT);
  burst(scene, wp, DYES[sel], 2, { shape: 'sphere', speed: 0.035, up: 0.03, size: 0.5, gravity: 0.008, life: 0.5 });
  if (Math.random() < 0.18) { const a = Math.random() * 6.283, d = EXT * (1.15 + Math.random() * 0.5); tableSplat(Math.cos(a) * d, Math.sin(a) * d * (Q < 1 ? 0.7 : 1), DYES[sel], 0.22, 0.25 + Math.random() * 0.3); }
  if (++dripT % 2 === 0) tone(700 + Math.random() * 500, 0.045, 'sine', 0.06, 0.45);
  squeeze = 1;
  const f = secFrac(s);
  if (!secDone[s] && f >= 0.88) {
    secDone[s] = true; doneN++; markers[s].userData.gone = true;
    ui.pop(doneN === L.N ? 'ALL DYED!' : ['PERFECT!', 'NICE!', 'JUICY!', 'SO COOL!'][doneN % 4], '#fff', 38, 21);
    note(64 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, doneN - 1)], 0.3, 0.16); buzz(15);
    burst(scene, markers[s].position, [DYES[L.cols[s]], '#ffffff'], 12, { shape: 'sphere', speed: 0.07, up: 0.08, size: 0.7 });
  } else if (secDone[s] && f < 0.6) { secDone[s] = false; doneN--; markers[s].userData.gone = false; }
  ui.progress(0.12 + 0.75 * doneN / L.N);
  $('done').classList.toggle('go', doneN === L.N);
  if (L.guide && doneN === L.N && !autoRev) autoRev = setTimeout(() => { autoRev = 0; if (phase === 'dye' && doneN === L.N) reveal(); }, 550);
  return true;
}
function washBundle() {
  bctx.drawImage(fabricCanvas(CS), 0, 0); bTex.needsUpdate = true; cellCol.fill(-1); secDone.fill(false); doneN = 0;
  markers.forEach(m => m.userData.gone = false); ui.progress(0.12); $('done').classList.remove('go');
  tone(300, 0.25, 'sine', 0.1, 1.8); buzz(10);
}

// ------------------------------------------------------------------ UI rows
const ICONS = {
  spiral: '<path d="M27 27c0-3 4-3 4 0s-3 7-8 7-9-5-9-10 5-12 13-12 15 6 15 15-7 17-17 17" fill="none" stroke="#ff3d8b" stroke-width="4.5" stroke-linecap="round"/>',
  rings: '<g fill="none" stroke-width="4.5"><circle cx="27" cy="27" r="5" stroke="#ffb400"/><circle cx="27" cy="27" r="13" stroke="#10cf96"/><circle cx="27" cy="27" r="21" stroke="#2f2bff"/></g>',
  stripes: '<g stroke-width="7" stroke-linecap="round"><path d="M8 12h38" stroke="#ff3b30"/><path d="M8 27h38" stroke="#a321ff"/><path d="M8 42h38" stroke="#00aaff"/></g>',
};
$('folds').innerHTML = FOLDS.map(f => `<button class="fold" data-f="${f}"><svg viewBox="0 0 54 54">${ICONS[f]}</svg>${f.toUpperCase()}</button>`).join('');
$('folds').querySelectorAll('.fold').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); chooseFold(b.dataset.f, b); }));
$('reset').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase === 'dye') washBundle(); });
$('done').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase === 'dye') reveal(); });
function buildDyeRow() {
  $('dyes').innerHTML = L.btns.map(c => `<button class="dye" data-c="${c}" style="background:${DYES[c]}"></button>`).join('');
  $('dyes').querySelectorAll('.dye').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectDye(+b.dataset.c); }));
}
function selectDye(c) {
  sel = c; $('dyes').querySelectorAll('.dye').forEach(b => b.classList.toggle('on', +b.dataset.c === c));
  hand.userData.body.color.set(DYES[c]); hand.visible = true; hand.position.copy(slotBottles.find(b => b.userData.c === c)?.position || handPos);
  slotBottles.forEach(b => b.visible = b.userData.c !== c);
  sfx.pick(2); buzz(8);
}
const show = (id, on) => $(id).classList.toggle('off', !on);

// ------------------------------------------------------------------ flow
let state = 'ready', phase = 'fold', phT = 0, wrongFolds = 0, match = 0, revealed = false;
function buildLevel() {
  L = genLevel(level); revealed = false; wrongFolds = 0; doneN = 0; sel = -1; phase = 'fold'; phT = 0;
  ui.levels(level); ui.progress(0); drawTarget(); buildBundle(); buildDyeRow();
  shirt.material = shirtMat; shirt.visible = true; shirt.position.set(0, 0.02, 0.15); shirt.rotation.set(0, 0, 0); shirt.scale.setScalar(1);
  slotBottles.forEach(b => scene.remove(b)); slotBottles = [];
  L.btns.forEach((c, i) => {
    const b = makeBottle(DYES[c]), side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
    b.position.set(side * (2.15 - j * 0.55), 1.62, -3.45 + (j === 1 ? 0.3 : 0)); b.userData.c = c; scene.add(b); slotBottles.push(b);
  });
  hand.visible = false;
  spx.clearRect(0, 0, SPC.width, SPC.height);
  const r = rng(level * 31 + 5); for (let i = 0; i < 16; i++) tableSplat((r() - 0.5) * 4.4, TZ + (r() - 0.5) * 7.2, DYES[L.btns[Math.floor(r() * L.btns.length)]], 0.12, 0.2 + r() * 0.35);
  $('banner').classList.remove('on', 'bad');
  show('dyes', false); show('reset', false); show('done', false); show('ask', state === 'play'); show('folds', state === 'play');
  const shown = L.folds >= 3 ? FOLDS : L.folds === 1 ? [L.fold] : FOLDS.filter(f => f === L.fold || f === (L.fold === 'rings' ? 'spiral' : 'rings')).slice(0, 2);
  $('folds').querySelectorAll('.fold').forEach(b => { b.classList.remove('bad'); b.style.display = shown.includes(b.dataset.f) ? '' : 'none'; b.classList.toggle('go', L.folds === 1); });
  $('ask').textContent = L.folds === 1 ? 'Tap the fold!' : 'Pick the fold!';
}
function chooseFold(f, btn) {
  if (state !== 'play' || phase !== 'fold') return;
  if (f !== L.fold) {
    wrongFolds++; btn = btn || $('folds').querySelector(`[data-f="${f}"]`); btn.classList.remove('bad'); void btn.offsetWidth; btn.classList.add('bad');
    sfx.fail(); buzz([30, 30, 30]); ui.pop('WRONG FOLD!', '#ff3b30', 30, 24);
    $('tgt').classList.add('big'); setTimeout(() => $('tgt').classList.remove('big'), 350); return;
  }
  phase = 'folding'; phT = 0; show('folds', false); show('ask', false); sfx.tap(); buzz(12); tone(320, 0.5, 'sine', 0.08, 2.4);
  ui.progress(0.06);
}
function reveal() {
  if (phase !== 'dye') return;
  phase = 'reveal'; phT = 0; show('dyes', false); show('reset', false); show('done', false); hand.visible = false;
  slotBottles.forEach(b => b.visible = true);
  // score: per-section correct coverage
  let m = 0; for (let s = 0; s < L.N; s++) m += clamp(secFrac(s) / 0.85, 0, 1);
  match = clamp(m / L.N - wrongFolds * 0.08, 0, 1);
  // the unfolded pattern from what was painted
  const data = bctx.getImageData(0, 0, CS, CS).data;
  drawPattern(patC.getContext('2d'), 512, L, (nx, nz) => { const px = clamp(Math.round((nx + 1) / 2 * CS), 0, CS - 1), py = clamp(Math.round((nz + 1) / 2 * CS), 0, CS - 1), i = (py * CS + px) * 4; return [data[i], data[i + 1], data[i + 2]]; });
  patTex.needsUpdate = true;
  tone(200, 0.6, 'sine', 0.1, 3); buzz(20);
}
function finish() {
  const pct = Math.round(match * 100), ok = match >= L.thr;
  const stars = match >= 0.95 ? 3 : match >= 0.82 ? 2 : ok ? 1 : 0;
  $('stars').innerHTML = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
  $('pct').textContent = ok ? `${pct}% MATCH` : `${pct}% · NEED ${Math.round(L.thr * 100)}%`;
  $('banner').classList.toggle('bad', !ok); $('banner').classList.add('on');
  ui.progress(1); ui.flash(0.55);
  if (ok) {
    state = 'won'; F.level(true); WB.submit(1); score += pct; best = Math.max(best, score); ST.set('best', best);
    sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, 2.5, 0), 80); setTimeout(() => confetti(scene, new THREE.Vector3(0, 2.5, -1), 60), 250);
    ui.win(level, stars === 3 ? 'Flawless swirl!' : `${pct}% match`); ui.els.win.querySelector('.hint').textContent = `Level ${level + 1} ▶`;
    stage.renderer.domElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05) rotate(1deg)' }, { transform: 'scale(.98) rotate(-1deg)' }, { transform: 'scale(1)' }], { duration: 420 });
    setTimeout(() => confetti(scene, new THREE.Vector3(1.5, 2.5, 0.5), 60), 500);
  } else {
    state = 'lost'; F.level(false, Math.min(1, match / L.thr)); sfx.fail(); buzz([40, 30, 60]);
    ui.lose('SO CLOSE!', `${pct}% match · need ${Math.round(L.thr * 100)}%`);
  }
}
ui.onTap((which) => { WB.start();
  if (which === 'start') { state = 'play'; show('ask', true); show('folds', true); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else { state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ input: drag the bottle over the bundle
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7), tmpV = new THREE.Vector3();
let aim = null, pointerDown = false;
function aimAt(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  // aim a little above the finger so the bottle isn't hidden under it
  ndc.y += 0.07; ray.setFromCamera(ndc, camera);
  const hit = bundle && bundle.visible ? ray.intersectObject(bundle)[0] : null;
  if (hit) aim = { nx: hit.point.x / EXT, nz: hit.point.z / EXT, p: hit.point.clone() };
  else { ray.ray.intersectPlane(plane, tmpV); aim = { nx: 9, nz: 9, p: tmpV.clone() }; }
}
input({
  onDown: (e) => { if (e.target.closest && e.target.closest('button')) return; if (state !== 'play' || phase !== 'dye') return; if (sel < 0) selectDye(L.btns[0]); pointerDown = true; aimAt(e); if (aim && aim.nx < 5) { lastDab = frame; dab(aim.nx, aim.nz); } },   // a plain tap dyes too
  onMove: (dx, dy, e) => { if (pointerDown) aimAt(e); },
  onUp: () => { pointerDown = false; aim = null; },
});

// ------------------------------------------------------------------ loop
const camPos = new THREE.Vector3(0, 14.2, 8.6), camLook = new THREE.Vector3(0, 0, 0.75), camGoal = camPos.clone();
let frame = 0, lastDab = -9;
loop((dt, t) => {
  frame += dt; phT += dt / 60;
  // folding animation: shirt spins into a bound bundle
  if (phase === 'folding') {
    const k = clamp(phT / 1.1, 0, 1);
    shirt.rotation.y = k * k * 7; shirt.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.7, k))); shirt.position.y = 0.02 + Math.sin(k * Math.PI) * 0.6;
    bundle.visible = k > 0.3; const bk = clamp((k - 0.3) / 0.7, 0, 1);
    bundle.scale.set(Math.max(0.001, easeOutBack(bk)), Math.max(0.001, easeOutBack(bk) * (1 + Math.sin(bk * 12) * 0.12 * (1 - bk))), Math.max(0.001, easeOutBack(bk)));
    bundle.rotation.y = (1 - bk) * -4;
    strings.forEach((s, i) => { const sk = clamp((k - 0.62 - i * 0.05) / 0.2, 0, 1); if (sk > 0 && s.scale.x < 0.01) { tone(900 + i * 80, 0.04, 'square', 0.05, 0.6); } s.scale.setScalar(Math.max(0.001, easeOutBack(sk))); s.rotation.y = bundle.rotation.y; });
    if (phT > 1.45) {
      phase = 'dye'; shirt.visible = false; bundle.rotation.y = 0; strings.forEach(s => { s.rotation.y = 0; s.scale.setScalar(1); });
      show('dyes', true); show('reset', true); show('done', true); ui.progress(0.12); selectDye(L.btns.includes(L.cols[0]) ? L.cols[0] : L.btns[0]); sfx.coin();
    }
  }
  // markers pop in / out and bob
  markers.forEach((m, i) => {
    const want = phase === 'dye' && !m.userData.gone ? 1 : 0; m.scale.setScalar(Math.max(0.001, m.scale.x + (want - m.scale.x) * 0.2 * dt));
    m.position.y = m.userData.y + Math.sin(t * 4 + i) * 0.05; m.rotation.y += 0.02 * dt;
  });
  // painting
  if (phase === 'dye' && pointerDown && aim) {
    handGoal.copy(aim.p).add(new THREE.Vector3(0, 0.35, 0));
    if (aim.nx < 5 && frame - lastDab > 2.5) { lastDab = frame; dab(aim.nx, aim.nz); }
  } else if (phase === 'dye' && !botAim) handGoal.set(1.75, 1.4, 1.7);
  if (botAim) { handGoal.copy(botAim).add(new THREE.Vector3(0, 0.35, 0)); if (frame - botAimT > 14) botAim = null; }
  if (hand.visible) {
    hand.position.lerp(handGoal, 0.3 * dt);
    const painting = (pointerDown && aim && aim.nx < 5) || botAim; const tz = painting ? 2.25 : 0.5;
    hand.rotation.z += (tz - hand.rotation.z) * 0.2 * dt; hand.rotation.x = Math.sin(t * 3) * 0.05;
    squeeze = Math.max(0, squeeze - 0.08 * dt); hand.scale.set(1.15 + squeeze * 0.12, 1.15 - squeeze * 0.1, 1.15 + squeeze * 0.12);
  }
  // reveal: spin, strings snap, shirt unfolds
  if (phase === 'reveal') {
    const k = phT;
    if (k < 0.7) { bundle.rotation.y += (0.05 + k * 0.4) * dt; bundle.position.y = Math.sin(k / 0.7 * Math.PI / 2) * 0.7; const w = 1 + Math.sin(k * 30) * 0.05; bundle.scale.set(w, 2 - w, w); strings.forEach(s => { s.rotation.y = bundle.rotation.y; s.position.y = bundle.position.y; }); }
    if (k >= 0.7 && strings.length) {
      strings.forEach((s, i) => { flying.push({ m: s, v: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.15 + Math.random() * 0.1, (Math.random() - 0.5) * 0.25), life: 1 }); setTimeout(() => tone(1400 - i * 90, 0.05, 'square', 0.06, 0.4), i * 40); });
      strings = []; buzz([10, 20, 10]); burst(scene, new THREE.Vector3(0, 1, 0), ['#ffffff', ...L.cols.map(c => DYES[c])], 22, { shape: 'sphere', speed: 0.12, up: 0.1 });
      shirt.material = new THREE.MeshStandardMaterial({ map: patTex, roughness: 0.85 }); shirt.visible = true;
    }
    if (k >= 0.7) {
      const u = clamp((k - 0.7) / 0.9, 0, 1), e = easeOutBack(u);
      bundle.rotation.y += 0.3 * dt; bundle.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.35, u)));
      shirt.scale.setScalar(Math.max(0.001, 0.15 + 0.85 * e)); shirt.rotation.y = (1 - u) * (1 - u) * Math.PI * 3; shirt.position.y = 0.02 + (1 - u) * 0.8;
      if (u >= 1 && !revealed) { revealed = true; bundle.visible = false; finish(); }
    }
    camGoal.set(0, 13.0, 7.9);
  } else camGoal.copy(camPos);
  for (const f of flying) { f.v.y -= 0.01 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += 0.1 * dt; f.life -= 0.035 * dt; f.m.scale.multiplyScalar(0.97); }
  flying = flying.filter(f => f.life > 0 || (scene.remove(f.m), f.m.geometry.dispose(), false));
  if (phase === 'fold' || phase === 'dye') { if (bundle) { bundle.position.y = 0; } }
  if (phase === 'fold') shirt.position.y = 0.02;
  slotBottles.forEach((b, i) => { b.rotation.y = Math.sin(t * 1.5 + i) * 0.15; });
  camera.position.lerp(camGoal, 0.06 * dt); camera.lookAt(camLook);
});

// ------------------------------------------------------------------ test hooks
let botAim = null, botAimT = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'fold') { chooseFold(L.fold); return; }
    if (phase !== 'dye') return;
    const s = L.cols.findIndex((c, i) => secFrac(i) < 0.9);
    if (s < 0) { reveal(); return; }
    if (sel !== L.cols[s]) { if (!L.btns.includes(L.cols[s])) return reveal(); selectDye(L.cols[s]); return; }
    for (let n = 0; n < 2; n++) {
      const cand = []; for (let k = 0; k < G * G; k++) if (cellSec[k] === s && cellCol[k] !== L.cols[s]) cand.push(k);
      if (!cand.length) break;
      const k = cand[Math.floor(Math.random() * cand.length)], nx = -1 + ((k % G) + 0.5) * 2 / G, nz = -1 + (Math.floor(k / G) + 0.5) * 2 / G;
      dab(nx, nz); botAim = new THREE.Vector3(nx * EXT, surfY(nx, nz), nz * EXT); botAimT = frame;
    }
  },
};

buildLevel();
ui.start();

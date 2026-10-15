// Tip Top: Nail Salon Makeover — original nail-art game. Shape the acrylic, file to length, polish, stamp the art,
// then the reveal: the whole hand gets the look. Match the client's order card to clear the level.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';

const NAME = 'Tip Top: Nail Salon Makeover';
const $ = (id) => document.getElementById(id);
const ST = store('tiptop');
const F = flow('tiptop');
const B = worldBoard({ game: 'tip-top', label: 'Match points', limits: { maxRun: 100, maxPerSec: 25 }, mode: 'sum' });   // world board: each won client's match % adds up today
let level = ST.get('level', 1), best = ST.get('best', 0), score = ST.get('score', 0);
const ui = createUI({ title: 'TIP<br>TOP', hint: 'Shape · file · polish!', hand: '💅', score: false });
const D = daily('tiptop', ui, { name: NAME });
const stage = createStage({ fov: 38, shadowSize: 5 });
const { scene, camera } = stage;
stage.followLight(new THREE.Vector3(0, 0, 0));
stage.sun.intensity = 1.5;
document.body.style.background = 'radial-gradient(ellipse at 50% 30%, #ffc4dc 0%, #ff8fb8 55%, #c86bd8 100%)';

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ catalogue
const SHAPES = ['square', 'round', 'almond', 'stiletto'];
const POLISH = ['#ff2e7e', '#e3262f', '#7b4dff', '#13c4a3', '#2e7dff', '#ffb703', '#1d1b2f', '#ff9ec4', '#9be15d'];
const DECALS = ['heart', 'star', 'flower', 'moon', 'gem'];
const SKINS = ['#f6c8a8', '#e0a47c', '#c98a5e', '#8d5a3c', '#f9d9c4', '#b97a50'];
const CLIENTS = ['Mira', 'Juno', 'Tess', 'Kai', 'Odette', 'Remy', 'Zola', 'Pim', 'Bea', 'Lux'];
const LINES = { square: 'squared off', round: 'nice and round', almond: 'almond', stiletto: 'pointy stiletto' };

// ------------------------------------------------------------------ nail outline (W = 1; y runs from the cuticle to the tip)
const LMAX = 2.8125, NATURAL = 0.9, LONG = 2.6;
function hw(y, len, shape) {
  if (y > len) return 0;
  let w = 0.47 + 0.03 * Math.min(1, y / 0.35);
  if (shape === 'square') { const r = 0.13; if (y > len - r) w = w - r + Math.sqrt(Math.max(0, r * r - (y - (len - r)) ** 2)); }
  else if (shape === 'round') { const r = 0.5; if (y > len - r) w = Math.min(w, Math.sqrt(Math.max(0, r * r - (y - (len - r)) ** 2))); }
  else if (shape === 'almond') { const t0 = len * 0.42; if (y > t0) { const s = (y - t0) / (len - t0); w *= Math.pow(Math.max(0, Math.cos(s * Math.PI / 2)), 0.62); } }
  else { const t0 = len * 0.28; if (y > t0) { const s = (y - t0) / (len - t0); w *= Math.pow(1 - s, 0.95); } }
  return Math.max(0, w);
}
const insideNail = (x, y, len, shape) => y > 0.05 - 0.13 * (1 - (x / 0.48) ** 2) && y <= len && Math.abs(x) <= hw(y, len, shape);
function outline(target, len, shape, map = (x, y) => [x, y]) {
  const n = 30, y0 = 0.06, pts = [];
  for (let i = 0; i <= n; i++) { const y = y0 + (len - y0) * i / n; pts.push([hw(y, len, shape), y]); }
  const m = (x, y) => map(x, y);
  target.moveTo(...m(pts[0][0], pts[0][1]));
  for (const p of pts) target.lineTo(...m(p[0], p[1]));
  for (let i = pts.length - 1; i >= 0; i--) target.lineTo(...m(-pts[i][0], pts[i][1]));
  target.quadraticCurveTo(...m(0, -0.2), ...m(pts[0][0], pts[0][1]));
}
function nailGeo(len, shape) {
  const s = new THREE.Shape(); outline(s, len, shape);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2, curveSegments: 6 });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, clamp(x + 0.5, 0, 1), clamp(y / LMAX, 0, 1));
    p.setZ(i, p.getZ(i) - 0.5 * x * x - 0.03 * Math.max(0, y - 0.6) ** 2);
  }
  g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ paint canvas (u across, v along length, isotropic)
const CW = 256, CH = 720;
const paintC = document.createElement('canvas'); paintC.width = CW; paintC.height = CH; const px = paintC.getContext('2d');
const texC = document.createElement('canvas'); texC.width = CW; texC.height = CH; const tx = texC.getContext('2d');
const nailTex = new THREE.CanvasTexture(texC); nailTex.colorSpace = THREE.SRGBColorSpace;
const nailMat = new THREE.MeshPhysicalMaterial({ map: nailTex, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
const toC = (x, y) => [(x + 0.5) * CW, (1 - y / LMAX) * CH];
function baseNail(ctx) {
  ctx.fillStyle = '#fbeef0'; ctx.fillRect(0, 0, CW, CH);
  const [, yN] = toC(0, NATURAL - 0.1);
  const g = ctx.createLinearGradient(0, CH, 0, yN); g.addColorStop(0, '#f7c5c8'); g.addColorStop(1, '#f4b8be'); ctx.fillStyle = g; ctx.fillRect(0, yN, CW, CH - yN);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(CW / 2, CH, CW * 0.36, CW * 0.36, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillRect(0, 0, CW, yN - 4);
}
let decal = null;   // { kind, x, y }
function compose() {
  tx.drawImage(paintC, 0, 0);
  if (decal) { const [cx, cy] = toC(decal.x, decal.y); drawDecal(tx, decal.kind, cx, cy, CW * 0.36, L.decalCol); }
  nailTex.needsUpdate = true;
}
function drawDecal(c, kind, x, y, s, col) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = s * 0.05;
  c.beginPath();
  if (kind === 'heart') { c.moveTo(0, s * 0.35); c.bezierCurveTo(-s * 0.6, -s * 0.05, -s * 0.3, -s * 0.55, 0, -s * 0.2); c.bezierCurveTo(s * 0.3, -s * 0.55, s * 0.6, -s * 0.05, 0, s * 0.35); }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.2 : s * 0.48, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
  else if (kind === 'flower') { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; c.moveTo(Math.cos(a) * s * 0.24 + s * 0.17, Math.sin(a) * s * 0.24); c.arc(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24, s * 0.17, 0, 7); } }
  else if (kind === 'moon') { c.arc(0, 0, s * 0.4, 0.6, Math.PI * 2 - 0.6 + 0.0, false); c.arc(s * 0.2, -s * 0.05, s * 0.3, Math.PI * 2 - 0.9, 0.9, true); c.closePath(); }
  else { c.moveTo(0, -s * 0.42); c.lineTo(s * 0.32, -s * 0.12); c.lineTo(0, s * 0.42); c.lineTo(-s * 0.32, -s * 0.12); c.closePath(); }
  c.fill(); c.stroke();
  if (kind === 'flower') { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, s * 0.12, 0, 7); c.fill(); }
  if (kind === 'gem' || kind === 'star') { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-s * 0.07, -s * 0.14, s * 0.06, s * 0.1, 0.5, 0, 7); c.fill(); }
  c.restore();
}

// ------------------------------------------------------------------ the set: cushion, hand, props
const cushion = new THREE.Mesh(rounded(4.2, 0.5, 5.4, 0.24), mat('#ffb3cf', { roughness: 0.95 }));
cushion.position.set(0, -0.3, 0.6); cushion.receiveShadow = true; scene.add(cushion);
const towel = new THREE.Mesh(rounded(3.2, 0.06, 4.2, 0.03), mat('#fff0f6', { roughness: 0.95 }));
towel.position.set(0, -0.02, 0.5); towel.receiveShadow = true; scene.add(towel);
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -0.56; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
function propBottle(col, x, z, s = 1) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(rounded(0.42, 0.46, 0.42, 0.12), glossy(col, { transparent: true, opacity: 0.92 })); b.position.y = 0.23;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 14), glossy('#222233')); cap.position.y = 0.7;
  g.add(b, cap); g.traverse(o => o.castShadow = true); g.position.set(x, -0.05, z); g.scale.setScalar(s); scene.add(g); return g;
}
const props = [propBottle('#ff2e7e', -1.55, -1.7, 0.9), propBottle('#7b4dff', 1.6, -1.2, 0.8), propBottle('#13c4a3', 1.7, 1.9, 0.85)];

const skinMat = mat('#f6c8a8', { roughness: 0.55 });
const sleeveMat = mat('#7b5cff', { roughness: 0.8 });
const hand = new THREE.Group(); scene.add(hand);
const palm = new THREE.Mesh(rounded(1.7, 0.42, 1.5, 0.2), skinMat); palm.position.set(0.0, 0.2, 1.2); palm.castShadow = true; hand.add(palm);
const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.2, 6, 16), skinMat); arm.rotation.x = Math.PI / 2; arm.scale.y = 1; arm.scale.z = 0.6; arm.position.set(0.05, 0.22, 2.9); arm.castShadow = true; hand.add(arm);
const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.82, 1.6, 24), sleeveMat); sleeve.rotation.x = Math.PI / 2; sleeve.scale.z = 0.7; sleeve.position.set(0.05, 0.3, 3.9); sleeve.castShadow = true; hand.add(sleeve);
const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.08, 8, 28), mat('#ffffff')); cuff.position.set(0.05, 0.3, 3.1); cuff.scale.y = 0.7; hand.add(cuff);
// fingers: [x, baseZ, length, angleY, nail scale]; index 2 (middle) is the hero
const FING = [[-0.95, 1.35, 0.85, 0.75, 0.9], [-0.6, 0.55, 1.15, 0.08, 0.95], [-0.02, 0.5, 1.3, 0, 1], [0.55, 0.55, 1.18, -0.07, 0.95], [0.98, 0.72, 0.92, -0.2, 0.8]];
const fingers = [], nails = [];
let nailGeom = nailGeo(NATURAL, 'round');
FING.forEach(([x, z, len, ang, ns], i) => {
  const g = new THREE.Group(); g.position.set(x, 0.22, z); g.rotation.y = ang; hand.add(g);
  const r = i === 0 ? 0.21 : 0.19;
  const f = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), skinMat); f.rotation.x = Math.PI / 2; f.position.z = -len / 2; f.scale.x = 1.05; f.scale.z = 0.86; f.castShadow = true; f.receiveShadow = true; g.add(f);
  const knuckle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.012, 4, 16, Math.PI), mat('#000000', { transparent: true, opacity: 0.08 })); knuckle.position.set(0, 0.0, -len * 0.55); knuckle.rotation.set(0, 0, 0); g.add(knuckle);
  const tipZ = -len - r;
  const n = new THREE.Mesh(nailGeom, nailMat); n.castShadow = true;
  const holder = new THREE.Group(); holder.position.set(0, r * 0.86 + 0.03, tipZ + 0.44 * ns); holder.rotation.x = -0.05; holder.scale.setScalar(0.34 * ns); holder.add(n); g.add(holder);
  fingers.push(g); nails.push(holder); holder.userData.s = 0.34 * ns;
});
const hero = nails[2];

// tools
const fileTool = new THREE.Group();
{ const board = new THREE.Mesh(rounded(0.62, 0.03, 0.09, 0.012), mat('#8a6b9e', { roughness: 0.95 })); const edge = new THREE.Mesh(rounded(0.625, 0.01, 0.095, 0.004), mat('#ffffff')); edge.position.y = 0.022; board.castShadow = true; fileTool.add(board, edge); }
scene.add(fileTool); fileTool.visible = false;
const brush = new THREE.Group();
{ const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.62, 14), glossy('#222233')); handle.position.y = 0.43;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), mat('#999999')); stem.position.y = 0.08;
  const bristle = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 12), mat('#ff2e7e')); bristle.rotation.x = Math.PI; bristle.position.y = 0.04;
  brush.add(handle, stem, bristle); brush.userData.bristle = bristle; brush.traverse(o => o.castShadow = true); brush.scale.setScalar(0.6); }
scene.add(brush); brush.visible = false;
const lineMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
const lenLine = new THREE.Group();
for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), lineMat); d.position.x = -0.6 + i * 0.2; lenLine.add(d); }
hero.add(lenLine); lenLine.visible = false;

// ------------------------------------------------------------------ level
let L;
function genLevel(lv) {
  const r = rng((D.seed || 0) + lv * 7919 + 13), fk = F.k();
  const pick = (a) => a[Math.floor(r() * a.length)];
  const shape = lv === 1 ? 'round' : lv === 2 ? 'almond' : pick(SHAPES);
  const color = Math.floor(r() * POLISH.length);
  const dark = ['#1d1b2f', '#7b4dff', '#2e7dff', '#e3262f'].includes(POLISH[color]);
  const decalCol = dark ? (r() < 0.5 ? '#ffffff' : '#ffd23f') : (r() < 0.5 ? '#ffffff' : '#1d1b2f');
  const len = 1.35 + r() * 0.85;
  const nPol = Math.min(6, 3 + Math.floor(lv / 2)), opts = [color];
  while (opts.length < nPol) { const c = Math.floor(r() * POLISH.length); if (!opts.includes(c)) opts.push(c); }
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return {
    shape, color, decal: pick(DECALS), decalCol, len, decalY: len * (0.45 + r() * 0.15), opts,
    nDecals: Math.min(5, 3 + Math.floor(lv / 3)),
    thr: clamp((0.7 + (lv - 1) * 0.012) * fk, 0.6, 0.93), tol: clamp((0.34 - lv * 0.012) / fk, 0.12, 0.42),
    client: CLIENTS[Math.floor(r() * CLIENTS.length)], skin: SKINS[Math.floor(r() * SKINS.length)], sleeve: ['#7b5cff', '#3ab795', '#ff8c42', '#00a6fb', '#ff4d6d'][Math.floor(r() * 5)],
  };
}
function drawTarget() {
  const c = $('tgtc').getContext('2d'), W = 184, H = 248; c.clearRect(0, 0, W, H);
  const k = 64, ox = W / 2, oy = H - 54;
  const m = (x, y) => [ox + x * k, oy - y * k];
  c.fillStyle = L.skin; c.beginPath(); c.roundRect(ox - 44, oy - 40, 88, 120, 42); c.fill();
  c.save(); c.beginPath(); outline(c, L.len, L.shape, m); c.closePath(); c.fillStyle = POLISH[L.color]; c.fill();
  c.clip(); const g = c.createLinearGradient(ox - 30, 0, ox + 30, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,.35)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  drawDecal(c, L.decal, ...m(0, L.decalY), k * 0.36 * 1.0 * (CW / CW) * 1, L.decalCol);
  c.restore(); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.15)'; c.beginPath(); outline(c, L.len, L.shape, m); c.closePath(); c.stroke();
  $('tgtName').textContent = L.client.toUpperCase() + "'S ORDER";
}

// ------------------------------------------------------------------ UI rows
const SHAPE_ICON = (s) => { const c = document.createElement('canvas'); c.width = 80; c.height = 88; const x = c.getContext('2d'); const k = 26; x.fillStyle = '#ff7eb6'; x.beginPath(); outline(x, 2.4, s, (a, b) => [40 + a * k, 84 - b * k * 1.25]); x.closePath(); x.fill(); return c.toDataURL(); };
$('shapes').innerHTML = SHAPES.map(s => `<button class="opt" data-s="${s}"><svg viewBox="0 0 80 88"><image href="${SHAPE_ICON(s)}" width="80" height="88"/></svg>${s.toUpperCase()}</button>`).join('');
$('shapes').querySelectorAll('.opt').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); chooseShape(b.dataset.s); }));
const bottleSVG = (col) => `<svg viewBox="0 0 50 74"><rect x="19" y="2" width="12" height="26" rx="4" fill="#26243a"/><rect x="5" y="26" width="40" height="44" rx="12" fill="${col}" stroke="#fff" stroke-width="3"/><rect x="11" y="33" width="6" height="26" rx="3" fill="rgba(255,255,255,.55)"/></svg>`;
function buildRows() {
  $('polish').innerHTML = L.opts.map(c => `<button class="pol" data-c="${c}">${bottleSVG(POLISH[c])}</button>`).join('');
  $('polish').querySelectorAll('.pol').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectPolish(+b.dataset.c); }));
  const r = rng(level * 17 + 3), kinds = [L.decal]; while (kinds.length < L.nDecals) { const k = DECALS[Math.floor(r() * DECALS.length)]; if (!kinds.includes(k)) kinds.push(k); }
  kinds.sort(() => r() - 0.5);
  $('decals').innerHTML = kinds.map(k => { const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#ffe3ef'; x.beginPath(); x.arc(40, 40, 36, 0, 7); x.fill(); drawDecal(x, k, 40, 42, 76, L.decalCol === '#ffffff' ? '#ff5d8f' : L.decalCol); return `<button class="opt" data-k="${k}"><svg viewBox="0 0 80 80"><image href="${c.toDataURL()}" width="80" height="80"/></svg>${k.toUpperCase()}</button>`; }).join('');
  $('decals').querySelectorAll('.opt').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selDecal = b.dataset.k; $('decals').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === b)); sfx.pick(3); buzz(8); }));
}
const show = (id, on) => $(id).classList.toggle('off', !on);
$('done').addEventListener('pointerdown', (e) => { e.stopPropagation(); doneStep(); });

// ------------------------------------------------------------------ state
let state = 'ready', phase = 'shape', phT = 0, curLen = NATURAL, curShape = 'round', chosenShape = null, sel = -1, selDecal = null;
let parts = {}, match = 0, finished = false, beatenShown = false;
const GU = 16, GV = 58; let cellCol = new Int8Array(GU * GV);
function rebuildNail() { const g = nailGeo(curLen, curShape); for (const n of nails) n.children[0].geometry = g; nailGeom.dispose(); nailGeom = g; lenLine.position.set(0, 0.16, -L.len); }
function coverage(col = L.color) {
  let n = 0, t = 0;
  for (let j = 0; j < GV; j++) for (let i = 0; i < GU; i++) { const x = -0.5 + (i + 0.5) / GU, y = (j + 0.5) / GV * LMAX; if (!insideNail(x, y, curLen, curShape)) continue; t++; if (cellCol[j * GU + i] === col) n++; }
  return t ? n / t : 0;
}
function setStep(i, ask) { ui.progress(i / 4); $('ask').textContent = ask; show('ask', true); }
function buildLevel() {
  L = genLevel(level); phase = 'shape'; phT = 0; curLen = NATURAL; curShape = 'round'; chosenShape = null; sel = -1; selDecal = null; decal = null; parts = {}; finished = false;
  cellCol.fill(-1); baseNail(px); compose(); rebuildNail();
  skinMat.color.set(L.skin); sleeveMat.color.set(L.sleeve);
  nails.forEach((n, i) => { n.visible = i === 2; n.scale.setScalar(n.userData.s); });
  lenLine.visible = false; fileTool.visible = false; brush.visible = false;
  ui.levels(level); drawTarget(); buildRows();
  $('bub').textContent = `“${LINES[L.shape]}, please!”`;
  $('banner').classList.remove('on', 'bad');
  ['shapes', 'polish', 'decals', 'done', 'meter'].forEach(id => show(id, false));
  $('shapes').querySelectorAll('.opt').forEach(o => o.classList.remove('on'));
  if (state === 'play') beginShape(); else { show('ask', false); ui.progress(0); }
}
function beginShape() { setStep(0, 'Pick the nail shape'); show('shapes', true); }
function chooseShape(s) {
  if (state !== 'play' || phase !== 'shape') return;
  chosenShape = s; parts.shape = s === L.shape ? 1 : 0;
  $('shapes').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.s === s));
  phase = 'grow'; phT = 0; curShape = s; show('shapes', false); show('ask', false);
  tone(300, 0.6, 'sine', 0.08, 2.6); buzz(12);
  if (!parts.shape) { $('tgt').classList.add('big'); setTimeout(() => $('tgt').classList.remove('big'), 400); }
}
function beginFile() { phase = 'file'; setStep(1, 'Swipe to file down to the line'); lenLine.visible = true; fileTool.visible = true; show('done', true); show('meter', true); updMeter(); }
function updMeter() { const d = curLen - L.len; $('meter').textContent = d > 0.04 ? `▼ ${Math.round(d * 100)}` : d < -0.04 ? 'TOO SHORT' : 'PERFECT'; $('done').classList.toggle('go', Math.abs(d) < 0.05); }
let fileSnd = 0;
function shave(amount) {
  if (phase !== 'file') return;
  const before = curLen; curLen = Math.max(0.75, curLen - amount); if (curLen === before) return;
  rebuildNail(); updMeter();
  const tip = hero.localToWorld(V(0, 0.1, -curLen));
  burst(scene, tip, ['#ffffff', '#f4d9de', POLISH[L.color] && '#fbeff0'], 2, { speed: 0.02, up: 0.02, size: 0.22, gravity: 0.004, life: 0.6 });
  if ((fileSnd += amount) > 0.03) { fileSnd = 0; tone(1800 + Math.random() * 900, 0.03, 'sawtooth', 0.025, 0.7); }
  if (before > L.len + 0.03 && curLen <= L.len + 0.03 && curLen >= L.len - 0.05) { ui.pop('PERFECT LENGTH!', '#fff', 30, 30); note(76, 0.25); buzz(15); }
  if (before >= L.len - L.tol * 0.5 && curLen < L.len - L.tol * 0.5) { ui.pop('TOO SHORT!', '#ff3b30', 32, 30); sfx.fail(); buzz([30, 30]); }
}
function beginPaint() {
  phase = 'paint'; parts.len = clamp(1 - Math.abs(curLen - L.len) / L.tol, 0, 1);
  lenLine.visible = false; fileTool.visible = false; show('meter', false); show('done', true); $('done').classList.remove('go');
  setStep(2, 'Paint the polish on'); show('polish', true); selectPolish(L.opts[0]);
  const s = parts.len > 0.85 ? 'NICE FILE!' : parts.len > 0.4 ? 'OK!' : 'HMM...'; ui.pop(s, '#fff', 30, 30);
}
function selectPolish(c) { sel = c; $('polish').querySelectorAll('.pol').forEach(b => b.classList.toggle('on', +b.dataset.c === c)); brush.userData.bristle.material.color.set(POLISH[c]); brush.visible = true; sfx.pick(2); buzz(8); }
let dabN = 0, lastCov = 0, lastDab = null;
function dab(u, v) {
  if (phase !== 'paint' || sel < 0) return;
  const x = u - 0.5, y = v * LMAX, [cx, cy] = toC(x, y), R = 0.2 * CW;
  px.fillStyle = px.strokeStyle = POLISH[sel]; px.lineCap = 'round'; px.lineWidth = R * 2.1;
  let prevXY = null;
  if (lastDab && Math.hypot(lastDab[0] - cx, lastDab[1] - cy) < R * 4) { prevXY = [lastDab[0] / CW - 0.5, (1 - lastDab[1] / CH) * LMAX]; px.beginPath(); px.moveTo(lastDab[0], lastDab[1]); px.lineTo(cx, cy); px.stroke(); }
  else { px.beginPath(); px.ellipse(cx, cy, R * 1.05, R * 1.3, 0, 0, 7); px.fill(); }
  lastDab = [cx, cy];
  const g = px.createRadialGradient(cx - R * 0.3, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); px.fillStyle = g; px.beginPath(); px.arc(cx, cy, R, 0, 7); px.fill();
  const pts = [[x, y]]; if (prevXY) for (let k = 1; k < 6; k++) pts.push([prevXY[0] + (x - prevXY[0]) * k / 6, prevXY[1] + (y - prevXY[1]) * k / 6]);
  prevXY = [x, y];
  for (let j = 0; j < GV; j++) for (let i = 0; i < GU; i++) { const gx = -0.5 + (i + 0.5) / GU, gy = (j + 0.5) / GV * LMAX; for (const [qx, qy] of pts) if ((gx - qx) ** 2 + (gy - qy) ** 2 < 0.205 * 0.205) { cellCol[j * GU + i] = sel; break; } }
  compose();
  if (++dabN % 3 === 0) tone(500 + Math.random() * 200, 0.05, 'sine', 0.04, 0.8);
  const cov = coverage(sel);
  $('done').classList.toggle('go', coverage() > 0.95);
  if (lastCov < 0.95 && cov >= 0.95 && sel === L.color) { ui.pop('FULL COAT!', '#fff', 32, 30); note(79, 0.3); buzz(15); }
  lastCov = cov;
}
function beginDecal() {
  phase = 'decal'; parts.paint = clamp(coverage() / 0.94, 0, 1);
  show('polish', false); brush.visible = false; show('done', false);
  setStep(3, 'Pick the art, tap to stick it'); show('decals', true);
}
function stamp(u, v) {
  if (phase !== 'decal' || !selDecal) { if (phase === 'decal') ui.pop('Pick an art first!', '#fff', 26, 30); return; }
  decal = { kind: selDecal, x: clamp(u - 0.5, -0.3, 0.3), y: clamp(v * LMAX, 0.3, curLen - 0.25) }; compose();
  burst(scene, hero.localToWorld(V(decal.x, 0.15, -decal.y)), ['#ffffff', '#ffd23f', '#ff7eb6'], 10, { shape: 'sphere', speed: 0.03, up: 0.04, size: 0.3, gravity: 0.004, life: 0.7 });
  sfx.coin(); buzz(12); show('done', true); $('done').classList.add('go');
}
function doneStep() {
  if (state !== 'play') return;
  if (phase === 'file') beginPaint();
  else if (phase === 'paint') beginDecal();
  else if (phase === 'decal' && decal) startReveal();
}
function startReveal() {
  const dk = decal.kind === L.decal ? 0.65 : 0;
  parts.decal = dk + 0.35 * clamp(1 - Math.hypot(decal.x, decal.y - L.decalY) / 0.6, 0, 1) * (dk ? 1 : 0.4);
  phase = 'reveal'; phT = 0; show('decals', false); show('done', false); show('ask', false); ui.progress(1);
  nails.forEach((n, i) => { if (i !== 2) { n.visible = true; n.scale.setScalar(0.001); } });
  tone(260, 0.7, 'sine', 0.09, 2.5); buzz(15);
}
function finish() {
  if (finished) return; finished = true;
  match = 0.2 * parts.shape + 0.2 * parts.len + 0.35 * parts.paint + 0.25 * parts.decal;
  const pct = Math.round(match * 100), ok = match >= L.thr;
  const stars = match >= 0.95 ? 3 : match >= 0.85 ? 2 : ok ? 1 : 0;
  $('stars').innerHTML = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
  $('pct').textContent = ok ? `${pct}% MATCH` : `${pct}% · NEED ${Math.round(L.thr * 100)}%`;
  $('banner').classList.toggle('bad', !ok); $('banner').classList.add('on'); ui.flash(0.5);
  if (ok) {
    state = 'won'; F.level(true); score += pct; B.submit(pct); ST.set('score', score); best = Math.max(best, score); ST.set('best', best);
    $('bub').textContent = stars === 3 ? '“OBSESSED! 😍”' : '“Love them!”';
    sfx.win(); buzz([20, 40, 20]); confetti(scene, V(0, 1.5, 0), 80); setTimeout(() => confetti(scene, V(0, 1.5, -1), 60), 250);
    if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, V(0, 2, 0), 50); }, 300); }
    D.won(score); ui.win(level, stars === 3 ? `Flawless set! · ${score} pts` : `${pct}% match · ${score} pts`);
  } else {
    state = 'lost'; F.level(false, Math.min(1, match / L.thr)); sfx.fail(); buzz([40, 30, 60]);
    $('bub').textContent = '“Hmm… not what I asked.”';
    ui.lose('NOT QUITE!', `${pct}% match · need ${Math.round(L.thr * 100)}%`);
  }
}
ui.onTap((which) => {
  B.start();
  if (which === 'start') { state = 'play'; beginShape(); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else { state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = false, aim = null;
function hitNail(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(hero.children[0])[0];
  return h && h.uv ? { u: h.uv.x, v: h.uv.y, p: h.point } : null;
}
input({
  onDown: (e) => {
    if (e.target.closest && e.target.closest('button')) return; if (state !== 'play') return;
    down = true;
    if (phase === 'paint') { aim = hitNail(e); if (aim) dab(aim.u, aim.v); }
    if (phase === 'decal') { const h = hitNail(e); if (h) stamp(h.u, h.v); }
  },
  onMove: (dx, dy, e) => {
    if (!down || state !== 'play') return;
    if (phase === 'paint') { aim = hitNail(e); if (aim) dab(aim.u, aim.v); }
    if (phase === 'file') { shave(Math.abs(dx) * 0.0016 + Math.abs(dy) * 0.0004); fileX += dx * 0.004; }
  },
  onUp: () => { down = false; aim = null; lastDab = null; },
});

// ------------------------------------------------------------------ loop
let fileX = 0, botAim = null, botT = 0, frame = 0;
const camPos = V(0, 3, 3), camLook = V(0, 0, 0), cp = V(), cl = V();
loop((dt, t) => {
  frame += dt; phT += dt / 60;
  if (phase === 'grow') {
    const k = clamp(phT / 0.8, 0, 1); curLen = NATURAL + (LONG - NATURAL) * easeOutBack(k); rebuildNail();
    if (Math.random() < 0.5) burst(scene, hero.localToWorld(V((Math.random() - 0.5) * 0.6, 0.12, -curLen)), ['#ffffff', '#ffe3ef'], 1, { shape: 'sphere', speed: 0.02, up: 0.02, size: 0.35, life: 0.5 });
    if (k >= 1) { curLen = LONG; rebuildNail(); sfx.coin(); ui.pop(parts.shape ? 'GORGEOUS!' : 'HMM, WRONG SHAPE', parts.shape ? '#fff' : '#ffe066', 30, 30); beginFile(); }
  }
  // camera: close on the hero nail while working, pull back for the reveal
  const heroMid = hero.localToWorld(V(0, 0, -Math.max(curLen, 1.2) * 0.5));
  if (phase === 'reveal') { cp.set(0.0, 4.3, 2.4); cl.set(0.0, 0, -0.8); }
  else if (state === 'ready') { cp.set(0.05, 4.6, 3.4); cl.set(0.05, 0, 0); }
  else { cp.set(heroMid.x, heroMid.y + 2.05, heroMid.z + 1.25); cl.set(heroMid.x, heroMid.y, heroMid.z - 0.12); }
  camPos.lerp(cp, 0.07 * dt); camLook.lerp(cl, 0.08 * dt); camera.position.copy(camPos); camera.lookAt(camLook);
  // file tool hugs the tip
  if (fileTool.visible) {
    const tip = hero.localToWorld(V(0, 0.07, -curLen - 0.03));
    fileX *= 0.9; const wob = down ? Math.sin(t * 30) * 0.12 : 0;
    fileTool.position.set(tip.x + clamp(fileX, -0.3, 0.3) + wob, tip.y - 0.01, tip.z + 0.015); fileTool.rotation.set(0.35, 0.55 + (down ? Math.sin(t * 30) * 0.06 : 0), 0);
  }
  if (brush.visible) {
    let goal;
    if (aim) goal = aim.p.clone(); else if (botAim && frame - botT < 14) goal = botAim.clone(); else goal = hero.localToWorld(V(0.75, 0.6, -curLen * 0.4));
    brush.position.lerp(goal.add(V(0, 0.03, 0)), 0.35 * dt); brush.rotation.set(-0.45, 0, -0.35 + Math.sin(t * 8) * (aim ? 0.08 : 0.02));
  }
  // reveal: the other nails pop in one by one, then the verdict
  if (phase === 'reveal') {
    [1, 3, 0, 4].forEach((i, j) => {
      const k = clamp((phT - 0.45 - j * 0.16) / 0.3, 0, 1), n = nails[i];
      if (k > 0 && n.scale.x < 0.01) { note(72 + j * 3, 0.25, 0.14); burst(scene, n.localToWorld(V(0, 0.2, -1)), ['#ffffff', POLISH[L.color], '#ffd23f'], 10, { shape: 'sphere', speed: 0.05, up: 0.06, size: 0.4 }); }
      n.scale.setScalar(Math.max(0.001, n.userData.s * easeOutBack(k)));
    });
    if (phT > 1.6) finish();
  }
  props.forEach((p, i) => p.rotation.y = Math.sin(t * 0.8 + i) * 0.2);
});

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get phase() { return phase; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'shape') return chooseShape(L.shape);
    if (phase === 'file') { const d = curLen - L.len; if (d > 0.02) { shave(Math.min(0.12, d - 0.01)); fileX = Math.random() - 0.5; } else doneStep(); return; }
    if (phase === 'paint') {
      if (sel !== L.color) return selectPolish(L.color);
      if (coverage() > 0.97) return doneStep();
      for (let n = 0; n < 3; n++) {
        const cand = []; for (let j = 0; j < GV; j++) for (let i = 0; i < GU; i++) { const x = -0.5 + (i + 0.5) / GU, y = (j + 0.5) / GV * LMAX; if (insideNail(x, y, curLen, curShape) && cellCol[j * GU + i] !== L.color) cand.push([x, y]); }
        if (!cand.length) break; const [x, y] = cand[Math.floor(Math.random() * cand.length)];
        dab(x + 0.5, y / LMAX); botAim = hero.localToWorld(V(x, 0.12, -y)); botT = frame;
      }
      return;
    }
    if (phase === 'decal') { if (selDecal !== L.decal) { const b = $('decals').querySelector(`[data-k="${L.decal}"]`); b && b.dispatchEvent(new PointerEvent('pointerdown')); return; } if (!decal) return stamp(0.5, L.decalY / LMAX); doneStep(); }
  },
};

buildLevel();
ui.start();

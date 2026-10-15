// Snip Studio: Hair Salon Makeover — original hair-salon game. Rub to lather, swipe the scissors along the cut line,
// spray the dye, pick the style — then the client turns to the mirror. Match the reference look to clear the level.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Snip Studio: Hair Salon Makeover';
const $ = (id) => document.getElementById(id);
const ST = store('snipstudio');
const F = flow('snipstudio');
let level = ST.get('level', 1), best = ST.get('best', 0), score = ST.get('score', 0);
const ui = createUI({ title: 'SNIP<br>STUDIO', hint: 'Wash · cut · dye · style!', hand: '✂️', score: false });
const D = daily('snipstudio', ui, { name: NAME });
const stage = createStage({ fov: 34, shadowSize: 5 });
const { scene, camera } = stage;
stage.followLight(new THREE.Vector3(0, 2, 0));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
document.body.style.background = 'radial-gradient(ellipse at 50% 38%, #fff4fb 0%, #ffd6ec 30%, #b9a7ff 80%, #9a86f0 100%)';

// ------------------------------------------------------------------ catalogue
const NATURAL = ['#3b2416', '#1f1b24', '#e3b867', '#b5562b', '#6e4326'];
const DYES = ['#ff4fa3', '#7b5cff', '#2ec4ff', '#21d19f', '#ff7a1a', '#dfe3f2', '#ff3b4f', '#ffd23f'];
const DYE_NAMES = ['bubblegum', 'violet', 'sky', 'mint', 'tangerine', 'silver', 'cherry', 'gold'];
const SKINS = ['#f6c8a8', '#e0a47c', '#c98a5e', '#8d5a3c', '#f9d9c4', '#b97a50'];
const CAPES = ['#7b5cff', '#00b3a4', '#ff5d8f', '#2e7dff', '#ff8c42'];
const STYLES = ['straight', 'wavy', 'curly'];
const LINES = ['Just a trim. (Famous last words.)', 'Make me look like I have my life together', 'Something my ex will hate', 'Job interview tomorrow!!',
  'My mum cut it last time…', 'Main character energy, please', 'Wedding guest, NOT the bride', 'Band photo on Friday', 'Surprise me. No wait, don\'t.', 'Same as the picture, exactly'];

// ------------------------------------------------------------------ client (original character) + chair
const client = new THREE.Group(); scene.add(client);
const skinMat = mat('#f6c8a8', { roughness: 0.55 });
const capeMat = mat('#7b5cff', { roughness: 0.7 });
const chair = new THREE.Mesh(rounded(3.6, 3.0, 0.5, 0.4), glossy('#ff6fb1', { roughness: 0.35 })); chair.position.set(0, 0.9, -1.0); chair.castShadow = true; chair.receiveShadow = true; scene.add(chair);
const chairTop = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.22, 10, 32, Math.PI), glossy('#ff6fb1', { roughness: 0.35 })); chairTop.position.set(0, 2.35, -1.0); chairTop.scale.set(1.2, 0.5, 1); scene.add(chairTop);
const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 2.3, 2.3, 40, 1, true), capeMat); cape.position.set(0, 0.55, 0); cape.scale.z = 0.62; cape.castShadow = true; client.add(cape);
const capeTop = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.09, 8, 28), mat('#ffffff')); capeTop.rotation.x = Math.PI / 2; capeTop.position.y = 1.68; capeTop.scale.y = 0.62; client.add(capeTop);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.7, 20), skinMat); neck.position.y = 1.85; client.add(neck);
const head = new THREE.Group(); head.position.set(0, 2.75, 0); client.add(head);
const HR = 1.0;
const skull = new THREE.Mesh(new THREE.SphereGeometry(HR, 40, 28), skinMat); skull.scale.set(0.96, 1.04, 0.98); skull.castShadow = true; head.add(skull);
for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), skinMat); ear.position.set(s * 0.95, -0.08, 0); ear.scale.set(0.6, 1, 0.8); head.add(ear); }
const eyeW = mat('#ffffff', { roughness: 0.2 }), pupilM = glossy('#1d1b2f', { roughness: 0.1 });
const eyes = [], pupils = [];
for (const s of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), eyeW); e.position.set(s * 0.34, 0.06, 0.82); e.scale.z = 0.6; head.add(e); eyes.push(e);
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), pupilM); p.position.set(s * 0.34, 0.05, 0.93); p.scale.z = 0.5; head.add(p); pupils.push(p);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 })); hl.position.set(0.04, 0.04, 0.06); p.add(hl);
  const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshBasicMaterial({ color: '#ff7aa8', transparent: true, opacity: 0.35 })); cheek.position.set(s * 0.52, -0.24, 0.84); cheek.rotation.y = s * 0.55; head.add(cheek);
}
const browM = mat('#3b2416');
const brows = [-1, 1].map(s => { const b = new THREE.Mesh(rounded(0.32, 0.07, 0.06, 0.03), browM); b.position.set(s * 0.34, 0.33, 0.86); b.rotation.z = s * -0.1; head.add(b); return b; });
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), skinMat); nose.position.set(0, -0.12, 0.98); head.add(nose);
const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20, Math.PI), mat('#8a2f3c')); smile.position.set(0, -0.36, 0.88); smile.rotation.z = Math.PI; head.add(smile);
const ohMouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), mat('#8a2f3c')); ohMouth.position.set(0, -0.4, 0.9); ohMouth.scale.set(1, 1.3, 0.4); ohMouth.visible = false; head.add(ohMouth);
const hairMatCap = mat('#3b2416', { roughness: 0.55 });
const cap = new THREE.Mesh(new THREE.SphereGeometry(1.06, 36, 20, 0, Math.PI * 2, 0, 1.25), hairMatCap); cap.rotation.x = -0.42; cap.scale.set(0.98, 1.04, 1.0); cap.castShadow = true; head.add(cap);
const fringe = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.17, 10, 24, Math.PI), hairMatCap); fringe.position.set(0, 0.56, 0.5); fringe.rotation.set(-0.95, 0, 0); fringe.scale.set(1.06, 1, 1); head.add(fringe);

// ------------------------------------------------------------------ hair strands (verlet, follow-the-leader)
const S = 11, SEG = 0.27, FL = S * SEG;
const strands = [];
for (const [el, a0, a1, n] of [[0.12, 62, 298, 26], [0.42, 70, 290, 24], [0.75, 80, 280, 18]]) {
  for (let i = 0; i < n; i++) {
    const az = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180;
    const local = V(Math.sin(az) * Math.cos(el) * 1.02, Math.sin(el) * 1.04, Math.cos(az) * Math.cos(el) * 1.02);
    strands.push({ local, az, P: new Float32Array((S + 1) * 3), Q: new Float32Array((S + 1) * 3), len: FL, tlen: FL, foam: 0, shade: 0.88 + Math.random() * 0.2, ph: Math.random() * 6.28 });
  }
}
const NS = strands.length;
const segGeo = new THREE.CylinderGeometry(1, 0.9, 1, 7, 1); segGeo.translate(0, 0.5, 0);
const hairMesh = new THREE.InstancedMesh(segGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 }), NS * S);
hairMesh.castShadow = true; hairMesh.frustumCulled = false; hairMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(hairMesh);
const segCol = new Int8Array(NS * S).fill(-1);
const tmpQ = new THREE.Quaternion(), UP = V(0, 1, 0), dummy = new THREE.Object3D(), col = new THREE.Color(), va = V(), vb = V(), vd = V();
const HEADC = V(), ROOT = V();
function rootWorld(s, out) { return head.localToWorld(out.copy(s.local)); }
function resetStrands() {
  head.updateMatrixWorld(true);
  for (const s of strands) {
    rootWorld(s, ROOT); const out = V(s.local.x, 0, s.local.z).normalize();
    for (let j = 0; j <= S; j++) { const x = ROOT.x + out.x * j * 0.06, y = ROOT.y - j * SEG, z = ROOT.z + out.z * j * 0.06; s.P.set([x, y, z], j * 3); s.Q.set([x, y, z], j * 3); }
    s.len = FL; s.foam = 0;
  }
  for (let k = 0; k < 160; k++) stepHair(1, true);
}
function collide(x, y, z, out) {
  // head sphere
  let dx = x - HEADC.x, dy = y - HEADC.y, dz = z - HEADC.z, d = Math.hypot(dx, dy, dz), r = 1.1;
  if (d < r) { const k = r / d; x = HEADC.x + dx * k; y = HEADC.y + dy * k; z = HEADC.z + dz * k; }
  // shoulders + cape (elliptic cone)
  if (y < 1.75) {
    const rc = 0.6 + (1.75 - y) * 0.95, zz = z / 0.62, h = Math.hypot(x, zz);
    if (h < rc) { const k = rc / Math.max(h, 1e-4); x *= k; z = zz * k * 0.62; }
  }
  out[0] = x; out[1] = y; out[2] = z;
}
const cbuf = [0, 0, 0];
let wind = 0;
function stepHair(dt, settle = false) {
  head.updateMatrixWorld(true); head.getWorldPosition(HEADC);
  const g = 0.0042 * dt * dt;
  for (const s of strands) {
    const P = s.P, Q = s.Q;
    rootWorld(s, ROOT); P[0] = ROOT.x; P[1] = ROOT.y; P[2] = ROOT.z;
    for (let j = 1; j <= S; j++) {
      const i = j * 3, vx = (P[i] - Q[i]) * 0.93, vy = (P[i + 1] - Q[i + 1]) * 0.93, vz = (P[i + 2] - Q[i + 2]) * 0.93;
      Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
      const out = Math.sign(s.local.x) * 0.0006;
      P[i] += vx + (settle ? out : out + wind * 0.0012 * Math.sin(s.ph + j * 0.3)); P[i + 1] += vy - g; P[i + 2] += vz + (settle ? 0.0003 : 0.0003);
    }
    for (let j = 1; j <= S; j++) {
      const i = j * 3, p = i - 3;
      let dx = P[i] - P[p], dy = P[i + 1] - P[p + 1], dz = P[i + 2] - P[p + 2], d = Math.hypot(dx, dy, dz) || 1;
      const k = SEG / d; collide(P[p] + dx * k, P[p + 1] + dy * k, P[p + 2] + dz * k, cbuf);
      P[i] = cbuf[0]; P[i + 1] = cbuf[1]; P[i + 2] = cbuf[2];
    }
    if (settle) for (let j = 0; j <= S; j++) { Q[j * 3] = P[j * 3]; Q[j * 3 + 1] = P[j * 3 + 1]; Q[j * 3 + 2] = P[j * 3 + 2]; }
  }
}
// render positions with the style offset (wavy / curly)
let styleNow = 'straight', styleK = 0;
function dispPoint(s, j, out) {
  const P = s.P; out.set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
  if (styleNow !== 'straight' && styleK > 0 && j > 0) {
    const t = j / S, side = V(Math.cos(s.az), 0, -Math.sin(s.az)), outw = V(Math.sin(s.az), 0, Math.cos(s.az));
    if (styleNow === 'wavy') out.addScaledVector(side, Math.sin(j * 1.35 + s.ph) * 0.12 * Math.min(1, t * 3) * styleK);
    else { const a = j * 2.3 + s.ph, amp = 0.16 * Math.min(1, t * 4) * styleK; out.addScaledVector(side, Math.cos(a) * amp).addScaledVector(outw, Math.sin(a) * amp + amp * 0.6); out.y += styleK * 0.06 * j; }
  }
  return out;
}
function segColor(k, s, j) {
  const c = segCol[k] >= 0 ? DYES[segCol[k]] : L.natural; col.set(c);
  const shade = s.shade * (0.82 + 0.18 * Math.min(1, j / 3)); col.multiplyScalar(shade);
  if (s.foam > 0) col.lerp(new THREE.Color('#ffffff'), s.foam * 0.55);
  return col;
}
function renderHair() {
  for (let n = 0; n < NS; n++) {
    const s = strands[n];
    for (let j = 0; j < S; j++) {
      const k = n * S + j, vis = clamp(s.len - j * SEG, 0, SEG);
      if (vis <= 0.001) { dummy.scale.setScalar(0.0001); dummy.position.set(0, -50, 0); dummy.updateMatrix(); hairMesh.setMatrixAt(k, dummy.matrix); continue; }
      dispPoint(s, j, va); dispPoint(s, j + 1, vb); vd.subVectors(vb, va); const d = vd.length() || 1e-4; vd.divideScalar(d);
      tmpQ.setFromUnitVectors(UP, vd);
      const r = 0.115 * (1 - 0.5 * j / S) * (vis < SEG ? 0.8 : 1);
      dummy.position.copy(va); dummy.quaternion.copy(tmpQ); dummy.scale.set(r, d * (vis / SEG) * 1.12, r * 0.85); dummy.updateMatrix(); hairMesh.setMatrixAt(k, dummy.matrix);
      hairMesh.setColorAt(k, segColor(k, s, j));
    }
  }
  hairMesh.instanceMatrix.needsUpdate = true; hairMesh.instanceColor.needsUpdate = true;
}

// ------------------------------------------------------------------ props: cut-line guide, scissors, spray, iron, foam, clumps
const guide = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), 40);
guide.frustumCulled = false; scene.add(guide); guide.visible = false;
const scissors = new THREE.Group();
{ const bladeM = glossy('#dfe3ee', { metalness: 0.7, roughness: 0.18 }), ringM = glossy('#ff5d8f');
  for (const s of [-1, 1]) { const g = new THREE.Group(); const blade = new THREE.Mesh(rounded(0.09, 0.62, 0.03, 0.03), bladeM); blade.position.y = 0.31;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 18), ringM); ring.position.y = -0.13; g.add(blade, ring); g.userData.s = s; scissors.add(g); }
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glossy('#ffd23f')); scissors.add(pin); scissors.traverse(o => o.castShadow = true); }
scene.add(scissors); scissors.visible = false;
const sprayer = new THREE.Group();
{ const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.62, 18), glossy('#ff4fa3')); body.position.y = -0.3;
  const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 14), glossy('#ffffff')); capM.position.y = 0.08;
  const noz = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.16), glossy('#333344')); noz.position.set(0, 0.14, -0.08);
  sprayer.add(body, capM, noz); sprayer.userData.body = body; sprayer.traverse(o => o.castShadow = true); }
scene.add(sprayer); sprayer.visible = false;
const foamMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 12, 9), mat('#ffffff', { roughness: 0.25, emissive: '#e8f3ff', emissiveIntensity: 0.2 }), 260);
foamMesh.count = 0; foamMesh.frustumCulled = false; scene.add(foamMesh);
const foam = [];
const clumpMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.07, 0.34, 3, 6), mat('#ffffff', { roughness: 0.5 }), 80);
clumpMesh.count = 0; clumpMesh.frustumCulled = false; scene.add(clumpMesh);
const clumps = [];

// ------------------------------------------------------------------ level
let L;
function genLevel(lv) {
  const r = rng((D.seed || 0) + lv * 7919 + 77), fk = F.k();
  const Y = 1.55 + r() * 0.5, slope = lv <= 2 ? 0 : (r() < 0.5 ? 0 : (r() - 0.5) * 0.5);
  const dye = Math.floor(r() * DYES.length), mode = lv === 1 ? 'all' : (r() < 0.5 ? 'all' : 'tips');
  const nD = Math.min(6, 3 + Math.floor(lv / 2)), opts = [dye]; while (opts.length < nD) { const c = Math.floor(r() * DYES.length); if (!opts.includes(c)) opts.push(c); }
  opts.sort(() => r() - 0.5);
  return { Y, slope, dye, mode, opts, style: lv === 1 ? 'wavy' : STYLES[Math.floor(r() * 3)], natural: NATURAL[Math.floor(r() * NATURAL.length)],
    skin: SKINS[Math.floor(r() * SKINS.length)], cape: CAPES[Math.floor(r() * CAPES.length)], line: LINES[Math.floor(r() * LINES.length)],
    tol: clamp((0.5 - lv * 0.015) / fk, 0.22, 0.6), thr: clamp((0.68 + (lv - 1) * 0.012) * fk, 0.58, 0.92) };
}
const cutY = (x) => L.Y + L.slope * x;
function computeTargets() {
  for (const s of strands) {
    s.tlen = FL;
    for (let j = 1; j <= S; j++) { const y0 = s.P[j * 3 - 2], y1 = s.P[j * 3 + 1], x = s.P[j * 3], yt = cutY(x); if (y1 < yt) { const f = clamp((y0 - yt) / Math.max(1e-4, y0 - y1), 0, 1); s.tlen = (j - 1 + f) * SEG; break; } }
  }
}
function drawTarget() {
  const c = $('tgtc').getContext('2d'), W = 184, H = 248; c.clearRect(0, 0, W, H);
  const cx = W / 2, cy = 100, R = 46;
  const k = 46 / 1.0, yOf = (y) => cy - (y - 2.75) * k;
  // hair silhouette behind the head
  const nat = L.natural, dye = DYES[L.dye];
  const hairPath = () => { c.beginPath(); c.moveTo(cx - R * 1.05, cy); for (let i = 0; i <= 20; i++) { const x = -1.35 + 2.7 * i / 20; c.lineTo(cx + x * k * 0.98, yOf(cutY(x)) + (L.style === 'curly' ? -6 : 0) + (L.style !== 'straight' ? Math.sin(i * 1.7) * 4 : 0)); } c.lineTo(cx + R * 1.05, cy); c.arc(cx, cy - 4, R * 1.12, 0, Math.PI, true); c.closePath(); };
  c.save(); hairPath(); c.clip();
  const g = c.createLinearGradient(0, cy - R, 0, yOf(cutY(0)));
  if (L.mode === 'all') { g.addColorStop(0, dye); g.addColorStop(1, dye); } else { g.addColorStop(0, nat); g.addColorStop(0.45, nat); g.addColorStop(0.7, dye); g.addColorStop(1, dye); }
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const x = cx - R * 1.3 + i * R * 0.2; c.beginPath(); c.moveTo(x, cy - R); for (let y = cy - R; y < H; y += 6) c.lineTo(x + (L.style === 'straight' ? 0 : Math.sin(y * (L.style === 'curly' ? 0.35 : 0.12)) * (L.style === 'curly' ? 5 : 4)), y); c.stroke(); }
  c.restore();
  c.fillStyle = L.cape; c.beginPath(); c.moveTo(cx - 70, H); c.quadraticCurveTo(cx - 60, cy + 66, cx, cy + 58); c.quadraticCurveTo(cx + 60, cy + 66, cx + 70, H); c.fill();
  c.fillStyle = L.skin; c.beginPath(); c.arc(cx, cy, R * 0.97, 0, 7); c.fill();
  c.fillStyle = L.mode === 'all' ? dye : nat; c.beginPath(); c.ellipse(cx, cy - R * 0.55, R * 0.98, R * 0.5, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#1d1b2f'; for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * 16, cy + 2, 4.5, 0, 7); c.fill(); }
  c.strokeStyle = '#8a2f3c'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy + 14, 9, 0.2, Math.PI - 0.2); c.stroke();
  $('tgtName').textContent = 'THE LOOK';
}

// ------------------------------------------------------------------ UI rows
const show = (id, on) => $(id).classList.toggle('off', !on);
const bottleSVG = (cc) => `<svg viewBox="0 0 50 74"><rect x="16" y="2" width="18" height="14" rx="3" fill="#2a2840"/><rect x="21" y="0" width="16" height="6" rx="2" fill="#2a2840"/><rect x="7" y="15" width="36" height="56" rx="12" fill="${cc}" stroke="#fff" stroke-width="3"/><rect x="13" y="22" width="6" height="34" rx="3" fill="rgba(255,255,255,.5)"/></svg>`;
function styleIcon(st) { const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d'); x.strokeStyle = '#7b5cff'; x.lineWidth = 6; x.lineCap = 'round';
  for (let i = 0; i < 3; i++) { x.beginPath(); for (let y = 12; y < 72; y += 2) { const xx = 22 + i * 18 + (st === 'straight' ? 0 : st === 'wavy' ? Math.sin(y * 0.16) * 5 : Math.sin(y * 0.45) * 7); y === 12 ? x.moveTo(xx, y) : x.lineTo(xx, y); } x.stroke(); }
  return c.toDataURL(); }
$('styles').innerHTML = STYLES.map(st => `<button class="opt" data-s="${st}"><svg viewBox="0 0 80 80"><image href="${styleIcon(st)}" width="80" height="80"/></svg>${st.toUpperCase()}</button>`).join('');
$('styles').querySelectorAll('.opt').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); chooseStyle(b.dataset.s); }));
function buildRows() {
  $('dyes').innerHTML = L.opts.map(c => `<button class="dye" data-c="${c}">${bottleSVG(DYES[c])}</button>`).join('');
  $('dyes').querySelectorAll('.dye').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectDye(+b.dataset.c); }));
}
$('done').addEventListener('pointerdown', (e) => { e.stopPropagation(); doneStep(); });

// ------------------------------------------------------------------ state
let state = 'ready', phase = 'wash', phT = 0, sel = -1, parts = {}, finished = false, beatenShown = false, mood = 0, moodT = 0;
function setAsk(t) { $('ask').textContent = t; show('ask', true); }
function buildLevel() {
  L = genLevel(level); phase = 'wash'; phT = 0; sel = -1; parts = {}; finished = false; styleNow = 'straight'; styleK = 0; mood = 0;
  skinMat.color.set(L.skin); capeMat.color.set(L.cape); hairMatCap.color.set(L.natural); browM.color.set(L.natural);
  segCol.fill(-1); foam.length = 0; foamMesh.count = 0; clumps.length = 0; clumpMesh.count = 0;
  client.rotation.y = 0; resetStrands(); computeTargets();
  ui.levels(level); ui.progress(0); drawTarget(); buildRows(); placeGuide();
  $('bub').textContent = `“${L.line}”`;
  $('banner').classList.remove('on', 'bad');
  ['dyes', 'styles', 'done'].forEach(id => show(id, false));
  $('styles').querySelectorAll('.opt').forEach(o => o.classList.remove('on'));
  scissors.visible = sprayer.visible = guide.visible = false;
  if (state === 'play') beginWash(); else show('ask', false);
}
function placeGuide() {
  let n = 0; for (let i = 0; i < 40; i++) { const x = -2.5 + i * 5 / 39; if (Math.abs(x) < 0.95) continue; dummy.position.set(x, cutY(x), 1.0); dummy.rotation.set(0, 0, Math.atan(L.slope)); dummy.scale.setScalar(1); dummy.updateMatrix(); guide.setMatrixAt(n++, dummy.matrix); }
  guide.count = n; guide.instanceMatrix.needsUpdate = true;
}
function beginWash() { phase = 'wash'; setAsk('Rub the hair to lather'); }
const washFrac = () => strands.reduce((a, s) => a + Math.min(1, s.foam), 0) / NS;
const scr = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
function lather(x, y) {
  if (phase !== 'wash') return;
  let any = false;
  for (const s of strands) for (let j = 1; j <= S; j += 2) {
    if (j * SEG > s.len) break;
    dispPoint(s, j, va); const [sx, sy] = scr(va);
    if ((sx - x) ** 2 + (sy - y) ** 2 < 70 * 70) {
      if (s.foam < 1) { s.foam = Math.min(1, s.foam + 0.35); any = true; }
      if (foam.length < 260 && Math.random() < 0.5) foam.push({ s, j, o: V((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, 0.12), sz: 0.6 + Math.random() * 1.1, k: 0 });
    }
  }
  if (any && Math.random() < 0.5) tone(900 + Math.random() * 600, 0.04, 'sine', 0.05, 1.6);
  const f = washFrac(); ui.progress(f * 0.2);
  if (f >= 0.92) rinse();
}
function rinse() {
  phase = 'rinse'; phT = 0; show('ask', false); ui.pop('SQUEAKY CLEAN!', '#fff', 32, 30); note(76, 0.3); buzz(15);
  for (let i = 0; i < 6; i++) setTimeout(() => burst(scene, V((Math.random() - 0.5) * 2.4, 4.0, 0.6), ['#bfe9ff', '#ffffff', '#7fd3ff'], 8, { shape: 'sphere', speed: 0.04, up: -0.02, size: 0.5, gravity: 0.01 }), i * 90);
  tone(400, 0.6, 'sine', 0.06, 0.5);
}
function beginCut() { phase = 'cut'; setAsk('Swipe the scissors along the line'); guide.visible = true; scissors.visible = true; show('done', true); $('done').classList.remove('go'); }
function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const r = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(r) < 1e-6) return -1;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / r, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / r;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? u : -1;
}
let lastSnip = 0, cutsDone = 0;
function cutStroke(x0, y0, x1, y1) {
  if (phase !== 'cut') return;
  let n = 0;
  for (const s of strands) {
    for (let j = 0; j < S; j++) {
      if (j * SEG >= s.len) break;
      const vis = Math.min(SEG, s.len - j * SEG);
      dispPoint(s, j, va); dispPoint(s, j + 1, vb); vb.sub(va).multiplyScalar(vis / SEG).add(va);
      const [ax, ay] = scr(va), [bx, by] = scr(vb), u = segHit(ax, ay, bx, by, x0, y0, x1, y1);
      if (u >= 0) {
        const nl = j * SEG + u * vis; if (nl < s.len - 0.04) {
          const tipIdx = Math.min(S, Math.ceil(s.len / SEG)); dispPoint(s, tipIdx, vd);
          if (clumps.length < 80) clumps.push({ p: va.clone().lerp(vb, u).lerp(vd, 0.5), v: V((Math.random() - 0.5) * 0.04, 0.02, 0.03 + Math.random() * 0.03), r: Math.random() * 6, w: (Math.random() - 0.5) * 0.3, c: segCol[strands.indexOf(s) * S + j] >= 0 ? DYES[segCol[strands.indexOf(s) * S + j]] : L.natural, life: 1, sz: clamp((s.len - nl) / 1.2, 0.4, 1.6) });
          s.len = Math.max(0.15, nl); n++;
        }
        break;
      }
    }
  }
  if (n) {
    cutsDone += n; const now = performance.now(); if (now - lastSnip > 90) { lastSnip = now; tone(2400, 0.035, 'square', 0.05, 0.5); setTimeout(() => tone(1700, 0.04, 'square', 0.05, 0.5), 40); buzz(6); scissorsSnap = 1; }
    const sc = cutScore(); ui.progress(0.2 + 0.35 * Math.min(1, sc));
    $('done').classList.toggle('go', sc > 0.85);
    // react if it goes too short somewhere
    if (strands.some(s => s.tlen - s.len > L.tol * 0.8) && mood >= 0) { mood = -1; moodT = 1.2; ui.pop('TOO SHORT!', '#ff3b30', 30, 30); }
  }
}
const cutScore = () => strands.reduce((a, s) => a + clamp(1 - Math.abs(s.len - s.tlen) / L.tol, 0, 1), 0) / NS;
function beginDye() {
  parts.cut = cutScore(); phase = 'dye'; guide.visible = false; scissors.visible = false; show('done', true); $('done').classList.remove('go');
  setAsk(L.mode === 'all' ? 'Spray the dye all over' : 'Spray just the ends'); show('dyes', true); selectDye(L.opts[0]);
  ui.pop(parts.cut > 0.85 ? 'SHARP CUT!' : parts.cut > 0.5 ? 'NOT BAD!' : 'YIKES…', '#fff', 30, 30);
}
function selectDye(c) { sel = c; $('dyes').querySelectorAll('.dye').forEach(b => b.classList.toggle('on', +b.dataset.c === c)); sprayer.userData.body.material.color.set(DYES[c]); sprayer.visible = true; sfx.pick(2); buzz(8); }
function wantCol(s, j) { if (L.mode === 'all') return L.dye; const t = (j + 0.5) * SEG / s.len; return t >= 0.55 ? L.dye : t <= 0.4 ? -1 : -2; }
function dyeScore() { let ok = 0, n = 0; strands.forEach((s, i) => { for (let j = 0; j < S && j * SEG < s.len; j++) { const w = wantCol(s, j); if (w === -2) continue; n++; if (segCol[i * S + j] === w) ok++; } }); return n ? ok / n : 0; }
let sprayN = 0;
function spray(x, y) {
  if (phase !== 'dye' || sel < 0) return;
  strands.forEach((s, i) => { for (let j = 0; j < S && j * SEG < s.len; j++) { dispPoint(s, j, va); dispPoint(s, j + 1, vb); va.lerp(vb, 0.5); const [sx, sy] = scr(va); if ((sx - x) ** 2 + (sy - y) ** 2 < 30 * 30) segCol[i * S + j] = sel; } });
  if (L.mode === 'all') { const top = strands.filter((s, i) => segCol[i * S] === L.dye).length / NS; if (top > 0.5) hairMatCap.color.set(DYES[L.dye]), browM.color.set(L.natural); }
  if (++sprayN % 2 === 0) { tone(5000 + Math.random() * 2000, 0.05, 'sawtooth', 0.012, 0.8); }
  const sc = dyeScore(); ui.progress(0.55 + 0.3 * sc); $('done').classList.toggle('go', sc > 0.9);
}
function chooseStyle(st) {
  if (state !== 'play' || phase !== 'style') return;
  parts.style = st === L.style ? 1 : 0; styleNow = st; styleK = 0; phase = 'styling'; phT = 0; show('styles', false); show('ask', false);
  $('styles').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.s === st));
  tone(220, 0.8, 'sawtooth', 0.03, 1.8); buzz(12);
}
function doneStep() {
  if (state !== 'play') return;
  if (phase === 'cut') beginDye();
  else if (phase === 'dye') { parts.dye = dyeScore(); phase = 'style'; sprayer.visible = false; show('dyes', false); show('done', false); setAsk('Pick the style'); show('styles', true); ui.progress(0.85); }
}
function startReveal() { phase = 'reveal'; phT = 0; ui.progress(1); tone(260, 0.7, 'sine', 0.09, 2.5); }
function finish() {
  if (finished) return; finished = true;
  const match = 0.45 * parts.cut + 0.35 * parts.dye + 0.2 * parts.style;
  const pct = Math.round(match * 100), ok = match >= L.thr, stars = match >= 0.93 ? 3 : match >= 0.83 ? 2 : ok ? 1 : 0;
  $('stars').innerHTML = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
  $('pct').textContent = ok ? `${pct}% MATCH` : `${pct}% · NEED ${Math.round(L.thr * 100)}%`;
  $('banner').classList.toggle('bad', !ok); $('banner').classList.add('on'); ui.flash(0.5);
  if (ok) {
    state = 'won'; mood = 1; F.level(true); score += pct; ST.set('score', score); best = Math.max(best, score); ST.set('best', best);
    $('bub').textContent = stars === 3 ? '“I look AMAZING. Who is this?!”' : '“Ooh, I like it!”';
    sfx.win(); buzz([20, 40, 20]); confetti(scene, V(0, 4.2, 0.5), 80); setTimeout(() => confetti(scene, V(0, 4.2, 0), 60), 250);
    if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, V(0, 4, 0.5), 50); }, 300); }
    D.won(score); ui.win(level, stars === 3 ? `Salon legend! · ${score} pts` : `${pct}% match · ${score} pts`);
  } else {
    state = 'lost'; mood = -1; moodT = 99; F.level(false, Math.min(1, match / L.thr)); sfx.fail(); buzz([40, 30, 60]);
    $('bub').textContent = '“I\'ll… wear a hat.”';
    ui.lose('NOT THE LOOK!', `${pct}% match · need ${Math.round(L.thr * 100)}%`);
  }
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; beginWash(); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else { state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ input
let down = false, px = 0, py = 0, toolX = 0, toolY = 0, scissorsSnap = 0, botTool = null;
input({
  onDown: (e) => { if (e.target.closest && e.target.closest('button')) return; if (state !== 'play') return; down = true; px = e.clientX; py = e.clientY; toolX = px; toolY = py; botTool = null; lather(px, py); spray(px, py); },
  onMove: (dx, dy, e) => {
    if (!down || state !== 'play') return;
    const x = e.clientX, y = e.clientY; toolX = x; toolY = y;
    lather(x, y); cutStroke(px, py, x, y); spray(x, y); px = x; py = y; wind = clamp(wind + dx * 0.02, -1.5, 1.5);
  },
  onUp: () => { down = false; },
});
const toWorld = (x, y, z = 1.3) => { const v = V(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize(); const t = (z - camera.position.z) / v.z; return camera.position.clone().addScaledVector(v, t); };

// ------------------------------------------------------------------ loop
const camPos = V(0, 2.6, 12.4), camLook = V(0, 1.7, 0), cp = V(), cl = V();
let blinkT = 2;
loop((dt, t) => {
  phT += dt / 60; wind *= 0.96;
  if (phase === 'reveal') client.rotation.y = Math.sin(phT * 4.2) * 0.55 * Math.max(0, 1 - phT / 1.6);
  head.position.y = 2.75 + Math.sin(t * 1.6) * 0.015 + (mood > 0 ? Math.abs(Math.sin(t * 9)) * 0.06 : 0);
  stepHair(dt);
  // foam rides on the strands
  if (phase === 'rinse') foam.forEach(f => f.k -= 0.05 * dt);
  let fn = 0;
  for (const f of foam) { f.k = phase === 'rinse' ? f.k : Math.min(1, f.k + 0.15 * dt); if (f.k <= 0) continue; dispPoint(f.s, Math.min(f.j, Math.ceil(f.s.len / SEG)), va).add(f.o); dummy.position.copy(va); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(f.sz * f.k); dummy.updateMatrix(); foamMesh.setMatrixAt(fn++, dummy.matrix); }
  foamMesh.count = fn; foamMesh.instanceMatrix.needsUpdate = true;
  if (phase === 'rinse') { strands.forEach(s => s.foam = Math.max(0, s.foam - 0.04 * dt)); if (phT > 0.9) { foam.length = 0; beginCut(); } }
  // falling clumps
  let cn = 0;
  for (const c of clumps) { c.v.y -= 0.004 * dt; c.p.addScaledVector(c.v, dt); c.r += c.w * dt; c.life -= 0.012 * dt; if (c.life <= 0 || c.p.y < -1) continue; dummy.position.copy(c.p); dummy.rotation.set(c.r, 0, c.r * 0.7); dummy.scale.setScalar(c.sz); dummy.updateMatrix(); clumpMesh.setMatrixAt(cn, dummy.matrix); clumpMesh.setColorAt(cn, col.set(c.c)); cn++; }
  clumpMesh.count = cn; clumpMesh.instanceMatrix.needsUpdate = true; if (clumpMesh.instanceColor) clumpMesh.instanceColor.needsUpdate = true;
  // tools follow the finger (or the bot)
  const tx = botTool ? botTool[0] : toolX, ty = botTool ? botTool[1] : toolY;
  if (scissors.visible) {
    const w = toWorld(tx || innerWidth * 0.78, ty || innerHeight * 0.55, 1.6); scissors.position.lerp(w, 0.45 * dt);
    scissorsSnap = Math.max(0, scissorsSnap - 0.12 * dt); const open = 0.38 - 0.34 * Math.sin(scissorsSnap * Math.PI);
    scissors.children.forEach(g => { if (g.userData.s) g.rotation.z = g.userData.s * open; }); scissors.rotation.z = -0.5 + L.slope;
  }
  if (sprayer.visible) { const w = toWorld(tx || innerWidth * 0.8, ty || innerHeight * 0.5, 2.2); sprayer.position.lerp(w.add(V(0.35, -0.1, 0)), 0.35 * dt); sprayer.rotation.set(0.3, 0.6, 0.25);
    if ((down || botTool) && Math.random() < 0.6) burst(scene, sprayer.position.clone().add(V(-0.15, 0.15, -0.3)), DYES[sel], 2, { shape: 'sphere', speed: 0.025, up: 0.0, size: 0.35, gravity: 0.0, life: 0.45 }); }
  if (phase === 'styling') {
    styleK = Math.min(1, phT / 0.7);
    if (Math.random() < 0.4) burst(scene, V((Math.random() - 0.5) * 2.6, 1.2 + Math.random() * 2, 0.8), ['#ffffff', '#f0f4ff'], 1, { shape: 'sphere', speed: 0.01, up: 0.02, size: 0.7, gravity: -0.001, life: 0.7 });
    if (phT > 0.9) { startReveal(); ui.pop(parts.style ? 'FABULOUS!' : 'HMM, NOT THAT STYLE', parts.style ? '#fff' : '#ffe066', 30, 30); }
  }
  if (phase === 'reveal' && phT > 1.7) finish();
  // face: blink, look at the tool, mood
  blinkT -= dt / 60; const blink = blinkT < 0.12 ? 0.1 : 1; if (blinkT < 0) blinkT = 2 + Math.random() * 3;
  eyes.forEach(e => e.scale.y = blink); pupils.forEach(p => p.scale.y = blink);
  const look = (scissors.visible || sprayer.visible) ? (botTool ? botTool[0] : toolX) / innerWidth - 0.5 : 0;
  pupils.forEach((p, i) => { p.position.x = (i ? 0.34 : -0.34) + clamp(look, -0.5, 0.5) * 0.12; });
  if (moodT > 0) moodT -= dt / 60; else if (mood < 0 && state === 'play') mood = 0;
  smile.visible = mood >= 0; ohMouth.visible = mood < 0; smile.scale.setScalar(mood > 0 ? 1.4 : 1);
  brows.forEach((b, i) => { b.position.y = 0.33 + (mood < 0 ? 0.08 : 0); b.rotation.z = (i ? -1 : 1) * (mood < 0 ? -0.25 : 0.1); });
  renderHair();
  // camera
  if (phase === 'reveal') { cp.set(0, 2.7, 10.6); cl.set(0, 2.05, 0); } else { cp.set(0, 2.9, 12.4); cl.set(0, 2.3, 0); }
  camPos.lerp(cp, 0.05 * dt); camLook.lerp(cl, 0.06 * dt); camera.position.copy(camPos); camera.lookAt(camLook);
});

// ------------------------------------------------------------------ test hooks
let botX = -2.6;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get phase() { return phase; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'wash') { const s = strands.filter(s => s.foam < 1); for (let k = 0; k < 3 && s.length; k++) { const st = s[Math.floor(Math.random() * s.length)]; dispPoint(st, 5, va); const [x, y] = scr(va); botTool = [x, y]; lather(x, y); } return; }
    if (phase === 'cut') {
      if (botX > 2.6) { botX = -2.6; return doneStep(); }
      const x0 = botX, x1 = botX + 0.55; botX = x1;
      const a = scr(V(x0, cutY(x0), 0)), b = scr(V(x1, cutY(x1), 0)); botTool = b; cutStroke(a[0], a[1], b[0], b[1]); return;
    }
    if (phase === 'dye') {
      if (sel !== L.dye) return selectDye(L.dye);
      if (dyeScore() > 0.95) return doneStep();
      const cand = []; strands.forEach((s, i) => { for (let j = 0; j < S && j * SEG < s.len; j++) { const w = wantCol(s, j); if (w === L.dye && segCol[i * S + j] !== L.dye) cand.push([s, j]); } });
      for (let k = 0; k < 3 && cand.length; k++) { const [s, j] = cand[Math.floor(Math.random() * cand.length)]; dispPoint(s, j, va); dispPoint(s, j + 1, vb); va.lerp(vb, 0.5); const p = scr(va); botTool = p; spray(p[0], p[1]); }
      return;
    }
    if (phase === 'style') return chooseStyle(L.style);
  },
};

buildLevel();
ui.start();

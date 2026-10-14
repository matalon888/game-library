// Flip Volt — original game. A neon stunt bike on a single glowing line: hold to throttle, hold in the air to backflip,
// land on your wheels. Reach the finish gate of each seeded track.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, confetti } from './kit/hc.js';
import { createBloom } from './bloom.js';
import { flow } from './kit/flow.js';

const stage = createStage({ fov: 40, shadows: false, clear: '#141a3a' });
const { scene, camera, renderer } = stage;
stage.autoRender = false;
const bloom = createBloom(renderer, scene, camera, { strength: 1.15, threshold: 0.6 });
const ui = createUI({ title: 'FLIP<br>VOLT', hint: 'Hold to ride · hold in air to flip', hand: '👆' });
const save = store('flipvolt');
const F = flow('flipvolt');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';

// ------------------------------------------------------------------ themes (dark bg, neon track, contrasting bike)
const THEMES = [
  { bg: ['#1b2352', '#0e1230'], rock: '#22306e', track: '#d23cff', bike: '#2cff7a' },
  { bg: ['#2a3034', '#15191b'], rock: '#353d42', track: '#27ff6a', bike: '#29d2ff' },
  { bg: ['#3a0f3c', '#1a0620'], rock: '#4a1a4e', track: '#ffd23a', bike: '#ff4fd8' },
  { bg: ['#0c2a3a', '#06141e'], rock: '#14405a', track: '#22e4ff', bike: '#ffe23a' },
  { bg: ['#341224', '#170711'], rock: '#4a1c33', track: '#ff3d6e', bike: '#3dffd6' },
  { bg: ['#1c1440', '#0b0820'], rock: '#2c2266', track: '#ff8a2a', bike: '#9c7bff' },
];
let TH = THEMES[0];

// ------------------------------------------------------------------ DOM / CSS
const css = document.createElement('style');
css.textContent = `
.hc-score{font-family:'Michroma',system-ui,sans-serif;font-weight:400;font-size:64px;top:calc(62px + env(safe-area-inset-top));text-shadow:0 0 16px rgba(255,255,255,.45)}
.hc-sub{top:calc(134px + env(safe-area-inset-top));font-family:'Michroma',system-ui;font-size:13px;letter-spacing:2px;opacity:.55}
.hc-lvl{font-family:'Audiowide',system-ui;font-weight:400;font-size:15px;background:var(--ui);box-shadow:0 0 12px var(--ui)}
.hc-lvl.next{background:rgba(255,255,255,.12);color:#fff;box-shadow:none}
.hc-bar{background:rgba(255,255,255,.12);height:8px}.hc-bar i{background:var(--ui);box-shadow:0 0 10px var(--ui)}
.hc-card h1{font-family:'Audiowide',system-ui;font-weight:400;letter-spacing:2px;color:#fff;text-shadow:0 0 24px var(--ui),0 0 6px var(--ui)}
.hc-card p,.hc-card .hint{font-family:'Audiowide',system-ui;font-weight:400;text-shadow:0 0 12px var(--ui)}
.hc-card .hint{font-size:17px}.hc-card{padding-top:calc(190px + env(safe-area-inset-top))}
.fv-plus{position:fixed;font-family:'Audiowide',system-ui;font-size:26px;color:#fff;pointer-events:none;z-index:6;text-shadow:0 0 10px rgba(255,255,255,.7);transition:opacity .25s;white-space:nowrap}
.fv-word{position:fixed;left:0;right:0;top:68%;text-align:center;font-family:'Audiowide',system-ui;font-size:46px;color:#fff;pointer-events:none;z-index:6;white-space:nowrap;
  text-shadow:0 0 18px rgba(255,255,255,.55);animation:fvword 1.3s ease-out forwards}
@keyframes fvword{0%{opacity:0;transform:rotate(-12deg) scale(.5)}15%{opacity:1;transform:rotate(-12deg) scale(1.12)}25%{transform:rotate(-12deg) scale(1)}75%{opacity:1}100%{opacity:0;transform:rotate(-12deg) scale(1) translateY(-30px)}}`;
document.head.appendChild(css);
const plusEl = Object.assign(document.createElement('div'), { className: 'fv-plus' }); plusEl.style.opacity = 0; document.body.appendChild(plusEl);
let wordEl = null;
function word(t, color = '#fff') { if (wordEl) wordEl.remove(); wordEl = Object.assign(document.createElement('div'), { className: 'fv-word', textContent: t }); wordEl.style.color = color; document.body.appendChild(wordEl); const w = wordEl; setTimeout(() => w.remove(), 1350); }

// ------------------------------------------------------------------ background: gradient + low-poly rock strips (parallax)
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 2; bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
function paintBg() { const g = bgCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, TH.bg[0]); gr.addColorStop(1, TH.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, 2, 256); bgTex.needsUpdate = true; }

function rockStrip(seed, tile, hMin, hMax, count) {
  const r = rng(seed), pos = [], shade = [];
  for (let k = 0; k < 2; k++) for (let i = 0; i < count; i++) {
    const r2 = rng(seed * 31 + i * 7 + 1);  // same rock in both copies
    const cx = (i / count) * tile + r2() * tile / count + k * tile, w = 1.6 + r2() * 3.6, h = hMin + r2() * (hMax - hMin);
    const px = cx + (r2() - 0.5) * w * 0.6, ridge = [[cx - w, 0], [cx - w * 0.55, h * (0.35 + r2() * 0.3)], [px, h], [cx + w * 0.5, h * (0.4 + r2() * 0.3)], [cx + w, 0]];
    const mid = [cx + (r2() - 0.5) * w * 0.3, h * 0.25];
    for (let j = 0; j < ridge.length - 1; j++) {
      pos.push(ridge[j][0], ridge[j][1], 0, ridge[j + 1][0], ridge[j + 1][1], 0, mid[0], mid[1], 0);
      const s = 0.55 + r2() * 0.6; shade.push(s, s, s);
    }
    pos.push(cx - w, 0, 0, cx + w, 0, 0, mid[0], mid[1], 0); shade.push(0.6);
    r();
  }
  pos.push(-tile, 0, 0, tile * 3, 0, 0, -tile, -40, 0, tile * 3, 0, 0, tile * 3, -40, 0, -tile, -40, 0); shade.push(0.45, 0.45);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const col = new Float32Array(pos.length); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.userData.shade = shade;
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; m.userData.tile = tile;
  return m;
}
function tintStrip(m, hex, k) {
  const c = new THREE.Color(hex), sh = m.geometry.userData.shade, col = m.geometry.attributes.color.array;
  for (let t = 0; t < sh.length; t++) for (let v = 0; v < 3; v++) { const i = (t * 3 + v) * 3; col[i] = c.r * sh[t] * k; col[i + 1] = c.g * sh[t] * k; col[i + 2] = c.b * sh[t] * k; }
  m.geometry.attributes.color.needsUpdate = true;
}
const farRocks = rockStrip(11, 120, 8, 22, 9); farRocks.position.z = -70; scene.add(farRocks);
const nearRocks = rockStrip(5, 48, 2.5, 6.5, 12); nearRocks.position.z = -8; scene.add(nearRocks);

// ------------------------------------------------------------------ sparks (one Points draw call, additive)
const NP = 700, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pSize = new Float32Array(NP);
const parts = []; for (let i = 0; i < NP; i++) parts.push({ life: 0, v: new THREE.Vector3(), c: new THREE.Color(), s: 1, g: 0 });
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const points = new THREE.Points(pGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  vertexShader: `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * 1500. / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC * (1. - d * 2.) * 0.75, 1.); }`,
}));
points.frustumCulled = false; scene.add(points);
let pi = 0;
function sparks(x, y, color, n = 30, speed = 8, { up = 2, size = 0.1, g = 14 } = {}) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const idx = pi, p = parts[pi]; pi = (pi + 1) % NP;
    p.life = 0.5 + Math.random() * 0.7; p.c.copy(c); p.s = size * (0.5 + Math.random()); p.g = g;
    const a = Math.random() * Math.PI * 2, sp = speed * (0.25 + Math.random() * 0.75);
    p.v.set(Math.cos(a) * sp, Math.sin(a) * sp + up * Math.random(), (Math.random() - 0.5) * sp * 0.4);
    pPos[idx * 3] = x; pPos[idx * 3 + 1] = y; pPos[idx * 3 + 2] = 0.2;
  }
}
function updateSparks(dt) {
  for (let i = 0; i < NP; i++) {
    const p = parts[i];
    if (p.life <= 0) { pSize[i] = 0; continue; }
    p.life -= dt; p.v.y -= p.g * dt; p.v.multiplyScalar(1 - 1.2 * dt);
    pPos[i * 3] += p.v.x * dt; pPos[i * 3 + 1] += p.v.y * dt; pPos[i * 3 + 2] += p.v.z * dt;
    const k = Math.min(1, p.life * 2); pCol[i * 3] = p.c.r * k; pCol[i * 3 + 1] = p.c.g * k; pCol[i * 3 + 2] = p.c.b * k; pSize[i] = p.s;
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
}
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// ------------------------------------------------------------------ bike (neon outline motorbike + rider)
const RH = 0.34;                       // ride height: bike centre above the track line
const bike = new THREE.Group(); scene.add(bike);
const bikeMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), bodyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const wheelGeo = new THREE.TorusGeometry(0.2, 0.045, 8, 26);
const WR = new THREE.Mesh(wheelGeo, bikeMat), WF = new THREE.Mesh(wheelGeo, bikeMat);
WR.position.set(-0.5, -0.14, 0); WF.position.set(0.5, -0.14, 0); bike.add(WR, WF);
for (const w of [WR, WF]) { const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bikeMat); w.add(hub); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.02), bikeMat); w.add(sp); w.userData.sp = sp; }
function rod(a, b, r = 0.035, m = bikeMat) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), g = new THREE.CapsuleGeometry(r, len, 3, 6), mesh = new THREE.Mesh(g, m);
  mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); mesh.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2; bike.add(mesh); return mesh;
}
{
  const s = new THREE.Shape(); s.moveTo(-0.46, 0.1); s.lineTo(-0.12, 0.17); s.lineTo(0.12, 0.27); s.lineTo(0.36, 0.22); s.lineTo(0.3, 0.06); s.lineTo(0.02, -0.06); s.lineTo(-0.3, -0.02); s.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }), bodyMat); body.position.z = -0.04; bike.add(body);
  rod([-0.5, -0.14], [-0.1, 0.06]); rod([0.34, 0.22], [0.5, -0.14]); rod([0.3, 0.3], [0.42, 0.36], 0.03); rod([-0.46, 0.1], [0.12, 0.27], 0.03);
  rod([-0.18, 0.2], [0.04, 0.5], 0.075);                   // torso, hunched forward
  rod([0.04, 0.46], [0.36, 0.33], 0.035); rod([-0.12, 0.2], [0.08, 0.02], 0.045); rod([0.08, 0.02], [0.06, -0.08], 0.04);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), bikeMat); helmet.position.set(0.1, 0.62, 0); bike.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.2), new THREE.MeshBasicMaterial({ color: 0x0b0d1a })); visor.position.set(0.17, 0.63, 0); bike.add(visor);
}
// two wheel trails (fading ribbons)
const TN = 26;
function ribbon() {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(TN * 2 * 3), col = new Float32Array(TN * 2 * 3), idx = [];
  for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; scene.add(m); return { m, hist: [] };
}
const trails = [ribbon(), ribbon()];
function updateTrail(tr, x, y, on) {
  if (on) tr.hist.unshift([x, y]); else if (tr.hist.length) tr.hist.pop();
  if (tr.hist.length > TN) tr.hist.length = TN;
  const pos = tr.m.geometry.attributes.position.array, col = tr.m.geometry.attributes.color.array, c = new THREE.Color(TH.bike), n = tr.hist.length;
  for (let i = 0; i < TN; i++) {
    const h = tr.hist[Math.min(i, n - 1)] || [x, y], h2 = tr.hist[Math.min(i + 1, n - 1)] || h;
    let dx = h[0] - h2[0], dy = h[1] - h2[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const f = i < n ? 1 - i / TN : 0, w = 0.09 * f + 0.01;
    pos.set([h[0] - dy * w, h[1] + dx * w, -0.05, h[0] + dy * w, h[1] - dx * w, -0.05], i * 6);
    const k = f * f * 0.9; col.set([c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k], i * 6);
  }
  tr.m.geometry.attributes.position.needsUpdate = tr.m.geometry.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------ track: polylines ("pieces") with gaps, ramps, kickers, loops
const STEP = 0.32, G = 17;
let pieces = [], diamonds = [], saws = [], gate = null, worldMeshes = [], minTrackY = 0, startX = 0, gateX = 100;
function newPiece(x, y, h = 0) { return { pts: [[x, y]], h, loops: [] }; }
function arc(P, len, dh) { const n = Math.max(1, Math.round(len / STEP)); for (let i = 0; i < n; i++) { P.h += dh / n; const l = P.pts[P.pts.length - 1]; P.pts.push([l[0] + Math.cos(P.h) * len / n, l[1] + Math.sin(P.h) * len / n]); } }
const tail = P => P.pts[P.pts.length - 1];
function loopFeat(P, R, D) {
  const [x0, y0] = tail(P), n = Math.round((2 * Math.PI * R + D) / STEP), i0 = P.pts.length - 1;
  for (let i = 1; i <= n; i++) { const t = i / n, a = t * Math.PI * 2; P.pts.push([x0 + R * Math.sin(a) + D * t, y0 + R * (1 - Math.cos(a))]); }
  P.loops.push([i0, P.pts.length - 1]); P.h = 0;
}
function finalize(P) {
  P.seg = []; P.cum = [0]; P.ang = [];
  for (let i = 0; i < P.pts.length - 1; i++) { const dx = P.pts[i + 1][0] - P.pts[i][0], dy = P.pts[i + 1][1] - P.pts[i][1], l = Math.hypot(dx, dy); P.seg.push(l); P.cum.push(P.cum[i] + l); P.ang.push(Math.atan2(dy, dx)); }
  P.L = P.cum[P.cum.length - 1];
  P.loopS = P.loops.map(([a, b]) => [P.cum[a], P.cum[b]]);
  P.minX = Math.min(...P.pts.map(p => p[0])); P.maxX = Math.max(...P.pts.map(p => p[0]));
  P.minY = Math.min(...P.pts.map(p => p[1])); P.maxY = Math.max(...P.pts.map(p => p[1]));
  pieces.push(P); return P;
}
function segAt(P, s) { let lo = 0, hi = P.seg.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P.cum[m] <= s) lo = m; else hi = m - 1; } return lo; }
function sample(P, s) {
  s = clamp(s, 0, P.L); const i = segAt(P, s), t = (s - P.cum[i]) / P.seg[i], a = P.pts[i], b = P.pts[i + 1];
  // smooth the angle between neighbouring segments for visuals
  const a0 = P.ang[i], a1 = P.ang[Math.min(i + 1, P.ang.length - 1)];
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), ang: a0 + wrap(a1 - a0) * t * 0.5, segAng: a0 };
}
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const inLoop = (P, s) => P.loopS.some(([a, b]) => s > a - 0.5 && s < b + 0.3);

function genLevel(n) {
  const r = rng(n * 9973 + 17), fk = F.k();
  pieces = []; diamonds = []; saws = [];
  TH = THEMES[(n - 1) % THEMES.length];
  let P = newPiece(0, 0); arc(P, 14, 0);
  const target = (n === 1 ? 100 : Math.min(150 + n * 26, 460)) * fk;
  const vBot = 14.5;
  const ground = (count = 3, h = 1.25) => { const [x, y] = tail(P); for (let i = 0; i < count; i++) diamonds.push({ x: x + 1.2 + i * 1.3, y: y + h + 0.2 * Math.sin(i), alive: true }); };
  const feats = n === 1 ? ['hill', 'jump', 'kicker', 'jump'] : null;
  let fi = 0, sinceJump = 0;
  while (tail(P)[0] < target) {
    let f;
    if (feats) f = feats[fi++ % feats.length];
    else {
      const pool = ['hill', 'jump', 'jump', 'kicker', 'valley', 'descent'];
      if (n >= 2) pool.push('loop'); if (n >= 3) pool.push('bigjump', 'bigjump'); if (n >= 5) pool.push('loop', 'kicker');
      f = pool[Math.floor(r() * pool.length)];
      if (sinceJump > 2) f = n >= 3 && r() < 0.5 ? 'bigjump' : 'jump';
    }
    sinceJump++;
    if (f === 'hill') { const a = 0.25 + r() * 0.2, L = 4 + r() * 2; arc(P, L, a); ground(2, 1.0); arc(P, 2 * L, -2 * a); arc(P, L, a); arc(P, 3, 0); }
    else if (f === 'valley') { const a = 0.3 + r() * 0.2, L = 4 + r() * 2; arc(P, L, -a); arc(P, 2 * L, 2 * a); arc(P, L, -a); arc(P, 3, 0); }
    else if (f === 'descent') { const a = 0.4 + r() * 0.2; arc(P, 3, -a); arc(P, 5 + r() * 4, 0); arc(P, 3, a); ground(3, 1.0); arc(P, 4, 0); }
    else if (f === 'kicker') { arc(P, 3, 0); arc(P, 2.2, 0.5); arc(P, 1.0, -0.95); arc(P, 3.2, 0.45); arc(P, 5, 0); }
    else if (f === 'loop') {
      arc(P, 4, 0); const [lx, ly] = tail(P), R = 3.1 + r() * 0.6, D = 2.6; loopFeat(P, R, D);
      for (let i = 0; i < 3; i++) diamonds.push({ x: lx + D * 0.5 - 0.9 + i * 0.9, y: ly + 2 * R - RH - 0.15, alive: true });
      if (n >= 4 && r() < 0.5) saws.push({ x: lx + D / 2, y: ly + R, r: Math.min(1.6, R - 1.3) });
      arc(P, 6, 0);
    } else {                                     // jump: dip, ramp up, gap, land on a downslope of a new piece
      sinceJump = 0;
      const big = f === 'bigjump', A = big ? 0.66 + r() * 0.12 : 0.42 + r() * 0.12, gap = big ? 3 + r() * 1.2 : 2.2 + r(), drop = big ? 5 + r() * 2.5 : 2.5 + r() * 1.5;
      arc(P, 3, -0.18); arc(P, 3, 0.18); arc(P, big ? 5 : 4, A);
      const [x0, y0] = tail(P); finalize(P);
      const vx = Math.cos(A) * vBot, vy = Math.sin(A) * vBot, ly = y0 - drop - 1.5, T = (vy + Math.sqrt(vy * vy + 2 * G * (y0 - ly))) / G;
      const nd = big ? 5 : 3;
      for (let i = 0; i < nd; i++) { const t = T * (0.3 + 0.4 * i / (nd - 1)); diamonds.push({ x: x0 + vx * t, y: y0 + vy * t - G * t * t / 2 + 0.25, alive: true }); }
      if ((n >= 2 && r() < Math.min(0.66, 0.55 * fk)) || big) saws.push({ x: x0 + gap * 0.5, y: y0 - drop - 2.7, r: 2.0 + r() * 0.5 });
      P = newPiece(x0 + gap, y0 - drop, -0.34); P.pts.push([x0 + gap + 0.3 * Math.cos(-0.34), y0 - drop + 0.3 * Math.sin(-0.34)]);
      arc(P, 4, 0); arc(P, 4, 0.34); arc(P, big ? 14 : 9, 0);
    }
  }
  arc(P, 18, 0); P.final = true; finalize(P);
  const [gx, gy] = tail(P); gateX = gx - 6; gate = { x: gateX, y: gy };
  P.gateS = P.L - 6;
  startX = 0; minTrackY = Math.min(...pieces.map(q => q.minY));
}

// ------------------------------------------------------------------ track meshes
const trackVS = `varying float vS; varying vec3 vN; uniform float L; void main(){ vS = uv.x * L; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const trackFS = `uniform vec3 cA, cB; uniform float lit; varying float vS; varying vec3 vN;
  void main(){ float r = abs(vN.z); if (!(r >= 0.0 && r <= 1.0)) r = 0.6; vec3 c = vS < lit ? cB : cA; c = mix(c, vec3(1.), r * r * 0.35); gl_FragColor = vec4(c * (0.55 + r * 0.95), 1.); }`;
const dGeo = new THREE.OctahedronGeometry(0.3, 0); dGeo.scale(0.75, 1.15, 0.35);
let dMesh = null;
const sawGeo = (() => {
  const s = new THREE.Shape(), N = 22;
  for (let i = 0; i <= N * 2; i++) { const a = i / (N * 2) * Math.PI * 2, rr = i % 2 ? 0.84 : 1; const x = Math.cos(a + (i % 2 ? 0.06 : 0)) * rr, y = Math.sin(a + (i % 2 ? 0.06 : 0)) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  return new THREE.ShapeGeometry(s);
})();
const checker = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 5; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(i, j, 1, 1); } const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; })();
function buildMeshes() {
  for (const m of worldMeshes) { scene.remove(m); m.geometry !== dGeo && m.geometry !== sawGeo && m.geometry.dispose(); }
  worldMeshes = [];
  for (const P of pieces) {
    const curve = new THREE.CatmullRomCurve3(P.pts.map(p => new THREE.Vector3(p[0], p[1], 0)), false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, P.pts.length * 2, 0.11, 6, false);
    P.mat = new THREE.ShaderMaterial({ uniforms: { cA: { value: hdr(TH.track, 1.6) }, cB: { value: hdr(TH.bike, 1.6) }, lit: { value: 0 }, L: { value: P.L } }, vertexShader: trackVS, fragmentShader: trackFS });
    const m = new THREE.Mesh(geo, P.mat); scene.add(m); worldMeshes.push(m);
    for (const end of [P.pts[0], P.pts[P.pts.length - 1]]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: hdr(TH.track, 2.2) })); cap.position.set(end[0], end[1], 0); scene.add(cap); worldMeshes.push(cap); }
  }
  dMesh = new THREE.InstancedMesh(dGeo, new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 2.4) }), Math.max(1, diamonds.length)); dMesh.frustumCulled = false; scene.add(dMesh); worldMeshes.push(dMesh);
  for (const s of saws) {
    s.m = new THREE.Mesh(sawGeo, new THREE.MeshBasicMaterial({ color: hdr('#ff5b57', 0.58) })); s.m.position.set(s.x, s.y, -0.1); s.m.scale.setScalar(s.r); scene.add(s.m); worldMeshes.push(s.m);
  }
  const gm = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 2.2) }), gm2 = new THREE.MeshBasicMaterial({ color: hdr(TH.bike, 2) });
  const post = new THREE.BoxGeometry(0.16, 4.2, 0.16);
  for (const dx of [-0.08]) { const a = new THREE.Mesh(post, gm); a.position.set(gate.x + dx, gate.y + 2.1, -0.6); scene.add(a); worldMeshes.push(a); }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 4, 2), new THREE.MeshBasicMaterial({ map: checker, color: hdr('#ffffff', 1.4) })); flag.position.set(gate.x + 0.8, gate.y + 3.7, -0.6); scene.add(flag); worldMeshes.push(flag); gate.flag = flag;
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 30, 0.06), new THREE.MeshBasicMaterial({ color: hdr(TH.bike, 0.5), transparent: true, opacity: 0.35 })); line.position.set(gate.x, gate.y, -1); scene.add(line); worldMeshes.push(line);
  tintStrip(farRocks, TH.rock, 0.55); tintStrip(nearRocks, TH.rock, 1.0);
  paintBg(); bikeMat.color.copy(hdr(TH.bike, 1.35)); bodyMat.color.copy(hdr(TH.bike, 0.55));
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', TH.bike);
}

// ------------------------------------------------------------------ bike physics state
const B = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, w: 0, ground: true, P: null, s: 0, v: 0, accum: 0, launchAng: 0, airT: 0, flipsShown: 0, squash: 0 };
let hold = false, shake = 0, botOn = false, botPlan = null, levelFlips = 0, camX = 0, camY = 0, camZ = 36, finishT = 0;
function placeOn(P, s) { const q = sample(P, s); B.P = P; B.s = s; B.ground = true; B.x = q.x - Math.sin(q.segAng) * RH; B.y = q.y + Math.cos(q.segAng) * RH; return q; }
function buildLevel() {
  genLevel(level); buildMeshes();
  for (const t of trails) t.hist.length = 0;
  const q = placeOn(pieces[0], 2.5); B.v = 6; B.ang = q.ang; B.w = 0; B.accum = 0; B.airT = 0; B.flipsShown = 0;
  bike.visible = true; score = 0; levelFlips = 0; hold = false; botPlan = null; finishT = 0;
  for (const d of debris) scene.remove(d.m); debris = [];
  camX = B.x + 4; camY = B.y + 1.5;
  ui.levels(level); ui.score(0); ui.sub('BEST ' + best); ui.progress(0);
}

// contact test of a moving point (prev -> next) against the top side of every segment
function contact(px, py, qx, qy, vx, vy) {
  for (const P of pieces) {
    if (qx < P.minX - 1 || qx > P.maxX + 1 || qy < P.minY - 1.5 || qy > P.maxY + 1.5) continue;
    const pts = P.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], bx = pts[i + 1][0];
      if (qx < Math.min(ax, bx) - 0.4 || qx > Math.max(ax, bx) + 0.4) continue;
      const ay = pts[i][1], by = pts[i + 1][1], len = P.seg[i], tx = (bx - ax) / len, ty = (by - ay) / len, nx = -ty, ny = tx;
      const sd = (qx - ax) * nx + (qy - ay) * ny; if (sd >= RH || sd < -0.9) continue;
      const sp = (px - ax) * nx + (py - ay) * ny; if (sp < RH - 0.3) continue;
      if (vx * nx + vy * ny >= 0) continue;
      const t = ((qx - ax) * tx + (qy - ay) * ty) / len; if (t < -0.05 || t > 1.05) continue;
      return { P, i, t: clamp(t, 0, 1), ang: P.ang[i] };
    }
  }
  return null;
}
function trackBelow(x, y) {
  let best = -1e9, ang = null;
  for (const P of pieces) {
    if (x < P.minX || x > P.maxX || P.minY > y + 0.3) continue;
    for (let i = 0; i < P.pts.length - 1; i++) {
      const a = P.pts[i], b = P.pts[i + 1]; if (!(a[0] <= x && b[0] > x)) continue;
      const yy = lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); if (yy < y + 0.3 && yy > best) { best = yy; ang = P.ang[i]; }
    }
  }
  return ang;
}
function predictAir() {   // seconds until landing on the current ballistic path (bot helper)
  let x = B.x, y = B.y, vx = B.vx, vy = B.vy;
  for (let t = 0; t < 4; t += 1 / 60) { const nvy = vy - G / 60, nx = x + vx / 60, ny = y + nvy / 60; const c = contact(x, y, nx, ny, vx, nvy); if (c) return { T: t, ang: c.ang }; x = nx; y = ny; vy = nvy; if (y < minTrackY - 12) return { T: t, ang: 0, fall: true }; }
  return { T: 4, ang: 0 };
}

// ------------------------------------------------------------------ engine sound (own WebAudio hum, soft)
let eng = null;
function engine(on, f) {
  try {
    if (!eng) { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; fl.type = 'lowpass'; fl.frequency.value = 520; g.gain.value = 0; o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(ac.destination); o.start(); o2.start(); eng = { ac, o, o2, g }; }
    const t = eng.ac.currentTime; if (eng.ac.state === 'suspended') eng.ac.resume();
    eng.g.gain.setTargetAtTime(on ? 0.028 : 0, t, 0.08); eng.o.frequency.setTargetAtTime(f, t, 0.06); eng.o2.frequency.setTargetAtTime(f * 0.501, t, 0.06);
  } catch (e) {}
}

// ------------------------------------------------------------------ events: launch / land / crash / win
function launch() {
  const q = sample(B.P, B.s);
  B.ground = false; B.vx = Math.cos(q.segAng) * B.v; B.vy = Math.sin(q.segAng) * B.v; B.accum = 0; B.launchAng = B.ang; B.airT = 0; B.flipsShown = 0;
  B.P.mat.uniforms.lit.value = Math.max(B.P.mat.uniforms.lit.value, B.s); botPlan = null;
}
function land(c) {
  const P = c.P, len = P.seg[c.i], s = P.cum[c.i] + c.t * len;
  const diff = Math.abs(wrap(B.ang - c.ang));
  if (diff > 0.9) { crash('wipeout!'); return; }
  const flips = Math.max(0, Math.round((B.accum - wrap(c.ang - B.launchAng)) / (Math.PI * 2)));
  const tx = Math.cos(c.ang), ty = Math.sin(c.ang);
  B.v = clamp(B.vx * tx + B.vy * ty, 5, 15.5); B.ang = c.ang; B.w = 0;
  placeOn(P, s); B.squash = 1;
  if (B.airT > 0.35) { sparks(B.x, B.y - RH, TH.bike, 10, 4, { up: 2, size: 0.06 }); tone(150, 0.08, 'sine', 0.12, 0.6); buzz(15); shake = Math.max(shake, 0.25); }
  let pts = 0, perfect = diff < 0.15 && B.airT > 0.5 && flips > 0;
  if (flips > 0) {
    pts = flips; levelFlips += flips;
    plus('+' + flips);
    word(['', 'flip!', 'double flip!', 'maniac!', 'insane!', 'legendary!'][Math.min(flips, 5)], flips >= 3 ? '#ffe23a' : '#fff');
    sfx.win(); buzz([20, 30, 20]); ui.flash(0.15); sparks(B.x, B.y, TH.bike, 40, 9, { up: 3, size: 0.09 });
  } else if (B.airT > 1.3) word('huge jump!');
  if (perfect) { pts += 1; setTimeout(() => plus('perfect +1'), 550); }
  if (pts) { score += pts; ui.score(score); }
}
function plus(t) { plusEl.textContent = t; plusEl.style.opacity = 1; clearTimeout(plus.t); plus.t = setTimeout(() => plusEl.style.opacity = 0, 750); }
let debris = [];
function crash(why) {
  if (state !== 'play') return;
  F.level(false, clamp(B.x / gateX, 0, 1));
  state = 'lost'; bike.visible = false; hold = false; engine(false, 60);
  sparks(B.x, B.y, TH.bike, 90, 11, { up: 4, size: 0.11 }); sparks(B.x, B.y, '#ffffff', 30, 7, { up: 3, size: 0.07 });
  for (const ch of bike.children) {   // the bike shatters: every neon part flies off
    const m = ch.clone(); m.applyMatrix4(bike.matrixWorld); scene.add(m);
    debris.push({ m, vx: B.vx * 0.4 + (Math.random() - 0.5) * 9, vy: B.vy * 0.3 + Math.random() * 8, w: (Math.random() - 0.5) * 20, life: 2.5 });
  }
  shake = 0.9; ui.flash(0.45); buzz([60, 40, 80]); sfx.smash(); sfx.fail();
  if (score > best) { best = score; save.set('best', best); }
  ui.lose('CRASHED!', `${why}  ·  ${score} pts`);
}
function win() {
  if (state === 'play') F.level(true);
  state = 'won'; engine(true, 70);
  confetti(scene, new THREE.Vector3(B.x + 2, B.y + 2, 0), 70);
  for (let i = 0; i < 4; i++) setTimeout(() => sparks(B.x + 3 + Math.random() * 3, B.y + 3 + Math.random() * 3, [TH.bike, TH.track, '#ffffff', '#ffe23a'][i], 50, 8, { up: 3, size: 0.1 }), i * 140);
  sfx.win(); buzz([30, 40, 30]); ui.flash(0.3); word('finish!', '#fff');
  if (score > best) { best = score; save.set('best', best); }
  level++; save.set('level', level);
  ui.win(level - 1, `${levelFlips} flips · ${score} pts`);
}

// ------------------------------------------------------------------ input + UI flow
input({ onDown: () => { if (state === 'play') hold = true; }, onUp: () => { hold = false; } });
ui.onTap(w => { if (w !== 'start') buildLevel(); state = 'play'; hold = false; });

// ------------------------------------------------------------------ main loop
const _v = new THREE.Vector3();
loop((dtf) => {
  const dt = Math.min(dtf, 2.5) / 60, t = performance.now() / 1000;
  ui.els.sc.style.visibility = state === 'ready' ? 'hidden' : ''; ui.els.sub.style.visibility = state === 'play' ? '' : 'hidden';
  if (state === 'play' || state === 'won') {
    const holding = state === 'won' ? false : hold, N = 5, h = dt / N;
    for (let k = 0; k < N; k++) {
      if (state === 'lost') break;
      if (B.ground) {
        const P = B.P, q = sample(P, B.s), loopy = inLoop(P, B.s);
        let a = (holding ? 12 : -2.5) - (loopy ? 0 : G * 0.5 * Math.sin(q.segAng));
        if (state === 'won') a = -10;
        B.v = clamp(B.v + a * h, state === 'won' ? 0 : 4.5, 15.5); if (loopy) B.v = Math.max(B.v, 10);
        B.s += B.v * h;
        if (P.final && B.s >= P.gateS && state === 'play') { win(); }
        if (B.s >= P.L) { if (P.final) { B.s = P.L; B.v = 0; } else { B.s = P.L; launch(); continue; } }
        const q2 = placeOn(P, B.s);
        B.ang = B.ang + wrap(q2.ang - B.ang) * Math.min(1, h * 30);
        P.mat.uniforms.lit.value = Math.max(P.mat.uniforms.lit.value, B.s);
        // crest: if the track falls away faster than gravity can hold us, we fly
        if (!loopy) { const ahead = sample(P, B.s + 0.7), k2 = wrap(ahead.segAng - q2.segAng) / 0.7; if (k2 < -0.03 && B.v * B.v * -k2 > G * Math.cos(q2.segAng) && B.s + 0.7 < P.L) launch(); }
      } else {
        B.airT += h;
        const px = B.x, py = B.y;
        B.vy -= G * h; B.x += B.vx * h; B.y += B.vy * h;
        let tw;
        if (holding) tw = 8.2;
        else { const below = trackBelow(B.x, B.y); tw = below === null ? 0 : clamp(wrap(below - B.ang) * 4.5, -4.5, 4.5); }
        B.w += (tw - B.w) * (1 - Math.exp(-14 * h));
        B.ang += B.w * h; B.accum += B.w * h;
        if (B.airT > 0.04) { const c = contact(px, py, B.x, B.y, B.vx, B.vy); if (c) land(c); }
        if (state === 'play' && B.y < minTrackY - 14) crash('fell off the line');
      }
      for (const s of saws) if (state === 'play' && Math.hypot(B.x - s.x, B.y - s.y) < s.r * 0.86 + 0.32) crash('sawn in half!');
    }
    // flips counted live while spinning
    if (!B.ground && state === 'play') {
      const f = Math.floor((B.accum + 0.6) / (Math.PI * 2));
      if (f > B.flipsShown) { B.flipsShown = f; plus('+' + f); tone(600 + f * 160, 0.09, 'triangle', 0.1, 1.5); buzz(10); }
    }
    // bot: precise release once the planned rotation is done
    if (botOn && botPlan && !B.ground && B.accum >= botPlan.target) hold = false;
    // diamonds
    for (const d of diamonds) if (d.alive && Math.hypot(B.x - d.x, B.y - d.y) < 1.0 && state !== 'lost') {
      d.alive = false; score += 1; ui.score(score); sparks(d.x, d.y, '#ffffff', 16, 5, { up: 1, size: 0.07 }); sfx.coin(); buzz(8);
      ui.els.sc.style.transform = 'scale(1.18)'; setTimeout(() => ui.els.sc.style.transform = '', 90);
    }
    if (state === 'play') engine(true, (B.ground ? 46 + B.v * 4.5 : 80 + B.v * 3) + (holding ? 18 : 0));
    ui.progress((B.x - startX) / (gateX - startX));
  }
  // debris
  for (const d of debris) { d.vy -= G * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.rotation.z += d.w * dt; d.life -= dt; if (d.life < 0.6) d.m.scale.multiplyScalar(0.92); }
  debris = debris.filter(d => d.life > 0 || (scene.remove(d.m), false));

  // bike transform + squash
  B.squash = Math.max(0, B.squash - dt * 5);
  bike.position.set(B.x, B.y, 0); bike.rotation.z = B.ang;
  bike.scale.set(1 + B.squash * 0.18, 1 - B.squash * 0.22, 1);
  const spin = (B.ground ? B.v : 8) * dt / 0.2; for (const w of [WR, WF]) w.rotation.z -= spin;
  bike.updateMatrixWorld();
  const live = state !== 'lost' && state !== 'ready';
  for (const [tr, wh] of [[trails[0], WR], [trails[1], WF]]) { wh.getWorldPosition(_v); updateTrail(tr, _v.x, _v.y, live || state === 'ready' ? live : false); }

  // diamonds spin
  if (dMesh) { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); diamonds.forEach((d, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 2.5 + i); sc.setScalar(d.alive ? 1 + Math.sin(t * 5 + i) * 0.08 : 0); m.compose(_v.set(d.x, d.y, 0), q, sc); dMesh.setMatrixAt(i, m); }); dMesh.instanceMatrix.needsUpdate = true; }
  for (const s of saws) s.m.rotation.z -= dt * 7;
  if (gate && gate.flag) gate.flag.position.y = gate.y + 3.7 + Math.sin(t * 4) * 0.05;
  updateSparks(dt);

  // camera: bike sits in the left third, zooms out with speed, eases vertically
  const sp = B.ground ? B.v : Math.hypot(B.vx, B.vy);
  camZ = lerp(camZ, 33 + sp * 0.55, 1 - Math.exp(-dt * 2));
  const halfW = camZ * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
  if (state !== 'lost') { camX = lerp(camX, B.x + halfW * 0.36, 1 - Math.exp(-dt * 6)); camY = lerp(camY, B.y + 1.2 + (B.ground ? 0 : Math.min(2, Math.max(-3, B.vy * 0.15))), 1 - Math.exp(-dt * 3)); }
  shake = Math.max(0, shake - dt * 1.6);
  camera.position.set(camX + (Math.random() - 0.5) * shake * 0.6, camY + (Math.random() - 0.5) * shake * 0.6, camZ);
  camera.lookAt(camX, camY, 0);
  // parallax rock strips: wrap around the camera so they never run out
  const halfH = (camZ + 8) * Math.tan(camera.fov * Math.PI / 360);
  nearRocks.position.x = camX - ((camX * 0.45) % nearRocks.userData.tile) - nearRocks.userData.tile * 0.5; nearRocks.position.y = camY - halfH * 0.98;
  const halfH2 = (camZ + 70) * Math.tan(camera.fov * Math.PI / 360);
  farRocks.position.x = camX - ((camX * 0.8) % farRocks.userData.tile) - farRocks.userData.tile * 0.7; farRocks.position.y = camY - halfH2 * 0.75;
  // "+n" label follows the bike
  _v.set(B.x + 0.7, B.y + 0.9, 0).project(camera);
  plusEl.style.left = ((_v.x + 1) / 2 * innerWidth) + 'px'; plusEl.style.top = ((1 - _v.y) / 2 * innerHeight - 20) + 'px';
  bloom.render();
});

buildLevel();

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return; botOn = true;
    if (B.ground) { hold = true; botPlan = null; return; }
    if (!botPlan) {
      const p = predictAir(), avail = p.T - 0.42;
      const k = p.fall ? 0 : Math.floor((avail * 7.6 - 0.4) / (Math.PI * 2));
      botPlan = { target: k >= 1 ? k * Math.PI * 2 + wrap(p.ang - B.launchAng) - 0.55 : -1 };
    }
    hold = B.accum < botPlan.target;
  },
};

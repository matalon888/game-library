// Thrill Loop — original roller-coaster game. Hold to speed the train, release to brake.
// Loops and jumps need speed (green track), crests and hairpins throw riders out if you are too fast (red track).
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const V3 = THREE.Vector3;
const S = createStage({ fov: 52, shadowSize: 16 });
const { scene, camera, sun, hemi } = S;
hemi.intensity = 1.25; sun.intensity = 1.6;
const ui = createUI({ title: 'THRILL<br>LOOP', hint: 'Hold to speed up · let go to brake', hand: '👆', score: false });
const D = daily('thrillloop', ui, { name: 'Thrill Loop: Roller Coaster Ride' });
const save = store('thrillloop');
const F = flow('thrillloop');
const B = board({ game: 'thrill-loop', label: 'Rides completed', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });
let level = save.get('level', 1), best = save.get('best', 0), total = 0;

const THEMES = [
  { bg: ['#9fdcff', '#e9f8ff'], grass: '#8fdc7e', rail: '#ff4f7b', spine: '#c23a63', post: '#ffffff', cart: ['#ffd23f', '#3a86ff'], ui: '#ff4f7b', tree: '#4fbf6a' },
  { bg: ['#ffc6d9', '#fff0d6'], grass: '#9fe3a0', rail: '#7b5cff', spine: '#4f37c8', post: '#fff8ff', cart: ['#ff8c42', '#2ec4b6'], ui: '#7b5cff', tree: '#3fb27f' },
  { bg: ['#ffd9a8', '#fff6dc'], grass: '#b9e27a', rail: '#00a6fb', spine: '#0569a8', post: '#ffffff', cart: ['#ff4d6d', '#ffd23f'], ui: '#0582ca', tree: '#5fae4a' },
  { bg: ['#c9b8ff', '#ffe1f4'], grass: '#86dbb1', rail: '#ff8c42', spine: '#c45f1c', post: '#ffffff', cart: ['#7b5cff', '#52b788'], ui: '#ff8c42', tree: '#3aa776' },
];
let TH = THEMES[0];

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.tl-speed{position:fixed;left:18px;bottom:calc(26px + env(safe-area-inset-bottom));width:104px;height:104px;border-radius:50%;background:#fff;box-shadow:0 6px 0 rgba(0,0,0,.14),inset 0 0 0 7px var(--ring,#3ab795);z-index:6;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2b2d42;transition:box-shadow .15s}
.tl-speed b{font-size:40px;line-height:.9;font-weight:800}.tl-speed span{font-size:13px;font-weight:800;opacity:.6}
.tl-riders{position:fixed;right:16px;bottom:calc(36px + env(safe-area-inset-bottom));z-index:6;pointer-events:none;background:rgba(255,255,255,.85);color:#2b2d42;border-radius:22px;padding:6px 14px;font-weight:800;font-size:20px;box-shadow:0 4px 0 rgba(0,0,0,.12)}
.tl-riders small{font-size:13px;opacity:.6}
.tl-warn{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:6;pointer-events:none;font-weight:800;font-size:26px;padding:4px 18px;border-radius:24px;opacity:0;transition:opacity .15s;white-space:nowrap;box-shadow:0 4px 0 rgba(0,0,0,.14)}
.tl-warn.on{opacity:1;animation:tlw .5s ease-in-out infinite alternate}
@keyframes tlw{to{transform:translateX(-50%) scale(1.08)}}
.hc-pop{-webkit-text-stroke:5px rgba(40,30,70,.55);paint-order:stroke fill}
.hc-card h1{-webkit-text-stroke:3px rgba(40,30,70,.25);paint-order:stroke fill}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const speedEl = H('<div class="tl-speed"><b>0</b><span>km/h</span></div>');
const ridersEl = H('<div class="tl-riders">🙂 8<small>/8</small></div>');
const warnEl = H('<div class="tl-warn"></div>');

// ---------------------------------------------------------------- ground + scenery (rebuilt per level)
const G = 9.8, DS = 0.5;
scene.fog = new THREE.Fog('#e9f8ff', 70, 190);
const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat('#8fdc7e', { roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
let world = null;

// ---------------------------------------------------------------- track generation
// A turtle lays raw points ~1 m apart; flags mark jump gaps. Then we resample at DS and compute frames + speed bands.
let T = null;   // { pos[], tan[], up[], side[], vmin[], vmax[], gap[], len, finishS, n }
function genRaw(r, fk) {
  const raw = [], flags = [];
  const p = new V3(0, 3, 0); let yaw = 0;
  const dir = () => new V3(Math.sin(yaw), 0, -Math.cos(yaw)), right = () => new V3(Math.cos(yaw), 0, Math.sin(yaw));
  const push = (q, gap = 0) => { raw.push(q.clone()); flags.push(gap); };
  push(p);
  const seg = (n, fn, gapFn) => { const p0 = p.clone(), d = dir(), rt = right(); for (let k = 1; k <= n; k++) { const t = k / n, q = fn(t, p0, d, rt); push(q, gapFn ? gapFn(t) : 0); } p.copy(raw[raw.length - 1]); };
  const straight = (len, dy = 0) => seg(Math.max(2, Math.ceil(len)), (t, p0, d) => p0.clone().addScaledVector(d, len * t).add(new V3(0, dy * (3 * t * t - 2 * t * t * t), 0)));
  const hill = (len, h) => seg(Math.ceil(len), (t, p0, d) => p0.clone().addScaledVector(d, len * t).add(new V3(0, h * Math.sin(Math.PI * t) ** 2, 0)));
  const turn = (ang, R, dy = 0) => { const n = Math.ceil(Math.abs(ang) * R / 1.0), st = Math.abs(ang) * R / n, y0 = p.y; for (let k = 1; k <= n; k++) { yaw += ang / n; p.addScaledVector(dir(), st); const t = k / n; p.y = y0 + dy * (3 * t * t - 2 * t * t * t); push(p); } };
  const loopEl = (R) => { const W = 2.4, n = Math.ceil(Math.PI * 2 * R / 0.9); seg(n, (t, p0, d, rt) => { const th = t * Math.PI * 2; return p0.clone().addScaledVector(d, R * Math.sin(th)).add(new V3(0, R * (1 - Math.cos(th)), 0)).addScaledVector(rt, W * (th - Math.sin(th)) / (Math.PI * 2)); }); };
  const jump = (vJ) => {
    const a = 0.42, Lk = 7, ta = Math.tan(a), range = vJ * vJ * Math.sin(2 * a) / G;
    seg(Lk, (t, p0, d) => { const x = Lk * t; return p0.clone().addScaledVector(d, x).add(new V3(0, ta / (2 * Lk) * x * x, 0)); });
    const n = Math.ceil(range / 0.9);
    seg(n, (t, p0, d) => { const x = range * t; return p0.clone().addScaledVector(d, x).add(new V3(0, x * ta - G * x * x / (2 * vJ * vJ * Math.cos(a) ** 2), 0)); }, t => (t > 0.02 && t < 0.98) ? vJ : 0);
    seg(Lk, (t, p0, d) => { const x = Lk * t; return p0.clone().addScaledVector(d, x).add(new V3(0, -ta * x + ta / (2 * Lk) * x * x, 0)); });
  };
  const toward = (y) => clamp(y - p.y, -8, 8);
  straight(12);                                                 // station
  straight(8, -1.5);
  const n = Math.min(11, 4 + Math.floor(level * 0.7));
  const pool = ['hill', 'loop', 'turn'];
  if (level >= 2) pool.push('jump');
  if (level >= 3) pool.push('camel', 'loop');
  if (level >= 5) pool.push('helix', 'jump');
  let last = '';
  for (let i = 0; i < n; i++) {
    let e = i === 0 ? 'hill' : i === 1 ? 'loop' : pool[Math.floor(r() * pool.length)];
    if (e === last && r() < 0.6) e = pool[Math.floor(r() * pool.length)];
    last = e;
    if (e === 'hill') { straight(9 + r() * 4, toward(3)); hill(34 - r() * 4, (3.6 + r() * 1.6 + level * 0.12) * fk); }
    else if (e === 'camel') { straight(8, toward(3)); const h = (3.4 + r() * 1.2) * fk; hill(30, h); hill(28, h * 1.1); }
    else if (e === 'loop') { straight(10, toward(5)); straight(10, 1.6 - p.y); loopEl(clamp((4.0 + r() * 1.5 + level * 0.1) * fk, 3.6, 8)); straight(6); }
    else if (e === 'turn') { straight(8, toward(4)); const s = r() < 0.5 ? 1 : -1; turn(s * (Math.PI * (0.55 + r() * 0.4)), clamp((15 - level * 0.35 - r() * 2) / fk, 8, 17), (r() - 0.5) * 4); }
    else if (e === 'helix') { straight(8, toward(10)); const s = r() < 0.5 ? 1 : -1; turn(s * Math.PI * 1.6, clamp(11 / fk, 8, 14), -6); }
    else if (e === 'jump') { straight(10, toward(4)); jump(clamp((12.5 + r() * 2.5 + level * 0.15) * fk, 11, 19)); straight(6); }
  }
  straight(12, toward(3)); const finishRaw = raw.length; straight(14); straight(34);
  return { raw, flags, finishRaw };
}

function buildTrack(r, fk) {
  const { raw, flags, finishRaw } = genRaw(r, fk);
  const curve = new THREE.CatmullRomCurve3(raw, false, 'centripetal');
  // dense polyline with flags, then uniform resample at DS
  const dense = [], df = [], dfin = []; const sub = 4, N = raw.length - 1;
  for (let i = 0; i < N; i++) for (let k = 0; k < sub; k++) { dense.push(curve.getPoint((i + k / sub) / N)); df.push(Math.max(flags[i], flags[i + 1])); dfin.push(i >= finishRaw ? 1 : 0); }
  dense.push(raw[N].clone()); df.push(0); dfin.push(1);
  const pos = [], gap = []; let acc = 0, finishS = 0; pos.push(dense[0].clone()); gap.push(0);
  let target = DS;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i], l = a.distanceTo(b);
    while (acc + l >= target) { const t = (target - acc) / l; pos.push(a.clone().lerp(b, t)); gap.push(df[i]); if (dfin[i] && !finishS) finishS = target; target += DS; }
    acc += l;
  }
  const n = pos.length, tan = [], up = [], side = [], kv = [];
  for (let i = 0; i < n; i++) tan.push(pos[Math.min(n - 1, i + 1)].clone().sub(pos[Math.max(0, i - 1)]).normalize());
  let u = new V3(0, 1, 0);
  for (let i = 0; i < n; i++) { u = u.clone().addScaledVector(tan[i], -u.dot(tan[i])).normalize(); up.push(u); side.push(new V3().crossVectors(tan[i], u).normalize()); }
  for (let i = 0; i < n; i++) { const a = tan[Math.max(0, i - 2)], b = tan[Math.min(n - 1, i + 2)]; kv.push(b.clone().sub(a).divideScalar(4 * DS)); }
  // smooth curvature (resampling noise)
  const ks = kv.map((_, i) => { const s = new V3(); let c = 0; for (let j = -3; j <= 3; j++) { const q = kv[i + j]; if (q) { s.add(q); c++; } } return s.divideScalar(c); });
  const vmin = [], vmax = [];
  for (let i = 0; i < n; i++) {
    let lo = 0, hi = 40;
    if (gap[i]) { lo = gap[i] * 0.86; }
    else {
      const A = ks[i].dot(up[i]), B = G * up[i].y;
      if (up[i].y < 0.25) { if (A > 1e-4) lo = Math.sqrt(Math.max(0, -B / A)); }            // inverted: must press into the seat or the train falls
      else if (A < -1e-4) hi = Math.sqrt((B + 0.3 * G) / -A);                                    // crest: airtime ejects riders
      const As = Math.abs(ks[i].dot(side[i])); if (As > 1e-4 && up[i].y > 0.85) hi = Math.min(hi, Math.sqrt(1.45 * G / As));
    }
    vmin.push(lo); vmax.push(Math.max(6, hi));
  }
  T = { pos, tan, up, side, vmin, vmax, gap, n, len: (n - 1) * DS, finishS };
}

function frameAt(s, out) {
  const f = clamp(s / DS, 0, T.n - 1.001), i = Math.floor(f), t = f - i;
  out.p.copy(T.pos[i]).lerp(T.pos[i + 1], t); out.t.copy(T.tan[i]).lerp(T.tan[i + 1], t).normalize();
  out.u.copy(T.up[i]).lerp(T.up[i + 1], t).normalize(); out.s.crossVectors(out.t, out.u).normalize(); return out;
}

// ---------------------------------------------------------------- meshes
const tieGeo = new THREE.BoxGeometry(1.25, 0.12, 0.26), postGeo = new THREE.CylinderGeometry(0.11, 0.14, 1, 8);
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.4, 7), crownGeo = new THREE.IcosahedronGeometry(1.3, 1);
function buildWorld(r) {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry && o.geometry !== tieGeo && o.geometry !== postGeo && o.geometry !== trunkGeo && o.geometry !== crownGeo) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  const railM = glossy(TH.rail), spineM = mat(TH.spine), postM = mat(TH.post);
  // rails: one tube per contiguous non-gap run, two rails + a spine
  const runs = []; let cur = null;
  for (let i = 0; i < T.n; i++) { if (!T.gap[i]) { if (!cur) runs.push(cur = []); cur.push(i); } else cur = null; }
  for (const run of runs) {
    if (run.length < 3) continue;
    for (const [off, dn, rad, m] of [[0.5, 0, 0.09, railM], [-0.5, 0, 0.09, railM], [0, -0.26, 0.13, spineM]]) {
      const pts = run.map(i => T.pos[i].clone().addScaledVector(T.side[i], off).addScaledVector(T.up[i], dn));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.min(1600, pts.length), rad, 6, false), m);
      tube.castShadow = true; world.add(tube);
    }
  }
  // ties: coloured by what the track asks of you
  const tieIdx = []; for (let i = 0; i < T.n; i += 2) if (!T.gap[i]) tieIdx.push(i);
  const ties = new THREE.InstancedMesh(tieGeo, mat('#ffffff'), tieIdx.length); ties.castShadow = true;
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), RED = new THREE.Color('#ff3b3b'), GRN = new THREE.Color('#2fd36b'), WHT = new THREE.Color('#ffffff'), GLD = new THREE.Color('#ffd23f');
  tieIdx.forEach((i, k) => {
    const z = T.tan[i].clone().negate(); m4.makeBasis(T.side[i], T.up[i], z).setPosition(T.pos[i].clone().addScaledVector(T.up[i], -0.12)); ties.setMatrixAt(k, m4);
    let near = 0; for (let j = Math.max(0, i - 6); j < Math.min(T.n, i + 6); j++) { if (T.vmin[j] > 4 || T.gap[Math.min(T.n - 1, j + 3)]) near = 1; }
    const s = i * DS;
    c.copy(s >= T.finishS - 1 && s < T.finishS + 14 ? GLD : near ? GRN : T.vmax[i] < 15 ? RED : WHT); ties.setColorAt(k, c);
  });
  world.add(ties);
  // supports
  const sup = []; for (let i = 0; i < T.n; i += 7) { if (T.up[i].y > 0.6 && !T.gap[i] && T.pos[i].y > 0.9) sup.push(i); }
  const posts = new THREE.InstancedMesh(postGeo, postM, sup.length * 2); posts.castShadow = true;
  let k = 0;
  for (const i of sup) for (const off of [-0.5, 0.5]) {
    const p = T.pos[i].clone().addScaledVector(T.side[i], off), h = p.y - 0.15;
    m4.makeScale(1, h, 1).setPosition(p.x, h / 2, p.z); posts.setMatrixAt(k++, m4);
  }
  world.add(posts);
  // station: platform + striped canopy beside the start straight
  const st = new THREE.Group(), f0 = frameAt(8, { p: new V3(), t: new V3(), u: new V3(), s: new V3() });
  const deck = new THREE.Mesh(rounded(2.2, 0.5, 15, 0.15), mat('#fff4e6')); deck.position.set(1.85, -0.55, 0); deck.receiveShadow = true; deck.castShadow = true; st.add(deck);
  for (let k = 0; k < 5; k++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 3), mat(k % 2 ? '#ffd23f' : TH.rail)); fl.rotation.x = Math.PI; fl.position.set(2.6, 0.2, -6 + k * 3); fl.castShadow = true; st.add(fl); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), mat('#ffffff')); pole.position.set(2.6, -0.1, -6 + k * 3); st.add(pole); }
  st.position.copy(f0.p); st.rotation.y = Math.atan2(-f0.t.x, -f0.t.z); world.add(st);
  const fa = frameAt(T.finishS, { p: new V3(), t: new V3(), u: new V3(), s: new V3() });
  const arch = new THREE.Group(), am = glossy('#ffd23f'), am2 = mat('#ffffff');
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.2, 10), am), pR = pL.clone(); pL.position.set(-2.1, 2.1, 0); pR.position.set(2.1, 2.1, 0);
  const beam = new THREE.Mesh(rounded(5, 0.9, 0.5, 0.2), am2); beam.position.y = 4.3;
  const ck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 0.52), mat(TH.rail)); ck.position.y = 4.3;
  arch.add(pL, pR, beam, ck); arch.traverse(o => o.castShadow = true);
  arch.position.copy(fa.p).add(new V3(0, -0.4, 0)); arch.lookAt(fa.p.clone().add(new V3(fa.t.x, 0, fa.t.z)).add(new V3(0, -0.4, 0))); world.add(arch);
  // trees + balloons away from the track
  const grid = new Set(); const key = (x, z) => Math.floor(x / 4) + ',' + Math.floor(z / 4);
  for (let i = 0; i < T.n; i += 2) { const p = T.pos[i]; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) grid.add(key(p.x + dx * 4, p.z + dz * 4)); }
  const bb = new THREE.Box3().setFromPoints(T.pos); bb.expandByScalar(26);
  const treeP = [];
  for (let tries = 0; tries < 900 && treeP.length < 110; tries++) {
    const x = lerp(bb.min.x, bb.max.x, r()), z = lerp(bb.min.z, bb.max.z, r());
    if (!grid.has(key(x, z))) treeP.push([x, z, 0.7 + r() * 0.8]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, mat('#9a6b4a'), treeP.length), crowns = new THREE.InstancedMesh(crownGeo, mat(TH.tree, { flatShading: true }), treeP.length);
  crowns.castShadow = true; const tc = new THREE.Color(TH.tree), tc2 = new THREE.Color('#9be06b');
  treeP.forEach(([x, z, s], i) => { m4.makeScale(s, s, s).setPosition(x, 0.7 * s, z); trunks.setMatrixAt(i, m4); m4.makeScale(s, s * 1.15, s).setPosition(x, 2.2 * s, z); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, c.copy(tc).lerp(tc2, (i * 37 % 10) / 14)); });
  world.add(trunks, crowns);
}

// ---------------------------------------------------------------- train
const CARTS = 4, SPACING = 1.85, SKIN = ['#ffd7ba', '#f1c27d', '#c68642', '#8d5524', '#ffe0cc'], SHIRTS = ['#ff5d8f', '#3a86ff', '#ffd23f', '#52b788', '#7b5cff', '#ff8c42', '#2ec4b6', '#ffffff'];
let carts = [], riders = [], flying = [], fallen = [];
const headGeo = new THREE.SphereGeometry(0.2, 16, 12), bodyGeo = new THREE.CapsuleGeometry(0.17, 0.28, 4, 10), armGeo = new THREE.CapsuleGeometry(0.055, 0.32, 3, 6), hairGeo = new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2);
function makeRider(i) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, mat(SHIRTS[i % SHIRTS.length])); body.position.y = 0.32;
  const head = new THREE.Mesh(headGeo, mat(SKIN[(i * 3) % SKIN.length])); head.position.y = 0.72;
  const hair = new THREE.Mesh(hairGeo, mat(['#2b2d42', '#6b3e26', '#f5c542', '#d1495b', '#3d3a4b'][i % 5])); hair.position.y = 0.75; hair.rotation.x = -0.25;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.02), mat('#2b2d42')); eyes.position.set(0, 0.74, -0.19);
  const aL = new THREE.Group(), aR = new THREE.Group(), al = new THREE.Mesh(armGeo, body.material), ar = al.clone();
  al.position.y = 0.2; ar.position.y = 0.2; aL.add(al); aR.add(ar); aL.position.set(-0.17, 0.48, 0); aR.position.set(0.17, 0.48, 0);
  g.add(body, head, hair, eyes, aL, aR); g.traverse(o => o.castShadow = true);
  g.aL = aL; g.aR = aR; g.head = head; g.ph = Math.random() * 6; return g;
}
function buildTrain() {
  for (const c of carts) scene.remove(c); for (const f of flying) scene.remove(f.g); for (const f of fallen) scene.remove(f.g);
  carts = []; riders = []; flying = []; fallen = [];
  for (let i = 0; i < CARTS; i++) {
    const c = new THREE.Group();
    const shell = new THREE.Mesh(rounded(1.3, 0.62, 1.55, 0.2), glossy(TH.cart[i % 2])); shell.position.y = 0.36; shell.rotation.x = -Math.PI / 2; shell.rotation.x = 0;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.12, 1.4), mat('#ffffff')); stripe.position.y = 0.42;
    const wheels = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 1.2), mat('#3d3a4b')); wheels.position.y = 0.0;
    c.add(shell, stripe, wheels);
    if (i === 0) { const nose = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glossy(TH.cart[0])); nose.rotation.x = -Math.PI / 2; nose.scale.set(1.35, 1, 0.8); nose.position.set(0, 0.4, -0.78); c.add(nose); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#fff6b0', { emissive: '#ffd23f', emissiveIntensity: 0.8 })); lamp.position.set(0, 0.55, -1.08); c.add(lamp); }
    for (const z of [-0.33, 0.37]) for (const x of [-0.29, 0.29]) if (Math.abs(z) > 0) { /* seats */ }
    for (const z of [-0.3, 0.35]) { for (const x of [-0.3, 0.3]) { if (riders.length >= CARTS * 2 && false) break; } }
    const rs = [makeRider(i * 2), makeRider(i * 2 + 1)];
    rs[0].position.set(-0.28, 0.42, 0.05); rs[1].position.set(0.28, 0.42, 0.05);
    rs.forEach(rd => { c.add(rd); riders.push(rd); });
    c.traverse(o => { o.castShadow = true; }); scene.add(c); carts.push(c);
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', s = 0, v = 0, holding = false, ejectCd = 0, need = 4, aboard = 8, time = 0, topV = 0, beatenShown = false, recorded = false, shake = 0, camHead = new V3(0, 0, -1), whoosh = 0;
const camPos = new V3(), camLook = new V3();
const fr = { p: new V3(), t: new V3(), u: new V3(), s: new V3() };

function buildLevel() {
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', TH.ui);
  scene.fog.color.set(TH.bg[1]); ground.material.color.set(TH.grass);
  const seed = D.seed ? D.seed : level * 7919 + 13, r = rng(seed), fk = F.k();
  buildTrack(r, fk); buildWorld(r); buildTrain();
  state = 'ready'; s = 2; v = 0; holding = false; ejectCd = 0; time = 0; topV = 0; recorded = false; shake = 0;
  aboard = riders.length; need = Math.min(riders.length - 1, 3 + Math.floor(level / 3));
  ui.levels(level); ui.progress(0); ui.sub(total ? `SCORE ${total}` + (best > total ? ` · BEST ${best}` : '') : best ? 'BEST ' + best : '');
  updateRiders(); placeTrain(1);
  frameAt(s, fr); camHead.set(fr.t.x, 0, fr.t.z).normalize();
  camPos.copy(fr.p).addScaledVector(camHead, -13).addScaledVector(new V3(-camHead.z, 0, camHead.x), 4.5); camPos.y = fr.p.y * 0.6 + 10.5; camLook.copy(fr.p).addScaledVector(camHead, 5);
}
function updateRiders() { ridersEl.innerHTML = `${aboard >= need + 2 ? '😄' : aboard > need ? '😬' : '😱'} ${aboard}<small>/${riders.length} · need ${need}</small>`; }

function placeTrain(dt) {
  for (let i = 0; i < carts.length; i++) {
    const c = carts[i]; if (c.userData.off) continue;
    frameAt(Math.max(0, s - i * SPACING), fr);
    c.position.copy(fr.p).addScaledVector(fr.u, 0.18);
    const m = new THREE.Matrix4().makeBasis(fr.s, fr.u, fr.t.clone().negate()); c.quaternion.setFromRotationMatrix(m);
  }
  const tt = performance.now() / 1000, ex = clamp(v / 22, 0, 1);
  for (const rd of riders) { if (rd.userData.gone) continue; const w = Math.sin(tt * 9 + rd.ph); const a = lerp(2.6, 0.3, ex); rd.aL.rotation.z = a + w * 0.3 * ex; rd.aR.rotation.z = -a - w * 0.3 * ex; rd.head.rotation.x = -ex * 0.3; }
}

function ejectOne() {
  const left = riders.filter(r => !r.userData.gone); if (!left.length) return;
  const rd = left[Math.floor(Math.random() * left.length)]; rd.userData.gone = true;
  const wp = new V3(), wq = new THREE.Quaternion(); rd.getWorldPosition(wp); rd.getWorldQuaternion(wq);
  rd.parent.remove(rd); scene.add(rd); rd.position.copy(wp); rd.quaternion.copy(wq);
  frameAt(s, fr);
  const vel = fr.t.clone().multiplyScalar(v * 0.7).addScaledVector(fr.u, 6 + Math.random() * 3).addScaledVector(fr.s, (Math.random() - 0.5) * 8);
  flying.push({ g: rd, vel, spin: new V3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
  aboard--; updateRiders(); shake = 0.5;
  tone(500, 0.35, 'triangle', 0.14, 2.4); buzz(30); ui.pop(['WHOA!', 'AAAH!', 'BYE!', 'OOPS!'][Math.floor(Math.random() * 4)], '#ff4d6d', 38, 30);
  burst(scene, wp, ['#ffffff', '#ffd23f'], 8, { speed: 0.12, up: 0.1, size: 0.6 });
  if (aboard < need) lose('RIDERS LOST!', `Only ${aboard} of ${riders.length} left, needed ${need}`);
}

function derail() {
  frameAt(s, fr);
  const vel = fr.t.clone().multiplyScalar(Math.max(2, v));
  for (const c of carts) { c.userData.off = true; fallen.push({ g: c, vel: vel.clone().add(new V3((Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3)), spin: new V3(Math.random() * 3, Math.random() * 3, Math.random() * 3) }); }
  sfx.smash(); buzz([50, 40, 80]); shake = 1; ui.flash(0.5);
  lose('TOO SLOW!', T.gap[Math.floor(s / DS)] ? 'Hit the jump with more speed' : 'Loops need speed at the top');
}

function finishRecord(won, frac) { if (recorded) return; recorded = true; F.level(won, frac); }
function lose(t, line) {
  if (state !== 'play') return; state = 'lost'; holding = false;
  finishRecord(false, clamp(s / T.finishS, 0, 1)); sfx.fail();
  ui.lose(t, line); total = 0;
}
function win() {
  state = 'won'; holding = false; finishRecord(true); B.submit(1);
  const pts = aboard * 10 * level + Math.round(topV * 3.6);
  total += pts; best = Math.max(best, total); save.set('best', best);
  level++; save.set('level', level);
  ui.sub(`SCORE ${total}`); ui.flash(0.6); sfx.win(); buzz([20, 40, 20]);
  confetti(scene, carts[0].position.clone().add(new V3(0, 2, 0)), 80);
  setTimeout(() => confetti(scene, carts[0].position.clone().add(new V3(0, 3, 0)), 60), 250);
  ui.pop(aboard === riders.length ? 'PERFECT RIDE!' : `${aboard} RIDERS SAFE`, '#ffd23f', 40, 30);
  D.won(total);
  ui.win(level - 1, `${aboard}/${riders.length} riders · top ${Math.round(topV * 3.6)} km/h · +${pts}`);
}

ui.onTap(which => {
  if (which === 'start') { state = 'play'; sfx.tap(); }
  else if (which === 'win') { buildLevel(); state = 'play'; }
  else if (which === 'lose') { buildLevel(); state = 'play'; }
  B.start();
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on ride 1, until the first real touch,
// the coaster holds and lets go of the throttle by itself for about 4.5 s (the bot's own speed rule); if nobody touched, it is
// then rewound to the station at rest, exactly where an untouched ride waits, so the demo never strands it before a loop
const DM = demo(null, { ready: () => state === 'play' && level === 1, wait: 1000, ms: 4500 });
let demoWas = false, demoAboard = 0;
function demoDrive() {
  if (DM.on) { if (!demoWas) demoAboard = aboard; demoWas = true; const { cap, needV } = ahead(); holding = needV > v ? true : v < cap - 0.4; }
  else if (demoWas) { demoWas = false; if (!DM.touched && aboard === demoAboard) { holding = false; s = 2; v = 0; time = 0; topV = 0; ejectCd = 0; } }
}
input({ onDown: () => { if (state === 'play') { holding = true; sfx.tap(); } }, onUp: () => { holding = false; } });

// ---------------------------------------------------------------- loop
const tmpV = new V3();
loop((dt, t) => {
  const dts = dt / 60;
  if (state === 'play') {
    demoDrive();
    time += dts;
    frameAt(s, fr);
    const acc = (holding ? 10 : -7.5) - G * fr.t.y - 0.0035 * v * v;
    v = clamp(v + acc * dts, s < 10 && !holding && v < 0.5 ? 0 : 2.2, 33);
    s += v * dts; topV = Math.max(topV, v);
    const i = Math.min(T.n - 1, Math.floor(s / DS));
    if (v < T.vmin[i]) derail();
    else if (v > T.vmax[i] + 0.4) { ejectCd -= dts; if (ejectCd <= 0) { ejectCd = 0.22; ejectOne(); } }
    else ejectCd = Math.min(ejectCd, 0.05);
    if (state === 'play' && s >= T.finishS) win();
    ui.progress(s / T.finishS);
    if (D.beaten(total) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 44, 26); confetti(scene, carts[0].position, 50); }
    // look-ahead warning: only when it's actually time to act (braking distance / speed you'll need)
    const { cap, needV } = ahead();
    if (needV > v + 0.5) { warnEl.textContent = 'HOLD! NEED SPEED'; warnEl.style.background = '#2fd36b'; warnEl.classList.add('on'); }
    else if (v > cap + 0.8) { warnEl.textContent = 'LET GO! TOO FAST'; warnEl.style.background = '#ff3b3b'; warnEl.classList.add('on'); }
    else warnEl.classList.remove('on');
    whoosh -= dts; if (holding && whoosh <= 0) { whoosh = 0.12; tone(90 + v * 9, 0.12, 'sawtooth', 0.025, 1.05); }
  } else { warnEl.classList.remove('on'); if (state === 'won') { v = Math.max(0, v - 14 * dts); s += v * dts; } }
  if (state !== 'lost') placeTrain(dt);
  const kmh = Math.round(v * 3.6); speedEl.querySelector('b').textContent = kmh;
  const ii = Math.min(T.n - 1, Math.floor(s / DS));
  speedEl.style.setProperty('--ring', v > T.vmax[ii] - 1 ? '#ff3b3b' : holding ? '#ffd23f' : '#3ab795');
  // flying riders + falling carts
  for (const f of [...flying, ...fallen]) {
    if (f.g.position.y > 0.2) { f.vel.y -= G * dts; f.g.position.addScaledVector(f.vel, dts); f.g.rotation.x += f.spin.x * dts; f.g.rotation.y += f.spin.y * dts; f.g.rotation.z += f.spin.z * dts; }
    else if (!f.landed) { f.landed = true; f.g.position.y = 0.2; burst(scene, f.g.position.clone(), [TH.grass, '#ffffff'], 10, { speed: 0.1, up: 0.08, size: 0.6 }); if (fallen.includes(f)) { sfx.smash(); shake = 0.7; } }
  }
  // camera: chase from behind-right, eased; horizontal heading only so loops don't spin the view
  const lead = carts[0];
  frameAt(Math.max(0, s - SPACING), fr);
  tmpV.set(fr.t.x, 0, fr.t.z); if (tmpV.lengthSq() > 0.04) camHead.lerp(tmpV.normalize(), 0.04 * dt).normalize();
  const rightV = new V3(-camHead.z, 0, camHead.x);
  const focus = (state === 'lost' && fallen.length) ? fallen[0].g.position : lead.position;
  const back = 13 + v * 0.18;
  const want = focus.clone().addScaledVector(camHead, -back).addScaledVector(rightV, 4.5); want.y = focus.y * 0.6 + 10.5;
  camPos.lerp(want, 0.07 * dt); camLook.lerp(focus.clone().addScaledVector(camHead, 5), 0.12 * dt);
  shake = Math.max(0, shake - 0.04 * dt);
  camera.position.copy(camPos).add(new V3((Math.random() - .5) * shake * 0.5, (Math.random() - .5) * shake * 0.5, 0));
  camera.lookAt(camLook);
  S.followLight(focus);
});

buildLevel();
ui.start();

// what the track ahead allows: the fastest speed you can still brake down from, and the speed you need to carry
function ahead() {
  const i = Math.min(T.n - 1, Math.floor(s / DS)), look = Math.ceil(Math.max(20, v * 2.4) / DS), yNow = T.pos[i].y;
  let cap = 99, needV = 0;
  for (let j = i; j < Math.min(T.n, i + look); j++) {
    const d = (j - i) * DS;
    cap = Math.min(cap, Math.sqrt(Math.max(0, (T.vmax[j] - 1.4) ** 2 + 2 * 5 * d)));
    if (T.vmin[j] > 0) needV = Math.max(needV, Math.sqrt(Math.max(0, (T.vmin[j] + 1.2) ** 2 + 2 * G * (T.pos[j].y - yNow) - 2 * 8 * d)));
  }
  return { cap, needV };
}
// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() { if (state !== 'play') return; const { cap, needV } = ahead(); holding = needV > v ? true : v < cap - 0.4; },
};

// Backyard Plop — original bean bag toss duel. Drag up from the bag (further = harder, sideways = aim), let go to toss.
// In the hole = 3, on the board = 1. Four bags each, you and a backyard rival take turns; bags knock each other around.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { canvasTex } from './geo.js';

const NAME = 'Backyard Plop: Bean Bag Toss';
const S = createStage({ fov: 31, shadowSize: 12 });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.6; hemi.intensity = 1.25;
const ui = createUI({ title: 'BACKYARD<br>PLOP', hint: 'Tap where to toss · or drag up and let go', hand: '👆', score: false });
const D = daily('backyardplop', ui, { name: NAME });
const B = board({ game: 'backyard-plop', label: 'Wins', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });   // world board: wins today (RULES.md)
const save = store('backyardplop');
const F = flow('backyardplop');
let level = save.get('level', 1);

const css = document.createElement('style'); css.textContent = `
.hc-pop{-webkit-text-stroke:6px rgba(40,50,90,.45);paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(40,50,90,.3)}
.bp-board{position:fixed;top:calc(56px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:5;pointer-events:none;font-weight:800}
.bp-side{display:flex;flex-direction:column;align-items:center;min-width:92px}
.bp-name{font-size:14px;padding:1px 10px;border-radius:10px;background:rgba(0,0,0,.22);white-space:nowrap}
.bp-pts{font-size:46px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.15)}
.bp-bags{font-size:13px;letter-spacing:3px;height:16px}
.bp-vs{font-size:20px;opacity:.85}
.bp-turn{outline:3px solid #fff;outline-offset:2px}
.bp-wind{position:fixed;top:calc(160px + env(safe-area-inset-top));left:0;right:0;text-align:center;font-weight:800;font-size:16px;z-index:5;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.2)}
`; document.head.appendChild(css);
const sb = document.createElement('div'); sb.className = 'bp-board';
sb.innerHTML = `<div class="bp-side"><div class="bp-name" data-n0 style="background:#ff5d5d">YOU</div><div class="bp-pts" data-p0>0</div><div class="bp-bags" data-b0></div></div><div class="bp-vs">vs</div><div class="bp-side"><div class="bp-name" data-n1 style="background:#3a86ff">DALE</div><div class="bp-pts" data-p1>0</div><div class="bp-bags" data-b1></div></div>`;
document.body.appendChild(sb);
const windEl = document.createElement('div'); windEl.className = 'bp-wind'; document.body.appendChild(windEl);

// ---------------------------------------------------------------- dimensions (feet)
const G = 32, BW = 1.0, BL = 4, HF = 0.28, HB = 1.05, HOLE_V = 3.2, HOLE_R = 0.3, BAG = 0.27, MU = 0.5;
let ZF = -11;                                        // board front edge z (further each level)
const SLOPE = Math.atan2(HB - HF, BL);
const surfY = (v) => HF + v * (HB - HF) / BL + 0.06;
const COLORS = ['#ff5d5d', '#3a86ff'];
const RIVALS = ['DALE', 'MO', 'AUNT JO', 'COACH RAY', 'LIL PETE', 'BIG SUE', 'NANA', 'TEX'];

// ---------------------------------------------------------------- yard
const THEMES = [
  { sky: ['#8fd3ff', '#e8f8ff'], g1: '#86d35f', g2: '#7cc957', fence: '#e3b07a', board: ['#ffffff', '#ff8fab'], trim: '#2b2d42' },
  { sky: ['#ffb38a', '#fff0cf'], g1: '#9ccf5a', g2: '#92c552', fence: '#d99a66', board: ['#fff7e0', '#3ab795'], trim: '#3a2e39' },
  { sky: ['#b8a6ff', '#ffe3f3'], g1: '#78d68e', g2: '#6ecc84', fence: '#cfa0e0', board: ['#ffffff', '#7b5cff'], trim: '#22223b' },
  { sky: ['#7fe0d0', '#f0fff6'], g1: '#8ad65a', g2: '#80cc50', fence: '#e8b980', board: ['#fffbe8', '#ff8c42'], trim: '#2b2d42' },
];
let TH = THEMES[0];
const yard = new THREE.Group(); scene.add(yard);
function stripeTex(a, b) { return canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * 32, w, 32); } }, true); }
function boardTex(a, b, trim) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.5, h * 0.42); g.lineTo(w, h); g.fill();   // chevron
    g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 1; i < 6; i++) g.fillRect(i * w / 6, 0, 2, h);           // planks
    g.fillStyle = b; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 50, a2 = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(w / 2 + Math.cos(a2) * r, h * 0.72 + Math.sin(a2) * r); } g.fill();   // little star
    g.strokeStyle = trim; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
    const hy = (1 - HOLE_V / BL) * h, hr = HOLE_R / (BW * 2) * w;     // the hole
    g.fillStyle = '#15121f'; g.beginPath(); g.arc(w / 2, hy, hr, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, hy, hr + 3, 0, 7); g.stroke();
  });
}
const boardG = new THREE.Group(); scene.add(boardG);
function buildYard() {
  yard.clear(); boardG.clear();
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat('#ffffff', { map: stripeTex(TH.g1, TH.g2) })); grass.material.map.repeat.set(1, 10); grass.rotation.x = -Math.PI / 2; grass.position.z = -20; grass.receiveShadow = true; yard.add(grass);
  // lawn tufts + daisies so the grass reads as a real yard
  { const r = rng(level * 17 + 3), N = 180, tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.26, 3), mat(TH.g2).clone(), N * 3), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 4), mat('#ffffff'), 60), q = new THREE.Matrix4(), e = new THREE.Euler(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    tuft.material.color.offsetHSL(0, 0.05, -0.1);
    const onBoard = (x, z) => Math.abs(x) < BW + 0.3 && z < ZF + 0.3 && z > ZF - BL - 0.3;
    for (let i = 0; i < N; i++) { const x = (r() - 0.5) * 16, z = lerp(ZF - 11, 7, r()); for (let k = 0; k < 3; k++) { if (onBoard(x, z)) q.makeScale(0, 0, 0); else q.compose(v.set(x + (k - 1) * 0.05, 0.11, z), qq.setFromEuler(e.set((r() - 0.5) * 0.5, 0, (k - 1) * 0.45)), one); tuft.setMatrixAt(i * 3 + k, q); } }
    for (let i = 0; i < 60; i++) { const x = (r() - 0.5) * 16, z = lerp(ZF - 11, 7, r()); if (onBoard(x, z)) q.makeScale(0, 0, 0); else q.makeTranslation(x, 0.05, z); fl.setMatrixAt(i, q); fl.setColorAt(i, new THREE.Color(i % 3 ? '#ffffff' : '#ffd23f')); }
    yard.add(tuft, fl); }
  // fence
  const fm = mat(TH.fence), pick = new THREE.BoxGeometry(0.9, 4.2, 0.2);
  const fence = new THREE.InstancedMesh(pick, fm, 60); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) { m4.makeTranslation(-30 + i * 1.0, 2.1 + (i % 2) * 0.15, ZF - 13); fence.setMatrixAt(i, m4); } fence.castShadow = true; fence.receiveShadow = true; yard.add(fence);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 0.2), mat(TH.fence).clone()); rail.material.color.offsetHSL(0, 0, -0.08); rail.position.set(0, 3.2, ZF - 12.85); yard.add(rail);
  // trees peeking over the fence
  for (const [x, s] of [[-9, 3.4], [-4.5, 2.6], [6, 3.8], [11, 3]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), mat('#4fbf74')); c.position.set(x, 4.5 + s * 0.6, ZF - 16); yard.add(c); }
  // string lights over the yard
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3b0' }), 40);
  for (let i = 0; i < 40; i++) { const u = i / 39, x = lerp(-7, 7, u), y = 6.5 - Math.sin(u * Math.PI) * 1.2; m4.makeTranslation(x, y, ZF - 6); bulbs.setMatrixAt(i, m4); } yard.add(bulbs);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-7, 6.5, ZF - 6), new THREE.Vector3(0, 5.3, ZF - 6), new THREE.Vector3(7, 6.5, ZF - 6)]), 20, 0.02, 4), mat('#3a3a4a')); yard.add(wire);
  // lawn chairs + a cooler at the side
  const chair = (x, z, col) => { const c = new THREE.Group(); const seat = new THREE.Mesh(rounded(1.3, 0.12, 1.2, 0.05), mat(col)); seat.position.y = 0.9; const back = new THREE.Mesh(rounded(1.3, 1.3, 0.12, 0.05), mat(col)); back.position.set(0, 1.5, -0.6); back.rotation.x = -0.3; c.add(seat, back); for (const sx of [-0.6, 0.6]) for (const sz of [-0.5, 0.5]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), mat('#dddddd')); l.position.set(sx, 0.45, sz); c.add(l); } c.position.set(x, 0, z); c.rotation.y = x > 0 ? -0.7 : 0.7; c.traverse(o => o.castShadow = true); yard.add(c); };
  chair(-5.2, ZF - 2, '#ffd23f'); chair(5.4, ZF - 3, '#3ab795');
  const cooler = new THREE.Mesh(rounded(1.2, 0.8, 0.8, 0.12), glossy('#3a86ff')); cooler.position.set(4.2, 0.4, ZF + 2); cooler.castShadow = true; const lid = new THREE.Mesh(rounded(1.24, 0.2, 0.84, 0.08), mat('#ffffff')); lid.position.set(4.2, 0.88, ZF + 2); yard.add(cooler, lid);
  // board: tilted slab with its own art, legs at the back
  const top = new THREE.Mesh(new THREE.BoxGeometry(BW * 2, 0.12, BL), [mat(TH.trim), mat(TH.trim), mat('#ffffff', { map: boardTex(TH.board[0], TH.board[1], TH.trim) }), mat(TH.trim), mat(TH.trim), mat(TH.trim)]);
  top.castShadow = true; top.receiveShadow = true;
  const slab = new THREE.Group(); slab.add(top); slab.rotation.x = SLOPE; slab.position.set(0, (HF + HB) / 2, ZF - BL / 2); boardG.add(slab);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, HB, 0.12), mat(TH.trim)); leg.position.set(s * (BW - 0.1), HB / 2, ZF - BL + 0.15); leg.castShadow = true; boardG.add(leg); const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, BL), mat(TH.trim)); side.rotation.x = SLOPE; side.position.set(s * (BW - 0.05), (HF + HB) / 2 - 0.18, ZF - BL / 2); boardG.add(side); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HOLE_R + 0.02, 0.025, 6, 32), mat('#ffffff')); ring.rotation.x = Math.PI / 2 + SLOPE; ring.position.set(0, surfY(HOLE_V) - 0.02, ZF - HOLE_V); boardG.add(ring);
}

// ---------------------------------------------------------------- people (round backyard folks: caps, no faces needed from behind)
function person(shirt, cap, x, y, z, faceCam) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.9, 8, 14), glossy(shirt)); body.position.y = 2.05; body.castShadow = true;
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.55, 14), mat('#2b2d42')); shorts.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), mat('#ffcfa8')); head.position.y = 3.2; head.castShadow = true;
  const capm = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap)); capm.position.y = 3.3;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 14), mat(cap)); brim.scale.z = 1.7; brim.position.set(0, 3.32, faceCam ? 0.5 : 0.55);
  g.add(body, shorts, head, capm, brim);
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 8), mat('#ffcfa8')); leg.position.set(s * 0.25, 0.5, 0); leg.castShadow = true; const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat('#ffffff')); shoe.scale.set(1, 0.6, 1.5); shoe.position.set(s * 0.25, 0.08, 0.1); g.add(leg, shoe); }
  const armR = new THREE.Group(); armR.position.set(0.68, 2.55, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 4, 8), glossy(shirt)); a.position.y = -0.5; a.castShadow = true; armR.add(a);
  const armL = new THREE.Group(); armL.position.set(-0.68, 2.55, 0); const a2 = a.clone(); armL.add(a2); armL.rotation.z = -0.15;
  g.add(armR, armL); g.armR = armR; g.position.set(x, y, z); return g;
}
const me = person('#ff5d5d', '#ffffff', -1.25, 0, 1.6, false); me.rotation.y = Math.PI;   // kept for arm timing; the view is first-person so the bodies stay off-screen
const rival = person('#3a86ff', '#ffd23f', 2.4, 0, 0.4, false); rival.rotation.y = Math.PI;

// ---------------------------------------------------------------- bags
const BAGGEO = rounded(BAG * 2, 0.16, BAG * 2, 0.07);
let bags = [], turn = 0, thrown = [0, 0], pts = [0, 0], perSide = 4, state = 'ready', sub = 'aim', waitT = 0, wind = 0, aiSigma = 0.1, recorded = false, extra = 0, beatenShown = false, t = 0;
let handBag = null, drag = null, botPending = false;
function newBag(owner) {
  const m = new THREE.Mesh(BAGGEO, glossy(COLORS[owner], { roughness: 0.75 })); m.castShadow = true; scene.add(m);
  const b = { owner, m, p: new THREE.Vector3(), v: new THREE.Vector3(), mode: 'hand', bv: 0, bx: 0, vv: 0, vx: 0, spin: 0, sq: 0, scored: 0 }; bags.push(b); return b;
}
function throwFrom(owner) { return owner === 0 ? new THREE.Vector3(0.15, 3.1, 5.4) : new THREE.Vector3(3.2, 3.0, 4.2); }
function launch(b, p, aim) {
  const sp = 12 + p * 16, el = 0.68;
  const from = throwFrom(b.owner); b.p.copy(from);
  // aim is an angle toward the board from the throw spot
  const toBoard = Math.atan2(0 - from.x, -(ZF - 2 - from.z));
  const yaw = toBoard + aim;
  b.v.set(Math.sin(yaw) * Math.cos(el) * sp, Math.sin(el) * sp, -Math.cos(yaw) * Math.cos(el) * sp);
  b.mode = 'air'; b.spin = (Math.random() - 0.5) * 0.2 + 0.12;
}
/** step one bag (h seconds). quiet = simulation (no fx). returns 'board' | 'hole' | 'ground' | null */
function stepBag(b, h, quiet = false, others = null) {
  if (b.mode === 'air') {
    b.v.y -= G * h; b.v.x += wind * h; b.p.addScaledVector(b.v, h);
    const v = ZF - b.p.z;
    if (Math.abs(b.p.x) < BW && v >= -0.05 && v <= BL && b.p.y <= surfY(clamp(v, 0, BL)) && b.v.y < 0) {
      b.mode = 'board'; b.bx = b.p.x; b.bv = clamp(v, 0, BL);
      const along = -b.v.z * Math.cos(SLOPE) + b.v.y * Math.sin(SLOPE);
      b.vv = along * 0.55; b.vx = b.v.x * 0.55; b.sq = 1; return 'board';
    }
    if (b.p.y <= BAG * 0.3) { b.mode = 'ground'; b.p.y = 0.08; b.v.y = 0; b.v.multiplyScalar(0.3); b.sq = 1; return 'ground'; }
    return null;
  }
  if (b.mode === 'board' || b.mode === 'slide') {
    const sp = Math.hypot(b.vx, b.vv);
    const fr = MU * G * Math.cos(SLOPE), gs = G * Math.sin(SLOPE);
    if (sp > 0.05) { const dec = Math.min(sp, fr * h); b.vx -= b.vx / sp * dec; b.vv -= b.vv / sp * dec; b.vv -= gs * h * 0.5; }
    else { b.vx = 0; b.vv = 0; }
    b.bx += b.vx * h; b.bv += b.vv * h;
    if (others) for (const o of others) {   // bag-on-bag knocks
      if (o === b || (o.mode !== 'board' && o.mode !== 'slide')) continue;
      const dx = o.bx - b.bx, dv = o.bv - b.bv, d = Math.hypot(dx, dv);
      if (d < BAG * 1.9 && d > 1e-4) {
        const nx = dx / d, nv = dv / d, rel = (b.vx - o.vx) * nx + (b.vv - o.vv) * nv;
        if (rel > 0) { const j = rel * 0.85; b.vx -= j * nx; b.vv -= j * nv; o.vx += j * nx; o.vv += j * nv; o.mode = 'slide'; if (!quiet) { tone(240, 0.06, 'triangle', 0.1, 0.8); } }
        const push = (BAG * 1.9 - d) / 2; b.bx -= nx * push; b.bv -= nv * push; o.bx += nx * push; o.bv += nv * push;
      }
    }
    if (Math.hypot(b.bx, b.bv - HOLE_V) < HOLE_R - 0.04) { b.mode = 'hole'; b.p.set(b.bx, surfY(HOLE_V) - 0.3, ZF - HOLE_V); return 'hole'; }
    if (Math.abs(b.bx) > BW + 0.05 || b.bv > BL + 0.05 || b.bv < -0.1) { b.mode = 'air'; b.p.set(b.bx, surfY(clamp(b.bv, 0, BL)), ZF - b.bv); b.v.set(b.vx, 0, -b.vv); return null; }
    b.p.set(b.bx, surfY(b.bv), ZF - b.bv);
    if (Math.hypot(b.vx, b.vv) < 0.05) b.mode = 'rest';
    return null;
  }
  if (b.mode === 'ground') { b.p.addScaledVector(b.v, h); b.v.multiplyScalar(Math.pow(0.002, h)); if (b.v.length() < 0.05) b.mode = 'out'; return null; }
  return null;
}
function simulate(owner, p, aim) {
  const b = { owner, p: new THREE.Vector3(), v: new THREE.Vector3(), mode: 'hand' }; launch(b, p, aim);
  for (let i = 0; i < 600; i++) { const r = stepBag(b, 1 / 120, true); if (b.mode === 'hole') return { res: 3, b }; if (b.mode === 'rest') return { res: 1, b }; if (b.mode === 'out') return { res: 0, b }; }
  return { res: b.mode === 'board' ? 1 : 0, b };
}
// best throw for a side: scan power for a straight aim that drops it in (prefer middle of the working window)
function bestThrow(owner) {
  let hits = [];
  const aims = [0]; for (let k = 1; k <= 30; k++) aims.push(k * 0.01, -k * 0.01);
  for (const aim of aims) { for (let p = 0.2; p <= 1.1; p += 0.005) { const r = simulate(owner, p, aim); if (r.res === 3) hits.push({ p, aim }); } if (hits.length) break; }
  if (!hits.length) return { p: 0.6, aim: 0 };
  return hits[Math.floor(hits.length / 2)];
}
let aimCache = [null, null];

// ---------------------------------------------------------------- match flow
function scoreBags() { const s = [0, 0]; for (const b of bags) { if (b.mode === 'hole') s[b.owner] += 3; else if (['board', 'slide', 'rest'].includes(b.mode)) s[b.owner] += 1; } return s; }
function setBoardUI() {
  const q = (k) => sb.querySelector(k);
  q('[data-p0]').textContent = pts[0]; q('[data-p1]').textContent = pts[1];
  q('[data-b0]').textContent = '■'.repeat(Math.max(0, perSide + extra - thrown[0])); q('[data-b1]').textContent = '■'.repeat(Math.max(0, perSide + extra - thrown[1]));
  q('[data-b0]').style.color = COLORS[0]; q('[data-b1]').style.color = '#cfe0ff';
  q('[data-n0]').classList.toggle('bp-turn', turn === 0 && state === 'play'); q('[data-n1]').classList.toggle('bp-turn', turn === 1 && state === 'play');
}
function build() {
  for (const b of bags) scene.remove(b.m); bags = [];
  TH = THEMES[(level - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', TH.sky[0]); bs.setProperty('--bg2', TH.sky[1]); bs.setProperty('--ui', '#ff5d5d');
  const seed = D.seed ? D.seed + level : level * 6007 + 5, r = rng(seed), fk = F.k();
  ZF = -clamp(9 + level * 0.25, 9, 12.5);
  wind = level >= 3 ? (r() < 0.5 ? -1 : 1) * clamp((0.6 + level * 0.18) * fk, 0.5, 3.4) : 0;
  aiSigma = clamp(0.2 / (fk * (1 + level * 0.07)), 0.045, 0.22);
  sb.querySelector('[data-n1]').textContent = RIVALS[Math.floor(r() * RIVALS.length)];
  windEl.textContent = wind ? `${wind > 0 ? '' : '← '}WIND ${Math.abs(wind * 1.5).toFixed(1)} mph${wind > 0 ? ' →' : ''}` : '';
  buildYard();
  turn = 0; thrown = [0, 0]; pts = [0, 0]; extra = 0; recorded = false; beatenShown = false; aimCache = [bestThrow(0), bestThrow(1)];
  ui.levels(level); ui.progress(0); setBoardUI(); nextTurn(true);
}
function nextTurn(first = false) {
  if (!first) {
    pts = scoreBags(); setBoardUI();
    if (thrown[0] >= perSide + extra && thrown[1] >= perSide + extra) return endRound();
    turn = thrown[0] <= thrown[1] ? 0 : 1;
  }
  sub = 'aim'; handBag = newBag(turn); handBag.p.copy(throwFrom(turn)); handBag.m.position.copy(handBag.p); setBoardUI();
  if (turn === 1) { waitT = 0; sub = 'ai'; }
  botPending = false;
}
function endRound() {
  pts = scoreBags(); setBoardUI();
  if (pts[0] === pts[1] && extra < 2) { extra++; ui.pop('TIE · EXTRA BAG', '#fff', 34, 34); turn = 0; return nextTurnAfterExtra(); }
  if (pts[0] > pts[1]) {
    state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
    confetti(scene, new THREE.Vector3(0, 3, ZF - 2), 90); sfx.win(); buzz([20, 40, 20]);
    level++; save.set('level', level); D.won(pts[0], 'scored');
    ui.win(level - 1, `${pts[0]} – ${pts[1]}`);
  } else {
    state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(pts[0] / Math.max(1, pts[0] + pts[1]), 0, 1)); }
    sfx.fail(); ui.lose(pts[0] === pts[1] ? 'TIED!' : 'BEATEN BY ' + sb.querySelector('[data-n1]').textContent, `${pts[0]} – ${pts[1]}`);
  }
  setBoardUI();
}
function nextTurnAfterExtra() { sub = 'aim'; handBag = newBag(0); handBag.p.copy(throwFrom(0)); handBag.m.position.copy(handBag.p); setBoardUI(); botPending = false; }
function toss(p, aim) {
  if (!handBag || state !== 'play') return;
  const b = handBag; handBag = null; launch(b, p, aim); thrown[b.owner]++; sub = 'flight'; waitT = 0; setBoardUI();
  const who = b.owner === 0 ? me : rival; who.armR.rotation.x = -2.6;
  tone(330, 0.12, 'triangle', 0.1, 1.6); buzz(10);
}

// ---------------------------------------------------------------- input: drag up from anywhere, release to toss
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), 14); dots.frustumCulled = false; scene.add(dots);
const _m = new THREE.Matrix4();
function dragParams() { if (!drag) return null; const dy = drag.y0 - drag.y, dx = drag.x - drag.x0; return { p: clamp(dy / (innerHeight * 0.4), 0, 1.15), aim: clamp(dx / (innerWidth * 0.55), -1, 1) * 0.3 }; }
// a tap tosses toward the tapped spot: tap the hole = the right power for the hole, higher = further, lower = shorter
function tapToss(x, y) {
  const v = new THREE.Vector3(0, surfY(HOLE_V), ZF - HOLE_V).project(camera), hx = (v.x + 1) / 2 * innerWidth, hy = (1 - v.y) / 2 * innerHeight, a = aimCache[0] || { p: 0.6, aim: 0 };
  toss(clamp(a.p * (innerHeight - y) / Math.max(60, innerHeight - hy) + (Math.random() - 0.5) * 0.05, 0.15, 1.15), clamp(a.aim + (x - hx) / (innerWidth * 0.55) * 0.3, -0.3, 0.3));
}
input({
  onDown: (e) => { if (state === 'play' && sub === 'aim' && turn === 0) drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; },
  onMove: (dx, dy, e) => { if (drag) { drag.x = e.clientX; drag.y = e.clientY; } },
  onUp: (e) => { if (!drag) return; const d = dragParams(), mv = Math.hypot(drag.x - drag.x0, drag.y - drag.y0); drag = null; if (mv < 12) tapToss(e.clientX, e.clientY); else if (d.p > 0.08) toss(d.p, d.aim); },
});
ui.onTap(() => { B.start(); build(); state = 'play'; ui.hideStart(); setBoardUI(); });

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(0.5, 6.4, 10.5);
let camLook = new THREE.Vector3(0, 0.6, -9), camFollow = 0;
loop((dt) => {
  const h = Math.min(dt / 60, 0.04); t += h;
  // preview arc (first part of the flight) while dragging
  const d = dragParams(); let shown = 0;
  if (d && handBag) {
    const b = { owner: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), mode: 'hand' }; launch(b, d.p, d.aim);
    for (let i = 0; i < 14; i++) { for (let k = 0; k < 4; k++) { b.v.y -= G / 240; b.p.addScaledVector(b.v, 1 / 240); } _m.makeScale(1 - i * 0.05, 1 - i * 0.05, 1 - i * 0.05).setPosition(b.p); dots.setMatrixAt(i, _m); shown++; }
    me.armR.rotation.x = lerp(me.armR.rotation.x, 0.6 + d.p * 0.6, 0.3);   // wind-up
    handBag.p.copy(throwFrom(0)).add(new THREE.Vector3(d.aim * 1.2, -d.p * 0.7, d.p * 0.8));
  }
  for (let i = shown; i < 14; i++) { _m.makeScale(0, 0, 0); dots.setMatrixAt(i, _m); } dots.instanceMatrix.needsUpdate = true;
  if (handBag) { if (!drag) handBag.p.copy(throwFrom(handBag.owner)).add(new THREE.Vector3(0, Math.sin(t * 3) * 0.05, 0)); handBag.m.position.lerp(handBag.p, 0.4); handBag.m.rotation.set(0.5, 0.2, 0); }
  // physics (sub-stepped) + fx
  const moving = bags.filter(b => b.mode === 'air' || b.mode === 'board' || b.mode === 'slide' || b.mode === 'ground');
  for (let k = 0; k < 5; k++) for (const b of moving) {
    const ev = stepBag(b, h * 1.25 / 5, false, bags);
    if (ev === 'board') { sfx.bounce(); tone(150, 0.1, 'sine', 0.14, 0.6); burst(scene, b.p.clone(), ['#ffffff', COLORS[b.owner]], 6, { speed: 0.04, up: 0.04, size: 0.25 }); buzz(8); }
    if (ev === 'hole') { const mine = b.owner === 0; ui.pop(mine ? 'IN THE HOLE! +3' : 'THEY SANK IT', mine ? '#fff' : '#cfe0ff', mine ? 44 : 32, 32); if (mine) { confetti(scene, new THREE.Vector3(0, surfY(HOLE_V) + 0.5, ZF - HOLE_V), 40); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s, 0.25, 0.15), i * 80)); ui.flash(0.3); buzz([20, 30, 20]); } else tone(300, 0.2, 'triangle', 0.1, 0.7); }
    if (ev === 'ground') { tone(120, 0.12, 'sine', 0.12, 0.6); burst(scene, b.p.clone(), [TH.g1, '#ffffff'], 6, { speed: 0.04, up: 0.05, size: 0.3 }); }
  }
  for (const b of bags) {
    if (b.mode === 'hand') continue;
    b.sq = Math.max(0, (b.sq || 0) - h * 4);
    b.m.position.copy(b.p);
    if (b.mode === 'air') { b.m.rotation.y += b.spin; b.m.rotation.x = 0.2; }
    else if (b.mode !== 'hole') { b.m.rotation.x = ['board', 'slide', 'rest'].includes(b.mode) ? SLOPE : 0; b.m.scale.set(1 + b.sq * 0.25, 1 - b.sq * 0.45, 1 + b.sq * 0.25); }
    else { b.m.position.y -= 0; b.m.visible = b.p.y > -0.5; b.p.y -= h * 2; }
  }
  for (const who of [me, rival]) who.armR.rotation.x = lerp(who.armR.rotation.x, (drag && who === me) ? who.armR.rotation.x : 0, 0.08);
  // turn flow
  if (state === 'play') {
    if (sub === 'flight') {
      const live = bags.some(b => b.mode === 'air' || b.mode === 'board' || b.mode === 'slide' || b.mode === 'ground');
      const cur = scoreBags(); ui.progress((thrown[0] + thrown[1]) / ((perSide + extra) * 2));
      if (!beatenShown && D.beaten(cur[0])) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 24); confetti(scene, new THREE.Vector3(0, 3, ZF - 2), 40); }
      if (!live) { waitT += h; if (waitT > 0.35) { const last = bags[bags.length - 1]; if (last.owner === 0 && last.mode !== 'hole') ui.pop(['rest', 'board', 'slide'].includes(last.mode) ? 'ON THE BOARD +1' : 'MISS', '#fff', 32, 32); nextTurn(); } }
    } else if (sub === 'ai') {
      waitT += h; rival.armR.rotation.x = lerp(rival.armR.rotation.x, 1.0, 0.1);
      if (waitT > 0.5) { const a = aimCache[1], n = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15; toss(clamp(a.p + n() * aiSigma * 0.55, 0.1, 1.15), a.aim + n() * aiSigma * 0.5 - wind * 0.0); }
    }
  }
  // camera: behind the thrower, eases toward the board while a bag flies
  const flying = bags.find(b => b.mode === 'air' || b.mode === 'board' || b.mode === 'slide');
  camFollow = lerp(camFollow, flying ? 1 : 0, 0.04 * dt);
  camera.position.set(camPos.x, lerp(camPos.y, 5.9, camFollow), lerp(camPos.z, camPos.z - 2.2, camFollow));
  camera.lookAt(0, 0.6 + (1 - camFollow) * 0.4, ZF + 1.2 - camFollow * 1.0);
  S.followLight(new THREE.Vector3(0, 0, ZF + 3));
});

buildYard(); camera.position.copy(camPos); camera.lookAt(camLook); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return pts[0]; },
  bot() {   // aim with the same physics the game uses, then toss with a small human error
    if (state !== 'play' || sub !== 'aim' || turn !== 0 || !handBag || botPending) return;
    botPending = true;
    const a = aimCache[0], windFix = 0;
    const err = Math.random() < 0.2 ? 0.07 : 0.025;
    setTimeout(() => { botPending = false; if (sub === 'aim' && turn === 0) toss(clamp(a.p + (Math.random() - 0.5) * err * 2, 0.1, 1.15), a.aim + windFix + (Math.random() - 0.5) * err); }, 60);
  },
};

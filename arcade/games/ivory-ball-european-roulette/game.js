// Ivory Ball: European Roulette — single-zero wheel, chips on the felt, free play only.
// The winning pocket is drawn with crypto.getRandomValues (1 of 37, uniform) before the ball is thrown; the ball's path is
// only an animation of that draw. No flow / adaptation: every spin has the same 2.70% house edge for everyone.
import { THREE, createStage, createUI, loop, store, confetti, buzz } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import * as C from './casino.js';

const NAME = 'Ivory Ball: European Roulette';
C.installCSS();
const stage = createStage({ fov: 40, shadowSize: 7 });
const { scene, camera, renderer, sun } = stage;
C.studio(stage);
const ui = createUI({ title: 'IVORY<br>BALL', hint: 'Tap to play', hand: '', progress: true, score: true });
const D = daily('ivoryball', ui, { name: NAME });
C.startExtras(ui, 'European Roulette · single zero');
ui.els.win.querySelector('p').innerHTML = 'TABLE <span data-l>1</span>';
const S = store('ivoryball');
const msg = C.message();

// ---------------------------------------------------------------- rules
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
const COL = { red: '#c81e34', black: '#17161d', green: '#118a4c' };
const PAYOUT = { straight: 35, split: 17, corner: 8, dozen: 2, column: 2, even: 1 };

// ---------------------------------------------------------------- tables
const UNITS = [5, 25, 100, 500, 1000, 5000, 25000];
const FELTS = [['#1f8a55', '#0a3a22'], ['#1d5f93', '#08233c'], ['#8c2740', '#330a17'], ['#3b3747', '#111017'], ['#5e3a8e', '#1e0d36']];
function tableCfg(n) {
  const u = n <= UNITS.length ? UNITS[n - 1] : 25000 * Math.pow(2, n - UNITS.length), start = u * 100;
  const mult = [1.5, 1.6, 1.7, 1.8, 1.9][n - 1] || 2;
  return { n, u, start, max: u * 50, target: u * Math.round(100 * mult), felt: FELTS[(n - 1) % FELTS.length] };
}
let tableN = Math.max(1, S.get('table', 1)), T = tableCfg(tableN), chips = T.start, best = S.get('best', 0);

// ---------------------------------------------------------------- betting layout geometry (world units, y = 0 plane)
const CW_E = 0.74, CW_D = 0.6, CW_N = 0.98, ROW = 0.455, ZERO_H = 0.6, COLROW_H = 0.5;
const LW = CW_E + CW_D + CW_N * 3, LH = ZERO_H + ROW * 12 + COLROW_H;
const X0 = -LW / 2, XD = X0 + CW_E, XN = XD + CW_D, Z0 = -LH / 2, ZN = Z0 + ZERO_H, ZC = ZN + ROW * 12;
const numPos = n => { const r = Math.floor((n - 1) / 3), c = (n - 1) % 3; return new THREE.Vector3(XN + (c + .5) * CW_N, 0, ZN + (r + .5) * ROW); };
const EVENS = [['1-18', n => n >= 1 && n <= 18], ['EVEN', n => n > 0 && n % 2 === 0], ['RED', n => REDS.has(n)], ['BLACK', n => n > 0 && !REDS.has(n)], ['ODD', n => n % 2 === 1], ['19-36', n => n >= 19]];
function betFromPoint(x, z) {
  if (x < X0 || x > X0 + LW || z < Z0 || z > Z0 + LH) return null;
  if (x >= XN && z < ZN) return { key: 's0', type: 'straight', nums: [0], pos: new THREE.Vector3(XN + 1.5 * CW_N, 0, Z0 + ZERO_H / 2), name: '0' };
  if (x >= XN && z >= ZC) { const c = Math.min(2, Math.floor((x - XN) / CW_N)); const nums = []; for (let n = c + 1; n <= 36; n += 3) nums.push(n); return { key: 'c' + c, type: 'column', nums, pos: new THREE.Vector3(XN + (c + .5) * CW_N, 0, ZC + COLROW_H / 2), name: 'Column ' + (c + 1) }; }
  if (z < ZN || z >= ZC) return null;
  const rf = (z - ZN) / ROW, row = Math.min(11, Math.floor(rf));
  if (x < XD) { const k = Math.min(5, Math.floor(rf / 2)); const [nm, f] = EVENS[k]; const nums = []; for (let n = 1; n <= 36; n++) if (f(n)) nums.push(n); return { key: 'e' + k, type: 'even', nums, pos: new THREE.Vector3(X0 + CW_E / 2, 0, ZN + (k * 2 + 1) * ROW), name: nm }; }
  if (x < XN) { const k = Math.min(2, Math.floor(rf / 4)); const nums = []; for (let n = k * 12 + 1; n <= k * 12 + 12; n++) nums.push(n); return { key: 'd' + k, type: 'dozen', nums, pos: new THREE.Vector3(XD + CW_D / 2, 0, ZN + (k * 4 + 2) * ROW), name: ['1st', '2nd', '3rd'][k] + ' 12' }; }
  const cf = (x - XN) / CW_N, col = Math.min(2, Math.floor(cf)), fx = cf - col, fz = rf - row, n = row * 3 + col + 1, E = 0.24;
  const right = fx > 1 - E && col < 2, left = fx < E && col > 0, down = fz > 1 - E && row < 11, up = fz < E && row > 0;
  const h = right ? 1 : left ? -1 : 0, v = down ? 1 : up ? -1 : 0;
  if (h && v) { const nums = [n, n + h, n + 3 * v, n + 3 * v + h].sort((a, b) => a - b); const p = numPos(n); p.x += h * CW_N / 2; p.z += v * ROW / 2; return { key: 'q' + nums.join('-'), type: 'corner', nums, pos: p, name: 'Corner ' + nums.join('/') }; }
  if (h || v) { const m = n + h + 3 * v, nums = [n, m].sort((a, b) => a - b); const p = numPos(n); p.x += h * CW_N / 2; p.z += v * ROW / 2; return { key: 'p' + nums.join('-'), type: 'split', nums, pos: p, name: 'Split ' + nums.join('/') }; }
  return { key: 's' + n, type: 'straight', nums: [n], pos: numPos(n), name: String(n) };
}

// ---------------------------------------------------------------- table felt + printed layout
let felt, layout;
function buildFelt() {
  for (const m of [felt, layout]) if (m) { scene.remove(m); m.material.map && m.material.map.dispose(); m.material.dispose(); }
  const [c1, c2] = T.felt;
  felt = new THREE.Mesh(new THREE.PlaneGeometry(9, 26), new THREE.MeshStandardMaterial({ map: C.feltTexture(512, 1480, c1, c2), roughness: .95 }));
  felt.rotation.x = -Math.PI / 2; felt.position.set(0, -0.002, -5); felt.receiveShadow = true; scene.add(felt);
  const PX = 236, TW = Math.round(LW * PX), TH = Math.round(LH * PX), X = x => (x - X0) * PX, Z = z => (z - Z0) * PX;
  const tex = C.canvasTex(TW, TH, (x) => {
    const line = 'rgba(255,246,222,.85)';
    x.strokeStyle = line; x.lineWidth = 4;
    // zero
    x.fillStyle = COL.green; x.beginPath(); x.moveTo(X(XN), Z(ZN)); x.lineTo(X(XN + CW_N * 0.5), Z(Z0) + 4); x.lineTo(X(XN + CW_N * 2.5), Z(Z0) + 4); x.lineTo(X(XN + CW_N * 3) - 2, Z(ZN)); x.closePath(); x.fill(); x.stroke();
    num(x, '0', X(XN + 1.5 * CW_N), Z(Z0 + ZERO_H / 2), '#fff', 60);
    for (let n = 1; n <= 36; n++) {
      const p = numPos(n), cx = X(p.x), cy = Z(p.z);
      x.strokeRect(X(p.x - CW_N / 2), Z(p.z - ROW / 2), CW_N * PX, ROW * PX);
      x.fillStyle = REDS.has(n) ? COL.red : COL.black; C.rr(x, cx - 46, cy - 38, 92, 76, 30); x.fill();
      num(x, String(n), cx, cy + 2, '#fff', 56);
    }
    for (let c = 0; c < 3; c++) { x.strokeRect(X(XN + c * CW_N), Z(ZC), CW_N * PX, COLROW_H * PX); num(x, '2 TO 1', X(XN + (c + .5) * CW_N), Z(ZC + COLROW_H / 2), 'rgba(255,246,222,.92)', 34); }
    for (let k = 0; k < 3; k++) { x.strokeRect(X(XD), Z(ZN + k * 4 * ROW), CW_D * PX, 4 * ROW * PX); vtext(x, ['1st 12', '2nd 12', '3rd 12'][k], X(XD + CW_D / 2), Z(ZN + (k * 4 + 2) * ROW), 40); }
    for (let k = 0; k < 6; k++) {
      const cy = Z(ZN + (k * 2 + 1) * ROW), cx = X(X0 + CW_E / 2);
      x.strokeRect(X(X0), Z(ZN + k * 2 * ROW), CW_E * PX, 2 * ROW * PX);
      if (k === 2 || k === 3) { x.fillStyle = k === 2 ? COL.red : COL.black; x.beginPath(); x.moveTo(cx, cy - 70); x.lineTo(cx + 46, cy); x.lineTo(cx, cy + 70); x.lineTo(cx - 46, cy); x.closePath(); x.fill(); x.strokeStyle = 'rgba(255,246,222,.6)'; x.lineWidth = 3; x.stroke(); x.strokeStyle = line; x.lineWidth = 4; }
      else vtext(x, EVENS[k][0], cx, cy, 40);
    }
    x.lineWidth = 7; x.strokeStyle = 'rgba(232,193,106,.95)'; x.strokeRect(3, Z(ZN), TW - 6, Z(ZC) - Z(ZN));
  }, 16);
  layout = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }));
  layout.rotation.x = -Math.PI / 2; layout.position.y = 0.001; layout.receiveShadow = true; scene.add(layout);
  function num(x, t, cx, cy, col, size) { x.fillStyle = col; x.font = `bold ${size}px Georgia, "Times New Roman", serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, cx, cy); }
  function vtext(x, t, cx, cy, size) { x.save(); x.translate(cx, cy); x.rotate(-Math.PI / 2); num(x, t, 0, 0, 'rgba(255,246,222,.92)', size); x.restore(); }
}

// ---------------------------------------------------------------- the wheel
const WHEEL = new THREE.Vector3(0, 0, -10.2), R_ROT = 1.52, R_IN = 0.94, R_OUT = 1.31, R_POCKET = 1.12, R_TRACK = 1.86;
const wheel = new THREE.Group(); wheel.position.copy(WHEEL); scene.add(wheel);
const woodM = new THREE.MeshPhysicalMaterial({ color: '#5a2e17', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
const trackM = new THREE.MeshPhysicalMaterial({ color: '#2a1810', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
const chrome = new THREE.MeshPhysicalMaterial({ color: '#e9e4da', metalness: 1, roughness: 0.16 });
const goldM = new THREE.MeshPhysicalMaterial({ color: '#d6a54a', metalness: 1, roughness: 0.25 });
{
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[2.45, -0.3], [2.5, 0.25], [2.42, 0.5], [2.3, 0.54], [2.2, 0.5], [2.12, 0.44]].map(p => new THREE.Vector2(p[0], p[1])), 80), woodM);
  const track = new THREE.Mesh(new THREE.LatheGeometry([[2.12, 0.44], [2.0, 0.4], [1.9, 0.34], [1.7, 0.24], [1.56, 0.16], [1.54, 0.0]].map(p => new THREE.Vector2(p[0], p[1])), 80), trackM);
  bowl.castShadow = true; bowl.receiveShadow = true; track.receiveShadow = true; wheel.add(bowl, track);
  for (let i = 0; i < 8; i++) {   // chrome deflectors on the track
    const a = i * Math.PI / 4 + 0.2, d = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), chrome);
    d.scale.set(1.6, 0.6, 0.8); d.position.set(Math.cos(a) * 1.76, 0.31, Math.sin(a) * 1.76); d.rotation.y = -a; wheel.add(d);
  }
}
const rotor = new THREE.Group(); wheel.add(rotor);
{
  const tex = C.canvasTex(1024, 1024, (x) => {
    const c = 512, R = 512, seg = Math.PI * 2 / 37;
    const g = x.createRadialGradient(c, c, 0, c, c, R); g.addColorStop(0, '#7a4a22'); g.addColorStop(0.6, '#4e2a12'); g.addColorStop(1, '#3a1f0e');
    x.fillStyle = g; x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.fill();
    ORDER.forEach((n, i) => {
      const a = i * seg;
      for (const [r0, r1, k] of [[R * R_IN / R_ROT, R * R_OUT / R_ROT, 0.72], [R * 0.875, R * 0.995, 1]]) {
        x.fillStyle = COL[colorOf(n)]; x.beginPath(); x.arc(c, c, r1, a - seg / 2, a + seg / 2); x.arc(c, c, r0, a + seg / 2, a - seg / 2, true); x.closePath(); x.fill();
        if (k < 1) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fill(); }
      }
      x.save(); x.translate(c + Math.cos(a) * R * 0.935, c + Math.sin(a) * R * 0.935); x.rotate(a + Math.PI / 2);
      x.fillStyle = '#fff'; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 0, 0); x.restore();
    });
    x.strokeStyle = '#e1b860'; x.lineWidth = 6; for (const r of [R * 0.875, R * 0.995, R * R_OUT / R_ROT, R * R_IN / R_ROT]) { x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke(); }
    x.strokeStyle = 'rgba(225,184,96,.5)'; x.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60); x.lineTo(c + Math.cos(a) * R * 0.6, c + Math.sin(a) * R * 0.6); x.stroke(); }
  }, 16);
  const top = new THREE.Mesh(new THREE.CircleGeometry(R_ROT, 96), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.1; top.receiveShadow = true; rotor.add(top);
  const side = new THREE.Mesh(new THREE.CylinderGeometry(R_ROT, R_ROT, 0.1, 96, 1, true), goldM); side.position.y = 0.05; rotor.add(side);
  // frets between pockets (instanced) + pocket walls
  const fret = new THREE.InstancedMesh(new THREE.BoxGeometry(R_OUT - R_IN, 0.07, 0.022), chrome, 37), M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  for (let i = 0; i < 37; i++) { const a = (i + 0.5) * Math.PI * 2 / 37, r = (R_IN + R_OUT) / 2; Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a); M.compose(new THREE.Vector3(Math.cos(a) * r, 0.135, Math.sin(a) * r), Q, new THREE.Vector3(1, 1, 1)); fret.setMatrixAt(i, M); }
  fret.castShadow = true; rotor.add(fret);
  for (const r of [R_IN, R_OUT]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 8, 96), chrome); t.rotation.x = Math.PI / 2; t.position.y = 0.14; rotor.add(t); }
  // turret
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.32, 48), goldM); cone.position.y = 0.26; cone.castShadow = true; rotor.add(cone);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 20), chrome); stem.position.y = 0.55; rotor.add(stem);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 12), chrome); arm.rotation.z = Math.PI / 2; arm.rotation.y = -a; arm.position.set(Math.cos(a) * 0.3, 0.7, Math.sin(a) * 0.3); rotor.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), chrome); knob.position.set(Math.cos(a) * 0.62, 0.7, Math.sin(a) * 0.62); rotor.add(knob);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), chrome); cap.position.y = 0.82; rotor.add(cap);
}
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.078, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#fbf8f1', roughness: 0.12, clearcoat: 1 }));
ball.castShadow = true; wheel.add(ball); ball.visible = false;
const wheelLight = new THREE.PointLight('#ffe3b8', 10, 9, 1.6); wheelLight.position.set(WHEEL.x, 3.6, WHEEL.z + 1); scene.add(wheelLight);
const tableLight = new THREE.PointLight('#ffe3b8', 4, 12, 1.6); tableLight.position.set(0, 5, 0.5); scene.add(tableLight);

// ---------------------------------------------------------------- camera poses (bet view ↔ wheel view)
const pose = { bet: { p: new THREE.Vector3(), t: new THREE.Vector3() }, wheel: { p: new THREE.Vector3(), t: new THREE.Vector3() } };
let camK = 0;   // 0 = bet view, 1 = wheel view
function computePoses() {
  const a = innerWidth / innerHeight, tv = Math.tan(camera.fov * Math.PI / 360);
  const dB = Math.max(6, (LW / 2 + 0.12) / (tv * Math.min(a, 1.2)));
  pose.bet.p.set(0, dB * 0.985, dB * 0.17 + 0.3); pose.bet.t.set(0, 0, a < 0.75 ? 0.24 : 0);
  const dW = Math.max(4.5, 2.42 / (tv * Math.min(a, 1.2)));
  pose.wheel.p.set(WHEEL.x, dW * 0.74, WHEEL.z + dW * 0.67); pose.wheel.t.set(WHEEL.x, 0, WHEEL.z + (a < 0.75 ? 0.25 : 0));
  applyCam();
}
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
function applyCam() { const k = C.ease.inOut(camK); _p.lerpVectors(pose.bet.p, pose.wheel.p, k); _p.y += Math.sin(k * Math.PI) * 2.5; _t.lerpVectors(pose.bet.t, pose.wheel.t, k); camera.position.copy(_p); camera.lookAt(_t); }
addEventListener('resize', () => setTimeout(computePoses)); setTimeout(computePoses); computePoses();
sun.position.set(3, 14, 4);
const camTo = (k, dur = 0.9) => { const k0 = camK; return C.tween(dur, e => { camK = k0 + (k - k0) * e; applyCam(); }, C.ease.lin); };
function followSun() { const k = C.ease.inOut(camK); const z = k * WHEEL.z; sun.position.set(3, 14, z + 4); sun.target.position.set(0, 0, z); }

// ---------------------------------------------------------------- bets
const B = worldBoard({ game: 'ivory-ball', label: 'Tables cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: 1 point per table cleared today
let state = 'ready', phase = 'idle', bets = new Map(), history = [], lastBets = [], undo = [], beatenShown = false, botOn = false;
const totalBet = () => [...bets.values()].reduce((a, b) => a + b.amount, 0);
const CHIP_SCALE = 0.92;
function placeBet(b, v, silent = false) {
  if (phase !== 'bet' || !b) return false;
  if (totalBet() + v > T.max) { if (!silent) msg(`Table max ${C.fmt(T.max)} per spin`, 900); return false; }
  if (v > chips) { if (!silent) msg('Not enough chips', 800); return false; }
  chips -= v;
  let e = bets.get(b.key);
  if (!e) { e = { ...b, amount: 0, stack: null }; bets.set(b.key, e); }
  e.amount += v; undo.push({ key: b.key, v });
  redrawStack(e, true); hud(); C.csfx.chip(1); buzz(6);
  return true;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): at table 1, until the first real touch,
// the smallest chip drops onto RED and lifts back off a second later (refunded, never spun), so the felt shows where bets go
demo(() => {
  const pick = betFromPoint(X0 + CW_E / 2, ZN + 5 * ROW), v = chipVals()[0]; if (!pick || !placeBet(pick, v, true)) return false;
  const u = undo[undo.length - 1];
  setTimeout(() => { const e = bets.get(pick.key); if (phase !== 'bet' || !e || e.amount < v) return; e.amount -= v; chips += v; const i = undo.indexOf(u); if (i >= 0) undo.splice(i, 1);
    if (e.amount <= 0) { if (e.stack) scene.remove(e.stack); bets.delete(pick.key); } else redrawStack(e); hud(); C.csfx.chip(1); }, 1100);
}, { ready: () => state === 'play' && phase === 'bet' && tableN === 1 && totalBet() === 0, wait: 1800, every: 1800, max: 1 });
function redrawStack(e, drop = false) {
  if (e.stack) scene.remove(e.stack);
  if (e.amount <= 0) { bets.delete(e.key); e.stack = null; return; }
  e.stack = C.chipStack(e.amount, { cap: 8, col: 8 }); e.stack.scale.setScalar(CHIP_SCALE); e.stack.position.copy(e.pos).setY(0.003); scene.add(e.stack);
  if (drop) { const top = e.stack.children[e.stack.children.length - 1]; if (top) { const y = top.position.y; top.position.y += 0.7; C.tween(0.18, k => { top.position.y = y + 0.7 * (1 - k); }, C.ease.out); } }
}
function clearBets(refund = true) { for (const e of bets.values()) { if (refund) chips += e.amount; if (e.stack) scene.remove(e.stack); } bets.clear(); undo = []; hud(); }
function undoBet() { if (phase !== 'bet') return; const u = undo.pop(); if (!u) return; const e = bets.get(u.key); if (!e) return; e.amount -= u.v; chips += u.v; redrawStack(e); hud(); C.csfx.chip(1); }
function rebet() {
  if (phase !== 'bet' || !lastBets.length) return;
  const need = lastBets.reduce((a, b) => a + b.amount, 0);
  if (need > chips + totalBet()) { msg('Not enough chips', 800); return; }
  clearBets(true); for (const b of lastBets) placeBet(b, b.amount, true);
}
// tap the felt
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
renderer.domElement.addEventListener('pointerdown', e => {
  if (phase !== 'bet' || state !== 'play') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hitP)) return;
  const b = betFromPoint(hitP.x, hitP.z); if (b) { placeBet(b, chipSel.sel); flashCells(b.nums); }
});
// highlight covered numbers briefly
const hl = new THREE.InstancedMesh(new THREE.PlaneGeometry(CW_N * 0.96, ROW * 0.92), new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0, depthWrite: false }), 37);
hl.rotation.x = 0; scene.add(hl); hl.renderOrder = 2;
function flashCells(nums) {
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); let k = 0;
  for (const n of nums.slice(0, 37)) { const p = n === 0 ? new THREE.Vector3(XN + 1.5 * CW_N, 0, Z0 + ZERO_H / 2) : numPos(n); M.compose(p.setY(0.004), Q, new THREE.Vector3(n === 0 ? 2.6 : 1, n === 0 ? 1.2 : 1, 1)); hl.setMatrixAt(k++, M); }
  hl.count = k; hl.instanceMatrix.needsUpdate = true;
  C.tween(0.45, e => { hl.material.opacity = 0.35 * (1 - e); }, C.ease.lin);
}
// winning-number marker (glass dolly)
const dolly = new THREE.Group();
{ const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.32, 24), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.6, roughness: 0.05, thickness: 0.3, transparent: true, opacity: 0.85 }));
  glass.position.y = 0.16; const top = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), goldM); top.position.y = 0.36; glass.castShadow = true; dolly.add(glass, top); }
dolly.visible = false; scene.add(dolly);

// ---------------------------------------------------------------- HUD / controls
const histEl = C.h(`<div style="position:fixed;top:calc(64px + env(safe-area-inset-top));right:10px;z-index:6;display:flex;gap:3px;pointer-events:none"></div>`); document.body.appendChild(histEl);
const badge = C.h(`<div style="position:fixed;left:50%;top:70%;z-index:6;pointer-events:none;transform:translate(-50%,-50%) scale(.4);opacity:0;transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .25s;text-align:center"><div data-n style="width:112px;height:112px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font:800 58px/1 'Baloo 2',system-ui;color:#fff;border:5px solid #f4d488;box-shadow:0 12px 30px rgba(0,0,0,.5),inset 0 -6px 0 rgba(0,0,0,.25)"></div><div data-c style="margin-top:8px;font:800 22px 'Baloo 2',system-ui;color:#fff;letter-spacing:2px;text-shadow:0 2px 0 rgba(0,0,0,.4)"></div></div>`);
document.body.appendChild(badge);
function showBadge(n, on = true) {
  if (on) { const c = colorOf(n); badge.querySelector('[data-n]').textContent = n; badge.querySelector('[data-n]').style.background = `radial-gradient(circle at 35% 30%, ${c === 'red' ? '#ff4a5f' : c === 'green' ? '#2bd17a' : '#4a4658'}, ${COL[c]})`; badge.querySelector('[data-c]').textContent = c.toUpperCase(); }
  badge.style.opacity = on ? 1 : 0; badge.style.transform = `translate(-50%,-50%) scale(${on ? 1 : .4})`;
}
function drawHist() { histEl.innerHTML = history.slice(-5).reverse().map((n, i) => `<div style="width:24px;height:24px;border-radius:50%;background:${COL[colorOf(n)]};color:#fff;font:800 12px/24px 'Baloo 2',system-ui;text-align:center;border:1.5px solid rgba(255,255,255,${i ? .35 : .9});opacity:${1 - i * .15}">${n}</div>`).join(''); }
function hud() {
  ui.score(C.fmt(chips)); ui.levels(tableN); ui.progress((chips + (phase === 'bet' ? totalBet() : 0)) / T.target);
  const tb = totalBet(); ui.sub(tb ? `On the felt ${C.fmt(tb)} · goal ${C.fmt(T.target)}` : `Table ${tableN} · goal ${C.fmt(T.target)} · max ${C.fmt(T.max)}/spin`);
  if (bar) { bar.enable('spin', phase === 'bet' && tb > 0); bar.enable('undo', phase === 'bet' && undo.length > 0); bar.enable('clear', phase === 'bet' && tb > 0); bar.enable('rebet', phase === 'bet' && lastBets.length > 0 && !tb); bar.text('spin', 'Spin', tb ? C.fmt(tb) : 'place chips'); }
  if (chipSel) chipSel.limit(Math.min(chips, T.max - tb));
  if (D.beaten(chips + (phase === 'bet' ? tb : 0)) && !beatenShown && state === 'play') { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 48, 30); }
}
const chipVals = () => C.DENOMS.map(d => d.v).filter(v => v >= T.u && v <= T.max).slice(0, 5);
let chipSel = null, bar = null;
chipSel = C.chipBar(chipVals(), v => { chipSel.select(v); C.csfx.tick(); });
bar = C.bar([{ id: 'clear', text: 'Clear', cls: 'dark', on: () => { if (phase === 'bet') { clearBets(true); C.csfx.chip(2); } } }, { id: 'undo', text: 'Undo', cls: 'dark', on: undoBet },
  { id: 'rebet', text: 'Rebet', cls: 'blue', on: rebet }, { id: 'spin', text: 'Spin', cls: 'green', on: () => spin() }]);
const odds = C.oddsPanel(`<h2>Wheel & odds</h2>
<p>A European single-zero wheel: 37 pockets, 0–36. The winning pocket is picked by your browser's cryptographic random generator, each pocket exactly 1 in 37, before the ball is thrown. Same odds for everyone, every spin.</p>
<h3>Bets & payouts</h3><table>
<tr><td>Straight (one number)</td><td>35 to 1 · 1 in 37</td></tr><tr><td>Split (tap a line between 2)</td><td>17 to 1 · 2 in 37</td></tr>
<tr><td>Corner (tap where 4 meet)</td><td>8 to 1 · 4 in 37</td></tr><tr><td>Dozen / Column</td><td>2 to 1 · 12 in 37</td></tr>
<tr><td>Red/Black, Odd/Even, 1-18/19-36</td><td>1 to 1 · 18 in 37</td></tr></table>
<p>Zero loses all outside bets (no half-back rule).</p>
<div class="edge">House edge 2.70% on every bet (1 in 37): about 27 chips lost per 1,000 bet, on average, over the long run.</div>
<p>Free play only: chips have no cash value and can't be bought.</p>`);

function enterBet() {
  phase = 'bet'; chipSel.set(chipVals()); if (!chipVals().includes(chipSel.sel)) chipSel.select(chipVals()[0]); else chipSel.select(chipSel.sel);
  chipSel.show(true); bar.show(true); odds.btn.classList.remove('hc-hidden'); hud();
}

// ---------------------------------------------------------------- spin
let rotA = 0, rotW = 0.6, ballAnim = null;
async function spin() {
  if (phase !== 'bet' || totalBet() <= 0) return;
  phase = 'spin'; chipSel.show(false); bar.show(false); odds.btn.classList.add('hc-hidden'); hud();
  lastBets = [...bets.values()].map(e => ({ key: e.key, type: e.type, nums: e.nums, pos: e.pos, name: e.name, amount: e.amount }));
  const result = ORDER[C.srand(37)];                   // the fair draw: 1 of 37, uniform
  dolly.visible = false;
  await camTo(1, 0.85);
  await throwBall(result);
  history.push(result); drawHist();
  const col = colorOf(result);
  showBadge(result); void col;
  C.csfx.push(); buzz(20);
  await C.wait(1.1); showBadge(result, false);
  await camTo(0, 0.8);
  await settle(result);
}
function throwBall(result) {
  const i = ORDER.indexOf(result), aPocket = i * Math.PI * 2 / 37;
  const T3 = 5.0, rel0 = -(13 + C.sfloat() * 3) * T3 / 3;     // starting relative speed (visual only)
  rotW = 2.6;
  ball.visible = true; C.csfx.tick();
  let lastHop = 0;
  return new Promise(res => {
    ballAnim = { t: 0, T3, aPocket, rel0, done: res, hop: () => { if (ballAnim.t - lastHop > 0.07) { lastHop = ballAnim.t; C.csfx.tick(); } } };
  });
}
function updateBall(dt) {
  rotW += (0.35 - rotW) * Math.min(1, dt * 0.25);
  rotA += rotW * dt; rotor.rotation.y = rotA;
  if (!ballAnim) return;
  const b = ballAnim; b.t += dt; const s = Math.min(1, b.t / b.T3);
  const rel = b.aPocket + b.rel0 * Math.pow(1 - s, 3);     // ψ = φ + θ  → φ = ψ − θ
  const phi = rel - rotA;
  let r, y;
  if (s < 0.55) { r = R_TRACK; y = 0.38 + Math.sin(b.t * 30) * 0.004; }
  else if (s < 0.72) { const k = (s - 0.55) / 0.17; r = R_TRACK - k * (R_TRACK - 1.45); y = 0.37 - k * 0.2 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.12 * (1 - k); if (Math.abs(Math.sin(k * Math.PI * 3)) < 0.08) b.hop(); }
  else { const k = (s - 0.72) / 0.28, e = 1 - Math.pow(1 - k, 2); r = 1.45 - e * (1.45 - R_POCKET); y = 0.2 + Math.abs(Math.sin(k * Math.PI * 4.5)) * 0.14 * Math.pow(1 - k, 1.6); if (Math.abs(Math.sin(k * Math.PI * 4.5)) < 0.1 && k < 0.85) b.hop(); }
  ball.position.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
  ball.rotation.x += dt * 20 * (1 - s);
  if (s >= 1 && !b.finished) { b.finished = true; C.csfx.chip(1); const d = b.done; setTimeout(() => d(), 50); }
  if (b.finished) { ball.position.set(Math.cos(b.aPocket - rotA) * R_POCKET, 0.2, Math.sin(b.aPocket - rotA) * R_POCKET); }
}
async function settle(result) {
  dolly.visible = true; const dp = result === 0 ? new THREE.Vector3(XN + 1.5 * CW_N, 0, Z0 + ZERO_H / 2) : numPos(result);
  dolly.position.copy(dp).setY(1.2); await C.tween(0.3, k => { dolly.position.y = 1.2 * (1 - k); }, C.ease.out); C.csfx.tick();
  let won = 0, staked = 0; const jobs = [];
  for (const e of bets.values()) {
    staked += e.amount;
    if (e.nums.includes(result)) {
      const pay = e.amount * PAYOUT[e.type]; won += pay + e.amount;
      jobs.push((async () => {
        const w = C.chipStack(pay, { cap: 8, col: 8 }); w.scale.setScalar(CHIP_SCALE); w.position.set(0, 0.4, -4.6); scene.add(w);
        await C.fly(w, e.pos.clone().add(new THREE.Vector3(0.22, 0.003, 0.1)), { dur: 0.5, lift: 0.6 }); C.csfx.chip(3);
        await C.wait(0.45);
        await Promise.all([C.fly(w, new THREE.Vector3(0, 0.4, 5), { dur: 0.45 }), C.fly(e.stack, new THREE.Vector3(0, 0.4, 5), { dur: 0.45 })]);
        scene.remove(w); scene.remove(e.stack);
      })());
    } else jobs.push(C.wait(0.15).then(() => C.fly(e.stack, new THREE.Vector3(0, 0.3, -4.8), { dur: 0.45, lift: 0.4 })).then(() => scene.remove(e.stack)));
  }
  await Promise.all(jobs);
  bets.clear(); undo = [];
  chips += won; const net = won - staked;
  if (net > 0) { C.csfx.win(); ui.pop('+' + C.fmt(net), '#ffe08a', 42, 34); confetti(scene, dp.clone().setY(0.5), 40); buzz([20, 30, 20]); }
  else if (won > 0) C.csfx.push(); else C.csfx.lose();
  best = Math.max(best, chips); S.set('best', best);
  hud();
  await C.wait(0.4);
  if (chips >= T.target) return tableWon();
  if (chips < T.u) return tableLost();
  enterBet();
}
function tableWon() {
  state = 'won'; phase = 'idle'; B.submit(1); C.csfx.big(); confetti(scene, new THREE.Vector3(0, 1, 0), 90); ui.flash(0.4);
  D.won(chips, 'cashed out'); S.set('table', tableN + 1);
  ui.win(tableN, `${C.fmt(chips)} chips · next: Table ${tableN + 1}, max ${C.fmt(tableCfg(tableN + 1).max)}/spin`);
}
function tableLost() { state = 'lost'; phase = 'idle'; ui.lose('OUT OF CHIPS', `Retry refills your ${C.fmt(T.start)} free chips`); }
function setupTable(n) {
  tableN = n; T = tableCfg(n); chips = T.start; beatenShown = false; lastBets = []; clearBets(false); dolly.visible = false;
  C.backdrop('#' + new THREE.Color(T.felt[1]).multiplyScalar(1.2).getHexString(), '#030405'); buildFelt(); hud();
}
ui.onTap(which => {
  B.start();
  if (which === 'start') { state = 'play'; enterBet(); msg('Tap the felt to bet', 1300); }
  else if (which === 'win') { setupTable(tableN + 1); state = 'play'; enterBet(); }
  else if (which === 'lose') { setupTable(tableN); state = 'play'; enterBet(); }
});
setupTable(tableN); ui.start();

let tPrev = performance.now();
loop(() => {
  const now = performance.now(), dts = Math.min(0.05, (now - tPrev) / 1000); tPrev = now;
  C.updateTweens(dts); updateBall(dts * C.SPEED); followSun();
});

// ---------------------------------------------------------------- test hook: bold play on an even-money bet toward the goal
window.__game = {
  get state() { return state; }, get level() { return tableN; }, get score() { return chips + (phase === 'bet' ? totalBet() : 0); },
  bot() {
    if (!botOn) { botOn = true; C.setSpeed(1.6); }
    if (state !== 'play' || phase !== 'bet') return;
    if (totalBet() > 0) { spin(); return; }
    const bank = chips, want = Math.max(T.u, Math.min(T.max, bank, Math.ceil((T.target - bank) / T.u) * T.u));
    const pick = betFromPoint(X0 + CW_E / 2, ZN + ((history.length % 2 ? 3 : 2) * 2 + 1) * ROW);   // RED / BLACK alternately
    const vals = chipVals().slice().reverse(); let left = want;
    for (const v of vals) while (left >= v && placeBet(pick, v, true)) left -= v;
  },
};

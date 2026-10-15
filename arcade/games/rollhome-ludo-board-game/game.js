// Rollhome — original 3D race-home board game (the public-domain Ludo / Pachisi family), you vs three CPU players.
// Roll a 6 to bring a token out, race it clockwise round the cross, knock rivals back to their yard, and walk your colour lane home.
// Dice are fair (crypto random); the daily game uses one seeded dice stream so everyone gets the same rolls today.
import { THREE, createStage, createUI, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, clamp, applyPalette, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import * as kitBoard from './kit/board.js';   // `board` is a local name here
const B = kitBoard.board({ game: 'rollhome', label: 'Wins', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum' });   // world board (RULES.md part C)

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const NAME = 'Rollhome: Ludo Board Game';
const ST = createStage({ fov: 34, shadowSize: 11 });
const { scene, camera, sun, hemi, renderer } = ST;
sun.position.set(5, 18, 9); sun.intensity = 1.45; hemi.intensity = 1.25;
const ui = createUI({ title: 'ROLL<br>HOME', hint: 'Tap to play', hand: '🎲', score: false });
const D = daily('rollhome', ui, { name: NAME });
const save = store('rollhome');
const F = flow('rollhome');
applyPalette({ bg: ['#cfe8ff', '#fde2ff'], ui: '#3a86ff' });
{ const p = document.createElement('p'); p.textContent = 'Ludo board game · race all four colours home'; p.style.cssText = 'font-size:17px;opacity:.95'; ui.els.start.querySelector('h1').after(p); }
ui.els.win.querySelector('h1').textContent = 'HOME FIRST!';

// ---------------------------------------------------------------- board geometry (15 × 15 cross)
const TRACK = [];
for (let x = 1; x <= 5; x++) TRACK.push([x, 6]);
for (let y = 5; y >= 0; y--) TRACK.push([6, y]);
TRACK.push([7, 0]);
for (let y = 0; y <= 5; y++) TRACK.push([8, y]);
for (let x = 9; x <= 14; x++) TRACK.push([x, 6]);
TRACK.push([14, 7]);
for (let x = 14; x >= 9; x--) TRACK.push([x, 8]);
for (let y = 9; y <= 14; y++) TRACK.push([8, y]);
TRACK.push([7, 14]);
for (let y = 14; y >= 9; y--) TRACK.push([6, y]);
for (let x = 5; x >= 0; x--) TRACK.push([x, 8]);
TRACK.push([0, 7]); TRACK.push([0, 6]);
// players clockwise from the bottom-left (you): start index on the track, home lane, yard corner
const PL = [
  { name: 'You', col: '#3a86ff', dark: '#1f5fc9', start: 39, lane: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], yard: [0, 9], face: '😎' },
  { name: 'Rosa', col: '#ff4d6d', dark: '#c9294a', start: 0, lane: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], yard: [0, 0], face: '🦊' },
  { name: 'Gus', col: '#2ec27e', dark: '#1b8d58', start: 13, lane: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], yard: [9, 0], face: '🐢' },
  { name: 'Wren', col: '#ffbe0b', dark: '#d39400', start: 26, lane: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], yard: [9, 9], face: '🐝' },
];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const W3 = (x, y) => new V3(x - 7, 0, y - 7);
const CENTER = { 0: [7, 8.1], 1: [5.9, 7], 2: [7, 5.9], 3: [8.1, 7] };
const yardSpot = (p, i) => { const [yx, yy] = PL[p].yard; return [yx + 1.75 + (i % 2) * 2.5, yy + 1.75 + Math.floor(i / 2) * 2.5]; };
/** cell for a token's progress: -1 yard, 0..50 track, 51..55 lane, 56 home */
function cellOf(p, i, prog) {
  if (prog < 0) return yardSpot(p, i);
  if (prog <= 50) return TRACK[(PL[p].start + prog) % 52];
  if (prog <= 55) return PL[p].lane[prog - 51];
  return CENTER[p];
}
const absOf = (p, prog) => prog >= 0 && prog <= 50 ? (PL[p].start + prog) % 52 : -1;

// ---------------------------------------------------------------- build the board
const board = new THREE.Group(); scene.add(board);
/** flat board piece: rounded rectangle in plan view, extruded up from y = 0 to h */
function slab(w, d, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); return g;
}
const base = new THREE.Mesh(slab(16.2, 16.2, 0.7, 0.5), mat('#ffffff', { roughness: 0.6 }));
base.position.y = -0.78; base.receiveShadow = true; base.castShadow = true; board.add(base);
const under = new THREE.Mesh(new THREE.BoxGeometry(15.1, 0.06, 15.1), mat('#c9cfe0')); under.position.y = -0.04; under.receiveShadow = true; board.add(under);
{ // path cells (instanced, coloured per cell)
  const cells = [];
  TRACK.forEach(([x, y], k) => cells.push({ x, y, c: k === 39 ? PL[0].col : k === 0 ? PL[1].col : k === 13 ? PL[2].col : k === 26 ? PL[3].col : '#ffffff' }));
  PL.forEach(pl => pl.lane.forEach(([x, y]) => cells.push({ x, y, c: pl.col })));
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.93, 0.1, 0.93), mat('#ffffff', { roughness: 0.55 }), cells.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach((c, i) => { m4.makeTranslation(c.x - 7, 0.02, c.y - 7); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(c.c)); });
  im.receiveShadow = true; board.add(im);
}
// yards
PL.forEach((pl, p) => {
  const [yx, yy] = pl.yard, g = new THREE.Group(); g.position.set(yx + 3 - 7.5, 0, yy + 3 - 7.5); board.add(g);
  const outer = new THREE.Mesh(slab(5.8, 5.8, 0.12, 0.25), mat(pl.col)); outer.position.y = -0.04; outer.receiveShadow = true; g.add(outer);
  const inner = new THREE.Mesh(slab(4.4, 4.4, 0.06, 0.45), mat('#ffffff')); inner.position.y = 0.1; inner.receiveShadow = true; g.add(inner);
  for (let i = 0; i < 4; i++) { const [sx, sy] = yardSpot(p, i); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 28), mat(pl.col, { roughness: 0.4 })); r.position.set(sx - 7, 0.19, sy - 7); r.receiveShadow = true; board.add(r); }
});
// centre: four triangles pointing in
PL.forEach((pl, p) => {
  const s = new THREE.Shape(); s.moveTo(-1.5, 1.5); s.lineTo(1.5, 1.5); s.lineTo(0, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false }); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(pl.col)); m.position.y = 0.1; m.receiveShadow = true;
  m.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][p]; board.add(m);
});
{ const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 24), glossy('#ffffff')); cap.position.y = 0.15; cap.castShadow = true; board.add(cap); }
// stars on the safe squares
{
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.14 : 0.33, a = i * Math.PI / 5 - Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }); g.rotateX(Math.PI / 2);
  for (const k of [8, 21, 34, 47]) { const [x, y] = TRACK[k]; const m = new THREE.Mesh(g, mat('#b9c0d6')); m.position.set(x - 7, 0.11, y - 7); board.add(m); }
  // arrows into each lane
  for (const k of [0, 13, 26, 39]) { const [x, y] = TRACK[k]; const m = new THREE.Mesh(g, mat('#ffffff')); m.position.set(x - 7, 0.11, y - 7); m.scale.setScalar(0.85); board.add(m); }
}

// ---------------------------------------------------------------- tokens (lathe pawns)
const pawnGeo = (() => { const pts = [[0, 0], [0.38, 0], [0.4, 0.06], [0.33, 0.14], [0.2, 0.22], [0.15, 0.42], [0.13, 0.55], [0.2, 0.6], [0.0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)); return new THREE.LatheGeometry(pts, 28); })();
const headGeo = new THREE.SphereGeometry(0.2, 22, 16);
const ringGeo = new THREE.RingGeometry(0.42, 0.56, 32); ringGeo.rotateX(-Math.PI / 2);
const tokens = [];
PL.forEach((pl, p) => {
  const m = glossy(pl.col), rm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(), body = new THREE.Mesh(pawnGeo, m), head = new THREE.Mesh(headGeo, m);
    body.castShadow = head.castShadow = true; head.position.y = 0.72; g.add(body, head);
    const ring = new THREE.Mesh(ringGeo, rm); ring.position.y = 0.05; ring.visible = false; g.add(ring);
    scene.add(g); tokens.push({ p, i, prog: -1, g, ring, pos: new V3(), anim: null, sq: 0 });
  }
});

// ---------------------------------------------------------------- dice
const pipTex = (n) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 30, 64, 64, 96); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.8, '#f4f1fb'); gr.addColorStop(1, '#d9d4ea'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.fillStyle = n === 1 ? '#ff4d6d' : '#22223b';
  const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] }[n];
  for (const [x, y] of P) { g.beginPath(); g.arc(x, y, n === 1 ? 17 : 12, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const FACE_VAL = [3, 4, 1, 6, 2, 5];   // +x −x +y −y +z −z
const NORMALS = [new V3(1, 0, 0), new V3(-1, 0, 0), new V3(0, 1, 0), new V3(0, -1, 0), new V3(0, 0, 1), new V3(0, 0, -1)];
const dieMats = FACE_VAL.map(v => new THREE.MeshStandardMaterial({ map: pipTex(v), roughness: 0.35 }));
const die = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25, 1, 1, 1), dieMats);
die.castShadow = true; scene.add(die);
const dieShadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.15, depthWrite: false }));
dieShadow.rotation.x = -Math.PI / 2; scene.add(dieShadow);
const dieSpot = (p) => [new V3(-1.7, 0, 10.4), new V3(-1.7, 0, -10.4), new V3(1.7, 0, -10.4), new V3(1.7, 0, 10.4)][p];
let dieAnim = null; const dieHome = new V3().copy(dieSpot(0)); die.position.copy(dieHome).setY(0.65); dieShadow.position.copy(dieHome).setY(0.01);
function faceQuat(v, yaw) { const q = new Q().setFromUnitVectors(NORMALS[FACE_VAL.indexOf(v)], new V3(0, 1, 0)); return new Q().setFromAxisAngle(new V3(0, 1, 0), yaw).multiply(q); }

// ---------------------------------------------------------------- HUD (four corner tags)
const css = document.createElement('style'); css.textContent = `
.rh-tag{position:fixed;z-index:6;display:flex;align-items:center;gap:8px;pointer-events:none;color:#2b2d42;font-weight:800;transition:transform .25s}
.rh-tag .av{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;background:#fff;box-shadow:0 4px 0 var(--d),0 0 0 3px var(--c) inset}
.rh-tag.on .av{box-shadow:0 4px 0 var(--d),0 0 0 3px var(--c) inset,0 0 0 5px #fff,0 0 22px var(--c)}
.rh-tag.on{transform:scale(1.1)}
.rh-tag .nm{font-size:16px;line-height:1}.rh-tag .dots{display:flex;gap:3px;margin-top:4px}
.rh-tag .dots i{width:10px;height:10px;border-radius:50%;background:rgba(43,45,66,.15)}.rh-tag .dots i.h{background:var(--c)}
.rh-tag.r{flex-direction:row-reverse;text-align:right}.rh-tag.r .dots{justify-content:flex-end}
#rh-hint{position:fixed;left:0;right:0;z-index:6;text-align:center;font-weight:800;font-size:20px;color:#2b2d42;pointer-events:none;animation:hcpulse 1.2s infinite;text-shadow:0 2px 0 rgba(255,255,255,.6)}
#rh-need{position:fixed;left:0;right:0;z-index:5;text-align:center;font-weight:700;font-size:14px;color:#2b2d42;opacity:.7;pointer-events:none}
`; document.head.appendChild(css);
const tags = PL.map((pl, p) => { const d = document.createElement('div'); d.className = 'rh-tag' + (p >= 2 ? ' r' : ''); d.style.setProperty('--c', pl.col); d.style.setProperty('--d', pl.dark); d.innerHTML = `<div class="av">${pl.face}</div><div><div class="nm">${pl.name}</div><div class="dots">${'<i></i>'.repeat(4)}</div></div>`; document.body.appendChild(d); return d; });
const hintEl = document.createElement('div'); hintEl.id = 'rh-hint'; document.body.appendChild(hintEl);
const needEl = document.createElement('div'); needEl.id = 'rh-need'; document.body.appendChild(needEl);
const toScreen = (v) => { const q = v.clone().project(camera); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight }; };

// ---------------------------------------------------------------- camera fit
const target = new V3(0, 0, 0.2);
function frame() {
  const a = innerWidth / innerHeight, vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * a);
  const halfW = 8.7, halfH = 11.6;
  const d = Math.max(halfW / Math.tan(hf / 2), halfH / Math.tan(vf / 2)) * 1.0;
  const tilt = 0.5; camera.position.set(0, d * Math.cos(tilt), d * Math.sin(tilt)).add(target); camera.lookAt(target);
  camera.updateMatrixWorld();
  // tags above/below the board corners
  const place = (p, w) => { const s = toScreen(w), t = tags[p]; t.style.left = (p >= 2 ? 'auto' : '12px'); t.style.right = (p >= 2 ? '12px' : 'auto'); t.style.top = s.y - 23 + 'px'; };
  place(0, new V3(-6, 0, 10.6)); place(3, new V3(6, 0, 10.6)); place(1, new V3(-6, 0, -10.6)); place(2, new V3(6, 0, -10.6));
  const b = toScreen(new V3(0, 0, 12.2)); hintEl.style.top = Math.min(innerHeight - 40, b.y) + 'px';
  needEl.style.top = '58px';
}
addEventListener('resize', frame); frame();

// ---------------------------------------------------------------- state
let state = 'ready', level = save.get('level', 1), score = 0, turn = 0, phase = 'idle', roll = 0, sixes = 0, need = 1, skill = 0.5;
let recorded = false, beatenShown = false, movable = [], lastMs = 0;
const done = [0, 0, 0, 0];
let dice = Math.random;
const cryptoDie = () => { const u = new Uint8Array(1); do { crypto.getRandomValues(u); } while (u[0] >= 252); return (u[0] % 6) + 1; };
let rollDie = cryptoDie;

function placeTokens(snap = false) {
  const groups = new Map();
  for (const t of tokens) { const [x, y] = cellOf(t.p, t.i, t.prog), k = t.prog < 0 ? `y${t.p}${t.i}` : `${x},${y}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  for (const [k, list] of groups) list.forEach((t, j) => {
    const [x, y] = cellOf(t.p, t.i, t.prog), n = list.length, off = n > 1 ? 0.22 : 0, a = j / n * Math.PI * 2 + 0.6;
    t.home = W3(x + Math.cos(a) * off, y + Math.sin(a) * off); t.home.y = t.prog < 0 ? 0.26 : t.prog >= 56 ? 0.18 : 0.08;
    t.scale = (n > 1 ? 0.78 : t.prog >= 56 ? 0.7 : 1) * 1.35;
    if (snap || !t.anim) { if (snap) t.g.position.copy(t.home); }
  });
}
function updateTags() {
  PL.forEach((pl, p) => { const t = tags[p]; t.classList.toggle('on', state === 'play' && turn === p); t.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('h', i < done[p])); });
  ui.progress(tokens.filter(t => t.p === 0).reduce((a, t) => a + Math.max(0, t.prog + 1), 0) / (need * 57));
}

// ---------------------------------------------------------------- rules
function canMove(t, r) { if (t.prog >= 56) return false; if (t.prog < 0) return r === 6; return t.prog + r <= 56; }
function threatAt(p, a) {   // how many rival tokens sit 1–6 squares behind track square a
  if (a < 0 || SAFE.has(a)) return 0; let n = 0;
  for (const o of tokens) { if (o.p === p || o.prog < 0 || o.prog > 50) continue; const oa = absOf(o.p, o.prog), d = (a - oa + 52) % 52; if (d >= 1 && d <= 6 && o.prog + d <= 50) n++; }
  return n;
}
function evalMove(t, r) {
  const np = t.prog < 0 ? 0 : t.prog + r, a = absOf(t.p, np); let s = np * 0.4;
  if (np === 56) s += 80;
  if (t.prog < 0) s += 55;
  if (a >= 0 && !SAFE.has(a) && tokens.some(o => o.p !== t.p && o.prog >= 0 && o.prog <= 50 && absOf(o.p, o.prog) === a)) s += 100;
  if (a >= 0 && SAFE.has(a)) s += 18;
  if (np > 50 && t.prog <= 50) s += 30;
  s -= threatAt(t.p, a) * 35;
  s += threatAt(t.p, absOf(t.p, t.prog)) * 30;
  return s;
}
function chooseFor(p, smart) {
  if (!smart) return movable[Math.floor(Math.random() * movable.length)];
  return movable.slice().sort((a, b) => evalMove(b, roll) - evalMove(a, roll))[0];
}

// ---------------------------------------------------------------- turn flow
function startTurn() {
  if (state !== 'play') return;
  phase = 'roll'; updateTags(); moveDieTo(turn);
  hintEl.textContent = turn === 0 ? 'Tap to roll' : ''; hintEl.style.color = PL[turn].dark;
  if (turn !== 0) setTimeout(doRoll, 170);
}
function moveDieTo(p) { dieHome.copy(dieSpot(p)); }
function doRoll() {
  if (state !== 'play' || phase !== 'roll') return;
  phase = 'rolling'; hintEl.textContent = '';
  roll = rollDie();
  const from = die.position.clone(), q0 = die.quaternion.clone(), yaw = (Math.random() - 0.5) * 0.7;
  dieAnim = { t: 0, dur: 22, from, q0, q1: faceQuat(roll, yaw), spin: new V3(Math.random() * 0.6 + 0.3, Math.random() * 0.5, Math.random() * 0.6 + 0.3) };
  tone(520, 0.04, 'square', 0.05, 0.8);
}
function afterRoll() {
  sfx.bounce(); buzz(10);
  if (roll === 6) { sixes++; if (sixes === 3) { pop(turn, 'Three 6s — pass', '#2b2d42'); sixes = 0; return setTimeout(nextTurn, 700); } }
  movable = tokens.filter(t => t.p === turn && canMove(t, roll));
  if (!movable.length) { if (turn === 0) pop(0, 'No move', '#2b2d42'); return setTimeout(() => roll === 6 ? startTurn() : nextTurn(), 380); }
  phase = 'pick';
  if (turn === 0) {
    const uniq = new Set(movable.map(t => t.prog < 0 ? -1 : t.prog));
    if (uniq.size === 1) return setTimeout(() => moveToken(movable[0]), 200);
    movable.forEach(t => t.ring.visible = true); hintEl.textContent = 'Tap a token';
  } else setTimeout(() => moveToken(chooseFor(turn, Math.random() < skill)), 150);
}
function pop(p, text, color) { const s = toScreen(dieSpot(p).clone().setY(1.5)); ui.pop(text, color || PL[p].dark, 26, Math.max(8, s.y / innerHeight * 100 - 6)); }
function moveToken(t) {
  if (phase !== 'pick') return;
  phase = 'moving'; tokens.forEach(k => k.ring.visible = false); hintEl.textContent = '';
  const path = [];
  if (t.prog < 0) path.push(0); else for (let s = 1; s <= roll; s++) path.push(t.prog + s);
  t.anim = { path, k: 0, t: 0, from: t.g.position.clone(), cb: () => land(t) };
  if (t.p === 0) score += path.length;
}
function land(t) {
  let extra = roll === 6, msg = '';
  const a = absOf(t.p, t.prog);
  if (a >= 0 && !SAFE.has(a)) {
    const hit = tokens.filter(o => o.p !== t.p && o.prog >= 0 && o.prog <= 50 && absOf(o.p, o.prog) === a);
    if (hit.length) {
      extra = true; hit.forEach(o => { o.prog = -1; o.sq = 1; }); msg = 'CAPTURE!';
      burst(scene, t.g.position.clone().setY(0.6), [PL[hit[0].p].col, '#ffffff'], 26, { speed: 0.14, up: 0.14, size: 0.9 }); sfx.smash(); buzz([20, 40, 30]); ui.flash(0.35);
      if (t.p === 0) { score += 20; } else if (hit.some(o => o.p === 0)) pop(0, 'Knocked home!', PL[t.p].dark);
    }
  }
  if (t.prog === 56) {
    extra = true; done[t.p]++; msg = 'HOME!';
    burst(scene, new V3(0, 0.8, 0), [PL[t.p].col, '#fff', '#ffd23f'], 30, { speed: 0.12, up: 0.18, size: 0.8 }); sfx.win();
    if (t.p === 0) score += 30;
  }
  if (msg) pop(t.p, msg, PL[t.p].dark);
  placeTokens(); updateTags();
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new V3(0, 1, 0), 60); }
  if (done[t.p] >= need) return setTimeout(() => endGame(t.p), 450);
  if (extra) { if (roll !== 6) sixes = 0; return setTimeout(startTurn, 260); }
  setTimeout(nextTurn, 200);
}
function nextTurn() { sixes = 0; turn = (turn + 1) % 4; startTurn(); }

// ---------------------------------------------------------------- input: tap rolls, or picks the nearest glowing token
addEventListener('pointerdown', (e) => {
  if (state !== 'play' || turn !== 0) return;
  if (phase === 'roll') return doRoll();
  if (phase !== 'pick') return;
  let best = null, bd = 70;
  for (const t of movable) { const s = toScreen(t.g.position.clone().setY(0.4)), d = Math.hypot(s.x - e.clientX, s.y - e.clientY); if (d < bd) { bd = d; best = t; } }
  if (best) moveToken(best); else sfx.tap();
});

// ---------------------------------------------------------------- level flow
function build() {
  const fk = D.isDaily ? 1 : F.k(), L = D.isDaily ? 4 : level;
  need = L <= 2 ? 1 : L <= 5 ? 2 : L <= 9 ? 3 : 4;
  skill = clamp((0.4 + Math.min(L, 12) * 0.045) * fk, 0.25, 0.98);
  rollDie = D.seed ? (() => { const r = rng(D.seed); return () => 1 + Math.floor(r() * 6); })() : cryptoDie;
  tokens.forEach(t => { t.prog = need === 1 && t.i === 0 ? 0 : -1; t.anim = null; t.ring.visible = false; t.sq = 0; });   // quick race: one token of each colour starts out
  done.fill(0); score = 0; turn = 0; sixes = 0; phase = 'idle'; recorded = false; beatenShown = false;
  placeTokens(true); updateTags(); moveDieTo(0);
  ui.levels(D.isDaily ? 1 : level); if (D.isDaily) { ui.els.top.querySelector('[data-a]').textContent = '★'; ui.els.top.querySelector('[data-b]').textContent = '✓'; }
  needEl.textContent = need === 1 ? 'Quick race · one token starts out · first one home wins' : `First to bring ${need} tokens home wins`;
}
function endGame(p) {
  if (state !== 'play') return;
  phase = 'idle'; hintEl.textContent = '';
  if (p === 0) {
    state = 'won'; if (!recorded) { recorded = true; if (!D.isDaily) F.level(true); B.submit(1); }
    score += 100; confetti(scene, new V3(0, 2, 2), 120); sfx.win(); buzz([30, 60, 30]);
    if (!D.isDaily) { level++; save.set('level', level); }
    const best = save.get('best', 0); if (score > best) save.set('best', score);
    D.won(score); updateTags();
    ui.win(D.isDaily ? 'Daily' : level - 1, `${score} pts`);
  } else {
    state = 'lost';
    const mine = tokens.filter(t => t.p === 0).reduce((a, t) => a + Math.max(0, t.prog + 1), 0) / (need * 57);
    if (!recorded) { recorded = true; if (!D.isDaily) F.level(false, mine); }
    sfx.fail(); updateTags();
    ui.lose(`${PL[p].name} got home`, `You were ${Math.round(mine * 100)}% of the way`);
  }
}
ui.onTap((which) => {
  B.start();
  if (which === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (which !== 'start') build();
  state = 'play'; setTimeout(startTurn, 250);
});
build();

// ---------------------------------------------------------------- loop
const ease = (x) => 1 - Math.pow(1 - x, 3);
loop((dt, T) => {
  // tokens: hop along the path, otherwise ease to their spot
  for (const t of tokens) {
    if (t.anim) {
      const A = t.anim; A.t += dt / 3.6;
      const [x, y] = cellOf(t.p, t.i, A.path[A.k]), to = W3(x, y); to.y = 0.08;
      const k = Math.min(1, A.t);
      t.g.position.lerpVectors(A.from, to, k); t.g.position.y += Math.sin(k * Math.PI) * 0.75;
      t.g.scale.set(1.35, 1.35 * (1 + Math.sin(k * Math.PI) * 0.15), 1.35);
      if (A.t >= 1) {
        t.prog = A.path[A.k]; A.k++; A.t = 0; A.from = to.clone(); t.sq = 0.6;
        note(60 + Math.min(t.prog, 56) % 12 + (t.p === 0 ? 12 : 0), 0.12, 0.08);
        if (A.k >= A.path.length) { t.anim = null; placeTokens(); A.cb(); }
      }
    } else if (t.home) {
      t.g.position.lerp(t.home, Math.min(1, 0.2 * dt));
      const s = t.scale || 1.35, sq = t.sq; t.sq = Math.max(0, t.sq - 0.06 * dt);
      t.g.scale.set(s * (1 + sq * 0.25), s * (1 - sq * 0.3), s * (1 + sq * 0.25));
    }
    if (t.ring.visible) { const k = 1 + Math.sin(T * 8) * 0.12; t.ring.scale.set(k, 1, k); t.g.position.y = t.home.y + Math.abs(Math.sin(T * 6)) * 0.25; }
  }
  // die: tumble in an arc, settle on the rolled face
  if (dieAnim) {
    const A = dieAnim; A.t += dt; const k = Math.min(1, A.t / A.dur);
    const p = A.from.clone().lerp(dieHome, ease(k)); p.y = 0.65 + Math.sin(k * Math.PI) * 2.6 * (1 - k * 0.4);
    die.position.copy(p);
    if (k < 0.72) { die.rotateX(A.spin.x * dt); die.rotateY(A.spin.y * dt); die.rotateZ(A.spin.z * dt); A.q0.copy(die.quaternion); }
    else die.quaternion.copy(A.q0).slerp(A.q1, ease((k - 0.72) / 0.28));
    if (k >= 1) { dieAnim = null; die.quaternion.copy(A.q1); die.scale.set(1.12, 0.86, 1.12); afterRoll(); }
  } else {
    die.position.lerp(new V3(dieHome.x, 0.65 + (state === 'play' && phase === 'roll' && turn === 0 ? Math.abs(Math.sin(T * 4)) * 0.35 : 0), dieHome.z), Math.min(1, 0.15 * dt));
    die.scale.lerp(new V3(1, 1, 1), 0.15 * dt);
  }
  dieShadow.position.set(die.position.x, 0.01, die.position.z); dieShadow.scale.setScalar(1 - Math.min(0.5, (die.position.y - 0.65) * 0.15));
  ST.followLight(new V3(0, 0, 0));
});

// ---------------------------------------------------------------- test hook
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get debug() { return { turn, phase, roll, prog: tokens.map(t => t.prog).join(',') }; },
  bot() {
    if (state !== 'play' || turn !== 0) return;
    if (phase === 'roll') return doRoll();
    if (phase === 'pick') return moveToken(chooseFor(0, true));
  },
};

// Comb Stack — drag stacks of hexagon tiles onto the honeycomb board. Neighbouring stacks with the same colour on top
// slide together, tile by tile with a flip. Ten of one colour on a stack clears it. Clear the goal before the board fills.
import { THREE, createStage, createUI, loop, glossy, mat, rounded, burst, confetti, sfx, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import * as kitBoard from './kit/board.js';   // `board` is a local name here
const B = kitBoard.board({ game: 'comb-stack', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Comb Stack: Hex Tile Stacking';
const S = createStage({ fov: 30, shadowSize: 7 });
const { scene, camera, sun, hemi, renderer } = S;
sun.position.set(-3, 14, 6); sun.intensity = 1.45; hemi.intensity = 1.3;
const ui = createUI({ title: 'COMB<br>STACK', hint: 'Drag a stack onto the board', hand: '👆', score: false });
const D = daily('combstack', ui, { name: NAME });
const save = store('combstack');
const F = flow('combstack');
let level = save.get('level', 1), totalCleared = save.get('cleared', 0);

const COLORS = ['#ff5a6e', '#ffc23a', '#3d8bff', '#3fcf6e', '#a66bff', '#ff7ac6', '#22c4c4'];
const BGS = [['#9fd8ff', '#e6f7ff'], ['#c7b8ff', '#f1ebff'], ['#ffc7d9', '#fff0f5'], ['#a8ecd3', '#ecfff7'], ['#ffd8a8', '#fff6e8']];
const css = document.createElement('style'); css.textContent = `
.hc-card{background:rgba(40,80,140,.2)} .hc-card.dim{background:rgba(30,40,80,.4)}
.hc-pop{-webkit-text-stroke:5px rgba(30,70,140,.35);paint-order:stroke fill}
.cs-goal{position:fixed;top:calc(58px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.85);color:#33507a;font:800 22px 'Baloo 2',system-ui;padding:2px 16px 0 8px;border-radius:22px;box-shadow:0 4px 0 rgba(30,70,140,.15);z-index:5;pointer-events:none}
.cs-goal i{display:inline-block;width:26px;height:26px;background:linear-gradient(135deg,#ffc23a,#ff7ac6 55%,#3d8bff);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.cs-goal.bump{animation:csb .3s}
@keyframes csb{50%{transform:translateX(-50%) scale(1.18)}}
`; document.head.appendChild(css);
const goalEl = document.createElement('div'); goalEl.className = 'cs-goal'; goalEl.innerHTML = '<i></i><span>0/40</span>'; document.body.appendChild(goalEl);

// ---------------------------------------------------------------- geometry
const SIZE = 0.56, TH = 0.15, CLEAR_N = 10;
function hexShape(r, rr) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI / 6 + i * Math.PI / 3, a1 = a0 + Math.PI / 3, ca = Math.cos(a0) * r, sa = Math.sin(a0) * r;
    const pa = [Math.cos(a0 - Math.PI / 3) * r, Math.sin(a0 - Math.PI / 3) * r], pb = [Math.cos(a1) * r, Math.sin(a1) * r];
    const k = rr / r, p1 = [ca + (pa[0] - ca) * k, sa + (pa[1] - sa) * k], p2 = [ca + (pb[0] - ca) * k, sa + (pb[1] - sa) * k];
    i === 0 ? s.moveTo(p1[0], p1[1]) : s.lineTo(p1[0], p1[1]); s.quadraticCurveTo(ca, sa, p2[0], p2[1]);
  }
  return s;
}
function hexGeo(r, h, bev) {
  const g = new THREE.ExtrudeGeometry(hexShape(r - bev, 0.09), { depth: h - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, bev, 0); return g;   // bottom at y=0, top at y=h
}
const TILE = hexGeo(SIZE * 0.9, TH * 0.92, 0.035), PLATE = hexGeo(SIZE * 0.96, 0.16, 0.05);
const tileMat = glossy('#ffffff', { roughness: 0.28 });
const MAXT = 900;
const tiles = new THREE.InstancedMesh(TILE, tileMat, MAXT); tiles.castShadow = true; tiles.receiveShadow = true; tiles.count = 0;
tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(tiles);
tiles.setColorAt(0, new THREE.Color()); // allocate colour buffer
const plateMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.05, emissive: '#dfeeff', emissiveIntensity: 0.35 });
let plates = null;
const tmpC = new THREE.Color(), tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), ts = new THREE.Vector3(), tp = new THREE.Vector3();
const COLS = COLORS.map((c) => new THREE.Color(c));

// count labels (cached canvas textures)
const labelTex = {};
function labTex(n) {
  if (labelTex[n]) return labelTex[n];
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.font = "800 62px 'Baloo 2', system-ui"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = 'rgba(20,30,60,.45)'; g.strokeText(n, 48, 54); g.fillStyle = '#fff'; g.fillText(n, 48, 54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (labelTex[n] = t);
}
document.fonts && document.fonts.ready.then(() => { for (const k in labelTex) { labelTex[k].dispose(); delete labelTex[k]; } });

// ---------------------------------------------------------------- board
let cells = [], offers = [], tileList = [], cleared = 0, goal = 40, nCol = 3, state = 'ready', busy = false, recorded = false, R = Math.random, beatenShown = false, combo = 0;
const board = new THREE.Group(); scene.add(board);
const SQ3 = Math.sqrt(3);
const axial = (q, r) => new THREE.Vector3(SIZE * SQ3 * (q + r / 2), 0, SIZE * 1.5 * r);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

function makeBoard(seed) {
  const r0 = rng(seed), rows = level < 3 ? 2 : 3, L = [];
  for (let r = -rows; r <= rows; r++) for (let q = -6; q <= 6; q++) {
    const p = axial(q, r); if (Math.abs(p.x) > SIZE * SQ3 * 2.01) continue;      // ≤5 across
    if (rows >= 3 && Math.abs(r) === rows && Math.abs(p.x) > SIZE * SQ3 * 1.4 && r0() < 0.8) continue;   // soften corners
    L.push({ q, r, p });
  }
  return L;
}
function buildLevel() {
  const fk = F.k(), seed = D.seed ? D.seed : level * 5167 + 29;
  R = rng(seed + 7);
  nCol = clamp(3 + Math.floor((level - 1) / 3) + (fk > 1.12 ? 1 : 0), 3, COLORS.length);
  goal = Math.round(clamp((18 + level * 12) * fk, 25, 260) / 5) * 5;
  cleared = 0; combo = 0; busy = false; recorded = false; beatenShown = false;
  for (const c of cells) if (c.label) board.remove(c.label);
  const L = makeBoard(seed);
  cells = L.map((c, i) => ({ i, q: c.q, r: c.r, p: c.p, stack: [], label: null, glow: 0 }));
  const key = new Map(cells.map((c) => [c.q + ',' + c.r, c]));
  for (const c of cells) c.nb = DIRS.map(([dq, dr]) => key.get((c.q + dq) + ',' + (c.r + dr))).filter(Boolean);
  if (plates) { board.remove(plates); plates.dispose(); }
  plates = new THREE.InstancedMesh(PLATE, plateMat, cells.length); plates.receiveShadow = true;
  cells.forEach((c, i) => { tm.makeTranslation(c.p.x, -0.16, c.p.z); plates.setMatrixAt(i, tm); plates.setColorAt(i, tmpC.set('#ffffff')); });
  board.add(plates);
  tileList = [];
  // a few starting stacks on later levels
  const pre = level < 2 ? 0 : Math.min(6, 1 + Math.floor(level / 2));
  const free = cells.slice(); for (let k = 0; k < pre && free.length > 4; k++) {
    const c = free.splice(Math.floor(R() * free.length), 1)[0];
    for (const col of randomStack(true)) addTile(c, col, true);
  }
  for (const c of cells) fixStackTiles(c, true);
  for (const o of offers) if (o.label) scene.remove(o.label);
  offers = [0, 1, 2].map((k) => ({ k, stack: null, home: new THREE.Vector3() }));
  fit(); refill();
  const bg = BGS[(level - 1) % BGS.length]; document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]);
  document.body.style.setProperty('--ui', ['#2f8be0', '#7b5cff', '#ff5d8f', '#22a97a', '#ff8c42'][(level - 1) % 5]);
  ui.levels(level); updateGoal();
}
function randomStack(pre) {
  const h = 2 + Math.floor(R() * (pre ? 4 : 5)), segs = 1 + Math.floor(R() * Math.min(3, nCol - 0.01)), out = [];
  let last = -1, cols = [];
  for (let s = 0; s < segs; s++) { let c; do c = Math.floor(R() * nCol); while (c === last && nCol > 1); cols.push(c); last = c; }
  for (let i = 0; i < h; i++) out.push(cols[Math.min(segs - 1, Math.floor(i * segs / h))]);
  return out;
}
function addTile(c, col, instant) {
  const t = { col, pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, fly: null, pop: 0 };
  c.stack.push(t); tileList.push(t); if (instant) t.pos.copy(slotPos(c, c.stack.length - 1)); return t;
}
const slotPos = (c, k) => new THREE.Vector3(c.p.x, k * TH, c.p.z);
function fixStackTiles(c) { c.stack.forEach((t, k) => { if (!t.fly) t.pos.copy(slotPos(c, k)); }); updateLabel(c); }
function topRun(stack) { if (!stack.length) return 0; const c = stack[stack.length - 1].col; let n = 0; for (let i = stack.length - 1; i >= 0 && stack[i].col === c; i--) n++; return n; }
const topCol = (c) => c.stack.length ? c.stack[c.stack.length - 1].col : -1;
function updateLabel(c) {
  if (!c.stack.length) { if (c.label) c.label.visible = false; return; }
  if (!c.label) { c.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labTex(1), depthTest: false, transparent: true })); c.label.scale.set(0.5, 0.5, 1); c.label.renderOrder = 10; board.add(c.label); }
  c.label.visible = true; c.label.material.map = labTex(topRun(c.stack)); c.label.position.set(c.p.x, c.stack.length * TH + 0.12, c.p.z);
}

// offers
let offerZ = 3;
const dock = new THREE.Mesh(rounded(4.5, 0.1, 1.25, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, transparent: true, opacity: 0.4 }));
dock.receiveShadow = true; scene.add(dock);
function fit() {
  let minZ = 1e9, maxZ = -1e9, maxX = 0; for (const c of cells) { minZ = Math.min(minZ, c.p.z); maxZ = Math.max(maxZ, c.p.z); maxX = Math.max(maxX, Math.abs(c.p.x)); }
  offerZ = maxZ + 3.3;
  offers.forEach((o, k) => o.home.set((k - 1) * 1.55, 0.0, offerZ));
  dock.position.set(0, -0.2, offerZ);
  const ang = 0.98, top = new THREE.Vector3(0, 0, minZ - SIZE), bot = new THREE.Vector3(0, 0, offerZ + 0.75), side = new THREE.Vector3(maxX + SIZE * 1.05, 0, maxZ);
  let cz = (minZ + offerZ) / 2, d = 12;
  for (let it = 0; it < 80; it++) {
    camera.position.set(0, Math.sin(ang) * d, cz + Math.cos(ang) * d); camera.lookAt(0, 0, cz); camera.updateMatrixWorld();
    const ty = top.clone().project(camera).y, by = bot.clone().project(camera).y, sx = side.clone().project(camera).x;
    const k = Math.max((ty - by) / 1.3, sx / 0.94);
    d = clamp(d * Math.pow(k, 0.5), 4, 60);
    cz -= ((ty + by) / 2 - -0.07) * d * 0.25;
  }
  sun.target.position.set(0, 0, cz); sun.position.set(-3, 14, cz + 6);
}
addEventListener('resize', () => fit());
function refill() {
  if (offers.some((o) => o.stack)) return;
  offers.forEach((o, k) => {
    o.stack = randomStack(false).map((col) => { const t = { col, pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, fly: null, pop: 0 }; tileList.push(t); return t; });
    o.enter = 1 + k * 0.25; o.off = new THREE.Vector3(); placeOffer(o);
  });
}
function offerLabel(o) {
  if (!o.label) { o.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labTex(1), depthTest: false, transparent: true })); o.label.scale.set(0.5, 0.5, 1); o.label.renderOrder = 10; scene.add(o.label); }
  o.label.visible = !!o.stack; if (o.stack) o.label.material.map = labTex(topRun(o.stack));
}
function placeOffer(o, at) {
  const base = at || o.home;
  o.stack.forEach((t, k) => { t.pos.set(base.x, base.y + k * TH + (o.enter > 0 ? o.enter * 3 : 0), base.z); });
}

// ---------------------------------------------------------------- input (drag a stack)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let drag = null;
function groundAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null; }
function screenOf(p) { const v = p.clone().project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }
function nearestFree(p, maxD = SIZE * 1.15) { let b = null, bd = maxD; for (const c of cells) { if (c.stack.length) continue; const d = Math.hypot(c.p.x - p.x, c.p.z - p.z); if (d < bd) { bd = d; b = c; } } return b; }
let sel = null;   // tap controls: tap a stack (it lifts), then tap a free cell to place it
addEventListener('pointerdown', (e) => {
  if (state !== 'play' || busy) return;
  let best = null, bd = 70;
  for (const o of offers) { if (!o.stack) continue; const [sx, sy] = screenOf(o.home.clone().setY(0.3)); const d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < bd) { bd = d; best = o; } }
  if (!best && sel && sel.stack) { const g = groundAt(e.clientX, e.clientY); const c = g && nearestFree(g); const o = sel; sel = null; if (c) place(o, c); else tone(260, 0.07, 'triangle', 0.06, 0.8); return; }
  if (best) { drag = { o: best, at: best.home.clone(), target: null, x0: e.clientX, y0: e.clientY, moved: false }; sfx.pick(0); buzz(6); }
});
addEventListener('pointermove', (e) => {
  if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 12) return; drag.moved = true;
  const g = groundAt(e.clientX, e.clientY); if (!g) return;
  drag.at.set(g.x, 0.45, g.z - 0.85);
  const c = nearestFree(drag.at); if (c !== drag.target) { drag.target = c; if (c) tone(700, 0.03, 'sine', 0.05, 1.1); }
});
addEventListener('pointerup', () => {
  if (!drag) return; const { o, target, moved } = drag; drag = null;
  if (!moved) { sel = sel === o ? null : o; return; }   // a tap selects (or drops the selection)
  sel = null;
  if (target && state === 'play') place(o, target); else { tone(260, 0.07, 'triangle', 0.06, 0.8); }
});

// ---------------------------------------------------------------- placing + resolving
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function place(o, c) {
  busy = true; const st = o.stack; o.stack = null;
  const from = st.map((t) => t.pos.clone());
  st.forEach((t, k) => { c.stack.push(t); t.fly = { from: from[k], to: slotPos(c, k), t: -k * 0.012, dur: 0.16, arc: 0.25, flip: false }; });
  sfx.tap(); buzz(10);
  await wait(230); c.glow = 1; updateLabel(c);
  combo = 0;
  await resolve([c]);
  if (state !== 'play') { busy = false; return; }
  refill(); busy = false;
  if (cleared >= goal) return win();
  if (!cells.some((x) => !x.stack.length)) return lose();
}
async function resolve(queue) {
  let guard = 0;
  while (queue.length && guard++ < 200) {
    const X = queue.shift(); if (!X.stack.length) continue;
    const col = topCol(X), N = X.nb.filter((n) => n.stack.length && topCol(n) === col);
    if (!N.length) { if (await tryClear(X)) queue.push(X, ...X.nb); continue; }
    const pure = (c) => c.stack.every((t) => t.col === col);
    let target = X, group = [X, ...N];
    if (pure(X)) { const mixed = N.find((n) => !pure(n)); if (mixed) target = mixed; }
    const sources = group.filter((g) => g !== target);
    for (const s of sources) await transfer(s, target);
    queue.unshift(target); for (const s of sources) queue.push(s, ...s.nb);
    if (await tryClear(target)) queue.push(target, ...target.nb);
  }
}
async function transfer(src, dst) {
  const n = topRun(src.stack), moving = src.stack.splice(src.stack.length - n, n).reverse();
  updateLabel(src);
  moving.forEach((t, k) => {
    const to = slotPos(dst, dst.stack.length); dst.stack.push(t);
    t.fly = { from: t.pos.clone(), to, t: -k * 0.055, dur: 0.24, arc: 0.55 + k * 0.02, flip: true, dir: new THREE.Vector3(to.x - t.pos.x, 0, to.z - t.pos.z).normalize() };
  });
  const tot = moving.length * 55 + 250;
  for (let k = 0; k < moving.length; k++) setTimeout(() => tone(620 + k * 40, 0.04, 'triangle', 0.07, 1.15), k * 55 + 150);
  await wait(tot); updateLabel(dst); dst.glow = 1; buzz(6);
}
async function tryClear(c) {
  const n = topRun(c.stack); if (n < CLEAR_N) return false;
  const col = topCol(c), gone = c.stack.splice(c.stack.length - n, n);
  gone.forEach((t, k) => { t.pop = 0.001 + k * 0.03; });
  combo++; cleared += n; totalCleared += n; save.set('cleared', totalCleared);
  ui.pop(combo > 1 ? `COMBO x${combo}!` : `+${n}`, '#fff', combo > 1 ? 40 : 36, 24);
  const [sx, sy] = screenOf(c.p); void sx; void sy;
  burst(scene, slotPos(c, c.stack.length + n / 2), [COLORS[col], '#ffffff'], 26, { speed: 0.12, up: 0.12, size: 0.7, shape: 'sphere' });
  [76, 79, 83, 88].forEach((m, k) => setTimeout(() => note(m + combo, 0.25, 0.13), k * 60)); buzz([15, 30, 15]);
  ui.flash(0.25); updateGoal(); updateLabel(c);
  if (!beatenShown && D.beaten(cleared)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, new THREE.Vector3(0, 2, 0), 40); }
  await wait(420);
  return true;
}
function updateGoal() {
  goalEl.querySelector('span').textContent = `${Math.min(cleared, goal)}/${goal}`; goalEl.classList.remove('bump'); void goalEl.offsetWidth; goalEl.classList.add('bump');
  ui.progress(cleared / goal);
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  sfx.win(); confetti(scene, new THREE.Vector3(0, 2, 0), 90); ui.flash(0.5);
  level++; save.set('level', level); D.won(cleared, 'cleared'); ui.win(level - 1, `${cleared} tiles cleared`);
}
function lose() {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, cleared / goal); }
  sfx.fail(); buzz([30, 40, 30]); ui.lose('BOARD FULL!', `${cleared}/${goal} cleared`);
}

// ---------------------------------------------------------------- bot
function bot() {
  if (state !== 'play' || busy || drag) return;
  let best = null, bs = -1e9;
  for (const o of offers) {
    if (!o.stack) continue; const col = o.stack[o.stack.length - 1].col, run = topRun(o.stack);
    for (const c of cells) {
      if (c.stack.length) continue; let s = Math.random() * 0.3;
      for (const n of c.nb) { if (!n.stack.length) { s += 0.15; continue; } if (topCol(n) === col) s += 4 + topRun(n.stack) + run * 0.3; else s -= 0.8; }
      if (s > bs) { bs = s; best = [o, c]; }
    }
  }
  if (best) place(best[0], best[1]);
}

// ---------------------------------------------------------------- loop
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; return; } buildLevel(); state = 'play'; });
buildLevel(); ui.start();
const UP = new THREE.Vector3(0, 1, 0);
loop((dt) => {
  const h = dt / 60;
  // offers follow home / drag
  for (const o of offers) {
    if (!o.stack) { if (o.label) o.label.visible = false; continue; }
    if (o.enter > 0) o.enter = Math.max(0, o.enter - h * 3.2);
    const base = drag && drag.o === o && drag.moved ? drag.at : sel === o ? o.home.clone().setY(o.home.y + 0.4) : o.home;
    offerLabel(o); { const tt = o.stack[o.stack.length - 1]; o.label.position.set(tt.pos.x, tt.pos.y + 0.28, tt.pos.z); }
    o.stack.forEach((t, k) => { const ty = base.y + k * TH + (o.enter > 0 ? Math.pow(Math.min(1, o.enter), 2) * 4 : 0); t.pos.x = lerp(t.pos.x, base.x, 0.35 * dt); t.pos.z = lerp(t.pos.z, base.z, 0.35 * dt); t.pos.y = lerp(t.pos.y, ty, (drag && drag.o === o ? 0.35 : 0.5) * dt); t.q.identity(); });
  }
  // flights
  for (const t of tileList) {
    const f = t.fly; if (!f) continue;
    f.t += h; const k = clamp(f.t / f.dur, 0, 1);
    if (f.t < 0) continue;
    const e = k * k * (3 - 2 * k);
    t.pos.lerpVectors(f.from, f.to, e); t.pos.y += Math.sin(k * Math.PI) * f.arc;
    if (f.flip) t.q.setFromAxisAngle(tp.set(-f.dir.z, 0, f.dir.x), Math.PI * e); else t.q.identity();
    if (k >= 1) { t.fly = null; t.q.identity(); t.pos.copy(f.to); }
  }
  // glow + labels bob on board, cell highlight under drag
  if (plates) {
    cells.forEach((c, i) => {
      c.glow = Math.max(0, c.glow - h * 2.5);
      const hl = drag && drag.target === c ? 1 : 0;
      plates.setColorAt(i, tmpC.set('#ffffff').lerp(COLS[drag && drag.o.stack ? drag.o.stack[drag.o.stack.length - 1].col : 0], hl * 0.45));
      if (c.label && c.label.visible) { c.label.position.y = c.stack.length * TH + 0.16 + Math.sin(c.glow * Math.PI) * 0.12; c.label.scale.setScalar(0.48 + c.glow * 0.15); }
    });
    plates.instanceColor.needsUpdate = true;
  }
  // write instances
  let n = 0;
  for (let i = tileList.length - 1; i >= 0; i--) {
    const t = tileList[i];
    if (t.pop > 0) { t.pop += h * 2.2; if (t.pop > 1) { tileList.splice(i, 1); continue; } }
  }
  for (const t of tileList) {
    if (n >= MAXT) break;
    let s = 1, y = t.pos.y;
    if (t.pop > 0) { const k = t.pop; s = k < 0.3 ? 1 + k : Math.max(0, 1.3 * (1 - (k - 0.3) / 0.7)); y += k * 0.9; }
    ts.setScalar(s); tp.set(t.pos.x, y, t.pos.z); tm.compose(tp, t.q, ts); tiles.setMatrixAt(n, tm);
    tiles.setColorAt(n, t.pop > 0 ? tmpC.copy(COLS[t.col]).lerp(new THREE.Color('#ffffff'), Math.min(1, t.pop * 1.5)) : COLS[t.col]); n++;
  }
  tiles.count = n; tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
});

window.__game = { get state() { return state; }, get level() { return level; }, get score() { return totalCleared; }, bot, dbg: () => offers.map((o) => o.stack && o.stack.map((t) => [t.col, +t.pos.x.toFixed(2), +t.pos.y.toFixed(2), +t.pos.z.toFixed(2), t.s, t.pop, tileList.includes(t)])) };

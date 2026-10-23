// Untwine — original game. Ropes hang between a top peg bar and a bottom peg bar, all tangled up.
// Drag a rope plug to an empty peg in the same row; when no rope crosses another, the knot is solved.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, rng, rounded, mat, glossy, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';

const COLORS = ['#ff4b5c', '#ffc93c', '#3ccf6e', '#3b8bff', '#a66bff', '#ff8a2b'];
const Y_TOP = 2.75, Z_PEG = 0.16, R_ROPE = 0.155, SAMPLES = 22;
let Y_BOT = -3.05, CAM_D = 10, CAM_Y = -0.35;
const $ = (id) => document.getElementById(id);

const stage = createStage({ fov: 44, shadowSize: 6 });
const { scene, camera, sun, hemi } = stage;
camera.position.set(0, 0.9, 10.2); camera.lookAt(0, 0.05, 0);
sun.position.set(3.5, 9, 10); sun.intensity = 1.9; hemi.intensity = 1.0; hemi.color.set('#e8fffb'); hemi.groundColor.set('#30585a');
sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4;
const save = store('untwine');
const F = flow('untwine'); let fk = 1;
const WB = worldBoard({ game: 'untwine', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 2 }, mode: 'sum' });
let level = save.get('level', 1), total = save.get('freed', 0), state = 'ready';
const ui = createUI({ title: 'UN<br>TWINE', hint: 'Tap the glowing plug, then peg', hand: '👆', score: false });

// ---------------------------------------------------------------- textures
function ropeTexture() {   // three twisted strands, diagonal grooves + fibres; tinted per rope via material colour
  const W = 128, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), r = rng(7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ph = ((x / W) * 4 + (y / H) * 3) % 1;              // 3 strands around, 4 twists per tile
    let v = 0.5 + 0.5 * Math.sin(Math.PI * ph);             // rounded strand shading
    v = Math.pow(v, 0.7) * 0.75 + 0.25;
    if (ph < 0.06 || ph > 0.96) v *= 0.45;                  // groove between strands
    const fib = 0.92 + 0.16 * Math.sin((x * 1.7 - y * 2.3) * 0.9 + r() * 0.6);
    const k = clamp(v * fib, 0, 1) * 255, i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const ROPE_TEX = ropeTexture();
function boardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 200, 20, 128, 240, 330); gr.addColorStop(0, '#4a8f90'); gr.addColorStop(0.55, '#2f6a6d'); gr.addColorStop(1, '#1d4447');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  const r = rng(3); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.035})`; g.fillRect(r() * 256, r() * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- static set: board, bars, ledge
const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.95 }));
board.position.set(0, 0.3, -0.75); board.receiveShadow = true; scene.add(board);
const ledge = new THREE.Mesh(rounded(16, 0.9, 4, 0.12), mat('#1f3f42', { roughness: 0.9 }));
ledge.position.set(0, Y_BOT - 1.25, 1.0); ledge.receiveShadow = true; scene.add(ledge);
const ledgeTop = new THREE.Mesh(new THREE.BoxGeometry(16, 0.06, 4), mat('#2c5558', { roughness: 0.8 }));
ledgeTop.position.set(0, Y_BOT - 0.78, 1.0); ledgeTop.receiveShadow = true; scene.add(ledgeTop);
const METAL = new THREE.MeshStandardMaterial({ color: '#b9c3c9', roughness: 0.28, metalness: 0.8 });
const DARKMETAL = new THREE.MeshStandardMaterial({ color: '#4c565c', roughness: 0.35, metalness: 0.7 });
const HOLE_MAT = mat('#15282a', { roughness: 1 });
const bars = new THREE.Group(); scene.add(bars);
const PEG_GEO = new THREE.CylinderGeometry(0.2, 0.22, 0.16, 24); PEG_GEO.rotateX(Math.PI / 2);
const HOLE_GEO = new THREE.CircleGeometry(0.095, 18);
const RING_GEO = new THREE.TorusGeometry(0.25, 0.035, 8, 28);
const PLUG_GEO = (() => { const g = new THREE.CylinderGeometry(0.17, 0.19, 0.3, 24); g.rotateX(Math.PI / 2); return g; })();
const CAP_GEO = (() => { const g = new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI / 2); return g; })();
const COLLAR_GEO = new THREE.TorusGeometry(0.165, 0.035, 8, 24);

function buildBars(S, sp) {
  bars.clear();
  const w = (S - 1) * sp + 0.9;
  for (const y of [Y_TOP, Y_BOT]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, w, 24), METAL); rod.rotation.z = Math.PI / 2; rod.position.set(0, y, -0.12);
    rod.castShadow = true; rod.receiveShadow = true; bars.add(rod);
    for (const sx of [-1, 1]) {   // chunky end knobs + wall brackets
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 20), DARKMETAL); k.rotation.z = Math.PI / 2; k.position.set(sx * (w / 2 + 0.1), y, -0.12); k.castShadow = true; bars.add(k);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 12), DARKMETAL); b.rotation.x = Math.PI / 2; b.position.set(sx * (w / 2 - 0.15), y, -0.42); bars.add(b);
    }
    for (let s = 0; s < S; s++) {
      const x = sockX(s, S, sp);
      const peg = new THREE.Mesh(PEG_GEO, METAL); peg.position.set(x, y, 0.0); peg.castShadow = true; bars.add(peg);
      const hole = new THREE.Mesh(HOLE_GEO, HOLE_MAT); hole.position.set(x, y, 0.081); bars.add(hole);
    }
  }
}
const sockX = (s, S, sp) => (s - (S - 1) / 2) * sp;

// highlight rings shown on free pegs while dragging
const hiMat = new THREE.MeshBasicMaterial({ color: '#9effc9', transparent: true, opacity: 0.0 });
// warm-up guide (levels 1-2): a pulsing gold ring on the plug to move, then on the peg it goes to
const guideMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0, depthTest: false });
const guideRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 32), guideMat); guideRing.renderOrder = 5; scene.add(guideRing);
let guideMv = null, idleT = 0;
function guideTarget() {
  if (level > 2 || state !== 'play' || botAnim || (level === 2 && idleT < 3)) return null;
  if (!guideMv) { const sol = solve(pos); guideMv = sol && sol.length ? sol[0] : null; }
  if (!guideMv) return null;
  const [e, s] = guideMv;
  if (!drag) return ropes[e >> 1].ends[e & 1].cur;
  if (drag.e === e) return sockPos(e, s);
  return null;
}
const hiRings = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(RING_GEO, hiMat); m.visible = false; scene.add(m); hiRings.push(m); }

// ---------------------------------------------------------------- level state
let S, SP, R, ropes = [], pos = [], movesLeft = 0, movesUsed = 0, par = 0, startCross = 1, drag = null, botAnim = null, winT = 0;
// ends: index 2i = top end of rope i, 2i+1 = bottom end. pos[e] = socket index in that end's row.
const rowOf = (e) => e & 1;   // 0 top, 1 bottom
function crossings(p, n = R) {
  let c = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if ((p[2 * i] - p[2 * j]) * (p[2 * i + 1] - p[2 * j + 1]) < 0) c++;
  return c;
}
function ropeCrosses(p, i) { let c = 0; for (let j = 0; j < R; j++) if (j !== i && (p[2 * i] - p[2 * j]) * (p[2 * i + 1] - p[2 * j + 1]) < 0) c++; return c; }
function freeSockets(p, row) { const used = new Set(); for (let e = row; e < 2 * R; e += 2) used.add(p[e]); const f = []; for (let s = 0; s < S; s++) if (!used.has(s)) f.push(s); return f; }

// best-first search (weighted A*) for a short untangling sequence; returns [[end, socket], ...]
function solve(p0, limit = 25000) {
  const key = (p) => p.join(','), start = p0.slice();
  if (crossings(start) === 0) return [];
  const heap = [], seen = new Map(); let n = 0;
  const push = (node) => { heap.push(node); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa].f <= heap[i].f) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  push({ p: start, g: 0, f: crossings(start) * 0.9, path: [] }); seen.set(key(start), 0);
  while (heap.length && n++ < limit) {
    const cur = pop();
    for (let e = 0; e < 2 * R; e++) for (const s of freeSockets(cur.p, rowOf(e))) {
      const np = cur.p.slice(); np[e] = s; const h = crossings(np), path = cur.path.concat([[e, s]]);
      if (h === 0) return path;
      const k = key(np); if (seen.has(k) && seen.get(k) <= cur.g + 1) continue; seen.set(k, cur.g + 1);
      push({ p: np, g: cur.g + 1, f: cur.g + 1 + h * 0.9, path });
    }
  }
  return null;
}

function levelParams(L) {
  const R = L <= 1 ? 2 : L <= 3 ? 3 : L <= 8 ? 4 : L <= 16 ? 5 : 6;
  const free = R <= 2 ? 1 : R <= 4 ? (L % 3 === 0 ? 1 : 2) : 2;
  const target = Math.min(R * (R - 1) / 2, L <= 1 ? 1 : Math.max(2, R - 1 + Math.floor(L / 5)));
  return { R, S: R + free, target };
}

function makeRope(i) {
  const color = COLORS[i % COLORS.length];
  const tex = ROPE_TEX.clone(); tex.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.78, metalness: 0.0, emissive: '#000000' });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  const plugMat = glossy(color, { roughness: 0.25 });
  const ends = [0, 1].map(() => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(PLUG_GEO, plugMat); body.castShadow = true; g.add(body);
    const cap = new THREE.Mesh(CAP_GEO, plugMat); cap.position.z = 0.15; g.add(cap);
    const collar = new THREE.Mesh(COLLAR_GEO, METAL); collar.position.z = -0.1; g.add(collar);
    scene.add(g); return { g, cur: new THREE.Vector3(), lift: 0, sq: 0 };
  });
  return { i, color, mesh, mat: m, tex, ends, bump: new Float32Array(SAMPLES), free: false, glow: 0, wob: 0, sig: '' };
}

function startLevel() {
  for (const r of ropes) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mat.dispose(); r.tex.dispose(); for (const e of r.ends) scene.remove(e.g); }
  fk = F.k(); const P = levelParams(level), rnd = rng(level * 7919 + 13);
  P.target = Math.max(1, Math.min(P.R * (P.R - 1) / 2, Math.round(P.target * fk)));
  R = P.R; S = P.S; SP = Math.min(0.66, 3.7 / (S - 1));
  { const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = ((S - 1) * SP) / 2 + 1.05;
    CAM_D = Math.max(halfW / (tanV * camera.aspect), 4.4 / tanV); const h = CAM_D * tanV;
    CAM_Y = Y_TOP - 0.52 * h; Y_BOT = Math.min(-2.6, CAM_Y - 0.8 * h);
    ledge.position.y = Y_BOT - 1.25; ledgeTop.position.y = Y_BOT - 0.78; }
  buildBars(S, SP);
  // random tangled board with at least `target` crossings and a short solution
  let best = null, bestC = -1;
  for (let t = 0; t < 300; t++) {
    const top = shuffle([...Array(S).keys()], rnd).slice(0, R), bot = shuffle([...Array(S).keys()], rnd).slice(0, R);
    const p = []; for (let i = 0; i < R; i++) p.push(top[i], bot[i]);
    const c = crossings(p); if (c >= P.target) { best = p; break; } if (c > bestC) { bestC = c; best = p; }
  }
  pos = best;
  // colour order follows top sockets so palette reads left→right nicely
  ropes = []; for (let i = 0; i < R; i++) ropes.push(makeRope(i));
  const sol = solve(pos); par = sol ? sol.length : R;
  movesLeft = par + Math.max(1, Math.round((level <= 2 ? 3 : level <= 8 ? 2 : 1) / fk)); movesUsed = 0;
  startCross = Math.max(1, crossings(pos));
  for (const r of ropes) for (let k = 0; k < 2; k++) { const e = 2 * r.i + k; r.ends[k].cur.copy(sockPos(e, pos[e])); }
  for (const r of ropes) r.free = ropeCrosses(pos, r.i) === 0;
  drag = null; botAnim = null; winT = 0; botPlan = null; guideMv = null; idleT = 0;
  ui.levels(level); updateHud(false);
}
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const sockPos = (e, s) => new THREE.Vector3(sockX(s, S, SP), rowOf(e) ? Y_BOT : Y_TOP, Z_PEG);

function updateHud(bump = true) {
  const mv = $('moves'); $('movesN').textContent = movesLeft; mv.classList.toggle('low', movesLeft <= 1);
  if (bump) { mv.classList.add('bump'); setTimeout(() => mv.classList.remove('bump'), 140); }
  const c = crossings(pos); ui.progress(1 - c / startCross);
  $('tangles').textContent = c ? `${c} tangle${c > 1 ? 's' : ''} left` : 'All free!';
}

// ---------------------------------------------------------------- rope geometry (rebuilt when anything moves)
const tmpPts = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
function rebuildRope(r, t) {
  const a = r.ends[0].cur, b = r.ends[1].cur;
  for (let k = 0; k < SAMPLES; k++) {
    const s = k / (SAMPLES - 1), p = tmpPts[k];
    p.lerpVectors(a, b, s);
    const ease = Math.sin(Math.PI * s);
    p.z = lerp(a.z, b.z, s) + r.bump[k] + ease * 0.12;
    p.x += Math.sin(s * Math.PI * 3 + t * 6) * r.wob * 0.12 * ease;
  }
  const curve = new THREE.CatmullRomCurve3(tmpPts.map(v => v.clone()));
  const len = a.distanceTo(b) + 0.4;
  r.mesh.geometry.dispose(); r.mesh.geometry = new THREE.TubeGeometry(curve, 72, R_ROPE, 10, false);
  r.tex.repeat.set(len * 1.6, 1);
}
// over/under bumps: for each crossing pair, one rope lifts toward the camera, the other dips behind, around the crossing point
function targetBumps() {
  const xs = ropes.map(r => [r.ends[0].cur.x, r.ends[1].cur.x]), out = ropes.map(() => new Float32Array(SAMPLES));
  for (let i = 0; i < R; i++) for (let j = i + 1; j < R; j++) {
    const di = xs[i][1] - xs[i][0], dj = xs[j][1] - xs[j][0], den = di - dj;
    if (Math.abs(den) < 1e-4) continue;
    const s = (xs[j][0] - xs[i][0]) / den; if (s <= 0.01 || s >= 0.99) continue;
    const sign = (i + j + (i * 3 + j * 5) % 3) % 2 ? 1 : -1, ang = Math.abs(den) / (Y_TOP - Y_BOT);
    const w = clamp(0.09 + 0.12 / (ang + 0.25) * 0.25, 0.08, 0.22);
    for (let k = 0; k < SAMPLES; k++) { const d = (k / (SAMPLES - 1) - s) / w, g = Math.exp(-d * d) * 0.19; out[i][k] += sign * g; out[j][k] -= sign * g; }
  }
  return out;
}

// ---------------------------------------------------------------- input: drag plugs
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.75), hit = new THREE.Vector3();
function toWorld(cx, cy) { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, hit); return hit.clone(); }
function toScreen(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
function pickEnd(cx, cy) {
  let best = -1, bd = 46;
  for (let e = 0; e < 2 * R; e++) { const [sx, sy] = toScreen(ropes[e >> 1].ends[e & 1].cur); const d = Math.hypot(sx - cx, sy - cy); if (d < bd) { bd = d; best = e; } }
  return best;
}
function beginDrag(e) {
  drag = { e, from: pos[e], target: sockPos(e, pos[e]).setZ(0.75) };
  const end = ropes[e >> 1].ends[e & 1]; end.sq = 1; sfx.pick(1); buzz(8);
  const fr = freeSockets(pos, rowOf(e)); hiRings.forEach((h, i) => { h.visible = i < fr.length; if (h.visible) h.position.copy(sockPos(e, fr[i])).setZ(0.1); });
}
function endDrag(toSock) {
  const e = drag.e, from = drag.from; drag = null; hiRings.forEach(h => h.visible = false);
  const end = ropes[e >> 1].ends[e & 1]; end.sq = 1;
  if (toSock === null || toSock === from) { pos[e] = from; tone(300, 0.08, 'sine', 0.08, 0.8); return; }
  const before = ropes.map(r => r.free);
  pos[e] = toSock; movesUsed++; movesLeft--;
  sfx.tap(); tone(640, 0.07, 'triangle', 0.12, 1.25); buzz(12);
  burst(scene, sockPos(e, toSock).setZ(0.4), ['#ffffff', ropes[e >> 1].color], 8, { speed: 0.05, up: 0.04, size: 0.45, gravity: 0.003 });
  ropes.forEach((r, i) => { r.free = ropeCrosses(pos, i) === 0; r.wob = 1; if (r.free && !before[i]) freed(r); });
  updateHud(true); botPlan = null; guideMv = null; idleT = 0;
  const c = crossings(pos);
  if (c === 0) win();
  else if (movesLeft <= 0) { state = 'lost'; F.level(false, Math.max(0, 1 - c / startCross)); sfx.fail(); buzz([60, 40, 60]); ui.lose('OUT OF MOVES', `${c} tangle${c > 1 ? 's' : ''} left`); }
}
let freedCount = 0;
function freed(r) {
  const mid = r.ends[0].cur.clone().lerp(r.ends[1].cur, 0.5).setZ(0.6);
  burst(scene, mid, ['#ffffff', '#b8ffd8', r.color], 14, { speed: 0.08, up: 0.06, size: 0.5, gravity: 0.002, shape: 'sphere' });
  r.glow = 1; note(72 + (freedCount++ % 5) * 2, 0.4, 0.14);
  if (crossings(pos) > 0) ui.pop(['FREE!', 'NICE!', 'UNTIED!'][freedCount % 3], '#c9ffe0', 34, 24);
}
function win() {
  state = 'won'; F.level(true); WB.submit(1); winT = 1; total += R; save.set('freed', total);
  sfx.win(); buzz([30, 30, 60]); ui.flash(0.45);
  confetti(scene, new THREE.Vector3(0, 1.5, 1), 70);
  ui.pop(movesLeft > 0 && movesUsed <= par ? 'PERFECT!' : 'UNTANGLED!', '#fff', 42, 22);
  ropes.forEach((r, i) => setTimeout(() => { r.glow = 1.4; note(67 + i * 4, 0.35, 0.12); }, i * 90));
  level++; save.set('level', level);
  ui.win(level - 1, `Untangled in ${movesUsed} move${movesUsed > 1 ? 's' : ''}`); ui.els.win.querySelector('.hint').textContent = `Level ${level} ▶`;
  setTimeout(() => confetti(scene, new THREE.Vector3(-1.5, 0, 1), 50), 220); setTimeout(() => confetti(scene, new THREE.Vector3(1.5, 0, 1), 50), 420);
}

function sockAt(cx, cy) {
  const w = toWorld(cx, cy), row = rowOf(drag.e), y = row ? Y_BOT : Y_TOP;
  let best = null, bd = SP * 0.85;
  if (Math.abs(w.y - y) < 1.6) for (const s of freeSockets(pos.map((v, i) => i === drag.e ? -1 : v), row)) { const d = Math.abs(sockX(s, S, SP) - w.x); if (d < bd) { bd = d; best = s; } }
  return best;
}
function select(e) { beginDrag(e); drag.sel = true; drag.target = sockPos(e, pos[e]).setZ(1.6); }   // tap-selected plug: lifted off its peg, free pegs ringed
input({
  onDown(ev) {
    if (state !== 'play' || botAnim) return;
    if (drag && drag.sel) { if (pickEnd(ev.clientX, ev.clientY) === drag.e) { drag.sel = false; drag.wasSel = true; drag.target = toWorld(ev.clientX, ev.clientY).setZ(0.75); } return; }
    const e = pickEnd(ev.clientX, ev.clientY); if (e < 0) return;
    beginDrag(e); drag.fresh = true; drag.target = toWorld(ev.clientX, ev.clientY).setZ(0.75);
  },
  onMove(dx, dy, ev) { if (drag && !drag.auto && !drag.sel) drag.target = toWorld(ev.clientX, ev.clientY).setZ(0.75); },
  onTap(ev) {   // tap a plug to pick it up, tap a free peg to plug it in there (tap the plug again / empty space to put it back)
    if (state !== 'play' || !drag || drag.auto) return;
    if (drag.fresh) { drag.fresh = false; drag.sel = true; drag.target = sockPos(drag.e, pos[drag.e]).setZ(1.6); return; }
    if (drag.wasSel) { endDrag(null); return; }
    if (!drag.sel) return;
    const o = pickEnd(ev.clientX, ev.clientY), best = sockAt(ev.clientX, ev.clientY);
    if (best === null && o >= 0 && o !== drag.e) { endDrag(null); select(o); return; }
    endDrag(best);
  },
  onUp(ev) {
    if (!drag || drag.auto || drag.sel) return;
    endDrag(sockAt(ev.clientX, ev.clientY));
  },
});
ui.onTap((which) => { WB.start();
  if (which === 'lose') startLevel();
  if (which === 'win') startLevel();
  state = 'play'; $('moves').classList.remove('hc-hidden'); $('tangles').classList.remove('hc-hidden');
});

// ---------------------------------------------------------------- bot (one animated drag per call, following a solver plan)
let botPlan = null;
function bot() {
  if (state !== 'play' || botAnim) return;
  if (drag && drag.sel) endDrag(null);
  if (drag) return;
  if (!botPlan || !botPlan.length) botPlan = solve(pos) || [];
  const mv = botPlan.shift(); if (!mv) return;
  const [e, s] = mv; beginDrag(e); drag.auto = true;
  botAnim = { e, s, t: 0, from: sockPos(e, pos[e]), to: sockPos(e, s) };
}

// ---------------------------------------------------------------- frame loop
let T = 0;
loop((dt, t) => {
  T = t;
  if (botAnim) {
    botAnim.t += dt / 26; const k = clamp(botAnim.t, 0, 1), ez = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    drag.target = botAnim.from.clone().lerp(botAnim.to, ez); drag.target.z = 0.75; drag.target.y += Math.sin(Math.PI * k) * (rowOf(botAnim.e) ? 0.6 : -0.6);
    if (botAnim.t >= 1.1) { const s = botAnim.s; botAnim = null; endDrag(s); }
  }
  // plugs follow their socket / the finger
  for (const r of ropes) for (let k = 0; k < 2; k++) {
    const e = 2 * r.i + k, end = r.ends[k];
    const tgt = drag && drag.e === e ? drag.target : sockPos(e, pos[e]);
    const f = drag && drag.e === e ? 0.45 : 0.25;
    end.cur.lerp(tgt, 1 - Math.pow(1 - f, dt));
    end.sq = Math.max(0, end.sq - 0.06 * dt);
    const lifted = drag && drag.e === e ? 1.22 : 1;
    const sc = lifted * (1 + Math.sin(end.sq * Math.PI) * 0.25);
    end.g.position.copy(end.cur); end.g.position.z += 0.08; end.g.scale.set(sc, sc, sc * (1 - Math.sin(end.sq * Math.PI) * 0.2));
  }
  // rope over/under shape, eased; glow when free
  const tb = targetBumps();
  for (const r of ropes) {
    const b = tb[r.i]; for (let k = 0; k < SAMPLES; k++) r.bump[k] = lerp(r.bump[k], b[k], 1 - Math.pow(0.82, dt));
    r.wob = Math.max(0, r.wob - 0.03 * dt); r.glow = Math.max(r.free ? 0.0 : 0, r.glow - 0.02 * dt);
    const pulse = r.free ? 0.13 + 0.08 * Math.sin(t * 5 + r.i) : 0;
    r.mat.emissive.set(r.free ? '#7dffb5' : '#000000'); r.mat.emissiveIntensity = pulse + r.glow * 0.32;
    const sig = [r.ends[0].cur.x, r.ends[0].cur.y, r.ends[0].cur.z, r.ends[1].cur.x, r.ends[1].cur.y, r.ends[1].cur.z, ...r.bump].map(v => v.toFixed(3)).join() + (r.wob > 0 ? t.toFixed(2) : '');
    if (sig !== r.sig) { r.sig = sig; rebuildRope(r, t); }
  }
  if (state === 'play' && !drag) idleT += dt / 60;
  { const g = guideTarget(); guideMat.opacity = g ? 0.65 + 0.35 * Math.sin(t * 8) : 0; if (g) { guideRing.position.set(g.x, g.y, 0.9); guideRing.scale.setScalar(1 + 0.15 * Math.sin(t * 8)); } }
  hiMat.opacity = drag ? 0.55 + 0.35 * Math.sin(t * 9) : 0; hiRings.forEach(h => h.scale.setScalar(1 + 0.08 * Math.sin(t * 9)));
  // gentle camera breathing + win push-in
  if (winT > 0) winT = Math.max(0, winT - 0.01 * dt);
  const dist = CAM_D - winT * 0.6;
  camera.position.set(Math.sin(t * 0.4) * 0.15, CAM_Y + 0.9 + Math.sin(t * 0.3) * 0.05, dist); camera.lookAt(0, CAM_Y, 0);
});

startLevel(); ui.start(); state = 'ready';
window.__game = { guideXY: () => guideMat.opacity > 0 ? toScreen(guideRing.position.clone().setZ(Z_PEG)) : null, get state() { return state; }, get level() { return level; }, get score() { return total; }, bot, dbg: () => ({ pos, cross: crossings(pos), movesLeft, par }), load(n) { level = n; ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); startLevel(); state = 'play'; } };

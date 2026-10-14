// Cube Trek — original 8×8 block puzzle with quest goals. Drag one of three pieces onto the board; full rows and
// columns burst. Quest levels: free every gem on the board (or hit a score target). Game over when nothing fits.
// Inspired by the mechanic of Blocky Quest (SayGames). All code and art original.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng, rounded } from './kit/hc.js';

const S = store('cubetrek');
let level = S.get('level', 1), best = S.get('best', 0);
const stage = createStage({ fov: 34, shadowSize: 12 });
const { scene, camera, renderer, sun, hemi } = stage;
const ui = createUI({ title: 'CUBE<br>TREK', hint: 'Drag blocks onto the board', hand: '👆' });
hemi.intensity = 1.2; hemi.color.set('#ffffff'); hemi.groundColor.set('#8ea0ff');
sun.intensity = 1.9; sun.position.set(-7, 9, 16); sun.target.position.set(0, 0, 0);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14 }); sun.shadow.camera.updateProjectionMatrix();

// ------------------------------------------------------------------ layout (board in the XY plane, camera looks down -Z)
const N = 8, BOARD_Y = 2.0, TRAY_Y = -7.0, TRAY_S = 0.64, SLOT_X = [-3.3, 0, 3.3];
const cellPos = (r, c) => [(c - 3.5), BOARD_Y + (3.5 - r)];
function fitCamera() {
  const fov = camera.fov * Math.PI / 180, t = Math.tan(fov / 2);
  const dW = 10.0 / (2 * t * camera.aspect), dH = 22.4 / (2 * t);
  const d = Math.max(dW, dH);
  camera.position.set(0, -4.2, d); camera.lookAt(0, -0.2, 0);
}
addEventListener('resize', fitCamera); fitCamera();

// ------------------------------------------------------------------ materials + geometry
const COLORS = ['#a24dff', '#1fc8f2', '#2f6bff', '#2fd05a', '#ff3b55', '#ffb21e', '#ff6fb5'];
const BLOCK_G = rounded(0.94, 0.94, 0.62, 0.13);
const FACE_G = rounded(0.6, 0.6, 0.04, 0.1);
const blockMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.05 });
const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.05 });
const MAXI = 260;
const blocks = new THREE.InstancedMesh(BLOCK_G, blockMat, MAXI), faces = new THREE.InstancedMesh(FACE_G, faceMat, MAXI);
blocks.castShadow = true; blocks.receiveShadow = true; faces.receiveShadow = false;
for (let i = 0; i < MAXI; i++) { blocks.setColorAt(i, new THREE.Color('#fff')); faces.setColorAt(i, new THREE.Color('#fff')); }
blocks.frustumCulled = faces.frustumCulled = false;
scene.add(blocks, faces);
const ghost = new THREE.InstancedMesh(BLOCK_G, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), 30);
ghost.frustumCulled = false; ghost.count = 0; scene.add(ghost);
const GEM_G = new THREE.OctahedronGeometry(0.36, 0); GEM_G.scale(1, 1.2, 0.75);
const gemMat = new THREE.MeshStandardMaterial({ color: '#9ff0ff', emissive: '#19a8ff', emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.35, flatShading: true });
const gems = new THREE.InstancedMesh(GEM_G, gemMat, 80); gems.castShadow = true; gems.frustumCulled = false; gems.count = 0; scene.add(gems);

// board tray + sockets
{
  const tray = new THREE.Mesh(rounded(8.6, 8.6, 0.5, 0.35), new THREE.MeshStandardMaterial({ color: '#141b46', roughness: 0.55 }));
  tray.position.set(0, BOARD_Y, -0.55); tray.receiveShadow = true; scene.add(tray);
  const rim = new THREE.Mesh(rounded(8.95, 8.95, 0.4, 0.42), new THREE.MeshStandardMaterial({ color: '#2a3aa8', roughness: 0.4 }));
  rim.position.set(0, BOARD_Y, -0.72); scene.add(rim);
  const sock = new THREE.InstancedMesh(rounded(0.92, 0.92, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: '#1d2760', roughness: 0.7 }), 64);
  const m = new THREE.Matrix4(); let i = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const [x, y] = cellPos(r, c); m.makeTranslation(x, y, -0.29); sock.setMatrixAt(i++, m); }
  sock.receiveShadow = true; scene.add(sock);
  const shelf = new THREE.Mesh(rounded(10.2, 3.6, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: '#2d2a9e', roughness: 0.6, transparent: true, opacity: 0.55 }));
  shelf.position.set(0, TRAY_Y, -0.7); shelf.receiveShadow = true; scene.add(shelf);
}

// ------------------------------------------------------------------ pieces
const SHAPES = [
  [[[0, 0]], 2], [[[0, 0], [1, 0]], 5], [[[0, 0], [0, 1]], 5], [[[0, 0], [1, 0], [2, 0]], 6], [[[0, 0], [0, 1], [0, 2]], 6],
  [[[0, 0], [1, 0], [2, 0], [3, 0]], 4], [[[0, 0], [0, 1], [0, 2], [0, 3]], 4], [[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], 2], [[[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], 2],
  [[[0, 0], [1, 0], [0, 1], [1, 1]], 6], [[[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 2],
  [[[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], 3], [[[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], 3],
  [[[0, 0], [0, 1], [1, 1]], 4], [[[1, 0], [0, 1], [1, 1]], 4], [[[0, 0], [1, 0], [0, 1]], 4], [[[0, 0], [1, 0], [1, 1]], 4],
  [[[0, 0], [0, 1], [0, 2], [1, 2]], 3], [[[1, 0], [1, 1], [1, 2], [0, 2]], 3], [[[0, 0], [1, 0], [2, 0], [0, 1]], 3], [[[0, 0], [1, 0], [2, 0], [2, 1]], 3],
  [[[0, 0], [1, 0], [2, 0], [1, 1]], 3], [[[1, 0], [0, 1], [1, 1], [2, 1]], 3], [[[0, 0], [1, 0], [1, 1], [2, 1]], 2], [[[1, 0], [2, 0], [0, 1], [1, 1]], 2],
  [[[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], 2], [[[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], 2],
];
const W_TOTAL = SHAPES.reduce((a, s) => a + s[1], 0);
const dims = cells => [Math.max(...cells.map(c => c[0])) + 1, Math.max(...cells.map(c => c[1])) + 1];

// ------------------------------------------------------------------ state
let board, tray, rand, state = 'ready', score = 0, goal, combo = 0, drag = null, anims = [], flyers = [], botMove = null, settle = 0, idleT = 0;
const blank = () => Array.from({ length: N }, () => Array(N).fill(null));
function fits(b, cells, r0, c0) { for (const [x, y] of cells) { const r = r0 + y, c = c0 + x; if (r < 0 || c < 0 || r >= N || c >= N || b[r][c]) return false; } return true; }
function anyFit(b, cells) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(b, cells, r, c)) return true; return false; }
function fullLines(b) {
  const rows = [], cols = [];
  for (let r = 0; r < N; r++) if (b[r].every(Boolean)) rows.push(r);
  for (let c = 0; c < N; c++) if (b.every(row => row[c])) cols.push(c);
  return { rows, cols };
}
function pickShape(guarantee) {
  for (let tries = 0; tries < 40; tries++) {
    let k = rand() * W_TOTAL, s = SHAPES[0][0];
    for (const [cells, w] of SHAPES) { k -= w; if (k <= 0) { s = cells; break; } }
    if (!guarantee || anyFit(board, s)) return s;
  }
  return [[0, 0]];
}
function dealTray() {
  const hard = Math.min(1, (level - 1) / 10);
  tray = [0, 1, 2].map(i => ({ cells: pickShape(i === 0 || rand() > hard * 0.7), color: COLORS[Math.floor(rand() * COLORS.length)], slot: i, used: false, pop: 0 }));
  tray.forEach((p, i) => p.pop = -i * 0.08);
  sfx.pick(2);
}
function buildLevel() {
  rand = rng(level * 4513 + 7); board = blank(); anims = []; flyers = []; combo = 0; score = 0; drag = null; botMove = null;
  const isScore = level % 3 === 0;
  // a seeded "mess": columns of rubble rising from the bottom, never a full line
  const fill = 0.4 + Math.min(0.25, level * 0.025), heights = [];
  for (let c = 0; c < N; c++) heights.push(Math.floor(rand() * (2 + fill * 8)));
  for (let c = 0; c < N; c++) for (let r = N - 1; r >= N - heights[c]; r--) if (rand() < 0.86) board[r][c] = { color: COLORS[Math.floor(rand() * COLORS.length)], gem: false, pop: 0 };
  for (let r = 0; r < N; r++) if (board[r].every(Boolean)) board[r][Math.floor(rand() * N)] = null;
  for (let c = 0; c < N; c++) if (board.every(row => row[c])) board[Math.floor(rand() * N)][c] = null;
  const filled = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c]) filled.push([r, c]);
  let ng = 0;
  if (!isScore) {
    const want = Math.min(filled.length, 3 + Math.floor(level * 0.8), 12);
    filled.sort((a, b) => (board[b[0]].filter(Boolean).length - board[a[0]].filter(Boolean).length) + (rand() - 0.5) * 3);
    for (let i = 0; i < want; i++) { const [r, c] = filled[i]; board[r][c].gem = true; ng++; }
    goal = { type: 'gems', need: ng, got: 0 };
  } else goal = { type: 'score', need: 250 + level * 35, got: 0 };
  for (const [r, c] of filled) board[r][c].pop = -((N - r) * 0.04 + c * 0.015);
  dealTray(); ui.levels(level); ui.score(0); updateGoal(); ui.progress(0);
}

// ------------------------------------------------------------------ HUD goal
const goalEl = document.createElement('div'); goalEl.className = 'ct-goal'; document.body.appendChild(goalEl);
function updateGoal(bump) {
  if (goal.type === 'gems') { goalEl.innerHTML = `<span class="gem"></span>${goal.got} / ${goal.need}`; ui.progress(goal.got / goal.need); }
  else { goalEl.innerHTML = `🎯 ${Math.min(score, goal.need)} / ${goal.need}`; ui.progress(score / goal.need); }
  if (bump) { goalEl.classList.remove('bump'); void goalEl.offsetWidth; goalEl.classList.add('bump'); }
}

// ------------------------------------------------------------------ input: pick a tray piece, drag it (held above the finger), drop on the grid
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
function toWorld(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, hit); return hit.clone(); }
const LIFT = 2.4;
function pieceOrigin(p, wx, wy) {           // world pos of the piece centre -> board (r0,c0) of its top-left cell
  const [w, h] = dims(p.cells); const x0 = wx - (w - 1) / 2, y0 = wy + (h - 1) / 2;
  return [Math.round(BOARD_Y + 3.5 - y0), Math.round(x0 + 3.5)];
}
input({
  onDown: (e) => {
    if (state !== 'play' || botMove || settle > 0) return;
    const w = toWorld(e.clientX, e.clientY); if (w.y > TRAY_Y + 2.6) return;
    let bestI = -1, bd = 2.2; tray.forEach((p, i) => { if (p.used) return; const d = Math.abs(w.x - SLOT_X[i]); if (d < bd) { bd = d; bestI = i; } });
    if (bestI < 0) return;
    drag = { p: tray[bestI], x: w.x, y: w.y + LIFT, tx: w.x, ty: w.y + LIFT, s: TRAY_S }; sfx.tap(); buzz(6);
  },
  onMove: (dx, dy, e) => { if (!drag) return; const w = toWorld(e.clientX, e.clientY); drag.tx = w.x; drag.ty = w.y + LIFT; },
  onUp: () => { if (!drag) return; tryDrop(drag); drag = null; },
});
function tryDrop(d) {
  const [r0, c0] = pieceOrigin(d.p, d.x, d.y);
  if (fits(board, d.p.cells, r0, c0)) place(d.p, r0, c0);
  else { tone(200, 0.08, 'sine', 0.08, 0.8); }
}

// ------------------------------------------------------------------ placing + clearing
const COMBO_WORDS = ['', 'GOOD!', 'GREAT!', 'EXCELLENT!', 'AMAZING!', 'UNBELIEVABLE!'];
function place(p, r0, c0) {
  p.used = true;
  for (const [x, y] of p.cells) board[r0 + y][c0 + x] = { color: p.color, gem: false, pop: 1 };
  score += p.cells.length; sfx.pick(p.cells.length); buzz(10);
  const { rows, cols } = fullLines(board), lines = rows.length + cols.length;
  if (lines) {
    combo++;
    const cr = r0 + dims(p.cells)[1] / 2, cc = c0 + dims(p.cells)[0] / 2, seen = new Set();
    const kill = (r, c) => { const k = r * N + c; if (seen.has(k) || !board[r][c]) return; seen.add(k); const b = board[r][c]; const [x, y] = cellPos(r, c);
      anims.push({ x, y, color: b.color, t: -Math.hypot(r - cr, c - cc) * 0.035, gem: b.gem });
      if (b.gem) { goal.got++; flyers.push({ x, y, t: -Math.hypot(r - cr, c - cc) * 0.035 - 0.1 }); }
      board[r][c] = null; };
    for (const r of rows) for (let c = 0; c < N; c++) kill(r, c);
    for (const c of cols) for (let r = 0; r < N; r++) kill(r, c);
    const pts = seen.size * 10 * lines * combo; score += pts;
    ui.pop(lines > 1 ? COMBO_WORDS[Math.min(lines, 5)] : combo > 1 ? `COMBO ×${combo}` : COMBO_WORDS[1], ['#fff', '#ffe066', '#7dffb2', '#7ee8ff', '#ff9de2', '#ffd23f'][Math.min(lines + combo - 1, 5)], 40 + lines * 6, 37);
    setTimeout(() => ui.pop('+' + pts, '#fff', 30, 44), 380);
    [0, 1, 2].slice(0, Math.min(3, lines)).forEach(i => setTimeout(() => tone(520 + i * 160 + combo * 40, 0.14, 'triangle', 0.14, 1.4), i * 90));
    ui.flash(0.18 + lines * 0.08); buzz([15, 20, 25]); settle = 0.45 + lines * 0.05;
  } else combo = 0;
  ui.score(score); updateGoal(true);
  if (tray.every(t => t.used)) dealTray();
  checkEnd();
}
function checkEnd() {
  if (goal.type === 'gems' ? goal.got >= goal.need : score >= goal.need) {
    state = 'won'; setTimeout(() => { sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, BOARD_Y + 2, 2), 60); confetti(scene, new THREE.Vector3(-3, BOARD_Y, 2), 30); confetti(scene, new THREE.Vector3(3, BOARD_Y, 2), 30); }, 450);
    best = Math.max(best, score); S.set('best', best); ui.win(level, `Score ${score}`); level++; S.set('level', level);
    return;
  }
  const live = tray.filter(t => !t.used);
  if (!live.some(t => anyFit(board, t.cells))) {
    state = 'lost'; setTimeout(() => { sfx.fail(); buzz([60, 40, 60]); }, 300);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c]) board[r][c].dead = (N - r) * 0.05;
    ui.lose('NO SPACE!', goal.type === 'gems' ? `${goal.need - goal.got} gems left` : `${goal.need - score} points to go`);
  }
}

ui.onTap(w => { if (w === 'start') { state = 'play'; } else { buildLevel(); state = 'play'; } });

// ------------------------------------------------------------------ render all blocks via instancing every frame
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), tmpC = new THREE.Color();
let ni = 0, ng = 0;
function addBlock(x, y, z, s, color, rot = 0, lighten = 0, sx = s, sy = s) {
  if (ni >= MAXI) return;
  e3.set(0, 0, rot); q.setFromEuler(e3);
  m4.compose(v3.set(x, y, z), q, sc.set(sx, sy, s)); blocks.setMatrixAt(ni, m4);
  col.set(color); if (lighten) col.lerp(tmpC.set('#ffffff'), lighten); blocks.setColorAt(ni, col);
  m4.compose(v3.set(x - 0.03 * sx, y + 0.03 * sy, z + 0.31 * s), q, sc.set(sx, sy, s)); faces.setMatrixAt(ni, m4);
  col.offsetHSL(0, -0.05, 0.1); faces.setColorAt(ni, col);
  ni++;
}
function addGem(x, y, z, s, t) { if (ng >= 80) return; e3.set(0.25, t * 2 + x, 0); q.setFromEuler(e3); m4.compose(v3.set(x, y, z), q, sc.set(s, s, s)); gems.setMatrixAt(ng++, m4); }
const easeBack = t => { const c = 1.9; t = clamp(t, 0, 1); return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

loop((dt, t) => {
  const sec = dt / 60; ni = 0; ng = 0; settle = Math.max(0, settle - sec);
  // preview: which cells / lines would the dragged piece make?
  let prev = null;
  if (drag) {
    drag.x = lerp(drag.x, drag.tx, 0.45); drag.y = lerp(drag.y, drag.ty, 0.45); drag.s = lerp(drag.s, 1, 0.3);
    const [r0, c0] = pieceOrigin(drag.p, drag.x, drag.y);
    if (fits(board, drag.p.cells, r0, c0)) {
      const b2 = board.map(r => r.slice()); for (const [x, y] of drag.p.cells) b2[r0 + y][c0 + x] = { color: drag.p.color };
      prev = { r0, c0, ...fullLines(b2) };
    }
  }
  if (botMove) {
    botMove.k = Math.min(1, botMove.k + sec * 3.2); const k = 1 - Math.pow(1 - botMove.k, 3);
    const p = botMove.p, [w, h] = dims(p.cells), [tx, ty] = cellPos(botMove.r0 + (h - 1) / 2, botMove.c0 + (w - 1) / 2);
    const sx = SLOT_X[p.slot], sy = TRAY_Y;
    botMove.x = lerp(sx, tx, k); botMove.y = lerp(sy, ty, k) + Math.sin(k * Math.PI) * 1.2; botMove.s = lerp(TRAY_S, 1, k);
    if (botMove.k >= 1) { place(p, botMove.r0, botMove.c0); botMove = null; }
  }
  // board
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const b = board[r][c]; if (!b) continue;
    const [x, y] = cellPos(r, c);
    if (b.pop !== 0) b.pop = b.pop < 0 ? Math.min(0, b.pop + sec) : Math.max(0, b.pop - sec * 4.5);
    let s = 1, z = 0, color = b.color, light = 0;
    if (b.pop < 0) { s = 0; } else if (b.pop > 0) { const k = 1 - b.pop; s = 1 + Math.sin(k * Math.PI) * 0.18; z = Math.sin(k * Math.PI) * 0.15; light = b.pop * 0.5; }
    if (b.pop < 0 && b.pop > -0.25) { s = easeBack((0.25 + b.pop) / 0.25); }
    if (prev && (prev.rows.includes(r) || prev.cols.includes(c))) { color = drag.p.color; light = 0.12 + 0.12 * Math.sin(t * 12); z = 0.08; }
    if (b.dead !== undefined) { b.dead = Math.max(0, b.dead - sec); if (b.dead === 0) { color = '#7a7f9a'; light = 0; } }
    if (s > 0.01) addBlock(x, y, z, s, color, 0, light);
    if (b.gem && s > 0.01) addGem(x, y, 0.62 + z + Math.sin(t * 3 + x) * 0.05, s, t);
  }
  // clearing animations: flash white, pop up, shrink + spin, burst
  for (const a of anims) {
    a.t += sec;
    if (a.t < 0) { addBlock(a.x, a.y, 0, 1, a.color, 0, 0.1); if (a.gem) addGem(a.x, a.y, 0.62, 1, t); continue; }
    if (!a.burst) { a.burst = true; burst(scene, new THREE.Vector3(a.x, a.y, 0.6), [a.color, '#ffffff'], 4, { speed: 0.09, up: 0.07, size: 0.8, gravity: 0.008 }); if (Math.random() < 0.3) tone(700 + Math.random() * 500, 0.04, 'sine', 0.05, 1.5); }
    const k = a.t / 0.32; if (k >= 1) { a.done = true; continue; }
    addBlock(a.x, a.y, k * 1.2, (1 + k * 0.3) * (1 - k * k), a.color, k * 2.4, Math.max(0, 0.9 - k * 1.5));
  }
  anims = anims.filter(a => !a.done);
  // gems flying to the goal counter
  for (const f of flyers) {
    f.t += sec; if (f.t < 0) continue;
    const k = Math.min(1, f.t / 0.55), e = k * k * (3 - 2 * k);
    if (!f.sx) { f.sx = f.x; f.sy = f.y; }
    addGem(lerp(f.sx, 0, e) + Math.sin(k * Math.PI) * (f.sx > 0 ? 1.5 : -1.5), lerp(f.sy, 8.6, e), 1 + Math.sin(k * Math.PI) * 2, 1 + Math.sin(k * Math.PI) * 0.6, t * 4);
    if (k >= 1) { f.done = true; sfx.coin(); updateGoal(true); burst(scene, new THREE.Vector3(0, 8.6, 1), ['#bff6ff', '#4fd8ff', '#fff'], 10, { speed: 0.08, up: 0.05, size: 0.5 }); }
  }
  flyers = flyers.filter(f => !f.done);
  // tray pieces (small) + the dragged one (full size, lifted, casting a shadow on the board)
  for (const p of tray || []) {
    if (p.used) continue;
    const [w, h] = dims(p.cells);
    p.pop = Math.min(1, p.pop + sec * 3.5);
    const holder = drag && drag.p === p ? drag : botMove && botMove.p === p ? botMove : null;
    const s = holder ? holder.s : TRAY_S * easeBack(Math.max(0, p.pop)), cxp = holder ? holder.x : SLOT_X[p.slot], cyp = holder ? holder.y : TRAY_Y + Math.sin(t * 2 + p.slot) * 0.05;
    const z = holder ? 1.4 : 0, fitsSomewhere = state !== 'play' || anyFit(board, p.cells);
    for (const [x, y] of p.cells) addBlock(cxp + (x - (w - 1) / 2) * s, cyp - (y - (h - 1) / 2) * s, z, s * 0.98, fitsSomewhere ? p.color : '#6c7090', 0, holder ? 0.08 : 0);
  }
  // ghost preview on the board
  ghost.count = 0;
  if (prev) { const [w, h] = dims(drag.p.cells); for (const [x, y] of drag.p.cells) { const [gx, gy] = cellPos(prev.r0 + y, prev.c0 + x); m4.compose(v3.set(gx, gy, -0.05), q.identity(), sc.set(0.96, 0.96, 0.5)); ghost.setMatrixAt(ghost.count++, m4); } ghost.instanceMatrix.needsUpdate = true; ghost.material.color.set(drag.p.color).lerp(tmpC.set('#fff'), 0.3); }
  blocks.count = faces.count = ni; gems.count = ng;
  blocks.instanceMatrix.needsUpdate = faces.instanceMatrix.needsUpdate = gems.instanceMatrix.needsUpdate = true;
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true; if (faces.instanceColor) faces.instanceColor.needsUpdate = true;
});

buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks + bot (plans the best placement, animates it)
function evalMove(b, cells, r0, c0) {
  const b2 = b.map(r => r.slice()); for (const [x, y] of cells) b2[r0 + y][c0 + x] = { color: 1 };
  const { rows, cols } = fullLines(b2); let gemsGot = 0;
  const kill = new Set(); rows.forEach(r => { for (let c = 0; c < N; c++) kill.add(r * N + c); }); cols.forEach(c => { for (let r = 0; r < N; r++) kill.add(r * N + c); });
  kill.forEach(k => { const x = b2[Math.floor(k / N)][k % N]; if (x && x.gem) gemsGot++; });
  kill.forEach(k => { b2[Math.floor(k / N)][k % N] = null; });
  let sc2 = (rows.length + cols.length) * 12 + gemsGot * 25, holes = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (b2[r][c]) continue; let nb = 0; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N || b2[rr][cc]) nb++; } if (nb >= 3) holes++;
  }
  // reward rows/cols near completion that hold gems
  for (let r = 0; r < N; r++) { const f = b2[r].filter(Boolean).length, g = b2[r].some(x => x && x.gem); if (g) sc2 += f * 0.6; }
  for (let c = 0; c < N; c++) { let f = 0, g = false; for (let r = 0; r < N; r++) if (b2[r][c]) { f++; if (b2[r][c].gem) g = true; } if (g) sc2 += f * 0.6; }
  return sc2 - holes * 2.2 + r0 * 0.05;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || botMove || drag || settle > 0) return;
    let bestM = null;
    for (const p of tray) { if (p.used) continue; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(board, p.cells, r, c)) { const v = evalMove(board, p.cells, r, c); if (!bestM || v > bestM.v) bestM = { p, r0: r, c0: c, v }; } }
    if (bestM) { botMove = { ...bestM, k: 0, x: SLOT_X[bestM.p.slot], y: TRAY_Y, s: TRAY_S }; sfx.tap(); }
  },
};

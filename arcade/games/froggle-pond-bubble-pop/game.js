// Froggle — original bubble-popping game for kids. Tippy the pond frog blows bubbles: aim, let go, match 3 of a colour to pop them.
// Bubbles left hanging fall into the pond, and ladybugs trapped in bubbles fly free. Clear the board before the bubbles run out.
import { THREE, createStage, createUI, store, loop, buzz, note, tone, burst, confetti, lerp, clamp, rng, palette, applyPalette, mat, glossy, rounded } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';

const NAME = 'Froggle: Pond Bubble Pop';
const S = store('froggle');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('froggle');

const stage = createStage({ fov: 45, shadows: true, shadowSize: 10 });
const { scene, camera, sun } = stage;
sun.position.set(3, 8, 14); sun.target.position.set(0, 0, 0);
const ui = createUI({ title: 'FROGGLE', hint: 'Aim + let go!', hand: '👆' });
const D = daily('froggle', ui, { name: NAME });

// ---------------------------------------------------------------- geometry of the board (XY plane, camera looks down -Z)
const R = 0.5, COLS = 8, ROWH = R * Math.sqrt(3), TOPY = 7.0, MAXROWS = 13, DANGER = 12, WALL = COLS * R;   // x in [-4, 4]
const SHOOT = new THREE.Vector3(0, -4.7, 0), FROGY = -6.45;
const COLORS = ['#ff4d6d', '#ffd23f', '#3a86ff', '#3ccf7a', '#a35cff', '#ff8c42'];
const cellX = (r, c) => -WALL + R + c * 2 * R + (r % 2) * R;
const cellY = (r) => TOPY - r * ROWH;
const colsIn = (r) => r % 2 ? COLS - 1 : COLS;
function neighbours(r, c) {
  const o = r % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  return o.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && a < MAXROWS && b >= 0 && b < colsIn(a));
}

// ---------------------------------------------------------------- scene dressing: pond frame, reeds, lily pads
function fit() {
  const vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2);
  const d = Math.max((WALL + 0.55) / (th * camera.aspect), (TOPY + 11.4) / (2 * th));
  const cy = (TOPY + 3.6 - 7.6) / 2;
  camera.position.set(0, cy, d); camera.lookAt(0, cy, 0);
}
addEventListener('resize', fit); fit();
const panel = new THREE.Mesh(rounded(WALL * 2 + 0.5, TOPY + 7.5, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.42, roughness: 0.8 }));
panel.position.set(0, (TOPY + 0.6 - 6.9) / 2, -0.75); panel.receiveShadow = true; scene.add(panel);
const wallM = mat('#ffffff');
for (const s of [-1, 1]) { const w = new THREE.Mesh(rounded(0.3, TOPY + 7.2, 0.6, 0.14), wallM); w.position.set(s * (WALL + 0.17), panel.position.y, -0.2); w.castShadow = true; scene.add(w); }
const dangerLine = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }));
dangerLine.position.set(0, cellY(DANGER) + R * 0.2, -0.3); scene.add(dangerLine);
const water = new THREE.Mesh(rounded(WALL * 2 + 0.5, 2.0, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: '#7fd3ff', roughness: 0.2, transparent: true, opacity: 0.85 }));
water.position.set(0, -6.9, -0.5); scene.add(water);
function lilyPad(x, y, s, col = '#4cc46a') {
  const sh = new THREE.Shape(); sh.absarc(0, 0, 1, 0.35, Math.PI * 2 - 0.05, false); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 20 });
  const m = new THREE.Mesh(g, mat(col)); m.scale.set(s, s * 0.45, s); m.position.set(x, y, -0.1); m.rotation.x = -0.25; m.castShadow = true; scene.add(m); return m;
}
lilyPad(0, -6.55, 1.35); lilyPad(-2.9, -6.8, 0.7, '#5fd47c'); lilyPad(3.0, -6.7, 0.6, '#5fd47c');
for (const [x, h] of [[-3.7, 1.6], [-3.35, 1.1], [3.6, 1.4], [3.3, 0.9]]) {
  const reed = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, h, 4, 8), mat('#3fae5a')); reed.position.set(x, -6.7 + h / 2, 0.1); scene.add(reed);
  const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.35, 4, 8), mat('#a0643c')); top.position.set(x, -6.7 + h + 0.15, 0.1); scene.add(top);
}

// ---------------------------------------------------------------- Tippy the frog (original character: round, teal-lime, freckles, tiny crown leaf)
const frog = new THREE.Group(); frog.position.set(0, FROGY, 0.2); scene.add(frog);
const frogM = glossy('#58d68d'), bellyM = mat('#d6f5c6'), whiteM = glossy('#ffffff'), darkM = glossy('#28203a');
const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.9, 28, 20), frogM); fBody.scale.set(1.15, 0.8, 0.9); fBody.position.y = 0.55; fBody.castShadow = true;
const fBelly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), bellyM); fBelly.scale.set(1.1, 0.75, 0.6); fBelly.position.set(0, 0.42, 0.5);
frog.add(fBody, fBelly);
const fEyes = [];
for (const s of [-1, 1]) {
  const bump = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), frogM); bump.position.set(s * 0.52, 1.12, 0.2); bump.castShadow = true;
  const w = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), whiteM); w.position.set(s * 0.52, 1.17, 0.42);
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), darkM); p.position.set(s * 0.52, 1.17, 0.64);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), whiteM); gl.position.set(s * 0.47, 1.24, 0.77);
  const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ color: '#ff8fab', transparent: true, opacity: 0.7 })); cheek.position.set(s * 0.68, 0.62, 0.79);
  frog.add(bump, w, p, gl, cheek); fEyes.push({ w, p, gl, s });
}
const smileG = new THREE.TorusGeometry(0.34, 0.05, 8, 20, Math.PI); smileG.rotateZ(Math.PI);
const fMouth = new THREE.Mesh(smileG, darkM); fMouth.position.set(0, 0.82, 0.78); frog.add(fMouth);
for (const [x, y] of [[-0.25, 0.95], [0.3, 1.0], [0.05, 1.05]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#3fb36f')); d.position.set(x, y, 0.62); frog.add(d); }
const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat('#ffd23f')); leaf.scale.set(1.4, 0.4, 0.8); leaf.position.set(0.15, 1.42, 0.05); leaf.rotation.z = -0.4; frog.add(leaf);

// ---------------------------------------------------------------- bubbles (instanced: body + glint)
const MAXB = 220;
const bodyIM = new THREE.InstancedMesh(new THREE.SphereGeometry(R * 0.96, 24, 16), new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.05 }), MAXB);
const glintIM = new THREE.InstancedMesh(new THREE.SphereGeometry(R * 0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), MAXB);
bodyIM.castShadow = true; bodyIM.frustumCulled = glintIM.frustumCulled = false; scene.add(bodyIM, glintIM);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
// ladybugs (a few, individual meshes)
function makeBug() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glossy('#ff3b3b')); shell.scale.set(1, 0.8, 0.7);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), darkM); head.position.set(0, 0.2, 0.02);
  g.add(shell, head);
  for (const [x, y] of [[-0.09, 0.03], [0.09, 0.03], [-0.07, -0.1], [0.07, -0.1]]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), darkM); d.position.set(x, y, 0.15); g.add(d); }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), whiteM); e.position.set(s * 0.05, 0.24, 0.1); g.add(e); }
  g.visible = false; return g;
}

// ---------------------------------------------------------------- aim guide dots
const DOTS = 34;
const dotIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), DOTS);
dotIM.frustumCulled = false; scene.add(dotIM);

// ---------------------------------------------------------------- state
let busy = false, grid = [], flying = [], shot = null, cur = 0, nxt = 0, shots = 0, shotsMax = 0, aim = Math.PI / 2, aiming = false, colorsN = 3;
const B = worldBoard({ game: 'froggle', label: 'Points', limits: { maxRun: 4000, maxPerSec: 120 }, mode: 'sum' });
let levelStart = 0;   // score when this level started: the world board counts each cleared level's points
let state = 'ready', score = 0, sessionLv = 0, recorded = false, beatenShown = false, total = 0, bugs = [], frogHop = 0, frogSquash = 0, shake = 0, r0 = Math.random;

const badge = document.createElement('div');
badge.style.cssText = 'position:fixed;bottom:calc(22px + env(safe-area-inset-bottom));left:18px;z-index:5;pointer-events:none;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:28px;color:#fff;background:radial-gradient(circle at 35% 30%,#fff9 0 12%,transparent 13%),var(--ui,#3a86ff);box-shadow:0 4px 0 rgba(0,0,0,.15);transition:transform .15s';
document.body.appendChild(badge);
const showShots = () => { badge.textContent = shots; badge.style.transform = 'scale(1.18)'; setTimeout(() => badge.style.transform = '', 140); badge.style.opacity = shots <= 3 ? '1' : '0.95'; };

function present() { const s = new Set(); for (const row of grid) for (const b of row) if (b) s.add(b.col); return [...s]; }
function pickColor() { const p = present(); return p.length ? p[Math.floor(r0() * p.length)] : 0; }

function build() {
  const seed = D.seed ? D.seed + sessionLv * 977 : level * 7919 + 3, r = rng(seed), fk = F.k();
  r0 = rng(seed + 5);
  applyPalette(palette(level));
  bugs.forEach(b => scene.remove(b.g)); bugs = [];
  flying = []; shot = null; busy = false;
  colorsN = level < 3 ? 3 : level < 6 ? 4 : level < 10 ? 5 : 6;
  // knob 1: starting rows (harder when bigger -> * fk)
  const rows = clamp(Math.round((3 + Math.floor((level - 1) * 0.55)) * fk), 3, 9);
  grid = Array.from({ length: MAXROWS }, (_, rr) => Array(colsIn(rr)).fill(null));
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < colsIn(rr); c++) {
    let col = Math.floor(r() * colorsN);
    // friendly clumps: often copy a neighbour above/left so kids see matches
    if (r() < 0.55) { const nb = neighbours(rr, c).filter(([a, b]) => grid[a][b]); if (nb.length) { const [a, b] = nb[Math.floor(r() * nb.length)]; col = grid[a][b].col; } }
    grid[rr][c] = { col, s: 0, t: -(rr * 0.12 + c * 0.03), wob: 0, bug: null };
  }
  // ladybugs in a few bubbles
  const nb = Math.min(3, 1 + Math.floor(level / 3));
  for (let i = 0; i < nb; i++) { const rr = Math.floor(r() * rows), c = Math.floor(r() * colsIn(rr)); const b = grid[rr][c]; if (b && !b.bug) { b.bug = makeBug(); scene.add(b.bug); bugs.push({ g: b.bug, free: false }); } }
  total = rows * COLS - Math.floor(rows / 2);
  // knob 2: bubbles you get (easier when bigger -> / fk)
  shotsMax = shots = clamp(Math.round((total * 0.55 + 7) / fk), 8, 70);
  cur = pickColor(); nxt = pickColor(); recorded = false;
  ui.levels(level); ui.progress(0); ui.score(score); showShots();
}

// ---------------------------------------------------------------- shot simulation (shared by the guide, the shot and the bot)
function occupiedNear(x, y, rad) {
  for (let rr = 0; rr < MAXROWS; rr++) { const cy = cellY(rr); if (Math.abs(cy - y) > rad) continue; for (let c = 0; c < colsIn(rr); c++) { const b = grid[rr][c]; if (b && Math.hypot(cellX(rr, c) - x, cy - y) < rad) return true; } }
  return false;
}
function simulate(ang) {
  let x = SHOOT.x, y = SHOOT.y, dx = Math.cos(ang), dy = Math.sin(ang); const pts = [[x, y]], step = 0.1;
  for (let i = 0; i < 600; i++) {
    x += dx * step; y += dy * step;
    if (x < -WALL + R) { x = -WALL + R; dx = -dx; pts.push([x, y]); } else if (x > WALL - R) { x = WALL - R; dx = -dx; pts.push([x, y]); }
    if (y >= TOPY || occupiedNear(x, y, 2 * R * 0.86)) break;
  }
  pts.push([x, y]);
  // snap to the nearest empty cell
  let best = null, bd = 1e9;
  for (let rr = 0; rr < MAXROWS; rr++) for (let c = 0; c < colsIn(rr); c++) {
    if (grid[rr][c]) continue; const d = Math.hypot(cellX(rr, c) - x, cellY(rr) - y);
    if (d < bd && (rr === 0 || neighbours(rr, c).some(([a, b]) => grid[a][b]))) { bd = d; best = [rr, c]; }
  }
  return { pts, cell: best };
}
function cluster(r, c, sameCol = true) {
  const col = grid[r][c].col, seen = new Set([r * 100 + c]), out = [[r, c]];
  for (let i = 0; i < out.length; i++) for (const [a, b] of neighbours(...out[i])) {
    const k = a * 100 + b; if (seen.has(k) || !grid[a][b] || (sameCol && grid[a][b].col !== col)) continue; seen.add(k); out.push([a, b]);
  }
  return out;
}
function floating() {
  const seen = new Set(), q = [];
  for (let c = 0; c < COLS; c++) if (grid[0][c]) { seen.add(c); q.push([0, c]); }
  for (let i = 0; i < q.length; i++) for (const [a, b] of neighbours(...q[i])) { const k = a * 100 + b; if (!seen.has(k) && grid[a][b]) { seen.add(k); q.push([a, b]); } }
  const out = []; for (let rr = 0; rr < MAXROWS; rr++) for (let c = 0; c < colsIn(rr); c++) if (grid[rr][c] && !seen.has(rr * 100 + c)) out.push([rr, c]);
  return out;
}

// ---------------------------------------------------------------- shooting + resolving
function fire(ang) {
  if (state !== 'play' || shot || busy || shots <= 0) return;
  aim = clamp(ang, 0.2, Math.PI - 0.2);
  const sim = simulate(aim); if (!sim.cell) return;
  shots--; showShots();
  shot = { col: cur, pts: sim.pts, cell: sim.cell, seg: 0, x: SHOOT.x, y: SHOOT.y };
  cur = nxt; nxt = pickColor();
  frogSquash = 1; tone(380, 0.09, 'sine', 0.14, 2.2); tone(900, 0.04, 'triangle', 0.05, 1.5); buzz(8);
}
function land() {
  const [rr, c] = shot.cell, col = shot.col; shot = null;
  grid[rr][c] = { col, s: 1.25, t: 1, wob: 0, bug: null };
  for (const [a, b] of neighbours(rr, c)) if (grid[a][b]) grid[a][b].wob = 1;
  tone(260, 0.06, 'sine', 0.12, 0.8);
  const cl = cluster(rr, c);
  if (cl.length >= 3) {
    busy = true;
    cl.forEach(([a, b], i) => setTimeout(() => popOne(a, b, i), i * 45));
    setTimeout(() => {
      const fl = floating();
      fl.forEach(([a, b]) => { const g = grid[a][b]; flying.push({ col: g.col, x: cellX(a, b), y: cellY(a), vx: (Math.random() - 0.5) * 0.06, vy: 0.05 + Math.random() * 0.04, s: 1, bug: g.bug }); grid[a][b] = null; score += 20; });
      if (fl.length) { ui.pop(fl.length >= 5 ? 'WOW!' : '⭐', '#fff', 40, 28); [0, 4, 7].forEach((s, i) => setTimeout(() => note(76 + s, 0.25, 0.12), i * 70)); }
      ui.score(score); after();
    }, cl.length * 45 + 30);
    if (cl.length >= 5) { ui.flash(0.2); shake = 0.25; }
  } else {
    if (rr >= DANGER) return lose();
    after();
  }
}
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
function popOne(a, b, i) {
  const g = grid[a][b]; if (!g) return; grid[a][b] = null; score += 10; ui.score(score);
  const p = new THREE.Vector3(cellX(a, b), cellY(a), 0.2);
  burst(scene, p, [COLORS[g.col], '#ffffff'], 9, { speed: 0.09, up: 0.04, size: 0.55, shape: 'sphere', gravity: 0.004 });
  note(67 + PENTA[i % PENTA.length], 0.18, 0.12); tone(1100 + i * 40, 0.035, 'sine', 0.12, 0.4); buzz(6);
  if (g.bug) freeBug(g.bug, p);
}
function freeBug(g, p) {
  const b = bugs.find(k => k.g === g); if (!b || b.free) return; b.free = true; b.t = 0; b.x = p.x; b.y = p.y;
  score += 50; ui.score(score); ui.pop('🐞', '#fff', 48, 30);
  [0, 7, 12, 16].forEach((s, i) => setTimeout(() => note(79 + s, 0.2, 0.12), i * 60));
}
function after() {
  busy = false;
  const left = grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
  ui.progress(1 - left / total);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, new THREE.Vector3(0, 2, 1), 50); }
  if (left === 0) return win();
  for (let rr = DANGER; rr < MAXROWS; rr++) if (grid[rr].some(Boolean)) return lose();
  if (shots <= 0) return lose();
  const p = present(); if (!p.includes(cur)) cur = pickColor(); if (!p.includes(nxt)) nxt = pickColor();
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(score - levelStart); }
  const frac = shots / shotsMax, stars = frac > 0.4 ? 3 : frac > 0.15 ? 2 : 1;
  const done = level; level++; sessionLv++; if (!D.seed) S.set('level', level);
  best = Math.max(best, score); S.set('best', best);
  frogHop = 1; confetti(scene, new THREE.Vector3(0, 1, 1), 100); ui.flash(0.35); buzz([20, 30, 20]);
  [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(72 + s, 0.35, 0.15), i * 95));
  D.won(score); ui.win(done, '⭐'.repeat(stars));
}
function lose() {
  state = 'lost'; if (!recorded) { recorded = true; const left = grid.reduce((n, row) => n + row.filter(Boolean).length, 0); F.level(false, 1 - left / total); }
  best = Math.max(best, score); S.set('best', best);
  [67, 64, 60].forEach((n, i) => setTimeout(() => note(n, 0.4, 0.12), i * 160));
  ui.lose('Try again!', '💪 🙂');
}

// ---------------------------------------------------------------- input: drag to aim (dotted guide), let go to blow the bubble
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function angTo(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(zPlane, p)) return aim;
  return clamp(Math.atan2(Math.max(0.3, p.y - SHOOT.y), p.x - SHOOT.x), 0.2, Math.PI - 0.2);
}
addEventListener('pointerdown', e => { if (state !== 'play') return; aiming = true; aim = angTo(e); });
addEventListener('pointermove', e => { if (aiming) aim = angTo(e); });
addEventListener('pointerup', e => { if (!aiming) return; aiming = false; if (state === 'play') fire(aim); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the frog aims along the dotted guide and blows the best bubble twice (the bot's own aim), and each shot is given back
demo(() => { const n = shots; window.__game.bot(); if (shots < n) { shots++; showShots(); } else return false; },
  { ready: () => state === 'play' && level === 1 && !D.seed && !shot && !busy && !aiming && shots >= shotsMax - 1, wait: 1800, every: 1600, max: 2 });
ui.onTap((which) => { if (which === 'lose') score = 0; build(); state = 'play'; ui.hideStart(); levelStart = score; B.start(); });

// ---------------------------------------------------------------- loop
let guideT = 0;
loop((dt, t) => {
  let n = 0;
  const put = (x, y, z, s, col) => { if (n >= MAXB) return; _m.compose(_p.set(x, y, z), _q, _s.setScalar(s)); bodyIM.setMatrixAt(n, _m); bodyIM.setColorAt(n, _c.set(COLORS[col]));
    _m.compose(_p.set(x - R * 0.32 * s, y + R * 0.36 * s, z + R * 0.62 * s), _q, _s.setScalar(s)); glintIM.setMatrixAt(n, _m); n++; };
  for (let rr = 0; rr < MAXROWS; rr++) for (let c = 0; c < colsIn(rr); c++) {
    const b = grid[rr][c]; if (!b || state === 'ready') continue;
    b.t = Math.min(1, b.t + dt * 0.08); if (b.t < 0) continue;
    const target = 1; b.s = lerp(b.s || 0, target, 0.2 * dt); b.wob = Math.max(0, b.wob - dt * 0.06);
    const s = b.s * (1 + Math.sin(b.wob * 12) * 0.06 * b.wob) * (1 + Math.sin(t * 2 + rr + c) * 0.012);
    const x = cellX(rr, c), y = cellY(rr); put(x, y, 0, s, b.col);
    if (b.bug) { b.bug.visible = true; b.bug.position.set(x, y + Math.sin(t * 3 + c) * 0.03, 0.12); b.bug.scale.setScalar(s); b.bug.rotation.z = Math.sin(t * 2 + rr) * 0.2; }
  }
  // falling bubbles
  for (const f of flying) { f.vy -= 0.012 * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.bug) { const b = bugs.find(k => k.g === f.bug); if (b && !b.free) freeBug(f.bug, new THREE.Vector3(f.x, f.y, 0)); } }
  for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; if (f.y < -6.4) { burst(scene, new THREE.Vector3(f.x, -6.4, 0.3), ['#bfeaff', '#ffffff'], 6, { speed: 0.06, up: 0.1, size: 0.4, shape: 'sphere' }); tone(500 + Math.random() * 300, 0.05, 'sine', 0.06, 0.5); flying.splice(i, 1); } else put(f.x, f.y, 0.3, 1, f.col); }
  // shot in flight
  if (shot) {
    let move = 0.55 * dt;
    while (move > 0 && shot.seg < shot.pts.length - 1) {
      const [tx, ty] = shot.pts[shot.seg + 1], d = Math.hypot(tx - shot.x, ty - shot.y);
      if (d <= move) { shot.x = tx; shot.y = ty; shot.seg++; move -= d; if (shot.seg < shot.pts.length - 1) tone(600, 0.03, 'sine', 0.05, 1); }
      else { shot.x += (tx - shot.x) / d * move; shot.y += (ty - shot.y) / d * move; move = 0; }
    }
    put(shot.x, shot.y, 0.1, 1, shot.col);
    if (shot.seg >= shot.pts.length - 1) land();
  }
  // loaded + next bubble on Tippy
  frogSquash = Math.max(0, frogSquash - dt * 0.07); frogHop = Math.max(0, frogHop - dt * 0.02);
  if (state === 'play' || state === 'ready') {
    const ls = shot ? Math.min(1, 0.3 + (1 - frogSquash)) : 1;
    put(SHOOT.x, SHOOT.y + 0.05 + Math.sin(t * 3) * 0.04, 0.4, ls, cur);
    put(2.0, FROGY + 0.2, 0.6, 0.72, nxt);
  }
  bodyIM.count = glintIM.count = n; bodyIM.instanceMatrix.needsUpdate = glintIM.instanceMatrix.needsUpdate = true; if (bodyIM.instanceColor) bodyIM.instanceColor.needsUpdate = true;
  // ladybugs that are free fly up and away, wiggling
  for (const b of bugs) if (b.free) { b.t += dt; b.g.position.set(b.x + Math.sin(b.t * 0.2) * 0.6, b.y + b.t * 0.06, 1.2); b.g.rotation.z = Math.sin(b.t * 0.5) * 0.5; b.g.scale.setScalar(1.3); if (b.t > 200) b.g.visible = false; }
  // aim guide
  let k = 0;
  if (state === 'play' && !shot && (aiming || guideT > 0)) {
    const sim = simulate(aim), pts = sim.pts; let acc = 0.25;
    for (let i = 0; i < pts.length - 1 && k < DOTS; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], d = Math.hypot(bx - ax, by - ay);
      while (acc < d && k < DOTS) { const f = acc / d; _m.compose(_p.set(ax + (bx - ax) * f, ay + (by - ay) * f, 0.1), _q, _s.setScalar(1 - k / DOTS * 0.5)); dotIM.setMatrixAt(k++, _m); acc += 0.42; }
      acc -= d;
    }
  }
  guideT = Math.max(0, guideT - dt);
  dotIM.count = k; dotIM.instanceMatrix.needsUpdate = true; dotIM.material.color.set(COLORS[cur]).lerp(_c.set('#ffffff'), 0.35);
  // Tippy: squash on blow, hop on win, eyes follow the aim
  frog.scale.set(1 + frogSquash * 0.12, 1 - frogSquash * 0.15 + Math.sin(t * 2.5) * 0.015, 1);
  frog.position.y = FROGY + Math.abs(Math.sin(frogHop * Math.PI * 3)) * 0.8 * frogHop;
  for (const e of fEyes) { const ox = Math.cos(aim) * 0.08, oy = (Math.sin(aim) - 0.8) * 0.08; e.p.position.set(e.s * 0.52 + ox, 1.17 + oy, 0.64); e.gl.position.set(e.s * 0.52 + ox - 0.05, 1.24 + oy, 0.77); }
  fMouth.scale.y = state === 'lost' ? -0.6 : 1;
  shake = Math.max(0, shake - dt * 0.012);
  camera.position.x = (Math.random() - 0.5) * shake;
});

build(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // tries every angle with the same simulation the guide uses, picks the shot that pops/drops the most
    if (state !== 'play' || shot || busy) return;
    let bestA = Math.PI / 2, bestV = -1e9;
    for (let a = 0.22; a < Math.PI - 0.22; a += 0.025) {
      const { cell } = simulate(a); if (!cell) continue; const [rr, c] = cell;
      grid[rr][c] = { col: cur }; const cl = cluster(rr, c); let v;
      if (cl.length >= 3) { const saved = cl.map(([x, y]) => [x, y, grid[x][y]]); cl.forEach(([x, y]) => grid[x][y] = null); v = 100 + cl.length * 10 + floating().length * 15; saved.forEach(([x, y, g]) => grid[x][y] = g); }
      else v = (cl.length - 1) * 8 - rr * 2 - (rr >= DANGER ? 500 : 0);
      grid[rr][c] = null; v += Math.random() * 3;
      if (v > bestV) { bestV = v; bestA = a; }
    }
    aim = bestA; guideT = 6; fire(bestA);
  },
};

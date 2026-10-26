// Slidegate — drag chunky shapes around a walled board and out through the gate of their own colour, before time runs out.
// Levels are generated (seeded) and always solvable (see gen.js). One verb: drag.
import { THREE, createStage, createUI, store, loop, buzz, sfx, tone, note, burst, confetti, lerp, clamp, glossy, mat, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { generate, SIDES, inside, at, canMove, stamp, exitGate, pathOut } from './gen.js';

const NAME = 'Slidegate: Sliding Shapes Puzzle';
const S = store('slidegate');
const F = flow('slidegate');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 40, shadowSize: 9 });
const { scene, camera, sun, renderer } = stage;
sun.intensity = 1.55; sun.shadow.mapSize.set(1024, 1024);
const ui = createUI({ title: 'SLIDEGATE', hint: 'Drag each block out<br>through its colour gate', hand: '👆' });
const D = daily('slidegate', ui, { name: NAME });
const B = board({ game: 'slidegate', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'tl' });

const COLS = ['#ff4f6d', '#3d8bff', '#ffc93c', '#2fc47a', '#a259ff', '#ff8a2b'];
const BGS = [['#cfe3ff', '#f3f8ff'], ['#ffd6e4', '#fff3e6'], ['#d4f5e6', '#f2fff8'], ['#e3d9ff', '#fff0fb'], ['#ffe6c4', '#fffbe9'], ['#c9f1ff', '#eefcff']];
const BLOCK_H = 0.5;

// ---------------------------------------------------------------- geometry helpers
/** extruded outline of a polyomino (one smooth mesh per block, rounded top edges) */
function blockGeo(cells) {
  const E = new Map(), k = (a, b) => a + ';' + b;
  for (const [x, y] of cells) {
    const p = [[x - 0.5, y - 0.5], [x + 0.5, y - 0.5], [x + 0.5, y + 0.5], [x - 0.5, y + 0.5]];
    for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4], f = k(a, b), rv = k(b, a); if (E.has(rv)) E.delete(rv); else E.set(f, [a, b]); }
  }
  const next = new Map(); for (const [a, b] of E.values()) next.set(String(a), b);
  const start = [...E.values()][0][0]; let pts = [start], cur = next.get(String(start));
  for (let g = 0; g < 200 && String(cur) !== String(start); g++) { pts.push(cur); cur = next.get(String(cur)); }
  // drop collinear points
  pts = pts.filter((p, i) => { const a = pts[(i + pts.length - 1) % pts.length], c = pts[(i + 1) % pts.length]; return !((a[0] === p[0] && p[0] === c[0]) || (a[1] === p[1] && p[1] === c[1])); });
  const n = pts.length, m = 0.14, nrm = (a, b) => { const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); return [-dy, dx]; };
  // the loop above runs clockwise on screen (y down) = counter-clockwise in math axes, so the inside is on the left
  const ins = pts.map((p, i) => { const a = pts[(i + n - 1) % n], c = pts[(i + 1) % n], n1 = nrm(a, p), n2 = nrm(p, c); return [p[0] + m * (n1[0] + n2[0]), p[1] + m * (n1[1] + n2[1])]; });
  // test orientation: inset must shrink the area, else flip
  const area = q => q.reduce((s, p, i) => { const c = q[(i + 1) % q.length]; return s + p[0] * c[1] - c[0] * p[1]; }, 0) / 2;
  const pts2 = Math.abs(area(ins)) < Math.abs(area(pts)) ? ins : pts.map((p, i) => { const a = pts[(i + n - 1) % n], c = pts[(i + 1) % n], n1 = nrm(a, p), n2 = nrm(p, c); return [p[0] - m * (n1[0] + n2[0]), p[1] - m * (n1[1] + n2[1])]; });
  // rounded plan corners
  const sh = new THREE.Shape(), rr = 0.13;
  pts2.forEach((p, i) => {
    const a = pts2[(i + n - 1) % n], c = pts2[(i + 1) % n];
    const da = [Math.sign(a[0] - p[0]), Math.sign(a[1] - p[1])], dc = [Math.sign(c[0] - p[0]), Math.sign(c[1] - p[1])];
    const p1 = [p[0] + da[0] * rr, p[1] + da[1] * rr], p2 = [p[0] + dc[0] * rr, p[1] + dc[1] * rr];
    if (i === 0) sh.moveTo(p1[0], p1[1]); else sh.lineTo(p1[0], p1[1]);
    sh.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
  });
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: BLOCK_H - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(Math.PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); g.computeVertexNormals();
  return g;
}
const STUD = new THREE.CylinderGeometry(0.2, 0.22, 0.12, 18);
const WALL = rounded(0.98, 0.98, 0.52, 0.16); WALL.rotateX(Math.PI / 2); WALL.translate(0, 0.26, 0);
const ARROW = (() => { const s = new THREE.Shape(); s.moveTo(0.22, 0); s.lineTo(-0.04, 0.2); s.lineTo(-0.04, 0.08); s.lineTo(-0.22, 0.08); s.lineTo(-0.22, -0.08); s.lineTo(-0.04, -0.08); s.lineTo(-0.04, -0.2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; })();
function floorTex(W, H) {
  const c = document.createElement('canvas'), s = 64; c.width = W * s; c.height = H * s; const x = c.getContext('2d');
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { x.fillStyle = (i + j) % 2 ? '#dfe7f5' : '#e8eef9'; x.fillRect(i * s, j * s, s, s); x.fillStyle = 'rgba(70,90,140,.10)'; x.beginPath(); x.arc(i * s + s / 2, j * s + s / 2, 6, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- world
const world = new THREE.Group(); scene.add(world);
const wallMat = glossy('#3b4766', { roughness: 0.42 });
const studMat = glossy('#ffffff', { roughness: 0.3 });
const tray = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 })); tray.rotation.x = -Math.PI / 2; tray.position.y = -0.02; tray.receiveShadow = true; scene.add(tray);
let bd, W, H, blocks = [], gateMeshes = [], wallsIM, studsIM, floor, base;
let state = 'ready', score = 0, timeLeft = 60, timeMax = 60, recorded = false, beatenShown = false, combo = 0, lastExit = 0, cleared = 0, total = 0, lvStart = 0, warned = false;
const cx = x => x - (W - 1) / 2, cz = y => y - (H - 1) / 2;

function build() {
  world.clear(); gateMeshes = []; blocks = [];
  const fk = F.k(), seed = D.seed ? D.seed * 31 + level : level * 7717 + 13;
  bd = generate(D.seed ? 6 + (level - 1) : level, seed, fk); W = bd.W; H = bd.H;
  const bg = BGS[(level - 1) % BGS.length], bs = document.body.style; bs.setProperty('--bg1', bg[0]); bs.setProperty('--bg2', bg[1]); bs.setProperty('--ui', COLS[(level + 1) % COLS.length]);
  // base slab + floor
  base = new THREE.Mesh(rounded(W + 2.3, H + 2.3, 0.4, 0.4), mat('#2c3550')); base.geometry.rotateX(Math.PI / 2); base.position.y = -0.4; base.receiveShadow = true; world.add(base);
  floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat('#ffffff', { map: floorTex(W, H), roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001; floor.receiveShadow = true; world.add(floor);
  // walls (instanced): frame minus gates, plus notches
  const spots = [];
  const gateAt = (x, y) => bd.gates.find(g => { const [sx, sy] = SIDES[g.side]; if (sx) return x === (sx < 0 ? -1 : W) && y >= g.start && y < g.start + g.len; return y === (sy < 0 ? -1 : H) && x >= g.start && x < g.start + g.len; });
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    const edge = x < 0 || y < 0 || x >= W || y >= H;
    if ((edge && !gateAt(x, y)) || (!edge && at(bd, x, y) === -2)) spots.push([x, y]);
  }
  wallsIM = new THREE.InstancedMesh(WALL, wallMat, spots.length); wallsIM.castShadow = true; wallsIM.receiveShadow = true;
  const M = new THREE.Matrix4(); spots.forEach(([x, y], i) => { M.makeTranslation(cx(x), 0, cz(y)); wallsIM.setMatrixAt(i, M); }); world.add(wallsIM);
  // gates
  for (const g of bd.gates) {
    const [sx, sy] = SIDES[g.side], col = COLS[g.color], grp = new THREE.Group();
    const along = g.len, m = glossy(col, { emissive: col, emissiveIntensity: 0.25, roughness: 0.3 });
    const slab = new THREE.Mesh(rounded(sx ? 0.98 : along - 0.04, sx ? along - 0.04 : 0.98, 0.22, 0.1), m); slab.geometry.rotateX(Math.PI / 2); slab.position.y = 0.11; slab.castShadow = true; grp.add(slab);
    const glowM = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(sx ? 1 : along, sx ? along : 1), glowM); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.25; grp.add(glow);
    const aM = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 });
    for (let i = 0; i < along; i++) { const a = new THREE.Mesh(ARROW, aM); a.rotation.y = Math.atan2(-sy, sx); a.position.set(sx ? 0 : i - (along - 1) / 2, 0.24, sx ? i - (along - 1) / 2 : 0); grp.add(a); }
    const mid = g.start + (along - 1) / 2;
    grp.position.set(sx ? cx(sx < 0 ? -1 : W) : cx(mid), 0, sx ? cz(mid) : cz(sy < 0 ? -1 : H));
    grp.gate = g; grp.slab = slab; grp.glow = glowM; grp.pulse = 0; world.add(grp); gateMeshes.push(grp);
  }
  // blocks
  for (const k of bd.blocks) {
    const col = COLS[k.color], m = glossy(col, { roughness: 0.28, emissive: col, emissiveIntensity: 0.12 });
    const mesh = new THREE.Mesh(blockGeo(k.cells), m); mesh.castShadow = true; mesh.receiveShadow = true;
    const grp = new THREE.Group(); grp.add(mesh); grp.position.set(cx(k.x), 0, cz(k.y)); world.add(grp);
    if (k.lock) { const aM = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.5 }); const top = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
      const cxm = k.cells.reduce((a, c) => a + c[0], 0) / k.cells.length, cym = k.cells.reduce((a, c) => a + c[1], 0) / k.cells.length;
      for (const s of [-1, 1]) { const a = new THREE.Mesh(ARROW, aM); a.scale.setScalar(0.9); a.rotation.y = k.lock === 'h' ? (s > 0 ? 0 : Math.PI) : (s > 0 ? -Math.PI / 2 : Math.PI / 2); a.position.set(cxm + (k.lock === 'h' ? s * 0.28 : 0), top + 0.005, cym + (k.lock === 'v' ? s * 0.28 : 0)); grp.add(a); } }
    blocks.push({ k, grp, mesh, m, studCol: new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.32), vx: k.x, vy: k.y, lift: 0, sq: 0, nudge: [0, 0], out: null, gone: false });
  }
  const nStuds = bd.blocks.reduce((a, k) => a + (k.lock ? 0 : k.cells.length), 0);
  studsIM = new THREE.InstancedMesh(STUD, studMat, Math.max(1, nStuds)); studsIM.castShadow = true; studsIM.count = nStuds; world.add(studsIM);
  let si = 0; for (const b of blocks) if (!b.k.lock) for (let i = 0; i < b.k.cells.length; i++) studsIM.setColorAt(si++, new THREE.Color(COLS[b.k.color]).lerp(new THREE.Color('#ffffff'), 0.32));
  if (studsIM.instanceColor) studsIM.instanceColor.needsUpdate = true;
  total = blocks.length; cleared = 0; combo = 0;
  timeMax = timeLeft = Math.round(clamp((16 + bd.blocks.reduce((a, k) => a + 4 + k.cells.length * 1.2, 0)) / fk, 25, 200));
  recorded = false; beatenShown = false; warned = false;
  ui.levels(level); ui.progress(0); ui.els.sc.classList.remove('low'); showTime(); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : `${total} blocks`);
  frame();
}
function frame() {
  // fit the board in the space between the HUD and the bottom
  const asp = innerWidth / innerHeight, vf = camera.fov * Math.PI / 180, tilt = 0.5;
  const wide = asp > 1, needW = (W + 3.7) / asp, needH = (H + 2.8) * (wide ? 1.75 : 1.3);
  const d = Math.max(needW, needH) / (2 * Math.tan(vf / 2)) * 1.02;
  const sh = (H + 2.8) * (wide ? 0.02 : 0.1); camera.position.set(0, d * Math.cos(tilt), d * Math.sin(tilt) + sh); camera.lookAt(0, 0, sh);
  stage.followLight(new THREE.Vector3(0, 0, 0)); sun.position.set(-3, 14, 6);
}
addEventListener('resize', () => bd && frame());
function showTime() { const s = Math.max(0, Math.ceil(timeLeft)); ui.score(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); }

// ---------------------------------------------------------------- moves
function blockAt(x, y) { if (!inside(bd, x, y)) return null; const id = at(bd, x, y); return id >= 0 ? blocks.find(b => b.k.id === id && !b.out) : null; }
function step(b, dx, dy) {
  const k = b.k;
  // leaving through a wall? only through a gate of its colour that the whole block fits
  const out = k.cells.some(([cx0, cy0]) => !inside(bd, k.x + cx0 + dx, k.y + cy0 + dy));
  if (out) {
    const side = dx < 0 ? 'L' : dx > 0 ? 'R' : dy < 0 ? 'T' : 'B', g = exitGate(bd, k, side);
    if (g) { leave(b, side, g); return 'out'; }
    return false;
  }
  if (!canMove(bd, k, dx, dy)) return false;
  stamp(bd, k, -1); k.x += dx; k.y += dy; stamp(bd, k, k.id);
  tone(330 + Math.random() * 40, 0.035, 'sine', 0.06, 1.2);
  return true;
}
function bump(b, dx, dy) {
  if (performance.now() - (b.bumpT || 0) < 160) return; b.bumpT = performance.now();
  b.nudge = [dx * 0.16, dy * 0.16]; tone(150, 0.07, 'triangle', 0.1, 0.7); buzz(6);
}
function leave(b, side, g) {
  stamp(bd, b.k, -1); b.out = { side, t: 0 }; drag = null;
  const now = performance.now(); combo = now - lastExit < 2600 ? combo + 1 : 1; lastExit = now;
  cleared++; const pts = 10 * combo; score += pts;
  const gm = gateMeshes.find(m => m.gate === g); if (gm) gm.pulse = 1;
  const col = COLS[b.k.color], [sx, sy] = SIDES[side];
  const p = new THREE.Vector3(cx(b.k.x) + sx * 0.6, 0.6, cz(b.k.y) + sy * 0.6);
  const c0 = b.k.cells.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]).map(v => v / b.k.cells.length);
  p.set(cx(b.k.x + c0[0]) + sx * 1.2, 0.6, cz(b.k.y + c0[1]) + sy * 1.2);
  burst(scene, p, [col, '#ffffff', col], 18, { speed: 0.09, up: 0.08, size: 0.6, gravity: 0.006 });
  [0, 4, 7].forEach((s, i) => setTimeout(() => note(67 + s + Math.min(cleared, 12), 0.25, 0.13), i * 60));
  buzz(18); ui.flash(0.18);
  ui.pop(combo > 1 ? `COMBO ×${combo}  +${pts}` : ['NICE!', 'SWOOSH!', 'OUT!', 'GREAT!'][cleared % 4], col, 30 + Math.min(combo, 5) * 3, 22);
  ui.progress(cleared / total); ui.sub(`${total - cleared} left`);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 1, 0), 50); }, 400); }
  if (cleared >= total) win();
}
function win() {
  if (state !== 'play') return;
  state = 'won'; const bonus = Math.ceil(timeLeft); score += bonus;
  if (!recorded) { recorded = true; F.level(true); B.submit(1, { ms: performance.now() - lvStart }); }
  best = Math.max(best, score); S.set('best', best);
  setTimeout(() => { sfx.win(); confetti(scene, new THREE.Vector3(0, 1.5, 0), 90); buzz([20, 30, 40]); }, 250);
  D.won(level, 'cleared level');
  ui.win(level, `+${bonus} time bonus · ${score} pts`);
  level++; S.set('level', level);
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; drag = null;
  if (!recorded) { recorded = true; F.level(false, cleared / total); B.submit(0); }
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.35);
  ui.lose("TIME'S UP!", `${cleared} / ${total} blocks out`);
}

// ---------------------------------------------------------------- input: drag (one cell at a time, toward the finger)
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BLOCK_H * 0.6), hit = new THREE.Vector3();
let drag = null;
function boardPt(e) {
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null; return [hit.x + (W - 1) / 2, hit.z + (H - 1) / 2];
}
addEventListener('pointerdown', e => {
  if (state !== 'play') return; const p = boardPt(e); if (!p) return;
  let b = blockAt(Math.round(p[0]), Math.round(p[1]));
  if (!b) { // forgiving: nearest block cell within 0.75
    let bestD = 0.75; for (const bb of blocks) if (!bb.out) for (const [dx, dy] of bb.k.cells) { const d = Math.hypot(bb.k.x + dx - p[0], bb.k.y + dy - p[1]); if (d < bestD) { bestD = d; b = bb; } }
  }
  if (!b) return;
  drag = { b, off: [b.k.x - p[0], b.k.y - p[1]] }; b.sq = 1; sfx.tap(); buzz(5);
});
addEventListener('pointermove', e => { if (!drag || state !== 'play') return; const p = boardPt(e); if (p) follow(drag.b, p[0] + drag.off[0], p[1] + drag.off[1]); });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointercancel', () => { drag = null; });
function follow(b, tx, ty) {
  for (let i = 0; i < 12 && !b.out; i++) {
    const ex = tx - b.k.x, ey = ty - b.k.y; const ax = Math.abs(ex) >= 0.55 ? Math.sign(ex) : 0, ay = Math.abs(ey) >= 0.55 ? Math.sign(ey) : 0;
    if (!ax && !ay) return;
    const order = Math.abs(ex) >= Math.abs(ey) ? [[ax, 0], [0, ay]] : [[0, ay], [ax, 0]];
    let moved = false;
    for (const [dx, dy] of order) { if (!dx && !dy) continue; const r = step(b, dx, dy); if (r) { moved = true; break; } }
    if (!moved) { const [dx, dy] = order[0][0] || order[0][1] ? order[0] : order[1]; bump(b, dx, dy); return; }
  }
}

ui.onTap(w => { if (w === 'win' || w === 'lose') build(); state = 'play'; lvStart = performance.now(); B.start(); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// one block that has a clear road slides cell by cell to its matching gate and out (never the last block)
let demoPlan = null;
demo(() => {
  if (!demoPlan) { for (const b of blocks) { if (b.out) continue; const p = pathOut(bd, b.k); if (p) { p.path.shift(); demoPlan = { b, path: p.path, side: p.side }; b.sq = 1; return; } } return false; }
  const nx = demoPlan.path.shift();
  if (nx) return step(demoPlan.b, nx[0] - demoPlan.b.k.x, nx[1] - demoPlan.b.k.y) ? true : false;
  const [sx, sy] = SIDES[demoPlan.side]; step(demoPlan.b, sx, sy); return false;
}, { ready: () => state === 'play' && level === 1 && !drag && (demoPlan || cleared + 2 <= total), wait: 1800, every: 380, max: 14 });

// ---------------------------------------------------------------- loop
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1);
loop((dt, t) => {
  const s = dt / 60;
  if (state === 'play') {
    timeLeft -= s; showTime();
    if (timeLeft <= 10 && !warned) { warned = true; ui.els.sc.classList.add('low'); ui.pop('HURRY!', '#ff4d6d', 34, 22); tone(880, 0.1, 'square', 0.06, 1); }
    if (timeLeft <= 0) { timeLeft = 0; showTime(); lose(); }
  }
  let si = 0;
  for (const b of blocks) {
    if (b.gone) continue;
    const k = b.k;
    if (b.out) {
      b.out.t += s; const [sx, sy] = SIDES[b.out.side], sp = 10 * b.out.t * b.out.t + 3 * b.out.t;
      b.vx += sx * sp * s * 4; b.vy += sy * sp * s * 4;
      const f = clamp(1 - (b.out.t - 0.25) * 3, 0, 1); b.grp.scale.setScalar(0.4 + 0.6 * f);
      b.grp.position.y = -0.2 * (1 - f);
      if (b.out.t > 0.6) { b.gone = true; b.grp.visible = false; }
    } else {
      b.vx = lerp(b.vx, k.x, Math.min(1, 0.42 * dt)); b.vy = lerp(b.vy, k.y, Math.min(1, 0.42 * dt));
      const held = drag && drag.b === b; b.lift = lerp(b.lift, held ? 1 : 0, 0.3 * dt);
      b.sq = Math.max(0, b.sq - 0.08 * dt); b.nudge[0] *= Math.pow(0.8, dt); b.nudge[1] *= Math.pow(0.8, dt);
      const sq = Math.sin(b.sq * Math.PI) * 0.12;
      b.grp.scale.set(1 + sq * 0.4 + b.lift * 0.03, 1 - sq + b.lift * 0.06, 1 + sq * 0.4 + b.lift * 0.03);
      b.grp.position.y = b.lift * 0.18;
      b.m.emissive.set(held ? '#ffffff' : COLS[k.color]); b.m.emissiveIntensity = held ? 0.14 : 0.12;
    }
    b.grp.position.x = cx(b.vx) + b.nudge[0]; b.grp.position.z = cz(b.vy) + b.nudge[1];
    if (!k.lock && !b.gone) for (const [dx, dy] of k.cells) {
      V.set(b.grp.position.x + dx * b.grp.scale.x, b.grp.position.y + (BLOCK_H + 0.04) * b.grp.scale.y, b.grp.position.z + dy * b.grp.scale.z);
      M4.compose(V, Q, SC.set(b.grp.scale.x, 1, b.grp.scale.z)); studsIM.setColorAt(si, b.studCol); studsIM.setMatrixAt(si++, M4);
    }
  }
  if (studsIM) { studsIM.count = si; studsIM.instanceMatrix.needsUpdate = true; if (studsIM.instanceColor) studsIM.instanceColor.needsUpdate = true; }
  // gates: glow the one matching the held block, pulse after an exit
  for (const g of gateMeshes) {
    g.pulse = Math.max(0, g.pulse - 0.04 * dt);
    const want = drag && drag.b.k.color === g.gate.color ? 0.45 + Math.sin(t * 8) * 0.15 : 0;
    g.glow.opacity = lerp(g.glow.opacity, Math.max(want, g.pulse * 0.9), 0.25);
    g.slab.scale.y = 1 + g.pulse * 0.8; g.slab.position.y = 0.11 + g.pulse * 0.08;
  }
});

build(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (this._plan && !this._plan.b.out) {
      const pl = this._plan, nx = pl.path.shift();
      if (nx) { const r = step(pl.b, nx[0] - pl.b.k.x, nx[1] - pl.b.k.y); if (!r) this._plan = null; return; }
      const [sx, sy] = SIDES[pl.side]; step(pl.b, sx, sy); this._plan = null; return;
    }
    this._plan = null;
    for (const b of blocks) { if (b.out) continue; const p = pathOut(bd, b.k); if (p) { p.path.shift(); this._plan = { b, path: p.path, side: p.side }; drag = null; b.sq = 1; return; } }
    // nothing can leave straight away: shuffle a random block one step
    const live = blocks.filter(b => !b.out); const b = live[Math.floor(Math.random() * live.length)];
    if (b) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5)) if (step(b, dx, dy)) return;
  },
};

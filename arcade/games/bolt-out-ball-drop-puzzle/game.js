// Bolt Out — original ball-drop physics puzzle. Balls rest on bolts inside a glass-tube vessel; pull the bolts in the right
// order so every coloured ball reaches the jar. Grey balls turn coloured when they touch colour, but a grey ball that reaches
// the jar still grey spoils it. Bombs blow the level if they touch colour or reach the jar; a bomb landing on grey balls just pops them.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, glossy, mat, palette, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Bolt Out: Ball Drop Puzzle';
const S = store('boltout');
let level = S.get('level', 1), score = S.get('score', 0);
const F = flow('boltout');
const stage = createStage({ fov: 40, shadowSize: 9 });
const { scene, camera, renderer, sun } = stage;
const ui = createUI({ title: 'BOLT<br>OUT', hint: 'Tap a bolt to pull it', hand: '👆' });
const D = daily('boltout', ui, { name: NAME });
const LB = board({ game: 'bolt-out', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum' });   // world board: levels cleared today (RULES.md)

// ---------------------------------------------------------------- constants
const R = 0.13, RB = 0.27, GRAV = -30, SUB = 6, Y_TOP = 6.0, Y_FLOOR = 0.7, NECK = 0.62, RIM = -3.0, CUP_B = -5.0, CUP_W = 1.3;
const COLS = ['#ff4d6d', '#ffb703', '#3a86ff', '#2ec4b6', '#9b5de5', '#fb5607', '#06d6a0'];
const GREY = '#b8bcc6';
const C = 1, G = 2, B = 4;   // compartment content bits

// ---------------------------------------------------------------- static scene: backdrop catching shadows, jar
const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.13 }));
back.position.z = -0.45; back.receiveShadow = true; scene.add(back);
sun.position.set(4, 10, 12);
const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
spot.scale.set(3.4, 0.7, 1); spot.position.set(0, CUP_B - 0.2, -0.44); scene.add(spot);

const jar = new THREE.Group(); scene.add(jar);
const glass = new THREE.Mesh(new THREE.CylinderGeometry(CUP_W + 0.06, CUP_W, RIM - CUP_B + 0.1, 40, 1, true),
  new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
glass.position.y = (RIM + CUP_B) / 2;
const jarBase = new THREE.Mesh(new THREE.CylinderGeometry(CUP_W, CUP_W * 0.96, 0.18, 40), glossy('#ffffff', { transparent: true, opacity: 0.7 }));
jarBase.position.y = CUP_B - 0.06; jarBase.receiveShadow = true;
const rimMat = glossy('#ff5d8f');
const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP_W + 0.06, 0.13, 14, 48), rimMat); rim.rotation.x = Math.PI / 2 - 0.25; rim.position.y = RIM + 0.05;
jar.add(glass, jarBase, rim);

// tubes: instanced cylinders + joint spheres (2 draw calls for the whole vessel)
const TUBE_R = 0.09, MAXT = 40;
const tubeMat = glossy('#ffffff', { roughness: 0.25 });
const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(TUBE_R, TUBE_R, 1, 14, 1, true), tubeMat, MAXT);
const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(TUBE_R, 14, 10), tubeMat, MAXT * 2);
tubes.castShadow = joints.castShadow = true; scene.add(tubes, joints);

const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(R, 18, 12), glossy('#ffffff', { roughness: 0.28 }), 80);
ballMesh.castShadow = true; ballMesh.frustumCulled = false; scene.add(ballMesh);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- DOM bits: jar % pill, hint hand
const pct = document.createElement('div'); pct.className = 'bo-pct'; pct.textContent = '0%'; document.body.appendChild(pct);
const hintEl = document.createElement('div'); hintEl.className = 'bo-hint hc-hidden'; hintEl.textContent = '👆'; document.body.appendChild(hintEl);
function toScreen(x, y) { const v = new THREE.Vector3(x, y, 0).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }

// ---------------------------------------------------------------- level generator (abstract puzzle, solved exhaustively)
function simulate(lanes, order) {               // returns 'win' | 'fail' | 'open' for an order of pin indices
  const pins = []; lanes.forEach((L, li) => L.forEach((m, k) => pins.push({ li, k, m })));
  const st = pins.map(p => p.m), on = pins.map(() => true);
  const idx = (li, k) => pins.findIndex(p => p.li === li && p.k === k);
  for (const pi of order) {
    if (!on[pi]) continue;
    let X = st[pi]; on[pi] = false; st[pi] = 0;
    const { li, k } = pins[pi]; let j = -1;
    for (let kk = k + 1; kk < lanes[li].length; kk++) { const q = idx(li, kk); if (on[q]) { j = q; break; } }
    if (j < 0) { if (X & (B | G)) return 'fail'; continue; }
    let U = X | st[j];
    if ((U & B) && (U & C) && X) return 'fail';
    if ((U & B) && (U & G) && X) U &= ~B;               // bomb pops on grey balls (greys may remain)
    if ((U & G) && (U & C)) U = (U & ~G) | C;
    st[j] = U;
  }
  return st.every((m, i) => !on[i] || !(m & (C | G))) ? 'win' : 'open';
}
function solve(lanes) {
  const n = lanes.reduce((a, L) => a + L.length, 0); let best = null, fails = 0, wins = 0;
  const rec = (seq) => {
    const r = simulate(lanes, seq);
    if (r === 'fail') { fails++; return; } if (r === 'win') { wins++; if (!best || seq.length < best.length) best = seq.slice(); return; }
    for (let p = 0; p < n; p++) if (!seq.includes(p)) rec([...seq, p]);
  };
  rec([]); return { sol: best, fails, wins };
}
function genLevel(lv, seed) {
  if (lv === 1) return { lanes: [[C]], sol: [0] };
  if (lv === 2) return { lanes: [[C, G]], sol: [0, 1] };
  if (lv === 3) return { lanes: [[B, C]], sol: [1] };
  if (lv === 4) return { lanes: [[G, B, C]], sol: [0, 1, 2] };
  const r = rng(seed), fk = F.k();
  const depth = clamp(Math.round((1.5 + lv * 0.2) * fk), 2, 4);
  const twoLanes = r() < clamp((lv - 4) * 0.12 * fk, 0, 0.6);
  for (let tries = 0; tries < 400; tries++) {
    const lanes = [];
    for (let l = 0; l < (twoLanes ? 2 : 1); l++) {
      const d = twoLanes ? Math.max(2, depth - 1 - (r() < 0.4 ? 1 : 0)) : depth, L = [];
      for (let k = 0; k < d; k++) { const x = r(); L.push(x < 0.4 ? C : x < 0.72 ? G : x < 0.97 ? B : 0); }
      lanes.push(L);
    }
    const flat = lanes.flat();
    if (!flat.includes(C) || flat.filter(m => m === B).length > 2 || flat.filter(m => m).length < 2) continue;
    if (lanes.some(L => !L.some(m => m))) continue;
    const s = solve(lanes);
    if (!s.sol || s.fails === 0 || s.sol.length < 2) continue;
    return { lanes, sol: s.sol };
  }
  return { lanes: [[G, C]], sol: [0, 1] };
}

// ---------------------------------------------------------------- level build
let LV = null, vTop = 6, camZ = 21, camY = 0.2; let state = 'ready', balls = [], segs = [], pins = [], bombs = [], sol = [], recorded = false, inCup = 0, goodTotal = 0;
let pal, shake = 0, settleT = 0, winT = 0, convQ = [], tickT = 0, convT = 0, beatenShown = false, sessionLv = 0, firstPull = true, lastPct = -1, jarBounce = 0;
const pinMat = () => glossy(pal.a, { metalness: 0.35, roughness: 0.3 });

function addSeg(ax, ay, bx, by, r = TUBE_R) { const s = { ax, ay, bx, by, r, on: true }; segs.push(s); return s; }
function hexNut() {
  const s = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; i ? s.lineTo(Math.cos(a) * 0.26, Math.sin(a) * 0.26) : s.moveTo(Math.cos(a) * 0.26, Math.sin(a) * 0.26); }
  const h = new THREE.Path(); h.absarc(0, 0, 0.1, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); g.translate(0, 0, -0.06); return g;
}
const NUT = hexNut();
function clearLevel() {
  for (const p of pins) scene.remove(p.g);
  for (const b of bombs) scene.remove(b.g);
  pins = []; bombs = []; balls = []; segs = []; convQ = [];
}
function build() {
  clearLevel();
  pal = palette(level); applyPalette(pal); rimMat.color.set(pal.a);
  const seed = D.seed ? D.seed + sessionLv : level * 7919 + 13;
  const genLv = D.seed ? 6 + sessionLv : level;
  const lv = genLevel(genLv, seed); sol = lv.sol.slice(); LV = lv;
  const r = rng(seed * 3 + 1);
  const two = lv.lanes.length === 2, W = two ? 2.5 : 1.6, maxD = Math.max(...lv.lanes.map(L => L.length));
  vTop = Math.min(6, Y_FLOOR + maxD * 1.35 + 0.9);
  // vessel walls
  const tubeSegs = [];
  const wall = (pts) => { for (let i = 0; i < pts.length - 1; i++) tubeSegs.push(addSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); };
  wall([[-W, vTop], [-W, 0.3], [-NECK, -2.0], [-NECK, -2.7]]);
  wall([[W, vTop], [W, 0.3], [NECK, -2.0], [NECK, -2.7]]);
  if (two) wall([[0, vTop], [0, Y_FLOOR]]);
  addSeg(-CUP_W, RIM, -CUP_W, CUP_B + 0.02, 0.06); addSeg(CUP_W, RIM, CUP_W, CUP_B + 0.02, 0.06); addSeg(-CUP_W, CUP_B + 0.02, CUP_W, CUP_B + 0.02, 0.06);
  let ti = 0, ji = 0;
  for (const s of tubeSegs) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy);
    _q.setFromUnitVectors(_up, _p.set(dx / L, dy / L, 0)); _m.compose(_s.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, 0), _q, new THREE.Vector3(1, L, 1)); tubes.setMatrixAt(ti++, _m);
    for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) { _m.makeTranslation(x, y, 0); joints.setMatrixAt(ji++, _m); }
  }
  tubes.count = ti; joints.count = ji; tubes.instanceMatrix.needsUpdate = joints.instanceMatrix.needsUpdate = true;
  // pins + contents
  const flip = r() < 0.5 ? 1 : -1, goodComps = lv.lanes.flat().filter(m => m === C || m === G).length;
  lv.lanes.forEach((L, li) => {
    const x0 = two ? (li === 0 ? -W : 0) : -W, x1 = two ? (li === 0 ? 0 : W) : W, d = L.length, h = (vTop - 0.5 - Y_FLOOR) / d;
    L.forEach((m, k) => {
      const y = Y_FLOOR + (d - 1 - k) * h;
      const side = two ? (li === 0 ? -1 : 1) : ((k % 2 ? 1 : -1) * flip);
      const inner = side < 0 ? x1 : x0, outer = side < 0 ? x0 : x1, hx = outer + side * 0.62;
      const seg = addSeg(x0, y, x1, y, 0.07);
      const g = new THREE.Group(), pm = pinMat();
      const len = Math.abs(hx - inner) + 0.1;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, len, 14), pm); rod.rotation.z = Math.PI / 2; rod.position.x = (inner + hx) / 2 - side * 0.05; rod.castShadow = true;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), pm); tip.position.x = inner - side * 0.1;
      const nut = new THREE.Mesh(NUT, pm); nut.position.x = hx + side * 0.2; nut.castShadow = true;
      g.add(rod, tip, nut); g.position.y = y; scene.add(g);
      pins.push({ g, seg, side, y, inner, hx: hx + side * 0.2, out: 0, pulled: false, li, k, wig: 0 });
      // contents resting on this pin
      const xl = x0 + TUBE_R + R + 0.04, xr = x1 - TUBE_R - R - 0.04;
      if (m === B) {
        const bx = lerp(xl + 0.2, xr - 0.2, 0.3 + r() * 0.4); addBomb(bx, y + 0.07 + RB + 0.01);
      } else if (m === C || m === G) {
        const per = Math.floor((xr - xl) / (2 * R + 0.02)) + 1, rows = clamp(Math.floor(66 / (per * goodComps)), 1, 3);
        for (let row = 0; row < rows; row++) for (let i = 0; i < per - (row % 2); i++) {
          const x = xl + i * (2 * R + 0.02) + (row % 2) * (R + 0.01), yy = y + 0.07 + R + 0.01 + row * (2 * R * 0.88);
          addBall(x, yy, m === C ? 'c' : 'g', m === C ? COLS[Math.floor(r() * COLS.length)] : GREY);
        }
      }
    });
  });
  goodTotal = balls.filter(b => b.t !== 'b').length; inCup = 0; recorded = false; winT = 0; settleT = 0; beatenShown = false; firstPull = level <= 2;
  for (let i = 0; i < 30; i++) step(1 / 60, true);           // let piles settle before the player sees them
  // fit the camera: whole vessel + jar + % pill, with headroom for the level bar and score
  const tanH = Math.tan(camera.fov * Math.PI / 360), top = vTop + 0.4, bot = CUP_B - 1.3;
  const zH = (top - bot + 3.2) / (2 * tanH), zW = (two ? 7.9 : 5.6) / (2 * tanH * camera.aspect);
  camZ = Math.max(zH, zW, 14); camY = (top + bot) / 2 + 1.25 * camZ / 21;
  ui.levels(level); ui.progress(0); ui.score(score); setPct(0, true);
}
function addBall(x, y, t, col) { const b = { x, y, vx: 0, vy: 0, r: R, t, col: new THREE.Color(col), alive: true, cup: false, i: balls.length, sc: 1 }; balls.push(b); return b; }
function addBomb(x, y) {
  const b = addBall(x, y, 'b', '#222'); b.r = RB;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(RB, 24, 16), glossy('#2b2d42', { roughness: 0.25 })); body.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 12), mat('#8d99ae')); cap.position.set(0.1, RB * 0.92, 0); cap.rotation.z = -0.4;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), mat('#a47148')); fuse.position.set(0.16, RB + 0.1, 0); fuse.rotation.z = -0.6;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd60a' })); spark.position.set(0.22, RB + 0.2, 0);
  const face = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff' })); face.position.set(0, -0.05, RB * 0.97); face.rotation.z = Math.PI;
  g.add(body, cap, fuse, spark, face); scene.add(g); b.g = g; b.spark = spark; bombs.push(b);
}

// ---------------------------------------------------------------- physics
function colSeg(b, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
  let t = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  let nx = b.x - (s.ax + dx * t), ny = b.y - (s.ay + dy * t); const d2 = nx * nx + ny * ny, rr = b.r + s.r;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d; b.x += nx * (rr - d); b.y += ny * (rr - d);
}
// position-based dynamics: integrate, push overlaps apart, derive velocity from the corrected positions (stable piles)
function step(dt, quiet = false) {
  const h = dt / SUB;
  for (let s = 0; s < SUB; s++) {
    for (const b of balls) {
      if (!b.alive) continue; b.px = b.x; b.py = b.y; b.vy += GRAV * h;
      const v = Math.hypot(b.vx, b.vy); if (v > 14) { b.vx *= 14 / v; b.vy *= 14 / v; }
      b.x += b.vx * h; b.y += b.vy * h;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (!a.alive) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (!b.alive) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r; if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
          const d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, pen = rr - d, ma = a.r * a.r, mb = b.r * b.r, wa = mb / (ma + mb), wb = ma / (ma + mb);
          a.x -= nx * pen * wa; a.y -= ny * pen * wa; b.x += nx * pen * wb; b.y += ny * pen * wb;
          if (it === 0 && !quiet && state === 'play') contact(a, b);
        }
      }
      for (const b of balls) {
        if (!b.alive) continue; for (const sg of segs) if (sg.on) colSeg(b, sg);
        if (b.y < RIM + 0.1 && b.y > CUP_B - 1.5 && Math.abs(b.x) < CUP_W + 0.4) {   // the jar is a hard box: piles can't squeeze through it
          const lim = CUP_W - 0.06 - b.r; if (b.x > lim) b.x = lim; else if (b.x < -lim) b.x = -lim;
          if (b.y < CUP_B + 0.08 + b.r) b.y = CUP_B + 0.08 + b.r;
        }
      }
    }
    for (const b of balls) { if (!b.alive) continue; b.vx = (b.x - b.px) / h * 0.998; b.vy = (b.y - b.py) / h * 0.998; }
  }
}
function contact(a, b) {
  if (a.t === 'b' || b.t === 'b') {
    const bomb = a.t === 'b' ? a : b, o = a === bomb ? b : a;
    if (o.t === 'c') explode(bomb, true); else if (o.t === 'g') explode(bomb, false);
    return;
  }
  if (a.t !== b.t) { const g = a.t === 'g' ? a : b, c = a === g ? b : a; if (!g.q) { g.q = 1; convQ.push({ g, col: c.col, t: 0.05 }); } }
}
function explode(bomb, bad) {
  if (!bomb.alive) return; bomb.alive = false; scene.remove(bomb.g);
  const P = new THREE.Vector3(bomb.x, bomb.y, 0.2);
  burst(scene, P, ['#ffd60a', '#fb5607', '#2b2d42', '#ffffff'], 30, { speed: 0.16, up: 0.08, size: 1.1, gravity: 0.004 });
  sfx.smash(); buzz([40, 30, 60]); ui.flash(0.55); shake = 0.45;
  for (const o of balls) {
    if (!o.alive || o === bomb) continue; const dx = o.x - bomb.x, dy = o.y - bomb.y, d = Math.hypot(dx, dy);
    if (d < 0.72 && o.t === 'g') { o.alive = false; burst(scene, new THREE.Vector3(o.x, o.y, 0), [GREY, '#ffffff'], 3, { speed: 0.08, up: 0.05, size: 0.6 }); }
    else if (d < 1.6) { o.vx += dx / (d + 0.1) * 4; o.vy += dy / (d + 0.1) * 4 + 2; }
  }
  if (bad) lose('BOOM!', 'A bomb touched colour'); else ui.pop('POP!', '#fff', 34, 30);
}

// ---------------------------------------------------------------- game flow
function setPct(p, quiet) {
  const v = Math.round(p * 100); if (v === lastPct) return; lastPct = v; pct.textContent = v + '%';
  if (!quiet) { pct.style.transform = 'translate(-50%,-50%) scale(1.18)'; setTimeout(() => pct.style.transform = 'translate(-50%,-50%)', 110); }
}
function pull(p) {
  if (state !== 'play' || p.pulled) return;
  p.pulled = true; p.seg.on = false; p.out = 0.001; firstPull = false; hintEl.classList.add('hc-hidden');
  tone(300, 0.12, 'triangle', 0.14, 2.2); setTimeout(() => tone(900, 0.05, 'sine', 0.08, 1.4), 70); buzz(14);
  burst(scene, new THREE.Vector3(p.hx, p.y, 0.3), ['#ffffff', pal.a], 8, { speed: 0.07, up: 0.03, size: 0.5, gravity: 0.002 });
  // a kick so piles start moving at once
  for (const b of balls) if (b.alive && Math.abs(b.y - p.y) < 0.5) b.vy -= 0.5;
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the hinted bolt pulls itself if more bolts remain after it; if it is the only move, it slides half out and back in (nothing drops)
demo(() => {
  const p = pins[sol[0]]; if (!p || p.pulled) return false;
  if (sol.length >= 2) { pull(p); settleT = 0; return; }
  const t0 = performance.now(), x0 = p.g.position.x; tone(300, 0.08, 'triangle', 0.1, 1.6);
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / 900); if (p.pulled || state !== 'play') return; p.g.position.x = x0 + p.side * Math.sin(k * Math.PI) * 0.9; if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}, { ready: () => state === 'play' && level === 1 && !D.seed && settleT > 0.35 && !convQ.length && !pins.some(q => q.pulled), wait: 1800, max: 1 });
function lose(t, line) {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, goodTotal ? inCup / goodTotal : 0); }
  sfx.fail(); buzz([30, 40, 80]); shake = Math.max(shake, 0.3);
  ui.lose(t, line);
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); LB.submit(1); }
  sfx.win(); buzz([20, 30, 20]); ui.flash(0.4); jarBounce = 1;
  confetti(scene, new THREE.Vector3(0, RIM + 0.6, 0.5), 80);
  ui.pop(['SWEET!', 'PERFECT!', 'NICE!', 'GENIUS!'][level % 4], '#fff', 42, 28);
  const lv = level; level++; sessionLv++; S.set('level', level); S.set('score', score);
  D.won(score); ui.win(lv, `${score} balls jarred`);
}
function onCup(b) {
  b.cup = true;
  if (b.t === 'g') { b.col.set('#7d8597'); lose('GREY BALL!', 'Grey reached the jar before it touched colour'); return; }
  if (b.t === 'b') { explode(b, true); return; }
  inCup++; score++; ui.score(score); ui.progress(inCup / goodTotal); setPct(inCup / goodTotal);
  b.sc = 1.5; jarBounce = Math.max(jarBounce, 0.35);
  const now = performance.now(); if (now - tickT > 45) { tickT = now; note(72 + Math.min(18, Math.floor(inCup / goodTotal * 18)), 0.12, 0.08); }
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, new THREE.Vector3(0, 2, 0.5), 50); }
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
function pinAt(cx, cy) {
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  let best = null, bd = 0.55;
  for (const p of pins) {
    if (p.pulled) continue;
    const a = Math.min(p.inner, p.hx), b = Math.max(p.inner, p.hx), x = clamp(hit.x, a, b);
    const d = Math.hypot(hit.x - x, hit.y - p.y) - (Math.abs(hit.x - p.hx) < 0.35 ? 0.2 : 0);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
input({ onDown: (e) => { if (state !== 'play') return; const p = pinAt(e.clientX, e.clientY); if (p) pull(p); else tone(200, 0.04, 'sine', 0.05, 0.9); } });
ui.onTap((w) => { LB.start();
  if (w === 'win') build();
  else if (w === 'lose') build();
  state = 'play'; ui.hideStart();
});

// ---------------------------------------------------------------- loop
let clock = 0;
loop((dt, t) => {
  clock += dt / 60;
  if (state === 'play' || state === 'won' || state === 'lost') step(Math.min(dt, 2) / 60);
  // grey -> colour conversion wave
  for (let i = convQ.length - 1; i >= 0; i--) {
    const q = convQ[i]; q.t -= dt / 60; if (q.t > 0) continue; convQ.splice(i, 1);
    if (!q.g.alive || q.g.t !== 'g' || state !== 'play') continue;
    q.g.t = 'c'; q.g.col.copy(q.col); q.g.sc = 1.6;
    const now = performance.now(); if (now - convT > 60) { convT = now; tone(700 + Math.random() * 300, 0.05, 'sine', 0.06, 1.3); burst(scene, new THREE.Vector3(q.g.x, q.g.y, 0.2), '#' + q.col.getHexString(), 3, { speed: 0.05, up: 0.03, size: 0.45 }); }
  }
  // jar entries, strays
  const sp = [];
  for (const b of balls) {
    if (!b.alive) continue;
    sp.push(Math.hypot(b.vx, b.vy));
    if (!b.cup && b.y < RIM - 0.05 && Math.abs(b.x) < CUP_W && state === 'play') onCup(b);
    if (b.y < -9) b.alive = false;
  }
  if (state === 'play') {
    sp.sort((a, b) => a - b); const maxV = sp.length ? sp[Math.floor(sp.length * 0.92)] : 0;
    settleT = maxV < 0.6 ? settleT + dt / 60 : 0;
    const good = balls.filter(b => b.alive && b.t !== 'b');
    if (good.length && good.every(b => b.cup) && convQ.length === 0) { winT += dt / 60; if (winT > 0.35) win(); } else winT = 0;
  }
  // pins slide out
  for (const p of pins) {
    if (p.out > 0) { p.out += dt * 0.012 + p.out * 0.12 * dt; p.g.position.x = p.side * p.out * 6; if (p.out > 1.4) p.g.visible = false; }
  }
  // render balls
  let k = 0;
  for (const b of balls) {
    if (b.t === 'b') {
      if (b.g) { b.g.position.set(b.x, b.y, 0); b.g.rotation.z = -b.x / RB * 0.5; b.spark.scale.setScalar(0.8 + Math.sin(t * 30) * 0.3); }
      continue;
    }
    b.sc = lerp(b.sc, 1, 0.15 * dt);
    _m.compose(_p.set(b.x, b.y, 0), _q.identity(), _s.setScalar(b.alive ? b.sc : 0)); ballMesh.setMatrixAt(k, _m); ballMesh.setColorAt(k, b.col); k++;
  }
  ballMesh.count = k; ballMesh.instanceMatrix.needsUpdate = true; if (ballMesh.instanceColor) ballMesh.instanceColor.needsUpdate = true;
  // jar bounce + % pill position
  jarBounce = Math.max(0, jarBounce - dt * 0.04);
  jar.scale.set(1 + jarBounce * 0.08, 1 - jarBounce * 0.06, 1 + jarBounce * 0.08);
  const [px, py] = toScreen(0, CUP_B - 0.75); pct.style.left = px + 'px'; pct.style.top = py + 'px';
  if (firstPull && state === 'play' && pins.length) {
    const p = pins.find(q => !q.pulled && sol[0] === pins.indexOf(q)) || pins[0]; const [hx, hy] = toScreen(p.hx, p.y - 0.15);
    hintEl.style.left = hx + 'px'; hintEl.style.top = hy + 'px'; hintEl.classList.remove('hc-hidden');
  } else hintEl.classList.add('hc-hidden');
  // camera
  shake = Math.max(0, shake - dt * 0.012);
  camera.position.set((Math.random() - 0.5) * shake, camY + (Math.random() - 0.5) * shake, camZ);
  camera.lookAt(0, camY, 0);
});

build(); ui.start(); applyPalette(pal);

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get dbg() { return { handles: pins.map(p => toScreen(p.hx, p.y)), info: LV,  fast: balls.filter(b=>b.alive&&Math.hypot(b.vx,b.vy)>0.4).map(b=>[b.x.toFixed(2),b.y.toFixed(2),b.vx.toFixed(2),b.vy.toFixed(2)]).slice(0,8), settleT, conv: convQ.length, mv: Math.max(...balls.filter(b=>b.alive).map(b=>Math.hypot(b.vx,b.vy))), pins: pins.map(p=>p.pulled), sol }; },
  bot() {   // waits for the balls to settle, then pulls the next bolt of the solved order
    if (state !== 'play' || settleT < 0.35 || convQ.length) return;
    const pi = sol.find(i => !pins[i].pulled);
    if (pi !== undefined) { pull(pins[pi]); settleT = 0; }
  },
};

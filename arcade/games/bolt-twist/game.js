// Bolt Twist — original game. Tap coloured bolts to spin them out of a 3D toy; they fly into boxes of the same colour
// (3 per box) or into a 5-slot tray. Plates with no bolts left fall off. Clear every bolt to win; a full tray loses.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, glossy, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
const B = board({ game: 'bolt-twist', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d, r);   // rounded() grows by its bevel; this keeps exact outer size

const COLORS = { red: '#ff4d5e', blue: '#3a8dff', yellow: '#ffc61a', green: '#35c96a', purple: '#9b62ff', orange: '#ff8a2a', pink: '#ff6fc3', cyan: '#22cfd6' };
const CKEYS = Object.keys(COLORS);
const BGS = [['#a9d8ff', '#eaf7ff'], ['#ffd0e4', '#fff1f7'], ['#bff0d4', '#effff5'], ['#dcd0ff', '#f6f1ff'], ['#ffe0b0', '#fff7ea']];
const TRAY = 5, PLATE_T = 0.17;

const stage = createStage({ fov: 38, shadowSize: 5 });
const { scene, camera, renderer, sun } = stage;
scene.add(camera);
sun.position.set(4, 12, 9);
const save = store('bolttwist');
const FL = flow('bolttwist');   // (F is the face table inside design)
let level = save.get('level', 1), total = save.get('bolts', 0), state = 'ready';
const ui = createUI({ title: 'BOLT<br>TWIST', hint: 'Tap the bolts!', hand: '👆', score: false });

// ---------------------------------------------------------------- goal + danger readouts (bolts left, tray fill)
const css = document.createElement('style');
css.textContent = `.bt-left{position:fixed;left:50%;bottom:calc(9vh + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:5;pointer-events:none;
  font-weight:800;font-size:30px;line-height:1;padding:8px 20px;border-radius:30px;background:rgba(30,60,120,.32);text-shadow:0 2px 0 rgba(0,0,0,.18);white-space:nowrap;transition:transform .12s}
.bt-left.bump{transform:translateX(-50%) scale(1.18)}
.bt-left small{font-size:18px;opacity:.85;margin-left:4px}
.bt-tray{position:fixed;left:50%;transform:translateX(-50%);z-index:5;pointer-events:none;font-weight:800;font-size:16px;padding:2px 12px;border-radius:14px;background:rgba(30,60,120,.32);white-space:nowrap}
.bt-tray.warn{background:#ff9f1a}.bt-tray.danger{background:#ff4d5e;animation:btpulse .5s ease-in-out infinite}
@keyframes btpulse{50%{transform:translateX(-50%) scale(1.12)}}`;
document.head.appendChild(css);
const leftEl = Object.assign(document.createElement('div'), { className: 'bt-left hc-hidden' }), trayEl = Object.assign(document.createElement('div'), { className: 'bt-tray hc-hidden' });
document.body.append(leftEl, trayEl);
function hudText() {
  const n = screws.filter((s) => !s.gone).length, used = buffer.filter(Boolean).length;
  leftEl.innerHTML = n ? `🔩 ${n}<small>left</small>` : '🔩 0'; leftEl.classList.toggle('hc-hidden', state !== 'play' || !screws.length);
  trayEl.textContent = `TRAY ${used}/${TRAY}`; trayEl.className = 'bt-tray' + (used >= TRAY - 1 ? ' danger' : used >= TRAY - 2 ? ' warn' : '') + (state === 'play' && used ? '' : ' hc-hidden');
  trayEl.style.top = `${(0.262 + 0.045) * 100}%`;
  if (tray.bar) tray.bar.material.color.set(used >= TRAY - 1 ? '#ff7a85' : used >= TRAY - 2 ? '#ffd27a' : '#ffffff');
}

// ---------------------------------------------------------------- shared geometry / materials
const HEAD = new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.215, 0.022], [0.207, 0.06], [0.16, 0.105], [0.08, 0.13], [0, 0.136]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
const CROSS = (() => {
  const w = 0.024, L = 0.105, s = new THREE.Shape();
  [[-w, L], [w, L], [w, w], [L, w], [L, -w], [w, -w], [w, -L], [-w, -L], [-w, -w], [-L, -w], [-L, w], [-w, w]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, 0.108, 0); return g;
})();
const SHAFT = (() => { const g = new THREE.CylinderGeometry(0.06, 0.035, 0.62, 12); g.translate(0, -0.31, 0); return g; })();
const THREAD = (() => { const g = new THREE.TorusGeometry(0.058, 0.014, 4, 14); g.rotateX(Math.PI / 2); return g; })();
const SHAFT_THREADED = (() => {   // shaft + 5 thread rings merged into one geometry (one draw call per flying bolt)
  const parts = [SHAFT.toNonIndexed()]; for (let i = 0; i < 5; i++) { const t = THREAD.toNonIndexed(); t.translate(0, -0.1 - i * 0.1, 0); parts.push(t); }
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g;
})();
const crossMat = mat('#262a3a', { roughness: 0.6 }), metal = new THREE.MeshStandardMaterial({ color: '#c9d1dc', roughness: 0.3, metalness: 0.75 });
const headMats = {}; for (const k of CKEYS) headMats[k] = glossy(COLORS[k], { roughness: 0.25 });
const HOLE = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16);
const holeMat = mat('#2c2f45', { roughness: 0.9 });

// ---------------------------------------------------------------- HUD in camera space (boxes + tray)
const hud = new THREE.Group(); camera.add(hud);
let HW = 1, HH = 1, SLOT = 0.5; const HZ = -6;
function layoutHud() {
  HH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * -HZ; HW = HH * camera.aspect;
  SLOT = Math.min(0.62, (HW * 2 * 0.94) / 4);
  for (const b of boxes) if (b.group) b.group.position.copy(boxPos(b.i));
  tray.position.set(0, HH * (1 - 2 * 0.262), HZ); tray.scale.setScalar(SLOT * 0.92);
}
const fy = (f) => HH * (1 - 2 * f);
function boxPos(i) { return new THREE.Vector3((i - (K - 1) / 2) * SLOT, fy(0.152), HZ); }

// tray: dark bar with 5 sockets
const tray = new THREE.Group(); hud.add(tray);
{
  const bar = new THREE.Mesh(rbox(TRAY * 0.62 + 0.2, 0.62, 0.22, 0.11), mat('#ffffff', { roughness: 0.6, transparent: true, opacity: 0.55 }));
  tray.add(bar); tray.bar = bar;
  for (let i = 0; i < TRAY; i++) { const h = new THREE.Mesh(HOLE, mat('#9fb3c8', { roughness: 0.8 })); h.rotation.x = Math.PI / 2; h.scale.set(1.5, 1, 1.5); h.position.set((i - (TRAY - 1) / 2) * 0.62, 0, 0.1); tray.add(h); }
}
const traySlot = (i) => new THREE.Vector3((i - (TRAY - 1) / 2) * 0.62, 0, 0.16);

// boxes
const BOX_GEO = rbox(1, 0.66, 0.5, 0.12), INSET = rbox(0.84, 0.36, 0.06, 0.06), LID = rbox(1.04, 0.16, 0.54, 0.07);
const boxMats = {}; for (const k of CKEYS) boxMats[k] = mat(COLORS[k], { roughness: 0.45 });
const insetMat = mat('#fdfcf8', { roughness: 0.6 });
const holeX = (j) => (j - 1) * 0.27;
function makeBox(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(BOX_GEO, boxMats[color]); g.add(body);
  const inset = new THREE.Mesh(INSET, insetMat); inset.position.set(0, -0.02, 0.25); g.add(inset);
  for (let j = 0; j < 3; j++) { const h = new THREE.Mesh(HOLE, holeMat); h.rotation.x = Math.PI / 2; h.position.set(holeX(j), -0.02, 0.28); g.add(h); }
  const lid = new THREE.Mesh(LID, boxMats[color]); lid.position.set(0, 1.2, 0); lid.visible = false; g.add(lid); g.lid = lid;
  return g;
}

// ---------------------------------------------------------------- level state
let K = 2, toy, core, plates = [], screws = [], faces = {}, boxes = [], queue = [], qi = 0, buffer = [], flights = [], fallers = [], headIM, crossIM;
let rotY = -0.45, rotV = 0, tilt = 0.12, botFace = null, cleared = 0, wonAt = 0;

const FACE_DEF = (W, H, D) => ({
  front: { c: [0, 0, D / 2], n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], fw: W, fh: H },
  right: { c: [W / 2, 0, 0], n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], fw: D, fh: H },
  back: { c: [0, 0, -D / 2], n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], fw: W, fh: H },
  left: { c: [-W / 2, 0, 0], n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], fw: D, fh: H },
  top: { c: [0, H / 2, 0], n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], fw: W, fh: D },
});

// plate shapes in their own local 2D frame
function contains(p, x, y, m = 0) {
  const dx = x - p.cx, dy = y - p.cy, c = Math.cos(-p.rot), s = Math.sin(-p.rot), lx = dx * c - dy * s, ly = dx * s + dy * c;
  if (p.type === 'circle') return Math.hypot(lx, ly) <= p.r + m;
  if (p.type === 'capsule') { const r = p.h / 2, ex = Math.max(0, Math.abs(lx) - (p.w / 2 - r)); return Math.hypot(ex, ly) <= r + m; }
  return Math.abs(lx) <= p.w / 2 + m && Math.abs(ly) <= p.h / 2 + m;
}
function corners(p) {
  if (p.type === 'circle') return [[p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy + p.r], [p.cx - p.r, p.cy + p.r], [p.cx + p.r, p.cy - p.r]];
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const lx = a * p.w / 2, ly = b * p.h / 2; return [p.cx + lx * c - ly * s, p.cy + lx * s + ly * c]; });
}
const toFace = (p, lx, ly) => { const c = Math.cos(p.rot), s = Math.sin(p.rot); return [p.cx + lx * c - ly * s, p.cy + lx * s + ly * c]; };
function overlaps(a, b) {
  const R = a.type === 'circle' ? a.r : Math.max(a.w, a.h) / 2;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
    const x = a.cx - R + (2 * R * i) / 6, y = a.cy - R + (2 * R * j) / 6;
    if (contains(a, x, y, -0.04) && contains(b, x, y, -0.04)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- procedural level design
function design(n, fk = 1) {
  const R = rng(n * 7919 + 101);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1)), rf = (a, b) => a + R() * (b - a);
  const themes = ['crate', 'house', 'robot', 'gift', 'crate'];
  const theme = n <= 2 ? 'crate' : themes[n % themes.length];
  const W = n === 1 ? 2.9 : 2.6, H = theme === 'crate' ? 2.6 : 2.4, D = 2.6;
  const faceNames = n <= 2 ? ['front'] : n === 3 ? ['front', 'right'] : n === 4 ? ['front', 'right', 'left'] : (theme === 'crate' && n >= 6 ? ['front', 'right', 'back', 'left', 'top'] : ['front', 'right', 'back', 'left']);
  const F = FACE_DEF(W, H, D);
  const P = [];   // plates {face, type, w,h,r, cx,cy,rot, screws:[[fx,fy]], lv (stack level)}
  for (const fn of faceNames) {
    const f = F[fn], pts = [], list = [];
    const inFace = (x, y, m) => Math.abs(x) <= f.fw / 2 - m && Math.abs(y) <= f.fh / 2 - m;
    const ok = (p) => corners(p).every(([x, y]) => inFace(x, y, 0.04)) && p.screws.every(([x, y]) => inFace(x, y, 0.2) && pts.every(([a, b]) => Math.hypot(a - x, b - y) > 0.47) && contains(p, x, y, -0.14))
      && p.screws.every(([x, y], i) => p.screws.every(([a, b], j) => i === j || Math.hypot(a - x, b - y) > 0.45));
    const add = (p) => { p.face = fn; p.lv = 0; for (const q of list) if (overlaps(p, q) || overlaps(q, p)) p.lv = Math.max(p.lv, q.lv + 1); list.push(p); pts.push(...p.screws); P.push(p); };
    // base layer
    if (R() < 0.45 || n === 1) {
      const p = { type: 'rect', w: f.fw - 0.32, h: f.fh - 0.32, r: 0.16, cx: 0, cy: 0, rot: 0 };
      const ix = p.w / 2 - 0.3, iy = p.h / 2 - 0.3; p.screws = [[-ix, iy], [ix, iy], [ix, -iy], [-ix, -iy]]; add(p);
    } else {
      const w = (f.fw - 0.42) / 2;
      for (const sx of [-1, 1]) { const p = { type: 'rect', w, h: f.fh - 0.32, r: 0.14, cx: sx * (w / 2 + 0.05), cy: 0, rot: 0 }; const iy = p.h / 2 - 0.3, ix = w / 2 - 0.28;
        p.screws = (R() < 0.5 ? [[p.cx - ix, iy], [p.cx + ix, -iy]] : [[p.cx + ix, iy], [p.cx - ix, -iy]]); if (R() < 0.35) p.screws.push([p.cx, 0]); add(p); }
    }
    const nUp = n === 1 ? 1 : n < 4 ? ri(1, 2) : ri(2, 3);
    for (let k = 0, tries = 0; k < nUp && tries < 80; tries++) {
      const kind = n === 1 ? 'capsule' : ['capsule', 'capsule', 'rect', 'circle'][ri(0, 3)];
      let p;
      if (kind === 'capsule') {
        const L = rf(1.5, Math.min(2.7, Math.hypot(f.fw, f.fh) * 0.82)), rot = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][ri(0, 3)] + rf(-0.12, 0.12);
        p = { type: 'capsule', w: L, h: 0.5, cx: rf(-0.5, 0.5), cy: rf(-0.5, 0.5), rot }; const e = L / 2 - 0.25;
        p.screws = [toFace(p, -e, 0), toFace(p, e, 0)]; if (L > 2.2 && R() < 0.4) p.screws.push(toFace(p, 0, 0));
      } else if (kind === 'rect') {
        p = { type: 'rect', w: rf(0.95, 1.5), h: rf(0.85, 1.25), r: 0.14, cx: rf(-0.6, 0.6), cy: rf(-0.6, 0.6), rot: rf(-0.35, 0.35) };
        const ix = p.w / 2 - 0.26, iy = p.h / 2 - 0.26; p.screws = R() < 0.5 ? [toFace(p, -ix, iy), toFace(p, ix, -iy)] : [toFace(p, -ix, -iy), toFace(p, ix, iy), toFace(p, ix, -iy)];
      } else {
        p = { type: 'circle', r: rf(0.42, 0.62), cx: rf(-0.6, 0.6), cy: rf(-0.6, 0.6), rot: rf(0, 3) };
        p.screws = p.r > 0.55 && R() < 0.6 ? [toFace(p, -(p.r - 0.24), 0), toFace(p, p.r - 0.24, 0)] : [[p.cx, p.cy]];
      }
      if (ok(p)) { add(p); k++; }
    }
  }
  // bolt budget: short early levels, a steady curve after (players were leaving mid-level on 30-42 bolt toys)
  const cap = boltCap(n);
  let N = P.reduce((a, p) => a + p.screws.length, 0);
  while (N > cap) {   // drop a plate nothing sits on, from the back faces first, so the front stays the readable one
    const free = P.filter((p) => !P.some((q) => q !== p && q.face === p.face && q.lv > p.lv && (overlaps(p, q) || overlaps(q, p))));
    const order = ['top', 'back', 'left', 'right', 'front'];
    free.sort((a, b) => order.indexOf(a.face) - order.indexOf(b.face) || b.lv - a.lv);
    const p = free[0]; if (!p || P.length <= 1) break;
    if (N - p.screws.length >= cap - 2 || p.screws.length <= 1) { P.splice(P.indexOf(p), 1); N -= p.screws.length; }
    else { p.screws.length = Math.max(1, p.screws.length - (N - cap)); N = P.reduce((a, q) => a + q.screws.length, 0); }
  }
  // total bolts must be a multiple of 3
  while (N % 3) { const p = P.filter((q) => q.screws.length >= 3).pop() || P.filter((q) => q.screws.length >= 2).pop(); p.screws.pop(); N--; }
  // above-lists: plates that sit on top of each plate
  P.forEach((p, i) => p.id = i);
  P.forEach((p) => { p.above = P.filter((q) => q.face === p.face && q.lv > p.lv && (overlaps(p, q) || overlaps(q, p))).map((q) => q.id); });
  const S = []; P.forEach((p) => p.screws.forEach(([x, y]) => S.push({ plate: p.id, face: p.face, fx: x, fy: y })));
  S.forEach((s, i) => s.id = i);
  // colouring: follow a random legal removal order, chunk into triples, then swap a little for difficulty; verify with the greedy solver
  const nc = clamp(n + 1, 2, 8), K_ = n <= 11 ? 2 : 3,   // two open boxes: a careless tap now parks a bolt, and a full tray is a real loss from level 5
    win = n === 1 ? 0 : n <= 3 ? 1 : Math.min(4, 2 + Math.floor(n / 4));
  const mix = n <= 3 ? 0.3 : 0.6;   // how often a bolt's colour is swapped with a later one: real tray pressure from level 4
  const pal = [...CKEYS].sort(() => R() - 0.5).slice(0, nc);
  for (let attempt = 0; attempt < 40; attempt++) {
    const order = removalOrder(P, S, R);
    const tri = []; let prev = null;
    for (let t = 0; t < order.length / 3; t++) { let c; do c = pal[ri(0, nc - 1)]; while (c === prev && nc > 1); prev = c; tri.push(c); }
    order.forEach((sid, i) => S[sid].color = tri[Math.floor(i / 3)]);
    const p = attempt < 30 ? Math.min(0.75, mix * fk) : 0; design.attempt = attempt;
    if (win) for (let i = 0; i < order.length; i++) if (R() < p) { const j = Math.min(order.length - 1, i + ri(3, 3 * win)); const a = S[order[i]], b = S[order[j]]; [a.color, b.color] = [b.color, a.color]; }
    // box queue = colours in triple order, rebalanced so every colour count is a multiple of 3
    const cnt = {}; S.forEach((s) => cnt[s.color] = (cnt[s.color] || 0) + 1);
    if (Object.values(cnt).some((v) => v % 3)) continue;
    const q = queueFrom(order.map((sid) => S[sid].color));
    if (solve(P, S, q, K_, R)) return { theme, W, H, D, F, P, S, queue: q, K: K_ };
  }
  // fallback: pure triple order (always solvable by following order)
  const order = removalOrder(P, S, R);
  order.forEach((sid, i) => S[sid].color = pal[Math.floor(i / 3) % nc]);
  return { theme, W, H, D, F, P, S, queue: queueFrom(order.map((sid) => S[sid].color)), K: K_ };
}
function boltCap(n) { return n <= 6 ? 3 * n + 3 : Math.min(30, 21 + 3 * Math.floor((n - 5) / 2)); }   // 6, 9, 12, 15, 18, 21, 24, 24, 27, 27, 30…
function queueFrom(colors) { // box order: triples as they are first needed
  const need = {}, q = []; for (const c of colors) { need[c] = (need[c] || 0) + 1; if (need[c] % 3 === 1) q.push(c); } return q;
}
function accessibleIn(P, S, alive, gone, s) {
  if (gone[s.id]) return false; const p = P[s.plate];
  return !p.above.some((qid) => alive[qid] && contains(P[qid], s.fx, s.fy, 0.12));
}
function settlePlates(P, S, alive, gone) {
  let ch = true; while (ch) { ch = false; for (const p of P) if (alive[p.id] && S.every((s) => s.plate !== p.id || gone[s.id]) && p.above.every((q) => !alive[q])) { alive[p.id] = false; ch = true; } }
}
function removalOrder(P, S, R) {
  const alive = P.map(() => true), gone = S.map(() => false), order = [];
  while (order.length < S.length) {
    const acc = S.filter((s) => accessibleIn(P, S, alive, gone, s)); if (!acc.length) break;
    const s = acc[Math.floor(R() * acc.length)]; gone[s.id] = true; order.push(s.id); settlePlates(P, S, alive, gone);
  }
  return order;
}
/** greedy solver (same policy as the bot): match an open box, otherwise park the bolt whose colour is needed soonest */
function solve(P, S, q, K_) {
  const alive = P.map(() => true), gone = S.map(() => false); let qi_ = 0; const bx = []; const buf = [];
  const refill = () => { while (bx.length < K_ && qi_ < q.length) bx.push({ c: q[qi_++], n: 0 }); };
  const settleBoxes = () => { let ch = true; while (ch) { ch = false; for (let i = bx.length - 1; i >= 0; i--) if (bx[i].n >= 3) { bx.splice(i, 1); ch = true; } refill();
    for (const b of bx) for (let j = buf.length - 1; j >= 0 && b.n < 3; j--) if (buf[j] === b.c) { buf.splice(j, 1); b.n++; ch = true; } } };
  refill();
  for (let step = 0; step < S.length; step++) {
    const acc = S.filter((s) => accessibleIn(P, S, alive, gone, s)); if (!acc.length) return false;
    let pick = acc.find((s) => bx.some((b) => b.c === s.color && b.n < 3)), toBox = !!pick;
    if (!pick) { if (buf.length >= TRAY) return false; const rank = (c) => { const i = q.indexOf(c, qi_); return i < 0 ? 1e9 : i; }; pick = acc.slice().sort((a, b) => rank(a.color) - rank(b.color))[0]; }
    gone[pick.id] = true; settlePlates(P, S, alive, gone);
    if (toBox) bx.find((b) => b.c === pick.color && b.n < 3).n++; else buf.push(pick.color);
    settleBoxes(); if (buf.length >= TRAY && !bx.some((b) => buf.includes(b.c))) return false;
  }
  return true;
}

// ---------------------------------------------------------------- build the 3D toy
const V = (a) => new THREE.Vector3(...a);
const woodTex = (() => {   // procedural wood grain (multiplied with the plate colour)
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    const y = Math.random() * 256, a = 0.05 + Math.random() * 0.09; x.strokeStyle = `rgba(120,70,20,${a})`; x.lineWidth = 1 + Math.random() * 3;
    x.beginPath(); x.moveTo(0, y); for (let k = 0; k <= 256; k += 16) x.lineTo(k, y + Math.sin(k / 40 + i) * 4 + Math.sin(k / 13) * 1.5); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.45, 0.45); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const plateMatsWood = ['#f7d29e', '#f0bb7c', '#fae0b8'].map((c) => mat(c, { roughness: 0.75, map: woodTex }));
const acrylic = ['#4fc3ff', '#ff7fb6', '#9be35a', '#ffc93d', '#b48cff', '#3fe0c5'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.78, emissive: c, emissiveIntensity: 0.18 }));
const CORE_COL = { crate: '#fff3df', house: '#fff7ee', robot: '#dfe9f7', gift: '#ffe3ef' };
function plateShape(p, holes) {
  let s;
  if (p.type === 'circle') { s = new THREE.Shape(); s.absarc(0, 0, p.r, 0, Math.PI * 2, false); }
  else {
    const w = p.w, h = p.h, r = p.type === 'capsule' ? h / 2 - 0.001 : p.r, x = -w / 2, y = -h / 2; s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    if (p.type === 'capsule') { s = new THREE.Shape(); const e = w / 2 - h / 2; s.moveTo(-e, -h / 2); s.lineTo(e, -h / 2); s.absarc(e, 0, h / 2, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-e, h / 2); s.absarc(-e, 0, h / 2, Math.PI / 2, Math.PI * 1.5, false); }
  }
  for (const [x, y] of holes) { const hp = new THREE.Path(); hp.absarc(x, y, 0.1, 0, Math.PI * 2, true); s.holes.push(hp); }
  return s;
}
function faceFrame(f) { return { c: V(f.c), n: V(f.n), u: V(f.u), v: V(f.v) }; }
function buildToy(L) {
  if (toy) scene.remove(toy);
  toy = new THREE.Group(); scene.add(toy); faces = {}; for (const k in L.F) faces[k] = faceFrame(L.F[k]);
  core = new THREE.Mesh(rbox(L.W, L.H, L.D, 0.2), mat(CORE_COL[L.theme], { roughness: 0.55 })); core.castShadow = core.receiveShadow = true; toy.add(core);
  decor(L);
  plates = L.P.map((p, i) => {
    const fr = faces[p.face], c = Math.cos(p.rot), s = Math.sin(p.rot);
    const holesLocal = p.screws.map(([x, y]) => { const dx = x - p.cx, dy = y - p.cy; return [dx * c + dy * s, -dx * s + dy * c]; });
    const g = new THREE.ExtrudeGeometry(plateShape(p, holesLocal), { depth: 0.11, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 18 });
    const material = p.lv === 0 && p.type === 'rect' ? plateMatsWood[(i + level) % 3] : (i % 3 === 0 ? plateMatsWood[(i + 1) % 3] : acrylic[(i * 5 + level) % acrylic.length]);
    const m = new THREE.Mesh(g, material); m.castShadow = !material.transparent; m.receiveShadow = true;
    const u2 = fr.u.clone().multiplyScalar(c).addScaledVector(fr.v, s), v2 = fr.u.clone().multiplyScalar(-s).addScaledVector(fr.v, c);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u2, v2, fr.n));
    const off = 0.03 + p.lv * PLATE_T;
    m.position.copy(fr.c).addScaledVector(fr.u, p.cx).addScaledVector(fr.v, p.cy).addScaledVector(fr.n, off);
    if (material.transparent) m.renderOrder = 2;
    toy.add(m);
    return { ...p, mesh: m, alive: true, left: p.screws.length, top: off + 0.14 };
  });
  // bolts as instanced meshes (2 draw calls for all of them)
  const N = L.S.length;
  headIM = new THREE.InstancedMesh(HEAD, glossy('#ffffff', { roughness: 0.25 }), N); headIM.castShadow = true;
  crossIM = new THREE.InstancedMesh(CROSS, crossMat, N);
  toy.add(headIM, crossIM);
  screws = L.S.map((s) => {
    const fr = faces[s.face], p = plates[s.plate];
    const pos = fr.c.clone().addScaledVector(fr.u, s.fx).addScaledVector(fr.v, s.fy).addScaledVector(fr.n, p.top);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fr.n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28));
    const o = { ...s, pos, q, gone: false, wob: 0 };
    headIM.setColorAt(s.id, new THREE.Color(COLORS[s.color]));
    setInst(o, 1); return o;
  });
  headIM.instanceColor.needsUpdate = true;
}
const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
function setInst(o, sc) {
  _q.copy(o.q); if (o.wob) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(o.wob * 30) * 0.25 * o.wob));
  _m.compose(o.pos, _q, _s.setScalar(sc)); headIM.setMatrixAt(o.id, _m); crossIM.setMatrixAt(o.id, _m);
  headIM.instanceMatrix.needsUpdate = true; crossIM.instanceMatrix.needsUpdate = true;
}
function decor(L) {
  const top = L.H / 2;
  if (L.theme === 'house') {
    const s = new THREE.Shape(); s.moveTo(-L.W / 2 - 0.3, 0); s.lineTo(L.W / 2 + 0.3, 0); s.lineTo(0, 1.35); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: L.D + 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }); g.translate(0, 0, -(L.D + 0.3) / 2);
    const roof = new THREE.Mesh(g, mat('#ff6f6f', { roughness: 0.5 })); roof.position.y = top - 0.02; roof.castShadow = true; toy.add(roof);
    const ch = new THREE.Mesh(rbox(0.36, 0.7, 0.36, 0.06), mat('#c7c2d6')); ch.position.set(0.7, top + 0.95, -0.3); ch.castShadow = true; toy.add(ch);
  } else if (L.theme === 'robot') {
    const head = new THREE.Mesh(rbox(1.6, 1.05, 1.3, 0.25), mat('#bcd3f0')); head.position.y = top + 0.56; head.castShadow = true; toy.add(head);
    for (const x of [-0.36, 0.36]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), mat('#22243a')); e.position.set(x, top + 0.6, 0.62); toy.add(e);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#ffffff')); gl.position.set(x + 0.06, top + 0.67, 0.77); toy.add(gl); }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), metal); ant.position.y = top + 1.32; toy.add(ant);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), glossy('#ff5d8f', { emissive: '#ff2d6f', emissiveIntensity: 0.4 })); bulb.position.y = top + 1.6; toy.add(bulb);
  } else if (L.theme === 'gift') {
    const m = glossy('#ff4d7a', { roughness: 0.3 });
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.13, 12, 26), m); t.position.set(s * 0.38, top + 0.36, 0); t.rotation.set(0, 0, s * 0.5); t.scale.set(1, 0.8, 0.8); t.castShadow = true; toy.add(t); }
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), m); k.position.y = top + 0.22; toy.add(k);
  } else {
    // crate: chunky corner posts
    for (const x of [-1, 1]) for (const z of [-1, 1]) { const p = new THREE.Mesh(rbox(0.22, L.H + 0.1, 0.22, 0.07), mat('#ffd9a8', { roughness: 0.7 })); p.position.set(x * L.W / 2, 0, z * L.D / 2); p.castShadow = true; toy.add(p); }
  }
}
const ground = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40), new THREE.ShadowMaterial({ opacity: 0.16 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// ---------------------------------------------------------------- boxes / tray flow
function setupBoxes(L) {
  for (const b of boxes) if (b.group) hud.remove(b.group);
  for (const t of buffer) if (t && t.fl) t.fl.parent && t.fl.parent.remove(t.fl);
  K = L.K; queue = L.queue; qi = 0; boxes = []; buffer = new Array(TRAY).fill(null);
  for (let i = 0; i < K; i++) { boxes.push({ i, color: null, reserved: 0, filled: 0, active: false, group: null, items: [] }); nextBox(boxes[i], i * 90); }
  layoutHud();
}
function nextBox(b, delay = 0) {
  if (qi >= queue.length) { b.color = null; b.active = false; return; }
  b.color = queue[qi++]; b.reserved = 0; b.filled = 0; b.items = []; b.active = false;
  const g = makeBox(b.color); g.scale.setScalar(SLOT * 0.86); const p = boxPos(b.i); g.position.copy(p).add(new THREE.Vector3(0, 1.4, 0)); hud.add(g); b.group = g;
  anim(240, (k) => g.position.y = lerp(p.y + 1.4, p.y, k), easeBack, delay).then(() => { b.active = true; tone(700, 0.05, 'triangle', 0.06, 1.2); pullFromTray(b); });
}
function completeBox(b) {
  b.active = false; const g = b.group, my = gen;
  setTimeout(async () => {
    if (gen !== my) return;
    g.lid.visible = true; await anim(120, (k) => g.lid.position.y = lerp(1.2, 0.4, k), (k) => k * k);
    sfx.coin(); buzz(25); const wp = g.getWorldPosition(new THREE.Vector3());
    burst(scene, wp, [COLORS[b.color], '#ffffff', '#ffe36b'], 14, { speed: 0.06, up: 0.05, size: 0.35, gravity: 0.003 });
    await anim(110, (k) => g.scale.setScalar(SLOT * 0.86 * (1 + 0.18 * Math.sin(k * Math.PI))));
    const y0 = g.position.y; await anim(200, (k) => { g.position.y = y0 + k * k * 1.6; g.rotation.z = k * 0.3; });
    if (gen !== my) return; hud.remove(g); b.group = null; nextBox(b);
  }, 60);
}
function freeTray() { return buffer.findIndex((t) => !t); }
function pullFromTray(b) {
  for (let j = 0; j < TRAY && b.active && b.reserved < 3; j++) {
    const t = buffer[j]; if (!t || !t.arrived || t.color !== b.color) continue;
    buffer[j] = null; const slot = b.reserved++; scene.attach(t.fl); flyTo(t.fl, b, slot);
  }
  hudText();
}
async function flyTo(fl, b, slot) {
  const f = { fl }; flights.push(f);
  const p0 = fl.position.clone(), q0 = fl.quaternion.clone(), s0 = fl.scale.x;
  const tgtLocal = new THREE.Vector3(holeX(slot), -0.02, 0.3), tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  await anim(340, (k) => {
    if (!b.group) return; const tw = b.group.localToWorld(tgtLocal.clone()), tqw = b.group.getWorldQuaternion(new THREE.Quaternion()).multiply(tq), ts = SLOT * 0.86 * 0.62;
    fl.position.lerpVectors(p0, tw, k); fl.position.y += Math.sin(k * Math.PI) * 0.8; fl.quaternion.slerpQuaternions(q0, tqw, k); fl.scale.setScalar(lerp(s0, ts, k));
  }, easeInOut);
  flights.splice(flights.indexOf(f), 1);
  if (!b.group) { scene.remove(fl); return; }
  b.group.attach(fl); if (fl.shaft) fl.shaft.visible = false; fl.position.copy(tgtLocal); fl.quaternion.copy(tq); fl.scale.setScalar(0.62);
  tone(1100 + b.filled * 160, 0.05, 'square', 0.05, 1.1); b.filled++; b.items.push(fl);
  if (b.filled === 3) completeBox(b);
}
async function flyToTray(fl, j) {
  const f = { fl }; flights.push(f);
  const p0 = fl.position.clone(), q0 = fl.quaternion.clone(), s0 = fl.scale.x, tl = traySlot(j), tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  await anim(340, (k) => {
    const tw = tray.localToWorld(tl.clone()), tqw = tray.getWorldQuaternion(new THREE.Quaternion()).multiply(tq), ts = tray.scale.x * 0.95;
    fl.position.lerpVectors(p0, tw, k); fl.position.y += Math.sin(k * Math.PI) * 0.6; fl.quaternion.slerpQuaternions(q0, tqw, k); fl.scale.setScalar(lerp(s0, ts, k));
  }, easeInOut);
  flights.splice(flights.indexOf(f), 1);
  tray.attach(fl); if (fl.shaft) fl.shaft.visible = false; fl.position.copy(tl); fl.quaternion.copy(tq); fl.scale.setScalar(0.95);
  tone(500, 0.06, 'triangle', 0.08, 0.9); buffer[j].arrived = true;
  const b = boxes.find((b) => b.active && b.color === buffer[j].color && b.reserved < 3); if (b) pullFromTray(b);
  const used = buffer.filter(Boolean).length;
  hudText(); if (used >= TRAY - 1) { ui.pop(used >= TRAY ? 'TRAY FULL!' : 'LAST SLOT!', '#ff4d5e', 30, 30); buzz(40); }
}
const allFlyers = [];
function makeFlyer(color) {
  const g = new THREE.Group(); allFlyers.push(g);
  const h = new THREE.Mesh(HEAD, headMats[color]); h.castShadow = true; const c = new THREE.Mesh(CROSS, crossMat); const sh = new THREE.Mesh(SHAFT_THREADED, metal);
  g.add(h, c, sh); g.shaft = sh; return g;
}

// ---------------------------------------------------------------- tapping bolts
function blocked(s) { const p = plates[s.plate]; return p.above.map((i) => plates[i]).find((q) => q.alive && contains(q, s.fx, s.fy, 0.12)); }
function tapScrew(s) {
  if (state !== 'play' || s.gone) return;
  const blk = blocked(s);
  if (blk) { s.wob = 1; tone(160, 0.1, 'square', 0.07, 0.8); buzz(30); blk.wob = 1; return; }
  let b = boxes.filter((b) => b.active && b.color === s.color && b.reserved < 3).sort((a, c) => c.reserved - a.reserved)[0], j = -1;
  if (!b) { j = freeTray(); if (j < 0) { ui.pop('TRAY FULL!', '#ff4d5e', 30, 30); buzz(60); return; } buffer[j] = { color: s.color, arrived: false }; }
  const slot = b ? b.reserved++ : -1;
  s.gone = true; setInst(s, 0); cleared++; total++; ui.progress(cleared / screws.length);
  hudText(); leftEl.classList.add('bump'); setTimeout(() => leftEl.classList.remove('bump'), 120);
  const fl = makeFlyer(s.color); scene.add(fl);
  fl.position.copy(toy.localToWorld(s.pos.clone())); fl.quaternion.copy(toy.getWorldQuaternion(new THREE.Quaternion()).multiply(s.q));
  if (j >= 0) buffer[j].fl = fl;
  const nW = new THREE.Vector3(0, 1, 0).applyQuaternion(fl.quaternion), p0 = fl.position.clone();
  for (let i = 0; i < 4; i++) setTimeout(() => tone(1500 + i * 120, 0.025, 'square', 0.04, 0.9), i * 55);
  buzz(12);
  // plates that lost their last bolt fall
  const p = plates[s.plate]; p.left--; setTimeout(settle, 230);
  anim(230, (k) => { fl.position.copy(p0).addScaledVector(nW, k * 0.62); fl.rotateY(0.6); }, (k) => k).then(() => b ? flyTo(fl, b, slot) : flyToTray(fl, j));
}
function settle() {
  let ch = true;
  while (ch) { ch = false; for (const p of plates) if (p.alive && p.left === 0 && p.above.every((i) => !plates[i].alive)) { p.alive = false; ch = true; drop(p); } }
}
function drop(p) {
  const m = p.mesh, wp = m.getWorldPosition(new THREE.Vector3()), wq = m.getWorldQuaternion(new THREE.Quaternion());
  scene.add(m); m.position.copy(wp); m.quaternion.copy(wq);
  const n = faces[p.face].n.clone().transformDirection(toy.matrixWorld);
  fallers.push({ m, v: n.multiplyScalar(0.05).add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.06, 0)), w: new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.12), t: 0 });
  tone(240, 0.16, 'triangle', 0.12, 0.6); setTimeout(() => tone(140, 0.12, 'sine', 0.12, 0.7), 120); buzz(20);
  ui.pop(['Clunk!', 'Nice!', 'Free!', 'Pop!'][Math.floor(Math.random() * 4)], '#ff5d8f', 30, 33);
}

// ---------------------------------------------------------------- tiny tween helper
const easeInOut = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, easeBack = (k) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
let gen = 0; const tweens = [];
function anim(ms, fn, ease = (k) => k, delay = 0) { return new Promise((res) => tweens.push({ t0: performance.now() + delay, ms, fn, ease, res, gen })); }
function runTweens() {
  const now = performance.now();
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i]; if (t.gen !== gen) { tweens.splice(i, 1); continue; } if (now < t.t0) continue;
    const k = Math.min(1, (now - t.t0) / t.ms); t.fn(t.ease(k)); if (k >= 1) { tweens.splice(i, 1); t.res(); }
  }
}

// ---------------------------------------------------------------- level flow
let L;
function startLevel() {
  gen++; tweens.length = 0; flights.length = 0;
  for (const f of fallers) scene.remove(f.m); fallers = [];
  for (const f of allFlyers) f.parent && f.parent.remove(f); allFlyers.length = 0;
  const bg = BGS[(level - 1) % BGS.length]; document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]); document.body.style.setProperty('--ui', '#3a7bff');
  L = design(level, FL.k()); buildToy(L); setupBoxes(L);
  ground.position.y = -L.H / 2 - 0.01; toy.position.y = 0;
  cleared = 0; rotY = level === 1 ? -0.25 : -0.55; rotV = 0; tilt = 0.12; botFace = null;
  ui.levels(level); ui.progress(0); hudText();
}
function win() {
  if (state === 'play') FL.level(true);
  if (state === 'play') B.submit(1); state = 'won'; wonAt = performance.now(); save.set('bolts', total); level++; save.set('level', level);
  sfx.win(); buzz([30, 40, 60]); ui.flash(0.5); confetti(scene, new THREE.Vector3(0, 1.5, 0), 90);
  ui.win(level - 1, `${screws.length} bolts out!`); ui.els.win.querySelector('.hint').textContent = `Level ${level} ▶`; hudText();
}
function lose() { if (state === 'play') FL.level(false, screws.length ? screws.filter((s) => s.gone).length / screws.length : 0); state = 'lost'; sfx.fail(); buzz([60, 40, 90]); ui.lose('TRAY FULL!', 'Match the box colours.'); hudText(); }
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; hudText(); return; } startLevel(); state = 'play'; hudText(); });

// ---------------------------------------------------------------- input: drag to spin, tap a bolt
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({
  onMove(dx, dy) { if (state !== 'play') return; rotY += dx * 0.009; rotV = dx * 0.009; tilt = clamp(tilt + dy * 0.004, -0.2, 0.6); botFace = null; },
  onTap(e) {
    if (state !== 'play') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([headIM, core, ...plates.filter((p) => p.alive).map((p) => p.mesh)], false);
    if (!hits.length) return;
    const h = hits[0];
    if (h.object === headIM && h.instanceId !== undefined) return tapScrew(screws[h.instanceId]);
    // fat-finger: nearest live bolt to the hit point
    let best = null, bd = 0.45; const lp = toy.worldToLocal(h.point.clone());
    for (const s of screws) if (!s.gone) { const d = s.pos.distanceTo(lp); if (d < bd) { bd = d; best = s; } }
    if (best) tapScrew(best);
  },
});

// ---------------------------------------------------------------- bot: same greedy policy as the level verifier
function bot() {
  if (state !== 'play') return;
  const acc = screws.filter((s) => !s.gone && !blocked(s)); if (!acc.length) return;
  let pick = acc.find((s) => boxes.some((b) => b.active && b.color === s.color && b.reserved < 3));
  if (!pick) {
    if (boxes.some((b) => !b.active && b.color) || flights.length) return;   // a box is swapping or bolts in the air: wait
    if (freeTray() < 0) return;
    const rank = (c) => { const i = queue.indexOf(c, qi); return i < 0 ? 1e9 : i; };
    pick = acc.slice().sort((a, b) => rank(a.color) - rank(b.color))[0];
  }
  botFace = pick.face; tapScrew(pick);
}

// ---------------------------------------------------------------- main loop
const camT = new THREE.Vector3(0, 1.25, 0);
function placeCamera() {
  const portrait = camera.aspect < 0.75, d = portrait ? 12.6 : 10.2;
  camera.position.set(0, d * 0.4, d); camera.lookAt(camT.set(0, portrait ? 0.95 : 0.8, 0)); layoutHud();
}
addEventListener('resize', placeCamera); placeCamera();
const FACE_YAW = { front: -0.45, right: -Math.PI / 2 + 0.45, back: -Math.PI + 0.45, left: Math.PI / 2 - 0.45, top: null };
loop((dt, t) => {
  runTweens();
  if (state === 'play' && botFace && FACE_YAW[botFace] !== null) {
    let target = FACE_YAW[botFace]; while (target - rotY > Math.PI) target -= Math.PI * 2; while (target - rotY < -Math.PI) target += Math.PI * 2;
    rotY += (target - rotY) * 0.1 * dt;
  } else { rotY += rotV * dt; rotV *= Math.pow(0.9, dt); }
  if (toy) {
    const idle = state === 'ready' ? Math.sin(t * 0.8) * 0.25 : 0;
    toy.rotation.set(tilt, rotY + idle, 0);
    if (state === 'won') { const k = Math.min(1, (performance.now() - wonAt) / 900); toy.rotation.y += k * k * 6; toy.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15); toy.position.y = Math.sin(k * Math.PI) * 0.6; }
    else { toy.scale.setScalar(1); }
    for (const s of screws) if (s.wob > 0 && !s.gone) { s.wob = Math.max(0, s.wob - 0.05 * dt); setInst(s, 1); }
    for (const p of plates) if (p.wob > 0 && p.alive) { p.wob = Math.max(0, p.wob - 0.05 * dt); p.mesh.scale.setScalar(1 + Math.sin(p.wob * 25) * 0.03 * p.wob); }
  }
  for (let i = fallers.length - 1; i >= 0; i--) {
    const f = fallers[i]; f.t += dt; f.v.y -= 0.0065 * dt; f.m.position.addScaledVector(f.v, dt);
    f.m.rotation.x += f.w.x * dt; f.m.rotation.y += f.w.y * dt; f.m.rotation.z += f.w.z * dt;
    if (f.m.position.y < -10) { scene.remove(f.m); f.m.geometry.dispose(); fallers.splice(i, 1); }
  }
  // tray wobble when nearly full
  const used = buffer.filter(Boolean).length; tray.position.x = used >= TRAY - 1 ? Math.sin(t * 40) * 0.01 : 0;
  if (state === 'play' && screws.length) {
    if (cleared === screws.length && !flights.length && buffer.every((b) => !b)) win();
    else if (used >= TRAY && buffer.every((b) => b && b.arrived) && !flights.length && !boxes.some((b) => !b.active && b.color) && !boxes.some((b) => b.active && b.reserved < 3 && buffer.some((t) => t.color === b.color))) lose();
  }
});

startLevel();
ui.start();
// test hook: screen (CSS px) points of bolts a player could tap right now — unblocked, facing the camera, box-matching first
function screenBolts() {
  const out = [], cam = camera.position, v = new THREE.Vector3();
  for (const s of screws) {
    if (s.gone || blocked(s)) continue;
    const wp = toy.localToWorld(s.pos.clone()), n = faces[s.face].n.clone().transformDirection(toy.matrixWorld);
    if (n.dot(cam.clone().sub(wp).normalize()) < 0.25) continue;
    v.copy(wp).project(camera); const match = boxes.some((b) => b.active && b.color === s.color && b.reserved < 3);
    out.push([(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, match ? 0 : 1, s.id]);
  }
  return out.sort((a, b) => a[2] - b[2]);
}
// test hook: play design(n) with a scripted policy, no rendering. 'greedy' = the verifier, 'casual' = taps a box match 80% of the time else any bolt
function simulate(n, policy = 'casual', trials = 200, seed = 1, T = TRAY, pm = 0.8) {
  const R = rng(seed * 131 + n); let won = 0, taps = 0;
  for (let t = 0; t < trials; t++) {
    const Lx = design(n, 1), P = Lx.P, S = Lx.S, q = Lx.queue, alive = P.map(() => true), gone = S.map(() => false), bx = [], buf = []; let qi_ = 0, ok = true;
    const refill = () => { while (bx.length < Lx.K && qi_ < q.length) bx.push({ c: q[qi_++], n: 0 }); };
    const settleB = () => { let ch = true; while (ch) { ch = false; for (let i = bx.length - 1; i >= 0; i--) if (bx[i].n >= 3) { bx.splice(i, 1); ch = true; } refill(); for (const b of bx) for (let j = buf.length - 1; j >= 0 && b.n < 3; j--) if (buf[j] === b.c) { buf.splice(j, 1); b.n++; ch = true; } } };
    refill();
    for (let step = 0; step < S.length; step++) {
      const acc = S.filter((s) => accessibleIn(P, S, alive, gone, s)); if (!acc.length) { ok = false; break; }
      const m = acc.filter((s) => bx.some((b) => b.c === s.color && b.n < 3));
      const pick = (policy === 'greedy' || R() < pm) && m.length ? m[Math.floor(R() * m.length)] : acc[Math.floor(R() * acc.length)];
      gone[pick.id] = true; settlePlates(P, S, alive, gone); taps++;
      const b = bx.find((b) => b.c === pick.color && b.n < 3); if (b) b.n++; else { if (buf.length >= T) { ok = false; break; } buf.push(pick.color); }
      settleB(); if (buf.length >= T && !bx.some((b) => buf.includes(b.c))) { ok = false; break; }
    }
    if (ok) won++;
  }
  return { n, policy, winPct: Math.round(100 * won / trials), bolts: design(n, 1).S.length, K: design(n, 1).K };
}
window.__game = { simulate, get state() { return state; }, get level() { return level; }, get score() { return total; }, bot, design, solve, screenBolts,dbg: () => ({ left: screws.filter((s) => !s.gone).map((s) => [s.id, s.color, s.face, !!blocked(s)]), boxes: boxes.map((b) => [b.color, b.active, b.reserved, b.filled]), buffer: buffer.map((b) => b && [b.color, b.arrived]), qi, queue, flights: flights.length, plates: plates.map((p) => [p.id, p.alive, p.left, p.above]) }), load(n) { level = n; ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); startLevel(); state = 'play'; } };

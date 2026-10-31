// Bolt Twist deep v2 (studio lane 25, 2026-10-29) — 30 authored toys in 3 worlds, gold keys / padlocks, ice bolts, stars, map, stickers, paints.
// Bolt Twist — original game. Tap coloured bolts to spin them out of a 3D toy; they fly into boxes of the same colour
// (3 per box) or into a 5-slot tray. Plates with no bolts left fall off. Clear every bolt to win; a full tray loses.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, glossy, clamp, lerp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapter } from './kit/adapt.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS, THEME_ICON, plates as tplPlates } from './levels.js';
import { buildLevel, casual } from './blogic.js';
import { BAKE } from './bake.js';
const B = board({ game: 'bolt-twist', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d, r);   // rounded() grows by its bevel; this keeps exact outer size

const COLORS = { red: '#ff4d5e', blue: '#3a8dff', yellow: '#ffc61a', green: '#35c96a', purple: '#9b62ff', orange: '#ff8a2a', pink: '#ff6fc3', cyan: '#22cfd6' };
const CKEYS = Object.keys(COLORS);
const BGS = [['#a9d8ff', '#eaf7ff'], ['#ffd0e4', '#fff1f7'], ['#bff0d4', '#effff5'], ['#dcd0ff', '#f6f1ff'], ['#ffe0b0', '#fff7ea']];
let TRAY = 5; const PLATE_T = 0.17;   // TRAY = slots this level: 5 on the warm-up levels 1-4, 4 from level 5 (a careless run really fills it)
const trayFor = (n) => n <= 4 ? 5 : 4;

const stage = createStage({ fov: 38, shadowSize: 5 });
const { scene, camera, renderer, sun } = stage;
scene.add(camera);
sun.position.set(4, 12, 9);
const save = store('bolttwist');
const FL = flow('bolttwist');   // (F is the face table inside design)
const prog = store('bolttwist2');   // v2 progress (v1 keeps 'bolttwist'): unlocked toy, stars per toy, equipped paint
let unlocked = prog.get('unlocked', 1), starsOf = prog.get('stars', {}), paintOn = prog.get('paint', 0), played = prog.get('played', 0);
const urlLevel = +(/[?&]level=(\d+)/.exec(location.search) || [])[1];
let level = urlLevel || unlocked, total = save.get('bolts', 0), state = 'ready', parks = 0, curPar = 0, bestStreak = 0;
const PINS = ['🦄', '🐙', '🚀', '🍩', '🦖', '🌈', '🎈', '🐝', '🍄', '🎸', '🐳', '🧸'];   // the pin book: a chest every 3rd toy, a golden bolt now and then
let pins = prog.get('pins', []), bests = prog.get('best', {}), goldPin = -1, goldS = null, toyT0 = 0;
const givePin = () => { const left = PINS.map((_, i) => i).filter((i) => !pins.includes(i)); if (!left.length) return -1; const i = left[Math.floor(Math.random() * left.length)]; pins.push(i); prog.set('pins', pins); return i; };
const sumStars = () => Object.values(starsOf).reduce((a, b) => a + b, 0);
// ---------------------------------------------------------------- in-round adaptation (ADAPT_BRIEF.md): honest + bounded
// Reads ONLY how this player is playing right now: good/bad moves in the last 20 s and time since the last success.
// level −1 (struggling) … +1 (cruising) moves ≤ 0.25 per 3 s and drifts back to 0 when neutral. k(fk) = multiplier for a
// harder-when-bigger knob: ±20 %, and together with flow.js's between-run nudge it stays within ±25 %. Rescues: at most one
// per round and 60 s apart, only for a player who has been playing sensibly (never for an idle one). QA reads window.__game.adapt.
const AD = adapter(); let tapAt = 0;
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
  if (typeof starEl !== 'undefined') { starChip(); nextChips(); }
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
const instMat = glossy('#ffffff', { roughness: 0.25 }), crossMat = mat('#262a3a', { roughness: 0.6 }), metal = new THREE.MeshStandardMaterial({ color: '#c9d1dc', roughness: 0.3, metalness: 0.75 });
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

// tray: bar with TRAY sockets (rebuilt per level)
const tray = new THREE.Group(); hud.add(tray); const sockMat = mat('#9fb3c8', { roughness: 0.8 }), barMat = mat('#ffffff', { roughness: 0.6, transparent: true, opacity: 0.55 });
function buildTray() {
  for (const c of [...tray.children]) if (c.isSock || c === tray.bar) { tray.remove(c); if (c === tray.bar) c.geometry.dispose(); }
  const bar = new THREE.Mesh(rbox(TRAY * 0.62 + 0.2, 0.62, 0.22, 0.11), barMat); tray.add(bar); tray.bar = bar;
  for (let i = 0; i < TRAY; i++) { const h = new THREE.Mesh(HOLE, sockMat); h.isSock = true; h.rotation.x = Math.PI / 2; h.scale.set(1.5, 1, 1.5); h.position.set((i - (TRAY - 1) / 2) * 0.62, 0, 0.1); tray.add(h); }
}
buildTray();
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

// ---------------------------------------------------------------- authored toys (levels.js) with baked colours (bake.js)
const specOf = (n) => {   // 1-30 authored; after 30 the Factory toys come round again with new colours (searched on the spot)
  const s0 = n <= LEVELS.length ? LEVELS[n - 1] : { ...LEVELS[20 + (n % 10)], n, seed: n * 53 + 11, target: null };
  return { ...s0, faces: Object.fromEntries(Object.entries(s0.faces).map(([f, t]) => [f, tplPlates(t)])), bake: n <= LEVELS.length ? BAKE[n] : null };
};
function design(n) {
  const L = buildLevel(specOf(n), 1) || buildLevel({ ...specOf(n), seed: n + 999, bake: null, target: null }, 1);
  L.theme = L.theme || 'crate'; return L;
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
const CORE_COL = { crate: '#fff3df', house: '#fff7ee', robot: '#dfe9f7', gift: '#ffe3ef', rocket: '#eef1fb', castle: '#f1e8d8' };
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
  headIM = new THREE.InstancedMesh(HEAD, instMat, N); headIM.castShadow = true;
  crossIM = new THREE.InstancedMesh(CROSS, crossMat, N);
  toy.add(headIM, crossIM);
  screws = L.S.map((s) => {
    const fr = faces[s.face], p = plates[s.plate];
    const pos = fr.c.clone().addScaledVector(fr.u, s.fx).addScaledVector(fr.v, s.fy).addScaledVector(fr.n, p.top);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), fr.n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28));
    const o = { ...s, pos, q, gone: false, wob: 0 };
    headIM.setColorAt(s.id, headColor(s.color));
    setInst(o, 1); return o;
  });
  headIM.instanceColor.needsUpdate = true;
  buildMarks(); pickGold();
}

// ---------------------------------------------------------------- bolt paints (a collection earned with stars), keys, padlocks, ice
const PAINTS = [
  { name: 'Classic', at: 0 },
  { name: 'Candy', at: 3, rough: 0.04, emis: 0.12 },
  { name: 'Chrome', at: 8, rough: 0.12, metal: 0.8 },
  { name: 'Pastel', at: 14, light: 0.42, rough: 0.5 },
  { name: 'Neon', at: 22, emis: 0.35, rough: 0.2 },
  { name: 'Midnight', at: 32, dark: 0.3, emis: 0.22, cross: '#ffd23a' },
];
const _c = new THREE.Color(), _w = new THREE.Color('#ffffff'), _k = new THREE.Color('#10121c');
function headColor(k) { const P = PAINTS[paintOn] || PAINTS[0]; _c.set(COLORS[k]); if (P.light) _c.lerp(_w, P.light); if (P.dark) _c.lerp(_k, P.dark); return _c.clone(); }
function applyPaint() {
  const P = PAINTS[paintOn] || PAINTS[0];
  for (const m of [instMat, ...CKEYS.map((k) => headMats[k])]) { m.roughness = P.rough ?? 0.25; m.metalness = P.metal ?? 0; if (m.emissive) { m.emissive.set('#ffffff'); m.emissiveIntensity = P.emis ?? 0; } }
  crossMat.color.set(P.cross || '#262a3a');
  for (const k of CKEYS) headMats[k].color.copy(headColor(k));
  if (headIM) { screws.forEach((s) => headIM.setColorAt(s.id, headColor(s.color))); headIM.instanceColor.needsUpdate = true; }
}
const TINT = ['#ffd23a', '#58d6ff', '#ff7fa8', '#9dff6a'];
const spriteOf = (draw, size) => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); draw(x); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true })); sp.scale.setScalar(size); sp.renderOrder = 9; sp.userData.tex = t; return sp;
};
const emojiDraw = (e) => (x) => { x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 70); };
const numDraw = (n) => (x) => { x.font = 'bold 84px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeStyle = '#1b6fb0'; x.strokeText(n, 64, 68); x.fillStyle = '#fff'; x.fillText(n, 64, 68); };
const iceMat = new THREE.MeshStandardMaterial({ color: '#bfeaff', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, emissive: '#7fd0ff', emissiveIntensity: 0.25 });
const ICE_GEO = rbox(0.5, 0.34, 0.5, 0.08);
function buildMarks() {
  const keys = screws.filter((s) => s.kind === 'key'); const up = new THREE.Vector3(0, 1, 0);
  for (const s of screws) {
    const fr = faces[s.face], base = new THREE.Quaternion().setFromUnitVectors(up, fr.n), nrm = fr.n;
    if (s.kind === 'key' || s.kind === 'lock') {
      const pair = s.kind === 'key' ? keys.indexOf(s) : keys.indexOf(screws[s.lockedBy]), tint = TINT[pair % TINT.length];
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 8, 28), new THREE.MeshStandardMaterial({ color: tint, roughness: 0.25, metalness: 0.5, emissive: tint, emissiveIntensity: 0.35 }));
      ring.quaternion.copy(base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))); ring.position.copy(s.pos).addScaledVector(nrm, 0.04); toy.add(ring); s.ring = ring;
      const ic = spriteOf(emojiDraw(s.kind === 'key' ? '🔑' : '🔒'), 0.46); ic.position.copy(s.pos).addScaledVector(nrm, 0.32); ic.position.addScaledVector(fr.v, 0.3); toy.add(ic); s.icon = ic; ic.userData.base = ic.position.clone();
    }
    if (s.kind === 'ice') {
      const b = new THREE.Mesh(ICE_GEO, iceMat); b.quaternion.copy(base); b.position.copy(s.pos).addScaledVector(nrm, 0.1); b.renderOrder = 3; toy.add(b); s.ice_ = b;
      const nm = spriteOf(numDraw(s.ice), 0.4); nm.position.copy(s.pos).addScaledVector(nrm, 0.4); toy.add(nm); s.num = nm; s.numShown = s.ice;
    }
  }
}
function pickGold() {   // some toys (about 1 in 3 after toy 2) hide one golden bolt: tap it for a pin
  goldS = null; goldPin = -1; if (level < 3 || Math.random() > 0.34) return;
  const c = screws.filter((s) => s.kind === 'n'); if (!c.length) return; const s = c[Math.floor(Math.random() * c.length)], fr = faces[s.face];
  const ic = spriteOf(emojiDraw('✨'), 0.5); ic.position.copy(s.pos).addScaledVector(fr.n, 0.3); toy.add(ic); s.gold = ic; ic.userData.base = ic.position.clone(); goldS = s;
  setTimeout(() => state === 'play' && coach.say('✨ A golden bolt is hiding!', 34, 2200), 1400);
}
function popOff(o, color) {   // a lock / ice block pops: scale up, then away
  if (!o) return; const sc = o.scale.clone();
  burst(scene, toy.localToWorld(o.position.clone()), [color, '#ffffff'], 10, { speed: 0.05, up: 0.06, size: 0.3, gravity: 0.004 });
  anim(260, (k) => { o.scale.copy(sc).multiplyScalar(k < 0.3 ? 1 + k * 1.2 : Math.max(0.001, 1.36 * (1 - (k - 0.3) / 0.7))); }).then(() => { toy.remove(o); });
}
function unlockFor(key) {
  if (key.ring) { popOff(key.ring, '#ffd23a'); key.ring = null; } if (key.icon) { toy.remove(key.icon); key.icon = null; }
  const locked = screws.filter((s) => s.lockedBy === key.id && !s.gone);
  if (locked.length) {
    sfx.coin(); buzz([20, 30, 20]); tone(1300, 0.1, 'triangle', 0.1, 1.5); ui.pop('UNLOCKED!', '#ffb81c', 38, 33);
    for (const l of locked) { popOff(l.ring, '#ffd23a'); l.ring = null; if (l.icon) { popOff(l.icon, '#ffd23a'); l.icon = null; } l.wob = 1; }
  }
}
function marksTick(after) {
  for (const s of screws) {
    if (!s.ice_) continue;
    if (s.gone) { toy.remove(s.ice_); toy.remove(s.num); s.ice_ = s.num = null; continue; }
    const left = s.ice - cleared;
    if (left <= 0) {
      s.ice_ = popIce(s); continue;
    }
    if (s.numShown !== left) { s.numShown = left; const c = s.num.material.map.image, x = c.getContext('2d'); x.clearRect(0, 0, 128, 128); numDraw(left)(x); s.num.material.map.needsUpdate = true; if (after) { s.num.scale.setScalar(0.6); tone(900 + left * 40, 0.05, 'triangle', 0.06, 0.9); } }
  }
}
function popIce(s) { const b = s.ice_, n = s.num; s.num = null; popOff(b, '#9be0ff'); toy.remove(n); sfx.coin(); tone(1500, 0.12, 'sine', 0.1, 1.6); buzz(20); ui.pop('THAWED!', '#3fb8ff', 36, 33); s.wob = 1; return null; }
function marksFrame(t, dt) {
  for (const s of screws) {
    if (s.gone) continue;
    if (s.ring) { const k = s.hint && performance.now() < s.hint ? 1.25 + 0.2 * Math.sin(t * 14) : 1 + 0.06 * Math.sin(t * 4 + s.id); s.ring.scale.setScalar(k); }
    if (s.gold) { s.gold.position.copy(s.gold.userData.base).y += Math.sin(t * 5 + s.id) * 0.05; s.gold.scale.setScalar(0.5 + 0.08 * Math.sin(t * 9)); }
    if (s.icon && s.icon.userData.base) s.icon.position.copy(s.icon.userData.base).y += Math.sin(t * 3 + s.id) * 0.03;
    if (s.num && s.num.scale.x < 0.4) s.num.scale.setScalar(Math.min(0.4, s.num.scale.x + 0.03 * dt));
  }
}
function fever(n) {
  ui.flash(0.28); buzz([20, 20, 40]); confetti(scene, new THREE.Vector3(0, 1.5, 1), 36 + n * 4);
  ui.pop(n >= 11 ? `UNSTOPPABLE x${n}` : n >= 8 ? `FEVER x${n}!` : `HOT STREAK x${n}`, n >= 11 ? '#ff4d5e' : '#ff8a2a', 40 + Math.min(n, 12) * 2, 44);
  for (let i = 0; i < 5; i++) setTimeout(() => tone(700 + i * 160, 0.06, 'square', 0.06, 1.2), i * 45);
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
  } else if (L.theme === 'rocket') {
    const nose = new THREE.Mesh(new THREE.ConeGeometry(L.W * 0.5, 1.5, 28), glossy('#ff5d6e', { roughness: 0.35 })); nose.position.y = top + 0.72; nose.rotation.y = Math.PI / 4; nose.castShadow = true; toy.add(nose);
    for (const x of [-1, 1]) { const fin = new THREE.Mesh(rbox(0.3, 1.0, 0.8, 0.1), glossy('#ff5d6e', { roughness: 0.35 })); fin.position.set(x * (L.W / 2 + 0.12), -L.H / 2 + 0.2, 0); fin.rotation.z = -x * 0.25; toy.add(fin); }
    const win_ = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), glossy('#7fd6ff', { roughness: 0.1 })); win_.position.set(0, top + 0.5, L.W * 0.2); toy.add(win_);
  } else if (L.theme === 'castle') {
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.9, 14), mat('#d9cdb8', { roughness: 0.7 })); t.position.set(x * L.W * 0.4, top + 0.4, z * L.D * 0.4); t.castShadow = true; toy.add(t);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 14), mat('#7f6bff', { roughness: 0.5 })); c.position.set(x * L.W * 0.4, top + 1.1, z * L.D * 0.4); toy.add(c);
    }
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
const lossRun = { lv: 0, n: 0 };   // stuck help: after 2 losses in a row on one toy, the tray gets +1 slot (stars unchanged)
function setupBoxes(L) {
  for (const b of boxes) if (b.group) hud.remove(b.group);
  for (const t of buffer) if (t && t.fl) t.fl.parent && t.fl.parent.remove(t.fl);
  K = L.K; queue = L.queue; qi = 0; boxes = []; const TT = L.T + (lossRun.lv === level && lossRun.n >= 2 ? 1 : 0); if (TRAY !== TT) { TRAY = TT; buildTray(); } buffer = new Array(TRAY).fill(null);
  for (let i = 0; i < K; i++) { boxes.push({ i, color: null, reserved: 0, filled: 0, active: false, group: null, items: [] }); nextBox(boxes[i], i * 90); }
  layoutHud();
}
// colour of the box that drops next. Struggling player: it may come from two places further down the queue (a player who keeps
// struggling: from anywhere in it), the one that takes the most bolts already waiting in the tray. Same boxes, same colours:
// only their order changes.
// Rescue (once a round, sensible play only): the tray is one bolt from full, so the box that matches the tray comes now.
const trayCount = (c) => buffer.filter((t) => t && t.color === c).length;
function bestAhead(from, to) { let j = -1, n = 0; for (let i = from; i < Math.min(queue.length, to); i++) { const m = trayCount(queue[i]); if (m > n && !boxes.some((x) => x.active && x.color === queue[i])) { n = m; j = i; } } return j; }
function adaptQueue() {
  if (qi >= queue.length || trayCount(queue[qi])) return;
  const used = buffer.filter(Boolean).length;
  let j = AD.level <= -0.3 ? bestAhead(qi + 1, AD.level <= -0.65 ? queue.length : qi + 3) : -1;
  if (j < 0 && used >= TRAY - 1 && AD.sensible()) { j = bestAhead(qi + 1, queue.length); if (j >= 0 && AD.rescue()) setTimeout(() => ui.pop('LUCKY BOX!', '#35c96a', 32, 30), 250); else j = -1; }
  if (j > 0) [queue[qi], queue[j]] = [queue[j], queue[qi]];
}
// rescue while no box is due: an empty box (nothing in it, nothing flying to it) leaves and the tray's colour drops in
function rescueSwap() {
  const used = buffer.filter(Boolean).length;
  if (state !== 'play' || used < TRAY - 1 || boxes.some((x) => x.active && trayCount(x.color)) || !AD.sensible()) return;
  const b = boxes.find((x) => x.active && x.group && !x.reserved && !x.filled), j = b ? bestAhead(qi, queue.length) : -1;
  if (j < 0 || !AD.rescue()) return;
  const c = queue[j]; queue[j] = b.color; queue.splice(qi, 0, c);
  b.active = false; const g = b.group, my = gen, y0 = g.position.y; ui.pop('LUCKY SWAP!', '#35c96a', 32, 30); tone(900, 0.08, 'triangle', 0.08, 1.4);
  anim(220, (k) => { g.position.y = y0 + k * k * 1.6; g.rotation.z = -k * 0.3; }).then(() => { if (gen !== my) return; hud.remove(g); b.group = null; nextBox(b); });
}
function nextBox(b, delay = 0) {
  if (qi >= queue.length) { b.color = null; b.active = false; return; }
  adaptQueue();
  b.color = queue[qi++]; nextChips(); b.reserved = 0; b.filled = 0; b.items = []; b.active = false;
  const g = makeBox(b.color); g.scale.setScalar(SLOT * 0.86); const p = boxPos(b.i); g.position.copy(p).add(new THREE.Vector3(0, 1.4, 0)); hud.add(g); b.group = g;
  anim(240, (k) => g.position.y = lerp(p.y + 1.4, p.y, k), easeBack, delay).then(() => { b.active = true; tone(700, 0.05, 'triangle', 0.06, 1.2); pullFromTray(b); });
}
function completeBox(b) {
  b.active = false; const g = b.group, my = gen;
  setTimeout(async () => {
    if (gen !== my) return;
    g.lid.visible = true; await anim(120, (k) => g.lid.position.y = lerp(1.2, 0.4, k), (k) => k * k);
    sfx.coin(); buzz(25); ui.flash(0.22); ui.pop('BOX FULL!', COLORS[b.color], 38, 52); const wp = g.getWorldPosition(new THREE.Vector3());
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
  tone(1100 + b.filled * 160, 0.05, 'square', 0.05, 1.1); b.filled++; b.items.push(fl); { const s1 = fl.scale.x; anim(160, (k) => fl.scale.setScalar(s1 * (1 + 0.45 * Math.sin(k * Math.PI)))); }
  if (b.filled < 3) { const g = b.group; anim(130, (k) => g.scale.setScalar(SLOT * 0.86 * (1 + 0.14 * Math.sin(k * Math.PI)))); }
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
  hudText(); if (used >= TRAY - 1) { ui.pop(used >= TRAY ? 'TRAY FULL!' : 'LAST SLOT!', '#ff4d5e', 30, 30); buzz(40); rescueSwap(); }
}
const allFlyers = [];
function makeFlyer(color) {
  const g = new THREE.Group(); allFlyers.push(g);
  const h = new THREE.Mesh(HEAD, headMats[color]); h.castShadow = true; const c = new THREE.Mesh(CROSS, crossMat); const sh = new THREE.Mesh(SHAFT_THREADED, metal);
  g.add(h, c, sh); g.shaft = sh; return g;
}


// ---------------------------------------------------------------- first-move coach (hook): a pulsing ring + hand on the exact next move, ≤ 6-word tips
// Real data: most quick quits tapped the start card once and never touched the toy. So there is no start card: the toy is live,
// and the next good bolt glows with a hand on it (level 1 every move, level 2 after 1.5 s idle, later after 4 s idle).
const coach = (() => {
  const st = document.createElement('style');
  st.textContent = `.cx-ring{position:fixed;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:5px solid #fff;box-shadow:0 0 0 5px rgba(255,255,255,.35),0 0 26px 6px rgba(255,255,255,.9);pointer-events:none;z-index:6;animation:cxr .8s ease-in-out infinite}
@keyframes cxr{0%,100%{transform:scale(.72);opacity:1}50%{transform:scale(1.12);opacity:.75}}
.cx-hand{position:fixed;font-size:50px;line-height:1;pointer-events:none;z-index:7;margin:-6px 0 0 -16px;filter:drop-shadow(0 4px 2px rgba(0,0,0,.25))}
.cx-hand.tap{animation:cxt .8s ease-in-out infinite}@keyframes cxt{0%,100%{transform:translate(10px,18px)}50%{transform:translate(0,0) scale(.92)}}
.cx-tip{position:fixed;left:50%;transform:translate(-50%,0);z-index:7;pointer-events:none;font-weight:800;font-size:26px;line-height:1.1;padding:7px 20px 4px;border-radius:26px;background:#fff;color:#2b3f8f;box-shadow:0 6px 0 rgba(0,0,0,.16);white-space:nowrap;animation:cxi .35s cubic-bezier(.3,1.6,.5,1)}
@keyframes cxi{from{transform:translate(-50%,0) scale(.4);opacity:0}}
.cx-off{display:none!important}`;
  document.head.appendChild(st);
  const mk = (c, t = '') => { const d = document.createElement('div'); d.className = c + ' cx-off'; d.textContent = t; document.body.appendChild(d); return d; };
  const ring = mk('cx-ring'), hand = mk('cx-hand tap', '👆'), tip = mk('cx-tip'); let tipT = 0, tipTxt = '';
  const at = (e, x, y) => { e.style.left = x + 'px'; e.style.top = y + 'px'; e.classList.remove('cx-off'); };
  return {
    point(x, y) { at(ring, x, y); at(hand, x + 8, y + 14); hand.classList.add('tap'); },
    swipe(x, y, t) { ring.classList.add('cx-off'); hand.classList.remove('tap'); at(hand, x + Math.sin(t * 3.2) * 80, y); },
    off() { ring.classList.add('cx-off'); hand.classList.add('cx-off'); },
    say(text, topPct, ms = 0) { if (text !== tipTxt) { tip.textContent = tipTxt = text; tip.classList.add('cx-off'); void tip.offsetWidth; } tip.style.top = topPct + '%'; tip.classList.remove('cx-off'); tipT = ms ? performance.now() + ms : 0; },
    quiet(force) { if (force || !tipT || performance.now() > tipT) { tip.classList.add('cx-off'); tipTxt = ''; tipT = 0; } },
    get timed() { return tipT && performance.now() < tipT; },
  };
})();
const seen = store('bolttwist_tips');
let lastTap = performance.now(), streak = 0, pulsed = null, firstMatchTip = false, ran = false;
addEventListener('pointerdown', () => { lastTap = performance.now(); if (!ran) { ran = true; B.start(); } }, true);
function nextMove() {   // the move a first-timer should make now (same preference as bot())
  if (boxes.some((b) => !b.active && b.color) && !boxes.some((b) => b.active)) return null;
  const sb = screenBolts(), m = sb.find((v) => v[2] === 0);
  if (m) return { kind: 'tap', x: m[0], y: m[1], id: m[3] };
  const live = screws.filter((s) => !s.gone && !blocked(s));
  if (live.some((s) => boxes.some((b) => b.active && b.color === s.color && b.reserved < 3))) return { kind: 'spin' };
  if (boxes.some((b) => !b.active && b.color) || flights.length || freeTray() < 0) return null;
  if (!sb.length) return live.length ? { kind: 'spin' } : null;
  const rank = (c) => { const i = queue.indexOf(c, qi); return i < 0 ? 1e9 : i; };
  const v = sb.slice().sort((a, b) => rank(screws[a[3]].color) - rank(screws[b[3]].color))[0];
  return { kind: 'tap', x: v[0], y: v[1], id: v[3], park: true };
}
function coachTick(t) {
  const unpulse = () => { if (pulsed && !pulsed.gone) setInst(pulsed, 1); pulsed = null; };
  if (state !== 'play') { coach.off(); coach.quiet(true); unpulse(); return; }
  const idle = (performance.now() - lastTap) / 1000, wait = level === 1 ? 0.15 : level === 2 ? 1.5 : 4;
  const mv = idle >= wait ? nextMove() : null;
  if (!mv) { coach.off(); unpulse(); if (!coach.timed) coach.quiet(); return; }
  if (mv.kind === 'spin') { unpulse(); coach.swipe(innerWidth / 2, innerHeight * 0.6, t); coach.say('Swipe to spin!', 37); return; }
  const s = screws[mv.id]; if (pulsed !== s) { unpulse(); pulsed = s; }
  setInst(s, 1 + 0.22 * Math.abs(Math.sin(t * 5)));
  coach.point(mv.x, mv.y);
  if (level === 1 && !cleared) coach.say('Tap the glowing bolt', 37);
  else if (mv.park && !seen.get('park', 0)) coach.say('No match? Park it', 37);
  else if (!coach.timed) coach.quiet();
}

// ---------------------------------------------------------------- tapping bolts
function blocked(s) {
  if (s.lockedBy != null && !screws[s.lockedBy].gone) return { lock: true };
  if (s.ice && cleared < s.ice) return { ice: true };
  const p = plates[s.plate]; return p.above.map((i) => plates[i]).find((q) => q.alive && contains(q, s.fx, s.fy, 0.12));
}
function tapScrew(s) {
  if (state !== 'play' || s.gone) return;
  const blk = blocked(s);
  tapAt = performance.now();
  if (blk) {
    s.wob = 1; tone(160, 0.1, 'square', 0.07, 0.8); buzz(30); if (blk.mesh) blk.wob = 1; AD.bad(0.5);
    if (blk.lock) { ui.pop('Needs its key!', '#ffb81c', 30, 40); const k = screws[s.lockedBy]; k.wob = 1; k.hint = performance.now() + 2500; }
    else if (blk.ice) ui.pop(`Frozen · ${s.ice - cleared} more bolts`, '#3fb8ff', 30, 40);
    return;
  }
  let b = boxes.filter((b) => b.active && b.color === s.color && b.reserved < 3).sort((a, c) => c.reserved - a.reserved)[0], j = -1;
  if (b) AD.good(); else if (screenBolts().some((v) => v[2] === 0)) AD.bad();   // parked a bolt while a matching one was in plain view
  if (!b) { j = freeTray(); if (j < 0) { ui.pop('TRAY FULL!', '#ff4d5e', 30, 30); buzz(60); AD.bad(0.5); return; } buffer[j] = { color: s.color, arrived: false }; parks++; starChip(); }
  // juice: sparks at the bolt, a streak counter for box matches in a row, a rising note per streak step
  burst(scene, toy.localToWorld(s.pos.clone()), [COLORS[s.color], '#ffffff', '#ffe36b'], b ? 12 : 6, { speed: 0.05, up: 0.05, size: 0.28, gravity: 0.003 });
  if (b) { streak++; ui.pop(streak === 1 ? 'Nice!' : streak < 4 ? `x${streak}!` : `x${streak} WOW!`, COLORS[s.color], 34 + Math.min(streak, 8) * 3, 52); tone(560 + Math.min(streak, 10) * 70, 0.09, 'triangle', 0.09, 1.3);
    if (level === 1 && !firstMatchTip) { firstMatchTip = true; setTimeout(() => state === 'play' && coach.say('Match the box colours!', 37, 2200), 120); } }
  else { if (streak > 1) ui.pop('Parked', '#ffffff', 28, 52); streak = 0; if (!seen.get('park', 0)) { seen.set('park', 1); coach.say('It waits in the tray', 37, 2400); } }
  const slot = b ? b.reserved++ : -1;
  s.gone = true; setInst(s, 0); cleared++; total++; ui.progress(cleared / screws.length); bestStreak = Math.max(bestStreak, streak);
  if (s.kind === 'key') unlockFor(s); marksTick(true);
  if (b && streak >= 5 && streak % 3 === 2) fever(streak);
  if (s.gold) { toy.remove(s.gold); s.gold = null; goldPin = givePin(); sfx.win(); buzz([30, 30, 60]); ui.flash(0.4); confetti(scene, new THREE.Vector3(0, 1.5, 0), 70); ui.pop(goldPin >= 0 ? `GOLDEN BOLT! ${PINS[goldPin]}` : 'GOLDEN BOLT!', '#ffc61a', 44, 40); for (let i = 0; i < 6; i++) setTimeout(() => tone(900 + i * 140, 0.08, 'triangle', 0.1, 1.2), i * 70); }
  hudText(); leftEl.classList.add('bump'); setTimeout(() => leftEl.classList.remove('bump'), 120);
  const fl = makeFlyer(s.color); scene.add(fl);
  fl.position.copy(toy.localToWorld(s.pos.clone())); fl.quaternion.copy(toy.getWorldQuaternion(new THREE.Quaternion()).multiply(s.q));
  if (j >= 0) buffer[j].fl = fl;
  const nW = new THREE.Vector3(0, 1, 0).applyQuaternion(fl.quaternion), p0 = fl.position.clone();
  for (let i = 0; i < 8; i++) setTimeout(() => tone(1100 + i * 80 + Math.min(streak, 8) * 40, 0.026, 'square', 0.05, 0.9), i * 62);   // a longer ratchet
  setTimeout(() => { tone(1900, 0.07, 'triangle', 0.08, 0.8); buzz(18); }, 500);   // the clink as it comes free   // ratchet clicks, higher on a streak
  buzz(12);
  // plates that lost their last bolt fall
  const p = plates[s.plate]; p.left--; setTimeout(settle, 500);
  const sc0 = fl.scale.x; anim(540, (k) => { fl.position.copy(p0).addScaledVector(nW, easeInOut(k) * 0.95); fl.rotateY(0.62 * (1 - k * 0.7) + 0.2); fl.rotateX(Math.sin(k * 26) * 0.045 * (1 - k)); fl.scale.setScalar(sc0 * (1 + 0.22 * Math.sin(k * Math.PI))); }, (k) => k).then(() => b ? flyTo(fl, b, slot) : flyToTray(fl, j));
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
const worldOf = (n) => Math.min(2, Math.floor((n - 1) / 10));
function startLevel() {
  gen++; tweens.length = 0; flights.length = 0;
  for (const f of fallers) scene.remove(f.m); fallers = [];
  for (const f of allFlyers) f.parent && f.parent.remove(f); allFlyers.length = 0;
  const bg = WORLDS[worldOf(level)].bg; document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]); document.body.style.setProperty('--ui', '#3a7bff');
  L = design(level); buildToy(L); setupBoxes(L); AD.round(); applyPaint();
  ground.position.y = -L.H / 2 - 0.01; toy.position.y = 0;
  toyT0 = performance.now(); cleared = 0; streak = 0; parks = 0; bestStreak = 0; curPar = L.par + (L.S.length >= 18 ? 1 : 0);   // big toys: one park of slack for 3 stars
  lastTap = performance.now(); rotY = level === 1 ? -0.25 : -0.55; rotV = 0; tilt = 0.12; botFace = null;
  ui.levels(level); ui.progress(0); hudText(); starChip(); nextChips(); resEl.classList.add('hc-hidden'); mapEl.classList.add('hc-hidden');
  if (level > 1) {
    const first = (level - 1) % 10 === 0 && level <= 30;
    if (first) { const w = WORLDS[worldOf(level)]; setTimeout(() => state === 'play' && ui.pop(`${w.icon} ${w.name}`, '#ffffff', 40, 30), 150); }
    setTimeout(() => { if (state === 'play' && !cleared) coach.say((L.hard ? '' : '') + (L.name || ''), 35, 3400); }, first ? 1400 : 250);
  }
}
const starHtml = (n) => '⭐'.repeat(n) + '<span style="opacity:.35;filter:grayscale(1)">⭐</span>'.repeat(3 - n);
const THEME_NAME = { crate: 'Toy Crate', house: 'Toy House', robot: 'Robo Buddy', gift: 'Gift Box', rocket: 'Rocket', castle: 'Castle' };
const starsFor = (pk, par) => pk <= par ? 3 : pk <= par + 3 ? 2 : 1;
function win() {
  lossRun.n = 0;
  if (state === 'play') FL.level(true);
  const first = level === unlocked;
  if (state === 'play' && first) B.submit(1);
  state = 'won'; wonAt = performance.now(); save.set('bolts', total); played++; prog.set('played', played);
  const st = starsFor(parks, curPar), before = starsOf[level] || 0, oldTotal = sumStars();
  const newSticker = !before; if (st > before) { starsOf[level] = st; prog.set('stars', starsOf); }
  if (level === unlocked) { unlocked = level + 1; prog.set('unlocked', unlocked); }
  const nowTotal = sumStars(), gained = PAINTS.map((p, i) => i).filter((i) => PAINTS[i].at > oldTotal && PAINTS[i].at <= nowTotal);
  if (gained.length) { paintOn = gained[gained.length - 1]; prog.set('paint', paintOn); applyPaint(); }
  sfx.win(); buzz([30, 40, 60]); ui.flash(0.5); confetti(scene, new THREE.Vector3(0, 1.5, 0), 90);
  const secs = Math.round((performance.now() - toyT0) / 100) / 10, pb = bests[level], newBest = !pb || secs < pb; if (newBest) { bests[level] = secs; prog.set('best', bests); }
  const chest = played % 3 === 0 ? givePin() : -2;
  hudText(); showResult({ st, before, newSticker, gained, oldTotal, nowTotal, secs, pb, newBest, chest });
}
function lose() {
  if (state === 'play') AD.bad(2); if (state === 'play') FL.level(false, screws.length ? screws.filter((s) => s.gone).length / screws.length : 0);
  state = 'lost'; sfx.fail(); buzz([60, 40, 90]); lossRun.n = lossRun.lv === level ? lossRun.n + 1 : 1; lossRun.lv = level;
  const left = screws.filter((s) => !s.gone).length;
  const open = boxes.filter((b) => b.active).map((b) => b.color), stuck = [...new Set(buffer.filter(Boolean).map((t) => t.color))].filter((c) => !open.includes(c)), nm = (c) => c;
  const why = stuck.length ? `${stuck.slice(0, 2).map(nm).join(' + ')} had no box open: spin for a bolt that matches` : 'Match the box colours.';
  ui.lose(left <= 3 ? `SO CLOSE · ${left} left` : 'TRAY FULL!', (left <= 3 ? `Park less: ${why}` : why) + (lossRun.n === 2 ? ' · +1 tray slot to help' : '')); hudText();
}
ui.onTap((which) => { B.start(); if (which === 'start') { state = 'play'; hudText(); return; } startLevel(); state = 'play'; hudText(); });
function play(n) { level = n; startLevel(); state = 'play'; hudText(); }

// ---------------------------------------------------------------- meta: result card, star chip, next-box chips, toy map (stickers) + paints
const css2 = document.createElement('style');
css2.textContent = `.hc-card.dim{padding-top:calc(40vh + env(safe-area-inset-top))!important}
.cx-tip{white-space:normal!important;max-width:88vw;font-size:22px!important}
.bt-stars{position:fixed;left:50%;transform:translateX(-50%);text-align:center;bottom:calc(9vh - 42px + env(safe-area-inset-bottom));z-index:5;pointer-events:none;font-weight:800;font-size:22px;letter-spacing:1px;color:#ffc61a;text-shadow:0 2px 0 rgba(0,0,0,.2);transition:transform .15s}
.bt-stars.drop{transform:translateX(-50%) scale(1.35);color:#ff8a2a}
.bt-stars small{display:block;font-size:12px;letter-spacing:0;color:#fff;opacity:.9}
.bt-next{position:fixed;right:12px;top:calc(62px + env(safe-area-inset-top));z-index:5;pointer-events:none;display:flex;gap:5px;align-items:center;font-weight:800;font-size:11px;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.3)}
.bt-next i{width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.bt-map-btn{position:fixed;right:12px;top:calc(14px + env(safe-area-inset-top));z-index:6;width:44px;height:44px;border-radius:14px;border:0;background:rgba(255,255,255,.85);font-size:24px;box-shadow:0 4px 0 rgba(0,0,0,.18)}
.bt-res,.bt-map{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;color:#24335e;font-family:inherit;text-align:center}
.bt-res{justify-content:flex-start;padding:calc(90px + env(safe-area-inset-top)) 18px 30px;gap:10px;background:rgba(255,255,255,.28)}
.bt-res h1{margin:0;font-size:clamp(38px,11vw,60px);font-weight:800;line-height:.95;color:#fff;text-shadow:0 5px 0 rgba(0,0,0,.2)}
.bt-res .sub{font-size:19px;font-weight:700;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.bt-res .st{font-size:64px;letter-spacing:4px;line-height:1;color:#ffc61a;text-shadow:0 5px 0 rgba(0,0,0,.2)}
.bt-res .st span{display:inline-block;opacity:0;transform:scale(3) rotate(-30deg)}.bt-res .st span.on{opacity:1;transform:none;transition:transform .35s cubic-bezier(.3,1.7,.5,1),opacity .15s}.bt-res .st span.off{opacity:.5;filter:grayscale(1);transform:none}
.bt-res .chip{background:#fff;border-radius:18px;padding:8px 16px;font-weight:800;font-size:17px;box-shadow:0 4px 0 rgba(0,0,0,.14);animation:cxi .4s cubic-bezier(.3,1.6,.5,1)}
.bt-res .row{display:flex;gap:12px;margin-top:auto;margin-bottom:6vh;align-items:center}
.bt-btn{border:0;border-radius:26px;font-weight:800;font-family:inherit;color:#fff;background:#3cc46a;box-shadow:0 6px 0 #2a9a50;font-size:28px;padding:15px 44px;animation:hcpulse 1.4s ease-in-out infinite}
.bt-btn.sm{font-size:24px;padding:13px 20px;background:#fff;color:#3a7bff;box-shadow:0 5px 0 rgba(0,0,0,.16);animation:none}
.bt-map{justify-content:flex-start;background:linear-gradient(#cfe6ff,#f4f9ff);overflow:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 30px;gap:6px}
.bt-map h2{margin:6px 0 0;font-size:22px;font-weight:800}.bt-map .wn{font-size:13px;opacity:.8;margin-bottom:4px}
.bt-map .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;width:min(94vw,440px)}
.bt-node{position:relative;aspect-ratio:1;border-radius:18px;border:0;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,.14);font-weight:800;font-size:22px;color:#3a5b9f;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.bt-node small{font-size:10px;color:#ffb81c;letter-spacing:0;margin-top:2px;min-height:11px}.bt-node.lock{opacity:.45;box-shadow:none}.bt-node.hard{outline:3px solid #ff4d5e}
.bt-node.next{background:#3cc46a;color:#fff;animation:hcpulse 1s ease-in-out infinite}.bt-node.done{background:#fff7d6}
.bt-node em{font-style:normal;font-size:26px}
.bt-paints{display:flex;gap:8px;margin:2px 0 6px}.bt-paint{width:42px;height:42px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.18);font-size:10px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center}
.bt-paint.on{outline:3px solid #3cc46a}.bt-paint.lk{filter:grayscale(1);opacity:.5}
.bt-close{position:sticky;top:0;align-self:flex-end;border:0;background:#fff;border-radius:50%;width:40px;height:40px;font-size:20px;box-shadow:0 3px 0 rgba(0,0,0,.16)}`;
document.head.appendChild(css2);
const mk2 = (cls, tag = 'div') => { const d = document.createElement(tag); d.className = cls; document.body.appendChild(d); return d; };
const starEl = mk2('bt-stars hc-hidden'), nextEl = mk2('bt-next hc-hidden'), resEl = mk2('bt-res hc-hidden'), mapEl = mk2('bt-map hc-hidden'), mapBtn = mk2('bt-map-btn', 'button');
mapBtn.textContent = '🗺️'; mapBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); openMap(); });
for (const el of [resEl, mapEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
function starChip() {
  const n = starsFor(parks, curPar), shown = starHtml(n);
  const was = starEl.dataset.n; starEl.dataset.n = n;
  starEl.innerHTML = `${shown}<small>${n === 3 ? `park ${curPar} or less` : `parked ${parks}`}</small>`;
  starEl.classList.toggle('hc-hidden', state !== 'play' && state !== 'ready');
  if (was && +was > n) { starEl.classList.add('drop'); setTimeout(() => starEl.classList.remove('drop'), 260); }
}
function nextChips() {
  const q = queue.slice(qi, qi + 3);
  nextEl.innerHTML = q.length ? `NEXT ${q.map((c) => `<i style="background:${COLORS[c]}"></i>`).join('')}` : '';
  nextEl.classList.toggle('hc-hidden', state !== 'play' || !q.length);
}
function showResult({ st, before, newSticker, gained, oldTotal, nowTotal, secs, pb, newBest, chest }) {
  const w = WORLDS[worldOf(level)], icon = THEME_ICON[L.theme] || '📦', nextPaint = PAINTS.find((p) => p.at > nowTotal);
  const near = st < 3 ? `${st === 2 ? 'So close!' : 'Cleared!'} Park ${curPar} or fewer for 3 stars (you parked ${parks})` : parks === 0 && curPar === 0 ? 'Perfect: not one bolt parked!' : 'Three stars!';
  const foot = [bestStreak >= 5 ? `🔥 x${bestStreak}` : '', pb && !newBest ? `⏱ ${secs}s · best ${pb}s` : pb ? `⏱ ${secs}s · NEW BEST` : `⏱ ${secs}s`, `📌 ${pins.length}/${PINS.length}${pins.length === PINS.length - 1 ? ' · 1 missing!' : ''}`, `⭐ ${nowTotal}${nextPaint ? ` · paint at ${nextPaint.at}` : ''}`].filter(Boolean).join('  ·  ');
  const bar = `<span style="display:inline-block;width:90px;height:10px;border-radius:5px;background:#ddd;vertical-align:middle"><i style="display:block;height:10px;border-radius:5px;background:#ffb81c;width:${(played % 3) * 33}%"></i></span>`;
  const extra = [
    chest >= 0 ? `<div class="chip" style="font-size:24px;padding:12px 22px;background:#fff3b0">🎁 Chest opened! ${PINS[chest]}</div>` : goldPin >= 0 ? `<div class="chip" style="font-size:22px;padding:10px 20px;background:#fff3b0">✨ Golden bolt! ${PINS[goldPin]}</div>` : chest === -2 ? `<div class="chip">🎁 ${bar} ${played % 3}/3</div>` : '',
    newSticker ? `<div class="chip">${icon} New sticker: ${THEME_NAME[L.theme] || 'toy'} ${level}</div>` : '',
    ...gained.map((i) => `<div class="chip">🎨 New bolt paint: ${PAINTS[i].name}!</div>`),
    `<div class="chip" style="font-size:14px;opacity:.85">${foot}</div>`,
  ].join('');
  resEl.innerHTML = `<div class="sub">${w.icon} ${w.name} · toy ${level}</div><h1>${L.hard ? 'BIG TOY<br>CLEARED!' : 'TOY<br>CLEARED!'}</h1><div class="st"><span>⭐</span><span>⭐</span><span>⭐</span></div><div class="sub">${near}</div>${extra}
    <div class="row"><button class="bt-btn sm" data-a="map">🗺️</button><button class="bt-btn" data-a="next">${level + 1} ▶</button><button class="bt-btn sm" data-a="again">🔁</button></div>`;
  setTimeout(() => {
    if (state !== 'won') return; resEl.classList.remove('hc-hidden');
    [...resEl.querySelectorAll('.st span')].forEach((e, i) => setTimeout(() => { e.classList.add(i < st ? 'on' : 'off'); if (i < st) { tone(660 + i * 220, 0.12, 'triangle', 0.12, 1.2); buzz(15); if (i === 2) { sfx.coin(); confetti(scene, new THREE.Vector3(0, 1.5, 0), 50); } } }, 250 + i * 330));
  }, 1000);
}
resEl.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (!a) return; B.start(); if (a.dataset.a === 'map') openMap(); else play(a.dataset.a === 'next' ? level + 1 : level); });
function openMap() {
  const total_ = sumStars(), cur = Math.min(unlocked, Math.max(unlocked, 1));
  let h = `<button class="bt-close" data-a="close">❌</button><h2>⭐ ${total_} · stickers ${Object.keys(starsOf).filter((k) => +k <= 30).length}/30</h2><div class="bt-paints">`;
  PAINTS.forEach((p, i) => { const ok = total_ >= p.at; h += `<div class="bt-paint ${i === paintOn ? 'on' : ''} ${ok ? '' : 'lk'}" data-p="${i}" style="background:linear-gradient(135deg,#ff4d5e,#3a8dff,#35c96a)">${ok ? p.name.slice(0, 5) : p.at + '⭐'}</div>`; });
  h += `</div><div class="wn">📌 ${PINS.map((p, i) => pins.includes(i) ? p : '▫️').join(' ')}</div>`;
  WORLDS.forEach((w, wi) => {
    h += `<h2>${w.icon} ${w.name}</h2><div class="wn">${w.note}</div><div class="grid">`;
    for (let n = wi * 10 + 1; n <= wi * 10 + 10; n++) {
      const spec = LEVELS[n - 1], st = starsOf[n] || 0, ok = n <= unlocked;
      h += `<button class="bt-node ${ok ? '' : 'lock'} ${n === unlocked ? 'next' : st ? 'done' : ''} ${spec.hard ? 'hard' : ''}" data-n="${n}">${st ? `<em>${THEME_ICON[spec.theme]}</em>` : ok ? n : '🔒'}<small>${st ? starHtml(st) : spec.hard ? 'HARD' : ''}</small></button>`;
    }
    h += '</div>';
  });
  if (unlocked > 30) h += `<h2>∞ Bonus toys</h2><div class="grid"><button class="bt-node next" data-n="${unlocked}">${unlocked}<small></small></button></div>`;
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden'); resEl.classList.add('hc-hidden');
  const nx = mapEl.querySelector('.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 30);
}
mapEl.addEventListener('click', (e) => {
  const t = e.target.closest('[data-n],[data-p],[data-a]'); if (!t) return; B.start();
  if (t.dataset.a === 'close') { mapEl.classList.add('hc-hidden'); if (state === 'won') resEl.classList.remove('hc-hidden'); return; }
  if (t.dataset.p !== undefined) { const i = +t.dataset.p; if (sumStars() >= PAINTS[i].at) { paintOn = i; prog.set('paint', i); applyPaint(); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(); } return; }
  const n = +t.dataset.n; if (n <= unlocked) play(n);
});

// ---------------------------------------------------------------- input: drag to spin, tap a bolt
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({
  onMove(dx, dy) { if (state !== 'play') return; rotY += dx * 0.009; rotV = dx * 0.009; tilt = clamp(tilt + dy * 0.004, -0.2, 0.6); botFace = null; },
  onTap(e) {
    if (state !== 'play') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([headIM, core, ...plates.filter((p) => p.alive).map((p) => p.mesh)], false);
    const h = hits[0];
    if (h && h.object === headIM && h.instanceId !== undefined) return tapScrew(screws[h.instanceId]);
    // fat-finger on screen: the nearest free bolt within a thumb's width of the tap (bolts are small on a phone)
    let near = null, nd = level <= 2 ? 64 : 46; for (const v of screenBolts()) { const d = Math.hypot(v[0] - e.clientX, v[1] - e.clientY); if (d < nd) { nd = d; near = screws[v[3]]; } }
    if (near) return tapScrew(near);
    if (!h) return;
    // fat-finger: nearest live bolt to the hit point
    let best = null, bd = 0.45; const lp = toy.worldToLocal(h.point.clone());
    for (const s of screws) if (!s.gone) { const d = s.pos.distanceTo(lp); if (d < bd) { bd = d; best = s; } }
    if (best) tapScrew(best);
  },
});

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the glowing bolt unscrews itself into its matching box twice (never a parked bolt), so the toy shows what a tap does
demo(() => { const m = nextMove(); if (!m || m.kind !== 'tap' || m.park) return false; tapScrew(screws[m.id]); },
  { ready: () => state === 'play' && level === 1 && !flights.length && cleared + 3 < screws.length, wait: 1800, every: 1500, max: 2 });

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
  runTweens(); hud.visible = state !== 'won'; if (toy) marksFrame(t, dt); if (state === 'play') AD.tick(performance.now() - tapAt < 6000); coachTick(t);
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
ui.hideStart(); state = 'play'; hudText();   // no start card (hook): the first tap is a real move
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
window.__game = { get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; }, get state() { return state; }, get level() { return level; }, get score() { return total; }, bot, design, screenBolts, get stars() { return starsOf; }, get unlocked() { return unlocked; }, get parks() { return parks; }, get par() { return curPar; }, get marks() { return screws.map((s) => [s.id, s.kind, s.lockedBy, s.ice]); }, play, openMap, dbg: () => ({ left: screws.filter((s) => !s.gone).map((s) => [s.id, s.color, s.face, !!blocked(s)]), boxes: boxes.map((b) => [b.color, b.active, b.reserved, b.filled]), buffer: buffer.map((b) => b && [b.color, b.arrived]), qi, queue, flights: flights.length, plates: plates.map((p) => [p.id, p.alive, p.left, p.above]) }), load(n) { ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); play(n); } };

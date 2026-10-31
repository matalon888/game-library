// Blokko deep v2 — same game as v1 (a chunky 3D shape of arrow cubes; spin it, tap a cube to slide it out if its road is clear),
// with 36 hand-shaped levels in 3 worlds, gold / hidden / bomb / stone cubes, par taps and stars, a level map, a collection of
// cube skins, hints, a daily shape and combos. Rules live in logic.js, the shapes in levels.js. Plan: DESIGN.md.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { LEVELS, WORLDS, COUNT } from './levels.js';
import { gen, world, parSearch, DIRS as DA } from './logic.js';

const NAME = 'Blokko: 3D Block Puzzle';
const S = store('blokko2');
const F = flow('blokko');
const B = board({ game: 'blokko', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum' });   // levels cleared today, same scale as v1
const stage = createStage({ fov: 36, shadowSize: 7 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'BLOKKO', score: false, hand: '' });
ui.hideStart();
const DIRS = DA.map(a => new THREE.Vector3(...a));
const MAXC = 64;

// ---------------------------------------------------------------- save
let stars = S.get('stars', {}), coins = S.get('coins', 3), hints = S.get('hints', 2), skinId = S.get('skin', 'candy');
let dayInfo = S.get('day', { d: 0, streak: 0, done: 0 });
let flaw = S.get('flaw', 0), flawBest = S.get('flawBest', 0);
const saveAll = () => { S.set('flaw', flaw); S.set('flawBest', flawBest); S.set('stars', stars); S.set('coins', coins); S.set('hints', hints); S.set('skin', skinId); S.set('day', dayInfo); };
const totalStars = () => Object.values(stars).reduce((a, b) => a + b, 0);
const cleared = n => (stars[n] || 0) > 0;
const nextLevel = () => { for (let n = 1; n <= COUNT; n++) if (!cleared(n)) return n; return COUNT + 1; };
const unlocked = n => n === 1 || cleared(n - 1) || cleared(n) || n > COUNT;
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayIdx = () => Math.floor(Date.now() / 864e5);

const SKINS = [
  { id: 'candy', name: 'Candy', a: '#ff7ab8', b: '#ffa6d0', need: 0 },
  { id: 'mint', name: 'Mint Fizz', a: '#2fbf99', b: '#7de8c8', need: 6 },
  { id: 'sun', name: 'Sunrise', a: '#ff8a3d', b: '#ffbf6b', need: 14 },
  { id: 'ocean', name: 'Deep Sea', a: '#2e86ff', b: '#6fc4ff', need: 24 },
  { id: 'berry', name: 'Berry', a: '#8a4dff', b: '#c39bff', need: 36 },
  { id: 'ink', name: 'Midnight', a: '#2c3160', b: '#4b5499', arrow: '#ffd23f', need: 50 },
  { id: 'rain', name: 'Rainbow', rainbow: true, need: 68 },
  { id: 'gold', name: 'Gold Rush', a: '#e8a400', b: '#ffd24d', arrow: '#6b3d00', need: 90 },
];
const skin = () => SKINS.find(s => s.id === skinId) || SKINS[0];

// ---------------------------------------------------------------- icons (drawn, no font needed)
const IC = {
  star: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 18.2 5.6 21.6 7 14.5 1.7 9.5l7.2-.9z" fill="${c}"/></svg>`,
  heart: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" fill="${c}"/></svg>`,
  coin: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${c}"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/></svg>`,
  bulb: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6M10 18h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>`,
  redo: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/></svg>`,
  map: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}"><rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/><rect x="13" y="13" width="8" height="8" rx="2.4"/></svg>`,
  lock: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3" fill="${c}"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="${c}" stroke-width="2.4"/></svg>`,
  flame: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-7 1-10z" fill="${c}"/></svg>`,
  cal: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3.5" fill="${c}"/><rect x="3" y="5" width="18" height="5" rx="2.5" fill="rgba(0,0,0,.25)"/><rect x="7" y="2" width="2.6" height="5" rx="1.3" fill="${c}"/><rect x="14.4" y="2" width="2.6" height="5" rx="1.3" fill="${c}"/></svg>`,
  cube: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l9 5v10l-9 5-9-5V7z" fill="${c}"/><path d="M12 12l9-5M12 12L3 7M12 12v10" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none"/></svg>`,
};
const starsRow = (n, size = 18, on = '#ffd23f', off = 'rgba(255,255,255,.4)') => [0, 1, 2].map(i => IC.star(i < n ? on : off, size)).join('');

// ---------------------------------------------------------------- meshes (like v1, plus glyph quads for ? / bomb / stone)
const pivot = new THREE.Group(); scene.add(pivot);
function roundedCube(size = 0.92, r = 0.13, seg = 6) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg), p = g.attributes.position, h = size / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(clamp(v.x, -h, h), clamp(v.y, -h, h), clamp(v.z, -h, h)); v.sub(c).normalize().multiplyScalar(r).add(c); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
const cubes = new THREE.InstancedMesh(roundedCube(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0.02 }), MAXC);
cubes.castShadow = true; cubes.receiveShadow = true; pivot.add(cubes);
function arrowGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.14, -0.34); s.lineTo(0.14, -0.34); s.lineTo(0.14, -0.04); s.lineTo(0.34, -0.04); s.lineTo(0, 0.38); s.lineTo(-0.34, -0.04); s.lineTo(-0.14, -0.04); s.closePath();
  return new THREE.ShapeGeometry(s);
}
const decMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const arrows = new THREE.InstancedMesh(arrowGeo(), decMat, MAXC * 4); pivot.add(arrows);
const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.15, 4), decMat, MAXC); pivot.add(dots);
function glyphTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const qTex = glyphTex(g => { g.fillStyle = '#fff'; g.font = '800 104px "Baloo 2",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = 'rgba(40,20,90,.55)'; g.lineWidth = 10; g.strokeText('?', 64, 70); g.fillText('?', 64, 70); });
const bombTex = glyphTex(g => {
  g.fillStyle = '#ff7a2f'; g.beginPath(); g.arc(64, 74, 36, 0, 7); g.fill();
  g.fillStyle = '#ffd7a8'; g.beginPath(); g.arc(52, 62, 9, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(80, 42); g.quadraticCurveTo(92, 26, 104, 30); g.stroke();
  g.fillStyle = '#ffe14d'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 7 : 15; g.lineTo(106 + Math.cos(a) * r, 30 + Math.sin(a) * r); } g.fill();
});
const crackTex = glyphTex(g => {
  g.strokeStyle = 'rgba(40,44,58,.8)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(34, 24); g.lineTo(60, 56); g.lineTo(46, 78); g.lineTo(76, 104); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.moveTo(60, 56); g.lineTo(92, 50); g.moveTo(76, 104); g.lineTo(98, 96); g.stroke();
});
const glyphMesh = (tex, n, size) => { const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), n); pivot.add(m); m.renderOrder = 2; return m; };
const qMesh = glyphMesh(qTex, MAXC * 6, 0.66), bombMesh = glyphMesh(bombTex, MAXC, 0.66), crackMesh = glyphMesh(crackTex, MAXC * 6, 0.8);
for (const m of [cubes, arrows, dots, qMesh, bombMesh, crackMesh]) m.frustumCulled = false;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.12 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false }));
glow.rotation.x = -Math.PI / 2; scene.add(glow);
const waveGeo = new THREE.RingGeometry(0.82, 1, 40);
const waves = [];
function shockwave(localPos, color = '#ffd27a', size = 4.2) {
  const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  m.position.copy(localPos).applyMatrix4(pivot.matrixWorld); m.renderOrder = 9; m.userData.size = size; scene.add(m); waves.push({ m, t: 0 });
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _w = new THREE.Color('#ffffff');
const FACE = 0.465;
function decals(d) {
  const out = [];
  for (const n of DIRS) {
    if (Math.abs(n.dot(d)) > 0.5) continue;
    const X = new THREE.Vector3().crossVectors(d, n), M = new THREE.Matrix4().makeBasis(X, d, n);
    M.setPosition(n.clone().multiplyScalar(FACE)); out.push(M);
  }
  const up = Math.abs(d.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), ring = new THREE.Matrix4();
  ring.makeBasis(new THREE.Vector3().crossVectors(up, d), up, d); ring.setPosition(d.clone().multiplyScalar(FACE));
  return { arrows: out, ring };
}
function faceMats() {   // a flat quad on each of the 6 faces of a cube
  return DIRS.map(n => { const up = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0); const M = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, n), up, n); M.setPosition(n.clone().multiplyScalar(FACE + 0.004)); return M; });
}
const FACES = faceMats();

// ---------------------------------------------------------------- state
const GOLD = new THREE.Color('#ffc928'), BOMBC = new THREE.Color('#2f2a3d'), STONEC = new THREE.Color('#8b909e'), HIDDENT = new THREE.Color('#7b66ff');
let state = 'ready', blocks = [], W = null, dims = [2, 2, 2], hearts = 3, maxHearts = 3, removedN = 0, total = 0, combo = 0, lastClear = 0;
let retryHelp = false;
let cur = null;                       // the level being played: { n, L, cells, dims, par, slack, mode }
let taps = 0, miss = 0, coinsGot = 0, frenzy = 0, hitstop = 0, slow = 0, shake = 0, idleT = 0, hintT = 0, guide = null;
let yaw = 0.6, pitch = 0.45, vyaw = 0, vpitch = 0, camDist = 12, botSpin = 0, recorded = false, startedAt = 0, ended = false;
const fx = [];                         // timed callbacks { t, fn }
const later = (s, fn) => fx.push({ t: s, fn });

function cubeColor(b) {
  const k = skin(), alt = (b.c.x + b.c.y + b.c.z) % 2;
  if (b.t === 'g') return GOLD.clone();
  if (b.t === 'b') return BOMBC.clone();
  if (b.t === 's') return STONEC.clone().offsetHSL(0, 0, (b.id % 3) * 0.015);
  let col;
  if (k.rainbow) col = new THREE.Color().setHSL(((b.c.x * 0.13 + b.c.y * 0.19 + b.c.z * 0.11) % 1 + 1) % 1, 0.7, alt ? 0.66 : 0.6);
  else col = new THREE.Color(alt ? k.b : k.a);
  if (b.t === 'h' && !b.revealed) col.lerp(HIDDENT, 0.42);
  return col;
}
const arrowColor = b => b.t === 'g' ? '#7a4600' : b.t === 'b' ? '#ff8a4c' : skin().arrow || '#ffffff';

function levelData(n, opts = {}) {
  if (opts.daily) {
    const base = LEVELS[12 + (dayNum() % 24)]; let seed = dayNum() % 100000, g = null;
    while (!(g = gen(base.shape, seed))) seed++;
    return { n: 0, L: base, g, par: parSearch(g, 160).par, slack: /B/.test(base.shape) ? 1 : 0, mode: 'daily', name: 'Daily · ' + base.name };
  }
  if (n <= COUNT) {
    const L = LEVELS[n - 1], g = gen(L.shape, L.seed);
    return { n, L, g, par: L.par, slack: /B/.test(L.shape) ? 1 : 0, mode: 'level', name: L.name };
  }
  const L = LEVELS[11 + ((n * 7) % 25)]; let seed = n * 131, g = null;   // remix: the authored shapes of worlds 2-3 with fresh arrows
  while (!(g = gen(L.shape, seed))) seed++;
  return { n, L, g, par: parSearch(g, 160).par, slack: /B/.test(L.shape) ? 1 : 0, mode: 'remix', name: 'Remix · ' + L.name };
}

function build(n, opts = {}) {
  closeCards(); if (feverEl) { feverEl.remove(); feverEl = null; }
  cur = levelData(n, opts); const g = cur.g;
  dims = g.dims; W = world(g.cells, g.dims); blocks = [];
  const wi = cur.mode === 'daily' ? 2 : cur.mode === 'remix' ? ((n - 1) % 3) : cur.L.w, wd = WORLDS[wi];
  applyPalette({ bg: wd.bg, ui: wd.ui });
  document.body.style.setProperty('--acc', wd.accent);
  const off = new THREE.Vector3((dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2);
  g.cells.forEach((c, i) => {
    const d = DIRS[c.d], home = new THREE.Vector3(c.x, c.y, c.z).sub(off);
    const b = { i, id: i, c, t: c.t, d, di: c.d, home, pos: home.clone(), fd: d.clone(), dec: decals(d), state: 'idle', t0: 0, v: 0, bumpTo: 0, flash: 0, sc: 0, delay: i * 0.012, revealed: c.t !== 'h', pop: 0, hint: 0, sparkle: Math.random() * 2, delayBlast: 0 };
    b.col = cubeColor(b); blocks.push(b);
  });
  cubes.count = blocks.length;
  total = blocks.filter(b => b.t !== 's').length;
  hearts = maxHearts = clamp(Math.round(3 / F.k()), 2, 4); if (cur.n === 1 && cur.mode === 'level') hearts = maxHearts = 3; else if (cur.mode === 'level' && cur.n <= 12) hearts = maxHearts = maxHearts + (cur.n <= 10 ? 2 : 1);
  removedN = 0; taps = 0; miss = 0; coinsGot = 0; combo = 0; frenzy = 0; recorded = false; ended = false; hitstop = 0; slow = 0; idleT = 0; hintT = 0; guide = null; startedAt = performance.now();
  const md = Math.max(...dims), rad = 0.5 * Math.hypot(...dims) + 0.3; camDist = Math.max(9, rad / 0.165 + 1);
  yaw = 0.62; pitch = 0.42; vyaw = 0.02; vpitch = 0;
  floor.position.y = -md * 0.75 - 1.1; glow.position.y = floor.position.y + 0.01; glow.scale.setScalar(md * 0.55 + 1.3);
  ui.levels(cur.n || '·'); ui.progress(0);
  state = 'play';
  hudUpdate(); bannerFor();
  B.start();
}

// ---------------------------------------------------------------- HUD + DOM
const CSS = `
.bk-hud{position:fixed;inset:0;pointer-events:none;z-index:6}
.bk-top{position:absolute;top:calc(56px + env(safe-area-inset-top));left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.bk-name{font-weight:800;font-size:15px;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.14);letter-spacing:.3px}
.bk-name small{font-weight:600;opacity:.8;margin-left:6px}
.bk-hearts{display:flex;gap:5px;height:26px}
.bk-hearts svg{filter:drop-shadow(0 2px 0 rgba(0,0,0,.18));transition:transform .2s}
.bk-hearts .gone{opacity:.28}
.bk-hearts .hit{animation:bkshake .4s}
@keyframes bkshake{20%{transform:translateX(-5px) scale(1.2)}50%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
.bk-info{font-weight:800;font-size:14px;display:flex;gap:10px;align-items:center;background:rgba(0,0,0,.16);border-radius:14px;padding:2px 12px}
.bk-info b{font-size:16px}
.bk-btn{pointer-events:auto;position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.88);border:0;box-shadow:0 4px 0 rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.bk-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.18)}
.bk-btn .n{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;border-radius:10px;background:var(--acc,#ff7ab8);color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;padding:0 5px}
.bk-btn.wig{animation:bkwig 1s ease-in-out infinite}
@keyframes bkwig{0%,60%,100%{transform:rotate(0)}70%{transform:rotate(-12deg)}80%{transform:rotate(12deg)}90%{transform:rotate(-8deg)}}
.bk-btn.off{opacity:.5}
.bk-map{left:14px;top:calc(76px + env(safe-area-inset-top));width:44px;height:44px}
.bk-hint{left:18px;bottom:calc(22px + env(safe-area-inset-bottom))}
.bk-redo{right:18px;bottom:calc(22px + env(safe-area-inset-bottom))}
.bk-coins{position:absolute;right:14px;top:calc(14px + env(safe-area-inset-top));display:flex;align-items:center;gap:5px;font-weight:800;font-size:19px;background:rgba(0,0,0,.18);border-radius:18px;padding:2px 12px 2px 8px;text-shadow:0 2px 0 rgba(0,0,0,.14)}
.bk-coins.bump{animation:bkbump .3s}
@keyframes bkbump{50%{transform:scale(1.25)}}
@keyframes bkpulse{to{transform:scale(1.06)}}
.bk-stars{position:absolute;left:0;right:0;bottom:calc(30px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:4px;align-items:center}
.bk-stars .lbl{font-weight:800;font-size:13px;opacity:.9;margin:0 8px;text-shadow:0 2px 0 rgba(0,0,0,.14)}
.bk-banner{position:absolute;left:50%;top:calc(150px + env(safe-area-inset-top));transform:translateX(-50%);text-align:center;font-weight:800;pointer-events:none;animation:bkban 3.2s ease-out forwards;width:min(88vw,420px)}
.bk-banner h2{margin:0;font-size:30px;text-shadow:0 4px 0 rgba(0,0,0,.16)}
.bk-banner p{margin:2px 0 0;font-size:16px;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.14)}
.bk-banner .tag{display:inline-block;background:var(--acc,#ff7ab8);border-radius:14px;padding:1px 12px;font-size:14px;margin-bottom:4px}
@keyframes bkban{0%{opacity:0;transform:translate(-50%,16px) scale(.8)}12%{opacity:1;transform:translate(-50%,0) scale(1.06)}20%{transform:translate(-50%,0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px)}}
.bk-ptr{position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:5px solid #fff;box-shadow:0 0 0 4px var(--acc,#ff7ab8),0 0 24px rgba(255,255,255,.9);animation:bkptr .9s ease-in-out infinite;pointer-events:none}
@keyframes bkptr{50%{transform:scale(1.3);opacity:.6}}
.bk-fever{position:absolute;left:0;right:0;top:calc(236px + env(safe-area-inset-top));text-align:center;font-weight:800;font-size:18px;letter-spacing:2px;color:#fff;text-shadow:0 0 12px #ffb700,0 3px 0 rgba(0,0,0,.2)}
.bk-fever i{display:block;margin:3px auto 0;width:120px;height:7px;border-radius:5px;background:rgba(255,255,255,.35);overflow:hidden}
.bk-fever i b{display:block;height:100%;background:linear-gradient(90deg,#ffe14d,#ff8a3d)}
.bk-cardwrap{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(20,10,40,.34);animation:bkfade .25s}
@keyframes bkfade{from{opacity:0}}
.bk-card{width:min(92vw,400px);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#fff,#f3ecff);color:#3a2a5c;border-radius:28px;padding:18px 18px 20px;box-shadow:0 10px 0 rgba(0,0,0,.16),0 20px 50px rgba(0,0,0,.28);text-align:center;animation:bkpop .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes bkpop{from{transform:scale(.7) translateY(30px);opacity:0}}
.bk-card h1{margin:0;font-size:36px;line-height:1;font-weight:800;color:var(--ui,#6a3d9a)}
.bk-card h3{margin:2px 0 8px;font-size:16px;font-weight:700;opacity:.75}
.bk-card .big{display:flex;justify-content:center;gap:6px;margin:8px 0 6px;height:64px}
.bk-card .big svg{transform:scale(0);animation:bkstar .5s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes bkstar{to{transform:scale(1) rotate(0)}}
.bk-card .big svg.dim{opacity:.35}
.bk-card .row{display:flex;justify-content:center;gap:14px;align-items:center;font-weight:800;margin:4px 0;font-size:17px}
.bk-card .row span{display:inline-flex;align-items:center;gap:5px}
.bk-card .msg{font-weight:700;font-size:15px;opacity:.85;margin:6px 0}
.bk-card .bar{height:10px;border-radius:6px;background:#e4d9fb;overflow:hidden;margin:4px 14px}
.bk-card .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--acc,#ff7ab8),#ffb02e);border-radius:6px}
.bk-go{pointer-events:auto;font:inherit;font-weight:800;font-size:24px;color:#fff;background:#3cc46a;border:0;border-radius:40px;padding:12px 44px;box-shadow:0 6px 0 #2a9a50;cursor:pointer;margin-top:10px;animation:hcpulse 1.4s ease-in-out infinite}
.bk-go:active{transform:translateY(4px);box-shadow:0 2px 0 #2a9a50}
.bk-sm{font:inherit;font-weight:800;font-size:15px;color:#6a3d9a;background:#e9defc;border:0;border-radius:24px;padding:8px 16px;box-shadow:0 3px 0 rgba(0,0,0,.12);cursor:pointer;margin:8px 4px 0;display:inline-flex;align-items:center;gap:6px}
.bk-sm:active{transform:translateY(2px)}
.bk-map-wrap{align-items:stretch}
.bk-mapcard{width:min(96vw,440px);max-height:96vh;display:flex;flex-direction:column;background:linear-gradient(180deg,var(--m1,#ffd1ec),var(--m2,#c9b8ff));color:#fff;border-radius:28px;padding:14px 14px 16px;box-shadow:0 10px 0 rgba(0,0,0,.16),0 20px 50px rgba(0,0,0,.3);margin:auto;animation:bkpop .3s}
.bk-mhead{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:17px;gap:8px}
.bk-mhead .x{pointer-events:auto;border:0;background:rgba(255,255,255,.85);width:36px;height:36px;border-radius:50%;font:inherit;font-weight:800;font-size:20px;color:#6a3d9a;cursor:pointer}
.bk-tabs{display:flex;gap:6px;margin:10px 0 6px}
.bk-tab{flex:1;border:0;font:inherit;font-weight:800;font-size:13px;color:#fff;background:rgba(0,0,0,.18);border-radius:14px;padding:6px 2px;cursor:pointer;line-height:1.1}
.bk-tab.on{background:#fff;color:var(--ui,#6a3d9a)}
.bk-tab small{display:block;font-weight:600;font-size:11px;opacity:.8}
.bk-tab.lk{opacity:.6}
.bk-wsub{text-align:center;font-weight:700;font-size:14px;margin:2px 0 8px;text-shadow:0 2px 0 rgba(0,0,0,.12)}
.bk-grid{display:flex;flex-direction:column;gap:12px;padding:4px 6px}
.bk-rowl{display:flex;justify-content:space-between;gap:8px}
.bk-rowl.rev{flex-direction:row-reverse}
.bk-lv{pointer-events:auto;position:relative;width:21%;aspect-ratio:1;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:21px;color:var(--ui,#6a3d9a);background:#fff;box-shadow:0 5px 0 rgba(0,0,0,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:0}
.bk-lv .st{position:absolute;bottom:-14px;display:flex;gap:0}
.bk-lv.lk{background:rgba(255,255,255,.35);color:rgba(255,255,255,.8);box-shadow:none;cursor:default}
.bk-lv.hard{box-shadow:0 5px 0 rgba(0,0,0,.18),0 0 0 4px #ff4d4d}
.bk-lv.boss{box-shadow:0 5px 0 rgba(0,0,0,.18),0 0 0 4px #ffb700}
.bk-lv.next{animation:hcpulse 1s ease-in-out infinite;background:#ffe14d}
.bk-lv .tg{position:absolute;top:-9px;font-size:10px;background:#ff4d4d;color:#fff;border-radius:8px;padding:0 6px;letter-spacing:.5px}
.bk-lv.boss .tg{background:#ffb700;color:#5a3a00}
.bk-mfoot{display:flex;gap:8px;margin-top:20px;justify-content:center;flex-wrap:wrap}
.bk-mfoot .bk-sm{flex:1;justify-content:center;background:#fff}
.bk-skins{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}
.bk-sk{pointer-events:auto;border:0;background:rgba(255,255,255,.55);border-radius:16px;padding:8px 2px 6px;font:inherit;font-weight:700;font-size:11px;color:#3a2a5c;cursor:pointer;position:relative}
.bk-sk.on{background:#fff;box-shadow:0 0 0 3px var(--acc,#ff7ab8)}
.bk-sk.lk{opacity:.7}
.bk-sk .sw{width:38px;height:38px;margin:0 auto 4px;border-radius:11px;box-shadow:inset 0 -5px 0 rgba(0,0,0,.14)}
`;
const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
const dom = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const hud = dom(`<div class="bk-hud">
  <div class="bk-top"><div class="bk-name"></div><div class="bk-hearts"></div><div class="bk-info"></div></div>
  <button class="bk-btn bk-map" aria-label="Levels">${IC.map('#6a3d9a', 24)}</button>
  <div class="bk-coins"></div>
  <button class="bk-btn bk-hint" aria-label="Hint">${IC.bulb('#f0a500', 28)}<span class="n"></span></button>
  <div class="bk-stars"></div>
  <button class="bk-btn bk-redo" aria-label="Restart">${IC.redo('#6a3d9a', 24)}</button>
</div>`);
document.body.appendChild(hud);
const $ = s => hud.querySelector(s);
const elName = $('.bk-name'), elHearts = $('.bk-hearts'), elInfo = $('.bk-info'), elCoins = $('.bk-coins'), elHint = $('.bk-hint'), elStars = $('.bk-stars');
const ptr = dom('<div class="bk-ptr" hidden></div>'); hud.appendChild(ptr);
let feverEl = null;
const stop = e => e.stopPropagation();
for (const b of hud.querySelectorAll('.bk-btn')) b.addEventListener('pointerdown', stop);
$('.bk-map').addEventListener('click', () => { if (state === 'play') showMap(); });
$('.bk-redo').addEventListener('click', () => { if (state === 'play' || state === 'lost') restart(); });
elHint.addEventListener('click', useHint);
function restart() { tone(300, 0.08, 'sine', 0.1, 1.5); build(cur.mode === 'level' ? cur.n : cur.n, cur.mode === 'daily' ? { daily: true } : {}); }

function projected() {   // stars if nothing else goes wrong (the safe lower bound: mistakes so far; bombs levels judge at the end)
  const used = taps + miss, over = used - cur.par - cur.slack;
  return over <= 0 && miss <= (cur.slack ? 1 : 0) ? 3 : used <= cur.par + cur.slack + 2 && miss <= 3 ? 2 : 1;
}
function starsFor(used) { return used <= cur.par + cur.slack ? 3 : used <= cur.par + cur.slack + 2 ? 2 : 1; }
function hudUpdate() {
  elName.innerHTML = `${cur.mode === 'daily' ? 'DAILY' : 'LEVEL ' + (cur.n)}<small>${cur.name.replace(/^(Daily|Remix) · /, '')}</small>`;
  elHearts.innerHTML = Array.from({ length: maxHearts }, (_, i) => IC.heart(i < hearts ? '#ff4d6d' : '#7a6a8a', 26).replace('<svg', i < hearts ? '<svg' : '<svg class="gone"')).join('');
  elInfo.innerHTML = `<span>TAPS <b>${taps + miss}</b>/${cur.par}</span><span>${IC.cube('#fff', 14)} <b>${total - removedN}</b> left</span>`;
  elCoins.innerHTML = `${IC.coin('#ffd23f', 22)}<span>${coins}</span>`;
  elHint.querySelector('.n').textContent = hints > 0 ? hints : '6';
  elHint.classList.toggle('off', hints <= 0 && coins < 6);
  const p = state === 'play' || state === 'won' ? projected() : 1;
  elStars.innerHTML = `<span class="lbl">PAR ${cur.par}</span>` + starsRow(p, 24);
}
function bannerFor() {
  const n = cur.n, L = cur.L; let h = '', tag = '';
  if (cur.mode === 'level') {
    h = L.name;
    const intro = { 1: 'Tap a cube whose arrow points to open air', 2: 'Drag to spin the shape', 4: 'NEW: gold cubes pay a coin', 13: 'NEW: ? hides an arrow until a neighbour leaves', 19: 'NEW: bombs blow the cubes they touch', 22: 'Bombs next to bombs chain', 25: 'NEW: stones only a bomb can remove', 33: 'Jackpot: one chain, lots of gold' }[n];
    tag = L.hard ? (n % 12 === 0 ? 'BOSS' : 'HARD') : '';
    var sub = intro || '';
  } else { h = cur.name; var sub = cur.mode === 'daily' ? 'Same shape for everyone today' : 'Fresh arrows on a known shape'; }
  const old = document.querySelector('.bk-banner'); if (old) old.remove();
  hud.appendChild(dom(`<div class="bk-banner">${tag ? `<span class="tag">${tag}</span>` : ''}<h2>${h}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`));
}

// ---------------------------------------------------------------- hints + guide
function freeBlocks() { return blocks.filter(b => b.state === 'idle' && b.t !== 's' && W.alive[b.i] && W.reach(b.i, b.di) === Infinity); }
function pickHintBlock() {
  const f = freeBlocks(); if (!f.length) return null;
  const cam = new THREE.Vector3(0, 0, 1); let best = null, bs = -9;
  const q = new THREE.Quaternion().setFromEuler(pivot.rotation);
  for (const b of f) { const p = b.home.clone().applyQuaternion(q); const s = p.z + (b.t === 'b' ? 0.8 : 0) + (b.t === 'g' ? 0.4 : 0); if (s > bs) { bs = s; best = b; } }
  return best;
}
function useHint() {
  if (state !== 'play') return;
  if (hints > 0) hints--; else if (coins >= 6) coins -= 6; else { tone(180, 0.1, 'square', 0.08, 0.7); ui.pop('Collect gold for hints', '#fff', 22, 30); return; }
  const b = pickHintBlock(); if (!b) return;
  b.hint = 3; b.revealed = true; b.col = cubeColor(b); guide = b; hintT = 0; sfx.pick(3); saveAll(); hudUpdate();
  bumpCoins();
}
function bumpCoins() { elCoins.classList.remove('bump'); void elCoins.offsetWidth; elCoins.classList.add('bump'); }
function projectToScreen(local) {
  const v = local.clone().applyMatrix4(pivot.matrixWorld).project(camera);
  return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
}

// ---------------------------------------------------------------- taps
const popAt = (text, b, color = '#fff', size = 26) => { const [x, y] = projectToScreen(b.pos); const d = dom(`<div class="hc-pop" style="left:${x}px;top:${y - 30}px;font-size:${size}px;color:${color};transform:translate(-50%,0)">${text}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 950); };
function addCoins(n, b) {
  coins += n; coinsGot += n; sfx.coin(); bumpCoins(); if (b) popAt(`+${n}`, b, '#ffe14d', 30);
  saveAll(); elCoins.querySelector('span').textContent = coins;
}
function reveal(i) {
  for (const j of W.nb[i]) { const o = blocks[j]; if (o.t === 'h' && !o.revealed && W.alive[j]) { o.revealed = true; o.pop = 1; o.flash = 0.8; o.col = cubeColor(o); note(84, 0.12, 0.08); } }
}
function leave(b, fd, delay = 0, byBlast = false) {
  W.alive[b.i] = false;
  b.state = 'wait'; b.delayBlast = delay; b.fd = fd; b.byBlast = byBlast;
}
function launch(b) {   // the cube actually starts moving (after its blast delay)
  b.state = 'fly'; b.v = b.byBlast ? 0.16 : 0.05; b.t0 = 0;
  const wp = b.pos.clone().applyMatrix4(pivot.matrixWorld);
  const col = b.t === 's' ? ['#9da3b3', '#6c7283', '#ffffff'] : b.t === 'g' ? ['#ffd23f', '#fff1a8', '#ffffff'] : ['#ffffff', '#' + b.col.getHexString()];
  burst(scene, wp, col, b.byBlast ? 9 : 6, { speed: b.byBlast ? 0.1 : 0.06, up: 0.04, size: b.t === 's' ? 0.9 : 0.55, gravity: 0.003 });
  reveal(b.i);
  if (b.t === 'g') addCoins(1 + (frenzy > 0 ? 1 : 0), b);
  else if (frenzy > 0) { coins++; coinsGot++; saveAll(); elCoins.querySelector('span').textContent = coins; }
  if (b.t !== 's') { removedN++; ui.progress(removedN / total); hudUpdate(); }
  if (b.byBlast) { tone(120 + Math.random() * 60, 0.1, 'square', 0.05, 0.6); }
}
function explode(b) {
  const q = [[b.i, 0]], hits = []; let maxG = 0;
  while (q.length) {
    const [k, g] = q.shift();
    for (const j of W.nb[k]) if (W.alive[j]) { W.alive[j] = false; hits.push([j, g + 1]); maxG = Math.max(maxG, g + 1); if (blocks[j].t === 'b') q.push([j, g + 1]); }
  }
  shockwave(b.pos, '#ffd27a'); hitstop = 0.09; shake = Math.max(shake, 0.5); ui.flash(0.45);
  tone(70, 0.4, 'sawtooth', 0.2, 0.4); tone(150, 0.25, 'square', 0.1, 0.5); buzz([30, 30, 60]);
  for (const [j, g] of hits) {
    const o = blocks[j], away = o.home.clone().sub(b.home).normalize();
    o.state = 'wait'; o.byBlast = true; o.fd = away.lengthSq() ? away : o.d.clone(); o.delayBlast = g * 0.1 + (j % 3) * 0.015;
    if (o.t === 'b') later(g * 0.1, () => { shockwave(o.pos, '#ffb04a', 3.4); shake = Math.max(shake, 0.55); tone(90, 0.3, 'sawtooth', 0.16, 0.45); hitstop = 0.06; });
  }
  if (hits.length >= 4) { later(0.1, () => ui.pop(hits.length >= 8 ? 'MEGA BOOM!' : 'BOOM!', '#fff', 40 + Math.min(16, hits.length), 26)); }
  return hits.length;
}
function tapBlock(b) {
  if (state !== 'play' || b.state !== 'idle') return;
  idleT = 0; guide = null; retryHelp = false; ptr.hidden = true; { const bn = hud.querySelector('.bk-banner'); if (bn) bn.remove(); }
  if (b.t === 's') {
    b.flash = 0.6; b.state = 'bump'; b.t0 = 0; b.bumpTo = 0.1; tone(110, 0.1, 'square', 0.08, 0.8); buzz(15); shake = Math.max(shake, 0.06);
    popAt('needs a bomb', b, '#fff', 18); return;
  }
  const n = W.reach(b.i, b.di);
  if (n === Infinity) {
    taps++;
    const now = performance.now(); combo = now - lastClear < 1000 ? combo + 1 : 0; lastClear = now;
    note(67 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][Math.min(combo, 9)], 0.22, 0.14); tone(260, 0.12, 'sine', 0.07, 2.4); buzz(10);
    leave(b, b.d.clone(), 0); launch(b);
    hitstop = Math.max(hitstop, 0.025); shake = Math.max(shake, 0.05 + Math.min(combo, 8) * 0.025); tone(520 + combo * 40, 0.09, 'sawtooth', 0.05, 0.35);
    if (b.t === 'b') {
      explode(b);
    }
    shockwave(b.pos, combo >= 4 ? '#ffe14d' : '#ffffff', 1.6 + Math.min(combo, 8) * 0.35);
    if (combo === 1) ui.pop('x2', '#fff', 26, 24);
    comboFx(b);
    if (Math.random() < 0.05 && b.t === 'n') { later(0.05, () => { addCoins(3, b); ui.pop('LUCKY CUBE!', '#ffe14d', 34, 24); confetti(scene, new THREE.Vector3(0, 1, 1), 24); }); }
    hudUpdate();
  } else {
    miss++; combo = 0; b.state = 'bump'; b.t0 = 0; b.bumpTo = n + 0.12; b.flash = 1;
    { const c = W.cells[b.i], d = DA[b.di]; let x = c.x + d[0], y = c.y + d[1], z = c.z + d[2]; for (; W.inside(x, y, z); x += d[0], y += d[1], z += d[2]) { const j = W.at(x, y, z); if (j !== undefined && W.alive[j]) { blocks[j].flash = 1; blocks[j].pop = 0.7; break; } } }
    if (!b.revealed) { b.revealed = true; b.pop = 1; b.col = cubeColor(b); }
    if (!(cur.n === 1 && cur.mode === 'level')) hearts--;
    tone(140, 0.16, 'square', 0.1, 0.7); buzz([25, 30, 25]); shake = Math.max(shake, 0.2);
    hudUpdate(); const h = elHearts.children[hearts]; if (h) h.classList.add('hit');
    if (hearts <= 0) lose(); else ui.pop(cur.n === 1 ? 'That one is blocked' : 'BLOCKED!', '#fff', 30, 24);
  }
}
function comboFx(b) {
  if (combo >= 2) {
    const word = combo >= 9 ? 'UNSTOPPABLE' : combo >= 6 ? 'FRENZY' : combo >= 4 ? 'GREAT' : 'NICE';
    if (combo % 2 === 0 || combo >= 6) ui.pop(`${word} x${combo + 1}`, combo >= 6 ? '#ffe14d' : '#fff', 30 + Math.min(combo, 8) * 4, 24);
  }
  if (combo === 4 || combo === 9) { shockwave(b.pos, combo === 9 ? '#ffe14d' : '#ff7ab8', combo === 9 ? 7 : 5.5); ui.flash(0.25); shake = Math.max(shake, 0.3); confetti(scene, new THREE.Vector3(0, 1.2, 1), combo === 9 ? 60 : 30); tone(combo === 9 ? 1175 : 988, 0.3, 'triangle', 0.12, 1.4); }
  if (combo >= 5) { if (frenzy <= 0) { ui.flash(0.4); tone(880, 0.25, 'triangle', 0.1, 1.5); confetti(scene, new THREE.Vector3(0, 1.5, 1), 22); } frenzy = Math.min(5, frenzy + 1.2 + (frenzy > 0 ? 0 : 3)); showFever(); }
}
function showFever() {
  if (!feverEl) { feverEl = dom('<div class="bk-fever">FRENZY · coins x2<i><b></b></i></div>'); hud.appendChild(feverEl); }
}

// ---------------------------------------------------------------- win / lose
function closeCards() { for (const c of document.querySelectorAll('.bk-cardwrap')) c.remove(); }
function skinNext() { return SKINS.find(s => s.need > totalStars()); }
function win() {
  if (state !== 'play') return; state = 'won';
  if (feverEl) { feverEl.remove(); feverEl = null; } frenzy = 0;
  const used = taps + miss, s = starsFor(used), n = cur.n, first = cur.mode === 'level' && !cleared(n);
  const prevBest = cur.mode === 'level' ? stars[n] || 0 : 0, beforeStars = totalStars();
  let bonus = 0, msg = '';
  if (cur.mode === 'level') {
    stars[n] = Math.max(prevBest, s);
    if (first) { bonus += 2 + (cur.L.hard ? 3 : 0); }
    if (s > prevBest && prevBest > 0) bonus += (s - prevBest) * 2;
  } else if (cur.mode === 'daily') {
    if (dayInfo.d !== dayNum()) { const y = dayIdx() - 1; dayInfo = { d: dayNum(), streak: dayInfo.done === y ? dayInfo.streak + 1 : 1, done: dayIdx() }; bonus += 3 + Math.min(dayInfo.streak, 5); msg = `Daily done · streak ${dayInfo.streak}`; }
    else msg = 'Daily done today';
  } else if (s === 3) bonus += 1;
  if (miss === 0 && s === 3) { flaw++; if (flaw > flawBest) flawBest = flaw; if (flaw >= 2) { const fb = Math.min(flaw, 6); bonus += fb; msg = (msg ? msg + ' · ' : '') + `CLEAN STREAK x${flaw} · +${fb}`; } } else flaw = 0;
  coins += bonus;
  const newSkin = SKINS.find(k => k.need > beforeStars && k.need <= totalStars());
  if (newSkin) skinId = newSkin.id;
  saveAll();
  if (!recorded) { recorded = true; F.level(true); if (first || cur.mode !== 'level') B.submit(1); }
  const worldDone = cur.mode === 'level' && first && n % 12 === 0;
  setTimeout(() => { sfx.win(); confetti(scene, new THREE.Vector3(0, 0.5, 1), s === 3 ? 120 : 70); ui.flash(0.35); }, 200);
  buzz([20, 30, 20]); ui.pop(['CLEARED!', 'SPOTLESS!', 'BRILLIANT!'][s - 1], '#fff', 42, 26);
  setTimeout(() => showWin({ s, used, bonus, newSkin, first, worldDone, msg, prevBest }), 900);
  hudUpdate();
}
function showWin(r) {
  closeCards();
  const nx = skinNext(), t = totalStars();
  const prevNeed = nx ? [...SKINS].reverse().find(k => k.need <= t).need : 0;
  const pct = nx ? ((t - prevNeed) / (nx.need - prevNeed)) * 100 : 100;
  const w = dom(`<div class="bk-cardwrap"><div class="bk-card">
    <h1>${r.worldDone ? 'WORLD CLEARED!' : r.s === 3 ? 'PERFECT!' : 'CLEARED!'}</h1>
    <h3>${cur.mode === 'daily' ? cur.name : `Level ${cur.n} · ${cur.name}`}${cur.L && cur.L.hard ? ' · ' + (cur.n % 12 === 0 ? 'BOSS' : 'HARD') : ''}</h3>
    <div class="big">${[0, 1, 2].map(i => IC.star(i < r.s ? '#ffc928' : '#c9bde6', 60).replace('<svg', `<svg class="${i < r.s ? '' : 'dim'}" style="animation-delay:${0.25 + i * 0.3}s"`)).join('')}</div>
    <div class="row"><span>${r.used} taps · par ${cur.par}</span>${coinsGot || r.bonus ? `<span>${IC.coin('#ffc928', 22)}+${coinsGot + r.bonus}</span>` : ''}</div>
    ${r.msg ? `<div class="msg">${r.msg}</div>` : ''}
    ${r.worldDone && cur.n < COUNT ? `<div class="msg">${WORLDS[Math.floor(cur.n / 12)].name} is open · ${WORLDS[Math.floor(cur.n / 12)].sub}</div>` : ''}
    ${cur.mode === 'level' ? `<div class="msg" style="opacity:.8">Daily shape: ${dayInfo.d === dayNum() ? 'done · streak ' + dayInfo.streak : (dayInfo.streak ? 'keep your ' + dayInfo.streak + '-day streak' : 'new one every day')}</div>` : ''}
    ${r.newSkin ? `<div class="msg" style="color:var(--ui)">New cubes: ${r.newSkin.name}! Wearing them now</div>` : ''}
    ${nx ? `<div class="msg" style="${nx.need - t <= 2 ? 'color:#ff4f9a;font-weight:800;animation:bkpulse .8s infinite alternate' : ''}">${nx.need - t === 1 ? 'ONE star from' : nx.need - t <= 2 ? 'Just ' + (nx.need - t) + ' stars from' : (nx.need - t) + ' more stars for'} the ${nx.name} cubes${nx.need - t <= 2 ? ' — play on!' : ''}</div><div class="bar"><i style="width:${pct}%"></i></div>` : '<div class="msg">All cube skins found</div>'}
    <button class="bk-go">${cur.mode === 'level' && cur.n >= COUNT ? 'Play remix' : 'Next'}</button><br>
    ${r.s < 3 ? `<button class="bk-sm" data-a="again">${IC.redo('#6a3d9a', 16)} Again for ${r.s === 2 ? '3' : r.s + 1} stars</button>` : ''}<button class="bk-sm" data-a="map">${IC.map('#6a3d9a', 16)} Levels</button>
  </div></div>`);
  document.body.appendChild(w);
  const note3 = [0, 1, 2].filter(i => i < r.s); note3.forEach(i => setTimeout(() => note(72 + i * 4, 0.3, 0.14), 350 + i * 300));
  w.querySelector('.bk-go').addEventListener('click', () => { closeCards(); goNext(); });
  w.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { closeCards(); if (b.dataset.a === 'again') restart(); else showMap(); }));
  w.addEventListener('pointerdown', stop);
}
function goNext() {
  if (cur.mode === 'daily') { showMap(); return; }
  build(cur.n < COUNT ? cur.n + 1 : nextLevel() <= COUNT ? nextLevel() : cur.n + 1);
}
function lose() {
  if (state !== 'play') return; state = 'lost'; flaw = 0;
  if (!recorded) { recorded = true; F.level(false, removedN / total); }
  sfx.fail(); saveAll();
  const left = total - removedN, near = left <= Math.max(3, total * 0.35);
  const fb = pickHintBlock(); if (fb) { fb.hint = 99; fb.revealed = true; fb.col = cubeColor(fb); }
  setTimeout(() => {
    closeCards();
    const w = dom(`<div class="bk-cardwrap"><div class="bk-card">
      <h1 style="${near ? 'font-size:44px' : ''}">${near ? 'SO CLOSE!' : 'OUT OF HEARTS'}</h1>
      <h3>${near ? `Only ${left} cube${left > 1 ? 's' : ''} to go` : `${removedN} of ${total} cubes cleared`}</h3>
      <div class="bar"><i style="display:block;height:100%;width:${Math.round(removedN / total * 100)}%;background:linear-gradient(90deg,#ff7ab8,#ffc928)"></i></div>
      <div class="msg">${fb ? 'The glowing cube was free to slide.' : hints > 0 || coins >= 6 ? 'Stuck? The bulb shows a free cube.' : 'Only cubes with open air along their arrow slide out.'}</div>
      <button class="bk-go" data-a="retry">Retry</button><br>${coins >= 8 ? `<button class="bk-sm" data-a="cont">${IC.heart('#ff4d6d', 16)} Keep going · ${IC.coin('#ffc928', 16)}8</button>` : ''}<button class="bk-sm" data-a="map">${IC.map('#6a3d9a', 16)} Levels</button>
    </div></div>`);
    document.body.appendChild(w); w.addEventListener('pointerdown', stop);
    w.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      closeCards(); const a = b.dataset.a;
      if (a === 'map') showMap();
      else if (a === 'cont' && coins >= 8) { coins -= 8; hearts = Math.min(maxHearts, 2); state = 'play'; saveAll(); hudUpdate(); ui.pop('BACK IN!', '#ff7ab8', 36, 24); }
      else { restart(); retryHelp = true; }
    }));
  }, 650);
}

// ---------------------------------------------------------------- map + collection
let mapWorld = 0;
function showMap(w) {
  closeCards();
  const nl = nextLevel(); mapWorld = w !== undefined ? w : Math.min(2, Math.floor((Math.min(nl, COUNT) - 1) / 12));
  const wd = WORLDS[mapWorld], t = totalStars(), nx = skinNext();
  const worldOpen = i => i === 0 || cleared(i * 12);
  const ws = Array.from({ length: 12 }, (_, k) => mapWorld * 12 + k + 1);
  const rows = [0, 1, 2].map(r => ws.slice(r * 4, r * 4 + 4));
  const lv = n => {
    const L = LEVELS[n - 1], ok = unlocked(n), s = stars[n] || 0, isNext = n === nl, boss = n % 12 === 0;
    return `<button class="bk-lv ${ok ? '' : 'lk'} ${L.hard && !boss ? 'hard' : ''} ${boss ? 'boss' : ''} ${isNext ? 'next' : ''}" data-n="${n}">${L.hard ? `<span class="tg">${boss ? 'BOSS' : 'HARD'}</span>` : ''}${ok ? n : IC.lock('rgba(255,255,255,.85)', 24)}<span class="st">${ok ? starsRow(s, 15, '#ffb700', 'rgba(0,0,0,.25)') : ''}</span></button>`;
  };
  const wsStars = ws.reduce((a, n) => a + (stars[n] || 0), 0);
  const el = dom(`<div class="bk-cardwrap bk-map-wrap"><div class="bk-mapcard" style="--m1:${wd.bg[0]};--m2:${wd.bg[1]};--ui:${wd.ui};--acc:${wd.accent}">
    <div class="bk-mhead"><span style="display:flex;align-items:center;gap:6px">${IC.star('#ffd23f', 22)} ${t}/${COUNT * 3}</span><span style="display:flex;align-items:center;gap:5px">${IC.coin('#ffd23f', 22)} ${coins}</span><span style="display:flex;align-items:center;gap:5px">${IC.bulb('#fff', 22)} ${hints}</span><button class="x" aria-label="Close">×</button></div>
    <div class="bk-tabs">${WORLDS.map((x, i) => `<button class="bk-tab ${i === mapWorld ? 'on' : ''} ${worldOpen(i) ? '' : 'lk'}" data-w="${i}">${x.name}<small>${worldOpen(i) ? Array.from({ length: 12 }, (_, k) => stars[i * 12 + k + 1] || 0).reduce((a, b) => a + b, 0) + '/36' : 'locked'}</small></button>`).join('')}</div>
    <div class="bk-wsub">${wd.sub}${wsStars === 36 ? ' · all stars!' : ''}</div>
    <div class="bk-grid" style="${worldOpen(mapWorld) ? '' : 'opacity:.5;pointer-events:none'}">${rows.map((r, i) => `<div class="bk-rowl ${i % 2 ? 'rev' : ''}">${r.map(lv).join('')}</div>`).join('')}</div>
    <div class="bk-wsub" style="margin-top:22px">${nx ? `${nx.need - t} more stars for the ${nx.name} cubes` : 'Every cube skin found'}</div>
    <div class="bk-mfoot"><button class="bk-sm" data-a="daily">${IC.cal('#6a3d9a', 18)} Daily${dayInfo.d === dayNum() ? ' · done' : dayInfo.streak ? ` · ${dayInfo.streak} days` : ''}</button><button class="bk-sm" data-a="skins">${IC.cube('#6a3d9a', 18)} Cubes</button>${nl > COUNT ? `<button class="bk-sm" data-a="remix">Remix</button>` : ''}</div>
  </div></div>`);
  document.body.appendChild(el); el.addEventListener('pointerdown', stop);
  el.querySelector('.x').addEventListener('click', () => { closeCards(); if (state === 'won' || state === 'lost') build(nextPlay()); });
  el.querySelectorAll('.bk-lv').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.n; if (!unlocked(n)) { tone(180, 0.1, 'square', 0.08, 0.7); return; } closeCards(); build(n); }));
  el.querySelectorAll('.bk-tab').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.w; if (!worldOpen(i)) { tone(180, 0.1, 'square', 0.08, 0.7); return; } showMap(i); }));
  el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a; closeCards();
    if (a === 'daily') build(0, { daily: true }); else if (a === 'skins') showSkins(); else if (a === 'remix') build(COUNT + 1);
  }));
}
const nextPlay = () => Math.min(nextLevel(), COUNT + 1);
function showSkins() {
  const t = totalStars();
  const el = dom(`<div class="bk-cardwrap"><div class="bk-card"><h1>CUBES</h1><h3>${t} stars earned · wear any you have found</h3>
    <div class="bk-skins">${SKINS.map(k => { const have = t >= k.need; const bg = k.rainbow ? 'linear-gradient(135deg,#ff5d5d,#ffd23f,#3ac46a,#3a86ff,#b05cff)' : `linear-gradient(135deg,${k.a},${k.b})`; return `<button class="bk-sk ${have ? '' : 'lk'} ${k.id === skinId ? 'on' : ''}" data-s="${k.id}"><div class="sw" style="background:${have ? bg : '#b9b2c9'}"></div>${have ? k.name : k.need + ' stars'}</button>`; }).join('')}</div>
    <button class="bk-go">Back</button></div></div>`);
  document.body.appendChild(el); el.addEventListener('pointerdown', stop);
  el.querySelectorAll('.bk-sk').forEach(b => b.addEventListener('click', () => { const k = SKINS.find(x => x.id === b.dataset.s); if (t < k.need) { tone(180, 0.1, 'square', 0.08, 0.7); return; } skinId = k.id; saveAll(); sfx.pick(2); for (const bl of blocks) bl.col = cubeColor(bl); closeCards(); showSkins(); }));
  el.querySelector('.bk-go').addEventListener('click', () => { closeCards(); showMap(); });
}

// ---------------------------------------------------------------- input: drag spins, tap slides
const ray = new THREE.Raycaster();
function pick(cx, cy) {
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  for (const h of ray.intersectObject(cubes)) { const b = blocks[h.instanceId]; if (b && b.state !== 'fly' && b.state !== 'gone' && b.state !== 'wait') return b; }
  let best = null, bd = 46 * 46;   // near-miss: the closest cube within ~46px counts
  for (const b of blocks) { if (b.state === 'fly' || b.state === 'gone' || b.state === 'wait') continue; const [x, y] = projectToScreen(b.pos); const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = b; } }
  return best;
}
const IN = input({
  onDown: () => { vyaw = 0; vpitch = 0; },
  onMove: (dx, dy) => { vyaw = dx * 0.011; vpitch = dy * 0.008; yaw += vyaw; pitch = clamp(pitch + vpitch, -1.25, 1.25); idleT = 0; },
  onTap: e => { if (state !== 'play') return; const b = pick(e.clientX, e.clientY); if (b) tapBlock(b); else { tone(220, 0.04, 'sine', 0.04, 0.9); ui.pop('Spin to find a cube', '#fff', 20, 40); } },
});

// ---------------------------------------------------------------- loop
let lastStarsP = 3;
loop((dtRaw, t) => {
  let dt = dtRaw;
  if (hitstop > 0) { hitstop -= dtRaw / 60; dt = dtRaw * 0.12; }
  if (slow > 0) { slow -= dtRaw / 60; dt *= 0.35; }
  const s = dt / 60, rs = dtRaw / 60;
  if (!IN.down) { yaw += vyaw * dtRaw; pitch = clamp(pitch + vpitch * dtRaw, -1.25, 1.25); vyaw *= Math.pow(0.92, dtRaw); vpitch *= Math.pow(0.9, dtRaw); }
  if (state === 'won') yaw += 0.006 * dtRaw;
  if (botSpin) { const k = Math.min(Math.abs(botSpin), 0.03 * dtRaw) * Math.sign(botSpin); yaw += k; botSpin -= k; if (Math.abs(botSpin) < 0.001) botSpin = 0; }
  pivot.rotation.set(pitch, yaw, 0, 'XYZ'); pivot.position.y = Math.sin(t * 1.4) * 0.06; pivot.updateMatrixWorld();
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].t -= rs; if (fx[i].t <= 0) { const f = fx.splice(i, 1)[0]; f.fn(); } }
  // frenzy
  if (frenzy > 0) { frenzy -= rs; if (feverEl) { feverEl.querySelector('b').style.width = Math.max(0, Math.min(100, frenzy / 5 * 100)) + '%'; } if (frenzy <= 0 && feverEl) { feverEl.remove(); feverEl = null; } }
  // end of level: every cube is gone (the blasts have launched too)
  if (state === 'play' && !ended && W.alive.every(a => !a) && !blocks.some(b => b.state === 'wait')) { ended = true; slow = 0.7; later(0.55, win); }
  // idle help
  if (state === 'play') {
    idleT += rs; const lvl1 = cur && cur.mode === 'level' && cur.n <= 3;
    if (!IN.down) hintT += rs; else hintT = 0;
    if ((lvl1 || retryHelp) && !guide && idleT > (retryHelp ? 1.5 : cur.n === 1 ? 2 : 6)) { const b = pickHintBlock(); if (b) { guide = b; b.hint = 3; } }
    elHint.classList.toggle('wig', idleT > 12 && (hints > 0 || coins >= 6));
    if (cur.n === 1 && cur.mode === 'level' && idleT > 4 && !IN.down) yaw += 0.01 * dtRaw;   // a slow spin shows the shape is 3D
  }
  // guide pointer
  if (guide && guide.state === 'idle' && state === 'play') { const [x, y] = projectToScreen(guide.pos); ptr.hidden = false; ptr.style.left = x + 'px'; ptr.style.top = y + 'px'; guide.hint = Math.max(guide.hint, 0.3); } else if (!guide) ptr.hidden = true; else { ptr.hidden = true; }
  // cubes
  let na = 0, nd = 0, nq = 0, nb = 0, nc = 0;
  for (const b of blocks) {
    if (b.sc < 1) { b.delay -= s; if (b.delay <= 0) b.sc = Math.min(1, b.sc + s * 5); }
    if (b.state === 'wait') { b.delayBlast -= s; if (b.delayBlast <= 0) launch(b); }
    if (b.state === 'fly') {
      b.v += 0.03 * dt; b.t0 += b.v * dt; b.pos.copy(b.home).addScaledVector(b.fd, b.t0);
      if (b.t0 > 14) b.state = 'gone';
    } else if (b.state === 'bump') {
      b.t0 += s * 3.2; const k = b.t0 < 0.5 ? Math.sin(b.t0 * Math.PI) : Math.max(0, 1 - (b.t0 - 0.5) * 2) * 0.98;
      b.pos.copy(b.home).addScaledVector(b.d, b.bumpTo * Math.min(1, k * 1.1)); if (b.t0 >= 1) { b.state = 'idle'; b.pos.copy(b.home); }
    }
    b.flash = Math.max(0, b.flash - s * 2.2); b.pop = Math.max(0, b.pop - s * 3); if (b.hint > 0) b.hint = Math.max(b.state === 'idle' && b === guide ? 0.3 : 0, b.hint - s * 0.9);
    if (b.t === 'g' && b.state === 'idle' && state === 'play') { b.sparkle -= s; if (b.sparkle <= 0) { b.sparkle = 1.2 + Math.random(); burst(scene, b.pos.clone().applyMatrix4(pivot.matrixWorld), ['#fff1a8', '#ffffff'], 1, { speed: 0.01, up: 0.012, size: 0.3, gravity: 0, life: 0.6 }); } }
    let scl = b.state === 'gone' ? 0 : b.state === 'fly' ? Math.max(0, 1 - Math.max(0, b.t0 - 6) / 8) : easeBack(b.sc);
    const bounce = 1 + b.pop * 0.25 + (b.hint > 0 ? Math.sin(t * 12) * 0.06 * Math.min(1, b.hint) : 0);
    scl *= bounce;
    _s.set(scl, scl, scl); _b.compose(b.pos, _q.identity(), _s); _m.copy(_b); cubes.setMatrixAt(b.i, _m);
    _c.copy(b.col); if (b.flash > 0) _c.lerp(b.t === 's' ? _w : new THREE.Color('#ff3b3b'), b.flash * (b.byBlast ? 0.5 : 0.85)); if (b.hint > 0) _c.lerp(_w, 0.35 + 0.4 * Math.sin(t * 10) * Math.min(1, b.hint)); if (b.state === 'wait') _c.lerp(_w, 0.5);
    cubes.setColorAt(b.i, _c);
    if (scl > 0.01) {
      const ac = arrowColor(b);
      if (b.t === 's') { for (let k = 0; k < 6; k++) { _m.multiplyMatrices(_b, FACES[k]); crackMesh.setMatrixAt(nc++, _m); } }
      else if (b.t === 'h' && !b.revealed) { for (let k = 0; k < 6; k++) { _m.multiplyMatrices(_b, FACES[k]); qMesh.setMatrixAt(nq++, _m); } }
      else {
        _c.set(ac);
        for (let k = 0; k < 4; k++) { _m.multiplyMatrices(_b, b.dec.arrows[k]); arrows.setMatrixAt(na, _m); arrows.setColorAt(na++, _c); }
        if (b.t === 'b') { _m.multiplyMatrices(_b, b.dec.ring); bombMesh.setMatrixAt(nb++, _m); }
        else { _m.multiplyMatrices(_b, b.dec.ring); dots.setMatrixAt(nd, _m); dots.setColorAt(nd++, _c); }
      }
    }
  }
  arrows.count = na; dots.count = nd; qMesh.count = nq; bombMesh.count = nb; crackMesh.count = nc;
  for (const m of [cubes, arrows, dots, qMesh, bombMesh, crackMesh]) m.instanceMatrix.needsUpdate = true;
  cubes.instanceColor && (cubes.instanceColor.needsUpdate = true); arrows.instanceColor && (arrows.instanceColor.needsUpdate = true); dots.instanceColor && (dots.instanceColor.needsUpdate = true);
  // shockwaves
  for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.t += rs * 1.8; const k = Math.min(1, w.t); w.m.scale.setScalar(0.3 + k * w.m.userData.size); w.m.material.opacity = (1 - k) * 0.9; w.m.quaternion.copy(camera.quaternion); if (k >= 1) { scene.remove(w.m); w.m.material.dispose(); waves.splice(i, 1); } }
  // camera
  shake = Math.max(0, shake - rs * 0.8);
  camera.position.set((Math.random() - 0.5) * shake, 1.2 + (Math.random() - 0.5) * shake, camDist - (state === 'won' ? 0.5 : 0));
  camera.lookAt(0, -0.2, 0);
  sun.position.set(5, 12, 9); sun.target.position.set(0, 0, 0);
  // star preview follows mistakes
  if (state === 'play') { const p = projected(); if (p !== lastStarsP) { lastStarsP = p; hudUpdate(); } }
});
function easeBack(x) { const c = 1.9; return x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

// start straight in the next level (no menu); map is one tap away
build(Math.min(nextLevel(), COUNT + 1) > COUNT ? COUNT + 1 : nextLevel());

window.__game = {
  get state() { return state; }, get level() { return cur && cur.n; }, get score() { return totalStars(); }, get stars() { return stars; },
  get taps() { return taps; }, get miss() { return miss; }, get par() { return cur.par; }, get hearts() { return hearts; }, get total() { return total; }, get removed() { return removedN; },
  get blocks() { return blocks; }, get coins() { return coins; }, get skin() { return skinId; },
  load(n, o) { build(n, o); }, restart, map: showMap, skins: showSkins,
  solve() { return parSearch(cur.g, 600).seq; },
  play(i) { const b = blocks[i]; if (!b || b.state !== 'idle') return false; tapBlock(b); return true; },
  bot() {
    if (state !== 'play') return;
    if (Math.random() < 0.15) { botSpin = (Math.random() - 0.5) * 1.6; return; }
    const free = freeBlocks(); if (free.length) tapBlock(free[Math.floor(Math.random() * free.length)]);
  },
  reset() { stars = {}; coins = 3; hints = 2; skinId = 'candy'; dayInfo = { d: 0, streak: 0, done: 0 }; saveAll(); },
  setStars(o) { stars = o; saveAll(); },
};

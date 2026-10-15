// Pulp Swipe — original fruit slicing game. Swipe across tossed fruit to cut it into juicy halves,
// chain several in one swipe for combos, never touch a bomb, and don't let three fruit drop.
import { THREE, createStage, createUI, input, loop, store, mat, glossy, burst, confetti, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Pulp Swipe: Fruit Slicing';
const S = store('pulpswipe');
const F = flow('pulpswipe');
let level = S.get('level', 1), best = S.get('best', 0);

const stage = createStage({ fov: 45, shadowSize: 10 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'PULP<br>SWIPE', hint: 'Swipe to slice · avoid bombs', hand: '👆' });
const D = daily('pulpswipe', ui, { name: NAME });
const livesEl = document.getElementById('lives'), cv = document.getElementById('trail'), cx = cv.getContext('2d');
const TAU = Math.PI * 2;
camera.position.set(0, 0, 14); camera.lookAt(0, 0, 0);
sun.position.set(3, 8, 12); sun.shadow.camera.far = 40;

const THEMES = [
  { bg: ['#ffd8b8', '#fff1df'], wood: ['#f3cfa0', '#e9bf8b', '#f7dab2'], ui: '#ff7043' },
  { bg: ['#d7c8ff', '#fde2ff'], wood: ['#e7d3f7', '#dcc3f1', '#f0e2fb'], ui: '#8e5cff' },
  { bg: ['#bff0e0', '#eafff6'], wood: ['#cdeedd', '#bde5d0', '#dcf5e8'], ui: '#20b486' },
  { bg: ['#ffd0dc', '#fff0f4'], wood: ['#ffd9e2', '#f9c7d4', '#ffe6ec'], ui: '#ff4f7b' },
];

// ---------------------------------------------------------------- backdrop: pastel wooden board
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const boardMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 26), boardMat); board.position.z = -4; board.receiveShadow = true; scene.add(board);
function woodTex(t) {
  return canvasTex(512, 832, (g, w, h) => {
    const n = 5, pw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = t.wood[i % 3]; g.fillRect(i * pw, 0, pw, h);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(120,70,30,${0.04 + Math.random() * 0.05})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = i * pw + Math.random() * pw; g.moveTo(x, 0); for (let y = 0; y <= h; y += 40) g.lineTo(x + Math.sin(y * 0.01 + k) * 6, y); g.stroke(); }
      for (let k = 0; k < 2; k++) { const y = Math.random() * h, x = i * pw + pw * (0.3 + Math.random() * 0.4); g.fillStyle = 'rgba(120,70,30,.08)'; g.beginPath(); g.ellipse(x, y, 7, 16, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(80,40,10,.16)'; g.fillRect(i * pw - 2, 0, 4, h);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * pw + 2, 0, 3, h);
    }
  });
}
// juice splats (pooled decals on the board)
const splatTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 30, 0, TAU); g.fill();
  for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, d = 26 + Math.random() * 30, r = 4 + Math.random() * 10; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, TAU); g.fill(); g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a - 0.15) * d, 64 + Math.sin(a - 0.15) * d); g.lineTo(64 + Math.cos(a + 0.15) * d, 64 + Math.sin(a + 0.15) * d); g.fill(); }
});
const splats = [];
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex, transparent: true, depthWrite: false, opacity: 0 })); m.position.z = -3.98 + i * 0.001; scene.add(m); splats.push({ m, life: 0 }); }
let splatI = 0;
function splat(x, y, color, size) { const s = splats[splatI++ % splats.length]; s.m.position.x = x * 18 / 14; s.m.position.y = y * 18 / 14; s.m.scale.setScalar(size); s.m.rotation.z = Math.random() * TAU; s.m.material.color.set(color); s.m.material.opacity = 0.75; s.life = 1; }

// ---------------------------------------------------------------- fruit
const FRUITS = {
  melon: { r: 1.15, sc: [1.1, 1, 1], skin: '#3fa34d', stripe: '#24713a', flesh: '#ff4d5e', rind: '#c8f2a6', seed: '#2b2d42', juice: '#ff4d6d' },
  orange: { r: 0.74, sc: [1, 1, 1], skin: '#ff9f1c', stripe: null, flesh: '#ffb347', rind: '#fff1d0', seg: true, juice: '#ffa630' },
  apple: { r: 0.7, sc: [1, 0.92, 1], skin: '#e63946', stripe: '#ff7b7b', flesh: '#fff3c4', rind: '#ffe08a', seed: '#5b3a1e', stem: true, juice: '#fff0a8' },
  lemon: { r: 0.65, sc: [1.28, 0.92, 0.92], skin: '#ffe14d', stripe: null, flesh: '#fff59d', rind: '#ffffff', seg: true, juice: '#fff176' },
  kiwi: { r: 0.62, sc: [1.2, 0.95, 0.95], skin: '#8d6e4a', stripe: '#6f5438', flesh: '#8bc34a', rind: '#c5e1a5', seed: '#1b1b1b', ring: true, juice: '#a5d66b' },
  peach: { r: 0.76, sc: [1, 1, 1], skin: '#ffad8a', stripe: '#ff7f6b', flesh: '#ffc56b', rind: '#ffe0a3', pit: '#9c5a3c', juice: '#ffb385' },
  plum: { r: 0.59, sc: [0.95, 1.05, 0.95], skin: '#7b3fa0', stripe: '#9b5fc0', flesh: '#ffd166', rind: '#ffe8a3', pit: '#a0522d', juice: '#c77dff' },
};
const KINDS = Object.keys(FRUITS);
function skinTex(f) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = f.skin; g.fillRect(0, 0, w, h);
    if (f.stripe && f === FRUITS.melon) { g.fillStyle = f.stripe; for (let i = 0; i < 10; i++) { g.beginPath(); const x = i * w / 10; g.moveTo(x, 0); for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y * 0.15 + i) * 5 + 4, y); for (let y = h; y >= 0; y -= 8) g.lineTo(x + Math.sin(y * 0.15 + i) * 5 + 12, y); g.fill(); } }
    else if (f.stripe) { for (let i = 0; i < 120; i++) { g.fillStyle = f.stripe; g.globalAlpha = 0.25; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, TAU); g.fill(); } g.globalAlpha = 1; }
    else { for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function fleshTex(f) {
  return canvasTex(256, 256, (g, w, h) => {
    const c = w / 2;
    g.fillStyle = f.skin; g.fillRect(0, 0, w, h);
    g.fillStyle = f.rind; g.beginPath(); g.arc(c, c, c * 0.97, 0, TAU); g.fill();
    g.fillStyle = f.flesh; g.beginPath(); g.arc(c, c, c * (f === FRUITS.melon ? 0.86 : 0.9), 0, TAU); g.fill();
    if (f.seg) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * 0.88, c + Math.sin(a) * c * 0.88); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(c, c, 10, 0, TAU); g.fill(); }
    if (f.seed && !f.ring) { g.fillStyle = f.seed; const n = f === FRUITS.melon ? 18 : 5; for (let i = 0; i < n; i++) { const a = i / n * TAU + (i % 2) * 0.3, d = f === FRUITS.melon ? c * (0.35 + (i % 3) * 0.15) : c * 0.22; g.save(); g.translate(c + Math.cos(a) * d, c + Math.sin(a) * d); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, TAU); g.fill(); g.restore(); } }
    if (f.ring) { g.fillStyle = '#f1f8e9'; g.beginPath(); g.arc(c, c, c * 0.3, 0, TAU); g.fill(); g.fillStyle = f.seed; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; g.beginPath(); g.ellipse(c + Math.cos(a) * c * 0.42, c + Math.sin(a) * c * 0.42, 4, 2.5, a, 0, TAU); g.fill(); } }
    if (f.pit) { g.fillStyle = f.pit; g.beginPath(); g.ellipse(c, c, c * 0.3, c * 0.38, 0, 0, TAU); g.fill(); }
    const gr = g.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
  });
}
const RES = {};
for (const k of KINDS) {
  const f = FRUITS[k];
  RES[k] = {
    whole: new THREE.SphereGeometry(f.r, 28, 20), half: new THREE.SphereGeometry(f.r, 28, 12, 0, TAU, 0, Math.PI / 2), cap: new THREE.CircleGeometry(f.r * 0.995, 28),
    skin: new THREE.MeshStandardMaterial({ map: skinTex(f), roughness: 0.38, metalness: 0.02 }), flesh: new THREE.MeshStandardMaterial({ map: fleshTex(f), roughness: 0.6, side: THREE.DoubleSide }),
  };
  RES[k].cap.rotateX(Math.PI / 2);     // faces -y: the open side of the top hemisphere
}
const stemG = new THREE.CylinderGeometry(0.03, 0.04, 0.22, 6), leafG = new THREE.SphereGeometry(0.12, 8, 6);
const stemM = mat('#6b4423'), leafM = mat('#5cb85c');
function makeWhole(kind) {
  const f = FRUITS[kind], g = new THREE.Group(), m = new THREE.Mesh(RES[kind].whole, RES[kind].skin); m.castShadow = true; g.add(m); m.scale.set(...f.sc);
  if (f.stem || kind === 'peach' || kind === 'plum') { const s = new THREE.Mesh(stemG, stemM); s.position.y = f.r * f.sc[1] + 0.06; g.add(s); const l = new THREE.Mesh(leafG, leafM); l.scale.set(1.5, 0.4, 0.8); l.position.set(0.12, f.r * f.sc[1] + 0.1, 0); l.rotation.z = 0.5; g.add(l); }
  return g;
}
function makeHalf(kind) {
  const f = FRUITS[kind], g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const h = new THREE.Mesh(RES[kind].half, RES[kind].skin); h.castShadow = true; const c = new THREE.Mesh(RES[kind].cap, RES[kind].flesh);
  inner.add(h, c); inner.scale.set(...f.sc); return g;
}
// bomb
const bombG = new THREE.SphereGeometry(0.72, 24, 18), bombM = glossy('#2b2d42', { roughness: 0.25 }), fuseM = mat('#c9a66b'), sparkM = new THREE.MeshBasicMaterial({ color: '#ffdd55' });
function makeBomb() {
  const g = new THREE.Group(), b = new THREE.Mesh(bombG, bombM); b.castShadow = true; g.add(b);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.16, 12), mat('#555b6e')); cap.position.y = 0.72; g.add(cap);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), fuseM); fuse.position.set(0.05, 0.92, 0); fuse.rotation.z = -0.4; g.add(fuse);
  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), sparkM); spark.position.set(0.13, 1.08, 0); g.add(spark); g.spark = spark;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 6, 30), mat('#ff3d6e', { emissive: '#ff3d6e', emissiveIntensity: 0.5 })); band.rotation.x = Math.PI / 2; g.add(band);
  return g;
}

// ---------------------------------------------------------------- game state
const GRAV = 10.5, BOTTOM = -7.8;
let state = 'ready', score = 0, R = rng(1), recorded = false, beatShown = false, theme;
let things = [], halves = [], sliced = 0, goal = 20, misses = 0, waveT = 0, waveGap = 1.6, bombP = 0.12, maxPer = 3, shake = 0;
let swipeHits = 0, swipeT = 0, slowmo = 1;

function drawLives() { livesEl.innerHTML = [0, 1, 2].map(i => `<span class="${i < misses ? 'x' : ''}" style="${i < misses ? '' : 'opacity:.45'}">✕</span>`).join(''); }
function buildLevel() {
  theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', theme.ui);
  if (boardMat.map) boardMat.map.dispose(); boardMat.map = woodTex(theme); boardMat.needsUpdate = true;
  R = rng((D.seed || level * 9973) + 5);
  const fk = F.k();
  goal = 12 + level * 4;
  waveGap = clamp((1.35 - level * 0.04) / fk, 0.6, 1.6);
  bombP = clamp((0.08 + level * 0.02) * fk, 0.05, 0.38);
  maxPer = clamp(2 + Math.floor(level / 2), 2, 6);
  for (const t of things) scene.remove(t.g); for (const h of halves) scene.remove(h.g);
  for (const sp of splats) { sp.life = 0; sp.m.material.opacity = 0; }
  things = []; halves = []; sliced = 0; misses = 0; score = 0; waveT = 0.5; recorded = false; beatShown = false;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : ''); drawLives();
}
function toss(kind, x, apex, delay = 0) {
  const g = kind === 'bomb' ? makeBomb() : makeWhole(kind);
  const vy = Math.sqrt(2 * GRAV * (apex - BOTTOM)), vx = clamp(-x * (0.35 + R() * 0.35) + (R() - 0.5) * 0.8, -2.2, 2.2);
  const t = { g, kind, x, y: BOTTOM, vx, vy, spin: new THREE.Vector3((R() - 0.5) * 4, (R() - 0.5) * 4, (R() - 0.5) * 4), delay, live: true, r: kind === 'bomb' ? 0.76 : FRUITS[kind].r * Math.max(...FRUITS[kind].sc) };
  g.position.set(x, BOTTOM, 0); g.visible = delay <= 0; scene.add(g); things.push(t);
  if (delay <= 0) tone(240 + R() * 80, 0.08, 'sine', 0.05, 1.6);
}
function wave() {
  const n = 1 + Math.floor(R() * maxPer), pattern = R();
  for (let i = 0; i < n; i++) {
    const x = pattern < 0.4 ? (R() * 2 - 1) * 2.2 : -2.2 + (i + 0.5) * 4.4 / n;
    const isBomb = sliced > 2 && R() < bombP && !(n === 1 && things.length === 0 && R() < 0.5);
    toss(isBomb ? 'bomb' : KINDS[Math.floor(R() * KINDS.length)], x, 1.4 + R() * 3.6, pattern > 0.75 ? i * 0.18 : 0);
  }
}

// ---------------------------------------------------------------- slicing
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function toScreen(p) { _v.copy(p).project(camera); return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight }; }
function pxRadius(t) { const c = toScreen(t.g.position), e = toScreen(_w.copy(t.g.position).setX(t.g.position.x + t.r)); return Math.abs(e.x - c.x); }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let k = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; k = clamp(k, 0, 1); return Math.hypot(px - ax - dx * k, py - ay - dy * k); }
function sliceSeg(ax, ay, bx, by) {
  if (state !== 'play') return;
  for (const t of things) {
    if (!t.live || t.delay > 0) continue;
    const c = toScreen(t.g.position), rp = pxRadius(t);
    if (segDist(c.x, c.y, ax, ay, bx, by) < rp * 0.95) cut(t, bx - ax, by - ay);
  }
}
function cut(t, sdx, sdy) {
  t.live = false; scene.remove(t.g);
  if (t.kind === 'bomb') return boom(t);
  const f = FRUITS[t.kind], L = Math.hypot(sdx, sdy) || 1;
  // swipe direction in world (screen y is down) and the cut normal perpendicular to it
  const dx = sdx / L, dy = -sdy / L, nx = -dy, ny = dx;
  for (const s of [1, -1]) {
    const h = makeHalf(t.kind); h.position.copy(t.g.position);
    h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx * s, ny * s, 0.25 * s).normalize());
    scene.add(h);
    halves.push({ g: h, vx: t.vx * 0.6 + nx * s * 1.8 + dx * 0.8, vy: Math.max(t.vy * 0.4, 0) + ny * s * 1.8 + 1.2, spin: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, s * (1 + Math.random() * 2)), life: 2.5 });
  }
  const p = t.g.position.clone(); p.z = 0.4;
  burst(scene, p, [f.juice, f.flesh, '#ffffff'], 16, { speed: 0.09, up: 0.05, size: 0.55, shape: 'sphere', gravity: 0.006 });
  splat(p.x, p.y, f.juice, 1.6 + t.r * 1.8);
  sliced++; swipeHits++; swipeT = 0.32;
  score += 1; ui.score(score); checkBeat();
  ui.progress(sliced / goal);
  tone(900 + Math.random() * 300, 0.06, 'sawtooth', 0.04, 0.4); tone(320 + swipeHits * 40, 0.09, 'triangle', 0.11, 0.7); buzz(8);
  t.g.scale.setScalar(1.1);
  if (sliced >= goal && state === 'play') setTimeout(win, 450);
}
function endSwipe() {
  if (swipeHits >= 3) { const bonus = swipeHits; score += bonus; ui.score(score); checkBeat(); ui.pop(`${swipeHits} FRUIT COMBO +${bonus}`, '#fff36b', 34, 30); tone(1046, 0.18, 'triangle', 0.12, 1); setTimeout(() => tone(1318, 0.2, 'triangle', 0.12, 1), 90); buzz([10, 20, 10]); ui.flash(0.25); }
  else if (swipeHits === 2) ui.pop('DOUBLE!', '#fff', 28, 30);
  swipeHits = 0;
}
function boom(t) {
  const p = t.g.position.clone();
  shake = 1.4; ui.flash(0.95); sfx.smash(); buzz([80, 40, 160]);
  burst(scene, p, ['#ffffff', '#ffdd55', '#ff7b2e', '#2b2d42'], 50, { speed: 0.28, up: 0.1, size: 1.2, gravity: 0.002 });
  ui.pop('BOOM!', '#fff', 64, 34);
  lose('BOOM!', `${sliced} / ${goal} fruit · bombs end the round`);
}
function miss(t) {
  if (t.kind === 'bomb' || state !== 'play') return;
  misses++; drawLives(); tone(180, 0.15, 'sine', 0.1, 0.6); buzz(30);
  const s = toScreen(_w.set(t.x, -6, 0)); ui.pop('✕', '#ff3d3d', 40, 86);
  if (misses >= 3) lose('DROPPED!', `${sliced} / ${goal} fruit · catch them before they fall`);
}
function checkBeat() {
  if (score > best) { best = score; S.set('best', best); }
  if (!beatShown && D.beaten(score)) { beatShown = true; ui.pop('BEATEN!', '#fff36b', 44, 44); confetti(scene, new THREE.Vector3(0, 2, 1), 60); }
}
function win() {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); }
  level++; S.set('level', level);
  for (const t of things) if (t.live) { t.live = false; scene.remove(t.g); }
  confetti(scene, new THREE.Vector3(0, 1, 1), 130); sfx.win(); buzz([20, 40, 20, 40, 60]);
  D.won(score); ui.win(level - 1, `${score} pts · ${sliced} fruit`);
}
function lose(t, line) {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, clamp(sliced / goal, 0, 1)); }
  setTimeout(() => sfx.fail(), 200);
  ui.lose(t, line);
}

// ---------------------------------------------------------------- input + blade trail
let pts = [], last = null;
function resize() { cv.width = innerWidth * Math.min(devicePixelRatio, 2); cv.height = innerHeight * Math.min(devicePixelRatio, 2); }
addEventListener('resize', resize); resize();
input({
  onDown: (e) => { last = [e.clientX, e.clientY]; pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); },
  onMove: (dx, dy, e) => { if (!last) return; const p = [e.clientX, e.clientY]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 3) { sliceSeg(last[0], last[1], p[0], p[1]); if (Math.hypot(dx, dy) > 14 && Math.random() < 0.3) tone(1400 + Math.random() * 400, 0.04, 'sine', 0.015, 0.5); } last = p; pts.push({ x: p[0], y: p[1], t: performance.now() }); },
  onUp: () => { last = null; },
});
ui.onTap(() => { buildLevel(); state = 'play'; ui.els.sc.classList.remove('hc-hidden'); });
function drawTrail() {
  const now = performance.now(), k = cv.width / innerWidth;
  pts = pts.filter(p => now - p.t < 140);
  cx.clearRect(0, 0, cv.width, cv.height);
  if (pts.length < 2) return;
  cx.lineCap = 'round'; cx.lineJoin = 'round';
  for (const [w, col] of [[16, 'rgba(255,255,255,.35)'], [8, 'rgba(255,255,255,.95)']]) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], age = (now - b.t) / 140;
      if (b.t - a.t > 60) continue;
      cx.strokeStyle = col; cx.lineWidth = w * k * (1 - age); cx.beginPath(); cx.moveTo(a.x * k, a.y * k); cx.lineTo(b.x * k, b.y * k); cx.stroke();
    }
  }
}

// ---------------------------------------------------------------- loop
loop((rawDt, t) => {
  const dt = rawDt / 60;
  if (state === 'play') {
    waveT -= dt;
    if (waveT <= 0 && things.filter(x => x.live).length < maxPer + 1) { wave(); waveT = waveGap * (0.8 + R() * 0.5); }
  }
  if (swipeT > 0) { swipeT -= dt; if (swipeT <= 0) endSwipe(); }
  const sdt = dt * (state === 'lost' ? 0.25 : 1);
  for (const o of things) {
    if (!o.live) continue;
    if (o.delay > 0) { o.delay -= sdt; if (o.delay <= 0) { o.g.visible = true; tone(260, 0.08, 'sine', 0.05, 1.6); } continue; }
    o.vy -= GRAV * sdt; o.x += o.vx * sdt; o.y += o.vy * sdt;
    o.g.position.set(o.x, o.y, 0); o.g.rotation.x += o.spin.x * sdt; o.g.rotation.y += o.spin.y * sdt; o.g.rotation.z += o.spin.z * sdt * 0.3;
    if (o.kind === 'bomb') { o.g.spark.scale.setScalar(0.7 + Math.random() * 0.8); o.g.rotation.x *= 0.98; }
    if (o.y < BOTTOM - 0.5 && o.vy < 0) { o.live = false; scene.remove(o.g); miss(o); }
  }
  things = things.filter(o => o.live);
  for (const h of halves) { h.vy -= GRAV * sdt; h.g.position.x += h.vx * sdt; h.g.position.y += h.vy * sdt; h.g.rotation.x += h.spin.x * sdt; h.g.rotation.y += h.spin.y * sdt; h.g.rotation.z += h.spin.z * sdt; h.life -= sdt; if (h.g.position.y < BOTTOM - 1 || h.life <= 0) { scene.remove(h.g); h.dead = true; } }
  halves = halves.filter(h => !h.dead);
  for (const s of splats) if (s.life > 0) { s.life -= dt * 0.28; s.m.material.opacity = Math.max(0, s.life) * 0.75; }
  shake = Math.max(0, shake - dt * 2);
  camera.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 14); camera.lookAt(0, 0, 0);
  drawTrail();
});

theme = THEMES[(level - 1) % THEMES.length];
buildLevel(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const cand = things.filter(o => o.live && o.delay <= 0 && o.kind !== 'bomb' && o.y > -5.6 && o.y < 5.5).sort((a, b) => a.y - b.y);
    for (const o of cand) {
      const c = toScreen(o.g.position);
      for (let k = 0; k < 6; k++) {
        const a = Math.random() * Math.PI, ux = Math.cos(a) * 70, uy = Math.sin(a) * 70;
        const ax = c.x - ux, ay = c.y - uy, bx = c.x + ux, by = c.y + uy;
        const hitsBomb = things.some(b => b.live && b.kind === 'bomb' && b.delay <= 0 && (() => { const bc = toScreen(b.g.position); return segDist(bc.x, bc.y, ax, ay, bx, by) < pxRadius(b) + 30; })());
        if (hitsBomb) continue;
        const now = performance.now(); pts.push({ x: ax, y: ay, t: now - 30 }, { x: c.x, y: c.y, t: now - 15 }, { x: bx, y: by, t: now });
        sliceSeg(ax, ay, bx, by); return;
      }
    }
  },
};

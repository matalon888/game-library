// Spin Bakes: Cake Decorating Game — original cake-decorating game. Hold to pipe icing rings on a spinning cake
// (release and switch colour as each layer closes), smooth it with the scraper, shake toppings on top. Match the order.
// Inspired by the mechanic of Icing on the Cake (Crazy Labs). All code and art original (three.js primitives).
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Spin Bakes: Cake Decorating Game';
const $ = (id) => document.getElementById(id);
const ST = store('spinbakes');
const F = flow('spinbakes');
let level = ST.get('level', 1), best = ST.get('best', 0), score = ST.get('score', 0);
const ui = createUI({ title: 'SPIN<br>BAKES', hint: 'Hold to pipe the icing', hand: '🎂', score: false });
const D = daily('spinbakes', ui, { name: NAME });
const stage = createStage({ fov: 36, shadowSize: 5 });
const { scene, camera } = stage;
stage.followLight(new THREE.Vector3(0, 1, 0));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ catalogue
const ICING = ['#ff7eb6', '#fff4e6', '#7ee0b8', '#7a4a32', '#6ec6ff', '#ffe066', '#c3a6ff', '#2a8f9f', '#ff6b5e'];
const ICING_NAMES = ['pink', 'vanilla', 'mint', 'choc', 'blue', 'lemon', 'lilac', 'teal', 'coral'];
const TOPS = ['sprinkles', 'cherries', 'chips', 'pearls', 'stars'];
const WALLS = [['#ffb4a2', '#ffd6c9'], ['#9fd8c7', '#d4f3ea'], ['#a8c5ff', '#dde8ff'], ['#ffd27a', '#fff0c9'], ['#d6b4ff', '#f0e2ff'], ['#ff9fb8', '#ffe0ea']];
const ORDERS = ['Happy 3rd birthday, Mr. Whiskers', 'Gender reveal (it\'s a goldfish)', 'Retirement: Dave. FINALLY.', 'Sorry I ate your cake cake', 'Congrats on the driving test (4th try)',
  'Wedding #2, same guy', 'Office party, nobody reads these', 'Happy un-birthday, Gran', 'Passed my exams, barely', 'The dog graduated!', 'Moving out — bye mum', 'Team won 1–0 on a fluke'];

// ------------------------------------------------------------------ set: table, turntable
const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), mat('#fbf7f4', { roughness: 0.9 }));
table.rotation.x = -Math.PI / 2; table.position.z = 8; table.receiveShadow = true; scene.add(table);
const ttMat = glossy('#e9e9ef', { roughness: 0.25 });
const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.12, 40), ttMat); foot.position.y = 0.06; foot.castShadow = true; foot.receiveShadow = true; scene.add(foot);
const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 20), mat('#8a8a99', { metalness: 0.4, roughness: 0.3 })); post.position.y = 0.37; post.castShadow = true; scene.add(post);
const spin = new THREE.Group(); spin.position.y = 0.62; scene.add(spin);
const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.75, 0.13, 56), ttMat); plate.castShadow = true; plate.receiveShadow = true; spin.add(plate);
const R = 1.2, H = 1.55, Y0 = 0.07;
const crumbC = document.createElement('canvas'); crumbC.width = 256; crumbC.height = 128;
{ const x = crumbC.getContext('2d'); x.fillStyle = '#f2cf8d'; x.fillRect(0, 0, 256, 128); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${170 + Math.random() * 60},${110 + Math.random() * 50},50,${0.15 + Math.random() * 0.3})`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 128, 0.6 + Math.random() * 2.2, 0, 7); x.fill(); } }
const crumbTex = new THREE.CanvasTexture(crumbC); crumbTex.colorSpace = THREE.SRGBColorSpace; crumbTex.wrapS = THREE.RepeatWrapping; crumbTex.repeat.set(3, 1);
const sponge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 56), mat('#ffffff', { map: crumbTex, roughness: 0.95 })); sponge.position.y = Y0 + H / 2; sponge.castShadow = true; sponge.receiveShadow = true; spin.add(sponge);
const topMat = mat('#f2cf8d', { roughness: 0.6 });
const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.1, 56), topMat); topDisc.position.y = Y0 + H + 0.02; topDisc.receiveShadow = true; topDisc.castShadow = true; spin.add(topDisc);
const rimMat = glossy('#ffffff', { roughness: 0.35 });
const topRim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.04, 0.07, 10, 64), rimMat); topRim.rotation.x = Math.PI / 2; topRim.position.y = Y0 + H + 0.08; topRim.visible = false; spin.add(topRim);

// smooth icing shell: canvas texture, one texel block per (bin, band), alpha where scraped
const NB = 40;
const shellC = document.createElement('canvas'); shellC.width = NB * 4; shellC.height = 64; const shx = shellC.getContext('2d');
const shellTex = new THREE.CanvasTexture(shellC); shellTex.colorSpace = THREE.SRGBColorSpace;
const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.07, R + 0.07, H + 0.06, NB * 2, 1, true), new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.42, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
shell.position.y = Y0 + H / 2; shell.castShadow = true; spin.add(shell);
// cylinder UV u runs around starting at +z... we measure the angle of each u directly so bins line up
const uOfAngle = (a) => { a = ((a % TAU) + TAU) % TAU; return ((Math.atan2(Math.cos(a), Math.sin(a)) / TAU) + 1) % 1; };

// piped beads: tangential capsules, rows per band, one InstancedMesh
const ROWS = 9;
const beadGeo = new THREE.CapsuleGeometry(0.078, 0.11, 4, 10); beadGeo.rotateZ(Math.PI / 2);
const beads = new THREE.InstancedMesh(beadGeo, new THREE.MeshStandardMaterial({ roughness: 0.45 }), NB * ROWS);
beads.castShadow = true; beads.frustumCulled = false; beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage); spin.add(beads);
const bScale = new Float32Array(NB * ROWS), bGoal = new Float32Array(NB * ROWS);
const dummy = new THREE.Object3D(), colTmp = new THREE.Color();
for (let i = 0; i < NB * ROWS; i++) beads.setColorAt(i, colTmp.set('#ffffff'));
function placeBead(i, s) {
  const b = i % NB, row = Math.floor(i / NB), a = (b + 0.5 + (row % 2) * 0.5) / NB * TAU, y = Y0 + 0.09 + row * (H - 0.12) / (ROWS - 1);
  const r = R + 0.06 + (s > 0 ? 0.01 * Math.sin(b * 7 + row) : 0);
  dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r); dummy.rotation.set(0, -(a + Math.PI / 2), 0.25 * ((row % 2) - 0.5));
  dummy.scale.set(s, s * 0.95, s * 0.8); dummy.updateMatrix(); beads.setMatrixAt(i, dummy.matrix);
}

// toppings: one instanced mesh per kind, children of the spinning group
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.045 : 0.1, a = i * Math.PI / 5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); } return s; })();
const TOPGEO = {
  sprinkles: new THREE.CapsuleGeometry(0.024, 0.08, 3, 6),
  cherries: new THREE.SphereGeometry(0.12, 14, 10),
  chips: new THREE.ConeGeometry(0.065, 0.1, 10),
  pearls: new THREE.SphereGeometry(0.055, 12, 8),
  stars: new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 1 }),
};
TOPGEO.stars.rotateX(-Math.PI / 2);
const TOPMAT = { sprinkles: mat('#ffffff'), cherries: glossy('#e3123b', { roughness: 0.15 }), chips: mat('#4a2a1a', { roughness: 0.6 }), pearls: glossy('#f6f2ff', { roughness: 0.12, metalness: 0.3 }), stars: glossy('#ffd23f', { roughness: 0.25 }) };
const SPRINKLE_COLS = ['#ff4d6d', '#ffd23f', '#3a86ff', '#3ab795', '#ffffff', '#b06cff'];
const MAXT = 700, topMeshes = {}, topCount = {};
for (const k of TOPS) { const m = new THREE.InstancedMesh(TOPGEO[k], TOPMAT[k], MAXT); m.count = 0; m.castShadow = true; m.frustumCulled = false; spin.add(m); topMeshes[k] = m; topCount[k] = 0; if (k === 'sprinkles') for (let i = 0; i < MAXT; i++) m.setColorAt(i, colTmp.set(SPRINKLE_COLS[i % SPRINKLE_COLS.length])); }

// tools
const bag = new THREE.Group();
{ const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#fff7e8', roughness: 0.35, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  cone.rotation.z = Math.PI / 2; cone.position.x = 0.75;
  const fill = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 20), mat('#ff7eb6')); fill.rotation.z = Math.PI / 2; fill.position.x = 0.8; bag.userData.fill = fill;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.22, 8), glossy('#d9dbe5', { metalness: 0.6 })); tip.rotation.z = Math.PI / 2; tip.position.x = 0.08;
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), mat('#fff7e8')); tail.scale.set(0.35, 1, 1); tail.position.x = 1.38;
  bag.add(fill, cone, tip, tail); bag.traverse(o => o.castShadow = true); }
scene.add(bag); bag.visible = false;
const scraper = new THREE.Group();
{ const blade = new THREE.Mesh(rounded(0.04, H + 0.3, 0.5, 0.015), glossy('#cfd3de', { metalness: 0.7, roughness: 0.2 })); blade.position.z = 0;
  const handle = new THREE.Mesh(rounded(0.16, 0.5, 0.3, 0.07), glossy('#3a86ff')); handle.position.set(0.05, H * 0.5 + 0.25, 0.1);
  scraper.add(blade, handle); scraper.traverse(o => o.castShadow = true); }
scene.add(scraper); scraper.visible = false;
const shaker = new THREE.Group();
{ const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 0.1 }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 20), glossy('#ff5d8f')); cap.position.y = -0.36;
  const inside = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 16), mat('#ffd23f')); inside.position.y = 0.06; shaker.userData.inside = inside;
  shaker.add(jar, cap, inside); shaker.traverse(o => o.castShadow = true); }
scene.add(shaker); shaker.visible = false;
const falling = [];

// ------------------------------------------------------------------ level
let L;
function genLevel(lv) {
  const r = rng((D.seed || 0) + lv * 7919 + 21), fk = F.k();
  const K = lv <= 1 ? 2 : lv <= 4 ? 3 : (r() < 0.5 ? 3 : 4);
  const order = ICING.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const nCol = Math.min(K, lv <= 2 ? 2 : 3), pal = order.slice(0, nCol), bands = [];
  for (let k = 0; k < K; k++) { let c, t = 0; do { c = pal[Math.floor(r() * nCol)]; t++; } while (t < 20 && (k === 0 ? false : c === bands[k - 1] && r() < 0.8)); bands.push(c); }
  const opts = order.slice(0, Math.min(5, nCol + 1 + (lv >= 3 ? 1 : 0)));
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  const top = TOPS[Math.floor(r() * TOPS.length)], topOpts = [top];
  while (topOpts.length < Math.min(4, 2 + Math.floor(lv / 2))) { const t = TOPS[Math.floor(r() * TOPS.length)]; if (!topOpts.includes(t)) topOpts.push(t); }
  topOpts.sort(() => r() - 0.5);
  return { K, bands, opts, top, topOpts, omega: clamp((2.3 + lv * 0.05) * fk, 1.8, 3.8), thr: clamp((0.7 + (lv - 1) * 0.012) * fk, 0.6, 0.93),
    wall: WALLS[(lv - 1) % WALLS.length], order: ORDERS[Math.floor(r() * ORDERS.length)] };
}
function topIcon(c, k, x, y, s) {
  c.save(); c.translate(x, y);
  if (k === 'sprinkles') { for (let i = 0; i < 3; i++) { c.strokeStyle = SPRINKLE_COLS[i * 2]; c.lineWidth = s * 0.14; c.lineCap = 'round'; c.beginPath(); const a = i * 1.1 + 0.3; c.moveTo(-s * 0.3 + i * s * 0.3 - Math.cos(a) * s * 0.15, -Math.sin(a) * s * 0.15); c.lineTo(-s * 0.3 + i * s * 0.3 + Math.cos(a) * s * 0.15, Math.sin(a) * s * 0.15); c.stroke(); } }
  else if (k === 'cherries') { c.fillStyle = '#e3123b'; c.beginPath(); c.arc(0, s * 0.08, s * 0.3, 0, 7); c.fill(); c.strokeStyle = '#3d7a2a'; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(0, -s * 0.2); c.quadraticCurveTo(s * 0.1, -s * 0.45, s * 0.3, -s * 0.48); c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-s * 0.1, 0, s * 0.07, 0, 7); c.fill(); }
  else if (k === 'chips') { c.fillStyle = '#4a2a1a'; c.beginPath(); c.moveTo(0, -s * 0.32); c.quadraticCurveTo(s * 0.12, 0, s * 0.3, s * 0.25); c.lineTo(-s * 0.3, s * 0.25); c.quadraticCurveTo(-s * 0.12, 0, 0, -s * 0.32); c.fill(); }
  else if (k === 'pearls') { for (const [dx, dy] of [[-0.18, 0.1], [0.18, 0.1], [0, -0.16]]) { c.fillStyle = '#e8e4f5'; c.beginPath(); c.arc(dx * s, dy * s, s * 0.16, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(dx * s - s * 0.05, dy * s - s * 0.05, s * 0.05, 0, 7); c.fill(); } }
  else { c.fillStyle = '#ffd23f'; c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? s * 0.16 : s * 0.38, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
  c.restore();
}
function drawCake(c, W, Hh, bands, top) {
  c.clearRect(0, 0, W, Hh);
  const cx = W / 2, w = W * 0.7, h = Hh * 0.5, y1 = Hh * 0.85, y0 = y1 - h, e = w * 0.2;
  c.fillStyle = '#e4e4ec'; c.beginPath(); c.ellipse(cx, y1 + 2, w * 0.66, e * 0.9, 0, 0, 7); c.fill();
  const K = bands.length;
  for (let k = 0; k < K; k++) {
    const yb = y1 - k * h / K, yt = y1 - (k + 1) * h / K;
    c.fillStyle = ICING[bands[k]]; c.beginPath(); c.moveTo(cx - w / 2, yt); c.lineTo(cx - w / 2, yb); c.ellipse(cx, yb, w / 2, e / 2, 0, Math.PI, 0, true); c.lineTo(cx + w / 2, yt); c.closePath(); c.fill();
  }
  const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(0.35, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
  c.fillStyle = g; c.fillRect(cx - w / 2, y0, w, h);
  c.fillStyle = ICING[bands[K - 1]]; c.beginPath(); c.ellipse(cx, y0, w / 2, e / 2, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(cx, y0, w / 2, e / 2, 0, 0, 7); c.fill();
  if (top) { const r = rng(5); for (let i = 0; i < 9; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.8; topIcon(c, top, cx + Math.cos(a) * d * w / 2, y0 + Math.sin(a) * d * e / 2 - 4, W * 0.11); } }
}
function drawTarget() { drawCake($('tgtc').getContext('2d'), 184, 248, L.bands, L.top); $('tgtName').textContent = 'TODAY\'S ORDER'; }

// ------------------------------------------------------------------ UI rows
const show = (id, on) => $(id).classList.toggle('off', !on);
function buildRows() {
  $('icings').innerHTML = L.opts.map(c => `<button class="ice" data-c="${c}" style="background:${ICING[c]}"></button>`).join('');
  $('icings').querySelectorAll('.ice').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectIcing(+b.dataset.c); }));
  $('tops').innerHTML = L.topOpts.map(k => { const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#fff1e8'; x.beginPath(); x.arc(40, 40, 36, 0, 7); x.fill(); topIcon(x, k, 40, 42, 64); return `<button class="opt" data-k="${k}"><svg viewBox="0 0 80 80"><image href="${c.toDataURL()}" width="80" height="80"/></svg>${k.toUpperCase()}</button>`; }).join('');
  $('tops').querySelectorAll('.opt').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectTop(b.dataset.k); }));
}
$('done').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase === 'top' && state === 'play') startReveal(); });

// ------------------------------------------------------------------ state
let state = 'ready', phase = 'pipe', phT = 0, sel = -1, selTop = null, band = 0, pauseT = 0, holding = false, rot = 0, omegaNow = 0;
let bins = [], smoothBins = new Uint8Array(NB), topCells = new Uint8Array(36), pieces = { }, finished = false, beatenShown = false, match = 0, parts = {};
let shakerX = 0, botHold = false;
function bandOfRow(row) { return Math.min(L.K - 1, Math.floor(row / ROWS * L.K)); }
function selectIcing(c) { sel = c; $('icings').querySelectorAll('.ice').forEach(b => b.classList.toggle('on', +b.dataset.c === c)); bag.userData.fill.material.color.set(ICING[c]); sfx.pick(2); buzz(8); }
function selectTop(k) { selTop = k; $('tops').querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o.dataset.k === k)); shaker.userData.inside.material.color.set(k === 'sprinkles' ? '#ff7eb6' : TOPMAT[k].color); shaker.visible = true; sfx.pick(3); buzz(8); }
function bandFill(k) { let n = 0; for (let b = 0; b < NB; b++) if (bins[k][b] >= 0) n++; return n / NB; }
function bandMatch(k) { let n = 0; for (let b = 0; b < NB; b++) if (bins[k][b] === L.bands[k]) n++; return n / NB; }
function buildLevel() {
  L = genLevel(level); phase = 'pipe'; phT = 0; band = 0; pauseT = 0; sel = -1; selTop = null; finished = false; parts = {}; holding = false; botHold = false;
  bins = []; for (let k = 0; k < L.K; k++) bins.push(new Int8Array(NB).fill(-1));
  smoothBins.fill(0); topCells.fill(0);
  bScale.fill(0); bGoal.fill(0); for (let i = 0; i < NB * ROWS; i++) placeBead(i, 0.0001); beads.instanceMatrix.needsUpdate = true;
  shx.clearRect(0, 0, shellC.width, shellC.height); shellTex.needsUpdate = true;
  topMat.color.set('#f2cf8d'); topRim.visible = false;
  for (const k of TOPS) { topMeshes[k].count = 0; topCount[k] = 0; }
  falling.length = 0;
  document.body.style.background = `linear-gradient(180deg, ${L.wall[0]} 0%, ${L.wall[1]} 52%, #fbf7f4 52.2%)`;
  ui.levels(level); ui.progress(0); drawTarget(); buildRows();
  $('bub').textContent = `“${L.order}”`;
  $('banner').classList.remove('on', 'bad');
  ['icings', 'tops', 'done'].forEach(id => show(id, false));
  bag.visible = scraper.visible = shaker.visible = false;
  if (state === 'play') beginPipe(); else show('ask', false);
}
function setAsk(t) { $('ask').textContent = t; show('ask', true); }
function beginPipe() { phase = 'pipe'; setAsk('Hold to pipe the icing'); show('icings', true); selectIcing(L.opts.includes(L.bands[0]) ? L.opts[0] : L.opts[0]); bag.visible = true; }
function pipeStep(dt) {
  if (pauseT > 0) { pauseT -= dt / 60; return; }
  const local = 0.0 + rot, b = Math.floor((((local % TAU) + TAU) % TAU) / TAU * NB) % NB;
  // lay a short arc ahead of the nozzle each frame so fast spins don't skip bins
  for (const bb of [b, (b + NB - 1) % NB]) {
    if (bins[band][bb] !== -1 && bins[band][bb] === sel) continue;
    const fresh = bins[band][bb] === -1; bins[band][bb] = sel;
    for (let row = 0; row < ROWS; row++) if (bandOfRow(row) === band) { const i = row * NB + bb; bGoal[i] = 1; if (fresh) bScale[i] = 0.2; beads.setColorAt(i, colTmp.set(ICING[sel])); }
    beads.instanceColor.needsUpdate = true;
    if (fresh && bb % 3 === 0) tone(300 + band * 60 + Math.random() * 40, 0.06, 'sine', 0.06, 1.3);
  }
  ui.progress((band + bandFill(band)) / L.K * 0.6);
  if (bandFill(band) >= 1) {
    const ok = bandMatch(band);
    ui.pop(ok > 0.95 ? 'PERFECT RING!' : ok > 0.75 ? 'NICE!' : 'OOPS, WRONG COLOUR', ok > 0.75 ? '#fff' : '#ffe066', 30, 30);
    note(67 + band * 4, 0.3); buzz(15); burst(scene, V(R + 0.2, spin.position.y + Y0 + (band + 0.5) * H / L.K, 0.3), [ICING[sel], '#ffffff'], 10, { shape: 'sphere', speed: 0.06, up: 0.05, size: 0.5 });
    band++; pauseT = 0.45;
    if (band >= L.K) beginSmooth(); else setAsk(`Layer ${band + 1}: ${ICING_NAMES[L.bands[band]]}?`);
  }
}
function beginSmooth() {
  parts.bands = 0; for (let k = 0; k < L.K; k++) parts.bands += bandMatch(k) / L.K;
  phase = 'smooth'; bag.visible = false; scraper.visible = true; show('icings', false); setAsk('Hold to smooth it out'); sfx.coin();
}
function smoothStep() {
  const b = Math.floor((((rot + 0.95) % TAU + TAU) % TAU) / TAU * NB) % NB;
  for (const bb of [b, (b + NB - 1) % NB]) {
    if (smoothBins[bb]) continue; smoothBins[bb] = 1;
    for (let k = 0; k < L.K; k++) {
      shx.fillStyle = ICING[bins[k][bb]] || '#fff';
      const u = uOfAngle((bb + 0.5) / NB * TAU), x = u * shellC.width, w = shellC.width / NB + 2;
      const y0 = (1 - (k + 1) / L.K) * shellC.height, y1 = (1 - k / L.K) * shellC.height;
      shx.fillRect(x - w / 2, y0 - (k === L.K - 1 ? 2 : 0), w, y1 - y0 + (k === 0 ? 2 : 0));
      if (x < w) shx.fillRect(x - w / 2 + shellC.width, y0, w, y1 - y0); if (x > shellC.width - w) shx.fillRect(x - w / 2 - shellC.width, y0, w, y1 - y0);
    }
    for (let row = 0; row < ROWS; row++) bGoal[row * NB + bb] = 0;
    shellTex.needsUpdate = true;
    if (bb % 2 === 0) tone(180 + Math.random() * 30, 0.08, 'triangle', 0.05, 0.9);
  }
  const f = smoothBins.reduce((a, v) => a + v, 0) / NB; ui.progress(0.6 + f * 0.2);
  if (f >= 1) {
    parts.smooth = 1; topMat.color.set(ICING[bins[L.K - 1][0]] || '#fff'); topRim.visible = true; rimMat.color.set(ICING[bins[L.K - 1][0]] || '#fff');
    ui.pop('SO SMOOTH!', '#fff', 32, 30); note(79, 0.35); buzz(15);
    phase = 'top'; scraper.visible = false; setAsk('Pick a topping · hold to shake'); show('tops', true);
  }
}
function topStep() {
  if (!selTop) return;
  for (let q = 0; q < 1; q++) {
    const x = clamp(shakerX + (Math.random() - 0.5) * 0.35, -R * 0.95, R * 0.95), z = (Math.random() - 0.5) * 0.3;
    falling.push({ k: selTop, wx: x, wz: z, y: spin.position.y + Y0 + H + 1.0, vy: 0 });
    if (Math.random() < 0.3) tone(1200 + Math.random() * 800, 0.03, 'triangle', 0.04, 1);
  }
}
function land(f) {
  // world -> spinning-cake local
  const a = Math.atan2(f.wz, f.wx), d = Math.hypot(f.wx, f.wz), la = a + rot;
  const m = topMeshes[f.k], full = topCount[f.k] >= MAXT;
  const lx = Math.cos(la) * d, lz = Math.sin(la) * d;
  dummy.position.set(lx, Y0 + H + 0.1 + (f.k === 'cherries' ? 0.06 : 0.02), lz); dummy.rotation.set(f.k === 'sprinkles' ? Math.PI / 2 : 0, Math.random() * TAU, 0); dummy.scale.setScalar(0.85); dummy.updateMatrix();
  if (!full) m.setMatrixAt(topCount[f.k]++, dummy.matrix); m.count = topCount[f.k]; m.instanceMatrix.needsUpdate = true;
  if (f.k === L.top || true) { const ring = Math.min(2, Math.floor((d / R) ** 2 * 3)), sec = Math.floor((((la % TAU) + TAU) % TAU) / TAU * 12) % 12; if (f.k === selTop) topCells[ring * 12 + sec] = f.k === L.top ? 2 : 1; }
  const cov = topCells.reduce((a, v) => a + (v ? 1 : 0), 0) / 36; ui.progress(0.8 + 0.2 * cov);
  if (cov > 0.85) { $('done').classList.add('go'); }
  if (phase === 'top') show('done', cov > 0.4);
}
function startReveal() {
  const good = topCells.reduce((a, v) => a + (v === 2 ? 1 : 0), 0) / 36, any = topCells.reduce((a, v) => a + (v ? 1 : 0), 0) / 36;
  parts.top = clamp(good / 0.85, 0, 1) * 0.9 + (good > 0 ? 0.1 : 0) - (any - good) * 0.3;
  parts.top = clamp(parts.top, 0, 1); parts.smooth = parts.smooth || 0;
  phase = 'reveal'; phT = 0; show('tops', false); show('done', false); show('ask', false); shaker.visible = false; ui.progress(1);
  tone(260, 0.7, 'sine', 0.09, 2.5); buzz(15);
}
function finish() {
  if (finished) return; finished = true;
  match = 0.45 * parts.bands + 0.15 * parts.smooth + 0.4 * parts.top;
  const pct = Math.round(match * 100), ok = match >= L.thr, stars = match >= 0.95 ? 3 : match >= 0.85 ? 2 : ok ? 1 : 0;
  $('stars').innerHTML = '★'.repeat(stars) + '<i>' + '★'.repeat(3 - stars) + '</i>';
  $('pct').textContent = ok ? `${pct}% MATCH` : `${pct}% · NEED ${Math.round(L.thr * 100)}%`;
  $('banner').classList.toggle('bad', !ok); $('banner').classList.add('on'); ui.flash(0.5);
  if (ok) {
    state = 'won'; F.level(true); score += pct; ST.set('score', score); best = Math.max(best, score); ST.set('best', best);
    $('bub').textContent = stars === 3 ? '“It\'s PERFECT. I\'m crying.”' : '“Ooh, lovely!”';
    sfx.win(); buzz([20, 40, 20]); confetti(scene, V(0, 3, 0), 80); setTimeout(() => confetti(scene, V(0, 3, -0.5), 60), 250);
    if (!beatenShown && D.beaten(score)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 34); confetti(scene, V(0, 3, 0), 50); }, 300); }
    D.won(score); ui.win(level, stars === 3 ? `Showstopper! · ${score} pts` : `${pct}% match · ${score} pts`);
  } else {
    state = 'lost'; F.level(false, Math.min(1, match / L.thr)); sfx.fail(); buzz([40, 30, 60]);
    $('bub').textContent = '“That is… not my cake.”';
    ui.lose('NOT QUITE!', `${pct}% match · need ${Math.round(L.thr * 100)}%`);
  }
}
ui.onTap((which) => {
  if (which === 'start') { state = 'play'; beginPipe(); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else { state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ input: hold anywhere, drag the shaker sideways
input({
  onDown: (e) => { if (e.target.closest && e.target.closest('button')) return; if (state !== 'play') return; holding = true; if (phase === 'top') shakerX = clamp((e.clientX / innerWidth - 0.5) * 3.2, -R, R); },
  onMove: (dx, dy, e) => { if (holding && phase === 'top') shakerX = clamp((e.clientX / innerWidth - 0.5) * 3.2, -R, R); },
  onUp: () => { holding = false; },
});

// ------------------------------------------------------------------ loop
const camPos = V(0, 4.4, 9.2), camLook = V(0, 1.25, 0), cp = V(), cl = V();
let frame = 0;
loop((dt, t) => {
  frame += dt; phT += dt / 60;
  const act = (holding || botHold) && state === 'play';
  const want = phase === 'reveal' ? 3.2 : act ? (phase === 'top' ? 2.2 : L.omega) : 0.35;
  omegaNow += (want - omegaNow) * 0.12 * dt; rot += omegaNow * dt / 60; spin.rotation.y = rot;
  if (act && phase === 'pipe' && sel >= 0) pipeStep(dt);
  if (act && phase === 'smooth') smoothStep();
  if (act && phase === 'top') topStep();
  // beads ease toward their goal size (pop when piped, sink when scraped)
  let dirty = false;
  for (let i = 0; i < NB * ROWS; i++) { const g = bGoal[i], s = bScale[i]; if (Math.abs(g - s) > 0.002) { bScale[i] = s + (g - s) * (g > s ? 0.3 : 0.18) * dt; placeBead(i, Math.max(0.0001, bScale[i])); dirty = true; } }
  if (dirty) beads.instanceMatrix.needsUpdate = true;
  // tools
  const by = spin.position.y + Y0 + (Math.min(band, L ? L.K - 1 : 0) + 0.5) * H / (L ? L.K : 2);
  if (bag.visible) { const sq = act && pauseT <= 0 ? Math.sin(t * 20) * 0.04 : 0; bag.position.lerp(V(R + 0.22, by, 0.25), 0.2 * dt); bag.rotation.set(0, -0.2, 0.18); bag.scale.set(1 - sq, 1 + sq, 1 + sq); }
  if (scraper.visible) { const a = 0.95; scraper.position.set(Math.cos(a) * (R + 0.12), spin.position.y + Y0 + H / 2, Math.sin(a) * (R + 0.12)); scraper.rotation.y = -a; scraper.position.x += act ? Math.sin(t * 25) * 0.01 : 0.15; }
  if (shaker.visible) { shaker.position.lerp(V(shakerX, spin.position.y + Y0 + H + 1.25 + (act ? Math.abs(Math.sin(t * 18)) * 0.15 : 0.2), 0), 0.25 * dt); shaker.rotation.z = act ? Math.sin(t * 18) * 0.25 : 0; }
  for (let i = falling.length - 1; i >= 0; i--) { const f = falling[i]; f.vy -= 0.006 * dt; f.y += f.vy * dt * 2.2; if (f.y <= spin.position.y + Y0 + H + 0.12) { land(f); falling.splice(i, 1); } }
  // camera
  if (phase === 'top' || phase === 'reveal') { cp.set(0, 7.4, 8.6); cl.set(0, 1.45, 0); } else { cp.set(0, 4.9, 11.2); cl.set(0, 1.3, 0); }
  camPos.lerp(cp, 0.05 * dt); camLook.lerp(cl, 0.06 * dt); camera.position.copy(camPos); camera.lookAt(camLook);
  if (phase === 'reveal') {
    if (Math.random() < 0.2) burst(scene, V((Math.random() - 0.5) * 3, 2.8, (Math.random() - 0.5) * 2), ['#ffffff', '#ffd23f'], 2, { shape: 'sphere', speed: 0.03, up: 0.04, size: 0.4 });
    if (phT > 1.3) finish();
  }
});

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get phase() { return phase; },
  bot() {
    if (state !== 'play') { botHold = false; return; }
    if (phase === 'pipe') {
      const want = L.bands[band]; if (sel !== want) { botHold = false; if (L.opts.includes(want)) selectIcing(want); return; }
      botHold = true;
      return;
    }
    if (phase === 'smooth') { botHold = true; return; }
    if (phase === 'top') {
      if (selTop !== L.top) { botHold = false; return selectTop(L.top); }
      const cov = topCells.reduce((a, v) => a + (v ? 1 : 0), 0) / 36;
      if (cov > 0.9) { botHold = false; return startReveal(); }
      let ring = 0, need = 99; for (let r = 0; r < 3; r++) { let n = 0; for (let s = 0; s < 12; s++) if (!topCells[r * 12 + s]) n++; if (n && n <= 12 && (need === 99 || n > need)) { need = n; ring = r; } }
      shakerX = Math.sqrt((ring + 0.5) / 3) * R * (Math.floor(frame / 20) % 2 ? 1 : -1); botHold = true; return;
    }
    botHold = false;
  },
};

buildLevel();
ui.start();

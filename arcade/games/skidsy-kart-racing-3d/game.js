// Skidsy — an original 3D kart racer: 8 cartoon racers, 4 code-built circuits with jumps, a dirt shortcut and boost pads,
// drift for mini-turbos, gem boxes with fair items, two cups. Every kart (yours and the CPUs') runs the same physics
// step with the same top speed: CPUs differ only in how well they drive. No catch-up speed, ever.
import { THREE, createStage, createUI, loop, store, sfx, tone, buzz, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { TRACKS, W, WALL, SW, RAMP_LEN, RAMP_H, buildTrack, buildMeshes } from './tracks.js';
import { DRIVERS, kartGeo, wheelGeo, WHEELS } from './karts.js';
import { bake, vcMat } from './merge.js';
import * as A from './audio.js';

const NAME = 'Skidsy: Kart Racing 3D';
const SAVE = store('skidsy');
const F = flow('skidsy');
const stage = createStage({ fov: 60, shadowSize: 34 });
const { scene, camera, renderer, sun, hemi } = stage;
camera.far = 1600; camera.updateProjectionMatrix();
sun.shadow.camera.far = 140; sun.intensity = 1.65;
const ui = createUI({ title: 'SKIDSY', hint: 'Tap to race', hand: '🏁', progress: false, score: false });
const D = daily('skidsy', ui, { name: NAME });
const B = board({ game: 'skidsy', label: 'Cup points', limits: { maxRun: 20000, maxPerSec: 90 }, corner: 'tl' });
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2, aw = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- rules (identical for every kart)
const TOP = 34, GRAV = 34, LAPS = 3, POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
const TIER_T = [0.8, 1.6, 2.5], TIER_BOOST = [0.55, 0.95, 1.35], TIER_COL = ['#6fd8ff', '#ffa53a', '#d16bff'], TIER_PTS = [10, 20, 30];
const DIFFS = [{ name: 'Easy', skill: 0.48, throttle: 0.9 }, { name: 'Normal', skill: 0.7, throttle: 0.955 }, { name: 'Hard', skill: 0.9, throttle: 1 }];
const CUPS = [{ id: 'sprout', name: 'Sprout Cup', emoji: '🌱', mirror: false }, { id: 'mirror', name: 'Mirror Cup', emoji: '🪞', mirror: true, need: 'Win a Sprout Cup trophy' }];
const ITEMS = {
  zip: { icon: '🌶️', name: 'Zip Pepper' }, triple: { icon: '🌶️', name: 'Triple Zip', n: 3 }, jelly: { icon: '🍮', name: 'Wobble Jelly' },
  ball: { icon: '🎾', name: 'Bonk Ball' }, bee: { icon: '🐝', name: 'Buzz Bee' }, shield: { icon: '🫧', name: 'Bubble' },
};
// item odds by race position — the same table for you and every CPU
const ODDS = [
  { jelly: 40, ball: 30, shield: 25, zip: 5 },
  { jelly: 22, ball: 30, shield: 15, zip: 20, bee: 8, triple: 5 },
  { jelly: 15, ball: 28, shield: 12, zip: 25, bee: 12, triple: 8 },
  { ball: 22, zip: 30, bee: 18, triple: 14, shield: 10, jelly: 6 },
  { ball: 18, zip: 30, bee: 20, triple: 20, shield: 8, jelly: 4 },
  { zip: 30, triple: 30, bee: 25, ball: 15 },
  { zip: 28, triple: 36, bee: 26, ball: 10 },
  { zip: 25, triple: 40, bee: 28, ball: 7 },
];
const pickItem = place => { const o = ODDS[clamp(place - 1, 0, 7)], tot = Object.values(o).reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (const k in o) { r -= o[k]; if (r <= 0) return k; } return 'zip'; };

// ---------------------------------------------------------------- save
let prof = Object.assign({ races: 0, wins: 0, podiums: 0, cups: {}, driver: 'pip', diff: 1, cup: 'sprout', bestCup: 0 }, SAVE.get('prof', {}));
const saveProf = () => SAVE.set('prof', prof);
const unlocked = d => d.id === 'mimi' ? prof.races >= 3 : d.id === 'duck' ? prof.wins >= 1 : d.id === 'bolt' ? Object.keys(prof.cups).length > 0 : d.id === 'tako' ? !!prof.cups.mirror : true;
const cupOpen = c => !c.mirror || !!prof.cups.sprout;
if (!unlocked(DRIVERS.find(d => d.id === prof.driver) || {})) prof.driver = 'pip';

// ---------------------------------------------------------------- HUD + menus
document.body.insertAdjacentHTML('beforeend', `
<div id="hud" class="off">
  <canvas id="mini" width="240" height="240"></canvas>
  <div id="pos"><b>8</b><sup>th</sup></div>
  <div id="lap">LAP <b>1</b>/${LAPS}</div>
  <div id="clock"><span id="time">0:00.0</span><span id="pts">★ 0</span></div>
  <button id="item" aria-label="Use item"><span id="itemIc"></span><i id="itemN"></i><em>ITEM</em></button>
  <div id="tier"><i></i><i></i><i></i></div>
  <div id="wrong" hidden>WRONG WAY ↺</div>
  <div id="hint">◀ drag to steer · hold a hard turn to drift ▶</div>
</div>
<div id="lines"></div>
<button id="mute" aria-label="Sound">🔊</button>`);
if (matchMedia('(pointer:fine)').matches) $('hint').textContent = '←/→ steer · hold Shift to drift · X item · Space in the air = trick';
const hud = $('hud'), mini = $('mini'), mctx = mini.getContext('2d');
const resHTML = '<div class="res"></div>';
ui.els.win.querySelector('[data-x]').insertAdjacentHTML('afterend', resHTML);
ui.els.lose.querySelector('[data-x]').insertAdjacentHTML('afterend', resHTML);
const winP = ui.els.win.querySelector('p'); winP.innerHTML = '<span data-l></span>';
const skipBtn = document.createElement('button'); skipBtn.className = 'hc-btn ghost'; skipBtn.textContent = 'Keep result ▸';
ui.els.lose.appendChild(skipBtn);
{ const sh = ui.els.win.querySelector('.hc-btn'); if (sh) ui.els.win.appendChild(sh); }
skipBtn.addEventListener('pointerdown', e => e.stopPropagation());
skipBtn.addEventListener('click', e => { e.stopPropagation(); ui.els.lose.classList.add('hc-hidden'); acceptRace(true); });
const menu = document.createElement('div'); menu.className = 'menu';
ui.els.start.querySelector('.hint').before(menu);
ui.els.start.querySelector('h1').insertAdjacentHTML('afterend', '<p class="tag">KART RACING</p>');
for (const t of ['pointerdown', 'click']) menu.addEventListener(t, e => { if (e.target.closest('button')) e.stopPropagation(); });
function renderMenu() {
  const d = DRIVERS.find(x => x.id === prof.driver);
  const medal = c => ({ 1: '🥇', 2: '🥈', 3: '🥉' })[prof.cups[c.id]] || '';
  menu.innerHTML = D.isDaily ? `<div class="cups"><button class="on">📅 Daily Cup</button></div><p class="fine">Today's 4 circuits, the same for everyone · Normal</p>`
    : `<div class="cups">${CUPS.map(c => `<button data-cup="${c.id}" class="${prof.cup === c.id ? 'on' : ''} ${cupOpen(c) ? '' : 'lock'}">${c.emoji} ${c.name} ${cupOpen(c) ? medal(c) : '🔒'}</button>`).join('')}</div>
    <div class="seg">${DIFFS.map((x, i) => `<button data-diff="${i}" class="${prof.diff === i ? 'on' : ''}">${x.name}</button>`).join('')}</div>`;
  menu.innerHTML += `<div class="drv"><button data-drv="-1">◀</button><div class="who"><b>${d.emoji} ${d.name}</b><small>${DRIVERS.filter(unlocked).length}/8 racers</small></div><button data-drv="1">▶</button></div>
    <p class="fine">${prof.bestCup ? `Best cup ★ ${prof.bestCup.toLocaleString()} · ` : ''}Same physics for every kart · no catch-up speed</p>`;
  menu.querySelectorAll('[data-cup]').forEach(b => b.onclick = () => { const c = CUPS.find(x => x.id === b.dataset.cup); if (!cupOpen(c)) { ui.pop('🔒 ' + c.need, '#fff', 20, 60); return; } prof.cup = c.id; saveProf(); renderMenu(); previewTrack(); sfx.tap(); });
  menu.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { prof.diff = +b.dataset.diff; saveProf(); renderMenu(); sfx.tap(); });
  menu.querySelectorAll('[data-drv]').forEach(b => b.onclick = () => {
    const i = DRIVERS.findIndex(x => x.id === prof.driver); let j = i;
    for (let k = 0; k < 8; k++) { j = (j + +b.dataset.drv + 8) % 8; if (unlocked(DRIVERS[j])) break; }
    prof.driver = DRIVERS[j].id; saveProf(); renderMenu(); setPlayer(); sfx.pick(j);
  });
  const locked = DRIVERS.filter(x => !unlocked(x));
  if (locked.length) menu.querySelector('.drv small').textContent = `${8 - locked.length}/8 racers · next: ${locked[0].emoji} ${locked[0].need.toLowerCase()}`;
}
$('mute').addEventListener('pointerdown', e => e.stopPropagation());
$('mute').addEventListener('click', e => { e.stopPropagation(); A.setMuted(!A.isMuted()); $('mute').textContent = A.isMuted() ? '🔇' : '🔊'; SAVE.set('mute', A.isMuted()); });
if (SAVE.get('mute', false)) { A.setMuted(true); $('mute').textContent = '🔇'; }

// ---------------------------------------------------------------- karts
const kartMat = vcMat({ roughness: 0.38 });
const wheelMesh = new THREE.InstancedMesh(wheelGeo(), vcMat({ roughness: 0.6 }), 32); wheelMesh.castShadow = true; wheelMesh.frustumCulled = false; scene.add(wheelMesh);
const shieldGeo = new THREE.SphereGeometry(1.9, 24, 16), shieldMat = new THREE.MeshStandardMaterial({ color: '#8fe8ff', transparent: true, opacity: 0.3, roughness: 0.1, emissive: '#5fd0ff', emissiveIntensity: 0.4, depthWrite: false });
const racers = DRIVERS.map(d => {
  const mesh = new THREE.Mesh(kartGeo(d), kartMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.rotation.order = 'YXZ'; scene.add(mesh);
  const sh = new THREE.Mesh(shieldGeo, shieldMat); sh.position.y = 1.2; sh.visible = false; mesh.add(sh);
  return { d, mesh, sh, isPlayer: false, x: 0, z: 0, y: 0, vy: 0, yaw: 0, visYaw: 0, speed: 0, steer: 0, s: 0, lat: 0, prog: 0, prevS: 0, air: false, drift: 0, charge: 0, boost: 0, spin: 0, spinPh: 0, shield: 0, item: null, itemN: 0, roulette: 0,
    onShort: false, finished: false, ftime: 0, place: 1, stuckT: 0, draftT: 0, style: 0, trick: false, trickDone: false, wheelRot: 0, lean: 0, squash: 0, hop: 0, rampU: -1, pad: false, ai: {}, rocket: false, lastHitBy: null, offT: 0 };
});
let player = racers[0];
function setPlayer() { for (const r of racers) r.isPlayer = r.d.id === prof.driver; player = racers.find(r => r.isPlayer); }
setPlayer();

// ---------------------------------------------------------------- particles (one instanced mesh, pooled)
const PMAX = 600, pGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22), pMesh = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial({ fog: true }), PMAX);
pMesh.frustumCulled = false; scene.add(pMesh);
const parts = []; for (let i = 0; i < PMAX; i++) parts.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 0, max: 1 });
let pNext = 0; const pc = new THREE.Color(), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), e3 = new THREE.Euler();
function emit(x, y, z, vx, vy, vz, color, life = 0.5, size = 1, g = 0) {
  const p = parts[pNext]; pNext = (pNext + 1) % PMAX;
  Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, s: size, g }); pMesh.setColorAt(parts.indexOf(p), pc.set(color));
}
function puff(x, y, z, color, n = 12, sp = 6, life = 0.7, size = 1.2, g = 6) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU; emit(x, y, z, Math.cos(a) * sp * Math.random(), Math.random() * sp, Math.sin(a) * sp * Math.random(), Array.isArray(color) ? color[i % color.length] : color, life * (0.6 + Math.random() * 0.6), size, g); } }
const CONF = ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#ffffff'];
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i];
    if (p.life <= 0) { m4.makeScale(0, 0, 0); pMesh.setMatrixAt(i, m4); continue; }
    p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = Math.max(0, p.life / p.max) * p.s;
    m4.compose(v3.set(p.x, p.y, p.z), q4.setFromEuler(e3.set(p.life * 7, p.life * 5, 0)), s3.set(k, k, k)); pMesh.setMatrixAt(i, m4);
  }
  pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- items in the world
const gemGeo = new THREE.IcosahedronGeometry(0.85, 0);
const gems = new THREE.InstancedMesh(gemGeo, new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.1, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.18 }), 20);
gems.castShadow = true; scene.add(gems);
let boxes = [];
const jellyGeo = bake([{ geo: new THREE.SphereGeometry(0.75, 18, 12), color: '#ff7fb8', scl: [1.2, 0.7, 1.2] }, { geo: new THREE.SphereGeometry(0.16, 8, 6), color: '#ffffff', pos: [-0.25, 0.25, 0.45] }, { geo: new THREE.SphereGeometry(0.16, 8, 6), color: '#ffffff', pos: [0.25, 0.25, 0.45] }, { geo: new THREE.SphereGeometry(0.08, 8, 6), color: '#2b2d42', pos: [-0.25, 0.27, 0.58] }, { geo: new THREE.SphereGeometry(0.08, 8, 6), color: '#2b2d42', pos: [0.25, 0.27, 0.58] }]);
const ballGeo = bake([{ geo: new THREE.SphereGeometry(0.62, 18, 14), color: '#19c3e6' }, { geo: new THREE.TorusGeometry(0.62, 0.09, 6, 20), color: '#ffffff', rot: [Math.PI / 2, 0, 0] }, { geo: new THREE.TorusGeometry(0.62, 0.09, 6, 20), color: '#ffffff' }]);
const beeGeo = bake([{ geo: new THREE.SphereGeometry(0.5, 16, 12), color: '#ffd23f', scl: [0.9, 0.9, 1.3] }, { geo: new THREE.TorusGeometry(0.47, 0.11, 6, 16), color: '#2b2d42', pos: [0, 0, -0.1] }, { geo: new THREE.TorusGeometry(0.4, 0.1, 6, 16), color: '#2b2d42', pos: [0, 0, -0.42] }, { geo: new THREE.SphereGeometry(0.3, 10, 8), color: '#e8f7ff', pos: [0.4, 0.4, 0], scl: [1.2, 0.3, 0.8] }, { geo: new THREE.SphereGeometry(0.3, 10, 8), color: '#e8f7ff', pos: [-0.4, 0.4, 0], scl: [1.2, 0.3, 0.8] }, { geo: new THREE.SphereGeometry(0.1, 8, 6), color: '#2b2d42', pos: [0.18, 0.15, 0.55] }, { geo: new THREE.SphereGeometry(0.1, 8, 6), color: '#2b2d42', pos: [-0.18, 0.15, 0.55] }]);
const projMat = vcMat({ roughness: 0.25 });
const projs = [];   // { kind, mesh, x, z, y, vx, vz, s, lat, life, owner, target, safe }
function projMesh(kind) {
  let m = projs.find(p => p.dead && p.kind === kind); if (m) return m.mesh;
  const mesh = new THREE.Mesh(kind === 'jelly' ? jellyGeo : kind === 'ball' ? ballGeo : beeGeo, projMat); mesh.castShadow = true; scene.add(mesh); return mesh;
}
function spawnProj(kind, o) {
  const old = projs.find(p => p.dead && p.kind === kind);
  const p = old || { kind, mesh: projMesh(kind) }; Object.assign(p, { dead: false, life: kind === 'jelly' ? 45 : kind === 'ball' ? 5 : 14, safe: 0.35, ...o });
  p.mesh.visible = true; if (!old) projs.push(p); return p;
}

// ---------------------------------------------------------------- track loading
let TR = null, trackGroup = null, trackIdx = 0, trackMirror = false, miniImg = null, miniXf = null;
const NB = {}, SN = {}, FR = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), k: 0 };
function loadTrack(idx, mirror, seed) {
  if (trackGroup) scene.remove(trackGroup);
  trackIdx = idx; trackMirror = mirror;
  TR = buildTrack(TRACKS[idx], mirror);
  trackGroup = buildMeshes(TR, rng(seed || (idx + 1) * 7919)); scene.add(trackGroup);
  const th = TR.th;
  document.body.style.setProperty('--bg1', th.sky[0]); document.body.style.setProperty('--bg2', th.sky[1]); document.body.style.setProperty('--ui', '#ff3d6e');
  scene.fog = new THREE.Fog(th.fog, 170, 760); hemi.groundColor.set(th.hemiG); hemi.intensity = 1.2;
  // gem boxes: 5 across each item row
  boxes = [];
  for (const s of TR.itemRows) for (const lat of [-5, -2.5, 0, 2.5, 5]) { TR.frame(s, FR); const x = FR.p.x + FR.r.x * lat, z = FR.p.z + FR.r.z * lat; boxes.push({ x, z, y: TR.h(x, z) + 1.3, t: 0, hue: Math.random() }); }
  gems.count = boxes.length;
  for (const p of projs) { p.dead = true; p.mesh.visible = false; }
  // minimap image
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9; for (const p of TR.P) { mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mnz = Math.min(mnz, p.z); mxz = Math.max(mxz, p.z); }
  const sc = 200 / Math.max(mxx - mnx, mxz - mnz); miniXf = { sc, ox: 120 - (mnx + mxx) / 2 * sc, oz: 120 - (mnz + mxz) / 2 * sc };
  const c = document.createElement('canvas'); c.width = c.height = 240; const x = c.getContext('2d');
  const mp = p => [miniXf.ox + p.x * miniXf.sc, miniXf.oz + p.z * miniXf.sc];
  x.lineJoin = x.lineCap = 'round';
  const path = (pts, close) => { x.beginPath(); pts.forEach((p, i) => { const [a, b] = mp(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); if (close) x.closePath(); x.stroke(); };
  if (TR.short) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 10; path(TR.short.pts); x.strokeStyle = '#d9a35f'; x.lineWidth = 6; path(TR.short.pts); }
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 16; path(TR.P, true); x.strokeStyle = '#ffffff'; x.lineWidth = 10; path(TR.P, true);
  const [a, b] = mp(TR.P[0]); x.fillStyle = '#2b2d42'; x.fillRect(a - 7, b - 3, 14, 6);
  miniImg = c;
}

// ---------------------------------------------------------------- race state
let state = 'ready', cup = null, raceT = 0, endT = 0, results = null, raceStyle = 0, bot = false, beatenShown = false, lapShown = 1, shake = 0, recorded = false, finalLapMusic = false;
let pendingNext = null;
function placeOnGrid() {
  const order = racers.filter(r => !r.isPlayer); order.splice(5, 0, player);       // you start 6th of 8
  order.forEach((r, i) => {
    const row = Math.floor(i / 2), col = i % 2, s = TR.L - 9 - row * 7 - col * 3.5, lat = col ? 3.3 : -3.3;
    TR.frame(s, FR);
    Object.assign(r, { x: FR.p.x + FR.r.x * lat, z: FR.p.z + FR.r.z * lat, yaw: Math.atan2(FR.t.x, FR.t.z), speed: 0, steer: 0, s, prevS: s, lat, prog: s - TR.L, air: false, vy: 0, drift: 0, charge: 0, boost: 0, spin: 0, spinPh: 0, shield: 0,
      item: null, itemN: 0, roulette: 0, onShort: false, finished: false, ftime: 0, stuckT: 0, draftT: 0, style: 0, trick: false, wheelRot: 0, lean: 0, squash: 0, hop: 0, rampU: -1, rocket: false, offT: 0 });
    r.visYaw = r.yaw; r.y = TR.h(r.x, r.z) + 0.07;
  });
  sortPlaces();
}
function previewTrack() {
  const c = cupDef(); loadTrack(c.order[0], c.mirror[0], c.seed); placeOnGrid(); camT = 0;
}
function cupDef() {
  if (D.isDaily) { const r = rng(D.seed); const order = [0, 1, 2, 3].sort(() => r() - 0.5); return { id: 'daily', name: 'Daily Cup', order, mirror: order.map(() => r() < 0.5), diff: 1, seed: D.seed }; }
  const c = CUPS.find(x => x.id === prof.cup) || CUPS[0];
  return { id: c.id, name: c.name, order: [0, 1, 2, 3], mirror: [c.mirror, c.mirror, c.mirror, c.mirror], diff: prof.diff, seed: 0 };
}
function startCup() {
  A.audioInit();
  const c = cupDef();
  cup = { ...c, race: 0, pts: Object.fromEntries(racers.map(r => [r.d.id, 0])), score: 0, t0: performance.now() };
  beatenShown = false; B.start(); startRace();
}
function startRace() {
  loadTrack(cup.order[cup.race], cup.mirror[cup.race], cup.seed ? cup.seed + cup.race : 0);
  placeOnGrid();
  const fk = F.k(), dif = DIFFS[cup.diff];
  for (const r of racers) {
    const sk = clamp((dif.skill + (Math.random() - 0.5) * 0.12) * fk, 0.3, 1);
    r.ai = { skill: sk, lane: (Math.random() - 0.5) * 6, throttle: dif.throttle, wob: 0, wobV: 0, itemT: 0, itemDelay: 1, short: Math.random() < (sk - 0.45) * 1.4, rocketAt: -0.2 - Math.random() * 0.6, driftTier: sk > 0.82 ? 3 : sk > 0.55 ? 2 : 1 };
  }
  state = 'play'; raceT = -3.6; endT = 0; results = null; raceStyle = 0; lapShown = 1; recorded = false; finalLapMusic = false;
  hud.classList.remove('off'); $('hint').style.opacity = 1; ui.hideStart();
  A.music(true); countBeeps = 0;
}
let countBeeps = 0;
function sortPlaces() {
  const arr = racers.slice().sort((a, b) => (a.finished !== b.finished) ? (a.finished ? -1 : 1) : a.finished ? a.ftime - b.ftime : b.prog - a.prog);
  arr.forEach((r, i) => r.place = i + 1); return arr;
}

// ---------------------------------------------------------------- input
const keys = {}; let touchId = null, tx0 = 0, ty0 = 0, tT = 0, touchSteer = 0, touching = false, hardT = 0, autoDrift = false, keyMode = false, trickReq = false, itemReq = false, earlyPress = 0;
addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true; keyMode = true;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { pressGo(); if (player.air) trickReq = true; }
  if (['KeyX', 'KeyE', 'Enter', 'KeyJ'].includes(e.code)) itemReq = true;
  if (e.code === 'KeyM') $('mute').click();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('pointerdown', e => {
  A.audioInit();
  if (state !== 'play') return;
  pressGo();
  if (touchId === null) { touchId = e.pointerId; tx0 = e.clientX; ty0 = e.clientY; tT = performance.now(); touching = true; keyMode = false; }
  else trickReq = true;                         // a second finger: trick in the air
  if (player.air) trickReq = true;
});
addEventListener('pointermove', e => {
  if (e.pointerId !== touchId) return;
  const range = Math.min(innerWidth * 0.17, 90); let dx = e.clientX - tx0;
  if (Math.abs(dx) > range) { tx0 = e.clientX - Math.sign(dx) * range; dx = Math.sign(dx) * range; }
  touchSteer = dx / range;
  if (ty0 - e.clientY > 55 && performance.now() - tT < 350) { trickReq = true; ty0 = e.clientY; }
  if (Math.abs(touchSteer) > 0.2) $('hint').style.opacity = 0;
});
const endTouch = e => { if (e.pointerId !== touchId) return; touchId = null; touching = false; touchSteer = 0; };
addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
$('item').addEventListener('pointerdown', e => { e.stopPropagation(); A.audioInit(); itemReq = true; });
function pressGo() { if (raceT < 0 && raceT > -0.45 && !player.rocket) { player.rocket = true; } else if (raceT < -0.45 && raceT > -3.4) earlyPress++; }

function playerInput(dt) {
  if (bot || player.finished) return aiInput(player, dt, bot ? 0.97 : 0.8);
  let steer, drift;
  if (keyMode && !touching) {
    const tgt = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    player.steer += clamp(tgt - player.steer, -dt * 7, dt * 7); steer = player.steer;
    drift = !!(keys.ShiftLeft || keys.ShiftRight || keys.Space || keys.KeyK);
  } else {
    player.steer += (touchSteer - player.steer) * Math.min(1, dt * 16); steer = player.steer;
    // drift by holding a hard turn; release (or ease off) to fire the mini-turbo
    if (!autoDrift) { hardT = Math.abs(steer) > 0.62 && touching ? hardT + dt : 0; if (hardT > 0.2 && player.speed > 16) autoDrift = true; }
    else if (!touching || Math.abs(steer) < 0.12 || (player.drift && steer * player.drift < -0.55)) { autoDrift = false; hardT = 0; }
    drift = autoDrift;
  }
  const out = { steer, drift, throttle: keys.ArrowDown || keys.KeyS ? 0 : 1, brake: !!(keys.ArrowDown || keys.KeyS), item: itemReq, trick: trickReq };
  itemReq = false; trickReq = false; return out;
}

// ---------------------------------------------------------------- CPU driver (also the test bot) — reads only the track and what it can see
function aiInput(r, dt, skillOverride) {
  const ai = r.ai, sk = skillOverride || ai.skill;
  ai.wobV += (Math.random() - 0.5) * dt * 6; ai.wobV *= 0.96; ai.wob = clamp(ai.wob + ai.wobV * dt, -1, 1);
  const LA = 8 + r.speed * 0.42 * (0.7 + 0.4 * sk);
  let tx, tz;
  const S = TR.short, toA = S ? TR.ds(r.s, S.a) : 99;
  if (S && (r.onShort || ((ai.short || skillOverride) && !r.finished && toA > -2 && toA < LA + 6 && r.prog > 0))) {
    let q = r.onShort ? Math.min(S.len, Math.round((TR.shortNear(r.x, r.z, SN).q || 0) + LA)) : Math.max(0, Math.round(LA - toA));
    q = clamp(q, 0, S.len); tx = S.pts[q].x; tz = S.pts[q].z;
  } else {
    const f = TR.frame(r.s + LA, FR), c = Math.min(1, Math.abs(f.k) * 30);
    let lat = ai.lane * (1 - c) + Math.sign(f.k) * c * 4.2 * sk;
    if (!r.item && !r.roulette) for (const s of TR.itemRows) { const u = TR.ds(r.s, s); if (u > 0 && u < 28 && Math.random() < 0.6 + sk * 0.4) { lat = clamp(r.lat, -5, 5); lat = Math.round(lat / 2.5) * 2.5; } }
    if (sk > 0.6) for (const p of TR.pads) { const u = TR.ds(r.s, p.s); if (u > 0 && u < 30) lat = p.lat; }
    for (const p of projs) if (!p.dead && p.kind === 'jelly') { const u = TR.ds(r.s, p.s); if (u > 0 && u < 16 && Math.abs(p.lat - lat) < 2.2 && sk > 0.35) lat += p.lat > lat ? -3.2 : 3.2; }
    lat = clamp(lat, -W / 2 + 1.2, W / 2 - 1.2);
    tx = f.p.x + f.r.x * lat; tz = f.p.z + f.r.z * lat;
  }
  const err = aw(Math.atan2(tx - r.x, tz - r.z) - r.yaw);
  let steer = clamp(-err * 2.6 + ai.wob * (1 - sk) * 0.55, -1, 1);
  const kAhead = TR.maxK(r.s, 4, 26), kNow = TR.maxK(r.s, 0, 12);
  let drift = !!r.drift;
  if (!r.drift && !r.onShort && r.speed > 18 && kAhead > 0.022 && sk > 0.3 && Math.random() < sk * dt * 8) { drift = true; steer = Math.sign(steer || 1) * Math.max(0.5, Math.abs(steer)); }
  if (r.drift) {
    if (r.charge >= TIER_T[(skillOverride ? 3 : ai.driftTier) - 1] && kNow < 0.03) drift = false;
    if (kNow < 0.008 || steer * r.drift < -0.85) drift = false;
  }
  let throttle = skillOverride ? 1 : ai.throttle;
  if (!r.drift && sk < 0.55 && kAhead > 0.045) throttle *= 0.86;
  // items: wait a human-ish reaction time, then use them when it makes sense
  let item = false;
  if (r.item) {
    ai.itemT += dt; const ready = ai.itemT > ai.itemDelay;
    if (ready) {
      if (r.item === 'zip' || r.item === 'triple') item = kAhead < 0.02 || r.offT > 0.3;
      else if (r.item === 'shield') item = true;
      else if (r.item === 'jelly') item = racers.some(o => o !== r && TR.ds(o.s, r.s) > 0 && TR.ds(o.s, r.s) < 16) || ai.itemT > 9;
      else if (r.item === 'ball') item = racers.some(o => o !== r && TR.ds(r.s, o.s) > 3 && TR.ds(r.s, o.s) < 32 && Math.abs(o.lat - r.lat) < 2.5) && kAhead < 0.02 || ai.itemT > 11;
      else if (r.item === 'bee') item = r.place > 1;
    }
  }
  return { steer, drift, throttle, brake: false, item, trick: r.air && Math.random() < sk * 0.5 };
}

// ---------------------------------------------------------------- physics step (the same for every kart)
function useItem(r) {
  const it = r.item; if (!it) return;
  const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
  if (it === 'zip' || it === 'triple') { r.boost = Math.max(r.boost, 1.25); if (r.isPlayer) { A.whoosh(); ui.pop('ZIP!', '#ffb02e', 30, 30); } burstAt(r, ['#ff6b2e', '#ffd23f'], 10); }
  else if (it === 'jelly') spawnProj('jelly', { x: r.x - fx * 2.8, z: r.z - fz * 2.8, s: TR.wrap(r.s - 2.8), lat: r.lat, owner: r, vx: 0, vz: 0 });
  else if (it === 'ball') { const v = Math.max(r.speed + 24, 52); spawnProj('ball', { x: r.x + fx * 2.4, z: r.z + fz * 2.4, s: r.s, lat: r.lat, vx: fx * v, vz: fz * v, owner: r }); }
  else if (it === 'bee') { const tg = sortPlaces()[r.place - 2]; if (tg) spawnProj('bee', { x: r.x, z: r.z, s: r.s, lat: r.lat, y: r.y + 2.5, owner: r, target: tg }); }
  else if (it === 'shield') r.shield = 8;
  if (r.isPlayer && it !== 'zip' && it !== 'triple') sfx.tap();
  if (r.itemN > 1) r.itemN--; else { r.item = null; r.itemN = 0; }
  r.ai.itemT = 0; r.ai.itemDelay = lerp(2.4, 0.35, r.ai.skill || 0.7) + Math.random() * 0.8;
}
function hit(r, by) {
  if (r.spin > 0 || r.finished && !r.isPlayer) return false;
  if (r.shield > 0) { r.shield = 0; puff(r.x, r.y + 1.2, r.z, ['#8fe8ff', '#ffffff'], 16, 7, 0.6, 1); if (r.isPlayer || by === player) sfx.bounce(); return false; }
  r.spin = 1.05; r.drift = 0; r.charge = 0; r.boost = 0; r.speed *= 0.5;
  puff(r.x, r.y + 1.0, r.z, ['#ffd23f', '#ffffff', '#ff5d8f'], 18, 8, 0.7, 1.1);
  if (r.isPlayer) { A.spinOut(); buzz([30, 40, 30]); shake = 0.5; ui.pop('OOF!', '#ff5d8f', 30, 30); }
  if (by && by.isPlayer && r !== by) { addStyle(50, 'BONK! +50', '#19c3e6'); sfx.smash(); }
  return true;
}
function burstAt(r, cols, n) { for (let i = 0; i < n; i++) emit(r.x - Math.sin(r.yaw) * 1.6, r.y + 0.8, r.z - Math.cos(r.yaw) * 1.6, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, cols[i % cols.length], 0.4, 1.3, 0); }
function addStyle(n, text, col) { raceStyle += n; player.style += n; if (text) ui.pop(text, col, 26, 27); }

function groundY(r) {
  if (r.onShort) return TR.h(r.x, r.z) + 0.06;
  const u = TR.rampAt(r.s, r.lat); r.rampU = u;
  return TR.h(r.x, r.z) + 0.07 + (u >= 0 ? RAMP_H * u : 0);
}
function step(r, inp, dt) {
  // --- items
  if (r.roulette > 0) { r.roulette -= dt; if (r.roulette <= 0) { r.item = pickItem(r.place); r.itemN = ITEMS[r.item].n || 1; r.ai.itemT = 0; r.ai.itemDelay = lerp(2.4, 0.35, r.ai.skill || 0.7) + Math.random(); if (r.isPlayer) sfx.coin(); } }
  if (inp.item && r.item && r.spin <= 0 && raceT > 0) useItem(r);
  r.shield = Math.max(0, r.shield - dt); r.sh.visible = r.shield > 0;
  // --- surface
  let surf = 1;
  if (r.onShort) surf = TR.shortNear(r.x, r.z, SN).dist < SW / 2 + 0.8 ? 0.82 : 0.55;
  else surf = Math.abs(r.lat) < W / 2 + 1.6 ? 1 : 0.55;
  r.offT = surf < 0.6 && !r.air ? r.offT + dt : 0;
  if (r.boost > 0) surf = Math.max(surf, 0.92);
  // --- speed
  const go = raceT > 0;
  let cap = go ? TOP * surf * inp.throttle * (r.boost > 0 ? 1.34 : 1) * (r.drift ? 0.975 : 1) : 0;
  if (r.spin > 0) { r.spin -= dt; r.spinPh += dt * 14; r.speed *= Math.exp(-2.6 * dt); }
  else if (inp.brake) r.speed = Math.max(-8, r.speed - 36 * dt);
  else if (r.speed < cap) r.speed += (cap - r.speed) * (r.boost > 0 ? 3.2 : 0.95) * dt;
  else r.speed += (cap - r.speed) * (surf < 0.6 ? 2.2 : 0.9) * dt;
  if (r.boost > 0) r.boost -= dt;
  // --- steering + drift
  const steer = r.spin > 0 ? 0 : clamp(inp.steer, -1, 1), sp01 = clamp(Math.abs(r.speed) / TOP, 0, 1);
  if (!r.drift && inp.drift && !r.air && r.spin <= 0 && r.speed > 14 && Math.abs(steer) > 0.25) { r.drift = Math.sign(steer); r.charge = 0; r.hop = 0.22; if (r.isPlayer) tone(300, 0.08, 'triangle', 0.08, 1.4); }
  if (r.drift && (!inp.drift || r.speed < 10 || r.spin > 0)) {
    const tier = r.charge >= TIER_T[2] ? 3 : r.charge >= TIER_T[1] ? 2 : r.charge >= TIER_T[0] ? 1 : 0;
    if (tier && r.spin <= 0) {
      r.boost = Math.max(r.boost, TIER_BOOST[tier - 1]);
      burstAt(r, [TIER_COL[tier - 1], '#ffffff'], 12);
      if (r.isPlayer) { A.whoosh(0.08 + tier * 0.03); addStyle(TIER_PTS[tier - 1], ['', 'BOOST!', 'SUPER BOOST!', 'ULTRA BOOST!'][tier] + ' +' + TIER_PTS[tier - 1], TIER_COL[tier - 1]); buzz(15); }
    }
    r.drift = 0; r.charge = 0;
  }
  let yawRate;
  if (r.drift) {
    const a = clamp(steer * r.drift, -1, 1);
    yawRate = -r.drift * lerp(0.62, 2.05, (a + 1) / 2) * Math.min(1, r.speed / 12);
    r.charge += dt * (0.75 + 0.55 * (a + 1) / 2);
  } else yawRate = -steer * lerp(2.3, 1.42, sp01) * clamp(r.speed / 4, -1, 1);
  if (r.air) yawRate *= 0.35;
  if (r.spin > 0) yawRate = 0;
  r.yaw = aw(r.yaw + yawRate * dt);
  const moveYaw = r.yaw + r.drift * 0.1;
  r.x += Math.sin(moveYaw) * r.speed * dt; r.z += Math.cos(moveYaw) * r.speed * dt;
  r.steer = inp.steer;
  // --- track mapping, shortcut, barriers
  const m = TR.near(r.x, r.z, r.s, NB), S = TR.short, sn = S ? TR.shortNear(r.x, r.z, SN) : null;
  if (r.onShort) {
    const nearEnd = Math.abs(TR.ds(m.s, S.a)) < 20 || Math.abs(TR.ds(m.s, S.b)) < 20;
    if (Math.abs(m.d) < W / 2 + 1 && nearEnd) { r.onShort = false; r.s = m.s; r.lat = m.d; if (sn.f > 0.7 && r.isPlayer) addStyle(50, 'SHORTCUT! +50', '#c98d50'); }
    else {
      r.s = TR.wrap(S.a + sn.f * S.arc); r.lat = 0;
      if (sn.dist > SW / 2 + 2.4) wallPush(r, sn.lat, S.tan[sn.q], sn.dist - (SW / 2 + 2.4));
    }
  } else if (sn && sn.dist < SW / 2 + 0.5 && Math.abs(m.d) > W / 2 + 1.5 && sn.f > 0.04 && sn.f < 0.96) { r.onShort = true; r.s = TR.wrap(S.a + sn.f * S.arc); }
  else {
    r.s = m.s; r.lat = m.d;
    if (Math.abs(m.d) > WALL - 0.3 && !(sn && sn.dist < SW / 2 + 3.5)) wallPush(r, m.d, TR.T[m.i], Math.abs(m.d) - (WALL - 0.3));
  }
  let dS = TR.ds(r.prevS, r.s); dS = clamp(dS, -30, 30); r.prog += dS; r.prevS = r.s;
  // --- vertical: ramps, jumps, landing
  const gy = groundY(r);
  if (!r.air) {
    if (r.wasRamp > 0.75 && r.rampU < 0 && r.speed > 8) { r.air = true; r.vy = r.speed * RAMP_H / RAMP_LEN * 1.05 + 2.5; r.trick = false; if (r.isPlayer) { ui.pop('TAP TO TRICK!', '#fff', 22, 34); } }
    else r.y = gy;
    r.wasRamp = r.rampU;
  }
  if (r.air) {
    r.vy -= GRAV * dt; r.y += r.vy * dt;
    if (inp.trick && !r.trick) { r.trick = true; r.trickSpin = 0; if (r.isPlayer) { tone(700, 0.1, 'triangle', 0.1, 1.5); } }
    if (r.y <= gy) {
      r.y = gy; r.air = false; r.wasRamp = -1; r.squash = 0.35;
      puff(r.x, r.y + 0.2, r.z, '#ffffff', 8, 4, 0.5, 1);
      if (r.trick) { r.boost = Math.max(r.boost, 0.7); if (r.isPlayer) { addStyle(25, 'TRICK! +25', '#ffd23f'); A.whoosh(0.08); } }
      if (r.isPlayer) { sfx.bounce(); shake = Math.max(shake, 0.2); buzz(12); }
    }
  }
  if (r.trick && r.air) r.trickSpin = (r.trickSpin || 0) + dt * 14;
  // --- boost pads
  if (!r.onShort) for (const p of TR.pads) { const u = TR.wrap(r.s - p.s); if (u < 6 && Math.abs(r.lat - p.lat) < 2 && !r.air) { if (r.boost < 0.6 && r.isPlayer) { A.whoosh(0.1); ui.pop('ZOOM!', '#ff3d8b', 26, 30); } r.boost = Math.max(r.boost, 0.9); } }
  // --- gem boxes
  for (const b of boxes) if (b.t <= 0 && Math.abs(b.x - r.x) < 1.9 && Math.abs(b.z - r.z) < 1.9 && Math.abs(b.y - r.y - 1) < 2.2) {
    b.t = 2.6; puff(b.x, b.y, b.z, CONF, 14, 6, 0.6, 1);
    if (!r.item && r.roulette <= 0) { r.roulette = 0.9; if (r.isPlayer) sfx.pick(3); }
  }
  // --- stuck or lost? lift back onto the track (same rule for everyone)
  r.stuckT = Math.abs(r.speed) < 3 && raceT > 2 && r.spin <= 0 ? r.stuckT + dt : 0;
  if (r.stuckT > 2.6 || (!r.onShort && Math.abs(m.d) > WALL + 6)) respawn(r);
}
function wallPush(r, d, t, excess) {
  const side = Math.sign(d), nx = -t.z * side, nz = t.x * side;        // outward normal
  r.x -= nx * excess; r.z -= nz * excess;
  const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw), into = fx * nx + fz * nz;
  if (into > 0.05) {
    const ty = Math.atan2(t.x, t.z) + (fx * t.x + fz * t.z < 0 ? Math.PI : 0);
    r.yaw = aw(r.yaw + aw(ty - r.yaw) * 0.55);
    if (into > 0.25 && r.speed > 10) {
      r.speed *= 0.82;
      for (let i = 0; i < 6; i++) emit(r.x + nx, r.y + 0.6, r.z + nz, (Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6, i % 2 ? '#ffd23f' : '#ffffff', 0.35, 0.8, 10);
      if (r.isPlayer) { A.bonk(); shake = Math.max(shake, 0.25); buzz(15); }
    }
  }
}
function respawn(r) {
  TR.frame(r.s - 3, FR); r.x = FR.p.x + FR.r.x * clamp(r.lat, -3, 3) * 0; r.z = FR.p.z; r.x = FR.p.x; r.yaw = Math.atan2(FR.t.x, FR.t.z); r.speed = 4; r.onShort = false; r.air = false; r.drift = 0; r.stuckT = 0;
  r.s = TR.wrap(r.s - 3); r.prevS = r.s; r.prog -= 3; r.lat = 0; r.y = TR.h(r.x, r.z) + 0.07;
  puff(r.x, r.y + 1, r.z, '#ffffff', 16, 5, 0.8, 1.4);
}
function collide() {
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const a = racers[i], b = racers[j], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 > 4.4 || Math.abs(a.y - b.y) > 1.6) continue;
    const d = Math.sqrt(d2) || 0.01, push = (2.1 - d) / 2, nx = dx / d, nz = dz / d;
    a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    if (push > 0.05) { const fast = a.speed > b.speed ? a : b; fast.speed -= push * 3; }
    if ((a.isPlayer || b.isPlayer) && push > 0.15) { A.bonk(); shake = Math.max(shake, 0.15); }
  }
}
function drafting(dt) {
  for (const r of racers) {
    if (r.speed < 22 || r.air || r.onShort) { r.draftT = 0; continue; }
    const tuck = racers.some(o => o !== r && TR.ds(r.s, o.s) > 1.5 && TR.ds(r.s, o.s) < 9 && Math.abs(o.lat - r.lat) < 1.7);
    r.draftT = tuck ? r.draftT + dt : Math.max(0, r.draftT - dt * 2);
    if (r.draftT > 1.15) { r.draftT = 0; r.boost = Math.max(r.boost, 0.7); if (r.isPlayer) { addStyle(10, 'SLIPSTREAM +10', '#ffffff'); A.whoosh(0.07); } }
    if (tuck && r.isPlayer && Math.random() < 0.5) emit(r.x + (Math.random() - 0.5) * 3, r.y + 0.5 + Math.random() * 1.5, r.z + (Math.random() - 0.5) * 3, -Math.sin(r.yaw) * 30, 0, -Math.cos(r.yaw) * 30, '#ffffff', 0.18, 0.5, 0);
  }
}
function updateProjs(dt) {
  for (const p of projs) {
    if (p.dead) continue;
    p.life -= dt; p.safe -= dt;
    if (p.kind === 'ball') {
      p.x += p.vx * dt; p.z += p.vz * dt;
      const m = TR.near(p.x, p.z, p.s, NB); p.s = m.s; p.lat = m.d;
      if (Math.abs(m.d) > WALL - 0.8) { const t = TR.T[m.i], nx = -t.z * Math.sign(m.d), nz = t.x * Math.sign(m.d), dot = p.vx * nx + p.vz * nz; if (dot > 0) { p.vx -= 2 * dot * nx; p.vz -= 2 * dot * nz; puff(p.x, p.y, p.z, '#19c3e6', 5, 4, 0.3, 0.7); } }
      p.y = TR.h(p.x, p.z) + 0.7; p.mesh.rotation.x += dt * 12;
    } else if (p.kind === 'bee') {
      const tg = p.target;
      if (!tg || tg.finished) p.life = 0;
      else {
        const gap = TR.ds(p.s, tg.s);
        if (gap > 6) { p.s = TR.wrap(p.s + 64 * dt); p.lat += (tg.lat - p.lat) * Math.min(1, dt * 2); TR.frame(p.s, FR); p.x = FR.p.x + FR.r.x * p.lat; p.z = FR.p.z + FR.r.z * p.lat; p.y = FR.p.y + 3; p.mesh.rotation.y = Math.atan2(FR.t.x, FR.t.z); }
        else { const dx = tg.x - p.x, dz = tg.z - p.z, dy = tg.y + 1 - p.y, d = Math.hypot(dx, dz, dy) || 1, v = 70 * dt; p.x += dx / d * v; p.z += dz / d * v; p.y += dy / d * v; p.mesh.rotation.y = Math.atan2(dx, dz); }
        if (Math.random() < 0.4) emit(p.x, p.y, p.z, 0, 0.5, 0, '#fff3a0', 0.25, 0.5, 0);
      }
    } else { p.y = TR.h(p.x, p.z) + 0.45 + Math.sin(raceT * 6 + p.x) * 0.06; p.mesh.scale.set(1 + Math.sin(raceT * 8) * 0.08, 1 - Math.sin(raceT * 8) * 0.08, 1 + Math.sin(raceT * 8) * 0.08); }
    p.mesh.position.set(p.x, p.y, p.z);
    for (const r of racers) {
      if ((r === p.owner && p.safe > 0) || r.air && p.kind !== 'bee') continue;
      if (p.kind === 'bee' && r !== p.target) continue;
      const dx = r.x - p.x, dz = r.z - p.z; if (dx * dx + dz * dz < (p.kind === 'jelly' ? 2.6 : 2.9) && Math.abs(r.y + 0.8 - p.y) < 2.2) { hit(r, p.owner); p.life = 0; puff(p.x, p.y, p.z, p.kind === 'jelly' ? '#ff7fb8' : p.kind === 'ball' ? '#19c3e6' : '#ffd23f', 14, 6, 0.6, 1); break; }
    }
    if (p.life <= 0) { p.dead = true; p.mesh.visible = false; }
  }
}

// ---------------------------------------------------------------- visuals per kart
const wl = new THREE.Matrix4(), wq = new THREE.Quaternion(), we = new THREE.Euler(0, 0, 0, 'YXZ'), wp = new THREE.Vector3(), ws = new THREE.Vector3(1, 1, 1);
function drawKart(r, i, dt, t) {
  const m = r.mesh;
  r.visYaw = aw(r.visYaw + aw(r.yaw - r.drift * 0.42 - r.visYaw) * Math.min(1, dt * 10));
  r.lean += ((r.drift ? -r.drift * 0.14 : -r.steer * 0.07 * Math.min(1, r.speed / 15)) - r.lean) * Math.min(1, dt * 8);
  r.squash = Math.max(0, r.squash - dt * 1.6); if (r.hop > 0) r.hop -= dt;
  const ahead = TR.h(r.x + Math.sin(r.yaw) * 1.5, r.z + Math.cos(r.yaw) * 1.5), behind = TR.h(r.x - Math.sin(r.yaw) * 1.5, r.z - Math.cos(r.yaw) * 1.5);
  let pitch = -Math.atan2(ahead - behind, 3); if (r.rampU >= 0 && !r.air) pitch -= Math.atan(RAMP_H / RAMP_LEN); if (r.air) pitch = clamp(-r.vy * 0.03, -0.35, 0.3);
  const hopY = r.hop > 0 ? Math.sin((0.22 - r.hop) / 0.22 * Math.PI) * 0.45 : 0;
  m.position.set(r.x, r.y + hopY + Math.sin(t * 30 + i) * 0.015 * Math.min(1, r.speed / 10), r.z);
  m.rotation.set(pitch, r.visYaw + r.spinPh + (r.trick && r.air ? r.trickSpin : 0), r.lean);
  const sq = Math.sin(r.squash * 9) * r.squash * 0.5; m.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  m.updateMatrix();
  r.wheelRot += r.speed * dt / 0.4;
  for (let k = 0; k < 4; k++) {
    const [x, y, z, front] = WHEELS[k];
    we.set(r.wheelRot, front ? -r.steer * 0.42 : 0, 0); wl.compose(wp.set(x, y, z), wq.setFromEuler(we), ws);
    wl.premultiply(m.matrix); wheelMesh.setMatrixAt(i * 4 + k, wl);
  }
  if (r.spin <= 0 && r.spinPh) r.spinPh = 0;
  // effects
  const fx = Math.sin(r.visYaw), fz = Math.cos(r.visYaw), rx = fz, rz = -fx;    // rx,rz = kart's left
  if (r.drift && !r.air) {
    const tier = r.charge >= TIER_T[2] ? 3 : r.charge >= TIER_T[1] ? 2 : r.charge >= TIER_T[0] ? 1 : 0;
    for (const sd of [-1, 1]) {
      const x = r.x - fx * 0.95 + rx * sd * 0.9, z = r.z - fz * 0.95 + rz * sd * 0.9;
      if (tier) emit(x, r.y + 0.25, z, (Math.random() - 0.5) * 3 - fx * 2, 1 + Math.random() * 3, (Math.random() - 0.5) * 3 - fz * 2, Math.random() < 0.3 ? '#ffffff' : TIER_COL[tier - 1], 0.26, 0.55, 9);
      else if (Math.random() < 0.35) emit(x, r.y + 0.2, z, (Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2, '#d9dbe6', 0.35, 0.7, -1);
    }
  }
  if (r.boost > 0) for (const sd of [-0.3, 0.3]) emit(r.x - fx * 1.65 + rx * sd, r.y + 0.85, r.z - fz * 1.65 + rz * sd, -fx * 6 + (Math.random() - 0.5), Math.random(), -fz * 6 + (Math.random() - 0.5), Math.random() < 0.5 ? '#ffd23f' : '#ff6b2e', 0.22, 1.1, 0);
  if (r.offT > 0 && r.speed > 8 && Math.random() < 0.6) emit(r.x - fx * 1.2, r.y + 0.3, r.z - fz * 1.2, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3, TR.th.shoulder, 0.5, 1.2, 4);
}

// ---------------------------------------------------------------- camera
let camYaw = 0, camT = 0, fovNow = 60; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function updateCamera(dt) {
  const r = player;
  if (state === 'ready' || !TR) {
    camT += dt * 0.25; const a = r.yaw + Math.PI * 0.8 + Math.sin(camT) * 0.45, dist = 9;
    camPos.set(r.x + Math.sin(a) * dist, r.y + 2.2, r.z + Math.cos(a) * dist); camLook.set(r.x, r.y + 3.1, r.z);
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 4)); camera.lookAt(camLook); return;
  }
  if (r.finished && raceT - r.ftime > 0.2) {
    camT += dt * 0.5; const a = r.yaw + Math.PI + camT;
    camPos.set(r.x + Math.sin(a) * 9, r.y + 3.4, r.z + Math.cos(a) * 9); camLook.set(r.x, r.y + 1, r.z);
  } else {
    const intro = clamp((raceT + 3.6) / 2.4, 0, 1), e = intro * intro * (3 - 2 * intro);
    camYaw = aw(camYaw + aw(lerp(r.yaw, r.visYaw, 0.35) - camYaw) * Math.min(1, dt * (r.drift ? 3.5 : 6)));
    const port = camera.aspect < 0.8, a = lerp(camYaw + Math.PI * 0.9, camYaw, e), dist = lerp(9, (port ? 7.8 : 6.8) + (r.boost > 0 ? 1.0 : 0), e), hgt = lerp(2.2, port ? 3.5 : 2.9, e);
    camPos.set(r.x - Math.sin(a) * dist, r.y + hgt, r.z - Math.cos(a) * dist);
    camLook.set(r.x + Math.sin(camYaw) * 7 * e, r.y + (port ? 0.9 : 1.15), r.z + Math.cos(camYaw) * 7 * e);
  }
  const floor = TR.h(camPos.x, camPos.z) + 1.0; if (camPos.y < floor) camPos.y = floor;
  camera.position.lerp(camPos, 1 - Math.exp(-dt * (raceT < -1 ? 5 : 12)));
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake * 0.6; shake = Math.max(0, shake - dt * 1.8); }
  camera.lookAt(camLook);
  const want = 60 + clamp(r.speed / TOP, 0, 1.4) * 6 + (r.boost > 0 ? 9 : 0);
  fovNow += (want - fovNow) * Math.min(1, dt * 4);
  camera.fov = (camera.aspect < 0.7 ? 1.12 : 1) * fovNow; camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- HUD
const ORD = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const fmtT = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
let rouletteI = 0;
const posEl = $('pos'), lapEl = $('lap'), timeEl = $('time'), ptsEl = $('pts'), itemIc = $('itemIc'), itemN = $('itemN'), itemBtn = $('item'), tierEl = $('tier'), wrongEl = $('wrong');
let wrongT = 0, lastPlace = 0;
function updateHUD(dt) {
  const p = player, ord = ORD(p.place);
  if (p.place !== lastPlace) { posEl.innerHTML = `<b>${p.place}</b><sup>${ord.slice(-2)}</sup>`; posEl.classList.remove('pop'); void posEl.offsetWidth; posEl.classList.add('pop'); posEl.dataset.p = p.place; lastPlace = p.place; }
  lapEl.innerHTML = `LAP <b>${clamp(Math.floor(p.prog / TR.L) + 1, 1, LAPS)}</b>/${LAPS}`;
  timeEl.textContent = fmtT(Math.max(0, p.finished ? p.ftime : raceT));
  ptsEl.textContent = '★ ' + (cup.score + raceStyle).toLocaleString();
  if (p.roulette > 0) { rouletteI += dt * 14; const ks = Object.keys(ITEMS); itemIc.textContent = ITEMS[ks[Math.floor(rouletteI) % ks.length]].icon; itemBtn.className = 'spin'; itemN.textContent = ''; }
  else if (p.item) { itemIc.textContent = ITEMS[p.item].icon; itemN.textContent = p.itemN > 1 ? '×' + p.itemN : ''; itemBtn.className = 'ready'; }
  else { itemIc.textContent = ''; itemN.textContent = ''; itemBtn.className = ''; }
  const tier = p.drift ? (p.charge >= TIER_T[2] ? 3 : p.charge >= TIER_T[1] ? 2 : p.charge >= TIER_T[0] ? 1 : 0) : 0;
  tierEl.className = p.drift ? 'on t' + tier : '';
  // wrong way
  const t = TR.T[Math.floor(p.s) % TR.L]; const back = Math.sin(p.yaw) * t.x + Math.cos(p.yaw) * t.z < -0.4 && !p.onShort && raceT > 1 && !p.finished;
  wrongT = back ? wrongT + dt : 0; wrongEl.hidden = wrongT < 0.8;
  // speed lines
  $('lines').style.opacity = p.boost > 0 ? 0.85 : clamp((p.speed - 26) / 10, 0, 0.35);
  // minimap
  mctx.clearRect(0, 0, 240, 240); if (miniImg) mctx.drawImage(miniImg, 0, 0);
  for (const r of racers.slice().sort((a, b) => a.isPlayer - b.isPlayer)) {
    const x = miniXf.ox + r.x * miniXf.sc, y = miniXf.oz + r.z * miniXf.sc;
    mctx.beginPath(); mctx.arc(x, y, r.isPlayer ? 13 : 8, 0, TAU); mctx.fillStyle = r.isPlayer ? '#ffffff' : r.d.kart; mctx.fill();
    mctx.lineWidth = r.isPlayer ? 5 : 3; mctx.strokeStyle = r.isPlayer ? r.d.kart : '#2b2d42'; mctx.stroke();
  }
}

// ---------------------------------------------------------------- race flow
function race(dt) {
  const prevT = raceT; raceT += dt;
  // countdown
  for (const [at, txt] of [[-3, '3'], [-2, '2'], [-1, '1'], [0, 'GO!']]) if (prevT < at && raceT >= at) {
    ui.pop(txt, at === 0 ? '#7dff6a' : '#ffd23f', at === 0 ? 96 : 90, 30);
    if (at === 0) { tone(880, 0.35, 'square', 0.12, 1); A.music(true); } else tone(440, 0.15, 'square', 0.1, 1);
  }
  if (prevT < 0 && raceT >= 0) {
    for (const r of racers) {
      const rocket = r.isPlayer ? (bot ? Math.random() < 0.6 : r.rocket) : Math.random() < r.ai.skill * 0.7;
      if (rocket) { r.boost = 0.9; r.speed = 12; if (r.isPlayer) { ui.pop('ROCKET START!', '#ffd23f', 30, 40); A.whoosh(); addStyle(20); } burstAt(r, ['#ffd23f', '#ff6b2e'], 10); }
    }
  }
  const pin = playerInput(dt);
  for (const r of racers) {
    const inp = r.isPlayer ? pin : (r.finished ? { ...aiInput(r, dt), throttle: 0.75, item: false } : aiInput(r, dt));
    step(r, inp, dt);
  }
  collide(); drafting(dt); updateProjs(dt);
  const order = sortPlaces();
  for (const r of racers) if (!r.finished && r.prog >= LAPS * TR.L) { r.finished = true; r.ftime = raceT; if (!r.isPlayer) r.boost = 0; }
  // laps
  const lap = clamp(Math.floor(player.prog / TR.L) + 1, 1, LAPS);
  if (lap > lapShown && !player.finished) { lapShown = lap; if (lap === LAPS) { ui.pop('FINAL LAP!', '#ffd23f', 40, 30); A.music(true, true); [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.12, 1), i * 90)); } else { ui.pop('LAP ' + lap, '#ffffff', 40, 30); sfx.coin(); } }
  if (cup && D.beaten(cup.score + raceStyle) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 44, 26); for (let i = 0; i < 40; i++) emit(player.x, player.y + 2, player.z, (Math.random() - 0.5) * 12, 6 + Math.random() * 8, (Math.random() - 0.5) * 12, CONF[i % 6], 1.4, 1, 12); }
  if (raceT > 7) $('hint').style.opacity = 0;
  if (player.finished && !results) finishRace(order);
  if (results && raceT - player.ftime > 3.0 && state === 'play') showResults();
}
function finishRace(order) {
  results = order.map(r => ({ r, place: r.place }));
  const p = player.place;
  ui.pop(p === 1 ? '1ST PLACE!' : ORD(p).toUpperCase() + '!', p <= 3 ? '#ffd23f' : '#ffffff', 64, 30);
  if (p <= 3) { sfx.win(); for (let i = 0; i < 90; i++) emit(player.x, player.y + 2.5, player.z, (Math.random() - 0.5) * 14, 6 + Math.random() * 10, (Math.random() - 0.5) * 14, CONF[i % 6], 2.2, 1.1, 10); buzz([40, 60, 40]); }
  else sfx.fail();
  A.music(false);
}
function raceScore() { return POINTS[player.place - 1] * 100 + raceStyle; }
function resultsTable(withCup) {
  const rows = results.map(({ r, place }) => `<div class="row ${r.isPlayer ? 'me' : ''}"><span class="pl">${ORD(place)}</span><span class="dot" style="background:${r.d.kart}"></span><span class="nm">${r.d.emoji} ${r.isPlayer ? 'You' : r.d.name}</span><span class="gp">+${POINTS[place - 1]}</span>${withCup ? `<b>${cup.pts[r.d.id] + POINTS[place - 1]}</b>` : ''}</div>`).join('');
  return `<div class="tbl">${rows}</div>`;
}
function showResults() {
  const p = player.place, track = TR.name, rs = raceScore();
  if (!recorded) { recorded = true; F.level(p <= 3, (8 - p) / 7); prof.races++; saveProf(); }
  if (p <= 3) { acceptRace(false); return; }
  state = 'lost';
  ui.els.lose.querySelector('.res').innerHTML = resultsTable(true);
  ui.els.lose.querySelector('.hint').textContent = 'Tap to retry the race';
  ui.lose(ORD(p).toUpperCase(), `${track} · podium is top 3`);
}
function acceptRace(skipped) {
  const p = player.place, rs = raceScore();
  for (const { r, place } of results) cup.pts[r.d.id] += POINTS[place - 1];
  cup.score += rs;
  if (p === 1) prof.wins++; if (p <= 3) prof.podiums++;
  B.submit(cup.score, { ms: performance.now() - cup.t0 });
  const track = TR.name, last = cup.race >= 3;
  cup.race++;
  if (!last) {
    pendingNext = 'race';
    if (skipped) { startRace(); saveProf(); return; }
    state = 'won'; D.won(cup.score, 'scored');
    ui.els.win.querySelector('h1').textContent = p === 1 ? '1ST PLACE!' : ORD(p).toUpperCase() + ' PLACE!';
    ui.els.win.querySelector('.res').innerHTML = resultsTable(false) + `<p class="cupline">Race ★ ${rs.toLocaleString()} · cup ★ ${cup.score.toLocaleString()}</p>`;
    ui.els.win.querySelector('.hint').textContent = `Tap for race ${cup.race + 1} of 4`;
    ui.win(`RACE ${cup.race}/4 · ${track.toUpperCase()}`, '');
  } else cupEnd();
  saveProf();
}
function cupEnd() {
  const stand = racers.slice().sort((a, b) => cup.pts[b.d.id] - cup.pts[a.d.id]), rank = stand.indexOf(player) + 1;
  const before = DRIVERS.filter(unlocked).map(d => d.id), mirrorWas = cupOpen(CUPS[1]);
  if (rank <= 3 && cup.id !== 'daily') prof.cups[cup.id] = Math.min(prof.cups[cup.id] || 9, rank);
  prof.bestCup = Math.max(prof.bestCup, cup.score); saveProf();
  const fresh = DRIVERS.filter(d => unlocked(d) && !before.includes(d.id));
  const tbl = `<div class="tbl">${stand.map((r, i) => `<div class="row ${r.isPlayer ? 'me' : ''}"><span class="pl">${ORD(i + 1)}</span><span class="dot" style="background:${r.d.kart}"></span><span class="nm">${r.d.emoji} ${r.isPlayer ? 'You' : r.d.name}</span><b>${cup.pts[r.d.id]}</b></div>`).join('')}</div>`;
  const extra = `<p class="cupline">Cup ★ ${cup.score.toLocaleString()}${fresh.length ? ` · NEW RACER: ${fresh.map(d => d.emoji + ' ' + d.name).join(', ')}` : ''}${!mirrorWas && cupOpen(CUPS[1]) ? ' · 🪞 Mirror Cup open!' : ''}</p>`;
  pendingNext = 'menu';
  if (rank <= 3) {
    state = 'won'; D.won(cup.score, 'scored');
    ui.els.win.querySelector('h1').textContent = ['🏆 GOLD!', '🥈 SILVER!', '🥉 BRONZE!'][rank - 1];
    ui.els.win.querySelector('.res').innerHTML = tbl + extra; ui.els.win.querySelector('.hint').textContent = 'Tap for the menu';
    ui.win(cup.name.toUpperCase() + ' COMPLETE', '');
  } else {
    state = 'lost'; pendingNext = 'menu';
    ui.els.lose.querySelector('.res').innerHTML = tbl + extra; ui.els.lose.querySelector('.hint').textContent = 'Tap for the menu'; skipBtn.style.display = 'none';
    ui.lose('CUP OVER', `${ORD(rank)} overall · podium needs top 3`);
  }
}
ui.onTap(which => {
  A.audioInit();
  if (which === 'start') { startCup(); return; }
  skipBtn.style.display = '';
  if (which === 'lose' && pendingNext !== 'menu') { startRace(); return; }        // retry this race
  if (pendingNext === 'race') startRace();
  else { state = 'ready'; cup = null; hud.classList.add('off'); renderMenu(); previewTrack(); ui.start(); A.music(false); }
  pendingNext = null;
});

// ---------------------------------------------------------------- main loop
let tAcc = 0;
loop((dtf, t) => {
  const dt = Math.min(0.05, dtf / 60);
  tAcc += dt;
  if (state === 'play' && TR) race(dt);
  else if (TR && state === 'ready') { for (const r of racers) r.y = TR.h(r.x, r.z) + 0.07; }
  if (TR) {
    racers.forEach((r, i) => drawKart(r, i, dt, t)); wheelMesh.instanceMatrix.needsUpdate = true;
    // gems spin + respawn
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; if (b.t > 0) b.t -= dt;
      const s = b.t > 0 ? (b.t < 0.4 ? 1 - b.t / 0.4 : 0) : 1;
      m4.compose(v3.set(b.x, b.y + Math.sin(tAcc * 2 + i) * 0.15, b.z), q4.setFromEuler(e3.set(tAcc * 0.7 + i, tAcc * 1.3 + i, 0)), s3.set(s, s, s)); gems.setMatrixAt(i, m4);
      gems.setColorAt(i, pc.setHSL((b.hue + tAcc * 0.25) % 1, 0.85, 0.62));
    }
    gems.instanceMatrix.needsUpdate = true; if (gems.instanceColor) gems.instanceColor.needsUpdate = true;
    if (TR.padTex) TR.padTex.offset.y = -tAcc * 2.2;
    if (TR.crowd && state === 'play') { const c = TR.crowd; for (let i = 0; i < c.n; i += 1) { const b = c.base[i]; m4.makeTranslation(b.x, b.y + Math.max(0, Math.sin(tAcc * 9 + i * 1.7)) * 0.25, b.z); c.mesh.setMatrixAt(i, m4); } c.mesh.instanceMatrix.needsUpdate = true; }
    updateParticles(dt);
    updateCamera(dt);
    stage.followLight(player.mesh.position);
    if (state === 'play') updateHUD(dt);
    hud.classList.toggle('off', state !== 'play' || !!results && raceT - player.ftime > 2.6);
    A.engine(clamp(player.speed / TOP, 0, 1.3), player.boost > 0, state === 'play');
    if (player.drift && state === 'play' && Math.random() < 0.3) A.skid(true);
  }
});

// ---------------------------------------------------------------- boot
renderMenu(); previewTrack(); ui.start();
window.__game = {
  get state() { return state; },
  get level() { return cup ? cup.race + 1 : 1; },
  get score() { return cup ? cup.score + (state === 'play' ? raceStyle : 0) : 0; },
  bot() {
    bot = true;
    if (state === 'ready') { ui.hideStart(); startCup(); }
    if (state === 'play' && player.item && Math.random() < 0.08) itemReq = true;
  },
};

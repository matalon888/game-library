// Squad Surge — original game. Run down a sky track, recruit idle stick-buddies into your yellow squad, dodge saws,
// spinners, spike pads and spiked posts, then crash into the rival gang and topple the boss at the castle gate.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, stickman, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { bake, vcMat, crowdMesh } from './people.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, INTRO, genLevel } from './levels.js';
import { deepMeta } from './deep.js';
// deep v2 (studio lane 57, 2026-10-31): 36 hand-made tracks in 3 worlds, math gates, cages, rival patrols, a slam boss you dodge,
// stars, a level map, squad colours and a Daily Surge. READY stays false until v2 is finished and checked (?deep=1 is QA only).
const READY = true;
const DEEP = (READY && ab('deep-squad-surge')) || /[?&]deep=1(&|$)/.test(location.search);

const ST = store('squadsurge');
const F = flow('squadsurge');
const WB = worldBoard({ game: 'squad-surge', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });
let level = DEEP ? 1 : ST.get('level', 1), best = ST.get('best', 0);
const { scene, camera, followLight } = createStage({ fov: 50, shadowSize: 16 });
const ui = createUI({ title: 'SQUAD<br>SURGE', hint: 'Tap left or right to steer · or drag', hand: '👆', score: false });
const $ = id => document.getElementById(id);
const THEMES = [
  { bg: ['#8a6bff', '#bfe3ff'], track: '#f5f3ff', stripe: '#e6e0ff', rail: '#c9bcff', sea: '#5aa9ff', castle: '#7a4fe0', roof: '#ffb21f', ui: '#7b4dff' },
  { bg: ['#4fb6ff', '#d6f0ff'], track: '#ffffff', stripe: '#e3f1ff', rail: '#9fd2ff', sea: '#3b8cff', castle: '#5b3fd6', roof: '#ffc531', ui: '#2f8cff' },
  { bg: ['#ff8fc8', '#ffe0f0'], track: '#fff6fb', stripe: '#ffe3f1', rail: '#ffb8dc', sea: '#c36bff', castle: '#a04be0', roof: '#ffd23f', ui: '#ff4fa3' },
];
let YEL = '#ffd60a', RAINBOW = false; const IDLE = '#f1f1f6', PINK = '#ff3d8b', ORANGE = '#ff8a3d';
const TW = 9, SPEED = 10.5, MAX = 700;

// ---------------------------------------------------------------- shared assets
const people = crowdMesh(MAX); scene.add(people.mesh); people.mesh.material.emissive.set('#2a2a2a');
const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#5aa9ff', roughness: 0.35, metalness: 0.1 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -14; scene.add(sea);
const waveTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(0,40,120,.18)'; x.lineWidth = 5; for (let i = 0; i < 4; i++) { x.beginPath(); for (let k = 0; k <= 128; k += 8) x.lineTo(k, 16 + i * 32 + Math.sin(k / 128 * Math.PI * 4) * 6); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.colorSpace = THREE.SRGBColorSpace; return t; })();
sea.material.map = waveTex;
const splatGeo = new THREE.CircleGeometry(0.55, 10); splatGeo.rotateX(-Math.PI / 2);
const splats = new THREE.InstancedMesh(splatGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }), 90); splats.count = 0; scene.add(splats);
let splatN = 0;
function splat(x, z, color) { const M = new THREE.Matrix4().compose(new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, 0.02, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(0.6 + Math.random() * 0.8, 1, 0.6 + Math.random() * 0.8)); const k = splatN++ % 90; splats.setMatrixAt(k, M); splats.setColorAt(k, new THREE.Color(color)); splats.count = Math.min(90, splatN); splats.instanceMatrix.needsUpdate = true; splats.instanceColor.needsUpdate = true; }

function sawGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(1.0, 1.0, 0.18, 28), color: '#2f8cff', rot: [Math.PI / 2, 0, 0] }, { geo: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16), color: '#d9ecff', rot: [Math.PI / 2, 0, 0] }];
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; parts.push({ geo: new THREE.ConeGeometry(0.2, 0.42, 4), color: '#2f8cff', pos: [Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0], rot: [0, 0, a - Math.PI / 2] }); }
  return bake(parts);
}
function spikePostGeo() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.55, 0.55, 2.2, 18), color: '#2f8cff', pos: [0, 1.1, 0] }, { geo: new THREE.CylinderGeometry(0.62, 0.62, 0.2, 18), color: '#1d6fe0', pos: [0, 2.2, 0] }];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + r * 0.45; parts.push({ geo: new THREE.ConeGeometry(0.13, 0.36, 6), color: '#1d6fe0', pos: [Math.cos(a) * 0.62, 0.4 + r * 0.5, Math.sin(a) * 0.62], rot: [Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2] }); }
  return bake(parts);
}
const SAW = sawGeo(), POST = spikePostGeo(), VC = vcMat({ roughness: 0.3 });

// ---------------------------------------------------------------- level
let LV = null, curDaily = false, flaw = 0, clean = true, ring = null, slamT = 0, slamN = 0, world, P = [], obst = [], C, state = 'ready', phase = 'run', endZ, enemyZ, bossZ, boss, castle, flag, R, theme, hp = 0, hpMax = 0, swing = 0, endT = 0, camD = 10, recruitAcc = 0, chime = 0;
function addP(x, z, team) { if (P.length >= MAX) return null; const p = { x, z, y: 0, vy: 0, team, dead: 0, pop: 0, ry: team === 2 ? 0 : Math.PI, fly: null }; P.push(p); return p; }
function buildLevel() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  const fk = F.k(); LV = DEEP ? levelDef() : null; R = rng((DEEP ? LV.n + (curDaily ? 5000 : 0) : level) * 7919 + 3);
  theme = DEEP ? THEMES[WORLDS[LV.w - 1].theme] : THEMES[(level - 1) % THEMES.length]; ring = null; slamT = 0; slamN = 0; flaw = 0; clean = true;
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', theme.ui);
  sea.material.color.set(theme.sea);
  P = []; obst = []; splatN = 0; splats.count = 0; phase = 'run'; endT = 0; swing = 1.6; recruitAcc = 0; lossLog = {}; hitKind = ''; bossN = 0;
  const L = DEEP ? 13 * LV.rows.length + 24 : Math.min(260, 92 + level * 16);
  endZ = -L; enemyZ = endZ - 6; bossZ = endZ - 16;
  // track: stripes + rails, then an octagon arena
  const tex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = theme.track; x.fillRect(0, 0, 64, 128); x.fillStyle = theme.stripe; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, (L + 30) / 8); return t; })();
  const track = new THREE.Mesh(new THREE.BoxGeometry(TW, 1, L + 30), mat('#ffffff', { map: tex })); track.position.set(0, -0.5, -(L + 30) / 2 + 22); track.receiveShadow = true; world.add(track);
  for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, L + 30), mat(theme.rail)); r.position.set(sx * (TW / 2 + 0.25), -0.3, track.position.z); r.receiveShadow = true; world.add(r); }
  const under = new THREE.Mesh(new THREE.BoxGeometry(TW + 1, 3, L + 30), mat(theme.rail, { roughness: 0.8 })); under.position.set(0, -2.5, track.position.z); world.add(under);
  const arena = new THREE.Mesh(new THREE.CylinderGeometry(15, 13, 1.6, 8), mat(theme.track)); arena.rotation.y = Math.PI / 8; arena.position.set(0, -0.8, endZ - 15); arena.receiveShadow = true; world.add(arena);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(15.3, 15.3, 0.9, 8, 1, true), mat(theme.rail, { side: THREE.DoubleSide })); rim.rotation.y = Math.PI / 8; rim.position.set(0, -0.2, endZ - 15); world.add(rim);
  // obstacles + idle groups
  let z = -16; const nRows = Math.floor((L - 24) / 13);
  for (let i = 0; i < (DEEP ? 0 : nRows); i++, z -= 13) {
    if (i % 2 === 0) {           // idle group
      const n = 5 + Math.floor(R() * (5 + level * 0.8)), gx = (R() - 0.5) * (TW - 3);
      for (let k = 0; k < n; k++) { const a = k * 2.4, r = 0.5 * Math.sqrt(k); addP(clamp(gx + Math.cos(a) * r, -TW / 2 + 0.5, TW / 2 - 0.5), z + Math.sin(a) * r, 1); }
      if (R() < 0.7) { const gx2 = gx > 0 ? gx - 4 : gx + 4; for (let k = 0; k < 3 + Math.floor(R() * 4); k++) addP(gx2 + (R() - 0.5), z - 3 + (R() - 0.5), 1); }
      continue;
    }
    const kinds = level < 2 ? ['saw', 'posts'] : level < 4 ? ['saw', 'posts', 'spinner'] : ['saw', 'posts', 'spinner', 'pad'];
    const kind = kinds[Math.floor(R() * kinds.length)];
    if (kind === 'saw') {
      const g = new THREE.Group(); const m = new THREE.Mesh(SAW, VC); m.castShadow = true; m.position.y = 0.55; g.add(m); g.position.z = z; world.add(g);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.6, 0.06, 0.3), mat('#7d86a6')); slot.position.set(0, 0.02, z); world.add(slot);
      obst.push({ kind, z, g, m, A: TW / 2 - 1.3, w: (0.9 + R() * 0.5 + level * 0.06) * fk, ph: R() * 6, r: 1.05 });
    } else if (kind === 'posts') {
      const xs = level > 2 && R() < 0.5 ? [-2.8, 0.2, 3.0] : R() < 0.5 ? [-1.5, 1.6] : [R() < 0.5 ? -1.2 : 1.2]; const g = new THREE.Group(); g.position.z = z; world.add(g); const ms = [];
      for (const x of xs) { const m = new THREE.Mesh(POST, VC); m.position.x = x + (R() - 0.5) * 0.6; m.castShadow = true; g.add(m); ms.push(m); }
      obst.push({ kind, z, g, ms, r: 0.62 });
    } else if (kind === 'spinner') {
      const g = new THREE.Group(); g.position.set((R() - 0.5) * 2, 0, z); world.add(g);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.2, 16), mat('#1d6fe0')); hub.position.y = 0.6; hub.castShadow = true; g.add(hub);
      const arm = new THREE.Mesh(rounded(7.4, 0.5, 0.5, 0.2), glossy('#ff4d6d')); arm.position.y = 0.75; arm.castShadow = true; g.add(arm);
      obst.push({ kind, z, g, arm, len: 3.7, w: (1.6 + level * 0.06) * fk * (R() < 0.5 ? 1 : -1), ph: R() * 6 });
    } else {
      const x0 = R() < 0.5 ? -TW / 2 : -0.4, x1 = x0 + TW / 2 + 0.4; const g = new THREE.Group(); g.position.z = z; world.add(g);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, 3.2), mat('#ff4d6d')); pad.position.set((x0 + x1) / 2, 0.03, 0); g.add(pad);
      const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.6, 6), mat('#e8ecf8'), 40); let k = 0; const M = new THREE.Matrix4();
      for (let xx = x0 + 0.4; xx < x1 - 0.2 && k < 40; xx += 0.7) for (let zz = -1.2; zz <= 1.2 && k < 40; zz += 0.8) spikes.setMatrixAt(k++, M.makeTranslation(xx, 0.3, zz)); spikes.count = k; spikes.castShadow = true; g.add(spikes);
      obst.push({ kind, z, g, spikes, x0, x1, ph: R() * 6, on: false });
    }
  }
  if (DEEP) deepRows(fk);
  // enemy gang + castle + boss
  const ne = DEEP ? Math.max(1, Math.round(LV.gang * fk)) : Math.round((3 + Math.floor(level * 1.8 + R() * 3)) * fk);
  for (let k = 0; k < ne; k++) { const a = k * 2.4, r = 0.55 * Math.sqrt(k); addP(Math.cos(a) * r * 1.3, enemyZ - 2 + Math.sin(a) * r * 0.7, 2); }
  castle = buildCastle(); castle.position.set(0, 0, endZ - 27); world.add(castle);
  boss = stickman(PINK, PINK, 3.1); boss.position.set(0, 0, bossZ); boss.rotation.y = 0; world.add(boss);
  const hat = new THREE.Group(); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), mat('#22223b')); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 20), mat('#22223b')); top.position.y = 0.17; const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 20), mat('#ffd21f')); band.position.y = 0.06; hat.add(brim, top, band); hat.position.y = 1.72; boss.add(hat);
  const club = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.9, 10), mat('#7b4a2a')); club.position.set(0, -0.75, 0.2); club.rotation.x = 0.6; club.castShadow = true; boss.armR.add(club);
  hpMax = hp = DEEP ? Math.round(LV.boss.hp * fk) : Math.round((20 + level * 10) * fk); boss.hpBar = hpSprite(); boss.hpBar.position.set(0, 6.6, bossZ); world.add(boss.hpBar); drawHp();
  C = { x: 0, z: 2, tx: 0 };
  addP(0, 2, 0); if (DEEP) for (let k = 0; k < 3; k++) addP((k - 1) * 0.7, 3 + (k % 2) * 0.6, 0);
  ui.levels(level); ui.progress(0); setCount(); camD = 10;
  if (DEEP) META.onLevel(LV);
}
function buildCastle() {
  const g = new THREE.Group(), body = theme.castle, roof = theme.roof;
  const parts = [];
  parts.push({ geo: new THREE.BoxGeometry(16, 7, 4), color: body, pos: [0, 3.5, 0] });
  for (let k = -7; k <= 7; k += 2) parts.push({ geo: new THREE.BoxGeometry(1, 1, 4.2), color: body, pos: [k, 7.5, 0] });
  for (const x of [-8.5, 8.5, -3.6, 3.6]) {
    const big = Math.abs(x) > 5, h = big ? 10 : 12;
    parts.push({ geo: new THREE.CylinderGeometry(big ? 1.9 : 1.5, big ? 2.1 : 1.6, h, 20), color: body, pos: [x, h / 2, 0.6] });
    parts.push({ geo: new THREE.SphereGeometry(big ? 2.1 : 1.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), color: roof, pos: [x, h, 0.6], scl: [1, 1.5, 1] });
    parts.push({ geo: new THREE.ConeGeometry(0.4, 1.4, 10), color: roof, pos: [x, h + (big ? 3.6 : 3.1), 0.6] });
    parts.push({ geo: new THREE.BoxGeometry(0.6, 1.1, 0.2), color: '#2b1b5a', pos: [x, h * 0.6, 0.6 + (big ? 2.0 : 1.6)] });
  }
  parts.push({ geo: new THREE.BoxGeometry(4.4, 5.2, 0.4), color: roof, pos: [0, 2.6, 2.1] });
  parts.push({ geo: new THREE.BoxGeometry(3.4, 4.4, 0.5), color: '#2b1b5a', pos: [0, 2.2, 2.2] });
  parts.push({ geo: new THREE.CylinderGeometry(1.7, 1.7, 0.5, 20, 1, false, 0, Math.PI), color: '#2b1b5a', pos: [0, 4.4, 2.2], rot: [Math.PI / 2, Math.PI / 2, 0] });
  const m = new THREE.Mesh(bake(parts), vcMat({ roughness: 0.55 })); m.castShadow = true; m.receiveShadow = true; g.add(m);
  flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: PINK, side: THREE.DoubleSide })); flag.position.set(0.8, 14.6, 0.6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), mat('#ffffff')); pole.position.set(0, 13.6, 0.6); g.add(pole, flag);
  return g;
}
function hpSprite() { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(4.2, 1.6, 1); s.renderOrder = 10; s.cv = cv; s.tex = t; return s; }
function drawHp() { const s = boss.hpBar, x = s.cv.getContext('2d'); x.clearRect(0, 0, 256, 96); x.font = '800 46px "Baloo 2", system-ui'; x.textAlign = 'center'; x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,.35)'; x.strokeText(Math.max(0, Math.ceil(hp)), 128, 46); x.fillStyle = '#fff'; x.fillText(Math.max(0, Math.ceil(hp)), 128, 46); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(48, 62, 160, 18); x.fillStyle = '#ff3d5a'; x.fillRect(51, 65, 154 * Math.max(0, hp / hpMax), 12); s.tex.needsUpdate = true; }
const mine = () => P.filter(p => p.team === 0 && !p.dead);
$('count').style.transition = 'transform .12s';
function setCount() { const c = $('count'), v = mine().length; if (c.textContent != v) { c.style.transform = 'scale(1.3)'; setTimeout(() => c.style.transform = '', 90); } c.textContent = v; if (DEEP && META) META.tick(v); }
// ---------------------------------------------------------------- deep v2: authored tracks (levels.js)
const dayNo = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
function levelDef() { return curDaily ? genLevel(dayNo(), 0) : level <= LEVELS.length ? LEVELS[level - 1] : genLevel(level * 977, level); }
function playLevel(n) { if (n === 'daily') { curDaily = true; } else { curDaily = false; level = n; } buildLevel(); state = 'play'; ui.hideStart(); }
function label(text, color, w = 3.4) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
  x.font = '800 92px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 12; x.strokeStyle = 'rgba(0,0,0,.45)'; x.strokeText(text, 128, 66); x.fillStyle = color; x.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(w, w / 2, 1); s.renderOrder = 9; return s;
}
const gateTxt = g => (g.op === '*' ? 'x' : g.op === '/' ? '÷' : g.op) + g.v;
function parseGate(t) { const m = /^([+x\-\/])(\d+)$/.exec(t); return { op: m[1] === 'x' ? '*' : m[1], v: +m[2] }; }
const gateGood = g => g.op === '+' || g.op === '*';
function deepRows(fk) {
  let z = -16;
  LV.rows.forEach((raw, i) => {
    const r = raw.replace(/ /g, ''), n = LV.n; let m;
    if ((m = /^I(\d+)([<>=]?)$/.exec(r))) {
      const gx = m[2] === '<' ? -2.2 : m[2] === '>' ? 2.2 : m[2] === '=' ? 0 : (R() - 0.5) * (TW - 3), cnt = +m[1];
      for (let k = 0; k < cnt; k++) { const a = k * 2.4, rr = 0.5 * Math.sqrt(k); addP(clamp(gx + Math.cos(a) * rr, -TW / 2 + 0.5, TW / 2 - 0.5), z + Math.sin(a) * rr, 1); }
    } else if (r === 'Y' || r === 'Y<' || r === 'Y>') {
      const p = addP(r === 'Y<' ? -2.4 : r === 'Y>' ? 2.4 : (R() - 0.5) * 4, z, 1); if (p) p.gold = true;
    } else if ((m = /^G([^|]+)\|(.+)$/.exec(r))) {
      const g = new THREE.Group(); g.position.z = z; world.add(g); const gt = { kind: 'gate', z, l: parseGate(m[1]), r: parseGate(m[2]), done: false, g, panels: [] };
      [[gt.l, -1], [gt.r, 1]].forEach(([q, sx]) => {
        const good = gateGood(q), col = good ? '#2f9bff' : '#ff3d5a';
        const pn = new THREE.Mesh(new THREE.BoxGeometry(TW / 2 - 0.25, 3.0, 0.18), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.5, emissive: col, emissiveIntensity: 0.25, roughness: 0.3 })); pn.position.set(sx * TW / 4, 1.5, 0); g.add(pn); gt.panels.push(pn);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(TW / 2 - 0.25, 0.28, 0.4), mat(col)); bar.position.set(sx * TW / 4, 3.1, 0); g.add(bar);
        const lb = label(gateTxt(q), good ? '#ffffff' : '#ffd6dc'); lb.position.set(sx * TW / 4, 4.1, 0); g.add(lb);
      });
      for (const px of [-TW / 2, 0, TW / 2]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.3, 0.4), mat('#ffffff')); pl.position.set(px, 1.65, 0); g.add(pl); }
      obst.push(gt);
    } else if ((m = /^S(2?)$/.exec(r))) {
      const g = new THREE.Group(); const mm = new THREE.Mesh(SAW, VC); mm.castShadow = true; mm.position.y = 0.55; g.add(mm); g.position.z = z; world.add(g);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.6, 0.06, 0.3), mat('#7d86a6')); sl.position.set(0, 0.02, z); world.add(sl);
      obst.push({ kind: 'saw', z, g, m: mm, A: TW / 2 - 1.3, w: (0.9 + R() * 0.5 + n * 0.02) * (m[1] ? 1.45 : 1) * fk, ph: R() * 6, r: 1.05 });
    } else if ((m = /^P(?::([LCR]+))?$/.exec(r))) {
      const X = { L: -2.8, C: 0.2, R: 3.0 }, xs = m[1] ? [...m[1]].map(c => X[c]) : R() < 0.5 ? [-1.5, 1.6] : [R() < 0.5 ? -1.2 : 1.2]; const g = new THREE.Group(); g.position.z = z; world.add(g); const ms = [];
      for (const x of xs) { const mm = new THREE.Mesh(POST, VC); mm.position.x = x + (R() - 0.5) * 0.3; mm.castShadow = true; g.add(mm); ms.push(mm); }
      obst.push({ kind: 'posts', z, g, ms, r: 0.62 });
    } else if ((m = /^N(-?)$/.exec(r))) {
      const g = new THREE.Group(); g.position.set((R() - 0.5) * 2, 0, z); world.add(g);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.2, 16), mat('#1d6fe0')); hub.position.y = 0.6; hub.castShadow = true; g.add(hub);
      const arm = new THREE.Mesh(rounded(7.4, 0.5, 0.5, 0.2), glossy('#ff4d6d')); arm.position.y = 0.75; arm.castShadow = true; g.add(arm);
      obst.push({ kind: 'spinner', z, g, arm, len: 3.7, w: (1.6 + n * 0.03) * fk * (m[1] ? -1 : 1), ph: R() * 6 });
    } else if ((m = /^D([<>]?)$/.exec(r))) {
      const left = m[1] === '<' || (!m[1] && R() < 0.5), x0 = left ? -TW / 2 : -0.4, x1 = x0 + TW / 2 + 0.4; const g = new THREE.Group(); g.position.z = z; world.add(g);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, 3.2), mat('#ff4d6d')); pad.position.set((x0 + x1) / 2, 0.03, 0); g.add(pad);
      const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.6, 6), mat('#e8ecf8'), 40); let k = 0; const M = new THREE.Matrix4();
      for (let xx = x0 + 0.4; xx < x1 - 0.2 && k < 40; xx += 0.7) for (let zz = -1.2; zz <= 1.2 && k < 40; zz += 0.8) spikes.setMatrixAt(k++, M.makeTranslation(xx, 0.3, zz)); spikes.count = k; spikes.castShadow = true; g.add(spikes);
      obst.push({ kind: 'pad', z, g, spikes, x0, x1, ph: R() * 6, on: false });
    } else if ((m = /^C(\d+):(\d+)$/.exec(r))) {
      const g = new THREE.Group(); g.position.set(0, 0, z); world.add(g); const ob = { kind: 'cage', z, need: +m[1], open: false, g, ps: [], warned: false };
      const bm = mat('#8e93a8');
      for (let k = -2; k <= 2; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), bm); b.position.set(k * 0.95, 1.1, 2.2); g.add(b); const b2 = b.clone(); b2.position.z = -2.2; g.add(b2); }
      for (const sz of [-2.2, 2.2]) { const t = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.14), bm); t.position.set(0, 2.2, sz); g.add(t); }
      for (const sx of [-2.1, 2.1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 4.4), bm); t.position.set(sx, 1.1, 0); g.add(t); const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 4.4), bm); t2.position.set(sx, 2.2, 0); g.add(t2); }
      const lb = label('' + m[1] + '+', '#ffd60a', 3.0); lb.position.set(0, 3.5, 0); g.add(lb); ob.lb = lb;
      for (let k = 0; k < +m[2]; k++) { const a = k * 2.4, rr = 0.42 * Math.sqrt(k); const p = addP(clamp(Math.cos(a) * rr * 1.2, -1.8, 1.8), z + Math.sin(a) * rr, 1); if (p) { p.cage = ob; ob.ps.push(p); } }
      obst.push(ob);
    } else if ((m = /^E(\d+)$/.exec(r))) {
      const cnt = Math.max(1, Math.round(+m[1] * fk));
      for (let k = 0; k < cnt; k++) { const a = k * 2.4, rr = 0.5 * Math.sqrt(k); const p = addP(clamp(Math.cos(a) * rr * 1.3, -TW / 2 + 0.6, TW / 2 - 0.6), z - 3 + Math.sin(a) * rr * 0.8, 3); if (p) p.ry = 0; }
    }
    z -= 13;
  });
}
function goldPop(p) {
  const t = mine(); for (let k = 0; k < 10; k++) { const b = t[k % t.length] || p, q = addP(b.x + (Math.random() - 0.5) * 1.8, b.z + (Math.random() - 0.5) * 1.8, 0); if (!q) break; q.pop = 1; }
  tone(660, 0.1, 'triangle', 0.16, 1.5); tone(990, 0.14, 'triangle', 0.14, 1.5); tone(1320, 0.2, 'triangle', 0.12, 1.5);
  ui.pop('GOLDEN! +10', '#ffd23f', 60, 26); ui.flash(0.4); shake = 0.35; camD += 1.6; buzz([15, 20, 25]); confetti(world, new THREE.Vector3(p.x, 3, p.z), 50); setCount();
}
function applyGate(gt) {
  const q = C.x < 0 ? gt.l : gt.r, n = mine().length; let d = 0;
  if (q.op === '+') d = q.v; else if (q.op === '*') d = n * (q.v - 1); else if (q.op === '-') d = -q.v; else d = -Math.ceil(n - n / q.v);
  gt.panels[C.x < 0 ? 0 : 1].material.emissiveIntensity = 1.2;
  if (d > 0) {
    const t = mine(); for (let k = 0; k < d; k++) { const b = t[k % t.length], p = addP(b.x + (Math.random() - 0.5) * 1.6, b.z + (Math.random() - 0.5) * 1.6, 0); if (!p) break; p.pop = 1; }
    tone(520, 0.1, 'triangle', 0.14, 1.5); tone(780, 0.14, 'triangle', 0.12, 1.5); ui.pop(gateTxt(q).replace('x', '×'), '#7fd0ff', 54, 24); ui.flash(0.25); camD += 1.4; buzz(14);
  } else {
    hitKind = 'gates'; const t = mine(); t.sort(() => Math.random() - 0.5); for (let k = 0; k < -d && k < t.length; k++) kill(t[k], YEL, 1.3);
    sfx.smash(); ui.pop(gateTxt(q), '#ff3d5a', 54, 24); buzz([20, 20, 30]); shake = 0.3; flaw = 0; clean = false;
  }
  setCount(); if (!mine().length) lose();
}


// ---------------------------------------------------------------- input
let dragging = false, botX = null;
let tapOk = false;
input({
  onDown() { tapOk = state === 'play'; if (tapOk) { dragging = true; botX = null; } },
  onTap(e) { if (state === 'play' && tapOk && (phase === 'run' || (DEEP && phase === 'boss'))) C.tx = clamp((e.clientX / innerWidth - 0.5) * TW * 1.1, -TW / 2 + 0.6, TW / 2 - 0.6); },   // a tap sends the squad to that side of the track
  onMove(dx) { if (state === 'play' && dragging && (phase === 'run' || (DEEP && phase === 'boss'))) C.tx = clamp(C.tx + dx * 0.028, -TW / 2 + 0.6, TW / 2 - 0.6); },
  onUp() { dragging = false; },
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the squad steers itself to the lane with buddies to recruit and no saws, so the screen shows what dragging does
const DS = demo(null, { ready: () => state === 'play' && level === 1 && phase === 'run', wait: 600, ms: 2400 });
let demoBot = 0;
function demoSteer() {
  if (DS.on && !dragging) { if (demoBot++ % 12 === 0) window.__game.bot(); }
  else if (demoBot) { demoBot = 0; botX = null; }
}
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { if (DEEP) playLevel(META.next()); else { level++; ST.set('level', level); buildLevel(); state = 'play'; } }
  else { buildLevel(); state = 'play'; }
});
if (DEEP) ui.onTap(w => { WB.start(); if (w === 'start') { state = 'play'; sfx.tap(); playLevel(META.frontier()); } else if (w === 'win') playLevel(META.next()); else { buildLevel(); state = 'play'; } });

// ---------------------------------------------------------------- deaths + end
let lossLog = {}, hitKind = '', bossN = 0;
function kill(p, color, fling = 1) {
  if (p.team === 0) { const kk = phase === 'boss' ? 'boss' : phase === 'clash' ? 'rivals' : hitKind || 'gates'; lossLog[kk] = (lossLog[kk] || 0) + 1; }
  if (p.dead) return; p.dead = 1; p.fly = { vx: (Math.random() - 0.5) * 0.2 * fling, vy: 0.18 * fling, vz: (Math.random() - 0.2) * 0.15 * fling, spin: (Math.random() - 0.5) * 0.5 };
  burst(world, new THREE.Vector3(p.x, 0.9, p.z), [color, '#ffffff'], 7, { speed: 0.1, up: 0.08, size: 0.6, shape: 'sphere' });
  splat(p.x, p.z, color);
}
function lose() { if (state !== 'play') return; state = 'lost'; F.level(false, phase === 'boss' ? 0.75 + 0.25 * clamp(1 - hp / hpMax, 0, 1) : 0.75 * clamp(C.z / endZ, 0, 1)); sfx.fail(); buzz([40, 30, 60]); if (DEEP) META.lost(phase, hp, hpMax, C.z / endZ, lossLog, bossN); else ui.lose('SQUAD WIPED!', phase === 'boss' ? `Boss had ${Math.ceil(hp)} HP left` : 'Recruit more buddies on the way'); }
function win() {
  state = 'won'; F.level(true); if (!DEEP || !curDaily) WB.submit(1); const n = mine().length; best = Math.max(best, n); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20, 40]); ui.flash(0.7); ui.progress(1); flag.material.color.set(YEL);
  for (let k = 0; k < 3; k++) setTimeout(() => confetti(world, new THREE.Vector3(0, 6, bossZ - 4), 90), k * 250);
  if (DEEP) META.won({ level, daily: curDaily, n, par: LV.par, clean, hard: !!LV.hard }); else ui.win(level, `Castle captured with ${n} survivors`);
}


// deep v2 boss: 'club' swats the nearest k buddies, 'slam' drops a red ring on the squad (drag away), 'twin' does both (slower)
const RING_R = 2.5;
function bossAttacks(s, dt, team0) {
  const B = LV.boss, sw = B.sw || 1, hit = () => { sfx.smash(); buzz([30, 20, 30]); ui.flash(0.25); shake = 0.5; setCount(); if (!mine().length) lose(); };
  if (B.kind === 'club' || B.kind === 'twin') {
    swing -= s;
    if (swing < 0.35) boss.armR.rotation.x = lerp(boss.armR.rotation.x, -2.6, 0.2 * dt);
    if (swing <= 0) {
      swing = (B.kind === 'twin' ? 3.0 : 1.9) / sw; boss.armR.rotation.x = 1.2;
      team0.slice().sort((a, b) => Math.hypot(a.x, a.z - bossZ) - Math.hypot(b.x, b.z - bossZ)).slice(0, Math.min(team0.length, B.k)).forEach(p => kill(p, YEL, 2.2));
      hit();
    }
  }
  if (B.kind === 'slam' || B.kind === 'twin') {
    slamT -= s;
    if (!ring && slamT <= 0 && team0.length) {   // aim at the squad's middle, show a red ring for ~1.1 s
      let cx = 0, cz = 0; team0.forEach(p => { cx += p.x; cz += p.z; }); cx /= team0.length; cz /= team0.length;
      const m = new THREE.Mesh(new THREE.CircleGeometry(RING_R, 32), new THREE.MeshBasicMaterial({ color: '#ff2d4a', transparent: true, opacity: 0.3, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.06, cz); world.add(m);
      ring = { m, x: cx, z: cz, t: 1.1 / Math.min(1.5, sw) }; ring.t0 = ring.t; boss.armR.rotation.x = -2.6; tone(200, 0.2, 'sawtooth', 0.07, 0.6);
    }
    if (ring) {
      ring.t -= s; ring.m.material.opacity = 0.25 + 0.4 * (1 - ring.t / ring.t0) * (Math.sin(ring.t * 30) > -0.3 ? 1 : 0.4); ring.m.scale.setScalar(1 + 0.04 * Math.sin(ring.t * 20));
      if (ring.t <= 0) {
        let k = 0; for (const p of team0) if (Math.hypot(p.x - ring.x, p.z - ring.z) < RING_R) { kill(p, YEL, 2.4); k++; }
        burst(world, new THREE.Vector3(ring.x, 0.3, ring.z), ['#ff2d4a', '#ffffff'], 14, { speed: 0.2, up: 0.1, size: 0.8 }); world.remove(ring.m); ring = null; boss.armR.rotation.x = 1.2;
        slamT = (B.kind === 'twin' ? 2.6 : 2.2) / sw;
        if (k) hit(); else { ui.pop('DODGED!', '#7fffb0', 38, 30); tone(880, 0.1, 'triangle', 0.12, 1.4); }
      }
    }
  }
}

// ---------------------------------------------------------------- frame
const tmpV = new THREE.Vector3();
function slot(k, n) { const r = 0.52 * Math.sqrt(k + 0.3), a = k * 2.39996; return [Math.cos(a) * r, Math.sin(a) * r * 1.15]; }
loop((dt, rt) => {
  if (!C) return;
  const s = dt / 60, play = state === 'play'; GT += s; const t = GT;
  // obstacles animate always
  for (const o of obst) {
    if (o.kind === 'saw') { o.x = Math.sin(t * o.w + o.ph) * o.A; o.g.position.x = o.x; o.m.rotation.z = -t * 12; }
    else if (o.kind === 'posts') o.ms.forEach((m, i) => m.rotation.y = t * (i % 2 ? 2 : -2));
    else if (o.kind === 'spinner') { o.a = t * o.w + o.ph; o.arm.rotation.y = o.a; }
    else if (o.kind === 'pad') { const on = Math.sin(t * 2.6 + o.ph) > 0.1; o.on = on; o.spikes.position.y = lerp(o.spikes.position.y, on ? 0 : -0.62, 0.35 * dt); }
  }
  const team0 = [];
  for (const p of P) if (p.team === 0 && !p.dead) team0.push(p);
  if (play) {
    if (phase === 'run') {
      C.z -= SPEED * s;
      demoSteer();
      if (botX !== null && !dragging) C.tx = lerp(C.tx, botX, 0.25 * dt);
      C.x = lerp(C.x, C.tx, 0.22 * dt);
      ui.progress(Math.min(0.9, C.z / endZ * 0.9));
      if (C.z < enemyZ + 5) { phase = 'clash'; ui.pop('CLASH!', '#fff', 46, 26); sfx.smash(); buzz([30, 20, 30]); }
    } else if (phase === 'clash') {
      C.z -= SPEED * 0.4 * s; C.x = lerp(C.x, 0, 0.05 * dt);
      if (!P.some(p => p.team === 2 && !p.dead)) { phase = 'boss'; bossN = mine().length; swing = 1.4; slamT = 1.0; ui.pop(DEEP && LV.boss.kind !== 'club' ? 'DODGE THE RED RING!' : 'BEAT THE BOSS!', '#fff', 34, 26); }
    } else if (phase === 'boss') {
      C.z = lerp(C.z, bossZ + (DEEP ? 3.4 : 2.2), 0.04 * dt); if (DEEP && botX !== null && !dragging) C.tx = lerp(C.tx, botX, 0.25 * dt); C.x = DEEP ? lerp(C.x, C.tx, 0.2 * dt) : lerp(C.x, 0, 0.05 * dt);
      ui.progress(0.9 + 0.1 * (1 - hp / hpMax));
    }
  }
  // members
  const n0 = team0.length;
  team0.forEach((p, k) => {
    let tx, tz;
    if (phase === 'boss' && !DEEP) { const a = k * 2.39996, r = 2.1 + 0.42 * Math.sqrt(k); tx = Math.cos(a) * r; tz = bossZ + Math.sin(a) * r * 0.8 + 0.3; }
    else { const [ox, oz] = slot(k, n0); tx = C.x + ox; tz = C.z + oz; }
    tx = clamp(tx, -TW / 2 + 0.4, TW / 2 - 0.4);
    if (phase !== 'run') tx = clamp(tx, -12, 12);
    const f = Math.min(1, (p.pop > 0 ? 0.12 : 0.22) * dt); p.x += (tx - p.x) * f; p.z += (tz - p.z) * f;
    p.ry = phase === 'boss' ? Math.atan2(-p.x, bossZ - p.z) : Math.PI;
  });
  if (play && phase === 'run') {
    // recruit
    const rr = 0.52 * Math.sqrt(n0) + 0.9;
    for (const o of obst) {   // gates fire when the squad's front crosses them; cages open once the squad is big enough
      if (o.kind === 'gate' && !o.done && C.z <= o.z) { o.done = true; applyGate(o); }
      else if (o.kind === 'cage' && !o.open && Math.abs(C.z - o.z) < 9) {
        if (n0 >= o.need) { o.open = true; o.ps.forEach(q => { q.pop = 1; }); o.g.children.forEach(c => { if (c.isSprite) c.visible = false; else c.position.y += 3.2; }); ui.pop('FREE!', '#7fffb0', 44, 26); tone(660, 0.12, 'triangle', 0.14, 1.5); tone(990, 0.16, 'triangle', 0.12, 1.5); buzz(18); }
        else if (!o.warned && Math.abs(C.z - o.z) < 5) { o.warned = true; ui.pop(`NEED ${o.need}`, '#ffd60a', 36, 26); }
      }
    }
    for (const e of P) {   // rival patrols wake up when the squad gets close and trade 1-for-1
      if (e.team !== 3 || e.dead) continue;
      if (!e.on && Math.hypot(e.x - C.x, e.z - C.z) > 9) continue;
      e.on = true; let nb = null, nd = 1e9; for (const m of team0) { if (m.dead) continue; const d = (m.x - e.x) ** 2 + (m.z - e.z) ** 2; if (d < nd) { nd = d; nb = m; } }
      if (!nb) continue; const d = Math.sqrt(nd); e.x += (nb.x - e.x) / d * 7 * s; e.z += (nb.z - e.z) / d * 7 * s; e.ry = Math.atan2(nb.x - e.x, nb.z - e.z);
      if (d < 0.7) { hitKind = 'patrol'; kill(e, ORANGE); kill(nb, YEL); tone(300 + Math.random() * 200, 0.06, 'square', 0.06, 0.6); buzz(6); setCount(); if (!mine().length) lose(); }
    }
    for (const p of P) {
      if (p.team !== 1) continue;
      if (p.cage && !p.cage.open) continue;
      const dx = p.x - C.x, dz = p.z - C.z;
      if (dx * dx + dz * dz < rr * rr || team0.some(m => Math.abs(m.x - p.x) < 0.6 && Math.abs(m.z - p.z) < 0.6)) { p.team = 0; p.pop = 1; recruitAcc++; if (p.gold) goldPop(p); }
    }
    // obstacles hit members
    for (const o of obst) {
      if (Math.abs(o.z - C.z) > 6) continue;
      for (const p of team0) {
        if (p.dead) continue; let hit = false;
        if (o.kind === 'gate' || o.kind === 'cage') continue; if (o.kind === 'saw') hit = Math.abs(p.z - o.z) < 0.35 && Math.abs(p.x - o.x) < o.r;
        else if (o.kind === 'posts') hit = o.ms.some(m => Math.hypot(p.x - m.position.x, p.z - o.z) < o.r);
        else if (o.kind === 'spinner') { const lx = p.x - o.g.position.x, lz = p.z - o.z, ca = Math.cos(o.a), sa = Math.sin(o.a); const along = lx * ca - lz * sa, across = lx * sa + lz * ca; hit = Math.abs(along) < o.len && Math.abs(across) < 0.42; }
        else hit = o.kind === 'pad' && o.on && p.x > o.x0 && p.x < o.x1 && Math.abs(p.z - o.z) < 1.6;
        if (hit) { hitKind = o.kind; kill(p, YEL); o.hits = (o.hits || 0) + 1; clean = false; }
      }
      if (o.hits) { sfx.smash(); buzz(20); ui.pop('-' + o.hits, '#ff3d5a', 34, 32); o.hits = 0; setCount(); if (!mine().length) lose(); }
    }
  }
  if (play && phase === 'clash') {
    for (const e of P) {
      if (e.team !== 2 || e.dead) continue;
      // enemies charge the squad
      let nb = null, nd = 1e9; for (const m of team0) { if (m.dead) continue; const d = (m.x - e.x) ** 2 + (m.z - e.z) ** 2; if (d < nd) { nd = d; nb = m; } }
      if (!nb) break;
      const d = Math.sqrt(nd); e.x += (nb.x - e.x) / d * 6 * s; e.z += (nb.z - e.z) / d * 6 * s; e.ry = Math.atan2(nb.x - e.x, nb.z - e.z); e.run = 1;
      if (d < 0.7) { kill(e, PINK); kill(nb, YEL); tone(300 + Math.random() * 200, 0.06, 'square', 0.06, 0.6); buzz(6); }
    }
    setCount(); if (!mine().length) lose();
  }
  if (play && phase === 'boss') {
    const near = team0.filter(p => !p.dead && Math.hypot(p.x, p.z - bossZ) < 3.6 + Math.sqrt(team0.length) * 0.4).length;
    hp -= near * s * 1.1; drawHp();
    if (near && Math.random() < 0.25) { tone(500 + Math.random() * 300, 0.04, 'square', 0.04, 0.8); }
    if (!DEEP) {
    swing -= s;
    if (swing < 0.35) boss.armR.rotation.x = lerp(boss.armR.rotation.x, -2.6, 0.2 * dt);
    if (swing <= 0) {
      swing = Math.max(0.9, 1.6 - level * 0.05);
      boss.armR.rotation.x = 1.2; const k = Math.min(team0.length, 2 + Math.floor(level / 2));
      team0.slice().sort((a, b) => Math.hypot(a.x, a.z - bossZ) - Math.hypot(b.x, b.z - bossZ)).slice(0, k).forEach(p => kill(p, YEL, 2.2));
      sfx.smash(); buzz([30, 20, 30]); ui.flash(0.25); shake = 0.5; setCount();
      if (!mine().length) lose();
    }
    } else bossAttacks(s, dt, team0);
    if (hp <= 0 && state === 'play') { hp = 0; drawHp(); boss.fall = 1; burst(world, new THREE.Vector3(0, 3, bossZ), [PINK, '#ffffff'], 40, { speed: 0.3, up: 0.2, size: 1.4 }); win(); }
  }
  // recruit juice
  if (streakT > 0) { streakT -= s; if (streakT <= 0) { streak = 0; streakStep = 0; } }
  chime -= s; combo = Math.max(0, combo - s * 0.9); bounce = Math.max(0, bounce - s * 4);
  if (recruitAcc && chime <= 0) { const n = mine().length; combo = Math.min(14, combo + 1.6); tone((DEEP ? 420 + combo * 58 : 480 + Math.min(700, n * 8)), 0.08, 'triangle', 0.13, 1.3); buzz(6); if (recruitAcc > (DEEP ? 0 : 2)) ui.pop('+' + recruitAcc, combo > 6 ? '#ff5a1f' : '#ff9f1c', 34 + Math.min(14, combo * 2), 32); if (DEEP) { bounce = 1; streak += recruitAcc; streakT = 1.3; for (const [k, txt, col, sz, fl] of [[10, 'NICE x10!', '#ffd23f', 44, 0.2], [25, 'SURGE x25!!', '#ff9f1c', 54, 0.35], [50, 'MEGA x50!!!', '#ff4fa3', 64, 0.5]]) if (streak >= k && streakStep < k) { streakStep = k; ui.pop(txt, col, sz, 30); ui.flash(fl); shake = fl; tone(700 + k * 10, 0.16, 'square', 0.1, 1.5); buzz([20, 20, 40]); } } recruitAcc = 0; chime = 0.09; setCount(); }
  // boss idle/fall anim
  if (boss) {
    if (boss.fall) { boss.rotation.x = lerp(boss.rotation.x, -Math.PI / 2, 0.08 * dt); boss.position.y = lerp(boss.position.y, 0.4, 0.08 * dt); boss.hpBar.visible = false; }
    else { boss.armR.rotation.x = lerp(boss.armR.rotation.x, phase === 'boss' ? -0.6 : 0, 0.05 * dt); boss.armL.rotation.x = Math.sin(t * 3) * 0.2; boss.body.position.y = 0.95 + Math.sin(t * 4) * 0.03; }
  }
  // write instances
  let n = 0, dirty = false;
  for (const p of P) {
    if (p.fly) { p.fly.vy -= 0.012 * dt; p.x += p.fly.vx * dt; p.z += p.fly.vz * dt; p.y += p.fly.vy * dt; p.ry += p.fly.spin * dt; p.dead += 0.03 * dt; if (p.dead > 1.6 || p.y < -10) { p.gone = true; dirty = true; continue; } }
    p.pop = Math.max(0, p.pop - 0.05 * dt);
    const col = p.gold && p.team === 1 ? '#ffc400' : p.team === 0 ? (RAINBOW ? `hsl(${(n * 29) % 360},95%,58%)` : YEL) : p.team === 2 ? PINK : p.team === 3 ? ORANGE : IDLE;
    if (p.c !== col || p.slotI !== n) { people.color(n, col); p.c = col; p.slotI = n; }
    const run = p.dead ? 0 : p.team === 0 ? (play || state === 'ready' ? (state === 'ready' ? 0.15 : 1) : 0.3) : p.team === 2 ? (phase === 'clash' ? 1 : 0.12) : p.team === 3 ? (p.on ? 1 : 0.12) : 0.1;
    people.run.array[n] = run; people.pop.array[n] = Math.sin(p.pop * Math.PI) * 0.8;
    const fall = p.fly ? p.dead * 2 : 0;
    people.set(n, p.x, p.y, p.z, p.ry + fall * 0.5, state === 'won' && p.team === 0 ? 1 + Math.abs(Math.sin(t * 8 + n)) * 0.12 : p.team === 0 && bounce > 0 ? 1 + Math.sin(bounce * Math.PI) * 0.22 : 1);
    n++;
  }
  if (dirty) { P = P.filter(p => !p.gone); for (const p of P) p.slotI = -1; }
  people.commit(n, t);
  // camera: high chase, pulls back with squad size, swings to the boss at the end
  const sz = Math.sqrt(Math.max(1, n0));
  camD = lerp(camD, (phase === 'run' ? 12.5 : 15) + sz * 0.5, 0.04 * dt);
  shake = Math.max(0, shake - 0.03 * dt); const sh = (Math.random() - 0.5) * shake;
  const fz = phase === 'boss' || state === 'won' ? bossZ + 3 : C.z;
  if (state === 'won') endT += s;
  camera.position.set(C.x * 0.35 + sh + Math.sin(endT * 0.5) * 6, camD * 0.92, fz + camD * 0.78);
  camera.lookAt(C.x * 0.35, 0, fz - camD * 0.62);
  followLight(tmpV.set(C.x, 0, fz - 3));
});
let streak = 0, streakT = 0, streakStep = 0, shake = 0, GT = 0, combo = 0, bounce = 0;

const META = DEEP ? deepMeta({ ui, LEVELS, WORLDS, INTRO, playLevel, state: () => state, setState: v => { state = v; }, sfx, tone, buzz, getLevel: () => level, setSquad: (c, rb) => { YEL = c; RAINBOW = !!rb; } }) : null;
if (DEEP) level = META.frontier();
buildLevel();

window.__game = {
  jump(n) { if (DEEP) playLevel(n); }, get meta() { return META; }, get state() { return state; }, get level() { return level; }, get score() { return mine().length; }, get dbg() { return { phase, n: mine().length, z: Math.round(C.z), endZ, hp: Math.round(hp), enemies: P.filter(p => p.team === 2 && !p.dead).length }; },
  bot() {
    if (state === 'play' && phase === 'boss' && DEEP) { botX = ring ? clamp(ring.x > 0 ? ring.x - 4.2 : ring.x + 4.2, -3.4, 3.4) : 0; return; }
    if (state !== 'play' || phase !== 'run') return;
    // score candidate lanes: recruits ahead minus members we'd lose (simulate each member's offset vs predicted obstacle state)
    let bx = C.x, bs = -1e9; const team = mine(), now = GT;
    for (let x = -TW / 2 + 0.8; x <= TW / 2 - 0.8; x += 0.4) {
      let sc = -Math.abs(x - C.x) * 0.3;
      for (const p of P) if (p.team === 1 && p.z < C.z && p.z > C.z - 18 && Math.abs(p.x - x) < 1.8) sc += 1.5 * (1 - (C.z - p.z) / 24);
      for (const o of obst) {
        if (o.kind === 'gate' && !o.done) { const gz = C.z - o.z; if (gz > -1 && gz < 22) { const q = x < 0 ? o.l : o.r, nn = team.length; const d = q.op === '+' ? q.v : q.op === '*' ? nn * (q.v - 1) : q.op === '-' ? -q.v : -nn / 2; sc += d * 0.5 * (1 - gz / 26); } continue; }
        if (o.kind === 'cage') continue;
        const dz = C.z - o.z; if (dz < -3 || dz > 14) continue;
        for (const m of team) {
          const mx = clamp(x + (m.x - C.x), -TW / 2 + 0.4, TW / 2 - 0.4), ta = now + (m.z - o.z) / SPEED; let hit = false;
          if (o.kind === 'saw') for (const dt2 of [-0.06, 0, 0.06]) { if (Math.abs(Math.sin((ta + dt2) * o.w + o.ph) * o.A - mx) < o.r + 0.35) hit = true; }
          else if (o.kind === 'posts') hit = o.ms.some(q => Math.abs(q.position.x - mx) < o.r + 0.25);
          else if (o.kind === 'spinner') { const lx = mx - o.g.position.x; for (let tau = -0.42; tau <= 0.42 && !hit; tau += 0.04) { const lz = -SPEED * tau; if (lx * lx + lz * lz > (o.len + 0.4) ** 2) continue; const a = (ta + tau) * o.w + o.ph, ca = Math.cos(a), sa = Math.sin(a); if (Math.abs(lx * ca - lz * sa) < o.len + 0.3 && Math.abs(lx * sa + lz * ca) < 0.65) hit = true; } }
          else if (o.kind === 'pad') { const on = Math.sin(ta * 2.6 + o.ph) > 0 || Math.sin((ta + 0.15) * 2.6 + o.ph) > 0; hit = on && mx > o.x0 - 0.3 && mx < o.x1 + 0.3; }
          if (hit) sc -= 6;
        }
      }
      if (sc > bs) { bs = sc; bx = x; }
    }
    botX = bx;
  },
};

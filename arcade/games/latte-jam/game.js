// Latte Jam — original cup-sorting puzzle. Tap trays to park them in the slots; matching cups hop off the belt into them.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
const B = worldBoard({ game: 'latte-jam', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const S = createStage({ fov: 40, shadowSize: 10 });
const { scene, camera, sun, hemi, renderer } = S;
sun.position.set(4, 14, 7); sun.intensity = 1.55; hemi.intensity = 1.2; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
const ui = createUI({ title: 'LATTE<br>JAM', hint: 'Tap a tray · fill it with matching cups', hand: '👆', score: false });
const save = store('lattejam');
const F = flow('lattejam');
let level = save.get('level', 1);

// ---------------------------------------------------------------- colours
const COLS = [
  { n: 'pink', c: '#ff6fb5', lid: '#ffd1ea' }, { n: 'teal', c: '#2ec4d6', lid: '#c9f6fb' }, { n: 'purple', c: '#8b5cf6', lid: '#e3d6ff' },
  { n: 'green', c: '#36c26b', lid: '#cdf5db' }, { n: 'yellow', c: '#ffc93c', lid: '#fff1c2' }, { n: 'brown', c: '#9a5b34', lid: '#f1dcc5' },
  { n: 'red', c: '#ef3b4f', lid: '#ffd2d7' }, { n: 'blue', c: '#3a7bff', lid: '#d4e3ff' },
];
const THEMES = [
  { bg: ['#ffe6cf', '#fff5ea'], frame: '#ff8c42', floor: '#e9cfae', board: '#fff3e6' },
  { bg: ['#d9f5ea', '#f2fff9'], frame: '#3cc4a0', floor: '#d8d2c8', board: '#f2fff8' },
  { bg: ['#d6f2ff', '#effaff'], frame: '#2f9bea', floor: '#cfe6f2', board: '#f3fbff' },
  { bg: ['#f1e2ff', '#fbf4ff'], frame: '#a46cff', floor: '#e6d9ee', board: '#fbf6ff' },
];
let TH = THEMES[0];

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.lj-left{position:fixed;top:calc(56px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;background:#fff;color:#5b3a29;border-radius:16px;padding:2px 14px;font-weight:800;font-size:18px;box-shadow:0 4px 0 rgba(90,50,20,.18);pointer-events:none;white-space:nowrap}
.lj-left b{font-size:22px}
.hc-pop{-webkit-text-stroke:6px #7a3e1d;paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(120,60,20,.3)!important}
.hc-card p{color:#fff;text-shadow:0 2px 0 rgba(120,60,20,.35)!important}
.hc-card .hint{text-shadow:0 2px 0 rgba(120,60,20,.35)}
`; document.head.appendChild(css);
const leftEl = document.createElement('div'); leftEl.className = 'lj-left'; document.body.appendChild(leftEl);

// ---------------------------------------------------------------- static set: floor, conveyor deck, slots shelf, board
const set = new THREE.Group(); scene.add(set);
const floorTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e9cfae'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(120,70,30,.06)'; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(120,70,30,.18)'; g.fillRect(0, i * 32 + 31, w, 1.5); g.fillRect((i * 83) % 256, i * 32, 1.5, 32); } }, true);
floorTex.repeat.set(10, 10);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.6; floor.receiveShadow = true; set.add(floor);
const frameMat = mat('#ff8c42'), deckMat = mat('#fff3e6'), boardMat = mat('#fff3e6'), shelfMat = mat('#f6e3cf');
const deck = new THREE.Mesh(rounded(8.0, 3.9, 0.5, 0.25), deckMat); deck.rotation.x = -Math.PI / 2; deck.position.set(0, -0.25, -5.25); deck.receiveShadow = true; set.add(deck);
const deckRim = new THREE.Mesh(rounded(8.4, 4.3, 0.55, 0.3), frameMat); deckRim.rotation.x = -Math.PI / 2; deckRim.position.set(0, -0.33, -5.25); deckRim.receiveShadow = true; deckRim.castShadow = true; set.add(deckRim);
const shelf = new THREE.Mesh(rounded(8.4, 1.6, 0.4, 0.2), shelfMat); shelf.rotation.x = -Math.PI / 2; shelf.position.set(0, -0.2, -2.35); shelf.receiveShadow = true; set.add(shelf);
const shelfRim = new THREE.Mesh(rounded(8.6, 1.8, 0.45, 0.22), frameMat); shelfRim.rotation.x = -Math.PI / 2; shelfRim.position.set(0, -0.27, -2.35); shelfRim.castShadow = true; set.add(shelfRim);
const board = new THREE.Mesh(rounded(7.4, 6.4, 0.5, 0.35), boardMat); board.rotation.x = -Math.PI / 2; board.position.set(0, -0.25, 1.9); board.receiveShadow = true; board.castShadow = true; set.add(board);
// coffee machine (cups come out here)
const machine = new THREE.Group(); machine.position.set(3.55, 0, -6.55); set.add(machine);
machine.add(Object.assign(new THREE.Mesh(rounded(1.3, 1.6, 1.1, 0.12), mat('#4a4f63')), { castShadow: true }));
machine.children[0].position.y = 0.8;
const mTop = new THREE.Mesh(rounded(1.4, 0.2, 1.2, 0.08), mat('#2b2d42')); mTop.position.y = 1.65; machine.add(mTop);
const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.3, 12), glossy('#c0c6d6', { metalness: 0.7 })); spout.position.set(-0.45, 0.8, 0.2); machine.add(spout);
const mLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#7dff9b' })); mLight.position.set(0.35, 1.25, 0.56); machine.add(mLight);
const chute = new THREE.Mesh(rounded(0.9, 0.4, 0.9, 0.1), frameMat); chute.position.set(-0.6, 0.15, 0); machine.add(chute);

// conveyor path (cups snake from the machine to the front, just above the slots)
const ROWS = [-6.45, -5.3, -4.15], XL = -3.25, XR = 3.0;
const PATH = [new THREE.Vector2(XR, ROWS[0]), new THREE.Vector2(XL, ROWS[0]), new THREE.Vector2(XL, ROWS[1]), new THREE.Vector2(XR, ROWS[1]), new THREE.Vector2(XR, ROWS[2]), new THREE.Vector2(XL + 0.6, ROWS[2])];
const segLen = []; let PLEN = 0; for (let i = 1; i < PATH.length; i++) { const l = PATH[i].distanceTo(PATH[i - 1]); segLen.push(l); PLEN += l; }
const SPACE = 0.47, QVIS = Math.floor(PLEN / SPACE);
function pathAt(d) { // d = distance from the FRONT (0 = front of queue)
  let s = PLEN - d; if (s < 0) s = 0;
  for (let i = 0; i < segLen.length; i++) { if (s <= segLen[i]) return PATH[i].clone().lerp(PATH[i + 1], s / segLen[i]); s -= segLen[i]; }
  return PATH[PATH.length - 1].clone();
}
const beltMat = mat('#6b4a3a', { roughness: 0.8 }), railMat = mat('#ffffff');
for (let i = 1; i < PATH.length; i++) {
  const a = PATH[i - 1], b = PATH[i], len = a.distanceTo(b), m = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? len + 0.5 : 0.5, 0.06, i % 2 ? 0.5 : len + 0.5), beltMat);
  m.position.set((a.x + b.x) / 2, 0.01, (a.y + b.y) / 2); m.receiveShadow = true; set.add(m);
}
const beltLines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.02, 0.44), mat('#8a6650'), 140); let bl = 0; beltLines.receiveShadow = true; set.add(beltLines);

// slots
const NSLOT_MAX = 5;
let NSLOT = 4, slots = [];
const slotGroup = new THREE.Group(); set.add(slotGroup);
function buildSlots() {
  slotGroup.clear(); slots = [];
  const w = 1.62, gap = 0.08, total = NSLOT * w + (NSLOT - 1) * gap;
  for (let i = 0; i < NSLOT; i++) {
    const x = -total / 2 + w / 2 + i * (w + gap);
    const pad = new THREE.Mesh(rounded(w, 1.15, 0.08, 0.06), mat('#ffffff', { transparent: true, opacity: 0.75 })); pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.0, -2.35); pad.receiveShadow = true; slotGroup.add(pad);
    slots.push({ x, z: -2.35, tray: null });
  }
}

// ---------------------------------------------------------------- trays & cups
const CELL = 0.5, TRAY_H = 0.3;
function trayGeo(color) {
  const parts = [part(rounded(1.46 - 0.16, TRAY_H - 0.16, 0.96, 0.09), color, { y: TRAY_H / 2 })];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    parts.push(part(new THREE.CylinderGeometry(0.165, 0.175, 0.09, 20), new THREE.Color(color).offsetHSL(0, -0.04, 0.1).getStyle(), { x: (i - 1) * CELL, y: TRAY_H + 0.045, z: (j - 0.5) * CELL }));
    parts.push(part(new THREE.CylinderGeometry(0.115, 0.115, 0.095, 16), new THREE.Color(color).offsetHSL(0, 0.05, -0.2).getStyle(), { x: (i - 1) * CELL, y: TRAY_H + 0.05, z: (j - 0.5) * CELL }));
  }
  return merge(parts);
}
const trayGeos = COLS.map(c => trayGeo(c.c));
const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.02 });
const VCdim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, color: '#c4bcc0' });
const lidGeo = merge([part(rounded(1.5, 0.1, 1.0, 0.05), '#ffffff', { y: 0.05 }), part(new THREE.TorusGeometry(0.22, 0.04, 8, 20), '#ffffff', { y: 0.12, rx: Math.PI / 2 })]);

// cups: 3 instanced meshes (body, lid, sleeve) for every cup in play
const MAXC = 260;
const cupBody = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.175, 0.13, 0.42, 18).translate(0, 0.21, 0), mat('#ffffff', { roughness: 0.4 }), MAXC);
const cupLid = new THREE.InstancedMesh(merge([part(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 18), '#ffffff', { y: 0.445 }), part(new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { y: 0.46, sy: 0.45 }), part(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), '#ffffff', { x: 0.07, y: 0.53 })]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }), MAXC);
const cupBand = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.168, 0.152, 0.13, 18, 1, true).translate(0, 0.19, 0), mat('#ffffff', { roughness: 0.7, side: THREE.DoubleSide }), MAXC);
for (const m of [cupBody, cupLid, cupBand]) { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); }

// ---------------------------------------------------------------- level state
let state = 'ready', trays = [], queue = [], cups = [], served = 0, total = 0, jamT = 0, hopT = 0, shift = 0, combo = 0, comboT = 0, shake = 0;
const trayGroup = new THREE.Group(); scene.add(trayGroup);

function genLevel() {
  const r = rng(level * 7349 + 11), fk = F.k();
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', TH.frame);
  frameMat.color.set(TH.frame); boardMat.color.set(TH.board); deckMat.color.set(TH.board); floorMat.color.set('#ffffff');
  const C = Math.min(8, Math.round((level <= 2 ? 3 : 2 + Math.floor((level + 1) / 2)) * fk)), K = level === 1 ? 2 : level <= 3 ? 3 : 4;
  NSLOT = 4; buildSlots();
  const N = C * K;
  // --- place trays: layer 0 compact around the centre, upper layers fully supported by the layer below
  const GW = 14, GH = 12, x0 = -3.5 + CELL / 2, z0 = -1.05 + CELL / 2;
  const layers = [];
  const cellsOf = (c, rr, o) => { const w = o ? 2 : 3, h = o ? 3 : 2, out = []; for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) out.push((c + i) + (rr + j) * GW); return out; };
  const fits = (c, rr, o) => c >= 0 && rr >= 0 && c + (o ? 2 : 3) <= GW && rr + (o ? 3 : 2) <= GH;
  const placed = [];
  let remaining = N, L = 0;
  const n0 = Math.min(N, Math.max(4, Math.ceil(N * (N > 10 ? 0.55 : 0.67))));
  while (remaining > 0 && L < 5) {
    const want = L === 0 ? n0 : Math.min(remaining, Math.ceil(remaining * (L === 1 ? 0.65 : 1)));
    const occ = new Set(), below = L ? layers[L - 1] : null, cands = [];
    for (let c = 0; c < GW; c++) for (let rr = 0; rr < GH; rr++) for (const o of [0, 1]) {
      if (!fits(c, rr, o)) continue;
      const cl = cellsOf(c, rr, o);
      if (below && !cl.every(k => below.has(k))) continue;
      const cx = x0 + (c + (o ? 1 : 1.5)) * CELL - CELL / 2, cz = z0 + (rr + (o ? 1.5 : 1)) * CELL - CELL / 2;
      const d = Math.hypot(cx * 1.0, (cz - 1.9) * 1.15);
      cands.push({ c, rr, o, cl, score: (L === 0 ? d : 0) + r() * (L === 0 ? 1.6 : 10) });
    }
    cands.sort((a, b) => a.score - b.score);
    const lay = new Set(); let got = 0;
    for (const cd of cands) { if (got >= want) break; if (cd.cl.some(k => lay.has(k))) continue; cd.cl.forEach(k => lay.add(k)); placed.push({ ...cd, layer: L }); got++; }
    if (!got) break;
    layers.push(lay); remaining -= got; L++;
  }
  while (placed.length > N) placed.pop();
  // colours: K trays per colour, shuffled
  const pool = []; for (let c = 0; c < C; c++) for (let k = 0; k < K; k++) pool.push(c);
  const useK = Math.floor(placed.length / C); // in case placement fell short
  pool.length = placed.length; for (let i = 0; i < pool.length; i++) pool[i] = i % C;
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // build trays
  trayGroup.clear(); trays = [];
  placed.forEach((p, i) => {
    const col = pool[i], m = new THREE.Mesh(trayGeos[col], VC);
    const x = x0 + (p.c + (p.o ? 1 : 1.5)) * CELL - CELL / 2, z = z0 + (p.rr + (p.o ? 1.5 : 1)) * CELL - CELL / 2, y = p.layer * TRAY_H;
    m.position.set(x, y, z); m.rotation.y = p.o ? Math.PI / 2 : 0; m.castShadow = m.receiveShadow = true; m.userData.tray = trays.length; trayGroup.add(m);
    trays.push({ i: trays.length, col, m, cells: p.cl, layer: p.layer, home: m.position.clone(), st: 'board', slot: -1, fill: 0, incoming: 0, cupIds: [], fly: 0, from: null, rotFrom: 0, lid: null });
  });
  // --- cup order: simulate a valid tap order (uncovered first), keep a few trays "active" and interleave their cups in runs
  const covered = (t, gone) => trays.some(o => o !== t && !gone.has(o.i) && o.layer > t.layer && o.cells.some(k => t.cells.includes(k)));
  const gone = new Set(), order = [];
  while (order.length < trays.length) {
    const avail = trays.filter(t => !gone.has(t.i) && !covered(t, gone));
    const t = avail[Math.floor(r() * avail.length)]; order.push(t); gone.add(t.i);
  }
  const ACT = Math.max(1, Math.min(NSLOT - (level < 4 ? 2 : 1), order.length));
  const active = order.slice(0, ACT).map(t => ({ t, left: 6 })); let nextI = ACT, last = null;
  queue = [];
  while (active.length) {
    let a = (last && active.includes(last) && r() < Math.min(0.9, 0.62 / fk)) ? last : active[Math.floor(r() * active.length)];
    queue.push(a.t.col); a.left--; last = a;
    if (a.left === 0) { active.splice(active.indexOf(a), 1); if (nextI < order.length) active.push({ t: order[nextI++], left: 6 }); }
  }
  total = queue.length; served = 0; jamT = 0; combo = 0; shift = 0;
  // cups: every cup is an instance; queue cups get a path slot
  cups = queue.map((col, k) => ({ col, st: 'queue', q: k, p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, tray: null, slot: 0 }));
  cups.forEach((c, k) => { const v = pathAt(k * SPACE); c.p.set(v.x, 0.04, v.y); });
  for (let k = 0; k < MAXC; k++) { const col = k < cups.length ? COLS[cups[k].col] : COLS[0]; cupBody.setColorAt(k, new THREE.Color(col.c)); cupLid.setColorAt(k, new THREE.Color(col.lid)); cupBand.setColorAt(k, new THREE.Color(col.c).offsetHSL(0, 0, -0.12)); }
  for (const m of [cupBody, cupLid, cupBand]) { m.instanceColor.needsUpdate = true; m.count = cups.length; }
  ui.levels(level); ui.progress(0); updateLeft(); refreshCover();
}
function updateLeft() { leftEl.innerHTML = `☕ <b>${total - served}</b> cups left`; }
function isCovered(t) { return t.st === 'board' && trays.some(o => o !== t && o.st === 'board' && o.layer > t.layer && o.cells.some(k => t.cells.includes(k))); }
function refreshCover() { for (const t of trays) if (t.st === 'board') t.m.material = isCovered(t) ? VCdim : VC; }

// ---------------------------------------------------------------- interaction
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function tapTray(t) {
  if (state !== 'play' || !t || t.st !== 'board') return false;
  if (isCovered(t)) { t.wob = 1; tone(220, 0.07, 'square', 0.05); return false; }
  const s = slots.findIndex(sl => !sl.tray);
  if (s < 0) { ui.pop('SLOTS FULL!', '#ffffff', 30, 44); shake = 0.4; tone(160, 0.12, 'square', 0.07); buzz(20); return false; }
  slots[s].tray = t; t.slot = s; t.st = 'fly'; t.fly = 0; t.from = t.m.position.clone(); t.rotFrom = t.m.rotation.y;
  sfx.pick(t.col); buzz(10);
  refreshCover();
  return true;
}
input({ onTap: (e) => {
  if (state !== 'play') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(trayGroup.children, false).filter(h => trays[h.object.userData.tray].st === 'board');
  if (!hits.length) return;
  // prefer the topmost tray under the finger
  hits.sort((a, b) => trays[b.object.userData.tray].layer - trays[a.object.userData.tray].layer);
  tapTray(trays[hits[0].object.userData.tray]);
} });
ui.onTap(w => { B.start(); if (w === 'win') level++; genLevel(); state = 'play'; });

function studPos(t, k) { const i = k % 3, j = Math.floor(k / 3); return new THREE.Vector3(t.m.position.x + (i - 1) * CELL, t.m.position.y + TRAY_H + 0.07, t.m.position.z + (j - 0.5) * CELL); }
function frontCup() { return cups.find(c => c.st === 'queue' && c.q === 0); }
function win() {
  if (state === 'play') B.submit(1); state = 'won'; F.level(true); save.set('level', level + 1); sfx.win(); buzz([20, 40, 20]); ui.flash(0.5);
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3(0, 2, -1), 70), i * 170);
  ui.win(level, `All ${total} cups served!`);
}
function lose() {
  state = 'lost'; F.level(false, served / total); sfx.fail(); buzz([40, 30, 60]); shake = 1; ui.flash(0.3);
  ui.lose('JAMMED!', `${served}/${total} cups served — keep a slot free!`);
}

// ---------------------------------------------------------------- loop
const D = new THREE.Object3D(), tmp = new THREE.Vector3();
let beltOff = 0;
loop((dt, t) => {
  const sec = dt / 60;
  // trays flying to slots / leaving
  for (const tr of trays) {
    if (tr.st === 'fly') {
      tr.fly = Math.min(1, tr.fly + sec * 3.2); const k = tr.fly, e = 1 - Math.pow(1 - k, 3), sl = slots[tr.slot];
      tr.m.position.set(lerp(tr.from.x, sl.x, e), lerp(tr.from.y, 0.06, e) + Math.sin(k * Math.PI) * 1.4, lerp(tr.from.z, sl.z, e));
      tr.m.rotation.y = lerp(tr.rotFrom, 0, e); tr.m.rotation.z = Math.sin(k * Math.PI) * 0.3;
      if (k >= 1) { tr.st = 'slot'; tr.m.rotation.z = 0; tr.land = 1; tone(330, 0.06, 'sine', 0.1, 0.8); burst(scene, tr.m.position.clone().add(new THREE.Vector3(0, 0.3, 0)), ['#ffffff', COLS[tr.col].lid], 8, { speed: 0.05, up: 0.04, size: 0.4, life: 0.6 }); }
    } else if (tr.st === 'done') {
      tr.fly += sec * 1.6; const k = Math.min(1, tr.fly);
      if (k < 0.35) { const s = 1 + Math.sin(k / 0.35 * Math.PI) * 0.18; tr.m.scale.set(s, 1 / s, s); }
      else { tr.m.scale.setScalar(1); tr.m.position.x += sec * 18 * (k - 0.3); tr.m.position.y += sec * 4 * (k - 0.3); tr.m.rotation.z -= sec * 2; }
      tr.cupIds.forEach((ci, n) => { const c = cups[ci]; c.p.copy(studPos(tr, n)); });
      if (k >= 1 && tr.m.visible) { tr.m.visible = false; tr.cupIds.forEach(ci => cups[ci].st = 'gone'); }
    }
    if (tr.land) { tr.land = Math.max(0, tr.land - sec * 4); const s = 1 + tr.land * 0.12; tr.m.scale.set(s, 1 - tr.land * 0.15, s); }
    if (tr.wob) { tr.wob = Math.max(0, tr.wob - sec * 3); tr.m.position.x = tr.home.x + Math.sin(tr.wob * 30) * 0.06 * tr.wob; }
  }
  // cups hop from the front of the belt into a matching parked tray
  if (state === 'play') {
    hopT -= sec;
    const f = frontCup();
    if (f && hopT <= 0 && shift <= 0.02) {
      const tr = trays.find(x => x.st === 'slot' && x.col === f.col && x.fill + x.incoming < 6);
      if (tr) {
        f.st = 'hop'; f.t = 0; f.from.copy(f.p); f.tray = tr; f.slot = tr.fill + tr.incoming; tr.incoming++; tr.cupIds.push(cups.indexOf(f));
        cups.forEach(c => { if (c.st === 'queue') c.q--; }); shift = 1; hopT = 0.11;
        combo++; comboT = 0.8; note(64 + ((combo * 2) % 14), 0.12, 0.09);
      }
    }
    comboT -= sec; if (comboT <= 0 && combo) { if (combo >= 10) ui.pop(`${combo} IN A ROW!`, '#ffffff', 34, 40); combo = 0; }
    // jam detection: all slots busy, nothing in motion, front cup has nowhere to go
    const busy = slots.every(s => s.tray), moving = trays.some(x => x.st === 'fly') || cups.some(c => c.st === 'hop');
    const canTake = f && trays.some(x => (x.st === 'slot' || x.st === 'fly') && x.col === f.col && x.fill + x.incoming < 6);
    if (f && busy && !moving && !canTake) { jamT += sec; if (jamT > 0.9) lose(); } else jamT = 0;
    if (f && busy && !canTake && Math.floor(t * 4) % 2) leftEl.style.background = '#ffd6d6'; else leftEl.style.background = '#fff';
  }
  shift = Math.max(0, shift - sec * 9);
  // update cup transforms
  for (let k = 0; k < cups.length; k++) {
    const c = cups[k];
    if (c.st === 'queue') {
      const v = pathAt((c.q + shift) * SPACE);
      if (c.q + shift > QVIS) { c.p.set(v.x, -5, v.y); } else c.p.set(v.x, 0.04, v.y);
      D.position.copy(c.p); D.scale.setScalar(c.q + shift > QVIS ? 0 : 1); D.rotation.set(0, 0, 0);
    } else if (c.st === 'hop') {
      c.t = Math.min(1, c.t + sec * 4.2); const to = studPos(c.tray, c.slot), e = c.t;
      c.p.set(lerp(c.from.x, to.x, e), lerp(c.from.y, to.y, e) + Math.sin(e * Math.PI) * 1.1, lerp(c.from.z, to.z, e));
      D.position.copy(c.p); D.rotation.set(0, 0, Math.sin(e * Math.PI) * 0.6); D.scale.setScalar(1);
      if (c.t >= 1) {
        c.st = 'seated'; const tr = c.tray; tr.incoming--; tr.fill++; served++; updateLeft(); ui.progress(served / total);
        tr.land = 0.6;
        if (tr.fill >= 6) {
          tr.st = 'done'; tr.fly = 0; slots[tr.slot].tray = null;
          const lid = new THREE.Mesh(lidGeo, mat(COLS[tr.col].lid)); lid.position.y = TRAY_H + 0.5; tr.m.add(lid); tr.lid = lid;
          sfx.coin(); buzz(15); ui.pop('+6 ☕', '#ffffff', 34, 44);
          burst(scene, tr.m.position.clone().add(new THREE.Vector3(0, 0.6, 0)), [COLS[tr.col].c, '#ffffff', '#ffd166'], 18, { speed: 0.08, up: 0.08, size: 0.5 });
          if (served >= total) setTimeout(() => state === 'play' && win(), 450);
        }
      }
    } else if (c.st === 'seated') { D.position.copy(studPos(c.tray, c.slot)); c.p.copy(D.position); D.rotation.set(0, 0, 0); D.scale.setScalar(1); }
    else if (c.st === 'gone') { D.position.set(0, -10, 0); D.scale.setScalar(0); }
    else { D.position.copy(c.p); D.scale.setScalar(1); D.rotation.set(0, 0, 0); }
    D.updateMatrix(); cupBody.setMatrixAt(k, D.matrix); cupLid.setMatrixAt(k, D.matrix); cupBand.setMatrixAt(k, D.matrix);
  }
  for (const m of [cupBody, cupLid, cupBand]) m.instanceMatrix.needsUpdate = true;
  for (const tr of trays) if (tr.lid) tr.lid.position.y = Math.max(TRAY_H + 0.12 + 0.36, tr.lid.position.y - sec * 6);
  // belt stripes scroll toward the front
  beltOff = (beltOff + sec * (shift > 0 ? 3 : 0.4)) % 0.5; bl = 0;
  for (let d = beltOff; d < PLEN && bl < 140; d += 0.5) { const v = pathAt(d), v2 = pathAt(d + 0.05); D.position.set(v.x, 0.045, v.y); D.rotation.set(0, Math.atan2(v2.x - v.x, v2.y - v.y) + Math.PI / 2, 0); D.scale.setScalar(1); D.updateMatrix(); beltLines.setMatrixAt(bl++, D.matrix); }
  beltLines.count = bl; beltLines.instanceMatrix.needsUpdate = true;
  mLight.material.color.set(Math.sin(t * 6) > 0 ? '#7dff9b' : '#2fbf5a');
  // camera: fixed 3/4 top-down framing the whole bar; tiny shake on jam/full
  shake = Math.max(0, shake - sec * 2);
  const a = camera.aspect, far = a < 0.7 ? 1 : 0.8;
  camera.position.set((Math.random() - 0.5) * shake * 0.2, 17.6 * far + 1, 6.6 * far + 1.1); camera.lookAt(0, 0, -0.95);
  camera.fov = a < 0.7 ? 43 : 38; camera.updateProjectionMatrix();
  S.followLight(new THREE.Vector3(0, 0, -1.5));
});

genLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return served; },
  bot() {
    if (state !== 'play') return;
    if (trays.some(x => x.st === 'fly')) return;
    const f = frontCup(); if (!f) return;
    const q = cups.filter(c => c.st === 'queue').sort((a, b) => a.q - b.q).map(c => c.col);
    const parked = trays.filter(x => x.st === 'slot' || x.st === 'fly');
    const need = (col) => { const cap = parked.filter(x => x.col === col).reduce((s, x) => s + 6 - x.fill - x.incoming, 0); return cap; };
    if (need(f.col) > 0) return;                               // cups will flow on their own
    const free = slots.filter(s => !s.tray).length; if (!free) return;
    const open = trays.filter(x => x.st === 'board' && !isCovered(x));
    let pick = open.find(x => x.col === f.col);
    if (!pick && free > 1) { let bestI = 1e9; for (const x of open) { const i = q.indexOf(x.col); if (i >= 0 && i < bestI) { bestI = i; pick = x; } } }
    if (pick) tapTray(pick);
  },
};

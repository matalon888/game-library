// Peakpatch: TriPeaks Solitaire Journey — original TriPeaks solitaire on a voyage across 12 diorama islands.
// Play open cards one higher or lower than the waste card (K↔A wraps), build streaks for wild cards, earn boosters by
// play, and sail the stepping-stone path from island to island. Art: the AI 3D diorama library (assets/d01–d12.glb,
// our own) as journey map + level backdrops; cards, sea, sky, clouds, UI and sound are all code.
import { THREE, createUI, store, loop, buzz, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import * as TP from './tripeaks.js';
import { buildAtlas, cardGeo, setCells, quadGeo, setQuadCell, cardMaterial, shadowTex, CELL, CH, BACKS } from './cards.js';
import { createWorld, ISLAND_NAMES, ISLAND_SKY } from './world.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Peakpatch: TriPeaks Solitaire Journey', PI = Math.PI, V3 = THREE.Vector3;
const S = store('peakpatch');
const st = { level: S.get('level', 1), stars: S.get('stars', 0), best: S.get('best', {}), boosts: S.get('boosts', { wild: 1, plus: 1, undo: 2 }), wins: S.get('wins', 0), seen: S.get('seen', 0), points: S.get('points', 0) };
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('peakpatch');
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const islandOf = n => Math.floor((n - 1) / TP.LEVELS_PER_ISLAND) % TP.ISLANDS;

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.22, bloomThreshold: 0.93, bloomRadius: 0.45, exposure: 1.0, envIntensity: 0.22, lite: LITE, grade: { sat: 1.15, contrast: 1.04, vignette: 0.1, grain: 0 } });
const hemi = new THREE.HemisphereLight('#fff6ea', '#a8e4ee', 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d6', 2.5); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4; scene.add(sun, sun.target);
const W = createWorld(scene);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Peakpatch<small>TRIPEAKS SOLITAIRE JOURNEY</small>', hint: 'Tap to start', hand: '👆', progress: false, score: false });
ui.els.start.classList.add('pp-title');
const D = daily('peakpatch', ui, { name: NAME });
const B = worldBoard({ game: 'peakpatch', label: 'Stars earned', limits: { maxRun: 3, maxPerSec: 1 }, mode: 'sum', corner: 'tr', accent: '#5aa8ff' });
ui.els.win.querySelector('h1').textContent = 'PEAKS CLEARED!';
const winStars = $('<div class="pp-winstars"><i>⭐</i><i>⭐</i><i>⭐</i></div>'); ui.els.win.querySelector('h1').after(winStars);
const loadEl = document.getElementById('pp-load'), loadBar = loadEl.querySelector('b');

const hud = $(`<div class="pp">
  <div id="pp-top" class="pp-hidden"><button id="pp-home" class="pp-btn pp-white pp-round" aria-label="Journey map" style="position:static">🗺️</button>
    <div class="pp-lv"><b>Level 1</b><small></small></div><div class="pp-score"><small>SCORE</small><b>0</b></div></div>
  <div id="pp-left" class="pp-hidden"></div>
  <div id="pp-bot" class="pp-hidden">
    <div class="pp-streak"><div class="lbl">STREAK<br><b>0</b></div><div class="pp-sbar"><i></i></div><div class="pp-sgift" title="Wild card at 7">🌟</div></div>
    <div class="pp-boosts">
      <button class="pp-btn pp-boost" data-b="wild" aria-label="Wild card"><div class="ic wild">★</div><b>0</b></button>
      <button class="pp-btn pp-boost" data-b="plus" aria-label="Five more cards"><div class="ic plus">+5</div><b>0</b></button>
      <button class="pp-btn pp-boost" data-b="undo" aria-label="Undo"><div class="ic">↩️</div><b>0</b></button>
    </div>
  </div>
  <div id="pp-stockn" class="pp-hidden">0</div>
  <div id="pp-maptop" class="pp-hidden"><div class="pp-stars"><span>⭐</span><span>0</span></div>
    <div class="pp-inv"><span><i class="w"></i><b data-i="wild">0</b></span><span><i style="color:#2f7fe0;font-size:14px">+5</i><b data-i="plus">0</b></span><span><i>↩️</i><b data-i="undo">0</b></span></div></div>
  <button id="pp-mute" class="pp-btn pp-white pp-round pp-hidden" aria-label="Sound">🔊</button>
  <div id="pp-mapbot" class="pp-hidden"><div class="pp-isle"><b></b><small></small></div><button class="pp-btn pp-green pp-play"></button></div>
</div>`);
document.body.appendChild(hud);
const q = s => hud.querySelector(s);
const el = { top: q('#pp-top'), lv: q('.pp-lv'), lvB: q('.pp-lv b'), lvS: q('.pp-lv small'), score: q('.pp-score'), scoreN: q('.pp-score b'), left: q('#pp-left'), bot: q('#pp-bot'),
  streak: q('.pp-streak'), streakN: q('.pp-streak .lbl b'), sbar: q('.pp-sbar i'), sgift: q('.pp-sgift'), boosts: q('.pp-boosts'), stockN: q('#pp-stockn'), home: q('#pp-home'),
  mapTop: q('#pp-maptop'), starsN: q('.pp-stars span:last-child'), starsBox: q('.pp-stars'), mute: q('#pp-mute'), mapBot: q('#pp-mapbot'), isleB: q('.pp-isle b'), isleS: q('.pp-isle small'), play: q('.pp-play') };
for (let i = 1; i < 7; i++) { const s = document.createElement('s'); s.style.left = (i / 7 * 100) + '%'; el.sbar.parentNode.appendChild(s); }
el.mute.textContent = snd.muted ? '🔇' : '🔊';
el.mute.onclick = () => { el.mute.textContent = snd.toggle() ? '🔇' : '🔊'; };
const nodesEl = $('<div class="pp"></div>'); document.body.appendChild(nodesEl);

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', ready = false, G = null, curP = null, dailyMode = !!D.seed, runT0 = 0, busy = 0, pop = null, recorded = false, lastStars = 0, lastIsland = 0, idleT = 0;
const hist = [];

// ---------------------------------------------------------------- tweens
const tweens = [];
const anim = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));

// ---------------------------------------------------------------- particles (instanced octahedra; camera-space and world-space)
function particles(parent, N = 500) {
  const list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); m.count = 0; m.frustumCulled = false; m.renderOrder = 5; parent.add(m);
  const tmp = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
        list.push({ p: new V3(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.5, pos.z + (Math.random() - 0.5) * spread * 0.2), v: new V3(Math.cos(a) * Math.sin(b) * sp, up * (0.5 + Math.random()), Math.sin(a) * Math.sin(b) * sp * 0.3), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 6; const f = p.life / p.max;
        e.set(p.r, p.r * 0.6, 0); qq.setFromEuler(e); s.setScalar(p.size * (0.3 + f * 0.9)); tmp.compose(p.p, qq, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r * (0.7 + f), p.c.g * (0.7 + f), p.c.b * (0.7 + f)); i++; }
      m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    },
  };
}
const CG = new THREE.Group(); cam.add(CG);
const FX = particles(CG, 600), WFX = particles(scene, 400);
const CONF = ['#ff6b7f', '#ffd23f', '#3fcf6e', '#3aa8ff', '#b05cff', '#ffffff', '#ff8a2a'];

// ---------------------------------------------------------------- card objects
let atlas = null, cardMat = null, badgeMat = null, shadows = null;
const DEPTH = 10;
const cards = [];             // every live card object of this level
let slotCard = [], stockCards = [], wasteCards = [];
function makeCard(data, back) {
  const geo = cardGeo(data.w ? CELL.wild : CELL.face(data.r, data.s), CELL.back(back));
  const mesh = new THREE.Mesh(geo, cardMat); mesh.renderOrder = 2; CG.add(mesh);
  const c = { data, mesh, up: false, place: 'stock', slot: null, tw: null, cur: { x: 0, y: -20, z: -DEPTH, s: 0.5, ry: PI, rz: 0 }, px: 0, py: 0, rz: (Math.random() - 0.5) * 0.14, hover: 0, hint: 0, shake: 0, badge: null };
  mesh.userData.c = c; cards.push(c); return c;
}
function clearCards() {
  for (const c of cards) { CG.remove(c.mesh); c.mesh.geometry.dispose(); if (c.badge) { CG.remove(c.badge); c.badge.geometry.dispose(); } }
  cards.length = 0; slotCard = []; stockCards = []; wasteCards = [];
}
function setBadge(c, n) {
  if (!n) { if (c.badge) { const b = c.badge; c.badge = null; const s0 = b.scale.x; anim(0.35, k => { b.scale.setScalar(s0 * (1 + k * 0.8)); b.material.opacity = 1 - k; }).then(() => { CG.remove(b); b.geometry.dispose(); }); } return; }
  if (!c.badge) { c.badge = new THREE.Mesh(quadGeo(CELL.lock(n), 1, 1.4), badgeMat.clone()); c.badge.renderOrder = 4; CG.add(c.badge); }
  else setQuadCell(c.badge.geometry, CELL.lock(n));
}
/** start a tween towards the card's (new) home */
function go(c, dur = 0.32, lift = 0.6) { c.tw = { t: 0, dur, from: { ...c.cur }, lift }; }

// ---------------------------------------------------------------- layout (screen px → camera space)
let L = null;
function layout() {
  const w = innerWidth, h = innerHeight, por = w / h < 0.8;
  const o = { w, h, por };
  if (por) {
    o.isle = { x: 0, y: 64, w, h: h * 0.42 - 64 };
    o.tab = { x: 6, y: h * 0.355, w: w - 12, h: h * 0.375 };
    o.bc = Math.min(74, w * 0.18, h * 0.09);
    o.stock = [o.bc * 0.5 + 14, h * 0.875]; o.waste = [o.stock[0] + o.bc * 1.18, h * 0.875];
    o.streak = { x: 12, y: h * 0.755, w: w - 24 };
  } else {
    o.isle = { x: 0, y: 60, w: w * 0.4, h: h - 70 };
    o.tab = { x: w * 0.38, y: 74, w: w * 0.6, h: h * 0.57 };
    o.bc = Math.min(100, h * 0.13);
    const cx = o.tab.x + o.tab.w / 2;
    o.stock = [cx - o.bc * 1.6, h * 0.86]; o.waste = [cx - o.bc * 0.4, h * 0.86];
    o.streak = { x: o.tab.x + o.tab.w * 0.1, y: h * 0.69, w: o.tab.w * 0.8 };
  }
  const hh = DEPTH * Math.tan(cam.fov * PI / 360), hw = hh * cam.aspect;
  o.unit = 2 * hh / h;
  o.cam = (px, py) => [(px / w * 2 - 1) * hw, (1 - py / h * 2) * hh];
  if (G) {
    const N = G.p.N, Hr = Math.max(...G.slots.map(s => s.k)) + 1, Ht = (Hr - 1) * TP.DY + CH;
    o.cpx = Math.min(o.tab.w / (N * 1.04 + 0.2), o.tab.h / (Ht + 0.15), por ? 999 : 118);
    o.N = N; o.Ht = Ht;
  }
  return o;
}
function home(c) {
  let px, py, z, s, rz = 0;
  if (c.place === 'tab') {
    const sl = c.slot, cx = L.tab.x + L.tab.w / 2, cy = L.tab.y + L.tab.h / 2;
    px = cx + (sl.x / 2 - (L.N - 1) / 2) * L.cpx * 1.04; py = cy + (L.Ht / 2 - CH / 2) * L.cpx - sl.k * TP.DY * L.cpx;
    z = -DEPTH - sl.k * 0.06; s = L.cpx;
  } else if (c.place === 'stock') {
    const j = stockCards.length - 1 - stockCards.indexOf(c), jj = Math.min(j, 7);
    px = L.stock[0] - jj * 1.2; py = L.stock[1] - jj * 2.2; z = -DEPTH + 0.4 - jj * 0.02; s = L.bc;
    c.mesh.visible = j < 8;
  } else if (c.place === 'waste') {
    const j = wasteCards.length - 1 - wasteCards.indexOf(c), jj = Math.min(j, 3);
    px = L.waste[0] - jj * L.bc * 0.09; py = L.waste[1]; z = -DEPTH + 0.6 - jj * 0.02; s = L.bc; rz = c.rz * (j ? 1 : 0.5);
    c.mesh.visible = j < 4 || !!c.tw;
  } else { px = L.w / 2; py = -200; z = -DEPTH; s = L.bc; }
  c.px = px; c.py = py;
  const [x, y] = L.cam(px, py);
  return { x, y, z, s: s * L.unit, ry: c.up ? 0 : PI, rz };
}
const shM = new THREE.Matrix4(), shQ = new THREE.Quaternion(), shS = new V3(), shP = new V3();
function updateCards(dt) {
  let ns = 0;
  for (const c of cards) {
    const hm = home(c), cur = c.cur;
    if (c.tw) {
      const tw = c.tw; tw.t += dt / tw.dur; const k = Math.min(1, tw.t), e = easeIO(k), arc = Math.sin(PI * k);
      cur.x = tw.from.x + (hm.x - tw.from.x) * e; cur.y = tw.from.y + (hm.y - tw.from.y) * e + arc * tw.lift * hm.s * 0.5;
      cur.z = tw.from.z + (hm.z - tw.from.z) * e + arc * tw.lift * 1.2; cur.s = (tw.from.s + (hm.s - tw.from.s) * e) * (1 + arc * 0.12 * tw.lift);
      cur.ry = tw.from.ry + (hm.ry - tw.from.ry) * e; cur.rz = tw.from.rz + (hm.rz - tw.from.rz) * e;
      if (k >= 1) c.tw = null;
    } else Object.assign(cur, hm);
    const m = c.mesh;
    let x = cur.x, y = cur.y, z = cur.z, s = cur.s;
    if (c.hover > 0.001) { y += c.hover * s * 0.08; z += c.hover * 0.25; }
    if (c.hint > 0) { c.hint = Math.max(0, c.hint - dt * 0.35); s *= 1 + Math.sin(T * 9) * 0.045 * Math.min(1, c.hint * 3); }
    if (c.shake > 0) { c.shake = Math.max(0, c.shake - dt); x += Math.sin(c.shake * 60) * c.shake * s * 0.25; }
    m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.set(0, cur.ry, cur.rz);
    if (c.badge) { c.badge.position.set(x, y - s * 0.05, z + 0.05); c.badge.scale.setScalar(s * 0.92); c.badge.visible = m.visible; }
    if (m.visible && shadows && ns < shadows.count0) {
      const lift = c.tw ? Math.sin(PI * Math.min(1, c.tw.t)) * c.tw.lift : 0;
      shP.set(x + s * (0.05 + lift * 0.12), y - s * (0.07 + lift * 0.16), z - 0.03); shQ.setFromEuler(new THREE.Euler(0, 0, cur.rz)); shS.set(s * (1 + lift * 0.1), s * (1 + lift * 0.1), 1);
      if (Math.abs(cur.ry - PI / 2) > 0.4) { shM.compose(shP, shQ, shS); shadows.setMatrixAt(ns++, shM); }
    }
  }
  if (shadows) { shadows.count = ns; shadows.instanceMatrix.needsUpdate = true; }
}

// ---------------------------------------------------------------- HUD bits
function floatText(text, px, py, color) { const d = $(`<div class="pp-float">${text}</div>`); if (color) d.style.webkitTextStrokeColor = color; d.style.left = px + 'px'; d.style.top = py + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 900); }
function combo(text, cls = '') { const d = $(`<div class="pp-combo ${cls}">${text}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1050); }
function banner(small, big, line, ms = 2400) { const d = $(`<div class="pp-banner"><small>${small}</small><b>${big}</b>${line ? `<span>${line}</span>` : ''}</div>`); document.body.appendChild(d); setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = 0; setTimeout(() => d.remove(), 400); }, ms); }
const flying = [];
function fly(html, sx, sy, tx, ty, d = 0.6, done = () => {}) { const f = $(`<div class="pp-fly">${html}</div>`); document.body.appendChild(f); flying.push({ el: f, sx, sy, tx, ty, t: 0, d, cx: (sx + tx) / 2 + (Math.random() - 0.5) * 120, cy: Math.min(sy, ty) - 80, done }); }
function boostBtn(k) { return el.boosts.querySelector(`[data-b="${k}"]`); }
function refreshBoosts() {
  for (const k of ['wild', 'plus', 'undo']) { const b = boostBtn(k); b.querySelector('b').textContent = st.boosts[k] || 0; b.disabled = !(st.boosts[k] > 0) || (k === 'undo' && !hist.length); }
  for (const k of ['wild', 'plus', 'undo']) el.mapTop.querySelector(`[data-i="${k}"]`).textContent = st.boosts[k] || 0;
}
let shownScore = 0;
function refreshPlayHUD() {
  if (!G) return;
  el.scoreN.textContent = G.score.toLocaleString();
  const n = TP.left(G); el.left.textContent = n ? `${n} card${n > 1 ? 's' : ''} to clear` : 'All clear!';
  const s = G.streak, f = s ? ((s - 1) % 7 + 1) / 7 : 0;
  el.streakN.textContent = s; el.sbar.style.width = (f * 100) + '%'; el.sgift.classList.toggle('ready', s % 7 === 6);
  el.stockN.textContent = G.stock.length; el.stockN.classList.toggle('low', G.stock.length <= 2);
  refreshBoosts();
}
function placeHUD() {
  if (!L) return;
  const sy = L.streak.y; el.streak.style.left = L.streak.x + 'px'; el.streak.style.width = L.streak.w + 'px'; el.streak.style.right = 'auto'; el.streak.style.top = (sy - 17) + 'px';
  const bx = L.waste[0] + L.bc * 0.62 + 12, by = L.stock[1];
  el.boosts.style.left = bx + 'px'; el.boosts.style.top = (by - (el.boosts.offsetHeight || 54) / 2) + 'px';
  el.stockN.style.left = L.stock[0] + 'px'; el.stockN.style.top = (L.stock[1] + L.bc * 0.7 + 2) + 'px';
  el.left.style.top = (L.por ? L.tab.y - 4 : L.tab.y - 6) + 'px'; el.left.style.left = (L.tab.x + L.tab.w / 2) + 'px';
}

// ---------------------------------------------------------------- level flow
function levelParams() {
  if (dailyMode) { const p = TP.levelParams(24 + (D.seed % 36), D.seed); p.island = D.seed % 12; p.daily = true; return p; }
  return TP.levelParams(st.level);
}
async function startLevel() {
  if ((mode === 'play' && state !== 'lost') || busy || !ready) return;
  closePop(); hideBanner();
  curP = levelParams();
  const isl = curP.island; lastIsland = isl;
  await W.load(isl);
  busy++;
  mode = 'play'; state = 'play'; recorded = false; hist.length = 0; idleT = 0;
  G = TP.newGame(curP, F.k());
  clearCards();
  slotCard = G.slots.map(s => { const c = makeCard(s.card, isl); c.place = 'tab'; c.slot = s; c.up = false; return c; });
  stockCards = G.stock.map(d => { const c = makeCard(d, isl); c.place = 'stock'; return c; });
  wasteCards = G.waste.map(d => { const c = makeCard(d, isl); c.place = 'stock'; return c; });
  for (const c of slotCard) if (c.slot.lock) setBadge(c, c.slot.lock);
  L = layout();
  // everything starts in the stock pile, face down
  for (const c of cards) { const p = c.place, u = c.up; c.place = 'stock'; c.up = false; const h = home(c); Object.assign(c.cur, h); c.cur.y -= 0.0; c.place = p; c.up = u; c.mesh.visible = true; }
  for (const c of wasteCards) { Object.assign(c.cur, { ...c.cur }); }
  showPlayHUD();
  el.lv.classList.toggle('hard', !!curP.hard);
  el.lvB.textContent = dailyMode ? 'Daily' : `Level ${st.level}`;
  el.lvS.textContent = (curP.hard ? 'HARD · ' : '') + ISLAND_NAMES[isl];
  refreshPlayHUD();
  snd.music(true); snd.whoosh();
  runT0 = performance.now(); B.start();
  // deal: tableau back-to-front, then flip the open cards, then the first waste card
  await wait(L.por ? 380 : 300);
  const order = slotCard.slice().sort((a, b) => b.slot.k - a.slot.k || a.slot.x - b.slot.x);
  for (let i = 0; i < order.length; i++) { const c = order[i]; go(c, 0.42, 0.9); if (i % 2 === 0) snd.deal(i); await wait(32); }
  await wait(380);
  for (const c of slotCard) if (c.slot.up) { c.up = true; go(c, 0.3, 0.4); }
  snd.flip();
  await wait(200);
  for (const c of wasteCards) { c.place = 'waste'; c.up = true; go(c, 0.36, 0.8); }
  snd.flick();
  await wait(300);
  busy--;
  refreshPlayHUD();
  if (st.level <= 2 && !dailyMode) setTimeout(() => mode === 'play' && banner('HOW TO PLAY', 'One higher or lower!', 'Tap a card next to the bottom one: 7 → 6 or 8 · K ↔ A', 3800), 300);
}
function showPlayHUD() {
  el.top.classList.remove('pp-hidden'); el.bot.classList.remove('pp-hidden'); el.left.classList.remove('pp-hidden'); el.stockN.classList.remove('pp-hidden');
  el.mapTop.classList.add('pp-hidden'); el.mapBot.classList.add('pp-hidden'); el.mute.classList.add('pp-hidden'); nodesEl.classList.add('pp-hidden');
}
function hideBottom() { for (const e of [el.bot, el.left, el.stockN]) e.classList.add('pp-hidden'); }
function showMapHUD() {
  el.top.classList.add('pp-hidden'); el.bot.classList.add('pp-hidden'); el.left.classList.add('pp-hidden'); el.stockN.classList.add('pp-hidden');
  el.mapTop.classList.remove('pp-hidden'); el.mapBot.classList.remove('pp-hidden'); el.mute.classList.remove('pp-hidden'); nodesEl.classList.remove('pp-hidden');
  refreshMapHUD();
}

function pushHist() { hist.push({ snap: TP.snapshot(G), stock: stockCards.slice(), waste: wasteCards.slice() }); if (hist.length > 60) hist.shift(); }
function tap(c) {
  if (mode !== 'play' || state !== 'play' || busy || pop) return;
  idleT = 0;
  if (c.place === 'stock') { if (stockCards[stockCards.length - 1] === c) drawStock(); return; }
  if (c.place !== 'tab' || c.slot.gone) return;
  const s = c.slot;
  if (!TP.isOpen(G, s)) { c.shake = 0.25; return; }
  if (s.lock) { c.shake = 0.35; snd.bad(); buzz(20); return; }
  if (!TP.playable(G, s)) { c.shake = 0.3; snd.bad(); buzz(15); const w = wasteCards[wasteCards.length - 1]; if (w) w.shake = 0.2; G.streak = G.streak; return; }
  playSlot(s);
}
function playSlot(s) {
  pushHist();
  const c = slotCard[s.id], before = G.streak;
  const res = TP.play(G, s);
  c.place = 'waste'; c.up = true; wasteCards.push(c); go(c, 0.34, 1);
  snd.play(G.streak); buzz(8);
  const [x, y] = L.cam(c.px, c.py);
  FX.burst(new V3(x, y, -DEPTH + 0.5), ['#fff6c2', '#ffffff', '#ffd23f', '#a8e1ff'], 12, { speed: 1.4, up: 1.2, size: c.cur.s * 0.9, life: 0.6, grav: 3 });
  floatText('+' + res.pts, c.px, c.py - L.cpx * 0.4);
  el.score.classList.remove('bump'); void el.score.offsetWidth; el.score.classList.add('bump');
  for (const f of res.flipped) { const fc = slotCard[f.id]; fc.up = true; setTimeout(() => { go(fc, 0.3, 0.5); snd.flip(); }, 120); }
  for (const u of res.unlocked) { const uc = slotCard[u.id]; setTimeout(() => { setBadge(uc, 0); snd.unlock2(); const [ux, uy] = L.cam(uc.px, uc.py); FX.burst(new V3(ux, uy, -DEPTH + 0.3), ['#ffe58a', '#5cc265', '#ffffff'], 16, { speed: 1.6, up: 1.4, size: uc.cur.s, life: 0.7 }); }, 150); }
  for (const o of G.slots) if (!o.gone && o.lock > 0) setBadge(slotCard[o.id], o.lock);
  if (res.peak) { G.score += 500; setTimeout(() => { combo('PEAK! +500', 'blue'); snd.peak(); FX.burst(new V3(x, y, -DEPTH + 0.5), CONF, 30, { speed: 2.4, up: 2, size: c.cur.s * 1.2, life: 1 }); }, 100); }
  const sk = G.streak;
  const words = { 3: 'Nice!', 5: 'Great!', 8: 'Super!', 10: 'Amazing!', 13: 'Fantastic!', 16: 'Unstoppable!' };
  if (words[sk] && !res.peak) { combo(words[sk], sk >= 10 ? 'gold' : ''); snd.combo(Math.min(8, sk)); }
  if (sk > 0 && sk % 7 === 0) {   // streak reward: a wild card
    st.boosts.wild = (st.boosts.wild || 0) + 1; save();
    const r = el.sgift.getBoundingClientRect(), b = boostBtn('wild').getBoundingClientRect();
    setTimeout(() => { snd.wild(); fly('<div class="ic wild" style="width:34px;height:46px;border-radius:7px;background:linear-gradient(135deg,#ff7eb3,#ffe66b,#6bc8ff,#b48bff);display:grid;place-items:center;color:#fff;font-size:22px">★</div>', r.left + 19, r.top + 19, b.left + 30, b.top + 30, 0.7, () => { refreshBoosts(); boostBtn('wild').classList.add('glow'); setTimeout(() => boostBtn('wild').classList.remove('glow'), 1500); }); combo(`${sk} STREAK! +1 WILD`, 'gold'); }, 250);
  }
  refreshPlayHUD();
  afterMove();
}
function drawStock() {
  if (!G.stock.length) return;
  pushHist();
  const lost = G.streak;
  TP.draw(G);
  const c = stockCards.pop(); c.place = 'waste'; c.up = true; wasteCards.push(c); go(c, 0.36, 0.8);
  snd.draw(); buzz(6);
  if (lost >= 4) floatText(`Streak ${lost} ✓`, L.streak.x + 60, L.streak.y - 26, '#d98a10');
  refreshPlayHUD(); afterMove();
}
function afterMove() {
  if (TP.left(G) === 0) { winSequence(); return; }
  if (TP.stuck(G)) setTimeout(() => { if (mode === 'play' && state === 'play' && G && TP.stuck(G) && !pop) outOfCards(); }, 650);
}
function useWild() {
  if (mode !== 'play' || state !== 'play' || busy || !(st.boosts.wild > 0) || TP.left(G) === 0) return;
  closePop(); pushHist();
  st.boosts.wild--; save();
  const d = { w: 1 }; G.waste.push(d); G.moves++;
  const c = makeCard(d, curP.island); c.place = 'waste'; c.up = true; wasteCards.push(c);
  const b = boostBtn('wild').getBoundingClientRect(), [bx, by] = L.cam(b.left + 30, b.top + 30);
  Object.assign(c.cur, { x: bx, y: by, z: -DEPTH + 1, s: L.bc * L.unit * 0.6, ry: 0, rz: 0.4 }); go(c, 0.45, 1.2);
  snd.wild(); buzz(20);
  setTimeout(() => { const [x, y] = L.cam(L.waste[0], L.waste[1]); FX.burst(new V3(x, y, -DEPTH + 0.8), CONF, 26, { speed: 2, up: 2, size: L.bc * L.unit, life: 0.9 }); }, 380);
  refreshPlayHUD();
}
function usePlus() {
  if (mode !== 'play' || state !== 'play' || busy || !(st.boosts.plus > 0)) return;
  closePop(); pushHist();
  st.boosts.plus--; save();
  const R2 = rng((curP.seed + G.moves * 31) | 0), b = boostBtn('plus').getBoundingClientRect(), [bx, by] = L.cam(b.left + 30, b.top + 30);
  for (let i = 0; i < 5; i++) {
    const d = { r: 1 + Math.floor(R2() * 13), s: Math.floor(R2() * 4) };
    G.stock.unshift(d);     // bottom of the stock: the five come after what's already there
    const c = makeCard(d, curP.island); c.place = 'stock'; c.up = false; stockCards.unshift(c);
    Object.assign(c.cur, { x: bx, y: by, z: -DEPTH + 1, s: L.bc * L.unit * 0.5, ry: PI, rz: 0 });
    setTimeout(() => { go(c, 0.4, 1); snd.deal(i); }, i * 70);
  }
  snd.whoosh(); refreshPlayHUD();
}
function useUndo() {
  if (mode !== 'play' || state !== 'play' || busy || !(st.boosts.undo > 0) || !hist.length) return;
  closePop();
  const h = hist.pop(); st.boosts.undo--; save();
  TP.restore(G, h.snap); stockCards = h.stock; wasteCards = h.waste;
  for (const c of cards) {
    const was = c.place;
    if (stockCards.includes(c)) { c.place = 'stock'; c.up = false; }
    else if (wasteCards.includes(c)) { c.place = 'waste'; c.up = true; }
    else if (c.slot) { c.place = 'tab'; c.up = c.slot.up; }
    else { c.place = 'gone'; c.mesh.visible = false; }
    if (c.slot) setBadge(c, c.slot.gone ? 0 : c.slot.lock);
    go(c, 0.3, was !== c.place ? 0.7 : 0.2);
  }
  snd.whoosh(); refreshPlayHUD();
}
for (const k of ['wild', 'plus', 'undo']) boostBtn(k).addEventListener('click', e => { e.stopPropagation(); snd.unlock(); ({ wild: useWild, plus: usePlus, undo: useUndo })[k](); });
for (const k of ['wild', 'plus', 'undo']) boostBtn(k).addEventListener('pointerdown', e => e.stopPropagation());

function closePop() { pop?.remove(); pop = null; }
function outOfCards() {
  const hasW = st.boosts.wild > 0, hasP = st.boosts.plus > 0;
  if (!hasW && !hasP) { lose(); return; }
  snd.bad();
  pop = $(`<div id="pp-pop" class="pp"><div class="pp-card"><h2>Out of cards!</h2><p>${TP.left(G)} card${TP.left(G) > 1 ? 's' : ''} left on the peaks. Use a booster you earned?</p>
    <div class="row">${hasW ? `<button class="pp-btn pp-blue" data-u="wild">🌟 Wild <small>(${st.boosts.wild})</small></button>` : ''}${hasP ? `<button class="pp-btn pp-green" data-u="plus">+5 cards <small>(${st.boosts.plus})</small></button>` : ''}</div>
    <button class="pp-btn pp-coral quit">Give up</button></div></div>`);
  document.body.appendChild(pop);
  pop.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { snd.tap(); b.dataset.u === 'wild' ? useWild() : usePlus(); });
  pop.querySelector('.quit').onclick = () => { snd.tap(); closePop(); lose(); };
}
function lose() {
  if (recorded) return; recorded = true;
  const cleared = 1 - TP.left(G) / G.slots.length;
  F.level(false, cleared); snd.lose(); state = 'lost'; hideBottom();
  ui.lose('OUT OF CARDS', cleared > 0.8 ? 'So close! Tap to try again' : 'Tap to try again');
}
async function winSequence() {
  if (recorded) return; recorded = true; busy++;
  const p = curP;
  await wait(380);
  snd.win(); combo('PEAKS CLEARED!', 'gold'); buzz([20, 40, 20]);
  for (let i = 0; i < 3; i++) setTimeout(() => { const [x, y] = L.cam(L.tab.x + L.tab.w * (0.2 + 0.3 * i), L.tab.y + L.tab.h * 0.4); FX.burst(new V3(x, y, -DEPTH + 0.6), CONF, 40, { speed: 3, up: 3, size: L.cpx * L.unit, life: 1.4, grav: 4, spread: 0.5 }); }, i * 180);
  await wait(800);
  // leftover stock cards fly off for a bonus
  const n = stockCards.length;
  for (let i = 0; i < n; i++) {
    const c = stockCards.pop(); c.place = 'fly'; c.up = true; go(c, 0.5, 1.4);
    G.score += 250; floatText('+250', L.stock[0], L.stock[1] - L.bc, '#d98a10'); snd.coin(i); refreshPlayHUD(); el.stockN.textContent = stockCards.length;
    await wait(Math.max(70, 260 - i * 20));
  }
  G.stock.length = 0;
  const stars = 1 + (n >= G.slackLeft.two) + (n >= G.slackLeft.three);
  await wait(300);
  const ms = performance.now() - runT0;
  F.level(true); lastStars = stars; st.stars += stars; st.wins++; st.points += G.score;
  const key = dailyMode ? 'daily' : st.level; if (!dailyMode) st.best[key] = Math.max(st.best[key] || 0, stars);
  let reward = '';
  if (!dailyMode) {
    if (st.level % TP.LEVELS_PER_ISLAND === 0) { st.boosts.wild += 2; st.boosts.plus += 1; st.boosts.undo += 1; reward = 'island'; }
    else if (st.level % 3 === 0) { st.boosts.undo += 1; reward = 'undo'; }
    st.level++;
  }
  save(); D.won(stars, 'earned ⭐'); B.submit(stars, { ms });
  winStars.querySelectorAll('i').forEach(i => i.classList.remove('on'));
  hideBottom();
  ui.win(dailyMode ? 'DAILY' : st.level - 1, `Score ${G.score.toLocaleString()}${reward === 'undo' ? ' · +1 ↩️ Undo' : ''}`);
  state = 'won';
  for (let i = 0; i < stars; i++) setTimeout(() => { winStars.children[i].classList.add('on'); snd.star(i); }, 900 + i * 280);
  winSequence.reward = reward;
  busy--;
}

// ---------------------------------------------------------------- journey map
const nodes = [], tags = [];
let mapZ = 0, mapZT = 0, mapDrag = null, focusIsland = 0;
function buildMap() {
  for (let n = 1; n <= TP.JOURNEY; n++) {
    const b = $(`<div class="pp-node">${n}</div>`); b.dataset.n = n;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); b._d = { x: e.clientX, y: e.clientY }; mapDrag = { y: e.clientY, z: mapZT, moved: false }; });
    b.addEventListener('click', e => { e.stopPropagation(); if (mapDrag?.moved) return; if (+b.dataset.n === Math.min(st.level, TP.JOURNEY) && mode === 'map') { snd.tap(); startLevel(); } else { snd.tap(); } });
    nodesEl.appendChild(b); nodes.push({ n, el: b, p: W.nodePos(n) });
  }
  for (let i = 0; i < 12; i++) { const t = $(`<div class="pp-tag"></div>`); nodesEl.appendChild(t); tags.push(t); }
}
function refreshMapHUD() {
  el.starsN.textContent = st.stars;
  const n = st.level, isl = dailyMode ? D.seed % 12 : islandOf(n), p = TP.levelParams(Math.min(n, 999));
  el.isleB.textContent = dailyMode ? 'Daily Challenge' : ISLAND_NAMES[isl];
  const done = Math.min(TP.LEVELS_PER_ISLAND, (n - 1) % TP.LEVELS_PER_ISLAND);
  el.isleS.textContent = dailyMode ? 'Same deal for everyone today' : n > TP.JOURNEY ? `Encore voyage · island ${isl + 1} of 12` : `Island ${isl + 1} of 12 · ${done}/${TP.LEVELS_PER_ISLAND} levels`;
  el.play.className = 'pp-btn pp-green pp-play' + (p.hard && !dailyMode ? ' hard' : '');
  el.play.innerHTML = dailyMode ? 'Play Daily' : `Level ${n}${p.hard ? '<small>HARD LEVEL</small>' : ''}`;
  for (const nd of nodes) {
    const n2 = nd.n, b = st.best[n2] || 0, cur = n2 === Math.min(n, TP.JOURNEY), hard = TP.levelParams(n2).hard;
    const cls = 'pp-node' + (n2 < n ? ' done' : '') + (cur ? ' cur' : '') + (hard ? ' hard' : '');
    if (nd.el.className !== cls) nd.el.className = cls;
    const html = `${n2}${n2 < n ? `<span class="st">${'★'.repeat(b)}<i>${'★'.repeat(3 - b)}</i></span>` : ''}${cur ? '<span class="pp-pin">⛵</span>' : ''}`;
    if (nd.html !== html) { nd.el.innerHTML = html; nd.html = html; }
  }
  refreshBoosts();
}
el.play.onclick = () => { snd.tap(); startLevel(); };
el.home.onclick = () => { snd.tap(); if (mode !== 'play' || busy) return; toMap(); };
el.home.addEventListener('pointerdown', e => e.stopPropagation());
function islandStars(i) { let s = 0; for (let k = 1; k <= TP.LEVELS_PER_ISLAND; k++) s += st.best[i * TP.LEVELS_PER_ISLAND + k] || 0; return s; }
const projV = new V3();
function updateMapDOM() {
  const w = innerWidth, h = innerHeight;
  for (const nd of nodes) {
    projV.copy(nd.p).project(cam); const x = (projV.x + 1) / 2 * w, y = (1 - projV.y) / 2 * h;
    const vis = projV.z < 1 && x > -40 && x < w + 40 && y > 100 && y < h - 150;
    if (vis !== nd.vis) { nd.el.style.display = vis ? '' : 'none'; nd.vis = vis; }
    if (vis) nd.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }
  for (let i = 0; i < 12; i++) {
    const I = W.islands[i], t = tags[i]; projV.copy(W.center(i)); projV.y += I.h * 0.62 + 0.4; projV.project(cam);
    const x = (projV.x + 1) / 2 * w, y = (1 - projV.y) / 2 * h, vis = projV.z < 1 && x > 20 && x < w - 20 && y > 70 && y < h - 150;
    t.style.display = vis ? '' : 'none'; if (!vis) continue;
    t.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    const fog = i > st.seen, done = !dailyMode && st.level > (i + 1) * TP.LEVELS_PER_ISLAND;
    const html = fog ? '☁️ ???' : `${ISLAND_NAMES[i]}${done ? ` <span class="ok">✓ ${islandStars(i)}⭐</span>` : ''}`;
    if (t._h !== html) { t.innerHTML = html; t._h = html; t.className = 'pp-tag' + (fog ? ' fog' : ''); }
  }
}
async function toMap(fromWin = false) {
  closePop();
  mode = 'map'; state = 'ready';
  for (const c of cards) c.mesh.visible = false; shadows.count = 0;
  clearCards(); G = null;
  showMapHUD();
  mapZT = W.nodePos(Math.min(st.level, TP.JOURNEY)).z;
  if (fromWin) {
    const prevN = st.level - 1;
    mapZ = W.nodePos(Math.max(1, prevN)).z; mapZT = mapZ;
    busy++;
    await wait(500);
    if (prevN >= 1) { const nd = nodes[prevN - 1]; if (nd) { const r = nd.el.getBoundingClientRect(); for (let i = 0; i < lastStars; i++) setTimeout(() => snd.star(i), i * 200); WFX.burst(nd.p.clone().setY(0.6), ['#ffd23f', '#fff6c2', '#ffffff'], 24, { speed: 2, up: 3, size: 1.4, life: 1 }); } }
    if (winSequence.reward === 'island') {
      const i = islandOf(prevN);
      banner('ISLAND COMPLETE', ISLAND_NAMES[i], '🎁 +2 Wild · +1 Five cards · +1 Undo', 3000); snd.fanfare();
      const c = W.center(i); for (let k = 0; k < 4; k++) setTimeout(() => WFX.burst(c.clone().add(new V3(0, 2, 0)), CONF, 50, { speed: 4, up: 5, size: 2.2, life: 2, grav: 4, spread: 4 }), k * 200);
      await wait(1600);
    }
    mapZT = W.nodePos(Math.min(st.level, TP.JOURNEY)).z;
    const ni = islandOf(st.level);
    if (!dailyMode && ni > st.seen && st.level <= TP.JOURNEY) {
      st.seen = ni; save(); await W.load(ni);
      await wait(900);
      W.setVisited(ni, true); snd.wild();
      const c = W.center(ni); for (let k = 0; k < 3; k++) setTimeout(() => WFX.burst(c.clone().add(new V3(0, 3, 0)), ['#ffffff', '#e8f4ff', '#fff6c2'], 40, { speed: 4, up: 4, size: 2, life: 1.6, grav: 2, spread: 5 }), k * 220);
      banner('NEW ISLAND', ISLAND_NAMES[ni], 'The clouds part…', 2600);
      await wait(1400);
    }
    busy--;
  }
  refreshMapHUD();
}
let bannerEls = [];
function hideBanner() { document.querySelectorAll('.pp-banner').forEach(b => b.remove()); }

// ---------------------------------------------------------------- camera poses
const camCur = { pos: new V3(0, 30, 30), tgt: new V3(0, 0, 0), fov: 50 };
function mapPose(z, sway = 0) {
  const fov = 50, tanV = Math.tan(fov * PI / 360), aspect = innerWidth / innerHeight;
  const por = aspect < 0.8, dist = por ? Math.max(6.4 / (tanV * aspect), 30) : 23;
  const tgt = new V3(Math.sin(sway) * 0.6, 0, z - (por ? 1.5 : 5)), dir = new V3(0, 0.83, 0.56).normalize();
  return { pos: tgt.clone().addScaledVector(dir, dist), tgt, fov, dist };
}
function titlePose(i) {
  const p = playPose(i, L.por ? { x: 0, y: innerHeight * 0.36, w: innerWidth, h: innerHeight * 0.36 } : { x: innerWidth * 0.15, y: innerHeight * 0.36, w: innerWidth * 0.7, h: innerHeight * 0.5 }, 0.9 + Math.sin(T * 0.3) * 0.08);
  return p;
}
function playPose(i, r = L.isle, yaw = null) {
  const fov = 34, tanV = Math.tan(fov * PI / 360), aspect = innerWidth / innerHeight;
  const fh = r.h / innerHeight, fw = r.w / innerWidth, rad = W.islands[i].radius * 0.95;
  const dist = Math.max(rad / (tanV * fh * 0.95), rad / (tanV * aspect * fw * 0.95));
  const C0 = W.center(i), dir = yaw === null ? new V3(0.12 * (i % 2 ? -1 : 1), 0.4, 1).normalize() : new V3(Math.sin(yaw - 0.9) * 1.0, 0.45, Math.cos(yaw - 0.9)).normalize();
  const pos = C0.clone().addScaledVector(dir, dist);
  const f = dir.clone().negate(), right = new V3().crossVectors(f, new V3(0, 1, 0)).normalize(), up = new V3().crossVectors(right, f);
  const nx = (r.x + r.w / 2) / innerWidth * 2 - 1, ny = 1 - (r.y + r.h / 2) / innerHeight * 2;
  const tgt = C0.clone().addScaledVector(right, -nx * dist * tanV * aspect).addScaledVector(up, -ny * dist * tanV);
  return { pos, tgt, fov, dist };
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  const ms = cards.filter(c => c.mesh.visible && (c.place === 'tab' && !c.slot.gone && TP.isOpen(G, c.slot) || c.place === 'stock' && stockCards[stockCards.length - 1] === c)).map(c => c.mesh);
  const hit = ray.intersectObjects(ms, false)[0];
  if (hit) return hit.object.userData.c;
  // forgiving touch: nearest open card within half a card
  let best = null, bd = 1e9;
  for (const m of ms) { const c = m.userData.c, d = Math.hypot(c.px - e.clientX, c.py - e.clientY), lim = (c.place === 'stock' ? L.bc : L.cpx) * 0.75; if (d < lim && d < bd) { bd = d; best = c; } }
  return best;
}
let hovered = null;
addEventListener('pointerdown', e => {
  if (e.target !== R.domElement) return; snd.unlock();
  if (mode === 'play' && G) { const c = pick(e); if (c) tap(c); }
  else if (mode === 'map') mapDrag = { y: e.clientY, z: mapZT, moved: false };
});
addEventListener('pointermove', e => {
  if (mapDrag && mode === 'map') { const dy = e.clientY - mapDrag.y; if (Math.abs(dy) > 6) mapDrag.moved = true; const span = mapPose(0).dist * 1.1; mapZT = Math.max(W.nodePos(TP.JOURNEY).z - 2, Math.min(W.nodePos(1).z + 4, mapDrag.z - dy / innerHeight * span)); }
  if (mode === 'play' && G && e.pointerType === 'mouse') { const c = pick(e); hovered = c && c.place === 'tab' && TP.playable(G, c.slot) ? c : (c && c.place === 'stock' ? c : null); R.domElement.style.cursor = hovered ? 'pointer' : ''; }
});
addEventListener('pointerup', () => { setTimeout(() => { mapDrag = null; }, 0); });
addEventListener('wheel', e => { if (mode === 'map') mapZT = Math.max(W.nodePos(TP.JOURNEY).z - 2, Math.min(W.nodePos(1).z + 4, mapZT + e.deltaY * 0.02)); }, { passive: true });

ui.onTap(which => {
  snd.unlock();
  if (which === 'start') { mode = 'map'; state = 'ready'; showMapHUD(); snd.music(true); mapZT = W.nodePos(Math.min(st.level, TP.JOURNEY)).z; }
  else if (which === 'win') { const wasDaily = dailyMode; dailyMode = false; toMap(!wasDaily); }
  else if (which === 'lose') startLevel();
});

// ---------------------------------------------------------------- loading
async function boot() {
  let n = 0; const total = 4; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  try { await Promise.race([document.fonts.load('800 60px "Baloo 2"'), wait(2500)]); } catch (e) {}
  tick();
  atlas = buildAtlas(); cardMat = cardMaterial(atlas);
  badgeMat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, toneMapped: false });
  shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.52), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0.5, toneMapped: false }), 120);
  shadows.count0 = 120; shadows.count = 0; shadows.frustumCulled = false; shadows.renderOrder = 1; CG.add(shadows);
  R.initTexture(atlas); tick();
  const cur = dailyMode ? D.seed % 12 : islandOf(Math.min(st.level, TP.JOURNEY));
  st.seen = Math.max(st.seen, cur);
  for (let i = 0; i < 12; i++) W.setVisited(i, i <= st.seen, true);
  await W.load(cur); tick();
  if (cur + 1 < 12) await W.load(cur + 1); tick();
  buildMap(); refreshMapHUD();
  mapZ = mapZT = W.nodePos(Math.min(st.level, TP.JOURNEY)).z; focusIsland = cur;
  const p0 = mapPose(mapZ); camCur.pos.copy(p0.pos); camCur.tgt.copy(p0.tgt);
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  ready = true; mode = 'title'; state = 'ready';
  nodesEl.classList.add('pp-hidden');
  // the rest of the islands stream in behind the title
  (async () => { for (let i = 0; i < 12; i++) { await W.load(i).catch(() => {}); await wait(120); } })();
}

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); }
addEventListener('resize', resize);
let T = 0, perf = {};
R.info.autoReset = false;
loop(d => {
  const dt = Math.min(0.05, d / 60); T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt / w.dur; w.fn(Math.min(1, w.t)); if (w.t >= 1) { tweens.splice(i, 1); w.res(); } }
  if (!ready) { R.info.reset(); C.render(dt); return; }
  L = layout();
  // camera
  let pose;
  if (mode === 'play') { pose = playPose(lastIsland); focusIsland = lastIsland; }
  else if (mode === 'title') { pose = titlePose(focusIsland); }
  else { mapZ += (mapZT - mapZ) * Math.min(1, dt * 5); pose = mapPose(mapZ, 0); focusIsland = Math.max(0, Math.min(11, Math.round(-(mapZ + 2) / 15))); }
  const k = Math.min(1, dt * (mode === 'play' ? 2.6 : 3.2));
  camCur.pos.lerp(pose.pos, k); camCur.tgt.lerp(pose.tgt, k); camCur.fov += (pose.fov - camCur.fov) * k;
  cam.position.copy(camCur.pos); cam.lookAt(camCur.tgt);
  if (Math.abs(cam.fov - camCur.fov) > 0.01) { cam.fov = camCur.fov; cam.updateProjectionMatrix(); }
  const dist = camCur.pos.distanceTo(camCur.tgt);
  scene.fog.near = dist + 6; scene.fog.far = dist + 70;
  // sky follows the island in view
  const sk = ISLAND_SKY[focusIsland]; W.paintSky(sk[0], sk[1]); W.seaMat.color.lerp(new THREE.Color(sk[2]), Math.min(1, dt * 2));
  const fc = mode === 'play' ? W.center(lastIsland) : new V3(0, 0, mapZ - 1);
  sun.target.position.copy(fc); sun.position.copy(fc).add(new V3(-9, 18, 12));
  const ext = mode === 'play' ? 7 : 16; Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  W.update(dt, mode === 'play' ? lastIsland : -1); W.stones.visible = mode !== 'play';
  for (const I of W.islands) I.g.visible = mode !== 'play' || I.i >= lastIsland;
  // cards
  cam.updateMatrixWorld();
  if (mode === 'play' && G) {
    for (const c of cards) c.hover += ((c === hovered ? 1 : 0) - c.hover) * Math.min(1, dt * 12);
    updateCards(dt); placeHUD();
    if (state === 'play' && !busy && !pop) { idleT += dt; if (idleT > 7) { idleT = 2; const s = TP.choose(G); if (s) slotCard[s.id].hint = 1.4; else if (stockCards.length) stockCards[stockCards.length - 1].hint = 1.4; } }
  }
  FX.update(dt); WFX.update(dt);
  if (mode === 'map' || mode === 'title') updateMapDOM();
  for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt / f.d; const t = Math.min(1, f.t), a = 1 - t;
    const x = a * a * f.sx + 2 * a * t * f.cx + t * t * f.tx, y = a * a * f.sy + 2 * a * t * f.cy + t * t * f.ty;
    f.el.style.left = x + 'px'; f.el.style.top = y + 'px'; f.el.style.transform = `translate(-50%,-50%) scale(${1 + Math.sin(t * PI) * 0.5})`;
    if (t >= 1) { f.el.remove(); flying.splice(i, 1); f.done(); } }
  R.info.reset(); C.render(dt); perf = { calls: R.info.render.calls, tris: R.info.render.triangles };
});

// ---------------------------------------------------------------- test hooks
window.__pp = { scene, cam, W, get cardMat() { return cardMat; }, get G() { return G; }, R, C };
window.__game = {
  // the arcade starts every game with no tap: skip the title + map and deal the next level (false while loading)
  autostart() {
    if (!ready) return false;
    if (mode === 'play') return true;
    if (mode === 'title') { ui.hideStart(); mode = 'map'; showMapHUD(); snd.music(true); }
    if (busy) return false;
    startLevel(); return true;
  },
  get state() { return state; }, get level() { return st.level; }, get score() { return st.stars; },
  get stars() { return st.stars; }, get points() { return G ? G.score : 0; }, get perf() { return perf; }, get mode() { return mode; },
  get left() { return G ? TP.left(G) : null; }, get stock() { return G ? G.stock.length : null; }, get boosts() { return { ...st.boosts }; },
  bot() {
    if (!ready || busy) return;
    if (mode === 'title') { ui.hideStart(); mode = 'map'; showMapHUD(); return; }
    if (mode === 'map') { startLevel(); return; }
    if (mode !== 'play' || state !== 'play' || !G) return;
    if (cards.some(c => c.tw)) return;
    if (pop) { if (st.boosts.plus > 0) usePlus(); else if (st.boosts.wild > 0) useWild(); else { closePop(); lose(); } return; }
    const s = TP.choose(G);
    if (s) { playSlot(s); return; }
    if (G.stock.length) { drawStock(); return; }
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.textContent = 'Could not load Peakpatch'; });

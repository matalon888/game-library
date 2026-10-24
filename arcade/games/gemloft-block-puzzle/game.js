// Gemloft: Block Puzzle — original jewel block puzzle in a cozy loft. Drag three offered pieces onto an 8×8 velvet
// board, fill rows and columns to clear them, chain combos. Adventure levels ask for gems, Classic is endless for a best
// score, the Daily puzzle is the same for everyone. Stars restore two lofts; stickers fill an album; coins buy boosters.
// Art: AI-generated 3D library (assets/*.glb, our own) + Hero Lab character (Bijou); board, lofts, UI, sound: code.
import { THREE, createUI, store, loop, buzz, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { loader, piece } from './assets.js';
import { LOFTS, buildLoft } from './loft.js';
import { N, GEMS, emptyGrid, cloneGrid, fits, anyFit, wouldClear, place, bestMove, makeDealer, makeLevel, classicDealerOpts, points } from './blocks.js';
import { createView, PAL, PEARL, FRAME, TRAY_Y, TRAY_H, SLOT_X, TRAY_S, STACK, cellPos } from './view.js';
import { snd } from './audio.js';
import { money } from './kit/money.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Gemloft: Block Puzzle', PI = Math.PI, V3 = THREE.Vector3, Q = new URLSearchParams(location.search);
const S = store('gemloft');
const st = { level: S.get('level', 1), stars: S.get('stars', 0), room: S.get('room', 0), done: S.get('done', {}), best: S.get('best', 0), earned: S.get('earned', 0), wins: S.get('wins', 0),
  stickers: S.get('stickers', []), newSt: S.get('newSt', []), pagesPaid: S.get('pagesPaid', []), dLast: S.get('dLast', 0), dStreak: S.get('dStreak', 0), dFreezeWk: S.get('dFreezeWk', -1), boosts: S.get('boosts', { hint: 2, hammer: 1, swap: 1 }) };
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('gemloft');
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const dayNum = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const weekOf = dn => Math.floor((dn + 3) / 7);

// ---------------------------------------------------------------- money (shared kit: coins, opt-in reward videos, capped breaks, store)
const M = money({ game: 'gemloft', style: 'A' });
M.onChange(() => refreshCoins(true));
const PRICE = { hint: 60, hammer: 90, swap: 60 };

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.26, bloomThreshold: 0.9, bloomRadius: 0.45, exposure: 0.92, envIntensity: 0.6, lite: LITE, grade: { sat: 1.14, contrast: 1.05, vignette: 0.1, grain: 0 } });
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 128; bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
const hemi = new THREE.HemisphereLight('#fff4e6', '#e8c8d8', 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe6c4', 2.4); sun.position.set(-7, 15, 10); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; scene.add(sun, sun.target);
// a key light that travels with the camera so the board always reads (soft, from the upper left)
const key = new THREE.DirectionalLight('#fff1dc', 1.3); key.position.set(-3, 5, 4); cam.add(key); key.target.position.set(0, 0, -6); cam.add(key.target);
const warm = new THREE.PointLight('#ffb36b', 0, 14, 1.4); warm.position.set(-3, 3.6, -1); scene.add(warm);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Gemloft<small>BLOCK PUZZLE</small>', hint: 'Tap to play', hand: '💎', progress: false, score: false });
ui.els.start.classList.add('gl-title');
const D = daily('gemloft', ui, { name: NAME });
const B = worldBoard({ game: 'gemloft', label: 'Stars earned', limits: { maxRun: 3, maxPerSec: 1.5 }, mode: 'sum', corner: 'tr', accent: '#ff8fb1' });
const kitShare = ui.els.win.querySelector('.hc-btn');
ui.els.win.querySelector('h1').textContent = 'BRILLIANT!';
const winStars = $('<div class="gl-winstars"><i>⭐</i><i>⭐</i><i>⭐</i></div>'); ui.els.win.querySelector('h1').after(winStars);
const winReward = $('<div class="gl-reward"></div>'); ui.els.win.querySelector('[data-x]').after(winReward);
const winOffer = $('<button class="gl-btn gl-blue gl-offer"></button>'); winReward.after(winOffer);
const loseOffer = $('<button class="gl-btn gl-green gl-offer"></button>'); ui.els.lose.querySelector('[data-x]').after(loseOffer);
for (const b of [winOffer, loseOffer]) b.addEventListener('pointerdown', e => e.stopPropagation());
const loadEl = document.getElementById('gl-load'), loadBar = loadEl.querySelector('b');

const hud = $(`<div class="gl">
  <div id="gl-home-top" class="gl-hidden"><div class="gl-pill star"><i>⭐</i><span>0</span></div><div class="gl-pill coin" data-shop><i class="gc"></i><span>0</span><div class="plus">+</div></div>
    <div class="gl-roomname"><b></b><div class="gl-prog"><i></i></div></div></div>
  <div id="gl-side" class="gl-hidden"><button class="gl-btn gl-round" data-mute aria-label="Sound">🔊</button><button class="gl-btn gl-round" data-album aria-label="Sticker album">📖<b class="gl-hidden">new</b></button><button class="gl-btn gl-round" data-shop aria-label="Shop">🛍️</button></div>
  <div id="gl-home-bot" class="gl-hidden"><div class="gl-tasks"></div>
    <div class="gl-modes"><button class="gl-btn gl-purple" data-classic>Classic<small>endless · best 0</small></button><button class="gl-btn gl-pink" data-daily>Daily<small>new puzzle</small></button></div>
    <button class="gl-btn gl-green gl-play"></button></div>
  <div id="gl-phud" class="gl-hidden"><button class="gl-btn gl-round" data-home aria-label="Back to the loft">🏠</button><div class="gl-panel"></div><div style="width:50px;flex:none"></div></div>
  <div class="gl-sub gl-hidden"><span></span></div>
  <div id="gl-boost" class="gl-hidden"><button class="gl-btn gl-blue" data-b="hint" aria-label="Hint">💡<b></b></button><button class="gl-btn gl-pink" data-b="hammer" aria-label="Hammer">🔨<b></b></button><button class="gl-btn gl-purple" data-b="swap" aria-label="New pieces">🔄<b></b></button><button class="gl-btn gl-round" data-mute aria-label="Sound">🔊</button></div>
</div>`);
document.body.appendChild(hud);
const q1 = s => hud.querySelector(s), qa = s => hud.querySelectorAll(s);
const el = { homeTop: q1('#gl-home-top'), side: q1('#gl-side'), homeBot: q1('#gl-home-bot'), starN: q1('.gl-pill.star span'), starPill: q1('.gl-pill.star'), coinN: q1('.gl-pill.coin span'), coinPill: q1('.gl-pill.coin'),
  roomName: q1('.gl-roomname b'), prog: q1('.gl-prog i'), tasks: q1('.gl-tasks'), play: q1('.gl-play'), classic: q1('[data-classic]'), daily: q1('[data-daily]'), albumBadge: q1('[data-album] b'),
  phud: q1('#gl-phud'), panel: q1('.gl-panel'), sub: q1('.gl-sub'), subT: q1('.gl-sub span'), boost: q1('#gl-boost') };
qa('[data-mute]').forEach(b => { b.textContent = snd.muted ? '🔇' : '🔊'; b.onclick = () => { const m = snd.toggle(); qa('[data-mute]').forEach(x => x.textContent = m ? '🔇' : '🔊'); }; });
qa('[data-shop]').forEach(b => b.onclick = () => { snd.tap(); M && M.shop(); });
q1('[data-album]').onclick = () => { snd.tap(); openAlbum(); };
q1('[data-home]').onclick = () => { snd.tap(); if (busy || state !== 'play') return; quitToHome(); };
el.play.onclick = () => { snd.tap(); startGame('adv'); };
el.classic.onclick = () => { snd.tap(); startGame('classic'); };
el.daily.onclick = () => { snd.tap(); if (st.dLast === dayNum()) { openShare(); return; } startGame('daily'); };
qa('[data-b]').forEach(b => b.onclick = () => useBooster(b.dataset.b));

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', game = null, host = null, rooms = {}, curRoom = null, roomBusy = false, busy = false, view = null, GEMP = null, recorded = false, lastWin = null, hammerOn = false;
const ICON = {};
const GEM_IDS = ['m01', 'm02', 'm03', 'm04', 'm06'];
const roomOf = () => LOFTS[Math.min(st.room, LOFTS.length - 1)];
const doneList = (def = roomOf()) => st.done[def.id] || [];
const nextTasks = (def = roomOf()) => def.tasks.filter(t => !doneList(def).includes(t.id));
const roomProgress = (def = roomOf()) => doneList(def).length / def.tasks.length;

// ---------------------------------------------------------------- tweens
const tweens = [];
const anim = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));

// ---------------------------------------------------------------- background
let bgKey = '';
function mixHex(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }
function paintBg(p) {
  const top = mixHex('#e2cfc2', '#f6cdb8', p), bot = mixHex('#efe2d4', '#ffe9d4', p), key = top + bot; if (key === bgKey) return; bgKey = key;
  const x = bgCanvas.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  const r = rng(11); for (let i = 0; i < 16; i++) { const cx = r() * 128, cy = r() * 256, rad = 6 + r() * 22, rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); rg.addColorStop(0, `rgba(255,255,255,${0.15 + r() * 0.2})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  bgTex.needsUpdate = true;
}

// ---------------------------------------------------------------- board group (rides with the camera)
const BD = 6;
const boardG = new THREE.Group(); cam.add(boardG); boardG.visible = false;
let LAY = { s: 40, por: true };
function layoutBoard() {
  const por = innerWidth / innerHeight < 0.8;
  const vh = 2 * BD * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const topR = el.phud.classList.contains('gl-hidden') ? 80 : el.phud.getBoundingClientRect().bottom;
  const ttl = mode === 'title', top = ttl ? innerHeight * (por ? 0.27 : 0.3) : (topR || 80) + (por ? 34 : 30), bot = ttl ? innerHeight * 0.25 : (por ? 86 : 84);
  const availH = innerHeight - top - bot, availW = innerWidth * (por ? 0.96 : 0.9);
  const stackH = STACK.top - STACK.bot, stackW = FRAME * 2 + 0.7;
  const s = Math.min(availW / stackW, availH / stackH);   // px per unit
  const stackPx = stackH * s, cy = (por ? top + availH - stackPx / 2 : top + availH / 2) , k = vh / innerHeight;
  boardG.scale.setScalar(s * k);
  boardG.position.set(0, (0.5 - cy / innerHeight) * vh - (STACK.top + STACK.bot) / 2 * s * k, -BD);
  boardG.rotation.x = -0.08;
  LAY = { s, por, top, cy };
  el.sub.style.top = (top - 27) + 'px';
}

// ---------------------------------------------------------------- host (Hero Lab: Bijou)
async function loadHost() {
  const gl = await loader.loadAsync('./assets/host.glb');
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true), hgt = box.max.y - box.min.y;
  const inner = new THREE.Group(); inner.add(root); root.position.y = -box.min.y;
  const g = new THREE.Group(); g.add(inner);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
  let cur = null;
  const play = (n, once = false) => { const a = acts[n]; if (!a) return; if (a === cur && !once) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play(); if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
    if (once) { clearTimeout(play.t); play.t = setTimeout(() => play('idle'), (a.getClip().duration * 1000) / a.timeScale + 100); } };
  play('idle');
  return { g, h: hgt, mixer, play };
}
function hostPlayPose() {
  if (!host) return;
  const d = BD + 1.2, vh = 2 * d * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect, k = vh / innerHeight;
  if (LAY.por) {   // peeking over the top-right of the board
    const boardTopPx = LAY.cy - (STACK.top - (STACK.top + STACK.bot) / 2) * LAY.s, hPx = Math.min(190, LAY.s * 4.2);
    host.g.scale.setScalar(hPx * k / host.h);
    const xPx = innerWidth * 0.5 + LAY.s * 3.2;
    host.g.position.set((xPx / innerWidth - 0.5) * vw, (0.5 - (boardTopPx + hPx * 0.42) / innerHeight) * vh, -d);
    host.g.rotation.set(0.05, -0.35, 0);
  } else {         // standing to the left of the board
    const hPx = innerHeight * 0.62; host.g.scale.setScalar(hPx * k / host.h);
    const xPx = innerWidth * 0.5 - LAY.s * (FRAME + 0.6) - hPx * 0.24;
    host.g.position.set((xPx / innerWidth - 0.5) * vw, (0.5 - (innerHeight - 40) / innerHeight) * vh, -d);
    host.g.rotation.set(0.04, 0.45, 0);
  }
}
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 2600) { if (!host) return; bubbleEl?.remove(); bubbleEl = $(`<div class="gl-bubble">${text}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000; }
const headPos = new V3();
function placeBubble() {
  if (!bubbleEl) return;
  host.g.getWorldPosition(headPos); const sc = new V3(); host.g.getWorldScale(sc); headPos.y += host.h * sc.y * 1.02;
  headPos.project(cam); const x = (headPos.x + 1) / 2 * innerWidth, y = (1 - headPos.y) / 2 * innerHeight;
  bubbleEl.style.left = Math.max(105, Math.min(innerWidth - 105, x)) + 'px'; bubbleEl.style.top = Math.max(mode === 'play' ? 150 : 120, y) + 'px';
}

// ---------------------------------------------------------------- lofts
async function ensureRoom(i) {
  if (!rooms[i]) rooms[i] = buildLoft(LOFTS[i]).then(Rm => { Rm.group.visible = false; scene.add(Rm.group); for (const id of (st.done[LOFTS[i].id] || [])) applyTask(Rm, LOFTS[i].tasks.find(t => t.id === id)); return Rm; });
  return rooms[i];
}
async function enterRoom(i, first = false) {
  const Rm = await ensureRoom(i);
  if (curRoom) curRoom.group.visible = false;
  curRoom = Rm; Rm.group.visible = true;
  if (!first) camCur.pos.add(new V3(6, 8, 8));
  placeHostInRoom(); refreshHome(); atm.target = roomProgress(); if (first) atm.cur = atm.target;
}
function placeHostInRoom() {
  if (!host || !curRoom) return;
  const h = roomOf().host; curRoom.group.add(host.g); host.g.position.set(h[0], h[1], h[2]); host.g.rotation.set(0, 0.5 + h[3], 0); host.g.scale.setScalar(2.75 / host.h);
}
function applyTask(Rm, t) {
  if (!t) return;
  if (t.item) { const m = Rm.items[t.id]; m.visible = true; m.scale.copy(m.userData.base); m.position.y = t.at[1]; }
  else Rm.apply[t.kind]?.(true);
}
function taskPos(Rm, t) {
  const d = Rm.def;
  if (t.item) return new V3(t.at[0], t.at[1] + (t.hang ? -0.2 : t.size * (t.sy ? 0.12 : 0.7)) + 0.2, t.at[2]);
  if (t.kind === 'walls') return new V3(-d.W / 2 + 0.4, d.H * 0.6, 0);
  if (t.kind === 'floor') return new V3(1.2, 0.05, 1.6);
  if (t.kind === 'window') return new V3(d.win.x, d.win.y - 0.3, -d.D / 2 + 0.6);
  if (t.kind === 'lights') return new V3(0, d.H - 0.8, -1);
  if (t.kind === 'clutter') return new V3(d.clutter[0][0], 1.6, d.clutter[0][2]);
  return new V3();
}
const WP = (() => {   // world-space sparkle bursts for the loft makeover
  const N2 = 400, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N2);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N2 * 3), 3); m.count = 0; m.frustumCulled = false; scene.add(m);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N2; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
        list.push({ p: new V3(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.5, pos.z + (Math.random() - 0.5) * spread), v: new V3(Math.cos(a) * Math.sin(b) * sp, up * (0.5 + Math.random()), Math.sin(a) * Math.sin(b) * sp), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 6; const f = p.life / p.max;
        e.set(p.r, p.r * 0.6, 0); q.setFromEuler(e); s.setScalar(p.size * (0.3 + f * 0.9)); tmp.compose(p.p, q, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r * (0.7 + f), p.c.g * (0.7 + f), p.c.b * (0.7 + f)); i++; }
      m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    },
  };
})();
const CONF = ['#ff5d8f', '#ffd23f', '#3fcf6e', '#3aa8ff', '#b05cff', '#ffffff', '#ff8a2a'];
const marker = new THREE.Group();
{ const gm = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ff9d00', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 20), gm); cone.rotation.x = PI; cone.position.y = 0.6; marker.add(cone);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), gm); ball.position.y = 1.05; marker.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.8, toneMapped: false })); ring.rotation.x = PI / 2; ring.name = 'ring'; marker.add(ring);
  marker.visible = false; scene.add(marker); }
let focus = null, focusT = 0;
async function animateTask(Rm, t) {
  const pos = taskPos(Rm, t);
  if (t.item) {
    const m = Rm.items[t.id], base = m.userData.base.clone(), y0 = t.at[1]; m.visible = true; snd.whoosh();
    await anim(0.75, k => { const e = easeBack(Math.min(1, k * 1.1)); m.scale.copy(base).multiplyScalar(Math.max(0.01, e)); m.position.y = y0 + (1 - Math.min(1, k * 1.4)) * 2.2; m.rotation.y = (t.rot || 0) + (1 - k) * 1.2; });
    m.scale.copy(base); m.position.y = y0; m.rotation.y = t.rot || 0;
    snd.placeDecor(); WP.burst(new V3(t.at[0], y0 + 0.3, t.at[2]), ['#fff6c2', '#ffffff', '#ffd23f'], 26, { speed: 3.5, up: 2.5, size: 1.3, life: 0.9, spread: t.size * 0.6 });
  } else if (t.kind === 'clutter') {
    snd.whoosh();
    for (const c of Rm.clutter.children.slice()) { const s0 = c.scale.clone(), wp = new V3(); c.getWorldPosition(wp); anim(0.35, k => c.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - k))).then(() => c.scale.copy(s0)); WP.burst(wp.add(new V3(0, 0.5, 0)), ['#d8c3a5', '#ffffff', '#b89a72'], 14, { speed: 2.5, up: 2, size: 1.4, life: 0.7 }); snd.place(1); await wait(100); }
    await wait(300); Rm.apply.clutter(true);
  } else {
    snd.sparkle(); const d = Rm.def;
    for (let i = 0; i < 6; i++) { const p = t.kind === 'walls' ? new V3(-d.W / 2 + 0.3, d.H * (0.2 + i * 0.13), -d.D / 2 + (i + 0.5) * d.D / 6) : t.kind === 'lights' ? new V3(-d.W / 2 + (i + 0.5) * d.W / 6, d.H - 0.8, -d.D / 2 + 0.6) : t.kind === 'window' ? new V3(d.win.x + (i - 2.5) * 0.6, d.win.y, -d.D / 2 + 0.4) : new V3(-d.W / 2 + (i + 0.5) * d.W / 6, 0.2, (Math.random() - 0.5) * d.D * 0.8);
      WP.burst(p, ['#fff6c2', '#ffffff', '#ffc2dc'], 12, { speed: 2, up: 1.5, size: 1.2, life: 0.8, spread: 1.4 }); await wait(70); }
    Rm.apply[t.kind](true); snd.placeDecor();
  }
}
async function buyTask(t) {
  if (roomBusy || mode !== 'home') return;
  if (st.stars < t.cost) { say('Play a level to earn ⭐ stars!'); snd.bad(); return; }
  roomBusy = true; st.stars -= t.cost; const def = roomOf();
  st.done[def.id] = [...doneList(def), t.id]; save(); refreshHome(); buzz(15);
  focus = taskPos(curRoom, t); marker.visible = false;
  await anim(0.45, k => { focusT = easeIO(k); });
  await animateTask(curRoom, t);
  atm.target = roomProgress();
  host?.play('cheer', true); say(['Gorgeous!', 'Oh, I love it!', 'So cozy!', 'Perfect spot!', 'It sparkles!', 'Dreamy!'][(Math.random() * 6) | 0]);
  await wait(500);
  await anim(0.6, k => { focusT = 1 - easeIO(k); }); focus = null;
  if (!nextTasks(def).length) await roomComplete(def);
  roomBusy = false; refreshHome();
}
async function roomComplete(def) {
  snd.win(); host?.play('cheer', true);
  for (let i = 0; i < 4; i++) { WP.burst(new V3((Math.random() - 0.5) * def.W, def.H + 1, (Math.random() - 0.5) * def.D), CONF, 40, { speed: 3, up: 1, size: 1.6, life: 2, grav: 3, spread: 2 }); await wait(160); }
  for (const k of ['hint', 'hammer', 'swap']) st.boosts[k] = (st.boosts[k] || 0) + 2;
  M && M.add(300, 'loft-complete'); save(); say(`${def.name} done! +2 of each booster 🎁`, 3600);
  ui.pop(`${def.name.toUpperCase()} RESTORED!`, '#fff', 32, 26);
}
async function goNextRoom() {
  if (roomBusy || st.room >= LOFTS.length - 1) return;
  roomBusy = true; st.room++; save(); await enterRoom(st.room); bgKey = '';
  say('A brand new corner to love!', 3000); roomBusy = false;
}

// ---------------------------------------------------------------- home HUD
function refreshCoins(bump) {
  if (!M) return; el.coinN.textContent = M.coins().toLocaleString();
  if (bump) { el.coinPill.classList.remove('bump'); void el.coinPill.offsetWidth; el.coinPill.classList.add('bump'); }
  refreshBoosters();
}
function taskIcon(t) { return t.item ? `<img src="./assets/thumbs/${t.item}.webp" alt="">` : t.icon; }
function dailyInfo() {
  const today = dayNum(), done = st.dLast === today, alive = st.dLast >= today - 1 || (st.dLast === today - 2 && st.dFreezeWk !== weekOf(today));
  const streak = alive ? st.dStreak : 0, freeze = st.dFreezeWk !== weekOf(today);
  return { done, streak, freeze };
}
function refreshHome() {
  const def = roomOf(), list = nextTasks(def), p = roomProgress(def);
  el.roomName.textContent = `${def.name} · ${Math.round(p * 100)}%`; el.prog.style.width = p * 100 + '%';
  el.starN.textContent = st.stars; refreshCoins();
  if (!list.length) {
    const more = st.room < LOFTS.length - 1;
    el.tasks.innerHTML = `<h3><span>${more ? 'Loft restored!' : 'Every loft restored!'}</span><span>🏡</span></h3><div class="gl-task"><div class="ic">${more ? '🗝️' : '💎'}</div><div class="nm">${more ? 'Next: ' + LOFTS[st.room + 1].name : 'More lofts are on the way'}<small>${more ? 'A dusty corner is waiting' : 'Stars now turn into coins'}</small></div>${more ? '<button class="gl-btn gl-pink" data-next>Go ➜</button>' : ''}</div>`;
    const nb = el.tasks.querySelector('[data-next]'); if (nb) nb.onclick = () => { snd.tap(); goNextRoom(); };
  } else {
    const t = list[0], can = st.stars >= t.cost;
    el.tasks.innerHTML = `<h3><span>Loft makeover</span><span>${doneList(def).length}/${def.tasks.length}</span></h3><div class="gl-task"><div class="ic">${taskIcon(t)}</div><div class="nm">${t.name}<small>${can ? 'Tap to place it!' : `Earn ${t.cost - st.stars} more ⭐ in levels`}</small></div><button class="gl-btn ${can ? 'gl-pink' : 'gl-grey'}" data-t>⭐ ${t.cost}</button></div>`;
    el.tasks.querySelector('[data-t]').onclick = () => { snd.tap(); buyTask(t); };
  }
  const hard = st.level > 5 && st.level % 6 === 0;
  el.play.className = 'gl-btn gl-green gl-play' + (hard ? ' hard' : '');
  el.play.innerHTML = `Level ${st.level}${hard ? '<small>HARD LEVEL · short</small>' : ''}`;
  el.classic.innerHTML = `Classic<small>endless · best ${st.best.toLocaleString()}</small>`;
  const di = dailyInfo();
  el.daily.innerHTML = di.done ? `Daily ✓<small>🔥 ${di.streak} · share</small>` : `Daily${di.streak ? ' 🔥' + di.streak : ''}<small>${di.freeze ? '❄️ freeze ready' : 'new puzzle'}</small>`;
  el.albumBadge.classList.toggle('gl-hidden', !st.newSt.length);
  const nt = list[0]; marker.visible = !!nt && mode === 'home' && st.stars >= nt.cost;
  if (nt && curRoom) marker.position.copy(taskPos(curRoom, nt));
}
function showHome() {
  if (mode === 'title') game = null;
  mode = 'home'; state = 'ready'; boardG.visible = false; hammerOn = false;
  for (const e of [el.phud, el.sub, el.boost]) e.classList.add('gl-hidden');
  for (const e of [el.homeTop, el.side, el.homeBot]) e.classList.remove('gl-hidden');
  placeHostInRoom(); host?.play('idle'); refreshHome();
}

// ---------------------------------------------------------------- stickers (album of 30)
const PAGES = [
  { name: 'Fresh picks', ids: ['t01', 't02', 't03', 't04', 't05', 't06', 't07', 't22', 't23', 't20'] },
  { name: 'Beauty bag', ids: ['t11', 't12', 't13', 't14', 't15', 't25', 't26', 't24', 't27', 't28'] },
  { name: 'Little joys', ids: ['t08', 't09', 't10', 't16', 't17', 't18', 't19', 't21', 't29', 't30'] },
];
const ALL_ST = PAGES.flatMap(p => p.ids);
function dropSticker(r = Math.random) {
  const left = ALL_ST.filter(id => !st.stickers.includes(id)); if (!left.length) return null;
  const id = left[(r() * left.length) | 0]; st.stickers.push(id); st.newSt.push(id);
  let bonus = 0;
  PAGES.forEach((p, i) => { if (!st.pagesPaid.includes(i) && p.ids.every(x => st.stickers.includes(x))) { st.pagesPaid.push(i); bonus += 300; } });
  if (bonus && M) M.add(bonus, 'album-page');
  save(); return { id, bonus };
}
let albumPage = 0;
function openAlbum() {
  const v = $(`<div class="gl-veil gl"><div class="gl-card"><button class="gl-btn x">✕</button><h2>Sticker album</h2><div style="font-size:13px;opacity:.65;font-weight:700">${st.stickers.length}/30 · a sticker for every win · full page = 300 <i class="gc"></i></div><div class="gl-tabs"></div><div class="gl-stickers"></div><div class="gl-pagebar"></div></div></div>`);
  document.body.appendChild(v);
  const draw = () => {
    v.querySelector('.gl-tabs').innerHTML = PAGES.map((p, i) => `<button class="gl-btn ${i === albumPage ? 'on' : ''}" data-p="${i}">${p.name}</button>`).join('');
    v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { albumPage = +b.dataset.p; draw(); });
    const pg = PAGES[albumPage], have = pg.ids.filter(x => st.stickers.includes(x)).length;
    v.querySelector('.gl-stickers').innerHTML = pg.ids.map(id => `<div class="gl-st ${st.stickers.includes(id) ? '' : 'off'} ${st.newSt.includes(id) ? 'new' : ''}"><img src="./assets/thumbs/${id}.webp" alt=""></div>`).join('');
    v.querySelector('.gl-pagebar').textContent = have === 10 ? '✨ Page complete!' : `${have}/10 on this page`;
  };
  albumPage = st.newSt.length ? PAGES.findIndex(p => p.ids.includes(st.newSt[st.newSt.length - 1])) : albumPage; draw();
  const close = () => { v.remove(); st.newSt = []; save(); refreshHome(); };
  v.querySelector('.x').onclick = close; v.addEventListener('pointerdown', e => { if (e.target === v) close(); });
}

// ---------------------------------------------------------------- daily share grid (spoiler-free)
function shareText() {
  const g = (st.dGrid || S.get('dGrid', '')), rows = [];
  for (let i = 0; i < g.length; i += 8) rows.push(g.slice(i, i + 8).join(''));
  const d = new Date();
  return `Gemloft Daily ${d.getMonth() + 1}/${d.getDate()} 💎\n🔥 ${dailyInfo().streak}-day streak\n${rows.join('\n')}`;
}
function openShare() {
  const txt = shareText(), u = new URL(location.href); u.search = '?daily=1';
  const v = $(`<div class="gl-veil gl"><div class="gl-card"><button class="gl-btn x">✕</button><h2>Daily solved!</h2><div style="font-size:14px;font-weight:700;opacity:.7">Come back tomorrow for a new one${dailyInfo().freeze ? ' · ❄️ 1 streak freeze this week' : ''}</div><div class="gl-share"></div><button class="gl-btn gl-green" style="font-size:22px;padding:8px 30px">Share</button></div></div>`);
  v.querySelector('.gl-share').textContent = txt;
  document.body.appendChild(v);
  const close = () => v.remove();
  v.querySelector('.x').onclick = close; v.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === v) close(); });
  v.querySelector('.gl-green').onclick = async () => {
    const text = txt + '\n' + u.href;
    try { if (navigator.share) { await navigator.share({ title: NAME, text }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text); ui.pop('Copied!', '#fff', 28, 30); } catch (e) {}
  };
}

// ---------------------------------------------------------------- the puzzle
const colTmp = new THREE.Color(), WHITE = new THREE.Color('#ffffff'), PALC = PAL.map(c => new THREE.Color(c)), PEARLC = new THREE.Color(PEARL);
function newGame(kind) {
  const seed = kind === 'daily' ? (D.seed || ymd()) * 7 + 3 : kind === 'adv' ? st.level * 7919 + 13 : (Date.now() % 1e9);
  const r = rng(seed);
  const g = { kind, r, grid: emptyGrid(), vfx: Array.from({ length: N }, () => Array(N).fill(null)), dying: [], tray: [null, null, null], slots: [], score: 0, combo: 0, since: 9, placed: 0, gemsLeft: {}, goals: [], par: 0, level: null, revived: false, t0: performance.now(), log: [], drag: null };
  if (kind === 'adv' || kind === 'daily') {
    const L = makeLevel(kind === 'daily' ? 14 : st.level, kind === 'daily' ? 1 : F.k(), r, { daily: kind === 'daily' });
    g.level = L; g.grid = L.grid; g.goals = L.goals.map(q => ({ ...q, left: q.n })); g.par = L.par; g.dealer = makeDealer(r, L.dealer);
  } else g.dealer = null;
  g.slots = [0, 1, 2].map(i => ({ x: SLOT_X[i], y: TRAY_Y, s: TRAY_S, z: 0, tx: SLOT_X[i], ty: TRAY_Y, ts: TRAY_S, tz: 0, in: 0 }));
  return g;
}
function gemNeed() {
  if (!game.goals.length) return [];
  const have = {}; for (const row of game.grid) for (const c of row) if (c && c.gem >= 0) have[c.gem] = (have[c.gem] || 0) + 1;
  for (const p of game.tray) if (p && p.gem >= 0) have[p.gemType] = (have[p.gemType] || 0) + 1;
  return game.goals.filter(q => q.left > (have[q.type] || 0)).map(q => q.type);
}
function deal() {
  const d = game.dealer || makeDealer(game.r, classicDealerOpts(game.score, F.k(game.score)));
  game.tray = d.deal(game.grid, gemNeed());
  game.slots.forEach((s, i) => { s.x = SLOT_X[i] + 9; s.tx = SLOT_X[i]; s.y = s.ty = TRAY_Y; s.s = s.ts = TRAY_S; s.z = s.tz = 0; s.in = i * 0.06; });
  snd.whoosh();
}
function startGame(kind) {
  if (roomBusy || !view) return;
  game = newGame(kind); recorded = false; busy = false; hammerOn = false;
  mode = 'play'; state = 'play'; marker.visible = false;
  for (const e of [el.homeTop, el.side, el.homeBot]) e.classList.add('gl-hidden');
  for (const e of [el.phud, el.sub, el.boost]) e.classList.remove('gl-hidden');
  buildPanel(); layoutBoard(); boardG.visible = true; deal();
  if (host) { cam.add(host.g); hostPlayPose(); host.play('idle'); }
  if (kind === 'classic') B.start();
  snd.music(true);
  if (kind === 'adv' && st.level === 1) setTimeout(() => say('Drag a piece onto the board! Fill a row to collect the gems 💎', 3600), 700);
  else if (kind === 'adv' && st.level === 2) setTimeout(() => say('Clear rows AND columns. Back-to-back clears = combo!', 3400), 700);
  else if (kind === 'daily') setTimeout(() => say('Today\'s puzzle: same one for everyone!', 3000), 700);
  else if (game.level?.hard) setTimeout(() => say('A hard one, but short. You\'ve got this!', 3000), 700);
}
function buildPanel() {
  const g = game;
  if (g.kind === 'classic') el.panel.innerHTML = `<span class="lv">CLASSIC</span><div class="sc"><small>SCORE</small><b data-score>0</b></div><div class="sc"><small>BEST</small><b style="font-size:24px">${st.best.toLocaleString()}</b></div>`;
  else el.panel.innerHTML = `<span class="lv ${g.level.hard ? 'hard' : ''}">${g.kind === 'daily' ? 'DAILY PUZZLE' : 'LEVEL ' + g.level.n}${g.level.hard ? ' · HARD' : ''}</span>` + g.goals.map((q, i) => `<div class="g" data-g="${i}"><img src="${ICON['g' + q.type]}" alt=""><b>${q.left}</b></div>`).join('');
  refreshSub(); refreshBoosters();
}
function refreshSub() {
  const g = game; if (!g) return;
  if (g.kind === 'classic') el.subT.textContent = g.combo > 1 ? `Combo ×${g.combo} 🔥` : 'Clear lines back-to-back for combos';
  else { const stars = g.placed <= g.par ? 3 : g.placed <= Math.ceil(g.par * 1.4) ? 2 : 1; el.subT.textContent = `Pieces ${g.placed} · ${'⭐'.repeat(stars)}${stars > 1 ? ` until ${stars === 3 ? g.par : Math.ceil(g.par * 1.4)}` : ''}`; }
}
function refreshBoosters() {
  if (!M) return;
  qa('[data-b]').forEach(b => {
    const k = b.dataset.b, n = st.boosts[k] || 0, lbl = b.querySelector('b');
    lbl.innerHTML = n ? `×${n}` : M.coins() >= PRICE[k] ? `<i class="gc"></i>${PRICE[k]}` : k === 'hint' ? '▶ free' : `<i class="gc"></i>${PRICE[k]}`;
    b.classList.toggle('on', k === 'hammer' && hammerOn);
  });
}
async function useBooster(k) {
  if (mode !== 'play' || state !== 'play' || busy || game.drag) return;
  snd.tap();
  if (k === 'hammer' && hammerOn) { hammerOn = false; refreshBoosters(); return; }
  if (k === 'hammer' && !game.grid.some(r => r.some(Boolean))) { say('Nothing to smash yet!'); return; }
  let paid = false;
  if ((st.boosts[k] || 0) > 0) { st.boosts[k]--; save(); paid = true; }
  else if (M.coins() >= PRICE[k]) paid = M.spend(PRICE[k], 'booster:' + k);
  else if (k === 'hint') { busy = true; paid = await M.rewarded('hint', { what: 'the best spot for a piece, highlighted' }); busy = false; }
  else { say(`That one costs <i class="gc"></i>${PRICE[k]}`, 1800); M.shop(); return; }
  if (!paid) return;
  refreshBoosters();
  if (k === 'hint') showHint();
  else if (k === 'swap') { deal(); say('Fresh pieces!', 1500); if (checkStuck()) return; }
  else if (k === 'hammer') { hammerOn = true; refreshBoosters(); say('Tap a block to smash it', 2200); }
}
let hintT = 0, hintMove = null;
function showHint() {
  const m = bestMove(game.grid, game.tray, { gemWant: Object.fromEntries(game.goals.map(q => [q.type, q.left])) });
  if (!m) return; hintMove = m; hintT = 2.6; snd.sparkle();
}
function smash(gx, gy) {
  const c = game.grid[gy][gx]; if (!c) return false;
  game.grid[gy][gx] = null; hammerOn = false; refreshBoosters();
  const [x, y] = cellPos(gx, gy); view.P.burst(x, y, 0.4, [PAL[c.c], '#ffffff', '#ffe6a0'], 26, { speed: 6, up: 3, size: 1.3 });
  snd.smash(); buzz(30); shake = 0.5;
  if (c.gem >= 0) collectGem(c.gem, x, y);
  return true;
}
function collectGem(type, x, y) {
  const i = game.goals.findIndex(q => q.type === type && q.left > 0); if (i < 0) return;
  game.goals[i].left--;
  const slot = el.panel.querySelector(`[data-g="${i}"]`); if (!slot) return;
  const v = new V3(x, y, 0.6); boardG.localToWorld(v); v.project(cam); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
  const r = slot.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + 20;
  const img = document.createElement('img'); img.className = 'gl-fly'; img.src = ICON['g' + type]; document.body.appendChild(img);
  flying.push({ img, sx, sy, tx, ty, t: 0, d: 0.55 + Math.random() * 0.15, cx: sx + (Math.random() - 0.5) * 160, cy: Math.min(sy, ty) - 40, upd: () => {
    const g = game.goals[i]; if (!g) return; const b = slot.querySelector('b'); b.textContent = g.left <= 0 ? '✓' : g.left; slot.classList.toggle('done', g.left <= 0); slot.classList.remove('bump'); void slot.offsetWidth; slot.classList.add('bump'); snd.gem(i); } });
}
const flying = [];
let shake = 0;
const PRAISE = ['', 'Nice!', 'Great!', 'Excellent!', 'Amazing!', 'Unbelievable!'];
function doPlace(i, gx, gy) {
  const g = game, p = g.tray[i]; if (!p || !fits(g.grid, p.shape, gx, gy)) return false;
  const res = place(g.grid, p, gx, gy); g.tray[i] = null; g.placed++;
  const now = T;
  p.shape.cells.forEach(([x, y]) => { g.vfx[gy + y][gx + x] = { t: now }; });
  // combo: clears within 3 placements of the last clear keep the streak alive
  if (res.lines) { g.combo = g.since <= 3 && g.combo > 0 ? g.combo + 1 : 1; g.since = 0; } else { g.since++; if (g.since >= 3) g.combo = 0; }
  const pts = points(p.shape.n, res.lines, g.combo, res.empty); g.score += pts;
  g.log.push(res.lines ? (res.cleared.some(c => c.gem >= 0) ? '💎' : res.lines > 1 ? '🟨' : '🟪') : '⬜');
  snd.place(p.shape.n); buzz(8);
  // the cleared cells shimmer out as a wave from the piece
  const pcx = gx + p.shape.w / 2 - 0.5, pcy = gy + p.shape.h / 2 - 0.5;
  for (const c of res.cleared) {
    const dist = Math.hypot(c.x - pcx, c.y - pcy);
    g.dying.push({ x: c.x, y: c.y, c: c.c, gem: c.gem, t: -dist * 0.035, fx: false });
    if (c.gem >= 0) { const [x, y] = cellPos(c.x, c.y); setTimeout(() => collectGem(c.gem, x, y), dist * 35 + 120); }
  }
  if (res.lines) {
    snd.clear(res.lines, g.combo); buzz(20 + res.lines * 10); shake = Math.min(1, 0.25 + res.lines * 0.18);
    const big = res.empty ? 'Spotless!' : PRAISE[Math.min(5, res.lines + (g.combo > 2 ? 1 : 0))];
    const d = $(`<div class="gl-combo">${big}${g.combo > 1 ? `<small>Combo ×${g.combo}</small>` : ''}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1100);
    if (res.lines >= 2 || g.combo >= 3 || res.empty) host?.play(Math.random() < 0.5 ? 'cheer' : 'jump', true);
    if (res.lines >= 2 && Math.random() < 0.5) say(['Wow!', 'So shiny!', 'Look at you go!', 'Sparkly!'][(Math.random() * 4) | 0], 1400);
  }
  // floating points
  const [cx, cy] = cellPos(pcx, pcy), v = new V3(cx, cy, 0.6); boardG.localToWorld(v); v.project(cam);
  const pe = $(`<div class="gl-pts">+${pts}</div>`); pe.style.left = (v.x + 1) / 2 * innerWidth + 'px'; pe.style.top = (1 - v.y) / 2 * innerHeight + 'px'; document.body.appendChild(pe); setTimeout(() => pe.remove(), 900);
  if (g.kind === 'classic') { const sc = el.panel.querySelector('[data-score]'); if (sc) sc.textContent = g.score.toLocaleString(); if (g.score > st.best && st.best > 0 && !g.bestPopped) { g.bestPopped = true; ui.pop('NEW BEST!', '#fff', 34, 24); } if (D.beaten(g.score) && !g.beatPopped) { g.beatPopped = true; ui.pop('BEATEN!', '#ffd23f', 36, 30); } }
  refreshSub();
  // end conditions
  if (g.goals.length && g.goals.every(q => q.left <= 0)) { finish(true); return true; }
  if (!g.tray.some(Boolean)) deal();
  checkStuck();
  return true;
}
function checkStuck() {
  const g = game; if (state !== 'play') return true;
  if (g.tray.some(p => p && anyFit(g.grid, p.shape))) return false;
  finish(false); return true;
}
async function finish(won) {
  if (recorded) return; recorded = true; busy = true; state = 'ending';
  const g = game, ms = performance.now() - g.t0;
  await wait(won ? 700 : 500);
  el.sub.classList.add('gl-hidden');
  winReward.innerHTML = ''; winOffer.classList.add('gl-hidden'); loseOffer.classList.add('gl-hidden');
  kitShare && (kitShare.style.display = g.kind === 'daily' ? 'none' : '');
  if (won) {
    if (!g.flowDone) F.level(true); g.flowDone = true;
    let stars = g.kind === 'daily' ? 3 : g.placed <= g.par ? 3 : g.placed <= Math.ceil(g.par * 1.4) ? 2 : 1;
    let coins = g.kind === 'daily' ? 60 : 20 + stars * 5;
    st.stars += stars; st.earned += stars; st.wins++;
    if (g.kind === 'adv') { st.level++; if (st.level % 5 === 0) { const k = ['hint', 'hammer', 'swap'][(st.level / 5) % 3]; st.boosts[k] = (st.boosts[k] || 0) + 1; } }
    if (g.kind === 'daily') {
      const today = dayNum();
      if (st.dLast !== today) {
        if (st.dLast === today - 1) st.dStreak++;
        else if (st.dLast === today - 2 && st.dFreezeWk !== weekOf(today)) { st.dStreak++; st.dFreezeWk = weekOf(today); setTimeout(() => ui.pop('❄️ Streak freeze used!', '#fff', 26, 30), 1400); }
        else st.dStreak = 1;
        st.dLast = today; S.set('dGrid', g.log);
      }
    }
    const stk = dropSticker(g.r);
    save(); M.add(coins, 'win'); D.won(stars, 'earned ⭐'); B.submit(stars, { ms });
    lastWin = { stars, coins, stk, daily: g.kind === 'daily' };
    winStars.querySelectorAll('i').forEach(i => i.classList.remove('on'));
    winReward.innerHTML = `<span>+${coins} <i class="gc"></i></span>${stk ? `<span><img src="./assets/thumbs/${stk.id}.webp" alt="">New sticker!</span>` : ''}${stk && stk.bonus ? `<span>Page done +${stk.bonus} <i class="gc"></i></span>` : ''}`;
    if (g.kind === 'daily') { winOffer.innerHTML = 'Share your grid<small>spoiler-free</small>'; winOffer.className = 'gl-btn gl-pink gl-offer'; winOffer.onclick = () => openShare(); winOffer.classList.remove('gl-hidden'); }
    else { winOffer.innerHTML = `▶ Double coins<small>watch a short video · +${coins} coins</small>`; winOffer.className = 'gl-btn gl-blue gl-offer'; winOffer.onclick = async () => { winOffer.disabled = true; if (await M.rewarded('double', { what: `${coins} more coins (${coins * 2} in total)` })) { M.add(coins, 'double'); winReward.firstChild.innerHTML = `+${coins * 2} <i class="gc"></i>`; snd.coin(); } winOffer.classList.add('gl-hidden'); winOffer.disabled = false; }; winOffer.classList.remove('gl-hidden'); }
    ui.els.win.querySelector('p').firstChild.textContent = g.kind === 'daily' ? '' : 'LEVEL ';
    ui.win(g.kind === 'daily' ? 'DAILY PUZZLE' : st.level - 1, g.kind === 'daily' ? `🔥 ${st.dStreak}-day streak` : `+${stars} ⭐ for the loft`); state = 'won';
    snd.win(); host?.play('cheer', true);
    for (let i = 0; i < stars; i++) setTimeout(() => { winStars.children[i].classList.add('on'); snd.star(i); }, 900 + i * 280);
    for (let i = 0; i < 4; i++) setTimeout(() => view.P.burst((Math.random() - 0.5) * 7, (Math.random() - 0.2) * 6, 1, CONF, 40, { speed: 9, up: 3, size: 1.6, life: 1.4, grav: 6 }), i * 180);
  } else if (g.kind === 'classic') {
    const newBest = g.score > st.best; if (newBest) st.best = g.score;
    // a revived run only pays the difference on its second ending
    const stars = Math.min(3, Math.floor(g.score / 1500)) - (g.paidStars || 0), coins = Math.min(250, Math.floor(g.score / 40)) - (g.paidCoins || 0);
    g.paidStars = (g.paidStars || 0) + stars; g.paidCoins = (g.paidCoins || 0) + coins;
    if (!g.flowDone) F.endless(g.score); g.flowDone = true; st.stars += stars; st.earned += stars; const stk = g.score >= 1000 && !g.stk ? (g.stk = dropSticker(g.r)) : null; save();
    if (coins) M.add(coins, 'classic'); B.submit(stars, { ms });
    if (newBest) D.won(g.score);
    winReward.innerHTML = '';
    ui.lose(newBest ? 'NEW BEST!' : 'NO SPACE LEFT', `${g.score.toLocaleString()} points${stars ? ` · +${stars} ⭐` : ''}${coins ? ` · +${coins} coins` : ''}${stk ? ' · new sticker!' : ''}`);
    state = 'lost'; snd.lose(); host?.play('fall', true);
    if (!g.revived) { loseOffer.innerHTML = '▶ Keep going<small>watch a short video · clear space + 3 fresh pieces</small>'; loseOffer.onclick = () => revive(); loseOffer.classList.remove('gl-hidden'); }
  } else {
    const frac = g.goals.reduce((a, q) => a + (q.n - Math.max(0, q.left)) / q.n, 0) / g.goals.length;
    if (!g.flowDone) F.level(false, frac); g.flowDone = true; snd.lose(); host?.play('fall', true);
    ui.lose('NO SPACE LEFT', frac > 0.6 ? 'So close! Tap to try again' : 'Tap to try again'); state = 'lost';
    if (!g.revived) { loseOffer.innerHTML = '▶ Second chance<small>watch a short video · clear space + 3 fresh pieces</small>'; loseOffer.onclick = () => revive(); loseOffer.classList.remove('gl-hidden'); }
  }
  busy = false;
}
async function revive() {
  loseOffer.disabled = true; const ok = await M.rewarded('revive', { what: 'the middle of the board cleared + 3 fresh pieces' }); loseOffer.disabled = false;
  if (!ok) return;
  const g = game; g.revived = true; ui.els.lose.classList.add('hc-hidden'); el.sub.classList.remove('gl-hidden');
  // honest second chance: the middle 4×4 is cleared (gem blocks stay put), then a fresh deal that fits
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) { const c = g.grid[y][x]; if (c && c.gem < 0) { g.grid[y][x] = null; g.dying.push({ x, y, c: c.c, gem: -1, t: -Math.hypot(x - 3.5, y - 3.5) * 0.05, fx: false }); } }
  state = 'play'; recorded = false; snd.clear(2, 0); host?.play('cheer', true); say('Here we go again!', 1500);
  if (g.kind === 'classic') { /* the run continues: undo the end-of-run bookkeeping that is safe to undo */ }
  deal();
}
function quitToHome() { game = null; showHome(); }
ui.onTap(which => {
  snd.unlock();
  if (which === 'start') { showHome(); if (D.isDaily && st.dLast !== dayNum()) setTimeout(() => startGame('daily'), 300); snd.music(true); setTimeout(() => say(doneList().length ? 'Welcome back! ✨' : 'Our loft needs love! Win levels for ⭐ stars ✨', 3200), 400); }
  else if (which === 'win') {
    const n = lastWin ? lastWin.stars : 0; quitToHome(); el.starN.textContent = st.stars - n;
    const r = el.starPill.getBoundingClientRect(); let shown = st.stars - n;
    for (let i = 0; i < n; i++) setTimeout(() => { const s = $('<div class="gl-fly" style="font-size:38px;width:auto;height:auto">⭐</div>'); document.body.appendChild(s);
      flying.push({ img: s, sx: innerWidth / 2, sy: innerHeight * 0.45, tx: r.left + 20, ty: r.top + 20, t: 0, d: 0.6, cx: innerWidth * 0.2, cy: innerHeight * 0.3, upd: () => { shown++; el.starN.textContent = shown; el.starPill.classList.remove('bump'); void el.starPill.offsetWidth; el.starPill.classList.add('bump'); snd.coin(); if (shown === st.stars) refreshHome(); } }); }, 250 + i * 220);
    const nt = nextTasks()[0]; setTimeout(() => say(nt && st.stars >= nt.cost ? `Next up: ${nt.name.toLowerCase()}! Tap ⭐` : lastWin?.stk ? 'A new sticker for the album! 📖' : 'More stars, more makeover!'), 900);
    setTimeout(() => M.breakAd('level-end', { level: st.level }), 1500);
  } else if (which === 'lose') {
    const k = game?.kind; quitToHome();
    if (k === 'adv' || k === 'daily') setTimeout(() => startGame(k), 300);
    else setTimeout(() => M.breakAd('menu'), 600);
  }
});

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new V3();
function boardPoint(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  boardG.updateMatrixWorld(); const n = new V3(0, 0, 1).transformDirection(boardG.matrixWorld), o = new V3().setFromMatrixPosition(boardG.matrixWorld);
  plane.setFromNormalAndCoplanarPoint(n, o); if (!ray.ray.intersectPlane(plane, hitP)) return null;
  return boardG.worldToLocal(hitP.clone());
}
function snapOf(p, x, y) {   // piece centre (local) → top-left grid cell
  const s = p.shape; return [Math.round(x - (s.w - 1) / 2 + (N - 1) / 2), Math.round((N - 1) / 2 - (y + (s.h - 1) / 2))];
}
let dragOff = 2.4;
addEventListener('pointerdown', e => {
  if (e.target !== R.domElement) return; snd.unlock();
  if (mode === 'home') { drag0 = { x: e.clientX, yaw: yawT }; return; }
  if (mode !== 'play' || state !== 'play' || busy) return;
  const p = boardPoint(e); if (!p) return;
  if (hammerOn) { const gx = Math.round(p.x + (N - 1) / 2), gy = Math.round((N - 1) / 2 - p.y); if (gx >= 0 && gy >= 0 && gx < N && gy < N) smash(gx, gy); return; }
  if (p.y > TRAY_Y + TRAY_H / 2 + 0.3) return;
  let best = -1, bd = 1e9; game.slots.forEach((s, i) => { if (!game.tray[i]) return; const d = Math.abs(p.x - s.tx); if (d < 1.6 && d < bd) { bd = d; best = i; } });
  if (best < 0) return;
  dragOff = e.pointerType === 'mouse' ? 1.2 : 2.6;
  game.drag = { i: best, x: p.x, y: p.y, snap: null }; snd.pick(); buzz(6); hintT = 0;
  const s = game.slots[best]; s.ts = 1; s.tz = 1.2;
});
let drag0 = null, yaw = 0, yawT = 0;
addEventListener('pointermove', e => {
  if (mode === 'home' && drag0) { yawT = Math.max(-0.45, Math.min(0.45, drag0.yaw - (e.clientX - drag0.x) / innerWidth * 1.4)); return; }
  if (!game || !game.drag) return;
  const p = boardPoint(e); if (!p) return; game.drag.x = p.x; game.drag.y = p.y;
});
addEventListener('pointerup', () => {
  drag0 = null;
  if (!game || !game.drag) return;
  const d = game.drag, s = game.slots[d.i]; game.drag = null;
  if (d.snap && state === 'play' && doPlace(d.i, d.snap[0], d.snap[1])) { s.ts = TRAY_S; s.tz = 0; s.x = s.tx; s.y = s.ty; s.s = TRAY_S; s.z = 0; return; }
  s.ts = TRAY_S; s.tz = 0; snd.drop();
});

// ---------------------------------------------------------------- camera
const camCur = { pos: new V3(8, 9, 18), tgt: new V3(0, 1.5, 0), off: 0 };
const atm = { cur: 0, target: 0 };
function homePose() {
  const def = roomOf(), ttl = mode === 'title';
  const tgt = new V3(-0.3, 1.5, -0.4), dir = new V3(Math.sin(0.55 + yaw), 0.72, Math.cos(0.55 + yaw)).normalize();
  const topPx = ttl ? innerHeight * 0.32 : 128, botPx = ttl ? innerHeight * 0.2 : (el.homeBot.offsetHeight || 240) + 16, free = Math.max(200, innerHeight - topPx - botPx);
  const tanV = Math.tan(cam.fov * PI / 360), tanH = tanV * cam.aspect;
  let dist = Math.max((def.W * 0.6 + 0.4) / (tanH * 0.98), 5.4 / (tanV * free / innerHeight));
  if (focus && focusT > 0) { tgt.lerp(focus, 0.35 * focusT); dist *= 1 - 0.18 * focusT; }
  return { pos: tgt.clone().addScaledVector(dir, dist), tgt, off: innerHeight / 2 - (topPx + free / 2) };
}
function playPose() {
  const def = roomOf();
  // looking at the back wall from the middle of the loft: the window and the beams frame the board
  const por = innerWidth / innerHeight < 0.8;
  return { pos: new V3(def.win.x * 0.35, 2.4, por ? 11.5 : 11), tgt: new V3(def.win.x * 0.35, 2.5, -4), off: 0 };
}

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); layoutBoard(); hostPlayPose(); if (mode !== 'play') placeHostInRoom(); }
addEventListener('resize', resize);
let T = 0, perf = {};
R.info.autoReset = false;
function drawBoard(dt) {
  const g = game; view.begin();
  // preview: where the dragged piece would land + which lines it would clear
  let prev = null, hlRows = [], hlCols = [], dragC = null;
  if (g.drag) {
    const p = g.tray[g.drag.i], s = g.slots[g.drag.i];
    s.tx = g.drag.x; s.ty = g.drag.y + dragOff;
    const [gx, gy] = snapOf(p, s.tx, s.ty);
    g.drag.snap = fits(g.grid, p.shape, gx, gy) ? [gx, gy] : null;
    dragC = PALC[p.color];
    if (g.drag.snap) { prev = p.shape.cells.map(([x, y]) => [gx + x, gy + y]); const w = wouldClear(g.grid, p.shape, gx, gy); hlRows = w.rows; hlCols = w.cols; }
  }
  view.ghostCells(prev, dragC || WHITE);
  const pulse = 0.5 + 0.5 * Math.sin(T * 10);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = g.grid[y][x]; if (!c) continue;
    const [px, py] = cellPos(x, y), v = g.vfx[y][x];
    let s = 0.98, z = 0;
    if (v) { const a = (T - v.t) / 0.28; if (a < 1) { s = 0.98 * (1 + Math.sin(a * PI) * 0.12); z = (1 - a) * 0.5; } else g.vfx[y][x] = null; }
    const hl = hlRows.includes(y) || hlCols.includes(x);
    colTmp.copy(c.gem >= 0 ? PEARLC : PALC[c.c]);
    if (hl) { colTmp.copy(dragC).lerp(WHITE, 0.15 + pulse * 0.2); s *= 1 + pulse * 0.04; }
    view.block(px, py, z, s, colTmp, c.gem, T);
  }
  // hint glow: the suggested spot blinks
  if (hintT > 0 && hintMove && g.tray[hintMove.i]) { hintT -= dt; const p = g.tray[hintMove.i]; if (Math.sin(T * 9) > -0.2) view.ghostCells(p.shape.cells.map(([x, y]) => [hintMove.x + x, hintMove.y + y]), PALC[p.color]); }
  // clearing wave
  for (let k = g.dying.length - 1; k >= 0; k--) {
    const d = g.dying[k]; d.t += dt; const [px, py] = cellPos(d.x, d.y);
    if (d.t < 0) { colTmp.copy(d.gem >= 0 ? PEARLC : PALC[d.c]); view.block(px, py, 0, 0.98, colTmp, d.gem, T); continue; }
    if (!d.fx) { d.fx = true; view.P.burst(px, py, 0.4, [PAL[d.c], PAL[d.c], '#ffffff', '#fff2b0'], 9, { speed: 5, up: 3, size: 1.1, life: 0.7 }); }
    const a = d.t / 0.3; if (a >= 1) { g.dying.splice(k, 1); continue; }
    colTmp.copy(PALC[d.c]).lerp(WHITE, Math.max(0, 0.8 - a * 2));
    view.block(px, py, a * 0.8, 0.98 * (a < 0.3 ? 1 + a * 0.6 : (1 - a) * 1.6), colTmp, -1, T, a * 2, a * 1.5);
  }
  // tray pieces
  g.slots.forEach((s, i) => {
    const p = g.tray[i]; if (!p) return;
    if (s.in > 0) { s.in -= dt; return; }
    const k = Math.min(1, dt * (g.drag && g.drag.i === i ? 26 : 12));
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; s.s += (s.ts - s.s) * Math.min(1, dt * 16); s.z += (s.tz - s.z) * k;
    if (!(g.drag && g.drag.i === i)) { s.tx = SLOT_X[i]; s.ty = TRAY_Y; }
    const fit = anyFit(g.grid, p.shape), sh = p.shape;
    colTmp.copy(PALC[p.color]); if (!fit && !(g.drag && g.drag.i === i)) colTmp.lerp(new THREE.Color('#8a8496'), 0.75);
    const bob = g.drag && g.drag.i === i ? 0 : Math.sin(T * 2 + i) * 0.04;
    sh.cells.forEach(([cx, cy], ci) => {
      const lx = (cx - (sh.w - 1) / 2) * s.s, ly = ((sh.h - 1) / 2 - cy) * s.s;
      view.block(s.x + lx, s.y + ly + bob, 0.1 + s.z, s.s * 0.98, ci === p.gem ? PEARLC : colTmp, ci === p.gem ? p.gemType : -1, T);
    });
  });
  view.end(); view.P.update(dt);
}
loop((d) => {
  const dt = Math.min(0.05, d / 60); T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt / w.dur; w.fn(Math.min(1, w.t)); if (w.t >= 1) { tweens.splice(i, 1); w.res(); } }
  if (!view) return;
  yaw += (yawT - yaw) * Math.min(1, dt * 6);
  const pose = mode === 'play' || mode === 'title' ? playPose() : homePose(), k = Math.min(1, dt * 3.2);
  camCur.pos.lerp(pose.pos, k); camCur.tgt.lerp(pose.tgt, k); camCur.off += (pose.off - camCur.off) * k;
  cam.position.copy(camCur.pos); cam.lookAt(camCur.tgt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 2); cam.position.x += (Math.random() - 0.5) * shake * 0.12; cam.position.y += (Math.random() - 0.5) * shake * 0.12; }
  cam.setViewOffset(innerWidth, innerHeight, 0, camCur.off, innerWidth, innerHeight);
  atm.cur += (atm.target - atm.cur) * Math.min(1, dt * 1.5);
  const p = atm.cur;
  hemi.intensity = 0.7 + 0.5 * p; sun.intensity = 1.6 + 1.1 * p; sun.color.set(mixHex('#d8dde8', '#ffe2b8', p));
  scene.environmentIntensity = 0.5 + 0.3 * p; if (curRoom) curRoom.beams.visible = mode === 'home';
  C.grade.uniforms.uSat.value = mode === 'play' || mode === 'title' ? 1.12 : 0.85 + 0.32 * p;
  const lightsOn = curRoom && doneList().includes('lights'); warm.intensity += ((lightsOn ? 9 : 0) - warm.intensity) * dt * 2;
  if (curRoom?.bulbs && lightsOn) curRoom.bulbs.material.color.setHSL(0.11, 1, 0.62 + Math.sin(T * 3) * 0.04);
  paintBg(p);
  if (marker.visible) { const b = T; marker.children[0].position.y = 0.6 + Math.sin(b * 4) * 0.12; marker.children[1].position.y = 1.05 + Math.sin(b * 4) * 0.12; const rg = marker.getObjectByName('ring'); rg.scale.setScalar(1 + (b * 1.2 % 1) * 0.6); rg.material.opacity = 0.8 * (1 - b * 1.2 % 1); }
  if ((mode === 'play' || mode === 'title') && game) { cam.updateMatrixWorld(); drawBoard(dt); }
  host?.mixer.update(dt);
  WP.update(dt);
  for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt / f.d; const t = Math.min(1, f.t), a = 1 - t;
    const x = a * a * f.sx + 2 * a * t * f.cx + t * t * f.tx, y = a * a * f.sy + 2 * a * t * f.cy + t * t * f.ty;
    f.img.style.left = x + 'px'; f.img.style.top = y + 'px'; f.img.style.transform = `scale(${1 + Math.sin(t * PI) * 0.5})`;
    if (t >= 1) { f.img.remove(); flying.splice(i, 1); f.upd(); } }
  if (bubbleEl) { bubbleT -= dt; if (bubbleT <= 0) { bubbleEl.remove(); bubbleEl = null; } else placeBubble(); }
  R.info.reset(); C.render(dt); perf = { calls: R.info.render.calls, tris: R.info.render.triangles };
});

// ---------------------------------------------------------------- loading
async function renderIcons() {
  for (let i = 0; i < GEM_IDS.length; i++) ICON['g' + i] = `./assets/thumbs/${GEM_IDS[i]}.webp`;
}
async function boot() {
  let n = 0; const total = 9; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  const got = await Promise.all(GEM_IDS.map(id => piece(id, 'mid').then(p => { tick(); return p; })));
  GEMP = got.map(p => { const m = p.mat.clone(); m.envMapIntensity = 1.6; m.emissiveMap = m.map; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.12; return { geo: p.geo, mat: m }; });
  await renderIcons();
  view = createView(boardG, GEMP);
  const hp = loadHost().then(h => { tick(); return h; });
  await enterRoom(st.room, true); tick();
  host = await hp; placeHostInRoom(); tick();
  refreshHome();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  mode = 'title'; state = 'ready'; titleShow();
  for (let k = 0; k < LOFTS.length; k++) if (k !== st.room) setTimeout(() => ensureRoom(k), 5000 + k * 1500);
  if (Q.get('daily') === '1') { /* the kit's daily seed is used when the Daily button is pressed or on autostart */ }
}

// ---------------------------------------------------------------- title showcase: a heart of jewels on the board
function titleShow() {
  game = newGame('classic');
  const H = ['.##..##.', '########', '########', '########', '.######.', '..####..', '...##...', '........'];
  H.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') game.grid[y][x] = { c: [0, 5, 4, 1, 6, 2, 3][y], gem: (x + y * 3) % 11 === 0 ? (x + y) % 5 : -1 }; }));
  game.tray = makeDealer(rng(5), { help: 0 }).deal(emptyGrid());
  game.slots.forEach((s, i) => { s.x = s.tx = SLOT_X[i]; });
  layoutBoard(); boardG.visible = true; if (host) { cam.add(host.g); hostPlayPose(); }
}

// ---------------------------------------------------------------- test hooks
let botBusy = false, botNext = 0;
window.__game = {
  autostart() { if (mode !== 'title' || !view) return false; ui.els.start.dispatchEvent(new Event('pointerdown')); setTimeout(() => startGame(D.seed ? 'daily' : 'adv'), 350); },
  get state() { return state === 'ending' ? 'play' : state; }, get level() { return st.level; }, get score() { return game && game.kind === 'classic' ? game.score : st.earned; },
  get stars() { return st.stars; }, get perf() { return perf; }, get room() { return st.room; }, get coins() { return M ? M.coins() : 0; }, get stickers() { return st.stickers.length; },
  get tasksDone() { return Object.values(st.done).reduce((a, l) => a + l.length, 0); }, get mode() { return mode; }, get game() { return game; },
  start(kind) { startGame(kind); },
  bot() {
    if (!view || botBusy) return;
    if (mode === 'title') { ui.hideStart(); ui.els.start.dispatchEvent(new Event('pointerdown')); return; }
    if (mode === 'play') {
      if (state !== 'play' || busy || game.drag || performance.now() < botNext) return;
      const m = bestMove(game.grid, game.tray, { gemWant: Object.fromEntries(game.goals.map(q => [q.type, q.left])) });
      if (!m) { checkStuck(); return; }
      // glide the piece over its spot, then drop it
      const s = game.slots[m.i], p = game.tray[m.i], [cx, cy] = cellPos(m.x + (p.shape.w - 1) / 2, m.y + (p.shape.h - 1) / 2);
      botBusy = true; s.ts = 1; s.tz = 1.2; game.drag = { i: m.i, x: cx, y: cy - dragOff, snap: null };
      setTimeout(() => { if (game && game.drag) { game.drag = null; s.ts = TRAY_S; s.tz = 0; doPlace(m.i, m.x, m.y); s.x = s.tx = SLOT_X[m.i]; s.y = s.ty = TRAY_Y; s.s = TRAY_S; s.z = 0; } botBusy = false; botNext = performance.now() + 650; }, 300);
      return;
    }
    if (mode === 'home') {
      if (roomBusy || flying.length || document.querySelector('.gl-veil') || document.querySelector('.mny-ad')) return;
      const nt = nextTasks()[0];
      if (!nt && st.room < LOFTS.length - 1) { botBusy = true; goNextRoom().finally(() => botBusy = false); return; }
      if (nt && st.stars >= nt.cost) { buyTask(nt); return; }
      startGame('adv');
    }
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.textContent = 'Could not load Gemloft'; });

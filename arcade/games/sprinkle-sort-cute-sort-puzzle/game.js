// Sprinkle Sort — an original kawaii sort puzzle. Tap a cup, tap another to pour: same topping on same topping, or into
// an empty cup. Four of a kind and the cup gets its heart lid. Undo, hints, an extra cup; every level is proven solvable
// by the solver before it is dealt. Stars open a café and a cozy loft; stickers fill an album; the Daily is the same for
// everyone. Art: kawaii 3D library (assets/*.glb, our own) + chibi Yuki (k04); cups, toppings, UI, sound: code.
import { THREE, createUI, store, loop, buzz, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { loader } from './assets.js';
import { ROOMS, buildRoom } from './dorm.js';
import { CAP, top, done, canPour, pour, won, clone, stuck, solve, makeLevel } from './logic.js';
import { createView, KIND, CUP_H, SPX, ROWY } from './view.js';
import { snd } from './audio.js';
import { money } from './kit/money.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Sprinkle Sort: Cute Sort Puzzle', PI = Math.PI, V3 = THREE.Vector3, Q = new URLSearchParams(location.search);
const S = store('sprinkle-sort');
const st = { level: S.get('level', 1), stars: S.get('stars', 0), room: S.get('room', 0), done: S.get('done', {}), best: S.get('best', 0), earned: S.get('earned', 0), wins: S.get('wins', 0),
  stickers: S.get('stickers', []), newSt: S.get('newSt', []), pagesPaid: S.get('pagesPaid', []), dLast: S.get('dLast', 0), dStreak: S.get('dStreak', 0), dFreezeWk: S.get('dFreezeWk', -1), boosts: S.get('boosts', { hint: 3, cup: 2 }) };
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('sprinkle-sort');
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const dayNum = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const weekOf = dn => Math.floor((dn + 3) / 7);

// ---------------------------------------------------------------- money (shared kit: coins, opt-in reward videos, capped breaks, store)
const M = money({ game: 'sprinkle-sort', style: 'B' });
M.onChange(() => refreshCoins(true));
addEventListener('ap:ad', e => snd.adPause(e.detail && e.detail.phase === 'start'));

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.18, bloomThreshold: 0.96, bloomRadius: 0.4, exposure: 0.95, envIntensity: 0.5, lite: LITE, grade: { sat: 1.15, contrast: 1.04, vignette: 0.08, grain: 0 } });
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 256; bgCanvas.height = 512;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
const hemi = new THREE.HemisphereLight('#fff4fb', '#c9a8e0', 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6fb', 2.3); sun.position.set(-7, 15, 10); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; scene.add(sun, sun.target);
// a key light that travels with the camera so the board always reads (soft, from the upper left)
const key = new THREE.DirectionalLight('#ffffff', 0.85); key.position.set(-3, 5, 4); cam.add(key); key.target.position.set(0, 0, -6); cam.add(key.target);
const warm = new THREE.PointLight('#ffb0dc', 0, 14, 1.4); warm.position.set(-2, 3.6, -1); scene.add(warm);

// ---------------------------------------------------------------- UI + kit layers
const PAL = KIND.map(k => k.c);
const TITLE = [...'Sprinkle'].map((c, i) => `<span style="color:${PAL[[0, 6, 1, 4, 2, 3, 5, 0][i]]};animation-delay:${i * 0.1}s">${c}</span>`).join('') + '<br>' + [...'Sort'].map((c, i) => `<span style="color:${PAL[[1, 2, 6, 4][i]]};animation-delay:${0.8 + i * 0.12}s">${c}</span>`).join('');
const ui = createUI({ title: `${TITLE}<small>CUTE SORT PUZZLE</small>`, hint: 'Tap to play', hand: '', progress: false, score: false });
ui.els.start.classList.add('jb-title');
const D = daily('sprinkle-sort', ui, { name: NAME });
const B = worldBoard({ game: 'sprinkle-sort', label: 'Stars earned', limits: { maxRun: 3, maxPerSec: 1.5 }, mode: 'sum', corner: 'tr', accent: '#ff5fa8' });
const kitShare = ui.els.win.querySelector('.hc-btn');
ui.els.win.querySelector('h1').textContent = 'Yay!';
const winStars = $('<div class="jb-winstars"><i></i><i></i><i></i></div>'); ui.els.win.querySelector('h1').after(winStars);
const winReward = $('<div class="jb-reward"></div>'); ui.els.win.querySelector('[data-x]').after(winReward);
const winOffer = $('<button class="jb-btn jb-sky jb-offer"></button>'); winReward.after(winOffer);
const loseOffer = $('<button class="jb-btn jb-mint jb-offer"></button>'); ui.els.lose.querySelector('[data-x]').after(loseOffer);
const undoOffer = $('<button class="jb-btn jb-lilac jb-offer">↶ Undo last pour<small>free</small></button>'); loseOffer.after(undoOffer); undoOffer.addEventListener('pointerdown', e => e.stopPropagation()); undoOffer.onclick = () => undoFromLose();
for (const b of [winOffer, loseOffer]) b.addEventListener('pointerdown', e => e.stopPropagation());
const loadEl = document.getElementById('jb-load'), loadBar = loadEl.querySelector('b');
const TH = id => `./assets/thumbs/${id}.webp`;
const STAR = `<img src="${TH('m03')}" alt="">`;

const hud = $(`<div class="jb">
  <div id="jb-home-top" class="jb-hidden"><div class="jb-pill star">${STAR}<span>0</span></div><div class="jb-pill coin" data-shop><img src="${TH('x02')}" alt=""><span>0</span><div class="plus">+</div></div>
    <div class="jb-roomname"><b></b><div class="jb-prog"><i></i></div></div></div>
  <div id="jb-side" class="jb-hidden"><button class="jb-btn jb-round" data-mute aria-label="Sound">🔊</button><button class="jb-btn jb-round" data-album aria-label="Sticker album"><img src="${TH('x01')}" alt=""><b class="jb-hidden">new</b></button><button class="jb-btn jb-round" data-shop aria-label="Shop"><img src="${TH('x02')}" alt=""></button></div>
  <div id="jb-home-bot" class="jb-hidden"><div class="jb-tasks"></div>
    <div class="jb-modes"><button class="jb-btn jb-lilac" data-classic>Stickers<small>0/30</small></button><button class="jb-btn jb-pink" data-daily>Daily<small>new puzzle</small></button></div>
    <button class="jb-btn jb-mint jb-play"></button></div>
  <div id="jb-phud" class="jb-hidden"><button class="jb-btn jb-round" data-home aria-label="Back to the room">🏠</button><div class="jb-panel"></div><div style="width:48px;flex:none"></div></div>
  <div class="jb-sub jb-hidden"><span></span></div>
  <div id="jb-boost" class="jb-hidden"><button class="jb-btn txt" data-b="undo" aria-label="Undo">↶<b></b></button><button class="jb-btn" data-b="hint" aria-label="Hint: next pour"><img src="${TH('x04')}" alt=""><b></b></button><button class="jb-btn" data-b="cup" aria-label="Extra cup"><img src="${TH('s01')}" alt=""><b></b></button><button class="jb-btn txt" data-b="restart" aria-label="Restart level">⟲</button><button class="jb-btn jb-round" data-mute aria-label="Sound">🔊</button></div>
</div>`);
document.body.appendChild(hud);
const q1 = s => hud.querySelector(s), qa = s => hud.querySelectorAll(s);
const el = { homeTop: q1('#jb-home-top'), side: q1('#jb-side'), homeBot: q1('#jb-home-bot'), starN: q1('.jb-pill.star span'), starPill: q1('.jb-pill.star'), coinN: q1('.jb-pill.coin span'), coinPill: q1('.jb-pill.coin'),
  roomName: q1('.jb-roomname b'), prog: q1('.jb-prog i'), tasks: q1('.jb-tasks'), play: q1('.jb-play'), classic: q1('[data-classic]'), daily: q1('[data-daily]'), albumBadge: q1('[data-album] b'),
  phud: q1('#jb-phud'), panel: q1('.jb-panel'), sub: q1('.jb-sub'), subT: q1('.jb-sub span'), boost: q1('#jb-boost') };
qa('[data-mute]').forEach(b => { b.textContent = snd.muted ? '🔇' : '🔊'; b.onclick = () => { const m = snd.toggle(); qa('[data-mute]').forEach(x => x.textContent = m ? '🔇' : '🔊'); }; });
qa('[data-shop]').forEach(b => b.onclick = () => { snd.tap(); M && M.shop(); });
q1('[data-album]').onclick = () => { snd.tap(); openAlbum(); };
q1('[data-home]').onclick = () => { snd.tap(); if (busy || state !== 'play') return; quitToHome(); };
el.play.onclick = () => { snd.tap(); startGame('adv'); };
el.classic.onclick = () => { snd.tap(); openAlbum(); };
el.daily.onclick = () => { snd.tap(); if (st.dLast === dayNum()) { openShare(); return; } startGame('daily'); };
qa('[data-b]').forEach(b => b.onclick = () => useBooster(b.dataset.b));

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', game = null, host = null, rooms = {}, curRoom = null, roomBusy = false, busy = false, view = null, recorded = false, lastWin = null;
const roomOf = () => ROOMS[Math.min(st.room, ROOMS.length - 1)];
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
  // home: soft lilac → strawberry milk; play: a deeper candy-purple with bokeh, hearts and sparkles (like a blurred room)
  const play = mode === 'play' || mode === 'title';
  const top = play ? '#9b6fe0' : mixHex('#b9a6d6', '#bd98ef', p), mid = play ? '#c48ae8' : mixHex('#d4c2e6', '#dcb6f0', p), bot = play ? '#ffaad4' : mixHex('#e6cfe0', '#ffbfe0', p), key = top + mid + bot; if (key === bgKey) return; bgKey = key;
  const x = bgCanvas.getContext('2d'), W = 256, Hh = 512, g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  const r = rng(11);
  for (let i = 0; i < 26; i++) { const cx = r() * W, cy = r() * Hh, rad = 8 + r() * 34, rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad), c = ['255,255,255', '255,190,230', '210,180,255', '255,240,170'][i % 4];
    rg.addColorStop(0, `rgba(${c},${(play ? 0.22 : 0.18) + r() * 0.2})`); rg.addColorStop(0.7, `rgba(${c},${0.08 + r() * 0.08})`); rg.addColorStop(1, `rgba(${c},0)`); x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  if (play) {
    x.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 18; i++) { const cx = r() * W, cy = r() * Hh, s = 2 + r() * 4; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * PI / 4, rr = k % 2 ? s * 0.35 : s; k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + rr, cy); } x.fill(); }
    x.fillStyle = 'rgba(255,170,215,.35)';
    for (let i = 0; i < 8; i++) { const cx = r() * W, cy = r() * Hh, s = 4 + r() * 6; x.beginPath(); x.moveTo(cx, cy + s); x.bezierCurveTo(cx - s * 1.5, cy, cx - s * 0.6, cy - s, cx, cy - s * 0.35); x.bezierCurveTo(cx + s * 0.6, cy - s, cx + s * 1.5, cy, cx, cy + s); x.fill(); }
  }
  bgTex.needsUpdate = true;
}

// ---------------------------------------------------------------- board group (rides with the camera)
const BD = 6;
const boardG = new THREE.Group(); cam.add(boardG); boardG.visible = false;
let LAY = { s: 40, por: true };
function layoutBoard() {
  const por = innerWidth / innerHeight < 0.8;
  const vh = 2 * BD * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const topR = el.phud.classList.contains('jb-hidden') ? 80 : el.phud.getBoundingClientRect().bottom;
  const ttl = mode === 'title', top = ttl ? innerHeight * (por ? 0.3 : 0.33) : (topR || 80) + (por ? 150 : 40), bot = ttl ? innerHeight * 0.22 : (por ? 96 : 92);
  const availH = innerHeight - top - bot, availW = innerWidth * (por ? 0.96 : 0.9);
  const E = game && game.ext || { w: 8.7, top: 5, bot: -5 };
  const stackH = E.top - E.bot, stackW = E.w + 0.4;
  const s = Math.min(availW / stackW, availH / stackH, por ? 1e9 : 92);   // px per unit
  const stackPx = stackH * s, cy = top + availH / 2, k = vh / innerHeight;
  boardG.scale.setScalar(s * k);
  boardG.position.set(0, (0.5 - cy / innerHeight) * vh - (E.top + E.bot) / 2 * s * k, -BD);
  boardG.rotation.x = 0.16;
  LAY = { s, por, top, cy, E };
  el.sub.style.top = (ttl ? top - 27 : (topR || 80) + 10) + 'px';
}

// ---------------------------------------------------------------- host (kawaii library: Yuki, k04)
async function loadHost() {
  const gl = await loader.loadAsync('./assets/chars/k04.glb');
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.8; } });
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
  if (mode === 'title') {   // big and waving below the board
    const hPx = Math.min(innerHeight * 0.3, 300); host.g.scale.setScalar(hPx * k / host.h);
    const xPx = LAY.por ? innerWidth * 0.2 : innerWidth * 0.5 - LAY.s * (LAY.E.w / 2 + 0.6) - hPx * 0.3;
    host.g.position.set((xPx / innerWidth - 0.5) * vw, (0.5 - (innerHeight + hPx * 0.08) / innerHeight) * vh, -d);
    host.g.rotation.set(0.05, 0.35, 0);
  } else if (LAY.por) {   // peeking over the top-right of the board
    const boardTopPx = LAY.cy - (LAY.E.top - (LAY.E.top + LAY.E.bot) / 2) * LAY.s, hPx = Math.min(170, innerHeight * 0.2);
    host.g.scale.setScalar(hPx * k / host.h);
    const xPx = innerWidth - hPx * 0.22;
    host.g.position.set((xPx / innerWidth - 0.5) * vw, (0.5 - (boardTopPx + hPx * 0.35) / innerHeight) * vh, -d - 1.5);
    host.g.rotation.set(0.05, -0.35, 0);
  } else {         // standing to the left of the board
    const hPx = innerHeight * 0.5; host.g.scale.setScalar(hPx * k / host.h);
    const xPx = Math.max(hPx * 0.4, innerWidth * 0.5 - LAY.s * (LAY.E.w / 2 + 0.6) - hPx * 0.3);
    host.g.position.set((xPx / innerWidth - 0.5) * vw, (0.5 - (innerHeight - 40) / innerHeight) * vh, -d);
    host.g.rotation.set(0.04, 0.45, 0);
  }
}
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 2600) { if (!host) return; bubbleEl?.remove(); bubbleEl = $(`<div class="jb-bubble">${text}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000; }
const headPos = new V3();
function placeBubble() {
  if (!bubbleEl) return;
  host.g.getWorldPosition(headPos); const sc = new V3(); host.g.getWorldScale(sc); headPos.y += host.h * sc.y * (mode === "home" ? 1.15 : 1.02);
  headPos.project(cam); const x = (headPos.x + 1) / 2 * innerWidth, y = (1 - headPos.y) / 2 * innerHeight;
  const side = mode === 'play' && LAY.por; bubbleEl.classList.toggle('side', side);
  if (side) { bubbleEl.style.left = (x - LAY.s * 0.9) + 'px'; bubbleEl.style.top = (y + LAY.s * 1.1) + 'px'; }
  else { bubbleEl.style.left = Math.max(105, Math.min(innerWidth - 105, x)) + 'px'; bubbleEl.style.top = Math.max(mode === 'play' ? 150 : 120, y) + 'px'; }
}

// ---------------------------------------------------------------- rooms
async function ensureRoom(i) {
  if (!rooms[i]) rooms[i] = buildRoom(ROOMS[i]).then(Rm => { Rm.group.visible = false; scene.add(Rm.group); for (const id of (st.done[ROOMS[i].id] || [])) applyTask(Rm, ROOMS[i].tasks.find(t => t.id === id)); return Rm; });
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
  const h = roomOf().host; curRoom.group.add(host.g); host.g.position.set(h[0], h[1], h[2]); host.g.rotation.set(0, 0.55, 0); host.g.scale.setScalar(3.1 / host.h);
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
  if (t.kind === 'lights') return new V3(0, d.H - 0.9, -d.D / 2 + 0.6);
  if (t.kind === 'clutter') return new V3(d.boxes[0][0], 1.6, d.boxes[0][2]);
  return new V3();
}
const WP = (() => {   // world-space sparkle bursts for the room makeover
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
const CONF = ['#ff5fa8', '#ffd84d', '#4fdcae', '#5cc8ff', '#b48cff', '#ffffff', '#ff9ccc'];
const marker = new THREE.Group();
{ const gm = new THREE.MeshPhysicalMaterial({ color: '#ff6fb3', emissive: '#ff3d96', emissiveIntensity: 0.45, roughness: 0.2, clearcoat: 1 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 20), gm); cone.rotation.x = PI; cone.position.y = 0.6; marker.add(cone);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), gm); ball.position.y = 1.05; marker.add(ball);
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
    for (const c of Rm.clutter.children.slice()) { const s0 = c.scale.clone(), wp = new V3(); c.getWorldPosition(wp); anim(0.35, k => c.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - k))).then(() => c.scale.copy(s0)); WP.burst(wp.add(new V3(0, 0.5, 0)), ['#ffc2e0', '#ffffff', '#d9b58c'], 14, { speed: 2.5, up: 2, size: 1.4, life: 0.7 }); snd.place(1); await wait(100); }
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
  M && M.add(300, 'room-complete'); save(); say(`${def.name} done! +2 of each booster 🎁`, 3600);
  ui.pop(`${def.name.toUpperCase()} DONE!`, '#fff', 32, 26);
}
async function goNextRoom() {
  if (roomBusy || st.room >= ROOMS.length - 1) return;
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
    const more = st.room < ROOMS.length - 1;
    el.tasks.innerHTML = `<h3><span>${more ? 'Room decorated!' : 'Every room decorated!'}</span><span>🏡</span></h3><div class="jb-task"><div class="ic">${more ? '🗝️' : '💎'}</div><div class="nm">${more ? 'Next: ' + ROOMS[st.room + 1].name : 'More rooms are on the way'}<small>${more ? 'A dusty corner is waiting' : 'Stars now turn into coins'}</small></div>${more ? '<button class="jb-btn jb-pink" data-next>Go ➜</button>' : ''}</div>`;
    const nb = el.tasks.querySelector('[data-next]'); if (nb) nb.onclick = () => { snd.tap(); goNextRoom(); };
  } else {
    const t = list[0], can = st.stars >= t.cost;
    el.tasks.innerHTML = `<h3><span>Room makeover</span><span>${doneList(def).length}/${def.tasks.length}</span></h3><div class="jb-task"><div class="ic">${taskIcon(t)}</div><div class="nm">${t.name}<small>${can ? 'Tap to place it!' : `Earn ${t.cost - st.stars} more ⭐ in levels`}</small></div><button class="jb-btn ${can ? 'jb-pink' : 'jb-grey'}" data-t><i class="js"></i> ${t.cost}</button></div>`;
    el.tasks.querySelector('[data-t]').onclick = () => { snd.tap(); buyTask(t); };
  }
  const hard = st.level > 5 && st.level % 6 === 0;
  el.play.className = 'jb-btn jb-mint jb-play' + (hard ? ' hard' : '');
  el.play.innerHTML = `Level ${st.level}${hard ? '<small>HARD LEVEL · short</small>' : ''}`;
  el.classic.innerHTML = `Stickers<small>${st.stickers.length}/30${st.newSt.length ? ' · new!' : ''}</small>`;
  const di = dailyInfo();
  el.daily.innerHTML = di.done ? `Daily ✓<small>🔥 ${di.streak} · share</small>` : `Daily${di.streak ? ' 🔥' + di.streak : ''}<small>${di.freeze ? '❄️ freeze ready' : 'new puzzle'}</small>`;
  el.albumBadge.classList.toggle('jb-hidden', !st.newSt.length);
  const nt = list[0]; marker.visible = !!nt && mode === 'home' && st.stars >= nt.cost;
  if (nt && curRoom) marker.position.copy(taskPos(curRoom, nt));
}
function showHome() {
  if (mode === 'title') game = null;
  mode = 'home'; state = 'ready'; boardG.visible = false; bgKey = ''; if (curRoom) curRoom.group.visible = true;
  for (const e of [el.phud, el.sub, el.boost]) e.classList.add('jb-hidden');
  for (const e of [el.homeTop, el.side, el.homeBot]) e.classList.remove('jb-hidden');
  placeHostInRoom(); host?.play('idle'); refreshHome();
}

// ---------------------------------------------------------------- stickers (album of 30)
const PAGES = [
  { name: 'Sweet treats', ids: ['t01', 't02', 't03', 't05', 't06', 't07', 't08', 't09', 'g08', 'g09'] },
  { name: 'Café menu', ids: ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f08', 'f09', 'g10', 'g12'] },
  { name: 'Cutie critters', ids: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'p01', 'p02', 'p04', 'g15'] },
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
  const v = $(`<div class="jb-veil jb"><div class="jb-card"><button class="jb-btn x">✕</button><h2>Sticker album</h2><div style="font-size:13px;opacity:.65;font-weight:700">${st.stickers.length}/30 · a sticker for every win · full page = 300 <i class="jc"></i></div><div class="jb-tabs"></div><div class="jb-stickers"></div><div class="jb-pagebar"></div></div></div>`);
  document.body.appendChild(v);
  const draw = () => {
    v.querySelector('.jb-tabs').innerHTML = PAGES.map((p, i) => `<button class="jb-btn ${i === albumPage ? 'on' : ''}" data-p="${i}">${p.name}</button>`).join('');
    v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { albumPage = +b.dataset.p; draw(); });
    const pg = PAGES[albumPage], have = pg.ids.filter(x => st.stickers.includes(x)).length;
    v.querySelector('.jb-stickers').innerHTML = pg.ids.map(id => `<div class="jb-st ${st.stickers.includes(id) ? '' : 'off'} ${st.newSt.includes(id) ? 'new' : ''}"><img src="./assets/thumbs/${id}.webp" alt=""></div>`).join('');
    v.querySelector('.jb-pagebar').textContent = have === 10 ? '✨ Page complete!' : `${have}/10 on this page`;
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
  return `Sprinkle Sort Daily ${d.getMonth() + 1}/${d.getDate()} 🧁 ${S.get('dMoves', 0)} pours\n🔥 ${dailyInfo().streak}-day streak\n${rows.join('\n')}`;
}
function openShare() {
  const txt = shareText(), u = new URL(location.href); u.search = '?daily=1';
  const v = $(`<div class="jb-veil jb"><div class="jb-card"><button class="jb-btn x">✕</button><h2>Daily solved!</h2><div style="font-size:14px;font-weight:700;opacity:.7">Come back tomorrow for a new one${dailyInfo().freeze ? ' · ❄️ 1 streak freeze this week' : ''}</div><div class="jb-share"></div><button class="jb-btn jb-mint" style="font-size:22px;padding:8px 30px">Share</button></div></div>`);
  v.querySelector('.jb-share').textContent = txt;
  document.body.appendChild(v);
  const close = () => v.remove();
  v.querySelector('.x').onclick = close; v.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === v) close(); });
  v.querySelector('.jb-mint').onclick = async () => {
    const text = txt + '\n' + u.href;
    try { if (navigator.share) { await navigator.share({ title: NAME, text }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text); ui.pop('Copied!', '#fff', 28, 30); } catch (e) {}
  };
}

// ---------------------------------------------------------------- the puzzle
const COAST = ['#ffc9e4', '#dccbff', '#bff2df', '#fff0a8', '#c8e6ff', '#ffd9c2'];
const flying = [];
let shake = 0;
function newGame(kind) {
  const seed = kind === 'daily' ? (D.seed || ymd()) * 7 + 3 : st.level * 7919 + 13;
  const r = rng(seed);
  const L = makeLevel(kind === 'daily' ? 14 : st.level, kind === 'daily' ? 1 : F.k(), r, { daily: kind === 'daily' });
  const g = { kind, r, level: L, J: clone(L.jars), par: L.par, moves: 0, undo: [], sel: -1, pour: null, cups: [], t0: performance.now(), log: [], extra: 0, revived: false, undos: 5, hint: null, hintT: 0, ext: null };
  g.cups = g.J.map((_, i) => mkCup(i));
  layoutCups(g, true);
  return g;
}
function mkCup(i) { return { x: 0, y: 0, tx: 0, ty: 0, lift: 0, tilt: 0, w: 0, v: 0, lid: 0, lidV: 0, shake: 0, coast: COAST[i % COAST.length], done: false }; }
function layoutCups(g, snap = false) {
  const n = g.cups.length, por = innerWidth / innerHeight < 0.8, per = por ? (n <= 3 ? 3 : 4) : 7;
  const rows = n <= per ? [n] : n <= per * 2 ? [Math.ceil(n / 2), Math.floor(n / 2)] : [Math.ceil(n / 3), Math.ceil((n - Math.ceil(n / 3)) / 2), n - Math.ceil(n / 3) - Math.ceil((n - Math.ceil(n / 3)) / 2)];
  const base0 = (rows.length - 1) * ROWY / 2 - CUP_H / 2;
  let i = 0; const shelf = [];
  rows.forEach((k, r) => { const y = base0 - r * ROWY; for (let j = 0; j < k; j++, i++) { const c = g.cups[i]; c.tx = (j - (k - 1) / 2) * SPX; c.ty = y; if (snap) { c.x = c.tx; c.y = c.ty; } } shelf.push({ x: 0, y, w: k * SPX }); });
  g.ext = { w: Math.max(...rows) * SPX + 1.2, top: base0 + CUP_H + 0.9, bot: base0 - (rows.length - 1) * ROWY - 0.8 };
  g.shelf = shelf; if (view) view.setShelves(shelf);
}
function startGame(kind) {
  if (roomBusy || !view) return;
  ui.hideStart();
  game = newGame(kind); recorded = false; busy = false;
  mode = 'play'; state = 'play'; marker.visible = false;
  for (const e of [el.homeTop, el.side, el.homeBot]) e.classList.add('jb-hidden');
  for (const e of [el.phud, el.sub, el.boost]) e.classList.remove('jb-hidden');
  view.setShelves(game.shelf);
  buildPanel(); layoutBoard(); boardG.visible = true; bgKey = ''; if (curRoom) curRoom.group.visible = false;
  game.cups.forEach((c, i) => { c.y = c.ty + 6 + i * 0.4; });
  if (host) { cam.add(host.g); hostPlayPose(); host.play('wave', true); }
  if (kind === 'adv') M.level(st.level);
  snd.music(true); snd.whoosh();
  if (kind === 'adv' && st.level === 1) setTimeout(() => say('Tap a cup, then tap another to pour! Same topping on same topping 🍓', 3800), 700);
  else if (kind === 'adv' && st.level === 2) setTimeout(() => say('Stuck? Undo is free, and an extra cup helps!', 3200), 700);
  else if (kind === 'daily') setTimeout(() => say('Today\'s cups: the same for everyone!', 3000), 700);
  else if (game.level?.hard) setTimeout(() => say('A hard one, but short. You\'ve got this!', 3000), 700);
}
const sortedN = g => g.J.filter(j => done(j)).length;
function buildPanel() {
  const g = game, L = g.level;
  el.panel.innerHTML = `<span class="lv ${L.hard ? 'hard' : ''}">${g.kind === 'daily' ? 'DAILY CUPS' : 'LEVEL ' + L.n}${L.hard ? ' · HARD' : ''}</span>
    <div class="g"><img src="${TH('s01')}" alt=""><b data-sorted>0/${L.kinds.length}</b></div><div class="sc"><small>POURS</small><b data-moves>0</b></div>`;
  refreshSub(); refreshBoosters();
}
function refreshSub() {
  const g = game; if (!g || !g.level) return;
  const s = el.panel.querySelector('[data-sorted]'); if (s) s.textContent = `${sortedN(g)}/${g.level.kinds.length}`;
  const m = el.panel.querySelector('[data-moves]'); if (m) m.textContent = g.moves;
  const stars = g.moves <= g.par ? 3 : g.moves <= Math.ceil(g.par * 1.35) ? 2 : 1;
  el.subT.textContent = `${'⭐'.repeat(stars)}${stars > 1 ? ` until ${stars === 3 ? g.par : Math.ceil(g.par * 1.35)} pours` : ''}`;
}
const PRICE = { undo: 30, hint: 60, cup: 120 };
function refreshBoosters() {
  if (!M) return;
  qa('[data-b]').forEach(b => {
    const k = b.dataset.b, lbl = b.querySelector('b'); if (!lbl) return;
    if (k === 'undo') { const n = game ? game.undos : 5; lbl.innerHTML = n ? `×${n}` : `<i class="jc"></i>${PRICE.undo}`; return; }
    if (k === 'restart') return;
    const n = st.boosts[k] || 0;
    lbl.innerHTML = n ? `×${n}` : M.coins() >= PRICE[k] ? `<i class="jc"></i>${PRICE[k]}` : '▶ free';
  });
}
async function useBooster(k) {
  if (mode !== 'play' || state !== 'play' || busy || !game || game.pour) return;
  const g = game; snd.tap();
  if (k === 'restart') { if (!g.moves) return; startGame(g.kind); return; }
  if (k === 'undo') {
    if (!g.undo.length) { say('Nothing to undo yet!', 1500); return; }
    if (g.undos > 0) g.undos--; else if (!M.spend(PRICE.undo, 'booster:undo')) { say(`More undos cost <i class="jc"></i>${PRICE.undo}`, 1800); M.shop(); return; }
    doUndo(); return;
  }
  if (k === 'cup' && g.extra >= 2) { say('Two extra cups is the most!', 1800); return; }
  let paid = false;
  if ((st.boosts[k] || 0) > 0) { st.boosts[k]--; save(); paid = true; }
  else if (M.coins() >= PRICE[k]) paid = M.spend(PRICE[k], 'booster:' + k);
  else { busy = true; paid = await M.rewarded(k === 'hint' ? 'hint' : 'moves', { what: k === 'hint' ? 'the next good pour, highlighted' : 'an extra empty cup', title: k === 'hint' ? 'Free hint' : 'Extra cup' }); busy = false; }
  if (!paid) return;
  refreshBoosters();
  if (k === 'hint') showHint(); else addCup();
}
function doUndo() {
  const g = game, prev = g.undo.pop(); while (prev.length < g.J.length) prev.push([]);
  g.J = prev; g.sel = -1; g.cups.forEach((c, i) => { c.v += 3; if (!done(g.J[i])) { c.done = false; c.lid = 0; } });
  snd.whoosh(); refreshSub(); refreshBoosters();
}
function addCup() {
  const g = game; g.extra++; g.J.push([]); g.undo.forEach(u => u.push([])); const c = mkCup(g.cups.length); g.cups.push(c);
  layoutCups(g); c.x = c.tx; c.y = c.ty + 5; layoutBoard(); snd.placeDecor(); say('An extra cup! ✨', 1500);
}
function showHint() {
  const g = game, sol = solve(g.J, 40000);
  if (!sol || !sol.length) { say('Hmm… try Undo or an extra cup!', 2200); return; }
  g.hint = sol[0]; g.hintT = 4; snd.sparkle();
}
async function tapCup(i) {
  const g = game; if (!g || state !== 'play' || busy || g.pour) return;
  const J = g.J; g.hintT = 0;
  if (g.sel < 0) { if (!J[i].length || done(J[i])) { g.cups[i].v += 4; snd.bad(); return; } g.sel = i; snd.pick(); buzz(6); return; }
  if (g.sel === i) { g.sel = -1; snd.drop(); return; }
  const a = g.sel;
  if (!canPour(J, a, i)) { g.cups[i].shake = 0.45; snd.bad(); buzz(12); if (J[i].length && !done(J[i])) { g.sel = i; snd.pick(); } else g.sel = -1; return; }
  g.sel = -1; doPour(a, i);
}
function doPour(a, b) {
  const g = game, J = g.J;
  g.undo.push(clone(J)); const before = J[a].slice(), k = top(J[a]); const n = pour(J, a, b); g.moves++;
  g.log.push(done(J[b]) ? '🧁' : '🟪');
  g.pour = { a, b, n, k, t: 0, before, bLen: J[b].length - n, side: g.cups[a].x > g.cups[b].x ? 1 : -1 };
  snd.pick(); refreshSub();
}
function pourDone() {
  const g = game, p = g.pour; g.pour = null;
  const cb = g.cups[p.b]; cb.v += 5;
  if (done(g.J[p.b]) && !cb.done) {
    cb.done = true; cb.lidV = 9; snd.clear(2, sortedN(g)); buzz(25); shake = 0.35;
    const [sx, sy] = toScreen(cb.x, cb.y + CUP_H + 0.4);
    const d = $(`<div class="jb-combo" style="top:${sy}px;left:${sx}px;font-size:34px">${['Sorted!', 'Yummy!', 'So cute!', 'Sweet!', 'Perfect!'][(Math.random() * 5) | 0]}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1100);
    view.P.burst(cb.x, cb.y + CUP_H + 0.3, 0.6, [KIND[p.k].c, KIND[p.k].c2, '#ffffff', '#fff2a0'], 26, { speed: 4, up: 3, size: 1.3, life: 0.9, grav: 6 });
    if (Math.random() < 0.5) host?.play(Math.random() < 0.5 ? 'cheer' : 'jump', true);
  } else snd.place(1);
  refreshSub();
  if (won(g.J)) { finish(true); return; }
  if (stuck(g.J)) finish(false);
}
async function finish(won) {
  if (recorded) return; recorded = true; busy = true; state = 'ending';
  const g = game, ms = performance.now() - g.t0;
  await wait(won ? 900 : 500);
  el.sub.classList.add('jb-hidden');
  winReward.innerHTML = ''; winOffer.classList.add('jb-hidden'); loseOffer.classList.add('jb-hidden'); undoOffer.classList.add('jb-hidden');
  kitShare && (kitShare.style.display = g.kind === 'daily' ? 'none' : '');
  if (won) {
    if (!g.flowDone) F.level(true); g.flowDone = true;
    const stars = g.kind === 'daily' ? 3 : g.moves <= g.par ? 3 : g.moves <= Math.ceil(g.par * 1.35) ? 2 : 1;
    const coins = g.kind === 'daily' ? 60 : 20 + stars * 5;
    st.stars += stars; st.earned += stars; st.wins++;
    if (g.kind === 'adv') { st.level++; if (st.level % 5 === 0) { const k = ['hint', 'cup'][(st.level / 5) % 2]; st.boosts[k] = (st.boosts[k] || 0) + 1; } }
    if (g.kind === 'daily') {
      const today = dayNum();
      if (st.dLast !== today) {
        if (st.dLast === today - 1) st.dStreak++;
        else if (st.dLast === today - 2 && st.dFreezeWk !== weekOf(today)) { st.dStreak++; st.dFreezeWk = weekOf(today); setTimeout(() => ui.pop('❄️ Streak freeze used!', '#fff', 26, 30), 1400); }
        else st.dStreak = 1;
        st.dLast = today; S.set('dGrid', g.log); S.set('dMoves', g.moves);
      }
    }
    const stk = dropSticker(g.r);
    save(); M.add(coins, 'win'); D.won(stars, 'earned ⭐'); B.submit(stars, { ms });
    lastWin = { stars, coins, stk, daily: g.kind === 'daily' };
    winStars.querySelectorAll('i').forEach(i => i.classList.remove('on'));
    winReward.innerHTML = `<span>+${coins} <i class="jc"></i></span>${stk ? `<span><img src="./assets/thumbs/${stk.id}.webp" alt="">New sticker!</span>` : ''}${stk && stk.bonus ? `<span>Page done +${stk.bonus} <i class="jc"></i></span>` : ''}`;
    if (g.kind === 'daily') { winOffer.innerHTML = 'Share your cups<small>spoiler-free</small>'; winOffer.className = 'jb-btn jb-pink jb-offer'; winOffer.onclick = () => openShare(); winOffer.classList.remove('jb-hidden'); }
    else { winOffer.innerHTML = `▶ Double coins<small>watch a short video · +${coins} coins</small>`; winOffer.className = 'jb-btn jb-sky jb-offer'; winOffer.onclick = async () => { winOffer.disabled = true; if (await M.rewarded('double', { what: `${coins} more coins (${coins * 2} in total)` })) { M.add(coins, 'double'); winReward.firstChild.innerHTML = `+${coins * 2} <i class="jc"></i>`; snd.coin(); } winOffer.classList.add('jb-hidden'); winOffer.disabled = false; }; winOffer.classList.remove('jb-hidden'); }
    ui.els.win.querySelector('p').firstChild.textContent = g.kind === 'daily' ? '' : 'LEVEL ';
    ui.win(g.kind === 'daily' ? 'DAILY CUPS' : st.level - 1, g.kind === 'daily' ? `🔥 ${st.dStreak}-day streak · ${g.moves} pours` : `${g.moves} pours · +${stars} ⭐ for the café`); state = 'won';
    snd.win(); host?.play('cheer', true);
    for (let i = 0; i < stars; i++) setTimeout(() => { winStars.children[i].classList.add('on'); snd.star(i); }, 900 + i * 280);
    for (let i = 0; i < 4; i++) setTimeout(() => view.P.burst((Math.random() - 0.5) * 6, g.ext.top - 1 - Math.random() * 3, 1, CONF, 40, { speed: 7, up: 4, size: 1.6, life: 1.4, grav: 6 }), i * 180);
  } else {
    const frac = sortedN(g) / g.level.kinds.length;
    if (!g.flowDone) F.level(false, frac); g.flowDone = true; snd.lose(); say(frac > 0.5 ? 'Sooo close! ♡' : 'Aww! Try again? ♡', 2000);
    ui.lose('No pours left!', 'Tap to try again'); state = 'lost';
    if (g.undo.length) undoOffer.classList.remove('jb-hidden');
    if (g.extra < 2) { loseOffer.innerHTML = '▶ Extra cup<small>watch a short video · keep this board</small>'; loseOffer.onclick = () => revive(); const gg = g; setTimeout(() => { if (game === gg && state === 'lost') loseOffer.classList.remove('jb-hidden'); }, 1300); }
  }
  busy = false;
}
function resumePlay() { ui.els.lose.classList.add('hc-hidden'); loseOffer.classList.add('jb-hidden'); undoOffer.classList.add('jb-hidden'); el.sub.classList.remove('jb-hidden'); state = 'play'; recorded = false; game.flowDone = false; }
async function revive() {
  loseOffer.disabled = true; const ok = await M.rewarded('revive', { what: 'an extra empty cup to keep going', title: 'Extra cup' }); loseOffer.disabled = false;
  if (!ok) return;
  resumePlay(); addCup(); host?.play('cheer', true);
}
function undoFromLose() { if (!game || !game.undo.length) return; resumePlay(); doUndo(); }
function quitToHome() { game = null; showHome(); }
ui.onTap(which => {
  snd.unlock();
  if (which === 'start') { showHome(); if (D.isDaily && st.dLast !== dayNum()) setTimeout(() => startGame('daily'), 300); snd.music(true); setTimeout(() => say(doneList().length ? 'Welcome back! ✨' : 'Let\'s open our café! Win levels for ⭐ stars ✨', 3200), 400); }
  else if (which === 'win') {
    const n = lastWin ? lastWin.stars : 0; quitToHome(); el.starN.textContent = st.stars - n;
    const r = el.starPill.getBoundingClientRect(); let shown = st.stars - n;
    for (let i = 0; i < n; i++) setTimeout(() => { const s = $(`<img class="jb-fly" src="${TH('m03')}" alt="">`); document.body.appendChild(s);
      flying.push({ img: s, sx: innerWidth / 2, sy: innerHeight * 0.45, tx: r.left + 20, ty: r.top + 20, t: 0, d: 0.6, cx: innerWidth * 0.2, cy: innerHeight * 0.3, upd: () => { shown++; el.starN.textContent = shown; el.starPill.classList.remove('bump'); void el.starPill.offsetWidth; el.starPill.classList.add('bump'); snd.coin(); if (shown === st.stars) refreshHome(); } }); }, 250 + i * 220);
    const nt = nextTasks()[0]; setTimeout(() => say(nt && st.stars >= nt.cost ? `Next up: ${nt.name.toLowerCase()}! Tap ⭐` : lastWin?.stk ? 'A new sticker for the album! 📖' : 'More stars, more café!'), 900);
    setTimeout(() => M.breakAd('level-end', { level: st.level }), 1500);
  } else if (which === 'lose') {
    const k = game?.kind; quitToHome();
    setTimeout(() => startGame(k || 'adv'), 300);
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
function cupAt(p) {
  let best = -1, bd = 1e9;
  game.cups.forEach((c, i) => { const dx = Math.abs(p.x - c.tx), dy = p.y - c.ty; if (dx < SPX * 0.55 && dy > -0.9 && dy < CUP_H + 1.2 && dx < bd) { bd = dx; best = i; } });
  return best;
}
addEventListener('pointerdown', e => {
  if (e.target !== R.domElement) return; snd.unlock();
  if (mode === 'home') { drag0 = { x: e.clientX, yaw: yawT }; return; }
  if (mode !== 'play' || state !== 'play' || busy || !game) return;
  const p = boardPoint(e); if (!p) return;
  const i = cupAt(p); if (i >= 0) tapCup(i); else if (game.sel >= 0) { game.sel = -1; snd.drop(); }
});
let drag0 = null, yaw = 0, yawT = 0;
addEventListener('pointermove', e => { if (mode === 'home' && drag0) yawT = Math.max(-0.45, Math.min(0.45, drag0.yaw - (e.clientX - drag0.x) / innerWidth * 1.4)); });
addEventListener('pointerup', () => { drag0 = null; });

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
  // looking at the back wall from the middle of the room: the window and the beams frame the board
  const por = innerWidth / innerHeight < 0.8;
  return { pos: new V3(def.win.x * 0.35, 2.4, por ? 11.5 : 11), tgt: new V3(def.win.x * 0.35, 2.5, -4), off: 0 };
}

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); layoutBoard(); hostPlayPose(); if (mode !== 'play') placeHostInRoom(); }
addEventListener('resize', resize);
let T = 0, perf = {};
R.info.autoReset = false;
const blinkOf = i => ((T * 0.5 + (i * 7 % 11) * 0.41) % 4.4) < 0.13;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function drawBoard(dt) {
  const g = game; view.begin();
  const sdt = Math.min(dt, 1 / 40), P = g.pour;
  // pour timeline: lift + fly (0.24 s) → pour (0.14 s per layer + 0.1) → return (0.22 s)
  let p1 = 0, p2 = 0, p3 = 0;
  if (P) {
    P.t += dt; const T1 = 0.24, T2 = 0.14 * P.n + 0.1, T3 = 0.22;
    p1 = Math.min(1, P.t / T1); p2 = Math.min(1, Math.max(0, (P.t - T1) / T2)); p3 = Math.min(1, Math.max(0, (P.t - T1 - T2) / T3));
    if (p2 > 0 && p2 < 1 && Math.random() < 0.9) {   // the sprinkle stream
      const cb = g.cups[P.b], k = KIND[P.k];
      view.P.burst(cb.x, cb.y + CUP_H + 0.55, 0.1, [k.c, k.c2, k.c, '#ffffff'], 3, { speed: 0.6, up: -2.5, size: 1.1, life: 0.4, grav: 14, spread: 0.25, kind: 2 });
    }
    if (p2 > 0 && !P.sfx) { P.sfx = true; for (let j = 0; j < P.n; j++) setTimeout(() => snd.pop(j + 2), j * 140); }
    if (P.t >= T1 + T2 + T3) pourDone();
  }
  g.cups.forEach((c, i) => {
    c.v += (-240 * c.w - 10 * c.v) * sdt; c.w += c.v * sdt;
    c.x += (c.tx - c.x) * Math.min(1, dt * 10); c.y += (c.ty - c.y) * Math.min(1, dt * 8);
    if (c.shake > 0) c.shake = Math.max(0, c.shake - dt);
    if (c.done) { c.lidV += (-200 * (c.lid - 1) - 9 * c.lidV) * sdt; c.lid += c.lidV * sdt; } else c.lid = Math.max(0, c.lid - dt * 4);
    const sel = g.sel === i, hint = g.hintT > 0 && g.hint && (g.hint[0] === i || g.hint[1] === i);
    c.lift += ((sel ? 0.6 : hint && g.hint[0] === i ? 0.25 + Math.sin(T * 8) * 0.15 : 0) - c.lift) * Math.min(1, dt * 14);
    let x = c.x + Math.sin(c.shake * 40) * c.shake * 0.35, y = c.y + c.lift, tilt = 0;
    // contents to show
    let list = g.J[i].map(k => ({ k, s: 1 }));
    if (P && i === P.a) {
      list = P.before.map((k, j) => ({ k, s: j >= P.before.length - P.n ? 1 - Math.min(1, Math.max(0, p2 * P.n - (P.before.length - 1 - j))) : 1 }));
      const cb = g.cups[P.b], tl = 1.25 * P.side, mx = -Math.sin(tl) * CUP_H, my = Math.cos(tl) * CUP_H;
      const ox = cb.x - mx + P.side * 0.15, oy = cb.y + CUP_H + 0.75 - my;
      const k1 = easeOut(p1) * (1 - easeOut(p3));
      x = x + (ox - x) * k1; y = y + (oy - y) * k1; tilt = tl * k1;
    } else if (P && i === P.b) list = g.J[i].map((k, j) => ({ k, s: j >= P.bLen ? Math.min(1, Math.max(0, p2 * P.n - (j - P.bLen))) : 1 }));
    let face = blinkOf(i) ? 3 : 0;
    if (!g.J[i].length && !(P && i === P.a)) face = 2;
    if (sel || (P && i === P.a)) face = 4;
    if (hint) face = 1;
    if (c.done) face = 1;
    view.cup(x, y, 0, tilt, c.w + Math.sin(T * 2.4 + i) * 0.012, list, face, c.done ? c.lid : 0, c.coast);
    if (hint && Math.random() < 0.15) view.P.burst(x, y + CUP_H + 0.4, 0.5, ['#fff6a0', '#ffffff'], 1, { speed: 1, up: 1.5, size: 0.9, life: 0.6, grav: 0, kind: 0 });
  });
  if (g.hintT > 0) g.hintT -= dt;
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
  const inPlay = mode === 'play' || mode === 'title';
  hemi.intensity = inPlay ? 0.75 : 0.55 + 0.25 * p; sun.intensity = inPlay ? 1.7 : 1.3 + 0.6 * p; sun.color.set(inPlay ? '#fff6fb' : mixHex('#e2dcec', '#fff1f8', p));
  scene.environmentIntensity = inPlay ? 0.42 : 0.35 + 0.15 * p;
  C.grade.uniforms.uSat.value = inPlay ? 1.15 : 0.95 + 0.25 * p;
  C.grade.uniforms.uContrast.value = inPlay ? 1.04 : 1.1;
  const lightsOn = curRoom && doneList().includes('lights'); warm.intensity += ((lightsOn && !inPlay ? 3 : 0) - warm.intensity) * dt * 2;
  if (curRoom?.bulbs && lightsOn) curRoom.bulbs.material.color.setScalar(0.9 + Math.sin(T * 3) * 0.12);
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
async function boot() {
  let n = 0; const total = 4; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  view = createView(boardG); tick();
  const hp = loadHost().then(h => { tick(); return h; });
  await enterRoom(st.room, true); tick();
  host = await hp; placeHostInRoom(); tick();
  refreshHome();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  mode = 'title'; state = 'ready'; titleShow();
  for (let k = 0; k < ROOMS.length; k++) if (k !== st.room) setTimeout(() => ensureRoom(k), 5000 + k * 1500);
}

// ---------------------------------------------------------------- title showcase: a shelf of sorted cups with their lids on
function titleShow() {
  game = newGame('adv');
  game.J = [[0, 0, 0, 0], [6, 6, 6, 6], [3, 3, 3, 3], [2, 2, 2, 2], [1, 1, 1, 1], [4, 4, 4, 4], [5, 5, 5, 5], [7, 7], []];
  game.cups = game.J.map((_, i) => mkCup(i)); layoutCups(game, true);
  game.cups.forEach((c, i) => { if (done(game.J[i])) { c.done = true; c.lid = 1; } });
  view.setShelves(game.shelf);
  layoutBoard(); boardG.visible = true; if (curRoom) curRoom.group.visible = false; if (host) { cam.add(host.g); hostPlayPose(); host.play('wave'); }
}
const toScreen = (x, y) => { const v = new V3(x, y, 0.3); boardG.updateMatrixWorld(); boardG.localToWorld(v); v.project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };

// ---------------------------------------------------------------- test hooks
let botBusy = false, botNext = 0;
window.__game = {
  autostart() { if (mode !== 'title' || !view) return false; ui.els.start.dispatchEvent(new Event('pointerdown')); setTimeout(() => startGame(D.seed ? 'daily' : 'adv'), 350); },
  get state() { return state === 'ending' ? 'play' : state; }, get level() { return st.level; }, get score() { return st.earned; },
  get stars() { return st.stars; }, get perf() { return perf; }, get room() { return st.room; }, get coins() { return M ? M.coins() : 0; }, get stickers() { return st.stickers.length; },
  get tasksDone() { return Object.values(st.done).reduce((a, l) => a + l.length, 0); }, get mode() { return mode; }, get game() { return game; },
  start(kind) { startGame(kind); }, tap(i) { tapCup(i); }, cupXY(i) { const c = game.cups[i]; return toScreen(c.tx, c.ty + CUP_H * 0.5); }, toScreen,
  bot() {
    if (!view || botBusy) return;
    if (mode === 'title') { ui.hideStart(); ui.els.start.dispatchEvent(new Event('pointerdown')); return; }
    if (mode === 'play') {
      const g = game; if (state !== 'play' || busy || g.pour || performance.now() < botNext) return;
      const sol = solve(g.J, 30000);
      if (!sol || !sol.length) { if (g.undo.length) doUndo(); else if (stuck(g.J)) finish(false); botNext = performance.now() + 800; return; }
      const [a, b] = sol[0]; botBusy = true; if (g.sel !== a) { g.sel = -1; tapCup(a); }
      setTimeout(() => { if (game === g && g.sel === a) tapCup(b); botBusy = false; botNext = performance.now() + 700; }, 350);
      return;
    }
    if (mode === 'home') {
      if (roomBusy || flying.length || document.querySelector('.jb-veil') || document.querySelector('.apm-sheet, .apm-ad')) return;
      const nt = nextTasks()[0];
      if (!nt && st.room < ROOMS.length - 1) { botBusy = true; goNextRoom().finally(() => botBusy = false); return; }
      if (nt && st.stars >= nt.cost) { buyTask(nt); return; }
      startGame('adv');
    }
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.textContent = 'Could not load Sprinkle Sort'; });

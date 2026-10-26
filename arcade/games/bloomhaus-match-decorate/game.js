// Bloomhaus: Match & Decorate — original match-3 + home makeover. Match glossy gems, earn stars, and spend them to
// restore a dusty house room by room (living room, bedroom, garden, music room) with Granny Gloss cheering you on.
// Art: AI-generated 3D library (assets/*.glb, our own) + Hero Lab character; rooms, board, UI, sound: code.
import { THREE, createUI, store, loop, buzz, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';
import { loader, piece } from './assets.js';
import { ROOMS, buildRoom } from './rooms.js';
import { makeLevel } from './levels.js';
import { createMatch3 } from './m3.js';
import { snd } from './audio.js';
import { demo } from './kit/demo.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Bloomhaus: Match & Decorate', PI = Math.PI, V3 = THREE.Vector3;
const S = store('bloomhaus');
const st = { level: S.get('level', 1), stars: S.get('stars', 0), room: S.get('room', 0), done: S.get('done', {}), boosts: S.get('boosts', { rocket: 1, bomb: 1, disco: 0 }), earned: S.get('earned', 0), wins: S.get('wins', 0) };
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('bloomhaus');
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.localClippingEnabled = true; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.24, bloomThreshold: 0.92, bloomRadius: 0.45, exposure: 0.84, envIntensity: 0.55, lite: LITE, grade: { sat: 1.15, contrast: 1.04, vignette: 0.1, grain: 0 } });
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 128; bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
const hemi = new THREE.HemisphereLight('#fff4e6', '#e2c6ee', 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe9c8', 2.4); sun.position.set(-7, 15, 10); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; scene.add(sun, sun.target);
const fill = new THREE.PointLight('#ffb37a', 0, 9, 1.6); fill.position.set(-3.2, 1.6, -1.4); scene.add(fill);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Bloomhaus<small>MATCH &amp; DECORATE</small>', hint: 'Tap to start', hand: '✨', progress: false, score: false, button: 'Play ▶' });
ui.els.start.classList.add('bh-title');
const D = daily('bloomhaus', ui, { name: NAME });
const B = worldBoard({ game: 'bloomhaus', label: 'Stars earned', limits: { maxRun: 6, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr', accent: '#ff8fb1' });
ui.els.win.querySelector('h1').textContent = 'COMPLETE!';
const winStars = $('<div class="bh-winstars"><i>⭐</i><i>⭐</i><i>⭐</i></div>'); ui.els.win.querySelector('h1').after(winStars);
const loadEl = document.getElementById('bh-load'), loadBar = loadEl.querySelector('b');

const hud = $(`<div class="bh">
  <div id="bh-room-top" class="bh-hidden"><div class="bh-stars"><i>⭐</i><span>0</span></div><div class="bh-roomname"><b></b><div class="bh-prog"><i></i></div></div></div>
  <button id="bh-mute" class="bh-btn bh-hidden" aria-label="Sound">🔊</button>
  <div id="bh-room-bot" class="bh-hidden"><div class="bh-tasks"></div><button class="bh-btn bh-green bh-play"></button></div>
  <div id="bh-mhud" class="bh-hidden"><div class="bh-moves"><small>MOVES</small><b>0</b></div><div class="bh-goals"></div></div>
  <button id="bh-quit" class="bh-btn bh-hidden" aria-label="Back to the house">🏠</button>
</div>`);
document.body.appendChild(hud);
const el = { roomTop: hud.querySelector('#bh-room-top'), roomBot: hud.querySelector('#bh-room-bot'), stars: hud.querySelector('.bh-stars'), starsN: hud.querySelector('.bh-stars span'),
  roomName: hud.querySelector('.bh-roomname b'), prog: hud.querySelector('.bh-prog i'), tasks: hud.querySelector('.bh-tasks'), play: hud.querySelector('.bh-play'), mute: hud.querySelector('#bh-mute'),
  mhud: hud.querySelector('#bh-mhud'), moves: hud.querySelector('.bh-moves'), movesN: hud.querySelector('.bh-moves b'), goals: hud.querySelector('.bh-goals'), quit: hud.querySelector('#bh-quit') };
el.mute.textContent = snd.muted ? '🔇' : '🔊';
el.mute.onclick = () => { el.mute.textContent = snd.toggle() ? '🔇' : '🔊'; };

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', P = null, M3 = null, host = null, rooms = {}, roomBusy = false, popEl = null, dailyMode = !!D.seed, curLevel = null, runT0 = 0, shownStars = st.stars, recorded = false, lastStars = 0;
const ICON = {};
const roomOf = () => ROOMS[Math.min(st.room, ROOMS.length - 1)];
const doneList = (def = roomOf()) => st.done[def.id] || [];
const nextTasks = (def = roomOf()) => def.tasks.filter(t => !doneList(def).includes(t.id));
const allDone = () => st.room >= ROOMS.length - 1 && !nextTasks(ROOMS[ROOMS.length - 1]).length;

// ---------------------------------------------------------------- tweens + world particles
const tweens = [];
const anim = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
const WP = (() => {
  const N = 600, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); m.count = 0; m.frustumCulled = false; scene.add(m);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
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

// task marker: a bobbing gold arrow + glow ring
const marker = new THREE.Group();
{ const gm = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ff9d00', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 20), gm); cone.rotation.x = PI; cone.position.y = 0.6; marker.add(cone);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), gm); ball.position.y = 1.05; marker.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.8, toneMapped: false })); ring.rotation.x = PI / 2; ring.name = 'ring'; marker.add(ring);
  marker.visible = false; scene.add(marker); }

// ---------------------------------------------------------------- background + atmosphere (shabby → beautiful)
const atm = { cur: 0, target: 0, room: '' };
const BG = { living: ['#ffd6e4', '#fff0d9'], bedroom: ['#f6d4f2', '#ffe9f1'], garden: ['#a9dcff', '#fff4d8'], dining: ['#d4efe0', '#fff3dc'] };
let bgKey = '';
function mixHex(a, b, k) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString(); }
function paintBg(p, matchDim) {
  const pal = BG[roomOf().id] || BG.living, top = mixHex('#c9c4cc', pal[0], p), bot = mixHex('#e4dccf', pal[1], p);
  const key = top + bot + matchDim; if (key === bgKey) return; bgKey = key;
  const x = bgCanvas.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  const r = rng(7); for (let i = 0; i < 16; i++) { const cx = r() * 128, cy = r() * 256, rad = 6 + r() * 22, rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); rg.addColorStop(0, `rgba(255,255,255,${0.18 + r() * 0.2})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  const v = x.createRadialGradient(64, 120, 30, 64, 128, 170); v.addColorStop(0, 'rgba(255,255,255,.25)'); v.addColorStop(1, 'rgba(120,60,110,.12)'); x.fillStyle = v; x.fillRect(0, 0, 128, 256); bgTex.needsUpdate = true;
}
function roomProgress(def = roomOf()) { return doneList(def).length / def.tasks.length; }

// ---------------------------------------------------------------- camera
const camCur = { pos: new V3(8, 9, 18), tgt: new V3(0, 1.5, 0), off: 0 };
let yaw = 0, yawT = 0, focus = null, focusT = 0, bob = 0;
function roomPose() {
  const def = roomOf(), por = innerWidth / innerHeight < 0.8;
  const tgt = new V3(def.garden ? 0 : -0.3, def.garden ? 0.7 : 1.6, def.garden ? 0 : -0.4);
  const dir = new V3(Math.sin(0.55 + yaw), mode === 'match' ? 0.42 : 0.78, Math.cos(0.55 + yaw)).normalize();
  const ttl = mode === 'title', topPx = ttl ? innerHeight * 0.3 : 64, botPx = ttl ? innerHeight * 0.22 : (el.roomBot.offsetHeight || 230) + 18, free = Math.max(200, innerHeight - topPx - botPx);
  const tanV = Math.tan(cam.fov * PI / 360), tanH = tanV * cam.aspect;
  const rw = def.W * 0.6 + 0.4, rh = def.garden ? 5.0 : 5.6;
  let dist = Math.max(rw / (tanH * 0.98), rh / (tanV * free / innerHeight));
  if (focus && focusT > 0) { tgt.lerp(focus, 0.35 * focusT); dist *= 1 - 0.18 * focusT; }
  if (mode === 'match') { tgt.set(def.garden ? 0 : -0.8, def.garden ? 1.2 : 2.1, def.garden ? -0.5 : -1.2); dist = def.garden ? 12 : 10; }
  const centerPx = topPx + free / 2;
  return { pos: tgt.clone().addScaledVector(dir, dist), tgt, off: innerHeight / 2 - centerPx };
}

// ---------------------------------------------------------------- match board (attached to the camera)
const BOARD_D = 3;
const boardG = new THREE.Group(); cam.add(boardG); boardG.visible = false;
const dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffd9e8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
dimPlane.position.z = -BOARD_D - 0.6; dimPlane.renderOrder = -1; cam.add(dimPlane);
let shake = 0;
function layoutBoard() {
  if (!M3) return;
  const [W, H] = M3.size, por = innerWidth / innerHeight < 0.8;
  const vh = 2 * BOARD_D * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const top = (el.mhud.getBoundingClientRect().bottom || 100) + 10, bot = por ? Math.min(190, innerHeight * 0.21) : 30;
  const availH = innerHeight - top - bot, availW = innerWidth * (por ? 0.97 : 0.62);
  const s = Math.min(availW / innerWidth * vw / (W + 0.6), availH / innerHeight * vh / (H + 0.6));
  const cy = top + availH / 2;
  boardG.position.set(por ? 0 : vw * 0.06, (0.5 - cy / innerHeight) * vh, -BOARD_D); boardG.scale.setScalar(s);
  const dv = BOARD_D + 0.6, dvh = 2 * dv * Math.tan(cam.fov * PI / 360); dimPlane.scale.set(dvh * cam.aspect * 1.1, dvh * 1.1, 1);
}
function hostMatchPose() {
  if (!host) return;
  const por = innerWidth / innerHeight < 0.8, d = 3.4, vh = 2 * d * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const h = por ? vh * 0.2 : vh * 0.55;
  host.g.position.set(por ? -vw * 0.3 : -vw * 0.33, -vh / 2 + (por ? vh * 0.012 : vh * 0.06), -d); host.g.scale.setScalar(h / host.h); host.g.rotation.set(0.12, 0.35, 0);
}

// ---------------------------------------------------------------- host (Hero Lab character)
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
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 2600) {
  if (!host) return; bubbleEl?.remove(); bubbleEl = $(`<div class="bh-bubble">${text}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000;
}
const headPos = new V3();
function placeBubble() {
  if (!bubbleEl) return;
  host.g.getWorldPosition(headPos); const sc = new V3(); host.g.getWorldScale(sc); headPos.y += host.h * sc.y * 1.05;
  headPos.project(cam); const x = (headPos.x + 1) / 2 * innerWidth, y = (1 - headPos.y) / 2 * innerHeight;
  bubbleEl.style.left = Math.max(100, Math.min(innerWidth - 100, x)) + 'px'; bubbleEl.style.top = Math.max(70, y) + 'px';
}

// ---------------------------------------------------------------- loading
async function renderIcons() {
  const r2 = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); r2.setPixelRatio(1); r2.setSize(128, 128);
  r2.toneMapping = THREE.ACESFilmicToneMapping; r2.outputColorSpace = THREE.SRGBColorSpace;
  const s2 = new THREE.Scene(), pm = new THREE.PMREMGenerator(r2), env = pm.fromScene(new RoomEnvironment(), 0.04).texture; s2.environment = env; s2.environmentIntensity = 0.8;
  s2.add(new THREE.HemisphereLight('#fff', '#e8d8ff', 1.4)); const dl = new THREE.DirectionalLight('#fff', 2.2); dl.position.set(-2, 3, 4); s2.add(dl);
  const c2 = new THREE.PerspectiveCamera(30, 1, 0.1, 10); c2.position.set(0, 0, 2.15);
  P.colors.forEach((p, i) => { const m = new THREE.Mesh(p.geo, p.mat); m.rotation.y = 0.15; s2.add(m); r2.render(s2, c2); ICON['c' + i] = r2.domElement.toDataURL(); m.visible = false; });
  env.dispose(); pm.dispose(); r2.dispose(); r2.forceContextLoss();
  for (const [k, id] of [['crate', 'm11'], ['ice', 'm12'], ['rocket', 'm09'], ['bomb', 'm07'], ['disco', 'm08'], ['prop', 'm10']]) ICON[k] = `./assets/thumbs/${id}.webp`;
}
function facet(geo) {   // m05 came out as a flat sphere: give it cut-gem facets (normals snapped to an icosahedron)
  const ico = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), ip = ico.attributes.position, fn = [];
  for (let i = 0; i < ip.count; i += 3) { const a = new V3().fromBufferAttribute(ip, i), b = new V3().fromBufferAttribute(ip, i + 1), c = new V3().fromBufferAttribute(ip, i + 2); fn.push(a.add(b).add(c).normalize()); }
  const g = geo.clone(), pos = g.attributes.position, nrm = new Float32Array(pos.count * 3), v = new V3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).normalize(); let best = fn[0], bd = -2; for (const n of fn) { const d = n.dot(v); if (d > bd) { bd = d; best = n; } } nrm[i * 3] = best.x; nrm[i * 3 + 1] = best.y; nrm[i * 3 + 2] = best.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); return g;
}
async function boot() {
  let n = 0; const total = 15; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  const ids = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm09', 'm07', 'm10', 'm08', 'm11', 'm12'];
  const got = await Promise.all(ids.map(id => piece(id, 'mid').then(p => { tick(); return p; })));
  const colors = got.slice(0, 6).map(p => ({ ...p }));
  for (const p of colors) { p.mat = p.mat.clone(); p.mat.envMapIntensity = 1.35; p.mat.emissiveMap = p.mat.map; p.mat.emissive = new THREE.Color('#ffffff'); p.mat.emissiveIntensity = 0.05; }
  const m5 = colors[4];
  m5.geo = facet(m5.geo);
  m5.mat = new THREE.MeshPhysicalMaterial({ map: got[4].mat.map, color: '#b979ff', roughness: 0.1, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.4, iridescenceIOR: 1.7,
    emissive: new THREE.Color('#4a0f8f'), emissiveIntensity: 0.5, envMapIntensity: 2.0 });
  P = { colors, rocket: got[6], bomb: got[7], prop: got[8], disco: got[9], crate: got[10], ice: got[11] };
  M3 = createMatch3({ group: boardG, P, snd, hooks });
  await renderIcons(); tick();
  const hp = loadHost().then(h => { tick(); return h; });
  await enterRoom(st.room, true); tick();
  host = await hp; placeHostInRoom(); tick();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  mode = 'title'; state = 'ready';
  for (const k of Object.keys(ROOMS)) if (+k !== st.room) setTimeout(() => ensureRoom(+k), 4000 + k * 1500);   // warm up the other rooms
}

// ---------------------------------------------------------------- rooms
async function ensureRoom(i) {
  if (!rooms[i]) rooms[i] = buildRoom(ROOMS[i]).then(Rm => { Rm.group.visible = false; scene.add(Rm.group); for (const id of (st.done[ROOMS[i].id] || [])) applyTask(Rm, ROOMS[i].tasks.find(t => t.id === id), true); return Rm; });
  return rooms[i];
}
let curRoom = null;
async function enterRoom(i, first = false) {
  const Rm = await ensureRoom(i);
  if (curRoom) curRoom.group.visible = false;
  curRoom = Rm; Rm.group.visible = true;
  if (!first) { camCur.pos.add(new V3(6, 8, 8)); }
  placeHostInRoom(); refreshRoomHUD(); atm.target = roomProgress(); if (first) atm.cur = atm.target;
  fill.intensity = 0;
}
function placeHostInRoom() {
  if (!host || !curRoom) return;
  const h = roomOf().host; curRoom.group.add(host.g); host.g.position.set(h[0], h[1], h[2]); host.g.rotation.set(0, 0.5 + h[3], 0); host.g.scale.setScalar(2.75 / host.h);
}
function applyTask(Rm, t, instant) {
  if (!t) return;
  if (t.item) { const m = Rm.items[t.id]; m.visible = true; m.scale.copy(m.userData.base); m.position.y = t.at[1]; }
  else Rm.apply[t.kind]?.(true);
}
function taskPos(Rm, t) {
  const d = Rm.def;
  if (t.item) return new V3(t.at[0], t.at[1] + (t.hang ? -0.3 : t.size * (t.sy ? 0.12 : 0.85)) + 0.2, t.at[2]);
  if (t.kind === 'walls') return new V3(d.garden ? -1 : 0.6, d.H * (d.garden ? 1.0 : 0.62), -d.D / 2 + 0.6);
  if (t.kind === 'floor') return new V3(1.2, 0.05, 1.6);
  if (t.kind === 'window') return new V3(d.window.x, d.window.y - 0.4, -d.D / 2 + 0.6);
  if (t.kind === 'clutter') return new V3(d.clutter[0][0], 1.6, d.clutter[0][2]);
  return new V3();
}
async function animateTask(Rm, t) {
  const pos = taskPos(Rm, t);
  if (t.item) {
    const m = Rm.items[t.id], base = m.userData.base.clone(), y0 = t.at[1]; m.visible = true;
    snd.whoosh();
    await anim(0.75, k => { const e = easeBack(Math.min(1, k * 1.1)); m.scale.copy(base).multiplyScalar(Math.max(0.01, e)); m.position.y = y0 + (1 - Math.min(1, k * 1.4)) * 2.2; m.rotation.y = (t.rot || 0) + (1 - k) * 1.2; });
    m.scale.copy(base); m.position.y = y0; m.rotation.y = t.rot || 0;
    snd.place(); WP.burst(new V3(t.at[0], y0 + 0.3, t.at[2]), ['#fff6c2', '#ffffff', '#ffd23f'], 26, { speed: 3.5, up: 2.5, size: 1.3, life: 0.9, spread: t.size * 0.6 });
  } else if (t.kind === 'clutter') {
    snd.whoosh();
    const kids = Rm.clutter.children.slice();
    for (const c of kids) { const s0 = c.scale.clone(); const wp = new V3(); c.getWorldPosition(wp); anim(0.35, k => c.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - k))); WP.burst(wp.add(new V3(0, 0.5, 0)), ['#d8c3a5', '#ffffff', '#b89a72'], 14, { speed: 2.5, up: 2, size: 1.4, life: 0.7 }); snd.pop(0, 0); await wait(110); }
    await wait(300); Rm.apply.clutter(true); for (const c of kids) c.scale.setScalar(1);
  } else if (t.kind === 'window' && Rm.boards) {
    const bs = Rm.boards.children; bs.forEach((b, i) => { const p0 = b.position.clone(), r0 = b.rotation.z; anim(0.7, k => { b.position.set(p0.x + (i - 1) * k * 1.5, p0.y - k * k * 3, p0.z + k * 1.2); b.rotation.z = r0 + k * (i % 2 ? 2 : -2); }).then(() => { b.position.copy(p0); b.rotation.z = r0; }); });
    snd.crate(); await wait(650); Rm.apply.window(true); snd.chime(3); WP.burst(pos, ['#fff6c2', '#ffffff', '#a8e1ff'], 30, { speed: 3, up: 2, size: 1.2, spread: 1.5 });
  } else {
    // walls / floor: a sparkle sweep, then the new finish
    snd.sparkle(); const d = Rm.def;
    for (let i = 0; i < 6; i++) { const p = t.kind === 'walls' ? new V3(-d.W / 2 + (i + 0.5) * d.W / 6, d.H * 0.55, -d.D / 2 + 0.3) : new V3(-d.W / 2 + (i + 0.5) * d.W / 6, 0.2, (Math.random() - 0.5) * d.D * 0.8);
      WP.burst(p, ['#fff6c2', '#ffffff', '#ffc2dc'], 12, { speed: 2, up: 1.5, size: 1.2, life: 0.8, spread: 1.4 }); await wait(70); }
    if (t.kind === 'walls' && !d.garden) { const p = new V3(-d.W / 2 + 0.3, d.H * 0.55, 0); WP.burst(p, ['#fff6c2', '#ffffff'], 20, { speed: 2, up: 1.5, spread: 3 }); }
    Rm.apply[t.kind](true); snd.place();
  }
}
async function buy(t) {
  if (roomBusy || st.stars < t.cost || mode !== 'room') { if (st.stars < t.cost && mode === 'room') { say('Play a level to earn ⭐ stars!'); snd.bad(); } return; }
  roomBusy = true; st.stars -= t.cost; shownStars = st.stars; const def = roomOf();
  st.done[def.id] = [...doneList(def), t.id]; save(); refreshRoomHUD(); buzz(15);
  focus = taskPos(curRoom, t); marker.visible = false;
  await anim(0.45, k => { focusT = easeIO(k); });
  await animateTask(curRoom, t);
  atm.target = roomProgress();
  host.play('cheer', true); say(['Gorgeous!', 'I love it!', 'So cozy!', 'Perfect spot!', 'Look at that!', 'Dreamy!'][(Math.random() * 6) | 0]);
  await wait(500);
  await anim(0.6, k => { focusT = 1 - easeIO(k); }); focus = null;
  if (!nextTasks(def).length) await roomComplete(def);
  roomBusy = false; refreshRoomHUD();
}
async function roomComplete(def) {
  snd.win(); host.play('cheer', true);
  for (let i = 0; i < 4; i++) { WP.burst(new V3((Math.random() - 0.5) * def.W, def.H + 1.5, (Math.random() - 0.5) * def.D), CONF, 40, { speed: 3, up: 1, size: 1.6, life: 2, grav: 3, spread: 2 }); await wait(160); }
  for (const k of ['rocket', 'bomb', 'disco']) st.boosts[k] = (st.boosts[k] || 0) + 1;
  save(); say(`${def.name} restored! +1 of each booster 🎁`, 3600);
  ui.pop(`${def.name.toUpperCase()} RESTORED!`, '#fff', 34, 26);
}
async function goNextRoom() {
  if (roomBusy || st.room >= ROOMS.length - 1) return;
  roomBusy = true; st.room++; save();
  await enterRoom(st.room); bgKey = '';
  say(['A new room to love!', 'Oh dear, more dust!', 'Let\'s make it lovely!'][st.room % 3], 3000);
  roomBusy = false;
}

// ---------------------------------------------------------------- room HUD
function taskIcon(t) { return t.item ? `<img src="./assets/thumbs/${t.item}.webp" alt="">` : t.icon; }
function refreshRoomHUD() {
  const def = roomOf(), list = nextTasks(def), p = roomProgress(def);
  el.roomName.textContent = `${def.name} · ${Math.round(p * 100)}%`; el.prog.style.width = p * 100 + '%';
  el.starsN.textContent = shownStars;
  if (!list.length) {
    const more = st.room < ROOMS.length - 1;
    el.tasks.innerHTML = `<h3><span>${more ? 'Room restored!' : 'Every room restored!'}</span><span>🏡</span></h3><div class="bh-task"><div class="ic">${more ? '🗝️' : '🌸'}</div><div class="nm">${more ? 'Next: ' + ROOMS[st.room + 1].name : 'New rooms are on the way'}<small>${more ? 'A dusty room is waiting' : 'Keep playing for stars and boosters'}</small></div>${more ? '<button class="bh-btn bh-pink" data-next>Go ➜</button>' : ''}</div>`;
    const nb = el.tasks.querySelector('[data-next]'); if (nb) nb.onclick = () => { snd.tap(); goNextRoom(); };
  } else {
    el.tasks.innerHTML = `<h3><span>Makeover tasks</span><span>${doneList(def).length}/${def.tasks.length}</span></h3>` + list.slice(0, 2).map((t, i) =>
      `<div class="bh-task"><div class="ic">${taskIcon(t)}</div><div class="nm">${t.name}<small>${i === 0 ? (st.stars >= t.cost ? 'Tap to place it!' : 'Earn stars by playing') : 'Up next'}</small></div><button class="bh-btn ${st.stars >= t.cost && i === 0 ? 'bh-pink' : 'bh-grey'}" data-t="${t.id}">⭐ ${t.cost}</button></div>`).join('');
    el.tasks.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = list.find(x => x.id === b.dataset.t); if (t !== list[0]) { say('One thing at a time, dear!'); return; } snd.tap(); buy(t); });
  }
  const lv = dailyMode ? null : makeLevel(st.level, 1);
  el.play.className = 'bh-btn bh-green bh-play' + (lv?.hard ? ' hard' : '');
  el.play.innerHTML = dailyMode ? 'Daily Level<small>same puzzle for everyone today</small>' : `Level ${st.level}${lv.hard ? '<small>HARD LEVEL</small>' : ''}`;
  const nt = list[0]; marker.visible = !!nt && mode === 'room' && st.stars >= nt.cost;
  if (nt && curRoom) marker.position.copy(taskPos(curRoom, nt));
}
el.play.onclick = () => { snd.tap(); openPop(); };

// ---------------------------------------------------------------- level popup
let chosen = new Set();
function levelDef() { return dailyMode ? makeLevel(12 + (D.seed % 17), F.k(), D.seed) : makeLevel(st.level, F.k()); }
function goalIcon(g) { return g.k === 'color' ? ICON['c' + g.c] : ICON[g.k]; }
function openPop() {
  if (popEl || roomBusy || mode !== 'room') return;
  curLevel = levelDef(); chosen = new Set();
  popEl = $(`<div id="bh-pop" class="bh"><div class="bh-card"><button class="bh-btn x" aria-label="Close">✕</button>
    <h2 class="${curLevel.hard ? 'hard' : ''}">${dailyMode ? 'Daily Level' : 'Level ' + curLevel.n}</h2>
    ${curLevel.hard ? '<div class="lbl" style="color:#d8304a;opacity:1">Hard level</div>' : ''}
    <div class="lbl">Goals · ${curLevel.moves} moves</div><div class="bh-goalrow">${curLevel.goals.map(g => `<div><img src="${goalIcon(g)}" alt="">${g.n}</div>`).join('')}</div>
    <div class="lbl">Start boosters</div><div class="bh-boost">${['rocket', 'bomb', 'disco'].map(k => `<button class="bh-btn" data-b="${k}" ${st.boosts[k] ? '' : 'disabled'}><img src="${ICON[k]}" alt="${k}"><b>${st.boosts[k] || 0}</b></button>`).join('')}</div>
    <button class="bh-btn bh-green" data-play>Play</button></div></div>`);
  document.body.appendChild(popEl);
  popEl.querySelector('.x').onclick = () => { snd.tap(); closePop(); };
  popEl.addEventListener('pointerdown', e => { if (e.target === popEl) closePop(); });
  popEl.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const k = b.dataset.b; if (!st.boosts[k]) return; snd.tap(); chosen.has(k) ? chosen.delete(k) : chosen.add(k); b.classList.toggle('on', chosen.has(k)); });
  popEl.querySelector('[data-play]').onclick = () => { snd.tap(); startLevel(); };
}
function closePop() { popEl?.remove(); popEl = null; }

// ---------------------------------------------------------------- match flow
function buildGoalsHUD() {
  el.goals.innerHTML = `<span class="lv">${dailyMode ? 'DAILY' : 'LEVEL ' + curLevel.n}${curLevel.hard ? ' · HARD' : ''}</span>` + M3.goals.map((g, i) => `<div class="g" data-g="${i}"><img src="${goalIcon(g)}" alt=""><b>${g.left}</b></div>`).join('');
}
function startLevel() {
  if (!curLevel) curLevel = levelDef();
  closePop();
  const pre = [...chosen]; for (const k of pre) st.boosts[k]--; save(); chosen = new Set();
  mode = 'match'; state = 'play'; recorded = false; marker.visible = false;
  el.roomTop.classList.add('bh-hidden'); el.roomBot.classList.add('bh-hidden'); el.mute.classList.add('bh-hidden');
  el.mhud.classList.remove('bh-hidden'); el.quit.classList.remove('bh-hidden');
  M3.start(curLevel, rng(curLevel.seed), pre); buildGoalsHUD(); layoutBoard(); boardG.visible = true;
  if (host) { cam.add(host.g); hostMatchPose(); host.play("idle"); }
  runT0 = performance.now(); B.start(); snd.music(true); snd.whoosh();
  if (curLevel.n <= 2 && !dailyMode) setTimeout(() => say(curLevel.n === 1 ? 'Swipe gems to match 3 in a row!' : 'Match 4 for a rocket, a square for a propeller!', 3200), 900);
}
function toRoom() {
  mode = 'room'; state = 'ready'; M3.hide(); boardG.visible = false; closePop();
  el.mhud.classList.add('bh-hidden'); el.quit.classList.add('bh-hidden');
  el.roomTop.classList.remove('bh-hidden'); el.roomBot.classList.remove('bh-hidden'); el.mute.classList.remove('bh-hidden');
  placeHostInRoom(); host.play('idle'); refreshRoomHUD();
}
el.quit.onclick = () => { snd.tap(); if (M3.busy) return; toRoom(); };
const flying = [];
const hooks = {
  goal(i, x, y, left) {
    const slot = el.goals.querySelector(`[data-g="${i}"]`); if (!slot) return;
    const upd = () => { const g = M3.goals[i]; if (!g) return; slot.querySelector('b').textContent = Math.max(0, g.left); slot.classList.toggle('done', g.left <= 0); if (g.left <= 0) slot.querySelector('b').textContent = '✓'; slot.classList.remove('bump'); void slot.offsetWidth; slot.classList.add('bump'); };
    if (flying.length > 14) { upd(); return; }
    const v = new V3(x, y, 0.5); boardG.localToWorld(v); v.project(cam); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const r = slot.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + 22;
    const img = document.createElement('img'); img.className = 'bh-fly'; img.src = goalIcon(M3.goals[i]); document.body.appendChild(img);
    const f = { img, sx, sy, tx, ty, t: 0, d: 0.5 + Math.random() * 0.15, cx: sx + (Math.random() - 0.5) * 160, cy: Math.min(sy, ty) - 60, upd }; flying.push(f);
  },
  moves(n) { el.movesN.textContent = n; el.moves.classList.toggle('low', n <= 5 && n > 0); },
  combo(text, chain) { if (!text) return; const d = $(`<div class="bh-combo">${text}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1000); snd.chime(chain + 2); if (chain >= 3 && host) host.play('jump', true); buzz(20); },
  made(kind) { buzz(12); if ((kind === 'disco' || kind === 'bomb') && host) host.play('cheer', true); },
  booster() { buzz(25); },
  shake(a) { shake = Math.max(shake, a); },
  won() { const d = $('<div class="bh-combo" style="font-size:46px">Level complete!</div>'); document.body.appendChild(d); setTimeout(() => d.remove(), 1000); snd.win(); host?.play('cheer', true); },
  done(won, stars, score) {
    if (recorded) return; recorded = true;
    const ms = performance.now() - runT0;
    if (won) {
      F.level(true); lastStars = stars; st.stars += stars; st.earned += stars; st.wins++;
      if (!dailyMode) { st.level++; if (st.level % 4 === 0) { const k = ['rocket', 'bomb', 'disco'][(st.level / 4) % 3]; st.boosts[k] = (st.boosts[k] || 0) + 1; } }
      save(); D.won(stars, 'earned ⭐'); B.submit(stars, { ms });
      winStars.querySelectorAll('i').forEach(i => i.classList.remove('on'));
      ui.win(dailyMode ? 'DAILY' : st.level - 1, `+${stars} ⭐  to decorate with`); state = 'won';
      for (let i = 0; i < stars; i++) setTimeout(() => { winStars.children[i].classList.add('on'); snd.star(i); }, 900 + i * 280);
      for (let i = 0; i < 3; i++) setTimeout(() => M3.fx.spark((Math.random() - 0.5) * 6, 2 + Math.random() * 2, CONF, 40, { speed: 6, up: 3, size: 1.6, life: 1.4 }), i * 200);
      if (dailyMode) dailyMode = false;
    } else {
      const g = M3.goals, frac = g.reduce((a, q) => a + (q.n - Math.max(0, q.left)) / q.n, 0) / g.length;
      F.level(false, frac); snd.lose(); host?.play('fall', true);
      ui.lose('OUT OF MOVES', frac > 0.7 ? 'So close! Tap to try again' : 'Tap to try again'); state = 'lost';
    }
  },
};

ui.onTap(which => {
  snd.unlock();
  if (which === 'start') {
    mode = 'room'; state = 'ready'; el.roomTop.classList.remove('bh-hidden'); el.roomBot.classList.remove('bh-hidden'); el.mute.classList.remove('bh-hidden');
    refreshRoomHUD(); snd.music(true);
    setTimeout(() => say(doneList().length ? 'Welcome back, dear! ✨' : 'Oh my, this old house needs love! Let\'s fix it up ✨', 3200), 400);
  } else if (which === 'win') {
    toRoom(); const n = lastStars; shownStars = st.stars - n; el.starsN.textContent = shownStars;
    const r = el.stars.getBoundingClientRect();
    for (let i = 0; i < n; i++) setTimeout(() => { const s = $('<div class="bh-fly" style="font-size:38px;width:auto;height:auto">⭐</div>'); document.body.appendChild(s);
      flying.push({ img: s, sx: innerWidth / 2, sy: innerHeight * 0.45, tx: r.left + 24, ty: r.top + 22, t: 0, d: 0.6, cx: innerWidth * 0.2, cy: innerHeight * 0.3, upd: () => { shownStars++; el.starsN.textContent = shownStars; el.stars.classList.remove('bump'); void el.stars.offsetWidth; el.stars.classList.add('bump'); snd.coin(); if (shownStars === st.stars) refreshRoomHUD(); } }); }, 250 + i * 220);
    const nt = nextTasks()[0]; setTimeout(() => say(nt && st.stars >= nt.cost ? `Next up: ${nt.name.toLowerCase()}!` : 'More stars, more makeover!'), 900);
  } else if (which === 'lose') { toRoom(); setTimeout(openPop, 250); }
});

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new V3();
function boardPoint(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  boardG.updateMatrixWorld(); const n = new V3(0, 0, 1).transformDirection(boardG.matrixWorld), o = new V3().setFromMatrixPosition(boardG.matrixWorld);
  plane.setFromNormalAndCoplanarPoint(n, o); if (!ray.ray.intersectPlane(plane, hitP)) return null;
  return boardG.worldToLocal(hitP.clone());
}
let drag = null;
addEventListener('pointerdown', e => {
  if (e.target !== R.domElement) return; snd.unlock();
  if (mode === 'match' && state === 'play') { const p = boardPoint(e); if (p) M3.input.down(p.x, p.y); }
  else if (mode === 'room') drag = { x: e.clientX, yaw: yawT };
});
addEventListener('pointermove', e => {
  if (mode === 'match') { const p = boardPoint(e); if (p) M3.input.move(p.x, p.y); }
  else if (drag) yawT = Math.max(-0.45, Math.min(0.45, drag.yaw - (e.clientX - drag.x) / innerWidth * 1.4));
});
addEventListener('pointerup', () => { if (mode === 'match') M3.input.up(); drag = null; });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s of a still screen): on level 1, until the
// first real touch, one plain three-in-a-row the goals don't count swaps itself (a free move, the counter is given back)
demo(() => { M3.demo(); return false; },
  { ready: () => mode === 'match' && state === 'play' && !dailyMode && curLevel && curLevel.n === 1 && M3 && !M3.busy && !M3.over && M3.moves === curLevel.moves, wait: 2200 });

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); layoutBoard(); hostMatchPose(); if (mode !== 'match') placeHostInRoom(); }
addEventListener('resize', () => { resize(); if (mode === 'match') { layoutBoard(); hostMatchPose(); } });
let T = 0;
loop((d) => {
  const dt = Math.min(0.05, d / 60); T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt / w.dur; w.fn(Math.min(1, w.t)); if (w.t >= 1) { tweens.splice(i, 1); w.res(); } }
  if (!P) return;
  // camera
  yaw += (yawT - yaw) * Math.min(1, dt * 6);
  const pose = roomPose(), k = Math.min(1, dt * 3.2);
  camCur.pos.lerp(pose.pos, k); camCur.tgt.lerp(pose.tgt, k);
  const wantOff = mode === 'match' ? 0 : pose.off; camCur.off += (wantOff - camCur.off) * k;
  cam.position.copy(camCur.pos); cam.lookAt(camCur.tgt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); cam.position.x += (Math.random() - 0.5) * shake * 0.25; cam.position.y += (Math.random() - 0.5) * shake * 0.25; }
  cam.setViewOffset(innerWidth, innerHeight, 0, camCur.off, innerWidth, innerHeight);
  // atmosphere
  atm.cur += (atm.target - atm.cur) * Math.min(1, dt * 1.5);
  // the room brightens as it is decorated; it starts 30% of the way up so the first screen isn't a grey haze (2026-10-25)
  const p = 0.3 + 0.7 * atm.cur, inMatch = mode === 'match';
  hemi.intensity = 0.62 + 0.55 * p; sun.intensity = 1.5 + 1.2 * p; sun.color.set(mixHex('#d8dde8', '#ffe6c0', p));
  scene.environmentIntensity = 0.45 + 0.35 * p;
  C.grade.uniforms.uSat.value = inMatch ? 1.22 : 0.85 + 0.35 * p;
  dimPlane.material.opacity += ((inMatch ? 0.45 : 0) - dimPlane.material.opacity) * Math.min(1, dt * 5);
  dimPlane.visible = dimPlane.material.opacity > 0.01;
  paintBg(p, inMatch);
  const fireOn = curRoom && curRoom.def.id === 'living' && doneList().includes('fire'); fill.intensity += ((fireOn ? 6 : 0) - fill.intensity) * dt * 2; if (fireOn) fill.intensity *= 0.97 + Math.random() * 0.06;
  // marker
  if (marker.visible) { bob += dt; marker.children[0].position.y = 0.6 + Math.sin(bob * 4) * 0.12; marker.children[1].position.y = 1.05 + Math.sin(bob * 4) * 0.12; const rg = marker.getObjectByName('ring'); rg.scale.setScalar(1 + (bob * 1.2 % 1) * 0.6); rg.material.opacity = 0.8 * (1 - bob * 1.2 % 1); }
  // board
  if (mode === 'match') { cam.updateMatrixWorld(); M3.update(dt); boardG.rotation.x = -0.06; }
  host?.mixer.update(dt);
  WP.update(dt);
  // flights (goal icons, stars)
  for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt / f.d; const t = Math.min(1, f.t), a = 1 - t;
    const x = a * a * f.sx + 2 * a * t * f.cx + t * t * f.tx, y = a * a * f.sy + 2 * a * t * f.cy + t * t * f.ty;
    f.img.style.left = x + 'px'; f.img.style.top = y + 'px'; f.img.style.transform = `scale(${1 + Math.sin(t * PI) * 0.5})`;
    if (t >= 1) { f.img.remove(); flying.splice(i, 1); f.upd(); snd.collect(i); } }
  if (bubbleEl) { bubbleT -= dt; if (bubbleT <= 0) { bubbleEl.remove(); bubbleEl = null; } else placeBubble(); }
  R.info.reset(); C.render(dt); perf = { calls: R.info.render.calls, tris: R.info.render.triangles };
});
let perf = {};
R.info.autoReset = false;

// ---------------------------------------------------------------- test hooks
let botBusy = false;
window.__game = {
  // arcade auto-start: skip the title and the room, straight into the next level (false while still loading)
  autostart() { if (mode !== 'title' || !P) return false; ui.els.start.dispatchEvent(new Event('pointerdown')); setTimeout(startLevel, 350); },
  get state() { return state; }, get level() { return st.level; }, get score() { return st.earned; },
  get stars() { return st.stars; }, get dbg() { return M3 && M3.dbg; }, get perf() { return perf; }, get room() { return st.room; }, get tasksDone() { return Object.values(st.done).reduce((a, l) => a + l.length, 0); },
  bot() {
    if (!P || botBusy) return;
    if (mode === 'title') { ui.hideStart(); ui.els.start.dispatchEvent(new Event('pointerdown')); return; }
    if (mode === 'match') { if (state === 'play') M3.bot(); return; }
    if (popEl) { startLevel(); return; }
    if (roomBusy || flying.length) return;
    const nt = nextTasks()[0];
    if (!nt && st.room < ROOMS.length - 1) { botBusy = true; goNextRoom().finally(() => botBusy = false); return; }
    if (nt && st.stars >= nt.cost) { buy(nt); return; }
    openPop();
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.textContent = 'Could not load Bloomhaus'; });

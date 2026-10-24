// Mochi Match — original kawaii match-3 with a dorm-decorating meta. Swap squishy pieces, make specials, clear gift
// boxes and jelly ice within the moves, earn stars and decorate your dorm room and café with Momo (the host) cheering.
// Art: the kawaii AI 3D library (assets/*.glb, ours) + rooms, board, UI and sound in code.
import { THREE, createUI, store, loop, buzz, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';
import { loader, piece } from './assets.js';
import { ROOMS, buildRoom, roomStars } from './dorm.js';
import { makeLevel, isHard } from './levels.js';
import { createMatch3, COLORS_HEX } from './m3.js';
import { snd, pauseMusic } from './audio.js';
import { openMap, episodeOf } from './map.js';
import { PAGES, NAMES, ALL, PAGE_REWARD, dropSticker, pageDone, openAlbum } from './album.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Mochi Match: Match 3 & Dorm Decor', SLUG = 'mochi-match', PI = Math.PI, V3 = THREE.Vector3;
const Q = new URLSearchParams(location.search);
const S = store(SLUG);
const st = {
  level: S.get('level', 1), stars: S.get('stars', 0), room: S.get('room', 0), done: S.get('done', {}), best: S.get('best', {}),
  boosts: S.get('boosts', { rocket: 1, bomb: 1, rainbow: 0 }), tools: S.get('tools', { wand: 1, row: 1, col: 1 }),
  earned: S.get('earned', 0), wins: S.get('wins', 0), streak: S.get('streak', 0), stk: S.get('stk', {}), claimed: S.get('claimed', []),
  dStreak: S.get('dStreak', 0), dLast: S.get('dLast', 0), dFreezeWk: S.get('dFreezeWk', ''), dBest: S.get('dBest', 0),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow(SLUG);
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const dayNum = (o = 0) => { const d = new Date(); d.setDate(d.getDate() + o); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const isoWeek = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4); return d.getFullYear() + '-' + (1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7)); };
const TH = id => `assets/thumbs/${id}.webp`;

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.localClippingEnabled = true; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200); scene.add(cam);
const TUNE = k => Q.has(k) ? +Q.get(k) : null;
const C = cine(R, scene, cam, { bloom: TUNE('bloom') ?? 0.22, bloomThreshold: TUNE('bth') ?? 0.95, bloomRadius: 0.5, exposure: TUNE('exp') ?? 0.85, envIntensity: TUNE('env') ?? 0.45, lite: LITE, grade: { sat: TUNE('sat') ?? 1.22, contrast: TUNE('con') ?? 1.02, vignette: 0.08, grain: 0 } });
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 128; bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
const hemi = new THREE.HemisphereLight('#fff4fb', '#c9a8e0', TUNE('hemi') ?? 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6fb', TUNE('sun') ?? 1.7); sun.position.set(-6, 14, 10); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 45 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5; scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight('#ffc6ec', 0.9); rim.position.set(8, 6, -6); scene.add(rim);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: '<span class="mm-logo"><span>Mochi</span><span>Match</span></span><small>match · decorate · collect</small>', hint: 'Tap to play', hand: '', progress: false, score: false });
ui.els.start.classList.add('mm-title');
// win + lose cards: our jelly layout (keeps the kit's [data-l]/[data-x]/[data-t] hooks)
ui.els.win.innerHTML = `<div class="mm-card mm-wincard"><div class="mm-cardhead">Level <span data-l>1</span></div><h1>Sweet!</h1>
  <div class="mm-winstars"><i>★</i><i>★</i><i>★</i></div><p data-x></p>
  <div class="mm-rew"><div class="mm-rew-st"><img src="${TH('m03')}" alt=""><b data-ws>+0</b></div><div class="mm-rew-co"><img src="${TH('x02')}" alt=""><b data-wc>+0</b></div></div>
  <div class="mm-newstk mm-hidden"><img alt=""><span></span></div>
  <div class="mm-winbtns"><button class="mm-jelly mm-mint mm-dbl" data-dbl>▶ Double coins</button><button class="mm-jelly mm-lilac mm-hidden" data-share>Share</button></div>
  <div class="hint">Tap to continue</div></div>`;
ui.els.lose.innerHTML = `<div class="mm-card mm-losecard"><div class="mm-cardhead grape">Level <span data-ll>1</span></div><h1 data-t>Out of moves!</h1><p data-x></p>
  <div class="mm-losegoals"></div>
  <button class="mm-jelly mm-offer mm-hidden" data-offer>Play on +5 moves</button>
  <div class="hint">Tap to try again</div></div>`;
const D = daily(SLUG, ui, { name: NAME });
const B = worldBoard({ game: 'mochi-match', label: 'Stars earned', limits: { maxRun: 3, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr', accent: '#ff6fb5' });
const M = money({ game: SLUG, style: 'B' });
const loadEl = document.getElementById('mm-load'), loadBar = loadEl.querySelector('b');
const winEl = ui.els.win, loseEl = ui.els.lose;
for (const b of [...winEl.querySelectorAll('button'), ...loseEl.querySelectorAll('button')]) b.addEventListener('pointerdown', e => e.stopPropagation());

const hud = $(`<div class="mm">
  <div id="mm-home" class="mm-hidden">
    <div class="mm-top">
      <button class="mm-ava" data-map aria-label="Level map"><img src="${TH('k01')}" alt=""><b data-lv>1</b></button>
      <div class="mm-pills">
        <div class="mm-pill" data-pst><img src="${TH('m03')}" alt=""><span>0</span></div>
        <button class="mm-pill" data-pco aria-label="Coins and shop"><img src="${TH('x02')}" alt=""><span>0</span><i>+</i></button>
        <button class="mm-pill" data-pli aria-label="Lives"><img src="${TH('m01')}" alt=""><span>5</span><small></small></button>
      </div>
    </div>
    <div class="mm-side l">
      <button class="mm-round" data-map><img src="${TH('x05')}" alt=""><span>Map</span></button>
      <button class="mm-round" data-album><img src="${TH('r04')}" alt=""><span>Album</span><em class="mm-dot mm-hidden">!</em></button>
      <button class="mm-round" data-daily><img src="${TH('x01')}" alt=""><span>Daily</span><em class="mm-dot mm-hidden">!</em></button>
    </div>
    <div class="mm-side r">
      <button class="mm-round" data-shop><img src="${TH('m12')}" alt=""><span>Shop</span></button>
      <button class="mm-round mm-snd" data-snd><b>♪</b><span>Sound</span></button>
    </div>
    <div class="mm-bot">
      <div class="mm-tasks"></div>
      <button class="mm-jelly mm-play"></button>
    </div>
  </div>
  <div id="mm-mhud" class="mm-hidden">
    <div class="mm-mtop">
      <button class="mm-sq" data-pause aria-label="Pause"><i></i><i></i></button>
      <div class="mm-cloud"><small data-lvl>LEVEL</small><b data-lvn>1</b></div>
      <div class="mm-moves"><small>MOVES</small><b>0</b></div>
    </div>
    <div class="mm-goals"></div>
  </div>
  <div id="mm-tools" class="mm-hidden">
    <button class="mm-tool" data-tool="wand"><img src="${TH('x04')}" alt=""><b>0</b><span>Wand</span></button>
    <button class="mm-tool" data-tool="row"><img src="${TH('x05')}" alt=""><b>0</b><span>Row</span></button>
    <button class="mm-tool" data-tool="col"><img src="${TH('x03')}" alt=""><b>0</b><span>Column</span></button>
  </div>
</div>`);
document.body.appendChild(hud);
const q = s => hud.querySelector(s);
const el = { home: q('#mm-home'), mhud: q('#mm-mhud'), tools: q('#mm-tools'), lv: q('[data-lv]'), pst: q('[data-pst] span'), pstBox: q('[data-pst]'), pco: q('[data-pco] span'), pcoBox: q('[data-pco]'),
  pli: q('[data-pli] span'), pliT: q('[data-pli] small'), tasks: q('.mm-tasks'), play: q('.mm-play'), moves: q('.mm-moves'), movesN: q('.mm-moves b'), goals: q('.mm-goals'),
  lvl: q('[data-lvl]'), lvn: q('[data-lvn]'), snd: q('[data-snd]'), albumDot: q('[data-album] .mm-dot'), dailyDot: q('[data-daily] .mm-dot') };
const setMode = m => { document.body.dataset.mode = m; };

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', P = null, M3 = null, host = null, rooms = {}, roomBusy = false, popEl = null, dailyMode = false, curLevel = null, runT0 = 0, shownStars = st.stars;
let recorded = false, lastWin = null, pendingLose = null, armed = null, overlay = null, paused = false;
const ICON = {};
const roomOf = () => ROOMS[Math.min(st.room, ROOMS.length - 1)];
const doneList = (def = roomOf()) => st.done[def.id] || [];
const nextTasks = (def = roomOf()) => def.tasks.filter(t => !doneList(def).includes(t.id));

// ---------------------------------------------------------------- money HUD
function paintMoney(s = { coins: M.coins(), lives: M.lives() }) {
  el.pco.textContent = s.coins.toLocaleString();
  const L = s.lives; el.pli.textContent = L.unlimited ? '∞' : L.n;
  if (L.unlimited) el.pliT.textContent = ''; else if (L.n >= L.max) el.pliT.textContent = 'Full';
  else { const ms = Math.max(0, (L.nextAt || 0) - Date.now()); el.pliT.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`; }
}
M.onChange(s => { paintMoney(s); el.pcoBox.classList.remove('bump'); void el.pcoBox.offsetWidth; el.pcoBox.classList.add('bump'); });
setInterval(() => paintMoney(), 1000);
addEventListener('ap:ad', e => { const on = e.detail.phase === 'start'; pauseMusic(on); });
q('[data-pco]').onclick = () => { snd.tap(); M.shop(); };
q('[data-shop]').onclick = () => { snd.tap(); M.shop(); };
q('[data-pli]').onclick = () => { snd.tap(); const L = M.lives(); if (!L.unlimited && L.n < L.max) livesSheet(); else M.toast('Lives full! ♡'); };
el.snd.classList.toggle('off', snd.muted); el.snd.onclick = () => { el.snd.classList.toggle('off', snd.toggle()); };

// ---------------------------------------------------------------- tweens + world particles
const tweens = [];
const anim = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
const WP = (() => {
  const N = 600, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); m.count = 0; m.frustumCulled = false; scene.add(m);
  const tmp = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
        list.push({ p: new V3(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.5, pos.z + (Math.random() - 0.5) * spread), v: new V3(Math.cos(a) * Math.sin(b) * sp, up * (0.5 + Math.random()), Math.sin(a) * Math.sin(b) * sp), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 6; const f = p.life / p.max;
        e.set(p.r, p.r * 0.6, 0); q4.setFromEuler(e); s.setScalar(p.size * (0.3 + f * 0.9)); tmp.compose(p.p, q4, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r * (0.7 + f), p.c.g * (0.7 + f), p.c.b * (0.7 + f)); i++; }
      m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    },
  };
})();
const CONF = ['#ff6fb5', '#ffd23f', '#5fe0c0', '#6cc8ff', '#b48cff', '#ffffff', '#ff9a5c'];

// task marker: a bobbing pink heart + glow ring
const marker = new THREE.Group();
{ const hm = new THREE.MeshPhysicalMaterial({ color: '#ff6fb5', emissive: '#ff3d9a', emissiveIntensity: 0.35, roughness: 0.2, clearcoat: 1 });
  const hs = new THREE.Shape(); hs.moveTo(0, -0.35); hs.bezierCurveTo(-0.55, 0.05, -0.3, 0.5, 0, 0.22); hs.bezierCurveTo(0.3, 0.5, 0.55, 0.05, 0, -0.35);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.14, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4 }); hg.center();
  const h = new THREE.Mesh(hg, hm); h.position.y = 0.9; h.name = 'heart'; marker.add(h);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffe0f4', transparent: true, opacity: 0.8, toneMapped: false })); ring.rotation.x = PI / 2; ring.name = 'ring'; marker.add(ring);
  marker.visible = false; scene.add(marker); }

// ---------------------------------------------------------------- background (lilac → pink with soft bokeh)
let bgKey = '';
function paintBg(match) {
  const key = match ? 'm' : 'r'; if (key === bgKey) return; bgKey = key;
  const x = bgCanvas.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  if (match) { g.addColorStop(0, '#c7a2ff'); g.addColorStop(0.5, '#f0b6f0'); g.addColorStop(1, '#ffd0e6'); } else { g.addColorStop(0, '#d9c4ff'); g.addColorStop(0.55, '#ffd3ec'); g.addColorStop(1, '#ffe9f3'); }
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  const r = rng(11); for (let i = 0; i < 22; i++) { const cx = r() * 128, cy = r() * 256, rad = 4 + r() * 16, rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); rg.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.3})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  bgTex.needsUpdate = true;
}

// ---------------------------------------------------------------- camera
const camCur = { pos: new V3(8, 9, 18), tgt: new V3(0, 1.5, 0), off: 0 };
let yaw = 0, yawT = 0, focus = null, focusT = 0, bob = 0;
function roomPose() {
  const def = roomOf();
  const tgt = new V3(-0.2, 1.55, -0.3);
  const dir = new V3(Math.sin(0.62 + yaw), mode === 'title' ? 0.22 : 0.8, Math.cos(0.62 + yaw)).normalize();
  const ttl = mode === 'title', topPx = ttl ? innerHeight * 0.34 : 92, botPx = ttl ? innerHeight * 0.16 : (q('.mm-bot').offsetHeight || 230) + 22, free = Math.max(200, innerHeight - topPx - botPx);
  const tanV = Math.tan(cam.fov * PI / 360), tanH = tanV * cam.aspect;
  const rw = def.W * (innerWidth > 700 ? 0.62 : 0.57) + 0.4, rh = 5.0;
  let dist = Math.max(rw / (tanH * (innerWidth > 700 ? 0.8 : 0.98)), rh / (tanV * free / innerHeight));
  if (focus && focusT > 0) { tgt.lerp(focus, 0.35 * focusT); dist *= 1 - 0.18 * focusT; }
  if (mode === 'match') { tgt.set(-0.6, 2.0, -1.0); dist = 10; }
  if (mode === 'title' && host) { const h = roomOf().host; tgt.set(h[0] - 0.2, 1.2, h[2]); dist = por() ? 8.4 : 6.6; return { pos: tgt.clone().addScaledVector(dir, dist), tgt, off: -innerHeight * (por() ? 0.06 : 0.02) }; }
  return { pos: tgt.clone().addScaledVector(dir, dist), tgt, off: innerHeight / 2 - (topPx + free / 2) };
}

// ---------------------------------------------------------------- match board (attached to the camera)
const BOARD_D = 3;
const boardG = new THREE.Group(); cam.add(boardG); boardG.visible = false;
const dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#9a6fd8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
dimPlane.position.z = -BOARD_D - 0.6; dimPlane.renderOrder = -1; cam.add(dimPlane);
let shake = 0;
const por = () => innerWidth / innerHeight < 0.8;
function layoutBoard() {
  if (!M3) return;
  const [W, H] = M3.size, p = por();
  const vh = 2 * BOARD_D * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const top = (el.mhud.getBoundingClientRect().bottom || 120) + 8, bot = p ? Math.max(150, Math.min(196, innerHeight * 0.22)) : 26;
  const availH = innerHeight - top - bot, availW = innerWidth * (p ? 0.985 : 0.6);
  const s = Math.min(availW / innerWidth * vw / (W + 0.7), availH / innerHeight * vh / (H + 0.7));
  const bh = s * (H + 0.7) / vh * innerHeight, cy = top + bh / 2 + (availH - bh) * (p ? 0.3 : 0.5);
  boardG.position.set(0, (0.5 - cy / innerHeight) * vh, -BOARD_D); boardG.scale.setScalar(s);
  const dv = BOARD_D + 0.6, dvh = 2 * dv * Math.tan(cam.fov * PI / 360); dimPlane.scale.set(dvh * cam.aspect * 1.1, dvh * 1.1, 1);
}
function hostMatchPose() {
  if (!host) return;
  const p = por(), d = 3.4, vh = 2 * d * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const h = p ? vh * 0.205 : vh * 0.6;
  host.g.position.set(p ? -vw * 0.33 : -vw * 0.34, -vh / 2 + (p ? vh * 0.0 : vh * 0.04), -d); host.g.scale.setScalar(h / host.h); host.g.rotation.set(0.1, 0.4, 0);
}

// ---------------------------------------------------------------- host (kawaii chibi k01 "Momo")
async function loadHost() {
  const gl = await loader.loadAsync('./assets/chars/k01.glb');
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true), hgt = box.max.y - box.min.y;
  const inner = new THREE.Group(); inner.add(root); root.position.y = -box.min.y;
  const g = new THREE.Group(); g.add(inner);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
  // the library's idle is a look-around that turns her back to the camera: keep its calm first half-second, ping-ponged
  const idle = gl.animations.find(c => c.name === 'idle');
  if (idle) { acts.idle = mixer.clipAction(THREE.AnimationUtils.subclip(idle, 'calm', 0, 14, 30)); acts.idle.timeScale = 0.45; }
  let cur = null;
  const play = (n, once = false) => { const a = acts[n]; if (!a) return; if (a === cur && !once) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : n === 'idle' ? THREE.LoopPingPong : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play(); if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
    if (once) { clearTimeout(play.t); play.t = setTimeout(() => play('idle'), Math.min(4000, (a.getClip().duration * 1000) / a.timeScale + 100)); } };
  play('idle');
  return { g, h: hgt, mixer, play };
}
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 2600) {
  if (!host) return; bubbleEl?.remove(); bubbleEl = $(`<div class="mm-bubble">${text}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000; placeBubble();
}
const headPos = new V3();
function placeBubble() {
  if (!bubbleEl || !host) return;
  host.g.getWorldPosition(headPos); const sc = new V3(); host.g.getWorldScale(sc); headPos.y += host.h * sc.y * 1.02;
  headPos.project(cam); const x = (headPos.x + 1) / 2 * innerWidth, y = (1 - headPos.y) / 2 * innerHeight;
  const m = mode === 'match' && por();
  bubbleEl.classList.toggle('side', m);
  bubbleEl.style.left = (m ? Math.max(60, x - 20) : Math.max(110, Math.min(innerWidth - 110, x))) + 'px'; bubbleEl.style.top = Math.max(96, y) + 'px';
}

// ---------------------------------------------------------------- title floaties
const floaties = new THREE.Group(); scene.add(floaties);

// ---------------------------------------------------------------- loading
async function renderIcons() {
  const r2 = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); r2.setPixelRatio(1); r2.setSize(128, 128);
  r2.toneMapping = THREE.ACESFilmicToneMapping; r2.outputColorSpace = THREE.SRGBColorSpace;
  const s2 = new THREE.Scene(), pm = new THREE.PMREMGenerator(r2), env = pm.fromScene(new RoomEnvironment(), 0.04).texture; s2.environment = env; s2.environmentIntensity = 0.8;
  s2.add(new THREE.HemisphereLight('#fff', '#e8d8ff', 1.5)); const dl = new THREE.DirectionalLight('#fff', 2.2); dl.position.set(-2, 3, 4); s2.add(dl);
  const c2 = new THREE.PerspectiveCamera(30, 1, 0.1, 10); c2.position.set(0, 0, 2.15);
  P.colors.forEach((p, i) => { const m = new THREE.Mesh(p.geo, p.mat); s2.add(m); r2.render(s2, c2); ICON['c' + i] = r2.domElement.toDataURL(); m.visible = false; });
  env.dispose(); pm.dispose(); r2.dispose(); r2.forceContextLoss();
  for (const [k, id] of [['crate', 'm12'], ['ice', 'm11'], ['rocket', 'm09'], ['bomb', 'm07'], ['rainbow', 'm08'], ['prop', 'm10']]) ICON[k] = TH(id);
}
async function boot() {
  let n = 0; const total = 16; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  const ids = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm09', 'm07', 'm10', 'm08', 'm12', 'm11'];
  const got = await Promise.all(ids.map(id => piece(id, 'mid').then(p => { tick(); return p; })));
  const colors = got.slice(0, 6).map(p => ({ ...p }));
  for (const p of colors) { p.mat = p.mat.clone(); p.mat.envMapIntensity = TUNE('penv') ?? 1.0; p.mat.emissiveMap = p.mat.map; p.mat.emissive = new THREE.Color('#ffffff'); p.mat.emissiveIntensity = TUNE('pem') ?? 0.04; p.mat.roughness = Math.min(p.mat.roughness ?? 0.5, 0.42); }
  P = { colors, rocket: got[6], bomb: got[7], prop: got[8], disco: got[9], crate: got[10], ice: got[11] };
  M3 = createMatch3({ group: boardG, P, snd, hooks });
  await renderIcons(); tick();
  // title floaties: the six pieces bobbing in front of the room
  colors.forEach((p, i) => { const m = new THREE.Mesh(p.geo, p.mat); m.userData.i = i; floaties.add(m); });
  const hp = loadHost().then(h => { tick(); return h; });
  await enterRoom(st.room, true); tick();
  host = await hp; placeHostInRoom(); tick();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  mode = 'title'; state = 'ready'; setMode('title'); placeHostInRoom();
  host.play('wave', true);
  for (const k of Object.keys(ROOMS)) if (+k !== st.room) setTimeout(() => ensureRoom(+k), 4000 + k * 1500);
  if (D.seed && !Q.has('demo')) setTimeout(() => { if (mode === 'title') { ui.hideStart(); goHome(); openDaily(); } }, 600);
}

// ---------------------------------------------------------------- rooms
async function ensureRoom(i) {
  if (!rooms[i]) rooms[i] = buildRoom(ROOMS[i]).then(Rm => { Rm.group.visible = false; scene.add(Rm.group); for (const id of (st.done[ROOMS[i].id] || [])) applyTask(Rm, ROOMS[i].tasks.find(t => t.id === id)); return Rm; });
  return rooms[i];
}
let curRoom = null;
async function enterRoom(i, first = false) {
  const Rm = await ensureRoom(i);
  if (curRoom) curRoom.group.visible = false;
  curRoom = Rm; Rm.group.visible = true;
  if (!first) camCur.pos.add(new V3(6, 8, 8));
  placeHostInRoom(); refreshHome();
}
function placeHostInRoom() {
  if (!host || !curRoom) return;
  const h = roomOf().host; curRoom.group.add(host.g); host.g.position.set(h[0], h[1], h[2]); host.g.rotation.set(0, mode === 'title' ? 0.62 : h[3], 0); host.g.scale.setScalar(2.35 / host.h);
}
// during a level the furniture behind the board is hidden (keeps the scene under ~400k triangles); walls, floor,
// lights and window stay as the backdrop
function showFurniture(on) {
  if (!curRoom) return; const done = doneList(curRoom.def);
  for (const [id, m] of Object.entries(curRoom.items)) m.visible = on && done.includes(id);
}
function applyTask(Rm, t) {
  if (!t) return;
  if (t.item) { const m = Rm.items[t.id]; m.visible = true; m.scale.copy(m.userData.base); m.position.y = t.at[1]; }
  else Rm.apply[t.kind]?.(true);
}
function taskPos(Rm, t) {
  const d = Rm.def;
  if (t.item) return new V3(t.at[0], t.at[1] + t.size * 0.6 + 0.2, t.at[2]);
  if (t.kind === 'walls') return new V3(0.4, d.H * 0.6, -d.D / 2 + 0.6);
  if (t.kind === 'floor') return new V3(1.0, 0.05, 1.4);
  if (t.kind === 'window') return new V3(d.window.x, d.window.y - 0.3, -d.D / 2 + 0.6);
  if (t.kind === 'lights') return new V3(0, d.H - 0.6, -d.D / 2 + 0.6);
  if (t.kind === 'photos') return new V3(-d.W / 2 + 0.6, 2.6, 1.7);
  if (t.kind === 'clutter') return new V3(d.boxes[0][0], 1.4, d.boxes[0][2]);
  return new V3();
}
async function animateTask(Rm, t) {
  const pos = taskPos(Rm, t);
  if (t.item) {
    const m = Rm.items[t.id], base = m.userData.base.clone(), y0 = t.at[1]; m.visible = true;
    snd.whoosh();
    await anim(0.75, k => { const e = easeBack(Math.min(1, k * 1.1)); m.scale.copy(base).multiplyScalar(Math.max(0.01, e)); m.position.y = y0 + (1 - Math.min(1, k * 1.4)) * 2.2; m.rotation.y = (t.rot || 0) + (1 - k) * 1.4; });
    m.scale.copy(base); m.position.y = y0; m.rotation.y = t.rot || 0;
    snd.place(); WP.burst(new V3(t.at[0], y0 + 0.4, t.at[2]), ['#fff6c2', '#ffffff', '#ffb3de', '#c9b2ff'], 30, { speed: 3.5, up: 2.5, size: 1.3, life: 0.9, spread: t.size * 0.5 });
  } else if (t.kind === 'clutter') {
    snd.whoosh();
    for (const c of Rm.clutter.children.slice()) { const s0 = c.scale.clone(); const wp = new V3(); c.getWorldPosition(wp); anim(0.35, k => c.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - k) * (1 + Math.sin(k * PI) * 0.3))); WP.burst(wp.add(new V3(0, 0.5, 0)), ['#ffd6ee', '#ffffff', '#e8c49a'], 14, { speed: 2.5, up: 2, size: 1.3, life: 0.7 }); snd.pop(0, 0); await wait(110); }
    await wait(300); Rm.apply.clutter(true); for (const c of Rm.clutter.children) c.scale.setScalar(1);
  } else {
    snd.sparkle(); const d = Rm.def;
    for (let i = 0; i < 6; i++) { const p = t.kind === 'floor' ? new V3(-d.W / 2 + (i + 0.5) * d.W / 6, 0.2, (Math.random() - 0.5) * d.D * 0.8) : t.kind === 'photos' ? new V3(-d.W / 2 + 0.3, 2 + Math.random() * 1.4, 0.8 + i * 0.3) : new V3(-d.W / 2 + (i + 0.5) * d.W / 6, d.H * 0.6, -d.D / 2 + 0.3);
      WP.burst(p, ['#fff6c2', '#ffffff', '#ffc2e4', '#cbb6ff'], 12, { speed: 2, up: 1.5, size: 1.2, life: 0.8, spread: 1.4 }); await wait(70); }
    Rm.apply[t.kind](true); snd.place();
  }
}
async function buy(t) {
  if (roomBusy || mode !== 'home') return;
  if (st.stars < t.cost) { say('Win a level to earn ★ stars!'); snd.bad(); return; }
  roomBusy = true; st.stars -= t.cost; shownStars = st.stars; const def = roomOf();
  st.done[def.id] = [...doneList(def), t.id]; save(); refreshHome(); buzz(15);
  focus = taskPos(curRoom, t); marker.visible = false;
  await anim(0.45, k => { focusT = easeIO(k); });
  await animateTask(curRoom, t);
  host.play(Math.random() < 0.5 ? 'cheer' : 'jump', true); say(['So cute!! ♡', 'Kawaii~!', 'I love it!', 'Perfect spot!', 'Dreamy ✨', 'Ahh it\'s adorable!'][(Math.random() * 6) | 0]);
  await wait(500);
  await anim(0.6, k => { focusT = 1 - easeIO(k); }); focus = null;
  if (!nextTasks(def).length) await roomComplete(def);
  roomBusy = false; refreshHome();
}
async function roomComplete(def) {
  snd.win(); host.play('cheer', true);
  for (let i = 0; i < 4; i++) { WP.burst(new V3((Math.random() - 0.5) * def.W, def.H + 1.5, (Math.random() - 0.5) * def.D), CONF, 40, { speed: 3, up: 1, size: 1.6, life: 2, grav: 3, spread: 2 }); await wait(160); }
  for (const k of ['wand', 'row', 'col']) st.tools[k]++;
  for (const k of ['rocket', 'bomb', 'rainbow']) st.boosts[k]++;
  M.add(200, 'room-complete'); save(); say(`${def.name} done! 🎁 +200 coins + boosters`, 3600);
  ui.pop(`${def.name.toUpperCase()} COMPLETE!`, '#fff', 30, 24);
}
async function goNextRoom() {
  if (roomBusy || st.room >= ROOMS.length - 1) return;
  roomBusy = true; st.room++; save();
  await enterRoom(st.room); say('A new place to make cute! ✨', 3000);
  roomBusy = false;
}

// ---------------------------------------------------------------- home HUD
function refreshHome() {
  const def = roomOf(), list = nextTasks(def), n = doneList(def).length, p = n / def.tasks.length;
  el.lv.textContent = st.level; el.pst.textContent = shownStars;
  const head = `<div class="mm-rp"><b>${def.name}</b><span>${n}/${def.tasks.length}</span><div class="mm-bar"><i style="width:${p * 100}%"></i></div></div>`;
  if (!list.length) {
    const more = st.room < ROOMS.length - 1;
    el.tasks.innerHTML = head + `<div class="mm-task"><div class="ic"><img src="${TH(more ? 'x01' : 'x05')}" alt=""></div><div class="nm">${more ? 'Next: ' + ROOMS[st.room + 1].name : 'All decorated!'}<small>${more ? 'A new room to make cute' : 'New rooms soon · keep collecting stickers'}</small></div>${more ? '<button class="mm-jelly mm-mint mm-small" data-next>Go ›</button>' : ''}</div>`;
    const nb = el.tasks.querySelector('[data-next]'); if (nb) nb.onclick = () => { snd.tap(); goNextRoom(); };
  } else {
    const t = list[0], can = st.stars >= t.cost;
    el.tasks.innerHTML = head + `<div class="mm-task ${can ? 'can' : ''}" data-t="${t.id}"><div class="ic"><img src="${TH(t.item || t.icon)}" alt=""></div><div class="nm">${t.name}<small>${can ? 'Tap to decorate!' : 'Win levels to earn stars'}</small></div><button class="mm-jelly ${can ? '' : 'mm-grey'} mm-small mm-cost"><img src="${TH('m03')}" alt="">${t.cost}</button></div>`;
    el.tasks.querySelector('[data-t]').onclick = () => { snd.tap(); buy(t); };
  }
  const hard = !dailyMode && isHard(st.level);
  el.play.className = 'mm-jelly mm-play' + (hard ? ' grape' : '');
  el.play.innerHTML = `Level ${st.level}${hard ? '<small>HARD LEVEL</small>' : `<small>${episodeOf(st.level).name}</small>`}`;
  const nt = list[0]; marker.visible = !!nt && mode === 'home' && st.stars >= nt.cost && !roomBusy;
  if (nt && curRoom) marker.position.copy(taskPos(curRoom, nt)).add(new V3(0, 0.6, 0));
  el.albumDot.classList.toggle('mm-hidden', !PAGES.some((pg, i) => pageDone(pg, st.stk) && !st.claimed.includes(i)));
  el.dailyDot.classList.toggle('mm-hidden', st.dLast === dayNum());
  paintMoney();
}
el.play.onclick = () => { snd.tap(); dailyMode = false; openPop(st.level); };
hud.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { snd.tap(); showMap(); });
q('[data-album]').onclick = () => { snd.tap(); showAlbum(); };
q('[data-daily]').onclick = () => { snd.tap(); openDaily(); };

// ---------------------------------------------------------------- overlays: map, album, sheets
function showMap() {
  if (mode !== 'home' || popEl) return;
  overlay = openMap({ level: st.level, best: st.best, avatar: TH('k01'), onPick: n => { overlay = null; dailyMode = false; openPop(n); }, onClose: () => { overlay = null; } });
}
function showAlbum(start) {
  if (mode !== 'home' || popEl) return;
  const first = PAGES.findIndex((p, i) => pageDone(p, st.stk) && !st.claimed.includes(i));
  overlay = openAlbum({ owned: st.stk, claimed: st.claimed, start: start ?? (first >= 0 ? first : PAGES.findIndex(p => !pageDone(p, st.stk))),
    onClaim: i => { if (st.claimed.includes(i)) return; st.claimed.push(i); st.boosts[PAGE_REWARD.boost]++; save(); M.add(PAGE_REWARD.coins, 'album-page'); snd.win(); M.toast(`Page complete! +${PAGE_REWARD.coins} coins + Rainbow ball`); refreshHome(); },
    onClose: () => { overlay = null; refreshHome(); } });
}
function card(html, cls = '') {
  closePop();
  popEl = $(`<div class="mm-pop mm"><div class="mm-card ${cls}"><button class="mm-x" aria-label="Close">✕</button>${html}</div></div>`);
  document.body.appendChild(popEl); document.body.dataset.pop = '1';
  popEl.querySelector('.mm-x').onclick = () => { snd.tap(); closePop(); };
  popEl.addEventListener('pointerdown', e => { if (e.target === popEl) closePop(); });
  return popEl;
}
function closePop() { popEl?.remove(); popEl = null; delete document.body.dataset.pop; if (mode === 'match' && paused) resumeMatch(); }
function livesSheet() {
  const L = M.lives(), ms = Math.max(0, (L.nextAt || 0) - Date.now());
  const c = card(`<div class="mm-cardhead grape">${L.n ? 'Lives' : 'Out of lives'}</div><div class="mm-bigicon"><img src="${TH('m01')}" alt=""><b>${L.n}</b></div>
    <p>${L.n ? `Next life in ${Math.ceil(ms / 60000)} min` : `Next life in ${Math.ceil(ms / 60000)} min. Levels 1–5 and the Daily never cost a life.`}</p>
    <button class="mm-jelly mm-mint" data-refill>▶ Refill all lives</button>`);
  c.querySelector('[data-refill]').onclick = async () => { closePop(); if (await M.rewarded('lives')) { snd.win(); M.toast('Lives refilled! ♡'); } };
}

// ---------------------------------------------------------------- level popup
let chosen = new Set();
const BOOST_PRICE = 120, TOOL_PRICE = 100;
function levelDef(n) { return dailyMode ? makeLevel(20 + (dayNum() % 17), 1, dayNum(), { daily: true }) : makeLevel(n, F.k()); }
function goalIcon(g) { return g.k === 'color' ? ICON['c' + g.c] : ICON[g.k]; }
const needsLife = () => !dailyMode && curLevel && curLevel.n >= 6;
function streakGifts() { return ['rocket', 'bomb', 'rainbow'].slice(0, Math.min(3, st.streak)); }
function openPop(n) {
  if (roomBusy || mode !== 'home') return;
  curLevel = levelDef(n); chosen = new Set();
  const hard = curLevel.hard, gifts = streakGifts();
  const c = card(`<div class="mm-cardhead ${hard ? 'grape' : ''}">${dailyMode ? 'Daily Sweet' : 'Level ' + curLevel.n}</div>
    ${hard ? '<div class="mm-hardtag">HARD LEVEL · fewer moves</div>' : ''}
    <div class="mm-lbl">Goals</div><div class="mm-goalrow">${curLevel.goals.map(g => `<div><img src="${goalIcon(g)}" alt=""><b>${g.n}</b></div>`).join('')}</div>
    <div class="mm-movesline"><b>${curLevel.moves}</b> moves</div>
    ${gifts.length ? `<div class="mm-streak">🔥 Win streak ${st.streak}: free ${gifts.map(k => `<img src="${ICON[k]}" alt="${k}">`).join('')}</div>` : ''}
    <div class="mm-lbl">Boosters</div><div class="mm-boost">${['rocket', 'bomb', 'rainbow'].map(k => `<button data-b="${k}" aria-label="${k}"><img src="${ICON[k]}" alt=""><b>${st.boosts[k] || `<img src="${TH('x02')}" alt="">${BOOST_PRICE}`}</b></button>`).join('')}</div>
    <button class="mm-jelly ${hard ? 'grape' : ''} mm-go" data-play>Play${needsLife() ? ` <span class="mm-life"><img src="${TH('m01')}" alt="">${M.lives().unlimited ? '∞' : M.lives().n}</span>` : ''}</button>`, 'mm-levelcard');
  c.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const k = b.dataset.b; snd.tap();
    if (!st.boosts[k] && !chosen.has(k)) { if (M.spend(BOOST_PRICE, 'booster-' + k)) { st.boosts[k]++; save(); b.querySelector('b').textContent = st.boosts[k]; } else { M.shop(); return; } }
    chosen.has(k) ? chosen.delete(k) : chosen.add(k); b.classList.toggle('on', chosen.has(k));
  });
  c.querySelector('[data-play]').onclick = () => { snd.tap(); startLevel(); };
}

// ---------------------------------------------------------------- daily
function openDaily() {
  if (mode !== 'home' && mode !== 'title') return;
  if (mode === 'title') { ui.hideStart(); goHome(); }
  const today = dayNum(), doneToday = st.dLast === today, wk = isoWeek(), freeze = st.dFreezeWk !== wk;
  const alive = st.dLast === today || st.dLast === dayNum(-1) || (st.dLast === dayNum(-2) && freeze);
  const streak = alive ? st.dStreak : 0;
  const c = card(`<div class="mm-cardhead mint">Daily Sweet</div><div class="mm-flame"><b>${streak}</b><small>day streak</small></div>
    <p>One sweet level a day, the same for everyone. ${freeze ? '❄️ 1 free streak freeze this week (it saves a missed day for you).' : '❄️ Streak freeze used this week.'}</p>
    ${doneToday ? '<p class="mm-ok">Done today ✓ Come back tomorrow!</p><button class="mm-jelly mm-lilac" data-share>Share today\'s card</button>' : ''}
    <button class="mm-jelly mm-mint mm-go" data-play>${doneToday ? 'Play again' : 'Play today\'s level'}</button>`, 'mm-dailycard');
  c.querySelector('[data-play]').onclick = () => { snd.tap(); closePop(); dailyMode = true; openPop(0); };
  const sh = c.querySelector('[data-share]'); if (sh) sh.onclick = () => shareDaily(st.dBest || 1, null);
}
function dailyGrid(stars, usedMoves, totalMoves) {
  const cells = Array.from({ length: totalMoves }, (_, i) => i < usedMoves ? '🩷' : '🤍'), rows = [];
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(''));
  const d = new Date();
  return `Mochi Match · Daily Sweet ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}  🔥${st.dStreak}\n${rows.join('\n')}`;
}
async function shareDaily(stars, info) {
  const text = info ? dailyGrid(stars, info.used, info.total) : `Mochi Match · Daily Sweet\n${'⭐'.repeat(stars)}  🔥${st.dStreak}`;
  const url = location.origin + location.pathname + '?daily=1';
  try { if (navigator.share) { await navigator.share({ title: NAME, text, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text + '\n' + url); M.toast('Copied! Paste it to your friends ♡'); } catch (e) {}
}

// ---------------------------------------------------------------- match flow
function buildGoalsHUD() {
  el.goals.innerHTML = M3.goals.map((g, i) => `<div class="g" data-g="${i}"><img src="${goalIcon(g)}" alt=""><b>${g.left}</b></div>`).join('');
  el.lvl.textContent = dailyMode ? 'DAILY' : curLevel.hard ? 'HARD' : 'LEVEL'; el.lvn.textContent = dailyMode ? '♡' : curLevel.n;
  el.mhud.classList.toggle('hard', !!curLevel.hard);
}
function paintTools() { for (const b of el.tools.querySelectorAll('[data-tool]')) { const k = b.dataset.tool, n = st.tools[k] || 0; b.querySelector('b').innerHTML = n || '+'; b.classList.toggle('empty', !n); b.classList.toggle('armed', armed === k); } }
function startLevel() {
  if (!curLevel) curLevel = levelDef(st.level);
  if (needsLife()) { const L = M.lives(); if (!L.unlimited && L.n <= 0) { livesSheet(); return; } }
  closePop(); if (overlay) { overlay.el.remove(); overlay = null; }
  const pre = [...chosen]; for (const k of pre) st.boosts[k]--;
  for (const k of streakGifts()) pre.push(k);
  save(); chosen = new Set();
  mode = 'match'; state = 'play'; setMode('match'); recorded = false; marker.visible = false; armed = null; pendingLose = null; lastWin = null;
  el.home.classList.add('mm-hidden'); el.mhud.classList.remove('mm-hidden'); el.tools.classList.remove('mm-hidden'); floaties.visible = false;
  showFurniture(false);
  M3.start(curLevel, rng(curLevel.seed), pre.map(k => k === 'rainbow' ? 'disco' : k)); buildGoalsHUD(); paintTools(); layoutBoard(); boardG.visible = true;
  if (host) { cam.add(host.g); hostMatchPose(); host.play('idle'); }
  runT0 = performance.now(); B.start(); M.level(curLevel.n || st.level); snd.music(true); snd.whoosh();
  const tip = dailyMode ? 'Daily Sweet! Same level for everyone today ♡' : curLevel.n === 1 ? 'Swipe to match 3 hearts! ♡' : curLevel.n === 2 ? 'Match 4 for a Heart Rocket!' : curLevel.n === 3 ? 'Match 5 for a Rainbow ball ✨' : curLevel.n === 4 ? 'Match next to gift boxes to open them!' : curLevel.n === 5 ? 'Clear the jelly ice ❄️' : curLevel.hard ? 'Hard one! We got this 💪' : pre.length ? 'Boosters ready! ✨' : '';
  if (tip) setTimeout(() => say(tip, 3200), 700);
}
function goHome() {
  if (overlay) { overlay.el.remove(); overlay = null; }
  mode = 'home'; state = 'ready'; setMode('home'); M3?.hide(); boardG.visible = false; closePop(); armed = null; floaties.visible = false;
  el.mhud.classList.add('mm-hidden'); el.tools.classList.add('mm-hidden'); el.home.classList.remove('mm-hidden');
  showFurniture(true); placeHostInRoom(); host?.play('idle'); refreshHome(); snd.music(true);
}
function pauseMatch() {
  if (mode !== 'match' || state !== 'play' || M3.busy) return;
  paused = true;
  const costs = needsLife() && M3.moves < M3.movesStart;
  const c = card(`<div class="mm-cardhead">Paused</div><p>${dailyMode ? 'Daily Sweet' : 'Level ' + curLevel.n}</p>
    <button class="mm-jelly mm-mint mm-go" data-resume>Keep playing</button>
    <button class="mm-jelly mm-lilac mm-go" data-snd2>${snd.muted ? 'Sound on' : 'Sound off'}</button>
    <button class="mm-jelly mm-grey mm-go" data-quit>Leave level${costs ? ` <span class="mm-life"><img src="${TH('m01')}" alt="">−1</span>` : ''}</button>`);
  c.querySelector('[data-resume]').onclick = () => { snd.tap(); closePop(); };
  c.querySelector('[data-snd2]').onclick = e => { el.snd.classList.toggle('off', snd.toggle()); e.target.textContent = snd.muted ? 'Sound on' : 'Sound off'; };
  c.querySelector('[data-quit]').onclick = () => { snd.tap(); paused = false; closePop(); if (costs) { M.useLife(); st.streak = 0; save(); F.level(false, goalFrac()); } goHome(); };
}
function resumeMatch() { paused = false; }
q('[data-pause]').onclick = () => { snd.tap(); pauseMatch(); };
const goalFrac = () => { const g = M3.goals; return g.reduce((a, x) => a + (x.n - Math.max(0, x.left)) / x.n, 0) / g.length; };

// tools: wand (one cell), row, column. Tap to arm, then tap the board.
el.tools.querySelectorAll('[data-tool]').forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = async () => {
  const k = b.dataset.tool; if (mode !== 'match' || state !== 'play') return; snd.tap();
  if (armed === k) { armed = null; paintTools(); return; }
  if (!st.tools[k]) {
    if (M.spend(TOOL_PRICE, 'tool-' + k)) { st.tools[k]++; save(); M.toast(`+1 ${k === 'wand' ? 'Star Wand' : k === 'row' ? 'Rainbow' : 'Magnet'}`); }
    else if (k === 'wand') { if (await M.rewarded('hint', { what: '1 Star Wand (pops any piece or blocker)' })) { st.tools.wand++; save(); } else return; }
    else { M.shop(); return; }
  }
  armed = k; paintTools(); say(k === 'wand' ? 'Tap any piece to pop it ✨' : k === 'row' ? 'Tap a row to clear it 🌈' : 'Tap a column to clear it 🧲', 2200);
}; });

const flying = [];
const hooks = {
  goal(i, x, y) {
    const slot = el.goals.querySelector(`[data-g="${i}"]`); if (!slot) return;
    const upd = () => { const g = M3.goals[i]; if (!g) return; const b = slot.querySelector('b'); b.textContent = g.left <= 0 ? '✓' : Math.max(0, g.left); slot.classList.toggle('done', g.left <= 0); slot.classList.remove('bump'); void slot.offsetWidth; slot.classList.add('bump'); };
    if (flying.length > 14) { upd(); return; }
    const v = new V3(x, y, 0.5); boardG.localToWorld(v); v.project(cam); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const r = slot.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + 22;
    const img = document.createElement('img'); img.className = 'mm-fly'; img.src = goalIcon(M3.goals[i]); document.body.appendChild(img);
    flying.push({ img, sx, sy, tx, ty, t: 0, d: 0.5 + Math.random() * 0.15, cx: sx + (Math.random() - 0.5) * 160, cy: Math.min(sy, ty) - 60, upd });
  },
  moves(n) { el.movesN.textContent = n; el.moves.classList.toggle('low', n <= 5 && n > 0); },
  combo(text, chain) { if (!text) return; const d = $(`<div class="mm-combo">${text}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1000); snd.chime(chain + 2); if (chain >= 3 && host) { host.play('jump', true); if (Math.random() < 0.5) say(['Sugoi!!', 'Wow wow wow!', 'Combo queen ♡'][(Math.random() * 3) | 0], 1400); } buzz(20); },
  made(kind) { buzz(12); if ((kind === 'disco' || kind === 'bomb') && host) host.play('cheer', true); },
  booster() { buzz(25); },
  shake(a) { shake = Math.max(shake, a); },
  won() { const d = $('<div class="mm-combo big">Level clear!</div>'); document.body.appendChild(d); setTimeout(() => d.remove(), 1100); snd.win(); host?.play('cheer', true); say('Yay!! ♡', 1800); },
  done(won, stars) {
    if (recorded) return; recorded = true;
    const ms = performance.now() - runT0;
    if (won) winLevel(stars, ms);
    else loseLevel();
  },
};
function winLevel(stars, ms) {
  F.level(true);
  const n = curLevel.n, replay = !dailyMode && n < st.level, gain = dailyMode ? stars : replay ? Math.max(0, stars - (st.best[n] || 0)) : stars;
  if (!dailyMode) st.best[n] = Math.max(st.best[n] || 0, stars);
  st.stars += gain; st.earned += gain; st.wins++; st.streak = Math.min(3, st.streak + 1);
  let coins = (10 + stars * 5) * (curLevel.hard ? 2 : 1) + (dailyMode ? 25 : 0);
  let dailyInfo = null, freezeUsed = false;
  if (dailyMode) {
    const today = dayNum(), wk = isoWeek();
    if (st.dLast !== today) {
      if (st.dLast === dayNum(-1)) st.dStreak++;
      else if (st.dLast === dayNum(-2) && st.dFreezeWk !== wk) { st.dStreak++; st.dFreezeWk = wk; freezeUsed = true; }
      else st.dStreak = 1;
      st.dLast = today;
    }
    st.dBest = Math.max(st.dBest && st.dLast === today ? st.dBest : 0, stars);
    dailyInfo = { used: M3.movesStart - M3.moves, total: M3.movesStart };
  }
  if (!dailyMode && !replay) st.level++;
  if (!dailyMode && !replay && (st.level - 1) % 5 === 0) { const k = ['rocket', 'bomb', 'rainbow'][((st.level - 1) / 5) % 3]; st.boosts[k]++; }
  const drop = dropSticker(st.stk); st.stk[drop.id] = (st.stk[drop.id] || 0) + 1; if (!drop.fresh) coins += 10;
  save(); M.add(coins, dailyMode ? 'daily-win' : 'win');
  D.won(gain, 'earned ★');
  if (gain > 0) B.submit(gain, { ms });
  lastWin = { stars, gain, coins, drop, dailyInfo, freezeUsed };
  // fill the win card
  winEl.querySelector('h1').textContent = stars === 3 ? 'Perfect!' : stars === 2 ? 'Sweet!' : 'Cleared!';
  winEl.querySelector('.mm-cardhead').innerHTML = dailyMode ? 'Daily Sweet <span data-l></span>' : 'Level <span data-l></span>';
  winEl.querySelector('[data-ws]').textContent = '+' + gain; winEl.querySelector('[data-wc]').textContent = '+' + coins;
  winEl.querySelectorAll('.mm-winstars i').forEach(i => i.classList.remove('on'));
  const ns = winEl.querySelector('.mm-newstk'); ns.classList.remove('mm-hidden'); ns.querySelector('img').src = TH(drop.id);
  ns.querySelector('span').innerHTML = drop.fresh ? `<b>New sticker!</b> ${NAMES[drop.id]}` : `${NAMES[drop.id]} again · +10 coins`; ns.classList.toggle('fresh', drop.fresh);
  const dbl = winEl.querySelector('[data-dbl]'); dbl.classList.remove('mm-hidden'); dbl.disabled = false; dbl.textContent = `▶ ${coins * 2} coins`;
  winEl.querySelector('[data-share]').classList.toggle('mm-hidden', !dailyMode);
  ui.win(dailyMode ? '' : (replay ? n : st.level - 1), dailyMode ? `🔥 ${st.dStreak}-day streak${freezeUsed ? ' · ❄️ freeze used' : ''}` : gain ? `+${gain} ★ to decorate with` : replay ? 'Replay: no new stars this time' : '');
  state = 'won';
  for (let i = 0; i < stars; i++) setTimeout(() => { winEl.querySelectorAll('.mm-winstars i')[i].classList.add('on'); snd.star(i); }, 900 + i * 300);
  for (let i = 0; i < 3; i++) setTimeout(() => M3.fx.spark((Math.random() - 0.5) * 6, 2 + Math.random() * 2, CONF, 40, { speed: 6, up: 3, size: 1.6, life: 1.4 }), i * 200);
}
winEl.querySelector('[data-dbl]').onclick = async e => {
  const b = e.currentTarget; if (!lastWin || b.disabled) return; b.disabled = true;
  if (await M.rewarded('double', { what: `${lastWin.coins * 2} coins instead of ${lastWin.coins}` })) { M.add(lastWin.coins, 'double'); winEl.querySelector('[data-wc]').textContent = '+' + lastWin.coins * 2; snd.coin(); b.classList.add('mm-hidden'); }
  else b.disabled = false;
};
winEl.querySelector('[data-share]').onclick = () => { if (lastWin) shareDaily(lastWin.stars, lastWin.dailyInfo); };
function loseLevel() {
  snd.lose(); host?.play('idle'); say('Aww, so close…', 2000);
  const frac = goalFrac(); pendingLose = { frac };
  loseEl.querySelector('[data-ll]').textContent = dailyMode ? 'Daily' : curLevel.n;
  loseEl.querySelector('[data-x]').textContent = frac > 0.75 ? 'So close! Just a little more:' : 'Still to go:';
  loseEl.querySelector('.mm-losegoals').innerHTML = M3.goals.filter(g => g.left > 0).map(g => `<div><img src="${goalIcon(g)}" alt=""><b>${g.left}</b></div>`).join('');
  loseEl.querySelector('.hint').textContent = needsLife() ? 'Tap to give up (−1 ♡)' : 'Tap to try again';
  const offer = loseEl.querySelector('[data-offer]'); offer.classList.add('mm-hidden'); offer.disabled = false;
  offer.innerHTML = M.coins() >= 90 ? `Play on +5 moves <span class="mm-price"><img src="${TH('x02')}" alt="">90</span>` : '▶ Play on: +5 moves';
  ui.lose('Out of moves!', ''); state = 'lost';
  setTimeout(() => { if (state === 'lost' && pendingLose) offer.classList.remove('mm-hidden'); }, 1400);   // never within 1.2 s of losing
}
loseEl.querySelector('[data-offer]').onclick = async e => {
  const b = e.currentTarget; if (state !== 'lost' || b.disabled) return; b.disabled = true;
  const ok = M.spend(90, 'continue-moves') || await M.rewarded('moves', { what: '+5 moves to finish this level' });
  if (!ok) { b.disabled = false; return; }
  loseEl.classList.add('hc-hidden'); pendingLose = null; recorded = false; state = 'play'; M3.revive(5); snd.make(); say('+5 moves! You can do it ♡', 1800); host?.play('jump', true);
};
function commitLose() {
  if (!pendingLose) return; const { frac } = pendingLose; pendingLose = null;
  F.level(false, frac); st.streak = 0; save();
  if (needsLife()) M.useLife();
}

ui.onTap(async which => {
  snd.unlock();
  if (which === 'start') {
    goHome();
    setTimeout(() => say(doneList().length ? 'Welcome back! ♡' : 'Move-in day! Let\'s make it cute ✨', 3200), 400);
  } else if (which === 'win') {
    const lw = lastWin; goHome(); dailyMode = false;
    const n = lw ? lw.gain : 0; shownStars = st.stars - n; el.pst.textContent = shownStars;
    const r = el.pstBox.getBoundingClientRect();
    for (let i = 0; i < n; i++) setTimeout(() => { const s = $(`<img class="mm-fly" src="${TH('m03')}" alt="">`); document.body.appendChild(s);
      flying.push({ img: s, sx: innerWidth / 2, sy: innerHeight * 0.45, tx: r.left + 18, ty: r.top + 18, t: 0, d: 0.6, cx: innerWidth * 0.2, cy: innerHeight * 0.3, upd: () => { shownStars++; el.pst.textContent = shownStars; el.pstBox.classList.remove('bump'); void el.pstBox.offsetWidth; el.pstBox.classList.add('bump'); snd.coin(); if (shownStars === st.stars) refreshHome(); } }); }, 250 + i * 220);
    const nt = nextTasks()[0]; setTimeout(() => say(nt && st.stars >= nt.cost ? `Next: ${nt.name.toLowerCase()}! ♡` : 'More stars, more cute! ✨'), 900);
    await wait(n * 220 + 900);
    if (mode === 'home' && !popEl) await M.breakAd('level-end', { level: st.level });
  } else if (which === 'lose') { commitLose(); goHome(); setTimeout(() => openPop(curLevel.n || st.level), 250); }
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
  if (mode === 'match' && state === 'play' && !paused) {
    const p = boardPoint(e); if (!p) return;
    if (armed) { const c = M3.cellAt(p.x, p.y); if (!c) return; const k = armed; M3.useTool(k, c[0], c[1]).then(ok => { if (ok) { st.tools[k]--; save(); } armed = null; paintTools(); }); armed = null; paintTools(); return; }
    M3.input.down(p.x, p.y);
  } else if (mode === 'home') drag = { x: e.clientX, yaw: yawT };
});
addEventListener('pointermove', e => {
  if (mode === 'match') { const p = boardPoint(e); if (p) M3.input.move(p.x, p.y); }
  else if (drag) yawT = Math.max(-0.5, Math.min(0.5, drag.yaw - (e.clientX - drag.x) / innerWidth * 1.4));
});
addEventListener('pointerup', () => { if (mode === 'match') M3.input.up(); drag = null; });

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); layoutBoard(); hostMatchPose(); if (mode !== 'match') placeHostInRoom(); }
addEventListener('resize', () => { resize(); if (mode === 'match') { layoutBoard(); hostMatchPose(); } });
let T = 0, perf = {};
R.info.autoReset = false;
loop((d) => {
  const dt = Math.min(0.05, d / 60); T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt / w.dur; w.fn(Math.min(1, w.t)); if (w.t >= 1) { tweens.splice(i, 1); w.res(); } }
  if (!P) return;
  yaw += (yawT - yaw) * Math.min(1, dt * 6);
  if (mode === 'title') yawT = Math.sin(T * 0.3) * 0.18;
  const pose = roomPose(), k = Math.min(1, dt * 3.2);
  camCur.pos.lerp(pose.pos, k); camCur.tgt.lerp(pose.tgt, k);
  const wantOff = mode === 'match' ? 0 : pose.off; camCur.off += (wantOff - camCur.off) * k;
  cam.position.copy(camCur.pos); cam.lookAt(camCur.tgt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); cam.position.x += (Math.random() - 0.5) * shake * 0.25; cam.position.y += (Math.random() - 0.5) * shake * 0.25; }
  cam.setViewOffset(innerWidth, innerHeight, 0, camCur.off, innerWidth, innerHeight);
  const inMatch = mode === 'match';
  dimPlane.material.opacity += ((inMatch ? 0.72 : 0) - dimPlane.material.opacity) * Math.min(1, dt * 5);
  dimPlane.visible = dimPlane.material.opacity > 0.01;
  paintBg(inMatch);
  // title floaties orbit in front of the camera
  floaties.visible = mode === 'title';
  if (floaties.visible) { cam.updateMatrixWorld(); const asp = Math.min(1, cam.aspect * 1.6); floaties.children.forEach((m, i) => { const a = T * 0.4 + i / 6 * PI * 2, v = new V3(Math.cos(a) * 1.15 * asp, -0.05 + Math.sin(a) * 0.32 + Math.sin(T * 1.7 + i) * 0.06, -4 + Math.sin(a) * 0.6);
    m.position.copy(v.applyMatrix4(cam.matrixWorld)); m.quaternion.copy(cam.quaternion); m.rotateY(Math.sin(T * 1.2 + i) * 0.4); m.rotateZ(Math.sin(T + i) * 0.15); m.scale.setScalar(0.34 + Math.sin(T * 2 + i) * 0.02); }); }
  if (marker.visible) { bob += dt; const h = marker.getObjectByName('heart'); h.position.y = 0.9 + Math.sin(bob * 4) * 0.12; h.rotation.y = bob * 2; const rg = marker.getObjectByName('ring'); rg.scale.setScalar(1 + (bob * 1.2 % 1) * 0.6); rg.material.opacity = 0.8 * (1 - bob * 1.2 % 1); }
  if (mode === 'match') { cam.updateMatrixWorld(); M3.update(dt); boardG.rotation.x = -0.05; }
  host?.mixer.update(dt);
  WP.update(dt);
  for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt / f.d; const t = Math.min(1, f.t), a = 1 - t;
    const x = a * a * f.sx + 2 * a * t * f.cx + t * t * f.tx, y = a * a * f.sy + 2 * a * t * f.cy + t * t * f.ty;
    f.img.style.left = x + 'px'; f.img.style.top = y + 'px'; f.img.style.transform = `scale(${1 + Math.sin(t * PI) * 0.5})`;
    if (t >= 1) { f.img.remove(); flying.splice(i, 1); f.upd(); snd.collect(i); } }
  if (bubbleEl) { bubbleT -= dt; if (bubbleT <= 0) { bubbleEl.remove(); bubbleEl = null; } else placeBubble(); }
  R.info.reset(); C.render(dt); perf = { calls: R.info.render.calls, tris: R.info.render.triangles };
});

// ---------------------------------------------------------------- test hooks
let botBusy = false;
window.__game = {
  autostart() { if (mode !== 'title' || !P) return false; ui.els.start.dispatchEvent(new Event('pointerdown')); setTimeout(() => { dailyMode = false; curLevel = levelDef(st.level); startLevel(); }, 350); },
  get state() { return state; }, get level() { return st.level; }, get score() { return st.earned; },
  get stars() { return st.stars; }, get perf() { return perf; }, get room() { return st.room; }, get mode() { return mode; }, get dbg() { return M3 && M3.dbg; },
  get tasksDone() { return Object.values(st.done).reduce((a, l) => a + l.length, 0); }, get stickers() { return Object.keys(st.stk).length; },
  // QA helpers (screenshots): jump to a screen
  qa: {
    home() { ui.hideStart(); goHome(); }, map: () => showMap(), album: () => showAlbum(), daily: () => openDaily(), pop: () => { dailyMode = false; openPop(st.level); },
    play() { dailyMode = false; curLevel = levelDef(st.level); startLevel(); }, win: (s = 3) => { recorded = false; hooks.done(true, s); }, lose: () => { recorded = false; hooks.done(false, 0); },
    give(stars = 10) { st.stars += stars; shownStars = st.stars; save(); refreshHome(); }, buyAll() { for (const t of nextTasks()) { st.done[roomOf().id] = [...doneList(), t.id]; applyTask(curRoom, t); } save(); refreshHome(); },
    async room(i = 1) { st.room = i; save(); await enterRoom(i); },
    stickers(n = 10) { ALL.slice(0, n).forEach(id => st.stk[id] = 1); save(); }, level(n) { st.level = n; save(); refreshHome(); },
  },
  bot() {
    if (!P || botBusy) return;
    if (mode === 'title') { ui.els.start.dispatchEvent(new Event('pointerdown')); return; }
    if (mode === 'match') { if (state === 'play' && !paused) { if (popEl) closePop(); M3.bot(); } return; }
    if (overlay) { overlay.close(); overlay = null; return; }
    if (popEl) { if (popEl.querySelector('[data-play]') && curLevel) startLevel(); else closePop(); return; }
    if (roomBusy || flying.length) return;
    const nt = nextTasks()[0];
    if (!nt && st.room < ROOMS.length - 1) { botBusy = true; goNextRoom().finally(() => botBusy = false); return; }
    if (nt && st.stars >= nt.cost) { buy(nt); return; }
    dailyMode = false; openPop(st.level);
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.textContent = 'Could not load Mochi Match'; });

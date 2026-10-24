// Bubblebay: Rescue Pop — original bubble shooter + bay restoration. Aim, match 3 colours, pop bubbles to free trapped
// critters, earn stars to restore five seaside islands, fill a sticker album, play the daily bay puzzle.
// Art: AI-generated 3D library (assets/*.glb, ours) + Hero Lab character (Captain Scarla); bubbles, sea, isles, UI, sound: code.
import { THREE, createUI, store, loop, buzz } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { loader, piece } from './assets.js';
import { ISLANDS, buildIsland, buildSea, critterHerd, ISLAND_R } from './bay.js';
import { makeLevel, CRITTERS, COLORS, isHard, rng, LAUNCH_Y } from './levels.js';
import { createShooter, BOARD_H } from './shooter.js';
import { W } from './grid.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Bubblebay: Rescue Pop', PI = Math.PI, V3 = THREE.Vector3;
const S = store('bubblebay');
const st = {
  level: S.get('level', 1), stars: S.get('stars', 0), island: S.get('island', 0), done: S.get('done', {}), wins: S.get('wins', 0), earned: S.get('earned', 0),
  boosts: S.get('boosts', { rainbow: 1, bomb: 1, bolt: 1 }), rescued: S.get('rescued', {}), stickers: S.get('stickers', []), seen: S.get('seen', {}),
  dly: S.get('dly', { last: 0, streak: 0, freezeWeek: -1, best: {} }), best: S.get('best', {}),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('bubblebay');
const M = money({ game: 'bubblebay', style: 'A' });
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const BOT = !!navigator.webdriver;
const BOOSTS = { rainbow: { name: 'Rainbow', price: 150, img: './assets/thumbs/m08.webp', tip: 'matches any colour' }, bomb: { name: 'Bomb', price: 200, img: './assets/thumbs/m07.webp', tip: 'blasts a big circle' }, bolt: { name: 'Lightning', price: 120, icon: '⚡', tip: 'zaps a straight line' } };
const boostIcon = k => BOOSTS[k].img ? `<img src="${BOOSTS[k].img}" alt="">` : `<span>${BOOSTS[k].icon}</span>`;
const critImg = i => `./assets/thumbs/${CRITTERS[i].id}.webp`;

// ---------------------------------------------------------------- calendar (daily streak with a weekly freeze)
const dayNum = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
const weekOf = n => Math.floor((n + 3) / 7);

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 400); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.22, bloomThreshold: 0.9, bloomRadius: 0.45, exposure: 0.86, envIntensity: 0.6, lite: LITE, grade: { sat: 1.15, contrast: 1.04, vignette: 0.1, grain: 0 } });
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 64; bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
scene.fog = new THREE.Fog('#d8f0ff', 60, 160);
const hemi = new THREE.HemisphereLight('#fff6e8', '#9fd8e8', 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d6', 2.5); sun.position.set(-8, 16, 9); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; scene.add(sun, sun.target);

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Bubblebay<small>RESCUE POP</small>', hint: 'Tap to start', hand: '🫧', progress: false, score: false });
ui.els.start.classList.add('bb-title');
const D = daily('bubblebay', ui, { name: NAME });
const kitShare = ui.els.win.querySelector('.hc-btn');
const B = worldBoard({ game: 'bubblebay', label: 'Stars earned', limits: { maxRun: 6, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr', accent: '#4fd1ff' });
ui.els.win.querySelector('h1').textContent = 'RESCUED!';
const winStars = $('<div class="bb-winstars"><i>⭐</i><i>⭐</i><i>⭐</i></div>'); ui.els.win.querySelector('h1').after(winStars);
const winCoins = $('<div class="bb-wincoins"><i><i class="bb-coin"></i></i><span>+0</span></div>'); winStars.after(winCoins);
const dblBtn = $('<button class="bb-btn bb-sea bb-offer">▶ Double coins<small>watch a short video</small></button>'); winCoins.after(dblBtn);
const gridBtn = $('<button class="hc-btn" style="margin-top:8px">Share my bay grid</button>'); dblBtn.after(gridBtn);
for (const b of [dblBtn, gridBtn]) b.addEventListener('pointerdown', e => e.stopPropagation());
ui.els.win.classList.add('bb-wincard'); ui.els.win.querySelector('[data-x]').after(dblBtn); if (kitShare) dblBtn.after(kitShare); dblBtn.after(gridBtn);
const shareRow = $('<div class="bb-sharerow"></div>'); dblBtn.after(shareRow); shareRow.append(dblBtn, gridBtn); if (kitShare) shareRow.append(kitShare);
const loadEl = document.getElementById('bb-load'), loadBar = loadEl.querySelector('b');

const hud = $(`<div class="bb">
  <div id="bb-top" class="bb-hidden">
    <div class="bb-row"><div class="bb-pill stars"><i>⭐</i><span>0</span></div><div class="bb-pill coins" role="button" aria-label="Shop"><i><i class="bb-coin"></i></i><span>0</span><b>+</b></div><div class="bb-pill lives"><i>❤️</i><span>5</span><small></small></div></div>
    <div class="bb-isle"><b></b><div class="bb-prog"><i></i></div></div>
  </div>
  <div id="bb-side" class="bb-hidden"><button class="bb-btn bb-round daily" aria-label="Daily puzzle">📅<em class="bb-hidden">!</em></button><button class="bb-btn bb-round album" aria-label="Sticker album">📒<em class="bb-hidden"></em></button><button class="bb-btn bb-round mute" aria-label="Sound">🔊</button></div>
  <div id="bb-bot" class="bb-hidden"><div class="bb-tasks"></div><button class="bb-btn bb-green bb-play"></button></div>
  <div id="bb-lhud" class="bb-hidden"><div class="bb-shots"><small>BUBBLES</small><b>0</b></div><div class="bb-goals"></div><div class="bb-score"><small>SCORE</small><b>0</b><div class="st"><i>⭐</i><i>⭐</i><i>⭐</i></div></div></div>
  <div id="bb-boosts" class="bb-hidden"></div>
  <button id="bb-quit" class="bb-btn bb-hidden" aria-label="Back to the bay">🏝️</button>
</div>`);
document.body.appendChild(hud);
const el = { top: hud.querySelector('#bb-top'), side: hud.querySelector('#bb-side'), bot: hud.querySelector('#bb-bot'), starsP: hud.querySelector('.bb-pill.stars'), starsN: hud.querySelector('.bb-pill.stars span'),
  coinsP: hud.querySelector('.bb-pill.coins'), coinsN: hud.querySelector('.bb-pill.coins span'), livesP: hud.querySelector('.bb-pill.lives'), livesN: hud.querySelector('.bb-pill.lives span'), livesT: hud.querySelector('.bb-pill.lives small'),
  isle: hud.querySelector('.bb-isle b'), prog: hud.querySelector('.bb-prog i'), tasks: hud.querySelector('.bb-tasks'), play: hud.querySelector('.bb-play'),
  daily: hud.querySelector('.bb-round.daily'), dailyDot: hud.querySelector('.bb-round.daily em'), album: hud.querySelector('.bb-round.album'), albumDot: hud.querySelector('.bb-round.album em'), mute: hud.querySelector('.bb-round.mute'),
  lhud: hud.querySelector('#bb-lhud'), shots: hud.querySelector('.bb-shots'), shotsN: hud.querySelector('.bb-shots b'), goals: hud.querySelector('.bb-goals'), scoreN: hud.querySelector('.bb-score b'), scoreSt: hud.querySelectorAll('.bb-score .st i'),
  boosts: hud.querySelector('#bb-boosts'), quit: hud.querySelector('#bb-quit') };
el.mute.textContent = snd.muted ? '🔇' : '🔊';
el.mute.onclick = () => { el.mute.textContent = snd.toggle() ? '🔇' : '🔊'; };
el.coinsP.onclick = () => { snd.tap(); M.shop(); };

// money HUD + ads pause our music
let shownCoins = M.coins();
function moneyHUD() {
  el.coinsN.textContent = shownCoins.toLocaleString();
  const L = M.lives(); el.livesN.textContent = L.unlimited ? '∞' : L.n;
  el.livesT.textContent = !L.unlimited && L.n < L.max && L.nextAt ? fmtT(L.nextAt - Date.now()) : L.n >= L.max ? 'full' : '';
}
const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
M.onChange(s => { if (!coinFlying) shownCoins = s.coins; moneyHUD(); });
setInterval(moneyHUD, 1000);
let adOn = false;
addEventListener('ap:ad', e => { adOn = e.detail.phase === 'start'; snd.music(!adOn); });

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', P = null, SH = null, cap = null, isles = {}, curIsle = null, busy = false, popEl = null, dailyMode = !!D.seed, curLevel = null;
let runT0 = 0, recorded = false, lastStars = 0, lastCoins = 0, coinFlying = false, herd = null, sea = null, usedRevive = 0;
const islandOf = () => ISLANDS[Math.min(st.island, ISLANDS.length - 1)];
const doneList = (def = islandOf()) => st.done[def.id] || [];
const nextTasks = (def = islandOf()) => def.tasks.filter(t => !doneList(def).includes(t.id));
const isleProgress = (def = islandOf()) => doneList(def).length / def.tasks.length;

// ---------------------------------------------------------------- tweens + world sparkles
const tweens = [];
const anim = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
const WP = (() => {
  const N = 500, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); m.count = 0; m.frustumCulled = false; scene.add(m);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
        list.push({ p: new V3(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread), v: new V3(Math.cos(a) * Math.sin(b) * sp, up * (0.5 + Math.random()), Math.sin(a) * Math.sin(b) * sp), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 6; const f = p.life / p.max;
        e.set(p.r, p.r * 0.6, 0); q.setFromEuler(e); s.setScalar(p.size * (0.3 + f * 0.9)); tmp.compose(p.p, q, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); i++; }
      m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    },
  };
})();
const CONF = ['#ff5d8f', '#ffd23f', '#3fcf6e', '#3aa8ff', '#b05cff', '#ffffff', '#ff8a2a'];

// task marker: bobbing gold arrow + glow ring
const marker = new THREE.Group();
{ const gm = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ff9d00', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 20), gm); cone.rotation.x = PI; cone.position.y = 0.6; marker.add(cone);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), gm); ball.position.y = 1.0; marker.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff0a0', transparent: true, opacity: 0.8, toneMapped: false })); ring.rotation.x = PI / 2; ring.name = 'ring'; marker.add(ring);
  marker.visible = false; scene.add(marker); }

// ---------------------------------------------------------------- sky + atmosphere (hazy → bright as the isle is restored)
let bgKey = '';
const mixHex = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
function paintBg(p) {
  const top = mixHex('#a9c2cf', '#62c3ff', p), mid = mixHex('#cfdde4', '#b9e9ff', p), bot = mixHex('#e6e2da', '#ffe6cf', p), key = top + mid + bot;
  if (key === bgKey) return; bgKey = key;
  const x = bgCanvas.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  bgTex.needsUpdate = true; scene.fog.color.set(mixHex('#dfe6ea', '#d7f1ff', p));
}

// ---------------------------------------------------------------- camera
const camCur = { pos: new V3(0, 14, 26), tgt: new V3(0, 1, 0), off: 0 };
let yaw = 0, yawT = 0, focus = null, focusT = 0, bob = 0;
function bayPose() {
  const wide = innerWidth > 900 && innerWidth / innerHeight > 1.2, ttl = mode === 'title', topPx = ttl ? innerHeight * 0.3 : wide ? 60 : 110, botPx = ttl ? innerHeight * 0.2 : wide ? 40 : (el.bot.offsetHeight || 230) + 14, free = Math.max(200, innerHeight - topPx - botPx);
  const tanV = Math.tan(cam.fov * PI / 360), tanH = tanV * cam.aspect;
  const tgt = new V3(0, 1.3, 0.6);
  const dir = new V3(Math.sin(yaw), 0.62, Math.cos(yaw)).normalize();
  let dist = Math.max((ISLAND_R + 0.6) / (tanH * 0.98), 7.4 / (tanV * free / innerHeight));
  if (focus && focusT > 0) { tgt.lerp(focus, 0.35 * focusT); dist *= 1 - 0.2 * focusT; }
  return { pos: tgt.clone().addScaledVector(dir, dist), tgt, off: innerHeight / 2 - (topPx + free / 2) };
}
function levelPose() { return { pos: new V3(-16, 4.5, 14), tgt: new V3(0, 3.2, -4), off: 0 }; }

// ---------------------------------------------------------------- shooter board (attached to the camera)
const BOARD_D = 6;
const boardG = new THREE.Group(); cam.add(boardG); boardG.visible = false;
const dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#dff4ff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
dimPlane.position.z = -BOARD_D - 1; dimPlane.renderOrder = -5; cam.add(dimPlane);
let shake = 0;
const isPortrait = () => innerWidth / innerHeight < 0.8;
function layoutBoard() {
  const vh = 2 * BOARD_D * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const top = (el.lhud.getBoundingClientRect().bottom || 80) + 6, bot = isPortrait() ? 84 : 20;
  const availH = innerHeight - top - bot, availW = innerWidth * (isPortrait() ? 0.98 : 0.5);
  const s = Math.min(availW / innerWidth * vw / (W + 1.1), availH / innerHeight * vh / (BOARD_H + 0.7));
  const topY = (0.5 - top / innerHeight) * vh;
  boardG.position.set(0, topY - 0.75 * s, -BOARD_D); boardG.scale.setScalar(s);
  const dv = BOARD_D + 1, dvh = 2 * dv * Math.tan(cam.fov * PI / 360); dimPlane.scale.set(dvh * cam.aspect * 1.1, dvh * 1.1, 1);
  capLevelPose();
}

// ---------------------------------------------------------------- Captain Scarla (Hero Lab character)
async function loadCaptain() {
  const gl = await loader.loadAsync('./assets/captain.glb');
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
function capBayPose() {
  if (!cap || !curIsle) return;
  curIsle.group.add(cap.g); const e = curIsle.dockEnd; cap.g.position.set(e.x - 0.25, e.y, e.z - 1.1); cap.g.rotation.set(0, 0.25, 0); cap.g.scale.setScalar(2.5 / cap.h);
}
function capLevelPose() {
  if (!cap || mode !== 'level') return;
  boardG.add(cap.g);
  if (isPortrait()) { cap.g.position.set(-3.45, LAUNCH_Y - 1.45, -0.6); cap.g.scale.setScalar(3.2 / cap.h); cap.g.rotation.set(0.05, 0.45, 0); }
  else { cap.g.position.set(-W / 2 - 3.2, LAUNCH_Y - 1.6, -1); cap.g.scale.setScalar(8.5 / cap.h); cap.g.rotation.set(0.05, 0.5, 0); }
}
let bubbleEl = null, bubbleT = 0;
function say(text, ms = 2800) { if (!cap) return; bubbleEl?.remove(); bubbleEl = $(`<div class="bb-bubble">${text}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000; }
const headPos = new V3();
function placeBubble() {
  if (!bubbleEl) return;
  cap.g.getWorldPosition(headPos); const sc = new V3(); cap.g.getWorldScale(sc); headPos.y += cap.h * sc.y * 1.05;
  headPos.project(cam); const x = (headPos.x + 1) / 2 * innerWidth, y = (1 - headPos.y) / 2 * innerHeight;
  bubbleEl.style.left = Math.max(115, Math.min(innerWidth - 115, x + (mode === 'level' && isPortrait() ? 40 : 0))) + 'px'; bubbleEl.style.top = Math.max(150, y) + 'px';
}

// ---------------------------------------------------------------- loading
async function boot() {
  let n = 0; const total = 6 + CRITTERS.length; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  sea = buildSea(scene);
  const crit = await Promise.all(CRITTERS.map(c => piece(c.id, 'mid').then(p => { tick(); return p; })));
  const critBase = await Promise.all(CRITTERS.map(c => piece(c.id, 'base')));
  const [bomb, disco] = await Promise.all([piece('m07', 'mid'), piece('m08', 'mid')]); tick();
  P = { critters: crit, critBase, bomb, disco };
  SH = createShooter({ group: boardG, P, snd, hooks }); SH.hide(); window.__SH = SH;
  const cp = loadCaptain().then(c => { tick(); return c; });
  await enterIsland(st.island, true); tick();
  cap = await cp; capBayPose(); tick();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  mode = 'title'; state = 'ready';
  for (let k = 0; k < ISLANDS.length; k++) if (k !== st.island && k <= st.island + 1) setTimeout(() => ensureIsland(k), 3000 + k * 1500);
}

// ---------------------------------------------------------------- islands
async function ensureIsland(i) {
  if (!isles[i]) isles[i] = buildIsland(ISLANDS[i], i + 1).then(I => { I.group.visible = false; scene.add(I.group); for (const id of (st.done[ISLANDS[i].id] || [])) applyTask(I, ISLANDS[i].tasks.find(t => t.id === id)); return I; });
  return isles[i];
}
async function enterIsland(i, first = false) {
  const I = await ensureIsland(i);
  if (curIsle) curIsle.group.visible = false;
  curIsle = I; I.group.visible = true; I.group.add(herdGroup());
  if (!first) camCur.pos.add(new V3(0, 10, 8));
  capBayPose(); refreshHerd(); refreshBayHUD(); atm.target = isleProgress(); if (first) atm.cur = atm.target;
}
let _hg = null; function herdGroup() { if (!_hg) { _hg = new THREE.Group(); herd = critterHerd(_hg); } return _hg; }
function refreshHerd() {   // up to 8 rescued critters live on the isle (the species you have rescued most)
  if (!P) return; const list = [];
  const ranked = Object.entries(st.rescued).sort((a, b) => b[1] - a[1]);
  for (const [sp, n] of ranked) for (let k = 0; k < Math.min(3, Math.ceil(n / 4)); k++) list.push(+sp);
  herd.set(list.slice(0, 8), P.critBase);
}
const atm = { cur: 0, target: 0 };
function applyTask(I, t) { if (!t) return; if (t.item) { const m = I.items[t.id]; if (m) { m.visible = true; m.scale.copy(m.userData.base); } } else I.apply[t.kind]?.(true); }
function taskPos(I, t) { if (t.item) return new V3(t.at[0], 0.42 + t.size * 0.7 + 0.2, t.at[1]); return new V3(0, 1.2, 1.8); }
async function animateTask(I, t) {
  const pos = taskPos(I, t);
  if (t.item) {
    const m = I.items[t.id], base = m.userData.base.clone(); m.visible = true; snd.whoosh();
    await anim(0.75, k => { const e = easeBack(Math.min(1, k * 1.1)); m.scale.copy(base).multiplyScalar(Math.max(0.01, e)); m.position.y = 0.42 + (1 - Math.min(1, k * 1.4)) * 2.2; m.rotation.y = (t.rot || 0) + (1 - k) * 1.2; });
    m.scale.copy(base); m.position.y = 0.42; m.rotation.y = t.rot || 0;
    snd.place(); WP.burst(new V3(t.at[0], 0.8, t.at[1]), ['#fff6c2', '#ffffff', '#ffd23f'], 26, { speed: 3.5, up: 2.5, size: 1.3, life: 0.9, spread: t.size * 0.6 });
  } else {
    snd.whoosh(); const kids = I.clutter.children.slice();
    for (const c of kids) { const s0 = c.scale.clone(), wp = new V3(); c.getWorldPosition(wp); anim(0.35, k => c.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - k))).then(() => c.scale.copy(s0)); WP.burst(wp.add(new V3(0, 0.4, 0)), ['#d8c3a5', '#ffffff', '#b89a72'], 12, { speed: 2.5, up: 2, size: 1.3, life: 0.7 }); snd.pop(0, 0); await wait(90); }
    await wait(250); I.apply.clutter(true);
  }
}
async function buyTask(t) {
  if (busy || mode !== 'bay') return;
  if (st.stars < t.cost) { say('Rescue critters to earn ⭐ stars!'); snd.bad(); return; }
  busy = true; st.stars -= t.cost; const def = islandOf();
  st.done[def.id] = [...doneList(def), t.id]; save(); refreshBayHUD(); buzz(15);
  focus = taskPos(curIsle, t); marker.visible = false;
  await anim(0.45, k => { focusT = easeIO(k); });
  await animateTask(curIsle, t);
  atm.target = isleProgress(); cap.play('cheer', true);
  say(['Shipshape!', 'Oh, lovely!', 'The critters will adore it!', 'Bay-utiful!', 'Look at that!', 'So sunny now!'][(Math.random() * 6) | 0]);
  await wait(500); await anim(0.6, k => { focusT = 1 - easeIO(k); }); focus = null;
  if (!nextTasks(def).length) await isleComplete(def);
  busy = false; refreshBayHUD();
}
async function isleComplete(def) {
  snd.win(); cap.play('cheer', true);
  for (let i = 0; i < 4; i++) { WP.burst(new V3((Math.random() - 0.5) * 7, 6, (Math.random() - 0.5) * 6), CONF, 40, { speed: 3, up: 1, size: 1.6, life: 2, grav: 3, spread: 2 }); await wait(160); }
  for (const k of Object.keys(BOOSTS)) st.boosts[k] = (st.boosts[k] || 0) + 1;
  save(); M.add(150, 'island'); coinBurst(150);
  say(`${def.name} restored! +1 of each booster 🎁`, 3600);
  ui.pop(`${def.name.toUpperCase()} RESTORED!`, '#fff', 30, 26);
  checkStickers();
}
async function goNextIsland() {
  if (busy || st.island >= ISLANDS.length - 1) return;
  busy = true; st.island++; save(); await enterIsland(st.island); bgKey = '';
  say(['A new island needs us!', 'Oh dear, look at that beach!', 'Let\'s make it sparkle!'][st.island % 3], 3000);
  if (st.island + 1 < ISLANDS.length) setTimeout(() => ensureIsland(st.island + 1), 3000);
  busy = false;
}

// ---------------------------------------------------------------- bay HUD
function taskIcon(t) { return t.item ? `<img src="./assets/thumbs/${t.item}.webp" alt="">` : t.icon; }
function refreshBayHUD() {
  const def = islandOf(), list = nextTasks(def), p = isleProgress(def);
  el.isle.textContent = `${def.name} · ${Math.round(p * 100)}%`; el.prog.style.width = p * 100 + '%';
  el.starsN.textContent = shownStars; moneyHUD();
  if (!list.length) {
    const more = st.island < ISLANDS.length - 1;
    el.tasks.innerHTML = `<h3><span>${more ? 'Island restored!' : 'The whole bay is restored!'}</span><span>🏝️</span></h3><div class="bb-task"><div class="ic">${more ? '⛵' : '🌸'}</div><div class="nm">${more ? 'Sail to ' + ISLANDS[st.island + 1].name : 'New islands are on the way'}<small>${more ? 'Its critters are waiting' : 'Keep rescuing for stars and stickers'}</small></div>${more ? '<button class="bb-btn bb-coral" data-next>Sail ➜</button>' : ''}</div>`;
    const nb = el.tasks.querySelector('[data-next]'); if (nb) nb.onclick = () => { snd.tap(); goNextIsland(); };
  } else {
    el.tasks.innerHTML = `<h3><span>Restore the island</span><span>${doneList(def).length}/${def.tasks.length}</span></h3>` + list.slice(0, 2).map((t, i) =>
      `<div class="bb-task"><div class="ic">${taskIcon(t)}</div><div class="nm">${t.name}<small>${i === 0 ? (st.stars >= t.cost ? 'Tap to place it!' : 'Earn stars by rescuing') : 'Up next'}</small></div><button class="bb-btn ${st.stars >= t.cost && i === 0 ? 'bb-coral' : 'bb-grey'}" data-t="${t.id}">⭐ ${t.cost}</button></div>`).join('');
    el.tasks.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = list.find(x => x.id === b.dataset.t); if (t !== list[0]) { say('One thing at a time, sailor!'); return; } snd.tap(); buyTask(t); });
  }
  const hard = isHard(st.level);
  el.play.className = 'bb-btn bb-green bb-play' + (hard ? ' hard' : '');
  el.play.innerHTML = `Level ${st.level}${hard ? '<small>HARD LEVEL</small>' : ''}`;
  const nt = list[0]; marker.visible = !!nt && mode === 'bay' && st.stars >= nt.cost;
  if (nt && curIsle) marker.position.copy(taskPos(curIsle, nt));
  el.dailyDot.classList.toggle('bb-hidden', st.dly.last === dayNum());
  const newStk = st.stickers.length - (st.seen.album || 0); el.albumDot.textContent = newStk; el.albumDot.classList.toggle('bb-hidden', newStk <= 0);
}
let shownStars = st.stars;
el.play.onclick = () => { snd.tap(); openPop(); };
el.daily.onclick = () => { snd.tap(); openDaily(); };
el.album.onclick = () => { snd.tap(); openAlbum(); };

// ---------------------------------------------------------------- popups
function closePop() { popEl?.remove(); popEl = null; }
function veil(inner, onClose) {
  closePop(); popEl = $(`<div class="bb-veil bb">${inner}</div>`); document.body.appendChild(popEl);
  popEl.addEventListener('pointerdown', e => { if (e.target === popEl && onClose !== false) { closePop(); onClose?.(); } });
  popEl.querySelector('.x')?.addEventListener('click', () => { snd.tap(); closePop(); onClose?.(); });
  return popEl;
}
let chosen = new Set();
function levelDef(isDaily = dailyMode) { return isDaily ? makeLevel(10 + (D.seed % 11), 1, D.seed, { daily: true }) : makeLevel(st.level, F.k()); }
function goalRow(L) { return Object.entries(L.goals).map(([sp, n]) => `<div><img src="${critImg(+sp)}" alt="">${n}</div>`).join(''); }
function openPop(isDaily = false) {
  if (popEl || busy || mode !== 'bay') return;
  dailyMode = isDaily;
  const L0 = M.lives(), free = isDaily || st.level <= 5;
  if (!free && L0.n <= 0) return openNoLives();
  curLevel = levelDef(); chosen = new Set();
  const boostBtn = k => { const n = st.boosts[k] || 0; return `<button class="bb-btn" data-b="${k}" aria-label="${BOOSTS[k].name}">${boostIcon(k)}<b class="${n ? '' : 'buy'}">${n || '+'}</b></button>`; };
  const p = veil(`<div class="bb-card"><button class="bb-btn x" aria-label="Close">✕</button>
    <h2 class="${curLevel.hard ? 'hard' : isDaily ? 'daily' : ''}">${isDaily ? 'Daily Bay' : 'Level ' + curLevel.n}</h2>
    ${curLevel.hard ? '<div class="lbl" style="color:#d8304a;opacity:1">Hard level · short and tricky</div>' : ''}
    <div class="lbl">Rescue · ${curLevel.shots} bubbles</div><div class="bb-goalrow">${goalRow(curLevel)}</div>
    <div class="lbl">Start boosters</div><div class="bb-boost">${Object.keys(BOOSTS).map(boostBtn).join('')}</div>
    <button class="bb-btn bb-green" data-play>Play${free ? '' : '<span class="sub">❤️ lose a life only if you fail</span>'}</button></div>`);
  p.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const k = b.dataset.b;
    if (!st.boosts[k]) { if (M.spend(BOOSTS[k].price, 'booster:' + k)) { st.boosts[k] = 1; save(); b.querySelector('b').textContent = '1'; b.querySelector('b').className = ''; snd.coin(); toast(boostIcon(k), `${BOOSTS[k].name} booster`, `bought for <i class="bb-coin"></i> ${BOOSTS[k].price}`); } else { snd.bad(); toast('<i class="bb-coin"></i>', `${BOOSTS[k].name}: <i class="bb-coin"></i> ${BOOSTS[k].price}`, 'Win levels for coins, or visit the shop'); } return; }
    snd.tap(); chosen.has(k) ? chosen.delete(k) : chosen.add(k); b.classList.toggle('on', chosen.has(k));
  });
  p.querySelector('[data-play]').onclick = () => { snd.tap(); startLevel(); };
}
function openNoLives() {
  const L = M.lives();
  const p = veil(`<div class="bb-card"><button class="bb-btn x" aria-label="Close">✕</button><h2 class="hard">Out of lives</h2>
    <p style="font-size:44px;margin:6px 0">💔</p><p>Next life in <b data-t>${fmtT((L.nextAt || Date.now()) - Date.now())}</b></p><p style="font-size:14px;opacity:.7">The Daily Bay puzzle is always free to play.</p>
    <button class="bb-btn bb-sea" data-r>▶ Refill lives<span class="sub">watch a short video</span></button></div>`);
  const tmr = setInterval(() => { const t = p.querySelector('[data-t]'); if (!t || !p.isConnected) return clearInterval(tmr); const l = M.lives(); t.textContent = fmtT((l.nextAt || Date.now()) - Date.now()); if (l.n > 0) { clearInterval(tmr); closePop(); openPop(); } }, 1000);
  p.querySelector('[data-r]').onclick = async () => { snd.tap(); if (await M.rewarded('lives')) { closePop(); moneyHUD(); el.livesP.classList.remove('bump'); void el.livesP.offsetWidth; el.livesP.classList.add('bump'); } };
}
// out of bubbles: ONE offer (+5 bubbles); shown 1.3 s after the last shot so it never overlaps the app's own card
function outOfShots() {
  return new Promise(async res => {
    await wait(1300);
    if (mode !== 'level') return res(0);
    snd.bad(); cap?.play('fall', true);
    const left = SH.crittersLeft, viaCoins = usedRevive > 0, price = 120;
    const p = veil(`<div class="bb-card"><h2 class="hard">Out of bubbles!</h2>
      <p>${left} critter${left > 1 ? 's' : ''} still trapped</p><div class="bb-goalrow" style="margin:8px 0">${goalLeftRow()}</div>
      ${viaCoins ? `<button class="bb-btn bb-coral" data-y>+5 bubbles · <i class="bb-coin"></i> ${price}<span class="sub">you have <i class="bb-coin"></i> ${M.coins()}</span></button>` : `<button class="bb-btn bb-sea" data-y>▶ +5 bubbles<span class="sub">watch a short video</span></button>`}
      <button class="bb-btn bb-ghost" data-n>Give up</button></div>`, false);
    let done = false; const finish = n => { if (done) return; done = true; closePop(); res(n); };
    p.querySelector('[data-n]').onclick = () => { snd.tap(); finish(0); };
    p.querySelector('[data-y]').onclick = async () => {
      snd.tap();
      if (viaCoins) { if (M.spend(price, 'more-bubbles')) { usedRevive++; finish(5); } else { snd.bad(); M.shop(); } return; }
      if (await M.rewarded('moves', { title: '+5 bubbles', what: '5 extra bubbles to finish this level' })) { usedRevive++; finish(5); }
    };
    outPop = p;
  });
}
let outPop = null;
function goalLeftRow() { const left = {}; for (const v of SH.G.grid.cells()) if (v.critter >= 0) left[v.critter] = (left[v.critter] || 0) + 1; return Object.entries(left).map(([sp, n]) => `<div><img src="${critImg(+sp)}" alt="">${n}</div>`).join(''); }

// ---------------------------------------------------------------- toast + coins flight
let toastEl = null; const pendingToasts = [];
function toast(icon, title, sub = '') { toastEl?.remove(); toastEl = $(`<div class="bb-toast">${icon.startsWith('<') || icon.startsWith('.') ? (icon.startsWith('.') ? `<img src="${icon}">` : icon) : `<span style="font-size:34px">${icon}</span>`}<div>${title}<small>${sub}</small></div></div>`); document.body.appendChild(toastEl); const t = toastEl; setTimeout(() => t.remove(), 2600); }
function coinBurst(n) {
  const r = el.coinsP.getBoundingClientRect(), k = Math.min(10, Math.max(3, Math.round(n / 20))); coinFlying = true; const target = M.coins(), from = target - n; shownCoins = from;
  for (let i = 0; i < k; i++) setTimeout(() => { const s = $('<div class="bb-fly" style="font-size:34px;width:auto;height:auto"><i class="bb-coin"></i></div>'); document.body.appendChild(s);
    flying.push({ img: s, sx: innerWidth / 2 + (Math.random() - 0.5) * 80, sy: innerHeight * 0.5, tx: r.left + 22, ty: r.top + 20, t: 0, d: 0.6, cx: innerWidth * 0.7, cy: innerHeight * 0.3, upd: () => { shownCoins = Math.round(from + n * (i + 1) / k); if (i === k - 1) { shownCoins = target; coinFlying = false; } moneyHUD(); el.coinsP.classList.remove('bump'); void el.coinsP.offsetWidth; el.coinsP.classList.add('bump'); snd.coin(); } }); }, 200 + i * 90);
}

// ---------------------------------------------------------------- sticker album (critters ×3 tiers + islands + daily)
const TIERS = [[1, 'Bronze'], [10, 'Silver'], [40, 'Gold']];
function stickerDefs() {
  const out = [];
  CRITTERS.forEach((c, i) => TIERS.forEach(([n, t], k) => out.push({ id: `c${i}t${k}`, img: critImg(i), cls: 't' + k, label: n === 1 ? c.name : `${t} ×${n}`, need: () => (st.rescued[i] || 0) >= n, hint: `Rescue ${n} ${c.kind}${n > 1 ? 's' : ''}` })));
  ISLANDS.forEach(d => out.push({ id: 'i' + d.id, img: `./assets/thumbs/${d.dio}.webp`, cls: 'isl', label: d.name.split(' ')[0], need: () => (st.done[d.id] || []).length >= d.tasks.length, hint: `Restore ${d.name}` }));
  out.push({ id: 'daily1', emoji: '📅', cls: 'spc', label: 'Daily', need: () => (st.dly.wins || 0) >= 1, hint: 'Solve a Daily Bay' });
  return out;
}
function checkStickers() {
  const got = [];
  for (const s of stickerDefs()) if (!st.stickers.includes(s.id) && s.need()) { st.stickers.push(s.id); got.push(s); }
  if (!got.length) return; save(); M.add(25 * got.length, 'sticker');
  const show = () => got.forEach((s, i) => setTimeout(() => { toast(s.img ? s.img : s.emoji, `New sticker: ${s.label}`, `+25 <i class="bb-coin"></i> · ${st.stickers.length}/${stickerDefs().length} in your album`); snd.sparkle(); }, 600 + i * 2700));
  if (mode === 'level') pendingToasts.push(show); else show();
  refreshBayHUD();
}
function openAlbum() {
  if (popEl || busy) return;
  const defs = stickerDefs(); st.seen.album = st.stickers.length; save(); refreshBayHUD();
  veil(`<div class="bb-card bb-album"><button class="bb-btn x" aria-label="Close">✕</button><h2>Sticker Album</h2>
    <p>${st.stickers.length} / ${defs.length} stickers · each one +25 <i class="bb-coin"></i></p>
    <div class="bb-stk">${defs.map(s => `<div class="${s.cls}${st.stickers.includes(s.id) ? '' : ' off'}" title="${s.hint}">${s.img ? `<img src="${s.img}" alt="">` : `<span>${s.emoji}</span>`}<em>${st.stickers.includes(s.id) ? s.label : '?'}</em></div>`).join('')}</div>
    <p style="font-size:13px;opacity:.65">Rescue critters to earn bronze, silver and gold stickers.</p></div>`);
}

// ---------------------------------------------------------------- daily bay (streak + one free freeze a week + share grid)
function dailyStatus() {
  const today = dayNum(), d = st.dly, gap = today - (d.last || 0);
  const freezeReady = d.freezeWeek !== weekOf(today);
  const alive = gap <= 1 || (gap === 2 && freezeReady);
  return { today, done: d.last === today, streak: alive ? d.streak || 0 : 0, freezeReady, needsFreeze: gap === 2 && freezeReady };
}
function openDaily() {
  if (popEl || busy || mode !== 'bay') return;
  const s = dailyStatus(), res = st.dly.res;
  veil(`<div class="bb-card"><button class="bb-btn x" aria-label="Close">✕</button><h2 class="daily">Daily Bay</h2>
    <p style="font-size:40px;margin:2px 0">🔥 ${s.streak}</p><p>${s.streak ? `${s.streak}-day streak` : 'Start a streak today!'} · ${s.freezeReady ? '❄️ streak freeze ready' : '❄️ freeze used this week'}</p>
    <p style="font-size:14px;opacity:.7">One puzzle a day, the same for everyone. Free to play, no lives needed. Miss a day? Your weekly freeze keeps the streak.</p>
    ${s.done ? `<div class="bb-grid">${res?.grid || ''}</div><button class="bb-btn bb-sea" data-s>Share my grid</button><p style="font-size:14px;opacity:.7">Solved ✓ · come back tomorrow</p>` : `<button class="bb-btn bb-green" data-p>Play today's puzzle</button>`}</div>`);
  popEl.querySelector('[data-p]')?.addEventListener('click', () => { snd.tap(); closePop(); openPop(true); });
  popEl.querySelector('[data-s]')?.addEventListener('click', () => { snd.tap(); shareGrid(); });
}
function dailyWon(stars, shotsUsed, total, log) {
  const s = dailyStatus(), d = st.dly;
  if (d.last !== s.today) {
    if (s.needsFreeze) { d.freezeWeek = weekOf(s.today); setTimeout(() => toast('❄️', 'Streak freeze used', 'Your streak is safe'), 1500); }
    d.streak = s.streak + 1; d.last = s.today; d.wins = (d.wins || 0) + 1;
  }
  const em = { c: '🐣', p: '🫧', m: '⬜' }, cells = log.map(x => em[x]);
  const rows = []; for (let i = 0; i < cells.length; i += 8) rows.push(cells.slice(i, i + 8).join(''));
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  d.res = { stars, used: shotsUsed, total, grid: rows.join('\n'), text: `Bubblebay Daily · ${date}\n${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${shotsUsed}/${total} bubbles · 🔥${d.streak}\n${rows.join('\n')}` };
  save();
}
async function shareGrid() {
  const r = st.dly.res; if (!r) return;
  const u = new URL(location.href); u.search = '?daily=1'; const text = `${r.text}\n${u.href}`;
  try { if (navigator.share) { await navigator.share({ title: NAME, text }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text); ui.pop('Grid copied!', '#fff', 28, 30); } catch (e) {}
}
gridBtn.addEventListener('click', e => { e.stopPropagation(); snd.tap(); shareGrid(); });

// ---------------------------------------------------------------- level flow
function buildGoalsHUD() {
  const L = curLevel;
  el.goals.innerHTML = `<span class="lv ${L.hard ? 'hard' : ''}">${L.daily ? 'DAILY BAY' : 'LEVEL ' + L.n}${L.hard ? ' · HARD' : ''}</span>` + Object.entries(L.goals).map(([sp, n]) => `<div class="g" data-g="${sp}"><img src="${critImg(+sp)}" alt=""><b>${n}</b></div>`).join('');
  goalsLeft = { ...L.goals };
}
let goalsLeft = {};
function buildBoostBar() {
  el.boosts.innerHTML = Object.keys(BOOSTS).map(k => { const n = st.boosts[k] || 0; return `<button class="bb-btn" data-k="${k}" aria-label="${BOOSTS[k].name}: ${BOOSTS[k].tip}">${boostIcon(k)}<b class="${n ? '' : 'buy'}">${n || '<i class="bb-coin"></i>'}</b></button>`; }).join('');
  el.boosts.querySelectorAll('[data-k]').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); useBooster(b.dataset.k); }));
}
function useBooster(k) {
  if (mode !== 'level' || state !== 'play' || SH.busy) return;
  if (!st.boosts[k]) {
    if (!M.spend(BOOSTS[k].price, 'booster:' + k)) { snd.bad(); toast(boostIcon(k), `${BOOSTS[k].name} · <i class="bb-coin"></i> ${BOOSTS[k].price}`, 'Not enough coins: tap <i class="bb-coin"></i> on the map for the shop'); return; }
    st.boosts[k] = 1; toast(boostIcon(k), `${BOOSTS[k].name} bought`, `<i class="bb-coin"></i> ${BOOSTS[k].price}`);
  }
  if (SH.loadBooster(k)) { st.boosts[k]--; save(); buildBoostBar(); el.boosts.querySelector(`[data-k="${k}"]`)?.classList.add('on'); say(`${BOOSTS[k].name} loaded: it ${BOOSTS[k].tip}!`, 2200); buzz(20); }
}
function startLevel() {
  if (!curLevel) curLevel = levelDef();
  closePop();
  const pre = {}; for (const k of chosen) { if (st.boosts[k] > 0) { st.boosts[k]--; pre[k] = true; } } save(); chosen = new Set();
  mode = 'level'; state = 'play'; recorded = false; marker.visible = false; usedRevive = 0;
  for (const e of [el.top, el.side, el.bot]) e.classList.add('bb-hidden');
  el.lhud.classList.remove('bb-hidden'); el.boosts.classList.remove('bb-hidden'); el.quit.classList.remove('bb-hidden');
  buildGoalsHUD(); buildBoostBar(); layoutBoard();
  SH.start(curLevel, rng(curLevel.seed * 13 + 7), pre); boardG.visible = true;
  if (pre.bolt) setTimeout(() => SH.loadBooster('bolt'), 50);
  capLevelPose(); cap?.play('idle');
  runT0 = performance.now(); B.start(); M.level(st.level); snd.music(true); snd.whoosh();
  const n = curLevel.n;
  const tip = curLevel.daily ? 'Today\'s Daily Bay! Same puzzle for everyone.' : n === 1 ? 'Drag to aim, let go to shoot! Match 3 to pop.' : n === 2 ? 'Tap the shell cannon to swap bubbles!' : n === 3 ? 'Pop or drop a critter\'s bubble to free it!' : n === 4 ? 'Boosters are on the right. Try one!' : n === 9 ? 'Grey rocks only fall, or crack when a group beside them pops.' : curLevel.hard ? 'A hard one! Short and tricky, you can do it.' : '';
  if (tip) setTimeout(() => say(tip, 3400), 800);
}
function toBay() {
  mode = 'bay'; state = 'ready'; SH.hide(); boardG.visible = false; closePop(); outPop = null;
  el.lhud.classList.add('bb-hidden'); el.boosts.classList.add('bb-hidden'); el.quit.classList.add('bb-hidden');
  for (const e of [el.top, el.side, el.bot]) e.classList.remove('bb-hidden');
  capBayPose(); cap?.play('idle'); refreshHerd(); refreshBayHUD();
  if (dailyMode) dailyMode = false;
  while (pendingToasts.length) pendingToasts.shift()();
}
el.quit.onclick = () => {
  snd.tap(); if (SH.busy || state !== 'play') return;
  const free = curLevel.daily || curLevel.n <= 5;
  veil(`<div class="bb-card"><button class="bb-btn x" aria-label="Close">✕</button><h2>Leave level?</h2><p>${free ? 'You can come back any time.' : 'Leaving costs a life ❤️'}</p><button class="bb-btn bb-coral" data-q>Back to the bay</button></div>`);
  popEl.querySelector('[data-q]').onclick = () => { snd.tap(); if (!free) M.useLife(); if (!recorded) { recorded = true; F.level(false, fracDone()); } toBay(); };
};
const fracDone = () => curLevel ? 1 - SH.crittersLeft / curLevel.nCrit : 0;
const flying = [];
const hooks = {
  shots(n) { el.shotsN.textContent = n; el.shots.classList.toggle('low', n <= 5 && n > 0); },
  score(s) { el.scoreN.textContent = s.toLocaleString(); },
  fired() { el.boosts.querySelectorAll('.on').forEach(b => b.classList.remove('on')); },
  boost() {},
  freed(sp, world, left) {
    st.rescued[sp] = (st.rescued[sp] || 0) + 1;
    const slot = el.goals.querySelector(`[data-g="${sp}"]`); goalsLeft[sp] = Math.max(0, (goalsLeft[sp] || 0) - 1);
    const upd = () => { if (!slot) return; slot.querySelector('b').textContent = goalsLeft[sp] > 0 ? goalsLeft[sp] : '✓'; slot.classList.toggle('done', goalsLeft[sp] <= 0); slot.classList.remove('bump'); void slot.offsetWidth; slot.classList.add('bump'); };
    const v = world.clone().project(cam), sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const r = slot ? slot.getBoundingClientRect() : { left: innerWidth / 2, top: 20, width: 0 };
    const img = document.createElement('img'); img.className = 'bb-fly'; img.src = critImg(sp); document.body.appendChild(img);
    flying.push({ img, sx, sy, tx: r.left + r.width / 2, ty: r.top + 20, t: 0, d: 0.7, cx: sx + (Math.random() - 0.5) * 120, cy: Math.min(sy, r.top) - 80, upd });
    cap?.play(left ? 'jump' : 'cheer', true); buzz(25);
    if (left && Math.random() < 0.5) say([`${CRITTERS[sp].name} is free!`, 'Hooray, one more safe!', `Welcome aboard, ${CRITTERS[sp].name}!`][(Math.random() * 3) | 0], 1600);
    const total = curLevel.nCrit, done = total - left;
    el.scoreSt.forEach((s, i) => s.classList.toggle('on', done / total > [0.0, 0.5, 0.99][i]));
  },
  allFreed() { const d = $('<div class="bb-combo pink">All critters safe!</div>'); document.body.appendChild(d); setTimeout(() => d.remove(), 1000); snd.win(); cap?.play('cheer', true); },
  combo(text, lvl) { const d = $(`<div class="bb-combo">${text}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1000); snd.chime(lvl + 2); if (lvl >= 3) cap?.play('cheer', true); buzz(15); },
  shake(a) { shake = Math.max(shake, a); },
  outOfShots,
  done(won, stars, score) {
    if (recorded) return; recorded = true; state = won ? 'won' : 'lost'; el.boosts.classList.add('bb-hidden');
    const ms = performance.now() - runT0, L = curLevel;
    if (won) {
      F.level(true); lastStars = stars; st.stars += stars; st.earned += stars; st.wins++;
      const key = L.daily ? 'd' + D.seed : L.n; st.best[key] = Math.max(st.best[key] || 0, stars);
      if (!L.daily) { st.level++; if (st.level % 5 === 0) { const k = Object.keys(BOOSTS)[(st.level / 5) % 3]; st.boosts[k] = (st.boosts[k] || 0) + 1; setTimeout(() => toast(boostIcon(k), `Free ${BOOSTS[k].name} booster!`, 'a gift every 5 levels'), 2200); } }
      lastCoins = 20 + stars * 10 + (L.hard ? 30 : 0); M.add(lastCoins, 'win');
      if (L.daily) dailyWon(stars, L.shots + usedRevive * 5 - SH.shots, L.shots, SH.log);
      save(); D.won(stars, 'earned ⭐ rescuing critters in'); B.submit(stars, { ms });
      winStars.querySelectorAll('i').forEach(i => i.classList.remove('on'));
      winCoins.querySelector('span').textContent = '+' + lastCoins; dblBtn.classList.remove('bb-hidden'); dblBtn.disabled = false;
      gridBtn.classList.toggle('bb-hidden', !L.daily); if (kitShare) kitShare.classList.toggle('bb-hidden', !!L.daily);
      ui.win(L.daily ? 'DAILY BAY' : L.n, `${L.nCrit} critters rescued · +${stars} ⭐ for the bay`); ui.els.win.querySelector('p').firstChild.textContent = L.daily ? '' : 'LEVEL ';
      for (let i = 0; i < stars; i++) setTimeout(() => { winStars.children[i].classList.add('on'); snd.star(i); }, 900 + i * 280);
      for (let i = 0; i < 3; i++) setTimeout(() => SH.fx.spark((Math.random() - 0.5) * 6, -4 - Math.random() * 4, CONF, 40, { speed: 8, up: 3, size: 1.6, life: 1.4 }), i * 200);
      checkStickers();
    } else {
      F.level(false, fracDone()); snd.lose(); cap?.play('fall', true);
      const free = L.daily || L.n <= 5; if (!free) M.useLife();
      ui.lose('SO CLOSE!', `${SH.crittersLeft} critter${SH.crittersLeft > 1 ? 's' : ''} still trapped${free ? '' : ' · −1 ❤️'} · tap to try again`);
      save();
    }
  },
};
dblBtn.addEventListener('click', async e => {
  e.stopPropagation(); if (dblBtn.disabled) return; dblBtn.disabled = true; snd.tap();
  if (await M.rewarded('double', { what: `${lastCoins * 2} coins instead of ${lastCoins}` })) { M.add(lastCoins, 'double'); lastCoins *= 2; winCoins.querySelector('span').textContent = '+' + lastCoins; snd.coin(); dblBtn.classList.add('bb-hidden'); }
  else dblBtn.disabled = false;
});

ui.onTap(async which => {
  snd.unlock();
  if (which === 'start') {
    mode = 'bay'; state = 'ready'; for (const e of [el.top, el.side, el.bot]) e.classList.remove('bb-hidden');
    refreshBayHUD(); snd.music(true);
    setTimeout(() => say(doneList().length ? 'Ahoy again! Critters need us ⛵' : 'Ahoy! Storms trapped our critters in bubbles. Let\'s pop them free!', 3400), 400);
    if (dailyMode) setTimeout(openDaily, 600);
  } else if (which === 'win') {
    const wasDaily = curLevel?.daily; toBay(); const n = lastStars, c = lastCoins; shownStars = st.stars - n; el.starsN.textContent = shownStars;
    const r = el.starsP.getBoundingClientRect();
    for (let i = 0; i < n; i++) setTimeout(() => { const s = $('<div class="bb-fly" style="font-size:38px;width:auto;height:auto">⭐</div>'); document.body.appendChild(s);
      flying.push({ img: s, sx: innerWidth / 2, sy: innerHeight * 0.45, tx: r.left + 24, ty: r.top + 20, t: 0, d: 0.6, cx: innerWidth * 0.2, cy: innerHeight * 0.3, upd: () => { shownStars++; el.starsN.textContent = shownStars; el.starsP.classList.remove('bump'); void el.starsP.offsetWidth; el.starsP.classList.add('bump'); snd.collect(i); if (shownStars === st.stars) refreshBayHUD(); } }); }, 250 + i * 220);
    coinBurst(c);
    const nt = nextTasks()[0]; setTimeout(() => say(nt && st.stars >= nt.cost ? `Next up: ${nt.name}! ⭐` : wasDaily ? 'See you tomorrow for the next Daily Bay!' : 'More stars, more sunshine!'), 900);
    setTimeout(() => { if (mode === 'bay' && !popEl) M.breakAd('level-end', { level: st.level - 1 }); }, 1800);
  } else if (which === 'lose') { toBay(); setTimeout(() => openPop(curLevel?.daily), 300); }
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
  if (mode === 'level' && state === 'play') { const p = boardPoint(e); if (p) SH.input.down(p.x, p.y); }
  else if (mode === 'bay') drag = { x: e.clientX, yaw: yawT };
});
addEventListener('pointermove', e => {
  if (mode === 'level') { const p = boardPoint(e); if (p) SH.input.move(p.x, p.y); }
  else if (drag) yawT = Math.max(-0.5, Math.min(0.5, drag.yaw - (e.clientX - drag.x) / innerWidth * 1.4));
});
addEventListener('pointerup', () => { if (mode === 'level') SH.input.up(); drag = null; });
addEventListener('pointercancel', () => { SH?.input.cancel(); drag = null; });

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); layoutBoard(); if (mode !== 'level') capBayPose(); }
addEventListener('resize', resize);
let T = 0, perf = {};
R.info.autoReset = false;
loop((d) => {
  const dt = Math.min(0.05, d / 60); T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt / w.dur; w.fn(Math.min(1, w.t)); if (w.t >= 1) { tweens.splice(i, 1); w.res(); } }
  if (!P) return;
  yaw += (yawT - yaw) * Math.min(1, dt * 6);
  const inLevel = mode === 'level', pose = inLevel ? levelPose() : bayPose(), k = Math.min(1, dt * 3);
  camCur.pos.lerp(pose.pos, k); camCur.tgt.lerp(pose.tgt, k); camCur.off += (pose.off - camCur.off) * k;
  cam.position.copy(camCur.pos); cam.lookAt(camCur.tgt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.8); cam.position.x += (Math.random() - 0.5) * shake * 0.18; cam.position.y += (Math.random() - 0.5) * shake * 0.18; }
  cam.setViewOffset(innerWidth, innerHeight, 0, camCur.off, innerWidth, innerHeight);
  // atmosphere
  atm.cur += (atm.target - atm.cur) * Math.min(1, dt * 1.5);
  const p = 0.72 + 0.28 * atm.cur;
  hemi.intensity = 0.75 + 0.4 * p; sun.intensity = 1.7 + 1.0 * p; sun.color.set(mixHex('#e2e6ec', '#fff0d6', p));
  scene.environmentIntensity = 0.5 + 0.25 * p;
  C.grade.uniforms.uSat.value = inLevel ? 1.12 : 0.82 + 0.38 * p;
  sea.mat.color.set(mixHex('#7fb0b6', islandOf().sea, p));
  dimPlane.material.opacity += ((inLevel ? 0.05 : 0) - dimPlane.material.opacity) * Math.min(1, dt * 5); dimPlane.visible = dimPlane.material.opacity > 0.01;
  paintBg(inLevel ? 1 : p);
  sea.update(dt); herd?.update(dt, T);
  if (marker.visible) { bob += dt; marker.children[0].position.y = 0.6 + Math.sin(bob * 4) * 0.12; marker.children[1].position.y = 1.0 + Math.sin(bob * 4) * 0.12; const rg = marker.getObjectByName('ring'); rg.scale.setScalar(1 + (bob * 1.2 % 1) * 0.6); rg.material.opacity = 0.8 * (1 - bob * 1.2 % 1); }
  if (inLevel) { cam.updateMatrixWorld(); SH.update(adOn ? 0 : dt); }
  cap?.mixer.update(dt); WP.update(dt);
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
  autostart() { if (mode !== 'title' || !P) return false; ui.els.start.dispatchEvent(new Event('pointerdown')); setTimeout(() => openPop(dailyMode), 350); setTimeout(startLevel, 700); },
  get state() { return state; }, get level() { return st.level; }, get score() { return st.earned; },
  get stars() { return st.stars; }, get perf() { return perf; }, get mode() { return mode; }, get island() { return st.island; }, get coins() { return M.coins(); },
  get tasksDone() { return Object.values(st.done).reduce((a, l) => a + l.length, 0); }, get sh() { return SH && { shots: SH.shots, left: SH.crittersLeft, state: SH.state, busy: SH.busy }; },
  money: M,
  bot() {
    if (!P || botBusy) return;
    if (mode === 'title') { ui.hideStart(); ui.els.start.dispatchEvent(new Event('pointerdown')); return; }
    if (mode === 'level') {
      if (outPop && outPop.isConnected) { outPop.querySelector('[data-y]').click(); outPop = null; return; }
      if (state === 'play') SH.bot(); return;
    }
    if (popEl) { const pl = popEl.querySelector('[data-play]'); if (pl) startLevel(); else closePop(); return; }
    if (busy || flying.length) return;
    const nt = nextTasks()[0];
    if (!nt && st.island < ISLANDS.length - 1) { botBusy = true; goNextIsland().finally(() => botBusy = false); return; }
    if (nt && st.stars >= nt.cost) { buyTask(nt); return; }
    openPop();
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.textContent = 'Could not load Bubblebay'; });

// Bubble Buns — original kawaii bubble shooter. Aim (the line bounces off the walls), match 3 jelly colours, pop and drop
// bubbles to free baby bunnies and friends, earn stars to decorate the Bun Burrow, fill a sticker album, play the daily.
// Art: kawaii AI-3D library (assets/*.glb: critters, boosters, furniture, chibi characters; ours); jellies, faces, shape
// marks, launcher, rooms, UI and sound: code. Style B · Kawaii Pop.
import { THREE, createUI, store, loop, buzz } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';
import { piece, chibi } from './assets.js';
import { ROOMS, buildRoom, critterHerd, ROOM_W } from './room.js';
import { makeLevel, CRITTERS, COLORS, COLOR_NAMES, isHard, rng } from './levels.js';
import { createShooter, BOARD_H, LY0, TOP_Y } from './shooter.js';
import { W } from './grid.js';
import { skyTex, markIcon } from './art.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Bubble Buns: Bubble Shooter Pop', PI = Math.PI, V3 = THREE.Vector3;
const S = store('bubble-buns');
const st = {
  level: S.get('level', 1), stars: S.get('stars', 0), room: S.get('room', 0), done: S.get('done', {}), wins: S.get('wins', 0), earned: S.get('earned', 0),
  boosts: S.get('boosts', { rainbow: 1, bomb: 1, wand: 1 }), rescued: S.get('rescued', {}), stickers: S.get('stickers', []), seen: S.get('seen', {}),
  dly: S.get('dly', { last: 0, streak: 0, freezeWeek: -1 }), best: S.get('best', {}), marks: S.get('marks', true), three: S.get('three', 0),
};
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('bubble-buns');
const M = money({ game: 'bubble-buns', style: 'B' });
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const BOOSTS = { rainbow: { name: 'Rainbow', price: 150, img: './assets/thumbs/m08.webp', tip: 'matches any colour' }, bomb: { name: 'Bomb', price: 200, img: './assets/thumbs/m07.webp', tip: 'blasts a big circle' }, wand: { name: 'Star Wand', price: 120, img: './assets/thumbs/x04.webp', tip: 'zaps a straight line' } };
const critImg = i => `./assets/thumbs/${CRITTERS[i].id}.webp`;
const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const weekOf = n => Math.floor((n + 3) / 7);

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; R.localClippingEnabled = true; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 300); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.2, bloomThreshold: 0.92, bloomRadius: 0.4, exposure: 1.0, envIntensity: 0.75, lite: LITE, grade: { sat: 1.12, contrast: 1.03, vignette: 0.08, grain: 0 } });
const SKY = { level: skyTex(), room: skyTex('#f3c6e8', '#f8d9f0', '#ffe9f4') };
scene.background = SKY.room;
const hemi = new THREE.HemisphereLight('#fff4fb', '#c9a8e0', 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(5, 11, 8); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5; scene.add(sun, sun.target);
const clip = new THREE.Plane(new V3(0, 1, 0), 1e6);   // the board's top edge in level mode; off (huge constant) in the room

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Bubble Buns<small>POP · RESCUE · DECORATE</small>', hint: 'Tap to play', hand: '', progress: false, score: false });
ui.els.start.classList.add('bn-title');
const D = daily('bubble-buns', ui, { name: NAME });
const kitShare = ui.els.win.querySelector('.hc-btn');
const B = worldBoard({ game: 'bubble-buns', label: 'Stars earned', limits: { maxRun: 6, maxPerSec: 0.5 }, mode: 'sum', corner: 'tr', accent: '#ff8cc6' });
ui.els.win.classList.add('bn-wincard'); ui.els.lose.classList.add('bn-losecard');
ui.els.win.querySelector('h1').textContent = 'YAY!';
const winStars = $('<div class="bn-winstars"><i>⭐</i><i>⭐</i><i>⭐</i></div>'); ui.els.win.querySelector('h1').after(winStars);
const winCoins = $('<div class="bn-wincoins"><i class="bn-coin"></i><span>+0</span></div>'); winStars.after(winCoins);
const dblBtn = $('<button class="bn-btn bn-mint bn-offer">▶ Double coins<small>watch a short video</small></button>');
const gridBtn = $('<button class="bn-btn bn-lilac bn-offer">Share my daily grid</button>');
const shareRow = $('<div class="bn-sharerow"></div>'); ui.els.win.querySelector('[data-x]').after(shareRow); shareRow.append(dblBtn, gridBtn); if (kitShare) shareRow.append(kitShare);
for (const b of [dblBtn, gridBtn]) b.addEventListener('pointerdown', e => e.stopPropagation());
const loadEl = document.getElementById('bn-load'), loadBar = loadEl.querySelector('b');
const HOUSE = '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10v9.5h13V10" fill="#fff"/><path d="M12 13.2c-1.3-1.5-3.6-.4-2.6 1.4.6 1 2.6 2.4 2.6 2.4s2-1.4 2.6-2.4c1-1.8-1.3-2.9-2.6-1.4z" fill="#ff5fa2"/></svg>';
const CLOUD = '<svg viewBox="0 0 146 62" preserveAspectRatio="none"><path fill="#ff7eb6" stroke="#fff" stroke-width="3" d="M30 58c-14 0-24-8-24-19 0-9 7-16 16-17 2-11 12-18 23-17 6-5 14-7 22-5 8-3 19-2 26 4 10-2 20 4 23 13 9 1 16 8 16 17 0 13-11 24-26 24z"/></svg>';

const hud = $(`<div class="bn">
  <div id="bn-top" class="bn-hidden">
    <div class="bn-row"><div class="bn-pill stars"><i>⭐</i><span>0</span></div><div class="bn-pill coins" role="button" aria-label="Shop"><i><i class="bn-coin"></i></i><span>0</span><b>+</b></div><div class="bn-pill lives"><i>💗</i><span>5</span><small></small></div></div>
    <div class="bn-roomname"><span></span><div class="bn-prog"><i></i></div></div>
  </div>
  <div id="bn-side" class="bn-hidden"><button class="bn-btn bn-round bn-mint daily" aria-label="Daily puzzle">📅<em class="bn-hidden">!</em></button><button class="bn-btn bn-round bn-pink album" aria-label="Sticker album">🎀<em class="bn-hidden"></em></button><button class="bn-btn bn-round bn-lilac opts" aria-label="Settings">⚙️</button></div>
  <div id="bn-bot" class="bn-hidden"><div class="bn-tasks"></div><button class="bn-btn bn-pink bn-play"></button></div>
  <div id="bn-lhud" class="bn-hidden"><div class="bn-cloud">${CLOUD}<span></span></div><div class="bn-bar"><div class="bn-score"><b>0</b><div class="st"><i>⭐</i><i>⭐</i><i>⭐</i></div></div><div class="bn-goals"></div></div></div>
  <div id="bn-shots" class="bn-hidden"><b>0</b><small>BUBBLES</small></div>
  <div id="bn-boosts" class="bn-hidden"></div>
  <button id="bn-home" class="bn-btn bn-lilac bn-hidden" aria-label="Back to the burrow">${HOUSE}</button>
</div>`);
document.body.appendChild(hud);
const q = s => hud.querySelector(s);
const el = { top: q('#bn-top'), side: q('#bn-side'), bot: q('#bn-bot'), starsP: q('.bn-pill.stars'), starsN: q('.bn-pill.stars span'), coinsP: q('.bn-pill.coins'), coinsN: q('.bn-pill.coins span'),
  livesP: q('.bn-pill.lives'), livesN: q('.bn-pill.lives span'), livesT: q('.bn-pill.lives small'), roomN: q('.bn-roomname span'), prog: q('.bn-prog i'), tasks: q('.bn-tasks'), play: q('.bn-play'),
  daily: q('.bn-round.daily'), dailyDot: q('.bn-round.daily em'), album: q('.bn-round.album'), albumDot: q('.bn-round.album em'), opts: q('.bn-round.opts'),
  lhud: q('#bn-lhud'), cloud: q('.bn-cloud'), cloudT: q('.bn-cloud span'), scoreN: q('.bn-score b'), scoreSt: hud.querySelectorAll('.bn-score .st i'), goals: q('.bn-goals'),
  shots: q('#bn-shots'), shotsN: q('#bn-shots b'), boosts: q('#bn-boosts'), home: q('#bn-home') };
el.coinsP.onclick = () => { snd.tap(); M.shop(); };

// money HUD; ads pause our music
let shownCoins = M.coins(), coinFlying = false;
const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function moneyHUD() {
  el.coinsN.textContent = shownCoins.toLocaleString();
  const L = M.lives(); el.livesN.textContent = L.unlimited ? '∞' : L.n;
  el.livesT.textContent = !L.unlimited && L.n < L.max && L.nextAt ? fmtT(L.nextAt - Date.now()) : '';
}
M.onChange(s => { if (!coinFlying) shownCoins = s.coins; moneyHUD(); });
setInterval(moneyHUD, 1000);
let adOn = false;
addEventListener('ap:ad', e => { adOn = e.detail.phase === 'start'; snd.music(!adOn); });

// ---------------------------------------------------------------- state
let mode = 'title', state = 'ready', P = null, SH = null, host = null, bun = null, rooms = {}, curRoom = null, busy = false, popEl = null, dailyMode = !!D.seed, curLevel = null;
let runT0 = 0, recorded = false, lastStars = 0, lastCoins = 0, herd = null, usedRevive = 0;
const roomOf = () => ROOMS[Math.min(st.room, ROOMS.length - 1)];
const doneList = (def = roomOf()) => st.done[def.id] || [];
const nextTasks = (def = roomOf()) => def.tasks.filter(t => !doneList(def).includes(t.id));
const roomProgress = (def = roomOf()) => doneList(def).length / def.tasks.length;

// ---------------------------------------------------------------- tweens + world sparkles
const tweens = [];
const anim = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
const WP = (() => {
  const N = 400, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); m.count = 0; m.frustumCulled = false; scene.add(m);
  const tmp = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
        list.push({ p: new V3(pos.x + (Math.random() - 0.5) * spread, pos.y, pos.z + (Math.random() - 0.5) * spread), v: new V3(Math.cos(a) * Math.sin(b) * sp, up * (0.5 + Math.random()), Math.sin(a) * Math.sin(b) * sp), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 6; const f = p.life / p.max;
        e.set(p.r, p.r * 0.6, 0); qq.setFromEuler(e); s.setScalar(p.size * (0.3 + f * 0.9)); tmp.compose(p.p, qq, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); i++; }
      m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    },
  };
})();
const CONF = ['#ff5fa2', '#ffd23f', '#33d6a6', '#4aa8ff', '#b47cff', '#ffffff', '#ff8cc6'];

// task marker: a bobbing pink heart + glow ring
const marker = new THREE.Group();
{ const hs = new THREE.Shape(); hs.moveTo(0, -0.85); hs.bezierCurveTo(-1.25, 0.05, -0.65, 1.05, 0, 0.42); hs.bezierCurveTo(0.65, 1.05, 1.25, 0.05, 0, -0.85);
  const hm = new THREE.MeshPhysicalMaterial({ color: '#ff6fae', emissive: '#ff2e7e', emissiveIntensity: 0.35, roughness: 0.2, clearcoat: 1 });
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 4 }), hm); heart.scale.setScalar(0.3); heart.position.y = 0.9; heart.name = 'h'; marker.add(heart);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#ffd6ea', transparent: true, opacity: 0.8, toneMapped: false })); ring.rotation.x = PI / 2; ring.name = 'ring'; marker.add(ring);
  marker.visible = false; scene.add(marker); }

// ---------------------------------------------------------------- camera
const camCur = { pos: new V3(5, 7, 12), tgt: new V3(0, 1.4, 0), off: 0 };
let yaw = 0.42, yawT = 0.42, focus = null, focusT = 0, bob = 0;
const wideScreen = () => innerWidth > 900 && innerWidth / innerHeight > 1.2;
function roomPose() {
  const wide = wideScreen(), ttl = mode === 'title';
  const topPx = ttl ? innerHeight * 0.36 : wide ? 70 : 104, botPx = ttl ? innerHeight * 0.14 : wide ? 30 : (el.bot.offsetHeight || 220) + 18;
  const free = Math.max(200, innerHeight - topPx - botPx);
  const tanV = Math.tan(cam.fov * PI / 360), tanH = tanV * cam.aspect;
  const tgt = new V3(wide ? -0.6 : -0.3, 1.5, -0.3);
  const dir = new V3(Math.sin(yaw), 0.4, Math.cos(yaw)).normalize();
  let dist = Math.max((ROOM_W * 0.47) / (tanH * (wide ? 0.62 : 0.98)), 4.2 / (tanV * free / innerHeight));
  if (focus && focusT > 0) { tgt.lerp(focus, 0.35 * focusT); dist *= 1 - 0.2 * focusT; }
  return { pos: tgt.clone().addScaledVector(dir, dist), tgt, off: innerHeight / 2 - (topPx + free / 2) };
}
function levelPose() { return { pos: new V3(0, 3, 14), tgt: new V3(0, 3, 0), off: 0 }; }

// ---------------------------------------------------------------- shooter board (attached to the camera)
const BOARD_D = 6;
const boardG = new THREE.Group(); cam.add(boardG); boardG.visible = false;
let shake = 0;
const isPortrait = () => innerWidth / innerHeight < 0.8;
function layoutBoard() {
  const vh = 2 * BOARD_D * Math.tan(cam.fov * PI / 360), vw = vh * cam.aspect;
  const top = 116, bot = wideScreen() ? 16 : 84;
  const availH = innerHeight - top - bot, availW = innerWidth * (isPortrait() ? 0.99 : 0.6);
  const s = Math.min(availW / innerWidth * vw / (W + 1.75), availH / innerHeight * vh / (BOARD_H + 0.6));
  const usedPx = (BOARD_H + 0.6) * s / vh * innerHeight, padPx = Math.max(0, (availH - usedPx) * 0.35);
  const topY = (0.5 - (top + padPx) / innerHeight) * vh;
  boardG.position.set(0, topY - (TOP_Y + 0.6) * s, -BOARD_D); boardG.scale.setScalar(s);
  placeLevelChars();
}

// ---------------------------------------------------------------- characters: host girl (room) + bunny mascot (level)
function hostRoomPose() { if (!host || !curRoom) return; curRoom.group.add(host.g); host.g.position.set(2.0, 0, 1.6); host.g.rotation.set(0, -0.35, 0); host.g.scale.setScalar(2.35); }
function placeLevelChars() {
  if (!bun || mode !== 'level') return;
  boardG.add(bun.g);
  if (isPortrait()) { bun.g.position.set(W / 2 - 0.7, LY0 - 1.55, 0.6); bun.g.scale.setScalar(2.5); bun.g.rotation.set(0.1, -0.45, 0); }
  else { bun.g.position.set(W / 2 + 2.6, LY0 - 1.9, 0); bun.g.scale.setScalar(4.2); bun.g.rotation.set(0.05, -0.5, 0); }
  if (host) { if (wideScreen()) { boardG.add(host.g); host.g.position.set(-W / 2 - 3.4, LY0 - 2.4, -0.5); host.g.scale.setScalar(9.5); host.g.rotation.set(0.04, 0.45, 0); } else if (host.g.parent === boardG) boardG.remove(host.g); }
}
let sayEl = null, sayT = 0, sayWho = null;
function say(text, ms = 2800, who = null) { sayEl?.remove(); sayEl = $(`<div class="bn-say">${text}</div>`); document.body.appendChild(sayEl); sayT = ms / 1000; sayWho = who || (mode === 'level' ? bun : host); placeSay(); }
const headPos = new V3();
function placeSay() {
  if (!sayEl || !sayWho) return;
  sayWho.g.getWorldPosition(headPos); const sc = new V3(); sayWho.g.getWorldScale(sc); headPos.y += sc.y * 1.02;
  headPos.project(cam); const x = (headPos.x + 1) / 2 * innerWidth, y = (1 - headPos.y) / 2 * innerHeight;
  sayEl.style.left = Math.max(112, Math.min(innerWidth - 112, x - (mode === 'level' && isPortrait() ? 40 : 0))) + 'px'; sayEl.style.top = Math.max(130, y) + 'px';
}

// ---------------------------------------------------------------- loading
async function boot() {
  let n = 0; const total = 10; const tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  const crit = await Promise.all(CRITTERS.map(c => piece(c.id, 'mid'))); tick();
  const critBase = await Promise.all(CRITTERS.map(c => piece(c.id, 'base'))); tick();
  const [bomb, rainbow, wand, cube] = await Promise.all([piece('m07', 'mid'), piece('m08', 'mid'), piece('x04', 'mid'), piece('g07', 'base')]); tick();
  P = { critters: crit, critBase, bomb, rainbow, wand, cube };
  SH = createShooter({ group: boardG, P, snd, hooks, clip }); SH.hide(); SH.marks = st.marks;
  const hp = chibi('k01').then(c => { tick(); return c; }), bp = chibi('k06').then(c => { tick(); return c; });
  await enterRoom(st.room, true); tick(); tick();
  host = await hp; hostRoomPose(); host.play('wave', true); bun = await bp; tick(); tick();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  mode = 'title'; state = 'ready';
  setTimeout(prepLevel, 1200);
  if (st.room + 1 < ROOMS.length) setTimeout(() => ensureRoom(st.room + 1), 4000);
}

// ---------------------------------------------------------------- rooms
async function ensureRoom(i) {
  if (!rooms[i]) rooms[i] = buildRoom(ROOMS[i]).then(Rm => { Rm.group.visible = false; scene.add(Rm.group); const done = st.done[ROOMS[i].id] || []; for (const id of done) applyTask(Rm, ROOMS[i].tasks.find(t => t.id === id)); return Rm; });
  return rooms[i];
}
async function enterRoom(i, first = false) {
  const Rm = await ensureRoom(i);
  if (curRoom) curRoom.group.visible = false;
  curRoom = Rm; Rm.group.visible = mode !== 'level'; Rm.group.add(herdGroup());
  if (!first) camCur.pos.add(new V3(0, 6, 6));
  hostRoomPose(); refreshHerd(); refreshRoomHUD(); atm.target = roomProgress(); if (first) atm.cur = atm.target;
}
let _hg = null; function herdGroup() { if (!_hg) { _hg = new THREE.Group(); herd = critterHerd(_hg); } return _hg; }
function refreshHerd() {   // the critters you've rescued most hop around the room (up to 7)
  if (!P) return; const list = [];
  for (const [sp, n] of Object.entries(st.rescued).sort((a, b) => b[1] - a[1])) for (let k = 0; k < Math.min(2, Math.ceil(n / 5)); k++) list.push(+sp);
  herd.set(list.slice(0, 7), P.critBase);
}
const atm = { cur: 0, target: 0 };
function applyTask(Rm, t) { if (!t) return; if (t.item) { const m = Rm.items[t.id]; if (m) { m.visible = true; m.scale.copy(m.userData.base); } } else Rm.apply.clutter(true); }
function taskPos(t) { return t.item ? new V3(t.at[0], (t.y || 0) + t.size * 0.6 + 0.3, t.at[1]) : new V3(-0.4, 1.2, 0); }
async function animateTask(Rm, t) {
  if (t.item) {
    const m = Rm.items[t.id], base = m.userData.base.clone(), y0 = m.userData.y; m.visible = true; snd.whoosh();
    await anim(0.75, k => { const e = easeBack(Math.min(1, k * 1.1)); m.scale.copy(base).multiplyScalar(Math.max(0.01, e)); m.position.y = y0 + (1 - Math.min(1, k * 1.4)) * 2.4; m.rotation.y = (t.rot || 0) + (1 - k) * 1.4; });
    m.scale.copy(base); m.position.y = y0; m.rotation.y = t.rot || 0;
    snd.place(); WP.burst(new V3(t.at[0], y0 + 0.5, t.at[1]), ['#fff6c2', '#ffffff', '#ff9ccb', '#c9a2ff'], 30, { speed: 3.5, up: 2.5, size: 1.3, life: 0.9, spread: t.size * 0.5 });
  } else {
    snd.whoosh(); const kids = Rm.clutter.children.slice();
    for (const c of kids) { const s0 = c.scale.clone(), wp = new V3(); c.getWorldPosition(wp); anim(0.35, k => c.scale.copy(s0).multiplyScalar(Math.max(0.001, 1 - k))).then(() => c.scale.copy(s0)); WP.burst(wp.add(new V3(0, 0.4, 0)), ['#ffd6ea', '#ffffff', '#e8c39a'], 12, { speed: 2.5, up: 2, size: 1.3, life: 0.7 }); snd.pop(0, 0); await wait(90); }
    await wait(250); Rm.apply.clutter(true);
  }
}
async function buyTask(t) {
  if (busy || mode !== 'room') return;
  if (st.stars < t.cost) { say('Free critters to earn ⭐ stars!'); snd.bad(); return; }
  busy = true; st.stars -= t.cost; const def = roomOf();
  st.done[def.id] = [...doneList(def), t.id]; save(); refreshRoomHUD(); buzz(15);
  focus = taskPos(t); marker.visible = false;
  await anim(0.45, k => { focusT = easeIO(k); });
  await animateTask(curRoom, t);
  atm.target = roomProgress(); host?.play('cheer', true);
  say(['So cute!!', 'Eee, I love it!', 'The buns will adore it!', 'Kawaii overload!', 'Look at that!', 'Perfect spot!'][(Math.random() * 6) | 0]);
  await wait(500); await anim(0.6, k => { focusT = 1 - easeIO(k); }); focus = null;
  if (!nextTasks(def).length) await roomComplete(def);
  busy = false; refreshRoomHUD();
}
async function roomComplete(def) {
  snd.win(); host?.play('jump', true);
  for (let i = 0; i < 4; i++) { WP.burst(new V3((Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 4), CONF, 40, { speed: 3, up: 1, size: 1.6, life: 2, grav: 3, spread: 2 }); await wait(160); }
  for (const k of Object.keys(BOOSTS)) st.boosts[k] = (st.boosts[k] || 0) + 1;
  save(); M.add(150, 'room'); coinBurst(150);
  say(`${def.name} is done! +1 of every booster 🎁`, 3600);
  checkStickers();
}
async function goNextRoom() {
  if (busy || st.room >= ROOMS.length - 1) return;
  busy = true; st.room++; save(); await enterRoom(st.room);
  say(['A new room for the buns!', 'Let\'s make this one dreamy!', 'Ooh, so much space!'][st.room % 3], 3000);
  if (st.room + 1 < ROOMS.length) setTimeout(() => ensureRoom(st.room + 1), 3000);
  busy = false;
}

// ---------------------------------------------------------------- room HUD
const taskIcon = t => t.item ? `<img src="./assets/thumbs/${t.item}.webp" alt="">` : t.icon;
let shownStars = st.stars;
function refreshRoomHUD() {
  const def = roomOf(), list = nextTasks(def), p = roomProgress(def);
  el.roomN.textContent = `${def.name} · ${Math.round(p * 100)}%`; el.prog.style.width = p * 100 + '%';
  el.starsN.textContent = shownStars; moneyHUD();
  if (!list.length) {
    const more = st.room < ROOMS.length - 1;
    el.tasks.innerHTML = `<h3><span>${more ? 'Room finished!' : 'The whole burrow is done!'}</span><span>🏡</span></h3><div class="bn-task"><div class="ic">${more ? '🗝️' : '🌸'}</div><div class="nm">${more ? 'Open the ' + ROOMS[st.room + 1].name : 'New rooms are on the way'}<small>${more ? 'More buns are moving in' : 'Keep rescuing for stars and stickers'}</small></div>${more ? '<button class="bn-btn bn-mint" data-next>Go ➜</button>' : ''}</div>`;
    const nb = el.tasks.querySelector('[data-next]'); if (nb) nb.onclick = () => { snd.tap(); goNextRoom(); };
  } else {
    el.tasks.innerHTML = `<h3><span>Decorate the burrow</span><span>${doneList(def).length}/${def.tasks.length}</span></h3>` + list.slice(0, 2).map((t, i) =>
      `<div class="bn-task"><div class="ic">${taskIcon(t)}</div><div class="nm">${t.name}<small>${i === 0 ? (st.stars >= t.cost ? 'Tap to place it!' : 'Earn stars by rescuing') : 'Up next'}</small></div><button class="bn-btn ${st.stars >= t.cost && i === 0 ? 'bn-pink' : 'bn-grey'}" data-t="${t.id}">⭐ ${t.cost}</button></div>`).join('');
    el.tasks.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = list.find(x => x.id === b.dataset.t); if (t !== list[0]) { say('One thing at a time!'); return; } snd.tap(); buyTask(t); });
  }
  const hard = isHard(st.level);
  el.play.className = 'bn-btn bn-pink bn-play' + (hard ? ' hard' : '');
  el.play.innerHTML = `Level ${st.level}${hard ? '<small>HARD LEVEL</small>' : ''}`;
  const nt = list[0]; marker.visible = !!nt && mode === 'room' && st.stars >= nt.cost;
  if (nt && curRoom) marker.position.copy(taskPos(nt));
  el.dailyDot.classList.toggle('bn-hidden', st.dly.last === dayNum());
  const newStk = st.stickers.length - (st.seen.album || 0); el.albumDot.textContent = newStk; el.albumDot.classList.toggle('bn-hidden', newStk <= 0);
}
el.play.onclick = () => { snd.tap(); openPop(); };
el.daily.onclick = () => { snd.tap(); openDaily(); };
el.album.onclick = () => { snd.tap(); openAlbum(); };
el.opts.onclick = () => { snd.tap(); openOpts(); };

// ---------------------------------------------------------------- popups
function closePop() { popEl?.remove(); popEl = null; }
function veil(inner, onClose) {
  closePop(); popEl = $(`<div class="bn-veil bn">${inner}</div>`); document.body.appendChild(popEl);
  popEl.addEventListener('pointerdown', e => { if (e.target === popEl && onClose !== false) { closePop(); onClose?.(); } });
  popEl.querySelector('.x')?.addEventListener('click', () => { snd.tap(); closePop(); onClose?.(); });
  return popEl;
}
// level generation is a little heavy (its shot budget is measured by a test bot), so the next level is prepared early
const lvCache = new Map();
function levelDef(isDaily = dailyMode) {
  if (isDaily) { const k = 'd' + D.seed; if (!lvCache.has(k)) lvCache.set(k, makeLevel(10 + (D.seed % 9), 1, D.seed, { daily: true })); return lvCache.get(k); }
  const fk = Math.round(F.k() * 20) / 20, k = st.level + '|' + fk;
  if (!lvCache.has(k)) { if (lvCache.size > 6) lvCache.clear(); lvCache.set(k, makeLevel(st.level, fk)); }
  return lvCache.get(k);
}
function prepLevel() { if (mode !== 'level') try { levelDef(false); } catch (e) { console.error(e); } }
let chosen = new Set();
const goalRow = L => Object.entries(L.goals).map(([sp, n]) => `<div><img src="${critImg(+sp)}" alt="">×${n}</div>`).join('');
function openPop(isDaily = false) {
  if (popEl || busy || mode !== 'room') return;
  dailyMode = isDaily;
  const free = isDaily || st.level <= 5;
  if (!free && M.lives().n <= 0 && !M.lives().unlimited) return openNoLives();
  curLevel = levelDef(); chosen = new Set();
  const boostBtn = k => { const n = st.boosts[k] || 0; return `<button class="bn-btn" data-b="${k}" aria-label="${BOOSTS[k].name}"><img src="${BOOSTS[k].img}" alt=""><b class="${n ? '' : 'buy'}">${n || '+'}</b></button>`; };
  const p = veil(`<div class="bn-card"><button class="bn-btn x" aria-label="Close">✕</button>
    <h2 class="${curLevel.hard ? 'hard' : isDaily ? 'daily' : ''}">${isDaily ? 'Daily Pop' : 'Level ' + curLevel.n}</h2>
    ${curLevel.hard ? '<p style="color:#e2483d">Hard level · short and tricky</p>' : ''}
    <div class="lbl">Free the babies · ${curLevel.shots} bubbles</div><div class="bn-goalrow">${goalRow(curLevel)}</div>
    <div class="lbl">Start boosters</div><div class="bn-boostpick">${Object.keys(BOOSTS).filter(k => k !== 'wand').map(boostBtn).join('')}</div>
    <button class="bn-btn bn-pink big" data-play>Play!${free ? '' : '<span class="sub">💗 you only lose a life if you fail</span>'}</button></div>`);
  p.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const k = b.dataset.b;
    if (!st.boosts[k]) { if (M.spend(BOOSTS[k].price, 'booster:' + k)) { st.boosts[k] = 1; save(); b.querySelector('b').textContent = '1'; b.querySelector('b').className = ''; snd.coin(); toast(BOOSTS[k].img, `${BOOSTS[k].name} booster`, `bought for ${BOOSTS[k].price} coins`); } else { snd.bad(); toast(BOOSTS[k].img, `${BOOSTS[k].name}: ${BOOSTS[k].price} coins`, 'Win levels for coins, or visit the shop'); } return; }
    snd.tap(); chosen.has(k) ? chosen.delete(k) : chosen.add(k); b.classList.toggle('on', chosen.has(k));
  });
  p.querySelector('[data-play]').onclick = () => { snd.tap(); startLevel(); };
}
function openNoLives() {
  const L = M.lives();
  const p = veil(`<div class="bn-card"><button class="bn-btn x" aria-label="Close">✕</button><h2 class="hard">Out of lives</h2>
    <p style="font-size:48px;margin:4px 0">💔</p><p>Next life in <b data-t>${fmtT((L.nextAt || Date.now()) - Date.now())}</b></p><p style="font-size:14px;opacity:.7">The Daily Pop is always free to play.</p>
    <button class="bn-btn bn-mint big" data-r>▶ Refill lives<span class="sub">watch a short video</span></button></div>`);
  const tmr = setInterval(() => { const t = p.querySelector('[data-t]'); if (!t || !p.isConnected) return clearInterval(tmr); const l = M.lives(); t.textContent = fmtT((l.nextAt || Date.now()) - Date.now()); if (l.n > 0) { clearInterval(tmr); closePop(); openPop(); } }, 1000);
  p.querySelector('[data-r]').onclick = async () => { snd.tap(); if (await M.rewarded('lives')) { closePop(); moneyHUD(); bump(el.livesP); } };
}
const bump = e => { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); };
// out of bubbles: ONE offer (+5 bubbles), shown 1.3 s after the last shot (never within 1.2 s of losing)
let outPop = null;
function outOfShots() {
  return new Promise(async res => {
    await wait(1300);
    if (mode !== 'level') return res(0);
    snd.bad(); bun?.play('jump', true);
    const left = SH.crittersLeft, viaCoins = usedRevive > 0, price = 120;
    const p = veil(`<div class="bn-card"><h2 class="hard">Out of bubbles!</h2>
      <p>${left} bab${left > 1 ? 'ies' : 'y'} still trapped</p><div class="bn-goalrow" style="margin:8px 0">${goalLeftRow()}</div>
      ${viaCoins ? `<button class="bn-btn bn-butter big" data-y>+5 bubbles · <i class="bn-coin"></i> ${price}<span class="sub">you have ${M.coins()} coins</span></button>` : `<button class="bn-btn bn-mint big" data-y>▶ +5 bubbles<span class="sub">watch a short video</span></button>`}
      <button class="bn-btn bn-ghost big" data-n>Give up</button></div>`, false);
    let done = false; const finish = n => { if (done) return; done = true; closePop(); outPop = null; res(n); };
    p.querySelector('[data-n]').onclick = () => { snd.tap(); finish(0); };
    p.querySelector('[data-y]').onclick = async () => {
      snd.tap();
      if (viaCoins) { if (M.spend(price, 'more-bubbles')) { usedRevive++; finish(5); } else { snd.bad(); M.shop(); } return; }
      if (await M.rewarded('moves', { title: '+5 bubbles', what: '5 extra bubbles to finish this level' })) { usedRevive++; finish(5); }
    };
    outPop = p;
  });
}
function goalLeftRow() { const left = {}; for (const v of SH.G.grid.cells()) if (v.critter >= 0) left[v.critter] = (left[v.critter] || 0) + 1; return Object.entries(left).map(([sp, n]) => `<div><img src="${critImg(+sp)}" alt="">×${n}</div>`).join(''); }
function openOpts() {
  if (popEl || busy) return;
  const p = veil(`<div class="bn-card"><button class="bn-btn x" aria-label="Close">✕</button><h2>Settings</h2>
    <div class="bn-set" style="border:0"><div><b>Sound + music</b><small>Squishy pops and a bouncy tune</small></div><button class="bn-tog ${snd.muted ? '' : 'on'}" data-o="snd" aria-label="Sound"></button></div>
    <div class="bn-set"><div><b>Bubble shapes</b><small>A little shape on every jelly, so colour is never the only clue</small></div><button class="bn-tog ${st.marks ? 'on' : ''}" data-o="marks" aria-label="Bubble shapes"></button></div>
    <div class="bn-legend">${COLORS.map((c, i) => `<img src="${markIcon(i, 60)}" alt="${COLOR_NAMES[i]}" title="${COLOR_NAMES[i]}">`).join('')}</div></div>`);
  p.querySelector('[data-o="snd"]').onclick = e => { const m = snd.toggle(); e.currentTarget.classList.toggle('on', !m); snd.tap(); };
  p.querySelector('[data-o="marks"]').onclick = e => { st.marks = !st.marks; save(); SH.marks = st.marks; e.currentTarget.classList.toggle('on', st.marks); snd.tap(); };
}

// ---------------------------------------------------------------- toast + flights
let toastEl = null; const pendingToasts = [];
function toast(icon, title, sub = '') { toastEl?.remove(); toastEl = $(`<div class="bn-toast">${icon.startsWith('.') ? `<img src="${icon}" alt="">` : `<span style="font-size:34px">${icon}</span>`}<div>${title}<small>${sub}</small></div></div>`); document.body.appendChild(toastEl); const t = toastEl; setTimeout(() => t.remove(), 2600); }
const flying = [];
function coinBurst(n) {
  const r = el.coinsP.getBoundingClientRect(), k = Math.min(10, Math.max(3, Math.round(n / 20))); coinFlying = true; const target = M.coins(), from = target - n; shownCoins = from;
  for (let i = 0; i < k; i++) setTimeout(() => { const s = $('<img class="bn-fly" src="./assets/thumbs/x02.webp" alt="">'); document.body.appendChild(s);
    flying.push({ img: s, sx: innerWidth / 2 + (Math.random() - 0.5) * 80, sy: innerHeight * 0.5, tx: r.left + 20, ty: r.top + 18, t: 0, d: 0.6, cx: innerWidth * 0.7, cy: innerHeight * 0.3, upd: () => { shownCoins = Math.round(from + n * (i + 1) / k); if (i === k - 1) { shownCoins = target; coinFlying = false; } moneyHUD(); bump(el.coinsP); snd.coin(); } }); }, 200 + i * 90);
}

// ---------------------------------------------------------------- sticker album (critters × 3 tiers, rooms, specials)
const TIERS = [[1, 'Friend'], [10, 'Silver'], [40, 'Gold']];
const ROOM_ICON = { bed: 'h01', cafe: 'h09', study: 'h03' };
function stickerDefs() {
  const out = [];
  CRITTERS.forEach((c, i) => TIERS.forEach(([n, t], k) => out.push({ id: `c${i}t${k}`, img: critImg(i), cls: 't' + k, label: n === 1 ? c.name : `${t} ×${n}`, need: () => (st.rescued[i] || 0) >= n, hint: `Rescue ${n} ${c.kind}${n > 1 ? 's' : ''}` })));
  ROOMS.forEach(d => out.push({ id: 'r' + d.id, img: `./assets/thumbs/${ROOM_ICON[d.id]}.webp`, cls: 'room', label: d.name.split(' ').pop(), need: () => (st.done[d.id] || []).length >= d.tasks.length, hint: `Finish the ${d.name}` }));
  out.push({ id: 'daily1', emoji: '📅', cls: 'spc', label: 'Daily', need: () => (st.dly.wins || 0) >= 1, hint: 'Solve a Daily Pop' });
  out.push({ id: 'streak3', emoji: '🔥', cls: 'spc', label: '3-day', need: () => (st.dly.streak || 0) >= 3, hint: 'A 3-day daily streak' });
  out.push({ id: 'three', emoji: '🌟', cls: 'spc', label: '3 stars', need: () => st.three >= 1, hint: 'Win a level with 3 stars' });
  return out;
}
function checkStickers() {
  const got = [];
  for (const s of stickerDefs()) if (!st.stickers.includes(s.id) && s.need()) { st.stickers.push(s.id); got.push(s); }
  if (!got.length) return; save(); M.add(25 * got.length, 'sticker');
  const show = () => got.forEach((s, i) => setTimeout(() => { toast(s.img || s.emoji, `New sticker: ${s.label}!`, `+25 coins · ${st.stickers.length}/${stickerDefs().length} in your album`); snd.sparkle(); }, 600 + i * 2700));
  if (mode === 'level') pendingToasts.push(show); else show();
  refreshRoomHUD();
}
function openAlbum() {
  if (popEl || busy) return;
  const defs = stickerDefs(); st.seen.album = st.stickers.length; save(); refreshRoomHUD();
  veil(`<div class="bn-card"><button class="bn-btn x" aria-label="Close">✕</button><h2>Sticker Album</h2>
    <p>${st.stickers.length} / ${defs.length} stickers · each one +25 <i class="bn-coin"></i></p>
    <div class="bn-stk">${defs.map((s, i) => `<div class="${s.cls}${st.stickers.includes(s.id) ? '' : ' off'}" style="--r:${((i * 37) % 9) - 4}deg" title="${s.hint}">${s.img ? `<img src="${s.img}" alt="">` : `<span>${s.emoji}</span>`}<em>${st.stickers.includes(s.id) ? s.label : '?'}</em></div>`).join('')}</div>
    <p style="font-size:13px;opacity:.6">Rescue babies for friend, silver and gold stickers.</p></div>`);
}

// ---------------------------------------------------------------- daily pop (streak + one free freeze a week + share grid)
function dailyStatus() {
  const today = dayNum(), d = st.dly, gap = today - (d.last || 0), freezeReady = d.freezeWeek !== weekOf(today);
  const alive = gap <= 1 || (gap === 2 && freezeReady);
  return { today, done: d.last === today, streak: alive ? d.streak || 0 : 0, freezeReady, needsFreeze: gap === 2 && freezeReady };
}
function openDaily() {
  if (popEl || busy || mode !== 'room') return;
  const s = dailyStatus(), res = st.dly.res;
  veil(`<div class="bn-card"><button class="bn-btn x" aria-label="Close">✕</button><h2 class="daily">Daily Pop</h2>
    <p style="font-size:42px;margin:2px 0">🔥 ${s.streak}</p><p>${s.streak ? `${s.streak}-day streak` : 'Start a streak today!'} · ${s.freezeReady ? '❄️ freeze ready' : '❄️ freeze used this week'}</p>
    <p style="font-size:14px;opacity:.7">One puzzle a day, the same for everyone. Free, no lives needed. Miss a day? Your weekly freeze keeps the streak.</p>
    ${s.done ? `<div class="bn-grid">${res?.grid || ''}</div><button class="bn-btn bn-lilac big" data-s>Share my grid</button><p style="font-size:14px;opacity:.7">Solved ✓ · come back tomorrow</p>` : `<button class="bn-btn bn-mint big" data-p>Play today's puzzle</button>`}</div>`);
  popEl.querySelector('[data-p]')?.addEventListener('click', () => { snd.tap(); closePop(); openPop(true); });
  popEl.querySelector('[data-s]')?.addEventListener('click', () => { snd.tap(); shareGrid(); });
}
function dailyWon(stars, used, total, log) {
  const s = dailyStatus(), d = st.dly;
  if (d.last !== s.today) {
    if (s.needsFreeze) { d.freezeWeek = weekOf(s.today); setTimeout(() => toast('❄️', 'Streak freeze used', 'Your streak is safe'), 1500); }
    d.streak = s.streak + 1; d.last = s.today; d.wins = (d.wins || 0) + 1;
  }
  const em = { c: '🐰', p: '🫧', m: '🤍' }, cells = log.map(x => em[x]);
  const rows = []; for (let i = 0; i < cells.length; i += 8) rows.push(cells.slice(i, i + 8).join(''));
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  d.res = { stars, grid: rows.join('\n'), text: `Bubble Buns Daily · ${date}\n${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${used}/${total} bubbles · 🔥${d.streak}\n${rows.join('\n')}` };
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
let goalsLeft = {};
function buildLevelHUD() {
  const L = curLevel;
  el.cloud.className = 'bn-cloud' + (L.hard ? ' hard' : L.daily ? ' daily' : '');
  el.cloudT.innerHTML = L.daily ? '<small>DAILY</small>POP' : `<small>${L.hard ? 'HARD' : 'LEVEL'}</small>${L.n}`;
  el.goals.innerHTML = Object.entries(L.goals).map(([sp, n]) => `<div class="g" data-g="${sp}"><img src="${critImg(+sp)}" alt="${CRITTERS[sp].name}"><b>${n}</b></div>`).join('');
  goalsLeft = { ...L.goals }; el.scoreSt.forEach(s => s.classList.remove('on')); el.scoreN.textContent = '0';
}
function buildBoostBar() {
  el.boosts.innerHTML = Object.keys(BOOSTS).map(k => { const n = st.boosts[k] || 0; return `<button class="bn-btn" data-k="${k}" aria-label="${BOOSTS[k].name}: ${BOOSTS[k].tip}"><img src="${BOOSTS[k].img}" alt=""><b class="${n ? '' : 'buy'}">${n || '+'}</b></button>`; }).join('');
  el.boosts.querySelectorAll('[data-k]').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); useBooster(b.dataset.k); }));
}
function useBooster(k) {
  if (mode !== 'level' || state !== 'play' || SH.busy) return;
  if (!st.boosts[k]) {
    if (!M.spend(BOOSTS[k].price, 'booster:' + k)) { snd.bad(); toast(BOOSTS[k].img, `${BOOSTS[k].name} · ${BOOSTS[k].price} coins`, 'Not enough coins: tap the coins in the burrow for the shop'); return; }
    st.boosts[k] = 1; toast(BOOSTS[k].img, `${BOOSTS[k].name} bought`, `${BOOSTS[k].price} coins`);
  }
  if (SH.loadBooster(k)) { st.boosts[k]--; save(); buildBoostBar(); el.boosts.querySelector(`[data-k="${k}"]`)?.classList.add('on'); say(`${BOOSTS[k].name}! It ${BOOSTS[k].tip}`, 2200); buzz(20); }
}
function setMode(m) {
  mode = m; const lv = m === 'level';
  for (const e of [el.top, el.side, el.bot]) e.classList.toggle('bn-hidden', lv || m === 'title');
  for (const e of [el.lhud, el.boosts, el.home, el.shots]) e.classList.toggle('bn-hidden', !lv);
  scene.background = lv ? SKY.level : SKY.room;
  if (curRoom) curRoom.group.visible = !lv;
  boardG.visible = lv;
}
function startLevel() {
  if (!curLevel) curLevel = levelDef();
  closePop();
  const pre = {}; for (const k of chosen) { if (st.boosts[k] > 0) { st.boosts[k]--; pre[k] = true; } } save(); chosen = new Set();
  setMode('level'); state = 'play'; recorded = false; marker.visible = false; usedRevive = 0; sayEl?.remove(); sayEl = null;
  buildLevelHUD(); buildBoostBar(); layoutBoard();
  SH.start(curLevel, rng(curLevel.seed * 13 + 7), pre);
  if (host?.g.parent && host.g.parent !== boardG) host.g.parent.remove(host.g);
  placeLevelChars(); bun?.play('idle'); host?.play('idle');
  runT0 = performance.now(); B.start(); M.level(st.level); snd.music(true); snd.whoosh();
  const n = curLevel.n;
  const tip = curLevel.daily ? 'Today\'s Daily Pop! Same puzzle for everyone.' : n === 1 ? 'Drag to aim, let go to shoot! Match 3!' : n === 2 ? 'Tap the cannon to swap bubbles!' : n === 3 ? 'Bounce shots off the walls!' : n === 4 ? 'Boosters are down here. Try one!' : n === 9 ? 'Sugar cubes melt when a group pops next to them!' : curLevel.hard ? 'A hard one! Short and tricky, you got this!' : '';
  if (tip) setTimeout(() => say(tip, 3400, bun), 900);
}
function toRoom() {
  setMode('room'); state = 'ready'; SH.hide(); closePop(); outPop = null;
  hostRoomPose(); host?.play('idle'); refreshHerd(); refreshRoomHUD(); clip.set(new V3(0, 1, 0), 1e6);
  if (dailyMode) dailyMode = false;
  while (pendingToasts.length) pendingToasts.shift()();
  setTimeout(prepLevel, 900);
}
el.home.onclick = () => {
  snd.tap(); if (SH.busy || state !== 'play') return;
  const free = curLevel.daily || curLevel.n <= 5;
  veil(`<div class="bn-card"><button class="bn-btn x" aria-label="Close">✕</button><h2>Leave level?</h2><p>${free ? 'You can come back any time.' : 'Leaving costs a life 💗'}</p><button class="bn-btn bn-pink big" data-q>Back to the burrow</button></div>`);
  popEl.querySelector('[data-q]').onclick = () => { snd.tap(); if (!free) M.useLife(); if (!recorded) { recorded = true; F.level(false, fracDone()); } toRoom(); };
};
const fracDone = () => curLevel ? 1 - SH.crittersLeft / curLevel.nCrit : 0;
const hooks = {
  shots(n) { el.shotsN.textContent = n; el.shots.classList.toggle('low', n <= 5 && n > 0); },
  score(s) { el.scoreN.textContent = s.toLocaleString(); },
  fired() { el.boosts.querySelectorAll('.on').forEach(b => b.classList.remove('on')); },
  freed(sp, world, left) {
    st.rescued[sp] = (st.rescued[sp] || 0) + 1;
    const slot = el.goals.querySelector(`[data-g="${sp}"]`); goalsLeft[sp] = Math.max(0, (goalsLeft[sp] || 0) - 1);
    const upd = () => { if (!slot) return; slot.querySelector('b').textContent = goalsLeft[sp] > 0 ? goalsLeft[sp] : '✓'; slot.classList.toggle('done', goalsLeft[sp] <= 0); bump(slot); };
    const v = world.clone().project(cam), sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    const r = slot ? slot.getBoundingClientRect() : { left: innerWidth / 2, top: 20, width: 0 };
    const img = document.createElement('img'); img.className = 'bn-fly'; img.src = critImg(sp); document.body.appendChild(img);
    flying.push({ img, sx, sy, tx: r.left + r.width / 2, ty: r.top + 23, t: 0, d: 0.7, cx: sx + (Math.random() - 0.5) * 120, cy: Math.min(sy, r.top) - 60, upd });
    bun?.play(left ? 'jump' : 'cheer', true); buzz(25);
    if (left && Math.random() < 0.5) say([`${CRITTERS[sp].name} is free!`, 'Yay, one more safe!', `Hi ${CRITTERS[sp].name}! 💕`][(Math.random() * 3) | 0], 1600, bun);
    const done = curLevel.nCrit - left;
    el.scoreSt.forEach((s, i) => s.classList.toggle('on', done / curLevel.nCrit > [0.0, 0.5, 0.99][i]));
  },
  allFreed() { combo('All babies safe!', 'mint'); snd.win(); bun?.play('cheer', true); },
  combo(text, lvl) { combo(text); snd.chime(lvl + 2); if (lvl >= 3) bun?.play('cheer', true); buzz(15); },
  shake(a) { shake = Math.max(shake, a); },
  outOfShots,
  done(won, stars, score) {
    if (recorded) return; recorded = true; state = won ? 'won' : 'lost'; el.boosts.classList.add('bn-hidden'); el.shots.classList.add('bn-hidden');
    const ms = performance.now() - runT0, L = curLevel;
    if (won) {
      F.level(true); lastStars = stars; st.stars += stars; st.earned += stars; st.wins++; if (stars === 3) st.three++;
      const key = L.daily ? 'd' + D.seed : L.n; st.best[key] = Math.max(st.best[key] || 0, stars);
      if (!L.daily) { st.level++; if (st.level % 5 === 0) { const k = Object.keys(BOOSTS)[(st.level / 5) % 3]; st.boosts[k] = (st.boosts[k] || 0) + 1; pendingToasts.push(() => toast(BOOSTS[k].img, `Free ${BOOSTS[k].name}!`, 'a gift every 5 levels')); } }
      lastCoins = 20 + stars * 10 + (L.hard ? 30 : 0); M.add(lastCoins, 'win');
      if (L.daily) dailyWon(stars, L.shots + usedRevive * 5 - SH.shots, L.shots, SH.log);
      save(); D.won(stars, 'earned ⭐ rescuing baby bunnies in'); B.submit(stars, { ms });
      if (D.beaten(stars)) setTimeout(() => { ui.pop('BEATEN!', '#fff', 40, 30); SH.fx.spark(0, SH.G.grid.launchY() + 6, CONF, 60, { speed: 9, size: 1.6, life: 1.4 }); }, 400);
      winStars.querySelectorAll('i').forEach(i => i.classList.remove('on'));
      winCoins.querySelector('span').textContent = '+' + lastCoins; dblBtn.classList.remove('bn-hidden'); dblBtn.disabled = false;
      gridBtn.classList.toggle('bn-hidden', !L.daily); if (kitShare) kitShare.classList.toggle('bn-hidden', !!L.daily);
      ui.win(L.daily ? 'DAILY POP' : L.n, `${L.nCrit} babies rescued · +${stars} ⭐ for the burrow`); ui.els.win.querySelector('p').firstChild.textContent = L.daily ? '' : 'LEVEL ';
      for (let i = 0; i < stars; i++) setTimeout(() => { winStars.children[i].classList.add('on'); snd.star(i); }, 900 + i * 280);
      for (let i = 0; i < 3; i++) setTimeout(() => SH.fx.spark((Math.random() - 0.5) * 6, -4 - Math.random() * 4 - (LY0 - SH.G.grid.launchY()), CONF, 40, { speed: 8, up: 3, size: 1.6, life: 1.4 }), i * 200);
      checkStickers();
    } else {
      F.level(false, fracDone()); snd.lose(); bun?.play('jump', true);
      const free = L.daily || L.n <= 5; if (!free) M.useLife();
      ui.lose('SO CLOSE!', `${SH.crittersLeft} bab${SH.crittersLeft > 1 ? 'ies' : 'y'} still trapped${free ? '' : ' · −1 💗'} · tap to try again`);
      save();
    }
  },
};
function combo(text, cls = '') { const d = $(`<div class="bn-combo ${cls}">${text}</div>`); document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }
dblBtn.addEventListener('click', async e => {
  e.stopPropagation(); if (dblBtn.disabled) return; dblBtn.disabled = true; snd.tap();
  if (await M.rewarded('double', { what: `${lastCoins * 2} coins instead of ${lastCoins}` })) { M.add(lastCoins, 'double'); lastCoins *= 2; winCoins.querySelector('span').textContent = '+' + lastCoins; snd.coin(); dblBtn.classList.add('bn-hidden'); }
  else dblBtn.disabled = false;
});

ui.onTap(async which => {
  snd.unlock();
  if (which === 'start') {
    setMode('room'); state = 'ready'; refreshRoomHUD(); snd.music(true);
    setTimeout(() => say(doneList().length || st.level > 1 ? 'Welcome back! The buns missed you 💕' : 'Bubbles trapped our baby buns! Let\'s pop them free!', 3400), 400);
    if (dailyMode) setTimeout(openDaily, 600);
  } else if (which === 'win') {
    const wasDaily = curLevel?.daily; toRoom(); const n = lastStars, c = lastCoins; shownStars = st.stars - n; el.starsN.textContent = shownStars;
    const r = el.starsP.getBoundingClientRect();
    for (let i = 0; i < n; i++) setTimeout(() => { const s = $('<div class="bn-fly" style="font-size:38px;width:auto;height:auto">⭐</div>'); document.body.appendChild(s);
      flying.push({ img: s, sx: innerWidth / 2, sy: innerHeight * 0.45, tx: r.left + 22, ty: r.top + 18, t: 0, d: 0.6, cx: innerWidth * 0.2, cy: innerHeight * 0.3, upd: () => { shownStars++; el.starsN.textContent = shownStars; bump(el.starsP); snd.collect(i); if (shownStars === st.stars) refreshRoomHUD(); } }); }, 250 + i * 220);
    coinBurst(c);
    const nt = nextTasks()[0]; setTimeout(() => say(nt && st.stars >= nt.cost ? `Next up: ${nt.name}! ⭐` : wasDaily ? 'See you tomorrow for the next Daily Pop!' : 'More stars, more cute stuff!'), 900);
    setTimeout(() => { if (mode === 'room' && !popEl) M.breakAd('level-end', { level: st.level - 1 }); }, 1800);
  } else if (which === 'lose') { const wasDaily = curLevel?.daily; toRoom(); setTimeout(() => openPop(wasDaily), 300); }
});

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new V3();
function boardPoint(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  SH.root.updateMatrixWorld(); const n = new V3(0, 0, 1).transformDirection(SH.root.matrixWorld), o = new V3().setFromMatrixPosition(SH.root.matrixWorld);
  plane.setFromNormalAndCoplanarPoint(n, o); if (!ray.ray.intersectPlane(plane, hitP)) return null;
  return SH.root.worldToLocal(hitP.clone());
}
let drag = null;
addEventListener('pointerdown', e => {
  if (e.target !== R.domElement) return; snd.unlock();
  if (mode === 'level' && state === 'play') { const p = boardPoint(e); if (p) SH.input.down(p.x, p.y); }
  else if (mode === 'room') drag = { x: e.clientX, yaw: yawT };
});
addEventListener('pointermove', e => {
  if (mode === 'level') { const p = boardPoint(e); if (p) SH.input.move(p.x, p.y); }
  else if (drag) yawT = Math.max(0.05, Math.min(0.85, drag.yaw - (e.clientX - drag.x) / innerWidth * 1.2));
});
addEventListener('pointerup', () => { if (mode === 'level') SH.input.up(); drag = null; });
addEventListener('pointercancel', () => { SH?.input.cancel(); drag = null; });

// ---------------------------------------------------------------- frame
function resize() { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight); layoutBoard(); }
addEventListener('resize', resize);
let T = 0, perf = {};
R.info.autoReset = false;
const shotsAnchor = new V3();
loop(d => {
  const dt = Math.min(0.05, d / 60); T += dt;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt / w.dur; w.fn(Math.min(1, w.t)); if (w.t >= 1) { tweens.splice(i, 1); w.res(); } }
  if (!P) return;
  yaw += (yawT - yaw) * Math.min(1, dt * 6);
  const inLevel = mode === 'level', pose = inLevel ? levelPose() : roomPose(), k = inLevel ? 1 : Math.min(1, dt * 3);
  camCur.pos.lerp(pose.pos, k); camCur.tgt.lerp(pose.tgt, k); camCur.off += (pose.off - camCur.off) * k;
  cam.position.copy(camCur.pos); cam.lookAt(camCur.tgt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.8); cam.position.x += (Math.random() - 0.5) * shake * 0.18; cam.position.y += (Math.random() - 0.5) * shake * 0.18; }
  cam.setViewOffset(innerWidth, innerHeight, 0, inLevel ? 0 : camCur.off, innerWidth, innerHeight);
  cam.updateMatrixWorld();
  // room atmosphere: a bare room is a little washed out, a decorated one glows
  atm.cur += (atm.target - atm.cur) * Math.min(1, dt * 1.5);
  const p = 0.75 + 0.25 * atm.cur;
  hemi.intensity = inLevel ? 1.35 : 0.55 + 0.3 * p; sun.intensity = inLevel ? 2.2 : 1.3 + 0.7 * p; scene.environmentIntensity = inLevel ? 0.75 : 0.35 + 0.15 * p;
  C.grade.uniforms.uSat.value = inLevel ? 1.12 : 0.9 + 0.3 * p;
  herd?.update(dt, T);
  if (marker.visible) { bob += dt; const h = marker.getObjectByName('h'); h.position.y = 0.9 + Math.sin(bob * 4) * 0.12; h.rotation.y = bob * 2; const rg = marker.getObjectByName('ring'); rg.scale.setScalar(1 + (bob * 1.2 % 1) * 0.6); rg.material.opacity = 0.8 * (1 - bob * 1.2 % 1); }
  if (inLevel) {
    SH.root.updateMatrixWorld(true);
    const o = new V3(0, TOP_Y, 0).applyMatrix4(SH.root.matrixWorld), nrm = new V3(0, -1, 0).transformDirection(SH.root.matrixWorld);
    clip.setFromNormalAndCoplanarPoint(nrm, o);
    SH.update(adOn ? 0 : dt);
    shotsAnchor.set(1.75, LY0 - 0.5, 0.6).applyMatrix4(SH.root.matrixWorld).project(cam);
    el.shots.style.left = (shotsAnchor.x + 1) / 2 * innerWidth + 'px'; el.shots.style.top = (1 - shotsAnchor.y) / 2 * innerHeight + 'px';
  }
  host?.mixer.update(dt); bun?.mixer.update(dt); WP.update(dt);
  for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i]; f.t += dt / f.d; const t = Math.min(1, f.t), a = 1 - t;
    const x = a * a * f.sx + 2 * a * t * f.cx + t * t * f.tx, y = a * a * f.sy + 2 * a * t * f.cy + t * t * f.ty;
    f.img.style.left = x + 'px'; f.img.style.top = y + 'px'; f.img.style.transform = `scale(${1 + Math.sin(t * PI) * 0.5})`;
    if (t >= 1) { f.img.remove(); flying.splice(i, 1); f.upd(); snd.collect(i); } }
  if (sayEl) { sayT -= dt; if (sayT <= 0) { sayEl.remove(); sayEl = null; } else placeSay(); }
  R.info.reset(); C.render(dt); perf = { calls: R.info.render.calls, tris: R.info.render.triangles };
});

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the aim line swings over and one bubble pops a colour group (never one holding a baby); the bubble is given back
demo(() => { const r = SH.bot(true); if (r === 'fired') { SH.G.shots++; hooks.shots(SH.G.shots); return false; } if (r === false) return false; },
  { ready: () => mode === 'level' && state === 'play' && !dailyMode && curLevel?.n === 1 && SH && SH.state === 'play' && !SH.busy && SH.shots > 1 && !popEl && !(outPop && outPop.isConnected), wait: 1800, every: 150, max: 12 });

// ---------------------------------------------------------------- test hooks
let botBusy = false, botWait = 0;
window.__game = {
  get state() { return state; }, get level() { return st.level; }, get score() { return st.earned; },
  get stars() { return st.stars; }, get perf() { return perf; }, get mode() { return mode; }, get room() { return st.room; }, get coins() { return M.coins(); },
  get tasksDone() { return Object.values(st.done).reduce((a, l) => a + l.length, 0); }, get sh() { return SH && { shots: SH.shots, left: SH.crittersLeft, state: SH.state, busy: SH.busy, rows: SH.G.grid.maxRow() }; },
  money: M, start: () => startLevel(), get SH() { return SH; },
  bot() {
    if (!P || botBusy) return;
    if (mode === 'title') { ui.hideStart(); ui.els.start.dispatchEvent(new Event('pointerdown')); return; }
    if (mode === 'level') {
      if (outPop && outPop.isConnected) { outPop.querySelector('[data-y]').click(); outPop = null; return; }
      if (state === 'play') SH.bot(); return;
    }
    if (popEl) { const pl = popEl.querySelector('[data-play]'); if (pl) { if (++botWait > 4) { botWait = 0; startLevel(); } } else closePop(); return; }
    if (busy || flying.length) return;
    const nt = nextTasks()[0];
    if (!nt && st.room < ROOMS.length - 1) { botBusy = true; goNextRoom().finally(() => botBusy = false); return; }
    if (nt && st.stars >= nt.cost) { buyTask(nt); return; }
    openPop();
  },
};
resize();
boot().catch(e => { console.error(e); loadEl.querySelector('span').textContent = 'Could not load Bubble Buns'; });

// Starlit Crush: Romance Story Choices — a kawaii 3D interactive love story at an art college.
// Chibi characters (assets/chars k01–k07) act out the script (story.js) in five code-built sets dressed with kawaii props
// (sets.js); the camera cuts like a TV drama, lines type into jelly speech bubbles, emotes pop over heads, and every choice
// moves Sol, Mika and June's hearts (they answer it in the next line, and remember it in later chapters).
// Money (kit/money.js, style B): keys = the kit's lives (new chapters cost 1, replays free), premium choices + outfits
// cost coins (always beside an equally good free choice), reward videos double chapter coins / refill keys / rule out a
// quiz answer, break ads only after a chapter card is dismissed. Daily (?daily=1): "Who said it?" — 5 seeded quotes.
import { THREE, createUI, store, loop, buzz, confetti, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { demo } from './kit/demo.js';
import { CAST, LIS, ALBUM, STICKERS, OUTFITS, BOOK, SCRIPT, QUOTES, QUIZ_HINTS, parse } from './story.js';
import { loadProps, buildSets, PROP_IDS } from './sets.js';
import { initCast, makeActor, setEmo, setFade, tickActor, emote, play, dress } from './cast.js';
import { S as SND, music, setMuted, unlock, pauseAll } from './audio.js';

const NAME = 'Starlit Crush: Romance Story Choices', KEY = 'starlit-crush';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const CH = parse(SCRIPT);
const P = Object.assign({ name: '', next: 1, done: {}, run: null, flags: [], rel: {}, album: [], stickers: [], outfit: 'classic', paid: [], mute: false, auto: false,
  ds: { last: 0, n: 0, freeze: -1, log: {} }, seen: 0 }, (() => { try { return ST.get('p', {}); } catch (e) { return {}; } })());
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nm = s => String(s).replace(/\{name\}/g, P.name || 'Riley');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT = () => !!navigator.webdriver;
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);
const thumb = id => `./assets/thumbs/${CAST[id]?.char || id}.webp`;
const COIN = './assets/thumbs/x02.webp';
const stop = el => ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));

// ------------------------------------------------------------------------------------------------- renderer
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 400);
const C = cine(R, scene, cam, { bloom: 0.22, bloomThreshold: 1.2, bloomRadius: 0.5, exposure: 1.0, envIntensity: 0.45, lite: LITE, grade: { sat: 1.2, contrast: 1.07, vignette: 0.1, grain: 0 } });
const hemi = new THREE.HemisphereLight('#fff4fb', '#c9a8e0', 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 50 });
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffeef8', 1.0); fill.position.set(-3, 3, 9); scene.add(fill, fill.target);   // follows the camera: a soft beauty light so faces always read
let W = innerWidth, H = innerHeight;

// ------------------------------------------------------------------------------------------------- kit layers
const ui = createUI({ title: 'Starlit Crush', hint: '', hand: '', progress: false, score: false });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'starlit-crush', label: 'Chapters & daily quizzes', mode: 'sum', limits: { maxRun: 1, maxPerSec: 0.2 }, corner: 'tl', accent: '#ff5fa2' });
const M = money({ game: KEY, style: 'B' });
addEventListener('ap:ad', e => pauseAll(e.detail && e.detail.phase === 'start'));
// a story has no fail state and the daily quiz must be the same for everyone, so flow.js has no knob here

// ------------------------------------------------------------------------------------------------- state
let phase = 'loading', SETS = null, set = null, A = {}, me = null, PROTO = null, T = 0, wantStart = false;
let RUN = null, QZ = null, line = null, shotReq = null;

// ------------------------------------------------------------------------------------------------- loading
initCast(THREE, GLTFLoader);
const IDS = ['me', 'bea', 'sol', 'mika', 'june', 'dean', 'bun'];
let nLoaded = 0; const nTotal = PROP_IDS.length + IDS.length;
const prog = () => { nLoaded++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(nLoaded / nTotal * 100) + '%'; };
async function boot() {
  PROTO = await loadProps(THREE, GLTFLoader, PROP_IDS, prog);
  SETS = buildSets(THREE, scene);
  await Promise.all(IDS.map(id => makeActor(id, CAST[id]).then(a => { A[id] = a; a.o.visible = false; scene.add(a.o); }).catch(e => console.warn('actor', id, e)).finally(prog)));
  me = A.me; dress(me, lookById(P.outfit), PROTO);
  phase = 'title'; showLobby(true);
  $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 650);
  if (wantStart) startFromLobby();
}
const allLooks = () => Object.values(OUTFITS).flatMap(o => o.looks);
const lookById = id => allLooks().find(l => l.id === id) || OUTFITS.mixer.looks[0];

// ------------------------------------------------------------------------------------------------- sets + staging
function useSet(name, v) {
  for (const s of Object.values(SETS)) s.group.visible = false;
  set = SETS[name]; set.group.visible = true; set.set(v); set.vname = v;
  scene.background = set.bg; scene.fog = set.fog;
  hemi.color.set(set.hemi[0]); hemi.groundColor.set(set.hemi[1]); hemi.intensity = set.hemi[2];
  sun.color.set(set.sun[0]); sun.intensity = set.sun[1]; sun.position.set(...set.sun[2]); sun.target.position.set(0, 0.6, 0.5);
  R.toneMappingExposure = set.exp || 1;
  for (const a of Object.values(A)) { a.present = false; setFade(a, 0); }
  const night = v === 'night' || v === 'gallery';
  music(name === 'roof' ? 'romance' : night ? 'night' : name === 'dorm' || name === 'cafe' ? 'cozy' : 'campus');
}
function place(a, mark, instant = true) {
  const p = (set.marks[mark] || set.marks.C).clone(); if (W < H) p.x *= 0.82; a.mark = mark; a.target = p;
  if (instant || !a.present) a.o.position.copy(p);
  a.present = true;
}
const present = () => Object.values(A).filter(a => a.present);

// ------------------------------------------------------------------------------------------------- camera
const camS = { pos: V3(0, 2, 8), look: V3(0, 1.2, 0), fov: 36, off: [0, 0] }, camG = { pos: V3(0, 2, 8), look: V3(0, 1.2, 0), fov: 36, off: [0, 0] };
let camCut = true, camK = 3, drift = 0;
function setCam(s, cut = false, k = 3) { camG.pos.copy(s.pos); camG.look.copy(s.look); camG.fov = s.fov; camG.off = s.off || [0, 0]; if (cut) camCut = true; camK = k; drift = 0; }
const bubbleH = () => { const b = $('bubble'); return b.classList.contains('off') ? 190 : b.offsetHeight + 36; };
function region() {
  const top = 74, bottom = Math.min(H * 0.42, Math.max(170, bubbleH() + 8));
  if (W > H * 1.1) { const w = Math.min(W * 0.55, 760); return { x0: (W - w) / 2, x1: (W + w) / 2, y0: top, y1: H - bottom }; }
  return { x0: 0, x1: W, y0: top, y1: H - bottom };
}
function frame(c, h, w, dir, fov = 30, r = region(), fill = 0.92) {
  const t = 2 * Math.tan(fov * Math.PI / 360), hr = Math.max(80, r.y1 - r.y0), wr = Math.max(80, r.x1 - r.x0);
  const d = Math.max(h * H / (fill * hr * t), w * W / (0.94 * wr * t * (W / H)));
  return { pos: c.clone().add(dir.clone().normalize().multiplyScalar(d)), look: c.clone(), fov, off: [-((r.x0 + r.x1) / 2 - W / 2), -((r.y0 + r.y1) / 2 - H / 2)] };
}
const headOf = a => a.o.position.clone().add(V3(0, a.cfg.h * 0.82, 0));
function shotSingle(a, other, close = false) {
  const side = other ? Math.sign(other.o.position.x - a.o.position.x) || 1 : 0;
  const c = a.o.position.clone().add(V3(0, a.cfg.h * (close ? 0.68 : 0.56), 0));
  if (other && !close && W > H) { const o = other.o.position.clone(); o.y = c.y; c.lerp(o, 0.22); }
  const dir = V3(side * (close ? -0.3 : 0.26), 0.14, 1);
  return frame(c, Math.max(1.0, a.cfg.h) * (close ? 0.95 : 1.3), W > H ? 1.4 : 0.95, dir, 32);
}
function shotGroup(list) {
  const bb = new THREE.Box3(); for (const a of list) { bb.expandByPoint(a.o.position); bb.expandByPoint(headOf(a)); }
  const c = bb.getCenter(V3()), sz = bb.getSize(V3()); const hm = Math.max(...list.map(a => a.cfg.h)); c.y = hm * 0.55;
  return frame(c, hm * 1.25, sz.x + 0.9, V3(0, 0.14, 1), 32);
}
function shotFor(b) {
  const pr = present();
  if (b && b.id) { const a = A[b.id]; if (a && a.present) { const others = pr.filter(x => x !== a); return shotSingle(a, nearest(a, others), b.think); } }
  if (pr.length >= 2) return shotGroup(pr);
  if (pr.length === 1) return frame(pr[0].o.position.clone().add(V3(0, pr[0].cfg.h * 0.6, 0)), pr[0].cfg.h * 1.3, 1.6, V3(0.25, 0.12, 1), 32);
  return { ...set.est, off: [0, -40] };
}
const nearest = (a, list) => list.slice().sort((p, q) => p.o.position.distanceTo(a.o.position) - q.o.position.distanceTo(a.o.position))[0] || null;
function updateCam(dt) {
  const k = camCut ? 1 : 1 - Math.exp(-dt * camK); camCut = false;
  camS.pos.lerp(camG.pos, k); camS.look.lerp(camG.look, k); camS.fov = lerp(camS.fov, camG.fov, k);
  camS.off[0] = lerp(camS.off[0], camG.off[0], k); camS.off[1] = lerp(camS.off[1], camG.off[1], k);
  drift += dt;
  cam.position.copy(camS.pos);
  const push = Math.min(1, drift / 9) * 0.05; cam.position.lerp(camS.look, push);
  cam.position.x += Math.sin(T * 0.21) * 0.02; cam.position.y += Math.sin(T * 0.33) * 0.012;
  cam.lookAt(camS.look);
  fill.position.copy(cam.position).add(V3(0.6, 1.2, 0)); fill.target.position.copy(camS.look);
  cam.fov = camS.fov; cam.aspect = W / H; cam.setViewOffset(W, H, camS.off[0], camS.off[1], W, H); cam.updateProjectionMatrix();
}
function resize() { W = innerWidth; H = innerHeight; R.setSize(W, H); C.resize(W, H); if (phase === 'title') lobbyCam(true); else if (line) setCam(shotFor(line.b), true); }
addEventListener('resize', resize);

// ------------------------------------------------------------------------------------------------- acting: facing + fades
function tickStage(dt) {
  const pr = present(), spk = line && line.b.id ? A[line.b.id] : null;
  for (const a of Object.values(A)) {
    const tgtA = a.present ? 1 : 0; if (Math.abs(a.alpha - tgtA) > 0.001) setFade(a, clamp(a.alpha + Math.sign(tgtA - a.alpha) * dt * 3.5, 0, 1));
    if (!a.o.visible) continue;
    if (a.target) a.o.position.lerp(a.target, 1 - Math.exp(-dt * 6));
    let look = null;
    if (phase !== 'title' && !QZ) { if (spk && spk !== a && spk.present) look = spk.o.position; else { const o = nearest(a, pr.filter(x => x !== a)); if (o) look = o.o.position; } }
    const camDir = Math.atan2(cam.position.x - a.o.position.x, cam.position.z - a.o.position.z);
    let yaw = camDir;
    if (look) { const toL = Math.atan2(look.x - a.o.position.x, look.z - a.o.position.z); yaw = angLerp(toL, camDir, a === spk ? 0.6 : 0.38); }
    if (RUN && RUN.outfit && a === me) yaw = camDir;
    if (phase === 'title') yaw = angLerp(Math.atan2(-a.o.position.x * 0.4, 1), camDir, 0.55);
    a.yawNow = a.yawNow == null ? yaw : angLerp(a.yawNow, yaw, 1 - Math.exp(-dt * 4));
    a.o.rotation.y = a.yawNow;
    tickActor(a, dt, T);
  }
}
function angLerp(a, b, t) { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; }

// ------------------------------------------------------------------------------------------------- lobby
const startEl = ui.els.start;
const lob = document.createElement('div'); lob.className = 'lob'; startEl.appendChild(lob);
function lobbyCam(cut) { const wide = W > H * 1.25; setCam(frame(V3(0, 0.7, 0.2), 1.45, 3.3, V3(0.0, 0.1, 1), 34, wide ? { x0: W * 0.4, x1: W * 0.98, y0: H * 0.12, y1: H * 0.96 } : { x0: 0, x1: W, y0: H * 0.25, y1: H * 0.58 }, 0.95), cut, 2); }
function showLobby(cut) {
  phase = 'title'; document.body.classList.remove('playing'); QZ = null; RUN = null; line = null; $('fade').style.opacity = 0; $('loc').classList.remove('on'); letterOn = false; $('letter').classList.remove('on');
  for (const id of ['menuBtn', 'chap', 'choices', 'outfit', 'quiz', 'tapzone', 'namebox']) $(id).classList.add('hidden'); hideBubble();
  useSet('quad', 'night');
  const pos = { me: [0, 0.5], sol: [-0.95, 0.05], mika: [0.95, 0.05], june: [-1.75, -0.5], bun: [1.75, -0.55] };
  for (const [id, [x, z]] of Object.entries(pos)) { const a = A[id]; if (!a) continue; a.present = true; setFade(a, 1); a.o.position.set(x, 0, z); a.target = a.o.position.clone(); a.yawNow = null; setEmo(a, ''); a.emT = 0; a.em.visible = false; }
  setTimeout(() => { if (phase === 'title') { play(A.sol, 'wave'); emote(A.mika, 'heart'); play(A.bun, 'jump'); } }, 900);
  lobbyCam(cut); renderLobby(); ui.start();
}
function renderLobby() {
  const n = Math.min(P.next, 3), c = BOOK.chapters[n - 1], allDone = P.done[3];
  const free = n === 1 || P.done[n] || (P.run && P.run.ch === n);
  const cont = P.run && P.run.ch === n && P.run.i > 3;
  lob.innerHTML = `
    <div class="hd"><div class="logoT">Starlit<em>Crush</em><span class="sp" style="left:-8%;top:8%">✦</span><span class="sp" style="right:-6%;top:52%">✧</span></div>
    <div class="tagl">ROMANCE STORY CHOICES</div>
    ${D.streak > 1 ? `<div class="streak">🔥 ${D.streak}-day streak</div>` : ''}</div>
    <div class="lspace"></div>
    <div class="book" id="bookC">
      <span class="chn">${allDone ? 'BOOK 1 · 3/8' : `CH ${n}/8`}</span>
      <div class="bk">Book One · ${esc(BOOK.title)}</div>
      <h2>${D.seed ? '💬 Who said it?' : allDone ? 'Chapter 4 is coming soon' : `${c.icon} ${esc(c.title)}`}</h2>
      <p>${D.seed ? 'Five quotes from around campus. Guess who said each one. Get three right to keep your streak. Same quiz for everyone today.' : allDone ? 'You\'ve read every chapter so far. Replay any chapter from the map and make different choices, or play today\'s quiz.' : esc(c.teaser)}</p>
      <button class="play ${free || D.seed || allDone ? 'free' : ''}" id="playB">${D.seed ? 'Play today\'s quiz' : allDone ? 'Replay Chapter 3' : cont ? 'Continue' : `Read Chapter ${n}`}<span class="kc">${D.seed || allDone || free ? 'FREE' : '🗝️ 1'}</span></button>
    </div>
    <div class="lrow">
      <button class="sq" data-s="chapters"><img alt="" src="./assets/thumbs/r01.webp">Chapters</button>
      <button class="sq" data-s="album"><img alt="" src="./assets/thumbs/r04.webp">Album${newAlbum() ? `<b>${newAlbum()}</b>` : ''}</button>
      <button class="sq" data-s="quiz"><img alt="" src="./assets/thumbs/m03.webp">${P.ds.log[dayNum()] != null ? 'Done ✓' : 'Daily'}</button>
      <button class="sq" data-s="shop"><img alt="" src="./assets/thumbs/x02.webp">Shop</button>
    </div>
    <button class="who" id="whoB"><img alt="" src="${thumb('me')}">You: <b>${esc(P.name || 'not named yet')}</b> ✎</button>`;
  for (const b of lob.querySelectorAll('.sq,.who')) {
    stop(b);
    b.addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); const s = b.dataset.s; if (b.id === 'whoB') openSheet('you'); else if (s === 'shop') M.shop(); else if (s === 'quiz') { if (!D.seed) location.search = '?daily=1'; else startFromLobby(); } else openSheet(s); });
  }
  hud();
}
const newAlbum = () => Math.max(0, P.album.length + P.stickers.length - (P.seen || 0));
ui.onTap(which => {
  unlock();
  if (which === 'start') { if (phase === 'loading') { wantStart = true; return; } startFromLobby(); }
  if (which === 'win') afterWin();
  if (which === 'lose') showLobby(false);
});
function startFromLobby() {
  if (D.seed) return startQuiz();
  const n = Math.min(P.next, 3);
  if (P.done[3] && P.next > 3) return startChapter(3, { replay: true });
  startChapter(n);
}

// ------------------------------------------------------------------------------------------------- HUD
function hud() {
  $('coinP').querySelector('b').textContent = M.coins();
  const L = M.lives(); $('keyP').querySelector('b').textContent = L.unlimited ? '∞' : L.n;
  const sm = $('keyP').querySelector('small'); if (L.nextAt && L.n < L.max) { const s = Math.max(0, Math.ceil((L.nextAt - Date.now()) / 1000)); sm.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } else sm.textContent = '';
  $('muteB').textContent = P.mute ? '🔇' : '🔊';
}
M.onChange(hud); setInterval(hud, 1000);
$('coinP').addEventListener('click', e => { e.stopPropagation(); unlock(); M.shop(); });
$('keyP').addEventListener('click', e => { e.stopPropagation(); unlock(); openSheet('keys'); });
$('muteB').addEventListener('click', e => { e.stopPropagation(); P.mute = !P.mute; setMuted(P.mute); saveP(); hud(); });
for (const id of ['coinP', 'keyP', 'muteB', 'menuBtn']) stop($(id));
$('menuBtn').addEventListener('click', e => { e.stopPropagation(); SND.tap(); openSheet('menu'); });
setMuted(P.mute);

// ------------------------------------------------------------------------------------------------- toasts, polaroids, stickers
function chip(html, cls = '') { const d = document.createElement('div'); d.className = 'tchip ' + cls; d.innerHTML = html; $('toast').appendChild(d); setTimeout(() => d.remove(), 2900); }
const relName = n => n >= 9 ? 'Starstruck' : n >= 6 ? 'Crush' : n >= 3 ? 'Close' : n > 0 ? 'Friends' : 'Classmates';
function relChip(id, n) {
  if (!CAST[id] || !n) return;
  chip(`<img alt="" src="${thumb(id)}"><span>${esc(CAST[id].name)}</span><span class="h">${n > 0 ? '♥'.repeat(Math.min(3, n)) : '💔'}</span>`);
  const a = A[id]; if (a && a.present && n > 0) { hearts(headOf(a), 5 + n * 2); a.nod = 1; if (n >= 2) emote(a, 'heart', 1.8); SND.heart(); }
}
let photoList = [];
function takePhoto(key) {
  try {
    const src = R.domElement, cw = src.width, chh = src.height, ar = 3 / 4;
    // crop a 3:4 polaroid around the people in the shot (projected feet + head tops)
    let x0 = cw, x1 = 0, y0 = chh, y1 = 0;
    for (const a of photoList.length ? photoList : present()) for (const y of [0, a.cfg.h * 1.05]) { const p = a.o.position.clone().add(V3(0, y, 0)).project(cam); const px = (p.x * 0.5 + 0.5) * cw, py = (-p.y * 0.5 + 0.5) * chh; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    if (x1 <= x0) { x0 = cw * 0.2; x1 = cw * 0.8; y0 = chh * 0.2; y1 = chh * 0.7; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let sh = Math.max((y1 - y0) * 1.15, (x1 - x0) * 1.2 / ar), sw = sh * ar;
    sh = Math.min(sh, chh, cw / ar); sw = sh * ar;
    const sx = clamp(cx - sw / 2, 0, cw - sw), sy = clamp(cy - sh * 0.52, 0, chh - sh);
    const c = document.createElement('canvas'); c.width = 270; c.height = 360;
    c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, 270, 360);
    const url = c.toDataURL('image/jpeg', 0.8);
    try { localStorage.setItem(`${KEY}_ph_${key}`, url); } catch (e) {}
    const s = $('snap'); s.querySelector('img').src = url; s.querySelector('b').textContent = ALBUM[key]?.title || ''; s.classList.add('on'); SND.photo(); $('flash').style.opacity = 0.6; setTimeout(() => $('flash').style.opacity = 0, 120);
    setTimeout(() => s.classList.remove('on'), 2300);
  } catch (e) { console.warn('photo', e); }
}
const photo = key => { try { return localStorage.getItem(`${KEY}_ph_${key}`); } catch (e) { return null; } };
let stkQ = [], stkBusy = false;
function stickerPop(id) {
  stkQ.push(id); if (stkBusy) return;
  const nextS = () => { const k = stkQ.shift(); if (!k) { stkBusy = false; return; } stkBusy = true; const s = $('stk'); s.querySelector('img').src = `./assets/thumbs/${STICKERS[k].img}.webp`; s.querySelector('b').textContent = '+ ' + STICKERS[k].name; s.classList.add('on'); SND.sticker(); setTimeout(() => { s.classList.remove('on'); setTimeout(nextS, 350); }, 1700); };
  nextS();
}
// floating 3D hearts
const heartT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff5fa2'; x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 6, 8, 24, 10); x.bezierCurveTo(30, 11, 32, 18, 32, 20); x.bezierCurveTo(32, 18, 34, 11, 40, 10); x.bezierCurveTo(58, 8, 60, 34, 32, 54); x.closePath(); x.stroke(); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(22, 22, 5, 3, -0.6, 0, 7); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const HS = []; for (let i = 0; i < 28; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); HS.push({ s, life: 0 }); }
function hearts(p, n = 7) { for (let k = 0; k < n; k++) { const h = HS.find(q => q.life <= 0); if (!h) return; h.s.position.copy(p).add(V3((Math.random() - 0.5) * 0.4, Math.random() * 0.2, 0.2)); h.v = V3((Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.5, 0.1); h.life = h.max = 1.2 + Math.random() * 0.5; h.s.visible = true; } }
function tickHearts(dt) { for (const h of HS) { if (h.life <= 0) continue; h.life -= dt; h.s.position.addScaledVector(h.v, dt); const k = 1 - h.life / h.max; h.s.scale.setScalar(0.11 * (0.6 + Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 0.5)); h.s.material.opacity = Math.min(1, h.life * 2); if (h.life <= 0) h.s.visible = false; } }

// ------------------------------------------------------------------------------------------------- story runner
function startChapter(n, { replay = false } = {}) {
  const ch = CH.find(c => c.n === n); if (!ch) return;
  const resume = !replay && P.run && P.run.ch === n;
  if (!resume && !replay && n > 1 && !P.done[n]) {
    if (!M.useLife()) { openSheet('keys', { then: () => startChapter(n) }); return; }
    chip('🗝️ <span>Chapter unlocked</span>', 'gold');
  }
  M.level(Object.keys(P.done).length + Object.keys(P.ds.log).length + 1);
  ui.hideStart(); for (const id of ['choices', 'outfit', 'quiz']) $(id).classList.add('hidden'); QZ = null; line = null;
  phase = 'play'; document.body.classList.add('playing');
  RUN = { ch, n, i: resume ? P.run.i : 0, flags: new Set(resume ? P.run.flags : P.flags), rel: { ...(resume ? P.run.rel : P.rel) }, replay: replay || !!P.done[n],
    earned: { rel: {}, album: [], stickers: [] }, cliff: '', t0: performance.now(), busy: false, setB: resume ? P.run.setB : null, cast: resume ? P.run.cast : [] };
  if (resume) RUN.earned = P.run.earned || RUN.earned;
  $('menuBtn').classList.remove('hidden'); $('chap').classList.remove('hidden');
  $('chap').querySelector('b').textContent = `Chapter ${n}${RUN.replay ? ' · replay' : ''}`; $('chap').querySelector('span').textContent = ch.title;
  $('tapzone').classList.remove('hidden');
  if (resume && RUN.setB) doSet(RUN.setB, true).then(() => { for (const [id, mark] of RUN.cast) { const a = A[id]; if (a) place(a, mark); } next(); });
  else next();
}
function saveRun() {
  if (!RUN || RUN.replay) return;
  P.run = { ch: RUN.n, i: Math.max(0, RUN.lastSay ?? RUN.i), flags: [...RUN.flags], rel: RUN.rel, setB: RUN.setB, cast: present().map(a => [a.id, a.mark]), earned: RUN.earned };
  saveP();
}
function cond(c) {
  return c.split('&').every(p => {
    p = p.trim(); let m;
    if ((m = /^(\w+)(>=|<=|>|<)(-?\d+)$/.exec(p))) { const v = RUN.rel[m[1]] || 0, n = +m[3]; return m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : v < n; }
    if (p[0] === '!') return !RUN.flags.has(p.slice(1));
    return RUN.flags.has(p);
  });
}
function next() {
  if (!RUN || RUN.busy) return;
  const ch = RUN.ch;
  for (let guard = 0; guard < 500; guard++) {
    const b = ch.beats[RUN.i]; if (!b) return endChapter();
    RUN.i++;
    switch (b.k) {
      case 'set': { RUN.setB = b; RUN.busy = true; const R0 = RUN; doSet(b).then(() => { if (RUN !== R0 || R0.stale) return; RUN.busy = false; next(); }); return; }
      case 'enter': { const a = A[b.id]; if (a) { if (!a.present) a.yawNow = null; place(a, b.mark, !a.present); if (a.alpha < 0.5 && phase === 'play') { SND.pop(); a.hop = 1; } } continue; }
      case 'exit': { const a = A[b.id]; if (a) a.present = false; continue; }
      case 'goto': RUN.i = ch.labels[b.to]; if (RUN.pendingPhoto) { const id = RUN.pendingPhoto; RUN.pendingPhoto = null; RUN.busy = true; photoMoment(id).then(() => { RUN.busy = false; next(); }); return; } continue;
      case 'if': if (cond(b.cond)) RUN.i = ch.labels[b.to]; continue;
      case 'album': if (gainAlbum(b.id)) { RUN.busy = true; photoMoment(b.id).then(() => { RUN.busy = false; next(); }); return; } continue;
      case 'sticker': gainSticker(b.id); continue;
      case 'sfx': SND[b.id] && SND[b.id](); continue;
      case 'anim': { const a = A[b.id]; if (a) play(a, b.clip, 0.2); continue; }
      case 'emote': { const a = A[b.id]; if (a) emote(a, b.kind, 1.8); continue; }
      case 'note': chip(esc(nm(b.text)), 'note'); continue;
      case 'cliff': RUN.cliff = b.text; continue;
      case 'end': return endChapter();
      case 'name': RUN.lastSay = RUN.i - 1; askName(); return;
      case 'letter': RUN.lastSay = RUN.i - 1; showLetter(b.text); return;
      case 'outfit': RUN.lastSay = RUN.i - 1; showOutfit(b.id); return;
      case 'choice': RUN.lastSay = RUN.i - 1; showChoice(b); return;
      case 'say': RUN.lastSay = RUN.i - 1; say(b); saveRun(); return;
    }
  }
}
function progress() { if (!RUN) return; $('chap').querySelector('u').style.width = Math.round(RUN.i / RUN.ch.beats.length * 100) + '%'; }
async function doSet(b, quick = false) {
  hideBubble(); const R0 = RUN;
  $('fade').style.opacity = 1; await sleep(quick ? 50 : 420);
  if (RUN !== R0 || (R0 && R0.stale)) { if (!RUN) $('fade').style.opacity = 0; return; }
  useSet(b.set, b.v);
  const [where, when] = (b.cap || '').split('·').map(s => s.trim());
  $('loc').querySelector('small').textContent = when || ''; $('loc').querySelector('h2').textContent = where || '';
  let j = RUN.i; const ch = RUN.ch;
  while (ch.beats[j] && (ch.beats[j].k === 'enter' || ch.beats[j].k === 'exit')) { const e = ch.beats[j]; const a = A[e.id]; if (a) { if (e.k === 'enter') { a.yawNow = null; place(a, e.mark); } else a.present = false; } j++; }
  RUN.i = j;
  const nb = ch.beats[j]; setCam(nb && nb.k === 'say' && nb.id ? shotFor(nb) : { ...set.est, off: [0, -40] }, true);
  if (!quick) { $('loc').classList.add('on'); SND.swoosh(); await sleep(BOT() ? 450 : 1450); }
  $('fade').style.opacity = 0; await sleep(quick ? 50 : 320); $('loc').classList.remove('on');
}
function gainSticker(id) {
  if (!STICKERS[id]) return;
  if (!P.stickers.includes(id)) { P.stickers.push(id); saveP(); stickerPop(id); }
  if (RUN && !RUN.earned.stickers.includes(id)) RUN.earned.stickers.push(id);
}
function gainAlbum(id) {
  if (!ALBUM[id]) return false;
  const fresh = !P.album.includes(id);
  if (fresh) { P.album.push(id); saveP(); }
  if (!RUN.earned.album.includes(id)) RUN.earned.album.push(id);
  return fresh || !photo(id);
}
async function photoMoment(id) {
  hideBubble(); await sleep(60);
  const pr = present(), who = A[ALBUM[id].who];
  const list = who && who.present ? pr.filter(a => a === who || a === me) : pr; photoList = list;
  setCam(list.length >= 2 ? shotGroup(list) : list.length ? shotSingle(list[0], null) : { ...set.est, off: [0, 0] }, true);
  for (const a of list) { setEmo(a, 'happy'); }
  if (who && who.present) play(who, who.clips.wave ? 'wave' : 'cheer', 0.2);
  await sleep(BOT() ? 250 : 500); shotReq = id; await sleep(BOT() ? 600 : 1500);
}

// ------------------------------------------------------------------------------------------------- lines
function say(b) {
  progress();
  const isN = !b.id, a = b.id ? A[b.id] : null, think = b.think;
  line = { b, text: nm(b.text), shown: 0, done: false, t: 0 };
  const prevId = say.prev; say.prev = b.id || '_n';
  setCam(shotFor(b), false, prevId === say.prev ? 2.2 : 6);
  if (a) { setEmo(a, b.emo || ''); if (!think) a.talkT = Math.min(4, line.text.length * 0.035); }
  for (const o of present()) if (o !== a && b.emo === 'shock' && o.id !== 'me' && Math.random() < 0.35) setEmo(o, 'shock');
  const el = $('bubble');
  el.className = isN ? 'narr' : think ? 'think' : '';
  const tag = el.querySelector('.tag');
  if (!isN) { const c = CAST[b.id] || CAST.me; tag.innerHTML = esc(nm(c.name)) + (think ? '<small>thinking</small>' : c.li && c.pron ? `<small>${c.pron}</small>` : ''); tag.style.background = c.color; el.style.setProperty('--c', c.color + '88'); }
  else el.style.removeProperty('--c');
  typeOut(0);
  el.classList.remove('off');
  requestAnimationFrame(() => setCam(shotFor(b), false, prevId === say.prev ? 2.2 : 6));
}
function tickLine(dt) {
  if (!line || line.done) return;
  line.t += dt; const n = Math.min(line.text.length, Math.floor(line.t * 55));
  if (n !== line.shown) { line.shown = n; typeOut(n); }
  if (n >= line.text.length) finishLine();
  if (line.b.id) { const a = A[line.b.id]; if (a) { const p = headOf(a).project(cam); const x = (p.x * 0.5 + 0.5) * W, el = $('bubble'), r = el.getBoundingClientRect(); const lx = clamp(x - r.left - 11, 28, r.width - 50); el.querySelector('.tail').style.left = lx + 'px'; el.style.setProperty('--tx', lx + 'px'); } }
}
function typeOut(n) { const p = $('bubble').querySelector('p'); p.innerHTML = esc(line.text.slice(0, n)) + '<span style="opacity:0">' + esc(line.text.slice(n)) + '</span>'; }
function finishLine() { if (!line) return; line.done = true; line.shown = line.text.length; $('bubble').querySelector('p').textContent = line.text; $('bubble').classList.add('done'); line.doneAt = performance.now(); }
function hideBubble() { $('bubble').classList.add('off'); $('bubble').classList.remove('done'); }
function advance() {
  if (!RUN || RUN.busy) return;
  if (letterOn) { closeLetter(); return; }
  if (!line) return;
  if (!line.done) { finishLine(); return; }
  SND.next(); $('bubble').classList.remove('done');
  const a = line.b.id ? A[line.b.id] : null; if (a) a.talkT = 0;
  line = null; next();
}
$('tapzone').addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); if (phase === 'play' && RUN) advance(); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in chapter 1, until the first touch,
// a finished line steps on to the next one by itself twice (never past a choice), so "tap to read on" is shown
demo(() => advance(), { ready: () => phase === 'play' && RUN && RUN.n === 1 && !RUN.replay && !RUN.busy && line && line.done && !letterOn
  && $('choices').classList.contains('hidden') && $('sheet').classList.contains('hidden') && $('namebox').classList.contains('hidden'), wait: 2000, every: 2600, max: 2 });
addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && phase === 'play' && RUN && $('namebox').classList.contains('hidden')) { e.preventDefault(); advance(); } });

// ------------------------------------------------------------------------------------------------- name + letter
function askName() {
  hideBubble();
  if (me.present) setCam(shotSingle(me, nearest(me, present().filter(x => x !== me))), false, 3);
  const box = $('namebox'), inp = $('nameI'); inp.value = P.name || ''; box.classList.remove('hidden'); RUN.naming = true;
  if (!BOT()) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 300);
}
function confirmName() {
  if (!RUN || !RUN.naming) return;
  const v = $('nameI').value.replace(/[<>{}]/g, '').trim().slice(0, 14);
  if (!v) { $('nameI').placeholder = 'Type a name ✦'; $('nameI').focus(); return; }
  P.name = v; saveP(); RUN.naming = false; $('namebox').classList.add('hidden'); try { $('nameI').blur(); } catch (e) {}
  SND.pick(); hearts(headOf(me), 6); setEmo(me, 'cheer'); next();
}
stop($('namebox')); stop($('nameI'));
$('nameOk').addEventListener('click', e => { e.stopPropagation(); confirmName(); });
$('nameI').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') confirmName(); });
let letterOn = false;
function showLetter(text) {
  hideBubble(); letterOn = true; SND.letter();
  $('letter').querySelector('p').textContent = nm(text); $('letter').classList.add('on');
}
function closeLetter() { letterOn = false; $('letter').classList.remove('on'); SND.tap(); next(); }
$('letter').addEventListener('pointerdown', e => { e.stopPropagation(); if (letterOn && RUN && !RUN.busy) closeLetter(); });

// ------------------------------------------------------------------------------------------------- choices
function showChoice(b) {
  hideBubble(); progress();
  const box = $('choices'); box.innerHTML = '';
  const pr = present(); if (pr.length >= 3) setCam(shotGroup(pr), false, 3); else if (me.present) setCam(shotSingle(me, nearest(me, pr.filter(x => x !== me))), false, 3);
  if (b.prompt) { const p = document.createElement('p'); p.className = 'prompt'; p.textContent = nm(b.prompt); box.appendChild(p); }
  b.opts.forEach((o, i) => {
    const paid = o.cost && P.paid.includes(RUN.n + ':' + o.to);
    const btn = document.createElement('button'); btn.className = 'opt' + (o.cost ? ' prem' : ''); btn.style.animationDelay = (i * 0.07) + 's';
    btn.innerHTML = `${o.cost ? '<span class="gem">✦ BONUS SCENE</span>' : ''}<span class="t">${esc(nm(o.text))}</span>${o.cost ? (paid ? '<span class="cost paid">✓ Yours</span>' : `<span class="cost"><img alt="" src="${COIN}">${o.cost}</span>`) : ''}`;
    stop(btn); btn.addEventListener('click', e => { e.stopPropagation(); pick(o); });
    box.appendChild(btn);
  });
  box.classList.remove('hidden'); SND.choice();
  RUN.choice = { b, opts: b.opts };
}
function pick(o) {
  if (!RUN || !RUN.choice) return;
  unlock();
  if (o.cost) {
    const key = RUN.n + ':' + o.to;
    if (!P.paid.includes(key)) {
      if (!M.spend(o.cost, 'premium-choice')) { chip(`<span>Not enough coins for this bonus scene</span>`); setTimeout(() => M.shop(), 350); return; }
      P.paid.push(key); saveP(); SND.coin();
    }
  }
  SND.pick(); buzz(12);
  $('choices').classList.add('hidden'); RUN.choice = null;
  RUN.flags.add(o.to); for (const f of o.fx.flags) RUN.flags.add(f);
  for (const [id, n] of Object.entries(o.fx.rel)) { RUN.rel[id] = (RUN.rel[id] || 0) + n; RUN.earned.rel[id] = (RUN.earned.rel[id] || 0) + n; if (n) setTimeout(() => relChip(id, n), 250); }
  const big = Object.entries(o.fx.rel).find(([id, n]) => n >= 2 && CAST[id] && CAST[id].li);
  if (big) setTimeout(() => chip(`💭 ${esc(CAST[big[0]].name)} will remember that.`, 'note'), 1000);
  for (const id of o.fx.sticker) gainSticker(id);
  for (const id of o.fx.album) if (gainAlbum(id)) RUN.pendingPhoto = id;
  RUN.i = RUN.ch.labels[o.to];
  saveRun(); next();
}

// ------------------------------------------------------------------------------------------------- outfits
let outfitSel = null;
const SWATCH = l => l.hue == null ? 'linear-gradient(135deg,#c9a8ff,#8a63ff 60%,#3d3470)' : `linear-gradient(135deg,hsl(${l.hue},90%,${Math.min(92, 70 * (l.lit || 1))}%),hsl(${l.hue},75%,${Math.min(80, 52 * (l.lit || 1))}%))`;
function showOutfit(id) {
  hideBubble();
  const O = OUTFITS[id], box = $('outfit');
  outfitSel = O.looks.find(l => l.id === P.outfit) ? P.outfit : O.looks[0].id;
  for (const a of present()) if (a !== me) a.present = false;
  const look0 = lookById(outfitSel); dress(me, look0, PROTO);
  setCam(frame(me.o.position.clone().add(V3(0, me.cfg.h * 0.5, 0)), me.cfg.h * 1.15, 1.2, V3(0.15, 0.1, 1), 30, { x0: 0, x1: W, y0: 66, y1: H - (W > H ? 300 : 340) }), false, 3);
  const render = () => {
    box.innerHTML = `<div class="head"><b>Pick your look ✦</b>${esc(O.prompt)}</div><div class="tray">
      <div class="row">${O.looks.map(l => { const owned = !l.cost || P.paid.includes('look:' + l.id);
        return `<button class="look ${outfitSel === l.id ? 'on' : ''}" data-l="${l.id}">${l.cost && !owned ? `<span class="c"><img alt="" src="${COIN}">${l.cost}</span>` : ''}<span class="sw" style="background:${SWATCH(l)}">${l.acc && l.acc[0] ? `<img alt="" src="./assets/thumbs/${{ b01: 'b01', b02: 'b01', w09: 'w09', w07: 'w07' }[l.acc[0]]}.webp">` : ''}</span><b>${esc(l.name)}</b><small>${esc(l.note)}</small></button>`; }).join('')}</div>
      <button class="play" id="oOk">Wear this ✓</button></div>`;
    for (const b of box.querySelectorAll('.look')) { stop(b); b.addEventListener('click', e => { e.stopPropagation(); tryLook(b.dataset.l, render); }); }
    const ok = box.querySelector('#oOk'); stop(ok); ok.addEventListener('click', e => { e.stopPropagation(); confirmOutfit(); });
  };
  render(); box.classList.remove('hidden'); RUN.outfit = { render, O };
  stop(box);
}
function tryLook(id, render) {
  SND.tap(); outfitSel = id; dress(me, lookById(id), PROTO); setEmo(me, 'happy'); me.hop = 1; hearts(headOf(me), 3); render();
}
function confirmOutfit() {
  const l = lookById(outfitSel);
  if (l.cost && !P.paid.includes('look:' + l.id)) {
    if (!M.spend(l.cost, 'outfit')) { chip('<span>Not enough coins for this look</span>'); setTimeout(() => M.shop(), 350); return; }
    P.paid.push('look:' + l.id); SND.coin();
  }
  P.outfit = l.id; saveP(); SND.pick(); confetti(scene, headOf(me), 36);
  RUN.flags.add('look_' + l.id);
  $('outfit').classList.add('hidden'); RUN.outfit = null;
  if (l.acc && l.acc.includes('b01')) gainSticker('bow');
  const ch = RUN.ch; for (let j = RUN.i - 2; j >= 0; j--) { const b = ch.beats[j]; if (b.k === 'set') break; if (b.k === 'enter' && b.id !== 'me' && A[b.id]) { let gone = false; for (let k = j + 1; k < RUN.i; k++) if (ch.beats[k].k === 'exit' && ch.beats[k].id === b.id) gone = true; if (!gone) A[b.id].present = true; } }
  setEmo(me, 'cheer'); saveRun(); next();
}

// ------------------------------------------------------------------------------------------------- chapter end
let ended = null;
function endChapter() {
  if (!RUN) return;
  const r = RUN, first = !r.replay && !P.done[r.n];
  hideBubble(); $('choices').classList.add('hidden');
  SND.cliff();
  if (!r.replay) { P.rel = r.rel; P.flags = [...r.flags]; P.done[r.n] = true; P.next = Math.max(P.next, r.n + 1); P.run = null; saveP(); }
  const coins = first ? 30 : 5; M.add(coins, 'chapter');
  if (first) B.submit(1, { ms: performance.now() - r.t0 });
  D.won(r.n, 'finished chapter');
  ended = { r, coins, doubled: false };
  phase = 'won'; RUN = null; line = null; $('tapzone').classList.add('hidden'); $('menuBtn').classList.add('hidden'); $('chap').classList.add('hidden');
  renderEnd();
  ui.win(r.n, '');
}
function renderEnd() {
  const e = ended, r = e.r, w = ui.els.win;
  let c = w.querySelector('.endc'); if (!c) { c = document.createElement('div'); c.className = 'endc'; w.prepend(c); }
  const rels = Object.entries(r.earned.rel).filter(([id, n]) => n && CAST[id]);
  const nxt = BOOK.chapters[r.n];
  c.innerHTML = `<div class="k">CHAPTER ${r.n} COMPLETE ✦</div><h2>${esc(r.ch.title)}</h2>
    ${r.cliff ? `<div class="cl"><small>TO BE CONTINUED…</small>${esc(nm(r.cliff))}</div>` : ''}
    ${rels.length ? `<div class="rels">${rels.map(([id, n]) => `<span class="rel"><img alt="" src="${thumb(id)}">${esc(CAST[id].name)} <span style="color:#ff5fa2">${n > 0 ? '+' + n + ' ♥' : n}</span></span>`).join('')}</div>` : ''}
    ${r.earned.album.length ? `<div class="pols">${r.earned.album.map((k, i) => `<div class="pol" style="--r:${i % 2 ? 3 : -3}deg">${photo(k) ? `<img alt="" src="${photo(k)}">` : '<div class="blank">♡</div>'}<b>${esc(ALBUM[k].title)}</b></div>`).join('')}</div>` : ''}
    <div class="coins"><img alt="" src="${COIN}">+${e.coins * (e.doubled ? 2 : 1)} coins</div>
    ${!e.doubled && e.coins >= 30 ? '<button class="dbl" id="dblB">▶ Double them · watch a short video</button>' : ''}
    ${nxt ? `<div class="cl" style="font-size:15.5px"><small>NEXT · CHAPTER ${nxt.n}${nxt.soon ? ' · COMING SOON' : ''}</small>${nxt.icon} ${esc(nxt.title)}</div>` : ''}
    <div class="tap">Tap to continue</div>`;
  const d = c.querySelector('#dblB');
  if (d) { stop(d); d.addEventListener('click', async ev => { ev.stopPropagation(); const ok = await M.rewarded('double', { what: `+${e.coins} more coins` }); if (ok) { M.add(e.coins, 'double'); e.doubled = true; SND.coin(); renderEnd(); } }); }
  let sw = w.querySelector('.sharewrap'); if (!sw) { sw = document.createElement('div'); sw.className = 'sharewrap'; w.appendChild(sw); const kb = w.querySelector('.hc-btn'); if (kb) sw.appendChild(kb); }
  for (const kb of w.querySelectorAll('.hc-btn')) kb.style.display = '';
}
async function afterWin() {
  if (QZ) { QZ = null; showLobby(false); return; }
  ended = null;
  await M.breakAd('level-end');
  showLobby(false);
}

// ------------------------------------------------------------------------------------------------- sheets
function openSheet(kind, opt = {}) {
  const sh = $('sheet'), inn = sh.querySelector('.in');
  const close = () => { sh.classList.add('hidden'); inn.innerHTML = ''; };
  const head = t => `<div class="sh-h"><h3>${t}</h3><button class="sh-x" data-x aria-label="Close">✕</button></div>`;
  if (kind === 'chapters') {
    inn.innerHTML = head('Book One') + `<div class="sh-b"><p class="note"><b>${esc(BOOK.title)}</b> · each chapter is about 10 minutes. Your choices carry forward; replays never change your saved story.</p>${BOOK.chapters.map(c => {
      const done = P.done[c.n], cur = !c.soon && !done && c.n === P.next;
      return `<div class="chrow ${c.soon ? 'soon' : ''}"><div class="num">${c.icon}</div><div style="flex:1;padding-right:58px"><small>Chapter ${c.n} · ${esc(c.place)}</small><h4>${esc(c.title)}</h4><p>${esc(c.teaser)}</p>${done ? `<button class="rp" data-rp="${c.n}">↺ Replay with different choices</button>` : cur ? `<button class="rp" data-go="${c.n}">▶ Read now</button>` : ''}</div>
        <span class="st ${cur ? 'cur' : c.soon || c.n > P.next ? 'lock' : ''}">${done ? '✓ Read' : cur ? 'Up next' : c.soon ? 'Soon' : '🗝️'}</span></div>`; }).join('')}</div>`;
  } else if (kind === 'album') {
    P.seen = P.album.length + P.stickers.length; saveP();
    const tab = opt.tab || 'hearts';
    let body = '';
    if (tab === 'hearts') body = ['sol', 'mika', 'june', 'bea'].map(id => { const c = CAST[id], keys = Object.keys(ALBUM).filter(k => ALBUM[k].who === id), n = P.rel[id] || 0, hs = Math.max(0, Math.min(5, Math.round(n / 2)));
      return `<div class="person" style="--c:${c.color}"><div class="ph"><img alt="" src="${thumb(id)}"><div><h4>${esc(c.name)}${c.pron ? `<small>${c.pron}</small>` : ''}</h4><p>${esc(c.role)}</p><div class="hearts">${'♥'.repeat(hs)}<i>${'♥'.repeat(5 - hs)}</i><small>${relName(n)}</small></div></div></div>
        <div class="pols">${keys.map((k, i) => { const have = P.album.includes(k), ph = have && photo(k); return `<div class="pol" style="--r:${i % 2 ? 2 : -2}deg">${ph ? `<img alt="" src="${ph}">` : `<div class="blank">${have ? '♡' : ALBUM[k].premium ? '✦' : '?'}</div>`}<b>${have ? esc(ALBUM[k].title) : ALBUM[k].premium ? 'Bonus moment' : '???'}</b></div>`; }).join('')}</div></div>`; }).join('');
    else if (tab === 'stickers') body = `<div class="stks">${Object.entries(STICKERS).map(([k, s]) => { const have = P.stickers.includes(k); return `<div class="stkc ${have ? '' : 'off'}"><img alt="" src="./assets/thumbs/${s.img}.webp"><b>${have ? esc(s.name) : '???'}</b></div>`; }).join('')}</div>`;
    else { const today = dayNum(), start = today - ((new Date().getDay() + 6) % 7); body = `<p class="note">A stamp for every daily quiz you pass. Streak: <b>🔥 ${P.ds.n || 0}</b> · one free streak freeze a week.</p>`;
      for (let w = 0; w < 4; w++) body += `<div class="week">${Array.from({ length: 7 }, (_, i) => { const d = start - (3 - w) * 7 + i, g = P.ds.log[d]; return `<div class="${g != null ? 'ok' : ''} ${d === today ? 'today' : ''}">${g != null ? '💗' : d > today ? '' : '·'}</div>`; }).join('')}</div>`; }
    inn.innerHTML = head(`Album <small>${P.album.length}/${Object.keys(ALBUM).length} moments · ${P.stickers.length}/${Object.keys(STICKERS).length} stickers</small>`) +
      `<div class="tabs"><button data-t="hearts" class="${tab === 'hearts' ? 'on' : ''}">💗 Hearts</button><button data-t="stickers" class="${tab === 'stickers' ? 'on' : ''}">⭐ Stickers</button><button data-t="daily" class="${tab === 'daily' ? 'on' : ''}">📅 Daily</button></div><div class="sh-b">${body}</div>`;
    if (phase === 'title') renderLobby();
  } else if (kind === 'menu') {
    inn.innerHTML = head('Paused') + `<div class="sh-b">
      <button class="mbtn" data-m="resume">▶ Keep reading</button>
      <button class="mbtn ${P.auto ? 'on' : ''}" data-m="auto">⏩ Auto-advance: ${P.auto ? 'on' : 'off'}</button>
      <button class="mbtn" data-m="album">💗 Album & hearts</button>
      <button class="mbtn" data-m="sound">${P.mute ? '🔇 Sound: off' : '🔊 Sound: on'}</button>
      <button class="mbtn" data-m="leave">🏠 Back to the quad <small style="opacity:.6">(your place is saved)</small></button></div>`;
  } else if (kind === 'you') {
    inn.innerHTML = head('You') + `<div class="sh-b"><p class="note">Your name in the story (nobody uses pronouns for you):</p><input class="name" id="nmI" maxlength="14" value="${esc(P.name)}" placeholder="Riley"><p class="note">Looks you own: ${[...new Set(['classic', 'mint', 'butter', 'peach', ...P.paid.filter(k => k.startsWith('look:')).map(k => k.slice(5))])].map(id => esc(lookById(id).name)).join(' · ')}. You pick your outfit in the story.</p><button class="play" data-x style="margin-top:6px">Done</button></div>`;
    const inp = inn.querySelector('#nmI'); ['pointerdown', 'pointerup', 'keydown'].forEach(ev => inp.addEventListener(ev, e => e.stopPropagation()));
    inp.addEventListener('input', () => { P.name = inp.value.replace(/[<>{}]/g, '').trim().slice(0, 14); saveP(); });
  } else if (kind === 'keys') {
    const L = M.lives(), s = L.nextAt ? Math.max(0, Math.ceil((L.nextAt - Date.now()) / 1000)) : 0;
    inn.innerHTML = head('Keys') + `<div class="sh-b keygate"><div class="big">🗝️</div><h4>${L.unlimited ? 'Unlimited keys' : `${L.n} of ${L.max} keys`}</h4><p>Each new chapter takes one key. Replays and the daily quiz are always free.${!L.unlimited && L.n < L.max ? ` Next key in <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b>.` : ''}</p>
      ${!L.unlimited && L.n < L.max ? '<button class="play mint" data-m="refill">▶ Refill keys · short video</button>' : ''}<button class="ghost" data-x style="width:100%;margin-top:10px">${L.n ? 'Close' : 'I\'ll wait'}</button></div>`;
  }
  sh.classList.remove('hidden'); stop(sh);
  sh.onclick = async e => {
    e.stopPropagation();
    if (e.target === sh || e.target.closest('[data-x]')) { SND.tap(); close(); if (kind === 'you' && phase === 'title') renderLobby(); return; }
    const t = e.target.closest('[data-t]'); if (t) { SND.tap(); openSheet('album', { tab: t.dataset.t }); return; }
    const rp = e.target.closest('[data-rp]'); if (rp) { close(); startChapter(+rp.dataset.rp, { replay: true }); return; }
    const go = e.target.closest('[data-go]'); if (go) { close(); startChapter(+go.dataset.go); return; }
    const m = e.target.closest('[data-m]'); if (!m) return; SND.tap();
    const a = m.dataset.m;
    if (a === 'resume') close();
    if (a === 'auto') { P.auto = !P.auto; saveP(); openSheet('menu'); }
    if (a === 'album') openSheet('album');
    if (a === 'sound') { P.mute = !P.mute; setMuted(P.mute); saveP(); hud(); openSheet('menu'); }
    if (a === 'leave') { close(); saveRun(); if (RUN) RUN.stale = true; RUN = null; line = null; QZ = null; letterOn = false; $('letter').classList.remove('on'); showLobby(false); }
    if (a === 'refill') { const ok = await M.rewarded('lives', { title: 'Refill keys', what: 'All 5 keys, right now' }); close(); hud(); if (ok && opt.then) opt.then(); else if (phase === 'title') renderLobby(); }
  };
}

// ------------------------------------------------------------------------------------------------- daily quiz: "Who said it?" (?daily=1)
const QWHO = ['bea', 'sol', 'mika', 'june'];
function makeQuiz(seed) {
  const r = rng(seed * 7 + 13), rounds = [], used = new Set();
  for (let i = 0; i < 5; i++) {
    let who, q, guard = 0;
    do { who = QWHO[Math.floor(r() * 4)]; q = QUOTES[who][Math.floor(r() * QUOTES[who].length)]; } while ((used.has(q) || (i > 0 && rounds[i - 1].who === who && r() < 0.7)) && guard++ < 50);
    used.add(q); rounds.push({ who, q });
  }
  return rounds;
}
async function startQuiz() {
  ui.hideStart(); phase = 'play'; document.body.classList.add('playing'); RUN = null; line = null;
  QZ = { rounds: makeQuiz(D.seed || dayNum()), i: 0, marks: [], t0: performance.now(), ruled: [], hintUsed: false, busy: false };
  $('menuBtn').classList.remove('hidden'); $('chap').classList.remove('hidden');
  $('chap').querySelector('b').textContent = 'Daily quiz'; $('chap').querySelector('span').textContent = 'Who said it? · ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' }); $('chap').querySelector('u').style.width = '0%';
  M.level(Object.keys(P.done).length + Object.keys(P.ds.log).length + 1);
  hideBubble(); $('fade').style.opacity = 1; await sleep(380); useSet('cafe', 'dusk');
  const marks = { bea: 'LL', sol: 'L', mika: 'R', june: 'RR' };
  for (const id of QWHO) { place(A[id], marks[id]); setFade(A[id], 1); A[id].yawNow = null; }
  $('loc').querySelector('small').textContent = 'Daily quiz'; $('loc').querySelector('h2').textContent = 'Who said it?'; $('loc').classList.add('on');
  setCam(quizCam(), true); await sleep(BOT() ? 400 : 1300); $('fade').style.opacity = 0; await sleep(300); $('loc').classList.remove('on');
  renderQuiz();
}
const quizCam = () => frame(V3(0, 0.66, 1.0), 1.25, 4.9, V3(0, 0.12, 1), 34, { x0: 0, x1: W, y0: 70, y1: H - (W > H ? 330 : 380) });
function renderQuiz() {
  const box = $('quiz'), r = QZ.rounds[QZ.i];
  if (!r) return finishQuiz();
  setCam(quizCam(), false, 2.5);
  box.innerHTML = `<div class="q"><small>QUOTE ${QZ.i + 1} OF 5 · WHO SAID IT?</small>“${esc(r.q)}”<div class="dots">${QZ.rounds.map((_, i) => QZ.marks[i] == null ? '<span style="opacity:.35">♡</span>' : QZ.marks[i] ? '💗' : '🤍').join('')}</div></div>
    <div class="who4">${QWHO.map(id => `<button class="qb ${QZ.ruled.includes(id) ? 'x' : ''}" data-w="${id}" style="--c:${CAST[id].color}"><img alt="" src="${thumb(id)}"><b>${CAST[id].name}</b><span>${QUIZ_HINTS[id]}</span></button>`).join('')}</div>
    <div class="crow">${QZ.hintUsed ? '' : '<button class="ghost" id="qHint">▶ Rule one out · short video</button>'}</div>`;
  for (const b of box.querySelectorAll('.qb')) { stop(b); b.addEventListener('click', e => { e.stopPropagation(); answer(b.dataset.w); }); }
  const h = box.querySelector('#qHint'); if (h) { stop(h); h.addEventListener('click', async e => { e.stopPropagation(); const ok = await M.rewarded('hint', { what: 'One wrong answer crossed off' }); if (ok && QZ) { QZ.hintUsed = true; const wrong = QWHO.filter(w => w !== QZ.rounds[QZ.i].who && !QZ.ruled.includes(w)); QZ.ruled.push(wrong[Math.floor(Math.random() * wrong.length)]); renderQuiz(); } }); }
  box.classList.remove('hidden'); stop(box);
}
async function answer(id) {
  if (!QZ || QZ.busy || QZ.ruled.includes(id)) return;
  QZ.busy = true;
  const r = QZ.rounds[QZ.i], ok = id === r.who, btn = $('quiz').querySelector(`[data-w="${id}"]`);
  QZ.marks[QZ.i] = ok;
  if (ok) { btn.classList.add('ok'); SND.right(); setEmo(A[id], 'cheer'); hearts(headOf(A[id]), 8); emote(A[id], 'heart'); }
  else { btn.classList.add('no'); SND.wrong(); buzz([20, 40, 20]); setEmo(A[id], 'shock'); emote(A[id], 'q'); const rb = $('quiz').querySelector(`[data-w="${r.who}"]`); rb && rb.classList.add('ok'); setEmo(A[r.who], 'wave'); }
  $('chap').querySelector('u').style.width = ((QZ.i + 1) * 20) + '%';
  await sleep(BOT() ? 500 : 1150);
  if (!QZ) return;
  QZ.i++; QZ.ruled = []; QZ.busy = false; renderQuiz();
}
function finishQuiz() {
  $('quiz').classList.add('hidden');
  const n = QZ.marks.filter(Boolean).length, ok = n >= 3, today = dayNum(), q = QZ;
  if (ok && P.ds.log[today] == null) {
    const wk = Math.floor((today + 3) / 7);
    if (P.ds.last === today - 1) P.ds.n++;
    else if (P.ds.last === today - 2 && P.ds.freeze !== wk) { P.ds.n++; P.ds.freeze = wk; setTimeout(() => chip('❄️ Streak freeze used. Your streak is safe.', 'note'), 600); }
    else P.ds.n = 1;
    P.ds.last = today; P.ds.log[today] = n; saveP();
    M.add(15, 'daily-quiz'); B.submit(1, { ms: performance.now() - q.t0 });
  }
  const grid = `Starlit Crush · Who said it? ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}\n${q.marks.map(m => m ? '💗' : '🤍').join('')} ${n}/5${ok && P.ds.n > 1 ? ` · 🔥${P.ds.n}` : ''}`;
  phase = ok ? 'won' : 'lost'; $('menuBtn').classList.add('hidden'); $('chap').classList.add('hidden');
  for (const id of QWHO) setEmo(A[id], ok ? 'cheer' : 'sad');
  if (ok) {
    D.won(n, 'got');
    SND.win(); confetti(scene, V3(0, 1.3, 0.8), 70);
    const w = ui.els.win; let el = w.querySelector('.endc'); if (!el) { el = document.createElement('div'); el.className = 'endc'; w.prepend(el); }
    el.innerHTML = `<div class="k">DAILY QUIZ ✦</div><h2>${n === 5 ? 'Perfect score!' : 'You know them!'}</h2><div class="grid">${q.marks.map(m => m ? '💗' : '🤍').join('')}</div>
      <div class="cl"><small>STREAK</small>🔥 ${P.ds.n} day${P.ds.n === 1 ? '' : 's'} · one free streak freeze a week</div>
      <div class="coins"><img alt="" src="${COIN}">+15 coins</div><button class="dbl" id="shareG">Share my hearts (no spoilers)</button><div class="tap">Tap to continue</div>`;
    const sg = el.querySelector('#shareG'); stop(sg);
    sg.addEventListener('click', async e => { e.stopPropagation(); const u = new URL(location.href); u.search = '?daily=1'; try { if (navigator.share) { await navigator.share({ text: grid, url: u.href }); return; } } catch (er) { return; } try { await navigator.clipboard.writeText(grid + '\n' + u.href); chip('Copied! Paste it anywhere'); } catch (er) {} });
    for (const kb of w.querySelectorAll('.hc-btn')) kb.style.display = 'none';
    ui.win(1, '');
  } else {
    ui.lose('So close', `${n}/5 today. Read a chapter to get to know them, then try again tomorrow.`);
    const l = ui.els.lose; let el = l.querySelector('.endc'); if (!el) { el = document.createElement('div'); el.className = 'endc'; l.prepend(el); }
    el.innerHTML = `<div class="k">DAILY QUIZ</div><h2>${n}/5 today</h2><div class="grid">${q.marks.map(m => m ? '💗' : '🤍').join('')}</div><div class="cl">${q.rounds.map(r => `“${esc(r.q)}”<br><small style="display:inline;letter-spacing:.04em">${esc(CAST[r.who].name)}</small>`).join('<br>')}</div><div class="tap">Tap to go back to the quad</div>`;
  }
  $('tapzone').classList.add('hidden');
}

// ------------------------------------------------------------------------------------------------- loop
let last = performance.now();
loop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  if (phase !== 'loading' && set) {
    set.update(dt, T); tickStage(dt); tickLine(dt); tickHearts(dt);
    if (line && line.done && P.auto && RUN && !RUN.busy && performance.now() - line.doneAt > Math.max(1500, line.text.length * 42)) advance();
    updateCam(dt);
    C.render(dt);
    if (shotReq) { const k = shotReq; shotReq = null; takePhoto(k); }
  }
});

// ------------------------------------------------------------------------------------------------- test hooks + bot
let botWait = 0;
window.__game = {
  get state() { return phase === 'won' ? 'won' : phase === 'lost' ? 'lost' : phase === 'play' ? 'play' : 'ready'; },
  get level() { return RUN ? RUN.n : Math.min(P.next, 3); },
  get score() { return Object.keys(P.done).length + Object.keys(P.ds.log).length; },
  get CH() { return CH; },
  get A() { return A; }, get THREE() { return THREE; }, get cam() { return cam; },
  get debug() { return { phase, run: RUN && { n: RUN.n, i: RUN.i, busy: RUN.busy, flags: [...RUN.flags], rel: RUN.rel }, line: line && line.text, P, coins: M.coins(), lives: M.lives() }; },
  jump(n, label) { $('fade').style.opacity = 0; const ch = CH.find(c => c.n === n); const at = typeof label === 'number' ? label : typeof label === 'string' && label.startsWith('@') ? ch.beats.findIndex(b => b.k === 'set' && b.set + ' ' + b.v === label.slice(1)) : ch.labels[label]; if (RUN) RUN.stale = true; RUN = null; startChapter(n, { replay: true }); if (at >= 0 && RUN) { const old = RUN; RUN = { ...old }; old.stale = true; RUN.busy = false; RUN.i = at; line = null; next(); } },
  bot() {
    if (phase === 'title') { if ($('sheet').classList.contains('hidden')) startFromLobby(); return; }
    if (phase !== 'play') return;
    if (!$('sheet').classList.contains('hidden')) { const r = $('sheet').querySelector('[data-m="refill"]') || $('sheet').querySelector('[data-x]'); r && r.click(); return; }
    if (QZ) { if (QZ.busy || $('quiz').classList.contains('hidden')) return; if (botWait++ % 4) return; const r = QZ.rounds[QZ.i]; if (!r) return; const pickW = Math.random() < 0.85 ? r.who : QWHO[Math.floor(Math.random() * 4)]; answer(pickW); return; }
    if (!RUN || RUN.busy) return;
    if (RUN.naming) { if (botWait++ % 3 === 0) { $('nameI').value = 'Riley'; confirmName(); } return; }
    if (letterOn) { closeLetter(); return; }
    if (RUN.outfit) { if (botWait++ % 3 === 0) { const ls = RUN.outfit.O.looks.filter(l => !l.cost || M.coins() > 200); const l = ls[Math.floor(Math.random() * ls.length)]; outfitSel = l.id; dress(me, l, PROTO); confirmOutfit(); } return; }
    if (RUN.choice) {
      const opts = RUN.choice.opts, prem = opts.filter(o => o.cost && M.coins() >= o.cost + 60), free = opts.filter(o => !o.cost);
      pick(prem.length && Math.random() < 0.3 ? prem[0] : free[Math.floor(Math.random() * free.length)] || opts[0]); return;
    }
    if (line) { if (!line.done) finishLine(); advance(); }
  },
};
boot().catch(e => { console.error(e); const l = $('load'); if (l) l.querySelector('small').textContent = 'Could not load. Please refresh.'; });

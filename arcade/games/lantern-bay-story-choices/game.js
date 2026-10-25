// Lantern Bay: Story Choices — a 3D interactive story (mystery + light romance) in a seaside town.
// Hero Lab characters act out the script (story.js) in four code-built sets dressed with AI cozy props (sets.js);
// the camera cuts like a TV drama, lines type into Episode-style bubbles, choices change relationships, flags and
// chapter endings. Chapters 2+ cost a key (the money kit's lives = keys, +1 every 20 min, or a reward video);
// premium choices cost coins and add a polaroid to the relationship album (taken live from the 3D scene).
// Daily (?daily=1): "Case of the Day", a seeded who-did-it in the tearoom, same for everyone, with a streak + freeze.
import { THREE, createUI, store, loop, buzz, confetti, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { heroBar, selectedHero, onHeroesChange, heroName, heroThumb } from './kit/heroes.js';
import { CAST, ALBUM, CLUES, OUTFITS, BOOK, SCRIPT, parse } from './story.js';
import { loadProps, buildSets, PROP_IDS } from './sets.js';
import { initCast, makeActor, setEmo, setFade, tickActor } from './cast.js';
import { S as SND, music, ambience, setMuted, unlock } from './audio.js';

const NAME = 'Lantern Bay: Story Choices', KEY = 'lantern-bay';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const CH = parse(SCRIPT);
const P = Object.assign({ name: 'Nora', next: 1, done: {}, run: null, flags: [], rel: {}, album: [], clues: [], outfit: 'own', paid: [], mute: false, auto: false,
  ds: { last: 0, n: 0, freeze: -1, log: {} }, seen: 0 }, ST.get('p', {}));
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nm = s => String(s).replace(/\{name\}/g, P.name || 'Nora');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOT = () => !!navigator.webdriver;
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);
const thumb = id => `./assets/thumbs/${CAST[id]?.char || id}.webp`;
// painted art (art wave 1, assets/art/): speaker portraits in the dialogue box, establishing shots behind the location card when
// a scene changes, chapter cards. Mapped by role: the heroine is you; the lighthouse "keeper" in a peacoat is Kai (lifeboat crew,
// the tower climb); the baker is Theo (by name); the marine biologist is Juno (the harbour mechanic); the widow is Aunt Wren.
// No art yet: Mr Pike, Vesper, the bookshop, chapters 4, 5 and 7.
const ART = {
  pt: { me: 1, kai: 1, theo: 1, juno: 1, wren: 1 },
  set: { 'harbor dusk': 'harbour', 'harbor afternoon': 'harbour', 'harbor festival': 'harbour', 'harbor stall': 'harbour', 'harbor night': 'date', 'harbor launch': 'date', tearoom: 'bakery', lighthouse: 'lantern-room' },
  ch: { 1: 'harbour', 2: 'lighthouse', 3: 'date', 6: 'lighthouse', 8: 'lantern-room' },
};
const ptOf = id => ART.pt[id] ? `./assets/art/pt-${id}.webp` : null;
const sceneOf = b => ART.set[b.set + ' ' + b.v] || ART.set[b.set] || null;
const artImgs = {};
const artLoad = src => artImgs[src] || (artImgs[src] = new Promise(ok => { const i = new Image(); i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => ok(true)); i.onerror = () => ok(false); i.src = src; }));

// ------------------------------------------------------------------------------------------------- renderer
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 900);
const C = cine(R, scene, cam, { bloom: 0.28, bloomThreshold: 1.25, bloomRadius: 0.45, exposure: 1.0, envIntensity: 0.45, lite: LITE, grade: { sat: 1.12, contrast: 1.04, vignette: 0.1, grain: 0 } });
const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 60 });
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xfff0e6, 0.55); fill.position.set(-4, 3, 9); scene.add(fill);
let W = innerWidth, H = innerHeight;

// ------------------------------------------------------------------------------------------------- kit layers
const ui = createUI({ title: 'Lantern Bay', hint: '', hand: '', progress: false, score: false });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'lantern-bay', label: 'Chapters & cases', mode: 'sum', limits: { maxRun: 1, maxPerSec: 0.2 }, corner: 'tl', accent: '#ffc85a' });
const M = money({ game: KEY, style: 'A' });
// story games have no fail state and the daily case must be the same puzzle for everyone, so flow.js has no knob here

// ------------------------------------------------------------------------------------------------- state
let phase = 'loading', SETS = null, set = null, A = {}, me = null, T = 0, wantStart = false;
let RUN = null;               // the chapter being read
let CASE = null;              // the daily case
let line = null;              // the line on screen { b, text, shown, done, t }
let shotReq = null;           // album photo to take after the next render
const flags = () => new Set(P.flags);

// ------------------------------------------------------------------------------------------------- loading
initCast(THREE, GLTFLoader);
const IDS = ['wren', 'kai', 'theo', 'juno', 'pike', 'vesper'];
let nLoaded = 0; const nTotal = PROP_IDS.length + IDS.length + 1;
const prog = () => { nLoaded++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(nLoaded / nTotal * 100) + '%'; };
async function boot() {
  await loadProps(THREE, GLTFLoader, PROP_IDS, prog);
  SETS = buildSets(THREE, scene);
  await Promise.all(IDS.map(id => makeActor(id, CAST[id]).then(a => { A[id] = a; a.o.visible = false; scene.add(a.o); }).catch(e => console.warn('actor', id, e)).finally(prog)));
  await buildMe(); prog();
  phase = 'title'; showLobby(true);
  $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 650);
  if (wantStart) startFromLobby();
}
// the player's actor: their Hero Lab hero (hero bar) or p09, wearing the chosen outfit
let meTok = 0, pikeL = null;
async function buildMe() {
  const tok = ++meTok, h = selectedHero(), look = lookById(P.outfit);
  let a = null;
  const opts = h ? { hero: h, items: look.items, hue: (h.hue + look.hue) % 1, sat: h.sat * look.sat, bri: h.bri * look.bri } : { items: look.items, hue: look.hue, sat: look.sat, bri: look.bri };
  try { a = await makeActor('me', CAST.me, opts); } catch (e) { console.warn('me', e); if (h) a = await makeActor('me', CAST.me, { items: look.items, hue: look.hue, sat: look.sat, bri: look.bri }); }
  if (tok !== meTok) { a.H.dispose(); return; }
  const old = me; me = a; A.me = a; scene.add(a.o);
  if (old) { a.o.position.copy(old.o.position); a.o.rotation.y = old.o.rotation.y; a.present = old.present; a.mark = old.mark; setFade(a, old.alpha); a.yawNow = old.yawNow; old.H.dispose(); }
  else { a.o.visible = false; }
}
const lookById = id => OUTFITS.festival.looks.find(l => l.id === id) || OUTFITS.festival.looks[0];

// ------------------------------------------------------------------------------------------------- sets + staging
function useSet(name, v) {
  for (const s of Object.values(SETS)) s.group.visible = false;
  set = SETS[name]; set.group.visible = true; set.set(v); set.vname = v;
  scene.background = set.bg; scene.fog = set.fog;
  hemi.color.set(set.hemi[0]); hemi.groundColor.set(set.hemi[1]); hemi.intensity = set.hemi[2];
  sun.color.set(set.sun[0]); sun.intensity = set.sun[1]; sun.position.set(...set.sun[2]).add(V3(0, 0, 0)); sun.target.position.set(0, 0.8, 0.5);
  if (name === 'harbor') { const d = V3(...set.sun[2]).normalize(); sun.position.copy(d.multiplyScalar(18)); }
  R.toneMappingExposure = set.exp || 1;
  for (const a of Object.values(A)) { a.present = false; setFade(a, 0); }
  const night = /night|launch/.test(v) || name === 'lighthouse' && v === 'night';
  music(night ? 'mystery' : /date|launch/.test(v) ? 'romance' : 'calm');
  ambience(name === 'harbor' ? 'sea' : 'room');
}
function place(a, mark, instant = true) {
  const p = (set.marks[mark] || set.marks.C).clone(); if (W < H) p.x *= 0.78; a.mark = mark; a.target = p;
  if (instant || !a.present) { a.o.position.copy(p); }
  a.present = true; a.fadeT = 1;
}
const present = () => Object.values(A).filter(a => a.present);

// ------------------------------------------------------------------------------------------------- camera
const camS = { pos: V3(0, 2, 8), look: V3(0, 1.4, 0), fov: 36, off: [0, 0] }, camG = { pos: V3(0, 2, 8), look: V3(0, 1.4, 0), fov: 36, off: [0, 0] };
let camCut = true, camK = 3, drift = 0;
function setCam(s, cut = false, k = 3) { camG.pos.copy(s.pos); camG.look.copy(s.look); camG.fov = s.fov; camG.off = s.off || [0, 0]; if (cut) camCut = true; camK = k; drift = 0; }
const bubbleH = () => { const b = $('bubble'); return b.classList.contains('off') ? 200 : b.offsetHeight + 34; };
function region() {
  const top = 70, bottom = Math.min(H * 0.42, Math.max(170, bubbleH() + 10));
  if (W > H * 1.1) { const w = Math.min(W * 0.55, 760); return { x0: (W - w) / 2, x1: (W + w) / 2, y0: top, y1: H - bottom }; }
  return { x0: 0, x1: W, y0: top, y1: H - bottom };
}
// frame a subject of height h centred at c, seen from direction dir, inside screen region r
function frame(c, h, w, dir, fov = 30, r = region(), fill = 0.92) {
  const t = 2 * Math.tan(fov * Math.PI / 360), hr = Math.max(80, r.y1 - r.y0), wr = Math.max(80, r.x1 - r.x0);
  const d = Math.max(h * H / (fill * hr * t), w * W / (0.94 * wr * t * (W / H)));
  return { pos: c.clone().add(dir.clone().normalize().multiplyScalar(d)), look: c.clone(), fov, off: [-((r.x0 + r.x1) / 2 - W / 2), -((r.y0 + r.y1) / 2 - H / 2)] };
}
const headOf = a => a.o.position.clone().add(V3(0, a.cfg.h * 0.9, 0));
function shotSingle(a, other, close = false) {
  const side = other ? Math.sign(other.o.position.x - a.o.position.x) || 1 : 0;
  const c = a.o.position.clone().add(V3(0, a.cfg.h * (close ? 0.8 : 0.72), 0));
  if (other && !close) { const o = other.o.position.clone(); o.y = c.y; c.lerp(o, 0.22); }
  const dir = V3(side * (close ? -0.25 : 0.22), 0.08, 1);
  return frame(c, a.cfg.h * (close ? 0.62 : 0.78), a.cfg.h * 0.55, dir, 30);
}
function shotGroup(list) {
  const bb = new THREE.Box3(); for (const a of list) { bb.expandByPoint(a.o.position); bb.expandByPoint(headOf(a)); }
  const c = bb.getCenter(V3()); const sz = bb.getSize(V3()); c.y = Math.max(...list.map(a => a.cfg.h)) * 0.62;
  return frame(c, Math.max(...list.map(a => a.cfg.h)) * 0.95, sz.x + 0.9, V3(0, 0.1, 1), 32);
}
function shotFor(b) {
  const pr = present();
  if (b && b.id) { const a = A[alias(b.id)]; if (a && a.present) { const others = pr.filter(x => x !== a); return shotSingle(a, nearest(a, others), b.think); } }
  if (pr.length >= 2) return shotGroup(pr);
  if (pr.length === 1) return frame(pr[0].o.position.clone().add(V3(0, pr[0].cfg.h * 0.6, 0)), pr[0].cfg.h * 1.25, 1.6, V3(0.25, 0.12, 1), 32);
  return { ...set.est, off: [0, -40] };
}
const nearest = (a, list) => list.sort((p, q) => p.o.position.distanceTo(a.o.position) - q.o.position.distanceTo(a.o.position))[0] || null;
function updateCam(dt) {
  const k = camCut ? 1 : 1 - Math.exp(-dt * camK); camCut = false;
  camS.pos.lerp(camG.pos, k); camS.look.lerp(camG.look, k); camS.fov = lerp(camS.fov, camG.fov, k);
  camS.off[0] = lerp(camS.off[0], camG.off[0], k); camS.off[1] = lerp(camS.off[1], camG.off[1], k);
  drift += dt;
  cam.position.copy(camS.pos);
  // a slow push-in keeps every shot alive
  const push = Math.min(1, drift / 9) * 0.05; cam.position.lerp(camS.look, push);
  cam.position.x += Math.sin(T * 0.21) * 0.025; cam.position.y += Math.sin(T * 0.33) * 0.015;
  cam.lookAt(camS.look);
  cam.fov = camS.fov; cam.aspect = W / H; cam.setViewOffset(W, H, camS.off[0], camS.off[1], W, H); cam.updateProjectionMatrix();
}
function resize() { W = innerWidth; H = innerHeight; R.setSize(W, H); C.resize(W, H); if (phase === 'title') lobbyCam(true); else if (line) setCam(shotFor(line.b), true); }
addEventListener('resize', resize);

// ------------------------------------------------------------------------------------------------- acting: facing + fades
function tickStage(dt) {
  const pr = present(), spk = line && line.b.id ? A[alias(line.b.id)] : null;
  for (const a of Object.values(A)) {
    if (!a.o) continue;
    const tgtA = a.present ? 1 : 0; if (Math.abs(a.alpha - tgtA) > 0.001) setFade(a, clamp(a.alpha + Math.sign(tgtA - a.alpha) * dt * 3.2, 0, 1));
    if (!a.o.visible) continue;
    if (a.target) a.o.position.lerp(a.target, 1 - Math.exp(-dt * 6));
    // who to look at: the speaker (or, if speaking, the nearest listener), blended toward the camera
    let look = null;
    if (phase === 'title') look = null;
    else if (spk && spk !== a && spk.present) look = spk.o.position;
    else { const o = nearest(a, pr.filter(x => x !== a)); if (o) look = o.o.position; }
    const camDir = Math.atan2(cam.position.x - a.o.position.x, cam.position.z - a.o.position.z);
    let yaw = camDir;
    if (look) { const toL = Math.atan2(look.x - a.o.position.x, look.z - a.o.position.z); yaw = angLerp(toL, camDir, a === spk ? 0.55 : 0.32); }
    if (RUN && RUN.outfit && a === me) yaw = camDir;
    if (phase === 'title') yaw = angLerp(Math.atan2(-a.o.position.x * 0.3, 1), camDir, 0.6);
    a.yawNow = a.yawNow == null ? yaw : angLerp(a.yawNow, yaw, 1 - Math.exp(-dt * 4));
    a.o.rotation.y = a.yawNow;
    tickActor(a, dt, T);
  }
}
function angLerp(a, b, t) { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; }
const alias = id => (id === 'pike' && RUN && RUN.pikeLantern && pikeL ? 'pike_l' : id);

// ------------------------------------------------------------------------------------------------- lobby
const startEl = ui.els.start;
const lob = document.createElement('div'); lob.className = 'lob'; startEl.appendChild(lob);
function lobbyCam(cut) { const wide = W > H * 1.25; setCam(frame(V3(0, 1.05, 0.4), 1.9, 3.4, V3(0.05, 0.0, 1), 38, wide ? { x0: W * 0.42, x1: W * 0.98, y0: H * 0.12, y1: H * 0.98 } : { x0: 0, x1: W, y0: H * 0.3, y1: H * 0.66 }, 0.95), cut, 2); }
function showLobby(cut) {
  phase = 'title'; document.body.classList.remove('playing');
  $('menuBtn').classList.add('hidden'); $('chap').classList.add('hidden'); hideBubble(); $('choices').classList.add('hidden'); $('outfit').classList.add('hidden'); $('case').classList.add('hidden'); $('tapzone').classList.add('hidden');
  useSet('harbor', 'launch'); set.setLight(1);
  place(me, 'C'); place(A.kai, 'LL'); place(A.theo, 'RR');
  for (const a of [me, A.kai, A.theo]) { setFade(a, 1); a.yawNow = null; setEmo(a, ''); }
  A.kai.o.position.set(-1.25, 0, -0.1); A.theo.o.position.set(1.25, 0, -0.1); me.o.position.set(0, 0, 0.45);
  A.kai.target = A.kai.o.position.clone(); A.theo.target = A.theo.o.position.clone(); me.target = me.o.position.clone();
  lobbyCam(cut); renderLobby(); ui.start();
}
function renderLobby() {
  const n = Math.min(P.next, 3), c = BOOK.chapters[n - 1], allDone = P.done[3];
  const free = n === 1 || P.done[n] || (P.run && P.run.ch === n);
  const cont = P.run && P.run.ch === n && P.run.i > 3;
  const h = selectedHero();
  lob.innerHTML = `
    <div class="logo"><h1>Lantern Bay</h1><span class="rib">STORY CHOICES</span></div>
    ${D.streak > 1 ? `<div class="streak">🔥 ${D.streak}-day streak</div>` : ''}
    <div class="lspace"></div>
    <div class="book" id="bookC">
      ${!D.seed && !allDone && ART.ch[n] ? `<div class="bkart" style="background-image:url(./assets/art/scene-${ART.ch[n]}-s.webp)"></div>` : ''}
      <span class="chn">${allDone ? 'BOOK 1 · 3/8' : `CH ${n}/8`}</span>
      <div class="bk">Book One · ${esc(BOOK.title)}</div>
      <h2>${D.seed ? 'Case of the Day' : allDone ? 'Chapter 4 is coming soon' : `${c.icon} ${esc(c.title)}`}</h2>
      <p>${D.seed ? 'Someone in Lantern Bay has done something they shouldn\'t. Three clues, five suspects, two guesses. Same case for everyone today.' : allDone ? 'You\'ve read every written chapter. Replay any chapter from the map to make different choices — or solve today\'s case.' : esc(c.teaser)}</p>
      <button class="play ${free || D.seed || allDone ? 'free' : ''}" id="playB">${D.seed ? '🔎 Open the case' : allDone ? '📖 Replay Chapter 3' : cont ? '▶ Continue' : `▶ Read Chapter ${n}`}<span class="kc">${D.seed || allDone || free ? 'FREE' : '🗝️ 1'}</span></button>
    </div>
    <div class="lrow">
      <button class="sq" data-s="chapters"><span class="e">🗺️</span>Chapters</button>
      <button class="sq" data-s="album"><span class="e">📸</span>Album${newAlbum() ? `<b>${newAlbum()}</b>` : ''}</button>
      <button class="sq" data-s="case"><span class="e">🔎</span>${P.ds.log[dayNum()] ? 'Solved ✓' : 'Daily case'}</button>
      <button class="sq" data-s="shop"><span class="e">🛍️</span>Shop</button>
    </div>
    <button class="who" id="whoB"><img alt="" src="${esc(h ? heroThumb(h) : thumb('me'))}" onerror="this.src='${thumb('me')}'">You: <b>${esc(P.name)}</b> ✎</button>`;
  for (const b of lob.querySelectorAll('.sq,.who')) {
    ['pointerdown', 'pointerup'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation()));
    b.addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); const s = b.dataset.s; if (b.id === 'whoB') openSheet('you'); else if (s === 'shop') M.shop(); else if (s === 'case') { if (!D.seed) location.search = '?daily=1'; else startFromLobby(); } else openSheet(s); });
  }
  hud();
}
const newAlbum = () => Math.max(0, P.album.length - (P.seen || 0));
// any tap on the start card that isn't a button starts (or continues) the story — also how the checker starts it
ui.onTap(which => {
  unlock();
  if (which === 'start') { if (phase === 'loading') { wantStart = true; return; } startFromLobby(); }
  if (which === 'win') afterWin();
  if (which === 'lose') { if (CASE) showLobby(false); }
});
function startFromLobby() {
  if (D.seed) return startCase();
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
for (const id of ['coinP', 'keyP', 'muteB', 'menuBtn']) ['pointerdown', 'pointerup'].forEach(ev => $(id).addEventListener(ev, e => e.stopPropagation()));
$('menuBtn').addEventListener('click', e => { e.stopPropagation(); SND.tap(); openSheet('menu'); });
setMuted(P.mute);

// ------------------------------------------------------------------------------------------------- toasts, polaroids
function chip(html, cls = '') { const d = document.createElement('div'); d.className = 'tchip ' + cls; d.innerHTML = html; $('toast').appendChild(d); setTimeout(() => d.remove(), 2900); }
function relChip(id, n) {
  if (!CAST[id] || !n) return;
  chip(`<img alt="" src="${thumb(id)}"><span>${esc(CAST[id].name)}</span><span class="h">${n > 0 ? '❤'.repeat(Math.min(3, n)) : '💔'}</span>`);
  const a = A[id]; if (a && a.present && n > 0) { hearts(headOf(a)); a.nod = 1; }
}
function snapAlbum(key, delay = 700) { setTimeout(() => { shotReq = key; }, delay); }
function takePhoto(key) {
  try {
    const src = R.domElement, cw = src.width, chh = src.height, ar = 3 / 4;
    let sw = chh * ar, sh = chh; if (sw > cw) { sw = cw; sh = cw / ar; }
    const c = document.createElement('canvas'); c.width = 270; c.height = 360;
    c.getContext('2d').drawImage(src, (cw - sw) / 2, Math.max(0, (chh - sh) / 2 - chh * 0.08), sw, sh * 0.9, 0, 0, 270, 360);
    const url = c.toDataURL('image/jpeg', 0.8);
    try { localStorage.setItem(`${KEY}_ph_${key}`, url); } catch (e) {}
    const s = $('snap'); s.querySelector('img').src = url; s.querySelector('b').textContent = ALBUM[key]?.title || ''; s.classList.add('on'); SND.photo(); $('flash').style.opacity = 0.55; setTimeout(() => $('flash').style.opacity = 0, 120);
    setTimeout(() => s.classList.remove('on'), 2300);
  } catch (e) { console.warn('photo', e); }
}
const photo = key => { try { return localStorage.getItem(`${KEY}_ph_${key}`); } catch (e) { return null; } };
// floating 3D hearts
const heartT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff5f86'; x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 6, 8, 24, 10); x.bezierCurveTo(30, 11, 32, 18, 32, 20); x.bezierCurveTo(32, 18, 34, 11, 40, 10); x.bezierCurveTo(58, 8, 60, 34, 32, 54); x.closePath(); x.stroke(); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const HS = []; for (let i = 0; i < 24; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); HS.push({ s, life: 0 }); }
function hearts(p, n = 7) { for (let k = 0; k < n; k++) { const h = HS.find(q => q.life <= 0); if (!h) return; h.s.position.copy(p).add(V3((Math.random() - 0.5) * 0.4, Math.random() * 0.2, 0.2)); h.v = V3((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.5, 0.1); h.life = h.max = 1.3 + Math.random() * 0.4; h.s.visible = true; } }
function tickHearts(dt) { for (const h of HS) { if (h.life <= 0) continue; h.life -= dt; h.s.position.addScaledVector(h.v, dt); const k = 1 - h.life / h.max; h.s.scale.setScalar(0.13 * (0.6 + Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 0.5)); h.s.material.opacity = Math.min(1, h.life * 2); if (h.life <= 0) h.s.visible = false; } }

// ------------------------------------------------------------------------------------------------- story runner
function startChapter(n, { replay = false } = {}) {
  const ch = CH.find(c => c.n === n); if (!ch) return;
  const resume = !replay && P.run && P.run.ch === n;
  if (!resume && !replay && n > 1 && !P.done[n]) {
    if (!M.useLife()) { openSheet('keys', { then: () => startChapter(n) }); return; }
    chip('🗝️ <span>Chapter unlocked</span>', 'gold');
  }
  ui.hideStart(); $('choices').classList.add('hidden'); $('outfit').classList.add('hidden'); $('case').classList.add('hidden'); CASE = null; line = null;
  phase = 'play'; document.body.classList.add('playing');
  RUN = { ch, n, i: resume ? P.run.i : 0, flags: new Set(resume ? P.run.flags : P.flags), rel: { ...(resume ? P.run.rel : P.rel) }, replay: replay || !!P.done[n],
    earned: { rel: {}, album: [], clues: [] }, cliff: '', t0: performance.now(), busy: false, pending: null, setB: resume ? P.run.setB : null, cast: resume ? P.run.cast : [] , pikeLantern: false };
  if (resume) { RUN.earned = P.run.earned || RUN.earned; }
  $('menuBtn').classList.remove('hidden'); $('chap').classList.remove('hidden');
  $('chap').querySelector('b').textContent = `Chapter ${n}${RUN.replay ? ' · replay' : ''}`; $('chap').querySelector('span').textContent = ch.title;
  $('tapzone').classList.remove('hidden');
  if (n === 3 && !pikeL) makeActor('pike_l', CAST.pike, { items: { hand: 'w07' } }).then(a => { pikeL = a; A.pike_l = a; a.o.visible = false; scene.add(a.o); }).catch(() => {});
  if (resume && RUN.setB) { // put the scene back the way it was
    doSet(RUN.setB, true).then(() => { for (const [id, mark] of RUN.cast) { const a = A[id]; if (a) place(a, mark); } next(); });
  } else next();
}
function saveRun() {
  if (!RUN || RUN.replay) return;
  P.run = { ch: RUN.n, i: Math.max(0, RUN.lastSay ?? RUN.i), flags: [...RUN.flags], rel: RUN.rel, setB: RUN.setB, cast: present().map(a => [a.id === 'pike_l' ? 'pike' : a.id, a.mark]), earned: RUN.earned };
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
      case 'enter': { const a = A[alias(b.id)] || A[b.id]; if (a) { if (!a.present) { a.yawNow = null; } place(a, b.mark, !a.present); } continue; }
      case 'exit': { const a = A[alias(b.id)] || A[b.id]; if (a) a.present = false; continue; }
      case 'goto': RUN.i = ch.labels[b.to]; if (RUN.pendingPhoto) { const id = RUN.pendingPhoto; RUN.pendingPhoto = null; RUN.busy = true; photoMoment(id).then(() => { RUN.busy = false; next(); }); return; } continue;
      case 'if': if (cond(b.cond)) RUN.i = ch.labels[b.to]; continue;
      case 'clue': gainClue(b.id); continue;
      case 'album': if (gainAlbum(b.id)) { RUN.busy = true; photoMoment(b.id).then(() => { RUN.busy = false; next(); }); return; } continue;
      case 'sfx': SND[b.id] && SND[b.id](); continue;
      case 'hold': RUN.pikeLantern = true; continue;
      case 'cliff': RUN.cliff = b.text; continue;
      case 'end': return endChapter();
      case 'light': RUN.busy = true; lightEvent().then(() => { RUN.busy = false; next(); }); return;
      case 'outfit': RUN.lastSay = RUN.i - 1; showOutfit(b.id); return;
      case 'choice': RUN.lastSay = RUN.i - 1; showChoice(b); return;
      case 'say': RUN.lastSay = RUN.i - 1; say(b); saveRun(); return;
    }
  }
}
function progress() { if (!RUN) return; $('chap').querySelector('u').style.width = Math.round(RUN.i / RUN.ch.beats.length * 100) + '%'; }

// scene change: fade to night-blue, swap the set, location card, fade back
async function doSet(b, quick = false) {
  hideBubble(); const R0 = RUN;
  $('fade').style.opacity = 1; await sleep(quick ? 50 : 450);
  if (RUN !== R0 || R0.stale) return;
  useSet(b.set, b.v);
  const sc = !quick && sceneOf(b), est = $('est');
  if (sc) { const src = `./assets/art/scene-${sc}.webp`; await Promise.race([artLoad(src), sleep(700)]); est.style.backgroundImage = `url(${src})`; est.classList.add('on'); }
  const [where, when] = (b.cap || '').split('·').map(s => s.trim());
  $('loc').querySelector('small').textContent = when || ''; $('loc').querySelector('h2').textContent = where || '';
  // look ahead: stage everyone who enters before the first line, so the scene opens already set up
  let j = RUN.i; const ch = RUN.ch;
  while (ch.beats[j] && (ch.beats[j].k === 'enter' || ch.beats[j].k === 'exit')) { const e = ch.beats[j]; const a = A[alias(e.id)] || A[e.id]; if (a) { if (e.k === 'enter') { a.yawNow = null; place(a, e.mark); } else a.present = false; } j++; }
  RUN.i = j;
  const nb = ch.beats[j]; setCam(nb && nb.k === 'say' && nb.id ? shotFor(nb) : { ...set.est, off: [0, -40] }, true);
  if (!quick) { $('loc').classList.add('on'); SND.swoosh(); await sleep(BOT() ? 500 : 1500); }
  $('fade').style.opacity = 0; est.classList.remove('on'); await sleep(quick ? 50 : 350); $('loc').classList.remove('on');
}
// the lighthouse flashes three times
async function lightEvent() {
  hideBubble();
  if (set.name !== 'harbor') return;
  setCam(set.lightView, false, 1.6); SND.light(); buzz([30, 200, 30, 200, 30]);
  await sleep(900);
  for (let i = 0; i < 3; i++) {
    for (let f = 0; f <= 1; f += 0.1) { set.setLight(f); await sleep(28); }
    $('flash').style.opacity = 0.35; setTimeout(() => $('flash').style.opacity = 0, 140);
    await sleep(520);
    for (let f = 1; f >= 0.25; f -= 0.1) { set.setLight(f); await sleep(30); }
    await sleep(160);
  }
  set.setLight(set.vname === 'launch' ? 1 : 0.35);
}
function gainClue(id) {
  if (!CLUES[id]) return;
  if (!P.clues.includes(id)) { P.clues.push(id); saveP(); }
  if (!RUN.earned.clues.includes(id)) RUN.earned.clues.push(id);
  RUN.flags.add(id);
  chip(`<span style="font-size:20px">${CLUES[id].icon}</span><span>Clue: ${esc(CLUES[id].title)}</span>`, 'gold'); SND.clue();
}
function gainAlbum(id) {
  if (!ALBUM[id]) return;
  const fresh = !P.album.includes(id);
  if (fresh) { P.album.push(id); saveP(); }
  if (!RUN.earned.album.includes(id)) RUN.earned.album.push(id);
  return fresh || !photo(id);
}
// the camera frames everyone in the scene, a shutter click, and the polaroid drops into the album
async function photoMoment(id) {
  hideBubble(); await sleep(60);
  const pr = present(), who = A[ALBUM[id].who];
  const list = who && who.present ? pr.filter(a => a === who || a === me) : pr;
  setCam(list.length >= 2 ? shotGroup(list) : list.length ? shotSingle(list[0], null) : { ...set.est, off: [0, 0] }, true);
  for (const a of list) if (a.id !== 'me' || list.length === 1) setEmo(a, 'happy');
  await sleep(BOT() ? 250 : 450); shotReq = id; await sleep(BOT() ? 600 : 1500);
}

// ------------------------------------------------------------------------------------------------- lines
let typeT = 0;
function say(b) {
  progress();
  const isN = !b.id, a = b.id ? A[alias(b.id)] : null, think = b.think;
  line = { b, text: nm(b.text), shown: 0, done: false, t: 0 };
  // camera: cut on a new speaker, ease within the same one
  const prevId = say.prev; say.prev = b.id || '_n';
  const s = shotFor(b); setCam(s, false, prevId === say.prev ? 2.2 : 5.5);
  if (a) { setEmo(a, b.emo || ''); if (!think) a.talkT = Math.min(4, line.text.length * 0.035); }
  for (const o of present()) if (o !== a && b.emo === 'shock' && o.id !== 'me' && Math.random() < 0.3) setEmo(o, 'shock');
  const el = $('bubble');
  el.className = isN ? 'narr' : think ? 'think' : '';
  const tag = el.querySelector('.tag');
  if (!isN) { const c = CAST[b.id] || CAST.me; tag.textContent = nm(c.name) + (think ? ' · thinking' : ''); tag.style.background = c.color; }
  const pt = !isN && ptOf(alias(b.id) in ART.pt ? alias(b.id) : b.id), pi = el.querySelector('.pt');
  el.classList.toggle('has-pt', !!pt); if (pt) { if (pi.getAttribute('src') !== pt) pi.src = pt; pi.style.borderColor = (CAST[b.id] || CAST.me).color; }
  typeOut(0);
  el.classList.remove('off');
  requestAnimationFrame(() => setCam(shotFor(b), false, prevId === say.prev ? 2.2 : 5.5));
  if (P.auto) line.autoAt = null;
}
function tickLine(dt) {
  if (!line || line.done) return;
  line.t += dt; const cps = 52;
  const n = Math.min(line.text.length, Math.floor(line.t * cps));
  if (n !== line.shown) { line.shown = n; typeOut(n); }
  if (n >= line.text.length) finishLine();
  // tail toward the speaker
  if (line.b.id) { const a = A[alias(line.b.id)]; if (a) { const p = headOf(a).project(cam); const x = (p.x * 0.5 + 0.5) * W, el = $('bubble'), r = el.getBoundingClientRect(); const lx = clamp(x - r.left - 11, 26, r.width - 48); el.querySelector('.tail').style.left = lx + 'px'; el.style.setProperty('--tx', lx + 'px'); } }
}
function typeOut(n) { const p = $('bubble').querySelector('p'); p.innerHTML = esc(line.text.slice(0, n)) + '<span style="opacity:0">' + esc(line.text.slice(n)) + '</span>'; }
function finishLine() { if (!line) return; line.done = true; line.shown = line.text.length; $('bubble').querySelector('p').textContent = line.text; $('bubble').classList.add('done'); line.doneAt = performance.now(); }
function hideBubble() { $('bubble').classList.add('off'); $('bubble').classList.remove('done'); }
function advance() {
  if (!RUN || RUN.busy || !line) return;
  if (!line.done) { finishLine(); return; }
  SND.next(); $('bubble').classList.remove('done');
  const a = line.b.id ? A[alias(line.b.id)] : null; if (a) a.talkT = 0;
  line = null; next();
}
$('tapzone').addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); if (phase === 'play' && RUN) advance(); });

// ------------------------------------------------------------------------------------------------- choices
function showChoice(b) {
  hideBubble(); progress();
  const box = $('choices'); box.innerHTML = '';
  const opts = b.opts.filter(o => !(o.once && RUN.flags.has(o.to)));
  // camera on the player while they decide
  if (me.present) setCam(shotSingle(me, nearest(me, present().filter(x => x !== me))), false, 3);
  if (b.prompt) { const p = document.createElement('p'); p.className = 'prompt'; p.textContent = nm(b.prompt); box.appendChild(p); }
  opts.forEach((o, i) => {
    const paid = o.cost && P.paid.includes(RUN.n + ':' + o.to);
    const btn = document.createElement('button'); btn.className = 'opt' + (o.cost ? ' prem' : ''); btn.style.animationDelay = (i * 0.07) + 's';
    btn.innerHTML = `${o.cost ? '<span class="gem">✦ PREMIUM SCENE</span>' : ''}<span>${esc(nm(o.text))}</span>${o.cost ? (paid ? '<span class="cost paid">✓ Owned</span>' : `<span class="cost"><i></i>${o.cost}</span>`) : ''}`;
    ['pointerdown', 'pointerup'].forEach(ev => btn.addEventListener(ev, e => e.stopPropagation()));
    btn.addEventListener('click', e => { e.stopPropagation(); pick(o); });
    box.appendChild(btn);
  });
  box.classList.remove('hidden'); SND.choice();
  RUN.choice = { b, opts };
}
function pick(o) {
  if (!RUN || !RUN.choice) return;
  unlock();
  if (o.cost) {
    const key = RUN.n + ':' + o.to;
    if (!P.paid.includes(key)) {
      if (!M.spend(o.cost, 'premium-choice')) { chip(`<span>Not enough coins for this scene</span>`); setTimeout(() => M.shop(), 350); return; }
      P.paid.push(key); saveP(); SND.coin();
    }
  }
  SND.pick(); buzz(12);
  $('choices').classList.add('hidden'); RUN.choice = null;
  RUN.flags.add(o.to); for (const f of o.fx.flags) RUN.flags.add(f);
  for (const [id, n] of Object.entries(o.fx.rel)) { RUN.rel[id] = (RUN.rel[id] || 0) + n; RUN.earned.rel[id] = (RUN.earned.rel[id] || 0) + n; if (n) setTimeout(() => relChip(id, n), 250); }
  const big = Object.entries(o.fx.rel).find(([id, n]) => n >= 2 && CAST[id]);
  if (big) setTimeout(() => chip(`${esc(CAST[big[0]].name)} will remember that.`, 'note'), 900);
  for (const id of o.fx.album) if (gainAlbum(id)) RUN.pendingPhoto = id;
  for (const id of o.fx.clue) gainClue(id);
  RUN.i = RUN.ch.labels[o.to];
  saveRun();
  next();
}

// ------------------------------------------------------------------------------------------------- outfits (with the hero bar)
let outfitSel = null;
const SW = { own: 'linear-gradient(135deg,#2e86ab,#f6efe6)', knit: 'linear-gradient(135deg,#7a8fa6,#c9d3dc)', lantern: 'linear-gradient(135deg,#ffcf5a,#f08a2c)', masq: 'linear-gradient(135deg,#4b2a6e,#b04a8a)', starlit: 'linear-gradient(135deg,#ff9fb2,#ffe08f)' };
const ICO = { own: '👟', knit: '🧶', lantern: '✨', masq: '🎭', starlit: '🏮' };
function showOutfit(id) {
  hideBubble();
  const O = OUTFITS[id], box = $('outfit');
  outfitSel = P.outfit || 'own';
  for (const a of present()) if (a !== me) a.present = false;
  setCam(frame(me.o.position.clone().add(V3(0, me.cfg.h * 0.5, 0)), me.cfg.h * 1.12, 1.4, V3(0.2, 0.1, 1), 32, { x0: 0, x1: W, y0: 60, y1: H - (W > H ? 300 : 330) }), false, 3);
  const render = () => {
    const h = selectedHero();
    box.innerHTML = `<div class="head">${esc(O.prompt)}<br><b>Pick your look</b> — or play as one of your Hero Lab heroes.</div>
      <div class="row">${O.looks.map(l => { const owned = !l.cost || P.paid.includes('look:' + l.id); const sw = `hsl(${Math.round(((l.hue + 0.6) % 1) * 360)},${Math.round(45 + l.sat * 25)}%,${Math.round(52 * l.bri)}%)`;
        return `<button class="look ${outfitSel === l.id ? 'on' : ''}" data-l="${l.id}">${l.cost && !owned ? `<span class="c">🪙 ${l.cost}</span>` : ''}<span class="sw" style="display:grid;place-items:center;font-size:26px;background:radial-gradient(circle at 35% 30%,#fff8,transparent 45%),${SW[l.id] || sw}">${ICO[l.id] || ''}</span><b>${esc(l.name)}</b><small>${esc(l.note)}</small></button>`; }).join('')}</div>
      <div id="obar"></div>
      <button class="play ok" id="oOk">Wear this ✓</button>`;
    heroBar({ parent: box.querySelector('#obar'), title: 'Play as your hero', noneLabel: 'Story look', noneIcon: '👗', onPick: () => buildMe().then(() => { me.present = true; setFade(me, 1); place(me, me.mark || 'L'); }) });
    for (const b of box.querySelectorAll('.look')) { ['pointerdown', 'pointerup'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation())); b.addEventListener('click', e => { e.stopPropagation(); tryLook(b.dataset.l, render); }); }
    const ok = box.querySelector('#oOk'); ['pointerdown', 'pointerup'].forEach(ev => ok.addEventListener(ev, e => e.stopPropagation()));
    ok.addEventListener('click', e => { e.stopPropagation(); confirmOutfit(); });
  };
  render(); box.classList.remove('hidden'); RUN.outfit = { render };
  for (const b of box.querySelectorAll('.agph-bar,.agph-row,button')) ['pointerdown', 'pointerup'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation()));
}
async function tryLook(id, render) {
  SND.tap(); outfitSel = id; const prev = P.outfit; P.outfit = id;
  await buildMe(); me.present = true; setFade(me, 1); place(me, me.mark || 'L'); setEmo(me, 'happy');
  P.outfit = prev; render();
}
function confirmOutfit() {
  const l = lookById(outfitSel);
  if (l.cost && !P.paid.includes('look:' + l.id)) {
    if (!M.spend(l.cost, 'outfit')) { chip('<span>Not enough coins for this look</span>'); setTimeout(() => M.shop(), 350); return; }
    P.paid.push('look:' + l.id); SND.coin();
  }
  P.outfit = l.id; saveP(); SND.pick(); confetti(scene, headOf(me), 30);
  RUN.flags.add(selectedHero() ? 'look_hero' : 'look_' + l.id);
  $('outfit').classList.add('hidden'); RUN.outfit = null;
  // the others come back
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
  if (first) { B.submit(1, { ms: performance.now() - r.t0 }); M.level(Object.keys(P.done).length + Object.keys(P.ds.log).length); }
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
  c.innerHTML = `<div class="k">CHAPTER ${r.n} COMPLETE</div><h2>${esc(r.ch.title)}</h2>
    ${r.cliff ? `<div class="cl"><small>TO BE CONTINUED…</small>${esc(nm(r.cliff))}</div>` : ''}
    ${rels.length ? `<div class="rels">${rels.map(([id, n]) => `<span class="rel"><img alt="" src="${thumb(id)}">${esc(CAST[id].name)} <span style="color:#ff5f86">${n > 0 ? '+' + n + ' ❤' : n}</span></span>`).join('')}</div>` : ''}
    ${r.earned.album.length ? `<div class="pols">${r.earned.album.map((k, i) => `<div class="pol" style="--r:${i % 2 ? 3 : -3}deg">${photo(k) ? `<img alt="" src="${photo(k)}">` : '<div class="blank">📷</div>'}<b>${esc(ALBUM[k].title)}</b></div>`).join('')}</div>` : ''}
    <div class="coins"><i></i>+${e.coins * (e.doubled ? 2 : 1)} coins</div>
    ${!e.doubled && e.coins >= 30 ? '<button class="dbl" id="dblB">▶ Double them · watch a short video</button>' : ''}
    ${nxt ? `<div class="cl" style="font-size:15px"><small>NEXT · CHAPTER ${nxt.n}${nxt.soon ? ' · COMING SOON' : ''}</small>${nxt.icon} ${esc(nxt.title)}</div>` : ''}
    <div class="tap">Tap to continue</div>`;
  const d = c.querySelector('#dblB');
  if (d) { ['pointerdown', 'pointerup'].forEach(ev => d.addEventListener(ev, ev2 => ev2.stopPropagation())); d.addEventListener('click', async ev => { ev.stopPropagation(); const ok = await M.rewarded('double', { what: `+${e.coins} more coins` }); if (ok) { M.add(e.coins, 'double'); e.doubled = true; SND.coin(); renderEnd(); } }); }
  let sw = w.querySelector('.sharewrap'); if (!sw) { sw = document.createElement('div'); sw.className = 'sharewrap'; w.appendChild(sw); const kb = w.querySelector('.hc-btn'); if (kb) sw.appendChild(kb); }
}
async function afterWin() {
  if (CASE) { CASE = null; showLobby(false); return; }
  ended = null;
  await M.breakAd('level-end');
  showLobby(false);
}

// ------------------------------------------------------------------------------------------------- sheets
function openSheet(kind, opt = {}) {
  const sh = $('sheet'), inn = sh.querySelector('.in');
  const close = () => { sh.classList.add('hidden'); inn.innerHTML = ''; };
  const head = t => `<div class="sh-h"><h3>${t}</h3><button class="sh-x" data-x>✕</button></div>`;
  if (kind === 'chapters') {
    inn.innerHTML = head('Book One · ' + esc(BOOK.title)) + `<div class="sh-b"><p class="note">Every chapter is about 10–15 minutes. Your choices carry forward. Replays never change your saved story.</p>${BOOK.chapters.map(c => {
      const done = P.done[c.n], cur = !c.soon && !done && c.n === P.next;
      return `<div class="chrow ${c.soon ? 'soon' : ''}">${ART.ch[c.n] ? `<div class="num art" style="background-image:url(./assets/art/scene-${ART.ch[c.n]}-s.webp)"><i>${c.icon}</i></div>` : `<div class="num">${c.icon}</div>`}<div style="flex:1"><small>Chapter ${c.n} · ${esc(c.place)}</small><h4>${esc(c.title)}</h4><p>${esc(c.teaser)}</p>${done ? `<button class="rp" data-rp="${c.n}">↺ Replay with different choices</button>` : cur ? `<button class="rp" data-go="${c.n}">▶ Read now</button>` : ''}</div>
        <span class="st ${cur ? 'cur' : c.soon || c.n > P.next ? 'lock' : ''}">${done ? '✓ Read' : cur ? 'Up next' : c.soon ? 'Soon' : '🗝️'}</span></div>`; }).join('')}</div>`;
  } else if (kind === 'album') {
    P.seen = P.album.length; saveP();
    const tab = opt.tab || 'moments';
    const people = ['kai', 'theo', 'wren', 'juno', 'vesper'];
    let body = '';
    if (tab === 'moments') body = people.map(id => { const c = CAST[id], keys = Object.keys(ALBUM).filter(k => ALBUM[k].who === id), n = P.rel[id] || 0, hs = Math.max(0, Math.min(5, Math.round(n / 1.4)));
      const lvl = n >= 7 ? 'Smitten' : n >= 4 ? 'Close' : n >= 2 ? 'Friendly' : n > 0 ? 'Acquainted' : 'Stranger';
      return `<div class="person" style="--c:${c.color}"><div class="ph"><img alt="" src="${thumb(id)}"><div><h4>${esc(c.name)}</h4><small>${esc(c.role)}</small><div class="hearts">${'❤'.repeat(hs)}<i>${'❤'.repeat(5 - hs)}</i> <small>${lvl}</small></div></div></div>
        <div class="pols">${keys.map((k, i) => { const have = P.album.includes(k), ph = have && photo(k); return `<div class="pol" style="--r:${i % 2 ? 2 : -2}deg">${ph ? `<img alt="" src="${ph}">` : `<div class="blank">${have ? '📷' : ALBUM[k].premium ? '✦' : '?'}</div>`}<b>${have ? esc(ALBUM[k].title) : ALBUM[k].premium ? 'Premium moment' : '???'}</b></div>`; }).join('')}</div></div>`; }).join('');
    else if (tab === 'clues') body = `<div class="stamps">${Object.entries(CLUES).map(([k, c]) => { const have = P.clues.includes(k); return `<div class="stamp ${have ? '' : 'off'}"><div class="i">${c.icon}</div><b>${have ? esc(c.title) : '???'}</b>${have ? `<p>${esc(c.text)}</p>` : ''}</div>`; }).join('')}</div>`;
    else { const today = dayNum(), start = today - ((new Date().getDay() + 6) % 7); body = `<p class="note">One stamp for every Case of the Day you solve. Streak: <b>🔥 ${P.ds.n || 0}</b>. One free streak freeze a week.</p>`;
      for (let w = 0; w < 4; w++) { body += `<div class="week">${Array.from({ length: 7 }, (_, i) => { const d = start - (3 - w) * 7 + i, g = P.ds.log[d]; return `<div class="${g ? 'ok' : ''} ${d === today ? 'today' : ''}">${g ? '🏮' : d > today ? '' : '·'}</div>`; }).join('')}</div>`; } }
    const nMom = P.album.length, nAll = Object.keys(ALBUM).length;
    inn.innerHTML = head(`Album <small style="font:800 14px var(--sans);color:#9a7bd6">${nMom}/${nAll} moments · ${P.clues.length}/${Object.keys(CLUES).length} clues</small>`) +
      `<div class="tabs"><button data-t="moments" class="${tab === 'moments' ? 'on' : ''}">📸 Moments</button><button data-t="clues" class="${tab === 'clues' ? 'on' : ''}">🕵️ Case notes</button><button data-t="daily" class="${tab === 'daily' ? 'on' : ''}">🏮 Daily stamps</button></div><div class="sh-b">${body}</div>`;
    hud(); renderLobbyBadges();
  } else if (kind === 'menu') {
    inn.innerHTML = head('Paused') + `<div class="sh-b">
      <button class="mbtn" data-m="resume">▶ Keep reading</button>
      <button class="mbtn ${P.auto ? 'on' : ''}" data-m="auto">⏩ Auto-advance: ${P.auto ? 'on' : 'off'}</button>
      <button class="mbtn" data-m="album">📸 Album & case notes</button>
      <button class="mbtn" data-m="sound">${P.mute ? '🔇 Sound: off' : '🔊 Sound: on'}</button>
      <button class="mbtn" data-m="leave">🏠 Back to the harbour <small style="opacity:.6">(your place is saved)</small></button></div>`;
  } else if (kind === 'you') {
    inn.innerHTML = head('You') + `<div class="sh-b"><p class="note">Your name in the story:</p><input class="name" id="nmI" maxlength="14" value="${esc(P.name)}"><p class="note">Play the story as one of your Hero Lab heroes — or the story's own look.</p><div id="youBar"></div><button class="play" data-x style="margin-top:12px">Done</button></div>`;
    heroBar({ parent: inn.querySelector('#youBar'), title: 'Play the story as', noneLabel: 'Story look', noneIcon: '👗', onPick: () => buildMe().then(() => { if (phase === 'title') showLobby(false); }) });
    const inp = inn.querySelector('#nmI'); ['pointerdown', 'pointerup', 'keydown'].forEach(ev => inp.addEventListener(ev, e => e.stopPropagation()));
    inp.addEventListener('input', () => { P.name = inp.value.replace(/[<>{}]/g, '').trim().slice(0, 14) || 'Nora'; saveP(); });
  } else if (kind === 'keys') {
    const L = M.lives(), s = L.nextAt ? Math.max(0, Math.ceil((L.nextAt - Date.now()) / 1000)) : 0;
    inn.innerHTML = head('Keys') + `<div class="sh-b keygate"><div class="big">🗝️</div><h4>${L.n} of ${L.max} keys</h4><p>Each new chapter takes one key. Replays are always free.${L.n < L.max ? ` Next key in <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b>.` : ''}</p>
      ${L.n < L.max ? '<button class="play free" data-m="refill">▶ Refill keys · watch a short video</button>' : ''}<button class="ghost" data-x style="width:100%;margin-top:10px">${L.n ? 'Close' : 'I\'ll wait'}</button></div>`;
  }
  sh.classList.remove('hidden');
  ['pointerdown', 'pointerup'].forEach(ev => sh.addEventListener(ev, e => e.stopPropagation(), { once: false }));
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
    if (a === 'leave') { close(); saveRun(); RUN = null; line = null; CASE = null; showLobby(false); }
    if (a === 'refill') { const ok = await M.rewarded('lives', { title: 'Refill keys', what: 'All 5 keys, right now' }); close(); hud(); if (ok && opt.then) opt.then(); else if (phase === 'title') renderLobby(); }
  };
}
function renderLobbyBadges() { if (phase === 'title') renderLobby(); }

// ------------------------------------------------------------------------------------------------- Case of the Day (?daily=1)
const SUS = ['kai', 'theo', 'pike', 'vesper', 'wren'];
const ATTR = { place: ['⚓ the pier', '📚 the bookshop', '⛵ the boatyard'], drink: ['☕ tea', '🍫 cocoa', '🥛 milky coffee'], carry: ['☂️ an umbrella', '🧺 a basket', '📰 a newspaper'] };
const ITEMS = ['the last lemon tart', 'Wren\'s lucky teaspoon', 'the festival bell', 'the Admiral\'s velvet collar', 'a whole tray of lighthouse biscuits', 'the jar of sea glass', 'the vicar\'s sequinned scarf', 'the harbour cat\'s favourite cushion'];
function makeCase(seed) {
  for (let tries = 0; tries < 40; tries++) {
    const r = rng(seed * 31 + tries * 7919 + 1);
    const pool = SUS.slice(); const sus = []; while (sus.length < 5) sus.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const who = sus.map(id => ({ id, place: Math.floor(r() * 3), drink: Math.floor(r() * 3), carry: Math.floor(r() * 3) }));
    const culprit = Math.floor(r() * 5), cu = who[culprit];
    const facts = [];
    for (const k of ['place', 'drink', 'carry']) { facts.push({ k, eq: true, v: cu[k] }); for (let v = 0; v < 3; v++) if (v !== cu[k]) facts.push({ k, eq: false, v }); }
    // shuffle, then pick facts greedily until only the culprit fits (three or four clues)
    for (let i = facts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [facts[i], facts[j]] = [facts[j], facts[i]]; }
    let cand = who.map((_, i) => i); const clues = [];
    for (const f of facts) { const nc = cand.filter(i => (who[i][f.k] === f.v) === f.eq); if (nc.length < cand.length && nc.includes(culprit)) { clues.push(f); cand = nc; } if (cand.length === 1) break; }
    if (cand.length === 1 && clues.length >= 3 && clues.length <= 4) return { who, culprit, clues, item: ITEMS[Math.floor(r() * ITEMS.length)], seed };
  }
  return null;
}
const clueText = f => { const v = ATTR[f.k][f.v].replace(/^\S+\s/, ''); return f.k === 'place' ? `The culprit was ${f.eq ? '' : 'NOT '}seen at ${v} this morning.` : f.k === 'drink' ? `The culprit ${f.eq ? 'was' : 'was NOT'} drinking ${v}.` : `The culprit ${f.eq ? 'was' : 'was NOT'} carrying ${v}.`; };
async function startCase() {
  ui.hideStart(); phase = 'play'; document.body.classList.add('playing');
  CASE = makeCase(D.seed || dayNum()); if (!CASE) { showLobby(false); return; }
  CASE.tries = 0; CASE.wrong = []; CASE.t0 = performance.now(); CASE.hinted = []; CASE.step = 0;
  $('menuBtn').classList.remove('hidden'); $('chap').classList.remove('hidden');
  $('chap').querySelector('b').textContent = 'Case of the Day'; $('chap').querySelector('span').textContent = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' }); $('chap').querySelector('u').style.width = '0%';
  RUN = null;
  const fake = { set: 'tearoom', v: 'morning', cap: 'The Gull & Kettle · Case of the Day' };
  hideBubble(); $('fade').style.opacity = 1; await sleep(400); useSet('tearoom', 'morning'); place(A.juno, 'R'); place(me, 'L'); setFade(A.juno, 1); setFade(me, 1);
  $('loc').querySelector('small').textContent = 'Case of the Day'; $('loc').querySelector('h2').textContent = 'The Gull & Kettle'; $('loc').classList.add('on');
  setCam(shotSingle(A.juno, me), true); await sleep(BOT() ? 400 : 1300); $('fade').style.opacity = 0; await sleep(300); $('loc').classList.remove('on');
  CASE.lines = [
    { id: 'juno', emo: 'shock', text: `Case of the Day! Somebody has pinched ${CASE.item} from the Gull and Kettle.` },
    { id: 'juno', emo: 'think', text: 'Five suspects. I\'ve been asking around. Here\'s what the town saw this morning:' },
    ...CASE.clues.map(f => ({ id: 'juno', emo: '', text: clueText(f) })),
    { id: 'juno', emo: 'happy', text: 'You get two guesses. Don\'t accuse the vicar. Again.' },
  ];
  $('tapzone').classList.remove('hidden'); caseLine();
}
function caseLine() {
  const l = CASE.lines[CASE.step]; if (!l) { $('tapzone').classList.add('hidden'); return showBoard(); }
  line = { b: { id: l.id, emo: l.emo, text: l.text }, text: l.text, shown: 0, done: false, t: 0, isCase: true };
  setEmo(A.juno, l.emo); A.juno.talkT = l.text.length * 0.035;
  const el = $('bubble'); el.className = ''; const tag = el.querySelector('.tag'); tag.textContent = 'Juno'; tag.style.background = CAST.juno.color; typeOut(0); el.classList.remove('off');
  setCam(shotSingle(A.juno, me), false, 3);
}
$('tapzone').addEventListener('pointerdown', () => { if (CASE && line && line.isCase) { if (!line.done) finishLine(); else { CASE.step++; line = null; caseLine(); } } });
function showBoard() {
  hideBubble(); const box = $('case');
  setCam(frame(V3(0, 1.3, 0.7), 1.3, 3.2, V3(0, 0.1, 1), 34, { x0: 0, x1: W, y0: 60, y1: H - 380 }), false, 2.5);
  const render = () => {
    box.innerHTML = `<div class="clues"><b>CLUES · ${esc(CASE.item.toUpperCase())}</b><ul style="margin:0;padding:0">${CASE.clues.map(f => `<li>${esc(clueText(f))}</li>`).join('')}</ul></div>
      <div class="sus">${CASE.who.map((s, i) => `<button class="su ${CASE.wrong.includes(i) || CASE.hinted.includes(i) ? 'x' : ''}" data-i="${i}" style="--c:${CAST[s.id].color}"><img alt="" src="${thumb(s.id)}"><b>${esc(CAST[s.id].name.replace('Aunt ', '').replace('Mr ', ''))}</b><span>${ATTR.place[s.place].split(' ')[0]}${ATTR.drink[s.drink].split(' ')[0]}${ATTR.carry[s.carry].split(' ')[0]}</span></button>`).join('')}</div>
      <div class="crow"><button class="ghost" id="hintB">💡 Rule one out (video)</button><button class="ghost" id="keyB">❔ Icons</button></div>
      <p style="margin:6px 0 0;text-align:center;font:800 12.5px var(--sans);color:#fff;text-shadow:0 1px 4px #000">${2 - CASE.tries} guess${2 - CASE.tries === 1 ? '' : 'es'} left · tap a suspect to accuse</p>`;
    for (const b of box.querySelectorAll('button')) ['pointerdown', 'pointerup'].forEach(ev => b.addEventListener(ev, e => e.stopPropagation()));
    for (const b of box.querySelectorAll('.su')) b.addEventListener('click', e => { e.stopPropagation(); accuse(+b.dataset.i, render); });
    box.querySelector('#hintB').addEventListener('click', async e => { e.stopPropagation(); const ok = await M.rewarded('hint', { what: 'One innocent suspect crossed off' }); if (ok) { const inn = CASE.who.map((_, i) => i).filter(i => i !== CASE.culprit && !CASE.wrong.includes(i) && !CASE.hinted.includes(i)); if (inn.length) CASE.hinted.push(inn[0]); render(); } });
    box.querySelector('#keyB').addEventListener('click', e => { e.stopPropagation(); chip('⚓📚⛵ where · ☕🍫🥛 drink · ☂️🧺📰 carrying'); });
  };
  render(); box.classList.remove('hidden'); CASE.render = render;
}
function accuse(i, render) {
  if (!CASE || CASE.over || CASE.wrong.includes(i) || CASE.hinted.includes(i)) return;
  CASE.tries++; const s = CASE.who[i], a = A[s.id];
  if (i === CASE.culprit) {
    CASE.over = true; CASE.marks = (CASE.marks || '') + '🟩'; SND.win(); confetti(scene, headOf(A.juno), 60); setEmo(A.juno, 'cheer'); setEmo(me, 'cheer');
    s.ok = true; render(); setTimeout(() => solved(true), 1300);
  } else {
    CASE.wrong.push(i); CASE.marks = (CASE.marks || '') + '🟥'; SND.wrong(); buzz([20, 40, 20]); setEmo(A.juno, 'shock');
    chip(`<img alt="" src="${thumb(s.id)}"><span>${esc(CAST[s.id].name)} has an alibi!</span>`);
    if (CASE.tries >= 2) { CASE.over = true; render(); setTimeout(() => solved(false), 1100); } else render();
  }
}
function solved(ok) {
  $('case').classList.add('hidden');
  const today = dayNum(), c = CASE;
  if (ok && !P.ds.log[today]) {
    const wk = Math.floor((today + 3) / 7);
    if (P.ds.last === today - 1) P.ds.n++;
    else if (P.ds.last === today - 2 && P.ds.freeze !== wk) { P.ds.n++; P.ds.freeze = wk; setTimeout(() => chip('❄️ Streak freeze used — your streak is safe', 'note'), 600); }
    else P.ds.n = 1;
    P.ds.last = today; P.ds.log[today] = c.tries; saveP();
    M.add(15, 'daily-case'); B.submit(1, { ms: performance.now() - c.t0 }); M.level(Object.keys(P.done).length + Object.keys(P.ds.log).length);
  }
  phase = ok ? 'won' : 'lost'; $('menuBtn').classList.add('hidden');
  const grid = `Lantern Bay · Case of the Day ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}\n🔎${c.marks}${ok ? ` · solved in ${c.tries}` : ' · unsolved'}${P.ds.n > 1 && ok ? ` · 🔥${P.ds.n}` : ''}`;
  const cu = c.who[c.culprit];
  if (ok) {
    D.won(c.tries, 'solved today\'s case in');
    const w = ui.els.win; let el = w.querySelector('.endc'); if (!el) { el = document.createElement('div'); el.className = 'endc'; w.prepend(el); }
    el.innerHTML = `<div class="k">CASE CLOSED</div><h2>It was ${esc(CAST[cu.id].name)}!</h2><div class="grid">🔎${c.marks}</div>
      <div class="cl"><small>STREAK</small>🔥 ${P.ds.n} day${P.ds.n === 1 ? '' : 's'} · one free streak freeze a week</div>
      <div class="coins"><i></i>+15 coins</div><button class="dbl" id="shareG">Share my grid (no spoilers)</button><div class="tap">Tap to continue</div>`;
    const sg = el.querySelector('#shareG'); ['pointerdown', 'pointerup'].forEach(ev => sg.addEventListener(ev, e => e.stopPropagation()));
    sg.addEventListener('click', async e => { e.stopPropagation(); const u = new URL(location.href); u.search = '?daily=1'; try { if (navigator.share) { await navigator.share({ text: grid, url: u.href }); return; } } catch (er) { return; } try { await navigator.clipboard.writeText(grid + '\n' + u.href); chip('Copied — paste it anywhere'); } catch (er) {} });
    let sw = w.querySelector('.sharewrap'); if (sw) sw.innerHTML = '';
    ui.win(1, '');
  } else {
    ui.lose('Case unsolved', `It was ${CAST[cu.id].name}. Tomorrow's case is a new one.`);
    const l = ui.els.lose; let el = l.querySelector('.endc'); if (!el) { el = document.createElement('div'); el.className = 'endc'; l.prepend(el); }
    el.innerHTML = `<div class="k">CASE UNSOLVED</div><h2>It was ${esc(CAST[cu.id].name)}.</h2><div class="cl">${c.clues.map(f => esc(clueText(f))).join('<br>')}</div><div class="tap">Tap to go back to the harbour</div>`;
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
    if (phase === 'title') { camG.pos.x = camS.pos.x; }
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
  get actors() { return Object.values(A).filter(a => a.present).map(a => ({ id: a.id, yaw: +a.o.rotation.y.toFixed(2), x: +a.o.position.x.toFixed(2), z: +a.o.position.z.toFixed(2), vis: a.o.visible, al: +a.alpha.toFixed(2) })); },
  get debug() { return { me: me && { yaw: me.o.rotation.y, pos: me.o.position.toArray(), present: me.present, alpha: me.alpha }, cam: cam.position.toArray(), look: camS.look.toArray(), phase, run: RUN && { n: RUN.n, i: RUN.i, busy: RUN.busy, flags: [...RUN.flags], rel: RUN.rel }, line: line && line.text, P }; },
  jump(n, label) { const ch = CH.find(c => c.n === n); const at = typeof label === 'number' ? label : typeof label === 'string' && label.startsWith('@') ? ch.beats.findIndex(b => b.k === 'set' && b.set + ' ' + b.v === label.slice(1)) : ch.labels[label]; if (RUN) RUN.stale = true; RUN = null; startChapter(n, { replay: true }); if (at >= 0 && RUN) { const old = RUN; RUN = { ...old }; old.stale = true; RUN.busy = false; RUN.i = at; line = null; next(); } },
  bot() {
    if (phase === 'title') { if ($('sheet').classList.contains('hidden')) startFromLobby(); return; }
    if (phase !== 'play') return;
    if (!$('sheet').classList.contains('hidden')) { const r = $('sheet').querySelector('[data-m="refill"]') || $('sheet').querySelector('[data-x]'); r && r.click(); return; }
    if (CASE) {
      if (line && line.isCase) { if (!line.done) finishLine(); else { CASE.step++; line = null; caseLine(); } return; }
      if (!$('case').classList.contains('hidden') && !CASE.over) {
        // reason like a player: keep suspects that fit every clue; one time in five, misread a clue
        const fit = CASE.who.map((s, i) => i).filter(i => !CASE.wrong.includes(i) && !CASE.hinted.includes(i) && CASE.clues.every(f => (CASE.who[i][f.k] === f.v) === f.eq));
        const any = CASE.who.map((s, i) => i).filter(i => !CASE.wrong.includes(i) && !CASE.hinted.includes(i));
        const pickI = Math.random() < 0.2 && CASE.tries === 0 ? any[Math.floor(Math.random() * any.length)] : fit[0] ?? any[0];
        accuse(pickI, CASE.render);
      }
      return;
    }
    if (!RUN || RUN.busy) return;
    if (RUN.outfit) { if (botWait++ % 3 === 0) { const ls = OUTFITS.festival.looks.filter(l => !l.cost || M.coins() > 200); const l = ls[Math.floor(Math.random() * ls.length)]; outfitSel = l.id; confirmOutfit(); } return; }
    if (RUN.choice) {
      const opts = RUN.choice.opts, prem = opts.filter(o => o.cost && M.coins() >= o.cost + 60), free = opts.filter(o => !o.cost);
      const o = prem.length && Math.random() < 0.35 ? prem[0] : free[Math.floor(Math.random() * free.length)] || opts[0];
      pick(o); return;
    }
    if (line) { if (!line.done) finishLine(); advance(); }
  },
};

onHeroesChange(() => { if (phase === 'title') buildMe().then(() => showLobby(false)); });
boot().catch(e => { console.error(e); const l = $('load'); if (l) l.querySelector('small').textContent = 'Could not load — please refresh'; });

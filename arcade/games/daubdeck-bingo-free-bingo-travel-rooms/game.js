// Daubdeck Bingo — original 75-ball bingo with a Hero Lab caller (Mr Mustard), a glossy 3D ball machine, 1–4 cards,
// power-ups charged by daubing, bingo shapes, a travel map of 8 themed rooms (AI 3D dioramas) and a stamp album.
// Free coins only, fair draws (crypto RNG), odds shown in the Fair play panel. Art: AI 3D library + Hero Lab; the rest is code.
import { THREE, createUI, store, loop, buzz } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { money } from './kit/money.js';
import { piece, loadHost } from './assets.js';
import { buildMachine, bigBall } from './machine.js';
import { ROOMS, ROUNDS_PER_ROOM, STAMP_NAMES, CALLS, LETTER, ballColor, SHAPES, levelDef, DAILY, POWERS, POWER_DAUBS, MAX_BINGOS, CARD_COST, PAY } from './data.js';
import { fairRng, seededRng, makeCard, makeBag, readyMasks, closeness, pickPower, oddsTable } from './bingo.js';
import { snd } from './audio.js';

addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason?.stack || e.reason)));
const NAME = 'Daubdeck Bingo: Free Bingo Travel Rooms', PI = Math.PI, V3 = THREE.Vector3;
const $ = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeO = t => 1 - Math.pow(1 - t, 3), easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60e3) / 864e5);
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const fmt = n => n >= 1e5 ? Math.round(n / 1e3) + 'k' : n.toLocaleString('en-US');

// ---------------------------------------------------------------- saved state
const S = store('daubdeck');
const st = { level: S.get('level', 1), stars: S.get('stars', {}), album: S.get('album', {}), sel: S.get('sel', -1), cards: S.get('cards', 2),
  welcomed: S.get('welcomed', 0), ds: S.get('ds', { last: 0, n: 0, fw: -1 }), gift: S.get('gift', 0), bingos: S.get('bingos', 0), wins: S.get('wins', 0), rooms: S.get('rooms', 1) };
const save = () => { for (const k of Object.keys(st)) S.set(k, st[k]); };
const F = flow('daubdeck');
const M = money({ game: 'daubdeck', style: 'A' });
const totalStars = () => Object.values(st.stars).reduce((a, b) => a + b, 0);
const progRoom = () => st.level > ROOMS.length * ROUNDS_PER_ROOM ? (Math.floor((st.level - 1) / ROUNDS_PER_ROOM) % ROOMS.length) : Math.floor((st.level - 1) / ROUNDS_PER_ROOM);
const unlocked = r => st.level > ROOMS.length * ROUNDS_PER_ROOM || r <= progRoom();
const roomStamps = r => ROOMS[r].stamps.filter(id => st.album[id] > 0).length;
const albumCount = () => ROOMS.reduce((a, _, r) => a + roomStamps(r), 0);
if (st.sel < 0 || !unlocked(st.sel)) st.sel = progRoom();

// ---------------------------------------------------------------- renderer + post
const LITE = Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 200); scene.add(cam);
const C = cine(R, scene, cam, { bloom: 0.26, bloomThreshold: 0.9, bloomRadius: 0.45, exposure: 0.92, envIntensity: 0.6, lite: LITE, grade: { sat: 1.15, contrast: 1.04, vignette: 0.1, grain: 0 } });
const bgCanvas = document.createElement('canvas'); bgCanvas.width = 128; bgCanvas.height = 256;
const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
const hemi = new THREE.HemisphereLight('#fff4e6', '#f0c8dc', 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe9c8', 2.6); sun.position.set(-6, 9, 2); sun.target.position.set(0, -1, -12); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; scene.add(sun, sun.target);
const rimL = new THREE.DirectionalLight('#ffd0e8', 1.1); rimL.position.set(6, 3, -14); scene.add(rimL);
const spot = new THREE.PointLight('#ffcf8a', 0, 14, 1.4); scene.add(spot);

// px on screen + depth → world point (the camera sits at the origin looking down −Z)
const vh = d => 2 * d * Math.tan(cam.fov * PI / 360);
const W = (px, py, d) => new V3((px / innerWidth - 0.5) * vh(d) * cam.aspect, (0.5 - py / innerHeight) * vh(d), -d);
const pxW = (px, d) => px / innerHeight * vh(d);
const toScreen = v => { const p = v.clone().project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };

function paintBg(room) {
  const [a, b] = ROOMS[room].sky, x = bgCanvas.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  let s = room * 97 + 13; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 22; i++) { const cx = r() * 128, cy = r() * 200, rad = 3 + r() * 16, rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad); rg.addColorStop(0, `rgba(255,${220 + r() * 35 | 0},${200 + r() * 55 | 0},${0.2 + r() * 0.3})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
  const v = x.createRadialGradient(64, 110, 20, 64, 128, 170); v.addColorStop(0, 'rgba(255,255,255,.28)'); v.addColorStop(1, 'rgba(120,50,100,.10)'); x.fillStyle = v; x.fillRect(0, 0, 128, 256);
  bgTex.needsUpdate = true; haze.material.color.set(b);
  const rs = document.documentElement.style, Rm = ROOMS[room];
  rs.setProperty('--c1', Rm.card); rs.setProperty('--c2', Rm.card2); rs.setProperty('--dab', Rm.dab); rs.setProperty('--glow', Rm.glow);
  document.querySelector('meta[name=theme-color]').content = a;
}

// ---------------------------------------------------------------- world particles (instanced)
const WP = (() => {
  const N = 700, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); m.count = 0; m.frustumCulled = false; m.renderOrder = 10; scene.add(m);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
  return {
    burst(pos, colors, n = 20, { speed = 3, up = 3, size = 1, life = 1, grav = 5, spread = 0 } = {}) {
      for (let i = 0; i < n && list.length < N; i++) { const a = Math.random() * PI * 2, b = Math.random() * PI, sp = speed * (0.4 + Math.random() * 0.8);
        list.push({ p: new V3(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.5, pos.z + (Math.random() - 0.5) * spread * 0.3), v: new V3(Math.cos(a) * Math.sin(b) * sp, up * (0.5 + Math.random()), Math.sin(a) * Math.sin(b) * sp * 0.4), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.v.multiplyScalar(1 - dt * 0.6); p.p.addScaledVector(p.v, dt); p.r += dt * 6; const f = p.life / p.max;
        e.set(p.r, p.r * 0.6, 0); q.setFromEuler(e); s.set(p.size * 1.3, p.size * 0.5, p.size).multiplyScalar(0.3 + Math.min(1, f * 2) * 0.9); tmp.compose(p.p, q, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); i++; }
      m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    },
  };
})();
const CONF = ['#ff5d8f', '#ffd23f', '#3fcf6e', '#3aa8ff', '#b05cff', '#ffffff', '#ff8a2a'];
const confettiAt = (px, py, n = 70) => WP.burst(W(px, py, 6), CONF, n, { speed: 2.6, up: 2.2, size: 0.55, life: 2.2, grav: 2.2, spread: 0.6 });

// ---------------------------------------------------------------- 3D objects
const mach = buildMachine(); scene.add(mach.group); mach.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
const shadowBlob = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(90,30,60,.45)'); g.addColorStop(1, 'rgba(90,30,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
{ const b = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: shadowBlob, transparent: true, depthWrite: false })); b.rotation.x = -PI / 2; b.position.y = -0.11; mach.group.add(b); }
const ball = bigBall(); ball.visible = false; scene.add(ball);
const stageMat = new THREE.MeshPhysicalMaterial({ color: '#c93a64', roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#ff9ab8'), sheenRoughness: 0.4 });
const dios = {};            // room → Group (diorama on a velvet showcase stage)
async function dioOf(r) {
  if (!dios[r]) dios[r] = piece(ROOMS[r].d).then(p => {
    const g = new THREE.Group(), m = new THREE.Mesh(p.geo, p.mat); m.castShadow = m.receiveShadow = true; m.position.y = 0.04; g.add(m);
    const st1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.08, 64), stageMat); st1.position.y = 0; st1.receiveShadow = true; g.add(st1);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.018, 8, 64), (async () => 0, mach.group.children[0].material)); lip.rotation.x = PI / 2; lip.position.y = 0.04; g.add(lip);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: shadowBlob, transparent: true, depthWrite: false })); blob.rotation.x = -PI / 2; blob.position.y = -0.045; g.add(blob);
    g.userData.size = p.size; g.visible = false; scene.add(g); return g;
  });
  return dios[r];
}
let host = null, dio = null, dioRoom = -1;
const haze = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fff1df', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
haze.position.z = -24; haze.renderOrder = 1; scene.add(haze);

// layout targets (lerped every frame)
const T = { mach: { p: new V3(0, -2, -10), s: 0.5, ry: -0.35, vis: true }, host: { p: new V3(-2, -2, -9), s: 1, ry: 0.4 }, dio: { p: new V3(0, 0, -14), s: 4, ry: 0 } };
const cur = { mach: { p: new V3(0, -2, -10), s: 0.5, ry: -0.35 }, host: { p: new V3(-2, -2, -9), s: 1, ry: 0.4 }, dio: { p: new V3(0, 0, -14), s: 4, ry: 0 } };

// ---------------------------------------------------------------- UI + kit layers
const ui = createUI({ title: 'Daubdeck<small>BINGO</small>', hint: 'Tap to play', hand: '', progress: false, score: false });
ui.els.start.classList.add('dd-title');
{ const f = document.createElement('div'); f.className = 'forfun'; f.textContent = 'Free coins · fair draws · just for fun'; ui.els.start.querySelector('h1').after(f); }
const D = daily('daubdeck', ui, { name: NAME });
const B = worldBoard({ game: 'daubdeck', label: 'Bingos', limits: { maxRun: 14, maxPerSec: 0.8 }, mode: 'sum', corner: 'tl', accent: '#ffb21f' });
ui.els.win.classList.add('dd-rescard'); ui.els.lose.classList.add('dd-rescard');
const loadEl = document.getElementById('dd-load'), loadBar = loadEl.querySelector('.bar b');

const hud = $(`<div class="dd">
  <div id="dd-top">
    <div class="dd-pill" id="dd-coins"><span class="dd-coin"></span><span data-n>0</span><span class="plus">+</span></div>
    <div class="dd-pill dd-hidden" id="dd-stars"><span class="dd-starI">⭐</span><span data-n>0</span></div>
    <div id="dd-roomchip" class="dd-hidden"><b></b><small></small></div>
    <div class="dd-spacer"></div>
    <button class="dd-btn dd-white dd-ic" id="dd-voice" aria-label="Caller voice">🗣️</button>
    <button class="dd-btn dd-white dd-ic" id="dd-mute" aria-label="Sound">🔊</button>
    <button class="dd-btn dd-white dd-ic dd-hidden" id="dd-home" aria-label="Leave round">🏠</button>
  </div>
  <div id="dd-strip" class="dd-hidden"><div class="dd-balls"><small>BALLS</small><b>0</b></div><div class="dd-rail"></div><div class="dd-pat"><div class="dd-mini"></div><small></small></div></div>
  <div id="dd-cards" class="dd-hidden"></div>
  <div id="dd-bot" class="dd-hidden">
    <button class="dd-btn" id="dd-power" aria-label="Power-up"><i>✨</i><small>0/${POWER_DAUBS}</small></button>
    <button class="dd-btn dd-goldb off" id="dd-bingo">BINGO!</button>
    <button class="dd-btn dd-white" id="dd-fast" aria-label="Call faster">⏩</button>
  </div>
  <div id="dd-lobby" class="dd-hidden">
    <div class="dd-panel">
      <div class="dd-map"></div>
      <div class="dd-roomnav"><button class="dd-btn dd-white" data-prev aria-label="Previous room">‹</button><div class="dd-rt"><small></small><b></b></div><button class="dd-btn dd-white" data-next aria-label="Next room">›</button></div>
      <div class="dd-rounds"></div>
      <div class="dd-cardsel"><span>Cards</span></div>
      <button class="dd-btn dd-green dd-play"></button>
    </div>
    <div class="dd-row">
      <button class="dd-btn dd-white dd-tile" data-album><span class="e">📮</span>Album<span class="n dd-hidden"></span></button>
      <button class="dd-btn dd-white dd-tile" data-daily><span class="e">☀️</span>Daily<span class="n dd-hidden"></span></button>
      <button class="dd-btn dd-white dd-tile" data-shop><span class="e">🛍️</span>Shop</button>
      <button class="dd-btn dd-white dd-tile" data-fair><span class="e">⚖️</span>Fair play</button>
    </div>
    <div class="dd-forfun" data-fair2>For fun only · coins have no cash value · fair draws</div>
  </div>
  <div id="dd-big">BINGO!</div>
</div>`);
document.body.appendChild(hud);
const q = s => hud.querySelector(s);
const el = { top: q('#dd-top'), coins: q('#dd-coins'), coinsN: q('#dd-coins [data-n]'), stars: q('#dd-stars'), starsN: q('#dd-stars [data-n]'), chip: q('#dd-roomchip'),
  mute: q('#dd-mute'), voice: q('#dd-voice'), home: q('#dd-home'), strip: q('#dd-strip'), ballsN: q('.dd-balls b'), ballsBox: q('.dd-balls'), rail: q('.dd-rail'), pat: q('.dd-pat'),
  cards: q('#dd-cards'), bot: q('#dd-bot'), power: q('#dd-power'), bingo: q('#dd-bingo'), fast: q('#dd-fast'), lobby: q('#dd-lobby'), rounds: q('.dd-rounds'), cardsel: q('.dd-cardsel'),
  play: q('.dd-play'), rt: q('.dd-rt'), big: q('#dd-big') };
el.mute.textContent = snd.muted ? '🔇' : '🔊'; el.voice.style.opacity = snd.voice ? 1 : 0.45;
el.mute.onclick = () => { el.mute.textContent = snd.toggle() ? '🔇' : '🔊'; };
el.voice.onclick = () => { const on = snd.toggleVoice(); el.voice.style.opacity = on ? 1 : 0.45; toast('🗣️', on ? 'Caller voice on' : 'Caller voice off', on ? 'Mr Mustard reads the balls out loud' : 'Balls are shown, not spoken'); };
el.coins.onclick = () => { snd.tap(); M.shop(); };
let shownCoins = M.coins();
M.onChange(s => { if (s.coins > shownCoins) bump(el.coins); shownCoins = s.coins; el.coinsN.textContent = fmt(s.coins); refreshCardSel(); });
el.coinsN.textContent = fmt(shownCoins);
function bump(e) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }

// ---------------------------------------------------------------- toasts, bubble, flights
let toastEl = null;
function toast(icon, title, sub = '') {
  toastEl?.remove(); const img = /^[a-z]\d\d$/.test(icon);
  toastEl = $(`<div class="dd-toast">${img ? `<img src="./assets/stamps/${icon}.webp" alt="">` : `<span class="ico">${icon}</span>`}<div>${title}${sub ? `<small>${sub}</small>` : ''}</div></div>`);
  document.body.appendChild(toastEl); const t = toastEl; setTimeout(() => t.remove(), 2700);
}
let bubbleEl = null, bubbleT = 0;
function say(text, small = '', ms = 1600) { if (!host) return; bubbleEl?.remove(); bubbleEl = $(`<div class="dd-bubble">${text}${small ? `<small>${small}</small>` : ''}</div>`); document.body.appendChild(bubbleEl); bubbleT = ms / 1000; placeBubble(); }
const headV = new V3();
function placeBubble() {
  if (!bubbleEl || !host) return;
  host.g.getWorldPosition(headV); headV.y += host.h * host.g.scale.y * 1.02;
  const p = toScreen(headV); bubbleEl.style.left = clamp(p.x + 46, 80, innerWidth - 90) + 'px'; bubbleEl.style.top = Math.max(64, p.y + 6) + 'px';
}
function flyTo(fromEl, toEl, html, n = 6, cb) {
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const f = $(`<div class="dd-fly">${html}</div>`); document.body.appendChild(f);
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 30, y0 = a.top + a.height / 2 + (Math.random() - 0.5) * 20, x1 = b.left + 20, y1 = b.top + b.height / 2;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 120, my = Math.min(y0, y1) - 80 - Math.random() * 60;
    f.animate([{ transform: `translate(${x0}px,${y0}px) scale(.4)` }, { transform: `translate(${mx}px,${my}px) scale(1.2)`, offset: 0.45 }, { transform: `translate(${x1}px,${y1}px) scale(.7)` }],
      { duration: 650 + i * 70, easing: 'cubic-bezier(.4,0,.6,1)', delay: i * 45 }).onfinish = () => { f.remove(); if (i === n - 1) { cb && cb(); bump(toEl); } else snd.coin(i); };
    f.style.transform = `translate(${x0}px,${y0}px) scale(0)`; f.style.left = '0'; f.style.top = '0';
  }
}
const COIN_HTML = '<span class="dd-coin" style="width:26px;height:26px;display:block"></span>';
function sparks(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) { const s = $('<div class="dd-spark"></div>'); s.style.background = Array.isArray(color) ? color[i % color.length] : color; s.style.left = x + 'px'; s.style.top = y + 'px'; document.body.appendChild(s);
    const a = Math.random() * PI * 2, d = 18 + Math.random() * 34; s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.2)`, opacity: 0 }], { duration: 420 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove(); }
}
function bigText(t, color = null) { el.big.textContent = t; el.big.classList.remove('go'); void el.big.offsetWidth; el.big.classList.add('go'); }

// ---------------------------------------------------------------- modes + layout
let mode = 'title', state = 'ready', Rd = null, loaded = false, busy = false, dailyMode = !!D.seed, encore = false, pendingUnlock = null;
function setMode(m) {
  mode = m;
  const play = m === 'play';
  el.strip.classList.toggle('dd-hidden', !play); el.cards.classList.toggle('dd-hidden', !play); el.bot.classList.toggle('dd-hidden', !play);
  el.home.classList.toggle('dd-hidden', !play); el.chip.classList.toggle('dd-hidden', !play); el.stars.classList.toggle('dd-hidden', play || m === 'title');
  el.lobby.classList.toggle('dd-hidden', m !== 'lobby'); el.voice.classList.toggle('dd-hidden', play);
  layout();
}
function layout() {
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  R.setSize(innerWidth, innerHeight); C.resize(innerWidth, innerHeight);
  const Wd = innerWidth, H = innerHeight, wide = Wd / H > 1, top = 60;
  if (mode === 'play') {
    const n = Rd ? Rd.cards.length : 2, cols = n === 1 ? 1 : 2, rows = Math.ceil(n / cols);
    const botTop = H - 10 - 70 - 10;
    let areaL, areaR, stripTop;
    if (!wide) { areaL = 8; areaR = Wd - 8; }
    else { areaL = Wd * 0.42 + 10; areaR = Wd - 14; }
    const aw = areaR - areaL;
    let cs = (aw - (cols - 1) * 8) / cols; cs = (cs - 28) / 5;
    const maxH = wide ? botTop - (top + 70) : botTop - 250;
    cs = Math.floor(Math.min(cs, ((maxH - (rows - 1) * 10) / rows - 33) / 5.62, n === 1 ? 66 : 60));
    const cardH = 5.62 * cs + 33, totalH = rows * cardH + (rows - 1) * 10;
    let cardsTop = wide ? Math.max(top + 74, (top + 70 + botTop - totalH) / 2) : botTop - totalH - 4;
    stripTop = wide ? top + 2 : cardsTop - 70;
    Object.assign(el.cards.style, { left: areaL + 'px', width: aw + 'px', top: cardsTop + 'px', height: totalH + 'px', gridTemplateColumns: `repeat(${cols}, auto)`, rowGap: '10px', columnGap: '8px' });
    el.cards.querySelectorAll('.dd-card').forEach(c => c.style.setProperty('--cs', cs + 'px'));
    el.strip.style.top = stripTop + 'px';
    if (!wide) {
      const z0 = top - 6, z1 = stripTop - 2, zh = z1 - z0;
      const mh = Math.min(zh * 0.9, 300), hh = Math.min(zh * 0.98, 320);
      T.mach.p.copy(W(Wd * 0.62, z1 - 6, 10)); T.mach.s = pxW(mh, 10) / 3.15; T.mach.ry = -0.32;
      T.host.p.copy(W(Wd * 0.17, z1 + 26, 9)); T.host.s = pxW(hh, 9) / (host ? host.h : 1); T.host.ry = 0.5;
      T.dio.p.copy(W(Wd * 0.5, z1 + 10, 30)); T.dio.s = pxW(Math.min(Wd * 1.1, zh * 1.5), 30); T.dio.ry = 0.5;
    } else {
      const zx = Wd * 0.42;
      T.mach.p.copy(W(zx * 0.6, H * 0.8, 10)); T.mach.s = pxW(H * 0.56, 10) / 3.15; T.mach.ry = -0.3;
      T.host.p.copy(W(zx * 0.2, H * 0.99, 9)); T.host.s = pxW(H * 0.66, 9) / (host ? host.h : 1); T.host.ry = 0.55;
      T.dio.p.copy(W(zx * 0.5, H * 0.72, 30)); T.dio.s = pxW(H * 0.95, 30); T.dio.ry = 0.5;
    }
  } else {
    const panelTop = el.lobby.classList.contains('dd-hidden') ? H * 0.58 : (wide ? H : el.lobby.getBoundingClientRect().top || H * 0.55);
    if (!wide) {
      const z0 = top + 10, z1 = (mode === 'title' ? H * 0.78 : panelTop) - 8, zh = z1 - z0, cx = Wd * 0.5;
      const dw = Math.min(Wd * 0.86, zh * 1.02);
      T.dio.p.copy(W(cx, z0 + zh * 0.5 + dw * 0.42, 12)); T.dio.s = pxW(dw, 12); T.dio.ry = 0.62;
      T.host.p.copy(W(Wd * 0.13, z1 + 12, 8.5)); T.host.s = pxW(zh * 0.56, 8.5) / (host ? host.h : 1); T.host.ry = 0.55;
      T.mach.p.copy(W(Wd * 0.83, z1 + 2, 10)); T.mach.s = pxW(zh * 0.33, 10) / 3.15; T.mach.ry = -0.7;
      if (mode === 'title') {
        T.mach.p.copy(W(Wd * 0.6, H * 0.74, 10)); T.mach.s = pxW(H * 0.38, 10) / 3.15; T.mach.ry = -0.4;
        T.host.p.copy(W(Wd * 0.18, H * 0.8, 8.5)); T.host.s = pxW(H * 0.42, 8.5) / (host ? host.h : 1); T.host.ry = 0.55;
        T.dio.p.copy(W(Wd * 0.5, H * 0.74, 30)); T.dio.s = pxW(Wd * 1.2, 30); T.dio.ry = 0.5;
      }
    } else {
      const zr = mode === 'title' ? Wd : Wd - 400 - Wd * 0.04 - 20, cx = zr * 0.5, dh = H * 0.52;
      T.dio.p.copy(W(cx, H * 0.5 + dh * 0.4, 12)); T.dio.s = pxW(dh, 12); T.dio.ry = 0.62;
      T.host.p.copy(W(cx - dh * 0.78, H * 0.93, 8.5)); T.host.s = pxW(H * 0.46, 8.5) / (host ? host.h : 1); T.host.ry = 0.65;
      T.mach.p.copy(W(cx + dh * 0.72, H * 0.9, 10)); T.mach.s = pxW(H * 0.3, 10) / 3.15; T.mach.ry = -0.6;
      if (mode === 'title') { T.mach.p.copy(W(Wd * 0.56, H * 0.8, 10)); T.mach.s = pxW(H * 0.42, 10) / 3.15; T.host.p.copy(W(Wd * 0.38, H * 0.95, 8.5)); T.dio.p.copy(W(Wd * 0.5, H * 0.85, 30)); T.dio.s = pxW(H * 0.85, 30); }
    }
  }
}
addEventListener('resize', () => { layout(); });

// ---------------------------------------------------------------- lobby
const cardCost = (n, def) => Math.max(0, n - ((def && def.n && def.n <= 5) || (def && def.daily) ? 2 : 1)) * CARD_COST;
function lobbyDef() {
  if (dailyMode) return DAILY(ymd());
  const d = levelDef(st.level); if (st.sel !== d.room) { encore = true; return { ...d, room: st.sel }; } encore = false; return d;
}
function refreshCardSel() {
  if (!loaded) return;
  const def = lobbyDef();
  el.cardsel.querySelectorAll('button').forEach(b => b.remove());
  for (let n = 1; n <= 4; n++) {
    const cost = cardCost(n, def), b = $(`<button class="dd-btn${st.cards === n ? ' sel' : ''}${cost > M.coins() ? ' poor' : ''}"><b>${'<i></i>'.repeat(n)}</b><small>${cost ? `<span class="dd-coin"></span>${cost}` : 'FREE'}</small></button>`);
    if (def.daily) { b.disabled = n !== 2; if (n !== 2) b.style.opacity = 0.3; }
    b.onclick = () => { if (def.daily) return; snd.tap(); if (cost > M.coins()) { toast('🪙', 'Not enough coins', 'Win bingos or visit the shop'); return; } st.cards = n; save(); refreshCardSel(); };
    el.cardsel.appendChild(b);
  }
}
function refreshLobby() {
  const def = lobbyDef(), r = def.room, Rm = ROOMS[r];
  paintBg(r); showDio(r);
  el.rt.querySelector('small').textContent = dailyMode ? `Daily bingo · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : `Room ${r + 1} of ${ROOMS.length}`;
  el.rt.querySelector('b').textContent = dailyMode ? 'Daily Bingo' : Rm.name;
  q('[data-prev]').disabled = dailyMode || st.sel <= 0; q('[data-next]').disabled = dailyMode || !unlocked(st.sel + 1) || st.sel >= ROOMS.length - 1;
  // travel map: one stop per room, the line fills as you travel
  const map = q('.dd-map'); map.innerHTML = ''; map.style.display = dailyMode ? 'none' : '';
  ROOMS.forEach((Ro, i) => { const b = $(`<button class="dd-btn dd-stop${unlocked(i) ? (i < progRoom() || st.level > ROOMS.length * ROUNDS_PER_ROOM ? ' done' : '') : ' lock'}${i === st.sel ? ' sel' : ''}" style="--rc:${Ro.card}" aria-label="${Ro.name}"><img src="./assets/stamps/${Ro.d}.webp" alt="">${i === progRoom() ? '<span class="pin">📍</span>' : ''}</button>`);
    b.onclick = () => { if (!unlocked(i)) { snd.nope(); toast(Ro.d, `${Ro.name} is locked`, `win the rounds before it to travel there`); return; } if (st.sel !== i) { st.sel = i; save(); snd.whoosh(); refreshLobby(); } };
    map.appendChild(b); });
  map.style.setProperty('--mp', `calc(${Math.min(1, progRoom() / (ROOMS.length - 1)) * 100}% - ${Math.min(1, progRoom() / (ROOMS.length - 1)) * 44}px)`);
  // rounds strip
  el.rounds.innerHTML = '';
  if (dailyMode) {
    el.rounds.innerHTML = `<div class="dd-round cur" style="width:auto;padding:0 12px;animation:none;white-space:nowrap">${def.shapes.map(s => SHAPES[s].name.split(' ').pop()).join(' or ')} · ${def.balls} balls</div><div class="dd-round ${st.ds.n ? 'done' : ''}" style="width:auto;padding:0 10px;white-space:nowrap" title="streak · weekly freeze">🔥${st.ds.n}${weekNum() !== st.ds.fw ? ' ❄️' : ''}</div>`;
  } else {
    const first = st.level > ROOMS.length * ROUNDS_PER_ROOM ? Math.floor((st.level - 1) / ROUNDS_PER_ROOM) * ROUNDS_PER_ROOM + 1 - (progRoom() - r) * ROUNDS_PER_ROOM : r * ROUNDS_PER_ROOM + 1;
    for (let i = 0; i < ROUNDS_PER_ROOM; i++) {
      const n = first + i, done = n < st.level, curr = n === st.level, s = st.stars[n] || 0, hard = levelDef(n).hard;
      el.rounds.appendChild($(`<div class="dd-round${done ? ' done' : ''}${curr ? ' cur' : ''}${hard ? ' hard' : ''}">${hard && !done ? '🔥' : n}${done ? `<small>${'★'.repeat(s)}${'☆'.repeat(3 - s)}</small>` : ''}</div>`));
    }
  }
  refreshCardSel();
  el.play.className = 'dd-btn dd-green dd-play' + (def.hard && !encore ? ' hard' : '');
  el.play.innerHTML = dailyMode ? `Play Daily<small>same balls for everyone today</small>` : encore ? `Encore<small>replay ${Rm.name} for stamps &amp; coins</small>` : `Play<small>Round ${def.round} of ${ROUNDS_PER_ROOM}${def.hard ? ' · HARD' : ''}</small>`;
  el.starsN.textContent = totalStars();
  const ac = q('[data-album] .n'), miss = albumCount(); ac.textContent = `${miss}/${ROOMS.length * 9}`; ac.classList.toggle('dd-hidden', false);
  const dn = q('[data-daily] .n'); dn.textContent = st.ds.last === dayNum() ? '✓' : st.ds.n ? `🔥${st.ds.n}` : 'NEW'; dn.classList.toggle('dd-hidden', false);
  q('[data-daily] .e').textContent = dailyMode ? '🗺️' : '☀️'; q('[data-daily]').lastChild.previousSibling.textContent = dailyMode ? 'Rooms' : 'Daily';
  requestAnimationFrame(layout);
}
const weekNum = (d = dayNum()) => Math.floor((d + 3) / 7);
q('[data-prev]').onclick = () => { if (st.sel > 0) { st.sel--; save(); snd.whoosh(); refreshLobby(); } };
q('[data-next]').onclick = () => { if (unlocked(st.sel + 1) && st.sel < ROOMS.length - 1) { st.sel++; save(); snd.whoosh(); refreshLobby(); } };
el.play.onclick = () => { snd.tap(); startRound(); };
q('[data-album]').onclick = () => { snd.tap(); openAlbum(dailyMode ? progRoom() : st.sel); };
q('[data-daily]').onclick = () => { snd.tap(); dailyMode = !dailyMode; refreshLobby(); };
q('[data-shop]').onclick = () => { snd.tap(); M.shop(); };
q('[data-fair]').onclick = q('[data-fair2]').onclick = () => { snd.tap(); openFair(); };
el.pat.onclick = () => openFair();

async function showDio(r) {
  if (dioRoom === r && dio) return; dioRoom = r;
  const g = await dioOf(r); if (dioRoom !== r) return;
  if (dio && dio !== g) dio.visible = false;
  dio = g; g.visible = true; cur.dio.s *= 0.6;
}

// ---------------------------------------------------------------- sheets (album, fair play, leave)
function sheet(html, onClose) {
  const w = $(`<div class="dd-sheetwrap dd"><div class="dd-sheet"><button class="dd-btn x" aria-label="Close">✕</button>${html}</div></div>`);
  document.body.appendChild(w);
  const close = () => { w.remove(); onClose && onClose(); };
  w.addEventListener('pointerdown', e => { if (e.target === w) close(); });
  w.querySelector('.x').onclick = () => { snd.tap(); close(); };
  return { w, close };
}
function openAlbum(r, fresh = []) {
  const sh = sheet(`<h2>Stamp Album</h2><div class="sub">${albumCount()} of ${ROOMS.length * 9} stamps · complete a room for ${PAY.album} coins</div><div class="dd-tabs"></div><div class="body"></div>`);
  const tabs = sh.w.querySelector('.dd-tabs'), body = sh.w.querySelector('.body');
  const show = r => {
    tabs.innerHTML = ''; ROOMS.forEach((Rm, i) => { const b = $(`<button class="dd-btn${i === r ? ' sel' : ''}${unlocked(i) ? '' : ' lock'}" style="--c1:${Rm.card}"><img src="./assets/stamps/${Rm.d}.webp" alt="">${roomStamps(i)}/9</button>`); b.onclick = () => { snd.tap(); show(i); }; tabs.appendChild(b); });
    const Rm = ROOMS[r], have = roomStamps(r);
    body.innerHTML = `<div style="display:flex;justify-content:space-between;font-weight:800;margin:4px 6px 0"><span style="color:${Rm.card}">${Rm.name}</span><span>${have}/9${have === 9 ? ' 🏆' : ''}</span></div><div class="dd-aprog"><i style="width:${have / 9 * 100}%"></i></div><div class="dd-album" style="--c1:${Rm.card};--c2:${Rm.card2}"></div>
      <p class="fine" style="text-align:center">Stamps come from stamp squares on your cards, Stamp Gift power-ups and your first bingo each round. Doubles turn into ${PAY.dupe} coins.</p>`;
    const grid = body.querySelector('.dd-album');
    for (const id of Rm.stamps) { const n = st.album[id] || 0; grid.appendChild($(`<div class="dd-stamp${n ? '' : ' miss'}${fresh.includes(id) ? ' new' : ''}"><div class="in"><img src="./assets/stamps/${id}.webp" alt="">${n > 1 ? `<span class="ct">×${n}</span>` : ''}<span class="nm">${n ? STAMP_NAMES[id] : '?'}</span></div></div>`)); }
  };
  show(r);
}
function openFair() {
  const def = mode === 'play' && Rd ? Rd.def : lobbyDef(), balls = mode === 'play' && Rd ? Rd.budget : roundBalls(def);
  const odds = oddsTable(def.shapes, Math.min(75, balls), 900);
  const tot = POWERS.reduce((a, p) => a + p.w, 0);
  sheet(`<h2>Fair play</h2><div class="sub">Daubdeck is a game, played just for fun</div>
    <p><b>No real money, ever.</b> Coins are free play tokens. They can't be cashed out, sent to anyone, or won as prizes. You can buy extra coins in the shop, but nothing you buy changes how the balls fall.</p>
    <p><b>Every ball is fair.</b> Each round shuffles all 75 balls with your browser's cryptographic random generator. Cards, power-ups and prize squares come from the same generator. The odds never change with your coins, purchases, or how you've been doing. The daily round uses one shared seed, so everyone gets the same balls.</p>
    <p style="margin-top:10px"><b>This round:</b> ${def.shapes.map(s => SHAPES[s].name).join(' or ')}, ${balls} balls. Chance of at least one bingo <i>before</i> power-ups:</p>
    <table>${odds.map((p, i) => `<tr><td>${i + 1} card${i ? 's' : ''}</td><td>${Math.round(p * 100)}%</td></tr>`).join('')}</table>
    <p class="fine">Simulated from these exact rules just now. Power-ups and Pick a Square push every number up. Extra cards cost ${CARD_COST} coins each (the first card is free, the first two in rounds 1–5 and the daily).</p>
    <p style="margin-top:10px"><b>Power-ups</b> charge after ${POWER_DAUBS} daubs. Each one is drawn from this table:</p>
    <table>${POWERS.map(p => `<tr><td>${p.icon} ${p.name} <span class="fine">· ${p.line}</span></td><td>${Math.round(p.w / tot * 100)}%</td></tr>`).join('')}</table>
    <p class="fine">Each card also starts with 2 coin purses and 1 stamp square on random squares. Your first bingo of a round gives a random stamp from that room (each one equally likely).</p>`);
}

// ---------------------------------------------------------------- the round
function roundBalls(def) {
  if (def.daily || def.n <= 5) return def.balls;
  return clamp(Math.round(def.balls / F.k()), 30, 75);   // flow: a little fewer balls for players who keep winning, more for those who don't
}
function buildCardEl(ci, card) {
  const c = $(`<div class="dd-card"><div class="dd-head">${'BINGO'.split('').map(l => `<span>${l}</span>`).join('')}</div><div class="dd-grid"></div></div>`);
  const g = c.querySelector('.dd-grid');
  card.nums.forEach((n, i) => {
    const cell = $(`<div class="dd-cell${i === 12 ? ' free on' : ''}"><span class="dab"></span><b>${i === 12 ? '★' : n}</b></div>`);
    cell.addEventListener('pointerdown', e => { e.preventDefault(); tapCell(ci, i); });
    g.appendChild(cell);
  });
  card.el = c; card.cells = [...g.children];
  return c;
}
function placePrize(card, i, kind) {
  card.prizes[i] = kind;
  const cell = card.cells[i]; cell.querySelector('.pz')?.remove();
  const pz = $(`<span class="pz ${kind}"></span>`); if (kind === 'stamp') pz.style.backgroundImage = `url(./assets/stamps/${ROOMS[Rd.def.room].stamps[0]}.webp)`;
  cell.appendChild(pz);
}
function freeCells(card) { const a = []; for (let i = 0; i < 25; i++) if (!card.daub[i] && !card.prizes[i]) a.push(i); return a; }

async function startRound() {
  if (busy || mode !== 'lobby' || !loaded) return;
  const def = lobbyDef(), n = def.daily ? 2 : st.cards, cost = cardCost(n, def);
  let cards = n;
  if (cost > 0 && !M.spend(cost, 'cards')) { cards = 1; toast('🪙', 'Playing 1 free card', 'Not enough coins for more'); }
  busy = true; snd.unlock(); snd.music(true);
  const rng = def.daily ? seededRng(ymd() * 7 + 11) : fairRng();
  Rd = { def, rng, cards: [], bag: makeBag(rng), idx: 0, budget: roundBalls(def), called: new Set([0]), list: [], meter: 0, double: false, pick: false, bingos: 0, coins: 0, stamps: [],
    t0: performance.now(), next: 1.4, fast: false, over: false, ended: false, extra: false, firstBingoBall: 0, lastCallAt: 0, combo: 0, missT: {} };
  for (let i = 0; i < cards; i++) Rd.cards.push(makeCard(rng));
  el.cards.innerHTML = '';
  Rd.cards.forEach((c, i) => {
    el.cards.appendChild(buildCardEl(i, c));
    const fc = freeCells(c); shuffleIn(fc, rng);
    placePrize(c, fc[0], 'coin'); placePrize(c, fc[1], 'coin'); placePrize(c, fc[2], 'stamp');
  });
  el.rail.innerHTML = '';
  const Rm = ROOMS[def.room];
  el.chip.querySelector('b').textContent = def.daily ? 'Daily Bingo' : Rm.name;
  el.chip.querySelector('small').textContent = def.daily ? 'same balls for everyone' : encore ? 'Encore round' : `Round ${def.round}/${ROUNDS_PER_ROOM}${def.hard ? ' · HARD' : ''}`;
  const icon = new Set(def.shapes.flatMap(s => SHAPES[s].icon));
  el.pat.querySelector('.dd-mini').innerHTML = Array.from({ length: 25 }, (_, i) => `<i class="${icon.has(i) ? 'on' : ''}"></i>`).join('');
  el.pat.querySelector('small').textContent = def.shapes.length > 1 ? def.shapes.map(s => SHAPES[s].name.split(' ').pop()).join(' / ') : SHAPES[def.shapes[0]].name;
  el.fast.classList.remove('on'); el.bingo.className = 'dd-btn dd-goldb off'; el.bingo.innerHTML = 'BINGO!';
  updatePower(); updateBalls();
  setMode('play'); state = 'play'; busy = false;
  B.start();
  M.level(def.n || st.level);
  host?.play('jump', true);
  say(def.hard && !encore ? 'A tricky one, dear!' : ['Eyes down!', 'Dabbers ready?', 'Here we go!', 'Good luck, love!'][Math.floor(Math.random() * 4)], `${def.shapes.map(s => SHAPES[s].name).join(' or ')} · ${Rd.budget} balls`, 2400);
  snd.say('Eyes down!', 1);
}
function shuffleIn(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const interval = () => Rd.fast ? 0.55 : 1.8;
el.fast.onclick = () => { if (!Rd) return; Rd.fast = !Rd.fast; el.fast.classList.toggle('on', Rd.fast); snd.tap(); if (Rd.fast) Rd.next = Math.min(Rd.next, 0.4); };
el.home.onclick = () => {
  if (mode !== 'play' || !Rd || Rd.over) return; snd.tap();
  const sh = sheet(`<h2>Leave this round?</h2><div class="sub">You keep the coins and stamps you've won so far.</div><div class="act"><button class="dd-btn dd-white" data-stay>Keep playing</button><button class="dd-btn dd-pinkb" data-leave>Leave</button></div>`, () => { Rd && (Rd.paused = false); });
  Rd.paused = true;
  sh.w.querySelector('[data-stay]').onclick = () => sh.close();
  sh.w.querySelector('[data-leave]').onclick = () => { sh.close(); if (Rd) { Rd.budget = Rd.idx; Rd.left = true; finishRound(); } };
};

// ---- calling balls
const callAnim = { on: false, t: 0, dur: 1, n: 0, from: new V3(), mid: new V3(), to: new V3(), path: [] };
function updateBalls() {
  const left = Math.max(0, Rd.budget - Rd.idx); el.ballsN.textContent = left; el.ballsBox.classList.toggle('low', left <= 5 && left > 0);
}
function callBall() {
  const n = Rd.bag[Rd.idx++]; Rd.called.add(n); Rd.list.push(n); Rd.lastCallAt = performance.now();
  updateBalls();
  mach.spin(interval() * 0.9); snd.rumble(Math.min(0.9, interval() * 0.6)); setTimeout(() => snd.pop(), interval() * 230);
  // 3D: out of the chute, up to the front, then into the rail
  ball.setNumber(n); ball.visible = true;
  const g = mach.group; g.updateMatrixWorld(true);
  callAnim.path = [0, 0.33, 0.66, 1].map(t => mach.curve.getPoint(t).applyMatrix4(g.matrixWorld));
  const mp = callAnim.path[3], sp = toScreen(mp), wide = innerWidth / innerHeight > 1;
  const rr = el.rail.getBoundingClientRect();
  const revealPx = wide ? { x: sp.x + 30, y: sp.y - 90 } : { x: Math.min(innerWidth - 60, sp.x + 4), y: Math.max(110, sp.y - 70) };
  callAnim.mid.copy(W(revealPx.x, revealPx.y, 6)); callAnim.to.copy(W(rr.left + 28, rr.top + rr.height / 2, 6));
  callAnim.on = true; callAnim.t = 0; callAnim.dur = Math.max(0.5, interval() * 0.95); callAnim.n = n;
  callAnim.s0 = mach.group.scale.x * 0.17; callAnim.s1 = pxW(wide ? 96 : 80, 6) / 2; callAnim.s2 = pxW(44, 6) / 2;
  // caller
  const nick = !Rd.fast && CALLS[n] && Math.random() < 0.45 ? CALLS[n] : '';
  say(`${LETTER(n)} · ${n}`, nick, interval() * 1000 * 0.95);
  if (!Rd.fast) snd.say(nick ? `${nick}. ${n}` : `${LETTER(n)}, ${n}`, nick ? 1.05 : 0.95);
  if (Rd.idx === Rd.budget) setTimeout(() => { if (Rd && !Rd.over && Rd.idx === Rd.budget) say('Last ball!', 'daub what you can', 1800); }, 500);
}
function tickCall(dt) {
  if (!callAnim.on) return;
  callAnim.t += dt / callAnim.dur; const t = callAnim.t;
  if (t < 0.28) { const k = t / 0.28, P = callAnim.path, seg = Math.min(2, Math.floor(k * 3)), f = k * 3 - seg; ball.position.lerpVectors(P[seg], P[seg + 1], f); ball.scale.setScalar(callAnim.s0); ball.rotation.set(-k * 8, 0, 0); }
  else if (t < 0.5) { const k = easeBack((t - 0.28) / 0.22); ball.position.lerpVectors(callAnim.path[3], callAnim.mid, Math.min(1, k)); ball.scale.setScalar(callAnim.s0 + (callAnim.s1 - callAnim.s0) * k); ball.rotation.set(0, (1 - Math.min(1, k)) * 3, 0); }
  else if (t < 0.8) { ball.position.copy(callAnim.mid); ball.position.y += Math.sin((t - 0.5) * 20) * 0.01; ball.scale.setScalar(callAnim.s1); ball.rotation.set(0, Math.sin(t * 6) * 0.15, 0); }
  else if (t < 1) { const k = easeIO((t - 0.8) / 0.2); ball.position.lerpVectors(callAnim.mid, callAnim.to, k); ball.scale.setScalar(callAnim.s1 + (callAnim.s2 - callAnim.s1) * k); }
  else { callAnim.on = false; ball.visible = false; addRail(callAnim.n); }
}
function addRail(n) {
  const b = $(`<div class="dd-ball${LETTER(n) === 'N' ? ' N' : ''} big" style="--bc:${ballColor(n)}"><i><small>${LETTER(n)}</small>${n}</i></div>`);
  el.rail.querySelector('.big')?.classList.remove('big');
  el.rail.prepend(b); while (el.rail.children.length > 8) el.rail.lastChild.remove();
}

// ---- daubing
function tapCell(ci, i) {
  if (state !== 'play' || !Rd || Rd.over) return;
  const card = Rd.cards[ci]; if (card.daub[i]) return;
  if (Rd.pick) { Rd.pick = false; el.cards.querySelectorAll('.dd-card').forEach(c => c.classList.remove('pick')); document.getElementById('dd-banner')?.remove(); daub(ci, i, 'magic'); return; }
  if (!Rd.called.has(card.nums[i])) { const c = card.cells[i]; c.classList.remove('nope'); void c.offsetWidth; c.classList.add('nope'); snd.nope(); return; }
  daub(ci, i, 'call');
}
function daub(ci, i, how) {
  const card = Rd.cards[ci], cell = card.cells[i];
  card.daub[i] = true; cell.classList.add('on'); cell.classList.remove('miss'); if (how === 'magic') cell.classList.add('magic');
  const r = cell.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2, how === 'magic' ? CONF : [ROOMS[Rd.def.room].dab, '#fff', '#ffd23f'], 9);
  Rd.combo = performance.now() - (Rd.lastDaub || 0) < 900 ? Rd.combo + 1 : 0; Rd.lastDaub = performance.now();
  snd.daub(Rd.combo); buzz(8);
  if (how === 'call' && Rd.meter < POWER_DAUBS) { Rd.meter++; updatePower(); if (Rd.meter === POWER_DAUBS) { snd.ready(); } }
  const pz = card.prizes[i];
  if (pz) { delete card.prizes[i]; const p = cell.querySelector('.pz'); p && p.remove();
    if (pz === 'coin') { Rd.coins += PAY.purse; M.add(PAY.purse, 'purse'); flyTo(cell, el.coins, COIN_HTML, 4); }
    else giveStamp(cell); }
  checkReady();
}
function checkReady() {
  let any = false;
  Rd.cards.forEach(c => { const rm = readyMasks(c, Rd.def.shapes); c.ready = rm.length > 0; c.el.classList.toggle('ready', c.ready); if (c.ready) any = true;
    const cl = closeness(c, Rd.def.shapes); let bd = c.el.querySelector('.dd-badge');
    if (!c.ready && cl.need === 1 && c.bingos < MAX_BINGOS) { if (!bd) { bd = $('<div class="dd-badge">1 TO GO!</div>'); c.el.appendChild(bd); } } else bd?.remove(); });
  const was = el.bingo.classList.contains('on');
  el.bingo.classList.toggle('on', any); el.bingo.classList.toggle('off', !any);
  if (any && !was) { snd.ready(); Rd.readyAt = Rd.idx; }
}
function giveStamp(fromEl) {
  const Rm = ROOMS[Rd.def.room], id = Rm.stamps[Math.floor(Rd.rng() * Rm.stamps.length)], had = st.album[id] || 0;
  st.album[id] = had + 1; Rd.stamps.push(id); save(); snd.stamp();
  if (had) { M.add(PAY.dupe, 'stamp-dupe'); Rd.coins += PAY.dupe; toast(id, `${STAMP_NAMES[id]} ×${had + 1}`, `double stamp → +${PAY.dupe} coins`); if (fromEl) flyTo(fromEl, el.coins, COIN_HTML, 3); }
  else { const n = roomStamps(Rd.def.room); toast(id, `New stamp: ${STAMP_NAMES[id]}`, `${Rm.name} album ${n}/9`);
    if (n === 9) setTimeout(() => { M.add(PAY.album, 'album'); Rd && (Rd.coins += PAY.album); toast('🏆', `${Rm.name} album complete!`, `+${PAY.album} coins`); snd.win(); }, 1600); }
}

// ---- bingo claims
el.bingo.onclick = () => claim(false);
function claim(auto) {
  if (!Rd || (state !== 'play' && !auto)) return 0;
  let got = 0;
  Rd.cards.forEach(c => {
    for (const m of readyMasks(c, Rd.def.shapes)) {
      c.claimed.push(m.key); c.bingos++; Rd.bingos++; got++;
      const base = Rd.bingos === 1 ? PAY.first : PAY.more, quick = !auto && Rd.idx - (Rd.readyAt || Rd.idx) <= 3 ? PAY.quick : 0, pay = base * (Rd.double ? 2 : 1) + quick;
      if (Rd.double) { Rd.double = false; el.bingo.querySelector('.x2')?.remove(); }
      Rd.coins += pay; M.add(pay, 'bingo');
      m.mask.forEach((i, k) => setTimeout(() => c.cells[i].classList.add('won'), k * 40));
      setTimeout(() => flyTo(c.el, el.coins, COIN_HTML, 7), 300);
      if (!Rd.firstBingoBall) Rd.firstBingoBall = Rd.idx;
      if (Rd.bingos === 1) setTimeout(() => Rd && giveStamp(c.el), 900);
      if (c.bingos >= MAX_BINGOS) { c.el.appendChild($(`<div class="dd-full"><b>${MAX_BINGOS} BINGOS!</b></div>`)); c.el.querySelector('.dd-badge')?.remove(); }
    }
  });
  if (!got) { if (!auto) { snd.nope(); el.bingo.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 }); } return 0; }
  st.bingos += got; save();
  if (!auto) {
    bigText(got > 1 ? `BINGO ×${got}` : 'BINGO!'); snd.bingo(); buzz([20, 40, 30]);
    const r = el.bingo.getBoundingClientRect(); confettiAt(innerWidth / 2, innerHeight * 0.42, 90); confettiAt(r.left + r.width / 2, r.top, 40);
    host?.play('cheer', true); say(['Bingo! Well done!', 'Smashing!', 'Lovely jubbly!', 'House!'][Math.floor(Math.random() * 4)], '', 1800); snd.say('Bingo!', 1);
  }
  checkReady();
  if (Rd.cards.every(c => c.bingos >= MAX_BINGOS)) { Rd.budget = Rd.idx; setTimeout(finishRound, 1500); }
  return got;
}

// ---- power-ups
function updatePower() {
  const p = Rd ? Rd.meter / POWER_DAUBS * 100 : 0, full = Rd && Rd.meter >= POWER_DAUBS;
  el.power.style.setProperty('--p', p); el.power.classList.toggle('full', !!full);
  el.power.querySelector('small').textContent = full ? 'TAP!' : `${Rd ? Rd.meter : 0}/${POWER_DAUBS}`;
}
el.power.onclick = () => usePower();
function usePower() {
  if (!Rd || state !== 'play' || Rd.over || Rd.meter < POWER_DAUBS) { if (Rd && Rd.meter < POWER_DAUBS) { snd.nope(); toast('✨', 'Power-up charging', `daub ${POWER_DAUBS - Rd.meter} more to fill it`); } return; }
  Rd.meter = 0; updatePower();
  const p = pickPower(Rd.rng); snd.power(); buzz(15);
  document.getElementById('dd-reveal')?.remove();
  const rv = $(`<div id="dd-reveal" class="dd"><div class="i">${p.icon}</div><b>${p.name}</b><small>${p.line}</small></div>`); document.body.appendChild(rv); setTimeout(() => rv.remove(), 1450);
  const live = Rd.cards.map((c, i) => i).filter(i => Rd.cards[i].bingos < MAX_BINGOS);
  const pickCard = () => live.length ? live[Math.floor(Rd.rng() * live.length)] : 0;
  if (p.id === 'daub') {
    const ci = pickCard(), c = Rd.cards[ci], fc = []; for (let i = 0; i < 25; i++) if (!c.daub[i]) fc.push(i);
    if (fc.length) setTimeout(() => Rd && daub(ci, fc[Math.floor(Rd.rng() * fc.length)], 'magic'), 700);
  } else if (p.id === 'pick') {
    Rd.pick = true; el.cards.querySelectorAll('.dd-card').forEach(c => c.classList.add('pick'));
    const bn = $('<div id="dd-banner" class="dd">🎯 Tap any square to daub it</div>'); bn.style.top = (el.cards.getBoundingClientRect().top - 18) + 'px'; document.body.appendChild(bn);
  } else if (p.id === 'coins' || p.id === 'stamp') {
    const spots = []; Rd.cards.forEach((c, ci) => freeCells(c).forEach(i => spots.push([ci, i]))); shuffleIn(spots, Rd.rng);
    spots.slice(0, p.id === 'coins' ? 3 : 1).forEach(([ci, i], k) => setTimeout(() => { if (!Rd) return; placePrize(Rd.cards[ci], i, p.id === 'coins' ? 'coin' : 'stamp'); const r = Rd.cards[ci].cells[i].getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2, ['#ffd23f', '#fff'], 8); }, 600 + k * 150));
  } else if (p.id === 'balls') { Rd.budget += 3; updateBalls(); bump(el.ballsBox); }
  else if (p.id === 'double') { Rd.double = true; if (!el.bingo.querySelector('.x2')) el.bingo.appendChild($('<span class="x2">×2</span>')); }
}

// ---- end of round
async function finishRound() {
  if (!Rd || Rd.over) return; Rd.over = true;
  if (Rd.pick) { Rd.pick = false; document.getElementById('dd-banner')?.remove(); }
  await wait(400);
  const auto = claim(true);
  if (auto) { toast('🎱', `We found ${auto} bingo${auto > 1 ? 's' : ''} for you`, 'tap BINGO! next time for a quick-claim bonus'); await wait(900); }
  const won = Rd.bingos > 0, def = Rd.def, ms = performance.now() - Rd.t0;
  const best = Math.max(...Rd.cards.map(c => closeness(c, def.shapes).f));
  if (!Rd.recorded) { Rd.recorded = true; if (!def.daily) F.level(won, won ? 1 : best); B.submit(Rd.bingos, { ms }); }
  if (won) {
    state = 'won'; st.wins++;
    const stars = Math.min(3, Rd.bingos);
    let unlockedRoom = null;
    if (def.daily) dailyWon();
    else if (!encore) {
      st.stars[def.n] = Math.max(st.stars[def.n] || 0, stars);
      const prevRoom = progRoom(); st.level++;
      if (def.round === ROUNDS_PER_ROOM) { M.add(PAY.room, 'room'); Rd.coins += PAY.room; if (progRoom() !== prevRoom) { unlockedRoom = progRoom(); st.rooms = Math.max(st.rooms, unlockedRoom + 1); st.sel = unlockedRoom; } }
    }
    save(); pendingUnlock = unlockedRoom;
    snd.win(); host?.play('cheer', true);
    showResult(true, stars);
  } else {
    state = 'lost'; snd.lose();
    showResult(false, 0, best);
  }
}
function dailyWon() {
  const d = dayNum(), ds = st.ds;
  if (ds.last === d) return;
  if (ds.last === d - 1) ds.n++;
  else if (ds.last === d - 2 && ds.fw !== weekNum()) { ds.n++; ds.fw = weekNum(); toast('❄️', 'Streak freeze used', 'one free freeze a week'); }
  else ds.n = 1;
  ds.last = d; save();
}
function shareGrid() {
  const c = Rd.cards.reduce((a, b) => (b.bingos > a.bingos ? b : a), Rd.cards[0]);
  const rows = []; for (let r = 0; r < 5; r++) rows.push(c.daub.slice(r * 5, r * 5 + 5).map((d, i) => r * 5 + i === 12 ? '⭐' : d ? '🟨' : '⬜').join(''));
  const u = new URL(location.href); u.search = '?daily=1';
  return `Daubdeck Daily 🎱 ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\nBINGO on ball ${Rd.firstBingoBall} of ${Rd.budget} · ${Rd.bingos} bingo${Rd.bingos > 1 ? 's' : ''} · 🔥${st.ds.n}\n${rows.join('\n')}\n${u.href}`;
}
function showResult(won, stars, best = 0) {
  const card = won ? ui.els.win : ui.els.lose;
  card.querySelector('.dd-res')?.remove();
  const def = Rd.def;
  if (won) {
    ui.els.win.querySelector('p').innerHTML = (def.daily ? 'DAILY BINGO' : `${ROOMS[def.room].name.toUpperCase()} · ${encore ? 'ENCORE' : 'ROUND ' + def.round}`) + '<span data-l hidden></span>';
    ui.els.win.querySelector('h1').textContent = Rd.bingos >= 3 ? 'FABULOUS!' : 'BINGO!';
  } else ui.els.lose.querySelector('h1').textContent = Rd.left ? 'Round left' : 'Out of balls!';
  const res = $(`<div class="dd-res">
    ${won ? `<div class="stars"><i>⭐</i><i>⭐</i><i>⭐</i></div>` : ''}
    <div class="dd-stats"><div><b>${Rd.bingos}</b><small>BINGOS</small></div><div><b><span class="dd-coin"></span>${Rd.coins}</b><small>COINS WON</small></div><div><b>${Rd.idx}</b><small>BALLS</small></div></div>
    ${Rd.stamps.length ? `<div class="dd-got">${Rd.stamps.map(id => `<img src="./assets/stamps/${id}.webp" alt="${STAMP_NAMES[id]}">`).join('')}</div>` : ''}
    ${!won ? `<div class="line">${best >= 0.75 ? 'So close! One more ball could have done it.' : 'No bingo this time. The next shuffle is a fresh start.'}</div>` : ''}
    ${won && pendingUnlock !== null ? `<div class="line">🗺️ New room unlocked: <b>${ROOMS[pendingUnlock].name}</b> · +${PAY.room} coins</div>` : ''}
  </div>`);
  const btns = [];
  if (won && Rd.coins > 0) btns.push($(`<button class="dd-btn dd-goldb">▶ Double my coins (+${Rd.coins})</button>`));
  if (!won && !Rd.extra && !Rd.left) btns.push($(`<button class="dd-btn dd-green">▶ +5 balls, keep playing</button>`));
  if (def.daily && won) btns.push($(`<button class="dd-btn dd-pinkb">Share my card</button>`));
  btns.forEach(b => { b.addEventListener('pointerdown', e => e.stopPropagation()); res.appendChild(b); });
  if (!won && btns[0]) { btns[0].style.visibility = 'hidden'; setTimeout(() => { btns[0].style.visibility = ''; }, 1900); }   // no offer within 1.2 s of losing (the card itself shows at 0.65 s)
  if (won && Rd.coins > 0) btns[0].onclick = async e => { e.stopPropagation(); const amt = Rd.coins; if (await M.rewarded('double', { what: `+${amt} more coins from this round` })) { M.add(amt, 'double'); Rd.coins += amt; btns[0].remove(); res.querySelector('.dd-stats div:nth-child(2) b').innerHTML = `<span class="dd-coin"></span>${Rd.coins}`; flyTo(res, el.coins, COIN_HTML, 8); } };
  if (!won && !Rd.extra && !Rd.left) btns[0].onclick = async e => { e.stopPropagation(); if (await M.rewarded('moves', { title: '+5 balls', what: '5 more balls to finish this round' })) { continueRound(); } };
  if (def.daily && won) btns[btns.length - 1].onclick = async e => { e.stopPropagation(); const text = shareGrid(); try { if (navigator.share) { await navigator.share({ title: NAME, text }); return; } } catch (er) { return; } try { await navigator.clipboard.writeText(text); toast('📋', 'Copied!', 'paste it to a friend'); } catch (er) {} };
  card.querySelector('h1').after(res);
  card.querySelector('.hc-btn')?.classList.toggle('dd-hidden', !!def.daily);
  card.querySelector('.hint').textContent = won ? 'Tap to continue' : 'Tap to go back';
  if (won) { D.won(Rd.bingos, 'got bingos ×'); ui.win(st.level - 1); res.querySelectorAll('.stars i').forEach((s, k) => setTimeout(() => { if (k < stars) { s.classList.add('on'); snd.star(k); } }, 900 + k * 260)); setTimeout(() => confettiAt(innerWidth / 2, innerHeight * 0.3, 80), 800); }
  else ui.lose(ui.els.lose.querySelector('h1').textContent, '');
}
function continueRound() {
  ui.els.lose.classList.add('hc-hidden');
  Rd.extra = true; Rd.over = false; Rd.budget += 5; Rd.next = 0.8; state = 'play'; updateBalls();
  say('Five more balls!', 'eyes down', 1600); host?.play('jump', true);
}
ui.onTap(async which => {
  if (which === 'start') { snd.unlock(); snd.music(true); if (loaded) enterLobby(); else pendingStart = true; return; }
  // back to the lobby after a result card, with a natural-break ad (the kit applies every cap)
  const lvl = Rd ? (Rd.def.n || st.level) : st.level;
  Rd = null; state = 'ready'; el.cards.innerHTML = ''; ball.visible = false; callAnim.on = false;
  enterLobby();
  await wait(400);
  if (which === 'win' || which === 'lose') await M.breakAd('level-end', { level: lvl });
  if (pendingUnlock !== null) { const r = pendingUnlock; pendingUnlock = null; toast(`${ROOMS[r].d}`, `Welcome to ${ROOMS[r].name}!`, 'a new room on your travel map'); confettiAt(innerWidth / 2, innerHeight * 0.3, 100); host?.play('cheer', true); snd.win(); }
});
let pendingStart = false;
// ads pause our own music + caller (the kit also suspends the AudioContext)
addEventListener('ap:ad', e => { if (e.detail.phase === 'start') { snd.music(false); try { speechSynthesis.cancel(); } catch (er) {} if (Rd) Rd.paused = true; } else { snd.music(true); if (Rd && !document.querySelector('.dd-sheetwrap')) Rd.paused = false; } });
function enterLobby() {
  setMode('lobby'); state = 'ready';
  if (dailyMode && st.ds.last === dayNum() && !D.seed) dailyMode = false;
  refreshLobby();
  if (st.gift !== dayNum()) { st.gift = dayNum(); save(); setTimeout(() => { M.add(100, 'daily-gift'); toast('🎁', 'Daily gift: +100 coins', 'come back tomorrow for more'); flyTo(el.lobby, el.coins, COIN_HTML, 6); }, 700); }
  if (!st.welcomed) { st.welcomed = 1; save(); setTimeout(() => { M.add(200, 'welcome'); toast('🪙', 'Welcome to Daubdeck! +200 coins', 'free play coins, just for fun'); }, 2400); }
  say(['Fancy a game, love?', 'Eyes down soon!', 'Pick your cards!', 'Where to next?'][Math.floor(Math.random() * 4)], '', 2200);
}

// ---------------------------------------------------------------- loading
async function boot() {
  let n = 0; const total = 4, tick = () => { n++; loadBar.style.width = Math.min(100, n / total * 100) + '%'; };
  paintBg(st.sel); tick();
  const hp = loadHost().then(h => { tick(); return h; }).catch(e => { console.warn('host', e); return null; });
  await showDio(st.sel); tick();
  host = await hp;
  if (host) { scene.add(host.g); host.g.traverse(o => { if (o.isMesh) o.castShadow = true; }); }
  layout(); snapAll(); tick();
  loadEl.style.opacity = 0; setTimeout(() => loadEl.remove(), 600);
  loaded = true; state = 'ready';
  if (pendingStart) enterLobby();
  for (let r = 0; r < ROOMS.length; r++) if (unlocked(r) && r !== st.sel) setTimeout(() => dioOf(r), 2500 + r * 900);
}
function snapAll() { for (const k of ['mach', 'host', 'dio']) { cur[k].p.copy(T[k].p); cur[k].s = T[k].s; cur[k].ry = T[k].ry; } }

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Clock();
let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  // play clock
  if (mode === 'play' && Rd && !Rd.over && !Rd.paused && state === 'play' && document.visibilityState !== 'hidden') {
    Rd.next -= dt;
    if (Rd.next <= 0) {
      if (Rd.idx < Rd.budget && Rd.idx < 75) { callBall(); Rd.next = interval(); }
      else if (!Rd.endAt) Rd.endAt = now + (Rd.fast ? 1600 : 2600);
    }
    if (Rd.endAt && Rd.idx < Rd.budget) Rd.endAt = 0;   // +3 balls power-up landed
    if (Rd.endAt && now > Rd.endAt) { Rd.endAt = 0; finishRound(); }
    // gentle nudge: numbers called a while ago and not daubed shimmer
    if (Rd && Rd.list.length) for (const c of Rd.cards) for (let i = 0; i < 25; i++) if (!c.daub[i] && Rd.called.has(c.nums[i]) && !c.cells[i].classList.contains('miss')) {
      const k = c.nums[i] + ':' + i; Rd.missT[k] = Rd.missT[k] || now; if (now - Rd.missT[k] > 3200) c.cells[i].classList.add('miss'); }
  }
  tickCall(dt);
  // layout lerps
  const k = 1 - Math.pow(0.0015, dt);
  for (const key of ['mach', 'host', 'dio']) { const c = cur[key], tg = T[key]; c.p.lerp(tg.p, k); c.s += (tg.s - c.s) * k; c.ry += (tg.ry - c.ry) * k; }
  mach.group.position.copy(cur.mach.p); mach.group.scale.setScalar(cur.mach.s); mach.group.rotation.set(0.12, cur.mach.ry, 0);
  if (host) { host.g.position.copy(cur.host.p); host.g.scale.setScalar(cur.host.s); host.g.rotation.set(0.05, cur.host.ry + Math.sin(t * 0.5) * 0.04, 0); host.mixer.update(dt); }
  if (dio) { dio.position.copy(cur.dio.p); dio.scale.setScalar(cur.dio.s); dio.rotation.set(mode !== 'lobby' ? 0.28 : 0.18, cur.dio.ry + (mode !== 'lobby' ? Math.sin(t * 0.1) * 0.15 : t * 0.12), 0); }
  haze.material.opacity += ((mode !== 'lobby' ? 0.42 : 0) - haze.material.opacity) * k; haze.scale.set(vh(24) * cam.aspect * 1.05, vh(24) * 1.05, 1);
  spot.position.copy(cur.mach.p).add(new V3(0, 3 * cur.mach.s, 2)); spot.intensity = mode === 'play' ? 6 : 3;
  mach.update(dt, t); WP.update(dt);
  if (bubbleEl) { bubbleT -= dt; placeBubble(); if (bubbleT <= 0) { bubbleEl.remove(); bubbleEl = null; } }
  C.render(dt);
}
requestAnimationFrame(frame);
setMode('title');
boot().catch(e => console.error(e));
ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; },
  get level() { return st.level; },
  get score() { return Rd ? Rd.bingos : st.bingos; },
  bot() {
    if (mode === 'lobby' && state === 'ready' && !busy && loaded && !document.querySelector('.dd-sheetwrap')) { startRound(); return; }
    if (!Rd || state !== 'play' || Rd.over) return;
    if (!Rd.fast) el.fast.onclick();
    if (Rd.pick) { let bestC = 0, bestI = -1, bestN = 99; Rd.cards.forEach((c, ci) => { const cl = closeness(c, Rd.def.shapes); if (cl.cells && cl.need < bestN) { const i = cl.cells.find(i => !c.daub[i]); if (i !== undefined) { bestN = cl.need; bestC = ci; bestI = i; } } }); if (bestI >= 0) tapCell(bestC, bestI); return; }
    if (el.bingo.classList.contains('on')) { claim(false); return; }
    if (Rd.meter >= POWER_DAUBS) { usePower(); return; }
    let n = 0; Rd.cards.forEach((c, ci) => { for (let i = 0; i < 25 && n < 2; i++) if (!c.daub[i] && Rd.called.has(c.nums[i])) { tapCell(ci, i); n++; } });
  },
};

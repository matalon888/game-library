// Glowfit Runway: kawaii dress-up style battles. Each show has a themed brief (two style tags + a colour palette, later
// a tag to avoid). Dress your chibi model (k01–k05) with fitted 3D pieces and colourways, watch the live STYLE score
// (theme fit + colour harmony + variety), strut the pastel runway, then 100 simulated fans vote between you and three
// chibi rivals who dress from the same closet under the same scoring. Wins unlock pieces, stickers and studio decor.
import { THREE, createUI, store, loop, buzz, confetti, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { money } from './kit/money.js';
import { TAGS, COLOURS, FAMS, SLOTS, PIECES, BOUTIQUE, THEMES, RULE_BANS, MODELS, STICKERS, PAGES, DECOR, FANS,
  pieceById, colourById, score, bestFor, simulateVote, lookPieces } from './data.js';
import { loadProp, loadChar, createModel, wear, buildCodePieces, pieceMesh, propMesh } from './dress.js';
import { buildStage, buildStudio, RUN_Z0, POSE_Z, STUDIO, heartPath } from './stage.js';
import { S as SND, music, setMuted, unlock, pauseAll } from './audio.js';

const NAME = 'Glowfit Runway: Dress Up Fashion Battle', KEY = 'glowfit';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const P = Object.assign({ level: 1, stars: {}, model: 'k01', spent: 0, decor: [], stickers: [], pages: [], cw: {}, owned: [], seen: [], lastLook: null,
  mute: false, best: 0, plays: 0, wins: 0, daily: { last: 0, streak: 0, freezeWeek: '' }, tips: 1 }, ST.get('p', {}));
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const totalStars = () => Object.values(P.stars).reduce((a, b) => a + b, 0) + (P.dailyStars || 0);
const starsLeft = () => totalStars() - P.spent;
const isDaily = () => !!D.seed;
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const isoWeek = (d = new Date()) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 864e5 + 1) / 7); };

// ---------------------------------------------------------------- renderer + post (kawaii: bright, glossy, a little bloom)
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.info.autoReset = false; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);
const C = cine(R, scene, cam, { bloom: 0.2, bloomThreshold: 1.7, bloomRadius: 0.4, exposure: 0.92, envIntensity: 0.3, lite: LITE, grade: { sat: 1.18, contrast: 1.06, vignette: 0.08, grain: 0 } });
scene.add(new THREE.HemisphereLight(0xfff0fa, 0xa77ad0, 0.65));
const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(2.5, 7, 6); sun.castShadow = true;
sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 }); scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xffd6f4, 1.1); rim.position.set(-4, 3, -4); scene.add(rim);
const fill = new THREE.DirectionalLight(0xf2e6ff, 0.6); fill.position.set(-3, 2, 6); scene.add(fill);
const limbo = new THREE.Group(); limbo.visible = false; scene.add(limbo);

// ---------------------------------------------------------------- snapshot renderer (card thumbnails, portraits, crowd billboards)
const SN = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
SN.setPixelRatio(1); SN.toneMapping = THREE.ACESFilmicToneMapping; SN.toneMappingExposure = 1.05; SN.outputColorSpace = THREE.SRGBColorSpace;
const snapScene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(SN); snapScene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; snapScene.environmentIntensity = 0.6; pm.dispose(); }
snapScene.add(new THREE.HemisphereLight(0xfff4fb, 0xc9a8e0, 1.3));
{ const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(1.5, 3, 4); snapScene.add(d); }
const snapCam = new THREE.PerspectiveCamera(24, 1, 0.01, 30);
function snap(obj, { w = 192, h = 192, center, height, dir = V3(0, 0, 1), fov = 24 }) {
  SN.setSize(w, h, false); snapCam.aspect = w / h; snapCam.fov = fov; snapCam.updateProjectionMatrix();
  const d = (height / 2) / Math.tan(fov * Math.PI / 360) * 1.08;
  snapCam.position.copy(center).add(dir.clone().normalize().multiplyScalar(d)); snapCam.lookAt(center);
  const par = obj.parent, pos = obj.position.clone(), rot = obj.rotation.y, vis = obj.visible;
  snapScene.add(obj); obj.position.set(0, 0, 0); obj.rotation.y = 0; obj.visible = true;
  SN.render(snapScene, snapCam);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(SN.domElement, 0, 0);
  if (par) par.add(obj); else snapScene.remove(obj); obj.position.copy(pos); obj.rotation.y = rot; obj.visible = vis;
  return c;
}
const THUMBS = new Map();
function thumb(id, cw) {
  const k = id + ':' + cw; if (THUMBS.has(k)) return THUMBS.get(k);
  const m = pieceMesh(id, colourById(cw));
  const b = new THREE.Box3().setFromObject(m), c = b.getCenter(V3()), s = b.getSize(V3());
  const url = snap(m, { w: 160, h: 200, center: c, height: Math.max(s.y, s.x * 1.25) * 1.05, dir: V3(0.45, 0.3, 1), fov: 22 }).toDataURL('image/png');
  THUMBS.set(k, url); return url;
}
function portrait(model, w = 160) {
  const M = model.M, c = V3(0, M.head.y + M.headH * 0.38, 0.02);
  return snap(model.object, { w, h: w, center: c, height: M.headH * 1.5, dir: V3(0.12, 0.05, 1), fov: 22 }).toDataURL('image/png');
}

// ---------------------------------------------------------------- kit layers
const ui = createUI({ title: 'Glowfit', hint: '', hand: '', progress: false, score: false });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'glowfit', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 0.6 }, corner: 'tl', accent: '#ff5fae' });
const F = flow(KEY);
const M = money({ game: 'glowfit', style: 'B', onAdStart: () => pauseAll(true), onAdEnd: () => pauseAll(false) });
addEventListener('ap:ad', e => pauseAll(e.detail && e.detail.phase === 'start'));
M.onChange(s => { $('coinn').textContent = s.coins; });

// ---------------------------------------------------------------- state
let phase = 'loading', W = innerWidth, H = innerHeight, T = 0;
let stage = null, studio = null, models = {}, me = null, show = null, look = {}, tab = 'top', tipFor = null, revived = false;
let walk = null, vote = null, result = null, t0run = 0, beatenShown = false, faveRival = -1, ports = {}, studioMeshes = {};
const curL = () => (isDaily() ? 12 : P.level);
function hud() {
  $('coinn').textContent = M.coins(); $('starn').textContent = starsLeft(); $('streakn').textContent = P.daily.streak || D.streak || 0;
  $('lvb').textContent = isDaily() ? '★' : P.level;
  const next = DECOR.find(d => !P.decor.includes(d.id)); $('xpb').style.width = (next ? clamp(starsLeft() / next.cost, 0, 1) * 100 : 100) + '%';
}
function setPhase(p) { phase = p; document.body.className = document.body.className.replace(/phase-\S+/g, '').trim() + ' phase-' + p + (W >= 900 ? ' wide' : ''); }

// ---------------------------------------------------------------- show generation (seeded; same rules for everyone)
const avail = (L, owned = []) => (p, c) => (p.lvl || 1) <= L && ((c.lvl || 1) <= L || owned.includes(p.id + ':' + c.id));
function makeShow(L) {
  const daily = isDaily(), seed = daily ? D.seed : L * 7919 + 101, r = rng(seed);
  const pool = THEMES.filter(t => t.lvl <= Math.max(L, daily ? 20 : 1)), debut = !daily && THEMES.find(t => t.lvl === L);
  const theme = debut || pool[Math.floor(r() * pool.length)];
  const hard = !daily && L > 5 && L % 6 === 0;
  const ban = !daily && L >= 6 && r() < 0.5 ? RULE_BANS.filter(t => !theme.want.includes(t))[Math.floor(r() * 6)] : (daily && r() < 0.5 ? RULE_BANS.filter(t => !theme.want.includes(t))[Math.floor(r() * 6)] : null);
  const others = MODELS.filter(m => m.id !== P.model).map(m => m.id);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const rivals = others.slice(0, 3);
  // rival skill: how often a rival picks the best piece for a slot. Sawtooth: easy start, a short Hard show every 6th.
  const base = daily ? 0.82 : L <= 5 ? 0.15 + L * 0.05 : Math.min(0.9, 0.7 + (L - 5) * 0.015) + (hard ? 0.12 : 0);   // tuned by sim: L1-5 ~95%+, normal ~75-90%, Hard ~40-75%, daily ~80%
  const skill = clamp(daily ? base : base * (L <= 5 ? 1 : F.k()), 0.05, 0.92);
  const s = { L, seed, theme, want: theme.want, pal: theme.pal, ban, rivals, skill, hard, daily, r };
  const av = avail(daily ? 12 : L);
  s.rivalLooks = rivals.map(() => genLook(r, s, av, skill));
  return s;
}
function genLook(r, s, av, skill) {
  const lk = {};
  for (const sl of SLOTS) {
    if (sl.key === 'bottom' && lk.top && pieceById(lk.top.id).dress) continue;
    if (['bag', 'face', 'hand', 'head'].includes(sl.key) && r() < 0.3 * (1 - skill)) continue;
    if (r() < skill) { const b = bestFor(sl.key, lk, s, av).best.filter(Boolean); if (b.length) { lk[sl.key] = b[Math.floor(r() * b.length)]; continue; } }
    const opts = []; for (const p of PIECES) if (p.slot === sl.key) for (const c of COLOURS) if (av(p, c)) opts.push({ id: p.id, cw: c.id });
    if (opts.length) lk[sl.key] = opts[Math.floor(r() * opts.length)];
    if (lk.top && pieceById(lk.top.id).dress) delete lk.bottom;
  }
  return lk;
}
const myAvail = () => { const L = curL(); return (p, c) => (p.lvl || 1) <= L && ((c.lvl || 1) <= L || P.owned.includes(p.id + ':' + c.id)); };
const lookScore = (lk = look) => score(lk, show, isDaily() ? null : P.lastLook);

// ---------------------------------------------------------------- camera
const camS = { pos: V3(0, 1, 5), look: V3(0, 0.7, 0), fov: 30, off: [0, 0] }, camG = { pos: V3(0, 1, 5), look: V3(0, 0.7, 0), fov: 30, off: [0, 0] };
let camCut = true, camK = 3.5;
function setCam(f, cut = false, k = 3.5) { camG.pos.copy(f.pos); camG.look.copy(f.look); camG.fov = f.fov; camG.off = f.off || [0, 0]; if (cut) camCut = true; camK = k; }
// put a subject `h` metres tall centred at c into screen region r (px)
function frame(c, h, r, dir = V3(0, 0.1, 1), fov = 30, fillH = 0.92, wFrac = 0.62) {
  const hr = Math.max(80, r.y1 - r.y0), wr = Math.max(80, r.x1 - r.x0), t = Math.tan(fov * Math.PI / 360);
  const d1 = h * H / (fillH * hr * 2 * t), d2 = (h * wFrac) * W / (0.92 * wr * 2 * t * (W / H));
  const pos = c.clone().add(dir.clone().normalize().multiplyScalar(Math.max(d1, d2)));
  return { pos, look: c.clone(), fov, off: [-((r.x0 + r.x1) / 2 - W / 2), -((r.y0 + r.y1) / 2 - H / 2)] };
}
function updateCam(dt) {
  const k = camCut ? 1 : 1 - Math.exp(-dt * camK);
  camS.pos.lerp(camG.pos, k); camS.look.lerp(camG.look, k); camS.fov = lerp(camS.fov, camG.fov, k);
  camS.off[0] = lerp(camS.off[0], camG.off[0], k); camS.off[1] = lerp(camS.off[1], camG.off[1], k); camCut = false;
  cam.position.copy(camS.pos); cam.lookAt(camS.look); cam.fov = camS.fov;
  cam.setViewOffset(W, H, camS.off[0], camS.off[1], W, H); cam.updateProjectionMatrix();
}
const meH = () => 1.32;
function dressCam(cut = false) {
  const top = (W >= 900 ? 70 : 74), bot = $('panel').classList.contains('hide') ? 40 : (H - $('panel').getBoundingClientRect().top) - (W >= 900 ? 10 : 30);
  const r = { x0: W >= 900 ? 240 : 30, x1: W >= 900 ? W - 240 : W - 30, y0: top, y1: H - bot };
  setCam(frame(V3(0, 0.8, POSE_Z), meH(), r, V3(0, 0.14, 1), 48, W >= 900 ? 0.95 : 0.7), cut);
}
function lobbyCam(cut = false) {
  const sc = $('showc').getBoundingClientRect(), lg = $('logo').getBoundingClientRect();
  const r = { x0: 0, x1: W, y0: lg.bottom - 6, y1: sc.top - (W >= 900 ? 4 : 56) };
  setCam(frame(V3(0, 0.78, POSE_Z), meH(), r, V3(0.1, 0.14, 1), 48, W >= 900 ? 0.95 : 0.72), cut);
}
function resize() {
  W = innerWidth; H = innerHeight; R.setSize(W, H); cam.aspect = W / H; C.resize(W, H); document.body.classList.toggle('wide', W >= 900);
  if (phase === 'dress') dressCam(true); if (phase === 'title') { placeLobby(); lobbyCam(true); } if (phase === 'studio') studioCam(true);
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- 3D sparkles + hearts (sprites)
const mkT = draw => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const starT = mkT(x => { x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 30, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); });
const heartT = mkT(x => { x.fillStyle = '#fff'; heartPath(x, 32, 34, 22); x.fill(); x.fillStyle = '#ff5fae'; heartPath(x, 32, 34, 17); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.ellipse(24, 26, 5, 3, -0.6, 0, 7); x.fill(); });
const SPR = [];
for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); SPR.push({ s, life: 0 }); }
function sparkle(pos, { n = 8, color = 0xfff1a8, size = 0.12, up = 1, spread = 0.4, life = 0.8, heart = false, to = null, dur = 1, onEnd = null } = {}) {
  for (let k = 0; k < n; k++) {
    const p = SPR.find(q => q.life <= 0); if (!p) return;
    p.s.material.map = heart ? heartT : starT; p.s.material.color.set(heart ? 0xffffff : color); p.s.material.blending = heart ? THREE.NormalBlending : THREE.AdditiveBlending;
    p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.6, pos.z + (Math.random() - 0.5) * spread);
    p.v = V3((Math.random() - 0.5) * spread * 2, up * (0.5 + Math.random() * 0.8), (Math.random() - 0.5) * spread * 2);
    p.life = p.max = (to ? dur : life) * (0.85 + Math.random() * 0.3); p.size = size * (0.7 + Math.random() * 0.6); p.s.visible = true;
    p.from = to ? p.s.position.clone() : null; p.to = to ? to.clone() : null; p.arc = 0.6 + Math.random() * 0.8; p.onEnd = k === 0 ? onEnd : null;
  }
}
function updateSprites(dt) {
  for (const p of SPR) {
    if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max;
    if (p.to) { p.s.position.lerpVectors(p.from, p.to, ease(k)); p.s.position.y += Math.sin(k * Math.PI) * p.arc; p.s.scale.setScalar(p.size * (0.7 + Math.sin(k * Math.PI) * 0.5)); p.s.material.opacity = Math.min(1, (1 - k) * 5); }
    else { p.s.position.addScaledVector(p.v, dt); p.v.y -= dt * 1.2; p.s.scale.setScalar(p.size * (1 - k * 0.5)); p.s.material.opacity = Math.min(1, (1 - k) * 2); p.s.material.rotation = k * 3; }
    if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; if (p.onEnd) { const f = p.onEnd; p.onEnd = null; f(); } }
  }
}

// ---------------------------------------------------------------- icons (inline SVG, kawaii line style)
const IC = {
  top: '<svg viewBox="0 0 40 40"><path d="M13 7l-7 5 3 7 4-2v16h14V17l4 2 3-7-7-5c-1 3-3 5-6 5s-5-2-6-5z" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.4" stroke-linejoin="round"/><path d="M17 22c0-2 3-3 3-1 0-2 3-1 3 1s-3 3-3 4c0-1-3-2-3-4z" fill="#ff6fb6"/></svg>',
  skirt: '<svg viewBox="0 0 40 40"><path d="M12 9h16l6 22c-9 3-23 3-32 0z" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.4" stroke-linejoin="round"/><path d="M15 13l-3 17M20 13v18M25 13l3 17" stroke="#ff6fb6" stroke-width="1.8"/><path d="M11 12h18" stroke="#ff6fb6" stroke-width="3"/></svg>',
  boot: '<svg viewBox="0 0 40 40"><path d="M12 5h11v18l9 4c2 1 2 5 0 6H10z" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.4" stroke-linejoin="round"/><path d="M10 33h22v3H10z" fill="#ff6fb6"/><path d="M14 11h7M14 15h7M14 19h7" stroke="#ff6fb6" stroke-width="1.8"/></svg>',
  bag: '<svg viewBox="0 0 40 40"><path d="M14 15c0-6 3-9 6-9s6 3 6 9" fill="none" stroke="#ff6fb6" stroke-width="2.4"/><rect x="7" y="14" width="26" height="20" rx="6" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.4"/><path d="M20 30c-5-3-6-6-4-8 1.5-1.5 3.5-.5 4 1 .5-1.5 2.5-2.5 4-1 2 2 1 5-4 8z" fill="#ff6fb6"/></svg>',
  bow: '<svg viewBox="0 0 40 40"><path d="M20 20L6 11c-3 2-3 16 0 18zM20 20l14-9c3 2 3 16 0 18z" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="20" r="4.5" fill="#ff6fb6"/><path d="M18 24l-4 10M22 24l4 10" stroke="#ff6fb6" stroke-width="2.4" stroke-linecap="round"/></svg>',
  shades: '<svg viewBox="0 0 40 40"><path d="M11 30c-6-4-8-8-6-11 1.6-2.4 4.6-1.6 6 .4 1.4-2 4.4-2.8 6-.4 2 3 0 7-6 11z" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.2"/><path d="M29 30c-6-4-8-8-6-11 1.6-2.4 4.6-1.6 6 .4 1.4-2 4.4-2.8 6-.4 2 3 0 7-6 11z" fill="#ffd0ea" stroke="#ff6fb6" stroke-width="2.2"/><path d="M17 21c2-1.5 4-1.5 6 0" stroke="#ff6fb6" stroke-width="2.2" fill="none"/></svg>',
  wand: '<svg viewBox="0 0 40 40"><path d="M10 34l13-15" stroke="#ff6fb6" stroke-width="3.2" stroke-linecap="round"/><path d="M27 4l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7-5.9-3.7-5.9 3.7 1.7-6.7-5.3-4.4 6.9-.5z" fill="#fff0a8" stroke="#ff6fb6" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  shop: '<svg viewBox="0 0 40 40"><path d="M13 14c0-5 3-8 7-8s7 3 7 8" fill="none" stroke="#fff" stroke-width="3"/><path d="M7 13h26l-2 21H9z" fill="#d6b8ff" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M20 30c-5-3-6-6-4-8 1.5-1.5 3.5-.5 4 1 .5-1.5 2.5-2.5 4-1 2 2 1 5-4 8z" fill="#ff7fbf"/></svg>',
  tip: '<svg viewBox="0 0 40 40"><rect x="8" y="7" width="24" height="29" rx="5" fill="#fff" stroke="#c9a3f5" stroke-width="2"/><rect x="14" y="4" width="12" height="7" rx="3" fill="#ff9fd2"/><path d="M13 22l4 4 9-9" stroke="#ff5fae" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  album: '<svg viewBox="0 0 40 40"><rect x="7" y="13" width="26" height="21" rx="4" fill="#ff9fd2" stroke="#fff" stroke-width="2.4"/><rect x="5" y="10" width="30" height="8" rx="3" fill="#ffcf5a" stroke="#fff" stroke-width="2.4"/><path d="M20 10v24" stroke="#ffcf5a" stroke-width="5"/><path d="M20 10c-4-6-10-4-8 0M20 10c4-6 10-4 8 0" fill="none" stroke="#ffcf5a" stroke-width="3"/></svg>',
  studio: '<svg viewBox="0 0 40 40"><path d="M6 19L20 7l14 12v15H6z" fill="#fff" stroke="#c9a3f5" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 31c-6-4-7-7-5-9 1.6-1.6 4-.6 5 1 1-1.6 3.4-2.6 5-1 2 2 1 5-5 9z" fill="#ff7fbf"/></svg>',
  daily: '<svg viewBox="0 0 40 40"><rect x="6" y="9" width="28" height="26" rx="6" fill="#fff" stroke="#c9a3f5" stroke-width="2.4"/><rect x="6" y="9" width="28" height="8" rx="4" fill="#ff8fc8"/><path d="M13 6v6M27 6v6" stroke="#9a5fc0" stroke-width="3" stroke-linecap="round"/><path d="M20 21l2 4.2 4.6.6-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.6z" fill="#ffcf5a"/></svg>',
};
const heartSvg = c => `<svg viewBox="0 0 100 90"><path d="M50 86C14 62 2 42 6 24 10 8 30 2 42 12c4 3 6 6 8 9 2-3 4-6 8-9 12-10 32-4 36 12 4 18-8 38-44 62z" fill="${c}" stroke="#fff" stroke-width="6"/></svg>`;
const tagHtml = (t, cls = '') => `<span class="tg ${cls}">${TAGS[t][0]} ${TAGS[t][1]}</span>`;
const palHtml = pal => pal.map(f => `<span class="dot" style="background:${FAMS[f]}"></span>`).join('');

// ---------------------------------------------------------------- side buttons
const side = $('side');
function sideButtons(list) {
  side.innerHTML = list.map(([k, label, badge]) => `<button class="rbtn" data-k="${k}" aria-label="${label}">${IC[k]}<em>${label}</em>${badge ? `<i>${badge}</i>` : ''}</button>`).join('');
  for (const b of side.querySelectorAll('button')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); sideAct(b.dataset.k); }); }
}
function sideAct(k) {
  if (k === 'shop') M.shop();
  else if (k === 'album') openAlbum();
  else if (k === 'studio') toStudio();
  else if (k === 'daily') { const u = new URL(location.href); if (isDaily()) u.searchParams.delete('daily'); else u.searchParams.set('daily', '1'); location.href = u.href; }
  else if (k === 'tip') useTip();
}
$('coinp').addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); M.shop(); });
for (const id of ['coinp', 'menu', 'top']) $(id).addEventListener('pointerdown', e => e.stopPropagation());
$('menu').addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); openMenu(); });

// ---------------------------------------------------------------- sheets
let sheetEl = null;
function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
function openSheet(html) {
  closeSheet(); const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = `<button class="x" aria-label="Close">✕</button>${html}`;
  ['pointerdown', 'pointerup', 'click'].forEach(ev => s.addEventListener(ev, e => e.stopPropagation()));
  s.querySelector('.x').addEventListener('click', () => { SND.tap(); closeSheet(); });
  document.body.appendChild(s); sheetEl = s; return s;
}
function openMenu() {
  const s = openSheet(`<h2>Menu</h2>
    <div class="howto"><b>How to win a show</b><br>👗 Wear pieces with the brief's style tags (${'<span class="tg">💿 Y2K</span>'} etc.).<br>🎨 Pick colourways from the brief's palette (⭐ on a swatch = on palette). Two or three palette colours look best.<br>✨ Fill more slots and don't repeat your last look exactly.<br>🗳️ Then 100 <b>simulated</b> fans vote: the best-styled look usually wins, with a little luck. No real players are voting.</div>
    <div class="mrow"><button class="jbtn lil" data-a="mute">${P.mute ? '🔇 Sound off' : '🔊 Sound on'}</button>${phase === 'dress' ? '<button class="jbtn" data-a="quit">🏠 Back to lobby</button>' : ''}<button class="jbtn mint" data-a="shop">🛍️ Treat Shop</button></div>`);
  s.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a; SND.tap();
    if (a === 'mute') { P.mute = !P.mute; saveP(); setMuted(P.mute); b.textContent = P.mute ? '🔇 Sound off' : '🔊 Sound on'; }
    if (a === 'quit') { closeSheet(); toTitle(); }
    if (a === 'shop') { closeSheet(); M.shop(); }
  }));
}
let albumPage = 0;
function stickerImg(st) {
  if (st.model) return ports[st.model] ? `<img alt="" src="${ports[st.model]}">` : `<em>👧</em>`;
  if (st.piece) return `<img alt="" src="${thumb(st.piece, 'orig')}">`;
  return `<em>${st.emoji}</em>`;
}
function openAlbum() {
  const render = () => {
    const list = STICKERS.filter(s => s.page === albumPage), got = list.filter(s => P.stickers.includes(s.id)).length;
    s.querySelector('.pg').innerHTML = `<div class="pgtabs">${PAGES.map((p, i) => `<button class="${i === albumPage ? 'on' : ''}" data-p="${i}">${p}</button>`).join('')}</div>
      <div class="album">${list.map(st => `<div class="stk ${P.stickers.includes(st.id) ? 'got' : ''}">${stickerImg(st)}<span>${st.name}</span></div>`).join('')}</div>
      <div class="pgline">${got} / ${list.length} stickers${P.pages.includes(albumPage) ? ' · page complete 🎉' : ' · complete the page for 150 coins'}</div>`;
    s.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { albumPage = +b.dataset.p; SND.tab(); render(); }));
  };
  const s = openSheet(`<h2>Sticker Album</h2><div class="pg"></div>`); render();
}

// ---------------------------------------------------------------- model + look
function useModel(id) {
  const m = models[id]; if (!m) return;
  if (me && me !== m) { for (const sl of SLOTS) wear(me, sl.key, null); me.object.visible = false; }
  me = m; me.object.visible = true; me.object.position.set(0, 0.12, POSE_Z); me.object.rotation.set(0, 0, 0);
  applyLook(me, look); me.play('idle');
}
function applyLook(m, lk) { for (const sl of SLOTS) { const x = lk[sl.key]; wear(m, sl.key, x ? x.id : null, x ? colourById(x.cw) : null); } }

// ---------------------------------------------------------------- lobby
const lobby = $('lobby');
for (const el of [$('showc'), $('models')]) ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
function renderLobby() {
  const L = curL(), s = makeShow(L);
  $('showc').innerHTML = `<div class="k">${isDaily() ? 'DAILY SHOW · SAME BRIEF FOR EVERYONE TODAY' : s.hard ? `SHOW ${L} · ⚡ HARD SHOW` : `SHOW ${L}`}</div>
    <h2>${s.theme.emoji} ${s.theme.name}</h2><p>${s.theme.line}</p>
    <div class="tags">${s.want.map(t => tagHtml(t)).join('')}${s.ban ? tagHtml(s.ban, 'ban') : ''}<span class="tg">🎨 ${palHtml(s.pal)}</span></div>
    <div class="vsrow">vs ${s.rivals.map(id => MODELS.find(m => m.id === id).name).join(' · ')} · top 2 win · 100 simulated fans vote</div>
    <button class="jbtn" id="playb">Style it! ✨</button>`;
  $('playb').addEventListener('click', e => { e.stopPropagation(); unlock(); if (phase === 'title') startShow(); });
  $('models').innerHTML = `<span class="lab">Your model</span>` + MODELS.map(m => `<button class="${m.id === P.model ? 'on' : ''}" data-m="${m.id}" aria-label="${m.name}">${ports[m.id] ? `<img alt="" src="${ports[m.id]}">` : m.name[0]}</button>`).join('');
  $('models').querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (P.model === b.dataset.m) return; P.model = b.dataset.m; saveP(); SND.pick(MODELS.findIndex(m => m.id === P.model)); useModel(P.model); me.play('wave', { once: true }); renderLobby(); ava(); }));
  const nNew = STICKERS.filter(x => P.stickers.includes(x.id)).length;
  sideButtons([['shop', 'Shop'], ['album', 'Album', ''], ['studio', 'Studio', DECOR.some(d => !P.decor.includes(d.id) && d.cost <= starsLeft()) ? '!' : ''], ['daily', isDaily() ? 'Shows' : 'Daily', isDaily() ? '' : (P.daily.last === ymd() ? '' : '1')]]);
  hud(); requestAnimationFrame(placeLobby);
}
function placeLobby() { const sc = $('showc').getBoundingClientRect(); $('models').style.top = (sc.top - 58) + 'px'; }
function ava() { if (ports[P.model]) $('avaimg').src = ports[P.model]; }
function toTitle() {
  closeSheet(); clearOv(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  setPhase('title'); revived = false; result = null; vote = null; walk = null;
  for (const id of Object.keys(models)) if (models[id] !== me) models[id].object.visible = false;
  look = P.lastLook ? { ...P.lastLook } : {}; useModel(P.model); me.play('idle');
  stage.trophy.visible = false;
  lobby.classList.remove('hide'); $('stylep').classList.add('hide'); $('panel').classList.add('hide'); $('vs').classList.add('hide'); $('top').classList.remove('hide'); side.classList.remove('hide');
  renderLobby(); lobbyCam(true); music('closet');
}

// ---------------------------------------------------------------- the show
function startShow() {
  closeSheet(); unlock(); SND.whoosh();
  show = makeShow(curL()); M.level(show.L);
  look = P.lastLook && !isDaily() ? { ...P.lastLook } : {};
  // keep only what this closet allows
  const av = myAvail(); for (const k of Object.keys(look)) { const x = look[k]; if (!x || !av(pieceById(x.id), colourById(x.cw))) delete look[k]; }
  useModel(P.model);
  // rivals get their outfits + portraits
  show.rivals.forEach((id, i) => { const m = models[id]; applyLook(m, show.rivalLooks[i]); m.object.visible = false; m.play('idle'); show['port' + i] = portrait(m, 128); });
  lobby.classList.add('hide'); setPhase('dress'); t0run = performance.now(); B.start(); P.plays++; saveP(); beatenShown = false; faveRival = -1; tipFor = null;
  $('stylep').classList.remove('hide'); $('panel').classList.remove('hide'); $('vs').classList.remove('hide');
  sideButtons([['shop', 'Shop'], ['tip', 'Tip', P.tips > 0 ? P.tips : ''], ['album', 'Album']]);
  tab = 'top'; renderTabs(); renderCards(); renderRivals(); renderStyle(true); hud();
  requestAnimationFrame(() => { dressCam(true); placeVs(); });
  me.play('wave', { once: true }); setTimeout(() => phase === 'dress' && me.clip === 'wave' && me.play('idle'), 2400);
  music('closet');
}
function placeVs() { const p = $('panel').getBoundingClientRect(); $('vs').style.bottom = (H - p.top + 4) + 'px'; }
function renderRivals() {
  $('rivals').innerHTML = show.rivals.map((id, i) => `<div class="riv" title="${MODELS.find(m => m.id === id).name}"><img alt="" src="${show['port' + i]}"><span class="h">${heartSvg('#ff5fae')}</span></div>`).join('');
}
let lastTotal = 0;
function renderStyle(first = false) {
  const sc = lookScore();
  const el = $('stylep');
  el.innerHTML = `<div class="th">${show.theme.emoji} ${show.theme.name}</div>
    <div class="row"><span class="lab">STYLE</span><span class="num" id="snum">${sc.total}</span></div>
    <div class="bar"><i style="width:${Math.max(4, sc.total)}%"></i><s></s></div>
    <div class="parts"><span>👗 ${sc.fit}/45</span><span>🎨 ${sc.harmony}/35</span><span>✨ ${sc.variety}/20</span></div>
    <div class="tags">${show.want.map(t => `<span class="tg" title="${TAGS[t][1]}">${TAGS[t][0]} ${TAGS[t][1]}</span>`).join('')}${show.ban ? `<span class="tg ban">${TAGS[show.ban][0]}</span>` : ''}<span class="pal">${palHtml(show.pal)}</span></div>`;
  if (!first && sc.total !== lastTotal) {
    const n = $('snum'); n.classList.add('bump'); setTimeout(() => n.classList.remove('bump'), 160);
    if (sc.total > lastTotal) sparkle(V3(0, 1.0, POSE_Z + 0.3), { n: 6 + Math.min(10, sc.total - lastTotal), spread: 0.6, size: 0.09 });
  }
  lastTotal = sc.total;
  return sc;
}
function renderTabs() {
  $('tabs').innerHTML = SLOTS.map(s => `<button class="tab ${s.key === tab ? 'on' : ''}" data-t="${s.key}" aria-label="${s.name}">${IC[s.icon]}${look[s.key] ? '<i></i>' : ''}</button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); unlock(); tab = b.dataset.t; SND.tab(); renderTabs(); renderCards(); }));
}
const prefCw = id => P.cw[id] || 'orig';
function renderCards() {
  const L = curL(), list = PIECES.filter(p => p.slot === tab), cur = look[tab];
  const av = myAvail();
  let html = `<button class="card none ${!cur ? 'on' : ''}" data-id="" aria-label="None">✕</button>`;
  for (const p of list) {
    const unlocked = (p.lvl || 1) <= L, cw = cur && cur.id === p.id ? cur.cw : prefCw(p.id);
    const isNew = unlocked && !P.seen.includes(p.id) && p.lvl > 1;
    html += `<button class="card ${cur && cur.id === p.id ? 'on' : ''} ${unlocked ? '' : 'lock'}" data-id="${p.id}" aria-label="${p.name}"><img alt="" src="${thumb(p.id, av(p, colourById(cw)) ? cw : 'orig')}"><span class="nm">${p.name}</span>${unlocked ? '' : `<span class="lk">🔒 Show ${p.lvl}</span>`}${tipFor && tipFor.slot === tab && tipFor.o && tipFor.o.id === p.id ? '<span class="tip">TIP</span>' : ''}${isNew ? '<span class="new">NEW</span>' : ''}</button>`;
  }
  $('cards').innerHTML = html;
  $('cards').querySelectorAll('.card').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); unlock(); pick(tab, b.dataset.id || null); }));
  renderCols();
}
function renderCols() {
  const cur = look[tab], el = $('cols');
  if (!cur) { el.innerHTML = `<span style="font:600 12px var(--f);color:#9a7ab8;padding:0 6px">Pick a piece, then its colour ✨</span>`; return; }
  const p = pieceById(cur.id), av = myAvail();
  el.innerHTML = COLOURS.map(c => {
    const ok = av(p, c), bq = BOUTIQUE.find(b => b.id === p.id + ':' + c.id), inPal = show.pal.includes(c.fam || p.base);
    return `<button class="sw ${cur.cw === c.id ? 'on' : ''} ${ok ? '' : 'lock'} ${inPal ? 'pal' : ''}" data-c="${c.id}" style="background:${c.css}" aria-label="${c.name}">${!ok && bq ? `<span class="c">${bq.price}</span>` : ''}</button>`;
  }).join('');
  el.querySelectorAll('.sw').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); unlock(); pickColour(b.dataset.c); }));
}
function pick(slot, id) {
  if (phase !== 'dress') return false;
  const L = curL();
  if (id) { const p = pieceById(id); if ((p.lvl || 1) > L) { SND.no(); ui.pop(`Unlocks at Show ${p.lvl}`, '#fff', 22, 62); return false; } }
  if (id && look[slot] && look[slot].id === id) return true;
  const prev = lookScore().total;
  if (!id) { delete look[slot]; wear(me, slot, null); }
  else {
    const p = pieceById(id), av = myAvail(); let cw = prefCw(id); if (!av(p, colourById(cw))) cw = 'orig';
    look[slot] = { id, cw }; wear(me, slot, id, colourById(cw));
    if (p.dress && look.bottom) { delete look.bottom; wear(me, 'bottom', null); }
    if (slot === 'bottom' && look.top && pieceById(look.top.id).dress) { delete look.top; wear(me, 'top', null); }
    if (!P.seen.includes(id)) { P.seen.push(id); saveP(); }
    me.play('excited', { once: true, fade: 0.2 }); clearTimeout(pick.t); pick.t = setTimeout(() => phase === 'dress' && me.play('idle', { fade: 0.4 }), 1700);
  }
  const sc = renderStyle(); SND.pick(Math.max(0, Math.round((sc.total - prev) / 4) + 3)); buzz(8);
  if (sc.total - prev >= 8) ui.pop(['Cute!', 'Slay!', 'Iconic!', 'So fresh!'][Math.floor(Math.random() * 4)], '#fff', 30, 34);
  renderTabs(); renderCards(); return true;
}
function pickColour(cid) {
  const cur = look[tab]; if (!cur || phase !== 'dress') return false;
  const p = pieceById(cur.id), c = colourById(cid), av = myAvail();
  if (!av(p, c)) {
    const bq = BOUTIQUE.find(b => b.id === p.id + ':' + c.id);
    if (bq && (p.lvl || 1) <= curL()) {
      if (M.spend(bq.price, 'colourway')) { P.owned.push(bq.id); saveP(); SND.unlock(); ui.pop(`${c.name} ${p.name} unlocked!`, '#fff', 22, 34); }
      else { SND.no(); M.shop(); return false; }
    } else { SND.no(); ui.pop(`${c.name} unlocks at Show ${c.lvl}`, '#fff', 22, 62); return false; }
  }
  const prev = lookScore().total;
  cur.cw = cid; P.cw[p.id] = cid; saveP(); wear(me, tab, p.id, c);
  const sc = renderStyle(); SND.colour(COLOURS.indexOf(c)); buzz(6);
  sparkle(V3(0, 0.8, POSE_Z + 0.3), { n: 5, color: new THREE.Color(c.css).getHex(), spread: 0.5, size: 0.08 });
  if (sc.total - prev >= 6) ui.pop('Colour match! 🎨', '#fff', 26, 34);
  renderCards(); return true;
}
function useTip() {
  if (phase !== 'dress') return;
  const go = () => {
    const b = bestFor(tab, look, show, myAvail(), isDaily() ? null : P.lastLook);
    tipFor = { slot: tab, o: b.best.find(Boolean) || null };
    if (tipFor.o) { pick(tab, tipFor.o.id); if (look[tab] && look[tab].cw !== tipFor.o.cw) pickColour(tipFor.o.cw); }
    SND.sparkle(); ui.pop('Stylist tip! 💡', '#fff', 28, 34); renderCards();
  };
  if (P.tips > 0) { P.tips--; saveP(); go(); sideButtons([['shop', 'Shop'], ['tip', 'Tip', P.tips > 0 ? P.tips : ''], ['album', 'Album']]); return; }
  if (M.spend(40, 'hint')) { go(); return; }
  M.rewarded('hint', { what: 'A stylist tip: the best piece + colour for this tab' }).then(ok => { if (ok && phase === 'dress') go(); });
}
$('strutbtn').addEventListener('pointerdown', e => e.stopPropagation());
$('strutbtn').addEventListener('click', e => { e.stopPropagation(); unlock(); if (phase === 'dress') startStrut(); });
$('cards').addEventListener('pointerdown', e => e.stopPropagation()); $('tabs').addEventListener('pointerdown', e => e.stopPropagation()); $('cols').addEventListener('pointerdown', e => e.stopPropagation());
$('arrl').addEventListener('click', e => { e.stopPropagation(); $('cards').scrollBy({ left: -$('cards').clientWidth * 0.8, behavior: 'smooth' }); });
$('arrr').addEventListener('click', e => { e.stopPropagation(); $('cards').scrollBy({ left: $('cards').clientWidth * 0.8, behavior: 'smooth' }); });
let drag = null;
R.domElement.addEventListener('pointerdown', e => { if (phase === 'dress' || phase === 'title') drag = { x: e.clientX, r: me.object.rotation.y }; });
addEventListener('pointermove', e => { if (drag && me) me.object.rotation.y = drag.r + (e.clientX - drag.x) * 0.012; });
addEventListener('pointerup', () => { drag = null; });

// ---------------------------------------------------------------- strut (yours), then the rivals walk out
const LINE = [-0.84, -0.28, 0.28, 0.84];
// a camera that fits a group `halfW` metres either side of x=0 and `h` metres tall, centred at (0, cy, z), on any aspect
function fitCam(halfW, h, cy, z, fov = 38, up = 0.18, yo = 0) {
  if (W / H > 1) h = Math.max(h * 1.35, 2.2);
  const t = Math.tan(fov * Math.PI / 360), a = W / H, d = Math.max(halfW / (t * a), h / 2 / t) * 1.08;
  return { pos: V3(0, cy + d * up, z + d), look: V3(0, cy + yo, z), fov };
}
function clearOv() { $('ov').innerHTML = ''; }
function startStrut() {
  closeSheet(); setPhase('strut'); SND.whoosh(); music('run');
  const sc = lookScore(); show.sc = sc;
  $('stylep').classList.add('hide'); $('panel').classList.add('hide'); $('vs').classList.add('hide'); side.classList.add('hide');
  $('ov').innerHTML = `<div id="banner">${show.theme.emoji} ${show.theme.name}<small>Your walk · tap for camera flashes</small></div><button class="jbtn lil" id="skip">Skip ▸</button>`;
  $('skip').addEventListener('pointerdown', e => e.stopPropagation()); $('skip').addEventListener('click', e => { e.stopPropagation(); if (walk && walk.stage === 'me') walk.t = walk.dur; });
  me.object.position.set(0, 0.11, RUN_Z0 - 0.6); me.object.rotation.y = 0; me.play('strut', { fade: 0.1 });
  walk = { stage: 'me', t: 0, dur: 4.6, flashes: 0 };
  stage.harch.visible = true;
}
R.domElement.addEventListener('pointerdown', () => { if (phase === 'strut' && walk && walk.stage === 'me') flashTap(); });
function flashTap() { if (!walk || walk.flashes > 12) return; walk.flashes++; SND.flash(); ui.flash(0.25); const p = me.object.position; sparkle(V3(p.x, 1.0, p.z + 0.3), { n: 6, spread: 0.7, heart: Math.random() < 0.5, size: 0.12 }); }
function updateWalk(dt) {
  const w = walk; w.t += dt;
  if (w.stage === 'me') {
    const k = clamp(w.t / w.dur, 0, 1), z = lerp(RUN_Z0 - 0.6, POSE_Z, k);
    me.object.position.z = z; me.object.position.y = z > -1.25 ? 0.12 : 0.1;
    { const f = fitCam(0.55, 1.45, 0.7, z, 36, 0.1, 0.12); f.pos.x = Math.sin(w.t * 0.5) * 0.3; setCam(f, w.t < 0.05, 4); }
    if (Math.random() < dt * 3) { const s = Math.random() < 0.5 ? -1 : 1; sparkle(V3(s * 1.6, 1.4, z + Math.random()), { n: 3, color: 0xffffff, size: 0.18, up: 0.2 }); SND.flash(); }
    if (k >= 1) { w.stage = 'pose'; w.t = 0; me.play(show.sc.total >= 70 ? 'cheer' : 'wave', { once: true }); SND.cheer(1.6, 0.05 + show.sc.total / 2000); SND.sparkle(); ui.flash(0.35);
      sparkle(V3(0, 1.1, POSE_Z + 0.3), { n: 16, spread: 0.9, heart: true, size: 0.14 }); ui.pop(show.sc.total >= 85 ? 'ICONIC!' : show.sc.total >= 65 ? 'SLAY!' : 'Cute!', '#fff', 46, 30); buzz([15, 30, 15]); }
  } else if (w.stage === 'pose') {
    { const f = fitCam(0.6, 1.7, 0.72, POSE_Z, 34, 0.1); f.pos.x = 0.4; setCam(f, false, 2); }
    if (w.t > 1.6) { w.stage = 'rivals'; w.t = 0; startRivals(); }
  } else if (w.stage === 'rivals') {
    // you step to your mark, rivals walk out one after another
    me.object.position.x = lerp(me.object.position.x, LINE[show.myPos], 1 - Math.exp(-dt * 3));
    if (me.clip !== 'idle' && w.t > 0.8) me.play('idle');
    let done = 0;
    show.rivals.forEach((id, i) => {
      const m = models[id], t0 = i * 0.75, k = clamp((w.t - t0) / 2.6, 0, 1);
      if (w.t < t0) return; if (!m.object.visible) { m.object.visible = true; m.play('strut', { fade: 0.05 }); SND.swish(); }
      const tx = LINE[show.rivalPos[i]];
      m.object.position.set(lerp(0, tx, ease(k)), 0.12, lerp(-3.4, POSE_Z, k));
      m.object.rotation.y = k < 1 ? Math.atan2(tx * 0.6, 1) * (1 - k) : 0;
      if (k >= 1) { done++; if (m.clip === 'strut') { m.play(Math.random() < 0.5 ? 'wave' : 'idle', { once: m.clip !== 'idle' }); sparkle(V3(tx, 1.0, POSE_Z + 0.3), { n: 6, heart: true, spread: 0.4 }); } }
    });
    setCam(fitCam(1.2, 1.8, 0.7, -0.6, 38, 0.16, 0.2), false, 2.2);
    if (done === 3 && w.t > 3.9 && (faveRival >= 0 || w.t > 6.5 || !$('pickq'))) startVote();
  }
}
function startRivals() {
  // lineup order is seeded; you are in the middle-left
  show.myPos = 1; show.rivalPos = [0, 2, 3];
  $('ov').innerHTML = `<div id="banner">Rivals on the runway<small>${show.rivals.map(id => MODELS.find(m => m.id === id).name).join(' · ')}</small></div>
    <div id="pickq"><h3>Which rival will the crowd love most?<small>Guess right for +15 coins · just for fun</small></h3><div class="row">${show.rivals.map((id, i) => `<button class="riv" data-i="${i}"><img alt="" src="${show['port' + i]}"></button>`).join('')}</div></div>`;
  $('pickq').addEventListener('pointerdown', e => e.stopPropagation());
  $('pickq').querySelectorAll('.riv').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); faveGuess(+b.dataset.i); }));
}
function faveGuess(i) {
  if (faveRival >= 0) return; faveRival = i; SND.pick(i + 2);
  const q = $('pickq'); if (q) { q.querySelectorAll('.riv')[i].classList.add('pick'); q.querySelector('h3').innerHTML = `Locked in: ${MODELS.find(m => m.id === show.rivals[i]).name}! 💖<small>Results after the vote</small>`; }
}

// ---------------------------------------------------------------- the simulated vote
function startVote() {
  setPhase('vote'); SND.drum();
  const ents = [{ me: true, m: me, sc: show.sc, look, pos: show.myPos, name: MODELS.find(m => m.id === P.model).name }];
  show.rivals.forEach((id, i) => ents.push({ me: false, m: models[id], sc: lookScore(show.rivalLooks[i]), look: show.rivalLooks[i], pos: show.rivalPos[i], name: MODELS.find(m => m.id === id).name, ri: i }));
  for (const e of ents) e.tags = lookPieces(e.look).flatMap(x => x.p.tags);
  // the vote's randomness is seeded by the show and your look, so replaying the same look gives the same result
  const h = JSON.stringify(look).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const votes = simulateVote(ents, show, rng(show.seed * 13 + h % 100000 + (revived ? 977 : 0)));
  ents.forEach((e, i) => { e.votes = votes[i]; e.shown = 0; });
  const order = [...ents].sort((a, b) => b.votes - a.votes || b.sc.total - a.sc.total); order.forEach((e, i) => e.place = i);
  vote = { ents, order, t: 0, revealed: 0 };
  $('ov').innerHTML = `<div id="banner">The crowd is voting!<small>${FANS} simulated fans · no real players</small></div>` + ents.map((e, i) => `<div class="lbl ${e.me ? 'me' : ''}" id="lb${i}"><span class="rk"></span><span class="hv">💗 <b>0</b></span><span class="nm">${e.me ? 'You' : e.name}</span></div>`).join('') + `<div id="simnote">Simulated vote: fans weigh theme, colour + variety, plus a little luck</div>`;
  setCam(fitCam(1.15, 1.6, 0.78, POSE_Z, 38, 0.1, 0.32), false, 2);
}
const _v = V3();
function updateVote(dt) {
  const v = vote; v.t += dt;
  const fill = clamp((v.t - 0.4) / 2.6, 0, 1);
  v.ents.forEach((e, i) => {
    const target = Math.round(e.votes * ease(fill));
    if (target > e.shown) { if (Math.random() < 0.5) { const sd = stage.fans[Math.floor(Math.random() * stage.fans.length)]; sparkle(sd.sp.position.clone().add(V3(0, 0.6, 0)), { n: 1, heart: true, to: e.m.object.position.clone().add(V3(0, 1.25, 0)), dur: 0.7, size: 0.13 }); } e.shown = target; if (Math.random() < 0.25) SND.heart(i); }
    const el = $('lb' + i); if (!el) return;
    _v.copy(e.m.object.position).add(V3(0, 1.42, 0)).project(cam);
    el.style.left = ((_v.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - _v.y) / 2 * H) + 'px';
    el.querySelector('b').textContent = e.shown;
  });
  // reveal ranks from last to first
  if (fill >= 1) {
    const due = Math.floor((v.t - 3.2) / 0.55) + 1;
    while (v.revealed < Math.min(4, due)) {
      const e = v.order[3 - v.revealed], i = v.ents.indexOf(e), rk = $('lb' + i).querySelector('.rk');
      rk.textContent = ['1st 👑', '2nd', '3rd', '4th'][e.place]; rk.classList.add('on'); SND.rank(e.place); v.revealed++;
      if (e.place === 0) {
        e.m.play('cheer', { once: true }); confetti(scene, e.m.object.position.clone().add(V3(0, 1.4, 0.2)), 70); SND.cheer(2, 0.08); ui.flash(0.4);
        stage.trophy.visible = true; stage.trophy.position.copy(e.m.object.position).add(V3(0, 1.45, 0.1)); v.trophy = e;
        if (e.me) { ui.pop('YOU WIN! 👑', '#fff', 50, 26); SND.win(); buzz([20, 40, 20]); }
      } else if (e.me) e.m.play(e.place <= 2 ? 'wave' : 'idle', { once: e.place <= 2 });
    }
    if (v.trophy) { stage.trophy.rotation.y += dt * 2; stage.trophy.position.y = v.trophy.m.object.position.y + 1.5 + Math.sin(v.t * 3) * 0.04; }
    if (v.revealed >= 4 && v.t > 3.2 + 4 * 0.55 + 1.3 && !v.done) { v.done = true; finish(); }
  }
}

// ---------------------------------------------------------------- result
const winBox = document.createElement('div'); winBox.className = 'resbox'; ui.els.win.appendChild(winBox); ui.els.win.classList.add('res');
const loseBox = document.createElement('div'); loseBox.className = 'resbox'; ui.els.lose.appendChild(loseBox); ui.els.lose.classList.add('res');
const shareBtn = ui.els.win.querySelector('.hc-btn');
for (const box of [winBox, loseBox]) box.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); });
function award(id) { if (P.stickers.includes(id)) return null; P.stickers.push(id); return STICKERS.find(s => s.id === id); }
function finish() {
  const meE = vote.ents[0], place = meE.place, won = place < 2, stars = won ? 3 - place : 0, ms = performance.now() - t0run;
  F.level(won, (4 - place) / 4);
  B.submit(stars, { ms });
  const L = show.L, prev = isDaily() ? 0 : (P.stars[L] || 0);
  let coins = won ? [30, 20][place] : [8, 5][place - 2]; if (isDaily() && won) coins += 25;
  if (faveRival >= 0) { const rv = vote.ents.filter(e => !e.me).sort((a, b) => b.votes - a.votes)[0]; if (rv.ri === faveRival) { coins += 15; result = { spot: true }; } }
  const gifts = [], unl = [], stk = [];
  P.best = Math.max(P.best, meE.sc.total);
  if (won) {
    P.wins++;
    if (isDaily()) {
      const today = ymd(), y = new Date(); y.setDate(y.getDate() - 1); const y2 = new Date(); y2.setDate(y2.getDate() - 2);
      if (P.daily.last !== today) {
        if (P.daily.last === ymd(y)) P.daily.streak++;
        else if (P.daily.last === ymd(y2) && P.daily.freezeWeek !== isoWeek()) { P.daily.streak++; P.daily.freezeWeek = isoWeek(); gifts.push('🧊 Streak freeze used (1 free per week)'); }
        else P.daily.streak = 1;
        P.daily.last = today; P.dailyStars = (P.dailyStars || 0) + stars;
        if (P.daily.streak >= 3) { const s = award('st_streak3'); if (s) stk.push(s); }
      }
    } else {
      if (stars > prev) P.stars[L] = stars;
      if (L === P.level) {
        P.level++;
        for (const p of PIECES) if (p.lvl === P.level) unl.push({ id: p.id, cw: 'orig', name: p.name });
        for (const c of COLOURS) if (c.lvl === P.level) unl.push({ col: c });
        const nt = THEMES.find(t => t.lvl === P.level); if (nt) gifts.push(`New brief: ${nt.emoji} ${nt.name}`);
        if (P.level % 4 === 0) { P.tips++; gifts.push('+1 💡 Stylist tip'); }
      }
    }
    for (const id of ['th_' + show.theme.id, ...vote.ents.filter(e => !e.me && e.place > place).map(e => 'fr_' + e.m.id), ...lookPieces(look).map(x => 'pc_' + x.p.id)]) { const s = award(id); if (s) stk.push(s); }
    P.lastLook = { ...look };
  }
  // full album pages pay out once
  PAGES.forEach((_, pi) => { if (!P.pages.includes(pi) && STICKERS.filter(s => s.page === pi).every(s => P.stickers.includes(s.id))) { P.pages.push(pi); coins += 150; gifts.push(`📒 ${PAGES[pi]} page complete: +150 coins`); } });
  M.add(coins, won ? 'win' : 'show');
  if (!beatenShown && D.beaten(meE.sc.total)) { beatenShown = true; ui.pop('BEATEN!', '#ffe066', 40, 30); }
  saveP(); setPhase('result'); music(null);
  const sc = meE.sc, box = won ? winBox : loseBox;
  const pod = [...vote.order].map(e => `<div class="${e.me ? 'me' : ''}"><img alt="" src="${e.me ? (ports[P.model] || '') : show['port' + e.ri]}"><b>${['1st', '2nd', '3rd', '4th'][e.place]}</b>${e.me ? 'You' : e.name}<br>💗 ${e.votes} · ${e.sc.total}</div>`).join('');
  const bar = (v, mx) => `<span class="bar"><i style="width:${v / mx * 100}%"></i></span>`;
  box.innerHTML = `<div class="rt">${isDaily() ? 'DAILY SHOW' : `SHOW ${L}`} · ${show.theme.emoji} ${show.theme.name.toUpperCase()}</div>
    <h2>${won ? ['Runway Queen!', 'So Stylish!'][place] : place === 2 ? 'So close!' : 'Almost!'}</h2>
    ${won ? '<div class="stars"><span>★</span><span>★</span><span>★</span></div>' : `<div style="font:600 13px var(--f);margin:6px 0;color:#8a5fb0">${place === 2 ? '3rd' : '4th'} place: the top 2 go through. Try more ${show.want.map(t => TAGS[t][0]).join(' ')} pieces in ${show.pal.map(f => `<span class="dot" style="background:${FAMS[f]};width:11px;height:11px"></span>`).join('')} colours.</div>`}
    <div class="podium">${pod}</div>
    <div class="rl"><span>👗 Theme fit</span>${bar(sc.fit, 45)}<b>${sc.fit}</b></div>
    <div class="rl"><span>🎨 Colour</span>${bar(sc.harmony, 35)}<b>${sc.harmony}</b></div>
    <div class="rl"><span>✨ Variety</span>${bar(sc.variety, 20)}<b>${sc.variety}</b></div>
    <div class="rl tot"><span>Style score</span><b>${sc.total}</b></div>
    <div class="rl"><span>Coins</span><b><span class="coinic" style="display:inline-block;vertical-align:-6px"></span> +${coins}${result && result.spot ? ' (incl. +15 trend spotter)' : ''}</b></div>
    ${unl.length ? `<div style="font:700 13px var(--f);margin-top:8px;color:#c05a90">NEW IN YOUR CLOSET</div><div class="unl">${unl.map(x => x.col ? `<div><span class="dot" style="background:${x.col.css};width:44px;height:44px;margin:6px auto 4px;display:block;border-width:4px"></span>${x.col.name}</div>` : `<div><img alt="" src="${thumb(x.id, 'orig')}">${x.name}</div>`).join('')}</div>` : ''}
    ${stk.length ? `<div style="font:700 13px var(--f);margin-top:8px;color:#c05a90">NEW STICKERS</div><div class="unl">${stk.slice(0, 6).map(s => `<div class="stk got" style="width:52px;height:52px;margin:0 auto 12px">${stickerImg(s)}</div>`).join('')}</div>` : ''}
    ${gifts.map(g => `<div class="gift">🎁 ${g}</div>`).join('')}
    <div class="rbtns"></div><div class="slot"></div><div class="tapc">Tap to continue</div>`;
  const btns = box.querySelector('.rbtns');
  if (won) {
    D.won(sc.total, 'styled');
    const dbl = document.createElement('button'); dbl.className = 'jbtn mint'; dbl.innerHTML = `×2 coins<small>watch a short video</small>`;
    dbl.addEventListener('click', async e => { e.stopPropagation(); dbl.disabled = true; if (await M.rewarded('double', { what: `${coins} more coins (${coins * 2} total)` })) { M.add(coins, 'double'); SND.coin(0); coinFly(8); dbl.remove(); } else dbl.disabled = false; });
    btns.appendChild(dbl);
    if (isDaily()) {
      if (shareBtn) shareBtn.style.display = 'none';
      const sh = document.createElement('button'); sh.className = 'jbtn lil'; sh.innerHTML = `Share grid<small>no spoilers</small>`;
      sh.addEventListener('click', e => { e.stopPropagation(); shareGrid(meE); }); btns.appendChild(sh);
    } else if (shareBtn) { shareBtn.style.display = ''; box.querySelector('.slot').appendChild(shareBtn); }
    ui.win(L, '');
    const ss = box.querySelectorAll('.stars span'); for (let i = 0; i < stars; i++) setTimeout(() => { ss[i].classList.add('on'); SND.star(i); buzz(10); }, 900 + i * 360);
    setTimeout(() => coinFly(Math.min(10, 3 + Math.round(coins / 8))), 700);
  } else {
    SND.lose(); ui.lose('Almost!', '');
    // one offer on the lose card, shown after the iOS app's own card window (1.2 s)
    if (!revived) setTimeout(() => {
      if (phase !== 'result') return;
      const enc = document.createElement('button'); enc.className = 'jbtn'; enc.innerHTML = `Encore! Restyle & re-walk<small>watch a short video · same rivals</small>`;
      enc.addEventListener('click', async e => { e.stopPropagation(); enc.disabled = true; if (await M.rewarded('revive', { what: 'Restyle this same show and walk again (rivals stay the same)' })) encore(); else enc.disabled = false; });
      btns.appendChild(enc);
    }, 1300);
  }
}
function encore() {
  revived = true; ui.els.lose.classList.add('hc-hidden'); clearOv(); stage.trophy.visible = false;
  for (const id of show.rivals) { models[id].object.visible = false; }
  useModel(P.model); setPhase('dress'); vote = null; walk = null; faveRival = -1;
  $('stylep').classList.remove('hide'); $('panel').classList.remove('hide'); $('vs').classList.remove('hide'); side.classList.remove('hide');
  renderTabs(); renderCards(); renderStyle(true); requestAnimationFrame(() => { dressCam(true); placeVs(); }); music('closet');
}
function coinFly(n) {
  const tg = $('coinp').getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = '<span class="coinic" style="display:block"></span>';
    d.style.transform = `translate(${W / 2 + (Math.random() - 0.5) * 140}px,${H * 0.5 + (Math.random() - 0.5) * 90}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${tg.left + 8}px,${tg.top + 5}px) scale(.8)`; d.style.opacity = '0.3'; }, 60 + i * 55);
    setTimeout(() => { d.remove(); SND.coin(i); }, 780 + i * 55);
  }
}
async function shareGrid(meE) {
  const sq = (v, mx) => { const n = Math.round(v / mx * 5); return '💖'.repeat(n) + '🤍'.repeat(5 - n); };
  const d = new Date(), txt = `Glowfit Runway · Daily ${d.toISOString().slice(0, 10)}\n${['🥇', '🥈', '🥉', '4️⃣'][meE.place]} Style ${meE.sc.total}\n👗 ${sq(meE.sc.fit, 45)}\n🎨 ${sq(meE.sc.harmony, 35)}\n✨ ${sq(meE.sc.variety, 20)}\n🔥 ${P.daily.streak}-day streak`;
  const u = new URL(location.href); u.search = '?daily=1';
  try { if (navigator.share) { await navigator.share({ title: 'Glowfit Runway', text: txt, url: u.href }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(txt + '\n' + u.href); ui.pop('Copied!', '#fff', 28, 30); } catch (e) {}
}
ui.onTap(async which => {
  unlock();
  if (which === 'start') return;
  if (which === 'win' && !isDaily()) await M.breakAd('level-end', { level: show ? show.L : P.level });
  toTitle();
});

// ---------------------------------------------------------------- Glow Studio (meta: decorate with stars)
function studioCam(cut = false) {
  const r = { x0: 0, x1: W, y0: 70, y1: H - ($('studiop')?.getBoundingClientRect().height || 300) };
  setCam(frame(V3(STUDIO.x, 0.9, STUDIO.z - 0.2), 2.6, r, V3(0.25, 0.45, 1), 34, 0.95, 1.35), cut);
}
function toStudio() {
  closeSheet(); setPhase('studio'); lobby.classList.add('hide'); side.classList.add('hide');
  const p = document.createElement('div'); p.id = 'studiop'; document.body.appendChild(p);
  ['pointerdown', 'pointerup', 'click'].forEach(ev => p.addEventListener(ev, e => e.stopPropagation()));
  renderStudio(); requestAnimationFrame(() => studioCam(true));
}
function renderStudio() {
  const p = $('studiop'); if (!p) return;
  const done = P.decor.length;
  p.innerHTML = `<button class="x" aria-label="Back">✕</button><h2>Glow Studio ${done}/${DECOR.length}</h2>
    <div style="text-align:center;font:600 13px var(--f);color:#8a5fb0;margin:-2px 0 8px">Win shows for ⭐ stars, spend them to decorate. You have ⭐ ${starsLeft()}</div>
    <div class="decor">${DECOR.map(d => { const own = P.decor.includes(d.id), ok = starsLeft() >= d.cost; return `<button class="dec ${own ? 'done' : ok ? '' : 'no'}" data-d="${d.id}"><img alt="" src="${thumb(d.id, 'orig')}">${d.name}<br><b>${own ? '✓ Placed' : `⭐ ${d.cost}`}</b></button>`; }).join('')}</div>`;
  p.querySelector('.x').addEventListener('click', () => { SND.tap(); p.remove(); toTitle(); });
  p.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => buyDecor(b.dataset.d)));
}
function buyDecor(id) {
  const d = DECOR.find(x => x.id === id); if (P.decor.includes(id)) return;
  if (starsLeft() < d.cost) { SND.no(); ui.pop('Win shows for more ⭐', '#fff', 24, 30); return; }
  P.spent += d.cost; P.decor.push(id); saveP(); placeDecor(d, true); SND.unlock(); buzz(15);
  if (P.decor.length === DECOR.length) { const s = award('fr_k06'); const s2 = award('fr_k07'); saveP(); ui.pop('Studio complete! 🎉', '#fff', 34, 26); }
  renderStudio(); hud();
}
function placeDecor(d, anim) {
  if (studioMeshes[d.id]) return;
  const m = propMesh(d.id); m.scale.setScalar(anim ? 0.01 : d.size); m.position.set(STUDIO.x + d.pos[0], d.pos[1], STUDIO.z + d.pos[2]); m.rotation.y = d.rot; m.receiveShadow = true;
  scene.add(m); studioMeshes[d.id] = m;
  if (anim) { m.userData.grow = { t: 0, s: d.size }; sparkle(m.position.clone().add(V3(0, d.size * 0.5, 0)), { n: 18, spread: 0.8, size: 0.12 }); SND.sparkle(); }
}

// ---------------------------------------------------------------- test hooks + bot (paced like a person)
let botQ = null, botWait = 0;
window.__game = {
  perf: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geo: R.info.memory.geometries, tex: R.info.memory.textures }),
  get state() { return phase === 'loading' || phase === 'title' || phase === 'studio' ? 'ready' : phase === 'result' ? (vote && vote.ents[0].place < 2 ? 'won' : 'lost') : 'play'; },
  get phase() { return phase; },
  get level() { return curL(); }, get score() { return totalStars(); }, get style() { return show && phase === 'dress' ? lookScore().total : null; },
  get look() { return look; }, get coins() { return M.coins(); },
  start: () => phase === 'title' && startShow(),
  bot() {
    if (phase === 'loading' || sheetEl) { closeSheet(); return; }
    if (phase === 'studio') { const d = DECOR.find(x => !P.decor.includes(x.id) && x.cost <= starsLeft()); if (d) buyDecor(d.id); else { $('studiop')?.remove(); toTitle(); } return; }
    if (phase === 'title') { if (DECOR.some(x => !P.decor.includes(x.id) && x.cost <= starsLeft()) && Math.random() < 0.3) { toStudio(); return; } startShow(); botQ = null; return; }
    if (phase === 'dress') {
      if (botWait-- > 0) return;
      if (!botQ) {
        botQ = []; const sim = { ...look };
        for (const s of SLOTS) {
          const b = bestFor(s.key, sim, show, myAvail(), isDaily() ? null : P.lastLook);
          const o = Math.random() < 0.85 ? b.best[Math.floor(Math.random() * b.best.length)] : null;
          if (o === undefined) continue;
          if (o) { sim[s.key] = o; if (pieceById(o.id).dress) delete sim.bottom; botQ.push(['tab', s.key], ['pick', s.key, o.id], ['col', s.key, o.cw]); }
        }
        botQ.push(['strut']);
      }
      const a = botQ.shift(); botWait = 1 + Math.floor(Math.random() * 3);
      if (!a) return;
      if (a[0] === 'tab') { tab = a[1]; renderTabs(); renderCards(); }
      else if (a[0] === 'pick') pick(a[1], a[2]);
      else if (a[0] === 'col') { tab = a[1]; if (look[a[1]] && look[a[1]].cw !== a[2]) pickColour(a[2]); }
      else { botQ = null; startStrut(); }
      return;
    }
    if (phase === 'strut' && walk && walk.stage === 'rivals' && faveRival < 0 && walk.t > 1.5) faveGuess(Math.floor(Math.random() * 3));
    if (phase === 'strut' && walk && walk.stage === 'me' && Math.random() < 0.15) flashTap();
  },
};

// ---------------------------------------------------------------- loop
loop(dt60 => {
  const dt = Math.min(0.05, dt60 / 60); T += dt;
  if (stage) {
    if (phase === 'strut') updateWalk(dt); else if (phase === 'vote') updateVote(dt);
    else if ((phase === 'dress' || phase === 'title') && me && !drag) me.object.rotation.y *= 1 - Math.min(1, dt * 1.5);
    stage.update(dt, T, phase === 'strut' || phase === 'vote' ? 1 : 0.35);
    for (const m of Object.values(models)) if (m.object.visible) m.mixer.update(dt);
    for (const m of Object.values(studioMeshes)) if (m.userData.grow) { const g = m.userData.grow; g.t += dt; const k = clamp(g.t / 0.5, 0, 1); m.scale.setScalar(g.s * (k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1) * Math.max(0.01, ease(k))); if (k >= 1) delete m.userData.grow; }
    const f = phase === 'studio' ? STUDIO : me ? me.object.position : V3();
    sun.target.position.set(f.x, 0, f.z); sun.position.set(f.x + 2.5, 7, f.z + 6);
  }
  updateSprites(dt); updateCam(dt);
  R.info.reset(); C.render(dt);
});

// ---------------------------------------------------------------- boot
(async function boot() {
  ui.hideStart(); setPhase('loading'); setMuted(P.mute);
  const PROP_IDS = ['w01', 'w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w09', 'w10', 'w11', 'r05', 'b01', 'b02', 'x04', 't09', 't01', ...DECOR.map(d => d.id)];
  let n = 0; const tot = PROP_IDS.length + MODELS.length;
  const prog = () => { n++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(n / tot * 100) + '%'; };
  try {
    await Promise.all(PROP_IDS.map(id => loadProp(id).then(prog)));
    buildCodePieces();
    await Promise.all(MODELS.map(m => loadChar(m.id).then(g => { const md = createModel(m.id, g); md.object.visible = false; scene.add(md.object); models[m.id] = md; prog(); })));
    stage = buildStage(scene); studio = buildStudio(scene);
    for (const d of DECOR) if (P.decor.includes(d.id)) placeDecor(d, false);
    // portraits + crowd billboards rendered in-engine from the real models
    const crowd = [];
    for (const m of MODELS) {
      const md = models[m.id]; md.play('idle'); md.mixer.update(0.3); ports[m.id] = portrait(md, 160);
      for (const [clip, t] of [['cheer', 0.9], ['excited', 2.2]]) {
        md.play(clip); md.mixer.setTime(t);
        crowd.push(new THREE.CanvasTexture(snap(md.object, { w: 192, h: 192, center: V3(0, 0.82, 0), height: 1.02, dir: V3(0, 0.08, 1), fov: 24 })));
      }
      md.play('idle'); md.mixer.setTime(0);
    }
    crowd.forEach(t => { t.colorSpace = THREE.SRGBColorSpace; });
    stage.setCrowd(crowd);
    scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.castShadow) { o.geometry.computeBoundingSphere?.(); if (o.geometry.boundingSphere && o.geometry.boundingSphere.radius * o.scale.x < 0.2) o.castShadow = false; } });
  } catch (e) { console.warn('boot', e); const l = document.querySelector('#load small'); if (l) l.textContent = 'Could not load the runway. Check your connection and reload.'; return; }
  if (!models[P.model]) P.model = 'k01';
  ava(); toTitle();
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 600);
})();

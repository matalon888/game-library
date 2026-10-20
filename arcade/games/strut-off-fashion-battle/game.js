// Strut Off: Fashion Battle — original dress-up style battle. Each challenge has a theme that wants two style tags and
// bans one; the player styles their model (colour, fabric, head, face, back, hand) in the atelier, struts the runway,
// times the end-of-runway pose, then three rival models walk and the audience votes. Same scoring for everyone (data.js).
// Art: Hero Lab characters (player's own hero via the hero bar, rivals, judges), AI 3D props (s/t/h library), sets in code.
import { THREE, createUI, store, loop, buzz, confetti, clamp, lerp, rng } from './kit/hc.js';
import { cine } from './kit/cine.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { heroBar, selectedHero, onHeroesChange, heroName } from './kit/heroes.js';
import { TAGS, COLOURS, FINISHES, ITEMS, SLOTS, ACC, THEMES, RULES, VENUES, RIVALS, JUDGES, MODEL_DEFAULT, LOCAL_CHARS, rankOf, score, bestFor, itemById, colourById, finishById } from './data.js';
import { initDress, loadProps, createModel, proto, itemThumb, tickDress, withTimeout } from './dress.js';
import { buildStage, RUN_Y, RUN_Z0, POSE_Z, ATL } from './stage.js';
import { S as SND, music, setMuted, unlock } from './audio.js';

const NAME = 'Strut Off: Fashion Battle', KEY = 'strut-off';
const Q = new URLSearchParams(location.search);
const ST = store(KEY);
const P = Object.assign({ level: 1, stars: {}, gems: 0, owned: [], tips: 2, spots: 1, mute: false, best: 0, seen: [], plays: 0 }, ST.get('p', {}));
const saveP = () => { try { ST.set('p', P); } catch (e) {} };
const $ = id => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const totalStars = () => Object.values(P.stars).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- renderer + post
const LITE = Q.has('lite') || (Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5);
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.info.autoReset = false; R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 120);
const C = cine(R, scene, cam, { bloom: 0.22, bloomThreshold: 1.6, bloomRadius: 0.4, exposure: 0.96, envIntensity: 0.5, lite: LITE, grade: { sat: 1.15, contrast: 1.05, vignette: 0.1, grain: 0 } });
const hemi = new THREE.HemisphereLight(0xfff2f6, 0xc29aa8, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0e4, 2.1); sun.position.set(4, 10, 7);
sun.castShadow = true; sun.shadow.mapSize.set(C.lite ? 1024 : 2048, C.lite ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xffe4f0, 0.7); fill.position.set(-5, 4, 9); scene.add(fill, fill.target);
const limbo = new THREE.Group(); limbo.visible = false; scene.add(limbo);    // detached things live here (the kit frees orphans)

// ---------------------------------------------------------------- kit layers
const ui = createUI({ title: 'Strut Off', hint: '', hand: '' });
const D = daily(KEY, ui, { name: NAME });
const B = board({ game: 'strut-off', label: 'Stars earned', mode: 'sum', limits: { maxRun: 3, maxPerSec: 1 }, corner: 'tl', accent: '#ff4f97' });
const F = flow(KEY);
const OV = $('ov');

// ---------------------------------------------------------------- loading
const loader = new GLTFLoader();
initDress(THREE, GLTFLoader);
const PROP_IDS = ['s02', 's03', 's04', 's05', 'h05', 'h06', 'h13', 'h17', 'h26', 'h27', 't12', 't14', 't15', 't24', 't28'];
let loaded = 0; const toLoad = PROP_IDS.length + LOCAL_CHARS.length + 1;
const prog = () => { loaded++; const b = document.querySelector('#load i'); if (b) b.style.width = Math.round(loaded / toLoad * 100) + '%'; };
function place(id, { size = 1, pos = [0, 0, 0], rot = 0, parent = scene } = {}) {
  const o = proto(id).clone(); o.scale.setScalar(size); o.position.set(pos[0], pos[1], pos[2]); o.rotation.y = rot; parent.add(o); return o;
}

// ---------------------------------------------------------------- state
let phase = 'loading', W = innerWidth, H = innerHeight, T = 0, slow = 1, slowT = 0, shake = 0;
let stage = null, me = null, rivalModels = {}, judges = [], trophy = null;
let ch = null, tab = 'colour', tipOn = false, spotOn = false, picks = 0;
let walk = null, montage = null, vote = null, result = null, t0run = 0, beatenShown = false;
const curL = () => (D.seed ? 15 : P.level);
const availL = () => (D.seed ? 15 : P.level);
const hasPiece = x => (x.gem ? P.owned.includes(x.id) : (x.lvl || 1) <= availL());

// ---------------------------------------------------------------- challenge generation (seeded)
function makeChallenge(L) {
  const seed = D.seed ? D.seed : L * 7919 + 17, r = rng(seed);
  const AL = D.seed ? 15 : L;
  const pool = THEMES.filter(t => t.lvl <= AL), debut = THEMES.find(t => t.lvl === L && !D.seed);
  let theme = debut || pool[Math.floor(r() * pool.length)];
  if (!debut && L > 1 && !D.seed) { const prev = makeTheme(L - 1); if (prev === theme.id) theme = pool[(pool.indexOf(theme) + 1) % pool.length]; }
  const rule = !debut && L >= 6 && r() < 0.45 ? RULES[Math.floor(r() * RULES.length)] : null;
  const venue = D.seed ? VENUES[Math.floor(r() * VENUES.length)] : VENUES[Math.floor((L - 1) / 8) % VENUES.length];
  const used = new Set(me ? [me.id] : []), rivals = [];
  const cand = RIVALS.filter(x => !used.has(x.id));
  while (rivals.length < 3) { const x = cand[Math.floor(r() * cand.length)]; if (!rivals.includes(x)) rivals.push(x); }
  // rival skill: how often a rival picks the best piece for each part of the look (same rules and wardrobe as you)
  const skill = clamp((L <= 3 ? 0.08 + L * 0.04 : 0.16 + (L - 3) * 0.02) * F.k(), 0.06, 0.9);
  const pose = theme.want.some(t => ['party', 'sporty', 'street'].includes(t)) ? 'jump' : theme.want.includes('edgy') ? 'slide' : 'cheer';
  const c = { L, seed, theme, want: theme.want, ban: theme.ban, rule, venue, rivals, skill, pose, r, AL };
  c.rivalLooks = rivals.map(rv => genOutfit(r, c, rv.id));
  c.rivalPose = rivals.map(() => { const x = r(); return x < skill * 0.75 ? 12 : x < 0.55 + skill * 0.3 ? 8 : 4; });
  c.noise = [0, 1, 2, 3].map(() => Math.floor(r() * 10));
  return c;
}
function makeTheme(L) { const r = rng(L * 7919 + 17), pool = THEMES.filter(t => t.lvl <= L), d = THEMES.find(t => t.lvl === L); return (d || pool[Math.floor(r() * pool.length)]).id; }
function genOutfit(r, c, charId) {
  const sig = rivalModels[charId]?.sigTags || [];
  const avail = x => (x.gem ? r() < c.skill * 0.4 : (x.lvl || 1) <= c.AL + 2);
  const o = {};
  for (const slot of ['colour', 'finish', ...ACC]) {
    const list = slot === 'colour' ? COLOURS : slot === 'finish' ? FINISHES : ITEMS.filter(i => i.slot === slot);
    if (ACC.includes(slot) && r() < 0.28 * (1 - c.skill)) { o[slot] = null; continue; }
    if (r() < c.skill) { const b = bestFor(slot, c, avail, sig).best; o[slot] = b.length ? b[Math.floor(r() * b.length)].id : null; }
    else { const a = list.filter(x => avail(x)); o[slot] = a.length ? a[Math.floor(r() * a.length)].id : null; }
  }
  if (c.rule && !o[c.rule.slot] && r() < 0.4 + c.skill) { const a = ITEMS.filter(i => i.slot === c.rule.slot && avail(i)); o[c.rule.slot] = a[Math.floor(r() * a.length)]?.id || null; }
  return o;
}

// ---------------------------------------------------------------- camera
const camS = { pos: V3(0, 3, 12), look: V3(0, 1, 0), fov: 32, off: [0, 0] }, camG = { pos: V3(0, 3, 12), look: V3(0, 1, 0), fov: 32, off: [0, 0] };
let camCut = true, camK = 3.5;
function setCam(pos, look, fov = 32, off = [0, 0], cut = false, k = 3.5) { camG.pos.copy(pos); camG.look.copy(look); camG.fov = fov; camG.off = off; if (cut) camCut = true; camK = k; }
// put a subject of `h` metres centred at `c` into screen region r (px), seen from direction dir
function frame(c, h, r, dir = V3(0, 0.12, 1), fov = 30, fill = 0.86) {
  const hr = Math.max(80, r.y1 - r.y0), d = h * H / (fill * hr * 2 * Math.tan(fov * Math.PI / 360));
  const wr = Math.max(80, r.x1 - r.x0), dw = (h * 0.62) * W / (0.9 * wr * 2 * Math.tan(fov * Math.PI / 360) * (W / H));
  const dist = Math.max(d, dw);
  const pos = c.clone().add(dir.clone().normalize().multiplyScalar(dist));
  return { pos, look: c.clone(), fov, off: [-((r.x0 + r.x1) / 2 - W / 2), -((r.y0 + r.y1) / 2 - H / 2)] };
}
function updateCam(dt) {
  const k = camCut ? 1 : 1 - Math.exp(-dt * camK);
  camS.pos.lerp(camG.pos, k); camS.look.lerp(camG.look, k); camS.fov = lerp(camS.fov, camG.fov, k);
  camS.off[0] = lerp(camS.off[0], camG.off[0], k); camS.off[1] = lerp(camS.off[1], camG.off[1], k); camCut = false;
  cam.position.copy(camS.pos);
  if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 0.5); }
  cam.lookAt(camS.look);
  cam.fov = camS.fov; cam.setViewOffset(W, H, camS.off[0], camS.off[1], W, H); cam.updateProjectionMatrix();
}
function resize() { W = innerWidth; H = innerHeight; R.setSize(W, H); cam.aspect = W / H; C.resize(W, H); if (phase === 'dress') dressCam(true); if (phase === 'title') lobbyCam(true); }
addEventListener('resize', resize);
const region = (top, bottom) => ({ x0: 0, x1: W, y0: top, y1: H - bottom });

// ---------------------------------------------------------------- sprites (sparkles, hearts)
const mkTex = draw => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const starT = mkTex(x => { x.translate(32, 32); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 30, a = i / 8 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); });
const heartT = mkTex(x => { x.fillStyle = '#ff4f97'; x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 6, 8, 24, 10); x.bezierCurveTo(30, 11, 32, 18, 32, 20); x.bezierCurveTo(32, 18, 34, 11, 40, 10); x.bezierCurveTo(58, 8, 60, 34, 32, 54); x.closePath(); x.stroke(); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(22, 20, 6, 4, -0.6, 0, 7); x.fill(); });
const SPR = [];
for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); SPR.push({ s, life: 0 }); }
function sparkle(pos, { n = 8, color = 0xfff1a8, size = 0.16, up = 1.2, spread = 0.4, life = 0.8, heart = false, to = null, dur = 1 } = {}) {
  for (let k = 0; k < n; k++) {
    const p = SPR.find(q => q.life <= 0); if (!p) return;
    p.s.material.map = heart ? heartT : starT; p.s.material.color.set(heart ? 0xffffff : color); p.s.material.blending = heart ? THREE.NormalBlending : THREE.AdditiveBlending;
    p.s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.5, pos.z + (Math.random() - 0.5) * spread);
    p.v = V3((Math.random() - 0.5) * spread * 2, up * (0.6 + Math.random() * 0.7), (Math.random() - 0.5) * spread * 2);
    p.life = p.max = (to ? dur : life) * (0.85 + Math.random() * 0.3); p.size = size * (0.7 + Math.random() * 0.6); p.s.visible = true; p.heart = heart;
    p.from = to ? p.s.position.clone() : null; p.to = to ? to.clone() : null; p.arc = 1.2 + Math.random();
  }
}
function updateSprites(dt) {
  for (const p of SPR) {
    if (p.life <= 0) continue; p.life -= dt; const k = 1 - p.life / p.max;
    if (p.to) { p.s.position.lerpVectors(p.from, p.to, ease(k)); p.s.position.y += Math.sin(k * Math.PI) * p.arc; p.s.scale.setScalar(p.size * (0.6 + Math.sin(k * Math.PI) * 0.6)); p.s.material.opacity = Math.min(1, (1 - k) * 4); }
    else { p.s.position.addScaledVector(p.v, dt); p.v.y -= dt * 1.4; const sc = p.size * (1 - k * 0.5); p.s.scale.setScalar(sc); p.s.material.opacity = Math.min(1, (1 - k) * 2); p.s.material.rotation = k * 3; }
    if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; if (p.onEnd) { p.onEnd(); p.onEnd = null; } }
  }
}

// ---------------------------------------------------------------- the player's model (their Hero Lab hero, or Rouge)
let meTok = 0;
async function buildMe() {
  const tok = ++meTok; let h = selectedHero();
  let m = null;
  try { m = await withTimeout(createModel(h ? h.char : MODEL_DEFAULT.id, { height: 1.75, sig: h ? { hue: h.hue, sat: h.sat, bri: h.bri } : null }), 20000, 'hero'); }
  catch (e) { console.warn('model', e && e.message); if (h) { try { m = await withTimeout(createModel(MODEL_DEFAULT.id, { height: 1.75 }), 20000, 'model'); h = null; } catch (e2) {} } }
  if (!m) return;
  if (tok !== meTok) return;
  m.name = h ? heroName(h) : MODEL_DEFAULT.name; m.thumb = h ? (h.thumb || `./assets/thumbs/${LOCAL_CHARS.includes(h.char) ? h.char : MODEL_DEFAULT.id}.webp`) : `./assets/thumbs/${MODEL_DEFAULT.id}.webp`;
  const old = me; me = m; scene.add(m.object);
  if (old) { m.object.position.copy(old.object.position); m.object.rotation.y = old.object.rotation.y; await m.wear(old.outfit); limbo.add(old.object); old.object.visible = false; }
  else m.object.position.set(0, RUN_Y, POSE_Z);
  m.play('idle');
  if (phase === 'title') { renderLobby(); m.play('cheer'); }
  if (phase === 'dress') renderItems();
}

// ---------------------------------------------------------------- lobby (start card)
const startEl = ui.els.start;
const lob = document.createElement('div'); lob.className = 'lob'; startEl.appendChild(lob);
lob.innerHTML = `<div class="top"><span class="pill" id="rankp"></span></div>
  <div class="logo"><b>Strut <em>Off</em></b><span>FASHION BATTLE</span></div>
  <div class="journey" id="journey"></div>
  <div class="lspace" id="lspace"></div>
  <div class="chal" id="chal"></div>
  <div class="herowrap" id="herowrap"></div>
  <div class="prow"><button class="btn sbtn" data-open="closet">👗<small>Closet</small><b hidden></b></button><button class="btn playbtn" id="playbtn">Strut!</button><button class="btn sbtn" data-open="shop">💎<small>Boutique</small><b hidden></b></button></div>`;
const sheet = document.createElement('div'); sheet.className = 'sheet'; sheet.hidden = true; document.body.appendChild(sheet);
for (const el of [lob.querySelector('#journey'), lob.querySelector('#chal'), sheet]) ['pointerdown', 'pointerup'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
for (const b of lob.querySelectorAll('.sbtn')) { b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); unlock(); SND.tap(); openSheet(b.dataset.open); }); }
heroBar({ parent: $('herowrap'), title: 'Your model', noneLabel: 'Rouge', noneIcon: '💃', onPick: () => buildMe() });
onHeroesChange(() => buildMe());

const tagHtml = (t, cls = '') => `<span class="tag ${cls}">${TAGS[t][0]} ${TAGS[t][1]}</span>`;
const chalTags = c => `${c.want.map(t => tagHtml(t, 'want')).join('')}${tagHtml(c.ban, 'ban')}${c.rule ? `<span class="tag rule">📌 ${c.rule.text}</span>` : ''}`;
function renderLobby() {
  const L = curL(), c = makeChallenge(L);
  $('rankp').innerHTML = `⭐ ${totalStars()} · ${rankOf(totalStars())}`;
  $('chal').innerHTML = `<div class="em">${c.theme.emoji}</div><div><h3>${D.seed ? 'Daily Show' : `Show ${L}`} · ${c.theme.name}</h3><p>${c.theme.line} <br>📍 ${c.venue.name}</p><div class="tags">${chalTags(c)}</div></div>`;
  $('playbtn').innerHTML = `Strut! ▶<small>${D.seed ? 'Daily challenge' : `vs ${c.rivals.map(r => r.name.split(' ')[0]).join(', ')}`}</small>`;
  const J = $('journey'), top = Math.max(P.level + 4, 10);
  J.innerHTML = Array.from({ length: top }, (_, i) => { const d = i + 1, st = P.stars[d] || 0, ven = (d - 1) % 8 === 0; return `<div class="jd ${d === P.level ? 'cur' : d > P.level ? 'lock' : ''} ${ven ? 'ven' : ''}" data-v="${ven ? '📍' : ''}">${d}${d < P.level || st ? `<i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i>` : ''}</div>`; }).join('');
  requestAnimationFrame(() => { const cu = J.querySelector('.cur'); if (cu) J.scrollLeft = Math.max(0, cu.offsetLeft - J.offsetLeft - J.clientWidth / 2 + 24); });
  const nShop = ITEMS.filter(i => i.gem && !P.owned.includes(i.id) && i.gem <= P.gems).length;
  const sb = lob.querySelectorAll('.sbtn b'); sb[1].textContent = nShop; sb[1].hidden = !nShop;
  const nNew = allPieces().filter(x => hasPiece(x) && !P.seen.includes(x.id)).length; sb[0].textContent = nNew; sb[0].hidden = !nNew;
  $('gemn').textContent = P.gems;
  if (stage) { stage.setVenue(c.venue); }
}
const allPieces = () => [...COLOURS.filter(c => c.id !== 'sig'), ...FINISHES, ...ITEMS];
function openSheet(which) {
  sheet.hidden = false;
  const shop = which === 'shop';
  const list = shop ? ITEMS.filter(i => i.gem) : allPieces();
  const have = allPieces().filter(hasPiece).length;
  sheet.innerHTML = `<div class="shop"><h2>${shop ? '💎 Boutique' : '👗 Closet'}<button class="btn x">✕</button></h2>
    <div class="sub">${shop ? `Designer pieces for gems. You have <span class="gem"></span> ${P.gems}` : `${have}/${list.length} pieces collected · new ones arrive as you climb the show ladder`}</div>
    <div class="grid">${list.map(x => cardHtml(x, shop)).join('')}</div></div>`;
  sheet.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); sheet.hidden = true; SND.tap(); renderLobby(); });
  sheet.addEventListener('click', e => { if (e.target === sheet) { sheet.hidden = true; renderLobby(); } }, { once: true });
  fillThumbs(sheet);
  for (const c of sheet.querySelectorAll('.card')) c.addEventListener('click', e => { e.stopPropagation(); if (shop) buy(c.dataset.id, c); });
  if (!shop) { P.seen = [...new Set([...P.seen, ...allPieces().filter(hasPiece).map(x => x.id)])]; saveP(); }
}
function buy(id, el) {
  const it = itemById(id); if (!it || P.owned.includes(id)) return false;
  if (P.gems < it.gem) { SND.no(); el && el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200 }); ui.pop('Need more gems', '#fff', 24, 30); return false; }
  P.gems -= it.gem; P.owned.push(id); saveP(); SND.buy(); buzz(15);
  if (el) { el.classList.add('owned', 'pop'); el.querySelector('.price').textContent = '✓ Owned'; }
  $('gemn').textContent = P.gems; ui.pop(`${it.name}!`, '#fff', 30, 30);
  const sub = sheet.querySelector('.sub'); if (sub) sub.innerHTML = `Designer pieces for gems. You have <span class="gem"></span> ${P.gems}`;
  return true;
}
function swatchOf(x) { return COLOURS.includes(x) || FINISHES.includes(x) ? `<span class="sw" style="background:${x.css}"></span>` : ''; }
function cardHtml(x, shop = false) {
  const own = hasPiece(x), isAcc = ITEMS.includes(x);
  const th = isAcc ? `<span class="th"><img alt="" data-th="${x.id}"></span>` : `<span class="th">${swatchOf(x)}</span>`;
  const lock = !own ? `<span class="lk">${x.gem ? `<span class="gem"></span> ${x.gem}` : `🔒 Show ${x.lvl}`}</span>` : '';
  return `<button class="card ${own ? (shop ? 'owned' : '') : (shop ? '' : 'lock')} ${!shop && own && !P.seen.includes(x.id) ? 'new' : ''}" data-id="${x.id}">${th}<span class="nm">${x.name}</span><span class="tg">${x.tags.map(t => TAGS[t][0]).join('')}</span>${shop ? `<span class="price">${own ? '✓ Owned' : `<span class="gem"></span> ${x.gem}`}</span>` : lock}</button>`;
}
function fillThumbs(root) {
  if (!me) return;
  for (const img of root.querySelectorAll('img[data-th]')) itemThumb(img.dataset.th, me.ch.M).then(u => { if (u) img.src = u; });
}
function lobbyCam(cut = false) {
  if (!me) return;
  const wide = W >= 900, lr = lob.getBoundingClientRect();
  const top = wide ? 60 : ($('journey')?.getBoundingClientRect().bottom || 300) - 6, bot = wide ? 40 : H - ($('chal')?.getBoundingClientRect().top || H - 330) - 4;
  const r = region(top, bot); if (wide) r.x0 = lr.right + 20;
  const t = T * 0.12, f = frame(V3(0, RUN_Y + 0.95, POSE_Z), 2.0, r, V3(Math.sin(t) * 0.9, 0.16, 1), 30, wide ? 0.78 : 0.98);
  setCam(f.pos, f.look, f.fov, f.off, cut, 2.5);
}
function toTitle() {
  phase = 'title'; showDress(false); $('walk').classList.add('off'); $('skip').hidden = true; $('lower').classList.remove('on'); clearLabels();
  for (const m of Object.values(rivalModels)) m.object.visible = false;
  if (trophy) trophy.visible = false;
  if (me) { me.object.visible = true; me.object.position.set(0, RUN_Y, POSE_Z); me.object.rotation.y = 0; me.play('idle'); }
  stage.atelier.visible = false; stage.cards.forEach(c => c.mesh.visible = false);
  renderLobby(); ui.start(); music(null);
  requestAnimationFrame(() => lobbyCam(true));
}

// ---------------------------------------------------------------- brief → dress
function startChallenge() {
  if (phase === 'loading') return false;
  if (!['title', 'result'].includes(phase)) return true;
  ui.hideStart(); sheet.hidden = true;
  ch = makeChallenge(curL()); stage.setVenue(ch.venue);
  tipOn = false; spotOn = false; picks = 0; beatenShown = false;
  me.wear({ colour: 'sig', finish: null, head: null, face: null, back: null, hand: null });
  ch.rivals.forEach((rv, i) => rivalModels[rv.id].wear(ch.rivalLooks[i]));
  phase = 'brief'; t0run = performance.now(); B.start(); P.plays++; saveP();
  const b = $('brief'); b.hidden = false;
  b.innerHTML = `<div class="bcard"><div class="k">${D.seed ? 'DAILY SHOW' : `SHOW ${ch.L}`} · ${ch.venue.name.toUpperCase()}</div><div class="em">${ch.theme.emoji}</div><h2>${ch.theme.name}</h2><p>${ch.theme.line}</p>
    <div class="tags">${chalTags(ch)}</div>
    <div class="vs"><div class="me"><img alt="" src="${me.thumb}"><span>You</span></div>${ch.rivals.map(r => `<div><img alt="" src="./assets/thumbs/${r.id}.webp"><span>${r.name.split(' ')[0]}</span></div>`).join('')}</div>
    <button class="btn go" id="go">Let's style! ✂️</button></div>`;
  b.querySelector('#go').addEventListener('click', e => { e.stopPropagation(); unlock(); toDress(); });
  b.addEventListener('pointerdown', e => e.stopPropagation());
  SND.whoosh(); music('dress');
  const bt = ch; setTimeout(() => { if (phase === 'brief' && ch === bt) toDress(); }, 3200);   // the brief reads itself, then the atelier opens
  // the model waits in the atelier behind the card
  stage.atelier.visible = true; me.object.position.set(ATL.x, ATL.plinthY, ATL.z); me.object.rotation.y = 0; me.play('idle');
  for (const m of Object.values(rivalModels)) m.object.visible = false;
  dressCam(true);
  return true;
}
function toDress() {
  if (phase !== 'brief') return;
  $('brief').hidden = true; phase = 'dress'; tab = 'colour';
  showDress(true); renderDressTop(); renderTabs(); renderItems(); updateBoosts();
  requestAnimationFrame(() => dressCam(true));
  SND.swish();
}
function showDress(on) { $('dress').classList.toggle('off', !on); }
function dressCam(cut = false) {
  if (!me) return;
  const wide = W >= 900, vis = !$('dress').classList.contains('off');
  const topR = vis ? document.querySelector('.dtop').getBoundingClientRect() : { bottom: 130 }, pan = vis ? document.querySelector('.panel').getBoundingClientRect() : { top: H - 290, left: W - 470 };
  const r = wide ? { x0: 0, x1: pan.left - 10, y0: topR.bottom + 6, y1: H - 10 } : { x0: 0, x1: W, y0: topR.bottom + 4, y1: pan.top - 4 };
  const f = frame(V3(ATL.x, ATL.plinthY + 1.0, ATL.z), 2.5, r, V3(0, 0.12, 1), 30, 0.76);
  setCam(f.pos, f.look, f.fov, f.off, cut, 4);
}
function renderDressTop() {
  $('dtheme').innerHTML = `<span class="em">${ch.theme.emoji}</span>${ch.theme.name}`;
  $('dtags').innerHTML = chalTags(ch);
  $('drivals').innerHTML = `vs ${ch.rivals.map(r => `<img alt="" src="./assets/thumbs/${r.id}.webp">`).join('')}`;
}
function renderTabs() {
  $('tabs').innerHTML = SLOTS.map(s => { const on = s.key === tab, filled = s.key === 'colour' ? me.outfit.colour !== 'sig' : s.key === 'finish' ? !!me.outfit.finish : !!me.outfit[s.key];
    return `<button class="${on ? 'on' : ''}" data-t="${s.key}">${s.icon}<small>${s.name}</small>${filled ? '<i>✓</i>' : ''}</button>`; }).join('');
  for (const b of $('tabs').querySelectorAll('button')) b.addEventListener('click', e => { e.stopPropagation(); unlock(); tab = b.dataset.t; SND.tab(); renderTabs(); renderItems(); });
}
const tipBest = {};
function listFor(slot) { return slot === 'colour' ? COLOURS : slot === 'finish' ? FINISHES : ITEMS.filter(i => i.slot === slot); }
function renderItems() {
  if (phase !== 'dress' || !me) return;
  const slot = tab, list = listFor(slot), row = $('items');
  const cur = slot === 'colour' ? me.outfit.colour : slot === 'finish' ? me.outfit.finish : me.outfit[slot];
  const sorted = [...list].sort((a, b) => (hasPiece(b) - hasPiece(a)) || ((a.lvl || 99) - (b.lvl || 99)));
  let html = slot !== 'colour' ? `<button class="card ${!cur ? 'on' : ''}" data-id=""><span class="th" style="font-size:30px">🚫</span><span class="nm">${slot === 'finish' ? 'Original' : 'None'}</span><span class="tg"></span></button>` : '';
  html += sorted.map(x => { const h = cardHtml(x); return h.replace('class="card ', `class="card ${x.id === cur ? 'on ' : ''}${tipOn && tipBest[slot]?.includes(x.id) ? 'tip ' : ''}`); }).join('');
  row.innerHTML = html;
  if (slot === 'colour') { const sc = row.querySelector('[data-id="sig"] .tg'); if (sc) sc.textContent = me.sigTags.map(t => TAGS[t][0]).join(''); }
  fillThumbs(row);
  for (const c of row.querySelectorAll('.card')) c.addEventListener('click', e => { e.stopPropagation(); unlock(); pick(slot, c.dataset.id || null, c); });
}
async function pick(slot, id, el) {
  if (phase !== 'dress') return false;
  const x = id ? (slot === 'colour' ? colourById(id) : slot === 'finish' ? finishById(id) : itemById(id)) : null;
  if (x && !hasPiece(x)) { SND.no(); ui.pop(x.gem ? `💎 ${x.gem} in the Boutique` : `Unlocks at Show ${x.lvl}`, '#fff', 22, 62); return false; }
  picks++;
  if (slot === 'colour') me.setColour(id || 'sig'); else if (slot === 'finish') me.setFinish(id); else await me.setItem(slot, id);
  if (phase !== 'dress') return true;
  SND.pick(picks); buzz(8);
  const hp = me.headPos(), base = me.object.position;
  const at = slot === 'head' ? hp.clone().add(V3(0, 0.15, 0)) : slot === 'face' ? hp : slot === 'hand' ? base.clone().add(V3(-0.35, 0.9, 0.1)) : slot === 'back' ? base.clone().add(V3(0, 1.3, -0.25)) : base.clone().add(V3(0, 1.0, 0.2));
  sparkle(at, { n: slot === 'colour' || slot === 'finish' ? 16 : 9, spread: slot === 'colour' || slot === 'finish' ? 0.9 : 0.35, size: 0.14, up: 0.9, color: x ? 0xfff1a8 : 0xffffff });
  if (x && picks % 3 === 0) me.play('cheer');
  renderTabs(); renderItems();
  const nel = $('items').querySelector(`[data-id="${id || ''}"]`); if (nel) nel.classList.add('pop');
  return true;
}
function updateBoosts() {
  $('btip').querySelector('b').textContent = P.tips; $('bspot').querySelector('b').textContent = P.spots;
  $('btip').classList.toggle('dim', !P.tips && !tipOn); $('btip').classList.toggle('used', tipOn);
  $('bspot').classList.toggle('dim', !P.spots && !spotOn); $('bspot').classList.toggle('used', spotOn);
}
function useTip() {
  if (phase !== 'dress' || tipOn) return false;
  if (!P.tips) { SND.no(); ui.pop('Earn tips with 3★ shows', '#fff', 22, 62); return false; }
  P.tips--; saveP(); tipOn = true;
  for (const s of SLOTS) tipBest[s.key] = bestFor(s.key, ch, hasPiece, me.sigTags).best.map(x => x.id);
  SND.tip(); ui.pop('Stylist tip! 💡', '#ffe066', 30, 30); updateBoosts(); renderItems(); return true;
}
function useSpot() {
  if (phase !== 'dress' || spotOn) return false;
  if (!P.spots) { SND.no(); ui.pop('Spotlights come every 5 shows', '#fff', 22, 62); return false; }
  P.spots--; saveP(); spotOn = true; SND.tip(); ui.pop('Spotlight on you! ✨', '#ffe066', 30, 30); updateBoosts();
  sparkle(me.object.position.clone().add(V3(0, 1.2, 0)), { n: 20, spread: 1.2, size: 0.18 }); return true;
}
$('btip').addEventListener('click', e => { e.stopPropagation(); unlock(); useTip(); });
$('bspot').addEventListener('click', e => { e.stopPropagation(); unlock(); useSpot(); });
$('strut').addEventListener('click', e => { e.stopPropagation(); unlock(); startWalk(); });
for (const id of ['dress', 'brief', 'walk', 'skip', 'mute']) ['pointerdown', 'pointerup'].forEach(ev => $(id).addEventListener(ev, e => { if (e.target.closest('button,.card,.panel,.bcard,.dtop')) e.stopPropagation(); }));
// drag on the model to spin it
let drag = null;
R.domElement.addEventListener('pointerdown', e => { if (phase === 'dress') drag = { x: e.clientX, r: me.object.rotation.y }; });
addEventListener('pointermove', e => { if (drag && phase === 'dress') me.object.rotation.y = drag.r + (e.clientX - drag.x) * 0.012; });
addEventListener('pointerup', () => { drag = null; });

// ---------------------------------------------------------------- the walk
function startWalk() {
  if (phase !== 'dress') return false;
  showDress(false); phase = 'walk'; stage.atelier.visible = false;
  const m = me.object; m.position.set(0, RUN_Y, RUN_Z0 - 1.2); m.rotation.y = 0; me.play('run', { ts: 0.62 });
  walk = { t: 0, speed: 2.7, state: 'in', tapped: null, ring: 0, poseAt: 0, shot: -1, rating: null };
  $('walk').classList.remove('off'); $('posebtn').classList.remove('done'); $('walkhint').textContent = 'Tap POSE when the rings meet!';
  lower(me.name, `${ch.theme.emoji} ${ch.theme.name}`);
  music('runway'); SND.whoosh(); stage.cheer(0.3); SND.crowd(1.2, 0.05);
  return true;
}
function lower(name, sub) { const l = $('lower'); l.innerHTML = `${name}<small>${sub}</small>`; l.classList.add('on'); clearTimeout(lower.t); lower.t = setTimeout(() => l.classList.remove('on'), 2600); }
function ringScale() { if (!walk) return 9; const ta = (POSE_Z - me.object.position.z) / walk.speed; return walk.state === 'in' ? 1 + ta * 0.75 : walk.state === 'wait' ? 1 - walk.wait * 0.9 : 9; }
function tapPose() {
  if (phase !== 'walk' || !walk || walk.tapped) return false;
  const s = ringScale(); if (s > 2.4) return false;
  const k = spotOn ? 1.6 : 1, d = Math.abs(s - 1);
  const r = d <= 0.08 * k ? ['PERFECT!', 12, 3] : d <= 0.2 * k ? ['GREAT!', 8, 2] : d <= 0.42 * k ? ['GOOD', 4, 1] : ['MISSED', 0, 0];
  walk.tapped = r; walk.rating = r; $('posebtn').classList.add('done');
  ui.pop(r[0], r[1] >= 12 ? '#ffe066' : r[1] ? '#ffffff' : '#ffb3c8', r[1] >= 12 ? 46 : 36, 46);
  if (r[1]) { SND.pose(r[2]); buzz(r[1] >= 12 ? [20, 30, 20] : 15); } else SND.miss();
  if (walk.state === 'wait') doPose();
  return true;
}
$('posebtn').addEventListener('pointerdown', e => { e.stopPropagation(); unlock(); tapPose(); });
function doPose() {
  walk.state = 'pose'; walk.poseAt = walk.t;
  const q = walk.rating ? walk.rating[1] : 0;
  me.play(ch.pose, { ts: 1 });
  stage.flashPit(); stage.flashCrowd(8 + q); SND.flashes(5 + Math.round(q / 2)); ui.flash(q >= 12 ? 0.55 : 0.3); shake = q >= 12 ? 0.08 : 0.04;
  slow = 0.4; slowT = 0.9; stage.cheer(0.4 + q / 30); SND.crowd(1.4, 0.05 + q * 0.004);
  sparkle(me.object.position.clone().add(V3(0, 1.3, 0)), { n: 10 + q, spread: 1, size: 0.18, up: 1.4 });
  $('walk').classList.add('off');
}
function updateWalk(dt) {
  const w = walk, m = me.object; w.t += dt;
  if (w.state === 'in') {
    m.position.z = Math.min(POSE_Z, m.position.z + w.speed * dt);
    m.rotation.z = Math.sin(w.t * 7.2) * 0.025;
    const s = ringScale(), ring = $('ring');
    ring.style.opacity = s < 2.4 ? Math.min(1, (2.4 - s) * 3) : 0; ring.style.transform = `scale(${Math.min(1.9, s)})`;
    if (Math.random() < dt * 4) stage.flashCrowd(1);
    if (m.position.z >= POSE_Z - 0.001) { w.state = 'wait'; w.wait = 0; me.play('idle', { fade: 0.12 }); m.rotation.z = 0; if (w.tapped) doPose(); }
  } else if (w.state === 'wait') {
    w.wait += dt; const ring = $('ring'); ring.style.transform = `scale(${Math.max(0.4, ringScale())})`;
    if (w.wait > 0.42) { if (!w.tapped) { w.tapped = w.rating = ['MISSED', 0, 0]; ui.pop('Too slow!', '#ffb3c8', 30, 46); SND.miss(); } doPose(); }
  } else if (w.state === 'pose') {
    if (w.t - w.poseAt > 1.9 && !w.turned) { w.turned = true; me.play('run', { ts: 0.62 }); }
    if (w.turned) { m.rotation.y = Math.min(Math.PI, m.rotation.y + dt * 7); if (m.rotation.y >= Math.PI - 0.01) m.position.z -= w.speed * dt; }
    if (w.t - w.poseAt > 3.3) startMontage();
  }
  // camera: front tele → side dolly → low hero shot → wide
  const z = m.position.z, u = (z - (RUN_Z0 - 1.2)) / (POSE_Z - RUN_Z0 + 1.2);
  const shot = w.state === 'pose' ? (w.turned ? 3 : 2) : u < 0.45 ? 0 : u < 0.8 ? 1 : 2;
  if (shot !== w.shot) { w.shot = shot; camCut = true; if (shot === 1 || shot === 3) SND.swish(); }
  const port = W / H < 0.8;
  if (shot === 0) { const f = frame(V3(0, RUN_Y + 0.9, z), port ? 2.3 : 2.1, region(60, port ? 200 : 150), V3(0.06, 0.08, 1), 26); setCam(f.pos, f.look, f.fov, f.off, false, 6); }
  else if (shot === 1) { setCam(V3(-2.0, RUN_Y + 1.25, z + 5.2), V3(0, RUN_Y + 0.9, z + 0.3), port ? 36 : 28, [0, 0], false, 8); }
  else if (shot === 2) { const f = frame(V3(0, RUN_Y + 1.0, POSE_Z), 2.5, region(70, port ? 190 : 110), V3(-0.28, 0.04, 1), 30, 0.9); setCam(f.pos, f.look, f.fov, f.off, false, 3); }
  else { setCam(V3(0, 4.6, POSE_Z + 10.5), V3(0, 1.4, RUN_Z0 + 3), 38, [0, 0], false, 1.2); }
  stage.posePool.material.opacity = 0.45 + (w.state === 'pose' ? 0.25 : 0);
}

// ---------------------------------------------------------------- rival montage
function startMontage() {
  phase = 'rivals'; me.object.visible = false;
  montage = { i: -1, t: 0 }; nextRival();
  $('skip').hidden = false;
}
function nextRival() {
  const mt = montage; mt.i++; mt.t = 0;
  if (mt.i > 0) rivalModels[ch.rivals[mt.i - 1].id].object.visible = false;
  if (mt.i >= 3) { startVote(); return; }
  const rv = ch.rivals[mt.i], m = rivalModels[rv.id];
  m.object.visible = true; m.object.position.set(0, RUN_Y, POSE_Z - 5.6); m.object.rotation.set(0, 0, 0); m.play('run', { ts: 0.62 }); mt.posed = false;
  lower(rv.name, `Rival ${mt.i + 1}/3`); SND.swish(); camCut = true;
}
function updateMontage(dt) {
  const mt = montage; mt.t += dt; const rv = ch.rivals[mt.i]; if (!rv) return;
  const m = rivalModels[rv.id], o = m.object;
  if (!mt.posed) {
    o.position.z = Math.min(POSE_Z, o.position.z + 2.7 * dt); o.rotation.z = Math.sin(mt.t * 7.2) * 0.025;
    if (o.position.z >= POSE_Z) { mt.posed = true; mt.pt = mt.t; o.rotation.z = 0; const q = ch.rivalPose[mt.i]; m.play(ch.pose); stage.flashPit(); stage.flashCrowd(4 + q / 2); SND.flashes(3 + Math.round(q / 3)); stage.cheer(0.2 + q / 40); ui.pop(q >= 12 ? 'PERFECT!' : q >= 8 ? 'GREAT!' : 'GOOD', '#fff', 28, 46); }
  } else if (mt.t - mt.pt > 1.15) { nextRival(); return; }
  const side = mt.i % 2 ? -1 : 1, port = W / H < 0.8;
  if (!mt.posed || mt.t - mt.pt < 0.15) setCam(V3(side * 2.0, RUN_Y + 1.25, o.position.z + 5.2), V3(0, RUN_Y + 0.9, o.position.z + 0.3), port ? 36 : 28, [0, 0], false, 7);
  else { const f = frame(V3(0, RUN_Y + 1.0, POSE_Z), 2.5, region(70, 120), V3(side * 0.3, 0.04, 1), 30, 0.9); setCam(f.pos, f.look, f.fov, f.off, false, 4); }
}
$('skip').addEventListener('click', e => { e.stopPropagation(); if (phase === 'rivals') { for (const rv of ch.rivals) rivalModels[rv.id].object.visible = false; startVote(); } });

// ---------------------------------------------------------------- the vote
const LINE_X = [-1.65, -0.55, 0.55, 1.65], LINE_Z = [POSE_Z - 0.25, POSE_Z + 0.2, POSE_Z + 0.2, POSE_Z - 0.25];
let labels = [];
function clearLabels() { labels.forEach(l => l.el.remove()); labels = []; }
function startVote() {
  phase = 'vote'; $('skip').hidden = true; $('lower').classList.remove('on');
  const ent = [{ m: me, name: 'You', me: true, look: me.outfit, pose: walk.rating ? walk.rating[1] : 0, sig: me.sigTags }];
  ch.rivals.forEach((rv, i) => ent.push({ m: rivalModels[rv.id], name: rv.name.split(' ')[0], look: ch.rivalLooks[i], pose: ch.rivalPose[i], sig: rivalModels[rv.id].sigTags }));
  ent.forEach((e, i) => { const s = score(e.look, ch, e.sig); e.sc = s; e.pts = s.pts + e.pose + (e.me && spotOn ? 8 : 0); e.votes = e.pts * 10 + ch.noise[i]; });
  const order = [1, 0, 2, 3];   // you stand second from the left
  ent.forEach((e, i) => { const k = order[i], o = e.m.object; o.visible = true; o.position.set(LINE_X[k], RUN_Y, LINE_Z[k]); o.rotation.set(0, -LINE_X[k] * 0.08, 0); e.m.play('idle'); e.slot = k; });
  const max = Math.max(...ent.map(e => e.votes)), ranked = [...ent].sort((a, b) => b.votes - a.votes);
  ranked.forEach((e, i) => e.place = i);
  clearLabels();
  for (const e of ent) {
    const el = document.createElement('div'); el.className = 'vl' + (e.me ? ' me' : ''); el.innerHTML = `<div class="rk"></div><div class="nm">${e.name}</div><div class="hv">♥ <span>0</span></div><div class="bar"><i></i></div>`;
    OV.appendChild(el); labels.push({ el, e, n: el.querySelector('.hv span'), bar: el.querySelector('.bar i'), rk: el.querySelector('.rk') });
  }
  vote = { t: 0, ent, max, ranked, revealed: 0, done: false, hearts: 0 };
  SND.drum(); stage.cheer(0.5);
  stage.cards.forEach(c => c.mesh.visible = false);
  camCut = true;
}
const PLACE = ['1st', '2nd', '3rd', '4th'];
function updateVote(dt) {
  const v = vote; v.t += dt;
  const port = W / H < 0.8;
  const f = frame(V3(0, RUN_Y + 1.0, POSE_Z), port ? 2.6 : 2.4, region(port ? 120 : 90, port ? 40 : 30), V3(0, 0.16, 1), 32, 0.8);
  // width: four models side by side
  const need = 4.6 / (2 * Math.tan(f.fov * Math.PI / 360) * (W / H));
  if (f.pos.distanceTo(f.look) < need) f.pos.copy(f.look.clone().add(f.pos.clone().sub(f.look).normalize().multiplyScalar(need)));
  setCam(f.pos, f.look, f.fov, [0, f.off[1]], false, 3);
  const k = clamp((v.t - 0.4) / 2.6, 0, 1), e1 = 1 - (1 - k) ** 2;
  for (const l of labels) {
    const e = l.e, val = Math.round(e.votes * e1); l.n.textContent = val; l.bar.style.width = (e.votes / v.max * 100 * e1).toFixed(1) + '%';
    const hp = e.m.headPos(_hp); hp.y += 0.42; _hp.project(cam); const sx = (_hp.x + 1) / 2 * W, sy = (1 - _hp.y) / 2 * H;
    l.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
  }
  // hearts fly from the crowd to each model, more to the ones with more votes
  if (k > 0 && k < 1) {
    v.hearts += dt * 26;
    while (v.hearts > 1) {
      v.hearts--; const tot = v.ent.reduce((a, e) => a + e.votes, 0); let x = Math.random() * tot, tgt = v.ent[0];
      for (const e of v.ent) { x -= e.votes; if (x <= 0) { tgt = e; break; } }
      const c = stage.crowd[Math.floor(Math.random() * stage.crowd.length)];
      sparkle(V3(c.x, c.y + 1, c.z), { heart: true, n: 1, size: 0.3, to: tgt.m.object.position.clone().add(V3(0, 1.25, 0.1)), dur: 0.9 });
      if (Math.random() < 0.3) SND.heart(Math.floor(Math.random() * 6));
    }
  }
  // reveal from 4th to 1st
  const at = [3.4, 3.85, 4.3, 5.0];
  while (v.revealed < 4 && v.t > at[v.revealed]) {
    const place = 3 - v.revealed, e = v.ranked[place], l = labels.find(q => q.e === e);
    l.rk.textContent = PLACE[place]; l.rk.classList.add('on'); if (place === 0) l.el.classList.add('first');
    SND.rank(place); v.revealed++;
    if (place === 3) e.m.play('fall');
    if (place === 0) {
      e.m.play('cheer'); confetti(scene, e.m.object.position.clone().add(V3(0, 2.2, 0.3)), 70); stage.cheer(0.9); SND.crowd(2, 0.09); stage.flashPit(); stage.flashCrowd(12);
      trophy.visible = true; trophy.position.copy(e.m.object.position).add(V3(0.0, 3.6, 0.15)); v.trophyFor = e;
      judges.forEach(j => j && j.play('cheer'));
      showJudgeCards(v.ent[0]);
      if (e.me) { ui.pop('YOU WIN!', '#ffe066', 52, 28); SND.win(); }
    }
  }
  if (v.trophyFor) { const tp = v.trophyFor.m.object.position; trophy.position.y = lerp(trophy.position.y, tp.y + 2.05, Math.min(1, dt * 6)); trophy.rotation.y += dt * 2.2; }
  if (v.t > 6.6 && !v.done) { v.done = true; finish(); }
}
const _hp = V3();
function showJudgeCards(meE) {
  const sc10 = clamp(meE.pts / 12.5, 1, 10);
  stage.cards.forEach((c, i) => {
    const x = c.t.userData.canvas.getContext('2d'), val = clamp(sc10 + (i ? -0.5 : 0.5) * (meE.pts % 3 === 0 ? 0 : 1), 1, 10);
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 96); x.strokeStyle = '#ff4f97'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 88);
    x.fillStyle = '#5b2346'; x.font = "56px 'Lilita One',system-ui"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(val.toFixed(1), 64, 52); c.t.needsUpdate = true; c.mesh.visible = true;
  });
}

// ---------------------------------------------------------------- result
const winBox = document.createElement('div'); winBox.className = 'resbox'; ui.els.win.appendChild(winBox); ui.els.win.classList.add('res');
const loseBox = document.createElement('div'); loseBox.className = 'resbox'; ui.els.lose.appendChild(loseBox); ui.els.lose.classList.add('res');
const shareBtn = ui.els.win.querySelector('.hc-btn');
function finish() {
  const meE = vote.ent[0], place = meE.place, won = place < 3, stars = won ? 3 - place : 0, ms = performance.now() - t0run;
  F.level(won, (3 - place) / 3);
  B.submit(stars, { ms });
  const L = ch.L, prev = P.stars[L] || 0;
  const gems = Math.round(meE.votes / 14) + [30, 18, 8, 0][place];
  P.gems += gems; P.best = Math.max(P.best, meE.votes);
  let gift = [], unl = [];
  if (won && !D.seed) {
    if (stars > prev) P.stars[L] = stars;
    if (stars === 3 && prev < 3) { P.tips++; gift.push('+1 💡 Stylist tip'); }
    if (L % 5 === 0 && prev === 0) { P.spots++; gift.push('+1 ✨ Spotlight'); }
    if (L === P.level) { P.level++; unl = allPieces().filter(x => x.lvl === P.level); const nt = THEMES.find(t => t.lvl === P.level); if (nt) gift.push(`New theme: ${nt.emoji} ${nt.name}`); }
  }
  if (!beatenShown && D.beaten(meE.votes)) { beatenShown = true; ui.pop('BEATEN!', '#ffe066', 40, 30); }
  saveP();
  phase = 'result'; music(null); clearLabels();
  const sc = meE.sc, box = won ? winBox : loseBox;
  const lines = sc.lines.map(l => `<div class="rl ${l.v > 0 ? 'good' : l.v < 0 ? 'bad' : ''}"><span>${SLOTS.find(s => s.key === l.slot).icon} ${l.name} ${l.tags.map(t => TAGS[t][0]).join('')}</span><b>${l.v > 0 ? '+' : ''}${l.v}</b></div>`).join('');
  box.innerHTML = `<div class="rt">${D.seed ? 'DAILY SHOW' : `SHOW ${L}`} · ${ch.theme.emoji} ${ch.theme.name.toUpperCase()}</div>
    <h2>${won ? ['Runway Queen!', 'Stunning!', 'Cute look!'][place] : 'Not this time…'}</h2>
    ${won ? '<div class="stars"><span>★</span><span>★</span><span>★</span></div>' : `<div style="font:700 14px 'Baloo 2';margin:6px 0">You placed 4th. Match the ${ch.want.map(t => TAGS[t][0]).join(' ')} tags and nail the pose!</div>`}
    <div class="rl"><span>Placed</span><b>${PLACE[place]} of 4</b></div>
    ${lines}
    ${sc.full ? `<div class="rl good"><span>👗 Complete look (${sc.full / 3} accessories)</span><b>+${sc.full}</b></div>` : ''}
    ${sc.harmony ? `<div class="rl good"><span>🎨 Colour + fabric on theme</span><b>+${sc.harmony}</b></div>` : ''}
    ${sc.missing ? `<div class="rl bad"><span>📌 ${ch.rule.text}</span><b>−${sc.missing}</b></div>` : ''}
    <div class="rl ${meE.pose ? 'good' : ''}"><span>📸 Pose: ${walk.rating ? walk.rating[0] : '—'}</span><b>+${meE.pose}</b></div>
    ${spotOn ? '<div class="rl good"><span>✨ Spotlight</span><b>+8</b></div>' : ''}
    <div class="rl tot"><span>Audience votes</span><b>♥ ${meE.votes}</b></div>
    <div class="rl"><span>Gems earned</span><b><span class="gem"></span> ${gems}</b></div>
    ${unl.length ? `<div style="font:400 14px 'Lilita One';margin-top:6px;color:#c05a90">NEW IN YOUR CLOSET</div><div class="unl">${unl.map(x => `<div>${ITEMS.includes(x) ? `<img alt="" data-th="${x.id}">` : `<span class="sw" style="background:${x.css}"></span>`}<span>${x.name}</span></div>`).join('')}</div>` : ''}
    ${gift.map(g => `<div class="gift">🎁 ${g}</div>`).join('')}
    <div class="slot"></div><div class="tapc">Tap to continue</div>`;
  fillThumbs(box);
  if (won) {
    D.won(meE.votes, 'scored');
    if (shareBtn) box.querySelector('.slot').appendChild(shareBtn);
    ui.win(L, '');
    const ss = box.querySelectorAll('.stars span'); for (let i = 0; i < stars; i++) setTimeout(() => { ss[i].classList.add('on'); SND.star(i); buzz(10); }, 900 + i * 380);
    gemFly(gems);
  } else { SND.lose(); ui.lose('Not this time', ''); }
}
function gemFly(n) {
  const tg = $('gems').getBoundingClientRect();
  for (let i = 0; i < Math.min(10, 2 + Math.round(n / 8)); i++) {
    const d = document.createElement('div'); d.className = 'fly'; d.innerHTML = '<span class="gem"></span>';
    d.style.transform = `translate(${W / 2 + (Math.random() - 0.5) * 120}px,${H * 0.45 + (Math.random() - 0.5) * 80}px)`; document.body.appendChild(d);
    setTimeout(() => { d.style.transform = `translate(${tg.left + 8}px,${tg.top + 6}px) scale(.8)`; d.style.opacity = '0.2'; }, 700 + i * 60);
    setTimeout(() => { d.remove(); SND.gem(i); $('gemn').textContent = P.gems; }, 1400 + i * 60);
  }
}
ui.onTap(which => {
  unlock();
  if (which === 'start') { if (!startChallenge()) ui.start(); return; }
  toTitle();
});
$('playbtn').addEventListener('click', e => { e.stopPropagation(); unlock(); if (phase === 'title') { startChallenge(); } });
$('playbtn').addEventListener('pointerdown', e => e.stopPropagation());
$('mute').addEventListener('click', e => { e.stopPropagation(); P.mute = !P.mute; saveP(); setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊'; });
setMuted(P.mute); $('mute').textContent = P.mute ? '🔇' : '🔊';
$('gemn').textContent = P.gems;

// ---------------------------------------------------------------- test hooks + bot
let botQ = null;
window.__game = {
  perf: () => ({ calls: R.info.render.calls, tris: R.info.render.triangles, geo: R.info.memory.geometries, tex: R.info.memory.textures }),
  get state() { return phase === 'loading' || phase === 'title' ? 'ready' : phase === 'result' ? (vote && vote.ent[0].place < 3 ? 'won' : 'lost') : 'play'; },
  get phase() { return phase; },
  get level() { return curL(); }, get score() { return totalStars(); }, get gems() { return P.gems; },
  get outfit() { return me && me.outfit; },
  start: () => startChallenge(),
  autostart() {
    if (phase === 'loading' || !me) return false;
    if (phase === 'title' || phase === 'result') { ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); startChallenge(); }
    if (phase === 'brief') toDress();
    return phase !== 'loading';
  },
  bot() {
    if (phase === 'loading') return;
    if (phase === 'title') {
      const cheap = ITEMS.filter(i => i.gem && !P.owned.includes(i.id) && i.gem <= P.gems)[0];
      if (cheap && Math.random() < 0.3) { buy(cheap.id); return; }
      startChallenge(); return;
    }
    if (phase === 'brief') { toDress(); botQ = null; return; }
    if (phase === 'dress') {
      if (!botQ) {
        botQ = [];
        if (P.tips > 1 && Math.random() < 0.3) botQ.push(['tip']);
        for (const s of SLOTS) {
          const b = bestFor(s.key, ch, hasPiece, me.sigTags);
          if (b.v <= 0 && ACC.includes(s.key)) { const any = listFor(s.key).filter(x => hasPiece(x) && !x.tags.includes(ch.ban)); if (any.length && Math.random() < 0.8) botQ.push(['pick', s.key, any[Math.floor(Math.random() * any.length)].id]); continue; }
          if (!b.best.length) continue;
          const alt = listFor(s.key).filter(hasPiece);
          const x = Math.random() < 0.85 ? b.best[Math.floor(Math.random() * b.best.length)] : alt[Math.floor(Math.random() * alt.length)];
          botQ.push(['tab', s.key], ['pick', s.key, x.id]);
        }
        botQ.push(['strut']);
      }
      const a = botQ.shift(); if (!a) return;
      if (a[0] === 'tip') useTip(); else if (a[0] === 'tab') { tab = a[1]; renderTabs(); renderItems(); } else if (a[0] === 'pick') pick(a[1], a[2]); else { botQ = null; startWalk(); }
      return;
    }
    if (phase === 'walk' && walk && !walk.tapped) { const s = ringScale(); if (s < 2.4 && Math.abs(s - 1) < 0.06 + Math.random() * 0.12) tapPose(); }
  },
};

// ---------------------------------------------------------------- loop
loop(dt60 => {
  const rdt = Math.min(0.05, dt60 / 60);
  if (slowT > 0) { slowT -= rdt; if (slowT <= 0) slow = 1; }
  const dt = rdt * slow; T += rdt;
  if (stage) {
    if (phase === 'walk') updateWalk(dt); else if (phase === 'rivals') updateMontage(dt); else if (phase === 'vote') updateVote(dt);
    else if (phase === 'title') lobbyCam();
    else if (phase === 'dress' || phase === 'brief') { if (!drag && me) me.object.rotation.y += (Math.sin(T * 0.5) * 0.35 - me.object.rotation.y) * rdt * 0.8; }
    stage.update(rdt, T);
    const focus = phase === 'walk' ? me.object.position.z : phase === 'rivals' && montage && ch.rivals[montage.i] ? rivalModels[ch.rivals[montage.i].id].object.position.z : POSE_Z;
    stage.updateCrowd(T, phase === 'walk' || phase === 'rivals' ? 0.35 : phase === 'vote' ? 0.6 : 0.1, focus);
    if (me) me.mixer.update(dt);
    for (const m of Object.values(rivalModels)) if (m.object.visible) m.mixer.update(dt);
    for (const j of judges) if (j) j.mixer.update(dt);
    // the sun follows the action (shadow map stays sharp)
    const f = phase === 'dress' || phase === 'brief' ? V3(ATL.x, 0, ATL.z) : V3(0, 0, phase === 'walk' ? me.object.position.z : POSE_Z);
    sun.target.position.copy(f); sun.position.set(f.x + 4, 10, f.z + 7); fill.target.position.copy(f); fill.position.set(f.x - 5, 4, f.z + 9);
  }
  tickDress(rdt); updateSprites(dt);
  updateCam(rdt);
  R.info.reset(); C.render(rdt);
});

(async function boot() {
  ui.hideStart();   // the lobby card appears only once everything is ready (an arcade shell tapping it early must not eat its taps)
  const T0 = performance.now();
  try {
    await loadProps(PROP_IDS, prog);
    stage = buildStage(THREE, scene, place);
    trophy = place('s03', { size: 0.55, pos: [0, -10, 0] }); trophy.visible = false;
    const MS = 20000, soft = (pr, what) => withTimeout(pr, MS, what).catch(e => { console.warn('load', what, e && e.message); }).finally(prog);
    await Promise.all([
      soft(buildMe(), 'model'),
      ...RIVALS.map(rv => soft(createModel(rv.id, { height: 1.75 }).then(m => { m.object.visible = false; scene.add(m.object); rivalModels[rv.id] = m; }), rv.id)),
      ...JUDGES.map((jd, i) => soft(createModel(jd.id, { height: jd.id === 'p05' ? 1.62 : 1.78 }).then(m => { m.object.position.copy(stage.judgeSpots[i]); m.object.rotation.y = -Math.PI / 2; scene.add(m.object); m.play('idle'); judges[i] = m; }), jd.id)),
    ]);
    if (!me) await withTimeout(buildMe(), MS, 'model retry').catch(() => {});
    // small props don't cast shadows (saves shadow-pass draws)
    scene.updateMatrixWorld(true);
    const _s = V3();
    scene.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || !o.castShadow) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); o.getWorldScale(_s); if (o.geometry.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) < 0.35) o.castShadow = false; });
  } catch (e) { console.warn('boot', e); }
  // a rival that failed to load is simply left out of the line-up pool
  for (let i = RIVALS.length - 1; i >= 0; i--) if (!rivalModels[RIVALS[i].id]) RIVALS.splice(i, 1);
  document.fonts?.load("40px 'Lilita One'").then(() => stage && ch ? stage.drawSign(ch.venue) : renderLobby()).catch(() => {});
  if (!stage || !me || RIVALS.length < 3) { const l = document.querySelector('#load small'); if (l) l.textContent = 'Could not load the runway. Check your connection and reload.'; return; }
  phase = 'title'; toTitle();
  $('load').classList.add('gone'); setTimeout(() => $('load').remove(), 600);
})();

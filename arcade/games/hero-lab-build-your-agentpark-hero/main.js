// Hero Lab: AGENTPARK's character builder. Showroom stage + roster + gear + colours + name, saved to localStorage
// `agp.hero` so games can load the same hero with hero.js.
import * as THREE from './kit/three.module.min.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { cine } from './kit/cine.js';
import { sfx, tone, buzz, confetti, burst, updateParticles } from './kit/hc.js';
import { CHARS, ITEMS, TAGS, TAG_COLOR, SLOTS, NAMES_A, NAMES_B, charById, itemById } from './catalog.js';
import { createParts } from './parts.js';
import { readHero, writeHero, DEFAULT_HERO } from './store.js';

const $ = s => document.querySelector(s);
const P = createParts(THREE, GLTFLoader, new URL('./', import.meta.url).href);
const BOT = /[?&]bot/.test(location.search) || navigator.webdriver;

// ------------------------------------------------------------ manifest (which models are shipped)
let READY = new Set(), READY_ITEMS = new Set();
try {
  const m = await (await fetch('./assets/manifest.json', { cache: 'no-cache' })).json();
  READY = new Set(m.chars || []); READY_ITEMS = new Set(m.items || []);
} catch (e) { READY = new Set(['c01']); }
const itemReady = it => it.glb ? READY_ITEMS.has(it.id) : !(it.alt && READY_ITEMS.has(it.alt));
const readyChars = () => CHARS.filter(c => READY.has(c.id));

// ------------------------------------------------------------ renderer / stage
const stageEl = $('#stage'), canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
const C = cine(renderer, scene, camera, { bloom: 0.3, bloomThreshold: 2.4, bloomRadius: 0.35, exposure: 1.0, envIntensity: 0.7,
  grade: { sat: 1.1, contrast: 1.04, vignette: 0.16, grain: 0.012, tint: '#fffaff' } });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function gradTex(stops, w = 4, h = 512, radial = false) {
  const c = document.createElement('canvas'); c.width = radial ? 512 : w; c.height = h; const x = c.getContext('2d');
  const g = radial ? x.createRadialGradient(256, 256, 0, 256, 256, 256) : x.createLinearGradient(0, 0, 0, h);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
scene.background = gradTex([[0, '#9d93e6'], [0.42, '#d9d2fb'], [0.6, '#e9e5fd'], [1, '#c9c1f4']]);

// floor: soft radial disc that melts into the background
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ map: gradTex([[0, '#e4defc'], [0.35, '#d6cff8'], [1, '#c9c1f4']], 4, 512, true), roughness: 0.9, metalness: 0 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// pedestal: bevelled lathe with a glowing rim
const PED_H = 0.2, PED_R = 0.78;
const pedProfile = [[0, 0], [PED_R + 0.06, 0], [PED_R + 0.06, 0.03], [PED_R, 0.06], [PED_R, PED_H - 0.035], [PED_R - 0.035, PED_H], [0, PED_H]].map(([x, y]) => new THREE.Vector2(x, y));
const pedestal = new THREE.Mesh(new THREE.LatheGeometry(pedProfile, 72), new THREE.MeshPhysicalMaterial({ color: '#f4f2ff', roughness: 0.28, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
pedestal.receiveShadow = true; pedestal.castShadow = true; scene.add(pedestal);
const topDisc = new THREE.Mesh(new THREE.CircleGeometry(PED_R - 0.04, 72), new THREE.MeshPhysicalMaterial({ color: '#2a2566', roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }));
topDisc.rotation.x = -Math.PI / 2; topDisc.position.y = PED_H + 0.001; topDisc.receiveShadow = true; scene.add(topDisc);
const rimMat = new THREE.MeshStandardMaterial({ color: '#7b5cff', emissive: '#7b5cff', emissiveIntensity: 3.5 });
const rim = new THREE.Mesh(new THREE.TorusGeometry(PED_R - 0.02, 0.014, 10, 120), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = PED_H + 0.004; scene.add(rim);
const rim2 = new THREE.Mesh(new THREE.TorusGeometry(PED_R + 0.065, 0.008, 8, 120), rimMat); rim2.rotation.x = Math.PI / 2; rim2.position.y = 0.03; scene.add(rim2);
// floor glow ring under the pedestal
const halo = new THREE.Mesh(new THREE.RingGeometry(PED_R + 0.08, PED_R + 0.9, 72), new THREE.MeshBasicMaterial({ map: gradTex([[0, 'rgba(123,92,255,0)'], [0.62, 'rgba(123,92,255,0)'], [0.7, 'rgba(123,92,255,.35)'], [1, 'rgba(123,92,255,0)']], 4, 512, true), transparent: true, depthWrite: false }));
halo.rotation.x = -Math.PI / 2; halo.position.y = 0.004; scene.add(halo);

// backdrop: tall light bars + arcs for a showroom feel
const bars = new THREE.Group(); scene.add(bars);
for (let i = 0; i < 9; i++) {
  const a = -0.9 + i * 0.225, r = 6.2;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 7, 0.06), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffffff' : '#e3dcff' }));
  b.position.set(Math.sin(a) * r, 3.5, -Math.cos(a) * r); bars.add(b);
}
const arc = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.03, 8, 120, Math.PI), new THREE.MeshStandardMaterial({ color: '#ff5dbb', emissive: '#ff5dbb', emissiveIntensity: 3 }));
arc.position.set(0, 0, -4.2); scene.add(arc);
const arc2 = arc.clone(); arc2.material = arc.material.clone(); arc2.material.color.set('#7b5cff'); arc2.material.emissive.set('#7b5cff'); arc2.scale.setScalar(1.18); arc2.position.z = -4.6; scene.add(arc2);

// sparkles drifting up around the pedestal
const SPK = 70, spkGeo = new THREE.BufferGeometry(), spkPos = new Float32Array(SPK * 3), spkSeed = [];
for (let i = 0; i < SPK; i++) { spkSeed.push([Math.random() * Math.PI * 2, 0.9 + Math.random() * 1.6, Math.random() * 3, 0.15 + Math.random() * 0.35]); }
spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3));
const spkTex = gradTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,240,255,.8)'], [1, 'rgba(255,255,255,0)']], 4, 64, true);
const sparkles = new THREE.Points(spkGeo, new THREE.PointsMaterial({ size: 0.06, map: spkTex, transparent: true, depthWrite: false, color: '#ffffff', blending: THREE.AdditiveBlending }));
scene.add(sparkles);

// lights: soft key with shadow, cool + warm rims, sky fill
scene.add(new THREE.HemisphereLight('#ffffff', '#b8b0e6', 1.0));
const key = new THREE.DirectionalLight('#fff6ee', 2.2); key.position.set(2.2, 4.5, 3.4); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6; key.shadow.camera.top = 2.6; key.shadow.camera.bottom = -0.6;
key.shadow.camera.near = 1; key.shadow.camera.far = 12; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; scene.add(key);
const rimL = new THREE.DirectionalLight('#ff7ad1', 2.4); rimL.position.set(-3, 2.6, -2.6); scene.add(rimL);
const rimR = new THREE.DirectionalLight('#5cc8ff', 2.4); rimR.position.set(3, 2.2, -2.8); scene.add(rimR);
const fill = new THREE.DirectionalLight('#e8e4ff', 0.6); fill.position.set(-2, 1.2, 3); scene.add(fill);

const pivot = new THREE.Group(); pivot.position.y = PED_H; scene.add(pivot);

// ------------------------------------------------------------ hero state
let hero = readHero();
if (!READY.has(hero.char)) hero.char = (readyChars()[0] || CHARS[0]).id;
for (const s in hero.items) { const it = itemById(hero.items[s]); if (it?.alt && READY_ITEMS.has(it.alt)) hero.items[s] = it.alt; }
let cur = null;               // { id, root, clips, M, U, mixer, actions, slots:{} }
let loadToken = 0, loading = false, saves = 0;
const holders = {};

function setLoading(on) { loading = on; $('#loader').classList.toggle('on', on); }

async function selectChar(id, { silent = false } = {}) {
  if (!READY.has(id)) { toast('Coming soon — still in the lab'); sfx.fail?.(); return; }
  const tok = ++loadToken; setLoading(true);
  let ch;
  try { ch = await P.loadCharacter(id, { colors: hero }); } catch (e) { console.warn(e); if (tok === loadToken) setLoading(false); toast('Could not load that hero'); return; }
  if (tok !== loadToken) return;   // a newer pick won
  const old = cur;
  if (old) { old.mixer.stopAllAction(); old.mixer.uncacheRoot(old.root); pivot.remove(old.root); }
  cur = ch; hero.char = id;
  const box = ch.M; ch.root.position.y = -box.minY;
  pivot.add(ch.root);
  ch.mixer = new THREE.AnimationMixer(ch.root); ch.actions = {};
  for (const [n, c] of Object.entries(ch.clips)) ch.actions[n] = ch.mixer.clipAction(c);
  ch.slots = {};
  play('idle', true);
  // re-equip gear onto the new body
  for (const s of ['head', 'face', 'back', 'hand', 'offhand']) if (hero.items[s]) await equip(s, hero.items[s], { silent: true, token: tok });
  applyColors();
  setLoading(false);
  frame(); popIn = 1;
  const def = charById(id), col = TAG_COLOR[def.tags[0]] || '#7b5cff';
  setTagColor(col);
  updatePlate();
  if (!silent) { sfx.pick(3); tone(220, 0.25, 'sine', 0.08, 2.4); burst(scene, new THREE.Vector3(0, PED_H + 0.1, 0), [col, '#ffffff', '#ffd23f'], 26, { speed: 0.05, up: 0.06, size: 0.3, gravity: 0.002 }); rimPulse = 1; }
  if (tab === 'hero') renderBody();
}

function setTagColor(col) {
  document.documentElement.style.setProperty('--tag', col);
  rimMat.color.set(col); rimMat.emissive.set(col);
  halo.material.color.set(col);
}

async function equip(slot, id, { silent = false, token = loadToken } = {}) {
  if (!cur) return;
  const ch = cur;
  if (holders[slot]) { holders[slot].parent?.remove(holders[slot]); holders[slot] = null; }
  hero.items[slot] = id || null;
  if (!id) { if (!silent) sfx.tap(); return; }
  const it = itemById(id); if (!it || !itemReady(it)) { hero.items[slot] = null; return; }
  let built;
  try { built = await P.buildItem(id, ch.M); } catch (e) { console.warn(e); return; }
  if (ch !== cur || token !== loadToken || hero.items[slot] !== id) return;  // something changed while loading
  if (holders[slot]) { holders[slot].parent?.remove(holders[slot]); }
  const h = P.mount(ch, slot, built.obj, built.def); holders[slot] = h;
  if (tab === slot || (tab === 'hand' && slot === 'offhand')) renderBody();
  P.tint(built.obj, hero.tints?.[slot] || {});
  if (!silent) {
    sfx.coin(); buzz(12);
    built.obj.scale.setScalar(0.01); popItems.push({ o: built.obj, t: 0 });
    const wp = new THREE.Vector3(); built.obj.getWorldPosition(wp);
    burst(scene, wp, ['#ffffff', '#ffd23f', '#7b5cff'], 14, { speed: 0.035, up: 0.03, size: 0.18, gravity: 0.001 });
  }
}

// ------------------------------------------------------------ animation
let curClip = 'idle', oneShotT = 0;
const LOOPS = { run: 2.2, sprint: 2.2, slide: 0, jump: 0, cheer: 0, fall: 0 };
function play(name, instant = false) {
  if (!cur || !cur.actions[name]) return;
  const next = cur.actions[name], prev = cur.actions[curClip];
  next.reset(); next.enabled = true; next.setEffectiveWeight(1);
  if (name === 'idle') next.setLoop(THREE.LoopRepeat, Infinity);
  else if (LOOPS[name]) next.setLoop(THREE.LoopRepeat, Infinity);
  else { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
  next.play();
  if (prev && prev !== next && !instant) prev.crossFadeTo(next, 0.25, false); else if (prev && prev !== next) prev.stop();
  curClip = name;
  oneShotT = name === 'idle' ? 0 : (LOOPS[name] || Math.max(0.6, next.getClip().duration - 0.25));
  document.querySelectorAll('.mv').forEach(b => b.classList.toggle('on', b.dataset.k === name));
}

const MOVES = [['idle', '🧍', 'Idle'], ['run', '🏃', 'Run'], ['jump', '⤴️', 'Jump'], ['cheer', '🙌', 'Cheer'], ['slide', '💨', 'Slide']];
$('#moves').innerHTML = MOVES.map(([k, i, l]) => `<button class="mv" data-k="${k}"><i>${i}</i>${l}</button>`).join('');
$('#moves').addEventListener('click', e => { const b = e.target.closest('.mv'); if (!b) return; sfx.tap(); play(b.dataset.k); if (b.dataset.k !== 'idle') { spinVel += 0; } });

// ------------------------------------------------------------ colours
function applyColors() {
  if (!cur) return;
  cur.U.uHue.value = hero.hue; cur.U.uSat.value = hero.sat; cur.U.uBri.value = hero.bri; cur.U.uLock.value = hero.lockSkin === false ? 0 : 1;
  for (const s in holders) if (holders[s]) P.tint(holders[s], hero.tints?.[s] || {});
}

// ------------------------------------------------------------ camera, turntable, zoom
const view = { y: 1.1, dist: 5, zoom: 1, ty: 1.1, tdist: 5 };
let yaw = 0.35, yawTarget = null, spinVel = 0, lastInteract = -10, popIn = 0, rimPulse = 0;
const popItems = [];
let focus = 'full';
function frame() {
  if (!cur) return;
  const M = cur.M, h = M.height, sw = stageEl.clientWidth, sh = stageEl.clientHeight, desk = sw >= 600 && innerWidth >= 900;
  const fovV = THREE.MathUtils.degToRad(camera.fov), tanH = Math.tan(fovV / 2);
  // screen space that is actually free: top bar + nameplate above, move buttons (+ panel lip) below
  const padT = focus === 'head' ? 70 : (desk ? 130 : 118), padB = desk ? 100 : 100, usable = Math.max(120, sh - padT - padB);
  let lo, hi, wHalf;
  if (focus === 'head') { const c = (M.head.top + M.head.bottom) / 2, sp = Math.max(0.85, M.head.H * 3.4); lo = c - sp * 0.55; hi = c + sp * 0.45; wHalf = 0.42; }
  else if (focus === 'torso') { lo = M.chest.bot - 0.6; hi = M.maxY + 0.25; wHalf = 1.05; }
  else if (focus === 'hands') { lo = Math.min(M.rh.c.y, M.lh.c.y) - 0.45; hi = M.head.top + 0.05; wHalf = 0.75; }
  else { lo = M.minY - PED_H; hi = M.maxY + 0.05; wHalf = 0.95; }
  const spanY = (hi - lo) * sh / usable, distY = spanY / 2 / tanH, distX = wHalf / (tanH * camera.aspect);
  view.tdist = Math.max(distY, distX * 0.92);
  view.ty = PED_H + (lo + hi) / 2 - M.minY;
  view.off = (padT - padB) / 2;   // shift the image down by this many px so the subject sits in the free band
}
function setFocus(f) { focus = f; frame(); }

let ptrs = new Map(), pinch0 = 0, zoom0 = 1;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); lastInteract = now; spinVel = 0; yawTarget = null;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.zoom; } });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 1) { const dx = e.clientX - p.x; yaw += dx * 0.012; spinVel = dx * 0.012; $('#hint').style.opacity = 0; }
  p.x = e.clientX; p.y = e.clientY; lastInteract = now;
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); view.zoom = THREE.MathUtils.clamp(zoom0 * pinch0 / Math.max(20, d), 0.4, 1.35); }
});
const up = e => { ptrs.delete(e.pointerId); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); view.zoom = THREE.MathUtils.clamp(view.zoom * (1 + e.deltaY * 0.0012), 0.4, 1.35); lastInteract = now; }, { passive: false });
$('#zin').onclick = () => { view.zoom = Math.max(0.4, view.zoom * 0.8); sfx.tap(); };
$('#zout').onclick = () => { view.zoom = Math.min(1.35, view.zoom * 1.25); sfx.tap(); };

function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  renderer.setSize(w, h, false); C.resize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); frame();
}
new ResizeObserver(resize).observe(stageEl);

// ------------------------------------------------------------ nameplate
const plate = $('#plate');
function updatePlate() {
  const def = cur ? charById(cur.id) : null;
  $('#pname').textContent = hero.name || def?.name || 'Hero';
  $('#prole').textContent = def ? def.role : '';
}
const tmpV = new THREE.Vector3();
function placePlate() {
  if (!cur) { plate.style.opacity = 0; return; }
  const M = cur.M; tmpV.set(0, PED_H + M.height + 0.12 + (holders.head ? M.head.H * 0.45 : 0), 0).project(camera);
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  let x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
  y = Math.max(y, w < 900 ? 112 : 96);
  plate.style.left = x + 'px'; plate.style.top = y + 'px';
  plate.style.opacity = focus === 'head' && view.zoom < 0.9 ? 0 : 1;
}

// ------------------------------------------------------------ UI: tabs + bodies
const TABS = [['hero', '🦸', 'Hero', 'full'], ...SLOTS.map(s => [s.key, s.icon, s.label, s.key === 'head' || s.key === 'face' ? 'head' : s.key === 'back' ? 'torso' : 'hands']), ['colors', '🎨', 'Colors', 'full'], ['name', '🏷️', 'Name', 'full']];
let tab = 'hero', heroFilter = 'all';
$('#tabs').innerHTML = TABS.map(([k, i, l]) => `<button class="tab" data-k="${k}"><i>${i}</i>${l}</button>`).join('');
$('#tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) { sfx.tap(); setTab(b.dataset.k); } });
function setTab(k) {
  tab = k; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const t = TABS.find(x => x[0] === k); setFocus(t[3]);
  if (k === 'back') { yawTarget = Math.PI * 0.82; } else if (k === 'head' || k === 'face') { yawTarget = 0.25; } else if (k === 'hand') { yawTarget = 0.5; }
  lastInteract = now; view.zoom = 1;
  renderChips(); renderBody(); $('#body').scrollTop = 0;
}
const thumb = id => `./assets/thumbs/${id}.webp`;
function renderChips() {
  const ch = $('#chips');
  if (tab === 'hero') ch.innerHTML = TAGS.map(([k, l]) => `<button class="chip ${heroFilter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
  else ch.innerHTML = '';
}
$('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; sfx.tap(); heroFilter = b.dataset.f; renderChips(); renderBody(); });

function renderBody() {
  const body = $('#body');
  if (tab === 'hero') {
    const list = CHARS.filter(c => heroFilter === 'all' || c.tags.includes(heroFilter)).sort((a, b) => (READY.has(b.id) - READY.has(a.id)));
    body.innerHTML = `<div class="grid">${list.map(c => { const r = READY.has(c.id); return `<button class="tile ${r ? '' : 'soon'} ${hero.char === c.id ? 'on' : ''}" data-c="${c.id}" style="--c:${TAG_COLOR[c.tags[0]]}">
      <img loading="lazy" src="${thumb(c.id)}" alt="" onerror="this.style.visibility='hidden'">${r ? '' : '<span class="badge">SOON</span>'}<span class="nm">${c.name}</span></button>`; }).join('')}</div>`;
  } else if (['head', 'face', 'back', 'hand'].includes(tab)) {
    const slotKeys = tab === 'hand' ? ['hand', 'offhand'] : [tab];
    const list = ITEMS.filter(i => slotKeys.includes(i.slot) && itemReady(i));
    const sel = slotKeys.map(s => hero.items[s]);
    const none = tab === 'hand'
      ? `<button class="tile none ${!hero.items.hand ? 'on' : ''}" data-none="hand"><span>✋</span><span class="nm">Empty hand</span></button>`
      : `<button class="tile none ${!hero.items[tab] ? 'on' : ''}" data-none="${tab}"><span>✕</span><span class="nm">None</span></button>`;
    body.innerHTML = `<div class="grid">${none}${list.map(i => `<button class="tile ${sel.includes(i.id) ? 'on' : ''}" data-i="${i.id}" style="--c:${TAG_COLOR[i.tags?.[0]] || '#7b5cff'}">
      <img loading="lazy" src="${thumb(i.id)}" alt="" onerror="this.style.visibility='hidden'"><span class="nm">${i.name}${i.slot === 'offhand' ? ' · off hand' : ''}</span></button>`).join('')}
      ${tab === 'hand' ? `<button class="tile none ${!hero.items.offhand ? 'on' : ''}" data-none="offhand"><span>🤚</span><span class="nm">Empty off hand</span></button>` : ''}</div>`;
  } else if (tab === 'colors') {
    const sws = [0, 0.08, 0.16, 0.3, 0.45, 0.55, 0.68, 0.8, 0.9];
    const hueCss = h => `hsl(${Math.round(((0.6 + h) % 1) * 360)},85%,58%)`;
    const ts = hero.tintSlot || 'head', tt = hero.tints?.[ts] || {};
    body.innerHTML = `
      <div class="sec">Outfit color <button data-act="reset">Reset</button></div>
      <div class="swatches">${sws.map(h => `<button class="sw ${Math.abs(hero.hue - h) < 0.005 ? 'on' : ''}" data-hue="${h}" style="background:${h === 0 ? 'conic-gradient(#ff5d8f,#ffd23f,#3ab795,#3a86ff,#7b5cff,#ff5d8f)' : hueCss(h)}" title="${h === 0 ? 'Original' : ''}"></button>`).join('')}</div>
      <div class="slider"><label><span>Hue shift</span><span id="vh">${Math.round(hero.hue * 360)}°</span></label><input type="range" id="rh" min="0" max="1" step="0.005" value="${hero.hue}" style="--trk:linear-gradient(90deg,#f33,#ff3,#3f3,#3ff,#33f,#f3f,#f33)"></div>
      <div class="slider"><label><span>Saturation</span><span id="vs">${Math.round(hero.sat * 100)}%</span></label><input type="range" id="rs" min="0" max="2" step="0.01" value="${hero.sat}" style="--trk:linear-gradient(90deg,#888,#ff2d95)"></div>
      <div class="slider"><label><span>Brightness</span><span id="vb">${Math.round(hero.bri * 100)}%</span></label><input type="range" id="rb" min="0.5" max="1.5" step="0.01" value="${hero.bri}" style="--trk:linear-gradient(90deg,#111,#fff)"></div>
      <div class="lock"><button class="tgl ${hero.lockSkin === false ? '' : 'on'}" id="lock"></button>Keep skin &amp; fur natural</div>
      <div class="sec">Gear tint</div>
      <div class="slotchips">${['head', 'face', 'back', 'hand', 'offhand'].map(s => `<button class="chip ${ts === s ? 'on' : ''}" data-ts="${s}">${{ head: 'Head', face: 'Face', back: 'Back', hand: 'Hand', offhand: 'Off hand' }[s]}${hero.items[s] ? '' : ' ·'}</button>`).join('')}</div>
      <div class="swatches">${sws.map(h => `<button class="sw ${Math.abs((tt.hue || 0) - h) < 0.005 ? 'on' : ''}" data-thue="${h}" style="background:${h === 0 ? 'conic-gradient(#ff5d8f,#ffd23f,#3ab795,#3a86ff,#7b5cff,#ff5d8f)' : hueCss(h)}"></button>`).join('')}</div>
      <div class="slider"><label><span>Gear brightness</span><span id="vtb">${Math.round((tt.bri ?? 1) * 100)}%</span></label><input type="range" id="rtb" min="0.4" max="1.6" step="0.01" value="${tt.bri ?? 1}" style="--trk:linear-gradient(90deg,#111,#fff)"></div>
      ${hero.items[ts] ? '' : `<p class="note">Nothing in that slot yet. Pick gear in the ${ts === 'offhand' ? 'Hands' : ts[0].toUpperCase() + ts.slice(1)} tab.</p>`}`;
  } else if (tab === 'name') {
    const sugg = Array.from({ length: 6 }, () => randomName());
    body.innerHTML = `
      <div class="sec">Hero name</div>
      <div class="namebox"><input id="nm" maxlength="14" placeholder="${charById(hero.char)?.name || 'Hero'}" value="${(hero.name || '').replace(/"/g, '&quot;')}" autocomplete="off" spellcheck="false"><button id="nmr" aria-label="Random name">🎲</button></div>
      <div class="sugg">${sugg.map(s => `<button data-n="${s}">${s}</button>`).join('')}</div>
      <p class="note">Your hero, name and gear are saved on this device and will <b>walk into AGENTPARK games</b> as they roll out. Tap <b>Save</b> to lock it in and get a share card.</p>`;
  }
}

$('#body').addEventListener('click', e => {
  const t = e.target.closest('[data-c],[data-i],[data-none],[data-hue],[data-thue],[data-ts],[data-n],[data-act],#lock,#nmr'); if (!t) return;
  const d = t.dataset;
  if (d.c) { selectChar(d.c).then(() => renderBody()); if (READY.has(d.c)) { document.querySelectorAll('.tile.on').forEach(x => x.classList.remove('on')); t.classList.add('on'); } }
  else if (d.i) {
    const it = itemById(d.i), slot = it.slot;
    const same = hero.items[slot] === d.i;
    equip(slot, same ? null : d.i); renderBody();
    if (slot === 'back') yawTarget = Math.PI * 0.82; else if (slot === 'hand' || slot === 'offhand') yawTarget = slot === 'hand' ? -0.5 : 0.7;
  }
  else if (d.none) { equip(d.none, null); renderBody(); }
  else if (d.hue !== undefined) { hero.hue = +d.hue; applyColors(); sfx.pick(2); renderBody(); }
  else if (d.thue !== undefined) { const s = hero.tintSlot || 'head'; hero.tints = hero.tints || {}; hero.tints[s] = { ...(hero.tints[s] || {}), hue: +d.thue }; applyColors(); sfx.pick(4); renderBody(); }
  else if (d.ts) { hero.tintSlot = d.ts; sfx.tap(); renderBody(); }
  else if (d.n) { hero.name = d.n; updatePlate(); sfx.pick(5); renderBody(); }
  else if (d.act === 'reset') { hero.hue = 0; hero.sat = 1; hero.bri = 1; hero.tints = {}; applyColors(); sfx.tap(); renderBody(); }
  else if (t.id === 'lock') { hero.lockSkin = hero.lockSkin === false; applyColors(); sfx.tap(); renderBody(); }
  else if (t.id === 'nmr') { hero.name = randomName(); updatePlate(); sfx.pick(5); renderBody(); }
});
$('#body').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'rh') { hero.hue = +t.value; $('#vh').textContent = Math.round(hero.hue * 360) + '°'; }
  else if (t.id === 'rs') { hero.sat = +t.value; $('#vs').textContent = Math.round(hero.sat * 100) + '%'; }
  else if (t.id === 'rb') { hero.bri = +t.value; $('#vb').textContent = Math.round(hero.bri * 100) + '%'; }
  else if (t.id === 'rtb') { const s = hero.tintSlot || 'head'; hero.tints = hero.tints || {}; hero.tints[s] = { ...(hero.tints[s] || {}), bri: +t.value }; $('#vtb').textContent = Math.round(+t.value * 100) + '%'; }
  else if (t.id === 'nm') { hero.name = t.value.replace(/[<>]/g, '').slice(0, 14); updatePlate(); return; }
  applyColors();
});
$('#body').addEventListener('change', e => { if (e.target.type === 'range') tone(600 + Math.random() * 200, 0.05, 'triangle', 0.06, 1.2); });

function randomName() { const r = a => a[Math.floor(Math.random() * a.length)]; return r(NAMES_A) + ' ' + r(NAMES_B); }

// ------------------------------------------------------------ randomize / save / share
async function randomize() {
  const r = a => a[Math.floor(Math.random() * a.length)];
  const chars = readyChars(); if (!chars.length) return;
  const c = r(chars);
  const pick = slot => { const l = ITEMS.filter(i => i.slot === slot && itemReady(i)); const prefer = l.filter(i => i.tags?.some(t => c.tags.includes(t))); return r(prefer.length && Math.random() < 0.6 ? prefer : l)?.id || null; };
  hero.items = {
    head: Math.random() < 0.75 ? pick('head') : null,
    face: Math.random() < 0.45 ? pick('face') : null,
    back: Math.random() < 0.6 ? pick('back') : null,
    hand: Math.random() < 0.7 ? pick('hand') : null,
    offhand: Math.random() < 0.25 ? pick('offhand') : null,
  };
  const tasteful = [0, 0, 0, 0, 0, 0, 0.08, 0.16, 0.5, 0.62, 0.75, 0.88];
  hero.hue = r(tasteful); hero.sat = Math.random() < 0.7 ? 1 : 0.8 + Math.random() * 0.5; hero.bri = 1;
  hero.tints = {}; if (Math.random() < 0.4) hero.tints.back = { hue: r(tasteful) };
  sfx.pick(1); tone(330, 0.3, 'triangle', 0.08, 2); spinVel = 0.35; lastInteract = now;
  if (c.id !== cur?.id) await selectChar(c.id, { silent: false });
  else { for (const s of ['head', 'face', 'back', 'hand', 'offhand']) await equip(s, hero.items[s], { silent: s !== 'head' }); applyColors(); }
  renderBody();
}
$('#rand').onclick = () => { $('#rand').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg) scale(1.15)' }, { transform: 'rotate(360deg)' }], { duration: 500 }); randomize(); };

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1800); }

async function save({ quiet = false } = {}) {
  writeHero(hero); saves++;
  if (quiet) return;
  sfx.win(); buzz([20, 40, 20]);
  const top = new THREE.Vector3(0, PED_H + (cur?.M.height || 1.7) * 0.9, 0);
  confetti(scene, top, 90); rimPulse = 1.5;
  play('cheer');
  const url = await shareCard();
  $('#mimg').src = url; $('#mdl').href = url;
  $('#mtitle').textContent = `${hero.name || charById(hero.char)?.name} is ready!`;
  $('#mtext').textContent = 'Saved on this device. Your hero will show up in AGENTPARK games as they get Hero Lab support.';
  setTimeout(() => $('#modal').classList.add('on'), 650);
}
$('#save').onclick = () => save();
$('#mdone').onclick = () => { $('#modal').classList.remove('on'); sfx.tap(); };
$('#mshare').onclick = async () => {
  try {
    const blob = await (await fetch($('#mimg').src)).blob(), file = new File([blob], 'my-agentpark-hero.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'My AGENTPARK hero', text: 'Built in Hero Lab on agentpark.co' });
    else { await navigator.clipboard?.writeText('https://agentpark.co'); toast('Link copied'); }
  } catch (e) {}
};

// 1200×630 share card: hero rendered on a square, name + gear on the right
async function shareCard() {
  const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1f7a'); g.addColorStop(0.55, '#5b2db5'); g.addColorStop(1, '#ff5dbb'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rg = x.createRadialGradient(330, 330, 20, 330, 330, 340); rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(0.55, 'rgba(234,228,255,.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = rg; x.fillRect(0, 0, 680, H);
  // render the hero square
  const pr = renderer.getPixelRatio(), size = renderer.getSize(new THREE.Vector2()), S = 600;
  const prevAspect = camera.aspect, pf = focus, pz = view.zoom;
  renderer.setPixelRatio(1); renderer.setSize(S, S, false); C.resize(S, S); camera.aspect = 1; camera.clearViewOffset(); focus = 'full'; view.zoom = 1;
  const M = cur?.M; const h = M ? M.height : 1.7;
  const dist = (h * 1.25 / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const yy = PED_H + h * 0.5;
  camera.position.set(Math.sin(0.0) * dist, yy + 0.12, dist); camera.lookAt(0, yy, 0); camera.updateProjectionMatrix();
  const saveYaw = pivot.rotation.y; pivot.rotation.y = 0.35; scene.background = null; renderer.setClearColor(0x000000, 0);
  C.grade.uniforms.uVignette.value = 0;
  renderer.render(scene, camera);
  x.drawImage(renderer.domElement, 30, 15, S, S);
  scene.background = bgTex; C.grade.uniforms.uVignette.value = 0.16; pivot.rotation.y = saveYaw;
  renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); C.resize(size.x, size.y); camera.aspect = prevAspect; camera.updateProjectionMatrix(); focus = pf; view.zoom = pz;
  // text
  x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '900 22px Rubik, sans-serif'; x.fillText('AGENTPARK  ·  HERO LAB', 660, 110);
  x.fillStyle = '#fff'; x.font = '82px "Lilita One", sans-serif';
  const name = (hero.name || charById(hero.char)?.name || 'Hero'); let fs = 82; while (x.measureText(name).width > 500 && fs > 40) { fs -= 4; x.font = `${fs}px "Lilita One", sans-serif`; }
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowOffsetY = 6; x.fillText(name, 656, 200); x.shadowColor = 'transparent';
  x.fillStyle = '#ffd23f'; x.font = '800 28px Rubik, sans-serif'; x.fillText((charById(hero.char)?.role || '').toUpperCase(), 660, 248);
  const gear = ['head', 'face', 'back', 'hand', 'offhand'].map(s => hero.items[s] && itemById(hero.items[s])).filter(Boolean);
  x.font = '700 26px Rubik, sans-serif';
  gear.slice(0, 5).forEach((it, i) => {
    const yy2 = 310 + i * 46; x.fillStyle = 'rgba(255,255,255,.14)'; roundRect(x, 656, yy2 - 31, 420, 40, 14); x.fill();
    x.fillStyle = '#fff'; x.fillText((SLOTS.find(s => s.key === (it.slot === 'offhand' ? 'hand' : it.slot))?.icon || '•') + '  ' + it.name, 672, yy2);
  });
  if (!gear.length) { x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('Classic look, no gear', 660, 310); }
  x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '800 24px Rubik, sans-serif'; x.fillText('Build yours at agentpark.co', 660, 580);
  return cv.toDataURL('image/png');
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
const bgTex = scene.background;

// ------------------------------------------------------------ loop
let now = 0, last = performance.now();
const clock = { t: 0 };
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; now = t / 1000; clock.t += dt;
  if (cur) {
    cur.mixer.update(dt);
    if (oneShotT > 0) { oneShotT -= dt; if (oneShotT <= 0) play('idle'); }
  }
  // turntable
  const idle = now - lastInteract;
  if (ptrs.size === 0) {
    if (yawTarget != null) { const d = Math.atan2(Math.sin(yawTarget - yaw), Math.cos(yawTarget - yaw)); yaw += d * Math.min(1, dt * 4); if (Math.abs(d) < 0.01) yawTarget = null; }
    else if (Math.abs(spinVel) > 0.0005) { yaw += spinVel; spinVel *= Math.pow(0.04, dt); }
    else if (idle > 3) yaw += dt * 0.32 * Math.min(1, (idle - 3) / 2);
  }
  pivot.rotation.y = yaw;
  // pop-in + item pops
  if (popIn > 0) { popIn = Math.max(0, popIn - dt * 2.4); const s = 1 + Math.sin(popIn * Math.PI) * 0.08 * popIn - popIn * 0.12; pivot.scale.setScalar(s); } else pivot.scale.setScalar(1);
  for (let i = popItems.length - 1; i >= 0; i--) { const p = popItems[i]; p.t += dt * 3.2; const e = p.t >= 1 ? 1 : 1 + Math.sin(p.t * Math.PI * 1.5) * (1 - p.t) * 0.5 - (1 - p.t) * (1 - p.t) * 0.3; p.o.scale.setScalar(Math.max(0.01, e)); if (p.t >= 1) { p.o.scale.setScalar(1); popItems.splice(i, 1); } }
  // rim pulse
  rimPulse = Math.max(0, rimPulse - dt * 1.5); rimMat.emissiveIntensity = 3.4 + Math.sin(clock.t * 2) * 0.5 + rimPulse * 5;
  arc.rotation.z = Math.sin(clock.t * 0.3) * 0.05; arc2.rotation.z = -Math.sin(clock.t * 0.25) * 0.05;
  // sparkles
  for (let i = 0; i < SPK; i++) { const s = spkSeed[i]; const yv = ((clock.t * s[3] + s[2]) % 3); spkPos[i * 3] = Math.cos(s[0] + clock.t * 0.1) * s[1]; spkPos[i * 3 + 1] = yv; spkPos[i * 3 + 2] = Math.sin(s[0] + clock.t * 0.1) * s[1] - 0.3; }
  spkGeo.attributes.position.needsUpdate = true;
  // camera ease
  view.y += (view.ty - view.y) * Math.min(1, dt * 5); view.dist += (view.tdist * view.zoom - view.dist) * Math.min(1, dt * 5);
  camera.position.set(0, view.y + view.dist * 0.05, view.dist); camera.lookAt(0, view.y, 0);
  const sw = stageEl.clientWidth, sh = stageEl.clientHeight; view.offS = (view.offS ?? 0) + ((view.off || 0) - (view.offS ?? 0)) * Math.min(1, dt * 5);
  camera.setViewOffset(sw, sh, 0, -view.offS, sw, sh);
  updateParticles(dt * 60);
  placePlate();
  C.render(dt);
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------ boot
resize(); setTab('hero');
await selectChar(hero.char, { silent: true });
renderBody();
requestAnimationFrame(t => { last = t; tick(t); });

// ------------------------------------------------------------ test hooks (node check.cjs herolab 30)
let botN = 0;
window.__game = {
  get state() { return 'play'; }, get level() { return 1; }, get score() { return saves; },
  hero: () => JSON.parse(JSON.stringify(hero)), cur: () => cur && { id: cur.id, M: { height: cur.M.height, head: cur.M.head, chest: cur.M.chest } },
  selectChar, equip, play, randomize, setTab, save, shareCard,
  bot() {
    botN++; if (loading || botN % 7) return;
    const r = Math.random(), pickA = a => a[Math.floor(Math.random() * a.length)];
    if (r < 0.2) { setTab('hero'); selectChar(pickA(readyChars()).id); }
    else if (r < 0.62) { const it = pickA(ITEMS.filter(itemReady)); setTab(it.slot === 'offhand' ? 'hand' : it.slot); equip(it.slot, it.id); renderBody(); }
    else if (r < 0.75) randomize();
    else if (r < 0.88) play(pickA(['run', 'jump', 'cheer', 'slide']));
    else if (r < 0.95) { setTab('colors'); hero.hue = Math.random(); applyColors(); renderBody(); }
    else { hero.name = randomName(); updatePlate(); save({ quiet: true }); }
  },
};
window.__dbg = { scene, C, renderer, camera, THREE };
window.__ready = true;

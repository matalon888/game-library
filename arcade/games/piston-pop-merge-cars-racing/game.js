// Piston Pop — original merge-and-race. Merge two alike cars into a better one in your parking lot, then fling the best
// car off a slingshot onto a floating sky track: hold to boost, fly off kickers, and see how far it goes.
import { THREE, createStage, createUI, loop, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { carModel, TIERS, merge as mergeGeo, vmat } from './cars.js';

const NAME = 'Piston Pop: Merge Cars Racing';
const S = store('pistonpop');
const F = flow('pistonpop');
const stage = createStage({ fov: 50, shadowSize: 14 });
const { scene, camera, sun, hemi, renderer } = stage;
hemi.intensity = 1.2; sun.intensity = 1.6;
const ui = createUI({ title: 'PISTON<br>POP', hint: 'Tap to start', hand: '👆' });
const D = daily('pistonpop', ui, { name: NAME });
const B = board({ game: 'piston-pop', label: 'Metres', limits: { maxRun: 6000, maxPerSec: 120 }, corner: 'tl' });
document.body.style.setProperty('--bg1', '#7cc8ff'); document.body.style.setProperty('--bg2', '#e3f6ff'); document.body.style.setProperty('--ui', '#ff5d3a');

// ---------------------------------------------------------------- persistent
let coins = S.get('coins', 30), buys = S.get('buys', 0), level = S.get('level', 1), bestEver = S.get('best', 0), topTier = S.get('top', 0);
let slots = S.get('slots', [0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]);
const DAY = new Date().toISOString().slice(0, 10); let bestToday = S.get('bt_' + DAY, 0);
const saveAll = () => { S.set('coins', coins); S.set('buys', buys); S.set('level', level); S.set('best', bestEver); S.set('slots', slots); S.set('top', topTier); };
const target = () => D.isDaily ? 400 : Math.round(120 + (level - 1) * 85 + Math.pow(level - 1, 1.5) * 14);
const buyCost = () => Math.round(10 * Math.pow(1.17, buys));
const buyTier = () => clamp(topTier - 4, 0, 7);

// ---------------------------------------------------------------- DOM UI
const css = document.createElement('style'); css.textContent = `
.hc-card h1{text-shadow:0 6px 0 #c4401c,0 10px 22px rgba(120,30,0,.25)}
.hc-card p,.hc-card .hint{text-shadow:0 2px 0 rgba(120,40,10,.45)}
.hc-card.dim{background:rgba(20,40,80,.3)}
.hc-pop{-webkit-text-stroke:2px rgba(120,40,10,.45);paint-order:stroke fill}
.pp-chip{position:fixed;top:calc(60px + env(safe-area-inset-top));background:rgba(20,40,80,.45);color:#fff;border-radius:16px;padding:2px 12px 1px;font:800 17px 'Baloo 2',system-ui;z-index:6;pointer-events:none}
.pp-coins{right:10px}.pp-best{left:10px}
.pp-bar{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));display:flex;gap:10px;justify-content:center;z-index:6;padding:0 12px}
.pp-btn{flex:1;max-width:190px;border:0;border-radius:22px;font:800 20px/1.1 'Baloo 2',system-ui;color:#fff;padding:12px 10px 10px;box-shadow:0 6px 0 rgba(0,0,0,.2);cursor:pointer}
.pp-btn small{display:block;font-size:13px;opacity:.9}
.pp-btn:active{transform:translateY(4px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.pp-buy{background:#3fa9f5}.pp-buy.no{background:#9fb6c8}.pp-race{background:#ff5d3a;animation:pprace 1.2s ease-in-out infinite}@keyframes pprace{50%{transform:scale(1.04)}}
.pp-speed{position:fixed;left:14px;bottom:calc(20px + env(safe-area-inset-bottom));width:92px;height:92px;border-radius:50%;background:rgba(20,30,60,.55);z-index:6;display:grid;place-items:center;color:#fff;font:800 28px/1 'Baloo 2',system-ui;text-align:center;pointer-events:none}
.pp-speed small{display:block;font-size:12px;opacity:.8}
.pp-fuel{position:fixed;right:18px;top:38%;width:16px;height:30%;border-radius:10px;background:rgba(20,30,60,.45);z-index:6;overflow:hidden;pointer-events:none}.pp-fuel i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(#ffd23f,#ff8a3c);border-radius:10px}
.pp-fuel b{position:absolute;top:-22px;right:-6px;font:800 14px 'Baloo 2';color:#fff}
.pp-hint{position:fixed;left:0;right:0;bottom:calc(130px + env(safe-area-inset-bottom));text-align:center;color:#fff;font:800 22px 'Baloo 2',system-ui;text-shadow:0 3px 0 rgba(20,40,80,.4);z-index:6;pointer-events:none;animation:hcpulse 1.2s ease-in-out infinite}
.pp-tag{position:fixed;transform:translate(-50%,-50%);z-index:4;pointer-events:none;background:#fff;color:#2b2d42;border-radius:10px;padding:0 7px;font:800 14px 'Baloo 2',system-ui;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.pp-name{position:fixed;left:0;right:0;top:calc(108px + env(safe-area-inset-top));text-align:center;color:#fff;font:800 16px 'Baloo 2',system-ui;text-shadow:0 2px 0 rgba(20,40,80,.4);z-index:5;pointer-events:none}`;
document.head.appendChild(css);
const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const coinsEl = el(`<div class="pp-chip pp-coins"></div>`), bestEl = el(`<div class="pp-chip pp-best"></div>`);
const barEl = el(`<div class="pp-bar"><button class="pp-btn pp-buy"></button><button class="pp-btn pp-race">🏁 RACE<small></small></button></div>`);
const speedEl = el(`<div class="pp-speed"><div><span>0</span><small>km/h</small></div></div>`), fuelEl = el(`<div class="pp-fuel"><i></i></div>`), hintEl = el(`<div class="pp-hint"></div>`), nameEl = el(`<div class="pp-name"></div>`);
document.body.append(coinsEl, bestEl, barEl, speedEl, fuelEl, hintEl, nameEl);
barEl.addEventListener('pointerdown', e => e.stopPropagation());
barEl.querySelector('.pp-buy').addEventListener('click', e => { e.stopPropagation(); buyCar(); });
barEl.querySelector('.pp-race').addEventListener('click', e => { e.stopPropagation(); startRace(); });
function hud() {
  coinsEl.textContent = '🪙 ' + coins; bestEl.textContent = '🏁 ' + Math.max(bestToday, 0) + ' m today';
  const b = barEl.querySelector('.pp-buy'), c = buyCost(); b.innerHTML = `🚗 BUY<small>🪙${c} · ${TIERS[buyTier()].name}</small>`; b.classList.toggle('no', coins < c || !slots.includes(-1));
  const bt = bestTier(); barEl.querySelector('.pp-race small').textContent = bt >= 0 ? TIERS[bt].name : '';
}
function showGarageUI(on) { barEl.style.display = on ? 'flex' : 'none'; coinsEl.style.display = bestEl.style.display = on ? 'block' : 'none'; speedEl.style.display = fuelEl.style.display = on ? 'none' : 'grid'; fuelEl.style.display = on ? 'none' : 'block'; ui.els.sc.classList.toggle('hc-hidden', on); }

// ---------------------------------------------------------------- shared scenery
const sky = new THREE.Group(); scene.add(sky);
const cloudG = new THREE.SphereGeometry(1, 12, 9), cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 1, transparent: true, opacity: 0.92 });

// ---------------------------------------------------------------- garage
const garage = new THREE.Group(); scene.add(garage);
const SLOT = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) SLOT.push(new THREE.Vector3((c - 1) * 2.35, 0, (r - 1.5) * 3.0));
{
  const parts = [], R = (w, h, d, r) => { const g = rounded(w - 1.8 * r, d - 1.8 * r, h, r); g.rotateX(-Math.PI / 2); return g; };
  const Mx = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  parts.push([R(8.4, 0.3, 13.2, 0.2), Mx(0, -0.15, 0), '#59606e']);
  for (const p of SLOT) { parts.push([new THREE.BoxGeometry(0.08, 0.02, 2.5), Mx(p.x - 1.12, 0.01, p.z), '#ffffff'], [new THREE.BoxGeometry(0.08, 0.02, 2.5), Mx(p.x + 1.12, 0.01, p.z), '#ffffff'], [new THREE.BoxGeometry(2.3, 0.02, 0.08), Mx(p.x, 0.01, p.z - 1.24), '#ffffff']); }
  parts.push([R(9.6, 2.6, 0.6, 0.12), Mx(0, 1.15, -7.1), '#ff8a5c'], [R(9.8, 0.4, 0.8, 0.1), Mx(0, 2.55, -7.1), '#ffffff'], [R(3, 1.8, 0.1, 0.08), Mx(0, 0.9, -6.75), '#3d4452']);
  for (const x of [-4.6, 4.6]) parts.push([new THREE.ConeGeometry(0.3, 0.7, 12), Mx(x, 0.35, 5.8), '#ff7a2a'], [new THREE.CylinderGeometry(0.31, 0.31, 0.08, 12), Mx(x, 0.35, 5.8), '#ffffff']);
  for (const [x, z] of [[-4.7, -4], [4.7, -2], [-4.7, 3]]) parts.push([new THREE.TorusGeometry(0.35, 0.14, 8, 16).rotateX(Math.PI / 2), Mx(x, 0.14, z), '#2b2d42'], [new THREE.TorusGeometry(0.35, 0.14, 8, 16).rotateX(Math.PI / 2), Mx(x, 0.42, z), '#2b2d42']);
  const lot = new THREE.Mesh(mergeGeo(parts), vmat({ roughness: 0.8, metalness: 0 })); lot.receiveShadow = true; lot.castShadow = true; garage.add(lot);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#8fd47a', roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.3; grass.receiveShadow = true; garage.add(grass);
}
const carObjs = new Array(12).fill(null);
const tags = SLOT.map(() => { const d = document.createElement('div'); d.className = 'pp-tag'; d.style.display = 'none'; document.body.appendChild(d); return d; });
const scr = new THREE.Vector3();
function placeCar(i, pop = false) {
  if (carObjs[i]) { garage.remove(carObjs[i]); carObjs[i] = null; }
  if (slots[i] < 0) return;
  const m = carModel(slots[i]); m.position.copy(SLOT[i]); m.rotation.y = Math.PI; garage.add(m); carObjs[i] = m; m.pop = pop ? performance.now() : 0;
}
function bestTier() { return Math.max(...slots); }
function buyCar() {
  const c = buyCost(), i = slots.indexOf(-1);
  if (i < 0) { ui.pop('Lot is full — merge!', '#fff', 26, 30); tone(240, 0.1, 'sine', 0.08, 0.8); return false; }
  if (coins < c) { ui.pop('Race for more coins!', '#fff', 26, 30); tone(240, 0.1, 'sine', 0.08, 0.8); return false; }
  coins -= c; buys++; slots[i] = buyTier(); placeCar(i, true); sfx.coin(); burst(scene, SLOT[i].clone().setY(0.5), ['#ffd23f', '#ffffff'], 14, { speed: 0.08, up: 0.1 }); buzz(8); saveAll(); hud(); return true;
}
function mergeCars(a, b) {
  const t = slots[b] + 1; slots[a] = -1; slots[b] = t; placeCar(a); placeCar(b, true);
  const isNew = t > topTier; if (isNew) topTier = t;
  burst(scene, SLOT[b].clone().setY(0.8), ['#ffd23f', '#ffffff', TIERS[t].c], 26, { speed: 0.12, up: 0.14 });
  [60, 64, 67, 72].slice(0, isNew ? 4 : 2).forEach((n, k) => setTimeout(() => note(n + t, 0.25, 0.12), k * 70)); buzz(isNew ? [15, 30, 15] : 12);
  ui.pop(isNew ? `NEW CAR! ${TIERS[t].name}` : TIERS[t].name, '#fff', isNew ? 30 : 26, 26); if (isNew) confetti(scene, SLOT[b].clone().setY(1), 50);
  saveAll(); hud();
}

// ---------------------------------------------------------------- race track (generated, endless, chunked)
const race = new THREE.Group(); scene.add(race); race.visible = false;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 4000), new THREE.MeshStandardMaterial({ color: '#7fcf6e', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -14, 1800); race.add(ground);
let feats = [], featEnd = 0, trand = Math.random, fk = 1;
function genFeatures(upto) {
  while (featEnd < upto) {
    const s0 = featEnd + 14 + trand() * 22, d = s0 / 100;
    if (s0 < 30 || trand() < 0.45) { const L = 30 + trand() * 30, Hh = clamp((2.2 + d * 0.8 + trand() * 2.5) * fk, 1.5, 14); feats.push({ type: 'hill', s0, L, H: Hh }); featEnd = s0 + L; }
    else { const R = 9 + trand() * 4, Hk = 1.6 + trand() * 1.4; feats.push({ type: 'kick', s0, L: R, H: Hk }); featEnd = s0 + R; }
  }
}
function h(s) {
  for (let lo = 0, hi = feats.length - 1; lo <= hi;) { const m = (lo + hi) >> 1, f = feats[m]; if (s < f.s0) hi = m - 1; else if (s > f.s0 + f.L) lo = m + 1;
    else { const x = (s - f.s0) / f.L; return f.type === 'hill' ? f.H * (1 - Math.cos(x * Math.PI * 2)) / 2 : f.H * x * x; } }
  return 0;
}
const THEMES = [{ a: '#ffffff', b: '#d9dde6', side: '#7a8496', curb: '#ff5d5d' }, { a: '#ffd6e4', b: '#ffbfd2', side: '#c77a9a', curb: '#7b5cff' }, { a: '#d6f5ff', b: '#bde8fb', side: '#6a9ac0', curb: '#ff8a3c' }, { a: '#fff3c4', b: '#ffe89a', side: '#c79a4a', curb: '#3ab795' }];
const chunks = new Map(); const CH = 80;
function buildChunk(ci) {
  const th = THEMES[(level - 1 + ci * 0) % THEMES.length], pos = [], col = [], idx = [], c = new THREE.Color(), push = (x, y, z, cc) => { pos.push(x, y, z); c.set(cc); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  const W2 = 2.4, s0 = ci * CH, n = CH * 2;
  for (let i = 0; i <= n; i++) {
    const s = s0 + i * 0.5, y = h(s), stripe = new THREE.Color().setHSL(((s / 260) + level * 0.13) % 1, 0.75, Math.floor(s / 4) % 2 ? 0.74 : 0.66).getStyle(), curb = Math.floor(s / 2) % 2 ? th.curb : '#ffffff';
    push(-W2, y, s, stripe); push(W2, y, s, stripe); push(-W2 - 0.35, y + 0.08, s, curb); push(W2 + 0.35, y + 0.08, s, curb); push(-W2 - 0.35, y - 1.2, s, th.side); push(W2 + 0.35, y - 1.2, s, th.side);
    if (i) { const a = (i - 1) * 6, b = i * 6; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, b + 2, a, a, b + 2, b, a + 1, b + 1, a + 3, a + 3, b + 1, b + 3, a + 4, b + 4, a + 2, a + 2, b + 4, b + 2, a + 3, b + 3, a + 5, a + 5, b + 3, b + 5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); m.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(m);
  // pillars, markers, trees below
  const parts = [], Mx = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  for (let s = s0 + 10; s < s0 + CH; s += 20) { const y = h(s); parts.push([new THREE.CylinderGeometry(0.4, 0.55, 1, 10), Mx(0, (y - 1.2 - 14) / 2 - 0.6, s, 1, y - 1.2 + 14, 1), '#cfd6e2']); }
  for (let k = 0; k < 10; k++) { const side = k % 2 ? 1 : -1, x = side * (9 + trand() * 30), s = s0 + trand() * CH, sc = 1.5 + trand() * 2.5; parts.push([new THREE.CylinderGeometry(0.3 * sc, 0.4 * sc, 1.4 * sc, 7), Mx(x, -14 + 0.7 * sc, s), '#8f5c2c'], [new THREE.ConeGeometry(1.4 * sc, 3.2 * sc, 8), Mx(x, -14 + 2.8 * sc, s), k % 3 ? '#3f9a4e' : '#5cbf55']); }
  for (let s = Math.ceil(s0 / 50) * 50; s < s0 + CH; s += 50) if (s > 0) { const y = h(s), tgt = Math.abs(s - target()) < 25; for (const x of [-2.9, 2.9]) parts.push([new THREE.BoxGeometry(0.25, 6.6, 0.25), Mx(x, y + 3.3, s), tgt ? '#2b2d42' : '#ffffff']); parts.push([new THREE.BoxGeometry(6.0, 0.6, 0.25), Mx(0, y + 6.8, s), tgt ? '#ffd23f' : s % 100 ? '#3fa9f5' : '#ff5d8f']); }
  const deco = new THREE.Mesh(mergeGeo(parts), vmat({ roughness: 0.7, metalness: 0 })); deco.castShadow = true; grp.add(deco);
  for (let s = Math.ceil(s0 / 50) * 50; s < s0 + CH; s += 50) if (s > 0) { const sp = label(s + ' m'); sp.position.set(0, h(s) + 6.8, s - 0.2); grp.add(sp); }
  // target gate
  const T = target(); if (T >= s0 && T < s0 + CH) { const y = h(T); const gate = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.06, 1.2), new THREE.MeshBasicMaterial({ map: checker() })); gate.position.set(0, y + 0.05, T); grp.add(gate); const sp = label('GOAL ' + T + ' m', '#ffd23f'); sp.position.set(0, y + 8.0, T - 0.2); sp.scale.multiplyScalar(1.3); grp.add(sp); }
  race.add(grp); chunks.set(ci, grp);
}
let checkTex = null; function checker() { if (checkTex) return checkTex; const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); } checkTex = new THREE.CanvasTexture(c); checkTex.magFilter = THREE.NearestFilter; return checkTex; }
function label(txt, color = '#ffffff') { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = '800 40px "Baloo 2",system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = 'rgba(20,40,80,.6)'; x.strokeText(txt, 128, 34); x.fillStyle = color; x.fillText(txt, 128, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false })); sp.rotation.y = Math.PI; return sp; }
function ensureChunks(s) { const a = Math.max(0, Math.floor((s - 40) / CH)), b = Math.floor((s + 220) / CH); genFeatures((b + 1) * CH + 60); for (let i = a; i <= b; i++) if (!chunks.has(i)) buildChunk(i); for (const [i, g] of chunks) if (i < a - 1) { race.remove(g); chunks.delete(i); } }
function clearTrack() { for (const [, g] of chunks) race.remove(g); chunks.clear(); feats = []; featEnd = 0; }
// launcher (two posts + elastic bands)
const launcher = new THREE.Group(); race.add(launcher);
{ const p = []; const Mx = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z); for (const x of [-1.6, 1.6]) p.push([new THREE.CylinderGeometry(0.12, 0.12, 1.6, 10), Mx(x, 0.8, 1.2), '#c8955a'], [new THREE.SphereGeometry(0.18, 10, 8), Mx(x, 1.6, 1.2), '#ff5d3a']); p.push([new THREE.BoxGeometry(5.2, 0.05, 3), Mx(0, 0.03, -1.6), '#ffd23f']); const m = new THREE.Mesh(mergeGeo(p), vmat()); m.castShadow = true; launcher.add(m); }
const bandM = new THREE.LineBasicMaterial({ color: '#ff3b3b', linewidth: 2 }); const bandG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]); const band = new THREE.Line(bandG, bandM); launcher.add(band);
const bandTube = []; for (let i = 0; i < 2; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshStandardMaterial({ color: '#ff3b3b' })); launcher.add(t); bandTube.push(t); }
function setBand(i, a, b) { const t = bandTube[i], d = b.clone().sub(a); t.position.copy(a).addScaledVector(d, 0.5); t.scale.set(1, d.length(), 1); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); }
for (let i = 0; i < 18; i++) { const c = new THREE.Mesh(cloudG, cloudM); c.scale.set(3 + Math.random() * 4, 1.2 + Math.random(), 2 + Math.random() * 2); c.position.set((Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 30), 4 + Math.random() * 12, Math.random() * 400); race.add(c); }

// ---------------------------------------------------------------- race state
let state = 'ready', mode = 'garage', R = null, recorded = false, beatenShown = false, holding = false;
function stats(t) { return { v0: 17 + 2.4 * t, P: 6 + 1.5 * t, fuel: 2.0 + 0.32 * t, vmax: 24 + 3.8 * t }; }
function startRace() {
  if (state !== 'play' || mode !== 'garage') return; tags.forEach(d => d.style.display = 'none'); const t = bestTier(); if (t < 0) { ui.pop('Buy a car first!', '#fff', 26, 30); return; }
  mode = 'race'; garage.visible = false; race.visible = true; showGarageUI(false); B.start();
  fk = F.k(); trand = D.seed ? rng(D.seed) : rng(level * 911 + 17); clearTrack(); ensureChunks(0);
  const car = carModel(t); race.add(car);
  R = { t, car, st: stats(t), s: -0.2, y: 0, v: 0, vy: 0, air: false, phase: 'aim', power: 0, fuel: 0, t0: performance.now(), stopT: 0, maxS: 0, pitch: 0, spin: 0, landT: 0 };
  R.fuel = R.st.fuel; recorded = false; beatenShown = false;
  nameEl.textContent = TIERS[t].name; hintEl.textContent = 'Hold & release to launch!'; hintEl.style.display = 'block';
  ui.score(0); ui.levels(D.isDaily ? 1 : level); ui.progress(0); tone(200, 0.2, 'sawtooth', 0.05, 1.5);
}
function launch() { const p = R.power; R.phase = 'drive'; R.v = R.st.v0 * (0.3 + 0.7 * p); R.s = 0; hintEl.textContent = 'Hold to boost!'; tone(300, 0.25, 'square', 0.08, 2.5); buzz(20); burst(scene, new THREE.Vector3(0, 0.4, 0), ['#ffffff', '#ffd23f'], 16, { speed: 0.1, up: 0.08 }); }
function endRace() {
  if (!R || R.phase === 'done') return; R.phase = 'done'; const dist = Math.floor(R.maxS), T = target(), won = dist >= T;
  const earned = Math.round(dist * 0.22 * (1 + 0.12 * R.t)) + 5; coins += earned;
  if (!recorded) { recorded = true; F.level(won, dist / T); B.submit(dist, { ms: performance.now() - R.t0 }); }
  if (dist > bestToday) { bestToday = dist; S.set('bt_' + DAY, dist); } if (dist > bestEver) bestEver = dist;
  hintEl.style.display = 'none'; nameEl.textContent = '';
  if (won) { state = 'won'; D.won(dist, 'drove'); if (!D.isDaily) level++; saveAll(); sfx.win(); confetti(scene, R.car.position.clone().setY(R.y + 2), 90); ui.win(D.isDaily ? 'DAILY' : level - 1, `${dist} m · 🪙+${earned}`); ui.els.win.querySelector('h1').textContent = 'GOAL!'; }
  else { state = 'lost'; saveAll(); sfx.fail(); ui.lose(`${dist} m`, `Goal ${T} m · 🪙+${earned} · merge a faster car!`); }
}
function backToGarage() { mode = 'garage'; if (R) { race.remove(R.car); R = null; } race.visible = false; garage.visible = true; showGarageUI(true); hud(); ui.levels(D.isDaily ? 1 : level); ui.progress(Math.min(1, bestToday / target())); }

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hp = new THREE.Vector3();
let drag = null;
function groundAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hp) ? hp.clone() : null; }
const nearestSlot = (p, r = 1.4) => { let bi = -1, bd = r; SLOT.forEach((s, i) => { const d = Math.hypot(p.x - s.x, (p.z - s.z) * 0.8); if (d < bd) { bd = d; bi = i; } }); return bi; };
addEventListener('pointerdown', e => {
  if (state !== 'play') return; holding = true;
  if (mode === 'garage') { const p = groundAt(e.clientX, e.clientY); if (!p) return; const i = nearestSlot(p); if (i >= 0 && slots[i] >= 0) { drag = { i, m: carObjs[i] }; tone(500, 0.05, 'sine', 0.08, 1.3); } }
});
addEventListener('pointermove', e => { if (!drag) return; const p = groundAt(e.clientX, e.clientY); if (p) { drag.m.position.set(p.x, 0.7, p.z); } });
addEventListener('pointerup', e => {
  holding = false;
  if (mode === 'race' && R && R.phase === 'aim' && R.power > 0.05 && state === 'play') launch();
  if (!drag) return; const d = drag; drag = null; const p = groundAt(e.clientX, e.clientY); const j = p ? nearestSlot(p) : -1;
  if (j >= 0 && j !== d.i) {
    if (slots[j] === slots[d.i] && slots[j] < TIERS.length - 1) return mergeCars(d.i, j);
    [slots[j], slots[d.i]] = [slots[d.i], slots[j]]; placeCar(d.i); placeCar(j); tone(400, 0.05, 'triangle', 0.08, 1); saveAll(); return;
  }
  d.m.position.copy(SLOT[d.i]);
});
addEventListener('keydown', e => { if (e.code === 'Space') { holding = true; } });
addEventListener('keyup', e => { if (e.code === 'Space') { holding = false; if (mode === 'race' && R && R.phase === 'aim' && R.power > 0.05) launch(); } });

// ---------------------------------------------------------------- frame
const G = 9.8, cv = new THREE.Vector3(), look = new THREE.Vector3();
let camPos = new THREE.Vector3(0, 13, 10);
function update(dt, t) {
  const now = performance.now();
  if (mode === 'garage') {
    const aspect = innerWidth / innerHeight, want = aspect < 0.8 ? 9 : 14;
    camera.fov = clamp(Math.max(2 * Math.atan(Math.tan(Math.atan(want / 2 / 16)) / aspect) * 180 / Math.PI, 56), 30, 78); camera.updateProjectionMatrix();
    camPos.lerp(new THREE.Vector3(0, 13.5, 9.2), 0.1); camera.position.copy(camPos); camera.lookAt(0, 0, 0.6); stage.followLight(new THREE.Vector3(0, 0, 0));
    carObjs.forEach((m, i) => { if (!m || (drag && drag.m === m)) return; const k = m.pop ? (now - m.pop) / 1000 : 9; const s = k < 0.8 ? 1 + Math.sin(k * 16) * Math.exp(-k * 5) * 0.35 : 1; m.scale.setScalar(s); m.position.y = Math.max(0, Math.sin(k * 10) * Math.exp(-k * 6) * 0.6);
      // glow a pair you could merge
      m.rotation.y = Math.PI + (drag && slots[i] === slots[drag.i] ? Math.sin(t * 12) * 0.08 : 0); });
    tags.forEach((d, i) => { const m = carObjs[i]; if (!m || state === 'ready') { d.style.display = 'none'; return; } scr.copy(m.position).setY(m.position.y + 1.3).project(camera); d.style.display = 'block'; d.style.left = (scr.x + 1) / 2 * innerWidth + 'px'; d.style.top = (1 - scr.y) / 2 * innerHeight + 'px'; d.textContent = 'Lv ' + (slots[i] + 1); });
    return;
  }
  if (!R) return;
  const st = R.st;
  if (R.phase === 'aim') { if (holding && state === 'play') R.power = Math.min(1, R.power + dt / 55); R.s = -0.2 - R.power * 2.6; R.y = 0; if (holding && Math.random() < 0.3) tone(150 + R.power * 300, 0.04, 'sawtooth', 0.02, 1.1); }
  else if (R.phase === 'drive') {
    const steps = 4, h1 = dt / 60 / steps;
    for (let k = 0; k < steps; k++) {
      const thr = holding && R.fuel > 0 && state === 'play';
      if (thr) R.fuel = Math.max(0, R.fuel - h1);
      if (!R.air) {
        const sl = (h(R.s + 0.25) - h(R.s - 0.25)) / 0.5, ang = Math.atan(sl);
        let a = (thr ? st.P : 0) - G * Math.sin(ang) * 0.85 - 0.006 * R.v * R.v - (R.v > 0 ? 1.1 : 0);
        if (thr && R.v > st.vmax) a = Math.min(a, 0);
        R.v = Math.max(R.v + a * h1, -6);
        const ns = R.s + R.v * Math.cos(ang) * h1, ny = h(ns), vy = R.v * Math.sin(ang);
        const flyY = R.y + vy * h1; // launch off a kicker lip when the ground falls away faster than gravity can follow
        if (ny < R.y - 0.25 && flyY > ny + 0.05) { R.air = true; R.vy = vy; R.v = R.v * Math.cos(ang); R.s = ns; R.y = flyY; sfx.bounce(); burst(scene, new THREE.Vector3(0, R.y, R.s), ['#ffd23f', '#ffffff'], 10, { speed: 0.08, up: 0.05 }); }
        else { R.s = ns; R.y = ny; R.pitch = lerp(R.pitch, -ang, 0.3); }
      } else {
        R.vy -= G * h1; R.s += R.v * h1; R.y += R.vy * h1; R.v -= 0.004 * R.v * R.v * h1 - (thr ? st.P * 0.4 * h1 : 0);
        R.pitch = lerp(R.pitch, -Math.atan2(R.vy, Math.max(1, R.v)) * 0.8, 0.1);
        const gy = h(R.s); if (R.y <= gy) { R.y = gy; R.air = false; R.vy = 0; R.landT = now; const imp = Math.min(1, Math.abs(R.pitch) + 0.3); burst(scene, new THREE.Vector3(0, gy + 0.1, R.s), ['#ffffff', '#d9dde6'], 12, { speed: 0.1, up: 0.06 }); tone(120, 0.12, 'square', 0.08 * imp, 0.6); buzz(15); }
      }
    }
    R.maxS = Math.max(R.maxS, R.s);
    if (!R.air && R.v < 0.4) { R.stopT += dt; if (R.stopT > 40) endRace(); } else R.stopT = 0;
    if (R.s < R.maxS - 25) endRace();
    ensureChunks(R.s);
    if (R.fuel <= 0) hintEl.style.display = 'none';
    const d = Math.floor(R.maxS); ui.score(d + ' m'); ui.progress(d / target());
    if (!beatenShown && D.beaten(d)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, R.y + 2, R.s + 3), 50); }
    if (d >= target() && !R.goalShown) { R.goalShown = true; ui.pop('GOAL!', '#ffe36a', 44, 30); confetti(scene, new THREE.Vector3(0, R.y + 2, R.s + 4), 70); note(84, 0.4, 0.14); }
    if (holding && R.fuel > 0 && Math.random() < 0.5) burst(scene, new THREE.Vector3((Math.random() - 0.5) * 0.4, R.y + 0.4, R.s - 1.3), ['#ffd23f', '#ff8a3c', '#ffffff'], 1, { speed: 0.03, up: 0.02, size: 0.6, gravity: 0 });
    if (holding && R.fuel > 0 && Math.random() < 0.15) tone(90 + R.v * 4, 0.06, 'sawtooth', 0.03, 1.05);
  }
  // car pose
  const car = R.car; car.position.set(0, R.y, R.s); car.rotation.x = R.pitch; R.spin += R.v * dt / 60 / 0.35; car.wheels.forEach(w => w.rotation.x = R.spin);
  const land = R.landT ? (now - R.landT) / 1000 : 9; car.scale.set(1 + Math.max(0, 0.15 - land * 0.6), 1 - Math.max(0, 0.15 - land * 0.6), 1);
  if (car.flame) { car.flame.visible = holding && R.fuel > 0 && R.phase === 'drive'; car.flame.scale.setScalar(0.8 + Math.random() * 0.5); }
  // bands
  const back = new THREE.Vector3(0, 0.55, R.s - 1.0), L = new THREE.Vector3(-1.6, 1.5, 1.2), Rr = new THREE.Vector3(1.6, 1.5, 1.2);
  launcher.visible = R.s < 30; if (R.phase === 'aim') { setBand(0, L, back); setBand(1, Rr, back); } else { setBand(0, L, new THREE.Vector3(-0.2, 1.0, 1.2)); setBand(1, Rr, new THREE.Vector3(0.2, 1.0, 1.2)); }
  // camera: chase from behind and above
  const aspect = innerWidth / innerHeight; camera.fov = aspect < 0.8 ? 62 : 50; camera.updateProjectionMatrix();
  const spd = clamp(R.v / 40, 0, 1);
  cv.set(0, R.y + 4.2 + spd * 1.5, R.s - 8.5 - spd * 3); camPos.lerp(cv, R.phase === 'aim' ? 0.2 : 0.12); camera.position.copy(camPos);
  look.set(0, R.y + 0.8, R.s + 6); camera.lookAt(look); stage.followLight(new THREE.Vector3(0, R.y, R.s + 4));
  speedEl.querySelector('span').textContent = Math.round(Math.max(0, R.v) * 3.6);
  fuelEl.querySelector('i').style.height = (R.fuel / st.fuel * 100) + '%';
}
loop(update);
for (let i = 0; i < 12; i++) placeCar(i);
showGarageUI(true); hud(); ui.progress(Math.min(1, bestToday / target())); ui.levels(D.isDaily ? 1 : level); speedEl.style.display = fuelEl.style.display = 'none';
barEl.style.display = 'none';
ui.onTap(w => {
  state = 'play';
  if (w === 'start') { barEl.style.display = 'flex'; return; }
  if (w === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  backToGarage();
});
ui.start();

// ---------------------------------------------------------------- test hook
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.max(bestToday, R ? Math.floor(R.maxS) : 0); },
  bot() {
    if (state !== 'play') return;
    if (mode === 'garage') {
      const seen = {}; for (let i = 0; i < 12; i++) { const t = slots[i]; if (t < 0 || t >= TIERS.length - 1) continue; if (seen[t] !== undefined) { mergeCars(seen[t], i); return; } seen[t] = i; }
      if (slots.includes(-1) && coins >= buyCost() && (Math.random() < 0.85)) { buyCar(); return; }
      startRace(); return;
    }
    if (!R) return;
    if (R.phase === 'aim') { if (!holding) holding = true; else if (R.power > 0.9) { holding = false; launch(); } return; }
    holding = R.fuel > 0;
  },
};

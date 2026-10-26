// Clover Acre — original light farm-town game. Plant and harvest crops, feed hens and cows, bake and churn goods
// in your buildings, and send the delivery truck off with orders. Every timer is seconds of play, never hours.
import { THREE, createStage, createUI, loop, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { M, mesh, rbox, plotMesh, lockedPlotMesh, cropMesh, chickenMesh, cowMesh, fenceMesh, houseMesh, barnMesh, truckMesh, crateMesh, treesMesh, flowersMesh } from './models.js';

const NAME = 'Clover Acre: Farm Town';
const Q = new URLSearchParams(location.search);
const stage = createStage({ fov: 50, shadowSize: 11 });
const { scene, camera, sun, hemi, renderer } = stage;
hemi.intensity = 1.25; sun.intensity = 1.55; sun.shadow.mapSize.set(1536, 1536);
const ui = createUI({ title: 'CLOVER<br>ACRE', hint: 'Tap to farm', hand: '👆', score: false });
const D = daily('cloveracre', ui, { name: NAME });
const B = board({ game: 'clover-acre', label: 'Orders filled', limits: { maxRun: 3, maxPerSec: 2.5 }, mode: 'sum', corner: 'tl' });
const S = store(D.isDaily ? 'cloveracre_d' + D.seed : 'cloveracre');
document.body.style.setProperty('--bg1', '#bfe9ff'); document.body.style.setProperty('--bg2', '#e8f8ff'); document.body.style.setProperty('--ui', '#4caf50');

// ---------------------------------------------------------------- data
const ITEMS = {
  wheat: { icon: '🌾', name: 'Wheat', val: 2 }, corn: { icon: '🌽', name: 'Corn', val: 3 }, carrot: { icon: '🥕', name: 'Carrot', val: 4 }, pumpkin: { icon: '🎃', name: 'Pumpkin', val: 7 },
  egg: { icon: '🥚', name: 'Egg', val: 5 }, milk: { icon: '🥛', name: 'Milk', val: 7 },
  bread: { icon: '🍞', name: 'Bread', val: 8 }, cookie: { icon: '🍪', name: 'Cookies', val: 12 }, pie: { icon: '🥧', name: 'Pumpkin Pie', val: 22 }, cheese: { icon: '🧀', name: 'Cheese', val: 18 }, cream: { icon: '🍦', name: 'Ice Cream', val: 14 },
};
const CROPS = { wheat: { t: 4, s: 1, y: 2 }, corn: { t: 7, s: 1, y: 2 }, carrot: { t: 10, s: 2, y: 2 }, pumpkin: { t: 15, s: 4, y: 1 } };
const ANIMALS = { chicken: { eats: 'wheat', makes: 'egg', t: 7, s: 1 }, cow: { eats: 'corn', makes: 'milk', t: 10, s: 2 } };
const RECIPES = {
  bakery: [{ out: 'bread', need: { wheat: 2 }, t: 6, s: 1 }, { out: 'cookie', need: { wheat: 1, egg: 1 }, t: 8, s: 3 }, { out: 'pie', need: { pumpkin: 1, egg: 1, wheat: 1 }, t: 12, s: 4 }],
  dairy: [{ out: 'cheese', need: { milk: 2 }, t: 10, s: 2 }, { out: 'cream', need: { milk: 1, carrot: 1 }, t: 8, s: 3 }],
};
const BUILD = { bakery: { name: 'Bakery', s: 1 }, dairy: { name: 'Dairy', s: 2 } };

// ---------------------------------------------------------------- persistent state
const fresh = () => ({ season: D.isDaily ? 3 : 1, coins: 20, filled: 0, total: 0, inv: { wheat: 2, corn: 1 }, owned: [0, 1, 2, 3, 4, 5], plots: {}, animals: {}, builds: {}, orders: [], oseq: 0 });
const G = Object.assign(fresh(), S.get('farm', {}));
const T = () => performance.now() / 1000;
// timers are stored as "seconds left" so a reload continues where you were
function hydrate() {
  for (const k in G.plots) { const p = G.plots[k]; if (p && p.left !== undefined) { p.ready = T() + p.left; delete p.left; } }
  for (const k in G.animals) { const a = G.animals[k]; if (a && a.left !== undefined) { a.ready = T() + a.left; delete a.left; } }
  for (const k in G.builds) { const b = G.builds[k]; if (b && b.left !== undefined) { b.ready = T() + b.left; delete b.left; } }
}
hydrate();
let saveT = 0;
function save() {
  clearTimeout(saveT); saveT = setTimeout(() => {
    const out = JSON.parse(JSON.stringify(G)), now = T();
    for (const grp of ['plots', 'animals', 'builds']) for (const k in out[grp]) { const o = out[grp][k]; if (o && o.ready !== undefined) { o.left = Math.max(0, o.ready - now); delete o.ready; } }
    S.set('farm', out);
  }, 300);
}
const goal = () => D.isDaily ? 6 : Math.min(9, 2 + G.season);
let rand = D.seed ? rng(D.seed) : Math.random;
let state = 'ready', beatenShown = false, recorded = false, lastSubmit = performance.now();

// ---------------------------------------------------------------- world
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#8fd47a', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const road = mesh([[rbox(30, 0.04, 1.5, 0.02), M(0, 0.01, 3.5), '#e6d3a8'], [rbox(1.3, 0.03, 4.4, 0.02), M(1.6, 0.01, 1.1), '#e6d3a8']]); road.castShadow = false; scene.add(road);
scene.add(treesMesh([[-5.8, -8, 1.1, 1], [-5.6, -4.5, 0.9, 0], [-5.9, -1, 1.2, 1], [-5.7, 2.4, 1, 0], [5.9, -8.4, 1.2, 0], [6.1, -5, 1, 1], [6.0, 2.4, 1.1, 1], [-2, -9.2, 1.2, 1], [1.6, -9.4, 1, 0], [4.6, -9.2, 1.3, 1], [-4.6, 6, 1.1, 0], [4.8, 6.1, 1, 1], [0, 6.4, 1.2, 1], [-1.8, 5.8, 0.8, 0]]));
scene.add(flowersMesh(Array.from({ length: 40 }, (_, i) => [((i * 37) % 120) / 10 - 6, ((i * 53) % 150) / 10 - 9.5, ['#ff7aa2', '#ffffff', '#ffd23f', '#b48cff'][i % 4]]).filter(([x, z]) => Math.abs(x) > 5 || z < -8.4 || z > 5)));

const OBJ = [];   // tappable things: { kind, id, x, z, w, d, tag, ... }
// plots
const PLOT = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) PLOT.push({ x: -3.7 + c * 1.95, z: -4.1 + r * 1.85 });
const plotCost = i => i < 9 ? 30 : 60;
function buildPlot(i) {
  const P = PLOT[i]; if (P.g) scene.remove(P.g);
  const g = new THREE.Group(); g.position.set(P.x, 0, P.z); scene.add(g); P.g = g;
  if (G.owned.includes(i)) { g.add(plotMesh()); } else { g.add(lockedPlotMesh()); }
  P.crop = null; P.cropKind = null;
}
PLOT.forEach((P, i) => { buildPlot(i); OBJ.push({ kind: 'plot', id: i, x: P.x, z: P.z, w: 1.8, d: 1.7, y: 0.7 }); });
// coop + cow pen
const coop = new THREE.Group(); coop.position.set(3.55, 0, -3.3); scene.add(coop); coop.add(fenceMesh(2.6, 2.4, true));
const hut = houseMesh({ w: 0.9, d: 0.7, h: 0.55, wall: '#fff3dc', roof: '#e8573c' }); hut.position.set(0.7, 0, -0.7); hut.scale.setScalar(0.9); coop.add(hut);
const pen = new THREE.Group(); pen.position.set(3.55, 0, 0.35); scene.add(pen); pen.add(fenceMesh(2.6, 2.9, true));
const trough = mesh([[rbox(1.0, 0.2, 0.3, 0.05), M(0, 0.1, 0), '#a8743e'], [rbox(0.85, 0.06, 0.2, 0.03), M(0, 0.2, 0), '#e8c56a']]); trough.position.set(0, 0, -1.15); pen.add(trough);
const ANIM = [];
for (let i = 0; i < 3; i++) { const m = chickenMesh(); m.position.set(-0.75 + i * 0.6, 0, 0.25 + (i % 2) * 0.4); m.rotation.y = 0.5 - i * 0.4; coop.add(m); ANIM.push({ kind: 'chicken', id: 'c' + i, m, home: m.position.clone(), grp: coop }); }
for (let i = 0; i < 2; i++) { const m = cowMesh(); m.position.set(-0.55 + i * 1.1, 0, 0.25 - i * 0.3); m.rotation.y = 0.3 - i * 0.7; pen.add(m); ANIM.push({ kind: 'cow', id: 'w' + i, m, home: m.position.clone(), grp: pen }); }
OBJ.push({ kind: 'coop', id: 'coop', x: 3.55, z: -3.3, w: 2.7, d: 2.5, y: 1.1 }, { kind: 'pen', id: 'pen', x: 3.55, z: 0.35, w: 2.7, d: 3.0, y: 1.4 });
const penLock = mesh([[rbox(0.9, 0.5, 0.06, 0.03), M(0, 0.75, 0), '#d9a466'], [rbox(0.08, 0.8, 0.08, 0.02), M(0, 0.4, -0.05), '#8f5c2c']]); penLock.position.set(0, 0, 1.0); pen.add(penLock);
// buildings
const barn = barnMesh(); barn.position.set(-3.4, 0, -7.3); scene.add(barn);
const bakery = houseMesh({ w: 2.0, d: 1.6, h: 1.25, wall: '#fff0d6', roof: '#ff8a3c', chimney: true, awning: '#ff5d8f' }); bakery.position.set(0.05, 0, -7.2); scene.add(bakery);
const dairy = houseMesh({ w: 2.0, d: 1.6, h: 1.25, wall: '#eaf6ff', roof: '#3a86ff', awning: '#3a86ff' }); dairy.position.set(3.55, 0, -7.2); scene.add(dairy);
const dairyLock = fenceMesh(2.5, 2.1, false); dairyLock.position.set(3.55, 0, -7.2); scene.add(dairyLock);
OBJ.push({ kind: 'barn', id: 'barn', x: -3.4, z: -7.3, w: 2.6, d: 2.1, y: 2.6 }, { kind: 'build', id: 'bakery', x: 0.05, z: -7.2, w: 2.2, d: 1.9, y: 2.3 }, { kind: 'build', id: 'dairy', x: 3.55, z: -7.2, w: 2.2, d: 1.9, y: 2.3 });
const BMESH = { bakery, dairy };
// truck
const truck = truckMesh('#3a86ff'); truck.rotation.y = -Math.PI / 2; truck.position.set(-1.2, 0, 3.5); scene.add(truck);
const crates = []; for (let i = 0; i < 3; i++) { const c = crateMesh(); c.position.set(0, 0.42, -0.25 - i * 0.42 + 0.2); c.visible = false; truck.add(c); crates.push(c); }
const TRUCK = { x0: -1.2, out: 0 };
OBJ.push({ kind: 'truck', id: 'truck', x: -1.2, z: 3.5, w: 2.6, d: 1.3, y: 1.4 });

// ---------------------------------------------------------------- camera
const cam = { x: 0, z: -1.9, tx: 0, tz: -1.9 };
function fitCamera() {
  const d = 19.5, aspect = innerWidth / innerHeight, wantW = aspect < 0.8 ? 11.4 : 15;
  const hf = 2 * Math.atan(wantW / 2 / d); let vf = 2 * Math.atan(Math.tan(hf / 2) / aspect) * 180 / Math.PI; vf = clamp(Math.max(vf, 52), 34, 78);
  camera.fov = vf; camera.updateProjectionMatrix();
}
addEventListener('resize', fitCamera); fitCamera();
function placeCamera() { cam.x = lerp(cam.x, cam.tx, 0.15); cam.z = lerp(cam.z, cam.tz, 0.15); camera.position.set(cam.x, 16.5, cam.z + 9.5); camera.lookAt(cam.x, 0, cam.z); stage.followLight(new THREE.Vector3(cam.x, 0, cam.z)); }

// ---------------------------------------------------------------- DOM UI
const css = document.createElement('style'); css.textContent = `
.hc-card{background:linear-gradient(180deg,rgba(30,80,30,.45),rgba(30,80,30,.2))}
.hc-card h1{text-shadow:0 6px 0 #3e8e41,0 10px 22px rgba(20,80,20,.25)}
.hc-card p,.hc-card .hint{text-shadow:0 2px 0 rgba(30,90,30,.45)}
.hc-pop{-webkit-text-stroke:2px rgba(40,90,40,.5);paint-order:stroke fill}
.ca-chip{position:fixed;top:calc(60px + env(safe-area-inset-top));display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.88);color:#5a3a1a;border-radius:18px;padding:3px 12px 2px;font:800 18px 'Baloo 2',system-ui;z-index:6;box-shadow:0 3px 0 rgba(0,0,0,.12);pointer-events:auto;cursor:pointer}
.ca-coins{right:10px}.ca-barn{left:10px}
.ca-chip.bump{animation:cab .3s}@keyframes cab{50%{transform:scale(1.18)}}
.ca-orders{position:fixed;left:0;right:0;bottom:calc(8px + env(safe-area-inset-bottom));display:flex;gap:7px;justify-content:center;padding:0 8px;z-index:6;pointer-events:none}
.ca-ord{pointer-events:auto;flex:1;max-width:150px;min-height:104px;background:#fffaf0;border-radius:16px;box-shadow:0 4px 0 rgba(90,60,20,.25);border:3px solid #f1dcb5;padding:6px 6px 4px;font:700 14px 'Baloo 2',system-ui;color:#5a3a1a;position:relative;cursor:pointer;transition:transform .15s}
.ca-ord.ok{border-color:#5bc95b;background:#effde6;animation:caok 1s ease-in-out infinite}@keyframes caok{50%{transform:translateY(-3px)}}
.ca-ord .who{font-size:11px;opacity:.7;letter-spacing:1px;text-transform:uppercase}
.ca-ord .it{display:flex;align-items:center;gap:4px;font-size:15px;line-height:1.25}.ca-ord .it b{font-size:21px}.ca-ord .it.have{color:#2f8f2f}
.ca-ord .rw{position:absolute;right:6px;top:4px;font-size:13px;color:#b07a1a}
.ca-ord .send{position:absolute;right:6px;bottom:6px;background:#5bc95b;color:#fff;border-radius:10px;padding:0 8px;font-size:13px;display:none}.ca-ord.ok .send{display:block}
.ca-ord.go{transform:translateY(140px)!important;opacity:0;transition:all .45s}
.ca-tag{position:fixed;transform:translate(-50%,-100%);z-index:3;pointer-events:none;font:800 13px 'Baloo 2',system-ui;color:#5a3a1a;white-space:nowrap}
.ca-tag .bub{background:#fff;border-radius:16px;padding:1px 7px;box-shadow:0 3px 0 rgba(0,0,0,.15);font-size:22px;line-height:1.25;animation:cabob 1s ease-in-out infinite}
@keyframes cabob{50%{transform:translateY(-4px)}}
.ca-tag .bar{width:46px;height:9px;border-radius:6px;background:rgba(255,255,255,.75);overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.15)}.ca-tag .bar i{display:block;height:100%;background:#ffb72e}
.ca-tag .lock{background:rgba(90,58,26,.85);color:#fff;border-radius:10px;padding:1px 8px;font-size:13px}
.ca-sheet{position:fixed;left:8px;right:8px;margin:0 auto;max-width:440px;bottom:calc(124px + env(safe-area-inset-bottom));background:#fffaf0;border-radius:20px;border:3px solid #f1dcb5;box-shadow:0 8px 30px rgba(60,40,10,.3);z-index:8;padding:10px 12px 12px;font:700 15px 'Baloo 2',system-ui;color:#5a3a1a;animation:casu .2s ease-out}
@keyframes casu{from{transform:translateY(30px);opacity:0}}
.ca-sheet h3{margin:0 0 6px;font-size:18px}.ca-sheet .row{display:flex;gap:8px;flex-wrap:wrap}
.ca-opt{flex:1;min-width:88px;background:#fff;border:2px solid #f1dcb5;border-radius:14px;padding:6px;text-align:center;cursor:pointer;font:inherit;color:inherit}
.ca-opt b{display:block;font-size:28px;line-height:1.2}.ca-opt small{display:block;font-size:12px;opacity:.75}.ca-opt.no{opacity:.45}
.ca-float{position:fixed;z-index:7;pointer-events:none;font:800 20px 'Baloo 2',system-ui;color:#fff;-webkit-text-stroke:2px rgba(60,90,30,.55);paint-order:stroke fill;transform:translate(-50%,-50%);animation:caf .9s ease-out forwards}
@keyframes caf{to{transform:translate(-50%,-140%);opacity:0}}
.ca-fly{position:fixed;z-index:9;font-size:26px;pointer-events:none;transition:all .55s cubic-bezier(.5,-0.3,.6,1)}`;
document.head.appendChild(css);
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const coinsEl = el(`<div class="ca-chip ca-coins">🪙 <span>0</span></div>`), barnEl = el(`<div class="ca-chip ca-barn" style="top:calc(60px + env(safe-area-inset-top));left:10px">📦 <span>0</span></div>`);
const ordersEl = el(`<div class="ca-orders"></div>`);
document.body.append(coinsEl, barnEl, ordersEl);
[coinsEl, barnEl, ordersEl].forEach(e => e.addEventListener('pointerdown', ev => ev.stopPropagation()));
barnEl.addEventListener('click', () => openBarn());
function bump(e) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
function hud() { coinsEl.querySelector('span').textContent = G.coins; barnEl.querySelector('span').textContent = Object.values(G.inv).reduce((a, b) => a + b, 0); ui.levels(D.isDaily ? 1 : G.season); ui.progress(G.filled / goal()); }
const scr = new THREE.Vector3();
function toScreen(x, y, z) { scr.set(x, y, z).project(camera); return [(scr.x + 1) / 2 * innerWidth, (1 - scr.y) / 2 * innerHeight]; }
function floatText(x, y, z, txt) { const [sx, sy] = toScreen(x, y, z); const d = el(`<div class="ca-float">${txt}</div>`); d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 950); }
function flyTo(x, y, z, icon, target) { const [sx, sy] = toScreen(x, y, z); const d = el(`<div class="ca-fly">${icon}</div>`); d.style.left = sx + 'px'; d.style.top = sy + 'px'; document.body.appendChild(d); const r = target.getBoundingClientRect(); requestAnimationFrame(() => requestAnimationFrame(() => { d.style.left = r.left + 12 + 'px'; d.style.top = r.top + 2 + 'px'; d.style.transform = 'scale(.6)'; })); setTimeout(() => { d.remove(); bump(target); }, 600); }

// status tags over objects
for (const o of OBJ) { o.tag = el(`<div class="ca-tag"></div>`); document.body.appendChild(o.tag); o.tagHtml = ''; }
function setTag(o, html) { if (o.tagHtml !== html) { o.tag.innerHTML = html; o.tagHtml = html; } }
const bar = (k) => `<div class="bar"><i style="width:${Math.round(clamp(k, 0, 1) * 100)}%"></i></div>`;

// ---------------------------------------------------------------- sheet (crop picker, recipes, buy, barn)
let sheet = null;
function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
function openSheet(title, opts, onPick) {
  closeSheet(); sheet = el(`<div class="ca-sheet"><h3>${title}</h3><div class="row"></div></div>`);
  const row = sheet.querySelector('.row');
  opts.forEach(o => { const b = el(`<button class="ca-opt ${o.ok === false ? 'no' : ''}"><b>${o.icon}</b>${o.label}<small>${o.sub || ''}</small></button>`); b.addEventListener('click', e => { e.stopPropagation(); if (onPick(o) !== false) closeSheet(); }); row.appendChild(b); });
  sheet.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(sheet);
}
function openBarn() {
  const list = Object.entries(G.inv).filter(([, n]) => n > 0);
  openSheet('📦 Barn', list.length ? list.map(([k, n]) => ({ icon: ITEMS[k].icon, label: `${ITEMS[k].name}`, sub: '× ' + n })) : [{ icon: '🫙', label: 'Empty', sub: 'Harvest something!' }], () => true);
}

// ---------------------------------------------------------------- rules
const has = (need) => Object.entries(need).every(([k, n]) => (G.inv[k] || 0) >= n);
const take = (need) => { for (const [k, n] of Object.entries(need)) G.inv[k] -= n; };
const give = (k, n) => { G.inv[k] = (G.inv[k] || 0) + n; };
function unlockedItems() {
  const s = G.season, out = [];
  for (const [k, c] of Object.entries(CROPS)) if (c.s <= s) out.push(k);
  for (const a of Object.values(ANIMALS)) if (a.s <= s) out.push(a.makes);
  for (const [b, list] of Object.entries(RECIPES)) if (BUILD[b].s <= s) for (const r of list) if (r.s <= s) out.push(r.out);
  return out;
}
function newOrder() {
  const items = unlockedItems(), n = Math.min(3, 1 + Math.floor(rand() * Math.min(3, 1 + G.season * 0.6)));
  const need = {}; const pool = items.slice();
  for (let i = 0; i < n && pool.length; i++) { const k = pool.splice(Math.floor(rand() * pool.length), 1)[0]; const raw = CROPS[k] ? 1 : 0; need[k] = 1 + Math.floor(rand() * (raw ? 3 : 2)) + (raw && G.season > 2 ? 1 : 0); }
  const reward = Math.round(Object.entries(need).reduce((a, [k, q]) => a + ITEMS[k].val * q, 0) * 1.3) + 4;
  const who = ['Mabel', 'Otis', 'Rosa', 'Fern', 'Hugo', 'Ivy', 'Bea', 'Lars'][G.oseq++ % 8];
  G.orders.push({ need, reward, who });
}
function fillOrders() { while (G.orders.length < 3) newOrder(); }
function deliver(i) {
  const o = G.orders[i]; if (!o || !has(o.need) || TRUCK.out) return false;
  take(o.need); G.coins += o.reward; G.filled++; G.total++;
  B.submit(1, { ms: Math.max(500, performance.now() - lastSubmit) }); lastSubmit = performance.now();
  const card = ordersEl.children[i]; if (card) card.classList.add('go');
  crates.forEach(c => c.visible = true); TRUCK.out = T(); sfx.coin(); note(76, 0.3, 0.12); setTimeout(() => note(83, 0.4, 0.12), 120); buzz([10, 30, 10]);
  floatText(truck.position.x, 1.6, truck.position.z, `+🪙${o.reward}`); flyTo(truck.position.x, 1.2, truck.position.z, '🪙', coinsEl);
  if (!beatenShown && D.beaten(G.total)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 2, 0), 60); }
  setTimeout(() => { G.orders.splice(G.orders.indexOf(o), 1); fillOrders(); renderOrders(); hud(); save(); if (G.filled >= goal()) win(); }, 450);
  hud(); save(); return true;
}
function renderOrders() {
  ordersEl.innerHTML = '';
  G.orders.forEach((o, i) => {
    const ok = has(o.need);
    const c = el(`<div class="ca-ord ${ok ? 'ok' : ''}"><div class="who">${o.who}</div><div class="rw">🪙${o.reward}</div>${Object.entries(o.need).map(([k, n]) => `<div class="it ${(G.inv[k] || 0) >= n ? 'have' : ''}"><b>${ITEMS[k].icon}</b>${Math.min(G.inv[k] || 0, n)}/${n}</div>`).join('')}<div class="send">SEND 🚚</div></div>`);
    c.addEventListener('click', e => { e.stopPropagation(); if (state !== 'play') return; if (!deliver(i)) { const miss = Object.entries(o.need).find(([k, n]) => (G.inv[k] || 0) < n); if (TRUCK.out) ui.pop('Truck is on the road…', '#fff', 22, 40); else if (miss) ui.pop(`Need ${miss[1] - (G.inv[miss[0]] || 0)} more ${ITEMS[miss[0]].icon}`, '#fff', 24, 40); tone(240, 0.1, 'sine', 0.08, 0.8); } });
    ordersEl.appendChild(c);
  });
  ordersSig = sig();
}
let ordersSig = '';
const sig = () => JSON.stringify([G.orders.map(o => o.who + JSON.stringify(o.need)), Object.entries(G.inv)]);

function plant(i, kind) {
  const c = CROPS[kind]; G.plots[i] = { kind, ready: T() + c.t, t: c.t }; showCrop(i);
  burst(scene, new THREE.Vector3(PLOT[i].x, 0.3, PLOT[i].z), ['#9a6638', '#c08a52'], 10, { speed: 0.05, up: 0.06, size: 0.6 });
  tone(330, 0.08, 'triangle', 0.1, 1.3); buzz(6); save(); return true;
}
function harvest(i) {
  const p = G.plots[i], c = CROPS[p.kind]; give(p.kind, c.y); G.plots[i] = null;
  const P = PLOT[i]; if (P.crop) { P.g.remove(P.crop); P.crop = null; }
  burst(scene, new THREE.Vector3(P.x, 0.5, P.z), ['#ffd23f', '#7bd06a', '#ffffff'], 14, { speed: 0.08, up: 0.12, size: 0.6 });
  floatText(P.x, 0.8, P.z, `+${c.y} ${ITEMS[p.kind].icon}`); flyTo(P.x, 0.6, P.z, ITEMS[p.kind].icon, barnEl);
  note(72 + (i % 5) * 2, 0.2, 0.1); buzz(8); hud(); save();
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in season 1, until the first real touch,
// a ripe field harvests itself or an empty field gets planted (twice at most, nothing bought), so the farm shows what a tap does
demo(() => {
  const now = T(), ripe = G.owned.find(p => G.plots[p] && now >= G.plots[p].ready); if (ripe != null) return void harvest(ripe);
  const empty = G.owned.find(p => !G.plots[p]), crop = Object.keys(CROPS).find(k => CROPS[k].s <= G.season); if (empty == null || !crop) return false; plant(empty, crop);
}, { ready: () => state === 'play' && G.season === 1 && !D.isDaily && !sheet, wait: 1800, every: 1300, max: 2 });
function showCrop(i) { const P = PLOT[i], p = G.plots[i]; if (P.crop) { P.g.remove(P.crop); P.crop = null; } if (!p) return; P.crop = cropMesh(p.kind); P.crop.position.y = 0.18; P.cropKind = p.kind; P.g.add(P.crop); }
function tapPlot(i) {
  const P = PLOT[i];
  if (!G.owned.includes(i)) { const cost = plotCost(i); openSheet('Clear this field?', [{ icon: '🌱', label: 'Buy field', sub: '🪙' + cost, ok: G.coins >= cost }], () => buyPlot(i)); return; }
  const p = G.plots[i];
  if (!p) { const opts = Object.entries(CROPS).filter(([, c]) => c.s <= G.season).map(([k, c]) => ({ k, icon: ITEMS[k].icon, label: ITEMS[k].name, sub: `${c.t}s · ×${c.y}` })); openSheet('Plant a crop', opts, o => plant(i, o.k)); return; }
  if (T() >= p.ready) harvest(i); else { floatText(P.x, 0.8, P.z, `${Math.ceil(p.ready - T())}s`); tone(500, 0.04, 'sine', 0.05); }
}
function buyPlot(i) { const cost = plotCost(i); if (G.coins < cost) { ui.pop(`Needs 🪙${cost}`, '#fff', 24, 40); return false; } G.coins -= cost; G.owned.push(i); buildPlot(i); sfx.coin(); confetti(scene, new THREE.Vector3(PLOT[i].x, 1, PLOT[i].z), 30); hud(); save(); return true; }
function animalsOf(kind) { return ANIM.filter(a => a.kind === kind); }
function tapAnimals(kind) {
  const A = ANIMALS[kind];
  if (A.s > G.season) { ui.pop(`Cows arrive in season ${A.s}`, '#fff', 22, 40); return; }
  let did = false;
  for (const a of animalsOf(kind)) { const st = G.animals[a.id];
    if (st && T() >= st.ready) { G.animals[a.id] = null; give(A.makes, 1); const w = a.m.getWorldPosition(new THREE.Vector3()); floatText(w.x, 1, w.z, '+1 ' + ITEMS[A.makes].icon); flyTo(w.x, 0.8, w.z, ITEMS[A.makes].icon, barnEl); a.hop = T(); did = true; note(79, 0.2, 0.1); } }
  if (!did) for (const a of animalsOf(kind)) { if (G.animals[a.id]) continue; if ((G.inv[A.eats] || 0) < 1) { if (!did) ui.pop(`Needs ${ITEMS[A.eats].icon} feed`, '#fff', 24, 40); break; }
    G.inv[A.eats]--; G.animals[a.id] = { ready: T() + A.t, t: A.t }; a.hop = T(); did = true; tone(kind === 'cow' ? 160 : 900, 0.12, kind === 'cow' ? 'sawtooth' : 'square', 0.05, kind === 'cow' ? 0.8 : 1.3); }
  if (did) { buzz(8); hud(); save(); }
}
function tapBuild(id) {
  const Bd = BUILD[id]; if (Bd.s > G.season) { ui.pop(`${Bd.name} opens in season ${Bd.s}`, '#fff', 22, 40); return; }
  const st = G.builds[id];
  if (st && T() >= st.ready) { give(st.out, 1); G.builds[id] = null; const o = OBJ.find(o => o.id === id); floatText(o.x, 2, o.z, '+1 ' + ITEMS[st.out].icon); flyTo(o.x, 1.6, o.z, ITEMS[st.out].icon, barnEl); arp3(); hud(); save(); return; }
  if (st) { ui.pop(`${ITEMS[st.out].icon} ready in ${Math.ceil(st.ready - T())}s`, '#fff', 22, 40); return; }
  const opts = RECIPES[id].filter(r => r.s <= G.season).map(r => ({ r, icon: ITEMS[r.out].icon, label: ITEMS[r.out].name, sub: Object.entries(r.need).map(([k, n]) => `${n}${ITEMS[k].icon}`).join(' ') + ` · ${r.t}s`, ok: has(r.need) }));
  openSheet(Bd.name, opts, o => startRecipe(id, o.r));
}
function startRecipe(id, r) { if (!has(r.need)) { ui.pop('Missing ingredients', '#fff', 22, 40); tone(240, 0.1, 'sine', 0.08, 0.8); return false; } take(r.need); G.builds[id] = { out: r.out, ready: T() + r.t, t: r.t }; tone(600, 0.1, 'triangle', 0.1, 1.4); BMESH[id].userData.pulse = T(); hud(); save(); return true; }
const arp3 = () => [72, 76, 79].forEach((n, i) => setTimeout(() => note(n, 0.25, 0.1), i * 70));
function win() {
  if (state !== 'play') return; state = 'won';
  sfx.win(); confetti(scene, new THREE.Vector3(0, 2, -2), 120); buzz([20, 40, 20]);
  D.won(G.total, 'filled orders for');
  const done = G.season; if (!D.isDaily) { G.season++; G.filled = 0; G.orders = []; } save();
  const unl = unlockedNext(done + 1);
  ui.win(D.isDaily ? 'DAILY' : done, `${goal()} orders shipped${unl ? ' · New: ' + unl : ''}`);
}
function unlockedNext(s) {
  const out = []; for (const [k, c] of Object.entries(CROPS)) if (c.s === s) out.push(ITEMS[k].icon); for (const [, a] of Object.entries(ANIMALS)) if (a.s === s) out.push(ITEMS[a.makes].icon);
  for (const [b, list] of Object.entries(RECIPES)) for (const r of list) if (r.s === s) out.push(ITEMS[r.out].icon); return out.join(' ');
}
ui.els.win.querySelector('h1').textContent = 'HARVESTED!'; ui.els.win.querySelector('p').innerHTML = 'SEASON <span data-l>1</span>';

// ---------------------------------------------------------------- input: tap = ray to ground → object; drag = pan
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let pd = null;
addEventListener('pointerdown', e => { if (state !== 'play') return; closeSheet(); pd = { x: e.clientX, y: e.clientY, cx: cam.tx, cz: cam.tz, moved: false }; });
addEventListener('pointermove', e => { if (!pd) return; const dx = e.clientX - pd.x, dy = e.clientY - pd.y; if (Math.hypot(dx, dy) > 10) pd.moved = true; if (pd.moved) { const k = 14 / innerWidth; cam.tx = clamp(pd.cx - dx * k, -2.5, 2.5); cam.tz = clamp(pd.cz - dy * k * 1.3, -4.5, 1.5); } });
addEventListener('pointerup', e => { const p = pd; pd = null; if (!p || p.moved || state !== 'play') return; tapAt(e.clientX, e.clientY); });
function objAt(x, z) { let best = null, bd = 1e9; for (const o of OBJ) { const dx = Math.abs(x - o.x) / (o.w / 2 + 0.15), dz = Math.abs(z - o.z) / (o.d / 2 + 0.15); const d = Math.max(dx, dz); if (d < 1 && d < bd) { bd = d; best = o; } } return best; }
function tapAt(sx, sy) {
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  // tall things (buildings) first: test their tag height too by sampling the ray at a few heights
  let o = null; for (const h of [1.2, 0.6, 0]) { plane.constant = -h; if (ray.ray.intersectPlane(plane, hit)) { o = objAt(hit.x, hit.z); if (o) break; } } plane.constant = 0;
  if (!o) return; act(o);
}
function act(o) {
  if (o.kind === 'plot') tapPlot(o.id); else if (o.kind === 'coop') tapAnimals('chicken'); else if (o.kind === 'pen') tapAnimals('cow');
  else if (o.kind === 'build') tapBuild(o.id); else if (o.kind === 'barn') openBarn();
  else if (o.kind === 'truck') { const i = G.orders.findIndex(q => has(q.need)); if (i >= 0) deliver(i); else ui.pop('Fill an order card below', '#fff', 22, 40); }
}

// ---------------------------------------------------------------- frame
const smoke = []; let lastSmoke = 0;
function update(dt, t) {
  const now = T();
  placeCamera();
  // crops grow
  PLOT.forEach((P, i) => { const p = G.plots[i]; if (!p) { if (P.crop) { P.g.remove(P.crop); P.crop = null; } return; } if (!P.crop || P.cropKind !== p.kind) showCrop(i);
    const k = clamp(1 - (p.ready - now) / p.t, 0, 1), ripe = k >= 1;
    P.crop.scale.set(0.5 + 0.5 * k, 0.15 + 0.85 * k, 0.5 + 0.5 * k); P.crop.material.color.setRGB(ripe ? 1 : 0.55 + 0.25 * k, ripe ? 1 : 0.95, ripe ? 1 : 0.55 + 0.2 * k);
    P.crop.rotation.z = Math.sin(t * 2 + i) * 0.03; if (ripe) P.crop.position.y = 0.18 + Math.abs(Math.sin(t * 4 + i)) * 0.03; });
  // animals idle + hop
  for (const a of ANIM) { const st = G.animals[a.id], hungry = !st, hp = a.hop ? clamp((now - a.hop) / 0.4, 0, 1) : 1;
    a.m.position.y = Math.sin(hp * Math.PI) * 0.35 + (a.kind === 'chicken' && hungry ? Math.abs(Math.sin(t * 6 + a.home.x * 5)) * 0.04 : 0);
    if (a.kind === 'chicken') a.m.rotation.x = hungry ? Math.max(0, Math.sin(t * 3 + a.home.x * 3)) * 0.4 : 0; else a.m.rotation.y += Math.sin(t * 0.7 + a.home.x) * 0.002;
    a.m.visible = a.kind !== 'cow' || ANIMALS.cow.s <= G.season; }
  penLock.visible = ANIMALS.cow.s > G.season; trough.visible = ANIMALS.cow.s <= G.season;
  dairy.visible = BUILD.dairy.s <= G.season; dairyLock.visible = !dairy.visible;
  // buildings pulse + smoke
  for (const id of ['bakery', 'dairy']) { const st = G.builds[id], m = BMESH[id]; const k = m.userData.pulse ? clamp((now - m.userData.pulse) / 0.4, 0, 1) : 1; const s = 1 + Math.sin(k * Math.PI) * 0.08 + (st && now < st.ready ? Math.sin(t * 8) * 0.012 : 0); m.scale.set(s, 1 / s, s);
    if (st && now < st.ready && t - lastSmoke > 0.25 && id === 'bakery') { lastSmoke = t; burst(scene, new THREE.Vector3(m.position.x + 0.56, 2.25, m.position.z - 0.1), ['#ffffff', '#e8e8e8'], 1, { speed: 0.004, up: 0.02, size: 1.6, shape: 'sphere', gravity: -0.0005, life: 1.4 }); } }
  // truck trip
  if (TRUCK.out) { const k = now - TRUCK.out; truck.position.x = TRUCK.x0 + (k < 1.6 ? k * k * 6 : k < 2.4 ? 99 : Math.max(0, (3.6 - k)) * -12); truck.position.y = Math.abs(Math.sin(k * 20)) * 0.03;
    if (k > 2.4) crates.forEach(c => c.visible = false); if (k >= 3.6) { TRUCK.out = 0; truck.position.x = TRUCK.x0; } }
  const tob = OBJ.find(o => o.kind === 'truck'); tob.x = truck.position.x;
  // tags
  for (const o of OBJ) {
    let html = '';
    if (o.kind === 'plot') { const p = G.plots[o.id]; if (!G.owned.includes(o.id)) html = `<div class="lock">🪙${plotCost(o.id)}</div>`; else if (p) html = now >= p.ready ? `<div class="bub">${ITEMS[p.kind].icon}</div>` : bar(1 - (p.ready - now) / p.t); else html = ''; }
    else if (o.kind === 'coop' || o.kind === 'pen') { const kind = o.kind === 'coop' ? 'chicken' : 'cow', A = ANIMALS[kind]; if (A.s > G.season) html = `<div class="lock">🔒 Season ${A.s}</div>`; else { const sts = animalsOf(kind).map(a => G.animals[a.id]); if (sts.some(s => s && now >= s.ready)) html = `<div class="bub">${ITEMS[A.makes].icon}</div>`; else if (sts.some(s => !s)) html = `<div class="bub" style="font-size:18px">${ITEMS[A.eats].icon}?</div>`; else html = bar(Math.max(...sts.map(s => 1 - (s.ready - now) / s.t))); } }
    else if (o.kind === 'build') { const Bd = BUILD[o.id], st = G.builds[o.id]; if (Bd.s > G.season) html = `<div class="lock">🔒 Season ${Bd.s}</div>`; else if (st) html = now >= st.ready ? `<div class="bub">${ITEMS[st.out].icon}</div>` : `<div style="text-align:center;font-size:18px">${ITEMS[st.out].icon}</div>` + bar(1 - (st.ready - now) / st.t); else html = `<div class="lock" style="background:rgba(255,255,255,.85);color:#5a3a1a">${Bd.name}</div>`; }
    else if (o.kind === 'barn') html = `<div class="lock" style="background:rgba(255,255,255,.85);color:#5a3a1a">Barn</div>`;
    setTag(o, html);
    const [sx, sy] = toScreen(o.x, o.y, o.z); o.tag.style.left = sx + 'px'; o.tag.style.top = sy + 'px'; o.tag.style.display = html && state !== 'ready' ? 'block' : 'none';
  }
  if (sig() !== ordersSig && !document.querySelector('.ca-ord.go')) renderOrders();
}
fillOrders(); hud(); renderOrders();
ui.onTap(w => { B.start(); lastSubmit = performance.now();
  if (w === 'win' && D.isDaily) { const u = new URL(location.href); u.search = ''; location.href = u.href; return; }
  if (w === 'win') { fillOrders(); renderOrders(); hud(); ui.pop(`Season ${G.season}!`, '#fff', 40, 30); }
  state = 'play'; ordersEl.style.display = 'flex';
});
ordersEl.style.display = 'none'; ui.els.start.addEventListener('pointerdown', () => { ordersEl.style.display = 'flex'; });
loop(update); ui.start();

// ---------------------------------------------------------------- test hook: one sensible farm action per call
window.__game = {
  get state() { return state; }, get level() { return G.season; }, get score() { return G.total; },
  bot() {
    if (state !== 'play') return; closeSheet(); const now = T();
    const i = G.orders.findIndex(o => has(o.need)); if (i >= 0 && !TRUCK.out) { deliver(i); return; }
    // collect
    for (let p = 0; p < PLOT.length; p++) if (G.plots[p] && now >= G.plots[p].ready) return harvest(p);
    for (const kind of ['chicken', 'cow']) if (animalsOf(kind).some(a => G.animals[a.id] && now >= G.animals[a.id].ready)) return tapAnimals(kind);
    for (const id of ['bakery', 'dairy']) if (G.builds[id] && now >= G.builds[id].ready) return tapBuild(id);
    // demand from orders (minus stock), expanded through recipes and animals
    const want = {}; const add = (k, n) => { want[k] = (want[k] || 0) + n; };
    for (const o of G.orders) for (const [k, n] of Object.entries(o.need)) add(k, n);
    for (const k in want) want[k] = Math.max(0, want[k] - (G.inv[k] || 0));
    for (const [id, list] of Object.entries(RECIPES)) for (const r of list) if (want[r.out] && BUILD[id].s <= G.season) { if (!G.builds[id] && has(r.need)) { startRecipe(id, r); return; } for (const [k, n] of Object.entries(r.need)) add(k, n * want[r.out]); }
    for (const [kind, A] of Object.entries(ANIMALS)) if (A.s <= G.season && want[A.makes]) { if (animalsOf(kind).some(a => !G.animals[a.id]) && (G.inv[A.eats] || 0) > 0) { tapAnimals(kind); return; } add(A.eats, want[A.makes]); }
    const empty = G.owned.filter(p => !G.plots[p]);
    if (empty.length) { const growing = {}; for (const p of G.owned) if (G.plots[p]) growing[G.plots[p].kind] = (growing[G.plots[p].kind] || 0) + CROPS[G.plots[p].kind].y;
      const crop = Object.keys(CROPS).filter(k => CROPS[k].s <= G.season).sort((a, b) => ((want[b] || 0) - (growing[b] || 0) - (G.inv[b] || 0)) - ((want[a] || 0) - (growing[a] || 0) - (G.inv[a] || 0)))[0]; plant(empty[0], crop); return; }
    const lock = PLOT.findIndex((_, p) => !G.owned.includes(p)); if (lock >= 0 && G.coins >= plotCost(lock) + 20) buyPlot(lock);
  },
};

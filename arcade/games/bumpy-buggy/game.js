// Bumpy Buggy — original game. Hold GAS / BRAKE to drive a toy jeep over endless seeded hills.
// Reach the flag, grab fuel cans and coins, and don't land on the driver's head.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { makeTerrain, DX, X0 } from './terrain.js';
import { createCar, stepCar, headPos, WHEEL_R } from './car.js';

const stage = createStage({ fov: 50, shadows: true, shadowSize: 10 });
const { scene, camera, sun, followLight } = stage;
const ui = createUI({ title: 'BUMPY<br>BUGGY', hint: 'Hold right to gas, left to brake', hand: '🦶' });
const B = document.body.style; B.setProperty('--bg1', '#8fd3ff'); B.setProperty('--bg2', '#eaf8ff'); B.setProperty('--ui', '#ff7a2f');
const css = document.createElement('style');
css.textContent = `
.hc-score{color:#fff;text-shadow:0 4px 0 rgba(30,80,140,.25)} .hc-sub{color:#fff;font-weight:800;text-shadow:0 2px 0 rgba(30,80,140,.25)}
.hc-card h1{color:#ff7a2f;text-shadow:0 6px 0 rgba(140,50,0,.22)} .hc-card p,.hc-card .hint{color:#fff;text-shadow:0 2px 0 rgba(30,80,140,.3)}
.hc-card.dim{background:rgba(30,50,80,.3)} .hc-lvl.next{color:#ff7a2f}
.bb-hud{position:fixed;top:calc(58px + env(safe-area-inset-top));z-index:6;display:flex;align-items:center;gap:6px;font-weight:800;font-size:22px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.2);pointer-events:none}
.bb-fuel{left:12px}.bb-coins{right:14px}
.bb-can{width:20px;height:24px;border-radius:4px 9px 4px 4px;background:#ff4b4b;box-shadow:inset -3px -3px 0 rgba(0,0,0,.18);position:relative}
.bb-can:after{content:'';position:absolute;left:4px;top:5px;width:12px;height:12px;border:2px solid rgba(255,255,255,.7);border-radius:2px;transform:rotate(45deg) scale(.7)}
.bb-gauge{width:84px;height:16px;border-radius:9px;background:rgba(255,255,255,.55);overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.12)}
.bb-gauge i{display:block;height:100%;width:100%;border-radius:9px;background:linear-gradient(90deg,#ff4b4b,#ffd23f 40%,#5ad35a);background-size:84px 100%;transition:width .15s}
.bb-gauge.low{animation:bblow .5s steps(2) infinite}@keyframes bblow{50%{opacity:.35}}
.bb-coin{width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff3a0,#ffc61a 55%,#e09a00);box-shadow:0 2px 0 rgba(0,0,0,.18)}
.bb-ped{position:fixed;bottom:calc(22px + env(safe-area-inset-bottom));width:112px;height:128px;border-radius:22px;z-index:6;pointer-events:none;
  background:linear-gradient(180deg,#eef1f5,#b9c0ca);box-shadow:0 8px 0 #7d8694,0 12px 18px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10px;
  font-weight:800;font-size:17px;color:#4b5462;transition:transform .06s,box-shadow .06s;letter-spacing:1px}
.bb-ped:before{content:'';position:absolute;top:14px;left:18px;right:18px;height:70px;background:radial-gradient(circle,#7d8694 7px,transparent 8px) 0 0/25px 23px}
.bb-ped.on{transform:translateY(6px);box-shadow:0 2px 0 #7d8694,0 4px 8px rgba(0,0,0,.25)}
.bb-ped.gas{right:16px}.bb-ped.brake{left:16px}
.bb-ped.gas.on{background:linear-gradient(180deg,#e9ffe9,#9fe39f)}.bb-ped.brake.on{background:linear-gradient(180deg,#ffecec,#f3a3a3)}
.bb-tip{position:fixed;font-weight:800;pointer-events:none;z-index:6;transform:translate(-50%,-50%);color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.25);animation:bbup .8s ease-out forwards}
@keyframes bbup{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}20%{opacity:1;transform:translate(-50%,-60%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-180%) scale(1)}}`;
document.head.appendChild(css);
const div = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
const hudFuel = div('bb-hud bb-fuel', '<div class="bb-can"></div><div class="bb-gauge"><i></i></div>');
const hudCoins = div('bb-hud bb-coins', '<div class="bb-coin"></div><span>0</span>');
const pedBrake = div('bb-ped brake', 'BRAKE'), pedGas = div('bb-ped gas', 'GAS');
const gaugeI = hudFuel.querySelector('i'), coinsEl = hudCoins.querySelector('span');

const save = store('bumpybuggy');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), state = 'ready';
let coins = 0, fuel = 100, D = 200, T, car, world = null, flagX = 0, lowFuelT = 0, stuckT = 0, endT = 0, shake = 0, slow = 0;
const ctl = { gas: false, brake: false, noFuel: false };

// ------------------------------------------------------------------ static backdrop (far hills + clouds, follow camera loosely)
scene.fog = new THREE.Fog('#d4efff', 45, 140);
stage.hemi.color.set('#ffffff'); stage.hemi.groundColor.set('#d8eec0'); stage.hemi.intensity = 1.2; sun.intensity = 1.6;
const back = new THREE.Group(); scene.add(back);
{
  const r = rng(77);
  const hillGeo = new THREE.SphereGeometry(1, 10, 6);   // low-poly look
  const cols = ['#a6dca0', '#b9e6a8', '#9fd6b5'];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(hillGeo, mat(cols[i % 3], { flatShading: true, roughness: 0.9 }));
    const s = 14 + r() * 16; m.scale.set(s * 1.6, s * (0.55 + r() * 0.35), s); m.position.set(-90 + i * 13 + r() * 6, -16 + r() * 4, -70 - r() * 25);
    back.add(m);
  }
  const cg = new THREE.SphereGeometry(1, 12, 8), cm = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(); const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const b = new THREE.Mesh(cg, cm); const s = 2 + r() * 2.2; b.scale.set(s, s * 0.8, s); b.position.set(k * 2.4 - n, r() * 1.2, 0); c.add(b); }
    c.position.set(-70 + i * 18 + r() * 8, 14 + r() * 12, -50 - r() * 20); back.add(c);
  }
}

// ------------------------------------------------------------------ the buggy
const carG = new THREE.Group(); scene.add(carG);
const RED = glossy('#ff4b3e', { roughness: 0.28 }), DARK = mat('#2e3440', { roughness: 0.7 }), CHROME = glossy('#e9edf2', { metalness: 0.5, roughness: 0.2 });
const add = (g, geo, m, x, y, z, rz = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.rotation.z = rz; k.castShadow = true; g.add(k); return k; };
add(carG, rounded(2.9, 0.5, 1.5, 0.2), RED, 0, 0, 0);                     // tub
add(carG, rounded(1.15, 0.36, 1.42, 0.16), RED, 0.82, 0.36, 0, -0.08);    // hood
add(carG, rounded(0.7, 0.28, 1.6, 0.12), DARK, -1.38, -0.12, 0);          // rear bumper
add(carG, rounded(0.36, 0.3, 1.62, 0.12), DARK, 1.48, -0.1, 0);           // front bumper
add(carG, rounded(0.08, 0.5, 1.3, 0.04), glossy('#bfe8ff', { roughness: 0.05, transparent: true, opacity: 0.7 }), 0.32, 0.62, 0, -0.35); // windshield
for (const z of [-0.6, 0.6]) {
  add(carG, new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), CHROME, -0.78, 0.66, z, 0.15);
  add(carG, new THREE.SphereGeometry(0.13, 12, 10), mat('#fff6c8', { emissive: '#ffe680', emissiveIntensity: 0.7 }), 1.5, 0.22, z * 0.8);
}
add(carG, new THREE.CylinderGeometry(0.06, 0.06, 1.26, 8), CHROME, -0.86, 1.12, 0).rotation.x = Math.PI / 2;
add(carG, rounded(0.5, 0.5, 0.9, 0.14), mat('#4a5568'), -0.35, 0.38, 0);    // seat
// driver: Pip the fox-blob in a little helmet
const pip = new THREE.Group(); pip.position.set(-0.22, 0.6, 0); carG.add(pip);
const ORANGE = mat('#ff9a3c', { roughness: 0.55 }), WHITE = mat('#fffaf0');
add(pip, new THREE.SphereGeometry(0.3, 20, 14), ORANGE, 0, 0, 0).scale.set(1, 0.9, 0.9);
const pHead = new THREE.Group(); pHead.position.set(0.02, 0.4, 0); pip.add(pHead);
add(pHead, new THREE.SphereGeometry(0.26, 22, 16), ORANGE, 0, 0, 0);
add(pHead, new THREE.SphereGeometry(0.15, 16, 12), WHITE, 0.17, -0.07, 0).scale.set(1, 0.75, 1.1);
add(pHead, new THREE.SphereGeometry(0.045, 10, 8), mat('#2b2d42'), 0.31, -0.03, 0);
for (const z of [-0.1, 0.1]) {
  add(pHead, new THREE.ConeGeometry(0.09, 0.2, 8), ORANGE, -0.02, 0.27, z * 1.4, -0.25);
  const e = add(pHead, new THREE.SphereGeometry(0.045, 10, 8), mat('#2b2d42'), 0.19, 0.06, z); e.scale.set(0.7, 1.2, 0.7);
}
add(pHead, new THREE.SphereGeometry(0.275, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), glossy('#3a86ff'), -0.03, 0.03, 0).rotation.z = 0.35;
const wheelG = [];
for (let i = 0; i < 2; i++) {
  const g = new THREE.Group(); scene.add(g);
  for (const z of [-0.72, 0.72]) {
    const tire = add(g, new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.4, 22), mat('#2b2d35', { roughness: 0.9 }), 0, 0, z); tire.rotation.x = Math.PI / 2;
    const hub = add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.42, 14), glossy('#ffd23f'), 0, 0, z); hub.rotation.x = Math.PI / 2;
    for (let k = 0; k < 3; k++) { const s = add(g, new THREE.BoxGeometry(0.62, 0.08, 0.43), glossy('#ffd23f'), 0, 0, z); s.rotation.z = k * Math.PI / 3; }
  }
  const strut = add(scene, new THREE.CylinderGeometry(0.07, 0.07, 1, 8), CHROME, 0, 0, 0);
  wheelG.push({ g, strut });
}

// ------------------------------------------------------------------ level world: terrain ribbon, trees, coins, cans, signs, flag
const ZF = 1.6, ZB = -16;
function terrainMesh() {
  const step = 2, cols = [], pos = [], idx = [];
  const C = (h) => new THREE.Color(h);
  const grassTop = C('#7ccf4a'), grassBack = C('#9bdc6a'), lip = C('#5fb33a'), dirtA = C('#c98a4b'), dirtB = C('#a86a36'), dirtC = C('#7e4d2a');
  const rows = [[0, lip], [-0.38, lip], [-0.42, dirtA], [-2.2, dirtA], [-2.5, dirtB], [-6, dirtB], [-6.4, dirtC], [-40, dirtC]];
  // front face
  let base = 0;
  for (let i = 0; i < T.n; i += step) {
    const x = i * DX + X0, h = T.H[i];
    for (const [o, c] of rows) { pos.push(x, o === -40 ? -45 : h + o, ZF); cols.push(c.r, c.g, c.b); }
  }
  const R = rows.length, cnt = Math.floor((T.n - 1) / step) + 1;
  for (let k = 0; k < cnt - 1; k++) for (let j = 0; j < R - 1; j++) { const a = k * R + j, b = a + R; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  // top surface
  base = pos.length / 3;
  for (let i = 0; i < T.n; i += step) {
    const x = i * DX + X0, h = T.H[i];
    for (const [z, c] of [[ZF, grassTop], [ZF - 1.2, grassTop], [ZB, grassBack]]) { pos.push(x, h, z); cols.push(c.r, c.g, c.b); }
  }
  for (let k = 0; k < cnt - 1; k++) for (let j = 0; j < 2; j++) { const a = base + k * 3 + j, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false })); m.receiveShadow = true; return m;
}
function signTex(text, bg = '#ffffff', fg = '#3a2e39') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect(6, 6, 244, 116, 24); x.fill(); x.fillStyle = fg; x.font = '800 64px "Baloo 2",system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let coinMesh, coinList = [], cans = [], dummy = new THREE.Object3D();
function buildLevel() {
  if (world) { scene.remove(world); world.traverse(o => { o.geometry && o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  D = 170 + (level - 1) * 110; flagX = D;
  T = makeTerrain(level, D + 80);
  world.add(terrainMesh());
  const r = rng(level * 131 + 5);
  // trees (round blobs + pines), instanced
  const N = Math.floor((D + 80 - X0) / 3.2);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 1.6, 6), mat('#8a5a34'), N);
  const blob = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#4fb84a', { flatShading: true, roughness: 0.8 }), N);
  const blobC = [new THREE.Color('#4fb84a'), new THREE.Color('#69c95a'), new THREE.Color('#3fa66a'), new THREE.Color('#8fd65a')];
  let ti = 0;
  for (let x = X0 + 2; ti < N && x < D + 70; x += 2.4 + r() * 2.2) {
    const z = -3.5 - r() * 11, s = 0.8 + r() * 0.9, h = T.h(x);
    dummy.position.set(x, h + 0.8 * s, z); dummy.scale.set(s, s, s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunk.setMatrixAt(ti, dummy.matrix);
    dummy.position.set(x, h + 2.1 * s, z); dummy.scale.set(s * 1.15, s * 1.3, s * 1.15); dummy.rotation.set(0, r() * 3, 0); dummy.updateMatrix(); blob.setMatrixAt(ti, dummy.matrix);
    blob.setColorAt(ti, blobC[Math.floor(r() * 4)]); ti++;
  }
  trunk.count = blob.count = ti; trunk.castShadow = blob.castShadow = true; world.add(trunk, blob);
  // little rocks + grass tufts on the front edge
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.45, 4), mat('#5fb33a'), 400); let tk = 0;
  for (let x = X0; x < D + 70 && tk < 400; x += 0.9 + r() * 1.2) { dummy.position.set(x, T.h(x) + 0.15, ZF - 0.1 - r() * 0.6); dummy.scale.setScalar(0.7 + r() * 0.8); dummy.rotation.set(0, 0, (r() - 0.5) * 0.6); dummy.updateMatrix(); tufts.setMatrixAt(tk++, dummy.matrix); }
  tufts.count = tk; world.add(tufts);
  // coins: little runs following the ground, sometimes arched over crests
  coinList = [];
  for (let x = 28; x < D - 8; x += 22 + r() * 14) {
    const n = 5, arch = r() < 0.4;
    for (let k = 0; k < n; k++) { const cx = x + k * 1.3; coinList.push({ x: cx, y: T.h(cx) + 1.1 + (arch ? Math.sin(k / (n - 1) * Math.PI) * 1.4 : 0), got: false }); }
  }
  coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 18), glossy('#ffc61a', { metalness: 0.2, roughness: 0.3, emissive: '#b37800', emissiveIntensity: 0.45 }), coinList.length);
  coinMesh.castShadow = true; world.add(coinMesh);
  // fuel cans
  cans = [];
  for (let x = 110; x < D - 20; x += 140 + r() * 30) {
    const g = new THREE.Group(); const body = add(g, rounded(0.62, 0.78, 0.36, 0.1), glossy('#ff3b3b'), 0, 0, 0);
    add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), DARK, 0.18, 0.46, 0, -0.5); add(g, rounded(0.36, 0.08, 0.38, 0.03), mat('#ffffff'), 0, 0, 0).rotation.z = 0.78;
    g.position.set(x, T.h(x) + 1.0, 0); world.add(g); cans.push({ x, g, got: false, body });
  }
  // distance signs every 50 m + best marker
  for (let x = 50; x < D; x += 50) addSign(x, x + 'm', '#ffffff', '#3a2e39');
  if (best > 20 && best < D) addSign(best, 'BEST', '#ffd23f', '#3a2e39');
  // finish flag
  const fl = new THREE.Group(); fl.position.set(flagX, T.h(flagX), -0.2); world.add(fl);
  add(fl, new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), CHROME, 0, 2.1, 0);
  const chk = new THREE.Group(); chk.position.set(0.95, 3.5, 0); fl.add(chk); fl.userData.chk = chk;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) add(chk, new THREE.BoxGeometry(0.3, 0.3, 0.06), mat((i + j) % 2 ? '#2b2d42' : '#ffffff'), -0.75 + i * 0.3, -0.45 + j * 0.3, 0);
  for (const s of [-1.6, 1.6]) { const b = add(fl, new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8), glossy('#ff7a2f'), 0, 1.7, s * 1.2); }
  world.userData.flag = fl;
  // car
  car = createCar(2, T.h(2) + 1.05);
  coins = 0; fuel = 100; lowFuelT = 0; stuckT = 0; endT = 0; slow = 0; ctl.gas = ctl.brake = false; ctl.noFuel = false;
  ui.levels(level); ui.progress(0); ui.score('0m'); ui.sub(''); coinsEl.textContent = 0; gaugeI.style.width = '100%';
  camPos.set(car.p.x + 2.5, car.p.y + 3, 19); camAt.set(car.p.x + 2.5, car.p.y + 1, 0);
  for (let i = 0; i < 240; i++) stepCar(car, T, ctl, 1 / 480);   // settle on the suspension
  syncCar();
}
function addSign(x, text, bg, fg) {
  const g = new THREE.Group(); g.position.set(x, T.h(x), -1.6); world.add(g);
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), mat('#8a5a34'), 0, 0.9, 0);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshStandardMaterial({ map: signTex(text, bg, fg), roughness: 0.7 })); p.position.set(0, 1.9, 0.05); g.add(p);
}

// ------------------------------------------------------------------ sound: a little engine hum (own AudioContext)
let ac = null, eng = null;
function engineOn() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o.start(); o2.start(); eng = { o, o2, g, f };
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) {}
}
function engineUpdate(rpm, on) {
  if (!eng) return; const n = ac.currentTime;
  eng.o.frequency.setTargetAtTime(48 + rpm * 85, n, 0.05); eng.o2.frequency.setTargetAtTime(24 + rpm * 42, n, 0.05);
  eng.g.gain.setTargetAtTime(on ? 0.035 + rpm * 0.025 : 0, n, 0.08);
}

// ------------------------------------------------------------------ input: hold right half = gas, left half = brake
const held = new Map();
function refreshCtl() { let g = false, b = false; for (const s of held.values()) s === 'g' ? g = true : b = true; ctl.gas = g; ctl.brake = b && !g; }
input({
  onDown(e) { if (state !== 'play') return; engineOn(); held.set(e.pointerId ?? 0, e.clientX > innerWidth / 2 ? 'g' : 'b'); refreshCtl(); tone(e.clientX > innerWidth / 2 ? 200 : 140, 0.05, 'square', 0.04, 1.3); },
  onUp(e) { held.delete(e.pointerId ?? 0); refreshCtl(); },
});
addEventListener('pointerup', e => { held.delete(e.pointerId ?? 0); refreshCtl(); });
addEventListener('pointercancel', e => { held.delete(e.pointerId ?? 0); refreshCtl(); });
const keys = {};
addEventListener('keydown', e => { keys[e.key] = 1; if (state === 'play') engineOn(); });
addEventListener('keyup', e => { keys[e.key] = 0; });

ui.onTap(w => {
  held.clear(); refreshCtl();
  if (w === 'win') { level++; save.set('level', level); }
  if (w !== 'start') buildLevel();
  state = 'play'; engineOn();
});

// ------------------------------------------------------------------ feedback helpers
const _v = new THREE.Vector3();
function tip(text, x, y, size = 26, color = '#fff') {
  _v.set(x, y, 0).project(camera); const d = div('bb-tip', text);
  d.style.left = (_v.x + 1) / 2 * innerWidth + 'px'; d.style.top = (1 - _v.y) / 2 * innerHeight + 'px'; d.style.fontSize = size + 'px'; d.style.color = color;
  setTimeout(() => d.remove(), 800);
}
function addCoins(n) { coins += n; coinsEl.textContent = coins; }
function finish(won, why) {
  if (state !== 'play') return;
  state = won ? 'won' : 'lost'; held.clear(); refreshCtl(); engineUpdate(0, false);
  const dist = Math.max(0, Math.round(car.p.x));
  if (dist > best) { best = dist; save.set('best', best); }
  if (won) { sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(car.p.x + 1, car.p.y + 3, 0), 90); ui.flash(0.5); slow = 1; ui.win(level, `${coins} coins · ${dist} m`); }
  else { sfx.fail(); buzz([60, 40, 80]); ui.lose(why, `${dist} m · ${coins} coins`); }
}

// ------------------------------------------------------------------ sync visuals
function syncCar() {
  carG.position.set(car.p.x, car.p.y, 0); carG.rotation.z = car.a;
  car.wheels.forEach((wh, i) => {
    const W = wheelG[i]; W.g.position.set(wh.p.x, wh.p.y, 0); W.g.rotation.z = wh.ang;
    const cs = Math.cos(car.a), sn = Math.sin(car.a), ax = car.p.x + cs * wh.lx - sn * (wh.ly + 0.25), ay = car.p.y + sn * wh.lx + cs * (wh.ly + 0.25);
    const dx = wh.p.x - ax, dy = wh.p.y - ay, len = Math.hypot(dx, dy) || 0.01;
    W.strut.position.set((ax + wh.p.x) / 2, (ay + wh.p.y) / 2, 0); W.strut.scale.y = len; W.strut.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  });
}

// ------------------------------------------------------------------ main loop
const camPos = new THREE.Vector3(), camAt = new THREE.Vector3();
let acc = 0, t = 0, dustT = 0, squash = 0;
loop((dt60) => {
  const rdt = Math.min(dt60 / 60, 1 / 30); t += rdt;
  if (slow > 0) slow = Math.max(0, slow - rdt * 0.8);
  if (state === 'play') {
    const kg = keys.ArrowRight || keys.ArrowUp || keys.d, kb = keys.ArrowLeft || keys.ArrowDown || keys.a;
    const c2 = { gas: ctl.gas || !!kg, brake: (ctl.brake || !!kb) && !(ctl.gas || kg), noFuel: fuel <= 0 };
    acc += rdt; let n = 0;
    while (acc >= 1 / 480 && n < 20) { stepCar(car, T, c2, 1 / 480); acc -= 1 / 480; n++; }
    // fuel
    fuel = Math.max(0, fuel - rdt * (c2.gas ? 2.4 : 0.9));
    gaugeI.style.width = fuel + '%'; hudFuel.querySelector('.bb-gauge').classList.toggle('low', fuel < 22);
    if (fuel < 22 && (lowFuelT -= rdt) < 0) { lowFuelT = 0.8; tone(880, 0.08, 'square', 0.05, 1); }
    pedGas.classList.toggle('on', c2.gas); pedBrake.classList.toggle('on', c2.brake);
    const spd = Math.hypot(car.v.x, car.v.y);
    engineUpdate(clamp(Math.abs(car.wheels[0].om) * WHEEL_R / 21, 0, 1.3) + (c2.gas ? 0.25 : 0), true);
    // pickups
    coinList.forEach((c, i) => { if (!c.got && Math.abs(c.x - car.p.x) < 1.7 && Math.abs(c.y - (car.p.y + 0.3)) < 1.5) { c.got = true; addCoins(1); sfx.coin(); burst(scene, new THREE.Vector3(c.x, c.y, 0.3), ['#ffd23f', '#fff3a0'], 6, { speed: 0.08, up: 0.06, size: 0.5, life: 0.6 }); } });
    for (const c of cans) if (!c.got && Math.abs(c.x - car.p.x) < 1.8 && Math.abs(c.g.position.y - car.p.y) < 2) {
      c.got = true; c.g.visible = false; fuel = 100; tone(500, 0.1, 'triangle', 0.14, 1.6); setTimeout(() => tone(800, 0.14, 'triangle', 0.14, 1.4), 90);
      ui.pop('FUEL!', '#ff4b4b', 40, 30); burst(scene, c.g.position.clone(), ['#ff4b4b', '#ffffff'], 14, { speed: 0.12, up: 0.08, size: 0.6 }); buzz(15);
    }
    // landings, air time, flips
    if (car.landed) {
      const L = car.landed; car.landed = null;
      const flips = Math.floor((Math.abs(L.rot) + 0.6) / (Math.PI * 2));
      if (flips > 0) { addCoins(10 * flips); ui.pop(flips > 1 ? `${flips}x FLIP! +${10 * flips}` : 'FLIP! +10', '#ffd23f', 44, 28); sfx.win(); buzz(30); }
      else if (L.t > 0.9) { const b = Math.round(L.t * 3); addCoins(b); tip(`AIR TIME +${b}`, car.p.x, car.p.y + 2.2, 26, '#ffd23f'); tone(660, 0.1, 'triangle', 0.12, 1.5); }
      const imp = Math.max(...car.wheels.map(w => w.hitJ));
      if (imp > 3) { squash = Math.min(1, imp / 12); shake = Math.min(0.6, imp / 25); sfx.bounce(); buzz(12); burst(scene, new THREE.Vector3(car.p.x, T.h(car.p.x) + 0.1, 0.6), ['#d9b38c', '#c4996b', '#ffffff'], 10, { speed: 0.1, up: 0.05, size: 0.6, life: 0.6 }); }
    }
    car.wheels.forEach(w => w.hitJ = 0);
    if (car.bodyHit > 3) { shake = Math.max(shake, 0.3); tone(120, 0.1, 'square', 0.08, 0.6); } car.bodyHit = 0;
    // dust while driving on the ground
    if ((dustT -= rdt) < 0 && car.wheels[0].contact && spd > 5 && c2.gas) { dustT = 0.09; const w = car.wheels[0]; burst(scene, new THREE.Vector3(w.p.x - 0.4, w.p.y - 0.3, 0.8), '#e7cfa8', 2, { speed: 0.04, up: 0.03, size: 0.5, gravity: -0.001, life: 0.5 }); }
    // progress
    const dist = Math.max(0, car.p.x);
    ui.score(Math.floor(dist) + 'm'); ui.progress(dist / D); ui.sub(best > 0 ? `best ${best}m` : '');
    if (car.crashed) { shake = 0.8; ui.flash(0.4); burst(scene, (h => new THREE.Vector3(h.x, h.y, 0.3))(headPos(car)), ['#ff9a3c', '#ffffff', '#3a86ff'], 22, { speed: 0.18, up: 0.12, size: 0.7 }); sfx.smash(); finish(false, 'OUCH!'); }
    else if (car.p.x >= flagX) finish(true);
    else if (fuel <= 0) { if (spd < 0.6) stuckT += rdt; else stuckT = 0; if (stuckT > 1.2) finish(false, 'OUT OF FUEL'); }
    else if (car.p.y < -60) finish(false, 'OOPS!');
  } else {
    // after the end keep simulating gently (car keeps rolling / tumbling)
    acc += rdt * (slow > 0 ? 0.3 : 1); let n = 0;
    if (car) while (acc >= 1 / 480 && n < 20) { stepCar(car, T, { gas: false, brake: state === 'won', noFuel: true }, 1 / 480); acc -= 1 / 480; n++; }
    engineUpdate(0, false); pedGas.classList.remove('on'); pedBrake.classList.remove('on');
  }
  // visuals
  syncCar();
  squash = Math.max(0, squash - rdt * 4); carG.scale.set(1 + squash * 0.08, 1 - squash * 0.12, 1);
  pHead.rotation.z = clamp(-car.w * 0.05, -0.4, 0.4) + Math.sin(t * 9) * 0.03 * Math.min(1, Math.abs(car.v.x) / 10);
  coinList.forEach((c, i) => { dummy.position.set(c.x, c.y + Math.sin(t * 3 + i) * 0.08, 0); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.rotateZ(Math.sin(t * 2.4 + i * 0.5) * 0.7); dummy.scale.setScalar(c.got ? 0 : 1); dummy.updateMatrix(); coinMesh.setMatrixAt(i, dummy.matrix); });
  coinMesh.instanceMatrix.needsUpdate = true;
  for (const c of cans) { c.g.rotation.y = Math.sin(t * 2) * 0.5; c.g.position.y = T.h(c.x) + 1.0 + Math.sin(t * 3) * 0.1; }
  const fl = world.userData.flag; fl.userData.chk.rotation.y = Math.sin(t * 4) * 0.25;
  // camera: side view, a little above, looking ahead; zooms out with speed
  const spd = Math.abs(car.v.x), ahead = clamp(car.v.x * 0.18, -1, 3.5);
  const dist = 19 + clamp(spd * 0.22, 0, 5);
  const k = 1 - Math.pow(0.02, rdt);
  camAt.lerp(_v.set(car.p.x + 2 + ahead, car.p.y + 0.6, 0), k);
  camPos.set(camAt.x - 1.2, camAt.y + 3.4, dist);
  shake = Math.max(0, shake - rdt * 2);
  camera.position.copy(camPos).add(_v.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); camera.lookAt(camAt.x, camAt.y + 1.0, 0);
  back.position.x = camAt.x * 0.7;   // parallax: far hills drift slower than the ground
  followLight(_v.set(car.p.x + 2, car.p.y, 0));
});
buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.floor(Math.max(0, car.p.x)); },
  bot() {
    if (state !== 'play') return;
    const a = Math.atan2(Math.sin(car.a), Math.cos(car.a));
    let g = true, b = false;
    if (car.grounded) {
      const sl = Math.atan(T.slope(car.p.x)), rel = a - sl;
      const e = rel + 0.2 * car.w; if (e > 0.45) { g = false; b = e > 0.75; }
    } else {
      const target = Math.atan(T.slope(car.p.x + car.v.x * 0.3)) * 0.7, rel = a - target + 0.35 * car.w;
      g = rel < -0.15; b = rel > 0.15;
    }
    held.clear(); if (g) held.set('bot', 'g'); else if (b) held.set('bot', 'b'); refreshCtl();
  },
};

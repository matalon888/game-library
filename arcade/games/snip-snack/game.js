// Snip Snack — original game. A candy dangles on ropes inside a cardboard box; swipe to snip the ropes,
// grab the stars on the way down and drop the sweet into the mouth of Pip, a sleepy hedgehog on a pillow.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { DT, swipe, press, botStroke } from './rope.js';
import { generate, buildSim, act } from './level.js';
import { makeHedgehog } from './creature.js';
import { flow } from './kit/flow.js';

const stage = createStage({ fov: 42, shadows: true, shadowSize: 12 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'SNIP<br>SNACK', hint: 'Swipe to snip the strings', hand: '✂️', score: false });
document.body.style.setProperty('--bg1', '#f0c58f'); document.body.style.setProperty('--bg2', '#d9a46a'); document.body.style.setProperty('--ui', '#ff6f91');
const css = document.createElement('style');
css.textContent = `.hc-card h1{color:#fff;text-shadow:0 6px 0 #c2456b,0 10px 18px rgba(120,50,20,.25)}
.hc-card p,.hc-card .hint{color:#fff;text-shadow:0 3px 0 rgba(140,70,20,.35)}
.hc-card.dim{background:rgba(70,35,10,.28)} .hc-lvl.next{color:#ff6f91} .hc-bar{background:rgba(255,255,255,.55)}
.hc-sub{color:#7a4a22;text-shadow:none;font-weight:800;top:calc(96px + env(safe-area-inset-top))}
.ss-stars{position:fixed;top:calc(52px + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;gap:6px;pointer-events:none;z-index:5}
.ss-stars b{font-size:34px;line-height:1;color:rgba(122,74,34,.28);transition:color .2s;text-shadow:0 2px 0 rgba(255,255,255,.35)}
.ss-stars b.on{color:#ffd23f;text-shadow:0 3px 0 #d98b00,0 0 14px rgba(255,220,80,.8);animation:sspop .45s ease-out}
.ss-win{font-size:46px!important;letter-spacing:4px;color:#ffd23f!important;text-shadow:0 4px 0 #d98b00!important}
@keyframes sspop{0%{transform:scale(.4)}60%{transform:scale(1.5)}100%{transform:scale(1)}}`;
document.head.appendChild(css);
const starHud = document.createElement('div'); starHud.className = 'ss-stars'; starHud.innerHTML = '<b>★</b><b>★</b><b>★</b>'; document.body.appendChild(starHud);
const save = store('snipsnack');
const F = flow('snipsnack');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), totalStars = save.get('stars', 0), state = 'ready';

// ------------------------------------------------------------------ cardboard box backdrop
function cardboardTex() {
  const W = 512, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f7cf94'); gr.addColorStop(0.55, '#eab06c'); gr.addColorStop(1, '#d68f4c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '120,70,30' : '255,235,200'},${0.04 + rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1); }
  for (let x = 0; x < W; x += 9) { g.fillStyle = 'rgba(140,85,40,0.035)'; g.fillRect(x, 0, 3, H); }          // corrugation
  g.fillStyle = 'rgba(130,75,30,0.18)'; g.fillRect(W * 0.5 - 2, 0, 4, H);                                // panel fold
  g.fillStyle = 'rgba(255,240,215,0.22)'; g.fillRect(W * 0.5 + 2, 0, 3, H);
  for (const y of [H * 0.18, H * 0.62]) { g.fillStyle = 'rgba(255,248,225,0.32)'; g.fillRect(0, y, W, 46); g.fillStyle = 'rgba(160,110,50,0.12)'; g.fillRect(0, y + 44, W, 3); } // packing tape
  g.globalAlpha = 0.16; g.strokeStyle = '#8a4f22'; g.lineWidth = 6; g.lineCap = 'round';
  const arrow = (x, y) => { g.beginPath(); g.moveTo(x, y + 40); g.lineTo(x, y - 30); g.moveTo(x - 18, y - 12); g.lineTo(x, y - 32); g.lineTo(x + 18, y - 12); g.stroke(); };
  arrow(80, 860); arrow(120, 860);
  g.lineWidth = 4; g.beginPath(); g.arc(420, 420, 36, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(404, 420); g.lineTo(436, 420); g.moveTo(420, 404); g.lineTo(420, 436); g.stroke();
  g.globalAlpha = 1;
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,45,10,0.35)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 30), mat('#ffffff', { map: cardboardTex(), roughness: 0.95 }));
wall.position.z = -2; wall.receiveShadow = true; scene.add(wall);
const sideMat = mat('#c98c52', { roughness: 0.95 });
for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 30), sideMat); w.position.set(s * 7.5, 0, 1); w.rotation.y = -s * Math.PI / 2; scene.add(w); }
stage.hemi.color.set('#fff6ea'); stage.hemi.groundColor.set('#e8b98a'); stage.hemi.intensity = 1.25; sun.intensity = 1.5;
sun.position.set(3, 9, 14); sun.target.position.set(0, 0, 0);

// ------------------------------------------------------------------ shared geometry/materials
function candyTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fff4f6'; g.fillRect(0, 0, 256, 128);
  for (let i = -4; i < 12; i++) { g.fillStyle = i % 2 ? '#ff3d6e' : '#ff9bb7'; g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 14, 0); g.lineTo(i * 32 + 14 + 64, 128); g.lineTo(i * 32 + 64, 128); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
const candy = new THREE.Group(); scene.add(candy);
const candyBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 22), glossy('#ffffff', { map: candyTex(), roughness: 0.15 })); candyBall.castShadow = true; candy.add(candyBall);
for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.36, 12), glossy('#ffd23f', { roughness: 0.3 })); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.5; w.castShadow = true; candy.add(w); }
const shine = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.7 })); shine.position.set(-0.15, 0.18, 0.33); candy.add(shine);

const ROPE_MAX = 200;
const ropeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 8), mat('#ffffff', { roughness: 0.7 }), ROPE_MAX);
ropeMesh.castShadow = true; ropeMesh.frustumCulled = false; scene.add(ropeMesh);
const RC = [new THREE.Color('#b9773e'), new THREE.Color('#ecc58e')];
for (let i = 0; i < ROPE_MAX; i++) ropeMesh.setColorAt(i, RC[i % 2]);

function starGeo() {
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.19 : 0.42, a = Math.PI / 2 + i * Math.PI / 5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 2 }); g.translate(0, 0, -0.06); return g;
}
const STAR_G = starGeo(), STAR_M = glossy('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.35, roughness: 0.25 });
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,240,150,0.9)'); r.addColorStop(1, 'rgba(255,220,80,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const GLOW_M = new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false });
const PIN_G = new THREE.CylinderGeometry(0.2, 0.22, 0.2, 20), PIN_M = glossy('#6d8fe0', { roughness: 0.25 }), RING_G = new THREE.TorusGeometry(0.24, 0.06, 8, 22), RING_M = glossy('#ffffff');
const BUB_M = new THREE.MeshStandardMaterial({ color: '#d8f6ff', emissive: '#8fd8ff', emissiveIntensity: 0.5, transparent: true, opacity: 0.58, roughness: 0.05, metalness: 0.1, depthWrite: false });
const BUB_RIM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 });

const pip = makeHedgehog(); scene.add(pip.root);
// sleepy z's
function zTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '800 54px "Baloo 2",system-ui'; g.textAlign = 'center'; g.lineWidth = 8; g.strokeStyle = '#8a5aa8'; g.strokeText('z', 32, 48); g.fillStyle = '#ffffff'; g.fillText('z', 32, 48); return new THREE.CanvasTexture(c); }
const Z_M = new THREE.SpriteMaterial({ map: zTex(), transparent: true, depthWrite: false });
const zs = [0, 1, 2].map(i => { const s = new THREE.Sprite(Z_M.clone()); s.userData.ph = i / 3; scene.add(s); return s; });

// trail (glowing swipe)
const TRAIL_N = 60;
const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), TRAIL_N); trail.frustumCulled = false; scene.add(trail);
let trailPts = [];

// ------------------------------------------------------------------ level
let L, sim, lvl = new THREE.Group(), starObjs = [], bubbleObj = null, cushObjs = [], pinObjs = [], got = 0, startD = 1, bestP = 0, caught = false, botOn = false, playT = 0, acc = 0, shake = 0, outT = 0;
scene.add(lvl);
function buildLevel() {
  scene.remove(lvl); lvl = new THREE.Group(); scene.add(lvl);
  L = generate(level, F.k()); sim = buildSim(L);
  starObjs = L.stars.map(s => { const m = new THREE.Mesh(STAR_G, STAR_M); m.position.set(s.x, s.y, 0); m.castShadow = true; const gl = new THREE.Sprite(GLOW_M); gl.scale.setScalar(1.5); gl.position.set(s.x, s.y, -0.2); lvl.add(m, gl); return { m, gl, x: s.x, y: s.y, got: false }; });
  pinObjs = L.pins.map(p => { const g = new THREE.Group(); const b = new THREE.Mesh(PIN_G, PIN_M); b.rotation.x = Math.PI / 2; b.castShadow = true; const r = new THREE.Mesh(RING_G, RING_M); r.position.z = 0.08; const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glossy('#2f3f74')); dot.position.z = 0.14; g.add(b, r, dot); g.position.set(p.x, p.y, 0); lvl.add(g); return g; });
  bubbleObj = null;
  if (L.bubble) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.78, 28, 20), BUB_M); const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 })); h.position.set(-0.3, 0.36, 0.55); h.scale.set(1.3, 0.8, 0.5); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 8, 40), BUB_RIM); b.add(h, rim); b.position.set(L.bubble.x, L.bubble.y, 0); lvl.add(b); bubbleObj = b; }
  cushObjs = L.cushions.map(k => { const g = new THREE.Group(); const body = new THREE.Mesh(rounded(1.0, 0.95, 0.9, 0.3), glossy('#ff8fb1', { roughness: 0.35 })); body.castShadow = true; const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 0.55, 18), glossy('#ffd23f')); nz.rotation.z = k.dir * Math.PI / 2; nz.position.x = k.dir * 0.72; nz.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18), glossy('#ffffff')); ring.rotation.y = Math.PI / 2; ring.position.x = k.dir * 1.0; g.add(ring); g.add(body, nz); g.position.set(k.x, k.y, 0); lvl.add(g); g.userData.sq = 0; return g; });
  pip.root.position.set(L.mouth.x, L.mouth.y + 0.32, -0.2); pip.reset();
  got = 0; caught = false; playT = 0; acc = 0; outT = 0; bestP = 0; trailPts = [];
  startD = Math.hypot(L.candy.x - L.mouth.x, L.candy.y - L.mouth.y);
  candy.visible = true; candy.scale.setScalar(1);
  for (const b of starHud.children) b.classList.remove('on');
  ui.levels(level); ui.progress(0); ui.sub(L.bubble && L.cushions.length ? 'Pop the bubble, puff the cushion' : L.bubble ? 'Tap the bubble to pop it' : L.cushions.length ? 'Tap the cushion to puff' : '');
  for (const a of L.plan) a.done = false;
  draw(0, 0);
}

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hp = new THREE.Vector3(), _v = new THREE.Vector3();
function world(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hp) ? { x: hp.x, y: hp.y } : null; }
function screen(x, y) { _v.set(x, y, 0).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; }
let last = null;
function addTrail(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 0.12)); for (let i = 1; i <= n; i++) trailPts.push({ x: lerp(a.x, b.x, i / n), y: lerp(a.y, b.y, i / n), life: 1 }); if (trailPts.length > TRAIL_N) trailPts.splice(0, trailPts.length - TRAIL_N); }
input({
  onDown(e) { if (state !== 'play' || caught) return; const w = world(e.clientX, e.clientY); if (!w) return; press(sim, w.x, w.y); last = w; trailPts.push({ x: w.x, y: w.y, life: 1 }); },
  onMove(dx, dy, e) { if (!last || state !== 'play' || caught) return; const w = world(e.clientX, e.clientY); if (!w) return; swipe(sim, last.x, last.y, w.x, w.y); addTrail(last, w); last = w; },
  onUp() { last = null; },
});
function botAct(a) {   // the bot plays through real pointer events, exactly the gesture the generator simulated
  const fire = (type, p) => dispatchEvent(new PointerEvent(type, { clientX: p[0], clientY: p[1], pointerId: 1, isPrimary: true }));
  if (a.type === 'cut') { const [ax, ay, bx, by] = botStroke(sim, a.rope); const A = screen(ax, ay), B = screen(bx, by); fire('pointerdown', A); fire('pointermove', B); fire('pointerup', B); }
  else { const p = a.type === 'pop' ? [sim.candy.x, sim.candy.y] : [sim.cushions[0].x, sim.cushions[0].y]; const s = screen(p[0], p[1]); fire('pointerdown', s); fire('pointerup', s); }
}

// ------------------------------------------------------------------ events / juice
const V = (x, y, z = 0.3) => new THREE.Vector3(x, y, z);
function handleEvents() {
  for (const ev of sim.events) {
    if (ev.t === 'cut') { tone(1500, 0.05, 'triangle', 0.12, 0.4); tone(700, 0.08, 'sine', 0.08, 0.5); buzz(12); burst(scene, V(ev.x, ev.y), ['#ecc58e', '#b9773e', '#ffffff'], 10, { speed: 0.06, up: 0.04, size: 0.35, life: 0.6 }); shake = Math.max(shake, 0.12); }
    if (ev.t === 'bubble') { tone(500, 0.25, 'sine', 0.1, 1.9); buzz(8); }
    if (ev.t === 'pop') { tone(1100, 0.05, 'square', 0.06, 0.4); tone(600, 0.1, 'sine', 0.1, 0.5); buzz(15); if (bubbleObj) bubbleObj.visible = false; burst(scene, V(ev.x, ev.y), ['#d8f3ff', '#ffffff'], 16, { speed: 0.09, up: 0.03, size: 0.45, shape: 'sphere', life: 0.6 }); ui.pop('POP!', '#ffffff', 38, 40); }
    if (ev.t === 'blow') { const o = cushObjs[0]; o.userData.sq = 1; tone(220, 0.3, 'sawtooth', 0.05, 0.4); buzz(10); for (let i = 0; i < 3; i++) burst(scene, V(ev.k.x + ev.k.dir * (0.9 + i * 0.5), ev.k.y), '#ffffff', 5, { speed: 0.04, up: 0.01, size: 0.6, shape: 'sphere', gravity: 0, life: 0.5 }); }
  }
  sim.events.length = 0;
}
function onStar(s, i) {
  s.got = true; got++; totalStars++; s.m.visible = s.gl.visible = false;
  const b = starHud.children[got - 1]; b.classList.add('on');
  sfx.pick(got * 2); tone(1300 + got * 200, 0.1, 'triangle', 0.08, 1.3); buzz(15);
  burst(scene, V(s.x, s.y), ['#ffd23f', '#fff3a8', '#ffffff'], 20, { speed: 0.1, up: 0.05, size: 0.45, life: 0.8 });
  ui.pop(['NICE!', 'SWEET!', 'PERFECT!'][got - 1], '#ffd23f', 34 + got * 4, 30);
}
function win() {
  caught = true; state = 'won'; F.level(true); candy.visible = false; pip.chomp();
  const mp = V(L.mouth.x, L.mouth.y + 0.2, 1);
  sfx.win(); tone(160, 0.12, 'square', 0.1, 0.6); buzz([20, 40, 30]); ui.flash(0.45); shake = 0.3;
  burst(scene, mp, ['#ff3d6e', '#ff9bb7', '#ffffff'], 22, { speed: 0.12, up: 0.08, size: 0.5, shape: 'sphere' });
  confetti(scene, V(L.mouth.x, L.mouth.y + 2.5, 1), 70);
  ui.pop('YUM!', '#ff6f91', 56, 34);
  save.set('stars', totalStars); save.set('level', level + 1);
  ui.win(level, '★'.repeat(got) + '☆'.repeat(3 - got));
  setTimeout(() => { const x = ui.els.win.querySelector('[data-x]'); x.classList.add('ss-win'); }, 0);
}
function lose() {
  state = 'lost'; F.level(false, bestP); pip.setSad(true); sfx.fail(); buzz([40, 30, 60]);
  ui.lose('MISSED!', 'Pip is still hungry…');
}
ui.onTap(w => {
  if (w === 'win') level++;
  state = 'play'; buildLevel();
});

// ------------------------------------------------------------------ render
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
function draw(t, dt) {
  // ropes
  let n = 0;
  for (const r of sim.ropes) for (const s of r.segs) {
    if (!s.alive || n >= ROPE_MAX) continue;
    if (s.b === sim.candy && !candy.visible) continue;
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len = Math.hypot(dx, dy) + 0.04;
    _d.set(dx, dy, 0).normalize(); _q.setFromUnitVectors(UP, _d); _p.set((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2, 0); _s.set(1, len, 1);
    _m.compose(_p, _q, _s); ropeMesh.setMatrixAt(n++, _m);
  }
  ropeMesh.count = n; ropeMesh.instanceMatrix.needsUpdate = true;
  // candy
  const c = sim.candy, dm = Math.hypot(c.x - L.mouth.x, c.y - L.mouth.y);
  candy.position.set(c.x, c.y, clamp(1.6 - dm, 0, 1) * 0.9); candyBall.rotation.z = c.ang; candy.rotation.z = Math.sin(t * 2) * 0.15 + (c.x - c.ox) * 3;
  const sp = Math.hypot(c.x - c.ox, c.y - c.oy) * 120; candy.scale.set(1 + Math.min(0.12, sp * 0.008), 1 - Math.min(0.1, sp * 0.006), 1);
  if (bubbleObj && bubbleObj.visible) {
    if (sim.inBubble) { bubbleObj.position.set(c.x, c.y, 0); const w = Math.sin(t * 9) * 0.05; bubbleObj.scale.set(1 + w, 1 - w, 1); }
    else bubbleObj.scale.setScalar(1 + Math.sin(t * 3) * 0.04);
  }
  for (const s of starObjs) { s.m.rotation.y = Math.sin(t * 2.2 + s.x) * 0.45; s.m.rotation.z = Math.sin(t * 1.3 + s.y) * 0.12; s.m.position.y = s.y + Math.sin(t * 3 + s.x) * 0.08; s.gl.scale.setScalar(1.4 + Math.sin(t * 4 + s.x) * 0.15); }
  for (const k of cushObjs) { k.userData.sq = Math.max(0, k.userData.sq - dt * 3); const q = Math.sin(k.userData.sq * 8) * k.userData.sq * 0.3; k.scale.set(1 + q, 1 - q, 1); }
  // creature
  const near = state === 'play' ? clamp(1 - (dm - 0.8) / 3.2, 0, 1) : 0;
  pip.update(t, dt, { x: c.x - L.mouth.x, y: c.y - L.mouth.y }, near, state === 'won' || (state === 'play' && (sim.ropes.some(r => r.cut) || dm < 5.5)));
  for (const z of zs) { const k = (t * 0.35 + z.userData.ph) % 1; z.visible = !(state === 'play' && (sim.ropes.some(r => r.cut) || dm < 5.5)) && state !== 'won'; z.position.set(L.mouth.x + 0.9 + k * 0.9 + Math.sin(k * 6) * 0.15, L.mouth.y + 1.6 + k * 1.8, 0.5); z.scale.setScalar(0.35 + k * 0.4); z.material.opacity = Math.sin(k * Math.PI); }
  // trail
  for (const p of trailPts) p.life -= dt * 4.5; trailPts = trailPts.filter(p => p.life > 0);
  for (let i = 0; i < TRAIL_N; i++) { const p = trailPts[i]; if (p) _m.compose(_p.set(p.x, p.y, 0.5), _q.identity(), _s.setScalar(p.life * 1.1)); else _m.makeScale(0, 0, 0); trail.setMatrixAt(i, _m); }
  trail.instanceMatrix.needsUpdate = true;
}

let t = 0;
loop((dt60) => {
  const rdt = Math.min(dt60 / 60, 1 / 20); t += rdt;
  if (state === 'play' && !caught) {
    acc += rdt; let k = 0;
    while (acc >= DT && k < 8 && state === 'play') {
      if (botOn) for (const a of L.plan) if (!a.done && a.step === sim.steps) { a.done = true; botAct(a); }
      sim.step(); acc -= DT; k++; playT += DT;
      handleEvents();
      const c = sim.candy;
      starObjs.forEach((s, i) => { if (!s.got && Math.hypot(c.x - s.x, c.y - s.y) < 0.62) onStar(s, i); });
      if (Math.hypot(c.x - L.mouth.x, c.y - L.mouth.y) < 0.9) { win(); break; }
      if (c.y < -11.5 || c.y > 11.5 || Math.abs(c.x) > 6.5) { lose(); break; }
    }
    const dm = Math.hypot(sim.candy.x - L.mouth.x, sim.candy.y - L.mouth.y);
    bestP = Math.max(bestP, clamp(1 - dm / startD, 0, 1) * 0.85 + got * 0.05); ui.progress(bestP);
  }
  if (state === 'won') ui.progress(1);
  draw(t, rdt);
  // camera: fit ~10.4 units of width / 21.5 of height on the z=0 plane
  const tanH = Math.tan(camera.fov * Math.PI / 360), halfH = Math.max(10.7, 5.25 / camera.aspect), dist = halfH / tanH;
  shake = Math.max(0, shake - rdt * 1.5);
  camera.position.set((Math.random() - 0.5) * shake, -0.35 + (Math.random() - 0.5) * shake, dist); camera.lookAt(0, -0.35, 0);
  sun.position.set(3, 9, 14);
});

buildLevel();

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return totalStars; },
  bot() { if (state === 'play') botOn = true; },
};

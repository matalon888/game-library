// Cubeburrow — first-person block island. Dig, chop, craft and build; today's island comes with three build goals
// to finish before night. Free Sandbox mode keeps your own island between visits.
import { THREE, createStage, createUI, store, loop, buzz, tone, note, burst, confetti, clamp, rng } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { createWorld, BLOCKS, PLACEABLE, CS, NC, W, H, SEA, AIR, GRASS, DIRT, STONE, SAND, SNOW, LOG, LEAVES, PLANKS, GLASS, BRICK, COBBLE, LAMP, WATER, CRYSTAL, CLAY, CACTUS, SKY, SUNT, SNOWG, blockMesh } from './world.js';
import { makeAtlas, icon } from './atlas.js';

const NAME = 'Cubeburrow: Block Building Sandbox';
const S = store('cubeburrow');
const F = flow('cubeburrow');
const stage = createStage({ fov: 70, shadows: false, clear: '#9fd4ff' });
const { scene, camera, renderer } = stage;
camera.far = 700; camera.updateProjectionMatrix(); camera.rotation.order = 'YXZ'; scene.add(camera);
const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const ui = createUI({ title: 'CUBE<br>BURROW', hint: TOUCH ? 'Tap to start today’s build' : 'Click to start today’s build', hand: '⛏️', progress: false, score: false });
const D = daily('cubeburrow', ui, { name: NAME });
const B = board({ game: 'cubeburrow', label: 'Build points', limits: { maxRun: 2200, maxPerSec: 40 }, corner: 'tl' });
const today = new Date(), DAYSEED = D.seed || today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

// ---------------------------------------------------------------- materials (raw colour pipeline: painted colours in, same colours out)
const atlas = makeAtlas();
const tex = new THREE.CanvasTexture(atlas); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
const U = { map: { value: tex }, uDay: { value: new THREE.Vector3(1, 1, 1) }, uFog: { value: new THREE.Vector3(0.75, 0.88, 1) }, uFogN: { value: 30 }, uFogF: { value: 64 }, uAlpha: { value: 1 } };
const VS = `attribute float sh; attribute float li; varying vec2 vUv; varying float vSh; varying float vLi; varying float vD;
void main(){ vUv=uv; vSh=sh; vLi=li; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=length(mv.xyz); gl_Position=projectionMatrix*mv; }`;
const FS = `uniform sampler2D map; uniform vec3 uDay; uniform vec3 uFog; uniform float uFogN; uniform float uFogF; uniform float uAlpha;
varying vec2 vUv; varying float vSh; varying float vLi; varying float vD;
void main(){ vec4 t=texture2D(map,vUv); if(t.a<0.5) discard; vec3 lit=vSh*uDay;
 if(vLi>1.5) lit=vec3(1.06); else lit=max(lit, vLi*vLi*vec3(1.3,1.02,0.66)*(0.45+0.55*vSh));
 vec3 c=t.rgb*lit; c=mix(c,uFog,smoothstep(uFogN,uFogF,vD)); gl_FragColor=vec4(c,uAlpha); }`;
const solidMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS });
const waterMat = new THREE.ShaderMaterial({ uniforms: { ...U, uAlpha: { value: 0.8 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false });
const handMat = new THREE.ShaderMaterial({ uniforms: { ...U, uFogN: { value: 1e5 }, uFogF: { value: 1e5 + 1 } }, vertexShader: VS, fragmentShader: FS, depthTest: false });

function geo(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
  g.setAttribute('sh', new THREE.BufferAttribute(m.sh, 1)); g.setAttribute('li', new THREE.BufferAttribute(m.li, 1)); g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  g.computeBoundingSphere(); return g;
}

// ---------------------------------------------------------------- world + chunk meshes
const world = createWorld();
const chunks = [];   // [cz*NC+cx] = { o, w }
const dirty = new Set();
function buildChunk(cx, cz) {
  const k = cz * NC + cx, m = world.chunk(cx, cz), old = chunks[k];
  if (old) { for (const x of [old.o, old.w]) if (x) { scene.remove(x); x.geometry.dispose(); } }
  const c = {};
  if (m.o.n) { c.o = new THREE.Mesh(geo(m.o), solidMat); scene.add(c.o); }
  if (m.w.n) { c.w = new THREE.Mesh(geo(m.w), waterMat); c.w.renderOrder = 2; scene.add(c.w); }
  chunks[k] = c;
}
function buildAll() { dirty.clear(); for (let cz = 0; cz < NC; cz++) for (let cx = 0; cx < NC; cx++) buildChunk(cx, cz); }
function markDirty(x, z, r = 1) {
  for (let dz = -r; dz <= r; dz += r || 1) for (let dx = -r; dx <= r; dx += r || 1) {
    const cx = Math.floor((x + dx) / CS), cz = Math.floor((z + dz) / CS);
    if (cx >= 0 && cz >= 0 && cx < NC && cz < NC) dirty.add(cz * NC + cx);
  }
}

// ---------------------------------------------------------------- sky: gradient dome, square sun + moon, stars, clouds, open ocean
const skyU = { top: { value: new THREE.Vector3() }, hor: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, glow: { value: new THREE.Vector3(1, 0.8, 0.5) } };
const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vW; void main(){ vW=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 glow; varying vec3 vW;
  void main(){ vec3 d=normalize(vW); float h=max(d.y,0.0); vec3 c=mix(hor,top,pow(h,0.5)); float s=max(dot(d,sunDir),0.0); c+=glow*pow(s,6.0)*0.35; gl_FragColor=vec4(c,1.0); }` }));
dome.frustumCulled = false; dome.renderOrder = -10; scene.add(dome);
const sunM = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ color: '#fff3a8', depthWrite: false, transparent: true }));
const moonM = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: '#eef2ff', depthWrite: false, transparent: true }));
sunM.renderOrder = moonM.renderOrder = -9; scene.add(sunM, moonM);
const starG = new THREE.BufferGeometry(); { const r = rng(5), a = []; for (let i = 0; i < 380; i++) { const u = r() * 2 - 1, t = r() * 6.283, y = Math.abs(u) * 0.95 + 0.05, q = Math.sqrt(1 - y * y); a.push(Math.cos(t) * q * 380, y * 380, Math.sin(t) * q * 380); } starG.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); }
const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
stars.frustumCulled = false; stars.renderOrder = -9; scene.add(stars);
const NCL = 34, clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.88, depthWrite: false }), NCL);
clouds.frustumCulled = false; scene.add(clouds);
const cloudD = []; { const r = rng(17); for (let i = 0; i < NCL; i++) cloudD.push({ x: r() * 360 - 120, z: r() * 360 - 120, y: 58 + r() * 6, sx: 8 + r() * 16, sz: 6 + r() * 12 }); }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const oceanMat = new THREE.ShaderMaterial({ uniforms: { uDay: U.uDay, uFog: U.uFog, uFogN: U.uFogN, uFogF: U.uFogF },
  vertexShader: `varying float vD; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vD=length(mv.xyz); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uDay; uniform vec3 uFog; uniform float uFogN; uniform float uFogF; varying float vD; void main(){ vec3 c=vec3(0.25,0.56,0.94)*uDay; gl_FragColor=vec4(mix(c,uFog,smoothstep(uFogN,uFogF,vD)),1.0); }` });
for (const [x, z, w, d] of [[-300, -300, 600 + W, 300], [-300, W, 600 + W, 300], [-300, 0, 300, W], [W, 0, 300, W]]) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), oceanMat); o.rotation.x = -Math.PI / 2; o.position.set(x + w / 2, SEA + 0.88, z + d / 2); scene.add(o);
}

// ---------------------------------------------------------------- held block + target outline
let hand = null, handId = -1, swing = 0;
function setHand(id) {
  if (id === handId) return; handId = id; if (hand) { camera.remove(hand); hand.geometry.dispose(); hand = null; }
  if (id == null) return;
  hand = new THREE.Mesh(geo(blockMesh(id)), handMat); hand.renderOrder = 50; hand.frustumCulled = false; hand.scale.setScalar(0.2); camera.add(hand);
}
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), new THREE.LineBasicMaterial({ color: '#111', transparent: true, opacity: 0.6 }));
outline.visible = false; scene.add(outline);

// ---------------------------------------------------------------- DOM
const mk = (cls, html = '', parent = document.body) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d; };
const stopAll = el => ['pointerdown', 'pointerup', 'touchstart', 'mousedown'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
const cross = mk('cb-cross cb-hidden'), ring = mk('cb-ring', '<svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="19" stroke-dasharray="119.4" stroke-dashoffset="119.4" transform="rotate(-90 23 23)"/></svg>');
const ringC = ring.querySelector('circle');
const goalsEl = mk('cb-goals cb-hidden'), timeEl = mk('cb-time cb-hidden'), hurtEl = mk('cb-flashred');
const exitBtn = document.createElement('button'); exitBtn.className = 'cb-exit cb-hidden'; exitBtn.textContent = '☰ Menu'; document.body.appendChild(exitBtn); stopAll(exitBtn);
const hot = mk('cb-hot cb-hidden'), craftEl = mk('cb-craft cb-hidden'); stopAll(hot); stopAll(craftEl);
const keysEl = mk('cb-keys cb-hidden', 'WASD move · mouse look · click mine · right-click place · C craft · 1-9');
const joy = mk('cb-joy cb-hidden', '<i></i>');
const btn = (cls, html, label) => { const b = mk('cb-btn cb-hidden ' + cls, html + `<small>${label}</small>`); return b; };
const mineBtn = btn('cb-mine', '⛏️', 'HOLD TO DIG'), placeBtn = btn('cb-place', '<img alt="">', 'PLACE'), jumpBtn = btn('cb-jump', '⤒', 'JUMP');
const touchEls = [mineBtn, placeBtn, jumpBtn, joy];

// start card: today's goals + mode switch
const startCard = ui.els.start;
const sg = mk('cb-sg'); startCard.querySelector('.hint').before(sg);
const modeBtn = document.createElement('button'); modeBtn.className = 'cb-modebtn'; sg.after(modeBtn);
modeBtn.addEventListener('pointerdown', e => e.stopPropagation());
modeBtn.addEventListener('click', e => { e.stopPropagation(); mode = mode === 'challenge' ? 'sandbox' : 'challenge'; S.set('mode', mode); paintStart(); tone(620, 0.06, 'triangle', 0.1, 1.3); });
const winCard = ui.els.win; winCard.querySelector('p').innerHTML = 'TODAY’S SCORE <span data-l></span>'; winCard.querySelector('.hint').textContent = 'Tap to build again';
ui.els.lose.querySelector('.hint').textContent = 'Tap to try again';

// ---------------------------------------------------------------- game state
let mode = S.get('mode', 'challenge'), state = 'ready', best = S.get('best', 0), wins = S.get('wins', 0);
let inv = {}, sel = PLANKS, goals = [], score = 0, runT = 0, limit = 300, recorded = false, beatenShown = false, worldKey = '';
let placed = new Map(), placedCount = {}, towerMax = 0, logsCut = 0, crystalsDug = 0, peakReached = 0, phase = 0.3;
let sbSeed = S.get('sbseed', 0); if (!sbSeed) { sbSeed = (Math.random() * 1e6 | 0) + 11; S.set('sbseed', sbSeed); }
let sbEdits = new Map(); try { for (const [i, id] of S.get('sbedits', [])) sbEdits.set(i, id); } catch (e) {}
const P = { x: W / 2, y: 30, z: W / 2, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.2, ground: false, water: false, walk: 0 };
const PW = 0.3, PH = 1.75, EYE = 1.6, SPEED = 4.4, JUMPV = 8.6, GRAV = 28, REACH = 6;

const RECIPES = [
  { in: [[LOG, 1]], out: [PLANKS, 4] },
  { in: [[SAND, 2]], out: [GLASS, 2] },
  { in: [[COBBLE, 2]], out: [BRICK, 2] },
  { in: [[CRYSTAL, 1], [PLANKS, 1]], out: [LAMP, 2] },
  { in: [[DIRT, 1], [SAND, 1]], out: [CLAY, 2] },
  { in: [[CLAY, 1], [SNOW, 1]], out: [SKY, 2] },
  { in: [[CLAY, 1], [SAND, 1]], out: [SUNT, 2] },
];

function loadWorld(key) {
  if (worldKey === key) return;
  if (key === 'sandbox') { world.gen(sbSeed); for (const [i, id] of sbEdits) { const x = i % W, z = Math.floor(i / W) % W, y = Math.floor(i / (W * W)); world.set(x, y, z, id); } }
  else world.gen(DAYSEED);
  worldKey = key; buildAll();
}

// ---------------------------------------------------------------- goals (seeded by today's date: the same island and goals for everyone)
function makeGoals() {
  const r = rng(DAYSEED * 7 + 3), k = F.k(), pick = a => a[Math.floor(r() * a.length)];
  const g = [];
  const add = (type) => {
    if (type === 'tower') { const n = Math.round((8 + r() * 4) * k); g.push({ type, n, pts: 150, text: `Build a tower ${n} blocks tall`, prog: () => towerMax }); }
    if (type === 'logs') { const n = Math.round((6 + r() * 4) * k); g.push({ type, n, pts: 110, text: `Chop ${n} logs from trees`, prog: () => logsCut }); }
    if (type === 'summit') { const n = world.peak.h + 1; g.push({ type, n, pts: 120, text: `Reach height ${n} (peak)`, prog: () => peakReached }); }
    if (type === 'place') { const kind = pick([PLANKS, GLASS, BRICK, CLAY]), n = Math.round((10 + r() * 8) * k); g.push({ type, kind, n, pts: 130, text: `Place ${n} ${BLOCKS[kind].name.toLowerCase()} blocks`, prog: () => placedCount[kind] || 0 }); }
    if (type === 'variety') { const n = 5 + (r() < 0.5 ? 1 : 0); g.push({ type, n, pts: 120, text: `Build with ${n} kinds of block`, prog: () => kinds() }); }
    if (type === 'lamps') { const n = Math.round((3 + r() * 2) * k); g.push({ type, n, pts: 160, text: `Light up ${n} lamps`, prog: () => placedCount[LAMP] || 0 }); }
    if (type === 'crystal') { const n = Math.round((2 + r() * 2) * k); g.push({ type, n, pts: 160, text: `Dig up ${n} cave crystals`, prog: () => crystalsDug }); }
  };
  add(pick(['tower', 'tower', 'logs', 'summit'])); add(pick(['place', 'variety'])); add(pick(['lamps', 'crystal']));
  for (const x of g) x.done = false;
  return g;
}
const kinds = () => Object.values(placedCount).filter(v => v > 0).length;
const placedTotal = () => Object.values(placedCount).reduce((a, b) => a + b, 0);
function paintStart() {
  if (mode === 'challenge') {
    if (worldKey !== 'day') loadWorld('day');
    const g = makeGoals();
    sg.innerHTML = `<h4>TODAY’S ISLAND · BUILD GOALS</h4>` + g.map(x => `<div>◻️ ${x.text}</div>`).join('') + `<div style="opacity:.8;font-size:14px;margin-top:6px">Before nightfall · ${best ? 'best today ★ ' + best : 'same island for everyone today'}</div>`;
    modeBtn.innerHTML = 'Mode: <b>Daily build</b> · switch to Sandbox';
  } else {
    sg.innerHTML = `<h4>FREE SANDBOX</h4><div>Your own island. Every block is free, nothing is timed, and your builds are saved on this device.</div>`;
    modeBtn.innerHTML = 'Mode: <b>Sandbox</b> · switch to Daily build';
  }
}

// ---------------------------------------------------------------- run lifecycle
function startRun() {
  if (mode === 'challenge') { worldKey = ''; loadWorld('day'); } else loadWorld('sandbox');
  lastSent = 0; lastSentT = 0; placed = new Map(); placedCount = {}; towerMax = 0; logsCut = 0; crystalsDug = 0; peakReached = 0; score = 0; runT = 0; recorded = false; beatenShown = false;
  goals = mode === 'challenge' ? makeGoals() : [];
  limit = Math.round(300 / F.k());
  inv = mode === 'challenge' ? { [DIRT]: 8, [PLANKS]: 4, [LOG]: 1 } : {};
  sel = PLANKS; phase = 0.3;
  const sp = mode === 'sandbox' && S.get('sbpos', null) ? S.get('sbpos') : world.spawn;
  Object.assign(P, { x: sp[0], y: sp[1], z: sp[2], vx: 0, vy: 0, vz: 0, yaw: sp[3] || Math.PI * 0.25, pitch: -0.25 });
  while (collides(P.x, P.y, P.z) && P.y < H) P.y += 1;
  if (!sp[3]) { let bestL = -1; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, d = new THREE.Vector3(-Math.sin(a), -0.08, -Math.cos(a)).normalize(), h = ray(P.x, eyeY(), P.z, d, 40), L = h ? h.t : 40; if (L > bestL) { bestL = L; P.yaw = a; } } }
  state = 'play'; B.start(); hudShow(true); paintHot(true); paintGoals(true);
  ui.pop(mode === 'challenge' ? 'BUILD BEFORE NIGHT!' : 'SANDBOX', '#fff', 30, 30);
  [60, 64, 67, 72].forEach((n, i) => setTimeout(() => note(n, 0.3, 0.1), i * 80));
}
function hudShow(on) {
  const c = mode === 'challenge';
  cross.classList.toggle('cb-hidden', !on); hot.classList.toggle('cb-hidden', !on);
  goalsEl.classList.toggle('cb-hidden', !on || !c); timeEl.classList.toggle('cb-hidden', !on || !c); exitBtn.classList.toggle('cb-hidden', !on || c);
  craftEl.classList.toggle('cb-hidden', !on || !c);
  for (const e of touchEls) e.classList.toggle('cb-hidden', !on || !TOUCH);
  keysEl.classList.toggle('cb-hidden', !on || TOUCH);
  outline.visible = false; if (!on) { ring.style.opacity = 0; setHand(null); }
}
function finish(allDone) {
  if (state !== 'play') return;
  const n = goals.filter(g => g.done).length, won = n > 0;
  if (allDone) score += Math.max(0, Math.floor(limit - runT));
  state = won ? 'won' : 'lost'; hudShow(false); stickEnd(); mineHeld = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (!recorded) { recorded = true; F.level(won, n / 3); if (score > 0) B.submit(score, { ms: runT * 1000 }); }
  if (score > best) { best = score; S.set('best', best); }
  if (won) {
    wins++; S.set('wins', wins);
    winCard.querySelector('h1').textContent = allDone ? 'ALL BUILT!' : 'NIGHTFALL!';
    D.won(score, 'scored'); ui.win(score, `${n}/3 goals${allDone ? ' · time bonus +' + Math.max(0, Math.floor(limit - (runT))) : ''} · best ${best}`);
    confetti(scene, new THREE.Vector3(P.x - Math.sin(P.yaw) * 3, P.y + 2, P.z - Math.cos(P.yaw) * 3), 90); ui.flash(0.5); buzz([20, 40, 20]);
    [0, 4, 7, 12, 16].forEach((s, k) => setTimeout(() => note(67 + s, 0.4, 0.15), k * 90));
  } else {
    ui.lose('NIGHTFALL', 'No goals finished. Try a tower first!');
    tone(220, 0.3, 'square', 0.1, 0.5); setTimeout(() => tone(150, 0.4, 'square', 0.1, 0.5), 150);
  }
}
function exitSandbox() { if (state !== 'play') return; saveSandbox(); state = 'ready'; hudShow(false); stickEnd(); paintStart(); ui.start(); }
exitBtn.addEventListener('click', e => { e.stopPropagation(); exitSandbox(); });
let sbSaveT = 0;
function saveSandbox() { try { S.set('sbedits', [...sbEdits]); S.set('sbpos', [P.x, P.y + 0.1, P.z, P.yaw]); } catch (e) {} }
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && mode === 'sandbox' && state === 'play') saveSandbox(); });

ui.onTap(w => { startRun(); });

// ---------------------------------------------------------------- scoring + goals
function checkGoals() {
  if (mode !== 'challenge' || state !== 'play') return;
  let pts = 0;
  for (const g of goals) {
    if (!g.done && g.prog() >= g.n) {
      g.done = true; ui.pop('GOAL! +' + g.pts, '#ffd84d', 38, 28); ui.flash(0.35); buzz([15, 30, 15]);
      [0, 4, 7, 12].forEach((s, k) => setTimeout(() => note(72 + s, 0.3, 0.13), k * 70));
      confetti(scene, new THREE.Vector3(P.x - Math.sin(P.yaw) * 2.5, P.y + 1.8, P.z - Math.cos(P.yaw) * 2.5), 50);
    }
    if (g.done) pts += g.pts;
  }
  const s = pts + Math.min(150, placedTotal()) + 10 * Math.min(12, kinds());
  if (s > score) score = s;
  if (score > lastSent && (goals.some(g => g.done && !g.sent) || runT - lastSentT > 10)) { for (const g of goals) if (g.done) g.sent = true; lastSent = score; lastSentT = runT; B.submit(score, { ms: runT * 1000 }); }   // banks the run so far; the board keeps today's best
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 42, 34); confetti(scene, new THREE.Vector3(P.x, P.y + 2, P.z), 50); }
  paintGoals();
  if (goals.every(g => g.done)) finish(true);
}
let goalsKey = '', lastSent = 0, lastSentT = 0;
function paintGoals(force) {
  const key = score + '|' + goals.map(g => Math.min(g.n, g.prog()) + (g.done ? 'd' : '')).join(',');
  if (key === goalsKey && !force) return; goalsKey = key;
  goalsEl.innerHTML = `<h3><span>TODAY’S BUILD</span><b>★ ${score}</b></h3>` + goals.map(g => `<div class="cb-g ${g.done ? 'done' : ''}"><i>${g.done ? '✓' : ''}</i><span>${g.text}</span><em>${Math.min(g.n, g.prog())}/${g.n}</em></div>`).join('');
}

// ---------------------------------------------------------------- inventory, hotbar, crafting
const have = id => mode === 'sandbox' || (inv[id] || 0) > 0;
function give(id, n = 1) { if (mode === 'sandbox') return; inv[id] = (inv[id] || 0) + n; paintHot(); }
let hotKey = '';
function hotList() { return mode === 'sandbox' ? PLACEABLE : PLACEABLE.filter(id => inv[id] > 0); }
function paintHot(force) {
  const list = hotList();
  if (!list.includes(sel) && list.length) sel = list[0];
  const key = mode + sel + list.map(id => id + ':' + (inv[id] || 0)).join(',');
  if (key !== hotKey || force) {
    hotKey = key;
    hot.innerHTML = list.length ? list.map(id => `<div class="cb-slot ${id === sel ? 'on' : ''}" data-id="${id}"><img src="${icon(atlas, id)}" alt=""><b>${mode === 'sandbox' ? '' : inv[id]}</b></div>`).join('') : '<div style="padding:8px 12px;font-weight:700;font-size:14px">Dig blocks to fill your bag ⛏️</div>';
    hot.querySelectorAll('.cb-slot').forEach(s => s.addEventListener('click', () => { sel = +s.dataset.id; tone(700, 0.04, 'triangle', 0.08, 1.2); paintHot(); }));
    placeBtn.querySelector('img').src = list.length ? icon(atlas, sel) : '';
    const on = hot.querySelector('.cb-slot.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  setHand(list.length && state === "play" && !TOUCH ? sel : null);
  paintCraft();
}
const canCraft = r => r.in.every(([id, n]) => (inv[id] || 0) >= n);
let craftKey = '';
function paintCraft() {
  if (mode !== 'challenge') { craftEl.innerHTML = ''; craftKey = ''; return; }
  const list = RECIPES.filter(canCraft).slice(0, 3), key = list.map(r => r.out[0]).join(',');
  if (key === craftKey) return; craftKey = key;
  craftEl.innerHTML = list.map(r => `<div class="cb-chip" data-o="${r.out[0]}">${r.in.map(([id, n]) => `<img src="${icon(atlas, id)}">${n > 1 ? n : ''}`).join('+')}<u>→</u><img src="${icon(atlas, r.out[0])}">${r.out[1]}</div>`).join('');
  craftEl.querySelectorAll('.cb-chip').forEach(c => c.addEventListener('click', () => { const r = RECIPES.find(x => x.out[0] === +c.dataset.o); if (r) craft(r); }));
}
function craft(r) {
  if (mode !== 'challenge' || !canCraft(r)) return false;
  for (const [id, n] of r.in) inv[id] -= n;
  inv[r.out[0]] = (inv[r.out[0]] || 0) + r.out[1]; sel = r.out[0];
  ui.pop(`+${r.out[1]} ${BLOCKS[r.out[0]].name}`, '#fff', 26, 70); [0, 5, 9].forEach((s, k) => setTimeout(() => note(76 + s, 0.18, 0.1), k * 50)); buzz(12);
  paintHot(); return true;
}

// ---------------------------------------------------------------- physics
const solid = (x, y, z) => BLOCKS[world.get(x, y, z)].solid;
function collides(x, y, z) {
  const e = 1e-4;
  for (let by = Math.floor(y); by <= Math.floor(y + PH - e); by++) for (let bz = Math.floor(z - PW); bz <= Math.floor(z + PW - e); bz++) for (let bx = Math.floor(x - PW); bx <= Math.floor(x + PW - e); bx++) if (solid(bx, by, bz)) return true;
  return false;
}
function physics(dt, mx, mz, jump) {
  const s = dt / 60;
  P.water = world.get(Math.floor(P.x), Math.floor(P.y + 0.5), Math.floor(P.z)) === WATER;
  const sp = SPEED * (P.water ? 0.6 : 1);
  const tx = mx * sp, tz = mz * sp, acc = P.ground ? 0.35 : 0.12;
  P.vx += (tx - P.vx) * Math.min(1, acc * dt); P.vz += (tz - P.vz) * Math.min(1, acc * dt);
  if (P.water) { P.vy -= GRAV * 0.3 * s; P.vy = Math.max(P.vy, -3); if (jump) P.vy = 3.4; }
  else { P.vy -= GRAV * s; P.vy = Math.max(P.vy, -30); if (jump && P.ground) { P.vy = JUMPV; P.ground = false; jumpBase = Math.round(P.y); } }
  const steps = Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy), Math.abs(P.vz)) * s / 0.35) || 1;
  let hitH = false; P.ground = false;
  for (let i = 0; i < steps; i++) {
    const dx = P.vx * s / steps, dy = P.vy * s / steps, dz = P.vz * s / steps;
    if (!collides(P.x + dx, P.y, P.z)) P.x += dx; else { hitH = true; P.vx = 0; }
    if (!collides(P.x, P.y, P.z + dz)) P.z += dz; else { hitH = true; P.vz = 0; }
    if (!collides(P.x, P.y + dy, P.z)) P.y += dy;
    else { if (dy < 0) { P.y = Math.floor(P.y + dy) + 1; P.ground = true; } else P.y = Math.floor(P.y + dy + PH) - PH - 1e-3; P.vy = 0; }
  }
  if (!P.ground && P.vy <= 0 && collides(P.x, P.y - 0.02, P.z)) P.ground = true;
  // auto-jump up one-block steps while walking into them
  if (hitH && P.ground && (mx || mz)) { const l = Math.hypot(mx, mz) || 1, ax = P.x + mx / l * 0.45, az = P.z + mz / l * 0.45; if (collides(ax, P.y + 0.05, az) && !collides(ax, P.y + 1.05, az) && !collides(P.x, P.y + 1.05, P.z)) { P.vy = JUMPV * 0.92; P.ground = false; } }
  P.x = clamp(P.x, 0.4, W - 0.4); P.z = clamp(P.z, 0.4, W - 0.4);
  if (P.y < -4) { P.y = world.spawn[1] + 2; P.x = world.spawn[0]; P.z = world.spawn[2]; }
  if (P.ground && mode === 'challenge') peakReached = Math.max(peakReached, Math.round(P.y));
}
let jumpBase = 0;

// ---------------------------------------------------------------- aiming: voxel ray march
const dirV = new THREE.Vector3();
function aimDir() { const cp = Math.cos(P.pitch); return dirV.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp); }
function ray(ox, oy, oz, d, max = REACH) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
  let tx = d.x ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity, ty = d.y ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity, tz = d.z ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  while (t <= max) {
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
    else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    if (t > max) break;
    const id = world.get(x, y, z);
    if (id !== AIR && id !== WATER) { if (y < 0 || !world.inside(x, y, z)) return null; return { x, y, z, nx, ny, nz, id, t }; }
  }
  return null;
}
const eyeY = () => P.y + EYE;
let aim = null;
function updAim() { aim = state === 'play' ? ray(P.x, eyeY(), P.z, aimDir()) : null; }

// ---------------------------------------------------------------- dig + place
let mineHeld = false, mineKey = '', mineT = 0, chipT = 0;
function placeBlock() {
  updAim(); const h = aim; if (!h || state !== 'play') return false;
  const x = h.x + h.nx, y = h.y + h.ny, z = h.z + h.nz, id = sel;
  if (!world.inside(x, y, z) || y >= H - 1) return false;
  const cur = world.get(x, y, z); if (cur !== AIR && cur !== WATER) return false;
  if (!hotList().length || !have(id)) { ui.pop('Dig or craft blocks first', '#fff', 22, 62); return false; }
  if (BLOCKS[id].solid && x + 1 > P.x - PW && x < P.x + PW && z + 1 > P.z - PW && z < P.z + PW && y + 1 > P.y && y < P.y + PH) return false;
  world.set(x, y, z, id);
  const i = world.I(x, y, z);
  if (mode === 'challenge') {
    inv[id]--; placed.set(i, id); placedCount[id] = (placedCount[id] || 0) + 1;
    let run = 1; for (let yy = y - 1; yy >= 0 && placed.has(world.I(x, yy, z)); yy--) run++; for (let yy = y + 1; yy < H && placed.has(world.I(x, yy, z)); yy++) run++;
    if (run > towerMax) { towerMax = run; if (run >= 4 && run % 2 === 0) ui.pop(`TOWER ${run}`, '#fff', 26, 40); }
  } else sbEdits.set(i, id);
  markDirty(x, z, id === LAMP ? 8 : 1);
  swing = 1; tone(300 + (BLOCKS[id].hard || 0.3) * 200, 0.06, 'triangle', 0.13, 0.7); tone(180, 0.05, 'sine', 0.1, 0.8); buzz(8);
  burst(scene, new THREE.Vector3(x + 0.5, y + 0.1, z + 0.5), BLOCKS[id].col, 5, { speed: 0.05, up: 0.03, size: 0.5, gravity: 0.004 });
  paintHot(); checkGoals(); return true;
}
function breakBlock(h) {
  const { x, y, z, id } = h, Bk = BLOCKS[id]; if (Bk.hard === Infinity) return;
  world.set(x, y, z, AIR);
  if (y <= SEA && [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([a, b, c]) => world.get(x + a, y + b, z + c) === WATER)) world.set(x, y, z, WATER);
  const i = world.I(x, y, z);
  if (mode === 'challenge') {
    const was = placed.get(i);
    if (was != null) { placed.delete(i); placedCount[was]--; give(was, 1); }
    else { give(Bk.drop, 1); if (id === LOG) logsCut++; if (id === CRYSTAL) { crystalsDug++; ui.pop('CRYSTAL! 💎', '#9ff6ff', 30, 40); [0, 7, 12].forEach((s, k) => setTimeout(() => note(84 + s, 0.25, 0.1), k * 60)); } }
  } else { sbEdits.set(i, world.get(x, y, z)); }
  markDirty(x, z, id === LAMP ? 8 : 1);
  burst(scene, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), [Bk.col, Bk.col, '#ffffff'], 12, { speed: 0.07, up: 0.07, size: 0.7, gravity: 0.008 });
  tone(140 + Math.random() * 60, 0.09, 'square', 0.08, 0.5); tone(90, 0.12, 'sine', 0.15, 0.6); buzz(14); swing = 1;
  checkGoals();
}
function mining(dt, on) {
  if (!on || !aim) { mineT = 0; mineKey = ''; ring.style.opacity = 0; return; }
  const key = aim.x + ',' + aim.y + ',' + aim.z;
  if (key !== mineKey) { mineKey = key; mineT = 0; }
  const hard = BLOCKS[aim.id].hard;
  if (hard === Infinity) { ring.style.opacity = 0; return; }
  mineT += dt / 60; swing = Math.max(swing, 0.6);
  ring.style.opacity = 1; ringC.style.strokeDashoffset = 119.4 * (1 - Math.min(1, mineT / hard));
  chipT -= dt / 60; if (chipT <= 0) { chipT = 0.12; tone(220 + Math.random() * 80, 0.03, 'square', 0.04, 0.6); burst(scene, new THREE.Vector3(aim.x + 0.5 + aim.nx * 0.52, aim.y + 0.5 + aim.ny * 0.52, aim.z + 0.5 + aim.nz * 0.52), BLOCKS[aim.id].col, 2, { speed: 0.04, up: 0.04, size: 0.4, gravity: 0.008 }); }
  if (mineT >= hard) { const h = aim; mineT = 0; mineKey = ''; breakBlock(h); updAim(); }
}

// ---------------------------------------------------------------- input: joystick (left), look drag (right), buttons, keyboard + mouse
const keys = {}, ptrs = new Map(); let stick = null, jumpHeld = false;
function stickEnd() { stick = null; joy.style.left = '84px'; joy.style.top = (innerHeight - 200) + 'px'; joy.firstChild.style.transform = ''; }
stickEnd(); addEventListener('resize', () => { if (!stick) stickEnd(); });
addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  if (document.pointerLockElement) { if (e.button === 0) mineHeld = true; else if (e.button === 2) placeBlock(); return; }
  if (e.pointerType === 'mouse') { try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} ptrs.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY }); return; }
  if (!stick && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.42) {
    stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 }; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px';
  } else ptrs.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
});
addEventListener('pointermove', e => {
  if (document.pointerLockElement) { P.yaw -= e.movementX * 0.0026; P.pitch = clamp(P.pitch - e.movementY * 0.0026, -1.55, 1.55); return; }
  if (stick && e.pointerId === stick.id) {
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), mx = 50;
    if (l > mx) { dx = dx / l * mx; dy = dy / l * mx; }
    stick.x = dx / mx; stick.y = dy / mx; joy.firstChild.style.transform = `translate(${dx}px,${dy}px)`; return;
  }
  const p = ptrs.get(e.pointerId); if (!p) return;
  const sens = e.pointerType === 'mouse' ? 0.005 : 0.0062;
  P.yaw -= (e.clientX - p.x) * sens; P.pitch = clamp(P.pitch - (e.clientY - p.y) * sens, -1.55, 1.55); p.x = e.clientX; p.y = e.clientY;
});
const up = e => { if (stick && e.pointerId === stick.id) stickEnd(); ptrs.delete(e.pointerId); if (document.pointerLockElement && e.button === 0) mineHeld = false; };
addEventListener('pointerup', up); addEventListener('pointercancel', up);
addEventListener('contextmenu', e => e.preventDefault());
const hold = (el, on, off) => { el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} el.classList.add('on'); on(); });
  const o = e => { el.classList.remove('on'); off && off(); }; el.addEventListener('pointerup', o); el.addEventListener('pointercancel', o); el.addEventListener('lostpointercapture', o); };
hold(mineBtn, () => { mineHeld = true; }, () => { mineHeld = false; });
hold(placeBtn, () => placeBlock());
hold(jumpBtn, () => { jumpHeld = true; }, () => { jumpHeld = false; });
addEventListener('keydown', e => {
  keys[e.code] = true; if (state !== 'play') return;
  if (/^Digit[1-9]$/.test(e.code)) { const l = hotList(), i = +e.code.slice(5) - 1; if (l[i] != null) { sel = l[i]; paintHot(); } }
  if (e.code === 'KeyC' || e.code === 'KeyE') { const r = RECIPES.find(canCraft); if (r) craft(r); }
  if (e.code === 'KeyF') placeBlock();
  if (e.code === 'Escape' && mode === 'sandbox') exitSandbox();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('wheel', e => { if (state !== 'play') return; const l = hotList(); if (!l.length) return; const i = (l.indexOf(sel) + (e.deltaY > 0 ? 1 : -1) + l.length) % l.length; sel = l[i]; paintHot(); }, { passive: true });

// ---------------------------------------------------------------- day / night
const V = (r, g, b) => new THREE.Vector3(r, g, b);
const DAY_TOP = V(0.3, 0.6, 0.98), DAY_HOR = V(0.76, 0.89, 1), NIGHT_TOP = V(0.03, 0.04, 0.13), NIGHT_HOR = V(0.1, 0.13, 0.27), DUSK = V(1, 0.62, 0.42);
const sunDir = new THREE.Vector3();
let dayLevel = 1;
function sky(p) {
  const a = (p - 0.25) * Math.PI * 2, el = Math.sin(a);
  sunDir.set(Math.cos(a), el, 0.3).normalize();
  const d = clamp((el + 0.12) / 0.4, 0, 1), dd = d * d * (3 - 2 * d), dusk = clamp(1 - Math.abs(el) / 0.3, 0, 1);
  dayLevel = dd;
  skyU.top.value.lerpVectors(NIGHT_TOP, DAY_TOP, dd); skyU.hor.value.lerpVectors(NIGHT_HOR, DAY_HOR, dd).lerp(DUSK, dusk * 0.55);
  skyU.sunDir.value.copy(sunDir); skyU.glow.value.set(1, 0.75, 0.45).multiplyScalar(0.4 + dusk);
  U.uFog.value.copy(skyU.hor.value);
  U.uDay.value.set(0.2, 0.24, 0.42).lerp(V(1, 1, 1), dd).lerp(V(1, 0.8, 0.65), dusk * 0.25 * dd);
  stars.material.opacity = clamp(1 - dd * 1.4, 0, 1);
  clouds.material.color.setRGB(0.25 + 0.75 * dd, 0.27 + 0.73 * dd, 0.38 + 0.62 * dd);
}

// ---------------------------------------------------------------- music: soft pentatonic loop composed in code
const PENT = [60, 62, 64, 67, 69, 72, 74, 76], CHORDS = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
let musT = 0, musStep = 0, musR = rng(99);
function music(dt) {
  if (state !== 'play' || document.hidden) return;
  musT += dt / 60; const beat = dayLevel > 0.3 ? 0.5 : 0.7;
  if (musT < beat) return; musT = 0; musStep++;
  if (musStep % 8 === 0) for (const n of CHORDS[(musStep / 8 | 0) % 4]) note(n, 3.2, 0.028);
  if (musR() < (musStep % 2 ? 0.35 : 0.6)) note(PENT[Math.floor(musR() * PENT.length)] + (dayLevel < 0.3 ? -12 : 0), 0.6, 0.04);
}

// ---------------------------------------------------------------- bot (checker): plays by the rules through the same dig / place / craft calls
const bot = { t: 0, task: '', yaw: null, pitch: null, move: 0, mine: false, jump: false, pillar: false, tgt: null, tgtT: 0, last: null, still: 0, wander: 0, avoid: [], pY: 0, pN: 0, cp: 0, wy: null, bn: 0, bt: 0, cy: 0, cn: 0 };
function nearest(ids, R = 28) {
  const px = Math.floor(P.x), py = Math.floor(P.y + 1), pz = Math.floor(P.z); let bestD = 1e9, best = null;
  for (let z = Math.max(0, pz - R); z < Math.min(W, pz + R); z++) for (let x = Math.max(0, px - R); x < Math.min(W, px + R); x++) for (let y = 1; y < H - 1; y++) {
    const id = world.vox[world.I(x, y, z)]; if (!ids.includes(id)) continue; const i = world.I(x, y, z);
    if (placed.has(i) || bot.avoid.includes(i)) continue;
    const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => { const n = world.get(x + a, y + b, z + c); return n === AIR || n === WATER; });
    const d = Math.hypot(x - px, z - pz) + Math.abs(y - py) * 1.6 + (open ? 0 : 5) + (y > py + 3 ? 6 : 0);
    if (d < bestD) { bestD = d; best = [x, y, z, i]; }
  }
  return best;
}
function botNeed() {
  const placeables = PLACEABLE.filter(id => inv[id] > 0 && id !== CRYSTAL);
  const anyBlock = placeables.find(id => id !== LAMP) ?? null;
  const order = [...goals].sort((a, b) => (b.type === 'place' || b.type === 'variety') - (a.type === 'place' || a.type === 'variety'));
  for (const g of order) {
    if (g.done) continue;
    if (g.type === 'tower') return anyBlock != null ? { pillar: anyBlock } : { dig: [GRASS, DIRT, SAND, SNOW] };
    if (g.type === 'place') {
      if (inv[g.kind] > 0) return { build: g.kind };
      if (g.kind === PLANKS) return { dig: [LOG] };
      if (g.kind === GLASS) return { dig: [SAND] };
      if (g.kind === BRICK) return { dig: [STONE, COBBLE] };
      if (g.kind === CLAY) return { dig: (inv[SAND] || 0) < 1 ? [SAND] : [GRASS, DIRT] };
    }
    if (g.type === 'variety') { const fresh = placeables.find(id => !(placedCount[id] > 0)); if (fresh != null) return { build: fresh }; return { dig: [SAND, STONE, LOG, SNOW].filter(id => !(placedCount[BLOCKS[id].drop] > 0)) }; }
    if (g.type === 'lamps') { if (inv[LAMP] > 0) return { build: LAMP }; if (!(inv[CRYSTAL] > 0)) return { dig: [CRYSTAL] }; return { dig: [LOG] }; }
    if (g.type === 'crystal') return { dig: [CRYSTAL] };
    if (g.type === 'logs') return { dig: [LOG] };
    if (g.type === 'summit') return { climb: true };
  }
  return { dig: [LOG] };
}
function botThink() {
  bot.t = performance.now(); if (state !== 'play' || mode !== 'challenge') return;
  for (const r of RECIPES) if (canCraft(r) && (r.out[0] !== SKY && r.out[0] !== SUNT || goals.some(g => g.type === 'variety' && !g.done))) { if (r.out[0] === CLAY && !goals.some(g => !g.done && (g.kind === CLAY || g.type === 'variety'))) continue; craft(r); break; }
  const need = botNeed();
  // stuck detection (horizontal progress while trying to walk)
  const moved = bot.last ? Math.hypot(P.x - bot.last[0], P.z - bot.last[1]) : 1; bot.last = [P.x, P.z];
  bot.still = bot.move > 0 && moved < 0.06 ? bot.still + 1 : 0;
  bot.mine = false; bot.jump = false; bot.pillar = false; bot.move = 0;
  if (bot.wander > 0) { bot.wander--; bot.move = 1; bot.pitch = -0.1; bot.jump = bot.still > 2; return; }
  if (need.build != null) {                            // build a little wall in front: stack blocks on the ground ~2 steps ahead
    sel = need.build; paintHot(); bot.task = 'build';
    if (bot.wy == null) bot.wy = P.yaw;
    const cx = Math.floor(P.x - Math.sin(bot.wy) * 2.3), cz = Math.floor(P.z - Math.cos(bot.wy) * 2.3), fy = Math.floor(P.y);
    let ty = fy + 3; while (ty > 0 && !solid(cx, ty, cz)) ty--;
    if (ty >= fy + 2 || ty < fy - 3 || !world.inside(cx, ty + 1, cz)) { bot.wy += 0.45; bot.yaw = bot.wy; bot.pitch = -0.3; if (++bot.bn > 20) { bot.bn = 0; bot.wander = 6; bot.wy = null; } return; }
    const dx = cx + 0.5 - P.x, dy = ty + 1.02 - eyeY(), dz = cz + 0.5 - P.z;
    bot.yaw = Math.atan2(-dx, -dz); bot.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    if (Math.abs(angDiff(P.yaw, bot.yaw)) < 0.06 && Math.abs(P.pitch - bot.pitch) < 0.06 && (bot.bt = (bot.bt || 0) + 1) % 2 === 0) { if (!placeBlock()) bot.wy += 0.45; else bot.bn = 0; }
    return;
  }
  bot.wy = null;
  if (need.pillar != null) {
    sel = need.pillar; paintHot();
    bot.pitch = -1.55; bot.pillar = true; bot.jump = true; bot.task = 'pillar';
    if (P.y > bot.pY + 0.5) { bot.pY = P.y; bot.pN = 0; } else if (++bot.pN > 30) { bot.pN = 0; bot.pY = P.y; bot.wander = 8; bot.yaw = P.yaw + 2.2; }
    if (collides(P.x, P.y + 1.2, P.z)) { bot.wander = 6; bot.yaw = P.yaw + 1.7; }
    return;
  }
  if (need.climb) {
    const dx = world.peak.x + 0.5 - P.x, dz = world.peak.z + 0.5 - P.z;
    bot.task = 'climb';
    if (bot.still > 4 && !bot.cp) { bot.cp = 14; bot.still = 0; if (P.y <= bot.cy + 0.5 && ++bot.cn > 2) { bot.cn = 0; bot.cp = 0; bot.wander = 12; bot.yaw = P.yaw + 1.5 + Math.random() * 2; return; } if (P.y > bot.cy + 0.5) { bot.cy = P.y; bot.cn = 0; } }
    if (bot.cp > 0 && collides(P.x, P.y + 1.3, P.z)) { bot.cp = 0; bot.wander = 8; bot.yaw = P.yaw + 2; return; }
    if (bot.cp > 0) {                                   // a wall too tall to hop: pillar up a few blocks, then walk on
      bot.cp--; const blk = PLACEABLE.find(id => inv[id] > 0 && id !== LAMP && id !== CRYSTAL);
      if (blk != null) { sel = blk; paintHot(); bot.pitch = -1.55; bot.pillar = true; bot.jump = true; bot.move = 0; return; }
      bot.cp = 0; bot.tgt = null; need.dig = [GRASS, DIRT, SAND, SNOW, SNOWG]; delete need.climb;
    } else { bot.yaw = Math.atan2(-dx, -dz); bot.pitch = -0.15; bot.move = Math.hypot(dx, dz) > 0.4 ? 1 : 0; bot.jump = bot.still > 1; return; }
  }
  // dig toward the nearest wanted block, mining anything in the way
  if (!bot.tgt || world.vox[bot.tgt[3]] === AIR || world.vox[bot.tgt[3]] === WATER || !need.dig.includes(world.vox[bot.tgt[3]]) || performance.now() - bot.tgtT > 14000) {
    if (bot.tgt && performance.now() - bot.tgtT > 14000) bot.avoid.push(bot.tgt[3]);
    bot.tgt = nearest(need.dig); bot.tgtT = performance.now();
  }
  if (!bot.tgt) { bot.wander = 10; bot.yaw = P.yaw + 1.2; return; }
  const [tx, ty, tz] = bot.tgt, ex = P.x, ey = eyeY(), ez = P.z;
  const dx = tx + 0.5 - ex, dy = ty + 0.5 - ey, dz = tz + 0.5 - ez, hd = Math.hypot(dx, dz);
  bot.yaw = Math.atan2(-dx, -dz); bot.pitch = clamp(Math.atan2(dy, hd), -1.5, 1.5); bot.task = 'dig';
  const h = ray(ex, ey, ez, aimDir());
  if (h && h.t < 4.5 && Math.abs(angDiff(P.yaw, bot.yaw)) < 0.25) { bot.mine = true; bot.move = 0; }
  else bot.move = hd > 1.2 ? 1 : 0;
  if (bot.still > 10) { bot.wander = 5; bot.yaw = P.yaw + 2; bot.still = 0; }
}
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const botOn = () => performance.now() - bot.t < 500 && state === 'play';

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first challenge, until the first
// real touch, the burrower walks, looks and digs toward its first goal for about 4.5 s (the bot's own brain), then hands back
const DM = demo(null, { ready: () => state === 'play' && mode === 'challenge' && wins === 0, wait: 1500, ms: 4500 });
let demoT = 0;
// ---------------------------------------------------------------- frame
let flyA = 0, cloudT = 0;
loadWorld(mode === 'challenge' ? 'day' : 'sandbox'); paintStart(); sky(0.32);
loop((dt, t) => {
  if (DM.on && t - demoT > 0.1) { demoT = t; botThink(); }
  cloudT += dt / 60;
  for (let i = 0; i < NCL; i++) { const c = cloudD[i]; const x = ((c.x + cloudT * 0.8 + 120) % 360) - 120; _m.compose(_p.set(x, c.y, c.z), _q, _s.set(c.sx, 2, c.sz)); clouds.setMatrixAt(i, _m); }
  clouds.instanceMatrix.needsUpdate = true;
  // rebuild a few dirty chunks per frame
  let n = 0; for (const k of dirty) { dirty.delete(k); buildChunk(k % NC, Math.floor(k / NC)); if (++n >= 3) break; }

  if (state !== 'play') {
    flyA += dt * 0.0016; U.uFogN.value = 70; U.uFogF.value = 170;
    camera.position.set(W / 2 + Math.cos(flyA) * 70, 44, W / 2 + Math.sin(flyA) * 70); camera.lookAt(W / 2, 16, W / 2);
    sky(state === 'ready' ? 0.34 : phase);
  } else {
    U.uFogN.value = 30; U.uFogF.value = 64;
    const dts = dt / 60;
    if (mode === 'challenge') {
      runT += dts; phase = 0.3 + 0.55 * Math.min(1, runT / limit);
      const left = Math.max(0, limit - runT), m = Math.floor(left / 60), s = Math.floor(left % 60);
      const txt = `${dayLevel > 0.5 ? '☀️' : dayLevel > 0.15 ? '🌇' : '🌙'} ${m}:${String(s).padStart(2, '0')}`;
      if (timeEl.textContent !== txt) { timeEl.textContent = txt; timeEl.classList.toggle('low', left < 30); }
      if (left <= 0) finish(false);
    } else { phase = (phase + dts / 480) % 1; sbSaveT += dts; if (sbSaveT > 15) { sbSaveT = 0; saveSandbox(); } }
    sky(phase);
    // controls
    const B_ = botOn();
    if (B_) { if (bot.yaw != null) P.yaw += angDiff(P.yaw, bot.yaw) * Math.min(1, 0.3 * dt); if (bot.pitch != null) P.pitch += (bot.pitch - P.pitch) * Math.min(1, 0.3 * dt); }
    let fx = 0, fz = 0;
    if (stick) { fx = stick.x; fz = stick.y; }
    if (keys.KeyW || keys.ArrowUp) fz -= 1; if (keys.KeyS || keys.ArrowDown) fz += 1; if (keys.KeyA || keys.ArrowLeft) fx -= 1; if (keys.KeyD || keys.ArrowRight) fx += 1;
    if (B_) fz = -bot.move;
    const fl = Math.hypot(fx, fz); if (fl > 1) { fx /= fl; fz /= fl; }
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const mx = fx * cy + fz * sy, mz = -fx * sy + fz * cy;
    physics(dt, mx, mz, jumpHeld || keys.Space || (B_ && bot.jump));
    // bot pillar: place under the feet at the top of the jump, through the normal place call
    if (B_ && bot.pillar && !P.ground && P.y >= jumpBase + 1.05) { updAim(); if (aim && aim.ny === 1) placeBlock(); }
    if (P.ground && Math.hypot(P.vx, P.vz) > 0.5) P.walk += dt * 0.16 * Math.hypot(P.vx, P.vz) / SPEED;
    const bob = Math.sin(P.walk * 2) * 0.05;
    camera.position.set(P.x, eyeY() + bob, P.z); camera.rotation.set(P.pitch, P.yaw, 0);
    updAim();
    mining(dt, mineHeld || (B_ && bot.mine));
    if (aim) { outline.visible = true; outline.position.set(aim.x + 0.5, aim.y + 0.5, aim.z + 0.5); const k = mineKey ? 1 + Math.sin(t * 40) * 0.01 : 1; outline.scale.setScalar(k); } else outline.visible = false;
    // held block sway + swing
    if (hand) { swing = Math.max(0, swing - dt * 0.08); const sw = Math.sin(swing * Math.PI); const hx = Math.tan(Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect)) * 0.8 * 0.62; hand.position.set(hx + Math.sin(P.walk) * 0.025, -0.48 + Math.abs(Math.cos(P.walk)) * 0.02 - sw * 0.12, -0.8 - sw * 0.1); hand.rotation.set(0.25 - sw * 0.7, 0.75, 0.05); }
    if (mode === 'challenge' && state === 'play') { if (goals.some(g => g.type === 'summit' && !g.done && peakReached >= g.n)) checkGoals(); }
    music(dt);
  }
  // sky follows camera
  dome.position.copy(camera.position); stars.position.copy(camera.position);
  sunM.position.copy(camera.position).addScaledVector(sunDir, 300); sunM.lookAt(camera.position);
  moonM.position.copy(camera.position).addScaledVector(sunDir, -300); moonM.lookAt(camera.position);
});

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return wins + 1; }, get score() { return score; },
  bot: botThink,
  _skip(sec) { runT += sec; },
  get debug() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, P: { x: P.x, y: P.y, z: P.z, g: P.ground }, task: bot.task, need: botNeed(), inv, goals: goals.map(g => [g.text, g.prog(), g.n]) }; },
};

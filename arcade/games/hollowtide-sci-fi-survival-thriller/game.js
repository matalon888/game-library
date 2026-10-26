// HOLLOWTIDE: Sci-Fi Survival Thriller — first-person stealth survival in a sunken, candy-bright research base.
// Sneak past Menders, hide from the Warden (it hunts by sound), throw cans to distract, fight back with a plasma cutter
// and EMP charges. 5 chapters + "Lights Out" survival with a daily seed. All models, textures, sound and music are code.
import { cine, THREE } from './kit/cine.js';
import { createUI, store, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { ShaderPass } from './kit/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { CHAPTERS, ENDING, survivalMap, buildLevel, materials, textures, blocked, los, path, tileOf, solidTile, T, HL, HH, hash, RAMP } from './world.js';
import { LightPool, Particles, dust, beam, Bolts, Decals, Debris, shock } from './fx.js';
import { Mender, Warden, separate } from './actors.js';
import { S as SND, A as AUD, unlock, spatial } from './audio.js';

const NAME = 'Hollowtide: Sci-Fi Survival Thriller';
const Q = new URLSearchParams(location.search);
const COARSE = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const LITE = COARSE && Math.min(screen.width, screen.height) < 500 && devicePixelRatio > 2.5;

// ------------------------------------------------------------------ renderer + cinematic stack (bright stylised grade)
const R = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
R.setSize(innerWidth, innerHeight); R.domElement.className = 'hc-canvas'; document.body.prepend(R.domElement);
const scene = new THREE.Scene();
const FOG = new THREE.Color(0x4fb8d6); scene.background = FOG.clone(); scene.fog = new THREE.Fog(FOG, 20, 70);
const cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .05, 120); cam.rotation.order = 'YXZ'; scene.add(cam);
const C = cine(R, scene, cam, { bloom: .45, bloomThreshold: 1.5, bloomRadius: .4, exposure: .9, envIntensity: .5, lite: LITE, grade: { tint: '#ffffff', sat: 1.18, contrast: 1.05, vignette: .14, grain: 0 } });
// screen-space ink outlines from depth (silhouettes + creases), like the stylized bar's inverted hulls but for everything
for (const rt of [C.composer.renderTarget1, C.composer.renderTarget2]) { rt.depthTexture = new THREE.DepthTexture(innerWidth, innerHeight); rt.depthTexture.type = THREE.UnsignedIntType; }
const edge = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uN: { value: .05 }, uF: { value: 120 }, uW: { value: 1.5 }, uCol: { value: new THREE.Color(0x0d0a1e) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uN, uF, uW; uniform vec3 uCol; varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x * 2. - 1.; return 2. * uN * uF / (uF + uN - z * (uF - uN)); }
    void main(){ vec2 px = uW / uRes; float c = lin(vUv);
      float l = lin(vUv - vec2(px.x, 0.)), r = lin(vUv + vec2(px.x, 0.)), u = lin(vUv + vec2(0., px.y)), d = lin(vUv - vec2(0., px.y));
      float lap = abs(l + r + u + d - 4. * c) / max(c, .1);
      float sil = max(max(abs(l - c), abs(r - c)), max(abs(u - c), abs(d - c))) / max(c, .1);
      float e = max(smoothstep(.035, .09, lap), smoothstep(.12, .3, sil)) * (1. - smoothstep(22., 40., c));
      vec4 col = texture2D(tDiffuse, vUv); gl_FragColor = vec4(mix(col.rgb, uCol, e * .9), col.a); }` });
{ const r0 = edge.render.bind(edge); edge.render = (rr, wb, rb, dt, m) => { edge.uniforms.tDepth.value = rb.depthTexture; r0(rr, wb, rb, dt, m); }; }
C.composer.insertPass(edge, 1);
function resize() {
  R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight;
  cam.fov = cam.aspect < .75 ? 84 : 72; cam.updateProjectionMatrix(); C.resize(innerWidth, innerHeight);
  edge.uniforms.uRes.value.set(innerWidth * R.getPixelRatio(), innerHeight * R.getPixelRatio()); edge.uniforms.uW.value = R.getPixelRatio() > 1.5 ? 1.6 : 1;
}
addEventListener('resize', resize); resize(); R.info.autoReset = false;

// lights: bright hemisphere + a dome "sun" through the glass ceilings (shadows), candy point lights from the fixtures
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x5a6aa8, .85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.0); sun.castShadow = true; sun.shadow.mapSize.set(LITE ? 1024 : 2048, LITE ? 1024 : 2048); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 60 }); scene.add(sun, sun.target);
const lamp = new THREE.SpotLight(0xfff4dc, 0, 24, .48, .6, 1.2); lamp.position.set(.25, -.15, 0); const lampT = new THREE.Object3D(); lampT.position.set(0, -.6, -6); cam.add(lamp, lampT); lamp.target = lampT;
const lampBeam = beam(); lampBeam.material.uniforms.uI.value = .07; cam.add(lampBeam); lampBeam.position.set(.25, -.2, -.3);
const pool = new LightPool(scene, LITE ? 4 : 6);
const sparks = new Particles(scene, LITE ? 260 : 420, { additive: true, soft: .05, gravity: 9, drag: .6 });
const smoke = new Particles(scene, 90, { additive: false, soft: 0, gravity: -.4, drag: .8 });
const drips = new Particles(scene, 200, { additive: true, soft: .1, gravity: 9.8, drag: .05 });
const motes = dust(scene, LITE ? 400 : 700);
const bolts = new Bolts(scene, 12);
const decals = new Decals(scene, textures().atlas, 60);
const debris = new Debris(scene, 80);
const shockMesh = shock(); scene.add(shockMesh);

// ------------------------------------------------------------------ kit layer: UI, flow, daily, board, store
const ui = createUI({ title: 'HOLLOWTIDE', hint: '', hand: '', progress: false, score: false });
const D = daily('hollowtide', ui, { name: NAME });
const F = flow('hollowtide', {});
const B = board({ game: 'hollowtide', label: 'Score', limits: { maxRun: 20000, maxPerSec: 150 }, corner: 'tr', accent: '#ffd23f' });
const st = store('hollowtide');
ui.els.sc.remove(); ui.els.top.remove();
ui.els.win.querySelector('p').innerHTML = 'CHAPTER <span data-l>1</span>'; ui.els.win.querySelector('h1').textContent = 'ESCAPED!';
ui.els.win.querySelector('.hint').textContent = 'Tap for the next chapter';

// ------------------------------------------------------------------ HUD
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const hud = $(`<div id="hud" class="off">
  <div class="vig"></div><div class="hunt"></div><div class="slats"><b>HIDING · tap USE to leave</b></div>
  <div class="st"><div class="bar hp"><i></i><b>❤ 100</b></div><div class="bar bat"><i></i><b>⚡ LAMP</b></div><div class="cards"></div></div>
  <div class="obj"><small>OBJECTIVE</small><span></span></div>
  <canvas id="radar" width="224" height="224"></canvas>
  <div class="eye">HIDDEN</div><div class="noise">${'<i></i>'.repeat(6)}</div>
  <div class="xh"><i class="h" style="left:6px"></i><i class="h" style="left:-16px"></i><i class="v" style="top:6px"></i><i class="v" style="top:-16px"></i></div><div class="hm"></div>
  <div class="ammo"><b>6</b><span> / 18</span><div>⚡EMP 0 · 🥫 0</div></div>
  <div class="prompt"></div><div class="toast"></div><div class="arrow"></div><div class="marker"><i></i><span></span></div>
  <div class="title"><small></small><b></b><p></p></div>
  <div class="log"><h3></h3><p></p><small>tap or press E to close</small></div>
</div>`);
document.body.appendChild(hud);
const H = (s) => hud.querySelector(s);
const radar = H('#radar'), rx = radar.getContext('2d');
const pad = $(`<div id="pad" class="off"><div class="stickhint">MOVE</div><div class="stick"><i></i></div>
  <div class="btn fire" data-b="fire"><svg viewBox="0 0 24 24"><path fill="#fff" stroke="#1b1530" stroke-width="1.6" d="M3 11h11l3-3h4v8h-4l-3-3H3z"/></svg></div>
  <div class="btn rel" data-b="reload">RELOAD</div><div class="btn emp" data-b="emp">EMP<small>0</small></div><div class="btn thr" data-b="throw">THROW<small>0</small></div>
  <div class="btn scan" data-b="scan">SCAN</div><div class="btn lamp" data-b="lamp">LAMP</div><div class="btn crouch" data-b="crouch">SNEAK</div>
  <div class="btn use" data-b="use">USE</div></div>`);
document.body.appendChild(pad);
let toastT = 0; function toast(t, col = '#fff', dur = 1.6) { const e = H('.toast'); e.textContent = t; e.style.color = col; e.classList.add('on'); toastT = dur; }

// ------------------------------------------------------------------ viewmodel: a chunky toy-bright plasma cutter
const tS = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: RAMP(), ...o });
const ammoCan = document.createElement('canvas'); ammoCan.width = 128; ammoCan.height = 64; const ammoTex = new THREE.CanvasTexture(ammoCan); ammoTex.colorSpace = THREE.SRGBColorSpace;
function drawAmmo(n) { const x = ammoCan.getContext('2d'); x.fillStyle = '#10234a'; x.fillRect(0, 0, 128, 64); x.fillStyle = n ? '#35e0ff' : '#ff4d6d'; x.font = 'bold 50px sans-serif'; x.textAlign = 'center'; x.fillText(n, 64, 52); ammoTex.needsUpdate = true; }
const gun = new THREE.Group(); cam.add(gun);
const gunK = new THREE.Group(); gun.add(gunK);
{
  const add = (g, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); gunK.add(o); return o; };
  const orange = tS(0xff7a3d), white = tS(0xf2f5f8), navy = tS(0x2b3a6b), cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 2.2, 2.6) }), glove = tS(0x3b4f9a), sleeve = tS(0x20b39b);
  add(new RoundedBoxGeometry(.17, .2, .62, 3, .05), orange, 0, 0, 0);
  add(new RoundedBoxGeometry(.11, .06, .42, 2, .025), navy, 0, .125, .06); add(new THREE.CylinderGeometry(.045, .045, .3, 12), cyan, 0, .17, .08, Math.PI / 2); for (const z of [-.06, .22]) add(new RoundedBoxGeometry(.13, .07, .05, 2, .02), white, 0, .17, z); add(new THREE.BoxGeometry(.175, .04, .3), tS(0xffd23f), 0, -.04, .05);
  add(new RoundedBoxGeometry(.09, .22, .12, 2, .03), navy, 0, -.17, .13, .3);
  add(new RoundedBoxGeometry(.28, .13, .15, 2, .04), navy, 0, .01, -.37);
  for (const x of [-.1, 0, .1]) add(new THREE.BoxGeometry(.035, .035, .13), white, x, .01, -.5);
  for (const z of [-.08, -.17, -.26]) add(new THREE.TorusGeometry(.095, .022, 8, 20), cyan, 0, .0, z);
  const scr = add(new THREE.PlaneGeometry(.16, .08), new THREE.MeshBasicMaterial({ map: ammoTex }), .087, .02, .05, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(.04, .04, .14, 12), navy, 0, -.11, -.26, Math.PI / 2);
  gun.lens = add(new THREE.CircleGeometry(.032, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 2.6) }), 0, -.11, -.331);
  add(new RoundedBoxGeometry(.15, .13, .17, 2, .05), glove, 0, -.18, .12);
  add(new THREE.CylinderGeometry(.075, .085, .45, 12), sleeve, .03, -.24, .38, Math.PI / 2 - .25);
  gun.flash = add(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 5, 6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.fillRect(0, 30, 64, 4); return new THREE.CanvasTexture(c); })() }), 0, .01, -.62);
  gunK.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
}
gun.position.set(.2, -.24, -.5); gun.scale.setScalar(.55); drawAmmo(6);
const MUZ = new THREE.Vector3(0, .01, -.6);

// ------------------------------------------------------------------ pickups: bright items with Fortnite-style loot beams
const beamGeo = new THREE.CylinderGeometry(.18, .32, 3.2, 16, 1, true); beamGeo.translate(0, 1.6, 0);
const beamMat = (c) => new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(c) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying float vY; void main(){ vY = position.y / 3.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 uC; varying float vY; void main(){ gl_FragColor = vec4(uC * (1. - vY) * .55, 1.); }' });
const ITEM = {
  1: { col: 0xffa030, name: 'AMBER KEYCARD' }, 2: { col: 0x30d8ff, name: 'CYAN KEYCARD' }, 3: { col: 0xb070ff, name: 'VIOLET KEYCARD' },
  B: { col: 0xffe14d, name: 'BATTERY' }, P: { col: 0x35e0ff, name: 'PLASMA CELLS' }, G: { col: 0x7ab8ff, name: 'EMP CHARGE' }, H: { col: 0xff6fa5, name: 'PATCH KIT' }, J: { col: 0xffffff, name: 'TIN CAN' },
};
function itemMesh(k) {
  const g = new THREE.Group(), it = ITEM[k], m = tS(it.col), w = tS(0xffffff), n = tS(0x2b3a6b);
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  if ('123'.includes(k)) { add(new RoundedBoxGeometry(.5, .32, .05, 2, .03), m); add(new THREE.BoxGeometry(.42, .06, .055), w, 0, .06); add(new THREE.BoxGeometry(.12, .1, .056), n, -.14, -.06); }
  else if (k === 'B') { add(new THREE.CylinderGeometry(.13, .13, .38, 16), m); add(new THREE.CylinderGeometry(.07, .07, .06, 12), w, 0, .22); add(new THREE.BoxGeometry(.06, .2, .27), n); }
  else if (k === 'P') { add(new RoundedBoxGeometry(.4, .14, .26, 2, .03), n); for (const x of [-.11, 0, .11]) add(new THREE.CylinderGeometry(.045, .045, .26, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 2, 2.4) }), x, .15); }
  else if (k === 'G') { add(new THREE.CylinderGeometry(.2, .2, .12, 20), n); add(new THREE.TorusGeometry(.2, .035, 8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 2, 3.5) }), 0, 0).rotation.x = Math.PI / 2; add(new THREE.SphereGeometry(.08, 12, 8), m, 0, .08); }
  else if (k === 'H') { add(new RoundedBoxGeometry(.4, .28, .2, 2, .05), w); add(new THREE.BoxGeometry(.2, .07, .21), m); add(new THREE.BoxGeometry(.07, .2, .21), m); }
  else if (k === 'J') { add(new THREE.CylinderGeometry(.09, .09, .22, 14), tS(0xff4d6d)); add(new THREE.CylinderGeometry(.092, .092, .08, 14), w); }
  const b = new THREE.Mesh(beamGeo, beamMat(it.col)); b.position.y = -.9; b.renderOrder = 4; g.add(b);
  return g;
}
function objectiveMesh() {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(.55, .7, .9, 20), tS(0x2b3a6b), 0, .45); add(new THREE.CylinderGeometry(.6, .6, .12, 20), tS(0xffd23f), 0, .92);
  add(new THREE.TorusGeometry(.6, .05, 8, 32), tS(0xff7a3d), 0, .3).rotation.x = Math.PI / 2;
  g.holo = add(new THREE.OctahedronGeometry(.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, .4) }), 0, 1.6);
  g.ring = add(new THREE.TorusGeometry(.45, .05, 8, 40, Math.PI * 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(.4, 2.6, .9) }), 0, 1.05); g.ring.rotation.x = Math.PI / 2; g.ring.scale.setScalar(.001);
  const b = new THREE.Mesh(beamGeo, beamMat(0xffd23f)); b.position.y = .9; g.add(b); g.beam = b;
  return g;
}

// ------------------------------------------------------------------ game state
let state = 'ready', mode = 'chapter', chapter = st.get('ch', 1), seed = 1, L = null, actors = [], warden = null, items = [], objs = [], noises = [], projs = [];
let runT = 0, kills = 0, logsRead = 0, cellsTaken = 0, everSeen = false, recorded = false, score = 0, ended = false, beatenShown = false;
let time = 0, trauma = 0, hitT = 0, scanT = 0, logT = 0, titleT = 0, blackout = 0, nextWave = 0, spawnN = 0;
const P = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, pitch: 0, hp: 100, bat: 100, mag: 6, reserve: 12, emp: 0, junk: 0, cards: new Set(), lightOn: false, crouch: false, sprint: false, hidden: false, locker: null, hidAt: 0, inDark: false, stepT: 0, side: 1, reload: 0, cool: 0, bob: 0, noise: 0, recoil: 0, useHold: 0, speed: 0 };
const ctx = {
  scene, P, get L() { return L; }, get fk() { return Math.min(1.25, Math.max(.85, F.k())); }, get time() { return time; },
  fx: { burst: (p, n, kind) => burst(p, n, kind) }, debris, lights: pool, makeBeam: beam,
  snd: (name, x, z, range = 30, vol = 1) => { const s = spatial(x - P.x, z - P.z, P.yaw, range); if (s.vol > .01) SND[name](s.pan, s.vol * vol); },
  hurt: (d, from) => hurt(d, from), caught: (w) => caught(w),
  onAlert: (a) => { if (!everSeen) everSeen = true; },
  wardenStep: (w) => { const d = Math.hypot(w.x - P.x, w.z - P.z); if (d < 14) trauma = Math.max(trauma, (1 - d / 14) * .35); },
};
function burst(p, n, kind) {
  for (let i = 0; i < n; i++) {
    if (kind === 'spark') { const a = Math.random() * 6.28, u = Math.random() * 4 + 1, s = Math.random() * 5 + 2; sparks.spawn(p.x, p.y, p.z, Math.cos(a) * s * .6, u, Math.sin(a) * s * .6, .4 + Math.random() * .5, .07 + Math.random() * .05, 3, 1.8 + Math.random(), .6, 1, 0, 1); }
    else if (kind === 'smoke') smoke.spawn(p.x + Math.random() * .4 - .2, p.y, p.z + Math.random() * .4 - .2, Math.random() * .4 - .2, .5 + Math.random() * .5, Math.random() * .4 - .2, 1.4 + Math.random(), .45, .9, .9, .95, .35, 2);
    else if (kind === 'plasma') { const a = Math.random() * 6.28, s = Math.random() * 3 + 1; sparks.spawn(p.x, p.y, p.z, Math.cos(a) * s, Math.random() * 3, Math.sin(a) * s, .3 + Math.random() * .3, .08, .8, 2.6, 3, 1, 0, 1); }
    else if (kind === 'emp') { const a = Math.random() * 6.28, b = Math.random() * 3.14, s = 6 + Math.random() * 4; sparks.spawn(p.x, p.y, p.z, Math.cos(a) * Math.sin(b) * s, Math.cos(b) * s, Math.sin(a) * Math.sin(b) * s, .5 + Math.random() * .4, .12, 1, 2, 4, 1, 0, 1); }
    else if (kind === 'splash') { const a = Math.random() * 6.28; drips.spawn(p.x, p.y + .05, p.z, Math.cos(a) * .8, 1 + Math.random(), Math.sin(a) * .8, .35, .05, .8, 1.6, 2, .8); }
    else if (kind === 'confetti') { const a = Math.random() * 6.28, s = 2 + Math.random() * 3, c = [[3, .6, 1.2], [3, 2.4, .4], [.6, 2.4, 3], [.8, 3, 1]][i % 4]; sparks.spawn(p.x, p.y, p.z, Math.cos(a) * s, 3 + Math.random() * 3, Math.sin(a) * s, 1.2, .1, ...c, 1, 0, 1); }
  }
}
const noise = (x, z, r) => { noises.push({ x, z, r }); };

// ------------------------------------------------------------------ build a run
let levelGroup = null;
const CANDY = [0xffb8ec, 0x9ff3ff, 0xfff0a8, 0xb8ffcf, 0xffc8a0];
function clearRun() {
  if (levelGroup) scene.remove(levelGroup);
  for (const a of actors) { scene.remove(a.m); } actors = []; warden = null;
  for (const it of items) scene.remove(it.mesh); items = [];
  for (const o of objs) scene.remove(o.mesh); objs = [];
  for (const p of projs) scene.remove(p.mesh); projs = [];
}
function setupRun(m, ch, sd) {
  clearRun(); mode = m; chapter = ch; seed = sd;
  const rows = m === 'survival' ? survivalMap(rng(sd)) : CHAPTERS[ch - 1].map;
  L = buildLevel(rows, { flood: m === 'survival' });
  levelGroup = L.group; scene.add(levelGroup);
  for (const f of L.fixtures) if (f.color === 0xcfeeff) { f.color = CANDY[(hash(f.x | 0, f.z | 0, 3) * CANDY.length) | 0]; f.int = 6; }
  pool.setFixtures(L.fixtures);
  const def = CHAPTERS[ch - 1] || { emp: 2, junk: 2, cells: 12 };
  Object.assign(P, { x: L.start.x, z: L.start.z, y: 0, vy: 0, hp: 100, bat: 100, mag: 6, reserve: m === 'survival' ? 12 : def.cells, emp: m === 'survival' ? 1 : def.emp, junk: m === 'survival' ? 2 : def.junk, cards: new Set(), lightOn: m === 'survival', crouch: false, hidden: false, locker: null, reload: 0, cool: 0, pitch: 0, useHold: 0 });
  // face the most open direction
  let best = 0, by = 0; for (let a = 0; a < 8; a++) { const yaw = a / 8 * Math.PI * 2; let d = 0; while (d < 20 && !blocked(L, P.x - Math.sin(yaw) * d, P.z - Math.cos(yaw) * d, .3)) d += .5; if (d > best) { best = d; by = yaw; } } P.yaw = by;
  for (const s of L.menders) { const a = new Mender(ctx, s.x, s.z); actors.push(a); }
  if (L.warden && (m === 'survival' || CHAPTERS[ch - 1].warden)) { warden = new Warden(ctx, L.warden.x, L.warden.z); actors.push(warden); if (m === 'survival') { warden.state = 'stunned'; warden.t = 20; } }
  for (const it of L.items) { const mesh = itemMesh(it.kind); mesh.position.set(it.x, .9, it.z); scene.add(mesh); items.push({ ...it, mesh, base: Math.random() * 6 }); }
  for (const o of L.objectives) { const mesh = objectiveMesh(); mesh.position.set(o.x, 0, o.z); scene.add(mesh); objs.push({ ...o, mesh }); }
  runT = 0; kills = 0; logsRead = 0; cellsTaken = 0; everSeen = false; recorded = false; score = 0; ended = false; beatenShown = false; blackout = 0; nextWave = 20; spawnN = 0;
  drawAmmo(P.mag); hudCards();
  // the dome sun follows the player; dimmer for Lights Out
  hemi.intensity = m === 'survival' ? .65 : .85; sun.intensity = m === 'survival' ? .8 : 1.25;
}
function startRun(m, ch, sd) {
  unlock(); setupRun(m, ch, sd);
  state = 'play'; ui.hideStart(); hud.classList.remove('off'); pad.classList.toggle('off', !COARSE); menuEl.style.display = 'none';
  const def = CHAPTERS[ch - 1];
  showTitle(m === 'survival' ? (D.seed || isDailyRun ? 'DAILY RUN' : 'SURVIVAL') : 'CHAPTER ' + ch, m === 'survival' ? 'LIGHTS OUT' : def.name, m === 'survival' ? 'Keep your lamp charged. Survive the Menders. Stay away from the Warden.' : def.obj);
  B.start(); st.set('ch', Math.max(st.get('ch', 1), ch));
}
let isDailyRun = false;
function showTitle(a, b, c) { const t = H('.title'); t.querySelector('small').textContent = a; t.querySelector('b').textContent = b; t.querySelector('p').textContent = c; t.classList.add('on'); titleT = 3.2; }

// ------------------------------------------------------------------ objectives text + next goal (shared by HUD arrow and bot)
const CARDN = { 1: 'AMBER', 2: 'CYAN', 3: 'VIOLET' };
function objText() {
  if (mode === 'survival') return `Survive · ${score} pts`;
  const def = CHAPTERS[chapter - 1], left = objs.filter(o => !o.done).length, need = [...new Set(L.doors.filter(d => d.key && !d.unlocked).map(d => d.key))].filter(k => !P.cards.has(k) && items.some(i => i.kind == k && !i.taken));
  if (left) return `${def.objVerb} · ${objs.length - left}/${objs.length}` + (need.length ? ` · find ${CARDN[need[0]]} card` : '');
  if (need.length && chapter === 1) return `Find the ${CARDN[need[0]]} keycard`;
  return chapter === 5 ? 'Launch the pod!' : 'Reach the LIFT';
}
const passBot = (cc, rr) => { const ch = L.at(cc, rr); if (ch === '#') return false; if (/[abc]/.test(ch)) { const d = L.doors.find(d => d.c === cc && d.r === rr); return d.unlocked || P.cards.has(d.key); } return true; };
function nextGoal() {
  if (!L) return null;
  const me = tileOf(P.x, P.z); let best = null;
  const consider = (x, z, kind, ref) => { const p = path(L, me, tileOf(x, z), passBot); if (p && (!best || p.length < best.len)) best = { x, z, kind, ref, len: p.length, path: p }; };
  if (mode === 'survival') {
    for (const it of items) if (!it.taken) consider(it.x, it.z, 'item', it);
    return best;
  }
  for (const o of objs) if (!o.done) consider(o.x, o.z, 'obj', o);
  for (const it of items) if (!it.taken && '123'.includes(it.kind)) consider(it.x, it.z, 'item', it);
  if (best) return best;
  if (objs.every(o => o.done)) consider(L.exit.x, L.exit.z, 'exit');
  return best;
}

// ------------------------------------------------------------------ input
const keys = {}; let locked = false, mouseDown = false, fireHeld = false, useHeld = false;
const bot = { t: 0, mx: 0, mz: 0, fire: false, use: false, sprint: false, aim: null };
addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true; unlock();
  if (state !== 'play') return;
  if (e.code === 'KeyR') doReload(); if (e.code === 'KeyF') toggleLamp(); if (e.code === 'KeyQ') doScan(); if (e.code === 'KeyG') doThrow('junk'); if (e.code === 'KeyV' || e.code === 'Digit2') doThrow('emp');
  if (e.code === 'KeyC' || e.code === 'ControlLeft') P.crouch = !P.crouch; if (e.code === 'Space') jump();
  if (e.code === 'KeyE') { useHeld = true; useTap(); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyE') useHeld = false; });
R.domElement.addEventListener('mousedown', e => {
  unlock(); if (state !== 'play' || COARSE) return;
  if (!locked && R.domElement.requestPointerLock) { try { R.domElement.requestPointerLock(); } catch (er) {} }
  if (e.button === 0) { mouseDown = true; fireHeld = true; tryFire(); }
});
addEventListener('mouseup', () => { mouseDown = false; fireHeld = false; });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === R.domElement; });
addEventListener('mousemove', e => { if (state !== 'play' || COARSE) return; if (locked || mouseDown) look(e.movementX * (locked ? 1 : 1.4), e.movementY * (locked ? 1 : 1.4), .0022); });
function look(dx, dy, k) { if (P.hidden) { P.yaw -= dx * k * .4; return; } P.yaw -= dx * k; P.pitch = Math.max(-1.35, Math.min(1.35, P.pitch - dy * k)); }
// touch: dynamic stick on the left, look by dragging on the right, buttons
const stick = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, lookT = { id: null, x: 0, y: 0 };
const stickEl = pad.querySelector('.stick'), knob = stickEl.querySelector('i');
addEventListener('pointerdown', e => {
  if (state !== 'play' || e.pointerType === 'mouse') return; unlock();
  if (e.target.closest && (e.target.closest('.btn') || e.target.closest('.bd-trophy') || e.target.closest('.bd-wrap'))) return;
  if (e.target.closest && e.target.closest('.log.on')) { closeLog(); return; }
  if (e.clientX < innerWidth * .45 && e.clientY > innerHeight * .35 && stick.id === null) { stick.id = e.pointerId; stick.x = e.clientX; stick.y = e.clientY; stick.dx = stick.dy = 0; stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knob.style.transform = ''; }
  else if (lookT.id === null) { lookT.id = e.pointerId; lookT.x = e.clientX; lookT.y = e.clientY; }
});
addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) { let dx = e.clientX - stick.x, dy = e.clientY - stick.y; const l = Math.hypot(dx, dy), m = 52; if (l > m) { dx *= m / l; dy *= m / l; } stick.dx = dx / m; stick.dy = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; }
  else if (e.pointerId === lookT.id) { look(e.clientX - lookT.x, e.clientY - lookT.y, .0058); lookT.x = e.clientX; lookT.y = e.clientY; }
});
const endPtr = e => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; stickEl.style.display = 'none'; } if (e.pointerId === lookT.id) lookT.id = null; };
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
pad.querySelectorAll('.btn').forEach(b => {
  const k = b.dataset.b;
  b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); unlock(); b.classList.add('down');
    if (k === 'fire') { fireHeld = true; tryFire(); } if (k === 'reload') doReload(); if (k === 'emp') doThrow('emp'); if (k === 'throw') doThrow('junk'); if (k === 'scan') doScan(); if (k === 'lamp') toggleLamp(); if (k === 'crouch') P.crouch = !P.crouch; if (k === 'use') { useHeld = true; useTap(); }
    // look while holding fire: the same finger can drag
    if (k === 'fire' && lookT.id === null) { lookT.id = e.pointerId; lookT.x = e.clientX; lookT.y = e.clientY; }
  });
  const up = e => { b.classList.remove('down'); if (k === 'fire') fireHeld = false; if (k === 'use') useHeld = false; };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
H('.log').addEventListener('pointerdown', e => { e.stopPropagation(); closeLog(); });

// ------------------------------------------------------------------ actions
const camPos = new THREE.Vector3(), camDir = new THREE.Vector3(), camRight = new THREE.Vector3();
function eyeY() { return P.y + (P.hidden ? 1.55 : P.crouch ? 1.05 : 1.62); }
function toggleLamp() { if (P.bat <= 0) { toast('Battery empty!', '#ffd23f'); SND.deny(); return; } P.lightOn = !P.lightOn; SND.blip(0, 1); }
function jump() { if (P.y <= 0.001 && !P.hidden) { P.vy = 4.6; } }
function doReload() { if (P.reload > 0 || P.mag === 6 || P.reserve <= 0) { if (P.reserve <= 0 && P.mag < 6) toast('No plasma cells', '#ff8fb0'); return; } P.reload = 1.15; SND.reload(); }
function tryFire() {
  if (state !== 'play' || P.hidden || logOpen) return;
  if (P.reload > 0 || P.cool > 0) return;
  if (P.mag <= 0) { SND.empty(); doReload(); P.cool = .3; return; }
  P.mag--; P.cool = .36; drawAmmo(P.mag); SND.shot(); P.recoil = 1; trauma = Math.max(trauma, .18);
  cam.getWorldPosition(camPos); cam.getWorldDirection(camDir); camRight.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
  // aim assist on touch: pull toward the closest machine near the crosshair
  if (COARSE || bot.t > 0) { let bestA = .16, tgt = null; for (const a of actors) { if (a.dead) continue; const c = a.center.clone(), v = c.sub(camPos), d = v.length(); v.normalize(); const ang = Math.acos(Math.min(1, v.dot(camDir))); if (ang < bestA && d < 22 && los(L, P.x, P.z, a.x, a.z)) { bestA = ang; tgt = v.clone(); } } if (tgt) camDir.lerp(tgt, .85).normalize(); }
  const spread = (P.speed > 1 ? .02 : .006) + (P.y > 0 ? .05 : 0);
  const muz = gunK.localToWorld(MUZ.clone());
  const res = []; let anyHit = false, kill = false;
  for (const off of [-.2, 0, .2]) {
    const o = camPos.clone().addScaledVector(camRight, off), d = camDir.clone().add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread)).normalize();
    const h = ray(o, d, 40); res.push(h);
    bolts.fire(muz.clone().addScaledVector(camRight, off * .5), h.p);
    if (h.actor) { anyHit = true; const head = h.actor.kind === 'mender' && h.p.y > .6 && h.p.y < .9; const died = h.actor.damage(head ? 2 : 1, P); if (died) { kill = true; kills++; } burst(h.p, 10, 'spark'); }
    else { burst(h.p, 6, 'plasma'); if (h.n) decals.add(h.p, h.n); }
  }
  pool.flash(muz, 0x60e8ff, 16, .07, 7); gun.flash.material.opacity = 1; gun.flash.rotation.z = Math.random() * 3;
  noise(P.x, P.z, 17);
  if (anyHit) { hitT = .18; H('.hm').classList.toggle('kill', kill); SND.hit(); if (kill) { toast('+50 WRECKED', '#ffd23f', 1); burst(res.find(r => r.actor).p, 26, 'confetti'); } }
}
// ray-march through tiles, props and machines
function ray(o, d, max) {
  const p = o.clone(), step = .1; let prevT = tileOf(p.x, p.z);
  for (let t = 0; t < max; t += step) {
    p.addScaledVector(d, step);
    for (const a of actors) { if (a.dead) continue; const parts = a.kind === 'warden' ? [[a.x, 1.7, a.z, .6], [a.x + Math.sin(a.yaw) * .3, 2.55, a.z + Math.cos(a.yaw) * .3, .42], [a.x, .8, a.z, .45]] : [[a.x, .65, a.z, .5]];
      for (const [x, y, z, r] of parts) { const dx = p.x - x, dy = p.y - y, dz = p.z - z; if (dx * dx + dy * dy + dz * dz < r * r) return { p: p.clone(), actor: a }; } }
    const tl = tileOf(p.x, p.z);
    if (p.y < 0) return { p: p.clone().setY(.01), n: new THREE.Vector3(0, 1, 0) };
    if (p.y > L.ceil(tl[0], tl[1])) return { p: p.clone(), n: new THREE.Vector3(0, -1, 0) };
    if (solidTile(L, tl[0], tl[1])) { const n = new THREE.Vector3(prevT[0] - tl[0], 0, prevT[1] - tl[1]); if (!n.lengthSq()) n.set(-d.x, 0, -d.z); n.normalize(); return { p: p.clone().addScaledVector(d, -.05), n }; }
    for (const pr of L.props) if (Math.abs(p.x - pr.x) < pr.hw && Math.abs(p.z - pr.z) < pr.hd && p.y < 1.6) return { p: p.clone(), n: new THREE.Vector3(-d.x, 0, -d.z).normalize() };
    prevT = tl;
  }
  return { p: p.clone(), n: null };
}
function doThrow(kind) {
  if (state !== 'play' || P.hidden) return;
  if (kind === 'emp' ? P.emp <= 0 : P.junk <= 0) { toast(kind === 'emp' ? 'No EMP charges' : 'No cans to throw', '#ff8fb0'); SND.deny(); return; }
  if (kind === 'emp') P.emp--; else P.junk--;
  cam.getWorldPosition(camPos); cam.getWorldDirection(camDir);
  const mesh = kind === 'emp' ? itemMesh('G') : itemMesh('J'); mesh.children[mesh.children.length - 1].visible = false; scene.add(mesh);
  const v = camDir.clone().multiplyScalar(kind === 'emp' ? 11 : 13); v.y += 3.2;
  projs.push({ kind, mesh, p: camPos.clone().addScaledVector(camDir, .5), v, t: 0, bounced: false });
  SND.throwIt();
}
function detonate(pr) {
  const p = pr.p;
  if (pr.kind === 'emp') {
    SND.emp(spatial(p.x - P.x, p.z - P.z, P.yaw).pan); pool.flash(p, 0x60a0ff, 80, .6, 16); burst(p, 60, 'emp'); trauma = Math.max(trauma, .5);
    shockMesh.visible = true; shockMesh.position.copy(p); shockMesh.userData.t = 0;
    for (const a of actors) { if (a.dead) continue; const d = Math.hypot(a.x - p.x, a.z - p.z); if (a.kind === 'warden' && d < 7.5) a.stun(7.5); else if (a.kind === 'mender' && d < 6.5) { if (a.damage(2)) kills++; else a.stun(3.5); } }
    noise(p.x, p.z, 22);
  } else { ctx.snd('clank', p.x, p.z, 40); noise(p.x, p.z, 20); burst(p, 6, 'plasma'); }
}
function doScan() {
  if (state !== 'play') return; if (scanT > 3) return;
  if (P.bat < 4) { toast('Battery too low to scan', '#ffd23f'); SND.deny(); return; }
  P.bat -= 4; scanT = 5.5; SND.ping(); noise(P.x, P.z, 4); radarPulse = 0;
}
let radarPulse = 1;
// use / interact
let focus = null;
function findFocus() {
  if (!L) return null; let best = null, bd = 2.2;
  const cand = (x, z, kind, ref, r = 2.2) => { const d = Math.hypot(x - P.x, z - P.z); if (d < Math.min(bd, r)) { bd = d; best = { kind, ref, x, z }; } };
  if (P.hidden) return { kind: 'unhide', ref: P.locker };
  for (const t of L.terminals) cand(t.x, t.z, 'term', t);
  for (const l of L.lockers) cand(l.x, l.z, 'locker', l, 1.9);
  for (const o of objs) if (!o.done) cand(o.x, o.z, 'obj', o, 2.0);
  for (const d of L.doors) if (d.key && !d.unlocked && !P.cards.has(d.key)) cand(d.x, d.z, 'locked', d, 2.6);
  return best;
}
let logOpen = false;
function useTap() {
  if (state !== 'play') return;
  if (logOpen) { closeLog(); return; }
  const f = focus; if (!f) return;
  if (f.kind === 'term') openLog(f.ref);
  else if (f.kind === 'locker') { P.hidden = true; P.locker = f.ref; P.hidAt = time; P.x = f.ref.x + Math.sin(f.ref.ry) * .05; P.z = f.ref.z + Math.cos(f.ref.ry) * .05; P.yaw = f.ref.ry + Math.PI; P.pitch = -.05; SND.locker(); H('.slats').classList.add('on'); }
  else if (f.kind === 'unhide') { unhide(); }
  else if (f.kind === 'locked') { SND.deny(); toast(`Needs the ${CARDN[f.ref.key]} keycard`, '#' + new THREE.Color(f.ref.col).getHexString()); }
}
function unhide() { const l = P.locker; P.hidden = false; P.locker = null; if (l) { P.x = l.x + Math.sin(l.ry) * 1.0; P.z = l.z + Math.cos(l.ry) * 1.0; } SND.locker(); H('.slats').classList.remove('on'); }
function openLog(t) {
  const i = L.terminals.indexOf(t), def = CHAPTERS[chapter - 1];
  const lg = mode === 'survival' ? ['LIGHTS OUT · CAIRN', 'POWER RESERVES FAILING. DIVER, THE MENDERS ARE DRAWN TO LIGHT AND NOISE. THE WARDEN IS DRAWN TO EVERYTHING.'] : def.logs[i % def.logs.length];
  H('.log h3').textContent = lg[0]; H('.log p').textContent = lg[1]; H('.log').classList.add('on'); logOpen = true; logT = 12; SND.term();
  if (!t.read) { t.read = true; logsRead++; toast('+75 LOG FOUND', '#35e0ff', 1.2); }
}
function closeLog() { H('.log').classList.remove('on'); logOpen = false; }

// ------------------------------------------------------------------ damage, death, win
function hurt(d, from) {
  if (state !== 'play') return;
  P.hp -= d; trauma = Math.max(trauma, .55); SND.hurt(); H('.vig').style.opacity = 1; setTimeout(() => H('.vig').style.opacity = 0, 220);
  if (P.hidden) unhide();
  if (P.hp <= 0) lose('SHUT DOWN', from && from.kind === 'mender' ? 'A Mender welded your suit shut.' : 'Your suit gave out.');
}
let caughtBy = null, caughtT = 0;
function caught(w) {
  if (state !== 'play') return; caughtBy = w; caughtT = 1.1; state = 'caught'; SND.grab(); trauma = 1; if (P.hidden) { P.hidden = false; H('.slats').classList.remove('on'); }
}
function lose(title, line) {
  if (state === 'lost') return; state = 'lost'; SND.lose(); fireHeld = false; hud.classList.add('off'); pad.classList.add('off');
  if (document.pointerLockElement) document.exitPointerLock();
  if (mode === 'survival') { score = survivalScore(); if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: runT * 1000 }); st.set('best', Math.max(st.get('best', 0), score)); } ui.lose('LIGHTS OUT', `${score} points · best ${st.get('best', 0)}`); }
  else { if (!recorded) { recorded = true; F.level(false, objs.length ? objs.filter(o => o.done).length / objs.length * .8 : .3); } ui.lose(title, line + ' Tip: ' + TIPS[(Math.random() * TIPS.length) | 0]); }
}
const TIPS = ['The Warden hunts by sound: sneak, and never run in water.', 'Throw a can to send machines the wrong way.', 'Lockers hide you, unless the Warden sees you climb in.', 'An EMP stuns the Warden for 7 seconds.', 'Lamp off = harder to spot.', 'SCAN shows every machine nearby for a few seconds.'];
const survivalScore = () => Math.floor(runT * 5) + kills * 60 + cellsTaken * 40;
function chapterScore() { const def = CHAPTERS[chapter - 1]; return 500 + chapter * 150 + kills * 50 + logsRead * 75 + Math.max(0, Math.round((def.par - runT) * 3)) + (everSeen ? 0 : 400) + Math.round(Math.max(0, P.hp) * 2); }
function win() {
  if (state !== 'play') return; state = 'won'; SND.win(); hud.classList.add('off'); pad.classList.add('off'); if (document.pointerLockElement) document.exitPointerLock();
  score = chapterScore(); burst(new THREE.Vector3(P.x, 1.5, P.z), 80, 'confetti');
  if (!recorded) { recorded = true; F.level(true); B.submit(score, { ms: runT * 1000 }); }
  st.set('ch', Math.max(st.get('ch', 1), Math.min(5, chapter + 1))); st.set('best' + chapter, Math.max(st.get('best' + chapter, 0), score));
  D.won(score);
  const extra = `${score} pts · ${kills} wrecked · ${logsRead} logs${everSeen ? '' : ' · GHOST +400'}`;
  ui.els.win.querySelector('.hint').textContent = chapter === 5 ? 'Tap to return to the menu' : 'Tap for the next chapter';
  ui.els.win.querySelector('h1').textContent = chapter === 5 ? 'YOU MADE IT' : 'ESCAPED!';
  ui.win(chapter, chapter === 5 ? extra + ' — ' + ENDING : extra);
}
ui.onTap(which => {
  unlock();
  if (which === 'start') { const c = Math.min(5, st.get('ch', 1)); if (D.seed) { isDailyRun = true; startRun('survival', 1, D.seed); } else startRun('chapter', c, 1); }
  else if (which === 'win') { if (chapter >= 5) toMenu(); else startRun('chapter', chapter + 1, 1); }
  else if (which === 'lose') { if (mode === 'survival') startRun('survival', 1, isDailyRun ? seed : (Math.random() * 1e9) | 0); else startRun('chapter', chapter, 1); }
});

// ------------------------------------------------------------------ menu (inside the kit's start card)
const menuEl = $(`<div class="menu">
  <button class="main" data-m="cont">CONTINUE<small></small></button>
  <div class="row">${[1, 2, 3, 4, 5].map(i => `<button data-c="${i}">${i}</button>`).join('')}</div>
  <div class="two"><button data-m="surv">LIGHTS OUT<small>survival</small></button><button data-m="daily">DAILY RUN<small>same for everyone</small></button></div>
  <div class="keys">${COARSE ? 'Left: move · Right: look · Hold SNEAK to stay quiet' : 'WASD move · Mouse look · Click fire · E use · Shift run · C sneak · G throw can · V EMP · Q scan · F lamp'}</div></div>`);
ui.els.start.querySelector('.hint').replaceWith(menuEl);
ui.els.start.insertBefore($('<p class="tag">SCI-FI SURVIVAL THRILLER</p>'), ui.els.start.querySelector('h1').nextSibling);
ui.els.start.appendChild($('<div class="menuwrap"></div>'));
function paintMenu() {
  const c = Math.min(5, st.get('ch', 1));
  menuEl.querySelector('[data-m=cont] small').textContent = `Chapter ${c} · ${CHAPTERS[c - 1].name}${st.get('best', 0) ? ' · Lights Out best ' + st.get('best', 0) : ''}`;
  menuEl.querySelectorAll('[data-c]').forEach(b => { const i = +b.dataset.c; b.dataset.off = i > c ? 1 : ''; b.style.opacity = i > c ? .4 : 1; b.classList.toggle('cur', i === c); });
}
menuEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b || b.dataset.off) return; e.stopPropagation(); unlock(); ui.hideStart();
  isDailyRun = false;
  if (b.dataset.c) startRun('chapter', +b.dataset.c, 1);
  else if (b.dataset.m === 'cont') startRun('chapter', Math.min(5, st.get('ch', 1)), 1);
  else if (b.dataset.m === 'surv') startRun('survival', 1, (Math.random() * 1e9) | 0);
  else if (b.dataset.m === 'daily') { isDailyRun = true; const d = new Date(); startRun('survival', 1, d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()); }
});
function toMenu() { state = 'ready'; hud.classList.add('off'); pad.classList.add('off'); menuEl.style.display = ''; paintMenu(); setupRun('chapter', Math.min(5, st.get('ch', 1)), 1); ui.start(); }

// ------------------------------------------------------------------ HUD painting
function hudCards() { H('.cards').innerHTML = [1, 2, 3].filter(k => P.cards.has(k)).map(k => `<span style="background:#${new THREE.Color(ITEM[k].col).getHexString()}"></span>`).join(''); }
const proj = new THREE.Vector3();
function paintHud(dt) {
  H('.bar.hp i').style.transform = `scaleX(${Math.max(0, P.hp) / 100})`; H('.bar.hp b').textContent = '❤ ' + Math.max(0, Math.ceil(P.hp));
  H('.bar.bat i').style.transform = `scaleX(${P.bat / 100})`; H('.bar.bat b').textContent = (P.lightOn ? '🔦 ON ' : '⚡ ') + Math.ceil(P.bat) + '%';
  H('.obj span').textContent = objText();
  H('.ammo b').textContent = P.reload > 0 ? '··' : P.mag; H('.ammo span').textContent = ' / ' + P.reserve; H('.ammo div').textContent = `⚡EMP ${P.emp} · 🥫 ${P.junk}`;
  pad.querySelector('.emp small').textContent = P.emp; pad.querySelector('.thr small').textContent = P.junk; pad.querySelector('.lamp').classList.toggle('on', P.lightOn); pad.querySelector('.crouch').classList.toggle('on', P.crouch);
  pad.querySelector('.fire').style.opacity = P.mag ? 1 : .6;
  // awareness pill + noise meter
  let aw = 0; for (const a of actors) { if (a.dead) continue; if (a.state === 'hunt' || a.state === 'attack') aw = 2; else if ((a.state === 'investigate' || a.aware > .2 || a.state === 'search') && aw < 1) aw = 1; }
  const eye = H('.eye'); eye.className = 'eye' + (aw === 2 ? ' seen' : aw === 1 ? ' sus' : ''); eye.textContent = P.hidden ? 'IN LOCKER' : aw === 2 ? 'SPOTTED!' : aw === 1 ? 'SUSPICIOUS' : 'HIDDEN';
  H('.hunt').style.opacity = aw === 2 ? .6 + Math.sin(time * 8) * .25 : 0;
  const lv = Math.min(6, Math.round(P.noise / 3)); H('.noise').querySelectorAll('i').forEach((e, i) => { e.style.height = 5 + i * 2 + 'px'; e.className = i < lv ? (i >= 4 ? 'loud' : 'on') : ''; });
  // focus prompt
  const pr = H('.prompt'), useB = pad.querySelector('.use');
  let label = '';
  if (focus) label = focus.kind === 'term' ? 'READ LOG' : focus.kind === 'locker' ? 'HIDE' : focus.kind === 'unhide' ? 'LEAVE LOCKER' : focus.kind === 'obj' ? `HOLD · ${CHAPTERS[chapter - 1]?.objVerb || 'USE'}` : focus.kind === 'locked' ? `${CARDN[focus.ref.key]} CARD NEEDED` : '';
  if (logOpen) label = '';
  pr.innerHTML = label ? (COARSE ? '' : '<span class="k">E</span>') + label + (focus && focus.kind === 'obj' ? `<span class="ring" style="--p:${Math.round(focus.ref.prog * 100)}%"></span>` : '') : '';
  pr.classList.toggle('on', !!label && !COARSE); useB.textContent = label; useB.classList.toggle('show', !!label && COARSE);
  if (hitT > 0) { hitT -= dt; H('.hm').style.opacity = 1; } else H('.hm').style.opacity = 0;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) H('.toast').classList.remove('on'); }
  if (titleT > 0) { titleT -= dt; if (titleT <= 0) H('.title').classList.remove('on'); }
  if (logT > 0) { logT -= dt; if (logT <= 0) closeLog(); }
  // objective marker on screen (after a scan, or always within 25 m)
  const g = goalCache, mk = H('.marker'), ar = H('.arrow');
  if (g && (scanT > 0 || titleT > 0)) {
    proj.set(g.x, 1.6, g.z).project(cam); const d = Math.hypot(g.x - P.x, g.z - P.z);
    const on = proj.z < 1 && Math.abs(proj.x) < .92 && Math.abs(proj.y) < .9;
    if (on) { mk.style.left = (proj.x * .5 + .5) * innerWidth + 'px'; mk.style.top = (-proj.y * .5 + .5) * innerHeight + 'px'; mk.querySelector('span').textContent = Math.round(d) + ' m'; mk.classList.add('on'); ar.classList.remove('on'); }
    else { mk.classList.remove('on'); let a = Math.atan2(g.x - P.x, g.z - P.z) - (P.yaw + Math.PI); a = Math.atan2(Math.sin(a), Math.cos(a)); const rr = Math.min(innerWidth, innerHeight) * .32; ar.style.left = innerWidth / 2 - Math.sin(a) * rr + 'px'; ar.style.top = innerHeight / 2 - Math.cos(a) * rr + 'px'; ar.style.transform = `rotate(${-a}rad)`; ar.classList.add('on'); }
  } else { mk.classList.remove('on'); ar.classList.remove('on'); }
  drawRadar();
}
function drawRadar() {
  const w = 224, c = w / 2, sc = 7.5; rx.clearRect(0, 0, w, w);
  rx.save(); rx.beginPath(); rx.arc(c, c, c - 2, 0, 7); rx.clip(); rx.fillStyle = 'rgba(14,40,86,.75)'; rx.fillRect(0, 0, w, w);
  rx.translate(c, c); rx.rotate(P.yaw);
  const [pc, pr] = tileOf(P.x, P.z);
  for (let r = pr - 6; r <= pr + 6; r++) for (let cc = pc - 6; cc <= pc + 6; cc++) {
    const ch = L.at(cc, r); if (ch === '#') continue; const x = (cc * T - P.x) * sc, y = (r * T - P.z) * sc;
    rx.fillStyle = /[dabc]/.test(ch) ? (L.doors.find(d => d.c === cc && d.r === r)?.unlocked ? '#22c55e' : '#ff9a3d') : ch === '~' ? '#3fb7e0' : '#5f8fd0'; rx.fillRect(x - T * sc / 2, y - T * sc / 2, T * sc + .5, T * sc + .5);
  }
  const dot = (x, z, col, r = 6) => { rx.fillStyle = col; rx.beginPath(); rx.arc((x - P.x) * sc, (z - P.z) * sc, r, 0, 7); rx.fill(); rx.lineWidth = 2.5; rx.strokeStyle = '#1b1530'; rx.stroke(); };
  for (const o of objs) if (!o.done) dot(o.x, o.z, '#ffd23f', 7 + Math.sin(time * 6) * 1.5);
  if (L.exit && objs.every(o => o.done)) dot(L.exit.x, L.exit.z, '#22c55e', 8);
  for (const it of items) if (!it.taken) dot(it.x, it.z, '#' + new THREE.Color(ITEM[it.kind].col).getHexString(), 4);
  for (const a of actors) { if (a.dead) continue; const d = Math.hypot(a.x - P.x, a.z - P.z); if (scanT > 0 || d < 9 || (a.kind === 'warden' && d < 16 && a.state !== 'patrol')) dot(a.x, a.z, a.kind === 'warden' ? '#ff3d5a' : '#ff9a3d', a.kind === 'warden' ? 9 : 6); }
  rx.restore();
  if (radarPulse < 1) { radarPulse += .02; rx.strokeStyle = `rgba(53,224,255,${1 - radarPulse})`; rx.lineWidth = 5; rx.beginPath(); rx.arc(c, c, radarPulse * c, 0, 7); rx.stroke(); }
  rx.fillStyle = '#fff'; rx.strokeStyle = '#1b1530'; rx.lineWidth = 3; rx.beginPath(); rx.moveTo(c, c - 12); rx.lineTo(c + 9, c + 9); rx.lineTo(c, c + 4); rx.lineTo(c - 9, c + 9); rx.closePath(); rx.fill(); rx.stroke();
}
let goalCache = null, goalT = 0;

// ------------------------------------------------------------------ bot: plays like a careful human (navigate, fight, use, EMP the Warden)
function botTick() {
  if (state !== 'play' || !L) return;
  bot.t = 1.5;
  if (logOpen) closeLog();
  if (P.hidden) { if (!warden || Math.hypot(warden.x - P.x, warden.z - P.z) > 9 || warden.state === 'stunned') unhide(); return; }
  if (P.lightOn && mode !== 'survival') P.lightOn = false;
  // fight: nearest visible machine
  let tgt = null, td = 1e9;
  for (const a of actors) { if (a.dead || a.kind === 'warden') continue; const d = Math.hypot(a.x - P.x, a.z - P.z); if (d < 14 && d < td && los(L, P.x, P.z, a.x, a.z) && (a.state !== 'idle' || d < 9)) { td = d; tgt = a; } }
  if (warden && warden.state !== 'stunned') { const d = Math.hypot(warden.x - P.x, warden.z - P.z); if ((warden.state === 'hunt' || warden.state === 'attack' || d < 6) && d < 10 && P.emp > 0 && los(L, P.x, P.z, warden.x, warden.z)) { aimAt(warden.x, 1.4, warden.z, 1); doThrow('emp'); return; } }
  if (P.mag === 0 && P.reserve > 0) doReload();
  bot.fire = false; bot.aim = null;
  if (tgt) { bot.aim = [tgt.x, .65, tgt.z]; const err = aimAt(tgt.x, .65, tgt.z, .7); if (err < .12) bot.fire = true; }
  // move along the path to the next goal
  const g = goalCache || nextGoal(); bot.mx = bot.mz = 0; bot.use = false; bot.sprint = !warden || warden.state === 'hunt' || warden.state === 'attack' || warden.state === 'stunned' || Math.hypot(warden.x - P.x, warden.z - P.z) > 16;
  if (g && g.path) {
    let wp = g.path[0] ? [g.path[0][0] * T, g.path[0][1] * T] : [g.x, g.z];
    if (g.path.length <= 1 || Math.hypot(g.x - P.x, g.z - P.z) < 3) wp = [g.x, g.z];
    const dx = wp[0] - P.x, dz = wp[1] - P.z, d = Math.hypot(dx, dz);
    if (g.kind === 'obj' && Math.hypot(g.x - P.x, g.z - P.z) < 1.8) { bot.use = true; }
    else if (d > .1) { bot.mx = dx / d; bot.mz = dz / d; }
    if (!tgt) aimAt(P.x + bot.mx * 5, 1.4, P.z + bot.mz * 5, .5);
  }
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in chapter 1, until the first touch,
// you walk and look along the path to the first objective by yourself (the bot's navigation, never firing), then stop
const DEMO = demo(null, { ready: () => state === 'play' && mode === 'chapter' && chapter === 1 && !logOpen && !P.hidden, wait: 1500, ms: 4000 });
let demoOn = false;
function demoWalk() { if (DEMO.on) { botTick(); bot.fire = false; bot.use = false; demoOn = true; } else if (demoOn) { demoOn = false; bot.t = 0; bot.mx = bot.mz = 0; bot.aim = null; } }
function aimAt(x, y, z, k) {
  const dx = x - P.x, dz = z - P.z, dy = y - eyeY(); const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  let dyaw = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw)); P.yaw += dyaw * k; P.pitch += (pitch - P.pitch) * k; return Math.abs(dyaw) * (1 - k) + Math.abs(pitch - P.pitch);
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), fps = 60, frames = 0, fpsT = 0;
const fwd = new THREE.Vector3(), tmpV = new THREE.Vector3();
let musicI = 0, heartT = 0, dripT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
  frames++; fpsT += dt; if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  if (!L) return;
  const playing = state === 'play'; R.info.reset();
  if (playing && window.__freeze) { for (const a of actors) { a.yaw = Math.atan2(P.x - a.x, P.z - a.z); const x = a.x, z = a.z; a.update(.016, { x: P.x, z: P.z, hidden: false, lightOn: true }); a.x = x; a.z = z; a.m.position.set(x, 0, z); } }
  else if (playing) { runT += dt; demoWalk(); update(dt); }
  else if (state === 'caught') { caughtT -= dt; if (caughtBy) { const dx = P.x - caughtBy.x, dz = P.z - caughtBy.z, d = Math.hypot(dx, dz) || 1; if (d < 1.9) { const nx = caughtBy.x + dx / d * 1.9, nz = caughtBy.z + dz / d * 1.9; if (!blocked(L, nx, nz, .2)) { P.x += (nx - P.x) * Math.min(1, dt * 6); P.z += (nz - P.z) * Math.min(1, dt * 6); } } aimAt(caughtBy.x, 2.9, caughtBy.z, Math.min(1, dt * 8)); caughtBy.update(dt, { x: P.x, z: P.z, hidden: false, lightOn: true }); } trauma = Math.max(trauma, .6); if (caughtT <= 0) { state = 'play'; lose('CAUGHT', 'The Warden found you.'); } }
  else if (state === 'ready') { P.yaw += dt * .12; P.pitch = Math.sin(time * .3) * .08 + .08; for (const a of actors) a.update(dt, { x: -999, z: -999, hidden: true }); }
  else for (const a of actors) if (a.kind === 'warden') a.update(dt, { x: -999, z: -999, hidden: true });
  // camera
  const shake = trauma * trauma; trauma = Math.max(0, trauma - dt * 1.6);
  cam.position.set(P.x + (Math.random() - .5) * shake * .15, eyeY() + Math.sin(P.bob * 2) * .045 * Math.min(1, P.speed / 3) + (Math.random() - .5) * shake * .12, P.z);
  cam.rotation.set(P.pitch + P.recoil * .035 + (Math.random() - .5) * shake * .05, P.yaw, (Math.random() - .5) * shake * .04);
  // viewmodel: sway, bob, recoil, reload
  P.recoil = Math.max(0, P.recoil - dt * 7);
  const rl = P.reload > 0 ? Math.sin(Math.min(1, (1.15 - P.reload) / 1.15) * Math.PI) : 0;
  const wallClose = (() => { cam.getWorldDirection(fwd); const h = blocked(L, P.x + fwd.x * .75, P.z + fwd.z * .75, .1); return h ? 1 : 0; })();
  gun.position.set(.19 + Math.sin(P.bob) * .01 * Math.min(1, P.speed / 3), -.25 - Math.abs(Math.cos(P.bob)) * .01 * Math.min(1, P.speed / 3) - rl * .14, -.5 + P.recoil * .06 + wallClose * .1);
  gun.rotation.set(P.recoil * .22 - rl * .7 + .04, .07, rl * .5);
  gun.visible = !P.hidden && state !== 'ready';
  gun.flash.material.opacity = Math.max(0, gun.flash.material.opacity - dt * 14); gun.flash.scale.setScalar(.7 + gun.flash.material.opacity * .6);
  // lamp
  lamp.intensity = P.lightOn && state !== 'ready' ? 30 : 0; lampBeam.visible = P.lightOn && state !== 'ready'; gun.lens.material.color.setScalar(P.lightOn ? 3 : .3);
  // sun follows
  sun.position.set(P.x - 7, 22, P.z + 5); sun.target.position.set(P.x, 0, P.z);
  pool.dim = blackout > 0 ? .12 : 1; pool.update(new THREE.Vector3(P.x, 0, P.z), time, dt);
  const ocean = materials().ocean; ocean.uniforms.uT.value = time;
  const X = textures(); X.water.offset.set(time * .03, time * .02); X.rack.offset.y = (time * .4) % 1;
  motes.uniforms.uC.value.set(P.x, 2, P.z); cam.getWorldPosition(motes.uniforms.uLP.value); cam.getWorldDirection(motes.uniforms.uLD.value); motes.uniforms.uOn.value = P.lightOn ? 1 : .25; motes.uniforms.uT.value = time;
  // ambient effects: drips from leaks, sparks from broken panels, flickers
  dripT -= dt;
  for (const k of L.leaks) { if (Math.random() < dt * 8) drips.spawn(k.x + (Math.random() - .5) * .1, k.top - .1, k.z + (Math.random() - .5) * .1, 0, -1, 0, 2, .05, .9, 1.8, 2.2, .9); if (Math.random() < dt * 3) { burst(new THREE.Vector3(k.x, 0, k.z), 2, 'splash'); if (dripT <= 0) { dripT = .25; ctx.snd('drip', k.x, k.z, 14); } } }
  for (const s of L.sparkers) { s.t -= dt; if (s.t <= 0) { s.t = 1.2 + Math.random() * 3; const p = new THREE.Vector3(s.x, s.y, s.z); burst(p, 18, 'spark'); pool.flash(p, 0xffc070, 10, .15, 6); ctx.snd('spark', s.x, s.z, 18); } }
  sparks.update(dt); smoke.update(dt); drips.update(dt); bolts.update(dt); decals.update(dt); debris.update(dt);
  if (shockMesh.visible) { const t = shockMesh.userData.t += dt; shockMesh.scale.setScalar(.5 + t * 22); shockMesh.material.uniforms.uA.value = Math.max(0, 1 - t / .45); if (t > .45) shockMesh.visible = false; }
  // items / objectives idle anim
  for (const it of items) if (!it.taken) { it.mesh.rotation.y = time * 1.8 + it.base; it.mesh.position.y = .9 + Math.sin(time * 2.4 + it.base) * .1; }
  for (const o of objs) { o.mesh.holo.rotation.y = time * 2; o.mesh.holo.position.y = 1.6 + Math.sin(time * 2) * .08; o.mesh.ring.scale.setScalar(Math.max(.001, o.prog)); }
  if (L.exit && L.exit.ring) { const on = objs.every(o => o.done) && (chapter !== 1 || mode !== 'chapter' || true); L.exit.ring.material.emissive.setHex(on ? 0x40ff90 : 0xff3a30); const f = L.fixtures.find(f => f.exit); if (f) f.exitOn = on; }
  // doors
  for (const d of L.doors) {
    if (d.key && !d.unlocked && P.cards.has(d.key) && Math.hypot(d.x - P.x, d.z - P.z) < 3.2) { d.unlocked = true; SND.card(); toast('UNLOCKED', '#22c55e', 1); }
    let want = 0; if (d.unlocked) { if (Math.hypot(d.x - P.x, d.z - P.z) < 3.0) want = 1; for (const a of actors) if (!a.dead && Math.hypot(d.x - a.x, d.z - a.z) < 2.4) want = 1; }
    const prev = d.open; d.open += (want - d.open) * Math.min(1, dt * 5); if (Math.abs(want - d.open) < .01) d.open = want;
    if (prev < .05 && d.open >= .05 || prev > .95 && d.open <= .95) ctx.snd('door', d.x, d.z, 22);
    d.slab.position.y = d.Hd / 2 + d.open * (d.Hd - .15); d.light.material.emissive.setHex(d.unlocked ? 0x40ff90 : d.col);
  }
  // audio intensity
  let I = 0; for (const a of actors) { if (a.dead) continue; const d = Math.hypot(a.x - P.x, a.z - P.z); if (a.state === 'hunt' || a.state === 'attack') I = Math.max(I, 1); else if (a.state === 'investigate' || a.state === 'search') I = Math.max(I, .5); else if (a.kind === 'warden' && d < 14) I = Math.max(I, .35); }
  musicI += (I - musicI) * Math.min(1, dt * 1.5); AUD.intensity = playing ? musicI : .1;
  if (warden && playing) { const d = Math.hypot(warden.x - P.x, warden.z - P.z); heartT -= dt; if (d < 11 && warden.state !== 'stunned' && heartT <= 0) { heartT = .55 + d / 11 * .6; SND.heart(1 - d / 13); } }
  if (playing || state === 'ready') paintHudMaybe(dt);
  C.render(dt);
}
let hudAcc = 0; function paintHudMaybe(dt) { hudAcc += dt; if (state === 'play' && hudAcc > 1 / 30) { paintHud(hudAcc); hudAcc = 0; } }
function update(dt) {
  if (bot.t > 0) bot.t -= dt;
  // movement input
  let mx = 0, mz = 0, analog = 1;
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx_ = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  if (f || s) { mx = fx * f + rx_ * s; mz = fz * f + rz * s; }
  if (stick.id !== null) { const sf = -stick.dy, ss = stick.dx; mx = fx * sf + rx_ * ss; mz = fz * sf + rz * ss; analog = Math.min(1, Math.hypot(stick.dx, stick.dy)); }
  if (bot.t > 0 && (bot.mx || bot.mz)) { mx = bot.mx; mz = bot.mz; }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  P.sprint = (keys.ShiftLeft || keys.ShiftRight || (bot.t > 0 && bot.sprint) || (stick.id !== null && analog > .97 && !P.crouch)) && !P.crouch;
  const sneakAnalog = stick.id !== null && analog < .55;
  const sp = P.hidden ? 0 : P.crouch ? 1.7 : P.sprint ? 5.6 : sneakAnalog ? 1.9 : 3.6;
  const [tc, tr] = tileOf(P.x, P.z), inWater = L.at(tc, tr) === '~';
  const wsp = sp * (inWater ? .82 : 1);
  P.vx = (P.vx || 0) + (mx * wsp - (P.vx || 0)) * Math.min(1, dt * 10); P.vz = (P.vz || 0) + (mz * wsp - (P.vz || 0)) * Math.min(1, dt * 10);
  if (!P.hidden) {
    const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
    if (!blocked(L, nx, P.z, .35)) P.x = nx; else P.vx = 0;
    if (!blocked(L, P.x, nz, .35)) P.z = nz; else P.vz = 0;
    for (const a of actors) { if (a.dead) continue; const dx = P.x - a.x, dz = P.z - a.z, d = Math.hypot(dx, dz), m = .35 + a.rad; if (d < m && d > 0) { const nx2 = P.x + dx / d * (m - d), nz2 = P.z + dz / d * (m - d); if (!blocked(L, nx2, nz2, .35)) { P.x = nx2; P.z = nz2; } } }
  }
  P.speed = Math.hypot(P.vx, P.vz);
  // jump / gravity
  if (P.y > 0 || P.vy > 0) { P.vy -= 13 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; noise(P.x, P.z, inWater ? 10 : 6); SND.step(inWater, false, 0); } }
  // footsteps → noise
  P.noise = Math.max(0, P.noise - dt * 12);
  if (P.speed > .5 && P.y === 0) {
    P.bob += dt * P.speed * 2.1; P.stepT -= dt * P.speed;
    if (P.stepT <= 0) { P.stepT = 1.7; P.side = -P.side; const soft = P.crouch || sneakAnalog; const r = (P.sprint ? 13 : soft ? 2.2 : 6.5) * (inWater ? 1.7 : 1); noise(P.x, P.z, r); P.noise = Math.max(P.noise, r); SND.step(inWater, soft, P.side); if (inWater) burst(new THREE.Vector3(P.x, .1, P.z), 5, 'splash'); }
  }
  // weapon timers
  P.cool -= dt;
  if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const n = Math.min(6 - P.mag, P.reserve); P.mag += n; P.reserve -= n; drawAmmo(P.mag); debris.spawn(cam.localToWorld(new THREE.Vector3(.3, -.2, -.4)), new THREE.Vector3(Math.cos(P.yaw) * 2, 2, -Math.sin(P.yaw) * 2), 0x35e0ff, .8); } }
  if (fireHeld && P.cool <= 0) tryFire();
  if (bot.t > 0 && bot.fire && P.cool <= 0) tryFire();
  // battery
  if (P.lightOn) { P.bat = Math.max(0, P.bat - dt * (mode === 'survival' ? .9 : .45)); if (P.bat <= 0) { P.lightOn = false; toast('Lamp battery dead', '#ffd23f'); } }
  if (scanT > 0) scanT -= dt;
  // projectiles
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.t += dt; p.v.y -= 12 * dt; const np = p.p.clone().addScaledVector(p.v, dt);
    const [c2, r2] = tileOf(np.x, np.z);
    if (solidTile(L, c2, r2)) { const [c1, r1] = tileOf(p.p.x, p.p.z); if (c1 !== c2) p.v.x *= -.4; if (r1 !== r2) p.v.z *= -.4; if (!p.bounced && p.kind === 'junk') { p.bounced = true; detonate(p); } }
    else p.p.copy(np);
    if (p.p.y < .12) { p.p.y = .12; p.v.y *= -.35; p.v.x *= .6; p.v.z *= .6; if (!p.bounced && p.kind === 'junk') { p.bounced = true; detonate(p); } }
    p.mesh.position.copy(p.p); p.mesh.rotation.x += dt * 9; p.mesh.rotation.z += dt * 6;
    const nearE = p.kind === 'emp' && actors.some(a => !a.dead && Math.hypot(a.x - p.p.x, a.z - p.p.z) < 1.4);
    if ((p.kind === 'emp' && (p.t > 1.1 || nearE)) || (p.kind === 'junk' && p.t > 4)) { if (p.kind === 'emp') detonate(p); scene.remove(p.mesh); projs.splice(i, 1); }
  }
  // pickups
  for (const it of items) {
    if (it.taken) continue; if (Math.hypot(it.x - P.x, it.z - P.z) > 1.3) continue;
    const k = it.kind;
    if (k === 'B' && P.bat > 92) continue; if (k === 'H' && P.hp > 95) continue;
    it.taken = true; scene.remove(it.mesh); burst(new THREE.Vector3(it.x, 1, it.z), 16, 'confetti');
    if ('123'.includes(k)) { P.cards.add(+k); SND.card(); hudCards(); }
    else { SND.pickup(); if (k === 'B') P.bat = Math.min(100, P.bat + 50); if (k === 'P') { P.reserve += 6; } if (k === 'G') P.emp++; if (k === 'H') P.hp = Math.min(100, P.hp + 40); if (k === 'J') P.junk += 2; if (mode === 'survival') cellsTaken++; }
    toast('+ ' + ITEM[k].name, '#' + new THREE.Color(ITEM[k].col).getHexString(), 1.2);
    if (mode === 'survival') { const keep = it; setTimeout(() => { if (mode === 'survival' && items.includes(keep)) { keep.taken = false; scene.add(keep.mesh); } }, 25000); }
  }
  // interaction
  focus = findFocus();
  const holding = useHeld || (bot.t > 0 && bot.use);
  if (focus && focus.kind === 'obj' && holding) {
    const o = focus.ref; o.prog += dt / 1.6; P.useHold += dt; if (P.useHold > .4) { P.useHold = 0; SND.valve(); noise(o.x, o.z, 11); }
    if (o.prog >= 1) { o.done = true; o.prog = 1; SND.done(); burst(new THREE.Vector3(o.x, 1.6, o.z), 40, 'confetti'); o.mesh.holo.visible = false; o.mesh.beam.visible = false; toast(CHAPTERS[chapter - 1].objVerb + ' ✓', '#22c55e'); noise(o.x, o.z, 16); }
  }
  // exit
  if (mode === 'chapter' && L.exit && objs.every(o => o.done) && Math.hypot(L.exit.x - P.x, L.exit.z - P.z) < 1.2) { if (chapter !== 1 || true) win(); }
  // actors
  const vis = { x: P.x, z: P.z, hidden: P.hidden, lightOn: P.lightOn, crouch: P.crouch || sneakAnalog, inDark: false, hidAt: P.hidAt };
  ctx.P = vis;
  for (const n of noises) for (const a of actors) if (!a.dead) a.hear(n);
  noises.length = 0;
  for (const a of actors) a.update(dt, vis);
  separate(actors.filter(a => !a.dead), dt);
  // survival director: waves, blackouts
  if (mode === 'survival') {
    score = survivalScore();
    if (D.beaten(score) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 40, 30); burst(new THREE.Vector3(P.x, 1.5, P.z), 60, 'confetti'); }
    nextWave -= dt;
    if (nextWave <= 0) { nextWave = Math.max(12, 24 - spawnN); spawnN++; const alive = actors.filter(a => !a.dead && a.kind === 'mender').length;
      if (alive < 4 + Math.min(4, spawnN / 2)) { for (let k = 0; k < 40; k++) { const cc = (Math.random() * L.w) | 0, rr = (Math.random() * L.h) | 0; if (solidTile(L, cc, rr) || L.at(cc, rr) === '#') continue; const x = cc * T, z = rr * T; if (Math.hypot(x - P.x, z - P.z) < 14 || los(L, P.x, P.z, x, z)) continue; actors.push(new Mender(ctx, x, z)); toast('Something woke up…', '#ff9a3d', 1.4); break; } } }
    if (blackout > 0) { blackout -= dt; hemi.intensity = .35; if (blackout <= 0) toast('Power restored', '#22c55e'); }
    else { hemi.intensity = .65; if (Math.random() < dt / 45 && runT > 25) { blackout = 9; toast('BLACKOUT!', '#ff3d5a', 2); SND.deny(); } }
  }
  goalT -= dt; if (goalT <= 0) { goalT = .5; goalCache = nextGoal(); }
}

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state === 'caught' ? 'play' : state; },
  get level() { return mode === 'survival' ? 0 : chapter; },
  get score() { return state === 'won' || mode === 'survival' ? score : Math.max(0, kills * 50 + logsRead * 75 + objs.filter(o => o.done).length * 100); },
  get fps() { return Math.round(fps); },
  get calls() { return R.info.render.calls; },
  bot: botTick,
  dbg: () => ({ P: { x: P.x, z: P.z, hp: P.hp, mag: P.mag }, actors: actors.map(a => [a.kind, a.state, a.x | 0, a.z | 0]), goal: goalCache && goalCache.kind }),
};

// boot: attract scene behind the menu
paintMenu(); setupRun('chapter', Math.min(5, st.get('ch', 1)), 1);
if (Q.has('ch')) { setTimeout(() => { startRun('chapter', +Q.get('ch'), 1); if (Q.has('shot')) { const v = Q.get('shot').split(',').map(Number); Object.assign(P, { x: v[0], z: v[1], yaw: v[2], pitch: v[3] }); if (v.length > 4 && warden) { warden.x = v[4]; warden.z = v[5]; warden.state = 'search'; warden.t = 99; } if (v.length > 6 && actors[0]) { actors[0].x = v[6]; actors[0].z = v[7]; actors[0].state = 'hunt'; } window.__freeze = 1; } }, 300); }
else if (Q.has('surv')) { setTimeout(() => startRun('survival', 1, 7), 300); }
requestAnimationFrame(frame);

// Liftoff Lab — a toy space program run by your AI agents. Original RIFFCADE game; every model is drawn in code.
// Agents are the ground crew: tokens pump fuel, edits stack rocket parts, runs fire engine tests, passing tests
// call "GO", a commit launches, a deploy pushes your probe on to the next world. You are flight director.
import { THREE, createStage, loop, burst, confetti, tone, stickman, mat, glossy, rounded, lerp, clamp, rng } from './kit/hc.js';
import { agents, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';

const V3 = THREE.Vector3, $ = id => document.getElementById(id);
const portrait = () => innerWidth / innerHeight < 0.8;
const COLORS = ['#ff5d5d', '#3a86ff', '#ffbe0b', '#8f5bff', '#06d6a0', '#ff6fc8', '#ff8c42', '#00c2e0', '#9be15d', '#b07cff'];
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const ymd = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));

// ------------------------------------------------------------------ the worlds and the rockets
const PLANETS = [
  { name: 'Home Orbit', kind: 'low orbit', req: 0, sci: 4, c1: '#3d8bff', c2: '#5fd17a', c3: '#ffffff', seed: 3 },
  { name: 'Pebble Moon', kind: 'the moon', req: 22, sci: 10, c1: '#bdbacb', c2: '#8d8a9c', c3: '#e2dfea', seed: 5, craters: 1 },
  { name: 'Rust Rock', kind: 'the red planet', req: 42, sci: 22, c1: '#e2643a', c2: '#a83b22', c3: '#f6a774', seed: 8 },
  { name: 'Halo', kind: 'the ringed planet', req: 68, sci: 40, c1: '#e8c37e', c2: '#c4904c', c3: '#fff1cf', seed: 11, bands: 1, ring: '#f4dfae' },
  { name: 'Frostbite', kind: 'the ice moon', req: 98, sci: 65, c1: '#d4f2ff', c2: '#8fd3f5', c3: '#ffffff', seed: 13, craters: 1 },
  { name: 'Big Marble', kind: 'the gas giant', req: 138, sci: 100, c1: '#7c6cf0', c2: '#4fd1c5', c3: '#c7b8ff', seed: 17, bands: 1, ring: '#b9a7ff' },
  { name: 'The Far Dark', kind: 'the edge of the map', req: 190, sci: 160, c1: '#22265a', c2: '#6b3fd4', c3: '#3cf0ff', seed: 19, ring: '#3cf0ff' },
];
const TIERS = [{ parts: 6, mult: 1, fuel: 20000, name: 'Mk I' }, { parts: 9, mult: 1.25, fuel: 30000, name: 'Mk II' }, { parts: 12, mult: 1.5, fuel: 40000, name: 'Mk III' }, { parts: 15, mult: 1.8, fuel: 52000, name: 'Mk IV' }];
const MIN_PARTS = 3, PART_H = 0.6, MOUNT = 1.15, MAX_PADS = 6;
const PAD_PRICE = [0, 0, 40, 90, 180, 320];
const TIER_PRICE = [60, 160, 400];
const DECOS = [
  { id: 'windsock', name: 'Windsock', price: 15, about: 'Shows which way the wind blows. Purely for vibes.' },
  { id: 'flag', name: 'Mission flag', price: 20, about: 'A big orange flag with your lab badge.' },
  { id: 'palms', name: 'Palm grove', price: 25, about: 'Every good launch coast has palm trees.' },
  { id: 'flood', name: 'Floodlights', price: 35, about: 'Light towers that blaze at every launch.' },
  { id: 'tower', name: 'Water tower', price: 50, about: 'Sound suppression water for the pads. Soaks the steam clouds.' },
  { id: 'radar', name: 'Radar dish', price: 70, about: 'A spinning dish that tracks every flight.' },
  { id: 'stands', name: 'Grandstand', price: 110, about: 'A crowd that jumps when a rocket lifts off.' },
  { id: 'hangar', name: 'Assembly hangar', price: 180, about: 'A giant striped hangar. The lab looks official now.' },
];
const reachOf = (st, tier) => {
  const T = TIERS[tier];
  return (st.parts.length * 4 + Math.min(1, st.fuel / T.fuel) * 20) * T.mult * (st.go ? 1.1 : 1);
};
const planetFor = reach => { let i = 0; PLANETS.forEach((p, k) => { if (reach >= p.req) i = k; }); return i; };

// ------------------------------------------------------------------ save (real) and a sandbox for the demo team
const SAVE = 'liftoff_lab_v1';
const newDay = () => ({ date: ymd(), launches: [], parts: 0, fuel: 0, tests: 0, gos: 0, reworks: 0, commits: 0, deploys: 0, sci: 0, agents: {}, peak: 0, best: 0 });
const fresh = () => ({ rocketFar: 0, sci: 0, sciTotal: 0, pads: 2, tier: 0, deco: [], visited: [0], probe: 0, launches: 0, best: { acc: 0, reach: 0 }, streak: { last: '', n: 0 }, padState: [], today: newDay() });
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.pads) return Object.assign(fresh(), s); } catch (e) {} return fresh(); }
const real = load();
let S = real, mode = 'live';
let saveT = 0;
function save() { if (S !== real) return; clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(SAVE, JSON.stringify(real)); } catch (e) {} }, 300); }
function day() { if (S.today.date !== ymd()) S.today = newDay(); return S.today; }
const demoState = () => Object.assign(fresh(), { pads: 4, sci: 85, tier: 1, deco: ['windsock', 'flag', 'palms', 'flood', 'radar'], visited: [0, 1, 2], probe: 2, rocketFar: 2, padState: [5, 3, 6, 2].map((n, i) => ({ parts: Array.from({ length: n }, (_, k) => COLORS[(i * 3 + (k > n / 2 ? 1 : 0)) % COLORS.length]), fuel: 6000 + i * 5000, go: i === 2, clear: false })) });
function padSt(i) { while (S.padState.length < S.pads) S.padState.push({ parts: [], fuel: 0, go: false, clear: false }); return S.padState[i]; }

// ------------------------------------------------------------------ stage, sky, ground
const st = createStage({ fov: 48, shadows: true, shadowSize: 30, clear: '#16204a' });
const { scene, camera, renderer, sun, hemi } = st;
camera.far = 900; camera.updateProjectionMatrix();
hemi.color.set('#e4f1ff'); hemi.groundColor.set('#ffe0c0'); hemi.intensity = 1.05;
sun.color.set('#fff2dc'); sun.intensity = 1.9; sun.position.set(14, 26, 18);
sun.shadow.camera.far = 120; sun.shadow.camera.updateProjectionMatrix();

const skyU = { top: { value: new THREE.Color('#3f8df5') }, hor: { value: new THREE.Color('#ffd9a6') }, bot: { value: new THREE.Color('#ffe9c8') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(hor, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.7)) : mix(hor, bot, clamp(-h * 4.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
}));
sky.renderOrder = -10; scene.add(sky);
const SKY_DAY = [new THREE.Color('#3f8df5'), new THREE.Color('#ffd9a6'), new THREE.Color('#ffe9c8')];
const SKY_SPACE = [new THREE.Color('#03040e'), new THREE.Color('#1a1546'), new THREE.Color('#0b0b26')];
const starGeo = new THREE.BufferGeometry(), sp = [];
{ const r = rng(42); for (let i = 0; i < 1400; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); sp.push(Math.cos(a) * s * 500, u * 500, Math.sin(a) * s * 500); } }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
scene.add(stars);
function setSky(a) {
  skyU.top.value.copy(SKY_DAY[0]).lerp(SKY_SPACE[0], a); skyU.hor.value.copy(SKY_DAY[1]).lerp(SKY_SPACE[1], a); skyU.bot.value.copy(SKY_DAY[2]).lerp(SKY_SPACE[2], a);
  stars.material.opacity = smooth(0.35, 0.85, a);
  hemi.intensity = lerp(1.05, 0.7, a);
}

const world = new THREE.Group(); scene.add(world);
const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 64), mat('#86cf6a'));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
const sea = new THREE.Mesh(new THREE.CircleGeometry(700, 48), mat('#3aa6e0', { roughness: 0.25 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -0.4; world.add(sea);
const beach = new THREE.Mesh(new THREE.RingGeometry(150, 158, 64), mat('#ffe2a8'));
beach.rotation.x = -Math.PI / 2; beach.position.y = -0.15; world.add(beach);
const apron = new THREE.Mesh(rounded(64, 0.3, 17, 0.12), mat('#e7e1d6'));
apron.position.set(0, 0.05, -2.5); apron.receiveShadow = true; world.add(apron);
// hills, trees, clouds, a pale ringed planet in the daytime sky
{
  const r = rng(7), hm = [mat('#6cbf5a'), mat('#5bb04f'), mat('#7fd06b')];
  for (let i = 0; i < 22; i++) {
    const a = Math.PI * (0.05 + r() * 0.9), d = 75 + r() * 60, s = 8 + r() * 16;
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), hm[i % 3]);
    h.scale.set(s * 1.6, s * (0.5 + r() * 0.6), s); h.position.set(Math.cos(a) * d * 1.6, -s * 0.15, -Math.sin(a) * d); world.add(h);
  }
  const tm = mat('#3f9c4e'), trunk = mat('#9a6a45');
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 120, z = -18 - r() * 40; if (Math.abs(x) < 34 && z > -24) continue;
    const t = new THREE.Group(); const c = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 8), tm); c.position.y = 2; c.castShadow = true;
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1, 6), trunk); k.position.y = 0.5; t.add(c, k); t.position.set(x, 0, z); t.scale.setScalar(0.8 + r() * 0.8); world.add(t);
  }
}
const cloudMat = mat('#ffffff', { roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.25 });
const clouds = [];
{
  const r = rng(11);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(); const n = 4 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), cloudMat); b.scale.setScalar(2 + r() * 2.5); b.position.set(k * 2.6 - n * 1.3, r() * 1.4, r() * 2); c.add(b); }
    c.position.set((r() - 0.5) * 200, 28 + r() * 22, -80 - r() * 80); c.userData.v = 0.6 + r() * 0.8; world.add(c); clouds.push(c);
  }
}
function planetTexture(p) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), r = rng(p.seed * 97);
  g.fillStyle = p.c1; g.fillRect(0, 0, 512, 256);
  if (p.bands) for (let i = 0; i < 22; i++) { g.globalAlpha = 0.3 + r() * 0.5; g.fillStyle = i % 2 ? p.c2 : p.c3; g.fillRect(0, r() * 256, 512, 4 + r() * 22); }
  else for (let i = 0; i < 70; i++) { g.globalAlpha = 0.25 + r() * 0.5; g.fillStyle = r() < 0.5 ? p.c2 : p.c3; g.beginPath(); g.ellipse(r() * 512, 20 + r() * 216, 6 + r() * 34, 4 + r() * 22, 0, 0, 7); g.fill(); }
  if (p.craters) for (let i = 0; i < 40; i++) { g.globalAlpha = 0.35; g.strokeStyle = p.c2; g.lineWidth = 3; g.beginPath(); g.arc(r() * 512, 20 + r() * 216, 3 + r() * 12, 0, 7); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makePlanet(p, radius) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 0.8, emissive: p.c1, emissiveIntensity: 0.18 }));
  g.add(s); g.ball = s;
  if (p.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * 2.1, 64), new THREE.MeshBasicMaterial({ color: p.ring, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })); rg.rotation.x = Math.PI / 2.4; rg.rotation.y = 0.3; g.add(rg); }
  return g;
}
const skyPlanet = makePlanet({ ...PLANETS[3], c1: '#f1dcff', c2: '#d6b8f5', c3: '#fff', ring: '#ffffff' }, 9);
skyPlanet.position.set(-90, 95, -300); skyPlanet.children.forEach(m => { m.material.transparent = true; m.material.opacity = 0.55; }); world.add(skyPlanet);
const skyMoon = makePlanet({ ...PLANETS[1] }, 5); skyMoon.position.set(110, 120, -320); skyMoon.ball.material.transparent = true; skyMoon.ball.material.opacity = 0.6; world.add(skyMoon);

// ------------------------------------------------------------------ particles (pooled soft sprites: flame, steam, smoke)
function softTex(lumpy) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const blob = (x, y, r0) => { const gr = g.createRadialGradient(x, y, 0, x, y, r0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r0, 0, 7); g.fill(); };
  if (lumpy) { blob(26, 34, 20); blob(40, 30, 18); blob(32, 24, 16); } else blob(32, 32, 32);
  return new THREE.CanvasTexture(c);
}
const DOT = softTex(false), PUFF = softTex(true);
const P = [];
for (let i = 0; i < 1400; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, transparent: true, depthWrite: false })); m.visible = false; m.renderOrder = 2; scene.add(m); P.push({ m, v: new V3(), c0: new THREE.Color(), c1: new THREE.Color() }); }
let pi = 0;
function emit(pos, o) {
  const p = P[pi = (pi + 1) % P.length];
  p.m.visible = true; p.m.position.copy(pos); if (o.v) p.v.copy(o.v); else p.v.set(0, 0, 0);
  p.age = 0; p.life = o.life || 1; p.s0 = o.size || 1; p.s1 = o.grow != null ? o.grow : p.s0; p.drag = o.drag != null ? o.drag : 0.97; p.up = o.up || 0; p.a = o.alpha != null ? o.alpha : 1; p.fade = o.fadeIn || 0;
  p.c0.set(o.c0 || '#ffffff'); p.c1.set(o.c1 || o.c0 || '#ffffff');
  p.m.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending; p.m.material.map = o.puff ? PUFF : DOT;
  p.m.material.rotation = Math.random() * 6;
}
function updateP(s) {
  for (const p of P) {
    if (!p.m.visible) continue;
    p.age += s; const t = p.age / p.life; if (t >= 1) { p.m.visible = false; continue; }
    p.m.position.addScaledVector(p.v, s); p.v.multiplyScalar(Math.pow(p.drag, s * 60)); p.v.y += p.up * s;
    p.m.scale.setScalar(lerp(p.s0, p.s1, Math.sqrt(t)));
    p.m.material.color.copy(p.c0).lerp(p.c1, t);
    p.m.material.opacity = p.a * Math.pow(1 - t, 1.3) * (p.fade ? Math.min(1, t / p.fade) : 1);
  }
}
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;
function flame(pos, k = 1, down = 1) {
  emit(pos.clone().add(new V3(rnd(0.15), 0, rnd(0.15))), { v: new V3(rnd(0.6), -6 * down * k, rnd(0.6)), life: 0.35 + Math.random() * 0.2, size: 0.9 * k, grow: 0.35 * k, c0: '#fff6c0', c1: '#ff3d12', add: true, drag: 0.94 });
}
function smoke(pos, o = {}) {
  emit(pos.clone().add(new V3(rnd(0.4), rnd(0.2), rnd(0.4))), { v: o.v || new V3(rnd(1.5), 1 + Math.random(), rnd(1.5)), life: o.life || 2.4, size: o.size || 1.2, grow: o.grow || 4, c0: o.c0 || '#ffffff', c1: o.c1 || '#c9c7d6', puff: true, up: o.up != null ? o.up : 0.3, drag: o.drag || 0.95, alpha: o.alpha || 0.9, fadeIn: 0.08 });
}
function sparks(pos, color = '#ffd23f', n = 10) {
  for (let i = 0; i < n; i++) emit(pos, { v: new V3(rnd(4), 1 + Math.random() * 4, rnd(4)), life: 0.5, size: 0.25, grow: 0.05, c0: '#ffffff', c1: color, add: true, up: -9, drag: 0.97 });
}

// ------------------------------------------------------------------ label sprites
function label(text, color, { w = 2.4, size = 58, fg = '#fff' } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.font = `700 ${size}px Fredoka, system-ui, sans-serif`; const tw = Math.min(480, g.measureText(text).width + 56), x = (512 - tw) / 2;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(x, 18, tw, 96, 40); g.fill();
  g.fillStyle = color; g.beginPath(); g.roundRect(x, 10, tw, 96, 40); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 60, 440);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(w, w / 4, 1); s.renderOrder = 20; return s;
}

// ------------------------------------------------------------------ models: gantry, tank, rocket, pad
const M = { red: mat('#ef4b3c'), white: mat('#f6f2ea'), steel: mat('#5d6478', { metalness: 0.4, roughness: 0.35 }), dark: mat('#2c3044'), concrete: mat('#d6d0c6'), hazard: null, yellow: mat('#ffc83d') };
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 16; const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2b2b2b' : '#ffcc2e'; g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 16, 0); g.lineTo(i * 16 + 8, 16); g.lineTo(i * 16 - 8, 16); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace;
  M.hazard = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}
const G = { post: new THREE.BoxGeometry(0.11, 1.2, 0.11), bar: new THREE.BoxGeometry(1.0, 0.08, 0.08), diag: new THREE.BoxGeometry(0.06, 1.56, 0.06) };
const cast = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
function makeGantry(h) {
  const g = new THREE.Group(), w = 1.0, L = Math.ceil(h / 1.2);
  for (let l = 0; l < L; l++) {
    const m = l % 2 ? M.white : M.red, y = l * 1.2 + 0.6;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(G.post, m); p.position.set(x * w / 2, y, z * w / 2); g.add(p); }
    for (const [x, z, r] of [[0, -1, 0], [0, 1, 0], [-1, 0, 1], [1, 0, 1]]) { const b = new THREE.Mesh(G.bar, M.white); b.position.set(x * w / 2, y + 0.6, z * w / 2); b.rotation.y = r * Math.PI / 2; g.add(b); }
    const d = new THREE.Mesh(G.diag, M.steel); d.position.set(0, y, w / 2); d.rotation.z = (l % 2 ? 1 : -1) * 0.69; g.add(d);
    const d2 = new THREE.Mesh(G.diag, M.steel); d2.position.set(w / 2, y, 0); d2.rotation.x = (l % 2 ? 1 : -1) * 0.69; g.add(d2);
  }
  const top = L * 1.2;
  const deck = new THREE.Mesh(rounded(1.5, 0.16, 1.5, 0.05), M.steel); deck.position.y = top; g.add(deck);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), M.yellow); jib.position.set(-0.95, top + 0.35, 0); g.add(jib);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), M.dark); cable.position.set(-2.1, top - 0.2, 0); g.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), M.yellow); hook.position.set(-2.1, top - 0.75, 0); g.add(hook);
  g.hook = hook; g.cable = cable;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff2020', emissiveIntensity: 2 }));
  beacon.position.y = top + 0.3; g.add(beacon); g.beacon = beacon;
  // swing arms that reach the rocket and swing away at launch
  g.arms = [];
  for (const f of [0.45, 0.78]) {
    const piv = new THREE.Group(); piv.position.set(-0.5, Math.max(1.6, h * f), 0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), M.steel); a.position.x = -0.55; piv.add(a); g.add(piv); g.arms.push(piv);
  }
  const car = new THREE.Mesh(rounded(0.7, 0.55, 0.7, 0.06), M.yellow); car.position.set(0, 1, 0); g.add(car); g.car = car;
  g.top = top;
  return cast(g);
}
function makeTank() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 2.4, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.32, roughness: 0.1, side: THREE.DoubleSide }));
  shell.position.y = 1.6;
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 2.36, 24), new THREE.MeshStandardMaterial({ color: '#36c8ff', emissive: '#1aa6ff', emissiveIntensity: 0.45, roughness: 0.3 }));
  liq.geometry.translate(0, 1.18, 0); liq.position.y = 0.42; liq.scale.y = 0.001;
  const capT = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white); capT.position.y = 2.8;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 0.4, 24), M.white); base.position.y = 0.2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.06, 6, 24), M.red); ring.rotation.x = Math.PI / 2; ring.position.y = 1.6;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), M.steel); pipe.rotation.z = Math.PI / 2; pipe.position.set(0.95, 0.6, 0);
  g.add(shell, liq, capT, base, ring, pipe); g.liq = liq; g.shell = shell; cast(g); shell.castShadow = false;
  return g;
}
const PART_GEO = new THREE.CylinderGeometry(0.5, 0.5, PART_H - 0.04, 28), BAND_GEO = new THREE.CylinderGeometry(0.525, 0.525, 0.07, 28), WIN_GEO = new THREE.CircleGeometry(0.13, 16);
const partMats = new Map(); const partMat = c => partMats.get(c) || (partMats.set(c, glossy(c)), partMats.get(c));
const WIN_M = new THREE.MeshStandardMaterial({ color: '#1c2a4f', emissive: '#5ad0ff', emissiveIntensity: 0.5, roughness: 0.1 });
function makePart(color, i) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(PART_GEO, i % 3 === 1 ? M.white : partMat(color)); body.position.y = PART_H / 2;
  const band = new THREE.Mesh(BAND_GEO, i % 3 === 1 ? partMat(color) : M.white); band.position.y = PART_H - 0.03;
  g.add(body, band);
  if (i % 3 === 2) { const w = new THREE.Mesh(WIN_GEO, WIN_M); w.position.set(0, PART_H / 2, 0.505); g.add(w); }
  return cast(g);
}
class Rocket {
  constructor() {
    this.g = new THREE.Group(); this.stack = new THREE.Group(); this.g.add(this.stack); this.parts = [];
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.44, 0.5, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#3a3f55', metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }));
    bell.position.y = -0.25; this.bell = bell;
    this.fins = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.55, -0.15); s.lineTo(0.55, 0.15); s.lineTo(0, 0.9); s.lineTo(0, 0);
      const f = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }), partMat('#ef4b3c'));
      const piv = new THREE.Group(); f.position.set(0.42, 0, -0.035); piv.add(f); piv.rotation.y = k * Math.PI / 2 + Math.PI / 4; this.fins.add(piv);
    }
    this.fins.add(bell);
    this.nose = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 28), M.white); cone.position.y = 0.55;
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), partMat('#ef4b3c')); this.tip.position.y = 1.1;
    this.nose.add(cone, this.tip);
    this.stack.add(this.fins, this.nose); cast(this.g);
    this.noseY = 0; this.layout();
  }
  get height() { return this.parts.length * PART_H; }
  add(color, drop = false) {
    const p = makePart(color, this.parts.length); p.userData.color = color; p.position.y = this.height; this.stack.add(p); this.parts.push(p);
    this.fins.children[0].children[0].material = partMat(this.parts[0].userData.color);
    if (drop) { p.userData.drop = 1; p.position.y += 3.2; }
    this.layout(drop); return p;
  }
  clear() { for (const p of this.parts) this.stack.remove(p); this.parts = []; this.layout(); }
  layout(anim) { const has = this.parts.length > 0; this.fins.visible = has; this.nose.visible = has; this.noseTarget = this.height; if (!anim) this.nose.position.y = this.noseTarget; if (has) this.tip.material = partMat(this.parts[this.parts.length - 1].userData.color); }
  update(s) {
    this.nose.position.y = lerp(this.nose.position.y, this.noseTarget, 1 - Math.pow(0.001, s));
    let landed = null;
    this.parts.forEach((p, i) => {
      const y0 = i * PART_H;
      if (p.userData.drop) { p.position.y = Math.max(y0, p.position.y - s * 9); if (p.position.y <= y0) { p.userData.drop = 0; p.userData.sq = 1; landed = p; } }
      if (p.userData.sq) { p.userData.sq = Math.max(0, p.userData.sq - s * 4); const q = Math.sin(p.userData.sq * Math.PI) * 0.25; p.scale.set(1 + q, 1 - q, 1 + q); }
    });
    return landed;
  }
}

// pads
const pads = [];
// the rival's launch site in a live duel (null rival = the solo game, unchanged)
const RVR = { r: null, key: null, pad: null, crew: new Map(), me: 0, them: 0, flying: [], syncT: 0, dirty: true, status: '' };
function makePad(i) {
  const pad = { i, g: new THREE.Group(), rocket: new Rocket(), crew: [], color: COLORS[i % COLORS.length], shake: 0, test: 0, arms: 0 };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.55, 8), M.concrete); base.position.y = 0.27; base.receiveShadow = true; base.castShadow = true;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.72, 2.72, 0.12, 8, 1, true), M.hazard); ring.position.y = 0.5;
  const trench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 4.2), M.dark); trench.position.set(0, 0.56, -0.6);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#4a5068', metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide })); mount.position.y = 0.85;
  pad.g.add(base, ring, trench, mount);
  pad.rocket.g.position.set(0, MOUNT + 0.02, 0); pad.g.add(pad.rocket.g);
  pad.gantry = makeGantry(TIERS[S.tier].parts * PART_H + 3); pad.gantry.position.set(1.75, 0.55, -0.15); pad.g.add(pad.gantry);
  pad.tank = makeTank(); pad.tank.position.set(-2.25, 0.55, -0.5); pad.g.add(pad.tank);
  // status lamps
  pad.lamps = ['#ff4040', '#ffb020', '#30e090'].map((c, k) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1 })); l.position.set(-1.1 + k * 0.32, 0.72, 2.45); pad.g.add(l); return l; });
  const lp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.2), M.dark); lp.position.set(-0.78, 0.62, 2.48); pad.g.add(lp);
  pad.sign = label('PAD ' + (i + 1), '#2c3044', { w: 1.5 }); pad.sign.position.set(0, 0.3, 3.2); pad.g.add(pad.sign);
  pad.hit = new THREE.Mesh(new THREE.BoxGeometry(6.2, 12, 6.2), new THREE.MeshBasicMaterial({ visible: false })); pad.hit.position.y = 5; pad.hit.userData.pad = i; pad.g.add(pad.hit);
  pad.statusTag = null;
  world.add(pad.g);
  const ps = padSt(i); for (const c of ps.parts) pad.rocket.add(c);
  return pad;
}
function buildPads() {
  for (const p of pads) world.remove(p.g);
  pads.length = 0;
  for (let i = 0; i < S.pads; i++) pads.push(makePad(i));
  layout();
  for (const a of crew.values()) { a.pad = null; assign(a); }
  buildDecos();
}
let home = { pos: new V3(0, 10, 30), look: new V3(0, 4, 0) }, span = 20;
function layout() {
  const items = (RVR.pad ? [RVR.pad] : []).concat(pads);
  const n = items.length, cols = portrait() ? Math.min(2, n) : n, rows = Math.ceil(n / cols), dx = RVR.pad ? 7.8 : 7.4, dz = 9;
  items.forEach((p, i) => { const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols); p.g.position.set((c - (inRow - 1) / 2) * dx + (rows > 1 && r % 2 ? 0 : 0), 0, -r * dz + (rows - 1) * dz * 0.5); });
  span = (cols - 1) * dx + 8.5 + (RVR.pad ? 4.5 : 0);
  const vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const tall = 13 + (rows - 1) * 4.5 + (RVR.pad ? 2 : 0), dW = (span / 2) / Math.tan(hfov / 2), dH = (tall / 2) / Math.tan(vfov / 2), d = Math.max(dW, dH) * 0.9 + 2;
  const cz = 0;
  home = { pos: new V3(0, 2.5 + d * (rows > 1 ? 0.3 : 0.2) + (rows - 1) * 3, cz + d), look: new V3(0, (rows > 1 ? 3.4 : 4.6) + (rows - 1) * 0.4, cz - (rows - 1) * 2) };
  sun.shadow.camera.left = -span - 6; sun.shadow.camera.right = span + 6; sun.shadow.camera.updateProjectionMatrix();
}

// decorations
const decoG = new THREE.Group(); world.add(decoG);
const decoAnim = {};
function buildDecos() {
  decoG.clear(); for (const k in decoAnim) delete decoAnim[k];
  const X = span / 2 + 4.5, has = id => S.deco.includes(id);
  if (has('windsock')) {
    const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), M.white); pole.position.y = 2;
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#ff7a2f', side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2; sock.position.set(0.8, 3.7, 0);
    g.add(pole, sock); g.position.set(-X, 0, 4); decoG.add(cast(g)); decoAnim.sock = sock;
  }
  if (has('flag')) {
    const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), M.white); pole.position.y = 3;
    const fg = new THREE.PlaneGeometry(2.2, 1.3, 12, 1); fg.translate(1.1, 0, 0);
    const c = document.createElement('canvas'); c.width = 256; c.height = 150; const x = c.getContext('2d'); x.fillStyle = '#ff7a2f'; x.fillRect(0, 0, 256, 150); x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 75, 46, 0, 7); x.fill(); x.fillStyle = '#ff7a2f'; x.beginPath(); x.moveTo(128, 40); x.lineTo(146, 100); x.lineTo(110, 100); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); f.position.y = 5.2; g.add(pole, f); g.position.set(X + 1, 0, 3.5); decoG.add(cast(g)); decoAnim.flag = f;
  }
  if (has('palms')) for (const [x, z] of [[-X - 3, 7], [X + 3.5, 7.5], [-X - 1, 10], [X + 1.5, 10.5], [-X + 1, 12]]) {
    const g = new THREE.Group(); let y = 0;
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.55, 8), mat('#b07a4a')); s.position.set(k * 0.06, y + 0.27, 0); y += 0.52; g.add(s); }
    for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.1, 4), mat('#3cb562')); l.position.set(0.35, y, 0); l.rotation.z = -1.25; const pv = new THREE.Group(); pv.add(l); pv.position.set(0.3, 0, 0); pv.rotation.y = k * Math.PI / 3; g.add(pv); }
    g.position.set(x, 0, z); decoG.add(cast(g));
  }
  if (has('flood')) { decoAnim.lights = []; for (const sx of [-1, 1]) {
    const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 8, 8), M.steel); pole.position.y = 4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.3), new THREE.MeshStandardMaterial({ color: '#fffbe0', emissive: '#fff1a0', emissiveIntensity: 0.5 })); head.position.set(0, 8.2, 0.1);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#fff3b0', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.set(3.5, 3.5, 1); glow.position.set(0, 8.2, 0.5);
    g.add(pole, head, glow); g.position.set(sx * (X - 1), 0, -5); g.rotation.y = -sx * 0.4; decoG.add(cast(g)); decoAnim.lights.push({ head, glow });
  } }
  if (has('tower')) {
    const g = new THREE.Group(); for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), M.steel); l.position.set(x, 3, z); g.add(l); }
    const t = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), M.white); t.scale.y = 0.8; t.position.y = 7.2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.4, 24), M.red); b.position.y = 7.2;
    g.add(t, b); g.position.set(-X - 4, 0, -6); decoG.add(cast(g));
  }
  if (has('radar')) {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.6, 12), M.white); b.position.y = 0.8;
    const pv = new THREE.Group(); pv.position.y = 1.9;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 3.2), new THREE.MeshStandardMaterial({ color: '#f4f6ff', side: THREE.DoubleSide, metalness: 0.2 })); dish.rotation.x = -Math.PI / 2 + 0.5; dish.position.z = 0.4;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), M.steel); ant.rotation.x = Math.PI / 2 - 0.5; ant.position.set(0, 0.5, 0.9);
    pv.add(dish, ant); g.add(b, pv); g.position.set(X + 4, 0, -6); decoG.add(cast(g)); decoAnim.radar = pv;
  }
  if (has('stands')) {
    const g = new THREE.Group(); const r = rng(4);
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 1), k % 2 ? M.white : mat('#3a86ff')); s.position.set(0, 0.25 + k * 0.5, -k * 0.9); s.scale.y = 1 + k; s.position.y = (1 + k) * 0.25; g.add(s); }
    decoAnim.crowd = [];
    for (let k = 0; k < 24; k++) { const row = k % 3; const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(COLORS[(r() * COLORS.length) | 0])); m.position.set(-3 + (k / 3 | 0) * 0.85 + r() * 0.2, (1 + row) * 0.5 + 0.2, -row * 0.9); m.userData.y = m.position.y; g.add(m); decoAnim.crowd.push(m); }
    g.position.set(0, 0, 14.5); g.rotation.y = Math.PI; decoG.add(cast(g));
  }
  if (has('hangar')) {
    const g = new THREE.Group(); const b = new THREE.Mesh(rounded(10, 9, 7, 0.3), M.white); b.position.y = 4.5;
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(10.05, 1.2, 7.05), M.red); s1.position.y = 7.5;
    const door = new THREE.Mesh(new THREE.BoxGeometry(5, 6.5, 0.2), mat('#5d6478')); door.position.set(0, 3.25, 3.55);
    g.add(b, s1, door); g.position.set(-X - 9, 0, -14); decoG.add(cast(g));
  }
}

// ------------------------------------------------------------------ crew (agents)
const crew = new Map();
let colorIx = 0;
function engineer(color, label_) {
  const g = stickman(color, '#ffd7ba', 0.9);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffffff')); hat.position.y = 1.56;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16), mat('#ffffff')); brim.position.y = 1.56;
  g.add(hat, brim); cast(g);
  const tag = label(label_, color, { w: 2.9 }); tag.position.y = 2.35; g.add(tag); g.tag = tag;
  return g;
}
function bot(color) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(rounded(0.45, 0.4, 0.4, 0.1), glossy(color));
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: '#10142a', emissive: '#5ad0ff', emissiveIntensity: 0.9 })); v.position.set(0, 0.04, 0.21);
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 4), M.steel); a.position.y = 0.32;
  const ab = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 1.5 })); ab.position.y = 0.46;
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.06), M.dark); prop.position.y = 0.48;
  g.add(b, v, a, ab, prop); g.prop = prop; return cast(g);
}
function ensure(e) {
  let a = crew.get(e.agent);
  if (a) return a;
  if (e.parent && !crew.get(e.parent)) ensure({ agent: e.parent, label: e.label, src: e.src });
  a = { id: e.agent, parent: e.parent || null, label: e.label || 'agent', last: e.t || Date.now(), color: COLORS[(hash(e.agent) + colorIx++) % COLORS.length], state: 'idle', st: 0, wave: 0, pad: null, slot: 0, bob: Math.random() * 6 };
  if (!a.parent) { a.m = engineer(a.color, a.label); a.m.position.set(0, 0.55, 8); }
  else { const p = crew.get(a.parent); a.color = p ? p.color : a.color; a.m = bot(a.color); a.m.scale.setScalar(1.1); }
  world.add(a.m); crew.set(a.id, a); assign(a);
  if (!a.parent) { const dd = day(); dd.peak = Math.max(dd.peak, [...crew.values()].filter(x => !x.parent).length); }
  return a;
}
function assign(a) {
  if (!pads.length) return;
  if (a.parent) { const p = crew.get(a.parent); a.pad = p ? p.pad : 0; a.slot = [...crew.values()].filter(x => x.parent === a.parent).indexOf(a); return; }
  const load = pads.map(p => p.crew.length); let best = 0; load.forEach((n, i) => { if (n < load[best]) best = i; });
  a.pad = best; pads[best].crew.push(a.id); a.slot = pads[best].crew.length - 1;
}
function remove(a) {
  world.remove(a.m); crew.delete(a.id);
  if (!a.parent && pads[a.pad]) { const c = pads[a.pad].crew; c.splice(c.indexOf(a.id), 1); c.forEach((id, k) => { const x = crew.get(id); if (x) x.slot = k; }); }
}
const SLOTS = [[-1.3, 2.3], [1.2, 2.5], [-2.6, 1.6], [2.9, 1.7], [-0.1, 3.1], [-3.4, 0.4]];
function leadPad(a) { const lead = a.parent ? crew.get(a.parent) : a; return lead && pads[lead.pad] ? lead.pad : null; }

// ------------------------------------------------------------------ HUD helpers
const tick = [];
function ticker(text, color = '#fff') {
  const d = document.createElement('div'); d.textContent = text; d.style.setProperty('--c', color); $('ticker').appendChild(d); tick.push(d);
  while (tick.length > (portrait() ? 3 : 5)) tick.shift().remove();
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => { d.remove(); const k = tick.indexOf(d); if (k >= 0) tick.splice(k, 1); }, 700); }, 6000);
}
const scr = new V3();
function toScreen(v) { scr.copy(v).project(camera); return { x: (scr.x + 1) / 2 * innerWidth, y: (1 - scr.y) / 2 * innerHeight, ok: scr.z < 1 }; }
function popAt(pos, text, color = '#fff', size = 18) {
  if (flight) return; const s = toScreen(pos); if (!s.ok) return;
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = text; d.style.cssText = `left:${s.x}px;top:${s.y}px;color:${color};font-size:${size}px`;
  $('pops').appendChild(d); setTimeout(() => d.remove(), 1250);
}
let bannerT = 0;
function banner(text, ms = 4200) { const b = $('banner'); b.textContent = text; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(bannerT); bannerT = setTimeout(() => b.hidden = true, ms); }
const snd = {
  clank: () => { tone(300, 0.06, 'square', 0.05, 0.6); setTimeout(() => tone(620, 0.05, 'triangle', 0.05, 0.8), 40); },
  pump: () => tone(180, 0.12, 'sine', 0.04, 1.4),
  test: () => { tone(90, 0.4, 'sawtooth', 0.06, 0.7); tone(140, 0.3, 'square', 0.03, 0.6); },
  fail: () => tone(200, 0.2, 'square', 0.04, 0.6),
  go: () => [660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.07, 1), i * 110)),
  beep: (hi) => tone(hi ? 1320 : 880, 0.12, 'sine', 0.08, 1),
  rumble: () => { tone(60, 1.4, 'sawtooth', 0.08, 0.8); tone(45, 1.8, 'square', 0.04, 0.9); },
  sep: () => { tone(500, 0.08, 'square', 0.07, 0.4); tone(1200, 0.1, 'triangle', 0.06, 1.3); },
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08, 1), i * 100)),
  ping: () => { tone(1046, 0.1, 'sine', 0.07, 1); setTimeout(() => tone(1568, 0.16, 'sine', 0.06, 1), 90); },
};

// ------------------------------------------------------------------ agent events → the space program
const queue = [];
function queueLaunch(i) { if (!queue.includes(i) && !(flight && flight.pad === i)) queue.push(i); }
function award(sci) { S.sci += sci; S.sciTotal += sci; const d = day(); d.sci += sci; submitScore(); }
function visit(idx) {
  const first = !S.visited.includes(idx); let bonus = 0;
  for (let k = 0; k <= idx; k++) if (!S.visited.includes(k)) { S.visited.push(k); bonus += 25 + PLANETS[k].sci; }
  return { first, bonus };
}
function streak() { const t = ymd(), y = new Date(); y.setDate(y.getDate() - 1); if (S.streak.last === t) return; S.streak.n = S.streak.last === ymd(y) ? S.streak.n + 1 : 1; S.streak.last = t; }
// a launch credited without the flight (agents committed while the game was closed)
function autoLaunch(i, label) {
  const ps = padSt(i); if (ps.parts.length < MIN_PARTS) { ps.clear = true; return null; }
  const reach = reachOf(ps, S.tier) * 0.85, idx = planetFor(reach), v = visit(idx), sci = PLANETS[idx].sci + v.bonus;
  award(sci); S.launches++; S.probe = Math.max(S.probe, idx); S.rocketFar = Math.max(S.rocketFar || 0, idx); streak();
  day().launches.push({ t: Date.now(), planet: idx, acc: 0, sci, label, auto: 1, color: ps.parts[0] || '#fff' });
  Object.assign(ps, { parts: [], fuel: 0, go: false, clear: false }); pads[i] && pads[i].rocket.clear();
  return idx;
}
function probeHop(animate) {
  // a probe can scout at most one world past the farthest world a rocket has reached
  const cap = Math.min(PLANETS.length - 1, (S.rocketFar || 0) + 1);
  if (S.probe >= cap) { award(8); if (animate) { banner(`📡 Deploy! Probe at ${PLANETS[S.probe].name} sends data home  +8 science`); snd.ping(); } return; }
  S.probe = S.probe + 1;
  const v = visit(S.probe), sci = Math.round(PLANETS[S.probe].sci * 0.5) + v.bonus; award(sci);
  if (animate) { banner(`📡 Deploy! Your probe reached ${PLANETS[S.probe].name}${v.first ? ' (new world!)' : ''}  +${sci} science`); snd.win(); }
}
let away = null;
function apply(e, animate) {
  const lead = e.parent ? crew.get(e.parent) : crew.get(e.agent);
  let i = lead && lead.pad != null ? lead.pad : null;
  if (i == null || !pads[i]) i = hash(e.parent || e.agent) % pads.length;
  const pad = pads[i], ps = padSt(i), T = TIERS[S.tier], d = day(), who = e.label || 'agent';
  const a = crew.get(e.agent);
  if (e.counted) d.agents[who] = (d.agents[who] || 0) + 1;
  if (e.kind === 'tokens' && e.counted) {
    const was = ps.fuel; ps.fuel = Math.min(T.fuel, ps.fuel + e.tokens); d.fuel += e.tokens;
    if (animate && ps.fuel > was) { pad.pump = 1; if (Math.random() < 0.3) snd.pump(); if (was < T.fuel && ps.fuel >= T.fuel) { popAt(pad.g.position.clone().add(new V3(-2.2, 3.6, 0)), 'TANK FULL', '#36c8ff'); } }
  }
  if (e.kind === 'tool' && a && animate) { a.state = 'work'; a.st = 1.2; a.wave = 0; }
  if (e.kind === 'think' && a && animate) { a.state = 'think'; a.st = 1.5; }
  if (e.kind === 'prompt' && a && animate) { a.wave = 0; a.state = 'cheer'; a.st = 1; }
  if (e.kind === 'done' && animate && a && !a.parent) { a.wave = 9; banner(`✋ ${who} is waiting for you`); snd.ping(); }
  if (e.kind === 'end' && a && animate) { a.leaving = 1; }
  if (e.kind !== 'result') return;
  if (a && animate) { a.state = 'work'; a.st = 0.8; }
  if (!e.ok) {
    if (e.counted) d.reworks++;
    if (animate) { smoke(pad.g.position.clone().add(new V3(0, MOUNT + Math.max(0.6, pad.rocket.height), 0.6)), { c0: '#8d8b99', c1: '#55535f', size: 0.8, grow: 2.4, life: 1.6 }); pad.rework = 1; snd.fail(); popAt(pad.g.position.clone().add(new V3(0, MOUNT + pad.rocket.height + 1.6, 0)), 'rework', '#ffb38a', 15); }
    return;
  }
  if (!e.counted) return;
  const c = e.cat, topPos = () => pad.g.position.clone().add(new V3(0, MOUNT + pad.rocket.height + 1.4, 0));
  if (c === 'edit') {
    d.parts++;
    if (ps.parts.length >= T.parts) { award(1); if (animate) popAt(topPos(), '+1 science', '#3cf0c0', 15); }
    else {
      const col = a ? a.color : (lead ? lead.color : pad.color); ps.parts.push(col); pad.rocket.add(col, animate);
      if (animate) { pad.crane = 1; ticker(`${who}: part ${ps.parts.length}/${T.parts} bolted on`, col); }
      if (ps.clear && ps.parts.length >= MIN_PARTS) { ps.clear = false; if (animate) queueLaunch(i); else autoLaunch(i, who); }
    }
  } else if (c === 'run') {
    if (animate) { pad.test = 0.9; snd.test(); pad.shake = 0.4; }
  } else if (c === 'test') {
    d.tests++; d.gos++; ps.go = true;
    if (animate) { snd.go(); popAt(topPos(), 'GO for launch!', '#3cf0c0', 22); ticker(`${who}: tests pass, GO for launch`, '#3cf0c0'); }
  } else if (c === 'commit') {
    d.commits++;
    if (animate) {
      if (ps.parts.length >= MIN_PARTS) { queueLaunch(i); ticker(`${who}: commit! launch cleared`, '#ff9a5a'); }
      else { ps.clear = true; popAt(topPos(), `cleared · needs ${MIN_PARTS} parts`, '#ffd23f', 15); }
    } else { const idx = autoLaunch(i, who); if (idx != null && away) away.launches++; }
  } else if (c === 'deploy') {
    d.deploys++; probeHop(animate);
  } else if (animate && (c === 'read' || c === 'web')) {
    if (Math.random() < 0.3) sparks(pad.g.position.clone().add(new V3(1.75, 1.6 + Math.random() * 4, 0.6)), '#9ad7ff', 5);
  }
}
function onEvents(list, info) {
  B && B.onAgentEvents(list);
  const isDemo = !!info.demo;
  if (isDemo && mode !== 'demo') setMode('demo');
  if (!isDemo && mode !== 'live') setMode('live');
  const back = !!info.backfill;
  if (back) away = { parts: 0, launches: 0, sci: S.sciTotal, fuel: 0 };
  for (const e of list) {
    if (e.live && e.kind !== 'end') { const a = ensure(e); a.last = Math.max(a.last, e.t); }
    if (e.kind === 'end') { const a = crew.get(e.agent); if (a && !back) a.leaving = 1; else if (a) remove(a); }
    if (back && e.counted) { if (e.kind === 'result' && e.ok && e.cat === 'edit') away.parts++; if (e.kind === 'tokens') away.fuel += e.tokens; }
    if (e.counted || e.live) apply(e, e.live && !back);
    if (RVR.r && !isDemo && !back && e.live && e.kind === 'result' && e.ok) rvMine(ALT[e.cat] != null ? ALT[e.cat] : 0.05);
  }
  if (back && away && (away.parts || away.launches)) {
    const gained = S.sciTotal - away.sci;
    toast(`While you were away: ${away.parts} parts, ${fmt(away.fuel)} fuel${away.launches ? `, ${away.launches} auto-launch${away.launches > 1 ? 'es' : ''}` : ''}${gained ? `, +${gained} science` : ''}`, 7000);
  }
  away = null;
  save(); hud();
}

function setMode(m) {
  mode = m; S = m === 'demo' ? demoState() : real;
  for (const a of [...crew.values()]) remove(a);
  queue.length = 0; if (flight) endFlight(true);
  buildPads(); hud(); camSnap = true;
}

// ------------------------------------------------------------------ flight (the player's skill moment)
let flight = null, cooldown = 9;
const H = 260, FLY_T = 13;
const fh = { hud: $('flightHud'), phase: $('fPhase'), acc: $('fAcc'), hint: $('fHint'), fill: $('altFill'), proj: $('altProj'), ring: $('sepRing'), count: $('count'), judge: $('judge'), result: $('result') };
const corridorG = new THREE.Group(); scene.add(corridorG);
const steer = { down: false, cx: 0, keys: 0, touched: false };
function corridor(seed, x0) {
  const r = rng(seed), p1 = r() * 6, p2 = r() * 6, a1 = 2.2 + r() * 1.8, a2 = 1 + r() * 1.2;
  const c = y => x0 + smooth(10, 45, y) * (a1 * Math.sin(y * 0.026 + p1) + a2 * Math.sin(y * 0.058 + p2) - (a1 * Math.sin(p1) + a2 * Math.sin(p2)) * (1 - smooth(10, 45, y)));
  const w = y => { const f = y / H; return lerp(2.4, 1.45, smooth(0.18, 0.24, f) * (1 - smooth(0.44, 0.5, f))); };
  return { c, w };
}
function buildCorridor(cor, z) {
  corridorG.clear();
  const L = [], R = [];
  for (let y = 8; y <= H + 20; y += 3) { L.push(new V3(cor.c(y) - cor.w(y), y, z)); R.push(new V3(cor.c(y) + cor.w(y), y, z)); }
  for (const pts of [L, R]) {
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 260, 0.09, 6), new THREE.MeshBasicMaterial({ color: '#7ff6ff', transparent: true, opacity: 0.85 }));
    corridorG.add(tube);
  }
  for (let k = 0; k < L.length; k += 4) {
    const y = L[k].y, f = y / H, mq = f > 0.2 && f < 0.47;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(R[k].x - L[k].x, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: mq ? '#ff7a4d' : '#7ff6ff', transparent: true, opacity: 0.35 }));
    bar.position.set((L[k].x + R[k].x) / 2, y, z); corridorG.add(bar);
    for (const p of [L[k], R[k]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: mq ? '#ff7a4d' : '#c8fdff' })); b.position.copy(p); corridorG.add(b); }
  }
  // clouds to punch through
  const r = rng(z * 13 + 5);
  for (let k = 0; k < 26; k++) { const y = 35 + r() * 45, sz = 9 + r() * 10; const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: PUFF, transparent: true, opacity: 0.85, depthWrite: false })); c.scale.set(sz, sz * 0.7, 1); c.position.set(cor.c(y) + (r() - 0.5) * 30, y, z - 3 - r() * 12); corridorG.add(c); }
}
function startFlight(i) {
  const pad = pads[i], ps = padSt(i); if (!pad || ps.parts.length < 1) return;
  const T = TIERS[S.tier], base = reachOf(ps, S.tier);
  const rocket = new Rocket(); ps.parts.forEach(c => rocket.add(c));
  const p0 = pad.g.position.clone(); rocket.g.position.set(p0.x, MOUNT + 0.02, p0.z); world.add(rocket.g);
  const stages = clamp(1 + Math.floor(ps.parts.length / 4), 1, 4), seps = [];
  for (let k = 1; k < stages; k++) seps.push(0.1 + 0.8 * k / stages);
  const cor = corridor(Date.now() % 1e5, p0.x);
  flight = { pad: i, phase: 'count', t: 0, rocket, base, go: ps.go, stages, seps, sepIdx: 0, sepBonus: 0, ring: null, inT: 0, totT: 0, x: p0.x, vx: 0, y: MOUNT, z: p0.z, cor, eff: 1, colors: ps.parts.slice(), fuel: Math.min(1, ps.fuel / T.fuel), wind: [Math.random() * 6, Math.random() * 6], yOff: 0, autoErr: 0, auto: true, beeps: 0, judgeLog: [] };
  Object.assign(ps, { parts: [], fuel: 0, go: false, clear: false }); pad.rocket.clear();
  buildCorridor(cor, p0.z + 0.0); corridorG.visible = false;
  steer.touched = false; closePanels();
  fh.hint.textContent = portrait() ? 'Hold & drag to steer · tap the rings' : 'Hold & drag (or ←/→) to steer · tap / Space on the rings';
  // altitude bar marks
  const marks = $('altMarks'); marks.innerHTML = '';
  const maxR = PLANETS[PLANETS.length - 1].req * 1.05;
  PLANETS.forEach((p, k) => { if (!k) return; const d = document.createElement('div'); d.className = S.visited.includes(k) ? '' : 'lock'; d.style.bottom = (p.req / maxR * 100) + '%'; d.innerHTML = `<span>${p.name}</span><i style="background:${p.c1}"></i>`; marks.appendChild(d); });
  flight.maxR = maxR;
  save(); hud();
}
function endFlight(silent) {
  if (!flight) return;
  world.remove(flight.rocket.g); scene.remove(flight.rocket.g);
  if (flight.planet) scene.remove(flight.planet);
  for (const f of flight.falling || []) scene.remove(f.g);
  corridorG.clear(); fh.hud.hidden = true; fh.ring.hidden = true; fh.count.hidden = true; fh.result.hidden = true;
  flight = null; cooldown = silent ? 1 : 5; setSky(0); camSnap = true;
  hud();
}
function sepTap() {
  const f = flight; if (!f || !f.ring) return;
  const s = f.ring.s, d = Math.abs(s - 1);
  const j = d < 0.13 ? ['PERFECT!', '#3cf0c0', 0.14] : d < 0.32 ? ['GOOD', '#ffd23f', 0.06] : ['SLOPPY', '#ff8a6a', -0.04];
  doSep(j);
}
function doSep(j) {
  const f = flight; f.ring = null; fh.ring.hidden = true; f.sepIdx++; f.sepBonus += j[2]; f.judgeLog.push(j[0]);
  fh.judge.textContent = j[0]; fh.judge.style.color = j[1]; fh.judge.hidden = false; fh.judge.style.animation = 'none'; void fh.judge.offsetWidth; fh.judge.style.animation = '';
  snd.sep(); shake = Math.max(shake, 0.5);
  // drop the bottom stage
  const R = f.rocket, n = Math.max(1, Math.round(R.parts.length / (f.stages - f.sepIdx + 1)));
  const drop = R.parts.splice(0, Math.min(n, R.parts.length - 1)), g = new THREE.Group();
  const wp = R.g.position.clone(); g.position.copy(wp); scene.add(g);
  drop.forEach(p => { R.stack.remove(p); g.add(p); });
  const dh = drop.length * PART_H;
  R.parts.forEach(p => p.position.y -= dh); R.layout(); R.g.position.y += dh; f.y += dh; f.yOff += dh;
  (f.falling = f.falling || []).push({ g, v: new V3(rnd(1.5), -2, 0), spin: rnd(2) });
  for (let k = 0; k < 14; k++) smoke(R.g.position.clone(), { v: new V3(rnd(5), rnd(2), rnd(3)), size: 0.6, grow: 2.6, life: 1.4, up: 0 });
  sparks(R.g.position.clone(), j[1], 18);
}
function flightUpdate(s) {
  const f = flight, pad = pads[f.pad], R = f.rocket; f.t += s;
  if (f.phase === 'count') {
    const left = 3.4 - f.t, n = Math.ceil(left);
    if (n !== f.beeps && n > 0 && n <= 3) { f.beeps = n; fh.count.textContent = n; fh.count.className = ''; fh.count.hidden = false; snd.beep(false); }
    if (pad) pad.arms = Math.min(1, pad.arms + s * 0.8);
    const base = R.g.position.clone();
    if (f.t > 1.4 && Math.random() < 0.6) smoke(base.clone().add(new V3(rnd(1), 0, 1.2)), { v: new V3(rnd(6), 0.5 + Math.random(), 2 + Math.random() * 3), size: 1.2, grow: 4.5, life: 2.2, up: 0.2, drag: 0.95 });
    if (f.t > 2.6) { for (let k = 0; k < 4; k++) flame(base.clone().add(new V3(0, -0.3, 0)), 1.3); shake = Math.max(shake, 0.25); }
    if (left <= 0) { f.phase = 'fly'; f.t = 0; fh.count.textContent = 'LIFTOFF!'; fh.count.className = 'go'; setTimeout(() => { if (fh.count.textContent === 'LIFTOFF!') fh.count.hidden = true; }, 900); snd.rumble(); shake = 1; fh.hud.hidden = false; corridorG.visible = true; crowdJump = 2.5;
      for (let k = 0; k < 60; k++) { const a = Math.random() * Math.PI * 2; smoke(base.clone(), { v: new V3(Math.cos(a) * (6 + Math.random() * 6), 0.5 + Math.random() * 1.5, Math.sin(a) * (6 + Math.random() * 6)), size: 1.8, grow: 7, life: 3.5, up: 0.25, drag: 0.95 }); } }
    return;
  }
  if (f.phase === 'fly') {
    const u = Math.min(1, f.t / FLY_T), y = MOUNT + f.yOff + H * (0.62 * u * u + 0.38 * u) * smooth(0, 0.06, u);
    const dy = y - f.y; f.y = y;
    const cy = f.cor.c(f.y), w = f.cor.w(f.y), frac = f.y / H, maxq = frac > 0.2 && frac < 0.47;
    // wind + steering (spring toward the finger), autopilot until the player touches
    const gust = (maxq ? 6.5 : 3.2) * (Math.sin(f.t * 0.9 + f.wind[0]) * 0.6 + Math.sin(f.t * 2.3 + f.wind[1]) * 0.4) * smooth(8, 20, f.y);
    let target = null;
    if (steer.down) target = worldXAt(steer.cx); else if (steer.keys) target = f.x + steer.keys * 2.5;
    else if (!steer.touched) target = f.cor.c(f.y + 6) + Math.sin(f.t * 1.4) * w * 0.85;
    const ax = (target != null ? (target - f.x) * 10 - f.vx * 5 : -f.vx * 0.4) + gust;
    f.vx += ax * s; f.x += f.vx * s;
    R.g.position.set(f.x, f.y, f.z); R.g.rotation.z = clamp(-f.vx * 0.06, -0.35, 0.35);
    const inside = Math.abs(f.x - cy) < w;
    if (f.y > 9) { f.totT += s; if (inside) f.inT += s; else shake = Math.max(shake, 0.12); }
    const acc = f.totT ? f.inT / f.totT : 1;
    f.eff = clamp(0.6 + 0.65 * acc + f.sepBonus, 0.5, 1.45);
    // plume + trail
    const tail = R.g.position.clone().add(new V3(0, -0.4, 0));
    for (let k = 0; k < 4; k++) flame(tail, 1.4 + (maxq ? 0.2 : 0));
    if (Math.random() < 0.8) smoke(tail.clone().add(new V3(0, -1.5, 0)), { v: new V3(rnd(0.5), -2, rnd(0.5)), size: 0.9, grow: 3.5, life: 3, up: 0, alpha: lerp(0.8, 0.25, frac), c0: '#ffffff', c1: '#d8d4ea' });
    vapor.visible = maxq && Math.sin(f.t * 40) > -0.6; vapor.position.copy(R.g.position).add(new V3(0, R.height * 0.6 + 0.4, 0)); vapor.scale.setScalar(1 + Math.random() * 0.1);
    shake = Math.max(shake, maxq ? 0.18 : 0.06);
    // stage separation rings
    if (f.sepIdx < f.seps.length && !f.ring && u > f.seps[f.sepIdx] - 0.06) { f.ring = { s: 2.6 }; fh.ring.hidden = false; }
    if (f.ring) {
      f.ring.s -= s * 1.5; fh.ring.querySelector('.ring').style.transform = `scale(${Math.max(0.05, f.ring.s)})`;
      const sp2 = toScreen(R.g.position.clone().add(new V3(0, R.height / 2, 0))); fh.ring.style.left = sp2.x + 'px'; fh.ring.style.top = sp2.y + 'px';
      if (!steer.touched && f.ring.s <= 1 + f.autoErr) doSep(Math.abs(f.autoErr) < 0.13 ? ['PERFECT!', '#3cf0c0', 0.14] : ['GOOD', '#ffd23f', 0.06]);
      else if (f.ring && f.ring.s < 0.4) doSep(['LATE', '#ff8a6a', -0.04]);
    } else f.autoErr = rnd(0.28);
    // HUD
    fh.phase.textContent = maxq ? 'MAX-Q' : frac < 0.2 ? 'LIFTOFF' : frac < 0.75 ? 'CLIMB' : 'SPACE'; fh.phase.className = maxq ? 'maxq' : '';
    fh.acc.textContent = (inside ? 'ON COURSE ' : 'OFF COURSE ') + Math.round(acc * 100) + '%'; fh.acc.className = inside ? '' : 'off';
    fh.fill.style.height = Math.min(100, (f.base * f.eff * u) / f.maxR * 100) + '%';
    const proj = f.base * f.eff * (f.go ? 1 : 1); fh.proj.style.bottom = Math.min(100, proj / f.maxR * 100) + '%'; fh.proj.querySelector('span').textContent = '→ ' + PLANETS[planetFor(proj)].name;
    setSky(smooth(0.1, 0.85, frac));
    for (const fl of f.falling || []) { fl.v.y -= 9 * s; fl.g.position.addScaledVector(fl.v, s); fl.g.rotation.z += fl.spin * s; }
    if (u >= 1) arrive();
    return;
  }
  if (f.phase === 'arrive') {
    R.g.position.y += s * 9 * Math.max(0.2, 1 - f.t / 3); f.y = R.g.position.y; R.g.rotation.z *= 0.95;
    flame(R.g.position.clone().add(new V3(0, -0.4, 0)), 0.8);
    f.planet.position.y = lerp(f.planet.position.y, f.y + 16, 1 - Math.pow(0.2, s)); f.planet.rotation.y += s * 0.15;
    f.planet.scale.setScalar(lerp(f.planet.scale.x, 1, 1 - Math.pow(0.05, s)));
    if (f.t > 9) endFlight(false);
  }
}
let crowdJump = 0;
const vapor = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
vapor.rotation.x = Math.PI; vapor.visible = false; scene.add(vapor);
function arrive() {
  const f = flight; f.phase = 'arrive'; f.t = 0; vapor.visible = false; fh.hud.hidden = true; fh.ring.hidden = true;
  const reach = f.base * f.eff, idx = planetFor(reach), P_ = PLANETS[idx], v = visit(idx);
  const acc = f.totT ? f.inT / f.totT : 1, sci = P_.sci + v.bonus + Math.round(acc * 5);
  award(sci); S.launches++; S.probe = Math.max(S.probe, idx); S.rocketFar = Math.max(S.rocketFar || 0, idx); streak();
  S.best.acc = Math.max(S.best.acc, Math.round(acc * 100)); S.best.reach = Math.max(S.best.reach, Math.round(reach));
  const d = day(); d.best = Math.max(d.best, idx);
  d.launches.push({ t: Date.now(), planet: idx, acc: Math.round(acc * 100), sci, color: f.colors[0] || '#fff', seps: f.judgeLog.join(' ') });
  f.planet = makePlanet(P_, 9); f.planet.position.set(f.x + (portrait() ? 0 : -1), f.y + 40, f.z - 34); f.planet.scale.setScalar(0.3); scene.add(f.planet);
  f.result = { idx, sci, acc, first: v.first, reach };
  if (RVR.r && mode === 'live') { f.result.km = f.colors.length * 0.25 * f.eff; rvMine(f.result.km); }
  setTimeout(() => showResult(), 1300);
  snd.win(); if (v.first) setTimeout(() => confetti(scene, f.rocket.g.position.clone().add(new V3(0, 3, 2)), 90), 1300);
  save(); hud();
}
function rankLine() { try { const p = B.profile(), r = JSON.parse(localStorage.getItem('board_rank_agent-rockets')); return p && r && mode === 'live' ? `${flag(p.country)} #${r} today` : ''; } catch (e) { return ''; } }
function showResult() {
  const f = flight; if (!f || !f.result) return; const r = f.result, P_ = PLANETS[r.idx];
  const rk = rankLine();
  fh.result.innerHTML = `<div class="kind">REACHED ${P_.kind.toUpperCase()}</div><h2>${P_.name}</h2>${r.first ? '<div class="new">NEW WORLD UNLOCKED</div>' : ''}
    <div class="row"><span><b>+${r.sci}</b>science</span><span><b>${Math.round(r.acc * 100)}%</b>on course</span><span><b>${Math.round(r.reach)}</b>reach</span></div>
    <p class="fine">${f.judgeLog.length ? 'Separations: ' + f.judgeLog.join(' · ') : 'Single stage rocket'}${f.go ? ' · GO bonus +10%' : ''}${rk ? ' · ' + rk : ''}</p>${r.km ? `<p class="fine">Altitude race: <b>+${kmS(r.km)}</b> · You ${kmS(RVR.me)} vs ${RVR.r ? RVR.r.flag + ' ' + esc(RVR.r.name) : 'rival'} ${kmS(RVR.them)}</p>` : ''}
    ${r.idx < PLANETS.length - 1 ? `<p class="fine">Next world: ${PLANETS[r.idx + 1].name} needs reach ${PLANETS[r.idx + 1].req}. Bigger stacks and cleaner flights go further.</p>` : '<p class="fine">You reached the edge of the map!</p>'}
    <button class="big" id="bBack">Back to the pads</button>`;
  fh.result.hidden = false; $('bBack').onclick = () => endFlight(false);
}

// ------------------------------------------------------------------ the rival's launch site (live duel only)
// Their pad stands at the left end of your row, painted in their colour, built by their named agents. Each of their
// finished steps moves their program on (edit = a part, test = GO, commit = liftoff, deploy = a big boost) and adds
// altitude to the race against yours. A real rival plays in r.color; a simulated one is silver and says so.
const ALT = { edit: 0.2, run: 0.1, test: 1, commit: 1.5, deploy: 2, read: 0.05, web: 0.05, delegate: 0.05, other: 0.05 };
const RV_MAX = 9;
const kmS = k => (k >= 100 ? Math.round(k) : k.toFixed(1)) + ' km';
const rvCol = r => r.sim ? '#dfe4ec' : r.color;
const rvTagCol = r => r.sim ? '#5d6478' : r.color;
function rvLoad() { try { const j = JSON.parse(localStorage.getItem('liftoff_lab_race')); if (j && j.key === RVR.key) { RVR.me = j.me || 0; RVR.them = j.them || 0; return; } } catch (e) {} RVR.me = 0; RVR.them = 0; }
function rvSave() { try { localStorage.setItem('liftoff_lab_race', JSON.stringify({ key: RVR.key, me: RVR.me, them: RVR.them })); } catch (e) {} }
function makeRivalPad(r) {
  const col = rvCol(r), cm = partMat(col), tc = rvTagCol(r);
  const pad = { g: new THREE.Group(), rocket: new Rocket(), color: col, shake: 0, test: 0, crane: 0, rework: 0, go: false, arms: 0, statusSpr: null };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.55, 8), M.concrete); base.position.y = 0.27;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.74, 2.74, 0.14, 8, 1, true), cm); ring.position.y = 0.5;
  const trench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 4.2), M.dark); trench.position.set(0, 0.56, -0.6);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#4a5068', metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide })); mount.position.y = 0.85;
  // a painted apron in their colour and a dashed border between their site and yours
  const apronR = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.35, roughness: 0.8 })); apronR.rotation.x = -Math.PI / 2; apronR.position.y = 0.22;
  pad.g.add(base, ring, trench, mount, apronR);
  for (let k = 0; k < 7; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.8), cm); d.position.set(3.9, 0.24, -4.2 + k * 1.4); pad.g.add(d); }
  pad.rocket.g.position.set(0, MOUNT + 0.02, 0); pad.g.add(pad.rocket.g);
  pad.gantry = makeGantry(RV_MAX * PART_H + 3); pad.gantry.traverse(m => { if (m.isMesh && m.material === M.red) m.material = cm; }); pad.gantry.position.set(-1.75, 0.55, -0.15); pad.gantry.rotation.y = Math.PI; pad.g.add(pad.gantry);
  pad.tank = makeTank(); pad.tank.position.set(2.25, 0.55, -0.5); pad.tank.liq.scale.y = 0.7; pad.g.add(pad.tank);
  pad.lamps = ['#ff4040', '#ffb020', '#30e090'].map((c, k) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1 })); l.position.set(-1.1 + k * 0.32, 0.72, 2.45); pad.g.add(l); return l; });
  const lp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.2), M.dark); lp.position.set(-0.78, 0.62, 2.48); pad.g.add(lp);
  pad.sign = label(`${r.flag} ${r.name}`, tc, { w: 2.6 }); pad.sign.position.set(0, 0.35, 3.3); pad.g.add(pad.sign);
  pad.title = label(`${r.flag} ${r.name.toUpperCase()}'S PAD`, tc, { w: 4.6 }); pad.title.position.set(0, RV_MAX * PART_H + 5.2, 0); pad.g.add(pad.title);
  cast(pad.g); apronR.castShadow = false; world.add(pad.g);
  return pad;
}
function rvStatusSign(text) {
  const rp = RVR.pad; if (!rp || RVR.status === text) return; RVR.status = text;
  if (rp.statusSpr) { rp.g.remove(rp.statusSpr); rp.statusSpr = null; }
  if (text) { rp.statusSpr = label(text, '#2c3044', { w: 3.2 }); rp.statusSpr.position.set(0, RV_MAX * PART_H + 4.3, 0); rp.g.add(rp.statusSpr); }
}
function rvCrewAdd(a, r, i) {
  const col = rvCol(r), txt = `${r.flag} ${a.name}${a.src === 'codex' ? ' ·cx' : ''}`;
  const m = engineer(col, txt);
  if (r.sim) { m.remove(m.tag); m.tag = label(txt, rvTagCol(r), { w: 2.9 }); m.tag.position.y = 2.35; m.add(m.tag); }
  const p = RVR.pad.g.position; m.position.set(p.x + (i % 2 ? 2 : -2), 0.55, p.z + 9);
  world.add(m);
  const c = { k: a.k, name: a.name, m, i, state: a.state, st: 0, bob: Math.random() * 6 };
  RVR.crew.set(a.k, c); return c;
}
function rvClear() {
  for (const c of RVR.crew.values()) world.remove(c.m); RVR.crew.clear();
  for (const f of RVR.flying) world.remove(f.R.g); RVR.flying.length = 0;
  if (RVR.pad) world.remove(RVR.pad.g);
  RVR.pad = null; RVR.r = null; RVR.key = null; RVR.status = '';
  document.body.classList.remove('duel'); $('rvRace').hidden = true; layout(); buildDecos();
}
function rvSync() {
  const r = B && B.rival ? B.rival() : null;
  if (!r) { if (RVR.r) rvClear(); return; }
  if (RVR.key !== r.key) { rvClear(); RVR.key = r.key; rvLoad(); }
  RVR.r = r;
  if (!RVR.pad) { RVR.pad = makeRivalPad(r); layout(); buildDecos(); document.body.classList.add('duel'); }
  const ags = (r.agents || []).slice(0, 5), keep = new Set(ags.map(a => a.k));
  for (const c of [...RVR.crew.values()]) if (!keep.has(c.k)) { world.remove(c.m); RVR.crew.delete(c.k); }
  ags.forEach((a, i) => { const c = RVR.crew.get(a.k) || rvCrewAdd(a, r, i); c.i = i; c.state = a.state; });
  rvStatusSign(r.sim ? 'SIMULATED RIVAL' : !r.online ? '😴 OFFLINE' : !ags.length ? 'NO AGENTS YET' : '');
  RVR.dirty = true;
}
function rvLaunch() {
  const rp = RVR.pad, n = rp.rocket.parts.length; if (n < 1) return 0;
  const R = new Rocket(); rp.rocket.parts.forEach(p => R.add(p.userData.color));
  const p0 = rp.g.position; R.g.position.set(p0.x, MOUNT + 0.02, p0.z); world.add(R.g);
  RVR.flying.push({ R, v: 0, t: 0 });
  const km = n * 0.25 * (rp.go ? 1.1 : 1);
  rp.rocket.clear(); rp.go = false; rp.shake = 1;
  return km;
}
function rvEvent(e) {
  const r = RVR.r, rp = RVR.pad; if (!r || !rp) return;
  const c = RVR.crew.get(e.agent.k), who = `${r.name}'s ${e.agent.name}`, col = rp.color, tc = rvTagCol(r);
  const top = () => rp.g.position.clone().add(new V3(0, MOUNT + rp.rocket.height + 1.6, 0));
  if (c) c.st = 1.4;
  if (!e.ok) {
    rp.rework = 1; smoke(rp.g.position.clone().add(new V3(0, MOUNT + Math.max(0.6, rp.rocket.height), 0.6)), { c0: '#8d8b99', c1: '#55535f', size: 0.8, grow: 2.4, life: 1.6 });
    popAt(top(), `${e.agent.name}: rework`, '#ffb38a', 15); ticker(`${r.flag} ${who}: ✗ ${e.cat} failed, rework`, '#ff9d8a'); return;
  }
  let km = ALT[e.cat] != null ? ALT[e.cat] : 0.05, extra = 0;
  if (e.cat === 'edit') {
    if (rp.rocket.parts.length < RV_MAX) { rp.rocket.add(col, true); rp.crane = 1; ticker(`${r.flag} ${who} bolts on part ${rp.rocket.parts.length}`, tc); }
  } else if (e.cat === 'run') { rp.test = 0.9; rp.shake = 0.4; ticker(`${r.flag} ${who} fires an engine test`, tc); }
  else if (e.cat === 'test') { rp.go = true; popAt(top(), `${e.agent.name}: GO!`, col, 20); ticker(`${r.flag} ${who}: tests pass, GO for launch`, tc); }
  else if (e.cat === 'commit') { extra = rvLaunch(); banner(`${r.flag} ${who} commits: ${extra ? 'liftoff! ' : ''}+${kmS(km + extra)}`, 3600); snd.rumble(); }
  else if (e.cat === 'deploy') { extra = rvLaunch(); banner(`${r.flag} ${who} deploys: +${kmS(km + extra)}!`, 3600); snd.rumble(); for (let k = 0; k < 3; k++) setTimeout(() => RVR.pad && sparks(RVR.pad.g.position.clone().add(new V3(0, 6 + k * 2, 0)), col, 22), k * 150); }
  else sparks(rp.g.position.clone().add(new V3(-1.75, 1.6 + Math.random() * 4, 0.6)), col, 6);
  RVR.them += km + extra; RVR.dirty = true; rvSave();
  popAt(rp.g.position.clone().add(new V3(1.6, MOUNT + rp.rocket.height + 0.6, 0)), `+${kmS(km + extra)}`, col, e.cat === 'commit' || e.cat === 'deploy' ? 22 : 15);
}
function rvMine(km, why) { if (!RVR.r || km <= 0) return; RVR.me += km; RVR.dirty = true; rvSave(); }
function rvPanel() {
  const r = RVR.r, el = $('rvRace'); if (!r) { el.hidden = true; return; } RVR.dirty = false;
  const top = Math.max(5, RVR.me, RVR.them) * 1.12, ags = [...RVR.crew.values()], working = ags.filter(c => c.state === 'working').length;
  const st = r.sim ? 'simulated rival · silver crew' : !r.online ? `😴 ${esc(r.name)} is offline · their crew is idle` : !ags.length ? `waiting for ${esc(r.name)}'s agents…` : `🟢 ${working} of ${ags.length} agents working · ${ags.map(c => esc(c.name)).join(', ')}`;
  const lead = RVR.me > RVR.them ? 'me' : RVR.them > RVR.me ? 'them' : '';
  el.style.setProperty('--c', rvCol(r));
  el.innerHTML = `<div class="hd">ALTITUDE RACE</div>
    <div class="ln me ${lead === 'me' ? 'lead' : ''}"><span class="nm">You</span><div class="tr"><i style="width:${RVR.me / top * 100}%"><em>🚀</em></i></div><b>${kmS(RVR.me)}</b></div>
    <div class="ln them ${lead === 'them' ? 'lead' : ''}"><span class="nm">${r.flag} ${esc(r.name)}</span><div class="tr"><i style="width:${RVR.them / top * 100}%"><em>🚀</em></i></div><b>${kmS(RVR.them)}</b></div>
    <div class="st">${st}</div>`;
  el.hidden = false;
}
function rvUpdate(s, t) {
  const rp = RVR.pad; if (!rp) return;
  const r = RVR.r, live = r && (r.sim || r.online);
  const landed = rp.rocket.update(s);
  if (landed) { sparks(rp.g.position.clone().add(new V3(0, MOUNT + landed.position.y + PART_H, 0)), landed.userData.color, 12); shake = Math.max(shake, 0.05); }
  const gy = rp.gantry; gy.beacon.material.emissiveIntensity = live && Math.sin(t * 4) > 0.2 ? 2.5 : 0.2;
  gy.car.position.y = 1 + (Math.sin(t * 0.5 + 3) * 0.5 + 0.5) * (gy.top - 1.5) * (live ? 1 : 0);
  if (rp.crane) rp.crane = Math.max(0, rp.crane - s * 1.2);
  const hookY = Math.max(MOUNT + rp.rocket.height + 1.2 - 0.55, 1.5) - 0.55, hookTop = gy.top - 0.75, hy = lerp(hookTop, Math.min(hookTop, hookY), Math.sin(rp.crane * Math.PI));
  gy.hook.position.y = hy; gy.cable.scale.y = Math.max(0.2, gy.top + 0.35 - hy); gy.cable.position.y = (gy.top + 0.35 + hy) / 2;
  if (rp.test > 0) { rp.test -= s; const b = rp.g.position.clone().add(new V3(0, MOUNT - 0.35, 0)); if (rp.rocket.parts.length) { for (let k = 0; k < 3; k++) flame(b, 1.1); if (Math.random() < 0.5) smoke(b.clone().add(new V3(0, 0, 1.4)), { v: new V3(rnd(2), 0.8, 2.5), size: 0.8, grow: 3.5, life: 1.8 }); } else sparks(b, '#ffb000', 2); }
  if (rp.rework) { rp.rework = Math.max(0, rp.rework - s * 2.5); const tp = rp.rocket.parts[rp.rocket.parts.length - 1]; if (tp) tp.rotation.z = Math.sin(rp.rework * 20) * 0.08 * rp.rework; }
  if (rp.shake) { rp.shake = Math.max(0, rp.shake - s); rp.rocket.g.position.x = rnd(0.09 * rp.shake); } else rp.rocket.g.position.x = 0;
  const ready = rp.rocket.parts.length >= MIN_PARTS;
  rp.lamps[0].material.emissiveIntensity = !ready ? 1.6 : 0.1; rp.lamps[1].material.emissiveIntensity = ready && !rp.go ? 1.6 : 0.1; rp.lamps[2].material.emissiveIntensity = rp.go ? (Math.sin(t * 6) > 0 ? 2 : 1) : 0.1;
  rp.title.position.y = RV_MAX * PART_H + 5.2 + Math.sin(t * 1.5) * 0.12;
  // their rockets in flight: a short liftoff off the top of the screen
  for (let k = RVR.flying.length - 1; k >= 0; k--) {
    const f = RVR.flying[k]; f.t += s; const g = f.R.g, base = g.position.clone().add(new V3(0, -0.4, 0));
    if (f.t < 1.1) { g.position.x = rp.g.position.x + rnd(0.04); if (Math.random() < 0.7) smoke(base.clone().add(new V3(rnd(1), 0, 1)), { v: new V3(rnd(5), 0.6, 2 + Math.random() * 2), size: 1.1, grow: 4, life: 2 }); for (let q = 0; q < 2; q++) flame(base, 1.1); continue; }
    f.v += s * 7; g.position.y += f.v * s; for (let q = 0; q < 3; q++) flame(base, 1.3);
    if (Math.random() < 0.7) smoke(base.clone().add(new V3(0, -1, 0)), { v: new V3(rnd(0.5), -2, rnd(0.5)), size: 0.9, grow: 3.2, life: 2.6, up: 0 });
    if (g.position.y > 90) { world.remove(g); RVR.flying.splice(k, 1); }
  }
  // their crew: walk to a slot round their pad; hammer when a step lands, wave when waiting, slump when offline
  const pp = rp.g.position;
  for (const c of RVR.crew.values()) {
    const m = c.m, sl = SLOTS[c.i % SLOTS.length], tgt = new V3(pp.x - sl[0], 0.55, pp.z + sl[1]);
    c.st = Math.max(0, c.st - s);
    const dx = tgt.x - m.position.x, dz = tgt.z - m.position.z, dd = Math.hypot(dx, dz);
    if (dd > 0.08) { const sp_ = Math.min(dd, s * 3.2); m.position.x += dx / dd * sp_; m.position.z += dz / dd * sp_; m.rotation.y = Math.atan2(dx, dz); m.run(t, 1); continue; }
    m.position.y = 0.55; m.armR.rotation.z = 0; m.head.position.x = 0;
    if (!live) { m.rotation.y = lerp(m.rotation.y, 0.4, 0.05); m.armL.rotation.x = m.armR.rotation.x = 0.15; m.legL.rotation.x = m.legR.rotation.x = 0; m.body.position.y = 0.92; continue; }
    if (c.st > 0) { m.rotation.y = Math.atan2(pp.x - m.position.x, pp.z - m.position.z); m.armR.rotation.x = -1.4 + Math.sin(t * 18) * 0.6; m.armL.rotation.x = -0.6; m.legL.rotation.x = m.legR.rotation.x = 0; continue; }
    if (c.state === 'waiting') { m.rotation.y = lerp(m.rotation.y, 0, 0.2); m.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.4; m.armR.rotation.x = 0; m.armL.rotation.x = 0; m.position.y = 0.55 + Math.abs(Math.sin(t * 5)) * 0.08; continue; }
    if (c.state === 'working') { m.rotation.y = Math.atan2(pp.x - m.position.x, pp.z - m.position.z); m.armR.rotation.x = -1.0 + Math.sin(t * 6 + c.bob) * 0.3; m.armL.rotation.x = -0.4; continue; }
    m.rotation.y = lerp(m.rotation.y, Math.sin(t * 0.3 + c.bob) * 0.5, 0.05); m.armL.rotation.x = m.armR.rotation.x = Math.sin(t * 1.5 + c.bob) * 0.08; m.legL.rotation.x = m.legR.rotation.x = 0;
  }
}

// ------------------------------------------------------------------ camera, input, loop
let shake = 0, camSnap = true, tNow = 0;
const camPos = new V3(), camLook = new V3();
function updateCamera(s) {
  let p, l;
  if (flight && flight.phase !== 'count') {
    const f = flight, dist = 17 * Math.max(1, 0.85 / camera.aspect);
    f.camX = lerp(f.camX == null ? f.x : f.camX, f.phase === 'fly' ? lerp(f.x, f.cor.c(f.y), 0.35) : f.x, 1 - Math.pow(0.2, s)); const cx = f.camX;
    const side = f.phase === 'arrive' ? (portrait() ? 0 : 5) : 0; p = new V3(cx + side, f.y + 1.5, f.z + dist); l = new V3(cx + side, f.y + (f.phase === 'arrive' ? (portrait() ? 9 : 7) : 4.5), f.z);
    if (f.phase === 'fly' && f.t < 1.5) { camPos.lerp(p, 1 - Math.pow(0.02, s)); camLook.lerp(l, 1 - Math.pow(0.02, s)); }
    else { camPos.copy(p); camLook.lerp(l, 1 - Math.pow(0.001, s)); camPos.y = p.y; }
  } else if (flight) {
    const g = pads[flight.pad].g.position, dist = 14 * Math.max(1, 0.75 / camera.aspect);
    p = new V3(g.x + 1.5, 2.6, g.z + dist); l = new V3(g.x, 4.2 + flight.t * 0.3, g.z);
    camPos.lerp(p, 1 - Math.pow(0.15, s)); camLook.lerp(l, 1 - Math.pow(0.15, s));
  } else {
    p = home.pos.clone().add(new V3(Math.sin(tNow * 0.12) * 1.2, Math.sin(tNow * 0.17) * 0.3, 0)); l = home.look;
    if (camSnap) { camPos.copy(p); camLook.copy(l); camSnap = false; }
    camPos.lerp(p, 1 - Math.pow(0.1, s)); camLook.lerp(l, 1 - Math.pow(0.1, s));
  }
  camera.position.copy(camPos); camera.position.x += rnd(shake * 0.3); camera.position.y += rnd(shake * 0.3);
  camera.lookAt(camLook); shake = Math.max(0, shake - s * 1.6);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
}
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function worldXAt(clientX) {
  if (!flight) return 0; const dist = camera.position.z - flight.z;
  const vh = 2 * dist * Math.tan(camera.fov * Math.PI / 360), vw = vh * camera.aspect;
  return camera.position.x + (clientX / innerWidth - 0.5) * vw;
}
const canvas = renderer.domElement;
let downAt = null;
canvas.addEventListener('pointerdown', e => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (flight && flight.phase === 'fly') { steer.down = true; steer.touched = true; steer.cx = e.clientX; if (flight.ring) sepTap(); }
});
addEventListener('pointermove', e => { if (steer.down) steer.cx = e.clientX; });
addEventListener('pointerup', e => {
  steer.down = false;
  if (!flight && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 10 && e.target === canvas) {
    ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pads.map(p => p.hit))[0]; if (hit) openPad(hit.object.userData.pad); else closePanels();
  }
  downAt = null;
});
addEventListener('keydown', e => {
  if (!flight || flight.phase !== 'fly') return;
  if (e.key === 'ArrowLeft') { steer.keys = -1; steer.touched = true; } if (e.key === 'ArrowRight') { steer.keys = 1; steer.touched = true; }
  if (e.key === ' ') { e.preventDefault(); steer.touched = true; sepTap(); }
});
addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') steer.keys = 0; });
addEventListener('resize', () => { layout(); buildDecos(); camSnap = true; });

let hudT = 0;
loop((dt, t) => {
  const s = Math.min(0.05, dt / 60); tNow = t;
  for (const c of clouds) { c.position.x += c.userData.v * s; if (c.position.x > 110) c.position.x = -110; }
  // pads
  pads.forEach((pad, i) => {
    const ps = padSt(i), T = TIERS[S.tier];
    const landed = pad.rocket.update(s);
    if (landed) { const p = pad.g.position.clone().add(new V3(0, MOUNT + landed.position.y + PART_H, 0)); sparks(p, landed.userData.color, 12); snd.clank(); shake = Math.max(shake, 0.08); }
    const fill = Math.max(0.001, ps.fuel / T.fuel); pad.tank.liq.scale.y = lerp(pad.tank.liq.scale.y, fill, 1 - Math.pow(0.05, s));
    if (pad.pump) { pad.pump = Math.max(0, pad.pump - s * 2); pad.tank.liq.material.emissiveIntensity = 0.45 + pad.pump * 0.8; }
    const gy = pad.gantry; gy.beacon.material.emissiveIntensity = (Math.sin(t * 4 + i) > 0.2) ? 2.5 : 0.2;
    gy.car.position.y = 1 + (Math.sin(t * 0.5 + i * 1.7) * 0.5 + 0.5) * (gy.top - 1.5);
    const armTarget = flight && flight.pad === i ? 1 : 0; pad.arms = lerp(pad.arms, armTarget, 1 - Math.pow(0.3, s)); gy.arms.forEach((a, k) => a.rotation.y = -pad.arms * (1.2 + k * 0.2));
    // crane: hook dips to the top of the stack when a part lands
    const hookY = Math.max(MOUNT + pad.rocket.height + 1.2 - 0.55, 1.5) - 0.55, hookTop = gy.top - 0.75;
    if (pad.crane) { pad.crane = Math.max(0, pad.crane - s * 1.2); }
    const hy = lerp(hookTop, Math.min(hookTop, hookY), Math.sin((pad.crane || 0) * Math.PI)); gy.hook.position.y = hy; gy.cable.scale.y = Math.max(0.2, gy.top + 0.35 - hy); gy.cable.position.y = (gy.top + 0.35 + hy) / 2;
    if (pad.test > 0) { pad.test -= s; const b = pad.g.position.clone().add(new V3(0, MOUNT - 0.35, 0)); if (pad.rocket.parts.length) { for (let k = 0; k < 3; k++) flame(b, 1.1); if (Math.random() < 0.5) smoke(b.clone().add(new V3(0, 0, 1.4)), { v: new V3(rnd(2), 0.8, 2.5), size: 0.8, grow: 3.5, life: 1.8 }); } else sparks(b, '#ffb000', 2); }
    if (pad.rework) { pad.rework = Math.max(0, pad.rework - s * 2.5); const top = pad.rocket.parts[pad.rocket.parts.length - 1]; if (top) top.rotation.z = Math.sin(pad.rework * 20) * 0.08 * pad.rework; }
    if (pad.shake) { pad.shake = Math.max(0, pad.shake - s); pad.rocket.g.position.x = rnd(0.03 * pad.shake * 3); } else pad.rocket.g.position.x = 0;
    const go = ps.go, ready = ps.parts.length >= MIN_PARTS;
    pad.lamps[0].material.emissiveIntensity = !ready ? 1.6 : 0.1; pad.lamps[1].material.emissiveIntensity = ready && !go ? 1.6 : 0.1; pad.lamps[2].material.emissiveIntensity = go ? (Math.sin(t * 6) > 0 ? 2 : 1) : 0.1;
  });
  // crew
  for (const a of [...crew.values()]) {
    if (a.parent) { const p = crew.get(a.parent); if (!p || a.leaving || Date.now() - a.last > 4 * 60e3) { a.m.position.y += s * 3; a.m.scale.multiplyScalar(Math.pow(0.4, s)); if (a.m.scale.x < 0.1) remove(a); continue; } }
    else if (Date.now() - a.last > 30 * 60e3) { remove(a); continue; }
    const pi_ = leadPad(a); const pad = pads[pi_ != null ? pi_ : 0]; if (!pad) continue;
    const pp = pad.g.position; a.st = Math.max(0, a.st - s); if (!a.st && a.state !== 'idle') a.state = 'idle';
    if (a.parent) {
      const ang = t * 0.9 + a.slot * 2.1 + hash(a.id) % 7, r = 1.35;
      const tgt = new V3(pp.x + Math.cos(ang) * r, MOUNT + 0.8 + (pad.rocket.height * (0.3 + 0.5 * ((a.slot * 0.37) % 1))) + Math.sin(t * 2 + a.slot) * 0.2, pp.z + Math.sin(ang) * r * 0.8 + 0.4);
      a.m.position.lerp(tgt, 1 - Math.pow(0.05, s)); a.m.lookAt(pp.x, a.m.position.y, pp.z); a.m.prop.rotation.y += s * 30;
      if (a.state === 'work' && Math.random() < 0.15) sparks(a.m.position.clone().add(new V3(0, -0.1, 0)), '#ffe066', 2);
      continue;
    }
    const sl = SLOTS[a.slot % SLOTS.length], tgt = new V3(pp.x + sl[0], 0.55, pp.z + sl[1]);
    const dx = tgt.x - a.m.position.x, dz = tgt.z - a.m.position.z, dd = Math.hypot(dx, dz), m = a.m;
    if (dd > 0.08) { const sp_ = Math.min(dd, s * 3.2); m.position.x += dx / dd * sp_; m.position.z += dz / dd * sp_; m.rotation.y = Math.atan2(dx, dz); m.run(t, 1); continue; }
    m.position.y = 0.55;
    if (a.wave > 0) { // waiting for the player: face the camera and wave
      m.rotation.y = lerp(m.rotation.y, 0, 0.2); m.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.4; m.armR.rotation.x = 0; m.armL.rotation.x = 0; m.legL.rotation.x = m.legR.rotation.x = 0;
      m.position.y = 0.55 + Math.abs(Math.sin(t * 5)) * 0.08; continue;
    }
    m.armR.rotation.z = 0;
    if (a.state === 'work') { m.rotation.y = Math.atan2(pp.x - m.position.x, pp.z - m.position.z); m.armR.rotation.x = -1.4 + Math.sin(t * 18) * 0.6; m.armL.rotation.x = -0.6; m.legL.rotation.x = m.legR.rotation.x = 0; }
    else if (a.state === 'think') { m.rotation.y = lerp(m.rotation.y, 0.3, 0.1); m.armR.rotation.x = -2.4; m.armL.rotation.x = 0; m.head.position.x = Math.sin(t * 3) * 0.04; }
    else if (a.state === 'cheer') { m.rotation.y = lerp(m.rotation.y, 0, 0.2); m.armL.rotation.x = m.armR.rotation.x = -2.8; m.position.y = 0.55 + Math.abs(Math.sin(t * 9)) * 0.3; }
    else { m.rotation.y = lerp(m.rotation.y, Math.sin(t * 0.3 + a.bob) * 0.5, 0.05); m.armL.rotation.x = m.armR.rotation.x = Math.sin(t * 1.5 + a.bob) * 0.08; m.legL.rotation.x = m.legR.rotation.x = 0; m.body.position.y = 0.95 + Math.sin(t * 2 + a.bob) * 0.015; }
  }
  // decorations
  if (decoAnim.radar) decoAnim.radar.rotation.y += s * (flight ? 2 : 0.5);
  if (decoAnim.sock) decoAnim.sock.rotation.y = Math.sin(t * 0.7) * 0.3;
  if (decoAnim.flag) { const pa = decoAnim.flag.geometry.attributes.position; for (let k = 0; k < pa.count; k++) { const x = pa.getX(k); pa.setZ(k, Math.sin(x * 2.5 - t * 5) * 0.12 * x); } pa.needsUpdate = true; }
  if (decoAnim.lights) for (const L of decoAnim.lights) { const on = flight ? 1 : 0.35; L.glow.material.opacity = on * (0.6 + Math.random() * 0.1); L.head.material.emissiveIntensity = on * 1.6; }
  if (decoAnim.crowd) { crowdJump = Math.max(0, crowdJump - s); decoAnim.crowd.forEach((m, k) => m.position.y = m.userData.y + (crowdJump > 0 ? Math.abs(Math.sin(t * 10 + k)) * 0.3 : 0)); }
  // launches
  if (flight) flightUpdate(s);
  else { cooldown -= s; if (cooldown <= 0 && queue.length) { const i = queue.shift(); if (padSt(i).parts.length >= 1) startFlight(i); } }
  rvUpdate(s, t);
  updateP(s); updateCamera(s);
  hudT -= s; if (hudT <= 0) { hudT = 0.5; idleCheck(); if (RVR.dirty) rvPanel(); }
  RVR.syncT -= s; if (RVR.syncT <= 0) { RVR.syncT = 1.5; rvSync(); }
});

// ------------------------------------------------------------------ HUD + panels
function hud() {
  $('ticker').style.display = flight ? 'none' : '';
  $('sci').textContent = fmt(S.sci); $('lt').textContent = day().launches.length; $('far').textContent = PLANETS[Math.max(...S.visited)].name; $('tier').textContent = TIERS[S.tier].name;
  const rk = rankLine(); $('rankTag').textContent = rk ? ' ' + rk.split(' ').slice(1).join(' ') : '';
}
function idleCheck() {
  const leads = [...crew.values()].filter(a => !a.parent).length;
  $('idle').hidden = !(mode === 'live' && !A.demo && A.connected.length && !leads && !flight);
}
function closePanels() { for (const id of ['padPop', 'map', 'shop', 'today']) $(id).hidden = true; }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closePanels);
function openPad(i) {
  closePanels(); const ps = padSt(i), T = TIERS[S.tier], pad = pads[i];
  const r = reachOf(ps, S.tier), names = pad.crew.map(id => crew.get(id)).filter(Boolean);
  const el = $('padPop');
  el.innerHTML = `<header><h2>Pad ${i + 1}</h2><button class="x" data-close>✕</button></header>
    <p class="fine">${names.length ? 'Crew: ' + names.map(a => `<b style="color:${a.color}">${esc(a.label)}</b>`).join(', ') : 'No agent on this pad yet.'}</p>
    <div>Stack <b>${ps.parts.length}/${T.parts}</b> parts</div><div class="bar"><i style="width:${ps.parts.length / T.parts * 100}%;background:#ff7a2f"></i></div>
    <div>Fuel <b>${Math.round(Math.min(1, ps.fuel / T.fuel) * 100)}%</b></div><div class="bar"><i style="width:${Math.min(1, ps.fuel / T.fuel) * 100}%;background:#36c8ff"></i></div>
    <div>${ps.go ? '<b style="color:#3cf0c0">GO for launch</b> (tests passed, +10% reach)' : 'Not GO yet: a passing test run gives +10% reach'}</div>
    <p>Est. reach <b>${Math.round(r)}</b> → <b>${PLANETS[planetFor(r)].name}</b>${ps.clear ? ' · commit cleared, launches at ' + MIN_PARTS + ' parts' : ''}</p>
    <button class="big" id="bLaunch" ${ps.parts.length < MIN_PARTS || flight || queue.includes(i) ? 'disabled' : ''}>${queue.includes(i) ? 'In the launch queue' : ps.parts.length < MIN_PARTS ? `Needs ${MIN_PARTS} parts to launch` : 'LAUNCH NOW'}</button>
    <p class="fine">A commit launches automatically. Edits add parts, tokens pump fuel. Waiting for a full stack goes further.</p>`;
  el.hidden = false; el.querySelector('[data-close]').onclick = closePanels;
  const b = $('bLaunch'); if (b) b.onclick = () => { queueLaunch(i); cooldown = Math.min(cooldown, 0.2); closePanels(); };
}
$('bShop').onclick = () => { const was = !$('shop').hidden; closePanels(); if (!was) renderShop(); };
function renderShop() {
  const el = $('shopList'), items = [];
  if (S.pads < MAX_PADS) items.push({ k: 'pad', name: `Launch pad ${S.pads + 1}`, price: PAD_PRICE[S.pads], about: 'Another gantry and fuel tank, so more agents build at once.' });
  if (S.tier < TIERS.length - 1) items.push({ k: 'tier', name: `${TIERS[S.tier + 1].name} rockets`, price: TIER_PRICE[S.tier], about: `Taller gantries: ${TIERS[S.tier + 1].parts}-part stacks, bigger tanks, ×${TIERS[S.tier + 1].mult} thrust.` });
  for (const d of DECOS) if (!S.deco.includes(d.id)) items.push({ k: 'deco', id: d.id, name: d.name, price: d.price, about: d.about });
  el.innerHTML = `<p class="fine">You have <b style="color:#3cf0c0">${fmt(S.sci)} science</b>. Earn it by reaching worlds; first visits pay a bonus.</p>` + (mode === 'demo' ? '<p class="fine warn">Demo lab: purchases reset. Connect your agents to keep your space program.</p>' : '') +
    items.map((it, k) => `<div class="item"><b>${it.name}</b><button data-k="${k}" ${S.sci < it.price ? 'disabled' : ''}>${it.price} sci</button><p>${it.about}</p></div>`).join('') + (items.length ? '' : '<p>Everything bought. You run the finest launch site in the galaxy.</p>');
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const it = items[+b.dataset.k]; if (S.sci < it.price) return; S.sci -= it.price;
    if (it.k === 'pad') S.pads++; else if (it.k === 'tier') S.tier++; else S.deco.push(it.id);
    snd.win(); buildPads(); save(); hud(); renderShop(); $('shop').hidden = false; toast(`${it.name}: done!`, 2500);
  });
  $('shop').hidden = false;
}
$('bMap').onclick = () => { const was = !$('map').hidden; closePanels(); if (!was) renderMap(); };
function renderMap() {
  const cv = $('mapCv'), g = cv.getContext('2d'), W = cv.width, Hh = cv.height, cx = 90, cy = Hh / 2;
  g.clearRect(0, 0, W, Hh); const r = rng(9);
  for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; g.fillRect(r() * W, r() * Hh, 1.5, 1.5); }
  const sg = g.createRadialGradient(cx - 120, cy, 10, cx - 120, cy, 170); sg.addColorStop(0, '#fff6c0'); sg.addColorStop(0.35, '#ffb347'); sg.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, Hh);
  const far = Math.max(...S.visited);
  PLANETS.forEach((p, k) => {
    const x = cx + 30 + k * 118, y = cy + Math.sin(k * 1.7) * 90, rad = [16, 11, 15, 22, 13, 30, 18][k], seen = S.visited.includes(k);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx - 120, cy, x - (cx - 120), -0.6, 0.6); g.stroke();
    if (k) { g.setLineDash([4, 6]); g.strokeStyle = seen ? 'rgba(60,240,192,.6)' : 'rgba(255,255,255,.2)'; g.beginPath(); const px = cx + 30 + (k - 1) * 118, py = cy + Math.sin((k - 1) * 1.7) * 90; g.moveTo(px, py); g.lineTo(x, y); g.stroke(); g.setLineDash([]); }
    if (p.ring) { g.strokeStyle = seen ? p.ring : '#555a7a'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, rad * 1.9, rad * 0.55, -0.3, 0, 7); g.stroke(); }
    const pg = g.createRadialGradient(x - rad * 0.4, y - rad * 0.4, 1, x, y, rad); pg.addColorStop(0, seen ? p.c3 : '#666a88'); pg.addColorStop(1, seen ? p.c1 : '#2c3050');
    g.fillStyle = pg; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    g.fillStyle = seen ? '#fff' : '#8c89aa'; g.font = '600 17px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(seen ? p.name : '???', x, y + rad + (p.ring ? 30 : 22));
    g.font = '13px Fredoka, sans-serif'; g.fillStyle = '#b8b4d4'; g.fillText(k ? 'reach ' + p.req : 'start', x, y + rad + (p.ring ? 46 : 38));
    if (k === S.probe) { g.fillStyle = '#3cf0c0'; g.beginPath(); g.moveTo(x, y - rad - 18); g.lineTo(x - 7, y - rad - 30); g.lineTo(x + 7, y - rad - 30); g.fill(); g.font = '600 12px Fredoka'; g.fillText('PROBE', x, y - rad - 34); }
  });
  const bestPad = Math.max(0, ...pads.map((_, i) => reachOf(padSt(i), S.tier)));
  $('mapList').innerHTML = `<p class="fine">Farthest world: <b>${PLANETS[far].name}</b> · best reach ${S.best.reach} · your fullest pad flies about <b>${Math.round(bestPad)}</b> right now. Deploys push your probe one world further.</p>` +
    PLANETS.map((p, k) => `<div class="wl ${S.visited.includes(k) ? '' : 'lock'}"><i style="background:${p.c1}"></i><span><b>${S.visited.includes(k) ? p.name : '???'}</b> <small class="fine">${p.kind}</small></span><span>${S.visited.includes(k) ? '✓ ' + p.sci + ' sci' : 'reach ' + p.req}</span></div>`).join('');
  $('map').hidden = false;
}
$('bToday').onclick = () => { const was = !$('today').hidden; closePanels(); if (!was) renderToday(); };
function renderToday() {
  const d = day(), best = d.launches.length ? PLANETS[d.best].name : '—';
  const top = Object.entries(d.agents).sort((a, b) => b[1] - a[1]).slice(0, 4);
  $('todayBody').innerHTML = (mode === 'demo' ? '<p class="fine warn">This is the demo team. Connect your agents for your real day.</p>' : '') + `<div class="grid">
    <div><b>${d.launches.length}</b><small>launches</small></div><div><b>${best}</b><small>farthest today</small></div><div><b>+${d.sci}</b><small>science</small></div>
    <div><b>${d.parts}</b><small>parts bolted</small></div><div><b>${fmt(d.fuel)}</b><small>fuel (tokens)</small></div><div><b>${d.gos}</b><small>GO calls (tests)</small></div>
    <div><b>${d.commits}</b><small>commits</small></div><div><b>${d.deploys}</b><small>deploys</small></div><div><b>${d.reworks}</b><small>reworks</small></div></div>
    ${top.length ? `<p class="fine">Busiest crews: ${top.map(([l, n]) => `<b>${esc(l)}</b> (${n})`).join(', ')}</p>` : ''}
    ${d.launches.slice(-8).reverse().map(l => `<div class="ll"><i style="background:${l.color}"></i>${new Date(l.t).toTimeString().slice(0, 5)} → <b>${PLANETS[l.planet].name}</b> <span class="fine">${l.auto ? 'auto-launch while away' : l.acc + '% on course'} · +${l.sci}</span></div>`).join('') || '<p class="fine">No launches yet today. Your agents launch on every commit, or tap a pad with 3+ parts.</p>'}
    <p class="fine">Records: ${S.launches} launches all time · best accuracy ${S.best.acc}% · ${S.streak.n > 1 ? S.streak.n + '-day launch streak' : 'launch tomorrow to start a streak'}</p>`;
  $('today').hidden = false;
}
$('bConnect').onclick = () => A.open();
$('bBoard').onclick = () => { closePanels(); B.open(); };
$('bShare').onclick = share;
async function share() {
  const d = day(), out = document.createElement('canvas'); out.width = 1200; out.height = 630; const g = out.getContext('2d');
  renderer.render(scene, camera); const src = renderer.domElement;
  const sw = src.width, sh = src.height, want = 700 / 630; let cw = sw, ch = sw / want; if (ch > sh) { ch = sh; cw = sh * want; }
  g.fillStyle = '#16204a'; g.fillRect(0, 0, 1200, 630); g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 700, 630);
  const gr = g.createLinearGradient(640, 0, 760, 0); gr.addColorStop(0, 'rgba(22,32,74,0)'); gr.addColorStop(1, '#16204a'); g.fillStyle = gr; g.fillRect(640, 0, 120, 630);
  g.fillStyle = '#16204a'; g.fillRect(760, 0, 440, 630);
  g.fillStyle = '#ff7a2f'; g.font = '700 46px Fredoka, sans-serif'; g.fillText('LIFTOFF LAB', 770, 80);
  g.fillStyle = '#fff'; g.font = '600 26px Fredoka, sans-serif'; g.fillText('My AI agents today', 770, 122);
  const rows = [[d.launches.length, 'rockets launched'], [d.launches.length ? PLANETS[d.best].name : '—', 'farthest world'], [d.parts, 'parts bolted on'], [fmt(d.fuel), 'fuel pumped (tokens)'], ['+' + d.sci, 'science']];
  rows.forEach(([v, l], k) => { g.fillStyle = '#3cf0c0'; g.font = '700 40px Fredoka, sans-serif'; g.fillText(String(v), 770, 190 + k * 76); g.fillStyle = '#b8b4d4'; g.font = '500 20px Fredoka, sans-serif'; g.fillText(l, 770, 214 + k * 76); });
  const rk = rankLine(); if (rk) { g.fillStyle = '#ffcf3f'; g.font = '700 28px Fredoka, sans-serif'; g.fillText('🏆 ' + rk, 770, 596); }
  else { g.fillStyle = '#8c89aa'; g.font = '500 18px Fredoka, sans-serif'; g.fillText('riffcade.com', 770, 600); }
  const blob = await new Promise(r => out.toBlob(r, 'image/png')), file = new File([blob], 'liftoff-lab.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents today', text: `My AI agents launched ${d.launches.length} rockets today on Liftoff Lab`, url: location.href.split('?')[0] }); } catch (e) { return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'liftoff-lab.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ------------------------------------------------------------------ boot
let B = null;
function submitScore() { if (B && mode === 'live') B.submit(day().sci); }
buildPads(); hud(); setSky(0);
const A = agents({
  game: 'agent-rockets', title: 'LIFTOFF LAB', tagline: 'A space program for your AI agents.', accent: '#ff8a3d', demoAgents: 4,
  about: 'Every Claude Code or Codex session becomes an engineer at a launch pad. Tokens pump fuel, edits bolt on rocket parts, passing tests call GO, and a commit launches. You are flight director: steer each rocket through max-Q, time the stage separations and reach new worlds.',
  onEvents,
});
window.__A = A;
B = board({ game: 'agent-rockets', label: 'Science', A });
window.__B = B;
B.onRival(evs => { rvSync(); for (const e of evs) rvEvent(e); });
window.__game = { sepTap: () => sepTap(), get S() { return S; }, get mode() { return mode; }, real, crew, pads, queue, get flight() { return flight; } };

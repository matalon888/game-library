// Bloop Stack deep v2 — 36 hand-made levels (levels.js, rules in sim.js), stars, a level map, hats and jelly colours.
// The look is v1's (jelly blob, pastel meadow); the rules are sim.js (fixed 60 Hz, identical for every player).
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { LEVELS, WORLDS } from './levels.js';
import { PAR } from './par.js';
import { parse, start as simStart, step as simStep, tap as simTap, stars as simStars, cAt, gAt } from './sim.js';

const NAME = 'Bloop Stack: Block Tower Runner';
const S = store('bloopdeep');
const F = flow('bloopstack');           // only reports results (the tuner owns the numbers); v2 never reads F.k()
const B = board({ game: 'bloop-stack', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });
const JELLY = ['#ff6fa3', '#ffcf3f', '#56c8ff', '#9a7bff', '#4fd8a0', '#ff8a4c'];
const QS = new URLSearchParams(location.search);

// ---------------------------------------------------------------- save
let prog = S.get('p', {});                      // { [level 1..36]: { s: stars 0-3, g: gems } }
let hatId = S.get('hat', 0), colId = S.get('col', 0), seenUnlocks = S.get('seen', { hat: 0, col: 0 }), fails = {};
const save = () => { S.set('p', prog); S.set('hat', hatId); S.set('col', colId); S.set('seen', seenUnlocks); };
let daily = S.get('daily', { d: '', n: 0, done: false, streak: 0, last: '', bonus: 0 }), dailyRun = false;
const dayKey = (o = 0) => { const d = new Date(Date.now() + o * 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const saveDaily = () => S.set('daily', daily);
const totalStars = () => Object.values(prog).reduce((a, p) => a + (p.s || 0), 0) + (daily.bonus || 0);
const totalGems = () => Object.values(prog).reduce((a, p) => a + (p.g || 0), 0);
const nextOpen = () => { let i = 1; while (i <= LEVELS.length && (prog[i] || {}).s >= 1) i++; return Math.min(i, LEVELS.length); };
const isOpen = (n) => n <= nextOpen() || (prog[n] || {}).s >= 1;
function dailyToday() {
  const k = dayKey();
  if (daily.d !== k) {
    if (daily.last && daily.last !== dayKey(-1)) daily.streak = 0;
    let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const hi = nextOpen(), lo = Math.max(1, Math.floor(hi / 2));
    daily.d = k; daily.n = lo + (h % (hi - lo + 1)); daily.done = false; saveDaily();
  }
  return daily;
}

const HATS = [
  { name: 'Sprout', need: 0 }, { name: 'Red cap', need: 3 }, { name: 'Party cone', need: 8 }, { name: 'Top hat', need: 14 }, { name: 'Cat ears', need: 21 },
  { name: 'Halo', need: 30 }, { name: 'Propeller', need: 40 }, { name: 'Crown', need: 52 }, { name: 'Wizard', need: 66 }, { name: 'Chef', need: 82 },
];
const COLS = [
  { name: 'Mint', need: 0, c: '#2fd1b4', belly: '#c9fff2' }, { name: 'Bubblegum', need: 15, c: '#ff6fa3', belly: '#ffe0ec' }, { name: 'Sunny', need: 40, c: '#ffcf3f', belly: '#fff3c4' },
  { name: 'Sky', need: 75, c: '#56c8ff', belly: '#dff5ff' }, { name: 'Grape', need: 115, c: '#9a7bff', belly: '#e8e0ff' }, { name: 'Lime', need: 160, c: '#8be04e', belly: '#eaffd2' },
  { name: 'Rainbow', need: 215, c: 'rainbow', belly: '#ffffff' },
];

// ---------------------------------------------------------------- stage + textures
const stage = createStage({ fov: 40, shadowSize: 16 });
const { scene, camera, sun } = stage;
sun.intensity = 1.5;
stage.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); sun.shadow.mapSize.set(512, 512); sun.shadow.needsUpdate = true; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
const ui = createUI({ title: '', progress: true, score: false });
ui.els.sc.classList.add('hc-hidden'); ui.hideStart();

function dirtTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(120,40,20,.16)'; x.fillRect(0, 20, 64, 5); x.fillRect(0, 46, 64, 5);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, 64, 3);
  for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(120,40,20,.12)'; x.fillRect((i * 37) % 60, (i * 23) % 60, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
function stripeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffd23f'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#2b2d42';
  for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 16, 64); x.lineTo(i * 16 + 8, 64); x.lineTo(i * 16 + 40, 0); x.lineTo(i * 16 + 32, 0); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const CELL = new THREE.BoxGeometry(1, 1, 3), MAXCELL = 5200;
const dirtMat = mat('#ffffff', { map: dirtTex(), roughness: 0.8 });
const dirt = new THREE.InstancedMesh(CELL, dirtMat, MAXCELL); dirt.receiveShadow = true; dirt.frustumCulled = false; scene.add(dirt);
const grass = new THREE.InstancedMesh(rounded(1.02, 0.34, 3.12, 0.08), mat('#ffffff', { roughness: 0.6 }), 800); grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);
const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.3, 5), mat('#5fd35a'), 500); tuft.frustumCulled = false; scene.add(tuft);
const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ffffff'), 140); flowers.frustumCulled = false; scene.add(flowers);
const BLOCK = rounded(0.94, 0.94, 0.94, 0.16);
const bg = new THREE.Group(); scene.add(bg);
const hillMat = mat('#9be3a4', { roughness: 1 }), hill2 = mat('#c3efc4', { roughness: 1 }), cloudMat = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
const HILL = new THREE.SphereGeometry(1, 24, 12), PUFF = new THREE.SphereGeometry(1, 14, 10);
const world = new THREE.Group(); scene.add(world);           // per-level objects: roofs, gems, pads, flags
const stripeMat = mat('#ffffff', { map: stripeTex(), roughness: 0.5 });
const roofMat = mat('#c2603c', { roughness: 0.85 });
const steel = mat('#8d93ad', { roughness: 0.4, metalness: 0.5 });

// ---------------------------------------------------------------- hero: Bloop (v1 look) + hats + colours
function makeBloop() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = glossy('#2fd1b4', { emissive: '#000000' });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.47, 28, 20), skin); b.scale.set(1.05, 0.92, 1); b.castShadow = true; body.add(b);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), mat('#c9fff2')); belly.position.set(0.1, -0.12, 0.25); belly.scale.set(1, 0.8, 0.6); body.add(belly);
  const white = mat('#ffffff', { roughness: 0.3 }), black = glossy('#1d1d2b');
  const eyes = [];
  for (const ex of [-0.12, 0.2]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), white); e.position.set(ex, 0.12, 0.38); e.scale.set(1, 1.15, 0.6); body.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), black); p.position.set(ex + 0.05, 0.11, 0.45); body.add(p); eyes.push(e);
  }
  for (const cx of [-0.26, 0.36]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#ff8fb3')); c.position.set(cx, -0.04, 0.36); c.scale.set(1.3, 0.7, 0.4); body.add(c); }
  const hat = new THREE.Group(); hat.position.y = 0.38; body.add(hat);
  g.body = body; g.skin = skin; g.belly = belly; g.hat = hat; g.eyes = eyes; return g;
}
const hero = makeBloop(); scene.add(hero);
let propeller = null, haloMesh = null;
function setHat(id) {
  const h = hero.hat; while (h.children.length) h.remove(h.children[0]); propeller = null; haloMesh = null;
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; h.add(o); return o; };
  if (id === 0) {
    const leafM = mat('#5fd35a'); add(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6), leafM, 0, 0.12, 0);
    for (const s of [-1, 1]) { const l = add(new THREE.SphereGeometry(0.11, 10, 8), leafM, s * 0.12, 0.24, 0, 0, s * 0.5); l.scale.set(1.4, 0.35, 0.8); }
  } else if (id === 1) {
    add(new THREE.SphereGeometry(0.34, 20, 12, 0, 6.283, 0, 1.45), glossy('#ff4d5e'), 0, -0.02, 0); add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20, 1, false, -0.9, 1.8), glossy('#d83446'), 0.27, 0, 0.04, 0, 0).scale.set(1.1, 1, 1);
    add(new THREE.SphereGeometry(0.05, 8, 6), glossy('#ffffff'), 0, 0.33, 0);
  } else if (id === 2) {
    add(new THREE.ConeGeometry(0.28, 0.62, 18), glossy('#ff6fa3'), 0, 0.2, 0); add(new THREE.TorusGeometry(0.17, 0.035, 8, 18), glossy('#ffe66d'), 0, 0.1, 0, 1.57).scale.set(1, 1, 1);
    add(new THREE.SphereGeometry(0.07, 10, 8), glossy('#56c8ff'), 0, 0.54, 0);
  } else if (id === 3) {
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 22), glossy('#232337'), 0, 0.02, 0); add(new THREE.CylinderGeometry(0.26, 0.28, 0.5, 20), glossy('#232337'), 0, 0.28, 0); add(new THREE.CylinderGeometry(0.285, 0.285, 0.1, 20), glossy('#e0334e'), 0, 0.1, 0);
  } else if (id === 4) {
    for (const s of [-1, 1]) { add(new THREE.ConeGeometry(0.13, 0.3, 4), glossy('#444466'), s * 0.26, 0.14, 0, 0, -s * 0.35); add(new THREE.ConeGeometry(0.07, 0.18, 4), glossy('#ff9fbf'), s * 0.26, 0.12, 0.05, 0, -s * 0.35); }
  } else if (id === 5) {
    haloMesh = add(new THREE.TorusGeometry(0.28, 0.045, 10, 28), glossy('#ffe66d', { emissive: '#ffcf3f', emissiveIntensity: 0.7 }), 0, 0.4, 0, 1.45);
  } else if (id === 6) {
    add(new THREE.SphereGeometry(0.34, 20, 12, 0, 6.283, 0, 1.45), glossy('#56c8ff'), 0, -0.02, 0); add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), steel, 0, 0.34, 0);
    propeller = new THREE.Group(); propeller.position.y = 0.4; h.add(propeller);
    for (const s of [0, 1.5708, 3.1416, 4.712]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.09), glossy(s % 3.1416 ? '#ffe66d' : '#ff4d5e')); bl.position.set(Math.cos(s) * 0.17, 0, Math.sin(s) * 0.17); bl.rotation.y = -s; propeller.add(bl); }
  } else if (id === 7) {
    add(new THREE.CylinderGeometry(0.3, 0.27, 0.2, 5), glossy('#ffcf3f', { emissive: '#7a5a00', emissiveIntensity: 0.3 }), 0, 0.06, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; add(new THREE.ConeGeometry(0.07, 0.22, 4), glossy('#ffcf3f'), Math.cos(a) * 0.27, 0.27, Math.sin(a) * 0.27); add(new THREE.SphereGeometry(0.04, 8, 6), glossy(JELLY[i]), Math.cos(a) * 0.27, 0.4, Math.sin(a) * 0.27); }
  } else if (id === 8) {
    add(new THREE.ConeGeometry(0.3, 0.8, 18), glossy('#6b4fd8'), 0, 0.3, 0); add(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 22), glossy('#5a3fc0'), 0, -0.04, 0);
    add(new THREE.SphereGeometry(0.06, 8, 6), glossy('#ffe66d', { emissive: '#ffcf3f', emissiveIntensity: 0.8 }), 0.08, 0.2, 0.28); add(new THREE.SphereGeometry(0.05, 8, 6), glossy('#ffe66d', { emissive: '#ffcf3f', emissiveIntensity: 0.8 }), -0.08, 0.45, 0.2);
  } else if (id === 9) {
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 20), glossy('#ffffff'), 0, 0.02, 0); for (const [x, z] of [[0, 0], [0.18, 0.1], [-0.18, 0.1], [0.12, -0.16], [-0.12, -0.16]]) add(new THREE.SphereGeometry(0.19, 14, 10), glossy('#ffffff'), x, 0.22, z);
  }
}
function setCol(id) {
  const c = COLS[id] || COLS[0]; hero.colId = id;
  if (c.c !== 'rainbow') hero.skin.color.set(c.c);
  hero.belly.material.color.set(c.belly);
}
setHat(hatId); setCol(colId);

// ---------------------------------------------------------------- finish flag, checkpoint flags
function makeFlag(h, col, big) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 10), glossy('#ffffff')); pole.position.set(0, h / 2, -0.6); pole.castShadow = true; g.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), glossy('#ffd23f')); knob.position.set(0, h + 0.05, -0.6); g.add(knob);
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { x.fillStyle = big ? ((i + j) % 2 ? '#2b2d42' : '#fff') : ((i + j) % 2 ? col : '#fff'); x.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  const geo = new THREE.PlaneGeometry(big ? 1.8 : 1.1, big ? 1.2 : 0.75, 12, 1); geo.translate(big ? 0.9 : 0.55, 0, 0);
  const fl = new THREE.Mesh(geo, mat('#ffffff', { map: t, side: THREE.DoubleSide })); fl.position.set(0.05, h - 0.75, -0.6); fl.castShadow = true; g.add(fl);
  fl.base = geo.attributes.position.array.slice(); g.fl = fl; return g;
}
const finish = makeFlag(5, '#000', true); scene.add(finish);
let cpFlags = [];

// ---------------------------------------------------------------- state
let T = null, L = null, W = null, cur = 1, s = null, speed = 5, state = 'ready', cp = null, cpIdx = -1, tries = 0;
let cubes = [], debris = [], cubePool = [], gems = [], pads = [], roofs = [], pops = [], bgSpin = [];
let camX = 0, camY = 3, heroLift = 0, squash = 0, clock = 0, flyV = null, hitstop = 0, shake = 0, acc = 0, pvx = 0, pvb = 1, vx = 0, vb = 1;
let tapRun = 0, lastTapT = 0, goldN = 0, recorded = false, started = false, tapped = false, flushNow = 0, deadAt = 0, gemChain = 0, lastGemF = -99, bannerT = null;
const auto = { taps: null, turbo: 1 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function getCube(col) {
  let m = cubePool.pop();
  if (!m) { m = new THREE.Mesh(BLOCK, glossy('#ffffff')); m.castShadow = true; m.receiveShadow = true; }
  m.material.color.set(col); m.material.emissive.set(col); m.material.emissiveIntensity = 0.12; m.scale.setScalar(1); m.rotation.set(0, 0, 0);
  m.visible = true; scene.add(m); return m;
}
function freeCube(m) { scene.remove(m); cubePool.push(m); }

// ---------------------------------------------------------------- HUD (own DOM, SVG icons)
const IC = {
  gem: (c, z) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24"><path d="M12 2 21 9 12 22 3 9Z" fill="${c}"/><path d="M12 2 21 9H3Z" fill="rgba(255,255,255,.45)"/><path d="M12 22 8 9h8Z" fill="rgba(0,0,0,.12)"/></svg>`,
  star: (c, z) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24"><path d="m12 1.8 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.5 5.7 21.2l1.5-7.1L1.8 9.2 9 8.4Z" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="1"/></svg>`,
  map: (c, z) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="${c}"><rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/><rect x="13" y="13" width="8" height="8" rx="2.4"/></svg>`,
  redo: (c, z) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3v6h-6" /></svg>`,
  lock: (c, z) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="${c}"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="${c}" stroke-width="2.6"/></svg>`,
  hat: (c, z) => `<svg width="${z}" height="${z}" viewBox="0 0 24 24" fill="${c}"><path d="M3 17h18v3H3zM6 16V9a6 6 0 0 1 12 0v7z"/></svg>`,
};
const starsRow = (n, z = 18, on = '#ffd23f', off = 'rgba(255,255,255,.45)') => [0, 1, 2].map(i => IC.star(i < n ? on : off, z)).join('');
const CSS = `
.bl-btn{position:fixed;z-index:7;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.85);box-shadow:0 3px 0 rgba(0,0,0,.14);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;touch-action:manipulation}
.bl-map{right:12px;top:calc(12px + env(safe-area-inset-top))}
.bl-hud{position:fixed;z-index:6;left:0;right:0;top:calc(58px + env(safe-area-inset-top));display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none}
.bl-name{font-weight:800;font-size:17px;text-shadow:0 2px 0 rgba(0,0,0,.2);line-height:1}
.bl-name small{display:block;font-weight:600;font-size:13px;opacity:.95;margin-top:3px;max-width:86vw;margin-inline:auto}
.bl-row{display:flex;gap:10px;align-items:center;background:rgba(0,0,0,.2);border-radius:20px;padding:4px 12px;font-weight:800;font-size:15px}
.bl-row span{display:flex;gap:4px;align-items:center}
.bl-row .got{filter:drop-shadow(0 0 5px #fff)}
.bl-tap{position:fixed;z-index:6;left:0;right:0;bottom:16%;text-align:center;font-weight:800;font-size:30px;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,.25);animation:blpulse .7s ease-in-out infinite alternate}
@keyframes blpulse{from{transform:scale(1)}to{transform:scale(1.14)}}
.bl-wrap{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(30,20,60,.35);backdrop-filter:blur(2px);animation:blfade .18s ease-out}
@keyframes blfade{from{opacity:0}to{opacity:1}}
.bl-card{width:min(360px,92vw);max-height:92vh;overflow:auto;background:linear-gradient(180deg,var(--m1,#fff),var(--m2,#fff));color:#3a2f55;border-radius:26px;padding:18px 16px 16px;text-align:center;box-shadow:0 10px 0 rgba(0,0,0,.18),0 0 40px rgba(0,0,0,.25)}
.bl-card h2{margin:0 0 2px;font-size:34px;line-height:1;color:var(--ui,#ff5d8f);text-shadow:0 3px 0 rgba(0,0,0,.08)}
.bl-card p{margin:2px 0;font-weight:600;font-size:15px}
.bl-big{display:flex;justify-content:center;gap:2px;margin:6px 0 4px}
.bl-big svg{animation:blstar .5s cubic-bezier(.3,1.8,.5,1) both}
.bl-big svg.dim{opacity:.35;animation:none}
@keyframes blstar{from{transform:scale(0) rotate(-120deg)}to{transform:scale(1) rotate(0)}}
.bl-go{display:block;width:100%;border:0;border-radius:18px;padding:12px;font:800 24px 'Baloo 2',system-ui,sans-serif;color:#fff;background:var(--ui,#ff5d8f);box-shadow:0 5px 0 rgba(0,0,0,.2);margin-top:10px;cursor:pointer;touch-action:manipulation}
.bl-go:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.bl-sm{border:0;border-radius:14px;padding:7px 12px;margin:8px 4px 0;font:700 15px 'Baloo 2',system-ui,sans-serif;background:rgba(255,255,255,.7);color:#4a3d6e;cursor:pointer;display:inline-flex;gap:6px;align-items:center;touch-action:manipulation}
.bl-lose{position:fixed;z-index:20;left:0;right:0;bottom:7%;display:flex;flex-direction:column;align-items:center;gap:8px;animation:blup .22s ease-out}
@keyframes blup{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
.bl-lose .msg{background:rgba(255,255,255,.92);color:#3a2f55;border-radius:18px;padding:8px 18px;font-weight:800;font-size:20px;box-shadow:0 4px 0 rgba(0,0,0,.18);text-align:center}
.bl-lose .msg small{display:block;font-weight:600;font-size:14px;opacity:.8}
.bl-lose .bl-go{width:min(260px,70vw);margin:0}
.bl-tabs{display:flex;gap:6px;margin:6px 0 8px}
.bl-tab{flex:1;border:0;border-radius:14px;padding:6px 2px;font:800 14px 'Baloo 2',system-ui,sans-serif;background:rgba(255,255,255,.6);color:#4a3d6e;line-height:1.1;cursor:pointer}
.bl-tab small{display:block;font-size:12px;opacity:.75}
.bl-tab.on{background:var(--ui);color:#fff}
.bl-tab.lk{opacity:.55}
.bl-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bl-node{position:relative;border:0;border-radius:16px;padding:8px 0 5px;background:#fff;color:#4a3d6e;font:800 22px 'Baloo 2',system-ui,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.14);cursor:pointer;touch-action:manipulation;line-height:1}
.bl-node .st{display:flex;justify-content:center;margin-top:3px;height:14px}
.bl-node.lk{background:rgba(255,255,255,.45);color:#9a90b5;box-shadow:none}
.bl-node.next{background:var(--ui);color:#fff;animation:blpulse .6s ease-in-out infinite alternate}
.bl-node.hard{outline:3px solid #ff4d5e;outline-offset:-3px}
.bl-node .hb{position:absolute;top:-6px;right:-3px;background:#ff4d5e;color:#fff;border-radius:8px;font-size:10px;padding:1px 5px}
.bl-bar{height:12px;border-radius:8px;background:rgba(255,255,255,.7);margin:10px 0 3px;overflow:hidden}
.bl-bar i{display:block;height:100%;background:var(--ui);border-radius:8px}
.bl-sks{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:6px 0}
.bl-sk{border:0;border-radius:12px;background:rgba(255,255,255,.65);padding:6px 1px;font:700 11px 'Baloo 2',system-ui,sans-serif;color:#4a3d6e;line-height:1.1;cursor:pointer}
.bl-sk .sw{width:30px;height:30px;border-radius:50%;margin:0 auto 3px}
.bl-sk.lk{opacity:.6}.bl-sk.on{outline:3px solid var(--ui)}
.bl-new{background:var(--ui);color:#fff;border-radius:14px;padding:5px 10px;font-weight:800;margin-top:6px;animation:blpulse .5s ease-in-out infinite alternate}
`;
const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
const dom = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const mapBtn = dom(`<button class="bl-btn bl-map" aria-label="Levels">${IC.map('#5a3fa0', 24)}</button>`);
const hud = dom(`<div class="bl-hud"><div class="bl-name"></div><div class="bl-row"><span class="gm"></span><span class="fl"></span><span class="sr"></span></div></div>`);
document.body.append(mapBtn, hud);
const elName = hud.querySelector('.bl-name'), elGm = hud.querySelector('.gm'), elFl = hud.querySelector('.fl'), elSr = hud.querySelector('.sr');
mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
mapBtn.addEventListener('click', () => { if (state !== 'menu') showMap(); });

function hudUpdate() {
  const P = PAR[cur - 1], got = s ? s.gemsGot : 0, tot = T.gemTotal, per = s ? s.perfects : 0;
  elGm.innerHTML = tot ? `<span class="${got >= tot ? 'got' : ''}">${IC.gem('#7be3ff', 18)}${got}/${tot}</span>` : '';
  elFl.innerHTML = `<span class="${per >= P.req ? 'got' : ''}">FLUSH ${Math.min(per, 99)}/${P.req}</span>`;
  const won = s && s.status === 'won', both = tot === 0 || got >= tot;
  const nh = nextUnlock('hat', totalStars());
  if (nh) { const pv = HATS[HATS.indexOf(nh) - 1], lo = pv ? pv.need : 0, pc = Math.min(100, (totalStars() - lo) / (nh.need - lo) * 100); elFl.innerHTML += `<span class="bl-bar" style="display:inline-block;width:46px;height:8px;margin:0 0 0 6px;vertical-align:middle"><i style="width:${pc}%"></i></span>`; }
  elSr.innerHTML = [won, both && (got > 0 || won), both && per >= P.req && (got > 0 || won)].map(on => IC.star(on ? '#ffd23f' : 'rgba(255,255,255,.55)', 17)).join('');
}

// ---------------------------------------------------------------- build a level
function numTag(txt, col) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.font = '900 46px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(txt, 64, 34); g.fillStyle = col; g.fillText(txt, 64, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(1.5, 0.75, 1); sp.renderOrder = 9; return sp;
}
function build(n) {
  cur = n; L = LEVELS[n - 1]; W = WORLDS[Math.floor((n - 1) / 12)]; speed = L.speed || W.speed; T = parse(L.s);
  const wi = Math.floor((n - 1) / 12), bs = document.body.style;
  bs.setProperty('--bg1', W.sky[0]); bs.setProperty('--bg2', W.sky[1]); bs.setProperty('--ui', W.ui);
  const G = T.G, C = T.C;
  let k = 0, gk = 0, tk = 0, fl = 0;
  for (let i = 0; i < G.length; i++) {
    _c.set(W.dirt[i % 2]);
    for (let y = -6; y < G[i] && k < MAXCELL; y++) { _m.compose(_p.set(i + 0.5, y + 0.5, 0), _q.identity(), _s.set(1, 1, 1)); dirt.setMatrixAt(k, _m); dirt.setColorAt(k++, _c); }
    _m.compose(_p.set(i + 0.5, G[i] - 0.1, 0), _q.identity(), _s.set(1, 1, 1)); grass.setMatrixAt(gk, _m); grass.setColorAt(gk++, _c.set(W.grass[i % 2]));
    const rr = rng(i * 31 + n);
    for (let t = 0; t < 2 && tk < 500; t++) { const tz = (rr() - 0.5) * 2.6; if (Math.abs(tz) < 0.5) continue; _m.compose(_p.set(i + rr(), G[i] + 0.2, tz), _q.identity(), _s.set(1, 0.7 + rr() * 0.8, 1)); tuft.setMatrixAt(tk++, _m); }
    if (rr() < 0.2 && fl < 140) { _m.compose(_p.set(i + rr(), G[i] + 0.16, -1.1 + rr() * 0.3), _q.identity(), _s.setScalar(1)); flowers.setMatrixAt(fl, _m); flowers.setColorAt(fl++, _c.set(JELLY[Math.floor(rr() * 6)])); }
  }
  dirt.count = k; grass.count = gk; tuft.count = tk; flowers.count = fl;
  for (const im of [dirt, grass, flowers]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  tuft.instanceMatrix.needsUpdate = true;
  tuft.material.color.set(wi === 1 ? '#ff9ec7' : wi === 2 ? '#d9e0ff' : '#5fd35a');
  // objects of the level
  world.clear(); roofs = []; gems = []; pads = []; cpFlags = []; bgSpin = [];
  for (let i = 0; i < G.length;) {
    const cr = T.CR[i], c = C[i];
    if (c === Infinity) { i++; continue; }
    let j = i + 1; while (j < G.length && (cr ? T.CR[j] === cr : C[j] === c && !T.CR[j])) j++;
    const w = j - i;
    let slab;
    if (cr) {
      slab = new THREE.Mesh(rounded(w, 1.3, 3, 0.12), stripeMat); slab.material = stripeMat.clone(); slab.material.map = stripeMat.map.clone(); slab.material.map.repeat.set(Math.max(1, w / 2), 1); slab.material.map.needsUpdate = true;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 14, 0.5), steel); shaft.position.set(0, 7.3, -0.3); slab.add(shaft);
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 2.6), mat('#ff4d5e')); teeth.position.y = -0.7; slab.add(teeth);
    } else {
      slab = new THREE.Mesh(rounded(w, 4, 3, 0.1), mat(W.dirt[0], { map: dirtMat.map, roughness: 0.85 })); slab.material.color.set(W.dirt[1]);
      const lip = new THREE.Mesh(rounded(w + 0.04, 0.32, 3.12, 0.08), mat(wi === 2 ? '#aeb6dc' : '#c2603c')); lip.position.y = -2.0; slab.add(lip);
    }
    slab.castShadow = true; slab.position.x = i + w / 2; slab.userData = { cr, c, i, w }; world.add(slab); roofs.push(slab); i = j;
  }
  // wall hints: the blocks a pillar needs / a low roof allows, floating where the wall is
  for (let i = 10; i < G.length - 1; i++) {
    const rise = G[i] - G[i - 1];
    if (rise >= 2 && !T.CR[i]) { const tag = numTag('+' + rise, '#ffe66d'); tag.position.set(i - 0.2, G[i - 1] + 1.8, 1.4); world.add(tag); }
    if (C[i] !== Infinity && !T.CR[i] && C[i - 1] === Infinity) { const tag = numTag('≤' + (C[i] - G[i]), '#ff9ad5'); tag.position.set(i + 0.5, C[i] - 1.2, 1.6); world.add(tag); }
  }
  T.items.forEach(it => {
    let m;
    if (it.kind === 'gem') { m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glossy(wi === 1 ? '#ff6fa3' : wi === 2 ? '#9ef0ff' : '#7be3ff', { emissive: wi === 1 ? '#ff2d7a' : '#38c8ff', emissiveIntensity: 0.55 })); m.scale.y = 1.35; }
    else { m = new THREE.Mesh(BLOCK, glossy('#ffe66d', { emissive: '#ffb800', emissiveIntensity: 0.6 })); m.scale.setScalar(0.62); const plus = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.16), mat('#ffffff')); const plus2 = plus.clone(); plus2.rotation.z = 1.5708; plus.position.z = plus2.position.z = 0.5; m.add(plus, plus2); }
    m.castShadow = true; m.position.set(it.x, it.y + 0.5, 0); world.add(m); gems.push({ m, it, t: 0 });
  });
  T.springs.forEach(sx => {
    const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.18, 16), glossy('#ff6fa3')); base.position.y = 0.09;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 16), glossy('#ffe66d')); coil.rotation.x = 1.5708; coil.position.y = 0.3;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), glossy('#56c8ff')); top.position.y = 0.46; g.add(base, coil, top);
    g.position.set(sx + 0.5, G[sx], 0.05); g.userData = { top, coil, x: sx }; g.castShadow = true; world.add(g); pads.push(g);
  });
  T.checks.forEach((cx, ci) => { const f = makeFlag(2.4, W.ui, false); f.position.set(cx + 0.5, G[cx], 0); world.add(f); cpFlags.push(f); });
  finish.position.set(T.finishX, gAt(T, T.finishX), 0);
  // background
  bg.clear(); const br = rng(n * 977 + 5);
  hillMat.color.set(wi === 1 ? '#ffc4dc' : wi === 2 ? '#8f7fe0' : '#9be3a4'); hill2.color.set(wi === 1 ? '#ffe0ec' : wi === 2 ? '#b9a9f5' : '#c3efc4');
  for (let i = -2; i < G.length / 9 + 3; i++) {
    const hm = new THREE.Mesh(HILL, br() < 0.5 ? hillMat : hill2); const sz = 4 + br() * 4; hm.scale.set(sz * 1.5, sz, 2); hm.position.set(i * 9 + br() * 4, -2 + br() * 2, -24 - br() * 6); bg.add(hm);
    if (br() < 0.6) { const cl = new THREE.Group(); for (let j = 0; j < 3; j++) { const p = new THREE.Mesh(PUFF, cloudMat); const ps = 0.7 + br() * 0.8; p.scale.set(ps * 1.3, ps, ps); p.position.set(j * 0.9 - 1.3, (j % 2) * 0.35, 0); cl.add(p); } cl.position.set(i * 9 + br() * 6, 7 + br() * 7, -16 - br() * 6); bg.add(cl); }
    if (wi === 1 && br() < 0.55) { const lp = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 8), mat('#ffffff')); stick.position.y = 3.5; const disc = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), glossy(JELLY[Math.floor(br() * 6)])); disc.scale.z = 0.4; disc.position.y = 8; lp.add(stick, disc); lp.position.set(i * 9 + 4 + br() * 3, -2, -15 - br() * 4); bg.add(lp); }
    if (wi === 2 && br() < 0.6) { const gr = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.8, 20), mat('#6f789a')); body.rotation.x = 1.5708; gr.add(body); for (let q = 0; q < 10; q++) { const tt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.8), mat('#6f789a')); const a = q / 10 * 6.283; tt.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0); tt.rotation.z = a; gr.add(tt); } gr.position.set(i * 9 + 3 + br() * 4, 5 + br() * 7, -17 - br() * 5); gr.userData.spin = (br() < 0.5 ? -1 : 1) * (0.2 + br() * 0.3); bg.add(gr); bgSpin.push(gr); }
  }
  // reset run
  for (const c of cubes) freeCube(c.m); cubes = []; for (const d of debris) freeCube(d.m); debris = [];
  cp = null; cpIdx = -1; tries = 0; fails[n] = fails[n] || 0;
  resetRun(true);
  const sh = Math.max(T.G[1], 1); camX = vx + 2.6; camY = sh + 1.3;
  ui.levels(n); ui.progress(0);
  const best = prog[n] ? prog[n].s : 0;
  elName.innerHTML = `${wi + 1}-${((n - 1) % 12) + 1} ${L.n.replace(/^HARD: /, '')}${L.hard ? ' <span style="background:#ff4d5e;border-radius:8px;padding:0 6px;font-size:12px;vertical-align:2px">HARD</span>' : ''}<small>${best ? '' : L.why}</small>`;
  clearTimeout(bannerT); bannerT = setTimeout(() => { const sm = elName.querySelector('small'); if (sm) sm.textContent = ''; }, 4200);
}

function resetRun(first) {
  const from = cp ? { x: cp.x, base: cp.base, got: cp.got } : null;
  s = simStart(T, speed, from);
  if (cp) { s.gemsGot = cp.gemsGot; s.perfects = cp.perfects; s.walls = cp.walls; }
  s.assist = !!L.assist || (fails[cur] || 0) >= 4;
  state = 'play'; recorded = false; flyV = null; heroLift = 0; squash = 0; acc = 0; hitstop = 0; gemChain = 0;
  vx = pvx = s.x; vb = pvb = s.base;
  for (const c of cubes) freeCube(c.m); cubes = []; for (const d of debris) freeCube(d.m); debris = [];
  gems.forEach(g => { const got = s.got[g.it.i]; g.m.visible = !got; g.t = 0; g.m.scale.setScalar(g.it.kind === 'gem' ? 1 : 0.62); if (g.it.kind === 'gem') g.m.scale.y = 1.35; });
  hero.visible = true; hero.rotation.set(0, 0, 0); hero.position.set(s.x, s.base + 0.47, 0); hero.skin.emissive.set('#000000');
  const lw = document.querySelector('.bl-lose'); if (lw) lw.remove();
  tapped = cp ? true : false; hudUpdate(); showTapHint();
  if (!cp) { camX = s.x + 2.6; camY = s.base + 1.3; }
}

let hintEl = null;
function showTapHint() {
  if (hintEl) { hintEl.remove(); hintEl = null; }
  if (cur <= 2 && !tapped && !prog[cur]) { hintEl = dom(`<div class="bl-tap">TAP to stack!</div>`); document.body.appendChild(hintEl); }
}
// ghost taps: after 3 losses on a level the solver's taps show as little arrows on the track
let ghosts = [];
function showGhosts() {
  for (const g of ghosts) world.remove(g); ghosts = [];
  if ((fails[cur] || 0) < (L.hard || cur <= 4 ? 0 : 2) || L.assist) return;
  for (const f of PAR[cur - 1].taps) {
    const gx = 1.5 + (f * speed) / 60; if (gx < s.x) continue;
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.7 })); a.rotation.x = Math.PI; a.position.set(gx, gAt(T, gx) + 2.7, 1.2); a.userData.gx = gx; world.add(a); ghosts.push(a);
  }
}

// ---------------------------------------------------------------- events
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
function addCube(gold) {
  const col = s.fever > 0 ? new THREE.Color().setHSL((clock * 0.6 + cubes.length * 0.12) % 1, 0.85, 0.62) : new THREE.Color(gold ? '#ffe66d' : JELLY[(goldN++ + cur) % JELLY.length]);
  const m = getCube(col); m.scale.setScalar(0.35); cubes.push({ m, pop: 1 });
  return col;
}
function doTap() {
  if (state !== 'play') return;
  if (!simTap(s)) return;
  tapped = true; if (L.assist) s.assist = true; if (hintEl) { hintEl.remove(); hintEl = null; }
  const nowT = performance.now(); tapRun = (nowT - lastTapT < 420) ? tapRun + 1 : 1; lastTapT = nowT;
  const col = addCube(false); heroLift -= 1; squash = 1 + Math.min(tapRun, 8) * 0.04; shake = Math.max(shake, 0.05 + Math.min(s.n, 14) * 0.014); hitstop = Math.max(hitstop, 1.2); note(40 + Math.min(s.n, 20), 0.12, 0.2);
  note(64 + PENTA[Math.min(s.n - 1, PENTA.length - 1)] + Math.min(tapRun - 1, 7), 0.22, 0.16); buzz(8);
  burst(scene, new THREE.Vector3(s.x, s.base + s.n - 0.5, 0.4), ['#ffffff', '#' + col.getHexString()], 6 + Math.min(tapRun, 6) * 2, { speed: 0.06 + Math.min(tapRun, 6) * 0.01, up: 0.03, size: 0.45, gravity: 0.003 });
  if (tapRun === 5 || tapRun === 10 || tapRun === 15) { popText(tapRun === 5 ? 'RAPID!' : tapRun === 10 ? 'WOBBLY!' : 'JELLY STORM!', '#fff', 30, 30); ui.flash(0.12); buzz([8, 12, 8]); [0, 4, 7].forEach((q, i) => setTimeout(() => note(84 + q, 0.2, 0.12), i * 50)); }
  s.ev.length = 0;
}
function popText(t, c = '#fff', size = 34, top = 24) { ui.pop(t, c, size, top); }

function handleEvents() {
  for (const e of s.ev) {
    if (e.t === 'tap') { // assisted tap (level 1)
      const col = addCube(false); heroLift -= 1; note(64 + PENTA[Math.min(s.n - 1, PENTA.length - 1)], 0.22, 0.16);
      burst(scene, new THREE.Vector3(s.x, s.base + s.n - 0.5, 0.4), ['#ffffff', '#' + col.getHexString()], 6, { speed: 0.06, up: 0.03, size: 0.45, gravity: 0.003 });
    } else if (e.t === 'scrape') {
      for (let i = 0; i < e.k; i++) {
        const c = cubes.shift(); if (!c) break;
        debris.push({ m: c.m, x: e.x - 0.5, y: s.base - e.k + i + 0.5, vx: -0.03 - Math.random() * 0.03, vy: 0.06 + Math.random() * 0.05, rz: (Math.random() + 0.5) * 0.12, t: 0 });
        burst(scene, new THREE.Vector3(e.x, s.base - e.k + i + 0.5, 0.6), ['#' + c.m.material.color.getHexString(), '#ffffff'], 7, { speed: 0.09, up: 0.06, size: 0.5 });
      }
      tone(160, 0.12, 'triangle', 0.14, 0.6); buzz(14);
      if (e.perfect) {
        const st = e.streak; flushNow = st; squash = 1; hitstop = st >= 5 ? 9 : st >= 3 ? 5 : 3;
        note(76 + Math.min(st, 5) * 2, 0.35, 0.18); setTimeout(() => note(83 + Math.min(st, 5) * 2, 0.4, 0.15), 70);
        popText(st > 1 ? `FLUSH ×${st}` : 'FLUSH!', '#fff', 34 + Math.min(st, 4) * 5);
        burst(scene, new THREE.Vector3(s.x, s.base, 0.5), ['#ffffff', '#ffe66d'], 12 + st * 4, { speed: 0.12, up: 0.08, size: 0.6 });
        burst(scene, new THREE.Vector3(s.x, s.base + 0.5, 0.8), ['#ffffff', '#fff3a0', '#9ef0ff'], 10 + st * 3, { speed: 0.2, up: 0.02, size: 0.8, gravity: 0 }); if (st >= 2) ui.flash(0.1);
        if (st >= 3) { shake = Math.max(shake, 0.06 + Math.min(st, 8) * 0.02); ui.flash(0.08 + Math.min(st, 8) * 0.01); buzz([10, 20, 10]); }
        if (st >= 5 && st % 5 === 0) { confetti(scene, new THREE.Vector3(s.x + 1, s.base + s.n + 1, 0), 40); popText('UNSTOPPABLE!', '#ffe66d', 40, 30); }
        if (Math.random() < 0.1 + Math.min(st, 6) * 0.02) { popText('LUCKY!', '#ff9ad5', 46, 28); confetti(scene, new THREE.Vector3(s.x + 1, s.base + s.n + 1, 0), 30); ui.flash(0.2); [0, 4, 7, 11, 16].forEach((q, i) => setTimeout(() => note(79 + q, 0.25, 0.14), i * 50)); }
        hudUpdate();
        const P = PAR[cur - 1]; if (s.perfects === P.req && (T.gemTotal === 0 || s.gemsGot >= T.gemTotal)) { popText('3-STAR PACE!', '#ffe66d', 38, 30); }
      } else { flushNow = 0; }
    } else if (e.t === 'fever') {
      popText('FEVER!', '#fff', 54, 26); ui.flash(0.35); buzz([20, 30, 20]); shake = 0.25; [0, 4, 7, 12].forEach((q, i) => setTimeout(() => note(72 + q, 0.3, 0.15), i * 70));
    } else if (e.t === 'gem') {
      const g = gems[e.i]; g.m.visible = false; g.pop = 1;
      gemChain = (s.f - lastGemF < 90) ? gemChain + 1 : 0; lastGemF = s.f;
      note(84 + Math.min(gemChain, 6) * 2, 0.3, 0.17); buzz(10);
      burst(scene, g.m.position.clone().setZ(0.5), ['#7be3ff', '#ffffff', '#ffe66d'], 12, { speed: 0.1, up: 0.07, size: 0.5 });
      hudUpdate();
      if (s.gemsGot === T.gemTotal) { popText('ALL GEMS!', '#7be3ff', 40, 30); ui.flash(0.25); [0, 4, 7, 12, 16].forEach((q, i) => setTimeout(() => note(84 + q, 0.3, 0.14), i * 55)); }
    } else if (e.t === 'plus') {
      const g = gems[e.i]; g.m.visible = false; addCube(true); heroLift -= 0.6; note(88, 0.3, 0.15); buzz(10);
      burst(scene, g.m.position.clone().setZ(0.5), ['#ffe66d', '#ffffff'], 10, { speed: 0.08, up: 0.06, size: 0.5 }); popText('+1 BLOCK', '#ffe66d', 28, 30);
    } else if (e.t === 'spring') {
      tone(220, 0.2, 'sine', 0.16, 2.4); squash = 1; buzz(12); const pd = pads.find(p => p.userData.x === Math.floor(s.x)); if (pd) pd.userData.hit = 1;
      burst(scene, new THREE.Vector3(s.x, s.base, 0.5), ['#ffffff', '#56c8ff'], 8, { speed: 0.07, up: 0.05, size: 0.5 });
    } else if (e.t === 'land') {
      squash = Math.min(1, e.hard * 3); tone(240, 0.06, 'sine', 0.1, 0.7); burst(scene, new THREE.Vector3(s.x, s.base, 0.5), '#ffffff', 5, { speed: 0.05, up: 0.02, size: 0.4 });
    } else if (e.t === 'crash') crash(e);
    else if (e.t === 'win') win();
  }
  s.ev.length = 0;
}

function crash(e) {
  state = 'lost'; deadAt = performance.now(); hitstop = 7; shake = 0.55; fails[cur] = (fails[cur] || 0) + 1; tries++;
  if (!recorded) { recorded = true; F.level(false, clamp((s.x - 1.5) / (T.finishX - 1.5), 0, 1)); }
  sfx.smash(); buzz([40, 30, 80]); ui.flash(0.5);
  burst(scene, hero.position.clone(), ['#2fd1b4', '#c9fff2', '#ffffff'], 26, { speed: 0.16, up: 0.12, size: 0.7 });
  flyV = { vx: -0.06, vy: 0.2, r: 0.25 };
  for (const c of cubes) debris.push({ m: c.m, x: s.x, y: c.m.position.y, vx: -0.02 - Math.random() * 0.05, vy: 0.08 + Math.random() * 0.1, rz: (Math.random() - 0.5) * 0.3, t: 0 }); cubes = [];
  const col = Math.floor(s.x + 0.45), cr = T.CR[col] || T.CR[Math.floor(s.x - 0.45)];
  const pct = Math.round(clamp((s.x - 1.5) / (T.finishX - 1.5), 0, 1) * 100);
  let t, sub, hint;
  if (e.why === 'bonk') { t = 'BONK!'; sub = `${e.short} block${e.short > 1 ? 's' : ''} short`; hint = 'tap earlier'; }
  else if (cr) { t = 'SQUISHED!'; sub = 'wait for the gap'; hint = 'fewer blocks'; }
  else { t = 'OUCH!'; sub = `${e.short} block${e.short > 1 ? 's' : ''} too tall`; hint = 'tap later'; }
  if (pct >= 80) popText('SO CLOSE!', '#ffe66d', 40, 30);
  const close = pct >= 80 ? `SO CLOSE · ${pct}%` : `${pct}% of the way`;
  setTimeout(() => {
    if (state !== 'lost') return;
    const el = dom(`<div class="bl-lose"><div class="msg">${t} ${sub}<small>${close}${(fails[cur] || 0) === 1 ? ' · hint next try' : (fails[cur] || 0) === 3 ? ' · helper next try' : ''}</small></div><button class="bl-go">${IC.redo('#fff', 22)} Again${cp ? ' · from flag' : ''}</button></div>`);
    el.querySelector('.bl-go').addEventListener('pointerdown', ev => { ev.stopPropagation(); retry(); });
    document.body.appendChild(el);
  }, 200);
}

function retry() {
  if (state !== 'lost') return;
  resetRun(false); showGhosts();
}

let winDaily = '';
function win() {
  state = 'won'; hitstop = 3; recorded || (recorded = true, F.level(true), B.submit(1));
  const P = PAR[cur - 1], n = simStars(s, P.req);
  const old = prog[cur] || { s: 0, g: 0 }, before = { stars: totalStars(), gems: totalGems() };
  prog[cur] = { s: Math.max(old.s, n), g: Math.max(old.g, s.gemsGot) }; save();
  let dailyMsg = '';
  if (dailyRun) {
    if (daily.done) dailyMsg = 'Daily level done today';
    else if (n >= 2) { daily.done = true; daily.bonus = (daily.bonus || 0) + 2; daily.streak = (daily.last === dayKey(-1) ? daily.streak : 0) + 1; daily.last = dayKey(); saveDaily(); setTimeout(() => { [0, 4, 7, 12, 16, 19].forEach((q, i) => setTimeout(() => note(72 + q, 0.3, 0.16), i * 90)); confetti(scene, new THREE.Vector3(s.x + 1, s.base + s.n + 3, 0), 120); ui.flash(0.5); buzz([30, 30, 60]); }, 1100); dailyMsg = `DAILY CHEST! +2 stars · streak ${daily.streak} day${daily.streak > 1 ? 's' : ''}`; }
    else dailyMsg = 'Daily chest: reach 2 stars on this level';
  }
  winDaily = dailyMsg;
  fails[cur] = 0; for (const g of ghosts) world.remove(g); ghosts = [];
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.4); confetti(scene, new THREE.Vector3(s.x + 1, s.base + s.n + 2, 0), 90);
  if (n === 3) { const gold = Math.random() < 0.2; [1, 2, 3].forEach(k => setTimeout(() => { confetti(scene, new THREE.Vector3(s.x + 1 + (k - 2) * 1.5, s.base + s.n + 2 + k * 0.4, 0), gold ? 50 : 24); note(76 + k * 4, 0.25, 0.14); buzz(15); }, 250 * k)); if (gold) { popText('GOLDEN WIN!', '#ffe66d', 44, 36); [0, 4, 7, 12, 16].forEach((q, i) => setTimeout(() => note(79 + q, 0.35, 0.16), 200 + i * 80)); } }
  if (n < 3) [0, 4, 7].forEach((q, i) => setTimeout(() => { note(72 + q, 0.22, 0.14); confetti(scene, new THREE.Vector3(s.x + 1 + (i - 1) * 1.2, s.base + s.n + 2, 0), 30); }, 150 * i));
  const after = { stars: totalStars(), gems: totalGems() };
  setTimeout(() => showWin(n, old, before, after), 750);
  hudUpdate();
}

function nextUnlock(kind, have) { const arr = kind === 'hat' ? HATS : COLS; return arr.find(x => x.need > have); }
function showWin(n, old, before, after) {
  closeCards();
  const P = PAR[cur - 1], g = s.gemsGot;
  const newHats = HATS.filter(h => h.need > before.stars && h.need <= after.stars), newCols = COLS.filter(c => c.need > before.gems && c.need <= after.gems);
  const nh = nextUnlock('hat', after.stars), nc = nextUnlock('col', after.gems);
  const goal = n < 3 ? (g < T.gemTotal ? `2nd star: all gems (${g}/${T.gemTotal})` : `3rd star: flush ${P.req} walls (${s.perfects}/${P.req})`) : 'Perfect!';
  const w = dom(`<div class="bl-wrap" style="--ui:${W.ui};--m1:#fff;--m2:${W.sky[1]}"><div class="bl-card">
    <p style="opacity:.7">${cur === LEVELS.length ? 'LAST LEVEL' : 'LEVEL ' + cur}</p><h2>${n === 3 ? 'PERFECT!' : n === 2 ? 'GREAT!' : 'CLEARED!'}</h2>
    <div class="bl-big">${[0, 1, 2].map(i => IC.star(i < n ? '#ffc928' : '#c9bde6', 62).replace('<svg', `<svg class="${i < n ? '' : 'dim'}" style="animation-delay:${0.25 + i * 0.3}s"`)).join('')}</div>
    <p>${IC.gem('#38c8ff', 16)} ${g}/${T.gemTotal} gems · flush ${s.perfects}/${P.req}</p>
    <p style="opacity:.75;font-size:14px">${goal}</p>
    ${winDaily ? `<div class="bl-new" style="background:#ffefb0;color:#6a4a00">${winDaily}</div>` : ''}
    ${newHats.map(h => `<div class="bl-new">NEW HAT: ${h.name}!</div>`).join('')}${newCols.map(c => `<div class="bl-new">NEW COLOUR: ${c.name}!</div>`).join('')}
    ${nh && !newHats.length ? `<div class="bl-bar"><i style="width:${Math.min(100, (after.stars - (HATS[HATS.indexOf(nh) - 1].need)) / (nh.need - HATS[HATS.indexOf(nh) - 1].need) * 100)}%"></i></div><p style="font-size:13px;opacity:.75">${nh.need - after.stars} more star${nh.need - after.stars > 1 ? 's' : ''} → ${nh.name}</p>` : ''}
    <button class="bl-go" data-a="next">${cur === LEVELS.length ? 'Levels' : 'Next level'}</button>
    <button class="bl-sm" data-a="again">${IC.redo('#4a3d6e', 16)} ${n < 3 ? 'Again for ' + (n + 1) + ' stars' : 'Replay'}</button><button class="bl-sm" data-a="map">${IC.map('#4a3d6e', 16)} Levels</button>
  </div></div>`);
  w.querySelectorAll('[data-a]').forEach(b => b.addEventListener('pointerdown', e => {
    e.stopPropagation(); const a = b.dataset.a; closeCards();
    if (a === 'next') { if (cur >= LEVELS.length) showMap(); else go(cur + 1); } else if (a === 'again') go(cur, dailyRun); else showMap();
  }));
  document.body.appendChild(w);
  [0, 1, 2].forEach(i => { if (i < n) setTimeout(() => note(72 + i * 4, 0.35, 0.16), 300 + i * 300); });
  if (newHats.length || newCols.length) setTimeout(() => [0, 4, 7, 12].forEach((q, i) => setTimeout(() => note(79 + q, 0.3, 0.15), i * 70)), 900);
}

function closeCards() { document.querySelectorAll('.bl-wrap, .bl-lose').forEach(e => e.remove()); }
function go(n, d) { dailyRun = !!d; closeCards(); clearGhosts(); build(n); showGhosts(); state = 'play'; B.start(); }
function clearGhosts() { for (const g of ghosts) world.remove(g); ghosts = []; }

// ---------------------------------------------------------------- map + wardrobe
let mapWorld = 0;
function showMap(wi) {
  closeCards();
  if (state === 'play') state = 'menu';
  mapWorld = wi == null ? Math.floor((nextOpen() - 1) / 12) : wi;
  const wd = WORLDS[mapWorld], nx = nextOpen(), stars = totalStars();
  const worldOpen = (i) => i === 0 || isOpen(i * 12 + 1);
  const wst = (i) => Array.from({ length: 12 }, (_, k) => (prog[i * 12 + k + 1] || {}).s || 0).reduce((a, b) => a + b, 0);
  const lv = (k) => { const n = mapWorld * 12 + k + 1, p = prog[n] || { s: 0 }, open = isOpen(n);
    return `<button class="bl-node ${open ? '' : 'lk'} ${n === nx ? 'next' : ''} ${LEVELS[n - 1].hard ? 'hard' : ''}" data-n="${n}">${open ? n : IC.lock('#9a90b5', 20)}${LEVELS[n - 1].hard ? '<span class="hb">HARD</span>' : ''}<div class="st">${open ? starsRow(p.s, 13, '#ffc928', n === nx ? 'rgba(255,255,255,.6)' : '#d8cfee') : ''}</div></button>`; };
  const nh = nextUnlock('hat', stars), nc = nextUnlock('col', totalGems());
  const bs = document.body.style; bs.setProperty('--ui', wd.ui);
  const el = dom(`<div class="bl-wrap"><div class="bl-card" style="--ui:${wd.ui};--m1:#fff;--m2:${wd.sky[1]}">
    <h2>${wd.name}</h2><p style="opacity:.7">${IC.star('#ffc928', 14)} ${stars}/108 · ${IC.gem('#38c8ff', 14)} ${totalGems()}</p>
    <div class="bl-tabs">${WORLDS.map((x, i) => `<button class="bl-tab ${i === mapWorld ? 'on' : ''} ${worldOpen(i) ? '' : 'lk'}" data-w="${i}">${x.name}<small>${worldOpen(i) ? wst(i) + '/36' : 'locked'}</small></button>`).join('')}</div>
    <div class="bl-grid" style="${worldOpen(mapWorld) ? '' : 'opacity:.5;pointer-events:none'}">${Array.from({ length: 12 }, (_, k) => lv(k)).join('')}</div>
    ${nh ? `<div class="bl-bar"><i style="width:${Math.min(100, (stars - HATS[HATS.indexOf(nh) - 1].need) / (nh.need - HATS[HATS.indexOf(nh) - 1].need) * 100)}%"></i></div><p style="font-size:13px;opacity:.75">${nh.need - stars} more stars → hat: ${nh.name}</p>` : ''}
    ${(() => { const D = dailyToday(); return `<button class="bl-sm" data-a="daily" style="background:${D.done ? '#e6e0f2' : '#ffefb0'};color:#4a3d6e;font-weight:700">${IC.star('#ffc928', 16)} ${D.done ? 'Daily done · back tomorrow' : 'Daily chest: level ' + D.n + ' (+2 stars)'}${D.streak ? ' · ' + D.streak + '-day streak' : ''}</button>`; })()}
    <button class="bl-go" data-a="play">Play level ${nx}</button>
    <button class="bl-sm" data-a="wear">${IC.hat('#4a3d6e', 16)} Hats &amp; colours</button>${state === 'menu' && s && s.status === 'play' ? `<button class="bl-sm" data-a="back">Back</button>` : ''}
  </div></div>`);
  el.querySelectorAll('.bl-node').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.n; if (!isOpen(n)) { tone(180, 0.1, 'square', 0.08, 0.7); return; } go(n); }));
  el.querySelectorAll('.bl-tab').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.w; if (!worldOpen(i)) { tone(180, 0.1, 'square', 0.08, 0.7); return; } showMap(i); }));
  el.querySelector('[data-a=play]').addEventListener('click', () => go(nx));
  el.querySelector('[data-a=daily]').addEventListener('click', () => go(dailyToday().n, true));
  el.querySelector('[data-a=wear]').addEventListener('click', showWear);
  const back = el.querySelector('[data-a=back]'); if (back) back.addEventListener('click', () => { closeCards(); state = 'play'; });
  document.body.appendChild(el);
}
function showWear() {
  closeCards(); const stars = totalStars(), gm = totalGems();
  const el = dom(`<div class="bl-wrap"><div class="bl-card" style="--ui:${W ? W.ui : '#2fd1b4'};--m1:#fff;--m2:#e8f6ff">
    <h2>Wardrobe</h2><p style="opacity:.7">Hats come from stars, colours from gems</p>
    <div class="bl-sks">${HATS.map((h, i) => { const have = stars >= h.need; return `<button class="bl-sk ${have ? '' : 'lk'} ${i === hatId ? 'on' : ''}" data-h="${i}"><div class="sw" style="background:${have ? '#e8defa' : '#cfc8dc'};display:flex;align-items:center;justify-content:center">${have ? IC.hat('#7a58c8', 18) : IC.lock('#8f86a8', 16)}</div>${have ? h.name : IC.star('#ffc928', 10) + ' ' + h.need}</button>`; }).join('')}</div>
    <div class="bl-sks">${COLS.map((c, i) => { const have = gm >= c.need; const bg = c.c === 'rainbow' ? 'linear-gradient(135deg,#ff5d5d,#ffd23f,#3ac46a,#3a86ff,#b05cff)' : c.c; return `<button class="bl-sk ${have ? '' : 'lk'} ${i === colId ? 'on' : ''}" data-c="${i}"><div class="sw" style="background:${have ? bg : '#cfc8dc'}"></div>${have ? c.name : IC.gem('#38c8ff', 10) + ' ' + c.need}</button>`; }).join('')}</div>
    <button class="bl-go" data-a="map">Back</button></div></div>`);
  el.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.h; if (stars < HATS[i].need) { tone(180, 0.1, 'square', 0.08, 0.7); return; } hatId = i; save(); setHat(i); note(76, 0.2, 0.15); showWear(); }));
  el.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.c; if (gm < COLS[i].need) { tone(180, 0.1, 'square', 0.08, 0.7); return; } colId = i; save(); setCol(i); note(79, 0.2, 0.15); showWear(); }));
  el.querySelector('[data-a=map]').addEventListener('click', () => showMap());
  document.body.appendChild(el);
}

// ---------------------------------------------------------------- input + loop
input({ onDown: (e) => { if (state === 'play') doTap(); else if (state === 'lost' && performance.now() - deadAt > 260) retry(); } });

loop((dt, t) => {
  clock = t;
  const turbo = auto.turbo;
  if (state === 'play') {
    if (hitstop > 0) hitstop -= dt;
    else {
      acc += dt * turbo; let guard = 0;
      while (acc >= 1 && guard++ < 40 * turbo && state === 'play') {
        pvx = s.x; pvb = s.base;
        if (auto.taps && auto.taps.includes(s.f)) doTap();
        simStep(s, s.assist); acc -= 1; handleEvents();
        if (s.status === 'play') { const ci = T.checks.findIndex((cx, i) => i > cpIdx && s.x >= cx + 1); if (ci >= 0) { cpIdx = ci; cp = { x: T.checks[ci] + 1, base: T.G[T.checks[ci] + 1], got: s.got.slice(), gemsGot: s.gemsGot, perfects: s.perfects, walls: s.walls }; popText('CHECKPOINT', '#fff', 30, 28); note(86, 0.3, 0.16); setTimeout(() => note(91, 0.35, 0.15), 90); cpFlags[ci].fl.userData.up = 1; burst(scene, new THREE.Vector3(T.checks[ci] + 0.5, T.G[T.checks[ci]] + 2, 0.5), ['#ffffff', '#ffe66d'], 14, { speed: 0.1, up: 0.08, size: 0.5 }); } }
        if (state === 'play' && turbo === 1) ui.progress((s.x - 1.5) / (T.finishX - 1.5));
      }
      if (acc > 3) acc = 0;
      if (state === 'play' && turbo > 1) ui.progress((s.x - 1.5) / (T.finishX - 1.5));
    }
    const a = clamp(acc, 0, 1); vx = pvx + (s.x - pvx) * a; vb = pvb + (s.base - pvb) * a;
  } else if (state === 'won') { if (hitstop > 0) hitstop -= dt; else s.x += s.v * 0.6 * dt; vx = s.x; vb = s.base; }
  else if (state === 'lost') { if (hitstop > 0) hitstop -= dt; }
  // hero + stack visuals
  heroLift = lerp(heroLift, 0, Math.min(1, 0.45 * dt)); squash = Math.max(0, squash - 0.08 * dt);
  const wob = Math.sin(t * 9) * 0.04, n = s.n;
  if (flyV) { flyV.vy -= 0.012 * dt; hero.position.x += flyV.vx * dt; hero.position.y += flyV.vy * dt; hero.rotation.z += flyV.r * dt; }
  else {
    hero.position.set(vx, vb + n + 0.47 + heroLift, 0);
    const sq = squash * 0.3 - Math.min(0.25, Math.max(0, -heroLift) * 0.25);
    hero.body.scale.set(1 + sq * 0.6 + wob * 0.3, 1 - sq + wob * 0.2 + (state === 'won' ? Math.abs(Math.sin(t * 10)) * 0.15 : 0), 1 + sq * 0.6);
    hero.body.position.y = -sq * 0.2; hero.rotation.z = lerp(hero.rotation.z, s.vy > 0.05 ? 0.15 : s.vy < -0.05 ? -0.12 : 0, 0.2);
    const rb = COLS[colId].c === 'rainbow'; if (s.fever > 0) hero.skin.emissive.setHSL((t * 0.8) % 1, 0.9, 0.35); else hero.skin.emissive.set('#000000');
    if (rb) hero.skin.color.setHSL((t * 0.15) % 1, 0.7, 0.62);
    if (s.fever > 0 && Math.random() < 0.6) burst(scene, new THREE.Vector3(vx - 0.4, vb + n + 0.5, 0), new THREE.Color().setHSL(Math.random(), 0.9, 0.65), 1, { speed: 0.02, up: 0.01, size: 0.6, gravity: 0 });
  }
  if (propeller) propeller.rotation.y += 0.5 * dt; if (haloMesh) haloMesh.position.y = 0.4 + Math.sin(t * 4) * 0.04;
  cubes.forEach((c, i) => {
    c.pop = Math.max(0, c.pop - 0.12 * dt); const sc = 1 - c.pop * 0.6;
    const lag = Math.sin(t * 7 - i * 0.6) * 0.03 * Math.min(i, 4);
    c.m.position.set(vx + lag, vb + i + 0.5 + (i === cubes.length - 1 ? heroLift * 0.6 : 0), 0); c.m.scale.set(1 + c.pop * 0.3 + squash * 0.1, sc, 1 + c.pop * 0.3);
  });
  for (const d of debris) { d.t += dt; d.vy -= 0.012 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.m.position.set(d.x, d.y, 0.2); d.m.rotation.z += d.rz * dt; if (d.t > 50) d.m.scale.multiplyScalar(0.95); }
  for (let i = debris.length - 1; i >= 0; i--) if (debris[i].t > 110) { freeCube(debris[i].m); debris.splice(i, 1); }
  // world animation: gems bob, pads squash, roofs move
  const fnow = s.f + clamp(acc, 0, 1);
  for (const g of gems) { if (g.m.visible) { g.m.rotation.y = t * 2.5 + g.it.i; g.m.position.y = g.it.y + 0.5 + Math.sin(t * 3 + g.it.i) * 0.07; } }
  for (const p of pads) { const u = p.userData; u.hit = Math.max(0, (u.hit || 0) - 0.08 * dt); u.top.position.y = 0.46 - u.hit * 0.2; u.coil.scale.y = 1 - u.hit * 0.5; }
  for (const r of roofs) { const u = r.userData; const bot = u.cr ? cAt(T, u.i + 0.5, fnow) : u.c; r.position.y = bot + (u.cr ? 0.65 : 2); }
  for (const g of bgSpin) g.rotation.z += g.userData.spin * 0.01 * dt;
  for (const gh of ghosts) gh.position.y = gAt(T, gh.userData.gx) + 2.7 + Math.sin(t * 6) * 0.15;
  for (const f of [finish, ...cpFlags]) { const pa = f.fl.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const bx = f.fl.base[i * 3]; pa.setZ(i, Math.sin(bx * 3 - t * 6) * 0.12 * bx); } pa.needsUpdate = true; }
  // camera: hero on the left third, eases up with the stack
  camX = lerp(camX, vx + 2.6, 0.15 * dt); camY = lerp(camY, vb + n * 0.65 + 1.5, 0.08 * dt);
  shake = Math.max(0, shake - 0.03 * dt); const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.position.set(camX - 1.4 + sx, camY + 1.8 + sy, 16); camera.lookAt(camX, camY, 0);
  stage.followLight(new THREE.Vector3(camX, camY - 2, 0));
});

// ---------------------------------------------------------------- start: straight into the next level
const qlevel = +QS.get('level') || 0;
build(qlevel >= 1 && qlevel <= LEVELS.length ? qlevel : nextOpen()); showGhosts(); B.start();

window.__game = {
  get state() { return state; }, get level() { return cur; }, get s() { return s; }, get prog() { return prog; }, auto, T: () => T, load: go, tap: doTap, map: showMap, retry,
  get stars() { return totalStars(); }, hud: hudUpdate, set hat(i) { hatId = i; setHat(i); }, setCol, PAR,
};

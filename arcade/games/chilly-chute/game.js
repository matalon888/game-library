// Chilly Chute — original endless-lane sled runner. Swipe left/right to change lanes, up to jump, down to duck.
import { THREE, createStage, createUI, input, loop, glossy, mat, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, SUITS, PHRASES, expand } from './levels.js';

// deep v2 (studio lane 35, 2026-10-31): 30 hand-made chutes in 3 worlds, smashing speed pads, stunt chain > SURGE, a checkpoint,
// stars, a level map, 8 suits and a daily chute. Half the arcade players get it (lab test deep-chilly-chute); the rest play v1.
// READY stays false until v2 is finished and checked: until then no player ever sees it (?deep=1 is for QA only).
const READY = true;
const DEEP = (READY && ab('deep-chilly-chute')) || /[?&]deep=1(&|$)/.test(location.search);
const DS = store('chute2');
const WB = board({ game: 'chilly-chute', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum' });
const S = createStage({ fov: 54, shadowSize: 16 });
const { scene, camera, sun, hemi } = S;
scene.add(camera);
hemi.color.set('#ffffff'); hemi.groundColor.set('#b9d9f2'); hemi.intensity = 1.25; sun.intensity = 1.9;
sun.shadow.mapSize.set(1024, 1024);
const ui = createUI({ title: 'CHILLY<br>CHUTE', hint: 'Swipe to steer, jump &amp; duck', hand: '👆' });
const save = store('chute');
const F = flow('chute');
let fk = 1;
const css = document.createElement('style'); css.textContent = `
.cc-coins{position:fixed;top:calc(62px + env(safe-area-inset-top));right:14px;z-index:6;display:flex;align-items:center;gap:6px;background:rgba(10,60,110,.28);border-radius:20px;padding:3px 12px 3px 5px;font-weight:800;font-size:20px;pointer-events:none}
.cc-coins i{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff3a8,#ffc83d 45%,#d98e00);box-shadow:inset 0 -2px 0 rgba(0,0,0,.2)}
.hc-pop{-webkit-text-stroke:7px #0d5a9c;paint-order:stroke fill;text-shadow:0 5px 0 rgba(0,40,90,.35)!important;letter-spacing:1px}
.hc-score,.hc-card h1{text-shadow:0 5px 0 rgba(0,50,110,.22)!important}`;
document.head.appendChild(css);
const coinEl = document.createElement('div'); coinEl.className = 'cc-coins'; coinEl.innerHTML = '<i></i><span>0</span>'; document.body.appendChild(coinEl);
const setCoins = n => { coinEl.lastChild.textContent = n; coinEl.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 160 }); };
let unlocked = DEEP ? Math.max(1, DS.get('unlocked', 1)) : 1;
let level = DEEP ? (+new URLSearchParams(location.search).get('level') || unlocked) : save.get('level', 1), best = save.get('best', 0);
let daily = false;                                   // v2: playing today's daily chute

// ---------------------------------------------------------------- themes (cycled per level)
const THEMES = [
  { sky: ['#4aa9f0', '#d9f1ff'], fog: '#d9f1ff', rock: '#8d97ab', tube: '#ff3f8e', coat: '#ffb703', hat: '#e63946', props: ['pine', 'pine', 'cliff', 'cabin'], ui: '#1e88e5' },
  { sky: ['#3f9fe8', '#e8f7ff'], fog: '#e8f7ff', rock: '#7d8796', tube: '#2ec27e', coat: '#ff6b6b', hat: '#3a86ff', props: ['pine', 'pine', 'pine', 'cliff'], ui: '#2ea36b' },
  { sky: ['#53b3f2', '#fff3e0'], fog: '#fff3e0', rock: '#a59c94', tube: '#ffb000', coat: '#7b5cff', hat: '#ff5d8f', props: ['cabin', 'pine', 'windmill', 'cabin'], ui: '#ff8f00' },
  { sky: ['#4ba7ee', '#e6f4ff'], fog: '#e6f4ff', rock: '#8f9bb0', tube: '#00b4d8', coat: '#ff4d6d', hat: '#ffd166', props: ['tower', 'tower', 'ptree'], ui: '#0091c2' },
  { sky: ['#58b6f2', '#fff0d6'], fog: '#fff0d6', rock: '#d49a62', tube: '#9b5de5', coat: '#00bbf9', hat: '#f15bb5', props: ['mesa', 'cactus', 'cactus'], ui: '#e07a2f' },
];
const WTHEMES = [   // v2: one look per world (Pine Pass keeps the first three v1 skies)
  [THEMES[0], THEMES[1], THEMES[2]],
  [{ sky: ['#3aa6c9', '#e3fbff'], fog: '#e3fbff', rock: '#7d93a8', tube: '#00b4d8', coat: '#ff4d6d', hat: '#ffd166', props: ['pine', 'cliff', 'pine', 'cliff'], ui: '#0f8fb0' }],
  [{ sky: ['#6a5acd', '#f1e4ff'], fog: '#efe3ff', rock: '#8a82b0', tube: '#9b5de5', coat: '#00bbf9', hat: '#f15bb5', props: ['cliff', 'pine', 'cliff', 'tower'], ui: '#7b5cff' }],
];
let T = THEMES[0];

// ---------------------------------------------------------------- track shape (winding, downhill)
const LW = 1.75;                                 // lane width
const cx = z => 3.2 * Math.sin(z * 0.011) + 1.4 * Math.sin(z * 0.029 + 1.3);
const ty = z => z * 0.2 + 0.9 * Math.sin(z * 0.043);
const dX = z => cx(z - 0.5) - cx(z + 0.5);       // lateral change per metre forward (forward = -z)
const dY = z => ty(z - 0.5) - ty(z + 0.5);
const wallY = x => { const a = Math.abs(x); return a <= 2.75 ? 0 : Math.pow((a - 2.75) / 1.9, 2) * 1.55; };

const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 });
const VCF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true });
const VCB = new THREE.MeshBasicMaterial({ vertexColors: true });

const iceTex = canvasTex(256, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.12, '#cdebfb'); gr.addColorStop(0.3, '#a2d8f5'); gr.addColorStop(0.5, '#96d2f3'); gr.addColorStop(0.7, '#a2d8f5'); gr.addColorStop(0.88, '#cdebfb'); gr.addColorStop(1, '#f4fbff');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 34; i++) {                 // long skate streaks along the run
    const x = r() * w, len = 60 + r() * 260, y = r() * h;
    g.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.45})`; g.lineWidth = 0.8 + r() * 2.4;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 14, y + len * 0.3, x + (r() - 0.5) * 14, y + len * 0.6, x + (r() - 0.5) * 10, y + len); g.stroke();
    g.beginPath(); g.moveTo(x, y - h); g.lineTo(x, y - h + len); g.stroke();
  }
  for (let i = 0; i < 26; i++) {                 // faint blue cracks
    let x = r() * w, y = r() * h; g.strokeStyle = `rgba(60,140,200,${0.12 + r() * 0.15})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 30; y += (r() - 0.3) * 24; g.lineTo(x, y); } g.stroke();
  }
}, true);
const ICE = new THREE.MeshStandardMaterial({ map: iceTex, color: '#f2f7fb', roughness: 0.3, metalness: 0.05 });
const SNOW = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#eef3f8', roughness: 0.95 });

// ---------------------------------------------------------------- prop geometry library (each = 1 merged mesh / instanced)
const G = {};
{
  const cone = new THREE.ConeGeometry(1, 1, 8), cyl = new THREE.CylinderGeometry(1, 1, 1, 10), sph = new THREE.SphereGeometry(1, 16, 12), box = new THREE.BoxGeometry(1, 1, 1);
  const dode = new THREE.DodecahedronGeometry(1, 0), ico = new THREE.IcosahedronGeometry(1, 0);
  G.pine = merge([part(cyl, '#7a5230', { y: 0.4, sx: 0.18, sz: 0.18, sy: 0.8 }),
    part(cone, '#2f7d5b', { y: 1.5, sx: 1.25, sz: 1.25, sy: 1.6 }), part(cone, '#f4fbff', { y: 1.95, sx: 0.8, sz: 0.8, sy: 0.75 }),
    part(cone, '#2f8a62', { y: 2.45, sx: 0.98, sz: 0.98, sy: 1.4 }), part(cone, '#f4fbff', { y: 2.85, sx: 0.62, sz: 0.62, sy: 0.65 }),
    part(cone, '#34966a', { y: 3.3, sx: 0.7, sz: 0.7, sy: 1.2 }), part(cone, '#ffffff', { y: 3.65, sx: 0.42, sz: 0.42, sy: 0.55 })]);
  G.ptree = merge([part(cyl, '#7a5230', { y: 0.8, sx: 0.16, sz: 0.16, sy: 1.6 }), part(sph, '#58c26b', { y: 2.1, s: 1.05 }), part(sph, '#f7fbff', { y: 2.75, sx: 0.8, sy: 0.35, sz: 0.8 })]);
  G.cliff = merge([part(dode, '#ffffff', { sx: 1, sy: 0.9, sz: 1 }), part(dode, '#f6fbff', { y: 0.55, sx: 0.78, sy: 0.4, sz: 0.78 })]);
  G.cabin = merge([part(box, '#c58450', { y: 1, sx: 2.6, sy: 2, sz: 2.2 }), part(new THREE.CylinderGeometry(1, 1, 1, 3), '#d64545', { y: 2.55, rz: Math.PI / 2, ry: 0, sx: 1.25, sy: 2.9, sz: 1.7, order: 'XYZ' }),
    part(new THREE.CylinderGeometry(1, 1, 1, 3), '#ffffff', { y: 2.75, rz: Math.PI / 2, sx: 0.95, sy: 3.0, sz: 1.35 }),
    part(box, '#ffe08a', { x: 0.7, y: 1.15, z: 1.11, sx: 0.55, sy: 0.55, sz: 0.04 }), part(box, '#ffe08a', { x: -0.7, y: 1.15, z: 1.11, sx: 0.55, sy: 0.55, sz: 0.04 }),
    part(box, '#7a4a2a', { y: 0.55, z: 1.11, sx: 0.5, sy: 1.1, sz: 0.04 }), part(box, '#8a6a5a', { x: 0.8, y: 3.1, sx: 0.35, sy: 0.9, sz: 0.35 })]);
  G.windmill = merge([part(new THREE.CylinderGeometry(0.8, 1.3, 5, 8), '#e8b98a', { y: 2.5 }), part(cone, '#c0533a', { y: 5.6, sx: 1.1, sz: 1.1, sy: 1.4 }), part(cone, '#ffffff', { y: 5.85, sx: 0.8, sz: 0.8, sy: 0.9 }),
    ...[0, 1, 2, 3].map(i => part(box, '#f2e6d8', { y: 4.4, z: 1.0, rz: i * Math.PI / 2 + 0.4, sx: 0.5, sy: 5.2, sz: 0.08 })), part(box, '#7a4a2a', { y: 1, z: 1.05, sx: 0.6, sy: 1.2, sz: 0.1 })]);
  G.tower = merge([part(box, '#ffffff', { y: 6, sx: 4, sy: 12, sz: 4 }), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => part(box, '#7fc4ee', { y: i * 1.1 + 0.4, sx: 4.06, sy: 0.55, sz: 4.06 })), part(box, '#f7fbff', { y: 12.15, sx: 4.1, sy: 0.3, sz: 4.1 })]);
  G.mesa = merge([part(new THREE.CylinderGeometry(3, 4, 4, 7), '#d99a5e', { y: 2 }), part(new THREE.CylinderGeometry(2.4, 3, 3, 7), '#c9834a', { y: 5.4 }), part(new THREE.CylinderGeometry(2.42, 2.42, 0.25, 7), '#fff6ea', { y: 7.0 })]);
  G.cactus = merge([part(new THREE.CapsuleGeometry(0.35, 2.4, 4, 8), '#3fa34d', { y: 1.5 }), part(new THREE.CapsuleGeometry(0.22, 0.8, 4, 8), '#3fa34d', { x: 0.55, y: 1.8 }), part(new THREE.CapsuleGeometry(0.2, 0.7, 4, 8), '#3fa34d', { x: -0.5, y: 2.2 }),
    part(box, '#3fa34d', { x: 0.35, y: 1.4, sx: 0.4, sy: 0.25, sz: 0.25 }), part(box, '#3fa34d', { x: -0.3, y: 1.9, sx: 0.35, sy: 0.22, sz: 0.22 }), part(sph, '#ffffff', { y: 2.9, sx: 0.36, sy: 0.14, sz: 0.36 })]);
  G.mountain = merge([part(new THREE.ConeGeometry(1, 1, 7), '#9aa7bd', { y: 0.5 }), part(new THREE.ConeGeometry(1, 1, 7), '#ffffff', { y: 0.78, s: 0.46 })]);
  G.roller = merge([part(cyl, '#ffffff', { y: 0.7, rx: Math.PI / 2, sx: 0.7, sz: 0.7, sy: 1.1 }), part(cyl, '#ff3b3b', { y: 0.7, rx: Math.PI / 2, sx: 0.72, sz: 0.72, sy: 0.22, z: 0.0, x: 0 }),
    part(cyl, '#ff3b3b', { y: 0.7, z: 0.4, rx: Math.PI / 2, sx: 0.72, sz: 0.72, sy: 0.16 }), part(cyl, '#ff3b3b', { y: 0.7, z: -0.4, rx: Math.PI / 2, sx: 0.72, sz: 0.72, sy: 0.16 }),
    part(box, '#ff3b3b', { y: 0.7, sx: 0.12, sy: 1.5, sz: 1.2 }), part(box, '#ff3b3b', { y: 0.7, sx: 1.5, sy: 0.12, sz: 1.2 })]);
  G.ball = merge([part(sph, '#ffffff', { y: 0.78, s: 0.78 }), part(sph, '#e6f2ff', { x: 0.3, y: 0.95, z: 0.55, s: 0.34 }), part(sph, '#cfe3f5', { x: -0.35, y: 0.5, z: 0.5, s: 0.3 }),
    part(new THREE.TorusGeometry(0.62, 0.07, 6, 18), '#ff4d4d', { y: 0.78, z: 0.1, rx: 0 })]);
  G.post = merge([part(box, '#ffffff', { y: 0.5, sx: 0.12, sy: 1, sz: 0.12 }), part(box, '#e63946', { y: 0.82, sx: 0.14, sy: 0.16, sz: 0.14 })]);

  // obstacles (1 mesh each), all built facing +z towards the player, centred on their lane, ground at y=0
  G.snowman = merge([part(sph, '#ffffff', { y: 0.55, s: 0.62 }), part(sph, '#ffffff', { y: 1.35, s: 0.45 }), part(sph, '#ffffff', { y: 1.95, s: 0.32 }),
    part(cone, '#ff8a1f', { y: 1.95, z: 0.42, rx: Math.PI / 2, sx: 0.08, sz: 0.08, sy: 0.32 }), part(sph, '#222', { x: 0.12, y: 2.05, z: 0.27, s: 0.05 }), part(sph, '#222', { x: -0.12, y: 2.05, z: 0.27, s: 0.05 }),
    part(new THREE.TorusGeometry(0.36, 0.09, 8, 18), '#e63946', { y: 1.66, rx: Math.PI / 2 }), part(box, '#e63946', { x: 0.22, y: 1.4, z: 0.3, sx: 0.16, sy: 0.45, sz: 0.06, rz: 0.2 }),
    part(cyl, '#2b2d42', { y: 2.3, sx: 0.36, sz: 0.36, sy: 0.08 }), part(cyl, '#2b2d42', { y: 2.5, sx: 0.24, sz: 0.24, sy: 0.38 }), part(cyl, '#e63946', { y: 2.38, sx: 0.25, sz: 0.25, sy: 0.08 }),
    part(sph, '#222', { y: 1.4, z: 0.43, s: 0.05 }), part(sph, '#222', { y: 1.2, z: 0.43, s: 0.05 }),
    part(cyl, '#7a5230', { x: 0.55, y: 1.45, rz: -0.9, sx: 0.04, sz: 0.04, sy: 0.7 }), part(cyl, '#7a5230', { x: -0.55, y: 1.45, rz: 0.9, sx: 0.04, sz: 0.04, sy: 0.7 })]);
  G.crates = merge([part(rounded(1.3, 1.1, 1.1, 0.08), '#d89a5b', { y: 0.55 }), part(rounded(1.1, 0.95, 1.0, 0.08), '#c98a4b', { y: 1.58, ry: 0.25 }),
    part(box, '#8a5a32', { y: 0.55, z: 0.56, sx: 1.2, sy: 0.12, sz: 0.02 }), part(box, '#8a5a32', { y: 0.55, z: 0.56, sx: 0.12, sy: 1.0, sz: 0.02 }),
    part(sph, '#ffffff', { y: 2.06, sx: 0.55, sy: 0.12, sz: 0.5 })]);
  G.rock = merge([part(dode, '#8d97ab', { y: 0.7, sx: 0.9, sy: 0.85, sz: 0.85 }), part(dode, '#ffffff', { y: 1.25, sx: 0.65, sy: 0.32, sz: 0.62 }), part(ico, '#7d879b', { x: 0.55, y: 0.3, s: 0.42 })]);
  const stripes = [];
  for (let i = 0; i < 6; i++) stripes.push(part(box, i % 2 ? '#ffffff' : '#ff3b3b', { x: -0.65 + i * 0.26, y: 0.6, sx: 0.26, sy: 0.32, sz: 0.16 }));
  G.fence = merge([...stripes, part(box, '#ffffff', { x: -0.62, y: 0.3, sx: 0.12, sy: 0.6, sz: 0.12 }), part(box, '#ffffff', { x: 0.62, y: 0.3, sx: 0.12, sy: 0.6, sz: 0.12 }),
    part(box, '#2b2d42', { x: -0.62, y: 0.03, sx: 0.4, sy: 0.06, sz: 0.4 }), part(box, '#2b2d42', { x: 0.62, y: 0.03, sx: 0.4, sy: 0.06, sz: 0.4 }), part(sph, '#ffffff', { y: 0.78, sx: 0.7, sy: 0.07, sz: 0.1 })]);
  G.log = merge([part(cyl, '#9a6a3f', { y: 0.36, rz: Math.PI / 2, sx: 0.36, sz: 0.36, sy: 5.4 }), part(cyl, '#d8b48a', { x: 2.71, y: 0.36, rz: Math.PI / 2, sx: 0.3, sz: 0.3, sy: 0.03 }),
    part(cyl, '#d8b48a', { x: -2.71, y: 0.36, rz: Math.PI / 2, sx: 0.3, sz: 0.3, sy: 0.03 }), part(sph, '#ffffff', { y: 0.68, sx: 2.4, sy: 0.08, sz: 0.25 })]);
  const flags = [];
  for (let i = 0; i < 7; i++) flags.push(part(cone, ['#ff3b3b', '#ffd166', '#3a86ff', '#2ec27e'][i % 4], { x: -0.72 + i * 0.24, y: 1.08, rx: Math.PI, sx: 0.1, sz: 0.03, sy: 0.24 }));
  G.bar = merge([part(box, '#5a3d2b', { x: -0.82, y: 1.0, sx: 0.14, sy: 2.0, sz: 0.14 }), part(box, '#5a3d2b', { x: 0.82, y: 1.0, sx: 0.14, sy: 2.0, sz: 0.14 }),
    part(box, '#3a86ff', { y: 1.5, sx: 1.7, sy: 0.6, sz: 0.1 }), part(box, '#ffffff', { y: 1.5, z: 0.06, sx: 1.2, sy: 0.12, sz: 0.02 }), part(box, '#ffd166', { y: 1.84, sx: 1.8, sy: 0.08, sz: 0.14 }), ...flags]);
  const chev = [];
  for (let i = 0; i < 3; i++) for (const sgn of [-1, 1]) chev.push(part(box, '#fff3b0', { x: sgn * 0.26, y: 0.035, z: 0.6 - i * 0.55, ry: sgn * 0.75, sx: 0.12, sy: 0.02, sz: 0.62 }));
  G.boost = merge([part(rounded(1.45, 2.1, 0.06, 0.03), '#ff8a00', { y: 0.02, rx: -Math.PI / 2 }), ...chev]);
  const ramp = new THREE.Shape(); ramp.moveTo(-1.6, 0); ramp.lineTo(1.6, 0); ramp.lineTo(1.6, 0.12); ramp.quadraticCurveTo(0.2, 0.15, -1.6, 1.05); ramp.lineTo(-1.6, 0);
  const rg = new THREE.ExtrudeGeometry(ramp, { depth: 1.45, bevelEnabled: false, curveSegments: 10 }); rg.translate(0, 0, -0.725); rg.rotateY(-Math.PI / 2); // slope rises toward -z
  G.ramp = merge([part(rg, '#4cc3ff'), part(box, '#ffffff', { x: -0.62, y: 0.55, z: -1.0, sx: 0.12, sy: 1.1, sz: 0.12 }), part(box, '#ffffff', { x: 0.62, y: 0.55, z: -1.0, sx: 0.12, sy: 1.1, sz: 0.12 }),
    part(box, '#ffd166', { y: 1.06, z: -1.58, sx: 1.46, sy: 0.05, sz: 0.06 })]);
  const fin = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) fin.push(part(box, (i + j) % 2 ? '#2b2d42' : '#ffffff', { x: -5.5 + i, y: 4.65 + j * 0.5, sx: 1, sy: 0.5, sz: 0.12 }));
  G.finish = merge([part(box, '#e63946', { x: -6.1, y: 2.7, sx: 0.4, sy: 5.4, sz: 0.4 }), part(box, '#e63946', { x: 6.1, y: 2.7, sx: 0.4, sy: 5.4, sz: 0.4 }), ...fin,
    part(sph, '#ffd166', { x: -6.1, y: 5.6, s: 0.4 }), part(sph, '#ffd166', { x: 6.1, y: 5.6, s: 0.4 })]);
}
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 22).rotateX(Math.PI / 2);
const coinMat = glossy('#ffc83d', { emissive: '#a86b00', emissiveIntensity: 0.35, metalness: 0.45, roughness: 0.25 });
const gemGeo = new THREE.OctahedronGeometry(0.36, 0);
const gemMat = glossy('#2ee6ff', { emissive: '#0a6f9a', emissiveIntensity: 0.5, flatShading: true });
const iceWallMat = glossy('#9ee8ff', { transparent: true, opacity: 0.82, roughness: 0.08 });

// ---------------------------------------------------------------- rider: "Pip" in a puffy coat on a donut tube
const sled = new THREE.Group(); scene.add(sled);
const rider = new THREE.Group(); sled.add(rider);
const tubeMat = glossy('#ff3f8e'), coatMat = mat('#ffb703'), hatMat = mat('#e63946');
const tube = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.24, 16, 32), tubeMat); tube.rotation.x = Math.PI / 2; tube.position.y = 0.24; tube.castShadow = true; sled.add(tube);
const tubeHi = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 6, 32, Math.PI * 0.7), mat('#ffffff', { transparent: true, opacity: 0.5 })); tubeHi.rotation.set(Math.PI / 2, 0, 2.2); tubeHi.position.y = 0.43; sled.add(tubeHi);
const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 18), coatMat); body.scale.set(1, 1.0, 0.92); body.position.y = 0.66; body.castShadow = true; rider.add(body);
const zip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.04), mat('#ffffff')); zip.position.set(0, 0.62, -0.41); rider.add(zip);
const head = new THREE.Group(); head.position.y = 1.12; rider.add(head);
const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 22, 16), mat('#ffd7ba')); face.castShadow = true; head.add(face);
const hat = new THREE.Mesh(new THREE.SphereGeometry(0.315, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat); hat.position.y = 0.03; hat.castShadow = true; head.add(hat);
const brim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.075, 10, 24), mat('#ffffff')); brim.rotation.x = Math.PI / 2; brim.position.y = 0.0; head.add(brim);
const pom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), mat('#ffffff')); pom.position.y = 0.38; head.add(pom);
for (const s of [-1, 1]) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#1d1d28')); eye.position.set(s * 0.11, -0.06, -0.27); head.add(eye);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#ff9aa2')); ch.position.set(s * 0.18, -0.13, -0.23); head.add(ch);
}
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 20), hatMat); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.92; rider.add(scarf);
const scarfTail = new THREE.Group(); scarfTail.position.set(0.12, 0.92, 0.26); rider.add(scarfTail);
const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.5), hatMat); tailMesh.position.z = 0.25; tailMesh.castShadow = true; scarfTail.add(tailMesh);
const arms = [];
for (const s of [-1, 1]) {
  const piv = new THREE.Group(); piv.position.set(s * 0.38, 0.82, -0.05); rider.add(piv);
  const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 4, 10), coatMat); a.position.y = -0.2; a.castShadow = true; piv.add(a);
  const mit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hatMat); mit.position.y = -0.42; piv.add(mit);
  piv.rotation.z = s * 0.5; piv.rotation.x = -0.4; arms.push(piv);
}
// rocket flames for boosts (like a speed pad blast)
const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.85, depthWrite: false });
const flameCore = new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0.95, depthWrite: false });
const flames = [];
for (const s of [-1, 1]) {
  const f = new THREE.Group(); f.position.set(s * 0.5, 0.28, 0.62);
  const o = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 12), flameMat); o.rotation.x = Math.PI / 2; o.position.z = 0.8; f.add(o);
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 10), flameCore); c.rotation.x = Math.PI / 2; c.position.z = 0.45; f.add(c);
  sled.add(f); flames.push(f);
}
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: '#4a7fa8', transparent: true, opacity: 0.22, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; scene.add(blob);

// ---------------------------------------------------------------- particles: snow spray (instanced pool), snowfall, speed lines
const SPRAY_N = 160;
const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.1, 0), mat('#ffffff', { roughness: 1 }), SPRAY_N);
spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage); spray.frustumCulled = false; scene.add(spray);
const sp = Array.from({ length: SPRAY_N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, s: 1 }));
let spI = 0;
const DM = new THREE.Object3D();
function emitSpray(pos, vx, vy, vz, s = 1) { const q = sp[spI++ % SPRAY_N]; q.p.copy(pos); q.v.set(vx, vy, vz); q.life = 1; q.s = s; }
function updSpray(dt) {
  for (let i = 0; i < SPRAY_N; i++) {
    const q = sp[i];
    if (q.life > 0) { q.life -= 0.05 * dt; q.v.y -= 0.012 * dt; q.p.addScaledVector(q.v, dt); }
    DM.position.copy(q.p); DM.scale.setScalar(Math.max(0, q.life) * q.s); DM.updateMatrix(); spray.setMatrixAt(i, DM.matrix);
  }
  spray.instanceMatrix.needsUpdate = true;
}
const flakeTex = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
const FLAKES = 260, fpos = new Float32Array(FLAKES * 3);
for (let i = 0; i < FLAKES; i++) { fpos[i * 3] = (Math.random() - 0.5) * 18; fpos[i * 3 + 1] = (Math.random() - 0.5) * 12; fpos[i * 3 + 2] = -Math.random() * 30; }
const flakeGeo = new THREE.BufferGeometry(); flakeGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ map: flakeTex, size: 0.16, transparent: true, depthWrite: false, opacity: 0.95 }));
flakes.frustumCulled = false; camera.add(flakes);
const LINES = 18, lines = [];
const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false });
for (let i = 0; i < LINES; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 2.2), lineMat); const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 1.6;
  m.position.set(Math.cos(a) * r * 0.65, Math.sin(a) * r, -4 - Math.random() * 8); m.frustumCulled = false; camera.add(m); lines.push(m);
}

// ---------------------------------------------------------------- level world
let world = new THREE.Group(); scene.add(world);
let obs = [], coins = [], coinMesh = null, gemMesh = null, gems = [], goal = 300, finishZ = -300, rnd = rng(1);
const disposeList = [];
function clearWorld() {
  scene.remove(world); for (const g of disposeList) g.dispose(); disposeList.length = 0;
  world = new THREE.Group(); scene.add(world); obs = []; coins = []; gems = [];
}
const yawPitch = (o, z) => { o.rotation.order = 'YXZ'; o.rotation.y = -Math.atan(dX(z)); o.rotation.x = Math.atan(dY(z)); };

function buildGround(z0, z1) {
  const step = 1.5, rows = Math.ceil((z0 - z1) / step) + 1;
  // ice channel
  const IX = [-4.65, -4.3, -3.9, -3.5, -3.15, -2.9, -2.75, -1.4, 0, 1.4, 2.75, 2.9, 3.15, 3.5, 3.9, 4.3, 4.65], C = IX.length;
  const ip = new Float32Array(rows * C * 3), iu = new Float32Array(rows * C * 2), idx = [];
  for (let r = 0; r < rows; r++) {
    const z = z0 - r * step, c0 = cx(z), y0 = ty(z);
    for (let c = 0; c < C; c++) { const k = r * C + c; ip[k * 3] = c0 + IX[c]; ip[k * 3 + 1] = y0 + wallY(IX[c]); ip[k * 3 + 2] = z; iu[k * 2] = (IX[c] + 4.65) / 9.3; iu[k * 2 + 1] = -z / 18; }
    if (r) for (let c = 0; c < C - 1; c++) { const a = (r - 1) * C + c, b = a + 1, d = r * C + c, e = d + 1; idx.push(a, b, d, b, e, d); }
  }
  const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.BufferAttribute(ip, 3)); ig.setAttribute('uv', new THREE.BufferAttribute(iu, 2)); ig.setIndex(idx); ig.computeVertexNormals();
  const ice = new THREE.Mesh(ig, ICE); ice.receiveShadow = true; world.add(ice); disposeList.push(ig);
  // snow banks (both sides) with gentle hills that rise into valley walls
  const SX = [4.65, 5.0, 5.6, 6.6, 8, 10, 13, 17, 22, 29, 38, 50, 66], N = SX.length, sides = [-1, 1];
  const sp2 = new Float32Array(rows * N * 2 * 3), sc = new Float32Array(rows * N * 2 * 3), sidx = []; const col = new THREE.Color();
  const hill = (x, z) => 0.5 * Math.sin(x * 0.31 + z * 0.07) + 0.6 * Math.sin(x * 0.13 - z * 0.045) + 0.3 * Math.sin(z * 0.19);
  for (let si = 0; si < 2; si++) for (let r = 0; r < rows; r++) {
    const z = z0 - r * step, c0 = cx(z), y0 = ty(z), s = sides[si];
    for (let c = 0; c < N; c++) {
      const a = SX[c], k = (si * rows + r) * N + c, out = Math.max(0, a - 5.2);
      sp2[k * 3] = c0 + s * a; sp2[k * 3 + 2] = z;
      sp2[k * 3 + 1] = y0 + 1.55 + (a < 5.2 ? 0.05 * (a - 4.65) : out * 0.12 + Math.pow(out / 14, 2) * 4 + (out > 1 ? hill(s * a, z) * Math.min(1, out / 6) : 0));
      const shade = 0.93 + 0.07 * Math.sin(a * 0.7 + z * 0.13); col.setRGB(shade, shade * 0.985 + 0.01, 1); col.convertSRGBToLinear();
      sc[k * 3] = col.r; sc[k * 3 + 1] = col.g; sc[k * 3 + 2] = col.b;
    }
    if (r) for (let c = 0; c < N - 1; c++) { const a = (si * rows + r - 1) * N + c, b = a + 1, d = (si * rows + r) * N + c, e = d + 1; if (s > 0) sidx.push(a, b, d, b, e, d); else sidx.push(a, d, b, b, d, e); }
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp2, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3)); sg.setIndex(sidx); sg.computeVertexNormals();
  const snow = new THREE.Mesh(sg, SNOW); snow.receiveShadow = true; world.add(snow); disposeList.push(sg);
}

function instanced(geo, material, list, shadow = true, colors = null) {
  if (!list.length) return;
  const im = new THREE.InstancedMesh(geo, material, list.length); const o = new THREE.Object3D();
  list.forEach((t, i) => { o.position.set(t.x, t.y, t.z); o.rotation.set(t.rx || 0, t.ry || 0, 0); o.scale.set(t.sx ?? t.s, t.sy ?? t.s, t.sz ?? t.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (colors) im.setColorAt(i, new THREE.Color(colors[i % colors.length])); });
  im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); world.add(im); return im;
}

function buildScenery(z0, z1) {
  const r = rng(level * 131 + 5), lists = {};
  const add = (k, t) => (lists[k] = lists[k] || []).push(t);
  const bankY = (a, z) => ty(z) + 1.55 + Math.max(0, a - 5.2) * 0.12 + Math.pow(Math.max(0, a - 5.2) / 14, 2) * 4;
  for (let z = z0; z > z1; z -= 4 + r() * 4) {
    for (const s of [-1, 1]) {
      const kind = T.props[Math.floor(r() * T.props.length)];
      const a = (kind === 'tower' ? 9 : kind === 'mesa' ? 12 : kind === 'cliff' ? 10 : 6.8) + r() * (kind === 'tower' ? 8 : 14);
      const zz = z + r() * 3, x = cx(zz) + s * a, y = bankY(a, zz) - 0.2;
      const sc = kind === 'pine' ? 0.8 + r() * 0.7 : kind === 'cliff' ? 1.2 + r() * 1.8 : kind === 'tower' ? 0.8 + r() * 0.9 : kind === 'mesa' ? 0.8 + r() * 0.8 : kind === 'cactus' ? 0.8 + r() * 0.5 : kind === 'ptree' ? 0.9 + r() * 0.4 : 0.9;
      add(kind, { x, y, z: zz, ry: r() * 6.28, s: sc, sy: kind === 'tower' ? sc * (0.7 + r() * 1.3) : undefined, sx: kind === 'tower' ? sc : undefined, sz: kind === 'tower' ? sc : undefined });
      if (r() < 0.5 && kind !== 'tower') { const a2 = 20 + r() * 25; add(T.props.includes('tower') ? 'tower' : T.props.includes('mesa') ? 'mesa' : 'pine', { x: cx(zz) + s * a2, y: bankY(a2, zz) - 0.5, z: zz - 2, ry: r() * 6, s: 1.3 + r() }); }
    }
    if (r() < 0.65) for (const s of [-1, 1]) add('post', { x: cx(z) + s * 4.95, y: ty(z) + 1.6, z, ry: 0, s: 1 });
  }
  for (let z = z0 - 40; z > z1 - 120; z -= 26 + r() * 20) for (const s of [-1, 1]) add('mountain', { x: cx(z) + s * (70 + r() * 50), y: ty(z) - 4, z, ry: r() * 6, sx: 38 + r() * 30, sy: 34 + r() * 36, sz: 38 + r() * 30 });
  for (const [k, list] of Object.entries(lists)) {
    const m = k === 'cliff' || k === 'mountain' || k === 'mesa' ? VCF : VC;
    let colors = null;
    if (k === 'cliff') colors = null;
    if (k === 'tower') colors = ['#ffffff', '#ffe3c9', '#d9ecff', '#e7ddff', '#ffd6d6'];
    const im = instanced(G[k], m, list, k !== 'mountain' && k !== 'post', colors);
    if (k === 'cliff' && im) { const c = new THREE.Color(T.rock); for (let i = 0; i < list.length; i++) im.setColorAt(i, c); }
  }
}

// obstacle kinds: block (change lane), low (jump or change lane), bar (duck), gate (full width, jump), boost, ramp
const KIND = { roller: 'low', ball: 'block', snowman: 'block', crates: 'block', rock: 'block', icewall: 'low', fence: 'low', bar: 'bar', log: 'gate', boost: 'boost', ramp: 'ramp' };
function addObs(type, lane, d) {
  const z = -d, kind = KIND[type];
  let mesh;
  if (type === 'icewall') { mesh = new THREE.Mesh(rounded(1.45, 0.8, 0.6, 0.12), iceWallMat); mesh.geometry.translate(0, 0.4, 0); disposeList.push(mesh.geometry); }
  else mesh = new THREE.Mesh(G[type], type === 'boost' ? VCB : VC);
  const lx = type === 'log' ? 0 : lane * LW;
  mesh.position.set(cx(z) + lx, ty(z) + (type === 'boost' ? 0.02 : 0), z); yawPitch(mesh, z);
  mesh.castShadow = type !== 'boost'; mesh.receiveShadow = true; mesh.visible = false; world.add(mesh);
  const len = { block: 1.0, low: type === 'roller' ? 0.9 : 0.6, bar: 0.3, gate: 0.7, boost: 2.0, ramp: 3.2 }[kind];
  const h = { icewall: 0.8, fence: 0.75, log: 0.72, roller: 0.8 }[type] || 0;
  const o = { type, kind, lane, lanes: type === 'log' ? [-1, 0, 1] : type === 'roller' ? [-1, 0, 1] : [lane], d, d0: d, len, h, mesh, passed: false, hit: false, wob: 0, dyn: type === 'roller' ? 1 : type === 'ball' ? 2 : 0, x: 0, ph: 0 };
  obs.push(o); return o;
}
function addCoins(lane, d0, n, arc = 0) {
  for (let i = 0; i < n; i++) { const d = d0 + i * 2.2, t = n > 1 ? i / (n - 1) : 0; coins.push({ lane, d, h: 0.75 + arc * Math.sin(t * Math.PI), got: false, spin: i * 0.4 }); }
}


// ---------------------------------------------------------------- v2: levels from authored phrases
const dayKey = () => { const n = new Date(); return Math.floor((n.getTime() - n.getTimezoneOffset() * 6e4) / 864e5); };
const worldOf = lv => (lv <= 30 ? LEVELS[lv - 1].w : 3);
const unlockedWorld = () => worldOf(Math.min(unlocked, 30));
const PHRASE_W = {};                                              // first world each phrase appears in
LEVELS.forEach(l => [...l.seq, ...(l.seq2 || [])].forEach(n => { const k = n.replace('~', ''); PHRASE_W[k] = Math.min(PHRASE_W[k] || 9, l.w); }));
function genLevel(seed, maxW, name) {                             // daily chute and the chutes after 30: authored phrases in a seeded order
  const r = rng(seed * 2654 + 11), pool = Object.keys(PHRASE_W).filter(k => PHRASE_W[k] <= maxW && !/^pad/.test(k) && k !== 'chainpad' && k !== 'rollerpad');
  const pick = () => { const k = pool[Math.floor(r() * pool.length)]; return r() < 0.4 ? k + '~' : k; };
  const half = () => { const a = ['coins']; for (let i = 0; i < 6 + maxW; i++) a.push(pick(), r() < 0.22 ? (r() < 0.5 ? 'padall' : 'padgem') : pick()); a.push(r() < 0.5 ? 'padgem' : 'padall'); return a; };
  const lv = { n: name, w: maxW, sp: 19 + maxW * 2.4 + Math.min(3, seed % 4 * 0.4), seq: half(), seq2: half(), daily: true };
  return Object.assign(lv, expand(lv));
}
function deepLevel(lv) {
  if (daily) return genLevel(dayKey(), unlockedWorld(), 'Daily Chute');
  if (lv > 30) return genLevel(1000 + lv, 3, 'Endless Chute ' + (lv - 30));
  const L = LEVELS[lv - 1]; return Object.assign({}, L, expand(L));
}
let LV = null, curSp = 17, coinTotal = 0, gemTotal = 0;
function arcY(dd, spd) { const t = Math.max(0, dd) / spd; return clamp(1.05 + 11.5 * t - 13.5 * t * t, 0, 3.4); }
function deepBuild(L) {
  let lastRamp = null;
  const spd = L.sp + 1.5, blocks = { S: 'snowman', C: 'crates', R: 'rock', w: 'icewall', f: 'fence', B: 'bar', '^': 'boost', '/': 'ramp', b: 'ball' };
  for (const { d, row } of L.rows) {
    let logDone = false;
    [...row].forEach((c, i) => {
      const lane = i - 1;
      if (blocks[c]) { const o = addObs(blocks[c], lane, c === 'b' ? d + 23 : d); if (c === '/') lastRamp = d; return; }
      if (c === 'G') { if (!logDone) { addObs('log', 0, d); logDone = true; } return; }
      if (c === 'M') { const o = addObs('roller', 0, d); o.ph = d * 0.37; return; }
      if (c === 'o') { addCoins(lane, d - 9, 5); return; }
      const air = lastRamp !== null && d - lastRamp < 26 ? arcY(d - lastRamp - 1.6, spd) : 0;
      if (c === 'O') { coins.push({ lane, d, h: 0.75 + (air || 1.3), got: false, spin: d * 0.1 }); return; }
      if (c === '*') gems.push({ lane, d, got: false, y0: air });
    });
  }
  coinTotal = coins.length; gemTotal = gems.length;
}

function buildLevel() {
  clearWorld();
  LV = DEEP ? deepLevel(level) : null;
  T = DEEP ? WTHEMES[LV.w - 1][(level - 1) % WTHEMES[LV.w - 1].length] : THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', T.sky[0]); document.body.style.setProperty('--bg2', T.sky[1]); document.body.style.setProperty('--ui', T.ui);
  scene.fog = new THREE.Fog(T.fog, 45, 175);
  { const su = DEEP ? SUITS[suit()] : T; tubeMat.color.set(su.tube); coatMat.color.set(su.coat); hatMat.color.set(su.hat); }
  fk = F.k(); curSp = LV ? LV.sp : 17;
  goal = LV ? LV.length : level === 1 ? 210 : Math.min(1400, 200 + level * 70);
  finishZ = -goal;
  rnd = rng(level * 7919 + 3);
  buildGround(40, -goal - 190);
  buildScenery(30, -goal - 150);
  // obstacles: rows of patterns with breathing room
  if (LV) deepBuild(LV); else {
  const gap = Math.max(13, (30 - level * 1.6) / fk);
  const blocks = ['snowman', 'crates', 'rock'];
  const pickBlock = () => blocks[Math.floor(rnd() * blocks.length)];
  let d = 40, lastFree = 0;
  while (d < goal - 18) {
    const p = rnd(), lanes = [-1, 0, 1];
    const free = lanes[Math.floor(rnd() * 3)];
    if (level >= 2 && p < 0.1) {                                     // full-width log: must jump
      addObs('log', 0, d); addCoins(free, d - 3, 3, 1.2);
    } else if (p < 0.2) {                                            // speed pad + coin line
      addObs('boost', free, d); addCoins(free, d + 4, 6); lanes.filter(l => l !== free && rnd() < 0.5).forEach(l => addObs(pickBlock(), l, d + 6));
    } else if (p < 0.32) {                                           // jump ramp with an air arc of coins, walls elsewhere
      addObs('ramp', free, d); addCoins(free, d + 3, 7, 2.6);
      lanes.filter(l => l !== free).forEach(l => addObs(level > 2 && rnd() < 0.5 ? 'fence' : pickBlock(), l, d + 1));
    } else if (p < 0.47) {                                           // duck bar
      addObs('bar', free, d); lanes.filter(l => l !== free).forEach(l => addObs(pickBlock(), l, d)); addCoins(free, d + 3, 4);
    } else if (p < 0.65) {                                           // low walls: jump
      addObs(rnd() < 0.5 ? 'icewall' : 'fence', free, d);
      if (level > 1) lanes.filter(l => l !== free).forEach(l => rnd() < 0.6 && addObs(pickBlock(), l, d));
      addCoins(free, d - 4, 3, 1.4);
    } else {                                                         // 1–2 blocks, coin line in the gap
      lanes.filter(l => l !== free).forEach((l, i) => (i === 0 || level > 1 || rnd() < 0.4) && addObs(pickBlock(), l, d));
      addCoins(free, d - 6, 5);
    }
    if (rnd() < 0.18) gems.push({ lane: lastFree, d: d + gap * 0.5, got: false });
    lastFree = free; d += gap * (0.85 + rnd() * 0.5);
  }
  }
  // finish arch
  const fm = new THREE.Mesh(G.finish, VC); fm.position.set(cx(finishZ), ty(finishZ), finishZ); yawPitch(fm, finishZ); fm.castShadow = true; world.add(fm);
  coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, Math.max(1, coins.length)); coinMesh.castShadow = true; coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); coinMesh.frustumCulled = false; world.add(coinMesh);
  gemMesh = new THREE.InstancedMesh(gemGeo, gemMat, Math.max(1, gems.length)); gemMesh.castShadow = true; gemMesh.frustumCulled = false; world.add(gemMesh);
  // reset run state
  Object.assign(P, { lane: 0, x: 0, y: 0, vy: 0, duck: 0, flip: 0, air: false, lean: 0, laneT: 9, ramp: null });
  dist = 0; speed = baseSpeed(); boost = 0; coinsGot = 0; dead = false; crashT = 0; winT = 0; combo = 0;
  chain = 0; chainT = 0; smashes = 0; coinHit = 0; gemsGot = 0; cpSnap = null; surgeT = 0;
  ui.levels(daily ? 'D' : level); ui.progress(0); ui.score(0); setCoins(0); ui.sub(DEEP ? deepSub() : best ? `BEST ${best} m` : '');
  if (DEEP) chainUI();
  sled.visible = true; rider.position.set(0, 0, 0); rider.rotation.set(0, 0, 0); sled.rotation.set(0, 0, 0);
  placeRider(0);
  camPos.copy(sled.position).add(new THREE.Vector3(0, 4.4, 8)); camLook.copy(sled.position);
}

// ---------------------------------------------------------------- run state
const P = { lane: 0, x: 0, y: 0, vy: 0, duck: 0, flip: 0, air: false, lean: 0, laneT: 9, ramp: null };
let chain = 0, chainT = 0, smashes = 0, coinHit = 0, gemsGot = 0, cpSnap = null, cpD = 0, surgeT = 0;
let state = 'ready', dist = 0, speed = 16, boost = 0, coinsGot = 0, dead = false, crashT = 0, winT = 0, combo = 0, shake = 0, fovKick = 0;
let deaths = 0, deathLv = -1;                                       // v2 loss-streak assist: 3rd+ straight loss on a level slows it 5% each (max 15%)
const easeF = () => 1 - Math.min(0.15, Math.max(0, deaths - 2) * 0.05);
const baseSpeed = () => DEEP ? Math.min(31, curSp * fk * easeF()) : Math.min(28, (16.5 + level * 0.7) * fk);
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let squash = 0;

function steer(dir) {
  if (state !== 'play' || dead) return;
  const nl = clamp(P.lane + dir, -1, 1);
  if (nl === P.lane) { P.lean = dir * 0.6; shake = 0.15; tone(160, 0.06, 'square', 0.06); return; }
  P.lane = nl; P.laneT = 0; P.lean = dir; sfx.tap(); buzz(8);
  for (let i = 0; i < 8; i++) emitSpray(sled.position.clone().add(new THREE.Vector3(-dir * 0.5, 0.15, 0.3)), -dir * (0.05 + Math.random() * 0.08), 0.05 + Math.random() * 0.08, 0.04 + Math.random() * 0.1, 1.2);
}
function jump() {
  if (state !== 'play' || dead || P.air) return;
  P.vy = DEEP ? 10.2 : 9.2; P.air = true; P.duck = 0; sfx.bounce(); buzz(10); tone(330, 0.12, 'sine', 0.1, 1.8);
  for (let i = 0; i < 10; i++) emitSpray(sled.position, (Math.random() - 0.5) * 0.12, 0.05 + Math.random() * 0.06, Math.random() * 0.1, 1.3);
}
function duck() {
  if (state !== 'play' || dead) return;
  if (P.air) { P.vy = Math.min(P.vy, -14); }                         // slam down
  P.duck = 0.8; tone(200, 0.1, 'triangle', 0.1, 0.6); buzz(8);
}
input({ onSwipe: d => d === 'left' ? steer(-1) : d === 'right' ? steer(1) : d === 'up' ? jump() : duck() });
addEventListener('keydown', e => { if (state === 'ready' && e.key.startsWith('Arrow')) return; ({ ArrowLeft: () => steer(-1), ArrowRight: () => steer(1), ArrowUp: jump, ArrowDown: duck, a: () => steer(-1), d: () => steer(1), w: jump, s: duck, ' ': jump })[e.key]?.(); });

ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (DEEP) { if (w === 'win') (daily ? openMap() : playLevel(Math.min(level + 1, unlocked))); else retry(); }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; }
  else if (w === 'lose') { buildLevel(); state = 'play'; }
});

function crash(o) {
  if (dead) return;
  dead = true; o.hit = true; if (state === 'play') F.level(false, clamp(dist / goal, 0, 1)); state = 'lost'; crashT = 0; shake = 1;
  sfx.smash(); buzz([50, 30, 80]); ui.flash(0.55);
  burst(scene, sled.position.clone().add(new THREE.Vector3(0, 0.8, -0.6)), ['#ffffff', '#e6f6ff', T.tube], 26, { speed: 0.16, up: 0.14, size: 1.1, shape: 'sphere' });
  P.vy = 7; o.wob = 1;
  const pct = Math.round(dist / goal * 100);
  if (DEEP) { chain = 0; chainUI(); deepLose(pct); return; }
  ui.lose('WIPEOUT!', `${Math.round(dist)} m · ${pct}% of the run`);
}
function win() {
  if (state === 'play') { F.level(true); WB.submit(1); }
  state = 'won'; winT = 0;
  const m = Math.round(goal); best = Math.max(best, m); save.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, sled.position.clone().add(new THREE.Vector3(0, 2, -2)), 50), i * 180);
  ui.pop('FINISH!', '#fff', 46, 26);
  if (DEEP) deepWin(); else ui.win(level, `${coinsGot} coins collected`);
}

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first swipe,
// the sled dodges the first obstacles on its own (the game's own bot) for ~2 s, then the run is the player's
const DEMO = demo(null, { ready: () => level === 1 && state === 'play' && !dead, wait: 1000, ms: 2400 });
let demoT = 0, demoBack = false;
function placeRider(dt) {
  const z = -dist, laneX = P.lane * LW;
  P.x = lerp(P.x, laneX, 1 - Math.pow(0.0008, dt / 60));
  const px = cx(z) + P.x, py = ty(z) + P.y;
  sled.position.set(px, py, z);
  sled.rotation.order = 'YXZ';
  sled.rotation.y = -Math.atan(dX(z)) + (laneX - P.x) * -0.25;
  sled.rotation.x = Math.atan(dY(z)) * 0.8;
  sled.rotation.z = P.lean * -0.32;
}

// ---------------------------------------------------------------- main loop
const tmpV = new THREE.Vector3();
loop((dt, t) => {
  const sec = dt / 60;
  if (DEMO.on && level === 1 && state === 'play' && !dead && t - demoT > 0.12) { demoT = t; demoBack = true; window.__game.bot(); }
  else if (demoBack && !DEMO.on && state === 'play' && !dead) {   // demo over, nobody touched: back to the middle lane, where an untouched run rides
    if (DEMO.touched || P.lane === 0) demoBack = false;
    else if (!P.air && !obs.some(o => !o.passed && o.lanes.includes(0) && o.d - dist > -1.5 && o.d - dist < 9 && o.kind !== 'boost' && o.kind !== 'ramp')) { steer(-Math.sign(P.lane)); demoBack = false; }
  }
  if (window.__game && window.__game.auto && state === 'play' && !dead) window.__game.bot();
  if (state === 'play' || (state === 'won' && winT < 2)) {
    if (state === 'play') { speed = Math.min(baseSpeed() + 5, speed + 0.4 * sec); }
    const sp = state === 'won' ? speed * Math.max(0, 1 - winT) : speed + boost * 9;
    dist += sp * sec; if (state === 'won') winT += sec;
    boost = Math.max(0, boost - 0.45 * sec);
    // vertical
    if (P.ramp) {
      const o = P.ramp, u = clamp((dist - (o.d - o.len / 2)) / o.len, 0, 1);
      P.y = Math.max(P.y, u * 1.05);
      if (u >= 1 || Math.abs(P.x - o.lane * LW) > 1) { P.ramp = null; P.vy = 11.5; P.air = true; P.flip = 1; ui.pop(['AIR TIME!', 'WHEEE!', 'FLIP!'][Math.floor(Math.random() * 3)], '#fff', 36, 24); sfx.pick(6); buzz(15); stunt(); }
    } else if (P.air || P.y > 0) {
      P.vy -= 27 * sec; P.y += P.vy * sec;
      if (P.y <= 0) {
        const hit = Math.abs(P.vy); if (DEEP && hit > 12) { shake = Math.max(shake, 0.2); fovKick = Math.max(fovKick, 0.4); for (let i = 0; i < 18; i++) emitSpray(sled.position, (Math.random() - 0.5) * 0.3, 0.05 + Math.random() * 0.09, (Math.random() - 0.3) * 0.16, 1.5); }
        P.y = 0; P.air = false; P.vy = 0; P.flip = 0; rider.rotation.x = 0; squash = 1; tone(240, 0.08, 'sine', 0.1, 0.7); buzz(8);
        for (let i = 0; i < 14; i++) emitSpray(sled.position, (Math.random() - 0.5) * 0.18, 0.04 + Math.random() * 0.07, (Math.random() - 0.3) * 0.12, 1.4);
      }
    }
    P.duck = Math.max(0, P.duck - sec);
    P.laneT += sec; P.lean = lerp(P.lean, 0, 1 - Math.pow(0.02, sec));
    if (!dead) placeRider(dt);
    // progress
    if (state === 'play') {
      ui.progress(dist / goal); ui.score(Math.floor(dist) + ' m');
      if (DEEP) {
        if (!cpSnap && LV && dist >= LV.mid) saveCp();
        if (chain > 0 && (chainT -= sec) <= 0) { chain = 0; chainUI(); }
        surgeT = Math.max(0, surgeT - sec);
      }
      if (dist >= goal) win();
    }
    // collisions
    if (state === 'play') for (const o of obs) {
      if (o.passed || o.hit) continue;
      const dz = o.d - dist;
      if (dz < -o.len / 2 - 0.6) {
        o.passed = true;
        if (o.kind === 'block' && Math.abs(o.lane * LW - P.x) < LW * 1.2 && P.laneT < 0.45) { combo++; ui.pop(combo > 1 ? `CLOSE CALL x${combo}` : 'CLOSE CALL!', '#ffe66d', 32, 24); sfx.pick(combo); stunt(); }
        if ((o.kind === 'low' || o.kind === 'gate') && P.y > 0.4 && Math.abs(o.lane * LW - P.x) < 1.2) { ui.pop(['NICE JUMP!', 'HOP!', 'SMOOTH!'][Math.floor(Math.random() * 3)], '#ffe66d', 32, 24); sfx.pick(3); stunt(); }
        if (o.kind === 'bar' && Math.abs(o.lane * LW - P.x) < 1.2) { ui.pop('LIMBO!', '#ffe66d', 32, 24); sfx.pick(4); stunt(); }
        continue;
      }
      if (Math.abs(dz) > o.len / 2 + 0.45) continue;
      const inLane = o.dyn === 1 ? Math.abs(P.x - o.x) < 1.1 : o.lanes.some(l => Math.abs(P.x - l * LW) < 1.05);
      if (!inLane) continue;
      if (o.kind === 'boost') { if (P.y < 0.3 && !o.used) { o.used = true; boost = 1; fovKick = 1; ui.pop('BOOST!', '#ffb02e', 46, 24); tone(300, 0.4, 'sawtooth', 0.08, 2.2); buzz(20); } continue; }
      if (o.kind === 'ramp') { if (!P.ramp && !o.used && P.y < 0.6) { o.used = true; P.ramp = o; P.air = false; P.vy = 0; } continue; }
      if (DEEP && boost > 0.12 && (o.kind === 'block' || o.kind === 'bar' || ((o.kind === 'low' || o.kind === 'gate') && P.y < o.h - 0.12))) { smash(o); continue; }
      if (o.kind === 'block') crash(o);
      else if ((o.kind === 'low' || o.kind === 'gate') && P.y < o.h - 0.12) crash(o);
      else if (o.kind === 'bar' && (P.duck <= 0 || P.y > 0.35)) crash(o);
      if (dead) break;
    }
  }
  // crash tumble: rider flies forward out of the tube
  if (dead) {
    crashT += sec;
    P.vy -= 22 * sec; P.y += P.vy * sec;
    rider.position.y = Math.max(0, rider.position.y + P.vy * sec * 0.5); rider.position.z -= 3 * sec * Math.max(0, 1 - crashT);
    rider.rotation.x -= 9 * sec * Math.max(0, 1 - crashT * 0.8); rider.rotation.z += 4 * sec * Math.max(0, 1 - crashT);
    if (rider.position.y <= 0 && crashT > 0.2) rider.position.y = 0;
    sled.rotation.y += 6 * sec * Math.max(0, 1 - crashT);
  }
  // rider animation: duck squash, flip, lean, scarf
  squash = Math.max(0, squash - 4 * sec);
  const duckAmt = P.duck > 0 ? Math.min(1, P.duck * 6, 1) : 0;
  if (!dead) {
    rider.scale.set(1 + squash * 0.18 + duckAmt * 0.12, 1 - squash * 0.22 - duckAmt * 0.42, 1 + squash * 0.18);
    rider.rotation.x = P.flip ? -(1 - Math.max(0, P.vy + 11.5) / 23) * Math.PI * 2 : duckAmt * 0.5;
    const stretch = P.air ? clamp(Math.abs(P.vy) * 0.012, 0, 0.12) : 0;
    tube.scale.set(1 + squash * 0.15 - stretch, 1 + squash * 0.15 - stretch, 1 - squash * 0.3 + stretch);
    for (const [i, a] of arms.entries()) { a.rotation.x = P.air ? -2.4 + Math.sin(t * 20) * 0.2 : -0.4 + Math.sin(t * 9 + i) * 0.06; a.rotation.z = (i ? 1 : -1) * (P.air ? 0.9 : 0.5); }
  }
  scarfTail.rotation.y = Math.sin(t * 17) * 0.35; scarfTail.rotation.x = 0.25 + Math.sin(t * 23) * 0.18;
  head.rotation.z = P.lean * 0.25;
  // flames when boosting
  const fl = boost > 0.02 && !dead ? Math.min(1, boost * 3) : 0;
  flames.forEach((f, i) => { f.visible = fl > 0; f.scale.set(fl * (0.9 + Math.random() * 0.2), fl * (0.9 + Math.random() * 0.2), fl * (0.8 + Math.random() * 0.5)); });
  // spray from the tube while sliding
  if ((state === 'play' || state === 'won') && !dead && !P.air && Math.random() < 0.9) {
    for (const s of [-1, 1]) { tmpV.set(s * 0.55, 0.12, 0.45).applyEuler(sled.rotation).add(sled.position); emitSpray(tmpV, s * 0.02 + (Math.random() - 0.5) * 0.03, 0.03 + Math.random() * 0.04, 0.05 + Math.random() * 0.05, 0.8 + boost); }
  }
  updSpray(dt);
  blob.position.set(sled.position.x, ty(-dist) + 0.03, sled.position.z); blob.scale.setScalar(clamp(1 - P.y * 0.18, 0.4, 1)); blob.visible = !dead || crashT < 0.1;
  // coins + gems
  const near = -dist;
  if (coinMesh) {
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i], z = -c.d, x = cx(z) + c.lane * LW, y = ty(z) + c.h;
      if (c.got) { c.fly = (c.fly || 0) + sec * 6; if (c.fly < 1) { DM.position.set(x, y + c.fly * 2, z); DM.scale.setScalar(1 - c.fly); } else DM.scale.setScalar(0); }
      else {
        DM.position.set(x, y + Math.sin(t * 4 + c.spin) * 0.1, z); DM.scale.setScalar(z > near - 120 && c.d > dist - 1.5 ? 1 : 0);
        if (state === 'play' && Math.abs(c.d - dist) < 0.9 && Math.abs(c.lane * LW - P.x) < 0.95 && Math.abs(c.h - 0.75 - P.y) < 1.1) {
          c.got = true; coinsGot++; coinHit++; setCoins(coinsGot); sfx.coin(); tone(900 + (coinsGot % 8) * 60, 0.05, 'square', 0.04, 1.2);
          burst(scene, new THREE.Vector3(x, y, z), ['#ffd23f', '#fff4c2'], 5, { speed: 0.06, up: 0.06, size: 0.5, life: 0.6 });
        }
      }
      DM.rotation.set(0, t * 4 + c.spin, 0); DM.updateMatrix(); coinMesh.setMatrixAt(i, DM.matrix);
    }
    coinMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < gems.length; i++) {
      const g = gems[i], z = -g.d;
      if (!g.got && state === 'play' && Math.abs(g.d - dist) < 1 && Math.abs(g.lane * LW - P.x) < 1 && Math.abs(P.y - (g.y0 || 0)) < 1.3) {
        g.got = true; gemsGot++; coinsGot += 10; setCoins(coinsGot); stunt(); ui.pop('+10 GEM!', '#ff7bd5', 38, 24); sfx.pick(8); buzz(15);
        burst(scene, new THREE.Vector3(cx(z) + g.lane * LW, ty(z) + 1, z), ['#2ee6ff', '#ffffff'], 14, { speed: 0.1, up: 0.1, size: 0.6 });
      }
      DM.position.set(cx(z) + g.lane * LW, ty(z) + 1.0 + (g.y0 || 0) + Math.sin(t * 3 + i) * 0.15, z); DM.rotation.set(0, t * 2.5, 0); DM.scale.setScalar(g.got || g.d < dist - 1.5 ? 0 : 1.1); DM.updateMatrix(); gemMesh.setMatrixAt(i, DM.matrix);
    }
    gemMesh.instanceMatrix.needsUpdate = true;
  }
  // obstacle visibility window + hit wobble
  for (const o of obs) {
    if (o.dyn === 2) { o.d = o.d0 - 0.4 * Math.max(0, dist - (o.d0 - 80)); const zz = -o.d; o.mesh.position.set(cx(zz) + o.lane * LW, ty(zz), zz); o.mesh.rotation.set(-dist * 0.9, 0, 0); }
    else if (o.dyn === 1) { o.x = Math.sin(t * 2.1 + o.ph) * LW * 1.3; const zz = -o.d; o.mesh.position.x = cx(zz) + o.x; o.mesh.rotation.z = t * 5; }
    const dz = o.d - dist; o.mesh.visible = !o.hit || !o.smashed ? dz > -2.5 && dz < 150 : false;
    if (o.wob > 0) { o.wob = Math.max(0, o.wob - sec * 1.5); o.mesh.scale.set(1 + Math.sin(o.wob * 30) * 0.12 * o.wob, 1 - Math.sin(o.wob * 30) * 0.12 * o.wob, 1); }
    if (o.kind === 'boost') o.mesh.material = VCB;
  }
  // camera: behind and above, eased, leaning into turns; widens on boost
  const zc = -dist + 8.4;
  const behind = new THREE.Vector3(cx(zc) + P.x * 0.6, ty(zc) + 4.7 + P.y * 0.35, zc);
  const look = new THREE.Vector3(cx(-dist - 12) + P.x * 0.5, ty(-dist - 12) + 0.4, -dist - 12);
  const k = 1 - Math.pow(0.0005, sec);
  camPos.lerp(behind, k); camLook.lerp(look, k);
  shake = Math.max(0, shake - sec * 2.2);
  camera.position.copy(camPos).add(tmpV.set((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0));
  camera.lookAt(camLook);
  camera.rotation.z += P.lean * -0.03;
  fovKick = Math.max(boost, fovKick - sec * 0.8);
  const baseF = camera.aspect < 0.7 ? 62 : 54;
  camera.fov = lerp(camera.fov, baseF + fovKick * 10 + (speed - 16) * 0.3, 0.1); camera.updateProjectionMatrix();
  S.followLight(new THREE.Vector3(sled.position.x, sled.position.y, sled.position.z - 5));
  // snowfall + speed lines in camera space
  const vel = (state === 'play' ? speed + boost * 9 : 4) * sec;
  for (let i = 0; i < FLAKES; i++) {
    fpos[i * 3 + 1] -= 1.2 * sec; fpos[i * 3 + 2] += vel * 0.9; fpos[i * 3] += Math.sin(t + i) * 0.004;
    if (fpos[i * 3 + 2] > -2.5 || fpos[i * 3 + 1] < -6) { fpos[i * 3] = (Math.random() - 0.5) * 18; fpos[i * 3 + 1] = (Math.random() - 0.2) * 10; fpos[i * 3 + 2] = -10 - Math.random() * 22; }
  }
  flakeGeo.attributes.position.needsUpdate = true;
  lineMat.opacity = state === 'play' ? 0.35 + boost * 0.5 : 0;
  for (const m of lines) { m.position.z += vel * (2.2 + boost * 2); if (m.position.z > 1) { const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 1.8; m.position.set(Math.cos(a) * r * 0.7, Math.sin(a) * r, -10 - Math.random() * 6); } }
});

// ================================================================ v2: chain, SURGE, smash, checkpoint, stars, map, suits, daily
let starsBy = DEEP ? DS.get('stars', {}) : {};
const suit = () => Math.min(DS.get('suit', 0), SUITS.length - 1);
const totalStars = () => Object.values(starsBy).reduce((a, b) => a + b, 0) + DS.get('dstars', 0);
const nextSuit = () => SUITS.find(su => su.stars > totalStars());
const starRow = (n, max = 3) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? '' : 'off'}">★</i>`).join('');
const deepSub = () => (daily ? 'DAILY CHUTE' : LV.hard ? 'HARD · ' + LV.n : level <= 30 ? LV.n : LV.n);
let chainEl = null, mapEl = null, mapBtn = null, flagEl = null;
if (DEEP) {
  const st = document.createElement('style');
  st.textContent = `.cc-chain{position:fixed;top:calc(100px + env(safe-area-inset-top));right:14px;z-index:6;display:flex;gap:4px;pointer-events:none}
.cc-chain i{width:18px;height:18px;border-radius:50%;background:rgba(10,60,110,.28);transition:transform .12s,background .1s}
.cc-chain i.on{background:#ffe66d;transform:scale(1.25);box-shadow:0 0 8px #ffd23f}
.cc-chain.hot i.on{background:#ff7bd5;box-shadow:0 0 10px #ff7bd5}
.cc-hardf{position:fixed;inset:0;pointer-events:none;z-index:3;box-shadow:inset 0 0 0 5px rgba(232,69,60,.8),inset 0 0 36px rgba(232,69,60,.4)}
.cc-mapbtn{position:fixed;top:calc(12px + env(safe-area-inset-top));right:10px;width:46px;height:46px;border-radius:50%;border:0;z-index:7;font-size:22px;background:rgba(10,60,110,.3);color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.2);cursor:pointer}
.cc-map{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;padding:calc(16px + env(safe-area-inset-top)) 12px calc(16px + env(safe-area-inset-bottom));overflow-y:auto;background:linear-gradient(180deg,var(--m1),var(--m2));color:#fff}
.cc-map h2{margin:4px 0 0;font-size:30px;line-height:1;text-shadow:0 4px 0 rgba(0,40,90,.3)}
.cc-map .tot{font-size:17px;font-weight:800;margin:4px 0 8px;text-shadow:0 2px 0 rgba(0,40,90,.3)}
.cc-tabs{display:flex;gap:8px;margin:2px 0 10px}.cc-tabs button{font:inherit;font-weight:800;font-size:15px;border:0;border-radius:18px;padding:6px 14px;background:rgba(10,60,110,.28);color:#fff;cursor:pointer}
.cc-tabs button.on{background:#fff;color:#2a4a6a}.cc-tabs button.lock{opacity:.45}
.cc-grid{display:grid;grid-template-columns:repeat(5,56px);gap:10px 12px;justify-content:center;margin:4px 0 18px}
.cc-node{position:relative;width:56px;height:56px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:22px;color:#fff;background:var(--ui,#1e88e5);box-shadow:0 5px 0 rgba(0,40,90,.3);cursor:pointer}
.cc-node.hard{background:#e8453c;box-shadow:0 5px 0 #8f241e,0 0 0 3px #ffd23f}
.cc-node.lock{background:rgba(10,60,110,.3);box-shadow:none;color:rgba(255,255,255,.5);cursor:default}
.cc-node.next{animation:ccn 1s ease-in-out infinite}@keyframes ccn{50%{transform:scale(1.14)}}
.cc-node b{position:absolute;left:-6px;right:-6px;bottom:-16px;font-size:12px;letter-spacing:1px;color:#ffd23f;text-shadow:0 2px 0 rgba(0,40,90,.4)}
.cc-node b i,.cc-wstars i,.cc-st i{font-style:normal}.cc-node b i.off,.cc-st i.off{color:rgba(255,255,255,.35)}
.cc-suits{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:340px;margin:6px 0}
.cc-suit{width:50px;border:0;background:none;font:inherit;color:#fff;font-weight:800;font-size:11px;cursor:pointer;padding:0}
.cc-suit span{display:block;width:40px;height:40px;margin:0 auto 2px;border-radius:50%;border:3px solid transparent;box-shadow:0 4px 0 rgba(0,40,90,.3)}
.cc-suit.on span{border-color:#fff}.cc-suit.lock{opacity:.45;cursor:default}
.cc-go{margin-top:10px}
.cc-daily{margin:2px 0 12px;padding:10px 18px;border-radius:18px;border:0;font:inherit;font-weight:800;font-size:17px;color:#fff;background:linear-gradient(90deg,#ff7bd5,#ffb02e);box-shadow:0 4px 0 rgba(0,40,90,.3);cursor:pointer}
.cc-daily.done{background:rgba(10,60,110,.3);box-shadow:none}
.cc-wstars{font-size:44px;letter-spacing:6px;line-height:1;margin:2px 0}.cc-wstars i{color:rgba(255,255,255,.3);display:inline-block;transform:scale(.4);transition:transform .25s cubic-bezier(.3,1.8,.5,1),color .1s}
.cc-wstars i.on{color:#ffd23f;transform:scale(1)}.cc-wstars i.dim{transform:scale(.8)}
.cc-row{display:flex;gap:10px;justify-content:center;margin-top:6px}.cc-small{font-size:18px;padding:10px 18px;background:rgba(10,60,110,.4)}
.cc-unl{font-size:16px!important;opacity:.95;margin:2px 0}
.cc-flag{position:fixed;left:0;right:0;top:34%;text-align:center;z-index:5;pointer-events:none;font-weight:800;font-size:22px;opacity:0;color:#fff;-webkit-text-stroke:5px #0d5a9c;paint-order:stroke fill}`;
  document.head.appendChild(st);
  chainEl = Object.assign(document.createElement('div'), { className: 'cc-chain', innerHTML: '<i></i><i></i><i></i><i></i><i></i>' }); document.body.appendChild(chainEl);
  mapBtn = Object.assign(document.createElement('button'), { className: 'cc-mapbtn', textContent: '🗺️', type: 'button', ariaLabel: 'Map' });
  mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
  mapBtn.addEventListener('click', () => { if (state === 'play' || state === 'ready' || state === 'lost' || state === 'won') openMap(); });
  document.body.appendChild(mapBtn);
}
function chainUI() { if (!chainEl) return; [...chainEl.children].forEach((e, i) => e.classList.toggle('on', i < chain)); chainEl.classList.toggle('hot', chain >= 4); }
function stunt() {
  if (!DEEP || state !== 'play' || dead || surgeT > 0) return;
  chain++; chainT = 7; chainUI();
  if (chain < 5) { ui.pop(`CHAIN ${chain}/5`, '#ffe66d', 26, 34); tone(500 + chain * 90, 0.09, 'triangle', 0.08, 1.4); }
  if (chain >= 5) { chain = 0; chainUI(); surge(); }
}
function surge() {
  boost = 1; fovKick = 1.2; surgeT = 2.2;
  ui.pop('SURGE!', '#ff7bd5', 54, 22); ui.flash(0.35); shake = Math.max(shake, 0.3);
  tone(260, 0.5, 'sawtooth', 0.1, 3); tone(520, 0.4, 'triangle', 0.08, 2.4); buzz([20, 30, 40]);
  burst(scene, sled.position.clone().add(new THREE.Vector3(0, 1, 0)), ['#ff7bd5', '#ffe66d', '#ffffff'], 24, { speed: 0.14, up: 0.1, size: 0.7 });
}
function smash(o) {
  o.hit = true; o.passed = true; o.smashed = 1; smashes++;
  const p = o.mesh.position.clone(); p.y += 0.7;
  const col = { snowman: '#ffffff', crates: '#d89a5b', rock: '#8d97ab', icewall: '#9ee8ff', fence: '#ff3b3b', bar: '#3a86ff', log: '#9a6a3f', roller: '#bfe9ff', ball: '#ffffff' }[o.type] || '#ffffff';
  burst(scene, p, [col, '#ffffff', '#e6f6ff'], 16, { speed: 0.2, up: 0.14, size: 0.9, shape: 'box' });
  sfx.smash(); buzz(18); shake = Math.max(shake, 0.75); fovKick = Math.max(fovKick, 0.8); ui.flash(0.12);
  burst(scene, p, ['#ffffff', '#ffe66d'], 10, { speed: 0.3, up: 0.2, size: 0.5 });
  coinsGot += 3; setCoins(coinsGot);
  ui.pop(smashes % 5 === 0 ? `SMASH x${smashes}!` : ['SMASH!', 'BOOM!', 'CRUNCH!'][smashes % 3], '#ffb02e', 44, 24);
  tone(120 + (smashes % 6) * 40, 0.12, 'square', 0.1, 0.5);
}
function saveCp() {
  cpD = dist; cpSnap = { coins: coins.map(c => c.got), gems: gems.map(g => g.got), coinsGot, coinHit, gemsGot };
  ui.pop('CHECKPOINT', '#ffffff', 38, 28); sfx.pick(5); buzz(15);
}
function retry() {                                                  // instant: from the flag if you passed it, else from the start
  if (cpSnap) restartCp(); else { buildLevel(); state = 'play'; }
}
function restartCp() {
  dead = false; crashT = 0; winT = 0; state = 'play'; combo = 0; chain = 0; chainUI(); surgeT = 0;
  dist = cpD; speed = baseSpeed(); boost = 0; coinsGot = cpSnap.coinsGot; coinHit = cpSnap.coinHit; gemsGot = cpSnap.gemsGot; setCoins(coinsGot);
  Object.assign(P, { lane: 0, x: 0, y: 0, vy: 0, duck: 0, flip: 0, air: false, lean: 0, laneT: 9, ramp: null });
  obs.forEach(o => { o.passed = o.d0 < cpD + 1; o.hit = false; o.used = false; o.smashed = 0; o.wob = 0; o.mesh.scale.set(1, 1, 1); if (o.dyn === 2) o.d = o.d0; });
  coins.forEach((c, i) => { c.got = cpSnap.coins[i]; c.fly = 0; }); gems.forEach((g, i) => { g.got = cpSnap.gems[i]; });
  sled.visible = true; rider.position.set(0, 0, 0); rider.rotation.set(0, 0, 0); sled.rotation.set(0, 0, 0); placeRider(0);
  camPos.copy(sled.position).add(new THREE.Vector3(0, 4.4, 8)); camLook.copy(sled.position);
  ui.pop('FROM THE FLAG', '#ffffff', 34, 24);
}
function playLevel(lv, isDaily = false) {
  level = lv; daily = isDaily; ui.hideStart(); if (mapEl) mapEl.classList.add('hc-hidden');
  WB.start(); buildLevel(); state = 'play';
  if (lv === 3 && !isDaily && !DS.get('tipChain', 0)) { DS.set('tipChain', 1); setTimeout(() => { if (state === 'play' && dist < 120) ui.pop('CHAIN 5 STUNTS = SURGE', '#ffe66d', 28, 24); }, 2600); }
  if (LV.hard) setTimeout(() => { if (state === 'play' && dist < 40) ui.pop('HARD CHUTE!', '#ff6a5c', 38, 24); }, 400);
}
function starsOf() { return 1 + (coinHit >= Math.ceil(0.75 * coinTotal) ? 1 : 0) + (gemTotal ? (gemsGot >= gemTotal ? 1 : 0) : (coinHit >= Math.ceil(0.95 * coinTotal) ? 1 : 0)); }
function touchStreak() {
  const today = dayKey(), last = DS.get('last', -9), n = DS.get('streak', 0);
  if (last === today) return n;
  const m = last === today - 1 ? n + 1 : 1; DS.set('last', today); DS.set('streak', m); return m;
}
const tomorrowLine = () => { const n = DS.get('streak', 0); return `Tomorrow: a new Daily Chute · ${n > 1 ? n + '-day streak' : 'day 1 of a streak'}`; };
function deepWin() {
  deaths = 0;
  const lv = level, n = starsOf(), before = totalStars(), key = daily ? 'daily' : lv, isNewDaily = daily && DS.get('dayDone', -1) !== dayKey();
  if (!daily) { if (n > (starsBy[lv] || 0)) { starsBy[lv] = n; DS.set('stars', starsBy); } if (lv + 1 > unlocked) { unlocked = lv + 1; DS.set('unlocked', unlocked); } }
  else if (isNewDaily) { DS.set('dayDone', dayKey()); DS.set('dstars', DS.get('dstars', 0) + 2); }
  const streak = touchStreak();
  const got = SUITS.filter(su => su.stars > before && su.stars <= totalStars()), ns = nextSuit();
  const card = ui.els.win;
  card.querySelector('p').firstChild.textContent = daily ? 'DAILY ' : lv <= 30 ? 'CHUTE ' : 'ENDLESS ';
  card.querySelector('[data-l]').textContent = daily ? '' : lv <= 30 ? lv : lv - 30;
  card.querySelector('[data-x]').textContent = `${coinsGot} coins${gemTotal ? ' · ' + gemsGot + '/' + gemTotal + ' gems' : ''}${smashes ? ' · ' + smashes + ' smashed' : ''}`;
  let sx = card.querySelector('.cc-wstars'); if (!sx) { sx = document.createElement('div'); sx.className = 'cc-wstars'; card.querySelector('h1').after(sx); }
  sx.innerHTML = '<i>★</i><i>★</i><i>★</i>';
  [0, 1, 2].forEach(i => setTimeout(() => { const el = sx.children[i]; if (!el) return; if (i < n) { el.classList.add('on'); tone(660 + i * 220, 0.14, 'triangle', 0.12, 1.2); buzz(12); } else el.classList.add('dim'); }, 900 + i * 260));
  let un = card.querySelector('.cc-unl'); if (!un) { un = document.createElement('p'); un.className = 'cc-unl'; card.querySelector('[data-x]').after(un); }
  un.innerHTML = (got.length ? `New suit: ${got[got.length - 1].name}!` : ns ? `★ ${ns.stars - totalStars()} more → ${ns.name} suit` : '') + (isNewDaily ? '<br>+2 ★ for the daily' : '') + `<br>${tomorrowLine()}`;
  if (got.length) DS.set('suit', SUITS.indexOf(got[got.length - 1]));
  const hint = card.querySelector('.hint');
  hint.innerHTML = `<span class="hc-btn cc-next">${daily ? 'MAP' : 'CHUTE ' + Math.min(lv + 1, 999)} ▶</span><div class="cc-row"><button class="hc-btn cc-small" data-r>↺</button><button class="hc-btn cc-small" data-m>🗺️</button></div>`;
  hint.style.animation = 'none';
  const btn = (sel, fn) => { const b = hint.querySelector(sel); b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); card.classList.add('hc-hidden'); fn(); }); };
  btn('[data-r]', () => playLevel(lv, daily)); btn('[data-m]', () => openMap(worldOf(Math.min(lv + 1, 30))));
  setTimeout(() => card.classList.remove('hc-hidden'), 650);
  return n;
}
function deepLose(pct) {
  const lvk = daily ? -2 : level; deaths = lvk === deathLv ? deaths + 1 : 1; deathLv = lvk;
  const left = Math.max(1, Math.round(goal - dist));
  const line = cpSnap ? `${left} m to go · tap: from the flag` : `${pct}% of the run · ${left} m to go`;
  ui.lose(left < 60 ? 'SO CLOSE!' : 'WIPEOUT!', line);
  const x = ui.els.lose.querySelector('[data-x]'); const ns = nextSuit(); x.innerHTML = line + (ns ? `<br><small>⭐ ${ns.stars - totalStars()} more → ${ns.name} suit</small>` : '') + `<br><small>${tomorrowLine()}</small>`;
}
let mapWorld = 1;
function openMap(w = worldOf(Math.min(unlocked, 30))) {
  mapWorld = w; if (state === 'play' || state === 'ready' || state === 'won' || state === 'lost') state = 'map';
  for (const c of [ui.els.start, ui.els.win, ui.els.lose]) c.classList.add('hc-hidden');
  if (!mapEl) { mapEl = document.createElement('div'); mapEl.className = 'cc-map'; mapEl.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(mapEl); }
  const th = WTHEMES[w - 1][0];
  mapEl.style.setProperty('--m1', th.sky[0]); mapEl.style.setProperty('--m2', th.sky[1]); mapEl.style.setProperty('--ui', th.ui);
  const first = (w - 1) * 10 + 1, ns = nextSuit(), dDone = DS.get('dayDone', -1) === dayKey(), streak = DS.get('streak', 0);
  let h = `<h2>${WORLDS[w - 1].name}</h2><div class="tot">★ ${totalStars()} / 90${streak > 1 ? ' · 🔥 ' + streak + ' days' : ''}</div><div class="cc-tabs">`;
  WORLDS.forEach((x, i) => { const open = unlocked >= i * 10 + 1; h += `<button data-w="${i + 1}" class="${i + 1 === w ? 'on' : ''} ${open ? '' : 'lock'}">${open ? '' : '🔒 '}${i + 1}</button>`; });
  h += `</div><div class="cc-grid">`;
  for (let lv = first; lv < first + 10; lv++) {
    const open = lv <= unlocked, n = starsBy[lv] || 0, hard = LEVELS[lv - 1].hard;
    h += `<button class="cc-node ${hard ? 'hard' : ''} ${open ? '' : 'lock'} ${lv === unlocked ? 'next' : ''}" data-l="${open ? lv : ''}">${open ? lv : '🔒'}${open && n ? `<b>${starRow(n)}</b>` : ''}</button>`;
  }
  h += `</div>`;
  if (unlocked > 30 && w === 3) h += `<button class="hc-btn cc-go" data-l="${unlocked}">Endless chutes ▶ ${unlocked - 30}</button>`;
  h += `<button class="cc-daily ${dDone ? 'done' : ''}" data-d="1">${dDone ? '✓ Daily done · back tomorrow' : '🎁 Daily Chute · +2 ★'}</button>`;
  h += `<div class="tot">Suits${ns ? ` · ★ ${ns.stars - totalStars()} more for the next` : ''}</div><div class="cc-suits">`;
  SUITS.forEach((su, i) => { const open = totalStars() >= su.stars; h += `<button class="cc-suit ${open ? '' : 'lock'} ${suit() === i ? 'on' : ''}" data-s="${open ? i : ''}"><span style="background:linear-gradient(135deg,${su.tube} 0 50%,${su.coat} 50%)"></span>${open ? su.name : '★ ' + su.stars}</button>`; });
  h += `</div><button class="hc-btn cc-go" data-l="${Math.min(unlocked, w * 10 < unlocked ? w * 10 : unlocked)}">PLAY ▶</button>`;
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden');
  mapEl.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const x = +b.dataset.w; if (unlocked >= (x - 1) * 10 + 1) { sfx.tap(); openMap(x); } });
  mapEl.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const lv = +b.dataset.l; if (lv) { sfx.tap(); playLevel(lv); } });
  mapEl.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { sfx.tap(); playLevel(unlocked, true); });
  mapEl.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { if (b.dataset.s === '') return; DS.set('suit', +b.dataset.s); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(mapWorld); });
}

buildLevel();
ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.floor(dist); },
  get info() { return { dist, goal, coinHit, coinTotal, gemsGot, gemTotal, smashes, chain, cp: !!cpSnap, stars: DEEP ? starsOf() : 0, unlocked }; },
  go(lv, isDaily) { if (DEEP) playLevel(lv, !!isDaily); }, unlock(n) { unlocked = n; DS.set('unlocked', n); },
  bot() {
    if (state !== 'play' || dead) return;
    const look = speed * 0.9 + 6, threats = l => obs.filter(o => !o.passed && !o.hit && o.d - dist > -0.4 && o.d - dist < look && o.lanes.includes(l) && o.kind !== 'boost' && o.kind !== 'ramp');
    const cur = threats(P.lane).sort((a, b) => a.d - b.d)[0];
    const near = l => threats(l).some(o => o.kind === 'block' || ((o.kind === 'low' || o.kind === 'gate') && o.d - dist < speed * 0.3) || (o.kind === 'bar' && o.d - dist < speed * 0.25));
    const hard = l => threats(l).some(o => o.kind === 'block');
    if (cur && !(DEEP && boost > 0.15)) {
      const d = cur.d - dist;
      if (cur.kind === 'gate' || cur.kind === 'low') { if (d < speed * 0.42 + 1) jump(); if (cur.kind === 'gate' || cur.dyn) return; }
      else if (cur.kind === 'bar') { if (d < speed * 0.4 + 1) duck(); return; }
      if (cur.kind === 'block' || (cur.kind === 'low' && !cur.dyn)) {
        const opts = [P.lane - 1, P.lane + 1].filter(l => l >= -1 && l <= 1 && !hard(l) && !near(l));
        const o2 = opts.sort((a, b) => threats(a).length - threats(b).length)[0];
        if (o2 !== undefined) return steer(o2 - P.lane);
        const far = [-1, 0, 1].find(l => !hard(l)); if (far !== undefined && far !== P.lane) return steer(Math.sign(far - P.lane));
      }
      return;
    }
    const goodies = obs.filter(o => (o.kind === 'ramp' || o.kind === 'boost') && !o.used && o.d - dist > 4 && o.d - dist < look);
    const want = goodies.length ? goodies[0].lane : (coins.find(c => !c.got && c.d - dist > 3 && c.d - dist < 25) || {}).lane;
    if (want !== undefined && want !== P.lane && !hard(P.lane + Math.sign(want - P.lane)) && !near(P.lane + Math.sign(want - P.lane))) steer(Math.sign(want - P.lane));
  },
};

// Bolt Out v2 — same game as v1 (balls rest on bolts in a glass tube; pull the bolts in the right order so every coloured ball
// reaches the jar; grey turns colour on touching colour; bombs and goo must stay out), with 36 hand-made vessels in 3 worlds,
// goo, twin bolts, padlocks and merging lanes, three stars per vessel, a level map, a shelf of jars, hints, a daily vessel and
// bonus vessels. Rules + solver: logic.js; vessels: levels.js; plan: DESIGN.md.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, glossy, mat, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { LEVELS, WORLDS, PER } from './levels.js';
import { BONUS } from './bonus.js';
import { compile, start as lstart, move as lmove, plan, analyze } from './logic.js';

const S = store('boltout2');
const F = flow('boltout');
const LB = board({ game: 'bolt-out', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum' });   // levels cleared today, same scale as v1
const stage = createStage({ fov: 40, shadowSize: 11 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'BOLT<br>OUT', score: false, hand: '' });
ui.hideStart();
const COUNT = LEVELS.length;

// ---------------------------------------------------------------- constants
const R = 0.13, RB = 0.27, GRAV = -30, SUB = 6, Y_FLOOR = 0.7, NECK = 0.62, RIM = -3.0, CUP_B = -5.6, CUP_W = 1.3, HROW = 1.3;
const COLS = ['#ff4d6d', '#ffb703', '#3a86ff', '#2ec4b6', '#9b5de5', '#fb5607', '#06d6a0'];
const GREY = '#b8bcc6', GOO = '#79d64a', GOLD = '#ffd23f';
const PAIR = ['#ff9f1c', '#2ec4b6', '#b15cff', '#ff4d6d'];

// ---------------------------------------------------------------- save
let stars = S.get('stars', {}), coins = S.get('coins', 3), hints = S.get('hints', 2), jarId = S.get('jar', 'glass');
let dayInfo = S.get('day', { d: 0, streak: 0, best: 0 });
let bestT = S.get('bestT', {});
const saveAll = () => { S.set('stars', stars); S.set('coins', coins); S.set('hints', hints); S.set('jar', jarId); S.set('day', dayInfo); S.set('bestT', bestT); };
const totalStars = () => Object.values(stars).reduce((a, b) => a + b, 0);
const cleared = n => (stars[n] || 0) > 0;
const nextLevel = () => { for (let n = 1; n <= COUNT; n++) if (!cleared(n)) return n; return COUNT + 1; };
const unlocked = n => n === 1 || cleared(n - 1) || cleared(n) || n > COUNT;
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayIdx = () => Math.floor(Date.now() / 864e5);

const JARS = [
  { id: 'glass', name: 'Clear Glass', rim: '#ff5d8f', tint: '#ffffff', need: 0 },
  { id: 'berry', name: 'Strawberry', rim: '#ff4d6d', tint: '#ffd0da', need: 6 },
  { id: 'mint', name: 'Mint', rim: '#2fbf99', tint: '#c9fff0', need: 14 },
  { id: 'honey', name: 'Honey', rim: '#f2a900', tint: '#fff0b8', need: 24 },
  { id: 'grape', name: 'Grape', rim: '#8a4dff', tint: '#e3d2ff', need: 36 },
  { id: 'ink', name: 'Midnight', rim: '#2c3160', tint: '#b9c3ff', need: 50 },
  { id: 'rain', name: 'Rainbow', rim: '#ff5d8f', tint: '#ffffff', rainbow: true, need: 68 },
  { id: 'gold', name: 'Gold Rush', rim: '#e8a400', tint: '#fff3c4', metal: true, need: 90 },
];
const jarDef = () => JARS.find(j => j.id === jarId) || JARS[0];

// ---------------------------------------------------------------- icons (drawn, no font needed)
const IC = {
  star: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 18.2 5.6 21.6 7 14.5 1.7 9.5l7.2-.9z" fill="${c}"/></svg>`,
  coin: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${c}"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/></svg>`,
  bulb: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6M10 18h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>`,
  redo: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/></svg>`,
  map: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}"><rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/><rect x="13" y="13" width="8" height="8" rx="2.4"/></svg>`,
  lock: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3" fill="${c}"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="${c}" stroke-width="2.4"/></svg>`,
  cal: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3.5" fill="${c}"/><rect x="3" y="5" width="18" height="5" rx="2.5" fill="rgba(0,0,0,.25)"/><rect x="7" y="2" width="2.6" height="5" rx="1.3" fill="${c}"/><rect x="14.4" y="2" width="2.6" height="5" rx="1.3" fill="${c}"/></svg>`,
  jar: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="3.6" rx="1.6" fill="${c}"/><path d="M6.5 7h11l1 11a3 3 0 0 1-3 3.4H8.5a3 3 0 0 1-3-3.4z" fill="${c}" opacity=".6"/></svg>`,
  flame: (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-7 1-10z" fill="${c}"/></svg>`,
};
const starsRow = (n, size = 18, on = '#ffd23f', off = 'rgba(255,255,255,.4)') => [0, 1, 2].map(i => IC.star(i < n ? on : off, size)).join('');

// ---------------------------------------------------------------- static scene: backdrop catching shadows, jar
const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.13 }));
back.position.z = -0.45; back.receiveShadow = true; scene.add(back);
sun.position.set(4, 10, 12);
const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
spot.scale.set(3.4, 0.7, 1); spot.position.set(0, CUP_B - 0.2, -0.44); scene.add(spot);

const jar = new THREE.Group(); scene.add(jar);
const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
const glass = new THREE.Mesh(new THREE.CylinderGeometry(CUP_W + 0.06, CUP_W, RIM - CUP_B + 0.1, 40, 1, true), glassMat);
glass.position.y = (RIM + CUP_B) / 2;
const baseMat = glossy('#ffffff', { transparent: true, opacity: 0.7 });
const jarBase = new THREE.Mesh(new THREE.CylinderGeometry(CUP_W, CUP_W * 0.96, 0.18, 40), baseMat);
jarBase.position.y = CUP_B - 0.06; jarBase.receiveShadow = true;
const rimMat = glossy('#ff5d8f');
const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP_W + 0.06, 0.13, 14, 48), rimMat); rim.rotation.x = Math.PI / 2 - 0.25; rim.position.y = RIM + 0.05;
jar.add(glass, jarBase, rim);
function applyJar() {
  const j = jarDef();
  rimMat.color.set(j.rim); rimMat.metalness = j.metal ? 0.8 : 0.1; rimMat.roughness = j.metal ? 0.25 : 0.2;
  glassMat.color.set(j.tint); baseMat.color.set(j.tint);
}

// tubes: instanced cylinders + joint spheres (2 draw calls for the whole vessel)
const TUBE_R = 0.09, MAXT = 40;
const tubeMat = glossy('#ffffff', { roughness: 0.25 });
const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(TUBE_R, TUBE_R, 1, 14, 1, true), tubeMat, MAXT);
const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(TUBE_R, 14, 10), tubeMat, MAXT * 2);
tubes.castShadow = joints.castShadow = true; scene.add(tubes, joints);

const MAXBALL = 170;
const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(R, 18, 12), glossy('#ffffff', { roughness: 0.28 }), MAXBALL);
ballMesh.castShadow = true; ballMesh.frustumCulled = false; scene.add(ballMesh);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const waveGeo = new THREE.RingGeometry(0.82, 1, 40), waves = [];
function shockwave(x, y, color = '#ffd27a', size = 3) {
  const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  m.position.set(x, y, 0.6); m.renderOrder = 9; m.userData.size = size; scene.add(m); waves.push({ m, t: 0 });
}

// ---------------------------------------------------------------- HUD + DOM
const CSS = `
.bx-hud{position:fixed;inset:0;pointer-events:none;z-index:6}
.bx-top{position:absolute;top:calc(56px + env(safe-area-inset-top));left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:5px}
.bx-name{font-weight:800;font-size:15px;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.14);letter-spacing:.3px}
.bx-name small{font-weight:600;opacity:.8;margin-left:6px}
.bx-name .tag{display:inline-block;background:#ff4d4d;color:#fff;border-radius:10px;padding:0 8px;font-size:12px;margin-right:6px}
.bx-name .tag.boss{background:#ffb700;color:#5a3a00}
.bx-info{font-weight:800;font-size:14px;display:flex;gap:10px;align-items:center;background:rgba(0,0,0,.16);border-radius:14px;padding:2px 12px}
.bx-info b{font-size:16px}
.bx-btn{pointer-events:auto;position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.88);border:0;box-shadow:0 4px 0 rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.bx-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.18)}
.bx-btn .n{position:absolute;right:-4px;top:-4px;min-width:20px;height:20px;border-radius:10px;background:var(--ui,#ff5d8f);color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;padding:0 5px}
.bx-btn.wig{animation:bxwig 1s ease-in-out infinite}
@keyframes bxwig{0%,60%,100%{transform:rotate(0)}70%{transform:rotate(-12deg)}80%{transform:rotate(12deg)}90%{transform:rotate(-8deg)}}
.bx-btn.off{opacity:.5}
.bx-btn.pulse{animation:hcpulse .8s ease-in-out infinite;background:#ffe14d}
.bx-map{left:14px;top:calc(76px + env(safe-area-inset-top));width:44px;height:44px}
.bx-hint{left:18px;bottom:calc(22px + env(safe-area-inset-bottom))}
.bx-redo{right:18px;bottom:calc(22px + env(safe-area-inset-bottom))}
.bx-coins{position:absolute;right:14px;top:calc(14px + env(safe-area-inset-top));display:flex;align-items:center;gap:5px;font-weight:800;font-size:19px;background:rgba(0,0,0,.18);border-radius:18px;padding:2px 12px 2px 8px;text-shadow:0 2px 0 rgba(0,0,0,.14)}
.bx-coins.bump{animation:bxbump .3s}
@keyframes bxbump{50%{transform:scale(1.25)}}
.bx-stars{position:absolute;left:0;right:0;bottom:calc(30px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:4px;align-items:center}
.bx-stars .lbl{font-weight:800;font-size:13px;opacity:.9;margin:0 8px;text-shadow:0 2px 0 rgba(0,0,0,.14)}
.bx-banner{position:absolute;left:50%;top:calc(116px + env(safe-area-inset-top));transform:translateX(-50%);text-align:center;font-weight:800;pointer-events:none;animation:bxban 3.4s ease-out forwards;width:min(88vw,420px)}
.bx-banner h2{margin:0;font-size:26px;text-shadow:0 4px 0 rgba(0,0,0,.16)}
.bx-banner p{margin:2px 0 0;font-size:16px;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.14)}
.bx-banner .tag{display:inline-block;background:var(--ui,#ff5d8f);border-radius:14px;padding:1px 12px;font-size:14px;margin-bottom:4px}
@keyframes bxban{0%{opacity:0;transform:translate(-50%,16px) scale(.8)}12%{opacity:1;transform:translate(-50%,0) scale(1.06)}20%{transform:translate(-50%,0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px)}}
.bx-ptr{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid #fff;box-shadow:0 0 0 4px var(--ui,#ff5d8f),0 0 24px rgba(255,255,255,.9);animation:bxptr .9s ease-in-out infinite;pointer-events:none}
@keyframes bxptr{50%{transform:scale(1.3);opacity:.6}}
.bx-bad{position:absolute;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:6px solid #ff3b3b;box-shadow:0 0 30px #ff3b3b;animation:bxbad .5s ease-out 3;pointer-events:none}
@keyframes bxbad{from{transform:scale(2.2);opacity:0}to{transform:scale(1);opacity:1}}
.bx-cardwrap{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(20,10,40,.34);animation:bxfade .25s}
@keyframes bxfade{from{opacity:0}}
.bx-card{width:min(92vw,400px);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#fff,#f3ecff);color:#3a2a5c;border-radius:28px;padding:18px 18px 20px;box-shadow:0 10px 0 rgba(0,0,0,.16),0 20px 50px rgba(0,0,0,.28);text-align:center;animation:bxpop .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes bxpop{from{transform:scale(.7) translateY(30px);opacity:0}}
.bx-card h1{margin:0;font-size:36px;line-height:1;font-weight:800;color:var(--ui,#6a3d9a)}
.bx-card h3{margin:2px 0 8px;font-size:16px;font-weight:700;opacity:.75}
.bx-card .big{display:flex;justify-content:center;gap:6px;margin:8px 0 6px;height:64px}
.bx-card .big svg{transform:scale(1);animation:bxstar .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes bxstar{from{transform:scale(0) rotate(-40deg)}to{transform:scale(1) rotate(0)}}
.bx-card .big svg.dim{opacity:.35}
.bx-card .row{display:flex;justify-content:center;gap:14px;align-items:center;font-weight:800;margin:4px 0;font-size:17px}
.bx-card .row span{display:inline-flex;align-items:center;gap:5px}
.bx-card .msg{font-weight:700;font-size:15px;opacity:.85;margin:6px 0}
.bx-card .bar{height:10px;border-radius:6px;background:#e4d9fb;overflow:hidden;margin:4px 14px}
.bx-card .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--ui,#ff5d8f),#ffb02e);border-radius:6px}
.bx-go{pointer-events:auto;font:inherit;font-weight:800;font-size:24px;color:#fff;background:#3cc46a;border:0;border-radius:40px;padding:12px 44px;box-shadow:0 6px 0 #2a9a50;cursor:pointer;margin-top:10px;animation:hcpulse 1.4s ease-in-out infinite}
.bx-go:active{transform:translateY(4px);box-shadow:0 2px 0 #2a9a50}
.bx-sm{font:inherit;font-weight:800;font-size:15px;color:#6a3d9a;background:#e9defc;border:0;border-radius:24px;padding:8px 16px;box-shadow:0 3px 0 rgba(0,0,0,.12);cursor:pointer;margin:8px 4px 0;display:inline-flex;align-items:center;gap:6px}
.bx-sm:active{transform:translateY(2px)}
.bx-map-wrap{align-items:stretch}
.bx-mapcard{width:min(96vw,440px);max-height:96vh;overflow:auto;display:flex;flex-direction:column;background:linear-gradient(180deg,var(--m1,#ffd1ec),var(--m2,#c9b8ff));color:#fff;border-radius:28px;padding:14px 14px 16px;box-shadow:0 10px 0 rgba(0,0,0,.16),0 20px 50px rgba(0,0,0,.3);margin:auto;animation:bxpop .3s}
.bx-mhead{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:17px;gap:8px}
.bx-mhead .x{pointer-events:auto;border:0;background:rgba(255,255,255,.85);width:36px;height:36px;border-radius:50%;font:inherit;font-weight:800;font-size:20px;color:#6a3d9a;cursor:pointer}
.bx-tabs{display:flex;gap:6px;margin:10px 0 6px}
.bx-tab{flex:1;border:0;font:inherit;font-weight:800;font-size:13px;color:#fff;background:rgba(0,0,0,.18);border-radius:14px;padding:6px 2px;cursor:pointer;line-height:1.1}
.bx-tab.on{background:#fff;color:var(--ui,#6a3d9a)}
.bx-tab small{display:block;font-weight:600;font-size:11px;opacity:.8}
.bx-tab.lk{opacity:.6}
.bx-wsub{text-align:center;font-weight:700;font-size:14px;margin:2px 0 8px;text-shadow:0 2px 0 rgba(0,0,0,.12)}
.bx-grid{display:flex;flex-direction:column;gap:12px;padding:4px 6px}
.bx-rowl{display:flex;justify-content:space-between;gap:8px}
.bx-rowl.rev{flex-direction:row-reverse}
.bx-lv{pointer-events:auto;position:relative;width:21%;aspect-ratio:1;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:21px;color:var(--ui,#6a3d9a);background:#fff;box-shadow:0 5px 0 rgba(0,0,0,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:0}
.bx-lv .st{position:absolute;bottom:-14px;display:flex;gap:0}
.bx-lv.lk{background:rgba(255,255,255,.35);color:rgba(255,255,255,.8);box-shadow:none;cursor:default}
.bx-lv.hard{box-shadow:0 5px 0 rgba(0,0,0,.18),0 0 0 4px #ff4d4d}
.bx-lv.boss{box-shadow:0 5px 0 rgba(0,0,0,.18),0 0 0 4px #ffb700}
.bx-lv.next{animation:hcpulse 1s ease-in-out infinite;background:#ffe14d}
.bx-lv .tg{position:absolute;top:-9px;font-size:10px;background:#ff4d4d;color:#fff;border-radius:8px;padding:0 6px;letter-spacing:.5px}
.bx-lv.boss .tg{background:#ffb700;color:#5a3a00}
.bx-mfoot{display:flex;gap:8px;margin-top:20px;justify-content:center;flex-wrap:wrap}
.bx-mfoot .bx-sm{flex:1;justify-content:center;background:#fff;margin:0}
.bx-jars{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}
.bx-jr{pointer-events:auto;border:0;background:rgba(255,255,255,.55);border-radius:16px;padding:8px 2px 6px;font:inherit;font-weight:700;font-size:11px;color:#3a2a5c;cursor:pointer}
.bx-jr.on{background:#fff;box-shadow:0 0 0 3px var(--ui,#ff5d8f)}
.bx-jr.lk{opacity:.7}
.bx-jr .sw{width:34px;height:42px;margin:0 auto 4px;border-radius:8px 8px 12px 12px;border:5px solid;border-top-width:7px;background:rgba(255,255,255,.7)}
`;
const stEl = document.createElement('style'); stEl.textContent = CSS; document.head.appendChild(stEl);
const dom = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const hud = dom(`<div class="bx-hud">
  <div class="bx-top"><div class="bx-name"></div><div class="bx-info"></div></div>
  <button class="bx-btn bx-map" aria-label="Levels">${IC.map('#6a3d9a', 24)}</button>
  <div class="bx-coins"></div>
  <button class="bx-btn bx-hint" aria-label="Hint">${IC.bulb('#f0a500', 28)}<span class="n"></span></button>
  <div class="bx-stars"></div>
  <button class="bx-btn bx-redo" aria-label="Restart">${IC.redo('#6a3d9a', 24)}</button>
</div>`);
document.body.appendChild(hud);
const $ = s => hud.querySelector(s);
const elName = $('.bx-name'), elInfo = $('.bx-info'), elCoins = $('.bx-coins'), elHint = $('.bx-hint'), elStars = $('.bx-stars'), elRedo = $('.bx-redo');
const ptr = dom('<div class="bx-ptr" hidden></div>'); hud.appendChild(ptr);
const pct = document.createElement('div'); pct.className = 'bo-pct'; pct.textContent = '0%'; document.body.appendChild(pct);
const stop = e => e.stopPropagation();
for (const b of hud.querySelectorAll('.bx-btn')) b.addEventListener('pointerdown', stop);
$('.bx-map').addEventListener('click', () => { if (state === 'play' || state === 'lost') showMap(); });
elRedo.addEventListener('click', () => { if (state === 'play' || state === 'lost') restart(); });
elHint.addEventListener('click', useHint);
function toScreen(x, y) { const v = new THREE.Vector3(x, y, 0).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }
function closeCards() { document.querySelectorAll('.bx-cardwrap').forEach(e => e.remove()); }

// ---------------------------------------------------------------- level data
const cache = new Map();
function analysis(def, key) {
  if (key !== undefined && cache.has(key)) return cache.get(key);
  const M = compile(def), A = analyze(M), r = { M, par: A.par, A };
  if (key !== undefined) cache.set(key, r); return r;
}
function levelData(n, opts = {}) {
  if (opts.def) { const a = analysis(opts.def); return { n, def: opts.def, mode: 'remix', name: 'Bonus vessel', world: (n - 1) % 3, ...a, hard: 0 }; }
  if (opts.daily) {
    const def = BONUS[(dayIdx() * 7 + 3) % BONUS.length], a = analysis(def);
    return { n: 0, def, mode: 'daily', name: 'Daily vessel', world: dayIdx() % 3, ...a, hard: 0 };
  }
  if (n <= COUNT) {
    const def = LEVELS[n - 1], a = analysis(def, n);
    return { n, def, mode: 'level', name: def.why, world: Math.floor((n - 1) / PER), ...a, hard: def.hard || 0 };
  }
  const def = BONUS[(n - COUNT - 1) % BONUS.length], a = analysis(def);
  return { n, def, mode: 'remix', name: 'Bonus vessel ' + (n - COUNT), world: (n - 1) % 3, ...a, hard: 0 };
}
const hashDef = d => { let h = 2166136261; for (const ch of JSON.stringify(d)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h % 2147483000 + 1; };
const INTRO = {
  1: ['Pull the bolt', 'Tap its handle'],
  2: ['Two bolts', 'Any order works'],
  3: ['Grey needs colour', 'Grey turns colour when it touches colour'],
  4: ['Bombs', 'Keep bombs away from colour. Leave this one'],
  6: ['Bomb meets grey', 'A bomb that lands on grey just pops'],
  8: ['Two lanes', 'They pour into the wide bolt'],
  11: ['Careful', 'Bombs top and bottom: one way through'],
  13: ['NEW: goo', 'Goo spoils the jar. Leave it, or let a bomb pop it'],
  17: ['NEW: twin bolts', 'Same colour ring: one tap pulls both'],
  25: ['NEW: padlocks', 'A locked bolt waits for the key bolt of its colour'],
  36: ['BOSS', 'Everything at once'],
};

// ---------------------------------------------------------------- level build
let cur = null, as = null, state = 'ready', balls = [], segs = [], pins = [], bombs = [], recorded = false, inCup = 0, goodTotal = 0, wd = WORLDS[0];
let shake = 0, settleT = 0, winT = 0, convQ = [], tickT = 0, convT = 0, jarBounce = 0, lastPct = -1, camZ = 21, camY = 0.2, vTop = 6;
let pour = 0, pourT = 0, pourBest = 0, taps = 0, coinsGot = 0, tries = 0, hitstop = 0, slow = 0, streak = 0, streakT = 0, idleT = 0, guide = null, startedAt = 0, locks = [], badMark = null, goldN = 0, convStreak = 0, convStreakT = 0;
let fallId = 0, divY = -99, planNow = null, deadAt = 0, deadShown = false;
const fx = []; const later = (s, fn) => fx.push({ t: s, fn });
const pinMat = () => glossy(wd.a, { metalness: 0.35, roughness: 0.3 });

function addSeg(ax, ay, bx, by, r = TUBE_R) { const s = { ax, ay, bx, by, r, on: true }; segs.push(s); return s; }
function hexNut() {
  const s = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; i ? s.lineTo(Math.cos(a) * 0.26, Math.sin(a) * 0.26) : s.moveTo(Math.cos(a) * 0.26, Math.sin(a) * 0.26); }
  const h = new THREE.Path(); h.absarc(0, 0, 0.1, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); g.translate(0, 0, -0.06); return g;
}
const NUT = hexNut();
const ringGeo = new THREE.TorusGeometry(0.14, 0.04, 8, 20), shackleGeo = new THREE.TorusGeometry(0.1, 0.035, 8, 14, Math.PI), lockBodyGeo = new THREE.BoxGeometry(0.34, 0.28, 0.16), keyShaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8);
function clearLevel() {
  for (const p of pins) { scene.remove(p.g); }
  for (const b of bombs) scene.remove(b.g);
  for (const l of locks) if (l.g.parent) l.g.parent.remove(l.g);
  pins = []; bombs = []; balls = []; segs = []; convQ = []; locks = [];
  if (badMark) { badMark.remove(); badMark = null; }
}
function addBall(x, y, t, col) { const b = { x, y, vx: 0, vy: 0, r: R, t, col: new THREE.Color(col), alive: true, cup: false, i: balls.length, sc: 1, gold: false }; balls.push(b); return b; }
function addBomb(x, y) {
  const b = addBall(x, y, 'b', '#222'); b.r = RB;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(RB, 24, 16), glossy('#2b2d42', { roughness: 0.25 })); body.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 12), mat('#8d99ae')); cap.position.set(0.1, RB * 0.92, 0); cap.rotation.z = -0.4;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), mat('#a47148')); fuse.position.set(0.16, RB + 0.1, 0); fuse.rotation.z = -0.6;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd60a' })); spark.position.set(0.22, RB + 0.2, 0);
  const face = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff' })); face.position.set(0, -0.05, RB * 0.97); face.rotation.z = Math.PI;
  g.add(body, cap, fuse, spark, face); scene.add(g); b.g = g; b.spark = spark; bombs.push(b);
}
function mkLock(col) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(lockBodyGeo, glossy(col, { metalness: 0.3 })); body.castShadow = true;
  const sh = new THREE.Mesh(shackleGeo, glossy('#e9edf5', { metalness: 0.8, roughness: 0.2 })); sh.position.y = 0.14;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: '#2b2d42' })); hole.position.z = 0.085;
  g.add(body, sh, hole); return g;
}
function mkKey(col) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16), glossy('#ffd23f', { metalness: 0.7, roughness: 0.25 })); head.position.y = 0.2;
  const shaft = new THREE.Mesh(keyShaftGeo, glossy('#ffd23f', { metalness: 0.7, roughness: 0.25 })); shaft.position.y = -0.02;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.04), glossy('#ffd23f', { metalness: 0.7, roughness: 0.25 })); tooth.position.set(0.06, -0.1, 0);
  g.add(head, shaft, tooth); return g;
}

function build(n, opts = {}) {
  closeCards(); clearLevel(); fx.length = 0;
  cur = levelData(n, opts); const def = cur.def, M = cur.M;
  wd = WORLDS[cur.world]; applyPalette({ bg: wd.bg, ui: wd.ui }); applyJar();
  const seed = cur.mode === 'level' ? n * 7919 + 13 : hashDef(def), r = rng(seed * 3 + 1);   // bonus vessels: seeded by their layout, so the verified solution always holds
  const two = def.lanes.length === 2, W = two ? 2.5 : 1.6, tail = def.tail || [], tl = tail.length, maxD = Math.max(...def.lanes.map(L => L.length));
  const yLane0 = Y_FLOOR + tl * HROW; divY = two ? yLane0 : -99; const yTop = yLane0 + (maxD - 1) * HROW; vTop = yTop + 1.3;
  // vessel walls
  const tubeSegs = [];
  const wall = pts => { for (let i = 0; i < pts.length - 1; i++) tubeSegs.push(addSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); };
  wall([[-W, vTop], [-W, 0.3], [-NECK, -2.0], [-NECK, -2.7]]);
  wall([[W, vTop], [W, 0.3], [NECK, -2.0], [NECK, -2.7]]);
  if (two) wall([[0, vTop], [0, yLane0]]);
  addSeg(-CUP_W, RIM, -CUP_W, CUP_B + 0.02, 0.06); addSeg(CUP_W, RIM, CUP_W, CUP_B + 0.02, 0.06); addSeg(-CUP_W, CUP_B + 0.02, CUP_W, CUP_B + 0.02, 0.06);
  let ti = 0, ji = 0;
  for (const s of tubeSegs) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L = Math.hypot(dx, dy);
    _q.setFromUnitVectors(_up, _p.set(dx / L, dy / L, 0)); _m.compose(_s.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, 0), _q, new THREE.Vector3(1, L, 1)); tubes.setMatrixAt(ti++, _m);
    for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) { _m.makeTranslation(x, y, 0); joints.setMatrixAt(ji++, _m); }
  }
  tubes.count = ti; joints.count = ji; tubes.instanceMatrix.needsUpdate = joints.instanceMatrix.needsUpdate = true;
  // pins + contents, in compile order (lane a, lane b, tail) so indexes match logic.js
  const flip = r() < 0.5 ? 1 : -1, laneTok = def.lanes.flat().filter(t => t === 'C' || t === 'G' || t === 'O').length, tailBalls = tail.filter(t => t === 'C' || t === 'G').length * 17;
  const pairOf = {}; let pc = 0;
  for (const [a, b] of def.twins || []) { pairOf[a] = pairOf[b] = PAIR[pc++ % PAIR.length]; }
  const keyCol = {}, lockCol = {};
  for (const [lk, key] of def.locks || []) { const c = PAIR[pc++ % PAIR.length]; lockCol[lk] = c; keyCol[key] = c; }
  const mk = (id, tk, li, k, y, x0, x1, side) => {
    const inner = side < 0 ? x1 : x0, outer = side < 0 ? x0 : x1, hx = outer + side * 0.62;
    const seg = addSeg(x0, y, x1, y, 0.07);
    const g = new THREE.Group(), pm = pinMat();
    const len = Math.abs(hx - inner) + 0.1;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, len, 14), pm); rod.rotation.z = Math.PI / 2; rod.position.x = (inner + hx) / 2 - side * 0.05; rod.castShadow = true;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), pm); tip.position.x = inner - side * 0.1;
    const spec = pairOf[id] || keyCol[id] || lockCol[id];
    const nut = new THREE.Mesh(NUT, spec ? glossy(spec, { metalness: 0.3, roughness: 0.3 }) : pm); nut.position.x = hx + side * 0.2; nut.castShadow = true;
    g.add(rod, tip, nut);
    if (pairOf[id]) for (const o of [0.45, 0.8]) { const ring = new THREE.Mesh(ringGeo, glossy(spec, { metalness: 0.3 })); ring.rotation.y = Math.PI / 2; ring.position.x = hx - side * o; ring.scale.set(1, 1, 0.9); g.add(ring); }
    g.position.y = y; scene.add(g);
    const p = { g, nut, seg, side, y, inner, hx: hx + side * 0.2, out: 0, pulled: false, li, k, id, idx: pins.length, twin: -1, lock: -1, pulse: 0 };
    if (keyCol[id]) { const kg = mkKey(keyCol[id]); kg.position.set(hx + side * 0.2, 0.42, 0.1); kg.rotation.z = 0.35 * side; g.add(kg); p.keyMesh = kg; }
    if (lockCol[id]) { const lg = mkLock(lockCol[id]); lg.position.set(hx - side * 0.15, 0.04, 0.16); g.add(lg); const lo = { g: lg, pin: p, key: null, t: -1, vy: 0, par: g }; locks.push(lo); p.lockMesh = lo; }
    pins.push(p);
    // contents resting on this pin
    const xl = x0 + TUBE_R + R + 0.04, xr = x1 - TUBE_R - R - 0.04, wide = li < 0;
    if (tk === 'B') {
      const bx = wide ? lerp(xl + 1, xr - 1, r()) : lerp(xl + 0.2, xr - 0.2, 0.3 + r() * 0.4); addBomb(bx, y + 0.07 + RB + 0.01);
    } else if (tk === 'C' || tk === 'G' || tk === 'O') {
      const per = Math.floor((xr - xl) / (2 * R + 0.02)) + 1, rows = wide ? 1 : clamp(Math.floor((68 - tailBalls) / (per * Math.max(1, laneTok))), 1, 3);
      for (let row = 0; row < rows; row++) for (let i = 0; i < per - (row % 2); i++) {
        const x = xl + i * (2 * R + 0.02) + (row % 2) * (R + 0.01), yy = y + 0.07 + R + 0.01 + row * (2 * R * 0.88);
        const b = tk === 'C' ? addBall(x, yy, 'c', COLS[Math.floor(r() * COLS.length)]) : tk === 'G' ? addBall(x, yy, 'g', GREY) : addBall(x, yy, 'o', GOO);
        b.ph = r() * 6; b.grp = p.idx;
      }
    }
    return p;
  };
  def.lanes.forEach((L, li) => {
    const x0 = two ? (li === 0 ? -W : 0) : -W, x1 = two ? (li === 0 ? 0 : W) : W, d = L.length;
    L.forEach((tk, k) => {
      const y = yLane0 + (d - 1 - k) * HROW, side = two ? (li === 0 ? -1 : 1) : ((k % 2 ? 1 : -1) * flip);
      mk('ab'[li] + k, tk, li, k, y, x0, x1, side);
    });
  });
  tail.forEach((tk, k) => { mk('t' + k, tk, -1, k, Y_FLOOR + (tl - 1 - k) * HROW, -W, W, (k % 2 ? 1 : -1) * flip); });
  for (const p of pins) { const mp = M.pins[p.idx]; p.twin = mp.twin; p.lock = mp.lock; }
  for (const p of pins) if (p.lock >= 0) { p.lockMesh.key = pins[p.lock]; }
  // a golden ball in every fifth vessel (pays a coin)
  goldN = 0;
  if (cur.mode === 'level' && (n % 5 === 0 || n === 3) || cur.mode === 'remix' && n % 3 === 0) {
    const cs = balls.filter(b => b.t === 'c'); if (cs.length) { const b = cs[Math.floor(r() * cs.length)]; b.gold = true; b.col.set(GOLD); goldN = 1; }
  }
  goodTotal = balls.filter(b => b.t === 'c' || b.t === 'g').length; inCup = 0; pour = 0; pourBest = 0; recorded = false; winT = 0; settleT = 0;
  for (let i = 0; i < 30; i++) step(1 / 60, true);           // let piles settle before the player sees them
  // fit the camera: whole vessel + jar + % pill, with headroom for the HUD
  const tanH = Math.tan(camera.fov * Math.PI / 360), top = vTop + 0.5, bot = CUP_B - 1.3;
  const zH = (top - bot + 5.4) / (2 * tanH), zW = (two ? 8.2 : 5.9) / (2 * tanH * camera.aspect);
  camZ = Math.max(zH, zW, 14); camY = (top + bot) / 2 + 0.2 * camZ / 21 + 0.9;
  taps = 0; coinsGot = 0; streak = 0; idleT = 0; guide = null; startedAt = performance.now(); hitstop = 0; slow = 0; convStreak = 0;
  tries = (cur.mode === 'level' && lastBuilt === n) ? tries + 1 : 0; lastBuilt = cur.mode === 'level' ? n : -1;
  as = lstart(M); planNow = plan(M, as); deadAt = 0; deadShown = false;
  ui.levels(cur.n || '·'); ui.progress(0); setPct(0, true);
  state = 'play'; hudUpdate(); bannerFor(); if (Object.keys(stars).length >= 3) LB.start();
}
let lastBuilt = -1;
function restart() { tone(300, 0.08, 'sine', 0.1, 1.5); build(cur.mode === 'level' ? cur.n : cur.n, cur.mode === 'daily' ? { daily: true } : {}); }

function projected() { return starsFor(taps); }
function starsFor(used) { return used <= cur.par ? 3 : used <= cur.par + 1 ? 2 : 1; }
function hudUpdate() {
  const boss = cur.mode === 'level' && cur.n % PER === 0;
  elName.innerHTML = `${cur.hard ? `<span class="tag ${boss ? 'boss' : ''}">${boss ? 'BOSS' : 'HARD'}</span>` : ''}${cur.mode === 'daily' ? 'DAILY' : cur.mode === 'remix' ? 'BONUS' : 'LEVEL ' + cur.n}`;
  elInfo.innerHTML = `<span>PULLS <b>${taps}</b>/${cur.par}</span>`;
  elCoins.innerHTML = `${IC.coin('#ffd23f', 22)}<span>${coins}</span>`;
  elHint.querySelector('.n').textContent = hints > 0 ? hints : '5';
  elHint.classList.toggle('off', hints <= 0 && coins < 5);
  elStars.innerHTML = `<span class="lbl">PAR ${cur.par}</span>` + starsRow(state === 'play' || state === 'won' ? projected() : 1, 24);
}
function bannerFor() {
  const old = hud.querySelector('.bx-banner'); if (old) old.remove();
  let h = '', sub = '', tag = '';
  if (cur.mode === 'level') {
    const it = INTRO[cur.n], first = (cur.n - 1) % PER === 0;
    if (cur.hard) tag = cur.n % PER === 0 ? 'BOSS' : 'HARD';
    if (first && !cleared(cur.n)) { h = wd.name; sub = it ? it[1] : wd.blurb; }
    else if (it && !cleared(cur.n)) { h = it[0]; sub = it[1]; }
    else if (tag) { h = tag === 'BOSS' ? 'Boss vessel' : 'Hard one'; sub = ''; }
  } else if (cur.mode === 'daily') { h = 'Daily vessel'; sub = 'Same vessel for everyone today'; }
  else { h = cur.name; sub = 'Made fresh, same rules'; }
  if (!h) return;
  hud.appendChild(dom(`<div class="bx-banner">${tag && h !== tag && !first0(h) ? `<span class="tag">${tag}</span><br>` : ''}<h2>${h}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`));
}
const first0 = h => h === 'Boss vessel' || h === 'Hard one';

// ---------------------------------------------------------------- hints
function useHint() {
  if (state !== 'play') return;
  if (!as) { ui.pop('Dead end: restart', '#fff', 24, 30); pulseRedo(); return; }
  const pl = planNow;
  if (!pl) { ui.pop('Dead end: restart', '#fff', 24, 30); pulseRedo(); return; }
  if (hints > 0) hints--; else if (coins >= 5) coins -= 5; else { tone(180, 0.1, 'square', 0.08, 0.7); ui.pop('Win a vessel for coins', '#fff', 22, 30); return; }
  guide = pins[pl[0]]; guide.pulse = 3; idleT = 0; sfx.pick(3); saveAll(); hudUpdate(); bumpCoins();
}
function bumpCoins() { elCoins.classList.remove('bump'); void elCoins.offsetWidth; elCoins.classList.add('bump'); }
function pulseRedo() { elRedo.classList.add('pulse'); setTimeout(() => elRedo.classList.remove('pulse'), 3000); }

// ---------------------------------------------------------------- physics
function colSeg(b, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
  let t = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  let nx = b.x - (s.ax + dx * t), ny = b.y - (s.ay + dy * t); const d2 = nx * nx + ny * ny, rr = b.r + s.r;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || 1e-6; nx /= d; ny /= d; b.x += nx * (rr - d); b.y += ny * (rr - d);
}
// position-based dynamics: integrate, push overlaps apart, derive velocity from the corrected positions (stable piles)
function step(dt, quiet = false) {
  const h = dt / SUB;
  for (let s = 0; s < SUB; s++) {
    for (const b of balls) {
      if (!b.alive) continue; b.px = b.x; b.py = b.y; b.vy += GRAV * h;
      const v = Math.hypot(b.vx, b.vy); if (v > 14) { b.vx *= 14 / v; b.vy *= 14 / v; }
      b.x += b.vx * h; b.y += b.vy * h;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i]; if (!a.alive) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j]; if (!b.alive) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r; if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
          const d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, pen = rr - d, ma = a.r * a.r, mb = b.r * b.r, wa = mb / (ma + mb), wb = ma / (ma + mb);
          a.x -= nx * pen * wa; a.y -= ny * pen * wa; b.x += nx * pen * wb; b.y += ny * pen * wb;
          if (it === 0 && !quiet && state === 'play') contact(a, b);
        }
      }
      for (const b of balls) {
        if (!b.alive) continue; for (const sg of segs) if (sg.on) colSeg(b, sg);
        if (b.y < RIM + 0.1 && b.y > CUP_B - 1.5 && Math.abs(b.x) < CUP_W + 0.4) {   // the jar is a hard box: piles can't squeeze through it
          const lim = CUP_W - 0.06 - b.r; if (b.x > lim) b.x = lim; else if (b.x < -lim) b.x = -lim;
          if (b.y < CUP_B + 0.08 + b.r) b.y = CUP_B + 0.08 + b.r;
        }
      }
    }
    for (const b of balls) { if (!b.alive) continue; b.vx = (b.x - b.px) / h * 0.998; b.vy = (b.y - b.py) / h * 0.998; }
  }
}
function contact(a, b) {
  if (a.t === 'b' || b.t === 'b') {
    const bomb = a.t === 'b' ? a : b, o = a === bomb ? b : a;
    if (o.t === 'c') explode(bomb, true, o); else if (o.t === 'g' || o.t === 'o') explode(bomb, false, o);
    return;
  }
  if ((a.t === 'g' && b.t === 'c') || (a.t === 'c' && b.t === 'g')) { const g = a.t === 'g' ? a : b, c = a === g ? b : a; if (!g.q) { g.q = 1; convQ.push({ g, col: c.gold ? new THREE.Color(COLS[g.i % COLS.length]) : c.col, t: 0.05 }); } }
}
function pop(o, cols) { o.alive = false; burst(scene, new THREE.Vector3(o.x, o.y, 0), cols, 4, { speed: 0.08, up: 0.05, size: 0.6 }); }
function explode(bomb, bad, culprit) {
  if (!bomb.alive) return; bomb.alive = false; scene.remove(bomb.g);
  const P = new THREE.Vector3(bomb.x, bomb.y, 0.2);
  burst(scene, P, ['#ffd60a', '#fb5607', '#2b2d42', '#ffffff'], 30, { speed: 0.16, up: 0.08, size: 1.1, gravity: 0.004 });
  sfx.smash(); buzz([40, 30, 60]); ui.flash(bad ? 0.7 : 0.4); shake = bad ? 0.55 : 0.4; hitstop = 0.14;
  shockwave(bomb.x, bomb.y, bad ? '#ff5a4a' : '#ffd27a', bad ? 3.4 : 2.6);
  let popped = 0;
  const gone = new Set(), pals = [];   // goo and other bombs in the same pile vanish with this bomb: flood through touching balls
  if (!bad) {
    const near = (a, o, e) => Math.hypot(o.x - a.x, o.y - a.y) < a.r + o.r + e;
    const q = [bomb], seen = new Set([bomb]), falls = new Set();
    while (q.length) {
      const a = q.pop(); if (a.t === 'o') gone.add(a); else if (a.t === 'b' && a !== bomb) pals.push(a); if (a.fall) falls.add(a.fall);
      for (const o of balls) if (o.alive && !seen.has(o) && near(a, o, 0.06)) { seen.add(o); q.push(o); }
    }
    for (const o of balls) if (o.alive && o.t === 'o' && o.fall && falls.has(o.fall)) gone.add(o);
    for (const o of balls) if (o.alive && o !== bomb && (o.t === 'o' || o.t === 'b') && Math.abs(o.y - bomb.y) < 1 && (bomb.y < divY - 0.45 || o.x * bomb.x >= 0)) { if (o.t === 'o') gone.add(o); else if (!pals.includes(o)) pals.push(o); }   // same pile: same row, same side of the divider
    for (const o of pals) { o.alive = false; scene.remove(o.g); burst(scene, new THREE.Vector3(o.x, o.y, 0.2), ['#ffd60a', '#fb5607'], 12, { speed: 0.1, up: 0.06, size: 0.9, gravity: 0.004 }); }
  }
  for (const o of balls) {
    if (!o.alive || o === bomb) continue; const dx = o.x - bomb.x, dy = o.y - bomb.y, d = Math.hypot(dx, dy);
    if ((o.t === 'g' && d < 0.72) || (o.t === 'o' && (d < 1.2 || gone.has(o)))) { pop(o, o.t === 'o' ? [GOO, '#d6ffb8'] : [GREY, '#ffffff']); popped++; }
    else if (d < 1.6) { o.vx += dx / (d + 0.1) * 4; o.vy += dy / (d + 0.1) * 4 + 2; }
  }
  if (bad) { markBad(bomb.x, bomb.y); lose('BOOM!', 'A bomb touched colour'); }
  else { ui.pop(popped > 3 ? 'POP POP!' : 'POP!', '#fff', 34, 30); tone(260, 0.1, 'triangle', 0.1, 1.8); }
}
function markBad(x, y) {
  if (badMark) badMark.remove(); const [sx, sy] = toScreen(x, y);
  badMark = dom('<div class="bx-bad"></div>'); badMark.style.left = sx + 'px'; badMark.style.top = sy + 'px'; hud.appendChild(badMark);
}

// ---------------------------------------------------------------- game flow
function setPct(p, quiet) {
  const v = Math.round(p * 100); if (v === lastPct) return; lastPct = v; pct.textContent = v + '%';
  if (!quiet) { pct.style.transform = 'translate(-50%,-50%) scale(1.18)'; setTimeout(() => pct.style.transform = 'translate(-50%,-50%)', 110); }
}
const lockedPin = q => q.lock >= 0 && !!pins[q.lock] && !pins[q.lock].pulled;
function pullPin(p) {
  p.pulled = true; p.seg.on = false; p.out = 0.001;
  burst(scene, new THREE.Vector3(p.hx, p.y, 0.3), ['#ffffff', wd.a], 8, { speed: 0.07, up: 0.03, size: 0.5, gravity: 0.002 });
  fallId++; for (const b of balls) if (b.alive && b.y > p.y && b.y < p.y + HROW - 0.05 && b.x > Math.min(p.inner, p.hx) - 3 && b.x < Math.max(p.inner, p.hx) + 3 && Math.abs(b.x - (p.inner + (p.side < 0 ? -1 : 1) * 1.5)) < 3.2) b.fall = fallId;   // balls in this pile fall as one
  for (const b of balls) if (b.alive && Math.abs(b.y - p.y) < 0.5) b.vy -= 0.5;   // a kick so piles start moving at once
  for (const l of locks) if (l.key === p && l.t < 0) { l.t = 0; l.vy = 0.05; tone(1300, 0.08, 'triangle', 0.1, 1.2); setTimeout(() => tone(1700, 0.1, 'triangle', 0.08, 1), 70); }
}
function deny(p) {
  tone(160, 0.12, 'square', 0.08, 0.8); buzz(20);
  const l = p.lockMesh; if (l) l.shakeT = 0.4;
  const k = pins[p.lock]; if (k) k.pulse = 2.2;
  ui.pop('Locked: pull the key bolt', '#fff', 22, 30);
}
function pull(p) {
  if (state !== 'play' || p.pulled) return;
  const tw = p.twin >= 0 ? pins[p.twin] || null : null;
  if (lockedPin(p) || (tw && (tw.pulled || lockedPin(tw)))) { deny(lockedPin(p) ? p : tw); return; }
  idleT = 0; guide = null; taps++;
  if (as) { const n = lmove(cur.M, as, p.idx); as = n.fail ? null : n; planNow = as ? plan(cur.M, as) : null; deadAt = 0; }
  pullPin(p); if (tw) pullPin(tw);
  const pitch = 300 + Math.min(taps, 8) * 25;
  tone(pitch, 0.12, 'triangle', 0.14, 2.2); setTimeout(() => tone(pitch * 3, 0.05, 'sine', 0.08, 1.4), 70); buzz(14);
  if (tw) { tone(pitch * 1.5, 0.12, 'triangle', 0.1, 2); }
  hudUpdate();
}
let lastLoss = '';
function lose(t, line) {
  if (state !== 'play') return; state = 'lost'; lastLoss = t + ' ' + line + ' @taps ' + taps;
  if (!recorded) { recorded = true; F.level(false, goodTotal ? inCup / goodTotal : 0); }
  sfx.fail(); buzz([30, 40, 80]); shake = Math.max(shake, 0.3); saveAll();
  const frac = goodTotal ? inCup / goodTotal : 0, near = frac >= 0.7;
  const tt = near ? 'SO CLOSE!' : t;
  setTimeout(() => {
    if (state !== 'lost') return; closeCards();
    const w = dom(`<div class="bx-cardwrap"><div class="bx-card">
      <h1>${tt}</h1><h3>${near ? `${Math.round(frac * 100)}% in the jar. ${line}` : line}</h3>
      <div class="msg">${tries >= 2 && (hints > 0 || coins >= 5) ? 'Stuck? The bulb shows the next bolt.' : 'Think about which bolt goes first.'}</div>
      <button class="bx-go">Retry</button><br><button class="bx-sm" data-a="map">${IC.map('#6a3d9a', 16)} Levels</button>
    </div></div>`);
    document.body.appendChild(w); w.addEventListener('pointerdown', stop);
    w.querySelector('.bx-go').addEventListener('click', () => { closeCards(); restart(); });
    w.querySelector('[data-a]').addEventListener('click', () => { closeCards(); showMap(); });
  }, 700);
}
function win() {
  if (state !== 'play') return; state = 'won';
  const s = starsFor(taps), first = !cleared(cur.n), prev = stars[cur.n] || 0, n = cur.n;
  const before = totalStars(), jarBefore = JARS.filter(j => j.need <= before).length;
  if (cur.mode === 'level') { if (s > prev) stars[n] = s; }
  const bonus = cur.mode === 'level' ? (first ? 1 : 0) + (s === 3 && prev < 3 ? 1 : 0) : cur.mode === 'daily' ? 3 : 1;
  const bestPrev = bestT[n], newBest = cur.mode === 'level' && (bestPrev === undefined || taps < bestPrev); if (newBest) bestT[n] = taps;
  let lucky = 0; if (cur.mode === 'level' && !first && s === 3 && Math.random() < 0.15) lucky = 2;
  if (pourBest >= 28 && cur.mode === 'level') lucky += 1;
  coins += bonus + lucky; coinsGot += bonus + lucky;
  let msg = '';
  if (cur.mode === 'daily') {
    const t = dayNum(), y = new Date(); y.setDate(y.getDate() - 1); const yd = y.getFullYear() * 10000 + (y.getMonth() + 1) * 100 + y.getDate();
    if (dayInfo.d !== t) { dayInfo.streak = dayInfo.d === yd ? dayInfo.streak + 1 : 1; dayInfo.d = t; msg = `Daily streak: ${dayInfo.streak}`; }
  }
  const after = totalStars(), newJar = JARS.filter(j => j.need <= after).length > jarBefore ? JARS.filter(j => j.need <= after).pop() : null;
  if (newJar) jarId = newJar.id;
  saveAll();
  if (!recorded) { recorded = true; F.level(true); if (first || cur.mode !== 'level') LB.submit(1); }
  sfx.win(); buzz([20, 30, 20]); ui.flash(0.4); jarBounce = 1; slow = 0.5;
  confetti(scene, new THREE.Vector3(0, RIM + 0.6, 0.5), s === 3 ? 120 : 70);
  ui.pop(['SWEET!', 'NICE!', 'PERFECT!'][s - 1], '#fff', 44, 28);
  hudUpdate();
  const worldDone = cur.mode === 'level' && first && n % PER === 0;
  setTimeout(() => showWin({ s, bonus, newJar, first, worldDone, msg, prev, newBest, bestPrev, lucky }), 2100);
}
function showWin(r) {
  closeCards();
  const t = totalStars(), nx = JARS.find(j => j.need > t);
  const prevNeed = nx ? [...JARS].reverse().find(j => j.need <= t).need : 0, pc = nx ? ((t - prevNeed) / (nx.need - prevNeed)) * 100 : 100;
  const w = dom(`<div class="bx-cardwrap"><div class="bx-card">
    <h1>${r.worldDone ? 'WORLD CLEARED!' : r.s === 3 ? 'PERFECT!' : 'CLEARED!'}</h1>
    <h3>${cur.mode === 'daily' ? 'Daily vessel' : cur.mode === 'remix' ? cur.name : `Level ${cur.n}`}</h3>
    <div class="big">${[0, 1, 2].map(i => IC.star(i < r.s ? '#ffc928' : '#c9bde6', 60).replace('<svg', `<svg class="${i < r.s ? '' : 'dim'}" style="animation-delay:${0.25 + i * 0.3}s"`)).join('')}</div>
    <div class="row"><span>${taps} pulls · par ${cur.par}${r.newBest && r.bestPrev !== undefined ? ' · new best!' : r.bestPrev !== undefined ? ' · best ' + r.bestPrev : ''}</span>${coinsGot ? `<span>${IC.coin('#ffc928', 22)}+<b class="cnt" data-v="${coinsGot}">0</b></span>` : ''}</div>
    ${r.lucky ? `<div class="msg" style="color:var(--ui)">${pourBest >= 28 ? 'Fever pour' : 'Lucky pour'}: +${r.lucky} extra</div>` : ''}
    ${cur.mode === 'level' ? `<div class="msg">Daily vessel ${dayInfo.d === dayNum() ? 'done' : 'waiting'} · streak ${dayInfo.streak || 0}</div>` : ''}
    ${r.msg ? `<div class="msg">${r.msg}</div>` : ''}
    ${r.worldDone && cur.n < COUNT ? `<div class="msg">${WORLDS[Math.floor(cur.n / PER)].name} is open: ${WORLDS[Math.floor(cur.n / PER)].blurb}</div>` : ''}
    ${r.newJar ? `<div class="msg" style="color:var(--ui)">New jar: ${r.newJar.name}! Using it now</div>` : ''}
    ${nx ? `<div class="msg"${nx.need - t <= 2 ? ' style="color:var(--ui);font-weight:900"' : ''}>${nx.need - t <= 2 ? 'SO CLOSE: ' : ''}${nx.need - t} more star${nx.need - t > 1 ? 's' : ''} for the ${nx.name} jar</div><div class="bar"><i style="width:${pc}%"></i></div>` : '<div class="msg">Every jar found</div>'}
    <button class="bx-go">${cur.mode === 'level' && cur.n >= COUNT ? 'Bonus vessels' : 'Next'}</button><br>
    ${r.s < 3 && cur.mode === 'level' ? `<button class="bx-sm" data-a="again">${IC.redo('#6a3d9a', 16)} Again for ${r.s + 1} stars</button>` : ''}<button class="bx-sm" data-a="map">${IC.map('#6a3d9a', 16)} Levels</button>
  </div></div>`);
  document.body.appendChild(w);
  for (let i = 0; i < r.s; i++) setTimeout(() => note(72 + i * 4, 0.3, 0.14), 350 + i * 300);
  w.querySelectorAll('.cnt').forEach(c => { const v = +c.dataset.v; let k = 0; const iv = setInterval(() => { k++; c.textContent = Math.min(v, k); if (k >= v) clearInterval(iv); else note(80 + k, 0.05, 0.06); }, 140); });
  w.querySelector('.bx-go').addEventListener('click', () => { closeCards(); goNext(); });
  w.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { closeCards(); if (b.dataset.a === 'again') restart(); else showMap(); }));
  w.addEventListener('pointerdown', stop);
}
function goNext() {
  if (cur.mode === 'daily') { showMap(); return; }
  build(cur.mode === 'remix' ? cur.n + 1 : cur.n < COUNT ? cur.n + 1 : COUNT + 1);
}
function onCup(b) {
  b.cup = true;
  if (b.t === 'g') { b.col.set('#7d8597'); markBad(b.x, RIM + 0.4); lose('GREY BALL!', 'Grey reached the jar before it touched colour'); return; }
  if (b.t === 'o') { markBad(b.x, RIM + 0.4); lose('GOO!', 'Goo got into the jar'); return; }
  if (b.t === 'b') { explode(b, true, b); return; }
  inCup++; ui.progress(inCup / goodTotal); setPct(inCup / goodTotal);
  { const nw = performance.now(); pour = nw - pourT < 260 ? pour + 1 : 1; pourT = nw; pourBest = Math.max(pourBest, pour);
    if (pour === 8 || pour === 16 || pour === 28 || pour === 45) { jarBounce = 1; hitstop = Math.max(hitstop, 0.04); shake = Math.max(shake, 0.12); ui.pop(pour >= 45 ? 'JACKPOT!' : pour >= 28 ? 'FEVER x' + pour : 'x' + pour, pour >= 28 ? '#ffd23f' : '#fff', 30 + pour / 3, 30); burst(scene, new THREE.Vector3(0, RIM + 0.3, 0.5), [GOLD, '#fff'], 14 + pour / 2, { speed: 0.1, up: 0.1, size: 0.7 }); tone(500 + pour * 14, 0.14, 'triangle', 0.12, 1.6); } }
  b.sc = 1.5; jarBounce = Math.max(jarBounce, 0.35);
  if (inCup % 6 === 0) burst(scene, new THREE.Vector3(b.x, RIM + 0.15, 0.4), '#' + b.col.getHexString(), 4, { speed: 0.06, up: 0.07, size: 0.5, gravity: 0.004 });
  const now = performance.now(); if (now - tickT > 45) { tickT = now; note(72 + Math.min(26, Math.floor(inCup / goodTotal * 18) + Math.min(8, pour >> 1)), 0.12, 0.08 + Math.min(0.06, pour * 0.003)); }
  if (b.gold) { coins++; coinsGot++; saveAll(); bumpCoins(); hudUpdate(); sfx.coin(); ui.pop('GOLD BALL! +1', '#fff3a0', 36, 34); burst(scene, new THREE.Vector3(b.x, RIM, 0.4), [GOLD, '#fff', '#ffb703'], 24, { speed: 0.12, up: 0.1, size: 0.8 }); }
}

// ---------------------------------------------------------------- map + jar shelf
let mapWorld = 0;
function showMap(w) {
  closeCards();
  const nl = nextLevel(); mapWorld = w !== undefined ? w : Math.min(2, Math.floor((Math.min(nl, COUNT) - 1) / PER));
  const wi = WORLDS[mapWorld], t = totalStars(), nx = JARS.find(j => j.need > t);
  const worldOpen = i => i === 0 || cleared(i * PER);
  const ws = Array.from({ length: PER }, (_, k) => mapWorld * PER + k + 1);
  const rows = [0, 1, 2].map(r => ws.slice(r * 4, r * 4 + 4));
  const lv = n => {
    const L = LEVELS[n - 1], ok = unlocked(n), s = stars[n] || 0, isNext = n === nl, boss = n % PER === 0;
    return `<button class="bx-lv ${ok ? '' : 'lk'} ${L.hard && !boss ? 'hard' : ''} ${boss ? 'boss' : ''} ${isNext ? 'next' : ''}" data-n="${n}">${L.hard ? `<span class="tg">${boss ? 'BOSS' : 'HARD'}</span>` : ''}${ok ? n : IC.lock('rgba(255,255,255,.85)', 24)}<span class="st">${ok ? starsRow(s, 15, '#ffb700', 'rgba(0,0,0,.25)') : ''}</span></button>`;
  };
  const wsStars = ws.reduce((a, n) => a + (stars[n] || 0), 0);
  const el = dom(`<div class="bx-cardwrap bx-map-wrap"><div class="bx-mapcard" style="--m1:${wi.bg[0]};--m2:${wi.bg[1]};--ui:${wi.ui}">
    <div class="bx-mhead"><span style="display:flex;align-items:center;gap:6px">${IC.star('#ffd23f', 22)} ${t}/${COUNT * 3}</span><span style="display:flex;align-items:center;gap:5px">${IC.coin('#ffd23f', 22)} ${coins}</span><span style="display:flex;align-items:center;gap:5px">${IC.bulb('#fff', 22)} ${hints}</span><button class="x" aria-label="Close">×</button></div>
    <div class="bx-tabs">${WORLDS.map((x, i) => `<button class="bx-tab ${i === mapWorld ? 'on' : ''} ${worldOpen(i) ? '' : 'lk'}" data-w="${i}">${x.name}<small>${worldOpen(i) ? Array.from({ length: PER }, (_, k) => stars[i * PER + k + 1] || 0).reduce((a, b) => a + b, 0) + '/' + PER * 3 : 'locked'}</small></button>`).join('')}</div>
    <div class="bx-wsub">${wi.blurb}${wsStars === PER * 3 ? ' · all stars!' : ''}</div>
    <div class="bx-grid" style="${worldOpen(mapWorld) ? '' : 'opacity:.5;pointer-events:none'}">${rows.map((r, i) => `<div class="bx-rowl ${i % 2 ? 'rev' : ''}">${r.map(lv).join('')}</div>`).join('')}</div>
    <div class="bx-wsub" style="margin-top:22px">${nx ? `${nx.need - t} more stars for the ${nx.name} jar` : 'Every jar found'}</div>
    <div class="bx-mfoot"><button class="bx-sm" data-a="daily">${IC.cal('#6a3d9a', 18)} Daily${dayInfo.d === dayNum() ? ' · done' : dayInfo.streak ? ` · ${dayInfo.streak} days` : ''}</button><button class="bx-sm" data-a="jars">${IC.jar('#6a3d9a', 18)} Jars</button>${nl > COUNT ? `<button class="bx-sm" data-a="remix">Bonus</button>` : ''}</div>
  </div></div>`);
  document.body.appendChild(el); el.addEventListener('pointerdown', stop);
  el.querySelector('.x').addEventListener('click', () => { closeCards(); if (state === 'won') build(Math.min(nextLevel(), COUNT + 1)); });
  el.querySelectorAll('.bx-lv').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.n; if (!unlocked(n)) { tone(180, 0.1, 'square', 0.08, 0.7); return; } closeCards(); build(n); }));
  el.querySelectorAll('.bx-tab').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.w; if (!worldOpen(i)) { tone(180, 0.1, 'square', 0.08, 0.7); return; } showMap(i); }));
  el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a; closeCards();
    if (a === 'daily') build(0, { daily: true }); else if (a === 'jars') showJars(); else if (a === 'remix') build(COUNT + 1);
  }));
}
function showJars() {
  const t = totalStars();
  const el = dom(`<div class="bx-cardwrap"><div class="bx-card"><h1>JARS</h1><h3>${t} stars earned · use any jar you have found</h3>
    <div class="bx-jars">${JARS.map(j => { const have = t >= j.need; const bg = j.rainbow ? 'conic-gradient(#ff5d5d,#ffd23f,#3ac46a,#3a86ff,#b05cff,#ff5d5d)' : j.rim; return `<button class="bx-jr ${have ? '' : 'lk'} ${j.id === jarId ? 'on' : ''}" data-s="${j.id}"><div class="sw" style="border-color:${have ? j.rim : '#b9b2c9'};${have && j.rainbow ? 'border-image:' + bg + ' 1;' : ''}background:${have ? j.tint + '99' : '#ddd'}"></div>${have ? j.name : j.need + ' stars'}</button>`; }).join('')}</div>
    <button class="bx-go">Back</button></div></div>`);
  document.body.appendChild(el); el.addEventListener('pointerdown', stop);
  el.querySelectorAll('.bx-jr').forEach(b => b.addEventListener('click', () => { const j = JARS.find(x => x.id === b.dataset.s); if (t < j.need) { tone(180, 0.1, 'square', 0.08, 0.7); return; } jarId = j.id; saveAll(); sfx.pick(2); applyJar(); closeCards(); showJars(); }));
  el.querySelector('.bx-go').addEventListener('click', () => { closeCards(); showMap(); });
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
function pinAt(cx, cy) {
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  let best = null, bd = 0.62;
  for (const p of pins) {
    if (p.pulled) continue;
    const a = Math.min(p.inner, p.hx), b = Math.max(p.inner, p.hx), x = clamp(hit.x, a, b);
    const d = Math.hypot(hit.x - x, (hit.y - p.y) * 1.15) - (Math.abs(hit.x - p.hx) < 0.45 ? 0.25 : 0);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
input({ onDown: e => { if (state !== 'play') return; const p = pinAt(e.clientX, e.clientY); if (p) pull(p); else tone(200, 0.04, 'sine', 0.05, 0.9); } });

// ---------------------------------------------------------------- tick (logic) + draw
function tick(dtRaw) {
  let dt = dtRaw;
  if (hitstop > 0) { hitstop -= dtRaw / 60; dt = dtRaw * 0.1; }
  if (slow > 0) { slow -= dtRaw / 60; dt = dtRaw * 0.4; }
  const rs = dtRaw / 60;
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].t -= rs; if (fx[i].t <= 0) { const f = fx.splice(i, 1)[0]; f.fn(); } }
  if (state === 'play' || state === 'won' || state === 'lost') step(Math.min(dt, 2) / 60);
  // grey -> colour conversion wave: pitch climbs while the wave runs
  convStreakT -= rs; if (convStreakT <= 0) convStreak = 0;
  for (let i = convQ.length - 1; i >= 0; i--) {
    const q = convQ[i]; q.t -= dt / 60; if (q.t > 0) continue; convQ.splice(i, 1);
    if (!q.g.alive || q.g.t !== 'g' || state !== 'play') continue;
    q.g.t = 'c'; q.g.col.copy(q.col); q.g.sc = 1.6;
    const now = performance.now(); if (now - convT > 60) { convT = now; convStreak++; convStreakT = 0.5; note(70 + Math.min(14, convStreak), 0.1, 0.07); burst(scene, new THREE.Vector3(q.g.x, q.g.y, 0.2), '#' + q.col.getHexString(), 3, { speed: 0.05, up: 0.03, size: 0.45 }); }
  }
  const sp = [];
  for (const b of balls) {
    if (!b.alive) continue;
    sp.push(Math.hypot(b.vx, b.vy));
    if (!b.cup && b.y < RIM - 0.05 && Math.abs(b.x) < CUP_W && state === 'play') onCup(b);
    if (b.y < -9) b.alive = false;
  }
  if (state === 'play') {
    sp.sort((a, b) => a - b); const maxV = sp.length ? sp[Math.floor(sp.length * 0.92)] : 0;
    settleT = maxV < 0.6 ? settleT + rs : 0;
    const good = balls.filter(b => b.alive && (b.t === 'c' || b.t === 'g'));
    if (good.length && good.every(b => b.cup) && convQ.length === 0) { winT += rs; if (winT > 0.35) win(); } else winT = 0;
    // dead end: nothing can fix this vessel any more (the abstract state has no winning order left): nudge the restart button
    if (as && !planNow && !deadShown) { if (!deadAt && settleT > 1) deadAt = performance.now(); if (deadAt && performance.now() - deadAt > 1500) { deadShown = true; pulseRedo(); ui.pop('Dead end: try again', '#fff', 26, 30); } }
  }
  // pins slide out, padlocks fall off
  for (const p of pins) if (p.out > 0) { p.out += dtRaw * 0.012 + p.out * 0.12 * dtRaw; p.g.position.x = p.side * p.out * 6; if (p.out > 1.4) p.g.visible = false; }
  for (const l of locks) {
    if (l.t >= 0) { l.t += rs; l.vy -= 0.012 * dtRaw; l.g.position.y += l.vy * dtRaw; l.g.position.x += l.pin.side * 0.01 * dtRaw; l.g.rotation.z += 0.12 * dtRaw; l.g.scale.setScalar(Math.max(0, 1 - l.t * 0.9)); if (l.t > 1.1) l.g.visible = false; }
    else if (l.shakeT > 0) { l.shakeT -= rs; l.g.rotation.z = Math.sin(l.shakeT * 60) * 0.35; if (l.shakeT <= 0) l.g.rotation.z = 0; }
  }
}
function draw(dtRaw, t) {
  const rs = dtRaw / 60;
  // balls
  let k = 0;
  for (const b of balls) {
    if (b.t === 'b') {
      if (b.g) { b.g.position.set(b.x, b.y, 0); b.g.rotation.z = -b.x / RB * 0.5; b.spark.scale.setScalar(0.8 + Math.sin(t * 30) * 0.3); }
      continue;
    }
    if (k >= MAXBALL) break;
    b.sc = lerp(b.sc, 1, 0.15 * dtRaw);
    let sc = b.alive ? b.sc : 0;
    if (b.t === 'o') sc *= 1.12 + Math.sin(t * 4 + b.ph) * 0.07; else if (b.gold) sc *= 1.18 + Math.sin(t * 9) * 0.1;
    _m.compose(_p.set(b.x, b.y, 0), _q.identity(), _s.setScalar(sc)); ballMesh.setMatrixAt(k, _m); ballMesh.setColorAt(k, b.col); k++;
  }
  ballMesh.count = k; ballMesh.instanceMatrix.needsUpdate = true; if (ballMesh.instanceColor) ballMesh.instanceColor.needsUpdate = true;
  // goo colour, gold sparkle
  // jar bounce + % pill position
  jarBounce = Math.max(0, jarBounce - dtRaw * 0.04);
  jar.scale.set(1 + jarBounce * 0.08, 1 - jarBounce * 0.06, 1 + jarBounce * 0.08);
  if (jarDef().rainbow) rimMat.color.setHSL((t * 0.2) % 1, 0.75, 0.6);
  const [px, py] = toScreen(0, CUP_B - 0.75); pct.style.left = px + 'px'; pct.style.top = py + 'px';
  // nut pulses (hint, key flash) and the pointing hand
  for (const q of pins) { if (q.pulse > 0) q.pulse = Math.max(0, q.pulse - rs); q.nut.scale.setScalar(1 + (q.pulse > 0 ? Math.sin(t * 14) * 0.25 : 0)); }
  if (state === 'play') {
    idleT += rs;
    const lvl = cur.mode === 'level' ? cur.n : 99;
    if (!guide && as && ((lvl <= 2 && idleT > 1.2) || (lvl <= 6 && idleT > 8) || idleT > 18)) { const pl = planNow; if (pl && pins[pl[0]] && !pins[pl[0]].pulled) { guide = pins[pl[0]]; guide.pulse = 3; } }
    elHint.classList.toggle('wig', idleT > 12 && (hints > 0 || coins >= 5));
  }
  if (guide && !guide.pulled && state === 'play') { const [hx, hy] = toScreen(guide.hx, guide.y); ptr.hidden = false; ptr.style.left = hx + 'px'; ptr.style.top = hy + 'px'; guide.pulse = Math.max(guide.pulse, 0.3); } else ptr.hidden = true;
  // shockwaves
  for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.t += rs * 2; const kk = Math.min(1, w.t); w.m.scale.setScalar(0.3 + kk * w.m.userData.size); w.m.material.opacity = (1 - kk) * 0.9; if (kk >= 1) { scene.remove(w.m); w.m.material.dispose(); waves.splice(i, 1); } }
  // camera
  shake = Math.max(0, shake - dtRaw * 0.012);
  camera.position.set((Math.random() - 0.5) * shake, camY + (Math.random() - 0.5) * shake, camZ);
  camera.lookAt(0, camY, 0);
}
loop((dt, t) => { tick(dt); draw(dt, t); });

// start straight in the next vessel (no title card); the map is one tap away
if (/[?&]daily=1(&|$)/.test(location.search)) build(0, { daily: true });
else build(Math.min(nextLevel(), COUNT + 1));
applyJar();

// ---------------------------------------------------------------- QA hooks
function runFrames(n) { for (let i = 0; i < n; i++) tick(1); }
function settle(max = 900) { runFrames(20); let i = 0; while (i++ < max && state === 'play' && (settleT < 0.5 || convQ.length)) tick(1); }
window.__game = {
  get state() { return state; }, get level() { return cur && cur.n; }, get score() { return totalStars(); }, get stars() { return stars; },
  get taps() { return taps; }, get par() { return cur.par; }, get coins() { return coins; }, get inCup() { return inCup; }, get goodTotal() { return goodTotal; }, get ballCount() { return balls.filter(b => b.alive).length; },
  get dbg() { return { handles: pins.map(p => toScreen(p.hx, p.y)), pins: pins.map(p => p.pulled), info: cur && cur.def }; },
  load(n, o) { build(n, o); }, loadDef(def, n = 99) { build(n, { def }); }, restart, map: showMap, jars: showJars,
  // QA: play the solver's shortest order through the real physics (no waiting for frames), returns { state, taps, stars }
  autoplay(order) {
    const pl = order || planNow; if (!pl) return { state: 'nosolution' };
    for (const i of pl) { if (state !== 'play') break; settle(); if (state !== 'play') break; pull(pins[i]); }
    for (let i = 0; i < 900 && state === 'play'; i++) tick(1);
    return { state, taps, stars: starsFor(taps), par: cur.par, inCup, goodTotal, why: state === 'lost' ? lastLoss : undefined };
  },
  stuck() { return balls.filter(b => b.alive && !b.cup && b.t !== 'b').map(b => [b.t, +b.x.toFixed(2), +b.y.toFixed(2), +Math.hypot(b.vx, b.vy).toFixed(2)]); },
  census() { const c = {}; for (const b of balls) if (b.alive) { const k = b.t + (b.cup ? '*' : ''); c[k] = (c[k] || 0) + 1; } return c; },
  pullIdx(i) { pull(pins[i]); }, frames: runFrames, settle,
  plan() { return planNow; },
  bot() {   // waits for the balls to settle, then pulls the next bolt of the solved order
    if (state !== 'play' || settleT < 0.35 || convQ.length || !as) return;
    if (planNow) { pull(pins[planNow[0]]); settleT = 0; }
  },
  reset() { stars = {}; coins = 3; hints = 2; jarId = 'glass'; dayInfo = { d: 0, streak: 0, best: 0 }; saveAll(); },
  setStars(o) { stars = o; saveAll(); },
};

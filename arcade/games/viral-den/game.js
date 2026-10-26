// Viral Den — original idle-vlogger clicker. Tap to film content, grow followers before the trend fades, buy gear that rebuilds your room.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, PALETTES } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapter } from './kit/adapt.js';
import { demo } from './kit/demo.js';
import { part, merge, canvasTex } from './geo.js';

import { board as worldBoard } from './kit/board.js';
const WB = worldBoard({ game: 'viral-den', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum' });
const S = createStage({ fov: 30, shadowSize: 7 });
const { scene, camera, sun, hemi, renderer } = S;
sun.position.set(6, 12, 9); sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008;
const ui = createUI({ title: 'VIRAL<br>DEN', hint: 'Tap to film content', hand: '👆' });
const save = store('vden');
const F = flow('vden');
let fk = 1;
// ---------------------------------------------------------------- in-round adaptation (ADAPT_BRIEF.md): honest + bounded
// Reads only this round's play: hype steps reached / lost and pace vs the clock, while the player is actually tapping.
// Knobs: hype decay (harder when bigger) ×AD.k, hype per tap ÷AD.k: ±20 %, within ±25 % with flow.js; never harder on
// level 1. The clock, follower counts and the goal are never touched. Rescue (≤ 1 a round, 60 s apart, sensible play
// only, never idle): seconds from a near-miss, a fan reposts the clip and Kai goes viral; the taps still have to earn it.
const AD = adapter(); let paceT = 0, lastM = 1, saved = false;
const AK = () => level === 1 ? Math.min(fk, AD.k(fk)) : AD.k(fk);
const tapping = () => performance.now() - lastTapT < 2500, taps = [];
// sensible here = steady filming (≥ 2.5 taps/s over the last 10 s) with the hype still up: falling behind the clock is
// the trouble being rescued, so it doesn't count against the player the way AD.sensible()'s bad() tally would
const steady = () => { const t = performance.now(); while (taps.length && taps[0] < t - 10000) taps.shift(); return taps.length >= 25 && hypeMult() >= 2; };

// ---------------------------------------------------------------- economy
const CATS = [
  { id: 'cam', name: 'Camera', icon: '📷', base: 55, mult: 1.35 },
  { id: 'light', name: 'Lights', icon: '💡', base: 75, mult: 1.25 },
  { id: 'room', name: 'Room', icon: '🛋️', base: 45, mult: 1.2, passive: true },
  { id: 'gear', name: 'Gear', icon: '🎧', base: 120, mult: 1.3 },
];
const MAXT = 4;
let level = save.get('level', 1), cash = save.get('cash', 0), total = save.get('total', 0);
let tiers = save.get('tiers', [0, 0, 0, 0]);
let state = 'ready', gained = 0, timeLeft = 45, hype = 0, viralT = 0, passAcc = 0;
const goalOf = n => n === 1 ? 1000 : Math.round(5000 * Math.pow(2.85, n - 2) / 100) * 100;
const CASH = 0.12;   // $ earned per new follower (sponsor money)
const timeOf = n => Math.min(55, 38 + n * 2);
const costOf = (c, t) => Math.round(CATS[c].base * Math.pow(2.6, t));
const perTap = () => 4 * CATS.reduce((m, c, i) => m * Math.pow(c.mult, tiers[i]), 1);
const passive = () => tiers[2] * perTap() * 0.3 + tiers[1] * perTap() * 0.08;
const hypeMult = () => viralT > 0 ? 5 : 1 + Math.floor(hype * 3.999);
const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.floor(n) + '';

// ---------------------------------------------------------------- HUD (cash, timer, hype, upgrade cards)
const css = document.createElement('style'); css.textContent = `
.vd-cash{position:fixed;top:calc(62px + env(safe-area-inset-top));left:12px;z-index:6;display:flex;align-items:center;gap:6px;background:rgba(40,20,70,.28);border-radius:20px;padding:3px 12px 3px 6px;font-weight:800;font-size:19px;pointer-events:none}
.vd-cash b{width:24px;height:18px;border-radius:4px;background:linear-gradient(#7ee08a,#2fb34a);box-shadow:inset 0 -2px 0 rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;font-size:12px;color:#1c6b2a}
.vd-rate{position:fixed;top:calc(97px + env(safe-area-inset-top));left:14px;z-index:6;font-weight:800;font-size:12px;pointer-events:none;background:rgba(47,179,74,.85);border-radius:10px;padding:0 8px}.vd-rate:empty{display:none}
.vd-time{position:fixed;top:calc(62px + env(safe-area-inset-top));right:12px;z-index:6;background:rgba(40,20,70,.28);border-radius:20px;padding:3px 12px;font-weight:800;font-size:19px;pointer-events:none}
.vd-time.low{background:#ff4d6d;animation:hcpulse .5s infinite}
.hc-score{font-size:46px!important}
.vd-hype{background:rgba(40,20,70,.22);border-radius:16px;padding:4px 6px 4px 10px;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));width:min(300px,78vw);z-index:6;pointer-events:none;display:flex;align-items:center;gap:8px;font-weight:800;font-size:16px}
.vd-hype .bar{flex:1;height:14px;border-radius:9px;background:rgba(255,255,255,.55);overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.08)}
.vd-hype .bar i{display:block;height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#ffd166,#ff5d8f,#7b5cff);transition:width .08s}
.vd-hype .x{min-width:44px;text-align:center;background:#ff5d8f;border-radius:12px;padding:0 6px;box-shadow:0 3px 0 rgba(0,0,0,.15)}
.vd-hype.viral .x{background:#7b5cff;animation:hcpulse .3s infinite}
.vd-cards{position:fixed;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px;z-index:7;padding:0 10px}
.vd-card{flex:1;max-width:92px;background:#fff;border-radius:18px;padding:6px 4px 7px;text-align:center;color:#3d2c5e;box-shadow:0 5px 0 rgba(60,30,90,.25);font-family:inherit;border:0;cursor:pointer;position:relative;transition:transform .1s}
.vd-card .ic{font-size:30px;line-height:1.05;display:block}
.vd-card .nm{font-weight:800;font-size:13px;display:block;line-height:1.1}
.vd-card .dots{display:flex;justify-content:center;gap:3px;margin:3px 0}
.vd-card .dots i{width:7px;height:7px;border-radius:50%;background:#e4dcef}
.vd-card .dots i.on{background:#7b5cff}
.vd-card .cost{display:block;font-weight:800;font-size:14px;border-radius:10px;padding:1px 0;background:#e9e4f2;color:#9b90b0}
.vd-card.can .cost{background:#2fb34a;color:#fff}
.vd-card.can{animation:vdbob 1s ease-in-out infinite}
.vd-card.can::after{content:'';position:absolute;top:-5px;right:-3px;width:14px;height:14px;border-radius:50%;background:#ff4d6d;border:2px solid #fff}
.vd-card:active{transform:translateY(3px)}
@keyframes vdbob{50%{transform:translateY(-4px)}}
.vd-card.max .cost{background:#ffd166;color:#7a5200}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const cashEl = H('<div class="vd-cash"><b>$</b><span>0</span></div>');
const rateEl = H('<div class="vd-rate"></div>');
const timeEl = H('<div class="vd-time">⏱ 45</div>');
const hypeEl = H('<div class="vd-hype"><span>HYPE</span><div class="bar"><i></i></div><span class="x">x1</span></div>');
const cardsEl = H('<div class="vd-cards"></div>');
const cards = CATS.map((c, i) => {
  const b = document.createElement('button'); b.className = 'vd-card';
  b.innerHTML = `<span class="ic">${c.icon}</span><span class="nm">${c.name}</span><span class="dots">${'<i></i>'.repeat(MAXT)}</span><span class="cost"></span>`;
  b.addEventListener('pointerdown', e => { e.stopPropagation(); buy(i); });
  cardsEl.appendChild(b); return b;
});
function refreshHUD() {
  cashEl.lastChild.textContent = fmt(cash); rateEl.textContent = passive() >= 1 ? '+' + fmt(passive()) + ' fans/s' : '';
  cards.forEach((b, i) => {
    const t = tiers[i], cost = costOf(i, t), maxed = false;
    b.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k < Math.min(t, MAXT)));
    b.querySelector('.cost').textContent = maxed ? 'MAX' : (t >= MAXT ? '+ ' : '') + '$' + fmt(cost);
    b.classList.toggle('can', state === 'play' && !maxed && cash >= cost);
    b.classList.toggle('max', maxed);
  });
}

// ---------------------------------------------------------------- room shell (dollhouse cut-away)
const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.02 });
const room = new THREE.Group(); scene.add(room);
const R = 3.4, WH = 3.6;
const floorTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d9a46c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#d19a60' : '#dfac75'; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(120,70,30,.25)'; g.fillRect(0, i * 32 + 31, w, 1.5); const off = (i * 97) % 256; g.fillRect(off, i * 32, 1.5, 32); g.fillRect((off + 128) % 256, i * 32, 1.5, 32); }
}, true);
floorTex.repeat.set(1.5, 1.5);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 });
const floor = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.4, R * 2), [mat('#b07a48'), mat('#b07a48'), floorMat, mat('#b07a48'), mat('#c08a58'), mat('#b07a48')]);
floor.position.y = -0.2; floor.receiveShadow = true; room.add(floor);
const wallTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
}, true);
wallTex.repeat.set(3, 1.5);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: '#b9b4ae', roughness: 0.9 });
const trimMat = mat('#ffffff');
const wallBack = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 0.3, WH, 0.3), wallMat); wallBack.position.set(-0.15, WH / 2, -R - 0.15); wallBack.receiveShadow = true; room.add(wallBack);
const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, WH, R * 2), wallMat); wallLeft.position.set(-R - 0.15, WH / 2, 0); wallLeft.receiveShadow = true; room.add(wallLeft);
const capB = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 0.34, 0.08, 0.34), trimMat); capB.position.set(-0.15, WH + 0.04, -R - 0.15); room.add(capB);
const capL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, R * 2), trimMat); capL.position.set(-R - 0.15, WH + 0.04, 0); room.add(capL);
const baseB = new THREE.Mesh(new THREE.BoxGeometry(R * 2, 0.22, 0.06), trimMat); baseB.position.set(0, 0.11, -R + 0.02); room.add(baseB);
const baseL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, R * 2), trimMat); baseL.position.set(-R + 0.02, 0.11, 0); room.add(baseL);
const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.08, depthWrite: false }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -0.41; shadowCatcher.scale.set(1, 0.9, 1); room.add(shadowCatcher);

// ---------------------------------------------------------------- props per tier (each tier = one Group, swaps with a pop)
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 16), sph = new THREE.SphereGeometry(1, 16, 12), cone = new THREE.ConeGeometry(1, 1, 16);
const M = (parts, shadow = true) => { const m = new THREE.Mesh(merge(parts), VC); m.castShadow = shadow; m.receiveShadow = true; return m; };
const glow = (geo, color, o = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, ...o })); return m; };
const screenTex = canvasTex(256, 160, () => {});
const screenCtx = screenTex.image.getContext('2d');
function drawScreen(views) {
  const g = screenCtx; g.fillStyle = '#1b1530'; g.fillRect(0, 0, 256, 160);
  const gr = g.createLinearGradient(0, 0, 256, 160); gr.addColorStop(0, '#7b5cff'); gr.addColorStop(1, '#ff5d8f'); g.fillStyle = gr; g.fillRect(10, 10, 236, 140);
  g.fillStyle = '#ff2d55'; g.beginPath(); g.roundRect(20, 20, 70, 30, 8); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText('● LIVE', 27, 42);
  g.font = 'bold 44px sans-serif'; g.fillText('👁 ' + fmt(views), 22, 112); screenTex.needsUpdate = true;
}
drawScreen(0);
const tierGroups = [[], [], [], []];
function tg(cat, t, build) { const g = new THREE.Group(); build(g); g.visible = false; room.add(g); tierGroups[cat][t] = g; return g; }
const tripod = (h, col = '#2b2d42') => [0, 1, 2].map(i => part(cyl, col, { x: Math.sin(i * 2.1) * h * 0.18, y: h / 2, z: Math.cos(i * 2.1) * h * 0.18, rx: Math.cos(i * 2.1) * 0.19, rz: -Math.sin(i * 2.1) * 0.19, sx: 0.03, sz: 0.03, sy: h }));
const CAM = { x: 2.15, z: 0.45 }, faceCam = Math.atan2(-0.55 - CAM.x, -0.75 - CAM.z) ;
// --- camera line
tg(0, 0, g => { const m = M([part(box, '#c9a77c', { y: 0.3, sx: 0.6, sy: 0.6, sz: 0.5 }), part(box, '#b3905f', { y: 0.62, sx: 0.62, sy: 0.04, sz: 0.52 }), part(box, '#1f1f2b', { y: 0.85, sx: 0.22, sy: 0.42, sz: 0.04 }), part(box, '#5a5f7a', { y: 0.85, z: 0.025, sx: 0.18, sy: 0.36, sz: 0.01 })]); g.add(m); g.position.set(CAM.x, 0, CAM.z); g.rotation.y = faceCam; });
tg(0, 1, g => { g.add(M([...tripod(0.9), part(box, '#1f1f2b', { y: 1.05, sx: 0.24, sy: 0.44, sz: 0.05 }), part(box, '#ff5d8f', { y: 1.05, z: -0.03, sx: 0.26, sy: 0.46, sz: 0.03 }), part(cyl, '#111', { y: 1.18, z: -0.05, rx: Math.PI / 2, sx: 0.04, sz: 0.04, sy: 0.02 })])); g.position.set(CAM.x, 0, CAM.z); g.rotation.y = faceCam; });
tg(0, 2, g => { g.add(M([...tripod(1.1), part(rounded(0.42, 0.3, 0.26, 0.05), '#2b2d42', { y: 1.3 }), part(cyl, '#3d4058', { y: 1.3, z: -0.2, rx: Math.PI / 2, sx: 0.1, sz: 0.1, sy: 0.18 }), part(cyl, '#8fd3ff', { y: 1.3, z: -0.3, rx: Math.PI / 2, sx: 0.08, sz: 0.08, sy: 0.01 }), part(box, '#ff3b3b', { x: 0.14, y: 1.48, z: 0, sx: 0.05, sy: 0.05, sz: 0.05 })])); g.position.set(CAM.x, 0, CAM.z); g.rotation.y = faceCam; });
tg(0, 3, g => { g.add(M([...tripod(1.25, '#444a66'), part(rounded(0.5, 0.36, 0.3, 0.06), '#1b1c26', { y: 1.45 }), part(cyl, '#2b2d42', { y: 1.45, z: -0.3, rx: Math.PI / 2, sx: 0.14, sz: 0.14, sy: 0.36 }), part(cyl, '#e63946', { y: 1.45, z: -0.42, rx: Math.PI / 2, sx: 0.15, sz: 0.15, sy: 0.03 }), part(cyl, '#7fd3ff', { y: 1.45, z: -0.49, rx: Math.PI / 2, sx: 0.11, sz: 0.11, sy: 0.01 }), part(box, '#30334a', { y: 1.66, sx: 0.18, sy: 0.08, sz: 0.14 })])); g.position.set(CAM.x, 0, CAM.z); g.rotation.y = faceCam; });
tg(0, 4, g => { g.add(M([part(cyl, '#30334a', { y: 0.05, sx: 0.5, sz: 0.5, sy: 0.1 }), part(cyl, '#555b7a', { y: 0.7, sx: 0.06, sz: 0.06, sy: 1.3 }), part(rounded(0.62, 0.46, 0.7, 0.06), '#e9e9ef', { y: 1.55 }), part(box, '#2b2d42', { y: 1.55, z: -0.42, sx: 0.5, sy: 0.4, sz: 0.2 }),
  part(cyl, '#1b1c26', { y: 1.55, z: -0.6, rx: Math.PI / 2, sx: 0.17, sz: 0.17, sy: 0.3 }), part(box, '#1b1c26', { y: 1.55, z: -0.8, sx: 0.56, sy: 0.44, sz: 0.06 }), part(box, '#7fd3ff', { y: 1.55, z: -0.83, sx: 0.3, sy: 0.3, sz: 0.01 }),
  part(cyl, '#30334a', { x: 0.42, y: 1.45, rz: Math.PI / 2, sx: 0.04, sz: 0.04, sy: 0.4 }), part(cyl, '#30334a', { x: -0.42, y: 1.45, rz: Math.PI / 2, sx: 0.04, sz: 0.04, sy: 0.4 }), part(sph, '#ff9f1c', { x: 0.62, y: 1.45, s: 0.07 }), part(sph, '#ff9f1c', { x: -0.62, y: 1.45, s: 0.07 }),
  part(box, '#2b2d42', { x: 0.36, y: 1.95, sx: 0.36, sy: 0.24, sz: 0.04, ry: -0.4 })])); { const led = glow(new THREE.SphereGeometry(0.05, 10, 8), '#ff2d2d'); led.position.set(0, 1.84, 0); g.add(led); } g.position.set(CAM.x, 0, CAM.z); g.rotation.y = faceCam; });
// --- lights line
let bulbLight;
tg(1, 0, g => { g.add(M([part(cyl, '#333', { y: WH - 0.5, sx: 0.01, sz: 0.01, sy: 1 })], false)); const b = glow(new THREE.SphereGeometry(0.11, 12, 10), '#fff2c4'); b.position.y = WH - 1.05; g.add(b); g.position.set(-0.3, 0, 0.2); });
tg(1, 1, g => { g.add(M([part(cyl, '#2b2d42', { y: 0.03, sx: 0.22, sz: 0.22, sy: 0.06 }), part(cyl, '#2b2d42', { y: 0.7, sx: 0.025, sz: 0.025, sy: 1.4 }), part(new THREE.CylinderGeometry(0.12, 0.3, 0.3, 16, 1, true), '#ffd166', { y: 1.45, rx: 0.5 })])); g.position.set(-1.5, 0, 1.6); });
tg(1, 2, g => { g.add(M([...tripod(1.25, '#30334a'), part(box, '#30334a', { y: 1.55, sx: 0.04, sy: 0.4, sz: 0.04 })])); const ring = glow(new THREE.TorusGeometry(0.42, 0.06, 10, 40), '#fffaf0'); ring.position.y = 1.85; g.add(ring); g.position.set(-0.2, 0, 1.75); g.rotation.y = Math.atan2(-0.55 + 0.2, -0.75 - 1.75); });
tg(1, 3, g => { for (const [x, z] of [[-1.7, 1.1], [1.9, -0.5]]) { const s = new THREE.Group(); s.add(M([...tripod(1.4, '#30334a'), part(box, '#2b2d42', { y: 1.85, sx: 0.8, sy: 0.6, sz: 0.3 })])); const f = glow(new THREE.PlaneGeometry(0.72, 0.52), '#fffaf0'); f.position.set(0, 1.85, -0.16); f.rotation.y = Math.PI; s.add(f); s.position.set(x, 0, z); s.rotation.y = Math.atan2(-0.55 - x, -0.75 - z) + Math.PI; s.lookAt(-0.55, 1.6, -0.75); s.rotation.y += Math.PI; g.add(s); } });
let ledMats = [];
tg(1, 4, g => {
  const cols = ['#ff3dc8', '#7b5cff', '#00e5ff'];
  const a = glow(new THREE.BoxGeometry(R * 2 - 0.2, 0.06, 0.06), cols[0]); a.position.set(0, WH - 0.12, -R + 0.08); g.add(a);
  const b = glow(new THREE.BoxGeometry(0.06, 0.06, R * 2 - 0.2), cols[1]); b.position.set(-R + 0.08, WH - 0.12, 0); g.add(b);
  const c = glow(new THREE.BoxGeometry(R * 2 - 0.2, 0.05, 0.05), cols[2]); c.position.set(0, 0.26, -R + 0.08); g.add(c);
  ledMats = [a.material, b.material, c.material];
  const p = new THREE.PointLight('#ff5dd8', 6, 6, 1.6); p.position.set(-1.5, 2.6, -1.8); g.add(p);
  // neon sign "LIVE" built from glowing capsules
  const n = new THREE.Group(); const nm = new THREE.MeshBasicMaterial({ color: '#ff4fd8' }); ledMats.push(nm);
  const seg = (x1, y1, x2, y2) => { const l = Math.hypot(x2 - x1, y2 - y1), m = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, l, 4, 6), nm); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); m.rotation.z = Math.atan2(x2 - x1, y2 - y1) * -1; n.add(m); };
  seg(0, 0, 0, 0.5); seg(0, 0, 0.25, 0); seg(0.42, 0, 0.42, 0.5); seg(0.6, 0.5, 0.72, 0); seg(0.72, 0, 0.84, 0.5); seg(1.0, 0, 1.0, 0.5); seg(1.0, 0.5, 1.22, 0.5); seg(1.0, 0.25, 1.18, 0.25); seg(1.0, 0, 1.22, 0);
  const board = new THREE.Mesh(rounded(1.6, 0.85, 0.06, 0.05), mat('#2b2140')); board.position.set(0.6, 0.25, -0.05); n.add(board);
  n.position.set(-0.15, 2.5, -R + 0.12); g.add(n);
});
// --- room line (decor)
tg(2, 0, g => {
  g.add(M([part(rounded(1.8, 0.25, 1.2, 0.1), '#d8d4ce', { x: 1.9, y: 0.13, z: -2.5 }), part(rounded(0.5, 0.14, 0.32, 0.06), '#f2efe9', { x: 1.4, y: 0.32, z: -2.5 }),
    part(box, '#c9a77c', { x: -2.6, y: 0.3, z: 2.4, sx: 0.7, sy: 0.6, sz: 0.6, ry: 0.3 }), part(box, '#bf9b6c', { x: -2.55, y: 0.85, z: 2.35, sx: 0.55, sy: 0.5, sz: 0.5, ry: -0.2 }), part(box, '#c9a77c', { x: -2.0, y: 0.25, z: 2.9, sx: 0.5, sy: 0.5, sz: 0.5 }),
    part(box, '#8a8f99', { x: -1.2, y: 1.9, z: -R + 0.02, sx: 0.45, sy: 0.35, sz: 0.02 }), part(cyl, '#7a7f8a', { x: 0.6, y: 0.06, z: 2.6, sx: 0.12, sz: 0.12, sy: 0.12 })]));
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: '#8f8a83', transparent: true, opacity: 0.35 })); stain.position.set(-R + 0.01, 2.8, -1.5); stain.rotation.y = Math.PI / 2; g.add(stain);
});
const posterTex = (a, b, txt) => canvasTex(128, 170, (g) => { const gr = g.createLinearGradient(0, 0, 128, 170); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 128, 170); g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.fillText(txt, 64, 108); });
const poster = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
const plant = (x, z, s = 1) => [part(cyl, '#e07a5f', { x, y: 0.22 * s, z, sx: 0.22 * s, sz: 0.22 * s, sy: 0.44 * s }), part(sph, '#3a9d5d', { x, y: 0.7 * s, z, s: 0.36 * s }), part(sph, '#4cb873', { x: x + 0.15 * s, y: 0.92 * s, z: z + 0.05, s: 0.24 * s }), part(sph, '#3a9d5d', { x: x - 0.14 * s, y: 0.95 * s, z: z - 0.05, s: 0.22 * s })];
tg(2, 1, g => {
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.03, 40), mat('#ff8fab')); rug.position.set(-0.4, 0.015, -0.5); rug.receiveShadow = true; g.add(rug);
  const rug2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 6, 40), mat('#ffffff')); rug2.rotation.x = Math.PI / 2; rug2.position.set(-0.4, 0.035, -0.5); g.add(rug2);
  g.add(M([part(rounded(1.8, 0.3, 1.2, 0.12), '#7b8cde', { x: 1.9, y: 0.15, z: -2.5 }), part(rounded(0.55, 0.16, 0.36, 0.07), '#ffffff', { x: 1.35, y: 0.38, z: -2.5 }), ...plant(-2.8, -2.8)]));
  const p = poster(posterTex('#ffd166', '#ff5d8f', '★'), 0.75, 1.0); p.position.set(-1.3, 2.0, -R + 0.02); g.add(p);
});
tg(2, 2, g => {
  const rug = new THREE.Mesh(rounded(2.6, 0.04, 2.2, 0.02), mat('#5ec2b7')); rug.position.set(-0.4, 0.02, -0.5); rug.receiveShadow = true; g.add(rug);
  g.add(M([part(rounded(0.9, 0.08, 2.0, 0.03), '#f4f1ec', { x: -2.85, y: 0.95, z: 0.9 }), part(box, '#e4e0da', { x: -2.85, y: 0.47, z: 0.05, sx: 0.8, sy: 0.94, sz: 0.06 }), part(box, '#e4e0da', { x: -2.85, y: 0.47, z: 1.75, sx: 0.8, sy: 0.94, sz: 0.06 }),
    part(box, '#2b2d42', { x: -2.95, y: 1.38, z: 0.9, sx: 0.06, sy: 0.6, sz: 1.0 }), part(box, '#2b2d42', { x: -2.9, y: 1.04, z: 0.9, sx: 0.2, sy: 0.08, sz: 0.25 }), part(box, '#e4e0da', { x: -2.6, y: 1.0, z: 0.9, sx: 0.25, sy: 0.03, sz: 0.6 }),
    part(rounded(0.7, 0.1, 0.7, 0.04), '#ff5d8f', { x: -2.1, y: 0.55, z: 0.9 }), part(rounded(0.12, 0.8, 0.7, 0.05), '#ff5d8f', { x: -1.75, y: 0.95, z: 0.9 }), part(cyl, '#2b2d42', { x: -2.1, y: 0.28, z: 0.9, sx: 0.04, sz: 0.04, sy: 0.5 }),
    part(box, '#f4f1ec', { x: 1.6, y: 2.2, z: -R + 0.15, sx: 1.4, sy: 0.06, sz: 0.3 }), part(box, '#ffd166', { x: 1.2, y: 2.38, z: -R + 0.15, sx: 0.15, sy: 0.3, sz: 0.22 }), part(box, '#7b5cff', { x: 1.38, y: 2.4, z: -R + 0.15, sx: 0.12, sy: 0.34, sz: 0.22 }), part(sph, '#3ab795', { x: 1.9, y: 2.36, z: -R + 0.15, s: 0.13 }),
    part(rounded(1.9, 0.32, 1.1, 0.14), '#7b8cde', { x: 1.9, y: 0.16, z: -2.6 }), part(rounded(1.9, 0.5, 0.2, 0.08), '#6a7bd0', { x: 1.9, y: 0.5, z: -3.1 }), ...plant(-2.85, -2.8, 1.2), ...plant(2.9, 2.6, 0.9)]));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), new THREE.MeshBasicMaterial({ map: screenTex })); scr.position.set(-2.91, 1.38, 0.9); scr.rotation.y = Math.PI / 2; g.add(scr);
  const p = poster(posterTex('#3a86ff', '#7b5cff', '▶'), 0.7, 0.95); p.position.set(-0.7, 2.2, -R + 0.02); g.add(p);
});
tg(2, 3, g => {
  const rug = new THREE.Mesh(rounded(3.0, 0.04, 2.6, 0.02), mat('#ffd6e0')); rug.position.set(-0.3, 0.02, -0.4); rug.receiveShadow = true; g.add(rug);
  g.add(M([part(rounded(0.9, 0.08, 2.2, 0.03), '#2b2d42', { x: -2.85, y: 0.95, z: 0.9 }), part(box, '#3d4058', { x: -2.85, y: 0.47, z: -0.1, sx: 0.8, sy: 0.94, sz: 0.06 }), part(box, '#3d4058', { x: -2.85, y: 0.47, z: 1.9, sx: 0.8, sy: 0.94, sz: 0.06 }),
    part(box, '#111', { x: -2.95, y: 1.45, z: 0.9, sx: 0.06, sy: 0.72, sz: 1.3 }), part(box, '#111', { x: -2.9, y: 1.04, z: 0.9, sx: 0.2, sy: 0.08, sz: 0.25 }),
    part(rounded(0.75, 0.12, 0.75, 0.05), '#2b2d42', { x: -2.1, y: 0.55, z: 0.9 }), part(rounded(0.14, 1.0, 0.7, 0.06), '#e63946', { x: -1.72, y: 1.05, z: 0.9 }), part(cyl, '#2b2d42', { x: -2.1, y: 0.28, z: 0.9, sx: 0.04, sz: 0.04, sy: 0.5 }),
    part(rounded(2.4, 0.45, 1.0, 0.16), '#ff8c42', { x: 1.6, y: 0.4, z: -2.75 }), part(rounded(2.4, 0.8, 0.3, 0.14), '#f07a30', { x: 1.6, y: 0.85, z: -3.15 }), part(rounded(0.3, 0.6, 1.0, 0.12), '#f07a30', { x: 0.45, y: 0.6, z: -2.75 }), part(rounded(0.3, 0.6, 1.0, 0.12), '#f07a30', { x: 2.75, y: 0.6, z: -2.75 }),
    part(rounded(0.45, 0.4, 0.15, 0.1), '#ffd166', { x: 1.1, y: 0.9, z: -2.9, rx: -0.2 }), part(rounded(0.45, 0.4, 0.15, 0.1), '#3ab795', { x: 2.1, y: 0.9, z: -2.9, rx: -0.2 }),
    part(box, '#ffffff', { x: -0.6, y: 1.2, z: -R + 0.2, sx: 0.9, sy: 2.4, sz: 0.4 }), ...[0.5, 1.1, 1.7].map(y => part(box, '#e8e2da', { x: -0.6, y, z: -R + 0.25, sx: 0.82, sy: 0.04, sz: 0.36 })),
    part(box, '#3a86ff', { x: -0.8, y: 0.7, z: -R + 0.25, sx: 0.12, sy: 0.36, sz: 0.25 }), part(box, '#ff5d8f', { x: -0.62, y: 0.68, z: -R + 0.25, sx: 0.1, sy: 0.32, sz: 0.25 }), part(sph, '#ffd166', { x: -0.4, y: 1.3, z: -R + 0.25, s: 0.13 }), part(box, '#7b5cff', { x: -0.7, y: 1.88, z: -R + 0.25, sx: 0.3, sy: 0.3, sz: 0.2 }),
    ...plant(-2.85, -2.85, 1.4), ...plant(2.9, 2.6, 1.1)]));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.66), new THREE.MeshBasicMaterial({ map: screenTex })); scr.position.set(-2.91, 1.45, 0.9); scr.rotation.y = Math.PI / 2; g.add(scr);
  // window with a city view
  const win = canvasTex(160, 128, (c) => { const gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#7ec8ff'); gr.addColorStop(1, '#ffd6e8'); c.fillStyle = gr; c.fillRect(0, 0, 160, 128); c.fillStyle = '#9aa8d8'; for (let i = 0; i < 9; i++) c.fillRect(i * 18, 128 - 30 - (i * 37 % 50), 15, 80); });
  const wv = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshBasicMaterial({ map: win })); wv.position.set(-R + 0.02, 2.2, -1.6); wv.rotation.y = Math.PI / 2; g.add(wv);
  g.add(M([part(box, '#ffffff', { x: -R + 0.05, y: 2.82, z: -1.6, sx: 0.08, sy: 0.08, sz: 1.62 }), part(box, '#ffffff', { x: -R + 0.05, y: 1.58, z: -1.6, sx: 0.12, sy: 0.08, sz: 1.7 }), part(box, '#ffffff', { x: -R + 0.05, y: 2.2, z: -2.4, sx: 0.08, sy: 1.3, sz: 0.08 }), part(box, '#ffffff', { x: -R + 0.05, y: 2.2, z: -0.8, sx: 0.08, sy: 1.3, sz: 0.08 }), part(box, '#ffffff', { x: -R + 0.05, y: 2.2, z: -1.6, sx: 0.05, sy: 1.2, sz: 0.04 })], false));
});
tg(2, 4, g => {
  const rug = new THREE.Mesh(rounded(3.2, 0.04, 2.8, 0.02), mat('#c8b6ff')); rug.position.set(-0.3, 0.02, -0.4); rug.receiveShadow = true; g.add(rug);
  g.add(M([part(rounded(1.0, 0.08, 2.4, 0.03), '#ffffff', { x: -2.8, y: 0.95, z: 0.9 }), part(box, '#e4e0da', { x: -2.8, y: 0.47, z: -0.2, sx: 0.9, sy: 0.94, sz: 0.06 }), part(box, '#e4e0da', { x: -2.8, y: 0.47, z: 2.0, sx: 0.9, sy: 0.94, sz: 0.06 }),
    part(box, '#111', { x: -2.95, y: 1.5, z: 0.4, sx: 0.06, sy: 0.6, sz: 0.95 }), part(box, '#111', { x: -2.95, y: 1.5, z: 1.4, sx: 0.06, sy: 0.6, sz: 0.95, ry: 0.3 }),
    part(rounded(0.8, 0.14, 0.8, 0.06), '#ffffff', { x: -2.0, y: 0.58, z: 0.9 }), part(rounded(0.16, 1.1, 0.75, 0.07), '#7b5cff', { x: -1.62, y: 1.1, z: 0.9 }), part(cyl, '#c9c9d6', { x: -2.0, y: 0.3, z: 0.9, sx: 0.05, sz: 0.05, sy: 0.5 }),
    part(rounded(2.6, 0.5, 1.1, 0.18), '#ffffff', { x: 1.5, y: 0.42, z: -2.7 }), part(rounded(2.6, 0.9, 0.32, 0.16), '#f3eefc', { x: 1.5, y: 0.9, z: -3.12 }), part(rounded(0.34, 0.66, 1.1, 0.14), '#f3eefc', { x: 0.25, y: 0.62, z: -2.7 }), part(rounded(0.34, 0.66, 1.1, 0.14), '#f3eefc', { x: 2.75, y: 0.62, z: -2.7 }),
    part(rounded(0.45, 0.42, 0.16, 0.1), '#ff5d8f', { x: 0.9, y: 0.95, z: -2.9, rx: -0.2 }), part(rounded(0.45, 0.42, 0.16, 0.1), '#7b5cff', { x: 1.5, y: 0.95, z: -2.9, rx: -0.2 }), part(rounded(0.45, 0.42, 0.16, 0.1), '#ffd166', { x: 2.1, y: 0.95, z: -2.9, rx: -0.2 }),
    ...[[-2.5, 2.6], [-2.0, 2.95], [-2.0, 2.25], [-1.5, 2.6], [-1.0, 2.95], [-1.0, 2.25]].map(([z, y], i) => part(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 6), ['#7b5cff', '#ff5d8f', '#3a86ff'][i % 3], { x: -R + 0.06, y, z, rz: Math.PI / 2, ry: 0 })),
    part(sph, '#9b8cff', { x: 2.5, y: 0.35, z: 1.7, sx: 0.65, sy: 0.4, sz: 0.65 }), part(sph, '#8a7af0', { x: 2.55, y: 0.6, z: 1.95, sx: 0.5, sy: 0.35, sz: 0.3 }),
    ...plant(-2.85, -2.85, 1.5), ...plant(2.9, 2.75, 1.2)]));
  const plaque = new THREE.Mesh(rounded(0.75, 0.95, 0.06, 0.05), glossy('#ffc83d', { metalness: 0.7, roughness: 0.2, emissive: '#7a5200', emissiveIntensity: 0.25 })); plaque.position.set(-1.4, 2.1, -R + 0.05); g.add(plaque);
  const play = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), mat('#ffffff')); play.position.set(-1.4, 2.1, -R + 0.09); play.rotation.z = 0; g.add(play);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.52), new THREE.MeshBasicMaterial({ map: screenTex })); scr.position.set(-2.91, 1.5, 0.4); scr.rotation.y = Math.PI / 2; g.add(scr);
});
// --- gear line: headphones / desk mic / boom mic / drip (attached to the creator or desk)
const GEARS = [];
tg(3, 0, () => {});
tg(3, 1, g => { g.add(M([part(rounded(0.4, 0.06, 0.3, 0.02), '#2b2d42', { x: 1.7, y: 0.03, z: 0.2 })])); });
tg(3, 2, g => { g.add(M([part(cyl, '#2b2d42', { x: -0.3, y: 0.03, z: 0.65, sx: 0.2, sz: 0.2, sy: 0.06 }), part(cyl, '#2b2d42', { x: -0.3, y: 0.7, z: 0.65, sx: 0.025, sz: 0.025, sy: 1.35 }), part(new THREE.CapsuleGeometry(0.09, 0.18, 4, 10), '#3d4058', { x: -0.3, y: 1.45, z: 0.65 }), part(sph, '#7b5cff', { x: -0.3, y: 1.6, z: 0.65, s: 0.095 })])); });
const rod = (a, b, r, color) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), e = new THREE.Euler().setFromQuaternion(q); const m = A.clone().add(B).multiplyScalar(0.5); return part(cyl, color, { x: m.x, y: m.y, z: m.z, rx: e.x, ry: e.y, rz: e.z, sx: r, sz: r, sy: d.length() }); };
const boom = (metal, head) => [part(cyl, '#2b2d42', { x: 0.75, y: 0.03, z: -0.2, sx: 0.24, sz: 0.24, sy: 0.06 }), rod([0.75, 0, -0.2], [0.75, 1.95, -0.2], 0.03, metal), rod([0.75, 1.95, -0.2], [0.05, 2.15, -0.75], 0.025, metal), rod([0.05, 2.15, -0.75], [0.0, 2.0, -0.62], 0.02, metal),
  part(new THREE.CapsuleGeometry(0.1, 0.22, 4, 12), head, { x: 0.0, y: 1.92, z: -0.58, rx: 0.5, rz: -0.3 })];
tg(3, 3, g => { g.add(M(boom('#2b2d42', '#e9e9ef'))); });
tg(3, 4, g => { g.add(M([...boom('#ffc83d', '#ffc83d'), part(rounded(0.9, 0.12, 0.5, 0.04), '#ffffff', { x: 2.4, y: 0.06, z: -1.2 }), part(rounded(0.7, 0.08, 0.35, 0.03), '#ffffff', { x: 2.4, y: 0.17, z: -1.2, ry: 0.2 })])); });

// ---------------------------------------------------------------- the creator ("Kai": chunky toy figure, original design)
const kai = new THREE.Group(); kai.position.set(-0.55, 0, -0.75); kai.rotation.y = Math.PI / 4 - 0.05; kai.scale.setScalar(1.22); room.add(kai);
const hoodie = mat('#7b5cff'), jeans = mat('#3d5a80'), skin = mat('#d39a6a'), hairM = mat('#2b1d14'), white = mat('#ffffff');
const hips = new THREE.Group(); hips.position.y = 0.72; kai.add(hips);
const torso = new THREE.Group(); hips.add(torso);
const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 6, 16), hoodie); bodyM.position.y = 0.38; bodyM.scale.set(1, 1, 0.82); bodyM.castShadow = true; torso.add(bodyM);
const pocket = new THREE.Mesh(rounded(0.36, 0.16, 0.06, 0.03), mat('#6a4be8')); pocket.position.set(0, 0.24, 0.27); torso.add(pocket);
const hood = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 8, 20), mat('#6a4be8')); hood.position.set(0, 0.78, -0.05); hood.rotation.x = Math.PI / 2 + 0.3; torso.add(hood);
const chain = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 24), glossy('#ffc83d', { metalness: 0.8, roughness: 0.2 })); chain.position.set(0, 0.68, 0.12); chain.rotation.x = Math.PI / 2 - 0.5; torso.add(chain);
const headG = new THREE.Group(); headG.position.y = 1.08; torso.add(headG);
const headM = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 20), skin); headM.castShadow = true; headG.add(headM);
for (const s of [-1, 1]) {
  const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skin); ear.position.set(s * 0.35, 0, 0); headG.add(ear);
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), white); eyeW.position.set(s * 0.13, 0.04, 0.3); eyeW.scale.z = 0.6; headG.add(eyeW);
  const pup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#1d1d28')); pup.position.set(s * 0.13, 0.04, 0.355); headG.add(pup);
  const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 3, 6), hairM); brow.position.set(s * 0.13, 0.16, 0.31); brow.rotation.z = Math.PI / 2 + s * 0.15; headG.add(brow);
}
const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 16, Math.PI), mat('#7a2e2e')); mouth.position.set(0, -0.1, 0.33); mouth.rotation.z = Math.PI; headG.add(mouth);
const hairG = new THREE.Group(); headG.add(hairG);
[[0, 0.3, 0.05, 0.22], [0.15, 0.27, 0.12, 0.17], [-0.15, 0.27, 0.12, 0.17], [0.05, 0.3, 0.22, 0.15], [-0.2, 0.2, -0.05, 0.18], [0.2, 0.2, -0.05, 0.18], [0, 0.22, -0.18, 0.22], [0.1, 0.4, 0.0, 0.13]].forEach(([x, y, z, r]) => { const h = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), hairM); h.position.set(x, y, z); h.castShadow = true; hairG.add(h); });
const phones = new THREE.Group(); phones.visible = false; headG.add(phones);
{ const band = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.035, 6, 24, Math.PI), mat('#2b2d42')); band.position.y = 0.02; phones.add(band);
  for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), mat('#ff5d8f')); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.39, 0, 0); phones.add(cup); } }
const shades = new THREE.Group(); shades.visible = false; headG.add(shades);
{ const sm = glossy('#111', { roughness: 0.1 }); for (const s of [-1, 1]) { const l = new THREE.Mesh(rounded(0.2, 0.12, 0.04, 0.03), sm); l.position.set(s * 0.13, 0.05, 0.36); shades.add(l); } const br = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.02), sm); br.position.set(0, 0.08, 0.37); shades.add(br); }
const arms = [];
for (const s of [-1, 1]) {
  const sh = new THREE.Group(); sh.position.set(s * 0.4, 0.66, 0); torso.add(sh);
  const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.36, 4, 10), hoodie); up.position.y = -0.24; up.castShadow = true; sh.add(up);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), skin); hand.position.y = -0.5; sh.add(hand);
  sh.rotation.z = s * 0.18; arms.push(sh);
}
const legs = [];
for (const s of [-1, 1]) {
  const hp = new THREE.Group(); hp.position.set(s * 0.16, 0, 0); hips.add(hp);
  const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.38, 4, 10), jeans); l.position.y = -0.3; l.castShadow = true; hp.add(l);
  const shoe = new THREE.Mesh(rounded(0.24, 0.14, 0.36, 0.06), white); shoe.position.set(0, -0.65, 0.05); shoe.castShadow = true; hp.add(shoe);
  legs.push(hp);
}
// handheld phone for tier 0 "vlog" feel is on the box; Kai always looks at the camera

// ---------------------------------------------------------------- reactions: emoji sprites floating up
const emojiTex = {};
const eTex = e => emojiTex[e] || (emojiTex[e] = canvasTex(96, 96, g => { g.font = '76px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 54); }));
const sprites = [];
for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: eTex('❤️'), transparent: true, depthWrite: false })); s.visible = false; room.add(s); sprites.push({ s, life: 0, v: new THREE.Vector3() }); }
let spI = 0;
function emote(e, from, n = 1) {
  for (let k = 0; k < n; k++) {
    const q = sprites[spI++ % sprites.length]; q.s.material.map = eTex(e); q.s.material.needsUpdate = true;
    q.s.position.copy(from).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.3, (Math.random() - 0.5) * 0.8));
    q.v.set((Math.random() - 0.5) * 0.01, 0.025 + Math.random() * 0.015, (Math.random() - 0.5) * 0.01); q.life = 1; q.s.visible = true; q.s.scale.setScalar(0.1);
  }
}

// ---------------------------------------------------------------- apply tiers (visual), with pop-in animation
const pops = [];
function applyTiers(animCat = -1) {
  for (let c = 0; c < 4; c++) {
    const show = Math.min(tiers[c], MAXT);
    tierGroups[c].forEach((g, t) => {
      const vis = c === 3 ? t === show : t === show;
      if (vis && !g.visible && c === animCat) { g.scale.setScalar(0.01); pops.push({ g, t: 0 }); }
      g.visible = vis;
    });
  }
  const rt = Math.min(tiers[2], MAXT), lt = Math.min(tiers[1], MAXT), gt = Math.min(tiers[3], MAXT);
  const P = PALETTES[(level - 1) % PALETTES.length];
  const wallCols = ['#b9b4ae', '#ffe3ea', P.bg[0], '#d7f0ff', '#efe6ff'];
  wallMat.color.set(rt === 0 ? '#b9b4ae' : rt === 2 ? new THREE.Color(P.bg[0]).lerp(new THREE.Color('#ffffff'), 0.25) : wallCols[rt]);
  hemi.intensity = [0.75, 0.95, 1.1, 1.2, 1.15][lt]; sun.intensity = [1.15, 1.45, 1.65, 1.8, 1.7][lt];
  hemi.color.set(lt >= 4 ? '#ffe6fb' : '#ffffff');
  phones.visible = gt >= 1; shades.visible = gt >= 4; chain.visible = gt >= 4;
  hoodie.color.set(['#8d99ae', '#7b5cff', '#ff5d8f', '#3a86ff', '#111827'][gt]);
  pocket.material.color.copy(hoodie.color).multiplyScalar(0.85); hood.material.color.copy(hoodie.color).multiplyScalar(0.85);
}

// ---------------------------------------------------------------- tap = film content
let pose = 0, poseT = 1, kaiJump = 0, squash = 0, camFlash = 0, lastTapT = 0;
const camLook = new THREE.Vector3(0, 1.0, 0);
function film() {
  if (state !== 'play') return;
  const m = hypeMult(), f = perTap() * m;
  gained += f; total += f; cash += f * CASH;
  hype = Math.min(1, hype + 0.07 * fk / AK());
  if (hype >= 1 && viralT <= 0) { goViral(); AD.good(2); }
  pose = Math.floor(Math.random() * 4); poseT = 0; squash = 1; camFlash = 1;
  ui.pop('+' + fmt(f), m >= 4 ? '#ffd166' : '#ffffff', 28 + m * 3, 30 + Math.random() * 6);
  tone(500 + Math.min(m, 5) * 80 + Math.random() * 40, 0.05, 'triangle', 0.1, 1.3); if (m >= 3) note(72 + m * 2, 0.15, 0.06);
  buzz(6);
  emote(['❤️', '👍', '🔥', '😂', '⭐', '💯'][Math.floor(Math.random() * (m >= 3 ? 6 : 4))], new THREE.Vector3(kai.position.x, 2.0, kai.position.z), m >= 4 ? 2 : 1);
  lastTapT = performance.now(); taps.push(lastTapT);
  refreshHUD();
}
function goViral() {
  viralT = 4; ui.pop('GOING VIRAL!', '#ffd166', 46, 40); sfx.win(); buzz([20, 30, 20]); ui.flash(0.4);
  confetti(scene, new THREE.Vector3(kai.position.x, 2.4, kai.position.z), 50);
  hypeEl.classList.add('viral');
}
function buy(i) {
  if (state !== 'play') return;
  const t = tiers[i], cost = costOf(i, t);
    if (cash < cost) { cards[i].animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 180 }); tone(180, 0.1, 'square', 0.06); return; }
  cash -= cost; tiers[i]++; save.set('tiers', tiers); save.set('cash', Math.floor(cash));
  applyTiers(i);
  const g = tierGroups[i][Math.min(tiers[i], MAXT)];
  const at = g ? new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()) : kai.position.clone().setY(1.5);
  if (!isFinite(at.x)) at.copy(kai.position).setY(1.5);
  burst(scene, at, ['#ffd166', '#ff5d8f', '#7b5cff', '#ffffff'], 26, { speed: 0.09, up: 0.1, size: 0.6 });
  sfx.coin(); setTimeout(() => sfx.pick(5), 90); buzz(18);
  ui.pop(tiers[i] <= MAXT ? `${CATS[i].name.toUpperCase()} UP!` : `${CATS[i].name.toUpperCase()} +${tiers[i] - MAXT}`, '#ffffff', 36, 40);
  emote('✨', at, 3);
  refreshHUD();
}
input({ onDown: () => film() });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s of a still screen): on level 1, until the
// first real touch, Kai films a quick burst of six clips by himself, so the +follower pops and the HYPE bar show what a tap does
demo(() => film(), { ready: () => state === 'play' && level === 1 && gained < 60, wait: 1800, every: 300, max: 6 });

// ---------------------------------------------------------------- level flow
function startLevel() {
  fk = F.k(); AD.round(); paceT = 0; lastM = 1; saved = false; gained = 0; timeLeft = timeOf(level) / fk; hype = 0; viralT = 0;
  const P = PALETTES[(level - 1) % PALETTES.length];
  document.body.style.setProperty('--bg1', P.bg[0]); document.body.style.setProperty('--bg2', P.bg[1]); document.body.style.setProperty('--ui', P.ui);
  ui.levels(level); ui.progress(0); ui.sub(`followers · goal ${fmt(goalOf(level))}`); ui.score(fmt(total));
  applyTiers(); refreshHUD();
}
function win() {
  if (state !== 'play') return;
  state = 'won'; F.level(true); WB.submit(1); save.set('level', level + 1); save.set('cash', Math.floor(cash)); save.set('total', Math.floor(total));
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3(kai.position.x, 2.6, kai.position.z), 60), i * 160);
  emote('🏆', new THREE.Vector3(kai.position.x, 2.4, kai.position.z), 3);
  ui.win(level, `🎉 ${fmt(goalOf(level))} new followers!`);
  refreshHUD();
}
function lose() {
  if (state !== 'play') return;
  if (tapping()) AD.bad(2);
  state = 'lost'; F.level(false, gained / goalOf(level)); sfx.fail(); buzz([40, 30, 60]);
  save.set('cash', Math.floor(cash)); save.set('total', Math.floor(total));
  ui.lose('TREND OVER', `${Math.round(gained / goalOf(level) * 100)}% of the goal · upgrade your gear!`);
  refreshHUD();
}
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; startLevel(); }
  else if (w === 'win') { level++; state = 'play'; startLevel(); }
  else if (w === 'lose') { state = 'play'; startLevel(); }
});

// ---------------------------------------------------------------- camera framing (fits the diorama to any aspect)
function frame() {
  const a = camera.aspect, dist = a < 0.7 ? 27 : 21;
  camera.fov = a < 0.7 ? 34 : 30; camera.updateProjectionMatrix();
  const dir = new THREE.Vector3(1, 0.86, 1).normalize();
  camera.position.copy(dir.multiplyScalar(dist)).add(new THREE.Vector3(-0.6, a < 0.7 ? -0.6 : 0.2, -0.6));
  camera.lookAt(-0.6, a < 0.7 ? 0.45 : 1.0, -0.6);
}
addEventListener('resize', frame);

// ---------------------------------------------------------------- loop
let screenAcc = 0, wasLow = false;
loop((dt, t) => {
  const sec = dt / 60;
  frame();
  if (state === 'play') {
    timeLeft -= sec;
    const p = passive() * sec * (viralT > 0 ? 2 : 1);
    if (p > 0) { gained += p; total += p; cash += p * CASH; passAcc += sec; if (passAcc > 0.5) { passAcc = 0; refreshHUD(); } }
    hype = Math.max(0, hype - sec * (viralT > 0 ? 0 : (0.28 - Math.min(tiers[3], MAXT) * 0.03) * AK()));
    const hm = hypeMult(); if (tapping()) { if (hm > lastM && hm < 5) AD.good(); else if (hm === 1 && lastM > 1) AD.bad(); } lastM = hm;
    paceT += sec; if (paceT > 3 && tapping()) { paceT = 0; const t0 = timeOf(level) / fk, pace = gained / goalOf(level) - (t0 - timeLeft) / t0; pace > 0.05 ? AD.good() : pace < -0.08 ? AD.bad() : 0; }
    AD.tick(tapping());
    // rescue: a near-miss with the clock almost out, for a player who has kept the hype going
    if (!saved && viralT <= 0 && timeLeft < 5 && timeLeft > 1.5 && performance.now() - lastTapT < 600 && steady()) {
      const g = goalOf(level), rate = gained / Math.max(1, timeOf(level) / fk - timeLeft), lift = rate * timeLeft * 5 / hm;   // only when going viral can still tip it
      if (gained + rate * timeLeft < g && gained + lift >= g && AD.rescue()) { saved = true; goViral(); ui.pop('A FAN REPOSTED YOU! 🍀', '#7dffb0', 34, 52); }
    }
    if (viralT > 0) { viralT -= sec; hype = viralT / 4; if (viralT <= 0) { hype = 0.3; hypeEl.classList.remove('viral'); } }
    ui.progress(gained / goalOf(level)); ui.score(fmt(total));
    const low = timeLeft < 8; timeEl.classList.toggle('low', low); if (low && !wasLow) tone(880, 0.08, 'square', 0.06); wasLow = low;
    timeEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft));
    if (gained >= goalOf(level)) win();
    else if (timeLeft <= 0) lose();
  } else { timeEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft)); }
  hypeEl.style.visibility = state === 'play' ? 'visible' : 'hidden';
  hypeEl.querySelector('i').style.width = (hype * 100) + '%';
  hypeEl.querySelector('.x').textContent = 'x' + hypeMult();
  screenAcc += sec; if (screenAcc > 0.4) { screenAcc = 0; drawScreen(total * 7.3); }
  // Kai animation
  poseT = Math.min(1, poseT + sec * 2.6); squash = Math.max(0, squash - sec * 5);
  const idle = Math.sin(t * 2.4), e = 1 - poseT, k = Math.sin(poseT * Math.PI);
  hips.position.y = 0.72 + Math.abs(Math.sin(t * 2.4)) * 0.02 + (pose === 1 ? k * 0.45 : 0);
  kai.scale.set(1.22 * (1 + squash * 0.1), 1.22 * (1 - squash * 0.12), 1.22 * (1 + squash * 0.1));
  torso.rotation.z = pose === 2 ? Math.sin(poseT * Math.PI * 4) * 0.22 * e : idle * 0.03;
  torso.rotation.x = pose === 3 ? k * 0.25 : 0;
  hips.rotation.y = pose === 1 ? poseT * Math.PI * 2 : 0;
  arms[1].rotation.z = -(pose === 0 ? 2.6 + Math.sin(poseT * 25) * 0.3 * e : pose === 2 ? 1.8 + Math.sin(poseT * 12) * 0.6 : pose === 1 ? 2.4 * k + 0.18 : 0.18 + idle * 0.04);
  arms[0].rotation.z = pose === 2 ? 1.8 - Math.sin(poseT * 12) * 0.6 : pose === 1 ? 2.4 * k + 0.18 : 0.18 - idle * 0.04;
  arms[1].rotation.x = pose === 3 ? -1.4 * k : 0; arms[0].rotation.x = pose === 3 ? -0.3 * k : 0;
  legs[0].rotation.x = pose === 2 ? Math.sin(poseT * 12) * 0.4 * e : 0; legs[1].rotation.x = -legs[0].rotation.x;
  headG.rotation.z = pose === 2 ? Math.sin(poseT * 12) * 0.15 : idle * 0.04; headG.rotation.x = Math.sin(t * 6) * 0.03;
  mouth.scale.set(1, 1 + (state === 'play' && performance.now() - lastTapT < 400 ? 0.6 : 0), 1);
  // recording LED / flash, LED strip colour cycle, pop-ins
  camFlash = Math.max(0, camFlash - sec * 4);
  ledMats.forEach((m, i) => m.color.setHSL(((t * 0.15 + i * 0.22) % 1), 0.9, 0.62));
  for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t = Math.min(1, p.t + sec * 2.2); const x = p.t - 1, s = 1 + 2.70158 * x * x * x + 1.70158 * x * x; p.g.scale.setScalar(Math.max(0.01, s)); if (p.t >= 1) pops.splice(i, 1); }
  for (const q of sprites) { if (q.life <= 0) continue; q.life -= sec * 0.8; q.s.position.add(q.v); q.s.material.opacity = Math.min(1, q.life * 2); q.s.scale.setScalar(Math.min(0.8, 0.8 * (1 - q.life) * 5)); if (q.life <= 0) q.s.visible = false; }
  room.rotation.y = Math.sin(t * 0.3) * 0.02;
});

frame(); applyTiers(); refreshHUD(); startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.floor(total); },
  get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; },
  bot() {
    if (state !== 'play') return;
    let best = -1, bc = Infinity;
    tiers.forEach((t, i) => { const c = costOf(i, t); if (c <= cash && c < bc) { bc = c; best = i; } });
    if (best >= 0 && Math.random() < 0.8) return buy(best);
    film();
  },
};

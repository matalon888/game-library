// Pearl Tide: Slots Casino — original 5×3 undersea slot. Free play chips only, fixed published odds.
// Every reel stop is drawn with crypto.getRandomValues, uniformly over the reel's 32 printed stops. No per-player odds,
// no near-miss logic, no anticipation slow-downs. RTP is computed exactly from the strips + paytable in math.js.
import { THREE, createStage, createUI, loop, glossy, mat, rounded, confetti, burst, tone, note, buzz, store, lerp, clamp } from './kit/hc.js';
import { daily } from './kit/daily.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import * as M from './math.js';
import { drawSymbol, smear, logoCanvas, markerCanvas, vignetteCanvas, glowCanvas, raysCanvas, frameCanvas } from './art.js';

const NAME = 'Pearl Tide: Slots Casino', FONT = "'Baloo 2', system-ui, sans-serif";
const ui = createUI({ title: 'PEARL<br>TIDE', hint: 'Tap SPIN to play', hand: '👆', score: true });
const D = daily('pearltide', ui, { name: NAME });
const S = store('pearltide');
const RTP = M.computeRTP();

// ---------------------------------------------------------------- fair randomness (unbiased integer in [0,n))
function rint(n) { const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------- page styles + DOM HUD
const css = document.createElement('style');
css.textContent = `
.hc-score{display:flex;align-items:center;justify-content:center;gap:10px;font-size:44px}
.hc-score::before{content:'';width:32px;height:32px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7c2,#ffd23f 45%,#ff9f1c);box-shadow:0 0 0 4px #fff inset,0 3px 0 rgba(0,0,0,.15);flex:none}
.hc-sub{top:calc(100px + env(safe-area-inset-top));font-size:15px;letter-spacing:.06em}
.pt-foot{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));font-size:14px;font-weight:600;opacity:.8;text-shadow:0 1px 0 rgba(0,0,0,.15)}
.pt-start{background:linear-gradient(rgba(45,28,120,.72),rgba(45,28,120,.45) 60%,rgba(45,28,120,.2));backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.pt-info{position:fixed;left:0;right:0;bottom:calc(132px + env(safe-area-inset-bottom));text-align:center;z-index:6;pointer-events:none;font-weight:600;font-size:14px;opacity:.9;text-shadow:0 1px 0 rgba(0,0,0,.18)}
.pt-tag{font-size:19px!important;letter-spacing:.14em;opacity:.95}
.pt-bar{position:fixed;left:12px;right:12px;bottom:calc(18px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-between;gap:8px;z-index:7}
.pt-odds{pointer-events:auto;font:inherit;font-weight:800;font-size:14px;color:#3d2c8d;background:rgba(255,255,255,.9);border:0;border-radius:22px;padding:8px 14px;box-shadow:0 4px 0 rgba(0,0,0,.14);cursor:pointer}
.pt-bet{display:flex;align-items:center;gap:6px;background:rgba(43,33,104,.55);border-radius:40px;padding:6px;backdrop-filter:blur(6px)}
.pt-bet button{pointer-events:auto;width:40px;height:40px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:26px;line-height:1;color:#3d2c8d;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.18);cursor:pointer}
.pt-bet button:disabled{opacity:.4}
.pt-bet .v{min-width:64px;text-align:center;line-height:1}
.pt-bet .v small{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;opacity:.8}
.pt-bet .v b{font-size:24px}
.pt-spin{pointer-events:auto;width:100px;height:100px;border-radius:50%;border:6px solid #fff;font:inherit;font-weight:800;font-size:25px;color:#fff;cursor:pointer;
  background:radial-gradient(circle at 40% 30%,#ffb3d1,#ff4f9a 55%,#c2185b);box-shadow:0 7px 0 rgba(90,10,60,.35),0 0 0 6px rgba(255,79,154,.25);text-shadow:0 2px 0 rgba(0,0,0,.2);transition:transform .08s}
.pt-spin:active,.pt-spin.down{transform:translateY(4px) scale(.97);box-shadow:0 3px 0 rgba(90,10,60,.35)}
.pt-spin.busy{filter:saturate(.6) brightness(.95)}
.pt-spin.fs{background:radial-gradient(circle at 40% 30%,#fff3a6,#ffb703 55%,#e85d04);font-size:19px;line-height:1.05}
.pt-win{position:fixed;left:0;right:0;top:500px;height:44px;line-height:44px;text-align:center;z-index:6;pointer-events:none;font-weight:800;font-size:22px;text-shadow:0 3px 0 rgba(0,0,0,.18);transition:transform .15s}
.pt-win b{color:#fff3a6;font-size:34px}
.pt-win.pump{transform:scale(1.18)}
.pt-fs{position:fixed;top:calc(128px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;background:linear-gradient(#ffd23f,#ff9f1c);color:#fff;font-weight:800;font-size:16px;padding:3px 16px;border-radius:20px;box-shadow:0 3px 0 rgba(0,0,0,.18);text-shadow:0 2px 0 rgba(0,0,0,.2);white-space:nowrap}
.pt-big{position:fixed;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(50,15,100,.6),rgba(20,8,50,.8));pointer-events:auto}
.pt-big .rays{position:absolute;width:160vmax;height:160vmax;left:50%;top:44%;margin:-80vmax 0 0 -80vmax;background:repeating-conic-gradient(rgba(255,230,140,.09) 0 9deg,transparent 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 20%,transparent 60%);mask:radial-gradient(circle,#000 20%,transparent 60%);animation:ptspin 9s linear infinite;pointer-events:none}
@keyframes ptspin{to{transform:rotate(360deg)}}
.pt-big h2{position:relative;margin:0;font-size:clamp(54px,17vw,96px);line-height:.92;font-weight:800;text-align:center;color:#ffe066;text-shadow:0 3px 0 #ff9f1c,0 6px 0 #e85d04,0 11px 0 rgba(60,10,70,.45),0 0 40px rgba(255,210,80,.7);animation:ptbig .5s cubic-bezier(.2,1.6,.4,1)}
.pt-big .n{position:relative;font-size:56px;font-weight:800;margin-top:10px;text-shadow:0 5px 0 rgba(0,0,0,.25)}
.pt-big p{position:relative;margin:6px 0 0;font-size:18px;font-weight:600;opacity:.85}
@keyframes ptbig{0%{transform:scale(.2) rotate(-8deg)}100%{transform:scale(1)}}
.pt-panel{position:fixed;inset:0;z-index:20;background:rgba(25,15,60,.55);display:flex;align-items:flex-end;justify-content:center;pointer-events:auto}
.pt-sheet{width:min(520px,100%);max-height:86vh;overflow-y:auto;background:#fff;color:#2b2d42;border-radius:26px 26px 0 0;padding:20px 18px calc(24px + env(safe-area-inset-bottom));touch-action:pan-y;font-size:15px;line-height:1.35}
.pt-sheet h3{margin:0 0 4px;font-size:26px;color:#3d2c8d}
.pt-sheet h4{margin:16px 0 6px;font-size:17px;color:#3d2c8d}
.pt-sheet .rtp{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.pt-sheet .rtp div{flex:1 1 90px;background:#f3efff;border-radius:14px;padding:8px 10px;text-align:center}
.pt-sheet .rtp b{display:block;font-size:22px;color:#7b5cff}
.pt-sheet table{width:100%;border-collapse:collapse}
.pt-sheet td{padding:3px 4px;border-bottom:1px solid #eee;text-align:center}
.pt-sheet td:first-child{text-align:left;display:flex;align-items:center;gap:6px}
.pt-sheet td img{width:34px;height:34px}
.pt-sheet .lines{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.pt-sheet .lines div{text-align:center;font-weight:800;font-size:12px}
.pt-sheet .lines svg{width:100%;background:#f3efff;border-radius:8px}
.pt-sheet .x{float:right;font:inherit;font-weight:800;border:0;background:#7b5cff;color:#fff;border-radius:20px;padding:6px 16px;font-size:16px;cursor:pointer}
.pt-sheet small{color:#666}
`;
document.head.appendChild(css);
{ const st = ui.els.start; st.classList.add('pt-start'); const h = st.querySelector('h1'); const tag = document.createElement('p'); tag.className = 'pt-tag'; tag.textContent = 'SLOTS CASINO'; h.after(tag);
  const f = document.createElement('div'); f.className = 'pt-foot'; f.textContent = 'Free play · no real money'; st.appendChild(f); }
const html = (s) => { const d = document.createElement('div'); d.innerHTML = s.trim(); return d.firstElementChild; };
const bar = html(`<div class="pt-bar"><button class="pt-odds">Odds ⓘ</button><div class="pt-bet"><button data-m>−</button><div class="v"><small>BET</small><b>100</b></div><button data-p>+</button></div><button class="pt-spin">SPIN</button></div>`);
const winEl = html(`<div class="pt-win"></div>`), infoEl = html(`<div class="pt-info"></div>`), fsEl = html(`<div class="pt-fs hc-hidden"></div>`);
document.body.append(bar, winEl, infoEl, fsEl);
const spinBtn = bar.querySelector('.pt-spin'), betVal = bar.querySelector('.v b'), betMinus = bar.querySelector('[data-m]'), betPlus = bar.querySelector('[data-p]');

// ---------------------------------------------------------------- stage
const st = createStage({ fov: 30, shadowSize: 7 });
const { scene, camera, renderer } = st;
const CAM_Y = 0.15;
function fit() {
  const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const d = Math.max(3.45 / Math.tan(hf / 2), 6.3 / Math.tan(vf / 2));
  camera.position.set(0, CAM_Y + 0.25, d); camera.lookAt(0, CAM_Y, 0); camera.updateMatrixWorld();
  const v = new THREE.Vector3(0, -2.98, 0.8).project(camera); winEl.style.top = ((1 - (v.y + 1) / 2) * innerHeight - 22) + 'px';
}
addEventListener('resize', fit); fit();
st.sun.position.set(3, 8, 10); st.sun.target.position.set(0, 0, 0);

const PALS = [
  { bg: ['#9be7f0', '#d9c8ff'], bezel: '#ff6f91', trim: '#ffd23f', ui: '#ff5d8f', con: '#5b4bc4' },
  { bg: ['#a8f0d8', '#c9e4ff'], bezel: '#7b5cff', trim: '#ffd23f', ui: '#7b5cff', con: '#2b6cb0' },
  { bg: ['#ffd6e8', '#c8f1ff'], bezel: '#00a6a6', trim: '#ffe066', ui: '#00a6a6', con: '#6b4ba0' },
  { bg: ['#c9d6ff', '#ffe1f0'], bezel: '#ff8c42', trim: '#fff1a8', ui: '#ff8c42', con: '#3d3a8c' },
];
const FS_BG = ['#ffe29a', '#ffb3d1'];

// ---------------------------------------------------------------- textures
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
let symCanvas = [], symTex = [], blurTex = [];
function buildSymbols() {
  M.SYMS.forEach((s, i) => {
    const c = drawSymbol(s.id, FONT), b = smear(c);
    if (symTex[i]) { symTex[i].image = c; symTex[i].needsUpdate = true; blurTex[i].image = b; blurTex[i].needsUpdate = true; }
    else { symTex[i] = tex(c); blurTex[i] = tex(b); }
    symCanvas[i] = c;
  });
}
buildSymbols();

// ---------------------------------------------------------------- cabinet
const RAD = 1.64, STEP = 0.62, REEL_W = 1.0, REEL_GAP = 1.08, WIN_W = 5.55, WIN_H = 3.0;
const cab = new THREE.Group(); scene.add(cab);
const bezelMat = glossy('#ff6f91'), trimMat = glossy('#ffd23f', { metalness: 0.35, roughness: 0.25 }), conMat = glossy('#5b4bc4');
{
  const rr = (s, x, y, w, h, r) => { s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); };
  const sh = new THREE.Shape(); rr(sh, -3.2, -2.25, 6.4, 4.5, 0.5);
  const hole = new THREE.Path(); rr(hole, -WIN_W / 2, -WIN_H / 2, WIN_W, WIN_H, 0.22); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4, curveSegments: 10 });
  const bezel = new THREE.Mesh(g, bezelMat); bezel.position.z = 0.12; bezel.castShadow = bezel.receiveShadow = true; cab.add(bezel);
  // gold inner trim ring
  const ts = new THREE.Shape(); rr(ts, -WIN_W / 2 - 0.1, -WIN_H / 2 - 0.1, WIN_W + 0.2, WIN_H + 0.2, 0.3);
  const th = new THREE.Path(); rr(th, -WIN_W / 2, -WIN_H / 2, WIN_W, WIN_H, 0.22); ts.holes.push(th);
  const trim = new THREE.Mesh(new THREE.ExtrudeGeometry(ts, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 }), trimMat);
  trim.position.z = 0.5; cab.add(trim);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.6), mat('#241a5c')); back.position.z = -1.9; cab.add(back);
  // separators between reels
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, WIN_H, 0.05), trimMat); s.position.set((i - 1.5) * REEL_GAP, 0, 0.06); cab.add(s); }
  // marquee with logo
  const mq = new THREE.Mesh(rounded(5.5, 1.3, 0.5, 0.22), bezelMat); mq.position.set(0, 2.95, 0.05); mq.castShadow = true; cab.add(mq);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.25 * 0.98), new THREE.MeshBasicMaterial({ map: tex(logoCanvas(FONT)) }));
  logo.position.set(0, 2.95, 0.31); logo.scale.set(1, 0.9, 1); cab.add(logo); cab.userData.logo = logo;
  // console under the reels
  const con = new THREE.Mesh(rounded(6.7, 1.2, 1.1, 0.3), conMat); con.position.set(0, -2.95, 0.2); con.castShadow = con.receiveShadow = true; cab.add(con);
  const lcd = new THREE.Mesh(rounded(5.7, 0.78, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: '#1b1446', roughness: 0.25, metalness: 0.2 })); lcd.position.set(0, -2.98, 0.76); cab.add(lcd);
  const lip = new THREE.Mesh(rounded(6.9, 0.22, 1.3, 0.1), trimMat); lip.position.set(0, -2.38, 0.25); cab.add(lip);
}
// chasing bulbs around the bezel
const BULBS = 30, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), BULBS);
{
  const d = new THREE.Object3D(), per = 2 * (6.0 + 4.1);
  for (let i = 0; i < BULBS; i++) {
    const half = BULBS / 2, k = i % half, x = -2.9 + k * 5.8 / (half - 1), y = i < half ? 2.06 : -2.06;
    d.position.set(x, y, 0.56); d.updateMatrix(); bulbs.setMatrixAt(i, d.matrix); bulbs.setColorAt(i, new THREE.Color('#fff3c4'));
  }
  cab.add(bulbs);
}
// glass vignette + highlight
const vig = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), new THREE.MeshBasicMaterial({ map: tex(vignetteCanvas()), transparent: true, depthWrite: false }));
vig.position.z = 0.2; vig.renderOrder = 3; cab.add(vig);

// ---------------------------------------------------------------- reels
const tileGeo = new THREE.PlaneGeometry(0.9, 0.9), drumMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.4, emissive: '#fff6e0', emissiveIntensity: 0.35 });
const glowTex = tex(frameCanvas());
const reels = [];
for (let r = 0; r < 5; r++) {
  const g = new THREE.Group(); g.position.x = (r - 2) * REEL_GAP; cab.add(g);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(RAD - 0.03, RAD - 0.03, REEL_W, 48, 1, true), drumMat); drum.rotation.z = Math.PI / 2; drum.position.z = -RAD; g.add(drum);
  const tiles = [];
  for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ map: symTex[0], transparent: true, depthWrite: false })); t.renderOrder = 2; g.add(t); tiles.push(t); }
  const glows = [0, 1, 2].map(row => { const a = (1 - row) * STEP, m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false }));
    m.position.set(0, RAD * Math.sin(a), RAD * Math.cos(a) - RAD + 0.004); m.rotation.x = -a; m.renderOrder = 1; m.visible = false; g.add(m); return m; });
  const stop0 = S.get('stop' + r, rint(32));
  reels.push({ i: r, g, tiles, glows, p: stop0, from: stop0, to: stop0, t: 0, dur: 1, phase: 'idle', lastTick: Math.floor(stop0) });
}
const mod = (a, n) => ((a % n) + n) % n;
function layoutReel(R, time) {
  const fl = Math.floor(R.p);
  for (let i = 0; i < 7; i++) {
    const j = fl - 2 + i, a = (R.p + 1 - j) * STEP, t = R.tiles[i];
    if (Math.abs(a) > 1.75) { t.visible = false; continue; }
    t.visible = true; t.position.set(0, RAD * Math.sin(a), RAD * Math.cos(a) - RAD + 0.01); t.rotation.x = -a;
    const sym = M.STRIPS[R.i][mod(j, 32)]; t.material.map = R.phase === 'spin' ? blurTex[sym] : symTex[sym];
    const row = i - 2, hot = R.phase === 'idle' && row >= 0 && row < 3 && winCells.has(R.i * 3 + row);
    t.material.color.setScalar((0.45 + 0.55 * Math.max(0, Math.cos(a)) ** 1.4) * (winCells.size && R.phase === 'idle' && !hot ? 0.5 : 1));
    t.scale.setScalar(hot ? 1 + 0.09 * Math.abs(Math.sin(time * 6 + R.i * 0.5)) : 1);
  }
}

// payline markers on the bezel + win line tubes
const LINE_COL = ['#ff4f9a', '#f29e00', '#3ab795', '#3a86ff', '#ff8c42', '#7b5cff', '#00c2d1', '#e63946', '#8ac926', '#f15bb5'];
const rowY = (row) => RAD * Math.sin((1 - row) * STEP), rowZ = (row) => RAD * Math.cos((1 - row) * STEP) - RAD;
const markers = [];
function buildMarkers() {
  markers.forEach(m => cab.remove(m)); markers.length = 0;
  const slots = { L: [[], [], []], R: [[], [], []] };
  M.LINES.forEach((L, i) => { slots.L[L[0]].push(i); slots.R[L[4]].push(i); });
  for (const side of ['L', 'R']) slots[side].forEach((list, row) => list.forEach((li, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.31), new THREE.MeshBasicMaterial({ map: tex(markerCanvas(li + 1, LINE_COL[li], FONT)), transparent: true }));
    m.position.set((side === 'L' ? -1 : 1) * 2.98, rowY(row) + (k - (list.length - 1) / 2) * 0.3, 0.6); m.userData.line = li; cab.add(m); markers.push(m);
  }));
}
buildMarkers();
let lineMeshes = [];
function showLines(list, alpha = 1) {
  clearLines();
  for (const li of list) {
    const L = M.LINES[li], pts = [new THREE.Vector3(-2.95, rowY(L[0]), 0.35)];
    L.forEach((row, r) => pts.push(new THREE.Vector3((r - 2) * REEL_GAP, rowY(row), rowZ(row) + 0.3)));
    pts.push(new THREE.Vector3(2.95, rowY(L[4]), 0.35));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.2);
    const under = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.075, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 * alpha, depthWrite: false }));
    const top = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 6), new THREE.MeshBasicMaterial({ color: LINE_COL[li], transparent: true, opacity: alpha, depthWrite: false }));
    under.renderOrder = 4; top.renderOrder = 5; cab.add(under, top); lineMeshes.push(under, top);
  }
  markers.forEach(m => m.scale.setScalar(list.includes(m.userData.line) ? 1.35 : 1));
}
function clearLines() { lineMeshes.forEach(m => { cab.remove(m); m.geometry.dispose(); m.material.dispose(); }); lineMeshes = []; markers.forEach(m => m.scale.setScalar(1)); }

// ---------------------------------------------------------------- ambience: bubbles + light rays
const BUB = 34, bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, roughness: 0.1 }), BUB);
const bub = []; for (let i = 0; i < BUB; i++) bub.push({ x: (Math.random() - 0.5) * 16, y: -12 + Math.random() * 22, z: -3 - Math.random() * 6, s: 0.06 + Math.random() * 0.2, v: 0.008 + Math.random() * 0.02, w: Math.random() * 6 });
scene.add(bubbles);
const rayTex = tex(raysCanvas()), rays = [];
for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + i * 0.5, 22), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(-6 + i * 4, 4, -9); m.rotation.z = 0.35 - i * 0.05; scene.add(m); rays.push(m); }
// coin fountain for wins
const COINS = 90, coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 22), [new THREE.MeshStandardMaterial({ color: '#ffd84a', metalness: 0.25, roughness: 0.3, emissive: '#c78a00', emissiveIntensity: 0.45 }), new THREE.MeshStandardMaterial({ color: '#fff1a0', metalness: 0.2, roughness: 0.25, emissive: '#e0a400', emissiveIntensity: 0.5 }), new THREE.MeshStandardMaterial({ color: '#fff1a0', metalness: 0.2, roughness: 0.25, emissive: '#e0a400', emissiveIntensity: 0.5 })], COINS);
coinMesh.frustumCulled = false; scene.add(coinMesh);
const coins = Array.from({ length: COINS }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));
const dummy = new THREE.Object3D();
function coinBurst(n = 40, power = 1) {
  let k = 0;
  for (const c of coins) { if (c.on) continue; if (k++ >= n) break;
    c.on = true; c.p.set((Math.random() - 0.5) * 4, -1.5 + Math.random(), 1.5); c.v.set((Math.random() - 0.5) * 0.12, (0.13 + Math.random() * 0.1) * Math.min(1.15, power), 0.02 + Math.random() * 0.04);
    c.r.set(Math.random() * 6, Math.random() * 6, 0); c.w.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3); }
}

// ---------------------------------------------------------------- game state
const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
let level = S.get('level', 1), levelStart = S.get('start', 1000), best = S.get('best', 0);
if (D.seed) { level = 1; levelStart = 1000; }
const B = worldBoard({ game: 'pearl-tide', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: 1 point per level cleared today
let chips = levelStart, shown = chips, target = 0, state = 'ready', phase = 'idle', betIdx = 2, recorded = false, beatenShown = false;
let result = null, mult = 1, fs = { left: 0, total: 0, won: 0 }, winCells = new Set(), turbo = false, spinStart = 0, overlay = null, overlayAt = 0, timers = [];
const later = (ms, fn) => { const id = setTimeout(() => { timers = timers.filter(t => t !== id); fn(); }, ms); timers.push(id); };
function targetFor(lv, start) { if (D.seed) return 1500; return Math.max(start + 150, Math.round(start * (1.15 + 0.05 * Math.min(lv - 1, 17)) / 50) * 50); }
function applyPal() {
  const p = PALS[(level - 1) % PALS.length], bg = fs.left > 0 || fs.total > 0 ? FS_BG : p.bg;
  document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]); document.body.style.setProperty('--ui', p.ui);
  bezelMat.color.set(p.bezel); trimMat.color.set(p.trim); conMat.color.set(p.con);
}
function bestBet() { let i = 0; for (let k = 0; k < BETS.length; k++) if (BETS[k] <= Math.max(10, chips * 0.06)) i = k; return i; }
function setupLevel() {
  chips = shown = levelStart; target = targetFor(level, levelStart); recorded = false; beatenShown = false;
  fs = { left: 0, total: 0, won: 0 }; mult = 1; betIdx = bestBet(); winCells.clear(); clearLines(); reels.forEach(R => R.glows.forEach(g => g.visible = false));
  ui.levels(level); applyPal(); hud(); fsEl.classList.add('hc-hidden'); winEl.innerHTML = `10 lines · <b style="font-size:22px">${M.LINE_COUNT}</b> ways to line up`;
  winEl.innerHTML = state === 'ready' ? '' : `Reach <b style="font-size:26px">${fmt(target)}</b> chips`;
}
function hud() {
  ui.score(fmt(shown)); ui.sub(`GOAL ${fmt(target)}`);
  ui.progress((chips - levelStart) / Math.max(1, target - levelStart));
  const b = BETS[betIdx]; betVal.textContent = fmt(b);
  betMinus.disabled = betIdx === 0 || phase !== 'idle' || fs.left > 0; betPlus.disabled = betIdx >= BETS.length - 1 || BETS[betIdx + 1] > chips || phase !== 'idle' || fs.left > 0;
  spinBtn.classList.toggle('fs', fs.left > 0); spinBtn.classList.toggle('busy', phase !== 'idle');
  infoEl.textContent = `10 lines · ${fmt(b / 10)} per line · RTP ${(RTP.rtp * 100).toFixed(1)}%`;
  spinBtn.innerHTML = fs.left > 0 ? `FREE<br>${fs.left}` : 'SPIN';
}
function changeBet(d) {
  if (phase !== 'idle' || fs.left > 0 || state !== 'play') return;
  const n = clamp(betIdx + d, 0, BETS.length - 1); if (BETS[n] > chips && d > 0) return;
  betIdx = n; tone(500 + n * 60, 0.06, 'triangle', 0.12, 1.2); buzz(6); hud();
}
betMinus.addEventListener('pointerdown', e => { e.stopPropagation(); changeBet(-1); });
betPlus.addEventListener('pointerdown', e => { e.stopPropagation(); changeBet(1); });
spinBtn.addEventListener('pointerdown', e => { e.stopPropagation(); spinBtn.classList.add('down'); setTimeout(() => spinBtn.classList.remove('down'), 120); onSpin(); });
addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (state === 'play') onSpin(); } });

// ---------------------------------------------------------------- spinning
function onSpin() {
  if (state !== 'play' || overlay) return;
  if (phase === 'spin') { slam(); return; }
  if (phase !== 'idle') return;
  spin();
}
function spin(auto = false) {
  const bet = BETS[betIdx];
  if (fs.left > 0) { fs.left--; mult = M.FS_MULT; }
  else { if (bet > chips) { betIdx = bestBet(); return hud(); } chips -= bet; shown = chips; mult = 1; }
  const stops = reels.map(() => rint(32));                              // the whole outcome: 5 uniform, independent stops
  result = M.evaluate(stops, BETS[betIdx] / M.LINE_COUNT, mult); result.bet = BETS[betIdx]; result.stops = stops;
  winCells.clear(); clearLines(); reels.forEach(R => R.glows.forEach(g => g.visible = false));
  phase = 'spin'; spinStart = performance.now();
  const fast = turbo || auto && turbo, d0 = fast ? 0.42 : 0.8, gap = fast ? 0.1 : 0.2;
  reels.forEach((R, r) => {
    const min = 14 + r * (fast ? 3 : 5), cur = R.p; const travel = min + mod(cur - min - stops[r], 32);
    R.from = cur; R.to = cur - travel; R.t = 0; R.wind = 0.12; R.dur = d0 + r * gap; R.settle = 0; R.phase = 'spin';
  });
  winEl.innerHTML = fs.total > 0 ? `Free spin · all wins <b style="font-size:24px">×${M.FS_MULT}</b>` : `<span style="opacity:.55">Good luck!</span>`;
  tone(240, 0.22, 'sawtooth', 0.04, 2.2); buzz(10); hud();
}
function slam() { const now = performance.now(); reels.forEach((R, r) => { if (R.phase === 'spin' && R.wind <= 0) { const u = R.t / R.dur; R.dur = Math.min(R.dur, R.t + 0.08 + r * 0.05); } }); }
const easeIn = (u) => u < 0.15 ? 3.604 * u * u : 1.081 * (u - 0.15) + 0.0811;
function updateReels(dt, time) {
  let stopping = false;
  for (const R of reels) {
    if (R.phase === 'spin') {
      if (R.wind > 0) { R.wind -= dt; R.p = R.from + 0.22 * Math.sin(Math.PI * (1 - Math.max(0, R.wind) / 0.12)); }
      else { R.t += dt; const u = Math.min(1, R.t / R.dur); R.p = R.from + (R.to - 0.28 - R.from) * easeIn(u);
        if (u >= 1) { R.phase = 'settle'; R.settle = 0; reelStop(R); } }
      const fl = Math.floor(R.p); if (fl !== R.lastTick) { R.lastTick = fl; tick(); }
    } else if (R.phase === 'settle') {
      R.settle += dt; const u = Math.min(1, R.settle / 0.2); R.p = R.to - 0.28 * (1 - u) * (1 - u) * (1 + 2 * u) * (1 - u * 0.5);
      if (u >= 1) { R.p = R.to; R.phase = 'idle'; R.from = R.to = mod(Math.round(R.p), 32); R.p = R.to; R.lastTick = R.p; }
    }
    if (R.phase !== 'idle') stopping = true;
    layoutReel(R, time);
  }
  if (phase === 'spin' && !stopping) present();
}
let lastTick = 0;
function tick() { const n = performance.now(); if (n - lastTick < 55) return; lastTick = n; tone(1500, 0.02, 'square', 0.025, 1); }
function reelStop(R) {
  tone(150, 0.12, 'square', 0.09, 0.5); tone(90, 0.12, 'sine', 0.16, 0.6); buzz(8);
  const col = result.grid[R.i];
  if (col.includes(M.SCAT)) { const k = result.grid.slice(0, R.i + 1).filter(c => c.includes(M.SCAT)).length; note(76 + k * 4, 0.45, 0.14); }
  R.g.position.y = -0.04; setTimeout(() => R.g.position.y = 0, 70);
}

// ---------------------------------------------------------------- results
function present() {
  phase = 'present';
  reels.forEach((R, r) => S.set('stop' + r, R.to));
  const res = result, bet = res.bet, win = res.win;
  const lines = res.lines.map(l => l.line);
  for (const l of res.lines) M.LINES[l.line].slice(0, l.count).forEach((row, r) => winCells.add(r * 3 + row));
  if (res.scat.win || res.scat.spins) res.scat.positions.forEach(([r, row]) => winCells.add(r * 3 + row));
  winCells.forEach(c => { reels[Math.floor(c / 3)].glows[c % 3].visible = true; });
  if (lines.length) showLines(lines);
  chips += win; if (fs.total > 0) fs.won += win;
  let wait = 250;
  if (win > 0) {
    const x = win / bet, top = res.lines.slice().sort((a, b) => b.win - a.win)[0];
    winEl.innerHTML = `WIN <b>${fmt(win)}</b>`; winEl.classList.add('pump'); setTimeout(() => winEl.classList.remove('pump'), 160);
    const label = top ? `${top.count}× ${M.SYMS[top.sym].name}${res.lines.length > 1 ? ` +${res.lines.length - 1}` : ''}` : `${res.scat.count} Moon Pearls`;
    winEl.innerHTML = `WIN <b>${fmt(win)}</b> <span style="font-size:15px;opacity:.85">${label}</span>`;
    if (x >= 3 && x < 10) ui.pop(x >= 6 ? 'GREAT WIN!' : 'NICE!', '#fff3a6', 40, 15);
    [72, 76, 79, 84].slice(0, x >= 5 ? 4 : x >= 1 ? 3 : 2).forEach((n, i) => setTimeout(() => note(n, 0.3, 0.15), i * 90));
    burst(scene, new THREE.Vector3(0, 0, 1), ['#ffd23f', '#ffffff', '#ff9f1c'], Math.min(40, 8 + x * 3), { speed: 0.1, up: 0.08, size: 0.6, shape: 'sphere' });
    coinBurst(Math.min(60, 4 + Math.round(x * 4)), 0.8 + Math.min(0.6, x / 20)); buzz(x >= 5 ? [30, 30, 60] : 20); chase = 1.5;
    wait = x >= 5 ? 1300 : 900;
  }
  if (D.beaten(chips) && !beatenShown) { beatenShown = true; later(300, () => { ui.pop('BEATEN!', '#ffd23f', 48, 30); confetti(scene, new THREE.Vector3(0, 1, 1), 60); }); }
  const x = win / bet;
  const after = () => {
    if (res.scat.spins) return freeSpinsAward(res.scat.spins);
    next();
  };
  if (x >= 10 && fs.total === 0) later(450, () => bigWin(win, bet, after));
  else later(wait, after);
  hud();
}
function freeSpinsAward(n) {
  const re = fs.total > 0;
  fs.left += n; fs.total += n; applyPal();
  fsEl.classList.remove('hc-hidden'); fsEl.textContent = `FREE SPINS · ALL WINS ×${M.FS_MULT}`;
  [72, 76, 79, 84, 88, 91].forEach((m, i) => setTimeout(() => note(m, 0.4, 0.15), i * 70));
  confetti(scene, new THREE.Vector3(0, 0.5, 1.5), 70); ui.flash(0.5); buzz([40, 30, 80]);
  showOverlay(re ? `+${n}<br>FREE SPINS` : `${n} FREE<br>SPINS`, re ? 'Retriggered!' : `All wins ×${M.FS_MULT}`, null, () => next(), 2200);
}
function next() {
  hud();
  if (fs.left > 0) { phase = 'idle'; later(turbo ? 250 : 600, () => { if (state === 'play' && phase === 'idle' && !overlay) spin(true); }); return; }
  if (fs.total > 0) {
    const won = fs.won, bet = BETS[betIdx]; fs = { left: 0, total: 0, won: 0 }; mult = 1; applyPal(); fsEl.classList.add('hc-hidden');
    showOverlay(won >= bet * 10 ? 'BIG BONUS!' : 'BONUS OVER', 'Free spins paid', won, () => end(), 2400);
    if (won > 0) { coinBurst(70, 1.3); confetti(scene, new THREE.Vector3(0, 1, 1.5), 80); }
    return;
  }
  end();
}
function end() {
  if (demoChips !== null) { chips = shown = demoChips; demoChips = null; }   // the demo spin's bet and winnings are taken back
  phase = 'idle'; hud();
  if (chips >= target) return levelWon();
  if (chips < BETS[0]) return levelLost();
  if (BETS[betIdx] > chips) { betIdx = bestBet(); hud(); }
}
function levelWon() {
  state = 'won'; if (!recorded) { recorded = true; B.submit(1); }
  best = Math.max(best, chips); S.set('best', best);
  confetti(scene, new THREE.Vector3(0, 1, 1.5), 100); coinBurst(80, 1.4); ui.flash(0.6); note(84, 0.5, 0.15);
  D.won(chips);
  ui.win(level, `${fmt(chips)} chips · goal ${fmt(target)}`);
}
function levelLost() {
  state = 'lost'; if (!recorded) recorded = true;
  tone(220, 0.25, 'triangle', 0.1, 0.6); setTimeout(() => tone(165, 0.4, 'triangle', 0.1, 0.6), 160);
  ui.lose('OUT OF CHIPS', `Retry refills your ${fmt(levelStart)} chips`);
}

// ---------------------------------------------------------------- overlays (big win, free spins)
let chase = 0;
function showOverlay(title, line, amount, done, auto = 2600) {
  const el = html(`<div class="pt-big"><div class="rays"></div><h2>${title}</h2>${amount !== null ? '<div class="n">0</div>' : ''}<p>${line}</p></div>`);
  document.body.appendChild(el); overlay = { el, done, amount, t0: performance.now(), shown: 0 }; overlayAt = performance.now();
  const close = () => { if (!overlay || overlay.el !== el) return; el.remove(); overlay = null; done && done(); };
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (performance.now() - overlayAt > 350) close(); });
  overlay.close = close; later(auto, close);
}
function bigWin(win, bet, done) {
  const x = win / bet, title = x >= 60 ? 'EPIC<br>WIN' : x >= 25 ? 'MEGA<br>WIN' : 'BIG<br>WIN';
  showOverlay(title, `${Math.round(x)}× your bet`, win, done, 3200);
  coinBurst(90, 1.5); confetti(scene, new THREE.Vector3(0, 1, 1.5), 90); ui.flash(0.7); buzz([60, 40, 120]); chase = 3.5;
  [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => setTimeout(() => note(n, 0.5, 0.16), i * 110));
}

// ---------------------------------------------------------------- odds panel
function oddsPanel() {
  const img = (i) => `<img src="${symCanvas[i].toDataURL()}" alt="">`;
  const rows = M.PAY.map((p, i) => i === M.SCAT ? '' : `<tr><td>${img(i)}${M.SYMS[i].name}</td><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td></tr>`).join('');
  const svg = (L, i) => `<svg viewBox="0 0 50 30">${[0, 1, 2].map(r => [0, 1, 2, 3, 4].map(c => `<rect x="${c * 10 + 1.5}" y="${r * 10 + 1.5}" width="7" height="7" rx="2" fill="${L[c] === r ? LINE_COL[i] : '#ddd6f7'}"/>`).join('')).join('')}<polyline points="${L.map((r, c) => `${c * 10 + 5},${r * 10 + 5}`).join(' ')}" fill="none" stroke="${LINE_COL[i]}" stroke-width="1.6"/></svg>`;
  const counts = M.STRIPS.map(s => M.SYMS.map((_, k) => s.filter(x => x === k).length));
  const pct = (v) => (v * 100).toFixed(2) + '%', oneIn = (p) => '1 in ' + Math.round(1 / p).toLocaleString('en-US');
  const scatP = (k) => RTP.pearlDist.slice(k).reduce((a, b) => a + b, 0);
  const el = html(`<div class="pt-panel"><div class="pt-sheet">
    <button class="x">Close</button><h3>Odds &amp; paytable</h3>
    <small>Same odds for everyone, every spin. Free play chips only: no real money, nothing to buy.</small>
    <div class="rtp"><div><b>${pct(RTP.rtp)}</b>Return to player</div><div><b>${oneIn(RTP.trigger)}</b>spins trigger free spins</div><div><b>${pct(hitRate)}</b>of spins pay something*</div></div>
    <small>RTP is computed exactly from the reel strips and paytable below (lines ${pct(RTP.lines)} + pearl pays ${pct(RTP.scatter)} + free spins ${pct(RTP.free)}).
    Each reel stops at one of its 32 printed positions, picked with <b>crypto.getRandomValues</b>, all positions equally likely, reels independent. There are no near-miss tricks: the symbols you see above and below the line are the reel's real neighbours, and reels never slow down to tease a bonus.</small>
    <small>*Many pays are smaller than the bet; over time the game keeps ${pct(1 - RTP.rtp)} of chips wagered.</small>
    <h4>Line pays (× line bet = total bet ÷ 10)</h4>
    <table><tr><td><b>Symbol</b></td><td><b>×3</b></td><td><b>×4</b></td><td><b>×5</b></td></tr>${rows}</table>
    <small>Pays left to right on adjacent reels. ${img(M.WILD)} Tide Wild stands in for every symbol except the pearl.</small>
    <h4>${img(M.SCAT).replace('<img', '<img style="width:30px;vertical-align:middle"')} Moon Pearls (anywhere)</h4>
    <table><tr><td><b>Pearls</b></td><td><b>Pays</b></td><td><b>Free spins</b></td><td><b>Chance</b></td></tr>
    ${[3, 4, 5].map(k => `<tr><td>${k}</td><td>${M.SCAT_PAY[k]}× total bet</td><td>${M.FS_AWARD[k]}</td><td>${oneIn(RTP.pearlDist[k])}</td></tr>`).join('')}</table>
    <small>Free spins play at your last bet, every win ×${M.FS_MULT}, and pearls can retrigger more spins. Chance of 3+ pearls on a spin: ${oneIn(scatP(3))}.</small>
    <h4>10 paylines</h4><div class="lines">${M.LINES.map((L, i) => `<div>${svg(L, i)}${i + 1}</div>`).join('')}</div>
    <h4>Reel strips (stops per reel, 32 each)</h4>
    <table><tr><td></td>${[1, 2, 3, 4, 5].map(r => `<td><b>R${r}</b></td>`).join('')}</tr>${M.SYMS.map((s, k) => `<tr><td>${img(k)}${s.name}</td>${counts.map(c => `<td>${c[k]}</td>`).join('')}</tr>`).join('')}</table>
  </div></div>`);
  const close = () => el.remove();
  el.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === el || e.target.classList.contains('x')) close(); });
  document.body.appendChild(el);
}
const hitRate = M.HIT_COMBOS / M.ALL_COMBOS;
bar.querySelector('.pt-odds').addEventListener('pointerdown', e => { e.stopPropagation(); oddsPanel(); });

// ---------------------------------------------------------------- flow
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the reels spin once on their own (a normal fair draw) and show what lands; that spin's bet and any win are given back
let demoChips = null;
demo(() => { demoChips = chips; spin(); if (phase !== 'spin') demoChips = null; },
  { ready: () => state === 'play' && level === 1 && !D.seed && phase === 'idle' && !overlay && fs.total === 0 && chips === levelStart, wait: 2200, max: 1 });

ui.onTap(which => {
  B.start();
  if (which === 'start') { state = 'play'; winEl.innerHTML = `Reach <b style="font-size:26px">${fmt(target)}</b> chips`; tone(660, 0.08, 'triangle', 0.12, 1.3); previewLines(); }
  else if (which === 'win') { if (!D.seed) { level++; levelStart = chips; S.set('level', level); S.set('start', levelStart); } setupLevel(); state = 'play'; previewLines(); }
  else if (which === 'lose') { setupLevel(); state = 'play'; }
});
function previewLines() { let k = 0; const show = () => { if (phase !== 'idle' || k > 10) { if (phase === 'idle' && !winCells.size) clearLines(); return; } showLines(k < 10 ? [k] : [], 0.9); if (k < 10) tone(600 + k * 40, 0.04, 'sine', 0.05, 1); k++; later(110, show); }; show(); }

setupLevel();
reels.forEach(R => layoutReel(R, 0));
ui.start();
document.fonts && document.fonts.load(`800 60px ${FONT}`).then(() => {
  buildSymbols(); buildMarkers(); cab.userData.logo.material.map = tex(logoCanvas(FONT)); cab.userData.logo.material.needsUpdate = true;
}).catch(() => {});

loop((dt, time) => {
  updateReels(dt / 60, time);
  // bubbles
  for (let i = 0; i < BUB; i++) { const b = bub[i]; b.y += b.v * dt; if (b.y > 10) { b.y = -12; b.x = (Math.random() - 0.5) * 16; }
    dummy.position.set(b.x + Math.sin(time * 1.2 + b.w) * 0.3, b.y, b.z); dummy.scale.setScalar(b.s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix); }
  bubbles.instanceMatrix.needsUpdate = true;
  rays.forEach((r, i) => r.material.opacity = 0.22 + 0.12 * Math.sin(time * 0.6 + i * 1.7));
  // coins
  for (let i = 0; i < COINS; i++) { const c = coins[i];
    if (c.on) { c.v.y -= 0.007 * dt; c.p.addScaledVector(c.v, dt); c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; if (c.p.y < -9) c.on = false; }
    dummy.position.copy(c.p); dummy.rotation.copy(c.r); dummy.scale.setScalar(c.on ? 1 : 0); dummy.updateMatrix(); coinMesh.setMatrixAt(i, dummy.matrix); }
  coinMesh.instanceMatrix.needsUpdate = true;
  // bulbs: gentle idle twinkle, fast chase on wins
  chase = Math.max(0, chase - dt / 60);
  const col = new THREE.Color();
  for (let i = 0; i < BULBS; i++) {
    const on = chase > 0 ? ((i + Math.floor(time * 18)) % 3 === 0) : (0.5 + 0.5 * Math.sin(time * 2 + i * 0.7)) > 0.35;
    col.set(on ? (chase > 0 ? (i % 2 ? '#fff3a6' : '#ff9fd0') : '#fff6d6') : '#c9a8e8'); bulbs.setColorAt(i, col);
  }
  bulbs.instanceColor.needsUpdate = true;
  // glows pulse
  reels.forEach(R => R.glows.forEach(g => { if (g.visible) g.material.opacity = 0.6 + 0.4 * Math.sin(time * 6); }));
  cab.userData.logo.scale.set(1 + 0.012 * Math.sin(time * 2), 0.9 + 0.012 * Math.sin(time * 2), 1);
  // chip counter roll-up
  if (shown !== chips) { const d = chips - shown; shown = Math.abs(d) < 1 ? chips : shown + d * Math.min(1, 0.12 * dt); if (d > 0 && Math.random() < 0.3) tone(1200 + Math.random() * 400, 0.03, 'square', 0.03, 1); ui.score(fmt(shown)); }
  if (overlay && overlay.amount !== null) { const el = overlay.el.querySelector('.n'); const u = Math.min(1, (performance.now() - overlay.t0) / 1600); el.textContent = fmt(overlay.amount * (1 - (1 - u) ** 3)); }
});

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.round(chips); },
  bot() {
    turbo = true;
    if (state !== 'play') return;
    if (overlay) { if (performance.now() - overlayAt > 900) overlay.close(); return; }
    if (phase !== 'idle' || fs.left > 0) return;
    // sensible bankroll play: ~8% of the stack, rounded to an available bet
    let i = 0; for (let k = 0; k < BETS.length; k++) if (BETS[k] <= Math.max(10, chips * 0.1)) i = k;
    betIdx = i; hud(); spin();
  },
  get phase() { return phase; }, get lastWin() { return result ? result.win : 0; }, get freeSpins() { return fs.left; }, get overlay() { return !!overlay; },
  odds: RTP,
};

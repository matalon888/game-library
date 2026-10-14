// Pegfall — original free-play ball drop casino. Tap DROP: the ball bounces through 12 rows of pegs into a multiplier slot.
// Honest odds: each bounce is one fair bit from crypto.getRandomValues; tables are fixed and published in the Odds panel.
import { THREE, createStage, createUI, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp } from './kit/hc.js';
import { daily } from './kit/daily.js';

const NAME = 'Pegfall: Ball Drop Casino';
const V3 = THREE.Vector3;
const S = createStage({ fov: 40, shadowSize: 6 });
const { scene, camera, sun, hemi } = S;
hemi.intensity = 1.05; sun.intensity = 1.5; sun.position.set(3, 9, 12); sun.target.position.set(0, 0.3, 0);
const ui = createUI({ title: 'PEG<br>FALL', hint: 'Tap DROP to play', hand: '👇' });
const D = daily('pegfall', ui, { name: NAME });
const save = store('pegfall');

// ---------------------------------------------------------------- fixed odds (never change at runtime)
const ROWS = 12, SLOTS = ROWS + 1;
const RISKS = {
  low:  { label: 'LOW',  mult: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10] },
  med:  { label: 'MED',  mult: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33] },
  high: { label: 'HIGH', mult: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
};
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const WAYS = Array.from({ length: SLOTS }, (_, k) => binom(ROWS, k)), TOTAL = 2 ** ROWS;
for (const r of Object.values(RISKS)) r.rtp = r.mult.reduce((a, m, k) => a + m * WAYS[k] / TOTAL, 0);
// one fair left/right bit per row, from the browser's cryptographic RNG
function fairPath() { const b = new Uint8Array(ROWS); crypto.getRandomValues(b); return Array.from(b, v => v & 1); }

// ---------------------------------------------------------------- levels (chip targets)
const START = 1000, MIN_BET = 10, BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
let level = save.get('level', 1), best = save.get('best', 0);
const targetFor = (lv) => D.seed ? 1500 : Math.round(START * Math.min(4, 1.15 + 0.1 * (lv - 1)) / 50) * 50;
let target = targetFor(level), chips = START, shown = START, betI = 3, risk = save.get('risk', 'med');
let state = 'ready', pendingWin = false, recorded = false, beatenShown = false;

const THEMES = [
  { bg: ['#d7c8ff', '#ffd6f5'], ui: '#7b5cff' }, { bg: ['#ffd1dc', '#ffe9b8'], ui: '#ff5d8f' },
  { bg: ['#b8f2e6', '#e3f6ff'], ui: '#2a9d8f' }, { bg: ['#c9f0ff', '#e8fff4'], ui: '#0582ca' }, { bg: ['#ffe0b3', '#fff6d6'], ui: '#ff8c42' },
];
function theme() { const t = THEMES[(level - 1) % THEMES.length]; const s = document.body.style; s.setProperty('--bg1', t.bg[0]); s.setProperty('--bg2', t.bg[1]); s.setProperty('--ui', t.ui); }

// ---------------------------------------------------------------- HUD + controls
const css = document.createElement('style'); css.textContent = `
.pf-ctl{position:fixed;left:0;right:0;bottom:0;padding:10px 14px calc(14px + env(safe-area-inset-bottom));z-index:7;display:flex;flex-direction:column;gap:9px;align-items:center;transition:opacity .25s,transform .25s}
.pf-ctl.off{opacity:0;transform:translateY(30px);pointer-events:none}
.pf-seg{display:flex;background:rgba(43,29,92,.18);border-radius:20px;padding:4px;gap:4px}
.pf-seg button{font:inherit;font-weight:800;font-size:16px;border:0;border-radius:16px;padding:5px 18px;background:transparent;color:#fff;cursor:pointer;text-shadow:0 1px 0 rgba(0,0,0,.15)}
.pf-seg button.on{background:#fff;color:var(--ui);box-shadow:0 3px 0 rgba(0,0,0,.12)}
.pf-row{display:flex;gap:10px;align-items:center;width:100%;max-width:400px}
.pf-bet{display:flex;align-items:center;background:rgba(255,255,255,.94);border-radius:22px;box-shadow:0 4px 0 rgba(0,0,0,.12);color:#2b1d5c;height:60px;flex:0 0 auto}
.pf-bet button{font:inherit;font-weight:800;font-size:28px;width:44px;height:60px;border:0;background:transparent;color:var(--ui);cursor:pointer}
.pf-bet div{min-width:62px;text-align:center;line-height:1}
.pf-bet small{display:block;font-size:11px;font-weight:800;opacity:.55;letter-spacing:1px}
.pf-bet b{font-size:22px}
.pf-drop{flex:1;font:inherit;font-weight:800;font-size:28px;letter-spacing:1px;height:60px;border:0;border-radius:22px;color:#fff;cursor:pointer;
 background:linear-gradient(180deg,#ff6fa3,#ff2d6f);box-shadow:0 5px 0 #b3124a,0 10px 24px rgba(255,45,111,.35);text-shadow:0 2px 0 rgba(0,0,0,.18)}
.pf-drop:active{transform:translateY(4px);box-shadow:0 1px 0 #b3124a}
.pf-drop:disabled{filter:grayscale(.6) brightness(.9)}
.pf-odds{font:inherit;font-weight:800;font-size:15px;color:#fff;border:0;border-radius:16px;padding:5px 14px;background:rgba(43,29,92,.28);cursor:pointer}
.pf-top{display:flex;gap:10px;align-items:center}
body.pf-ready .hc-score,body.pf-ready .hc-sub,body.pf-ready .pf-hist{opacity:0}
.hc-score,.hc-sub,.pf-hist{transition:opacity .3s}
.hc-card:first-of-type{}
.pf-hist{position:fixed;top:calc(130px + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;gap:5px;z-index:5;pointer-events:none;height:24px}
.pf-hist span{font-weight:800;font-size:13px;line-height:24px;padding:0 8px;border-radius:12px;color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.15);animation:pfin .3s ease-out}
@keyframes pfin{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.pf-float{position:fixed;transform:translate(-50%,-50%);font-weight:800;pointer-events:none;z-index:6;white-space:nowrap;-webkit-text-stroke:5px rgba(43,29,92,.8);paint-order:stroke fill;animation:pff 1s ease-out forwards}
@keyframes pff{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}18%{opacity:1;transform:translate(-50%,-80%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-260%) scale(1)}}
.pf-panel{position:fixed;inset:0;z-index:20;background:rgba(30,18,70,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.pf-panel.hid{display:none}
.pf-card{background:#fff;color:#2b1d5c;border-radius:24px;padding:16px 16px 14px;width:100%;max-width:380px;max-height:92vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.25)}
.pf-card h2{margin:0 0 2px;font-size:26px;line-height:1.1}
.pf-card p{margin:4px 0 8px;font-size:13px;line-height:1.3;opacity:.75;font-weight:600}
.pf-card table{width:100%;border-collapse:collapse;font-size:14px;font-weight:600}
.pf-card td,.pf-card th{padding:3px 4px;text-align:right}
.pf-card th{font-size:11px;opacity:.55;letter-spacing:1px}
.pf-card td:first-child,.pf-card th:first-child{text-align:left}
.pf-card .m{display:inline-block;min-width:52px;text-align:center;border-radius:10px;color:#fff;font-weight:800}
.pf-card .rtp{display:flex;gap:6px;margin:8px 0}
.pf-card .rtp div{flex:1;text-align:center;border-radius:14px;background:#f2eeff;padding:4px 0;font-size:12px;font-weight:800}
.pf-card .rtp b{display:block;font-size:18px;color:#7b5cff}
.pf-card .rtp div.on{background:#7b5cff;color:#fff}.pf-card .rtp div.on b{color:#fff}
.pf-card .close{margin-top:10px;width:100%}
.pf-foot{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));font-size:14px;font-weight:600;opacity:.7;text-align:center}
.hc-score{font-size:46px}
.hc-score::before{content:'';display:inline-block;width:30px;height:30px;margin-right:8px;border-radius:50%;vertical-align:-2px;background:radial-gradient(circle at 35% 35%,#fff6c2,#ffd23f 45%,#e0a100);box-shadow:inset 0 0 0 4px rgba(255,255,255,.55),0 3px 0 rgba(0,0,0,.15)}
.hc-pop,.hc-card h1,.hc-score{-webkit-text-stroke:3px rgba(43,29,92,.25);paint-order:stroke fill}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const ctl = H(`<div class="pf-ctl off"><div class="pf-top"><div class="pf-seg">${Object.entries(RISKS).map(([k, r]) => `<button data-r="${k}">${r.label}</button>`).join('')}</div><button class="pf-odds">Odds</button></div>
<div class="pf-row"><div class="pf-bet"><button data-d="-1">−</button><div><small>BET</small><b>100</b></div><button data-d="1">+</button></div><button class="pf-drop">DROP</button></div></div>`);
const oddsBtn = ctl.querySelector('.pf-odds');
const hist = H('<div class="pf-hist"></div>');
const panel = H('<div class="pf-panel hid"><div class="pf-card"></div></div>');
const footer = document.createElement('div'); footer.className = 'pf-foot'; footer.textContent = 'Free play · no real money'; ui.els.start.appendChild(footer); ui.els.start.style.paddingTop = 'calc(40px + env(safe-area-inset-top))'; document.body.classList.add('pf-ready');
const betEl = ctl.querySelector('.pf-bet b'), dropBtn = ctl.querySelector('.pf-drop');
for (const e of [ctl, panel]) e.addEventListener('pointerdown', ev => ev.stopPropagation());
ctl.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => setRisk(b.dataset.r)));
ctl.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { betI = clamp(betI + +b.dataset.d, 0, BETS.length - 1); sfx.tap(); refreshCtl(); }));
dropBtn.addEventListener('click', () => drop());
oddsBtn.addEventListener('click', () => openOdds());
panel.addEventListener('click', e => { if (e.target === panel || e.target.classList.contains('close')) panel.classList.add('hid'); });
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fmtM = (m) => (m >= 10 ? m.toFixed(0) : m % 1 ? m.toFixed(1) : m.toFixed(0)) + '×';

function refreshCtl() {
  ctl.querySelectorAll('[data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === risk));
  betEl.textContent = fmt(BETS[betI]);
  dropBtn.disabled = pendingWin || chips < BETS[0];
}
function openOdds() {
  const r = RISKS[risk];
  panel.firstElementChild.innerHTML = `<h2>Odds · ${r.label} risk</h2>
<p>Each of the 12 bounces is a fair 50/50 bit from your device's secure random generator (crypto.getRandomValues). Odds and payouts are fixed: they never change by player, session or level.</p>
<div class="rtp">${Object.entries(RISKS).map(([k, x]) => `<div class="${k === risk ? 'on' : ''}">${x.label}<b>${(x.rtp * 100).toFixed(2)}%</b></div>`).join('')}</div>
<p style="margin:0 0 6px">RTP = average chips returned per chip bet (sum of multiplier × probability).</p>
<table><tr><th>SLOT</th><th>PAYS</th><th>CHANCE</th><th></th></tr>${r.mult.map((m, k) => `<tr><td>${k + 1}</td><td><span class="m" style="background:${slotColor(k)}">${fmtM(m)}</span></td><td>${WAYS[k]} in ${TOTAL}</td><td>${(WAYS[k] / TOTAL * 100).toFixed(WAYS[k] < 20 ? 3 : 2)}%</td></tr>`).join('')}</table>
<button class="hc-btn close">Got it</button>`;
  panel.classList.remove('hid'); sfx.tap();
}

// ---------------------------------------------------------------- board geometry
const SP = 0.56, RH = 0.58, TOPY = 3.0, PEG_R = 0.088, BALL_R = 0.17, Z = 0.17;
const pegX = (r, j) => (j - (r + 2) / 2) * SP, rowY = (r) => TOPY - r * RH;
const SLOT_Y = rowY(ROWS - 1) - 0.62, SPAWN_Y = TOPY + 0.62, CONTACT = PEG_R + BALL_R;
const W = SP * (ROWS + 1) + 0.55, BOT = SLOT_Y - 0.5, TOPB = SPAWN_Y + 0.45, HB = TOPB - BOT, CY = (TOPB + BOT) / 2;

const board = new THREE.Group(); scene.add(board);
const plate = new THREE.Mesh(rounded(W, HB, 0.3, 0.28), new THREE.MeshStandardMaterial({ color: '#2b1d5c', roughness: 0.55, metalness: 0.15 }));
plate.position.set(0, CY, -0.15); plate.receiveShadow = true; board.add(plate);
// subtle inner glow panel (triangle of light behind the pegs)
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 90, 10, 128, 120, 150); gr.addColorStop(0, 'rgba(160,120,255,.55)'); gr.addColorStop(1, 'rgba(160,120,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.4, HB - 0.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  glow.position.set(0, CY, 0.005); board.add(glow);
}
// glossy frame tubes
const frameMat = glossy('#ff6fa3', { emissive: '#ff2d6f', emissiveIntensity: 0.35, roughness: 0.18 });
for (const [x, y, len, rot] of [[0, TOPB, W, 0], [0, BOT, W, 0], [-W / 2, CY, HB, 1], [W / 2, CY, HB, 1]]) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, len - 0.1, 6, 14), frameMat);
  m.rotation.z = rot ? 0 : Math.PI / 2; m.position.set(x, y, 0.05); m.castShadow = true; board.add(m);
}
// marquee bulbs around the frame (one instanced draw call)
const bulbPos = [];
for (let i = 0; i < 13; i++) { const x = -W / 2 + (i + 0.5) * W / 13; bulbPos.push([x, TOPB], [x, BOT]); }
for (let i = 0; i < 15; i++) { const y = BOT + (i + 0.5) * HB / 15; bulbPos.push([-W / 2, y], [W / 2, y]); }
const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial(), bulbPos.length);
bulbPos.forEach(([x, y], i) => { bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, 0.19)); bulbs.setColorAt(i, new THREE.Color('#fff')); });
board.add(bulbs);

// pegs (instanced) — light up when hit
const pegIndex = []; let nPeg = 0;
for (let r = 0; r < ROWS; r++) { pegIndex.push(nPeg); nPeg += r + 3; }
const pegGeo = new THREE.CylinderGeometry(PEG_R, PEG_R, 0.34, 16); pegGeo.rotateX(Math.PI / 2);
const pegs = new THREE.InstancedMesh(pegGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.1, emissive: '#3a2a80', emissiveIntensity: 0.4 }), nPeg);
const capGeo = new THREE.SphereGeometry(PEG_R * 1.05, 14, 10);
const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), nPeg);
const pegGlow = new Float32Array(nPeg), PEG_BASE = new THREE.Color('#e9e3ff'), PEG_LIT = new THREE.Color('#ffb300'), CAP_BASE = new THREE.Color('#ffffff'), tmpC = new THREE.Color();
const m4 = new THREE.Matrix4();
for (let r = 0; r < ROWS; r++) for (let j = 0; j < r + 3; j++) {
  const i = pegIndex[r] + j;
  pegs.setMatrixAt(i, m4.makeTranslation(pegX(r, j), rowY(r), Z)); pegs.setColorAt(i, PEG_BASE);
  caps.setMatrixAt(i, m4.makeTranslation(pegX(r, j), rowY(r), Z + 0.17)); caps.setColorAt(i, CAP_BASE);
}
pegs.castShadow = true; board.add(pegs, caps);

// dropper at the top
const dropper = new THREE.Group(); dropper.position.set(0, SPAWN_Y + 0.12, Z); board.add(dropper);
{
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.16, 0.36, 24, 1, true), glossy('#ffd23f', { side: THREE.DoubleSide, metalness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.2 }));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 10, 28), glossy('#fff2b3', { metalness: 0.3 })); lip.rotation.x = Math.PI / 2; lip.position.y = 0.18;
  cone.castShadow = true; dropper.add(cone, lip);
}

// slots (buckets) with multiplier labels
function slotColor(k) {   // hot edges → warm centre
  const d = Math.abs(k - ROWS / 2) / (ROWS / 2);
  const stops = [[0, '#ffc933'], [0.45, '#ff9a3c'], [0.75, '#ff5a5f'], [1, '#ff2d6f']];
  for (let i = 1; i < stops.length; i++) if (d <= stops[i][0]) { const [a0, c0] = stops[i - 1], [a1, c1] = stops[i]; return '#' + new THREE.Color(c0).lerp(new THREE.Color(c1), (d - a0) / (a1 - a0)).getHexString(); }
  return '#ff2d6f';
}
const slots = [];
const slotGeo = rounded(SP * 0.9, 0.46, 0.3, 0.08);
for (let k = 0; k < SLOTS; k++) {
  const g = new THREE.Group(); g.position.set((k - ROWS / 2) * SP, SLOT_Y, Z);
  const col = slotColor(k);
  const box = new THREE.Mesh(slotGeo, glossy(col, { emissive: col, emissiveIntensity: 0.25 })); box.castShadow = true; box.receiveShadow = true;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(SP * 0.92, SP * 0.92 * 0.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  lab.position.z = 0.16;
  g.add(box, lab); board.add(g);
  slots.push({ g, box, cv, tex, col, hit: 0 });
}
function drawLabels() {
  const m = RISKS[risk].mult;
  slots.forEach((s, k) => {
    const g = s.cv.getContext('2d'); g.clearRect(0, 0, 128, 96);
    const txt = fmtM(m[k]); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${txt.length > 4 ? 40 : txt.length > 3 ? 46 : 54}px "Baloo 2", system-ui, sans-serif`;
    g.lineWidth = 9; g.strokeStyle = 'rgba(60,20,40,.55)'; g.strokeText(txt, 64, 52); g.fillStyle = '#fff'; g.fillText(txt, 64, 52);
    s.tex.needsUpdate = true;
  });
}

// ---------------------------------------------------------------- balls
const ballGeo = new THREE.SphereGeometry(BALL_R, 24, 18);
const BALL_COLS = ['#ff4d8d', '#ffd23f', '#3ad6c5', '#7b5cff', '#ff8c42'];
let balls = [], nBall = 0;
function drop() {
  if (state !== 'play' || pendingWin) return false;
  if (BETS[betI] > chips) { while (betI > 0 && BETS[betI] > chips) betI--; refreshCtl(); if (BETS[betI] > chips) return false; }
  const bet = BETS[betI], path = fairPath(), slot = path.reduce((a, b) => a + b, 0);
  chips -= bet; shown = Math.min(shown, chips + 0); // instant deduction
  // waypoints: spawn → contact on top of each peg → slot
  const pts = [new V3((Math.random() - 0.5) * 0.06, SPAWN_Y, Z)];
  let k = 0;
  for (let r = 0; r < ROWS; r++) { pts.push(new V3(pegX(r, k + 1) + (Math.random() - 0.5) * 0.03, rowY(r) + CONTACT, Z)); k += path[r]; }
  pts.push(new V3((slot - ROWS / 2) * SP, SLOT_Y + 0.12, Z));
  const col = BALL_COLS[nBall++ % BALL_COLS.length];
  const m = new THREE.Mesh(ballGeo, glossy(col, { roughness: 0.12, metalness: 0.15, emissive: col, emissiveIntensity: 0.18 }));
  m.castShadow = true; m.position.copy(pts[0]); scene.add(m);
  const tmat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false });
  const trail = [0, 1, 2, 3].map(() => { const t = new THREE.Mesh(ballGeo, tmat); t.position.copy(pts[0]); scene.add(t); return t; });
  balls.push({ m, trail, hist: [], pts, path, seg: 0, u: 0, slot, bet, risk, squash: 0, done: false });
  dropper.scale.set(1.15, 0.8, 1.15);
  tone(660, 0.06, 'triangle', 0.1, 1.3); buzz(6);
  refreshCtl(); return true;
}
function segDur(b) { return b.seg === 0 ? 0.3 : b.seg === ROWS ? 0.2 : 0.12; }
function stepBall(b, dts) {
  b.u += dts / segDur(b);
  while (b.u >= 1 && !b.done) {
    b.u -= 1; b.seg++;
    if (b.seg <= ROWS - 0) {
      if (b.seg <= ROWS) {
        const r = b.seg - 1;
        if (r < ROWS) { // hit a peg on row r
          let kk = 0; for (let i = 0; i < r; i++) kk += b.path[i];
          pegGlow[pegIndex[r] + kk + 1] = 1; b.squash = 1;
          tone(380 + r * 38, 0.035, 'sine', 0.06, 1.1);
        }
      }
    }
    if (b.seg > ROWS) { b.done = true; land(b); return; }
  }
  const a = b.pts[b.seg], c = b.pts[b.seg + 1], u = b.u;
  const v = b.seg === 0 ? 0 : b.seg === ROWS ? 0.1 : 0.17;     // small upward kick off each peg, then gravity
  b.m.position.set(lerp(a.x, c.x, u), a.y + v * u - (v + a.y - c.y) * u * u, Z);
  b.m.rotation.z -= (c.x - a.x) * 0.9;
  b.squash = Math.max(0, b.squash - 0.2);
  b.m.scale.set(1 + b.squash * 0.14, 1 - b.squash * 0.16, 1);
  b.hist.unshift(b.m.position.clone()); if (b.hist.length > 10) b.hist.pop();
  b.trail.forEach((tm, i) => { const h = b.hist[Math.min(b.hist.length - 1, (i + 1) * 2)]; tm.position.copy(h); tm.scale.setScalar(0.8 - i * 0.17); });
}
const hEl = [];
function killBall(b) { scene.remove(b.m); b.m.material.dispose(); b.trail.forEach(t => scene.remove(t)); b.trail[0].material.dispose(); }
function land(b) {
  killBall(b);
  const s = slots[b.slot], mult = RISKS[b.risk].mult[b.slot], win = Math.round(b.bet * mult);
  chips += win; s.hit = 1;
  const wp = s.g.position.clone(); wp.y += 0.1; wp.z += 0.3;
  burst(scene, wp, [s.col, '#ffffff'], mult >= 2 ? 16 : 8, { speed: 0.06, up: 0.06, size: 0.6, gravity: 0.004 });
  floatText(wp, (win >= b.bet ? '+' : '') + fmt(win), mult >= 10 ? 40 : mult >= 2 ? 30 : 22, mult >= 1 ? '#ffe66d' : '#ffffff');
  if (mult >= 10) { ui.flash(0.55); confetti(scene, new V3(0, CY, 1), 70); buzz([30, 40, 60]); sfx.win(); ui.pop(`BIG WIN ${fmtM(mult)}`, '#ffd23f', 48, 40); shake = 1; }
  else if (mult >= 2) { sfx.coin(); buzz(15); shake = 0.35; }
  else if (mult >= 1) tone(700, 0.08, 'triangle', 0.1, 1.2);
  else tone(300, 0.1, 'sine', 0.08, 0.8);
  // results strip (last 6)
  const sp = document.createElement('span'); sp.textContent = fmtM(mult); sp.style.background = s.col; hist.prepend(sp);
  while (hist.children.length > 6) hist.lastChild.remove();
  if (D.beaten(chips) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 48, 30); confetti(scene, new V3(0, CY, 1), 50); }
  if (chips >= target && !pendingWin) { pendingWin = true; ui.pop('TARGET HIT!', '#fff', 42, 34); }
  refreshCtl();
}
function floatText(wp, txt, size, color) {
  const p = wp.clone().project(camera);
  const d = document.createElement('div'); d.className = 'pf-float'; d.textContent = txt; d.style.fontSize = size + 'px'; d.style.color = color;
  d.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
}

// ---------------------------------------------------------------- level flow
function setRisk(k) { if (!RISKS[k]) return; if (risk !== k) { risk = k; save.set('risk', k); drawLabels(); sfx.pick(1); } refreshCtl(); if (!panel.classList.contains('hid')) openOdds(); }
function buildLevel() {
  for (const b of balls) killBall(b); balls = [];
  target = targetFor(level); chips = START; shown = START; pendingWin = false; recorded = false;
  betI = 3; hist.innerHTML = ''; theme(); ui.levels(level); drawLabels(); refreshCtl(); hud();
}
function hud() {
  ui.score(fmt(shown));
  ui.sub(`Target ${fmt(target)} chips`);
  ui.progress((shown - START) / (target - START));
}
function checkEnd() {
  if (state !== 'play' || balls.length) return;
  if (pendingWin) {
    state = 'won'; recorded = true;
    const lv = level; level++; save.set('level', level); best = Math.max(best, chips); save.set('best', best);
    sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, new V3(0, CY, 1), 100);
    D.won(chips);
    ui.win(lv, `${fmt(chips)} chips · best ${fmt(best)}`);
    ctl.classList.add('off');
  } else if (chips < BETS[0]) {
    state = 'lost'; recorded = true; sfx.fail(); buzz([40, 30, 60]);
    ui.lose('OUT OF CHIPS', `Retry refills ${fmt(START)} chips`);
    ctl.classList.add('off');
  }
}
ui.onTap(which => {
  document.body.classList.remove('pf-ready');
  if (which === 'start') { state = 'play'; sfx.tap(); }
  else { buildLevel(); state = 'play'; }
  ctl.classList.remove('off'); refreshCtl();
});
// tapping the board drops a ball too (one verb)
S.renderer.domElement.addEventListener('pointerdown', () => drop());

// ---------------------------------------------------------------- loop
let shake = 0;
function fit() {
  const aspect = innerWidth / innerHeight, vf = THREE.MathUtils.degToRad(camera.fov / 2);
  // fit board width (portrait) or height (landscape), leaving room for HUD (top) and controls (bottom)
  const usableH = 1 - (160 + 175) / innerHeight;
  const dW = (W / 2 + 0.25) / (Math.tan(vf) * aspect), dH = (HB / 2 + 0.2) / (Math.tan(vf) * Math.max(0.45, usableH));
  const d = Math.max(dW, dH);
  // vertical offset so the board centre sits between HUD and controls
  const centerPx = 160 + (innerHeight - 160 - 175) / 2, off = (centerPx / innerHeight - 0.5) * 2 * Math.tan(vf) * d;
  return { d, off };
}
loop((dt, t) => {
  const dts = dt / 60;
  for (const b of balls) if (!b.done) stepBall(b, dts);
  balls = balls.filter(b => !b.done);
  // chip roll-up
  if (Math.abs(shown - chips) > 0.5) shown = lerp(shown, chips, 0.12 * dt); else shown = chips;
  hud(); checkEnd();
  // peg glow decay
  let dirty = false;
  for (let i = 0; i < nPeg; i++) if (pegGlow[i] > 0) {
    pegGlow[i] = Math.max(0, pegGlow[i] - 0.035 * dt); dirty = true;
    pegs.setColorAt(i, tmpC.copy(PEG_BASE).lerp(PEG_LIT, pegGlow[i]));
    caps.setColorAt(i, tmpC.copy(CAP_BASE).lerp(PEG_LIT, pegGlow[i]));
  }
  if (dirty) { pegs.instanceColor.needsUpdate = true; caps.instanceColor.needsUpdate = true; }
  // marquee chase
  const ph = Math.floor(t * 6);
  for (let i = 0; i < bulbPos.length; i++) bulbs.setColorAt(i, tmpC.set((i + ph) % 3 === 0 ? '#ffe66d' : (i % 2 ? '#ffd6f5' : '#fff8e0')).multiplyScalar((i + ph) % 3 === 0 ? 1 : 0.7));
  bulbs.instanceColor.needsUpdate = true;
  // slots bounce on hit
  for (const s of slots) { s.hit = Math.max(0, s.hit - 0.05 * dt); s.g.position.y = SLOT_Y - Math.sin(s.hit * Math.PI) * 0.12; s.g.scale.setScalar(1 + s.hit * 0.12); }
  dropper.scale.lerp(new V3(1, 1, 1), 0.15 * dt);
  // camera
  shake = Math.max(0, shake - 0.04 * dt);
  const { d, off } = fit();
  camera.position.set(Math.sin(t * 0.35) * 0.25 + (Math.random() - 0.5) * 0.08 * shake, CY - off - 1.4 + (Math.random() - 0.5) * 0.08 * shake, d);
  camera.lookAt(0, CY - off - 0.15, 0);
});

theme(); buildLevel(); ui.start();

// ---------------------------------------------------------------- test hooks
let botLast = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.round(chips); },
  bot() {
    if (state !== 'play' || pendingWin) return;
    if (risk !== 'med') setRisk('med');
    const now = performance.now(); if (now - botLast < 250 || balls.length >= 3) return;
    const want = chips * 0.2;
    let i = 0; while (i < BETS.length - 1 && BETS[i + 1] <= Math.min(want, chips)) i++;
    betI = i; refreshCtl();
    if (drop()) botLast = now;
  },
};

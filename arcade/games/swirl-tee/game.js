// Swirl Tee — original tie-dye game. Pick the fold, bind the shirt, squirt dye into each section, unfold for the reveal.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, burst, confetti, store, clamp, rng, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapter } from './kit/adapt.js';
import { board as worldBoard } from './kit/board.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, MIX, MUD } from './levels.js';
// deep v2 (studio lane 2): authored orders, more folds, colour mixing, wet fabric, the Tee Wall. READY stays false until
// v2 passed the fun gate; ?deep=1 opens it for QA, ?deep=0 forces v1.
const READY = true;
const DEEP = /[?&]deep=1/.test(location.search) || (!/[?&]deep=0/.test(location.search) && READY && ab('deep-swirl-tee'));

const $ = (id) => document.getElementById(id);
const ST = store('swirltee');
const F = flow('swirltee');
const WB = worldBoard({ game: 'swirl-tee', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });
let level = ST.get('level', 1), best = ST.get('best', 0), score = 0;
// ------------------------------------------------------------------ in-round adaptation (ADAPT_BRIEF.md): honest + bounded
// Reads ONLY how this player is playing right now: good/bad moves in the last 20 s and time since the last success.
// level −1 (struggling) … +1 (cruising) moves ≤ 0.25 per 3 s and drifts back to 0 when neutral. k(fk) = multiplier for a
// harder-when-bigger knob: ±20 %, and together with flow.js's between-run nudge it stays within ±25 %. Rescues: at most one
// per round and 60 s apart, only for a player who has been playing sensibly (never for an idle one). QA reads window.__game.adapt.
const AD = adapter(); let dabAt = 0, dabSig = 0;
// knobs (level 3+): the brush, up to 20 % fatter for a struggling player and 20 % finer when cruising, and the match target the
// unfold needs, up to 20 % lower / 10 % higher (the same number flow.js already scales between runs; the result card shows it)
const brushNow = () => L.brush * (level <= 2 ? 1 : 2 - AD.k());
let roundThr = 0;
const thrR = () => DEEP && roundThr ? roundThr : thrNow();
const thrNow = () => Math.min(0.9, L.thr * (level <= 2 ? 1 : AD.k(1, AD.level > 0 ? 0.1 : 0.2)));   // target: −20 % / +10 %
const ui = createUI({ title: 'SWIRL<br>TEE', hint: 'Tie-dye the shirt to match', hand: '👆', score: false });
const stage = createStage({ fov: 38, shadowSize: 6 });
const { scene, camera } = stage;
stage.followLight(new THREE.Vector3(0, 0, 0));

// ------------------------------------------------------------------ sand background (canvas noise tile)
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 220; const x = c.getContext('2d');
  x.fillStyle = '#e6cda2'; x.fillRect(0, 0, 220, 220);
  for (let i = 0; i < 5200; i++) {
    const v = Math.random(); x.fillStyle = v < 0.5 ? `rgba(160,120,70,${0.08 + Math.random() * 0.18})` : `rgba(255,248,230,${0.1 + Math.random() * 0.3})`;
    x.fillRect(Math.random() * 220, Math.random() * 220, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
  }
  document.body.style.background = `radial-gradient(ellipse at 50% 45%, rgba(255,240,215,.35), rgba(120,80,40,.18) 95%), url(${c.toDataURL()}) #e6cda2`;
  document.body.style.backgroundSize = 'cover, 220px 220px';
})();

// ------------------------------------------------------------------ helpers
const DYES = ['#2f2bff', '#ffb400', '#ff1f8e', '#10cf96', '#a321ff', '#ff3b30', '#00aaff', '#ff7a00'];
const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const DRGB = DYES.map(rgbOf);
// v2: index 8 = mud (a third colour on a mix); kept out of DYES so v1's seeded levels stay the same
const COLS = [...DYES, '#7a5c3e'], CRGB = COLS.map(rgbOf);
const GEO = { spiral: 'spiral', rings: 'rings', stripes: 'stripes', burst: 'spiral', diag: 'stripes', heart: 'rings' };
const COMP = { 0: [0], 1: [1], 5: [5], 3: [0, 1], 7: [1, 5], 4: [0, 5], 8: [0, 1, 5] };
function mixCol(old, c) {   // what a section turns into when colour c lands on colour old (mix levels only)
  if (old < 0 || old === c || !COMP[old] || !COMP[c]) return c;
  const u = [...new Set([...COMP[old], ...COMP[c]])].sort((a, b) => a - b);
  return u.length === 1 ? u[0] : u.length === 2 ? MIX[u.join(',')] : MUD;
}
// heart metric: s such that (x/s, y/s) sits on the heart curve (x²+y²−1)³ = x²y³ (point down, lobes up)
function heartR(x, y) {
  const inside = (a, b) => { const q = a * a + b * b - 1; return q * q * q - a * a * b * b * b <= 0; };
  let lo = 0.01, hi = 8; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (inside(x / m, y / m)) hi = m; else lo = m; }
  return hi;
}
function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ------------------------------------------------------------------ table + props
function slabGeo(w, l, t, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -l / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + l - r);
  s.quadraticCurveTo(x + w, y + l, x + w - r, y + l); s.lineTo(x + r, y + l); s.quadraticCurveTo(x, y + l, x, y + l - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 4, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); g.translate(0, -t - 0.1, 0); return g;
}
const TW = 5.5, TL = 8.6, TZ = 0.35;
const table = new THREE.Mesh(slabGeo(TW, TL, 0.34, 0.75), mat('#ffd02e', { roughness: 0.55, emissive: '#ffb000', emissiveIntensity: 0.12 }));
table.position.z = TZ; table.receiveShadow = true; table.castShadow = true; scene.add(table);
const legM = mat('#f4f4f8', { roughness: 0.3, metalness: 0.3 });
for (const [x, z] of [[-2.1, 4.1], [2.1, 4.1], [-2.1, -3.4], [2.1, -3.4]]) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 10), legM); leg.position.set(x, -1.5, z + TZ); leg.castShadow = true; scene.add(leg);
  const bar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 6, 16, Math.PI), legM); bar.position.set(x, -2.55, z + TZ); bar.rotation.set(0, Math.PI / 2, Math.PI); scene.add(bar);
}
const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -2.6; floorShadow.receiveShadow = true; scene.add(floorShadow);
// dye splats on the table top
const SPC = document.createElement('canvas'); SPC.width = 330; SPC.height = 516; const spx = SPC.getContext('2d');
const spTex = new THREE.CanvasTexture(SPC); spTex.colorSpace = THREE.SRGBColorSpace;
const splats = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.4, TL - 0.4), new THREE.MeshStandardMaterial({ map: spTex, transparent: true, depthWrite: false, roughness: 0.6 }));
splats.rotation.x = -Math.PI / 2; splats.position.set(0, 0.006, TZ); splats.receiveShadow = true; scene.add(splats);
function tableSplat(wx, wz, col, a = 0.28, rad = 0.35) {
  const px = (wx / (TW - 0.4) + 0.5) * SPC.width, py = ((wz - TZ) / (TL - 0.4) + 0.5) * SPC.height, R = rad * SPC.width / (TW - 0.4);
  const [r, g, b] = rgbOf(col);
  for (let i = 0; i < 3; i++) {
    const ox = (Math.random() - 0.5) * R, oy = (Math.random() - 0.5) * R, rr = R * (0.4 + Math.random() * 0.7);
    const gr = spx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
    gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(0.7, `rgba(${r},${g},${b},${a * 0.7})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    spx.fillStyle = gr; spx.beginPath(); spx.arc(px + ox, py + oy, rr, 0, 7); spx.fill();
  }
  spTex.needsUpdate = true;
}

// ------------------------------------------------------------------ bottles (tip at group origin)
function makeBottle(col) {
  const g = new THREE.Group(), body = glossy(col, { roughness: 0.18 }), white = mat('#ffffff', { roughness: 0.35 });
  const parts = [
    [new THREE.ConeGeometry(0.075, 0.3, 14), body, -0.15],
    [new THREE.CylinderGeometry(0.13, 0.15, 0.18, 18), white, -0.38],
    [new THREE.CylinderGeometry(0.17, 0.25, 0.16, 20), white, -0.54],
    [new THREE.CylinderGeometry(0.25, 0.25, 0.78, 22), body, -1.0],
    [new THREE.CylinderGeometry(0.255, 0.255, 0.18, 22), white, -0.72],
  ];
  for (const [geo, m, y] of parts) { const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.castShadow = true; g.add(mesh); }
  g.userData.body = body; g.scale.setScalar(1.15); return g;
}
let slotBottles = [];
const hand = makeBottle(DYES[0]); scene.add(hand); hand.visible = false;
const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.15 }));
stream.visible = false; scene.add(stream); const UP = new THREE.Vector3(0, 1, 0), tmpS = new THREE.Vector3();
const handPos = new THREE.Vector3(2.2, 1.6, 1.6), handGoal = handPos.clone(); let squeeze = 0;

// ------------------------------------------------------------------ the shirt
const SX0 = -2.3, SY0 = 2.4, SSZ = 4.6;   // shirt texture square: x in [-2.3, 2.3], y in [-2.2, 2.4]
const SHIRT = [['m', -0.62, 2.08], ['q', 0, 1.42, 0.62, 2.08], ['l', 1.38, 1.86], ['q', 1.85, 1.6, 2.27, 0.98], ['l', 1.66, 0.36], ['l', 1.36, 0.72],
  ['l', 1.4, -2.0], ['q', 0, -2.22, -1.4, -2.0], ['l', -1.36, 0.72], ['l', -1.66, 0.36], ['l', -2.27, 0.98], ['q', -1.85, 1.6, -1.38, 1.86]];
function shirtPath(target, map) {   // works for THREE.Shape (map = identity) or a 2D context (map = shirt -> px)
  for (const c of SHIRT) {
    const p = c.slice(1).map((v, i) => map(v, i % 2));
    if (c[0] === 'm') target.moveTo(p[0], p[1]); else if (c[0] === 'l') target.lineTo(p[0], p[1]); else target.quadraticCurveTo(p[0], p[1], p[2], p[3]);
  }
  target.closePath && target.closePath();
}
const shirtGeo = (() => {
  const s = new THREE.Shape(); shirtPath(s, (v) => v);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 14 });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - SX0) / SSZ, (p.getY(i) - (SY0 - SSZ)) / SSZ);
  g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g;
})();
function fabricCanvas(S = 512) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#fbfbfd'; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(150,150,175,.16)'; x.lineCap = 'round';
  for (let i = 0; i < 14; i++) { x.lineWidth = 2 + Math.random() * 5; x.beginPath(); const a = Math.random() * S, b = Math.random() * S; x.moveTo(a, b); x.quadraticCurveTo(a + (Math.random() - .5) * 200, b + (Math.random() - .5) * 200, a + (Math.random() - .5) * 260, b + (Math.random() - .5) * 260); x.stroke(); }
  return c;
}
function collar(x, S) {
  const toPx = (v, i) => i === 0 ? (v - SX0) / SSZ * S : (SY0 - v) / SSZ * S;
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = S * 0.018; x.beginPath(); x.moveTo(toPx(-0.62, 0), toPx(2.08, 1)); x.quadraticCurveTo(toPx(0, 0), toPx(1.42, 1), toPx(0.62, 0), toPx(2.08, 1)); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = S * 0.006; x.beginPath(); x.moveTo(toPx(-0.66, 0), toPx(2.0, 1)); x.quadraticCurveTo(toPx(0, 0), toPx(1.32, 1), toPx(0.66, 0), toPx(2.0, 1)); x.stroke();
}
const whiteC = fabricCanvas(); collar(whiteC.getContext('2d'), 512);
const whiteTex = new THREE.CanvasTexture(whiteC); whiteTex.colorSpace = THREE.SRGBColorSpace;
const shirtMat = new THREE.MeshStandardMaterial({ map: whiteTex, roughness: 0.85 });
const shirt = new THREE.Mesh(shirtGeo, shirtMat); shirt.castShadow = true; shirt.receiveShadow = true; scene.add(shirt);
const patC = document.createElement('canvas'); patC.width = patC.height = 512;
const patTex = new THREE.CanvasTexture(patC); patTex.colorSpace = THREE.SRGBColorSpace;

// ------------------------------------------------------------------ level
const FOLDS = ['spiral', 'rings', 'stripes'];
function genLevel(lv) {
  // hook ramp: level 1 = 2 big stripes (one fold button, fat brush), level 2 = 2 rings; level 3+ = the old curve from its level 1
  if (lv === 1) return { fold: 'stripes', N: 2, cols: [2, 6], btns: [2, 6], thr: 0.6, twist: 5, seed: 11, brush: 0.62, folds: 1, guide: true };
  if (lv === 2) return { fold: 'rings', N: 2, cols: [1, 4], btns: [1, 4, 3], thr: 0.65, twist: 5, seed: 23, brush: 0.46, folds: 2, guide: true };
  lv = lv - 2;
  const r = rng(lv * 7919 + 13), fk = F.k();
  const fold = lv <= 3 ? FOLDS[lv - 1] : ['spiral', 'rings', 'stripes', 'spiral'][Math.floor(r() * 4)];
  // steeper (2026-10-25, "too easy"): more sections, colours and decoy dyes sooner, a higher match target and a finer brush each level
  const N = fold === 'spiral' ? Math.min(8, 3 + lv) : fold === 'rings' ? Math.min(5, 2 + Math.floor((lv + 1) / 2)) : Math.min(6, 3 + Math.floor(lv / 2));
  const order = DYES.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const nCol = Math.max(2, Math.min(N, 2 + lv, 5)), tpal = order.slice(0, nCol), cols = [];
  for (let i = 0; i < N; i++) {
    let c, tries = 0;
    do { c = tpal[Math.floor(r() * nCol)]; tries++; } while (tries < 30 && (c === cols[i - 1] || (fold === 'spiral' && i === N - 1 && c === cols[0]) || (i < nCol && cols.includes(c))));
    cols.push(c);
  }
  const btns = order.slice(0, Math.min(6, nCol + 1 + (lv >= 3 ? 1 : 0)));
  for (let i = btns.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [btns[i], btns[j]] = [btns[j], btns[i]]; }
  return { fold, N, cols, btns, thr: Math.min(0.9, (0.7 + (lv - 1) * 0.03) * fk), twist: 4.6 + r() * 2.2, seed: r() * 100, brush: Math.max(0.21, (0.34 - lv * 0.02) / fk), folds: 3, guide: false };
}

// v2 orders: levels.js 1-36, then generated from every fold and mechanic (seeded per level, the same for everyone)
const NEWF = ['burst', 'diag', 'heart'];
function deepLevel(lv) {
  let t = LEVELS[lv - 1];
  if (!t) {
    const r = rng(lv * 7919 + 101), folds = ['spiral', 'rings', 'stripes', 'burst', 'diag', 'heart'];
    const fold = folds[Math.floor(r() * 6)], g = GEO[fold], mix = r() < 0.45, wet = r() < 0.5, hard = lv % 7 === 0;
    const N = g === 'spiral' ? 4 + Math.floor(r() * 3) : g === 'rings' ? 3 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
    const pal = mix ? [5, 7, 1, 3, 0, 4] : [0, 1, 2, 3, 4, 5, 6, 7], cols = [];
    for (let i = 0; i < N; i++) { let c, n = 0; do { c = pal[Math.floor(r() * pal.length)]; n++; } while (n < 30 && (c === cols[i - 1] || (g === 'spiral' && i === N - 1 && c === cols[0]))); cols.push(c); }
    let btns = mix ? [5, 1, 0] : [...new Set(cols)]; if (!mix) while (btns.length < Math.min(6, new Set(cols).size + 2)) { const d = Math.floor(r() * 8); if (!btns.includes(d)) btns.push(d); }
    for (let i = btns.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [btns[i], btns[j]] = [btns[j], btns[i]]; }
    const shown = [fold]; while (shown.length < 4) { const f = folds[Math.floor(r() * 6)]; if (!shown.includes(f)) shown.push(f); }
    t = { fold, N, cols, btns, folds: shown.sort(), thr: hard ? 0.8 : 0.77, par: Math.round((8 + N * 3.4 + (mix ? cols.filter(c => [3, 7, 4].includes(c)).length * 2 : 0) + (wet ? 3 : 0)) * 0.8), brush: hard ? 0.28 : 0.3, mix, wet, hard, cust: ['🧑', '👩', '🧓', '👨‍🦱', '👩‍🦳', '🐵', '🐯', '🐷'][Math.floor(r() * 8)] };
  }
  const r = rng(lv * 131 + 7), fk = lv > 2 ? F.k() : 1;
  if (!t.bonus) t = { ...t, par: Math.round(t.par * 1.8) };   // par is a human thumb on a phone, not a bot
  return { ...t, folds: t.folds, twist: t.fold === 'burst' ? 0.25 + r() * 0.2 : 4.6 + r() * 2.2, seed: r() * 100,
    thr: t.bonus ? 0 : Math.min(0.9, t.thr * fk), brush: t.brush / fk, guide: !!t.guide, lv };
}

// bundle space: nx, nz in [-1, 1]; the bound shirt is an ellipse nx² + (nz/Q)² <= 1, world = n * EXT
let L, EXT = 1.5, Q = 1, BH = 0.62;
function secOf(nx, nz) {
  if (nx * nx + (nz / Q) ** 2 > 1) return -1;
  const g = GEO[L.fold];
  if (g === 'spiral') return Math.min(L.N - 1, Math.floor((Math.atan2(nz, nx) + Math.PI) / (2 * Math.PI) * L.N));
  if (g === 'rings') return Math.min(L.N - 1, Math.floor(Math.hypot(nx, nz) * L.N));
  return clamp(Math.floor((nx + 1) / 2 * L.N), 0, L.N - 1);
}
function bump(nx, nz) {
  const N = L.N, g = GEO[L.fold];
  if (g === 'spiral') return 0.1 * Math.abs(Math.sin((Math.atan2(nz, nx) + Math.PI) * N / 2)) * Math.min(1, Math.hypot(nx, nz) * 2.5);
  if (g === 'rings') return 0.1 * Math.abs(Math.sin(Math.hypot(nx, nz) * N * Math.PI));
  return 0.1 * Math.abs(Math.sin((nx + 1) / 2 * N * Math.PI));
}
const surfY = (nx, nz) => { const s = 1 - nx * nx - (nz / Q) ** 2; return s > 0 ? BH * Math.sqrt(s) : 0; };

// pattern renderer: shared by the target thumbnail and the reveal (sample(nx, nz) -> [r, g, b])
function drawPattern(ctx, S, lv, sample) {
  const img = ctx.createImageData(S, S), d = img.data, N = lv.N, sd = lv.seed;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = SX0 + (px + 0.5) / S * SSZ, y = SY0 - (py + 0.5) / S * SSZ;
    const w1 = vnoise(x * 1.7 + sd, y * 1.7) - 0.5, w2 = vnoise(x * 5 + sd, y * 5 - sd) - 0.5;
    let nx, nz, bd;
    if (lv.fold === 'diag' || lv.fold === 'heart') {   // v2 folds (spiral-like burst is a spiral with almost no twist)
      if (lv.fold === 'diag') {
        const ca = 0.82, sa = 0.57, dx = x - 0.05, dy = y - 0.1, u = (-dy * ca + dx * sa) / 2.75, v = (dy * sa + dx * ca) / 2.75;
        const t = (u + 1) / 2; nx = clamp(-0.97 + 1.94 * t + w1 * 0.08 + w2 * 0.025 + Math.sin(v * 3 + sd) * 0.03, -0.98, 0.98);
        nz = clamp(v, -1, 1) * Q * 0.85 * Math.sqrt(Math.max(0, 1 - nx * nx));
        const f = (nx + 1) / 2 * N, k = Math.round(f); bd = (k > 0 && k < N) ? Math.abs(f - k) * 2 / N : 1;
      } else {
        const dx = x - 0.02, dy = y + 0.05, r = heartR(dx / 1.0, dy / 1.0) / 2.05 + w1 * 0.08 + w2 * 0.025, th = Math.atan2(-dy, dx);
        const rb = clamp(r, 0, 0.98); nx = rb * Math.cos(th); nz = rb * Math.sin(th);
        const f = rb * N, k = Math.round(f); bd = (k > 0 && k < N) ? Math.abs(f - k) / N : 1;
      }
    } else if (lv.fold === 'spiral' || lv.fold === 'burst') {
      const dx = x - 0.05, dy = y - 0.15, r = Math.hypot(dx, dy) / 2.6, th = Math.atan2(-dy, dx);
      const tb = th + lv.twist * Math.min(r, 1.3) + w1 * 0.35 + w2 * 0.08, rb = Math.min(0.96, 0.1 + 0.86 * Math.min(1, r));
      nx = rb * Math.cos(tb); nz = rb * Math.sin(tb);
      const f = (Math.atan2(nz, nx) + Math.PI) / (2 * Math.PI) * N; bd = Math.abs(f - Math.round(f)) * (2 * Math.PI / N) * Math.max(0.35, rb);
    } else if (lv.fold === 'rings') {
      const dx = x - 0.05, dy = y - 0.1, r = Math.hypot(dx, dy) / 2.5 + w1 * 0.1 + w2 * 0.03, th = Math.atan2(-dy, dx);
      const rb = clamp(r, 0, 0.98); nx = rb * Math.cos(th); nz = rb * Math.sin(th);
      const f = rb * N, k = Math.round(f); bd = (k > 0 && k < N) ? Math.abs(f - k) / N : 1;
    } else {
      const t = (SY0 - y) / SSZ; nx = clamp(-0.97 + 1.94 * t + w1 * 0.08 + w2 * 0.025 + Math.sin(x * 1.6 + sd) * 0.03, -0.98, 0.98);
      nz = (x / 2.3) * Q * 0.85 * Math.sqrt(Math.max(0, 1 - nx * nx));
      const f = (nx + 1) / 2 * N, k = Math.round(f); bd = (k > 0 && k < N) ? Math.abs(f - k) * 2 / N : 1;
    }
    let [cr, cg, cb] = sample(nx, nz);
    const lw = 0.022 + 0.035 * vnoise(x * 3 - sd, y * 3), wt = (1 - smooth(lw * 0.25, lw, bd)) * 0.9;     // resist lines where the strings were
    const ck = vnoise(x * 11 + sd, y * 11), crack = ck > 0.84 ? (ck - 0.84) * 2.2 : 0;               // fine crackle
    const lit = 1 + (vnoise(x * 2.3, y * 2.3 + sd) - 0.5) * 0.16, wf = Math.min(1, wt + crack);
    const i = (py * S + px) * 4;
    d[i] = clamp((cr * lit) * (1 - wf) + 255 * wf, 0, 255); d[i + 1] = clamp((cg * lit) * (1 - wf) + 252 * wf, 0, 255); d[i + 2] = clamp((cb * lit) * (1 - wf) + 252 * wf, 0, 255); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); collar(ctx, S);
}
const targetSampler = (lv) => (nx, nz) => { const s = secOf(nx, nz); return s < 0 ? [250, 250, 252] : DRGB[lv.cols[s]]; };
function drawTarget() {
  const S = 168, tmp = document.createElement('canvas'); tmp.width = tmp.height = S;
  drawPattern(tmp.getContext('2d'), S, L, targetSampler(L));
  const x = $('tgtc').getContext('2d'); x.clearRect(0, 0, S, S);
  const toPx = (v, i) => i === 0 ? (v - SX0) / SSZ * S : (SY0 - v) / SSZ * S;
  x.save(); x.beginPath(); shirtPath(x, toPx); x.clip(); x.drawImage(tmp, 0, 0); x.restore();
  x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.12)'; x.beginPath(); shirtPath(x, toPx); x.stroke();
}

// ------------------------------------------------------------------ bundle (bound shirt) with a paintable top
const CS = 512, BC = document.createElement('canvas'); BC.width = BC.height = CS; const bctx = BC.getContext('2d');
const bTex = new THREE.CanvasTexture(BC); bTex.colorSpace = THREE.SRGBColorSpace;
const bundleMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.8 });
const stringMat = mat('#2a1d33', { roughness: 0.6 });
let bundle = null, strings = [], markers = [], flying = [];
let G = 60, cellSec, cellCol, secCells, secDone, cellT, cellN, baseC = null, paintAt = 0;
function buildBundle() {
  if (bundle) { scene.remove(bundle); bundle.geometry.dispose(); }
  strings.forEach(s => { scene.remove(s); s.geometry.dispose(); }); strings = [];
  markers.forEach(m => scene.remove(m)); markers = [];
  EXT = GEO[L.fold] === 'stripes' ? 1.95 : 1.55; Q = GEO[L.fold] === 'stripes' ? 0.5 : 1;
  const geo = new THREE.SphereGeometry(1, 112, 56), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i), nx = sx, nz = sz * Q;
    const ang = Math.atan2(nz, nx), rr = Math.hypot(nx, nz), crumple = (vnoise(nx * 4 + 3, nz * 4) - 0.5) * 0.14 + (vnoise(nx * 9, nz * 9 + 7) - 0.5) * 0.06 + Math.sin(ang * 23 + rr * 9) * 0.018 * rr;
    const y = sy > 0 ? sy * BH + bump(nx, nz) * sy + crumple * Math.min(1, sy * 2.5) : sy * 0.08;
    const rim = 1 + (sy > -0.2 && sy < 0.4 ? Math.sin(ang * 11 + 1.3) * 0.025 + (vnoise(ang * 3, 1) - 0.5) * 0.06 : 0);
    p.setXYZ(i, nx * EXT * rim, y, nz * EXT * rim); uv.setXY(i, (nx + 1) / 2, 1 - (nz + 1) / 2);
  }
  geo.computeVertexNormals();
  bundle = new THREE.Mesh(geo, bundleMat); bundle.castShadow = true; bundle.receiveShadow = true; scene.add(bundle);
  // white fabric with folds
  bctx.drawImage(fabricCanvas(CS), 0, 0);
  bctx.strokeStyle = 'rgba(140,140,170,.18)'; bctx.lineWidth = 6;
  for (let k = 0; k < 26; k++) { const a = k / 26 * 6.283; bctx.beginPath(); bctx.moveTo(CS / 2, CS / 2); bctx.quadraticCurveTo(CS / 2 + Math.cos(a + 0.5) * 120, CS / 2 + Math.sin(a + 0.5) * 120, CS / 2 + Math.cos(a) * 256, CS / 2 + Math.sin(a) * 256); bctx.stroke(); }
  bTex.needsUpdate = true;
  if (DEEP) { baseC = baseC || document.createElement('canvas'); baseC.width = baseC.height = CS; baseC.getContext('2d').drawImage(BC, 0, 0); }
  // strings
  const P = (nx, nz, lift = 0.04) => new THREE.Vector3(nx * EXT, surfY(nx, nz) + lift, nz * EXT);
  const tube = (pts, closed = false) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 64, 0.045, 6, closed), stringMat); m.castShadow = true; scene.add(m); strings.push(m); m.scale.setScalar(0.001); };
  for (let k = (GEO[L.fold] === 'spiral' ? 0 : 1); k < L.N; k++) {
    const pts = [];
    if (GEO[L.fold] === 'spiral') { const a = -Math.PI + k * 2 * Math.PI / L.N; for (let i = 0; i <= 16; i++) { const r = i / 16 * 0.99; pts.push(P(r * Math.cos(a), r * Math.sin(a))); } pts.push(new THREE.Vector3(Math.cos(a) * EXT * 1.03, 0.03, Math.sin(a) * EXT * 1.03)); }
    else if (GEO[L.fold] === 'rings') { const rr = k / L.N; for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; pts.push(P(rr * Math.cos(a), rr * Math.sin(a))); } }
    else { const nx = -1 + 2 * k / L.N, zm = Q * Math.sqrt(1 - nx * nx); pts.push(new THREE.Vector3(nx * EXT, 0.03, -zm * EXT * 1.04)); for (let i = 0; i <= 14; i++) { const nz = -zm * 0.99 + i / 14 * zm * 1.98; pts.push(P(nx, nz)); } pts.push(new THREE.Vector3(nx * EXT, 0.03, zm * EXT * 1.04)); }
    tube(pts, GEO[L.fold] === 'rings');
  }
  // section dots that show which colour goes where
  for (let k = 0; k < (DEEP && L.bonus ? 0 : L.N); k++) {
    let nx, nz;
    if (GEO[L.fold] === 'spiral') { const a = -Math.PI + (k + 0.5) * 2 * Math.PI / L.N; nx = 0.58 * Math.cos(a); nz = 0.58 * Math.sin(a); }
    else if (GEO[L.fold] === 'rings') { const a = Math.PI / 2 - 0.5 + k * 0.7, r = k === 0 ? 0 : (k + 0.5) / L.N; nx = r * Math.cos(a); nz = r * Math.sin(a); }
    else { nx = -1 + (2 * k + 1) / L.N; nz = 0; }
    const g = new THREE.Group(), c = DYES[L.cols[k]];
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), glossy(c)); dot.scale.y = 0.7;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 24), mat('#ffffff')); ring.rotation.x = -Math.PI / 2;
    g.add(dot, ring);
    if (DEEP && L.mix && L.hint && COMP[L.cols[k]] && COMP[L.cols[k]].length === 2) {   // mix dot: its two drops orbit it
      COMP[L.cols[k]].forEach((c2, j) => { const d2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), glossy(DYES[c2])); d2.position.set(j ? 0.3 : -0.3, 0.02, 0); g.add(d2); });
      ring.scale.setScalar(1.15);
    }
    g.position.copy(P(nx, nz, 0.12)); g.userData.y = g.position.y; g.scale.setScalar(0.001); scene.add(g); markers.push(g);
  }
  // coverage grid
  G = DEEP ? 96 : 60;
  cellT = new Float32Array(G * G); cellN = new Float32Array(G * G).map((_, i) => vnoise((i % G) * 0.35, Math.floor(i / G) * 0.35));
  cellSec = new Int8Array(G * G); cellCol = new Int8Array(G * G).fill(-1); secCells = new Array(L.N).fill(0); secDone = new Array(L.N).fill(false);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const s = secOf(-1 + (i + 0.5) * 2 / G, -1 + (j + 0.5) * 2 / G); cellSec[j * G + i] = s; if (s >= 0) secCells[s]++; }
  bundle.visible = false;
}
function sectionPath(ctx, s) {
  const c = CS / 2; ctx.beginPath();
  if (GEO[L.fold] === 'spiral') { const a0 = -Math.PI + s * 2 * Math.PI / L.N; ctx.moveTo(c, c); ctx.arc(c, c, c * 1.05, a0, a0 + 2 * Math.PI / L.N); ctx.closePath(); }
  else if (GEO[L.fold] === 'rings') { const r0 = s / L.N * c, r1 = s === L.N - 1 ? c * 1.05 : (s + 1) / L.N * c; ctx.arc(c, c, r1, 0, 6.2832); if (r0 > 0) { ctx.moveTo(c + r0, c); ctx.arc(c, c, r0, 0, 6.2832, true); } }
  else { ctx.rect(s / L.N * CS, 0, CS / L.N, CS); }
}
function secFrac(s, col = L.cols[s]) {
  let n = 0; const any = DEEP && L.bonus;   // a free-dye shirt counts any colour
  for (let i = 0; i < G * G; i++) if (cellSec[i] === s && (any ? cellCol[i] >= 0 : cellCol[i] === col)) n++;
  return n / Math.max(1, secCells[s]);
}

// ------------------------------------------------------------------ painting
let sel = -1, dripT = 0, doneN = 0, autoRev = 0;
function dab(nx, nz) {
  if (DEEP) return dabDeep(nx, nz);
  if (sel < 0) return false;
  const s = secOf(nx, nz); if (s < 0) return false;
  if (L.guide && sel !== L.cols[s] && L.btns.includes(L.cols[s])) selectDye(L.cols[s]);   // levels 1-2: the bottle picks the dot's colour for you
  const now = performance.now(); dabAt = now;
  if (now - dabSig > 250) { dabSig = now; if (sel !== L.cols[s]) AD.bad(0.25); else if (secFrac(s) < 0.88) AD.good(0.1); }   // wrong colour in a section vs. filling the right one
  const R = brushNow() * CS / 2, px = (nx + 1) / 2 * CS, py = (nz + 1) / 2 * CS, [r, g, b] = DRGB[sel];
  bctx.save(); sectionPath(bctx, s); bctx.clip();
  for (let i = 0; i < 4; i++) {
    const ox = (Math.random() - 0.5) * R * 0.7, oy = (Math.random() - 0.5) * R * 0.7, rr = R * (0.55 + Math.random() * 0.55);
    const gr = bctx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
    gr.addColorStop(0, `rgba(${r},${g},${b},.95)`); gr.addColorStop(0.65, `rgba(${r},${g},${b},.8)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    bctx.fillStyle = gr; bctx.beginPath(); bctx.arc(px + ox, py + oy, rr, 0, 7); bctx.fill();
  }
  bctx.restore(); bTex.needsUpdate = true;
  const rad = brushNow() * 0.92;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const k = j * G + i; if (cellSec[k] !== s) continue;
    const cx = -1 + (i + 0.5) * 2 / G, cz = -1 + (j + 0.5) * 2 / G; if ((cx - nx) ** 2 + (cz - nz) ** 2 < rad * rad) cellCol[k] = sel;
  }
  // juice
  const wp = new THREE.Vector3(nx * EXT, surfY(nx, nz) + 0.05, nz * EXT);
  burst(scene, wp, DYES[sel], 2, { shape: 'sphere', speed: 0.035, up: 0.03, size: 0.5, gravity: 0.008, life: 0.5 });
  if (Math.random() < 0.18) { const a = Math.random() * 6.283, d = EXT * (1.15 + Math.random() * 0.5); tableSplat(Math.cos(a) * d, Math.sin(a) * d * (Q < 1 ? 0.7 : 1), DYES[sel], 0.22, 0.25 + Math.random() * 0.3); }
  if (++dripT % 2 === 0) tone(700 + Math.random() * 500, 0.045, 'sine', 0.06, 0.45);
  squeeze = 1;
  const f = secFrac(s);
  if (!secDone[s] && f >= 0.88) {
    secDone[s] = true; doneN++; markers[s].userData.gone = true; AD.good();
    ui.pop(doneN === L.N ? 'ALL DYED!' : ['PERFECT!', 'NICE!', 'JUICY!', 'SO COOL!'][doneN % 4], '#fff', 38, 21);
    note(64 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, doneN - 1)], 0.3, 0.16); buzz(15);
    burst(scene, markers[s].position, [DYES[L.cols[s]], '#ffffff'], 12, { shape: 'sphere', speed: 0.07, up: 0.08, size: 0.7 });
  } else if (secDone[s] && f < 0.6) { secDone[s] = false; doneN--; markers[s].userData.gone = false; }
  ui.progress(0.12 + 0.75 * doneN / L.N);
  $('done').classList.toggle('go', doneN === L.N);
  if (L.guide && doneN === L.N && !autoRev) autoRev = setTimeout(() => { autoRev = 0; if (phase === 'dye' && doneN === L.N) reveal(); }, 550);
  return true;
}
// v2 painting: the dye lives in the cell grid (one colour per cell, mixes and mud included) and is drawn from it, so what
// you see is exactly what is scored. Each drop soaks in over 250 ms. Wet fabric: cells of the next section near the drop
// take the dye too (a stroke along a string bleeds over it).
let chain = 0, chainAt = 0, mudAt = 0, bleedAt = 0;
// wet fabric: how far past a string the dye bleeds; at most 30 % of a section's width so a careful stroke can always stay clean
const spillR = () => !L.wet ? 0 : Math.min(brushNow() * 0.46, 0.3 * (GEO[L.fold] === 'rings' ? 1 / L.N : GEO[L.fold] === 'stripes' ? 2 / L.N : 0.5));
let splashes = DEEP ? ST.get('d_splash', 2) : 0, splashArm = false;
function splashUI() { $('spn').textContent = splashes; show('splash', DEEP && phase === 'dye' && !L.bonus && splashes > 0); $('splash').classList.toggle('arm', splashArm); }
function dabDeep(nx, nz) {
  if (sel < 0) return false;
  let s = secOf(nx, nz); if (s < 0) return false;
  if (!L.mix && !L.bonus && !splashArm && L.cols[s] !== sel && !botAim) {   // aim help: a thumb a hair off the right section lands in it (thin rings)
    let bd = 9;
    for (let a = 0; a < 8; a++) { const px = nx + Math.cos(a * 0.785) * 0.075, pz = nz + Math.sin(a * 0.785) * 0.075, s2 = secOf(px, pz);
      if (s2 >= 0 && L.cols[s2] === sel) { const d = (px - nx) ** 2 + (pz - nz) ** 2; if (d < bd) { bd = d; s = s2; nx = px; nz = pz; } } }
  }
  if (splashArm) {   // booster: one squirt fills the whole section with this exact colour (clears mud and bleed)
    splashArm = false; splashes--; ST.set('d_splash', splashes); const now = performance.now(); paintAt = now;
    for (let k = 0; k < G * G; k++) if (cellSec[k] === s) { cellCol[k] = sel; cellT[k] = now - Math.random() * 200; }
    burst(scene, new THREE.Vector3(nx * EXT, surfY(nx, nz) + 0.1, nz * EXT), [DYES[sel], '#ffffff'], 30, { shape: 'sphere', speed: 0.14, up: 0.12, size: 0.8 });
    tone(180, 0.35, 'sine', 0.14, 3); setTimeout(() => tone(600, 0.2, 'triangle', 0.08, 1.6), 80); buzz([25, 20, 25]); ui.flash(0.3);
    splashUI();
  }
  if (L.guide && sel !== L.cols[s] && L.btns.includes(L.cols[s])) selectDye(L.cols[s]);
  const now = performance.now(); dabAt = now; paintAt = now;
  if (now - dabSig > 250) { dabSig = now; if (!L.bonus && !L.mix && sel !== L.cols[s]) AD.bad(0.25); else if (secFrac(s) < 0.88) AD.good(0.1); }
  // pour: hold the squeeze in one place and the dye spreads up to 45 % wider (and bleeds further on wet fabric); quick touches stay tight
  if (pointerDown && !botAim) { if (!pourAt || Math.hypot(nx - pourAt[0], nz - pourAt[1]) > 0.1) { pourAt = [nx, nz]; pourT0 = now; } pourK = 1 + 0.45 * smooth(150, 1100, now - pourT0); } else pourK = 1;
  const rad = brushNow() * 0.92 * pourK, spill = spillR() * pourK, touched = new Set([s]);
  const i0 = Math.max(0, Math.floor((nx - rad + 1) / 2 * G)), i1 = Math.min(G - 1, Math.ceil((nx + rad + 1) / 2 * G));
  const j0 = Math.max(0, Math.floor((nz - rad + 1) / 2 * G)), j1 = Math.min(G - 1, Math.ceil((nz + rad + 1) / 2 * G));
  let mud = false, bled = false, bledSec = -1, mudSec = s;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * G + i, cs = cellSec[k]; if (cs < 0) continue;
    const cx = -1 + (i + 0.5) * 2 / G, cz = -1 + (j + 0.5) * 2 / G, d2 = (cx - nx) ** 2 + (cz - nz) ** 2;
    if (cs === s ? d2 >= rad * rad : d2 >= spill * spill) continue;
    if (cs !== s) { bled = true; bledSec = cs; touched.add(cs); }
    const nc = L.mix ? mixCol(cellCol[k], sel) : sel;
    if (nc !== cellCol[k]) { if (nc === MUD && cellCol[k] !== MUD) { mud = true; mudSec = cs; } cellCol[k] = nc; cellT[k] = now; }
  }
  // juice: a squelch per drop (pitch by section), a drop splash, dye on the table now and then
  const wp = new THREE.Vector3(nx * EXT, surfY(nx, nz) + 0.05, nz * EXT);
  burst(scene, wp, DYES[sel], 2, { shape: 'sphere', speed: 0.035, up: 0.03, size: 0.5, gravity: 0.008, life: 0.5 });
  if (Math.random() < 0.18) { const a = Math.random() * 6.283, d = EXT * (1.15 + Math.random() * 0.5); tableSplat(Math.cos(a) * d, Math.sin(a) * d * (Q < 1 ? 0.7 : 1), DYES[sel], 0.22, 0.25 + Math.random() * 0.3); }
  if (++dripT % 2 === 0) { tone(240 + s * 40 + Math.random() * 60, 0.07, 'sine', 0.07, 2.2); tone(900 + Math.random() * 400, 0.03, 'triangle', 0.03, 0.5); }
  squeeze = 1;
  if (mud && now - mudAt > 900 && !popSecs.has('m' + mudSec)) { mudAt = now; popSecs.add('m' + mudSec); ui.pop('MUD!', '#7a5c3e', 34, 30); tone(150, 0.3, 'sawtooth', 0.06, 0.6); buzz([20, 20, 20]); AD.bad(0.5); }
  else if (bled && now - bleedAt > 1400 && !popSecs.has('b' + bledSec)) { bleedAt = now; popSecs.add('b' + bledSec); ui.pop('BLEED!', '#fff', 26, 30); tone(330, 0.12, 'sine', 0.05, 0.7); }
  for (const t of touched) {
    const f = secFrac(t);
    if (!secDone[t] && f >= 0.88) {
      secDone[t] = true; doneN++; if (markers[t]) markers[t].userData.gone = true; AD.good();
      chain = now - chainAt < 2600 ? chain + 1 : 1; chainAt = now;
      const big = chain >= 3;
      ui.pop(doneN === L.N ? 'ALL DYED!' : big ? `FLOW x${chain}!` : ['PERFECT!', 'NICE!', 'JUICY!', 'SO COOL!'][doneN % 4], big ? '#ffe066' : '#fff', big ? 44 + chain * 2 : 38, 21);
      note(64 + [0, 2, 4, 7, 9, 12, 14, 16][Math.min(7, doneN - 1)] + (big ? 12 : 0), 0.3, 0.16); buzz(15);
      if (big) { ui.flash(0.25); setTimeout(() => note(76 + Math.min(7, doneN), 0.2, 0.1), 90); }
      const mp = markers[t] ? markers[t].position : wp;
      burst(scene, mp, [COLS[cellCol.find((c, k) => cellSec[k] === t && c >= 0) ?? sel], '#ffffff'], big ? 22 : 12, { shape: 'sphere', speed: big ? 0.1 : 0.07, up: 0.08, size: 0.7 });
    } else if (secDone[t] && f < 0.6) { secDone[t] = false; doneN--; if (markers[t]) markers[t].userData.gone = false; }
  }
  ui.progress(0.12 + 0.75 * doneN / L.N);
  $('done').classList.toggle('go', doneN === L.N);
  if (L.guide && doneN === L.N && !autoRev) autoRev = setTimeout(() => { autoRev = 0; if (phase === 'dye' && doneN === L.N) reveal(); }, 550);
  return true;
}
const GC = document.createElement('canvas'); let gImg = null;
function renderDye(force = false) {
  if (!DEEP || !cellT || !baseC) return;
  const now = performance.now(); if (!force && now - paintAt > 450) return;
  if (GC.width !== G) { GC.width = GC.height = G; gImg = null; }
  const gx = GC.getContext('2d'); gImg = gImg || gx.createImageData(G, G); const d = gImg.data;
  for (let k = 0; k < G * G; k++) {
    const c = cellCol[k], o = k * 4;
    if (c < 0) { d[o + 3] = 0; continue; }
    const [r, g, b] = CRGB[c], soak = clamp((now - cellT[k]) / 250, 0, 1), e = 1 - (1 - soak) * (1 - soak);
    const sh = 0.9 + cellN[k] * 0.16;
    d[o] = clamp(r * sh, 0, 255); d[o + 1] = clamp(g * sh, 0, 255); d[o + 2] = clamp(b * sh, 0, 255); d[o + 3] = 255 * (0.55 + 0.4 * e);
  }
  gx.putImageData(gImg, 0, 0);
  bctx.globalCompositeOperation = 'source-over'; bctx.globalAlpha = 1; bctx.drawImage(baseC, 0, 0);
  bctx.imageSmoothingEnabled = true; bctx.drawImage(GC, 0, 0, CS, CS);
  bctx.globalCompositeOperation = 'multiply'; bctx.globalAlpha = 0.45; bctx.drawImage(baseC, 0, 0);
  bctx.globalCompositeOperation = 'source-over'; bctx.globalAlpha = 1; bTex.needsUpdate = true;
}
function washBundle() {
  AD.bad();
  if (DEEP) { cellCol.fill(-1); secDone.fill(false); doneN = 0; renderDye(true); markers.forEach(m => m.userData.gone = false); ui.progress(0.12); $('done').classList.remove('go'); tone(300, 0.25, 'sine', 0.1, 1.8); buzz(10); return; }
  bctx.drawImage(fabricCanvas(CS), 0, 0); bTex.needsUpdate = true; cellCol.fill(-1); secDone.fill(false); doneN = 0;
  markers.forEach(m => m.userData.gone = false); ui.progress(0.12); $('done').classList.remove('go');
  tone(300, 0.25, 'sine', 0.1, 1.8); buzz(10);
}

// ------------------------------------------------------------------ UI rows
const ICONS = {
  spiral: '<path d="M27 27c0-3 4-3 4 0s-3 7-8 7-9-5-9-10 5-12 13-12 15 6 15 15-7 17-17 17" fill="none" stroke="#ff3d8b" stroke-width="4.5" stroke-linecap="round"/>',
  rings: '<g fill="none" stroke-width="4.5"><circle cx="27" cy="27" r="5" stroke="#ffb400"/><circle cx="27" cy="27" r="13" stroke="#10cf96"/><circle cx="27" cy="27" r="21" stroke="#2f2bff"/></g>',
  stripes: '<g stroke-width="7" stroke-linecap="round"><path d="M8 12h38" stroke="#ff3b30"/><path d="M8 27h38" stroke="#a321ff"/><path d="M8 42h38" stroke="#00aaff"/></g>',
  burst: '<g stroke-width="5" stroke-linecap="round"><path d="M27 27L27 5" stroke="#ff3b30"/><path d="M27 27L46 16" stroke="#ffb400"/><path d="M27 27L46 38" stroke="#10cf96"/><path d="M27 27L27 49" stroke="#2f2bff"/><path d="M27 27L8 38" stroke="#a321ff"/><path d="M27 27L8 16" stroke="#ff1f8e"/></g>',
  diag: '<g stroke-width="7" stroke-linecap="round"><path d="M6 22L22 6" stroke="#ff3b30"/><path d="M10 44L44 10" stroke="#ffb400"/><path d="M32 48L48 32" stroke="#00aaff"/></g>',
  heart: '<g fill="none" stroke-width="4.5" stroke-linejoin="round"><path d="M27 46C10 34 6 26 8 18c2-8 13-10 19-2c6-8 17-6 19 2c2 8-2 16-19 28z" stroke="#ff1f8e"/><path d="M27 36C18 29 16 25 17 21c1-4 7-5 10 0c3-5 9-4 10 0c1 4-1 8-10 15z" stroke="#ffb400"/></g>',
};
const FOLDS_UI = DEEP ? [...FOLDS, ...NEWF] : FOLDS;
$('folds').innerHTML = FOLDS_UI.map(f => `<button class="fold" data-f="${f}"><svg viewBox="0 0 54 54">${ICONS[f]}</svg>${f === 'diag' ? 'SLANT' : f.toUpperCase()}</button>`).join('');
$('folds').querySelectorAll('.fold').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); chooseFold(b.dataset.f, b); }));
$('reset').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase === 'dye') washBundle(); });
$('done').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase === 'dye') reveal(true); });
$('splash').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (phase !== 'dye' || splashes <= 0) return; splashArm = !splashArm; splashUI(); sfx.pick(5); buzz(8); });
function buildDyeRow() {
  $('dyes').innerHTML = L.btns.map(c => `<button class="dye" data-c="${c}" style="background:${DYES[c]}"></button>`).join('');
  $('dyes').querySelectorAll('.dye').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); selectDye(+b.dataset.c); }));
}
function selectDye(c) {
  sel = c; $('dyes').querySelectorAll('.dye').forEach(b => b.classList.toggle('on', +b.dataset.c === c));
  hand.userData.body.color.set(DYES[c]); hand.visible = true; hand.position.copy(slotBottles.find(b => b.userData.c === c)?.position || handPos);
  slotBottles.forEach(b => b.visible = b.userData.c !== c);
  sfx.pick(2); buzz(8);
}
const show = (id, on) => $(id).classList.toggle('off', !on);

// ------------------------------------------------------------------ flow
let state = 'ready', phase = 'fold', phT = 0, wrongFolds = 0, match = 0, revealed = false;
let scr = 0, scrTick = 0, scrIdle = 0, settle = 0, scrDown = false, retryFast = false, lastNeed = {}, needNote = '', pourK = 1, pourAt = null, pourT0 = 0;
let messy = 0, clnAt = 0;
let popSecs = new Set();   // sections that already showed BLEED!/MUD! this round: after that the stain speaks for itself
function buildLevel() {
  L = DEEP ? deepLevel(level) : genLevel(level); AD.round(); revealed = false; wrongFolds = 0; doneN = 0; sel = -1; phase = 'fold'; phT = 0; popSecs = new Set(); pourAt = null; pourK = 1;
  ui.levels(isDaily ? front : level); ui.progress(0); drawTarget(); buildBundle(); buildDyeRow();
  shirt.material = shirtMat; shirt.visible = true; shirt.position.set(0, 0.02, 0.15); shirt.rotation.set(0, 0, 0); shirt.scale.setScalar(1);
  slotBottles.forEach(b => scene.remove(b)); slotBottles = [];
  L.btns.forEach((c, i) => {
    const b = makeBottle(DYES[c]), side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
    b.position.set(side * (2.15 - j * 0.55), 1.62, -3.45 + (j === 1 ? 0.3 : 0)); b.userData.c = c; scene.add(b); slotBottles.push(b);
  });
  hand.visible = false;
  spx.clearRect(0, 0, SPC.width, SPC.height);
  const r = rng(level * 31 + 5); for (let i = 0; i < 16; i++) tableSplat((r() - 0.5) * 4.4, TZ + (r() - 0.5) * 7.2, DYES[L.btns[Math.floor(r() * L.btns.length)]], 0.12, 0.2 + r() * 0.35);
  $('banner').classList.remove('on', 'bad');
  show('dyes', false); show('reset', false); show('done', false); show('splash', false); show('ask', state === 'play'); show('folds', state === 'play');
  const shown = Array.isArray(L.folds) ? L.folds : L.folds >= 3 ? FOLDS : L.folds === 1 ? [L.fold] : FOLDS.filter(f => f === L.fold || f === (L.fold === 'rings' ? 'spiral' : 'rings')).slice(0, 2);
  $('folds').classList.toggle('many', shown.length > 3);
  $('folds').querySelectorAll('.fold').forEach(b => { b.classList.remove('bad'); b.style.display = shown.includes(b.dataset.f) ? '' : 'none'; b.classList.toggle('go', shown.length === 1); });
  if (DEEP) deepRound();
  if (DEEP && retryFast) { retryFast = false; skipToDye(); return; }
  // name the button: "Tap the fold!" over a blank shirt left new players looking at the shirt (Oct 26)
  const fl = (($('folds').querySelector(`[data-f="${L.fold}"]`) || {}).textContent || '').trim();
  $('ask').textContent = shown.length === 1 ? (fl ? `Tap ${fl.toUpperCase()} below ▼` : 'Tap the fold below ▼') : 'Pick the fold below ▼';
}
function skipToDye() {   // retry after a loss: the same tied bundle, washed, back at the dye step
  phase = 'dye'; phT = 0; shirt.visible = false; bundle.visible = true; bundle.scale.setScalar(1); bundle.rotation.y = 0; bundle.position.y = 0;
  strings.forEach(s => { s.rotation.y = 0; s.position.y = 0; s.scale.setScalar(1); });
  show('ask', false); show('folds', false); show('dyes', true); show('reset', true); show('done', true); ui.progress(0.12);
  dyeT0 = performance.now(); if (!L.bonus) show('par', true); splashArm = false; splashUI();
  selectDye(L.btns.includes(L.cols[0]) ? L.cols[0] : L.btns[0]); sfx.coin(); if (needNote) ui.pop(needNote, '#fff', 26, 40);
}
function chooseFold(f, btn) {
  if (state !== 'play' || phase !== 'fold') return;
  if (f !== L.fold) {
    wrongFolds++; AD.bad(); btn = btn || $('folds').querySelector(`[data-f="${f}"]`); btn.classList.remove('bad'); void btn.offsetWidth; btn.classList.add('bad');
    sfx.fail(); buzz([30, 30, 30]); ui.pop('WRONG FOLD!', '#ff3b30', 30, 24);
    $('tgt').classList.add('big'); setTimeout(() => $('tgt').classList.remove('big'), 350); return;
  }
  phase = 'folding'; phT = 0; show('folds', false); show('ask', false); sfx.tap(); buzz(12); tone(320, 0.5, 'sine', 0.08, 2.4);
  ui.progress(0.06);
  if (DEEP) {   // v2: you scrunch the shirt yourself (rub it); orders 1-2 help a player who does not touch it
    scr = 0; scrTick = 0; scrIdle = 0; settle = 0; $('ask').textContent = '⇆ RUB THE SHIRT!'; show('ask', true); $('ask').classList.add('rub');
    if (L.fold === 'burst' || L.fold === 'diag') $('ask').textContent = '⇆ RUB IT AND PULL!';
  }
}
function reveal(byButton = false) {
  if (phase !== 'dye') return;
  // rescue (once a round): a careful dyer taps ✓ just short of the target, so instead of failing the unfold, the sections that
  // still need dye jump and they get one touch-up. The score itself is never changed.
  if (byButton) {
    let m0 = 0; for (let s = 0; s < L.N; s++) m0 += clamp(secFrac(s) / 0.85, 0, 1);
    const m1 = clamp(m0 / L.N - wrongFolds * 0.08, 0, 1);
    if (m1 < thrR() && m1 >= thrR() - 0.2 && AD.sensible() && AD.rescue()) {
      for (let s = 0; s < L.N; s++) if (secFrac(s) < 0.85) { markers[s].userData.gone = false; markers[s].scale.setScalar(1.9); }
      ui.pop('ALMOST! TOUCH UP', '#fff', 32, 24); tone(880, 0.12, 'triangle', 0.1, 1.2); buzz([15, 30, 15]); return;
    }
  }
  if (DEEP && L.bonus) {   // free dye: unfold when there is something to see
    let n = 0, a = 0; for (let k = 0; k < G * G; k++) if (cellSec[k] >= 0) { a++; if (cellCol[k] >= 0) n++; }
    if (n / a < 0.45) { ui.pop('MORE DYE!', '#fff', 32, 24); tone(500, 0.1, 'triangle', 0.08, 1.3); return; }
  }
  phase = 'reveal'; phT = 0; show('dyes', false); show('reset', false); show('done', false); show('splash', false); splashArm = false; hand.visible = false;
  slotBottles.forEach(b => b.visible = true);
  if (DEEP) { roundSecs = (performance.now() - dyeT0) / 1000; cellT.fill(-1e9); renderDye(true); show('par', false); }
  // score: per-section correct coverage
  let m = 0; for (let s = 0; s < L.N; s++) m += clamp(secFrac(s) / 0.85, 0, 1);
  { let w = 0, a = 0; for (let k = 0; k < G * G; k++) { const s = cellSec[k]; if (s < 0) continue; a++; if (cellCol[k] >= 0 && cellCol[k] !== L.cols[s]) w++; } messy = DEEP && !L.bonus && !L.mix ? w / Math.max(1, a) : 0; }
  match = DEEP && L.bonus ? 1 : clamp(m / L.N - wrongFolds * 0.08, 0, 1);
  // the unfolded pattern from what was painted
  const data = bctx.getImageData(0, 0, CS, CS).data;
  drawPattern(patC.getContext('2d'), 512, L, (nx, nz) => { const px = clamp(Math.round((nx + 1) / 2 * CS), 0, CS - 1), py = clamp(Math.round((nz + 1) / 2 * CS), 0, CS - 1), i = (py * CS + px) * 4; return [data[i], data[i + 1], data[i + 2]]; });
  patTex.needsUpdate = true;
  tone(200, 0.6, 'sine', 0.1, 3); buzz(20);
}
function finish() {
  if (DEEP) return finishDeep();
  const thr = thrNow(), pct = Math.round(match * 100), ok = match >= thr;
  const stars = match >= 0.95 ? 3 : match >= 0.82 ? 2 : ok ? 1 : 0;
  $('stars').innerHTML = '⭐'.repeat(stars) + '<i>' + '⭐'.repeat(3 - stars) + '</i>';
  $('pct').textContent = ok ? `${pct}% MATCH` : `${pct}% · NEED ${Math.round(thr * 100)}%`;
  $('banner').classList.toggle('bad', !ok); $('banner').classList.add('on');
  ui.progress(1); ui.flash(0.55);
  if (ok) {
    state = 'won'; F.level(true); WB.submit(1); AD.good(2); score += pct; best = Math.max(best, score); ST.set('best', best);
    sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, 2.5, 0), 80); setTimeout(() => confetti(scene, new THREE.Vector3(0, 2.5, -1), 60), 250);
    ui.win(level, stars === 3 ? 'Flawless swirl!' : `${pct}% match`); ui.els.win.querySelector('.hint').textContent = `Level ${level + 1} ▶`;
    stage.renderer.domElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05) rotate(1deg)' }, { transform: 'scale(.98) rotate(-1deg)' }, { transform: 'scale(1)' }], { duration: 420 });
    setTimeout(() => confetti(scene, new THREE.Vector3(1.5, 2.5, 0.5), 60), 500);
  } else {
    state = 'lost'; F.level(false, Math.min(1, match / thr)); AD.bad(2); sfx.fail(); buzz([40, 30, 60]);
    ui.lose('SO CLOSE!', `${pct}% match · need ${Math.round(thr * 100)}%`);
  }
}

// ------------------------------------------------------------------ v2: orders, stars, the Tee Wall, dye crates
let front = DEEP ? Math.max(ST.get('d_front', 0), Math.min(12, ST.get('level', 1))) : 1, dyeT0 = 0, roundSecs = 0;
if (DEEP) { ST.set('d_front', front); level = front; }
const dStars = DEEP ? ST.get('d_stars', {}) : {};
const totalStars = () => Object.values(dStars).reduce((a, b) => a + b, 0);
const CRATE = 8, TABLES = ['#ffd02e', '#7ee0c3', '#c9b6ff', '#ff9f8a', '#8fd3ff', '#fff4e0'];
let tables = DEEP ? ST.get('d_tables', 1) : 1, glitter = DEEP ? ST.get('d_glitter', false) : false;
function paintTable() { const c = TABLES[Math.min(TABLES.length, tables) - 1]; table.material.color.set(c); table.material.emissive.set(c); table.material.emissiveIntensity = 0.1; }
if (DEEP) paintTable();
const worldOf = (lv) => Math.min(WORLDS.length - 1, Math.floor((lv - 1) / 12));
const DOT = (c) => `<span class="dd" style="background:${COLS[c]}"></span>`;
function deepRound() {
  $('cust').textContent = L.cust || '🙂'; $('cust').className = 'cust';
  $('tgt').classList.remove('min'); $('tgt').classList.toggle('free', !!L.bonus); $('tgt').classList.toggle('hard', !!L.hard);
  roundThr = L.bonus ? 0 : Math.round(thrNow() * 100) / 100;
  needNote = ''; if (!L.bonus && lastNeed[level] && Math.abs(lastNeed[level] - roundThr) >= 0.01) needNote = roundThr < lastNeed[level] ? `EASIER: NEED ${Math.round(roundThr * 100)}%` : `NEED ${Math.round(roundThr * 100)}%`;
  lastNeed[level] = roundThr;
  $('tgt').querySelector('b').textContent = L.bonus ? 'FREE DYE' : `${L.hard ? 'HARD ' : 'NEED '}${Math.round(roundThr * 100)}%`;
  if (L.bonus) { const x = $('tgtc').getContext('2d'); x.clearRect(0, 0, 168, 168); x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✨', 84, 90); }
  show('par', false); $('par').classList.remove('late');
  const nc = $('newc'); nc.className = 'newc off';
  if (L.isNew && state === 'play') {
    nc.innerHTML = L.isNew === 'mix' ? `${DOT(0)}+${DOT(1)}=${DOT(3)} &nbsp; ${DOT(5)}+${DOT(1)}=${DOT(7)} &nbsp; ${DOT(0)}+${DOT(5)}=${DOT(4)}`
      : L.isNew === 'wet' ? '💧 WET! stay off the strings' : `NEW FOLD <svg viewBox="0 0 54 54">${ICONS[L.isNew]}</svg>`;
    setTimeout(() => { nc.className = 'newc'; tone(660, 0.1, 'triangle', 0.1, 1.5); setTimeout(() => tone(990, 0.14, 'triangle', 0.1, 1.2), 110); }, 300);
    setTimeout(() => nc.classList.add('off'), L.isNew === 'mix' ? 5200 : 2800);
  }
  const w = WORLDS[worldOf(level)]; document.documentElement.style.setProperty('--ui', w.bg === '#ffd02e' ? '#ff5d8f' : w.bg);
}
function saveTee(stars) {
  const prev = dStars[level] || 0;
  if (stars < prev && ST.get('d_tee_' + level, '')) return;
  dStars[level] = Math.max(prev, stars); ST.set('d_stars', dStars);
  try {   // the shirt the player made, 72 px, for the wall
    const S = 72, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const toPx = (v, i) => i === 0 ? (v - SX0) / SSZ * S : (SY0 - v) / SSZ * S;
    x.save(); x.beginPath(); shirtPath(x, toPx); x.clip(); x.drawImage(patC, 0, 0, S, S); x.restore();
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(0,0,0,.18)'; x.beginPath(); shirtPath(x, toPx); x.stroke();
    ST.set('d_tee_' + level, c.toDataURL('image/webp', 0.7));
  } catch (e) {}
}
function wallHTML(wi, fresh = 0) {
  const w = WORLDS[wi], from = w.from; let h = `<div class="wt">${w.name} <em>${[...Array(12)].reduce((a, _, i) => a + (dStars[from + i] || 0), 0)}/36⭐</em></div><div class="wr">`;
  for (let i = 0; i < 12; i++) {
    const n = from + i, t = LEVELS[n - 1] || {}, img = ST.get('d_tee_' + n, ''), st = dStars[n] || 0, open = n <= front;
    h += `<div class="ws${open ? ' open' : ''}${n === front ? ' now' : ''}${t.hard ? ' hard' : ''}${t.bonus ? ' bonus' : ''}${n === fresh ? ' fresh' : ''}" data-n="${open ? n : ''}">`
      + (img ? `<img src="${img}">` : `<b>${n}</b>`) + `<i>${'⭐'.repeat(st)}${'<u>⭐</u>'.repeat(open && img ? 3 - st : 0)}</i></div>`;
  }
  return h + '</div>';
}
function crateHTML() {
  const t = totalStars(), got = ST.get('d_crates', 0), need = (got + 1) * CRATE;
  return `<div class="cr"><span>🎁</span><div class="cb"><i style="width:${clamp((t - got * CRATE) / CRATE, 0, 1) * 100}%"></i></div><b>${Math.max(0, t - got * CRATE)}/${CRATE}⭐</b></div>`;
}
// Today's Order: one generated order a day (same for everyone), opens after world 1, a streak counts the days in a row
const dayN = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
let isDaily = false;
function dailyHTML() {
  if (front <= 12) return '';
  const done = ST.get('d_daily', 0) === dayN(), st = ST.get('d_dstreak', 0);
  return `<div class="daily${done ? ' done' : ''}" data-daily="1">${done ? `📅 DONE ✓ 🔥${st}` : `📅 TODAY'S ORDER ▶${st ? ` 🔥${st}` : ''}`}</div>`;
}
function bindWall(root) {
  root.querySelectorAll('.daily[data-daily]').forEach(el => el.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); if (el.classList.contains('done')) return;
    ui.els.start.classList.add('hc-hidden'); ui.els.win.classList.add('hc-hidden'); WB.start();
    isDaily = true; level = 1000 + (dayN() % 400); state = 'play'; buildLevel(); show('ask', true); show('folds', true); sfx.tap();
  }));
  root.querySelectorAll('.ws[data-n]').forEach(el => { if (!el.dataset.n) return; el.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); ui.els.start.classList.add('hc-hidden'); ui.els.win.classList.add('hc-hidden'); WB.start();
    isDaily = false; level = +el.dataset.n; state = 'play'; buildLevel(); show('ask', true); show('folds', true); sfx.tap();
  }); });
}
function showWall(card, html) {
  let w = card.querySelector('.wall'); if (!w) { w = document.createElement('div'); w.className = 'wall'; card.appendChild(w); }
  w.innerHTML = html; bindWall(w);
}
function openCrate() {
  let got = ST.get('d_crates', 0); if (totalStars() < (got + 1) * CRATE) return false;
  ST.set('d_crates', ++got);
  const canTable = tables < TABLES.length, r = Math.random();
  const pick = !glitter && r < 0.2 ? 'glitter' : canTable && r < 0.6 ? 'table' : 'splash';
  if (pick === 'table') { tables++; ST.set('d_tables', tables); paintTable(); }
  if (pick === 'splash') { splashes += 3; ST.set('d_splash', splashes); }
  if (pick === 'glitter') { glitter = true; ST.set('d_glitter', true); }
  setTimeout(() => {
    ui.pop(pick === 'glitter' ? '✨ GLITTER DYE! ✨' : pick === 'table' ? '🎁 NEW TABLE!' : '🎁 💦 +3', '#ffe066', 40, 30);
    [72, 76, 79, 84, 88].forEach((m, i) => setTimeout(() => note(m, 0.25, 0.14), i * 90)); buzz([20, 30, 20, 30, 40]);
    confetti(scene, new THREE.Vector3(0, 3, 0), 120); if (pick === 'glitter') sparkle(60);
  }, 1500);
  return true;
}
function sparkle(n = 30) { burst(scene, new THREE.Vector3(0, 0.6, 0.15), ['#ffffff', '#fff6b0', '#ffe066'], n, { shape: 'sphere', speed: 0.09, up: 0.05, size: 0.35, gravity: 0.002, life: 1.4 }); }
function posName(s) {
  const g = GEO[L.fold], n = L.N;
  if (g === 'rings') return s === 0 ? 'middle' : s === n - 1 ? 'outer ring' : `ring ${s + 1}`;
  if (g === 'stripes') return `stripe ${s + 1}`;
  return `wedge ${s + 1}`;
}
function finishDeep() {
  const thr = thrR(), pct = Math.round(match * 100), ok = L.bonus || match >= thr, fast = roundSecs <= L.par;
  const sharp = match >= Math.max(thr, 0.9), clean = messy <= 0.03 || !!L.mix, stars = L.bonus ? 3 : !ok ? 0 : sharp ? (fast && clean ? 3 : 2) : 1;
  const ban = $('banner'); ban.classList.toggle('bad', !ok); ban.classList.add('on'); if (ok) $('tgt').classList.add('min');
  $('stars').innerHTML = '<i>⭐⭐⭐</i>'; $('pct').textContent = '0%'; $('chips').innerHTML = '';
  // the match rolls up, then the stars land one by one, then the customer reacts
  const t0 = performance.now(), dur = L.bonus ? 300 : 750;
  const roll = () => { const k = clamp((performance.now() - t0) / dur, 0, 1), v = Math.round(pct * (1 - (1 - k) * (1 - k)));
    $('pct').textContent = L.bonus ? 'FRESH DESIGN!' : `${v}% MATCH`; if (k < 1) { if (Math.random() < 0.5) tone(500 + v * 8, 0.03, 'square', 0.03, 1); requestAnimationFrame(roll); }
    else { if (!ok) $('pct').textContent = `${pct}% · NEED ${Math.round(thr * 100)}%`;
      for (let i = 0; i < 3; i++) setTimeout(() => { $('stars').innerHTML = '⭐'.repeat(Math.min(i + 1, stars)) + '<i>' + '⭐'.repeat(3 - Math.min(i + 1, stars)) + '</i>'; if (i < stars) { note(72 + i * 4, 0.25, 0.16); buzz(12); ban.animate([{ transform: 'translateX(-50%) scale(1.12)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 180 }); } }, 120 + i * 220);
      if (ok && !L.bonus) $('chips').innerHTML = `<span class="${sharp ? 'y' : ''}">${pct}% SHARP</span><span class="${fast ? 'y' : ''}">${Math.ceil(roundSecs)}s / ${L.par}s</span><span class="${clean ? 'y' : ''}">${clean ? 'CLEAN' :  Math.round(messy * 100) + '% SPILL'}</span>`;
      if (ok && !L.bonus && stars < 3 && sharp) setTimeout(() => ui.pop(!fast ? `⏱ ${Math.ceil(roundSecs)}s · ⭐ under ${L.par}s` : 'STAY OFF THE STRINGS ⭐', '#fff', 22, 70), 800);
      const cu = $('cust'); cu.textContent = stars === 3 ? '😍' : stars === 2 ? '😊' : stars === 1 ? '🙂' : '😢'; cu.className = 'cust react';
    } };
  requestAnimationFrame(roll);
  ui.progress(1); ui.flash(0.55); if (glitter) { sparkle(40); setTimeout(() => sparkle(30), 300); }
  if (ok) {
    state = 'won'; if (!L.bonus && !isDaily) { F.level(true); WB.submit(1); } AD.good(2); score += pct; best = Math.max(best, score); ST.set('best', best);
    if (isDaily) { const d = dayN(); if (ST.get('d_daily', 0) !== d) { ST.set('d_dstreak', ST.get('d_dlast', 0) === d - 1 ? ST.get('d_dstreak', 0) + 1 : 1); ST.set('d_dlast', d); ST.set('d_daily', d); } setTimeout(() => ui.pop(`📅 DONE! 🔥 ${ST.get('d_dstreak', 1)} DAY${ST.get('d_dstreak', 1) > 1 ? 'S' : ''}`, '#ffe066', 34, 30), 1200); }
    const wasFront = !isDaily && level >= front; if (wasFront) { front = level + 1; ST.set('d_front', front); }
    if (!isDaily) saveTee(stars); const crate = isDaily ? false : openCrate();
    sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, 2.5, 0), 80); setTimeout(() => confetti(scene, new THREE.Vector3(0, 2.5, -1), 60), 250);
    ui.win(level, ''); ui.els.win.querySelector('.hint').textContent = `Level ${front} ▶`;
    showWall(ui.els.win, wallHTML(worldOf(isDaily ? front - 1 : level), isDaily ? 0 : level) + dailyHTML() + crateHTML());
    if (crate) ui.els.win.querySelector('.cr').classList.add('pop');
    if (front > LEVELS.length && level === LEVELS.length) setTimeout(() => ui.pop('ALL 36 ORDERS! 👑', '#ffe066', 36, 30), 1200);
    else if (wasFront && front <= LEVELS.length && WORLDS.some(w => w.from === front)) setTimeout(() => ui.pop(`${WORLDS[worldOf(front)].name.toUpperCase()} OPEN!`, '#ffe066', 34, 30), 1200);
    stage.renderer.domElement.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05) rotate(1deg)' }, { transform: 'scale(.98) rotate(-1deg)' }, { transform: 'scale(1)' }], { duration: 420 });
    setTimeout(() => confetti(scene, new THREE.Vector3(1.5, 2.5, 0.5), 60), 500);
  } else {
    state = 'lost'; F.level(false, Math.min(1, match / thr)); AD.bad(2); sfx.fail(); buzz([40, 30, 60]);
    let ws = 0, wf = 9; for (let s = 0; s < L.N; s++) { const f = secFrac(s); if (f < wf) { wf = f; ws = s; } }
    ui.lose(thr - match < 0.06 ? 'SO CLOSE!' : 'NOT YET!', '');
    ui.els.lose.querySelector('[data-x]').innerHTML = `${Math.max(1, Math.round(thr * 100) - pct)}% short · ${DOT(L.cols[ws])} ${posName(ws)} only ${Math.round(wf * 100)}%`;
  }
}
if (DEEP) {   // the start card shows where you are: this world's wall and the next crate
  document.body.classList.add('deep');
  ui.els.start.querySelector('.hint').lastChild.textContent = front > 1 ? `Order ${front} ▶` : 'Tie-dye the shirt to match';
  showWall(ui.els.start, wallHTML(worldOf(front)) + dailyHTML() + crateHTML());
}
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, if nobody has touched the
// screen 2.5 s into the round, the shirt folds by itself, so the screen moves and the next step (squirt the dye) is shown
{ let touched = false, seenPlay = 0;
  addEventListener('pointerdown', e => { if (e.isTrusted) touched = true; }, { capture: true });
  const demo = setInterval(() => {
    if (touched || level > 1) return clearInterval(demo);
    if (state !== 'play' || phase !== 'fold' || !L || (Array.isArray(L.folds) ? L.folds.length : L.folds) !== 1) return;
    if (!seenPlay) seenPlay = performance.now();
    else if (performance.now() - seenPlay > 2500) { clearInterval(demo); chooseFold(L.fold); }
  }, 250); }
ui.onTap((which) => { WB.start();
  if (DEEP && which === 'win') { isDaily = false; level = front; state = 'play'; buildLevel(); return; }
  if (which === 'start') { state = 'play'; show('ask', true); show('folds', true); sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else { state = 'play'; retryFast = DEEP; buildLevel(); }
});

// ------------------------------------------------------------------ input: drag the bottle over the bundle
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.7), tmpV = new THREE.Vector3();
let aim = null, pointerDown = false;
function aimAt(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  // aim a little above the finger so the bottle isn't hidden under it
  ndc.y += 0.07; ray.setFromCamera(ndc, camera);
  const hit = bundle && bundle.visible ? ray.intersectObject(bundle)[0] : null;
  if (hit) aim = { nx: hit.point.x / EXT, nz: hit.point.z / EXT, p: hit.point.clone() };
  else { ray.ray.intersectPlane(plane, tmpV); aim = { nx: 9, nz: 9, p: tmpV.clone() }; }
}
input({
  onDown: (e) => { if (e.target.closest && e.target.closest('button')) return; if (DEEP && state === 'play' && phase === 'folding') { scrDown = true; return; } if (state !== 'play' || phase !== 'dye') return; if (sel < 0) selectDye(L.btns[0]); pointerDown = true; aimAt(e); pourAt = null; if (aim && aim.nx < 5) { lastDab = frame; dab(aim.nx, aim.nz); } },   // a plain tap dyes too
  onMove: (dx, dy, e) => {
    if (scrDown && phase === 'folding' && scr < 1) { const d = Math.hypot(dx, dy); scr = Math.min(1, scr + d / 1100); scrIdle = 0; if (scr - scrTick > 0.08) { scrTick = scr; tone(260 + scr * 500, 0.05, 'square', 0.05, 0.5); buzz(4); } }
    if (pointerDown) aimAt(e);
  },
  onUp: () => { pointerDown = false; scrDown = false; aim = null; },
});

// ------------------------------------------------------------------ loop
const camPos = new THREE.Vector3(0, 14.2, 8.6), camLook = new THREE.Vector3(0, 0, 0.75), camGoal = camPos.clone();
let frame = 0, lastDab = -9;
loop((dt, t) => {
  frame += dt; phT += dt / 60; renderDye();
  if (DEEP && phase === 'dye' && L && !L.bonus && !L.mix && performance.now() - clnAt > 200) { clnAt = performance.now(); let w = 0, a = 0; for (let k = 0; k < G * G; k++) { const s = cellSec[k]; if (s < 0) continue; a++; if (cellCol[k] >= 0 && cellCol[k] !== L.cols[s]) w++; } let q = 0; for (let s = 0; s < L.N; s++) q += clamp(secFrac(s) / 0.85, 0, 1); const m = w / Math.max(1, a), c = $('cln'), t = `${Math.round(q / L.N * 100)}/${Math.round(thrR() * 100)}%` + (m <= 0.03 ? ' CLEAN' : ` SPILL ${Math.round(m * 100)}%`); c.classList.remove('off'); if (c._v !== t) { c._v = t; c.textContent = t; c.style.color = m <= 0.03 ? '#10a070' : '#e0287a'; } } else if (!(phase === 'dye')) $('cln').classList.add('off');
  if (DEEP && phase === 'dye' && L && !L.bonus) { const left = Math.ceil(L.par - (performance.now() - dyeT0) / 1000), p = $('par'); if (p._v !== left) { p._v = left; p.textContent = left > 0 ? `⏱ ${left}` : '⏱ ⭐⭐'; p.classList.toggle('late', left <= 0); p.style.setProperty('--f', Math.max(0, Math.min(100, left / L.par * 100)) + '%'); } } if (state === 'play' && (phase === 'fold' || phase === 'dye')) AD.tick(performance.now() - dabAt < 8000);
  // folding animation: shirt spins into a bound bundle
  if (phase === 'folding') {
    if (DEEP) {
      if (L.lv <= 2 && !scrDown) { scrIdle += dt / 60; if (scrIdle > 3.5 && scr < 1) scr = Math.min(1, scr + dt / 60 * 0.9); }   // first two orders: the shirt helps itself if left alone
      if (scr >= 1) settle += dt / 60;
    }
    const k = DEEP ? clamp(scr, 0, 1) : clamp(phT / 1.1, 0, 1);
    shirt.rotation.y = k * k * 7; shirt.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.7, k))); shirt.position.y = 0.02 + Math.sin(k * Math.PI) * 0.6;
    bundle.visible = k > 0.3; const bk = clamp((k - 0.3) / 0.7, 0, 1);
    bundle.scale.set(Math.max(0.001, easeOutBack(bk)), Math.max(0.001, easeOutBack(bk) * (1 + Math.sin(bk * 12) * 0.12 * (1 - bk))), Math.max(0.001, easeOutBack(bk)));
    bundle.rotation.y = (1 - bk) * -4;
    strings.forEach((s, i) => { const sk = clamp((k - 0.62 - i * 0.05) / 0.2, 0, 1); if (sk > 0 && s.scale.x < 0.01) { tone(900 + i * 80, 0.04, 'square', 0.05, 0.6); } s.scale.setScalar(Math.max(0.001, easeOutBack(sk))); s.rotation.y = bundle.rotation.y; });
    if (DEEP ? settle > 0.35 : phT > 1.45) {
      if (DEEP) { $('ask').classList.remove('rub'); show('ask', false); ui.pop('TIGHT!', '#fff', 34, 24); tone(140, 0.2, 'square', 0.1, 0.5); buzz([20, 30, 20]); }
      phase = 'dye'; shirt.visible = false; bundle.rotation.y = 0; strings.forEach(s => { s.rotation.y = 0; s.scale.setScalar(1); });
      show('dyes', true); show('reset', true); show('done', true); ui.progress(0.12); dyeT0 = performance.now(); if (DEEP && !L.bonus) show('par', true); if (DEEP) { splashArm = false; splashUI(); } selectDye(L.btns.includes(L.cols[0]) ? L.cols[0] : L.btns[0]); sfx.coin();
    }
  }
  // markers pop in / out and bob
  markers.forEach((m, i) => {
    const want = phase === 'dye' && !m.userData.gone ? 1 : 0; m.scale.setScalar(Math.max(0.001, m.scale.x + (want - m.scale.x) * 0.2 * dt));
    m.position.y = m.userData.y + Math.sin(t * 4 + i) * 0.05; m.rotation.y += 0.02 * dt;
  });
  // painting
  if (phase === 'dye' && pointerDown && aim) {
    handGoal.copy(aim.p).add(new THREE.Vector3(0, DEEP ? 1.0 : 0.35, 0));
    if (aim.nx < 5 && frame - lastDab > 2.5) { lastDab = frame; dab(aim.nx, aim.nz); }
  } else if (phase === 'dye' && !botAim) handGoal.set(1.75, 1.4, 1.7);
  if (botAim) { handGoal.copy(botAim).add(new THREE.Vector3(0, DEEP ? 1.0 : 0.35, 0)); if (frame - botAimT > 14) botAim = null; }
  if (hand.visible) {
    hand.position.lerp(handGoal, 0.3 * dt);
    const painting = (pointerDown && aim && aim.nx < 5) || botAim; const tz = painting ? 2.25 : 0.5;
    hand.rotation.z += (tz - hand.rotation.z) * 0.2 * dt; hand.rotation.x = Math.sin(t * 3) * 0.05;
    squeeze = Math.max(0, squeeze - 0.08 * dt); hand.scale.set(1.15 + squeeze * 0.12, 1.15 - squeeze * 0.1, 1.15 + squeeze * 0.12);
  }
  // v2: a wobbly stream of dye from the nozzle to the fabric while you squeeze
  if (DEEP) {
    const tgt = phase === 'dye' && hand.visible && sel >= 0 ? (pointerDown && aim && aim.nx < 5 ? aim.p : botAim) : null;
    stream.visible = !!tgt && squeeze > 0.2;
    if (stream.visible) {
      const a = hand.position, d = tmpS.copy(tgt).sub(a), len = d.length();
      stream.position.copy(a).addScaledVector(d, 0.5); stream.quaternion.setFromUnitVectors(UP, d.normalize());
      const w = 1 + Math.sin(t * 40) * 0.25; stream.scale.set(w, len, w); stream.material.color.set(COLS[sel]);
    }
  }
  // reveal: spin, strings snap, shirt unfolds
  if (phase === 'reveal') {
    const k = phT;
    if (k < 0.7) { bundle.rotation.y += (0.05 + k * 0.4) * dt; bundle.position.y = Math.sin(k / 0.7 * Math.PI / 2) * 0.7; const w = 1 + Math.sin(k * 30) * 0.05; bundle.scale.set(w, 2 - w, w); strings.forEach(s => { s.rotation.y = bundle.rotation.y; s.position.y = bundle.position.y; }); }
    if (k >= 0.7 && strings.length) {
      strings.forEach((s, i) => { flying.push({ m: s, v: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.15 + Math.random() * 0.1, (Math.random() - 0.5) * 0.25), life: 1 }); setTimeout(() => tone(1400 - i * 90, 0.05, 'square', 0.06, 0.4), i * 40); });
      strings = []; buzz([10, 20, 10]); burst(scene, new THREE.Vector3(0, 1, 0), ['#ffffff', ...L.cols.map(c => DYES[c])], 22, { shape: 'sphere', speed: 0.12, up: 0.1 });
      shirt.material = new THREE.MeshStandardMaterial({ map: patTex, roughness: 0.85 }); shirt.visible = true;
    }
    if (k >= 0.7) {
      const u = clamp((k - 0.7) / 0.9, 0, 1), e = easeOutBack(u);
      bundle.rotation.y += 0.3 * dt; bundle.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.35, u)));
      shirt.scale.setScalar(Math.max(0.001, 0.15 + 0.85 * e)); shirt.rotation.y = (1 - u) * (1 - u) * Math.PI * 3; shirt.position.y = 0.02 + (1 - u) * 0.8;
      if (u >= 1 && !revealed) { revealed = true; bundle.visible = false; finish(); }
    }
    camGoal.set(0, 13.0, 7.9);
  } else camGoal.copy(camPos);
  for (const f of flying) { f.v.y -= 0.01 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += 0.1 * dt; f.life -= 0.035 * dt; f.m.scale.multiplyScalar(0.97); }
  flying = flying.filter(f => f.life > 0 || (scene.remove(f.m), f.m.geometry.dispose(), false));
  if (phase === 'fold' || phase === 'dye') { if (bundle) { bundle.position.y = 0; } }
  if (phase === 'fold') shirt.position.y = 0.02;
  slotBottles.forEach((b, i) => { b.rotation.y = Math.sin(t * 1.5 + i) * 0.15; });
  camera.position.lerp(camGoal, 0.06 * dt); camera.lookAt(camLook);
});

// ------------------------------------------------------------------ test hooks
let botAim = null, botAimT = 0;
// v2 solver bot: mixes in the right order and (wet fabric) only drops dye where it can't bleed into another section
function deepBot() {
  const s = L.cols.findIndex((c, i) => secFrac(i) < 0.9);
  if (s < 0) return reveal();
  const t = L.cols[s], need = L.mix && COMP[t] ? COMP[t] : [t];
  const rad = brushNow() * 0.92, spill = spillR(), cand = [];
  for (let k = 0; k < G * G; k++) if (cellSec[k] === s && cellCol[k] !== t && (cellCol[k] < 0 || !L.mix || (COMP[cellCol[k]] || []).every(c => need.includes(c)))) cand.push(k);
  if (!cand.length) return reveal();
  // wet: the drop centre must sit where its bleed circle touches only this section
  if (spill && (!deepBot.cl || deepBot.L !== L)) { deepBot.L = L; deepBot.cl = [];
    const R = Math.ceil(spill * G / 2);
    for (let k = 0; k < G * G; k++) { const sk = cellSec[k]; if (sk < 0) continue; const i = k % G, j = Math.floor(k / G); let ok = true;
      for (let b = Math.max(0, j - R); ok && b <= Math.min(G - 1, j + R); b++) for (let a = Math.max(0, i - R); a <= Math.min(G - 1, i + R); a++) { const q = b * G + a; if (cellSec[q] >= 0 && cellSec[q] !== sk && ((a - i) ** 2 + (b - j) ** 2) * 4 / (G * G) < spill * spill) { ok = false; break; } }
      if (ok) (deepBot.cl[sk] = deepBot.cl[sk] || []).push(k); } }
  for (let tries = 0; tries < 60; tries++) {
    const k = cand[Math.floor(Math.random() * cand.length)]; let at = k;
    if (spill) { const i = k % G, j = Math.floor(k / G); let bd = 1e9; for (const q of deepBot.cl[s] || []) { const d = (q % G - i) ** 2 + (Math.floor(q / G) - j) ** 2; if (d < bd) { bd = d; at = q; } } if (bd * 4 / (G * G) > (rad * 0.9) ** 2) continue; }
    const have = COMP[cellCol[k]] || [], c = need.find(x => !have.includes(x)) ?? need[0];
    if (!L.btns.includes(c)) return reveal();
    if (sel !== c) { selectDye(c); return; }
    const nx = -1 + ((at % G) + 0.5) * 2 / G, nz = -1 + (Math.floor(at / G) + 0.5) * 2 / G;
    dab(nx, nz); botAim = new THREE.Vector3(nx * EXT, surfY(nx, nz), nz * EXT); botAimT = frame; return;
  }
  reveal();
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  // progress for the arcade's tap diagnostics: dye that landed (dabbing the shirt is the game, not frustration)
  get progress() { return phase === 'dye' ? Math.round(L.cols.reduce((a, c, i) => a + secFrac(i), 0) * 20) : phase; },
  get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; },
  // test hooks for simulated players (they go through the same calls as the buttons / a finger)
  sim: { get phase() { return phase; }, get L() { return L; }, get sel() { return sel; }, secOf, secFrac, get brush() { return brushNow(); }, get spill() { return spillR(); }, get G() { return G; }, get cells() { return [...cellSec]; },
    proj: (nx, nz) => { const v = new THREE.Vector3(nx * EXT, surfY(nx, nz), nz * EXT).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight + 0.035 * innerHeight]; },
    go: (n, daily) => { isDaily = !!daily; level = n; state = 'play'; ui.els.start.classList.add('hc-hidden'); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); buildLevel(); },
    fold: (f) => chooseFold(f), pick: (c) => selectDye(c), dab: (nx, nz) => dab(nx, nz), done: () => reveal(true) },
  bot() {
    if (state !== 'play') return;
    if (phase === 'fold') { chooseFold(L.fold); return; }
    if (phase === 'folding') { if (DEEP) scr = 1; return; }
    if (phase !== 'dye') return;
    if (DEEP) return deepBot();
    const s = L.cols.findIndex((c, i) => secFrac(i) < 0.9);
    if (s < 0) { reveal(); return; }
    if (sel !== L.cols[s]) { if (!L.btns.includes(L.cols[s])) return reveal(); selectDye(L.cols[s]); return; }
    for (let n = 0; n < 2; n++) {
      const cand = []; for (let k = 0; k < G * G; k++) if (cellSec[k] === s && cellCol[k] !== L.cols[s]) cand.push(k);
      if (!cand.length) break;
      const k = cand[Math.floor(Math.random() * cand.length)], nx = -1 + ((k % G) + 0.5) * 2 / G, nz = -1 + (Math.floor(k / G) + 0.5) * 2 / G;
      dab(nx, nz); botAim = new THREE.Vector3(nx * EXT, surfY(nx, nz), nz * EXT); botAimT = frame;
    }
  },
};

buildLevel();
ui.start();

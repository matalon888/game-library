// Slab Up — original endless stacker. A slab slides across the top of the tower; tap to drop it.
// Whatever hangs over the edge is sliced off and tumbles away; perfect drops keep the full size and climb a chime scale.
import { THREE, createStage, createUI, store, loop, input, buzz, note, tone, burst, confetti, lerp, clamp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import { LEVELS, WORLDS, levelAt, dailyLevel, dayNum } from './levels.js';
import { SKINS, createMeta, createScreens } from './deep.js';

// READY stays false until v2 is finished and checked: until then no player sees it (?deep=1 is for QA only).
const READY = true;
const DEEP = (READY && ab('deep-slab-up')) || /[?&]deep=1(&|$)/.test(location.search);

if (DEEP) { const st = document.createElement('style'); st.textContent = 'body .hc-pill{top:calc(64px + env(safe-area-inset-top));right:12px;font-size:16px}'; document.head.appendChild(st); }

const H = 0.36, W0 = 3, RANGE = 4.6, TIER = 20, PERFECT = 0.09;
const S = store('slabup');
let best = S.get('best', 0);
const F = flow('slabup', { par: 25, warmup: 8 });
const WB = worldBoard({ game: 'slab-up', label: 'Blocks', limits: { maxRun: 300, maxPerSec: 3 } });

const stage = createStage({ fov: 19, shadows: false });
const { scene, camera } = stage;
const ui = createUI({ title: 'SLAB<br>UP', hint: 'Tap to drop the slab', hand: '👆' });
const M = DEEP ? createMeta(S) : null;
// v2 state: LV = the tower being played (null = endless), perfects/fever/ghost/wind/orbit
let LV = null, perfects = 0, fever = 0, BW = W0, topper = null, goalIdx = 0, tries = 0, lvStart = 0, lastCut = 0;

// ---------------------------------------------------------------- flat-shaded box: faces get fixed shades, colour comes from instance/material
function shadedBox() {
  const g = new THREE.BoxGeometry(1, 1, 1), n = g.attributes.position.count, c = new Float32Array(n * 3);
  const shade = [0.86, 0.6, 1.0, 0.5, 0.72, 0.6];            // px nx py ny pz nz — camera sees +x, +y, +z
  for (let v = 0; v < n; v++) { const s = shade[Math.floor(v / 4)]; c[v * 3] = c[v * 3 + 1] = c[v * 3 + 2] = s; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const BOX = shadedBox();
const MAXI = 110;
const towerMesh = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ vertexColors: true }), MAXI);
towerMesh.frustumCulled = false; scene.add(towerMesh);
const pedestal = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ vertexColors: true })); scene.add(pedestal);
const mover = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ vertexColors: true })); scene.add(mover);
// perfect-drop glow outline
const frameGeo = (() => { const s = new THREE.Shape(), o = 0.5, i = 0.44; s.moveTo(-o, -o); s.lineTo(o, -o); s.lineTo(o, o); s.lineTo(-o, o); s.lineTo(-o, -o);
  const h = new THREE.Path(); h.moveTo(-i, -i); h.lineTo(-i, i); h.lineTo(i, i); h.lineTo(i, -i); h.lineTo(-i, -i); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })();
const rings = [];
for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); scene.add(m); rings.push({ m, t: 1 }); }
// tiny white floating squares in the sky (like dust motes)
const motes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }), 40);
const moteData = []; for (let i = 0; i < 40; i++) moteData.push({ x: (Math.random() - 0.5) * 18, y: Math.random() * 20, z: (Math.random() - 0.5) * 18, s: 0.5 + Math.random(), v: 0.004 + Math.random() * 0.01 });
motes.frustumCulled = false; scene.add(motes);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// ---------------------------------------------------------------- state
let state = 'ready', blocks = [], score = 0, combo = 0, hue0 = 0, axis = 'x', dir = 1, speed = 0.06, pos = 0, cur = null;
let camY = 0, camDist = 40, camDistT = 40, falling = [], botPending = false, tier = 1, shake = 0, squash = 0, clock = 0;

const skinNow = () => (DEEP && M ? SKINS[M.skin()] : SKINS[0]);
const colorAt = (i) => { const k = skinNow(); if (!k.rain) return _c.setHSL((((k.h + i * k.step) % 360) + 360) % 360 / 360, k.s, k.l + Math.sin(i * 0.9) * 0.025).clone();
  return _c.setHSL(((hue0 + i * 5.5) % 360) / 360, 0.72, 0.6 + Math.sin(i * 0.9) * 0.025).clone(); };
function setBg() {
  const top = blocks.length, k0 = skinNow(), h = k0.rain ? hue0 + top * 5.5 : k0.h + top * k0.step;
  const a = new THREE.Color().setHSL(((h + 150) % 360) / 360, 0.6, 0.6), b = new THREE.Color().setHSL(((h + 110) % 360) / 360, 0.62, 0.76);
  const bs = document.body.style; bs.setProperty('--bg1', '#' + a.getHexString()); bs.setProperty('--bg2', '#' + b.getHexString()); bs.setProperty('--ui', '#' + colorAt(top + 6).offsetHSL(0, 0.1, -0.12).getHexString());
}
function writeInstance(i) {
  const b = blocks[i], k = i % (MAXI - 24);
  _m.compose(_p.set(b.x, b.y, b.z), _q.identity(), _s.set(b.w, H, b.d)); towerMesh.setMatrixAt(k, _m); towerMesh.setColorAt(k, b.col);
  towerMesh.instanceMatrix.needsUpdate = true; towerMesh.instanceColor.needsUpdate = true;
}
function reset() {
  hue0 = DEEP && LV ? WORLDS[LV.world].hue : Math.random() * 360; blocks = []; score = 0; combo = 0; speed = 0.062 * (DEEP && LV ? LV.sp * (tries >= 4 ? 0.85 : tries >= 2 ? 0.92 : 1) : 1) * F.k(0); tier = 1; botPending = false;
  BW = DEEP && LV ? LV.w : W0; perfects = 0; fever = 0; if (topper) { scene.remove(topper); topper = null; }
  falling.forEach(f => scene.remove(f.m)); falling = [];
  for (let k = 0; k < MAXI; k++) { _m.makeScale(0, 0, 0); towerMesh.setMatrixAt(k, _m); }
  towerMesh.count = MAXI;
  blocks.push({ x: 0, z: 0, w: BW, d: BW, y: 0, col: colorAt(0) }); writeInstance(0);
  for (let k = 1; k <= 24; k++) { const kk = MAXI - k; _m.compose(_p.set(0, -k * H, 0), _q.identity(), _s.set(BW, H, BW)); towerMesh.setMatrixAt(kk, _m); towerMesh.setColorAt(kk, colorAt(-k)); }
  towerMesh.instanceColor.needsUpdate = true;
  pedestal.scale.set(BW, 30, BW); pedestal.position.set(0, -24.5 * H - 15, 0); pedestal.material.color.copy(colorAt(-25));
  camY = 0; camDist = camDistT = 40; ui.score(0); ui.sub(best ? 'BEST ' + best : ''); ui.levels(1); ui.progress(0); setBg();
  if (DEEP && LV) { goalIdx = LV.goal; ui.levels(LV.n || '★'); if (!LV.n) ui.els.top.querySelector('[data-b]').textContent = '🏁'; ui.sub(levelTag(LV)); ui.pill(starMeter()); mover.material.transparent = true; mover.material.opacity = 1; }
  else if (DEEP) { goalIdx = 0; ui.pill(''); mover.material.opacity = 1; }
  spawn();
}
function spawn() {
  const top = blocks[blocks.length - 1];
  axis = blocks.length % 2 ? 'x' : 'z'; dir = 1; pos = -RANGE;
  cur = { x: top.x, z: top.z, w: top.w, d: top.d, y: top.y + H, col: colorAt(blocks.length) };
  if (DEEP && LV) {   // special slabs: gold (perfect regrows the tower), rush (comes in fast)
    const n = blocks.length; cur.gold = LV.gold.includes(n); cur.rush = LV.rush.includes(n);
    if (cur.gold) cur.col = new THREE.Color('#ffc928'); else if (cur.rush) cur.col.lerp(new THREE.Color('#ff4a4a'), 0.6);
    if (cur.rush) ui.pop('RUSH!', '#ff6a5c', 30, 40);
    if (cur.gold) ui.pop('GOLD ✦', '#ffd23f', 30, 40);
  }
  mover.material.color.copy(cur.col); mover.visible = true; place();
}
function place() {
  mover.scale.set(cur.w, H, cur.d);
  const top = blocks[blocks.length - 1];
  const [ex, ez] = offs(); mover.position.set(top.x + ex, cur.y, top.z + ez);
}
// where the moving slab is, relative to the tower top (v2: wind wobble, diagonal approach)
function offs() {
  const w = DEEP && LV && LV.wind ? Math.sin(clock * 2.4 + blocks.length) * LV.wind * 1.1 : 0;
  if (DEEP && LV && LV.diag) { const a = (pos + w) * 0.78; return [a, (blocks.length % 2 ? 1 : -1) * a]; }
  return axis === 'x' ? [pos + w, 0] : [0, pos + w];
}
const levelTag = (lv) => (lv.daily ? 'DAILY TOWER ' : 'TOWER ' + lv.n) + (lv.hard ? ' · HARD' : '') + ((lv.blink ? ' 👻' : '') + (lv.wind ? ' 💨' : '') + (lv.diag ? ' ◢' : '') + (lv.rush.length ? ' ⚡' : '') + (lv.gold.length ? ' ✦' : ''));
const starsFor = (lv, p) => (p >= lv.par[1] ? 3 : p >= lv.par[0] ? 2 : 1);
const starMeter = () => { const s = starsFor(LV, perfects); return '★'.repeat(s) + '☆'.repeat(3 - s) + (s < 3 ? ' ' + perfects + '/' + LV.par[s - 1 < 1 ? 0 : 1] : ''); };
function fallPiece(x, y, z, w, d, col, vx, vz) {
  const m = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ vertexColors: true, color: col })); m.scale.set(w, H, d); m.position.set(x, y, z); scene.add(m);
  falling.push({ m, vy: 0.02, vx, vz, rx: (Math.random() - 0.5) * 0.06 + vz * 0.8, rz: -vx * 0.8 + (Math.random() - 0.5) * 0.04, t: 0 });
}
function perfectRing(b) {
  const r = rings.find(r => r.t >= 1) || rings[0]; r.t = 0; r.w = b.w; r.d = b.d; r.m.position.set(b.x, b.y + H / 2 + 0.01, b.z);
}

function drop() {
  if (DEEP) return dropDeep();
  if (state !== 'play' || !cur) return;
  const top = blocks[blocks.length - 1];
  const along = axis === 'x' ? 'w' : 'd', c = axis === 'x' ? 'x' : 'z';
  const center = top[c] + pos, delta = center - top[c], size = top[along];
  const b = { ...cur }; b[c] = center;
  if (Math.abs(delta) <= PERFECT) {                             // PERFECT: snap, keep size, rising chime
    b[c] = top[c]; combo++;
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    note(64 + scale[Math.min(combo - 1, scale.length - 1)], 0.5, 0.2);
    if (combo >= 6 && b[along] < W0) {                           // long perfect streaks grow the slab back
      const g = Math.min(W0 - b[along], 0.25); b[along] += g; ui.pop('GROW!', '#fff', 32, 32);
    } else ui.pop(combo > 1 ? `PERFECT ×${combo}` : 'PERFECT', '#fff', 30 + Math.min(combo, 8) * 2, 32);
    perfectRing(b); if (combo >= 3) { const r2 = rings.find(r => r.t >= 1); if (r2) { r2.t = -0.12; r2.w = b.w; r2.d = b.d; r2.m.position.copy(rings.find(r => r.t === 0).m.position); } }
    burst(scene, new THREE.Vector3(b.x, b.y + H / 2, b.z), ['#ffffff', '#' + b.col.getHexString()], 10, { speed: 0.09, up: 0.06, size: 0.6, gravity: 0.004 });
    buzz(12); ui.flash(0.12);
  } else {
    const overlap = size - Math.abs(delta);
    if (overlap <= 0) { fallPiece(mover.position.x, mover.position.y, mover.position.z, cur.w, cur.d, cur.col, axis === 'x' ? Math.sign(delta) * 0.03 : 0, axis === 'z' ? Math.sign(delta) * 0.03 : 0); mover.visible = false; cur = null; return lose(); }
    combo = 0;
    b[along] = overlap; b[c] = top[c] + delta / 2;
    // the overhang becomes its own piece and falls
    const cut = Math.abs(delta), sgn = Math.sign(delta), fx = { x: b.x, z: b.z, w: b.w, d: b.d };
    fx[c] = b[c] + sgn * (overlap / 2 + cut / 2); fx[along] = cut;
    fallPiece(fx.x, b.y, fx.z, fx.w, fx.d, b.col, axis === 'x' ? sgn * 0.025 : 0, axis === 'z' ? sgn * 0.025 : 0);
    tone(300 + Math.min(blocks.length, 40) * 4, 0.09, 'triangle', 0.13, 0.7); buzz(8);
  }
  blocks.push(b); writeInstance(blocks.length - 1);
  score = blocks.length - 1; ui.score(score); squash = 1; shake = 0.06;
  speed = Math.min(0.17, (0.062 + score * 0.0011) * F.k(score));
  const t = Math.floor(score / TIER) + 1;
  if (t > tier) { tier = t; ui.levels(tier); confetti(scene, new THREE.Vector3(b.x, b.y + 1, b.z), 50); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s, 0.4, 0.15), i * 90)); ui.pop(`LEVEL ${tier}!`, '#fff', 40, 30); }
  ui.progress((score % TIER) / TIER);
  if (score > best && best > 0 && score === best + 1) ui.pop('NEW BEST!', '#fff', 34, 38);
  setBg(); spawn();
}
function lose() {
  state = 'lost'; F.endless(score); WB.submit(score); best = Math.max(best, score); S.set('best', best);
  tone(180, 0.35, 'sawtooth', 0.1, 0.5); buzz([30, 40, 60]); shake = 0.25;
  camDistT = clamp(40 + blocks.length * H * 2.2, 40, 110);           // zoom out to admire the tower
  ui.lose(String(score), best ? 'BEST ' + best : '');
  setTimeout(() => state === 'lost' && ui.els.sc.classList.add('hc-hidden'), 650);
}

// ---------------------------------------------------------------- v2: the 2-axis cut, win / lose, level flow
function piece(xa, xb, za, zb, y, col, vx, vz) { if (xb - xa < 0.03 || zb - za < 0.03) return; fallPiece((xa + xb) / 2, y, (za + zb) / 2, xb - xa, zb - za, col, vx, vz); }
function dropDeep() {
  if (state !== 'play' || !cur) return;
  const top = blocks[blocks.length - 1], [ex, ez] = offs(), cx = top.x + ex, cz = top.z + ez;
  const tol = (LV ? LV.tol * (tries >= 3 ? 1.5 : tries >= 1 ? 1.25 : 1) : PERFECT) * (fever > 0 ? 1.8 : 1), perfect = Math.abs(ex) <= tol && Math.abs(ez) <= tol;
  const x0 = cx - cur.w / 2, x1 = cx + cur.w / 2, z0 = cz - cur.d / 2, z1 = cz + cur.d / 2, y = cur.y, col = cur.col;
  const b = { ...cur }; delete b.rush;
  if (perfect) {
    b.x = top.x; b.z = top.z; combo++; perfects += cur.gold ? 2 : 1;
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    note(64 + scale[Math.min(combo - 1, scale.length - 1)], 0.5, 0.2);
    if (cur.gold) { note(88, 0.5, 0.18); setTimeout(() => note(95, 0.4, 0.16), 90); }
    const gain = cur.gold ? 0.5 : combo >= 4 ? 0.2 : 0;
    if (gain && (b.w < BW || b.d < BW)) { b.w = Math.min(BW, b.w + gain); b.d = Math.min(BW, b.d + gain); ui.pop(cur.gold ? 'GOLD! GROW' : 'GROW!', '#ffd23f', 34, 32); }
    else ui.pop(combo > 1 ? `PERFECT ×${combo}` : 'PERFECT', combo >= 5 ? '#ffd23f' : '#fff', 30 + Math.min(combo, 8) * 3, 32);
    if (combo === (LV && LV.n <= 4 ? 3 : 5) && fever <= 0) { fever = 6; ui.pop('FEVER!', '#ff7ac8', 54, 26); ui.flash(0.45); buzz([10, 20, 10, 20, 30]); [0, 4, 7, 12, 16].forEach((q, i) => setTimeout(() => note(76 + q, 0.3, 0.15), i * 60)); }
    perfectRing(b); if (combo >= 3) { const r2 = rings.find(r => r.t >= 1); if (r2) { r2.t = -0.12; r2.w = b.w; r2.d = b.d; r2.m.position.copy(rings.find(r => r.t === 0).m.position); } }
    burst(scene, new THREE.Vector3(b.x, b.y + H / 2, b.z), cur.gold ? ['#ffd23f', '#fff6c0'] : ['#ffffff', '#' + b.col.getHexString()], Math.min(34, 8 + combo * 3 + (cur.gold ? 14 : 0)), { speed: 0.09 + combo * 0.004, up: 0.06, size: 0.6, gravity: 0.004 });
    if (combo === 8 || combo === 12 || combo === 16) { ui.pop(combo === 8 ? 'UNSTOPPABLE!' : combo === 12 ? 'LEGEND!' : 'IMPOSSIBLE!', '#ffd23f', 48, 24); ui.flash(0.5); camDist -= 3; shake = 0.2; buzz([15, 20, 15, 20, 40]); [0, 4, 7, 12, 16, 19].forEach((q, i) => setTimeout(() => note(79 + q, 0.5, 0.18), i * 70)); }
    else if (combo === 4) { ui.pop('NICE!', '#7ee0ff', 40, 26); [0, 7, 12].forEach((q, i) => setTimeout(() => note(79 + q, 0.4, 0.16), i * 60)); }
    buzz(12); ui.flash(0.1 + Math.min(combo, 6) * 0.02); camDist -= 0.5 + Math.min(combo, 6) * 0.25; shake = 0.05 + Math.min(combo, 8) * 0.012;
  } else {
    const lx = Math.max(top.x - top.w / 2, x0), hx = Math.min(top.x + top.w / 2, x1), lz = Math.max(top.z - top.d / 2, z0), hz = Math.min(top.z + top.d / 2, z1);
    let ow = hx - lx, od = hz - lz, nx = (lx + hx) / 2, nz = (lz + hz) / 2;
    if (LV && LV.safe) {   // the first towers cannot be lost: a miss still leaves a stub to build on
      if (ow < 0.9) { ow = 0.9; nx = top.x + Math.sign(ex || 1) * (top.w / 2 - 0.45); } if (od < 0.9) { od = 0.9; nz = top.z + Math.sign(ez || 1) * (top.d / 2 - 0.45); }
    }
    if (ow <= 0.02 || od <= 0.02) { fallPiece(mover.position.x, y, mover.position.z, cur.w, cur.d, col, Math.sign(ex) * 0.03, Math.sign(ez) * 0.03); mover.visible = false; cur = null; lastCut = { ex, ez }; return loseDeep(); }
    const bx0 = nx - ow / 2, bx1 = nx + ow / 2, bz0 = nz - od / 2, bz1 = nz + od / 2;
    piece(x0, bx0, z0, z1, y, col, -0.025, 0); piece(bx1, x1, z0, z1, y, col, 0.025, 0);
    piece(bx0, bx1, z0, bz0, y, col, 0, -0.025); piece(bx0, bx1, bz1, z1, y, col, 0, 0.025);
    b.x = nx; b.z = nz; b.w = ow; b.d = od; combo = 0; fever = 0;
    tone(300 + Math.min(blocks.length, 40) * 4, 0.09, 'triangle', 0.13, 0.7); buzz(8);
    const lost = Math.round((1 - (ow * od) / (cur.w * cur.d)) * 100); if (lost >= 40) { shake = 0.1; ui.pop(`-${lost}%`, '#fff', 26, 34); }
  }
  if (fever > 0 && perfect) fever--; 
  blocks.push(b); writeInstance(blocks.length - 1);
  score = blocks.length - 1; ui.score(score); squash = 1; shake = Math.max(shake, 0.06);
  if (LV) {
    speed = Math.min(0.2, 0.062 * LV.sp * (1 + 0.3 * score / LV.goal) * F.k(score));
    ui.progress(score / LV.goal); ui.pill(starMeter() + (fever > 0 ? ' 🔥' : ''));
    if (score >= LV.goal) return win();
    if (LV.goal - score === 2) ui.pop('2 TO GO', '#fff', 26, 38);
  } else {
    speed = Math.min(0.17, (0.062 + score * 0.0011) * F.k(score));
    const t = Math.floor(score / TIER) + 1;
    if (t > tier) { tier = t; ui.levels(tier); confetti(scene, new THREE.Vector3(b.x, b.y + 1, b.z), 50); [0, 4, 7, 12].forEach((q, i) => setTimeout(() => note(72 + q, 0.4, 0.15), i * 90)); ui.pop(`LEVEL ${tier}!`, '#fff', 40, 30); }
    ui.progress((score % TIER) / TIER);
    if (score > best && best > 0 && score === best + 1) ui.pop('NEW BEST!', '#fff', 34, 38);
    ui.pill(fever > 0 ? '🔥' : '');
  }
  setBg(); spawn();
}
function win() {
  state = 'won'; const b = blocks[blocks.length - 1]; mover.visible = false; cur = null;
  const st = starsFor(LV, perfects), before = M.total(); tries = 0;
  if (LV.daily) M.dailyClear(st); else M.clear(LV.n, st);
  const after = M.total(), ns = SKINS.findIndex(k => k.need > before && k.need <= after);
  topper = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); topper.position.set(b.x, b.y + 2.2, b.z); scene.add(topper);
  confetti(scene, new THREE.Vector3(b.x, b.y + 1, b.z), 70); setTimeout(() => confetti(scene, new THREE.Vector3(b.x, b.y + 2, b.z), 50), 250);
  [0, 4, 7, 12, 16].forEach((q, i) => setTimeout(() => note(72 + q, 0.5, 0.16), i * 100)); buzz([20, 30, 40]); shake = 0.12;
  camDistT = clamp(40 + blocks.length * H * 2.2, 40, 110); ui.pop(st === 3 ? 'FLAWLESS!' : 'TOWER DONE!', '#fff', 46, 30);
  setTimeout(() => state === 'won' && screens.win(LV, { stars: st, perfects, newSkin: ns, hasNext: !LV.daily && LV.n < LEVELS.length }), 1100);
}
function loseDeep() {
  state = 'lost'; tone(180, 0.35, 'sawtooth', 0.1, 0.5); buzz([30, 40, 60]); shake = 0.25; combo = 0; fever = 0;
  camDistT = clamp(40 + blocks.length * H * 2.2, 40, 110);
  const sc = ui.els.sc; setTimeout(() => state === 'lost' && sc.classList.add('hc-hidden'), 400);
  if (LV) {
    const left = LV.goal - score, side = Math.abs(lastCut.ez) > Math.abs(lastCut.ex) ? (lastCut.ez > 0 ? 'late' : 'early') : (lastCut.ex > 0 ? 'right' : 'left');
    tries++; setTimeout(() => state === 'lost' && screens.lose(LV, left <= 2 ? `SO CLOSE: ${left} LEFT` : `${left} TO THE TOP`, (side === 'early' ? 'Too early. Wait for the middle.' : side === 'late' ? 'Too late. Wait for the middle.' : LV.diag ? 'Missed the corner. Wait for the middle.' : `Missed to the ${side}. Wait for the middle.`)), 250);
  } else {
    F.endless(score); WB.submit(score); best = Math.max(best, score); S.set('best', best);
    setTimeout(() => state === 'lost' && screens.lose(null, String(score), best ? 'BEST ' + best : ''), 450);
  }
}
function begin(lv) {   // lv: a level object, or null for the endless climb
  LV = lv; tries = LV && LV.n === (begin.last || 0) ? tries : 0; begin.last = LV ? LV.n : 0; screens.close();
  if (!LV) WB.start();
  reset(); state = 'play'; ui.hideStart(); ui.els.sc.classList.remove('hc-hidden'); screens.btn.classList.remove('hc-hidden'); M.touchDay();
  if (LV) { camDistT = 40; if (LV.hard) ui.pop('HARD TOWER', '#ff6a5c', 38, 34); else if (LV.n === 1) ui.pop('TAP TO DROP', '#fff', 34, 36); }
}
const screens = DEEP ? createScreens(M, {
  play: n => begin(levelAt(n)), daily: () => begin(dailyLevel()), endless: () => begin(null),
  retry: () => begin(LV), next: () => begin(levelAt(LV.n + 1)), openMap: () => { state = 'map'; screens.map(); },
  skinChanged: () => { reset(); },
  starSfx: i => { note(76 + i * 4, 0.35, 0.18); buzz(10); },
}) : null;

input({ onDown: () => { if (state === 'play') drop(); } });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first run, until the first real
// touch, two slabs drop themselves right on the tower (timed like the bot, with no error), so the tower grows and shows the tap
let demoDrops = 0;
demo(() => {
  if (demoDrops >= 2) return false; if (!cur || botPending) return;
  const tms = -pos / (dir * speed * 60 / 1000); if (tms > 0 && tms < 150) { demoDrops++; botPending = true; setTimeout(() => { botPending = false; drop(); }, tms); }
}, { ready: () => state === 'play' && score < 2 && (!DEEP || (LV && LV.n === 1 && !M.stars()[1])), wait: 1500, every: 60, max: 150, ms: 5000 });
ui.onTap(() => { if (DEEP) { const u = M.unlocked(); return begin(u > LEVELS.length ? null : levelAt(u)); } WB.start(); reset(); state = 'play'; ui.hideStart(); ui.els.sc.classList.remove('hc-hidden'); });

// ---------------------------------------------------------------- loop
const DIR = new THREE.Vector3(1, 0.98, 1).normalize();
loop((dt, t) => {
  clock += dt / 60;
  if (state === 'play' && cur) {
    let mul = 1;
    if (DEEP && LV) {
      if (cur.rush) mul *= 1.55;
      if (LV.mode === 'sine') mul *= 0.45 + 1.1 * (1 - (pos / RANGE) * (pos / RANGE)); else if (LV.mode === 'burst') mul *= Math.sin(clock * 3.2) > 0.2 ? 1.5 : 0.55;
      if (LV.blink) mover.material.opacity = ((clock * 1.15) % 1) > 1 - LV.blink ? 0.1 : 1;
    }
    pos += dir * speed * dt * mul;
    if (pos > RANGE) { pos = RANGE; dir = -1; } else if (pos < -RANGE) { pos = -RANGE; dir = 1; }
    place();
  }
  // falling offcuts
  for (const f of falling) { f.t += dt; f.vy -= 0.012 * dt; f.m.position.y += f.vy * dt; f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt; f.m.rotation.x += f.rx * dt; f.m.rotation.z += f.rz * dt; }
  for (let i = falling.length - 1; i >= 0; i--) if (falling[i].t > 150) { scene.remove(falling[i].m); falling[i].m.material.dispose(); falling.splice(i, 1); }
  // perfect outline rings expand + fade
  for (const r of rings) { if (r.t >= 1) { r.m.material.opacity = 0; continue; } r.t = Math.min(1, r.t + dt * 0.035); const k = Math.max(0, r.t); r.m.scale.set(r.w * (1 + k * 0.35) + 0.2, 1, r.d * (1 + k * 0.35) + 0.2); r.m.material.opacity = r.t < 0 ? 0 : 0.9 * (1 - k); }
  if (topper) { topper.rotation.y += 0.06 * dt; topper.position.y += Math.sin(clock * 4) * 0.004 * dt; }
  if (DEEP && fever > 0 && cur) mover.material.color.setHSL((clock * 2.5) % 1, 0.8, 0.62);
  // squash the top block on landing
  squash = Math.max(0, squash - dt * 0.12);
  if (blocks.length > 1) { const k = (blocks.length - 1) % (MAXI - 24), b = blocks[blocks.length - 1]; _m.compose(_p.set(b.x, b.y - squash * 0.04, b.z), _q.identity(), _s.set(b.w * (1 + squash * 0.04), H * (1 - squash * 0.25), b.d * (1 + squash * 0.04))); towerMesh.setMatrixAt(k, _m); towerMesh.instanceMatrix.needsUpdate = true; }
  // camera rises with the tower; zooms out on fail
  const topY = blocks.length ? blocks[blocks.length - 1].y : 0;
  const targetY = state === 'lost' || state === 'won' ? topY * 0.5 : topY;
  camY = lerp(camY, targetY, 0.08 * dt); camDist = lerp(camDist, camDistT, 0.04 * dt);
  shake = Math.max(0, shake - dt * 0.01);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  camera.position.set(DIR.x * camDist + sx, camY - 1.2 + DIR.y * camDist + sy, DIR.z * camDist);
  camera.lookAt(0, camY - 1.2 - (camDist - 40) * 0.03, 0);
  // motes drift up around the camera
  moteData.forEach((d, i) => { d.y += d.v * dt; if (d.y > 22) d.y = 0; _m.compose(_p.set(d.x, camY - 6 + d.y, d.z), camera.quaternion, _s.set(d.s, d.s, 1)); motes.setMatrixAt(i, _m); });
  motes.instanceMatrix.needsUpdate = true;
});

reset(); ui.start(); ui.els.sc.classList.add('hc-hidden');

if (DEEP) { const g = +new URLSearchParams(location.search).get('go'); if (g) setTimeout(() => begin(g < 0 ? null : g > 100 ? dailyLevel() : levelAt(g)), 50); }
window.__game = {
  get perfects() { return perfects; }, get goal() { return LV ? LV.goal : 0; }, get lv() { return LV; }, begin: (n) => begin(n < 0 ? null : n === 0 ? dailyLevel() : levelAt(n)),
  get meta() { return M ? { total: M.total(), unlocked: M.unlocked(), streak: M.streak() } : null; },
  // QA: a human-ish player. noise = how sloppy (0 = exact). Returns a stop function.
  auto(noise = 0.3) {
    let seen = null, aim = 0;
    const t = setInterval(() => {
      if (state !== 'play' || !cur) return; if (seen !== cur) { seen = cur; aim = (Math.random() * 2 - 1) * noise * (LV ? LV.tol : PERFECT) * 3; }
      const [ex, ez] = offs(), e = (axis === 'x' || (LV && LV.diag) ? ex : ez), step = speed * 1.2;
      if (Math.abs(e - aim) < step) drop();
    }, 4);
    return () => clearInterval(t);
  },
  get state() { return state; }, get level() { return tier; }, get score() { return score; },
  bot() {   // time the drop: schedule a tap for the moment the slab lines up (with a little human error)
    if (state !== 'play' || !cur || botPending) return;
    const v = dir * speed * 60 / 1000;                    // units per ms
    const tms = -pos / v;                                  // ms until pos == 0
    if (tms > 0 && tms < 150) {
      botPending = true; const err = (Math.random() - 0.5) * (Math.random() < 0.15 ? 150 : 50);
      setTimeout(() => { botPending = false; drop(); }, Math.max(0, tms + err));
    }
  },
};

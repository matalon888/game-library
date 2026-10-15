// Slab Up — original endless stacker. A slab slides across the top of the tower; tap to drop it.
// Whatever hangs over the edge is sliced off and tumbles away; perfect drops keep the full size and climb a chime scale.
import { THREE, createStage, createUI, store, loop, input, buzz, note, tone, burst, confetti, lerp, clamp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';

const H = 0.36, W0 = 3, RANGE = 4.6, TIER = 20, PERFECT = 0.09;
const S = store('slabup');
let best = S.get('best', 0);
const F = flow('slabup', { par: 25, warmup: 8 });
const WB = worldBoard({ game: 'slab-up', label: 'Blocks', limits: { maxRun: 300, maxPerSec: 3 } });

const stage = createStage({ fov: 19, shadows: false });
const { scene, camera } = stage;
const ui = createUI({ title: 'SLAB<br>UP', hint: 'Tap to drop the slab', hand: '👆' });

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

const colorAt = (i) => _c.setHSL(((hue0 + i * 5.5) % 360) / 360, 0.72, 0.6 + Math.sin(i * 0.9) * 0.025).clone();
function setBg() {
  const top = blocks.length, h = hue0 + top * 5.5;
  const a = new THREE.Color().setHSL(((h + 150) % 360) / 360, 0.6, 0.6), b = new THREE.Color().setHSL(((h + 110) % 360) / 360, 0.62, 0.76);
  const bs = document.body.style; bs.setProperty('--bg1', '#' + a.getHexString()); bs.setProperty('--bg2', '#' + b.getHexString()); bs.setProperty('--ui', '#' + colorAt(top + 6).offsetHSL(0, 0.1, -0.12).getHexString());
}
function writeInstance(i) {
  const b = blocks[i], k = i % (MAXI - 24);
  _m.compose(_p.set(b.x, b.y, b.z), _q.identity(), _s.set(b.w, H, b.d)); towerMesh.setMatrixAt(k, _m); towerMesh.setColorAt(k, b.col);
  towerMesh.instanceMatrix.needsUpdate = true; towerMesh.instanceColor.needsUpdate = true;
}
function reset() {
  hue0 = Math.random() * 360; blocks = []; score = 0; combo = 0; speed = 0.062 * F.k(0); tier = 1; botPending = false;
  falling.forEach(f => scene.remove(f.m)); falling = [];
  for (let k = 0; k < MAXI; k++) { _m.makeScale(0, 0, 0); towerMesh.setMatrixAt(k, _m); }
  towerMesh.count = MAXI;
  blocks.push({ x: 0, z: 0, w: W0, d: W0, y: 0, col: colorAt(0) }); writeInstance(0);
  for (let k = 1; k <= 24; k++) { const kk = MAXI - k; _m.compose(_p.set(0, -k * H, 0), _q.identity(), _s.set(W0, H, W0)); towerMesh.setMatrixAt(kk, _m); towerMesh.setColorAt(kk, colorAt(-k)); }
  towerMesh.instanceColor.needsUpdate = true;
  pedestal.scale.set(W0, 30, W0); pedestal.position.set(0, -24.5 * H - 15, 0); pedestal.material.color.copy(colorAt(-25));
  camY = 0; camDist = camDistT = 40; ui.score(0); ui.sub(best ? 'BEST ' + best : ''); ui.levels(1); ui.progress(0); setBg();
  spawn();
}
function spawn() {
  const top = blocks[blocks.length - 1];
  axis = blocks.length % 2 ? 'x' : 'z'; dir = 1; pos = -RANGE;
  cur = { x: top.x, z: top.z, w: top.w, d: top.d, y: top.y + H, col: colorAt(blocks.length) };
  mover.material.color.copy(cur.col); mover.visible = true; place();
}
function place() {
  mover.scale.set(cur.w, H, cur.d);
  const top = blocks[blocks.length - 1];
  mover.position.set(axis === 'x' ? top.x + pos : cur.x, cur.y, axis === 'z' ? top.z + pos : cur.z);
}
function fallPiece(x, y, z, w, d, col, vx, vz) {
  const m = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ vertexColors: true, color: col })); m.scale.set(w, H, d); m.position.set(x, y, z); scene.add(m);
  falling.push({ m, vy: 0.02, vx, vz, rx: (Math.random() - 0.5) * 0.06 + vz * 0.8, rz: -vx * 0.8 + (Math.random() - 0.5) * 0.04, t: 0 });
}
function perfectRing(b) {
  const r = rings.find(r => r.t >= 1) || rings[0]; r.t = 0; r.w = b.w; r.d = b.d; r.m.position.set(b.x, b.y + H / 2 + 0.01, b.z);
}

function drop() {
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

input({ onDown: () => { if (state === 'play') drop(); } });
ui.onTap(() => { WB.start(); reset(); state = 'play'; ui.hideStart(); ui.els.sc.classList.remove('hc-hidden'); });

// ---------------------------------------------------------------- loop
const DIR = new THREE.Vector3(1, 0.98, 1).normalize();
loop((dt, t) => {
  clock += dt / 60;
  if (state === 'play' && cur) {
    pos += dir * speed * dt;
    if (pos > RANGE) { pos = RANGE; dir = -1; } else if (pos < -RANGE) { pos = -RANGE; dir = 1; }
    place();
  }
  // falling offcuts
  for (const f of falling) { f.t += dt; f.vy -= 0.012 * dt; f.m.position.y += f.vy * dt; f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt; f.m.rotation.x += f.rx * dt; f.m.rotation.z += f.rz * dt; }
  for (let i = falling.length - 1; i >= 0; i--) if (falling[i].t > 150) { scene.remove(falling[i].m); falling[i].m.material.dispose(); falling.splice(i, 1); }
  // perfect outline rings expand + fade
  for (const r of rings) { if (r.t >= 1) { r.m.material.opacity = 0; continue; } r.t = Math.min(1, r.t + dt * 0.035); const k = Math.max(0, r.t); r.m.scale.set(r.w * (1 + k * 0.35) + 0.2, 1, r.d * (1 + k * 0.35) + 0.2); r.m.material.opacity = r.t < 0 ? 0 : 0.9 * (1 - k); }
  // squash the top block on landing
  squash = Math.max(0, squash - dt * 0.12);
  if (blocks.length > 1) { const k = (blocks.length - 1) % (MAXI - 24), b = blocks[blocks.length - 1]; _m.compose(_p.set(b.x, b.y - squash * 0.04, b.z), _q.identity(), _s.set(b.w * (1 + squash * 0.04), H * (1 - squash * 0.25), b.d * (1 + squash * 0.04))); towerMesh.setMatrixAt(k, _m); towerMesh.instanceMatrix.needsUpdate = true; }
  // camera rises with the tower; zooms out on fail
  const topY = blocks.length ? blocks[blocks.length - 1].y : 0;
  const targetY = state === 'lost' ? topY * 0.5 : topY;
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

window.__game = {
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

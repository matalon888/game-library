// Horde Blast — original game. Hold to fire a stream of little blue fighters, aim them through multiplier gates, overrun the red fortress.
import { bake, vcMat } from './merge.js';
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapter } from './kit/adapt.js';

import { board } from './kit/board.js';
const WB = board({ game: 'horde-blast', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.3 }, mode: 'sum' });
const save = store('hordeblast');
const F = flow('hordeblast');
let fk = 1;
// in-round adaptation (kit/adapt.js, ADAPT_BRIEF.md): each second, troops steered through blue gates count as good aim and
// troops lost to red gates and crushers count as bad. The level eases or pushes the waves (size, pace, speed) by up to
// ±20 %, inside ±25 % with flow.js (never harder on levels 1-2). Rescue (at most one a round, 60 s apart, only for a
// player who has been aiming well): a shockwave when the mob reaches the cannon, or reinforcements when the troops run
// out with the fort nearly down. Off for ranked players. Never touches the score. QA reads window.__game.adapt.
const AD = adapter(); let inAt = -1e9, aimG = 0, aimB = 0, aimT = 0, rescued = false;
let level = save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';
const { scene, camera, renderer, sun, hemi, followLight } = createStage({ fov: 50, shadowSize: 30 });
sun.position.set(8, 20, 6); sun.shadow.camera.far = 90; hemi.intensity = 1.2; sun.intensity = 1.6;
document.body.style.setProperty('--bg1', '#9fd8ff'); document.body.style.setProperty('--bg2', '#ffe2b0'); document.body.style.setProperty('--ui', '#2f7bff');
scene.fog = new THREE.Fog('#f6dfb3', 60, 140);
const ui = createUI({ title: 'HORDE<br>BLAST', hint: 'Tap left or right to fire · hold and drag to aim', hand: '👆' });
Object.assign(ui.els.sub.style, { color: '#fff', fontSize: '18px', fontWeight: '800', textShadow: '0 2px 5px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.5)' });   // tips + OUT OF TROOPS stay readable on the sky
ui.levels(level);

const W = 5.2, LEN = 44, BASEZ = -LEN, MAXU = 700;
// ---------------------------------------------------------------- ground + lane
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const sandTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#f2d39b'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = ['#e6c283', '#f7dfae', '#d9b57a', '#8fb35a'][i % 4]; const s = 1 + Math.random() * 3; x.fillRect(Math.random() * w, Math.random() * h, s, s); } });
sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(24, 24);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
const laneTex = canvasTex(128, 512, (x, w, h) => { x.fillStyle = '#b9bdc8'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = Math.random() < 0.5 ? '#b0b4bf' : '#c3c7d1'; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } x.fillStyle = '#ffffff'; for (let y = 0; y < h; y += 64) x.fillRect(w / 2 - 2, y, 4, 32); });
laneTex.wrapT = THREE.RepeatWrapping; laneTex.repeat.set(1, 6);
const lane = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.4, 0.3, LEN + 14), new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.9 }));
lane.position.set(0, 0, -LEN / 2 + 3); lane.receiveShadow = true; scene.add(lane);
// side rails: rows of blue/white boards like a stadium edge
const railGeo = rounded(0.5, 0.9, 1.7, 0.12);
const rails = new THREE.InstancedMesh(railGeo, mat('#ffffff'), 140); rails.castShadow = true; scene.add(rails);
{ const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
  for (const sx of [-1, 1]) for (let z = 8; z > -LEN - 8; z -= 1.8) { m.compose(new THREE.Vector3(sx * (W + 0.55), 0.55, z), q, new THREE.Vector3(1, 1, 1)); rails.setMatrixAt(n, m); rails.setColorAt(n, c.set(n % 2 ? '#3d8bff' : '#e9f2ff')); n++; }
  rails.count = n; rails.instanceMatrix.needsUpdate = true; }
// desert shrubs + rocks
const shrubGeo = bake([{ geo: new THREE.IcosahedronGeometry(0.5, 0), color: '#7fa64a' }, { geo: new THREE.IcosahedronGeometry(0.35, 0), color: '#94bb55', pos: [0.35, 0.1, 0.1] }]);
const shrubs = new THREE.InstancedMesh(shrubGeo, vcMat({ flatShading: true }), 160); shrubs.castShadow = true; scene.add(shrubs);
{ const m = new THREE.Matrix4(), q = new THREE.Quaternion(); const r = rng(99); let n = 0;
  for (let i = 0; i < 160; i++) { const sx = r() < 0.5 ? -1 : 1, x = sx * (W + 2 + r() * 30), z = 10 - r() * (LEN + 40), s = 0.6 + r() * 1.4;
    m.compose(new THREE.Vector3(x, 0.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s * 0.8, s)); shrubs.setMatrixAt(n++, m); }
  shrubs.instanceMatrix.needsUpdate = true; }

// ---------------------------------------------------------------- units (instanced crowds)
const unitGeo = bake([{ geo: new THREE.CapsuleGeometry(0.22, 0.28, 4, 10), color: '#ffffff', pos: [0, 0.38, 0] }, { geo: new THREE.SphereGeometry(0.2, 12, 10), color: '#ffffff', pos: [0, 0.82, 0] },
  { geo: new THREE.SphereGeometry(0.06, 6, 5), color: '#1b2140', pos: [-0.08, 0.86, -0.17] }, { geo: new THREE.SphereGeometry(0.06, 6, 5), color: '#1b2140', pos: [0.08, 0.86, -0.17] },
  { geo: new THREE.CapsuleGeometry(0.07, 0.2, 3, 6), color: '#ffffff', pos: [-0.27, 0.45, 0], rot: [0, 0, 0.4] }, { geo: new THREE.CapsuleGeometry(0.07, 0.2, 3, 6), color: '#ffffff', pos: [0.27, 0.45, 0], rot: [0, 0, -0.4] }]);
// tint: vertex colours are white for body (so instance colour shows) except the eyes
const blueM = new THREE.InstancedMesh(unitGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, color: '#2f86ff' }), MAXU); blueM.castShadow = true; blueM.frustumCulled = false; scene.add(blueM);
const redM = new THREE.InstancedMesh(unitGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, color: '#ff3048' }), MAXU); redM.castShadow = true; redM.frustumCulled = false; scene.add(redM);
// eyes stay dark: multiply by colour would tint them, acceptable (very dark anyway)
let blues = [], reds = [];

function canvasSprite(text, bg = '#ff3048', w = 256, h = 96) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.renderOrder = 20;
  s.set = (txt) => { x.clearRect(0, 0, w, h); x.fillStyle = bg; x.beginPath(); x.roundRect(6, 10, w - 12, h - 20, 30); x.fill(); x.font = '800 58px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(txt, w / 2, h / 2 + 4); s.material.map.needsUpdate = true; };
  s.set(text); return s;
}
// ---------------------------------------------------------------- cannon
const cannon = new THREE.Group(); scene.add(cannon);
const cBody = new THREE.Mesh(bake([
  { geo: rounded(1.9, 0.7, 1.6, 0.25), color: '#2f86ff', pos: [0, 0.75, 0] },
  { geo: new THREE.SphereGeometry(0.75, 20, 14), color: '#5aa2ff', pos: [0, 1.25, 0.1] },
  ...[-1, 1].flatMap(sx => [{ geo: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), color: '#2b2f45', pos: [sx * 1.05, 0.42, -0.45], rot: [0, 0, Math.PI / 2] }, { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), color: '#2b2f45', pos: [sx * 1.05, 0.42, 0.55], rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12), color: '#c9d3e6', pos: [sx * 1.06, 0.42, -0.45], rot: [0, 0, Math.PI / 2] }, { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12), color: '#c9d3e6', pos: [sx * 1.06, 0.42, 0.55], rot: [0, 0, Math.PI / 2] }])]), vcMat({ roughness: 0.3 }));
cBody.castShadow = true; cannon.add(cBody);
const barrel = new THREE.Mesh(bake([{ geo: new THREE.CylinderGeometry(0.42, 0.5, 1.6, 20), color: '#3a8dff', rot: [Math.PI / 2, 0, 0] }, { geo: new THREE.TorusGeometry(0.46, 0.1, 8, 20), color: '#ffd23f', pos: [0, 0, -0.8] }]), vcMat({ roughness: 0.25 }));
barrel.position.set(0, 1.35, -0.6); barrel.rotation.x = -0.12; barrel.castShadow = true; cannon.add(barrel);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.75, 40), new THREE.MeshBasicMaterial({ color: '#3cff7a', transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.17; cannon.add(ring);
const flash = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0 })); flash.position.set(0, 1.4, -1.6); cannon.add(flash);
cannon.position.set(0, 0.15, 3.5);
const countTag = canvasSprite('0', '#2f6bff'); countTag.scale.set(2.2, 0.82, 1); countTag.position.set(0, 3.55, 0.3); cannon.add(countTag); let lastCount = -1;
// troop budget: a bar under the crowd counter. Red when nearly empty.
const ammoTag = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.renderOrder = 21;
  s.set = (left, max) => { const f = max > 0 ? left / max : 0, low = f < 0.25;
    x.clearRect(0, 0, 256, 72); x.fillStyle = 'rgba(20,24,48,.82)'; x.beginPath(); x.roundRect(4, 6, 248, 60, 26); x.fill();
    x.fillStyle = low ? '#ff3b4e' : '#3cc8ff'; if (f > 0) { x.beginPath(); x.roundRect(10, 12, Math.max(28, 236 * f), 48, 22); x.fill(); }
    x.font = '800 44px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(left > 0 ? '🪖 ' + left : 'NO TROOPS', 128, 39); s.material.map.needsUpdate = true; };
  s.scale.set(2.9, 0.82, 1); s.position.set(0, 2.6, 0.3); cannon.add(s); return s; })();

// ---------------------------------------------------------------- fortress (enemy base) + boss
const fort = new THREE.Group(); scene.add(fort);
const fortBody = new THREE.Mesh(bake([
  { geo: rounded(8.4, 4.2, 4, 0.3), color: '#e8394d', pos: [0, 2.1, 0] },
  { geo: rounded(2.4, 1.0, 0.3, 0.1), color: '#4a1018', pos: [0, 0.9, 2.05] },
  ...[-3.6, -1.8, 0, 1.8, 3.6].map(x => ({ geo: rounded(1.0, 0.9, 1.0, 0.12), color: '#ff5266', pos: [x, 4.6, 1.4] })),
  ...[-1, 1].flatMap(sx => [{ geo: new THREE.CylinderGeometry(1.25, 1.4, 6.4, 18), color: '#d92f43', pos: [sx * 4.4, 3.2, 0.4] }, { geo: new THREE.ConeGeometry(1.6, 2.2, 18), color: '#fff1f1', pos: [sx * 4.4, 7.5, 0.4] },
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), color: '#555', pos: [sx * 4.4, 9.3, 0.4] }, { geo: new THREE.BoxGeometry(0.9, 0.55, 0.04), color: '#ffd23f', pos: [sx * 4.4 + 0.45, 9.9, 0.4] }])]), vcMat({ roughness: 0.45 }));
fortBody.castShadow = fortBody.receiveShadow = true; fort.add(fortBody);
const fortHP = canvasSprite('100'); fortHP.scale.set(5, 1.9, 1); fortHP.position.set(0, 6.4, 2); fort.add(fortHP);
fort.position.set(0, 0, BASEZ - 1);
const bossGeo = bake([{ geo: new THREE.CapsuleGeometry(0.9, 1.0, 6, 16), color: '#ffcf33', pos: [0, 1.6, 0] }, { geo: new THREE.SphereGeometry(0.7, 16, 12), color: '#ffcf33', pos: [0, 3.1, 0] },
  { geo: new THREE.CapsuleGeometry(0.42, 1.0, 4, 10), color: '#ff3048', pos: [-1.25, 2.0, 0], rot: [0, 0, 0.35] }, { geo: new THREE.CapsuleGeometry(0.42, 1.0, 4, 10), color: '#ff3048', pos: [1.25, 2.0, 0], rot: [0, 0, -0.35] },
  { geo: new THREE.SphereGeometry(0.55, 12, 10), color: '#ff3048', pos: [-1.45, 1.2, 0] }, { geo: new THREE.SphereGeometry(0.55, 12, 10), color: '#ff3048', pos: [1.45, 1.2, 0] },
  { geo: new THREE.CapsuleGeometry(0.35, 0.6, 4, 10), color: '#ff3048', pos: [-0.45, 0.45, 0] }, { geo: new THREE.CapsuleGeometry(0.35, 0.6, 4, 10), color: '#ff3048', pos: [0.45, 0.45, 0] },
  { geo: new THREE.SphereGeometry(0.15, 8, 6), color: '#1b1b2f', pos: [-0.25, 3.2, -0.62] }, { geo: new THREE.SphereGeometry(0.15, 8, 6), color: '#1b1b2f', pos: [0.25, 3.2, -0.62] },
  { geo: new THREE.BoxGeometry(0.5, 0.12, 0.05), color: '#1b1b2f', pos: [-0.25, 3.45, -0.63], rot: [0, 0, -0.35] }, { geo: new THREE.BoxGeometry(0.5, 0.12, 0.05), color: '#1b1b2f', pos: [0.25, 3.45, -0.63], rot: [0, 0, 0.35] }]);
const boss = new THREE.Mesh(bossGeo, vcMat({ roughness: 0.35 })); boss.castShadow = true; boss.rotation.y = Math.PI; scene.add(boss);
const bossHP = canvasSprite('150', '#7a1020'); bossHP.scale.set(3, 1.12, 1); scene.add(bossHP);

// ---------------------------------------------------------------- gates
const gateGroup = new THREE.Group(); scene.add(gateGroup);
function gateTex(label, bad = false) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bad ? 'rgba(255,70,80,0.6)' : 'rgba(70,140,255,0.55)'; x.fillRect(0, 0, 256, 128); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 120);
  x.font = '800 86px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(10,30,90,.35)'; x.strokeText(label, 128, 70); x.fillStyle = '#fff'; x.fillText(label, 128, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let gates = [];
function makeGate(mult, cx, w, z, move) {
  const g = new THREE.Group(); g.position.set(cx, 0, z);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.5), new THREE.MeshBasicMaterial({ map: gateTex(mult < 1 ? '÷' + Math.round(1 / mult) : 'x' + mult, mult < 1), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  panel.position.y = 1.0; panel.rotation.x = -0.25; g.add(panel);
  const pm = glossy(mult < 1 ? '#ff4b5a' : '#4b8dff');
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(rounded(0.22, 1.9, 0.22, 0.08), pm); p.position.set(sx * w / 2, 0.95, 0); p.castShadow = true; g.add(p); }
  const bar = new THREE.Mesh(rounded(w + 0.2, 0.18, 0.22, 0.08), pm); bar.position.y = 1.85; g.add(bar);
  gateGroup.add(g);
  return { g, mult, cx, w, z, move, bit: 1 << gates.length, ph: Math.random() * 6, pulse: 0 };
}

// ---------------------------------------------------------------- crushers (from level 4): spiked rollers that sweep the lane and eat troops
const crushGeo = bake([{ geo: new THREE.CylinderGeometry(0.42, 0.42, 2.4, 16), color: '#3b3f57', rot: [0, 0, Math.PI / 2] },
  ...Array.from({ length: 18 }, (_, i) => { const a = (i % 6) / 6 * Math.PI * 2, xx = -1.0 + Math.floor(i / 6) * 1.0; return { geo: new THREE.ConeGeometry(0.16, 0.42, 6), color: '#ff3048', pos: [xx, Math.cos(a) * 0.55, Math.sin(a) * 0.55], rot: [a, 0, 0] }; }),
  ...[-1, 1].map(sx => ({ geo: new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), color: '#ffd23f', pos: [sx * 1.22, 0, 0], rot: [0, 0, Math.PI / 2] }))]);
const crushGroup = new THREE.Group(); scene.add(crushGroup);
let crushers = [];
// each one patrols the centre and one side, so the far side stays clear for a player who looks
function makeCrusher(z, sp, ph, cc) { const m = new THREE.Mesh(crushGeo, vcMat({ roughness: 0.4 })); m.castShadow = true; m.scale.setScalar(1.15); m.position.set(0, 0.7, z); crushGroup.add(m); return { m, z, x: cc, sp, ph, cc, amp: 2.3, spin: 0 }; }

// ---------------------------------------------------------------- level
let baseHP = 100, baseMax = 100, bossOn = false, bossHPv = 0, bossMax = 0, bossZ = 0, waveT = 0, fireT = 0, elapsed = 0, aimX = 0, firing = false, volley = 0, botOn = false, killed = 0, rnd = rng(1);
let ammo = 0, ammoMax = 0, shots = 0, tipOn = false;
// troop budget per level, from the level itself: what a good aimer needs (fitted on QA runs: a base for the walk to
// the fort, the fort's HP over the best column's gate multiplier, and the bigger waves of later levels) times a margin.
// Levels 1-2 get 3× (the hook), 3-4 a 15 % margin, then 8 %, and every third level (5, 8, 11…) 5 % under it: the
// crowd still in flight has to finish the fort. Holding the centre through the red gates needs 3-8× more, so it runs dry.
function troops() {
  const need = 46 + 0.76 * (baseHP + bossMax * 0.5) / colValue(bestColumn()) + 8.2 * level;
  return Math.round(need * (level < 3 ? 3 : level < 5 ? 1.15 : level % 3 === 2 ? 0.95 : 1.08));
}
function buildLevel() {
  rnd = rng(level * 7717 + 3); fk = F.k(); AD.round(); rescued = false; aimG = aimB = 0; aimT = 0;
  gateGroup.clear(); gates = []; blues = []; reds = []; crushGroup.clear(); crushers = [];
  const rows = [-10, -18, -26];
  if (level < 3) for (const z of rows) {   // levels 1-2: blue gates only, the quick first wins
    if (rnd() < 0.55) { const w = 3.6 + rnd() * 1.4, cx = (rnd() - 0.5) * (2 * W - w); gates.push(makeGate(rnd() < 0.6 ? 2 : 3, cx, w, z, false)); }
    else { gates.push(makeGate(2, -W / 2, W - 0.3, z, false)); gates.push(makeGate(rnd() < 0.5 ? 3 : 4, W / 2, W - 0.3, z, false)); if (rnd() < 0.5) { const a = gates[gates.length - 1], b = gates[gates.length - 2]; [a.cx, b.cx] = [b.cx, a.cx]; a.g.position.x = a.cx; b.g.position.x = b.cx; } }
  } else {
    // from level 3 there is always one good side, red ÷2 gates sit in the middle or on the other side, and crushers
    // patrol the middle. Holding the centre halves the crowd again and again; steering to the good side pays.
    // the layout is re-rolled until its best column multiplies ×12-×36, so levels don't swing from trivial to brutal
    const s = rnd() < 0.5 ? -1 : 1, off = W - 1.6, gw = 3.0, D = 1.2;   // D: where the two-halves row splits, past the centre on the good side
    for (let tries = 0; tries < 12; tries++) {
    gateGroup.clear(); gates = [];
    rows.forEach((z, ri) => {
      const pat = rnd(), hi = rnd() < 0.35 ? 4 : 3, lo = 2;
      if (pat < 0.45) {   // three lanes: good | wide ÷2 | good (one side bigger)
        gates.push(makeGate(hi, s * off, gw, z, false)); gates.push(makeGate(0.5, 0, 3.8, z, false)); gates.push(makeGate(lo, -s * off, gw, z, false));
      } else if (pat < 0.85 || ri === 0) {   // two halves: big blue on the good side, a wider ÷2 that covers the centre
        gates.push(makeGate(hi, s * (W + D) / 2, W - D - 0.15, z, false)); gates.push(makeGate(0.5, -s * (W - D) / 2, W + D - 0.15, z, false));
      } else {   // one blue gate sliding across: catch it if you can
        gates.push(makeGate(lo, 0, 3.2, z, true));
      }
    });
    let bv = 0; for (let x = -W + 1.1; x <= W - 1.1; x += 0.3) bv = Math.max(bv, colValue(x));
    if (bv >= 12 && bv <= 36) break;
    }
    // crushers: one from level 4 (rows 1-2), a second from level 7 (rows 2-3). They patrol the middle and the bad side;
    // from level 8 the second may patrol the good side instead, so you time your stream around it
    if (level >= 4) crushers.push(makeCrusher(-14, 0.85 + Math.min(level, 12) * 0.03, rnd() * 6, -s * 1.3));
    if (level >= 7) crushers.push(makeCrusher(-22, 0.75 + Math.min(level, 12) * 0.03, rnd() * 6, (level >= 8 && rnd() < 0.4 ? s : -s) * 1.3));
  }
  // from level 3 the fort and the waves grow faster: gates multiply your crowd, so a linear ramp was never a threat
  const lv = Math.max(0, level - 2);
  baseMax = baseHP = Math.round(45 + level * 22 + Math.pow(level, 1.4) * 4 + lv * 40 + Math.pow(lv, 1.5) * 10);
  bossOn = level % 4 === 0; bossMax = bossHPv = bossOn ? 80 + level * 20 : 0; bossZ = BASEZ + 4;
  boss.visible = bossHP.visible = bossOn; boss.scale.setScalar(1);
  fort.visible = true; fort.scale.set(1, 1, 1); fortHP.visible = true; fortHP.set(String(baseHP));
  collapse = 0; botAim = 0; botT = 1.2; waveT = 1.5; fireT = 0; volley = 0; elapsed = 0; aimX = 0; killed = 0; cannon.position.x = 0;
  ammoMax = ammo = troops(); shots = 0; ammoTag.set(ammo, ammoMax);
  ui.levels(level); ui.progress(0); ui.score('');
  const tip = bossOn ? 'BOSS LEVEL!' : level === 3 ? 'Red gates halve your crowd · drag to aim' : level === 4 ? 'Dodge the crusher!' : level === 7 ? 'Two crushers now!' : '';
  ui.sub(tip); tipOn = !!tip;   // cleared 3.5 s into play (step)
}

// ---------------------------------------------------------------- input
input({
  onDown: () => { botOn = false; inAt = elapsed; if (state === 'play') firing = true; },
  onMove: (dx) => { inAt = elapsed; if (state === 'play') aimX = clamp(aimX + dx * 0.03, -W + 1.1, W - 1.1); },
  onUp: (e, st) => { firing = false; if (state === 'play' && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12) { volley = 1.2; aimX = clamp(aimX + (e.clientX < innerWidth / 2 ? -1.6 : 1.6), -W + 1.1, W - 1.1); } },   // tap = a 1.2 s volley + a step toward that side
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; firing = false; }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; }
  else if (w === 'lose') { score = 0; buildLevel(); state = 'play'; }
});

// ---------------------------------------------------------------- sim
const GRID = 1.2, hash = new Map();
const key = (x, z) => (Math.floor(x / GRID) + 64) * 4096 + Math.floor(z / GRID) + 2048;
function spawnBlue(x, z, passed = 0) { if (blues.length >= MAXU) return; blues.push({ x, z, vx: (Math.random() - 0.5) * 3.2, passed, t: Math.random() * 6, born: 0, sp: 5.4 + Math.random() * 1.6, w: Math.random() * 6 }); }
function spawnRed(x, z) { if (reds.length >= MAXU) return; reds.push({ x, z, vx: 0, t: Math.random() * 6 }); }
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function poof(x, z, color, n = 3) { burst(scene, new THREE.Vector3(x, 0.6, z), color, n, { speed: 0.08, up: 0.08, size: 0.6, life: 0.7 }); }
let poofBudget = 0, recoil = 0, shake = 0;
function step(sec) {
  elapsed += sec;
  if (tipOn && elapsed > 3.5) { tipOn = false; if (ammo > 0) ui.sub(''); }
  // fire
  if (volley > 0) volley -= sec;
  if ((firing || volley > 0) && ammo > 0) { fireT -= sec; while (fireT <= 0 && ammo > 0) { fireT += 1 / 9; ammo--; shots++; spawnBlue(cannon.position.x + (Math.random() - 0.5) * 0.4, 0.6); recoil = 1; if (Math.random() < 0.5) tone(700 + Math.random() * 80, 0.03, 'triangle', 0.035, 0.7); }
    ammoTag.set(ammo, ammoMax); if (ammo === 0) { ui.sub('OUT OF TROOPS!'); tone(180, 0.15, 'square', 0.05, 0.6); } }
  // enemy waves from the fortress door (stop once it's destroyed)
  const ak = level < 3 ? Math.min(fk, AD.k(fk)) : AD.k(fk);   // flow.js between runs × in-round adaptation, clamped to ±25 %; never harder on the levels 1-2 hook
  if (baseHP > 0) { waveT -= sec; if (waveT <= 0) { const n = Math.round((5 + Math.min(30, level * 2) + Math.min(8, Math.max(0, level - 2))) * ak) + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) spawnRed((Math.random() - 0.5) * 3.4, BASEZ + 2 + Math.random() * 2.5); waveT = Math.max(1.4, (3.6 - level * 0.12) / ak); } }
  // gates move
  for (const g of gates) { if (g.move) { g.cx = Math.sin(elapsed * 0.9 + g.ph) * (W - g.w / 2 - 0.2); g.g.position.x = g.cx; } g.pulse = Math.max(0, g.pulse - sec * 4); g.g.scale.setScalar(1 + g.pulse * 0.08); }
  // move blues
    for (const u of blues) {
    const pz = u.z; u.z -= u.sp * sec; u.x += (u.vx + Math.sin(u.t * 2 + u.w) * 0.6) * sec; u.vx *= 0.985; u.t += sec;
    if (Math.abs(u.x) > W - 0.3) { u.x = Math.sign(u.x) * (W - 0.3); u.vx *= -0.5; }
    for (const g of gates) if (pz > g.z && u.z <= g.z && !(u.passed & g.bit) && Math.abs(u.x - g.cx) < g.w / 2) {
      u.passed |= g.bit; g.pulse = 1;
      if (g.mult < 1) { aimB++; if (Math.random() > g.mult) { u.gone = true; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ff3048', '#ffffff'], 2); } } continue; }   // ÷2 gate: about half don't make it
      aimG++;
      for (let k = 1; k < g.mult; k++) { spawnBlue(u.x + (Math.random() - 0.5) * 1.2, u.z - Math.random() * 0.9, u.passed); blues[blues.length - 1] && (blues[blues.length - 1].vx = (Math.random() - 0.5) * 5); }
    }
  }
  // crushers sweep across and eat every troop they roll over
  for (const c of crushers) { const nx = c.cc + Math.sin(elapsed * c.sp + c.ph) * c.amp; c.spin += (nx - c.x) * 2.2 + sec * 4; c.x = nx; c.m.position.x = nx; c.m.rotation.x = -c.spin;
    for (const u of blues) if (!u.gone && Math.abs(u.x - c.x) < 1.35 && Math.abs(u.z - c.z) < 0.6) { u.gone = true; aimB++; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ff3048', '#3b3f57']); } } }
  if (blues.some(u => u.gone)) blues = blues.filter(u => !u.gone);
  // adaptation signal, once a second while firing: mostly blue gates = good aim, more red losses than blue gains = struggling
  aimT += sec; if (aimT >= 1) { aimT = 0; if (aimG + aimB > 0) { if (aimG >= 2 * aimB) AD.good(1); else if (aimB > aimG) AD.bad(1); } aimG = aimB = 0; }
  // move reds toward the cannon
  const RSP = (3.6 + Math.min(level, 10) * 0.12) * ak;
  for (const e of reds) { e.z += RSP * sec; e.t += sec; e.x += (cannon.position.x - e.x) * 0.5 * sec; }   // they march on your cannon, wherever you aim
  // collisions via spatial hash: each red kills one blue and dies
  hash.clear();
  blues.forEach((u, i) => { const k = key(u.x, u.z); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(i); });
  const deadB = new Uint8Array(blues.length), deadR = new Uint8Array(reds.length);
  reds.forEach((e, j) => {
    const cx = Math.floor(e.x / GRID), cz = Math.floor(e.z / GRID);
    for (let dx = -1; dx <= 1 && !deadR[j]; dx++) for (let dz = -1; dz <= 1 && !deadR[j]; dz++) {
      const a = hash.get((cx + dx + 64) * 4096 + cz + dz + 2048); if (!a) continue;
      for (const i of a) { if (deadB[i]) continue; const u = blues[i]; if ((u.x - e.x) ** 2 + (u.z - e.z) ** 2 < 0.36) { deadB[i] = 1; deadR[j] = 1; killed++; if (poofBudget > 0) { poofBudget--; poof(e.x, e.z, ['#ff3048', '#2f86ff', '#ffffff']); } break; } }
    }
  });
  // boss
  if (bossOn && bossHPv > 0) {
    bossZ += 0.9 * sec;
    blues.forEach((u, i) => { if (!deadB[i] && Math.abs(u.z - bossZ) < 1.4 && Math.abs(u.x) < 2.2) { deadB[i] = 1; bossHPv--; bossHit = 1; if (poofBudget > 0) { poofBudget--; poof(u.x, u.z, ['#ffcf33', '#2f86ff']); } } });
    if (bossHPv <= 0) { bossHPv = 0; sfx.smash(); buzz([40, 30, 60]); ui.flash(0.7); ui.pop('BOSS DOWN!', '#ffcf33', 50, 26); shake = 1.2; score += 200;
      burst(scene, new THREE.Vector3(0, 2, bossZ), ['#ffcf33', '#ff3048', '#ffffff'], 50, { speed: 0.3, up: 0.25, size: 1.6 }); boss.visible = bossHP.visible = false; }
    if (bossZ > -0.5 && bossHPv > 0) return lose('CRUSHED!', 'The brute reached your cannon');
  }
  // blues hitting the fortress
  blues.forEach((u, i) => { if (!deadB[i] && u.z < BASEZ + 2.2) { deadB[i] = 1; if (baseHP > 0 && (!bossOn || bossHPv <= 0 || Math.abs(u.x) > 2.5)) { baseHP--; score++; fortHit = 1; if (poofBudget > 0) { poofBudget--; poof(u.x, BASEZ + 2.2, ['#ffd23f', '#ff3048']); } } } });
  blues = blues.filter((_, i) => !deadB[i]);
  reds = reds.filter((_, j) => !deadR[j]);
  // rescue: the mob is at the door, the player has been aiming well → one shockwave clears it (shares the one-a-round rescue)
  if (!rescued && reds.some(e => e.z > -1.5) && AD.sensible() && AD.rescue()) { rescued = true; let n = 0; for (const e of reds) if (e.z > -7) { e.dead = 1; n++; if (n < 12) poof(e.x, e.z, ['#7dffb2', '#ffffff', '#ff3048']); } reds = reds.filter(e => !e.dead); shake = 0.8; ui.pop('SHOCKWAVE!', '#7dffb2', 36, 30); tone(220, 0.25, 'sawtooth', 0.06, 0.4); buzz([30, 20, 30]); }
  // reds reaching the cannon = lose
  for (const e of reds) if (e.z > 1.2) return lose('OVERRUN!', ammo > 0 ? 'The red mob reached your cannon' : 'Out of troops: the red mob reached your cannon');
  if (ammo <= 0 && blues.length === 0 && baseHP > 0) {
    // rescue: once a round, only for a player who has been aiming well, and only when the fort is nearly down
    if (!rescued && baseHP <= baseMax * 0.3 && AD.sensible() && AD.rescue()) { rescued = true; ammo = Math.max(10, Math.round(ammoMax * 0.12)); ammoTag.set(ammo, ammoMax); ui.sub(''); ui.pop('REINFORCEMENTS!', '#7dffb2', 36, 30); tone(880, 0.12, 'triangle', 0.05, 0.8); }
    else return lose('OUT OF TROOPS!', `The fort held with ${baseHP} left · steer through blue gates, dodge red`);
  }
  fortHP.set(String(Math.max(0, baseHP))); if (bossOn) bossHP.set(String(bossHPv));
  if (baseHP <= 0) win();
}
let bossHit = 0, fortHit = 0, botT = 0, botAim = 0, botSloppy = false;
// the demo/QA bot aims like a good player: the column whose gates multiply the most (where moving gates will be when
// the crowd gets there) and that the crushers don't patrol, keeping its column unless another is clearly better.
function colValue(x) {
  let v = 1;
  for (const g of gates) { if (g.move) { const p = Math.min(1, (g.w - 1) / (2 * W)); v *= 1 + (g.mult - 1) * p; } else if (Math.abs(x - g.cx) < g.w / 2 - 0.5) v *= g.mult; }
  for (const c of crushers) if (Math.abs(x - c.cc) < c.amp + 1.6) v *= 0.6;
  return v;
}
function bestColumn() {
  let best = botAim, bv = colValue(botAim) * 1.2;   // stick to the current column unless another is clearly better
  for (let x = -W + 1.1; x <= W - 1.1 + 1e-6; x += 0.3) { const v = colValue(x); if (v > bv) { bv = v; best = x; } }
  return best;
}
function lose(t, line) { if (state !== 'play') return; state = 'lost'; AD.bad(2); ui.sub(''); F.level(false, 1 - Math.max(0, baseHP) / baseMax); firing = false; sfx.fail(); buzz([60, 40, 80]); ui.flash(0.6); shake = 1; burst(scene, cannon.position.clone().setY(1), ['#2f86ff', '#ffffff', '#555'], 30, { speed: 0.25, up: 0.2 }); ui.lose(t, line); }
function win() {
  if (state !== 'play') return;
  state = 'won'; AD.good(2); ui.sub(''); F.level(true); WB.submit(1); firing = false; score += 100 + level * 20; best = Math.max(best, score); save.set('best', best);
  sfx.smash(); setTimeout(() => sfx.win(), 200); buzz([40, 30, 80]); ui.flash(0.8); shake = 1.5;
  for (let i = 0; i < 4; i++) setTimeout(() => burst(scene, new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 3, BASEZ), ['#e8394d', '#ff5266', '#fff1f1', '#ffd23f'], 30, { speed: 0.35, up: 0.3, size: 2 }), i * 120);
  confetti(scene, new THREE.Vector3(0, 6, BASEZ + 4), 120); collapse = 1; fortHP.visible = false;
  ui.pop('FORTRESS DOWN!', '#ffd23f', 44, 24); ui.win(level, `${killed} enemies stopped`);
}
let collapse = 0;

// ---------------------------------------------------------------- render
function drawCrowd(mesh, arr, t, dir) {
  let n = 0;
  for (const u of arr) {
    const bob = Math.abs(Math.sin(u.t * 14)) * 0.12, sw = Math.sin(u.t * 14) * 0.18;
    tmpP.set(u.x, 0.15 + bob, u.z); tmpQ.setFromAxisAngle(UP, dir).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sw));
    tmpS.setScalar(1.3 * (u.born !== undefined ? Math.min(1, (u.born += 0.08)) : 1));
    tmpM.compose(tmpP, tmpQ, tmpS); mesh.setMatrixAt(n++, tmpM);
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
}
const camPos = new THREE.Vector3(0, 13, 12); let fpsN = 0, fpsT = 0, fps = 0;
loop((dt, t) => {
  fpsN++; if (t - fpsT > 1) { fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; }
  const sec = Math.min(dt / 60, 1 / 30);
  poofBudget = 3;
  if (state === 'play') {
    if (botOn) { firing = true; inAt = elapsed; botT -= sec; if (botT <= 0) { botT = botSloppy ? 2.5 : 1; botAim = botSloppy && Math.random() < 0.2 ? (Math.random() * 2 - 1) * (W - 1.1) : bestColumn(); } aimX = lerp(aimX, clamp(botAim + Math.sin(t * (botSloppy ? 1.3 : 2.2)) * (botSloppy ? 1.4 : 0.35), -W + 1.1, W - 1.1), botSloppy ? 0.04 : 0.12); }
    AD.tick(elapsed - inAt < 6);
    step(sec);
    ui.progress(1 - baseHP / baseMax); if (blues.length !== lastCount) { lastCount = blues.length; countTag.set(String(blues.length)); }
  } else if (state === 'won' || state === 'lost') { // let the crowd keep running for a moment after the end
    for (const u of blues) { u.z -= 4 * sec; u.t += sec; } for (const e of reds) { e.t += sec; }
  }
  cannon.position.x = lerp(cannon.position.x, aimX, 0.35);
  recoil = Math.max(0, recoil - sec * 10); barrel.position.z = -0.6 + recoil * 0.25; cBody.scale.set(1 + recoil * 0.04, 1 - recoil * 0.05, 1 + recoil * 0.04);
  flash.material.opacity = (firing || volley > 0) && state === 'play' ? recoil * 0.9 : 0; ring.material.opacity = 0.55 + Math.sin(t * 6) * 0.25;
  drawCrowd(blueM, blues, t, 0); drawCrowd(redM, reds, t, Math.PI);
  // fortress shake / collapse
  fortHit = Math.max(0, fortHit - sec * 8); fort.position.x = (Math.random() - 0.5) * fortHit * 0.25;
  if (collapse > 0) { collapse = Math.min(2, collapse + sec * 1.4); fort.scale.set(1 + (collapse - 1) * 0.15, Math.max(0.02, 2 - collapse), 1 + (collapse - 1) * 0.15); }
  if (bossOn && boss.visible) { bossHit = Math.max(0, bossHit - sec * 6); boss.position.set(Math.sin(t * 3) * 0.15, Math.abs(Math.sin(t * 3)) * 0.2, bossZ); boss.scale.setScalar(1.25 + bossHit * 0.08); bossHP.position.set(0, 5.4, bossZ); }
  // camera: high behind the cannon, looking up the lane (portrait-friendly)
  const want = new THREE.Vector3(cannon.position.x * 0.25, 18.5, 14);
  camPos.lerp(want, 0.08);
  camera.position.copy(camPos); if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.9; }
  camera.lookAt(camPos.x * 0.6, 0, -15);
  followLight(new THREE.Vector3(0, 0, -18));
});

buildLevel();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get fps() { return Math.round(fps); },
  get dbg() { return { blues: blues.length, reds: reds.length, baseHP, bossHPv, ammo, shots }; },
  get adapt() { return { level: +AD.level.toFixed(2), rescues: AD.rescues }; },
  bot(sloppy) { if (state === 'play') { botOn = true; botSloppy = !!sloppy; } },   // sloppy: QA's "average aiming kid" (slow to react, wide wobble, 1 in 5 picks a random column)
};

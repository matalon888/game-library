// Sky Evolve — original game. Sling your plane off the ramp, fly through power gates, evolve from paper plane to jet, smash the target.
import { bake, vcMat } from './merge.js';
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
const WB = board({ game: 'sky-evolve', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.25 }, mode: 'sum' });
const save = store('skyevolve');
let level = save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';
const F = flow('skyevolve');
const { scene, camera, renderer, sun, hemi, followLight } = createStage({ fov: 55, shadowSize: 26 });
sun.shadow.camera.far = 120; sun.intensity = 1.9; hemi.intensity = 1.1; hemi.groundColor.set('#d8f0c0');
document.body.style.setProperty('--bg1', '#62c3ff'); document.body.style.setProperty('--bg2', '#ffe7c2'); document.body.style.setProperty('--ui', '#ff8c42');
scene.fog = new THREE.Fog('#ffe9cf', 70, 210);
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
{ const p = sky.geometry.attributes.position, c = [], a = new THREE.Color('#ffe9cf'), b = new THREE.Color('#4fb4ff'), k = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const y = Math.max(0, p.getY(i) / 400); k.copy(a).lerp(b, Math.pow(y, 0.45)); c.push(k.r, k.g, k.b); }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
scene.add(sky);
const ui = createUI({ title: 'SKY<br>EVOLVE', hint: 'Hold, pull back & release', hand: '👇' });
ui.levels(level);
const WID = 7.5, ALT = 9;

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const grassTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#8fd16a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { x.fillStyle = ['#9bd973', '#83c85f', '#a6dd7c', '#b8e08a'][i % 4]; x.fillRect((i * 97) % 256 - 30, (i * 57) % 256 - 30, 90 + (i * 13) % 50, 70 + (i * 29) % 60); }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(30, 30);
const winTex = (base, glass) => canvasTex(64, 128, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 5 === 0 ? '#e9fbff' : glass; x.fillRect(4 + c * 15, 6 + r * 15, 10, 10); }
});
const BTEX = [winTex('#6aa9e8', '#bfe3ff'), winTex('#f2e2c6', '#7fb0d8'), winTex('#e98e74', '#ffe6c9'), winTex('#9fd3c7', '#e6fff8')];
BTEX.forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });

// ---------------------------------------------------------------- world
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const level0 = new THREE.Group(); scene.add(level0);
const roadMat = mat('#6b6f7a'), dashMat = mat('#ffffff');

// low houses (instanced): body + roof
const houseGeo = new THREE.BoxGeometry(1, 1, 1); houseGeo.translate(0, 0.5, 0);
const roofGeo = new THREE.ConeGeometry(0.78, 0.6, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 1.3, 0);
const MAXH = 420;
const houses = new THREE.InstancedMesh(houseGeo, mat('#fff3e0'), MAXH); houses.castShadow = houses.receiveShadow = true; scene.add(houses);
const roofs = new THREE.InstancedMesh(roofGeo, mat('#ffffff'), MAXH); roofs.castShadow = true; scene.add(roofs);
const treeGeo = bake([{ geo: new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), color: '#9a6b3f', pos: [0, 0.4, 0] }, { geo: new THREE.IcosahedronGeometry(0.75, 0), color: '#4cae4f', pos: [0, 1.25, 0] }, { geo: new THREE.IcosahedronGeometry(0.5, 0), color: '#5fc35a', pos: [0.2, 1.75, 0.1] }]);
const trees = new THREE.InstancedMesh(treeGeo, vcMat({ flatShading: true }), 600); trees.castShadow = true; scene.add(trees);
// towers (obstacles), 4 skins
const towerMeshes = BTEX.map(t => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), 40); m.castShadow = m.receiveShadow = true; scene.add(m); return m; });
const capGeo = new THREE.BoxGeometry(1.08, 0.5, 1.08); capGeo.translate(0, 0.25, 0);
const towerCaps = new THREE.InstancedMesh(capGeo, mat('#ffffff'), 160); towerCaps.castShadow = true; scene.add(towerCaps);

// ---------------------------------------------------------------- planes (4 evolution tiers)
const GEO = { sph: new THREE.SphereGeometry(1, 20, 14), cyl: new THREE.CylinderGeometry(1, 1, 1, 18), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 18), cap: new THREE.CapsuleGeometry(1, 1, 6, 16) };
function tri(a, b, c) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3)); g.computeVertexNormals(); return g; }
const TIERS = [
  { name: 'PAPER PLANE', speed: 22, burn: 5.5, mult: 1, scale: 1.0 },
  { name: 'PROPELLER', speed: 26, burn: 5.0, mult: 2, scale: 1.0 },
  { name: 'AIRLINER', speed: 30, burn: 4.6, mult: 3, scale: 1.0 },
  { name: 'FIGHTER JET', speed: 35, burn: 4.2, mult: 5, scale: 1.0 },
];
function makePlane(tier) {
  const g = new THREE.Group(); let prop = null, P = [];
  if (tier === 0) {     // folded paper dart
    P = [{ geo: tri([0, 0.05, -1.5], [-1.15, 0.12, 0.9], [0, 0.05, 0.9]), color: '#ffffff' }, { geo: tri([0, 0.05, -1.5], [0, 0.05, 0.9], [1.15, 0.12, 0.9]), color: '#f4f8ff' },
      { geo: tri([0, 0.05, -1.5], [0, 0.05, 0.9], [0, -0.45, 0.9]), color: '#d8e6ff' }, { geo: tri([0, 0.06, -1.2], [-0.45, 0.1, 0.9], [0, 0.07, 0.9]), color: '#bcd4ff' }];
  } else if (tier === 1) {   // cream & orange prop plane
    P = [{ geo: GEO.cap, color: '#ffe0b5', rot: [Math.PI / 2, 0, 0], scl: [0.38, 1.4, 0.38] }, { geo: GEO.box, color: '#ff8c42', pos: [0, 0, -0.2], scl: [4.2, 0.12, 0.85] },
      { geo: GEO.box, color: '#ff8c42', pos: [0, 0.1, 1.15], scl: [1.6, 0.08, 0.45] }, { geo: GEO.box, color: '#ff8c42', pos: [0, 0.45, 1.2], scl: [0.08, 0.7, 0.45] },
      { geo: GEO.sph, color: '#3a4a6b', pos: [0, 0.32, -0.35], scl: [0.26, 0.22, 0.4] }, { geo: GEO.cone, color: '#ff5d5d', pos: [0, 0, -1.2], rot: [-Math.PI / 2, 0, 0], scl: [0.22, 0.3, 0.22] },
      { geo: GEO.box, color: '#ffffff', pos: [-1.5, 0.07, -0.2], scl: [0.6, 0.13, 0.86] }, { geo: GEO.box, color: '#ffffff', pos: [1.5, 0.07, -0.2], scl: [0.6, 0.13, 0.86] }];
    prop = new THREE.Mesh(bake([{ geo: GEO.box, color: '#444', scl: [1.5, 0.12, 0.04] }, { geo: GEO.box, color: '#444', scl: [0.12, 1.5, 0.04] }]), vcMat()); prop.position.z = -1.38;
  } else if (tier === 2) {   // white airliner with blue belly
    P = [{ geo: GEO.cap, color: '#ffffff', rot: [Math.PI / 2, 0, 0], scl: [0.42, 3.0, 0.42] }, { geo: GEO.cap, color: '#2f6bd8', rot: [Math.PI / 2, 0, 0], pos: [0, -0.1, 0], scl: [0.4, 2.95, 0.36] },
      { geo: GEO.box, color: '#f1f4fa', pos: [-1.45, -0.1, 0.15], rot: [0, -0.5, 0], scl: [2.7, 0.1, 0.8] }, { geo: GEO.box, color: '#f1f4fa', pos: [1.45, -0.1, 0.15], rot: [0, 0.5, 0], scl: [2.7, 0.1, 0.8] },
      { geo: GEO.cyl, color: '#9aa7bf', pos: [-1.2, -0.38, -0.1], rot: [Math.PI / 2, 0, 0], scl: [0.22, 0.75, 0.22] }, { geo: GEO.cyl, color: '#9aa7bf', pos: [1.2, -0.38, -0.1], rot: [Math.PI / 2, 0, 0], scl: [0.22, 0.75, 0.22] },
      { geo: GEO.box, color: '#2f6bd8', pos: [0, 0.75, 2.05], rot: [0.5, 0, 0], scl: [0.1, 1.2, 0.8] }, { geo: GEO.box, color: '#f1f4fa', pos: [0, 0.1, 2.1], rot: [0, 0, 0], scl: [1.8, 0.08, 0.5] },
      { geo: GEO.sph, color: '#26314a', pos: [0, 0.2, -1.9], scl: [0.3, 0.15, 0.25] }];
  } else {                   // fighter jet
    P = [{ geo: GEO.cap, color: '#8aa0b8', rot: [Math.PI / 2, 0, 0], scl: [0.36, 2.4, 0.36] }, { geo: GEO.cone, color: '#5f7690', pos: [0, 0, -2.05], rot: [-Math.PI / 2, 0, 0], scl: [0.3, 0.9, 0.3] },
      { geo: tri([0, 0, -1.2], [-2.0, 0, 1.1], [0, 0, 1.3]), color: '#7f95ad' }, { geo: tri([0, 0, -1.2], [0, 0, 1.3], [2.0, 0, 1.1]), color: '#7f95ad' },
      { geo: GEO.box, color: '#5f7690', pos: [-0.38, 0.55, 1.2], rot: [0.4, 0, -0.25], scl: [0.06, 0.8, 0.6] }, { geo: GEO.box, color: '#5f7690', pos: [0.38, 0.55, 1.2], rot: [0.4, 0, 0.25], scl: [0.06, 0.8, 0.6] },
      { geo: GEO.sph, color: '#ffcf4a', pos: [0, 0.3, -0.8], scl: [0.24, 0.2, 0.55] }, { geo: GEO.cyl, color: '#3b4656', pos: [0, 0, 1.55], rot: [Math.PI / 2, 0, 0], scl: [0.28, 0.4, 0.28] }];
    prop = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.4, 12), new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.85 })); prop.rotation.x = -Math.PI / 2; prop.position.z = 2.35; prop.flame = true;
  }
  const body = new THREE.Mesh(bake(P), vcMat({ roughness: 0.35, side: tier === 0 ? THREE.DoubleSide : THREE.FrontSide })); body.castShadow = true; g.add(body);
  if (prop) g.add(prop); g.prop = prop; return g;
}
const PLANES = TIERS.map((_, i) => makePlane(i));
const plane = new THREE.Group(); scene.add(plane); const PS = 1.35;
let tier = 0; PLANES.forEach((p, i) => { p.visible = i === 0; plane.add(p); });
function setTier(t) { tier = t; PLANES.forEach((p, i) => p.visible = i === t); }

// wingtip trails (ribbons)
const TRAILN = 46;
function makeTrail() {
  const g = new THREE.BufferGeometry(); const pos = new Float32Array(TRAILN * 2 * 3), al = new Float32Array(TRAILN * 2), idx = [];
  for (let i = 0; i < TRAILN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  for (let i = 0; i < TRAILN; i++) { al[i * 2] = al[i * 2 + 1] = 1 - i / TRAILN; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(al, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float alpha; varying float va; void main(){ va = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float va; void main(){ gl_FragColor = vec4(1.0,1.0,1.0, va * 0.75); }' });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
  return { mesh, hist: [] };
}
const trails = [makeTrail(), makeTrail()];
function updateTrails(on) {
  const span = [1.2, 2.1, 2.9, 2.0][tier];
  trails.forEach((tr, k) => {
    const p = new THREE.Vector3((k ? 1 : -1) * span, 0, 0.6).applyMatrix4(plane.matrixWorld);
    if (on) tr.hist.unshift(p); else if (tr.hist.length) tr.hist.pop();
    if (tr.hist.length > TRAILN) tr.hist.length = TRAILN;
    const a = tr.mesh.geometry.attributes.position.array;
    for (let i = 0; i < TRAILN; i++) { const q = tr.hist[Math.min(i, tr.hist.length - 1)] || p, w = 0.09 * (1 - i / TRAILN) + 0.02; a.set([q.x, q.y - w, q.z, q.x, q.y + w, q.z], i * 6); }
    tr.mesh.geometry.attributes.position.needsUpdate = true; tr.mesh.visible = tr.hist.length > 1;
  });
}

// ---------------------------------------------------------------- launch ramp (wooden deck + elastic)
const ramp = new THREE.Group(); scene.add(ramp);
const deck = new THREE.Mesh(bake(Array.from({ length: 14 }, (_, i) => ({ geo: GEO.box, color: i % 2 ? '#c98d55' : '#d89c62', pos: [0, 0, -i * 1.05], scl: [3.6, 0.25, 1.0] }))), vcMat({ roughness: 0.8 }));
deck.position.set(0, 0.5, 4); deck.castShadow = deck.receiveShadow = true; ramp.add(deck);
const posts = [];
for (const sx of [-1, 1]) { const p = new THREE.Mesh(GEO.cyl, mat('#9a6b3f')); p.scale.set(0.16, 2.2, 0.16); p.position.set(sx * 1.9, 1.5, -3.5); p.castShadow = true; ramp.add(p); posts.push(p);
  const fl = new THREE.Mesh(GEO.box, mat(sx < 0 ? '#ff5d5d' : '#ffffff')); fl.scale.set(0.05, 0.4, 0.6); fl.position.set(sx * 1.9, 2.5, -3.2); ramp.add(fl); }
const bandMat = new THREE.MeshStandardMaterial({ color: '#ff5d5d', roughness: 0.5 });
const bands = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), bandMat); ramp.add(m); return m; });
function setBand(i, a, b) { const m = bands[i], d = b.clone().sub(a); m.position.copy(a).addScaledVector(d, 0.5); m.scale.y = d.length(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); }

// ---------------------------------------------------------------- gates + target
const gateGroup = new THREE.Group(); scene.add(gateGroup);
function gateTex(label, color, aspect) {
  return canvasTex(Math.round(160 * aspect), 160, (x, w, h) => {
    x.fillStyle = color; x.globalAlpha = 0.55; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
    let fs = 96; x.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`; const mw = x.measureText(label).width; if (mw > w * 0.86) { fs = Math.floor(fs * w * 0.86 / mw); x.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`; } x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 12; x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeText(label, w / 2, h / 2 + 6); x.fillStyle = '#fff'; x.fillText(label, w / 2, h / 2 + 4);
  });
}
const GOOD = '#2f8cff', BAD = '#ff3b5c', EVO = '#ffb703';
function makeGate(op, x0, x1, z) {
  const w = x1 - x0, cx = (x0 + x1) / 2, h = 5.2, color = op.t === 'evo' ? EVO : (op.t === '+' || op.t === 'x') ? GOOD : BAD;
  const label = op.t === 'evo' ? '▲EVOLVE' : op.t === 'x' ? 'x' + op.v : op.t === '÷' ? '÷' + op.v : op.t + op.v;
  const g = new THREE.Group(); g.position.set(cx, ALT, z);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, h - 0.4), new THREE.MeshBasicMaterial({ map: gateTex(label, color, (w - 0.4) / (h - 0.4)), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  g.add(panel);
  const fm = glossy(color);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(GEO.box, fm); p.scale.set(0.35, h + ALT, 0.35); p.position.set(sx * w / 2, -(ALT) / 2, 0); p.castShadow = true; g.add(p); }
  const top = new THREE.Mesh(GEO.box, fm); top.scale.set(w + 0.35, 0.35, 0.35); top.position.y = h / 2; g.add(top);
  gateGroup.add(g); return { g, op, x0, x1, z, used: false, panel };
}
let rows = [], towers = [], D = 300, target = null, blocks = null, blockData = [], targetHP = 100;
function applyOp(p, op) { return op.t === '+' ? p + op.v : op.t === '-' ? p - op.v : op.t === 'x' ? p * op.v : op.t === '÷' ? p / op.v : p; }

function buildLevel() {
  const r = rng(level * 4241 + 7), fk = F.k();
  gateGroup.clear(); rows = []; towers = [];
  D = Math.min(900, 250 + (level - 1) * 45);
  // course rows
  let z = -55, i = 0; const evoAt = [0.22, 0.5, 0.78].map(f => -D * f);
  let evoN = 0;
  while (z > -D + 40) {
    const isGate = i % 3 !== 1;
    if (isGate) {
      const split = (r() - 0.5) * 3, pair = [];
      if (evoN < 3 && z < evoAt[evoN]) { pair.push({ t: 'evo' }); evoN++; pair.push(r() < 0.5 ? { t: '+', v: 10 + Math.floor(r() * 3) * 5 } : { t: '-', v: 10 + Math.floor(r() * 3) * 5 }); }
      else {
        const good = r() < 0.5 ? { t: 'x', v: 2 } : { t: '+', v: 15 + Math.floor(r() * 4) * 5 };
        const bad = r() < 0.6 - Math.min(0.3, level * 0.03) ? { t: '+', v: 5 + Math.floor(r() * 2) * 5 } : (r() < 0.5 ? { t: '-', v: 10 + Math.floor(r() * 3) * 5 + level * 2 } : { t: '÷', v: 2 });
        pair.push(good, bad);
      }
      if (r() < 0.5) pair.reverse();
      rows.push({ z, type: 'gates', gates: [makeGate(pair[0], -WID, split, z), makeGate(pair[1], split, WID, z)] });
    } else {
      // obstacle row: towers leaving one or two gaps
      const nT = level < 2 ? 1 : 1 + Math.floor(r() * Math.min(3, (1 + level / 3) * fk));
      const row = { z, type: 'towers', list: [] };
      const lanes = [-5.2, -1.7, 1.7, 5.2]; const pick = lanes.sort(() => r() - 0.5).slice(0, nT);
      for (const x of pick) { const t = { x, z, w: 2.8 + r() * 1.2, d: 2.8 + r() * 1.5, h: ALT + 6 + r() * 14, skin: Math.floor(r() * 4) }; towers.push(t); row.list.push(t); }
      rows.push(row);
    }
    z -= 26 + r() * 7; i++;
  }
  // instanced towers
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), cnt = [0, 0, 0, 0]; let cc = 0;
  for (const t of towers) { m.compose(new THREE.Vector3(t.x, 0, t.z), q.identity(), new THREE.Vector3(t.w, t.h, t.d)); towerMeshes[t.skin].setMatrixAt(cnt[t.skin]++, m);
    m.compose(new THREE.Vector3(t.x, t.h, t.z), q, new THREE.Vector3(t.w, 1, t.d)); towerCaps.setMatrixAt(cc++, m); }
  towerMeshes.forEach((tm, k) => { tm.count = cnt[k]; tm.instanceMatrix.needsUpdate = true; tm.material.map.repeat.set(1, 3); });
  towerCaps.count = cc; towerCaps.instanceMatrix.needsUpdate = true;
  // scenery: houses + trees on both sides, a road down the middle
  let hc = 0, tc = 0; const col = new THREE.Color();
  for (let zz = 10; zz > -D - 60 && hc < MAXH; zz -= 4) {
    for (const side of [-1, 1]) {
      for (let hh = 0; hh < 2; hh++) if (r() < 0.6 && hc < MAXH) { const x = side * (WID + 2.5 + hh * 12 + r() * 14), s = 2 + r() * 2.5;
        m.compose(new THREE.Vector3(x, 0, zz + r() * 3), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(r() * 4) * Math.PI / 2), new THREE.Vector3(s, s * (0.8 + r() * 0.6), s)); houses.setMatrixAt(hc, m); roofs.setMatrixAt(hc, m);
        roofs.setColorAt(hc, col.set(['#e86a5a', '#5a8de8', '#7a5a4a', '#e8a33a', '#58b06e'][Math.floor(r() * 5)])); hc++; }
      for (let k = 0; k < 2 && tc < 600; k++) { const x = side * (3 + r() * 45); if (Math.abs(x) < 4) continue; const s = 1.2 + r() * 1.6;
        m.compose(new THREE.Vector3(x, 0, zz + r() * 4), q.identity(), new THREE.Vector3(s, s, s)); trees.setMatrixAt(tc++, m); }
    }
  }
  houses.count = roofs.count = hc; trees.count = tc;
  for (const im of [houses, roofs, trees]) im.instanceMatrix.needsUpdate = true; roofs.instanceColor.needsUpdate = true;
  level0.clear();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4, D + 120), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -D / 2 + 20); road.receiveShadow = true; level0.add(road);
  for (let zz = 0; zz > -D - 40; zz -= 6) { const d = new THREE.Mesh(GEO.box, dashMat); d.scale.set(0.2, 0.02, 2.4); d.position.set(0, 0.04, zz); level0.add(d); if (level0.children.length > 70) break; }
  // the target: a stacked block wall with a bullseye
  targetHP = Math.round((40 + level * 36 + Math.pow(level, 1.6) * 8) * fk);
  buildTarget(-D);
  // reset plane
  smashT = 0; slowmo = 1; plane.visible = true;
  setTier(0); power = 0; launched = false; pull = 0; crashed = false; vx = 0;
  plane.position.set(0, 1.3, 2.5); plane.rotation.set(0, 0, 0);
  trails.forEach(t => t.hist = []);
  ui.levels(level); ui.progress(0); ui.score(''); ui.sub(best ? 'BEST ' + best : '');
  camPos.set(0, 5, 11); camLook.set(0, 2, -10);
}
const BW = 10, BH = 8, BS = 1.4;
const blockGeo = new THREE.BoxGeometry(BS * 0.96, BS * 0.96, BS * 0.96);
function buildTarget(z) {
  if (blocks) scene.remove(blocks);
  blocks = new THREE.InstancedMesh(blockGeo, mat('#ffffff'), BW * BH); blocks.castShadow = true; blocks.receiveShadow = true; scene.add(blocks);
  blockData = []; const col = new THREE.Color(), m = new THREE.Matrix4();
  for (let i = 0; i < BW; i++) for (let j = 0; j < BH; j++) {
    const x = (i - (BW - 1) / 2) * BS, y = 0.7 + j * BS, d = Math.hypot(x, y - ALT) / BS;
    const ring = Math.floor(d / 1.2);
    col.set(['#ffd23f', '#ff3b5c', '#ffffff', '#ff3b5c', '#ffffff', '#2f8cff'][Math.min(5, ring)]);
    const b = { p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), live: false, d };
    blockData.push(b); m.makeTranslation(b.p.x, b.p.y, b.p.z); blocks.setMatrixAt(blockData.length - 1, m); blocks.setColorAt(blockData.length - 1, col);
  }
  blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true;
  if (target) scene.remove(target);
  target = new THREE.Group(); target.position.set(0, BH * BS + 2.4, z); scene.add(target);
  const hp = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#ff3b5c'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 40); x.fill(); x.font = '800 60px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('♥ ' + targetHP, w / 2, h / 2 + 4); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: hp, depthTest: false })); s.scale.set(4.4, 1.65, 1); target.add(s);
}

// ---------------------------------------------------------------- state
let power = 0, launched = false, pull = 0, crashed = false, vx = 0, holding = false, slowmo = 1, smashT = 0, steerX = 0, botOn = false, pullPeak = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
input({
  onDown: () => { botOn = false; if (state === 'play' && !launched) holding = true; },
  onMove: (dx) => { if (state === 'play' && launched) steerX += dx * 0.05; },
  onUp: () => { if (state === 'play' && !launched && holding) release(); holding = false; },
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; }
  else if (w === 'lose') { score = 0; buildLevel(); state = 'play'; }
});
function release() {
  launched = true; power = Math.round(25 + pull * 35); pullPeak = pull;
  const tag = pull > 0.9 ? 'PERFECT LAUNCH!' : pull > 0.6 ? 'GREAT!' : 'GO!';
  ui.pop(tag, pull > 0.9 ? '#ffd23f' : '#fff', 42, 26); tone(300, 0.25, 'sawtooth', 0.08, 3); buzz(25);
  launchV = 30 + pull * 14; pull = 0;
}
let launchV = 0;
function evolve() {
  if (tier >= 3) { power += 25; ui.pop('+25 MAX!', '#ffd23f', 40, 26); return; }
  setTier(tier + 1); ui.pop('EVOLVED!', '#ff8c42', 52, 22); ui.flash(0.7); sfx.win(); buzz([20, 30, 40]);
  confetti(scene, plane.position.clone(), 50); evoPunch = 1;
}
let evoPunch = 0; const gatePops = [];
function crash(why) {
  crashed = true; state = 'lost'; F.level(false, clamp(-plane.position.z / D, 0, 1) * 0.5); sfx.smash(); sfx.fail(); buzz([60, 40, 80]); ui.flash(0.7); shake = 1.2;
  burst(scene, plane.position, ['#ff8c42', '#ffd23f', '#555', '#ffffff'], 40, { speed: 0.3, up: 0.2, size: 1.6 });
  plane.visible = false;
  ui.lose(why, `${Math.round(clamp(-plane.position.z / D, 0, 1) * 100)}% of the way`);
}
function smash() {
  const dmg = Math.round(power * TIERS[tier].mult); smashT = 1; slowmo = 0.25; shake = 1.5;
  const frac = clamp(dmg / targetHP, 0, 1);
  // blast blocks: those nearest the impact point go first
  const order = blockData.map((b, i) => [Math.hypot(b.p.x - plane.position.x, b.p.y - plane.position.y), i]).sort((a, b) => a[0] - b[0]);
  const nb = Math.max(4, Math.round(order.length * (frac >= 1 ? 1 : frac * 0.85)));
  for (let k = 0; k < nb; k++) { const b = blockData[order[k][1]]; b.live = true; const dir = b.p.clone().sub(plane.position).normalize();
    b.v.set(dir.x * 9 + (Math.random() - 0.5) * 5, 3 + dir.y * 4 + Math.random() * 7, -6 - Math.random() * 12).multiplyScalar(0.7 + frac * 0.5); b.w.set(Math.random() * 8, Math.random() * 8, Math.random() * 8); }
  burst(scene, plane.position, ['#ffd23f', '#ff3b5c', '#ffffff'], 40, { speed: 0.35, up: 0.2, size: 1.8 });
  sfx.smash(); buzz([40, 30, 80]); ui.flash(0.8);
  score += dmg; ui.score(dmg);
  if (dmg >= targetHP) {
    state = 'won'; F.level(true); WB.submit(1); best = Math.max(best, score); save.set('best', best);
    setTimeout(() => { sfx.win(); confetti(scene, new THREE.Vector3(0, ALT + 3, -D + 4), 120); }, 250);
    ui.pop('SMASHED!', '#ff3b5c', 60, 22); ui.win(level, `${dmg} damage · ${TIERS[tier].name.toLowerCase()}`);
  } else {
    state = 'lost'; F.level(false, 0.5 + frac * 0.5); ui.pop(`${Math.round(frac * 100)}%`, '#fff', 54, 24); ui.lose('SO CLOSE!', `${dmg} / ${targetHP} damage — evolve more!`);
  }
  plane.visible = false; target.visible = false;
}

// ---------------------------------------------------------------- bot
function botAim() {
  // nearest row ahead that matters
  const pz = plane.position.z;
  for (const row of rows) {
    if (row.z > pz + 3.5 || (row.type === "gates" && row.done)) continue;
    if (row.z < pz - 70) break;
    if (row.type === 'gates') {
      let bestG = null, bestV = -1e9; for (const g of row.gates) { const v = g.op.t === 'evo' ? (tier < 3 ? 1e6 : 0) + 25 : applyOp(power, g.op); if (v > bestV) { bestV = v; bestG = g; } }
      return (bestG.x0 + bestG.x1) / 2;
    } else {
      // pick the free x closest to us
      let bx = 0, bd = 1e9;
      for (let x = -WID + 1; x <= WID - 1; x += 0.5) { if (row.list.some(t => Math.abs(x - t.x) < t.w / 2 + 1.6)) continue; const d = Math.abs(x - plane.position.x); if (d < bd) { bd = d; bx = x; } }
      return bx;
    }
  }
  return 0;
}

// ---------------------------------------------------------------- loop
let shake = 0, fpsN = 0, fpsT = 0, fps = 0, t0 = 0;
loop((dt0, t) => {
  fpsN++; if (t - fpsT > 1) { fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; }
  const dt = dt0 * slowmo, sec = dt / 60;
  slowmo = lerp(slowmo, 1, 0.04 * dt0);
  if (state === 'play' && !launched) {
    if (holding) pull = Math.min(1, pull + sec * 1.3);
    else pull = Math.max(0, pull - sec * 3);
    plane.position.set(0, 1.3, 2.5 + pull * 4.5); plane.rotation.x = -pull * 0.12;
    ui.progress(0); if (holding) ui.score(Math.round(25 + pull * 35));
  }
  if (state === 'play' && launched && !crashed) {
    const T = TIERS[tier];
    const pz = plane.position.z;
    // forward motion: launch impulse decays to cruise speed
    launchV = lerp(launchV, T.speed, 0.02 * dt);
    plane.position.z -= launchV * sec;
    // altitude: climb to cruise while powered, glide down when empty
    const wantY = power > 0 ? ALT : -2;
    plane.position.y = lerp(plane.position.y, wantY, (power > 0 ? 0.04 : 0.012) * dt);
    if (botOn) { steerX += (botAim() - plane.position.x) * 0.18 * dt; }
    const nx = clamp(plane.position.x + steerX, -WID + 0.8, WID - 0.8); vx = lerp(vx, (nx - plane.position.x) / Math.max(sec, 1e-4), 0.2); plane.position.x = nx; steerX = 0;
    plane.rotation.set(-0.05 + (power > 0 ? 0 : 0.15), 0, clamp(-vx * 0.045, -0.9, 0.9));
    power = Math.max(0, power - T.burn * sec);
    // gates
    for (const row of rows) {
      if (row.type !== 'gates' || row.done) continue;
      if (pz > row.z && plane.position.z <= row.z) {
        row.done = true;
        const g = row.gates.find(g => plane.position.x >= g.x0 && plane.position.x <= g.x1) || row.gates[0];
        g.used = true; g.panel.material.opacity = 0.25; g.g.scale.set(1.15, 1.15, 1.15); gatePops.push(g.g);
        if (g.op.t === 'evo') evolve();
        else { const before = power; power = Math.max(0, applyOp(power, g.op)); const good = power >= before;
          ui.pop((good ? '+' : '') + Math.round(power - before), good ? '#ffffff' : '#ff3b5c', 44, 30);
          if (good) { sfx.pick(4); buzz(12); burst(scene, plane.position, ['#2f8cff', '#ffffff'], 14, { speed: 0.18, up: 0.05, size: 0.8 }); }
          else { tone(180, 0.2, 'square', 0.1, 0.6); buzz([30, 20, 30]); burst(scene, plane.position, ['#ff3b5c', '#ffffff'], 14, { speed: 0.18, up: 0.05, size: 0.8 }); shake = 0.4; } }
      }
    }
    // towers
    for (const tw of towers) {
      if (Math.abs(plane.position.z - tw.z) < tw.d / 2 + 0.8 && Math.abs(plane.position.x - tw.x) < tw.w / 2 + 0.9 && plane.position.y < tw.h + 0.4) { crash('CRASHED!'); break; }
    }
    if (!crashed && plane.position.y < 1.0) crash('OUT OF POWER');
    if (!crashed && plane.position.z <= -D + 1.2) smash();
    ui.progress(-plane.position.z / D); if (state === 'play') ui.score(Math.round(power));
    if (state === 'play') ui.sub(TIERS[tier].name);
  }
  // ramp bands
  const tail = launched ? new THREE.Vector3(0, 1.3, -3.5) : plane.position.clone().add(new THREE.Vector3(0, 0, 1.1));
  setBand(0, new THREE.Vector3(-1.9, 2.3, -3.5), tail); setBand(1, new THREE.Vector3(1.9, 2.3, -3.5), tail);
  // prop / flame
  for (const p of PLANES) if (p.prop) { if (p.prop.flame) { p.prop.scale.set(1, 1 + Math.sin(t * 40) * 0.25 + (power > 0 ? 0.3 : -0.6), 1); } else p.prop.rotation.z += 0.9 * dt0; }
  for (let i = gatePops.length - 1; i >= 0; i--) { const g = gatePops[i]; g.scale.multiplyScalar(0.97); if (g.scale.x < 1) { g.scale.setScalar(1); gatePops.splice(i, 1); } }
  evoPunch = Math.max(0, evoPunch - 0.04 * dt0); plane.scale.setScalar([1.35, 1.2, 0.95, 1.1][tier] * (1 + Math.sin(evoPunch * Math.PI) * 0.5));
  updateTrails(launched && !crashed && state === 'play');
  // flying blocks after a smash
  if (smashT > 0) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    blockData.forEach((b, i) => { if (!b.live) return; b.v.y -= 22 * sec; b.p.addScaledVector(b.v, sec); if (b.p.y < 0.6) { b.p.y = 0.6; b.v.multiplyScalar(0.5); b.v.y = Math.abs(b.v.y) * 0.4; }
      b.r.x += b.w.x * sec; b.r.y += b.w.y * sec; q.setFromEuler(b.r); m.compose(b.p, q, new THREE.Vector3(1, 1, 1)); blocks.setMatrixAt(i, m); });
    blocks.instanceMatrix.needsUpdate = true;
  }
  // camera: chase from behind & above
  const p = plane.position;
  let want, look;
  if (!launched) { want = new THREE.Vector3(0, 4.2 + pull * 0.6, p.z + 8.5 + pull * 1.5); look = new THREE.Vector3(0, 2.8, p.z - 14); }
  else if (smashT > 0) { want = new THREE.Vector3(11, ALT + 7, -D + 24); look = new THREE.Vector3(0, 3, -D - 8); }
  else { want = new THREE.Vector3(p.x * 0.7, p.y + 3.6, p.z + 8.2); look = new THREE.Vector3(p.x * 0.85, p.y - 0.6, p.z - 14); }
  camPos.lerp(want, 1 - Math.pow(0.9, dt0)); camLook.lerp(look, 1 - Math.pow(0.85, dt0));
  camera.position.copy(camPos); if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.9; }
  camera.lookAt(camLook); sky.position.copy(camera.position).setY(0);
  ground.position.set(0, 0, p.z - 60); grassTex.offset.set(0, -(p.z - 60) / 500 * 30);
  followLight(new THREE.Vector3(p.x, 0, p.z - 8));
});

buildLevel();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get fps() { return Math.round(fps); },
  get dbg() { return { z: plane.position.z, D, power, tier, launched, hp: targetHP }; },
  bot() {
    if (state !== 'play') return; botOn = true;
    if (!launched) { if (!holding) { holding = true; } else if (pull >= 0.97) { holding = false; release(); } }
  },
};

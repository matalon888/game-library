// Bubble Buns shooter: renders the jelly bubble field (glossy instanced jellies with tiny faces + colour-blind shape marks,
// glass bubbles with baby critters inside, sugar-cube blockers), the bunny cannon, the bouncing aim line, shots flying
// along their traced path, pops, drops, rescues and all the juice. Lives in a group attached to the camera.
// Root space: the window top is y ≈ 0, the launcher sits at LY0. The field group scrolls so the lowest row always keeps the
// same gap above the launcher (tall levels fill the whole board and slide down as you clear them).
import { THREE } from './kit/hc.js';
import { Grid, COLS, RH, W, XWALL, WIN, cellPos, nbrs, bestShot, launchYFor } from './grid.js';
import { COLORS, LIGHT, nextColor } from './levels.js';
import { faceAtlas, jellyTex, cushionTex, stripeTex, FACE_ROWS } from './art.js';

const PI = Math.PI, V3 = THREE.Vector3;
const SPEED = 30, MIN_A = 10 * PI / 180, MAX_A = 170 * PI / 180;
export const LY0 = launchYFor(WIN - 1);          // launcher y in root space (constant)
const NEXT_X = -2.35, NEXT_Y = LY0 - 0.55;
export const TOP_Y = 0.3;                         // window top (clip line) in root space
export const BOARD_H = TOP_Y - (LY0 - 2.0);        // window top to below the launcher

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function heartShape(s = 1) { const h = new THREE.Shape(); h.moveTo(0, -0.85 * s); h.bezierCurveTo(-1.25 * s, 0.05 * s, -0.65 * s, 1.05 * s, 0, 0.42 * s); h.bezierCurveTo(0.65 * s, 1.05 * s, 1.25 * s, 0.05 * s, 0, -0.85 * s); return h; }
function sparkShape(s = 1) { const h = new THREE.Shape(); for (let i = 0; i < 8; i++) { const a = i * PI / 4, r = i % 2 ? 0.28 * s : s; i ? h.lineTo(Math.cos(a) * r, Math.sin(a) * r) : h.moveTo(r, 0); } return h; }

export function createShooter({ group, P, snd, hooks, clip }) {
  const G = { grid: new Grid(), level: null, shots: 0, cur: null, nxt: null, state: 'idle', score: 0, rnd: Math.random, freed: 0, combo: 0, log: [], busy: false, aiming: false, aim: PI / 2, marks: true };
  const root = new THREE.Group(); group.add(root);
  const field = new THREE.Group(); root.add(field);
  const C = mats => { for (const m of [].concat(mats)) { m.clippingPlanes = [clip]; } return mats; };

  // ------------------------------------------------------------ frame: tufted lilac cushion + pink jelly rim
  const panH = TOP_Y - (LY0 - 1.75) + 0.5, panY = TOP_Y + 0.5 - panH / 2;
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W + 0.9, panH, 0.9)), new THREE.MeshBasicMaterial({ map: cushionTex(), transparent: true, opacity: 0.93, depthWrite: false, toneMapped: false }));
  { const uv = panel.geometry.attributes.uv, pos = panel.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + (W + 0.9) / 2) / (W + 0.9), (pos.getY(i) + panH / 2) / panH); }
  panel.position.set(0, panY, -0.75); panel.renderOrder = -2; root.add(panel);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: '#ff8cc6', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), emissive: '#ff4f9a', emissiveIntensity: 0.12 });
  { const outer = roundedRect(W + 1.5, panH + 0.6, 1.15), hole = roundedRect(W + 0.9, panH, 0.9); outer.holes.push(hole);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 4, curveSegments: 16 }), rimMat);
    rim.position.set(0, panY, -0.85); root.add(rim);
    // pearl studs along the rim
    const stud = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshPhysicalMaterial({ color: '#fff4fb', roughness: 0.2, clearcoat: 1, sheen: 1 }), 40); let k = 0; const m4 = new THREE.Matrix4();
    for (let i = 0; i < 20 && k < 40; i++) { const y = panY + panH / 2 - 0.6 - i * (panH - 1.2) / 19; for (const sx of [-1, 1]) { m4.makeTranslation(sx * (W / 2 + 0.6), y, -0.5); stud.setMatrixAt(k++, m4); } }
    stud.count = k; root.add(stud); }
  // candy ceiling bar (scrolls with the field; only seen when the top of the level is in view)
  const ceil = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, W + 0.1, 6, 20), C(new THREE.MeshPhysicalMaterial({ map: stripeTex('#ff7eb6', '#ffffff', 14), roughness: 0.25, clearcoat: 1 })));
  ceil.rotation.z = PI / 2; ceil.position.set(0, 0.12, -0.2); field.add(ceil);
  // danger-free hint line just above the launcher (where the field stops scrolling)
  const dl = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false }));
  dl.position.set(0, LY0 + 1.35, -0.5); root.add(dl);

  // ------------------------------------------------------------ jelly bubbles + faces + shine
  const N = 400;
  const bGeo = new THREE.SphereGeometry(0.5, 32, 22);
  const bMat = C(new THREE.MeshPhysicalMaterial({ map: jellyTex(), roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4, sheen: 0.7, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.3 }));
  bMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor.rgb * 0.22;\n#endif'); };
  const bubbles = new THREE.InstancedMesh(bGeo, bMat, N); bubbles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); bubbles.count = 0; bubbles.frustumCulled = false; field.add(bubbles);
  const shineMat = C(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
  const shine = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 10), shineMat, N); shine.count = 0; shine.frustumCulled = false; shine.renderOrder = 2; field.add(shine);
  const dotM = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 16), shineMat, N); dotM.count = 0; dotM.frustumCulled = false; dotM.renderOrder = 2; field.add(dotM);
  const atlas = { on: faceAtlas(true), off: faceAtlas(false) };
  const faceMat = C(new THREE.MeshBasicMaterial({ map: atlas.on, transparent: true, depthWrite: false, toneMapped: false }));
  faceMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv = vec2((vMapUv.x + mod(aCell, 6.0)) / 6.0, (vMapUv.y + (${FACE_ROWS - 1}.0 - floor(aCell / 6.0))) / ${FACE_ROWS}.0);`);
  };
  const faceGeo = new THREE.PlaneGeometry(1, 1); const aCell = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); faceGeo.setAttribute('aCell', aCell);
  const faces = new THREE.InstancedMesh(faceGeo, faceMat, N); faces.count = 0; faces.frustumCulled = false; faces.renderOrder = 3; field.add(faces);
  // sugar cubes (the kawaii library's smiling sugar cube) as blockers
  const cubes = new THREE.InstancedMesh(P.cube.geo, C(P.cube.mat.clone()), 90); cubes.count = 0; cubes.frustumCulled = false; field.add(cubes);
  // critter bubbles: glass shell, pale tinted back, coloured jelly ring, the 3D critter inside
  const shellGeo = new THREE.SphereGeometry(0.5, 32, 22), glassMat = C(new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, roughness: 0.1, depthWrite: false, envMapIntensity: 0.3 }));
  const discTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(54, 48, 6, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f2f2f2'); g.addColorStop(1, '#b8b8b8'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const backGeo = new THREE.CircleGeometry(0.47, 40);
  const backMats = LIGHT.map(c => C(new THREE.MeshBasicMaterial({ color: new THREE.Color(c), map: discTex, toneMapped: false })));
  const ringMats = COLORS.map(c => C(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, emissive: c, emissiveIntensity: 0.45 })));
  const ringGeo = new THREE.TorusGeometry(0.455, 0.07, 12, 44);
  const critMats = P.critters.map(p => C(p.mat.clone()));
  // special shots
  const bombMesh = new THREE.Mesh(P.bomb.geo, C(P.bomb.mat.clone())); bombMesh.visible = false; field.add(bombMesh);
  const rainbowMesh = new THREE.Mesh(P.rainbow.geo, C(P.rainbow.mat.clone())); rainbowMesh.visible = false; field.add(rainbowMesh);
  const wandMesh = new THREE.Mesh(P.wand.geo, C(P.wand.mat.clone())); wandMesh.visible = false; field.add(wandMesh);
  const beamFx = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1), C(new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }))); beamFx.visible = false; field.add(beamFx);

  // ------------------------------------------------------------ launcher: a bunny-eared jelly cannon with a candy barrel
  const L = new THREE.Group(); L.position.set(0, LY0, 0.2); root.add(L);
  const lilac = new THREE.MeshPhysicalMaterial({ color: '#c9a2ff', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.8, sheenColor: new THREE.Color('#ffffff'), emissive: '#8a5cff', emissiveIntensity: 0.1 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#fff7fb', roughness: 0.3, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color('#ffe0f0') });
  const pinkM = new THREE.MeshPhysicalMaterial({ color: '#ff9fcb', roughness: 0.25, clearcoat: 1, emissive: '#ff4f9a', emissiveIntensity: 0.15 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd76a', roughness: 0.22, metalness: 0.75, emissive: '#7a4a00', emissiveIntensity: 0.18 });
  const baseY = -0.35;   // the barrel pivots exactly at the logical launch point
  { const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 40, 24), lilac); body.scale.set(1.12, 0.72, 0.8); body.position.y = baseY; L.add(body);
    for (const sx of [-1, 1]) {   // bunny ears
      const ear = new THREE.Group(); ear.position.set(sx * 0.62, baseY + 0.42, -0.25); ear.rotation.z = -sx * 0.42; L.add(ear);
      const o = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 6, 16), white); o.position.y = 0.48; o.scale.z = 0.55; ear.add(o);
      const i = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.6, 6, 12), pinkM); i.position.set(0, 0.48, 0.07); i.scale.z = 0.4; ear.add(i);
    }
    // cannon face: the joy face from the atlas on a plane
    const fm = new THREE.MeshBasicMaterial({ map: atlas.off, transparent: true, depthWrite: false, toneMapped: false }); fm.map = atlas.off.clone(); fm.map.repeat.set(1 / 6, 1 / FACE_ROWS); fm.map.offset.set(4 / 6, 0); fm.map.needsUpdate = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), fm); face.position.set(0, baseY - 0.12, 0.82); face.renderOrder = 3; L.add(face);
    const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), pinkM); bowL.position.set(0.78, baseY + 0.22, 0.5); L.add(bowL); }
  const barrel = new THREE.Group(); barrel.position.y = baseY + 0.35; L.add(barrel);
  { const prof = [[0.0, -0.1], [0.52, -0.1], [0.64, 0.15], [0.58, 0.6], [0.5, 1.05], [0.6, 1.18], [0.55, 1.28], [0.44, 1.24]].map(([x, y]) => new THREE.Vector2(x, y));
    const stripes = new THREE.MeshPhysicalMaterial({ map: stripeTex('#ff4f9a', '#fff0f7', 5), roughness: 0.22, clearcoat: 1, emissive: '#ff2e7e', emissiveIntensity: 0.08, side: THREE.DoubleSide });
    const tube = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), stripes); barrel.add(tube);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.075, 10, 36), gold); lip.rotation.x = PI / 2; lip.position.y = 1.22; barrel.add(lip); }
  // next-bubble cup (tap to swap) with a little swap arrow
  const cup = new THREE.Group(); cup.position.set(NEXT_X, NEXT_Y - 0.42, 0.2); root.add(cup);
  { const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 28), lilac); cup.add(base); const rimC = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 32), gold); rimC.rotation.x = PI / 2; rimC.position.y = 0.11; cup.add(rimC); }

  // ------------------------------------------------------------ aim line (candy dots, stars at bounces) + ghost
  const DOTS = 80;
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.15, 16), C(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, depthWrite: false })), DOTS); dots.count = 0; dots.frustumCulled = false; dots.renderOrder = 6; field.add(dots);
  dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DOTS * 3), 3);
  const dotsBack = new THREE.InstancedMesh(new THREE.CircleGeometry(0.2, 16), C(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false })), DOTS); dotsBack.count = 0; dotsBack.frustumCulled = false; dotsBack.renderOrder = 4; field.add(dotsBack);
  const ghost = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), C(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }))); ghost.visible = false; ghost.renderOrder = 4; field.add(ghost);
  const ghostRing = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.52, 36), C(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false }))); ghostRing.renderOrder = 4; ghost.add(ghostRing);

  // ------------------------------------------------------------ particles: sparkle stars + hearts, shock rings
  const FX = (() => {
    const NP = 500, kinds = {};
    for (const [k, geo] of [['star', new THREE.ShapeGeometry(sparkShape(0.16))], ['heart', new THREE.ShapeGeometry(heartShape(0.13))]]) {
      const m = new THREE.InstancedMesh(geo, C(new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide })), NP); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3); m.count = 0; m.frustumCulled = false; m.renderOrder = 5; field.add(m);
      kinds[k] = { m, list: [] };
    }
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), Z = new V3(0, 0, 1);
    const rings = []; for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 36), C(new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false }))); r.visible = false; r.renderOrder = 5; field.add(r); rings.push({ r, t: 1 }); }
    return {
      spark(x, y, colors, n = 14, { speed = 5, up = 2, size = 1, life = 0.7, grav = 9, z = 0.7, kind = 'mix' } = {}) {
        for (let i = 0; i < n; i++) { const kk = kind === 'mix' ? (i % 3 === 0 ? 'heart' : 'star') : kind, K = kinds[kk]; if (K.list.length >= NP) continue;
          const a = Math.random() * PI * 2, sp = speed * (0.35 + Math.random() * 0.75);
          K.list.push({ p: new V3(x, y, z), v: new V3(Math.cos(a) * sp, Math.sin(a) * sp + up, 0), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, w: (Math.random() - 0.5) * 8, g: grav }); }
      },
      ring(x, y, color = '#fff', size = 1) { const R = rings.find(o => o.t >= 1) || rings[0]; R.t = 0; R.size = size; R.r.position.set(x, y, 0.75); R.r.material.color.set(color); R.r.visible = true; },
      update(dt) {
        for (const K of Object.values(kinds)) {
          let i = 0; const m = K.m;
          for (let k = K.list.length - 1; k >= 0; k--) { const p = K.list[k]; p.life -= dt; if (p.life <= 0) { K.list.splice(k, 1); continue; }
            p.v.y -= p.g * dt; p.v.multiplyScalar(1 - dt * 1.2); p.p.addScaledVector(p.v, dt); p.r += dt * p.w; const f = p.life / p.max;
            q.setFromAxisAngle(Z, p.r); s.setScalar(p.size * (0.3 + Math.min(1, f * 1.6))); tmp.compose(p.p, q, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); i++; }
          m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
        }
        for (const R of rings) { if (R.t >= 1) { R.r.visible = false; continue; } R.t = Math.min(1, R.t + dt * 2.6); const k = 1 - Math.pow(1 - R.t, 3); R.r.scale.setScalar(R.size * (0.8 + k * 1.6)); R.r.material.opacity = 0.85 * (1 - R.t); }
      },
    };
  })();

  // ------------------------------------------------------------ sprites
  let sprites = [];
  const critPool = [];
  function critterBubble(species) {
    let o = critPool.find(q => !q.used);
    if (!o) { o = { g: new THREE.Group(), back: new THREE.Mesh(backGeo, backMats[0]), shell: new THREE.Mesh(shellGeo, glassMat), ring: new THREE.Mesh(ringGeo, ringMats[0]), m: new THREE.Group(), used: false, species: -1 };
      o.g.add(o.back, o.m, o.shell, o.ring); o.back.position.z = -0.25; o.shell.renderOrder = 1; field.add(o.g); critPool.push(o); }
    o.used = true; o.g.visible = true; o.back.material = backMats[species]; o.ring.material = ringMats[species]; o.ring.visible = o.shell.visible = o.back.visible = true;
    if (o.species !== species) { o.m.clear(); const p = P.critters[species]; const mesh = new THREE.Mesh(p.geo, critMats[species]); mesh.scale.setScalar(0.84); mesh.position.set(0, -0.03, 0.12); o.m.add(mesh); o.species = species; }
    o.m.rotation.set(0, 0, 0); o.m.scale.setScalar(1); o.g.scale.setScalar(1); o.g.rotation.set(0, 0, 0);
    return o;
  }
  function spriteFor(v) {
    const p = cellPos(v.r, v.c);
    const sp = { x: p.x, y: p.y, ox: 0, oy: 0, vx: 0, vy: 0, s: 1, color: v.color, kind: v.stone ? 'stone' : v.critter >= 0 ? 'crit' : 'b', st: 'idle', t: 0, wob: Math.random() * 6, blink: 1 + Math.random() * 5, cell: v };
    if (sp.kind === 'crit') sp.crit = critterBubble(v.critter);
    v.sp = sp; sprites.push(sp); return sp;
  }
  const shotSp = { x: 0, y: 0, st: 'idle', flying: null };

  // ------------------------------------------------------------ scroll
  const scroll = { cur: 0, target: 0 };
  const targetScroll = () => LY0 - G.grid.launchY();
  const launchGY = () => LY0 - scroll.cur;           // launcher in field (grid) coords, as drawn now
  const settled = () => Math.abs(scroll.cur - scroll.target) < 0.02;

  // ------------------------------------------------------------ level lifecycle
  function clearAll() { sprites = []; for (const o of critPool) { o.used = false; o.g.visible = false; } }
  function start(level, rnd, boosts = {}) {
    clearAll(); G.level = level; G.grid = level.grid.clone(); G.rnd = rnd; G.shots = level.shots; G.score = 0; G.freed = 0; G.log = []; G.state = 'play'; G.busy = false; G.aiming = false; G.combo = 0; G.aim = PI / 2;
    scroll.target = targetScroll(); scroll.cur = scroll.target + 3.5;   // the field slides down into place
    for (const v of G.grid.cells()) { const sp = spriteFor(v); sp.s = 0; sp.t = -(Math.max(0, G.grid.maxRow() - v.r) * 0.03 + Math.random() * 0.08); sp.st = 'intro'; }
    G.cur = { color: nextColor(G.grid, rnd) }; G.nxt = { color: nextColor(G.grid, rnd) };
    if (boosts.rainbow) G.cur = { color: -1, rainbow: true };
    if (boosts.bomb) G.nxt = { color: -1, bomb: true };
    root.visible = true; hooks.shots(G.shots); hooks.score(0);
  }
  function hide() { root.visible = false; G.state = 'idle'; dots.count = dotsBack.count = 0; ghost.visible = false; }
  const critLeft = () => G.grid.crittersLeft();

  // ------------------------------------------------------------ aiming
  let path = null, dash = 0;
  function setAim(a) { G.aim = Math.max(MIN_A, Math.min(MAX_A, a)); }
  function aimFrom(x, y) { if (y < LY0 + 0.3) return false; setAim(Math.atan2(y - LY0, x)); return true; }   // root coords
  function computePath() {
    const y0 = G.grid.launchY();
    if (G.cur?.wand) { const len = (-0.2 - y0) / Math.max(0.15, Math.sin(G.aim)); const ex = Math.cos(G.aim) * len; path = { pts: [{ x: 0, y: y0 }, { x: Math.max(-XWALL, Math.min(XWALL, ex)), y: y0 + Math.sin(G.aim) * len }], cell: null }; return path; }
    path = G.grid.trace(0, y0, G.aim); return path;
  }
  const tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();
  function drawAim(dt) {
    if (!(G.aiming && G.state === 'play' && !G.busy)) { dots.count = dotsBack.count = 0; ghost.visible = false; return; }
    const pts = path.pts; dash = (dash + dt * 2.4) % 1;
    const col = new THREE.Color(G.cur.wand ? '#ffd23f' : G.cur.rainbow ? '#ff8ad0' : G.cur.bomb ? '#ff7a8a' : COLORS[G.cur.color]);
    const gap = 0.55; let n = 0, carry = dash * gap, total = 0;
    for (let i = 1; i < pts.length && n < DOTS; i++) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy); let d = carry;
      while (d < len && n < DOTS) { const k = d / len, s = Math.max(0.4, 1 - total / 45); const px = a.x + dx * k, py = a.y + dy * k;
        tmpM.makeScale(s, s, s); tmpM.setPosition(px, py, 0.62); dots.setMatrixAt(n, tmpM); dots.setColorAt(n, G.cur.rainbow ? tmpC.setHSL((total * 0.05 + dash * 0.1) % 1, 0.9, 0.62) : col);
        tmpM.setPosition(px, py, 0.6); dotsBack.setMatrixAt(n, tmpM); n++; d += gap; total += gap; }
      carry = d - len;
    }
    dots.count = dotsBack.count = n; dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true; dotsBack.instanceMatrix.needsUpdate = true;
    if (path.cell && !G.cur.wand) { const p = cellPos(path.cell[0], path.cell[1]); ghost.position.set(p.x, p.y, 0.55); ghost.visible = true; ghost.material.color.copy(col); ghostRing.material.color.copy(col).lerp(new THREE.Color('#ffffff'), 0.3); }
    else ghost.visible = false;
  }

  // ------------------------------------------------------------ firing
  let flight = null;
  function fire() {
    if (G.state !== 'play' || G.busy || G.shots <= 0 || !settled()) return false;
    computePath(); G.busy = true; G.aiming = false; dots.count = dotsBack.count = 0; ghost.visible = false;
    G.shots--; hooks.shots(G.shots); snd.shoot(); hooks.fired?.();
    const shot = G.cur; G.cur = G.nxt; G.nxt = { color: nextColor(G.grid, G.rnd) };
    if (G.cur.color >= 0 && !G.grid.colorsLeft().has(G.cur.color) && !special(G.cur)) G.cur = { color: nextColor(G.grid, G.rnd) };
    const pts = path.pts, segs = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); tot += l; }
    flight = { shot, pts, segs, tot, d: 0, cell: path.cell, bounces: 0 };
    barrelKick = 1; loadAnim = 1;
    return true;
  }
  const special = s => s && (s.bomb || s.rainbow || s.wand);
  function swap() {
    if (G.state !== 'play' || G.busy) return;
    if (special(G.cur) || special(G.nxt) && false) return;
    [G.cur, G.nxt] = [G.nxt, G.cur]; snd.swap(); swapAnim = 1;
  }
  function loadBooster(kind) {   // the current shot becomes a booster (the current colour moves to "next")
    if (G.state !== 'play' || G.busy) return false;
    if (special(G.cur)) return false;
    G.nxt = G.cur; G.cur = { color: -1, [kind]: true }; snd.magic(); swapAnim = 1; return true;
  }

  async function land(fl) {
    const shot = fl.shot;
    if (shot.wand) return wandStrike(fl);
    const [r, c] = fl.cell; snd.stick();
    let res;
    if (G.grid.get(r, c)) res = { popped: [], dropped: [] };
    else res = G.grid.resolve(r, c, shot.bomb ? { bomb: true } : shot.rainbow ? { rainbow: true } : { color: shot.color });
    if (res.placed) { const sp = spriteFor(res.placed); sp.x = fl.end.x; sp.y = fl.end.y; sp.st = 'snap'; sp.t = 0; const p = cellPos(r, c); sp.tx = p.x; sp.ty = p.y; }
    for (const [a, b] of nbrs(r, c)) { const v = G.grid.get(a, b); if (v?.sp) { const p = cellPos(a, b), q = cellPos(r, c), d = Math.hypot(p.x - q.x, p.y - q.y) || 1; v.sp.vx += (p.x - q.x) / d * 2.6; v.sp.vy += (p.y - q.y) / d * 2.6; } }
    if (shot.bomb) { snd.boom(); hooks.shake(0.8); FX.ring(fl.end.x, fl.end.y, '#ff9ac8', 2.6); FX.spark(fl.end.x, fl.end.y, ['#ff5fa2', '#ffd23f', '#ffffff', '#b47cff'], 44, { speed: 9, size: 1.6 }); }
    if (shot.rainbow) { snd.magic(); FX.spark(fl.end.x, fl.end.y, COLORS, 30, { speed: 7, size: 1.3 }); }
    await resolveFx(res, r, c);
  }
  async function wandStrike(fl) {
    const a = G.aim, dx = Math.cos(a), dy = Math.sin(a), y0 = G.grid.launchY();
    const hit = G.grid.cells().filter(v => { const p = cellPos(v.r, v.c), t = p.x * dx + (p.y - y0) * dy; if (t < 0) return false; return Math.hypot(p.x - dx * t, p.y - (y0 + dy * t)) < 0.78; });
    beamFx.visible = true; const len = (0 - y0) / Math.max(0.2, dy); beamFx.scale.set(1.3, len, 1); beamFx.position.set(dx * len / 2, y0 + dy * len / 2, 0.8); beamFx.rotation.z = a - PI / 2; beamFx.material.opacity = 0.95; beamT = 1;
    snd.boom(); snd.magic(); hooks.shake(0.6);
    for (const v of hit) G.grid.del(v.r, v.c);
    const res = { popped: hit, dropped: [] }; res.dropped = G.grid.floating(); for (const v of res.dropped) G.grid.del(v.r, v.c);
    for (let i = 0; i < 8; i++) { const t = i / 7 * len; FX.spark(dx * t, y0 + dy * t, ['#ffe066', '#ffffff', '#ff9ad0'], 5, { speed: 4, size: 1.2, kind: 'star' }); }
    await resolveFx(res, null, null);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function resolveFx(res, r, c) {
    const pop = res.popped, drop = res.dropped;
    G.log.push(pop.concat(drop).some(v => v.critter >= 0) ? 'c' : pop.length ? 'p' : 'm');
    if (pop.length) {
      const o = r == null ? { x: 0, y: G.grid.launchY() } : cellPos(r, c);
      const d2 = v => { const p = cellPos(v.r, v.c); return Math.hypot(p.x - o.x, p.y - o.y); };
      pop.sort((a, b) => d2(a) - d2(b));
      pop.forEach((v, k) => { if (v.sp) { v.sp.st = 'pop'; v.sp.t = -k * 0.045; v.sp.k = k; } });
      G.score += pop.length * 10;
    }
    if (drop.length) {
      G.combo++;
      for (const v of drop) if (v.sp) { v.sp.st = 'fall'; v.sp.vx = (Math.random() - 0.5) * 4; v.sp.vy = 2 + Math.random() * 3; v.sp.t = 0; }
      G.score += drop.length * 20 * Math.min(4, G.combo); drop.forEach((v, k) => snd.drop(k));
    } else if (pop.length) G.combo = Math.max(0, G.combo - 1); else G.combo = 0;
    const n = pop.length + drop.length;
    if (n >= 14) hooks.combo('Sugar rush!', 4); else if (n >= 9) hooks.combo('Kawaii!', 3); else if (drop.length >= 4) hooks.combo('Bun-tastic!', 2); else if (n >= 5) hooks.combo('Yay!', 1);
    if (n >= 5) joyT = 1.2;
    hooks.score(G.score);
    for (const v of pop.concat(drop).filter(v => v.critter >= 0)) rescue(v);
    await wait(pop.length ? 150 : 70);
    scroll.target = targetScroll();
    G.busy = false;
    if (!critLeft()) { G.state = 'clear'; await wait(Math.min(700, pop.length * 45 + 300)); return finish(true); }
    if (G.shots <= 0) {
      G.state = 'out'; const more = await hooks.outOfShots();
      if (more) { G.shots += more; G.state = 'play'; hooks.shots(G.shots); }
      else finish(false);
    }
    if (G.state === 'play' && G.grid.size && G.cur.color >= 0 && !special(G.cur) && !G.grid.colorsLeft().has(G.cur.color)) G.cur = { color: nextColor(G.grid, G.rnd) };
  }
  function rescue(v) {
    const sp = v.sp; if (!sp?.crit) return;
    G.freed++; G.score += 250; snd.rescue(G.freed);
    const o = sp.crit; o.shell.visible = false; o.ring.visible = false; o.back.visible = false;
    FX.spark(sp.x + sp.ox, sp.y + sp.oy, [COLORS[v.critter], '#ffffff', LIGHT[v.critter]], 26, { speed: 6, size: 1.3 }); FX.ring(sp.x, sp.y, '#ffffff', 1.5);
    sp.st = 'free'; sp.t = 0; sp.vx = (Math.random() - 0.5) * 2; sp.vy = 7;
    const w = new V3(sp.x, sp.y, 0.5); field.localToWorld(w);
    hooks.freed(v.critter, w, critLeft());
  }
  async function finish(won) {
    if (G.state === 'won' || G.state === 'lost') return;
    if (won) {
      hooks.allFreed();
      await wait(500);
      const rest = G.grid.cells(); for (const v of rest) { G.grid.del(v.r, v.c); if (v.sp) { v.sp.st = 'fall'; v.sp.vx = (Math.random() - 0.5) * 5; v.sp.vy = 3 + Math.random() * 4; } }
      G.score += rest.length * 10; hooks.score(G.score);
      await wait(600);
      const bonus = G.shots, shown = Math.min(bonus, 14), y0 = launchGY();
      for (let i = 0; i < shown; i++) { const x = (Math.random() - 0.5) * (W - 2), y = y0 + 3 + Math.random() * 8; FX.spark(x, y, [COLORS[i % 6], '#ffffff'], 16, { speed: 6, size: 1.3 }); FX.ring(x, y, COLORS[i % 6], 1.2); snd.pop(i % 8, 0);
        G.score += Math.round(100 * bonus / shown); hooks.score(G.score); hooks.shots(Math.round(bonus - (i + 1) * bonus / shown)); await wait(55); }
      G.state = 'won'; const frac = G.shots / G.level.shots, stars = frac >= 0.3 ? 3 : frac >= 0.12 ? 2 : 1;
      await wait(350); hooks.done(true, stars, G.score);
    } else { G.state = 'lost'; hooks.done(false, 0, G.score); }
  }

  // ------------------------------------------------------------ frame
  let barrelKick = 0, swapAnim = 0, loadAnim = 0, beamT = 0, joyT = 0, T = 0;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), pos = new V3(), q0 = new THREE.Quaternion();
  const C6 = COLORS.map(c => new THREE.Color(c)), WHITE = new THREE.Color('#ffffff'), qShine = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), 0.7);
  function update(dt) {
    if (!root.visible) return;
    T += dt;
    faceMat.map = G.marks ? atlas.on : atlas.off;
    // scroll
    scroll.cur += (scroll.target - scroll.cur) * Math.min(1, dt * 5); if (Math.abs(scroll.target - scroll.cur) < 0.005) scroll.cur = scroll.target;
    field.position.y = scroll.cur;
    const ly = launchGY();
    // flight
    if (flight) {
      flight.d += SPEED * dt;
      let d = flight.d, i = 0; while (i < flight.segs.length && d > flight.segs[i]) { d -= flight.segs[i]; i++; }
      if (i > flight.bounces && i < flight.segs.length) { flight.bounces = i; snd.bounce(); FX.spark(flight.pts[i].x, flight.pts[i].y, ['#ffffff', '#ffe3f3'], 6, { speed: 3, size: 0.9, life: 0.4, kind: 'star' }); }
      if (i >= flight.segs.length) { const fl = flight; flight = null; fl.end = fl.pts[fl.pts.length - 1]; shotSp.st = 'hidden'; land(fl).then(() => { shotSp.st = 'idle'; }); }
      else { const a = flight.pts[i], b = flight.pts[i + 1], k = d / flight.segs[i]; shotSp.x = a.x + (b.x - a.x) * k; shotSp.y = a.y + (b.y - a.y) * k; shotSp.flying = flight.shot; }
    }
    if (!flight && shotSp.st !== 'hidden') { shotSp.x = Math.cos(G.aim) * 1.45; shotSp.y = ly + baseY + 0.35 + Math.sin(G.aim) * 1.45; shotSp.flying = null; }
    // launcher
    barrel.rotation.z = G.aim - PI / 2; barrelKick = Math.max(0, barrelKick - dt * 5); barrel.scale.set(1 + barrelKick * 0.14, 1 - barrelKick * 0.2, 1 + barrelKick * 0.14);
    L.scale.set(1 + barrelKick * 0.05, 1 - barrelKick * 0.06 + Math.sin(T * 3) * 0.012, 1);
    swapAnim = Math.max(0, swapAnim - dt * 4); loadAnim = Math.max(0, loadAnim - dt * 3); joyT = Math.max(0, joyT - dt);
    if (beamT > 0) { beamT = Math.max(0, beamT - dt * 2); beamFx.material.opacity = beamT * 0.9; beamFx.visible = beamT > 0; }
    // sprites
    let nb = 0, nc = 0; const fallOut = ly - 3.5;
    const put = (x, y, z, s, color, row = 0, sx = 1, sy = 1) => {
      pos.set(x, y, z); sc.set(s * sx, s * sy, s); mtx.compose(pos, q0, sc); bubbles.setMatrixAt(nb, mtx); bubbles.setColorAt(nb, color < 0 ? WHITE : C6[color]);
      pos.set(x - 0.17 * s * sx, y + 0.2 * s * sy, z + 0.46 * s); sc.set(0.24 * s, 0.13 * s, 0.03 * s); mtx.compose(pos, qShine, sc); shine.setMatrixAt(nb, mtx);
      pos.set(x + 0.2 * s * sx, y + 0.27 * s * sy, z + 0.42 * s); sc.set(0.09 * s, 0.09 * s, 1); mtx.compose(pos, q0, sc); dotM.setMatrixAt(nb, mtx);
      pos.set(x, y - 0.02 * s, z + 0.505 * s); sc.set(s * sx, s * sy, 1); mtx.compose(pos, q0, sc); faces.setMatrixAt(nb, mtx); aCell.setX(nb, Math.max(0, color) + row * 6);
      nb++;
    };
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i]; sp.t += dt;
      if (sp.st === 'idle' || sp.st === 'snap' || sp.st === 'intro') { sp.vx += -sp.ox * 140 * dt - sp.vx * 9 * dt; sp.vy += -sp.oy * 140 * dt - sp.vy * 9 * dt; sp.ox += sp.vx * dt; sp.oy += sp.vy * dt; }
      let x = sp.x + sp.ox, y = sp.y + sp.oy, s = sp.s, z = 0, row = 0;
      // jelly breathing + squash from the wobble spring
      const sq = Math.max(-0.12, Math.min(0.12, sp.oy * 0.5)), sx = 1 + Math.sin(T * 2.2 + sp.wob) * 0.012 - sq, sy = 1 - Math.sin(T * 2.2 + sp.wob) * 0.012 + sq;
      sp.blink -= dt; if (sp.blink < 0) { row = 1; if (sp.blink < -0.12) sp.blink = 2 + Math.random() * 5; }
      if (joyT > 0 && sp.st === 'idle') row = 2;
      if (sp.st === 'intro') { if (sp.t > 0) { const k = Math.min(1, sp.t / 0.35); s = Math.min(1, k * 1.3) * (1 + Math.sin(k * PI) * 0.15); if (k >= 1) { sp.st = 'idle'; sp.s = 1; s = 1; } } else s = 0; }
      else if (sp.st === 'snap') { const k = Math.min(1, sp.t / 0.08); sp.x += (sp.tx - sp.x) * k; sp.y += (sp.ty - sp.y) * k; x = sp.x + sp.ox; y = sp.y + sp.oy; const sq2 = Math.max(0, 1 - sp.t / 0.3); s = 1 + Math.sin(sp.t * 30) * 0.14 * sq2; if (sp.t > 0.3) { sp.st = 'idle'; sp.x = sp.tx; sp.y = sp.ty; } }
      else if (sp.st === 'pop') {
        row = 2;
        if (sp.t >= 0 && !sp.popped) { sp.popped = true; const c = sp.kind === 'stone' ? ['#ffffff', '#ffe3f3', '#e7d4ff'] : [COLORS[sp.color], LIGHT[sp.color], '#ffffff']; FX.spark(x, y, c, 12, { speed: 5.5, size: 1.1 }); FX.ring(x, y, sp.kind === 'stone' ? '#ffffff' : COLORS[sp.color], 0.9); snd.pop(sp.k || 0, G.combo); }
        else if (sp.popped) { const k = sp.t / 0.1; s = 1 + k * 0.4; if (k >= 1) sp.st = 'gone'; }
      }
      else if (sp.st === 'fall') { row = 1; sp.vy -= 34 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; x = sp.x; y = sp.y; z = 0.3; if (sp.y < fallOut) { sp.st = 'gone'; FX.spark(sp.x, fallOut + 0.4, sp.kind === 'stone' ? ['#ffffff'] : [COLORS[sp.color], '#ffffff'], 6, { speed: 3, up: 4, size: 0.8, life: 0.5 }); snd.thud(i); } }
      else if (sp.st === 'free') { sp.vy -= 6 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; x = sp.x; y = sp.y; z = 1; const k = sp.t / 0.9; if (k >= 1) sp.st = 'gone'; if (sp.crit) { sp.crit.m.rotation.y += dt * 9; sp.crit.g.scale.setScalar(Math.max(0.01, (1 + Math.sin(Math.min(1, k) * PI) * 0.8) * (1 - Math.max(0, k - 0.7) / 0.3))); } }
      if (sp.st === 'gone') { if (sp.crit) { sp.crit.used = false; sp.crit.g.visible = false; } sprites.splice(i, 1); continue; }
      if (sp.kind === 'stone') { if (nc < 90) { pos.set(x, y - 0.42 * s, z); sc.setScalar(s * 0.86); q.setFromAxisAngle(new V3(0, 1, 0), Math.sin(T * 1.3 + sp.wob) * 0.25); mtx.compose(pos, q, sc); cubes.setMatrixAt(nc++, mtx); } }
      else if (sp.kind === 'crit') { const o = sp.crit; o.g.position.set(x, y, z); if (sp.st !== 'free') { o.g.scale.set(s * sx, s * sy, s); o.m.rotation.y = Math.sin(T * 1.6 + sp.wob) * 0.45; o.m.position.y = Math.sin(T * 2.4 + sp.wob) * 0.04; o.m.rotation.z = Math.sin(T * 3.1 + sp.wob) * 0.08;
          put(x, y, z, s, sp.color, 0, sx, sy); const k = nb - 1; mtx.makeScale(0, 0, 0); bubbles.setMatrixAt(k, mtx); faces.setMatrixAt(k, mtx); } }   // glass glint only
      else put(x, y, z, s, sp.color, row, sx, sy);
    }
    // launcher bubbles (drawn in field space at the launcher)
    bombMesh.visible = rainbowMesh.visible = wandMesh.visible = false;
    const drawShot = (x, y, shot, s, z = 0.3) => {
      if (shot?.bomb) { bombMesh.visible = true; bombMesh.position.set(x, y, z); bombMesh.scale.setScalar(s * 1.05); bombMesh.rotation.z = Math.sin(T * 6) * 0.15; return; }
      if (shot?.rainbow) { rainbowMesh.visible = true; rainbowMesh.position.set(x, y, z); rainbowMesh.scale.setScalar(s * 1.05); rainbowMesh.rotation.y = T * 2; return; }
      if (shot?.wand) { wandMesh.visible = true; wandMesh.position.set(x, y, z); wandMesh.scale.setScalar(s * 1.25); wandMesh.rotation.z = -0.5 + Math.sin(T * 4) * 0.2; return; }
      put(x, y, z, s, shot ? shot.color : 0, 2);
    };
    if (G.state !== 'idle' && G.cur) {
      if (shotSp.st !== 'hidden') { const lk = 1 - loadAnim; drawShot(shotSp.x, shotSp.y, shotSp.flying || G.cur, (shotSp.flying ? 1 : Math.min(1, 0.3 + lk * 0.7)) * (1 + Math.sin(T * 4) * (shotSp.flying ? 0 : 0.03)), shotSp.flying ? 0.3 : 0.95); }
      const sw = swapAnim; drawShot(NEXT_X + sw * 1.2, ly - LY0 + NEXT_Y + Math.sin(sw * PI) * 0.6, G.nxt, 0.8, 0.5);
    }
    for (const m of [bubbles, shine, dotM, faces]) { m.count = nb; m.instanceMatrix.needsUpdate = true; }
    cubes.count = nc; cubes.instanceMatrix.needsUpdate = true; bubbles.instanceColor.needsUpdate = true; aCell.needsUpdate = true;
    if (G.aiming) computePath();
    drawAim(dt);
    FX.update(dt);
  }

  // ------------------------------------------------------------ input (root coords)
  let downAt = null;
  const input = {
    down(x, y) {
      if (G.state !== 'play') return;
      if (Math.hypot(x - NEXT_X, y - NEXT_Y) < 1.0 || Math.hypot(x, y - (LY0 - 0.6)) < 1.0) { downAt = { swap: true }; return; }
      downAt = { x, y }; if (aimFrom(x, y)) { G.aiming = true; computePath(); }
    },
    move(x, y) { if (!downAt || downAt.swap) return; G.aiming = aimFrom(x, y); if (G.aiming) computePath(); },
    up() { if (!downAt) return; const d = downAt; downAt = null; if (d.swap) { swap(); return; } if (G.aiming) fire(); G.aiming = false; },
    cancel() { downAt = null; G.aiming = false; },
  };

  // ------------------------------------------------------------ bot: one sensible action per call, paced like a person
  let botAim = null;
  function bot(demo = false) {   // demo: the self-playing first seconds pick a shot that frees no baby (game.js)
    if (G.state !== 'play' || G.busy || flight || !settled()) return;
    if (!botAim && demo) {
      const y0 = G.grid.launchY(); let best = null;
      for (let deg = 20; deg <= 160; deg += 2) {
        const a = deg * Math.PI / 180, tr = G.grid.trace(0, y0, a), [r, c] = tr.cell; if (G.grid.get(r, c)) continue;
        const res = G.grid.clone().resolve(r, c, G.cur), all = [...res.popped, ...res.dropped];
        if (all.some(v => v.critter >= 0)) continue;
        const v = all.length - tr.bounces * 0.5; if (!best || v > best.v) best = { v, a };
      }
      if (!best) return false;
      botAim = { a: best.a, t: 0, from: G.aim };
    }
    if (!botAim) {
      const y0 = G.grid.launchY();
      const b = bestShot(G.grid, 0, y0, special(G.cur) ? [G.cur] : [G.cur, G.nxt], { step: 2 });
      if (!b) return;
      if (b.swap) { swap(); return; }
      botAim = { a: b.a, t: 0, from: G.aim };
    }
    // sweep the aim toward the target over a few calls so the line is visible, hold a beat, then fire
    botAim.t++; const k = Math.min(1, botAim.t / 4); setAim(botAim.from + (botAim.a - botAim.from) * (1 - Math.pow(1 - k, 2))); G.aiming = true; computePath();
    if (botAim.t >= 7) { setAim(botAim.a); botAim = null; return fire() ? 'fired' : false; }
  }

  return {
    G, start, hide, update, input, swap, fire, loadBooster, bot, setAim, root, field, fx: FX, launcher: L, get sprites() { return sprites; },
    get state() { return G.state; }, get shots() { return G.shots; }, get busy() { return G.busy || !!flight; },
    get crittersLeft() { return critLeft(); }, get log() { return G.log.slice(); },
    set marks(v) { G.marks = v; },
  };
}

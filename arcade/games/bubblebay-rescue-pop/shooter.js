// Bubblebay shooter: renders the bubble field (glossy instanced bubbles, glass critter bubbles, pearl stones), the
// shell launcher, the aim line, shots flying along their traced path, pops, drops, critter rescues and every bit of juice.
// Lives in a group attached to the camera (board space: x ∈ [-W/2, W/2], ceiling at y = 0, rows go down).
import { THREE } from './kit/hc.js';
import { Grid, COLS, RH, W, MAXR, XWALL, cellPos, nbrs, bestShot } from './grid.js';
import { COLORS, CRITTERS, LAUNCH_Y, nextColor } from './levels.js';

const PI = Math.PI, V3 = THREE.Vector3;
const SPEED = 30, MIN_A = 10 * PI / 180, MAX_A = 170 * PI / 180;
const NEXT_X = 2.1, NEXT_Y = LAUNCH_Y - 0.35;
export const BOARD_H = -LAUNCH_Y + 1.6;   // ceiling to below the launcher

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function bubbleTex() {   // soft inner depth: lighter core, deeper rim, a faint swirl, so instanceColor reads as candy glass
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#f0f0f0'); g.addColorStop(1, '#8a8a8a'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.globalAlpha = 0.18; x.strokeStyle = '#fff'; x.lineWidth = 6; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * 48 - 20, 0); x.bezierCurveTo(i * 48 + 10, 40, i * 48 - 30, 80, i * 48 + 5, 128); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createShooter({ group, P, snd, hooks }) {
  const G = { grid: new Grid(), level: null, shots: 0, cur: null, nxt: null, state: 'idle', score: 0, rnd: Math.random, freed: 0, combo: 0, log: [], busy: false, aiming: false, aim: PI / 2, boost: null };
  const root = new THREE.Group(); group.add(root);

  // ------------------------------------------------------------ frame: frosted glass panel + driftwood ceiling beam
  const fieldH = MAXR * RH + 0.9;
  const panel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W + 0.7, fieldH + 0.6, 0.6)), new THREE.MeshBasicMaterial({ color: '#0e5d8c', transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
  panel.position.set(0, -fieldH / 2 + 0.05, -0.75); panel.renderOrder = -2; root.add(panel);
  const rim = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W + 1.0, fieldH + 0.9, 0.75)), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  rim.position.set(0, -fieldH / 2 + 0.05, -0.8); rim.renderOrder = -3; root.add(rim);
  const woodMat = new THREE.MeshStandardMaterial({ color: '#b07a4f', roughness: 0.65, metalness: 0 });
  const beam = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, W + 0.2, 6, 16), woodMat); beam.rotation.z = PI / 2; beam.position.set(0, 0.12, -0.25); beam.castShadow = false; root.add(beam);
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#f1e1bf', roughness: 0.8 });
  for (const sx of [-1, 1]) { const knot = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 8, 20), ropeMat); knot.position.set(sx * (W / 2 + 0.05), 0.12, -0.2); knot.rotation.y = PI / 2; root.add(knot); }
  // danger line (where the field would reach the launcher)
  const dl = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.06), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }));
  dl.position.set(0, cellPos(MAXR, 0).y - 0.55, -0.5); root.add(dl);

  // ------------------------------------------------------------ bubbles
  const N = 320;
  const bGeo = new THREE.SphereGeometry(0.5, 32, 22);
  const bMat = new THREE.MeshPhysicalMaterial({ map: bubbleTex(), roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.5, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.35 });
  bMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor.rgb * 0.14;\n#endif'); };
  const bubbles = new THREE.InstancedMesh(bGeo, bMat, N); bubbles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); bubbles.count = 0; bubbles.frustumCulled = false; root.add(bubbles);
  const shine = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }), N); shine.count = 0; shine.frustumCulled = false; shine.renderOrder = 2; root.add(shine);
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#8d97a3', roughness: 0.6, metalness: 0.05, flatShading: true, envMapIntensity: 0.8 });
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), stoneMat, 80); stones.count = 0; stones.frustumCulled = false; root.add(stones);
  // critter bubbles: tinted glass shells with a 3D critter inside
  const shellGeo = new THREE.SphereGeometry(0.5, 32, 22), glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.07, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.0, depthWrite: false });
  const discTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(54, 50, 6, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#dcdcdc'); g.addColorStop(1, '#6a6a6a'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const backGeo = new THREE.CircleGeometry(0.47, 40);
  const backMats = COLORS.map(c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), map: discTex, toneMapped: false }));
  const ringMats = COLORS.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, emissive: c, emissiveIntensity: 0.35 }));
  const ringGeo = new THREE.TorusGeometry(0.455, 0.075, 12, 44);
  // special shots
  const bombMesh = new THREE.Mesh(P.bomb.geo, P.bomb.mat); bombMesh.visible = false; root.add(bombMesh);
  const rainbowMesh = new THREE.Mesh(P.disco.geo, P.disco.mat); rainbowMesh.visible = false; root.add(rainbowMesh);
  const boltMat = new THREE.MeshStandardMaterial({ color: '#fff3a0', emissive: '#ffd23f', emissiveIntensity: 1.2, roughness: 0.3 });
  const boltMesh = new THREE.Group(); { const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), boltMat); core.scale.set(0.8, 1.25, 0.8); boltMesh.add(core); const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff6c4', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false })); boltMesh.add(halo); }
  boltMesh.visible = false; root.add(boltMesh);
  const beamFx = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1), new THREE.MeshBasicMaterial({ color: '#fff7c0', transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); beamFx.visible = false; root.add(beamFx);

  // ------------------------------------------------------------ launcher: a pearly clam cannon on a little driftwood stand
  const L = new THREE.Group(); L.position.set(0, LAUNCH_Y, 0.2); L.scale.setScalar(1.15); root.add(L);
  const shellMat = new THREE.MeshPhysicalMaterial({ color: '#ffe3ec', roughness: 0.28, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color('#ffffff'), iridescence: 0.6, iridescenceIOR: 1.5, envMapIntensity: 1.3 });
  const coralMat = new THREE.MeshPhysicalMaterial({ color: '#ff6f9a', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#ff3d7a', emissiveIntensity: 0.12, envMapIntensity: 1.3 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffcf5a', roughness: 0.22, metalness: 0.8, emissive: '#7a4a00', emissiveIntensity: 0.15 });
  { // scalloped clam dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 48, 18, 0, PI * 2, 0, PI / 2), shellMat); dome.scale.set(1, 0.62, 0.7); dome.position.y = -1.05; L.add(dome);
    for (let i = 0; i < 11; i++) { const a = PI * (0.08 + 0.84 * i / 10), rib = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.9, 4, 8), shellMat);
      rib.position.set(Math.cos(a) * 0.82, -1.05 + Math.sin(a) * 0.38, 0.62); rib.rotation.z = a - PI / 2; L.add(rib); }
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 10, 48, PI), goldMat); band.position.y = -1.05; band.scale.set(1, 1, 1); L.add(band);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), shellMat); pearl.position.set(0, -1.06, 0.9); L.add(pearl); }
  const barrel = new THREE.Group(); barrel.position.y = -0.55; L.add(barrel);
  { const prof = [[0.0, -0.1], [0.5, -0.1], [0.62, 0.15], [0.6, 0.55], [0.5, 0.95], [0.58, 1.1], [0.52, 1.18], [0.44, 1.12]].map(([x, y]) => new THREE.Vector2(x, y));
    const tube = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), coralMat); tube.material.side = THREE.DoubleSide; barrel.add(tube);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.08, 10, 36), goldMat); lip.rotation.x = PI / 2; lip.position.y = 1.12; barrel.add(lip);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 10, 36), goldMat); belt.rotation.x = PI / 2; belt.position.y = 0.35; barrel.add(belt);
    for (let i = 0; i < 6; i++) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), shellMat); const a = i / 6 * PI * 2; dot.position.set(Math.cos(a) * 0.6, 0.72, Math.sin(a) * 0.6); barrel.add(dot); } }
  const nextCup = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 32), goldMat); nextCup.rotation.x = PI / 2; nextCup.position.set(NEXT_X, NEXT_Y - 0.38, 0.2); root.add(nextCup);
  const nextBase = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.2, 28), shellMat); nextBase.position.set(NEXT_X, NEXT_Y - 0.48, 0.2); root.add(nextBase);

  // ------------------------------------------------------------ aim line + ghost
  const DOTS = 70;
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), DOTS); dots.count = 0; dots.frustumCulled = false; dots.renderOrder = 3; root.add(dots);
  dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DOTS * 3), 3);
  const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, toneMapped: false, depthWrite: false })); ghost.visible = false; root.add(ghost);
  const ghostRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 36), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, toneMapped: false })); ghost.add(ghostRing);

  // ------------------------------------------------------------ particles + shock rings (board space)
  const FX = (() => {
    const NP = 700, list = [], m = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), NP);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3); m.count = 0; m.frustumCulled = false; m.renderOrder = 4; root.add(m);
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new V3();
    const rings = []; for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 36), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); r.visible = false; r.renderOrder = 4; root.add(r); rings.push({ r, t: 1 }); }
    return {
      spark(x, y, colors, n = 14, { speed = 5, up = 2, size = 1, life = 0.7, grav = 9, z = 0.6 } = {}) {
        for (let i = 0; i < n && list.length < NP; i++) { const a = Math.random() * PI * 2, sp = speed * (0.35 + Math.random() * 0.75);
          list.push({ p: new V3(x, y, z), v: new V3(Math.cos(a) * sp, Math.sin(a) * sp + up, (Math.random() - 0.3) * 2), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
      },
      ring(x, y, color = '#fff', size = 1) { const R = rings.find(o => o.t >= 1) || rings[0]; R.t = 0; R.size = size; R.r.position.set(x, y, 0.7); R.r.material.color.set(color); R.r.visible = true; },
      update(dt) {
        let i = 0;
        for (let k = list.length - 1; k >= 0; k--) { const p = list[k]; p.life -= dt; if (p.life <= 0) { list.splice(k, 1); continue; }
          p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 8; const f = p.life / p.max;
          e.set(p.r, p.r * 0.7, 0); q.setFromEuler(e); s.setScalar(p.size * (0.25 + f)); tmp.compose(p.p, q, s); m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); i++; }
        m.count = i; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
        for (const R of rings) { if (R.t >= 1) { R.r.visible = false; continue; } R.t = Math.min(1, R.t + dt * 2.6); const k = 1 - Math.pow(1 - R.t, 3); R.r.scale.setScalar(R.size * (0.8 + k * 1.6)); R.r.material.opacity = 0.85 * (1 - R.t); }
      },
    };
  })();

  // ------------------------------------------------------------ sprites (everything that is drawn as a bubble)
  // { x, y, ox, oy, vx, vy, s, color, kind: 'b'|'stone'|'crit', st: 'idle'|'fall'|'pop'|'shot'|'gone', t, crit: { g, m } }
  let sprites = [];
  const critPool = [];
  function critterBubble(species, color) {
    let o = critPool.find(q => !q.used);
    if (!o) { o = { g: new THREE.Group(), back: new THREE.Mesh(backGeo, backMats[0]), shell: new THREE.Mesh(shellGeo, glassMat), ring: new THREE.Mesh(ringGeo, ringMats[0]), m: new THREE.Group(), used: false, species: -1 };
      o.g.add(o.back, o.m, o.shell, o.ring); o.back.position.z = -0.2; o.shell.renderOrder = 1; root.add(o.g); critPool.push(o); }
    o.used = true; o.g.visible = true; o.back.material = backMats[color]; o.ring.material = ringMats[color]; o.ring.visible = true; o.shell.visible = true; o.back.visible = true;
    if (o.species !== species) { o.m.clear(); const p = P.critters[species]; const mesh = new THREE.Mesh(p.geo, p.mat); mesh.scale.setScalar(0.7); mesh.position.set(0, -0.03, 0.08); o.m.add(mesh); o.species = species; }
    o.m.rotation.set(0, 0, 0); o.m.scale.setScalar(1); o.g.scale.setScalar(1);
    return o;
  }
  function spriteFor(v) {
    const p = cellPos(v.r, v.c);
    const sp = { x: p.x, y: p.y, ox: 0, oy: 0, vx: 0, vy: 0, s: 1, color: v.color, kind: v.stone ? 'stone' : v.critter >= 0 ? 'crit' : 'b', st: 'idle', t: 0, wob: Math.random() * 6, cell: v };
    if (sp.kind === 'crit') sp.crit = critterBubble(v.critter, v.color);
    v.sp = sp; sprites.push(sp); return sp;
  }
  const shotSp = { x: 0, y: LAUNCH_Y + 0.35, ox: 0, oy: 0, s: 1, color: 0, kind: 'b', st: 'idle', t: 0, wob: 0 };
  const nextSp = { x: NEXT_X, y: NEXT_Y, ox: 0, oy: 0, s: 0.78, color: 0, kind: 'b', st: 'idle', t: 0, wob: 0 };

  // ------------------------------------------------------------ level lifecycle
  function clearAll() { sprites = []; for (const o of critPool) { o.used = false; o.g.visible = false; } }
  function start(level, rnd, boosts = {}) {
    clearAll(); G.level = level; G.grid = level.grid.clone(); G.rnd = rnd; G.shots = level.shots; G.score = 0; G.freed = 0; G.log = []; G.state = 'play'; G.busy = false; G.boost = null; G.aiming = false;
    for (const v of G.grid.cells()) { const sp = spriteFor(v); sp.s = 0; sp.t = -(v.r * 0.045 + Math.random() * 0.08); sp.st = 'intro'; }
    G.cur = { color: nextColor(G.grid, rnd) }; G.nxt = { color: nextColor(G.grid, rnd) };
    if (boosts.rainbow) G.cur = { color: G.cur.color, rainbow: true };
    if (boosts.bomb) G.nxt = { color: G.nxt.color, bomb: true };
    root.visible = true; hooks.shots(G.shots); hooks.score(0); hooks.boost?.(null);
  }
  function hide() { root.visible = false; G.state = 'idle'; dots.count = 0; ghost.visible = false; }
  const critLeft = () => G.grid.crittersLeft();

  // ------------------------------------------------------------ aiming
  let path = null, dash = 0;
  function setAim(a) { G.aim = Math.max(MIN_A, Math.min(MAX_A, a)); }
  function aimFrom(x, y) { const a = Math.atan2(y - LAUNCH_Y, x); if (y < LAUNCH_Y + 0.4) return false; setAim(a); return true; }
  function computePath() {
    if (G.cur?.bolt) { const len = (-0.2 - LAUNCH_Y) / Math.sin(G.aim); const ex = Math.cos(G.aim) * len; path = { pts: [{ x: 0, y: LAUNCH_Y }, { x: Math.max(-XWALL, Math.min(XWALL, ex)), y: Math.max(LAUNCH_Y, -0.3) }], cell: null }; return path; }
    path = G.grid.trace(0, LAUNCH_Y, G.aim);
    return path;
  }
  function drawAim(dt) {
    if (!(G.aiming && G.state === 'play' && !G.busy)) { dots.count = 0; ghost.visible = false; return; }
    const pts = path.pts; dash = (dash + dt * 2.2) % 1;
    const col = new THREE.Color(G.cur.bolt ? '#ffe36a' : G.cur.rainbow ? '#ffffff' : G.cur.bomb ? '#ff9a7a' : COLORS[G.cur.color]).lerp(new THREE.Color('#ffffff'), 0.2);
    const m = new THREE.Matrix4(), gap = 0.6; let n = 0, carry = dash * gap, total = 0;
    for (let i = 1; i < pts.length && n < DOTS; i++) {
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy); let d = carry;
      while (d < len && n < DOTS) { const k = d / len, s = Math.max(0.35, 1 - total / 40); m.makeScale(s, s, s); m.setPosition(a.x + dx * k, a.y + dy * k, 0.4); dots.setMatrixAt(n, m); dots.setColorAt(n, col); n++; d += gap; total += gap; }
      carry = d - len;
    }
    dots.count = n; dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true;
    if (path.cell && !G.cur.bolt) { const p = cellPos(path.cell[0], path.cell[1]); ghost.position.set(p.x, p.y, 0.1); ghost.visible = true; ghost.material.color.copy(col); ghostRing.material.color.copy(col); }
    else ghost.visible = false;
  }

  // ------------------------------------------------------------ firing
  let flight = null;
  function fire() {
    if (G.state !== 'play' || G.busy || G.shots <= 0) return false;
    computePath(); G.busy = true; G.aiming = false; dots.count = 0; ghost.visible = false;
    G.shots--; hooks.shots(G.shots); snd.shoot(); hooks.fired?.();
    const shot = G.cur; G.cur = G.nxt; G.nxt = { color: nextColor(G.grid, G.rnd) };
    if (G.cur.color >= 0 && !G.grid.colorsLeft().has(G.cur.color) && !G.cur.bomb && !G.cur.rainbow && !G.cur.bolt) G.cur = { color: nextColor(G.grid, G.rnd) };
    const pts = path.pts, segs = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); tot += l; }
    flight = { shot, pts, segs, tot, d: 0, cell: path.cell, bounces: 0 };
    barrelKick = 1; hooks.boost?.(null);
    return true;
  }
  function swap() {
    if (G.state !== 'play' || G.busy) return;
    if (G.cur.bomb || G.cur.rainbow || G.cur.bolt) return;
    [G.cur, G.nxt] = [G.nxt, G.cur]; snd.swap(); swapAnim = 1;
  }
  function loadBooster(kind) {   // the next shot becomes a booster (the current colour moves to "next")
    if (G.state !== 'play' || G.busy) return false;
    if (G.cur.bomb || G.cur.rainbow || G.cur.bolt) return false;
    G.nxt = G.cur; G.cur = { color: -1, [kind]: true }; snd.magic(); swapAnim = 1; hooks.boost?.(kind); return true;
  }

  async function land(fl) {
    const shot = fl.shot;
    if (shot.bolt) return boltStrike(fl);
    const [r, c] = fl.cell; snd.stick();
    let res;
    if (G.grid.get(r, c)) res = { popped: [], dropped: [] };   // safety: never overwrite
    else res = G.grid.resolve(r, c, shot.bomb ? { bomb: true } : shot.rainbow ? { rainbow: true } : { color: shot.color });
    // the landed bubble becomes a sprite at the shot's position (so it snaps visibly)
    if (res.placed) { const sp = spriteFor(res.placed); sp.x = fl.end.x; sp.y = fl.end.y; sp.st = 'snap'; sp.t = 0; const p = cellPos(r, c); sp.tx = p.x; sp.ty = p.y; }
    // wobble the neighbours
    for (const [a, b] of nbrs(r, c)) { const v = G.grid.get(a, b); if (v?.sp) { const p = cellPos(a, b), q = cellPos(r, c), d = Math.hypot(p.x - q.x, p.y - q.y) || 1; v.sp.vx += (p.x - q.x) / d * 2.2; v.sp.vy += (p.y - q.y) / d * 2.2; } }
    if (shot.bomb) { snd.boom(); hooks.shake(0.8); FX.ring(fl.end.x, fl.end.y, '#ffb36b', 2.4); FX.spark(fl.end.x, fl.end.y, ['#ff8a2e', '#ffd23f', '#ffffff'], 40, { speed: 9, size: 1.6 }); }
    if (shot.rainbow) { snd.magic(); FX.spark(fl.end.x, fl.end.y, COLORS, 30, { speed: 7, size: 1.3 }); }
    await resolveFx(res, r, c);
  }
  async function boltStrike(fl) {
    const a = G.aim, dx = Math.cos(a), dy = Math.sin(a);
    const hit = G.grid.cells().filter(v => { const p = cellPos(v.r, v.c), t = (p.x) * dx + (p.y - LAUNCH_Y) * dy; if (t < 0) return false; const px = dx * t, py = LAUNCH_Y + dy * t; return Math.hypot(p.x - px, p.y - py) < 0.75; });
    beamFx.visible = true; const len = (0 - LAUNCH_Y) / Math.max(0.2, dy); beamFx.scale.set(1.2, len, 1); beamFx.position.set(dx * len / 2, LAUNCH_Y + dy * len / 2, 0.8); beamFx.rotation.z = a - PI / 2; beamFx.material.opacity = 0.95; beamT = 1;
    snd.boom(); snd.magic(); hooks.shake(0.6);
    for (const v of hit) G.grid.del(v.r, v.c);
    const res = { popped: hit, dropped: [] }; res.dropped = G.grid.floating(); for (const v of res.dropped) G.grid.del(v.r, v.c);
    await resolveFx(res, null, null);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function resolveFx(res, r, c) {
    const pop = res.popped, drop = res.dropped;
    G.log.push(pop.concat(drop).some(v => v.critter >= 0) ? 'c' : pop.length ? 'p' : 'm');
    if (pop.length) {
      const o = r == null ? { x: 0, y: LAUNCH_Y } : cellPos(r, c);
      pop.sort((a, b) => Math.hypot(cellPos(a.r, a.c).x - o.x, cellPos(a.r, a.c).y - o.y) - Math.hypot(cellPos(b.r, b.c).x - o.x, cellPos(b.r, b.c).y - o.y));
      pop.forEach((v, k) => { if (v.sp) { v.sp.st = 'pop'; v.sp.t = -k * 0.045; v.sp.k = k; } });
      G.score += pop.length * 10;
    }
    if (drop.length) {
      G.combo++;
      for (const v of drop) if (v.sp) { v.sp.st = 'fall'; v.sp.vx = (Math.random() - 0.5) * 4; v.sp.vy = 2 + Math.random() * 3; v.sp.t = 0; }
      G.score += drop.length * 20 * Math.min(4, G.combo); drop.forEach((v, k) => snd.drop(k));
    } else if (pop.length) G.combo = Math.max(0, G.combo - 1); else G.combo = 0;
    const n = pop.length + drop.length;
    if (n >= 12) hooks.combo('Splashtacular!', 4); else if (n >= 8) hooks.combo('Amazing!', 3); else if (drop.length >= 4) hooks.combo('Great drop!', 2); else if (n >= 5) hooks.combo('Nice!', 1);
    hooks.score(G.score);
    // critters freed (popped or dropped)
    const freed = pop.concat(drop).filter(v => v.critter >= 0);
    for (const v of freed) rescue(v);
    await wait(pop.length ? 140 : 60);
    G.busy = false;
    // overflow guard: anything that reached the launcher line just poofs (never blocks the launcher)
    for (const v of G.grid.cells()) if (v.r >= MAXR) { G.grid.del(v.r, v.c); if (v.sp) { v.sp.st = 'pop'; v.sp.t = 0; } }
    if (!critLeft()) { G.state = 'clear'; await wait(Math.min(700, pop.length * 45 + 300)); return finish(true); }
    if (G.shots <= 0) {
      G.state = 'out'; const more = await hooks.outOfShots();
      if (more) { G.shots += more; G.state = 'play'; hooks.shots(G.shots); }
      else finish(false);
    }
    if (G.state === 'play' && G.grid.size && !G.grid.colorsLeft().has(G.cur.color) && G.cur.color >= 0 && !G.cur.bomb && !G.cur.rainbow && !G.cur.bolt) G.cur = { color: nextColor(G.grid, G.rnd) };
  }
  function rescue(v) {
    const sp = v.sp; if (!sp?.crit) return;
    G.freed++; G.score += 250; snd.rescue(G.freed);
    const o = sp.crit; o.shell.visible = false; o.ring.visible = false; o.back.visible = false;
    FX.spark(sp.x + sp.ox, sp.y + sp.oy, [COLORS[v.color], '#ffffff', '#bff4ff'], 22, { speed: 6, size: 1.2 }); FX.ring(sp.x, sp.y, '#ffffff', 1.4);
    sp.st = 'free'; sp.t = 0; sp.vx = (Math.random() - 0.5) * 2; sp.vy = 7;
    const w = new V3(sp.x, sp.y, 0.5); root.localToWorld(w);
    hooks.freed(v.critter, w, critLeft());
  }
  async function finish(won) {
    if (G.state === 'won' || G.state === 'lost') return;
    if (won) G.state = 'clear';
    if (won) {
      hooks.allFreed();
      // everything left tumbles down, then the spare shots fly up as bonus bubbles
      await wait(500);
      const rest = G.grid.cells(); for (const v of rest) { G.grid.del(v.r, v.c); if (v.sp) { v.sp.st = 'fall'; v.sp.vx = (Math.random() - 0.5) * 5; v.sp.vy = 3 + Math.random() * 4; } }
      G.score += rest.length * 10; hooks.score(G.score);
      await wait(600);
      const bonus = G.shots, shown = Math.min(bonus, 14);
      for (let i = 0; i < shown; i++) { const x = (Math.random() - 0.5) * (W - 2), y = -3 - Math.random() * 8; FX.spark(x, y, [COLORS[i % 6], '#ffffff'], 16, { speed: 6, size: 1.3 }); FX.ring(x, y, COLORS[i % 6], 1.2); snd.pop(i % 8, 0);
        G.score += Math.round(100 * bonus / shown); hooks.score(G.score); hooks.shots(Math.round(bonus - (i + 1) * bonus / shown)); await wait(55); }
      G.state = 'won'; const frac = G.shots / G.level.shots, stars = frac >= 0.35 ? 3 : frac >= 0.15 ? 2 : 1;
      await wait(350); hooks.done(true, stars, G.score);
    } else { G.state = 'lost'; hooks.done(false, 0, G.score); }
  }

  // ------------------------------------------------------------ frame
  let barrelKick = 0, swapAnim = 0, beamT = 0, T = 0;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), pos = new V3(), col = new THREE.Color(), shineQ = new THREE.Quaternion();
  const C6 = COLORS.map(c => new THREE.Color(c));
  function update(dt) {
    if (!root.visible) return;
    T += dt;
    // flight
    if (flight) {
      flight.d += SPEED * dt;
      let d = flight.d, i = 0; while (i < flight.segs.length && d > flight.segs[i]) { d -= flight.segs[i]; i++; }
      if (i > flight.bounces + 0 && i < flight.segs.length) { flight.bounces = i; snd.bounce(); FX.spark(flight.pts[i].x, flight.pts[i].y, ['#ffffff'], 5, { speed: 3, size: 0.8, life: 0.35 }); }
      if (i >= flight.segs.length) { const fl = flight; flight = null; fl.end = fl.pts[fl.pts.length - 1]; shotSp.st = 'hidden'; land(fl).then(() => { shotSp.st = 'idle'; }); }
      else { const a = flight.pts[i], b = flight.pts[i + 1], k = d / flight.segs[i]; shotSp.x = a.x + (b.x - a.x) * k; shotSp.y = a.y + (b.y - a.y) * k; shotSp.flying = flight.shot; }
    }
    if (!flight && shotSp.st !== 'hidden') { shotSp.x = Math.cos(G.aim) * 1.25; shotSp.y = LAUNCH_Y - 0.63 + Math.sin(G.aim) * 1.25; shotSp.flying = null; }
    // launcher
    barrel.rotation.z = G.aim - PI / 2; barrelKick = Math.max(0, barrelKick - dt * 5); barrel.scale.set(1 + barrelKick * 0.12, 1 - barrelKick * 0.18, 1 + barrelKick * 0.12);
    swapAnim = Math.max(0, swapAnim - dt * 4);
    if (beamT > 0) { beamT = Math.max(0, beamT - dt * 2); beamFx.material.opacity = beamT * 0.9; beamFx.visible = beamT > 0; }
    // sprites
    let nb = 0, ns = 0; const fallOut = LAUNCH_Y - 3;
    const put = (x, y, z, s, color, special) => {
      if (special) return;
      pos.set(x, y, z); sc.setScalar(s); q.identity(); mtx.compose(pos, q, sc); bubbles.setMatrixAt(nb, mtx); bubbles.setColorAt(nb, color < 0 ? col.set('#ffffff') : C6[color]);
      pos.set(x - 0.17 * s, y + 0.19 * s, z + 0.47 * s); sc.set(0.22 * s, 0.14 * s, 0.03 * s); q.setFromAxisAngle(new V3(0, 0, 1), 0.7); mtx.compose(pos, q, sc); shine.setMatrixAt(nb, mtx); nb++;
    };
    for (let i = sprites.length - 1; i >= 0; i--) {
      const sp = sprites[i]; sp.t += dt;
      // spring wobble
      if (sp.st === 'idle' || sp.st === 'snap' || sp.st === 'intro') { sp.vx += -sp.ox * 140 * dt - sp.vx * 9 * dt; sp.vy += -sp.oy * 140 * dt - sp.vy * 9 * dt; sp.ox += sp.vx * dt; sp.oy += sp.vy * dt; }
      let x = sp.x + sp.ox, y = sp.y + sp.oy, s = sp.s, z = 0;
      if (sp.st === 'intro') { if (sp.t > 0) { const k = Math.min(1, sp.t / 0.35); s = sp.s = k < 1 ? 1 + Math.sin(k * PI) * 0.25 * (1 - k) + (k - 1) * 0 : 1; s = Math.min(1, k * 1.3) * (1 + Math.sin(k * PI) * 0.15); if (k >= 1) { sp.st = 'idle'; sp.s = 1; s = 1; } } else s = 0; y += sp.t < 0 ? 0 : (1 - Math.min(1, sp.t / 0.35)) * 0.8; }
      else if (sp.st === 'snap') { const k = Math.min(1, sp.t / 0.08); sp.x += (sp.tx - sp.x) * k; sp.y += (sp.ty - sp.y) * k; x = sp.x + sp.ox; y = sp.y + sp.oy; const sq = Math.max(0, 1 - sp.t / 0.25); s = 1 + Math.sin(sp.t * 30) * 0.12 * sq; if (sp.t > 0.25) { sp.st = 'idle'; sp.x = sp.tx; sp.y = sp.ty; } }
      else if (sp.st === 'pop') {
        if (sp.t < 0) { /* waiting its turn */ }
        else if (!sp.popped) { sp.popped = true; const c = sp.kind === 'stone' ? ['#ffffff', '#f6dcff', '#d9f3ff'] : [COLORS[sp.color], COLORS[sp.color], '#ffffff']; FX.spark(x, y, c, 12, { speed: 5.5, size: 1.1 }); FX.ring(x, y, sp.kind === 'stone' ? '#ffffff' : COLORS[sp.color], 0.9); snd.pop(sp.k || 0, G.combo); }
        else { const k = sp.t / 0.09; s = 1 + k * 0.35; if (k >= 1) { sp.st = 'gone'; } }
      }
      else if (sp.st === 'fall') { sp.vy -= 34 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; x = sp.x; y = sp.y; z = 0.3; if (sp.y < fallOut) { sp.st = 'gone'; FX.spark(sp.x, fallOut + 0.4, sp.kind === 'stone' ? ['#ffffff'] : [COLORS[sp.color], '#ffffff'], 6, { speed: 3, up: 4, size: 0.8, life: 0.5 }); snd.thud(i); hooks.dropPoint?.(); } }
      else if (sp.st === 'free') { sp.vy -= 6 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; x = sp.x; y = sp.y; z = 1; const k = sp.t / 0.9; if (k >= 1) sp.st = 'gone'; if (sp.crit) { sp.crit.m.rotation.y += dt * 9; sp.crit.g.scale.setScalar(Math.max(0.01, (1 + Math.sin(Math.min(1, k) * PI) * 0.8) * (1 - Math.max(0, k - 0.7) / 0.3))); } }
      if (sp.st === 'gone') { if (sp.crit) { sp.crit.used = false; sp.crit.g.visible = false; } sprites.splice(i, 1); continue; }
      if (sp.kind === 'stone') { if (ns < 80) { pos.set(x, y, z); sc.setScalar(s); q.setFromAxisAngle(new V3(0.3, 1, 0.2).normalize(), T * 0.4 + sp.wob); mtx.compose(pos, q, sc); stones.setMatrixAt(ns++, mtx); } }
      else if (sp.kind === 'crit') { const o = sp.crit; o.g.position.set(x, y, z); if (sp.st !== 'free') { o.g.scale.setScalar(s); o.m.rotation.y = Math.sin(T * 1.6 + sp.wob) * 0.5; o.m.position.y = Math.sin(T * 2.4 + sp.wob) * 0.04; }
        if (sp.st !== 'free') { pos.set(x - 0.17 * s, y + 0.19 * s, z + 0.47 * s); sc.set(0.22 * s, 0.14 * s, 0.03 * s); q.setFromAxisAngle(new V3(0, 0, 1), 0.7); mtx.compose(pos, q, sc); shine.setMatrixAt(nb, mtx); bubbles.setMatrixAt(nb, mtx.makeScale(0, 0, 0)); bubbles.setColorAt(nb, C6[0]); nb++; } }
      else put(x, y, z, s, sp.color);
    }
    // launcher bubbles
    const drawShot = (sp, shot, s) => {
      bombMesh.visible ||= false;
      if (shot?.bomb) { bombMesh.visible = true; bombMesh.position.set(sp.x, sp.y - 0.4 * s, 0.3); bombMesh.scale.setScalar(s * 1.0); bombMesh.rotation.z = Math.sin(T * 6) * 0.15; return; }
      if (shot?.rainbow) { rainbowMesh.visible = true; rainbowMesh.position.set(sp.x, sp.y - 0.5 * s, 0.3); rainbowMesh.scale.setScalar(s); rainbowMesh.rotation.y = T * 2; return; }
      if (shot?.bolt) { boltMesh.visible = true; boltMesh.position.set(sp.x, sp.y, 0.3); boltMesh.scale.setScalar(s); boltMesh.rotation.y = T * 3; return; }
      put(sp.x, sp.y, put.z ?? 0.3, s, shot ? shot.color : 0);
    };
    bombMesh.visible = rainbowMesh.visible = boltMesh.visible = false;
    if (G.state !== 'idle' && G.cur) {
      if (shotSp.st !== 'hidden') { const sp2 = { x: shotSp.x, y: shotSp.y }; put.z = shotSp.flying ? 0.3 : 0.95; drawShot(sp2, shotSp.flying || G.cur, 1 + Math.sin(T * 4) * (shotSp.flying ? 0 : 0.03)); put.z = 0.3; }
      if (!shotSp.flying || true) { const sw = swapAnim; nextSp.x = NEXT_X - sw * 1.2; drawShot({ x: nextSp.x, y: NEXT_Y + Math.sin(sw * PI) * 0.6 }, G.nxt, 0.78); }
    }
    bubbles.count = nb; shine.count = nb; stones.count = ns;
    bubbles.instanceMatrix.needsUpdate = true; if (bubbles.instanceColor) bubbles.instanceColor.needsUpdate = true; shine.instanceMatrix.needsUpdate = true; stones.instanceMatrix.needsUpdate = true;
    if (G.aiming) computePath();
    drawAim(dt);
    FX.update(dt);
  }

  // ------------------------------------------------------------ input (board coords)
  let downAt = null;
  const input = {
    down(x, y) {
      if (G.state !== 'play') return;
      if (Math.hypot(x - NEXT_X, y - NEXT_Y) < 1.0 || Math.hypot(x, y - LAUNCH_Y) < 0.9) { downAt = { swap: true }; return; }
      downAt = { x, y }; if (aimFrom(x, y)) { G.aiming = true; computePath(); }
    },
    move(x, y) { if (!downAt || downAt.swap) return; G.aiming = aimFrom(x, y); if (G.aiming) computePath(); },
    up() { if (!downAt) return; const d = downAt; downAt = null; if (d.swap) { swap(); return; } if (G.aiming) fire(); G.aiming = false; },
    cancel() { downAt = null; G.aiming = false; },
  };

  // ------------------------------------------------------------ bot: one sensible action
  let botAim = null;
  function bot() {
    if (G.state !== 'play' || G.busy || flight) return;
    if (!botAim) {
      const b = bestShot(G.grid, 0, LAUNCH_Y, (G.cur.bomb || G.cur.rainbow || G.cur.bolt) ? [G.cur] : [G.cur, G.nxt], { step: 2 });
      if (!b) return;
      if (b.swap) { swap(); return; }
      botAim = { a: b.a, t: 0 };
    }
    // sweep the aim toward the target over a couple of calls so the line is visible, then fire
    botAim.t++; const k = Math.min(1, botAim.t / 2); setAim(G.aim + (botAim.a - G.aim) * k); G.aiming = true; computePath();
    if (k >= 1) { setAim(botAim.a); botAim = null; fire(); }
  }

  return {
    G, start, hide, update, input, swap, fire, loadBooster, bot, setAim, root, fx: FX, get sprites() { return sprites; },
    get state() { return G.state; }, get shots() { return G.shots; }, get busy() { return G.busy || !!flight; },
    get crittersLeft() { return critLeft(); }, get log() { return G.log.slice(); },
    toScreen(x, y, cam) { const v = new V3(x, y, 0.5); root.localToWorld(v); v.project(cam); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
    launcherPos: { x: 0, y: LAUNCH_Y },
  };
}

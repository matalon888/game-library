// Slip Links — original game. Chains are knotted over a board of pegs; tap the chain lying on top to slip it free.
import { THREE, createStage, createUI, input, loop, mat, rounded, sfx, tone, buzz, burst, confetti, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

const ST = store('sliplinks');
const F = flow('sliplinks');
let level = ST.get('level', 1), best = ST.get('best', 0), score = 0;
const stage = createStage({ fov: 44, shadowSize: 9 });
const { scene, camera, sun, renderer } = stage;
sun.shadow.mapSize.set(1024, 1024);
const ui = createUI({ title: 'SLIP<br>LINKS', hint: 'Tap the chain on top', hand: '👆', score: false });
const $ = id => document.getElementById(id);

// ------------------------------------------------------------------ themes (backdrop, board, props)
const THEMES = [
  { name: 'pond', ground: '#8fe3f2', fog: '#c9f6ff', board: '#f6a47c', rim: '#d9805a', ui: '#ff8c5a', bg: ['#a7ecf7', '#d9fbff'] },
  { name: 'snow', ground: '#e3f2ff', fog: '#f4faff', board: '#a7a3e6', rim: '#7f7bc4', ui: '#7b6fe0', bg: ['#e3f2ff', '#ffffff'] },
  { name: 'beach', ground: '#fff1b8', fog: '#fffbe6', board: '#e7b98c', rim: '#c0906a', ui: '#f2994a', bg: ['#fff1b8', '#fffbe6'] },
  { name: 'stone', ground: '#5a9a8b', fog: '#9fd1c4', board: '#4c5878', rim: '#323b55', ui: '#2fb39a', bg: ['#5a9a8b', '#9fd1c4'] },
  { name: 'lake', ground: '#8ea6f7', fog: '#c5d2ff', board: '#f1f1fa', rim: '#c9c9de', ui: '#5b7cf0', bg: ['#8ea6f7', '#c5d2ff'] },
];
const CHAIN_COLS = ['#2f6fe0', '#2fc46e', '#ffc61a', '#ff7a1a', '#9b4dff', '#ff4fa3', '#14c4c4', '#8a5a2b', '#e83a3a'];

// ------------------------------------------------------------------ shared geometry
const LINK_GEO = new THREE.TorusGeometry(0.11, 0.043, 6, 14);
const RING_GEO = new THREE.TorusGeometry(0.2, 0.09, 10, 22); RING_GEO.rotateX(Math.PI / 2);
const SPACING = 0.17, BASE_Y = 0.15;

const world = new THREE.Group(); scene.add(world);
const boardG = new THREE.Group(); world.add(boardG);
let theme, chains = [], pegs = [], S = 6, state = 'ready', strikes = 0, cleared = 0, comboT = 0, combo = 0, spin = 0, busyT = 0;
let botTarget = null, botWait = 0;

// ------------------------------------------------------------------ helpers
const v2 = (x, z) => new THREE.Vector2(x, z);
function segX(a, b, c, d) {         // 2D segment intersection -> [t,u] or null
  const r = b.clone().sub(a), s = d.clone().sub(c), den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const q = c.clone().sub(a), t = (q.x * s.y - q.y * s.x) / den, u = (q.x * r.y - q.y * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u, Math.abs(den) / (r.length() * s.length())] : null;
}
function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry && o.geometry !== LINK_GEO && o.geometry !== RING_GEO && !o.geometry.shared) o.geometry.dispose(); }); } }

// ------------------------------------------------------------------ level generation
function pegGrid(n) {
  const cols = n > 4 ? 4 : 3, rows = n > 4 ? 4 : 3, gap = n > 4 ? 1.75 : 2.1, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(v2((c - (cols - 1) / 2) * gap, (r - (rows - 1) / 2) * gap));
  return { pts: out, size: (cols - 1) * gap + 1.9 };
}
function planPath(A, B, r, pegPts, used, allowWrap) {
  const pts = [A];
  let wrap = -1;
  if (allowWrap) {           // loop around a free peg lying roughly between the ends
    const mid = A.clone().add(B).multiplyScalar(0.5); let bestD = 1e9;
    pegPts.forEach((p, i) => { if (used.has(i)) return; const d = p.distanceTo(mid); if (d < bestD && d < A.distanceTo(B) * 0.6) { bestD = d; wrap = i; } });
  }
  if (wrap >= 0) {
    const C = pegPts[wrap], ra = 0.36;
    const ta = Math.atan2(A.y - C.y, A.x - C.x), tb = Math.atan2(B.y - C.y, B.x - C.x);
    let d = tb - ta; while (d <= 0) d += Math.PI * 2;           // ccw sweep
    if (d < Math.PI) d += Math.PI * 2;                           // take the long way round -> wraps the peg
    if (r() < 0.5) d = d - Math.PI * 2;                          // or clockwise long way
    if (Math.abs(d) < Math.PI) d += Math.sign(d) * Math.PI * 2;
    const steps = 7;
    for (let s = 0; s <= steps; s++) { const t = ta + d * (0.08 + 0.84 * s / steps); pts.push(v2(C.x + Math.cos(t) * ra, C.y + Math.sin(t) * ra)); }
  } else {
    const dir = B.clone().sub(A), len = dir.length(), nrm = v2(-dir.y, dir.x).normalize();
    if (r() < 0.45) {        // S-curve
      const o = (0.2 + r() * 0.35) * len * (r() < 0.5 ? -1 : 1);
      pts.push(A.clone().lerp(B, 0.33).add(nrm.clone().multiplyScalar(o)), A.clone().lerp(B, 0.67).add(nrm.clone().multiplyScalar(-o * 0.8)));
    } else {
      const o = (r() - 0.5) * len * 0.8;
      pts.push(A.clone().lerp(B, 0.5).add(nrm.clone().multiplyScalar(o)));
    }
  }
  pts.push(B);
  return { ctrl: pts, wrap };
}
function samplePath(ctrl, half) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(p => new THREE.Vector3(p.x, 0, p.y)), false, 'centripetal');
  const len = curve.getLength(), n = Math.max(8, Math.round(len / SPACING));
  const pts = curve.getSpacedPoints(n).map(p => v2(p.x, p.z));
  // keep the chain on the board
  for (const p of pts) { p.x = clamp(p.x, -half, half); p.y = clamp(p.y, -half, half); }
  return pts;
}
function crossings(a, b) {
  const out = [];
  for (let i = 0; i < a.length - 1; i++) for (let j = 0; j < b.length - 1; j++) {
    const x = segX(a[i], a[i + 1], b[j], b[j + 1]); if (x) out.push({ ka: i + x[0], kb: j + x[1], sin: x[2] });
  }
  return out;
}
function generate() {
  const r = rng(level * 7919 + 13), fk = F.k();
  const n = Math.min(7, 2 + Math.floor((level + 1) / 2) - (level === 2 ? 0 : 0));
  const grid = pegGrid(n); S = grid.size;
  const half = S / 2 - 0.35;
  let bestC = null, bestScore = -1e9;
  for (let attempt = 0; attempt < 70; attempt++) {
    const idx = grid.pts.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const ends = idx.slice(0, n * 2), used = new Set(ends);
    const cs = [];
    for (let c = 0; c < n; c++) {
      const A = grid.pts[ends[c * 2]], B = grid.pts[ends[c * 2 + 1]];
      const allowWrap = level >= 3 && r() < Math.min(0.58, (0.15 + level * 0.04) * fk);
      const plan = planPath(A, B, r, grid.pts, used, allowWrap);
      if (plan.wrap >= 0) used.add(plan.wrap);
      cs.push({ a: ends[c * 2], b: ends[c * 2 + 1], wrap: plan.wrap, pts: samplePath(plan.ctrl, half) });
    }
    // score the candidate: crossings wanted, ugly overlaps / pegs-in-path punished
    let sc = 0, total = 0; const touched = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const c = cs[i];
      if (c.pts.length < 11) sc -= 3;
      grid.pts.forEach((p, pi) => {
        if (!used.has(pi) || pi === c.a || pi === c.b || pi === c.wrap) return;
        for (const q of c.pts) if (q.distanceTo(p) < 0.32) { sc -= 4; break; }
      });
      for (let j = i + 1; j < n; j++) {
        const xs = crossings(c.pts, cs[j].pts);
        for (const x of xs) {
          total++; touched[i]++; touched[j]++;
          if (x.sin < 0.4) sc -= 3;
          const la = c.pts.length - 1, lb = cs[j].pts.length - 1;
          if (Math.min(x.ka, la - x.ka) < 3 || Math.min(x.kb, lb - x.kb) < 3) sc -= 3;
        }
        if (xs.length > 2) sc -= 2 * (xs.length - 2);
      }
    }
    const target = Math.round((n - 1 + Math.floor(level / 3)) * fk);
    sc -= Math.abs(total - target) * 1.5;
    sc -= touched.filter(t => t === 0).length * 3;
    if (sc > bestScore) { bestScore = sc; bestC = cs; bestC.used = used; }
  }
  // removal order (rank 0 is removed first and lies on top of everything it crosses)
  const order = bestC.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  order.forEach((ci, rank) => bestC[ci].rank = rank);
  // show only the pegs in use plus a couple of spare ones that no chain runs over
  const show = new Set(bestC.used);
  const spare = grid.pts.map((p, i) => i).filter(i => !show.has(i) && bestC.every(c => c.pts.every(q => q.distanceTo(grid.pts[i]) > 0.45)));
  for (let i = 0; i < Math.min(spare.length, n > 4 ? 2 : 1); i++) show.add(spare.splice(Math.floor(r() * spare.length), 1)[0]);
  // centre the used pegs on the board
  const sp = [...show].map(i => grid.pts[i]), mx = (Math.min(...sp.map(p => p.x)) + Math.max(...sp.map(p => p.x))) / 2, mz = (Math.min(...sp.map(p => p.y)) + Math.max(...sp.map(p => p.y))) / 2;
  const off = v2(-mx, -mz); grid.pts.forEach(p => p.add(off)); bestC.forEach(c => c.pts.forEach(p => p.add(off)));
  return { grid, cs: bestC, show };
}

// ------------------------------------------------------------------ build
const tmpM = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function writeLinks(ch, pts) {
  const n = pts.length;
  for (let k = 0; k < n; k++) {
    X.subVectors(pts[Math.min(k + 1, n - 1)], pts[Math.max(k - 1, 0)]).normalize();
    Z.crossVectors(X, UP); if (Z.lengthSq() < 1e-6) Z.set(1, 0, 0); Z.normalize();
    Y.crossVectors(Z, X).normalize();
    if (k % 2) { const t = Y.clone(); Y.copy(Z); Z.copy(t).negate(); }
    X.multiplyScalar(1.4);
    tmpM.makeBasis(X, Y, Z); tmpM.setPosition(pts[k].x - ch.c.x, pts[k].y - ch.c.y, pts[k].z - ch.c.z);
    ch.mesh.setMatrixAt(k, tmpM);
  }
  ch.mesh.instanceMatrix.needsUpdate = true;
}
const PEG = { base: new THREE.CylinderGeometry(0.21, 0.24, 0.07, 18), post: new THREE.CylinderGeometry(0.085, 0.1, 0.82, 12), top: new THREE.SphereGeometry(0.13, 16, 12) };
let pegMeshes = [];
const propsG = new THREE.Group(); scene.add(propsG);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat('#8fe3f2', { roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -1.1; ground.receiveShadow = true; scene.add(ground);

function buildLevel() {
  theme = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', theme.ui);
  ground.material.color.set(theme.ground);
  scene.fog = new THREE.Fog(theme.fog, 26, 60);
  for (const c of chains) world.remove(c.g);
  chains = []; clearGroup(boardG); pegMeshes.forEach(m => world.remove(m)); pegMeshes = [];
  const { grid, cs, show } = generate();
  // board: rim slab + top slab
  const rim = new THREE.Mesh(rounded(S + 0.18, S + 0.18, 0.5, 0.2), mat(theme.rim)); rim.rotation.x = -Math.PI / 2; rim.position.y = -0.36; rim.receiveShadow = true; rim.castShadow = true;
  const top = new THREE.Mesh(rounded(S, S, 0.32, 0.14), mat(theme.board, { roughness: 0.75 })); top.rotation.x = -Math.PI / 2; top.position.y = -0.16; top.receiveShadow = true;
  boardG.add(rim, top);
  // pegs (instanced: base, post, top)
  pegs = grid.pts; const shown = [...show];
  const pm = mat('#c3c0ef', { roughness: 0.35 }), pb = mat('#e6e4fb', { roughness: 0.5 });
  const ib = new THREE.InstancedMesh(PEG.base, pb, shown.length), ip = new THREE.InstancedMesh(PEG.post, pm, shown.length), it = new THREE.InstancedMesh(PEG.top, pm, shown.length);
  shown.map(i => pegs[i]).forEach((p, i) => {
    ib.setMatrixAt(i, tmpM.makeTranslation(p.x, 0.035, p.y)); ip.setMatrixAt(i, tmpM.makeTranslation(p.x, 0.45, p.y)); it.setMatrixAt(i, tmpM.makeTranslation(p.x, 0.88, p.y));
  });
  for (const m of [ib, ip, it]) { m.castShadow = true; m.receiveShadow = true; boardG.add(m); }
  // chains
  cs.forEach((c, i) => {
    const col = CHAIN_COLS[(i + level) % CHAIN_COLS.length];
    const ch = { ...c, col, h: new Float32Array(c.pts.length).fill(BASE_Y), over: [], under: [], removed: false, rem: -1, tug: -1, flash: -1 };
    ch.m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.28, metalness: 0.25, emissive: '#000000' });
    chains.push(ch);
  });
  // crossings -> over / under relations
  for (let i = 0; i < chains.length; i++) for (let j = i + 1; j < chains.length; j++) {
    for (const x of crossings(chains[i].pts, chains[j].pts)) {
      const [o, u, ko, ku] = chains[i].rank < chains[j].rank ? [chains[i], chains[j], x.ka, x.kb] : [chains[j], chains[i], x.kb, x.ka];
      o.over.push({ other: u, k: ko, ku }); u.under.push({ other: o, k: ku });
    }
  }
  // heights: settle bottom-most chains first
  const byRank = [...chains].sort((a, b) => b.rank - a.rank);
  for (const ch of byRank) for (const x of ch.over) {
    const target = x.other.h[Math.round(x.ku)] + 0.3, sig = 2.2;
    for (let k = 0; k < ch.h.length; k++) { const d = k - x.k; ch.h[k] = Math.max(ch.h[k], BASE_Y + (target - BASE_Y) * Math.exp(-d * d / (2 * sig * sig))); }
  }
  for (const ch of chains) {
    ch.base = ch.pts.map((p, k) => new THREE.Vector3(p.x, ch.h[k], p.y));
    ch.c = new THREE.Vector3(); ch.base.forEach(p => ch.c.add(p)); ch.c.divideScalar(ch.base.length); ch.c.y = 0;
    ch.g = new THREE.Group(); ch.g.position.copy(ch.c);
    ch.mesh = new THREE.InstancedMesh(LINK_GEO, ch.m, ch.base.length); ch.mesh.castShadow = true; ch.mesh.receiveShadow = true;
    ch.ringA = new THREE.Mesh(RING_GEO, ch.m); ch.ringB = new THREE.Mesh(RING_GEO, ch.m);
    for (const [rg, pi] of [[ch.ringA, ch.a], [ch.ringB, ch.b]]) { rg.position.set(pegs[pi].x - ch.c.x, 0.1, pegs[pi].y - ch.c.z); rg.castShadow = true; rg.userData.peg = pi; }
    ch.g.add(ch.mesh, ch.ringA, ch.ringB); world.add(ch.g);
    ch.cur = ch.base.map(p => p.clone());
    writeLinks(ch, ch.cur);
  }
  buildProps();
  strikes = 0; cleared = 0; combo = 0; spin = 0; botTarget = null; world.rotation.y = 0; world.position.y = 0;
  drawStrikes(); ui.levels(level); ui.progress(0);
  frameCam();
}

// ------------------------------------------------------------------ decorative props (low-poly, instanced where repeated)
const ROCK = new THREE.DodecahedronGeometry(1, 0), ICO = new THREE.IcosahedronGeometry(1, 0);
function inst(geo, m, list) {
  const im = new THREE.InstancedMesh(geo, m, list.length), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((o, i) => { e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e); tmpM.compose(new THREE.Vector3(o.x, o.y, o.z), q, new THREE.Vector3(o.sx, o.sy ?? o.sx, o.sz ?? o.sx)); im.setMatrixAt(i, tmpM); });
  im.castShadow = true; im.receiveShadow = true; propsG.add(im); return im;
}
function buildProps() {
  clearGroup(propsG);
  const r = rng(level * 31 + 5), G = ground.position.y, h = S / 2;
  const spots = (n, zMin, zMax, xr) => Array.from({ length: n }, () => ({ x: (r() * 2 - 1) * xr, z: zMin + r() * (zMax - zMin) })).filter(p => Math.abs(p.x) > h + 0.7 || p.z < -h - 0.9);
  const flat = { flatShading: true, roughness: 0.85 };
  if (theme.name === 'pond') {
    const pads = spots(26, -h - 9, h + 2, h + 6).map(p => ({ ...p, y: G + 0.02, sx: 0.55 + r() * 0.45, sy: 0.05, ry: r() * 6 }));
    inst(new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, 0.5, 5.6), mat('#6cc46a'), pads);
    inst(new THREE.SphereGeometry(1, 10, 8), mat('#ffb6d0'), pads.filter((_, i) => i % 3 === 0).map(p => ({ x: p.x + 0.15, y: G + 0.15, z: p.z, sx: 0.2, sy: 0.17 })));
    inst(ROCK, mat('#9aa39b', flat), spots(6, -h - 7, -h - 2, h + 5).map(p => ({ ...p, y: G + 0.1, sx: 0.5 + r() * 0.6, sy: 0.4, ry: r() * 6 })));
    inst(new THREE.CylinderGeometry(0.04, 0.05, 1, 5), mat('#4f9e4a'), spots(18, -h - 6, -h - 1, h + 4).map(p => ({ ...p, y: G + 0.6, sx: 1, sy: 1.2 + r(), rz: (r() - 0.5) * 0.4 })));
  } else if (theme.name === 'snow') {
    inst(ROCK, mat('#ffffff', flat), spots(10, -h - 9, -h - 1, h + 6).map(p => ({ ...p, y: G + 0.1, sx: 0.5 + r() * 0.9, sy: 0.45 + r() * 0.4, ry: r() * 6 })));
    inst(new THREE.BoxGeometry(1, 1, 1), mat('#dff3ff', flat), spots(26, -h - 8, h + 1, h + 5).map(p => ({ ...p, y: G + 0.03, sx: 0.35 + r() * 0.4, sy: 0.06, sz: 0.15 + r() * 0.15, ry: r() * 6 })));
    inst(ROCK, mat('#8e8a83', flat), spots(4, -h - 8, -h - 3, h + 5).map(p => ({ ...p, y: G + 0.3, sx: 1.0 + r() * 0.8, sy: 1.1, ry: r() * 6 })));
    inst(new THREE.SphereGeometry(1, 8, 6), mat('#ff5d5d'), spots(6, -h - 6, -h - 1, h + 3).map(p => ({ ...p, y: G + 0.12, sx: 0.12 })));
  } else if (theme.name === 'beach') {
    const castles = spots(3, -h - 6, -h - 2, h + 4);
    inst(new THREE.CylinderGeometry(0.5, 0.6, 1, 10), mat('#f2d38f', flat), castles.flatMap(p => [{ ...p, y: G + 0.5, sx: 1, sy: 1 }, { x: p.x + 0.4, z: p.z + 0.2, y: G + 1.0, sx: 0.5, sy: 1 }]));
    inst(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 14), mat('#1fb5a9'), spots(2, -h - 5, -h - 1.5, h + 3).map(p => ({ ...p, y: G + 0.3, sx: 1, rz: 1.2 })));
    inst(new THREE.SphereGeometry(1, 16, 12), mat('#ff5d6c'), spots(3, -h - 7, h, h + 3).map(p => ({ ...p, y: G + 0.4, sx: 0.4 })));
    inst(new THREE.SphereGeometry(1, 8, 6), mat('#f7e0d0'), spots(20, -h - 8, h + 2, h + 6).map(p => ({ ...p, y: G + 0.02, sx: 0.12 + r() * 0.1, sy: 0.05, ry: r() * 6 })));
  } else if (theme.name === 'stone') {
    inst(ROCK, mat('#8b97a3', flat), spots(40, -h - 9, h + 2, h + 6).map(p => ({ ...p, y: G + 0.02, sx: 0.4 + r() * 0.35, sy: 0.08, ry: r() * 6 })));
    inst(ICO, mat('#5f8f3d', flat), spots(6, -h - 7, -h - 1, h + 5).map(p => ({ ...p, y: G + 0.5, sx: 0.8 + r() * 0.6, sy: 0.7 })));
    inst(new THREE.SphereGeometry(1, 10, 6, 0, 6.3, 0, 1.6), mat('#ff7a59'), spots(5, -h - 6, -h - 1, h + 4).map(p => ({ ...p, y: G + 0.3, sx: 0.25, sy: 0.15 })));
  } else {
    inst(ROCK, mat('#7a8d5e', flat), spots(6, -h - 8, -h - 1, h + 6).map(p => ({ ...p, y: G + 0.3, sx: 0.9 + r() * 0.8, sy: 0.8, ry: r() * 6 })));
    inst(new THREE.CylinderGeometry(0.04, 0.06, 1, 5), mat('#5c8a3a'), spots(24, -h - 7, -h - 1, h + 5).map(p => ({ ...p, y: G + 0.7, sx: 1, sy: 1.4 + r(), rz: (r() - 0.5) * 0.4 })));
    inst(ICO, mat('#6fb35a', flat), spots(5, -h - 6, -h - 1, h + 4).map(p => ({ ...p, y: G + 0.4, sx: 0.6, sy: 0.5 })));
  }
}

// ------------------------------------------------------------------ camera
const camLook = new THREE.Vector3();
function frameCam() {
  const asp = innerWidth / innerHeight, k = S * Math.max(1, 0.62 / asp) * 0.98;
  camera.position.set(0, k * 1.9, k * 1.5);
  camLook.set(0, 0, -k * 0.22);
  camera.lookAt(camLook);
  stage.followLight(new THREE.Vector3(0, 0, 0));
}
addEventListener('resize', () => frameCam());

// ------------------------------------------------------------------ play
function drawStrikes() { [...$('strikes').children].forEach((e, i) => { e.classList.toggle('x', i < strikes); e.textContent = i < strikes ? '✕' : ''; }); }
const free = ch => !ch.removed && ch.under.every(u => u.other.removed);
const live = () => chains.filter(c => !c.removed);
let nowT = 0;
function attempt(ch) {
  if (state !== 'play' || ch.removed) return;
  if (free(ch)) return slip(ch);
  // pinned: tug + flash the chains lying on it
  ch.tug = nowT; const blockers = ch.under.filter(u => !u.other.removed).map(u => u.other);
  for (const b of new Set(blockers)) b.flash = nowT;
  strikes++; drawStrikes(); combo = 0;
  buzz([30, 40, 30]); tone(180, 0.16, 'square', 0.09, 0.7); setTimeout(() => tone(1400, 0.05, 'triangle', 0.05, 0.9), 40);
  ui.pop(strikes >= 3 ? 'TANGLED!' : 'STUCK!', '#ff4d5e', 40, 24);
  if (strikes >= 3) { state = 'lost'; F.level(false, cleared / chains.length); setTimeout(() => sfx.fail(), 200); ui.lose('TANGLED!', `${Math.round(cleared / chains.length * 100)}% untied`); }
}
function slip(ch) {
  ch.removed = true; ch.rem = nowT; cleared++;
  combo = nowT - comboT < 1.6 ? combo + 1 : 1; comboT = nowT;
  score += 10 * combo; best = Math.max(best, score); ST.set('best', best);
  ch.fly = new THREE.Vector3(ch.c.x >= 0 ? 1 : -1, 0, -0.35 + Math.random() * 0.3).normalize();
  buzz(18);
  [0, 70, 140, 210].forEach((d, i) => setTimeout(() => tone(1500 + i * 180 + Math.random() * 200, 0.05, 'triangle', 0.07, 0.85), d));
  setTimeout(() => tone(260, 0.32, 'sawtooth', 0.045, 3.2), 230);
  const words = ['NICE!', 'SMOOTH!', 'GREAT!', 'SLICK!'];
  ui.pop(combo > 1 ? `x${combo} ${words[(combo - 1) % words.length]}` : words[Math.floor(Math.random() * words.length)], combo > 1 ? '#ff3d7f' : theme.ui, 34 + Math.min(combo, 4) * 4, 24);
  ui.progress(cleared / chains.length);
  for (const pi of [ch.a, ch.b]) burst(scene, new THREE.Vector3(pegs[pi].x, 0.6, pegs[pi].y), [ch.col, '#ffffff'], 10, { speed: 0.07, up: 0.08, size: 0.45, shape: 'sphere' });
  if (cleared === chains.length) setTimeout(win, 650);
}
function win() {
  if (state !== 'play') return;
  state = 'won'; F.level(true); spin = nowT; score += 25 * level; best = Math.max(best, score); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
  for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3((i - 1) * 2, 1.5, 0), 50), i * 150);
  ui.win(level, strikes === 0 ? 'PERFECT UNTIE!' : '');
}

// pointer picking: project link samples, nearest wins, ties go to the chain lying on top
const P = new THREE.Vector3();
function pick(cx, cy) {
  let bestC = null, bestD = 34, bestH = -1;
  for (const ch of chains) {
    if (ch.removed) continue;
    for (let k = 0; k < ch.cur.length; k++) {
      P.copy(ch.cur[k]).add(ch.g.position).sub(ch.c).applyMatrix4(world.matrixWorld).project(camera);
      const sx = (P.x + 1) / 2 * innerWidth, sy = (1 - P.y) / 2 * innerHeight, d = Math.hypot(sx - cx, sy - cy);
      if (d < bestD - 6 || (d < bestD + 6 && ch.cur[k].y > bestH + 0.05)) { bestD = Math.min(d, bestD); bestC = ch; bestH = ch.cur[k].y; }
    }
  }
  return bestC;
}
function screenOf(v) { P.copy(v).project(camera); return [(P.x + 1) / 2 * innerWidth, (1 - P.y) / 2 * innerHeight]; }
input({ onTap: e => { if (state !== 'play') return; const ch = pick(e.clientX, e.clientY); if (ch) attempt(ch); else sfx.tap(); } });

ui.onTap(which => {
  if (which === 'start') { state = 'play'; sfx.tap(); }
  else if (which === 'win') { level++; ST.set('level', level); buildLevel(); state = 'play'; }
  else if (which === 'lose') { score = 0; buildLevel(); state = 'play'; }
});

// ------------------------------------------------------------------ animate
const tmpV = new THREE.Vector3();
loop((dt, t) => {
  nowT = t;
  for (const ch of chains) {
    let dirty = false;
    if (ch.rem >= 0) {
      const u = (t - ch.rem) / 1.0;
      if (u > 1.05) { if (ch.g.parent) world.remove(ch.g); continue; }
      const lift = Math.min(1, u / 0.28), e = 1 - Math.pow(1 - lift, 3), n = ch.base.length;
      for (let k = 0; k < n; k++) {
        const endW = Math.max(0, 1 - Math.min(k, n - 1 - k) / 6);
        ch.cur[k].copy(ch.base[k]); ch.cur[k].y += e * (0.55 + 0.4 * endW) + Math.sin(k * 0.45 - u * 22) * 0.14 * (1 - lift * 0.4);
      }
      for (const rg of [ch.ringA, ch.ringB]) rg.position.y = 0.1 + e * 0.9;
      const s = Math.max(0, (u - 0.28) / 0.72);
      ch.g.position.set(ch.c.x + ch.fly.x * 14 * s * s, s * 3.5 + s * s * 2, ch.c.z + ch.fly.z * 14 * s * s);
      ch.g.rotation.z = -ch.fly.x * s * 1.6; ch.g.rotation.y = ch.fly.x * s * 0.8;
      ch.g.scale.setScalar(1 - 0.35 * s);
      dirty = true;
    } else if (ch.tug >= 0) {
      const u = (t - ch.tug) / 0.5;
      if (u >= 1) { ch.tug = -1; ch.cur.forEach((p, k) => p.copy(ch.base[k])); }
      else for (let k = 0; k < ch.base.length; k++) { ch.cur[k].copy(ch.base[k]); ch.cur[k].y += Math.max(0, Math.sin(u * Math.PI)) * 0.18 * Math.abs(Math.sin(k * 0.5 - u * 30)); }
      for (const rg of [ch.ringA, ch.ringB]) rg.position.y = 0.1 + Math.sin(Math.min(1, u) * Math.PI) * 0.22;
      dirty = true;
    }
    if (ch.flash >= 0) {
      const u = (t - ch.flash) / 0.7;
      if (u >= 1) { ch.flash = -1; ch.m.emissive.set('#000000'); }
      else { ch.m.emissive.set('#ffffff'); ch.m.emissiveIntensity = 0.55 * (0.5 + 0.5 * Math.cos(u * Math.PI * 6)) * (1 - u); }
    }
    if (botTarget === ch && state === 'play' && !ch.removed) { ch.m.emissive.set('#ffffff'); ch.m.emissiveIntensity = 0.18 + 0.12 * Math.sin(t * 20); }
    else if (ch.flash < 0 && !ch.removed) ch.m.emissive.set('#000000');
    if (dirty) writeLinks(ch, ch.cur);
  }
  // board win spin + hop
  if (state === 'won' && spin) { const u = Math.min(1, (t - spin) / 1.1), e = 1 - Math.pow(1 - u, 3); world.rotation.y = e * Math.PI * 2; world.position.y = Math.sin(u * Math.PI) * 0.6; }
  else { world.rotation.y = lerp(world.rotation.y, 0, 0.2); world.position.y = lerp(world.position.y, 0, 0.2); }
  if (state !== 'play' || !botTarget) $('finger').style.opacity = 0;
});

// ------------------------------------------------------------------ test hooks + bot
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (botTarget && (botTarget.removed || !free(botTarget))) botTarget = null;
    if (!botTarget) {
      const f = live().filter(free); if (!f.length) return;
      botTarget = f[Math.floor(Math.random() * f.length)]; botWait = 2;
      // aim at a link far from any crossing
      let k = Math.floor(botTarget.base.length / 2), bestD = -1;
      for (let i = 2; i < botTarget.base.length - 2; i++) { const d = Math.min(99, ...botTarget.over.map(o => Math.abs(o.k - i)), ...botTarget.under.map(o => Math.abs(o.k - i))); if (d > bestD) { bestD = d; k = i; } }
      const [sx, sy] = screenOf(botTarget.base[k]); botTarget.tap = [sx, sy];
      const f2 = $('finger'); f2.style.left = sx + 'px'; f2.style.top = sy + 'px'; f2.style.opacity = 1;
      return;
    }
    if (--botWait > 0) return;
    const f2 = $('finger'); f2.classList.remove('tap'); void f2.offsetWidth; f2.classList.add('tap');
    const target = botTarget; botTarget = null;
    const ch = pick(target.tap[0], target.tap[1]);
    attempt(ch && free(ch) ? ch : target);
  },
};

buildLevel();
ui.start();
// debug helper for QA scripts: screen position of a chain that is currently pinned under another
window.__dbgPinned = () => { const c = chains.find(c => !c.removed && !free(c)); if (!c) return null; let k = Math.floor(c.base.length / 2), bd = -1; for (let i = 2; i < c.base.length - 2; i++) { const d = Math.min(99, ...c.over.map(o => Math.abs(o.k - i)), ...c.under.map(o => Math.abs(o.k - i))); if (d > bd) { bd = d; k = i; } } return screenOf(c.base[k]); };

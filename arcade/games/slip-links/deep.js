// Slip Links v2 (deep) — original game. Chains are knotted over a board of pegs; tap the chain lying on top to slip it free.
import { THREE, createStage, createUI, input, loop, mat, rounded, sfx, tone, buzz, burst, confetti, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS } from './levels.js';

const ST = store('sliplinks2');
const F = flow('sliplinks');
const WB = worldBoard({ game: 'slip-links', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });
let level = Math.min(ST.get('level', 1), 999), best = ST.get('best', 0), score = 0;
{ const q = +new URLSearchParams(location.search).get('level'); if (q > 0) level = q; }
const STARS = ST.get('stars', {});            // level -> best stars (1-3)
let golds = ST.get('golds', 0), chests = ST.get('chests', 0), paint = ST.get('paint', 0);
const NL = LEVELS.length;
const totalStars = () => Object.values(STARS).reduce((a, b) => a + b, 0) + golds;
const CHEST_EVERY = 8;
// daily knot: one generated board per day for everyone, plus a day streak (the tomorrow hook)
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayIdx = () => Math.floor(Date.now() / 864e5);
let dailyMode = false;
const DAILY = ST.get('daily', { last: 0, streak: 0, done: 0 });
(function () { const t = dayIdx(); if (DAILY.last !== t) { DAILY.streak = DAILY.last === t - 1 ? DAILY.streak + 1 : 1; DAILY.last = t; DAILY.done = 0; ST.set('daily', DAILY); } })();
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
const PAINTS = [
  { name: 'Classic', cols: ['#2f6fe0', '#2fc46e', '#ffc61a', '#ff7a1a', '#9b4dff', '#ff4fa3', '#14c4c4', '#8a5a2b', '#e83a3a'] },
  { name: 'Candy', cols: ['#ff6fb5', '#7be0ff', '#ffe066', '#b69cff', '#7dffb0', '#ff9a6f', '#ff5c8a', '#6fd0ff', '#d9ff6f'] },
  { name: 'Ocean', cols: ['#0b6fa4', '#16a5c9', '#5fd4d6', '#0d3f73', '#7fe3c0', '#2a8fd6', '#3fc1a5', '#a0e7ff', '#1b5e7a'] },
  { name: 'Ember', cols: ['#ff5a2a', '#ffb02a', '#d92b2b', '#ff7f50', '#ffd35a', '#b3261e', '#ff8a3d', '#e8553a', '#ffcf5c'] },
  { name: 'Forest', cols: ['#2f8f4e', '#7bc043', '#1f6f5c', '#a3d977', '#3da35d', '#5b8c2a', '#2bb08a', '#8ac926', '#4c9f70'] },
  { name: 'Night', cols: ['#7b6bff', '#ff5fd2', '#35e0ff', '#a259ff', '#ff7a7a', '#5affb0', '#ffe14a', '#4d7cff', '#ff8ad8'] },
  { name: 'Mono', cols: ['#e8e8f0', '#9aa0b8', '#5b6178', '#c9cfe6', '#2f3447', '#b6bdd8', '#7d84a0', '#f4f4fb', '#454b63'] },
  { name: 'Rainbow', cols: ['#ff3b3b', '#ff9f1a', '#ffe11a', '#3bd45a', '#1ab3ff', '#6c4dff', '#d94dff', '#ff4fa3', '#14d4c4'] },
];
const unlockedPaints = () => Math.min(PAINTS.length, 1 + chests);
const chainCols = () => PAINTS[Math.min(paint, unlockedPaints() - 1)].cols;

// ------------------------------------------------------------------ shared geometry
const LINK_GEO = new THREE.TorusGeometry(0.11, 0.043, 6, 14);
const RING_GEO = new THREE.TorusGeometry(0.2, 0.09, 10, 22); RING_GEO.rotateX(Math.PI / 2);
const SPACING = 0.17, BASE_Y = 0.15;

const world = new THREE.Group(); scene.add(world);
const boardG = new THREE.Group(); world.add(boardG);
let theme, chains = [], pegs = [], S = 6, state = 'ready', strikes = 0, cleared = 0, comboT = 0, combo = 0, spin = 0, busyT = 0;
let botTarget = null, botWait = 0, lv = null, sparkTime = 9, goldHere = false;
const PCOLS = () => chainCols();

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
  const big = n > 8, cols = big ? 5 : n > 4 ? 4 : 3, rows = cols, gap = big ? 1.5 : n > 4 ? 1.75 : 2.1, out = [];
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
// authored level (levels.js): replay the stored control points, heights and pegs
function fromData(L) {
  const grid = pegGrid(L.n); S = grid.size;
  const half = S / 2 - 0.35, off = v2(L.off[0], L.off[1]);
  const cs = L.ch.map(c => ({ a: c.a, b: c.b, wrap: c.w, rank: c.k, pts: samplePath(c.c.map(q => v2(q[0], q[1])), half) }));
  grid.pts.forEach(p => p.add(off)); cs.forEach(c => c.pts.forEach(p => p.add(off)));
  return { grid, cs, show: new Set(L.show) };
}
function generate() {
  if (!dailyMode && level <= NL) return fromData(LEVELS[level - 1]);
  return genProc(dailyMode ? dayNum() : level + 40, dailyMode ? 6 : Math.min(10, 7 + Math.floor((level - NL) / 4)), dailyMode ? 0.35 : 0.45);
}
function genProc(seed, n, wrapP) {
  const r = rng(seed * 7919 + 13), fk = dailyMode ? 1 : F.k();
  const level = 12;   // wrap/crossing curve of a mid-late board
  const grid = pegGrid(n); S = grid.size;
  const half = S / 2 - 0.35;
  let bestC = null, bestScore = -1e9;
  for (let attempt = 0; attempt < 70; attempt++) {
    const idx = grid.pts.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const ends = idx.slice(0, n * 2), used = new Set(ends);
    const cs = [];
    for (let c = 0; c < n; c++) {
      const A = grid.pts[ends[c * 2]], B = grid.pts[ends[c * 2 + 1]];
      const allowWrap = r() < Math.min(0.58, wrapP * fk);
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
  const wi = dailyMode ? -1 : WORLDS.findIndex(w => level >= w.from && level <= w.to);
  theme = wi >= 0 ? THEMES.find(t => t.name === WORLDS[wi].theme) : THEMES[(dailyMode ? dayNum() : level) % THEMES.length];
  lv = !dailyMode && level <= NL ? LEVELS[level - 1] : null;
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
    const col = chainCols()[(i + level) % 9];
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
    ch.mesh = new THREE.InstancedMesh(LINK_GEO, ch.m, ch.base.length); ch.mesh.castShadow = false; ch.mesh.receiveShadow = true;
    ch.ringA = new THREE.Mesh(RING_GEO, ch.m); ch.ringB = new THREE.Mesh(RING_GEO, ch.m);
    for (const [rg, pi] of [[ch.ringA, ch.a], [ch.ringB, ch.b]]) { rg.position.set(pegs[pi].x - ch.c.x, 0.1, pegs[pi].y - ch.c.z); rg.castShadow = true; rg.userData.peg = pi; }
    ch.g.add(ch.mesh, ch.ringA, ch.ringB); world.add(ch.g);
    ch.cur = ch.base.map(p => p.clone());
    writeLinks(ch, ch.cur);
  }
  // elements: padlock (lockN clears first), gold chain (bonus), sparker (burns out when free too long)
  const el = lv ? lv.el : procEl();
  chains.forEach((ch, i) => {
    ch.lockN = (el.lock && el.lock[i]) || 0; ch.gold = el.gold === i; ch.spark = !!(el.spark && el.spark.includes(i)); ch.sparkT = -1;
    if (ch.gold) { ch.m.color.set('#ffc61a'); ch.m.metalness = 0.55; ch.m.roughness = 0.2; ch.col = '#ffc61a'; }
  });
  goldHere = chains.some(c => c.gold) && !(ST.get('goldlv', {})[level] && !dailyMode);
  sparkTime = Math.max(5.5, 10.5 - Math.max(0, level - 21) * 0.5);
  buildTags();
  buildProps();
  strikes = 0; cleared = 0; combo = 0; maxCombo = 0; startT = nowT; spin = 0; botTarget = null; world.rotation.y = 0; world.position.y = 0;
  drawStrikes(); ui.levels(level); ui.progress(0);
  frameCam();
}

function procEl() {   // generated boards (daily, after level 30): pick elements from the unlocked set by depth
  const n = chains.length, r = rng((dailyMode ? dayNum() : level) * 131 + 7), el = {};
  const need = c => { const seen = new Set(); const walk = j => { for (const u of j.under) if (!seen.has(u.other)) { seen.add(u.other); walk(u.other); } }; walk(c); return seen.size; };
  const byRank = [...chains].sort((a, b) => a.rank - b.rank), idx = c => chains.indexOf(c);
  const freeNow = byRank.filter(c => c.under.length === 0), deep = byRank.filter(c => c.under.length > 0);
  if (r() < 0.8) { el.lock = {}; const c = freeNow[freeNow.length - 1]; el.lock[idx(c)] = Math.min(n - 1, 2); if (deep.length > 2 && r() < 0.5) { const d = deep[Math.floor(r() * deep.length)]; el.lock[idx(d)] = Math.min(n - 1, need(d) + 1); } }
  const bottom = [...byRank].reverse().find(c => !(el.lock && el.lock[idx(c)]));
  if (bottom && r() < 0.7) el.gold = idx(bottom);
  if (r() < 0.7) { const c = deep.filter(c => idx(c) !== el.gold && !(el.lock && el.lock[idx(c)])); if (c.length) el.spark = [idx(c[Math.floor(r() * c.length)])]; }
  // winnability: greedy removal must clear every chain (a lock needs N others gone first); drop locks until it does
  const solvable = () => {
    const gone = new Set(); let cnt = 0, moved = true;
    while (moved && gone.size < n) { moved = false;
      for (const c of chains) { if (gone.has(c)) continue; const lk = (el.lock && el.lock[idx(c)]) || 0;
        if (lk > cnt || c.under.some(u => !gone.has(u.other))) continue; gone.add(c); cnt++; moved = true; } }
    return gone.size === n;
  };
  while (el.lock && !solvable()) { const k = Object.keys(el.lock); if (!k.length) { delete el.lock; break; } delete el.lock[k[k.length - 1]]; if (!Object.keys(el.lock).length) delete el.lock; }
  if (!solvable()) delete el.lock;
  return el;
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
function drawStrikes() { [...$('strikes').children].forEach((e, i) => { e.classList.toggle('x', i < strikes); e.textContent = i < strikes ? '✕' : ''; }); $('strikes').style.opacity = safeLevel() ? 0.25 : 1; }
const safeLevel = () => !dailyMode && level <= 2;
const pinned = ch => !ch.removed && ch.under.some(u => !u.other.removed);
const live = () => chains.filter(c => !c.removed);
const locked = ch => !ch.removed && ch.lockN > cleared;
const free = ch => !ch.removed && !pinned(ch) && !locked(ch);
let nowT = 0, tags = [];
// tags over chains: padlock count, spark timer, gold star
const tagBox = document.createElement('div'); tagBox.id = 'tags'; document.body.appendChild(tagBox);
function buildTags() {
  tagBox.textContent = ''; tags = [];
  chains.forEach(ch => {
    if (!ch.lockN && !ch.spark && !ch.gold) return;
    const d = document.createElement('div'); d.className = 'tag'; tagBox.appendChild(d); ch.tag = d; tags.push(ch);
  });
}
function updateTags() {
  for (const ch of tags) {
    const d = ch.tag; if (ch.removed) { d.style.display = 'none'; continue; }
    const k = Math.floor(ch.cur.length * (ch.spark ? 0.5 : 0.5));
    P.copy(ch.cur[k]).add(ch.g.position).sub(ch.c).applyMatrix4(world.matrixWorld).project(camera);
    const left = ch.lockN - cleared; let t = '', cls = 'tag';
    if (left > 0) { t = '🔒' + left; cls += ' lock'; }
    else if (ch.spark) { t = ch.sparkT >= 0 ? '🔥' + Math.max(0, Math.ceil(sparkTime - (nowT - ch.sparkT))) : '🔥'; cls += ' spark' + (ch.sparkT >= 0 ? ' lit' : ''); }
    else if (ch.gold) { t = '⭐'; cls += ' gold'; }
    if (ch.spark && left <= 0 && ch.gold) t = '⭐' + t;
    if (d.dataset.t !== t) { d.textContent = t; d.dataset.t = t; }
    if (d.className !== cls) d.className = cls;
    d.style.display = '';
    d.style.transform = `translate(${(P.x + 1) / 2 * innerWidth}px,${(1 - P.y) / 2 * innerHeight - 22}px) translate(-50%,-50%)`;
  }
}
function attempt(ch) {
  if (state !== 'play' || ch.removed) return;
  if (free(ch)) return slip(ch);
  const isLock = locked(ch) && !pinned(ch);
  ch.tug = nowT; const blockers = ch.under.filter(u => !u.other.removed).map(u => u.other);
  for (const b of new Set(blockers)) b.flash = nowT;
  if (isLock) ch.flash = nowT;
  if (!safeLevel()) { strikes++; drawStrikes(); }
  combo = 0;
  buzz([30, 40, 30]); tone(180, 0.16, 'square', 0.09, 0.7); setTimeout(() => tone(1400, 0.05, 'triangle', 0.05, 0.9), 40);
  const left = strikes >= 3;
  ui.pop(left ? 'TANGLED!' : isLock ? `LOCKED! ${ch.lockN - cleared} more` : (safeLevel() ? 'THAT ONE IS UNDER!' : 'STUCK!'), '#ff4d5e', 40, 24);
  if (!left) setTimeout(() => { if (state !== 'play') return; const f = live().filter(free); if (f.length) { f[0].flash = nowT; hintedT = nowT; } }, 450);   // light a chain you could have taken
  if (left) lose('TANGLED!');
}
function lose(title, why) {
  state = 'lost'; F.level(false, cleared / chains.length); setTimeout(() => sfx.fail(), 200);
  const left = chains.length - cleared, tomorrow = tomorrowLine();
  ui.lose(title, (left === 1 ? 'SO CLOSE: 1 chain left!' : `${left} chains left`) + (why ? '\n' + why : ''));
}
function burn(ch) {   // a sparker ran out: it costs a heart and drops away
  if (state !== 'play' || ch.removed) return;
  ch.removed = true; ch.rem = nowT; cleared++; ch.fly = new THREE.Vector3(0, 0, 1);
  strikes++; drawStrikes(); combo = 0;
  buzz([40, 40, 40]); tone(150, 0.3, 'sawtooth', 0.1, 0.5);
  ui.pop('BURNED!', '#ff7a1a', 42, 24);
  burst(scene, new THREE.Vector3(ch.c.x, 0.6, ch.c.z), ['#ff7a1a', '#ffd35a'], 22, { speed: 0.09, up: 0.12, size: 0.5, shape: 'sphere' });
  ui.progress(cleared / chains.length);
  if (strikes >= 3) lose('TANGLED!', 'a sparker burned out');
  else if (cleared === chains.length) setTimeout(win, 650);
}
function slip(ch) {
  ch.removed = true; ch.rem = nowT; cleared++;
  combo = nowT - comboT < 1.6 ? combo + 1 : 1; comboT = nowT; maxCombo = Math.max(maxCombo, combo);
  score += 10 * combo * (ch.gold ? 3 : 1); best = Math.max(best, score); ST.set('best', best);
  ch.fly = new THREE.Vector3(ch.c.x >= 0 ? 1 : -1, 0, -0.35 + Math.random() * 0.3).normalize();
  buzz(combo > 3 ? [14, 20, 14] : 18);
  const up = Math.min(combo - 1, 9) * 140;     // the whole arpeggio climbs with the streak
  [0, 70, 140, 210].forEach((d, i) => setTimeout(() => tone(1500 + up + i * 180 + Math.random() * 120, 0.05, 'triangle', 0.07, 0.85), d));
  setTimeout(() => tone(260 + Math.min(combo, 8) * 40, 0.32, 'sawtooth', 0.045, 3.2), 230);
  if (combo === 6 || combo === 10 || combo === 14) {   // FEVER: a bigger beat every few links
    ui.pop(combo === 6 ? '🔥 FEVER!' : combo === 10 ? '🔥 SUPER FEVER!' : '🔥 MEGA FEVER!', '#ffb21a', 58, 30); ui.flash(0.5); shake = 0.7;
    confetti(scene, new THREE.Vector3(0, 1.8, 0), Math.min(45, 24 + combo * 2));
    [0, 90, 180, 270, 360].forEach((d, i) => setTimeout(() => tone(700 + i * 220 + combo * 20, 0.12, 'square', 0.05, 1.1), d));
  }
  lastTapT = nowT;
  if (combo >= 5) { tone(880 + combo * 60, 0.25, 'square', 0.04, 1.4); ui.flash(0.25); }
  const words = ['NICE!', 'SMOOTH!', 'GREAT!', 'SLICK!'], big = ['UNSTOPPABLE!', 'ON FIRE!', 'LEGEND!'];
  ui.pop(combo >= 5 ? `x${combo} ${big[combo % 3]}` : combo > 1 ? `x${combo} ${words[(combo - 1) % words.length]}` : words[Math.floor(Math.random() * words.length)], combo > 1 ? '#ff3d7f' : theme.ui, 34 + Math.min(combo, 6) * 5, 24);
  ui.progress(cleared / chains.length);
  for (const pi of [ch.a, ch.b]) burst(scene, new THREE.Vector3(pegs[pi].x, 0.6, pegs[pi].y), [ch.col, '#ffffff'], 10 + Math.min(combo, 6) * 3, { speed: 0.07, up: 0.08, size: 0.45, shape: 'sphere' });
  shake = Math.min(0.5, 0.1 + combo * 0.05);
  if (ch.gold) {
    ui.pop('⭐ GOLD CHAIN!', '#ffc61a', 46, 20); sfx.win(); confetti(scene, new THREE.Vector3(ch.c.x, 1.5, ch.c.z), 36);
    if (goldHere) { goldHere = false; goldGot = true; }
  }
  if (cleared === chains.length) setTimeout(win, 650);
}
let lastTapT = 0, hintedT = 0, shake = 0, goldGot = false, maxCombo = 0, startT = 0;
function tomorrowLine() {
  const t = dailyMode || DAILY.done ? `Tomorrow: a new Daily Knot · day ${DAILY.streak + 1}` : `Today: the Daily Knot waits on the map`;
  return t;
}
function win() {
  if (state !== 'play') return;
  state = 'won'; F.level(true); WB.submit(1); spin = nowT; score += 25 * level; best = Math.max(best, score); ST.set('best', best);
  // stars = skill: 3 needs no strike AND a fast clear (par grows with chains, tighter in later worlds); 2 = clean but slow, or one strike
  const took = nowT - startT, par = chains.length * (level <= 10 ? 1.6 : level <= 20 ? 1.35 : 1.15) + 2.5;
  const fast = took <= par;
  const stars = strikes === 0 ? (fast ? 3 : 2) : strikes === 1 ? 2 : 1;
  const before = totalStars(), prev = STARS[level] || 0;
  let line = '⭐'.repeat(stars) + (stars === 3 ? ' PERFECT' : strikes === 0 ? ` · ${took.toFixed(0)}s, beat ${par.toFixed(0)}s for 3` : '') + `\nbest streak x${maxCombo}`;
  if (dailyMode) {
    if (!DAILY.done) { DAILY.done = 1; ST.set('daily', DAILY); golds += 2; ST.set('golds', golds); line += '\nDAILY KNOT +2'; }
  } else {
    if (stars > prev) { STARS[level] = stars; ST.set('stars', STARS); }
    if (goldGot) { const g = ST.get('goldlv', {}); g[level] = 1; ST.set('goldlv', g); golds++; ST.set('golds', golds); line += ' + GOLD'; }
    ST.set('reach', Math.max(ST.get('reach', 1), level + 1));
  }
  const after = totalStars(), nb = Math.floor(before / CHEST_EVERY), na = Math.floor(after / CHEST_EVERY);
  if (na > nb) { chests += na - nb; ST.set('chests', chests); paint = Math.min(chests, PAINTS.length - 1); ST.set('paint', paint); chestOpen = PAINTS[Math.min(chests, PAINTS.length - 1)].name; }
  const toChest = CHEST_EVERY - (after % CHEST_EVERY);
  line += chestOpen ? `\n🎁 NEW PAINT: ${chestOpen}!` : `\n${toChest} ⭐ to the next chest`;
  line += '\n' + tomorrowLine();
  if (chestOpen) { const nm = chestOpen; setTimeout(() => { ui.pop('🎁 ' + nm.toUpperCase() + '!', '#ffc61a', 52, 30); ui.flash(0.8); buzz([30, 50, 30, 50, 60]); for (let i = 0; i < 6; i++) setTimeout(() => { confetti(scene, new THREE.Vector3((Math.random() - 0.5) * 4, 1.5, 0), 60); tone(500 + i * 120, 0.18, 'triangle', 0.05, 1.5); }, i * 120); }, 500); }
  chestOpen = '';
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
  for (let i = 0; i < 3 + stars; i++) setTimeout(() => confetti(scene, new THREE.Vector3((i - 1.5) * 1.6, 1.5, 0), 50), i * 150);
  ui.win(dailyMode ? 'D' : level, line);
  refreshHud();
}
let chestOpen = '';

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

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// a chain lying on top slips free and flies off (twice when the board is big enough), so the screen shows which chains a tap frees
demo(n => {
  const f = live().filter(free); if (!f.length || live().length < (n === 1 ? 3 : 6)) return false;
  slip(f[Math.floor(f.length / 2)]);
}, { ready: () => state === 'play' && level === 1 && !strikes, wait: 1800, every: 1500, max: 2 });

ui.onTap(which => { WB.start();
  if (which === 'start') { state = 'play'; sfx.tap(); intro(); }
  else if (which === 'win') { if (dailyMode) dailyMode = false; else { level++; ST.set('level', level); } buildLevel(); state = 'play'; intro(); }
  else if (which === 'lose') { score = 0; buildLevel(); state = 'play'; intro(); }
});
// the first level of each new idea says it once, wordless where possible
const INTRO = { 1: ['Tap the chain on top', 0], 3: ['Read the heights', 0], 5: ['Chains can wrap a peg', 0], 11: ['🔒 opens after that many clears', 0], 16: ['⭐ Gold chain: bonus', 0], 21: ['🔥 Slip it before it burns', 0] };
function intro() {
  const t = !dailyMode && INTRO[level]; if (!t) return ui.sub(dailyMode ? 'DAILY KNOT' : '');
  ui.sub(t[0]); setTimeout(() => { if (ui.els.sub.textContent === t[0]) ui.sub(''); }, 4500);
}
// ---- HUD chip + map
const hudEl = document.createElement('div'); hudEl.id = 'hud2';
hudEl.innerHTML = '<button id="mapbtn" type="button">🗺️</button><div id="chip"><i></i><span></span></div>';
document.body.appendChild(hudEl);
const mapEl = document.createElement('div'); mapEl.id = 'map'; mapEl.className = 'hidden'; document.body.appendChild(mapEl);
for (const e of [hudEl, mapEl]) for (const ev of ['pointerdown', 'pointerup']) e.addEventListener(ev, x => x.stopPropagation());
function refreshHud() {
  const t = totalStars(), into = t % CHEST_EVERY;
  hudEl.querySelector('i').style.width = into / CHEST_EVERY * 100 + '%';
  hudEl.querySelector('span').textContent = '⭐ ' + t + ' · 🎁 ' + (CHEST_EVERY - into);
}
let mapWorld = 0, mapPrev = 'play';
function openMap() {
  if (state === 'map') return;
  mapPrev = state; state = 'map'; ui.hideStart(); mapWorld = Math.max(0, WORLDS.findIndex(w => level >= w.from && level <= w.to)); drawMap(); mapEl.classList.remove('hidden');
}
function closeMap(go) {
  mapEl.classList.add('hidden');
  if (go) { state = 'play'; buildLevel(); intro(); WB.start(); sfx.tap(); }
  else { state = mapPrev === 'ready' ? 'ready' : mapPrev; if (state === 'ready') ui.start(); }
}
function drawMap() {
  const reach = ST.get('reach', 1), w = WORLDS[mapWorld], t = totalStars(), into = t % CHEST_EVERY;
  let h = `<div class="mp-top"><b>⭐ ${t}</b><div class="mp-bar"><i style="width:${into / CHEST_EVERY * 100}%"></i></div><span>🎁 ${CHEST_EVERY - into}</span><button data-x>❌</button></div>`;
  h += '<div class="mp-tabs">' + WORLDS.map((x, i) => `<button data-w="${i}" class="${i === mapWorld ? 'on' : ''}">${x.name}</button>`).join('') + '</div><div class="mp-grid">';
  for (let n = w.from; n <= w.to; n++) {
    const st = STARS[n] || 0, lockd = n > reach, cur = n === reach;
    h += `<button data-l="${n}" class="nd ${lockd ? 'lk' : ''} ${cur ? 'cur' : ''} ${LEVELS[n - 1].boss ? 'boss' : ''}"><b>${lockd ? '🔒' : LEVELS[n - 1].boss ? '👑' : n}</b><u>${'⭐'.repeat(st) || '·'}</u></button>`;
  }
  h += '</div>';
  const un = unlockedPaints();
  h += '<div class="mp-paints">' + PAINTS.map((p, i) => `<button data-p="${i}" class="pt ${i >= un ? 'lk' : ''} ${i === Math.min(paint, un - 1) ? 'on' : ''}" title="${p.name}">${p.cols.slice(0, 3).map(c => `<s style="background:${i >= un ? '#aaa' : c}"></s>`).join('')}</button>`).join('') + '</div>';
  const dOpen = reach >= 4;
  h += `<button class="mp-daily ${dOpen ? '' : 'lk'}" data-d>${dOpen ? (DAILY.done ? '✓ Daily Knot done · day ' + DAILY.streak : '🔥 Daily Knot · +2 ⭐ · day ' + DAILY.streak) : '🔒 Daily Knot after level 3'}</button>`;
  mapEl.innerHTML = h;
}
mapEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.x !== undefined) return closeMap(false);
  if (b.dataset.w) { mapWorld = +b.dataset.w; return drawMap(); }
  if (b.dataset.p) { const i = +b.dataset.p; if (i < unlockedPaints()) { paint = i; ST.set('paint', i); drawMap(); } return; }
  if (b.dataset.d !== undefined) { if (ST.get('reach', 1) < 4) return; dailyMode = true; return closeMap(true); }
  if (b.dataset.l) { const n = +b.dataset.l; if (n > ST.get('reach', 1)) return; dailyMode = false; level = n; ST.set('level', n); closeMap(true); }
});
$('mapbtn').addEventListener('click', () => { if (state === 'ready' || state === 'play') openMap(); });
refreshHud();

// ------------------------------------------------------------------ animate
const tmpV = new THREE.Vector3();
loop((dt, t) => {
  nowT = t;
  if (state === 'play' && t - Math.max(lastTapT, startT, hintedT) > 7 && !botTarget) {   // idle hint: pulse a free chain
    hintedT = t; const f = live().filter(free); if (f.length) f[Math.floor(Math.random() * f.length)].flash = t;
  }
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
  for (const ch of chains) {   // sparkers: the fuse starts when the chain is free, burns out after sparkTime
    if (!ch.spark || ch.removed) continue;
    if (state !== 'play' || !free(ch)) { ch.sparkT = -1; continue; }
    if (ch.sparkT < 0) { ch.sparkT = t; tone(900, 0.08, 'square', 0.04, 1.2); }
    const left = sparkTime - (t - ch.sparkT);
    ch.m.emissive.set('#ff5a1a'); ch.m.emissiveIntensity = left < 3 ? 0.5 + 0.5 * Math.sin(t * 24) : 0.25 + 0.15 * Math.sin(t * 9);
    if (left <= 0) burn(ch);
  }
  updateTags();
  if (shake > 0.002) { world.position.x = (Math.random() - 0.5) * shake; shake *= 0.84; } else world.position.x = 0;
  if (state === 'won' && spin) { const u = Math.min(1, (t - spin) / 1.1), e = 1 - Math.pow(1 - u, 3); world.rotation.y = e * Math.PI * 2; world.position.y = Math.sin(u * Math.PI) * 0.6; }
  else { world.rotation.y = lerp(world.rotation.y, 0, 0.2); world.position.y = lerp(world.position.y, 0, 0.2); }
  if (state !== 'play' || !botTarget) $('finger').style.opacity = 0;
});

// ------------------------------------------------------------------ test hooks + bot
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get strikes() { return strikes; }, get cleared() { return cleared; }, get n() { return chains.length; }, get stars() { return STARS; },
  bot() {
    if (state !== 'play') return;
    if (botTarget && (botTarget.removed || !free(botTarget))) botTarget = null;
    if (!botTarget) {
      const f = live().filter(free); if (!f.length) return;
      const sp = f.filter(c => c.spark); botTarget = (sp.length ? sp : f)[Math.floor(Math.random() * (sp.length || f.length))]; botWait = 2;
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

// start card: where you are + the streak (the tomorrow hook)
{ const p = document.createElement('p'); p.style.cssText = 'margin:6px 0;font-weight:800;opacity:.85'; p.textContent = `Level ${Math.min(level, 999)} · ⭐ ${totalStars()}` + (DAILY.streak > 1 ? ` · 🔥 ${DAILY.streak}-day streak` : ''); ui.els.start.querySelector('h1').after(p); }
intro();

// Match-3 board: rules (runs of 3+, 2×2 squares, rockets, bombs, propellers, disco balls, combos, crates, ice),
// gravity with diagonal slides, cascades, shuffles, a hint, a bot, and instanced rendering of the AI 3D pieces.
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';

const PIECE = 0.9, COLORS_HEX = ['#ff4d6d', '#3aa8ff', '#ffc93c', '#3fcf6e', '#b05cff', '#ff8a2a'];
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export function createMatch3({ group, P, snd, hooks }) {
  // P: { colors:[{geo,mat}×6], rocket, bomb, prop, disco, crate, ice }
  const root = new THREE.Group(); group.add(root);
  let W = 8, H = 8, mask = [], crate = [], ice = [], cells = [], L = null;
  let pieces = [], dying = [], uid = 1, busy = false, moves = 0, movesStart = 0, goals = [], score = 0, chain = 0, over = true, sel = null, idleT = 0, hint = null, swapCells = null;
  const queue = [];
  const lx = x => x - (W - 1) / 2, ly = y => (H - 1) / 2 - y;
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y][x];

  // ------------------------------------------------------------ instanced meshes
  const MAXP = 96, tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const mkI = (geo, mat, n = MAXP) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; root.add(m); return m; };
  // pieces are clipped at the board's top edge so new ones slide in from behind the frame
  const clip = new THREE.Plane(), clipM = m => { const c = m.clone(); c.clippingPlanes = [clip]; return c; };
  const IC = P.colors.map(p => mkI(p.geo, clipM(p.mat)));
  const IB = { rh: null, rv: mkI(P.rocket.geo, clipM(P.rocket.mat), 40), bomb: mkI(P.bomb.geo, clipM(P.bomb.mat), 40), prop: mkI(P.prop.geo, clipM(P.prop.mat), 40), disco: mkI(P.disco.geo, clipM(P.disco.mat), 20) };
  IB.rh = IB.rv;
  const ICr = mkI(P.crate.geo, P.crate.mat.clone(), 80);
  const iceMat = P.ice.mat.clone(); iceMat.transparent = true; iceMat.opacity = 0.62; iceMat.depthWrite = false; iceMat.roughness = 0.08; iceMat.metalness = 0.05;
  const II = mkI(P.ice.geo, iceMat, 80); II.renderOrder = 2;
  // tiles + frame
  const tileGeo = new RoundedBoxGeometry(0.96, 0.96, 0.14, 2, 0.08), tileMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
  const IT = mkI(tileGeo, tileMat, 100); IT.receiveShadow = true;
  const frameGeo = new RoundedBoxGeometry(1.2, 1.2, 0.2, 3, 0.12), frameMat = new THREE.MeshStandardMaterial({ color: '#7a4fb8', roughness: 0.35, metalness: 0.1 });
  const IF = mkI(frameGeo, frameMat, 100);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#ffd77a', roughness: 0.25, metalness: 0.6 });
  const IR = mkI(new RoundedBoxGeometry(1.32, 1.32, 0.12, 3, 0.14), rimMat, 100);
  // blob shadows
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(60,30,60,.45)'); g.addColorStop(1, 'rgba(60,30,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const IS = mkI(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }), MAXP);
  // particles
  const PMAX = 900, parts = [];
  const pGeo = new THREE.OctahedronGeometry(0.09, 0);
  const IP = mkI(pGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), PMAX); IP.renderOrder = 3;
  IP.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3);
  // rings (bomb flash), zap lines (disco), flying rockets / propellers
  const rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); m.visible = false; m.position.z = 0.9; root.add(m); return { m, t: 1 }; });
  const zapGeo = new THREE.BufferGeometry(); zapGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
  const zap = new THREE.LineSegments(zapGeo, new THREE.LineBasicMaterial({ color: '#fff7a8', transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })); zap.frustumCulled = false; root.add(zap); zap.visible = false;
  const flyers = [];
  const flyMesh = (p) => { const m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(PIECE); root.add(m); return m; };
  const flyPool = { r: [], p: [] };
  function getFly(kind) { const pool = flyPool[kind]; let m = pool.find(m => !m.visible); if (!m) { m = flyMesh(kind === 'r' ? P.rocket : P.prop); pool.push(m); } m.visible = true; return m; }

  function spark(x, y, color, n = 10, { speed = 3, up = 0, size = 1, life = 0.6, z = 0.6, grav = 6 } = {}) {
    for (let i = 0; i < n && parts.length < PMAX; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s + up, vz: Math.random() * 2, life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(Array.isArray(color) ? color[i % color.length] : color), r: Math.random() * 6, g: grav });
    }
  }
  function ring(x, y, size = 2.5, color = '#fff4c2') { const r = rings.find(r => r.t >= 1) || rings[0]; r.t = 0; r.size = size; r.m.position.x = x; r.m.position.y = y; r.m.material.color.set(color); r.m.visible = true; }
  let zapT = 0;
  function zapLines(x0, y0, targets) {
    const a = zapGeo.attributes.position.array; let i = 0;
    for (const [x, y] of targets.slice(0, 64)) { a[i++] = lx(x0); a[i++] = ly(y0); a[i++] = 0.8; a[i++] = lx(x); a[i++] = ly(y); a[i++] = 0.8; }
    zapGeo.setDrawRange(0, i / 3); zapGeo.attributes.position.needsUpdate = true; zap.visible = true; zapT = 0.45;
  }

  // ------------------------------------------------------------ pieces
  function mk(t, x, y, b = null) { const p = { id: uid++, t, b, gx: x, gy: y, x: lx(x), y: ly(y), vy: 0, s: 1, land: 0, born: 0, tw: null, wob: Math.random() * 6 }; pieces.push(p); return p; }
  const at = (x, y) => inB(x, y) ? cells[y][x] : null;
  const colorAt = (x, y) => { const p = at(x, y); return p && !p.b && !crate[y][x] ? p.t : -1; };
  const movable = (x, y) => { const p = at(x, y); return p && !ice[y][x] && !crate[y][x]; };
  const swappable = movable;

  function fillNoMatch(r) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y][x] || crate[y][x]) { cells[y][x] = null; continue; }
      let t, tries = 0;
      do { t = (r() * L.colors) | 0; tries++; } while (tries < 30 && ((x >= 2 && colorAt(x - 1, y) === t && colorAt(x - 2, y) === t) || (y >= 2 && colorAt(x, y - 1) === t && colorAt(x, y - 2) === t) ||
        (x >= 1 && y >= 1 && colorAt(x - 1, y) === t && colorAt(x, y - 1) === t && colorAt(x - 1, y - 1) === t)));
      const p = mk(t, x, y); cells[y][x] = p; p.y += H + 2 + y * 0.3; p.born = 0;
    }
  }

  // ------------------------------------------------------------ matching
  function findGroups() {
    const runs = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W;) { const c = colorAt(x, y); let n = 1; while (c >= 0 && colorAt(x + n, y) === c) n++; if (c >= 0 && n >= 3) runs.push({ d: 'h', n, cells: Array.from({ length: n }, (_, i) => [x + i, y]), c }); x += n; }
    for (let x = 0; x < W; x++) for (let y = 0; y < H;) { const c = colorAt(x, y); let n = 1; while (c >= 0 && colorAt(x, y + n) === c) n++; if (c >= 0 && n >= 3) runs.push({ d: 'v', n, cells: Array.from({ length: n }, (_, i) => [x, y + i]), c }); y += n; }
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const c = colorAt(x, y); if (c >= 0 && colorAt(x + 1, y) === c && colorAt(x, y + 1) === c && colorAt(x + 1, y + 1) === c) runs.push({ d: 's', n: 4, cells: [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], c }); }
    if (!runs.length) return [];
    // union runs that share a cell
    const par = runs.map((_, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i]));
    const owner = new Map();
    runs.forEach((r, i) => r.cells.forEach(([x, y]) => { const k = y * 32 + x; if (owner.has(k)) par[f(i)] = f(owner.get(k)); else owner.set(k, i); }));
    const gm = new Map();
    runs.forEach((r, i) => { const k = f(i); if (!gm.has(k)) gm.set(k, { runs: [], cells: new Map(), c: r.c }); const g = gm.get(k); g.runs.push(r); r.cells.forEach(([x, y]) => g.cells.set(y * 32 + x, [x, y])); });
    return [...gm.values()].map(g => {
      const mh = Math.max(0, ...g.runs.filter(r => r.d === 'h').map(r => r.n)), mv = Math.max(0, ...g.runs.filter(r => r.d === 'v').map(r => r.n)), sq = g.runs.some(r => r.d === 's');
      const kind = mh >= 5 || mv >= 5 ? 'disco' : mh >= 3 && mv >= 3 ? 'bomb' : mh === 4 ? 'rv' : mv === 4 ? 'rh' : sq ? 'prop' : null;
      return { cells: [...g.cells.values()], c: g.c, kind };
    });
  }
  function hasMatchAt(x, y) {
    const c = colorAt(x, y); if (c < 0) return false;
    let n = 1; for (let i = 1; colorAt(x - i, y) === c; i++) n++; for (let i = 1; colorAt(x + i, y) === c; i++) n++; if (n >= 3) return true;
    n = 1; for (let i = 1; colorAt(x, y - i) === c; i++) n++; for (let i = 1; colorAt(x, y + i) === c; i++) n++; if (n >= 3) return true;
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const ax = x + dx, ay = y + dy; if (colorAt(ax, ay) === c && colorAt(ax + 1, ay) === c && colorAt(ax, ay + 1) === c && colorAt(ax + 1, ay + 1) === c) return true; }
    return false;
  }
  function lswap(a, b) { const pa = cells[a[1]][a[0]], pb = cells[b[1]][b[0]]; cells[a[1]][a[0]] = pb; cells[b[1]][b[0]] = pa; if (pa) { pa.gx = b[0]; pa.gy = b[1]; } if (pb) { pb.gx = a[0]; pb.gy = a[1]; } }
  function validMoves() {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = [x, y], b = [x + dx, y + dy]; if (!swappable(...a) || !swappable(...b)) continue;
      const pa = at(...a), pb = at(...b);
      if (pa.b || pb.b) { out.push({ a, b, boost: true }); continue; }
      if (pa.t === pb.t) continue;
      lswap(a, b); const ok = hasMatchAt(...a) || hasMatchAt(...b); lswap(a, b); if (ok) out.push({ a, b });
    }
    return out;
  }

  // ------------------------------------------------------------ goals + hits
  function goal(k, c, x, y) {
    for (let i = 0; i < goals.length; i++) { const g = goals[i]; if (g.k === k && (k !== 'color' || g.c === c) && g.left > 0) { g.left--; hooks.goal(i, lx(x), ly(y), g.left); return true; } }
    return false;
  }
  function clearPiece(p, x, y, { pts = 30 } = {}) {
    cells[y][x] = null; p.dying = 1; dying.push(p); pieces.splice(pieces.indexOf(p), 1);
    score += pts * Math.max(1, chain);
    if (!p.b) { spark(p.x, p.y, [COLORS_HEX[p.t], '#ffffff'], 7, { speed: 3.2, size: 1 }); goal('color', p.t, x, y); }
  }
  const hitOnce = new Set();
  function hit(x, y, { adjacent = false, fromMatch = false } = {}) {
    if (!inB(x, y)) return;
    if (crate[y][x] > 0) {
      if (fromMatch) return;
      const key = 'c' + (y * 32 + x); if (adjacent && hitOnce.has(key)) return; hitOnce.add(key);
      crate[y][x]--; snd.crate(); spark(lx(x), ly(y), ['#c98d4e', '#8a5a2b', '#ffe0a8'], 12, { speed: 3.5, size: 1.4 }); score += 50;
      if (!crate[y][x]) goal('crate', 0, x, y);
      return;
    }
    const p = cells[y][x]; if (!p || p.dying) return;
    if (ice[y][x] > 0) {
      const key = 'i' + (y * 32 + x); if (adjacent && hitOnce.has(key)) return; hitOnce.add(key);
      ice[y][x] = 0; snd.ice(); spark(lx(x), ly(y), ['#bfefff', '#ffffff', '#7fd3ff'], 14, { speed: 3.8, size: 1.2 }); score += 40; goal('ice', 0, x, y);
      if (adjacent) return;
    }
    if (adjacent) return;
    if (p.b) { if (!p.fired) { p.fired = true; queue.push([x, y, p]); } return; }
    clearPiece(p, x, y);
  }

  // ------------------------------------------------------------ boosters
  function mostColor() { const n = new Array(6).fill(0); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = colorAt(x, y); if (c >= 0) n[c]++; } return n.indexOf(Math.max(...n)); }
  function removeBooster(p) { const x = p.gx, y = p.gy; if (cells[y]?.[x] === p) cells[y][x] = null; if (!p.dying) { p.dying = 1; dying.push(p); const i = pieces.indexOf(p); if (i >= 0) pieces.splice(i, 1); } }
  function rocketLine(x, y, dir) {
    const fx = lx(x), fy = ly(y);
    for (const s of [-1, 1]) { const m = getFly('r'); m.position.set(fx, fy, 0.7); m.rotation.set(0, 0, dir === 'h' ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : (s > 0 ? 0 : Math.PI)); flyers.push({ m, kind: 'rocket', vx: dir === 'h' ? s * 22 : 0, vy: dir === 'v' ? s * 22 : 0, t: 0, life: 0.6 }); }
    const n = dir === 'h' ? W : H;
    for (let i = 0; i < n; i++) { const d = Math.abs(i - (dir === 'h' ? x : y)); const cx = dir === 'h' ? i : x, cy = dir === 'h' ? y : i; setTimeout(() => hit(cx, cy), d * 45); }
    return wait(n * 45 * 0.6 + 60);
  }
  function bombAt(x, y, r) {
    snd.boom(); ring(lx(x), ly(y), r * 1.6 + 1); hooks.shake(0.25 + r * 0.08);
    spark(lx(x), ly(y), ['#ffd166', '#ff8a2a', '#ffffff'], 30, { speed: 6, size: 1.6, life: 0.7 });
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); setTimeout(() => hit(x + dx, y + dy), d * 50); }
    return wait(r * 50 + 80);
  }
  function propTarget(exclude) {
    const pri = [[], [], []];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inB(x, y) || exclude.has(y * 32 + x)) continue;
      if (crate[y][x] && goals.some(g => g.k === 'crate' && g.left > 0)) pri[0].push([x, y]);
      else if (ice[y][x] && goals.some(g => g.k === 'ice' && g.left > 0)) pri[0].push([x, y]);
      else { const c = colorAt(x, y); if (c >= 0 && goals.some(g => g.k === 'color' && g.c === c && g.left > 0)) pri[1].push([x, y]); else if (c >= 0) pri[2].push([x, y]); }
    }
    const list = pri.find(l => l.length); return list ? list[(Math.random() * list.length) | 0] : null;
  }
  async function propFly(x, y, carry = null, exclude = new Set()) {
    const tgt = propTarget(exclude); if (!tgt) return;
    exclude.add(tgt[1] * 32 + tgt[0]);
    const m = getFly('p'); const from = [lx(x), ly(y)], to = [lx(tgt[0]), ly(tgt[1])];
    snd.whoosh();
    await new Promise(res => flyers.push({ m, kind: 'prop', from, to, t: 0, life: 0.55, res }));
    if (carry === 'bomb') await bombAt(tgt[0], tgt[1], 2);
    else if (carry === 'rh' || carry === 'rv') { snd.whoosh(); await rocketLine(tgt[0], tgt[1], carry === 'rh' ? 'h' : 'v'); }
    else hit(tgt[0], tgt[1]);
  }
  async function activate(x, y, p, partner = null) {
    removeBooster(p); score += 100; hooks.booster(p.b);
    if (p.b === 'rh' || p.b === 'rv') { snd.whoosh(); await rocketLine(x, y, p.b === 'rh' ? 'h' : 'v'); }
    else if (p.b === 'bomb') await bombAt(x, y, 2);
    else if (p.b === 'prop') { snd.whoosh(); for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) hit(x + dx, y + dy); spark(lx(x), ly(y), ['#ffffff', '#9be7ff'], 14, { speed: 4 }); await propFly(x, y); }
    else if (p.b === 'disco') {
      const c = partner ?? mostColor(), targets = [];
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (colorAt(xx, yy) === c) targets.push([xx, yy]);
      snd.zap(); zapLines(x, y, targets); spark(lx(x), ly(y), COLORS_HEX, 30, { speed: 5, size: 1.4 });
      await wait(380); targets.forEach(([xx, yy], i) => setTimeout(() => hit(xx, yy), i * 18)); await wait(targets.length * 18 + 60);
    }
  }
  async function runQueue() {
    while (queue.length) { const [x, y, p] = queue.shift(); await activate(x, y, p); await wait(60); }
  }
  async function comboSwap(a, b, pa, pb) {
    // pa sits at b now and pb at a (after the logical swap). Fire at b (where the dragged piece landed).
    const [x, y] = b; const k = [pa.b, pb.b].sort().join('+');
    pa.fired = pb.fired = true;
    if (pa.b && pb.b) {
      removeBooster(pa); removeBooster(pb); score += 300; hooks.booster('combo');
      if (k === 'disco+disco') { snd.zap(); hooks.shake(0.6); ring(lx(x), ly(y), 9, '#ffe8ff'); for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) setTimeout(() => hit(xx, yy), (Math.abs(xx - x) + Math.abs(yy - y)) * 40); await wait(700); }
      else if (pa.b === 'disco' || pb.b === 'disco') {
        const other = pa.b === 'disco' ? pb.b : pa.b, c = mostColor(), list = [];
        for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (colorAt(xx, yy) === c && !ice[yy][xx]) list.push([xx, yy]);
        snd.zap(); zapLines(x, y, list); await wait(350);
        for (const [xx, yy] of list) { const old = cells[yy][xx]; clearPiece(old, xx, yy, { pts: 0 }); const nb = other === 'rh' || other === 'rv' ? (Math.random() < 0.5 ? 'rh' : 'rv') : other; const np = mk(-1, xx, yy, nb); np.born = 0.01; np.fired = true; cells[yy][xx] = np; }
        await wait(380);
        for (const [xx, yy] of list) { const np = cells[yy][xx]; if (np && np.b) { await activate(xx, yy, np); await wait(40); } }
      }
      else if (k === 'bomb+bomb') await bombAt(x, y, 3);
      else if (pa.b === 'prop' && pb.b === 'prop') { const ex = new Set(); await Promise.all([propFly(x, y, null, ex), propFly(x, y, null, ex), propFly(x, y, null, ex)]); }
      else if (pa.b === 'prop' || pb.b === 'prop') { const other = pa.b === 'prop' ? pb.b : pa.b; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) hit(x + dx, y + dy); await propFly(x, y, other); }
      else if (k === 'bomb+rh' || k === 'bomb+rv') { snd.whoosh(); hooks.shake(0.4); const ps = []; for (let d = -1; d <= 1; d++) { ps.push(rocketLine(x + d, y, 'v')); ps.push(rocketLine(x, y + d, 'h')); } await Promise.all(ps); }
      else { snd.whoosh(); await Promise.all([rocketLine(x, y, 'h'), rocketLine(x, y, 'v')]); }
    } else {
      const bp = pa.b ? pa : pb, other = pa.b ? pb : pa, [bx, by] = pa.b ? b : a;
      bp.fired = true; other.fired = false;
      await activate(bx, by, bp, other.t);
    }
  }

  // ------------------------------------------------------------ gravity
  function topOf(x) { for (let y = 0; y < H; y++) if (mask[y][x]) return y; return H; }
  function gravity() {
    const spawned = new Array(W).fill(0);
    let changed = true, guard = 0;
    while (changed && guard++ < 200) {
      changed = false;
      for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) {
        if (!mask[y][x] || crate[y][x] || cells[y][x]) continue;
        // look straight up for a movable piece, stopping at blockers
        let yy = y - 1; while (yy >= 0 && mask[yy][x] && !crate[yy][x] && !ice[yy][x] && !cells[yy][x]) yy--;
        if (yy < 0 || !mask[yy][x]) {   // reached the column top: spawn
          if (y === topOf(x) || yy < topOf(x)) { const t = (Math.random() * L.colors) | 0; const p = mk(t, x, y); p.y = ly(topOf(x)) + 1 + spawned[x]++; p.vy = 2; cells[y][x] = p; changed = true; }
          continue;
        }
        if (cells[yy][x] && !crate[yy][x] && !ice[yy][x]) { const p = cells[yy][x]; cells[yy][x] = null; cells[y][x] = p; p.gy = y; changed = true; }
      }
      if (changed) continue;
      // diagonal slides into cells that can't be fed from above
      for (let y = H - 1; y >= 1 && !changed; y--) for (let x = 0; x < W && !changed; x++) {
        if (!mask[y][x] || crate[y][x] || cells[y][x]) continue;
        for (const dx of [-1, 1]) {
          const sx = x + dx, sy = y - 1; if (!inB(sx, sy) || !movable(sx, sy)) continue;
          if (inB(sx, y) && !crate[y][sx] && !cells[y][sx]) continue;   // it would rather fall straight down
          const p = cells[sy][sx]; cells[sy][sx] = null; cells[y][x] = p; p.gx = x; p.gy = y; changed = true; break;
        }
      }
    }
  }
  const settled = () => pieces.every(p => !p.tw && Math.abs(p.y - ly(p.gy)) < 1e-3 && Math.abs(p.x - lx(p.gx)) < 1e-3);
  async function waitSettled() { const t0 = performance.now(); while (!settled() && performance.now() - t0 < 3000) await wait(30); }

  // ------------------------------------------------------------ turn flow
  function tween(p, tx, ty, d = 0.16) { p.tw = { fx: p.x, fy: p.y, tx, ty, t: 0, d }; }
  const COMBO = ['', '', 'Lovely!', 'Gorgeous!', 'Stunning!', 'Divine!', 'Fabulous!'];
  async function resolve() {
    chain = 0;
    for (;;) {
      hitOnce.clear();
      const gs = findGroups();
      if (!gs.length) {
        if (queue.length) { await runQueue(); gravity(); await waitSettled(); continue; }
        break;
      }
      chain++;
      let k = 0;
      for (const g of gs) {
        let spot = null;
        if (g.kind) { spot = (swapCells || []).find(([sx, sy]) => g.cells.some(([x, y]) => x === sx && y === sy)) || g.cells.slice().sort((a, b) => b[1] - a[1] || a[0] - b[0])[Math.floor(g.cells.length / 2)]; }
        for (const [x, y] of g.cells) {
          const p = cells[y][x]; if (!p) continue;
          snd.pop(chain - 1, k++);
          if (ice[y][x]) { hit(x, y); continue; }
          if (spot) { // merge into the new booster
            clearPiece(p, x, y); p.merge = [lx(spot[0]), ly(spot[1])];
          } else clearPiece(p, x, y);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (g.cells.some(([a, b]) => a === nx && b === ny)) continue; hit(nx, ny, { adjacent: true }); }
        }
        if (spot && !cells[spot[1]][spot[0]]) { const np = mk(-1, spot[0], spot[1], g.kind); np.born = 0.01; cells[spot[1]][spot[0]] = np; snd.make(); hooks.made(g.kind, lx(spot[0]), ly(spot[1])); spark(lx(spot[0]), ly(spot[1]), ['#ffffff', '#fff1a8'], 16, { speed: 4 }); }
      }
      if (chain >= 2) hooks.combo(COMBO[Math.min(COMBO.length - 1, chain)], chain);
      await wait(150);
      if (queue.length) await runQueue();
      gravity(); await waitSettled(); swapCells = null;
    }
    // ensure a move exists
    if (!validMoves().length) await shuffle();
  }
  async function shuffle() {
    hooks.combo('Shuffle!', 0);
    for (let tries = 0; tries < 40; tries++) {
      const spots = [], ts = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && !p.b && !ice[y][x]) { spots.push(p); ts.push(p.t); } }
      for (let i = ts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [ts[i], ts[j]] = [ts[j], ts[i]]; }
      spots.forEach((p, i) => p.t = ts[i]);
      if (!findGroups().length && validMoves().length) break;
    }
    for (const p of pieces) { p.born = 0.01; }
    await wait(400);
  }
  async function endTurn() {
    if (goals.every(g => g.left <= 0)) { await winSeq(); return; }
    if (moves <= 0) { over = true; busy = false; hooks.done(false, 0, score); return; }
    busy = false; idleT = 0;
  }
  async function winSeq() {
    over = true;
    const ratio = moves / movesStart, stars = ratio >= 0.3 ? 3 : ratio >= 0.12 ? 2 : 1;
    hooks.won();
    await wait(500);
    // leftover moves become rockets that fire (a little celebration, + points)
    const n = Math.min(moves, 7);
    for (let i = 0; i < n; i++) {
      const opts = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && !p.b && !ice[y][x]) opts.push([x, y]); }
      if (!opts.length) break;
      const [x, y] = opts[(Math.random() * opts.length) | 0]; const old = cells[y][x]; clearPiece(old, x, y, { pts: 0 });
      const np = mk(-1, x, y, Math.random() < 0.5 ? 'rh' : 'rv'); np.born = 0.01; np.fired = true; cells[y][x] = np; moves--; hooks.moves(moves); score += 250; snd.coin();
      await wait(110);
    }
    const fire = []; let k = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && p.b) { p.fired = true; const d = k++ * 90; fire.push(wait(d).then(() => activate(x, y, p))); } }
    await Promise.all(fire); await wait(200); await runQueue(); gravity(); await waitSettled();
    busy = false; hooks.done(true, stars, score);
  }
  async function trySwap(a, b) {
    if (busy || over || !swappable(...a) || !swappable(...b)) return false;
    busy = true; sel = null; hint = null;
    const pa = at(...a), pb = at(...b);
    snd.swap(); lswap(a, b); tween(pa, lx(b[0]), ly(b[1])); tween(pb, lx(a[0]), ly(a[1])); await wait(170);
    if (pa.b || pb.b) { moves--; hooks.moves(moves); await comboSwap(a, b, pa, pb); gravity(); await waitSettled(); swapCells = null; await resolve(); await endTurn(); return true; }
    if (!hasMatchAt(...a) && !hasMatchAt(...b)) { snd.bad(); lswap(a, b); tween(pa, lx(a[0]), ly(a[1])); tween(pb, lx(b[0]), ly(b[1])); await wait(170); busy = false; return false; }
    moves--; hooks.moves(moves); swapCells = [a, b]; await resolve(); await endTurn(); return true;
  }
  async function tapBooster(x, y) {
    const p = at(x, y); if (busy || over || !p || !p.b || ice[y][x]) return false;
    busy = true; sel = null; moves--; hooks.moves(moves); p.fired = true;
    await activate(x, y, p); await runQueue(); gravity(); await waitSettled(); await resolve(); await endTurn(); return true;
  }

  // ------------------------------------------------------------ input (board-local coordinates)
  let down = null;
  const cellAt = (px, py) => { const x = Math.round(px + (W - 1) / 2), y = Math.round((H - 1) / 2 - py); return inB(x, y) ? [x, y] : null; };
  const input = {
    down(px, py) { if (over) return; down = { c: cellAt(px, py), px, py, moved: false }; },
    move(px, py) {
      if (!down || !down.c || down.moved) return;
      const dx = px - down.px, dy = py - down.py; if (Math.hypot(dx, dy) < 0.4) return;
      down.moved = true; const [x, y] = down.c; const t = Math.abs(dx) > Math.abs(dy) ? [x + Math.sign(dx), y] : [x, y - Math.sign(dy)];
      if (inB(...t)) trySwap(down.c, t);
    },
    up() {
      if (!down) return; const d = down; down = null; if (d.moved || !d.c) return;
      const [x, y] = d.c, p = at(x, y); if (!p) return;
      if (sel && Math.abs(sel[0] - x) + Math.abs(sel[1] - y) === 1) { const s = sel; sel = null; trySwap(s, [x, y]); return; }
      if (p.b && !ice[y][x]) { tapBooster(x, y); return; }
      sel = sel && sel[0] === x && sel[1] === y ? null : [x, y]; snd.tap();
    },
  };

  // ------------------------------------------------------------ start a level
  let colTop = [];
  function start(level, rand, preBoosters = []) {
    L = level; W = L.W; H = L.H; mask = L.mask.map(r => r.slice()); crate = L.crate.map(r => r.slice()); ice = L.ice.map(r => r.slice());
    cells = mask.map(r => r.map(() => null)); pieces = []; dying = []; parts.length = 0; queue.length = 0;
    goals = L.goals.map(g => ({ ...g, left: g.n })); moves = movesStart = L.moves; score = 0; over = false; busy = true; sel = null; hint = null; idleT = 0;
    colTop = Array.from({ length: W }, (_, x) => topOf(x));
    fillNoMatch(rand);
    // pre-level boosters drop onto random free cells
    for (const b of preBoosters) {
      const opts = []; for (let y = 2; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && !p.b && !ice[y][x]) opts.push([x, y]); }
      if (!opts.length) break; const [x, y] = opts[(rand() * opts.length) | 0]; const old = cells[y][x]; pieces.splice(pieces.indexOf(old), 1);
      const np = mk(-1, x, y, b === 'rocket' ? (rand() < 0.5 ? 'rh' : 'rv') : b); np.y = old.y; cells[y][x] = np;
    }
    // tiles + frame instances
    let ti = 0, fi = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y][x]) continue;
      tmp.makeTranslation(lx(x), ly(y), 0); IT.setMatrixAt(ti, tmp); IT.setColorAt(ti, col.set((x + y) % 2 ? '#d9b596' : '#ead0b3')); ti++;
      tmp.makeTranslation(lx(x), ly(y), -0.12); IF.setMatrixAt(fi, tmp); tmp.makeTranslation(lx(x), ly(y), -0.2); IR.setMatrixAt(fi, tmp); fi++;
    }
    IT.count = ti; IF.count = fi; IR.count = fi; IT.instanceMatrix.needsUpdate = IF.instanceMatrix.needsUpdate = IR.instanceMatrix.needsUpdate = true; if (IT.instanceColor) IT.instanceColor.needsUpdate = true;
    root.visible = true;
    hooks.moves(moves);
    setTimeout(() => { if (!validMoves().length) shuffle(); busy = false; }, 900);
  }

  // ------------------------------------------------------------ per-frame
  let T = 0;
  function update(dt) {
    T += dt; idleT += dt;
    root.updateWorldMatrix(true, false); clip.set(new THREE.Vector3(0, -1, 0), (H - 1) / 2 + 0.55); clip.applyMatrix4(root.matrixWorld);
    const shBox = IS.material; shBox.clippingPlanes = [clip];
    // pieces
    const counts = new Array(6).fill(0), bc = { rv: 0, bomb: 0, prop: 0, disco: 0 }; let si = 0;
    const put = (p, alpha = 1) => {
      const tx = lx(p.gx), ty = ly(p.gy);
      if (p.tw) { p.tw.t += dt / p.tw.d; const k = easeOut(Math.min(1, p.tw.t)); p.x = p.tw.fx + (p.tw.tx - p.tw.fx) * k; p.y = p.tw.fy + (p.tw.ty - p.tw.fy) * k; if (p.tw.t >= 1) p.tw = null; }
      else if (!p.dying && (p.y > ty + 1e-3 || Math.abs(p.x - tx) > 1e-3)) {
        p.vy = Math.min(p.vy + 80 * dt, 24); const step = p.vy * dt;
        if (p.y - ty <= step && Math.abs(p.x - tx) <= step) { p.y = ty; p.x = tx; if (p.vy > 4) p.land = 1; p.vy = 0; }
        else { p.y = Math.max(ty, p.y - step); p.x += Math.max(-step, Math.min(step, tx - p.x)); }
      } else if (!p.dying && p.y < ty - 1e-3) { p.y = ty; }
      let s = PIECE, sx = 1, sy = 1, z = 0.42;
      const ct = colTop[p.gx]; if (ct > 0) { const edge = ly(ct) + 0.5; if (p.y > edge - 0.45) s *= Math.max(0, Math.min(1, (edge + 0.45 - p.y) / 0.9)); }
      if (p.land > 0) { p.land = Math.max(0, p.land - dt * 5); const k = Math.sin(p.land * Math.PI) * 0.22; sy = 1 - k; sx = 1 + k * 0.7; }
      if (p.born > 0) { p.born = Math.min(1, p.born + dt * 4); s *= easeBack(p.born); if (p.born >= 1) p.born = 0; }
      if (p.dying) { p.dying -= dt * 4.5; const k = Math.max(0, p.dying); s *= k < 0.7 ? k / 0.7 * 1.15 : 1 + (1 - k) * 0.5; z += (1 - k) * 0.6; if (p.merge) { p.x += (p.merge[0] - p.x) * Math.min(1, dt * 14); p.y += (p.merge[1] - p.y) * Math.min(1, dt * 14); } }
      const isSel = sel && !p.dying && p.gx === sel[0] && p.gy === sel[1], isHint = hint && !p.dying && hint.some(([x, y]) => x === p.gx && y === p.gy);
      if (isSel) s *= 1.1 + Math.sin(T * 10) * 0.05;
      if (isHint) { s *= 1 + Math.abs(Math.sin(T * 5)) * 0.12; }
      let ry = Math.sin(T * 1.3 + p.wob) * 0.18, rz = 0, rx = 0;
      if (p.b === 'disco') ry = T * 2; else if (p.b === 'prop') ry = T * 4; else if (p.b === 'rh') rz = -Math.PI / 2; else if (p.b === 'bomb') rz = Math.sin(T * 6 + p.wob) * 0.12;
      if (isHint) rz += Math.sin(T * 14) * 0.12;
      e.set(rx, ry, rz); q.setFromEuler(e); v.set(p.x, p.y, z); sc.set(s * sx, s * sy, s * sx); tmp.compose(v, q, sc);
      if (p.b) { const I = IB[p.b], k = p.b === 'rh' ? 'rv' : p.b; I.setMatrixAt(bc[k]++, tmp); }
      else IC[p.t].setMatrixAt(counts[p.t]++, tmp);
      if (!p.dying && si < MAXP) { v.set(p.x + 0.07, p.y - 0.1, 0.09); sc.set(s, s * 0.9, 1); tmp.compose(v, q.identity(), sc); IS.setMatrixAt(si++, tmp); }
    };
    for (const p of pieces) put(p);
    for (let i = dying.length - 1; i >= 0; i--) { const p = dying[i]; if (p.dying <= 0) { dying.splice(i, 1); continue; } put(p); }
    IC.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    for (const k of ['rv', 'bomb', 'prop', 'disco']) { IB[k].count = bc[k]; IB[k].instanceMatrix.needsUpdate = true; }
    IS.count = si; IS.instanceMatrix.needsUpdate = true;
    // crates + ice
    let ci = 0, ii = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y]?.[x]) continue;
      if (crate[y][x] > 0) { e.set(0, 0, 0); q.setFromEuler(e); v.set(lx(x), ly(y), 0.46); sc.setScalar(0.94); tmp.compose(v, q, sc); ICr.setMatrixAt(ci, tmp); ICr.setColorAt(ci, col.set(['#ffffff', '#ffffff', '#d8b08a', '#a77c58'][crate[y][x]])); ci++; }
      if (ice[y][x] > 0 && cells[y][x]) { const p = cells[y][x]; e.set(0.15, 0.2, 0); q.setFromEuler(e); v.set(p.x, p.y, 0.45); sc.setScalar(0.98); tmp.compose(v, q, sc); II.setMatrixAt(ii++, tmp); }
    }
    ICr.count = ci; ICr.instanceMatrix.needsUpdate = true; if (ICr.instanceColor) ICr.instanceColor.needsUpdate = true; II.count = ii; II.instanceMatrix.needsUpdate = true;
    // particles
    let pi = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const s = parts[i]; s.life -= dt; if (s.life <= 0) { parts.splice(i, 1); continue; }
      s.vy -= s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vx *= 0.97; s.r += dt * 8;
      const k = s.life / s.max; e.set(s.r, s.r * 0.7, 0); q.setFromEuler(e); v.set(s.x, s.y, s.z); sc.setScalar(s.size * (0.4 + k * 0.8)); tmp.compose(v, q, sc);
      IP.setMatrixAt(pi, tmp); IP.instanceColor.setXYZ(pi, s.c.r * (0.6 + k), s.c.g * (0.6 + k), s.c.b * (0.6 + k)); pi++;
    }
    IP.count = pi; IP.instanceMatrix.needsUpdate = true; IP.instanceColor.needsUpdate = true;
    // rings, zaps, flyers
    for (const r of rings) if (r.t < 1) { r.t += dt * 2.4; const k = Math.min(1, r.t); r.m.scale.setScalar(0.3 + k * r.size); r.m.material.opacity = 1 - k; if (k >= 1) r.m.visible = false; }
    if (zapT > 0) { zapT -= dt; zap.material.opacity = Math.max(0, zapT / 0.45) * (0.6 + Math.random() * 0.4); if (zapT <= 0) zap.visible = false; }
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]; f.t += dt;
      if (f.kind === 'rocket') { f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; if (Math.random() < 0.8) spark(f.m.position.x, f.m.position.y, ['#ffb347', '#fff1a8', '#ff6b3d'], 1, { speed: 0.8, size: 1.2, life: 0.35, grav: 0 }); }
      else { const k = Math.min(1, f.t / f.life); f.m.position.set(f.from[0] + (f.to[0] - f.from[0]) * k, f.from[1] + (f.to[1] - f.from[1]) * k + Math.sin(k * Math.PI) * 1.4, 0.9 + Math.sin(k * Math.PI) * 1.2); f.m.rotation.set(0.4, f.t * 25, 0); }
      if (f.t >= f.life) { f.m.visible = false; flyers.splice(i, 1); f.res && f.res(); }
    }
    // hint after 5 s idle
    if (!busy && !over && idleT > 5 && !hint) { const m = validMoves().filter(m => !m.boost); if (m.length) hint = [m[0].a, m[0].b]; }
  }

  // ------------------------------------------------------------ bot: plays real moves
  function bot() {
    if (busy || over) return;
    let best = null, bs = -1;
    for (const mv of validMoves()) {
      const pa = at(...mv.a), pb = at(...mv.b); let s;
      if (mv.boost) s = pa.b && pb.b ? 40 : 18;
      else {
        lswap(mv.a, mv.b); const gs = findGroups(); lswap(mv.a, mv.b);
        s = 0; for (const g of gs) { s += g.cells.length; if (g.kind) s += { disco: 14, bomb: 9, rv: 6, rh: 6, prop: 5 }[g.kind]; if (goals.some(q => q.k === 'color' && q.c === g.c && q.left > 0)) s += g.cells.length * 1.5;
          for (const [x, y] of g.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (inB(x + dx, y + dy) && (crate[y + dy][x + dx] || ice[y + dy][x + dx])) s += 1.5; } }
        s += Math.max(mv.a[1], mv.b[1]) * 0.15 + Math.random() * 0.5;
      }
      if (s > bs) { bs = s; best = mv; }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(x, y); if (p && p.b && !ice[y][x] && 16 > bs) { bs = 16; best = { tap: [x, y] }; } }
    if (!best) return;
    if (best.tap) tapBooster(...best.tap); else trySwap(best.a, best.b);
  }

  // first-seconds demo (game.js): one plain three-in-a-row of a colour no goal asks for, away from crates and ice, as a free move
  function demo() {
    if (busy || over) return false;
    for (const mv of validMoves()) { if (mv.boost) continue;
      lswap(mv.a, mv.b); const gs = findGroups(); lswap(mv.a, mv.b);
      if (gs.length !== 1 || gs[0].kind || gs[0].cells.length !== 3 || goals.some(q => q.k === 'color' && q.c === gs[0].c && q.left > 0)) continue;
      if (gs[0].cells.some(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inB(x + dx, y + dy) && (crate[y + dy][x + dx] || ice[y + dy][x + dx])))) continue;
      moves++; trySwap(mv.a, mv.b); return true; }
    return false;
  }
  function hide() { root.visible = false; over = true; }
  return {
    start, update, input, bot, hide, demo,
    get busy() { return busy; }, get over() { return over; }, get moves() { return moves; }, get goals() { return goals; }, get score() { return score; },
    get size() { return [W, H]; },
    get dbg() { let empty = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x] && !crate[y][x] && !cells[y][x]) empty++; return { T, d0: dying[0] && dying[0].dying, busy, over, moves, pieces: pieces.length, dying: dying.length, empty, settled: settled(), queue: queue.length, unsettled: pieces.filter(p => p.tw || Math.abs(p.y - ly(p.gy)) > 1e-3 || Math.abs(p.x - lx(p.gx)) > 1e-3).slice(0, 3).map(p => [p.x, p.y, p.gx, p.gy, p.vy, !!p.tw]) }; },
    addMoves(n) { moves += n; hooks.moves(moves); },
    fx: { spark, ring },
  };
}

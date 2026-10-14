// Knit Flow — original game. A knitted picture sits inside a conveyor loop. Tap a yarn spool to send it riding the
// conveyor: in every row/column it passes it tugs the first stitch from that side if it is the spool's colour.
// Empty spools vanish; spools with yarn left after a lap park in one of 5 holding slots. Unravel everything to win.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, burst, confetti, store, rng, rounded, mat, clamp, lerp } from './kit/hc.js';
import { YARN, PICTURES, patternPicture } from './pictures.js';
import { flow } from './kit/flow.js';
const rbox = (w, h, d, r) => rounded(w - 1.8 * r, h - 1.8 * r, d, r);

const HOLD = 5, BELT_MAX = 5, PIC = 5.0, GAP = 0.62, CR = 0.55, SPEED = 8.5, SPACING = 1.1;
const stage = createStage({ fov: 40, shadowSize: 8 });
const { scene, camera, sun } = stage;
sun.intensity = 1.5;
const save = store('knitflow');
const F = flow('knitflow');
let level = save.get('level', 1), score = save.get('stitches', 0), state = 'ready';
const ui = createUI({ title: 'KNIT<br>FLOW', hint: 'Tap a spool to unravel', hand: '👆', score: false });

// ---------------------------------------------------------------- geometry helpers
function mergeUV(parts) {
  parts = parts.map((p) => ({ ...p, g: p.g.index ? p.g.toNonIndexed() : p.g }));
  let n = 0; for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3); let o = 0;
  for (const { g: g0, m, c } of parts) {
    const g = (g0.index ? g0.toNonIndexed() : g0.clone()); if (m) g.applyMatrix4(m); const k = g.attributes.position.count, cc = new THREE.Color(c || '#fff');
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b; } o += k;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
// a knit "V" stitch, for a unit cell (scaled by pitch per instance)
const STITCH = (() => {
  const cap = new THREE.CapsuleGeometry(0.2, 0.42, 3, 10);
  return mergeUV([{ g: cap, m: M(-0.17, 0, 0, Math.PI / 2, 0.5, 0, 1, 1, 0.62) }, { g: cap, m: M(0.17, 0, 0, Math.PI / 2, -0.5, 0, 1, 1, 0.62) }]);
})();
// spool: two flanges (vertex-darkened) + wound core, tinted per spool via material colour
const yarnTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 6) { x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, y, 64, 2); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, y + 3, 64, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const SPOOL = mergeUV([
  { g: new THREE.CylinderGeometry(0.43, 0.43, 0.09, 28), m: M(0, 0.045), c: '#b8b8b8' },
  { g: new THREE.CylinderGeometry(0.35, 0.35, 0.42, 28, 1, true), m: M(0, 0.3), c: '#ffffff' },
  { g: new THREE.CylinderGeometry(0.43, 0.43, 0.09, 28), m: M(0, 0.555), c: '#d6d6d6' },
  { g: new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), m: M(0, 0.605), c: '#555555' },
]);
const THREAD = (() => { const g = new THREE.CylinderGeometry(0.025, 0.025, 1, 6); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2); return g; })();   // along +z, length 1

function labelTex(text, hidden) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.font = '800 62px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.strokeStyle = 'rgba(30,30,50,.85)'; x.strokeText(text, 64, 68); x.fillStyle = hidden ? '#d8d8ef' : '#fff'; x.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- level state
let N, pitch, h, m, grid, colors, stitchIM, board, world, path, P, bobbins = [], hold = [], pending = [], flyingStitches = [], threads = [], cols = [], rackZ = 0, holdZ = 0, totalSt = 0, leftSt = 0, hiddenFrom = 99;
const pick = (arr, R) => arr[Math.floor(R() * arr.length)];

function pictureFor(n) {
  if (n <= PICTURES.length) return PICTURES[n - 1];
  if (n % 2 === 0) { const p = PICTURES[(n * 5) % PICTURES.length]; return { ...p, n: Math.min(20, p.n + 2) }; }
  return patternPicture(n * 131 + 7, 18);
}
// first stitch from a side in a line: side 'B' col c (from bottom), 'R' row r (from right), 'T' col c (from top), 'L' row r (from left)
function firstAt(g, side, k) {
  if (side === 'B') { for (let r = N - 1; r >= 0; r--) if (g[r * N + k] >= 0) return r * N + k; }
  else if (side === 'T') { for (let r = 0; r < N; r++) if (g[r * N + k] >= 0) return r * N + k; }
  else if (side === 'R') { for (let c = N - 1; c >= 0; c--) if (g[k * N + c] >= 0) return k * N + c; }
  else { for (let c = 0; c < N; c++) if (g[k * N + c] >= 0) return k * N + c; }
  return -1;
}
const LAP = []; // [side, k] in travel order
function exposure(g, color) { let e = 0; for (const [s, k] of LAP) { const i = firstAt(g, s, k); if (i >= 0 && g[i] === color) e++; } return e; }
function lap(g, color, left) { for (const [s, k] of LAP) { if (!left) break; const i = firstAt(g, s, k); if (i >= 0 && g[i] === color) { g[i] = -1; left--; } } return left; }

/** greedy solver = bot policy (sequential laps): holding spools first, then the rack front with the most exposed stitches */
function solve(g0, rack) {
  const g = g0.slice(), cs = rack.map((c) => c.slice()), hd = []; let guard = 0;
  while (g.some((v) => v >= 0) && guard++ < 2000) {
    const cand = [...hd.map((b, i) => ({ b, src: 'h', i })), ...cs.map((c, i) => c.length ? { b: c[0], src: 'r', i } : null).filter(Boolean)];
    if (!cand.length) return false;
    let best = null, be = 0; for (const c of cand) { const e = exposure(g, c.b.color) + (c.src === 'h' ? 0.5 : 0); if (e > be) { be = e; best = c; } }
    if (!best || be < 1) { if (hd.length >= HOLD - 1) return false; const c = cand.find((c) => c.src === 'r'); if (!c) return false; best = c; }
    if (best.src === 'h') hd.splice(best.i, 1); else cs[best.i].shift();
    const left = lap(g, best.b.color, best.b.left);
    if (left > 0) { if (hd.length >= HOLD) return false; hd.push({ color: best.b.color, left }); }
  }
  return true;
}
function designLevel(n) {
  const R = rng(n * 977 + 31), pic = pictureFor(n), fk = F.k(); N = pic.n;
  const g = new Array(N * N), keys = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const k = pic.f((c + 0.5) / N, (r + 0.5) / N); let i = keys.indexOf(k); if (i < 0) { keys.push(k); i = keys.length - 1; } g[r * N + c] = i; }
  // tiny colour islands make silly 1-stitch spools: fold them into the most common colour
  const cnt = keys.map((_, ci) => g.filter((v) => v === ci).length), main = cnt.indexOf(Math.max(...cnt));
  cnt.forEach((c, ci) => { if (c < 6) for (let i = 0; i < g.length; i++) if (g[i] === ci) g[i] = main; });
  const used = [...new Set(g)].sort((a, b) => a - b), remap = {}; used.forEach((ci, k) => remap[ci] = k);
  for (let i = 0; i < g.length; i++) g[i] = remap[g[i]]; const keys2 = used.map((ci) => keys[ci]); keys.length = 0; keys.push(...keys2);
  LAP.length = 0;
  for (let c = 0; c < N; c++) LAP.push(['B', c]); for (let r = N - 1; r >= 0; r--) LAP.push(['R', r]);
  for (let c = N - 1; c >= 0; c--) LAP.push(['T', c]); for (let r = 0; r < N; r++) LAP.push(['L', r]);
  const caps = n === 1 ? [20, 30] : n < 5 ? [20, 30, 40] : [10, 20, 30, 40];
  const C = n < 3 ? 3 : n < 7 ? 4 : 5;
  for (let attempt = 0; attempt < 30; attempt++) {
    // spools per colour
    const pool = keys.map((_, ci) => { const total = g.filter((v) => v === ci).length, list = []; let left = total;
      while (left > 0) { let c = pick(caps, R); if (left - c < 8) c = left; c = Math.min(c, left); list.push({ color: ci, cap: c, left: c }); left -= c; } return list; });
    // launch order from a greedy peel (any colour's next spool), then dealt round-robin into rack columns with a little shuffle
    const gg = g.slice(), order = [], hd = [];
    for (let guard = 0; gg.some((v) => v >= 0) && guard < 500; guard++) {
      const hb = hd.map((b, i) => [exposure(gg, b.color), i]).sort((a, b) => b[0] - a[0])[0];
      if (hb && hb[0] > 0) { const b = hd.splice(hb[1], 1)[0]; const l = lap(gg, b.color, b.left); if (l) hd.push({ color: b.color, left: l }); continue; }
      const opts = keys.map((_, ci) => [pool[ci].length ? exposure(gg, ci) + R() * 0.5 : -1, ci]).sort((a, b) => b[0] - a[0]);
      if (opts[0][0] < 0) break; const b = pool[opts[0][1]].shift(); order.push(b);
      const l = lap(gg, b.color, b.left); if (l) hd.push({ color: b.color, left: l });
    }
    for (const p of pool) order.push(...p);
    const shuf = attempt < 20 ? Math.min(4, Math.floor(n / 3 * fk)) : 0;
    for (let i = 0; i < order.length && shuf; i++) if (R() < 0.35 * fk) { const j = Math.min(order.length - 1, i + 1 + Math.floor(R() * shuf)); [order[i], order[j]] = [order[j], order[i]]; }
    const rack = Array.from({ length: C }, () => []); order.forEach((b, i) => rack[i % C].push({ ...b, left: b.cap }));
    if (solve(g, rack)) return { g, keys, rack, pic };
  }
  // fallback: one long sorted queue per column (always the peel order)
  const rack = Array.from({ length: C }, () => []); const all = []; keys.forEach((_, ci) => { let left = g.filter((v) => v === ci).length; while (left > 0) { const c = Math.min(left, 30); all.push({ color: ci, cap: c, left: c }); left -= c; } });
  all.forEach((b, i) => rack[i % C].push(b)); return { g, keys, rack, pic };
}

// ---------------------------------------------------------------- build world
const boardMat = mat('#262b45', { roughness: 0.9 }), beltMat = mat('#5361a6', { roughness: 0.55 }), rimMat = mat('#7d8ad0', { roughness: 0.5 });
function ringShape(a, b, r1, r2) {
  const rr = (s, w, hh, r, hole) => { const x = -w, y = -hh; const p = hole ? new THREE.Path() : s;
    p.moveTo(x + r, y); p.lineTo(-x - r, y); p.quadraticCurveTo(-x, y, -x, y + r); p.lineTo(-x, -y - r); p.quadraticCurveTo(-x, -y, -x - r, -y); p.lineTo(x + r, -y); p.quadraticCurveTo(x, -y, x, -y - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p; };
  const s = new THREE.Shape(); rr(s, a, a, r1); s.holes.push(rr(null, b, b, r2, true)); return s;
}
function build(D) {
  if (world) scene.remove(world); world = new THREE.Group(); scene.add(world);
  grid = D.g.slice(); colors = D.keys.map((k) => YARN[k]); pitch = PIC / N; h = PIC / 2; m = h + GAP; totalSt = leftSt = grid.length;
  // board under the picture
  board = new THREE.Mesh(rbox(PIC + 0.36, PIC + 0.36, 0.2, 0.12), boardMat); board.rotation.x = -Math.PI / 2; board.position.y = -0.1; board.receiveShadow = true; world.add(board);
  // stitches
  stitchIM = new THREE.InstancedMesh(STITCH, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.75 }), N * N); stitchIM.castShadow = true; stitchIM.receiveShadow = true;
  const mm = new THREE.Matrix4(), cc = new THREE.Color();
  for (let i = 0; i < N * N; i++) { stitchIM.setMatrixAt(i, stitchMatrix(i, 1, mm)); stitchIM.setColorAt(i, cc.set(colors[grid[i]])); }
  world.add(stitchIM);
  // conveyor ring + chevrons
  const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(m + 0.42, m - 0.42, CR + 0.42, Math.max(0.05, CR - 0.42)), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }), beltMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.18; ring.receiveShadow = true; world.add(ring);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(m + 0.5, m + 0.38, CR + 0.5, CR + 0.38), { depth: 0.24, bevelEnabled: false }), rimMat); rim.rotation.x = -Math.PI / 2; rim.position.y = -0.18; world.add(rim);
  const rim2 = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(m - 0.38, m - 0.5, Math.max(0.05, CR - 0.38), 0.05), { depth: 0.24, bevelEnabled: false }), rimMat); rim2.rotation.x = -Math.PI / 2; rim2.position.y = -0.18; world.add(rim2);
  buildPath();
  const chev = [], ch = new THREE.Shape(); ch.moveTo(-0.1, -0.12); ch.lineTo(0.06, 0); ch.lineTo(-0.1, 0.12); ch.lineTo(-0.04, 0); ch.closePath();
  const chg = new THREE.ShapeGeometry(ch); chg.rotateX(-Math.PI / 2);
  for (let s = 0.5; s < P; s += 0.9) { const { p, yaw } = pathAt(s); chev.push({ g: chg, m: M(p.x, 0.03, p.z, 0, yaw - Math.PI / 2), c: '#8f9be0' }); }
  world.add(new THREE.Mesh(mergeUV(chev), new THREE.MeshBasicMaterial({ vertexColors: true })));
  // entry ramp at bottom-left
  const ramp = new THREE.Mesh(rbox(1.1, 1.0, 0.14, 0.12), beltMat); ramp.rotation.x = -Math.PI / 2; ramp.position.set(-m - 0.2, -0.12, m + 0.75); world.add(ramp);
  // holding slots + rack bed
  holdZ = m + 1.75; rackZ = holdZ + 1.45;
  for (let i = 0; i < HOLD; i++) { const s = new THREE.Mesh(rbox(0.98, 0.98, 0.1, 0.18), mat('#23283f', { roughness: 0.9 })); s.rotation.x = -Math.PI / 2; s.position.set(holdX(i), -0.05, holdZ); s.receiveShadow = true; world.add(s); }
  // spools
  for (const b of bobbins) { scene.remove(b.mesh); b.label.material.map.dispose(); }
  bobbins = []; hold = new Array(HOLD).fill(null); pending = []; cols = D.rack.map(() => []); hiddenFrom = level >= 6 ? 2 : 99;
  D.rack.forEach((col, ci) => col.forEach((b0, ri) => { const b = makeSpool(b0.color, b0.cap); b.col = ci; b.state = 'rack'; cols[ci].push(b); }));
  layoutRack(true);
}
const holdX = (i) => (i - (HOLD - 1) / 2) * 1.12;
const rackX = (ci) => (ci - (cols.length - 1) / 2) * 1.15;
function stitchMatrix(i, s, out) {
  const r = Math.floor(i / N), c = i % N; return out.compose(new THREE.Vector3(-h + (c + 0.5) * pitch, 0.06, -h + (r + 0.5) * pitch), new THREE.Quaternion(), new THREE.Vector3(pitch * s, pitch * s, pitch * s));
}
function stitchPos(i) { const r = Math.floor(i / N), c = i % N; return new THREE.Vector3(-h + (c + 0.5) * pitch, 0.1, -h + (r + 0.5) * pitch); }

// conveyor path (clockwise on screen): bottom L->R, right B->T, top R->L, left T->B
function buildPath() {
  const segs = []; const z = (v) => v;
  const line = (a, b, side) => segs.push({ type: 'L', a, b, len: a.distanceTo(b), side });
  const arc = (cx, cz, t0, t1) => segs.push({ type: 'A', cx, cz, t0, t1, len: Math.abs(t1 - t0) * CR });
  const V = (x, zz) => new THREE.Vector3(x, 0.02, zz);
  line(V(-m + CR, m), V(m - CR, m), 'B'); arc(m - CR, m - CR, Math.PI / 2, 0);
  line(V(m, m - CR), V(m, -m + CR), 'R'); arc(m - CR, -m + CR, 0, -Math.PI / 2);
  line(V(m - CR, -m), V(-m + CR, -m), 'T'); arc(-m + CR, -m + CR, -Math.PI / 2, -Math.PI);
  line(V(-m, -m + CR), V(-m, m - CR), 'L'); arc(-m + CR, m - CR, Math.PI, Math.PI / 2);
  let s = 0; for (const g of segs) { g.s0 = s; s += g.len; } path = segs; P = s;
}
const _pa = { p: new THREE.Vector3(), yaw: 0, side: null };
function pathAt(s) {
  s = clamp(s, 0, P - 1e-4); const g = path.find((q) => s < q.s0 + q.len) || path[path.length - 1], k = (s - g.s0) / g.len;
  if (g.type === 'L') { _pa.p.lerpVectors(g.a, g.b, k); _pa.yaw = Math.atan2(g.b.x - g.a.x, g.b.z - g.a.z); _pa.side = g.side; }
  else { const t = lerp(g.t0, g.t1, k); _pa.p.set(g.cx + Math.cos(t) * CR, 0.02, g.cz + Math.sin(t) * CR); const dt = Math.sign(g.t1 - g.t0); _pa.yaw = Math.atan2(-Math.sin(t) * dt, Math.cos(t) * dt); _pa.side = null; }
  return _pa;
}
function makeSpool(ci, cap) {
  const mesh = new THREE.Mesh(SPOOL, new THREE.MeshStandardMaterial({ color: colors[ci], vertexColors: true, map: yarnTex, roughness: 0.6 }));
  mesh.castShadow = true; scene.add(mesh);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(String(cap)), depthTest: false })); label.scale.setScalar(0.62); label.position.y = 0.95; label.renderOrder = 5; mesh.add(label);
  const b = { id: bobbins.length, color: ci, cap, left: cap, mesh, label, pos: mesh.position, state: 'rack', s: 0, lastKey: '', pulse: 0, fly: null, hidden: false };
  bobbins.push(b); return b;
}
function setLabel(b) {
  const txt = b.hidden ? '?' : String(b.left); if (b._txt === txt) return; b._txt = txt;
  b.label.material.map.dispose(); b.label.material.map = labelTex(txt, b.hidden); b.label.material.needsUpdate = true;
  b.mesh.material.color.set(b.hidden ? '#8d8fb5' : colors[b.color]);
}
function layoutRack(instant) {
  cols.forEach((col, ci) => col.forEach((b, ri) => {
    b.hidden = ri >= hiddenFrom; setLabel(b);
    const tgt = new THREE.Vector3(rackX(ci), 0, rackZ + ri * 1.02); b.mesh.visible = ri < 3;
    if (instant) b.pos.copy(tgt); else flyTo(b, tgt, 220);
    b.mesh.scale.setScalar(ri === 0 ? 1 : 0.92);
  }));
}
function flyTo(b, tgt, ms, done, hop = 0.0) { b.fly = { from: b.pos.clone(), to: tgt.clone(), t0: performance.now(), ms, done, hop }; }

// ---------------------------------------------------------------- play actions
function onBelt() { return bobbins.filter((b) => b.state === 'belt').length + pending.length; }
function launch(b) {
  if (state !== 'play') return false;
  if (onBelt() >= BELT_MAX) { b.pulse = 1; ui.pop('BELT FULL!', '#ffd23f', 28, 26); tone(160, 0.1, 'square', 0.06, 0.8); return false; }
  if (b.state === 'rack') { const col = cols[b.col]; if (col[0] !== b) { b.pulse = 1; tone(200, 0.06, 'square', 0.05, 0.8); return false; } col.shift(); layoutRack(); }
  else if (b.state === 'hold') { hold[hold.indexOf(b)] = null; }
  else return false;
  b.state = 'pending'; pending.push(b); b.mesh.scale.setScalar(1); b.hidden = false; setLabel(b);
  sfx.pick(2); buzz(12);
  flyTo(b, dockPos(pending.length - 1), 320, null, 1.2);
  ui.pill(`🧵 ${onBelt()}/${BELT_MAX}`);
  return true;
}
const dockPos = (i) => new THREE.Vector3(-m - 0.2, 0, m + 0.75 + i * 0.0);
function tryJoin() {
  if (!pending.length) return; const b = pending[0]; if (b.fly) return;
  if (bobbins.some((o) => o.state === 'belt' && o.s < SPACING)) return;
  pending.shift(); b.state = 'belt'; b.s = 0; b.lastKey = ''; tone(520, 0.05, 'triangle', 0.06, 1.3);
}
function pull(b, idx) {
  const color = grid[idx]; grid[idx] = -1; b.left--; leftSt--; score++;
  flyingStitches.push({ idx, from: stitchPos(idx), b, t: 0, color });
  const th = threads.find((t) => !t.on) || newThread(); th.on = true; th.t = 0; th.b = b; th.from = stitchPos(idx); th.mesh.material.color.set(colors[color]); th.mesh.visible = true;
  b.pulse = 1; setLabel(b); tone(700 + (b.cap - b.left) * 9, 0.035, 'triangle', 0.05, 1.25);
  ui.progress(1 - leftSt / totalSt);
  if (b.left === 0) finishSpool(b);
}
function newThread() { const mesh = new THREE.Mesh(THREAD, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.6 })); scene.add(mesh); const t = { mesh, on: false }; threads.push(t); return t; }
function finishSpool(b) {
  b.state = 'done'; sfx.coin(); buzz(18);
  setTimeout(() => { burst(scene, b.pos.clone().setY(0.6), [colors[b.color], '#ffffff'], 14, { speed: 0.07, up: 0.07, size: 0.45 }); b.dying = performance.now(); ui.pop(['Done!', 'Neat!', 'Wound up!', 'Smooth!'][b.id % 4], '#ffffff', 26, 26); }, 160);
}
function endLap(b) {
  const i = hold.indexOf(null);
  if (i < 0) { b.state = 'stuck'; return lose(); }
  hold[i] = b; b.state = 'hold'; flyTo(b, new THREE.Vector3(holdX(i), 0, holdZ), 380, () => tone(400, 0.06, 'sine', 0.08, 0.9), 1.0);
  ui.pill(`🧵 ${onBelt()}/${BELT_MAX}`);
  if (hold.filter(Boolean).length >= HOLD - 1) ui.pop(hold.every(Boolean) ? 'SLOTS FULL!' : 'CAREFUL!', '#ff6b6b', 28, 26);
}

// ---------------------------------------------------------------- flow
let D;
function startLevel() {
  D = designLevel(level); build(D); placeCamera();
  for (const t of threads) { t.on = false; t.mesh.visible = false; } flyingStitches = [];
  ui.levels(level); ui.progress(0); ui.pill(`🧵 0/${BELT_MAX}`);
  const bgs = [['#4a5180', '#2f3555'], ['#5a4a80', '#352f55'], ['#3f5a7a', '#2b3a52'], ['#54507a', '#2f2d4d']]; const bg = bgs[(level - 1) % bgs.length];
  document.body.style.setProperty('--bg1', bg[0]); document.body.style.setProperty('--bg2', bg[1]); document.body.style.setProperty('--ui', '#ff7aa8');
}
let wonAt = 0;
function win() { state = 'won'; F.level(true); wonAt = performance.now(); level++; save.set('level', level); save.set('stitches', score); sfx.win(); buzz([30, 40, 60]); ui.flash(0.4); confetti(scene, new THREE.Vector3(0, 2, 0), 90); ui.win(level - 1, `"${D.pic.name}" unravelled!`); }
function lose() { if (state !== 'play') return; state = 'lost'; F.level(false, totalSt ? 1 - leftSt / totalSt : 0); sfx.fail(); buzz([60, 40, 90]); ui.lose('TANGLED!', 'No free slot for that spool.'); }
ui.onTap((which) => { if (which === 'start') { state = 'play'; return; } startLevel(); state = 'play'; });
function placeCamera() {
  const tilt = THREE.MathUtils.degToRad(66), fovV = THREE.MathUtils.degToRad(camera.fov);
  const halfW = m + 0.58, zTop = -m - 0.6, zBot = rackZ + 2.2, tz = (zTop + zBot) / 2 + 0.1;
  const needH = (zBot - zTop) * Math.sin(tilt) / 2 + 0.6;
  const d = Math.max(halfW / (Math.tan(fovV / 2) * camera.aspect), needH / Math.tan(fovV / 2)) * 1.02;
  camera.position.set(0, Math.sin(tilt) * d, tz + Math.cos(tilt) * d); camera.lookAt(0, 0, tz - 0.35);
  sun.position.set(3, 16, tz + 6); sun.target.position.set(0, 0, tz);
}
addEventListener('resize', () => world && placeCamera());

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({
  onTap(e) {
    if (state !== 'play') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const cand = bobbins.filter((b) => (b.state === 'rack' && cols[b.col][0] === b) || b.state === 'hold');
    const hit = ray.intersectObjects(cand.map((b) => b.mesh), false)[0];
    let b = hit && cand.find((q) => q.mesh === hit.object);
    if (!b) { const gp = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3), gp); let bd = 0.75; for (const q of cand) { const d = Math.hypot(q.pos.x - gp.x, q.pos.z - gp.z); if (d < bd) { bd = d; b = q; } } }
    if (b) launch(b);
  },
});

// ---------------------------------------------------------------- bot (same greedy as the verifier, allows a couple of spools riding at once)
function bot() {
  if (state !== 'play' || onBelt() >= 4 || pending.length) return;
  const riding = {}; for (const b of bobbins) if (b.state === 'belt' || b.state === 'pending') riding[b.color] = (riding[b.color] || 0) + b.left;
  const cand = [...hold.filter(Boolean), ...cols.map((c) => c[0]).filter(Boolean)].filter((b) => !b.fly);
  let best = null, be = 0;
  for (const b of cand) { const e = exposure(grid, b.color) - (riding[b.color] || 0) + (b.state === 'hold' ? 0.5 : 0); if (e > be) { be = e; best = b; } }
  const anyRiding = Object.keys(riding).length;
  if (!best && !anyRiding && hold.filter(Boolean).length < HOLD - 1) best = cols.map((c) => c[0]).find(Boolean);
  if (best && (be >= 1 || !anyRiding)) launch(best);
}

// ---------------------------------------------------------------- loop
const tmpM = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv = new THREE.Vector3(), ts = new THREE.Vector3();
loop((dt, t) => {
  if (!world) return;
  const now = performance.now();
  tryJoin();
  for (const b of bobbins) {
    if (b.fly) {
      const f = b.fly, k = Math.min(1, (now - f.t0) / f.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      b.pos.lerpVectors(f.from, f.to, e); b.pos.y = Math.sin(k * Math.PI) * f.hop; if (k >= 1) { b.fly = null; f.done && f.done(); }
    }
    if (b.state === 'belt' || (b.state === 'done' && b.s < P && !b.dying)) {
      b.s += SPEED * dt / 60;
      if (b.s >= P) { if (b.state === 'belt') { b.state = 'returning'; endLap(b); } continue; }
      const a = pathAt(b.s); b.pos.copy(a.p); b.pos.y = 0;
      b.mesh.rotation.y += 0.25 * dt;
      if (b.state === 'belt' && a.side) {
        let k = -1; const along = a.side === 'B' || a.side === 'T' ? a.p.x : a.p.z; k = Math.floor((along + h) / pitch);
        if (k >= 0 && k < N) { const key = a.side + k; if (key !== b.lastKey) { b.lastKey = key; const i = firstAt(grid, a.side, k); if (i >= 0 && grid[i] === b.color) pull(b, i); } }
      }
    }
    if (b.dying) { const k = Math.min(1, (now - b.dying) / 260); b.mesh.scale.setScalar(Math.max(0.001, 1 + Math.sin(k * Math.PI) * 0.3 - k)); if (k >= 1) { b.mesh.visible = false; b.state = 'gone'; b.dying = 0; } }
    else if (b.pulse > 0) { b.pulse = Math.max(0, b.pulse - 0.08 * dt); const s = 1 + Math.sin(b.pulse * Math.PI) * 0.16; b.mesh.scale.set(s, 1 - (s - 1), s); }
  }
  // stitches flying into their spool
  for (let i = flyingStitches.length - 1; i >= 0; i--) {
    const f = flyingStitches[i]; f.t = Math.min(1, f.t + dt / 60 / 0.28);
    tv.lerpVectors(f.from, f.b.pos, f.t); tv.y = 0.1 + Math.sin(f.t * Math.PI) * 0.6 + f.t * 0.3;
    const sc = pitch * (1 - f.t * 0.7) * (f.t >= 1 ? 0 : 1); tmpM.compose(tv, tq, ts.setScalar(sc)); stitchIM.setMatrixAt(f.idx, tmpM);
    if (f.t >= 1) flyingStitches.splice(i, 1);
  }
  stitchIM.instanceMatrix.needsUpdate = true;
  for (const th of threads) if (th.on) {
    th.t += dt / 60 / 0.26; if (th.t >= 1) { th.on = false; th.mesh.visible = false; continue; }
    const a = th.from, bp = tv.copy(th.b.pos).setY(0.32), len = a.distanceTo(bp) * (1 - th.t * 0.85);
    th.mesh.position.copy(bp); th.mesh.lookAt(a); th.mesh.scale.set(1, 1, Math.max(0.01, len));
  }
  if (state === 'play') {
    if (leftSt === 0 && !flyingStitches.length) win();
    ui.pill(`🧵 ${onBelt()}/${BELT_MAX}`);
  }
  if (state === 'won') { const k = Math.min(1, (now - wonAt) / 700); board.parent.position.y = Math.sin(k * Math.PI) * 0.2; }
  else if (world) world.position.y = 0;
});

startLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, bot, solve,
  load(n) { level = n; ui.hideStart(); ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden'); startLevel(); state = 'play'; },
};

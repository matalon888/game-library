// Turf Rush — original game. Glide out of your turf, draw a loop, close it to claim the land. Don't get your trail cut.
import { bake, vcMat } from './merge.js';
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

import { board } from './kit/board.js';
const WB = board({ game: 'turf-rush', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.15 }, mode: 'sum' });
const save = store('turfrush');
const F = flow('turfrush');
let fk = 1;
let level = save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';
const { scene, camera, renderer, sun, hemi, followLight } = createStage({ fov: 42, shadowSize: 16 });
hemi.intensity = 1.35; sun.intensity = 1.2;
document.body.style.setProperty('--bg1', '#9fdcff'); document.body.style.setProperty('--bg2', '#c9f1ff'); document.body.style.setProperty('--ui', '#ff4fa3');
const ui = createUI({ title: 'TURF<br>RUSH', hint: 'Swipe to steer', hand: '👆' });
ui.levels(level);

const CS = 0.5;                       // cell size (world units)
const COLORS = ['#000', '#ff4fa3', '#3fa9ff', '#ffb000', '#5cc74a', '#9b6bff', '#ff7a45', '#00bfb3'];
const NAMES = ['You', 'Mochi', 'Pixel', 'Bolt', 'Kiwi', 'Taco', 'Nova'];
let G = 72, own, trail, texT, texO, dataT, dataO, terr, side, trailMesh, floor, frame;
const players = [];
const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 }; };
const C = COLORS.map(hexRGB);
const LIGHT = C.map(c => ({ r: c.r + (1 - c.r) * 0.45, g: c.g + (1 - c.g) * 0.45, b: c.b + (1 - c.b) * 0.45 }));

// ---------------------------------------------------------------- shaders: smooth-edged territory from a coarse grid
const terrMat = (tex, dark = 1, alphaMul = 1) => new THREE.ShaderMaterial({
  uniforms: { map: { value: tex }, dark: { value: dark }, am: { value: alphaMul } }, transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D map; uniform float dark; uniform float am; varying vec2 vUv;
    void main(){ vec4 c = texture2D(map, vUv); float a = smoothstep(0.42, 0.58, c.a); if (a < 0.01) discard;
      vec3 col = c.rgb / max(c.a, 0.001); gl_FragColor = vec4(col * dark, a * am); }`,
});
function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fbfdff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#eff5fd';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 16);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
const FT = floorTex();
// outer world: soft blue sea + scattered flowers/stones (instanced) so the edge of the arena isn't a void
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#a8e2ff')); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; scene.add(sea);

const hillGeo = bake([{ geo: new THREE.SphereGeometry(1, 20, 10, 0, 6.283, 0, 1.5708), color: '#8fdc6a' }, ...Array.from({ length: 7 }, (_, i) => ({ geo: new THREE.SphereGeometry(0.07, 6, 4), color: i % 2 ? '#ffffff' : '#ffe066', pos: [Math.cos(i * 2.4) * 0.6, Math.sqrt(1 - 0.36) + 0.02, Math.sin(i * 2.4) * 0.6] }))]);
const hills = new THREE.InstancedMesh(hillGeo, vcMat({ roughness: 0.8 }), 60); scene.add(hills);
const sc0 = (i) => 3 + (i * 7 % 5);
function placeHills() {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), S = G * CS / 2; let n = 0;
  for (let i = 0; i < 60; i++) { const a = r() * 6.283, d = S + 9 + r() * 22, x = Math.cos(a) * d * 1.3, z = Math.sin(a) * d * 1.3;
    if (Math.abs(x) < S + 6 + sc0(i) && Math.abs(z) < S + 6 + sc0(i)) continue; const sc = 3 + (i * 7 % 5);
    m.compose(new THREE.Vector3(x, -0.6, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(sc, sc * 0.3, sc)); hills.setMatrixAt(n++, m); }
  hills.count = n; hills.instanceMatrix.needsUpdate = true;
}
function buildArena() {
  for (const m of [terr, side, trailMesh, floor, frame]) if (m) scene.remove(m);
  const S = G * CS;
  dataO = new Uint8Array(G * G * 4); dataT = new Uint8Array(G * G * 4);
  texO = new THREE.DataTexture(dataO, G, G); texO.magFilter = texO.minFilter = THREE.LinearFilter; texO.needsUpdate = true;
  texT = new THREE.DataTexture(dataT, G, G); texT.magFilter = texT.minFilter = THREE.LinearFilter; texT.needsUpdate = true;
  floor = new THREE.Mesh(new THREE.BoxGeometry(S + 1.2, 0.6, S + 1.2), [mat('#dfe9f7'), mat('#dfe9f7'), new THREE.MeshStandardMaterial({ map: FT, roughness: 0.9 }), mat('#dfe9f7'), mat('#cddcf0'), mat('#cddcf0')]);
  FT.repeat.set(G / 8, G / 8); floor.position.y = -0.3; floor.receiveShadow = true; scene.add(floor);
  const pg = new THREE.PlaneGeometry(S, S); pg.rotateX(-Math.PI / 2);
  side = new THREE.Mesh(pg, terrMat(texO, 0.72)); side.position.set(0, 0.02, 0.16); scene.add(side);
  terr = new THREE.Mesh(pg, terrMat(texO, 1)); terr.position.y = 0.16; scene.add(terr);
  trailMesh = new THREE.Mesh(pg, terrMat(texT, 1, 0.85)); trailMesh.position.y = 0.19; scene.add(trailMesh);
  terr.renderOrder = 2; side.renderOrder = 1; trailMesh.renderOrder = 3;
  // border rail
  frame = new THREE.Group(); scene.add(frame);
  const rm = mat('#ffffff');
  for (const [w, d, x, z] of [[S + 1.2, 0.6, 0, -S / 2 - 0.3], [S + 1.2, 0.6, 0, S / 2 + 0.3], [0.6, S + 1.2, -S / 2 - 0.3, 0], [0.6, S + 1.2, S / 2 + 0.3, 0]]) {
    const b = new THREE.Mesh(rounded(w, 0.7, d, 0.2), rm); b.rotation.x = 0; b.position.set(x, 0.25, z); b.castShadow = b.receiveShadow = true; frame.add(b);
  }
  own = new Uint8Array(G * G); trail = new Uint8Array(G * G);
}
const idx = (i, j) => j * G + i;
function paint(i, j) {
  const k = idx(i, j), t = ((G - 1 - j) * G + i) * 4, o = own[k], tr = trail[k];
  if (o) { const c = C[o]; dataO[t] = c.r * 255; dataO[t + 1] = c.g * 255; dataO[t + 2] = c.b * 255; dataO[t + 3] = 255; } else dataO[t + 3] = dataO[t] = dataO[t + 1] = dataO[t + 2] = 0;
  if (tr) { const c = LIGHT[tr]; dataT[t] = c.r * 255; dataT[t + 1] = c.g * 255; dataT[t + 2] = c.b * 255; dataT[t + 3] = 255; } else dataT[t + 3] = dataT[t] = dataT[t + 1] = dataT[t + 2] = 0;
}
let dirtyO = false, dirtyT = false;
const setOwn = (i, j, v) => { own[idx(i, j)] = v; paint(i, j); dirtyO = true; };
const setTrail = (i, j, v) => { trail[idx(i, j)] = v; paint(i, j); dirtyT = true; };
const toWorld = (c) => (c - G / 2) * CS;
const toCell = (w) => Math.floor(w / CS + G / 2);

// ---------------------------------------------------------------- avatars
const GEO = { sph: new THREE.SphereGeometry(1, 14, 10) };
function makeAvatar(id) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(rounded(0.95, 0.95, 0.95, 0.22), glossy(COLORS[id])); body.castShadow = true; body.position.y = 0.48; g.add(body);
  const face = new THREE.Mesh(bake([{ geo: GEO.sph, color: '#ffffff', pos: [-0.2, 0.62, -0.46], scl: [0.15, 0.17, 0.08] }, { geo: GEO.sph, color: '#ffffff', pos: [0.2, 0.62, -0.46], scl: [0.15, 0.17, 0.08] },
    { geo: GEO.sph, color: '#1d1d35', pos: [-0.2, 0.62, -0.52], scl: [0.075, 0.09, 0.05] }, { geo: GEO.sph, color: '#1d1d35', pos: [0.2, 0.62, -0.52], scl: [0.075, 0.09, 0.05] },
    { geo: GEO.sph, color: '#ff8fb5', pos: [-0.33, 0.42, -0.47], scl: [0.08, 0.05, 0.03] }, { geo: GEO.sph, color: '#ff8fb5', pos: [0.33, 0.42, -0.47], scl: [0.08, 0.05, 0.03] }]), vcMat());
  g.add(face); g.body = body; g.face = face;
  // name tag
  const c = document.createElement('canvas'); c.width = 256; c.height = 72; const x = c.getContext('2d');
  x.font = '800 48px "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(30,30,60,.55)';
  x.strokeText(NAMES[id - 1], 128, 40); x.fillStyle = id === 1 ? '#ffffff' : '#f4f4ff'; x.fillText(NAMES[id - 1], 128, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); tag.scale.set(2.2, 0.62, 1); tag.position.y = 1.75; tag.renderOrder = 10; g.add(tag);
  scene.add(g); return g;
}

// ---------------------------------------------------------------- level
let goal = 0.15, r = rng(1), elapsed = 0;
function buildLevel() {
  r = rng(level * 3301 + 5); fk = F.k();
  G = Math.min(132, 50 + level * 8);
  buildArena();
  for (const p of players) scene.remove(p.g);
  players.length = 0;
  const nb = Math.min(6, 3 + Math.floor((level + 1) / 2));
  for (let id = 1; id <= nb + 1; id++) players.push(newPlayer(id));
  goal = Math.min(0.6, 0.1 + (level - 1) * 0.05);
  for (const p of players) spawn(p);
  recount(); placeHills();
  texO.needsUpdate = texT.needsUpdate = true;
  elapsed = 0; ui.levels(level); ui.progress(0); ui.score(''); ui.sub(`Claim ${Math.round(goal * 100)}% of the map`);
  camPos.set(players[0].x, 26, players[0].z + 13);
}
function newPlayer(id) {
  return { id, g: makeAvatar(id), x: 0, z: 0, h: 0, want: 0, speed: id === 1 ? 6.4 : (4.6 + Math.min(level, 8) * 0.07) * fk, cell: -1, out: false, trailCells: [], dead: false, respawn: 0, count: 0,
    ai: { wps: [], k: 0, think: 0, daring: (0.3 + r() * 0.4 + level * 0.06) * fk }, squash: 0, isP: id === 1 };
}
function spawn(p) {
  const R0 = 4;
  for (let tries = 0; tries < 80; tries++) {
    const ci = 6 + Math.floor(r() * (G - 12)), cj = 6 + Math.floor(r() * (G - 12));
    if (p.isP && tries === 0) { /* player starts near the centre-bottom */ }
    let free = true;
    for (let dj = -R0 - 2; dj <= R0 + 2 && free; dj++) for (let di = -R0 - 2; di <= R0 + 2; di++) { const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= G || jj >= G || own[idx(ii, jj)] || trail[idx(ii, jj)]) { free = false; break; } }
    if (!free && tries < 79) continue;
    for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) if (di * di + dj * dj <= R0 * R0 + 1) setOwn(ci + di, cj + dj, p.id);
    p.x = toWorld(ci + 0.5); p.z = toWorld(cj + 0.5); p.h = r() * Math.PI * 2; p.want = p.h; p.cell = idx(ci, cj); p.out = false; p.trailCells = []; p.dead = false;
    if (players.every(q => q.g)) { p.count = 0; for (let k = 0; k < G * G; k++) if (own[k] === p.id) p.count++; }
    p.g.visible = true; p.g.position.set(p.x, 0, p.z); p.g.scale.setScalar(0.01); p.pop = 1; p.ai.wps = [];
    return;
  }
}
function kill(p, by) {
  if (p.dead) return;
  p.dead = true; p.g.visible = false; p.respawn = 2.5;
  for (const c of p.trailCells) if (trail[c] === p.id) { trail[c] = 0; paint(c % G, Math.floor(c / G)); }
  dirtyT = true;
  for (let k = 0; k < G * G; k++) if (own[k] === p.id) { own[k] = 0; paint(k % G, Math.floor(k / G)); }
  dirtyO = true; p.trailCells = []; recount();
  const pos = new THREE.Vector3(p.x, 0.6, p.z);
  burst(scene, pos, [COLORS[p.id], '#ffffff'], 30, { speed: 0.22, up: 0.18, size: 1.3 });
  if (p.isP) { window.__why = by ? 'bot' + by.id : 'self'; if (state === 'play') F.level(false, Math.min(1, p.count / (G * G) / goal)); state = 'lost'; sfx.fail(); buzz([50, 30, 80]); ui.flash(0.5); shake = 0.6; ui.lose('CUT OFF!', by ? `${NAMES[by.id - 1]} got you` : 'You hit your own trail'); }
  else if (by && by.isP) { score += 50; ui.pop('KILL!', '#ff4fa3', 50, 26); sfx.smash(); buzz([30, 20, 40]); shake = 0.35; }
  else if (Math.hypot(p.x - players[0].x, p.z - players[0].z) < 14) tone(240, 0.12, 'triangle', 0.06, 0.6);
}

// ---------------------------------------------------------------- capture (trail → territory + flood fill enclosed area)
const seen = new Uint8Array(140 * 140), queue = new Int32Array(140 * 140);
function capture(p) {
  const id = p.id; let gained = 0;
  for (const c of p.trailCells) { if (trail[c] === id) trail[c] = 0; if (own[c] !== id) { own[c] = id; gained++; } paint(c % G, Math.floor(c / G)); }
  p.trailCells = [];
  seen.fill(0, 0, G * G); let qh = 0, qt = 0;
  const push = (k) => { if (!seen[k] && own[k] !== id) { seen[k] = 1; queue[qt++] = k; } };
  for (let i = 0; i < G; i++) { push(idx(i, 0)); push(idx(i, G - 1)); push(idx(0, i)); push(idx(G - 1, i)); }
  while (qh < qt) { const k = queue[qh++], i = k % G, j = (k - i) / G; if (i > 0) push(k - 1); if (i < G - 1) push(k + 1); if (j > 0) push(k - G); if (j < G - 1) push(k + G); }
  let sx = 0, sz = 0; const victims = new Set();
  for (let k = 0; k < G * G; k++) if (!seen[k] && own[k] !== id) { if (own[k]) victims.add(own[k]); own[k] = id; gained++; const i = k % G, j = (k - i) / G; sx += i; sz += j; paint(i, j);
    if (trail[k] && trail[k] !== id) victims.add(-trail[k]); }
  dirtyO = dirtyT = true;
  recount();
  for (const v of victims) { const q = players[Math.abs(v) - 1]; if (q && !q.dead && q.count === 0) kill(q, p); }
  return { gained, cx: gained ? sx / Math.max(1, gained) : 0, cz: gained ? sz / Math.max(1, gained) : 0 };
}
function recount() { for (const p of players) p.count = 0; for (let k = 0; k < G * G; k++) if (own[k]) players[own[k] - 1].count++; }

// ---------------------------------------------------------------- movement + rules
function stepPlayer(p, sec) {
  if (p.dead) { if (!p.isP) { p.respawn -= sec; if (p.respawn <= 0) spawn(p); } return; }
  // turn toward wanted heading at a limited rate
  let d = p.want - p.h; d = Math.atan2(Math.sin(d), Math.cos(d));
  const tr = 6.5 * sec; p.h += clamp(d, -tr, tr); p.squash = Math.min(1, p.squash + Math.abs(clamp(d, -tr, tr)) * 0.8);
  const lim = G * CS / 2 - 0.3;
  p.x += Math.sin(p.h) * p.speed * sec; p.z -= Math.cos(p.h) * p.speed * sec;
  if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) { p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim); if (p.ai) p.ai.wps = []; p.want = Math.atan2(-p.x, p.z); }
  const i = clamp(toCell(p.x), 0, G - 1), j = clamp(toCell(p.z), 0, G - 1), k = idx(i, j);
  if (k === p.cell) return;
  const pi = p.cell % G, pj = (p.cell - pi) / G;
  p.cell = k;
  if (pi !== i && pj !== j && own[idx(pi, j)] !== p.id && !trail[idx(pi, j)]) { const kk = idx(pi, j); trail[kk] = p.id; paint(pi, j); p.trailCells.push(kk); }   // fill diagonal steps so trails stay solid
  // stepping on someone's trail kills its owner (yours = you)
  const t = trail[k];
  if (t && t !== p.id) { kill(players[t - 1], p); }
  else if (t === p.id && p.trailCells.length > 2 && p.trailCells[p.trailCells.length - 1] !== k && p.trailCells[p.trailCells.length - 2] !== k) { kill(p, null); return; }
  if (own[k] === p.id) {
    if (p.out && p.trailCells.length) {
      const res = capture(p);
      if (p.isP && res.gained / (G * G) >= 0.001) {
        const pct = res.gained / (G * G) * 100;
        ui.pop('+' + pct.toFixed(1) + '%', '#ff4fa3', 34 + Math.min(26, pct * 3), 26); sfx.pick(Math.min(8, Math.round(pct))); buzz(20);
        const pos = new THREE.Vector3(toWorld(res.cx), 0.5, toWorld(res.cz)); burst(scene, pos, [COLORS[1], '#ffffff', '#ffd23f'], Math.min(50, 12 + Math.round(pct * 4)), { speed: 0.2, up: 0.2, size: 1.1 });
        p.squash = 1; shake = Math.min(0.5, pct * 0.05);
      }
    }
    p.out = false;
  } else {
    p.out = true;
    if (trail[k] !== p.id) { trail[k] = p.id; paint(i, j); dirtyT = true; p.trailCells.push(k); }
  }
}

// ---------------------------------------------------------------- AI (also drives the QA bot for the player)
function nearestOwn(p) {
  const ci = toCell(p.x), cj = toCell(p.z); let best = null, bd = 1e9;
  for (let rr = 1; rr < G; rr += 1) {
    for (let a = 0; a < 16; a++) { const i = Math.round(ci + Math.cos(a / 16 * 6.283) * rr), j = Math.round(cj + Math.sin(a / 16 * 6.283) * rr);
      if (i < 0 || j < 0 || i >= G || j >= G || own[idx(i, j)] !== p.id) continue; const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
    if (best) return best;
  }
  return [ci, cj];
}
function safeHome(p) {      // nearest own cell reachable in a straight line without touching my own trail
  const ci = toCell(p.x), cj = toCell(p.z), recent = new Set(p.trailCells.slice(-3)); const cand = [];
  for (let j = 0; j < G; j += 2) for (let i = (j / 2) % 2; i < G; i += 2) if (own[idx(i, j)] === p.id) cand.push([i, j, (i - ci) ** 2 + (j - cj) ** 2]);
  cand.sort((a, b) => a[2] - b[2]);
  for (let n = 0; n < Math.min(60, cand.length); n++) {
    const [i, j] = cand[n], len = Math.sqrt(cand[n][2]), steps = Math.ceil(len * 2) + 1; let ok = true;
    for (let k = 1; k < steps && ok; k++) { const t = k / steps, x = Math.floor(ci + 0.5 + (i - ci) * t), z = Math.floor(cj + 0.5 + (j - cj) * t);
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) { const xx = x + ox, zz = z + oz; if (xx < 0 || zz < 0 || xx >= G || zz >= G) continue; const kk = idx(xx, zz); if (trail[kk] === p.id && !recent.has(kk)) { ok = false; break; } } }
    if (ok) return [i, j];
  }
  return homeCell(p);
}
function homeCell(p) {      // own cell next to where this trail started: going back there never crosses the trail itself
  const c = p.trailCells[0], ci = c % G, cj = (c - ci) / G; let best = null, bd = 1e9;
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= G || j >= G || own[idx(i, j)] !== p.id) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i, j]; } }
  return best || nearestOwn(p);
}
function threatened(p) {   // an enemy head close to my trail or to me while outside
  if (!p.out) return false;
  const R1 = p.isP ? 6.5 : 4.2, R2 = p.isP ? 4.8 : 3.2;
  for (const q of players) { if (q === p || q.dead) continue; const dq = Math.hypot(q.x - p.x, q.z - p.z); if (dq < R1) return true;
    for (let n = Math.max(0, p.trailCells.length - 40); n < p.trailCells.length; n += 3) { const c = p.trailCells[n]; const cx = toWorld(c % G + 0.5), cz = toWorld(Math.floor(c / G) + 0.5); if (Math.hypot(q.x - cx, q.z - cz) < R2) return true; } }
  return false;
}
function think(p, sec, careful) {
  const ai = p.ai; ai.think -= sec;
  // hunt: a juicy trail close by?
  if (!careful && level >= 2) for (const q of players) { if (q === p || q.dead || !q.out || !q.trailCells.length) continue;
    const c = q.trailCells[Math.floor(q.trailCells.length / 2)], cx = toWorld(c % G + 0.5), cz = toWorld(Math.floor(c / G) + 0.5);
    if (Math.hypot(cx - p.x, cz - p.z) < 5 * ai.daring && r() < 0.03 * ai.daring) { ai.wps = [[cx, cz]]; ai.k = 0; } }
  if (p.out && threatened(p) && ai.mode !== 'home') { const [i, j] = p.trailCells.length ? safeHome(p) : nearestOwn(p); ai.wps = [[toWorld(i + 0.5), toWorld(j + 0.5)]]; ai.k = 0; ai.mode = 'home'; }
  if (!ai.wps.length || ai.k >= ai.wps.length) {
    ai.mode = 'loop';
    if (p.out) { const [i, j] = p.trailCells.length ? safeHome(p) : nearestOwn(p); ai.wps = [[toWorld(i + 0.5), toWorld(j + 0.5)]]; ai.k = 0; ai.mode = 'home'; }
    else {
      // plan a rectangle loop out into the open: out L, across W, back L
      const lim = G * CS / 2 - 1.5; let bestA = 0, bestFree = -1;
      for (let a = 0; a < 8; a++) { const ang = a / 8 * 6.283; let free = 0; for (let s = 1; s < 14; s++) { const i = toCell(p.x + Math.sin(ang) * s * CS * 1.5), j = toCell(p.z - Math.cos(ang) * s * CS * 1.5); if (i < 1 || j < 1 || i >= G - 1 || j >= G - 1) break; if (own[idx(i, j)] !== p.id) free++; }
        if (careful) for (const q of players) { if (q === p || q.dead) continue; const dx = q.x - p.x, dz = q.z - p.z, dd = Math.hypot(dx, dz); if (dd < 12) { const cosA = (dx * Math.sin(ang) - dz * Math.cos(ang)) / (dd || 1); if (cosA > -0.2) free -= (12 - dd) * 2 * (cosA + 0.6); } }
        if (free + r() * 3 > bestFree) { bestFree = free + r() * 3; bestA = ang; } }
      const L = (careful ? 4.2 : 3) + r() * (careful ? 2.8 : 4 * ai.daring), W = (careful ? 4.5 : 3) + r() * (careful ? 3 : 4 * ai.daring), sgn = r() < 0.5 ? -1 : 1;
      const fx = Math.sin(bestA), fz = -Math.cos(bestA), sx = -fz * sgn, sz = fx * sgn;
      const cl = (v) => clamp(v, -lim, lim);
      const p1 = [cl(p.x + fx * L), cl(p.z + fz * L)], p2 = [cl(p1[0] + sx * W), cl(p1[1] + sz * W)], p3 = [cl(p2[0] - fx * (L + 1.5)), cl(p2[1] - fz * (L + 1.5))];
      ai.wps = [p1, p2, p3]; ai.k = 0;
    }
  }
  const w = ai.wps[ai.k]; if (!w) return;
  const dx = w[0] - p.x, dz = w[1] - p.z;
  if (Math.hypot(dx, dz) < 0.7 || (ai.mode === 'home' && !p.out && ai.k === ai.wps.length - 1)) { ai.k++; return; }
  p.want = Math.atan2(dx, -dz);
}

// ---------------------------------------------------------------- input: joystick-style swipe
let botOn = false, joy = null;
input({
  onDown: (e) => { botOn = false; joy = { x: e.clientX, y: e.clientY }; },
  onMove: (dx, dy, e) => { if (!joy || state !== 'play') return; const vx = e.clientX - joy.x, vy = e.clientY - joy.y; if (Math.hypot(vx, vy) > 8) players[0].want = Math.atan2(vx, -vy);
    if (Math.hypot(vx, vy) > 60) { joy.x = e.clientX - vx * 0.6; joy.y = e.clientY - vy * 0.6; } },
  onUp: () => { joy = null; },
});
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; save.set('level', level); buildLevel(); state = 'play'; }
  else if (w === 'lose') { score = 0; buildLevel(); state = 'play'; }
});
const ord = (n) => '#' + n;

// ---------------------------------------------------------------- loop
const camPos = new THREE.Vector3(); let shake = 0, fpsN = 0, fpsT = 0, fps = 0;
loop((dt, t) => {
  fpsN++; if (t - fpsT > 1) { fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; }
  const sec = dt / 60, me = players[0];
  if (state === 'play') {
    elapsed += sec;
    for (const p of players) { if (!p.isP && !p.dead) think(p, sec, false); if (p.isP && botOn && !p.dead) think(p, sec, true); }
    for (const p of players) stepPlayer(p, sec);
    const pct = me.count / (G * G);
    ui.progress(pct / goal); ui.score((pct * 100).toFixed(1) + '%');
    const rank = 1 + players.filter(q => q !== me && q.count > me.count).length; ui.sub(`Rank ${ord(rank)} · goal ${Math.round(goal * 100)}%`);
    if (state === 'play' && pct >= goal) {
      state = 'won'; F.level(true); WB.submit(1); score += Math.round(pct * 1000) + level * 20; best = Math.max(best, score); save.set('best', best);
      sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, new THREE.Vector3(me.x, 1.5, me.z), 90);
      ui.pop('TURF CLAIMED!', '#ff4fa3', 46, 26); ui.win(level, `${(pct * 100).toFixed(1)}% of the map · rank ${ord(rank)}`);
    }
  }
  if (dirtyO) { texO.needsUpdate = true; dirtyO = false; }
  if (dirtyT) { texT.needsUpdate = true; dirtyT = false; }
  for (const p of players) {
    if (p.dead) continue;
    p.squash = Math.max(0, p.squash - 0.06 * dt); if (p.pop) { p.pop = Math.max(0, p.pop - 0.05 * dt); }
    const s = 1 - (p.pop || 0) ** 2, bob = Math.abs(Math.sin(t * 9 + p.id)) * 0.08;
    p.g.position.set(p.x, 0.16 + bob, p.z); p.g.rotation.y = -p.h; p.g.scale.set(s * (1 + p.squash * 0.18), s * (1 - p.squash * 0.15), s * (1 + p.squash * 0.18));
    p.g.body.rotation.x = p.out ? -0.12 : 0;
  }
  // camera: high, slightly tilted, centred a bit ahead of the player
  const want = new THREE.Vector3(me.x + Math.sin(me.h) * 1.5, 25, me.z - Math.cos(me.h) * 1.5 + 12);
  camPos.lerp(want, 1 - Math.pow(0.9, dt));
  camera.position.copy(camPos); if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.z += (Math.random() - 0.5) * shake; shake *= 0.9; }
  camera.lookAt(camPos.x, 0, camPos.z - 12);
  followLight(new THREE.Vector3(me.x, 0, me.z));
});

buildLevel();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get fps() { return Math.round(fps); },
  get dbg() { const me = players[0]; return { why: window.__why, pct: me.count / (G * G), goal, out: me.out, trail: me.trailCells.length, G }; },
  bot() { if (state === 'play') botOn = true; },
};

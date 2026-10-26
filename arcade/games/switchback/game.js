// Switchback — original endless runner on a cliff-edge path. The ball rolls along a zig-zag wall of columns;
// tap to switch direction at every corner. Gems are bonus, the path crumbles behind you, and it keeps getting faster.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, note, burst, confetti, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';

const COLH = 16, CAP = 170, AHEAD = 46, BALL_R = 0.2, TIER = 40;
const HUES = [212, 268, 330, 18, 160, 190, 45];                 // path hue per tier (blue → purple → pink → ...)
const S = store('switchback');
let best = S.get('best', 0), plays = S.get('plays', 0);
const F = flow('switchback', { par: 60, warmup: 15 });
const WB = worldBoard({ game: 'switchback', label: 'Points', limits: { maxRun: 1500, maxPerSec: 10 } });

const stage = createStage({ fov: 19, shadows: false });
const { scene, camera } = stage;
stage.hemi.intensity = 1.1; stage.sun.intensity = 1.2;
const ui = createUI({ title: 'SWITCH<br>BACK', hint: 'Tap to turn', hand: '👆' });

// ---------------------------------------------------------------- flat-shaded column (top bright, two visible sides darker)
function shadedBox() {
  const g = new THREE.BoxGeometry(1, COLH, 1), n = g.attributes.position.count, c = new Float32Array(n * 3);
  const shade = [0.6, 0.8, 1.0, 0.5, 0.6, 0.64];          // px nx py ny pz nz ; camera sits on the -x/-z side
  for (let v = 0; v < n; v++) { const s = shade[Math.floor(v / 4)]; const y = g.attributes.position.getY(v); const f = s * (y > 0 ? 1 : 0.82); c[v * 3] = c[v * 3 + 1] = c[v * 3 + 2] = f; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.translate(0, -COLH / 2, 0); return g;
}
const colMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#7aa7ff' });
const cols = new THREE.InstancedMesh(shadedBox(), colMat, CAP); cols.frustumCulled = false; scene.add(cols);
// soft glow on the tile under the ball (like a light pool)
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,0.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
const pool = new THREE.Mesh(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
scene.add(pool);
const gemGeo = new THREE.OctahedronGeometry(0.22, 0); gemGeo.scale(1, 1.35, 1);
const gemMat = new THREE.MeshStandardMaterial({ color: '#ff3fb4', emissive: '#ff2fa0', emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.1, flatShading: true });
const gems = new THREE.InstancedMesh(gemGeo, gemMat, 24); gems.frustumCulled = false; scene.add(gems);
const gemShadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.15, depthWrite: false }), 24); gemShadow.frustumCulled = false; scene.add(gemShadow);
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), new THREE.MeshStandardMaterial({ color: '#2a2a33', roughness: 0.25, metalness: 0.2 }));
scene.add(ball);
const trail = [];
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 0.6, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 })); scene.add(m); trail.push({ m, x: 0, z: 0 }); }
// faint dust specks floating below the path (depth cue on a plain background)
const dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#8a90a8', transparent: true, opacity: 0.5 }), 40); dust.frustumCulled = false; scene.add(dust);
const dustD = []; for (let i = 0; i < 40; i++) dustD.push({ x: (Math.random() - 0.5) * 20, y: -2 - Math.random() * 8, z: (Math.random() - 0.5) * 20 });

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();

// ---------------------------------------------------------------- world state
let state = 'ready', tiles = [], map = new Map(), path = [], gemList = [], R, score = 0, gemsGot = 0, tier = 1;
let bx = 0, bz = 0, by = 0, vy = 0, dir = 1, speed = 3.2, pathIdx = -1, camX = 0, camZ = 0, botPending = false, hue = HUES[0], hueT = HUES[0], clock = 0, squash = 0;
let genX = 0, genZ = 0, genDir = 1, genRun = 0;
const key = (x, z) => x + ',' + z;

function addTile(x, z, idx, gem) {
  const t = { x, z, idx, y: 0, vy: 0, falling: false, slot: tiles.length % CAP, born: clock };
  tiles.push(t); map.set(key(x, z), t);
  if (gem) gemList.push({ x, z, t, got: false, ph: Math.random() * 6 });
  return t;
}
function extend() {          // append path cells until we are AHEAD cells past the ball
  while (path.length < pathIdx + AHEAD) {
    if (genRun <= 0) {
      genDir = 1 - genDir;
      const lateral = genX - genZ;                       // keep the path inside a corridor on screen
      genRun = 1 + Math.floor(R() * (R() < 0.35 ? 5 : 3));
      if (lateral > 4 && genDir === 0) genRun = 1; if (lateral < -4 && genDir === 1) genRun = 1;
    }
    if (genDir === 0) genX++; else genZ++;
    genRun--;
    const idx = path.length; path.push([genX, genZ]);
    const gem = idx > 6 && R() < 0.075;
    addTile(genX, genZ, idx, gem);
  }
}
function reset() {
  tiles = []; map.clear(); path = []; gemList = []; R = rng(Date.now() % 100000 + 7);
  score = 0; gemsGot = 0; tier = 1; speed = 3.4 * F.k(0); dir = 1; pathIdx = -1; botPending = false; squash = 0;
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) addTile(x, z, -1, false);
  genX = 0; genZ = 1; genDir = 1; genRun = 3; path.push([0, 1]); map.get(key(0, 1)).idx = 0;   // platform edge cell is path[0]
  extend();
  bx = 0; bz = 0; by = 0; vy = 0; camX = 0; camZ = 0;
  for (let i = 0; i < CAP; i++) { _m.makeScale(0, 0, 0); cols.setMatrixAt(i, _m); }
  hue = hueT = HUES[0]; ball.visible = true;
  ui.score(0); ui.levels(1); ui.progress(0); ui.sub(best ? 'BEST ' + best : '');
}
function setColors() {
  _c.setHSL(hue / 360, 0.78, 0.7); colMat.color.copy(_c);
  const a = new THREE.Color().setHSL(hue / 360, 0.35, 0.97), b = new THREE.Color().setHSL(((hue + 30) % 360) / 360, 0.45, 0.9);
  const bs = document.body.style; bs.setProperty('--bg1', '#' + a.getHexString()); bs.setProperty('--bg2', '#' + b.getHexString());
  bs.setProperty('--ui', '#' + new THREE.Color().setHSL(hue / 360, 0.6, 0.55).getHexString());
}

function turn() {
  if (state !== 'play') return;
  dir = 1 - dir; squash = 1; tone(dir ? 620 : 540, 0.04, 'sine', 0.09, 1.1); buzz(6);
}
function lose() {
  state = 'lost'; F.endless(score); WB.submit(score); plays++; S.set('plays', plays); best = Math.max(best, score); S.set('best', best);
  tone(220, 0.25, 'triangle', 0.12, 0.4); buzz([30, 30, 60]);
  ui.lose(String(score), `BEST ${best} · 💎 ${gemsGot}`);
  setTimeout(() => state === 'lost' && ui.els.sc.classList.add('hc-hidden'), 650);
}

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first level, until the first
// real touch, the ball turns by itself at the centre of each corner (no points while it does), so it shows what a tap does
const D = demo(null, { ready: () => state === 'play' && tier === 1, wait: 250, ms: 4500 });
function demoTurn() {
  if (!D.on) return;
  for (let m = Math.max(0, pathIdx); m < path.length - 1; m++) {
    const a = path[m], b = path[m + 1]; if ((b[0] > a[0] ? 0 : 1) === dir) continue;
    const dist = dir === 0 ? a[0] - bx : a[1] - bz; if (dist <= 0.02 && dist > -0.3) turn(); return;
  }
}
input({ onDown: () => { if (state === 'play') turn(); } });
ui.onTap(which => { WB.start(); if (which !== 'start') reset(); state = 'play'; ui.els.sc.classList.remove('hc-hidden'); });

// ---------------------------------------------------------------- loop
const OFF = new THREE.Vector3(-24, 25, -24);
loop((dt, t) => {
  clock += dt / 60;
  if (state === 'play' || state === 'lost') {
    if (state === 'play') demoTurn();
    const step = speed / 60 * dt;
    if (state === 'play' || by > -0.5) { if (dir === 0) bx += step * (state === 'lost' ? 0.6 : 1); else bz += step * (state === 'lost' ? 0.6 : 1); }
    const here = map.get(key(Math.round(bx), Math.round(bz)));
    const onTile = here && !here.falling && by >= -0.05;
    if (state === 'play') {
      if (!onTile) { state = 'falling'; }
      else {
        if (here.idx > pathIdx) {                       // reached a new tile: score + speed up
          const gained = here.idx - pathIdx; pathIdx = here.idx; if (!D.on) score += Math.max(0, gained); ui.score(score);
          speed = Math.min(7.6, (3.4 + score * 0.018) * F.k(score));
          const nt = Math.floor(score / TIER) + 1;
          if (nt > tier) { tier = nt; ui.levels(tier); hueT = HUES[(tier - 1) % HUES.length]; ui.pop(`LEVEL ${tier}!`, '#fff', 38, 30); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s, 0.35, 0.14), i * 80)); confetti(scene, new THREE.Vector3(bx, 1, bz), 40); }
          ui.progress((score % TIER) / TIER);
          extend();
        }
      }
    }
  }
  if (state === 'falling' || state === 'lost') {
    if (state === 'falling') { state = 'lost'; lose(); vy = 0; }
    vy -= 0.012 * dt; by += vy * dt;
  }
  hue = lerp(hue, hueT + (hueT < hue - 180 ? 360 : 0), 0.02 * dt) % 360; setColors();
  // gems: spin, collect
  let gi = 0;
  for (const g of gemList) {
    if (g.got && g.t2 > 1) continue;
    if (!g.got && state === 'play' && Math.abs(g.x - bx) < 0.45 && Math.abs(g.z - bz) < 0.45) {
      g.got = true; g.t2 = 0; gemsGot++; score += 2; ui.score(score); ui.pop('+2', '#ff3fb4', 30, 40);
      burst(scene, new THREE.Vector3(g.x, 0.5, g.z), ['#ff3fb4', '#ff9be0', '#ffffff'], 12, { speed: 0.05, up: 0.06, size: 0.5, gravity: 0.003 });
      note(84 + (gemsGot % 5) * 2, 0.25, 0.12); buzz(10);
    }
    if (gi >= 24) break;
    const y = g.t.y + 0.42 + Math.sin(clock * 3 + g.ph) * 0.07;
    let sc = 1; if (g.got) { g.t2 += dt * 0.08; sc = Math.max(0, 1 - g.t2); }
    _m.compose(_p.set(g.x, y + (g.got ? g.t2 : 0), g.z), _q.setFromEuler(_e.set(0, clock * 2 + g.ph, 0)), _s.setScalar(sc)); gems.setMatrixAt(gi, _m);
    _m.compose(_p.set(g.x, g.t.y + 0.01, g.z), _q.identity(), _s.setScalar(g.got || g.t.falling ? 0 : 1)); gemShadow.setMatrixAt(gi, _m);
    gi++;
  }
  for (let i = gi; i < 24; i++) { _m.makeScale(0, 0, 0); gems.setMatrixAt(i, _m); gemShadow.setMatrixAt(i, _m); }
  gems.instanceMatrix.needsUpdate = true; gemShadow.instanceMatrix.needsUpdate = true;
  gemList = gemList.filter(g => !(g.t.falling && g.t.y < -15) && !(g.got && g.t2 > 1));
  // tiles: rise in ahead, crumble behind
  const behind = pathIdx - 3;
  for (const tl of tiles) {
    const k = tl.idx < 0 ? 2 : tl.idx;
    if (!tl.falling && k < behind && state !== 'ready') { tl.falling = true; tl.vy = 0; }
    if (tl.falling) { tl.vy -= 0.008 * dt; tl.y += tl.vy * dt; }
  }
  for (let i = tiles.length - 1; i >= 0; i--) if (tiles[i].y < -18) { map.delete(key(tiles[i].x, tiles[i].z)); tiles.splice(i, 1); }
  // write instances (slot by order)
  let n = 0;
  for (const tl of tiles) {
    if (n >= CAP) break;
    const age = clock - tl.born, rise = tl.idx > 0 && age < 0.5 ? (1 - age / 0.5) ** 2 * -3 : 0;
    _m.makeTranslation(tl.x, tl.y + rise, tl.z); cols.setMatrixAt(n++, _m);
  }
  for (let i = n; i < CAP; i++) { _m.makeScale(0, 0, 0); cols.setMatrixAt(i, _m); }
  cols.instanceMatrix.needsUpdate = true;
  // ball
  squash = Math.max(0, squash - dt * 0.12);
  ball.position.set(bx, by + BALL_R, bz); ball.scale.set(1 + squash * 0.2, 1 - squash * 0.2, 1 + squash * 0.2);
  ball.rotation.x += (dir === 1 ? speed : 0) / 60 * dt / BALL_R; ball.rotation.z -= (dir === 0 ? speed : 0) / 60 * dt / BALL_R;
  pool.position.set(bx, 0.005 + (map.get(key(Math.round(bx), Math.round(bz)))?.y || 0), bz); pool.material.opacity = state === 'play' ? 0.55 : 0;
  // little white trail
  trail.forEach((tr, i) => { tr.m.position.set(bx - (dir === 0 ? 1 : 0) * (i + 1) * 0.12, by + BALL_R, bz - (dir === 1 ? 1 : 0) * (i + 1) * 0.12); tr.m.material.opacity = state === 'play' ? 0.35 * (1 - i / trail.length) * clamp(speed / 7, 0.3, 1) : 0; tr.m.scale.setScalar(1 - i / trail.length * 0.7); });
  // camera follows along the diagonal
  camX = lerp(camX, bx, 0.08 * dt); camZ = lerp(camZ, bz, 0.08 * dt);
  const cx = state === 'ready' ? 0 : camX, cz = state === 'ready' ? 0 : camZ;
  camera.position.set(cx + 1.6 + OFF.x, OFF.y, cz + 1.6 + OFF.z); camera.lookAt(cx + 1.6, -0.6, cz + 1.6);
  dustD.forEach((d, i) => { const x = cx + d.x, z = cz + d.z; _m.compose(_p.set(x, d.y + Math.sin(clock + i) * 0.2, z), camera.quaternion, _s.setScalar(1)); dust.setMatrixAt(i, _m); });
  dust.instanceMatrix.needsUpdate = true;
});

reset(); setColors(); ui.start(); ui.els.sc.classList.add('hc-hidden');

// ---------------------------------------------------------------- test hook + bot (schedule the tap for the centre of the next corner)
window.__game = {
  get state() { return state; }, get level() { return tier; }, get score() { return score; },
  bot() {
    if (state !== 'play' || botPending) return;
    const k = Math.max(0, pathIdx);
    for (let m = k; m < path.length - 1; m++) {
      const a = path[m], b = path[m + 1], d = b[0] > a[0] ? 0 : 1;
      if (d === dir) continue;
      const dist = dir === 0 ? a[0] - bx : a[1] - bz;          // distance along travel to that corner's centre
      if (dist < -0.2) return;
      const ms = dist / speed * 1000;
      if (ms < 160) { botPending = true; setTimeout(() => { botPending = false; if (state === 'play') turn(); }, Math.max(0, ms + (Math.random() - 0.5) * 30)); }
      return;
    }
  },
};

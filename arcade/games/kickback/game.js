// Kickback — original game. Every tap fires your floating pistol; the recoil flips it through the air.
// Shoot every red gun in the arena, dodge their fire, don't fall out the bottom.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { particles } from './fx.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
const B = board({ game: 'kickback', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const stage = createStage({ fov: 30, shadows: true, shadowSize: 11 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'KICK<br>BACK', hint: 'Tap to shoot', hand: '👆' });
document.body.style.setProperty('--bg1', '#9a9da3'); document.body.style.setProperty('--bg2', '#7f8288'); document.body.style.setProperty('--ui', '#2f8dff');
const css = document.createElement('style');
css.textContent = `.hc-card h1{letter-spacing:1px}.hc-score{font-size:44px}.hc-card{padding-top:calc(190px + env(safe-area-inset-top))}.hc-pop{text-shadow:0 3px 0 rgba(0,0,0,.45),0 0 12px rgba(0,0,0,.35)!important}`;
document.head.appendChild(css);
const save = store('kickback');
const F = flow('kickback');
let fk = 1;
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';

// ------------------------------------------------------------------ arena (world units: x -4.5..4.5, y 0..15)
const AW = 4.5; let AH = 15;
sun.position.set(4, 18, 16); sun.target.position.set(0, 7.5, 0); sun.intensity = 1.9;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 11, bottom: -11 }); sun.shadow.camera.updateProjectionMatrix();
stage.hemi.intensity = 1.25;
const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#8f9298', { roughness: 0.95 })); wall.position.set(0, 7.5, -1.6); wall.receiveShadow = true; scene.add(wall);
function concreteTex(base, n, seed) {   // speckled panel texture
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.04})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
wall.material.map = concreteTex('#ffffff', 3000, 3); wall.material.map.repeat.set(6, 6);
const frame = new THREE.Mesh(rounded(AW * 2 + 0.7, AH + 0.7, 0.6, 0.12), mat('#a7aab0', { roughness: 0.8 })); frame.position.set(0, AH / 2, -1.25); frame.receiveShadow = true; scene.add(frame);
const panelMat = mat('#323338', { roughness: 0.9 }); panelMat.map = concreteTex('#ffffff', 2500, 7); panelMat.map.repeat.set(2, 3);
const panel = new THREE.Mesh(new THREE.PlaneGeometry(AW * 2, AH), panelMat); panel.position.set(0, AH / 2, -0.9); panel.receiveShadow = true; scene.add(panel);
// bottom hazard strip: fall into it and you're out
const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#ffcf33'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#2b2b2b'; for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, 32); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const pit = new THREE.Mesh(new THREE.BoxGeometry(AW * 2, 0.35, 0.5), mat('#ffffff', { map: stripeTex })); pit.position.set(0, -0.05, -0.6); pit.receiveShadow = true; scene.add(pit);
// diamond-plate gold texture for ricochet plates
const goldTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#e7b928'); gr.addColorStop(1, '#c99a14'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 128; x += 16) { g.save(); g.translate(x + 4, y + 8); g.rotate(((x + y) / 16) % 2 ? 0.7 : -0.7); g.fillStyle = 'rgba(255,240,170,.75)'; g.fillRect(-5, -1.4, 10, 2.8); g.fillStyle = 'rgba(120,80,0,.35)'; g.fillRect(-5, 1.4, 10, 1.2); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();

const smoke = particles(scene, { max: 500, additive: false, scale: 520 });
const spark = particles(scene, { max: 400, additive: true, scale: 520 });

// ------------------------------------------------------------------ models
function makeGun(color) {
  const g = new THREE.Group(), model = new THREE.Group(); g.add(model);
  const m = glossy(color, { roughness: 0.35 }), dark = mat('#1d1e22');
  const parts = [
    [rounded(1.36, 0.42, 0.36, 0.07), m, 0.12, 0.14, 0],
    [rounded(1.0, 0.2, 0.32, 0.05), m, 0.02, -0.12, 0],
    [rounded(0.38, 0.82, 0.32, 0.08), m, -0.36, -0.46, -0.22],
    [rounded(0.3, 0.07, 0.2, 0.03), m, 0.06, -0.4, 0],
    [rounded(0.07, 0.24, 0.2, 0.03), m, 0.2, -0.3, 0],
    [new THREE.BoxGeometry(0.12, 0.1, 0.12), m, -0.48, 0.38, 0],
    [new THREE.BoxGeometry(0.08, 0.08, 0.1), m, 0.72, 0.38, 0],
  ];
  for (const [geo, mm, x, y, rz] of parts) { const k = new THREE.Mesh(geo, mm); k.position.set(x, y, 0); k.rotation.z = rz; k.castShadow = true; model.add(k); }
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), dark); hole.rotation.z = Math.PI / 2; hole.position.set(0.81, 0.16, 0); model.add(hole);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0 })); flash.position.set(1.05, 0.16, 0); flash.scale.set(1.6, 0.8, 0.8); model.add(flash);
  g.model = model; g.flash = flash; g.mat = m;
  return g;
}
function makeRobot(color) {
  const g = new THREE.Group(), m = glossy(color, { roughness: 0.4 }), parts = [];
  const box = (w, h, x, y, parent = g) => { const k = new THREE.Mesh(rounded(w, h, 0.34, 0.05), m); k.position.set(x, y, 0); k.castShadow = true; parent.add(k); parts.push(k); return k; };
  const piv = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };
  box(0.62, 0.8, 0, 1.25); box(0.44, 0.42, 0, 1.92);
  const aL = piv(-0.4, 1.55), aR = piv(0.4, 1.55), lL = piv(-0.17, 0.85), lR = piv(0.17, 0.85);
  box(0.18, 0.62, 0, -0.28, aL); box(0.18, 0.62, 0, -0.28, aR); box(0.22, 0.8, 0, -0.4, lL); box(0.22, 0.8, 0, -0.4, lR);
  Object.assign(g, { parts, aL, aR, lL, lR, mat: m });
  return g;
}
function makeCannon() {
  const g = new THREE.Group(), m = glossy('#f2443a', { roughness: 0.4 }), dark = mat('#3a3b40');
  const base = new THREE.Mesh(rounded(1.1, 0.35, 0.8, 0.06), dark); base.position.y = 0.17; base.castShadow = true;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), m); body.position.y = 0.5; body.castShadow = true;
  const bar = new THREE.Group(); bar.position.y = 0.55; const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.0, 16), m); tube.position.y = 0.5; tube.castShadow = true; bar.add(tube);
  g.add(base, body, bar); g.barrel = bar; g.mat = m; return g;
}
const ledgeMat = mat('#6f7279', { roughness: 0.7 }), goldMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: goldTex, roughness: 0.3, metalness: 0.55 });
const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), coinMat = glossy('#ffd23f', { metalness: 0.5, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.3 });

// ------------------------------------------------------------------ state
const player = { g: makeGun('#2f8dff'), x: -2.4, y: 8, vx: 0, vy: 0, a: 0, w: 0, alive: true, live: false, cd: 0, squash: 0 };
player.g.mat.emissive = new THREE.Color('#0a2a66'); player.g.mat.emissiveIntensity = 0.25;
scene.add(player.g);
let enemies = [], bullets = [], solids = [], coins = [], debris = [], killed = 0, total = 0, timeScale = 1, hitStop = 0, slowT = 0, shake = 0, combo = 0, comboT = 0, focus = null;

function clearWorld() {
  for (const e of enemies) scene.remove(e.g);
  for (const b of bullets) scene.remove(b.m);
  for (const s of solids) scene.remove(s.m);
  for (const c of coins) scene.remove(c.m);
  for (const d of debris) scene.remove(d.m);
  enemies = []; bullets = []; solids = []; coins = []; debris = []; smoke.clear(); spark.clear();
}
function addSolid(x, y, w, h, gold = false) {
  const m = new THREE.Mesh(rounded(w, h, 0.5, 0.06), gold ? goldMat : ledgeMat); m.position.set(x, y, -0.3); m.castShadow = m.receiveShadow = true; scene.add(m);
  if (gold) { m.material = goldMat.clone(); m.material.map = goldTex.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(w / 1.2, h / 1.2); }
  solids.push({ x, y, w, h, gold, m });
}
function addEnemy(kind, x, y, o = {}) {
  const e = { kind, x, y, hp: 1, a: Math.PI, alive: true, cd: 1.5 + Math.random() * 1.5, wind: 0, t: Math.random() * 6, by: y, ...o };
  if (kind === 'gun' || kind === 'gold') {
    e.g = makeGun(kind === 'gold' ? '#ffc21a' : '#f2443a'); e.hp = kind === 'gold' ? 2 : 1; e.r = 0.62;
    const laser = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#ff2a1f', transparent: true, opacity: 0, depthWrite: false })); laser.geometry.translate(0.5, 0, 0); e.laser = laser; scene.add(laser);
  } else if (kind === 'robot') { e.g = makeRobot('#f2443a'); e.r = 0.75; e.hp = 1; }
  else if (kind === 'cannon') { e.g = makeCannon(); e.r = 0.7; e.hp = 2; }
  e.g.position.set(x, y, 0); scene.add(e.g); enemies.push(e); return e;
}

// ------------------------------------------------------------------ level generation (seeded)
function genLevel(n) {
  const r = rng(n * 104729 + 7);
  const L = { enemies: [], solids: [], coins: [], start: { x: -2.4, y: 8.5 } };
  if (n === 1) { L.enemies.push({ k: 'gun', x: 2.4, y: 8.5, passive: true }); L.coins.push([0, 11.5]); return L; }
  if (n === 2) { L.enemies.push({ k: 'gun', x: 2.6, y: 11, passive: true }, { k: 'gun', x: 2.2, y: 5.5, fire: 4.5 }); L.coins.push([0, 12], [-1, 5]); return L; }
  const ne = Math.max(2, Math.min(7, Math.round((2 + Math.floor(n / 3)) * fk)));
  const occupied = [[L.start.x, L.start.y]];
  const free = (x, y, d = 2.2) => occupied.every(([a, b]) => Math.hypot(a - x, b - y) > d);
  // a gold ricochet ceiling or floor plate, or a small floating one
  if (n >= 3 && r() < 0.55) { if (r() < 0.5) L.solids.push({ x: 0, y: AH - 0.25, w: AW * 2, h: 0.5, gold: true }); else L.solids.push({ x: (r() - 0.5) * 3, y: 6 + r() * 5, w: 1.8, h: 0.3, gold: true }); }
  let tries = 0;
  while (L.enemies.length < ne && tries++ < 200) {
    const kinds = ['gun', 'gun']; if (n >= 3) kinds.push('robot'); if (n >= 5) kinds.push('cannon'); if (n >= 6) kinds.push('gold');
    const k = kinds[Math.floor(r() * kinds.length)];
    if (k === 'cannon') { const x = (r() - 0.5) * 6; if (!free(x, 1.4, 2.5)) continue; L.solids.push({ x, y: 0.6, w: 1.6, h: 0.5 }); L.enemies.push({ k, x, y: 0.85 }); occupied.push([x, 1.4]); continue; }
    const x = -3.4 + r() * 6.8, y = 3 + r() * (AH - 4.5);
    if (!free(x, y, k === 'robot' ? 2.8 : 2.2) || Math.abs(x - L.start.x) < 1.8 && Math.abs(y - L.start.y) < 3) continue;
    if (k === 'robot') { L.solids.push({ x, y: y - 0.15, w: 1.5, h: 0.3 }); L.enemies.push({ k, x, y: y }); occupied.push([x, y + 1]); }
    else { L.enemies.push({ k, x, y, fire: Math.max(1.45, (4 - n * 0.15) / fk) }); occupied.push([x, y]); }
  }
  if (n >= 4 && r() < 0.5) { const x = (r() - 0.5) * 6, y = 4 + r() * 7; if (free(x, y, 2)) L.solids.push({ x, y, w: 1.6 + r(), h: 0.32 }); }
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) { const x = (r() - 0.5) * 7, y = 3 + r() * 10; if (free(x, y, 1.4)) { L.coins.push([x, y]); occupied.push([x, y]); } }
  return L;
}
function fitArena() {   // portrait phones get a taller arena so it fills the screen
  const vf = THREE.MathUtils.degToRad(camera.fov), asp = camera.aspect;
  const H = asp < 0.75 ? (AW * 2 + 0.9) / asp : 19;
  AH = clamp(H - 4.3, 14, 17.5);
  frame.scale.y = (AH + 0.7) / 15.7; frame.position.y = AH / 2; panel.scale.y = AH / 15; panel.position.y = AH / 2;
}
function buildLevel() {
  clearWorld(); fitArena();
  fk = F.k(); const L = genLevel(level);
  for (const s of L.solids) addSolid(s.x, s.y, s.w, s.h, s.gold);
  for (const e of L.enemies) addEnemy(e.k, e.x, e.y, { passive: !!e.passive, rate: e.fire || 3 });
  for (const [x, y] of L.coins) { const m = new THREE.Mesh(coinGeo, coinMat); m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); m.castShadow = true; scene.add(m); coins.push({ m, x, y, t: Math.random() * 6 }); }
  Object.assign(player, { x: L.start.x, y: L.start.y, vx: 0, vy: 0, a: 0, w: 0, alive: true, live: false, cd: 0 });
  player.g.visible = true; player.g.rotation.z = 0;
  killed = 0; total = enemies.length; slowT = 0; timeScale = 1; combo = 0; focus = null;
  ui.levels(level); ui.progress(0); ui.score(score); ui.sub(best ? 'BEST ' + best : '');
}

// ------------------------------------------------------------------ shooting
const G = 11.5, RECOIL = 7.0, LIFT = 3.0, KICK = 6, SPIN = 3.4, BULLET = 30;
const muzzle = (o, len = 1.05) => { const s = o === player ? 1 : Math.cos(o.a) >= 0 ? 1 : -1; const c = Math.cos(o.a), si = Math.sin(o.a); const ly = 0.16 * s; return new THREE.Vector3(o.x + c * len - si * ly, o.y + si * len + c * ly, 0); };
function spawnBullet(from, a, enemy, speed = BULLET) {
  const col = enemy ? '#ff3b30' : '#46a8ff';
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: col }));
  m.geometry.translate(-0.5, 0, 0); scene.add(m);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); m.add(head);
  bullets.push({ m, x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, enemy, trail: [[from.x, from.y]], life: 2.2, bounces: 0, dead: false, ball: false });
}
function shoot() {
  if (!player.alive || state !== 'play' || player.cd > 0) return;
  player.cd = 0.11;
  const mz = muzzle(player); let a = player.a;
  // tiny aim assist: bend toward an enemy within ~12°
  let bestD = 0.21; for (const e of enemies) { if (!e.alive) continue; const ea = Math.atan2(e.y + (e.kind === 'robot' ? 1.2 : 0) - mz.y, e.x - mz.x); let d = Math.atan2(Math.sin(ea - a), Math.cos(ea - a)); if (Math.abs(d) < bestD) { bestD = Math.abs(d); a = player.a + d * 0.85; } }
  spawnBullet(mz, a, false);
  const s = player.w === 0 ? 1 : Math.sign(player.w);
  player.vx -= Math.cos(player.a) * RECOIL; player.vy -= Math.sin(player.a) * RECOIL; player.vy += LIFT;
  player.vy = Math.max(player.vy, -4); player.w += KICK * s; player.live = true; player.squash = 1;
  player.g.flash.material.opacity = 1;
  smoke.emit(mz, { color: '#d9dbe0', n: 6, speed: 1.2, size: 0.35, size1: 0.9, life: 0.9, drag: 2, alpha: 0.55, g: -0.6 });
  spark.emit(mz, { color: '#ffd27a', n: 8, speed: 7, size: 0.12, life: 0.25, dir: { x: Math.cos(a), y: Math.sin(a) }, spread: 0.7 });
  tone(180, 0.09, 'square', 0.11, 0.35); tone(900, 0.04, 'sawtooth', 0.05, 0.4); buzz(10);
  shake = Math.max(shake, 0.08);
}
input({ onDown: () => { if (state === 'play') shoot(); } });
ui.onTap(w => { B.start();
  if (w === 'start') { state = 'play'; buildLevel(); }
  else if (w === 'win') { level++; save.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { score = 0; state = 'play'; buildLevel(); }
});

// ------------------------------------------------------------------ outcomes
function addScore(n) { score += n; ui.score(score); if (score > best) { best = score; save.set('best', best); } }
function shatter(group, color, at, dir) {
  group.updateMatrixWorld(true);
  const meshes = []; group.traverse(o => { if (o.isMesh && o !== group.flash) meshes.push(o); });
  for (const o of meshes) {
    scene.attach(o);
    debris.push({ m: o, vx: dir.x * (3 + Math.random() * 5) + (Math.random() - 0.5) * 6, vy: dir.y * 4 + 3 + Math.random() * 6, w: (Math.random() - 0.5) * 18, life: 2.4 });
  }
  scene.remove(group);
  burst(scene, at, color, 14, { speed: 0.14, up: 0.08, size: 0.9 });
  spark.emit(at, { color: '#ffe08a', n: 26, speed: 9, size: 0.16, life: 0.4 });
  smoke.emit(at, { color: '#cfd2d8', n: 10, speed: 2, size: 0.5, size1: 1.4, life: 1.1, alpha: 0.5 });
}
function hitEnemy(e, b) {
  e.hp--; e.flash = 1;
  spark.emit(new THREE.Vector3(b.x, b.y, 0.2), { color: '#fff1a8', n: 12, speed: 6, size: 0.12, life: 0.3 });
  tone(1400, 0.05, 'square', 0.05, 0.5);
  if (e.hp > 0) { e.x += b.vx * 0.012; e.y += b.vy * 0.012; return; }
  e.alive = false; killed++; combo++; comboT = 2;
  const at = new THREE.Vector3(e.x, e.y + (e.kind === 'robot' ? 1.2 : e.kind === 'cannon' ? 0.5 : 0), 0.3);
  if (e.laser) scene.remove(e.laser);
  shatter(e.g, e.kind === 'gold' ? '#ffc21a' : '#f2443a', at, new THREE.Vector3(b.vx, b.vy, 0).normalize());
  sfx.smash(); buzz([20, 20, 30]); hitStop = 0.08; shake = Math.max(shake, 0.3);
  addScore(10 * combo);
  ui.pop(combo >= 2 ? `DOUBLE HIT!`.replace('DOUBLE', ['', '', 'DOUBLE', 'TRIPLE', 'MULTI', 'MEGA'][Math.min(5, combo)]) : ['BANG!', 'NICE SHOT!', 'BOOM!', 'GOT HIM!'][Math.floor(Math.random() * 4)], combo >= 2 ? '#ffd23f' : '#ffffff', 34 + combo * 3, 22);
  ui.progress(killed / total);
  if (killed === total) { slowT = 1.3; focus = at.clone(); ui.flash(0.4); }
}
function lose(why) {
  if (state !== 'play') return;
  state = 'lost'; F.level(false, killed / Math.max(1, total)); player.alive = false; window.__why = why;
  shatter(player.g, '#2f8dff', new THREE.Vector3(player.x, player.y, 0.3), new THREE.Vector3(player.vx, player.vy, 0).normalize());
  sfx.fail(); buzz([60, 40, 80]); shake = 0.6; ui.flash(0.45);
  ui.lose(why === 'fell' ? 'FELL OUT!' : 'SHOT DOWN!', `${killed}/${total} guns down`);
}
function win() {
  if (state !== 'play') return;
  if (state === 'play') B.submit(1); state = 'won'; F.level(true); sfx.win(); buzz([20, 40, 20]);
  confetti(scene, new THREE.Vector3(0, 10, 1), 70);
  addScore(25 * level);
  ui.win(level, `${score} pts`);
}

// ------------------------------------------------------------------ physics helpers
function circleVsBox(o, r, s) {
  const cx = clamp(o.x, s.x - s.w / 2, s.x + s.w / 2), cy = clamp(o.y, s.y - s.h / 2, s.y + s.h / 2);
  const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
  if (d >= r || d === 0) return null; return { nx: dx / d, ny: dy / d, pen: r - d };
}
function gunBounce(nx, ny, pen, soft = 0.45) {
  player.x += nx * pen; player.y += ny * pen;
  const vn = player.vx * nx + player.vy * ny;
  if (vn < 0) { player.vx -= (1 + soft) * vn * nx; player.vy -= (1 + soft) * vn * ny; player.w += vn * 0.8 * (nx !== 0 ? Math.sign(nx) : 1); if (vn < -3) { tone(220, 0.05, 'sine', 0.08, 0.7); smoke.emit(new THREE.Vector3(player.x - nx * 0.5, player.y - ny * 0.5, 0), { color: '#b9bcc2', n: 4, speed: 1, size: 0.3, size1: 0.6, life: 0.5, alpha: 0.5 }); } }
  player.vx *= 0.92;
}

// ------------------------------------------------------------------ main loop
let camX = 0, camY = 8.8, camZ = 0;
const P = new THREE.Vector3();
function fitCamera() {   // fit the arena into the screen (portrait: width-bound)
  const vf = THREE.MathUtils.degToRad(camera.fov), asp = camera.aspect;
  const needH = Math.max((AH + 4.4) / 2, (AW * 2 + 0.9) / 2 / asp);
  return needH / Math.tan(vf / 2);
}
loop((dt60) => {
  const rdt = Math.min(dt60 / 60, 0.04);
  let target = 1; if (slowT > 0) { slowT -= rdt; target = 0.18; if (slowT <= 0 && state === 'play') win(); }
  if (hitStop > 0) { hitStop -= rdt; target = Math.min(target, 0.05); }
  timeScale = lerp(timeScale, target, 1 - Math.pow(0.0002, rdt));
  const dt = rdt * (state === 'ready' ? 1 : timeScale);
  const t = performance.now() / 1000;

  // ---- player gun
  if (player.alive) {
    player.cd -= rdt;
    if (player.live && state === 'play') {
      player.vy -= G * dt; player.vx *= 1 - 0.35 * dt; player.vy = Math.max(player.vy, -10);
      player.x += player.vx * dt; player.y += player.vy * dt; player.a += player.w * dt; player.w *= 1 - 2.4 * dt; if (Math.abs(player.w) < SPIN) player.w = Math.sign(player.w || 1) * SPIN;
      if (player.x < -AW + 0.55) gunBounce(1, 0, -AW + 0.55 - player.x);
      if (player.x > AW - 0.55) gunBounce(-1, 0, player.x - (AW - 0.55));
      if (player.y > AH - 0.55) gunBounce(0, -1, player.y - (AH - 0.55));
      for (const s of solids) { const h = circleVsBox(player, 0.5, s); if (h) gunBounce(h.nx, h.ny, h.pen); }
      if (player.y < 0.1) lose('fell');
    } else if (!player.live) { player.y = player.y + Math.sin(t * 2.4) * 0.004; }
    for (const c of coins) if (!c.got && Math.hypot(c.x - player.x, c.y - player.y) < 0.8) { c.got = true; sfx.coin(); addScore(5); spark.emit(c.m.position, { color: '#ffd23f', n: 16, speed: 5, size: 0.14, life: 0.4 }); ui.pop('+5', '#ffd23f', 26, 30); }
    player.squash = Math.max(0, player.squash - rdt * 6);
    const facing = Math.cos(player.a) >= 0 ? 1 : -1;
    player.g.position.set(player.x, player.y, 0); player.g.rotation.z = player.a;
    player.g.model.scale.set(1 + player.squash * 0.12, 1 - player.squash * 0.1, 1);
    player.g.flash.material.opacity = Math.max(0, player.g.flash.material.opacity - rdt * 12);
  }

  // ---- enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += dt; e.flash = Math.max(0, (e.flash || 0) - dt * 5);
    if (e.g.mat) e.g.mat.emissive && (e.g.mat.emissive.setRGB(e.flash, e.flash, e.flash));
    if (e.kind === 'gun' || e.kind === 'gold') {
      const want = Math.atan2(player.y - e.y, player.x - e.x);
      const d = Math.atan2(Math.sin(want - e.a), Math.cos(want - e.a));
      if (state === 'play' && !e.passive) e.a += clamp(d, -1.3 * dt, 1.3 * dt);
      if (state !== 'play' || e.passive) e.a = lerp(e.a, Math.PI + (e.x < 0 ? Math.PI : 0), 0.05);
      const fy = e.by + Math.sin(e.t * 1.7) * 0.15; e.y = lerp(e.y, fy, 0.1);
      e.g.position.set(e.x, e.y, 0); e.g.rotation.z = e.a; e.g.model.scale.y = Math.cos(e.a) >= 0 ? 1 : -1;
      // fire cycle with a laser-sight telegraph
      if (state === 'play' && !e.passive && player.live) {
        e.cd -= dt;
        if (e.cd < 0.75) {
          const mz = muzzle(e); e.laser.position.copy(mz); e.laser.rotation.z = e.a; e.laser.scale.x = 14; e.laser.material.opacity = Math.min(1, 0.35 + (0.75 - Math.max(0, e.cd)) * 1.2) * (0.7 + 0.3 * Math.sin(t * 40));
        } else e.laser.material.opacity = 0;
        if (e.cd <= 0) {
          e.cd = e.rate * (0.8 + Math.random() * 0.4); e.laser.material.opacity = 0;
          const mz = muzzle(e); spawnBullet(mz, e.a, true, 11); e.g.flash.material.opacity = 1; e.w = -6;
          smoke.emit(mz, { color: '#d9dbe0', n: 5, speed: 1, size: 0.3, size1: 0.8, life: 0.8, alpha: 0.5 });
          tone(260, 0.08, 'square', 0.06, 0.4);
        }
      } else if (e.laser) e.laser.material.opacity = 0;
      e.g.flash.material.opacity = Math.max(0, e.g.flash.material.opacity - rdt * 10);
    } else if (e.kind === 'robot') {
      e.g.position.set(e.x, e.y, 0);
      e.g.aL.rotation.z = -0.3 + Math.sin(e.t * 3) * 0.25; e.g.aR.rotation.z = 0.3 - Math.sin(e.t * 3) * 0.25; e.g.rotation.z = Math.sin(e.t * 1.5) * 0.04;
      e.g.scale.x = player.x < e.x ? -1 : 1;
    } else if (e.kind === 'cannon') {
      e.g.position.set(e.x, e.y, 0);
      const want = clamp(Math.atan2(player.y - e.y, player.x - e.x) - Math.PI / 2, -1.1, 1.1); e.g.barrel.rotation.z = lerp(e.g.barrel.rotation.z, want, 0.08);
      if (state === 'play' && player.live) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = Math.max(2.1, (4 - level * 0.08) / fk);
          const ang = e.g.barrel.rotation.z + Math.PI / 2, mz = new THREE.Vector3(e.x + Math.cos(ang) * 1.1, e.y + 0.55 + Math.sin(ang) * 1.1, 0);
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), glossy('#ff7ab0')); m.castShadow = true; scene.add(m);
          const dx = player.x - mz.x, dy = player.y - mz.y, T = clamp(Math.hypot(dx, dy) / 7, 0.9, 1.8);
          bullets.push({ m, x: mz.x, y: mz.y, vx: dx / T, vy: dy / T + 0.5 * 9 * T, enemy: true, ball: true, life: 4, bounces: 0, trail: [], dead: false });
          smoke.emit(mz, { color: '#d9dbe0', n: 8, speed: 1.5, size: 0.4, size1: 1, life: 1, alpha: 0.5 }); tone(120, 0.15, 'sine', 0.1, 0.6);
        }
      }
    }
  }

  // ---- bullets
  for (const b of bullets) {
    if (b.dead) continue;
    const steps = 3;
    for (let s = 0; s < steps && !b.dead; s++) {
      const h = dt / steps;
      if (b.ball) b.vy -= 9 * h;
      b.x += b.vx * h; b.y += b.vy * h;
      // walls: gold ricochets, grey stops
      for (const so of solids) {
        if (Math.abs(b.x - so.x) < so.w / 2 + 0.05 && Math.abs(b.y - so.y) < so.h / 2 + 0.05) {
          if (so.gold && !b.ball && b.bounces < 3) {
            const ox = (so.w / 2 + 0.05) - Math.abs(b.x - so.x), oy = (so.h / 2 + 0.05) - Math.abs(b.y - so.y);
            if (oy < ox) { b.vy = -b.vy; b.y += Math.sign(b.y - so.y) * oy * 2; } else { b.vx = -b.vx; b.x += Math.sign(b.x - so.x) * ox * 2; }
            b.bounces++; b.trail.push([b.x, b.y]); spark.emit(new THREE.Vector3(b.x, b.y, 0.2), { color: '#ffe08a', n: 10, speed: 5, size: 0.1, life: 0.3 }); tone(2200, 0.04, 'triangle', 0.05, 0.6);
          } else { b.dead = true; spark.emit(new THREE.Vector3(b.x, b.y, 0.2), { color: '#ffffff', n: 6, speed: 3, size: 0.08, life: 0.2 }); }
        }
      }
      if (b.x < -AW || b.x > AW || b.y > AH || b.y < 0) {
        if (!b.ball && b.y > AH && solids.some(s => s.gold && s.y > AH - 1) && b.bounces < 3) { b.vy = -Math.abs(b.vy); b.bounces++; b.trail.push([b.x, b.y]); }
        else b.dead = true;
      }
      if (b.dead) break;
      if (!b.enemy) {
        for (const e of enemies) {
          if (!e.alive) continue;
          const cy = e.y + (e.kind === 'robot' ? 1.3 : e.kind === 'cannon' ? 0.5 : 0);
          const hit = e.kind === 'robot' ? Math.abs(b.x - e.x) < 0.45 && b.y > e.y && b.y < e.y + 2.2 : Math.hypot(b.x - e.x, b.y - cy) < e.r;
          if (hit) { b.dead = true; hitEnemy(e, b); break; }
        }
        for (const o of bullets) if (o.enemy && !o.dead && Math.hypot(o.x - b.x, o.y - b.y) < (o.ball ? 0.4 : 0.3)) { o.dead = b.dead = true; spark.emit(new THREE.Vector3(b.x, b.y, 0.2), { color: '#fff', n: 14, speed: 6, size: 0.12, life: 0.35 }); addScore(2); tone(1800, 0.05, 'triangle', 0.06, 0.6); }
      } else if (player.alive && state === 'play' && Math.hypot(b.x - player.x, b.y - player.y) < (b.ball ? 0.7 : 0.55)) { b.dead = true; lose('shot'); }
    }
    b.life -= dt; if (b.life <= 0) b.dead = true;
    // draw: tracer from the last bounce point (or a fixed length) to the head
    if (b.ball) { b.m.position.set(b.x, b.y, 0); continue; }
    const len = Math.min(b.enemy ? 1.8 : 4.2, Math.hypot(b.x - b.trail[b.trail.length - 1][0], b.y - b.trail[b.trail.length - 1][1]));
    b.m.position.set(b.x, b.y, 0.1); b.m.rotation.z = Math.atan2(b.vy, b.vx); b.m.scale.x = Math.max(0.05, len);
  }
  bullets = bullets.filter(b => !b.dead || (scene.remove(b.m), false));

  // ---- coins, debris, particles
  for (const c of coins) { c.t += dt; if (c.got) { c.m.scale.multiplyScalar(0.85); c.m.position.y += dt * 3; } else { c.m.rotation.z = c.t * 3; c.m.position.y = c.y + Math.sin(c.t * 2) * 0.1; } }
  for (const d of debris) { d.vy -= G * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.rotation.z += d.w * dt; d.life -= dt; if (d.life < 0.4) d.m.scale.multiplyScalar(0.9); }
  debris = debris.filter(d => d.life > 0 || (scene.remove(d.m), false));
  smoke.update(dt); spark.update(dt);
  if (player.alive && player.live && Math.random() < 0.5 && Math.abs(player.w) > 4) smoke.emit(muzzle(player, 0.9), { color: '#c7cad0', n: 1, speed: 0.3, size: 0.22, size1: 0.6, life: 0.7, alpha: 0.35 });
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }

  // ---- camera: fit arena, punch toward the final kill in slow motion
  const dist = fitCamera();
  let tx = 0, ty = AH / 2 + 1.3, tz = dist;
  if ((slowT > 0 || state === 'won') && focus) { const k = state === 'won' ? 0.12 : 0.3; tx = lerp(0, focus.x, k); ty = lerp(AH / 2 + 1.3, focus.y, k); tz = dist * (state === 'won' ? 0.95 : 0.8); }
  camX = lerp(camX, tx, 1 - Math.pow(0.01, rdt)); camY = lerp(camY, ty, 1 - Math.pow(0.01, rdt)); camZ = camZ ? lerp(camZ, tz, 1 - Math.pow(0.01, rdt)) : tz;
  shake = Math.max(0, shake - rdt * 2);
  camera.position.set(camX + (Math.random() - 0.5) * shake * 0.4, camY + (Math.random() - 0.5) * shake * 0.4, camZ);
  camera.lookAt(camX, camY, 0);
});

buildLevel(); state = 'ready';

// ------------------------------------------------------------------ test hooks
window.__dbg = () => ({ why: window.__why, x: +player.x.toFixed(1), y: +player.y.toFixed(1), a: +(player.a % 6.283).toFixed(2), e: enemies.filter(e => e.alive).length });
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || !player.alive) return;
    const tap = () => { dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 500 })); dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 500 })); };
    const mz = muzzle(player), dx = Math.cos(player.a), dy = Math.sin(player.a);
    for (const e of enemies) {
      if (!e.alive) continue;
      const ea = Math.atan2(e.y + (e.kind === 'robot' ? 1.2 : e.kind === 'cannon' ? 0.5 : 0) - mz.y, e.x - mz.x);
      if (Math.abs(Math.atan2(Math.sin(ea - player.a), Math.cos(ea - player.a))) < 0.2) return tap();
    }
    for (const b of bullets) if (b.enemy && Math.hypot(b.x - player.x, b.y - player.y) < 3 && Math.abs(Math.atan2(Math.sin(Math.atan2(b.y - mz.y, b.x - mz.x) - player.a), Math.cos(Math.atan2(b.y - mz.y, b.x - mz.x) - player.a))) < 0.4) return tap();
    if (!player.live) return tap();
    if ((player.y < AH * 0.6 && dy < -0.6) || (player.y < 4 && dy < -0.2) || (player.vy < -6 && dy < -0.4)) return tap();
    if (player.x < -AW + 1.4 && dx < -0.4 || player.x > AW - 1.4 && dx > 0.4) return tap();
  },
};

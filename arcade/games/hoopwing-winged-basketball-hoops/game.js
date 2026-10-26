// Hoopwing — tap to flutter a winged ball up; it glides right on its own. Drop it down through every hoop.
// Miss a hoop or hit the floor and the run ends. Clean drops (no rim) are swishes: they stack a combo and light the ball on fire.
// Endless: every 10 hoops is a new stage (new colours, faster glide, moving hoops later on).
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Hoopwing: Winged Basketball Hoops';
const S = store('hoopwing');
let best = S.get('best', 0);
const F = flow('hoopwing', { par: 14, warmup: 4 });

const stage = createStage({ fov: 42, shadowSize: 16 });
const { scene, camera, sun } = stage;
sun.intensity = 1.5; sun.position.set(4, 14, 10);
const ui = createUI({ title: 'HOOPWING', hint: 'Tap to flutter', hand: '👆' });
const D = daily('hoopwing', ui, { name: NAME });

const SKIES = [['#a6dcff', '#fff1d6'], ['#ffc2d4', '#fff0c9'], ['#c9b8ff', '#ffe0f3'], ['#9ee8cf', '#f2fff0'], ['#ffd29a', '#fff6dc'], ['#b3c7ff', '#ffe9f3']];
const RIMS = ['#ff5a36', '#ff3f7f', '#7b5cff', '#16b386', '#ff8c1a', '#3a7bff'];
const GRAV = 24, FLAP = 8.6, BR = 0.42, FLOOR = -6.2, CEIL = 8.5;

// ---------------------------------------------------------------- textures
function ballTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#ff8a2a'; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${150 + Math.random() * 60},60,0,.12)`; x.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
  x.strokeStyle = '#3a1d0e'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, 64); x.lineTo(256, 64); x.stroke();
  for (const cx of [64, 192]) { x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, 128); x.stroke(); }
  x.beginPath(); x.ellipse(0, 64, 40, 64, 0, -Math.PI / 2, Math.PI / 2); x.stroke();
  x.beginPath(); x.ellipse(256, 64, 40, 64, 0, Math.PI / 2, Math.PI * 1.5); x.stroke();
  x.beginPath(); x.ellipse(128, 64, 40, 64, 0, 0, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function netTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.strokeStyle = '#ffffff'; x.lineWidth = 3;
  for (let i = -4; i < 12; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i * 16 + 64, 0); x.lineTo(i * 16, 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function floorTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f2c48d' : '#eab57a'; x.fillRect(i * 32, 0, 32, 64); x.fillStyle = 'rgba(120,70,20,.15)'; x.fillRect(i * 32, 0, 2, 64); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- hero: winged ball (round stubby jelly wings)
const hero = new THREE.Group(); scene.add(hero);
const ballMat = glossy('#ffffff', { map: ballTex(), roughness: 0.45, emissive: '#000000' });
const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 24), ballMat); ball.castShadow = true; hero.add(ball);
const wingMat = glossy('#9ff0d8', { emissive: '#5fdcb8', emissiveIntensity: 0.25 });
const wings = [];
for (const s of [-1, 1]) {
  const piv = new THREE.Group(); piv.position.set(-0.1, 0.22, s * 0.3); piv.scale.setScalar(1.25); hero.add(piv);
  const w = new THREE.Group(); piv.add(w);
  for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), wingMat); f.scale.set(1.7 - k * 0.3, 0.62 - k * 0.08, 0.22); f.position.set(-0.32 - k * 0.04, 0.2 - k * 0.13, -k * 0.03); f.rotation.z = 0.35 + k * 0.12; f.castShadow = true; w.add(f); }
  piv.side = s; wings.push(piv);
}
// fire aura for swish streaks
const auraTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: '#ff9a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
aura.scale.setScalar(2.4); hero.add(aura);

// ---------------------------------------------------------------- hoops
const RIM_R = 1.2;
const netT = netTex();
function makeHoop() {
  const g = new THREE.Group();
  const tilt = new THREE.Group(); tilt.rotation.x = -0.42; g.add(tilt);   // tip toward the camera so you see into it
  const rimM = glossy('#ff5a36', { emissive: '#ff5a36', emissiveIntensity: 0.15 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 12, 40), rimM); rim.rotation.x = Math.PI / 2; rim.castShadow = true; tilt.add(rim);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.62, 1.1, 24, 1, true), mat('#ffffff', { map: netT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  net.position.y = -0.58; tilt.add(net);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0 })); glow.scale.set(4, 2, 1); tilt.add(glow);
  g.rim = rim; g.net = net; g.rimM = rimM; g.glow = glow; g.tilt = tilt;
  scene.add(g); return g;
}
const hoopPool = [];

// ---------------------------------------------------------------- world: court floor + bleacher-ish hills + clouds
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 12), mat('#ffffff', { map: floorTex(), roughness: 0.6 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR, -2); floor.receiveShadow = true; scene.add(floor);
const lineM = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 });
const floorLine = new THREE.Mesh(new THREE.BoxGeometry(400, 0.02, 0.12), lineM); floorLine.position.set(0, FLOOR + 0.01, 1.2); scene.add(floorLine);
const decor = new THREE.Group(); scene.add(decor);
const PUFF = new THREE.SphereGeometry(1, 14, 10), cloudMat = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.12, depthWrite: false }));
shadowBlob.rotation.x = -Math.PI / 2; scene.add(shadowBlob);
function buildDecor(seed) {
  decor.clear(); const r = rng(seed);
  for (let i = 0; i < 40; i++) {
    const cl = new THREE.Group(); for (let j = 0; j < 4; j++) { const pf = new THREE.Mesh(PUFF, cloudMat); const s = 0.6 + r() * 0.7; pf.scale.set(s * 1.4, s, s); pf.position.set(j * 1.1 - 1.6, (j % 2) * 0.4, 0); cl.add(pf); }
    cl.position.set(i * 9 + r() * 6, -1 + r() * 12, -20 - r() * 12); decor.add(cl);
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, hoopsDone = 0, stageN = 1, combo = 0, fire = 0, recorded = false, beatenShown = false;
let p = new THREE.Vector2(), v = new THREE.Vector2(), hoops = [], nextX = 0, r = rng(1), speed = 5, flapT = 0, squash = 0, camX = 0, spinA = 0, clock = 0, deadT = 0;

function setStage(n) {
  stageN = n; const sky = SKIES[(n - 1) % SKIES.length], bs = document.body.style;
  bs.setProperty('--bg1', sky[0]); bs.setProperty('--bg2', sky[1]); bs.setProperty('--ui', RIMS[(n - 1) % RIMS.length]);
  ui.levels(n);
}
function spawnHoop() {
  const fk = F.k(score), lv = stageN;
  const gap = clamp(6.4 + r() * 2.2 - Math.min(lv, 8) * 0.12, 5.4, 9);
  const prevY = hoops.length ? hoops[hoops.length - 1].by : 0.5;
  const swing = clamp((2.4 + Math.min(lv, 8) * 0.35) * fk, 2, 6);
  const by = clamp(prevY + (r() * 2 - 1) * swing, FLOOR + 2.4, CEIL - 2.2);
  const rad = clamp((RIM_R - Math.min(lv, 10) * 0.025) / Math.sqrt(fk), 0.88, 1.35);
  const moving = lv >= 3 && r() < clamp(0.2 + lv * 0.06, 0, 0.6) * fk;
  const g = hoopPool.pop() || makeHoop(); g.visible = true; g.scale.setScalar(rad);
  const col = RIMS[(stageN - 1) % RIMS.length]; g.rimM.color.set(col); g.rimM.emissive.set(col); g.glow.material.opacity = 0;
  const h = { x: nextX, by, y: by, r: rad, g, done: false, touched: false, amp: moving ? 0.9 + r() * 0.9 : 0, ph: r() * 6, pulse: 0 };
  g.position.set(h.x, h.y, 0); hoops.push(h); nextX += gap;
}

const B = board({ game: 'hoopwing', label: 'Points', limits: { maxRun: 60000, maxPerSec: 120 } });

function reset() {
  const seed = D.seed || (Date.now() % 100000) + 7; r = rng(seed);
  for (const h of hoops) { h.g.visible = false; hoopPool.push(h.g); } hoops = [];
  setStage(1); score = 0; hoopsDone = 0; combo = 0; fire = 0; recorded = false; beatenShown = false; deadT = 0;
  p.set(0, 1.5); v.set(0, 0); nextX = 6; speed = 5;
  for (let i = 0; i < 5; i++) spawnHoop();
  buildDecor(seed); camX = p.x + 2.4;
  hero.visible = true; hero.rotation.set(0, 0, 0); ballMat.emissive.set('#000000'); aura.material.opacity = 0;
  ui.progress(0); ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

function flap() {
  if (state !== 'play') return;
  v.y = FLAP; flapT = 1; squash = 0.6;
  tone(560 + Math.random() * 60, 0.06, 'sine', 0.09, 1.5); buzz(6);
  burst(scene, new THREE.Vector3(p.x - 0.4, p.y - 0.2, 0), ['#ffffff', '#bdf1ff'], 3, { speed: 0.04, up: -0.02, size: 0.35, gravity: 0.001 });
}

function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(p.x + 1, p.y + 2, 0), 50); }
}

function scoreHoop(h) {
  h.done = true; hoopsDone++; h.pulse = 1;
  let pts = 1;
  if (!h.touched) { combo++; pts = 1 + combo; } else combo = 0;
  if (combo >= 3 && fire <= 0) { ui.flash(0.3); buzz([15, 20, 15]); }
  fire = combo >= 3 ? 1 : 0;
  addScore(pts);
  const col = '#' + h.g.rimM.color.getHexString();
  if (!h.touched) {
    ui.pop(combo > 1 ? `SWISH ×${combo}  +${pts}` : `SWISH! +${pts}`, combo >= 3 ? '#ff7a1a' : col, 32 + Math.min(combo, 6) * 3, 30);
    [0, 4, 7, 12].slice(0, 2 + Math.min(combo, 2)).forEach((s, i) => setTimeout(() => note(72 + s + Math.min(combo, 6), 0.22, 0.14), i * 55));
    h.g.glow.material.opacity = 0.9; buzz(14);
    burst(scene, new THREE.Vector3(h.x, h.y, 0.3), ['#ffffff', col, '#ffe66d'], 16, { speed: 0.12, up: 0.04, size: 0.5, gravity: 0.004 });
  } else {
    ui.pop('+1', col, 30, 32); note(67, 0.18, 0.13); buzz(8);
    burst(scene, new THREE.Vector3(h.x, h.y, 0.3), ['#ffffff', col], 8, { speed: 0.08, up: 0.03, size: 0.45 });
  }
  if (hoopsDone % 10 === 0) {
    setStage(stageN + 1); ui.pop(`STAGE ${stageN}!`, '#fff', 46, 24); sfx.win(); confetti(scene, new THREE.Vector3(p.x + 2, p.y + 2, 0), 50);
  }
  ui.progress((hoopsDone % 10) / 10);
}

function die(why) {
  if (state !== 'play') return;
  state = 'lost'; combo = 0; fire = 0; deadT = 0;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best; best = Math.max(best, score); S.set('best', best);
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.4);
  burst(scene, new THREE.Vector3(p.x, p.y, 0), ['#ff8a2a', '#ffffff', '#bdf1ff'], 18, { speed: 0.12, up: 0.1, size: 0.6 });
  v.set(-2, 6);
  ui.lose(why, nb && score > 0 ? `New best: ${score}!` : `Score ${score} · best ${best}`);
}

input({ onDown: () => flap() });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first run, until the first real touch,
// the ball flaps itself through the next hoops (the bot's own timing); those demo hoops give no points, the score goes back to 0
const DM = demo(null, { ready: () => state === 'play' && stageN === 1 && !D.isDaily, wait: 0, ms: 4000 });
let demoWas = false;
ui.onTap(w => { if (w === 'lose' || w === 'win') reset(); state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden'); v.y = FLAP * 0.8; });

// ---------------------------------------------------------------- physics
function rimHit(h, ex) {
  const dx = p.x - ex, dy = p.y - h.y, d = Math.hypot(dx, dy), md = BR + 0.11 * h.r + 0.04;
  if (d >= md || d < 1e-5) return;
  const nx = dx / d, ny = dy / d; p.x = ex + nx * md; p.y = h.y + ny * md;
  const vn = v.x * nx + v.y * ny;
  if (vn < 0) { v.x -= 1.6 * vn * nx; v.y -= 1.6 * vn * ny; }
  v.x = Math.max(v.x, speed * 0.4);
  if (!h.touched) { h.touched = true; tone(300, 0.08, 'triangle', 0.13, 0.8); buzz(10); h.pulse = 0.6; }
}
function physics(dt) {
  v.y -= GRAV * dt; v.x = lerp(v.x, speed, Math.min(1, 3 * dt));
  const py = p.y;
  p.x += v.x * dt; p.y += v.y * dt;
  if (p.y > CEIL) { p.y = CEIL; v.y = Math.min(0, v.y); }
  for (const h of hoops) {
    if (Math.abs(h.x - p.x) > h.r + 1.5) continue;
    const R = h.r;
    rimHit(h, h.x - R); rimHit(h, h.x + R);
    const inside = Math.abs(p.x - h.x) < R - 0.08;
    if (!h.done && inside && py > h.y && p.y <= h.y) scoreHoop(h);
    else if (inside && py < h.y && p.y >= h.y && !h.done) { p.y = h.y - 0.01; v.y = -Math.abs(v.y) * 0.3; h.touched = true; tone(200, 0.06, 'sine', 0.1, 0.8); }   // the net blocks from below
  }
  if (p.y < FLOOR + BR) die('THUD!');
  const miss = hoops.find(h => !h.done && p.x > h.x + h.r + BR + 0.2);
  if (miss) { miss.pulse = 1; die('MISSED!'); }
}

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  clock = t; const step = dt / 60;
  if (DM.on) { window.__game.bot(); demoWas = true; } else if (demoWas) { demoWas = false; score = 0; ui.score(0); }
  if (state === 'play') {
    speed = clamp((5 + Math.min(stageN - 1, 8) * 0.35) * F.k(score), 4.2, 9);
    for (let i = 0; i < 3; i++) physics(step / 3);
    while (nextX < p.x + 40) spawnHoop();
    while (hoops.length && hoops[0].x < p.x - 14) { const h = hoops.shift(); h.g.visible = false; hoopPool.push(h.g); }
    spinA -= v.x * step / BR * 0.6;
  } else if (state === 'lost') {
    deadT += step;
    if (p.y > FLOOR + BR) { v.y -= GRAV * step; p.x += v.x * step; p.y += v.y * step; spinA += 6 * step; }
    else { p.y = FLOOR + BR; if (Math.abs(v.y) > 2) { v.y = -v.y * 0.45; v.x *= 0.6; } else v.y = 0; }
  } else { p.y = 1.5 + Math.sin(t * 2.5) * 0.35; flapT = Math.max(flapT, 0.5 + 0.5 * Math.sin(t * 9)); }
  for (const h of hoops) {
    if (h.amp) { h.y = h.by + Math.sin(t * 1.6 + h.ph) * h.amp; }
    h.pulse = Math.max(0, h.pulse - step * 3);
    h.g.position.set(h.x, h.y, 0); h.g.scale.setScalar(h.r * (1 + h.pulse * 0.12));
    h.g.net.scale.y = 1 + h.pulse * 0.35; h.g.net.position.y = -0.58 - h.pulse * 0.2;
    h.g.glow.material.opacity = Math.max(0, h.g.glow.material.opacity - step * 1.5);
  }
  // hero
  flapT = Math.max(0, flapT - step * 4); squash = Math.max(0, squash - step * 4);
  hero.position.set(p.x, p.y, 0);
  ball.rotation.z = spinA;
  const st = clamp(-v.y / 50, -0.12, 0.15);
  ball.scale.set(1 + squash * 0.18 - st * 0.3, 1 - squash * 0.15 + st, 1 + squash * 0.18);
  hero.rotation.z = lerp(hero.rotation.z, state === 'play' ? clamp(v.y * 0.04, -0.5, 0.4) : hero.rotation.z, 0.2);
  for (const w of wings) { const a = (w.side > 0 ? -0.35 : 0.15) + Math.sin(flapT * Math.PI) * 1.3 + Math.sin(t * 14 + w.side) * 0.08; w.rotation.x = w.side * (0.15 + flapT * 0.3); w.rotation.z = a; }
  fire = Math.max(0, fire - (combo >= 3 ? 0 : step));
  aura.material.opacity = lerp(aura.material.opacity, combo >= 3 && state === 'play' ? 0.85 + Math.sin(t * 20) * 0.1 : 0, 0.15);
  ballMat.emissive.set(combo >= 3 && state === 'play' ? '#ff4d00' : '#000000'); ballMat.emissiveIntensity = 0.35;
  if (combo >= 3 && state === 'play' && Math.random() < 0.7) burst(scene, new THREE.Vector3(p.x - 0.3, p.y, 0), ['#ffcf3f', '#ff7a1a', '#ff3d3d'], 1, { speed: 0.03, up: 0.01, size: 0.7, gravity: -0.002 });
  shadowBlob.position.set(p.x, FLOOR + 0.02, 0); { const hgt = p.y - FLOOR; shadowBlob.scale.setScalar(clamp(1.2 - hgt * 0.06, 0.4, 1.2)); shadowBlob.material.opacity = clamp(0.2 - hgt * 0.012, 0.04, 0.2); }
  // camera
  camX = lerp(camX, p.x + 2.4, Math.min(1, 6 * step));
  camera.position.set(camX - 0.6, 3.6, 21); camera.lookAt(camX, 0.9, 0);
  stage.followLight(new THREE.Vector3(camX, 0, 0));
  floor.position.x = Math.round(camX / 20) * 20; floorLine.position.x = floor.position.x;
  decor.position.x = camX * 0.6;
});

reset(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return stageN; }, get score() { return score; },
  get dbg() { return `p ${p.x.toFixed(1)},${p.y.toFixed(1)} v ${v.x.toFixed(1)},${v.y.toFixed(1)} next ${(hoops.find(h => !h.done) || {}).y?.toFixed(1)}`; },
  bot() {
    if (state !== 'play') return;
    const h = hoops.find(hh => !hh.done); if (!h) return;
    const lo = h.x - h.r + BR + 0.12, hi = h.x + h.r - BR - 0.12;
    // where would we cross the rim height going down, if we flap now / don't?
    const cross = (vy0) => {
      let x = p.x, y = p.y, vy = vy0, vx = v.x, wasAbove = y > h.y;
      for (let k = 0; k < 400; k++) {
        const dt = 1 / 120; vy -= GRAV * dt; vx = lerp(vx, speed, Math.min(1, 3 * dt)); const py = y; x += vx * dt; y += vy * dt;
        if (y > CEIL) { y = CEIL; vy = Math.min(0, vy); }
        if (y > h.y) wasAbove = true;
        if (wasAbove && py > h.y && y <= h.y) return x;
        if (y < FLOOR + BR) return -Infinity;
        if (x > hi + 2) return Infinity;
      }
      return Infinity;
    };
    const nf = cross(v.y);
    if (nf >= lo && nf <= hi) return;
    if (nf < lo) { const fx = cross(FLAP); if (fx <= hi + 0.2 || p.y < h.y - 0.5 || p.y < FLOOR + 2) flap(); }
  },
};

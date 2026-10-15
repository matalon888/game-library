// Nova Leap — your little rocket circles a planet. Tap to let go: it shoots off along the tangent in a straight line.
// Fly into the next planet's pull ring to get caught in its orbit. Miss and you drift off, lost in space.
// Endless upward climb: a stage every 10 planets (faster orbits, tighter pull rings, drifting planets). Bullseyes and close calls score extra.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
const B = board({ game: 'nova-leap', label: 'Points', limits: { maxRun: 1000, maxPerSec: 8 } });   // world board (RULES.md part C)

const NAME = 'Nova Leap: Orbit Jump Space Game';
const S = store('novaleap');
let best = S.get('best', 0);
const F = flow('novaleap', { par: 16, warmup: 4 });

const stage = createStage({ fov: 40, shadows: false });
const { scene, camera, sun, hemi } = stage;
sun.position.set(-6, 8, 12); sun.intensity = 1.6; hemi.intensity = 1.0;
const ui = createUI({ title: 'NOVA<br>LEAP', hint: 'Tap to launch', hand: '👆' });
const D = daily('novaleap', ui, { name: NAME });

const SKIES = [['#2a2766', '#7d5aa8'], ['#1f3a6b', '#5f8fc0'], ['#3b245e', '#b0628f'], ['#173f55', '#4f9a9a'], ['#3a2a5c', '#c07a6a'], ['#24305e', '#8a6bc4']];
const PLANET_COLS = [['#ff7eb6', '#ffc3dd'], ['#ffd166', '#fff0b8'], ['#5ee6c1', '#c8fff0'], ['#7aa8ff', '#d4e3ff'], ['#ff9a62', '#ffd8bf'], ['#b48cff', '#e7dbff'], ['#ff6b6b', '#ffd0d0']];
const UI_COLS = ['#ff7eb6', '#5ee6c1', '#ffd166', '#7aa8ff', '#ff9a62', '#b48cff'];

// ---------------------------------------------------------------- textures + shared stuff
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function bandTex(a, b, seed) {
  const r = rng(seed), c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 64, 128);
  let y = 0; while (y < 128) { const h = 6 + r() * 18; x.fillStyle = r() < 0.5 ? b : a; x.globalAlpha = 0.5 + r() * 0.5; x.fillRect(0, y, 64, h); y += h; }
  x.globalAlpha = 1; for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(r() * 64, r() * 128, 2 + r() * 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEXS = PLANET_COLS.map((c, i) => bandTex(c[0], c[1], i * 13 + 5));
const SPH = new THREE.SphereGeometry(1, 32, 24);
const RING_G = new THREE.RingGeometry(0.97, 1, 96);
const SAT_RING = new THREE.TorusGeometry(1.55, 0.08, 6, 48);

// starfield (fixed to camera so it never ends) + parallax dust
const sky = new THREE.Group(); scene.add(sky);
{
  const n = 260, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 70, -30 - Math.random() * 10], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sky.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.28, map: glowTex, transparent: true, depthWrite: false, opacity: 0.9 })));
}

// ---------------------------------------------------------------- hero: tiny rocket
const rocket = new THREE.Group(); scene.add(rocket);
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 6, 14), glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.15 })); rocket.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 16), glossy('#ff5d73', { emissive: '#ff5d73', emissiveIntensity: 0.2 })); nose.position.y = 0.36; rocket.add(nose);
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), glossy('#5ec8ff', { emissive: '#5ec8ff', emissiveIntensity: 0.4 })); win.position.set(0, 0.08, 0.17); win.scale.z = 0.5; rocket.add(win);
  for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.05), glossy('#ff5d73')); fin.position.set(s * 0.2, -0.24, 0); fin.rotation.z = s * -0.4; rocket.add(fin); }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flame.position.y = -0.5; flame.scale.set(0.45, 0.7, 1); rocket.add(flame);
  rocket.flame = flame; rocket.scale.setScalar(1.25);
}
const guide = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(guide);

// trail ribbon
const TN = 30, trailPts = [];
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TN * 2 * 4), 4));
{ const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
trail.frustumCulled = false; scene.add(trail);

// ---------------------------------------------------------------- state
let state = 'ready', planets = [], cur = null, prev = null, nextIdx = 0, r = rng(1), topY = 0, stageN = 1;
let p = new THREE.Vector2(), vel = new THREE.Vector2(), theta = 0, orbR = 2, spin = 1, speed = 7, flyT = 0, score = 0, caught = 0, streak = 0;
let recorded = false, beatenShown = false, camY = 0, simT = 0, pending = null, lostT = 0;

function setStage(n) {
  stageN = n; const sk = SKIES[(n - 1) % SKIES.length], bs = document.body.style;
  bs.setProperty('--bg1', sk[0]); bs.setProperty('--bg2', sk[1]); bs.setProperty('--ui', UI_COLS[(n - 1) % UI_COLS.length]);
  ui.levels(n);
}
function posAt(pl, t) { return pl.amp ? pl.x0 + Math.sin(t * pl.w + pl.ph) * pl.amp : pl.x0; }

function spawnPlanet() {
  const i = nextIdx++, fk = F.k(score);
  const lv = Math.floor(i / 10) + 1;
  const pr = 0.45 + r() * 0.45;
  const cr = clamp((pr + 1.45 - Math.min(lv, 8) * 0.06) / Math.sqrt(fk), pr + 0.85, pr + 1.9);
  let x0, y;
  if (i === 0) { x0 = 0; y = 0; }
  else {
    const last = planets[planets.length - 1];
    const gap = clamp((6.6 + r() * 1.8 + Math.min(lv, 8) * 0.2) * Math.sqrt(fk), 6, 10.5);
    const sgn = last.x0 > 1.2 ? -1 : last.x0 < -1.2 ? 1 : (r() < 0.5 ? -1 : 1);
    x0 = clamp(last.x0 + sgn * (1.4 + r() * 2.6), -3.2, 3.2);
    y = last.y + Math.sqrt(Math.max(gap * gap - (x0 - last.x0) ** 2, 16));
  }
  const moving = i > 3 && lv >= 2 && r() < clamp(0.15 + lv * 0.08, 0, 0.6) * fk;
  const ci = Math.floor(r() * PLANET_COLS.length), col = PLANET_COLS[ci];
  const g = new THREE.Group(); scene.add(g);
  const ball = new THREE.Mesh(SPH, mat('#ffffff', { map: TEXS[ci], roughness: 0.55, emissive: col[0], emissiveIntensity: 0.12 })); ball.scale.setScalar(pr); ball.rotation.z = (r() - 0.5) * 0.8; g.add(ball);
  if (r() < 0.35) { const sr = new THREE.Mesh(SAT_RING, glossy(col[1], { emissive: col[1], emissiveIntensity: 0.2 })); sr.scale.set(pr, pr, pr * 0.3); sr.rotation.set(1.2, 0.3, 0.2); g.add(sr); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col[0], transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending })); halo.scale.setScalar(pr * 4.2); g.add(halo);
  const ring = new THREE.Mesh(RING_G, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false })); ring.scale.setScalar(cr); g.add(ring);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: col[0], transparent: true, opacity: 0.07, depthWrite: false })); fill.scale.setScalar(cr); fill.position.z = -0.05; g.add(fill);
  const pl = { i, x0, x: x0, y, pr, cr, g, ball, ring, fill, col: col[0], amp: moving ? 1 + r() * 1.3 : 0, w: 0.6 + r() * 0.6, ph: r() * 6, visited: i === 0, pulse: 0 };
  if (pl.amp) pl.x0 = clamp(pl.x0, -3.2 + pl.amp, 3.2 - pl.amp);
  g.position.set(pl.x0, y, 0); planets.push(pl); topY = y;
}

function reset() {
  const seed = D.seed || (Date.now() % 100000) + 3; r = rng(seed * 7919 + 17); for (let i = 0; i < 5; i++) r();
  for (const pl of planets) scene.remove(pl.g); planets = []; nextIdx = 0; simT = 0;
  setStage(1);
  for (let i = 0; i < 8; i++) spawnPlanet();
  cur = planets[0]; prev = null; orbR = cur.cr * 0.8; theta = -Math.PI / 2; spin = 1; speed = 6.5;
  p.set(cur.x + Math.cos(theta) * orbR, cur.y + Math.sin(theta) * orbR); vel.set(0, 0);
  score = 0; caught = 0; streak = 0; recorded = false; beatenShown = false; pending = null; lostT = 0; trailPts.length = 0;
  rocket.visible = true; rocket.scale.setScalar(1.25); camY = cur.y + 4;
  ui.progress(0); ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(p.x, p.y + 2, 0), 50); }
}

function launch() {
  if (state !== 'play' || !cur) return;
  pending = null;
  const tx = -Math.sin(theta) * spin, ty = Math.cos(theta) * spin;
  vel.set(tx * speed, ty * speed);
  if (cur.amp) vel.x += Math.cos(simT * cur.w + cur.ph) * cur.amp * cur.w;   // carry the planet's drift
  prev = cur; cur = null; flyT = 0;
  tone(420, 0.14, 'sine', 0.11, 1.8); buzz(8);
  burst(scene, new THREE.Vector3(p.x, p.y, 0), ['#ffd166', '#ffffff'], 6, { speed: 0.06, up: 0.0, size: 0.4, gravity: 0 });
}

function capture(pl) {
  const rel = new THREE.Vector2(p.x - pl.x, p.y - pl.y), d = rel.length();
  // how far off-centre was the line? (perpendicular miss distance at closest approach)
  const vn = vel.clone().normalize(), perp = Math.abs(rel.x * vn.y - rel.y * vn.x), ratio = perp / pl.cr;
  cur = pl; orbR = Math.max(d, pl.pr + 0.55); theta = Math.atan2(rel.y, rel.x); spin = Math.sign(rel.x * vel.y - rel.y * vel.x) || 1;
  pl.pulse = 1; flyT = 0;
  const fresh = !pl.visited; pl.visited = true;
  if (fresh) {
    caught++; streak++;
    let pts = 1, label = '';
    if (ratio > 0.82) { pts += 2; label = 'CLOSE CALL! +3'; }
    else if (ratio < 0.25) { pts += 1 + Math.min(streak, 5); label = streak > 1 ? `BULLSEYE ×${streak}` : 'BULLSEYE!'; } else streak = 0;
    addScore(pts);
    if (label) ui.pop(label, '#fff', 30 + Math.min(streak, 5) * 2, 30);
    const base = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81][(caught - 1) % 10];
    note(base + 12, 0.35, 0.15); if (label) setTimeout(() => note(base + 19, 0.3, 0.12), 70);
    buzz(12);
    burst(scene, new THREE.Vector3(p.x, p.y, 0.2), [pl.col, '#ffffff'], 12, { speed: 0.08, up: 0.0, size: 0.45, gravity: 0 });
    if (caught % 10 === 0) { setStage(stageN + 1); ui.pop(`STAGE ${stageN}!`, '#fff', 46, 24); sfx.win(); confetti(scene, new THREE.Vector3(pl.x, pl.y + 2, 0), 60); }
    ui.progress((caught % 10) / 10);
  } else { tone(330, 0.08, 'sine', 0.08, 1.1); }
}

function lose() {
  if (state !== 'play') return;
  state = 'lost'; pending = null;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score); }
  const nb = score > best; best = Math.max(best, score); S.set('best', best);
  sfx.fail(); buzz([40, 30, 80]);
  ui.lose('LOST IN SPACE', nb && score > 0 ? `New best: ${score}!` : `Score ${score} · best ${best}`);
}

input({ onDown: () => launch() });
ui.onTap(w => { B.start(); if (w === 'lose' || w === 'win') reset(); state = 'play'; ui.els.sc.classList.remove('hc-hidden'); });

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  const step = dt / 60;
  if (state === 'play' || state === 'ready') simT += step;
  for (const pl of planets) { pl.x = posAt(pl, simT); pl.g.position.x = pl.x; pl.ball.rotation.y += step * 0.4; pl.pulse = Math.max(0, pl.pulse - step * 2.5);
    pl.ring.material.opacity = 0.28 + pl.pulse * 0.5 + (pl === cur ? 0.1 : 0); pl.ring.scale.setScalar(pl.cr * (1 + pl.pulse * 0.08)); pl.fill.material.opacity = 0.06 + pl.pulse * 0.15; }
  if (state === 'play' || state === 'ready') {
    speed = clamp((6.5 + Math.min(stageN - 1, 8) * 0.35) * F.k(score), 5.5, 11);
    if (cur) {
      theta += spin * speed / orbR * step * (state === 'ready' ? 0.6 : 1);
      p.set(cur.x + Math.cos(theta) * orbR, cur.y + Math.sin(theta) * orbR);
      vel.set(-Math.sin(theta) * spin * speed, Math.cos(theta) * spin * speed);
    } else {
      flyT += step;
      const sub = 4;
      for (let k = 0; k < sub && !cur; k++) {
        p.x += vel.x * step / sub; p.y += vel.y * step / sub;
        for (const pl of planets) { if (pl === prev && flyT < 0.35) continue; if (Math.hypot(p.x - pl.x, p.y - pl.y) < pl.cr) { capture(pl); break; } }
      }
      if (!cur && (Math.abs(p.x) > 7.5 || p.y < camY - 14 || flyT > 3)) lose();
    }
    while (topY < p.y + 40) spawnPlanet();
    while (planets.length > 4 && planets[0].y < p.y - 20 && planets[0] !== prev) { scene.remove(planets[0].g); planets.shift(); }
  } else if (state === 'lost') {
    p.x += vel.x * step * 0.4; p.y += vel.y * step * 0.4; lostT += step;
    rocket.scale.setScalar(Math.max(0.01, 1.25 - lostT * 0.8));
  }
  // rocket points along its velocity
  rocket.position.set(p.x, p.y, 0.3);
  if (vel.lengthSq() > 0.01) rocket.rotation.z = Math.atan2(vel.y, vel.x) - Math.PI / 2;
  rocket.rotation.y = Math.sin(t * 3) * 0.3;
  rocket.flame.scale.set(0.45 + Math.random() * 0.1, cur ? 0.6 : 0.95 + Math.random() * 0.2, 1);
  // tangent guide while orbiting
  guide.visible = !!cur && state === 'play';
  if (guide.visible) { guide.position.set(p.x, p.y, 0.1); guide.rotation.z = Math.atan2(vel.y, vel.x) - Math.PI / 2; guide.scale.y = 2.2; }
  // trail
  if (state !== 'lost') trailPts.unshift(p.x, p.y); else if (trailPts.length) trailPts.splice(-2, 2);
  if (trailPts.length > TN * 2) trailPts.length = TN * 2;
  {
    const pos = trailGeo.attributes.position.array, c = trailGeo.attributes.color.array, n = trailPts.length / 2;
    for (let i = 0; i < TN; i++) {
      const j = Math.min(i, Math.max(0, n - 1)); const x = n ? trailPts[j * 2] : p.x, y = n ? trailPts[j * 2 + 1] : p.y;
      const j2 = Math.min(j + 1, Math.max(0, n - 1)), nx = n > 1 ? trailPts[j2 * 2] - x : 1, ny = n > 1 ? trailPts[j2 * 2 + 1] - y : 0, l = Math.hypot(nx, ny) || 1;
      const w = 0.16 * (1 - i / TN);
      pos.set([x - ny / l * w, y + nx / l * w, 0.1, x + ny / l * w, y - nx / l * w, 0.1], i * 6);
      const al = i < n ? 0.9 * (1 - i / TN) : 0;
      c.set([1, 0.82, 0.45, al, 1, 0.82, 0.45, al], i * 8);
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  // camera: frame the current planet low and what's coming above it
  const focus = cur ? cur.y + 4.5 : p.y + 3;
  camY = lerp(camY, focus, Math.min(1, (cur ? 2.5 : 1.5) * step));
  const vf = camera.fov * Math.PI / 180, d = 6.4 / (Math.tan(vf / 2) * Math.min(camera.aspect, 0.75));
  camera.position.set(0, camY - 1.5, d); camera.lookAt(0, camY, 0);
  sky.position.set(0, camY * 0.85, 0);
  stage.followLight(new THREE.Vector3(0, camY, 0));
});

reset(); ui.start(); ui.els.sc.classList.add('hc-hidden');

// ---------------------------------------------------------------- bot: wait for the moment the tangent line runs through the next planet
function nextTarget() { let b = null; for (const pl of planets) if (pl.y > (cur ? cur.y : p.y) + 0.5 && (!b || pl.y < b.y)) b = pl; return b; }
window.__game = {
  get state() { return state; }, get level() { return stageN; }, get score() { return score; },
  bot() {
    if (state !== 'play' || !cur || pending) return;
    const tg = nextTarget(); if (!tg) return;
    const w = spin * speed / orbR;
    for (let k = 0; k < 60; k++) {
      const dtk = k / 240, th = theta + w * dtk, cx = posAt(cur, simT + dtk);
      const px = cx + Math.cos(th) * orbR, py = cur.y + Math.sin(th) * orbR, vx = -Math.sin(th) * spin, vy = Math.cos(th) * spin;
      const arrive = Math.hypot(tg.x - px, tg.y - py) / speed, tx = posAt(tg, simT + dtk + arrive) - px, ty = tg.y - py;
      const along = tx * vx + ty * vy, perp = Math.abs(tx * vy - ty * vx);
      if (along > 0 && perp < tg.cr * 0.3) { const ms = dtk * 1000; pending = setTimeout(() => { pending = null; launch(); }, ms); return; }
    }
  },
};

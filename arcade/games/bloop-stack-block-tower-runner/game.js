// Bloop Stack — original side-scrolling stack runner. Bloop the jelly blob slides right on its own;
// tap to squeeze a jelly block out underneath so it rises. Walls scrape the bottom blocks off; the blob itself must clear them.
// Clear a wall with zero blocks to spare = PERFECT; three in a row = FEVER (double points).
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Bloop Stack: Block Tower Runner';
const S = store('bloopstack');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('bloopstack');
const B = board({ game: 'bloop-stack', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });

const stage = createStage({ fov: 40, shadowSize: 16 });
const { scene, camera, sun } = stage;
sun.intensity = 1.5;
const ui = createUI({ title: 'BLOOP<br>STACK', hint: 'Tap to stack a jelly block', hand: '👆' });
const D = daily('bloopstack', ui, { name: NAME });

const SKIES = [['#7fd3ff', '#e4f8ff'], ['#ffb3c7', '#ffe6cf'], ['#b9a7ff', '#ffd9f2'], ['#8be0c8', '#e9fff4'], ['#ffc87a', '#fff3d1'], ['#88b8ff', '#e3ecff']];
const JELLY = ['#ff6fa3', '#ffcf3f', '#56c8ff', '#9a7bff', '#4fd8a0', '#ff8a4c'];

// ---------------------------------------------------------------- textures + shared geometry
function dirtTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(120,40,20,.16)'; x.fillRect(0, 20, 64, 5); x.fillRect(0, 46, 64, 5);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, 64, 3);
  for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(120,40,20,.12)'; x.fillRect((i * 37) % 60, (i * 23) % 60, 3, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
const CELL = new THREE.BoxGeometry(1, 1, 3);
const dirtMat = mat('#ffffff', { map: dirtTex(), roughness: 0.8 });
const MAXCELL = 4200;
const dirt = new THREE.InstancedMesh(CELL, dirtMat, MAXCELL); dirt.receiveShadow = true; dirt.frustumCulled = false; scene.add(dirt);
const grass = new THREE.InstancedMesh(rounded(1.02, 0.34, 3.12, 0.08), mat('#ffffff', { roughness: 0.6 }), 700); grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);
const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.3, 5), mat('#5fd35a'), 400); tuft.frustumCulled = false; scene.add(tuft);
const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ffffff'), 120); flowers.frustumCulled = false; scene.add(flowers);
const BLOCK = rounded(0.94, 0.94, 0.94, 0.16);

// background: far hills + drifting clouds (parallax via depth)
const bg = new THREE.Group(); scene.add(bg);
const hillMat = mat('#9be3a4', { roughness: 1 }), hill2 = mat('#c3efc4', { roughness: 1 }), cloudMat = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
const HILL = new THREE.SphereGeometry(1, 24, 12), PUFF = new THREE.SphereGeometry(1, 14, 10);

// ---------------------------------------------------------------- hero: Bloop, a round jelly blob with a sprout
function makeBloop() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = glossy('#2fd1b4', { emissive: '#000000' });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.47, 28, 20), skin); b.scale.set(1.05, 0.92, 1); b.castShadow = true; body.add(b);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), mat('#c9fff2')); belly.position.set(0.1, -0.12, 0.25); belly.scale.set(1, 0.8, 0.6); body.add(belly);
  const white = mat('#ffffff', { roughness: 0.3 }), black = glossy('#1d1d2b');
  for (const ex of [-0.12, 0.2]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), white); e.position.set(ex, 0.12, 0.38); e.scale.set(1, 1.15, 0.6); body.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), black); p.position.set(ex + 0.05, 0.11, 0.45); body.add(p);
  }
  for (const cx of [-0.26, 0.36]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#ff8fb3')); c.position.set(cx, -0.04, 0.36); c.scale.set(1.3, 0.7, 0.4); body.add(c); }
  const leafM = mat('#5fd35a'), stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6), leafM); stem.position.y = 0.5; body.add(stem);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), leafM); l.scale.set(1.4, 0.35, 0.8); l.position.set(s * 0.12, 0.6, 0); l.rotation.z = s * 0.5; body.add(l); }
  g.body = body; g.skin = skin; return g;
}
const hero = makeBloop(); scene.add(hero);

// finish flag: a tall pole with a checkered flag facing the camera
const arch = new THREE.Group(); scene.add(arch);
let flag;
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 10), glossy('#ffffff')); pole.position.set(0, 2.5, -0.6); pole.castShadow = true; arch.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), glossy('#ffd23f')); knob.position.set(0, 5.05, -0.6); arch.add(knob);
  const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#2b2d42' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  const g = new THREE.PlaneGeometry(1.8, 1.2, 12, 1); g.translate(0.9, 0, 0);
  flag = new THREE.Mesh(g, mat('#ffffff', { map: t, side: THREE.DoubleSide })); flag.position.set(0.05, 4.3, -0.6); flag.castShadow = true; arch.add(flag);
  flag.base = g.attributes.position.array.slice();
}

// ---------------------------------------------------------------- state
let state = 'ready', G = [], C = [], finishX = 0, x = 0, base = 1, vy = 0, n = 0, speed = 4, score = 0, cubes = [], debris = [], cubeIdx = 0;
let perfStreak = 0, fever = 0, camX = 0, camY = 3, heroLift = 0, squash = 0, lastG = 1, recorded = false, beatenShown = false, clock = 0, flyV = null;
const cubePool = [];
const gAt = (px) => { const i = Math.floor(px); return i < 0 ? G[0] : i >= G.length ? G[G.length - 1] : G[i]; };
const cAt = (px) => { const i = Math.floor(px); return i < 0 || i >= C.length ? Infinity : C[i]; };

function getCube(col) {
  let m = cubePool.pop();
  if (!m) { m = new THREE.Mesh(BLOCK, glossy('#ffffff')); m.castShadow = true; m.receiveShadow = true; }
  m.material.color.set(col); m.material.emissive.set(col); m.material.emissiveIntensity = 0.12; m.scale.setScalar(1); m.rotation.set(0, 0, 0);
  m.visible = true; scene.add(m); return m;
}
function freeCube(m) { scene.remove(m); cubePool.push(m); }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function build() {
  const seed = D.seed || level * 7919 + 13, r = rng(seed), fk = F.k();
  speed = clamp((4.5 + Math.min(level, 20) * 0.1) * fk, 3.6, 8);
  const sky = SKIES[(level - 1) % SKIES.length]; const bs = document.body.style;
  bs.setProperty('--bg1', sky[0]); bs.setProperty('--bg2', sky[1]); bs.setProperty('--ui', JELLY[(level - 1) % JELLY.length]);
  // terrain: columns of ground height (G) and optional ceiling (C)
  G = []; C = []; let h = 1;
  const push = (hh, cc = Infinity, w = 1) => { for (let i = 0; i < w; i++) { G.push(hh); C.push(cc); } };
  push(1, Infinity, 9);
  const maxStep = Math.min(2 + Math.floor((level - 1) / 2), 4);
  const target = Math.round(clamp((52 + Math.min(level, 15) * 6) * Math.sqrt(fk), 60, 160));
  const runLen = () => Math.max(3, Math.round((4 + r() * 4) / Math.sqrt(fk)));
  while (G.length < target) {
    const roll = r();
    if (roll < 0.32) { h = Math.min(h + 1 + Math.floor(r() * maxStep), 7); push(h, Infinity, runLen()); }
    else if (roll < 0.52 && h > 1) { h = Math.max(0, h - 1 - Math.floor(r() * 3)); push(h, Infinity, runLen()); }
    else if (roll < 0.76) { const k = 1 + Math.floor(r() * maxStep), w = 1 + Math.floor(r() * 3); push(Math.min(h + k, 8), Infinity, w); push(h, Infinity, runLen()); }
    else if (level >= 2 || G.length > 24) { h = Math.min(h + 1 + Math.floor(r() * Math.min(maxStep, 3)), 7); push(h, h + (r() < 0.45 ? 2 : 3), 3 + Math.floor(r() * 3)); push(h, Infinity, runLen()); }
    else push(h, Infinity, 3);
  }
  finishX = G.length + 2; push(h, Infinity, 16);
  // terrain instances
  let k = 0, gk = 0, tk = 0, fl = 0;
  const dirtCols = ['#e98a5c', '#de7d50'];
  for (let i = 0; i < G.length; i++) {
    _c.set(dirtCols[i % 2]);
    for (let y = -6; y < G[i] && k < MAXCELL; y++) { _m.compose(_p.set(i + 0.5, y + 0.5, 0), _q.identity(), _s.set(1, 1, 1)); dirt.setMatrixAt(k, _m); dirt.setColorAt(k++, _c); }
    if (C[i] < Infinity) for (let y = C[i]; y < C[i] + 10 && k < MAXCELL; y++) { _m.compose(_p.set(i + 0.5, y + 0.5, 0), _q.identity(), _s.set(1, 1, 1)); dirt.setMatrixAt(k, _m); dirt.setColorAt(k++, _c.set(dirtCols[i % 2]).offsetHSL(0, 0, -0.04)); }
    _m.compose(_p.set(i + 0.5, G[i] - 0.1, 0), _q.identity(), _s.set(1, 1, 1)); grass.setMatrixAt(gk, _m); grass.setColorAt(gk++, _c.set(i % 2 ? '#6ad66a' : '#76df70'));
    if (C[i] < Infinity) { _m.compose(_p.set(i + 0.5, C[i] + 0.1, 0), _q.identity(), _s.set(1, 1, 1)); grass.setMatrixAt(gk, _m); grass.setColorAt(gk++, _c.set('#c2603c')); }
    const rr = rng(i * 31 + level);
    for (let t = 0; t < 2 && tk < 400; t++) { const tz = (rr() - 0.5) * 2.6; if (Math.abs(tz) < 0.5) continue; _m.compose(_p.set(i + rr(), G[i] + 0.2, tz), _q.identity(), _s.set(1, 0.7 + rr() * 0.8, 1)); tuft.setMatrixAt(tk++, _m); }
    if (rr() < 0.2 && fl < 120) { _m.compose(_p.set(i + rr(), G[i] + 0.16, -1.1 + rr() * 0.3), _q.identity(), _s.setScalar(1)); flowers.setMatrixAt(fl, _m); flowers.setColorAt(fl++, _c.set(JELLY[Math.floor(rr() * 6)])); }
  }
  dirt.count = k; grass.count = gk; tuft.count = tk; flowers.count = fl;
  for (const im of [dirt, grass, flowers]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  tuft.instanceMatrix.needsUpdate = true;
  arch.position.set(finishX, gAt(finishX), 0);
  // background
  bg.clear(); const br = rng(seed + 5);
  for (let i = -2; i < G.length / 9 + 3; i++) {
    const hm = new THREE.Mesh(HILL, br() < 0.5 ? hillMat : hill2); const s = 4 + br() * 4; hm.scale.set(s * 1.5, s, 2); hm.position.set(i * 9 + br() * 4, -2 + br() * 2, -24 - br() * 6); bg.add(hm);
    if (br() < 0.8) { const cl = new THREE.Group(); for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(PUFF, cloudMat); const ps = 0.7 + br() * 0.8; p.scale.set(ps * 1.3, ps, ps); p.position.set(j * 0.9 - 1.3, (j % 2) * 0.35, 0); cl.add(p); } cl.position.set(i * 9 + br() * 6, 7 + br() * 7, -16 - br() * 6); bg.add(cl); }
  }
  // reset run
  for (const c of cubes) freeCube(c.m); cubes = []; for (const d of debris) freeCube(d.m); debris = [];
  x = 1.5; base = G[1]; vy = 0; n = 0; score = 0; perfStreak = 0; fever = 0; heroLift = 0; squash = 0; lastG = G[1]; recorded = false; beatenShown = false; flyV = null;
  hero.visible = true; hero.rotation.set(0, 0, 0); hero.skin.emissive.set('#000000');
  camX = x + 2.6; camY = base + 1.3;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

function addScore(v) {
  if (DM.on) return;   // demo moves score nothing
  score += v * (fever > 0 ? 2 : 1); ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, hero.position.clone().add(new THREE.Vector3(0, 2, 0)), 50); }
}

function tap() {
  if (state !== 'play') return;
  n++; heroLift -= 1;
  const col = fever > 0 ? new THREE.Color().setHSL((clock * 0.6 + n * 0.12) % 1, 0.85, 0.62) : new THREE.Color(JELLY[(cubeIdx++ + level) % JELLY.length]);
  const m = getCube(col); m.scale.setScalar(0.35);
  cubes.push({ m, pop: 1 });
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  note(64 + PENTA[Math.min(n - 1, PENTA.length - 1)], 0.22, 0.16); buzz(8);
  burst(scene, new THREE.Vector3(x, base + n - 0.5, 0.4), ['#ffffff', '#' + col.getHexString()], 6, { speed: 0.06, up: 0.03, size: 0.45, gravity: 0.003 });
  addScore(1);
}

function scrape(k, wallG) {
  for (let i = 0; i < k; i++) {
    const c = cubes.shift(); debris.push({ m: c.m, x: Math.floor(x + 0.45) - 0.5, y: base + i + 0.5, vx: -0.03 - Math.random() * 0.03, vy: 0.06 + Math.random() * 0.05, rz: (Math.random() + 0.5) * 0.12, t: 0 });
    burst(scene, new THREE.Vector3(Math.floor(x + 0.45), base + i + 0.5, 0.6), ['#' + c.m.material.color.getHexString(), '#ffffff'], 7, { speed: 0.09, up: 0.06, size: 0.5 });
  }
  n -= k; base += k;
  tone(160, 0.12, 'triangle', 0.14, 0.6); buzz(14);
  if (n === 0) {
    perfStreak++; addScore(10); note(76 + Math.min(perfStreak, 5) * 2, 0.35, 0.18); setTimeout(() => note(83 + Math.min(perfStreak, 5) * 2, 0.4, 0.15), 70);
    if (perfStreak >= 3 && fever <= 0) { fever = 5; perfStreak = 0; ui.pop('FEVER!', '#fff', 52, 26); ui.flash(0.35); buzz([20, 30, 20]); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s, 0.3, 0.15), i * 70)); }
    else ui.pop(perfStreak > 1 ? `PERFECT ×${perfStreak}` : 'PERFECT!', '#fff', 36 + perfStreak * 4, 28);
    burst(scene, new THREE.Vector3(x, base, 0.5), ['#ffffff', '#ffe66d'], 16, { speed: 0.12, up: 0.08, size: 0.6 });
    squash = 1;
  } else { perfStreak = 0; addScore(3); }
}

function crash(why) {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp((x - 1.5) / (finishX - 1.5), 0, 1)); }
  sfx.smash(); buzz([40, 30, 80]); ui.flash(0.5);
  burst(scene, hero.position.clone(), ['#2fd1b4', '#c9fff2', '#ffffff'], 26, { speed: 0.16, up: 0.12, size: 0.7 });
  flyV = { vx: -0.06, vy: 0.2, r: 0.25 };
  for (const c of cubes) debris.push({ m: c.m, x, y: c.m.position.y, vx: -0.02 - Math.random() * 0.05, vy: 0.08 + Math.random() * 0.1, rz: (Math.random() - 0.5) * 0.3, t: 0 }); cubes = []; n = 0;
  best = Math.max(best, score); S.set('best', best);
  ui.lose(why, `${Math.round(clamp((x - 1.5) / (finishX - 1.5), 0, 1) * 100)}% of the way`);
}

function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  addScore(25 + level * 5);
  best = Math.max(best, score); S.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.4);
  confetti(scene, new THREE.Vector3(x + 1, base + n + 2, 0), 90);
  D.won(score); ui.win(level, `${score} points`);
}

input({ onDown: () => { if (state === 'play') tap(); } });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the blob taps out just enough jelly blocks to step over the first walls (the test bot), then the run is the player's
const DM = demo(null, { ready: () => state === 'play' && level === 1, wait: 600, ms: 3200 });
ui.onTap(w => {
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden');
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  clock = t;
  const step = dt / 60;
  if (state === 'play') {
    if (DM.on) window.__game.bot();
    if (fever > 0) { fever -= step; if (fever <= 0) { hero.skin.emissive.set('#000000'); } }
    x += speed * (fever > 0 ? 1.12 : 1) * step;
    const front = x + 0.45, wall = gAt(front);
    if (base + n < wall - 0.06) { crash('BONK!'); }
    else if (base < wall - 0.06) scrape(Math.min(n, Math.ceil(wall - base - 0.06)), wall);
    if (state === 'play') {
      const ceil = Math.min(cAt(x - 0.45), cAt(front));
      if (base + n + 0.92 > ceil + 0.02) crash('OUCH!');
    }
    if (state === 'play') {
      const sup = Math.max(gAt(x - 0.42), gAt(x + 0.42));
      if (base > sup + 0.001 || vy > 0) {
        vy -= 0.022 * dt; base += vy * dt;
        if (base <= sup) { const hard = -vy; base = sup; vy = 0; if (hard > 0.12) { squash = Math.min(1, hard * 3); tone(240, 0.06, 'sine', 0.1, 0.7); burst(scene, new THREE.Vector3(x, sup, 0.5), '#ffffff', 5, { speed: 0.05, up: 0.02, size: 0.4 }); } }
      } else base = sup;
      if (fever > 0 && Math.random() < 0.6) burst(scene, new THREE.Vector3(x - 0.4, base + n + 0.5, 0), new THREE.Color().setHSL(Math.random(), 0.9, 0.65), 1, { speed: 0.02, up: 0.01, size: 0.6, gravity: 0 });
      ui.progress((x - 1.5) / (finishX - 1.5));
      if (x >= finishX) win();
    }
  } else if (state === 'won') { x += speed * 0.6 * step; }
  // hero + stack visuals
  heroLift = lerp(heroLift, 0, Math.min(1, 0.45 * dt)); squash = Math.max(0, squash - 0.08 * dt);
  const wob = Math.sin(t * 9) * 0.04;
  if (flyV) { flyV.vy -= 0.012 * dt; hero.position.x += flyV.vx * dt; hero.position.y += flyV.vy * dt; hero.rotation.z += flyV.r * dt; }
  else {
    hero.position.set(x, base + n + 0.47 + heroLift, 0);
    const sq = squash * 0.3 - Math.min(0.25, Math.max(0, -heroLift) * 0.25);
    hero.body.scale.set(1 + sq * 0.6 + wob * 0.3, 1 - sq + wob * 0.2 + (state === 'won' ? Math.abs(Math.sin(t * 10)) * 0.15 : 0), 1 + sq * 0.6);
    hero.body.position.y = -sq * 0.2; hero.rotation.z = lerp(hero.rotation.z, vy > 0.05 ? 0.15 : vy < -0.05 ? -0.12 : 0, 0.2);
    if (fever > 0) hero.skin.emissive.setHSL((t * 0.8) % 1, 0.9, 0.35);
  }
  cubes.forEach((c, i) => {
    c.pop = Math.max(0, c.pop - 0.12 * dt); const s = 1 - c.pop * 0.6;
    const lag = Math.sin(t * 7 - i * 0.6) * 0.03 * Math.min(i, 4);
    c.m.position.set(x + lag, base + i + 0.5 + (i === n - 1 ? heroLift * 0.6 : 0), 0); c.m.scale.set(1 + c.pop * 0.3 + squash * 0.1, s, 1 + c.pop * 0.3);
  });
  for (const d of debris) { d.t += dt; d.vy -= 0.012 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.m.position.set(d.x, d.y, 0.2); d.m.rotation.z += d.rz * dt; if (d.t > 50) d.m.scale.multiplyScalar(0.95); }
  for (let i = debris.length - 1; i >= 0; i--) if (debris[i].t > 110) { freeCube(debris[i].m); debris.splice(i, 1); }
  { const pa = flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const bx = flag.base[i * 3]; pa.setZ(i, Math.sin(bx * 3 - t * 6) * 0.12 * bx); } pa.needsUpdate = true; }
  // camera: hero on the left third, eases up with the stack
  camX = lerp(camX, x + 2.6, 0.15 * dt); camY = lerp(camY, base + n * 0.5 + 1.3, 0.06 * dt);
  camera.position.set(camX - 1.4, camY + 1.8, 16); camera.lookAt(camX, camY, 0);
  stage.followLight(new THREE.Vector3(camX, camY - 2, 0));
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const front = x + 0.45, look = 1.4 + speed * 0.3; let need = 0, cmin = Infinity;
    for (let d = 0; d <= look; d += 0.2) need = Math.max(need, gAt(front + d));
    for (let d = -0.9; d <= look; d += 0.2) cmin = Math.min(cmin, cAt(x + d));
    let taps = Math.ceil(need - (base + n) - 0.01);
    while (taps-- > 0 && base + n + 1.92 <= cmin + 0.01) tap();
  },
};

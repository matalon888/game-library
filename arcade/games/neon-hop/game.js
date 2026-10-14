// Neon Hop — original rhythm hopper. A glowing ball bounces forward from tile to tile on every note of the song.
// Drag left/right to put it on the next tile. Centre landings score PERFECT, gems are bonus, a miss drops you into the void.
import { THREE, createStage, createUI, store, loop, input, buzz, rng, clamp, lerp, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { levelPlan, arrange, hits } from './_music/songs.js';
import { createPlayer, synth } from './_music/conductor.js';
import { glowSprite, glowTex, sparks, skyDome, starField, ease } from './_music/fx.js';

const ORDER = ['twinkle', 'starlight', 'ode', 'neon', 'cancan', 'saints', 'mountain', 'minuet', 'elise', 'turkish', 'canon'];
const THEMES = [
  { top: '#0d0326', hor: '#ff4fa3', bot: '#12052e', tile: '#ff3ea5', edge: '#ffd1ec', acc: '#5ff3ff', sun: ['#ffe66d', '#ff4fa3'] },
  { top: '#020b24', hor: '#2fd8ff', bot: '#041434', tile: '#22c8ff', edge: '#dff9ff', acc: '#ff5ae0', sun: ['#ffffff', '#3fb8ff'] },
  { top: '#1c0309', hor: '#ff9e3d', bot: '#2a0612', tile: '#ffc23d', edge: '#fff2c4', acc: '#ff3b6b', sun: ['#fff3b0', '#ff5a36'] },
  { top: '#021512', hor: '#4dffc3', bot: '#03201c', tile: '#3dffb0', edge: '#e8fff6', acc: '#ffffff', sun: ['#f2fff9', '#2be0a8'] },
  { top: '#0e0322', hor: '#b07cff', bot: '#16052e', tile: '#a974ff', edge: '#efe4ff', acc: '#ffe66d', sun: ['#ffe9a8', '#c35cff'] },
];
const VZ = 7.2, BALL_R = 0.34, TILE = 1.5;

const S = store('neonhop');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('neonhop');
const stage = createStage({ fov: 58, shadows: false });
const { scene, camera } = stage;
stage.hemi.intensity = 0.9; stage.sun.intensity = 0.8;
scene.fog = new THREE.Fog('#ff4fa3', 40, 120);
const ui = createUI({ title: 'NEON<br>HOP', hint: 'Hold &amp; drag to steer', hand: '👆' });
const songLine = document.createElement('p'); songLine.className = 'song'; ui.els.start.insertBefore(songLine, ui.els.start.querySelector('.hint'));
const player = createPlayer();
const fx = sparks(scene, 150);

// ---------------------------------------------------------------- world: sky, synth sun, grid, stars, floating shapes
const sky = skyDome('#0d0326', '#ff4fa3', '#12052e', 260); scene.add(sky);
const stars = starField(500, 240, '#ffffff', 1.6, 0.05); scene.add(stars);
function sunTex(a, b) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 7; k++) { const y = 150 + k * 15, h = 2 + k * 1.6; g.fillRect(0, y, 256, h); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sunMat = new THREE.SpriteMaterial({ map: sunTex('#ffe66d', '#ff4fa3'), transparent: true, fog: false, depthWrite: false });
const sunS = new THREE.Sprite(sunMat); sunS.scale.setScalar(46); scene.add(sunS);
const sunGlow = glowSprite('#ff4fa3', 190, 'soft', 0.55); sunGlow.material.fog = false; scene.add(sunGlow);
const grid = new THREE.GridHelper(400, 80, '#ff4fa3', '#ff4fa3'); grid.material.transparent = true; grid.material.opacity = 0.5; grid.position.y = -6; scene.add(grid);
const decoGeo = new THREE.OctahedronGeometry(1.4, 0), decoMat = new THREE.MeshBasicMaterial({ color: '#5ff3ff', wireframe: true, transparent: true, opacity: 0.6 });
const decos = [];
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(decoGeo, decoMat); m.userData.side = i % 2 ? 1 : -1; m.userData.off = i * 11; m.userData.h = 1 + Math.random() * 6; scene.add(m); decos.push(m); }

// ---------------------------------------------------------------- tiles (shared geometry, per-level materials)
const tileGeo = rounded(TILE, 0.28, TILE, 0.1);
const frameGeo = (() => { const s = new THREE.Shape(), o = TILE / 2 - 0.12, i2 = TILE / 2 - 0.24; s.moveTo(-o, -o); s.lineTo(o, -o); s.lineTo(o, o); s.lineTo(-o, o); s.lineTo(-o, -o);
  const h = new THREE.Path(); h.moveTo(-i2, -i2); h.lineTo(-i2, i2); h.lineTo(i2, i2); h.lineTo(i2, -i2); h.lineTo(-i2, -i2); s.holes.push(h); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })();
const haloGeo = new THREE.PlaneGeometry(TILE * 2.6, TILE * 2.6).rotateX(-Math.PI / 2);
const gemGeo = new THREE.OctahedronGeometry(0.3, 0); gemGeo.scale(1, 1.3, 1);
let tileMat, frameMat, haloMat, gemMat, hitMat;
function makeMats(th) {
  tileMat = new THREE.MeshStandardMaterial({ color: th.tile, emissive: th.tile, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 });
  hitMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: th.edge, emissiveIntensity: 1, roughness: 0.3, transparent: true, opacity: 0.95 });
  frameMat = new THREE.MeshBasicMaterial({ color: th.edge, transparent: true, opacity: 0.95, depthWrite: false });
  haloMat = new THREE.MeshBasicMaterial({ map: glowTex('soft'), color: th.tile, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  gemMat = new THREE.MeshStandardMaterial({ color: th.acc, emissive: th.acc, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.3, flatShading: true });
}

// ---------------------------------------------------------------- ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.2 }));
scene.add(ball);
const ballGlow = glowSprite('#ffffff', 2.2, 'soft', 0.7); scene.add(ballGlow);
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(shadowBlob);
const trail = [];
for (let i = 0; i < 14; i++) { const s = glowSprite('#ffffff', 0.6, 'soft', 0); scene.add(s); trail.push(s); }

// ---------------------------------------------------------------- level state
let state = 'ready', track, tiles = [], theme, score = 0, combo = 0, gems = 0, landed = -1, bx = 0, tx = 0, by = 0, bz = 0, squash = 0, fallV = 0, failT = 0, camX = 0, pulse = 0, lastBeat = -1, clock = 0;
const tileGroup = new THREE.Group(); scene.add(tileGroup);
function buildLevel() {
  tileGroup.clear(); fx.clear();
  const plan = levelPlan(level, ORDER);
  track = arrange(plan.song, { bars: plan.bars, tempo: plan.tempo, ramp: 0.05, density: 1 });
  theme = THEMES[(level - 1) % THEMES.length]; makeMats(theme);
  sky.setColors(theme.top, theme.hor, theme.bot); scene.fog.color.set(theme.hor); sunMat.map = sunTex(theme.sun[0], theme.sun[1]); sunMat.needsUpdate = true; sunGlow.material.color.set(theme.hor);
  grid.material.color.set(theme.tile); decoMat.color.set(theme.acc);
  document.body.style.background = `linear-gradient(180deg,${theme.top},${theme.hor})`; document.body.style.setProperty('--ui', theme.tile);
  const fk = F.k(), minGap = clamp((0.36 - (level - 1) * 0.012) / fk, 0.22, 0.38), maxDx = clamp((2.2 + level * 0.15) * fk, 2, 3.6);
  const hs = hits(track, minGap), r = rng(level * 4231 + 11);
  let x = 0;
  tiles = [{ t: -99, x: 0, z: 1.2, start: true }];
  hs.forEach((h, i) => {
    const step = (r() - 0.5) * 2 * maxDx * Math.min(1, 0.45 + h.dur);
    x = clamp(x + step, -2.6, 2.6); if (Math.abs(step) < 0.5 && r() < 0.5) x = clamp(x + Math.sign(r() - 0.5) * 1.2, -2.6, 2.6);
    const moving = level >= 3 && i > 6 && r() < Math.min(0.34, 0.06 * (level - 2) * fk) ? (r() < 0.5 ? -1 : 1) : 0;
    tiles.push({ ...h, x, z: -h.t * VZ, gem: i > 2 && r() < 0.22, moving, phase: r() * 6 });
  });
  for (const t of tiles) {
    const g = new THREE.Group(), body = new THREE.Mesh(tileGeo, tileMat), frame = new THREE.Mesh(frameGeo, frameMat), halo = new THREE.Mesh(haloGeo, haloMat);
    frame.position.y = 0.245; halo.position.y = -0.2; g.add(halo, body, frame); g.body = body; g.position.set(t.x, 0, t.z);
    if (t.start) g.scale.set(1.6, 1, 2.2);
    if (t.gem) { const gm = new THREE.Mesh(gemGeo, gemMat); gm.position.y = 0.95; g.add(gm); g.gem = gm; }
    tileGroup.add(g); t.g = g;
  }
  score = 0; combo = 0; gems = 0; landed = 0; bx = tx = 0; by = 0; bz = 1.2; squash = 0; fallV = 0; camX = 0;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? `BEST ${best}` : '');
  songLine.textContent = `♪ ${plan.song.title} — ${plan.song.composer}`;
}
const tileX = (t, now) => t.moving ? t.x + Math.sin(now * 2.2 + t.phase) * 0.9 * t.moving : t.x;

function begin() { state = 'play'; player.start(track, { melody: true, lead: 1.6, melVol: 0.2, accVol: 1, drumVol: 1 }); }

// ---------------------------------------------------------------- input: drag steers (relative), one verb
input({ onMove: (dx) => { if (state === 'play' || state === 'ready') tx = clamp(tx + dx * (7.5 / Math.min(innerWidth, 520)), -3.4, 3.4); } });
ui.onTap(which => { if (which !== 'start') buildLevel(); begin(); });

function land(i, now) {
  const t = tiles[i], dx = Math.abs(bx - tileX(t, now));
  if (dx > TILE / 2 + BALL_R * 0.55) return false;
  landed = i; squash = 1; combo++;
  const perfect = dx < 0.26;
  score += perfect ? 2 : 1; ui.score(score); ui.progress(i / (tiles.length - 1));
  t.g.body.material = hitMat.clone(); t.hitAt = clock; t.g.position.y = -0.18;
  const p = new THREE.Vector3(tileX(t, now), 0.2, t.z);
  fx.emit(p, ['#ffffff', theme.tile, theme.edge], perfect ? 14 : 8, { speed: 0.08, up: 0.06, size: 0.5, gravity: 0.004 });
  const ring = glowSprite(theme.edge, 1, 'ring', 1); ring.position.copy(p); scene.add(ring); waves.push({ s: ring, life: 1 });
  if (perfect) { ui.pop(combo > 2 ? `PERFECT ×${combo}` : 'PERFECT', '#ffffff', 30, 24); buzz(12); }
  else { combo = 0; buzz(6); }
  if (t.gem && t.g.gem) { gems++; score += 3; ui.score(score); t.g.gem.visible = false; synth.chime(96, player.at(now) + 0.01, 0.12); fx.emit(p.clone().setY(1), [theme.acc, '#ffffff'], 14, { speed: 0.1, up: 0.08, size: 0.45 }); ui.pop('+3 💎', theme.acc, 26, 31); }
  return true;
}
const waves = [];
function fail() {
  state = 'lost'; F.level(false, landed / (tiles.length - 1)); failT = clock; fallV = 0.02; player.stop(0.3); synth.fail(); buzz([40, 30, 60]);
  best = Math.max(best, score); S.set('best', best);
  ui.lose('OOPS!', `${Math.round(landed / (tiles.length - 1) * 100)}% · ${score} pts`);
}
function win() {
  state = 'won'; F.level(true); best = Math.max(best, score); S.set('best', best);
  for (let k = 0; k < 5; k++) fx.emit(new THREE.Vector3(bx + (k - 2) * 0.8, 1.2, bz - 2), ['#ffffff', theme.tile, theme.acc, '#ffe66d'], 18, { speed: 0.16, up: 0.12, size: 0.6 });
  ui.flash(0.5); buzz([20, 40, 30]); ui.win(level, `${score} pts · ${gems} 💎`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- frame
loop((dt) => {
  clock += dt / 60; fx.update(dt);
  const now = state === 'ready' ? -1.6 : player.time();
  bx = lerp(bx, tx, 1 - Math.pow(0.6, dt));
  if (state === 'play') {
    // landing checks for every tile we have reached
    while (landed < tiles.length - 1 && now >= tiles[landed + 1].t) { if (!land(landed + 1, now)) { fail(); break; } }
    if (state === 'play' && landed === tiles.length - 1 && now > tiles[landed].t + 0.45) win();
  }
  // ball path: parabola between the landed tile and the next one
  if (state === 'lost') { fallV += 0.012 * dt; by -= fallV * dt; bz -= VZ / 60 * dt * Math.max(0, 1 - (clock - failT) * 0.8); }
  else if (state === 'play' || state === 'won') {
    const a = tiles[landed], b = tiles[landed + 1], sb = track.beats[1].t - track.beats[0].t;
    if (b) {
      const t0 = a.start ? b.t - sb : a.t;
      if (now >= t0) { const s = clamp((now - t0) / (b.t - t0), 0, 1), gap = b.t - t0; by = 4 * clamp(gap * 2.0, 0.7, 2.6) * s * (1 - s); bz = lerp(a.z, b.z, s); }
      else { const ph = (((now - t0) % sb) + sb) % sb / sb; by = 1.4 * 4 * ph * (1 - ph) * 0.5; bz = a.z; }   // lead-in bounce on the pad
    } else { const s = clamp((now - a.t) / 0.5, 0, 1); by = 2.4 * s * (1 - s); bz = a.z - s * 3; }
  } else { by = 0.6 + Math.sin(clock * 5) * 0.3; bz = 1.2; }
  squash = Math.max(0, squash - 0.08 * dt);
  ball.position.set(bx, by + BALL_R + 0.22, bz); ball.scale.set(1 + squash * 0.3, 1 - squash * 0.35, 1 + squash * 0.3);
  ballGlow.position.copy(ball.position); ballGlow.material.opacity = 0.55 + pulse * 0.3;
  shadowBlob.position.set(bx, 0.255, bz); shadowBlob.material.opacity = state === 'lost' ? 0 : clamp(0.4 - by * 0.08, 0.05, 0.4); shadowBlob.scale.setScalar(1 - clamp(by * 0.12, 0, 0.5));
  // trail
  for (let i = trail.length - 1; i > 0; i--) trail[i].position.copy(trail[i - 1].position);
  trail[0].position.copy(ball.position);
  trail.forEach((s, i) => { s.material.opacity = state === 'ready' ? 0 : 0.35 * (1 - i / trail.length); s.scale.setScalar(0.75 * (1 - i / trail.length * 0.7)); });
  // beat pulse
  if (track && state === 'play') { const b = track.beats.findLastIndex(b => b.t <= now); if (b !== lastBeat && b >= 0) { lastBeat = b; pulse = track.beats[b].down ? 1 : 0.6; } }
  pulse *= Math.pow(0.9, dt);
  sky.uniforms.pulse.value = pulse; grid.material.opacity = 0.4 + pulse * 0.4; haloMat && (haloMat.opacity = 0.4 + pulse * 0.35);
  // tiles: moving ones slide, landed ones spring back
  for (const t of tiles) {
    if (!t.g) continue; const near = t.z < bz + 10 && t.z > bz - 95; t.g.visible = near; if (!near) continue;
    t.g.position.x = tileX(t, Math.max(now, 0));
    if (t.hitAt !== undefined) {   // flash white, spring back, then sink away into the void once the ball has left
      const k = clamp((clock - t.hitAt) * 4, 0, 1), age = clock - t.hitAt, m = t.g.body.material;
      m.color.set('#ffffff').lerp(tileMat.color, clamp(age * 3, 0, 1)); m.emissive.set(theme.edge).lerp(tileMat.emissive, clamp(age * 3, 0, 1));
      const sink = landed > tiles.indexOf(t) || state === 'won' ? clamp(age - 0.35, 0, 2) : 0;
      t.g.position.y = -0.18 * (1 - ease.out(k)) - sink * sink * 6; m.opacity = 0.95 * (1 - clamp(sink * 1.6, 0, 1));
    }
    if (t.g.gem) { t.g.gem.rotation.y += 0.04 * dt; t.g.gem.position.y = 0.95 + Math.sin(clock * 3 + t.phase) * 0.12; }
  }
  for (let k = waves.length - 1; k >= 0; k--) { const w = waves[k]; w.life -= 0.04 * dt; w.s.material.opacity = Math.max(0, w.life); w.s.scale.setScalar(1 + (1 - w.life) * 2.2); if (w.life <= 0) { scene.remove(w.s); w.s.material.dispose(); waves.splice(k, 1); } }
  // camera: behind and above, easing sideways with the ball
  camX = lerp(camX, bx * 0.55, 1 - Math.pow(0.9, dt));
  const camY = state === 'lost' ? 3.6 : 3.6 + by * 0.12;
  camera.position.set(camX, camY, bz + 5.6); camera.lookAt(camX * 0.6 + bx * 0.2, 0.2, bz - 6.5);
  sky.position.set(camera.position.x, 0, camera.position.z); stars.position.copy(sky.position);
  sunS.position.set(camX * 0.4, 9 + pulse * 0.5, bz - 170); sunGlow.position.set(sunS.position.x, 4, bz - 175);
  grid.position.z = bz - (bz % 5);
  decos.forEach((m, i) => { const z = bz + 10 - (150 - ((-bz + m.userData.off) % 150)); m.position.set(m.userData.side * (9 + (i % 3) * 3), m.userData.h + Math.sin(clock + i) * 0.8, z); m.rotation.y += 0.01 * dt; m.rotation.x += 0.006 * dt; m.scale.setScalar(1 + pulse * 0.25); });
});

// ---------------------------------------------------------------- boot
buildLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // steer toward the centre of the next tile (where it will be when we land)
    if (state !== 'play') return;
    const n = tiles[landed + 1]; if (!n) return;
    tx = tileX(n, n.t) + (Math.random() - 0.5) * 0.3;
  },
};

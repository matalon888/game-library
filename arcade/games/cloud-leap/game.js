// Cloud Leap — original sky-hopper. A ball leaps forward across floating pillars on every beat of the song while the
// sky changes mood with the music. Drag to steer onto a safe pillar; spikes and empty air end the run; grab the stars.
import { THREE, createStage, createUI, store, loop, input, buzz, rng, clamp, lerp, rounded } from './kit/hc.js';
import { levelPlan, arrange } from './_music/songs.js';
import { createPlayer, synth } from './_music/conductor.js';
import { glowSprite, glowTex, sparks, skyDome, ease } from './_music/fx.js';

const ORDER = ['twinkle', 'canon', 'ode', 'neon', 'minuet', 'starlight', 'saints', 'elise', 'cancan', 'mountain', 'turkish'];
const MOODS = [
  { top: '#3b2a8f', hor: '#ffb0dc', bot: '#7d62d6', tile: '#ff7ac8', side: '#5a46a8', mount: '#7454c4', moon: '#fff4f8' },
  { top: '#5a1a3a', hor: '#ffbc73', bot: '#b8464f', tile: '#ffcc4d', side: '#6a2a52', mount: '#8a3550', moon: '#fff1c9' },
  { top: '#08224a', hor: '#5fe0d0', bot: '#14456a', tile: '#45e3ff', side: '#1f4f8a', mount: '#1a4b72', moon: '#e9fffc' },
  { top: '#0a2e28', hor: '#9cffc4', bot: '#0f5745', tile: '#4dff9a', side: '#1a5c50', mount: '#16584a', moon: '#f2fff6' },
  { top: '#2a0f4a', hor: '#c9a6ff', bot: '#5a2f9a', tile: '#b48cff', side: '#45307f', mount: '#5a3a9a', moon: '#ffffff' },
];
const COLS = [-3, -1.5, 0, 1.5, 3], TILE = 1.42, STEP = 1.5;

const S = store('cloudleap');
let level = S.get('level', 1), best = S.get('best', 0);
const stage = createStage({ fov: 55, shadows: true, shadowSize: 9 });
const { scene, camera, sun } = stage;
stage.hemi.intensity = 1.1; sun.intensity = 1.4;
scene.fog = new THREE.Fog('#ffb0dc', 30, 75);
const ui = createUI({ title: 'CLOUD<br>LEAP', hint: 'Hold &amp; drag to steer', hand: '👆' });
const songLine = document.createElement('p'); songLine.className = 'song'; ui.els.start.insertBefore(songLine, ui.els.start.querySelector('.hint'));
const player = createPlayer();
const fx = sparks(scene, 140);

// ---------------------------------------------------------------- sky: dome, moon, mountains, clouds
const sky = skyDome('#3b2a8f', '#ffb0dc', '#7d62d6', 200); scene.add(sky);
const moon = glowSprite('#fff4f8', 26, 'hard', 1); moon.material.blending = THREE.NormalBlending; moon.material.fog = false; scene.add(moon);
const moonHalo = glowSprite('#ffffff', 80, 'soft', 0.45); moonHalo.material.fog = false; scene.add(moonHalo);
function ridge(seed, w, h, rough) { const r = rng(seed), s = new THREE.Shape(); s.moveTo(-w / 2, -40); let x = -w / 2; s.lineTo(x, 0);
  while (x < w / 2) { x += 6 + r() * 14; s.lineTo(x, h * (0.3 + r() * 0.7) + (r() < rough ? h * 0.5 : 0)); } s.lineTo(w / 2, -40); return new THREE.ShapeGeometry(s); }
const mountMats = [0.75, 0.55].map(o => new THREE.MeshBasicMaterial({ color: '#7454c4', transparent: true, opacity: o, fog: false, depthWrite: false }));
const mounts = [new THREE.Mesh(ridge(3, 500, 26, 0.2), mountMats[0]), new THREE.Mesh(ridge(9, 500, 16, 0.3), mountMats[1])];
mounts.forEach((m, i) => { m.renderOrder = -2 + i; scene.add(m); });
const clouds = [];
for (let i = 0; i < 26; i++) { const c = glowSprite('#ffffff', 8 + Math.random() * 10, 'soft', 0.35 + Math.random() * 0.3); c.material.blending = THREE.NormalBlending; c.userData.p = new THREE.Vector3((Math.random() - 0.5) * 60, -7 - Math.random() * 5, -Math.random() * 90); scene.add(c); clouds.push(c); }
const motes = []; for (let i = 0; i < 30; i++) { const s = glowSprite('#ffffff', 0.25, 'hard', 0.7); s.userData.p = new THREE.Vector3((Math.random() - 0.5) * 16, Math.random() * 8 - 1, -Math.random() * 40); scene.add(s); motes.push(s); }

// ---------------------------------------------------------------- pillars (instanced), spikes, stars
const pillarGeo = rounded(TILE, 9, TILE, 0.1); pillarGeo.translate(0, -4.5, 0);
const capGeo = (() => { const s = new THREE.Shape(), o = TILE / 2 - 0.08; s.moveTo(-o, -o); s.lineTo(o, -o); s.lineTo(o, o); s.lineTo(-o, o); s.lineTo(-o, -o); const h = new THREE.Path(); h.absarc(0, 0, 0.36, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, 0.1, 0); return g; })();
const ringGeo = new THREE.RingGeometry(0.3, 0.38, 28).rotateX(-Math.PI / 2);
const spikeGeo = new THREE.ConeGeometry(0.22, 0.6, 12); spikeGeo.translate(0, 0.3, 0);
const pillarMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.05 });
const capMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.25 });
const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
const spikeMat = new THREE.MeshStandardMaterial({ color: '#ff2d55', emissive: '#a0001e', emissiveIntensity: 0.4, roughness: 0.3 });
const starGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.17 : 0.4; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); g.center(); return g; })();
const starMat = new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb000', emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.3 });
let pillars, caps, rings, spikes;
const flashTile = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(flashTile);
const flashGlow = glowSprite('#ffffff', 3.5, 'soft', 0); scene.add(flashGlow);

// ---------------------------------------------------------------- ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.15 }));
ball.castShadow = true; scene.add(ball);
const bGlow = glowSprite('#ffffff', 2, 'soft', 0.55); scene.add(bGlow);
const trail = Array.from({ length: 10 }, () => { const s = glowSprite('#ffffff', 0.6, 'soft', 0); scene.add(s); return s; });

// ---------------------------------------------------------------- level
let state = 'ready', track, rows = [], stars = [], score = 0, combo = 0, starsGot = 0, landed = 0, bx = 0, tx = 0, by = 0, bz = 0, squash = 0, fallV = 0, pulse = 0, lastBeat = -1, clock = 0, moodK = 0, mood = 0, failT = 0;
const cur = { top: new THREE.Color(), hor: new THREE.Color(), bot: new THREE.Color(), tile: new THREE.Color(), side: new THREE.Color(), mount: new THREE.Color(), moon: new THREE.Color() };
const starGroup = new THREE.Group(); scene.add(starGroup);
function buildLevel() {
  for (const m of [pillars, caps, rings, spikes]) if (m) { scene.remove(m); m.dispose(); }
  starGroup.clear(); fx.clear();
  const plan = levelPlan(level, ORDER);
  track = arrange(plan.song, { bars: plan.bars, tempo: plan.tempo, ramp: 0.04, density: 1 });
  const r = rng(level * 3301 + 7), beats = track.beats;
  // one row of pillars per beat; a winding safe path with decoys and spikes on the sides
  rows = [{ t: -99, z: STEP, plats: COLS.map((x, c) => ({ c, x, spike: false })), start: true }];
  let p = 2;
  const pSpike = clamp(0.12 + level * 0.05, 0.12, 0.5), pExtra = clamp(0.55 - level * 0.03, 0.25, 0.55);
  beats.forEach((b, i) => {
    if (i > 1) p = clamp(p + (r() < 0.55 ? (r() < 0.5 ? -1 : 1) : 0), 0, 4);
    const plats = [{ c: p, x: COLS[p], spike: false, path: true }];
    for (let c = 0; c < 5; c++) if (c !== p) {
      const nearPath = Math.abs(c - p) === 1;
      if (i < 2 || (nearPath && r() < pExtra)) plats.push({ c, x: COLS[c], spike: false });
      else if (i > 2 && r() < pSpike) plats.push({ c, x: COLS[c], spike: true });
    }
    rows.push({ t: b.t, z: -i * STEP, plats, bar: b.bar, down: b.down });
  });
  rows.push({ t: track.length + 0.05, z: -(beats.length) * STEP, plats: COLS.map((x, c) => ({ c, x, spike: false })), finish: true });
  // instancing
  const n = rows.reduce((a, r) => a + r.plats.length, 0), ns = rows.reduce((a, r) => a + r.plats.filter(q => q.spike).length, 0) * 3;
  pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, n); caps = new THREE.InstancedMesh(capGeo, capMat, n); rings = new THREE.InstancedMesh(ringGeo, ringMat, n); spikes = new THREE.InstancedMesh(spikeGeo, spikeMat, Math.max(1, ns));
  pillars.receiveShadow = true; pillars.castShadow = true; caps.receiveShadow = true; spikes.castShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let k = 0, ks = 0;
  rows.forEach((row, ri) => row.plats.forEach(q => {
    const h = q.spike ? 0.35 : (row.finish || row.start ? 0 : (ri % 7 === 3 && !q.path ? -0.6 : 0));
    q.y = h; q.i = k;
    m4.makeTranslation(q.x, h, row.z); pillars.setMatrixAt(k, m4); caps.setMatrixAt(k, m4); m4.makeTranslation(q.x, h + 0.17, row.z); rings.setMatrixAt(k, m4);
    pillars.setColorAt(k, col.set(q.spike ? '#2a2440' : '#ffffff')); caps.setColorAt(k, col.set(q.spike ? '#3a3355' : row.finish ? '#ffd84a' : '#ffffff')); rings.setColorAt(k, col.set(q.spike ? '#ff2d55' : '#ffffff'));
    if (q.spike) for (const [dx, dz] of [[-0.3, 0.25], [0.3, 0.25], [0, -0.3]]) { m4.makeTranslation(q.x + dx, h + 0.15, row.z + dz); spikes.setMatrixAt(ks++, m4); }
    k++;
  }));
  if (!ns) { m4.makeTranslation(0, -999, 0); spikes.setMatrixAt(0, m4); }
  scene.add(pillars, caps, rings, spikes);
  // stars: on the path, and sometimes on a risky side pillar
  stars = [];
  rows.forEach((row, ri) => { if (ri < 3 || row.finish || r() > 0.2) return; const safe = row.plats.filter(q => !q.spike); const q = r() < 0.7 ? safe.find(s => s.path) : safe[Math.floor(r() * safe.length)];
    const m = new THREE.Mesh(starGeo, starMat); m.position.set(q.x, q.y + 1.1, row.z); m.castShadow = true; starGroup.add(m); stars.push({ m, row: ri, q, got: false }); });
  mood = Math.floor(r() * MOODS.length) + level; moodK = 1; applyMood(MOODS[mood % MOODS.length], 1);
  score = 0; combo = 0; starsGot = 0; landed = 0; bx = tx = 0; by = 0; bz = STEP; squash = 0; fallV = 0;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? `BEST ${best}` : '');
  songLine.textContent = `♪ ${plan.song.title} — ${plan.song.composer}`;
}
function applyMood(m, k) {
  for (const key of Object.keys(cur)) cur[key].lerp(new THREE.Color(m[key]), k);
  sky.uniforms.top.value.copy(cur.top); sky.uniforms.mid.value.copy(cur.hor); sky.uniforms.bot.value.copy(cur.bot); scene.fog.color.copy(cur.hor);
  pillarMat.color.copy(cur.side); capMat.color.copy(cur.tile); capMat.emissive.copy(cur.tile); mountMats.forEach(mm => mm.color.copy(cur.mount)); moon.material.color.copy(cur.moon);
  document.body.style.setProperty('--ui', '#' + cur.tile.getHexString());
}
function begin() { state = 'play'; player.start(track, { melody: true, lead: 1.4, melVol: 0.2, accVol: 0.95, drumVol: 0.9 }); document.body.style.background = `linear-gradient(180deg,#${cur.top.getHexString()},#${cur.hor.getHexString()})`; }

input({ onMove: (dx) => { if (state === 'play' || state === 'ready') tx = clamp(tx + dx * (8 / Math.min(innerWidth, 520)), -3.4, 3.4); } });
ui.onTap(which => { if (which !== 'start') buildLevel(); begin(); });

function land(ri, now) {
  const row = rows[ri], q = row.plats.find(q => Math.abs(q.x - bx) < TILE / 2 + 0.12);
  if (!q) return fail('fall');
  if (q.spike) return fail('spike', q, row);
  landed = ri; squash = 1; combo++;
  const perfect = Math.abs(q.x - bx) < 0.3; score += perfect ? 2 : 1;
  flashTile.position.set(q.x, q.y + 0.18, row.z); flashTile.material.opacity = 0.9; flashGlow.position.set(q.x, q.y + 0.4, row.z); flashGlow.material.opacity = 0.7;
  fx.emit(new THREE.Vector3(q.x, q.y + 0.2, row.z), ['#ffffff', '#' + cur.tile.getHexString()], perfect ? 10 : 6, { speed: 0.07, up: 0.05, size: 0.35, gravity: 0.004 });
  if (perfect && combo % 8 === 0) ui.pop(`PERFECT ×${combo}`, '#ffffff', 30, 24); else if (perfect && combo < 8 && combo > 2) ui.pop('PERFECT', '#ffffff', 26, 24);
  if (!perfect) combo = 0;
  for (const s of stars) if (!s.got && s.row === ri && s.q === q) { s.got = true; starsGot++; score += 5; s.m.visible = false; synth.chime(91, player.at(now), 0.13); synth.chime(98, player.at(now) + 0.06, 0.1); ui.pop('+5 ★', '#ffd84a', 30, 31); fx.emit(s.m.position, ['#ffd84a', '#ffffff'], 16, { speed: 0.1, up: 0.07, size: 0.45 }); buzz(15); }
  buzz(perfect ? 8 : 4);
  ui.score(score); ui.progress(ri / (rows.length - 1));
  if (row.finish) win();
  return true;
}
function fail(why, q, row) {
  state = 'lost'; failT = clock; fallV = why === 'fall' ? 0.0 : -0.12; player.stop(0.3); synth.fail(); buzz([50, 30, 70]);
  if (why === 'spike') { fx.emit(ball.position, ['#ff2d55', '#ffffff'], 26, { speed: 0.15, up: 0.1, size: 0.5 }); ball.visible = false; ui.flash(0.5); }
  best = Math.max(best, score); S.set('best', best);
  ui.lose(why === 'spike' ? 'OUCH!' : 'OOPS!', `${Math.round(landed / (rows.length - 1) * 100)}% · ${score} pts · ${starsGot} ★`);
  return false;
}
function win() {
  state = 'won'; best = Math.max(best, score); S.set('best', best);
  for (let k = 0; k < 5; k++) fx.emit(new THREE.Vector3(bx + (k - 2), 1.6, bz - 1), ['#ffd84a', '#ffffff', '#' + cur.tile.getHexString(), '#ff9be8'], 18, { speed: 0.16, up: 0.12, size: 0.55 });
  ui.flash(0.5); buzz([20, 40, 30]); ui.win(level, `${score} pts · ${starsGot} ★`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- frame
loop((dt) => {
  clock += dt / 60; fx.update(dt);
  const now = state === 'ready' ? -1.4 : player.time();
  bx = lerp(bx, tx, 1 - Math.pow(0.55, dt));
  if (state === 'play') {
    while (state === 'play' && landed < rows.length - 1 && now >= rows[landed + 1].t) land(landed + 1, now);
    const b = track.beats.findLastIndex(b => b.t <= now); if (b !== lastBeat && b >= 0) { lastBeat = b; pulse = track.beats[b].down ? 1 : 0.5;
      // the sky changes mood every 8 bars
      if (track.beats[b].down && track.beats[b].bar > 0 && track.beats[b].bar % 8 === 0) { mood++; moodK = 0; } }
  }
  if (moodK < 1) { moodK = Math.min(1, moodK + dt / 120); applyMood(MOODS[mood % MOODS.length], 0.04 * dt); }
  pulse *= Math.pow(0.9, dt);
  // ball: parabolic hop from the landed row to the next one
  if (state === 'lost') { fallV += 0.012 * dt; by -= fallV * dt; }
  else if (state === 'play' || state === 'won') {
    const a = rows[landed], b = rows[landed + 1], sb = track.beats[1].t - track.beats[0].t;
    if (b) { const t0 = a.start ? b.t - sb : a.t, s = clamp((now - t0) / (b.t - t0), 0, 1);
      if (now >= t0) { by = 4 * 1.1 * s * (1 - s) + lerp(platY(a), platY(b), s); bz = lerp(a.z, b.z, s); }
      else { const ph = (((now - t0) % sb) + sb) % sb / sb; by = 4 * 0.6 * ph * (1 - ph); bz = a.z; } }
    else { by = platY(a); bz = a.z; }
  } else { by = 0.35 + Math.abs(Math.sin(clock * 4)) * 0.6; bz = STEP; }
  squash = Math.max(0, squash - 0.08 * dt);
  if (ball.visible) { ball.position.set(bx, by + 0.38 + 0.17, bz); ball.scale.set(1 + squash * 0.3, 1 - squash * 0.35, 1 + squash * 0.3); }
  bGlow.position.copy(ball.position); bGlow.material.opacity = ball.visible ? 0.45 + pulse * 0.3 : 0;
  for (let i = trail.length - 1; i > 0; i--) trail[i].position.copy(trail[i - 1].position);
  trail[0].position.copy(ball.position);
  trail.forEach((s, i) => { s.material.opacity = state === 'play' && ball.visible ? 0.3 * (1 - i / trail.length) : 0; s.scale.setScalar(0.7 * (1 - i / trail.length * 0.6)); });
  flashTile.material.opacity *= Math.pow(0.9, dt); flashGlow.material.opacity *= Math.pow(0.9, dt);
  ringMat.opacity = 0.55 + pulse * 0.45; capMat.emissiveIntensity = 0.22 + pulse * 0.25; sky.uniforms.pulse.value = pulse * 0.5;
  for (const s of stars) if (!s.got) { s.m.rotation.y += 0.05 * dt; s.m.position.y = s.q.y + 1.1 + Math.sin(clock * 3 + s.row) * 0.12; }
  // camera: sweeping chase cam (slow yaw + height drift)
  const yaw = Math.sin(clock * 0.23) * 0.22, dist = 6.4, h = 5.4 + Math.sin(clock * 0.17) * 0.8;
  const fz = state === 'lost' ? rows[landed].z : bz;
  camera.position.set(bx * 0.75 + Math.sin(yaw) * dist, h + (state === 'lost' ? 0 : by * 0.15), fz + Math.cos(yaw) * dist);
  camera.lookAt(bx * 0.85, 0.9, fz - 8);
  sky.position.copy(camera.position); stage.followLight(new THREE.Vector3(0, 0, fz - 3));
  moon.position.set(camera.position.x + 22, 30, fz - 150); moonHalo.position.copy(moon.position);
  mounts[0].position.set(camera.position.x * 0.9, -6, fz - 160); mounts[1].position.set(camera.position.x * 0.8, -8, fz - 120);
  for (const c of clouds) { const p = c.userData.p, z = fz + 10 - (((-fz + -p.z) % 90) + 90) % 90; c.position.set(p.x, p.y, z); }
  for (const s of motes) { const p = s.userData.p, z = fz + 6 - (((-fz + -p.z) % 40) + 40) % 40; s.position.set(p.x, p.y + Math.sin(clock + p.x) * 0.3, z); }
});
const platY = (row) => { const q = row.plats.find(q => Math.abs(q.x - bx) < TILE / 2 + 0.12) || row.plats[0]; return q && !q.spike ? q.y : 0; };

// ---------------------------------------------------------------- boot
buildLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // steer onto the nearest safe pillar of the next row (prefer one with a star)
    if (state !== 'play') return;
    const row = rows[landed + 1]; if (!row) return;
    const safe = row.plats.filter(q => !q.spike); const starQ = stars.find(s => !s.got && s.row === landed + 1);
    const pick = starQ ? starQ.q : safe.sort((a, b) => Math.abs(a.x - bx) - Math.abs(b.x - bx))[0];
    if (pick) tx = pick.x + (Math.random() - 0.5) * 0.2;
  },
};

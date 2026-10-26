// Color Groove — original rhythm roller. Your striped ball rolls down a neon space road, hopping on every beat.
// Steer into balls of YOUR colour (each one plays the next melody note), dodge every other colour, and pass through
// gates to change colour.
import { THREE, createStage, createUI, store, loop, input, buzz, rng, clamp, lerp } from './kit/hc.js';
import { levelPlan, arrange, hits } from './_music/songs.js';
import { createPlayer, synth } from './_music/conductor.js';
import { glowSprite, sparks, skyDome, starField, ease } from './_music/fx.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
const B = board({ game: 'color-groove', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const ORDER = ['twinkle', 'neon', 'ode', 'starlight', 'cancan', 'saints', 'mountain', 'minuet', 'turkish', 'elise', 'canon'];
const COLORS = ['#ff3fa4', '#ffd23f', '#35d6ff', '#9b6bff', '#45f59a', '#ff7a35'];
const SKIES = [
  { top: '#07021a', hor: '#7a1fbf', bot: '#1a0638', edge: '#ff4fd8', road: '#341a74' },
  { top: '#020822', hor: '#1f5fd6', bot: '#05122e', edge: '#3ff2ff', road: '#173a7a' },
  { top: '#14031a', hor: '#c2307a', bot: '#25061f', edge: '#ffb347', road: '#4a1a4f' },
  { top: '#03141a', hor: '#138f8a', bot: '#05201f', edge: '#7dffb8', road: '#134545' },
];
const VZ = 9, ROAD_W = 5.2, LANES = [-1.55, 0, 1.55], R = 0.42;
const cx = (z) => 2.4 * Math.sin(z * 0.043) + 1.3 * Math.sin(z * 0.017 + 1);
const cy = (z) => 1.1 * Math.sin(z * 0.022) + 0.4 * Math.sin(z * 0.061);

const S = store('colorgroove');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('colorgroove');
const stage = createStage({ fov: 60, shadows: false });
const { scene, camera } = stage;
stage.hemi.intensity = 1.0; stage.sun.intensity = 1.3;
scene.fog = new THREE.Fog('#7a1fbf', 50, 140);
const ui = createUI({ title: 'COLOR<br>GROOVE', hint: 'Tap left / right to switch lanes · or drag', hand: '👆' });
const songLine = document.createElement('p'); songLine.className = 'song'; ui.els.start.insertBefore(songLine, ui.els.start.querySelector('.hint'));
const player = createPlayer();
const fx = sparks(scene, 160);

// ---------------------------------------------------------------- space backdrop
const sky = skyDome('#07021a', '#7a1fbf', '#1a0638', 280); scene.add(sky);
const stars = starField(700, 260, '#ffffff', 1.5, -0.3); scene.add(stars);
function planetTex(a, b) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(90, 80, 10, 128, 128, 128); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.18; g.fillStyle = '#fff'; for (let k = 0; k < 6; k++) g.fillRect(0, 40 + k * 32, 256, 8 + k % 3 * 4); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const planets = [['#ffb3f0', '#5b1a8f', 70, -70, 40, -200], ['#9ff3ff', '#173c8f', 34, 80, 22, -170], ['#ffe0a3', '#b8453c', 18, -40, 52, -150]].map(([a, b, size, x, y, z]) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: planetTex(a, b), fog: false, transparent: true, depthWrite: false })); s.scale.setScalar(size); s.userData.off = new THREE.Vector3(x, y, z); scene.add(s); return s; });
const ring = new THREE.Mesh(new THREE.RingGeometry(44, 58, 64), new THREE.MeshBasicMaterial({ color: '#ffd1f5', transparent: true, opacity: 0.25, side: THREE.DoubleSide, fog: false, depthWrite: false })); ring.rotation.x = 1.2; scene.add(ring);
const nebula = [glowSprite('#ff4fd8', 160, 'soft', 0.25), glowSprite('#4f7bff', 140, 'soft', 0.22)]; nebula.forEach(n => { n.material.fog = false; scene.add(n); });

// ---------------------------------------------------------------- road (one long ribbon per level)
const roadMat = new THREE.ShaderMaterial({
  fog: true, transparent: false,
  uniforms: { base: { value: new THREE.Color('#1b0f3d') }, edge: { value: new THREE.Color('#ff4fd8') }, pulse: { value: 0 }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
  vertexShader: `varying vec2 vU; #include <fog_pars_vertex>
    void main(){ vU = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition; #include <fog_vertex>
 }`.replace(/#include/g, '\n#include'),
  fragmentShader: `uniform vec3 base; uniform vec3 edge; uniform float pulse; varying vec2 vU; #include <fog_pars_fragment>
    void main(){ float u = vU.x; float e = smoothstep(0.06, 0.0, u) + smoothstep(0.94, 1.0, u);
      float glowE = smoothstep(0.22, 0.0, u) + smoothstep(0.78, 1.0, u);
      float lanes = (1.0 - smoothstep(0.0, 0.012, abs(u - 0.35))) + (1.0 - smoothstep(0.0, 0.012, abs(u - 0.65)));
      float seg = step(0.92, fract(vU.y * 0.25));
      vec3 c = base * (1.0 + 0.5 * (1.0 - abs(u - 0.5) * 2.0)); c += edge * glowE * (0.25 + pulse * 0.35) + edge * e * 1.2 + vec3(1.0) * lanes * 0.06 + edge * seg * 0.08 * (1.0 + pulse);
      gl_FragColor = vec4(c, 1.0); #include <fog_fragment>
 }`.replace(/#include/g, '\n#include'),
});
let road = null, roadLen = 0;
function buildRoad(len) {
  if (road) { scene.remove(road); road.geometry.dispose(); }
  const n = Math.ceil(len) + 1, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
  for (let i = 0; i < n; i++) {
    const z = 30 - i, x = cx(z), y = cy(z);
    pos.set([x - ROAD_W / 2, y, z, x + ROAD_W / 2, y, z], i * 6); uv.set([0, i, 1, i], i * 4);
    if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  road = new THREE.Mesh(g, roadMat); road.frustumCulled = false; scene.add(road);
  // side rails (thin glowing tubes) using the same samples
  const pts = (side) => Array.from({ length: Math.ceil(n / 4) }, (_, k) => { const z = 30 - k * 4; return new THREE.Vector3(cx(z) + side * (ROAD_W / 2 + 0.05), cy(z) + 0.05, z); });
  for (const r of rails) { scene.remove(r); r.geometry.dispose(); } rails.length = 0;
  for (const side of [-1, 1]) { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts(side)), Math.ceil(n / 2), 0.07, 6), railMat); t.frustumCulled = false; scene.add(t); rails.push(t); }
  // under-glow below the road
  roadLen = len;
}
const rails = [], railMat = new THREE.MeshBasicMaterial({ color: '#ff4fd8' });

// ---------------------------------------------------------------- balls, gates
function stripeTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 64); g.fillStyle = 'rgba(0,0,0,0.0)';
  g.fillStyle = '#c9c9c9'; for (let k = 0; k < 4; k++) g.fillRect(0, 6 + k * 16, 128, 5); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const STRIPE = stripeTex();
const ballGeo = new THREE.SphereGeometry(R, 28, 18);
const colMats = COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, map: STRIPE, emissive: c, emissiveIntensity: 0.35, roughness: 0.18, metalness: 0.1 }));
const gateGeo = new THREE.TorusGeometry(ROAD_W / 2 + 0.3, 0.16, 10, 40, Math.PI);
const playerBall = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), colMats[0].clone()); scene.add(playerBall);
const pGlow = glowSprite('#ffffff', 2.6, 'soft', 0.6); scene.add(pGlow);
const pRim = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(pRim);
const pShadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false })); scene.add(pShadow);
const trail = Array.from({ length: 12 }, () => { const s = glowSprite('#ffffff', 0.8, 'soft', 0); scene.add(s); return s; });

// ---------------------------------------------------------------- level
let state = 'ready', track, rows = [], gates = [], score = 0, combo = 0, collected = 0, targets = 0, color = 0, off = 0, tOff = 0, bz = 0, hop = 0, squash = 0, pulse = 0, lastBeat = -1, clock = 0, failAt = 0, sky_;
const objGroup = new THREE.Group(); scene.add(objGroup);
function buildLevel() {
  objGroup.clear(); fx.clear();
  const plan = levelPlan(level, ORDER);
  track = arrange(plan.song, { bars: plan.bars, tempo: plan.tempo, ramp: 0.05, density: 1 });
  sky_ = SKIES[(level - 1) % SKIES.length];
  sky.setColors(sky_.top, sky_.hor, sky_.bot); scene.fog.color.set(sky_.hor); roadMat.uniforms.base.value.set(sky_.road); roadMat.uniforms.edge.value.set(sky_.edge); railMat.color.set(sky_.edge);
  document.body.style.background = `linear-gradient(180deg,${sky_.top},${sky_.hor})`;
  const fk = F.k(), hs = hits(track, clamp((0.34 - level * 0.01) / fk, 0.22, 0.38)), r = rng(level * 6151 + 5);
  const palette = [0, 1, 2, 3, 4, 5].sort(() => r() - 0.5).slice(0, level < 3 ? 2 : 3);
  // colour sections every 4 bars, each starting with a gate
  const secBars = 4, secOf = (t) => Math.max(0, track.barTimes.findLastIndex(bt => bt <= t + 0.05)) / secBars | 0;
  color = palette[0];
  let lane = 1; rows = []; gates = [];
  hs.forEach((h, i) => {
    const sec = secOf(h.t), col = palette[sec % palette.length];
    const step = h.dur < 0.42 ? (r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1)) : Math.floor(r() * 3) - lane;
    lane = clamp(lane + (h.dur < 0.42 ? step : 0), 0, 2); if (h.dur >= 0.42) lane = Math.floor(r() * 3);
    if (i > 0 && h.midi !== hs[i - 1].midi && r() < 0.55) lane = clamp(lane + Math.sign(h.midi - hs[i - 1].midi), 0, 2);
    const balls = [{ lane, col, good: true }];
    const pWrong = clamp((0.2 + level * 0.07) * fk, 0.18, 0.8);
    for (const l of [0, 1, 2]) if (l !== lane && i > 1 && r() < pWrong) balls.push({ lane: l, col: palette[(sec + 1 + Math.floor(r() * (palette.length - 1))) % palette.length], good: false });
    rows.push({ ...h, z: -h.t * VZ, balls, sec, col, done: false });
  });
  // gates between sections (between the last row of the previous section and the first of the next)
  for (let i = 1; i < rows.length; i++) if (rows[i].sec !== rows[i - 1].sec && rows[i].col !== rows[i - 1].col) {
    const t = (rows[i - 1].t + rows[i].t) / 2; gates.push({ t, z: -t * VZ, col: rows[i].col, done: false });
    rows[i].balls = rows[i].balls.filter(b => b.good);   // no trick balls right after a colour change
  }
  for (const row of rows) for (const b of row.balls) {
    const m = new THREE.Mesh(ballGeo, colMats[b.col]); b.m = m; b.x = LANES[b.lane];
    m.position.set(cx(row.z) + b.x, cy(row.z) + R, row.z); m.rotation.z = 0.4; objGroup.add(m);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(R * 0.9, 14).rotateX(-Math.PI / 2), pShadow.material); sh.position.set(m.position.x, cy(row.z) + 0.02, row.z); objGroup.add(sh); b.sh = sh;
  }
  for (const g of gates) {
    const arch = new THREE.Mesh(gateGeo, new THREE.MeshBasicMaterial({ color: COLORS[g.col] })); arch.position.set(cx(g.z), cy(g.z), g.z); objGroup.add(arch); g.m = arch;
    const veil = new THREE.Mesh(new THREE.CircleGeometry(ROAD_W / 2 + 0.2, 40, 0, Math.PI), new THREE.MeshBasicMaterial({ color: COLORS[g.col], transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); veil.position.copy(arch.position); objGroup.add(veil); g.veil = veil;
    const glow = glowSprite(COLORS[g.col], 7, 'soft', 0.5); glow.position.copy(arch.position).add(new THREE.Vector3(0, 2.6, 0)); objGroup.add(glow);
  }
  targets = rows.length;
  buildRoad((track.length + 3) * VZ + 60);
  score = 0; combo = 0; collected = 0; off = tOff = 0; bz = 0; hop = 0; squash = 0;
  setColor(color, false);
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? `BEST ${best}` : '');
  songLine.textContent = `♪ ${plan.song.title} — ${plan.song.composer}`;
}
function setColor(c, juice = true) {
  color = c; playerBall.material.color.set(COLORS[c]); playerBall.material.emissive.set(COLORS[c]); pGlow.material.color.set(COLORS[c]);
  trail.forEach(s => s.material.color.set(COLORS[c])); document.body.style.setProperty('--ui', COLORS[c]);
  if (juice) { ui.flash(0.3); synth.chime(88, player.at(player.time()), 0.12); synth.chime(95, player.at(player.time()) + 0.07, 0.1); buzz(15); }
}
function begin() { state = 'play'; player.start(track, { melody: false, lead: 1.5, accVol: 1, drumVol: 1 }); }

input({
  onMove: (dx) => { if (state === 'play' || state === 'ready') tOff = clamp(tOff + dx * (6.5 / Math.min(innerWidth, 520)), -ROAD_W / 2 + 0.5, ROAD_W / 2 - 0.5); },
  onTap: (e) => { if (state !== 'play') return; let i = 0; LANES.forEach((x, k) => { if (Math.abs(x - tOff) < Math.abs(LANES[i] - tOff)) i = k; }); tOff = LANES[clamp(i + (e.clientX < innerWidth / 2 ? -1 : 1), 0, LANES.length - 1)]; },   // tap a side = one lane that way
});
ui.onTap(which => { B.start(); if (which !== 'start') buildLevel(); begin(); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the ball steers itself lane to lane onto the balls of its own colour (the bot's line), so the first notes play and the rule shows
const DM = demo(null, { ready: () => state === 'play' && level === 1, wait: 300, ms: 4500 });

function passRow(row, now) {
  row.done = true;
  for (const b of row.balls) {
    if (Math.abs(off - b.x) > R + 0.5 - 0.12) continue;
    if (b.col !== color) return crash(b);
    // collect: play the melody note(s) of this row
    row.notes.forEach((n, k) => synth.piano(n.midi, player.at(k ? Math.max(now + 0.03, row.t + n.dt) : now), Math.max(0.3, n.dur), k ? 0.2 : 0.24));
    b.got = true; b.m.visible = b.sh.visible = false; collected++; combo++; squash = 1;
    const perfect = Math.abs(off - b.x) < 0.3; score += perfect ? 2 : 1; ui.score(score); ui.progress(collected / targets);
    fx.emit(b.m.position, [COLORS[b.col], '#ffffff'], perfect ? 16 : 10, { speed: 0.1, up: 0.06, size: 0.45, gravity: 0.003 });
    const w = glowSprite(COLORS[b.col], 1, 'ring', 1); w.position.copy(b.m.position); scene.add(w); waves.push({ s: w, life: 1 });
    if (perfect && combo >= 3) ui.pop(`PERFECT ×${combo}`, '#ffffff', 30, 24); else if (combo % 10 === 0) ui.pop(`${combo} COMBO!`, COLORS[color], 32, 24);
    buzz(perfect ? 10 : 5);
    return;
  }
  combo = 0;   // missed a ball of our colour: no penalty but the note is silent
}
const waves = [];
function crash(b) {
  state = 'lost'; F.level(false, collected / Math.max(1, targets)); failAt = clock; player.stop(0.3); synth.fail(); buzz([50, 30, 70]); ui.flash(0.6);
  fx.emit(playerBall.position, [COLORS[color], '#ffffff', COLORS[b.col]], 34, { speed: 0.18, up: 0.1, size: 0.6, gravity: 0.006 });
  playerBall.visible = false; pGlow.visible = false;
  best = Math.max(best, score); S.set('best', best);
  ui.lose('WRONG COLOR!', `${Math.round(collected / Math.max(1, targets) * 100)}% · ${score} pts`);
}
function win() {
  if (state === 'play') B.submit(1); state = 'won'; F.level(true); best = Math.max(best, score); S.set('best', best);
  for (let k = 0; k < 5; k++) fx.emit(playerBall.position.clone().add(new THREE.Vector3((k - 2) * 0.9, 1.5, -3)), [...COLORS, '#ffffff'], 18, { speed: 0.17, up: 0.12, size: 0.6 });
  ui.flash(0.5); buzz([20, 40, 30]); ui.win(level, `${score} pts · ${Math.round(collected / Math.max(1, targets) * 100)}% notes`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- frame
loop((dt) => {
  clock += dt / 60; fx.update(dt);
  if (DM.on) window.__game.bot();
  const now = state === 'ready' ? -1.2 : player.time();
  off = lerp(off, tOff, 1 - Math.pow(0.55, dt));
  if (state === 'play' || state === 'won') bz = -Math.max(-1.6, now) * VZ;
  if (state === 'play') {
    for (const g of gates) if (!g.done && now >= g.t) { g.done = true; setColor(g.col); g.veil.material.opacity = 0.6; }
    for (const row of rows) { if (row.done) continue; if (now < row.t) break; passRow(row, now); if (state !== 'play') break; }
    if (state === 'play' && rows.length && now > rows[rows.length - 1].t + 0.9) win();
    const b = track.beats.findLastIndex(b => b.t <= now); if (b !== lastBeat && b >= 0) { lastBeat = b; pulse = track.beats[b].down ? 1 : 0.6; }
  }
  pulse *= Math.pow(0.9, dt);
  // ball hops on every beat (ground contact exactly on the beat)
  if (track && (state === 'play' || state === 'won')) {
    const bi = track.beats.findLastIndex(b => b.t <= now), b0 = track.beats[Math.max(0, bi)], b1 = track.beats[bi + 1];
    const sb = b1 ? b1.t - b0.t : 0.5, ph = bi < 0 ? (((now % sb) + sb) % sb) / sb : clamp((now - b0.t) / sb, 0, 1);
    hop = 4 * ph * (1 - ph) * 0.75;
  } else hop = 0.4 + Math.sin(clock * 5) * 0.25;
  squash = Math.max(0, squash - 0.08 * dt);
  const px = cx(bz) + off, py = cy(bz) + 0.5 + hop;
  if (state !== 'lost') { playerBall.position.set(px, py, bz); playerBall.rotation.x -= 0.15 * dt * (state === 'ready' ? 0.3 : 1); }
  const contact = 1 - clamp(hop * 4, 0, 1);
  playerBall.scale.set(1 + squash * 0.25 + contact * 0.12, 1 - squash * 0.25 - contact * 0.15, 1 + squash * 0.25 + contact * 0.12);
  pGlow.position.copy(playerBall.position); pRim.position.copy(playerBall.position); pRim.scale.copy(playerBall.scale); pRim.visible = playerBall.visible; pGlow.material.opacity = 0.45 + pulse * 0.35;
  pShadow.position.set(px, cy(bz) + 0.03, bz); pShadow.scale.setScalar(1 - hop * 0.4); pShadow.visible = state !== 'lost';
  for (let i = trail.length - 1; i > 0; i--) trail[i].position.copy(trail[i - 1].position);
  trail[0].position.copy(playerBall.position);
  trail.forEach((s, i) => { s.material.opacity = state === 'play' || state === 'won' ? 0.3 * (1 - i / trail.length) : 0; s.scale.setScalar(0.9 * (1 - i / trail.length * 0.6)); });
  // targets bob to the beat; cull far objects
  for (const row of rows) {
    const near = row.z < bz + 0.8 && row.z > bz - 110;
    for (const b of row.balls) { b.m.visible = near && !b.got; b.sh.visible = b.m.visible;
      if (near) { b.m.position.y = cy(row.z) + R + pulse * 0.25; b.m.rotation.y += 0.03 * dt; } }
  }
  for (const g of gates) { g.veil.material.opacity = Math.max(0.18, g.veil.material.opacity - 0.01 * dt); g.m.scale.setScalar(1 + pulse * 0.04); }
  roadMat.uniforms.pulse.value = pulse; sky.uniforms.pulse.value = pulse * 0.6;
  for (let k = waves.length - 1; k >= 0; k--) { const w = waves[k]; w.life -= 0.045 * dt; w.s.material.opacity = w.life; w.s.scale.setScalar(1 + (1 - w.life) * 3); if (w.life <= 0) { scene.remove(w.s); w.s.material.dispose(); waves.splice(k, 1); } }
  // camera: behind, above, banking with the road
  const cz = bz + 6, shake = state === 'lost' ? Math.max(0, 0.3 - (clock - failAt)) : 0;
  camera.position.set(cx(cz) + off * 0.45 + (Math.random() - 0.5) * shake, cy(cz) + 3.1, cz);
  camera.lookAt(cx(bz - 9) + off * 0.3, cy(bz - 9) + 0.9, bz - 9);
  camera.rotateZ((cx(bz - 4) - cx(bz + 4)) * 0.03);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  planets.forEach(p => p.position.copy(camera.position).add(p.userData.off)); ring.position.copy(planets[0].position); ring.position.z += 1;
  nebula[0].position.copy(camera.position).add(new THREE.Vector3(-60, 30, -190)); nebula[1].position.copy(camera.position).add(new THREE.Vector3(70, -5, -180));
});

// ---------------------------------------------------------------- boot
buildLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // steer onto the next ball of our colour (taking colour gates into account)
    if (state !== 'play') return; const now = player.time();
    const row = rows.find(r => !r.done && r.t > now - 0.01); if (!row) return;
    const gate = gates.find(g => !g.done && g.t < row.t), col = gate ? gate.col : color;
    const good = row.balls.find(b => b.col === col); if (good) tOff = good.x + (Math.random() - 0.5) * 0.25;
  },
};

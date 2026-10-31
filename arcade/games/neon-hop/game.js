// Neon Hop — original rhythm hopper. A glowing ball bounces forward from tile to tile on every note of the song.
// Drag left/right to put it on the next tile. Centre landings score PERFECT, gems are bonus, a miss drops you into the void.
import { THREE, createStage, createUI, store, loop, input, buzz, rng, clamp, lerp, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { levelPlan, arrange, hits } from './_music/songs.js';
import { createPlayer, synth } from './_music/conductor.js';
import { glowSprite, glowTex, sparks, skyDome, starField, ease } from './_music/fx.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import { SONG } from './_music/songs.js';
import { LEVELS, remix, dailySpec } from './levels.js';
import { createDeep, dayNum } from './deep.js';
// v2 ("deep"): 36 authored levels in 3 worlds, stars, ball collection, gem chests, Daily Jam. READY stays false until v2 is checked;
// ?deep=1 forces v2 for QA only while it is false.
const READY = true;
const DEEP = (READY && ab('deep-neon-hop')) || (!READY && new URLSearchParams(location.search).get('deep') === '1');
const B = board({ game: 'neon-hop', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

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
let cur = null, D = null, perfects = 0, fever = 0, fovKick = 0, lead = 1.6;
const specOf = i => i === 'daily' ? dailySpec(dayNum(), ORDER) : LEVELS[i] || remix(i, ORDER);
function planOf(sp) {   // same bar rounding as levelPlan: whole 4-bar phrases
  const song = SONG[sp.song], barSec = song.meter * 60 / (song.bpm * sp.tempo);
  return { song, bars: Math.max(4, Math.round(sp.sec / barSec / 4) * 4), tempo: sp.tempo };
}
function buildLevel() {
  tileGroup.clear(); fx.clear();
  const sp = DEEP ? cur.spec : null;
  const plan = DEEP ? planOf(sp) : levelPlan(level, ORDER);
  track = arrange(plan.song, { bars: plan.bars, tempo: plan.tempo, ramp: DEEP ? 0.03 : 0.05, density: 1 });
  theme = THEMES[((DEEP ? (cur.index === 'daily' ? dayNum() : cur.index) : level - 1)) % THEMES.length]; makeMats(theme);
  sky.setColors(theme.top, theme.hor, theme.bot); scene.fog.color.set(theme.hor); sunMat.map = sunTex(theme.sun[0], theme.sun[1]); sunMat.needsUpdate = true; sunGlow.material.color.set(theme.hor);
  grid.material.color.set(theme.tile); decoMat.color.set(theme.acc);
  document.body.style.background = `linear-gradient(180deg,${theme.top},${theme.hor})`; document.body.style.setProperty('--ui', theme.tile);
  const fk = F.k(), minGap = DEEP ? clamp((sp.gap || 0.36) / fk, 0.2, 0.42) : clamp((0.36 - (level - 1) * 0.012) / fk, 0.22, 0.38), maxDx = DEEP ? clamp(sp.dx * fk, 0.5, 3.6) : clamp((2.2 + level * 0.15) * fk, 2, 3.6);
  const hs = hits(track, minGap), r = rng(DEEP ? (cur.index === 'daily' ? dayNum() : cur.index + 1) * 4231 + 11 : level * 4231 + 11);
  const lim = DEEP && sp.safe ? sp.safe : 2.6;
  let x = 0, side = 1;
  tiles = [{ t: -99, x: 0, z: 1.2, start: true }];
  hs.forEach((h, i) => {
    let step = (r() - 0.5) * 2 * maxDx * Math.min(1, 0.45 + h.dur);
    if (DEEP && sp.zig) { side = -side; step = side * maxDx * (0.55 + 0.45 * r()); x = clamp(step, -lim, lim); }   // zig-zag: alternate sides of the middle
    else { x = clamp(x + step, -lim, lim); if (Math.abs(step) < 0.5 && r() < 0.5) x = clamp(x + Math.sign(r() - 0.5) * 1.2, -lim, lim); }
    if (DEEP) {
      const w = sp.w || 1, forked = sp.fork && i > 1 && r() < sp.fork, moving = !forked && sp.mv && i > 2 && r() < sp.mv ? (r() < 0.5 ? -1 : 1) : 0;
      const tile = { ...h, x, w, z: -h.t * VZ, gem: i > 2 && r() < (sp.gem || 0), gemK: 0, moving, phase: r() * 6 };
      if (forked) {   // two tiles on the same beat: either is safe, the gem sits on the one farther from where you are
        const half = (TILE * w + 0.8) / 2, c = clamp(x, -(3.1 - half), 3.1 - half), a = c - half, b = c + half, prev = tiles[tiles.length - 1].x;
        tile.xs = Math.abs(a - prev) > Math.abs(b - prev) ? [a, b] : [b, a]; tile.x = c; tile.gem = tile.gem || r() < 0.5;   // xs[0] = the far tile (carries the gem)
      }
      tiles.push(tile); return;
    }
    const moving = level >= 3 && i > 6 && r() < Math.min(0.34, 0.06 * (level - 2) * fk) ? (r() < 0.5 ? -1 : 1) : 0;
    tiles.push({ ...h, x, z: -h.t * VZ, gem: i > 2 && r() < 0.22, moving, phase: r() * 6 });
  });
  for (const t of tiles) {
    const mk = (px, gemHere) => {
      const g = new THREE.Group(), body = new THREE.Mesh(tileGeo, tileMat), frame = new THREE.Mesh(frameGeo, frameMat), halo = new THREE.Mesh(haloGeo, haloMat);
      frame.position.y = 0.245; halo.position.y = -0.2; g.add(halo, body, frame); g.body = body; g.position.set(px, 0, t.z);
      if (t.start) g.scale.set(1.6, 1, 2.2); else if (t.w && t.w !== 1) g.scale.x = t.w;
      if (gemHere) { const gm = new THREE.Mesh(gemGeo, gemMat); gm.position.y = 0.95; if (t.w) gm.scale.x = 1 / t.w; g.add(gm); g.gem = gm; }
      tileGroup.add(g); return g;
    };
    if (t.xs) { t.g = mk(t.xs[0], t.gem && t.gemK === 0); t.g2 = mk(t.xs[1], false); } else t.g = mk(t.x, t.gem);
  }
  score = 0; combo = 0; gems = 0; landed = 0; bx = tx = 0; by = 0; bz = 1.2; squash = 0; fallV = 0; camX = 0; perfects = 0; fever = 0; lastBeat = -1;
  if (DEEP) { D.feverText(''); const ix = cur.index; ui.levels(typeof ix === 'number' ? ix + 1 : '♪'); ui.els.top.querySelector('[data-b]').textContent = typeof ix === 'number' ? ix + 2 : ''; applySkin();
    songLine.textContent = `♪ ${plan.song.title} · ${sp.hard ? 'HARD · ' : ''}${sp.why}`; ui.sub(typeof ix === 'number' ? `LEVEL ${ix + 1}` : 'DAILY JAM'); }
  else { ui.levels(level); ui.sub(best ? `BEST ${best}` : ''); songLine.textContent = `♪ ${plan.song.title} — ${plan.song.composer}`; }
  ui.progress(0); ui.score(0);
}
const tileXs = (t, now) => t.xs ? t.xs : [t.moving ? t.x + Math.sin(now * 2.2 + t.phase) * 0.9 * t.moving : t.x];
const tileX = (t, now) => tileXs(t, now)[0];

function begin() { state = 'play'; player.start(track, { melody: true, lead, melVol: 0.2, accVol: 1, drumVol: 1 }); }
// v2: start a level straight away (a retry or the next level is one tap, no card between)
function startLevel(i) { cur = { index: i, spec: specOf(i) }; B.start(); lead = 1.6; buildLevel(); ui.hideStart(); begin(); }
function applySkin() {
  const sk = D.skin, tr = D.trail; ball.material.color.set(sk.c); ball.material.emissive.set(sk.e); ballGlow.material.color.set(sk.e);
  trail.forEach(s => s.material.color.set(tr.c || sk.e));
}

// ---------------------------------------------------------------- input: drag steers (relative), one verb
input({ onMove: (dx) => { if (state === 'play' || state === 'ready') tx = clamp(tx + dx * (7.5 / Math.min(innerWidth, 520)), -3.4, 3.4); } });
const iceK = () => DEEP && cur && cur.spec.ice ? cur.spec.ice : 0;   // steering slides: the ball closes on the finger more slowly
ui.onTap(which => { B.start(); if (which !== 'start' && !DEEP) buildLevel(); begin(); });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the ball slides itself onto each next tile for a few beats (the game's own bot), then the steering is yours
const DM = demo(null, { ready: () => state === 'play' && (DEEP ? cur.index === 0 : level === 1), wait: 300, ms: 3500 });

function land(i, now) {
  const t = tiles[i], xs = tileXs(t, now), w = t.w || 1;
  let k = 0, dx = 1e9; xs.forEach((x, j) => { const d = Math.abs(bx - x); if (d < dx) { dx = d; k = j; } });
  if (dx > TILE * w / 2 + BALL_R * 0.55) return false;
  landed = i; squash = 1; combo++;
  const perfect = dx < 0.26 * Math.sqrt(w), mult = fever > 0 ? 2 : 1;
  if (perfect) perfects++;
  if (DEEP && !perfect && fever) { fever = 0; D.feverText(''); }
  else if (DEEP && fever > 0) { fever--; D.feverText(fever ? `FEVER ×2 · ${fever}` : ''); }
  score += (perfect ? 2 : 1) * mult; ui.score(score); ui.progress(i / (tiles.length - 1));
  const tg = k === 1 ? t.g2 : t.g, px = xs[k];
  t.hitK = k; tg.body.material = hitMat.clone(); t.hitAt = clock; tg.position.y = -0.18;
  const p = new THREE.Vector3(px, 0.2, t.z);
  const big = DEEP ? Math.min(2.2, 1 + combo * 0.08) : 1;
  fx.emit(p, ['#ffffff', theme.tile, theme.edge], Math.round((perfect ? 14 : 8) * big), { speed: 0.08 * big, up: 0.06, size: 0.5, gravity: 0.004 });
  const ring = glowSprite(theme.edge, 1, 'ring', 1); ring.position.copy(p); scene.add(ring); waves.push({ s: ring, life: 1 });
  if (DEEP && perfect) { synth.chime(72 + Math.min(combo, 14), player.at(now) + 0.01, 0.09); fovKick = Math.min(1, fovKick + 0.25); }
  if (perfect) {
    const m = DEEP ? { 5: ['GROOVE!', 34], 8: ['FEVER ×2!', 40], 12: ['ON FIRE!', 42], 16: ['UNREAL!', 46], 24: ['LEGEND!', 50] }[combo] : null;
    if (DEEP && combo === 8) { fever = 8; D.feverText('FEVER ×2 · 8'); ui.flash(0.35); fx.emit(new THREE.Vector3(px, 1, t.z), ['#ffe66d', '#ffffff', theme.acc], 30, { speed: 0.2, up: 0.1, size: 0.6 }); buzz([15, 20, 15]); }
    if (m) ui.pop(m[0], '#ffe66d', m[1], 24);
    else ui.pop(combo > 2 ? `PERFECT ×${combo}` : 'PERFECT', '#ffffff', 30, 24);
    buzz(12);
  }
  else { combo = 0; buzz(6); }
  if (t.gem && k === (t.gemK || 0) && (tg.gem)) { gems++; score += 3 * mult; ui.score(score); tg.gem.visible = false; synth.chime(96, player.at(now) + 0.01, 0.12); fx.emit(p.clone().setY(1), [theme.acc, '#ffffff'], 14, { speed: 0.1, up: 0.08, size: 0.45 }); ui.pop('+3 💎', theme.acc, 26, 31); }
  return true;
}
const waves = [];
function fail() {
  state = 'lost'; F.level(false, landed / (tiles.length - 1)); failT = clock; fallV = 0.02; player.stop(0.3); synth.fail(); buzz([40, 30, 60]);
  if (!DEEP) { best = Math.max(best, score); S.set('best', best); }
  if (DEEP) { D.feverText(''); const n = tiles.length - 1, left = n - landed, pct = Math.round(landed / n * 100), ix = cur.index;
    const line = left <= 6 ? `${left} tile${left > 1 ? 's' : ''} from the end!` : `${pct}% of the song`;
    setTimeout(() => D.result({ win: false, title: pct >= 85 ? 'SO CLOSE!' : pct >= 50 ? 'ALMOST!' : 'OOPS!', line, pct, index: ix, again: () => startLevel(ix), retry: () => startLevel(ix) }), 450); return; }
  ui.lose('OOPS!', `${Math.round(landed / (tiles.length - 1) * 100)}% · ${score} pts`);
}
function win() {
  if (state === 'play') B.submit(1); state = 'won'; F.level(true); if (!DEEP) { best = Math.max(best, score); S.set('best', best); }
  for (let k = 0; k < 5; k++) fx.emit(new THREE.Vector3(bx + (k - 2) * 0.8, 1.2, bz - 2), ['#ffffff', theme.tile, theme.acc, '#ffe66d'], 18, { speed: 0.16, up: 0.12, size: 0.6 });
  ui.flash(0.5); buzz([20, 40, 30]);
  if (DEEP) {
    D.feverText(''); const n = tiles.length - 1, pr = perfects / n, sp = cur.spec, ix = cur.index, daily = ix === 'daily';
    const stars = sp.gift ? 3 : pr >= 0.75 ? 3 : pr >= 0.45 ? 2 : 1, out = D.finish(ix, stars, gems, daily);
    best = Math.max(best, score); S.set('best', best);
    const next = daily ? D.top : ix + 1, again = () => startLevel(next);
    for (let k = 0; k < 5; k++) setTimeout(() => fx.emit(new THREE.Vector3(bx + (k - 2) * 0.8, 1.2, bz - 2), ['#ffffff', theme.tile, theme.acc, '#ffe66d'], 18, { speed: 0.16, up: 0.12, size: 0.6 }), k * 150);
    setTimeout(() => D.result({ win: true, stars: daily ? 0 : stars, title: daily ? 'JAM DONE!' : stars === 3 ? (pr >= 0.9 ? 'PERFECT RUN!' : 'THREE STARS!') : stars === 2 ? 'NICE!' : sp.hard ? 'HARD CLEARED!' : 'CLEARED!', line: daily ? 'Daily Jam' : `Level ${ix + 1} · ${SONG[sp.song].title}`, score, perfect: Math.round(pr * 100), gems, out, index: ix, again, retry: () => startLevel(ix) }), 1100);
    return;
  }
  ui.win(level, `${score} pts · ${gems} 💎`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- frame
loop((dt) => {
  if (DM.on) window.__game.bot();
  clock += dt / 60; fx.update(dt);
  const now = state === 'ready' ? -1.6 : player.time();
  bx = lerp(bx, tx, 1 - Math.pow(iceK() ? 0.6 + 0.33 * iceK() : 0.6, dt));
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
    if (!t.g) continue; const near = t.z < bz + 10 && t.z > bz - 95; t.g.visible = near; if (t.g2) t.g2.visible = near; if (!near) continue;
    const xs = tileXs(t, Math.max(now, 0)), gs = t.g2 ? [t.g, t.g2] : [t.g];
    gs.forEach((g, j) => { g.position.x = xs[j]; });
    if (t.hitAt !== undefined) {   // flash white, spring back, then sink away into the void once the ball has left
      const k = clamp((clock - t.hitAt) * 4, 0, 1), age = clock - t.hitAt;
      const sink = landed > tiles.indexOf(t) || state === 'won' ? clamp(age - 0.35, 0, 2) : 0;
      gs.forEach((g, j) => {
        if (j === (t.hitK || 0)) { const m = g.body.material; m.color.set('#ffffff').lerp(tileMat.color, clamp(age * 3, 0, 1)); m.emissive.set(theme.edge).lerp(tileMat.emissive, clamp(age * 3, 0, 1));
          g.position.y = -0.18 * (1 - ease.out(k)) - sink * sink * 6; m.opacity = 0.95 * (1 - clamp(sink * 1.6, 0, 1)); }
        else g.position.y = -sink * sink * 6;
      });
    }
    gs.forEach(g => { if (g.gem) { g.gem.rotation.y += 0.04 * dt; g.gem.position.y = 0.95 + Math.sin(clock * 3 + t.phase) * 0.12; } });
  }
  for (let k = waves.length - 1; k >= 0; k--) { const w = waves[k]; w.life -= 0.04 * dt; w.s.material.opacity = Math.max(0, w.life); w.s.scale.setScalar(1 + (1 - w.life) * 2.2); if (w.life <= 0) { scene.remove(w.s); w.s.material.dispose(); waves.splice(k, 1); } }
  // camera: behind and above, easing sideways with the ball
  camX = lerp(camX, bx * 0.55, 1 - Math.pow(0.9, dt));
  const camY = state === 'lost' ? 3.6 : 3.6 + by * 0.12;
  if (DEEP) {
    fovKick *= Math.pow(0.92, dt); const f = 58 + fovKick * 3 + (fever > 0 ? 4 : 0); if (Math.abs(camera.fov - f) > 0.05) { camera.fov = lerp(camera.fov, f, 1 - Math.pow(0.8, dt)); camera.updateProjectionMatrix(); }
    if (D.skin.prism || D.trail.prism) { const c = new THREE.Color().setHSL((clock * 0.5) % 1, 0.9, 0.62); if (D.skin.prism) { ball.material.color.copy(c); ball.material.emissive.copy(c); ballGlow.material.color.copy(c); } if (D.trail.prism) trail.forEach((s, i) => s.material.color.setHSL(((clock * 0.5) + i * 0.04) % 1, 0.9, 0.6)); }
    if (fever > 0) pulse = Math.max(pulse, 0.5);
  }
  camera.position.set(camX, camY, bz + 5.6); camera.lookAt(camX * 0.6 + bx * 0.2, 0.2, bz - 6.5);
  sky.position.set(camera.position.x, 0, camera.position.z); stars.position.copy(sky.position);
  sunS.position.set(camX * 0.4, 9 + pulse * 0.5, bz - 170); sunGlow.position.set(sunS.position.x, 4, bz - 175);
  grid.position.z = bz - (bz % 5);
  decos.forEach((m, i) => { const z = bz + 10 - (150 - ((-bz + m.userData.off) % 150)); m.position.set(m.userData.side * (9 + (i % 3) * 3), m.userData.h + Math.sin(clock + i) * 0.8, z); m.rotation.y += 0.01 * dt; m.rotation.x += 0.006 * dt; m.scale.setScalar(1 + pulse * 0.25); });
});

// ---------------------------------------------------------------- boot
if (DEEP) {
  D = createDeep(S, ORDER, SONG, i => i === 'daily' ? startLevel('daily') : startLevel(i));
  cur = { index: D.top, spec: specOf(D.top) };
}
buildLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return DEEP ? cur.index + 1 : level; }, get score() { return score; }, get deep() { return DEEP; }, get tiles() { return tiles; }, get landed() { return landed; }, get perfects() { return perfects; }, start(i) { startLevel(i); }, setX(x) { tx = x; },
  bot() {   // steer toward the centre of the next tile (where it will be when we land)
    if (state !== 'play') return;
    const n = tiles[landed + 1]; if (!n) return;
    tx = tileX(n, n.t) + (Math.random() - 0.5) * 0.3 + (window.__sloppy || 0) * (Math.random() - 0.5);
  },
};

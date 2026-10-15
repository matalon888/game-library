// Halo Burst — a ball bounces inside nested spinning rings, each with one gap. Slip through a gap and that ring shatters
// with a rising note. Tap to flip the spin of every ring (and give the ball a little kick) to steer the gaps toward it.
// Clear every ring before the timer runs out; later levels add rings, speed, tighter gaps and red spike arcs that pop the ball.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Halo Burst: Bouncing Ball Rings';
const S = store('haloburst');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('haloburst');

const stage = createStage({ fov: 40, shadowSize: 10 });
const { scene, camera, sun } = stage;
sun.position.set(3, 6, 14); sun.intensity = 1.5;
const ui = createUI({ title: 'HALO<br>BURST', hint: 'Tap to flip the spin', hand: '👆' });
const D = daily('haloburst', ui, { name: NAME });

const SKIES = [['#d9c8ff', '#ffe3f1'], ['#a9e4ff', '#f0e6ff'], ['#ffc9d9', '#fff0cf'], ['#b6f0dc', '#e9f0ff'], ['#ffd6a8', '#ffe6f2'], ['#c4d4ff', '#fde2ff']];
const RAINBOW = ['#ff4d6d', '#ff8c42', '#ffd23f', '#3ad29f', '#2bb3ff', '#5b6cff', '#a05bff', '#ff5dc8', '#ff6b6b', '#1fd1c1'];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const GRAV = 14, BR = 0.3, TH = 0.14;

// backdrop plate + glow
const plate = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false }));
plate.position.z = -0.6; scene.add(plate);
const plateRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
plateRing.position.z = -0.59; scene.add(plateRing);

const ballMat = glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.45 });
const ballM = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 20), ballMat); ballM.castShadow = true; scene.add(ballM);
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.8 })); ballGlow.scale.setScalar(1.6); scene.add(ballGlow);

// trail
const TN = 14, trailPts = [];
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TN * 2 * 4), 4));
{ const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false; scene.add(trail);
const trailCol = new THREE.Color('#ffffff');

const ringsG = new THREE.Group(); scene.add(ringsG);
const SPIKE = new THREE.ConeGeometry(0.09, 0.26, 6);

// ---------------------------------------------------------------- state
let state = 'ready', rings = [], cur = 0, p = new THREE.Vector2(), v = new THREE.Vector2(), timeLeft = 30, timeMax = 30, score = 0, recorded = false, beatenShown = false;
let lastTl = -1, dir = 1, flipFlash = 0, squash = 0, outerR = 4, camD = 22, botCd = 0, clock = 0, shake = 0;

function build() {
  const seed = D.seed || level * 7919 + 101, r = rng(seed), fk = F.k();
  const sky = SKIES[(level - 1) % SKIES.length], bs = document.body.style;
  bs.setProperty('--bg1', sky[0]); bs.setProperty('--bg2', sky[1]); bs.setProperty('--ui', RAINBOW[(level * 3) % RAINBOW.length]);
  for (const rg of rings) ringsG.remove(rg.g); rings = [];
  const n = clamp(3 + Math.floor((level - 1) * 0.6), 3, 8);
  const r0 = 1.35, step = n > 5 ? 0.68 : 0.8;   // > BR + TH so the next ring's wall is never already behind the ball
  const off = Math.floor(r() * RAINBOW.length);
  for (let i = 0; i < n; i++) {
    const R = r0 + i * step;
    const gapLen = clamp(((1.15 - Math.min(level, 20) * 0.025) * 1.35 / R + 0.28 + (level <= 2 ? 0.35 : 0) - Math.min(level, 20) * 0.006) / Math.sqrt(fk), 0.42, 1.7);   // radians; bigger rings need less angle
    const spd = clamp((1.1 + level * 0.07 + r() * 0.5) * fk, 0.9, 3.4) * (r() < 0.5 ? 1 : -1) * (1 - i * 0.04);
    const col = RAINBOW[(off + i) % RAINBOW.length];
    const g = new THREE.Group(); ringsG.add(g);
    const m = new THREE.Mesh(new THREE.TorusGeometry(R, TH, 10, Math.max(40, Math.round(R * 34)), Math.PI * 2 - gapLen), glossy(col, { emissive: col, emissiveIntensity: 0.22 }));
    m.castShadow = true; g.add(m);
    // gap end caps (little bright beads so the gap reads clearly)
    for (const a of [0, Math.PI * 2 - gapLen]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(TH * 1.35, 12, 10), glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 })); cap.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); g.add(cap); }
    // hazard arc: red spiky segment on later levels
    let haz = null;
    if (level >= 3 && i >= 1 && i % 2 === (level % 2) && r() < clamp(0.35 + level * 0.05, 0, 0.8) * fk) {
      const hl = clamp(0.5 + r() * 0.5, 0.4, 1.1), a0 = 0.35 + r() * (Math.PI * 2 - gapLen - hl - 0.7);   // inside the solid arc
      const hm = new THREE.Mesh(new THREE.TorusGeometry(R, TH * 1.25, 10, 30, hl), glossy('#2b2d42', { emissive: '#ff1f4b', emissiveIntensity: 0.08 }));
      hm.rotation.z = a0;
      g.add(hm);
      for (let k = 0; k <= 4; k++) { const a = hm.rotation.z + hl * k / 4; const sp = new THREE.Mesh(SPIKE, glossy('#ff1f4b')); sp.position.set(Math.cos(a) * (R - TH - 0.08), Math.sin(a) * (R - TH - 0.08), 0); sp.rotation.z = a + Math.PI / 2; g.add(sp); }
      haz = { a0: hm.rotation.z, len: hl };
    }
    const rot = r() * Math.PI * 2; g.rotation.z = rot;
    rings.push({ R, gap: gapLen, spd, rot, g, m, col, haz, alive: true, pulse: 0 });
  }
  outerR = rings[n - 1].R + 0.6;
  plate.scale.setScalar(outerR + 0.3); plateRing.scale.setScalar(outerR + 0.3);
  timeMax = timeLeft = Math.round(clamp((10 + n * 6) / Math.sqrt(fk), 18, 80));
  lastTl = -1; cur = 0; dir = 1; p.set(0, 0); v.set(2.5 * (r() - 0.5), 4); score = 0; recorded = false; beatenShown = false; trailPts.length = 0;
  ballM.visible = true; ballGlow.visible = true; ballM.scale.setScalar(1);
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : ''); ui.pill('');
}

const wrap = (a) => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
// angle (relative to ring's own frame) of the ball
function inGap(rg, ang, rad) {
  const a = wrap(ang - rg.rot);                        // torus arc covers [0, 2π - gap]; the gap is [2π - gap, 2π]
  const pad = Math.asin(clamp((BR * 0.92) / rad, 0, 1));    // the ball must fit, not just its centre
  return a > Math.PI * 2 - rg.gap + pad && a < Math.PI * 2 - pad;
}
function onHazard(rg, ang) {
  if (!rg.haz) return false;
  const a = wrap(ang - rg.rot - rg.haz.a0);
  return a < rg.haz.len;
}

function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 2, 1), 50); }
}

function shatter(rg, idx) {
  rg.alive = false; rg.g.visible = false;
  // shards fly out along the ring
  for (let k = 0; k < 18; k++) {
    const a = rg.rot + (k / 18) * (Math.PI * 2 - rg.gap);
    burst(scene, new THREE.Vector3(Math.cos(a) * rg.R, Math.sin(a) * rg.R, 0), [rg.col, '#ffffff'], 2, { speed: 0.09, up: 0.02, size: 0.75, gravity: 0.004 });
  }
  const pts = 10 + idx * 5; addScore(pts);
  const base = 60 + (level % 3) * 2;
  note(base + PENTA[Math.min(idx, PENTA.length - 1)] + 12, 0.5, 0.18); setTimeout(() => note(base + PENTA[Math.min(idx + 2, PENTA.length - 1)] + 12, 0.45, 0.12), 70);
  buzz([12, 20, 12]); ui.flash(0.18); shake = 0.25;
  ui.pop(idx === rings.length - 1 ? 'FREE!' : `+${pts}`, rg.col, 34 + idx * 2, 30);
  ui.progress((idx + 1) / rings.length);
}

function flip() {
  if (state !== 'play') return;
  dir = -dir; flipFlash = 1;
  const sp = v.length(); if (sp < 10) v.multiplyScalar(Math.min(1.25, 10 / Math.max(sp, 0.1)));
  tone(dir > 0 ? 620 : 480, 0.08, 'triangle', 0.1, dir > 0 ? 1.4 : 0.7); buzz(8);
}

function lose(why) {
  if (state !== 'play') return;
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, cur / rings.length); }
  best = Math.max(best, score); S.set('best', best);
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.4); shake = 0.4;
  burst(scene, new THREE.Vector3(p.x, p.y, 0.3), ['#ffffff', '#ff1f4b', '#2b2d42'], 22, { speed: 0.14, up: 0.06, size: 0.6, gravity: 0.003 });
  ballM.visible = false; ballGlow.visible = false; ui.pill('');
  ui.lose(why, `${cur} of ${rings.length} rings`);
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); }
  addScore(Math.ceil(timeLeft) * 2 + level * 5);
  best = Math.max(best, score); S.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.4); ui.pill('');
  confetti(scene, new THREE.Vector3(p.x, p.y, 0.5), 80);
  [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(72 + s, 0.6, 0.12), 300 + i * 90));
  D.won(score); ui.win(level, `${score} points · ${Math.ceil(timeLeft)}s to spare`);
}

input({ onDown: () => flip() });
ui.onTap(w => {
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; ui.els.sc.classList.remove('hc-hidden');
});

// ---------------------------------------------------------------- physics
function physics(h) {
  for (const rg of rings) if (rg.alive) rg.rot += rg.spd * dir * h;
  v.y -= GRAV * h;
  p.x += v.x * h; p.y += v.y * h;
  const rg = rings[cur]; if (!rg) return;
  const d = p.length(), ang = Math.atan2(p.y, p.x);
  if (d + BR > rg.R - TH && d < rg.R + TH) {
    if (inGap(rg, ang, d)) { /* slipping through */ }
    else if (onHazard(rg, ang)) { lose('POP!'); return; }
    else if (d < rg.R) {
      // bounce off the inside wall; pick up a little of the ring's spin
      const nx = -p.x / d, ny = -p.y / d, vn = v.x * nx + v.y * ny;
      p.set(-nx * (rg.R - TH - BR), -ny * (rg.R - TH - BR));
      if (vn < 0) { v.x -= 2 * vn * nx; v.y -= 2 * vn * ny; }
      const tx = -ny, ty = nx, wall = rg.spd * dir * rg.R; v.x += tx * wall * 0.08; v.y += ty * wall * 0.08;
      const sp = v.length(), want = clamp(sp, 7.5, 12.5); v.multiplyScalar(want / sp);
      squash = 1; rg.pulse = 1;
      tone(300 + cur * 40 + Math.random() * 30, 0.05, 'sine', 0.08, 0.8);
    }
  }
  if (d > rg.R) { shatter(rg, cur); cur++; if (cur >= rings.length) win(); }   // centre slipped past the wall: that ring is done
}

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  clock = t; const step = dt / 60;
  if (state === 'play') {
    for (let i = 0; i < 6 && state === 'play'; i++) physics(step / 6);
    if (state === 'play') {
      timeLeft -= step; const tl = Math.ceil(timeLeft); if (tl !== lastTl) { lastTl = tl; ui.sub(`⏱ ${tl}s` + (tl <= 5 ? ' — hurry!' : '')); if (tl <= 5 && tl > 0) tone(880, 0.05, 'square', 0.05, 1); }
      if (timeLeft <= 0) lose('TIME!');
    }
  } else if (state === 'won') {
    // the free ball floats up and away
    v.y += 4 * step; p.x += v.x * step * 0.3; p.y += v.y * step;
  } else if (state === 'ready') { for (const rg of rings) rg.rot += rg.spd * step * 0.5; p.set(0, Math.sin(t * 3) * 0.4); }
  for (const rg of rings) {
    rg.g.rotation.z = rg.rot; rg.pulse = Math.max(0, rg.pulse - step * 5);
    rg.g.scale.setScalar(1 + rg.pulse * 0.025 + flipFlash * 0.03);
    rg.m.material.emissiveIntensity = 0.22 + rg.pulse * 0.4 + flipFlash * 0.3;
  }
  flipFlash = Math.max(0, flipFlash - step * 4);
  squash = Math.max(0, squash - step * 6);
  ballM.position.set(p.x, p.y, 0); ballGlow.position.set(p.x, p.y, -0.1);
  const vl = v.length() || 1; ballM.scale.set(1 + squash * 0.25, 1 - squash * 0.25, 1); ballM.rotation.z = Math.atan2(v.y, v.x);
  const col = rings[cur] ? rings[cur].col : '#ffffff'; trailCol.lerp(new THREE.Color(col), 0.1); ballGlow.material.color.copy(trailCol);
  // trail
  if (state === 'play') trailPts.unshift(p.x, p.y); else if (trailPts.length) trailPts.splice(-2, 2);
  if (trailPts.length > TN * 2) trailPts.length = TN * 2;
  {
    const pos = trailGeo.attributes.position.array, c = trailGeo.attributes.color.array, n = trailPts.length / 2;
    for (let i = 0; i < TN; i++) {
      const j = Math.min(i, Math.max(0, n - 1)); const x = n ? trailPts[j * 2] : p.x, y = n ? trailPts[j * 2 + 1] : p.y;
      const j2 = Math.min(j + 1, Math.max(0, n - 1)), nx = n > 1 ? trailPts[j2 * 2] - x : 1, ny = n > 1 ? trailPts[j2 * 2 + 1] - y : 0, l = Math.hypot(nx, ny) || 1;
      const w = BR * 0.9 * (1 - i / TN);
      pos.set([x - ny / l * w, y + nx / l * w, -0.05, x + ny / l * w, y - nx / l * w, -0.05], i * 6);
      const al = i < n ? 0.5 * (1 - i / TN) : 0;
      c.set([trailCol.r, trailCol.g, trailCol.b, al, trailCol.r, trailCol.g, trailCol.b, al], i * 8);
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  // camera fits the outermost ring to the screen width
  const vf = camera.fov * Math.PI / 180, need = Math.max((outerR + 0.5) / (Math.tan(vf / 2) * camera.aspect), (outerR + 0.5) / Math.tan(vf / 2));
  camD = lerp(camD, need, 0.08);
  shake = Math.max(0, shake - step);
  const sx = (Math.random() - 0.5) * shake * 0.5, sy = (Math.random() - 0.5) * shake * 0.5;
  camera.position.set(sx, -0.4 + sy, camD); camera.lookAt(sx * 0.5, -0.4 + sy * 0.5, 0);
  stage.followLight(new THREE.Vector3(0, 0, 0));
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get dbg() { return `L${level} ring ${cur}/${rings.length} t ${Math.ceil(timeLeft)}`; },
  bot() {
    if (state !== 'play') return;
    botCd -= 0.12; if (botCd > 0) return;
    const rg = rings[cur]; if (!rg) return;
    // which way is the gap moving relative to where the ball is? flip if it's running away the long way round
    const ang = Math.atan2(p.y, p.x), gapC = rg.rot + Math.PI * 2 - rg.gap / 2;
    let diff = Math.atan2(Math.sin(ang - gapC), Math.cos(ang - gapC));     // + means ball is ahead (CCW) of the gap
    const moving = rg.spd * dir;                                           // + means gap moves CCW
    const hazNear = rg.haz && (() => { const a = wrap(ang - rg.rot - rg.haz.a0); return a < rg.haz.len + 0.5 || a > Math.PI * 2 - 0.5; })();
    if (Math.sign(diff) !== Math.sign(moving) && Math.abs(diff) > 0.9) { flip(); botCd = 0.5; }
    else if (hazNear && Math.random() < 0.5) { flip(); botCd = 0.4; }
  },
};

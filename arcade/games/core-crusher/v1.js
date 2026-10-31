// Core Crusher — original tower smasher. The ring tower spins on its own; press and hold to drive the ball down,
// crushing coloured rings one by one. Black slices shatter the ball — unless you have held long enough to catch fire.
import { THREE, createStage, createUI, store, loop, input, buzz, tone, note, burst, confetti, rng, lerp, clamp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';

const SEG = 12, SEGA = Math.PI * 2 / SEG, GAP = 0.3, THICK = 0.25, R_OUT = 2.0, R_IN = 0.42, BALL_R = 0.3, BALL_D = 1.3;
const GRAV = 0.0125, BOUNCE = 0.165, SMASH = 0.11;
const THEMES = [
  { bg: ['#1fc7b6', '#c9fff1'], ring: '#2f6bff', ball: '#ff3048', ui: '#e8203a' },
  { bg: ['#ff6b3d', '#ffd36e'], ring: '#ffd21a', ball: '#1e8bff', ui: '#1e7bff' },
  { bg: ['#7a4cf0', '#f1b6ff'], ring: '#5fe62a', ball: '#1f8fff', ui: '#1f8fff' },
  { bg: ['#ff5c9a', '#ffd5e5'], ring: '#ff5a1f', ball: '#16c2ff', ui: '#ff5a1f' },
  { bg: ['#36a8ff', '#dff4ff'], ring: '#ff2d8f', ball: '#ffd21a', ui: '#ff2d8f' },
  { bg: ['#ffb02e', '#fff1b8'], ring: '#8a2be2', ball: '#ff3048', ui: '#8a2be2' },
];

const S = store('corecrusher');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('corecrusher');
const WB = worldBoard({ game: 'core-crusher', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });
const stage = createStage({ fov: 46, shadowSize: 4 });
const { scene, camera, sun } = stage;
stage.hemi.intensity = 1.05; sun.intensity = 1.55;
const ui = createUI({ title: 'CORE<br>CRUSHER', hint: 'Hold to smash', hand: '👇' });
// fire meter (vertical pill on the right)
const meter = document.createElement('div');
meter.innerHTML = '<i></i><b>🔥</b>'; meter.className = 'cc-meter'; document.body.appendChild(meter);
const meterFill = meter.querySelector('i');

// ---------------------------------------------------------------- geometry: one slice of a ring (shape varies per level)
function sliceGeo(style) {
  const s = new THREE.Shape(), n = 14, pad = 0.006;
  const rOut = (a) => {                                      // a in [0, SEGA]
    const u = a / SEGA;
    if (style === 1) return R_OUT * (0.9 + 0.13 * Math.sin(u * Math.PI));       // petals
    if (style === 2) return R_OUT * (u < 0.5 ? 0.92 + u * 0.24 : 1.16 - (u - 0.5) * 0.48) ; // saw / gear teeth
    return R_OUT;
  };
  for (let k = 0; k <= n; k++) { const a = pad + (SEGA - 2 * pad) * k / n, r = rOut(a); k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  for (let k = n; k >= 0; k--) { const a = pad + (SEGA - 2 * pad) * k / n; s.lineTo(Math.cos(a) * R_IN, Math.sin(a) * R_IN); }
  const g = new THREE.ExtrudeGeometry(s, { depth: THICK - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, -THICK + 0.03, 0);   // top face at y≈0
  return g;
}
const SLICES = [sliceGeo(0), sliceGeo(1), sliceGeo(2)];
const tower = new THREE.Group(); scene.add(tower);
const safeMat = new THREE.MeshStandardMaterial({ color: '#2f6bff', roughness: 0.42, metalness: 0.05 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#1b1b24', roughness: 0.3, metalness: 0.25 });
const poleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.12 });
const pole = new THREE.Mesh(new THREE.CylinderGeometry(R_IN, R_IN, 1, 32), poleMat); tower.add(pole);
let safeI, darkI;
// finish platform: checkered disc
const checkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1d1d24' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const finish = new THREE.Group();
const finTop = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT + 0.25, R_OUT + 0.25, 0.3, 48), [new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: '#ffffff' })]);
finTop.position.y = -0.15; finTop.receiveShadow = true; finish.add(finTop); tower.add(finish);
// ball + trail
const ballMat = new THREE.MeshStandardMaterial({ color: '#ff3048', roughness: 0.2, metalness: 0.1, emissive: '#000000' });
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), ballMat); ball.castShadow = true; scene.add(ball);
const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
const trail = new THREE.Mesh(new THREE.CylinderGeometry(BALL_R * 0.95, BALL_R * 0.25, 1, 20, 1, true).translate(0, 0.5, 0), trailMat); scene.add(trail);
// splats
const splatGeo = new THREE.CircleGeometry(0.3, 16).rotateX(-Math.PI / 2);
const splats = [];
// debris pool (flying slice chunks)
const debris = [];
for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(SLICES[0], new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.45 })); m.visible = false; scene.add(m); debris.push({ m, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() }); }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), Y = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- level
let state = 'ready', theme, rings = [], top = 0, total = 0, score = 0, hold = false, by = 1, vy = 0, omega = 1, heat = 0, fire = false, fireT = 0;
let camY = 0, style = 0, squash = 0, smashRun = 0, botTarget = -1, clock = 0, deadT = 0, finishY = 0, dir = 1, flipT = 0;

function buildLevel() {
  theme = THEMES[(level - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', theme.bg[0]); bs.setProperty('--bg2', theme.bg[1]); bs.setProperty('--ui', theme.ui);
  safeMat.color.set(theme.ring); ballMat.color.set(theme.ball); trailMat.color.set('#ffffff');
  const r = rng(level * 7717 + 3), fk = F.k();
  style = (level - 1) % 3;
  total = Math.min(26 + level * 6, 110);
  omega = (1.0 + Math.min(level, 10) * 0.07) * fk * (r() < 0.5 ? 1 : -1);
  if (safeI) { tower.remove(safeI, darkI); safeI.dispose(); darkI.dispose(); }
  safeI = new THREE.InstancedMesh(SLICES[style], safeMat, total * SEG); darkI = new THREE.InstancedMesh(SLICES[style], darkMat, total * SEG);
  for (const m of [safeI, darkI]) { m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; tower.add(m); }
  rings = [];
  let twist = 0, twistStep = 0.12, nd = 0, sectionLeft = 0;
  for (let i = 0; i < total; i++) {
    if (sectionLeft <= 0) {               // the tower is built from sections with their own spiral + danger amount
      sectionLeft = 5 + Math.floor(r() * 8);
      const hard = Math.min(0.92, (0.25 + level * 0.07) * fk);
      nd = i < 4 ? 0 : r() < hard ? 1 + Math.floor(r() * Math.min(5, 2 + level * 0.5)) : (r() < 0.5 ? 0 : 1);
      twistStep = (r() < 0.5 ? 1 : -1) * (0.06 + r() * 0.16);
      twist += r() * Math.PI * 2;
    }
    sectionLeft--; twist += twistStep;
    const kinds = new Array(SEG).fill(0);
    for (let k = 0; k < nd; k++) kinds[k] = 1;
    if (nd && level > 3 && r() < 0.25) { const o = Math.floor(SEG / 2); kinds[o] = 1; kinds[(o + 1) % SEG] = 1; }   // second black block
    const y = -i * GAP;
    rings.push({ y, rot: twist, kinds, alive: true });
    for (let s = 0; s < SEG; s++) {
      _m.compose(_p.set(0, y, 0), _q.setFromAxisAngle(Y, twist + s * SEGA), _s.set(1, 1, 1));
      const z = new THREE.Matrix4().makeScale(0, 0, 0);
      (kinds[s] ? darkI : safeI).setMatrixAt(i * SEG + s, _m); (kinds[s] ? safeI : darkI).setMatrixAt(i * SEG + s, z);
    }
  }
  safeI.instanceMatrix.needsUpdate = true; darkI.instanceMatrix.needsUpdate = true;
  finishY = -total * GAP - 0.25; finish.position.y = finishY;
  pole.scale.y = total * GAP + 8; pole.position.y = -total * GAP / 2 + 3.5;
  splats.forEach(s => s.parent && s.parent.remove(s)); splats.length = 0;
  debris.forEach(d => { d.m.visible = false; d.life = 0; });
  top = 0; score = 0; hold = false; by = 1.2; vy = 0; heat = 0; fire = false; smashRun = 0; botTarget = -1; dir = 1; flipT = 0;
  tower.rotation.y = 0; camY = 0; ball.visible = true; ball.scale.setScalar(1);
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : '');
  setFire(false);
}
const topY = () => top < total ? rings[top].y : finishY;
function sliceAt(i, rot) {                    // which slice of ring i is under the ball (ball sits on +Z)
  let a = (Math.PI * 1.5 - rot - rings[i].rot) % (Math.PI * 2); if (a < 0) a += Math.PI * 2;
  return Math.floor(a / SEGA) % SEG;
}
function setFire(on) {
  fire = on; meter.classList.toggle('fire', on);
  ballMat.emissive.set(on ? '#ff5a00' : '#000000'); ballMat.emissiveIntensity = on ? 0.9 : 0;
  trailMat.color.set(on ? '#ffb347' : '#ffffff');
}

function smashRing(i) {
  const rg = rings[i]; rg.alive = false;
  const z = _m.makeScale(0, 0, 0);
  for (let s = 0; s < SEG; s++) { safeI.setMatrixAt(i * SEG + s, z); darkI.setMatrixAt(i * SEG + s, z); }
  safeI.instanceMatrix.needsUpdate = true; darkI.instanceMatrix.needsUpdate = true;
  // fling the slices outward
  let used = 0;
  for (let s = 0; s < SEG; s += 2) {
    const d = debris.find(d => d.life <= 0); if (!d) break; used++;
    d.m.geometry = SLICES[style]; d.m.material.color.set(rg.kinds[s] ? '#1b1b24' : theme.ring);
    const ang = tower.rotation.y + rg.rot + s * SEGA;
    d.m.position.set(0, rg.y, 0); d.m.rotation.set(0, ang, 0); d.m.scale.setScalar(0.85); d.m.visible = true; d.life = 1;
    const out = new THREE.Vector3(Math.cos(ang + SEGA), 0, -Math.sin(ang + SEGA));
    d.v.copy(out).multiplyScalar(0.06 + Math.random() * 0.04); if (d.v.z > 0) d.v.z *= 0.35; d.v.y = 0.06 + Math.random() * 0.06;
    d.spin.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25);
  }
  burst(scene, new THREE.Vector3(0, rg.y + 0.1, BALL_D * 0.8), [theme.ring, theme.ring, '#1b1b24'], 5, { speed: 0.12, up: 0.08, size: 0.9, gravity: 0.008, life: 0.8 });
  splats.filter(s => s.userData.ring === i).forEach(s => tower.remove(s));
  top = i + 1; smashRun++;
  score += fire ? 2 : 1; ui.score(score); ui.progress(top / total);
  tone(160 + Math.min(smashRun, 30) * 9, 0.07, 'square', 0.07, 0.6); tone(90, 0.06, 'sine', 0.12, 0.5);
  buzz(6);
  if (!fire) { heat = Math.min(1, heat + 0.034); if (heat >= 1) { setFire(true); ui.pop('ON FIRE!', '#ffde59', 40, 30); tone(300, 0.3, 'sawtooth', 0.08, 2); buzz([20, 20, 20]); } }
  if (smashRun === 10 || smashRun === 20) ui.pop(smashRun === 10 ? 'GREAT!' : 'UNSTOPPABLE!', '#fff', 34, 24);
}
function bounceOn(y) {
  by = y + BALL_R; vy = BOUNCE; squash = 1; smashRun = 0;
  tone(330, 0.06, 'sine', 0.1, 0.7);
  // paint splat on the ring we bounced on
  if (top < total) {
    const m = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ color: theme.ball, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const local = new THREE.Vector3(0, 0, BALL_D).applyAxisAngle(Y, -tower.rotation.y);
    m.position.set(local.x, rings[top].y + 0.012, local.z); m.rotation.y = Math.random() * 6; m.scale.setScalar(0.8 + Math.random() * 0.5);
    m.userData.ring = top; tower.add(m); splats.push(m); if (splats.length > 14) tower.remove(splats.shift());
  }
}
function die() {
  state = 'lost'; F.level(false, top / total); deadT = 0; hold = false; ball.visible = false; best = Math.max(best, score); S.set('best', best);
  burst(scene, ball.position.clone(), [theme.ball, '#ffffff', '#1b1b24'], 26, { speed: 0.12, up: 0.1, size: 0.9, shape: 'sphere', gravity: 0.006 });
  tone(140, 0.4, 'sawtooth', 0.12, 0.4); buzz([40, 30, 80]); ui.flash(0.5);
  ui.lose('CRASHED!', `${Math.round(top / total * 100)}% crushed`);
}
function win() {
  state = 'won'; F.level(true); WB.submit(1); hold = false; best = Math.max(best, score); S.set('best', best);
  level++; S.set('level', level);
  confetti(scene, new THREE.Vector3(0, finishY + 1, BALL_D), 90); ui.flash(0.4); buzz([20, 40, 30]);
  [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(67 + s, 0.4, 0.16), i * 90));
  ui.win(level - 1, `${score} pts`);
}

input({ onDown: () => { if (state === 'play') hold = true; }, onUp: () => { hold = false; } });
addEventListener('keydown', e => { if (e.code === 'Space' && state === 'play') hold = true; });
addEventListener('keyup', e => { if (e.code === 'Space') hold = false; });
ui.onTap(which => { WB.start(); if (which !== 'start') buildLevel(); state = 'play'; });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// the ball presses down through the next safe ring or two three times (the bot's own timing, never onto a black slice)
demo(() => { if (top + 8 >= total) return false; window.__game.bot(); if (hold && (botTarget < 0 || botTarget > top + 2)) botTarget = top + 2; },
  { ready: () => state === 'play' && level === 1 && !hold && !fire, wait: 1500, every: 1300, max: 3 });

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  clock += dt / 60;
  if (state !== 'lost') {
    // tower spins on its own; later levels reverse direction now and then
    if (level >= 4) { flipT += dt / 60; if (flipT > 3.2 + (level % 3)) { flipT = 0; dir = -dir; } }
    tower.rotation.y += omega * dir * dt / 60;
  }
  if (state === 'play') {
    if (hold) {
      vy = -SMASH; by += vy * dt;
      while (state === 'play' && by - BALL_R <= topY()) {
        if (top >= total) { bounceOn(finishY); win(); break; }
        const s = sliceAt(top, tower.rotation.y), dark = rings[top].kinds[s];
        if (dark && !fire) { by = topY() + BALL_R; die(); break; }
        smashRing(top); squash = 0.6;
        if (botTarget >= 0 && top >= botTarget && !fire) { botTarget = -1; hold = false; bounceOn(topY()); break; }
      }
    } else {
      vy -= GRAV * dt; by += vy * dt;
      if (by - BALL_R <= topY() && vy < 0) { bounceOn(topY()); if (top >= total) win(); }
      if (!fire) heat = Math.max(0, heat - 0.006 * dt);
    }
    if (fire) { heat -= 0.0058 * dt; if (heat <= 0) { heat = 0; setFire(false); } if (Math.random() < 0.6) burst(scene, ball.position.clone().add(new THREE.Vector3(0, 0.2, 0)), ['#ff9b2f', '#ffd23f', '#ff4d00'], 1, { speed: 0.02, up: 0.03, size: 0.6, gravity: -0.002, life: 0.5 }); }
  }
  if (state === 'won') { vy -= GRAV * dt; by += vy * dt; if (by - BALL_R <= finishY) { by = finishY + BALL_R; vy = BOUNCE * 0.8; squash = 1; } }
  meterFill.style.height = (heat * 100) + '%';
  meter.style.opacity = state === 'play' && (heat > 0.02 || fire) ? 1 : 0;
  // ball visuals
  squash = Math.max(0, squash - dt * 0.1);
  const stretch = hold && state === 'play' ? 0.18 : 0;
  ball.position.set(0, by, BALL_D);
  ball.scale.set(1 + squash * 0.3 - stretch * 0.4, 1 - squash * 0.35 + stretch, 1 + squash * 0.3 - stretch * 0.4);
  const tl = hold && state === 'play' ? 2.2 : clamp(Math.abs(vy) * 6, 0, 0.9);
  trail.position.copy(ball.position); trail.scale.set(1, Math.max(0.01, tl), 1); trailMat.opacity = state === 'play' ? (hold ? 0.55 : 0.25) : 0;
  // debris
  for (const d of debris) {
    if (d.life <= 0) continue;
    d.life -= dt * 0.022; d.v.y -= 0.004 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt; d.m.scale.setScalar(Math.max(0.01, Math.min(0.85, d.life * 1.4)));
    if (d.life <= 0) d.m.visible = false;
  }
  // camera: follows the ball down only
  const target = Math.min(by, topY() + 1.4);
  camY = state === 'ready' ? by : Math.min(camY, lerp(camY, target, 0.12 * dt));
  if (state === 'won') camY = lerp(camY, finishY + 1.2, 0.05 * dt);
  camera.position.set(0, camY + 5.4, 10.2); camera.lookAt(0, camY - 1.9, 0);
  stage.followLight(new THREE.Vector3(0, by, BALL_D * 0.5));
});

buildLevel(); ui.start();

// ---------------------------------------------------------------- test hook + bot: press-and-hold for exactly as many rings as are safe
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || hold) return;
    if (fire) { hold = true; botTarget = -1; return; }
    let k = 0;
    const startY = by - BALL_R;
    for (let j = top; j <= total; j++) {
      if (j === total) { k = total - top + 1; break; }
      const frames = Math.max(0, (startY - rings[j].y) / SMASH), w = omega * dir / 60;
      let safe = true;
      for (const f of [frames - 1.5, frames, frames + 1.5]) { const s = sliceAt(j, tower.rotation.y + w * Math.max(0, f)); if (rings[j].kinds[s]) safe = false; }
      if (!safe) break;
      k++;
    }
    if (k >= 1) { hold = true; botTarget = top + Math.min(k, total - top + 1); if (botTarget > total) botTarget = -1; }
  },
};

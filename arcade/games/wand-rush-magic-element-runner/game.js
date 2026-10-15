// Wand Rush — original first-person element runner. You glide down a sky track holding two magic wands.
// Drag left/right to steer through element gates (fire / frost / spark); your wands auto-blast whatever is ahead,
// but a goon only falls to the element that matches its armour. Dodge the ones you can't break. Reach the finish.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded, stickman } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const NAME = 'Wand Rush: Magic Element Runner';
const S = store('wandrush');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('bloopstack');
const B = board({ game: 'wand-rush', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });

const stage = createStage({ fov: 62, shadowSize: 14 });
const { scene, camera, sun } = stage;
scene.add(camera);
scene.fog = new THREE.Fog('#cfe9ff', 30, 75);
const ui = createUI({ title: 'WAND<br>RUSH', hint: 'Drag to steer · match the magic', hand: '👆' });
const D = daily('wandrush', ui, { name: NAME });

const EL = [
  { name: 'FIRE', c: '#ff5a1f', g: '#ffb347' },
  { name: 'FROST', c: '#25b9ff', g: '#c4f2ff' },
  { name: 'SPARK', c: '#ffc400', g: '#fff1a0' },
];
const SKIES = [['#7cc7ff', '#e7f6ff'], ['#9a8cff', '#ffd8f1'], ['#58d2c2', '#e2fff6'], ['#ff9a8b', '#ffe3c4']];
const TRACK_W = 5.6, HALF = 2.3;

// ---------------------------------------------------------------- world
function checkerTex(a, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 64, 64); x.fillStyle = b; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.anisotropy = 4; return t;
}
const trackTex = checkerTex('#ffffff', '#e4defa');
const track = new THREE.Mesh(new THREE.BoxGeometry(TRACK_W, 0.6, 1), mat('#ffffff', { map: trackTex, roughness: 0.55 })); track.receiveShadow = true; scene.add(track);
const rimMat = glossy('#b9a8ff');
const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 1), rimMat), rimR = rimL.clone(); scene.add(rimL, rimR);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#5ec8ff', { roughness: 0.25, emissive: '#2a9bdc', emissiveIntensity: 0.25 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -6; scene.add(sea);
const props = new THREE.Group(); scene.add(props);
const PROP = rounded(1, 1, 1, 0.12), PALM = new THREE.CylinderGeometry(0.12, 0.18, 3, 7), LEAF = new THREE.SphereGeometry(0.6, 8, 6);
const finish = new THREE.Group(); scene.add(finish);
{
  const c = document.createElement('canvas'); c.width = 128; c.height = 16; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#2b2d42' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, 0.7), mat('#fff', { map: t })); strip.rotation.x = -Math.PI / 2; strip.position.y = 0.31; finish.add(strip);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(rounded(0.35, 4, 0.35, 0.1), glossy('#ff5d8f')); p.position.set(s * (HALF + 0.6), 2, 0); p.castShadow = true; finish.add(p); }
  const band = new THREE.Mesh(rounded(TRACK_W + 1.6, 0.6, 0.4, 0.15), glossy('#ff5d8f')); band.position.y = 3.9; finish.add(band);
}

// ---------------------------------------------------------------- wands (first person, attached to the camera)
function makeWand(side) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.95, 10), glossy('#5b3c9e')); stick.position.y = 0; g.add(stick);
  for (const y of [-0.38, -0.22, 0.36]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 14), glossy('#ffd23f', { metalness: 0.4 })); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const gemMat = glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), gemMat); gem.position.y = 0.55; gem.scale.set(1, 1.5, 1); g.add(gem);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = 0.55; g.add(glow);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.22, 12), glossy('#ffffff')); cuff.position.y = -0.5; g.add(cuff);
  g.scale.setScalar(0.62); g.position.set(side * 0.27, -0.6, -1.0); g.rotation.set(-0.5, 0, side * 0.25);
  g.gem = gem; g.gemMat = gemMat; g.glow = glow; g.side = side; g.kick = 0; camera.add(g); return g;
}
const wands = [makeWand(-1), makeWand(1)];

// ---------------------------------------------------------------- shared meshes for gates / crates
const ICONS = [
  (() => { const g = new THREE.ConeGeometry(0.22, 0.55, 10); g.translate(0, 0.1, 0); return g; })(),
  new THREE.OctahedronGeometry(0.28, 0),
  (() => { const s = new THREE.Shape(); s.moveTo(0.05, 0.35); s.lineTo(-0.18, 0); s.lineTo(0, 0); s.lineTo(-0.08, -0.35); s.lineTo(0.2, 0.06); s.lineTo(0.02, 0.06); s.lineTo(0.12, 0.35); const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }); g.center(); return g; })(),
];
const RINGG = new THREE.TorusGeometry(0.7, 0.09, 10, 32), DISC = new THREE.CircleGeometry(0.66, 32), CRATE = rounded(0.9, 0.9, 0.9, 0.08);
const crateTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#e8a75c'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#b8743a'; x.lineWidth = 6; x.strokeRect(3, 3, 58, 58); x.beginPath(); x.moveTo(6, 6); x.lineTo(58, 58); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const crateMat = mat('#ffffff', { map: crateTex });

// ---------------------------------------------------------------- state
let state = 'ready', pz = 0, px = 0, tx = 0, speed = 7, elem = 0, score = 0, length = 100, waves = [], enemies = [], gates = [], crates = [], shots = [];
let fireT = 0, wandI = 0, recorded = false, beatenShown = false, camShake = 0, kills = 0, hitFx = 0, lastStepT = 0;
let enemySpeed = 1;

function setElem(e) {
  elem = e; for (const w of wands) { w.gemMat.color.set(EL[e].g); w.gemMat.emissive.set(EL[e].c); w.glow.material.color.set(EL[e].c); }
}

function makeEnemy(e, x, z) {
  const g = stickman(EL[e].c, '#ffd7ba', 1.15);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glossy(EL[e].c)); helm.position.y = 1.55; g.add(helm);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.1), glossy('#2b2d42')); visor.position.set(0, 1.5, 0.17); g.add(visor);
  const badge = new THREE.Mesh(ICONS[e], glossy(EL[e].g, { emissive: EL[e].c, emissiveIntensity: 0.5 })); badge.scale.setScalar(0.45); badge.position.set(0, 1.0, 0.25); g.add(badge);
  g.position.set(x, 0.3, z); g.rotation.y = 0; scene.add(g);
  return { g, e, x, z, alive: true, fly: null, phase: Math.random() * 6, active: false };
}

function build() {
  for (const en of enemies) scene.remove(en.g); for (const ga of gates) scene.remove(ga.g); for (const c of crates) scene.remove(c.m);
  enemies = []; gates = []; crates = []; shots.forEach(s => scene.remove(s.m)); shots = []; props.clear();
  const fk = F.k(), r = rng(D.seed || level * 6151 + 3);
  speed = clamp((6.6 + Math.min(level, 15) * 0.15) * fk, 5.6, 10.5);
  enemySpeed = clamp((0.9 + level * 0.05) * fk, 0.7, 2.2);
  const nW = Math.min(3 + Math.floor(level / 2), 10), nEl = level >= 3 ? 3 : 2, gap = 22;
  let z = -14;
  for (let w = 0; w < nW; w++) {
    // gate row: one gate per element in random lane order
    const order = [0, 1, 2].slice(0, nEl).sort(() => r() - 0.5), lanes = nEl === 2 ? [-1.25, 1.25] : [-1.65, 0, 1.65];
    order.forEach((e, i) => gates.push(makeGate(e, lanes[i], z)));
    // enemy group, matching one of the gates; later levels mix in a second element you have to dodge
    const ge = order[Math.floor(r() * order.length)];
    const cnt = clamp(Math.round((2 + level * 0.35) * fk), 2, 7);
    const zg = z - 11;
    const used = [];
    for (let i = 0; i < cnt; i++) { const ex = clamp(-1.7 + r() * 3.4, -1.9, 1.9), ez = zg - r() * 5; if (used.some(u => Math.abs(u[0] - ex) < 0.7 && Math.abs(u[1] - ez) < 0.9)) { i--; if (used.length > 30) break; used.push([99, 99]); continue; } used.push([ex, ez]); enemies.push(makeEnemy(ge, ex, ez)); }
    if (level >= 3 && r() < 0.5) { const oe = order.find(e => e !== ge); const ox = r() < 0.5 ? -1.9 : 1.9; enemies.push(makeEnemy(oe, ox, zg - 2 - r() * 3)); }
    if (r() < 0.6) { const c = new THREE.Mesh(CRATE, crateMat); c.castShadow = true; const cx = -1.8 + r() * 3.6, cz = z + 6 + r() * 3; c.position.set(cx, 0.75, cz); scene.add(c); crates.push({ m: c, x: cx, z: cz, alive: true }); }
    z -= gap;
  }
  length = -z + 6;
  track.scale.z = length + 60; track.position.set(0, 0, -length / 2 + 10); trackTex.repeat.set(TRACK_W / 1.4, (length + 60) / 1.4);
  rimL.scale.z = rimR.scale.z = length + 60; rimL.position.set(-TRACK_W / 2, 0.35, track.position.z); rimR.position.set(TRACK_W / 2, 0.35, track.position.z);
  finish.position.set(0, 0, -length);
  // side scenery: pastel blocks and palms on little islands
  const cols = ['#ffd6e7', '#d6f0ff', '#fff1c9', '#e2d9ff', '#d4f7e3'];
  for (let k = 10; k < length + 50; k += 7 + r() * 6) for (const s of [-1, 1]) {
    if (r() < 0.35) continue;
    const h = 1 + r() * 5, m = new THREE.Mesh(PROP, mat(cols[Math.floor(r() * cols.length)])); m.scale.set(2 + r() * 2, h, 2 + r() * 2); m.position.set(s * (5.5 + r() * 6), -6 + h / 2 + 3 + r() * 2, -k); props.add(m);
    if (r() < 0.45) { const t = new THREE.Mesh(PALM, mat('#b07a4a')); t.position.set(m.position.x, m.position.y + h / 2 + 1.5, m.position.z); props.add(t); const l = new THREE.Mesh(LEAF, mat('#4fc36b')); l.scale.set(1.8, 0.5, 1.8); l.position.set(t.position.x, t.position.y + 1.5, t.position.z); props.add(l); }
  }
  const sky = SKIES[(level - 1) % SKIES.length], bs = document.body.style; bs.setProperty('--bg1', sky[0]); bs.setProperty('--bg2', sky[1]); bs.setProperty('--ui', '#7b5cff');
  scene.fog.color.set(sky[1]);
  pz = 0; px = tx = 0; score = 0; kills = 0; recorded = false; beatenShown = false; fireT = 0; hitFx = 0;
  setElem(gates.length ? gates[0].e : 0);
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

function makeGate(e, x, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(RINGG, glossy(EL[e].c, { emissive: EL[e].c, emissiveIntensity: 0.35 })); ring.castShadow = true; g.add(ring);
  const disc = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color: EL[e].g, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); g.add(disc);
  const icon = new THREE.Mesh(ICONS[e], glossy(EL[e].g, { emissive: EL[e].c, emissiveIntensity: 0.6 })); icon.position.z = 0.05; g.add(icon);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), glossy('#ffffff')); post.position.y = -0.95; g.add(post);
  g.position.set(x, 1.55, z); scene.add(g);
  return { g, e, x, z, taken: false, icon, ring };
}

function addScore(v, at) {
  score += v; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(px, 2, pz - 4), 40); }
}

function fire(target) {
  const w = wands[wandI++ % 2]; w.kick = 1;
  const from = new THREE.Vector3(); w.gem.getWorldPosition(from);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: EL[elem].g })); m.position.copy(from); scene.add(m);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ color: EL[elem].c, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); m.add(halo);
  shots.push({ m, from, target, t: 0, e: elem });
  [() => tone(220, 0.12, 'sawtooth', 0.06, 2.2), () => tone(1400, 0.1, 'sine', 0.06, 0.4), () => tone(900, 0.06, 'square', 0.05, 1.6)][elem]();
}

function resolve(s) {
  const tg = s.target;
  if (tg.crate) {
    if (!tg.alive) return; tg.alive = false; scene.remove(tg.m);
    burst(scene, tg.m.position, ['#e8a75c', '#b8743a', '#fff3d6'], 14, { speed: 0.14, up: 0.12, size: 0.45 }); tone(140, 0.12, 'square', 0.1, 0.6); addScore(5);
    return;
  }
  if (!tg.alive) return;
  const pos = tg.g.position.clone().add(new THREE.Vector3(0, 1.1, 0));
  if (s.e === tg.e) {
    tg.alive = false; kills++;
    tg.fly = { vx: (tg.x - px) * 0.04 + (Math.random() - 0.5) * 0.06, vy: 0.22 + Math.random() * 0.08, vz: -0.14 - Math.random() * 0.06, rx: 0.15 + Math.random() * 0.1, rz: (Math.random() - 0.5) * 0.3 };
    burst(scene, pos, [EL[s.e].c, EL[s.e].g, '#ffffff'], 20, { speed: 0.15, up: 0.1, size: 0.7 });
    buzz(12); camShake = 0.12; addScore(10);
    note(67 + (kills % 8) * 2, 0.18, 0.12);
    if (kills % 5 === 0) ui.pop(['COMBO!', 'BLAST!', 'ZAPPED!', 'AWESOME!'][(kills / 5) % 4], EL[s.e].g, 38, 26);
  } else {
    tg.immune = 1;
    burst(scene, pos, ['#ffffff', '#bbbbbb'], 6, { speed: 0.08, up: 0.04, size: 0.4 });
    tone(330, 0.05, 'square', 0.05, 0.9);
  }
}

function lose() {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, clamp(-pz / length, 0, 1)); }
  sfx.smash(); buzz([50, 30, 90]); ui.flash(0.7); camShake = 0.6;
  best = Math.max(best, score); S.set('best', best);
  ui.lose('KNOCKED OUT!', `${Math.round(clamp(-pz / length, 0, 1) * 100)}% of the run`);
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  addScore(20 + level * 5); best = Math.max(best, score); S.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.35);
  confetti(scene, new THREE.Vector3(px, 2.5, pz - 5), 100);
  D.won(score); ui.win(level, `${kills} goons blasted · ${score} pts`);
}

input({ onMove: (dx) => { if (state === 'play') tx = clamp(tx + dx * 0.016, -HALF, HALF); } });
ui.onTap(w => {
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; B.start(); ui.els.sc.classList.remove('hc-hidden');
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  const step = dt / 60;
  if (state === 'play') {
    pz -= speed * step;
    const prevX = px; px = lerp(px, tx, Math.min(1, 0.35 * dt));
    // gates
    for (const ga of gates) if (!ga.taken && pz < ga.z + 0.2 && pz > ga.z - 1) {
      if (Math.abs(px - ga.x) < 0.85) {
        ga.taken = true; const changed = ga.e !== elem; setElem(ga.e);
        burst(scene, ga.g.position, [EL[ga.e].c, EL[ga.e].g, '#ffffff'], 22, { speed: 0.12, up: 0.06, size: 0.6 });
        ga.g.visible = false; ui.flash(0.2); buzz(15);
        [0, 4, 7].forEach((s, i) => setTimeout(() => note(72 + s + ga.e * 2, 0.2, 0.13), i * 50));
        ui.pop(EL[ga.e].name + (changed ? '!' : ' UP'), EL[ga.e].c, 42, 24);
        for (const w of wands) w.kick = 1.4;
      }
    }
    // enemies walk at you once close; touching one knocks you out
    for (const en of enemies) {
      if (!en.alive) continue;
      const dz = pz - en.z;
      if (dz > 0 && dz < 20) en.active = true;
      if (en.active && en.z < pz - 1) { en.z += enemySpeed * step; en.g.run(t + en.phase, 1); }
      en.g.position.set(en.x, 0.3, en.z);
      if (en.immune) { en.immune = Math.max(0, en.immune - 0.06 * dt); en.g.scale.setScalar(1.15 * (1 + en.immune * 0.08)); }
      if (Math.abs(en.z - (pz - 0.6)) < 0.45 && Math.abs(en.x - px) < 0.75) { lose(); break; }
    }
    // crates break when you run through them too
    for (const c of crates) if (c.alive && Math.abs(c.z - pz) < 0.5 && Math.abs(c.x - px) < 0.8) resolve({ target: Object.assign(c, { crate: true }), e: elem });
    // auto-fire: prefer a goon you can actually break, then crates, then anything in front
    fireT -= step;
    if (fireT <= 0 && state === 'play') {
      let tgt = null, bd = 1e9;
      for (const en of enemies) { if (!en.alive) continue; const dz = pz - en.z; if (dz < 1 || dz > 17 || Math.abs(en.x - px) > 2.8) continue; const d = dz + Math.abs(en.x - px) * 2 + (en.e === elem ? 0 : 50); if (d < bd) { bd = d; tgt = en; } }
      if (!tgt || tgt.e !== elem) for (const c of crates) { if (!c.alive) continue; const dz = pz - c.z; if (dz < 1 || dz > 14) continue; const d = dz + 20; if (d < bd) { bd = d; tgt = Object.assign(c, { crate: true }); } }
      if (tgt) { fire(tgt); fireT = 0.2; }
    }
    if (state === 'play') { ui.progress(-pz / length); if (-pz >= length) win(); }
    for (const w of wands) w.position.x = w.side * 0.27 - (px - prevX) * 0.6;
  } else if (state === 'won') pz -= speed * 0.4 * step;
  // shots fly to their target
  for (const s of shots) {
    s.t += dt / 9;
    const to = s.target.crate ? s.target.m.position : s.target.g.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    s.m.position.lerpVectors(s.from, to, Math.min(1, s.t)); s.m.position.y += Math.sin(Math.min(1, s.t) * Math.PI) * 0.4;
    if (Math.random() < 0.7) burst(scene, s.m.position, EL[s.e].c, 1, { speed: 0.02, up: 0.01, size: 0.5, gravity: 0 });
    if (s.t >= 1) { resolve(s); s.done = true; scene.remove(s.m); }
  }
  shots = shots.filter(s => !s.done);
  // knocked-out goons fly away
  for (const en of enemies) if (en.fly) { const f = en.fly; f.vy -= 0.012 * dt; en.x += f.vx * dt; en.z += f.vz * dt; en.g.position.set(en.x, en.g.position.y + f.vy * dt, en.z); en.g.rotation.x += f.rx * dt; en.g.rotation.z += f.rz * dt; if (en.g.position.y < -8) { en.fly = null; en.g.visible = false; } }
  // gates bob + spin
  for (const ga of gates) if (!ga.taken) { ga.icon.rotation.y += 0.05 * dt; ga.g.position.y = 1.55 + Math.sin(t * 3 + ga.x) * 0.08; ga.ring.rotation.z += 0.01 * dt; }
  // wands sway + recoil, gems pulse
  for (const w of wands) { w.kick = Math.max(0, w.kick - 0.12 * dt); w.position.z = -1.0 + w.kick * 0.12; w.position.y = -0.6 + Math.sin(t * 8 + w.side) * 0.015 + w.kick * 0.03; w.glow.scale.setScalar(1 + Math.sin(t * 10) * 0.1 + w.kick * 0.6); w.gem.rotation.y += 0.06 * dt; }
  // camera
  camShake = Math.max(0, camShake - 0.02 * dt);
  const sx = (Math.random() - 0.5) * camShake, sy = (Math.random() - 0.5) * camShake;
  camera.position.set(px * 0.92 + sx, 2.15 + sy + Math.sin(t * 9) * (state === 'play' ? 0.02 : 0), pz + 0.4);
  camera.lookAt(px * 0.75, 0.9, pz - 9); camera.rotation.z += (state === 'play' ? (px - tx) * 0.05 : 0);
  stage.followLight(new THREE.Vector3(0, 0, pz - 6));
  sea.position.z = pz;
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    // the next un-taken gate row decides the element we need for the group behind it
    const nextGate = gates.filter(g => !g.taken && g.z < pz + 0.5).sort((a, b) => b.z - a.z)[0];
    const groupE = (() => { const z0 = nextGate ? nextGate.z : -1e9; const c = [0, 0, 0]; for (const en of enemies) if (en.alive && en.z < z0 && en.z > z0 - 18) c[en.e]++; return c.indexOf(Math.max(...c)); })();
    let want = tx;
    const near = enemies.filter(en => en.alive && pz - en.z > -0.5 && pz - en.z < 9);
    const blocked = (x) => near.some(en => (en.e !== elem || pz - en.z < 2.2) && Math.abs(en.x - x) < 0.95);
    if (nextGate && pz - nextGate.z < 16 && !(near.length && near.some(en => Math.abs(en.x - px) < 1))) {
      const g = gates.find(g => !g.taken && Math.abs(g.z - nextGate.z) < 0.1 && g.e === groupE); if (g) want = g.x;
    }
    if (blocked(want)) { let bx = want, bs = 1e9; for (let x = -HALF; x <= HALF; x += 0.25) { if (blocked(x)) continue; const sc = Math.abs(x - px); if (sc < bs) { bs = sc; bx = x; } } want = bx; }
    tx = clamp(lerp(tx, want, 0.85), -HALF, HALF);
  },
};

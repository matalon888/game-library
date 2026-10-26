// Swingaroo — one-tap rope swing. Hold anywhere to fire a rope at the nearest ring and swing; let go to fly.
// Bounce pads in the gaps, pillars to clear, a goo sea below. Flips in the air score bonus points. Reach the finish deck.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
const B = board({ game: 'swingaroo', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });   // world board (RULES.md part C)

const NAME = 'Swingaroo: Rope Swing Stunt Game';
const S = store('swingaroo');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('swingaroo');

const stage = createStage({ fov: 42, shadowSize: 18 });
const { scene, camera, sun } = stage;
sun.intensity = 1.45;
const ui = createUI({ title: 'SWINGAROO', hint: 'Hold to swing · release to fly', hand: '👆' });
const D = daily('swingaroo', ui, { name: NAME });

const SKIES = [['#ffb38a', '#ffe7b0'], ['#9fd8ff', '#e6f6ff'], ['#c8b2ff', '#ffd9f0'], ['#8fe3c6', '#eafff5'], ['#ff9fb8', '#ffe2cc'], ['#a8c4ff', '#f0e6ff']];
const ACC = ['#ff6b4a', '#2b8cff', '#8a5cff', '#1fb487', '#ff4f86', '#5a6cff'];
const GRAV = 26, MAXV = 21, R = 0.5, KILL_Y = -9;

// ---------------------------------------------------------------- hero: Roo, a mint bean with floppy ears
function makeRoo() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = glossy('#3fd6b0'), belly = mat('#e9fff7'), dark = glossy('#1d1d2b'), white = mat('#ffffff', { roughness: 0.3 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.34, 6, 14), skin); torso.castShadow = true; body.add(torso);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), belly); bel.position.set(0, -0.06, 0.18); bel.scale.set(1, 1.2, 0.6); body.add(bel);
  const head = new THREE.Group(); head.position.y = 0.55; body.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 16), skin); hm.castShadow = true; head.add(hm);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), white); e.position.set(s * 0.12, 0.04, 0.26); e.scale.set(1, 1.2, 0.6); head.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), dark); p.position.set(s * 0.12 + 0.02, 0.03, 0.32); head.add(p);
    const ck = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#ff8fb3')); ck.position.set(s * 0.22, -0.08, 0.24); ck.scale.set(1.3, 0.7, 0.4); head.add(ck);
    const ear = new THREE.Group(); ear.position.set(s * 0.14, 0.24, -0.02); head.add(ear);
    const em = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 10), skin); em.position.y = 0.2; em.castShadow = true; ear.add(em);
    const ei = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.26, 4, 8), mat('#ffb3c9')); ei.position.set(0, 0.2, 0.05); ear.add(ei);
    ear.rotation.z = -s * 0.25; g['ear' + (s < 0 ? 'L' : 'R')] = ear;
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#ff6b8b')); nose.position.set(0, -0.05, 0.31); head.add(nose);
  const limb = (x, y, len, m) => { const piv = new THREE.Group(); piv.position.set(x, y, 0.02); const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, len, 4, 8), m); l.position.y = -len / 2 - 0.05; l.castShadow = true; piv.add(l);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), m); paw.position.y = -len - 0.1; piv.add(paw); body.add(piv); piv.a = 0; piv.w = 0; return piv; };
  g.armL = limb(-0.33, 0.2, 0.3, skin); g.armR = limb(0.33, 0.2, 0.3, skin);
  g.legL = limb(-0.15, -0.36, 0.28, skin); g.legR = limb(0.15, -0.36, 0.28, skin);
  g.body = body; g.head = head; g.skin = skin;
  return g;
}
const roo = makeRoo(); roo.scale.setScalar(1.3); scene.add(roo);

// ---------------------------------------------------------------- shared props
const ANCHOR_G = new THREE.TorusGeometry(0.5, 0.15, 12, 28), ANCHOR_IN = new THREE.SphereGeometry(0.22, 16, 12);
const ringMat = glossy('#ff6b4a', { emissive: '#ff6b4a', emissiveIntensity: 0.2 }), coreMat = glossy('#ffcf3f', { emissive: '#ffb300', emissiveIntensity: 0.35 });
const usedCore = glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.2 });
const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 8).translate(0, 0.5, 0), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 }));
rope.castShadow = true; rope.visible = false; scene.add(rope);
const aim = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.7 })); aim.scale.setScalar(2.4); aim.material.blending = THREE.NormalBlending; scene.add(aim);

// goo sea far below
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 14, 160, 1), glossy('#ff9cc0', { emissive: '#ff7aa8', emissiveIntensity: 0.25 }));
sea.rotation.x = -Math.PI / 2; sea.position.set(0, KILL_Y + 0.4, -3); sea.receiveShadow = true; scene.add(sea);
sea.base = sea.geometry.attributes.position.array.slice();

// trail ribbon (vertex alpha)
const TN = 26, trailPts = [];
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TN * 2 * 4), 4));
{ const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
trail.frustumCulled = false; scene.add(trail);

const world = new THREE.Group(); scene.add(world);
const decor = new THREE.Group(); scene.add(decor);
const ISLE = new THREE.ConeGeometry(1, 1.6, 7), TOP = new THREE.CylinderGeometry(1, 1, 0.25, 7), TREE = new THREE.SphereGeometry(0.6, 10, 8);
const isleMat = mat('#f0c6a8', { roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.15 }), grassMat = mat('#a8e897', { roughness: 0.8, emissive: '#ffffff', emissiveIntensity: 0.15 }), treeMat = mat('#7fd88a', { roughness: 0.8, emissive: '#ffffff', emissiveIntensity: 0.12 });
const PUFF = new THREE.SphereGeometry(1, 14, 10), cloudMat = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.45, transparent: true, opacity: 0.6 });

// ---------------------------------------------------------------- state
let state = 'ready', anchors = [], rects = [], finishX = 0, endX = 0;
let p = new THREE.Vector2(), v = new THREE.Vector2(), grip = null, ropeL = 0, ropeShow = 0, holding = false, grounded = null;
let bodyA = 0, spin = 0, flipAcc = 0, flips = 0, score = 0, combo = 0, recorded = false, beatenShown = false, camX = 0, camY = 2, squash = 0, clock = 0, grabs = 0;
let grabRange = 12;

function build() {
  const seed = D.seed || level * 7919 + 31, r = rng(seed), fk = F.k();
  const sky = SKIES[(level - 1) % SKIES.length], bs = document.body.style;
  bs.setProperty('--bg1', sky[0]); bs.setProperty('--bg2', sky[1]); bs.setProperty('--ui', ACC[(level - 1) % ACC.length]);
  world.clear(); decor.clear(); anchors = []; rects = [];
  grabRange = clamp(12.5 / Math.sqrt(fk), 9.5, 14);
  const acc = ACC[(level - 1) % ACC.length];
  ringMat.color.set(acc); ringMat.emissive.set(acc); aim.material.color.set(acc);
  const platMat = glossy(new THREE.Color(acc).lerp(new THREE.Color('#ffffff'), 0.72)), padMat = glossy(acc), pillarMat = glossy(new THREE.Color(acc).lerp(new THREE.Color('#ffffff'), 0.45));
  const addRect = (x0, x1, y0, y1, kind) => {
    const w = x1 - x0, h = y1 - y0, m = new THREE.Mesh(rounded(w, h, 2.2, Math.min(0.3, h / 2 - 0.01)), kind === 'pad' ? padMat : kind === 'pillar' ? pillarMat : platMat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); m.castShadow = m.receiveShadow = true; world.add(m);
    const rc = { x0, x1, y0, y1, kind, m, sq: 0 }; rects.push(rc);
    if (kind === 'pad') { // spring coils + stripe
      const top = new THREE.Mesh(rounded(w * 0.9, 0.18, 2.3, 0.08), glossy('#ffffff')); top.position.set(0, h / 2 + 0.05, 0); m.add(top); rc.top = top;
    }
    return rc;
  };
  addRect(-5, 1.2, -9, 0, 'plat');
  const N = clamp(13 + level * 2, 14, 34);
  let x = 5, y = 6.2;
  const padChance = clamp(0.12 + level * 0.035, 0.12, 0.34) * fk, pillarChance = level < 2 ? 0 : clamp(0.15 + level * 0.04, 0.15, 0.45) * fk;
  for (let i = 0; i < N; i++) {
    if (i > 1 && i < N - 1 && r() < padChance) {
      const px = x - 1.5; addRect(px, px + 3.6, -9, -2.8, 'pad'); x += 8.5 + r() * 1.5; y = clamp(5.5 + r() * 2.5, 4.5, 8.5); continue;
    }
    anchors.push({ x, y, used: false });
    const sp = clamp((6.2 + r() * 2.2 + Math.min(level, 12) * 0.08) * Math.sqrt(fk), 5.6, 9.8);
    if (r() < pillarChance && i < N - 1) { const cx = x + sp / 2; addRect(cx - 0.6, cx + 0.6, -9, clamp(y - 7.2 + r() * 1.2, -5, 1.2), 'pillar'); }
    x += sp; y = clamp(y + (r() - 0.5) * 3.6, 4.2, 9);
  }
  const lastA = anchors[anchors.length - 1];
  finishX = lastA.x + 6; endX = finishX + 12;
  addRect(finishX + 1.5, endX, -9, -1, 'plat');
  // anchors meshes
  for (const a of anchors) {
    const g = new THREE.Group(); g.position.set(a.x, a.y, 0);
    const ring = new THREE.Mesh(ANCHOR_G, ringMat); ring.castShadow = true; g.add(ring);
    const core = new THREE.Mesh(ANCHOR_IN, coreMat); g.add(core);
    world.add(g); a.g = g; a.core = core; a.pulse = 0;
  }
  // finish gate: two posts + checkered banner
  {
    // finish line: a tall checkered beam rising out of the goo — cross it at any height
    const gate = new THREE.Group(); gate.position.set(finishX, 0, -0.6); world.add(gate);
    const c = document.createElement('canvas'); c.width = 32; c.height = 512; const cx = c.getContext('2d');
    for (let i = 0; i < 2; i++) for (let j = 0; j < 32; j++) { cx.fillStyle = (i + j) % 2 ? '#2b2d42' : '#fff'; cx.fillRect(i * 16, j * 16, 16, 16); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 26, 0.3), mat('#ffffff', { map: t, emissive: '#ffffff', emissiveIntensity: 0.15 })); beam.position.y = 3; beam.castShadow = true; gate.add(beam);
    const glowB = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.5 })); glowB.scale.set(5, 30, 1); glowB.position.set(0, 3, -0.4); gate.add(glowB);
  }
  // parallax decor: clouds + distant floating islands
  const dr = rng(seed + 3);
  for (let i = -2; i < endX / 8 + 3; i++) {
    const cl = new THREE.Group(); for (let j = 0; j < 4; j++) { const pf = new THREE.Mesh(PUFF, cloudMat); const s = 0.6 + dr() * 0.6; pf.scale.set(s * 1.4, s, s); pf.position.set(j * 1.1 - 1.6, (j % 2) * 0.45, 0); cl.add(pf); }
    cl.position.set(i * 8 + dr() * 5, -2 + dr() * 16, -22 - dr() * 14); decor.add(cl);
    if (dr() < 0.6) { // little floating islands with a tree, far back
      const is = new THREE.Group(), rock = new THREE.Mesh(ISLE, isleMat); rock.scale.set(1.6 + dr(), 1.2, 1.4); rock.rotation.x = Math.PI; rock.position.y = -0.8; is.add(rock);
      const top = new THREE.Mesh(TOP, grassMat); top.position.y = 0.05; top.scale.set(1.6 + 0.1, 1, 1.4); is.add(top);
      const tr = new THREE.Mesh(TREE, treeMat); tr.position.set(0.3, 0.9, 0); is.add(tr);
      is.position.set(i * 8 + dr() * 6, -4 + dr() * 16, -24 - dr() * 12); is.scale.setScalar(0.9 + dr() * 0.8); decor.add(is);
    }
  }
  // reset run
  p.set(0, R); v.set(0, 0); grip = null; holding = false; grounded = rects[0]; ropeShow = 0; rope.visible = false;
  bodyA = 0; spin = 0; flipAcc = 0; flips = 0; score = 0; combo = 0; grabs = 0; recorded = false; beatenShown = false; squash = 0;
  roo.visible = true; roo.scale.setScalar(1.3); trailPts.length = 0;
  camX = p.x + 2.5; camY = 2;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(D.isDaily ? 'DAILY CHALLENGE' : best ? 'BEST ' + best : '');
}

function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(p.x, p.y + 2, 0), 50); }
}

function target() {
  let bestA = null, bd = Infinity;
  for (const a of anchors) {
    if (a.x < p.x - 1.2) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y); if (d > grabRange) continue;
    const score = d + (a.x < p.x ? 3 : 0);
    if (score < bd) { bd = score; bestA = a; }
  }
  return bestA;
}

function press() {
  if (state !== 'play') return; holding = true;
  const a = target(); if (!a) { tone(260, 0.05, 'sine', 0.06, 0.8); return; }
  if (grounded) { v.set(7, 10); p.y += 0.05; squash = 0.8; }   // hop off the deck as the rope fires
  grip = a; ropeL = clamp(Math.hypot(a.x - p.x, a.y - p.y), 2.2, grabRange); ropeShow = 0; grounded = null;
  if (!a.used) { a.used = true; grabs++; combo++; a.core.material = usedCore; addScore(10); }
  a.pulse = 1; flips = 0; flipAcc = 0;
  note(67 + Math.min(combo, 8) * 2, 0.16, 0.14); buzz(10);
  burst(scene, new THREE.Vector3(a.x, a.y, 0.4), ['#ffffff', '#ffcf3f'], 8, { speed: 0.08, up: 0.03, size: 0.45, gravity: 0.002 });
}
function release() {
  holding = false;
  if (!grip || state !== 'play') { grip = null; return; }
  grip = null; rope.visible = false;
  const sp = v.length(); spin = -clamp(sp * 0.55, 3, 13) * Math.sign(v.x || 1);
  tone(330, 0.12, 'sine', 0.1, 1.7); buzz(6);
}

function lose(why) {
  if (state !== 'play') return;
  state = 'lost'; grip = null; holding = false; rope.visible = false;
  const frac = clamp(p.x / finishX, 0, 1);
  if (!recorded) { recorded = true; F.level(false, frac); }
  best = Math.max(best, score); S.set('best', best);
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.35);
  burst(scene, new THREE.Vector3(p.x, KILL_Y + 0.8, 0), ['#ff7aa8', '#ffd1e3', '#ffffff'], 26, { speed: 0.14, up: 0.18, size: 0.7 });
  ui.lose(why, `${Math.round(frac * 100)}% of the way`);
}
function win() {
  state = 'won'; grip = null; holding = false; rope.visible = false;
  if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  addScore(30 + level * 5);
  best = Math.max(best, score); S.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.4);
  confetti(scene, new THREE.Vector3(finishX + 2.5, 4, 0), 100);
  D.won(score); ui.win(level, `${score} points`);
}

input({ onDown: () => press(), onUp: () => release() });
ui.onTap(w => {
  B.start();
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; ui.els.sc.classList.remove('hc-hidden');
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the roo fires its rope at the first ring and swings there (it never lets go, so it can't fall); a real tap takes over
demo(() => { if (!grounded || grounded !== rects[0] || !target()) return false; press(); holding = false; return false; },
  { ready: () => state === 'play' && level === 1 && !D.isDaily && !grip && grounded === rects[0], wait: 1500, max: 1 });

// ---------------------------------------------------------------- physics
function collide() {
  for (const rc of rects) {
    const cx = clamp(p.x, rc.x0, rc.x1), cy = clamp(p.y, rc.y0, rc.y1);
    const dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    let nx, ny, d = Math.sqrt(d2);
    if (d < 1e-5) { nx = 0; ny = 1; d = 0; } else { nx = dx / d; ny = dy / d; }
    p.x += nx * (R - d); p.y += ny * (R - d);
    const vn = v.x * nx + v.y * ny;
    if (vn >= 0) continue;
    if (rc.kind === 'pad' && ny > 0.5) {
      v.y = clamp(Math.abs(v.y) * 0.85, 16.5, 21); v.x = Math.max(v.x, 6.5);
      rc.sq = 1; squash = 1; spin = -8; combo++; addScore(5);
      note(72 + Math.min(combo, 7) * 2, 0.2, 0.16); setTimeout(() => note(79 + Math.min(combo, 7) * 2, 0.2, 0.12), 60); buzz(12);
      burst(scene, new THREE.Vector3(p.x, rc.y1, 0.6), ['#ffffff', '#ffe66d'], 12, { speed: 0.1, up: 0.06, size: 0.5 });
      ui.pop('BOING!', '#fff', 32, 34);
    } else if (ny > 0.6 && rc.kind === 'plat') {
      if (v.y < -6) { squash = Math.min(1, -v.y / 20); tone(200, 0.08, 'sine', 0.12, 0.7); burst(scene, new THREE.Vector3(p.x, rc.y1, 0.6), '#ffffff', 8, { speed: 0.06, up: 0.03, size: 0.45 }); }
      v.y = 0; v.x *= 0.6; grounded = rc; spin = 0;
    } else {
      v.x -= 1.5 * vn * nx; v.y -= 1.5 * vn * ny; tone(150, 0.08, 'triangle', 0.12, 0.6); buzz(15); rc.sq = 0.6; combo = 0;
      burst(scene, new THREE.Vector3(p.x - nx * R, p.y - ny * R, 0.6), '#ffffff', 6, { speed: 0.07, up: 0.03, size: 0.4 });
    }
  }
}

function physics(h) {
  if (grounded && !grip) {
    // stand on the deck; friction
    v.x *= Math.pow(0.02, h); v.y = 0; p.y = grounded.y1 + R;
    if (p.x < grounded.x0 - 0.2 || p.x > grounded.x1 + 0.2) grounded = null;
    return;
  }
  v.y -= GRAV * h;
  if (grip) {
    const dx = p.x - grip.x, dy = p.y - grip.y, d = Math.hypot(dx, dy) || 1, tx = -dy / d, ty = dx / d;
    // pump: the swing gains a little energy in its direction of travel (feels like the rider kicks)
    const tv = v.x * tx + v.y * ty, dir = Math.sign(tv) || 1;
    const boost = (dir * tx > 0 ? 9 : 3) * dir;
    v.x += tx * boost * h; v.y += ty * boost * h;
  }
  const sp = v.length(); if (sp > MAXV) v.multiplyScalar(MAXV / sp);
  p.x += v.x * h; p.y += v.y * h;
  if (grip) {
    const dx = p.x - grip.x, dy = p.y - grip.y, d = Math.hypot(dx, dy);
    if (ropeL > 7.5) ropeL = Math.max(7.5, ropeL - 5 * h);   // long ropes reel in a little
    if (d > ropeL) {
      const nx = dx / d, ny = dy / d; p.x = grip.x + nx * ropeL; p.y = grip.y + ny * ropeL;
      const vn = v.x * nx + v.y * ny; if (vn > 0) { v.x -= vn * nx; v.y -= vn * ny; }
    }
  }
  collide();
}

// ---------------------------------------------------------------- loop
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
loop((dt, t) => {
  clock = t;
  const step = dt / 60;
  if (state === 'play') {
    for (let i = 0; i < 4; i++) physics(step / 4);
    if (p.y < KILL_Y + 0.6) lose('SPLASH!');
    else if (p.x >= finishX) win();
    ui.progress(p.x / finishX);
    // airborne spin + flips
    if (!grip && !grounded) {
      bodyA += spin * step; flipAcc += Math.abs(spin * step);
      if (flipAcc >= Math.PI * 2) { flipAcc -= Math.PI * 2; flips++; addScore(5 * flips);
        ui.pop(flips === 1 ? 'FLIP!' : flips === 2 ? 'DOUBLE FLIP!' : `FLIP ×${flips}!`, '#fff', 30 + flips * 6, 30); note(79 + Math.min(flips, 5) * 2, 0.25, 0.14); }
      spin *= Math.pow(0.6, step);
    } else if (grip) { const ta = Math.atan2(grip.y - p.y, grip.x - p.x) - Math.PI / 2; bodyA += wrap(ta - bodyA) * Math.min(1, 14 * step); }
    else bodyA += wrap(0 - bodyA) * Math.min(1, 12 * step);
  } else if (state === 'won') {
    if (grounded || p.y <= 1) { v.set(Math.max(0, v.x * 0.9), 0); }
    for (let i = 0; i < 4; i++) physics(step / 4);
    bodyA += wrap(0 - bodyA) * Math.min(1, 8 * step);
  } else if (state === 'lost') {
    if (p.y > KILL_Y - 2) { v.y -= GRAV * step * 0.3; p.y += Math.max(v.y, -6) * step; p.x += v.x * 0.2 * step; }
  }
  // rope
  if (grip && state === 'play') {
    ropeShow = Math.min(1, ropeShow + step * 14);
    const hx = lerp(p.x, grip.x, ropeShow), hy = lerp(p.y, grip.y, ropeShow);
    _d.set(hx - p.x, hy - p.y, 0); const L = _d.length();
    rope.visible = L > 0.05; rope.position.set(p.x, p.y, 0.05); _q.setFromUnitVectors(_up, _d.normalize()); rope.quaternion.copy(_q); rope.scale.set(1, L, 1);
  } else rope.visible = false;
  // aim marker on the ring you'd grab
  const tg = state === 'play' && !grip ? target() : null;
  aim.visible = !!tg; if (tg) { aim.position.set(tg.x, tg.y, -0.2); aim.scale.setScalar(2.2 + Math.sin(t * 8) * 0.25); }
  for (const a of anchors) { a.pulse = Math.max(0, a.pulse - step * 3); const s = 1 + a.pulse * 0.5 + (a === grip ? 0.08 : 0); a.g.scale.setScalar(s); a.g.rotation.y = a === grip ? t * 6 : Math.sin(t * 1.5 + a.x) * 0.3; }
  for (const rc of rects) if (rc.sq > 0) { rc.sq = Math.max(0, rc.sq - step * 4); const s = Math.sin(rc.sq * Math.PI * 2) * rc.sq * 0.15; rc.m.scale.set(1 + s * 0.3, 1 - s, 1); }
  // hero
  squash = Math.max(0, squash - step * 4);
  if (state !== 'lost' || p.y > KILL_Y - 1) {
    roo.position.set(p.x, p.y, 0); roo.rotation.z = bodyA;
    const sp = v.length(), st = clamp(sp / 40, 0, 0.18);
    roo.body.scale.set(1 + squash * 0.3 - st * 0.5, 1 - squash * 0.3 + st, 1);
    const run = grounded && state !== 'lost' ? Math.sin(t * 6) * 0.15 : 0;
    // floppy limbs: spring toward hanging "world-down" + drag from velocity
    const down = -bodyA, drag = clamp(-v.x * 0.04, -0.9, 0.9);
    const limbs = [[roo.armL, down + drag - 0.3], [roo.armR, grip ? Math.PI + 0.1 : down + drag + 0.3], [roo.legL, down + drag * 0.7 + run], [roo.legR, down + drag * 0.7 - run]];
    for (const [l, tgt] of limbs) { l.w += wrap(tgt - l.a) * 180 * step - l.w * 12 * step; l.a += l.w * step; l.rotation.z = l.a; }
    for (const [e, s] of [[roo.earL, 1], [roo.earR, -1]]) e.rotation.z = s * 0.25 + clamp(-v.x * 0.03, -0.6, 0.6) + Math.sin(t * 5 + s) * 0.05 + down * 0.4;
  }
  if (state === 'lost' && p.y <= KILL_Y - 1) roo.visible = false;
  // trail
  if (state === 'play' && !grounded) trailPts.unshift(p.x, p.y); else if (trailPts.length) trailPts.splice(-2, 2);
  if (trailPts.length > TN * 2) trailPts.length = TN * 2;
  {
    const pos = trailGeo.attributes.position.array, col = trailGeo.attributes.color.array, n = trailPts.length / 2;
    for (let i = 0; i < TN; i++) {
      const j = Math.min(i, n - 1); const x = n ? trailPts[j * 2] : p.x, y = n ? trailPts[j * 2 + 1] : p.y;
      const j2 = Math.min(j + 1, n - 1), nx = n > 1 ? trailPts[j2 * 2] - x : 1, ny = n > 1 ? trailPts[j2 * 2 + 1] - y : 0, l = Math.hypot(nx, ny) || 1;
      const w = 0.32 * (1 - i / TN);
      pos.set([x - ny / l * w, y + nx / l * w, -0.1, x + ny / l * w, y - nx / l * w, -0.1], i * 6);
      const al = i < n ? 0.55 * (1 - i / TN) : 0;
      col.set([1, 1, 1, al, 1, 1, 1, al], i * 8);
    }
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  }
  // goo waves
  { const pa = sea.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const bx = sea.base[i * 3]; pa.setZ(i, Math.sin(bx * 0.6 + t * 2) * 0.25 + Math.sin(bx * 0.23 - t) * 0.3); } pa.needsUpdate = true; sea.position.x = Math.round(camX / 10) * 10; }
  // camera: rider in the left third, a little zoom-out at speed
  const sp = v.length();
  const fy = grip && state === 'play' ? (p.y + grip.y) / 2 : p.y * 0.45 + 2.2;
  camX = lerp(camX, p.x + 3 + clamp(v.x * 0.12, -1, 2), Math.min(1, 6 * step));
  camY = lerp(camY, clamp(fy, 0.5, 7), Math.min(1, 3 * step));
  const dist = lerp(camera.position.z || 26, 25 + clamp(sp * 0.25, 0, 5), Math.min(1, 2 * step));
  camera.position.set(camX - 1.2, camY + 2.2, dist); camera.lookAt(camX, camY, 0);
  stage.followLight(new THREE.Vector3(camX, camY - 2, 0));
  decor.position.x = camX * 0.55;
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

// ---------------------------------------------------------------- bot: grip when falling toward the next ring, let go on the upswing
function nextAnchorAfter(x) { let b = null; for (const a of anchors) if (a.x > x + 1 && (!b || a.x < b.x)) b = a; return b; }
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get dbg() { return `p ${p.x.toFixed(1)},${p.y.toFixed(1)} v ${v.x.toFixed(1)},${v.y.toFixed(1)} grip ${grip ? grip.x.toFixed(1) + ',' + grip.y.toFixed(1) : '-'} g ${grounded ? grounded.kind : '-'} fin ${finishX.toFixed(0)}`; },
  bot() {
    if (state !== 'play') { if (holding) release(); return; }
    if (!grip) {
      const tg = target();
      if (grounded) { if (tg && grounded === rects[0]) press(); return; }
      // a pad right below/ahead? let it bounce us instead of roping backwards
      if (tg && (v.y < 1 || p.y < tg.y - 4) && tg.x > p.x - 0.5) press();
      else if (tg && p.y < -3) press();
      return;
    }
    // on the rope: release on the forward upswing once we're past the ring
    const nxt = nextAnchorAfter(grip.x), ang = Math.atan2(v.y, v.x);
    const past = p.x > grip.x + 0.3, up = v.x > 3 && v.y > 1.5 && ang > 0.35 && ang < 1.25;
    if (past && up) release();
  },
};

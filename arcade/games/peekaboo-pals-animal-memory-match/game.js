// Peekaboo Pals — original animal memory game for kids. Peek at the cards, they flip down, then find the matching pairs.
// The table grows every level. Wrong guesses cost a heart; run out of hearts and you simply try again.
import { THREE, createStage, createUI, store, loop, buzz, note, tone, burst, confetti, lerp, clamp, rng, palette, applyPalette, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { NAMES, faceCanvas, backCanvas } from './animals.js';

const NAME = 'Peekaboo Pals: Animal Memory Match';
const S = store('peekpals');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('peekpals');

const stage = createStage({ fov: 36, shadowSize: 7 });
const { scene, camera, renderer } = stage;
const ui = createUI({ title: 'PEEKABOO<br>PALS', hint: 'Find the twins!', hand: '👆' });
const D = daily('peekpals', ui, { name: NAME });

// ---------------------------------------------------------------- textures
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function roundedTex(src, rr = 26) {
  const S2 = src.width, cv = document.createElement('canvas'); cv.width = cv.height = S2; const c = cv.getContext('2d');
  c.beginPath(); c.roundRect(4, 4, S2 - 8, S2 - 8, rr); c.clip(); c.drawImage(src, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
const faceTex = {}; const faceFor = (n) => faceTex[n] || (faceTex[n] = roundedTex(faceCanvas(n)));
const BACKS = [['#ff7eb3', '#ff5d8f'], ['#5ec8ff', '#3a86ff'], ['#b18cff', '#7b5cff'], ['#ffb347', '#ff8c42'], ['#6ee0b0', '#2fb88a'], ['#ff8f8f', '#ff5d6c']];
const backTex = BACKS.map(([a, b]) => roundedTex(backCanvas(a, b)));

// ---------------------------------------------------------------- table
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.14 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
let tray = null;
const CW = 1.12, CH = 1.12, GAP = 0.2, TH = 0.1;
const CARD = rounded(CW, CH, TH, 0.12); CARD.rotateX(-Math.PI / 2);
const PLANE_UP = new THREE.PlaneGeometry(CW - 0.1, CH - 0.1); PLANE_UP.rotateX(-Math.PI / 2);
const PLANE_DN = new THREE.PlaneGeometry(CW - 0.1, CH - 0.1); PLANE_DN.rotateX(Math.PI / 2); PLANE_DN.rotateY(Math.PI);
const GOLD = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.3, metalness: 0.25, emissive: '#7a5a00', emissiveIntensity: 0.25 });
const EDGE = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });

// ---------------------------------------------------------------- level layouts
const LAYOUT = [[2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 5], [4, 6]];
let cards = [], cols = 2, rows = 2, hearts = 0, heartsMax = 0, matched = 0, pairs = 0, first = null, lock = 0, streak = 0;
let state = 'ready', score = 0, sessionLv = 0, recorded = false, beatenShown = false, peekT = 0, peeking = false, now = 0, misses = 0;
let botSeen = new Map();

function fit() {
  const w = cols * (CW + GAP) + 0.6, h = rows * (CH + GAP) + 0.6, vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2), tilt = 0.32;
  const d = Math.max((w / 2 + 0.35) / (th * camera.aspect), (h / 2 * Math.cos(tilt) + 1.6) / th, 6.5);
  camera.position.set(0, Math.cos(tilt) * d, Math.sin(tilt) * d); camera.lookAt(0, 0, 0.12);
}
addEventListener('resize', fit);

function build() {
  const seed = D.seed ? D.seed + sessionLv * 31 : level * 7919 + 7, r = rng(seed), fk = F.k();
  applyPalette(palette(level));
  cards.forEach(c => scene.remove(c.g)); cards = [];
  if (tray) scene.remove(tray);
  [cols, rows] = LAYOUT[Math.min(level - 1, LAYOUT.length - 1)];
  pairs = cols * rows / 2;
  // animals: shuffle all, take `pairs`
  const pool = [...NAMES]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const deck = pool.slice(0, pairs).flatMap(n => [n, n]);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const bt = backTex[(level - 1) % backTex.length];
  const tw = cols * (CW + GAP) + 0.5, thh = rows * (CH + GAP) + 0.5;
  tray = new THREE.Mesh(rounded(tw, thh, 0.3, 0.25).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, opacity: 0.55 }));
  tray.position.y = 0.05; tray.receiveShadow = true; scene.add(tray);
  deck.forEach((name, i) => {
    const cx = (i % cols - (cols - 1) / 2) * (CW + GAP), cz = (Math.floor(i / cols) - (rows - 1) / 2) * (CH + GAP);
    const g = new THREE.Group(); g.position.set(cx, 0.3, cz);
    const inner = new THREE.Group(); g.add(inner);
    const body = new THREE.Mesh(CARD, EDGE); body.castShadow = true;
    const back = new THREE.Mesh(PLANE_UP, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5, transparent: true })); back.position.y = TH / 2 + 0.004;
    const face = new THREE.Mesh(PLANE_DN, new THREE.MeshStandardMaterial({ map: faceFor(name), roughness: 0.5, transparent: true })); face.position.y = -TH / 2 - 0.004;
    inner.add(body, back, face); scene.add(g);
    cards.push({ g, inner, body, name, i, up: false, p: 0, v: 0, done: false, shake: 0, hop: 0, appear: -i * 0.04 });
  });
  // knobs: hearts budget (easier when bigger -> / fk) and peek time (easier when bigger -> / fk)
  heartsMax = hearts = Math.max(2, Math.round((pairs * 1.4 + 2) / fk));
  peekT = clamp((1.0 + pairs * 0.22) / fk, 0.8, 4.5); peeking = true;
  matched = 0; first = null; lock = 0; streak = 0; misses = 0; recorded = false; botSeen = new Map();
  ui.levels(level); ui.progress(0); ui.score(score); showHearts(); fit();
}
const heartEl = document.createElement('div');
heartEl.style.cssText = 'position:fixed;top:calc(62px + env(safe-area-inset-top));left:14px;z-index:5;pointer-events:none;font-size:22px;font-weight:800;background:rgba(255,255,255,.55);border-radius:20px;padding:2px 12px;color:#ff4d6d;text-shadow:none;transition:transform .15s';
document.body.appendChild(heartEl);
function showHearts() { heartEl.textContent = hearts > 5 ? `❤️ ${hearts}` : '❤️'.repeat(Math.max(0, hearts)) || '🤍'; heartEl.style.transform = 'scale(1.25)'; setTimeout(() => heartEl.style.transform = '', 160); }

// ---------------------------------------------------------------- sounds: each animal has its own little tune (no voices)
function jingle(name, vol = 0.14) {
  const k = NAMES.indexOf(name), base = 62 + (k * 5) % 14, pat = [[0, 4, 7], [0, 7, 12], [7, 4, 0, 12], [0, 3, 7, 10], [12, 7, 12], [0, 5, 9]][k % 6];
  pat.forEach((s, i) => setTimeout(() => note(base + s, 0.22, vol), i * 85));
}
const flipSound = () => { tone(520 + Math.random() * 80, 0.06, 'triangle', 0.1, 1.5); tone(200, 0.03, 'sine', 0.06, 1); };

function flip(c) {
  if (state !== 'play' || peeking || lock > 0 || c.up || c.done) return;
  c.up = true; c.v += 0.02; flipSound(); buzz(6); botSeen.set(c.i, c.name);
  if (!first) { first = c; return; }
  const a = first; first = null;
  if (a.name === c.name) {
    a.done = c.done = true; matched++; streak++;
    const pts = 10 + (streak > 1 ? 5 * (streak - 1) : 0); score += pts; ui.score(score);
    setTimeout(() => {
      for (const k of [a, c]) { k.hop = 1; k.body.material = GOLD; burst(scene, k.g.position.clone().setY(0.8), ['#ffd23f', '#ffffff', '#ff5d8f'], 14, { speed: 0.08, up: 0.1, size: 0.5, shape: 'sphere', gravity: 0.006 }); }
      jingle(c.name); buzz(14); ui.flash(0.1);
      ui.pop(streak >= 3 ? '⭐⭐⭐' : streak === 2 ? '⭐⭐' : '⭐', '#fff', 42, 24);
      if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 2, 0), 50); }
      ui.progress(matched / pairs);
      if (matched === pairs) win();
    }, 260);
  } else {
    streak = 0; lock = 1; misses++;
    setTimeout(() => { for (const k of [a, c]) k.shake = 1; tone(300, 0.12, 'sine', 0.1, 0.8); setTimeout(() => tone(240, 0.14, 'sine', 0.1, 0.8), 90); }, 380);
    setTimeout(() => {
      a.up = c.up = false; lock = 0; hearts--; showHearts();
      if (hearts <= 0) lose();
    }, 1000);
  }
}

function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); }
  const stars = misses <= pairs * 0.4 ? 3 : misses <= pairs ? 2 : 1;
  const done = level; level++; sessionLv++; if (!D.seed) S.set('level', level);
  best = Math.max(best, score); S.set('best', best);
  confetti(scene, new THREE.Vector3(0, 2, 0), 100); buzz([20, 30, 20]);
  for (const c of cards) setTimeout(() => c.hop = 1, 100 + c.i * 40);
  [0, 4, 7, 12, 16, 19].forEach((s, i) => setTimeout(() => note(72 + s, 0.35, 0.15), i * 90));
  D.won(score); ui.win(done, '⭐'.repeat(stars));
}
function lose() {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, matched / pairs); }
  best = Math.max(best, score); S.set('best', best);
  for (const c of cards) if (!c.done) c.up = true;          // show where everyone was hiding
  [67, 64, 60].forEach((n, i) => setTimeout(() => note(n, 0.4, 0.12), i * 160));
  ui.lose('Try again!', '💪 🙂');
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(cards.map(c => c.body), false);
  let c = hits.length ? cards.find(k => k.body === hits[0].object) : null;
  if (!c) {   // forgiving: nearest card within half a card of the tap on the table plane
    const p = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3), p)) {
      let bd = 0.85; for (const k of cards) { const d = Math.hypot(k.g.position.x - p.x, k.g.position.z - p.z); if (d < bd) { bd = d; c = k; } } }
  }
  if (c) flip(c);
});
ui.onTap((which) => { if (which === 'lose') score = 0; build(); state = 'play'; ui.hideStart(); });

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  now = t;
  if (state === 'play' && peeking) {
    peekT -= dt / 60;
    const showing = peekT > 0;
    for (const c of cards) { if (c.appear < 0) continue; if (showing && !c.up) { c.up = true; botSeen.set(c.i, c.name); } }
    if (!showing) { cards.forEach(c => c.up = false); peeking = false; tone(700, 0.08, 'triangle', 0.08, 0.6); }
  }
  for (const c of cards) {
    c.appear = Math.min(1, c.appear + dt * 0.06);
    const a = clamp(c.appear, 0, 1), k = 1 - Math.pow(1 - a, 3);
    const tgt = c.up ? 1 : 0; c.v += (tgt - c.p) * 0.06 * dt; c.v *= Math.pow(0.78, dt); c.p += c.v * dt;
    c.hop = Math.max(0, c.hop - dt * 0.04); c.shake = Math.max(0, c.shake - dt * 0.05);
    c.inner.rotation.z = c.p * Math.PI;
    c.inner.position.y = Math.sin(clamp(c.p, 0, 1) * Math.PI) * 0.55 + Math.sin(c.hop * Math.PI) * 0.5;
    c.inner.position.x = Math.sin(c.shake * 30) * 0.08 * c.shake;
    const s = k * (1 + Math.sin(c.hop * Math.PI) * 0.12); c.g.scale.setScalar(Math.max(0.001, s));
  }
});

build(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // a kid with a great memory: uses only cards it has actually seen face up
    if (state !== 'play' || peeking || lock > 0) return;
    const open = cards.filter(c => !c.done && !c.up);
    const unseen = open.filter(c => !botSeen.has(c.i));
    const partner = (c) => open.find(k => k !== c && botSeen.get(k.i) === c.name);
    let pick = null;
    if (first) pick = partner(first) || unseen[0] || open[0];
    else { for (const c of open) if (botSeen.has(c.i) && partner(c)) { pick = c; break; } pick = pick || unseen[0] || open[0]; }
    if (pick) flip(pick);
  },
};

// Burrowbop — whack-the-critter in a 3D garden. Grubbles pop out of their burrows: bop them before they duck back down.
// Don't bop the bunnies (they're friends). 45-second rounds; at 20 s the garden grows from 3×3 to 4×4 burrows.
// Combos multiply points. Today's score = your best round.
import { THREE, createStage, createUI, store, loop, buzz, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';

const NAME = 'Burrowbop: Whack a Critter Game';
const S = store('burrowbop');
let best = S.get('best', 0), rounds = S.get('rounds', 0);
const F = flow('burrowbop', { par: 420, warmup: 120 });
const ROUND = 45, GROW = 20;
const STARS = [300, 700, 1200];

const stage = createStage({ fov: 40, shadowSize: 9 });
const { scene, camera, sun, hemi } = stage;
sun.position.set(4, 14, 7); sun.intensity = 1.55; hemi.intensity = 1.2;
const ui = createUI({ title: 'BURROW<br>BOP', hint: 'Bop the grubbles!<br><small style="font-size:16px;opacity:.9">not the bunnies 🐰</small>', hand: '🔨' });
const D = daily('burrowbop', ui, { name: NAME });
const B = board({ game: 'burrowbop', label: 'Points', limits: { maxRun: 4500, maxPerSec: 160 }, corner: 'tl' });
{ const s = document.body.style; s.setProperty('--bg1', '#9fdcff'); s.setProperty('--bg2', '#e9f9ff'); s.setProperty('--ui', '#ff7a3d'); }
{ const p = document.createElement('p'); p.textContent = 'whack-the-critter · 45-second rounds'; p.style.cssText = 'font-size:17px;opacity:.95;margin-top:6px'; ui.els.start.querySelector('h1').after(p); }
ui.els.win.querySelector('h1').textContent = 'GREAT BOPPING!'; ui.els.win.classList.add('dim'); ui.els.win.querySelector('p').innerHTML = 'ROUND <span data-l>1</span>';
ui.els.lose.querySelector('[data-x]').style.maxWidth = '340px';
const css = document.createElement('style'); css.textContent = `
.bb-float{position:fixed;z-index:7;pointer-events:none;font-weight:800;transform:translate(-50%,-50%);text-shadow:0 2px 0 rgba(60,30,10,.55),0 0 6px rgba(60,30,10,.45);-webkit-text-stroke:1px rgba(60,30,10,.35);animation:bbup .8s ease-out forwards;white-space:nowrap}
@keyframes bbup{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}20%{opacity:1;transform:translate(-50%,-60%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-160%) scale(1)}}
.hc-sub{font-size:17px}
#bb-combo{position:fixed;left:0;right:0;bottom:calc(26px + env(safe-area-inset-bottom));text-align:center;font-weight:800;font-size:22px;pointer-events:none;z-index:5;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.15);transition:transform .12s}
`; document.head.appendChild(css);
const comboEl = document.createElement('div'); comboEl.id = 'bb-combo'; document.body.appendChild(comboEl);

// ---------------------------------------------------------------- garden
function grassTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#7fd36a' : '#8fdc78'; x.fillRect(i * 32, j * 32, 32, 32); }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${40 + Math.random() * 40},${120 + Math.random() * 60},40,.25)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const gT = grassTex();
const garden = new THREE.Mesh(rounded(10, 1, 10, 0.4), mat('#ffffff', { map: gT }));
garden.position.y = -0.86; garden.receiveShadow = true; scene.add(garden);
const soil = new THREE.Mesh(rounded(10.3, 1.2, 10.3, 0.45), mat('#b9825a')); soil.position.y = -1.2; scene.add(soil);
const decor = new THREE.Group(); scene.add(decor);
{ // meadow around the garden, fading into the sky
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(150,222,120,1)'); gr.addColorStop(0.55, 'rgba(170,232,140,.9)'); gr.addColorStop(1, 'rgba(200,240,190,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = -1.9; scene.add(m);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.18 })); sh.rotation.x = -Math.PI / 2; sh.position.y = -1.88; sh.receiveShadow = true; scene.add(sh);
}
{ // fence posts, flowers, bushes around the rim (drawn once)
  const postG = rounded(0.28, 0.9, 0.28, 0.06), postM = mat('#fff3df'), railM = mat('#f5e2c6');
  const r = rng(42);
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group(); side.rotation.y = k * Math.PI / 2; decor.add(side);
    for (let i = -4; i <= 4; i += 2) { const p = new THREE.Mesh(postG, postM); p.position.set(i, 0.45, -4.85); p.castShadow = true; side.add(p); }
    const rail = new THREE.Mesh(rounded(8.6, 0.16, 0.12, 0.05), railM); rail.position.set(0, 0.62, -4.85); side.add(rail);
  }
  const petal = new THREE.SphereGeometry(0.11, 10, 8), cols = ['#ff7eb3', '#ffd23f', '#ffffff', '#b18cff', '#ff8c42'];
  for (let i = 0; i < 26; i++) {
    const f = new THREE.Group(), a = r() * Math.PI * 2, rad = 4.25 + r() * 0.35;
    const x = clamp(Math.cos(a) * rad * 1.15, -4.5, 4.5), z = clamp(Math.sin(a) * rad * 1.15, -4.5, 4.5);
    const pm = mat(cols[i % cols.length]);
    for (let j = 0; j < 5; j++) { const p = new THREE.Mesh(petal, pm); p.position.set(Math.cos(j * 1.256) * 0.12, 0.25, Math.sin(j * 1.256) * 0.12); f.add(p); }
    const c = new THREE.Mesh(petal, mat('#ffcf3a')); c.position.y = 0.27; c.scale.setScalar(0.8); f.add(c);
    f.position.set(x, 0, z); decor.add(f);
  }
  const bushM = mat('#5fbf5a');
  for (const [x, z, s] of [[-4.3, 4.2, 0.8], [4.4, 4.1, 0.7], [-4.4, -4.3, 0.75], [4.3, -4.4, 0.85]]) {
    const b = new THREE.Group(); for (let j = 0; j < 3; j++) { const m = new THREE.Mesh(new THREE.SphereGeometry(s * (0.7 - j * 0.12), 16, 12), bushM); m.position.set(j * 0.35 - 0.3, s * 0.4, (j % 2) * 0.2); m.castShadow = true; b.add(m); }
    b.position.set(x, 0, z); decor.add(b);
  }
}

// ---------------------------------------------------------------- burrows
const HOLE_R = 0.78;
const holeG = new THREE.CircleGeometry(HOLE_R, 32); holeG.rotateX(-Math.PI / 2);
const moundG = new THREE.TorusGeometry(HOLE_R + 0.06, 0.2, 10, 32); moundG.rotateX(Math.PI / 2);
const holeM = new THREE.MeshBasicMaterial({ color: '#3b2416' }), moundM = mat('#a46b45', { roughness: 0.9 });
let holes = [], gridN = 3;
function buildHoles(n, animate) {
  holes.forEach(h => { scene.remove(h.g); if (h.c) hideCritter(h.c); });
  holes = []; gridN = n;
  const sp = n === 3 ? 2.55 : 2.05;
  for (let i = 0; i < n * n; i++) {
    const g = new THREE.Group(); g.position.set((i % n - (n - 1) / 2) * sp, 0, (((i / n) | 0) - (n - 1) / 2) * sp);
    const h = new THREE.Mesh(holeG, holeM); h.position.y = 0.012; g.add(h);
    const m = new THREE.Mesh(moundG, moundM); m.position.y = 0.04; m.scale.set(1, 1, 0.55); m.receiveShadow = true; g.add(m);
    if (n === 4) g.scale.setScalar(0.86);
    scene.add(g);
    holes.push({ g, i, c: null, cool: 0, appear: animate ? -i * 0.05 : 1 });
  }
}

// ---------------------------------------------------------------- critters (pooled per kind)
const EYE = new THREE.SphereGeometry(0.11, 14, 10), PUP = new THREE.SphereGeometry(0.065, 10, 8);
const white = mat('#ffffff'), black = glossy('#1f1a24');
function eyes(g, y, z, sx = 0.17) {
  const out = [];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(EYE, white); e.position.set(s * sx, y, z); e.scale.set(1, 1.15, 0.7); const p = new THREE.Mesh(PUP, black); p.position.set(s * sx, y - 0.01, z + 0.08); g.add(e, p); out.push(e, p); }
  return out;
}
function makeCritter(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const furC = kind === 'gold' ? '#ffcc33' : kind === 'bunny' ? '#ffffff' : '#a9775a';
  const fur = kind === 'gold' ? glossy(furC, { metalness: 0.45, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.25 }) : mat(furC);
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.7, 8, 18), fur); b.position.y = 0.2; b.castShadow = true; body.add(b);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), mat(kind === 'bunny' ? '#ffe3ec' : kind === 'gold' ? '#fff0a8' : '#e8c7a5'));
  belly.position.set(0, 0.15, 0.3); belly.scale.set(1, 1.2, 0.6); body.add(belly);
  const eyeY = 0.72;
  g.eyes = eyes(body, eyeY, 0.44);
  if (kind === 'bunny') {
    const earM = mat('#ffffff'), inM = mat('#ffb3c8');
    g.ears = [];
    for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 0.22, 1.05, 0); piv.rotation.z = -s * 0.18; body.add(piv);
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.62, 6, 12), earM); e.position.y = 0.4; e.castShadow = true; piv.add(e);
      const n = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), inM); n.position.set(0, 0.4, 0.07); piv.add(n); g.ears.push(piv); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat('#ff7aa2')); nose.position.set(0, 0.57, 0.55); body.add(nose);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 16), mat('#ff5d8f')); bow.position.set(0.28, 1.05, 0.2); body.add(bow);
  } else {
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat('#ffb3a7')); snout.position.set(0, 0.52, 0.5); snout.scale.set(1.25, 0.85, 0.9); body.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), glossy('#3a2230')); nose.position.set(0, 0.58, 0.7); body.add(nose);
    const tooth = new THREE.Mesh(rounded(0.16, 0.14, 0.05, 0.02), white); tooth.position.set(0, 0.33, 0.6); body.add(tooth);
    for (const s of [-1, 1]) { const paw = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat('#ffb3a7')); paw.position.set(s * 0.4, 0.05, 0.42); paw.scale.set(1, 0.7, 0.8); body.add(paw); }
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), fur); ear.position.set(s * 0.42, 1.0, 0); ear.scale.set(1, 1, 0.5); body.add(ear); }
    if (kind === 'cap') {   // an acorn cap: takes two bops
      const cap = new THREE.Group(); cap.position.y = 1.02; body.add(cap);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a5a2b', { roughness: 0.8 })); dome.scale.set(1.1, 0.7, 1.1); dome.castShadow = true; cap.add(dome);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.07, 8, 24), mat('#6e4520')); rim.rotation.x = Math.PI / 2; cap.add(rim);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 8), mat('#6e4520')); stem.position.y = 0.42; cap.add(stem);
      g.cap = cap;
    }
    if (kind === 'gold') { const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.8 })); sp.position.set(0.45, 1.15, 0.2); body.add(sp); g.spark = sp; }
  }
  // dizzy stars (shown after a bop)
  const dz = new THREE.Group(); dz.position.y = 1.3; body.add(dz); dz.visible = false;
  for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glossy('#ffd23f', { emissive: '#ffb800', emissiveIntensity: 0.4 })); s.position.set(Math.cos(k * 2.09) * 0.4, 0, Math.sin(k * 2.09) * 0.4); dz.add(s); }
  g.dizzy = dz; g.body = body; g.kind = kind; g.scale.setScalar(1.12);
  scene.add(g); return g;
}
const pool = { grub: [], cap: [], gold: [], bunny: [] };
function getCritter(kind) { const g = pool[kind].pop() || makeCritter(kind); g.visible = true; if (g.cap) g.cap.visible = true; g.dizzy.visible = false; g.body.scale.set(1, 1, 1); g.body.rotation.set(0, 0, 0); return g; }
function hideCritter(c) { c.m.visible = false; pool[c.kind].push(c.m); }

// ---------------------------------------------------------------- mallet
const mallet = new THREE.Group(); scene.add(mallet); mallet.visible = false;
{
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 12), mat('#e2b07a')); handle.position.set(0, 0, 0.95); handle.rotation.x = Math.PI / 2; handle.castShadow = true; mallet.add(handle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 24), glossy('#ff5a4f')); head.rotation.z = Math.PI / 2; head.castShadow = true; mallet.add(head);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 24), glossy('#ffffff')); cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.5; mallet.add(cap); }
}
let malletT = 1, malletPos = new THREE.Vector3();

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, time = 0, combo = 0, bestCombo = 0, spawnT = 0, r = Math.random, recorded = false, beatenShown = false, grown = false, hits = 0, misses = 0, camD = 0;
function startRound() {
  rounds++; S.set('rounds', rounds);
  r = D.seed ? rng(D.seed * 3 + 1) : rng((Date.now() ^ rounds * 7919) % 2147483646 + 1);
  score = 0; time = 0; combo = 0; bestCombo = 0; spawnT = 0.6; recorded = false; grown = false; hits = 0; misses = 0;
  buildHoles(3, true); ui.score(0); ui.levels(rounds); ui.progress(1); showCombo();
  state = 'play'; B.start();
}
function spawn() {
  const free = holes.filter(h => !h.c && h.cool <= 0 && h.appear >= 1);
  if (!free.length) return;
  const h = free[Math.floor(r() * free.length)];
  const roll = r(), t = time;
  const kind = t > 4 && roll < 0.15 ? 'bunny' : roll < 0.22 ? 'gold' : t > 9 && roll < 0.36 ? 'cap' : 'grub';
  const fk = F.k(score);
  const up = clamp(lerp(1.3, 0.72, t / ROUND) / fk, 0.5, 1.6) * (kind === 'gold' ? 0.62 : kind === 'bunny' ? 1.25 : kind === 'cap' ? 1.3 : 1);
  const m = getCritter(kind); m.position.copy(h.g.position); m.position.y = -1.6; m.rotation.y = (r() - 0.5) * 0.5;
  h.c = { m, kind, h, t: 0, up, rise: 0, hp: kind === 'cap' ? 2 : 1, bopped: 0, gone: false, look: r() * 6 };
  tone(kind === 'gold' ? 880 : 300 + r() * 80, 0.06, 'sine', 0.05, 1.6);
}
const proj = new THREE.Vector3();
function floater(pos, text, color = '#fff', size = 30) {
  proj.copy(pos).project(camera);
  const d = document.createElement('div'); d.className = 'bb-float'; d.textContent = text; d.style.color = color; d.style.fontSize = size + 'px';
  d.style.left = ((proj.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - proj.y) / 2 * innerHeight) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 820);
}
const mult = () => Math.min(4, 1 + Math.floor(combo / 5));
function showCombo() { const m = mult(); comboEl.textContent = combo >= 2 ? `🔥 ${combo} combo · ×${m}` : ''; comboEl.style.transform = 'scale(1.2)'; setTimeout(() => comboEl.style.transform = '', 120); }
function swing(at) { malletPos.copy(at); malletT = 0; mallet.visible = true; }

function bop(h) {
  const c = h.c; swing(h.g.position);
  if (!c || c.gone || c.rise < 0.3) {   // whiff: a dirt puff, combo lost
    misses++; burst(scene, h.g.position.clone().setY(0.2), ['#a46b45', '#c89066'], 8, { speed: 0.06, up: 0.08, size: 0.6, gravity: 0.008 });
    tone(180, 0.06, 'triangle', 0.08, 0.7); if (combo) { combo = 0; showCombo(); } return;
  }
  const top = c.m.position.clone().setY(1.6);
  if (c.kind === 'bunny') {
    c.gone = true; c.bopped = 1; combo = 0; showCombo();
    score = Math.max(0, score - 20); ui.score(score);
    floater(top, '−20 friend!', '#ff4d6d', 28); ui.flash(0.25); buzz([30, 30, 30]);
    tone(330, 0.15, 'square', 0.08, 0.6); setTimeout(() => tone(240, 0.2, 'square', 0.07, 0.6), 110);
    c.m.dizzy.visible = true; return;
  }
  c.hp--;
  if (c.hp > 0) {   // knocked the acorn cap off
    c.m.cap.visible = false; burst(scene, top, ['#8a5a2b', '#6e4520'], 10, { speed: 0.1, up: 0.12, size: 0.8 });
    score += 5 * mult(); ui.score(score); floater(top, '+' + 5 * mult(), '#fff', 26); tone(520, 0.08, 'square', 0.08, 0.6); buzz(10); c.t = Math.min(c.t, 0.25); return;
  }
  c.gone = true; c.bopped = 1; hits++; combo++; bestCombo = Math.max(bestCombo, combo);
  const base = c.kind === 'gold' ? 30 : c.kind === 'cap' ? 20 : 10, pts = base * mult();
  score += pts; ui.score(score); showCombo();
  c.m.dizzy.visible = true;
  burst(scene, top, c.kind === 'gold' ? ['#ffd23f', '#ffffff', '#ffb800'] : ['#ffd23f', '#ffffff', '#ff7eb3'], c.kind === 'gold' ? 24 : 12, { speed: 0.12, up: 0.12, size: 0.6, shape: 'sphere', gravity: 0.007 });
  floater(top, '+' + pts, c.kind === 'gold' ? '#ffe066' : '#fff', c.kind === 'gold' ? 38 : 30);
  tone(c.kind === 'gold' ? 990 : 640 + Math.min(combo, 12) * 30, 0.09, 'square', 0.09, 0.5); tone(140, 0.08, 'sine', 0.12, 0.5);
  buzz(c.kind === 'gold' ? [15, 20, 15] : 12);
  if (combo > 0 && combo % 8 === 0) { ui.pop(['BOP-TASTIC!', 'ON FIRE!', 'UNSTOPPABLE!'][(combo / 8 - 1) % 3], '#fff', 38, 26); }
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 42, 30); confetti(scene, new THREE.Vector3(0, 3, 0), 50); }
}
function endRound() {
  state = score >= STARS[0] ? 'won' : 'lost';
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms: ROUND * 1000 }); }
  const newBest = score > best; if (newBest) { best = score; S.set('best', best); }
  holes.forEach(h => { if (h.c) h.c.gone = true; });
  const stars = STARS.filter(s => score >= s).length;
  const line = `${score} pts · combo ${bestCombo}${newBest ? ' · new best!' : ` · best ${best}`}`; ui.sub('');
  if (state === 'won') {
    confetti(scene, new THREE.Vector3(0, 3, 0), 110); buzz([20, 40, 20]);
    [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(67 + s, 0.3, 0.14), i * 90));
    D.won(score); ui.win(rounds, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${line}`);
  } else {
    [64, 60, 55].forEach((n, i) => setTimeout(() => note(n, 0.35, 0.1), i * 150));
    ui.lose("TIME'S UP!", `${line} · ${STARS[0]} for a star`);
  }
  comboEl.textContent = '';
}
ui.onTap(() => startRound());
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first round, until the first
// touch, the mallet bops three popped-up critters (never a bunny); the points, combo and clock time are handed back
const demoPick = () => holes.find(h => h.c && !h.c.gone && h.c.kind !== 'bunny' && h.c.rise > 0.55 && h.c.t > 0.3);
demo(() => {
  const h = demoPick(); if (!h) return;
  const s0 = score; bop(h); score = s0; combo = 0; hits = Math.max(0, hits - 1); time = 0; ui.score(score); showCombo();
}, { ready: () => state === 'play' && rounds === 1 && !!demoPick(), wait: 400, every: 500, max: 3, ms: 15000 });

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), hit = new THREE.Vector3();
function holeAt(px, py) {
  ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  // prefer a critter body under the finger, then the nearest burrow on the ground
  const bodies = holes.filter(h => h.c && !h.c.gone).map(h => h.c.m);
  const hits = ray.intersectObjects(bodies, true);
  if (hits.length) { let o = hits[0].object; while (o.parent && !bodies.includes(o)) o = o.parent; const h = holes.find(h => h.c && h.c.m === o); if (h) return h; }
  if (!ray.ray.intersectPlane(plane, hit)) return null;
  let bh = null, bd = gridN === 3 ? 1.25 : 1.0;
  for (const h of holes) { const d = Math.hypot(h.g.position.x - hit.x, h.g.position.z - hit.z); if (d < bd) { bd = d; bh = h; } }
  return bh;
}
addEventListener('pointerdown', e => { if (state !== 'play') return; const h = holeAt(e.clientX, e.clientY); if (h) bop(h); });

// ---------------------------------------------------------------- camera
function fit(dt = 1, snap = false) {
  const portrait = camera.aspect < 0.8, span = gridN === 3 ? 9.7 : 10.1, vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2), tilt = portrait ? 0.66 : 0.8;
  const want = Math.max((span / 2) / (th * camera.aspect), span * 0.62 / th) + 1.2;
  camD = snap || !camD ? want : lerp(camD, want, 0.05 * dt);
  camera.position.set(0, Math.cos(tilt) * camD, Math.sin(tilt) * camD + 0.4); camera.lookAt(0, 0, portrait ? 1.3 : -1.2);
}

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  const s = dt / 60;
  if (state === 'play') {
    time += s;
    if (!grown && time >= GROW) { grown = true; buildHoles(4, true); ui.pop('GARDEN GROWS!', '#fff', 36, 26); tone(523, 0.1, 'triangle', 0.1, 1.5); setTimeout(() => tone(784, 0.15, 'triangle', 0.1, 1.2), 100); buzz(20); }
    spawnT -= s;
    if (spawnT <= 0) { const fk = F.k(score); spawn(); if (grown && r() < 0.35) spawn(); spawnT = clamp(lerp(0.95, 0.42, time / ROUND) / fk, 0.3, 1.1); }
    const left = Math.max(0, ROUND - time);
    ui.progress(left / ROUND); ui.sub(`⏱ ${Math.ceil(left)}s${left < 10 ? ' · hurry!' : ''}`);
    if (left <= 0) endRound();
  }
  for (const h of holes) {
    h.cool -= s; h.appear = Math.min(1, h.appear + s * 3);
    const a = clamp(h.appear, 0, 1); h.g.scale.setScalar((gridN === 4 ? 0.86 : 1) * (a < 1 ? Math.sin(a * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1));
    const c = h.c; if (!c) continue;
    c.t += s;
    let target = c.gone || c.t > c.up ? 0 : 1;
    if (c.bopped) { c.bopped += s; target = c.bopped > 0.45 ? 0 : c.rise; c.m.body.scale.set(1.25, Math.max(0.45, 1 - Math.min(1, c.bopped * 8) * 0.55), 1.25); c.m.dizzy.rotation.y += 0.2 * dt; }
    c.rise += (target - c.rise) * Math.min(1, (target > c.rise ? 0.28 : 0.2) * dt);
    if (!c.bopped && c.rise > 0.5 && !c.gone) { c.m.body.rotation.z = Math.sin(t * 6 + c.look) * 0.08; c.m.body.scale.y = 1 + Math.sin(t * 9 + c.look) * 0.03; if (c.m.ears) c.m.ears.forEach((e, k) => e.rotation.z = (k ? -1 : 1) * (0.18 + Math.sin(t * 5 + k) * 0.12)); if (c.m.spark) c.m.spark.rotation.y += 0.15 * dt; }
    c.m.position.y = -2.2 + c.rise * 2.3;
    if (!c.gone && c.t > c.up && c.rise < 0.05) { // escaped
      if (c.kind !== 'bunny' && state === 'play') { if (combo) { combo = 0; showCombo(); } floater(h.g.position.clone().setY(0.6), 'missed', 'rgba(255,255,255,.85)', 18); }
      c.gone = true;
    }
    if (c.gone && c.rise < 0.03) { hideCritter(c); h.c = null; h.cool = 0.25; }
  }
  // mallet swing: raise → slam → lift
  if (mallet.visible) {
    malletT += s * 7;
    const k = malletT < 0.4 ? malletT / 0.4 : malletT < 1 ? 1 : Math.max(0, 1 - (malletT - 1) * 1.5);
    mallet.position.set(malletPos.x + 0.15, 1.35 + (1 - k) * 0.9, malletPos.z + 0.25);
    mallet.rotation.set(-(1 - k) * 1.0, -0.35, 0);
    if (malletT > 1.7) mallet.visible = false;
  }
  fit(dt);
});

buildHoles(3, false); fit(1, true); ui.score(0); ui.start();
window.__game = {
  get state() { return state; }, get level() { return rounds; }, get score() { return score; },
  bot() {   // a quick human: bops grubbles that have been up for a moment, leaves the bunnies alone
    if (state !== 'play' || Math.random() < 0.4) return;
    const ready = holes.filter(h => h.c && !h.c.gone && h.c.kind !== 'bunny' && h.c.rise > 0.55 && h.c.t > 0.38);
    if (!ready.length) return;
    if (Math.random() < 0.07) { bop(holes[Math.floor(Math.random() * holes.length)]); return; }   // the odd fumble
    ready.sort((a, b) => (b.c.kind === 'gold') - (a.c.kind === 'gold') || b.c.t - a.c.t);
    bop(ready[0]);
  },
};

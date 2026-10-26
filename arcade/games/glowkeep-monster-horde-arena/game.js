// Glowkeep — original horde-survival arena. Drag to move; Lumo's lantern magic fights on its own.
// Gloomlings pour in from every side; they drop light gems, gems level you up, every level-up is a pick of three upgrades.
// Hold out until the timer runs out.
import { THREE, createStage, createUI, store, loop, buzz, tone, note, confetti, lerp, clamp, rng, rounded, mat } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';

const S = store('glowkeep');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('glowkeep');
const stage = createStage({ fov: 44, shadowSize: 12 });
const { scene, camera, sun, hemi } = stage;
const ui = createUI({ title: 'GLOW<br>KEEP', hint: 'Tap where to walk · or drag · magic is automatic', hand: '👆' });
const D = daily('glowkeep', ui, { name: 'Glowkeep: Monster Horde Arena' });
const B = board({ game: 'glowkeep', label: 'Levels survived', limits: { maxRun: 2, maxPerSec: 0.15 }, mode: 'sum' });   // world board: levels survived today (RULES.md)

const LOOKS = [
  { bg: ['#bfe8a8', '#e6f7c9'], g1: '#bfe3a0', g2: '#b2d993', dot: '#ffffff', ui: '#3ab06b', deco: '#7cc47f' },
  { bg: ['#f6d6a8', '#fff0d1'], g1: '#f0d9a7', g2: '#e7cc94', dot: '#ffe9c2', ui: '#e07a2f', deco: '#d9a066' },
  { bg: ['#c7d7ff', '#e6edff'], g1: '#cfdcf7', g2: '#c0cff0', dot: '#ffffff', ui: '#4d6bff', deco: '#9bb0e8' },
  { bg: ['#ffd1e0', '#ffe9f0'], g1: '#f7d3dd', g2: '#efc3d0', dot: '#ffffff', ui: '#e0457b', deco: '#e79ab4' },
];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3(), _e = new THREE.Euler();

// ---------------------------------------------------------------- endless ground: a tiled texture that scrolls under the camera + wrap-around decor
const TILE = 4;
const gTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(60 / TILE, 60 / TILE); return t; })();
function paintGround(L) {
  const x = gTex.image.getContext('2d'), r = rng(7);
  x.fillStyle = L.g1; x.fillRect(0, 0, 256, 256);
  x.fillStyle = L.g2; x.globalAlpha = 0.6; for (let i = 0; i < 7; i++) { x.beginPath(); x.ellipse(r() * 256, r() * 256, 22 + r() * 26, 14 + r() * 14, r() * 3, 0, 7); x.fill(); } x.globalAlpha = 1;
  x.fillStyle = L.dot; x.globalAlpha = 0.55; for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(r() * 256, r() * 256, 1.5 + r() * 2, 0, 7); x.fill(); } x.globalAlpha = 1;
  gTex.needsUpdate = true;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#ffffff', { map: gTex, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const NDECO = 26, DSPAN = 28;
const decoBush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), mat('#ffffff', { flatShading: true, roughness: 0.8 }), NDECO); decoBush.castShadow = true; scene.add(decoBush);
const decoRock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.4, 0), mat('#ffffff', { flatShading: true }), 18); decoRock.castShadow = true; scene.add(decoRock);
const wrap = (v, c) => c + ((((v - c) % DSPAN) + DSPAN * 1.5) % DSPAN) - DSPAN / 2;
const decoData = [], rockData = [];
{ const r = rng(99), far = (x, z) => Math.abs(wrap(x, 0)) > 1.6 || Math.abs(wrap(z, 0)) > 1.6; for (let i = 0; i < NDECO; i++) { const x = r() * DSPAN, z = r() * DSPAN, sz = 0.3 + r() * 0.45; if (far(x, z)) decoData.push({ x, z, s: sz }); else i--; } for (let i = 0; i < 18; i++) rockData.push({ x: r() * DSPAN, z: r() * DSPAN, s: 0.35 + r() * 0.45, a: r() * 6 }); }

// ---------------------------------------------------------------- hero: Lumo, a little keeper in a yellow raincoat holding a lantern
const hero = new THREE.Group(); scene.add(hero);
const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.32, 6, 14), mat('#ffc93c', { roughness: 0.35 })); coat.position.y = 0.55; coat.castShadow = true; hero.add(coat);
const hood = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), mat('#ffc93c', { roughness: 0.35 })); hood.position.y = 1.08; hood.castShadow = true; hero.add(hood);
const face = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), mat('#ffe0c7')); face.position.set(0, 1.06, 0.12); hero.add(face);
for (const sx of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#2a2140')); e.position.set(sx, 1.08, 0.35); hero.add(e); }
const hoodTip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 10), mat('#ffc93c')); hoodTip.position.set(0, 1.42, -0.12); hoodTip.rotation.x = -0.5; hero.add(hoodTip);
const boots = []; for (const sx of [-0.13, 0.13]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat('#3a86ff')); b.position.set(sx, 0.1, 0.03); b.scale.set(1, 0.8, 1.3); hero.add(b); boots.push(b); }
const lanternG = new THREE.Group(); lanternG.position.set(0.42, 0.55, 0.15); hero.add(lanternG);
const lanternGlass = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff3a0' })); lanternG.add(lanternGlass);
const lanternCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.08, 8), mat('#5b4a7a')); lanternCap.position.y = 0.16; lanternG.add(lanternCap);
const heroLight = new THREE.PointLight('#ffd27a', 3.5, 6, 1.5); heroLight.position.set(0.4, 1.0, 0.2); hero.add(heroLight);
const aura = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 36), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })); aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; hero.add(aura);

// ---------------------------------------------------------------- my hero (Hero Lab): replaces Lumo's look only
// `hero` (position, facing, light, aura, lantern) keeps doing everything; Lumo's body meshes hide and the player's hero
// stands in the scene at the same spot (its own object, so the "fall" can still play after `hero` hides on a loss).
// The game's lantern hangs from whichever hand is free.
const LUMO = hero.children.filter(o => o !== lanternG && o !== heroLight && o !== aura);   // coat, hood, face, eyes, hood tip, boots
let me = null, meTok = 0, meSig, meClip = 'idle', meHand = null, meMats = [];
async function buildMe() {
  const t = ++meTok, h = selectedHero(); meSig = JSON.stringify(h);
  if (me) { me.dispose(); me = null; }
  dressLumo();
  if (!h) return;
  try {
    const next = await loadHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: 1.6, clip: 'idle' });
    if (t !== meTok) { next.dispose(); return; }
    me = next; meClip = 'idle'; scene.add(me.object);
    meHand = !h.items.hand ? me.object.getObjectByName('RightHand') : !h.items.offhand ? me.object.getObjectByName('LeftHand') : null;
    meMats = []; me.object.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => m.emissive && meMats.push([m, m.emissive.clone()])); });
    dressLumo();
  } catch (e) { console.warn('hero', e); }
}
function dressLumo() { LUMO.forEach(o => { o.visible = !me; }); lanternG.visible = !me || !!meHand; if (!me) lanternG.position.set(0.42, 0.55, 0.15); }
const syncMe = () => { if (JSON.stringify(selectedHero()) !== meSig) buildMe(); };
const _hand = new THREE.Vector3();
function animMe(dt, t) {
  if (!me) return;
  const o = me.object; o.position.set(hero.position.x, 0, hero.position.z); o.rotation.y = hero.rotation.y;
  o.visible = state === 'lost' || hero.visible;
  const want = state === 'won' ? 'cheer' : state === 'lost' ? 'fall' : state === 'play' && moving && !picks ? 'run' : 'idle';
  if (want !== meClip) { meClip = want; me.play(want, { fade: 0.15, once: want === 'fall' }); }
  if (want === 'run' && P) me.actions.run.timeScale = clamp(P.speed / 0.085, 0.8, 1.4);
  me.mixer.update(dt / 60);
  const red = state === 'play' && hurtT > 0 && Math.floor(t * 20) % 2; for (const [m, e0] of meMats) red ? m.emissive.setRGB(0.9, 0, 0.15) : m.emissive.copy(e0);
  if (meHand) { o.updateMatrixWorld(true); meHand.getWorldPosition(_hand); _hand.y -= 0.22; hero.updateMatrixWorld(); hero.worldToLocal(lanternG.position.copy(_hand)); }
}

// ---------------------------------------------------------------- horde (instanced): blob body + glowing eyes
const MAXE = 320;
const bodyG = new THREE.CapsuleGeometry(0.3, 0.26, 4, 12); bodyG.translate(0, 0.43, 0);
const bodyMesh = new THREE.InstancedMesh(bodyG, mat('#ffffff', { roughness: 0.45 }), MAXE); bodyMesh.castShadow = true; bodyMesh.frustumCulled = false; scene.add(bodyMesh);
const eyeG = new THREE.SphereGeometry(0.06, 8, 6);
const eyeMesh = new THREE.InstancedMesh(eyeG, new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAXE * 2); eyeMesh.frustumCulled = false; scene.add(eyeMesh);
const hornG = new THREE.ConeGeometry(0.08, 0.2, 6); hornG.translate(0, 0.83, 0);
const hornMesh = new THREE.InstancedMesh(hornG, mat('#ffffff'), MAXE); hornMesh.frustumCulled = false; scene.add(hornMesh);
const KINDS = {
  gloom: { col: '#7b5cc9', eye: '#fff36b', hp: 10, sp: 0.032, r: 0.34, s: 1, dmg: 14, xp: 1 },
  imp:   { col: '#ff6b8b', eye: '#ffffff', hp: 6, sp: 0.054, r: 0.26, s: 0.72, dmg: 10, xp: 1 },
  brute: { col: '#4b3f8f', eye: '#ff9a3c', hp: 60, sp: 0.024, r: 0.62, s: 1.9, dmg: 24, xp: 5 },
};
let foes = [];

// gems, bolts, poofs (instanced)
const MAXG = 360, MAXB = 140, MAXP = 60;
const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.15, 0), new THREE.MeshStandardMaterial({ color: '#4fd8ff', emissive: '#1a8cff', emissiveIntensity: 0.6, roughness: 0.2 }), MAXG); gemMesh.frustumCulled = false; scene.add(gemMesh);
const boltMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff7b0' }), MAXB); boltMesh.frustumCulled = false; scene.add(boltMesh);
const boltGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffc24a', transparent: true, opacity: 0.4, depthWrite: false }), MAXB); boltGlow.frustumCulled = false; scene.add(boltGlow);
const poofMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.4, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAXP); poofMesh.frustumCulled = false; scene.add(poofMesh);
let gems = [], bolts = [], poofs = [];
// weapon visuals
const orbitMeshes = [];
for (let i = 0; i < 6; i++) { const g = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: '#9ff3ff' }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), new THREE.MeshBasicMaterial({ color: '#52d6ff', transparent: true, opacity: 0.35, depthWrite: false })); g.add(core, glow); g.visible = false; scene.add(g); orbitMeshes.push(g); }
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); pulseRing.rotation.x = -Math.PI / 2; pulseRing.position.y = 0.06; scene.add(pulseRing);
const pulseFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ffe57a', transparent: true, opacity: 0, depthWrite: false })); pulseFill.rotation.x = -Math.PI / 2; pulseFill.position.y = 0.05; scene.add(pulseFill);
const beams = []; for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 12, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#d6f0ff', transparent: true, opacity: 0, depthWrite: false })); b.position.y = 6; scene.add(b); beams.push({ m: b, t: 0 }); }

// ---------------------------------------------------------------- DOM
const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
const hpBar = mk('gk-hp', '<i></i>'), joy = mk('gk-joy hc-hidden', '<i></i>'), xpBar = mk('gk-xp', '<i></i><b>LV 1</b>'), killEl = mk('gk-kill'), wpnRow = mk('gk-wpn');
const pickEl = mk('gk-pick hc-hidden', '<h2>LEVEL UP!</h2><div class="gk-cards"></div>');
function screen(x, y, z) { _v.set(x, y, z).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; }

// ---------------------------------------------------------------- upgrades
const UPG = [
  { id: 'spark', icon: '✨', name: 'Spark Bolt', max: 5, d: l => l ? `+1 bolt, fires faster` : 'Bolts fly at the nearest foe' },
  { id: 'orbit', icon: '🔵', name: 'Wisp Ring', max: 5, d: l => l ? '+1 wisp, more damage' : 'Wisps circle you and burn foes' },
  { id: 'pulse', icon: '💥', name: 'Glow Pulse', max: 5, d: l => l ? 'Bigger, stronger, more often' : 'A burst of light knocks foes back' },
  { id: 'thunder', icon: '⚡', name: 'Sky Strike', max: 5, d: l => l ? '+1 strike, more damage' : 'Lightning hits foes on screen' },
  { id: 'swift', icon: '👢', name: 'Quick Boots', max: 3, d: () => 'Move speed +15%' },
  { id: 'vigor', icon: '❤️', name: 'Warm Soup', max: 4, d: () => 'Max HP +25 and heal' },
  { id: 'magnet', icon: '🧲', name: 'Gem Magnet', max: 3, d: () => 'Pick up gems from further' },
  { id: 'fury', icon: '🔥', name: 'Bright Flame', max: 4, d: () => 'All damage +20%' },
  { id: 'haste', icon: '⏱️', name: 'Clockwork', max: 3, d: () => 'Weapons recharge 15% faster' },
];
const BOT_PREF = ['orbit', 'spark', 'pulse', 'thunder', 'vigor', 'fury', 'haste', 'swift', 'magnet'];
let L, P, picks = null;
function freshHero() {
  L = { spark: 1, orbit: 0, pulse: 0, thunder: 0, swift: 0, vigor: 0, magnet: 0, fury: 0, haste: 0 };
  P = { hp: 100, maxHp: 100, speed: 0.085, magnet: 2.2, dmg: 1, haste: 1, xp: 0, lvl: 1, need: 4 };
  CD = { spark: 0.5, pulse: 1.5, thunder: 1 }; refreshWpn();
}
let CD;
function refreshWpn() { wpnRow.innerHTML = UPG.filter(u => L[u.id]).map(u => `<span>${u.icon}${L[u.id] > 1 ? L[u.id] : ''}</span>`).join(''); }
function showPick() {
  const pool = UPG.filter(u => L[u.id] < u.max);
  picks = []; while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rr() * pool.length), 1)[0]);
  if (!picks.length) { picks = null; P.hp = Math.min(P.maxHp, P.hp + 30); return; }
  const box = pickEl.querySelector('.gk-cards'); box.innerHTML = '';
  picks.forEach(u => { const c = document.createElement('div'); c.className = 'gk-card' + (L[u.id] ? '' : ' new');
    c.innerHTML = `<b>${u.icon}</b><div><u>${u.name}</u>${L[u.id] ? `<em>LV ${L[u.id] + 1}</em>` : ''}<small>${u.d(L[u.id])}</small></div>`;
    c.addEventListener('pointerdown', e => { e.stopPropagation(); choose(u); }); box.appendChild(c); });
  pickEl.classList.remove('hc-hidden'); endStick();
  [0, 4, 7, 12].forEach((n, i) => setTimeout(() => note(72 + n, 0.25, 0.12), i * 60)); buzz(15);
}
function choose(u) {
  if (!picks) return; picks = null; pickEl.classList.add('hc-hidden');
  L[u.id]++;
  if (u.id === 'swift') P.speed *= 1.15; if (u.id === 'vigor') { P.maxHp += 25; P.hp = Math.min(P.maxHp, P.hp + 40); }
  if (u.id === 'magnet') P.magnet *= 1.5; if (u.id === 'fury') P.dmg *= 1.2; if (u.id === 'haste') P.haste *= 0.85;
  refreshWpn(); tone(700, 0.1, 'triangle', 0.12, 1.4);
  if (P.xp >= P.need) levelUp();
}
function levelUp() { P.xp -= P.need; P.lvl++; P.need = Math.round(4 + P.lvl * 3 + P.lvl * P.lvl * 0.3); xpBar.querySelector('b').textContent = 'LV ' + P.lvl; showPick(); }

// ---------------------------------------------------------------- run state
let look, state = 'ready', hx = 0, hz = 0, faceA = 0, moving = false, time = 0, dur = 15, score = 0, recorded = false, beatenShown = false;
let spawnAcc = 0, hurtT = 0, shake = 0, rr = Math.random, camX = 0, camZ = 0, killSnd = 0, gemSnd = 0, walk = 0, orbitA = 0, pulseT = 1, win5 = false;
function buildRun() {
  look = LOOKS[(level - 1) % LOOKS.length];
  const bs = document.body.style; bs.setProperty('--bg1', look.bg[0]); bs.setProperty('--bg2', look.bg[1]); bs.setProperty('--ui', look.ui);
  paintGround(look); decoBush.material.color.set('#ffffff');
  decoData.forEach((d, i) => decoBush.setColorAt(i, _c.set(look.deco).offsetHSL(0, 0, (i % 3 - 1) * 0.05))); decoBush.instanceColor.needsUpdate = true;
  rockData.forEach((d, i) => decoRock.setColorAt(i, _c.set('#e9e4f2').offsetHSL(0, 0, (i % 3 - 1) * 0.04))); decoRock.instanceColor.needsUpdate = true;
  rr = rng(D.seed ? D.seed : level * 3307 + 11);
  dur = level === 1 ? 15 : Math.min(60, 18 + level * 7);
  foes = []; gems = []; bolts = []; poofs = []; hx = hz = 0; camX = camZ = 0; time = 0; score = 0; spawnAcc = 0; recorded = false; beatenShown = false;
  freshHero(); xpBar.querySelector('i').style.width = '0%'; xpBar.querySelector('b').textContent = 'LV 1';
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(''); ui.pill(fmt(dur)); hero.visible = true;
}
const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function spawn(kind) {
  if (foes.length >= MAXE) return;
  const K = KINDS[kind], a = rr() * Math.PI * 2, d = 1 + rr() * 0.25;
  const hpMul = 1 + (level - 1) * 0.15 + time / 80;
  foes.push({ kind, K, x: hx + Math.sin(a) * d * 6.4, z: hz + Math.cos(a) * d * 10, hp: K.hp * hpMul, flash: 0, orbHit: 0, kx: 0, kz: 0, t: rr() * 6, born: 0 });
}
function damage(f, d, kx = 0, kz = 0) {
  f.hp -= d * P.dmg; f.flash = 1; f.kx += kx; f.kz += kz;
  if (f.hp <= 0 && !f.dead) {
    f.dead = true; score++;
    gems.length < MAXG && gems.push({ x: f.x, z: f.z, v: f.K.xp, fly: false, t: 0 });
    poofs.length < MAXP && poofs.push({ x: f.x, z: f.z, t: 0, s: f.K.s, col: f.K.col });
    if (killSnd <= 0) { tone(240 + Math.random() * 120, 0.06, 'square', 0.05, 0.5); killSnd = 3; }
    if (f.kind === 'brute') { shake = 0.25; buzz(20); }
    if (D.beaten(score) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, new THREE.Vector3(hx, 1.2, hz), 50); }
  }
}
function nearestFoes(n, range) { return foes.filter(f => !f.dead && Math.abs(f.x - hx) < range && Math.abs(f.z - hz) < range * 1.4).sort((a, b) => ((a.x - hx) ** 2 + (a.z - hz) ** 2) - ((b.x - hx) ** 2 + (b.z - hz) ** 2)).slice(0, n); }
function hurt(d) {
  if (hurtT > 0 || state !== 'play') return;
  P.hp -= d; hurtT = 0.45; shake = 0.2; buzz(25); tone(150, 0.12, 'sawtooth', 0.09, 0.6); ui.flash(0.1);
  if (P.hp <= 0) { P.hp = 0; lose(); }
}
function record(won) { if (recorded) return; recorded = true; if (won) B.submit(1); F.level(won, clamp(time / dur, 0, 1)); }
function win() {
  state = 'won'; record(true); ui.progress(1); endStick();
  for (const f of foes) if (poofs.length < MAXP) poofs.push({ x: f.x, z: f.z, t: -Math.random() * 10, s: f.K.s, col: f.K.col });
  foes = [];
  const total = score + 20 * level; best = Math.max(best, total); S.set('best', best); ui.score(total);
  confetti(scene, new THREE.Vector3(hx, 1.2, hz), 100); ui.flash(0.6); buzz([20, 40, 20]);
  [0, 4, 7, 12, 16].forEach((s, k) => setTimeout(() => note(67 + s, 0.4, 0.15), k * 90));
  D.won(total); ui.win(level, `Survived ${fmt(dur)} · ${score} gloomlings`); level++; S.set('level', level);
}
function lose() {
  state = 'lost'; record(false); endStick(); best = Math.max(best, score); S.set('best', best); hero.visible = false;
  poofs.push({ x: hx, z: hz, t: 0, s: 2, col: '#ffc93c' });
  tone(220, 0.3, 'square', 0.1, 0.5); setTimeout(() => tone(110, 0.4, 'square', 0.1, 0.5), 150); buzz([40, 30, 80]);
  ui.lose('OVERRUN!', `Held out ${fmt(time)} of ${fmt(dur)}`);
}

// ---------------------------------------------------------------- input: floating stick
let stick = null, botVec = null, botUntil = 0, tapGo = null;   // tapGo: a plain tap walks the keeper to that spot
addEventListener('pointerdown', e => { if (state !== 'play' || picks) return; stick = { ox: e.clientX, oy: e.clientY, x: 0, y: 0, sx: e.clientX, sy: e.clientY, far: false }; tapGo = null; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; joy.classList.remove('hc-hidden'); });
addEventListener('pointermove', e => { if (!stick) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), mx = 45; if (l > mx) { stick.ox += dx - dx / l * mx; stick.oy += dy - dy / l * mx; dx = dx / l * mx; dy = dy / l * mx; joy.style.left = stick.ox + 'px'; joy.style.top = stick.oy + 'px'; } stick.x = dx / mx; stick.y = dy / mx; if (Math.hypot(e.clientX - stick.sx, e.clientY - stick.sy) >= 12) stick.far = true; joy.firstChild.style.transform = `translate(${dx}px,${dy}px)`; });
function endStick() { stick = null; joy.classList.add('hc-hidden'); joy.firstChild.style.transform = ''; }
const tapRay = new THREE.Raycaster(), tapNdc = new THREE.Vector2(), tapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tapHit = new THREE.Vector3();
addEventListener('pointerup', e => { const s = stick; endStick(); if (!s || s.far || state !== 'play' || picks) return;
  tapNdc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); tapRay.setFromCamera(tapNdc, camera);
  if (tapRay.ray.intersectPlane(tapPlane, tapHit)) tapGo = { x: tapHit.x, z: tapHit.z, until: performance.now() + 1500 }; }); addEventListener('pointercancel', endStick);
const keys = {}; addEventListener('keydown', e => keys[e.key] = true); addEventListener('keyup', e => keys[e.key] = false);
ui.onTap(() => { B.start(); buildRun(); state = 'play'; });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first touch,
// the keeper walks by itself (the test bot: slip round the gloomlings, scoop up gems), so the arena shows that you move
const DM = demo(null, { ready: () => state === 'play' && level === 1 && !picks && !stick, wait: 1200, ms: 4000 });

// ---------------------------------------------------------------- simulation
const grid = new Map();
function step(dt) {
  const sec = dt / 60, fk = F.k();
  time += sec; ui.pill(fmt(dur - time)); ui.progress(time / dur);
  if (time >= dur) return win();
  // move
  let mx = 0, mz = 0;
  if (stick) { mx = stick.x; mz = stick.y; }
  else if (tapGo) { const dx = tapGo.x - hx, dz = tapGo.z - hz, l = Math.hypot(dx, dz); if (l < 0.25 || performance.now() > tapGo.until) tapGo = null; else { mx = dx / l; mz = dz / l; } }
  else { mx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0); mz = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0); }
  if (DM.on && !picks) window.__game.bot();
  if (!stick && botVec && performance.now() < botUntil) { mx = botVec[0]; mz = botVec[1]; }
  const ml = Math.hypot(mx, mz); moving = ml > 0.15;
  if (moving) { const k = Math.min(1, ml) / ml; hx += mx * k * P.speed * dt; hz += mz * k * P.speed * dt; faceA = Math.atan2(mx, mz); walk += dt * 0.3; }
  // spawn: steady stream that thickens over time, brutes later on
  const rate = (3.2 + time * 0.24 + (level - 1) * 0.8) * fk;
  spawnAcc += rate * sec;
  while (spawnAcc >= 1) { spawnAcc--; const r = rr(); spawn(time > 8 && r < 0.05 + level * 0.01 ? 'brute' : r < 0.3 + Math.min(0.2, level * 0.03) ? 'imp' : 'gloom'); }
  if (Math.floor(time / 9) !== Math.floor((time - sec) / 9) && time > 1) { const n = Math.round((6 + level * 2) * fk); for (let i = 0; i < n; i++) spawn('imp'); ui.pop('SWARM!', '#fff', 34, 24); tone(120, 0.3, 'sawtooth', 0.08, 1.5); }
  // horde: chase + separation via a spatial hash
  grid.clear();
  for (const f of foes) { const k = (Math.floor(f.x) * 73856093) ^ (Math.floor(f.z) * 19349663); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(f); }
  const spk = Math.sqrt(fk);
  for (const f of foes) {
    if (f.dead) continue;
    f.born += dt; f.t += sec;
    const dx = hx - f.x, dz = hz - f.z, d = Math.hypot(dx, dz) || 1, sp = f.K.sp * spk * (f.born < 20 ? f.born / 20 : 1);
    f.x += dx / d * sp * dt + f.kx; f.z += dz / d * sp * dt + f.kz; f.kx *= 0.82; f.kz *= 0.82;
    const gx = Math.floor(f.x), gz = Math.floor(f.z);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const c = grid.get(((gx + ox) * 73856093) ^ ((gz + oz) * 19349663)); if (!c) continue;
      for (const o of c) { if (o === f || o.dead) continue; const ex = f.x - o.x, ez = f.z - o.z, dd = ex * ex + ez * ez, rs = f.K.r + o.K.r;
        if (dd < rs * rs && dd > 1e-6) { const l = Math.sqrt(dd), push = (rs - l) * 0.25; f.x += ex / l * push; f.z += ez / l * push; } } }
    if (d < f.K.r + 0.32) { hurt(f.K.dmg); f.kx -= dx / d * 0.1; f.kz -= dz / d * 0.1; }
    if (d > 20) { const a = rr() * 6.283; f.x = hx + Math.sin(a) * 11; f.z = hz + Math.cos(a) * 12; }
    f.flash = Math.max(0, f.flash - sec * 7);
  }
  // weapons
  for (const k in CD) CD[k] -= sec;
  if (L.spark && CD.spark <= 0) {
    const n = 1 + Math.floor(L.spark / 2) + (L.spark >= 5 ? 1 : 0), tg = nearestFoes(n, 9);
    if (tg.length) { CD.spark = (0.5 - L.spark * 0.04) * P.haste; tone(900, 0.04, 'triangle', 0.05, 1.5);
      for (let i = 0; i < n; i++) { const t = tg[i % tg.length], dx = t.x - hx, dz = t.z - hz, d = Math.hypot(dx, dz) || 1; bolts.length < MAXB && bolts.push({ x: hx + 0.4, z: hz, dx: dx / d, dz: dz / d, life: 70, dmg: 16 + L.spark * 5, pierce: L.spark >= 3 ? 2 : 1 }); } }
  }
  for (const b of bolts) { b.x += b.dx * 0.26 * dt; b.z += b.dz * 0.26 * dt; b.life -= dt;
    for (const f of foes) { if (f.dead) continue; const ex = f.x - b.x, ez = f.z - b.z; if (ex * ex + ez * ez < (f.K.r + 0.15) ** 2 && f !== b.last) { b.last = f; damage(f, b.dmg, b.dx * 0.12, b.dz * 0.12); if (--b.pierce <= 0) { b.life = 0; break; } } } }
  bolts = bolts.filter(b => b.life > 0);
  if (L.orbit) {
    const n = L.orbit + 1, R = 1.75 + L.orbit * 0.08; orbitA += (2.4 + L.orbit * 0.25) * sec;
    for (let i = 0; i < n; i++) { const a = orbitA + i * Math.PI * 2 / n, ox = hx + Math.sin(a) * R, oz = hz + Math.cos(a) * R;
      for (const f of foes) { if (f.dead || f.orbHit > time) continue; const ex = f.x - ox, ez = f.z - oz; if (ex * ex + ez * ez < (f.K.r + 0.36) ** 2) { f.orbHit = time + 0.45; damage(f, 7 + L.orbit * 4, ex * 0.2, ez * 0.2); } } }
  }
  if (L.pulse && CD.pulse <= 0) {
    CD.pulse = (3.2 - L.pulse * 0.3) * P.haste; pulseT = 0; const R = 2.1 + L.pulse * 0.35;
    for (const f of foes) { if (f.dead) continue; const ex = f.x - hx, ez = f.z - hz, d = Math.hypot(ex, ez); if (d < R + f.K.r) damage(f, 10 + L.pulse * 6, ex / d * 0.35, ez / d * 0.35); }
    tone(160, 0.25, 'sine', 0.13, 2); buzz(10); shake = Math.max(shake, 0.1);
  }
  if (L.thunder && CD.thunder <= 0) {
    const cand = nearestFoes(30, 7);
    if (cand.length) { CD.thunder = (2.3 - L.thunder * 0.22) * P.haste;
      for (let i = 0; i < L.thunder; i++) { const f = cand[Math.floor(rr() * cand.length)], bm = beams[i % beams.length]; bm.t = 1; bm.m.position.x = f.x; bm.m.position.z = f.z;
        for (const o of foes) if (!o.dead && (o.x - f.x) ** 2 + (o.z - f.z) ** 2 < 1.1) damage(o, 26 + L.thunder * 10);
        poofs.length < MAXP && poofs.push({ x: f.x, z: f.z, t: 0, s: 1.6, col: '#d6f0ff' }); }
      tone(70, 0.3, 'sawtooth', 0.1, 0.4); shake = Math.max(shake, 0.18); }
  }
  foes = foes.filter(f => !f.dead);
  // gems: drift to the hero inside magnet range
  for (const g of gems) {
    const dx = hx - g.x, dz = hz - g.z, d = Math.hypot(dx, dz) || 1; g.t += sec;
    if (d < P.magnet) g.fly = true;
    if (g.fly) { const sp = 0.12 + g.t * 0.02; g.x += dx / d * Math.min(d, sp * dt * 1.5); g.z += dz / d * Math.min(d, sp * dt * 1.5);
      if (d < 0.35) { g.got = true; P.xp += g.v; if (gemSnd <= 0) { note(84 + (P.xp % 8), 0.08, 0.06); gemSnd = 2; } } }
  }
  gems = gems.filter(g => !g.got);
  xpBar.querySelector('i').style.width = Math.min(100, P.xp / P.need * 100) + '%';
  if (P.xp >= P.need && !picks) levelUp();
  killSnd -= dt; gemSnd -= dt; hurtT = Math.max(0, hurtT - sec);
  ui.score(score); 
}

loop((dt, t) => {
  if (state === 'play' && !picks) step(dt);
  // ---- render horde
  const n = foes.length;
  for (let i = 0; i < n; i++) {
    const f = foes[i], s = f.K.s * (f.born < 12 ? f.born / 12 : 1), wob = Math.sin(f.t * 10 + i) * 0.08, a = Math.atan2(hx - f.x, hz - f.z);
    _q.setFromEuler(_e.set(0, a, Math.sin(f.t * 8 + i) * 0.12));
    _m.compose(_p.set(f.x, Math.abs(Math.sin(f.t * 8 + i)) * 0.08 * s, f.z), _q, _s.set(s * (1 + wob), s * (1 - wob + f.flash * 0.2), s * (1 + wob))); bodyMesh.setMatrixAt(i, _m);
    bodyMesh.setColorAt(i, _c.set(f.K.col).lerp(WHITE, f.flash * 0.85));
    if (f.kind === 'brute') hornMesh.setMatrixAt(i, _m); else hornMesh.setMatrixAt(i, ZERO);
    for (let e = 0; e < 2; e++) { const ox = (e ? 0.12 : -0.12) * s; _p.set(f.x + Math.cos(a) * ox + Math.sin(a) * 0.27 * s, (0.56 + Math.abs(Math.sin(f.t * 8 + i)) * 0.08) * s, f.z - Math.sin(a) * ox + Math.cos(a) * 0.27 * s);
      eyeMesh.setMatrixAt(i * 2 + e, _m.compose(_p, _q.identity(), _s.set(s, s * 1.3, s))); eyeMesh.setColorAt(i * 2 + e, _c.set(f.K.eye)); }
  }
  bodyMesh.count = hornMesh.count = n; eyeMesh.count = n * 2;
  bodyMesh.instanceMatrix.needsUpdate = hornMesh.instanceMatrix.needsUpdate = eyeMesh.instanceMatrix.needsUpdate = true;
  if (bodyMesh.instanceColor) bodyMesh.instanceColor.needsUpdate = true; if (eyeMesh.instanceColor) eyeMesh.instanceColor.needsUpdate = true;
  hornMesh.material.color.set('#ffd23f');
  // gems / bolts / poofs
  gems.forEach((g, i) => { _q.setFromEuler(_e.set(0, t * 3 + i, 0)); gemMesh.setMatrixAt(i, _m.compose(_p.set(g.x, 0.3 + Math.sin(t * 4 + i) * 0.06, g.z), _q, _s.setScalar(g.v > 1 ? 1.7 : 1))); });
  gemMesh.count = gems.length; gemMesh.instanceMatrix.needsUpdate = true;
  bolts.forEach((b, i) => { _m.compose(_p.set(b.x, 0.6, b.z), _q.identity(), _s.set(1, 1, 1)); boltMesh.setMatrixAt(i, _m); _s.setScalar(1 + Math.sin(t * 20 + i) * 0.15); boltGlow.setMatrixAt(i, _m.compose(_p, _q, _s)); });
  boltMesh.count = boltGlow.count = bolts.length; boltMesh.instanceMatrix.needsUpdate = boltGlow.instanceMatrix.needsUpdate = true;
  for (const p of poofs) p.t += dt;
  poofs = poofs.filter(p => p.t < 16);
  poofs.forEach((p, i) => { const k = clamp(p.t / 16, 0, 1), sc = p.t < 0 ? 0 : p.s * (0.4 + k * 1.1) * (1 - k * k); poofMesh.setMatrixAt(i, _m.compose(_p.set(p.x, 0.45 + k * 0.4, p.z), _q.identity(), _s.setScalar(sc))); poofMesh.setColorAt(i, _c.set(p.col).lerp(WHITE, 0.4 + k * 0.5)); });
  poofMesh.count = poofs.length; poofMesh.instanceMatrix.needsUpdate = true; if (poofMesh.instanceColor) poofMesh.instanceColor.needsUpdate = true;
  // weapons visuals
  const nOrb = L && L.orbit ? L.orbit + 1 : 0, R = L ? 1.75 + L.orbit * 0.08 : 0;
  orbitMeshes.forEach((m, i) => { m.visible = i < nOrb && state === 'play'; if (m.visible) { const a = orbitA + i * Math.PI * 2 / nOrb; m.position.set(hx + Math.sin(a) * R, 0.55, hz + Math.cos(a) * R); } });
  pulseT = Math.min(1, pulseT + dt * 0.05); const pr = L ? 2.1 + L.pulse * 0.35 : 2;
  pulseRing.position.x = pulseFill.position.x = hx; pulseRing.position.z = pulseFill.position.z = hz;
  pulseRing.scale.setScalar(pr * (0.3 + pulseT * 0.7)); pulseFill.scale.setScalar(pr * (0.3 + pulseT * 0.7)); pulseRing.material.opacity = (1 - pulseT) * 0.9; pulseFill.material.opacity = (1 - pulseT) * 0.35;
  for (const b of beams) { b.t = Math.max(0, b.t - dt * 0.08); b.m.material.opacity = b.t; b.m.scale.set(0.5 + b.t, 1, 0.5 + b.t); }
  // hero
  hero.position.set(hx, moving ? Math.abs(Math.sin(walk)) * 0.1 : 0, hz);
  hero.rotation.y += ((((faceA - hero.rotation.y + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, 0.25 * dt);
  boots[0].position.z = 0.03 + (moving ? Math.sin(walk * 2) * 0.12 : 0); boots[1].position.z = 0.03 - (moving ? Math.sin(walk * 2) * 0.12 : 0);
  lanternG.rotation.z = Math.sin(t * 3) * 0.2 + (moving ? Math.sin(walk * 2) * 0.2 : 0); lanternGlass.material.color.setHSL(0.14, 1, 0.78 + Math.sin(t * 9) * 0.06);
  coat.material.emissive.set(hurtT > 0 && Math.floor(t * 20) % 2 ? '#ff2040' : '#000000');
  animMe(dt, t);
  // decor wraps around the camera so the meadow is endless
  decoData.forEach((d, i) => decoBush.setMatrixAt(i, _m.compose(_p.set(wrap(d.x, camX), 0.15 * d.s, wrap(d.z, camZ)), _q.identity(), _s.set(d.s, d.s * 0.5, d.s))));
  rockData.forEach((d, i) => { _q.setFromEuler(_e.set(0, d.a, 0)); decoRock.setMatrixAt(i, _m.compose(_p.set(wrap(d.x + 7, camX), 0.12 * d.s, wrap(d.z + 3, camZ)), _q, _s.set(d.s, d.s * 0.6, d.s))); });
  decoBush.instanceMatrix.needsUpdate = decoRock.instanceMatrix.needsUpdate = true;
  // camera
  camX = lerp(camX, hx, 0.1 * dt); camZ = lerp(camZ, hz, 0.1 * dt); shake = Math.max(0, shake - 0.02 * dt);
  camera.position.set(camX + (Math.random() - 0.5) * shake, 13 + (Math.random() - 0.5) * shake, camZ + 7.6); camera.lookAt(camX, 0, camZ - 0.3);
  ground.position.set(Math.floor(camX / TILE) * TILE, 0, Math.floor(camZ / TILE) * TILE);
  sun.position.set(camX + 5, 14, camZ + 7); sun.target.position.set(camX, 0, camZ);
  // hud
  if (state === 'play' && P) { const [sx, sy] = screen(hx, 1.75, hz); hpBar.style.transform = `translate(${sx}px,${sy}px)`; hpBar.firstChild.style.width = (P.hp / P.maxHp * 100) + '%'; hpBar.style.display = ''; }
  else hpBar.style.display = 'none';
  killEl.style.display = 'none'; xpBar.style.display = wpnRow.style.display = state === 'play' ? '' : 'none';
});
const WHITE = new THREE.Color('#ffffff'), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

look = LOOKS[(level - 1) % LOOKS.length]; buildRun(); ui.start(); ui.pill('');
{ // hero bar at the foot of the start card, so the picked hero stays in view (taps on it never start the run)
  const slot = document.createElement('div'); slot.style.cssText = 'width:min(360px,100%)'; ui.els.start.appendChild(slot);
  heroBar({ parent: slot, onPick: syncMe }); onHeroesChange(syncMe); syncMe();
}

// ---------------------------------------------------------------- bot: flee the crowd, swing round it, scoop up gems
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get dbg() { return { time: +time.toFixed(1), foes: foes.length, hp: Math.round(P.hp), lvl: P.lvl, L: JSON.stringify(L) }; },
  bot() {
    if (state !== 'play') return;
    if (picks) { const u = BOT_PREF.map(id => picks.find(p => p.id === id)).find(Boolean) || picks[0]; choose(u); return; }
    let vx = 0, vz = 0, cx = 0, cz = 0, cn = 0;
    for (const f of foes) { const dx = hx - f.x, dz = hz - f.z, d2 = dx * dx + dz * dz; if (d2 < 30) { const w = (f.K.r + 0.6) / Math.max(0.2, d2); vx += dx * w; vz += dz * w; cx += f.x; cz += f.z; cn++; } }
    if (cn) { cx /= cn; cz /= cn; const tx = -(cz - hz), tz = cx - hx, tl = Math.hypot(tx, tz) || 1; vx += tx / tl * 0.35; vz += tz / tl * 0.35; }
    const threat = Math.hypot(vx, vz);
    let g = null, gd = 1e9; for (const gm of gems) { const d = (gm.x - hx) ** 2 + (gm.z - hz) ** 2; if (d < gd) { gd = d; g = gm; } }
    if (g && gd < 36) { const d = Math.sqrt(gd) || 1, w = threat > 1.2 ? 0.25 : 1; vx += (g.x - hx) / d * w; vz += (g.z - hz) / d * w; }
    vx += -hx * 0.01; vz += -hz * 0.01;
    const l = Math.hypot(vx, vz); botVec = l > 0.08 ? [vx / l, vz / l] : null; botUntil = performance.now() + 150;
  },
};

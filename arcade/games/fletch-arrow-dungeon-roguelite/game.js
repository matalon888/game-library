// Fletch — original room-by-room arrow roguelite. Drag to move (you can't shoot while moving); let go and Sprig fires
// at the nearest monster on his own. Clear the room, walk through the gate, pick one of three skills, repeat.
import { THREE, createStage, createUI, store, loop, buzz, tone, note, burst, confetti, lerp, clamp, rng, rounded, mat } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';

const RW = 9, RD = 14, HX = RW / 2, HZ = RD / 2, PR = 0.42;
const S = store('fletch');
let level = S.get('level', 1), best = S.get('best', 0);
const F = flow('fletch');

const stage = createStage({ fov: 42, shadowSize: 11 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'FLETCH', hint: 'Tap where to walk · stand still to shoot', hand: '👆' });
const D = daily('fletch', ui, { name: 'Fletch: Arrow Dungeon Roguelite' });
const B = board({ game: 'fletch', label: 'Dungeons cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });   // world board: dungeons cleared today (RULES.md)

const LOOKS = [
  { bg: ['#a8e6cf', '#dcedc1'], f1: '#f6e7c8', f2: '#ecd8b0', wall: '#8d7bc4', rock: '#b9a6e8', ui: '#7b5cff' },
  { bg: ['#ffd3b6', '#ffe9d6'], f1: '#d8f0e0', f2: '#c4e6cf', wall: '#e0866e', rock: '#f2b09c', ui: '#ff6f59' },
  { bg: ['#c9d6ff', '#e2e2ff'], f1: '#fbe7ef', f2: '#f3d3e1', wall: '#5aa6a0', rock: '#8fd1c8', ui: '#2a9d8f' },
  { bg: ['#ffe8a3', '#fff5d6'], f1: '#e5ecff', f2: '#d3ddfa', wall: '#c27ba0', rock: '#e7a9c7', ui: '#d0578f' },
  { bg: ['#b8f2e6', '#e3f6ff'], f1: '#fff1d6', f2: '#f6e1b7', wall: '#6b8bd6', rock: '#a9bff2', ui: '#3a6fd8' },
];

// ---------------------------------------------------------------- static room pieces
const tileTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#e9e9e9'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, 0, 128, 2); x.fillRect(0, 0, 2, 128); x.fillRect(0, 63, 128, 2); x.fillRect(63, 0, 2, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(RW / 2, RD / 2); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const floorMat = mat('#ffffff', { map: tileTex, roughness: 0.85 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const under = new THREE.Mesh(rounded(RW + 3, 1.2, RD + 3, 0.3), mat('#ffffff')); under.position.y = -0.95; under.receiveShadow = true; scene.add(under);
const WALL_G = rounded(1, 1.1, 1, 0.14), wallMat = mat('#ffffff');
const wallSpots = [];
for (let x = -HX - 0.5; x <= HX + 0.5; x += 1) { if (Math.abs(x) > 1.1) wallSpots.push([x, -HZ - 0.5]); wallSpots.push([x, HZ + 0.5]); }
for (let z = -HZ + 0.5; z <= HZ - 0.5; z += 1) { wallSpots.push([-HX - 0.5, z]); wallSpots.push([HX + 0.5, z]); }
const walls = new THREE.InstancedMesh(WALL_G, wallMat, wallSpots.length); walls.castShadow = walls.receiveShadow = true; scene.add(walls);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();
wallSpots.forEach(([x, z], i) => walls.setMatrixAt(i, _m.makeTranslation(x, 0.55, z)));
// gate: two pillars, bars that sink when the room is clear, glowing chevrons
const gate = new THREE.Group(); gate.position.set(0, 0, -HZ - 0.5); scene.add(gate);
const pillarMat = mat('#ffffff');
for (const sx of [-1.45, 1.45]) { const p = new THREE.Mesh(rounded(0.9, 1.8, 1.1, 0.16), pillarMat); p.position.set(sx, 0.9, 0); p.castShadow = true; gate.add(p);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat('#ffd23f', { emissive: '#ff9f1c', emissiveIntensity: 0.4 })); cap.position.set(sx, 2.0, 0); gate.add(cap); }
const bars = new THREE.Group(); gate.add(bars);
for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), mat('#4a3f5c', { metalness: 0.4, roughness: 0.4 })); b.position.set(i * 0.4, 0.75, 0); b.castShadow = true; bars.add(b); }
const barTop = new THREE.Mesh(rounded(2.1, 0.16, 0.2, 0.06), mat('#4a3f5c')); barTop.position.y = 1.45; bars.add(barTop);
const chevMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
const chevG = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, -0.2); s.lineTo(0, 0.2); s.lineTo(0.5, -0.2); s.lineTo(0.5, 0.05); s.lineTo(0, 0.45); s.lineTo(-0.5, 0.05); s.lineTo(-0.5, -0.2); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; })();
const chevrons = [0, 1, 2].map(i => { const m = new THREE.Mesh(chevG, chevMat); m.position.set(0, 0.02, -HZ + 1.2 + i * 0.9); scene.add(m); return m; });

// ---------------------------------------------------------------- hero: Sprig, a round mint bean with a leaf sprout and a little bow
const hero = new THREE.Group(); scene.add(hero);
const heroBody = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 18), mat('#5fd38d', { roughness: 0.4 })); heroBody.scale.set(1, 1.08, 1); heroBody.position.y = 0.5; heroBody.castShadow = true; hero.add(heroBody);
const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), mat('#c9f7d6')); belly.position.set(0, 0.42, 0.22); belly.scale.set(1, 1, 0.6); hero.add(belly);
for (const sx of [-0.15, 0.15]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat('#1f1a2e', { roughness: 0.2 })); e.position.set(sx, 0.66, 0.37); hero.add(e);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); h.position.set(sx + 0.025, 0.69, 0.44); hero.add(h); }
const leafMat = mat('#2fae5f'); const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), leafMat); stem.position.y = 1.02; hero.add(stem);
const sprout = new THREE.Group(); sprout.position.y = 1.1; hero.add(sprout);
for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), leafMat); l.scale.set(1, 0.35, 0.6); l.position.x = s * 0.15; l.rotation.z = s * 0.4; l.castShadow = true; sprout.add(l); }
const bow = new THREE.Group(); bow.position.set(0.42, 0.5, 0.1); hero.add(bow);
const bowArc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 16, Math.PI), mat('#ff8c42')); bowArc.rotation.set(0, Math.PI / 2, Math.PI / 2); bow.add(bowArc);
const bowStr = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#fff' })); bowStr.rotation.x = Math.PI / 2; bowStr.position.z = -0.0; bow.add(bowStr);
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 20), mat('#ff8c42')); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.3; hero.add(scarf);
const tail = new THREE.Mesh(rounded(0.14, 0.32, 0.05, 0.03), mat('#ff8c42')); tail.position.set(0.12, 0.18, -0.38); tail.rotation.z = 0.3; hero.add(tail);
const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.42, 10), mat('#9b5d3a')); quiver.position.set(-0.16, 0.62, -0.36); quiver.rotation.set(-0.35, 0, 0.5); quiver.castShadow = true; hero.add(quiver);
for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat(['#3d6bff', '#ffd23f', '#ff5d8f'][i])); f.position.set(-0.24 + i * 0.06, 0.88 + i * 0.02, -0.44 + i * 0.03); f.rotation.set(-0.35, 0, 0.5); hero.add(f); }
const heroShadowR = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); heroShadowR.rotation.x = -Math.PI / 2; heroShadowR.position.y = 0.02; hero.add(heroShadowR);

// ---------------------------------------------------------------- my hero (Hero Lab): replaces Sprig's look only
// `hero` (position, facing, ring, bow) keeps doing everything; Sprig's meshes hide and the player's hero stands in the
// scene at the same spot (its own object, so the "fall" can still play after `hero` hides on a loss). 1.3 tall: the
// rooms are tuned for a small archer. The bow follows the free hand (left first, like an archer).
const SPRIG = hero.children.filter(o => o !== bow && o !== heroShadowR);
let me = null, meTok = 0, meSig, meClip = 'idle', meHand = null, meMats = [], meCheer = 0, meWasClear = false;
async function buildMe() {
  const t = ++meTok, h = selectedHero(); meSig = JSON.stringify(h);
  if (me) { me.dispose(); me = null; }
  dressSprig();
  if (!h) return;
  try {
    const next = await loadHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: 1.3, clip: 'idle' });
    if (t !== meTok) { next.dispose(); return; }
    me = next; meClip = 'idle'; scene.add(me.object);
    meHand = !h.items.offhand ? me.object.getObjectByName('LeftHand') : !h.items.hand ? me.object.getObjectByName('RightHand') : null;
    meMats = []; me.object.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => m.emissive && meMats.push([m, m.emissive.clone()])); });
    dressSprig();
  } catch (e) { console.warn('hero', e); }
}
function dressSprig() { SPRIG.forEach(o => { o.visible = !me; }); bow.visible = !me || !!meHand; }
const syncMe = () => { if (JSON.stringify(selectedHero()) !== meSig) buildMe(); };
const _hand = new THREE.Vector3();
function animMe(dt, t) {
  if (!me) return;
  const o = me.object; o.position.set(hero.position.x, 0, hero.position.z); o.rotation.y = hero.rotation.y;
  o.visible = state === 'lost' || hero.visible;
  if (cleared && !meWasClear && state === 'play') meCheer = 1.6; meWasClear = cleared; meCheer = Math.max(0, meCheer - dt / 60);
  const want = state === 'won' ? 'cheer' : state === 'lost' ? 'fall' : state === 'play' && moving && !picks ? 'run' : meCheer > 0 && !picks ? 'cheer' : 'idle';
  if (want !== meClip) { meClip = want; me.play(want, { fade: 0.15, once: want === 'fall' }); }
  if (want === 'run' && P) me.actions.run.timeScale = clamp(P.speed / 0.075, 0.8, 1.5);
  me.mixer.update(dt / 60);
  const red = state === 'play' && hurtT > 0 && Math.floor(t * 20) % 2; for (const [m, e0] of meMats) red ? m.emissive.setRGB(0.9, 0, 0.15) : m.emissive.copy(e0);
  if (meHand) { o.updateMatrixWorld(true); meHand.getWorldPosition(_hand); hero.updateMatrixWorld(); hero.worldToLocal(bow.position.copy(_hand)); bow.position.z -= recoil * 0.12; }
}

// ---------------------------------------------------------------- projectiles (instanced)
const MAXA = 90, MAXO = 80;
const arrowG = new THREE.CapsuleGeometry(0.085, 0.7, 3, 8); arrowG.rotateX(Math.PI / 2);
const arrowMesh = new THREE.InstancedMesh(arrowG, new THREE.MeshBasicMaterial({ color: '#3d6bff' }), MAXA); arrowMesh.frustumCulled = false; scene.add(arrowMesh);
const orbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.19, 12, 10), new THREE.MeshBasicMaterial({ color: '#ff5d3a' }), MAXO); orbMesh.frustumCulled = false; scene.add(orbMesh);
const orbGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb36b', transparent: true, opacity: 0.35, depthWrite: false }), MAXO); orbGlow.frustumCulled = false; scene.add(orbGlow);
let arrows = [], orbs = [];

// ---------------------------------------------------------------- DOM bits: hp bar, damage numbers, joystick, skill cards
const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; document.body.appendChild(d); return d; };
const hpBar = mk('fl-hp', '<i></i>'), hpNum = mk('fl-hpn'), joy = mk('fl-joy hc-hidden', '<i></i>'), roomTxt = mk('fl-room'), skillRow = mk('fl-skills');
const pickEl = mk('fl-pick hc-hidden', '<h2>Pick a skill</h2><div class="fl-cards"></div>');
function screen(x, y, z) { _v.set(x, y, z).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; }
function dmgText(x, z, text, color = '#fff', size = 20) { const [sx, sy] = screen(x, 1.2, z); const d = mk('fl-dmg'); d.textContent = text; d.style.left = sx + 'px'; d.style.top = sy + 'px'; d.style.color = color; d.style.fontSize = size + 'px'; setTimeout(() => d.remove(), 700); }

// ---------------------------------------------------------------- skills
const SKILLS = [
  { id: 'multi', icon: '🏹', name: 'Twin Shot', desc: '+1 arrow forward', max: 3, f: () => P.front++ },
  { id: 'diag', icon: '✳️', name: 'Fan Shot', desc: '+2 diagonal arrows', max: 2, f: () => P.diag++ },
  { id: 'rapid', icon: '⚡', name: 'Quick Draw', desc: 'Attack speed +30%', max: 4, f: () => P.rate *= 1.3 },
  { id: 'power', icon: '💪', name: 'Heavy Tip', desc: 'Damage +35%', max: 5, f: () => P.dmg *= 1.35 },
  { id: 'pierce', icon: '🗡️', name: 'Pierce', desc: 'Arrows go through foes', max: 1, f: () => P.pierce = true },
  { id: 'bounce', icon: '↩️', name: 'Ricochet', desc: 'Arrows bounce off walls', max: 2, f: () => P.bounce++ },
  { id: 'rear', icon: '🔙', name: 'Back Shot', desc: '+1 arrow behind you', max: 1, f: () => P.rear++ },
  { id: 'heal', icon: '🍎', name: 'Snack', desc: 'Heal 45 HP', max: 99, f: () => P.hp = Math.min(P.maxHp, P.hp + 45) },
  { id: 'vital', icon: '❤️', name: 'Hearty', desc: 'Max HP +30, heal', max: 4, f: () => { P.maxHp += 30; P.hp = Math.min(P.maxHp, P.hp + 30); } },
  { id: 'swift', icon: '👟', name: 'Light Feet', desc: 'Move speed +20%', max: 3, f: () => P.speed *= 1.2 },
];
const BOT_PREF = ['multi', 'rapid', 'power', 'diag', 'pierce', 'heal', 'vital', 'bounce', 'rear', 'swift'];
let P, taken;
function freshHero() { P = { hp: 120, maxHp: 120, dmg: 16, rate: 1.8, speed: 0.105, front: 1, diag: 0, rear: 0, pierce: false, bounce: 0 }; taken = {}; skillRow.innerHTML = ''; }
let picks = null, rr = Math.random;
function showPick() {
  const pool = SKILLS.filter(s => (taken[s.id] || 0) < s.max && !(s.id === 'heal' && P.hp > P.maxHp * 0.8));
  picks = []; while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rr() * pool.length), 1)[0]);
  const box = pickEl.querySelector('.fl-cards'); box.innerHTML = '';
  picks.forEach(s => { const c = document.createElement('div'); c.className = 'fl-card'; c.innerHTML = `<b>${s.icon}</b><u>${s.name}</u><small>${s.desc}</small>`;
    c.addEventListener('pointerdown', e => { e.stopPropagation(); choose(s); }); box.appendChild(c); });
  pickEl.classList.remove('hc-hidden'); tone(660, 0.1, 'triangle', 0.12, 1.3);
}
function choose(s) {
  if (!picks) return; picks = null; pickEl.classList.add('hc-hidden');
  s.f(); taken[s.id] = (taken[s.id] || 0) + 1; const sp = document.createElement('span'); sp.textContent = s.icon; skillRow.appendChild(sp);
  [0, 7, 12].forEach((n, i) => setTimeout(() => note(72 + n, 0.25, 0.13), i * 70)); buzz(12);
  nextRoom();
}

// ---------------------------------------------------------------- enemies
const eMats = { slime: mat('#ff6fa8', { roughness: 0.25, transparent: true, opacity: 0.92 }), bat: mat('#6c4bb4'), cap: mat('#ff5a4e'), stem: mat('#fff1dc'), boss: mat('#8e5cff', { roughness: 0.25 }), eye: mat('#1f1a2e', { roughness: 0.2 }), white: new THREE.MeshBasicMaterial({ color: '#fff' }) };
const SPHERE = new THREE.SphereGeometry(1, 20, 14), EYE = new THREE.SphereGeometry(0.07, 10, 8);
const barBgG = new THREE.PlaneGeometry(0.9, 0.12), barFgG = new THREE.PlaneGeometry(0.9, 0.12); barFgG.translate(0.45, 0, 0);
function addEyes(g, y, z, sep = 0.14, s = 1) { for (const sx of [-sep, sep]) { const e = new THREE.Mesh(EYE, eMats.eye); e.position.set(sx * s, y, z); e.scale.setScalar(s); g.add(e); } }
function makeEnemy(kind, x, z, hpMul) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); let r = 0.45, hp = 30;
  if (kind === 'slime') { const b = new THREE.Mesh(SPHERE, eMats.slime.clone()); b.scale.set(0.48, 0.4, 0.48); b.position.y = 0.4; b.castShadow = true; body.add(b); addEyes(body, 0.5, 0.4); hp = 30; }
  if (kind === 'bat') { const b = new THREE.Mesh(SPHERE, eMats.bat.clone()); b.scale.setScalar(0.3); b.position.y = 1.0; b.castShadow = true; body.add(b); addEyes(body, 1.05, 0.26, 0.1);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), eMats.bat); w.rotation.z = s * Math.PI / 2; w.scale.z = 0.25; w.position.set(s * 0.48, 1.05, 0); w.castShadow = true; body.add(w); w.userData.wing = s; }
    r = 0.38; hp = 22; }
  if (kind === 'shroom') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 12), eMats.stem); st.position.y = 0.25; st.castShadow = true; body.add(st);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), eMats.cap.clone()); cap.position.y = 0.45; cap.castShadow = true; body.add(cap);
    for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eMats.white); const a = i * 1.26; d.position.set(Math.cos(a) * 0.28, 0.75, Math.sin(a) * 0.28); body.add(d); }
    addEyes(body, 0.32, 0.22, 0.09); hp = 40; }
  if (kind === 'boss') { const b = new THREE.Mesh(SPHERE, eMats.boss.clone()); b.scale.set(1.15, 0.95, 1.15); b.position.y = 0.95; b.castShadow = true; body.add(b);
    addEyes(body, 1.25, 1.0, 0.3, 2.2); const gold = mat('#ffd23f', { metalness: 0.3, roughness: 0.3, emissive: '#7a5200', emissiveIntensity: 0.2 }); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.22, 20), gold); crown.position.y = 1.85; body.add(crown);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5, c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), gold); c.position.set(Math.sin(a) * 0.45, 2.08, Math.cos(a) * 0.45); body.add(c); }
    r = 1.05; hp = 340; }
  const bar = new THREE.Group(), bg = new THREE.Mesh(barBgG, new THREE.MeshBasicMaterial({ color: '#3a2e4a', transparent: true, opacity: 0.6, depthTest: false })), fg = new THREE.Mesh(barFgG, new THREE.MeshBasicMaterial({ color: '#ff4d6d', depthTest: false }));
  fg.position.set(-0.45, 0, 0.001); bar.add(bg, fg); bar.renderOrder = 5; bg.renderOrder = 5; fg.renderOrder = 6; bar.position.y = kind === 'boss' ? 2.5 : kind === 'bat' ? 1.6 : 1.15; if (kind === 'boss') bar.scale.set(2, 1.4, 1); g.add(bar);
  g.position.set(x, 0, z); g.scale.setScalar(0.01); scene.add(g);
  hp = Math.round(hp * hpMul);
  return { g, body, bar, fg, kind, x, z, r, hp, maxHp: hp, t: Math.random() * 2, cd: 1 + Math.random(), vx: 0, vz: 0, hop: 0, flash: 0, born: 0, kx: 0, kz: 0 };
}

// ---------------------------------------------------------------- rooms
let look, rooms, roomIdx, enemies = [], obstacles = [], obsMeshes = [], roomStartCount = 1, cleared = false, gateOpen = 0;
let state = 'ready', score = 0, recorded = false, beatenShown = false, hx = 0, hz = HZ - 1.5, face = Math.PI, moving = false, shotCd = 0.4, hurtT = 0, shake = 0, transitionT = 0;
let rand = rng(1), camZ = 0, kills = 0, recoil = 0, hop = 0;
function buildRun() {
  look = LOOKS[(level - 1) % LOOKS.length];
  const bs = document.body.style; bs.setProperty('--bg1', look.bg[0]); bs.setProperty('--bg2', look.bg[1]); bs.setProperty('--ui', look.ui);
  floorMat.color.set('#ffffff'); tileTex.image.getContext('2d'); paintTiles();
  wallMat.color.set(look.wall); pillarMat.color.set(look.wall); under.material.color.set(look.wall).offsetHSL(0, -0.1, 0.12);
  for (let i = 0; i < wallSpots.length; i++) walls.setColorAt(i, _c.set(look.wall).offsetHSL(0, 0, ((i * 7) % 5 - 2) * 0.015)); walls.instanceColor.needsUpdate = true;
  rand = rng(D.seed ? D.seed : level * 4271 + 7); rr = rand;
  rooms = level === 1 ? 2 : Math.min(7, 2 + Math.ceil(level / 2)); roomIdx = -1; score = 0; kills = 0; recorded = false; beatenShown = false;
  freshHero(); ui.levels(level); ui.score(0); ui.sub(''); nextRoom(true);
}
function paintTiles() { const c = tileTex.image, x = c.getContext('2d'); x.fillStyle = look.f1; x.fillRect(0, 0, 128, 128); x.fillStyle = look.f2; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
  x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, 0, 128, 2); x.fillRect(0, 0, 2, 128); x.fillRect(0, 63, 128, 2); x.fillRect(63, 0, 2, 128); tileTex.needsUpdate = true; }
function nextRoom(first = false) {
  roomIdx++;
  for (const e of enemies) scene.remove(e.g); enemies = []; arrows = []; orbs = [];
  for (const m of obsMeshes) scene.remove(m); obsMeshes = []; obstacles = [];
  const fk = F.k(), boss = roomIdx === rooms - 1 && level >= 2, hpMul = 1 + (level - 1) * 0.16 + roomIdx * 0.05;
  // rock pillars: a few chunky blocks, never on the entry lane or the gate lane
  const nObs = boss ? 2 : 2 + Math.floor(rand() * 3);
  for (let i = 0; i < nObs; i++) {
    for (let tr = 0; tr < 20; tr++) {
      const w = rand() < 0.5 ? 1 : 2, d = 1, x = Math.round((rand() * (RW - w - 1) - (RW - w - 1) / 2) * 2) / 2, z = Math.round(rand() * (RD - 7)) - HZ + 2.5;
      if (Math.abs(x) < w / 2 + 1 && (z < -HZ + 3.5 || z > HZ - 4)) continue;
      if (obstacles.some(o => Math.abs(o.x - x) < (o.w + w) / 2 + 1 && Math.abs(o.z - z) < 2)) continue;
      obstacles.push({ x, z, w, d });
      const m = new THREE.Mesh(rounded(w - 0.08, 0.9, d - 0.08, 0.16), mat(look.rock)); m.position.set(x, 0.45, z); m.castShadow = m.receiveShadow = true; scene.add(m); obsMeshes.push(m);
      const top = new THREE.Mesh(rounded(w - 0.3, 0.12, d - 0.3, 0.05), mat('#ffffff', { transparent: true, opacity: 0.35 })); top.position.set(x, 0.92, z); scene.add(top); obsMeshes.push(top);
      break;
    }
  }
  // monsters: more and nastier each room
  const pool = level === 1 && roomIdx === 0 ? ['slime'] : roomIdx === 0 ? ['slime', 'bat'] : ['slime', 'bat', 'shroom', 'slime'];
  const n = boss ? 1 + Math.floor(level / 3) : Math.round(clamp((2 + roomIdx + Math.floor(level / 2)) * fk, 2, 10));
  if (boss) enemies.push(makeEnemy('boss', 0, -HZ + 3.5, hpMul));
  for (let i = 0; i < n; i++) {
    const kind = pool[Math.floor(rand() * pool.length)];
    for (let tr = 0; tr < 30; tr++) {
      const x = (rand() - 0.5) * (RW - 1.6), z = -HZ + 1.2 + rand() * (RD * 0.55);
      if (blocked(x, z, 0.6) || enemies.some(e => Math.hypot(e.x - x, e.z - z) < 1.4)) continue;
      enemies.push(makeEnemy(kind, x, z, hpMul)); break;
    }
  }
  enemies.forEach((e, i) => e.born = -i * 6);
  roomStartCount = enemies.length; cleared = false; gateOpen = 0;
  hx = 0; hz = HZ - 1.5; face = Math.PI; shotCd = 0.5; camZ = hz;
  roomTxt.textContent = boss ? 'BOSS ROOM' : `ROOM ${roomIdx + 1} / ${rooms}`;
  if (!first) { ui.flash(0.85); tone(300, 0.15, 'triangle', 0.1, 1.5); }
  if (boss) { ui.pop('BOSS!', '#fff', 52, 30); tone(90, 0.5, 'sawtooth', 0.12, 0.7); }
  updateProgress();
}
function blocked(x, z, r) { return obstacles.some(o => Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r); }
function pushOut(o, r) {   // circle vs room + rock collision; o = {x, z}
  const gateOk = cleared && Math.abs(o.x) < 0.9;
  o.x = clamp(o.x, -HX + r, HX - r); o.z = Math.min(o.z, HZ - r); if (!gateOk) o.z = Math.max(o.z, -HZ + r);
  for (const b of obstacles) {
    const dx = o.x - b.x, dz = o.z - b.z, px = b.w / 2 + r - Math.abs(dx), pz = b.d / 2 + r - Math.abs(dz);
    if (px > 0 && pz > 0) { if (px < pz) o.x += Math.sign(dx || 1) * px; else o.z += Math.sign(dz || 1) * pz; }
  }
}
function updateProgress() {
  const inRoom = roomStartCount ? 1 - enemies.length / roomStartCount : 1;
  ui.progress((roomIdx + inRoom * 0.9) / rooms);
}

// ---------------------------------------------------------------- combat
function nearestEnemy() { let b = null, bd = 1e9; for (const e of enemies) { if (e.born < 20) continue; const d = Math.hypot(e.x - hx, e.z - hz); if (d < bd) { bd = d; b = e; } } return b; }
function fire() {
  const tgt = nearestEnemy(); if (!tgt) return false;
  const a = Math.atan2(tgt.x - hx, tgt.z - hz); face = a;
  const shoot = (ang, off = 0) => { if (arrows.length >= MAXA) return; const dx = Math.sin(ang), dz = Math.cos(ang);
    arrows.push({ x: hx + dx * 0.5 + dz * off, z: hz + dz * 0.5 - dx * off, dx, dz, life: 80, hit: new Set(), bounce: P.bounce }); };
  for (let i = 0; i < P.front; i++) shoot(a, (i - (P.front - 1) / 2) * 0.26);
  for (let i = 0; i < P.diag; i++) { shoot(a + 0.62 - i * 0.18); shoot(a - 0.62 + i * 0.18); }
  for (let i = 0; i < P.rear; i++) shoot(a + Math.PI);
  recoil = 1; tone(880, 0.05, 'triangle', 0.06, 0.6); return true;
}
function hitEnemy(e, dmg, dx, dz) {
  const crit = Math.random() < 0.12, d = Math.round(dmg * (crit ? 2 : 1));
  e.hp -= d; e.flash = 1; e.kx += dx * 0.12; e.kz += dz * 0.12; dmgText(e.x, e.z, crit ? d + '!' : d, crit ? '#ffd23f' : '#fff', crit ? 26 : 19);
  tone(420 + Math.random() * 80, 0.04, 'square', 0.05, 0.7);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  enemies = enemies.filter(x => x !== e); scene.remove(e.g); kills++;
  const pts = e.kind === 'boss' ? 100 : e.kind === 'shroom' ? 15 : 10; score += pts; ui.score(score);
  const col = e.kind === 'slime' ? '#ff6fa8' : e.kind === 'bat' ? '#8d6bd8' : e.kind === 'boss' ? '#8e5cff' : '#ff5a4e';
  burst(scene, new THREE.Vector3(e.x, 0.6, e.z), [col, '#ffffff', col], e.kind === 'boss' ? 40 : 16, { speed: 0.1, up: 0.1, size: e.kind === 'boss' ? 1.4 : 0.8 });
  buzz(e.kind === 'boss' ? [30, 30, 60] : 14); shake = e.kind === 'boss' ? 0.5 : 0.12; tone(200, 0.12, 'square', 0.08, 0.5);
  if (D.beaten(score) && !beatenShown) { beatenShown = true; ui.pop('BEATEN!', '#fff', 44, 30); confetti(scene, new THREE.Vector3(hx, 1, hz), 50); }
  updateProgress();
  if (!enemies.length) roomClear();
}
function roomClear() {
  cleared = true; orbs = []; ui.pop(roomIdx === rooms - 1 ? 'CLEAR!' : 'ROOM CLEAR!', '#fff', 38, 30);
  [0, 4, 7].forEach((n, i) => setTimeout(() => note(67 + n, 0.3, 0.13), i * 80)); ui.flash(0.25);
  if (roomIdx === rooms - 1) return win();
}
function hurt(d) {
  if (hurtT > 0 || state !== 'play') return;
  P.hp -= d; hurtT = 0.6; shake = 0.3; buzz(30); tone(160, 0.15, 'sawtooth', 0.1, 0.6); ui.flash(0.12);
  dmgText(hx, hz, '-' + d, '#ff4d6d', 22);
  if (P.hp <= 0) { P.hp = 0; lose(); }
}
function record(won) { if (recorded) return; recorded = true; if (won) B.submit(1); F.level(won, clamp((roomIdx + (roomStartCount ? 1 - enemies.length / roomStartCount : 0)) / rooms, 0, 1)); }
function win() {
  state = 'won'; record(true); ui.progress(1); score += 50 + Math.round(P.hp); ui.score(score); best = Math.max(best, score); S.set('best', best);
  confetti(scene, new THREE.Vector3(hx, 1.2, hz), 90); buzz([20, 40, 20]); [0, 4, 7, 12, 16].forEach((s, k) => setTimeout(() => note(67 + s, 0.4, 0.15), k * 90));
  D.won(score); ui.win(level, `${kills} monsters · ${score} pts`); level++; S.set('level', level);
}
function lose() {
  state = 'lost'; record(false); best = Math.max(best, score); S.set('best', best); hero.visible = false;
  burst(scene, new THREE.Vector3(hx, 0.6, hz), ['#5fd38d', '#2fae5f', '#ffffff'], 26, { speed: 0.14, up: 0.12 });
  tone(220, 0.3, 'square', 0.1, 0.5); setTimeout(() => tone(110, 0.4, 'square', 0.1, 0.5), 150); buzz([40, 30, 80]);
  ui.lose('DEFEATED', `Room ${roomIdx + 1} of ${rooms}`);
}

// ---------------------------------------------------------------- input: virtual stick
let stick = null, botVec = null, botUntil = 0;
addEventListener('pointerdown', e => { if (state !== 'play' || picks) return; stick = { ox: e.clientX, oy: e.clientY, x0: e.clientX, y0: e.clientY, x: 0, y: 0 }; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; joy.classList.remove('hc-hidden'); });
addEventListener('pointermove', e => { if (!stick) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), mx = 45; if (l > mx) { stick.ox += dx - dx / l * mx; stick.oy += dy - dy / l * mx; dx = dx / l * mx; dy = dy / l * mx; joy.style.left = stick.ox + 'px'; joy.style.top = stick.oy + 'px'; } stick.x = dx / mx; stick.y = dy / mx; joy.firstChild.style.transform = `translate(${dx}px,${dy}px)`; });
let goal = null; const fRay = new THREE.Raycaster(), fPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fHit = new THREE.Vector3();   // tap = walk there, then shoot
const endStick = (e) => {
  if (stick && e.type === 'pointerup' && state === 'play' && !picks && Math.hypot(e.clientX - stick.x0, e.clientY - stick.y0) < 12) { fRay.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera); goal = fRay.ray.intersectPlane(fPlane, fHit) ? { x: fHit.x, z: fHit.z, t: performance.now() + 3000 } : null; }
  stick = null; joy.classList.add('hc-hidden'); joy.firstChild.style.transform = ''; };
addEventListener('pointerup', endStick); addEventListener('pointercancel', endStick);
const keys = {}; addEventListener('keydown', e => keys[e.key] = true); addEventListener('keyup', e => keys[e.key] = false);
ui.onTap(() => { B.start(); buildRun(); hero.visible = true; state = 'play'; });
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): in the first room, until the first
// touch, Sprig steps left, stops and looses arrows, then steps right and stops again: move to dodge, stand still to shoot
demo((n) => { botVec = [n === 1 ? -1 : 1, 0]; botUntil = performance.now() + 550; },
  { ready: () => state === 'play' && level === 1 && !D.isDaily && roomIdx === 0 && !picks && !cleared && !stick, wait: 1500, every: 1600, max: 2 });

// ---------------------------------------------------------------- loop
const camQ = new THREE.Quaternion();
loop((dt, t) => {
  const sec = dt / 60;
  if (state === 'play' && !picks) {
    // movement
    let mx = 0, mz = 0;
    if (stick) { mx = stick.x; mz = stick.y; }
    else if (keys.ArrowLeft || keys.a) mx = -1; else if (keys.ArrowRight || keys.d) mx = 1;
    if (!stick) { if (keys.ArrowUp || keys.w) mz = -1; else if (keys.ArrowDown || keys.s) mz = 1; }
    if (!stick && botVec && performance.now() < botUntil) { mx = botVec[0]; mz = botVec[1]; goal = null; }
    if (stick || mx || mz) goal = null;
    else if (goal) { const gx = goal.x - hx, gz = goal.z - hz, gl = Math.hypot(gx, gz); if (gl < 0.15 || performance.now() > goal.t) goal = null; else { mx = gx / gl * Math.min(1, gl * 2 + 0.3); mz = gz / gl * Math.min(1, gl * 2 + 0.3); if (goal.slide > 0) { goal.slide -= dt; const sd = goal.sd; [mx, mz] = [-gz / gl * sd + mx * 0.25, gx / gl * sd + mz * 0.25]; } } }   // blocked → slide sideways around it
    const ml = Math.hypot(mx, mz); moving = ml > 0.2;
    if (moving) { const k = Math.min(1, ml) / ml; hx += mx * k * P.speed * dt; hz += mz * k * P.speed * dt; face = Math.atan2(mx, mz); }
    const bx = hx, bz = hz, o = { x: hx, z: hz }; pushOut(o, PR); hx = o.x; hz = o.z;
    if (goal && moving && !(goal.slide > 0) && Math.hypot(hx - bx, hz - bz) > Math.hypot(mx, mz) * P.speed * dt * 0.6) { goal.slide = 22; goal.sd = (goal.x >= hx ? -1 : 1) * Math.sign(goal.z - hz || 1); }
    // through the gate → next room (after a skill pick)
    if (cleared && hz < -HZ + 0.2) { if (roomIdx < rooms - 1) { showPick(); hz = -HZ + 0.3; goal = null; } }
    // shooting (only when standing still)
    shotCd -= sec;
    if (!moving && !cleared && shotCd <= 0 && enemies.length) { if (fire()) shotCd = 1 / P.rate; }
    // enemies
    const fk = F.k();
    for (const e of enemies) {
      e.born += dt; const s = clamp(e.born / 14, 0.01, 1); e.g.scale.setScalar(s < 1 ? s * (1.25 - 0.25 * s) : 1);
      if (e.born < 20) continue;
      const dx = hx - e.x, dz = hz - e.z, d = Math.hypot(dx, dz) || 1; e.t += sec;
      if (e.kind === 'slime' || e.kind === 'boss') {
        e.cd -= sec;
        if (e.hop <= 0 && e.cd <= 0) { e.hop = 1; e.cd = (e.kind === 'boss' ? 1.6 : 1.25) / Math.sqrt(fk); const sp = (e.kind === 'boss' ? 0.07 : 0.075) * fk; e.vx = dx / d * sp; e.vz = dz / d * sp; }
        if (e.hop > 0) { e.hop -= sec * 2.2; e.x += e.vx * dt; e.z += e.vz * dt; e.body.position.y = Math.sin(clamp(e.hop, 0, 1) * Math.PI) * (e.kind === 'boss' ? 0.9 : 0.6);
          if (e.hop <= 0) { e.body.position.y = 0; e.land = 1; if (e.kind === 'boss') { shake = 0.25; tone(80, 0.15, 'sine', 0.12); } } }
        e.land = Math.max(0, (e.land || 0) - sec * 4); const sq = e.land * 0.35 + (e.hop > 0 ? -0.1 : Math.sin(e.t * 6) * 0.04);
        e.body.scale.set(1 + sq, 1 - sq, 1 + sq);
        if (e.kind === 'boss') { e.cd2 = (e.cd2 ?? 2.4) - sec; if (e.cd2 <= 0) { e.cd2 = 3.2 / fk; const n = 10, a0 = Math.random(); for (let i = 0; i < n; i++) { const a = a0 + i * Math.PI * 2 / n; orbs.push({ x: e.x, z: e.z, dx: Math.sin(a) * 0.06 * fk, dz: Math.cos(a) * 0.06 * fk }); } tone(140, 0.25, 'sawtooth', 0.09, 1.6); } }
      } else if (e.kind === 'bat') {
        const sp = 0.03 * fk, wob = Math.sin(e.t * 3 + e.x) * 0.6;
        e.x += (dx / d + (-dz / d) * wob) * sp * dt; e.z += (dz / d + (dx / d) * wob) * sp * dt;
        e.body.position.y = Math.sin(e.t * 5) * 0.15;
        for (const w of e.body.children) if (w.userData.wing) w.rotation.x = Math.sin(e.t * 22) * 0.7;
      } else if (e.kind === 'shroom') {
        e.cd -= sec; e.body.rotation.y = Math.atan2(dx, dz);
        const pre = e.cd < 0.35; e.body.scale.set(pre ? 1.15 : 1, pre ? 0.85 : 1, pre ? 1.15 : 1);
        if (e.cd <= 0) { e.cd = 2.3 / fk; const sp = 0.075 * Math.sqrt(fk); orbs.push({ x: e.x, z: e.z, dx: dx / d * sp, dz: dz / d * sp }); tone(300, 0.08, 'sine', 0.08, 1.5); }
      }
      e.x += e.kx; e.z += e.kz; e.kx *= 0.8; e.kz *= 0.8;
      if (e.kind !== 'bat') { const o2 = { x: e.x, z: e.z }; pushOut(o2, e.r * 0.8); e.x = o2.x; e.z = o2.z; } else { e.x = clamp(e.x, -HX + 0.3, HX - 0.3); e.z = clamp(e.z, -HZ + 0.3, HZ - 0.3); }
      if (e.kind !== 'bat' && e.kind !== 'shroom') e.body.rotation.y = Math.atan2(dx, dz);
      e.g.position.set(e.x, 0, e.z);
      e.flash = Math.max(0, e.flash - sec * 6); e.body.traverse(m => { if (m.material && m.material.emissive && m.material !== eMats.eye) { m.material.emissive.setRGB(e.flash, e.flash, e.flash); } });
      e.fg.scale.x = Math.max(0, e.hp / e.maxHp); e.bar.visible = e.hp < e.maxHp;
      if (d < e.r + PR - 0.05 && (e.kind !== 'slime' || e.hop < 0.6)) hurt(e.kind === 'boss' ? 25 : e.kind === 'bat' ? 12 : 15);
    }
    // arrows
    for (const a of arrows) {
      a.x += a.dx * 0.32 * dt; a.z += a.dz * 0.32 * dt; a.life -= dt;
      if (Math.abs(a.x) > HX || Math.abs(a.z) > HZ) {
        if (a.bounce > 0) { a.bounce--; if (Math.abs(a.x) > HX) a.dx *= -1; else a.dz *= -1; a.x = clamp(a.x, -HX, HX); a.z = clamp(a.z, -HZ, HZ); a.hit.clear(); }
        else { a.life = 0; burst(scene, new THREE.Vector3(a.x, 0.7, a.z), '#3d6bff', 3, { speed: 0.04, up: 0.03, size: 0.4, life: 0.5 }); continue; }
      }
      for (const e of enemies) { if (a.hit.has(e) || e.born < 20) continue; if (Math.hypot(e.x - a.x, e.z - a.z) < e.r + 0.12) { a.hit.add(e); hitEnemy(e, P.dmg, a.dx, a.dz); if (!P.pierce) { a.life = 0; break; } } }
    }
    arrows = arrows.filter(a => a.life > 0);
    // enemy orbs
    for (const b of orbs) { b.x += b.dx * dt; b.z += b.dz * dt; if (Math.abs(b.x) > HX + 0.3 || Math.abs(b.z) > HZ + 0.3) b.dead = true;
      else if (Math.hypot(b.x - hx, b.z - hz) < 0.5) { b.dead = true; hurt(14); } }
    orbs = orbs.filter(b => !b.dead);
    hurtT = Math.max(0, hurtT - sec);
    if (cleared) gateOpen = Math.min(1, gateOpen + sec * 2);
  }
  // render instanced projectiles
  arrows.forEach((a, i) => { _q.setFromAxisAngle(_v.set(0, 1, 0), Math.atan2(a.dx, a.dz)); arrowMesh.setMatrixAt(i, _m.compose(_p.set(a.x, 0.7, a.z), _q, _s.set(1, 1, 1))); });
  arrowMesh.count = arrows.length; arrowMesh.instanceMatrix.needsUpdate = true;
  const pul = 1 + Math.sin(t * 14) * 0.15;
  orbs.forEach((b, i) => { _m.compose(_p.set(b.x, 0.6, b.z), _q.identity(), _s.set(1, 1, 1)); orbMesh.setMatrixAt(i, _m); _s.setScalar(pul); _m.compose(_p, _q, _s); orbGlow.setMatrixAt(i, _m); });
  orbMesh.count = orbGlow.count = orbs.length; orbMesh.instanceMatrix.needsUpdate = orbGlow.instanceMatrix.needsUpdate = true;
  // hero pose
  recoil = Math.max(0, recoil - dt * 0.12); hop += (moving ? dt * 0.35 : 0);
  hero.position.set(hx, moving ? Math.abs(Math.sin(hop)) * 0.14 : 0, hz);
  hero.rotation.y = lerpAngle(hero.rotation.y, face, 0.3 * dt);
  const sq = moving ? Math.sin(hop * 2) * 0.06 : Math.sin(t * 3) * 0.03 - recoil * 0.08;
  heroBody.scale.set(1 + sq, 1.08 - sq, 1 + sq); bow.position.z = 0.1 - recoil * 0.12; bow.rotation.y = -0.6 + (moving ? 0 : 0.6);
  sprout.rotation.z = Math.sin(t * 4) * 0.15; heroBody.material.emissive.set(hurtT > 0 && Math.floor(t * 20) % 2 ? '#ff2040' : '#000000');
  animMe(dt, t);
  // gate
  bars.position.y = -gateOpen * 1.55; chevMat.opacity = cleared ? 0.5 + Math.sin(t * 6) * 0.3 : 0;
  chevrons.forEach((c, i) => c.position.y = 0.02 + (cleared ? Math.max(0, Math.sin(t * 6 - i)) * 0.05 : 0));
  // camera: high and tilted, follows the hero depth a little
  camZ = lerp(camZ, hz, 0.06 * dt); shake = Math.max(0, shake - 0.02 * dt);
  const cz = clamp(camZ * 0.55, -2.0, 2.2);
  camera.position.set((Math.random() - 0.5) * shake, 15.5 + (Math.random() - 0.5) * shake, cz + 11.2); camera.lookAt(0, 0, cz - 0.9);
  sun.position.set(4, 14, cz + 6); sun.target.position.set(0, 0, cz);
  for (const e of enemies) e.bar.quaternion.copy(camera.quaternion);
  // DOM hp bar above the hero
  if (state === 'play' || state === 'won') { const [sx, sy] = screen(hx, 1.55, hz); hpBar.style.transform = hpNum.style.transform = `translate(${sx}px,${sy}px)`; hpNum.style.marginTop = '-18px';
    hpBar.firstChild.style.width = (P.hp / P.maxHp * 100) + '%'; hpNum.textContent = Math.ceil(P.hp); hpBar.style.display = hpNum.style.display = ''; }
  else hpBar.style.display = hpNum.style.display = 'none';
  roomTxt.style.display = state === 'play' ? '' : 'none';
});
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, k); }

look = LOOKS[(level - 1) % LOOKS.length]; buildRun(); ui.start();
{ // hero bar at the foot of the start card, so the picked hero stays in view (taps on it never start the run)
  const slot = document.createElement('div'); slot.style.cssText = 'width:min(360px,100%)'; ui.els.start.appendChild(slot);
  heroBar({ parent: slot, onPick: syncMe }); onHeroesChange(syncMe); syncMe();
}

// ---------------------------------------------------------------- bot: dodge orbs, keep distance from melee, otherwise stand and shoot; walk out when clear
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    if (picks) { const s = BOT_PREF.map(id => picks.find(p => p.id === id)).find(Boolean) || picks[0]; choose(s); return; }
    let vx = 0, vz = 0;
    if (cleared) { vx = -hx * 1.5; vz = -1;
      const ob = obstacles.find(o => Math.abs(hx - o.x) < o.w / 2 + PR + 0.1 && hz - o.z > 0 && hz - o.z < o.d / 2 + PR + 1.2);
      if (ob) { vx = (hx >= ob.x ? 1 : -1) * (ob.x === 0 && hx === ob.x ? 1 : 1); vz = -0.15; }
      else if (Math.abs(hx) > 0.5 && hz < -HZ + 1.5) vz = 0.1; }
    else {
      for (const b of orbs) { const dx = hx - b.x, dz = hz - b.z, d = Math.hypot(dx, dz); if (d > 2.6) continue;
        const closing = -(dx * b.dx + dz * b.dz); if (closing <= 0) continue; const side = (dx * b.dz - dz * b.dx) > 0 ? 1 : -1; vx += b.dz * side * 30 / d; vz += -b.dx * side * 30 / d; }
      for (const e of enemies) { if (e.kind === 'shroom') continue; const dx = hx - e.x, dz = hz - e.z, d = Math.hypot(dx, dz); const keep = e.kind === 'boss' ? 3.2 : 1.9; if (d < keep) { vx += dx / d * 2; vz += dz / d * 2; } }
      if (vx || vz) { vx += -hx * 0.15; vz += (HZ - 3 - hz) * 0.1; }
    }
    const l = Math.hypot(vx, vz); botVec = l > 0.1 ? [vx / l, vz / l] : null; botUntil = performance.now() + 140;
  },
};

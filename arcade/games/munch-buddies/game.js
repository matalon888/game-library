// Munch Buddies — original duet rhythm game. Two hungry kittens sit at the bottom of two lanes; snacks fall to the beat.
// Tap the left/right half as a snack reaches a kitten's mouth to munch it (and play the melody note). Hold for long treats.
// Never munch a bomb.
import { THREE, createStage, createUI, store, loop, buzz, rng, clamp, lerp, rounded, mat } from './kit/hc.js';
import { levelPlan, arrange, hits } from './_music/songs.js';
import { createPlayer, synth } from './_music/conductor.js';
import { glowSprite, sparks, ease } from './_music/fx.js';

const ORDER = ['twinkle', 'ode', 'saints', 'minuet', 'cancan', 'canon', 'neon', 'elise', 'starlight', 'mountain', 'turkish'];
const THEMES = [
  { wall: ['#fff3e2', '#ffd9c2'], drip: '#ff9fb8', shelf: '#e09a5f', ui: '#ff7a9c' },
  { wall: ['#eef9ff', '#cfe9ff'], drip: '#8fd3ff', shelf: '#d38b55', ui: '#4aa8ff' },
  { wall: ['#f6f0ff', '#e2d4ff'], drip: '#c39bff', shelf: '#c98855', ui: '#9a6bff' },
  { wall: ['#effff4', '#ccf5dc'], drip: '#7fdcaa', shelf: '#d8955c', ui: '#39b97a' },
  { wall: ['#fffbe0', '#ffe6a8'], drip: '#ffbf5e', shelf: '#c9804a', ui: '#ff9f1c' },
];
const LANE_X = [-1.42, 1.42], MOUTH_Y = -1.6, TOP_Y = 6.4;

const S = store('munch');
let level = S.get('level', 1), best = S.get('best', 0);
const stage = createStage({ fov: 42, shadows: true, shadowSize: 6 });
const { scene, camera, sun } = stage;
stage.hemi.intensity = 1.25; sun.intensity = 1.5; sun.position.set(3, 9, 9);
camera.position.set(0, 0.9, 13.5); camera.lookAt(0, 0.6, 0);
const ui = createUI({ title: 'MUNCH<br>BUDDIES', hint: 'Tap a side when the snack<br>reaches the kitten', hand: '👆' });
const songLine = document.createElement('p'); songLine.className = 'song'; ui.els.start.insertBefore(songLine, ui.els.start.querySelector('.hint'));
const player = createPlayer();
const fx = sparks(scene, 120);

// ---------------------------------------------------------------- room: wall gradient, icing drips, shelves, guide dots, floating notes
const wallMat = new THREE.ShaderMaterial({
  uniforms: { a: { value: new THREE.Color() }, b: { value: new THREE.Color() }, pulse: { value: 0 } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 a; uniform vec3 b; uniform float pulse; varying vec2 vU;
    void main(){ vec3 c = mix(b, a, smoothstep(0.1, 0.9, vU.y)); float st = step(0.5, fract(vU.x * 14.0)); c = mix(c, c * 0.965, st);
      vec2 g = fract(vU * vec2(9.0, 18.0)) - 0.5; c += 0.025 * (1.0 - smoothstep(0.05, 0.09, length(g))); c += pulse * 0.025; gl_FragColor = vec4(c, 1.0); }`,
});
const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), wallMat); wall.position.z = -3; scene.add(wall);
const floorTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ffe6ee'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 5); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), mat('#ffffff', { map: floorTex, roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -4.6, 0); floor.receiveShadow = true; scene.add(floor);
const dripMat = mat('#ff9fb8', { roughness: 0.35 });
const drips = new THREE.Group(); scene.add(drips);
{ const r = rng(5); const band = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 0.6), dripMat); band.position.set(0, 7.9, -2.4); drips.add(band);
  for (let x = -8; x <= 8; x += 0.62) { const len = 0.3 + r() * 1.3, c = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, len, 4, 10), dripMat); c.position.set(x, 7.3 - len / 2, -2.4); drips.add(c); } }
const shelfMat = mat('#e09a5f', { roughness: 0.6 });
const shelves = LANE_X.map(x => { const s = new THREE.Mesh(rounded(2.2, 0.26, 1.5, 0.08), shelfMat); s.position.set(x, -2.95, 0.2); s.receiveShadow = true; scene.add(s);
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 1.2), shelfMat); br.position.set(x, -3.35, 0); scene.add(br); return s; });
const divider = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 9, 4, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); divider.position.set(0, 2, -0.5); scene.add(divider);
const dotGeo = new THREE.CircleGeometry(0.06, 10), dotMat = new THREE.MeshBasicMaterial({ color: '#ff9fb8', transparent: true, opacity: 0.45 });
for (const x of LANE_X) for (let y = MOUTH_Y + 0.6; y < TOP_Y; y += 0.45) { const d = new THREE.Mesh(dotGeo, dotMat); d.position.set(x, y, -0.6); scene.add(d); }
function noteTex(ch) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(ch, 32, 34); return new THREE.CanvasTexture(c); }
const floaters = [];
for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex(i % 2 ? '♪' : '♫'), color: ['#ff9fb8', '#8fd3ff', '#ffc94d', '#b99bff'][i % 4], transparent: true, opacity: 0.55, depthWrite: false })); s.scale.setScalar(0.7); s.position.set((Math.random() < 0.5 ? -1 : 1) * (2.9 + Math.random() * 1.2), -2 + Math.random() * 9, -1.5); s.userData.v = 0.006 + Math.random() * 0.008; scene.add(s); floaters.push(s); }

// ---------------------------------------------------------------- the two kittens (original chunky-toy design)
function makeKitten(furC, patchC, side) {
  const g = new THREE.Group(), fur = mat(furC, { roughness: 0.65 }), patch = mat(patchC, { roughness: 0.65 }), pink = mat('#ff8fae'), dark = mat('#3a2730', { roughness: 0.3 }), white = mat('#ffffff');
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 20), fur); body.scale.set(1.05, 0.9, 0.85); body.position.y = 0.72; body.castShadow = true; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), white); belly.scale.set(1, 0.95, 0.5); belly.position.set(0, 0.62, 0.5); g.add(belly);
  const head = new THREE.Group(); head.position.y = 1.78; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.92, 32, 22), fur); skull.scale.set(1.15, 0.9, 0.92); skull.castShadow = true; head.add(skull);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.93, 32, 22, 0, Math.PI * 2, 0, 0.9), patch); cap.scale.copy(skull.scale); cap.rotation.z = side * 0.5; head.add(cap);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.58, 4, 1), sx === side ? patch : fur); ear.position.set(sx * 0.6, 0.72, -0.05); ear.rotation.set(0, Math.PI / 4, -sx * 0.32); ear.castShadow = true; head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.36, 4, 1), pink); inner.position.set(sx * 0.6, 0.66, 0.1); inner.rotation.set(0, Math.PI / 4, -sx * 0.32); head.add(inner);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), dark); eye.scale.set(1, 1.18, 0.6); eye.position.set(sx * 0.37, 0.07, 0.8); head.add(eye);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), white); hi.position.set(sx * 0.37 + 0.04, 0.14, 0.88); head.add(hi);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffb3c6', transparent: true, opacity: 0.85 })); cheek.scale.set(1.2, 0.7, 0.3); cheek.position.set(sx * 0.62, -0.17, 0.72); head.add(cheek);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), fur); paw.scale.set(1, 0.8, 1.1); paw.position.set(sx * 0.42, 0.18, 0.62); paw.castShadow = true; g.add(paw);
    for (let k = 0; k < 2; k++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), dark); w.rotation.z = Math.PI / 2 + sx * (k ? 0.12 : -0.08); w.position.set(sx * 0.95, -0.1 - k * 0.1, 0.62); head.add(w); }
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), pink); nose.scale.set(1.3, 0.8, 0.8); nose.position.set(0, -0.08, 0.86); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat('#7a2c3d', { roughness: 0.4 })); mouth.position.set(0, -0.32, 0.78); mouth.scale.set(1, 0.12, 0.5); head.add(mouth);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), pink); tongue.position.set(0, -0.4, 0.83); tongue.scale.set(1, 0.4, 0.5); head.add(tongue);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 10, 20, Math.PI * 1.1), patch); tail.position.set(-side * 0.85, 0.55, -0.35); tail.rotation.set(0, side * 0.5, side > 0 ? 0.6 : 2.4); tail.castShadow = true; g.add(tail);
  Object.assign(g, { head, mouth, tongue, body, tail, open: 0, bounce: 0, sad: 0, dizzy: 0 });
  return g;
}
const kits = [makeKitten('#fffaf3', '#ffb466', -1), makeKitten('#c9c3d6', '#7d7590', 1)];
kits.forEach((k, i) => { k.position.set(LANE_X[i], -2.82, 0.2); k.userData.s = 0.84; scene.add(k); });

// ---------------------------------------------------------------- snacks (prototypes cloned per note)
const SNACKS = [
  () => { const g = new THREE.Group(); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 14), mat('#e7a560')); cone.rotation.x = Math.PI; cone.position.y = -0.3; g.add(cone);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat('#ffb3c9')); s1.position.y = 0.12; const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat('#fff1d6')); s2.position.y = 0.45; const ch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#ff3b5c')); ch.position.y = 0.73; g.add(s1, s2, ch); return g; },
  () => { const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.16, 12, 24), mat('#e9a05f')); const ic = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.165, 10, 24, Math.PI * 2), mat('#ff7fb0', { roughness: 0.3 })); ic.scale.z = 0.6; ic.position.z = 0.06; g.add(d, ic);
    const cols = ['#ffffff', '#4ad7ff', '#ffe14d', '#7dff8a']; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.06, 2, 4), mat(cols[k % 4])); sp.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.2); sp.rotation.z = a * 3; g.add(sp); } return g; },
  () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), mat('#7ec8ff')); b.scale.set(1.35, 0.8, 0.6); g.add(b);
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 3), mat('#5bb3f5')); t.rotation.z = Math.PI / 2; t.position.x = -0.55; g.add(t); const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#24324a')); e.position.set(0.26, 0.06, 0.18); g.add(e); return g; },
  () => { const g = new THREE.Group(); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.32, 14), mat('#7fd6b5')); cup.position.y = -0.18; const top = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#fff0f6')); top.position.y = -0.02; top.scale.y = 1.2;
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat('#ff3b5c')); ch.position.y = 0.4; g.add(cup, top, ch); return g; },
  () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mat('#ff4d6d')); b.scale.set(1, 1.15, 1); const l = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 6), mat('#4cc36b')); l.position.y = 0.36; l.rotation.x = Math.PI; g.add(b, l); return g; },
];
const SNACK_PROTOS = SNACKS.map(f => { const g = f(); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; });
const bombProto = (() => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), mat('#2b2b3a', { roughness: 0.25, metalness: 0.3 })); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 10), mat('#55556a')); c.position.y = 0.4;
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), mat('#c8a26b')); f.position.set(0.06, 0.58, 0); f.rotation.z = -0.4; const sk = mat('#ff4d4d', { emissive: '#ff2020', emissiveIntensity: 0.5 }); const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.05), sk); x1.position.z = 0.37; x1.rotation.z = 0.785; const x2 = x1.clone(); x2.rotation.z = -0.785; g.add(b, c, f, x1, x2); return g; })();
const stickMat = mat('#f2c27b'), choco = mat('#7b4a32');

// ---------------------------------------------------------------- level
let state = 'ready', track, items = [], theme, score = 0, combo = 0, hearts = 3, lookahead = 1.6, speed = 5, eaten = 0, foodCount = 0, previewT = -1;
const itemGroup = new THREE.Group(); scene.add(itemGroup);
function buildLevel() {
  itemGroup.clear(); fx.clear();
  const plan = levelPlan(level, ORDER);
  track = arrange(plan.song, { bars: plan.bars, tempo: plan.tempo, ramp: 0.06, density: 0.7 });
  lookahead = clamp(1.7 - (level - 1) * 0.05, 1.1, 1.7); speed = (TOP_Y - MOUTH_Y) / lookahead;
  const hs = hits(track, clamp(0.3 - level * 0.006, 0.22, 0.3)), r = rng(level * 1777 + 9);
  const gaps = hs.map(h => h.dur).sort((a, b) => a - b), median = gaps[Math.floor(gaps.length / 2)] || 0.5;
  items = []; let lane = 0, run = 0;
  hs.forEach((h, i) => {
    // duet feel: alternate kittens in short phrases
    if (run >= 1 + Math.floor(r() * 3) || (i > 0 && h.midi < hs[i - 1].midi - 4)) { lane = 1 - lane; run = 0; } run++;
    const long = h.notes.length === 1 && h.noteDur >= Math.max(0.6, median * 1.8) && h.dur >= h.noteDur * 0.9;
    items.push({ kind: 'food', t: h.t, lane, notes: h.notes, noteDur: h.noteDur, long, len: long ? Math.min(h.dur, h.noteDur) * 0.9 : 0, snack: Math.floor(r() * SNACKS.length), state: 'wait' });
  });
  // bombs on the other lane where nothing is due there (they teach "don't tap")
  const bombP = clamp(0.06 + level * 0.03, 0.06, 0.32);
  for (const f of items.slice()) {
    if (f.kind !== 'food' || f.t < 1.2 || r() > bombP) continue;
    const other = 1 - f.lane, clear = !items.some(o => o.lane === other && Math.abs(o.t - f.t) < 0.45 || (o.long && o.lane === other && f.t > o.t - 0.3 && f.t < o.t + o.len + 0.3));
    if (clear) items.push({ kind: 'bomb', t: f.t, lane: other, state: 'wait' });
  }
  items.sort((a, b) => a.t - b.t);
  for (const it of items) {
    const g = new THREE.Group();
    if (it.kind === 'bomb') g.add(bombProto.clone());
    else {
      const s = SNACK_PROTOS[it.snack].clone(); g.add(s); g.snack = s;
      if (it.long) {   // long treat: a chocolate-dipped stick trailing above the snack
        const L = it.len * speed, st = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, L, 4, 10), stickMat); st.position.y = L / 2 + 0.2; st.castShadow = true;
        const dip = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, L * 0.55, 4, 10), choco); dip.position.y = L * 0.7 + 0.2; g.add(st, dip); g.stick = st; g.dip = dip; g.L = L;
      }
    }
    g.position.set(LANE_X[it.lane], 99, 0.3); itemGroup.add(g); it.g = g;
  }
  foodCount = items.filter(i => i.kind === 'food').length;
  theme = THEMES[(level - 1) % THEMES.length];
  wallMat.uniforms.a.value.set(theme.wall[0]); wallMat.uniforms.b.value.set(theme.wall[1]); dripMat.color.set(theme.drip); shelfMat.color.set(theme.shelf); dotMat.color.set(theme.drip); floor.material.color.set(theme.wall[0]);
  document.body.style.setProperty('--ui', theme.ui); document.body.style.background = `linear-gradient(180deg,${theme.wall[0]},${theme.wall[1]})`;
  score = 0; combo = 0; hearts = 3; eaten = 0; kits.forEach(k => { k.sad = 0; k.dizzy = 0; k.open = 0; k.rotation.set(0, 0, 0); k.visible = true; });
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(best ? `BEST ${best}` : ''); ui.pill('❤❤❤');
  songLine.textContent = `♪ ${plan.song.title} — ${plan.song.composer}`;
  previewT = -lookahead * 0.6;
}
function begin() { state = 'play'; player.start(track, { melody: false, lead: lookahead + 0.4, accVol: 0.75, drumVol: 0.7 }); }

// ---------------------------------------------------------------- munching
function munch(lane, now, who = 'tap') {
  if (state !== 'play') return;
  const k = kits[lane]; k.open = 1; k.bounce = 1;
  let food = null, bomb = null;
  for (const it of items) {
    if (it.lane !== lane || it.state !== 'wait') continue;
    if (it.t - now > 0.25) break;
    if (it.kind === 'food' && Math.abs(it.t - now) < 0.24) { food = it; break; }
    if (it.kind === 'bomb' && Math.abs(it.t - now) < 0.14) bomb = it;
  }
  if (food) return eat(food, now);
  if (bomb) return boom(bomb);
  synth.chime(70 + lane * 5, player.at(now), 0.04);   // empty chomp: harmless little click
}
function eat(it, now) {
  const dt = now - it.t, perfect = Math.abs(dt) < 0.075, k = kits[it.lane];
  it.state = it.long ? 'held' : 'eaten'; it.eatAt = now; eaten++; combo++; score += perfect ? 2 : 1;
  it.notes.forEach((n, i) => synth.piano(n.midi, player.at(i ? Math.max(now + 0.03, it.t + n.dt) : now), Math.max(0.3, it.long ? it.noteDur : n.dur), i ? 0.2 : 0.25));
  k.open = 1; k.bounce = 1; k.sad = 0;
  const p = new THREE.Vector3(LANE_X[it.lane], MOUTH_Y + 0.2, 1.2);
  fx.emit(p, perfect ? ['#ffd84a', '#ff8fae', '#ffffff'] : ['#ff8fae', '#ffffff'], perfect ? 12 : 7, { speed: 0.07, up: 0.07, size: 0.32, gravity: 0.004 });
  hearts3d(p, perfect ? 3 : 1);
  ui.pop(perfect ? (combo >= 4 ? `PERFECT ×${combo}` : 'PERFECT') : ['YUM!', 'NOM!', 'TASTY!'][combo % 3], perfect ? '#ff5d8f' : '#ff9f1c', perfect ? 32 : 28, 30);
  buzz(perfect ? 12 : 6); progress();
}
const floatHearts = [];
const heartTex = noteTex('❤');
function hearts3d(p, n) { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, color: '#ff5d8f', transparent: true, depthWrite: false })); s.scale.setScalar(0.55); s.position.copy(p).add(new THREE.Vector3((i - (n - 1) / 2) * 0.45, 0.3, 0)); scene.add(s); floatHearts.push({ s, life: 1, vx: (i - (n - 1) / 2) * 0.01 }); } }
function progress() { ui.score(score); ui.progress(eaten / Math.max(1, foodCount)); }
function boom(it) {
  it.state = 'boom'; const k = kits[it.lane]; k.dizzy = 1; it.g.visible = false;
  const p = new THREE.Vector3(LANE_X[it.lane], MOUTH_Y + 0.4, 1);
  fx.emit(p, ['#ff8c42', '#ffd84a', '#2b2b3a', '#ffffff'], 30, { speed: 0.16, up: 0.08, size: 0.7, gravity: 0.004 });
  const fl = glowSprite('#ffb347', 2, 'soft', 1); fl.position.copy(p); scene.add(fl); flashes.push({ s: fl, life: 1 });
  synth.kick(player.at(player.time()), 1); synth.noise(player.at(player.time()), { hp: 300, dur: 0.6, vol: 0.4 });
  ui.flash(0.8); buzz([60, 40, 80]); lose('BOOM!');
}
const flashes = [];
function missFood(it) {
  it.state = 'missed'; combo = 0; hearts--; const k = kits[it.lane]; k.sad = 1;
  ui.pill('❤'.repeat(Math.max(0, hearts)) + '♡'.repeat(3 - Math.max(0, hearts))); buzz(30);
  synth.piano(it.notes[0].midi - 1, player.at(player.time()), 0.2, 0.08);
  ui.pop('MISS', '#a08a9a', 26, 30);
  if (hearts <= 0) lose('SO HUNGRY!');
}
function lose(title) {
  if (state !== 'play') return;
  state = 'lost'; player.stop(0.4); synth.fail(); best = Math.max(best, score); S.set('best', best);
  ui.lose(title, `${Math.round(eaten / Math.max(1, foodCount) * 100)}% · ${score} pts`);
}
function win() {
  state = 'won'; best = Math.max(best, score); S.set('best', best);
  kits.forEach(k => { k.bounce = 1; k.open = 1; });
  for (let i = 0; i < 4; i++) fx.emit(new THREE.Vector3((i - 1.5) * 1.2, 1.5, 1), ['#ff8fae', '#ffd84a', '#8fd3ff', '#ffffff'], 16, { speed: 0.14, up: 0.1, size: 0.5 });
  hearts3d(new THREE.Vector3(LANE_X[0], 0, 1.2), 3); hearts3d(new THREE.Vector3(LANE_X[1], 0, 1.2), 3);
  [72, 76, 79, 84].forEach((m, i) => synth.chime(m, player.at(player.time()) + i * 0.09, 0.13));
  ui.flash(0.4); buzz([20, 40, 30]); ui.win(level, `${score} pts · ${'❤'.repeat(hearts)}`);
  level++; S.set('level', level);
}

// ---------------------------------------------------------------- input: tap/hold a half
const holds = new Map();
addEventListener('pointerdown', e => {
  if (state !== 'play') return; const lane = e.clientX < innerWidth / 2 ? 0 : 1, now = player.time();
  munch(lane, now); const held = items.find(it => it.state === 'held' && it.lane === lane); if (held) holds.set(e.pointerId, held);
});
const release = e => { const it = holds.get(e.pointerId); holds.delete(e.pointerId); if (it && it.state === 'held') endHold(it, player.time()); };
addEventListener('pointerup', release); addEventListener('pointercancel', release);
function endHold(it, now) {
  const p = clamp((now - it.t) / it.len, 0, 1); it.state = 'eaten'; it.eatAt = now;
  if (p > 0.85) { score += 3; ui.score(score); ui.pop('DELICIOUS!', '#ff5d8f', 30, 30); hearts3d(new THREE.Vector3(LANE_X[it.lane], MOUTH_Y + 0.4, 1.2), 2); synth.chime(88, player.at(now), 0.1); }
}
ui.onTap(which => { if (which !== 'start') buildLevel(); begin(); });

// ---------------------------------------------------------------- frame
let clock = 0, lastBeat = -1, pulse = 0;
loop((dt) => {
  clock += dt / 60; fx.update(dt);
  const now = state === 'ready' ? previewT : player.time();
  if (state === 'play') {
    for (const it of items) {
      if (it.state === 'wait' && it.bot && now >= it.t - 0.01) { munch(it.lane, now, 'bot'); if (it.long) it.botHold = true; }
      if (it.state === 'held') {
        const p = (now - it.t) / it.len; kits[it.lane].open = 0.7 + Math.sin(clock * 30) * 0.3;
        if (Math.random() < 0.3) fx.emit(new THREE.Vector3(LANE_X[it.lane], MOUTH_Y + 0.3, 1.2), ['#f2c27b', '#7b4a32'], 1, { speed: 0.05, up: 0.04, size: 0.2 });
        if (p >= 1) endHold(it, now);
      }
      if (it.state === 'wait' && now > it.t + 0.26) { if (it.kind === 'food') missFood(it); else it.state = 'passed'; if (state !== 'play') break; }
    }
    const last = items[items.length - 1];
    if (state === 'play' && last && now > last.t + (last.len || 0) + 0.5 && !items.some(i => i.state === 'held')) win();
    const b = track.beats.findLastIndex(b => b.t <= now); if (b !== lastBeat && b >= 0) { lastBeat = b; pulse = track.beats[b].down ? 1 : 0.5; kits.forEach(k => k.bounce = Math.max(k.bounce, 0.25)); }
  }
  pulse *= Math.pow(0.9, dt); wallMat.uniforms.pulse.value = pulse;
  // snacks fall; eaten ones shrink into the mouth, missed ones tumble off the shelf
  for (const it of items) {
    const g = it.g; if (!g) continue;
    if (it.state === 'wait' || it.state === 'passed' || (it.state === 'held')) {
      let y = MOUTH_Y + (it.t - now) * speed;
      if (it.state === 'held') { const p = clamp((now - it.t) / it.len, 0, 1); y = MOUTH_Y - p * g.L; g.snack.visible = false; }
      g.position.y = y; g.visible = y < TOP_Y + 1 && y > -6; g.rotation.y = it.kind === 'bomb' ? Math.sin(clock * 4) * 0.3 : Math.sin(clock * 2.5 + it.t * 3) * 0.6; g.rotation.z = Math.sin(clock * 3 + it.t) * 0.15;
      if (it.state === 'passed') { g.position.y = MOUTH_Y + (it.t - now) * speed; }
      if (it.long && g.stick) { const top = g.position.y + g.L + 0.3; g.visible = g.position.y < TOP_Y + 1 && top > MOUTH_Y - 0.2; }
    } else if (it.state === 'eaten') {
      const k = clamp((now - it.eatAt) * 7, 0, 1); g.scale.setScalar(Math.max(0.001, 1 - k)); g.position.y = lerp(g.position.y, MOUTH_Y + 0.1, 0.4); if (k >= 1) g.visible = false;
    } else if (it.state === 'missed') {
      g.position.y -= 0.12 * dt; g.position.x += (it.lane ? 0.03 : -0.03) * dt; g.rotation.z += 0.1 * dt; if (g.position.y < -7) g.visible = false;
    }
  }
  // kittens: bounce, mouth, sad wobble, dizzy spin
  for (const k of kits) {
    k.open = Math.max(0, k.open - 0.09 * dt); k.bounce = Math.max(0, k.bounce - 0.07 * dt); k.sad = Math.max(0, k.sad - 0.02 * dt);
    const b = ease.out(k.bounce);
    k.scale.set(0.84 * (1 + b * 0.08), 0.84 * (1 - b * 0.06 + Math.sin(clock * 3) * 0.01), 0.84);
    k.head.position.y = 1.78 + b * 0.12; k.head.rotation.z = Math.sin(clock * 2 + k.position.x) * 0.05 + Math.sin(clock * 20) * k.sad * 0.15;
    k.mouth.scale.set(1 + k.open * 0.15, 0.12 + k.open * 0.9, 0.5); k.tongue.visible = k.open < 0.3;
    k.tail.rotation.x = Math.sin(clock * 3) * 0.2;
    if (k.dizzy > 0) { k.rotation.y += 0.3 * dt; k.dizzy = Math.max(0.5, k.dizzy); }
  }
  for (let i = floatHearts.length - 1; i >= 0; i--) { const h = floatHearts[i]; h.life -= 0.022 * dt; h.s.position.y += 0.03 * dt; h.s.position.x += h.vx * dt; h.s.material.opacity = Math.min(1, h.life * 2); if (h.life <= 0) { scene.remove(h.s); h.s.material.dispose(); floatHearts.splice(i, 1); } }
  for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.life -= 0.04 * dt; f.s.scale.setScalar(2 + (1 - f.life) * 6); f.s.material.opacity = f.life; if (f.life <= 0) { scene.remove(f.s); flashes.splice(i, 1); } }
  for (const s of floaters) { s.position.y += s.userData.v * dt; s.position.x += Math.sin(clock + s.position.y) * 0.002; if (s.position.y > 8) s.position.y = -3; }
  // camera: gentle breathing on the beat, fit to narrow screens
  const fitZ = camera.aspect < 0.62 ? 13.5 * (0.62 / camera.aspect) * 0.86 : 13.5;
  camera.position.set(Math.sin(clock * 0.4) * 0.15, 0.9, fitZ - pulse * 0.12); camera.lookAt(0, 0.55, 0);
});

// ---------------------------------------------------------------- boot
buildLevel(); ui.start();
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // munch each snack right on its note (holding long treats); never touch bombs
    if (state !== 'play') return; const now = player.time();
    for (const it of items) { if (it.t - now > 0.5) break; if (it.kind === 'food' && it.state === 'wait' && it.t - now < 0.5) it.bot = true; }
  },
};

// Grindhaven — original 3D skateboarding game. Flick to pop tricks, grind rails and ledges, catch air on quarter pipes,
// chain everything into combos inside a 2-minute session. Original skater, parks, music and code.
import { THREE, createStage, createUI, loop, store, burst, confetti, buzz as kitBuzz, clamp, lerp, rng } from './kit/hc.js';
const buzz = p => { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; } catch (e) {} kitBuzz(p); };
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { PARKS, buildPark } from './park.js';
import { buildSkater, DECKS, OUTFITS } from './skater.js';
import { initAudio, setMuted, isMuted, snd, setRoll } from './audio.js';

const NAME = 'Grindhaven: Skateboard Tricks 3D';
const PI = Math.PI, TAU = PI * 2, V3 = THREE.Vector3;
const SESSION = 120, G = 12, OLLIE = 5.0, CRUISE = 5.6, PUSHMAX = 9.6;
const S = store('grindhaven');
const F = flow('grindhaven', { par: 9000, warmup: 4000 });
const prog = Object.assign({ done: [], best: 0, sessions: 0, park: 'plaza', deck: 'plain', outfit: 0, muted: false }, S.get('prog', {}));
const saveProg = () => S.set('prog', prog);
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------- stage + UI
const stage = createStage({ fov: 52, shadowSize: 14 });
const { scene, camera, renderer, sun, hemi, followLight } = stage;
camera.far = 600; camera.updateProjectionMatrix();
sun.color.set('#fff3dd'); sun.intensity = 1.9; hemi.intensity = 1.05; hemi.groundColor.set('#d8c8b8');
sun.shadow.camera.far = 90;
const ui = createUI({ title: 'GRIND<br>HAVEN', hint: 'Tap to skate · 2-minute session', hand: '🛹', progress: false, score: true });
const D = daily('grindhaven', ui, { name: NAME });
const B = board({ game: 'grindhaven', label: 'Best session', limits: { maxRun: 300000, maxPerSec: 6000 }, corner: 'tl' });
ui.els.start.querySelector('h1').insertAdjacentHTML('afterend', '<p class="gh-tag">Skateboard Tricks 3D</p>');
ui.els.win.querySelector('p').innerHTML = 'SESSION <span data-l>1</span>';
ui.els.win.querySelector('h1').innerHTML = 'TIME!';
ui.els.win.classList.add('dim');

document.body.insertAdjacentHTML('beforeend', `
<div id="goals"></div>
<button id="mute" aria-label="Sound">🔊</button>
<div id="combo"><div class="names"></div><div class="pts"></div></div>
<div id="bal"><i></i><b></b></div>
<div id="padL" class="pad"><div class="ring"><div class="knob"></div></div><span>STEER · drag ↑ to push</span></div>
<div id="padR" class="pad"><div class="flk">↑ ollie<br>↖ kickflip · ↗ heelflip<br>← → shove-it · ↓ manual</div><span>FLICK TRICKS</span></div>
<div id="keys">A/D steer · W push · SPACE ollie · J kickflip · L heelflip · K shove-it · U 360 flip · O varial · I/↓ grab or manual</div>
<div id="panelHome"></div>`);
const $ = id => document.getElementById(id);
const comboEl = $('combo'), balEl = $('bal'), goalsEl = $('goals');
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle('touch', isTouch);
$('mute').textContent = prog.muted ? '🔇' : '🔊';
$('mute').addEventListener('pointerdown', e => { e.stopPropagation(); prog.muted = !prog.muted; saveProg(); setMuted(prog.muted); initAudio(!prog.muted); $('mute').textContent = prog.muted ? '🔇' : '🔊'; });

// ---------------------------------------------------------------- park + skater
let park = null, parkDef = null;
const parkUnlocked = p => p.id === 'plaza' || prog.done.length >= 5 || D.seed;
function loadPark(id) {
  if (park) park.dispose();
  parkDef = PARKS.find(p => p.id === id && parkUnlocked(p)) || PARKS[0];
  park = buildPark(parkDef, scene);
  document.body.style.setProperty('--bg1', parkDef.sky[0]); document.body.style.setProperty('--bg2', parkDef.sky[1]);
  scene.fog = new THREE.Fog(parkDef.sky[1], 70, 170);
  buildBotLines();
}
const deckOf = id => DECKS.find(d => d.id === id && prog.done.length >= d.need) || DECKS[0];
let rider = null;
function loadRider() {
  if (rider) { scene.remove(rider.root); scene.remove(rider.shadow); }
  rider = buildSkater(deckOf(prog.deck), OUTFITS[prog.outfit] || OUTFITS[0]);
  scene.add(rider.root, rider.shadow);
}

// ---------------------------------------------------------------- state
let state = 'ready', score = 0, tLeft = SESSION, overtime = 0, beatenShown = false, recorded = false, t0ms = 0, clock = 0;
const sk = { p: new V3(), v: new V3(), yaw: PI, mode: 'ground', n: new V3(0, 1, 0), air: null, trick: null, grab: null, grind: null, man: null,
  bal: 0, balV: 0, balKick: 1, bailT: 0, land: 0, push: 0, groundT: 0, tumble: 0 };
const inp = { steer: 0, push: false, bal: 0, tSteer: 0, tPush: false, tBal: 0, keys: new Set(), bot: null };
let combo = { items: [], pts: 0 }, goals = [], sessionStats = null;
const dbg = { bails: [], lands: 0, grinds: 0, verts: 0, pops: 0 };
const tmp = new V3(), tmp2 = new V3(), UP = new V3(0, 1, 0);
const fwd = (yaw, out = new V3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
const wrap = a => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
const modPi = a => { a = Math.abs(wrap(a)); return a > PI / 2 ? PI - a : a; };   // 0..π/2, ignoring fakie

function normalAt(x, z, out = new V3()) {
  const e = 0.06, h0 = park.h(x, z);
  const px = park.h(x + e, z) - h0, nx = h0 - park.h(x - e, z), pz = park.h(x, z + e) - h0, nz = h0 - park.h(x, z - e);
  const dx = (Math.abs(px) < Math.abs(nx) ? px : nx) / e, dz = (Math.abs(pz) < Math.abs(nz) ? pz : nz) / e;
  return out.set(-dx, 1, -dz).normalize();
}

function spawn() {
  const [x, z, yaw] = parkDef.spawn;
  sk.p.set(x, park.h(x, z), z); sk.v.set(0, 0, 0); sk.yaw = yaw; sk.mode = 'ground'; sk.air = sk.trick = sk.grab = sk.grind = sk.man = null;
  sk.bal = sk.balV = 0; sk.n.set(0, 1, 0); rider.root.position.copy(sk.p); rider.root.rotation.set(0, yaw, 0); rider.root.quaternion.setFromEuler(rider.root.rotation);
  camYaw = yaw; camera.position.copy(sk.p).addScaledVector(fwd(yaw), -5).add(new V3(0, 2.6, 0)); camLook.copy(sk.p);
}

// ---------------------------------------------------------------- challenges (career) + session goals
const CAREER = [
  { id: 'ollie', text: 'Land an ollie', ev: 'land', test: e => e.names.includes('Ollie') },
  { id: 'kick', text: 'Land a kickflip', ev: 'land', test: e => e.names.includes('Kickflip') },
  { id: 'grind1', text: 'Grind for 1 second', ev: 'grind', test: e => e.t >= 1 },
  { id: 'air', text: 'Catch air on a quarter pipe', ev: 'land', test: e => e.vert },
  { id: 'c1k', text: 'Bank a 1,000 combo', ev: 'bank', test: e => e.total >= 1000 },
  { id: 'man2', text: 'Manual for 2 seconds', ev: 'manual', test: e => e.t >= 2 },
  { id: 'funflip', text: 'Flip trick over the funbox', ev: 'land', test: e => e.over.funbox && e.flips > 0 },
  { id: 'long', text: 'Grind the long rail end to end', ev: 'grind', test: e => e.seg === 'long' && e.cover >= 0.8 },
  { id: 'tre', text: 'Land a 360 Flip', ev: 'land', test: e => e.names.includes('360 Flip') },
  { id: 'slide', text: 'Boardslide a rail', ev: 'grind', test: e => e.kind === 'Boardslide' },
  { id: 'stairs', text: 'Kickflip down the stairs', ev: 'land', test: e => e.from === 'stairs' && e.drop > 0.6 && e.flips > 0 },
  { id: 'c5k', text: 'Bank a 5,000 combo', ev: 'bank', test: e => e.total >= 5000 },
  { id: 'spin540', text: 'Spin a 540', ev: 'land', test: e => e.spinDeg >= 540 },
  { id: 'five', text: 'Chain 5 tricks in one combo', ev: 'bank', test: e => e.count >= 5 },
  { id: 's15', text: 'Score 15,000 in one session', ev: 'session', test: e => e.score >= 15000 },
  { id: 'bowl', text: 'Catch air out of the bowl', ev: 'land', test: e => e.vert && e.from === 'bowl' },
];
const POOL = [
  { text: 'Land 3 kickflips', ev: 'land', need: 3, add: e => e.names.filter(n => n === 'Kickflip').length },
  { text: 'Land 2 heelflips', ev: 'land', need: 2, add: e => e.names.filter(n => n === 'Heelflip').length },
  { text: 'Grind 4 s in total', ev: 'grind', need: 4, add: e => e.t, sec: true },
  { text: 'Catch air 3 times', ev: 'land', need: 3, add: e => e.vert ? 1 : 0 },
  { text: 'Bank a 2,500 combo', ev: 'bank', need: 1, add: e => e.total >= 2500 ? 1 : 0 },
  { text: 'Manual 3 s in total', ev: 'manual', need: 3, add: e => e.t, sec: true },
  { text: 'Land a 360 spin', ev: 'land', need: 1, add: e => e.spinDeg >= 360 ? 1 : 0 },
  { text: 'Hold grabs for 2 s', ev: 'land', need: 2, add: e => e.grabT, sec: true },
  { text: 'Land 10 tricks', ev: 'land', need: 10, add: e => e.names.length },
  { text: 'Land 2 shove-its', ev: 'land', need: 2, add: e => e.names.filter(n => /Shove/.test(n)).length },
  { text: 'Chain a 4-trick combo', ev: 'bank', need: 1, add: e => e.count >= 4 ? 1 : 0 },
];
function pickGoals() {
  const r = rng(D.seed ? D.seed * 7 + 3 : (Date.now() % 1e9) + 11), pool = POOL.slice(); goals = [];
  while (goals.length < 3) { const g = pool.splice(Math.floor(r() * pool.length), 1)[0]; goals.push({ ...g, have: 0, done: false }); }
  paintGoals();
}
function paintGoals() {
  goalsEl.innerHTML = goals.map(g => `<div class="${g.done ? 'ok' : ''}"><i>${g.done ? '✓' : ''}</i>${g.text}<small>${g.done ? '' : g.sec ? g.have.toFixed(1) + '/' + g.need : Math.floor(g.have) + '/' + g.need}</small></div>`).join('');
}
function event(ev, e) {
  for (const c of CAREER) if (c.ev === ev && !prog.done.includes(c.id) && c.test(e)) {
    prog.done.push(c.id); saveProg(); snd.chime(); confetti(scene, sk.p.clone().add(new V3(0, 1.5, 0)), 40);
    const n = prog.done.length, deck = DECKS.find(d => d.need === n), outfit = [0, 3, 7].indexOf(n);
    toast(`🏅 ${c.text}${deck ? ` · unlocked the <b>${deck.name}</b> deck` : n === 5 ? ' · unlocked <b>Driftwood Bowl</b>' : outfit > 0 ? ' · unlocked a new outfit' : ''}`);
  }
  if (state !== 'play') return;
  let changed = false;
  for (const g of goals) if (!g.done && g.ev === ev) {
    const a = g.add(e); if (!a) continue; g.have = Math.min(g.need, g.have + a); changed = true;
    if (g.have >= g.need) { g.done = true; score += 1500; ui.pop('GOAL! +1,500', '#ffd23f', 34, 30); snd.chime(); confetti(scene, sk.p.clone().add(new V3(0, 1.2, 0)), 50); buzz([20, 40, 20]); }
  }
  if (changed) paintGoals();
}
let toastT = 0;
function toast(html) {
  let t = $('ghToast'); if (!t) { t = document.createElement('div'); t.id = 'ghToast'; document.body.appendChild(t); }
  t.innerHTML = html; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200);
}

// ---------------------------------------------------------------- combo
function addItem(name, pts) {
  const rep = combo.items.filter(i => i.name === name).length;
  pts = Math.round(pts * Math.max(0.125, Math.pow(0.5, rep)) / 5) * 5;
  combo.items.push({ name, pts }); combo.pts += pts;
}
function bank() {
  if (!combo.items.length) return;
  const count = combo.items.length, total = combo.pts * count;
  score += total; snd.bank(count);
  if (count >= 2 || total >= 500) ui.pop(`+${fmt(total)}`, count >= 4 ? '#ffd23f' : '#ffffff', count >= 4 ? 42 : 34, 22);
  if (total >= 3000) confetti(scene, sk.p.clone().add(new V3(0, 1.2, 0)), 30);
  event('bank', { total, count });
  combo = { items: [], pts: 0 }; comboEl.classList.add('banked'); setTimeout(() => comboEl.classList.remove('banked'), 400);
}
function loseCombo() {
  if (combo.items.length) { comboEl.querySelector('.names').textContent = 'BAIL! combo lost'; comboEl.classList.add('lost'); setTimeout(() => comboEl.classList.remove('lost'), 900); }
  combo = { items: [], pts: 0 };
}
function paintCombo() {
  const live = [];
  if (sk.mode === 'air' && sk.air) { for (const i of sk.air.items) live.push(i.name); if (sk.trick) live.push(sk.trick.name); if (sk.grab) live.push(sk.grab.name); }
  if (sk.mode === 'grind' && sk.grind) live.push(sk.grind.kind);
  if (sk.mode === 'manual') live.push('Manual');
  const names = combo.items.map(i => i.name), all = names.concat(live.map(n => `<em>${n}</em>`));
  if (!all.length) { if (!comboEl.classList.contains('lost')) comboEl.classList.remove('on'); return; }
  comboEl.classList.add('on');
  comboEl.querySelector('.names').innerHTML = (all.length > 4 ? '… + ' : '') + all.slice(-4).join(' + ');
  const pending = sk.mode === 'grind' && sk.grind ? grindPts(sk.grind) : sk.mode === 'manual' && sk.man ? 100 + sk.man.t * 100 : 0;
  comboEl.querySelector('.pts').innerHTML = `${fmt(combo.pts + pending)} <span>× ${Math.max(1, combo.items.length + live.length)}</span>`;
}

// ---------------------------------------------------------------- tricks
const FLIPS = {
  ul: { name: 'Kickflip', flip: 1, shove: 0, dur: 0.42, pts: 300 },
  ur: { name: 'Heelflip', flip: -1, shove: 0, dur: 0.42, pts: 300 },
  l: { name: 'Shove-it', flip: 0, shove: 1, dur: 0.38, pts: 250 },
  r: { name: 'FS Shove-it', flip: 0, shove: -1, dur: 0.38, pts: 250 },
  dl: { name: '360 Flip', flip: 1, shove: 2, dur: 0.55, pts: 650 },
  dr: { name: 'Varial Heelflip', flip: -1, shove: 1, dur: 0.5, pts: 600 },
};
function ollie(power = 1) {
  const from = sk.mode;
  if (from === 'grind') { creditGrind(); sk.v.copy(sk.grind.s.d).multiplyScalar(sk.grind.sp); railYaw(); sk.v.y += OLLIE * 0.9 * power; sk.grind = null; }
  else if (from === 'manual') { creditManual(); sk.v.addScaledVector(sk.n, OLLIE * power); }
  else sk.v.addScaledVector(sk.n, OLLIE * power);
  goAir(false); sk.air.popped = true; dbg.pops++; snd.pop(); buzz(8); sk.land = -0.6;
}
function flick(dir) {
  if (state !== 'play' || sk.mode === 'bail') return;
  if (sk.mode === 'air') {
    if (dir === 'u' || dir === 'd') { if (!sk.trick && !sk.grab) sk.grab = { name: dir === 'u' ? 'Indy Grab' : 'Melon Grab', t: 0 }; return; }
    if (!sk.trick && !sk.grab) startFlip(dir); return;
  }
  if (dir === 'd') { if (sk.mode === 'ground' && sk.v.length() > 1.5 && sk.n.y > 0.9) { sk.mode = 'manual'; sk.man = { t: 0 }; sk.bal = (Math.random() - 0.5) * 0.2; sk.balV = 0; sk.groundT = 0; } return; }
  ollie();
  if (dir !== 'u') startFlip(dir);
}
function startFlip(dir) { const f = FLIPS[dir]; if (!f) return; sk.trick = { ...f, t: 0, pop: sk.mode === 'air' && sk.air && sk.air.t < 0.1 }; snd.flip(); }
function releaseGrab() { if (sk.grab && sk.air) { const g = sk.grab; if (g.t > 0.12) { sk.air.items.push({ name: g.name, pts: 200 + g.t * 300 }); sk.air.grabT += g.t; } } sk.grab = null; }

// ---------------------------------------------------------------- physics
function goAir(vert, gh) {
  const prev = sk.mode;
  sk.mode = 'air';
  sk.air = { t: 0, items: [], vert, gh, spin: 0, auto: 0, autoDir: 1, autoRate: 0, startY: sk.p.y, maxY: sk.p.y, over: {}, from: park.over(sk.p.x, sk.p.z) || (prev === 'grind' ? 'rail' : ''), flips: 0, grabT: 0, popped: false };
  if (vert) {
    const air = 2 * Math.max(1, sk.v.y) / G;
    const target = Math.atan2(-gh.x, -gh.z);              // face back down the ramp
    const d = wrap(target - sk.yaw); sk.air.auto = Math.abs(d); sk.air.autoDir = Math.sign(d) || 1; sk.air.autoRate = sk.air.auto / (air * 0.75);
  }
}
function vertLaunch(gh) {
  dbg.verts++;
  const sp = sk.v.length(), tx = -gh.z, tz = gh.x, vt = sk.v.x * tx + sk.v.z * tz, vy = Math.max(sk.v.y, sp * 0.9) * 1.12;
  sk.v.set(tx * vt * 0.85 - gh.x * 0.75, vy, tz * vt * 0.85 - gh.z * 0.75);
  goAir(true, gh);
}
function stepGround(h) {
  const n = normalAt(sk.p.x, sk.p.z, sk.n), v = sk.v;
  v.addScaledVector(n, G * n.y * h); v.y -= G * h;           // gravity along the surface
  const sp = v.length(), f = fwd(sk.yaw, tmp), ride = v.dot(f) >= 0 ? 1 : -1;
  const turn = -inp.steer * (2.7 - Math.min(1.2, sp * 0.09)) * (sk.mode === 'manual' ? 0.5 : 1) * h;
  if (turn) { const c = Math.cos(turn), s = Math.sin(turn), x = v.x; v.x = x * c + v.z * s; v.z = -x * s + v.z * c; sk.yaw += turn; }
  if (sk.mode === 'ground' && n.y > 0.93) {
    const target = inp.push ? PUSHMAX : CRUISE;
    if (sp < target) { v.addScaledVector(f, ride * (inp.push ? 7 : 3.2) * h); sk.push = Math.min(1, sk.push + h * 3); }
  }
  v.multiplyScalar(1 - (sk.mode === 'manual' ? 0.12 : 0.07) * h);
  const ox = sk.p.x, oz = sk.p.z, oy = sk.p.y;
  sk.p.addScaledVector(v, h);
  bounds();
  const hn = park.h(sk.p.x, sk.p.z);
  if (hn - sk.p.y > 0.25) {                                 // ran into a wall / box side
    sk.p.x = ox; sk.p.z = oz; sk.p.y = Math.max(oy, park.h(ox, oz)); v.y = Math.max(0, v.y);
    const wx = park.h(ox + v.x * h * 3, oz) - sk.p.y > 0.25, wz = park.h(ox, oz + v.z * h * 3) - sk.p.y > 0.25;
    if (wx || !wz) v.x *= -0.35; if (wz || !wx) v.z *= -0.35;
    if (sp > 3) { snd.bonk(); buzz(20); }
    if (sk.mode === 'manual') endManual();
    return;
  }
  if (sk.p.y - hn > 0.07) { if (sk.mode === 'manual') creditManual(); goAir(false); return; }
  sk.p.y = hn;
  const n2 = normalAt(sk.p.x, sk.p.z, sk.n), mag = v.length();
  v.addScaledVector(n2, -v.dot(n2)); if (v.lengthSq() > 1e-6) v.setLength(mag);
  if (n2.y < 0.47 && v.y > 1.0) { const gh = tmp2.set(-n2.x, 0, -n2.z).normalize(); if (sk.mode === 'manual') creditManual(); vertLaunch(gh.clone()); return; }
  const hs = Math.hypot(v.x, v.z);
  if (hs > 0.35) { let t = Math.atan2(v.x, v.z); if (Math.abs(wrap(t - sk.yaw)) > PI / 2) t += PI; sk.yaw = sk.yaw + wrap(t - sk.yaw); }
  if (sk.mode === 'manual' && n2.y < 0.9) endManual();
}
function bounds() {
  const L = park.B - 0.5;
  if (sk.p.x > L) { sk.p.x = L; sk.v.x = -Math.abs(sk.v.x) * 0.4; } if (sk.p.x < -L) { sk.p.x = -L; sk.v.x = Math.abs(sk.v.x) * 0.4; }
  if (sk.p.z > L) { sk.p.z = L; sk.v.z = -Math.abs(sk.v.z) * 0.4; } if (sk.p.z < -L) { sk.p.z = -L; sk.v.z = Math.abs(sk.v.z) * 0.4; }
}
function stepAir(h) {
  const a = sk.air, v = sk.v;
  v.y -= G * h; const ox = sk.p.x, oz = sk.p.z, oy = sk.p.y, bx = v.x, bz = v.z; sk.p.addScaledVector(v, h); bounds(); if (bx * v.x < 0 || bz * v.z < 0) railYaw();
  a.t += h; a.maxY = Math.max(a.maxY, sk.p.y);
  const spin = a.t < 0.12 ? 0 : -inp.steer * 7.2 * h; sk.yaw += spin; a.spin += spin;
  if (a.auto > 0) { const d = Math.min(a.auto, a.autoRate * h); sk.yaw += d * a.autoDir; a.auto -= d; }
  const o = park.over(sk.p.x, sk.p.z); if (o) a.over[o] = 1;
  if (sk.trick) { sk.trick.t += h; if (sk.trick.t >= sk.trick.dur) { a.items.push({ name: sk.trick.name, pts: sk.trick.pts }); a.flips++; sk.trick = null; } }
  if (sk.grab) sk.grab.t += h;
  if (v.y < 0.5 && tryGrind()) return;
  const hn = park.h(sk.p.x, sk.p.z);
  if (sk.p.y <= hn) {
    if (v.y > 0 && a.t < 0.25) sk.p.y = hn;                 // still rising off a slope: ride over it
    else if (hn - sk.p.y < 0.45 || oy <= park.h(ox, oz)) land(hn);
    else { sk.p.x = ox; sk.p.z = oz; v.x *= -0.3; v.z *= -0.3; railYaw(); snd.bonk(); }
  }
}
function tryGrind() {
  for (const s of park.segs) {
    const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, u = ((sk.p.x - s.a.x) * dx + (sk.p.z - s.a.z) * dz) / (dx * dx + dz * dz);
    if (u < 0.02 || u > 0.97) continue;
    const cx = s.a.x + u * dx, cz = s.a.z + u * dz, dist = Math.hypot(sk.p.x - cx, sk.p.z - cz), ry = s.a.y + u * (s.b.y - s.a.y);
    if (dist > 0.5 || sk.p.y - ry > 0.32 || sk.p.y - ry < -0.3) continue;
    const along = sk.v.dot(s.d); if (Math.abs(along) < 1.2) continue;
    if (sk.trick && sk.trick.t / sk.trick.dur < 0.7) continue;
    // lock on
    finishAirTricks(1, true);
    const ang = modPi(sk.yaw - Math.atan2(s.d.x, s.d.z));
    const kind = s.kind === 'rail' ? (ang < 0.5 ? '50-50' : ang > 1.0 ? 'Boardslide' : 'Smith Grind') : (ang < 0.5 ? '5-0 Grind' : ang > 1.0 ? 'Noseslide' : 'Crooked Grind');
    sk.mode = 'grind'; sk.grind = { s, u, u0: u, sp: along, kind, t: 0, spark: 0 }; sk.bal = (Math.random() - 0.5) * 0.3; sk.balV = 0;
    if (ang > 1.0) sk.yaw = Math.atan2(s.d.x, s.d.z) + PI / 2 * Math.sign(wrap(sk.yaw - Math.atan2(s.d.x, s.d.z)) || 1);
    else if (ang < 0.5) sk.yaw = Math.atan2(s.d.x, s.d.z) + (Math.abs(wrap(sk.yaw - Math.atan2(s.d.x, s.d.z))) > PI / 2 ? PI : 0);
    snd.grindOn(); buzz(12); dbg.grinds++;
    return true;
  }
  return false;
}
const grindPts = g => { const base = g.kind === '50-50' || g.kind === '5-0 Grind' ? [150, 120] : g.kind === 'Boardslide' || g.kind === 'Noseslide' ? [220, 140] : [250, 150]; return (base[0] + base[1] * g.t) * (g.s.name === 'handrail' ? 1.4 : 1); };
function railYaw() { const t = Math.atan2(sk.v.x, sk.v.z); if (Math.hypot(sk.v.x, sk.v.z) > 0.2) sk.yaw = t + (Math.abs(wrap(t - sk.yaw)) > PI / 2 + 0.05 ? PI : 0); }
function creditGrind() {
  const g = sk.grind; if (!g) return;
  if (g.t > 0.15) { addItem((g.s.name === 'handrail' ? 'Handrail ' : '') + g.kind, grindPts(g)); event('grind', { t: g.t, seg: g.s.name, kind: g.kind, cover: Math.abs(g.u - g.u0) }); }
}
function stepGrind(h) {
  const g = sk.grind, s = g.s;
  g.sp += -G * s.d.y * h; g.sp *= 1 - 0.16 * h; g.t += h;
  g.u += g.sp * h / s.L;
  sk.p.copy(s.a).addScaledVector(s.d, g.u * s.L);
  sk.v.copy(s.d).multiplyScalar(g.sp);
  balance(h, inp.steer);
  g.spark += h; if (g.spark > 0.06) { g.spark = 0; burst(scene, sk.p.clone().add(new V3(0, 0.05, 0)), ['#ffd23f', '#ffffff', '#ff8c42'], 3, { speed: 0.06, up: 0.05, size: 0.25, gravity: 0.01, life: 0.6 }); }
  if (Math.abs(sk.bal) > 1) return bail('Lost balance!');
  if (g.u < 0 || g.u > 1 || Math.abs(g.sp) < 0.5) { creditGrind(); sk.grind = null; railYaw(); sk.v.y += 1.2; goAir(false); }
}
function balance(h, input) {
  const k = F.k(score);
  sk.balKick -= h; if (sk.balKick < 0) { sk.balKick = 0.35 + Math.random() * 0.6; sk.balV += (Math.random() - 0.5) * 1.6 * k; }
  sk.balV += (sk.bal * 1.7 * k + input * 4.2) * h; sk.balV *= 1 - 1.3 * h; sk.bal += sk.balV * h;
}
function creditManual() { const m = sk.man; if (m && m.t > 0.3) { addItem('Manual', 100 + m.t * 100); event('manual', { t: m.t }); } sk.man = null; if (sk.mode === 'manual') sk.mode = 'ground'; }
function endManual() { creditManual(); sk.mode = 'ground'; sk.groundT = 0; }
function finishAirTricks(mult, intoGrind = false) {
  const a = sk.air; if (!a) return null;
  if (sk.trick && sk.trick.t / sk.trick.dur >= 0.7) { a.items.push({ name: sk.trick.name, pts: sk.trick.pts }); a.flips++; }
  sk.trick = null; releaseGrab();
  const k = Math.round(Math.abs(a.spin) / PI), hgt = a.maxY - Math.max(a.startY, park.h(sk.p.x, sk.p.z));
  const items = a.items.slice();
  if (a.vert) items.unshift({ name: `${180 + k * 180} Air`.replace(/^180 Air/, 'Air'), pts: 200 + Math.max(0, hgt) * 120 + k * 300 });
  else if (k >= 1) items.push({ name: `${k * 180} Spin`, pts: [0, 200, 500, 900, 1400, 2000][Math.min(5, k)] });
  if (!items.length && a.popped && !intoGrind) items.push({ name: 'Ollie', pts: 100 + (a.t > 0.75 ? 50 : 0) });
  for (const i of items) addItem(i.name, i.pts * mult);
  return { names: items.map(i => i.name), vert: a.vert, over: a.over, flips: a.flips, spinDeg: (a.vert ? 180 : 0) + k * 180, from: a.from, drop: a.startY - sk.p.y, grabT: a.grabT };
}
function land(hn) {
  const a = sk.air, n = normalAt(sk.p.x, sk.p.z, sk.n), v = sk.v;
  sk.p.y = hn;
  const ahs = Math.hypot(v.x, v.z), airDir = a && a.vert ? (n.y < 0.99 ? Math.atan2(n.x, n.z) : Math.atan2(-a.gh.x, -a.gh.z)) : n.y < 0.8 ? Math.atan2(n.x, n.z) : ahs > 0.3 ? Math.atan2(v.x, v.z) : sk.yaw;
  const impact = -v.dot(n); v.addScaledVector(n, impact);
  const hs = Math.hypot(v.x, v.z), dir = hs > 0.3 ? Math.atan2(v.x, v.z) : sk.yaw;
  const err = modPi(sk.yaw - airDir), tol = 0.6 / F.k(score);
  const tr = sk.trick ? sk.trick.t / sk.trick.dur : 1;
  if (err > tol * 1.5 || tr < 0.72 || impact > 15) { dbg.last = { err: +err.toFixed(2), yaw: +sk.yaw.toFixed(2), airDir: +airDir.toFixed(2), ny: +n.y.toFixed(2), impact: +impact.toFixed(1), tr: +tr.toFixed(2), spin: +(a ? a.spin : 0).toFixed(2), vert: a && a.vert }; return bail(tr < 0.72 ? 'Under-rotated!' : impact > 15 ? 'Too hard!' : 'Sideways!'); }
  const sketchy = err > tol * 0.65 || tr < 1 || (sk.grab && sk.grab.t > 0.1);
  const res = finishAirTricks(sketchy ? 0.5 : 1);
  sk.mode = 'ground'; sk.air = null; sk.groundT = 0; dbg.lands++;
  sk.yaw = dir + (Math.abs(wrap(dir - sk.yaw)) > PI / 2 ? PI : 0);
  sk.land = Math.min(1, impact / 8 + 0.3);
  snd.land(Math.min(1, 0.4 + impact / 10)); buzz(sketchy ? 25 : 10);
  burst(scene, sk.p.clone().add(new V3(0, 0.05, 0)), '#e8e2d8', 8, { speed: 0.05, up: 0.02, size: 0.6, gravity: 0.002, life: 0.6 });
  if (res && res.names.length) {
    if (sketchy) ui.pop('Sketchy', '#ffcf8a', 26, 64); else if (res.names.length && res.names[0] !== 'Ollie') ui.pop(['Clean!', 'Smooth!', 'Stomped!'][Math.floor(Math.random() * 3)], '#b8ffb0', 26, 64);
    event('land', { ...res, clean: !sketchy });
  }
}
function bail(why) {
  if (sk.mode === 'manual') sk.man = null;
  sk.mode = 'bail'; sk.bailT = 1.3; sk.tumble = 0; sk.trick = null; sk.grab = null; sk.air = null; sk.grind = null;
  dbg.bails.push(why); loseCombo(); snd.bail(); buzz([30, 30, 60]); ui.pop(why || 'BAIL!', '#ff8a8a', 30, 64);
  sk.v.y = Math.max(0, sk.v.y);
  burst(scene, sk.p.clone().add(new V3(0, 1.2, 0)), ['#ffd23f', '#ffffff'], 10, { speed: 0.08, up: 0.08, size: 0.5, shape: 'sphere', gravity: 0.004 });
}
function stepBail(h) {
  sk.bailT -= h; sk.tumble += h;
  sk.v.y -= G * h; sk.p.addScaledVector(sk.v, h); bounds();
  const hn = park.h(sk.p.x, sk.p.z); if (sk.p.y < hn) { sk.p.y = hn; sk.v.y = 0; }
  sk.v.x *= 1 - 2.5 * h; sk.v.z *= 1 - 2.5 * h;
  if (sk.bailT <= 0) { sk.mode = 'ground'; sk.v.set(0, 0, 0); sk.p.y = park.h(sk.p.x, sk.p.z); sk.bal = 0; sk.groundT = 0; }
}

function physics(dt) {
  const n = Math.min(12, Math.ceil(dt / (1 / 240))), h = dt / n;
  for (let i = 0; i < n; i++) {
    if (sk.mode === 'ground' || sk.mode === 'manual') stepGround(h);
    else if (sk.mode === 'air') stepAir(h);
    else if (sk.mode === 'grind') stepGrind(h);
    else if (sk.mode === 'bail') stepBail(h);
  }
  if (sk.mode === 'manual') {
    sk.man.t += dt; balance(dt, inp.bal);
    if (Math.abs(sk.bal) > 1) { sk.man = null; bail('Tail drag!'); }
  }
  if (sk.mode === 'ground') { sk.groundT += dt; if (sk.groundT > 0.75 && combo.items.length) bank(); }
}

// ---------------------------------------------------------------- render sync
let camYaw = PI; const camLook = new V3(), qT = new THREE.Quaternion(), mB = new THREE.Matrix4(), xA = new V3(), zA = new V3(), yA = new V3();
function syncRider(dt, t) {
  const R = rider, root = R.root;
  root.position.copy(sk.p);
  if (sk.mode === 'grind') root.position.y -= 0.08;
  if (sk.mode === 'bail') {
    root.rotation.order = 'YXZ'; root.rotation.set(Math.min(1.45, sk.tumble * 5), sk.yaw, Math.sin(sk.tumble * 9) * 0.3);
    R.boardPivot.rotation.set(sk.tumble * 6, sk.tumble * 4, 0); R.boardPivot.position.set(0.4, 0.15 + Math.sin(Math.min(PI, sk.tumble * 4)) * 0.5, 0.6);
    R.pose(t, { crouch: 0.8, wobble: 1, balance: 0 });
  } else {
    const up = sk.mode === 'ground' || sk.mode === 'manual' ? sk.n : (sk.mode === 'air' && sk.air && sk.air.vert && sk.air.t < 0.15 ? sk.n : UP);
    yA.copy(up); fwd(sk.yaw, zA); zA.addScaledVector(yA, -zA.dot(yA)).normalize(); xA.crossVectors(yA, zA);
    mB.makeBasis(xA, yA, zA); qT.setFromRotationMatrix(mB);
    root.quaternion.slerp(qT, 1 - Math.exp(-(sk.mode === 'air' ? 8 : 20) * dt));
    // board flips
    const tr = sk.trick, e = tr ? Math.min(1, tr.t / tr.dur) : 0, ease = 1 - Math.pow(1 - e, 2);
    R.boardPivot.position.set(0, 0.15, 0);
    R.boardPivot.rotation.order = 'YZX';
    R.boardPivot.rotation.set(sk.mode === 'manual' ? -0.28 : 0, tr ? tr.shove * PI * ease : 0, tr ? tr.flip * TAU * ease : 0);
    if (sk.mode === 'manual') R.boardPivot.position.y = 0.22;
    const air = sk.mode === 'air', tuck = air ? (tr ? 0.9 : sk.grab ? 0.7 : 0.35) : 0;
    if (tr) R.boardPivot.position.y = 0.15 + Math.sin(e * PI) * 0.12;
    sk.land = Math.max(0, sk.land - dt * 3);
    sk.push = Math.max(0, sk.push - dt * 0.6);
    const crouch = sk.mode === 'grind' ? 0.55 : clamp(0.25 + Math.abs(sk.land) * 0.7 + (air ? 0.2 : 0), 0, 1);
    R.pose(t, { crouch, lean: -inp.steer * 0.6, grab: sk.grab ? 1 : 0, push: sk.mode === 'ground' && sk.push > 0.3 && sk.n.y > 0.95 ? (t * 1.4) % 1 : 0, tuck,
      balance: sk.mode === 'grind' || sk.mode === 'manual' ? sk.bal * 0.6 : 0, wobble: sk.mode === 'grind' ? Math.min(1, Math.abs(sk.bal)) : 0 });
  }
  const gy = park.h(sk.p.x, sk.p.z), ht = Math.max(0, sk.p.y - gy);
  R.shadow.position.set(sk.p.x, gy + 0.03, sk.p.z); R.shadow.scale.setScalar(1 / (1 + ht * 0.5)); R.shadow.material.opacity = 0.2 / (1 + ht);
  R.shadow.visible = gy > -0.5 || true;
}
function syncCamera(dt) {
  const hs = Math.hypot(sk.v.x, sk.v.z);
  if ((sk.mode === 'ground' || sk.mode === 'grind' || sk.mode === 'manual') && hs > 1.2 && sk.n.y > 0.8) {
    const want = Math.atan2(sk.v.x, sk.v.z); camYaw += wrap(want - camYaw) * (1 - Math.exp(-2.4 * dt));
  }
  const portrait = innerWidth / innerHeight < 0.8, dist = portrait ? 6.4 : 5.4, ht = portrait ? 3.3 : 2.6;
  const f = fwd(camYaw, tmp);
  const target = tmp2.copy(sk.p).addScaledVector(f, -dist); target.y = Math.max(sk.p.y, park.h(sk.p.x, sk.p.z)) * 0.85 + ht + (sk.mode === 'air' ? 0.4 : 0);
  target.y = Math.max(target.y, park.h(target.x, target.z) + 1.0);
  camera.position.lerp(target, 1 - Math.exp(-7 * dt));
  const look = new V3().copy(sk.p).addScaledVector(f, 2.4); look.y = sk.p.y + 0.9;
  camLook.lerp(look, 1 - Math.exp(-10 * dt)); camera.lookAt(camLook);
  followLight(sk.p);
}

// ---------------------------------------------------------------- input (touch pads + keys)
const touches = new Map();
function dirOf(dx, dy) {
  const a = Math.atan2(-dy, dx) * 180 / PI;    // 0 = right, 90 = up
  if (a >= 67.5 && a < 112.5) return 'u'; if (a >= 112.5 && a < 157.5) return 'ul'; if (a >= 22.5 && a < 67.5) return 'ur';
  if (a >= 157.5 || a < -157.5) return 'l'; if (a >= -22.5 && a < 22.5) return 'r';
  if (a >= -157.5 && a < -112.5) return 'dl'; if (a >= -67.5 && a < -22.5) return 'dr'; return 'd';
}
addEventListener('pointerdown', e => {
  initAudio(!prog.muted);
  if (state !== 'play') return;
  const left = e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.45;
  touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now(), left, done: false });
  if (left) { $('padL').classList.add('act'); }
});
addEventListener('pointermove', e => {
  const T = touches.get(e.pointerId); if (!T) return;
  const dx = e.clientX - T.x0, dy = e.clientY - T.y0;
  if (T.left) { inp.tSteer = clamp(dx / 55, -1, 1); inp.tPush = dy < -28; inp.tBal = clamp(-dy / 55, -1, 1); const k = $('padL').querySelector('.knob'); k.style.transform = `translate(${clamp(dx, -40, 40)}px,${clamp(dy, -40, 40)}px)`; return; }
  if (!T.done && Math.hypot(dx, dy) > 26 && performance.now() - T.t0 < 380) { T.done = true; T.dir = dirOf(dx, dy); flick(T.dir); flashPad(); }
});
function endTouch(e) {
  const T = touches.get(e.pointerId); if (!T) return; touches.delete(e.pointerId);
  if (T.left) { inp.tSteer = 0; inp.tPush = false; inp.tBal = 0; $('padL').classList.remove('act'); $('padL').querySelector('.knob').style.transform = ''; return; }
  if (!T.done && performance.now() - T.t0 < 300) { flick('u'); flashPad(); }
  if (sk.grab) releaseGrab();
}
addEventListener('pointerup', endTouch); addEventListener('pointercancel', endTouch);
function flashPad() { const p = $('padR'); p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit'); }
const KEYMAP = { Space: 'u', KeyJ: 'ul', KeyL: 'ur', KeyK: 'l', KeyU: 'dl', KeyO: 'dr', KeyI: 'u', KeyS: 'd', ArrowDown: 'd' };
addEventListener('keydown', e => {
  initAudio(!prog.muted);
  if (e.code === 'KeyM') { $('mute').dispatchEvent(new PointerEvent('pointerdown')); return; }
  if (inp.keys.has(e.code)) return; inp.keys.add(e.code);
  if (state === 'play' && KEYMAP[e.code]) {
    e.preventDefault();
    if ((e.code === 'KeyS' || e.code === 'ArrowDown') && sk.mode === 'manual') return;
    if (e.code === 'KeyI' && sk.mode !== 'air') return;
    flick(KEYMAP[e.code]);
  } else if (state !== 'play' && (e.code === 'Space' || e.code === 'Enter')) { const c = [ui.els.start, ui.els.win].find(c => !c.classList.contains('hc-hidden')); if (c) c.dispatchEvent(new PointerEvent('pointerdown')); }
});
addEventListener('keyup', e => { inp.keys.delete(e.code); if ((e.code === 'KeyI' || e.code === 'KeyS' || e.code === 'ArrowDown' || e.code === 'Space') && sk.grab) releaseGrab(); });
addEventListener('blur', () => inp.keys.clear());
function readInput() {
  const K = inp.keys, kSteer = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
  const kUp = K.has('KeyW') || K.has('ArrowUp'), kDown = K.has('KeyS') || K.has('ArrowDown');
  if (inp.bot && performance.now() - inp.bot.at < 400) { inp.steer = inp.bot.steer; inp.push = inp.bot.push; inp.bal = inp.bot.bal; return; }
  inp.steer = clamp(kSteer + inp.tSteer, -1, 1); inp.push = kUp || inp.tPush; inp.bal = clamp((kUp ? 1 : 0) - (kDown ? 1 : 0) + inp.tBal, -1, 1);
}

// ---------------------------------------------------------------- session flow
function panelHTML(full) {
  const n = prog.done.length, next = CAREER.filter(c => !prog.done.includes(c.id)).slice(0, 2);
  const parks = PARKS.map(p => `<button data-park="${p.id}" class="${p.id === parkDef.id ? 'on' : ''} ${parkUnlocked(p) ? '' : 'lock'}">${parkUnlocked(p) ? '' : '🔒 '}${p.name}</button>`).join('');
  const deck = deckOf(prog.deck), nd = DECKS.filter(d => n >= d.need).length;
  return `<div class="row stats"><span>Best <b>${fmt(prog.best)}</b></span><span>Challenges <b>${n}/${CAREER.length}</b></span></div>
    <div class="row">${parks}</div>
    <div class="row"><button data-deck>🛹 ${deck.name} <small>${nd}/${DECKS.length}</small></button><button data-fit>👕 Outfit</button></div>
    ${full && next.length ? `<div class="next">${next.map(c => `<div>◻︎ ${c.text}</div>`).join('')}</div>` : ''}`;
}
function showPanel(card, full) {
  let p = $('ghPanel'); if (!p) { p = document.createElement('div'); p.id = 'ghPanel'; p.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); }); p.addEventListener('click', onPanel); }
  p.innerHTML = panelHTML(full); const anchor = card.querySelector('.hint'); card.insertBefore(p, anchor);
}
function onPanel(e) {
  const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); initAudio(!prog.muted); snd.tick();
  if (b.dataset.park) { const p = PARKS.find(x => x.id === b.dataset.park); if (!parkUnlocked(p)) { toast('🔒 Finish 5 challenges to open ' + p.name); return; } prog.park = p.id; saveProg(); loadPark(p.id); spawn(); }
  if (b.hasAttribute('data-deck')) { const list = DECKS.filter(d => prog.done.length >= d.need), i = list.findIndex(d => d.id === deckOf(prog.deck).id); prog.deck = list[(i + 1) % list.length].id; saveProg(); rider.setDeck(deckOf(prog.deck)); }
  if (b.hasAttribute('data-fit')) { const opts = [0, 3, 7].map((need, i) => prog.done.length >= need ? i : -1).filter(i => i >= 0); prog.outfit = opts[(opts.indexOf(prog.outfit) + 1) % opts.length]; saveProg(); const pos = sk.p.clone(), yaw = sk.yaw; loadRider(); rider.root.position.copy(pos); rider.root.rotation.y = yaw; }
  const card = [ui.els.start, ui.els.win].find(c => !c.classList.contains('hc-hidden')); if (card) showPanel(card, card === ui.els.start);
}
function startSession() {
  state = 'play'; score = 0; tLeft = SESSION; overtime = 0; beatenShown = false; recorded = false; combo = { items: [], pts: 0 };
  spawn(); pickGoals(); B.start(); t0ms = performance.now(); document.body.classList.add('playing');
  ui.score('0'); ui.sub(prog.best ? `BEST ${fmt(prog.best)}` : ''); ui.pill('2:00');
}
function endSession() {
  bank(); state = 'won'; document.body.classList.remove('playing'); comboEl.classList.remove('on'); balEl.classList.remove('on');
  const ms = performance.now() - t0ms, newBest = score > prog.best;
  if (!recorded) { recorded = true; F.endless(score); B.submit(score, { ms }); }
  prog.sessions++; if (newBest) prog.best = score; saveProg();
  event('session', { score });
  D.won(score, 'scored');
  ui.win(prog.sessions, `${fmt(score)} points${newBest ? ' · NEW BEST!' : ` · best ${fmt(prog.best)}`} · ${goals.filter(g => g.done).length}/3 goals`);
  setTimeout(() => showPanel(ui.els.win, false), 660);
  if (newBest) confetti(scene, sk.p.clone().add(new V3(0, 1.5, 0)), 80);
  setRoll(0, false, false);
}
ui.onTap(() => { initAudio(!prog.muted); const p = $('ghPanel'); if (p) p.remove(); startSession(); });

// ---------------------------------------------------------------- bot (QA): rides lines to rails, funbox, ramps and pops tricks
let botLines = [], botLine = null, botWp = 0, botStuck = 0, botTrickCd = 0;
function buildBotLines() {
  botLines = [];
  const W = (e, lx, lz) => { const c = Math.cos(e.r), s = Math.sin(e.r); return new V3(e.x + lx * c + lz * s, 0, e.z - lx * s + lz * c); };
  for (const s of park.segs) {
    if (s.a.y > 0.7 || Math.abs(s.a.y - s.b.y) > 0.05) continue;
    for (const dir of [1, -1, 1, -1]) {
      const a = dir > 0 ? s.a : s.b, d = s.d.clone().multiplyScalar(dir); d.y = 0; d.normalize();
      const side = new V3(-d.z, 0, d.x).multiplyScalar(s.kind === 'ledge' ? 0 : 0);
      botLines.push([{ p: a.clone().addScaledVector(d, -10).add(side), r: 1.5 }, { p: a.clone().addScaledVector(d, -4.5), r: 1.0 }, { p: a.clone().addScaledVector(d, -1.3), r: 0.9, pop: true, d }, { p: a.clone().addScaledVector(d, s.L + 3), r: 2.5 }]);
    }
  }
  for (const e of park.els) {
    if (e.t === 'qp') for (let i = 0; i < 2; i++) botLines.push([{ p: W(e, 0, -9), r: 2.5 }, { p: W(e, 0, -2), r: 2, vert: true }, { p: W(e, 0, 3.2), r: 0.6, vert: true }]);
    if (e.t === 'fun') botLines.push([{ p: W(e, 0, -(e.L / 2 + e.s + 5)), r: 1.8 }, { p: W(e, 0, -e.L / 2 + 0.6), r: 1.0, pop: true, d: W(e, 0, 1).sub(W(e, 0, 0)) }, { p: W(e, 0, e.L / 2 + e.s + 3), r: 2.5 }]);
    if (e.t === 'kick') botLines.push([{ p: W(e, 0, -6), r: 1.8 }, { p: W(e, 0, e.len - 0.3), r: 1.0, pop: true, d: W(e, 0, 1).sub(W(e, 0, 0)) }, { p: W(e, 0, e.len + 5), r: 2.5 }]);
    if (e.t === 'bowl') botLines.push([{ p: new V3(e.x + e.rr + 4, 0, e.z), r: 2 }, { p: new V3(e.x - e.rr + 0.6, 0, e.z), r: 1.5 }]);
  }
  for (const l of botLines) for (const w of l) { const L = park.B - 3; w.p.x = clamp(w.p.x, -L, L); w.p.z = clamp(w.p.z, -L, L); }
  botLine = null;
}
function bot() {
  if (state !== 'play') return;
  const out = { steer: 0, push: false, bal: 0, at: performance.now() };
  if (sk.mode === 'grind' || sk.mode === 'manual') { const c = -clamp(sk.bal * 2.2 + sk.balV * 0.7, -1, 1); out.steer = sk.mode === 'grind' ? c : 0; out.bal = c; inp.bot = out;
    if (sk.mode === 'manual' && sk.man && sk.man.t > 1.6) flick('u');
    return; }
  if (sk.mode === 'air') {
    const a = sk.air; botTrickCd -= 0.12;
    if (a && !sk.trick && !sk.grab && a.t < 0.25 && (a.vert || sk.v.y > 2) && Math.random() < 0.55) flick(['ul', 'ur', 'l', 'dl', 'dr'][Math.floor(Math.random() * 5)]);
    else if (a && a.vert && !sk.trick && !sk.grab && a.t < 0.6 && Math.random() < 0.5) { flick('u'); setTimeout(releaseGrab, 450); }
    inp.bot = out; return;
  }
  if (sk.mode === 'bail') { inp.bot = out; return; }
  if (!botLine || botStuck > 9) { botLine = botLines[Math.floor(Math.random() * botLines.length)]; botWp = 0; botStuck = 0; }
  botStuck += 0.12;
  const w = botLine[botWp], dx = w.p.x - sk.p.x, dz = w.p.z - sk.p.z, dist = Math.hypot(dx, dz);
  const hs = Math.hypot(sk.v.x, sk.v.z), travel = hs > 0.5 ? Math.atan2(sk.v.x, sk.v.z) : sk.yaw;
  const diff = wrap(Math.atan2(dx, dz) - travel);
  out.steer = clamp(-diff * 2.2, -1, 1); out.push = Math.abs(diff) < 0.35 && (hs < 7 || w.vert);
  if (w.pop && dist < 1.5) {
    const al = w.d ? Math.abs(wrap(Math.atan2(w.d.x, w.d.z) - travel)) : 0;
    if (al < 0.45 && hs > 3) { out.steer = 0; flick(Math.random() < 0.5 ? 'u' : ['ul', 'ur', 'l'][Math.floor(Math.random() * 3)]); }
    botWp++; botStuck = 0;
  } else if (dist < w.r || (dist < w.r * 2.2 && (w.lastD || 99) < dist)) { botWp++; botStuck = 0; }
  else if (!w.pop && dist > 6 && hs > 4.5 && sk.n.y > 0.97 && botTrickCd <= 0 && Math.random() < 0.4) { botTrickCd = 1.1; out.steer = 0; flick(['ul', 'ur', 'u', 'l', 'd'][Math.floor(Math.random() * 5)]); }
  w.lastD = dist; botTrickCd -= 0.12;
  if (botWp >= botLine.length) botLine = null;
  inp.bot = out;
}

// ---------------------------------------------------------------- main loop
loop((dtf, t) => {
  const dt = Math.min(0.05, dtf / 60); clock = t;
  readInput();
  if (state === 'play') {
    physics(dt);
    if (tLeft > 0) {
      const prev = Math.ceil(tLeft); tLeft -= dt;
      if (tLeft <= 10 && Math.ceil(tLeft) < prev && tLeft > 0) snd.tick();
      const s = Math.max(0, Math.ceil(tLeft)); ui.pill(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
      $('mute').classList.toggle('late', tLeft < 10);
    } else {
      overtime += dt; ui.pill('0:00');
      if (sk.mode === 'ground' || overtime > 5) { if (sk.mode === 'grind') creditGrind(); if (sk.mode === 'manual') creditManual(); if (sk.mode === 'air') finishAirTricks(1); endSession(); }
    }
    ui.score(fmt(score + (combo.items.length ? 0 : 0)));
    if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#ffd23f', 44, 30); confetti(scene, sk.p.clone().add(new V3(0, 1.5, 0)), 70); }
    paintCombo();
    const showBal = sk.mode === 'grind' || sk.mode === 'manual';
    balEl.classList.toggle('on', showBal); balEl.classList.toggle('man', sk.mode === 'manual');
    if (showBal) { balEl.querySelector('b').style.left = `${50 + clamp(sk.bal, -1, 1) * 46}%`; balEl.classList.toggle('warn', Math.abs(sk.bal) > 0.65); }
    setRoll(sk.v.length(), sk.mode === 'ground' || sk.mode === 'manual', sk.mode === 'grind');
  } else {
    // idle roll on the start card: the skater cruises in a slow circle so the park feels alive
    if (park && state === 'ready') { inp.steer = 0.25; inp.push = false; physics(dt); }
  }
  syncRider(dt, t); syncCamera(dt);
});

// ---------------------------------------------------------------- boot
loadPark(D.seed ? 'plaza' : prog.park);
loadRider(); spawn();
setMuted(prog.muted);
showPanel(ui.els.start, true);
ui.score(''); ui.sub('');

window.__game = {
  get state() { return state; }, get level() { return prog.done.length + 1; }, get score() { return Math.round(score); },
  get _sk() { return sk; }, get debug() { return { mode: sk.mode, p: sk.p.toArray().map(v => +v.toFixed(2)), v: +sk.v.length().toFixed(2), tLeft: +tLeft.toFixed(1), combo: combo.items.map(i => i.name), done: prog.done.length, ...dbg, bails: dbg.bails.join(','), wp: botLine ? botLine.map(w => w.p.x.toFixed(0) + ',' + w.p.z.toFixed(0) + (w.vert ? 'V' : '')).join(' ') + ' #' + botWp : '', last: JSON.stringify(dbg.last) }; },
  bot,
};

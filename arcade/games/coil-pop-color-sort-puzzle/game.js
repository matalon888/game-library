// Coil Pop — original colour-sort puzzle with bouncy springs. Tap a peg to lift its top coils, tap another peg to drop them
// (only onto an empty peg or the same colour). Fill every peg with one colour. Every level is checked solvable by a solver
// before you see it; the move budget is the solver's route plus generous slack.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as scoreboard } from './kit/board.js';

const NAME = 'Coil Pop: Color Sort Puzzle';
const S = store('coilpop');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('coilpop');
const CAP = 4, CH = 0.44;                                            // coils per peg, coil height

const stage = createStage({ fov: 38, shadowSize: 9 });
const { scene, camera, renderer } = stage;
const ui = createUI({ title: 'COIL<br>POP', hint: 'Tap a peg, then tap where it goes', hand: '👆' });
const D = daily('coilpop', ui, { name: NAME });
const B = scoreboard({ game: 'coil-pop', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.6 }, mode: 'sum' });   // world board: levels cleared today (RULES.md)

const COLORS = ['#ff4f7b', '#ffc93c', '#3fa9ff', '#45d483', '#a66bff', '#ff8a3d', '#2fd1c9', '#ff7ad9', '#7d8bff', '#b7e34a'];
const BGS = [['#b99cff', '#ffc4e6'], ['#7cc4ff', '#c4f1ff'], ['#ffad7a', '#ffe0a8'], ['#5fd3a6', '#c8f7d8'], ['#ff8fb1', '#ffd3c2']];

// ---------------------------------------------------------------- geometry
function helixGeo() {
  class Helix extends THREE.Curve { getPoint(t, o = new THREE.Vector3()) { const a = t * Math.PI * 2 * 2; return o.set(Math.cos(a) * 0.36, t * (CH - 0.2) - (CH - 0.2) / 2, Math.sin(a) * 0.36); } }
  return new THREE.TubeGeometry(new Helix(), 100, 0.095, 10, false);
}
const COIL = helixGeo();
const RING = new THREE.TorusGeometry(0.36, 0.075, 8, 28); RING.rotateX(Math.PI / 2);   // end caps so the coil reads as a solid spring
const ROD = new THREE.CylinderGeometry(0.1, 0.1, CAP * CH + 0.35, 10);
const KNOB = new THREE.SphereGeometry(0.12, 12, 10);
const HOLE = new THREE.CylinderGeometry(0.52, 0.56, 0.08, 28);
const HIT = new THREE.CylinderGeometry(0.6, 0.6, 3.2, 8);
const STAR = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.13 : 0.3, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); })();

const board = new THREE.Group(); scene.add(board);
const tray = new THREE.Mesh(rounded(1, 0.4, 1, 0.18), mat('#ffffff', { roughness: 0.45 })); tray.receiveShadow = true; board.add(tray);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.12 })); shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -0.21; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

// ---------------------------------------------------------------- state
let state = 'ready', pegs = [], coils = [], sel = -1, moves = 0, budget = 0, used = 0, score = 0, recorded = false, beatenShown = false, solved = 0, nColors = 0;
let botPlan = null, botSel = false, anims = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

// pure-data puzzle helpers (state = array of arrays of colour ids, bottom first)
const topRun = (p) => { if (!p.length) return 0; const c = p[p.length - 1]; let k = 1; while (k < p.length && p[p.length - 1 - k] === c) k++; return k; };
const complete = (p) => p.length === CAP && topRun(p) === CAP;
function legal(st, i, j) {
  const a = st[i], b = st[j];
  if (i === j || !a.length || b.length >= CAP || complete(a)) return 0;
  if (b.length && b[b.length - 1] !== a[a.length - 1]) return 0;
  const run = topRun(a); if (!b.length && run === a.length) return 0;            // moving a pure stack to an empty peg is pointless
  return Math.min(run, CAP - b.length);
}
function apply(st, i, j, k) { const s = st.map(p => p.slice()); for (let q = 0; q < k; q++) s[j].push(s[i].pop()); return s; }
const key = (st) => st.map(p => p.join('')).sort().join('|');
const isSolved = (st) => st.every(p => !p.length || complete(p));
function solve(st0, limit = 60000) {                                // DFS with memo; prefers moves onto matching colours
  const seen = new Set(), path = []; let nodes = 0;
  function dfs(st) {
    if (isSolved(st)) return true;
    if (++nodes > limit) return false;
    const k0 = key(st); if (seen.has(k0)) return false; seen.add(k0);
    const ms = [];
    for (let i = 0; i < st.length; i++) for (let j = 0; j < st.length; j++) { const k = legal(st, i, j); if (k) ms.push([i, j, k, (st[j].length ? 10 : 0) + k + (k === topRun(st[i]) ? 5 : 0)]); }
    ms.sort((a, b) => b[3] - a[3]);
    for (const [i, j, k] of ms) { path.push([i, j]); if (dfs(apply(st, i, j, k))) return true; path.pop(); }
    return false;
  }
  return dfs(st0) ? path.slice() : null;
}
const dataState = () => pegs.map(p => p.stack.map(c => c.col));

function layout(n) {                                                 // peg positions: rows of up to 4 (portrait friendly)
  const rows = n <= 4 ? 1 : n <= 8 ? 2 : 3, per = Math.ceil(n / rows), gap = 1.4, rgap = 1.9, out = [];
  for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per, cnt = r === rows - 1 ? n - per * (rows - 1) : per; out.push(new THREE.Vector3((c - (cnt - 1) / 2) * gap, 0, (r - (rows - 1) / 2) * rgap)); }
  return { out, w: per * gap + 0.5, d: rows * rgap + 0.2 };
}
function clearBoard() {
  for (const p of pegs) board.remove(p.g); for (const c of coils) board.remove(c.m); pegs = []; coils = [];
}

function build() {
  clearBoard();
  const fk = F.k(), seed = D.seed || level * 104729 + 7;
  nColors = clamp(Math.round((2.6 + level * 0.42) * Math.sqrt(fk)), 3, 9);
  const empties = 2;
  const r = rng(seed);
  let st, plan, tries = 0;
  do {                                                               // deal randomly, keep only deals the solver can finish
    const bag = []; for (let c = 0; c < nColors; c++) for (let k = 0; k < CAP; k++) bag.push(c);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    st = []; for (let c = 0; c < nColors; c++) st.push(bag.slice(c * CAP, c * CAP + CAP)); for (let e = 0; e < empties; e++) st.push([]);
    plan = st.some(complete) ? null : solve(st);
  } while (!plan && ++tries < 40);
  budget = Math.ceil(plan.length * 1.45 / fk) + 4; used = 0; moves = budget;
  const bg = BGS[(level - 1) % BGS.length], bs = document.body.style; bs.setProperty('--bg1', bg[0]); bs.setProperty('--bg2', bg[1]); bs.setProperty('--ui', COLORS[(level - 1) % COLORS.length]);
  const L = layout(st.length);
  tray.scale.set(L.w, 1, L.d + 0.6); tray.position.y = -0.2;
  tray.material.color.set('#ffffff');
  st.forEach((p, i) => {
    const g = new THREE.Group(); g.position.copy(L.out[i]); board.add(g);
    const hole = new THREE.Mesh(HOLE, mat('#ece6fa', { roughness: 0.6 })); hole.position.y = 0.02; hole.receiveShadow = true; g.add(hole);
    const rod = new THREE.Mesh(ROD, glossy('#f4f1fb')); rod.position.y = (CAP * CH + 0.35) / 2; rod.castShadow = true; g.add(rod);
    const knob = new THREE.Mesh(KNOB, glossy(COLORS[(level + 2) % COLORS.length])); knob.position.y = CAP * CH + 0.38; g.add(knob);
    const hit = new THREE.Mesh(HIT, new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.2; hit.userData.peg = i; g.add(hit);
    const star = new THREE.Mesh(STAR, glossy('#ffd23f', { emissive: '#ffb300', emissiveIntensity: 0.3 })); star.position.y = CAP * CH + 0.75; star.scale.setScalar(0); g.add(star);
    const peg = { g, hit, star, stack: [], done: false, i, shake: 0 };
    p.forEach((col, k) => { const c = makeCoil(col); c.peg = peg; peg.stack.push(c); c.pos.set(g.position.x, 0.06 + k * CH + CH / 2, g.position.z); c.m.position.copy(c.pos); c.target = c.pos.clone(); });
    pegs.push(peg);
  });
  // fit camera to the board (portrait first)
  const aspect = innerWidth / innerHeight, wNeed = L.w + 0.15, vfov = camera.fov * Math.PI / 180;
  const distW = (wNeed / 2) / (Math.tan(vfov / 2) * aspect), distD = (L.d + 2.6) / 2 / Math.tan(vfov / 2);
  camDist = Math.max(distW, distD, 6.5);
  sel = -1; solved = 0; score = 0; recorded = false; beatenShown = false; botPlan = null; botSel = false;
  ui.levels(level); ui.progress(0); ui.score(moves); ui.sub(D.isDaily ? 'MOVES LEFT · DAILY' : 'MOVES LEFT');
}
let camDist = 9;

function makeCoil(col) {
  const m = new THREE.Group();
  const material = glossy(COLORS[col], { roughness: 0.25 });
  const h = new THREE.Mesh(COIL, material); h.castShadow = true; m.add(h);
  board.add(m);
  const c = { m, col, material, pos: new THREE.Vector3(), target: new THREE.Vector3(), vel: new THREE.Vector3(), sy: 1, svy: 0, fly: null };
  coils.push(c); return c;
}

function lift(i) {
  const p = pegs[i], run = topRun(p.stack.map(c => c.col));
  sel = i;
  for (let k = 0; k < run; k++) { const c = p.stack[p.stack.length - 1 - k]; c.target.y = CAP * CH + 0.95 + (run - 1 - k) * CH; c.svy += 0.06; }
  tone(600, 0.06, 'triangle', 0.12, 1.4); buzz(6);
}
function drop(i) {
  const p = pegs[i];
  p.stack.forEach((c, k) => { c.target.y = 0.06 + k * CH + CH / 2; }); sel = -1;
}

function move(i, j) {
  const st = dataState(), k = legal(st, i, j);
  if (!k) {                                                          // not allowed: shake the target peg, put the coils back
    pegs[j].shake = 1; drop(i); tone(180, 0.12, 'square', 0.08, 0.8); buzz([15, 20, 15]); return false;
  }
  const a = pegs[i], b = pegs[j];
  for (let q = 0; q < k; q++) {
    const c = a.stack.pop(); const slot = b.stack.length; b.stack.push(c); c.peg = b;
    const from = c.m.position.clone(), to = new THREE.Vector3(b.g.position.x, 0.06 + slot * CH + CH / 2, b.g.position.z);
    c.fly = { from, to, t: -q * 0.12, mid: CAP * CH + 1.6 + q * 0.2 }; anims++;
  }
  drop(i); sel = -1;
  used++; moves = budget - used; ui.score(moves);
  return true;
}

function landed(c) {
  c.svy -= 0.16; anims--;
  const peg = c.peg;
  tone(300 + peg.stack.indexOf(c) * 90, 0.07, 'sine', 0.12, 1.3);
  if (anims === 0) settle();
}
function settle() {
  const st = dataState();
  pegs.forEach((p, i) => {
    if (!p.done && complete(st[i])) {
      p.done = true; solved++; score += 10; ui.score(moves);
      const pos = p.g.position.clone().add(new THREE.Vector3(0, CAP * CH + 0.4, 0));
      burst(scene, pos, [COLORS[st[i][0]], '#ffffff', '#ffd23f'], 26, { speed: 0.12, up: 0.12, size: 0.6 });
      [0, 4, 7, 12].forEach((s, q) => setTimeout(() => note(67 + s + solved, 0.3, 0.15), q * 70));
      p.stack.forEach((c, q) => setTimeout(() => { c.svy -= 0.25; }, q * 60));
      ui.pop(['NICE!', 'SWEET!', 'BOING!', 'GREAT!', 'PERFECT!'][(solved - 1) % 5], COLORS[st[i][0]], 40, 24); buzz(20); ui.flash(0.15);
      if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 32); confetti(scene, new THREE.Vector3(0, 3, 0), 40); }
    }
  });
  ui.progress(solved / nColors);
  if (isSolved(st)) return win();
  // out of moves or no legal move left → lose
  let any = false; for (let i = 0; i < st.length && !any; i++) for (let j = 0; j < st.length; j++) if (legal(st, i, j)) { any = true; break; }
  if (moves <= 0 || !any) lose(moves <= 0 ? 'OUT OF MOVES' : 'STUCK!');
}
function win() {
  state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  score += moves * 5 + level * 10; best = Math.max(best, score); S.set('best', best);
  sfx.win(); buzz([20, 40, 20]);
  confetti(scene, new THREE.Vector3(0, 2.5, 0), 100);
  pegs.forEach((p, i) => setTimeout(() => { p.stack.forEach(c => c.svy -= 0.3); }, i * 70));
  D.won(score); ui.win(level, `${score} points · ${moves} moves spare`);
}
function lose(t) {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, solved / nColors); }
  sfx.fail(); buzz([40, 30, 60]);
  ui.lose(t, `${solved} / ${nColors} pegs sorted`);
}

function tapPeg(i) {
  if (state !== 'play' || anims > 0) return;
  if (sel < 0) {
    if (!pegs[i].stack.length || pegs[i].done) { pegs[i].shake = 0.6; tone(200, 0.06, 'sine', 0.06); return; }
    lift(i);
  } else if (sel === i) { drop(i); tone(420, 0.05, 'sine', 0.08, 0.7); }
  else move(sel, i);
}

input({ onDown: (e) => {
  if (state !== 'play') return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pegs.map(p => p.hit));
  if (hits.length) tapPeg(hits[0].object.userData.peg);
  else if (sel >= 0) drop(sel);
} });
ui.onTap(w => { B.start();
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; ui.els.sc.classList.remove('hc-hidden');
});
addEventListener('resize', () => { if (pegs.length) { const L = layout(pegs.length), vfov = camera.fov * Math.PI / 180; camDist = Math.max((L.w + 0.15) / 2 / (Math.tan(vfov / 2) * camera.aspect), (L.d + 2.6) / 2 / Math.tan(vfov / 2), 6.5); } });

// ---------------------------------------------------------------- loop
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
loop((dt, t) => {
  for (const c of coils) {
    if (c.fly) {
      const f = c.fly; f.t += dt / 22;
      if (f.t >= 0) {
        const k = ease(Math.min(1, f.t));
        c.m.position.lerpVectors(f.from, f.to, k); c.m.position.y = lerp(f.from.y, f.to.y, k) + Math.sin(Math.min(1, f.t) * Math.PI) * (f.mid - Math.max(f.from.y, f.to.y) * 0.5) * 0.7;
        c.sy = 1 + Math.sin(Math.min(1, f.t) * Math.PI) * 0.35;
        if (f.t >= 1) { c.fly = null; c.m.position.copy(f.to); c.target.copy(f.to); landed(c); }
      }
    } else c.m.position.y = lerp(c.m.position.y, c.target.y, Math.min(1, 0.3 * dt));
    // damped spring on vertical scale: boing
    c.svy += (1 - c.sy) * 0.22 * dt; c.svy *= Math.pow(0.86, dt); c.sy += c.svy * dt;
    const lifted = c.peg && sel === c.peg.i && c.target.y > CAP * CH;
    c.m.scale.set(1 + (1 - c.sy) * 0.4, c.sy * (lifted ? 1.08 + Math.sin(t * 6) * 0.05 : 1), 1 + (1 - c.sy) * 0.4);
    c.m.rotation.y += (lifted ? 0.05 : 0.004) * dt;
  }
  for (const p of pegs) {
    p.shake = Math.max(0, p.shake - 0.05 * dt); p.g.rotation.z = Math.sin(t * 40) * 0.08 * p.shake;
    const s = p.done ? 1 : 0; p.star.scale.setScalar(lerp(p.star.scale.x, s, 0.15 * dt)); p.star.rotation.y += 0.04 * dt;
    p.star.position.y = CAP * CH + 0.8 + Math.sin(t * 3 + p.i) * 0.06;
  }
  const tilt = 1.02;
  camera.position.set(0, Math.sin(tilt) * camDist + 0.4, Math.cos(tilt) * camDist + 0.4); camera.lookAt(0, 0.9, 0.35);
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play' || anims > 0) return;
    if (botSel) { botSel = false; const mv = botPlan && botPlan.shift(); if (mv && sel === mv[0]) tapPeg(mv[1]); else if (sel >= 0) drop(sel); return; }
    const st = dataState();
    if (!botPlan || !botPlan.length || !legal(st, botPlan[0][0], botPlan[0][1])) botPlan = solve(st, 30000) || [];
    if (!botPlan.length) return;
    if (sel >= 0 && sel !== botPlan[0][0]) { drop(sel); return; }
    if (sel !== botPlan[0][0]) tapPeg(botPlan[0][0]);
    botSel = true;
  },
};

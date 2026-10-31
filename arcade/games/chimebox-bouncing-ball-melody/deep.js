// Chimebox deep v2 (studio lane 20, 2026-10-31) — the same game (balls bounce in a box, every wall plays the next note of a classic tune,
// tap turns the box so golden walls catch the ball) with 30 authored songs in 3 worlds, pegs / sour walls / spin / moon gravity / shrink stars,
// gold chains and FEVER, stars, a level map, ball skins and a daily. Plan: DESIGN.md. Levels: levels.js. v1 is v1.js, untouched.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { SONG } from './_music/songs.js';
import { board } from './kit/board.js';
import { LEVELS, WORLDS, CHARMS } from './levels.js';
const B = board({ game: 'chimebox', label: 'Songs finished', limits: { maxRun: 2, maxPerSec: 0.4 }, mode: 'sum' });   // same board meaning as v1

const NAME = 'Chimebox: Bouncing Ball Melody';
const S = store('chimebox');
const Q = new URLSearchParams(location.search);
const NL = LEVELS.length;
let unlocked = S.get('d_unl', 1), stars = S.get('d_stars', []), eq = S.get('d_eq', 0), best = S.get('d_best', 0);
let level = clamp(+Q.get('level') || unlocked, 1, 999);
const F = flow('chimebox');
const SIM = !!Q.get('sim');

const stage = createStage({ fov: 40, shadowSize: 8 });
const { scene, camera, sun } = stage;
sun.position.set(2, 5, 14); sun.intensity = 1.4;
const ui = createUI({ title: 'CHIMEBOX', hint: 'Tap to turn the box', hand: '👆' });
const D = daily('chimebox', ui, { name: NAME });
ui.els.win.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');

const SHAPE_NAMES = { 0: 'circle', 6: 'hexagon', 4: 'square', 5: 'pentagon', 3: 'triangle', 8: 'octagon' };
const WALLS = ['#ff7eb6', '#6c8cff', '#36c99a', '#ff9a4a', '#9a6bff', '#ff5d6c'];
const GM = +Q.get('gm') || 1, GS = +Q.get('gs') || 1.5;   // growth and gold-shrink tuning (QA can override)
const GRAV0 = 9.5, RI = 3.0, R0 = 0.34, WALL_T = 0.32;
let GRAV = GRAV0;

const totalStars = () => stars.reduce((a, b) => a + (b || 0), 0);
const charmsOpen = () => Math.min(CHARMS.length, 1 + Math.floor(totalStars() / 10));
const worldOf = n => Math.min(WORLDS.length - 1, Math.floor((((n - 1) % NL)) / 10));

// ---------------------------------------------------------------- level lookup (past 30: the same boxes, a little faster; daily: a seeded pick)
let G_OVR = 0;
function levelDef(n) { const d = levelDef0(n); return G_OVR ? { ...d, g: G_OVR } : d; }
function levelDef0(n) {
  if (D.isDaily) {
    const rr = rng((D.seed || 1) * 31 + 7), pool = Math.max(8, Math.min(NL, unlocked));
    const base = LEVELS[Math.floor(rr() * pool)];
    return { ...base, g: base.g * 1.05, boss: 0, daily: 1, why: 'Today\'s box, the same for everyone.' };
  }
  const base = LEVELS[(n - 1) % NL], lap = Math.floor((n - 1) / NL);
  return lap ? { ...base, g: Math.min(1.25, base.g * (1 + 0.08 * lap)), why: 'Encore ' + (lap + 1) + ': ' + base.why } : base;
}

// ---------------------------------------------------------------- shared props
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const noteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.font = 'bold 52px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const starTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 17 : 42; x[i ? 'lineTo' : 'moveTo'](48 + Math.cos(a) * rr, 50 + Math.sin(a) * rr); } x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const box = new THREE.Group(); scene.add(box);
const plate = new THREE.Group(); scene.add(plate);
const ripples = [], notesFx = [], trail = [];
const RIP_G = new THREE.RingGeometry(0.8, 1, 40);

// ---------------------------------------------------------------- css for the map, result card and hud
const css = document.createElement('style');
css.textContent = `
.cb-staff{position:fixed;left:0;right:0;bottom:calc(46px + env(safe-area-inset-bottom));display:flex;justify-content:center;pointer-events:none;z-index:5}
.cb-in{position:relative;width:min(340px,86vw);height:92px;border-radius:24px;background:rgba(255,255,255,.5);box-shadow:0 6px 18px rgba(0,0,0,.08)}
.cb-l{position:absolute;left:16px;right:16px;height:2px;border-radius:2px;background:rgba(0,0,0,.08)}
.cb-n{position:absolute;width:20px;height:16px;margin:-8px 0 0 -10px;border-radius:50%;background:var(--ui,#ff7eb6);transform:rotate(-18deg);transition:left .25s ease,top .25s ease,opacity .25s,transform .25s;box-shadow:0 2px 0 rgba(0,0,0,.12)}
.cb-n.done{opacity:.25}.cb-n.now{transform:rotate(-18deg) scale(1.45);background:#ffb300;box-shadow:0 0 0 4px rgba(255,179,0,.25)}
.cb-fev .cb-in{background:rgba(255,236,160,.8);box-shadow:0 0 22px rgba(255,190,0,.7)}
.cb-btn{pointer-events:auto;font:inherit;font-weight:800;color:#fff;background:var(--ui,#ff7eb6);border:0;border-radius:30px;padding:10px 22px;font-size:20px;box-shadow:0 4px 0 rgba(0,0,0,.18);cursor:pointer}
.cb-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.18)}
.cb-btn.g{background:#3cc46a;box-shadow:0 4px 0 #2a9a50;font-size:26px;padding:13px 40px;animation:cbp 1.4s ease-in-out infinite}
.cb-btn.s{background:rgba(0,0,0,.25);box-shadow:none;font-size:16px;padding:7px 16px}
@keyframes cbp{50%{transform:scale(1.07)}}
.cb-mapb{position:fixed;right:10px;top:calc(56px + env(safe-area-inset-top));z-index:7;width:40px;height:40px;border-radius:12px;background:rgba(0,0,0,.2);border:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:0}
.cb-card{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;padding:calc(120px + env(safe-area-inset-top)) 18px 30px;text-align:center;background:rgba(20,10,40,.66);animation:cbin .25s ease-out}
@keyframes cbin{from{opacity:0;transform:scale(.94)}}
.cb-card h1{margin:0;font-size:clamp(40px,12vw,64px);line-height:.95;font-weight:800;text-shadow:0 5px 0 rgba(0,0,0,.2)}
.cb-card p{margin:0;font-size:18px;font-weight:600;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.cb-st{display:flex;gap:10px;margin:6px 0}
.cb-st svg{width:58px;height:58px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.2))}
.cb-st svg.pop{animation:cbstar .55s cubic-bezier(.2,1.6,.4,1) both}
@keyframes cbstar{from{transform:scale(0) rotate(-60deg)}}
.cb-row{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;justify-content:center}
.cb-bar{width:min(260px,70vw);height:12px;border-radius:8px;background:rgba(255,255,255,.35);overflow:hidden}
.cb-bar i{display:block;height:100%;background:#ffd23f;border-radius:8px}
.cb-map{position:fixed;inset:0;z-index:14;background:linear-gradient(180deg,#2a1f4d,#4a2f6f);overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 30px;color:#fff;touch-action:pan-y}
.cb-map h2{margin:6px 0 2px;font-size:26px;font-weight:800;text-align:center}
.cb-map .sub{text-align:center;font-size:15px;opacity:.85;margin-bottom:8px}
.cb-map .top{padding-left:48px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.cb-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:6px 0 14px}
.cb-node{position:relative;aspect-ratio:1;border-radius:16px;border:0;font:inherit;font-weight:800;font-size:22px;color:#fff;background:var(--w);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.cb-node.lock{background:rgba(255,255,255,.12);color:rgba(255,255,255,.35);box-shadow:none;pointer-events:none}
.cb-node.next{animation:cbp 1.1s ease-in-out infinite;outline:3px solid #fff}
.cb-node.boss{outline:3px solid #ffd23f}
.cb-node small{display:flex;gap:1px;height:11px}
.cb-node small svg{width:11px;height:11px}
.cb-shelf{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;margin:6px 0}
.cb-ch{aspect-ratio:1;border-radius:50%;border:2px solid transparent;padding:0;cursor:pointer}
.cb-ch.lock{opacity:.3;pointer-events:none;filter:grayscale(1)}
.cb-ch.on{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35)}
`;
document.head.appendChild(css);
const STAR_SVG = (on, c = '#ffd23f') => `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="${on ? c : 'rgba(255,255,255,.25)'}"/></svg>`;

// ---------------------------------------------------------------- melody strip (shows the notes coming up, like a tiny music staff)
const staff = document.createElement('div'); staff.className = 'cb-staff'; staff.innerHTML = '<div class="cb-in"></div>'; document.body.appendChild(staff);
const staffIn = staff.firstChild;
for (let i = 0; i < 5; i++) { const l = document.createElement('div'); l.className = 'cb-l'; l.style.top = (18 + i * 14) + 'px'; staffIn.appendChild(l); }
const heads = []; for (let i = 0; i < 9; i++) { const h = document.createElement('div'); h.className = 'cb-n'; staffIn.appendChild(h); heads.push(h); }
let lo = 60, hi = 84;
function renderStaff() {
  const w = staffIn.clientWidth || 300;
  for (let i = 0; i < heads.length; i++) {
    const k = ni - 2 + i, h = heads[i], n = seq[k];
    if (!n || k < 0) { h.style.opacity = 0; continue; }
    h.style.opacity = ''; h.className = 'cb-n' + (k < ni ? ' done' : k === ni ? ' now' : '');
    h.style.left = (28 + i * (w - 56) / 8) + 'px';
    h.style.top = (76 - (n[1] - lo) / Math.max(1, hi - lo) * 60) + 'px';
  }
}

// ---------------------------------------------------------------- state
let state = 'ready', sides = 0, phi = 0, phiT = 0, step = Math.PI / 4, balls = [], gold = [], sour = [], pegs = [], pickups = [], song, seq = [], ni = 0, need = 40, grow = 0.05, limit = 2.4;
let score = 0, recorded = false, beatenShown = false, warn = 0, spawnAt = [], clock = 0, r = rng(1), turns = 0, shake = 0, L = LEVELS[0], spin = 0;
let wallMat, goldMat, sourMat, pegMat;
let SALT = 0, chain = 0, chainT = 0, fever = 0, goldHits = 0, peak = 0, stopT = 0, zoom = 0, trailT = 0, sinceTurn = 0, prevState = 'play';
const eqCols = () => CHARMS[Math.min(eq, charmsOpen() - 1)].cols;

function polyPts(n, R) { const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + Math.PI / n + i * 2 * Math.PI / n; pts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R)); } return pts; }
function edgeNormalAngle(k) { return -Math.PI / 2 + Math.PI / sides + k * 2 * Math.PI / sides + Math.PI / sides; }

function buildBox() {
  box.clear(); plate.clear();
  const col = WALLS[(level - 1) % WALLS.length];
  wallMat = glossy(col, { emissive: col, emissiveIntensity: 0.15 }); goldMat = glossy('#ffd23f', { emissive: '#ffb300', emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.25 });
  sourMat = glossy('#3b2350', { emissive: '#8a1f4a', emissiveIntensity: 0.35, roughness: 0.5 }); pegMat = glossy('#5fd8ff', { emissive: '#2aa8e0', emissiveIntensity: 0.5 });
  const outer = new THREE.Shape(), hole = new THREE.Path();
  if (sides === 0) { outer.absarc(0, 0, RI + WALL_T, 0, Math.PI * 2, false); hole.absarc(0, 0, RI, 0, Math.PI * 2, true); }
  else {
    const Ro = (RI + WALL_T) / Math.cos(Math.PI / sides), Rin = RI / Math.cos(Math.PI / sides);
    const po = polyPts(sides, Ro), pi = polyPts(sides, Rin).reverse();
    outer.setFromPoints(po); hole.setFromPoints(pi);
  }
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 64 }); g.translate(0, 0, -0.35);
  const m = new THREE.Mesh(g, wallMat); m.castShadow = true; m.receiveShadow = true; box.add(m);
  const back = sides === 0 ? new THREE.CircleGeometry(RI, 64) : new THREE.ShapeGeometry(new THREE.Shape(polyPts(sides, RI / Math.cos(Math.PI / sides))));
  const bm = new THREE.Mesh(back, mat('#ffffff', { transparent: true, opacity: 0.6, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.55 })); bm.position.z = -0.4; bm.receiveShadow = true; box.add(bm);
}
function wallMesh(gs, material, thick) {
  let m;
  if (sides === 0) { m = new THREE.Mesh(new THREE.TorusGeometry(RI - 0.04, thick, 10, 24, gs.len), material); m.rotation.z = gs.a - gs.len / 2; m.position.z = 0.15; }
  else {
    const len = 2 * RI * Math.tan(Math.PI / sides) * 0.86, na = edgeNormalAngle(gs.k);
    m = new THREE.Mesh(new THREE.CapsuleGeometry(thick, len - 0.4, 4, 10), material);
    m.position.set(Math.cos(na) * (RI - 0.04), Math.sin(na) * (RI - 0.04), 0.15); m.rotation.z = na;
  }
  m.castShadow = true; box.add(m); gs.m = m; gs.pulse = 1;
}
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function placeGold(gs, avoidA = null) {
  if (gs.m) { box.remove(gs.m); gs.m = null; }
  for (let tries = 0; tries < 20; tries++) {
    if (sides === 0) { gs.a = r() * Math.PI * 2; gs.len = 0.8; }
    else { gs.k = Math.floor(r() * sides); gs.a = edgeNormalAngle(gs.k); gs.len = 2 * Math.PI / sides; }
    if (gold.some(o => o !== gs && o.m && angDiff(o.a, gs.a) < 0.6)) continue;
    if (sour.some(o => angDiff(o.a, gs.a) < (sides ? 0.3 : 0.9))) continue;
    if (avoidA !== null && angDiff(avoidA, gs.a + phi) < 1.2) continue;
    break;
  }
  wallMesh(gs, goldMat, 0.2);
}
function placeSour(gs) {
  for (let tries = 0; tries < 30; tries++) {
    if (sides === 0) { gs.a = r() * Math.PI * 2; gs.len = 0.7; }
    else { gs.k = Math.floor(r() * sides); gs.a = edgeNormalAngle(gs.k); gs.len = 2 * Math.PI / sides; }
    if (sour.some(o => o !== gs && o.m && angDiff(o.a, gs.a) < 0.6)) continue;
    if (gold.some(o => o.m && angDiff(o.a, gs.a) < (sides ? 0.3 : 0.9))) continue;
    break;
  }
  wallMesh(gs, sourMat, 0.2);
}

function makeBall(i, x, y) {
  const cols = eqCols(), c = cols[i % cols.length], m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 22), glossy(c, { emissive: c, emissiveIntensity: 0.12 }));
  m.castShadow = true; scene.add(m);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })); hl.position.set(-0.35, 0.4, 0.75); hl.scale.set(1, 0.7, 0.4); m.add(hl);
  const a = r() * Math.PI * 2;
  return { m, c, x, y, vx: Math.cos(a) * 4, vy: 3 + r() * 2, r: R0, sq: 0, rt: R0 };
}
function makePickup() {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#ffe066', transparent: true, depthWrite: false })); sp.scale.setScalar(0.8); sp.position.z = 0.4; scene.add(sp);
  const p = { m: sp, x: 0, y: 0, t: 0 }; movePickup(p); return p;
}
function movePickup(p) {
  for (let k = 0; k < 10; k++) { const a = r() * Math.PI * 2, d = RI * (0.25 + r() * 0.45); p.x = Math.cos(a) * d; p.y = Math.sin(a) * d - 0.2; if (!pegs.some(g => Math.hypot(g.x - p.x, g.y - p.y) < 0.9)) break; }
  p.t = 0; p.m.position.set(p.x, p.y, 0.4); p.m.visible = true;
}

function build() {
  const w = worldOf(level), W = WORLDS[w];
  L = levelDef(level); const seed = (D.seed ? D.seed * 13 + level : level * 7919 + 211) + SALT * 101; r = rng(seed); const fk = F.k();
  const bs = document.body.style;
  bs.setProperty('--bg1', W.c1); bs.setProperty('--bg2', W.c2); bs.setProperty('--ui', W.ui);
  sides = L.sh; step = sides ? 2 * Math.PI / sides : Math.PI / 4;
  phi = phiT = 0; turns = 0; spin = L.spin || 0; GRAV = L.grav || GRAV0;
  buildBox();
  song = SONG[L.song];
  need = Math.min(L.to, song.notes.length) - L.from;
  seq = []; for (let i = L.from; i < L.from + need; i++) seq.push(song.notes[i]);
  ni = 0; lo = Math.min(...seq.map(n => n[1])); hi = Math.max(...seq.map(n => n[1])); renderStaff();
  for (const b of balls) scene.remove(b.m); balls = [];
  for (const p of pickups) scene.remove(p.m); pickups = [];
  for (const p of pegs) { scene.remove(p.m); } pegs = [];
  limit = RI * (sides === 3 ? 0.62 : 0.8);
  grow = clamp((limit - R0) / (need * 0.55) * fk * L.g * GM, 0.008, 0.6);
  balls.push(makeBall(0, 0, 0.5));
  spawnAt = (L.spawn || []).map(f => Math.round(need * f));
  for (const gs of gold) if (gs.m) box.remove(gs.m);
  for (const gs of sour) if (gs.m) box.remove(gs.m);
  gold = []; sour = [];
  for (let i = 0; i < (L.sour || 0); i++) { const gs = {}; sour.push(gs); placeSour(gs); }
  const ng = sides && sides <= 4 ? 1 : (L.gold || 2); for (let i = 0; i < ng; i++) { const gs = {}; gold.push(gs); placeGold(gs); }
  for (const [fx, fy] of (L.pegs || [])) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), pegMat); m.scale.setScalar(0.3); m.position.set(fx * RI, fy * RI, 0.1); m.castShadow = true; scene.add(m);
    pegs.push({ m, x: fx * RI, y: fy * RI, r: 0.3, pulse: 0 });
  }
  for (let i = 0; i < (L.stars || 0); i++) pickups.push(makePickup());
  score = 0; recorded = false; beatenShown = false; warn = 0; chain = 0; chainT = 0; fever = 0; goldHits = 0; peak = 0; stopT = 0; sinceTurn = 0;
  staff.classList.remove('cb-fev');
  ui.levels(D.isDaily ? '*' : ((level - 1) % NL) + 1); ui.progress(0); ui.score(0); ui.pill('');
  ui.sub(`♪ ${song.title}` + (D.isDaily ? ' · DAILY' : L.boss ? ' · BOSS' : ''));
  banner(L.why);
}

let bannerEl = null;
function banner(t) {
  if (!bannerEl) { bannerEl = document.createElement('div'); bannerEl.style.cssText = 'position:fixed;left:14px;right:14px;top:calc(138px + env(safe-area-inset-top));text-align:center;font-weight:800;font-size:17px;z-index:6;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.25);transition:opacity .5s'; document.body.appendChild(bannerEl); }
  bannerEl.textContent = t; bannerEl.style.opacity = 1; clearTimeout(bannerEl._t); bannerEl._t = setTimeout(() => { bannerEl.style.opacity = 0; }, 4200);
}
function addScore(n) {
  score += n; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); confetti(scene, new THREE.Vector3(0, 2, 1), 50); }
}

function chordFor(u) { const bar = song.bars[Math.floor(u / song.barLen) % song.bars.length]; const half = (u % song.barLen) >= song.barLen / 2 && bar.length > 1 ? 1 : 0; return bar[half]; }

// kind: 'wall' | 'gold' | 'peg'
function playHit(b, wx, wy, kind) {
  const golden = kind === 'gold', fev = fever > 0;
  const n = seq[ni % seq.length], u = n[0], midi = n[1];
  const beatSec = 60 / song.bpm / song.unit;
  if (!SIM) {
    note(midi, clamp(n[2] * beatSec * 1.6, 0.25, 0.9), golden || fev ? 0.2 : 0.17);
    const ch = chordFor(u);
    if (golden || fev) { for (const tn of ch.tones) note(60 + tn, 0.7, 0.06); note(36 + ch.root + 12, 0.8, 0.12); }
    else if (ni % 2 === 0) note(36 + ch.root + 12, 0.45, 0.07);
    if (kind === 'peg') tone(1500, 0.05, 'sine', 0.06, 1.4);
  }
  ni += golden ? 2 : 1; if (golden && ni < need && seq[ni - 1] && !SIM) setTimeout(() => note(seq[ni - 1][1], 0.3, 0.12), 110);
  addScore((golden ? 5 * Math.max(1, chain) : kind === 'peg' ? 2 : 1) * (fev ? 2 : 1));
  ui.progress(ni / need);
  if (SIM) { if (spawnAt.length && ni >= spawnAt[0]) { spawnAt.shift(); balls.push(makeBall(balls.length, 0, 0)); } if (ni >= need) win(); return; }
  const gold_ = golden || fev;
  const rp = new THREE.Mesh(RIP_G, new THREE.MeshBasicMaterial({ color: gold_ ? '#ffd23f' : kind === 'peg' ? '#7fe3ff' : '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  rp.position.set(wx, wy, 0.4); rp.scale.setScalar(0.2); scene.add(rp); ripples.push({ m: rp, t: 0 });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, color: gold_ ? '#ffd23f' : b.c, transparent: true, depthWrite: false }));
  sp.position.set(wx * 0.92, wy * 0.92, 0.6); sp.scale.setScalar(gold_ ? 0.9 : 0.6); scene.add(sp); notesFx.push({ m: sp, t: 0, vx: (Math.random() - 0.5) * 0.6 });
  burst(scene, new THREE.Vector3(wx, wy, 0.3), gold_ ? ['#ffd23f', '#ffffff', '#ff9a4a'] : [b.c, '#ffffff'], gold_ ? 14 : 5, { speed: gold_ ? 0.1 : 0.06, up: 0.02, size: gold_ ? 0.5 : 0.35, gravity: 0.002 });
  buzz(golden ? [10, 20, 10] : 5);
  renderStaff();
  if (spawnAt.length && ni >= spawnAt[0]) { spawnAt.shift(); const nb = makeBall(balls.length, 0, 0); balls.push(nb); ui.pop('+1 BALL', '#fff', 32, 34); tone(880, 0.1, 'triangle', 0.1, 1.5); }
  if (ni >= need) win();
}

function setFeverHud() {
  ui.pill(fever > 0 ? 'FEVER' : chain > 1 ? 'GOLD x' + chain : '');
  staff.classList.toggle('cb-fev', fever > 0);
}

function wallHit(b, nx, ny, kind, gs) {
  const vn = b.vx * nx + b.vy * ny; if (vn <= 0) return;
  b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
  const sp = Math.hypot(b.vx, b.vy), want = clamp(sp, 5.5, 9.5); b.vx *= want / sp; b.vy *= want / sp;
  b.sq = 1;
  if (state !== 'play') return;
  if (kind === 'sour') {
    b.rt += grow * 2.6; gs.pulse = 1; chain = 0; chainT = 0; setFeverHud();
    if (!SIM) { tone(150, 0.3, 'sawtooth', 0.12, 0.5); tone(160, 0.25, 'square', 0.05, 0.5); buzz([30, 20, 30]); ui.pop('OUCH', '#ff5d8f', 30, 28); shake = Math.max(shake, 0.2);
      burst(scene, new THREE.Vector3(b.x + nx * b.r, b.y + ny * b.r, 0.3), ['#8a1f4a', '#3b2350'], 8, { speed: 0.07, up: 0.02, size: 0.4, gravity: 0.002 }); }
    peak = Math.max(peak, (b.rt - R0) / (limit - R0));
    if (b.rt >= limit) lose(b);
    return;
  }
  if (kind === 'gold') {
    chain = chainT > 0 ? chain + 1 : 1; chainT = 3.2; goldHits++;
    b.rt = Math.max(R0, b.rt - grow * GS * (1 + 0.3 * (chain - 1)));
    gs.pulse = 1; placeGold(gs, Math.atan2(ny, nx));
    if (chain === 3 && fever <= 0) { fever = 5; if (!SIM) { ui.pop('FEVER!', '#fff6a0', 46, 24); ui.flash(0.45); stopT = 0.09; zoom = 1; shake = Math.max(shake, 0.3); buzz([20, 30, 20, 30, 40]); for (let q = 0; q < 4; q++) setTimeout(() => note(72 + q * 4, 0.3, 0.1), q * 70); } }
    else if (chain >= 2 && !SIM) { ui.pop('GOLD x' + chain, '#ffb300', 30 + chain * 3, 26); stopT = 0.04; }
    setFeverHud();
  } else if (fever > 0) b.rt = Math.max(R0, b.rt - grow * 1.2);   // fever: every wall is a little golden
  else b.rt += grow;
  peak = Math.max(peak, (b.rt - R0) / (limit - R0));
  playHit(b, b.x + nx * b.r, b.y + ny * b.r, kind);
  if (state === 'play' && b.rt >= limit) lose(b);
}

function pegHit(b, p) {
  const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1e-3, md = b.r + p.r;
  if (d >= md) return;
  const nx = dx / d, ny = dy / d; b.x = p.x + nx * md; b.y = p.y + ny * md;
  const vn = b.vx * nx + b.vy * ny; if (vn >= 0) return;
  b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny;
  const sp = Math.hypot(b.vx, b.vy), want = clamp(sp, 5.5, 9.5); b.vx *= want / sp; b.vy *= want / sp;
  b.sq = 1; p.pulse = 1;
  if (state === 'play') playHit(b, p.x + nx * p.r, p.y + ny * p.r, 'peg');
}

function physics(h) {
  for (const b of balls) {
    b.vy -= GRAV * h; b.x += b.vx * h; b.y += b.vy * h;
    b.r = lerp(b.r, b.rt, Math.min(1, 10 * h));
    if (sides === 0) {
      const d = Math.hypot(b.x, b.y);
      if (d + b.r > RI) {
        const nx = b.x / d, ny = b.y / d; b.x = nx * (RI - b.r); b.y = ny * (RI - b.r);
        const la = Math.atan2(ny, nx) - phi, gs = gold.find(g => angDiff(la, g.a) < g.len / 2 + 0.05), ss = !gs && sour.find(g => angDiff(la, g.a) < g.len / 2 + 0.05);
        wallHit(b, nx, ny, gs ? 'gold' : ss ? 'sour' : 'wall', gs || ss);
      }
    } else {
      for (let k = 0; k < sides; k++) {
        const na = edgeNormalAngle(k) + phi, nx = Math.cos(na), ny = Math.sin(na);
        const dist = b.x * nx + b.y * ny;
        if (dist + b.r > RI) {
          b.x -= nx * (dist + b.r - RI); b.y -= ny * (dist + b.r - RI);
          const gs = gold.find(g => g.k === k), ss = !gs && sour.find(g => g.k === k);
          wallHit(b, nx, ny, gs ? 'gold' : ss ? 'sour' : 'wall', gs || ss);
        }
      }
    }
    for (const p of pegs) pegHit(b, p);
    for (const p of pickups) if (p.m.visible && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 0.35 && state === 'play') {
      p.m.visible = false; p.t = -3; b.rt = Math.max(R0, b.rt - grow * 3.5); addScore(5);
      if (!SIM) { note(88, 0.3, 0.1); note(95, 0.4, 0.08); ui.pop('SHRINK!', '#ffe066', 30, 28); burst(scene, new THREE.Vector3(p.x, p.y, 0.4), ['#ffe066', '#ffffff'], 12, { speed: 0.09, up: 0.03, size: 0.4, gravity: 0.002 }); buzz(12); }
    }
  }
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], c = balls[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), md = a.r + c.r;
    if (d < md && d > 1e-4) {
      const nx = dx / d, ny = dy / d, ov = (md - d) / 2; a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) { const ma = a.r * a.r, mc = c.r * c.r, jj = -2 * rv / (ma + mc); a.vx -= jj * mc * nx; a.vy -= jj * mc * ny; c.vx += jj * ma * nx; c.vy += jj * ma * ny; if (!SIM) tone(1200, 0.03, 'sine', 0.04, 0.9); }
    }
  }
}

function turn() {
  if (state !== 'play') return;
  phiT += step; turns++; sinceTurn = 0;
  if (!SIM) { tone(500 + (turns % 4) * 60, 0.06, 'triangle', 0.09, 1.3); buzz(6); }
}

// ---------------------------------------------------------------- end of a round
function cardEl(html) { if (bannerEl) bannerEl.style.opacity = 0; const d = document.createElement('div'); d.className = 'cb-card'; d.innerHTML = html; document.body.appendChild(d); return d; }
function killCards() { for (const c of document.querySelectorAll('.cb-card')) c.remove(); }
function btn(card, sel, fn) { const b = card.querySelector(sel); if (b) b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); fn(); }); }
function startLevel(n) { killCards(); closeMap(); level = n; build(); state = 'play'; ui.els.sc.classList.remove('hc-hidden'); B.start(); hint(); }
function hint() { if (level === 1 && !S.get('d_tap', 0)) { setTimeout(() => { if (state === 'play' && turns === 0 && level === 1) ui.pop('TAP TO TURN', '#fff', 34, 30); }, 1500); } }

function lose(b) {
  state = 'lost'; if (!recorded) { recorded = true; F.level(false, ni / need); }
  if (SIM) return;
  sfx.fail(); buzz([40, 30, 80]); ui.flash(0.4); shake = 0.5; chain = 0; setFeverHud();
  burst(scene, new THREE.Vector3(b.x, b.y, 0.5), [b.c, '#ffffff'], 26, { speed: 0.16, up: 0.06, size: 0.7, gravity: 0.003 });
  const left = need - ni, near = left <= Math.max(3, need * 0.2);
  const line = near ? `SO CLOSE: ${left} note${left === 1 ? '' : 's'} left of ${song.title}` : `${ni} of ${need} notes of ${song.title}`;
  const tip = (L.sour && ni < need * 0.5) ? 'Sour walls grow the ball fast.' : goldHits < 2 ? 'Turn the box so a gold wall catches the ball.' : '';
  setTimeout(() => {
    const c = cardEl(`<h1>FULL!</h1><p>${line}</p><p style="font-size:15px;opacity:.9">${tip}</p><div class="cb-row"><button class="cb-btn g" data-r>Again</button></div><div class="cb-row"><button class="cb-btn s" data-m>Map</button></div>`);
    btn(c, '[data-r]', () => startLevel(level)); btn(c, '[data-m]', () => { killCards(); openMap(); });
    c.addEventListener('pointerdown', () => { if (!c.dataset.keep) startLevel(level); });
    c.querySelector('[data-m]').addEventListener('pointerdown', () => { c.dataset.keep = 1; });
  }, 550);
}
function win() {
  if (state === 'won') return;
  state = 'won'; if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  addScore(25 + ((level - 1) % NL) * 3);
  const fillBest = peak, s = 1 + (fillBest <= L.s2 ? 1 : 0) + (fillBest <= L.s3 ? 1 : 0);
  best = Math.max(best, score); S.set('d_best', best);
  const ch = chordFor(seq[need - 1][0]);
  if (!SIM) { setTimeout(() => { for (const tn of ch.tones) note(72 + tn, 1.2, 0.1); note(48 + ch.root, 1.4, 0.14); }, 250); buzz([20, 40, 20]); ui.flash(0.35); confetti(scene, new THREE.Vector3(0, 1, 1), 110); }
  const idx = (level - 1) % NL, oldS = stars[idx] || 0, oldCh = charmsOpen();
  if (!D.isDaily) {
    if (s > oldS) { stars[idx] = s; S.set('d_stars', stars); }
    if (level >= unlocked && level < NL) { unlocked = level + 1; S.set('d_unl', unlocked); }
    else if (level >= unlocked) { unlocked = level + 1; S.set('d_unl', unlocked); }
    S.set('level', unlocked);
  } else S.set('d_dayDone', new Date().toDateString());
  D.won(score);
  const newCh = charmsOpen() > oldCh ? CHARMS[charmsOpen() - 1] : null;
  const tot = totalStars(), nextAt = Math.ceil((tot + 1) / 10) * 10, toNext = charmsOpen() >= CHARMS.length ? 0 : nextAt - tot;
  const hasNext = !D.isDaily;
  const tomorrow = `Tomorrow: a new Daily box${D.streak > 1 ? ` · day ${D.streak} streak` : ''}`;
  if (SIM) return;
  setTimeout(() => {
    const c = cardEl(`<h1>${L.boss ? 'BOSS CLEARED!' : 'SONG DONE!'}</h1><p>${song.title}${need < song.notes.length ? ' (' + (L.to - L.from) + ' notes)' : ''} · ${score} pts</p>
      <div class="cb-st">${[1, 2, 3].map(i => STAR_SVG(i <= s)).join('')}</div>
      <p style="font-size:15px">${s < 3 ? (s < 2 ? '2 stars: keep the biggest ball under ' + Math.round(L.s2 * 100) + '% full' : '3 stars: keep every ball under ' + Math.round(L.s3 * 100) + '% full') : 'Perfect: the ball never got big'}</p>
      ${newCh ? `<p style="color:#ffe066;font-size:20px;font-weight:800">NEW BALL: ${newCh.name}!</p>` : toNext ? `<div class="cb-bar"><i style="width:${(10 - toNext) * 10}%"></i></div><p style="font-size:14px">${toNext} stars to the next ball skin</p>` : ''}
      <div class="cb-row">${hasNext ? '<button class="cb-btn g" data-n>Next</button>' : '<button class="cb-btn g" data-n>Play on</button>'}</div>
      <div class="cb-row"><button class="cb-btn s" data-r>Again</button><button class="cb-btn s" data-m>Map</button></div>
      <p style="font-size:14px;opacity:.9;margin-top:6px">${tomorrow}</p>`);
    c.querySelectorAll('.cb-st svg').forEach((e, i) => { if (i < s) { e.classList.add('pop'); e.style.animationDelay = (0.15 + i * 0.22) + 's'; } });
    btn(c, '[data-n]', () => { if (D.isDaily) location.href = location.pathname; else startLevel(Math.min(level + 1, Math.max(unlocked, level + 1))); });
    btn(c, '[data-r]', () => startLevel(level)); btn(c, '[data-m]', () => { killCards(); openMap(); });
  }, 650);
}

// ---------------------------------------------------------------- the map
let mapEl = null;
function openMap() {
  closeMap(); if (state === 'play') { prevState = 'play'; state = 'map'; } else prevState = state;
  const worlds = WORLDS.map((W, wi) => {
    let g = ''; for (let i = 0; i < 10; i++) {
      const n = wi * 10 + i + 1, st = stars[n - 1] || 0, lock = n > unlocked, nxt = n === unlocked, boss = LEVELS[n - 1].boss;
      g += `<button class="cb-node${lock ? ' lock' : ''}${nxt ? ' next' : ''}${boss ? ' boss' : ''}" style="--w:${W.ui}" data-n="${n}">${lock ? '' : n}<small>${lock ? '' : [1, 2, 3].map(k => STAR_SVG(k <= st)).join('')}</small></button>`;
    }
    return `<h2>${W.name}</h2><div class="sub">${W.sub}</div><div class="cb-grid">${g}</div>`;
  }).join('');
  const open = charmsOpen(), tot = totalStars();
  const shelf = CHARMS.map((c, i) => `<button class="cb-ch${i >= open ? ' lock' : ''}${i === Math.min(eq, open - 1) ? ' on' : ''}" data-c="${i}" style="background:radial-gradient(circle at 35% 30%,#fff,${c.cols[0]} 45%,${c.cols[2]})" title="${c.name}"></button>`).join('');
  const dayDone = S.get('d_dayDone', '') === new Date().toDateString();
  mapEl = document.createElement('div'); mapEl.className = 'cb-map';
  mapEl.innerHTML = `<div class="top"><button class="cb-btn s" data-x>Back</button><div style="font-weight:800;font-size:20px;display:flex;align-items:center;gap:4px">${tot}<span style="width:22px;height:22px;display:inline-block">${STAR_SVG(true)}</span></div><button class="cb-btn s" data-d>${dayDone ? 'Daily ✓' : 'Daily box'}</button></div>
    ${worlds}<h2>BALLS</h2><div class="sub">${open >= CHARMS.length ? 'All collected' : (Math.ceil((tot + 1) / 10) * 10 - tot) + ' stars to the next one'} · tap to pick</div><div class="cb-shelf">${shelf}</div>`;
  document.body.appendChild(mapEl);
  mapEl.addEventListener('pointerdown', e => e.stopPropagation());
  mapEl.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.n) startLevel(+t.dataset.n);
    else if (t.dataset.c !== undefined) { eq = +t.dataset.c; S.set('d_eq', eq); openMap(); }
    else if (t.dataset.x !== undefined) { closeMap(); if (state === 'map') state = prevState; else if (state === 'lost' || state === 'won') startLevel(level); }
    else if (t.dataset.d !== undefined) location.href = location.pathname + '?daily=1';
  });
  const nx = mapEl.querySelector('.next'); if (nx) nx.scrollIntoView({ block: "nearest" });
}
function closeMap() { if (mapEl) { mapEl.remove(); mapEl = null; } }
const mapBtn = document.createElement('button'); mapBtn.className = 'cb-mapb';
mapBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" fill="#fff"><rect x="2" y="2" width="7" height="7" rx="2"/><rect x="13" y="2" width="7" height="7" rx="2"/><rect x="2" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>';
mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); killCards(); openMap(); });
document.body.appendChild(mapBtn);

input({ onDown: () => turn() });
ui.onTap(w => {
  B.start(); S.set('d_tap', 1);
  state = 'play'; ui.els.sc.classList.remove('hc-hidden'); hint();
});

// ---------------------------------------------------------------- one simulation step (also used by the QA bot, without drawing)
function stepSim(st) {
  sinceTurn += st;
  if (state === 'play') {
    if (spin) phiT += spin * st;
    if (chainT > 0) { chainT -= st; if (chainT <= 0 && chain) { chain = 0; setFeverHud(); } }
    if (fever > 0) { fever -= st; if (fever <= 0) { fever = 0; chain = 0; setFeverHud(); } }
    for (const p of pickups) if (!p.m.visible) { p.t += st; if (p.t >= 0) movePickup(p); }
  }
  phi = lerp(phi, phiT, Math.min(1, 16 * st));
  if (state === 'play') { for (let i = 0; i < 6 && state === 'play'; i++) physics(st / 6); }
  else if (state === 'ready') { phiT += st * 0.3; for (let i = 0; i < 3; i++) physics(st / 3); }
}

loop((dt, t) => {
  clock = t; let st = dt / 60;
  if (stopT > 0) { stopT -= st; st = 0; }
  stepSim(st);
  box.rotation.z = phi;
  for (const b of balls) {
    b.sq = Math.max(0, b.sq - st * 6);
    b.m.position.set(b.x, b.y, 0); b.m.scale.set(b.r * (1 + b.sq * 0.12), b.r * (1 - b.sq * 0.12), b.r);
    const f = (b.rt - R0) / (limit - R0);
    b.m.material.emissive.set(f > 0.8 && state === 'play' ? '#ff2d55' : b.c); b.m.material.emissiveIntensity = f > 0.8 ? 0.2 + 0.25 * Math.abs(Math.sin(t * 10)) : (fever > 0 ? 0.35 : 0.12);
  }
  let maxFrac = 0; for (const b of balls) maxFrac = Math.max(maxFrac, (b.rt - R0) / (limit - R0));
  if (state === 'lost') for (const b of balls) b.m.visible = false;
  warn = lerp(warn, maxFrac > 0.8 && state === 'play' ? 1 : 0, 0.1);
  wallMat.emissiveIntensity = 0.15 + warn * 0.25 * Math.abs(Math.sin(t * 8)) + (fever > 0 ? 0.25 + 0.15 * Math.sin(t * 14) : 0);
  // ball trail
  trailT += st;
  if (state === 'play' && trailT > 0.03) { trailT = 0; for (const b of balls) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: fever > 0 ? '#ffd23f' : b.c, transparent: true, opacity: 0.45, depthWrite: false })); sp.position.set(b.x, b.y, -0.1); sp.scale.setScalar(b.r * 1.6); scene.add(sp); trail.push({ m: sp, t: 0 }); } }
  for (let i = trail.length - 1; i >= 0; i--) { const q = trail[i]; q.t += st; q.m.material.opacity = Math.max(0, 0.45 - q.t * 1.4); if (q.t > 0.32) { scene.remove(q.m); q.m.material.dispose(); trail.splice(i, 1); } }
  for (const gs of gold) if (gs.m) { gs.pulse = Math.max(0, gs.pulse - st * 2); if (sides) gs.m.scale.set(1 + gs.pulse * 0.6, 1, 1 + gs.pulse * 0.6); }
  for (const gs of sour) if (gs.m) { gs.pulse = Math.max(0, gs.pulse - st * 2); if (sides) gs.m.scale.set(1 + gs.pulse * 0.5, 1, 1 + gs.pulse * 0.5); }
  for (const p of pegs) { p.pulse = Math.max(0, p.pulse - st * 3); p.m.scale.setScalar(p.r * (1 + p.pulse * 0.5)); }
  for (const p of pickups) if (p.m.visible) { p.m.material.rotation = Math.sin(t * 3 + p.x) * 0.3; p.m.scale.setScalar(0.8 + Math.sin(t * 6 + p.y) * 0.08); }
  goldMat && (goldMat.emissiveIntensity = 0.4 + Math.sin(t * 5) * 0.15);
  for (let i = ripples.length - 1; i >= 0; i--) { const rp = ripples[i]; rp.t += st; rp.m.scale.setScalar(0.2 + rp.t * 2.4); rp.m.material.opacity = Math.max(0, 0.8 - rp.t * 2); if (rp.t > 0.4) { scene.remove(rp.m); rp.m.material.dispose(); ripples.splice(i, 1); } }
  for (let i = notesFx.length - 1; i >= 0; i--) { const n = notesFx[i]; n.t += st; n.m.position.y += st * 1.6; n.m.position.x += n.vx * st; n.m.material.opacity = Math.max(0, 1 - n.t * 1.2); if (n.t > 0.85) { scene.remove(n.m); n.m.material.dispose(); notesFx.splice(i, 1); } }
  if (state === 'won') { box.rotation.z = phi + Math.sin(t * 6) * 0.03; for (const b of balls) b.m.position.y += Math.sin(t * 8 + b.x) * 0.02; }
  shake = Math.max(0, shake - st); zoom = Math.max(0, zoom - st * 2);
  const vf = camera.fov * Math.PI / 180, R = (sides ? (RI + WALL_T) / Math.cos(Math.PI / sides) : RI + WALL_T) + 0.6;
  const d = Math.max(R / (Math.tan(vf / 2) * camera.aspect), R / Math.tan(vf / 2)) * (1 - zoom * 0.05);
  const sx = (Math.random() - 0.5) * shake * 0.4;
  camera.position.set(sx, -0.6, d); camera.lookAt(sx, -0.6, 0);
  stage.followLight(new THREE.Vector3(0, 0, 0));
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');
if (SIM) { ui.hideStart(); mapBtn.remove(); state = 'play'; }
else if (unlocked > 1) { const h = ui.els.start.querySelector('h1'); const p = document.createElement('p'); p.textContent = `Level ${((level - 1) % NL) + 1} · ${totalStars()} stars`; h.after(p); }

// ---------------------------------------------------------------- bot (QA): turn the box so a golden wall sits where the biggest ball will land
function predictHit(b) {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  for (let k = 0; k < 240; k++) {
    const h = 1 / 120; vy -= GRAV * h; x += vx * h; y += vy * h;
    if (sides === 0) { if (Math.hypot(x, y) + b.r > RI) return { a: Math.atan2(y, x), t: k * h }; }
    else for (let e = 0; e < sides; e++) { const na = edgeNormalAngle(e) + phiT + spin * k * h; if (x * Math.cos(na) + y * Math.sin(na) + b.r > RI) return { a: na, t: k * h }; }
  }
  return null;
}
function bot() {
  if (state !== 'play' || Math.abs(phiT - phi) > 0.05) return;
  const b = balls.reduce((m, o) => (o.rt > m.rt ? o : m), balls[0]);
  const hit = predictHit(b); if (!hit || hit.t < 0.12) return;
  let bestK = 0, bestD = Infinity;
  for (const g of gold) for (let k = 0; k < (sides || 8); k++) {
    const wa = g.a + phiT + spin * hit.t + k * step, dd = angDiff(hit.a, wa);
    if (dd < bestD - 1e-6) { bestD = dd; bestK = k; }
  }
  if (bestK > 0 && bestK * 0.15 < hit.t + 0.2) turn();
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get stars() { return stars; }, get peak() { return peak; }, get ni() { return ni; }, get need() { return need; },
  get goldHits() { return goldHits; }, get fever() { return fever; }, get L() { return L; },
  bot,
  // run n seconds of game time at 60 steps/s with the bot (or skill: how often it may look 1 = every step)
  sim(sec, opts = {}) {
    const { botOn = true, every = 6, lag = 0 } = opts;
    let k = 0; const n = Math.round(sec * 60);
    for (let i = 0; i < n && state === 'play'; i++) { stepSim(1 / 60); if (botOn && ++k % every === 0) bot(); }
    return { state, ni, need, peak, score, goldHits };
  },
  setG(g) { G_OVR = g; },
  setLevel(n, salt = 0) { SALT = salt; startLevel(n); },
  setUnlocked(n) { unlocked = n; S.set('d_unl', n); },
};

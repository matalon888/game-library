// Stretch Dash v2 (deep) — the same jelly runner, with 30 hand-made levels in 3 worlds (levels.js), stars on the stairs,
// a level map, a jelly wardrobe opened by gem chests, golden drops, combos and Jelly Rush. Plan: DESIGN.md.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapt } from './kit/adapt.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS, ROW_GAP, STEPS, STEP_COST, MIN_H, MIN_W, BASE_H, BASE_W, parseGate, gateApply, capH, capW, crashCost, mass, worldOf, multOf, genLevel, bestPlan, starsFor } from './levels.js';

const WB = board({ game: 'stretch-dash', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.3 }, mode: 'sum', corner: 'bl' });
const ST = store('stretchdash2');
const F = flow('stretchdash'); let fk = 1;
const A = adapt();   // in-round: speed + crash cost ±20%, one lucky save per round (ADAPT_BRIEF.md), as in v1
const { scene, camera, followLight } = createStage({ fov: 52, shadowSize: 12 });
const ui = createUI({ title: 'STRETCH<br>DASH', hint: 'Drag to steer', hand: '👆', score: false });
document.body.style.setProperty('--ui', '#ff7a1a');
document.title = 'Stretch Dash';
for (const id of ['gems', 'size']) document.getElementById(id)?.remove();   // v1's HUD chips in index.html

// ---------------------------------------------------------------- save
const SAVE = {
  stars: ST.get('stars', {}), best: ST.get('best', {}), golds: ST.get('golds', {}), unlocked: ST.get('unlocked', 1), gems: ST.get('gems', 0),
  day: ST.get('day', { d: '', n: 0 }), streak: ST.get('streak', { last: '', n: 0 }),
  prog: ST.get('prog', {}), chest: ST.get('chest', 0), suits: ST.get('suits', [0]), suit: ST.get('suit', 0), seen: ST.get('seen', 0),
};
const save = k => ST.set(k, SAVE[k]);
let level = +new URLSearchParams(location.search).get('level') || Math.min(SAVE.unlocked, ST.get('level', 1));
const totalStars = () => Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
const goldsIn = w => Object.keys(SAVE.golds).filter(k => worldOf(+k) === w).length;
const CHEST = 150, DAILY = 3, DAILY_PAY = 60;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const dayBefore = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
// daily goal: clear 3 levels today for +60 gems; the streak counts days with the goal met
function dailyTick() {
  const t = today(); if (SAVE.day.d !== t) SAVE.day = { d: t, n: 0 };
  SAVE.day.n++; let paid = false;
  if (SAVE.day.n === DAILY) { paid = true; SAVE.streak = { last: t, n: SAVE.streak.last === dayBefore() ? SAVE.streak.n + 1 : 1 }; SAVE.gems += DAILY_PAY; save('gems'); save('streak'); }
  save('day'); return paid;
}
const dailyHtml = () => `<div class="sd-small">Today ${Array.from({ length: DAILY }, (_, i) => i < SAVE.day.n ? '●' : '○').join(' ')}${SAVE.streak.n && (SAVE.streak.last === today() || SAVE.streak.last === dayBefore()) ? ` · ${SAVE.streak.n} day streak` : ''}</div>`;

// ---------------------------------------------------------------- suits (code art only)
const SUITS = [
  { n: 'Orange', c: '#ff8a1a', e: '#ff5a00' }, { n: 'Mint', c: '#3fe0a8', e: '#00a070', hat: 'sprout' },
  { n: 'Berry', c: '#ff3d7f', e: '#c0004a', hat: 'bow' }, { n: 'Sky', c: '#3aa8ff', e: '#0060c0', hat: 'cap' },
  { n: 'Lime', c: '#a6f03a', e: '#50a000', hat: 'antenna' }, { n: 'Grape', c: '#9b5cff', e: '#5a20c0', hat: 'cone' },
  { n: 'Bubblegum', c: '#ff8ad8', e: '#d0409a', hat: 'flower' }, { n: 'Lemon', c: '#ffe03a', e: '#c0a000', hat: 'phones' },
  { n: 'Cocoa', c: '#9a5a32', e: '#5a2a10', hat: 'tophat' }, { n: 'Ice', c: '#bff4ff', e: '#40c0ff', hat: 'halo', glass: 1 },
  { n: 'Lava', c: '#ff4a2a', e: '#ff2000', hat: 'horns', hot: 1 }, { n: 'Golden', c: '#ffc93a', e: '#b07a00', hat: 'crown', gold: 1 },
];
const WORLD_SUIT = [1, 8, 9];   // finishing a world gives its suit
const GOLD_SUIT = 11;           // 15 golden drops
const suitMat = i => { const s = SUITS[i]; return glossy(s.c, { roughness: s.gold ? 0.25 : 0.18, metalness: s.gold ? 0.6 : 0.1, emissive: s.e, emissiveIntensity: s.hot ? 0.45 : 0.12, transparent: !!s.glass, opacity: s.glass ? 0.8 : 1 }); };
let JELLY = suitMat(SAVE.suit);

function makeHat(kind) {
  const g = new THREE.Group(), M = c => mat(c, { roughness: 0.4 });
  const add = (geo, c, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m; };
  if (kind === 'sprout') { add(new THREE.CylinderGeometry(0.02, 0.02, 0.14), '#2a8a3a', 0, 0.26, 0); add(new THREE.SphereGeometry(0.07, 10, 8), '#5fd35f', -0.06, 0.33, 0).scale.set(1.4, 0.5, 0.8); add(new THREE.SphereGeometry(0.07, 10, 8), '#5fd35f', 0.06, 0.35, 0).scale.set(1.4, 0.5, 0.8); }
  if (kind === 'bow') { add(new THREE.ConeGeometry(0.08, 0.14, 8), '#ff2a6a', -0.08, 0.2, 0, 0, Math.PI / 2); add(new THREE.ConeGeometry(0.08, 0.14, 8), '#ff2a6a', 0.08, 0.2, 0, 0, -Math.PI / 2); add(new THREE.SphereGeometry(0.04, 8, 8), '#ff2a6a', 0, 0.2, 0); }
  if (kind === 'cap') { add(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#1e5aff', 0, 0.06, 0); add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), '#1e5aff', 0, 0.07, 0.17).scale.set(1, 1, 0.7); }
  if (kind === 'antenna') { add(new THREE.CylinderGeometry(0.015, 0.015, 0.25), '#333', 0, 0.3, 0); add(new THREE.SphereGeometry(0.05, 10, 8), '#ff3b4e', 0, 0.44, 0); }
  if (kind === 'cone') { add(new THREE.ConeGeometry(0.11, 0.3, 14), '#ffd23f', 0, 0.32, 0); add(new THREE.SphereGeometry(0.035, 8, 8), '#ff5d8f', 0, 0.48, 0); }
  if (kind === 'flower') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(new THREE.SphereGeometry(0.045, 8, 6), '#fff', Math.cos(a) * 0.07 + 0.1, 0.2 + Math.sin(a) * 0.07, 0.05); } add(new THREE.SphereGeometry(0.04, 8, 6), '#ffd23f', 0.1, 0.2, 0.07); }
  if (kind === 'phones') { add(new THREE.TorusGeometry(0.22, 0.025, 6, 20, Math.PI), '#333', 0, 0.02, 0); add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), '#ff3b4e', -0.22, 0, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), '#ff3b4e', 0.22, 0, 0, 0, Math.PI / 2); }
  if (kind === 'tophat') { add(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 16), '#222', 0, 0.32, 0); add(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16), '#222', 0, 0.19, 0); add(new THREE.CylinderGeometry(0.152, 0.152, 0.05, 16), '#ff3b4e', 0, 0.23, 0); }
  if (kind === 'halo') { const h = add(new THREE.TorusGeometry(0.16, 0.025, 8, 24), '#fff4a0', 0, 0.36, 0, Math.PI / 2); h.material.emissive = new THREE.Color('#ffe060'); h.material.emissiveIntensity = 0.8; }
  if (kind === 'horns') { add(new THREE.ConeGeometry(0.05, 0.16, 8), '#fff2e0', -0.12, 0.2, 0, 0, 0.5); add(new THREE.ConeGeometry(0.05, 0.16, 8), '#fff2e0', 0.12, 0.2, 0, 0, -0.5); }
  if (kind === 'crown') { add(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16, 1, true), '#ffd23f', 0, 0.22, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(new THREE.ConeGeometry(0.035, 0.09, 6), '#ffd23f', Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14); } g.children.forEach(m => { m.material.metalness = 0.7; m.material.roughness = 0.25; }); }
  return g;
}

// ---------------------------------------------------------------- jelly runner (stretched as a whole: scale.y = height, scale.xz = width)
function makeRunner() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, JELLY); m.position.set(x, y, z); m.castShadow = true; inner.add(m); return m; };
  const piv = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); inner.add(p); return p; };
  const torso = add(new THREE.CapsuleGeometry(0.27, 0.42, 6, 16), 0, 1.08, 0); torso.scale.set(1, 1, 0.85);
  const head = add(new THREE.SphereGeometry(0.21, 20, 16), 0, 1.6, 0);
  const eyeM = mat('#23232e', { roughness: 0.3 });
  for (const ex of [-0.075, 0.075]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeM); e.position.set(ex, 1.63, 0.19); e.scale.set(1, 1.3, 0.6); inner.add(e); }
  const hat = makeHat(SUITS[SAVE.suit].hat); hat.position.set(0, 1.6, 0); inner.add(hat);
  const limb = (p, r, len) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 12), JELLY); m.position.y = -len / 2 - 0.02; m.castShadow = true; p.add(m); return m; };
  const legL = piv(-0.13, 0.72), legR = piv(0.13, 0.72), armL = piv(-0.36, 1.32), armR = piv(0.36, 1.32);
  limb(legL, 0.12, 0.5); limb(legR, 0.12, 0.5); limb(armL, 0.095, 0.48); limb(armR, 0.095, 0.48);
  armL.rotation.z = -0.25; armR.rotation.z = 0.25;
  Object.assign(g, { inner, legL, legR, armL, armR, head, torso });
  return g;
}

// ---------------------------------------------------------------- textures
function labelTex(top, big, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = color; x.globalAlpha = 0.55; x.fillRect(0, 0, 256, 256); x.globalAlpha = 1;
  x.fillStyle = color; x.fillRect(0, 0, 256, 54);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '800 38px "Baloo 2", system-ui, sans-serif'; x.fillText(top, 128, 30);
  x.font = '800 92px "Baloo 2", system-ui, sans-serif'; x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.18)'; x.strokeText(big, 128, 150); x.fillText(big, 128, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// drawn stars (the ★ glyph is missing from some phones' fonts and shows as a box)
const STAR = (n = 1, o = 1) => `<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-.13em;opacity:${o}"><path fill="currentColor" d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 17.6 5.6 21.2 7 14l-5.3-5 7.2-.9z"/></svg>`.repeat(n);
function starPath(x, cx, cy, r) { x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const hazardTex = canvasTex(128, 32, x => { x.fillStyle = '#ffd21f'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#23232e'; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 20, 0); x.lineTo(i * 16 + 12, 0); x.fill(); } });
hazardTex.wrapS = THREE.RepeatWrapping;
const windTex = canvasTex(128, 64, (x) => { x.clearRect(0, 0, 128, 64); x.fillStyle = 'rgba(255,255,255,.85)'; for (const ox of [10, 74]) { x.beginPath(); x.moveTo(ox, 14); x.lineTo(ox + 30, 32); x.lineTo(ox, 50); x.lineTo(ox + 12, 32); x.fill(); } });
windTex.wrapS = windTex.wrapT = THREE.RepeatWrapping;
const HAZ = glossy('#ffffff', { map: hazardTex }), DARK = mat('#23232e'), DOOR = glossy('#7a5cff', { roughness: 0.35 }), FRAME = glossy('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.5 });
const STEP_COLS = ['#ff4d6d', '#ff8c42', '#ffd23f', '#9ef01a', '#3ab795', '#00c2ff', '#3a86ff', '#7b5cff', '#c77dff', '#ff5d8f'];

// ---------------------------------------------------------------- level build
const TW = 6.4, LANE = 1.6;
let world, rows, items, gemMesh, stairs, stairZ, finZ, runner, state = 'ready', P, gems = 0, camD = 8, chunks = [], climbStep = -1, endT = 0, mult = 1;
const RIVAL = { 5: 2.8, 10: 2.6, 15: 3.2, 20: 2.4, 25: 2.8, 30: 2.3 };   // rival mass to out-size at the stairs (~55% of what the plan bot arrives with)
let rival = null, kick = 0, LV, SPEC, STARS3, combo = 0, rush = 0, freeze = 0, shake = 0, lineHit = 0, lineIdx = -1, plan = null, goldGot = false, wind = 0, runT = 0, starsWon = 0;
let camUp = 0;
function gateColor(g) { return g.op === '+' ? '#1e90ff' : g.op === 'x' ? '#2b4dff' : g.op === '-' ? '#ff3b4e' : '#c4122f'; }
function gateMesh(g, w = TW / 2 - 0.25) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.6, 0.12), new THREE.MeshStandardMaterial({ map: labelTex(g.label, g.big, gateColor(g)), transparent: true, opacity: 0.92, roughness: 0.3 }));
  m.position.y = 1.3; world.add(m);
  if (g.op === 'x') { const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.16, 0.18), glossy('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.5 })); fr.position.y = 1.32; m.add(fr); }
  return m;
}
function block(x0, x1, y0, y1, z, depth = 0.6, material = HAZ) {
  const w = x1 - x0, h = y1 - y0; if (w < 0.04 || h < 0.04) return null;
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, depth), material); b.scale.set(w, h, 1); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); b.castShadow = true; world.add(b); return b;
}
function buildLevel() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  const wi = worldOf(level), WD = WORLDS[wi];
  document.body.style.setProperty('--bg1', WD.sky[0]); document.body.style.setProperty('--bg2', WD.sky[1]);
  SPEC = level <= LEVELS.length ? LEVELS[level - 1] : genLevel(level, rng(level * 613 + 5));
  STARS3 = [1, ...starsFor(level, SPEC.rows)];
  plan = bestPlan(SPEC.rows).plan || [];
  fk = F.k(); A.round(level === 1 ? 0 : 1);
  rows = []; items = []; cause = ''; gems = 0; chunks = []; climbStep = -1; endT = 0; mult = 1; combo = 0; rush = 0; freeze = 0; shake = 0; goldGot = false; wind = 0; runT = 0; starsWon = 0; lineIdx = -1;
  let z = -16;
  SPEC.rows.forEach((spec, i) => {
    const row = { ...spec, z, done: false, i };
    if (spec.k === 'g') {
      row.gates = [spec.a, spec.b].map((s, j) => { if (!s) return null; const g = parseGate(s); g.x = j ? LANE : -LANE; g.m = gateMesh(g); g.m.position.set(g.x, 1.3, z); return g; }).filter(Boolean);
    } else if (spec.k === 's') {
      row.g = parseGate(spec.a); row.g.m = gateMesh(row.g, 2.1); row.g.m.position.z = z; row.amp = Math.min(spec.amp, TW / 2 - 1.15); row.ph = i * 1.7;
    } else if (spec.k === 'b') {
      const tex = hazardTex.clone(); tex.needsUpdate = true;
      const x0 = spec.side > 0 ? -0.15 : -TW / 2 - 0.3, x1 = spec.side < 0 ? 0.15 : TW / 2 + 0.3; tex.repeat.set((x1 - x0) / 2.2, 1);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.32, 0.32), mat('#ffffff', { map: tex })); bar.position.set((x0 + x1) / 2, spec.h + 0.16, z); bar.castShadow = true; world.add(bar); row.m = bar;
      for (const sx of spec.side ? [spec.side] : [-1, 1]) block(sx * (TW / 2 + 0.3) - 0.16, sx * (TW / 2 + 0.3) + 0.16, 0, spec.h + 0.32, z, 0.32, DARK);
      if (spec.side) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glossy('#ff3b4e', { emissive: '#ff0000', emissiveIntensity: 0.5 })); tip.position.set(spec.side > 0 ? -0.15 : 0.15, spec.h + 0.16, z); world.add(tip); }
    } else if (spec.k === 'w') {
      row.L = block(0, 1, 0, 2.2, z); row.R = block(0, 1, 0, 2.2, z); row.hx = spec.x; placeWall(row, 0);
    } else if (spec.k === 'r') {
      const holes = spec.holes.map(([x, w, h]) => ({ x, w, h })).sort((a, b) => a.x - b.x), TOP = 4.2; row.hs = holes;
      let x = -TW / 2;
      for (const h of holes) { block(x, h.x - h.w / 2, 0, TOP, z, 0.5, DOOR); block(h.x - h.w / 2, h.x + h.w / 2, h.h, TOP, z, 0.5, DOOR); block(h.x - h.w / 2 - 0.06, h.x - h.w / 2, 0, h.h, z + 0.05, 0.55, FRAME); block(h.x + h.w / 2, h.x + h.w / 2 + 0.06, 0, h.h, z + 0.05, 0.55, FRAME); block(h.x - h.w / 2, h.x + h.w / 2, h.h - 0.06, h.h, z + 0.05, 0.55, FRAME); x = h.x + h.w / 2; }
      block(x, TW / 2, 0, TOP, z, 0.5, DOOR);
    } else if (spec.k === 'd') {
      for (let k = 0; k < spec.n; k++) items.push({ t: 'drop', ax: spec.ax, x: spec.x, z: z - k * 1.25, y: 0.45, got: false, row: i });
    } else if (spec.k === 'f') {
      const t = windTex.clone(); t.needsUpdate = true; t.repeat.set(3, spec.len / 3);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(TW, spec.len), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, color: '#7ff0ff', depthWrite: false }));
      pl.rotation.x = -Math.PI / 2; if (spec.push < 0) pl.rotation.z = Math.PI; pl.position.set(0, 0.02, z - spec.len / 2); world.add(pl); row.tex = t; row.z1 = z - spec.len;
    }
    // gem trio after the row: on the lane the next choice wants (two rows in three) or the other lane (risk), unless authored
    const nxt = SPEC.rows[i + 1];
    if (nxt && spec.k !== 'd' && spec.k !== 'f') {
      const want = laneFor(nxt, plan[i + 1]);
      const gx = spec.gm !== undefined ? spec.gm : (i % 3 === 2 && want !== null ? -want : want ?? 0);
      for (let k = 0; k < 3; k++) items.push({ t: 'gem', x: clamp(gx, -2.4, 2.4), z: z - 5.5 - k * 1.2, y: 0.7, got: false, line: i });
    }
    if (spec.gold !== undefined && !SAVE.golds[level]) items.push({ t: 'gold', x: spec.gold, z: z - 2.6, y: 0.9, got: false });
    rows.push(row); z -= spec.k === 'f' ? Math.max(ROW_GAP, spec.len + 4) : ROW_GAP;
  });
  finZ = z + 4;
  // track
  const len = -finZ + 40;
  const tt = canvasTex(128, 128, x => { x.fillStyle = WD.track; x.fillRect(0, 0, 128, 128); x.globalAlpha = 0.08; x.fillStyle = '#000'; x.fillRect(0, 0, 128, 40); });
  tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(1, len / 4);
  const track = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.6, len), mat('#ffffff', { map: tt, roughness: 0.5 })); track.position.set(0, -0.3, -len / 2 + 14); track.receiveShadow = true; world.add(track);
  for (const sx of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, len), mat(WD.edge)); edge.position.set(sx * (TW / 2 + 0.12), -0.22, track.position.z); world.add(edge); }
  // items: gems (instanced), drops and golds (meshes)
  const gemList = items.filter(o => o.t === 'gem');
  gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.28, 0), glossy('#ff2bd6', { emissive: '#b0009a', emissiveIntensity: 0.35, flatShading: true }), Math.max(1, gemList.length)); gemMesh.castShadow = true; world.add(gemMesh);
  gemList.forEach((g, k) => g.k = k);
  const dropM = { h: glossy('#46d2ff', { emissive: '#0090d0', emissiveIntensity: 0.3 }), w: glossy('#8dff5a', { emissive: '#40b000', emissiveIntensity: 0.3 }) };
  for (const o of items) {
    if (o.t === 'drop') { o.m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), dropM[o.ax]); o.m.scale.set(o.ax === 'w' ? 1.5 : 0.8, o.ax === 'h' ? 1.6 : 0.8, 1); o.m.position.set(o.x, o.y, o.z); o.m.castShadow = true; world.add(o.m); }
    if (o.t === 'gold') { o.m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glossy('#ffd23f', { emissive: '#ffa000', emissiveIntensity: 0.7, metalness: 0.6, flatShading: true })); o.m.position.set(o.x, o.y, o.z); world.add(o.m); }
  }
  // finish line + stairs (21 steps x1.0 → x5.0; the 2★ and 3★ steps are gold with a star)
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(TW, 1.4), new THREE.MeshBasicMaterial({ map: canvasTex(64, 16, x => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#23232e' : '#fff'; x.fillRect(i * 4, j * 4, 4, 4); } }) }));
  fl.material.map.magFilter = THREE.NearestFilter; fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.01, finZ); world.add(fl);
  stairs = []; stairZ = finZ - 3;
  for (let i = 0; i < STEPS; i++) {
    const step = i + 1, m = multOf(step), y = step * 0.42, sz = stairZ - i * 1.25, star = step === STARS3[1] ? 2 : step === STARS3[2] ? 3 : 0;
    const col = star ? '#ffc21a' : STEP_COLS[i % STEP_COLS.length];
    const tx = canvasTex(256, 64, x => { x.fillStyle = col; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = '800 44px "Baloo 2", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('x' + m.toFixed(1), star ? 150 : 128, 34); x.fillStyle = '#fff3a0'; for (let k = 0; k < star; k++) starPath(x, 36 + k * 30, 33, 14); });
    const side = mat(col, star ? { emissive: '#ff9a00', emissiveIntensity: 0.35 } : {}), front = mat('#ffffff', { map: tx });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TW, y, 1.25), [side, side, side, side, front, side]); mesh.position.set(0, y / 2, sz - 0.62); mesh.receiveShadow = true; mesh.castShadow = true; world.add(mesh);
    stairs.push({ y, z: sz - 0.62, m, mesh, star });
  }
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), glossy('#ffd23f', { emissive: '#ffa000', emissiveIntensity: 0.6, metalness: 0.5, flatShading: true })); crown.position.set(0, stairs[STEPS - 1].y + 1.4, stairs[STEPS - 1].z); world.add(crown); stairs.crown = crown;
  rival = null;
  if (RIVAL[level]) {
    const rm = RIVAL[level], r = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.8, 0.72), glossy('#6a6a78', { emissive: '#ff2040', emissiveIntensity: 0.25 }));
    body.position.y = 0.9; r.add(body); r.userData.m = rm; const k = Math.sqrt(rm);
    r.scale.set(k, k, k); r.position.set(0, 0, stairZ + 3.2); world.add(r); rival = r;
    const lt = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('RIVAL', 'x' + rm.toFixed(1), '#ff4060'), transparent: true })); lt.scale.set(2.2 / k, 1.1 / k, 1); lt.position.set(0, 2.1 + 0.9 / k, 0); r.add(lt);
  }
  // runner
  runner = makeRunner(); world.add(runner);
  P = { x: 0, z: 0, tx: 0, H: 1, W: 1, dH: 1, dW: 1, vH: 0, vW: 0, ph: 0, y: 0 };
  ui.levels(level); ui.progress(0); setHud(); hud.lv.innerHTML = `<b>${wi + 1}-${((level - 1) % 10) + 1}</b> ${SPEC.n}${SPEC.hard ? ' <i>HARD</i>' : ''}`;
  camD = 8;
}
function placeWall(row, t) {
  const hx = row.amp ? clamp(row.x + Math.sin(t * row.hz * Math.PI * 2 + row.i) * row.amp, -TW / 2 + row.w / 2 + 0.2, TW / 2 - row.w / 2 - 0.2) : row.x;
  row.hx = hx; const l0 = -TW / 2, l1 = hx - row.w / 2, r0 = hx + row.w / 2, r1 = TW / 2;
  if (row.L) { row.L.visible = l1 - l0 > 0.05; row.L.scale.x = Math.max(0.05, l1 - l0); row.L.position.x = (l0 + l1) / 2; }
  if (row.R) { row.R.visible = r1 - r0 > 0.05; row.R.scale.x = Math.max(0.05, r1 - r0); row.R.position.x = (r0 + r1) / 2; }
}
const sliderX = (row, t) => Math.sin(t * row.hz * Math.PI * 2 + row.ph) * row.amp;
// the lane a row wants for a plan choice (gems lead there); null = anywhere
function laneFor(r, c) {
  if (!r) return null;
  if (r.k === 'g') return c === 1 ? LANE : -LANE;
  if (r.k === 'b' && r.side) return c === 0 ? r.side * LANE : -r.side * LANE;
  if (r.k === 'w') return r.amp ? null : r.x;
  if (r.k === 'r') return [...r.holes].sort((a, b) => a[0] - b[0])[c ?? 0]?.[0] ?? null;
  if (r.k === 'd') return r.x;
  return null;
}

// ---------------------------------------------------------------- HUD + cards (DOM)
const css = document.createElement('style');
css.textContent = `
.sd-hud{position:fixed;left:12px;top:calc(56px + env(safe-area-inset-top));z-index:6;display:flex;flex-direction:column;gap:6px;pointer-events:none;font-weight:800}
.sd-chip{background:rgba(0,0,0,.18);border-radius:16px;padding:2px 12px;font-size:16px;line-height:1.35;color:#fff}
.sd-gems{position:fixed;right:12px;top:calc(56px + env(safe-area-inset-top));z-index:6;background:rgba(0,0,0,.18);border-radius:16px;padding:2px 12px;font-weight:800;font-size:20px;pointer-events:none;color:#fff}
.sd-lv{position:fixed;left:0;right:0;top:calc(98px + env(safe-area-inset-top));text-align:center;z-index:5;pointer-events:none;font-weight:800;color:#fff;font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.15)}
.sd-lv i{font-style:normal;background:#ff3b4e;border-radius:8px;padding:0 6px;margin-left:4px}
.sd-combo{position:fixed;right:12px;top:calc(128px + env(safe-area-inset-top));z-index:6;font-weight:800;color:#fff;font-size:22px;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,.2);transition:transform .12s}
.sd-rush{position:fixed;inset:0;pointer-events:none;z-index:3;box-shadow:inset 0 0 80px 20px rgba(255,80,220,.55);opacity:0;transition:opacity .3s}
.sd-rush b{position:absolute;left:0;right:0;bottom:calc(96px + env(safe-area-inset-bottom));text-align:center;font-size:30px;color:#fff;text-shadow:0 3px 0 #c0309a;animation:hcpulse .5s ease-in-out infinite}
.sd-map-btn{position:fixed;right:14px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:7;width:56px;height:56px;border-radius:50%;border:0;background:rgba(0,0,0,.28);font-size:26px;color:#fff;cursor:pointer;pointer-events:auto}
.sd-stars{font-size:46px;letter-spacing:6px;margin:4px 0;color:rgba(255,255,255,.35)}
.sd-stars b{color:#ffd23f;text-shadow:0 3px 0 #c08a00;display:inline-block;animation:sdpop .4s both}
@keyframes sdpop{0%{transform:scale(0) rotate(-40deg)}70%{transform:scale(1.35)}100%{transform:scale(1)}}
.sd-line{font-size:20px;font-weight:800}
.sd-auto .hint::after{content:'';display:block;height:4px;border-radius:2px;margin:6px auto 0;width:90px;background:#fff;transform-origin:left;animation:sdauto 3.4s linear .65s forwards}@keyframes sdauto{to{transform:scaleX(0)}}
.sd-bar{width:240px;height:18px;border-radius:9px;background:rgba(0,0,0,.2);margin:10px auto 2px;overflow:hidden;position:relative}
.sd-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffd23f,#ff8c42);border-radius:9px;transition:width 1s ease-out}
.sd-small{font-size:14px;opacity:.9}
.sd-win .hint{display:block;margin:14px auto 12vh;width:78%;max-width:300px;padding:14px 0;border-radius:30px;background:#fff;color:#2a1a5e!important;font-size:24px!important;font-weight:900;opacity:1!important;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.sd-cardbtn{pointer-events:auto;margin-top:12px;font:inherit;font-weight:800;font-size:16px;color:#fff;background:rgba(0,0,0,.25);border:0;border-radius:20px;padding:6px 18px;cursor:pointer}
.sd-map{position:fixed;inset:0;z-index:20;background:linear-gradient(#2a1a5e,#13324f);color:#fff;font-family:"Baloo 2",system-ui,sans-serif;overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 14px 30px;box-sizing:border-box}
.sd-map h2{margin:14px 0 4px;font-size:22px}
.sd-map .row{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:8px 0}
.sd-node{position:relative;aspect-ratio:1;border-radius:18px;border:0;font:inherit;font-weight:800;font-size:20px;color:#fff;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.25)}
.sd-node small{position:absolute;bottom:2px;left:0;right:0;font-size:11px;color:#ffd23f;letter-spacing:1px}
.sd-node.lock{opacity:.35;cursor:default}
.sd-node.hard{outline:3px solid #ff3b4e}
.sd-node.next{animation:hcpulse 1.2s ease-in-out infinite;outline:3px solid #fff}
.sd-top{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:18px}
.sd-x{font:inherit;font-weight:800;font-size:22px;border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:50%;width:44px;height:44px;cursor:pointer}
.sd-suits{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:8px 0}
.sd-suit{border:0;border-radius:16px;padding:8px 4px;font:inherit;font-size:12px;font-weight:800;color:#fff;background:rgba(255,255,255,.1);cursor:pointer}
.sd-suit i{display:block;width:34px;height:44px;margin:0 auto 4px;border-radius:17px 17px 12px 12px}
.sd-suit.on{outline:3px solid #ffd23f}
.sd-suit.lock i{background:#555!important}
.sd-chest{position:fixed;inset:0;z-index:25;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(20,10,50,.82);color:#fff;font-family:"Baloo 2",system-ui,sans-serif;font-weight:800;text-align:center}
.sd-chest .box{font-size:96px;animation:sdshake .5s ease-in-out 2}
.sd-chest .got{font-size:30px;margin-top:10px;animation:sdpop .5s both}
@keyframes sdshake{25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
`;
document.head.appendChild(css);
const el = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const hud = { box: el('<div class="sd-hud"><div class="sd-chip" data-s></div></div>'), gems: el('<div class="sd-gems"></div>'), lv: el('<div class="sd-lv"></div>'), combo: el('<div class="sd-combo"></div>'), rush: el('<div class="sd-rush"><b>JELLY RUSH · 💎x2</b></div>'), map: el('<button class="sd-map-btn" aria-label="Levels">🗺</button>') };
document.body.append(hud.box, hud.gems, hud.lv, hud.combo, hud.rush, hud.map);
hud.map.addEventListener('pointerdown', e => { e.stopPropagation(); openMap(); });
function setHud() {
  hud.box.querySelector('[data-s]').innerHTML = `↕ ${Math.round(P.H * 100)}<br>↔ ${Math.round(P.W * 100)}`;
  hud.gems.textContent = '💎 ' + gems;
  hud.combo.textContent = combo >= 2 ? `x${Math.min(combo, 9)} COMBO` : '';
}
const starHtml = (n, of = 3, anim = false) => Array.from({ length: of }, (_, i) => i < n ? `<b style="animation-delay:${anim ? 0.25 + i * 0.3 : 0}s">${STAR()}</b>` : STAR()).join('');

// level map + wardrobe
let mapEl = null, prevState = null;
function openMap() {
  if (mapEl) return; prevState = state; if (state === 'play') state = 'paused';
  const node = lv => {
    const s = SAVE.stars[lv] || 0, lock = lv > SAVE.unlocked, spec = LEVELS[lv - 1], col = ['#2fa8ff', '#ff5fae', '#6a5cff'][worldOf(lv)];
    return `<button class="sd-node${lock ? ' lock' : ''}${spec && spec.hard ? ' hard' : ''}${lv === SAVE.unlocked ? ' next' : ''}" data-lv="${lv}" style="background:${lock ? '#556' : col}">${lock ? '🔒' : lv}<small>${lock ? '' : STAR(s) + STAR(3 - s, 0.3)}</small></button>`;
  };
  let h = `<div class="sd-top"><span>${STAR()} ${totalStars()} / ${LEVELS.length * 3}</span><span>💎 ${SAVE.gems}</span><button class="sd-x" data-close>✕</button></div>${dailyHtml()}`;
  WORLDS.forEach((W, wi) => {
    const lv0 = wi * 10 + 1, st = Array.from({ length: 10 }, (_, k) => SAVE.stars[lv0 + k] || 0).reduce((a, b) => a + b, 0);
    h += `<h2>${wi + 1} · ${W.name} <span class="sd-small">${STAR()} ${st}/30${wi ? ` · ✦ ${goldsIn(wi)}/10` : ''}</span></h2>`;
    for (let r = 0; r < 2; r++) h += `<div class="row">${Array.from({ length: 5 }, (_, k) => node(lv0 + r * 5 + k)).join('')}</div>`;
  });
  if (SAVE.unlocked > LEVELS.length) h += `<h2>Bonus runs</h2><div class="row">${node(Math.max(31, SAVE.unlocked))}</div>`;
  h += `<h2>Wardrobe <span class="sd-small">${SAVE.suits.length}/${SUITS.length} · 🎁 ${Math.min(SAVE.chest, CHEST)}/${CHEST} 💎 to the next chest</span></h2><div class="sd-suits">`;
  SUITS.forEach((s, i) => { const own = SAVE.suits.includes(i); h += `<button class="sd-suit${own ? '' : ' lock'}${SAVE.suit === i ? ' on' : ''}" data-suit="${i}"><i style="background:${s.c}"></i>${own ? s.n : '?'}</button>`; });
  h += `</div><div class="sd-small" style="opacity:.75">World suits: finish a world. Golden suit: 15 golden drops ✦.</div>`;
  mapEl = el(`<div class="sd-map">${h}</div>`); document.body.appendChild(mapEl);
  mapEl.addEventListener('pointerdown', e => e.stopPropagation());
  mapEl.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.close !== undefined) return closeMap();
    if (t.dataset.lv) { const lv = +t.dataset.lv; if (lv > SAVE.unlocked) return; closeMap(true); goLevel(lv); }
    if (t.dataset.suit) { const i = +t.dataset.suit; if (!SAVE.suits.includes(i)) return; wear(i); closeMap(); openMap(); }
  });
}
function closeMap(leaving) { if (!mapEl) return; mapEl.remove(); mapEl = null; if (!leaving && prevState === 'play') state = 'play'; else if (!leaving) state = prevState; }
function wear(i) { SAVE.suit = i; save('suit'); JELLY = suitMat(i); if (runner) { const keep = { ...P }; world.remove(runner); runner = makeRunner(); world.add(runner); Object.assign(P, keep); } }
function goLevel(lv) {
  level = lv; ST.set('level', level);
  for (const c of [ui.els.win, ui.els.lose, ui.els.start]) c.classList.add('hc-hidden');
  ui.els.win.classList.remove('sd-auto'); buildLevel(); state = 'play'; WB.start(); intro();
}
function intro() { setTimeout(() => { if (state === 'play' && climbStep < 0) ui.pop(SPEC.hard ? 'HARD LEVEL!' : `${worldOf(level) + 1}-${((level - 1) % 10) + 1}`, SPEC.hard ? '#ff6a5c' : '#ffffff', 40, 34); }, 250); }

// ---------------------------------------------------------------- input
let dragging = false, botX = null, botOn = false;
input({
  onDown() { if (state === 'play') { dragging = true; botX = null; A.input(); } },
  onMove(dx) { if (state === 'play' && dragging) P.tx = clamp(P.tx + dx * 0.022, -TW / 2 + 0.4, TW / 2 - 0.4); },
  onUp() { dragging = false; if (state === 'lost' && Date.now() - lostAt > 900) goLevel(level); },
  onTap(e) { if (state === 'play') { botX = null; P.tx = clamp(P.tx + (e.clientX < innerWidth / 2 ? -1 : 1) * TW / 4, -TW / 2 + 0.4, TW / 2 - 0.4); } },
});
// level 1 steers itself until the first touch (as v1): it shows what steering does
const D = demo(null, { ready: () => state === 'play' && level === 1 && climbStep < 0, wait: 400, ms: 5000 });
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); intro(); }
  else if (w === 'win') { goLevel(level + 1); }
  else if (w === 'lose') { goLevel(level); }
});

// ---------------------------------------------------------------- events
function chop(kind, amount) {
  const piece = new THREE.Mesh(new THREE.CapsuleGeometry(0.22 * Math.max(0.5, P.W), Math.max(0.1, amount * BASE_H * 0.8), 5, 10), JELLY);
  if (kind === 'h') piece.position.set(P.x, P.H * BASE_H, P.z);
  else { piece.position.set(P.x + (Math.random() < 0.5 ? -1 : 1) * P.W * 0.3, BASE_H * P.H * 0.55, P.z); piece.rotation.z = 1.4; }
  piece.castShadow = true; world.add(piece);
  chunks.push({ m: piece, v: new THREE.Vector3((Math.random() - 0.5) * 0.14, 0.14, 0.18), s: (Math.random() - 0.5) * 0.3 });
  burst(world, piece.position, [SUITS[SAVE.suit].c, '#ffffff', SUITS[SAVE.suit].e], 12, { speed: 0.13, up: 0.11, size: 0.9, shape: 'sphere' });
  sfx.smash(); buzz([25, 20, 25]); ui.flash(0.25); freeze = Math.max(freeze, 4); shake = Math.max(shake, 0.25 + amount * 0.4);
}
// combo: clean actions chain; at 5 Jelly Rush (gems x2, glow) for 4 s. Unavoidable cuts don't break it, mistakes do
function good(text, color = '#ffffff') {
  combo++; const c = Math.min(combo, 9);
  shake = Math.max(shake, 0.04 + c * 0.025); if (c >= 3) burst(world, new THREE.Vector3(P.x, BASE_H * P.H * 0.6, P.z), ['#ffffff', SUITS[SAVE.suit].c], 6 + c * 3, { speed: 0.1 + c * 0.012, up: 0.08 });
  kick = Math.max(kick, 0.25 + c * 0.16); if (c >= 4) ui.flash(0.05 + c * 0.025);
  if (c >= 6) freeze = Math.max(freeze, 2 + (c >= 9 ? 3 : 0));
  if (combo === 9) { gems += 30; setTimeout(() => ui.pop('PERFECT STREAK +30 💎', '#ffd23f', 30, 22), 260); }
  note(67 + [0, 2, 4, 5, 7, 9, 11, 12, 14][c - 1], 0.18, 0.14); setTimeout(() => note(74 + [0, 2, 4, 5, 7, 9, 11, 12, 14][c - 1], 0.22, 0.12), 70);
  ui.pop(text + (combo >= 2 ? `  x${c}` : ''), color, 32 + c * 2, 30);
  hud.combo.style.transform = 'scale(1.35)'; setTimeout(() => hud.combo.style.transform = '', 120);
  if (combo === 5 || (combo > 5 && combo % 5 === 0)) startRush();
}
function oops() { if (combo >= 3) ui.pop('COMBO LOST', '#ffb0b0', 26, 40); combo = 0; }
function startRush() { rush = 4; hud.rush.style.opacity = 1; tone(500, 0.4, 'sawtooth', 0.08, 2); buzz([20, 20, 20, 20, 40]); burst(world, new THREE.Vector3(P.x, BASE_H * P.H, P.z), ['#ff5dd8', '#ffd23f', '#ffffff'], 26, { speed: 0.2, up: 0.15 }); }
function endRush() { rush = 0; hud.rush.style.opacity = 0; }
function saved(axis) { if (!A.rescue()) return false; if (axis === 'h') P.H = Math.max(P.H, MIN_H + 0.1); else P.W = Math.max(P.W, MIN_W + 0.1); ui.pop('PHEW! 🍀', '#7dffb0', 40, 40); sfx.coin(); buzz([10, 30, 10]); return true; }
function checkDead(msg) { if ((P.H < MIN_H && !saved('h')) || (P.W < MIN_W && !saved('w'))) { P.H = Math.max(P.H, 0.05); P.W = Math.max(P.W, 0.05); lose(msg); return true; } return false; }
let slowT = 0, blame = null, gapM = null;
function showGap() {   // slow-mo loss: a green pillar on the lane that would have saved the run
  const r = blame; if (!r || !world) return; let x = null;
  if (r.k === 'w') x = r.hx; else if (r.k === 'r') x = r.hs.reduce((a, h) => h.h * h.w > a.h * a.w ? h : a).x;
  else if (r.k === 'g') { const gd = r.gates.filter(g => g.good); if (gd.length) x = gd.reduce((a, g) => gateScore(g) > gateScore(a) ? g : a).x; }
  else if (r.k === 'b' && r.side) x = -r.side * 1.6;
  if (x === null) return;
  gapM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6, 0.3), new THREE.MeshBasicMaterial({ color: '#5dff9a', transparent: true, opacity: 0.45, depthWrite: false }));
  gapM.position.set(x, 3, r.z); world.add(gapM);
}
const gateScore = g => g.op === 'x' ? g.v * 2 : g.v;
let lostAt = 0; var cause = '';
function lose(t) {
  lostAt = Date.now();
  failsAt[level] = (failsAt[level] || 0) + 1;
  showGap();
  A.miss(); state = 'lost'; shake = Math.max(shake, 0.5); endRush(); hud.combo.textContent = ''; const done = rows.filter(r => r.done).length, left = rows.length - done;
  F.level(false, done / rows.length); sfx.fail(); buzz([40, 30, 60]);
  slowT = 0.7; ui.pop(t, '#ff6b6b', 40, 30);   // 0.7 s slow-mo on the crash, then the card
  const pb = SAVE.prog[level] || 0, nowP = done; let progTxt = ''; if (nowP > pb) { SAVE.prog[level] = nowP; save('prog'); if (pb > 0) progTxt = `<div class="sd-small">CLOSER THAN LAST TIME! ${nowP}/${rows.length} rows (was ${pb})</div>`; } else if (pb > 0) progTxt = `<div class="sd-small">Best so far: ${pb}/${rows.length} rows</div>`;
  const line = (cause ? `<div class="sd-small" style="color:#ff8a8a">${cause}</div>` : '') + progTxt + `<div class="sd-line">${rival && climbStep >= 0 ? `RIVAL x${rival.userData.m.toFixed(1)} vs YOU x${mass(P).toFixed(1)}` : left <= 3 ? `SO CLOSE! ${left === 1 ? '1 row' : left + ' rows'} from the stairs` : t === 'TOO SMALL TO CLIMB!' ? `${Math.max(1, Math.ceil((STEP_COST + MIN_H * 0.6 - mass(P)) * 100))} more jelly and you climb` : `${left} rows to go`}</div><div class="sd-small">Tip: ${tipFor()}</div>`;
  setTimeout(() => { if (state !== 'lost') return; ui.lose(t, ''); ui.els.lose.querySelector('[data-x]').innerHTML = line; }, 750);
}
function faceOff() {   // the rival at the foot of the stairs: out-size it or lose on screen
  const rm = rival.userData.m, you = mass(P);
  if (you < rm) { shake = 0.9; rival.scale.multiplyScalar(1.15); lose('OUT-SIZED!'); return false; }
  ui.pop('OUT-SIZED THE RIVAL!', '#7dffb0', 44, 34); sfx.win(); buzz([30, 30, 30]); ui.flash(0.4);
  burst(world, rival.position, ['#ff4060', '#ffffff', '#ffd23f'], 40, { speed: 0.2, up: 0.2 }); world.remove(rival); rival = null; gems += 10;
  return true;
}
function tipFor() {
  if (rival) return 'bigger than the rival x' + rival.userData.m.toFixed(1) + ': skip red gates';
  const r = rows.find(x => !x.done) || rows[rows.length - 1];
  if (r.k === 'b') return 'take Wider before a low beam';
  if (r.k === 'w') return r.w < 1.3 ? 'grow Taller before a narrow wall' : 'line up with the hole early';
  if (r.k === 'r') return 'pick the door that fits your shape';
  return 'blue grows you, red shrinks you';
}
function win(step) {
  state = 'won'; endRush(); F.level(true); WB.submit(1); hud.combo.textContent = '';
  starsWon = step >= STARS3[2] ? 3 : step >= STARS3[1] ? 2 : 1;
  const pts = Math.round(gems * mult), prev = SAVE.stars[level] || 0, firstClear = !prev;
  if (starsWon > prev) { SAVE.stars[level] = starsWon; save('stars'); }
  const prevBest = SAVE.best[level] || 0, newBest = pts > prevBest; if (newBest) { SAVE.best[level] = pts; save('best'); }
  if (goldGot && !SAVE.golds[level]) { SAVE.golds[level] = 1; save('golds'); }
  if (level >= SAVE.unlocked) { SAVE.unlocked = level + 1; save('unlocked'); }
  const dailyPaid = dailyTick();
  const welcome = firstClear && level <= 2 ? 50 : 0;   // first two clears fill the chest faster: first suit inside ~90 s
  SAVE.gems += pts + welcome; save('gems'); const chest0 = SAVE.chest; SAVE.chest += pts + welcome; save('chest');
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1);
  confetti(world, new THREE.Vector3(P.x, P.y + 3, P.z - 1), 110); setTimeout(() => confetti(world, new THREE.Vector3(P.x, P.y + 3, P.z - 1), 70), 300);
  // rewards in order: world suit, golden suit, chest
  const gifts = [];
  if (firstClear && level % 10 === 0 && level <= 30 && !SAVE.suits.includes(WORLD_SUIT[level / 10 - 1])) gifts.push(WORLD_SUIT[level / 10 - 1]);
  if (Object.keys(SAVE.golds).length >= 15 && !SAVE.suits.includes(GOLD_SUIT)) gifts.push(GOLD_SUIT);
  let opened = false;
  if (SAVE.chest >= CHEST) { opened = true; SAVE.chest -= CHEST; save('chest'); const pool = SUITS.map((_, i) => i).filter(i => !SAVE.suits.includes(i) && !WORLD_SUIT.includes(i) && i !== GOLD_SUIT && !gifts.includes(i)); gifts.push(pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1); }
  ui.win(level, '');
  const near = starsWon < 3 ? (STARS3[starsWon] - step === 1 ? `1 step from ${STAR(starsWon + 1)}!` : `${STAR(starsWon + 1)} at x${multOf(STARS3[starsWon]).toFixed(1)}`) : (step >= STEPS ? 'TOP OF THE STAIRS!' : (pts > 0 ? 'PERFECT RUN!' : 'CLEARED'));
  const x = ui.els.win.querySelector('[data-x]');
  x.innerHTML = `<div class="sd-stars">${starHtml(starsWon, 3, true)}</div><div class="sd-line">x${mult.toFixed(1)} · ${pts} 💎</div><div class="sd-small">${newBest && prevBest ? `NEW BEST! (was ${prevBest})` : newBest ? 'first clear' : `best ${prevBest} 💎`}</div><div class="sd-small">${near}</div>
    <div class="sd-bar"><i style="width:${Math.min(100, chest0 / CHEST * 100)}%"></i></div><div class="sd-small">${opened ? '🎁 CHEST!' : `🎁 ${SAVE.chest}/${CHEST} · ${Math.max(1, Math.ceil((CHEST - SAVE.chest) / Math.max(20, pts)))} more to a new suit`}</div>
    ${dailyPaid ? `<div class="sd-line" style="color:#ffd23f">DAILY DONE +${DAILY_PAY} 💎</div>` : ''}${dailyHtml()}
    <button class="sd-cardbtn" data-map>🗺 Levels</button>`;
  ui.els.win.classList.add('sd-win');
  ui.els.win.querySelector('.hint').textContent = (level < LEVELS.length ? `Level ${level + 1}` : 'Next') + ' ▶';
  setTimeout(() => { const bar = x.querySelector('.sd-bar i'); if (bar) bar.style.width = (opened ? 100 : Math.min(100, SAVE.chest / CHEST * 100)) + '%'; }, 900);
  x.querySelector('[data-map]').addEventListener('pointerdown', e => { e.stopPropagation(); openMap(); });
  for (let i = 0; i < starsWon; i++) setTimeout(() => { note(76 + i * 4, 0.3, 0.16); buzz(15); }, 900 + i * 300);
  if (gifts.length) setTimeout(() => showGifts(gifts), 1900);
  else { const lv0 = level; ui.els.win.classList.add('sd-auto'); setTimeout(() => { if (state === 'won' && level === lv0 && !mapEl) goLevel(level + 1); }, 650 + 3400); }   // the card runs on by itself; Levels or a tap are quicker
}
function showGifts(list) {
  const g = list.shift(); if (g === undefined) { if (state === 'gift') state = 'play'; return; }
  if (state === 'play') state = 'gift';   // the card was tapped already: hold the run until the gift is seen
  const c = el(`<div class="sd-chest"><div class="box">🎁</div><div class="got" style="opacity:0">…</div><div class="sd-small" style="margin-top:18px;opacity:0">tap</div></div>`);
  document.body.appendChild(c); tone(300, 0.5, 'triangle', 0.1, 2);
  setTimeout(() => {
    c.querySelector('.box').textContent = g < 0 ? '💎' : '✨';
    const got = c.querySelector('.got'); got.style.opacity = 1;
    if (g < 0) { SAVE.gems += 100; save('gems'); got.innerHTML = '+100 💎'; }
    else { SAVE.suits.push(g); save('suits'); got.innerHTML = `NEW SUIT<br><span style="color:${SUITS[g].c};font-size:44px">${SUITS[g].n}</span>`; wear(g); }
    c.querySelector('.sd-small').style.opacity = 0.8; sfx.win(); buzz([20, 30, 20, 30, 60]);
    c.addEventListener('pointerdown', e => { e.stopPropagation(); c.remove(); showGifts(list); });
  }, 1000);
}

// ---------------------------------------------------------------- loop
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
let simT = 0;
loop((dt, t) => {
  if (!runner) return;
  let s = dt / 60;
  if (slowT > 0) { slowT -= s; s *= 0.25; }
  if (gapM) { gapM.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 120); if (state !== 'lost') { world.remove(gapM); gapM = null; } }
  if (freeze > 0) { freeze -= dt; s = 0; }   // hit-stop on slices and crashes
  if (state === 'play') simT += s;
  const wi = worldOf(level);
  for (const r of rows) { if (r.k === 'w' && r.amp) placeWall(r, simT); if (r.k === 's' && !r.done) r.g.m.position.x = sliderX(r, simT); if (r.k === 'f') r.tex.offset.y -= s * 0.6; }
  if (state === 'play') {
    A.tick(s); runT += s;
    if (rush > 0) { rush -= s; if (rush <= 0) endRush(); else if (Math.random() < 0.25) burst(world, new THREE.Vector3(P.x, 0.3, P.z + 0.4), ['#ff5dd8', '#ffd23f'], 2, { speed: 0.03, up: 0.04, size: 0.6 }); }
    if (climbStep < 0) {
      const sp = WORLDS[wi].speed * (1 + ((level - 1) % 10) * 0.015) * A.k(fk);
      P.z -= sp * s;
      // wind belts push the target sideways while you're on them
      wind = 0; for (const r of rows) if (r.k === 'f' && P.z <= r.z && P.z >= r.z1) wind = r.push;
      if (wind) P.tx = clamp(P.tx + wind * s, -TW / 2 + 0.4, TW / 2 - 0.4);
      if (botOn && !dragging) botSteer();
      else if (botX !== null && !dragging) P.tx = botX;
      if (D.on && !dragging) botSteer();
      P.x = lerp(P.x, P.tx, Math.min(1, 0.2 * dt));
      const halfW = BASE_W / 2 * P.W;
      for (const row of rows) {
        if (row.done || P.z > row.z) continue;
        row.done = true; blame = row; resolve(row, halfW, wi);
        if (state !== 'play') return;
        setHud();
      }
      for (const o of items) {
        if (o.got || Math.abs(o.z - P.z) > 0.6 || Math.abs(o.x - P.x) > 0.45 + halfW) continue;
        o.got = true;
        if (o.t === 'gem') {
          const n = rush > 0 ? 2 : 1; gems += n; buzz(4);
          if (lineIdx !== o.line) { lineIdx = o.line; lineHit = 0; } lineHit++;
          note(84 + lineHit * 2 + (rush > 0 ? 5 : 0), 0.12, 0.1);
          if (lineHit === 3) { ui.pop(rush > 0 ? 'LINE! x2' : 'LINE!', '#ff9af0', 30, 44); gems += n; }
          burst(world, new THREE.Vector3(o.x, o.y, o.z), '#ff2bd6', 6, { speed: 0.06, up: 0.06, size: 0.5 });
        } else if (o.t === 'drop') {
          P[o.ax === 'h' ? 'H' : 'W'] = Math.min(o.ax === 'h' ? 3.5 : 3, P[o.ax === 'h' ? 'H' : 'W'] + 0.04); o.m.visible = false;
          note(72 + (items.filter(d => d.t === 'drop' && d.got && d.row === o.row).length % 12), 0.08, 0.08);
          burst(world, o.m.position, o.ax === 'h' ? '#46d2ff' : '#8dff5a', 5, { speed: 0.05, up: 0.06, size: 0.5 });
          const line = items.filter(d => d.t === 'drop' && d.row === o.row); if (line.every(d => d.got)) good('FULL LINE!', '#9dffb0');
        } else if (o.t === 'gold') {
          goldGot = true; o.m.visible = false; ui.pop('GOLDEN DROP ✦', '#ffd23f', 44, 36); sfx.win(); buzz([20, 30, 20]); ui.flash(0.35);
          burst(world, o.m.position, ['#ffd23f', '#ffffff', '#ffa000'], 40, { speed: 0.18, up: 0.15 });
        }
        setHud();
      }
      ui.progress(Math.min(0.9, P.z / finZ * 0.9));
      if (P.z < stairZ) { climbStep = 0; P.x = lerp(P.x, 0, 0.5); window.__finM = mass(P); if (rival && !faceOff()) return; }
    } else {
      // stair climb: every step costs body mass (the same rule as levels.js stepsFor)
      const st = stairs[climbStep], tz = st.z;
      P.z = lerp(P.z, tz, Math.min(1, 0.2 * dt)); P.y = lerp(P.y, st.y, Math.min(1, 0.24 * dt)); P.x = lerp(P.x, 0, 0.1 * dt);
      if (Math.abs(P.z - tz) < 0.15) {
        if (!st.paid) {
          if (mass(P) - STEP_COST < MIN_H * 0.6) { if (climbStep === 0) return lose('TOO SMALL TO CLIMB!'); return win(climbStep); }
          st.paid = true; shrinkBy(STEP_COST); stepFx(climbStep); mult = st.m;
        }
        if (climbStep < STEPS - 1 && mass(P) - STEP_COST >= MIN_H * 0.6) climbStep++;
        else return win(climbStep + 1);
      }
      ui.progress(0.9 + climbStep / STEPS * 0.1);
    }
  }
  // jelly spring on size changes
  for (const [k, d, v] of [['H', 'dH', 'vH'], ['W', 'dW', 'vW']]) { P[v] += (P[k] - P[d]) * 0.12 * dt; P[v] *= Math.pow(0.82, dt); P[d] += P[v] * dt; }
  const run = state === 'play' && freeze <= 0 ? 1 : 0;
  P.ph += s * 11 * run;
  runner.position.set(P.x, P.y, P.z);
  runner.scale.set(Math.pow(P.dW, 1.35), Math.pow(P.dH, 1.25), Math.pow(P.dW, 1.35));
  runner.rotation.y = Math.PI + (P.tx - P.x) * -0.25;
  JELLY.emissiveIntensity = rush > 0 ? 0.35 + Math.sin(t * 18) * 0.2 : (SUITS[SAVE.suit].hot ? 0.45 : 0.12);
  const sw = Math.sin(P.ph);
  if (state === 'won') { endT += dt / 60; runner.armL.rotation.set(0, 0, -2.6 - Math.sin(endT * 10) * 0.3); runner.armR.rotation.set(0, 0, 2.6 + Math.sin(endT * 10) * 0.3); runner.inner.position.y = Math.abs(Math.sin(endT * 7)) * 0.25; runner.rotation.y = lerp(runner.rotation.y, 0, 0.05); runner.legL.rotation.x = runner.legR.rotation.x = 0; }
  else { runner.legL.rotation.x = sw * 0.9 * run; runner.legR.rotation.x = -sw * 0.9 * run; runner.armL.rotation.x = -sw * 0.8 * run; runner.armR.rotation.x = sw * 0.8 * run; runner.inner.position.y = Math.abs(Math.cos(P.ph)) * 0.06 * run; }
  for (const c of chunks) { c.v.y -= 0.008 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.s * dt; c.m.rotation.z += c.s * 0.7 * dt; if (c.m.position.y < 0.2) { c.m.position.y = 0.2; c.v.set(c.v.x * 0.6, Math.abs(c.v.y) * 0.3, c.v.z * 0.6); } }
  let gi = 0;
  for (const g of items) {
    if (g.t === 'gem') { const sc = g.got ? 0 : 1; M.compose(V.set(g.x, g.y + Math.sin(t * 3 + gi) * 0.1, g.z), Q.setFromEuler(E.set(0, t * 2 + gi, 0)), S.setScalar(sc)); gemMesh.setMatrixAt(g.k, M); gi++; }
    else if (g.t === 'gold' && g.m.visible) { g.m.rotation.y = t * 3; g.m.position.y = g.y + Math.sin(t * 4) * 0.15; }
    else if (g.t === 'drop' && g.m.visible) g.m.position.y = g.y + Math.abs(Math.sin(t * 5 + g.z)) * 0.12;
  }
  gemMesh.instanceMatrix.needsUpdate = true;
  if (stairs.crown) stairs.crown.rotation.y = t * 1.5;
  // camera: behind and above, pulling back as the runner grows; shake on hits
  const tall = P.dH * BASE_H, wantD = 7.2 + Math.max(0, tall - 1.8) * 1.4 + Math.max(0, P.dW - 1) * 1.5;
  camD = lerp(camD, state === 'won' ? 8.5 : wantD, 0.05 * dt); kick *= Math.pow(0.88, dt);
  const ang = state === 'won' ? endT * 0.4 : 0;
  const climb = climbStep >= 0 || state === 'won' ? 1 : 0; camUp = lerp(camUp, climb, 0.05 * dt);
  shake *= Math.pow(0.86, dt); const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake, cd = camD - kick;
  camera.position.set(P.x * 0.5 + Math.sin(ang) * cd + sx, P.y + cd * 0.62 + tall * 0.3 + camUp * 3.2 + sy, P.z + Math.cos(ang) * cd + camUp * 1.5);
  camera.lookAt(P.x * 0.5, P.y + tall * 0.55 + camUp * 0.6, P.z - 3.5 + camUp * 1.5);
  followLight(V.set(P.x, P.y, P.z - 2));
});
function resolve(row, halfW, wi) {
  if (row.k === 'g') {
    if (!row.gates.length) return;
    const g = row.gates.reduce((a, b) => Math.abs(b.x - P.x) < Math.abs(a.x - P.x) ? b : a);
    if (Math.abs(g.x - P.x) > TW / 2 - 0.1 + halfW && row.gates.length === 1) return;   // went past the empty half
    if (row.gates.length === 1 && Math.sign(P.x || 0.01) !== Math.sign(g.x)) return;
    gateFx(g, row.gates.find(o => o !== g));
    return void checkDead('TOO SMALL!');
  }
  if (row.k === 's') {
    const gx = sliderX(row, simT);
    row.g.m.position.x = gx;
    if (Math.abs(gx - P.x) < 1.05 + halfW * 0.5) { gateFx(row.g, null, 'CAUGHT! '); checkDead('TOO SMALL!'); }
    return;
  }
  if (row.k === 'b') {
    const under = !row.side || P.x * row.side > -halfW;
    if (!under) { good('DODGED!'); sfx.coin(); return; }
    const top = P.H * BASE_H;
    if (top > row.h) {
      const nh = capH(row.h), cut = P.H - nh; P.H = nh; chop('h', cut); ui.pop('SLICED!', '#ffd21f', 36, 30);
      if (row.side) oops(); A[P.H < MIN_H + 0.12 ? 'miss' : 'near']();
      cause = 'The low bar sliced you too short: shrink your height first'; return void checkDead('SLICED TOO SHORT!');
    }
    good('DUCKED!'); sfx.coin(); A.ok(); return;
  }
  if (row.k === 'w') {
    const l = row.hx - row.w / 2, r = row.hx + row.w / 2;
    if (P.x < l || P.x > r) { cause = P.x < l ? 'You hit the wall LEFT of the hole: steer into the gap' : 'You hit the wall RIGHT of the hole: steer into the gap'; crash(row.L && Math.abs(row.L.position.x - P.x) < Math.abs((row.R?.position.x ?? 99) - P.x) ? row.L : row.R, wi); return void checkDead('CRUSHED!'); }
    if (halfW * 2 > row.w) { const nw = capW(row.w), cut = P.W - nw; P.W = nw; chop('w', cut * 0.5); ui.pop('SQUEEZED!', '#ffd21f', 34, 30); A.near(); cause = 'The hole was narrower than you: shrink your width first'; return void checkDead('SQUEEZED FLAT!'); }
    const off = Math.abs(P.x - row.hx) / (row.w / 2);
    if (off <= 0.45) { good('BULLSEYE!', '#7dffb0'); gems += 3; } else if (off >= 0.8) { oops(); ui.pop('GRAZED', '#ffd21f', 28, 30); } else good('PERFECT FIT!');
    sfx.coin(); A.ok(); return;
  }
  if (row.k === 'r') {
    const h = row.hs.find(o => Math.abs(P.x - o.x) <= o.w / 2);
    if (!h) { cause = 'You missed every hole in the wall'; crash(null, wi); return void checkDead('CRUSHED!'); }
    let cut = 0;
    if (P.H * BASE_H > h.h) { const nh = capH(h.h); cut += P.H - nh; P.H = nh; chop('h', P.H - nh + 0.1); }
    if (halfW * 2 > h.w) { const nw = capW(h.w); cut += P.W - nw; P.W = nw; chop('w', 0.2); }
    if (cut < 0.05) good('TAILOR MADE!', '#c9b8ff'); else { ui.pop('TRIMMED!', '#ffd21f', 34, 30); if (cut > 0.6) oops(); }
    A[cut < 0.05 ? 'ok' : 'near']();
    cause = 'The hole trimmed you too small'; return void checkDead('TRIMMED TOO SMALL!');
  }
}
function gateFx(g, other, pre = '') {
  const h0 = P.H, w0 = P.W; gateApply(P, g);
  tone(g.good ? 260 + Math.min(combo, 9) * 40 : 180, 0.16, 'sawtooth', 0.05, g.good ? 2.2 : 0.5); P.vH -= 0.25; P.vW += 0.25;   // whoosh + squash on every gate
  P.vH += (P.H - h0) * 0.5; P.vW += (P.W - w0) * 0.5;   // overshoot kick: the jelly boings past its new size
  g.m.material.opacity = 0.25; g.m.scale.set(1.08, 1.08, 1);
  const worse = other && !other.good;
  cause = g.good ? '' : `The ${g.label.toUpperCase()} gate (${g.op === '/' ? '÷' + g.v : '-' + Math.round(g.v * 100)}) ${other && other.good ? 'was the wrong door: the other one helped' : 'cost you the run'}`;
  if (g.good) { A.ok(); good(pre + (g.op === 'x' ? '×' + g.v + ' ' : '+' + Math.round(g.v * 100) + ' ') + g.label.toUpperCase(), g.op === 'x' ? '#ffd23f' : '#ffffff'); buzz(10); kick = Math.max(kick, g.op === 'x' ? 1.4 : 0.8); burst(world, new THREE.Vector3(P.x, BASE_H * P.H, P.z), [gateColor(g), '#ffffff'], g.op === 'x' ? 26 : 12, { speed: 0.1, up: 0.08 }); if (g.op === 'x') { ui.flash(0.3); shake = 0.15; } }
  else { if (worse) A.near(); else A.miss(); oops(); ui.pop((g.op === '/' ? '÷' + g.v : '-' + Math.round(g.v * 100)) + ' ' + g.label.toUpperCase(), '#ff3b4e', 34, 30); tone(300, 0.2, 'square', 0.08, 0.6); buzz([15, 10, 15]); }
}
const failsAt = {};   // gentler wall crashes after repeated losses on the same level (never the first tries)
function crash(blockMesh, wi) {
  const cost = crashCost(wi) * A.k() * Math.max(0.55, 1 - 0.15 * (failsAt[level] || 0)); P.H -= cost; chop('h', cost); A.miss(); oops(); shake = 0.6; freeze = 6;
  if (blockMesh) { burst(world, blockMesh.position, ['#ffd21f', '#23232e'], 18, { speed: 0.15, up: 0.1, size: 1.2 }); }
  ui.pop('CRASH! -' + Math.round(cost * 100), '#ff3b4e', 36, 30);
}
function shrinkBy(c) { const m = mass(P), f = Math.sqrt(Math.max(0.01, (m - c) / m)); P.H *= f; P.W *= f; setHud(); }
function stepFx(i) {
  const st = stairs[i];
  note(60 + [0, 2, 4, 5, 7, 9, 11][i % 7] + 12 * Math.floor(i / 7), 0.22, 0.14); buzz(8);
  burst(world, new THREE.Vector3(0, st.y + 0.1, st.z), [st.star ? '#ffd23f' : STEP_COLS[i % STEP_COLS.length], '#ffffff'], st.star ? 40 : 10, { speed: st.star ? 0.2 : 0.1, up: 0.08 });
  ui.pop(st.star ? STAR(st.star) + ' x' + st.m.toFixed(1) : 'x' + st.m.toFixed(1), st.star ? '#ffd23f' : '#fff', 40 + i * 1.5, 30); st.mesh.position.y += 0.08;
  if (st.star) { ui.flash(0.4); sfx.win(); shake = 0.2; }
  if (i === STEPS - 1) { confetti(world, new THREE.Vector3(0, st.y + 2, st.z), 160); ui.pop('JACKPOT! x5', '#ffd23f', 60, 28); stairs.crown.visible = false; }
}

// ---------------------------------------------------------------- QA bot: steers by the level's best plan (levels.js bestPlan)
function botSteer() {
  const i = rows.findIndex(r => !r.done); if (i < 0) { P.tx = 0; return; }
  // drops being collected: stay on their lane until the line is behind us
  const dline = items.find(o => o.t === 'drop' && !o.got && o.z < P.z + 0.5 && o.z > P.z - 14 && plan[o.row] === 0);
  const r = rows[i], c = plan[i];
  let x = laneFor(r, c);
  if (r.k === 's') { const gx = sliderX(r, simT + Math.max(0, (P.z - r.z)) / (WORLDS[worldOf(level)].speed)); x = c === 0 ? gx : (gx > 0 ? -2.4 : 2.4); }
  if (r.k === 'w' && r.amp) x = r.hx;
  if (dline && (P.z - r.z) > 6) x = dline.x;
  if (x === null || x === undefined) x = P.tx;
  P.tx = clamp(x, -TW / 2 + 0.4, TW / 2 - 0.4);
}

buildLevel();
if (!SAVE.seen) { SAVE.seen = 1; save('seen'); }

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return SAVE.gems; }, get adapt() { return A.state; },
  get deep() { return true; }, get stars() { return { by: SAVE.stars, total: totalStars(), unlocked: SAVE.unlocked, last: starsWon }; },
  get size() { return { H: P.H, W: P.W, step: climbStep }; },
  bot(on = true) { if (state !== 'play') return; A.input(); botOn = on; },
  go(lv) { goLevel(lv); },
};

// Loaf Flip — original food-folding puzzle. Food tiles sit on a chopping board; swipe a stack to flip it over onto its
// neighbour (the stack lands upside down on top). Fold everything into one stack with bread at both ends.
// Levels are made by unfolding a finished stack backwards, so every level is solvable.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, palette, applyPalette } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board as scoreboard } from './kit/board.js';

const NAME = 'Loaf Flip: Food Puzzle';
const S = store('loafflip');
let level = S.get('level', 1), score = S.get('score', 0);
const F = flow('loafflip');
const stage = createStage({ fov: 34, shadowSize: 7 });
const { scene, camera, sun } = stage;
const ui = createUI({ title: 'LOAF<br>FLIP', hint: 'Tap a tile, then tap its neighbour · or swipe', hand: '👆' });
const D = daily('loafflip', ui, { name: NAME });
const B = scoreboard({ game: 'loaf-flip', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum' });   // world board: levels cleared today (RULES.md)

const CELL = 1.08, BASE = 0.12;
const M = {}; const m = (c, o) => M[c + JSON.stringify(o || {})] || (M[c + JSON.stringify(o || {})] = mat(c, o));

// ---------------------------------------------------------------- food models (each centred on its own middle, height th)
function extrudeShape(shape, th, bevel = 0.025) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, th - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, -th / 2 + bevel, 0); return g;
}
function wavyShape(r0, amp, n, sq = 0) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 72; i++) {
    const a = i / 72 * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
    const sqr = sq ? 1 / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(si), 4), 0.25) : 1;   // squircle
    const r = (r0 + amp * Math.sin(a * n)) * lerp(1, sqr, sq);
    i ? s.lineTo(c * r, si * r) : s.moveTo(c * r, si * r);
  }
  return s;
}
function toastShape(sc = 1) {
  const s = new THREE.Shape(), w = 0.42 * sc, h = 0.36 * sc;
  s.moveTo(-w, -h); s.lineTo(w, -h); s.lineTo(w, h * 0.55);
  s.bezierCurveTo(w + 0.06 * sc, h * 1.3, w * 0.25, h * 1.42, 0, h * 1.12);
  s.bezierCurveTo(-w * 0.25, h * 1.42, -w - 0.06 * sc, h * 1.3, -w, h * 0.55); s.closePath();
  return s;
}
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const KINDS = {
  bread: { th: 0.24, make() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo('crust', () => extrudeShape(toastShape(1), 0.24, 0.05)), m('#c27a3a')));
    g.add(new THREE.Mesh(geo('crumb', () => extrudeShape(toastShape(0.84), 0.255, 0.04)), m('#f6d79c', { roughness: 0.85 })));
    return g; } },
  lettuce: { th: 0.11, make() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo('let1', () => extrudeShape(wavyShape(0.44, 0.035, 11, 0.6), 0.09, 0.02)), m('#55b03b')));
    const top = new THREE.Mesh(geo('let2', () => extrudeShape(wavyShape(0.36, 0.03, 9, 0.5), 0.11, 0.02)), m('#8fd35b')); g.add(top);
    return g; } },
  tomato: { th: 0.14, make() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo('tom', () => new THREE.CylinderGeometry(0.4, 0.4, 0.13, 32)), m('#e63946')));
    g.add(new THREE.Mesh(geo('tomi', () => new THREE.CylinderGeometry(0.31, 0.31, 0.14, 32)), m('#ff7b7b')));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const sd = new THREE.Mesh(geo('seed', () => new THREE.SphereGeometry(0.05, 8, 6).scale(1, 0.4, 1.4)), m('#ffe08a')); sd.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17); sd.scale.y = 1.8; g.add(sd); }
    return g; } },
  cheese: { th: 0.1, make() {
    const s = new THREE.Shape(); const w = 0.43; s.moveTo(-w, -w); s.lineTo(w, -w); s.lineTo(w, w); s.lineTo(-w, w); s.closePath();
    for (const [x, y, r] of [[-0.18, 0.15, 0.09], [0.2, -0.12, 0.11], [0.12, 0.25, 0.05], [-0.22, -0.22, 0.06]]) { const h = new THREE.Path(); h.absarc(x, y, r, 0, Math.PI * 2, true); s.holes.push(h); }
    return new THREE.Mesh(geo('cheese', () => extrudeShape(s, 0.1, 0.02)), m('#ffd23f', { roughness: 0.45 })); } },
  ham: { th: 0.09, make() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo('ham', () => extrudeShape(wavyShape(0.4, 0.015, 7, 0.75), 0.08, 0.02)), m('#ff8fab')));
    g.add(new THREE.Mesh(geo('hami', () => extrudeShape(wavyShape(0.27, 0.02, 5, 0.4), 0.09, 0.02)), m('#ffc2d1')));
    return g; } },
  egg: { th: 0.16, make() {
    const g = new THREE.Group();
    const w = new THREE.Mesh(geo('egg', () => extrudeShape(wavyShape(0.41, 0.03, 5, 0.2), 0.08, 0.02)), m('#ffffff', { roughness: 0.35 })); w.position.y = -0.03; g.add(w);
    const y = new THREE.Mesh(geo('yolk', () => new THREE.SphereGeometry(0.17, 20, 12).scale(1, 0.5, 1)), m('#ffb703', { roughness: 0.25 })); y.position.set(0.05, 0.02, 0.04); g.add(y);
    return g; } },
  cucumber: { th: 0.1, make() {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const o = new THREE.Mesh(geo('cuc', () => new THREE.CylinderGeometry(0.2, 0.2, 0.09, 20)), m('#2d6a4f')); o.position.set(x, 0, z);
      const i = new THREE.Mesh(geo('cuci', () => new THREE.CylinderGeometry(0.16, 0.16, 0.1, 20)), m('#c7f0a6')); i.position.set(x, 0, z); g.add(o, i);
    }
    return g; } },
  salami: { th: 0.09, make() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo('sal', () => new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32)), m('#c1121f')));
    const r = rng(7);
    for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(geo('fat', () => new THREE.CylinderGeometry(0.045, 0.045, 0.09, 8)), m('#ffe5ec')); d.position.set((r() - 0.5) * 0.55, 0, (r() - 0.5) * 0.55); g.add(d); }
    return g; } },
  onion: { th: 0.1, make() {
    const g = new THREE.Group();
    for (const [rr, c] of [[0.33, '#9d4edd'], [0.2, '#c77dff']]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.05, 8, 32), m(c)); t.rotation.x = Math.PI / 2; g.add(t); }
    return g; } },
};
const FILL = ['lettuce', 'tomato', 'cheese', 'ham', 'egg', 'cucumber', 'salami', 'onion'];
function makeLayer(kind) {
  const obj = KINDS[kind].make(); obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { kind, obj, th: KINDS[kind].th };
}

// ---------------------------------------------------------------- board
const board = new THREE.Group(); scene.add(board);
const plate = new THREE.Group(); scene.add(plate);
{
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.95, 0.1, 48), m('#ffffff', { roughness: 0.25 })); p1.receiveShadow = true;
  const p2 = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.06, 10, 48), m('#cdeffd', { roughness: 0.25 })); p2.rotation.x = Math.PI / 2; p2.position.y = 0.05;
  plate.add(p1, p2); plate.visible = false;
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.12 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; ground.receiveShadow = true; scene.add(ground);
function rbox(w, h, d, r) { const s = new THREE.Shape(), x = -w / 2, y = -d / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return extrudeShape(s, h, 0.04); }

// ---------------------------------------------------------------- level generation: unfold a finished stack
function genLevel(lv, seed) {
  const r = rng(seed), fk = F.k();
  const N = lv === 1 ? 3 : lv === 2 ? 4 : lv === 3 ? 5 : clamp(Math.round((4.2 + lv * 0.3) * fk), 4, 12);
  const gw = N <= 4 ? 3 : 4, gh = N <= 5 ? 3 : N <= 8 ? 4 : 5;
  for (let tries = 0; tries < 200; tries++) {
    const fills = []; for (let i = 0; i < N - 2; i++) fills.push(FILL[Math.floor(r() * Math.min(FILL.length, 3 + lv))]);
    const full = ['bread', ...fills, 'bread'];
    const grid = new Map(), k = (x, z) => x + ',' + z;
    const sx = Math.floor(r() * gw), sz = Math.floor(r() * gh); grid.set(k(sx, sz), full.slice());
    const moves = []; let ok = true;
    while ([...grid.values()].some(s => s.length > 1)) {
      const opts = [];
      for (const [key, s] of grid) {
        if (s.length < 2) continue; const [x, z] = key.split(',').map(Number);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= gw || nz >= gh || grid.has(k(nx, nz))) continue; opts.push([x, z, nx, nz]); }
      }
      if (!opts.length) { ok = false; break; }
      const [x, z, nx, nz] = opts[Math.floor(r() * opts.length)];
      const s = grid.get(k(x, z)), cnt = 1 + Math.floor(r() * (s.length - 1));
      const top = s.splice(s.length - cnt, cnt).reverse(); grid.set(k(nx, nz), top);
      moves.push([nx, nz, x, z]);                // the player's move that undoes this: flip (nx,nz) onto (x,z)
    }
    if (!ok) continue;
    // crop the board to the cells actually used
    const cells = [...grid.entries()].map(([key, s]) => [...key.split(',').map(Number), s[0]]);
    const mx = Math.min(...cells.map(c => c[0])), mz = Math.min(...cells.map(c => c[1]));
    const cw = Math.max(...cells.map(c => c[0])) - mx + 1, ch = Math.max(...cells.map(c => c[1])) - mz + 1;
    if (lv > 1 && cw * ch === N) { if (tries < 150) continue; }          // avoid a plain solid row/block when possible
    cells.forEach(c => { c[0] -= mx; c[1] -= mz; });
    return { gw: cw, gh: ch, cells, plan: moves.reverse().map(([a, b, c, d]) => [a - mx, b - mz, c - mx, d - mz]), N };
  }
  return null;
}

// ---------------------------------------------------------------- state
let state = 'ready', stacks = new Map(), gw = 3, gh = 3, N = 3, plan = [], anim = null, recorded = false, pal, beatenShown = false, sessionLv = 0;
let serveT = 0, serveFrom = [0, 0], moves = 0, wob = null, firstHint = false;
const kk = (x, z) => x + ',' + z;
const wx = (x) => (x - (gw - 1) / 2) * CELL, wz = (z) => (z - (gh - 1) / 2) * CELL;
const hand = document.createElement('div'); hand.className = 'lf-hand hc-hidden'; hand.textContent = '👆'; document.body.appendChild(hand);

function clearBoard() { for (const s of stacks.values()) scene.remove(s.group); stacks.clear(); while (board.children.length) board.remove(board.children[0]); }
function build() {
  clearBoard(); anim = null; plate.visible = false; serveT = 0; moves = 0;
  pal = palette(level); applyPalette(pal);
  const seed = D.seed ? D.seed + sessionLv : level * 6007 + 3;
  const L = genLevel(D.seed ? 6 + sessionLv : level, seed);
  gw = L.gw; gh = L.gh; N = L.N; plan = L.plan.slice();
  // chopping board + cell pads
  const bw = gw * CELL + 0.45, bd = gh * CELL + 0.45;
  const wood = new THREE.Mesh(rbox(bw, 0.2, bd, 0.28), m('#e0a96d', { roughness: 0.7 })); wood.position.y = 0; wood.receiveShadow = true; wood.castShadow = true; board.add(wood);
  const rim = new THREE.Mesh(rbox(bw + 0.12, 0.14, bd + 0.12, 0.32), m('#b97a45', { roughness: 0.7 })); rim.position.y = -0.04; board.add(rim);
  for (const [x, z] of L.cells) {
    const pad = new THREE.Mesh(geo('pad', () => rbox(0.94, 0.02, 0.94, 0.14)), m('#eab67d', { roughness: 0.8 })); pad.position.set(wx(x), 0.105, wz(z)); pad.receiveShadow = true; board.add(pad);
  }
  for (const [x, z, kind] of L.cells) {
    const s = { x, z, group: new THREE.Group(), layers: [], sq: 0, lift: 0, pop: 0 };
    s.group.position.set(wx(x), BASE, wz(z)); s.group.userData.stack = s; scene.add(s.group);
    const l = makeLayer(kind); s.group.add(l.obj); s.layers.push(l); layout(s);
    s.pop = -0.4 - Math.random() * 0.4; stacks.set(kk(x, z), s);
  }
  recorded = false; beatenShown = false; firstHint = level <= 2 && !D.seed;
  const span = Math.max(gw * 1.55, gh * 1.05); camera.userData.d = 5 + span * 1.75;
  ui.levels(level); ui.progress(0); ui.score(score); ui.sub('');
}
function height(s) { return s.layers.reduce((a, l) => a + l.th, 0); }
function layout(s) {
  let y = 0;
  for (const l of s.layers) {
    l.obj.position.set(0, y + l.th / 2, 0); y += l.th;
    const e = l.obj.rotation; e.set(Math.round(e.x / (Math.PI / 2)) * Math.PI / 2, Math.round(e.y / (Math.PI / 2)) * Math.PI / 2, Math.round(e.z / (Math.PI / 2)) * Math.PI / 2);
  }
}

// ---------------------------------------------------------------- moves
function canFlip(s, dx, dz) { return stacks.has(kk(s.x + dx, s.z + dz)); }
function flip(s, dx, dz) {
  if (state !== 'play' || anim) return false;
  const t = stacks.get(kk(s.x + dx, s.z + dz));
  if (!t) { s.wob = 1; s.wdx = dx; s.wdz = dz; tone(190, 0.08, 'sine', 0.08, 0.8); buzz(8); return false; }
  const hA = height(s), hB = height(t);
  const pivot = new THREE.Group(); pivot.position.set((wx(s.x) + wx(t.x)) / 2, BASE + (hA + hB) / 2, (wz(s.z) + wz(t.z)) / 2); scene.add(pivot); pivot.updateMatrixWorld();
  s.group.updateMatrixWorld(); for (const l of s.layers) pivot.attach(l.obj);
  anim = { s, t, pivot, k: 0, dx, dz, y0: pivot.position.y };
  if (plan && plan.length && plan[0][0] === s.x && plan[0][1] === s.z && plan[0][2] === t.x && plan[0][3] === t.z) plan.shift(); else plan = null;
  firstHint = false; moves++;
  tone(420 + s.layers.length * 30, 0.1, 'triangle', 0.1, 1.6); buzz(8);
  return true;
}
function land() {
  const { s, t, pivot } = anim; anim = null;
  for (const l of s.layers.slice().reverse()) { t.group.attach(l.obj); t.layers.push(l); }
  layout(t); scene.remove(pivot); scene.remove(s.group); stacks.delete(kk(s.x, s.z));
  t.sq = 1;
  const top = new THREE.Vector3(wx(t.x), BASE + height(t), wz(t.z));
  burst(scene, top, ['#f6d79c', '#ffffff', '#c27a3a'], 7, { speed: 0.05, up: 0.06, size: 0.4, gravity: 0.006 });
  note(60 + Math.min(24, t.layers.length * 2), 0.25, 0.16); buzz(12);
  ui.progress((N - stacks.size) / (N - 1));
  check();
}
function adjacentPairs() { for (const s of stacks.values()) for (const [dx, dz] of [[1, 0], [0, 1]]) if (stacks.has(kk(s.x + dx, s.z + dz))) return true; return false; }
function check() {
  if (stacks.size === 1) {
    const s = [...stacks.values()][0], L = s.layers;
    if (L[0].kind === 'bread' && L[L.length - 1].kind === 'bread') return win(s);
    return lose('SOGGY!', 'Bread goes on the bottom and on top');
  }
  if (!adjacentPairs()) return lose('STUCK!', 'No stacks left touching');
  const pops = ['Nom!', 'Yum!', 'Tasty!', 'Crunch!'];
  if (moves >= 2 && Math.random() < 0.4) ui.pop(pops[Math.floor(Math.random() * pops.length)], '#fff', 32, 24);
}
function win(s) {
  if (state !== 'play') return; state = 'won';
  if (!recorded) { recorded = true; F.level(true); B.submit(1); }
  score += N; ui.score(score);
  if (!beatenShown && D.beaten(score)) { beatenShown = true; confetti(scene, new THREE.Vector3(0, 2, 0), 40); setTimeout(() => ui.pop('BEATEN!', '#fff', 40, 30), 500); }
  serveT = 0.001; serveFrom = [wx(s.x), wz(s.z)]; plate.visible = true; plate.position.set(wx(s.x), BASE + 0.02, wz(s.z)); plate.scale.setScalar(0.01); s.group.position.y = BASE + 0.08;
  sfx.win(); buzz([20, 30, 20]); ui.flash(0.35);
  confetti(scene, new THREE.Vector3(wx(s.x), 1.5, wz(s.z)), 70);
  ui.pop(['YUM!', 'DELICIOUS!', 'CHEF\'S KISS!', 'NOM NOM!'][level % 4], '#fff', 46, 24);
  const lv = level; level++; sessionLv++; S.set('level', level); S.set('score', score);
  D.won(score); ui.win(lv, `${N}-layer stack served`);
}
function lose(t, line) {
  if (state !== 'play') return; state = 'lost';
  if (!recorded) { recorded = true; F.level(false, (N - stacks.size) / (N - 1)); }
  sfx.fail(); buzz([30, 40, 60]); ui.lose(t, line);
}

// ---------------------------------------------------------------- solver (bot + fallback when the player leaves the plan)
function solveFrom() {
  const st = {}; for (const [k, s] of stacks) st[k] = s.layers.map(l => l.kind[0] + l.kind[1]);
  const dead = new Set(); let steps = 0;
  const rec = (g) => {
    const keys = Object.keys(g); if (++steps > 40000) return null;
    if (keys.length === 1) { const L = g[keys[0]]; return L[0] === 'br' && L[L.length - 1] === 'br' ? [] : null; }
    const sig = keys.sort().map(k => k + ':' + g[k].join('')).join('|'); if (dead.has(sig)) return null;
    for (const k of keys) {
      const [x, z] = k.split(',').map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = kk(x + dx, z + dz); if (!g[t]) continue;
        const n = { ...g }; n[t] = g[t].concat(g[k].slice().reverse()); delete n[k];
        const r = rec(n); if (r) return [[x, z, x + dx, z + dz], ...r];
      }
    }
    dead.add(sig); return null;
  };
  return rec(st) || [];
}

// ---------------------------------------------------------------- input: pick the stack under the finger, swipe direction = flip direction
const ray = new THREE.Raycaster(), gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE), hitP = new THREE.Vector3();
let picked = null, sel = null;
function stackAt(cx, cy) {
  ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const objs = [...stacks.values()].map(s => s.group);
  for (const h of ray.intersectObjects(objs, true)) { let o = h.object; while (o && !o.userData.stack) o = o.parent; if (o) return o.userData.stack; }
  if (ray.ray.intersectPlane(gplane, hitP)) { const x = Math.round(hitP.x / CELL + (gw - 1) / 2), z = Math.round(hitP.z / CELL + (gh - 1) / 2); return stacks.get(kk(x, z)) || null; }
  return null;
}
input({
  onDown: (e) => { if (state !== 'play') return; picked = stackAt(e.clientX, e.clientY); if (picked) { picked.lift = 1; tone(600, 0.03, 'sine', 0.05, 1.1); } },
  onSwipe: (dir) => {
    if (state !== 'play' || !picked) return;
    const [dx, dz] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir]; if (sel) sel.lift = 0; sel = null; flip(picked, dx, dz); picked = null;
  },
  onTap: (e) => {   // tap a stack to lift it, tap a neighbour to flip it on; tap it again to put it down
    if (state !== 'play' || anim) return; if (sel && stacks.get(kk(sel.x, sel.z)) !== sel) sel = null;
    const s = stackAt(e.clientX, e.clientY), a = sel; if (a) a.lift = 0; sel = null;
    if (!s || s === a) return;
    if (a && Math.abs(s.x - a.x) + Math.abs(s.z - a.z) === 1) { flip(a, s.x - a.x, s.z - a.z); return; }
    sel = s; s.lift = 1; tone(760, 0.05, 'sine', 0.07, 1.2);
  },
  onUp: () => { if (picked && picked !== sel) picked.lift = 0; picked = null; },
});
ui.onTap((w) => { B.start(); if (w !== 'start') build(); state = 'play'; ui.hideStart(); });

// ---------------------------------------------------------------- loop
const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
let camA = 0;
loop((dt, t) => {
  const s = dt / 60;
  if (anim) {
    anim.k = Math.min(1, anim.k + s * 2.9); const e = ease(anim.k);
    if (anim.dx) anim.pivot.rotation.z = -Math.PI * e * anim.dx; else anim.pivot.rotation.x = Math.PI * e * anim.dz;
    anim.pivot.position.y = anim.y0 + Math.sin(e * Math.PI) * 0.35;
    if (anim.k >= 1) land();
  }
  for (const st of stacks.values()) {
    st.sq = Math.max(0, st.sq - s * 4); st.pop = Math.min(1, st.pop + s * 3.5);
    const ps = st.pop < 0 ? 0 : 1 + Math.sin(Math.min(1, st.pop) * Math.PI) * 0.15;
    const lift = st.lift ? (st === sel ? 0.35 : 0.08) : 0;
    st.group.position.y = lerp(st.group.position.y, BASE + lift + (state === 'won' ? 0.08 : 0), 0.3);
    st.group.scale.set(ps * (1 + st.sq * 0.12), ps * (1 - st.sq * 0.22), ps * (1 + st.sq * 0.12));
    if (st.wob) { st.wob = Math.max(0, st.wob - s * 4); const w = Math.sin(st.wob * 18) * st.wob * 0.08; st.group.position.x = wx(st.x) + w * st.wdx; st.group.position.z = wz(st.z) + w * st.wdz; }
  }
  // serve: plate grows under the finished stack, the stack spins
  if (serveT > 0) {
    serveT += s; plate.scale.setScalar(Math.min(1, serveT * 4) * (1 + Math.sin(Math.min(1, serveT * 4) * Math.PI) * 0.1));
    const k = ease(Math.min(1, serveT * 1.4)), x = lerp(serveFrom[0], 0, k), z = lerp(serveFrom[1], 1.1, k);
    plate.position.x = x; plate.position.z = z; board.position.y = -k * 6; board.scale.setScalar(Math.max(0.001, 1 - k));
    for (const st of stacks.values()) { st.group.rotation.y = ease(Math.min(1, serveT * 0.9)) * Math.PI * 2; st.group.position.x = x; st.group.position.z = z; st.group.scale.multiplyScalar(1 + k * 0.15); }
  }
  if (serveT === 0 && board.position.y !== 0) { board.position.y = 0; board.scale.setScalar(1); }
  // tutorial hand on the first levels: glide from the planned stack to its target
  if (firstHint && state === 'play' && plan && plan.length && !anim) {
    const [x, z, tx, tz] = plan[0], k = (t * 0.7) % 1, e = ease(Math.min(1, k * 1.4));
    const a = new THREE.Vector3(wx(x), BASE + 0.3, wz(z)).project(camera), b = new THREE.Vector3(wx(tx), BASE + 0.3, wz(tz)).project(camera);
    hand.style.left = (lerp(a.x, b.x, e) + 1) / 2 * innerWidth + 'px'; hand.style.top = (1 - lerp(a.y, b.y, e)) / 2 * innerHeight + 'px';
    hand.style.opacity = k > 0.85 ? 0 : 1; hand.classList.remove('hc-hidden');
  } else hand.classList.add('hc-hidden');
  // camera: high three-quarter view, gentle sway
  camA += s; const d = (camera.userData.d || 10) * (serveT > 0 ? 1 - 0.12 * ease(Math.min(1, serveT * 1.4)) : 1);
  camera.position.set(Math.sin(camA * 0.4) * 0.25, d * 0.8, d * 0.74);
  camera.lookAt(0, 0.1, 0.25);
});

build(); ui.start();

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  get dbg() { return { tiles: [...stacks.values()].map(s => { const v = new THREE.Vector3(wx(s.x), BASE + 0.1, wz(s.z)).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }) }; },
  bot() {   // follow the unfold plan; if the board left it, search for a winning sequence
    if (state !== 'play' || anim) return;
    if (!plan) plan = solveFrom();
    const mv = plan && plan[0]; if (!mv) return;
    const s = stacks.get(kk(mv[0], mv[1])); if (!s) { plan = null; return; }
    flip(s, mv[2] - mv[0], mv[3] - mv[1]);
  },
};

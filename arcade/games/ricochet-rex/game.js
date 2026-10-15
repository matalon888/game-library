// Ricochet Rex — original game. Drag to aim the agent's pistol, release to fire. Bullets ricochet off walls,
// pass through goons, blow up TNT, cut ropes and shove crates. Clear the room with 3 bullets; never hit a hostage.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, rounded, burst, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';

// ------------------------------------------------------------------ stage: orthographic side view
const stage = createStage({ shadows: true, shadowSize: 15 });
const { scene, renderer, sun } = stage;
stage.autoRender = false;
sun.position.set(2.6, 15.5, 10); sun.target.position.set(0, 11, 0); sun.intensity = 1.5; sun.shadow.camera.updateProjectionMatrix();
stage.hemi.intensity = 1.35;
const cam = new THREE.OrthographicCamera(-5, 5, 10, -10, 0.1, 100);
const VW = 10.8, VH = 23.4;
let viewW = VW, viewH = VH, camBaseY = VH / 2;
function fit() {
  const a = innerWidth / innerHeight; viewW = VW; viewH = VW / a;
  if (viewH < VH) { viewH = VH; viewW = VH * a; }
  cam.left = -viewW / 2; cam.right = viewW / 2; cam.top = viewH / 2; cam.bottom = -viewH / 2; cam.updateProjectionMatrix();
  camBaseY = VH - viewH / 2;
}
addEventListener('resize', fit); fit();
cam.position.set(0, camBaseY, 20);

const ui = createUI({ title: 'RICOCHET<br>REX', hint: 'Drag to aim · release to fire', hand: '☝️' });
const css = document.createElement('style');
css.textContent = `.hc-score{font-size:40px;top:calc(52px + env(safe-area-inset-top))}
.hc-card{padding-top:calc(200px + env(safe-area-inset-top))}
.hc-card h1{letter-spacing:1px;text-shadow:0 6px 0 rgba(0,0,0,.28)}
.hc-card.dim{background:rgba(0,0,0,.32)}
.hc-pop{text-shadow:0 3px 0 rgba(0,0,0,.5),0 0 3px rgba(0,0,0,.6),0 0 16px rgba(0,0,0,.35)!important;letter-spacing:1px}
.rr-ammo{position:fixed;top:calc(100px + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;gap:9px;z-index:5;pointer-events:none}
.rr-ammo i{display:block;width:13px;height:34px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#ffe58a 0,#f2b21f 42%,#2b2d36 43%,#2b2d36 50%,#c98a12 51%,#a86e0b 100%);box-shadow:0 3px 0 rgba(0,0,0,.25);transition:opacity .2s,transform .2s}
.rr-ammo i.spent{opacity:.22;transform:scale(.85)}
.rr-ammo i.pulse{animation:rrp .35s ease-out}
@keyframes rrp{0%{transform:scale(1.5)}100%{transform:scale(.85)}}`;
document.head.appendChild(css);
const ammoEl = Object.assign(document.createElement('div'), { className: 'rr-ammo' });
document.body.appendChild(ammoEl);

const save = store('ricochetrex');
const F = flow('ricochetrex');
const WB = worldBoard({ game: 'ricochet-rex', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });
let fkL = 1;
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), score = 0, state = 'ready';

// ------------------------------------------------------------------ themes
const THEMES = [
  { name: 'forest', bg: ['#5a9a63', '#2c5a38'], fill: '#7a5232', rim: '#8fd14f', ui: '#ff8a1f', foe: 'lumber' },
  { name: 'desert', bg: ['#ffd98a', '#ffa95c'], fill: '#e3ad5e', rim: '#fbe2a6', ui: '#e0503a', foe: 'cowboy' },
  { name: 'dojo', bg: ['#ffb36b', '#ffe3a0'], fill: '#2f8f84', rim: '#1c5852', ui: '#e8453c', foe: 'ninja' },
  { name: 'city', bg: ['#3b3f8f', '#8a63c9'], fill: '#4a4f72', rim: '#a9b2e8', ui: '#ffb020', foe: 'robber' },
];
let theme = THEMES[0];

// ------------------------------------------------------------------ shared geometry/materials
const MC = {};
const M = (c) => MC[c] || (MC[c] = mat(c, { roughness: 0.65 }));
const PG = {
  torso: new THREE.CapsuleGeometry(0.27, 0.34, 6, 14), head: new THREE.SphereGeometry(0.27, 20, 14),
  arm: new THREE.CapsuleGeometry(0.085, 0.4, 4, 8), leg: new THREE.CapsuleGeometry(0.1, 0.44, 4, 8),
  eye: new THREE.SphereGeometry(0.048, 8, 6), brow: new THREE.BoxGeometry(0.14, 0.04, 0.03),
  cap: new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), brim: new THREE.CylinderGeometry(0.44, 0.44, 0.05, 20),
  crown: new THREE.CylinderGeometry(0.2, 0.25, 0.3, 16), visor: new THREE.BoxGeometry(0.34, 0.04, 0.22),
  band: new THREE.BoxGeometry(0.58, 0.13, 0.12), belt: new THREE.BoxGeometry(0.58, 0.09, 0.58), stripe: new THREE.BoxGeometry(0.58, 0.08, 0.58),
  shirt: new THREE.BoxGeometry(0.17, 0.36, 0.05), tie: new THREE.BoxGeometry(0.07, 0.3, 0.05), gun: new THREE.BoxGeometry(0.12, 0.36, 0.13), grip: new THREE.BoxGeometry(0.1, 0.12, 0.2),
  rope: new THREE.TorusGeometry(0.29, 0.04, 6, 18), bun: new THREE.SphereGeometry(0.13, 10, 8), mouth: new THREE.SphereGeometry(0.05, 8, 6),
};
const SKIN = '#ffcfa8';
const STYLES = {
  agent: { body: '#2f55b5', legs: '#22397a', hair: '#1d1d24' },
  lumber: { body: '#d8423a', legs: '#3c5da6', cap: '#2f6fd1', brows: true },
  cowboy: { body: '#d07a32', legs: '#6b5440', hat: '#8b5a2b', scarf: '#e0403a', brows: true },
  ninja: { body: '#26272f', legs: '#26272f', skin: '#26272f', mask: true, belt: '#e0403a' },
  robber: { body: '#2b2b33', legs: '#3a3a46', stripes: '#f2f2f2', beanie: '#2b2b33', bandit: true, brows: false },
  hostage: { body: '#f4f4f4', legs: '#8a8f9c', hair: '#6b3a1f', tied: true },
};
function person(style, parent) {
  const S = STYLES[style];
  const g = new THREE.Group(), piv = new THREE.Group(), root = new THREE.Group();
  piv.position.y = 0.95; root.position.y = -0.95; piv.add(root); g.add(piv);
  const add = (geo, c, x, y, z = 0, par = root) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); root.add(p); return p; };
  const legL = pivot(-0.13, 0.74), legR = pivot(0.13, 0.74), armL = pivot(-0.35, 1.34), armR = pivot(0.35, 1.34);
  add(PG.leg, S.legs, 0, -0.37, 0, legL); add(PG.leg, S.legs, 0, -0.37, 0, legR);
  add(PG.torso, S.body, 0, 1.08);
  add(PG.arm, S.body, 0, -0.26, 0, armL); add(PG.arm, S.body, 0, -0.26, 0, armR);
  const head = add(PG.head, S.skin || SKIN, 0, 1.7);
  if (S.mask) add(PG.band, SKIN, 0, 1.73, 0.19).scale.set(0.82, 1, 1);
  if (S.bandit) add(PG.band, '#17171c', 0, 1.74, 0.2).scale.set(0.85, 1, 1);
  const ez = S.mask || S.bandit ? 0.27 : 0.245, ec = S.bandit ? '#ffffff' : '#1d1d24';
  add(PG.eye, ec, -0.09, 1.74, ez); add(PG.eye, ec, 0.09, 1.74, ez);
  if (S.brows) { const b1 = add(PG.brow, '#2a1a12', -0.1, 1.83, 0.24), b2 = add(PG.brow, '#2a1a12', 0.1, 1.83, 0.24); b1.rotation.z = -0.35; b2.rotation.z = 0.35; }
  if (S.hair) { const h = add(PG.cap, S.hair, 0, 1.73); h.scale.set(1, 0.95, 1); h.rotation.x = -0.25; }
  if (S.cap) { add(PG.cap, S.cap, 0, 1.76); add(PG.visor, S.cap, 0, 1.79, 0.26); }
  if (S.beanie) { const h = add(PG.cap, S.beanie, 0, 1.78); h.scale.set(1.02, 1.1, 1.02); }
  if (S.hat) { add(PG.brim, S.hat, 0, 1.9); add(PG.crown, S.hat, 0, 2.05); }
  if (S.scarf) add(PG.band, S.scarf, 0, 1.47, 0.12).scale.set(0.8, 1, 1.6);
  if (S.belt) add(PG.belt, S.belt, 0, 0.9);
  if (S.stripes) { add(PG.stripe, S.stripes, 0, 0.92); add(PG.stripe, S.stripes, 0, 1.14); add(PG.stripe, S.stripes, 0, 1.36).scale.set(0.9, 1, 0.9); }
  if (S.tied) { const r1 = add(PG.rope, '#b07a3c', 0, 1.0); r1.rotation.x = Math.PI / 2; const r2 = add(PG.rope, '#b07a3c', 0, 1.22); r2.rotation.x = Math.PI / 2; add(PG.bun, S.hair, 0, 1.98, -0.08); add(PG.mouth, '#5a2a22', 0, 1.6, 0.25); }
  let gun = null;
  if (style === 'agent') {
    add(PG.shirt, '#ffffff', 0, 1.3, 0.25); add(PG.tie, '#e23b3b', 0, 1.25, 0.28);
    gun = new THREE.Group(); gun.position.y = -0.6; armR.add(gun);
    add(PG.gun, '#2a2d36', 0, -0.06, 0, gun); add(PG.grip, '#2a2d36', 0, 0.06, -0.12, gun);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0 }));
    fl.position.y = -0.38; gun.add(fl); gun.flash = fl;
  }
  parent.add(g);
  return { g, piv, root, head, armL, armR, legL, legR, gun };
}

// ------------------------------------------------------------------ geometry for props
const PROPG = {
  crate: rounded(0.9, 0.9, 0.9, 0.06), plank: new THREE.BoxGeometry(1.05, 0.12, 0.05),
  weight: new THREE.CylinderGeometry(0.42, 0.6, 0.8, 4, 1), hook: new THREE.TorusGeometry(0.13, 0.04, 6, 14),
  tnt: rounded(0.8, 0.9, 0.8, 0.06), ropeLine: new THREE.CylinderGeometry(0.035, 0.035, 1, 6),
  puff: new THREE.SphereGeometry(1, 14, 10),
};
PROPG.ropeLine.translate(0, 0.5, 0);
const tntTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff4d6'; x.fillRect(0, 10, 128, 44); x.fillStyle = '#2a1a12'; x.font = 'bold 38px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TNT', 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const tntLabel = new THREE.MeshBasicMaterial({ map: tntTex, transparent: true });

// ------------------------------------------------------------------ world + 2D simulation
const IN = { x0: -4.6, x1: 4.6, y0: 3.0, y1: 18.6 };
const ER = { hw: 0.36, h: 1.95 };      // enemy/hostage hit box
const BOOM_R = 2.5;
let W = null, lvl = null, levelGroup = null;
let agent = null, aimA = 0.2, aiming = false, bullets = 3, bullet = null, trail = null, killed = 0, total = 0;
let timeScale = 1, slowT = 0, focus = null, shake = 0, loseT = 0, shotKills = 0, pending = [], puffs = [], tFade = 0;

function rayBox(px, py, dx, dy, x0, y0, x1, y1, inside = false) {
  let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0;
  if (Math.abs(dx) < 1e-9) { if (px < x0 || px > x1) return null; }
  else { let t1 = (x0 - px) / dx, t2 = (x1 - px) / dx, n = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; n = 1; } if (t1 > tmin) { tmin = t1; nx = n; ny = 0; } if (t2 < tmax) tmax = t2; }
  if (Math.abs(dy) < 1e-9) { if (py < y0 || py > y1) return null; }
  else { let t1 = (y0 - py) / dy, t2 = (y1 - py) / dy, n = -1; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; n = 1; } if (t1 > tmin) { tmin = t1; nx = 0; ny = n; } if (t2 < tmax) tmax = t2; }
  if (tmax < tmin || tmax < 0) return null;
  if (tmin < 1e-7) return inside ? { t: 0, nx, ny } : null;
  return { t: tmin, nx, ny };
}
/** trace a bullet through the world: returns polyline + ordered events (kill / cut / push / boom / hostage) */
function trace(w, ox, oy, a, maxB = 6, maxLen = 64) {
  let px = ox, py = oy, dx = Math.cos(a), dy = Math.sin(a), len = 0, b = 0;
  const pts = [[px, py]], ev = [], seen = new Set();
  for (;;) {
    let tS = maxLen - len, nx = 0, ny = 0, hitBody = null, stop = null;
    for (const s of w.statics) { const h = rayBox(px, py, dx, dy, s.x0, s.y0, s.x1, s.y1); if (h && h.t < tS) { tS = h.t; nx = h.nx; ny = h.ny; hitBody = null; } }
    for (const o of w.bodies) { const h = rayBox(px, py, dx, dy, o.x - o.w / 2, o.y - o.h / 2, o.x + o.w / 2, o.y + o.h / 2); if (h && h.t < tS) { tS = h.t; nx = h.nx; ny = h.ny; hitBody = o; } }
    for (const o of w.barrels) if (o.alive) { const h = rayBox(px, py, dx, dy, o.x - o.w / 2, o.y - o.h / 2, o.x + o.w / 2, o.y + o.h / 2); if (h && h.t < tS) { tS = h.t; stop = { type: 'boom', ref: o }; hitBody = null; } }
    for (const o of w.hostages) if (o.alive) { const h = rayBox(px, py, dx, dy, o.x - ER.hw, o.y, o.x + ER.hw, o.y + ER.h, true); if (h && h.t < tS) { tS = h.t; stop = { type: 'hostage', ref: o }; hitBody = null; } }
    if (stop && stop.type === 'boom') { /* barrel nearer than walls */ }
    for (const e of w.enemies) if (e.alive && !seen.has(e)) { const h = rayBox(px, py, dx, dy, e.x - ER.hw, e.y, e.x + ER.hw, e.y + ER.h, true); if (h && h.t <= tS) { seen.add(e); ev.push({ d: len + h.t, type: 'kill', ref: e, b }); } }
    if (Math.abs(dx) > 1e-6) for (const o of w.bodies) if (o.hanging && !seen.has(o)) {
      const t = (o.x - px) / dx; if (t > 0 && t < tS) { const y = py + dy * t; if (y > o.y + o.h / 2 && y < o.ropeTop) { seen.add(o); ev.push({ d: len + t, type: 'cut', ref: o, b }); } }
    }
    px += dx * tS; py += dy * tS; len += tS; pts.push([px, py]);
    if (stop) { ev.push({ d: len, type: stop.type, ref: stop.ref, b }); break; }
    if (len >= maxLen - 1e-6 || (nx === 0 && ny === 0)) break;
    if (hitBody) ev.push({ d: len, type: 'push', ref: hitBody, b, dx, dy });
    if (b >= maxB) break;
    if (nx) dx = -dx; else dy = -dy;
    px += nx * 1e-4; py += ny * 1e-4; b++;
  }
  ev.sort((p, q) => p.d - q.d);
  return { pts, ev, len, b };
}
function landY(w, o) {   // where a cut weight lands
  let y = -99;
  for (const s of w.statics) if (s.x1 > o.x - o.w / 2 && s.x0 < o.x + o.w / 2 && s.y1 <= o.y - o.h / 2 + 1e-3) y = Math.max(y, s.y1);
  return y;
}
/** what one shot would achieve (static assumption): enemy -> bounces, hostage flag */
function evalShot(w, ox, oy, a) {
  const T = trace(w, ox, oy, a), kills = new Map(); let hostage = false;
  const boom = (o, depth) => {
    for (const e of w.enemies) if (e.alive && Math.hypot(e.x - o.x, e.y + 1 - o.y) < BOOM_R && !kills.has(e)) kills.set(e, 9);
    for (const h of w.hostages) if (h.alive && Math.hypot(h.x - o.x, h.y + 1 - o.y) < BOOM_R) hostage = true;
    if (depth < 2) for (const o2 of w.barrels) if (o2 !== o && o2.alive && Math.hypot(o2.x - o.x, o2.y - o.y) < BOOM_R) boom(o2, depth + 1);
  };
  for (const e of T.ev) {
    if (e.type === 'kill' && !kills.has(e.ref)) kills.set(e.ref, e.b);
    else if (e.type === 'hostage') hostage = true;
    else if (e.type === 'boom') boom(e.ref, 0);
    else if (e.type === 'cut') {
      const ly = landY(w, e.ref);
      for (const en of w.enemies) if (en.alive && Math.abs(en.x - e.ref.x) < e.ref.w / 2 + ER.hw && en.y < e.ref.y && en.y > ly - 0.05 && !kills.has(en)) kills.set(en, 9);
      for (const h of w.hostages) if (h.alive && Math.abs(h.x - e.ref.x) < e.ref.w / 2 + ER.hw && h.y < e.ref.y && h.y > ly - 0.05) hostage = true;
    }
  }
  return { kills, hostage };
}
const shoulder = (w, a) => ({ x: w.agent.x + (Math.cos(a) >= 0 ? 0.35 : -0.35), y: w.agent.y + 1.34 });
/** sample every angle; robust kill set = what the angle and both neighbours agree on (no pixel-perfect solutions) */
function sweep(w, N) {
  const raw = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, s = shoulder(w, a); raw.push(evalShot(w, s.x, s.y, a)); }
  const out = [];
  for (let i = 0; i < N; i++) {
    const p = raw[(i + N - 1) % N], c = raw[i], n = raw[(i + 1) % N];
    const ks = new Map(); for (const [e, b] of c.kills) if (p.kills.has(e) && n.kills.has(e)) ks.set(e, b);
    out.push({ a: (i / N) * Math.PI * 2, kills: ks, hostage: c.hostage || p.hostage || n.hostage });
  }
  return out;
}
function greedy(w, sw, shots) {
  const alive = new Set(w.enemies.filter(e => e.alive)); const plan = [];
  for (let k = 0; k < shots && alive.size; k++) {
    let best = null, bc = 0;
    for (const s of sw) { if (s.hostage) continue; let c = 0; for (const e of s.kills.keys()) if (alive.has(e)) c++; if (c > bc) { bc = c; best = s; } }
    if (!best) break; plan.push(best); for (const e of best.kills.keys()) alive.delete(e);
  }
  return { plan, left: alive.size };
}

// ------------------------------------------------------------------ procedural level layouts (seeded, validated)
function layout(lv, n, r) {
  const S = [], surf = [], ents = [];
  const blk = (x0, y0, x1, y1, top = true) => { S.push({ x0, y0, x1, y1 }); if (top) surf.push({ x0: Math.max(x0, IN.x0), x1: Math.min(x1, IN.x1), y: y1 }); };
  S.push({ x0: -40, y0: -30, x1: 40, y1: IN.y0, floor: true }, { x0: -5.4, y0: IN.y1, x1: 5.4, y1: 19.5 }, { x0: -5.4, y0: IN.y0, x1: IN.x0, y1: IN.y1 }, { x0: IN.x1, y0: IN.y0, x1: 5.4, y1: IN.y1 });
  surf.push({ x0: IN.x0, x1: IN.x1, y: IN.y0 });
  const tpl = lv === 1 ? 0 : lv === 2 ? 1 : Math.floor(r() * 4);
  let ag;
  if (tpl === 0) {         // open room: ledges on the right, maybe a floor block and an upper-left ledge
    ag = { x: -3.5, y: IN.y0 };
    const y = 6.6 + r() * 1.6; blk(0.8 + r() * 1.2, y - 0.6, IN.x1, y);
    if (lv > 1) { const y2 = 11 + r() * 3; blk(IN.x0, y2 - 0.6, -1.4 - r(), y2); }
    if (lv > 1 && r() < 0.6) { const d = r() * 1.2 - 0.6; blk(-0.6 + d, IN.y0, 0.6 + d, IN.y0 + 1.6 + r() * 1.6); }
    if (r() < 0.5) { const y3 = y + 4.4 + r() * 2.5; if (y3 < 17) blk(1.6 + r() * 1.2, y3 - 0.6, IN.x1, y3); }
  } else if (tpl === 1) {  // pillar in the middle: bank it off the ceiling
    ag = { x: -3.4, y: IN.y0 };
    const px = -0.5 + r() * 1.2, ph = 5 + r() * 4; blk(px - 0.35, IN.y0, px + 0.35, IN.y0 + ph);
    const y = 6.5 + r() * 2; blk(2.2 + r() * 0.8, y - 0.6, IN.x1, y);
    if (r() < 0.6) { const y2 = 12.5 + r() * 3; blk(IN.x0, y2 - 0.6, Math.min(-1.6, px - 1.2), y2); }
  } else if (tpl === 2) {  // shaft: agent bottom-centre, ledges on both walls, some with cover slabs
    ag = { x: r() - 0.5, y: IN.y0 };
    for (const [side, ys] of [[-1, [7 + r(), 12.4 + r()]], [1, [9.6 + r(), 15 + r() * 0.8]]]) for (const y of ys) {
      const inner = 1.6 + r() * 0.7;
      if (side < 0) { blk(IN.x0, y - 0.6, -inner, y); if (r() < 0.45) blk(-inner - 0.4, y, -inner, y + 1.3, false); }
      else { blk(inner, y - 0.6, IN.x1, y); if (r() < 0.45) blk(inner, y, inner + 0.4, y + 1.3, false); }
    }
  } else {                 // bunker: agent up on a ledge, goons behind a low wall on the floor
    const ay = IN.y0 + 3.2 + r() * 1.5; blk(IN.x0, ay - 0.6, -1.9, ay); ag = { x: -3.6, y: ay };
    const wx = 0.3 + r() * 0.8; blk(wx - 0.2, IN.y0, wx + 0.2, IN.y0 + 2.4 + r() * 1.2, false);
    const y = 10.5 + r() * 3; blk(1.6 + r(), y - 0.6, IN.x1, y);
    if (r() < 0.4) blk(wx - 0.2, IN.y0 + 5.2 + r(), wx + 1.6, IN.y0 + 5.7 + r() * 0.3 + 0.5, false);
  }
  ents.push({ x0: ag.x - 0.9, y0: ag.y, x1: ag.x + 0.9, y1: ag.y + 2.2 });
  const free = (x0, y0, x1, y1) => {
    if (x0 < IN.x0 + 0.05 || x1 > IN.x1 - 0.05 || y1 > IN.y1 - 0.05) return false;
    for (const s of S) if (x0 < s.x1 - 0.01 && x1 > s.x0 + 0.01 && y0 < s.y1 - 0.01 && y1 > s.y0 + 0.01) return false;
    for (const s of ents) if (x0 < s.x1 && x1 > s.x0 && y0 < s.y1 && y1 > s.y0) return false;
    return true;
  };
  const place = (wd, ht, filt = () => true) => {
    for (let t = 0; t < 50; t++) {
      const s = surf[Math.floor(r() * surf.length)]; if (!filt(s) || s.x1 - s.x0 < wd) continue;
      const x = s.x0 + wd / 2 + r() * (s.x1 - s.x0 - wd);
      if (Math.abs(s.y - ag.y) < 0.01 && Math.abs(x - ag.x) < 2.4) continue;
      if (free(x - wd / 2, s.y, x + wd / 2, s.y + ht)) { ents.push({ x0: x - wd / 2, y0: s.y, x1: x + wd / 2, y1: s.y + ht }); return { x, y: s.y }; }
    }
    return null;
  };
  const enemies = [], hostages = [], bodies = [], barrels = [];
  for (let i = 0; i < n; i++) { const p = place(1.0, 2.05); if (p) enemies.push(p); }
  if (enemies.length < Math.min(2, n)) return null;
  if (lv >= 3 && r() < Math.min(0.55, 0.4 * fkL)) { const p = place(0.85, 2.05); if (p) hostages.push(p); }
  if (lv >= 2 && r() < 0.55) {      // TNT beside a goon
    const e = enemies[Math.floor(r() * enemies.length)];
    for (const dx of r() < 0.5 ? [0.95, -0.95] : [-0.95, 0.95]) { const x = e.x + dx; if (free(x - 0.4, e.y, x + 0.4, e.y + 0.9)) { ents.push({ x0: x - 0.4, y0: e.y, x1: x + 0.4, y1: e.y + 0.9 }); barrels.push({ x, y: e.y + 0.45, w: 0.8, h: 0.9 }); break; } }
  }
  if (lv >= 2 && r() < 0.5) {       // weight on a rope over a goon
    const e = enemies[Math.floor(r() * enemies.length)], wy = e.y + 3.0 + r() * 1.6;
    if (wy + 1.2 < IN.y1 && free(e.x - 0.5, e.y + 2.06, e.x + 0.5, IN.y1 - 0.06)) { bodies.push({ kind: 'weight', x: e.x, y: wy, w: 1.0, h: 0.8, hanging: true, ropeTop: IN.y1 }); ents.push({ x0: e.x - 0.5, y0: e.y + 2, x1: e.x + 0.5, y1: IN.y1 }); }
  }
  const nc = lv >= 2 ? Math.floor(r() * 3) : 0;
  for (let i = 0; i < nc; i++) {
    const p = place(0.9, 0.9); if (!p) continue; bodies.push({ kind: 'crate', x: p.x, y: p.y + 0.45, w: 0.9, h: 0.9 });
    if (r() < 0.4 && free(p.x - 0.45, p.y + 0.9, p.x + 0.45, p.y + 1.8)) { ents.push({ x0: p.x - 0.45, y0: p.y + 0.9, x1: p.x + 0.45, y1: p.y + 1.8 }); bodies.push({ kind: 'crate', x: p.x, y: p.y + 1.35, w: 0.9, h: 0.9 }); }
  }
  return { statics: S, agent: ag, enemies, hostages, bodies, barrels, tpl, surf };
}
function simWorld(L) {
  return { statics: L.statics, agent: L.agent, enemies: L.enemies.map(e => ({ ...e, alive: true })), hostages: L.hostages.map(e => ({ ...e, alive: true })),
    bodies: L.bodies.map(b => ({ ...b })), barrels: L.barrels.map(b => ({ ...b, alive: true })) };
}
function genLevel(lv) {
  const n = Math.max(2, Math.min(7, Math.round((2 + Math.floor(lv / 3)) * fkL)));
  let fallback = null;
  for (let att = 0; att < 70; att++) {
    const r = rng(lv * 9973 + att * 131 + 7), L = layout(lv, n, r); if (!L) continue;
    const w = simWorld(L), sw = sweep(w, 720), g = greedy(w, sw, 3);
    if (g.left) continue;
    if (!fallback) fallback = L;
    if (att > 50) return L;
    // harder levels must need a ricochet or more than one bullet
    const direct = new Set(); for (const s of sw) if (!s.hostage) for (const [e, b] of s.kills) if (b === 0) direct.add(e);
    if (lv >= 3 && direct.size === w.enemies.length && g.plan.length < 2) continue;
    if (lv >= 6 && g.plan.length < 2) continue;
    return L;
  }
  return fallback || layout(1, 2, rng(1));
}

// ------------------------------------------------------------------ scenery per theme
function scenery(th, grp) {
  const r = rng(level * 31 + 5), dummy = new THREE.Object3D();
  const inst = (geo, material, list) => {
    const m = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((it, i) => { dummy.position.set(it[0], it[1], it[2]); dummy.scale.set(it[3], it[4], it[5] ?? it[3]); dummy.rotation.set(0, it[7] || 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (it[6]) m.setColorAt(i, new THREE.Color(it[6])); });
    grp.add(m); return m;
  };
  const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true });
  const disc = (c, x, y, rad, z = -12) => { const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 40), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); grp.add(m); };
  if (th.name === 'forest') {
    const cones = [], trunks = [];
    for (let i = 0; i < 16; i++) {
      const far = i < 8, x = -8 + (i % 8) * 2.3 + r() * 1.2, h = far ? 9 + r() * 6 : 6 + r() * 5, z = far ? -10 : -6, y0 = IN.y0 + (far ? 2 : 0);
      for (let k = 0; k < 3; k++) cones.push([x, y0 + h * (0.42 + k * 0.2), z - k * 0.01, h * (0.32 - k * 0.07), h * 0.36, h * (0.32 - k * 0.07), far ? '#2c6a3e' : (k % 2 ? '#3d8a4c' : '#357d45'), r() * 3]);
      trunks.push([x, y0 + 1.2, z + 0.3, 0.35, 2.4, 0.35, '#5a3a22']);
    }
    inst(new THREE.ConeGeometry(1, 1, 7), flat('#ffffff'), cones);
    inst(new THREE.CylinderGeometry(1, 1, 1, 6), flat('#ffffff'), trunks);
  } else if (th.name === 'desert') {
    disc('#fff1a8', 2.2, 15.4, 3.1); disc('#ffcf7a', 2.2, 15.4, 3.9, -12.5);
    const mesas = []; for (let i = 0; i < 6; i++) mesas.push([-7 + i * 2.8 + r(), IN.y0 + 1.2 + r() * 1.5, -9, 2.2 + r() * 1.6, 2.4 + r() * 3, 1, i % 2 ? '#e3864a' : '#d0703a']);
    inst(new THREE.BoxGeometry(1, 1, 1), flat('#ffffff'), mesas);
    const cac = []; for (const [x, h] of [[-2.6, 2.4], [2.9, 1.8], [0.4, 1.4]]) { cac.push([x, IN.y0 + h / 2, -6, 0.32, h / 1.6, 0.32, '#4caf50']); cac.push([x - 0.42, IN.y0 + h * 0.62, -6, 0.17, 0.42, 0.17, '#43a047']); cac.push([x + 0.42, IN.y0 + h * 0.5, -6, 0.17, 0.35, 0.17, '#43a047']); }
    inst(new THREE.CapsuleGeometry(1, 1.6, 4, 10), flat('#ffffff'), cac);
  } else if (th.name === 'dojo') {
    disc('#ff6a3d', 1.8, 14.8, 2.7);
    const mt = new THREE.Mesh(new THREE.ConeGeometry(6.5, 9, 6), flat('#6a7fc4')); mt.position.set(0.8, IN.y0 + 4.5, -10); grp.add(mt);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.05, 6), flat('#ffffff')); cap.position.set(0.8, IN.y0 + 7.48, -9.9); grp.add(cap);
    const pag = []; for (let k = 0; k < 4; k++) { pag.push([-3.2, IN.y0 + 1 + k * 2.2, -7, 2.4 - k * 0.35, 1.6, 1.4, '#e6dccb']); pag.push([-3.2, IN.y0 + 1.95 + k * 2.2, -6.9, 3.6 - k * 0.45, 0.32, 1.9, '#8b3a2e']); }
    inst(new THREE.BoxGeometry(1, 1, 1), flat('#ffffff'), pag);
  } else {
    disc('#fff3c4', -2.3, 15.6, 1.5);
    const bl = []; for (let i = 0; i < 9; i++) { const h = 4 + r() * 9; bl.push([-6 + i * 1.5 + r() * 0.4, IN.y0 + h / 2, -8 - (i % 2), 1.2 + r() * 0.6, h, 1, i % 2 ? '#5a4f9e' : '#4b4290']); }
    inst(new THREE.BoxGeometry(1, 1, 1), flat('#ffffff'), bl);
    const sg = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 70; i++) sp.push((r() - 0.5) * 12, 9 + r() * 10, -11);
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    grp.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.2 }));
  back.position.set(0, 10, -1.7); back.receiveShadow = true; grp.add(back);
}

// ------------------------------------------------------------------ build a level into the scene
const laserGeo = new THREE.BoxGeometry(1, 0.075, 0.04); laserGeo.translate(0.5, 0, 0);
const laser = new THREE.InstancedMesh(laserGeo, new THREE.MeshBasicMaterial({ color: '#d6fbff', transparent: true, opacity: 0.9, depthWrite: false }), 160);
laser.frustumCulled = false; laser.count = 0; laser.position.z = 0.8; scene.add(laser);
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 24), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, depthWrite: false }));
reticle.visible = false; scene.add(reticle);
const trailGeo = new THREE.BoxGeometry(1, 0.09, 0.04); trailGeo.translate(0.5, 0, 0);
const trailMesh = new THREE.InstancedMesh(trailGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }), 12);
trailMesh.frustumCulled = false; trailMesh.count = 0; trailMesh.position.z = 0.7; scene.add(trailMesh);
const bulletMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
bulletMesh.visible = false; scene.add(bulletMesh);

function buildLevel() {
  if (levelGroup) scene.remove(levelGroup);
  levelGroup = new THREE.Group(); scene.add(levelGroup);
  theme = THEMES[(level - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', theme.bg[0]); bs.setProperty('--bg2', theme.bg[1]); bs.setProperty('--ui', theme.ui); bs.background = theme.bg[1];
  scenery(theme, levelGroup);
  fkL = F.k(); lvl = genLevel(level);
  W = simWorld(lvl);
  for (const s of W.statics) {
    const x0 = Math.max(s.x0, -14), x1 = Math.min(s.x1, 14), y0 = Math.max(s.y0, -20), w = x1 - x0, h = s.y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + s.y1) / 2;
    const rim = new THREE.Mesh(rounded(w + 0.18, h + 0.18, 1.4, 0.1), M(theme.rim)); rim.position.set(cx, cy, -0.4); rim.receiveShadow = true;
    const fill = new THREE.Mesh(rounded(w - 0.02, h - 0.02, 1.5, 0.07), M(theme.fill)); fill.position.set(cx, cy, -0.3); fill.receiveShadow = true; fill.castShadow = !s.floor;
    levelGroup.add(rim, fill);
  }
  agent = person('agent', levelGroup); agent.g.position.set(W.agent.x, W.agent.y, 0);
  for (const e of W.enemies) { e.p = person(theme.foe, levelGroup); e.p.g.position.set(e.x, e.y, 0); e.ph = Math.random() * 6; }
  for (const e of W.hostages) { e.p = person('hostage', levelGroup); e.p.g.position.set(e.x, e.y, 0); e.ph = Math.random() * 6; e.hostage = true; }
  for (const o of W.bodies) {
    o.vx = 0; o.vy = 0; o.rot = 0; o.av = 0; o.ground = true;
    const g = new THREE.Group();
    if (o.kind === 'crate') {
      const c = new THREE.Mesh(PROPG.crate, M('#dc8c3c')); c.castShadow = true; g.add(c);
      for (const s of [1, -1]) { const p = new THREE.Mesh(PROPG.plank, M('#a8622a')); p.rotation.z = s * Math.PI / 4; p.position.z = 0.46; p.scale.x = s > 0 ? 1 : 0.98; g.add(p); }
    } else {
      const c = new THREE.Mesh(PROPG.weight, M('#3d4250')); c.rotation.y = Math.PI / 4; c.castShadow = true; g.add(c);
      const hk = new THREE.Mesh(PROPG.hook, M('#3d4250')); hk.position.y = 0.5; g.add(hk);
      o.rope = new THREE.Mesh(PROPG.ropeLine, M('#b07a3c')); o.rope.position.set(o.x, o.y + 0.6, 0); o.rope.scale.y = o.ropeTop - o.y - 0.6; levelGroup.add(o.rope);
    }
    g.position.set(o.x, o.y, 0); levelGroup.add(g); o.m = g;
  }
  for (const o of W.barrels) {
    const g = new THREE.Group(), c = new THREE.Mesh(PROPG.tnt, M('#e3392f')); c.castShadow = true; g.add(c);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.39), tntLabel); lab.position.z = 0.42; g.add(lab);
    g.position.set(o.x, o.y, 0); levelGroup.add(g); o.m = g;
  }
  total = W.enemies.length; killed = 0; bullets = 3; bullet = null; slowT = 0; timeScale = 1; focus = null; loseT = 0; pending = []; tFade = 0;
  for (const p of puffs) scene.remove(p.m); puffs = [];
  trailMesh.count = 0; bulletMesh.visible = false;
  const near = W.enemies.slice().sort((a, b) => Math.hypot(a.x - W.agent.x, a.y - W.agent.y) - Math.hypot(b.x - W.agent.x, b.y - W.agent.y))[0];
  aimA = near ? Math.atan2(near.y + 1 - W.agent.y - 1.34, near.x - W.agent.x) : 0.3;
  ui.levels(level); ui.progress(0); ui.score(score); ammo();
}
function ammo(pulse = -1) {
  ammoEl.innerHTML = [0, 1, 2].map(i => `<i class="${i >= bullets ? 'spent' : ''} ${i === pulse ? 'pulse' : ''}"></i>`).join('');
}

// ------------------------------------------------------------------ actions
function fire() {
  if (state !== 'play' || bullet || bullets <= 0 || slowT > 0) return;
  const s = shoulder(W, aimA), T = trace(W, s.x, s.y, aimA);
  const cum = [0]; for (let i = 1; i < T.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(T.pts[i][0] - T.pts[i - 1][0], T.pts[i][1] - T.pts[i - 1][1]));
  bullet = { ...T, cum, s: 0.55, ei: 0, vi: 1, speed: 26 };
  bullets--; ammo(bullets); shotKills = 0;
  agent.gun.flash.material.opacity = 1; agent.recoil = 1;
  tone(880, 0.05, 'square', 0.09, 0.3); tone(160, 0.14, 'sawtooth', 0.09, 0.4); buzz(18); shake = Math.max(shake, 0.12);
  bulletMesh.visible = true; tFade = 0; trailMesh.material.opacity = 0.9;
}
function posAt(B, s) {
  let i = 1; while (i < B.cum.length - 1 && B.cum[i] < s) i++;
  const a = B.pts[i - 1], b = B.pts[i], L = B.cum[i] - B.cum[i - 1] || 1, k = clamp((s - B.cum[i - 1]) / L, 0, 1);
  return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), dx: (b[0] - a[0]) / L, dy: (b[1] - a[1]) / L, i };
}
const V = (x, y, z = 0.4) => new THREE.Vector3(x, y, z);
function addScore(n) { score += n; ui.score(score); if (score > best) { best = score; save.set('best', best); } }
function killEnemy(e, dx, dy, cause, b = 0) {
  if (!e.alive) return;
  e.alive = false; e.rag = true; e.cx = e.x; e.cy = e.y + 0.95; e.rot = 0; e.flail = 1;
  const k = cause === 'boom' ? 9 : cause === 'crush' ? 1 : 6;
  e.vx = dx * k + (cause === 'crush' ? (Math.random() - 0.5) * 2 : 0); e.vy = cause === 'crush' ? -1 : 4.5 + Math.max(0, dy) * 3 + (cause === 'boom' ? 3 : 0);
  e.av = (dx >= 0 ? -1 : 1) * (5 + Math.random() * 6);
  killed++; shotKills++;
  burst(scene, V(e.x, e.y + 1.4, 0.6), ['#ffffff', '#ffd23f', '#fff4a8'], 14, { speed: 0.11, up: 0.06, size: 0.9, shape: 'sphere', gravity: 0.002 });
  tone(300 + shotKills * 80, 0.12, 'triangle', 0.13, 0.5); tone(90, 0.18, 'square', 0.08, 0.5); buzz([25, 20, 25]); shake = Math.max(shake, 0.25);
  addScore(100 * Math.max(1, shotKills));
  const multi = ['', '', 'DOUBLE HIT!', 'TRIPLE HIT!', 'QUAD HIT!', 'MEGA HIT!', 'MEGA HIT!'][Math.min(6, shotKills)];
  const word = multi || (cause === 'boom' ? 'BOOM!' : cause === 'crush' ? 'CRUSHED!' : b > 0 ? 'RICOCHET!' : ['BULLSEYE!', 'GOTCHA!', 'NICE SHOT!'][Math.floor(Math.random() * 3)]);
  ui.pop(word, multi ? '#ffd23f' : '#ffffff', 36 + Math.min(4, shotKills) * 3, 27);
  ui.progress(killed / total);
  if (killed >= total && state === 'play') { slowT = 1.05; focus = new THREE.Vector3(e.x, e.y + 1, 0); ui.flash(0.35); }
}
function hostageHit(h, dx) {
  if (!h.alive || state !== 'play') return;
  h.alive = false; h.rag = true; h.cx = h.x; h.cy = h.y + 0.95; h.rot = 0; h.flail = 1; h.vx = dx * 4; h.vy = 4; h.av = -dx * 6;
  lose('HOSTAGE HIT!', 'Never shoot the white shirts');
}
function cutRope(o) {
  if (!o.hanging) return;
  o.hanging = false; o.vy = -0.5; o.ground = false;
  if (o.rope) { levelGroup.remove(o.rope); o.rope = null; }
  burst(scene, V(o.x, o.y + 0.9, 0.5), '#c99a5a', 8, { speed: 0.06, size: 0.5 });
  tone(1400, 0.07, 'triangle', 0.08, 0.5); ui.pop('SNAP!', '#ffe9a8', 30, 33);
}
function explode(o) {
  if (!o.alive) return;
  o.alive = false; o.m.visible = false;
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(PROPG.puff, new THREE.MeshBasicMaterial({ color: ['#ff9a3c', '#ffc94a', '#ff7a2a', '#ffe08a'][i % 4], transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, d = Math.random() * 0.9;
    m.position.set(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d * 0.8 + 0.3, 0.9 + i * 0.01); m.scale.setScalar(0.1); scene.add(m);
    puffs.push({ m, t: -i * 0.025, s: 0.45 + Math.random() * 0.45 });
  }
  burst(scene, V(o.x, o.y, 0.8), ['#3a2a22', '#ff7a2a', '#ffd23f'], 18, { speed: 0.2, up: 0.12, size: 1 });
  sfx.smash(); tone(60, 0.4, 'sawtooth', 0.12, 0.5); buzz([50, 30, 60]); shake = Math.max(shake, 0.7); ui.flash(0.45);
  for (const e of W.enemies) { const dx = e.x - o.x, dy = e.y + 1 - o.y, d = Math.hypot(dx, dy); if (d < BOOM_R) killEnemy(e, dx / (d || 1), dy / (d || 1), 'boom'); }
  for (const h of W.hostages) if (h.alive && Math.hypot(h.x - o.x, h.y + 1 - o.y) < BOOM_R) hostageHit(h, Math.sign(h.x - o.x) || 1);
  for (const e of [...W.enemies, ...W.hostages]) if (e.rag) { const dx = e.cx - o.x, dy = e.cy - o.y, d = Math.hypot(dx, dy); if (d < BOOM_R * 1.4) { e.vx += dx / d * 5; e.vy += 4; } }
  for (const b of W.bodies) { const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy); if (d < BOOM_R * 1.3) { if (b.hanging) cutRope(b); b.vx += dx / (d || 1) * 7; b.vy += 6; b.av = (Math.random() - 0.5) * 10; b.ground = false; } }
  for (const b of W.barrels) if (b.alive && Math.hypot(b.x - o.x, b.y - o.y) < BOOM_R) pending.push({ o: b, t: 0.13 });
}
function lose(t, line) {
  if (state !== 'play') return;
  state = 'lost'; F.level(false, killed / Math.max(1, total)); slowT = 0; timeScale = 1;
  sfx.fail(); buzz([60, 40, 80]); shake = Math.max(shake, 0.4);
  ui.lose(t, line);
}
function win() {
  if (state !== 'play') return;
  state = 'won'; F.level(true); WB.submit(1); timeScale = 1;
  const bonus = 150 * bullets; addScore(bonus);
  sfx.win(); buzz([20, 40, 20]);
  confetti(scene, V(0, 15, 1), 80);
  if (bullets >= 2) ui.pop('ONE SHOT!', '#ffd23f', 46, 30);
  level++; save.set('level', level);
  ui.win(level - 1, bullets ? `+${bonus} for ${bullets} spare bullet${bullets > 1 ? 's' : ''}` : `${score} pts`);
}

// ------------------------------------------------------------------ physics: crates / weights / ragdolls
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const boxOf = (o) => ({ x0: o.x - o.w / 2, y0: o.y - o.h / 2, x1: o.x + o.w / 2, y1: o.y + o.h / 2 });
function stepBody(o, dt) {
  if (o.hanging) return;
  const solids = W.statics.concat(W.bodies.filter(b => b !== o).map(boxOf), W.barrels.filter(b => b.alive).map(boxOf));
  o.vy = Math.max(-28, o.vy - 26 * dt);
  o.x += o.vx * dt;
  for (const s of solids) { const bb = boxOf(o); bb.y0 += 0.02; bb.y1 -= 0.02; if (overlap(bb, s)) { if (o.vx > 0) o.x = s.x0 - o.w / 2; else if (o.vx < 0) o.x = s.x1 + o.w / 2; o.vx *= -0.25; } }
  const vyPrev = o.vy, prevB = o.y - o.h / 2, prevT = o.y + o.h / 2; o.y += o.vy * dt; const wasGround = o.ground; o.ground = false;
  let land = null;
  for (const s of solids) if (overlap(boxOf(o), s)) {
    if (o.vy <= 0 && prevB >= s.y1 - 0.05) { if (!land || s.y1 > land.y1 || (s.y1 === land.y1 && o.x >= s.x0 && o.x <= s.x1)) land = s; }
    else if (o.vy > 0 && prevT <= s.y0 + 0.05) { o.y = s.y0 - o.h / 2; o.vy = 0; }
  }
  if (land) {
    o.y = land.y1 + o.h / 2; o.vy = 0;
    const sup = solids.some(s => Math.abs(s.y1 - land.y1) < 0.03 && o.x >= s.x0 && o.x <= s.x1 && s.x1 > o.x - o.w / 2 && s.x0 < o.x + o.w / 2);
    if (sup) o.ground = true;
    else { const dir = o.x < land.x0 ? -1 : 1; o.vx += dir * 7 * dt; o.av = -dir * 3; o.rot += o.av * dt; }   // tip off an edge
  }
  if (o.ground) {
    if (!wasGround && vyPrev < -5) { sfx.bounce(); tone(90, 0.12, 'sine', 0.12, 0.6); shake = Math.max(shake, o.kind === 'weight' ? 0.4 : 0.18); burst(scene, V(o.x, o.y - o.h / 2, 0.6), '#d8c3a5', 8, { speed: 0.07, up: 0.03, size: 0.6 }); }
    o.vx *= Math.pow(0.004, dt);
    const q = Math.round(o.rot / (Math.PI / 2)) * (Math.PI / 2); o.rot = lerp(o.rot, q, 1 - Math.pow(0.0005, dt)); o.av = 0;
  } else o.rot += o.av * dt;
  if (vyPrev < -3) {
    const bb = boxOf(o), bb2 = { ...bb, y0: bb.y0 - 0.15 };
    for (const e of W.enemies) if (e.alive && overlap(bb2, { x0: e.x - ER.hw, y0: e.y, x1: e.x + ER.hw, y1: e.y + ER.h })) { killEnemy(e, Math.sign(e.x - o.x) * 0.4, -1, 'crush'); }
    for (const h of W.hostages) if (h.alive && overlap(bb2, { x0: h.x - ER.hw, y0: h.y, x1: h.x + ER.hw, y1: h.y + ER.h })) hostageHit(h, Math.sign(h.x - o.x) || 1);
    if (vyPrev < -7) for (const b of W.barrels) if (b.alive && overlap(bb2, boxOf(b))) pending.push({ o: b, t: 0.02 });
  }
  if (o.y < -5) { o.y = -5; o.vy = 0; o.ground = true; }
  o.m.position.set(o.x, o.y, 0); o.m.rotation.z = o.rot;
}
function stepRag(e, dt, t) {
  const r = 0.34;
  e.vy -= 22 * dt; e.cx += e.vx * dt; e.cy += e.vy * dt; e.rot += e.av * dt;
  let grounded = false;
  const solids = W.statics.concat(W.bodies.map(boxOf), W.barrels.filter(b => b.alive).map(boxOf));
  for (const s of solids) {
    const qx = clamp(e.cx, s.x0, s.x1), qy = clamp(e.cy, s.y0, s.y1); let dx = e.cx - qx, dy = e.cy - qy, d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d < 1e-6) { dx = 0; dy = 1; d = 1; e.cy = s.y1 + r; continue; }
    const nx = dx / d, ny = dy / d; e.cx = qx + nx * r; e.cy = qy + ny * r;
    const vn = e.vx * nx + e.vy * ny;
    if (vn < 0) { e.vx -= 1.35 * vn * nx; e.vy -= 1.35 * vn * ny; e.vx *= 0.8; e.av *= 0.55; if (vn < -4) tone(140, 0.06, 'sine', 0.06, 0.6); }
    if (ny > 0.6) grounded = true;
  }
  if (grounded) { e.vx *= Math.pow(0.02, dt); if (Math.hypot(e.vx, e.vy) < 2) { const q = Math.PI / 2 + Math.round((e.rot - Math.PI / 2) / Math.PI) * Math.PI; e.rot = lerp(e.rot, q, 1 - Math.pow(0.002, dt)); e.av *= 0.8; } }
  if (e.cy < -6) { e.cy = -6; e.vy = 0; }
  e.flail *= Math.pow(0.35, dt);
  const f = 0.25 + e.flail, p = e.p;
  p.g.position.set(e.cx, e.cy - 0.95, 0.05); p.piv.rotation.z = e.rot;
  p.armL.rotation.z = -2.2 + Math.sin(t * 17 + e.ph) * 1.3 * f; p.armR.rotation.z = 2.2 + Math.sin(t * 15 + e.ph + 1) * 1.3 * f;
  p.legL.rotation.z = -0.5 + Math.sin(t * 13 + e.ph) * 0.8 * f; p.legR.rotation.z = 0.5 + Math.sin(t * 14 + e.ph + 2) * 0.8 * f;
}

// ------------------------------------------------------------------ input
const toWorld = (cx, cy) => new THREE.Vector3((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1, 0).unproject(cam);
function aimAt(cx, cy) {
  const p = toWorld(cx, cy), f = p.x >= W.agent.x ? 1 : -1, sx = W.agent.x + 0.35 * f, sy = W.agent.y + 1.34;
  if (Math.hypot(p.x - sx, p.y - sy) < 0.05) return;
  aimA = Math.atan2(p.y - sy, p.x - sx);
}
input({
  onDown: (e) => { if (state !== 'play' || bullet || slowT > 0 || bullets <= 0) return; aiming = true; aimAt(e.clientX, e.clientY); sfx.tap(); },
  onMove: (dx, dy, e) => { if (aiming) aimAt(e.clientX, e.clientY); },
  onUp: (e) => { if (!aiming) return; aiming = false; aimAt(e.clientX, e.clientY); fire(); },
});
ui.onTap((which) => { WB.start();
  if (which === 'start') { state = 'play'; return; }
  buildLevel(); state = 'play';
});

// ------------------------------------------------------------------ main loop
const dummy = new THREE.Object3D();
let camX = 0, camY = camBaseY;
function settled() { return !pending.length && W.bodies.every(b => b.hanging || (b.ground && Math.abs(b.vx) < 0.15)); }
loop((dt60, tt) => {
  const rdt = Math.min(dt60 / 60, 1 / 20), t = performance.now() / 1000;
  if (slowT > 0) { slowT -= rdt; if (slowT <= 0 && state === 'play') win(); }
  timeScale = lerp(timeScale, slowT > 0 ? 0.2 : 1, 1 - Math.pow(0.0005, rdt));
  const dt = rdt * timeScale;

  // ---- bullet flight
  if (bullet) {
    const B = bullet; B.s = Math.min(B.len, B.s + B.speed * dt);
    while (B.ei < B.ev.length && B.ev[B.ei].d <= B.s) {
      const ev = B.ev[B.ei++], p = posAt(B, ev.d);
      if (ev.type === 'kill') killEnemy(ev.ref, p.dx, p.dy, 'shot', ev.b);
      else if (ev.type === 'hostage') hostageHit(ev.ref, p.dx);
      else if (ev.type === 'boom') explode(ev.ref);
      else if (ev.type === 'cut') cutRope(ev.ref);
      else if (ev.type === 'push') { const o = ev.ref; if (!o.hanging) { o.vx += ev.dx * 5.5; o.vy += 2.5 + Math.max(0, ev.dy) * 2; o.av = -ev.dx * 6; o.ground = false; } tone(700, 0.06, 'square', 0.06, 0.6); burst(scene, V(p.x, p.y, 0.6), '#c98a4a', 6, { speed: 0.06, size: 0.5 }); }
    }
    const p = posAt(B, B.s);
    while (B.vi < B.pts.length - 1 && B.cum[B.vi] <= B.s) {   // ricochet ping + sparks at each wall bounce
      const q = B.pts[B.vi]; tone(1700 + B.vi * 140, 0.09, 'sine', 0.07, 0.55); burst(scene, V(q[0], q[1], 0.6), '#fff3b0', 6, { speed: 0.08, size: 0.45, gravity: 0.003 }); B.vi++;
    }
    bulletMesh.position.set(p.x, p.y, 0.75); bulletMesh.rotation.z = Math.atan2(p.dy, p.dx) - Math.PI / 2;
    let n = 0;
    for (let i = 1; i <= p.i && n < 12; i++) {
      const a = B.pts[i - 1], b = i === p.i ? [p.x, p.y] : B.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      dummy.position.set(a[0], a[1], 0); dummy.rotation.set(0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])); dummy.scale.set(L, 1, 1); dummy.updateMatrix(); trailMesh.setMatrixAt(n++, dummy.matrix);
    }
    trailMesh.count = n; trailMesh.instanceMatrix.needsUpdate = true;
    if (B.s >= B.len - 1e-6) {
      const last = B.ev[B.ev.length - 1];
      if (!last || (last.type !== 'boom' && last.type !== 'hostage')) { burst(scene, V(p.x, p.y, 0.6), '#fff3b0', 8, { speed: 0.07, size: 0.5 }); tone(1200, 0.05, 'triangle', 0.05, 0.4); }
      bullet = null; bulletMesh.visible = false; tFade = 1;
      if (shotKills === 0 && state === 'play') ui.pop('MISSED', '#ffffff', 28, 30);
    }
  } else if (tFade > 0) { tFade = Math.max(0, tFade - rdt * 1.4); trailMesh.material.opacity = 0.9 * tFade; if (!tFade) trailMesh.count = 0; }

  // ---- pending chain explosions, physics
  for (const q of pending) q.t -= dt;
  for (const q of pending.filter(q => q.t <= 0)) explode(q.o);
  pending = pending.filter(q => q.t > 0);
  if (W) {
    for (const o of W.bodies) stepBody(o, dt);
    for (const e of W.enemies) if (e.rag) stepRag(e, dt, t);
    for (const e of W.hostages) if (e.rag) stepRag(e, dt, t);
  }
  for (const p of puffs) { p.t += dt * 2.2; const k = clamp(p.t, 0, 1); p.m.scale.setScalar(0.1 + p.s * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2)); p.m.material.opacity = 1 - Math.max(0, (k - 0.45) / 0.55); p.m.position.y += dt * 0.8; }
  puffs = puffs.filter(p => p.t < 1 || (scene.remove(p.m), p.m.material.dispose(), false));

  // ---- living goons + hostages + agent animation
  if (W) {
    for (const e of W.enemies) if (e.alive) {
      const p = e.p, s = Math.sin(t * 5 + e.ph);
      p.armL.rotation.z = -2.35 + s * 0.35; p.armR.rotation.z = 2.35 - Math.sin(t * 5.3 + e.ph) * 0.35;
      p.piv.position.y = 0.95 + Math.abs(s) * 0.05; p.root.scale.set(1 + Math.abs(s) * 0.02, 1 - Math.abs(s) * 0.02, 1);
      p.head.rotation.z = Math.sin(t * 2.4 + e.ph) * 0.12;
    }
    for (const h of W.hostages) if (h.alive) { const p = h.p; p.armL.rotation.z = 0.25; p.armR.rotation.z = -0.25; p.piv.rotation.z = Math.sin(t * 30 + h.ph) * 0.03; }
    const A = agent, facing = Math.cos(aimA) >= 0 ? 1 : -1;
    A.g.scale.x = facing;
    const la = facing > 0 ? aimA : Math.PI - aimA;
    A.recoil = Math.max(0, (A.recoil || 0) - rdt * 6);
    if (state === 'won') { const j = Math.abs(Math.sin(t * 7)); A.g.position.y = W.agent.y + j * 0.5; A.armL.rotation.z = -2.6; A.armR.rotation.z = 2.6; }
    else if (state === 'lost') { A.armL.rotation.z = -0.8; A.armR.rotation.z = 0.8; A.head.rotation.z = Math.sin(t * 3) * 0.2; }
    else { A.g.position.y = W.agent.y; A.armR.rotation.z = la + Math.PI / 2 + A.recoil * 0.5; A.armL.rotation.z = -0.15 + Math.sin(t * 2) * 0.04; A.piv.position.y = 0.95 + Math.sin(t * 2.2) * 0.012; }
    A.gun.flash.material.opacity = Math.max(0, A.gun.flash.material.opacity - rdt * 10);
  }

  // ---- laser sight (first two ricochets) while aiming
  if (W && state === 'play' && !bullet && bullets > 0 && slowT <= 0) {
    const s = shoulder(W, aimA), T = trace(W, s.x, s.y, aimA, 2, aiming ? 17 : 9);
    let n = 0, off = (t * 1.6) % 0.42; const segs = T.pts;
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1], b = segs[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, ang = Math.atan2(uy, ux);
      for (let d = i === 1 ? 0.5 + off : off; d < L && n < 160; d += 0.42) {
        const len = Math.min(0.26, L - d);
        dummy.position.set(a[0] + ux * d, a[1] + uy * d, 0); dummy.rotation.set(0, 0, ang); dummy.scale.set(len, 1, 1); dummy.updateMatrix(); laser.setMatrixAt(n++, dummy.matrix);
      }
    }
    laser.count = n; laser.instanceMatrix.needsUpdate = true; laser.material.opacity = aiming ? 0.95 : 0.5;
    const end = segs[1]; reticle.visible = aiming; reticle.position.set(end[0], end[1], 0.85); reticle.scale.setScalar(1 + Math.sin(t * 10) * 0.12);
  } else { laser.count = 0; reticle.visible = false; }

  // ---- lose when out of bullets and everything has settled
  if (state === 'play' && !bullet && bullets <= 0 && slowT <= 0 && killed < total) {
    if (settled()) { loseT += rdt; if (loseT > 1.1) lose('OUT OF AMMO', `${total - killed} goon${total - killed > 1 ? 's' : ''} left standing`); } else loseT = 0;
  }

  // ---- camera: punch-in on the final kill, shake
  let tz = 1, tx = 0, ty = camBaseY;
  if (slowT > 0 && focus) { tz = 1.12; tx = clamp(focus.x * 0.3, -0.8, 0.8); ty = lerp(camBaseY, focus.y + 1, 0.2); }
  cam.zoom = lerp(cam.zoom, tz, 1 - Math.pow(0.004, rdt)); cam.updateProjectionMatrix();
  shake = Math.max(0, shake - rdt * 1.6);
  camX = lerp(camX, tx, 1 - Math.pow(0.004, rdt)); camY = lerp(camY, ty, 1 - Math.pow(0.004, rdt));
  cam.position.set(camX + (Math.random() - 0.5) * shake * 0.4, camY + (Math.random() - 0.5) * shake * 0.4, 20);
  renderer.render(scene, cam);
});

buildLevel();
ui.start();

// ------------------------------------------------------------------ test hooks
const toScreen = (x, y) => { const v = new THREE.Vector3(x, y, 0).project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
let botDown = null;
function bestAngle() {
  const sw = sweep(W, 1440);
  let bestC = -1, bestB = 99;
  const score = sw.map(s => { if (s.hostage) return -1; let c = 0, bb = 0; for (const b of s.kills.values()) { c++; bb += b; } return c * 100 - bb; });
  for (const v of score) bestC = Math.max(bestC, v);
  // centre of the longest run of best-scoring angles
  let runStart = -1, bestRun = 0, bestMid = 0;
  for (let i = 0; i <= sw.length; i++) {
    const ok = i < sw.length && score[i] === bestC;
    if (ok && runStart < 0) runStart = i;
    if (!ok && runStart >= 0) { if (i - runStart > bestRun) { bestRun = i - runStart; bestMid = Math.floor((runStart + i - 1) / 2); } runStart = -1; }
  }
  return sw[bestMid].a;
}

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {
    if (state !== 'play') return;
    const ev = (type, x, y) => dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
    if (botDown) { ev('pointerup', botDown[0], botDown[1]); botDown = null; return; }
    if (bullet || slowT > 0 || bullets <= 0 || !settled() || shake > 0.05) return;
    const a = bestAngle(), s = shoulder(W, a);
    for (const R of [3.4, 2.6, 1.9, 1.3, 0.8]) {
      const [x, y] = toScreen(s.x + Math.cos(a) * R, s.y + Math.sin(a) * R);
      if (x > 4 && x < innerWidth - 4 && y > 4 && y < innerHeight - 4) { ev('pointerdown', x, y); ev('pointermove', x, y); botDown = [x, y]; return; }
    }
  },
};

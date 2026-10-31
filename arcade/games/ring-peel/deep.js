// Ring Peel deep v2 (studio lane 25, 2026-10-31) — 30 hand-made piers in 3 worlds, armored / bomb / gold rings, blinking shutters,
// gate rings, FEVER, near-miss grazes, stars (no crash + under par), a pier map, six ball skins and three daily goals. Plan in DESIGN.md.
// Same game as v1: hold to pour iron balls down the pier, peel the tower ring by ring, one ball into a guard wall ends the try.
import { THREE, createStage, createUI, input, loop, sfx, tone, note, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS } from './levels.js';
import { OR, TR, PR, BALL_SPEED, FIRE_DT, PI2, wrap, guardAngle, solid, untilSolid, blocked, room, safeShot, parOf } from './gmath.js';

const stage = createStage({ fov: 34, shadows: true, shadowSize: 9 });
const { scene, camera, sun, hemi } = stage;
const ui = createUI({ title: 'RING<br>PEEL', hint: 'Hold to fire', hand: '👆' });
ui.els.start.classList.add('hc-hidden');
const css = document.createElement('style');
css.textContent = `.hc-score{font-size:46px;text-shadow:0 3px 0 rgba(0,0,0,.25),0 0 10px rgba(0,0,0,.25);top:calc(58px + env(safe-area-inset-top))}
.hc-sub{top:calc(108px + env(safe-area-inset-top));font-size:20px;letter-spacing:6px;text-shadow:0 0 8px rgba(0,0,0,.3)}
.hc-pop{text-shadow:0 3px 0 rgba(0,0,0,.25),0 0 14px rgba(0,0,0,.18)!important}
.rp-chip{position:fixed;left:10px;top:calc(60px + env(safe-area-inset-top));z-index:6;display:flex;flex-direction:column;gap:2px;align-items:flex-start;pointer-events:none;font-weight:800;font-size:15px;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.rp-chip .s{display:flex;gap:1px}.rp-chip svg{width:19px;height:19px;filter:drop-shadow(0 2px 0 rgba(0,0,0,.2))}.rp-chip b{font-size:17px}
.rp-chip.late b{color:#ffd23f}
.rp-map{position:fixed;right:10px;top:calc(56px + env(safe-area-inset-top));z-index:7;width:44px;height:44px;border-radius:14px;border:0;background:rgba(255,255,255,.88);box-shadow:0 4px 0 rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;padding:0}
.rp-map svg{width:26px;height:26px}
.rp-fev{position:fixed;left:50%;bottom:calc(9% + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(250px,64vw);height:16px;border-radius:10px;background:rgba(255,255,255,.5);overflow:hidden;z-index:6;pointer-events:none;box-shadow:0 3px 0 rgba(0,0,0,.14)}
.rp-fev i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffb300,#ff5d8f);border-radius:10px}
.rp-fev span{position:absolute;inset:0;text-align:center;font-weight:800;font-size:12px;line-height:16px;letter-spacing:3px;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.35)}
.rp-fev.on{animation:rpfev .25s linear infinite;box-shadow:0 0 20px #ff5d8f}.rp-fev.on i{background:#fff}.rp-fev.on span{color:#ff3d7f;text-shadow:none}
@keyframes rpfev{50%{transform:translateX(-50%) scale(1.06)}}
.rp-glow{position:fixed;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 55%,transparent 38%,rgba(255,60,130,.55) 100%)}
.rp-glow.on{opacity:1;animation:rpglow .5s ease-in-out infinite alternate}@keyframes rpglow{to{opacity:.55}}
.rp-combo{position:fixed;left:50%;top:calc(24% + env(safe-area-inset-top));transform:translateX(-50%) scale(1);z-index:6;pointer-events:none;font-weight:800;font-size:30px;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.25),0 0 12px rgba(0,0,0,.2);opacity:0;transition:opacity .2s}
.rp-fl{position:fixed;z-index:6;pointer-events:none;font-weight:800;white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.28);transform:translate(-50%,-50%);animation:rpfl .8s ease-out forwards}
@keyframes rpfl{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-190%) scale(1)}}
.rp-hand{position:fixed;left:50%;bottom:20%;z-index:6;pointer-events:none;text-align:center;font-weight:800;font-size:20px;transform:translateX(-50%);animation:hcpulse 1s ease-in-out infinite;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.rp-hand div{font-size:46px}
.rp-card{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;color:#fff;text-align:center;font-family:inherit}
.rp-home{justify-content:flex-start;padding:calc(120px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom));gap:10px}
.rp-home h1{margin:0;font-size:clamp(46px,14vw,78px);line-height:.9;font-weight:800;text-shadow:0 6px 0 rgba(0,0,0,.14);letter-spacing:1px}
.rp-home .w{font-size:17px;font-weight:800;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.18)}
.rp-btn{pointer-events:auto;font:inherit;font-weight:800;font-size:24px;color:#fff;background:#3cc46a;border:0;border-radius:40px;padding:14px 46px;box-shadow:0 6px 0 #2a9a50;cursor:pointer}
.rp-btn:active{transform:translateY(3px);box-shadow:0 3px 0 #2a9a50}.rp-btn.sm{font-size:20px;padding:10px 20px;background:rgba(255,255,255,.9);color:#36405e;box-shadow:0 5px 0 rgba(0,0,0,.18)}
.rp-btn.big{font-size:30px;padding:16px 60px;animation:hcpulse 1.4s ease-in-out infinite}.rp-btn.red{background:#ff5d73;box-shadow:0 6px 0 #d03a52}
.rp-home .go{margin-top:auto;margin-bottom:9vh;display:flex;flex-direction:column;gap:14px;align-items:center}
.rp-home .sk svg{width:18px;height:18px}.rp-home .sk{display:flex;gap:5px;align-items:center;justify-content:center;flex-wrap:wrap;font-size:15px;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.18)}
.rp-lose{justify-content:flex-end;padding:0 20px calc(11% + env(safe-area-inset-bottom));gap:8px;background:linear-gradient(transparent 40%,rgba(30,20,50,.38))}
.rp-lose h2{margin:0;font-size:44px;font-weight:800;text-shadow:0 4px 0 rgba(0,0,0,.25)}.rp-lose p{margin:0;font-size:20px;font-weight:700;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.rp-lose .tip{font-size:15px;opacity:.95;max-width:300px}
.rp-win{justify-content:flex-start;padding:calc(100px + env(safe-area-inset-top)) 20px calc(30px + env(safe-area-inset-bottom));gap:10px;background:rgba(25,20,50,.28)}
.rp-win h1{margin:0;font-size:clamp(40px,12vw,64px);line-height:.95;font-weight:800;text-shadow:0 5px 0 rgba(0,0,0,.22)}
.rp-win .sub{font-size:16px;font-weight:800;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.rp-win .st{display:flex;gap:8px;margin:6px 0}.rp-win .st svg{width:62px;height:62px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.25));opacity:.28;transform:scale(.6)}
.rp-win .st svg.on{opacity:1;animation:rpstar .45s cubic-bezier(.2,1.6,.4,1) forwards}@keyframes rpstar{from{transform:scale(.2) rotate(-40deg)}to{transform:scale(1) rotate(0)}}
.rp-win .ln{font-size:17px;font-weight:700;text-shadow:0 2px 0 rgba(0,0,0,.22)}
.rp-win .chip{background:rgba(255,255,255,.92);color:#36405e;border-radius:16px;padding:6px 14px;font-size:16px;font-weight:800;box-shadow:0 3px 0 rgba(0,0,0,.14)}
.rp-win .row{margin-top:auto;display:flex;gap:10px;align-items:center;margin-bottom:6vh}
.rp-mapv{justify-content:flex-start;background:linear-gradient(#cfe9f2,#f5fbff);color:#26405e;overflow:auto;padding:calc(62px + env(safe-area-inset-top)) 14px 30px;gap:8px}
.rp-mapv h2{margin:4px 0 0;font-size:24px;font-weight:800}.rp-mapv .tot{font-size:15px;font-weight:800}
.rp-mapv .wn{font-size:19px;font-weight:800;margin-top:6px}.rp-mapv .wn small{display:block;font-size:12px;font-weight:600;opacity:.75}
.rp-mapv .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;width:min(94vw,440px)}
.rp-node{position:relative;aspect-ratio:1;border-radius:16px;border:0;background:#fff;color:#26405e;font:inherit;font-weight:800;font-size:19px;box-shadow:0 4px 0 rgba(0,0,0,.14);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0}
.rp-node .ss{display:flex;gap:0}.rp-node .ss svg{width:14px;height:14px}
.rp-node.lock{opacity:.45;background:#dfe7ee}.rp-node.hard{outline:3px solid #ff5d73}.rp-node.next{background:#ffd23f;animation:hcpulse 1.1s ease-in-out infinite}
.rp-node.done{background:#e8fff0}
.rp-mapv .goals{display:flex;flex-direction:column;gap:6px;width:min(94vw,440px)}
.rp-goal{background:#fff;border-radius:14px;padding:7px 12px;font-size:14px;font-weight:700;text-align:left;box-shadow:0 3px 0 rgba(0,0,0,.1);position:relative;overflow:hidden}
.rp-goal i{position:absolute;left:0;top:0;bottom:0;background:#c9f5d9;z-index:0}.rp-goal span{position:relative;z-index:1}
.rp-skins{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:min(94vw,440px)}
.rp-skin{width:48px;height:56px;border-radius:14px;background:#fff;border:3px solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;font-weight:800;box-shadow:0 3px 0 rgba(0,0,0,.1);padding:0;font-family:inherit;color:#26405e}
.rp-skin b{width:24px;height:24px;border-radius:50%;display:block;margin-bottom:2px}.rp-skin.on{border-color:#3cc46a}.rp-skin.lock{opacity:.5}
.rp-toast{position:fixed;left:50%;top:calc(150px + env(safe-area-inset-top));transform:translateX(-50%);z-index:14;background:#fff;color:#26405e;border-radius:18px;padding:8px 16px;font-weight:800;font-size:16px;box-shadow:0 4px 0 rgba(0,0,0,.18);pointer-events:none;animation:rptoast 2.4s ease-out forwards;white-space:nowrap}
@keyframes rptoast{0%{opacity:0;transform:translate(-50%,-14px)}10%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}`;
document.head.appendChild(css);

const save = store('ringpeel_d');
const F = flow('ringpeel');
const WB = worldBoard({ game: 'ring-peel', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.2 }, mode: 'sum' });
const mk = (cls, tag = 'div', html = '') => { const d = document.createElement(tag); d.className = cls; if (html) d.innerHTML = html; document.body.appendChild(d); return d; };
const starSvg = (on = true, c = '#ffc400') => `<svg viewBox="0 0 24 24"><path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.5 5.7 21.2l1.5-7.1L1.8 9.2 9 8.4z" fill="${on ? c : '#b8c4d4'}" stroke="${on ? '#b87d00' : '#8fa0b5'}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

// ------------------------------------------------------------------ progress (stars per level, skin, goals)
let stars = save.get('stars', []);                 // best stars per level (index n-1)
let skin = save.get('skin', 0), bonus = save.get('bonus', 0), golds = save.get('golds', 0), seenSkin = save.get('seenSkin', 0);
const SKINS = [
  { name: 'Iron', c: '#363a47', e: '#000000', at: 0 }, { name: 'Candy', c: '#ff5d8f', e: '#5a0020', at: 5 }, { name: 'Gold', c: '#ffc400', e: '#5a3a00', at: 12 },
  { name: 'Frost', c: '#bfeaff', e: '#103a5a', at: 22 }, { name: 'Neon', c: '#39ff88', e: '#007a30', at: 34 }, { name: 'Lava', c: '#ff6a1f', e: '#8a1800', at: 48 },
];
const sumStars = () => stars.reduce((a, b) => a + (b || 0), 0) + bonus;
const unlockedLv = () => { let n = 1; while ((stars[n - 1] || 0) > 0) n++; return n; };   // highest playable level
const skinOpen = i => sumStars() >= SKINS[i].at;
const dayKey = () => new Date().toISOString().slice(0, 10);
const GOALS = [
  { id: 'rings', t: n => `Peel ${n} rings`, n: 90 }, { id: 'graze', t: n => `Squeeze past walls ${n} times`, n: 8 }, { id: 'gold', t: n => `Pop ${n} gold rings`, n: 3 },
  { id: 'tower', t: n => `Topple ${n} towers`, n: 6 }, { id: 'win', t: n => `Clear ${n} piers`, n: 3 }, { id: 'fever', t: n => `Reach FEVER ${n} times`, n: 2 },
  { id: 'bomb', t: n => `Blow up ${n} bomb rings`, n: 4 },
];
let daily = save.get('daily', null);
if (!daily || daily.day !== dayKey()) {
  const r = rng(+dayKey().replace(/-/g, '') % 99991 + 3), pool = GOALS.slice(), pick = [];
  while (pick.length < 3) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  daily = { day: dayKey(), goals: pick.map(id => ({ id, v: 0, done: false })) }; save.set('daily', daily);
}
function stat(id, k = 1) {
  for (const g of daily.goals) if (g.id === id && !g.done) {
    const G = GOALS.find(x => x.id === id); g.v += k;
    if (g.v >= G.n) { g.done = true; bonus++; save.set('bonus', bonus); toast(`Goal done: ${G.t(G.n)}  +1`); tone(880, 0.1, 'triangle', 0.12, 1.4); }
  }
  save.set('daily', daily);
}
function toast(t) { const d = mk('rp-toast', 'div', t); setTimeout(() => d.remove(), 2500); }

// ------------------------------------------------------------------ themes (sea, sky, tower stripes, guard walls) — one pair per world
const THEMES = [
  { sea: '#53bfd0', sky: ['#9fdcf0', '#ffd7a0'], a: '#ff5d73', b: '#ffe26a', ob: '#474a5c', rock: '#f0dcc0', ui: '#ff5d73' },
  { sea: '#6fb07f', sky: ['#bfe8c0', '#fff3c4'], a: '#ff8c42', b: '#ffffff', ob: '#2d3142', rock: '#f6ead2', ui: '#ff7a2f' },
  { sea: '#8d6b8e', sky: ['#c8a6c7', '#ffc98f'], a: '#ffd23f', b: '#4b4f5e', ob: '#3a86ff', rock: '#e8cfc4', ui: '#ffb300' },
  { sea: '#e39a7c', sky: ['#ffc4a8', '#ffe9c2'], a: '#2ec4b6', b: '#ffffff', ob: '#ff5964', rock: '#fff0dc', ui: '#22b3a6' },
  { sea: '#5c7fa8', sky: ['#a9c3e6', '#e9f0ff'], a: '#9a5cff', b: '#ffffff', ob: '#7b3fe4', rock: '#e6eef8', ui: '#8a4dff' },
  { sea: '#56c7c0', sky: ['#9ff0e6', '#e6fff8'], a: '#7f5cff', b: '#6fe3c4', ob: '#5a35c8', rock: '#c9e3f5', ui: '#6b4dff' },
];
let T = THEMES[0];
const worldOf = n => Math.min(2, Math.floor((n - 1) / 10));

// ------------------------------------------------------------------ world: faceted sea + rocks
const seaGeo = (() => {
  const g = new THREE.PlaneGeometry(220, 220, 70, 70); const r = rng(3), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (r() - 0.5) * 0.55);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
})();
const seaMat = new THREE.MeshStandardMaterial({ color: T.sea, roughness: 0.85, metalness: 0, flatShading: true });
const sea = new THREE.Mesh(seaGeo, seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.6, -40); sea.receiveShadow = true; scene.add(sea);
scene.fog = new THREE.Fog('#ffd7a0', 30, 95);
const rockMat = new THREE.MeshStandardMaterial({ color: T.rock, roughness: 0.75, flatShading: true });
const iceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, flatShading: true, transparent: true, opacity: 0.85 });
const pillarGeo = new THREE.CylinderGeometry(0.7, 1.1, 1, 6, 1); pillarGeo.translate(0, 0.5, 0);
const chunkGeo = new THREE.DodecahedronGeometry(0.6, 0);
const pillars = new THREE.InstancedMesh(pillarGeo, rockMat, 60), chunks = new THREE.InstancedMesh(chunkGeo, iceMat, 60);
pillars.castShadow = true; scene.add(pillars, chunks);
{
  const r = rng(11), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  let ip = 0, ic = 0;
  for (let i = 0; i < 120; i++) {
    const side = r() < 0.5 ? -1 : 1, x = side * (4.5 + r() * 26), z = 14 - r() * 90;
    if (i % 2 === 0 && ip < 60) {
      const h = 1.5 + r() * (Math.abs(x) > 9 ? 9 : 3); e.set((r() - 0.5) * 0.15, r() * 6, (r() - 0.5) * 0.15); q.setFromEuler(e);
      s.set(0.6 + r() * 1.4, h, 0.6 + r() * 1.4); p.set(x, -1.8, z); m.compose(p, q, s); pillars.setMatrixAt(ip++, m);
    } else if (ic < 60) {
      e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e); const k = 0.5 + r() * 1.2; s.set(k * 1.4, k * 0.8, k);
      p.set(x * 0.8, -1.55, z); m.compose(p, q, s); chunks.setMatrixAt(ic++, m);
    }
  }
  pillars.count = ip; chunks.count = ic;
}

// ------------------------------------------------------------------ pier + platforms
const white = mat('#f7f9fc', { roughness: 0.55 }), legMat = mat('#c7ccd6'), groove = mat('#e3e7ef');
const SPACING = 17, RH = 0.36;
const pierGroup = new THREE.Group(); scene.add(pierGroup);
function buildPier(n) {
  pierGroup.clear();
  const len = (n - 1) * SPACING + 12, w = new THREE.Mesh(rounded(1.9, 0.5, len, 0.06), white);
  w.position.set(0, -0.3, -(n - 1) * SPACING / 2 + 6); w.receiveShadow = true; pierGroup.add(w);
  for (let s = 0; s < n; s++) {
    const z = -s * SPACING;
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR, 0.5, 64), white); plat.position.set(0, -0.24, z); plat.receiveShadow = true; plat.castShadow = true; pierGroup.add(plat);
    for (const rr of [OR - 0.42, OR + 0.42, PR - 0.25]) {
      const g = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.035, 6, 72), groove); g.rotation.x = Math.PI / 2; g.position.set(0, 0.01, z); pierGroup.add(g);
    }
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, l = new THREE.Mesh(rounded(0.9, 1.6, 0.9, 0.08), legMat);
      l.position.set(Math.sin(a) * (PR - 0.8), -1.2, z + Math.cos(a) * (PR - 0.8)); l.rotation.y = a; pierGroup.add(l);
    }
  }
  for (let z = 8; z > -(n - 1) * SPACING; z -= 5) for (const x of [-0.7, 0.7]) {
    if (((-z) % SPACING + SPACING) % SPACING < PR + 0.5 || ((-z) % SPACING + SPACING) % SPACING > SPACING - PR - 0.5) continue;
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.35), legMat); l.position.set(x, -1.1, z); pierGroup.add(l);
  }
}

// counter painted on the pier (rings left)
const cnv = document.createElement('canvas'); cnv.width = 256; cnv.height = 128;
const ctx = cnv.getContext('2d'), cTex = new THREE.CanvasTexture(cnv); cTex.colorSpace = THREE.SRGBColorSpace;
const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: cTex, transparent: true, depthWrite: false }));
counter.rotation.x = -Math.PI / 2; scene.add(counter);
function drawCounter(n) {
  ctx.clearRect(0, 0, 256, 128); ctx.fillStyle = 'rgba(120,128,145,0.55)'; ctx.font = '800 96px "Baloo 2", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 128, 70); cTex.needsUpdate = true;
}

// ------------------------------------------------------------------ cannon
const cannon = new THREE.Group(); scene.add(cannon);
const cMat = mat('#5d6373', { roughness: 0.6 }), cDark = mat('#41465a');
{
  const base = new THREE.Mesh(rounded(1.5, 0.75, 1.25, 0.1), cMat); base.position.y = 0.38; base.castShadow = true;
  const top = new THREE.Mesh(rounded(0.85, 0.55, 0.85, 0.1), cMat); top.position.y = 0.95; top.castShadow = true;
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 20), cDark); mouth.rotation.x = Math.PI / 2; mouth.position.set(0, 0.42, -0.63);
  cannon.add(base, top, mouth); cannon.body = base; cannon.top = top;
}
let cannonZ = 8, cannonKick = 0;

// ------------------------------------------------------------------ tower (instanced rounded rings)
function ringGeo(seg) {
  const pts = [], r = TR, h = RH, b = 0.05;
  pts.push(new THREE.Vector2(0, 0.0)); pts.push(new THREE.Vector2(r - b, 0.0));
  for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, b + Math.sin(a) * b)); }
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, h - b + Math.sin(a) * b)); }
  pts.push(new THREE.Vector2(0, h));
  const g = new THREE.LatheGeometry(pts, seg); if (seg === 4) g.rotateY(Math.PI / 4); g.computeVertexNormals(); return g;
}
const RING_GEOS = { 48: ringGeo(48), 6: ringGeo(6), 4: ringGeo(4) };
const SHAPE = { o: 48, h: 6, q: 4 };
let towerMesh = null;
const lidMat = mat('#000000', { transparent: true, opacity: 0.22 });
const lid = new THREE.Mesh(new THREE.CircleGeometry(TR * 0.72, 40), lidMat); lid.rotation.x = -Math.PI / 2; scene.add(lid);
const glow = new THREE.Mesh(new THREE.RingGeometry(TR + 0.05, TR + 0.75, 64), new THREE.MeshBasicMaterial({ color: '#ff5d8f', transparent: true, opacity: 0, depthWrite: false }));
glow.rotation.x = -Math.PI / 2; scene.add(glow);
let rings = [], removed = 0, towerZ = 0, towerSquash = 0, towerShape = 48, twist = 0;
const KCOL = { 1: '#ffc400', 2: '#6b7686', 3: '#e63946' }, CRACKED = '#aab3c2';
const ringColor = i => { const k = rings[i].kind; return k === 2 && rings[i].hp < 2 ? CRACKED : k ? KCOL[k] : (i % 2 ? T.b : T.a); };

// shards
const SHN = 420;
const shardMesh = new THREE.InstancedMesh(rounded(0.62, 0.34, 0.28, 0.06), mat('#ffffff'), SHN);
shardMesh.castShadow = true; shardMesh.frustumCulled = false; scene.add(shardMesh);
const shards = []; for (let i = 0; i < SHN; i++) shards.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 });
let shi = 0;
const _c = new THREE.Color();
function shatter(y, color, n = 9, power = 1) {
  _c.set(color);
  for (let k = 0; k < n; k++) {
    const sh = shards[shi], idx = shi; shi = (shi + 1) % SHN;
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.3, sp = (5 + Math.random() * 5) * power;
    sh.life = 1.4; sh.p.set(Math.sin(a) * TR, y + RH / 2, towerZ + Math.cos(a) * TR);
    sh.v.set(Math.sin(a) * sp, (2.5 + Math.random() * 4) * power, Math.cos(a) * sp * 0.8 - 1.5);
    sh.r.set(0, a, 0); sh.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14); sh.s = 0.8 + Math.random() * 0.5;
    shardMesh.setColorAt(idx, _c);
  }
  shardMesh.instanceColor.needsUpdate = true;
}

// balls
const MAXB = 64;
const ballMat = glossy('#363a47', { roughness: 0.22, metalness: 0.35 });
const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 22, 16), ballMat, MAXB);
ballMesh.castShadow = true; ballMesh.frustumCulled = false; scene.add(ballMesh);
let balls = [];
function setSkin(i) {
  skin = i; save.set('skin', i); const S = SKINS[i];
  ballMat.color.set(S.c); ballMat.emissive.set(S.e); ballMat.emissiveIntensity = i ? 0.55 : 0;
}

// guard walls
let guards = [];
function arcGeo(w) {
  const s = new THREE.Shape(), r0 = OR - 0.17, r1 = OR + 0.17, a0 = -Math.PI / 2 - w / 2, a1 = -Math.PI / 2 + w / 2;
  s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: Math.max(24, Math.ceil(w * 10)) });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.07, 0); g.computeVertexNormals(); return g;
}

// ------------------------------------------------------------------ endless piers after pier 30 (same elements, seeded)
function genLevel(n) {
  const r = rng(n * 104729 + 7), out = [], nst = 3 + (r() < 0.5 ? 1 : 0);
  const PI = Math.PI, d = Math.min(1, (n - 30) / 40);
  for (let s = 0; s < nst; s++) {
    const p = Math.floor(r() * 7), sp = 1.2 + r() * 0.3 + d * 0.4, rr = Math.round(30 + r() * 8 + d * 8);
    const gs = [[{ mode: 'spin', w: 2 * PI - (2.8 - d * 0.2), sp: sp + 0.2, a0: 0, gate: true }],
      [{ mode: 'surge', w: 0.7, sp: sp - 0.1, sp2: 2.4, ph: r() * 6, a0: 1 }, { mode: 'spin', w: 0.4, sp: -1, a0: 3 }],
      [{ mode: 'spin', w: 2 * PI - 2.9, sp, a0: 0, gate: true }, { mode: 'blink', w: 0.9, sp: 0.5, on: 0.8, off: 1.4, a0: 1.5, ph: r() * 3 }],
      [{ mode: 'spin', w: 0.6, sp, a0: 0 }, { mode: 'spin', w: 0.6, sp, a0: PI }, { mode: 'blink', w: 0.8, sp: 0.5, on: 0.8, off: 1.4, a0: 1.5 }],
      [{ mode: 'swing', w: 0.7, sp: sp + 0.1, amp: 1.3, a0: 0, ph: 0 }, { mode: 'spin', w: 0.5, sp: -1.2, a0: 2 }],
      [{ mode: 'spin', w: 2 * PI - 2.8, sp: -sp - 0.2, a0: 0, gate: true }, { mode: 'swing', w: 0.45, sp: 1.4, amp: 1.2, a0: 0, ph: 1 }],
      [{ mode: 'spin', w: 0.5, sp, a0: 0 }, { mode: 'spin', w: 0.5, sp, a0: 2.1 }, { mode: 'spin', w: 0.5, sp, a0: 4.2 }]][p];
    const pick = k => { const a = []; for (let i = 3 + Math.floor(r() * 4); i < rr - 2; i += k + Math.floor(r() * 4)) a.push(i); return a; };
    out.push({ r: rr, g: gs.map(g => ({ ph: 0, ...g })), sh: 'oqh'[Math.floor(r() * 3)], tw: r() < 0.6 ? 0.1 + r() * 0.15 : 0, gold: pick(9), arm: pick(7), bomb: pick(14) });
  }
  return { name: 'Endless dock ' + (n - 30), purpose: 'generated from the Storm Dock elements', stages: out, hard: false };
}

// ------------------------------------------------------------------ level / stage setup
let level = +new URLSearchParams(location.search).get('level') || Math.min(unlockedLv(), 9999);
let score = 0, state = 'home', LV = null, plan = [], stageIdx = 0, totalRings = 0, doneRings = 0, gt = 0, fireT = 0, holding = false;
let combo = 0, comboT = 0, shake = 0, camZ = 0, crashes = 0, stageCrashes = 0, levelTime = 0, par = 0, stageDone0 = 0, stageScore0 = 0, punch = 0;
let mapOpen = false, fev = 0, feverT = 0, timeScale = 1, slowT = 0, stopT = 0, goldN = 0, grazeN = 0, nearMiss = 0, handShown = false;
const guardMats = [];
const fkNow = () => clamp(F.k(), 0.9, 1.25);
function setupStage(s, retry = false) {
  const S = plan[s]; towerZ = -s * SPACING; towerShape = SHAPE[S.sh]; twist = S.tw;
  if (towerMesh) { scene.remove(towerMesh); towerMesh.dispose(); }
  towerMesh = new THREE.InstancedMesh(RING_GEOS[towerShape], mat('#ffffff', { roughness: 0.42 }), S.r);
  towerMesh.castShadow = true; towerMesh.receiveShadow = true; scene.add(towerMesh);
  rings = []; removed = 0;
  const lucky = !retry && level >= 4 && Math.random() < 0.4 ? 2 + Math.floor(Math.random() * Math.max(1, S.r - 6)) : -1;
  if (!retry || !S.lucky) S.lucky = lucky;
  for (let i = 0; i < S.r; i++) {
    const kind = S.bomb.includes(i) ? 3 : S.arm.includes(i) ? 2 : (S.gold.includes(i) || i === S.lucky) ? 1 : 0;
    rings.push({ y: i * RH + 1.2 + i * 0.12, alive: true, kind, hp: kind === 2 ? 2 : 1 });
  }
  for (let i = 0; i < S.r; i++) towerMesh.setColorAt(i, _c.set(ringColor(i)));
  towerMesh.instanceColor.needsUpdate = true;
  for (const g of guards) scene.remove(g.m);
  // friendly walls: after a crash on the same tower the walls get a little kinder (same for everyone)
  const c = Math.min(2, stageCrashes), fk = fkNow(), ez = 1 - 0.07 * c;
  guards = S.g.map((G0, i) => {
    const G = { ph: 0, amp: 1.2, sp2: 2, on: 1, off: 1, ...G0 };
    if (G.gate) G.w = clamp(PI2 - (PI2 - G.w) * (1 + 0.1 * c) / fk, 0.4, PI2 - 0.8); else G.w = clamp(G.w * fk * (1 - 0.1 * c), 0.35, 1.7);
    G.sp *= fk * ez;
    const m = new THREE.Mesh(arcGeo(G.w), guardMats[i] || (guardMats[i] = mat(T.ob, { roughness: 0.45, transparent: true })));
    m.material.color.set(T.ob); m.material.emissive.set('#000000'); m.material.opacity = 1;
    m.castShadow = true; m.position.set(0, -0.6, towerZ); scene.add(m); return { ...G, m, rise: 0 };
  });
  gt = 0; combo = 0; stageDone0 = doneRings; stageScore0 = score;
  counter.position.set(0, 0.02, towerZ + PR + 0.75); drawCounter(S.r);
  lid.position.set(0, 0, towerZ); glow.position.set(0, 0.02, towerZ);
  ui.sub(plan.map((_, i) => i < s ? '●' : i === s ? '◉' : '○').join(' '));
  ui.progress(doneRings / totalRings);
  if (level === 1 && s === 1 && !retry) setTimeout(() => state === 'play' && ui.pop('Let go when the wall comes!', '#fff', 26, 26), 900);
}
function buildLevel() {
  LV = LEVELS[level - 1] || genLevel(level);
  T = THEMES[worldOf(level) * 2 + (level % 2)];
  document.body.style.setProperty('--bg1', T.sky[0]); document.body.style.setProperty('--bg2', T.sky[1]); document.body.style.setProperty('--ui', T.ui);
  seaMat.color.set(T.sea); scene.fog.color.set(T.sky[1]); rockMat.color.set(T.rock); glow.material.color.set(T.a);
  hemi.groundColor.set(T.sea).lerp(new THREE.Color('#ffffff'), 0.6);
  plan = LV.stages.map(s => ({ ...s })); totalRings = plan.reduce((a, s) => a + s.r, 0); doneRings = 0; stageIdx = 0;
  par = parOf(plan);
  buildPier(plan.length); balls = []; cannonZ = 8; camZ = cannonZ;
  crashes = 0; stageCrashes = 0; assistUsed = false; levelTime = 0; fev = 0; feverT = 0; goldN = 0; grazeN = 0; nearMiss = 0; combo = 0;
  setupStage(0); ui.levels(level); ui.progress(0); score = 0; ui.score(0); fevUpdate(); chipUpdate();
}

// ------------------------------------------------------------------ HUD pieces
const chip = mk('rp-chip hc-hidden'), mapBtn = mk('rp-map hc-hidden', 'button'), fevEl = mk('rp-fev hc-hidden', 'div', '<i></i><span>FEVER</span>'), glowEl = mk('rp-glow'), comboEl = mk('rp-combo');
mapBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z" fill="#9fdcf0" stroke="#36405e" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 3v16M15 5v16" stroke="#36405e" stroke-width="1.6"/></svg>`;
function starsNow() {
  const fast = levelTime <= par; return crashes === 0 ? (fast ? 3 : 2) : crashes === 1 ? 2 : 1;
}
function chipUpdate() {
  const s = state === 'play' || state === 'travel' || state === 'lost' ? starsNow() : 3, left = Math.max(0, par - levelTime);
  chip.classList.toggle('late', left <= 0);
  chip.innerHTML = `<div class="s">${[1, 2, 3].map(i => starSvg(i <= s)).join('')}</div><b>${left > 0 ? Math.ceil(left) + 's' : 'slow'}</b>`;
}
function fevUpdate() { fevEl.querySelector('i').style.width = (feverT > 0 ? feverT / 4 : fev) * 100 + '%'; fevEl.classList.toggle('on', feverT > 0); fevEl.querySelector('span').textContent = feverT > 0 ? 'FEVER!' : 'FEVER'; glowEl.classList.toggle('on', feverT > 0); }
let lastChip = 0;
const _v = new THREE.Vector3();
function floaty(text, color, x, y, z, size = 22) {
  _v.set(x, y, z).project(camera); if (_v.z > 1) return;
  const d = mk('rp-fl', 'div', text); d.style.left = (_v.x * 0.5 + 0.5) * innerWidth + 'px'; d.style.top = (-_v.y * 0.5 + 0.5) * innerHeight + 'px';
  d.style.color = color; d.style.fontSize = size + 'px'; setTimeout(() => d.remove(), 850);
}
function comboShow() {
  comboEl.textContent = combo >= 4 ? 'x' + combo : ''; comboEl.style.opacity = combo >= 4 ? 1 : 0;
  comboEl.style.fontSize = Math.min(64, 28 + combo * 0.9) + 'px'; comboEl.style.color = combo >= 30 ? '#ffd23f' : combo >= 15 ? '#ff9ec0' : '#fff';
}

// ------------------------------------------------------------------ game flow
function removeRing(i, big = false) {
  const R = rings[i]; R.alive = false; removed++;
  const col = ringColor(i); shatter(R.y, col, big ? 14 : 9, big ? 1.2 : 1);
  doneRings++; const pts = feverT > 0 ? 2 : 1; score += pts; stat('rings');
  ui.score(score); ui.progress(doneRings / totalRings); drawCounter(rings.length - removed);
  fev = Math.min(1, fev + 1 / 40);
}
function startFever() {
  feverT = 4; fev = 1; stat('fever'); sfx.win(); ui.flash(0.45); ui.pop('FEVER!', '#fff', 54, 28); buzz([20, 30, 20, 30, 40]); punch = 0.12;
  [0, 4, 7, 12, 16].forEach((n, k) => setTimeout(() => note(72 + n, 0.2, 0.12), k * 55));
}
function hitTower() {
  const i = removed; if (i >= rings.length) return;
  const R = rings[i], px = 0, pz = towerZ + TR;
  towerSquash = 1; comboT = 0.6; combo++; glow.material.opacity = 0.75; punch = Math.min(0.06, punch + 0.012);
  if (R.kind === 2 && R.hp > 1) {                       // armored: the first hit only cracks it
    R.hp--; towerMesh.setColorAt(i, _c.set(CRACKED)); towerMesh.instanceColor.needsUpdate = true; shatter(R.y, '#aab3c2', 5, 0.6);
    tone(520, 0.07, 'square', 0.1, 0.5); tone(260, 0.1, 'sawtooth', 0.06, 0.6); buzz(14); floaty('CRACK', '#fff', px, 1.2, pz, 18); shake = Math.max(shake, 0.12); return;
  }
  const kind = R.kind; removeRing(i, kind === 3);
  const wasFever = feverT > 0;
  note(60 + [0, 2, 4, 7, 9, 12, 14, 16][combo % 8] + Math.floor(combo / 8) % 2 * 12, 0.18, 0.1); tone(140, 0.07, 'square', 0.05, 0.5); buzz(8);
  if (kind === 1) {
    score += 5; fev = Math.min(1, fev + 0.2); golds++; goldN++; save.set('golds', golds); stat('gold');
    sfx.coin(); setTimeout(() => tone(1568, 0.14, 'triangle', 0.1, 1), 90); confetti(scene, new THREE.Vector3(0, 1.2, pz), 26); floaty('+5 GOLD', '#ffe26a', px, 1.6, pz, 26); ui.score(score); punch += 0.02;
  } else if (kind === 3) {
    for (let k = 0; k < 3 && removed < rings.length; k++) removeRing(removed, true);
    score += 5; stat('bomb'); sfx.smash(); ui.flash(0.5); shake = 0.7; punch += 0.05; hitStop(0.07);
    burst(scene, new THREE.Vector3(0, 1.4, towerZ), ['#ff5d73', '#ffd23f', '#ffffff'], 30, { speed: 0.22, up: 0.18, size: 1, shape: 'sphere' });
    floaty('BOOM!', '#ff8a8a', px, 1.8, pz, 34); ui.score(score); buzz([30, 20, 50]);
  }
  if (combo > 0 && combo % 10 === 0) { ui.pop(combo >= 30 ? 'UNSTOPPABLE!' : combo >= 20 ? 'ON FIRE!' : 'COMBO x' + combo, T.ui, 36, 30); tone(660 + combo * 6, 0.2, 'triangle', 0.1, 1.6); }
  comboShow();
  if (!wasFever && fev >= 1 && removed < rings.length) startFever();
  if (removed >= rings.length) stageClear();
}
const hitStop = s => { stopT = Math.max(stopT, s); };
function stageClear() {
  sfx.coin(); confetti(scene, new THREE.Vector3(0, 1.5, towerZ), 80); ui.flash(0.35); buzz([30, 30, 30]); hitStop(0.08); slowT = 0.5; stat('tower');
  const last = stageIdx + 1 >= plan.length;
  ui.pop(!last ? 'TOWER DOWN!' : 'PERFECT!', T.ui, 44, 30);
  for (const g of guards) g.sink = true;
  for (const b of balls) if (!b.dead) { b.hit = true; burst(scene, new THREE.Vector3(b.x, b.y, b.z), '#ffffff', 2, { speed: 0.04, up: 0.04, size: 0.5, shape: 'sphere' }); }
  holding = false; stageCrashes = 0;
  if (!last) { stageIdx++; travel(); }
  else win();
}
function travel() { state = 'travel'; const si = stageIdx; setTimeout(() => { if (stageIdx === si) setupStage(si); }, 450); }
function win() {
  state = 'won'; F.level(true); const firstClear = !(stars[level - 1] > 0), st = starsNow(), old = stars[level - 1] || 0;
  const before = sumStars(); stars[level - 1] = Math.max(old, st); save.set('stars', stars);
  if (firstClear) WB.submit(1);
  stat('win'); lvlFails[level] = 0; if (crashes === 0) stat('flawless');
  const gain = sumStars() - before, newSkins = SKINS.map((s, i) => i).filter(i => SKINS[i].at > before && SKINS[i].at <= sumStars());
  setTimeout(sfx.win, 200); chip.classList.add('hc-hidden'); fevEl.classList.add('hc-hidden'); comboEl.style.opacity = 0; mapBtn.classList.add('hc-hidden');
  showWin(st, firstClear, gain, newSkins);
}
let forgave = false, assistUsed = false; const lvlFails = {};
function fail(g, b) {
  if (state !== 'play') return;
  if (level > 1 && !assistUsed && (lvlFails[level] || 0) >= 3) {   // third crash on a pier in a row: the next wall bump is forgiven once per try
    assistUsed = true; b.dead = true; b.vz = 7; b.vy = 6; b.vx = (Math.random() - 0.5) * 5; g.flash = 1; shake = 0.4; tone(200, 0.15, 'square', 0.08, 0.6);
    ui.pop('Saved!', '#fff', 30, 26); return;
  }
  if (level === 1 && !forgave) {                       // pier 1 can't be lost: the first wall bump only bounces the ball
    forgave = true; b.dead = true; b.vz = 7; b.vy = 6; b.vx = (Math.random() - 0.5) * 5; g.flash = 1; shake = 0.4; tone(200, 0.15, 'square', 0.08, 0.6);
    ui.pop('Walls bounce balls!', '#fff', 30, 26); return;
  }
  lvlFails[level] = (lvlFails[level] || 0) + 1; state = 'lost'; crashes++; stageCrashes++; F.level(false, doneRings / Math.max(1, totalRings)); holding = false; fev *= 0.4; feverT = 0; fevUpdate();
  b.vz = 9; b.vy = 7; b.vx = (Math.random() - 0.5) * 6; b.dead = true;
  g.flash = 1; shake = 0.9; ui.flash(0.4); sfx.fail(); buzz([60, 40, 90]); hitStop(0.06); comboEl.style.opacity = 0;
  burst(scene, new THREE.Vector3(0, 0.5, towerZ + OR), [T.ob, '#ffffff'], 16, { speed: 0.12, up: 0.12, size: 0.8 });
  chipUpdate();
  const left = rings.length - removed, S = plan[stageIdx], close = left <= Math.max(4, S.r * 0.25);
  const cause = g.mode === 'blink' ? 'The shutter shut on the ball' : g.gate ? 'The ball hit the gate ring' : 'The ball hit a wall';
  const tip = stageCrashes >= 2 ? 'Fire short bursts: let go as the wall comes round, hold again when it has passed.' : close ? `So close: ${left} ring${left > 1 ? 's' : ''} to go` : '';
  setTimeout(() => showLose(close ? `SO CLOSE · ${left} left` : `${left} rings left`, cause, tip), 380);
}
function retry() {
  if (state !== 'lost') return;
  loseEl.classList.add('hc-hidden'); doneRings = stageDone0; score = stageScore0; ui.score(score);
  balls = []; setupStage(stageIdx, true); state = 'play'; chipUpdate();
}
function restartLevel(n) { mapOpen = false; hideCards(); ui.els.sc.classList.remove('hc-hidden'); ui.els.sub.classList.remove('hc-hidden'); level = n; buildLevel(); state = 'play'; handShown = n > 1; handEl.classList.toggle('hc-hidden', handShown); chip.classList.remove('hc-hidden'); mapBtn.classList.remove('hc-hidden'); fevEl.classList.remove('hc-hidden'); }
function fire() {
  if (balls.length >= MAXB) return;
  balls.push({ x: 0, y: 0.34, z: cannonZ - 0.75, vx: 0, vy: 0, vz: -BALL_SPEED, dead: false, spin: 0, gm: 9 });
  cannonKick = 1; tone(300 + Math.random() * 40, 0.04, 'triangle', 0.05, 0.6);
  burst(scene, _v.set(0, 0.42, cannonZ - 0.8), '#ffffff', 1, { speed: 0.03, up: 0.02, size: 0.4, shape: 'sphere', life: 0.4 });
}

// ------------------------------------------------------------------ cards: home, lose, win, map
const handEl = mk('rp-hand hc-hidden', 'div', '<div>👆</div>HOLD');
const homeEl = mk('rp-card rp-home'), loseEl = mk('rp-card rp-lose hc-hidden'), winEl = mk('rp-card rp-win hc-hidden'), mapEl = mk('rp-card rp-mapv hc-hidden');
for (const e of [homeEl, loseEl, winEl, mapEl, mapBtn]) e.addEventListener('pointerdown', e2 => e2.stopPropagation());
function hideCards() { for (const e of [homeEl, loseEl, winEl, mapEl]) e.classList.add('hc-hidden'); }
function showHome() {
  const w = WORLDS[worldOf(level)], sk = SKINS[skin];
  const next = SKINS.findIndex((s, i) => !skinOpen(i));
  homeEl.innerHTML = `<h1>RING<br>PEEL</h1><div class="w">${w.icon} ${w.name} · pier ${level}</div>
    <div class="go"><div class="sk"><span style="width:18px;height:18px;border-radius:50%;background:${sk.c};display:inline-block"></span>${sumStars()} ${starSvg()}${next >= 0 ? ` · ${SKINS[next].at - sumStars()} more for ${SKINS[next].name} balls` : ''}</div>
    <button class="rp-btn big" data-a="play">PLAY</button><button class="rp-btn sm" data-a="map">PIERS</button></div>`;
  homeEl.classList.remove('hc-hidden'); ui.els.sc.classList.add('hc-hidden'); ui.els.sub.classList.add('hc-hidden'); mapBtn.classList.add('hc-hidden'); chip.classList.add('hc-hidden'); fevEl.classList.add('hc-hidden');
}
homeEl.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (a && a.dataset.a === 'map') { openMap(); return; }
  homeEl.classList.add('hc-hidden'); restartLevel(level);
});
function showLose(head, cause, tip) {
  loseEl.innerHTML = `<h2>OOPS!</h2><p>${head}</p><div class="tip">${cause}${tip ? '<br>' + tip : ''}</div><button class="rp-btn red big" data-a="retry">AGAIN</button>`;
  loseEl.classList.remove('hc-hidden');
}
loseEl.addEventListener('pointerdown', () => retry());
function showWin(st, first, gain, newSkins) {
  const w = WORLDS[worldOf(level)], nxt = SKINS.findIndex((s, i) => !skinOpen(i));
  const extra = [
    ...newSkins.map(i => `<div class="chip">New balls unlocked: ${SKINS[i].name}!</div>`),
    ...(nxt >= 0 && !newSkins.length ? [`<div class="chip">${SKINS[nxt].at - sumStars()} more ${starSvg().replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} → ${SKINS[nxt].name} balls</div>`] : []),
    ...(goldN ? [`<div class="chip">${goldN} gold ring${goldN > 1 ? 's' : ''} popped</div>`] : []),
  ].join('');
  const need = st < 3 ? (crashes ? 'No crash and under par for 3 stars' : `Under ${par}s for 3 stars`) : 'Flawless!';
  winEl.innerHTML = `<div class="sub">${w.icon} ${w.name} · pier ${level}</div><h1>${LV.hard ? 'BIG PIER<br>CLEARED!' : 'PIER<br>CLEARED!'}</h1>
    <div class="st">${[1, 2, 3].map(() => starSvg()).join('')}</div>
    <div class="ln">${levelTime.toFixed(0)}s · par ${par}s · ${crashes ? crashes + ' crash' + (crashes > 1 ? 'es' : '') : 'no crash'}${nearMiss ? ' · ' + nearMiss + ' close calls' : ''}</div>
    <div class="ln">${need}</div>${extra}
    <div class="row"><button class="rp-btn sm" data-a="map">PIERS</button><button class="rp-btn big" data-a="next" style="font-size:26px;padding:14px 34px;white-space:nowrap">NEXT</button><button class="rp-btn sm" data-a="again">AGAIN</button></div>`;
  const svgs = winEl.querySelectorAll('.st svg'); svgs.forEach(s => { s.classList.remove('on'); });
  setTimeout(() => { winEl.classList.remove('hc-hidden'); svgs.forEach((s, i) => { if (i < st) setTimeout(() => { s.classList.add('on'); note(72 + i * 4, 0.3, 0.14); }, 300 + i * 380); }); }, 700);
}
winEl.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  if (a.dataset.a === 'map') openMap(); else restartLevel(a.dataset.a === 'next' ? level + 1 : level);
});
function openMap() {
  mapOpen = true;
  const open = unlockedLv(), tot = sumStars(), nx = SKINS.findIndex((s, i) => !skinOpen(i));
  let h = `<h2>Ring Peel piers</h2><div class="tot">${starSvg().replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} ${tot}${nx >= 0 ? ` · ${SKINS[nx].at} for ${SKINS[nx].name} balls` : ' · all balls unlocked'}</div>`;
  h += `<div class="rp-skins">${SKINS.map((s, i) => `<button class="rp-skin ${skinOpen(i) ? '' : 'lock'} ${skin === i ? 'on' : ''}" data-s="${i}"><b style="background:${s.c}"></b>${skinOpen(i) ? s.name : s.at + '★'}</button>`).join('')}</div>`;
  h += `<div class="wn">Today's goals</div><div class="goals">${daily.goals.map(g => { const G = GOALS.find(x => x.id === g.id), p = Math.min(1, g.v / G.n); return `<div class="rp-goal"><i style="width:${p * 100}%"></i><span>${G.t(G.n)} · ${g.done ? 'done +1' : Math.min(g.v, G.n) + '/' + G.n}</span></div>`; }).join('')}</div>`;
  for (let w = 0; w < 3; w++) {
    h += `<div class="wn">${WORLDS[w].icon} ${WORLDS[w].name}<small>${WORLDS[w].blurb}</small></div><div class="grid">`;
    for (let i = 1; i <= 10; i++) {
      const n = w * 10 + i, s = stars[n - 1] || 0, lock = n > open, cls = [lock ? 'lock' : '', n === open ? 'next' : '', s ? 'done' : '', LEVELS[n - 1].hard ? 'hard' : ''].join(' ');
      h += `<button class="rp-node ${cls}" data-n="${n}">${n}<div class="ss">${[1, 2, 3].map(k => starSvg(k <= s)).join('')}</div></button>`;
    }
    h += '</div>';
  }
  h += `<div class="wn">∞ Endless docks<small>after pier 30</small></div><button class="rp-node ${open > 30 ? 'next' : 'lock'}" data-n="${Math.max(31, open)}" style="width:80px">31+</button><button class="rp-btn sm" data-a="close" style="margin-top:8px">Back</button>`;
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden');
  const nxe = mapEl.querySelector('.next'); if (nxe) setTimeout(() => nxe.scrollIntoView({ block: 'center' }), 30);
}
mapEl.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.s !== undefined) { const i = +t.dataset.s; if (skinOpen(i)) { setSkin(i); sfx.tap(); openMap(); } return; }
  if (t.dataset.a === 'close') { mapEl.classList.add('hc-hidden'); mapOpen = false; if (state === 'home') showHome(); else if (state === 'won') winEl.classList.remove('hc-hidden'); else if (state === 'play' || state === 'travel' || state === 'lost') { /* resume */ } return; }
  if (t.dataset.n && !t.classList.contains('lock')) { homeEl.classList.add('hc-hidden'); mapOpen = false; restartLevel(+t.dataset.n); }
});
mapBtn.addEventListener('click', () => { holding = false; openMap(); });
mapBtn.addEventListener('pointerup', e => e.stopPropagation());

input({ onDown: () => { if (state === 'play') { holding = true; handEl.classList.add('hc-hidden'); handShown = true; if (fireT <= 0) { fire(); fireT = fireGap(); } } }, onUp: () => { holding = false; } });
const fireGap = () => feverT > 0 ? FIRE_DT * 0.55 : FIRE_DT;
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on pier 1, until the first touch,
// the cannon fires a few balls through the gaps and peels a few rings
const DM = demo(null, { ready: () => state === 'play' && level === 1 && stageIdx === 0 && !holding, wait: 1500, ms: 3500 });
const dzNow = () => cannonZ - 0.75 - towerZ;

// ------------------------------------------------------------------ loop
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const camPos = new THREE.Vector3(0, 8, 16), camAt = new THREE.Vector3();
loop((d) => {
  let dt = mapOpen ? 0 : d / 60;
  if (stopT > 0) { stopT -= dt; dt = 0; }
  if (slowT > 0) { slowT -= dt; timeScale = 0.35; } else timeScale = lerp(timeScale, 1, 0.2);
  dt *= timeScale;
  const live = state === 'play' || state === 'travel';
  if (state === 'play' || state === 'home' || state === 'travel') gt += dt;
  if (state === 'play') { levelTime += dt; if (levelTime - lastChip > 0.5) { lastChip = levelTime; chipUpdate(); } }
  // fever
  if (feverT > 0) { feverT -= dt; if (feverT <= 0) { feverT = 0; fev = 0; ui.pop('nice!', '#fff', 30, 30); } fevUpdate(); }
  else if (state === 'play' && fev > 0) { fevEl.querySelector('i').style.width = fev * 100 + '%'; }
  // fire stream
  fireT -= dt;
  if (holding && state === 'play' && fireT <= 0) { fire(); fireT = fireGap(); }
  if (DM.on && !holding && state === 'play' && fireT <= 0 && removed + 6 < rings.length && safeShot(guards, gt, dzNow())) { fire(); fireT = FIRE_DT * 4; }
  comboT -= dt; if (comboT <= 0 && combo) { combo = 0; comboShow(); }

  // travel to next platform
  if (state === 'travel') {
    const target = -stageIdx * SPACING + 8; cannonZ = lerp(cannonZ, target, 1 - Math.pow(0.03, dt));
    if (Math.abs(cannonZ - target) < 0.05) { cannonZ = target; state = 'play'; }
  }
  cannonKick = Math.max(0, cannonKick - dt * 9);
  cannon.position.set(0, 0, cannonZ + cannonKick * 0.12); cannon.scale.setScalar(0.82);
  cannon.body.scale.set(1 + cannonKick * 0.06, 1 - cannonKick * 0.1, 1 + cannonKick * 0.06);
  cannon.top.position.y = 0.95 - cannonKick * 0.08;
  cMat.emissive.set(feverT > 0 ? '#ff2d7a' : '#000000'); cMat.emissiveIntensity = feverT > 0 ? 0.5 : 0;

  // guards
  for (const g of guards) {
    g.rise = g.sink ? Math.max(0, g.rise - dt * 2) : Math.min(1, g.rise + dt * 3);
    g.m.position.y = -0.62 + g.rise * 0.62 - (1 - g.rise) * 0.2; g.m.visible = g.rise > 0.01;
    if (state !== 'lost') g.m.rotation.y = guardAngle(g, gt);
    const mt = g.m.material;
    let op = 1;
    if (g.mode === 'blink') {
      const on = solid(g, gt), soon = untilSolid(g, gt);
      op = on ? 1 : 0.14; mt.emissive.setRGB(!on && soon < 0.5 ? 0.5 + 0.5 * Math.sin(gt * 40) : 0, 0, 0);
    } else if (g.flash) { g.flash = Math.max(0, g.flash - dt * 1.2); mt.emissive.setRGB(g.flash * 0.9, g.flash * 0.15, g.flash * 0.15); }
    if (feverT > 0) op = Math.min(op, 0.3);
    mt.opacity = lerp(mt.opacity, op, 0.35); mt.depthWrite = mt.opacity > 0.9;
  }

  // balls
  let bi = 0;
  const ghost = feverT > 0;
  for (const b of balls) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.spin += dt * 30;
    if (b.dead) b.vy -= 22 * dt;
    else {
      const rel = b.z - towerZ;
      if (rel < OR + 0.4 && rel > OR - 0.4) {              // guard wall band
        const g = !ghost && blocked(guards, gt); if (g && state === 'play') fail(g, b);
        else if (!ghost) b.gm = Math.min(b.gm, room(guards, gt));
      } else if (rel <= OR - 0.4 && b.gm < 9 && !b.gz) {   // came through: how close was it?
        b.gz = true;
        if (b.gm < 0.1 && state === 'play') {
          score += 3; nearMiss++; grazeN++; fev = Math.min(1, fev + 0.08); stat('graze'); ui.score(score);
          floaty('CLOSE! +3', '#fff', 0, 0.9, towerZ + OR, 20); tone(1200 + Math.min(8, nearMiss) * 60, 0.08, 'triangle', 0.1, 1.3); buzz(10);
          burst(scene, _v.set(0, 0.5, towerZ + OR), '#ffffff', 5, { speed: 0.06, up: 0.05, size: 0.5, shape: 'sphere', life: 0.6 });
        }
      }
      if (rel <= TR + 0.15 && state === 'play' && removed < rings.length) {
        b.hit = true; b.dead = true; hitTower();
        burst(scene, new THREE.Vector3(0, 0.5, towerZ + TR), '#ffffff', 3, { speed: 0.05, up: 0.04, size: 0.5, shape: 'sphere' });
      } else if (rel <= TR + 0.15) { b.dead = true; b.vz = 4; b.vy = 4; }
    }
    if (b.y < -3 || b.hit || b.z > cannonZ + 20) { b.gone = true; continue; }
    _p.set(b.x, b.y, b.z); _e.set(b.spin, 0, 0); _q.setFromEuler(_e); _s.setScalar(1); _m.compose(_p, _q, _s); ballMesh.setMatrixAt(bi++, _m);
  }
  balls = balls.filter(b => !b.gone); ballMesh.count = bi; ballMesh.instanceMatrix.needsUpdate = true;

  // tower: rings drop into place, squash on hit
  towerSquash = Math.max(0, towerSquash - dt * 7);
  if (towerMesh) {
    let top = 0;
    for (let i = 0; i < rings.length; i++) {
      const R = rings[i];
      if (!R.alive) { _s.setScalar(0); _m.compose(_p.set(0, -50, 0), _q.identity(), _s); towerMesh.setMatrixAt(i, _m); continue; }
      const ty = (i - removed) * RH; R.y = lerp(R.y, ty, 1 - Math.pow(0.0005, dt));
      const sq = i === removed ? towerSquash : towerSquash * 0.4;
      _s.set(1 + sq * 0.08, 1 - sq * 0.12, 1 + sq * 0.08); _q.setFromAxisAngle(_p.set(0, 1, 0), i * twist + (towerShape === 48 ? 0 : 0.3));
      _m.compose(_p.set(0, R.y * (1 - towerSquash * 0.04), towerZ), _q, _s); towerMesh.setMatrixAt(i, _m); top = R.y + RH;
    }
    towerMesh.instanceMatrix.needsUpdate = true;
    lid.position.y = top + 0.003; lid.visible = removed < rings.length; lid.rotation.z = (rings.length - 1) * twist + (towerShape === 48 ? 0 : 0.3);
  }
  glow.material.opacity = Math.max(0, glow.material.opacity - dt * 2.2); glow.scale.setScalar(1 + (0.75 - glow.material.opacity) * 0.1);

  // shards
  for (let i = 0; i < SHN; i++) {
    const s = shards[i];
    if (s.life <= 0) { _s.setScalar(0); _m.compose(_p.set(0, -50, 0), _q.identity(), _s); shardMesh.setMatrixAt(i, _m); continue; }
    s.life -= dt; s.v.y -= 20 * dt; s.p.addScaledVector(s.v, dt); s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
    if (s.p.y < -1.4) { s.p.y = -1.4; s.v.multiplyScalar(0.3); s.life = Math.min(s.life, 0.3); }
    _q.setFromEuler(s.r); _s.setScalar(s.s * Math.min(1, s.life * 3)); _m.compose(s.p, _q, _s); shardMesh.setMatrixAt(i, _m);
  }
  shardMesh.instanceMatrix.needsUpdate = true;

  // camera: behind the cannon, looking up the pier at the tower; hits punch it in, fever widens it
  const rd = d / 60;
  camZ = lerp(camZ, cannonZ, 1 - Math.pow(0.02, rd));
  const tp = new THREE.Vector3(0, 8, camZ + 13.5), ta = new THREE.Vector3(0, 0, camZ - 9);
  if (state === 'home') tp.x += Math.sin(gt * 0.6) * 0.5;
  camPos.lerp(tp, 1 - Math.pow(0.01, rd)); camAt.lerp(ta, 1 - Math.pow(0.01, rd));
  shake = Math.max(0, shake - rd * 2); punch = Math.max(0, punch - rd * 0.5);
  const zoom = 1 + punch + (feverT > 0 ? 0.05 : 0); if (Math.abs(camera.zoom - zoom) > 0.002) { camera.zoom = zoom; camera.updateProjectionMatrix(); }
  camera.position.copy(camPos).add(_p.set((Math.random() - 0.5) * shake * 0.4, (Math.random() - 0.5) * shake * 0.4, 0));
  camera.lookAt(camAt);
  stage.followLight(new THREE.Vector3(0, 0, camZ - 6));
  sea.position.z = camZ - 40;
});

setSkin(skinOpen(skin) ? skin : 0);
buildLevel(); camPos.set(0, 8, camZ + 13.5); camAt.set(0, 0, camZ - 9);
if (/[?&]level=/.test(location.search)) { homeEl.classList.add('hc-hidden'); restartLevel(level); } else showHome();

// ------------------------------------------------------------------ test hooks
window.__game = {
  get state() { return state === 'travel' ? 'play' : state; }, get level() { return level; }, get score() { return score; }, get stars() { return stars; }, get crashes() { return crashes; },
  get time() { return levelTime; }, get par() { return par; }, get fever() { return feverT > 0; }, get lastStars() { return starsNow(); },
  load(n) { homeEl.classList.add('hc-hidden'); restartLevel(n); }, openMap, retry, hit: () => balls.length,
  bot() {
    const ev = type => dispatchEvent(new PointerEvent(type, { clientX: 195, clientY: 600, pointerId: 1, bubbles: true }));
    if (state === 'lost') { retry(); return; }
    if (state !== 'play') { if (holding) ev('pointerup'); return; }
    // fire only if every ball shot in the next ~0.2 s crosses the guard ring while the path is clear (fever: walls are ghosts)
    const safe = feverT > 0 || safeShot(guards, gt, dzNow());
    if (safe && !holding) ev('pointerdown');
    else if (!safe && holding) ev('pointerup');
  },
};

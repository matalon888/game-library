// Core Crusher v2 — same tower smasher (hold = smash down, release = bounce, black shatters you unless you burn), now with 30 authored
// towers in 3 worlds, new slice kinds (gold, flame, holes, blinkers, steel), stars, a level map, chests that unlock ball skins and
// daily goals. Physics numbers are v1's. Design notes: DESIGN.md. Authored levels: levels.js. The step() is separate from drawing so
// qa/playall.cjs can fast-forward every level with the bot (window.__game.fast).
import { THREE, createStage, createUI, store, loop, input, buzz, tone, note, burst, confetti, rng, lerp, clamp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board as worldBoard } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS, genLevel } from './levels.js';
import { PARS } from './pars.js';

const SEG = 12, SEGA = Math.PI * 2 / SEG, GAP = 0.3, THICK = 0.25, R_OUT = 2.0, R_IN = 0.42, BALL_R = 0.3, BALL_D = 1.3;
const GRAV = 0.0125, BOUNCE = 0.165, SMASH = 0.11;
const SAFE = 0, DARK = 1, GOLD = 2, FLAME = 3, STEEL = 4, HOLE = 5, BLINK = 6;
const KCOL = { [DARK]: '#1b1b24', [GOLD]: '#ffc400', [FLAME]: '#ff7a00', [STEEL]: '#aebbd6' };
const BLINK_T = 1.6, BLINK_WARN = 0.8, BLINK_ON = 1.05;
const THEMES = [
  { bg: ['#1fc7b6', '#c9fff1'], ring: '#2f6bff', ball: '#ff3048', ui: '#e8203a' },
  { bg: ['#ff6b3d', '#ffd36e'], ring: '#a23dff', ball: '#1e8bff', ui: '#1e7bff' },
  { bg: ['#7a4cf0', '#f1b6ff'], ring: '#3fdc5a', ball: '#1f8fff', ui: '#1f8fff' },
  { bg: ['#ff5c9a', '#ffd5e5'], ring: '#18b9ff', ball: '#ffd21a', ui: '#18a0ff' },
  { bg: ['#36a8ff', '#dff4ff'], ring: '#ff2d8f', ball: '#ffd21a', ui: '#ff2d8f' },
  { bg: ['#ffb02e', '#fff1b8'], ring: '#8a2be2', ball: '#ff3048', ui: '#8a2be2' },
];
const SKINS = [
  { n: 'Auto', c: null }, { n: 'Cherry', c: '#ff2d4d' }, { n: 'Blueberry', c: '#2d6bff' }, { n: 'Lime', c: '#7ae61a' },
  { n: 'Grape', c: '#9a3dff' }, { n: 'Mango', c: '#ffa51f' }, { n: 'Bubblegum', c: '#ff7ac8' }, { n: 'Snow', c: '#f4f8ff' },
  { n: 'Gold', c: '#ffcf2a', gold: 1 }, { n: 'Mint', c: '#2fe6c0' }, { n: 'Lava', c: '#ff4a00', glow: 1 }, { n: 'Disco', c: '#ffffff', disco: 1 },
];
const CHEST_FIRST = 3, CHEST_BASE = 6;
let CHEST_AT = 6; // first chest opens early (3 stars), later ones 6
const syncChest = () => { CHEST_AT = owned.length <= 1 ? CHEST_FIRST : CHEST_BASE; };

const S = store('corecrusher2');
const F = flow('corecrusher');
const WB = worldBoard({ game: 'core-crusher', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.25 }, mode: 'sum' });
const NL = LEVELS.length;
let reach = clamp(S.get('reach', 1), 1, 9999), level = reach, best = S.get('best', 0);
let stars = S.get('stars', []), chest = S.get('chest', 0), owned = S.get('owned', [0]), skin = S.get('skin', 0);
let fresh = S.get('played', 0) === 0 && reach === 1;

const stage = createStage({ fov: 46, shadowSize: 4 });
const { scene, camera, sun } = stage;
stage.hemi.intensity = 1.05; sun.intensity = 1.55;
const ui = createUI({ title: 'CORE<br>CRUSHER', hint: '', hand: '' });
ui.hideStart();

// ---------------------------------------------------------------- level data
const levelDef = (n) => n <= NL ? LEVELS[n - 1] : genLevel(n);
const worldOf = (n) => Math.min(WORLDS.length - 1, Math.floor((n - 1) / 10));
const PATS = (() => {
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const C = (...parts) => () => { const a = new Array(SEG).fill(SAFE); for (const [k, idx] of parts) idx.forEach(i => a[i % SEG] = k); return a; };
  return {
    open: C(), one: C([DARK, [0]]), two: C([DARK, [0, 1]]), three: C([DARK, [0, 1, 2]]), half: C([DARK, [0, 1, 2, 3, 4, 5]]),
    wide: C([DARK, [0, 1, 2, 3, 4, 5, 6, 7]]), split: C([DARK, [0, 1, 2, 6, 7, 8]]), tri: C([DARK, [0, 1, 4, 5, 8, 9]]), pick: C([DARK, [0, 3, 6, 9]]),
    gold: C([GOLD, all]), goldone: C([GOLD, all], [DARK, [0]]), gap: C([HOLE, [0, 1, 2]]), gapx: C([HOLE, [0, 1]], [DARK, [2, 3, 4, 5, 6]]),
    flame: C([FLAME, [0]]), steel: C([STEEL, [0, 1]], [DARK, [2]]), steels: C([STEEL, [0, 1, 2, 3]], [DARK, [4, 5]]),
    blink: C([BLINK, [0, 1, 2, 3]]), blinkb: C([BLINK, [0, 1, 2, 3, 4, 5]], [DARK, [8]]),
  };
})();
function makeRings(def, lvNo) {
  const r = rng(lvNo * 7717 + 3), out = [];
  let secs = def.sec.trim().split(/\s+/).map(t => { const m = /^([a-z]+)(\d+)(?:@(.+))?$/.exec(t); return { pat: m[1], n: +m[2], tw: m[3] || '' }; });
  const rep = def.rep || (def.boss ? 4 : 3), head = secs.slice(0, 1), body = secs.slice(1);       // the body repeats (new angles each time): a round is 30-60 s
  secs = head.concat(...Array.from({ length: rep }, () => body));
  let twist = 0, y = 0;
  for (const sc of secs) {
    twist += r() * Math.PI * 2;
    const sg = r() < 0.5 ? 1 : -1;
    const step = sc.tw === '0' ? 0 : sc.tw === 's' ? 0.05 * sg : sc.tw === 'f' ? 0.28 * sg : sc.tw === '-' ? -0.12 * sg : (0.06 + r() * 0.16) * sg;
    for (let k = 0; k < sc.n; k++) { twist += step; out.push({ y, rot: twist, kinds: PATS[sc.pat](), alive: true, pat: sc.pat }); y -= GAP; }
  }
  return out;
}
const parOf = (n) => PARS[n - 1] || Math.round(levelDef(n).sec.split(/\s+/).reduce((a, t) => a + (+(/\d+/.exec(t) || [0])[0]), 0) * 0.5 + 8);

// ---------------------------------------------------------------- 3D
function sliceGeo(style) {
  const s = new THREE.Shape(), n = 14, pad = 0.006;
  const rOut = (a) => { const u = a / SEGA;
    if (style === 1) return R_OUT * (0.9 + 0.13 * Math.sin(u * Math.PI));
    if (style === 2) return R_OUT * (u < 0.5 ? 0.92 + u * 0.24 : 1.16 - (u - 0.5) * 0.48);
    return R_OUT; };
  for (let k = 0; k <= n; k++) { const a = pad + (SEGA - 2 * pad) * k / n, r = rOut(a); k ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  for (let k = n; k >= 0; k--) { const a = pad + (SEGA - 2 * pad) * k / n; s.lineTo(Math.cos(a) * R_IN, Math.sin(a) * R_IN); }
  const g = new THREE.ExtrudeGeometry(s, { depth: THICK - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, -THICK + 0.03, 0);
  return g;
}
const SLICES = [sliceGeo(0), sliceGeo(1), sliceGeo(2)];
const tower = new THREE.Group(); scene.add(tower);
const mainMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0.05 });
const blinkMat = new THREE.MeshStandardMaterial({ color: '#b36bff', roughness: 0.35, emissive: '#000000' });
const poleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.12 });
const pole = new THREE.Mesh(new THREE.CylinderGeometry(R_IN, R_IN, 1, 32), poleMat); tower.add(pole);
let mainI, blinkI;
const checkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1d1d24' : '#ffffff'; g.fillRect(x * 32, y * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const finish = new THREE.Group();
const finTop = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT + 0.25, R_OUT + 0.25, 0.3, 48), [new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: '#ffffff' })]);
finTop.position.y = -0.15; finTop.receiveShadow = true; finish.add(finTop); tower.add(finish);
const ballMat = new THREE.MeshStandardMaterial({ color: '#ff3048', roughness: 0.2, metalness: 0.1, emissive: '#000000' });
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), ballMat); ball.castShadow = true; scene.add(ball);
const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
const trail = new THREE.Mesh(new THREE.CylinderGeometry(BALL_R * 0.95, BALL_R * 0.25, 1, 20, 1, true).translate(0, 0.5, 0), trailMat); scene.add(trail);
const splatGeo = new THREE.CircleGeometry(0.3, 16).rotateX(-Math.PI / 2);
const splats = [], debris = [];
for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(SLICES[0], new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.45 })); m.visible = false; scene.add(m); debris.push({ m, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() }); }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), _c = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// ---------------------------------------------------------------- HUD, overlays
const css = document.createElement('style'); css.textContent = `
.cc-meter{position:fixed;right:18px;top:50%;width:14px;height:150px;margin-top:-75px;border-radius:10px;background:rgba(255,255,255,.45);overflow:hidden;z-index:5;pointer-events:none;transition:opacity .25s;opacity:0;box-shadow:0 3px 0 rgba(0,0,0,.12)}
.cc-meter i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,#ffd23f,#ff7a1a 60%,#ff2d2d);border-radius:10px}
.cc-meter b{position:absolute;left:50%;top:-30px;transform:translateX(-50%);font-size:20px;opacity:0}
.cc-meter.fire{overflow:visible;box-shadow:0 0 18px #ff7a1a}.cc-meter.fire b{opacity:1;top:-28px}.cc-meter.fire i{animation:ccpulse .3s ease-in-out infinite alternate}
@keyframes ccpulse{to{filter:brightness(1.4)}}
body .hc-card h1{text-shadow:0 6px 0 rgba(0,0,0,.18)}
.cc-speed{position:fixed;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity .2s;background:repeating-linear-gradient(90deg,transparent 0 22px,rgba(255,255,255,.28) 22px 24px,transparent 24px 61px,rgba(255,255,255,.2) 61px 62px,transparent 62px 97px);-webkit-mask-image:radial-gradient(ellipse at 50% 55%,transparent 30%,#000 85%);mask-image:radial-gradient(ellipse at 50% 55%,transparent 30%,#000 85%);animation:ccspd .18s linear infinite;animation-play-state:paused;visibility:hidden}
.cc-speed.on{animation-play-state:running;visibility:visible}
.cc-speed.fire{background-color:rgba(255,120,0,.12)}
@keyframes ccspd{to{background-position:0 90px}}
.cc-btn{position:fixed;z-index:6;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 0 rgba(0,0,0,.14)}
.cc-hint{position:fixed;left:0;right:0;bottom:calc(14% + env(safe-area-inset-bottom));text-align:center;z-index:5;pointer-events:none;font:800 22px 'Baloo 2',system-ui,sans-serif;color:#fff;-webkit-text-stroke:5px rgba(0,0,0,.35);paint-order:stroke fill;transition:opacity .4s}
.cc-chip{position:fixed;z-index:5;left:0;right:0;top:calc(128px + env(safe-area-inset-top));text-align:center;pointer-events:none;font:800 13px 'Baloo 2',system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.cc-toast{position:fixed;left:50%;top:calc(130px + env(safe-area-inset-top));transform:translateX(-50%);z-index:9;background:#1c1c28;color:#ffd23f;font:800 15px 'Baloo 2',system-ui,sans-serif;padding:8px 16px;border-radius:20px;pointer-events:none;box-shadow:0 4px 0 rgba(0,0,0,.25);animation:cctoast 2.4s forwards;white-space:nowrap}
@keyframes cctoast{0%{opacity:0;transform:translate(-50%,-12px)}10%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}
.cc-layer{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(20,16,40,.45);font-family:'Baloo 2',system-ui,sans-serif;color:#fff;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.cc-layer.hc-hidden{display:none}
.cc-card{width:min(92vw,380px);max-height:92vh;overflow:auto;text-align:center;padding:14px 16px 16px;animation:ccpop .28s cubic-bezier(.2,1.4,.4,1)}
@keyframes ccpop{from{transform:scale(.8);opacity:0}}
.cc-card h1{margin:0;font-size:40px;line-height:1;text-shadow:0 5px 0 rgba(0,0,0,.25);letter-spacing:1px}
.cc-card h2{margin:6px 0 0;font-size:18px;opacity:.95;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.cc-card p{margin:4px 0;font-size:16px;text-shadow:0 2px 0 rgba(0,0,0,.25)}
.cc-go{display:block;margin:14px auto 6px;min-width:220px;padding:12px 26px;border-radius:30px;background:var(--ui,#e8203a);color:#fff;font:800 28px 'Baloo 2',system-ui,sans-serif;box-shadow:0 6px 0 rgba(0,0,0,.28);animation:ccbeat .9s ease-in-out infinite alternate;border:0}
@keyframes ccbeat{to{transform:scale(1.06)}}
.cc-row{display:flex;justify-content:center;gap:10px;margin-top:10px;flex-wrap:wrap}
.cc-sm{padding:8px 14px;border-radius:22px;background:rgba(255,255,255,.88);color:#2b2540;font:800 15px 'Baloo 2',system-ui,sans-serif;box-shadow:0 3px 0 rgba(0,0,0,.2);position:relative;display:inline-flex;align-items:center;gap:5px}
.cc-sm.on{outline:3px solid #ffd23f}
.cc-sm i{position:absolute;top:-6px;right:-4px;background:#ff3048;color:#fff;font-style:normal;font-size:11px;padding:1px 6px;border-radius:9px}
.cc-stars{display:flex;justify-content:center;gap:6px;margin:8px 0}
.cc-stars svg{filter:drop-shadow(0 3px 0 rgba(0,0,0,.25))}
.cc-stars svg.pop{animation:ccstar .5s cubic-bezier(.2,1.6,.4,1) backwards}
@keyframes ccstar{from{transform:scale(0) rotate(-90deg)}}
.cc-bar{height:14px;border-radius:8px;background:rgba(0,0,0,.28);overflow:hidden;margin:6px auto;width:230px}
.cc-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff8a1f)}
.cc-map{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}
.cc-node{aspect-ratio:1;border-radius:14px;background:rgba(255,255,255,.9);color:#2b2540;font:800 20px 'Baloo 2',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 0 rgba(0,0,0,.2);position:relative;line-height:1}
.cc-node.lock{opacity:.45;background:rgba(255,255,255,.55)}
.cc-node.cur{background:#ffd23f;animation:ccbeat .7s ease-in-out infinite alternate}
.cc-node.boss{background:#ffb3bd}.cc-node.boss.cur{background:#ff6b7b;color:#fff}
.cc-node em{font-style:normal;font-size:9px;letter-spacing:.5px;color:#d12a3f;position:absolute;top:2px}
.cc-node span{display:flex;margin-top:2px}
.cc-tabs{display:flex;gap:6px;justify-content:center;margin-top:8px}
.cc-tabs .cc-sm{opacity:.6}.cc-tabs .cc-sm.on{opacity:1}
.cc-skins{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
.cc-skin{border-radius:14px;background:rgba(255,255,255,.2);padding:8px 2px;font-size:11px;font-weight:800}
.cc-skin.on{outline:3px solid #ffd23f;background:rgba(255,255,255,.35)}
.cc-skin b{display:block;width:34px;height:34px;border-radius:50%;margin:0 auto 4px;box-shadow:inset -4px -5px 0 rgba(0,0,0,.2),0 3px 0 rgba(0,0,0,.2)}
.cc-skin.lock b{background:#4b4566!important;box-shadow:none}
.cc-chest{font-size:84px;line-height:1;animation:ccshake .5s infinite}
@keyframes ccshake{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) scale(1.08)}}
.cc-goal{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.18);border-radius:12px;padding:6px 12px;margin:6px 0;font-size:15px;font-weight:800}
.cc-goal.done{background:rgba(80,220,120,.4)}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const meter = H('<div class="cc-meter"><i></i><b>🔥</b></div>'), meterFill = meter.querySelector('i');
const speedFx = H('<div class="cc-speed"></div>');
const hintEl = H('<div class="cc-hint"></div>'), chipEl = H('<div class="cc-chip"></div>');
const layer = H('<div class="cc-layer hc-hidden"></div>');
const mapBtn = H('<div class="cc-btn" style="left:10px;bottom:calc(14px + env(safe-area-inset-bottom))"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" stroke="#2b2540" stroke-width="3" stroke-linecap="round"/></svg></div>');
mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play' || state === 'home') showMap(); });
const STAR = (on, s = 22, cls = '') => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 5 1.8 7.4L12 18l-6.6 4 1.8-7.4-5.7-5L9 9z" fill="${on ? '#ffd23f' : 'rgba(0,0,0,.28)'}" stroke="${on ? '#b8860b' : 'rgba(0,0,0,.2)'}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const starsRow = (n, s = 38, anim = false) => `<div class="cc-stars">${[1, 2, 3].map(i => STAR(i <= n, s, anim && i <= n ? 'pop" style="animation-delay:' + (0.25 + i * 0.22) + 's' : '')).join('')}</div>`;
const toast = (t) => { const e = H(`<div class="cc-toast">${t}</div>`); setTimeout(() => e.remove(), 2500); };
const show = (html) => { layer.innerHTML = html; layer.classList.remove('hc-hidden'); };
const hide = () => { layer.classList.add('hc-hidden'); layer.innerHTML = ''; };
const layerOpen = () => !layer.classList.contains('hc-hidden');
const skinSwatch = (i) => { const k = SKINS[i]; return k.disco ? 'conic-gradient(#ff3048,#ffd21a,#3fdc5a,#18b9ff,#a23dff,#ff3048)' : k.c ? k.c : THEMES[0].ball; };

// ---------------------------------------------------------------- daily goals
const GOALS = [
  { id: 'rings', t: n => `Smash ${n} rings`, n: 150 }, { id: 'fire', t: n => `Catch fire ${n} times`, n: 2 }, { id: 'thread', t: n => `Fall through ${n} holes`, n: 5 },
  { id: 'clear', t: n => `Clear ${n} towers`, n: 3 }, { id: 'gold', t: n => `Smash ${n} gold rings`, n: 8 }, { id: 'combo', t: n => `Smash ${n} rings in one hold`, n: 25 },
];
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayNo = () => Math.floor(Date.now() / 86400000);
let daily = S.get('daily', null);
if (!daily || daily.day !== today()) {
  const r = rng(today()), pool = GOALS.slice(), g = [];
  while (g.length < 3) g.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  const prev = daily; const streak = prev && dayNo() - prev.dn === 1 ? (prev.streak || 0) : (prev && prev.dn === dayNo() ? prev.streak || 0 : 0);
  daily = { day: today(), dn: dayNo(), goals: g, prog: {}, done: [], dive: 0, streak };
  S.set('daily', daily);
}
function bump(id, n = 1, max) {
  if (!daily.goals.includes(id) || daily.done.includes(id)) return;
  const g = GOALS.find(x => x.id === id);
  daily.prog[id] = max ? Math.max(daily.prog[id] || 0, n) : (daily.prog[id] || 0) + n;
  if (daily.prog[id] >= g.n) { daily.done.push(id); toast('GOAL DONE · ' + g.t(g.n) + ' · +1 chest star'); addChest(1); tone(880, 0.2, 'sine', 0.12, 1.5); }
  S.set('daily', daily);
}
function addChest(n) { chest += n; S.set('chest', chest); }
const chestsLeft = () => { syncChest(); return owned.length < SKINS.length; };

// ---------------------------------------------------------------- game state
let state = 'home', lv = levelDef(1), theme, rings = [], top = 0, total = 0, score = 0, hold = false, by = 1, vy = 0, omega = 1, heat = 0, fire = false;
let camY = 0, style = 0, squash = 0, smashRun = 0, botTarget = -1, lt = 0, deadT = 0, finishY = 0, dir = 1, flipT = 0, rot = 0, runT = 0, started = false;
const lossRun = {};
let crashes = 0, mercy = 0, needRelease = false, stopT = 0, shake = 0, steelWarned = false, ignites = 0, golds = 0, threads = 0, closeCalls = 0, resultT = 0;
let dieAt = '', deathWhy = '', daily_mode = false, bestRun = 0, fovK = 0;
const isBlackNow = (t) => (t % BLINK_T) >= BLINK_ON;
const flashPhase = (t) => { const p = t % BLINK_T; return p >= BLINK_WARN && p < BLINK_ON; };
const kindCol = (k) => k === SAFE ? theme.ring : KCOL[k] || '#fff';

function applySkin() {
  const k = SKINS[skin] || SKINS[0];
  ballMat.color.set(k.c || theme.ball); ballMat.metalness = k.gold ? 0.85 : 0.1; ballMat.roughness = k.gold ? 0.25 : 0.2;
  ballMat.emissive.set(k.glow ? '#ff3a00' : '#000000'); ballMat.emissiveIntensity = k.glow ? 0.5 : 0;
}
function buildLevel(n, def) {
  level = n; lv = def || levelDef(n); theme = THEMES[(n - 1) % THEMES.length];
  const bs = document.body.style; bs.setProperty('--bg1', theme.bg[0]); bs.setProperty('--bg2', theme.bg[1]); bs.setProperty('--ui', theme.ui);
  applySkin(); trailMat.color.set('#ffffff');
  const fk = fast ? 1 : F.k();
  style = (n - 1) % 3;
  rings = makeRings(lv, n); total = rings.length;
  omega = lv.spin * fk * (rng(n * 31 + 7)() < 0.5 ? 1 : -1);
  if (mainI) { tower.remove(mainI, blinkI); mainI.dispose(); blinkI.dispose(); }
  mainI = new THREE.InstancedMesh(SLICES[style], mainMat, total * SEG); blinkI = new THREE.InstancedMesh(SLICES[style], blinkMat, total * SEG);
  for (const m of [mainI, blinkI]) { m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; tower.add(m); }
  rings.forEach((rg, i) => {
    for (let s = 0; s < SEG; s++) {
      const k = rg.kinds[s]; _m.compose(_p.set(0, rg.y, 0), _q.setFromAxisAngle(Y, rg.rot + s * SEGA), _s.set(1, 1, 1));
      const idx = i * SEG + s;
      if (k === HOLE) { mainI.setMatrixAt(idx, ZERO); blinkI.setMatrixAt(idx, ZERO); }
      else if (k === BLINK) { blinkI.setMatrixAt(idx, _m); mainI.setMatrixAt(idx, ZERO); }
      else { mainI.setMatrixAt(idx, _m); blinkI.setMatrixAt(idx, ZERO); }
      mainI.setColorAt(idx, _c.set(kindCol(k === BLINK || k === HOLE ? SAFE : k)));
    }
  });
  mainI.instanceMatrix.needsUpdate = true; blinkI.instanceMatrix.needsUpdate = true; mainI.instanceColor.needsUpdate = true;
  { let lb = -1; rings.forEach((rg, i) => rg.kinds.forEach((k, s) => { if (k === BLINK) lb = i * SEG + s; })); blinkI.count = lb + 1; blinkI.visible = lb >= 0; }
  finishY = -total * GAP - 0.25; finish.position.y = finishY;
  pole.scale.y = total * GAP + 8; pole.position.y = -total * GAP / 2 + 3.5;
  splats.forEach(s => s.parent && s.parent.remove(s)); splats.length = 0;
  debris.forEach(d => { d.m.visible = false; d.life = 0; });
  top = 0; score = 0; hold = false; by = 1.2; vy = 0; heat = 0; fire = false; smashRun = 0; botTarget = -1; dir = 1; flipT = 0; rot = 0; lt = 0; runT = 0; started = false;
  mercy = (lv.mercy || 0) + (fast ? 0 : Math.min(2, (lossRun[level] || 0) >> 1)); needRelease = false; steelWarned = false; ignites = golds = threads = closeCalls = 0; bestRun = 0; stopT = 0; deathWhy = '';
  tower.rotation.y = 0; camY = 0; ball.visible = true; ball.scale.setScalar(1);
  ui.levels(n); ui.progress(0); ui.score(0); ui.sub(best ? 'BEST ' + best : '');
  setFire(false);
  chipEl.textContent = (daily_mode ? 'DAILY DIVE' : lv.boss ? 'BOSS · ' + lv.n : n <= NL ? WORLDS[worldOf(n)].name + ' · ' + lv.n : lv.n) + (daily_mode ? '' : '');
  hintEl.style.opacity = n === 1 && fresh ? 1 : 0; hintEl.textContent = n === 1 ? 'HOLD to smash · LET GO at black' : '';
}
const topY = () => top < total ? rings[top].y : finishY;
function sliceAt(i, r) { let a = (Math.PI * 1.5 - r - rings[i].rot) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return Math.floor(a / SEGA) % SEG; }
function setFire(on) {
  fire = on; meter.classList.toggle('fire', on); speedFx.classList.toggle('fire', on);
  const k = SKINS[skin] || SKINS[0];
  ballMat.emissive.set(on ? '#ff5a00' : k.glow ? '#ff3a00' : '#000000'); ballMat.emissiveIntensity = on ? 0.9 : k.glow ? 0.5 : 0;
  trailMat.color.set(on ? '#ffb347' : '#ffffff');
}
const deadly = (k, t) => k === DARK ? !fire : k === STEEL ? true : k === BLINK ? (isBlackNow(t) && !fire) : false;

// ---------------------------------------------------------------- events
function ignite(why) {
  heat = 1; setFire(true); ignites++; bump('fire');
  ui.pop(why || 'ON FIRE!', '#ffde59', 40, 30); tone(300, 0.3, 'sawtooth', 0.08, 2); buzz([20, 20, 20]); stopT = 0.07;
}
function smashRing(i) {
  const rg = rings[i]; rg.alive = false;
  const kA = rg.kinds[sliceAt(i, rot)];
  mainI.instanceMatrix.needsUpdate = blinkI.instanceMatrix.needsUpdate = true;
  for (let s = 0; s < SEG; s++) { mainI.setMatrixAt(i * SEG + s, ZERO); blinkI.setMatrixAt(i * SEG + s, ZERO); }
  for (let s = 0, used = 0; s < SEG; s += 2) {
    const d = debris.find(d => d.life <= 0); if (!d) break; used++;
    const k = rg.kinds[s]; d.m.geometry = SLICES[style]; d.m.material.color.set(k === BLINK ? '#b36bff' : k === HOLE ? theme.ring : kindCol(k));
    const ang = rot + rg.rot + s * SEGA;
    d.m.position.set(0, rg.y, 0); d.m.rotation.set(0, ang, 0); d.m.scale.setScalar(0.85); d.m.visible = true; d.life = 1;
    const out = new THREE.Vector3(Math.cos(ang + SEGA), 0, -Math.sin(ang + SEGA));
    d.v.copy(out).multiplyScalar(0.06 + Math.random() * 0.04); if (d.v.z > 0) d.v.z *= 0.35; d.v.y = 0.06 + Math.random() * 0.06;
    d.spin.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25);
  }
  const gold = kA === GOLD;
  burst(scene, new THREE.Vector3(0, rg.y + 0.1, BALL_D * 0.8), gold ? ['#ffc400', '#fff2a0', '#ffc400'] : [theme.ring, theme.ring, '#1b1b24'], gold ? 9 : 5, { speed: 0.12, up: 0.08, size: 0.9, gravity: 0.008, life: 0.8 });
  splats.filter(s => s.userData.ring === i).forEach(s => tower.remove(s));
  top = i + 1; smashRun++; bestRun = Math.max(bestRun, smashRun); bump('rings'); bump('combo', smashRun, true);
  let pts = (fire ? 2 : 1) + Math.floor(smashRun / 10);
  if (gold) { pts += 6; golds++; bump('gold'); ui.pop('+' + pts + ' GOLD', '#ffd23f', 30, 26); tone(1040, 0.12, 'sine', 0.12, 1.4); heat = Math.min(1, heat + 0.06); stopT = 0.04; }
  score += pts; ui.score(score); ui.progress(top / total);
  tone(160 + Math.min(smashRun, 30) * 9, 0.07, 'square', 0.07, 0.6); tone(90, 0.06, 'sine', 0.12, 0.5);
  buzz(6); shake = Math.min(0.14, shake + 0.015 + smashRun * 0.0008);
  if (kA === FLAME) ignite('FLAME!');
  if (!fire) { heat = Math.min(1, heat + 0.034); if (heat >= 1) ignite(); }
  if (smashRun === 5 || smashRun === 15 || smashRun === 25 || (smashRun > 35 && smashRun % 10 === 0)) { ui.pop('x' + smashRun + ' SMASH', '#fff', 30, 22); tone(440 + smashRun * 8, 0.1, 'triangle', 0.1, 1.5); buzz(14); shake = Math.min(0.2, shake + 0.04); }
  if (smashRun === 10) { ui.pop('GREAT!', '#fff', 34, 24); ui.flash(0.2); stopT = 0.04; tone(520, 0.12, 'triangle', 0.1, 1.5); }
  else if (smashRun === 20) { ui.pop('UNSTOPPABLE!', '#fff', 36, 24); ui.flash(0.28); stopT = 0.06; tone(620, 0.16, 'triangle', 0.1, 1.5); }
  else if (smashRun === 35) { ui.pop('GODLIKE!!', '#ffde59', 40, 24); ui.flash(0.35); stopT = 0.08; }
}
function threadRing(i) {
  rings[i].alive = false; top = i + 1; threads++; bump('thread'); score += 3; ui.score(score); ui.progress(top / total);
  heat = Math.min(1, heat + 0.05); smashRun++;
  burst(scene, new THREE.Vector3(0, rings[i].y, BALL_D), ['#ffffff', theme.ball], 3, { speed: 0.06, up: 0.04, size: 0.7, gravity: 0.004, life: 0.6 });
  tone(700 + Math.min(threads, 8) * 40, 0.09, 'sine', 0.1, 1.3);
  if (threads === 1 || threads % 5 === 0) ui.pop('THREADED!', '#fff', 28, 26);
}
function bounceOn(y) {
  by = y + BALL_R; vy = BOUNCE; squash = 1; smashRun = 0;
  tone(330, 0.06, 'sine', 0.1, 0.7);
  if (top < total) {
    const m = new THREE.Mesh(splatGeo, new THREE.MeshBasicMaterial({ color: ballMat.color, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    const local = new THREE.Vector3(0, 0, BALL_D).applyAxisAngle(Y, -rot);
    m.position.set(local.x, rings[top].y + 0.012, local.z); m.rotation.y = Math.random() * 6; m.scale.setScalar(0.8 + Math.random() * 0.5);
    m.userData.ring = top; tower.add(m); splats.push(m); if (splats.length > 14) tower.remove(splats.shift());
  }
}
function die(kind) {
  if (mercy > 0) { mercy--; by = topY() + BALL_R; bounceOn(topY()); vy *= 1.25; hold = false; needRelease = true; ui.pop('PHEW! SAVED', '#fff', 32, 28); tone(500, 0.2, 'sine', 0.1, 1.6); return; }
  state = 'lost'; crashes++; if (!fast) lossRun[level] = (lossRun[level] || 0) + 1; if (!fast) F.level(false, top / total); deadT = 0; hold = false; ball.visible = false; best = Math.max(best, score); S.set('best', best);
  deathWhy = kind === STEEL ? 'STEEL! Fire cannot break grey steel.' : kind === BLINK ? 'A purple blinker flashed to black.' : 'A black slice came round.';
  burst(scene, ball.position.clone(), [theme.ball, '#ffffff', '#1b1b24'], 26, { speed: 0.12, up: 0.1, size: 0.9, shape: 'sphere', gravity: 0.006 });
  tone(140, 0.4, 'sawtooth', 0.12, 0.4); buzz([40, 30, 80]); ui.flash(0.5); stopT = 0.12; shake = 0.2;
  S.set('played', S.get('played', 0) + 1); lossRun[level] = 0; later(300);
}
function parTxt() { return parOf(level); }
function win() {
  state = 'won'; if (!fast) { F.level(true); WB.submit(1); } hold = false; best = Math.max(best, score); S.set('best', best); S.set('played', S.get('played', 0) + 1);
  const par = parOf(level), got = 1 + (crashes === 0 ? 1 : 0) + (crashes === 0 && runT <= par ? 1 : 0);
  winInfo = { got, old: stars[level - 1] || 0, time: runT, par, score, crashes, gain: 0 };
  if (!daily_mode && level <= NL) {
    winInfo.gain = Math.max(0, got - winInfo.old); if (got > winInfo.old) { stars[level - 1] = got; S.set('stars', stars); }
    if (chestsLeft()) addChest(winInfo.gain);
    if (level === reach) { reach = level + 1; S.set('reach', reach); winInfo.unlock = true; }
  } else if (!daily_mode && level === reach) { reach = level + 1; S.set('reach', reach); }
  if (daily_mode && !daily.dive) { daily.dive = 1; daily.streak = (daily.streak || 0) + 1; S.set('daily', daily); if (chestsLeft()) addChest(3); winInfo.dive = 1; }
  bump('clear'); crashes = 0; fresh = false;
  confetti(scene, new THREE.Vector3(0, finishY + 1, BALL_D), 90); ui.flash(0.4); buzz([20, 40, 30]);
  [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(67 + s, 0.4, 0.16), i * 90));
  later(900);
}
let winInfo = null;
function later(ms) { if (fast) return; const st = state; setTimeout(() => { if (state === st && !resultShown) { resultShown = true; showResult(); } }, ms); }

// ---------------------------------------------------------------- physics step (dt in 60 fps frames)
function step(dt) {
  if (stopT > 0) { stopT -= dt / 60; dt *= 0.12; }
  lt += dt / 60;
  if (state !== 'lost') {
    if (lv.flip) { flipT += dt / 60; if (flipT > lv.flip) { flipT = 0; dir = -dir; } }
    rot += omega * dir * dt / 60;
  }
  if (state === 'home') hold = false;
  if (state === 'play' || state === 'home') {
    if (state === 'play' && started) runT += dt / 60;
    if (hold) {
      vy = -SMASH; by += vy * dt;
      while ((state === 'play' || state === 'home') && by - BALL_R <= topY()) {
        if (top >= total) { bounceOn(finishY); if (state === 'play') win(); break; }
        const k = rings[top].kinds[sliceAt(top, rot)];
        if (k === HOLE) { threadRing(top); if (botTarget >= 0 && top >= botTarget) { botTarget = -1; hold = false; bounceOn(topY()); break; } continue; }
        if (deadly(k, lt)) { by = topY() + BALL_R; dieAt = top + ':' + rings[top].pat + ':' + k + ':' + dir; die(k); break; }
        smashRing(top); squash = 0.6;
        if (botTarget >= 0 && top >= botTarget) { botTarget = -1; hold = false; bounceOn(topY()); break; }
      }
    } else {
      vy -= GRAV * dt; by += vy * dt;
      while (by - BALL_R <= topY() && vy < 0) {
        if (top >= total) { bounceOn(finishY); if (state === 'play') win(); break; }
        const k = rings[top].kinds[sliceAt(top, rot)];
        if (k === HOLE) { threadRing(top); continue; }
        bounceOn(topY()); break;
      }
      if (!fire) heat = Math.max(0, heat - 0.006 * dt);
    }
    if (fire) {
      heat -= 0.0058 * dt; if (heat <= 0) { heat = 0; setFire(false); }
      if (Math.random() < 0.6 && !fast) burst(scene, ball.position.clone().add(new THREE.Vector3(0, 0.2, 0)), ['#ff9b2f', '#ffd23f', '#ff4d00'], 1, { speed: 0.02, up: 0.03, size: 0.6, gravity: -0.002, life: 0.5 });
    }
    // steel ahead while burning: tell the player once
    if (fire && !steelWarned && top < total) { for (let j = top; j < Math.min(total, top + 7); j++) if (rings[j].kinds.includes(STEEL)) { steelWarned = true; ui.pop('STEEL AHEAD!', '#cfd8ee', 30, 26); break; } }
  }
  if (state === 'won') { vy -= GRAV * dt; by += vy * dt; if (by - BALL_R <= finishY) { by = finishY + BALL_R; vy = BOUNCE * 0.8; squash = 1; } }
}
let resultShown = false, fast = false, botMargin = 1.5;

// ---------------------------------------------------------------- input
input({
  onDown: () => { if (state === 'play' && !layerOpen() && !needRelease) { hold = true; if (!started) { started = true; WB.start(); } hintEl.style.opacity = 0; } },
  onUp: () => {
    needRelease = false;
    if (hold && state === 'play' && top < total && !fire) {          // near-miss: let go with black right next to the ball
      const s = sliceAt(top, rot), a = rings[top].kinds[(s + 1) % SEG], b = rings[top].kinds[(s + SEG - 1) % SEG];
      if (deadly(a, lt) || deadly(b, lt)) { closeCalls++; ui.pop('CLOSE CALL!', '#fff', 26, 30); score += 2; ui.score(score); tone(760, 0.08, 'triangle', 0.1, 1.3); }
    }
    hold = false;
  },
});
addEventListener('keydown', e => { if (e.code === 'Space' && state === 'play' && !layerOpen() && !needRelease) { hold = true; started = true; hintEl.style.opacity = 0; } });
addEventListener('keyup', e => { if (e.code === 'Space') { hold = false; needRelease = false; } });

// ---------------------------------------------------------------- screens
function startLevel(n, opts = {}) {
  hide(); daily_mode = !!opts.daily; resultShown = false; winInfo = null;
  if (opts.daily) { const d = genLevel(31 + (dayNo() % 40), dayNo() * 131 + 7); d.n = 'Daily Dive'; d.p = 'today'; d.mercy = 0; buildLevel(9000 + dayNo() % 997, d); }
  else buildLevel(n);
  if (n !== level && !opts.daily) crashes = 0;
  state = 'play';
}
function showHome() {
  state = 'home'; resultShown = false;
  const w = WORLDS[worldOf(reach)];
  const nGoal = daily.goals.filter(g => !daily.done.includes(g)).length;
  show(`<div class="cc-card"><h1>CORE<br>CRUSHER</h1><h2>${w.icon} ${w.name} · LEVEL ${reach}</h2>
    <button class="cc-go" data-a="play">PLAY</button>
    <div class="cc-row"><div class="cc-sm" data-a="map">MAP</div><div class="cc-sm" data-a="balls">BALLS${chest >= CHEST_AT && chestsLeft() ? '<i>CHEST</i>' : ''}</div><div class="cc-sm" data-a="daily">DAILY${daily.dive ? '' : '<i>NEW</i>'}</div></div>
    ${nGoal ? `<p style="opacity:.85;font-size:13px;margin-top:10px">${nGoal} daily goal${nGoal > 1 ? 's' : ''} left</p>` : ''}</div>`);
}
function chestBar() { const p = chestsLeft() ? Math.min(CHEST_AT, chest) : 0; return chestsLeft() ? `<div class="cc-bar"><i style="width:${p / CHEST_AT * 100}%"></i></div><p style="font-size:13px;margin:0">${chest >= CHEST_AT ? 'CHEST READY' : 'chest ' + p + ' / ' + CHEST_AT + ' stars'}</p>` : ''; }
let mapWorld = 0;
function showMap(w) {
  if (w === undefined) mapWorld = worldOf(Math.min(reach, NL)); else mapWorld = w;
  const W = WORLDS[mapWorld], nodes = [];
  for (let i = 1; i <= 10; i++) {
    const n = mapWorld * 10 + i, st = stars[n - 1] || 0, lock = n > reach, cur = n === reach, boss = LEVELS[n - 1].boss;
    nodes.push(`<div class="cc-node ${lock ? 'lock' : ''} ${cur ? 'cur' : ''} ${boss ? 'boss' : ''}" data-a="${lock ? 'x' : 'lvl'}" data-n="${n}">${boss ? '<em>BOSS</em>' : ''}${n}<span>${[1, 2, 3].map(k => STAR(k <= st, 10)).join('')}</span></div>`);
  }
  const total3 = stars.reduce((a, b) => a + (b || 0), 0);
  show(`<div class="cc-card" style="width:min(94vw,420px)"><h2 style="font-size:24px;margin:0">${W.icon} ${W.name}</h2><p style="font-size:12px;opacity:.85;margin:0">${W.tag} · ${total3} / ${NL * 3} stars</p>
    <div class="cc-tabs">${WORLDS.map((x, i) => `<div class="cc-sm ${i === mapWorld ? 'on' : ''}" data-a="${(i + 1) * 10 > reach + 9 ? 'x' : 'world'}" data-n="${i}">${x.icon}</div>`).join('')}</div>
    <div class="cc-map">${nodes.join('')}</div>${chestBar()}
    <div class="cc-row"><div class="cc-sm" data-a="balls">BALLS${chest >= CHEST_AT && chestsLeft() ? '<i>CHEST</i>' : ''}</div><div class="cc-sm" data-a="daily">DAILY${daily.dive ? '' : '<i>NEW</i>'}</div><div class="cc-sm" data-a="goals">GOALS ${daily.done.length}/3</div></div>
    <div class="cc-row"><div class="cc-sm" data-a="play">${reach > NL ? 'PLAY ON' : 'PLAY LEVEL ' + reach}</div></div></div>`);
}
function showGoals() {
  show(`<div class="cc-card"><h1 style="font-size:30px">TODAY'S GOALS</h1><p style="opacity:.8;font-size:13px">each one is a chest star${daily.streak ? ' · ' + daily.streak + ' day dive streak' : ''}</p>
    ${daily.goals.map(id => { const g = GOALS.find(x => x.id === id), d = daily.done.includes(id); return `<div class="cc-goal ${d ? 'done' : ''}"><span>${g.t(g.n)}</span><span>${d ? 'DONE' : (daily.prog[id] || 0) + ' / ' + g.n}</span></div>`; }).join('')}
    <div class="cc-row"><div class="cc-sm" data-a="map">BACK</div></div></div>`);
}
function showBalls(reveal) {
  const ready = chest >= CHEST_AT && chestsLeft();
  show(`<div class="cc-card"><h1 style="font-size:30px">BALLS</h1><p style="opacity:.85;font-size:13px">${owned.length} / ${SKINS.length} collected · stars fill the chest</p>
    <div class="cc-skins">${SKINS.map((k, i) => `<div class="cc-skin ${owned.includes(i) ? '' : 'lock'} ${skin === i ? 'on' : ''} ${reveal === i ? 'on' : ''}" data-a="${owned.includes(i) ? 'skin' : 'x'}" data-n="${i}"><b style="background:${skinSwatch(i)}"></b>${owned.includes(i) ? k.n : '?'}</div>`).join('')}</div>
    ${chestBar()}${ready ? '<div class="cc-go" data-a="chest" style="font-size:22px;min-width:180px">OPEN CHEST</div>' : ''}
    <div class="cc-row"><div class="cc-sm" data-a="map">BACK</div></div></div>`);
}
function openChest() {
  chest -= CHEST_AT; S.set('chest', chest);
  const locked = SKINS.map((k, i) => i).filter(i => !owned.includes(i)); const pick = locked[Math.floor(Math.random() * locked.length)];
  show(`<div class="cc-card"><div class="cc-chest">🎁</div><h2>OPENING…</h2></div>`);
  tone(220, 0.5, 'sawtooth', 0.08, 1.3);
  setTimeout(() => {
    owned.push(pick); skin = pick; S.set('owned', owned); S.set('skin', skin); applySkin(); [0, 4, 7, 12].forEach((s, i) => setTimeout(() => note(72 + s, 0.3, 0.16), i * 80));
    show(`<div class="cc-card"><h2>NEW BALL!</h2><div class="cc-skin on" style="width:120px;margin:12px auto;padding:16px"><b style="width:64px;height:64px;background:${skinSwatch(pick)}"></b><span style="font-size:16px">${SKINS[pick].n}</span></div><p>${owned.length} / ${SKINS.length} collected</p>
      <div class="cc-row"><div class="cc-go" data-a="${pendingCard || 'balls'}" style="font-size:24px;min-width:170px">${pendingCard ? 'NEXT' : 'NICE'}</div></div></div>`);
  }, 900);
}
let pendingCard = '';
function showResult() {
  const bar = chestBar(), ready = chest >= CHEST_AT && chestsLeft();
  if (state === 'won') {
    const w = winInfo, nxt = level + 1, lvlLine = daily_mode ? 'DAILY DIVE' : 'LEVEL ' + level;
    pendingCard = ready ? 'next' : '';
    show(`<div class="cc-card"><p style="font-size:14px;opacity:.9;margin:0">${lvlLine}</p><h1>CLEARED!</h1>${starsRow(w.got, 44, true)}
      <p>${w.got === 3 ? 'FLAWLESS' : w.got === 2 ? 'No crash. ' + Math.ceil(w.time - w.par) + ' s over the 3-star time' : 'Crashed ' + w.crashes + '× · clear it clean for 2 stars'} · ${w.time.toFixed(1)} s</p>
      <p style="font-size:14px">${score} pts${w.gain ? ' · +' + w.gain + ' chest star' + (w.gain > 1 ? 's' : '') : ''}${w.dive ? ' · +3 chest stars' : ''}${bestRun >= 15 ? ' · best streak ' + bestRun : ''}</p>${bar}
      ${!daily_mode && !daily.dive ? '<p style="font-size:13px;opacity:.85;margin:6px 0 0">DAILY DIVE ready · +3 chest stars' + (daily.streak ? ' · keep your ' + daily.streak + ' day streak' : '') + '</p>' : ''}
      ${ready ? '<div class="cc-go" data-a="chest" style="font-size:22px;min-width:180px;margin-bottom:0">OPEN CHEST</div>' : ''}
      <button class="cc-go" data-a="next">${daily_mode ? 'DONE' : nxt <= NL && lv.boss ? 'NEXT WORLD' : 'NEXT'}</button>
      <div class="cc-row"><div class="cc-sm" data-a="retry">AGAIN</div><div class="cc-sm" data-a="map">MAP</div></div></div>`);
  } else {
    const pct = Math.round(top / total * 100), left = total - top;
    pendingCard = '';
    show(`<div class="cc-card"><p style="font-size:14px;opacity:.9;margin:0">${daily_mode ? 'DAILY DIVE' : 'LEVEL ' + level}</p><h1>CRASHED!</h1>
      <div class="cc-bar" style="width:260px;height:18px"><i style="width:${pct}%"></i></div>
      <h2>${left <= 6 ? 'SO CLOSE: ' + left + ' ring' + (left > 1 ? 's' : '') + ' to go!' : pct >= 50 ? 'SO CLOSE · ' + pct + '% down' : pct + '% down'}</h2><p style="font-size:14px">${deathWhy}</p>
      <button class="cc-go" data-a="retry">RETRY</button>
      <div class="cc-row"><div class="cc-sm" data-a="map">MAP</div></div></div>`);
  }
}
layer.addEventListener('pointerdown', e => {
  e.stopPropagation();
  const t = e.target.closest('[data-a]');
  if (!t) { if (layerOpen() && state === 'lost') act('retry', {}); else if (layerOpen() && state === 'won' && !pendingCard) act('next', {}); return; }
  act(t.dataset.a, t.dataset);
});
function act(a, d) {
  if (a === 'x') { tone(180, 0.1, 'square', 0.06, 0.8); return; }
  if (a === 'play') { startLevel(Math.min(reach, level > NL ? level : reach)); }
  else if (a === 'next') { if (daily_mode) { showMap(); return; } const n = level + 1; if (n <= NL && n > reach) { startLevel(reach); return; } startLevel(n); }
  else if (a === 'retry') startLevel(daily_mode ? 0 : level, daily_mode ? { daily: 1 } : {});
  else if (a === 'map') showMap();
  else if (a === 'world') showMap(+d.n);
  else if (a === 'lvl') startLevel(+d.n);
  else if (a === 'balls') showBalls();
  else if (a === 'skin') { skin = +d.n; S.set('skin', skin); applySkin(); showBalls(skin); tone(660, 0.08, 'sine', 0.1, 1.2); }
  else if (a === 'chest') openChest();
  else if (a === 'daily') startLevel(0, { daily: 1 });
  else if (a === 'goals') showGoals();
}

// ---------------------------------------------------------------- loop (draw)
demo(() => { if (top + 8 >= total) return false; window.__game.bot(); if (hold && (botTarget < 0 || botTarget > top + 2)) botTarget = top + 2; },
  { ready: () => state === 'play' && level === 1 && fresh && !hold && !fire, wait: 1500, every: 1300, max: 3 });

loop((dt, t) => {
  step(dt);
  tower.rotation.y = rot;
  meterFill.style.height = (heat * 100) + '%';
  meter.style.opacity = state === 'play' && (heat > 0.02 || fire) ? 1 : 0;
  const spdOn = state === 'play' && (hold && top > 0 || fire); speedFx.style.opacity = spdOn ? (fire ? 0.9 : 0.5) : 0; speedFx.classList.toggle('on', spdOn);
  mapBtn.style.display = state === 'play' || state === 'home' ? 'flex' : 'none';
  if (state === 'play' && started && !daily_mode) { const par = parOf(level); ui.sub(`${runT.toFixed(0)}s · 3★ ${par}s`); }
  // blinkers
  const ph = lt % BLINK_T;
  blinkMat.color.set(ph < BLINK_WARN ? '#b36bff' : ph < BLINK_ON ? (Math.floor(lt * 14) % 2 ? '#ffffff' : '#ff4d6d') : '#1b1b24');
  blinkMat.emissive.set(ph >= BLINK_WARN && ph < BLINK_ON ? '#ff2a4a' : '#000000'); blinkMat.emissiveIntensity = 0.5;
  const sk = SKINS[skin]; if (sk && sk.disco) ballMat.color.setHSL((t * 0.6) % 1, 0.9, 0.55);
  squash = Math.max(0, squash - dt * 0.1);
  const stretch = hold && state === 'play' ? 0.18 : 0;
  ball.position.set(0, by, BALL_D);
  ball.scale.set(1 + squash * 0.3 - stretch * 0.4, 1 - squash * 0.35 + stretch, 1 + squash * 0.3 - stretch * 0.4);
  const tl = hold && state === 'play' ? 2.2 : clamp(Math.abs(vy) * 6, 0, 0.9);
  trail.position.copy(ball.position); trail.scale.set(1, Math.max(0.01, tl), 1); trailMat.opacity = state === 'play' ? (hold ? 0.55 : 0.25) : 0;
  for (const d of debris) {
    if (d.life <= 0) continue;
    d.life -= dt * 0.022; d.v.y -= 0.004 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt; d.m.scale.setScalar(Math.max(0.01, Math.min(0.85, d.life * 1.4)));
    if (d.life <= 0) d.m.visible = false;
  }
  const target = Math.min(by, topY() + 1.4);
  camY = state === 'home' ? by : Math.min(camY, lerp(camY, target, 0.12 * dt));
  if (state === 'won') camY = lerp(camY, finishY + 1.2, 0.05 * dt);
  shake = Math.max(0, shake - 0.012 * dt);
  const want = (hold && state === 'play' ? 3.5 : fire ? 2.5 : 0); fovK = lerp(fovK, want, 0.12 * dt);
  const fovNow = 46 + fovK; if (Math.abs(camera.fov - fovNow) > 0.05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
  camera.position.set((Math.random() - 0.5) * shake, camY + 5.4 + (Math.random() - 0.5) * shake, 10.2); camera.lookAt(0, camY - 1.9, 0);
  stage.followLight(new THREE.Vector3(0, by, BALL_D * 0.5));
});

// ---------------------------------------------------------------- boot
buildLevel(level > NL + 1 ? reach : Math.min(reach, 99999));
if (fresh) { state = 'play'; } else showHome();

// ---------------------------------------------------------------- test hook + bot
const predRot = (f) => {
  const w = omega * dir / 60;
  if (lv.flip) { const rem = (lv.flip - flipT) * 60; if (f > rem) return rot + w * rem - w * (f - rem); }
  return rot + w * f;
};
function botPlan() {
  if (state !== 'play' || hold) return;
  let k = 0; const fireF = fire ? heat / 0.0058 - 4 : 0;
  const startY = by - BALL_R;
  for (let j = top; j <= total; j++) {
    if (j === total) { k = total - top + 1; break; }
    const frames = Math.max(0, (startY - rings[j].y) / SMASH);
    let safe = true;
    for (const f of [frames - botMargin, frames - botMargin / 2, frames, frames + botMargin / 2, frames + botMargin]) {
      const kd = rings[j].kinds[sliceAt(j, predRot(Math.max(0, f)))];
      const burning = f < fireF;
      if (kd === STEEL || (!burning && (kd === DARK || (kd === BLINK && (isBlackNow(lt + Math.max(0, f) / 60) || isBlackNow(lt + Math.max(0, f) / 60 + 0.1)))))) safe = false;
    }
    if (!safe) break;
    k++;
  }
  if (k >= 1) { hold = true; started = true; botTarget = top + Math.min(k, total - top + 1); if (botTarget > total) botTarget = -1; }
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; }, get time() { return runT; }, get crashes() { return crashes; },
  bot: botPlan, step, openMap: () => showMap(), openBalls: () => showBalls(), openGoals: () => showGoals(), home: showHome, start: (n) => startLevel(n),
  // QA: build level n (no mercy) and play it with the bot without drawing; returns {state, secs, pct}
  fast(n, o = {}) {
    fast = true; botMargin = o.margin || 1.5; hide(); daily_mode = false; buildLevel(n); if (o.mercy !== undefined) mercy = o.mercy; else mercy = 0; state = 'play'; resultShown = true;
    let guard = 0;
    while (state === 'play' && guard++ < 120000) { botPlan(); step(1); if (hold && botTarget < 0 && !fire && top < total && false) hold = false; }
    fast = false; const r = { dieAt, state, secs: +runT.toFixed(1), pct: Math.round(top / total * 100), rings: total, ignites, golds, threads, ok: state === 'won' };
    return r;
  },
  dbg: () => ({ top, k: rings[top] && rings[top].kinds.join(''), s: sliceAt(top, rot), rot, dir, lt, by, fire, heat, botTarget, flipT }),
  press(v) { hold = !!v && state === 'play'; started = true; },
  data: { LEVELS, SKINS, parOf },
  set(k, v) { S.set(k, v); }, openChest, showResult,
  force(o) { Object.assign({}, o); },
};

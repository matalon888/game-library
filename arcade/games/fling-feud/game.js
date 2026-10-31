// Fling Feud — original side-view throwing duel. Drag back to aim (angle + power), release to fling. Headshots hit double. No gore: hits pop with stars.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import * as SIM from './sim.js';
import { LEVELS, WORLDS, worldOf, hardOf, parOf, genLevel } from './levels.js';

// Deep v2 (campaign: 36 authored duels, wind, walls, balloons, shields, volleys, stars, weapons, daily duel). READY stays false until it is
// finished and checked: until then no player ever sees it (?deep=1 is for QA only).
const READY = true;
const DEEP = (READY && ab('deep-fling-feud')) || /[?&]deep=1(&|$)/.test(location.search);

const S = createStage({ fov: 24, shadows: false });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.25; hemi.intensity = 1.55; sun.position.set(-4, 10, 12);
const ui = createUI({ title: 'FLING<br>FEUD', hint: 'Tap to throw that way · or drag back to aim', hand: '👈', score: false });
const save = store(DEEP ? 'flingfeud2' : 'flingfeud');
const F = flow('flingfeud'); let fk = 1;
const B = board({ game: 'fling-feud', label: 'Wins', limits: { maxRun: 2, maxPerSec: 1 }, mode: 'sum', corner: 'bl' });
let unlocked = DEEP ? Math.max(1, save.get('unlocked', 1)) : 1, starsBy = DEEP ? save.get('stars', {}) : {};
let level = DEEP ? (+new URLSearchParams(location.search).get('level') || unlocked) : save.get('level', 1);
let daily = false, curL = null;   // deep: the level being played (authored, bonus brawl or daily duel)


// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.ff-hud{position:fixed;top:calc(54px + env(safe-area-inset-top));left:8px;right:8px;display:flex;align-items:center;gap:6px;z-index:6;pointer-events:none;background:rgba(40,20,70,.45);border-radius:18px;padding:5px 6px}
.ff-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:#fff;flex:none;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.ff-hp{flex:1;height:14px;border-radius:8px;background:rgba(0,0,0,.35);overflow:hidden;position:relative}
.ff-hp i{position:absolute;top:0;bottom:0;background:linear-gradient(#ff6b8b,#e6305a);transition:width .35s}
.ff-hp b{position:absolute;top:0;bottom:0;background:#fff;opacity:.7;transition:width .9s .25s}
.ff-hp.l i,.ff-hp.l b{left:0}.ff-hp.r i,.ff-hp.r b{right:0}
.ff-x{font-size:20px;flex:none}
.ff-names{position:fixed;top:calc(98px + env(safe-area-inset-top));left:14px;right:14px;display:flex;justify-content:space-between;z-index:6;pointer-events:none;font-weight:800;font-size:13px;opacity:.9;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.ff-bub{position:fixed;z-index:6;pointer-events:none;background:#fff;color:#3b2a7a;border-radius:14px;padding:3px 10px;font-weight:800;font-size:19px;transform:translate(-50%,-100%);white-space:nowrap;box-shadow:0 3px 0 rgba(0,0,0,.2);display:none;line-height:1.05;text-align:center}
.ff-bub small{display:block;font-size:9px;opacity:.6;letter-spacing:1px}
.ff-bub span{display:inline-block;margin:0 4px}
.ff-turn{position:fixed;left:0;right:0;top:calc(122px + env(safe-area-inset-top));text-align:center;font-weight:800;font-size:22px;z-index:6;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,.3);transition:opacity .2s}
.ff-dmg{position:fixed;z-index:7;pointer-events:none;font-weight:800;transform:translate(-50%,-50%);-webkit-text-stroke:5px #2b1a4a;paint-order:stroke fill;animation:ffd 1s ease-out forwards}
@keyframes ffd{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}100%{opacity:0;transform:translate(-50%,-160%) scale(1)}}
.hc-pop{-webkit-text-stroke:6px #2b1a4a;paint-order:stroke fill}
.hc-card h1{text-shadow:0 6px 0 rgba(40,20,70,.4)!important}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const hud = H('<div class="ff-hud"><div class="ff-av" data-a0>🪓</div><div class="ff-hp l" data-h0><b></b><i></i></div><div class="ff-x">⚔️</div><div class="ff-hp r" data-h1><b></b><i></i></div><div class="ff-av" data-a1>🍳</div></div>');
const names = H('<div class="ff-names"><span data-n0>JACK</span><span data-n1>CHEF</span></div>');
const bub = H('<div class="ff-bub"><span data-p>0%</span><span data-g>0°</span><small>POWER · ANGLE</small></div>');
const turnEl = H('<div class="ff-turn"></div>');
function dmgText(text, x, y, color = '#fff', size = 40) { const d = H(`<div class="ff-dmg">${text}</div>`); d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.color = color; d.style.fontSize = size + 'px'; setTimeout(() => d.remove(), 1000); }

// ---------------------------------------------------------------- themes + terrain
const THEMES = [
  { bg: ['#ff7f6e', '#ffc39b'], ground: '#e23d4f', top: '#ff6b74', b1: '#ff9a84', b2: '#ffb59a', win: '#ffe1c4', deco: 'cactus' },
  { bg: ['#36cbbf', '#b5f3ea'], ground: '#139a86', top: '#2fd0a8', b1: '#2ab3a3', b2: '#6fdccc', win: '#d9fff8', deco: 'lamp' },
  { bg: ['#2f2470', '#7a55c9'], ground: '#2fb36a', top: '#5be08e', b1: '#3e3189', b2: '#5442a8', win: '#ffd86b', deco: 'tree', moon: true },
  { bg: ['#ff5aa0', '#ffc0df'], ground: '#5cc94b', top: '#8de86d', b1: '#ff7cb8', b2: '#ffa3cf', win: '#fff0f7', deco: 'tree' },
  { bg: ['#ffb02e', '#ffe7a1'], ground: '#c4632f', top: '#e88a4a', b1: '#f39a3b', b2: '#ffc061', win: '#fff3d1', deco: 'cactus' },
];
let TH = THEMES[0], world = null, hillF = () => 0, arenaD = 16;
const winTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.0)'; });
function buildWorld() {
  if (world) { scene.remove(world); world.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  world = new THREE.Group(); scene.add(world);
  TH = DEEP ? THEMES[themeOf()] : THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', '#ff3d7f');
  const r = rng(DEEP ? curL.seed : level * 313 + 9);
  arenaD = DEEP ? curL.d : Math.min(26, 15 + level * 1.1);
  const p0 = -arenaD / 2, p1 = arenaD / 2, a1 = r() * 6, a2 = r() * 6, amp = 0.6 + Math.min(1.6, level * 0.15), dy = (r() - 0.5) * Math.min(3, level * 0.4);
  const raw = x => Math.sin(x * 0.35 + a1) * amp + Math.sin(x * 0.8 + a2) * amp * 0.35 + (x - p0) / arenaD * dy;
  const flat = (x, c) => Math.exp(-((x - c) ** 2) / 1.2);
  hillF = x => { const w0 = flat(x, p0), w1 = flat(x, p1); return raw(x) * (1 - w0 - w1) + raw(p0) * w0 + raw(p1) * w1; };
  if (DEEP) hillF = SIM.terrain(curL).hillF;
  // ground: extruded hill shape + lighter top band
  const sh = new THREE.Shape(); sh.moveTo(-60, -14);
  for (let x = -60; x <= 60; x += 0.5) sh.lineTo(x, hillF(x)); sh.lineTo(60, -14); sh.closePath();
  const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false, curveSegments: 1 }), mat(TH.ground, { roughness: 1 })); gm.position.z = -4.5; world.add(gm);
  const band = new THREE.Shape(); band.moveTo(-60, hillF(-60) - 0.42);
  for (let x = -60; x <= 60; x += 0.5) band.lineTo(x, hillF(x) + 0.02); for (let x = 60; x >= -60; x -= 0.5) band.lineTo(x, hillF(x) - 0.42 + Math.sin(x * 3) * 0.08);
  const bm = new THREE.Mesh(new THREE.ShapeGeometry(band), mat(TH.top, { roughness: 1 })); bm.position.z = 0.52; world.add(bm);
  // dots/pebbles on the ground face
  const peb = [];
  for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 100, y = hillF(x) - 1 - r() * 8; peb.push(part(new THREE.CircleGeometry(1, 10), new THREE.Color(TH.ground).offsetHSL(0, 0, -0.06).getStyle(), { x, y, z: 0.53, s: 0.12 + r() * 0.3 })); }
  world.add(new THREE.Mesh(merge(peb), new THREE.MeshBasicMaterial({ vertexColors: true })));
  // back layers: city silhouettes with windows
  for (const [z, col, hmin, hvar, sc] of [[-14, TH.b2, 5, 6, 1], [-8, TH.b1, 3, 5, 1]]) {
    const P = [];
    for (let x = -70; x < 70;) {
      const w = 2.5 + r() * 4, h = hmin + r() * hvar, base = hillF(x) - 3;
      P.push(part(new THREE.PlaneGeometry(w, h + 6), col, { x: x + w / 2, y: base + (h + 6) / 2, z }));
      if (z > -10) for (let wy = 0; wy < Math.floor(h / 1.6); wy++) for (let wx = 0; wx < Math.floor(w / 1.3); wx++) if (r() < 0.7) P.push(part(new THREE.PlaneGeometry(0.55, 0.75), TH.win, { x: x + 0.75 + wx * 1.3, y: base + 4.6 + wy * 1.6, z: z + 0.02 }));
      if (r() < 0.3) P.push(part(new THREE.CircleGeometry(w / 2, 16, 0, Math.PI), col, { x: x + w / 2, y: base + h + 6, z }));
      x += w + r() * 0.8;
    }
    world.add(new THREE.Mesh(merge(P), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  }
  if (TH.moon) { const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: '#fff4c9' })); m.position.set(6, 14, -20); world.add(m); }
  // clouds
  const C = []; for (let i = 0; i < 9; i++) { const x = -40 + i * 10 + r() * 5, y = 10 + r() * 6; for (let k = 0; k < 3; k++) C.push(part(new THREE.CircleGeometry(1, 16), '#ffffff', { x: x + k * 1.1, y: y + (k === 1 ? 0.5 : 0), z: -18, s: 1 + (k === 1 ? 0.4 : 0) })); }
  const cm = new THREE.Mesh(merge(C), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 })); world.add(cm);
  // deco props in front of the hills
  const D = [];
  for (let i = 0; i < 10; i++) {
    const x = (r() - 0.5) * 70; if (Math.abs(x - p0) < 2.5 || Math.abs(x - p1) < 2.5) continue; const y = hillF(x) - 0.1;
    if (TH.deco === 'cactus') D.push(part(new THREE.CapsuleGeometry(0.28, 1.4, 3, 8), '#2f9e55', { x, y: y + 0.9, z: -0.6 }), part(new THREE.CapsuleGeometry(0.16, 0.5, 3, 8), '#2f9e55', { x: x + 0.38, y: y + 1.2, z: -0.6 }));
    else if (TH.deco === 'lamp') D.push(part(new THREE.CylinderGeometry(0.07, 0.09, 3, 8), '#2b2d42', { x, y: y + 1.5, z: -0.6 }), part(new THREE.SphereGeometry(0.28, 12, 8), '#fff3b0', { x, y: y + 3.1, z: -0.6 }));
    else D.push(part(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), '#6b4a2b', { x, y: y + 0.7, z: -0.6 }), part(new THREE.IcosahedronGeometry(0.9, 1), '#2fa865', { x, y: y + 1.9, z: -0.6 }));
  }
  if (D.length) world.add(new THREE.Mesh(merge(D), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  if (DEEP) buildProps();
}

// ---------------------------------------------------------------- characters (original cast)
const CAST = [
  { name: 'JACK', av: '🪓', shirt: '#e63946', pants: '#3a5a98', skin: '#f2c19c', hat: 'beanie', hatC: '#ffd23f', beard: '#7a4a22', weapon: 'axe' },
  { name: 'CHEF ROSA', av: '🍳', shirt: '#ffffff', pants: '#2b2d42', skin: '#e0a47a', hat: 'toque', hatC: '#ffffff', scarf: '#ff3d7f', weapon: 'pan' },
  { name: 'GRAN VALKA', av: '🛡️', shirt: '#3a9d5d', pants: '#5a3d2b', skin: '#f5cfb4', hat: 'horns', hatC: '#b8c0cc', braids: '#e8e8e8', weapon: 'spear' },
  { name: 'BOLT-9', av: '🤖', shirt: '#9aa7b8', pants: '#5d6b7d', skin: '#c9d3df', hat: 'robot', hatC: '#ff3d3d', weapon: 'wrench' },
  { name: 'DUSTY', av: '🤠', shirt: '#f4a259', pants: '#4b3b8f', skin: '#c68c5d', hat: 'cowboy', hatC: '#8a5a32', beard: '#3b2a1a', weapon: 'shoe' },
  { name: 'MAESTRO', av: '🎻', shirt: '#22223b', pants: '#22223b', skin: '#f1c7a5', hat: 'wig', hatC: '#f2f2f2', scarf: '#ffffff', weapon: 'baton' },
];
function weaponMesh(kind) {
  const P = [];
  if (kind === 'axe') P.push(part(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 8), '#8a5a32', {}), part(new THREE.BoxGeometry(0.36, 0.3, 0.06), '#c9d3df', { x: 0.16, y: 0.36 }), part(new THREE.BoxGeometry(0.06, 0.3, 0.07), '#7a8594', { x: 0.33, y: 0.36 }));
  if (kind === 'pan') P.push(part(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), '#2b2d42', {}), part(new THREE.CylinderGeometry(0.34, 0.3, 0.08, 20), '#3b3d52', { y: 0.55, rx: Math.PI / 2 }), part(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 20), '#ffd23f', { y: 0.55, z: 0.045, rx: Math.PI / 2 }));
  if (kind === 'spear') P.push(part(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8), '#a0754a', {}), part(new THREE.ConeGeometry(0.11, 0.38, 8), '#d6dde6', { y: 1.13 }), part(new THREE.ConeGeometry(0.09, 0.2, 3), '#ff3d7f', { y: -0.9, rx: Math.PI }));
  if (kind === 'wrench') P.push(part(new THREE.BoxGeometry(0.12, 0.9, 0.06), '#9aa7b8', {}), part(new THREE.TorusGeometry(0.15, 0.06, 6, 12, Math.PI * 1.5), '#9aa7b8', { y: 0.5, rz: -Math.PI * 0.25 }), part(new THREE.TorusGeometry(0.11, 0.05, 6, 12), '#9aa7b8', { y: -0.48 }));
  if (kind === 'shoe') P.push(part(new THREE.TorusGeometry(0.28, 0.08, 8, 16, Math.PI * 1.4), '#b8c0cc', { rz: -Math.PI * 0.2 }));
  if (kind === 'baton') P.push(part(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 8), '#ffffff', {}), part(new THREE.SphereGeometry(0.08, 8, 6), '#ffd23f', { y: -0.45 }), part(new THREE.SphereGeometry(0.05, 8, 6), '#ff3d7f', { y: 0.45 }));
  const m = new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }));
  return m;
}
function fighter(spec, face) {
  const root = new THREE.Group(); world.add(root);
  const M = c => mat(c, { roughness: 0.75 });
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const legs = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.2, 0, 0); hips.add(p); const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.5, 4, 10), M(spec.pants)); l.position.y = -0.42; p.add(l); const sh = new THREE.Mesh(rounded(0.28, 0.16, 0.4, 0.07), M('#2b2d42')); sh.position.set(0, -0.86, 0.08); p.add(sh); return p; });
  const torso = new THREE.Group(); hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 6, 16), M(spec.shirt)); body.position.y = 0.5; body.scale.z = 0.85; torso.add(body);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 20), M('#2b2d42')); belt.position.y = 0.12; belt.scale.z = 0.85; torso.add(belt);
  if (spec.scarf) { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 20), M(spec.scarf)); sc.rotation.x = Math.PI / 2; sc.position.y = 1.0; torso.add(sc); }
  const head = new THREE.Group(); head.position.y = 1.42; torso.add(head);
  const hm = new THREE.Mesh(spec.hat === 'robot' ? rounded(0.78, 0.68, 0.7, 0.16) : new THREE.SphereGeometry(0.44, 24, 18), M(spec.skin)); head.add(hm);
  // face: big cartoon eyes
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), M('#ffffff')); w.position.set(s * 0.15, 0.06, 0.38); w.scale.z = 0.5; head.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M('#1d1d28')); p.position.set(s * 0.15 + 0.02, 0.05, 0.43); head.add(p);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI), M('#5a1a2a')); mouth.position.set(0, -0.13, 0.4); mouth.rotation.z = Math.PI; head.add(mouth);
  if (spec.hat !== 'robot') { const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M(new THREE.Color(spec.skin).offsetHSL(0, 0.1, -0.08).getStyle())); nose.position.set(0, -0.03, 0.44); head.add(nose); }
  if (spec.beard) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), M(spec.beard)); b.position.set(0, -0.05, 0.06); b.scale.set(1.02, 1.0, 1.02); head.add(b); mouth.position.z = 0.47; }
  const hatM = M(spec.hatC);
  if (spec.hat === 'beanie') { const h = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hatM); h.position.y = 0.08; head.add(h); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M('#ffffff')); pom.position.y = 0.56; head.add(pom); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 8, 20), M('#e8a800')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.12; head.add(rim); }
  if (spec.hat === 'toque') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.4, 16), hatM); c.position.y = 0.48; head.add(c); for (const [x, z] of [[-0.18, 0], [0.18, 0], [0, 0.12], [0, -0.12]]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), hatM); p.position.set(x, 0.74, z); head.add(p); } }
  if (spec.hat === 'horns') { const h = new THREE.Mesh(new THREE.SphereGeometry(0.47, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hatM); h.position.y = 0.05; head.add(h); for (const s of [-1, 1]) { const hn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 10), M('#fff4e0')); hn.position.set(s * 0.48, 0.32, 0); hn.rotation.z = -s * 0.8; head.add(hn); const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), M(spec.braids)); br.position.set(s * 0.42, -0.35, 0.05); head.add(br); } }
  if (spec.hat === 'robot') { const v = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.05), M('#1d1d28')); v.position.set(0, 0.06, 0.36); head.add(v); const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), M('#2b2d42')); ant.position.y = 0.5; head.add(ant); const bl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), glossy(spec.hatC, { emissive: spec.hatC, emissiveIntensity: 0.6 })); bl.position.y = 0.7; head.add(bl); }
  if (spec.hat === 'cowboy') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 20), hatM); b.position.y = 0.26; head.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.42, 16), hatM); c.position.y = 0.46; head.add(c); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 16), M('#2b2d42')); band.position.y = 0.3; head.add(band); }
  if (spec.hat === 'wig') { for (const [x, y] of [[-0.38, 0.0], [0.38, 0.0], [-0.36, -0.25], [0.36, -0.25], [0, 0.3], [-0.25, 0.25], [0.25, 0.25]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), hatM); c.position.set(x, y, -0.05); head.add(c); } }
  const arms = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.5, 0.86, 0); torso.add(p); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 10), M(spec.shirt)); a.position.y = -0.33; p.add(a); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M(spec.skin)); hd.position.y = -0.66; p.add(hd); return p; });
  const wpn = weaponMesh(spec.weapon); wpn.position.y = -0.7; wpn.rotation.x = 0; arms[1].add(wpn);
  root.scale.setScalar(1.3); root.rotation.y = face * 0.55;
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { root, hips, torso, head, arms, legs, wpn, spec, face, hp: 100, lean: 0, leanV: 0, nod: 0, nodV: 0, push: 0, ko: 0, aim: 0, throwT: 0, x: 0, y: 0, stars: null };
}

// ---------------------------------------------------------------- projectiles + stars
const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.09 : 0.2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); })();
const starMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
function starRing(f) {
  const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(starGeo(), starMat); g.add(s); } f.head.add(g); g.position.y = 0.62; return g;
}
const starGeo = () => starShape;
const popStars = [];
function starPop(pos, n = 10) {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(starShape, new THREE.MeshBasicMaterial({ color: ['#ffd23f', '#ffffff', '#ff8fb1', '#7bdff2'][i % 4], transparent: true })); m.position.copy(pos); const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 4; popStars.push({ m, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, life: 1, spin: (Math.random() - 0.5) * 12 }); m.scale.setScalar(1 + Math.random()); scene.add(m); }
}

// ---------------------------------------------------------------- state
const G = 18;
let ctx = null, combo = 0, throws = 0, foeShots = 1, foeSlot = 0, ghost = null, hitsTaken = 0;
let lossRun = {}, lossKey = '';
let state = 'ready', phase = 'aim', you = null, foe = null, proj = null, drag = null, turnT = 0, slow = 1, slowT = 0, shake = 0, camX = 0, camY = 0, camW = 10, aiPlan = null, hits = 0, endT = 0, lastShooter = null;
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), 24); dots.frustumCulled = false; scene.add(dots);
function handPos(f) { return new THREE.Vector3(f.x + f.face * 0.4, f.y + 2.8, 0.3); }
function headPos(f) { return new THREE.Vector3(f.x + f.lean * -f.face * 0.6, f.y + 3.7, 0); }
function startLevel() {
  if (DEEP) { curL = levelData(); ctx = SIM.makeCtx(curL); combo = 0; throws = 0; foeSlot = 0; hitsTaken = 0; ghost = null; }
  buildWorld();
  const foeSpec = DEEP ? CAST[curL.foe] : CAST[1 + (level - 1) % (CAST.length - 1)];
  you = fighter(DEEP ? { ...CAST[0], weapon: myWeapon(), shirt: SHIRTS[save.get('shirt', 0)].c } : CAST[0], 1); foe = fighter(foeSpec, -1);
  you.x = -arenaD / 2; foe.x = arenaD / 2; you.y = hillF(you.x); foe.y = hillF(foe.x);
  you.bx = you.x; foe.bx = foe.tbx = foe.x; you.px = foe.px = you.pxV = foe.pxV = 0;
  if (DEEP) { ctx.foeX = foe.bx; ctx.youX = you.bx; placeShield(); }
  fk = F.k(); foe.maxHp = Math.round((DEEP ? curL.hp : 100 + Math.min(60, (level - 1) * 10)) * fk); foe.hp = foe.maxHp; you.maxHp = 100; you.hp = 100;
  hud.querySelector('[data-a1]').textContent = foeSpec.av; names.querySelector('[data-n1]').textContent = foeSpec.name; names.querySelector('[data-n0]').textContent = 'JACK (YOU)';
  hud.querySelector('[data-a0]').textContent = DEEP ? WEAPON_EMOJI[myWeapon()] : '🪓';
  lossKey = String(DEEP ? level + (daily ? 'd' : '') : 0); phase = 'aim'; proj = null; drag = null; hits = 0; slow = 1; slowT = 0; endT = 0; aiPlan = null;
  camX = you.x + camW * 0.28; camY = you.y + 4;
  ui.levels(level); ui.progress(0); setHP(); say(DEEP && hardOf(level) ? 'HARD DUEL!' : 'YOUR TURN');
  if (DEEP) renderMeta();
}
function setHP() {
  for (const [f, k] of [[you, 0], [foe, 1]]) { const el = hud.querySelector(`[data-h${k}]`), p = Math.max(0, f.hp / f.maxHp) * 100 + '%'; el.querySelector('i').style.width = p; el.querySelector('b').style.width = p; }
  ui.progress(1 - Math.max(0, foe.hp) / foe.maxHp);
}
let sayT = 0, punch = 0;
function say(t) { turnEl.textContent = t; turnEl.style.opacity = 1; sayT = 1.4; }
function throwFrom(f, ang, pw) {
  const v = 8 + pw * 17, h = handPos(f);
  const mesh = weaponMesh(f.spec.weapon); mesh.scale.setScalar(1.15); scene.add(mesh); f.wpn.visible = false;
  proj = { by: f, target: f === you ? foe : you, x: h.x, y: h.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, m: mesh, spin: f.spec.weapon === 'spear' || f.spec.weapon === 'baton' ? 0 : -f.face * 14, rot: 0, stuck: 0, done: false, t: 0 };
  if (DEEP) { const mine = f === you; ctx.foeX = foe.bx; proj.sp = SIM.launch(ctx, mine ? 'you' : 'foe', ang, pw, mine ? WP() : SIM.WEAPONS.axe); proj.acc = 0; proj.minD = 1e9; proj.nb = 0; proj.popped = false; if (mine) { throws++; renderMeta(); } }
  f.throwT = 1; phase = 'fly'; lastShooter = f;
  tone(380, 0.12, 'sawtooth', 0.06, 0.4); tone(700, 0.18, 'sine', 0.06, 0.5); buzz(10);
}
function solve(f, target, v) {
  // low-arc launch angle from hand to target head; returns null if out of range
  const h = handPos(f), t = headPos(target), dx = (t.x - h.x) * f.face, dy = t.y - h.y;
  const disc = v ** 4 - G * (G * dx * dx + 2 * dy * v * v); if (disc < 0) return null;
  const a = Math.atan((v * v - Math.sqrt(disc)) / (G * dx));
  return f.face > 0 ? a : Math.PI - a;
}
function bestShot(f, target) {
  for (let pw = 0.55; pw <= 1.0001; pw += 0.05) { const a = solve(f, target, 8 + pw * 17); if (a !== null) return { ang: a, pw }; }
  return { ang: f.face > 0 ? 0.8 : Math.PI - 0.8, pw: 1 };
}
function hitCheck(p) {
  const tg = p.target, hp = headPos(tg);
  if (Math.hypot(p.x - hp.x, p.y - hp.y) < 0.6) return 'head';
  const bx = tg.x + tg.lean * -tg.face * 0.3, y0 = tg.y + 0.4, y1 = tg.y + 3.05;
  if (Math.abs(p.x - bx) < 0.55 && p.y > y0 && p.y < y1) return 'body';
  return null;
}
function onHit(p, kind) {
  const tg = p.target, head = kind === 'head';
  const mine = DEEP && p.by === you, dmg = DEEP ? deepDamage(p, kind) : head ? 50 + Math.floor(Math.random() * 8) : 22 + Math.floor(Math.random() * 9);
  tg.hp -= dmg; setHP();
  tg.leanV += (head ? 9 : 6) * (p.vx > 0 ? 1 : -1) * -tg.face * -1; tg.nodV += head ? 16 : 6; if (DEEP) tg.pxV += (p.vx > 0 ? 1 : -1) * (head ? 3.5 : 2.2); else tg.push += (p.vx > 0 ? 1 : -1) * (head ? 0.5 : 0.3);
  // stick the weapon to the target (comedy, no gore)
  p.stuck = 1; p.done = true; p.vx = p.vy = 0;
  p.m.position.set(p.x, p.y, 0.4); p.m.updateMatrixWorld(); tg.torso.attach(p.m);
  const at = new THREE.Vector3(p.x, p.y, 0.3), sp = at.clone().project(camera);
  starPop(at, head ? 16 : 9); confetti(scene, at, head ? 40 : 18);
  dmgText('-' + dmg, (sp.x + 1) / 2 * innerWidth, (1 - sp.y) / 2 * innerHeight - 30, head ? '#ffd23f' : '#ffffff', head ? 46 : 36);
  if (p.lucky) { ui.pop('LUCKY x2!', '#ffd23f', 52, 28); confetti(scene, at, 60); tone(1175, 0.1, 'triangle', 0.12, 1.4); tone(1568, 0.16, 'triangle', 0.1, 1.3); }
  else if (head) { ui.pop('BULLSEYE!', '#ffd23f', 44, 24); sfx.smash(); } else { tone(150, 0.15, 'square', 0.1, 0.5); tone(90, 0.2, 'sine', 0.12, 0.6); }
  tone(880, 0.08, 'triangle', 0.1, 1.5); buzz(head ? [30, 30, 50] : 25); shake = head ? 1.6 : 0.9; ui.flash(head ? 0.35 : 0.18);
  if (tg === foe) hits++;
  if (DEEP) { p.attached = true; if (mine) { combo++; if (combo >= 2) { say(`COMBO x${combo}!`); if (combo >= 3) ui.flash(0.3); tone(520 + combo * 90, 0.12, 'triangle', 0.1, 1.3); } if (p.sp.bal) dmgText('x1.5', (sp.x + 1) / 2 * innerWidth + 40, (1 - sp.y) / 2 * innerHeight - 70, '#7bdff2', 34); renderMeta(); } else hitsTaken++; }
  if (tg.hp <= 0) { tg.ko = 0.001; slow = 0.25; slowT = 1.3; tg.stars = starRing(tg); ui.pop('K.O.!', '#ff3d7f', 64, 34); }
  else if (head) { slow = 0.18; slowT = 0.42; punch = 1; }
  else { slow = 0.35; slowT = 0.22; punch = 0.4; }
}
function nextTurn() {
  if (proj) { const p = proj; setTimeout(() => { p.m.removeFromParent(); }, p.stuck ? 900 : 0); proj = null; }
  you.wpn.visible = foe.wpn.visible = true;
  if (foe.hp <= 0 && DEEP) return deepWin();
  if (you.hp <= 0 && DEEP) return deepLose();
  if (foe.hp <= 0) { phase = 'over'; state = 'won'; F.level(true); B.submit(1); save.set('level', level + 1); sfx.win(); confetti(scene, new THREE.Vector3(foe.x, foe.y + 3, 0.5), 90); ui.win(level, `${foe.spec.name} is down · ${hits} hit${hits > 1 ? 's' : ''}`); return; }
  if (you.hp <= 0) { lossRun[lossKey] = (lossRun[lossKey] || 0) + 1; phase = 'over'; state = 'lost'; F.level(false, 1 - Math.max(0, foe.hp) / foe.maxHp); sfx.fail(); ui.lose('K.O.!', `${foe.spec.name} had ${Math.max(0, foe.hp)} HP left`); return; }
  if (lastShooter === you) { phase = 'foe'; turnT = 0; aiPlan = null; foeShots = DEEP ? curL.volley : 1; say(`${foe.spec.name}'S TURN`); }
  else {
    if (DEEP && --foeShots > 0) { phase = 'foe'; turnT = 0.55; aiPlan = null; return; }
    if (DEEP) foeStep();
    phase = 'aim'; say('YOUR TURN');
    if (DEEP && (lossRun[lossKey] || 0) >= 3 && throws % 3 === 0) { const b = bestShot(you, foe); say(`TRY ~${Math.round(b.pw * 100)}% POWER`); }
  }
}

// ---------------------------------------------------------------- input
function aimFromDrag(d) {
  const px = d.sx - d.cx, py = d.sy - d.cy, len = Math.hypot(px, py);
  let ang = Math.atan2(-py, px); ang = clamp(ang, -0.35, 1.5);
  return { ang, pw: clamp(len / (innerHeight * 0.3), 0, 1), len };
}
// a tap throws in the tapped direction (from your hand); power is picked to carry that arc about as far as the rival, give or take
function tapThrow(x, y) {
  const h = handPos(you), p = h.clone().project(camera), hx = (p.x + 1) / 2 * innerWidth, hy = (1 - p.y) / 2 * innerHeight;
  let ang = Math.hypot(x - hx, y - hy) < 30 ? 0.7 : clamp(Math.atan2(hy - y, (x - hx) * you.face), -0.35, 1.5); if (you.face < 0) ang = Math.PI - ang;
  const t = headPos(foe), dx = (t.x - h.x) * you.face, dy = t.y - h.y, a = you.face > 0 ? ang : Math.PI - ang, k = dx * Math.tan(a) - dy;
  const v = k > 0 ? Math.sqrt(G * dx * dx / (2 * Math.cos(a) ** 2 * k)) * (1 + (Math.random() - 0.5) * 0.08) : 25;
  throwFrom(you, ang, clamp((v - 8) / 17, 0.1, 1));
}
input({
  onDown: e => { if (state !== 'play' || phase !== 'aim' || (DEEP && foe.walking)) return; drag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY }; },
  onMove: (dx, dy, e) => { if (!drag) return; drag.cx = e.clientX; drag.cy = e.clientY; },
  onUp: () => { if (!drag) return; const a = aimFromDrag(drag), d = drag; drag = null; if (phase !== 'aim' || state !== 'play') return; if (a.len < 12) { if (!DEEP || assisted()) tapThrow(d.sx, d.sy); else ui.pop('DRAG BACK TO AIM', '#fff', 26, 30); } else if (a.pw > 0.08) throwFrom(you, a.ang, a.pw); },
});
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, until the first real touch,
// your aim is pulled back and swept around the rival's head (arc dots + power bubble), so the screen shows what a drag does; no throw
const DF = demo(null, { ready: () => state === 'play' && level === 1 && phase === 'aim' && (!drag || drag === demoDrag), wait: 900, ms: 5000 });
let demoDrag = null;
function demoAim() {
  if (DF.on && phase === 'aim' && (!drag || drag === demoDrag)) {
    const b = bestShot(you, foe), T = performance.now() / 1000, ang = b.ang + Math.sin(T * 2.1) * 0.3, len = b.pw * (0.75 + 0.25 * Math.sin(T * 1.3)) * innerHeight * 0.3;
    drag = demoDrag = { sx: 120, sy: 520, cx: 120 - Math.cos(ang) * len, cy: 520 + Math.sin(ang) * len };
  } else if (demoDrag) { if (drag === demoDrag) drag = null; demoDrag = null; }
}
ui.onTap(w => {
  if (DEEP) { if (w === 'win') { if (daily) { openMap(); return; } go(level + 1); } else go(level); return; }
  if (w === 'win') level++; if (you) { scene.remove(you.root); } if (foe) scene.remove(foe.root); startLevel(); state = 'play'; B.start();
});

// ---------------------------------------------------------------- loop
const o3 = new THREE.Object3D(), tmp = new THREE.Vector3();
function animFighter(f, sec, t, aimAng) {
  // spring lean / nod (ragdoll-ish wobble)
  f.leanV += (-f.lean * 60 - f.leanV * 7) * sec; f.lean += f.leanV * sec;
  f.nodV += (-f.nod * 90 - f.nodV * 8) * sec; f.nod += f.nodV * sec;
  if (DEEP) { f.pxV += (-f.px * 40 - f.pxV * 8) * sec; f.px += f.pxV * sec; const dd = (f.tbx ?? f.bx) - f.bx; f.walking = Math.abs(dd) > 0.02; f.bx += clamp(dd, -4 * sec, 4 * sec); f.x = f.bx + f.px; }
  else { f.x += f.push * sec * 4; f.push *= Math.pow(0.02, sec); }
  f.y = hillF(f.x);
  f.root.position.set(f.x, f.y, 0);
  f.torso.rotation.z = clamp(f.lean, -0.9, 0.9) + Math.sin(t * 2.2 + f.face) * 0.03;
  f.head.rotation.z = clamp(f.nod, -0.8, 0.8) * 0.5; f.head.rotation.x = -Math.abs(f.nod) * 0.2;
  f.hips.position.y = 0.95 + Math.sin(t * 2.2 + f.face) * 0.02;
  // arms: throwing arm follows the aim, then swings through
  f.throwT = Math.max(0, f.throwT - sec * 3.5);
  const armBase = aimAng !== null ? -(Math.PI / 2 + aimAng * 0.6) - 0.9 : -0.3;
  f.arms[1].rotation.z = f.throwT > 0 ? lerp(-0.2, -2.6, f.throwT) * f.face * -1 * -1 : armBase * (f.face > 0 ? -1 : 1) * -1;
  f.arms[1].rotation.z = f.throwT > 0 ? -f.face * lerp(0.9, -2.4, f.throwT) : -f.face * (aimAng !== null ? -(2.2 + aimAng * 0.5) : -0.35);
  f.arms[0].rotation.z = f.face * 0.35 + Math.sin(t * 2) * 0.05;
  f.legs[0].rotation.z = 0.08; f.legs[1].rotation.z = -0.08;
  if (DEEP && f.walking) { f.legs[0].rotation.z = Math.sin(t * 16) * 0.6; f.legs[1].rotation.z = -Math.sin(t * 16) * 0.6; f.hips.position.y += Math.abs(Math.sin(t * 16)) * 0.08; }
  if (f.ko > 0) {
    f.ko = Math.min(1, f.ko + sec * 2.2); const e = 1 - Math.pow(1 - f.ko, 3);
    f.root.rotation.z = f.face * e * (DEEP ? 1.57 + Math.sin(f.ko * Math.PI) * 2.4 : 1.45); f.root.position.y = f.y + Math.sin(f.ko * Math.PI) * (DEEP ? 2.4 : 0.6);
    f.legs[0].rotation.x = -e * 0.6; f.arms[0].rotation.z = f.face * (0.35 + e * 1.8); f.arms[1].rotation.z = -f.face * e * 1.5;
  } else f.root.rotation.z = 0;
  if (f.stars) { f.stars.rotation.y += sec * 6; f.stars.children.forEach((s, i) => { const a = i / 5 * Math.PI * 2; s.position.set(Math.cos(a) * 0.55, Math.sin(t * 6 + i) * 0.05, Math.sin(a) * 0.55); s.rotation.y = -f.stars.rotation.y; }); }
}
loop((dtRaw, t) => {
  const real = Math.min(dtRaw / 60, 1 / 30);
  if (slowT > 0) { slowT -= real; if (slowT <= 0) slow = 1; }
  const sec = real * slow;
  if (sayT > 0) { sayT -= real; if (sayT <= 0) turnEl.style.opacity = 0; }
  if (!you) return;
  // aim state
  demoAim();
  if (DEEP) deepFrame(real, t);
  const aiming = state === 'play' && phase === 'aim' && drag && Math.hypot(drag.cx - drag.sx, drag.cy - drag.sy) > 8;
  const a = aiming ? aimFromDrag(drag) : null;
  // AI turn
  let foeAim = null;
  if (state === 'play' && phase === 'foe') {
    turnT += real;
    if (!aiPlan) { const b = DEEP ? foeShotFor() : bestShot(foe, you), err = DEEP ? Math.max(0.02, curL.err / fk) : Math.max(0.03, (0.2 - level * 0.022) / fk); aiPlan = { ang: b.ang + (Math.random() - 0.5) * 2 * err, pw: clamp(b.pw * (1 + (Math.random() - 0.5) * err * 1.4), 0.1, 1) }; }
    const k = clamp((turnT - 0.5) / 0.7, 0, 1); foeAim = (Math.PI - aiPlan.ang) * k;
    if (turnT > 1.35) { throwFrom(foe, aiPlan.ang, aiPlan.pw); }
  }
  animFighter(you, sec, t, a ? a.ang : null);
  animFighter(foe, sec, t, foeAim);
  // projectile
  if (proj && !proj.done) {
    const p = proj, n = DEEP ? 0 : 4, h = sec / n;
    if (DEEP) deepFly(p, sec);
    for (let i = 0; i < n && !p.done; i++) {
      p.vy -= G * h; p.x += p.vx * h; p.y += p.vy * h; p.t += h; p.rot += p.spin * h;
      const kind = p.t > 0.08 ? hitCheck(p) : null;
      if (kind) { onHit(p, kind); break; }
      const self = p.by, sh = headPos(self);
      if (p.y < hillF(p.x) + 0.05) { p.done = true; p.stuck = 1; p.y = hillF(p.x) + 0.05; burst(scene, new THREE.Vector3(p.x, p.y, 0.4), [TH.top, '#ffffff', TH.ground], 10, { speed: 0.06, up: 0.08, size: 0.45 }); tone(110, 0.12, 'sine', 0.12, 0.6); ui.pop(['MISSED!', 'SO CLOSE!', 'WHOOPS!'][Math.floor(Math.random() * 3)], '#ffffff', 28, 30); }
      if (Math.abs(p.x) > 60 || p.y < -20) { p.done = true; }
    }
    if (!(DEEP && p.attached)) { p.m.position.set(p.x, p.y, 0.4); if (p.spin) p.m.rotation.z = p.rot; else p.m.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2; }
  }
  if (proj && proj.done) { proj.after = (proj.after || 0) + real; if (proj.after > (proj.by.hp <= 0 || proj.target.hp <= 0 ? 1.6 : 0.75)) nextTurn(); }
  // popping stars
  for (let i = popStars.length - 1; i >= 0; i--) { const s = popStars[i]; s.vy -= 9 * sec; s.m.position.x += s.vx * sec; s.m.position.y += s.vy * sec; s.m.rotation.z += s.spin * sec; s.life -= sec * 1.2; s.m.material.opacity = Math.max(0, s.life); if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); popStars.splice(i, 1); } }
  // trajectory preview: only the first part of the arc, near you
  dots.visible = !!a;
  if (a) {
    const wpn = DEEP ? WP() : null, v = (8 + a.pw * 17) * (wpn ? wpn.spd : 1), hp = handPos(you), nD = DEEP && level <= 6 && !daily ? 22 : 12, wm = DEEP ? curL.wind * wpn.wind : 0;
    dots.count = nD;
    for (let i = 0; i < nD; i++) { const tt = (i + 1) * 0.045; o3.position.set(hp.x + Math.cos(a.ang) * v * tt + 0.5 * wm * tt * tt, hp.y + Math.sin(a.ang) * v * tt - 0.5 * G * tt * tt, 0.5); o3.scale.setScalar(1 - i / (nD + 2)); o3.updateMatrix(); dots.setMatrixAt(i, o3.matrix); }
    dots.instanceMatrix.needsUpdate = true;
    tmp.set(you.x, you.y + 4.6, 0).project(camera); bub.style.display = 'block'; bub.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; bub.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px';
    bub.querySelector('[data-p]').textContent = Math.round(a.pw * 100) + '%'; bub.querySelector('[data-g]').textContent = Math.round(a.ang * 180 / Math.PI) + '°';
  } else bub.style.display = 'none';
  // camera: frame the shooter, follow the projectile, then frame the target
  const aspect = innerWidth / innerHeight; camW = DEEP ? clamp(arenaD + 1.5, 11, 24) * (1 - punch * 0.3) : aspect < 0.7 ? 9.5 : 18;
  let tx;
  if (DEEP) tx = (you.bx + foe.bx) / 2 + (punch > 0.05 && proj && proj.target ? (proj.target.x - (you.bx + foe.bx) / 2) * Math.min(1, punch) * 0.6 : 0);
  else if (phase === 'aim') tx = you.x + camW * 0.3;
  else if (phase === 'foe') tx = foe.x - camW * 0.3;
  else if (proj) tx = clamp(proj.x, you.x + camW * 0.3, foe.x - camW * 0.3);
  else tx = camX;
  if (state !== 'play' && (you.ko || foe.ko)) tx = (you.ko ? you.x : foe.x) + (you.ko ? 1 : -1) * camW * 0.05;
  camX = lerp(camX, tx, 1 - Math.pow(phase === 'fly' ? 0.02 : 0.05, real));
  const gy = hillF(camX), ty = DEEP ? gy + Math.max(5, camW / aspect * 0.26) : gy + 3.4 + (proj && !proj.done ? Math.max(0, proj.y - gy - 6) * 0.6 : 0);
  camY = lerp(camY, ty, 1 - Math.pow(0.05, real));
  shake = Math.max(0, shake - real * 2.5); punch = Math.max(0, punch - real * 2.2);
  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), dist = (camW / 2) / (vt * aspect);
  camera.position.set(camX + (Math.random() - 0.5) * shake * 0.3, camY + (Math.random() - 0.5) * shake * 0.3, dist);
  camera.lookAt(camX, camY, 0);
});

// ================================================================ deep v2 (campaign, props, stars, weapons, daily duel)
const WEAPON_EMOJI = { axe: '🪓', pan: '🍳', spear: '🔱', shoe: '👟', wrench: '🔧', baton: '🪄' };
const SHIRTS = [{ n: 'Red', c: '#e63946', m: 0 }, { n: 'Teal', c: '#2ec4b6', m: 1 }, { n: 'Gold', c: '#ffbe0b', m: 3 }, { n: 'Violet', c: '#8e5cf0', m: 5 }, { n: 'Pink', c: '#ff4fa3', m: 8 }, { n: 'Night', c: '#2a2f55', m: 12 }];
const totalStars = () => Object.values(starsBy).reduce((a, b) => a + b, 0) + (save.get('bonus', 0) | 0);
const starsFor = (n, par) => n <= par ? 3 : n <= par + 2 ? 2 : 1;
const dayNum = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayIndex = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 9, 31)) / 864e5) + 1; };
const yesterNum = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const myWeapon = () => { const k = save.get('weapon', 'axe'); return SIM.WEAPONS[k] && totalStars() >= SIM.WEAPONS[k].stars ? k : 'axe'; };
const WP = () => SIM.WEAPONS[myWeapon()];
const assisted = () => !daily && level <= 3;
const medals = () => save.get('medals', 0), streak = () => (save.get('lastWin', 0) === dayNum() || save.get('lastWin', 0) === yesterNum()) ? save.get('streak', 0) : 0;
const shirtOk = (i) => medals() >= SHIRTS[i].m;
const genCache = {};
function levelData() {
  if (daily) return genCache['d' + dayNum()] ??= Object.assign(genLevel(dayNum(), 4), { n: 'Daily Duel' });
  if (level <= LEVELS.length) return LEVELS[level - 1];
  return genCache['b' + level] ??= Object.assign(genLevel(level * 13, level - LEVELS.length), { n: 'Brawl ' + (level - LEVELS.length) });
}
function themeOf() { return daily ? dayNum() % THEMES.length : level <= LEVELS.length ? WORLDS[worldOf(level) - 1].theme : level % THEMES.length; }
const hardNow = () => !daily && hardOf(level);

let balloon = null, flag = null, wallMesh = null, shieldMesh = null, ghostMesh = null, wallBump = 0, shieldWob = 0, metaEl = null, windEl = null, hardEl = null, mapBtn = null, mapEl = null;
function buildProps() {
  balloon = flag = wallMesh = shieldMesh = ghostMesh = null; wallBump = shieldWob = 0;
  if (ctx.wall) {
    const w = ctx.wall, g0 = hillF(w.x) - 3, h = w.top - g0, grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(w.w * 2, h, 1.2), mat('#9c8b7a', { roughness: 0.9 })));
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w.w * 2 + 0.16, 0.22, 1.3), mat('#cdbfae', { roughness: 0.8 })); cap.position.y = h / 2; grp.add(cap);
    for (let i = 1; i < Math.floor(h / 0.9); i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(w.w * 2 + 0.02, 0.05, 1.22), mat('#7d6e60')); l.position.y = -h / 2 + i * 0.9; grp.add(l); }
    grp.position.set(w.x, g0 + h / 2, 0.1); world.add(grp); wallMesh = grp;
  }
  if (ctx.bal) {
    const g = new THREE.Group(), b = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 16), glossy('#ff3d5a', { emissive: '#ff3d5a', emissiveIntensity: 0.25 })); b.scale.y = 1.2; g.add(b);
    const kn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), glossy('#ff3d5a')); kn.position.y = -0.74; kn.rotation.x = Math.PI; g.add(kn);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.1, 4), mat('#ffffff')); st.position.y = -1.3; g.add(st);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat('#ffffff')); sh.position.set(-0.2, 0.28, 0.45); sh.scale.set(1, 1.5, 0.5); g.add(sh);
    g.position.set(ctx.bal.x, ctx.bal.y, 0.2); world.add(g); balloon = g;
  }
  { // wind pennant on a pole next to the thrower
    const g = new THREE.Group(), x = ctx.p0 + 3.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 8), mat('#ffffff')); pole.position.set(0, 1.7, 0); g.add(pole);
    const fg = new THREE.BoxGeometry(1.5, 0.55, 0.05); fg.translate(0.75, 0, 0);
    const f = new THREE.Mesh(fg, mat('#ffd23f', { emissive: '#ffd23f', emissiveIntensity: 0.3 })); f.position.y = 3.0; g.add(f); g.userData.f = f;
    g.position.set(x, hillF(x), -1.2); world.add(g); flag = g;
  }
  { const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 8), mat('#ff3d7f', { emissive: '#ff3d7f', emissiveIntensity: 0.4 })); m.rotation.x = Math.PI; m.visible = false; world.add(m); ghostMesh = m; }
}
function placeShield() {
  if (!curL.shield) return;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.1, 1.1), glossy('#9aa7b8')));
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.7, 0.7), glossy('#ff3d7f', { emissive: '#ff3d7f', emissiveIntensity: 0.2 })); r.position.x = -0.04; g.add(r);
  world.add(g); shieldMesh = g;
}
const starRow = (n, max = 3) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? '' : 'off'}">★</i>`).join('');
function renderMeta() {
  if (!metaEl) return;
  const can = starsFor(throws + 1, curL.par), nm = daily ? 'Daily Duel' : level <= LEVELS.length ? `${level} · ${curL.n}` : curL.n;
  metaEl.innerHTML = `<div class="st">${daily ? '' : starRow(can)}</div><div class="nm">${nm}${hardNow() ? '<span class="ff-hardb">HARD</span>' : ''}${daily ? '' : ` <span class="ff-par">throw ${throws + 1}/${curL.par}</span>`}</div>${combo >= 2 ? `<div class="ff-combo">COMBO x${combo} · +${Math.min(50, (combo - 1) * 25)}%</div>` : ''}`;
  hardEl.classList.toggle('hc-hidden', !hardNow());
  const w = curL.wind, n = Math.abs(w) < 0.01 ? 0 : 1 + (Math.abs(w) > 0.9) + (Math.abs(w) > 1.6);
  windEl.innerHTML = n ? `<span>${w < 0 ? '◀'.repeat(n) : '▶'.repeat(n)}</span> WIND` : '';
}
function deepFrame(real, t) {
  if (!ctx || !you || !foe) return;
  ctx.foeX = foe.bx; ctx.youX = you.bx;
  if (balloon) { balloon.position.y = ctx.bal.y + Math.sin(t * 1.7) * 0.12; balloon.rotation.z = Math.sin(t * 1.3) * 0.06; }
  if (flag) { const w = curL.wind, f = flag.userData.f; f.scale.x = w ? Math.sign(w) * (0.45 + Math.min(1, Math.abs(w) / 1.9) * 0.75) : 0.15; f.rotation.z = w ? Math.sin(t * 7) * 0.12 * Math.abs(w) : -1.35; f.rotation.y = w ? Math.sin(t * 5) * 0.2 : 0; }
  if (shieldMesh) { shieldWob = Math.max(0, shieldWob - real * 3); shieldMesh.position.set(foe.x - 0.78 - shieldWob * 0.1, foe.y + 1.7, 0.2); shieldMesh.rotation.z = Math.sin(shieldWob * 18) * shieldWob * 0.2; }
  if (wallMesh) { wallBump = Math.max(0, wallBump - real * 3); wallMesh.rotation.z = Math.sin(wallBump * 20) * wallBump * 0.04; }
  if (ghostMesh && ghostMesh.visible) ghostMesh.position.y = ghostMesh.userData.y + Math.sin(t * 5) * 0.08;
}
function popBalloon() {
  if (!balloon) return; balloon.visible = false;
  const at = balloon.position.clone(); burst(scene, at, ['#ff3d5a', '#ffffff', '#ffd23f'], 22, { speed: 0.1, up: 0.1, size: 0.6, shape: 'sphere' });
  tone(980, 0.08, 'triangle', 0.14, 1.5); tone(1320, 0.12, 'sine', 0.1, 1.2); buzz(15); ui.pop('BALLOON! x1.5', '#7bdff2', 34, 26);
}
function deepDamage(p, kind) {
  if (p.by === you) {
    const d = SIM.damage(kind, WP(), combo, p.sp.bal);
    p.lucky = level >= 2 && Math.random() < 0.18;
    return p.lucky ? Math.round(d * 2) : d;
  }
  const easeL = 1 - 0.25 * Math.min(2, lossRun[lossKey] || 0);
  return Math.max(1, Math.round((kind === 'head' ? 50 : 25) * curL.fdmg * easeL * (curL.volley > 1 ? 0.65 : 1)));
}
function deepFly(p, sec) {
  const sp = p.sp, mine = p.by === you, tw = mine ? 'foe' : 'you';
  p.acc += sec;
  while (p.acc >= SIM.H && !sp.done) {
    p.acc -= SIM.H; SIM.step(ctx, sp);
    const hd = SIM.headOf(ctx, tw), d = Math.hypot(sp.x - hd.x, sp.y - hd.y); if (d < p.minD) p.minD = d;
    if (sp.bal && mine && !p.popped) { p.popped = true; popBalloon(); }
    if (sp.bounces > p.nb) { p.nb = sp.bounces; tone(260, 0.1, 'sine', 0.12, 1.5); burst(scene, new THREE.Vector3(sp.x, sp.y, 0.4), [TH.top, '#ffffff'], 6, { speed: 0.05, up: 0.07, size: 0.35 }); }
  }
  p.x = sp.x; p.y = sp.y; p.vx = sp.vx; p.vy = sp.vy; p.rot += p.spin * sec;
  if (!sp.done) return;
  if (sp.kind === 'head' || sp.kind === 'body') { onHit(p, sp.kind); return; }
  p.done = true; p.stuck = 1;
  const at = new THREE.Vector3(sp.x, sp.y, 0.4), near = p.minD < 1.7;
  if (sp.kind === 'shield') {
    shieldWob = 1; starPop(at, 6); tone(1500, 0.1, 'square', 0.12, 0.6); tone(900, 0.14, 'sine', 0.1, 0.7); buzz(20); shake = 0.4; ui.pop('CLANG! aim high', '#cfd8e6', 30, 30);
    p.vx = p.vy = 0;
  } else if (sp.kind === 'wall') {
    wallBump = 1; burst(scene, at, ['#cdbfae', '#9c8b7a', '#ffffff'], 12, { speed: 0.07, up: 0.06, size: 0.5 }); tone(95, 0.2, 'sine', 0.16, 0.5); shake = 0.35; ui.pop('THUD! lob it', '#e8dccb', 30, 30);
    p.y = Math.max(hillF(p.x) + 0.05, p.y - 0.5);
  } else {
    p.y = hillF(p.x) + 0.05; burst(scene, new THREE.Vector3(p.x, p.y, 0.4), [TH.top, '#ffffff', TH.ground], 10, { speed: 0.06, up: 0.08, size: 0.45 }); tone(110, 0.12, 'sine', 0.12, 0.6);
    const dx = sp.x - (mine ? foe.x : you.x), ad = Math.abs(dx), cue = ad < 0.8 ? 'a hair' : ad < 3 ? 'a bit' : 'far';
    const dir = (mine ? dx < 0 : dx > 0) ? 'short' : 'long';
    ui.pop(mine ? (near ? 'SO CLOSE! ' : '') + cue + ' ' + dir : near ? 'PHEW!' : 'MISSED!', near ? '#ffd23f' : '#ffffff', near ? 36 : 28, 30);
  }
  if (mine) {
    if (combo >= 2) { say('COMBO LOST'); }
    combo = 0; renderMeta();
    if (ghostMesh) { ghostMesh.visible = true; ghostMesh.position.set(sp.x, hillF(sp.x) + 0.7, 0.3); ghostMesh.userData.y = hillF(sp.x) + 0.7; }
  }
}
const shotCache = new Map();
function foeShotFor() {
  ctx.foeX = foe.bx;
  const k = curL.seed + '|' + curL.d + '|' + curL.wind + '|' + foe.bx.toFixed(2); let b = shotCache.get(k);
  if (!b) { b = SIM.bestShot(ctx, 'foe') || bestShot(foe, you); shotCache.set(k, b); }
  return b;
}
function foeStep() {
  if (curL.slots) { foeSlot = (foeSlot + 1) % curL.slots.length; foe.tbx = ctx.p1 + curL.slots[foeSlot]; }
  if (balloon) balloon.visible = true;
  renderMeta();
}
function tomorrowLine() {
  const done = save.get('dailyDay', 0) === dayNum(), st = streak();
  return done ? `Tomorrow: Daily Duel #${dayIndex() + 1} · 🔥 day ${st + 1}` : `Daily Duel #${dayIndex()} waits · 🏅 ${medals()}${st ? ` · 🔥 ${st}` : ''}`;
}
function cardExtras(card, after) {
  let t = card.querySelector('.ff-tmr'); if (!t) { t = document.createElement('p'); t.className = 'ff-tmr'; after.after(t); }
  t.textContent = tomorrowLine(); return t;
}
function addRow(card, html, sel) {
  const hint = card.querySelector('.hint'); hint.innerHTML = html; hint.style.animation = 'none';
  const b = (q, fn) => { const e = hint.querySelector(q); if (!e) return; e.addEventListener('pointerdown', ev => ev.stopPropagation()); e.addEventListener('click', ev => { ev.stopPropagation(); card.classList.add('hc-hidden'); fn(); }); };
  return b;
}
function deepWin() {
  phase = 'over'; state = 'won'; F.level(true); B.submit(1); sfx.win(); buzz([20, 40, 20, 40, 60]); ui.flash(0.5);
  confetti(scene, new THREE.Vector3(foe.x, foe.y + 3, 0.5), 90); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.12, 1), i * 90));
  const card = ui.els.win, lv = level, n = starsFor(throws, curL.par), before = totalStars();
  let firstClear = false, extra = `${foe.spec.name} is down · ${throws} throw${throws > 1 ? 's' : ''}` + (daily ? '' : ` · 3 stars: ${curL.par} throw${curL.par > 1 ? 's' : ''} or fewer`), note = '';
  if (daily) {
    if (save.get('dailyDay', 0) !== dayNum()) {
      const st = save.get('lastWin', 0) === yesterNum() ? save.get('streak', 0) + 1 : 1;
      save.set('dailyDay', dayNum()); save.set('lastWin', dayNum()); save.set('streak', st); save.set('medals', medals() + 1);
      const nu = SHIRTS.findIndex((s, i) => s.m === medals()); note = nu > 0 ? `New shirt: ${SHIRTS[nu].n}!` : `🏅 Medal ${medals()} · 🔥 day ${st}`; if (nu > 0) save.set('shirt', nu);
    } else note = 'Daily medal already won today';
  } else {
    const prev = starsBy[lv] || 0; firstClear = !prev; if (prev && n > prev) extra += ' · NEW BEST'; if (n > prev) { starsBy[lv] = n; save.set('stars', starsBy); }
    if (lv + 1 > unlocked) { unlocked = lv + 1; save.set('unlocked', unlocked); }
    const got = SIM.WEAPON_ORDER.filter(k => SIM.WEAPONS[k].stars > before && SIM.WEAPONS[k].stars <= totalStars());
    const nxt = SIM.WEAPON_ORDER.find(k => SIM.WEAPONS[k].stars > totalStars());
    if (got.length) { save.set('weapon', got[got.length - 1]); note = `New: ${SIM.WEAPONS[got[got.length - 1]].name} ${WEAPON_EMOJI[got[got.length - 1]]}`; }
    else note = nxt ? `★ ${SIM.WEAPONS[nxt].stars - totalStars()} more → ${SIM.WEAPONS[nxt].name} ${WEAPON_EMOJI[nxt]}` : '';
  }
  ui.win(daily ? '' : lv, extra);
  card.querySelector('p').firstChild.textContent = daily ? 'DAILY DUEL ' : lv <= LEVELS.length ? 'LEVEL ' : 'BRAWL ';
  let sx = card.querySelector('.ff-wstars'); if (!sx) { sx = document.createElement('div'); sx.className = 'ff-wstars'; card.querySelector('h1').after(sx); }
  sx.style.display = daily ? 'none' : ''; sx.innerHTML = '<i>★</i><i>★</i><i>★</i>';
  [0, 1, 2].forEach(i => setTimeout(() => { const el = sx.children[i]; if (!el) return; if (i < n) { el.classList.add('on'); tone(660 + i * 220, 0.14, 'triangle', 0.12, 1.2); buzz(12); } else el.classList.add('dim'); }, 900 + i * 260));
  let un = card.querySelector('.ff-unl'); if (!un) { un = document.createElement('p'); un.className = 'ff-unl'; card.querySelector('[data-x]').after(un); } un.textContent = note;
  cardExtras(card, un);
  const b = addRow(card, `<span class="hc-btn ff-next">${daily ? 'MAP' : 'NEXT ▶'}</span><div class="ff-row"><button class="hc-btn ff-small" data-r>🔁</button><button class="hc-btn ff-small" data-m>🗺️</button></div>`);
  b('[data-r]', () => go(lv)); b('[data-m]', () => openMap(daily ? undefined : worldOf(Math.min(lv + 1, LEVELS.length))));
  if (firstClear) { const gold = Math.random() < 0.3, amt = gold ? 3 : 1; const cb = card.querySelector('.ff-chest') || document.createElement('button'); cb.className = 'hc-btn ff-chest'; cb.textContent = '🎁 OPEN'; cb.onpointerdown = e => e.stopPropagation(); cb.onclick = e => { e.stopPropagation(); cb.disabled = true; save.set('bonus', (save.get('bonus', 0) | 0) + amt); cb.textContent = gold ? `✨ GOLD CHEST +${amt} ★` : `+${amt} ★`; confetti(scene, new THREE.Vector3(foe.x, foe.y + 3, 0.5), gold ? 90 : 30); tone(gold ? 1175 : 880, 0.2, 'triangle', 0.12, 1.4); buzz(30); }; un.after(cb); }
  if (n === 3 && !daily) ui.pop('PERFECT!', '#ffd23f', 50, 22);
}
function deepLose() {
  phase = 'over'; state = 'lost'; F.level(false, 1 - Math.max(0, foe.hp) / foe.maxHp); sfx.fail(); buzz([60, 40, 80]);
  const left = Math.max(0, foe.hp), card = ui.els.lose;
  ui.lose('K.O.!', left <= foe.maxHp * 0.3 ? `SO CLOSE: ${foe.spec.name} had only ${left} HP left!` : `${foe.spec.name} had ${left} HP left`);
  cardExtras(card, card.querySelector('[data-x]'));
  const b = addRow(card, `<span class="hc-btn ff-next">TRY AGAIN ▶</span><div class="ff-row"><button class="hc-btn ff-small" data-m>🗺️</button></div>`);
  b('[data-m]', () => openMap(daily ? undefined : worldOf(Math.min(level, LEVELS.length))));
}
function go(lv) {
  level = lv; if (mapEl) mapEl.classList.add('hc-hidden');
  for (const c of [ui.els.start, ui.els.win, ui.els.lose]) c.classList.add('hc-hidden');
  if (you) scene.remove(you.root); if (foe) scene.remove(foe.root);
  startLevel(); state = 'play'; B.start();
}
function openMap(w = worldOf(Math.min(unlocked, LEVELS.length))) {
  daily = false; state = 'map';
  for (const c of [ui.els.start, ui.els.win, ui.els.lose]) c.classList.add('hc-hidden');
  if (!mapEl) { mapEl = document.createElement('div'); mapEl.className = 'ff-map'; mapEl.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(mapEl); }
  const th = THEMES[WORLDS[w - 1].theme]; mapEl.style.setProperty('--m1', th.bg[0]); mapEl.style.setProperty('--m2', th.bg[1]);
  const first = (w - 1) * 12 + 1, wk = SIM.WEAPON_ORDER, nxt = wk.find(k => SIM.WEAPONS[k].stars > totalStars()), done = save.get('dailyDay', 0) === dayNum();
  let h = `<h2>${WORLDS[w - 1].name}</h2><div class="tot">★ ${totalStars()} / ${LEVELS.length * 3}</div><div class="ff-tabs">`;
  WORLDS.forEach((x, i) => { const open = unlocked >= i * 12 + 1; h += `<button data-w="${i + 1}" class="${i + 1 === w ? 'on' : ''} ${open ? '' : 'lock'}">${open ? '' : '🔒 '}${i + 1}</button>`; });
  h += `</div><div class="ff-grid">`;
  for (let lv = first; lv < first + 12; lv++) {
    const open = lv <= unlocked, n = starsBy[lv] || 0;
    h += `<button class="ff-node ${hardOf(lv) ? 'hard' : ''} ${open ? '' : 'lock'} ${lv === unlocked ? 'next' : ''}" data-l="${open ? lv : ''}">${open ? lv : '🔒'}${open && n ? `<b>${starRow(n)}</b>` : ''}</button>`;
  }
  h += `</div>`;
  if (unlocked > LEVELS.length && w === WORLDS.length) h += `<button class="hc-btn ff-go" data-l="${unlocked}">Brawl ${unlocked - LEVELS.length} ▶</button>`;
  h += `<button class="ff-daily ${done ? 'done' : ''}" data-d="1">📅 DAILY DUEL #${dayIndex()} ${done ? '✓' : '▶'}<small>${tomorrowLine()}</small></button>`;
  h += `<div class="tot" style="margin-top:12px">Weapons${nxt ? ` · ★ ${SIM.WEAPONS[nxt].stars - totalStars()} more for the next` : ''}</div><div class="ff-items">`;
  wk.forEach(k => { const o = SIM.WEAPONS[k], open = totalStars() >= o.stars; h += `<button class="ff-it ${open ? '' : 'lock'} ${myWeapon() === k ? 'on' : ''}" data-k="${open ? k : ''}"><span>${WEAPON_EMOJI[k]}</span>${open ? o.name : '★' + o.stars}</button>`; });
  h += `</div><div class="tot" style="margin-top:8px">Shirts · 🏅 ${medals()} daily medals${SHIRTS.find((s, i) => !shirtOk(i)) ? ` · next at ${SHIRTS.find((s, i) => !shirtOk(i)).m}` : ''}</div><div class="ff-items">`;
  SHIRTS.forEach((s, i) => { const open = shirtOk(i); h += `<button class="ff-it ${open ? '' : 'lock'} ${save.get('shirt', 0) === i ? 'on' : ''}" data-s="${open ? i : ''}"><span style="background:${s.c};border-radius:12px;display:block;width:34px;height:34px;margin:0 auto 2px"></span>${open ? s.n : '🏅' + s.m}</button>`; });
  h += `</div><div class="ff-tip">${SIM.WEAPONS[myWeapon()].name}: ${SIM.WEAPONS[myWeapon()].tip}</div><button class="hc-btn ff-go" data-l="${Math.min(unlocked, w * 12 < unlocked ? w * 12 : unlocked)}">PLAY ▶</button>`;
  mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden');
  mapEl.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const x = +b.dataset.w; if (unlocked >= (x - 1) * 12 + 1) { sfx.tap && sfx.tap(); openMap(x); } });
  mapEl.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const lv = +b.dataset.l; if (lv) { sfx.tap && sfx.tap(); daily = false; go(lv); } });
  mapEl.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { daily = true; go(level); });
  mapEl.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { if (b.dataset.k) { save.set('weapon', b.dataset.k); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(w); } });
  mapEl.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { if (b.dataset.s !== '') { save.set('shirt', +b.dataset.s); tone(900, 0.08, 'triangle', 0.1, 1.3); openMap(w); } });
}
if (DEEP) {
  const st = document.createElement('style');
  st.textContent = `.ff-meta{position:fixed;top:calc(150px + env(safe-area-inset-top));left:0;right:0;text-align:center;z-index:5;pointer-events:none;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.ff-meta .st{font-size:20px;letter-spacing:2px;line-height:1}.ff-meta .st i{font-style:normal;color:#ffd23f}.ff-meta .st i.off{color:rgba(255,255,255,.35)}
.ff-meta .nm{font-size:13px;opacity:.9;letter-spacing:.5px}.ff-par{opacity:.7;font-size:11px;margin-left:4px}
.ff-combo{font-size:18px;color:#ffd23f;margin-top:2px;-webkit-text-stroke:3px #2b1a4a;paint-order:stroke fill}
.hc-card:not(.hc-hidden)~.ff-meta,.hc-card:not(.hc-hidden)~.ff-wind,.hc-card:not(.hc-hidden)~.ff-mapbtn{opacity:0;pointer-events:none}
.ff-hardb{display:inline-block;background:#e8453c;border-radius:10px;padding:0 8px;margin-left:6px;font-size:12px}
.ff-hard{position:fixed;inset:0;pointer-events:none;z-index:3;box-shadow:inset 0 0 0 6px rgba(232,69,60,.85),inset 0 0 40px rgba(232,69,60,.5)}
.ff-wind{position:fixed;top:calc(206px + env(safe-area-inset-top));right:12px;z-index:5;pointer-events:none;font-weight:800;font-size:12px;letter-spacing:1px;background:rgba(40,20,70,.45);border-radius:12px;padding:3px 9px;text-shadow:0 2px 0 rgba(0,0,0,.3)}
.ff-wind span{color:#7bdff2;font-size:15px;letter-spacing:0;margin-right:3px}.ff-wind:empty{display:none}
.ff-mapbtn{position:fixed;top:calc(12px + env(safe-area-inset-top));right:10px;width:46px;height:46px;border-radius:50%;border:0;z-index:7;font-size:22px;background:rgba(0,0,0,.28);color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.2);cursor:pointer}
.ff-map{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;padding:calc(16px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));overflow-y:auto;background:linear-gradient(180deg,var(--m1),var(--m2));font-weight:800}
.ff-map h2{margin:4px 0 0;font-size:30px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.25)}
.ff-map .tot{font-size:16px;opacity:.95;margin:4px 0 6px;text-align:center}
.ff-tabs{display:flex;gap:8px;margin:2px 0 8px}.ff-tabs button{font:inherit;font-weight:800;font-size:15px;border:0;border-radius:18px;padding:6px 14px;background:rgba(0,0,0,.22);color:#fff;cursor:pointer}
.ff-tabs button.on{background:#fff;color:#333}.ff-tabs button.lock{opacity:.45}
.ff-grid{display:grid;grid-template-columns:repeat(4,60px);gap:10px 16px;justify-content:center;margin:2px 0 14px}
.ff-node{position:relative;width:60px;height:60px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:22px;color:#fff;background:var(--ui,#ff3d7f);box-shadow:0 5px 0 rgba(0,0,0,.25);cursor:pointer}
.ff-node.hard{background:#e8453c;box-shadow:0 5px 0 #8f241e,0 0 0 3px #ffd23f}
.ff-node.lock{background:rgba(0,0,0,.25);box-shadow:none;color:rgba(255,255,255,.5);cursor:default}
.ff-node.next{animation:ffn 1s ease-in-out infinite}@keyframes ffn{50%{transform:scale(1.12)}}
.ff-node b{position:absolute;left:0;right:0;bottom:-16px;font-size:12px;letter-spacing:1px;color:#ffd23f;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.ff-node b i{font-style:normal}.ff-node b i.off{color:rgba(255,255,255,.35)}
.ff-daily{font:inherit;font-weight:800;font-size:19px;border:0;border-radius:18px;padding:8px 16px;background:#ffd23f;color:#3b2a7a;box-shadow:0 4px 0 rgba(0,0,0,.25);cursor:pointer;margin-top:2px}
.ff-daily small{display:block;font-size:13px;opacity:.85}.ff-daily.done{background:rgba(255,255,255,.75)}
.ff-items{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:350px}
.ff-it{width:52px;border:0;background:none;font:inherit;color:#fff;font-weight:800;font-size:11px;cursor:pointer;padding:0}
.ff-it span{display:block;font-size:26px;width:44px;height:44px;line-height:44px;margin:0 auto 2px;border-radius:14px;background:rgba(0,0,0,.2);border:3px solid transparent}
.ff-it.on span{border-color:#fff}.ff-it.lock{opacity:.5;cursor:default}
.ff-tip{font-size:13px;opacity:.9;margin:8px 0 2px}.ff-go{margin-top:8px}
.ff-wstars{font-size:46px;letter-spacing:6px;line-height:1;margin:2px 0}.ff-wstars i{font-style:normal;color:rgba(255,255,255,.3);display:inline-block;transform:scale(.4);transition:transform .25s cubic-bezier(.3,1.8,.5,1),color .1s}
.ff-wstars i.on{color:#ffd23f;transform:scale(1)}.ff-wstars i.dim{transform:scale(.8)}
.ff-row{display:flex;gap:10px;justify-content:center;margin-top:18px}.ff-small{font-size:18px;padding:10px 18px;background:rgba(0,0,0,.28)}
.ff-chest{display:block;margin:4px auto;font-size:18px;animation:ffpulse .8s infinite alternate}@keyframes ffpulse{to{transform:scale(1.08)}}.ff-unl{font-size:17px!important;opacity:.95}.ff-tmr{font-size:13px!important;opacity:.85;margin:2px 0 8px!important}.ff-res{font-size:15px;opacity:.9;margin:2px 0 6px}`;
  document.head.appendChild(st);
  metaEl = Object.assign(document.createElement('div'), { className: 'ff-meta' }); document.body.appendChild(metaEl);
  windEl = Object.assign(document.createElement('div'), { className: 'ff-wind' }); document.body.appendChild(windEl);
  hardEl = Object.assign(document.createElement('div'), { className: 'ff-hard hc-hidden' }); document.body.appendChild(hardEl);
  mapBtn = Object.assign(document.createElement('button'), { className: 'ff-mapbtn', textContent: '🗺️', type: 'button', ariaLabel: 'Levels' });
  mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
  mapBtn.addEventListener('click', () => { if (state === 'play' && phase === 'aim' && !proj) openMap(daily ? undefined : worldOf(Math.min(level, LEVELS.length))); });
  document.body.appendChild(mapBtn);
  const res = document.createElement('p'); res.className = 'ff-res';
  res.textContent = `World ${worldOf(Math.min(unlocked, LEVELS.length))} · Level ${unlocked} · ★ ${totalStars()}${streak() ? ` · 🔥 ${streak()}` : ''}`;
  ui.els.start.querySelector('h1').after(res);
}

startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
let botT = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get deep() { return DEEP; }, get stars() { return DEEP ? { by: starsBy, total: totalStars(), unlocked } : null; }, get hp() { return you && foe ? [you.hp, foe.hp] : null; }, get phase() { return phase; }, get score() { return hits; },
  fling(ang, pw) { if (state === 'play' && phase === 'aim') throwFrom(you, ang, pw); },
  forceLose() { if (DEEP && state === 'play') { you.hp = 0; setHP(); deepLose(); } },
  playDaily() { daily = true; go(level); },
  setLevel(n) { daily = false; go(n); },
  bot() {
    if (state !== 'play' || phase !== 'aim') { botT = 0; drag = null; return; }
    if (DEEP && foe.walking) return;
    const b = DEEP ? (SIM.bestShot(ctx, 'you', WP()) || bestShot(you, foe)) : bestShot(you, foe);
    // pretend-drag so the aim UI shows, then release
    const len = b.pw * innerHeight * 0.3, cx = 120, cy = 520;
    drag = { sx: cx, sy: cy, cx: cx - Math.cos(b.ang) * len, cy: cy + Math.sin(b.ang) * len };
    if (++botT >= 4) { drag = null; botT = 0; throwFrom(you, b.ang, b.pw); }
  },
};

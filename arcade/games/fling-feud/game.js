// Fling Feud — original side-view throwing duel. Drag back to aim (angle + power), release to fling. Headshots hit double. No gore: hits pop with stars.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { part, merge, canvasTex } from './geo.js';
import { flow } from './kit/flow.js';

const S = createStage({ fov: 24, shadows: false });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.25; hemi.intensity = 1.55; sun.position.set(-4, 10, 12);
const ui = createUI({ title: 'FLING<br>FEUD', hint: 'Drag back to aim · release to throw', hand: '👈', score: false });
const save = store('flingfeud');
const F = flow('flingfeud'); let fk = 1;
let level = save.get('level', 1);

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
  TH = THEMES[(level - 1) % THEMES.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', '#ff3d7f');
  const r = rng(level * 313 + 9);
  arenaD = Math.min(26, 15 + level * 1.1);
  const p0 = -arenaD / 2, p1 = arenaD / 2, a1 = r() * 6, a2 = r() * 6, amp = 0.6 + Math.min(1.6, level * 0.15), dy = (r() - 0.5) * Math.min(3, level * 0.4);
  const raw = x => Math.sin(x * 0.35 + a1) * amp + Math.sin(x * 0.8 + a2) * amp * 0.35 + (x - p0) / arenaD * dy;
  const flat = (x, c) => Math.exp(-((x - c) ** 2) / 1.2);
  hillF = x => { const w0 = flat(x, p0), w1 = flat(x, p1); return raw(x) * (1 - w0 - w1) + raw(p0) * w0 + raw(p1) * w1; };
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
  root.rotation.y = face * 0.55;
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
let state = 'ready', phase = 'aim', you = null, foe = null, proj = null, drag = null, turnT = 0, slow = 1, slowT = 0, shake = 0, camX = 0, camY = 0, camW = 10, aiPlan = null, hits = 0, endT = 0, lastShooter = null;
const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), 12); dots.frustumCulled = false; scene.add(dots);
function handPos(f) { return new THREE.Vector3(f.x + f.face * 0.3, f.y + 2.15, 0.3); }
function headPos(f) { return new THREE.Vector3(f.x + f.lean * -f.face * 0.6, f.y + 2.85, 0); }
function startLevel() {
  buildWorld();
  const foeSpec = CAST[1 + (level - 1) % (CAST.length - 1)];
  you = fighter(CAST[0], 1); foe = fighter(foeSpec, -1);
  you.x = -arenaD / 2; foe.x = arenaD / 2; you.y = hillF(you.x); foe.y = hillF(foe.x);
  fk = F.k(); foe.maxHp = Math.round((100 + Math.min(60, (level - 1) * 10)) * fk); foe.hp = foe.maxHp; you.maxHp = 100; you.hp = 100;
  hud.querySelector('[data-a1]').textContent = foeSpec.av; names.querySelector('[data-n1]').textContent = foeSpec.name; names.querySelector('[data-n0]').textContent = 'JACK (YOU)';
  phase = 'aim'; proj = null; drag = null; hits = 0; slow = 1; slowT = 0; endT = 0; aiPlan = null;
  camX = you.x + camW * 0.28; camY = you.y + 4;
  ui.levels(level); ui.progress(0); setHP(); say('YOUR TURN');
}
function setHP() {
  for (const [f, k] of [[you, 0], [foe, 1]]) { const el = hud.querySelector(`[data-h${k}]`), p = Math.max(0, f.hp / f.maxHp) * 100 + '%'; el.querySelector('i').style.width = p; el.querySelector('b').style.width = p; }
  ui.progress(1 - Math.max(0, foe.hp) / foe.maxHp);
}
let sayT = 0;
function say(t) { turnEl.textContent = t; turnEl.style.opacity = 1; sayT = 1.4; }
function throwFrom(f, ang, pw) {
  const v = 8 + pw * 17, h = handPos(f);
  const mesh = weaponMesh(f.spec.weapon); mesh.scale.setScalar(1.15); scene.add(mesh); f.wpn.visible = false;
  proj = { by: f, target: f === you ? foe : you, x: h.x, y: h.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, m: mesh, spin: f.spec.weapon === 'spear' || f.spec.weapon === 'baton' ? 0 : -f.face * 14, rot: 0, stuck: 0, done: false, t: 0 };
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
  const bx = tg.x + tg.lean * -tg.face * 0.3, y0 = tg.y + 0.3, y1 = tg.y + 2.35;
  if (Math.abs(p.x - bx) < 0.55 && p.y > y0 && p.y < y1) return 'body';
  return null;
}
function onHit(p, kind) {
  const tg = p.target, head = kind === 'head';
  const dmg = head ? 50 + Math.floor(Math.random() * 8) : 22 + Math.floor(Math.random() * 9);
  tg.hp -= dmg; setHP();
  tg.leanV += (head ? 9 : 6) * (p.vx > 0 ? 1 : -1) * -tg.face * -1; tg.nodV += head ? 16 : 6; tg.push += (p.vx > 0 ? 1 : -1) * (head ? 0.5 : 0.3);
  // stick the weapon to the target (comedy, no gore)
  p.stuck = 1; p.done = true; p.vx = p.vy = 0;
  p.m.position.set(p.x, p.y, 0.4); p.m.updateMatrixWorld(); tg.torso.attach(p.m);
  const at = new THREE.Vector3(p.x, p.y, 0.3), sp = at.clone().project(camera);
  starPop(at, head ? 16 : 9); confetti(scene, at, head ? 40 : 18);
  dmgText('-' + dmg, (sp.x + 1) / 2 * innerWidth, (1 - sp.y) / 2 * innerHeight - 30, head ? '#ffd23f' : '#ffffff', head ? 46 : 36);
  if (head) { ui.pop('BULLSEYE!', '#ffd23f', 44, 24); sfx.smash(); } else { tone(150, 0.15, 'square', 0.1, 0.5); tone(90, 0.2, 'sine', 0.12, 0.6); }
  tone(880, 0.08, 'triangle', 0.1, 1.5); buzz(head ? [30, 30, 50] : 25); shake = head ? 0.9 : 0.5; ui.flash(head ? 0.35 : 0.18);
  if (tg === foe) hits++;
  if (tg.hp <= 0) { tg.ko = 0.001; slow = 0.25; slowT = 1.3; tg.stars = starRing(tg); ui.pop('K.O.!', '#ff3d7f', 64, 34); }
  else { slow = 0.35; slowT = 0.22; }
}
function nextTurn() {
  if (proj) { const p = proj; setTimeout(() => { p.m.removeFromParent(); }, p.stuck ? 900 : 0); proj = null; }
  you.wpn.visible = foe.wpn.visible = true;
  if (foe.hp <= 0) { phase = 'over'; state = 'won'; F.level(true); save.set('level', level + 1); sfx.win(); confetti(scene, new THREE.Vector3(foe.x, foe.y + 3, 0.5), 90); ui.win(level, `${foe.spec.name} is down · ${hits} hit${hits > 1 ? 's' : ''}`); return; }
  if (you.hp <= 0) { phase = 'over'; state = 'lost'; F.level(false, 1 - Math.max(0, foe.hp) / foe.maxHp); sfx.fail(); ui.lose('K.O.!', `${foe.spec.name} had ${Math.max(0, foe.hp)} HP left`); return; }
  if (lastShooter === you) { phase = 'foe'; turnT = 0; aiPlan = null; say(`${foe.spec.name}'S TURN`); }
  else { phase = 'aim'; say('YOUR TURN'); }
}

// ---------------------------------------------------------------- input
function aimFromDrag(d) {
  const px = d.sx - d.cx, py = d.sy - d.cy, len = Math.hypot(px, py);
  let ang = Math.atan2(-py, px); ang = clamp(ang, -0.35, 1.5);
  return { ang, pw: clamp(len / (innerHeight * 0.3), 0, 1), len };
}
input({
  onDown: e => { if (state !== 'play' || phase !== 'aim') return; drag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY }; },
  onMove: (dx, dy, e) => { if (!drag) return; drag.cx = e.clientX; drag.cy = e.clientY; },
  onUp: () => { if (!drag) return; const a = aimFromDrag(drag); drag = null; if (a.pw > 0.08 && phase === 'aim' && state === 'play') throwFrom(you, a.ang, a.pw); },
});
ui.onTap(w => { if (w === 'win') level++; if (you) { scene.remove(you.root); } if (foe) scene.remove(foe.root); startLevel(); state = 'play'; });

// ---------------------------------------------------------------- loop
const o3 = new THREE.Object3D(), tmp = new THREE.Vector3();
function animFighter(f, sec, t, aimAng) {
  // spring lean / nod (ragdoll-ish wobble)
  f.leanV += (-f.lean * 60 - f.leanV * 7) * sec; f.lean += f.leanV * sec;
  f.nodV += (-f.nod * 90 - f.nodV * 8) * sec; f.nod += f.nodV * sec;
  f.x += f.push * sec * 4; f.push *= Math.pow(0.02, sec);
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
  if (f.ko > 0) {
    f.ko = Math.min(1, f.ko + sec * 2.2); const e = 1 - Math.pow(1 - f.ko, 3);
    f.root.rotation.z = f.face * e * 1.45; f.root.position.y = f.y + Math.sin(f.ko * Math.PI) * 0.6;
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
  const aiming = state === 'play' && phase === 'aim' && drag && Math.hypot(drag.cx - drag.sx, drag.cy - drag.sy) > 8;
  const a = aiming ? aimFromDrag(drag) : null;
  // AI turn
  let foeAim = null;
  if (state === 'play' && phase === 'foe') {
    turnT += real;
    if (!aiPlan) { const b = bestShot(foe, you), err = Math.max(0.03, (0.2 - level * 0.022) / fk); aiPlan = { ang: b.ang + (Math.random() - 0.5) * 2 * err, pw: clamp(b.pw * (1 + (Math.random() - 0.5) * err * 1.4), 0.1, 1) }; }
    const k = clamp((turnT - 0.5) / 0.7, 0, 1); foeAim = (Math.PI - aiPlan.ang) * k;
    if (turnT > 1.35) { throwFrom(foe, aiPlan.ang, aiPlan.pw); }
  }
  animFighter(you, sec, t, a ? a.ang : null);
  animFighter(foe, sec, t, foeAim);
  // projectile
  if (proj && !proj.done) {
    const p = proj, n = 4, h = sec / n;
    for (let i = 0; i < n && !p.done; i++) {
      p.vy -= G * h; p.x += p.vx * h; p.y += p.vy * h; p.t += h; p.rot += p.spin * h;
      const kind = p.t > 0.08 ? hitCheck(p) : null;
      if (kind) { onHit(p, kind); break; }
      const self = p.by, sh = headPos(self);
      if (p.y < hillF(p.x) + 0.05) { p.done = true; p.stuck = 1; p.y = hillF(p.x) + 0.05; burst(scene, new THREE.Vector3(p.x, p.y, 0.4), [TH.top, '#ffffff', TH.ground], 10, { speed: 0.06, up: 0.08, size: 0.45 }); tone(110, 0.12, 'sine', 0.12, 0.6); ui.pop(['MISSED!', 'SO CLOSE!', 'WHOOPS!'][Math.floor(Math.random() * 3)], '#ffffff', 28, 30); }
      if (Math.abs(p.x) > 60 || p.y < -20) { p.done = true; }
    }
    p.m.position.set(p.x, p.y, 0.4);
    if (p.spin) p.m.rotation.z = p.rot; else p.m.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2;
  }
  if (proj && proj.done) { proj.after = (proj.after || 0) + real; if (proj.after > (proj.by.hp <= 0 || proj.target.hp <= 0 ? 1.6 : 0.75)) nextTurn(); }
  // popping stars
  for (let i = popStars.length - 1; i >= 0; i--) { const s = popStars[i]; s.vy -= 9 * sec; s.m.position.x += s.vx * sec; s.m.position.y += s.vy * sec; s.m.rotation.z += s.spin * sec; s.life -= sec * 1.2; s.m.material.opacity = Math.max(0, s.life); if (s.life <= 0) { scene.remove(s.m); s.m.material.dispose(); popStars.splice(i, 1); } }
  // trajectory preview: only the first part of the arc, near you
  dots.visible = !!a;
  if (a) {
    const v = 8 + a.pw * 17, hp = handPos(you);
    for (let i = 0; i < 12; i++) { const tt = (i + 1) * 0.045; o3.position.set(hp.x + Math.cos(a.ang) * v * tt, hp.y + Math.sin(a.ang) * v * tt - 0.5 * G * tt * tt, 0.5); o3.scale.setScalar(1 - i / 14); o3.updateMatrix(); dots.setMatrixAt(i, o3.matrix); }
    dots.instanceMatrix.needsUpdate = true;
    tmp.set(you.x, you.y + 3.7, 0).project(camera); bub.style.display = 'block'; bub.style.left = ((tmp.x + 1) / 2 * innerWidth) + 'px'; bub.style.top = ((1 - tmp.y) / 2 * innerHeight) + 'px';
    bub.querySelector('[data-p]').textContent = Math.round(a.pw * 100) + '%'; bub.querySelector('[data-g]').textContent = Math.round(a.ang * 180 / Math.PI) + '°';
  } else bub.style.display = 'none';
  // camera: frame the shooter, follow the projectile, then frame the target
  const aspect = innerWidth / innerHeight; camW = aspect < 0.7 ? 9.5 : 18;
  let tx;
  if (phase === 'aim') tx = you.x + camW * 0.3;
  else if (phase === 'foe') tx = foe.x - camW * 0.3;
  else if (proj) tx = clamp(proj.x, you.x + camW * 0.3, foe.x - camW * 0.3);
  else tx = camX;
  if (state !== 'play' && (you.ko || foe.ko)) tx = (you.ko ? you.x : foe.x) + (you.ko ? 1 : -1) * camW * 0.05;
  camX = lerp(camX, tx, 1 - Math.pow(phase === 'fly' ? 0.02 : 0.05, real));
  const gy = hillF(camX), ty = gy + 3.4 + (proj && !proj.done ? Math.max(0, proj.y - gy - 6) * 0.6 : 0);
  camY = lerp(camY, ty, 1 - Math.pow(0.05, real));
  shake = Math.max(0, shake - real * 2.5);
  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), dist = (camW / 2) / (vt * aspect);
  camera.position.set(camX + (Math.random() - 0.5) * shake * 0.3, camY + (Math.random() - 0.5) * shake * 0.3, dist);
  camera.lookAt(camX, camY, 0);
});

startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
let botT = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return hits; },
  bot() {
    if (state !== 'play' || phase !== 'aim') { botT = 0; drag = null; return; }
    const b = bestShot(you, foe);
    // pretend-drag so the aim UI shows, then release
    const len = b.pw * innerHeight * 0.3, cx = 120, cy = 520;
    drag = { sx: cx, sy: cy, cx: cx - Math.cos(b.ang) * len, cy: cy + Math.sin(b.ang) * len };
    if (++botT >= 4) { drag = null; botT = 0; throwFrom(you, b.ang, b.pw); }
  },
};

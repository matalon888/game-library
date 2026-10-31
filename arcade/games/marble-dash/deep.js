// Marble Dash v2 (deep) — same beach-ball marble, same floating course. Now 30 hand-made courses in 3 worlds, gems and three
// golden stars on every course, par time, new pieces per world (ice, belts, crumbling and blinking tiles, spinners, twin
// doors), a course map and 12 balls from chests. Plan and numbers: DESIGN.md.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { adapt } from './kit/adapt.js';
import { demo } from './kit/demo.js';
import { board } from './kit/board.js';
import { LEVELS, WORLDS, SKINS, parse } from './levels.js';

const WB = board({ game: 'marble-dash', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum', corner: 'bl' });
const ST = store('marbledash2');
const F = flow('marbledash');
const A = adapt();
let ot = 0;                                   // obstacle clock (advances at A.k())
const NL = LEVELS.length;
let level = Math.max(1, ST.get('lv', 1));     // the course being played (any unlocked one)
const { scene, camera, followLight } = createStage({ fov: 58, shadowSize: 12 });
const ui = createUI({ title: 'MARBLE<br>DASH', hint: 'Hold to roll · slide to steer', hand: '👆', score: false });
const $ = id => document.getElementById(id);
const wl = n => WORLDS[worldOf(n)];
function worldOf(n) { let w = 0; for (let i = 0; i < WORLDS.length; i++) if (n >= WORLDS[i].from) w = i; return w; }

// ---------------------------------------------------------------- save
const stars = () => ST.get('stars', {});            // course -> bit mask: 1 cleared, 2 all golden stars, 4 under par
const starCount = (m = 0) => (m & 1 ? 1 : 0) + (m & 2 ? 1 : 0) + (m & 4 ? 1 : 0);
const totalStars = () => Object.values(stars()).reduce((a, m) => a + starCount(m), 0);
const unlocked = () => ST.get('skins', [0]);
const CHEST = 12;                                    // stars per chest → a new ball
function giveChests() {                             // returns the skins won (random pick among the locked ones; same for everyone with the same history)
  const got = []; let opened = ST.get('chests', 0); const owned = unlocked().slice();
  while (opened < Math.floor(totalStars() / CHEST)) {
    opened++; const left = SKINS.map((_, i) => i).filter(i => !owned.includes(i));
    if (left.length) { const r = rng(opened * 977 + 31); const pick = left[Math.floor(r() * left.length)]; owned.push(pick); got.push(pick); }
  }
  ST.set('chests', opened); ST.set('skins', owned); return got;
}

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const TRACK = {
  wood: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#e2b47a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { x.fillStyle = ['#dcaa6c', '#e8bf88', '#d9a565', '#e5b97f', '#dfae73'][i]; x.fillRect(i * w / 5, 0, w / 5, h); }
    x.strokeStyle = 'rgba(120,70,30,.35)'; x.lineWidth = 3; for (let i = 0; i <= 5; i++) { x.beginPath(); x.moveTo(i * w / 5, 0); x.lineTo(i * w / 5, h); x.stroke(); }
    x.strokeStyle = 'rgba(150,90,40,.18)'; x.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const px = Math.random() * w; x.beginPath(); x.moveTo(px, Math.random() * h); x.bezierCurveTo(px + 4, 80, px - 4, 160, px + 2, h); x.stroke(); }
  }),
  candy: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#ffe3ef'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff8fbc'; for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + 128, h); x.lineTo(i * 64 + 128, h); x.fill(); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 6; x.strokeRect(0, 0, w, h);
  }),
  storm: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#6a6f8f'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#7a80a2' : '#62678a'; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    x.strokeStyle = 'rgba(160,240,255,.55)'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4);
  }),
};
for (const t of Object.values(TRACK)) t.wrapS = t.wrapT = THREE.RepeatWrapping;
const stripeTex = canvasTex(64, 16, (x, w, h) => { x.fillStyle = '#ffd21f'; x.fillRect(0, 0, w, h); x.fillStyle = '#23232e'; for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(i * 12, h); x.lineTo(i * 12 + 6, h); x.lineTo(i * 12 + 14, 0); x.lineTo(i * 12 + 8, 0); x.fill(); } });
stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
const arrowTex = canvasTex(128, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 3; i++) { const y = 40 + i * 70; x.beginPath(); x.moveTo(w / 2, y); x.lineTo(w - 14, y + 44); x.lineTo(w - 38, y + 44); x.lineTo(w / 2, y + 20); x.lineTo(38, y + 44); x.lineTo(14, y + 44); x.closePath(); x.fill(); } });
const beltTex = canvasTex(128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 2; i++) { const px = 8 + i * 64; x.beginPath(); x.moveTo(px, 24); x.lineTo(px + 40, 64); x.lineTo(px, 104); x.lineTo(px + 14, 104); x.lineTo(px + 54, 64); x.lineTo(px + 14, 24); x.closePath(); x.fill(); } });
beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
function skinTex(sk) {
  return canvasTex(512, 256, (x, w, h) => {
    const c = sk.c;
    if (sk.t === 'stripe') { const n = Math.max(8, c.length * 2); for (let i = 0; i < n; i++) { x.fillStyle = c[i % c.length]; x.fillRect(i * w / n, 0, w / n + 1, h); } if (c.length > 4) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, 22); x.fillRect(0, h - 22, w, 22); } }
    else if (sk.t === 'check') { for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) { x.fillStyle = c[(i + j) % 2 ? 1 : 0]; x.fillRect(i * w / 16, j * h / 8, w / 16 + 1, h / 8 + 1); } }
    else if (sk.t === 'dots') { x.fillStyle = c[0]; x.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) { x.fillStyle = c[1 + (i + j) % (c.length - 1)]; x.beginPath(); x.arc((i + (j % 2) * 0.5) * w / 12 + 20, 25 + j * 52, 14, 0, 7); x.fill(); } }
    else if (sk.t === 'stars') { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[0]); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { x.fillStyle = c[2 + (i % 2)]; const r = (i * 37 % 5) + 2; x.beginPath(); x.arc((i * 83) % w, (i * 41) % h, r, 0, 7); x.fill(); } }
    else { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, c[0]); g.addColorStop(0.3, c[1]); g.addColorStop(0.6, c[2]); g.addColorStop(1, c[0]); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  });
}
const ballMat = new THREE.MeshStandardMaterial({ map: skinTex(SKINS[0]), roughness: 0.16, metalness: 0.08 });
let skinIdx = -1;
function setSkin(i) {
  if (!unlocked().includes(i)) i = 0; skinIdx = i; ST.set('skin', i);
  const old = ballMat.map; ballMat.map = skinTex(SKINS[i]); ballMat.needsUpdate = true; if (old) old.dispose();
  const sk = SKINS[i]; ballMat.metalness = sk.t === 'gold' ? 0.75 : sk.t === 'stars' ? 0.3 : 0.08; ballMat.roughness = sk.t === 'gold' ? 0.22 : 0.16;
}
const swatch = sk => `conic-gradient(${[...sk.c, sk.c[0]].map((c, i, a) => `${c} ${Math.round(i * 100 / (a.length - 1))}%`).join(',')})`;

// ---------------------------------------------------------------- course
const BR = 0.42, G = 24, ACC = 16, MAXV = 11.5, DT = 1 / 60;
let world, segs, obs, pads, cps, gems, golds, belts, finishZ, totalLen, R, curDef, totalGolds, courseLen;
const gemGeo = new THREE.OctahedronGeometry(0.2, 0); gemGeo.scale(1, 1.4, 1);
const gemMat = new THREE.MeshStandardMaterial({ color: '#46c8ff', emissive: '#1d9bff', emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.2 });
const starGeo = (() => { const sh = new THREE.Shape(), n = 5; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 0.26 : 0.6, a = Math.PI / 2 + i * Math.PI / n; (i ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * r, Math.sin(a) * r); } sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }); g.translate(0, 0, -0.09); return g; })();
const starMat = new THREE.MeshStandardMaterial({ color: '#ffd21f', emissive: '#ffb300', emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.5 });
let gemInst = null; const m4 = new THREE.Matrix4(), qd = new THREE.Quaternion(), vS = new THREE.Vector3(1, 1, 1), eY = new THREE.Euler();

const cx = (s, z) => lerp(s.x0, s.x1, (s.z0 - z) / (s.z0 - s.z1));
const segAt = z => { for (const s of segs) if (z <= s.z0 && z >= s.z1) return s; return null; };
function surfAt(x, z) {
  const s = segAt(z); if (!s || s.gone) return null;
  const t = (s.z0 - z) / (s.z0 - s.z1), c = lerp(s.x0, s.x1, t);
  if (Math.abs(x - c) > s.w / 2 + 0.06) return null;
  if (s.blink && (x < c) !== blinkOn(s)) return null;
  return { y: lerp(s.y0, s.y1, t), k: (s.y1 - s.y0) / (s.z0 - s.z1), s, c };
}
const KINDS = { s: 'rolling', n: 'narrow', d: 'slope', j: 'jump', b: 'boost', z: 'zig', l: 'slider', w: 'sweeper', p: 'spinner', r: 'bridge', i: 'ice', c: 'conveyor', k: 'crumble', x: 'blink', q: 'twin' };
const NEWS = { n: ['NEW: THIN PLANK', 'stay on the wood'], l: ['NEW: SLIDER', 'dodge the red block'], j: ['NEW: JUMPS', 'keep rolling over the gap'], z: ['NEW: ZIGZAG', 'follow the gems'], w: ['NEW: SWEEPER', 'slip past the arm'], r: ['NEW: BRIDGE', 'narrow planks, steady'], p: ['NEW: SPINNER', 'find the gap between arms'], i: ['NEW: ICE', 'steering is slippery'], c: ['NEW: BELT', 'it pushes you sideways'], k: ['NEW: CRUMBLE', "don't stop: tiles drop"], x: ['NEW: BLINK TILES', 'go when they glow'], q: ['NEW: TWIN DOORS', 'slip through when open'] };

function buildTrack() {
  if (world) { scene.remove(world); }
  world = new THREE.Group(); scene.add(world);
  const def = curDef = levelDef(level), toks = parse(def.code), fk = F.k(), W = wl(level), tex0 = TRACK[W.track];
  R = rng(level * 1777 + 9);
  segs = []; obs = []; pads = []; cps = []; gems = []; golds = []; belts = [];
  let z = 6, x = 0, y = 0;
  const seg = (len, w, dx = 0, dy = 0, o = {}) => { const s = { z0: z, z1: z - len, x0: x, x1: x + dx, y0: y, y1: y + dy, w, ...o }; segs.push(s); z -= len; x += dx; y += dy; return s; };
  const gap = len => { z -= len; };
  seg(10, 3.4, 0, 0, { start: true });
  const w = clamp((2.9 - level * 0.02) / fk, 2.1, 3.0), nw = clamp((1.5 - level * 0.01) / fk, 1.1, 1.6);
  const spd = lvl => (1.7 + lvl * 0.04) * fk;
  const marks = [];   // per piece: z range + the segments (for gem placement)
  toks.forEach((t, ti) => {
    const z0 = z, y0 = y, first = segs.length, k = t.k;
    switch (k) {
      case 's': seg(8, w, t.p || 0, 0, { safe: true }); break;
      case 'n': seg(2, w); seg(7, nw, 0, 0, { narrow: true }); seg(2, w); break;
      case 'd': seg(8, w + 0.4, 0, -2.6, { rails: true }); break;
      case 'j': { seg(4, w, 0, 1.0, { ramp: true }); const gp = t.p || clamp(2.4 + level * 0.03, 2.4, 3.2); gap(gp); y -= 0.5; seg(7, w + 0.6); marks.push({ air: [z0 - 4, z0 - 4 - gp, y0 + 1.0], ti }); break; }
      case 'b': { const s = seg(9, w + 0.3, 0, -0.6, { rails: true }); pads.push({ seg: s, z: s.z0 - 2.5 }); break; }
      case 'z': { const d = (t.p === -1 ? -1 : 1) * 2.2; seg(6, w, d); seg(6, w, -d); break; }
      case 'l': { const s = seg(10, w + 0.2); obs.push({ type: 'slide', seg: s, zc: (s.z0 + s.z1) / 2, amp: s.w / 2 - 0.5, sp: spd(level) * (t.p || 1), ph: R() * 6 }); break; }
      case 'w': { const s = seg(10, w + 0.3); obs.push({ type: 'sweep', seg: s, zc: (s.z0 + s.z1) / 2, side: t.p === -1 ? -1 : 1, sp: spd(level) * 0.95, ph: R() * 6 }); break; }
      case 'p': { const s = seg(10, w + 0.6); obs.push({ type: 'spin', seg: s, zc: (s.z0 + s.z1) / 2, sp: (t.p === -1 ? -1 : 1) * (1.0 + level * 0.03) * fk, ph: R() * 6 }); break; }
      case 'r': for (let j = 0; j < 4; j++) seg(2.2, 1.4, ((j % 2) - 0.5) * (t.p ? 0.9 : 0.5), 0, { narrow: true, plank: true }); break;
      case 'C': { const s = seg(3, 3, 0, 0, { cp: true }); cps.push(s); break; }
      case 'i': seg(10, t.p === 'n' ? 1.9 : w + 0.3, 0, 0, { ice: true }); break;
      case 'c': { const s = seg(10, w + 0.4, 0, 0, { belt: t.p === -1 ? -1 : 1 }); belts.push(s); break; }
      case 'k': for (let j = 0; j < 3; j++) seg(4, w + 0.1, 0, 0, { crumble: true, cr: 0 }); break;
      case 'x': for (let j = 0; j < 3; j++) seg(4, w + 0.3, 0, 0, { blink: true, ph: j * 0.85 }); break;
      case 'q': { const s = seg(11, w + 0.3); obs.push({ type: 'twin', seg: s, zc: (s.z0 + s.z1) / 2, sp: (1.5 + level * 0.03) * fk, ph: R() * 6 }); break; }
    }
    marks.push({ ti, z0, z1: z, first, last: segs.length, f: t.f, k, y0 });
  });
  { let lastZ = 6; const all = cps.map(c => c.z0).concat(); // auto checkpoints on plain straights, at least 34 units apart, so a fall never costs a long run-up
    for (const sg of segs) { if (sg.cp) { lastZ = sg.z0; continue; } if (sg.safe && lastZ - sg.z0 >= 34 && !sg.start) { sg.auto = true; cps.push(sg); lastZ = sg.z0; } }
    cps.sort((a, b) => b.z0 - a.z0); }
  seg(4, 3); const fin = seg(12, 4.2, 0, 0, { finish: true }); finishZ = fin.z0 - 2; totalLen = 6 - finishZ;
  courseLen = totalLen;
  // meshes
  for (const s of segs) {
    const S = new THREE.Vector3(s.x0, s.y0, s.z0), E = new THREE.Vector3(s.x1, s.y1, s.z1), L = S.distanceTo(E) + 0.35;
    if (s.blink) {   // two lanes that take turns: the lit one is solid (go where the glow is)
      s.lane = [0, 1].map(i => { const mt = glossy(i ? '#8fe3ff' : '#ffb3f0', { emissive: i ? '#2a9bff' : '#ff4fd0', emissiveIntensity: 0.3 }), g = new THREE.BoxGeometry(s.w / 2 - 0.04, 0.55, L - 0.1); g.translate((i ? 1 : -1) * s.w / 4, -0.275, 0);
        const m = new THREE.Mesh(g, mt); m.position.copy(S).lerp(E, 0.5); m.lookAt(E); m.receiveShadow = true; m.castShadow = true; world.add(m); return { m, mt }; });
      continue;
    }
    const tex = tex0.clone(); tex.needsUpdate = true; tex.repeat.set(s.w / 2.6, L / 3);
    let material;
    if (s.finish) { material = glossy('#ffffff', { map: canvasTex(64, 64, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#23232e' : '#ffffff'; c.fillRect(i * 8, j * 8, 8, 8); } }) }); material.map.magFilter = THREE.NearestFilter; material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping; material.map.repeat.set(2, 6); }
    else if (s.cp) material = glossy('#5ce1ff');
    else if (s.ice) material = glossy('#bfeaff', { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.92 });
    else if (s.crumble) { material = mat('#ffffff', { map: tex, roughness: 0.8 }); material.color.set('#e9c9a0'); }
    else if (s.belt) material = mat('#ffffff', { map: tex, roughness: 0.55 });
    else material = mat('#ffffff', { map: tex, roughness: 0.55 });
    const geo = new THREE.BoxGeometry(s.w, 0.55, L); geo.translate(0, -0.275, 0);
    const mesh = new THREE.Mesh(geo, material); mesh.position.copy(S).lerp(E, 0.5); mesh.lookAt(E); mesh.receiveShadow = true; mesh.castShadow = true; world.add(mesh); s.mesh = mesh; s.mat = material;
    if (s.rails) for (const sd of [-1, 1]) {
      const rt = stripeTex.clone(); rt.needsUpdate = true; rt.repeat.set(L / 1.2, 1);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, L, 10), mat('#ffffff', { map: rt })); rail.geometry.rotateX(Math.PI / 2); rail.geometry.rotateZ(Math.PI / 2);
      rail.position.copy(mesh.position); rail.quaternion.copy(mesh.quaternion); rail.translateX(sd * (s.w / 2 + 0.05)); rail.translateY(0.16); rail.castShadow = true; world.add(rail);
    }
    if (s.ramp) { const lip = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.12, 0.3), glossy('#ff4f6d')); lip.position.copy(E).add(new THREE.Vector3(0, -0.03, 0.15)); world.add(lip); }
    if (s.belt) {
      const bt = beltTex.clone(); bt.needsUpdate = true; bt.repeat.set((s.belt > 0 ? 1 : -1) * s.w / 1.2, 10 / 1.2);
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(s.w, 10), new THREE.MeshBasicMaterial({ map: bt, transparent: true, color: '#ff8c1a', opacity: 0.9 }));
      bm.rotation.x = -Math.PI / 2; bm.position.set(s.x0, s.y0 + 0.02, (s.z0 + s.z1) / 2); world.add(bm); s.bt = bt;
    }
    if (s.crumble) { const edge = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.02, 0.06, L - 0.3), new THREE.MeshBasicMaterial({ color: '#a0724a', transparent: true, opacity: 0.55 })); edge.position.copy(mesh.position).add(new THREE.Vector3(0, 0.02, 0)); edge.quaternion.copy(mesh.quaternion); world.add(edge); s.edge = edge; }
  }
  for (const s of cps) for (const sd of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), mat('#ffffff')); f.position.set(s.x0 + sd * (s.w / 2), s.y0 + 0.8, s.z0 - 1.5); const fl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.04), glossy('#5ce1ff')); fl.position.set(f.position.x - sd * 0.35, s.y0 + 1.4, f.position.z); world.add(f, fl); }
  for (const p of pads) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, color: '#7ff0ff' })); const sf = surfAt(cx(p.seg, p.z), p.z); pm.position.set(cx(p.seg, p.z), sf.y + 0.02, p.z); pm.rotation.x = -Math.PI / 2 + Math.atan2(p.seg.y1 - p.seg.y0, p.seg.z0 - p.seg.z1); world.add(pm); p.m = pm; }
  { const fs = segs[segs.length - 1], a = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 10, 36, Math.PI), glossy(W.tint)); a.position.set(fs.x0, fs.y0, finishZ); a.castShadow = true; world.add(a); }
  // obstacles
  for (const o of obs) {
    const s = o.seg, c = cx(s, o.zc), yy = surfAt(c, o.zc).y; o.cx = c; o.y = yy;
    if (o.type === 'slide') { o.m = new THREE.Mesh(rounded(1.2, 0.9, 0.7, 0.12), glossy('#ff4f6d')); o.hx = 0.6; o.hz = 0.35; }
    if (o.type === 'twin') { o.m = new THREE.Group(); o.ms = [0, 1].map(() => { const b = new THREE.Mesh(rounded(1.1, 1.1, 0.7, 0.12), glossy('#ff4f6d')); o.m.add(b); return b; }); o.hx = 0.55; o.hz = 0.35; }
    if (o.type === 'sweep') {
      o.px = c + o.side * (s.w / 2 + 0.25); o.len = s.w + 0.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.4, 12), glossy('#ffffff')); post.position.set(o.px, yy + 0.5, o.zc); post.castShadow = true; world.add(post);
      o.m = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, o.len, 12), mat('#ffffff', { map: stripeTex })); bar.rotation.z = Math.PI / 2; bar.position.x = o.len / 2; bar.castShadow = true; o.m.add(bar); o.m.position.set(o.px, yy + 0.35, o.zc);
    }
    if (o.type === 'spin') {
      o.px = c; o.len = s.w / 2 + 0.1;
      o.m = new THREE.Group(); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 16), glossy('#7b5cff')); hub.castShadow = true; o.m.add(hub);
      for (let a = 0; a < 2; a++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(o.len * 2, 0.28, 0.28), glossy('#ff8c1a')); bar.rotation.y = a * Math.PI / 2; bar.position.y = 0.05; bar.castShadow = true; o.m.add(bar); }
      o.m.position.set(c, yy + 0.32, o.zc);
    }
    o.m.castShadow = true; world.add(o.m);
  }
  placeGems(marks);
  // decor
  { const Rd = rng(5 + worldOf(level)), N = 36, dm = new THREE.Matrix4(), span = totalLen + 60, tone1 = worldOf(level) === 2 ? '#8a7fb8' : '#ffffff';
    const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(tone1, { roughness: 1, emissive: tone1, emissiveIntensity: 0.25 }), N);
    for (let i = 0; i < N; i++) { const sz = 3 + Rd() * 6; dm.compose(new THREE.Vector3((Rd() < 0.5 ? -1 : 1) * (14 + Rd() * 40), -14 - Rd() * 10, 10 - Rd() * span), new THREE.Quaternion(), new THREE.Vector3(sz * 1.6, sz * 0.6, sz)); clouds.setMatrixAt(i, dm); }
    world.add(clouds);
    const wi = worldOf(level), col = ['#9b7653', '#f6a0c8', '#4b4f78'][wi], topc = ['#6fd25a', '#ffe3a8', '#8fd3ff'][wi], NI = 14;
    const isl = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1.6, 6), mat(col, { flatShading: true }), NI), top = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.3, 6), mat(topc, { flatShading: true }), NI);
    for (let i = 0; i < NI; i++) { const sz = 2 + Rd() * 3, p = new THREE.Vector3((i % 2 ? 1 : -1) * (12 + Rd() * 22), -3 - Rd() * 8, -Rd() * (span - 20)); dm.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), new THREE.Vector3(sz, sz, sz)); isl.setMatrixAt(i, dm); dm.compose(p.clone().add(new THREE.Vector3(0, 0.15 * sz, 0)), new THREE.Quaternion(), new THREE.Vector3(sz, sz, sz)); top.setMatrixAt(i, dm); }
    world.add(isl, top);
  }
}

// gems and golden stars from the course flags
function placeGems(marks) {
  const gemAt = (xx, zz, yy, gold) => { const g = { x: xx, y: yy, z: zz, gold, got: false }; (gold ? golds : gems).push(g); return g; };
  const line = (m, off, n = 5) => {
    const za = m.z0 - 0.8, zb = m.z1 + 0.8;
    for (let i = 0; i < n; i++) { const zz = lerp(za, zb, n > 1 ? i / (n - 1) : 0.5), sf = segAt(zz); if (!sf) continue; const c = cx(sf, zz), yy = lerp(sf.y0, sf.y1, (sf.z0 - zz) / (sf.z0 - sf.z1)); gemAt(c + off * (sf.w / 2 - 0.45), zz, yy + BR + 0.1, false); }
  };
  for (const m of marks) {
    if (m.air) { continue; }
    const f = m.f || '';
    if (m.k === 'C' || m.k === 'r') { /* bridges have planks with gaps */ }
    if (f.includes('g')) line(m, 0, m.k === 'j' ? 3 : m.k === 'r' ? 6 : 5);
    if (f.includes('l')) line(m, -0.85, 4);
    if (f.includes('r')) line(m, 0.85, 4);
    const mid = (m.z0 + m.z1) / 2, sf = segAt(mid + (m.k === 'n' ? 0 : 0)), c = sf ? cx(sf, mid) : 0, yy = sf ? lerp(sf.y0, sf.y1, (sf.z0 - mid) / (sf.z0 - sf.z1)) : 0;
    for (const ch of f) {
      if (ch === 'G') gemAt(c, mid, yy + BR + 0.15, true);
      if (ch === 'L' || ch === 'R') { const sg = segAt(mid), half = sg.w / 2; gemAt(c + (ch === 'L' ? -1 : 1) * (half - 0.38), mid, yy + BR + 0.15, true); }
    }
  }
  for (const m of marks) if (m.air) {
    const t = parse(curDef.code)[m.ti], f = t.f || '', [za, zb, ya] = m.air;
    if (f.includes('a')) for (let i = 1; i <= 3; i++) { const zz = lerp(za, zb, i / 4), sf = segAt(za + 0.1) || segs[0]; gemAt(cx(sf, za), zz, ya + BR + 0.12, false); }
    if (f.includes('A')) gemAt(cx(segAt(za + 0.1) || segs[0], za), (za + zb) / 2, ya + BR + 0.45, true);
  }
  totalGolds = golds.length;
  // meshes: gems in one instanced mesh, golden stars separate
  if (gemInst) gemInst = null;
  gemInst = new THREE.InstancedMesh(gemGeo, gemMat, Math.max(1, gems.length)); gemInst.frustumCulled = false; world.add(gemInst);
  for (const gd of golds) { gd.m = new THREE.Mesh(starGeo, starMat); gd.m.position.set(gd.x, gd.y, gd.z); gd.m.scale.setScalar(1.15); gd.m.castShadow = true; world.add(gd.m); gd.halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.55 })); gd.halo.position.copy(gd.m.position); world.add(gd.halo); }
}
function animGems(t) {
  if (!gemInst) return;
  const zb = B.p.z;
  for (let i = 0; i < gems.length; i++) {
    const g = gems[i];
    if (g.got || Math.abs(g.z - zb) > 38) { m4.makeScale(0, 0, 0); gemInst.setMatrixAt(i, m4); continue; }
    eY.set(0, t * 3 + i, 0); qd.setFromEuler(eY); m4.compose(tmp.set(g.x, g.y + Math.sin(t * 3 + i) * 0.06, g.z), qd, vS); gemInst.setMatrixAt(i, m4);
  }
  gemInst.instanceMatrix.needsUpdate = true;
  for (const g of golds) if (!g.got) { g.m.rotation.y = t * 2.2; g.m.position.y = g.y + Math.sin(t * 2.6) * 0.1; g.halo.position.y = g.m.position.y; g.halo.rotation.x = t * 1.3; g.halo.rotation.y = t * 0.9; }
}

// generated courses after the 30 made ones (same pieces as world 3, seeded)
function levelDef(n) {
  if (n <= NL) return LEVELS[n - 1];
  const r = rng(n * 7919 + 3), pool = ['s/g', 'n/g', 'l/g', 'w/g', 'p/g', 'i/g', 'c:1/g', 'c:-1/g', 'k/g', 'x/g', 'q/g', 'j/a', 'r/g', 'd/g', 'b/g', 'z:1/g', 'z:-1/g'];
  const toks = ['s/g'], len = 18 + Math.min(14, (n - NL) * 2);
  for (let i = 0; i < len; i++) { if (i && i % 7 === 0) toks.push('C'); let t = pool[Math.floor(r() * pool.length)]; if (t === toks[toks.length - 1]) t = 's/g'; toks.push(t); }
  const put = (i, f) => { const [h, fl = ''] = toks[i].split('/'); toks[i] = h + '/' + fl + f; };
  const idx = toks.map((t, i) => (t[0] !== 'C' && t[0] !== 'j' ? i : -1)).filter(i => i >= 0);
  put(idx[Math.floor(len * 0.25)], 'G'); put(idx[Math.floor(len * 0.55)], 'G'); put(idx[Math.floor(len * 0.85)], 'G');
  return { name: 'Storm Run ' + (n - NL), note: 'generated', code: toks.join(' '), par: Math.round(len * 1.55 + 14), boss: false };
}

// ---------------------------------------------------------------- ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 40, 28), ballMat);
ball.castShadow = true; scene.add(ball);
const B = { p: new THREE.Vector3(), vx: 0, vy: 0, vz: 0, ground: true, k: 0, boost: 0, squash: 0, rot: new THREE.Quaternion() };
const tmp = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion();

// ---------------------------------------------------------------- state
let state = 'ready', lives = 3, cpIdx = -1, cpZ = 0, holding = false, roll = 0, steerPx = 0, botOn = false, botX = 0, t0 = 0, runT = 0, airT = 0, camY = 0, finishT = 0;
let botHold = true, gy = 0, gemN = 0, goldN = 0, chain = 0, chainT = 0, falls = 0, bumps = 0, shake = 0, stopT = 0, dry = false, lastEdge = -9, nearT = 0, edgeFlag = false, fever = 0;
const evs = [];     // sim events for the frame to show: [kind, ...]
const post = (...e) => { if (!dry) evs.push(e); };
const chip = (t, sub = '') => { const c = $('mdchip'); c.innerHTML = `<b>${t}</b><span>${sub}</span>`; c.classList.add('on'); clearTimeout(chip.h); chip.h = setTimeout(() => c.classList.remove('on'), 3200); };

function setLives() { $('lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives); }
let hudKey = '';
function setHud() {
  const key = gemN + '|' + goldN + '|' + (state === 'play' ? runT.toFixed(1) : 0) + '|' + curDef.par; if (key === hudKey) return; hudKey = key;
  $('mdg').textContent = '💎 ' + gemN; $('mdst').innerHTML = [0, 1, 2].map(i => `<i class="${i < goldN ? 'on' : ''}">★</i>`).join('');
  const sec = state === 'play' ? runT : 0; $('mdt').textContent = sec.toFixed(1) + ' / ' + curDef.par + ' s'; $('mdt').classList.toggle('late', sec > curDef.par);
}
function resetTiles() { for (const s of segs) if (s.crumble) { s.cr = 0; s.gone = false; s.fall = 0; if (s.mesh) { s.mesh.visible = true; s.mesh.position.y = s.mesh.userData.y0; } if (s.edge) s.edge.visible = true; } }
function spawnAt(z) {
  roll = 0; gy = 0; const s = segAt(z) || segs[0]; const c = cx(s, z), sf = surfAt(c, z);
  gy = sf ? sf.y : s.y0; B.p.set(c, gy + BR + 0.6, z); B.vx = B.vy = B.vz = 0; B.ground = false; B.boost = 0; chain = 0;
  ball.visible = true;
}
function buildLevel() {
  const W = wl(level); ST.set('lv', Math.max(ST.get('lv', 1), 1));
  document.body.style.setProperty('--bg1', W.bg[0]); document.body.style.setProperty('--bg2', W.bg[1]); document.body.style.setProperty('--ui', W.tint);
  buildTrack(); for (const s of segs) if (s.mesh) s.mesh.userData.y0 = s.mesh.position.y;
  A.round(level === 1 ? 0 : 1); lives = 3; setLives(); cpZ = 2; cpIdx = -1; finishT = 0; gemN = 0; goldN = 0; chain = 0; falls = 0; fallZs = []; bumps = 0; runT = 0; ot = 0; shake = 0; stopT = 0; fever = 0;
  spawnAt(2); camY = B.p.y; ui.levels(level); ui.progress(0); ui.sub(''); t0 = performance.now(); setHud();
  $('mdwin').classList.add('hc-hidden'); $('mdmap').classList.add('hc-hidden'); $('mdballs').classList.add('hc-hidden'); $('mdhud').classList.remove('hc-hidden');
  // announce the course: a boss banner, or the first time a piece shows up
  const seen = ST.get('seen', []), fresh = [...new Set(parse(curDef.code).map(t => t.k))].filter(k => NEWS[k] && !seen.includes(k));
  if (fresh.length) { const k = fresh[0]; chip(NEWS[k][0], NEWS[k][1]); ST.set('seen', seen.concat(fresh[0])); }
  else if (curDef.boss) chip('BOSS COURSE', curDef.name); else chip('COURSE ' + level, curDef.name);
}

// ---------------------------------------------------------------- input
input({
  onDown() { if (state === 'ready') { state = 'play'; ui.hideStart(); } if (state === 'play') { holding = true; botOn = false; A.input(); } },
  onMove(dx) { if (state === 'play' && holding) steerPx += dx; },
  onUp(e, st) { holding = false; if (state === 'play' && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12) { roll = 0.8; const k = e.clientX / innerWidth; if (k < 0.33 || k > 0.67) B.vx = k < 0.5 ? -3 : 3; } },
});
// the first touch on the title card also starts the roll (the card swallows the event, so re-send it to the input helper)
addEventListener('pointerdown', e => { if (state === 'ready' && e.isTrusted && !ui.els.start.classList.contains('hc-hidden')) dispatchEvent(new PointerEvent('pointerdown', { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId })); }, true);
const D = demo(null, { ready: () => state === 'play' && level === 1 && lives === 3 && !ST.get('stars', {})[1], ms: 4500 }); let demoT = 0;
const startHint = () => { const h = ui.els.start.querySelector('.hint'); if (ST.get('lv', 1) > 1 || Object.keys(stars()).length) h.lastChild.textContent = 'Tap to roll · course ' + level; };
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});

// ---------------------------------------------------------------- sim
const TIPS = { slide: 'TIP: wait for the block to swing away', sweep: 'TIP: let go to slow, slip past when the arm lifts', spin: 'TIP: roll in right after an arm passes', twin: 'TIP: ease off, go through when the doors open' };
let fallZs = [];
function fell() {
  if (!dry) { A.miss(); fallZs.push(B.p.z); const n = fallZs.length;
    if (n >= 2 && Math.abs(fallZs[n - 1] - fallZs[n - 2]) < 10) { let bo = null, bd = 9; for (const o of obs) { const d = Math.abs(o.zc - B.p.z); if (d < bd) { bd = d; bo = o; } }
      post('tip', bo && TIPS[bo.type] || 'TIP: let go to slow down before the turn, then press to steer'); fallZs = []; } }
  falls++;
  if (lives === 1 && !dry && A.rescue()) { post('pop', 'SECOND WIND! 🍀', '#7dffb0', 38, 30); post('coin'); spawnAt(cpZ); camY = B.p.y; resetTiles(); return; }
  if (falls === 1) { post('pop', 'FREE FALL', '#7dffb0', 34, 30); spawnAt(cpZ); camY = B.p.y; resetTiles(); return; }   // first fall of a course is free
  lives--; post('lives'); post('fail');
  if (lives <= 0) { state = 'lost'; post('lost'); return; }
  post('pop', 'CHECKPOINT', '#fff', 34, 30); spawnAt(cpZ); camY = B.p.y; resetTiles();
}
function collectGem(g) {
  g.got = true; chainT = 0; chain++;
  if (g.gold) { goldN++; post('gold', g); } else { gemN += fever > 0 ? 2 : 1; post('gem', g, chain); }
  if (!g.gold && chain === 7) { fever = 6; post('fever'); }
}
function bump() { bumps++; stopT = 0.05; shake = 0.35; chain = 0; post('bump'); }
function collide(o, t) {
  if (Math.abs(B.p.y - BR - o.y) > 1.2) return;
  const blk = (ox, hx, hz, ovx) => {
    const qx = clamp(B.p.x, ox - hx, ox + hx), qz = clamp(B.p.z, o.zc - hz, o.zc + hz), dx = B.p.x - qx, dz = B.p.z - qz, d = Math.hypot(dx, dz);
    if (d < BR && d > 1e-4) { const nx = dx / d, nz = dz / d; B.p.x += nx * (BR - d); B.p.z += nz * (BR - d); const vn = B.vx * nx + B.vz * nz; if (vn < 0) { B.vx -= 1.6 * vn * nx; B.vz -= 1.6 * vn * nz; } B.vx += ovx * 0.9 + nx * 2; bump(); }
  };
  if (o.type === 'slide') {
    const ox = o.cx + Math.sin(t * o.sp + o.ph) * o.amp, ovx = Math.cos(t * o.sp + o.ph) * o.amp * o.sp;
    o.m.position.set(ox, o.y + 0.45, o.zc); blk(ox, o.hx, o.hz, ovx); return;
  }
  if (o.type === 'twin') {
    const u = 0.5 + 0.5 * Math.sin(t * o.sp + o.ph), du = 0.5 * Math.cos(t * o.sp + o.ph) * o.sp, off = o.hx + 0.78 * u, dg = 0.78 * du;   // 0 = closed, 1 = open (gap 1.56)
    const lx = o.cx - off, rx = o.cx + off;
    o.ms[0].position.set(lx - o.cx, 0.55, 0); o.ms[1].position.set(rx - o.cx, 0.55, 0); o.m.position.set(o.cx, o.y, o.zc);
    blk(lx, o.hx, o.hz, -dg); blk(rx, o.hx, o.hz, dg); return;
  }
  const ang = t * o.sp + o.ph, arms = o.type === 'spin' ? 4 : 1;
  if (o.type === 'sweep') { const a = Math.sin(ang) * 1.25 + (o.side > 0 ? Math.PI : 0); o.m.rotation.y = -a; o.ang = a; }
  else o.m.rotation.y = -ang;
  for (let i = 0; i < arms; i++) {
    const a = o.type === 'sweep' ? o.ang : ang + i * Math.PI / 2;
    const ex = o.px + Math.cos(a) * o.len, ez = o.zc + Math.sin(a) * o.len;
    const vx = ex - o.px, vz = ez - o.zc, l2 = vx * vx + vz * vz, tt = clamp(((B.p.x - o.px) * vx + (B.p.z - o.zc) * vz) / l2, 0, 1);
    const qx = o.px + vx * tt, qz = o.zc + vz * tt, dx = B.p.x - qx, dz = B.p.z - qz, d = Math.hypot(dx, dz), rr = BR + 0.16;
    if (d < rr && d > 1e-4) {
      const nx = dx / d, nz = dz / d; B.p.x += nx * (rr - d); B.p.z += nz * (rr - d);
      const vn = B.vx * nx + B.vz * nz; if (vn < 0) { B.vx -= 1.5 * vn * nx; B.vz -= 1.5 * vn * nz; }
      const w = o.type === 'sweep' ? Math.cos(ang) * 1.25 * o.sp : o.sp, tv = w * Math.sqrt(l2) * tt;
      B.vx += nx * Math.abs(tv) * 0.9 + nx * 1.5; B.vz += nz * Math.abs(tv) * 0.9; bump();
    } else if (d < rr + 0.22 && !o.close && !dry) { o.close = true; post('close'); }
  }
}
const BP = 2.6;   // blink period: the left lane is solid for the first half, the right lane for the second
function blinkOn(s) { return (ot + s.ph) % BP < BP / 2; }
function warn2(s) { const c = (ot + s.ph) % (BP / 2); return c < 0.25; }   // the lane that just went dark lingers as a ghost for a moment
function blinkWarn(s) { const c = (ot + s.ph) % (BP / 2); return c > BP / 2 - 0.4; }
// one physics step of s seconds
function step(s) {
  if (!dry) A.tick(s); ot += s * (state === 'play' ? A.k() : 1);
  if (state === 'play') { runT += s; chainT += s; if (chainT > 1.4) chain = 0; if (fever > 0) fever -= s; }
  const hold = state === 'won' ? false : (holding || (botOn && botHold) || roll > 0); roll = Math.max(0, roll - s);
  const sf0 = B.ground ? surfAt(B.p.x, B.p.z) : null, onIce = sf0 && sf0.s.ice;
  const maxV = MAXV * (state === 'play' ? 1 + (A.k() - 1) * 0.75 : 1) + B.boost;
  if (hold) B.vz = Math.max(B.vz - ACC * s, -maxV); else B.vz *= Math.exp(-1.5 * s);   // let go to slow down and wait
  if (B.vz < -maxV) B.vz = lerp(B.vz, -maxV, 0.05);
  B.boost = Math.max(0, B.boost - 4 * s);
  const lk = onIce ? 0.1 : 0.45;
  if (holding && state === 'play') { B.vx = lerp(B.vx, steerPx * 0.011 / s, lk); steerPx = 0; }
  else if (botOn && state === 'play') B.vx = lerp(B.vx, clamp((botX - B.p.x) * 5, -7, 7), onIce ? 0.12 : 0.3);
  else B.vx *= Math.exp(-(B.ground ? (onIce ? 0.45 : 5) : 0.5) * s);
  if (D.on && state === 'play' && !holding && !botOn) { demoT += s; const sg = segAt(B.p.z) || segs[0];
    B.vz = lerp(B.vz, demoT < 2.6 && B.p.z > -2.5 ? -2.4 : 0, 0.08); B.vx = lerp(B.vx, clamp((cx(sg, B.p.z) + Math.sin(demoT * 2.4) * 0.9 - B.p.x) * 4, -4, 4), 0.2); }
  B.p.x += B.vx * s; B.p.z += B.vz * s;
  if (sf0 && sf0.s.belt) B.p.x += sf0.s.belt * 1.7 * s;
  const sf = surfAt(B.p.x, B.p.z);
  if (B.ground) {
    if (sf && Math.abs(B.p.y - BR - sf.y) < 0.55) {
      B.p.y = sf.y + BR; gy = sf.y; B.k = sf.k; B.vz += G * sf.k * s * 0.75;
      if (sf.s.rails) { const lim = sf.s.w / 2 - BR - 0.05; if (Math.abs(B.p.x - sf.c) > lim) { B.p.x = sf.c + Math.sign(B.p.x - sf.c) * lim; B.vx *= -0.4; } }
      if (sf.s.crumble) { sf.s.cr += s; if (sf.s.cr > 0.34 && !sf.s.gone) { sf.s.gone = true; sf.s.fall = 0; post('crumble', sf.s); } }
      // near-miss on the edge of a thin plank
      if (state === 'play' && (sf.s.narrow || sf.s.ice) && sf.s.w < 2.1) { const e = sf.s.w / 2 + 0.06 - Math.abs(B.p.x - sf.c); if (e < 0.14) edgeFlag = true; else if (edgeFlag && e > 0.35) { edgeFlag = false; post('edge'); } }
    } else { B.ground = false; B.vy = -B.vz * B.k; airT = 0; }
  } else {
    B.vy -= G * s; B.p.y += B.vy * s; airT += s;
    if (sf && B.vy <= 0 && B.p.y - BR <= sf.y && B.p.y - BR > sf.y - 0.6) {
      B.p.y = sf.y + BR; B.ground = true;
      if (airT > 0.2) post('land', Math.min(1, -B.vy / 8), airT, sf.y);
      B.vy = 0;
    }
  }
  for (const o of obs) { if (Math.abs(o.zc - B.p.z) < 14) collide(o, ot); else if (o.type === 'spin') o.m.rotation.y = -(ot * o.sp + o.ph); else if (o.type === 'sweep') o.m.rotation.y = -(ot * o.sp + o.ph); if (!o.past && B.p.z < o.zc - 1.5 && B.ground && state === 'play') { o.past = true; if (!dry) A.ok(); } }
  for (const p of pads) if (B.ground && Math.abs(B.p.z - p.z) < 1.3 && Math.abs(B.p.x - cx(p.seg, p.z)) < 0.8 && B.boost < 4) { B.boost = 7; B.vz = -(MAXV + 6); post('boost'); }
  if (state === 'play') {
    for (let i = 0; i < cps.length; i++) if (i > cpIdx && B.p.z < cps[i].z0 - 1.5 && B.ground) { cpIdx = i; if (!dry) A.ok(); cpZ = cps[i].z0 - 1.5; post(cps[i].auto ? 'cpa' : 'cp'); }
    for (const g of gems) if (!g.got && Math.abs(g.z - B.p.z) < 0.9 && Math.hypot(g.x - B.p.x, g.y - B.p.y, g.z - B.p.z) < 0.85) collectGem(g);
    for (const g of golds) if (!g.got && Math.abs(g.z - B.p.z) < 1.1 && Math.hypot(g.x - B.p.x, g.y - B.p.y, g.z - B.p.z) < 0.9) collectGem(g);
    if (B.p.z < finishZ && B.ground) { state = 'won'; finishT = 0; post('won'); }
    else if (B.p.y < (sf ? sf.y : gy) - 6) fell();
  } else finishT += s;
}

// ---------------------------------------------------------------- frame (visuals, sounds, hud)
const pct = () => Math.max(0, Math.min(1, (6 - B.p.z) / totalLen));
function chainPop(n) {
  note(72 + Math.min(12, n), 0.18, 0.11);
}
function handle(e) {
  switch (e[0]) {
    case 'pop': ui.pop(e[1], e[2], e[3], e[4]); break;
    case 'coin': sfx.coin(); buzz([10, 30, 10]); break;
    case 'lives': setLives(); buzz([40, 30, 40]); break;
    case 'fail': sfx.fail(); break;
    case 'tip': ui.pop(e[1], '#fff3a0', 24, 40); chip('HINT', e[1].replace('TIP: ', '')); break;
    case 'cpa': sfx.coin(); ui.pop('SAVED', '#5ce1ff', 22, 24); break;
    case 'lost': F.level(false, pct()); showLose(); break;
    case 'bump': sfx.bounce(); buzz(15); B.squash = 0.8; burst(world, B.p, ['#ffffff', '#ffd21f'], 8, { speed: 0.08, up: 0.06, size: 0.5 }); break;
    case 'close': ui.pop('CLOSE!', '#fff', 30, 28); tone(700, 0.09, 'triangle', 0.1, 1.5); A.near(0.5); break;
    case 'edge': ui.pop('EDGE!', '#ffe27a', 30, 28); tone(820, 0.1, 'triangle', 0.1, 1.4); break;
    case 'boost': tone(300, 0.35, 'sawtooth', 0.08, 2.4); buzz(12); ui.pop('BOOST!', '#7ff0ff', 36, 30); shake = 0.25; break;
    case 'cp': sfx.coin(); ui.pop('CHECKPOINT!', '#5ce1ff', 32, 30); burst(world, B.p, ['#5ce1ff', '#ffffff'], 14, { speed: 0.1, up: 0.08, size: 0.6 }); break;
    case 'land': { B.squash = Math.min(1, e[1]); sfx.bounce(); buzz(10); shake = Math.max(shake, 0.12 + 0.3 * e[1]); burst(world, tmp.copy(B.p).setY(e[3] + 0.05), ['#ffffff', '#e2b47a'], 10, { speed: 0.07, up: 0.04, size: 0.5 }); if (e[2] > 0.45) { A.ok(); ui.pop(['NICE JUMP!', 'WHOOSH!', 'AIR TIME!'][Math.floor(Math.random() * 3)], '#fff', 32, 30); shake = 0.3; } break; }
    case 'crumble': sfx.bounce(); e[1].shk = 0; break;
    case 'gem': { const g = e[1], n = e[2]; chainPop(n); burst(world, tmp.set(g.x, g.y, g.z), ['#46c8ff', '#ffffff'], 6, { speed: 0.06, up: 0.05, size: 0.4 }); buzz(5);
      if (n === 5 || n === 10 || n === 20 || n === 30) { ui.pop(n >= 20 ? 'UNSTOPPABLE ×' + n : n >= 10 ? 'ON FIRE ×' + n : 'COMBO ×' + n, '#7ff0ff', 30 + Math.min(14, n / 2), 24); shake = 0.3; ui.flash(0.18); } break; }
    case 'fever': ui.pop('FEVER! ×2 💎', '#ffd21f', 44, 24); ui.flash(0.35); sfx.coin(); shake = 0.5; break;
    case 'gold': { const g = e[1]; g.m.visible = false; g.halo.visible = false; sfx.win(); buzz([15, 30, 15]); ui.flash(0.3); burst(world, tmp.set(g.x, g.y, g.z), ['#ffd21f', '#fff3a0', '#ffffff'], 26, { speed: 0.14, up: 0.1, size: 0.7, shape: 'sphere' }); ui.pop('★ ' + goldN + '/' + totalGolds, '#ffd21f', 46, 26); shake = 0.45; stopT = 0.06; break; }
    case 'won': winLevel(); break;
  }
}

function frame(dt, t) {
  if (!segs) return;
  if (state === 'play' || state === 'won') {
    let left = Math.min(dt, 2) / 60;
    if (stopT > 0) { stopT -= left; left = 0; }
    const n = Math.max(1, Math.ceil(left / DT - 1e-6));
    if (left > 0) for (let i = 0; i < n && (state === 'play' || state === 'won'); i++) step(left / n);
    while (evs.length) handle(evs.shift());
    if (state === 'play') { ui.progress(pct()); setHud(); }
  }
  // crumbling / blinking tiles
  for (const s of segs) {
    if (s.lane) { const on = blinkOn(s), warn = blinkWarn(s), fl = Math.floor(ot * 14) % 2; s.lane.forEach((l, i) => { const solid = i === 0 ? on : !on; l.m.visible = solid || (!solid && warn2(s)); l.mt.emissiveIntensity = solid ? (warn ? (fl ? 0.9 : 0.15) : 0.35) : 0.5; l.m.scale.y = solid ? 1 : 0.25; }); continue; }
    if (!s.mesh) continue;
    if (s.crumble) { if (s.gone) { s.fall = (s.fall || 0) + dt / 60; s.mesh.position.y = s.mesh.userData.y0 - s.fall * s.fall * 12; s.mesh.visible = s.fall < 1.2; if (s.edge) s.edge.visible = false; } else { s.mat.color.set(s.cr > 0.02 ? (Math.floor(s.cr * 30) % 2 ? '#ff9a7a' : '#e9c9a0') : '#e9c9a0'); } }
    if (s.bt) s.bt.offset.x -= dt / 60 * 0.5 * s.belt * Math.sign(s.bt.repeat.x);
  }
  animGems(t);
  // ball visuals
  const vel = Math.hypot(B.vx, B.vz);
  if (vel > 0.01) { axis.set(-B.vz, 0, B.vx).normalize(); dq.setFromAxisAngle(axis, -vel * Math.min(dt, 2) / 60 / BR); B.rot.premultiply(dq); }
  B.squash = Math.max(0, B.squash - 0.06 * dt);
  ball.position.copy(B.p); ball.position.y -= B.squash * 0.12; ball.quaternion.copy(B.rot);
  ball.scale.set(1 + B.squash * 0.25, 1 - B.squash * 0.3, 1 + B.squash * 0.25);
  const fast = vel > MAXV + 1 || B.boost > 2;
  if (fast) $('speed').classList.add('on'); else $('speed').classList.remove('on');
  if (state === 'play' && vel > 2 && B.ground) {   // trail in the ball's colours
    trailT += dt; if (trailT > (fast ? 1 : 3)) { trailT = 0; const sk = SKINS[skinIdx]; burst(world, tmp.copy(B.p).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.25, 0.45)), fever > 0 ? ['#ffd21f', '#fff3a0'] : sk.c, 1, { speed: 0.012, up: 0.008, size: 0.45, gravity: 0, life: 0.55, shape: 'sphere' }); }
  }
  // camera
  const sfc = surfAt(B.p.x, B.p.z); if (B.ground || (sfc && B.p.y > sfc.y)) camY = lerp(camY, B.p.y, 0.12 * dt);
  else if (B.p.y > camY - 1) camY = lerp(camY, B.p.y, 0.05 * dt);
  const sp = Math.min(1, -B.vz / (MAXV + 6)), cxT = B.p.x * 0.85, czT = B.p.z + 4.6 + sp * 0.6;
  shake = Math.max(0, shake - 0.03 * dt);
  const sx = (Math.random() - 0.5) * shake * 0.25, sy = (Math.random() - 0.5) * shake * 0.25;
  camera.position.set(lerp(camera.position.x, cxT, 0.15 * dt) + sx, lerp(camera.position.y, camY + 2.5, 0.15 * dt) + sy, state === 'won' ? lerp(camera.position.z, B.p.z + 3 + finishT * 2, 0.05 * dt) : czT);
  camera.lookAt(B.p.x * 0.9, camY + 0.2, B.p.z - 5);
  const fov = 62 + sp * 10 + (fever > 0 ? 4 : 0); if (Math.abs(camera.fov - fov) > 0.2) { camera.fov = lerp(camera.fov, fov, 0.08); camera.updateProjectionMatrix(); }
  followLight(B.p);
}
let trailT = 0;
loop(frame);

// ---------------------------------------------------------------- DOM: hud, win card, map, balls
const css = document.createElement('style');
css.textContent = `
#mdhud{position:fixed;inset:0;pointer-events:none;z-index:5}
.mdbar{position:absolute;left:14px;right:14px;top:calc(92px + env(safe-area-inset-top));display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:17px;text-shadow:0 2px 0 rgba(0,0,0,.18)}
#mdst i{font-style:normal;font-size:26px;color:rgba(255,255,255,.4);margin-right:2px;transition:transform .2s}
#mdst i.on{color:#ffd21f;transform:scale(1.2);text-shadow:0 0 10px #ffb300,0 2px 0 rgba(0,0,0,.2)}
#mdt.late{color:#ffd2d2;opacity:.8}
#mdmenu{position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top));width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.2);border:0;color:#fff;font-size:20px;pointer-events:auto;display:flex;align-items:center;justify-content:center}
#mdchip{position:fixed;left:50%;top:calc(150px + env(safe-area-inset-top));transform:translate(-50%,-20px) scale(.9);opacity:0;transition:all .25s;background:rgba(20,20,40,.55);border-radius:16px;padding:8px 18px;text-align:center;z-index:6;pointer-events:none;display:flex;flex-direction:column;line-height:1.1}
#mdchip.on{opacity:1;transform:translate(-50%,0) scale(1)}
#mdchip b{font-size:20px;color:#ffe27a}#mdchip span{font-size:14px;opacity:.9}
.mdov{position:fixed;inset:0;z-index:12;display:flex;flex-direction:column;align-items:center;color:#fff;text-align:center}
.mdov.win{background:rgba(10,20,50,.38);justify-content:flex-start;padding:calc(110px + env(safe-area-inset-top)) 18px 40px;gap:8px}
.mdov h2{margin:0;font-size:clamp(34px,10vw,54px);line-height:.95;text-shadow:0 5px 0 rgba(0,0,0,.18)}
.mdov p{margin:0;font-size:19px;font-weight:700;text-shadow:0 2px 0 rgba(0,0,0,.18)}
.mdstars{display:flex;gap:10px;margin:8px 0}
.mdstars i{font-style:normal;font-size:78px;line-height:1;color:rgba(255,255,255,.28);transform:scale(.3);opacity:0;transition:transform .35s cubic-bezier(.3,1.8,.5,1),opacity .2s}
.mdstars i.show{opacity:1;transform:scale(1)}
.mdstars i.on{color:#ffd21f;text-shadow:0 0 18px #ffb300,0 4px 0 rgba(0,0,0,.22)}
.mdstars i.mid{margin-top:-14px}
.mdrow{display:flex;gap:6px;align-items:center;font-size:17px;font-weight:700;opacity:0;transition:opacity .3s}.mdrow.show{opacity:1}
.mdnear{font-size:20px;font-weight:800;color:#ffe27a;min-height:26px}
.mdchest{width:min(300px,76vw);height:16px;background:rgba(255,255,255,.3);border-radius:10px;overflow:hidden;margin-top:6px}.mdchest i{display:block;height:100%;background:linear-gradient(90deg,#ffd21f,#ff9f1a);border-radius:10px;width:0;transition:width .7s}
.mdnew{display:flex;flex-direction:column;align-items:center;gap:4px;animation:hcpulse 1.2s infinite}
.mdball{width:84px;height:84px;border-radius:50%;box-shadow:inset -10px -12px 18px rgba(0,0,0,.25),inset 8px 8px 14px rgba(255,255,255,.4),0 6px 0 rgba(0,0,0,.18)}
.mdbtns{margin-top:auto;display:flex;flex-direction:column;gap:12px;align-items:center;width:100%}
.mdnext{font:inherit;font-weight:800;font-size:30px;color:#fff;background:#3cc46a;border:0;border-radius:44px;padding:14px 70px;box-shadow:0 6px 0 #2a9a50;animation:hcpulse 1.4s ease-in-out infinite;pointer-events:auto}
.mdsm{display:flex;gap:10px}.mdsm button{font:inherit;font-weight:800;font-size:18px;color:#fff;background:rgba(0,0,0,.28);border:0;border-radius:30px;padding:8px 20px}
.mdov.map{background:linear-gradient(180deg,var(--m1),var(--m2));justify-content:flex-start}
.mdtop{width:100%;padding:calc(12px + env(safe-area-inset-top)) 14px 10px;display:flex;flex-direction:column;gap:6px;background:rgba(0,0,0,.18);font-weight:800}
.mdtop .r{display:flex;justify-content:space-between;align-items:center;font-size:20px}.mdtop button{font:inherit;font-weight:800;color:#fff;background:rgba(255,255,255,.25);border:0;border-radius:22px;padding:4px 16px;font-size:17px}
.mdscroll{flex:1;overflow-y:auto;width:100%;display:flex;flex-direction:column-reverse;align-items:center;padding:20px 0 60px;-webkit-overflow-scrolling:touch;touch-action:pan-y}
.mdw{font-weight:800;font-size:24px;padding:14px 26px;margin:16px 0 8px;border-radius:30px;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.mdn{position:relative;width:62px;height:62px;border-radius:50%;margin:14px 0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;color:#fff;background:var(--c);box-shadow:0 5px 0 rgba(0,0,0,.2);border:0;font-family:inherit;flex:none}
.mdn.boss{width:76px;height:76px;font-size:28px;outline:4px solid #ffd21f}.mdn.boss:before{content:'👑';position:absolute;top:-22px;font-size:22px}
.mdn.lock{background:#9aa3b5;opacity:.75}.mdn.cur{animation:hcpulse 1s infinite;outline:4px solid #fff}
.mdn s{position:absolute;bottom:-18px;text-decoration:none;font-size:14px;letter-spacing:-1px;white-space:nowrap;color:#ffd21f;text-shadow:0 1px 0 rgba(0,0,0,.35)}
.mdn s u{text-decoration:none;color:rgba(255,255,255,.55)}
.mdov.balls{background:linear-gradient(180deg,var(--m1),var(--m2));padding:calc(20px + env(safe-area-inset-top)) 16px 30px;gap:12px;justify-content:flex-start}
.mdgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:100%;max-width:360px}
.mdcell{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:14px;font-weight:700;background:rgba(0,0,0,.16);border-radius:16px;padding:10px 4px}.mdcell.sel{outline:3px solid #ffd21f}
.mdcell .mdball{width:62px;height:62px}.mdcell.lock .mdball{background:#aab!important;filter:grayscale(1) brightness(.8)}
`;
document.head.appendChild(css);
const root = document.createElement('div');
root.innerHTML = `<div id="mdhud" class="hc-hidden"><div class="mdbar"><span id="mdg">💎 0</span><span id="mdst"></span><span id="mdt">0 s</span></div><button id="mdmenu" type="button">🗺️</button></div>
<div id="mdchip"></div>
<div id="mdwin" class="mdov win hc-hidden"></div><div id="mdmap" class="mdov map hc-hidden"></div><div id="mdballs" class="mdov balls hc-hidden"></div>`;
while (root.firstChild) document.body.appendChild(root.firstChild);
for (const id of ['mdwin', 'mdmap', 'mdballs', 'mdmenu']) $(id).addEventListener('pointerdown', e => e.stopPropagation());
$('mdmenu').addEventListener('click', () => { if (state === 'play' || state === 'ready') { state = 'map'; holding = false; openMap(); } });
$('mdhud').classList.remove('hc-hidden');

function winLevel() {
  F.level(true); const secs = runT; const had = stars()[level] || 0;
  const mask = 1 | (goldN >= totalGolds && falls === 0 ? 2 : 0) | (secs <= curDef.par ? 4 : 0);
  const all = stars(); all[level] = had | mask; ST.set('stars', all);
  const first = !(had & 1); if (first) { WB.submit(1); }
  if (level >= ST.get('lv', 1)) ST.set('lv', Math.min(level + 1, NL + 999));
  ST.set('gems', ST.get('gems', 0) + gemN);
  const best = ST.get('bt', {}), oldBest = best[level]; if (!oldBest || secs < oldBest) { best[level] = +secs.toFixed(2); ST.set('bt', best); }
  const day = Math.floor(Date.now() / 864e5), dl = ST.get('daily', { d: day, n: 0, s: 0, ls: -9 });
  if (dl.d !== day) { dl.d = day; dl.n = 0; } dl.n++;
  let dayTxt = `Today ${Math.min(dl.n, 3)}/3`;
  if (dl.n === 3 && dl.ls !== day) { dl.s = dl.ls === day - 1 ? dl.s + 1 : 1; dl.ls = day; ST.set('gems', ST.get('gems', 0) + 20); }
  if (dl.ls === day) dayTxt = `Day ${dl.s} streak${dl.n === 3 ? ' +20💎' : ''}`; ST.set('daily', dl);
  const bestTxt = !oldBest ? '' : secs < oldBest ? ` · NEW BEST −${(oldBest - secs).toFixed(1)} s` : ` · best ${oldBest.toFixed(1)} s`;
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1);
  confetti(world, B.p.clone().add(new THREE.Vector3(0, 1.5, -2)), 110);
  const before = totalStars() - (starCount(all[level]) - starCount(had)), won = giveChests();
  const nextAt = (Math.floor(totalStars() / CHEST) + 1) * CHEST, prevAt = nextAt - CHEST;
  let near = ''; const miss = [];
  if (!(mask & 2)) miss.push(goldN < totalGolds ? `${totalGolds - goldN} golden ★ missed` : 'golds without a fall'); if (!(mask & 4)) miss.push(`${(secs - curDef.par).toFixed(1)} s over par`);
  if (miss.length === 1) near = (!(mask & 4) && secs - curDef.par > 3 ? '' : 'SO CLOSE: ') + miss[0]; else if (miss.length === 2) near = miss.join(' · '); else near = 'PERFECT!';
  const w = $('mdwin'), ns = [1, 2, 4];
  w.innerHTML = `<h2>${curDef.boss ? 'BOSS DOWN!' : 'COURSE ' + level}</h2><p>${curDef.name}</p>
  <div class="mdstars">${ns.map((b, i) => `<i class="${i === 1 ? 'mid' : ''}" data-b="${b}">★</i>`).join('')}</div>
  <div class="mdnear">${near}</div>
  <div class="mdrow" data-r>💎 ${gemN} gems</div><div class="mdrow" data-r>⏱ ${secs.toFixed(1)} s · par ${curDef.par} s${bestTxt}</div><div class="mdrow" data-r>📅 ${dayTxt}</div><div class="mdrow" data-r>★ ${totalStars()} stars · ${nextAt - totalStars() <= 3 ? `<b>${nextAt - totalStars()}★ to a NEW BALL!</b>` : `next ball at ${nextAt}★`}</div><div class="mdrow" data-r>🌙 Tomorrow: 3 courses = +20💎 and the streak grows</div>
  <div class="mdchest"><i style="width:${Math.round((before - prevAt) / CHEST * 100)}%"></i></div>
  ${won.length ? `<div class="mdnew"><div class="mdball" style="background:${swatch(SKINS[won[0]])}"></div><p>NEW BALL: ${SKINS[won[0]].n}!</p></div>` : ''}
  <div class="mdbtns"><button class="mdnext" type="button">NEXT ▶</button><div class="mdsm"><button type="button" data-a="again">↻ Again</button><button type="button" data-a="map">🗺️ Map</button></div></div>`;
  setTimeout(() => {
    w.classList.remove('hc-hidden');
    const els = [...w.querySelectorAll('.mdstars i')]; let k = 0;
    els.forEach((e, i) => setTimeout(() => { e.classList.add('show'); if (mask & ns[i]) { e.classList.add('on'); note(76 + i * 4, 0.3, 0.14); buzz(10); burst(world, B.p.clone().add(new THREE.Vector3(0, 1.2, 0)), ['#ffd21f', '#fff'], 10, { speed: 0.1, up: 0.08, size: 0.5 }); } else tone(180, 0.15, 'square', 0.05, 0.7); }, 250 + i * 330));
    w.querySelectorAll('[data-r]').forEach((e, i) => setTimeout(() => e.classList.add('show'), 1200 + i * 150));
    setTimeout(() => { w.querySelector('.mdchest i').style.width = Math.round((totalStars() - prevAt) / CHEST * 100) + '%'; }, 1500);
    if (won.length) { setSkin(won[0]); setTimeout(() => { sfx.win(); ui.flash(0.4); }, 1600); }
  }, 450);
  w.querySelector('.mdnext').onclick = e => { e.stopPropagation(); goNext(); };
  w.onpointerdown = e => { if (e.target.dataset.a === 'again') { e.stopPropagation(); play(level); } else if (e.target.dataset.a === 'map') { e.stopPropagation(); openMap(); } else if (!e.target.closest('button')) goNext(); };
}
function goNext() { play(level + 1); }
function play(n) { level = Math.max(1, n); ST.set('cur', level); state = 'play'; buildLevel(); sfx.tap(); WB.start(); }
function showLose() {
  const p = pct(), left = Math.round((1 - p) * totalLen);
  const bp = ST.get('bp', {}), prev = bp[level] || 0; if (p > prev) { bp[level] = +p.toFixed(3); ST.set('bp', bp); }
  const bestTxt = p > prev + 0.005 ? ' · NEW BEST' : prev ? ' · best ' + Math.round(prev * 100) + '%' : '';
  ui.lose('FELL OFF!', p > 0.8 ? `SO CLOSE: ${left} m from the finish` : Math.round(p * 100) + '% of the course' + (goldN ? ` · ${goldN}★ found` : '') + bestTxt);
}
function starsHtml(m) { const n = starCount(m); return '<s>' + '★'.repeat(n) + '<u>' + '★'.repeat(3 - n) + '</u></s>'; }
function openMap() {
  const all = stars(), top = Math.max(1, ST.get('lv', 1)), M = $('mdmap'), W = wl(top);
  M.style.setProperty('--m1', W.bg[0]); M.style.setProperty('--m2', W.bg[1]);
  const nextAt = (Math.floor(totalStars() / CHEST) + 1) * CHEST, got = unlocked().length;
  let nodes = '';
  for (let n = 1; n <= Math.min(NL, top + 2); n++) {
    const wi = worldOf(n), d = LEVELS[n - 1], lock = n > top, off = Math.round(Math.sin(n * 1.1) * 62);
    if (WORLDS[wi].from === n) nodes += `<div class="mdw" style="background:${WORLDS[wi].tint}">${WORLDS[wi].name}</div>`;
    nodes += `<button type="button" class="mdn ${d.boss ? 'boss' : ''} ${lock ? 'lock' : ''} ${n === top ? 'cur' : ''}" style="--c:${WORLDS[wi].tint};transform:translateX(${off}px)" data-n="${n}">${lock ? '🔒' : n}${starsHtml(all[n] || 0)}</button>`;
  }
  if (top > NL) nodes += `<button type="button" class="mdn cur" style="--c:#7b5cff" data-n="${top}">∞</button>`;
  M.innerHTML = `<div class="mdtop"><div class="r"><span>★ ${totalStars()} · 💎 ${ST.get('gems', 0)}</span><span><button type="button" data-a="balls">🎱 ${got}/${SKINS.length}</button> <button type="button" data-a="close">✕</button></span></div><div class="mdchest" style="width:100%;margin:0"><i style="width:${Math.round((totalStars() % CHEST) / CHEST * 100)}%"></i></div><div style="font-size:14px;opacity:.9">${nextAt - totalStars()} more ★ → next ball</div></div><div class="mdscroll">${nodes}</div>`;
  $('mdwin').classList.add('hc-hidden'); M.classList.remove('hc-hidden'); ui.els.start.classList.add('hc-hidden'); ui.els.lose.classList.add('hc-hidden');
  M.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'close') { M.classList.add('hc-hidden'); if (state === 'map') state = 'play'; if (state === 'won') $('mdwin').classList.remove('hc-hidden'); }
    else if (b.dataset.a === 'balls') openBalls();
    else if (b.dataset.n && !b.classList.contains('lock')) { M.classList.add('hc-hidden'); play(+b.dataset.n); }
  };
  const cur = M.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
}
function openBalls() {
  const Bl = $('mdballs'), own = unlocked(), W = wl(Math.max(1, ST.get('lv', 1)));
  Bl.style.setProperty('--m1', W.bg[0]); Bl.style.setProperty('--m2', W.bg[1]);
  Bl.innerHTML = `<h2>BALLS</h2><p>${own.length}/${SKINS.length} · a new one every ${CHEST}★</p><div class="mdgrid">${SKINS.map((s, i) => `<div class="mdcell ${own.includes(i) ? '' : 'lock'} ${i === skinIdx ? 'sel' : ''}" data-i="${i}"><div class="mdball" style="background:${swatch(s)}"></div>${own.includes(i) ? s.n : '???'}</div>`).join('')}</div><div class="mdbtns"><div class="mdsm"><button type="button" data-a="back">◀ Back</button></div></div>`;
  Bl.classList.remove('hc-hidden');
  Bl.onclick = e => { const c = e.target.closest('.mdcell'), b = e.target.closest('button'); if (b && b.dataset.a === 'back') Bl.classList.add('hc-hidden'); else if (c && !c.classList.contains('lock')) { setSkin(+c.dataset.i); openBalls(); sfx.pick(2); } };
}

// ---------------------------------------------------------------- start
setSkin(ST.get('skin', 0));
buildLevel(); startHint();
addEventListener('resize', () => { camera.fov = 62; camera.updateProjectionMatrix(); });

// ---------------------------------------------------------------- QA hooks + planner bot
function snap() { return { p: B.p.clone(), vx: B.vx, vy: B.vy, vz: B.vz, g: B.ground, k: B.k, bo: B.boost, ot, roll, airT, gN: gemN, gd: goldN, ch: chain, chT: chainT, fv: fever, st: state, lv: lives, bp: bumps, fl: falls, rt: runT, cpI: cpIdx, cpz: cpZ,
  got: gems.map(g => g.got).concat(golds.map(g => g.got)), cr: segs.map(s => s.crumble ? [s.cr, s.gone] : 0), past: obs.map(o => o.past) }; }
function restore(S) { B.p.copy(S.p); B.vx = S.vx; B.vy = S.vy; B.vz = S.vz; B.ground = S.g; B.k = S.k; B.boost = S.bo; ot = S.ot; roll = S.roll; airT = S.airT; gemN = S.gN; goldN = S.gd; chain = S.ch; chainT = S.chT; fever = S.fv; state = S.st; lives = S.lv; bumps = S.bp; falls = S.fl; runT = S.rt; cpIdx = S.cpI; cpZ = S.cpz;
  let i = 0; for (const g of gems) g.got = S.got[i++]; for (const g of golds) g.got = S.got[i++]; segs.forEach((s, j) => { if (S.cr[j]) { s.cr = S.cr[j][0]; s.gone = S.cr[j][1]; } }); obs.forEach((o, j) => o.past = S.past[j]); }
// rollout: try a steering target for h seconds; score progress, gems, stars, bumps and falling
function rollout(tx, h, hd = true) {
  const S = snap(), z0 = B.p.z, g0 = gemN, gd0 = goldN, b0 = bumps, f0 = falls; dry = true; botOn = true; botX = tx; botHold = hd; let dead = 0, minE = 9;
  const L0 = lives; evs.length = 0;
  for (let i = 0; i < Math.round(h / DT) && state === 'play'; i++) { step(DT); if (lives < L0 || falls > f0) { dead = 1; break; } const sf = surfAt(B.p.x, B.p.z); if (sf && sf.s.w < 2.2) minE = Math.min(minE, sf.s.w / 2 - Math.abs(B.p.x - sf.c)); }
  const won = state === 'won', sc = (z0 - B.p.z) + (gemN - g0) * 1.2 + (goldN - gd0) * 25 - (bumps - b0) * 5 - dead * 400 + (won ? 200 : 0) + (minE < 0.35 ? -2 : 0);
  restore(S); dry = false; botHold = true; evs.length = 0; return sc;
}
function plan() {
  const sg = segAt(B.p.z - 3) || segAt(B.p.z) || segs[0], half = Math.max(0.2, sg.w / 2 - 0.45), cc = cx(sg, B.p.z - 2);
  let bestS = -1e9, bestX = B.p.x, bestH = true;
  for (const hd of [true, false]) for (const f of [-1, -0.6, -0.3, 0, 0.3, 0.6, 1]) { const x = cc + f * half, s = rollout(x, 1.6, hd) - Math.abs(f) * 0.25 - (hd ? 0 : 1.5); if (s > bestS) { bestS = s; bestX = x; bestH = hd; } }
  const gd = golds.filter(g => !g.got && g.z < B.p.z && B.p.z - g.z < 9)[0];
  if (gd) for (const hd of [true, false]) { const s2 = rollout(gd.x, 1.6, hd) + 4 - (hd ? 0 : 1.5); if (s2 > bestS) { bestS = s2; bestX = gd.x; bestH = hd; } }
  botX = bestX; botHold = bestH; botOn = true;
}
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.max(0, level - 1) * 100 + Math.round(pct() * 100); }, get adapt() { return A.state; },
  get stars() { return { by: stars(), total: totalStars(), gold: goldN, golds: totalGolds, gems: gemN, par: curDef.par, time: runT }; },
  go(n) { ui.els.start.classList.add('hc-hidden'); play(n); }, plan, map() { openMap(); },
  bot() { if (state !== 'play' || holding) return; A.input(); plan(); },
  // headless: play course n with the planner at full speed; no drawing. returns what happened
  solve(n, maxT = 140) {
    ui.els.start.classList.add('hc-hidden'); play(n); botOn = true; let k = 0; const t1 = performance.now();
    while (state === 'play' && runT < maxT) { if (k++ % 9 === 0) plan(); step(DT); evs.length = 0; }
    const r = { won: state === 'won', t: +runT.toFixed(1), gold: goldN, golds: totalGolds, gems: gemN, gemsTotal: gems.length, falls, bumps, lives, ms: Math.round(performance.now() - t1) };
    if (state === 'won') { state = 'ready'; } return r;
  },
  setStars(o) { ST.set('stars', o); }, setLv(n) { ST.set('lv', n); },
};

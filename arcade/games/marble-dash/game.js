// Marble Dash — original game. Hold to roll, slide your finger to steer a glossy ball along a floating obstacle course.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, buzz, mat, glossy, rounded, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';

const ST = store('marbledash');
const F = flow('marbledash');
let level = ST.get('level', 1), best = ST.get('best', 0);
const { scene, camera, followLight } = createStage({ fov: 58, shadowSize: 12 });
const ui = createUI({ title: 'MARBLE<br>DASH', hint: 'Hold to roll · slide to steer', hand: '👆', score: false });
const $ = id => document.getElementById(id);
const PALS = [
  { bg: ['#7fd0ff', '#e6f7ff'], ui: '#2f80ff' }, { bg: ['#ffb3d1', '#fff0d6'], ui: '#ff4f9a' }, { bg: ['#a7f0c9', '#effff6'], ui: '#16a34a' },
  { bg: ['#c9b6ff', '#fbe8ff'], ui: '#7b5cff' }, { bg: ['#ffd18a', '#fff7e0'], ui: '#ff8c1a' },
];

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const woodTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#e2b47a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) { x.fillStyle = ['#dcaa6c', '#e8bf88', '#d9a565', '#e5b97f', '#dfae73'][i]; x.fillRect(i * w / 5, 0, w / 5, h); }
  x.strokeStyle = 'rgba(120,70,30,.35)'; x.lineWidth = 3; for (let i = 0; i <= 5; i++) { x.beginPath(); x.moveTo(i * w / 5, 0); x.lineTo(i * w / 5, h); x.stroke(); }
  x.strokeStyle = 'rgba(150,90,40,.18)'; x.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const px = Math.random() * w; x.beginPath(); x.moveTo(px, Math.random() * h); x.bezierCurveTo(px + 4, 80, px - 4, 160, px + 2, h); x.stroke(); }
  x.fillStyle = 'rgba(120,70,30,.3)'; for (let i = 0; i < 5; i++) x.fillRect(i * w / 5 + 2, (i * 97) % h, w / 5 - 4, 3);
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
const stripeTex = canvasTex(64, 16, (x, w, h) => { x.fillStyle = '#ffd21f'; x.fillRect(0, 0, w, h); x.fillStyle = '#23232e'; for (let i = -2; i < 8; i++) { x.beginPath(); x.moveTo(i * 12, h); x.lineTo(i * 12 + 6, h); x.lineTo(i * 12 + 14, 0); x.lineTo(i * 12 + 8, 0); x.fill(); } });
stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping;
const arrowTex = canvasTex(128, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 3; i++) { const y = 40 + i * 70; x.beginPath(); x.moveTo(w / 2, y); x.lineTo(w - 14, y + 44); x.lineTo(w - 38, y + 44); x.lineTo(w / 2, y + 20); x.lineTo(38, y + 44); x.lineTo(14, y + 44); x.closePath(); x.fill(); } });
const ballTex = canvasTex(512, 256, (x, w, h) => {
  const cols = ['#ff4f6d', '#ffffff', '#2f80ff', '#ffffff', '#ffd21f', '#ffffff', '#22c55e', '#ffffff'];
  cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(i * w / 8, 0, w / 8 + 1, h); });
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, 22); x.fillRect(0, h - 22, w, 22);
});

// ---------------------------------------------------------------- decor: clouds + floating islands
{
  const R = rng(5), N = 40;
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 }), N), m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) { const s = 3 + R() * 6; m4.compose(new THREE.Vector3((R() < 0.5 ? -1 : 1) * (14 + R() * 40), -14 - R() * 10, 10 - R() * 400), new THREE.Quaternion(), new THREE.Vector3(s * 1.6, s * 0.6, s)); clouds.setMatrixAt(i, m4); }
  scene.add(clouds);
  const isl = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1.6, 6), mat('#9b7653', { flatShading: true }), 14), top = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.3, 6), mat('#6fd25a', { flatShading: true }), 14);
  for (let i = 0; i < 14; i++) { const s = 2 + R() * 3, p = new THREE.Vector3((i % 2 ? 1 : -1) * (12 + R() * 22), -3 - R() * 8, -R() * 380); m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), new THREE.Vector3(s, s, s)); isl.setMatrixAt(i, m4); m4.compose(p.clone().add(new THREE.Vector3(0, 0.15 * s, 0)), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); top.setMatrixAt(i, m4); }
  scene.add(isl, top);
}

// ---------------------------------------------------------------- track generation
const BR = 0.42, G = 24, ACC = 16, MAXV = 11.5;
let world, segs, obs, pads, cps, finishZ, totalLen, R;
function buildTrack() {
  if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  R = rng(level * 1777 + 9); const fk = F.k();
  segs = []; obs = []; pads = []; cps = [];
  let z = 6, x = 0, y = 0;
  const seg = (len, w, dx = 0, dy = 0, o = {}) => { const s = { z0: z, z1: z - len, x0: x, x1: x + dx, y0: y, y1: y + dy, w, ...o }; segs.push(s); z -= len; x += dx; y += dy; return s; };
  const gap = len => { z -= len; };
  seg(10, 3.4, 0, 0, { start: true });
  const pool = ['straight', 'narrow', 'down', 'jump', 'slider', 'boost', 'zig'];
  if (level >= 2) pool.push('sweeper', 'slider');
  if (level >= 3) pool.push('spinner', 'narrow', 'jump');
  if (level >= 5) pool.push('sweeper', 'spinner', 'bridge');
  const n = Math.min(20, 6 + level * 2);
  let last = '';
  for (let i = 0; i < n; i++) {
    let k = pool[Math.floor(R() * pool.length)]; if (k === last) k = 'straight'; last = k;
    if (level === 1 && i === 1) k = 'jump';
    if (level === 1 && i === 3) k = 'slider';
    if (i > 0 && i % 4 === 0) { const s = seg(3, 3, 0, 0, { cp: true }); cps.push(s); }
    const w = clamp((2.7 - level * 0.05) / fk, 1.85, 3.0);
    switch (k) {
      case 'straight': seg(7 + R() * 3, w, (R() - 0.5) * 3); break;
      case 'narrow': seg(2, w); seg(6 + R() * 3, clamp((1.45 - level * 0.04) / fk, 0.95, 1.6), (R() - 0.5) * 1.2, 0, { narrow: true }); seg(2, w); break;
      case 'down': seg(8, w + 0.4, 0, -2.6, { rails: true }); break;
      case 'jump': { seg(4, w, 0, 1.0, { ramp: true }); gap(clamp(2.2 + level * 0.15, 2.2, 3.6)); y -= 0.5; seg(7, w + 0.6); break; }
      case 'slider': { const s = seg(10, w + 0.2); obs.push({ type: 'slide', seg: s, zc: (s.z0 + s.z1) / 2, amp: (s.w / 2 - 0.5), sp: (1.6 + level * 0.12) * fk, ph: R() * 6 }); break; }
      case 'boost': { const s = seg(9, w + 0.3, 0, -0.6, { rails: true }); pads.push({ seg: s, z: s.z0 - 2.5 }); break; }
      case 'zig': { const d = (R() < 0.5 ? -1 : 1) * 2.2; seg(6, w, d); seg(6, w, -d); break; }
      case 'sweeper': { const s = seg(10, w + 0.3); obs.push({ type: 'sweep', seg: s, zc: (s.z0 + s.z1) / 2, side: R() < 0.5 ? -1 : 1, sp: (1.6 + level * 0.1) * fk, ph: R() * 6 }); break; }
      case 'spinner': { const s = seg(10, w + 0.6); obs.push({ type: 'spin', seg: s, zc: (s.z0 + s.z1) / 2, sp: (R() < 0.5 ? -1 : 1) * (1.2 + level * 0.08) * fk, ph: R() * 6 }); break; }
      case 'bridge': { for (let j = 0; j < 4; j++) seg(2.2, 1.4, (R() - 0.5) * 0.8, 0, { narrow: true, plank: true }); break; }
    }
  }
  seg(4, 3); const fin = seg(12, 4.2, 0, 0, { finish: true }); finishZ = fin.z0 - 2; totalLen = 6 - finishZ;
  // meshes
  const m = new THREE.Object3D();
  for (const s of segs) {
    const S = new THREE.Vector3(s.x0, s.y0, s.z0), E = new THREE.Vector3(s.x1, s.y1, s.z1), L = S.distanceTo(E) + 0.35;
    const tex = woodTex.clone(); tex.needsUpdate = true; tex.repeat.set(s.w / 2.6, L / 3);
    const material = s.finish ? glossy('#ffffff', { map: canvasTex(64, 64, (x) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#23232e' : '#ffffff'; x.fillRect(i * 8, j * 8, 8, 8); } }) }) : s.cp ? glossy('#5ce1ff') : mat('#ffffff', { map: tex, roughness: 0.55 });
    if (s.finish) { material.map.magFilter = THREE.NearestFilter; material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping; material.map.repeat.set(2, 6); }
    const geo = new THREE.BoxGeometry(s.w, 0.55, L); geo.translate(0, -0.275, 0);
    const mesh = new THREE.Mesh(geo, material); mesh.position.copy(S).lerp(E, 0.5); mesh.lookAt(E); mesh.receiveShadow = true; mesh.castShadow = true; world.add(mesh);
    if (s.rails) for (const sd of [-1, 1]) {
      const rt = stripeTex.clone(); rt.needsUpdate = true; rt.repeat.set(L / 1.2, 1);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, L, 10), mat('#ffffff', { map: rt })); rail.geometry.rotateX(Math.PI / 2); rail.geometry.rotateZ(Math.PI / 2);
      rail.position.copy(mesh.position); rail.quaternion.copy(mesh.quaternion); rail.translateX(sd * (s.w / 2 + 0.05)); rail.translateY(0.16); rail.castShadow = true; world.add(rail);
    }
    if (s.ramp) { const lip = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.12, 0.3), glossy('#ff4f6d')); lip.position.copy(E).add(new THREE.Vector3(0, -0.03, 0.15)); world.add(lip); }
  }
  for (const s of cps) { for (const sd of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), mat('#ffffff')); f.position.set(s.x0 + sd * (s.w / 2), s.y0 + 0.8, s.z0 - 1.5); const fl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.04), glossy('#5ce1ff')); fl.position.set(f.position.x - sd * 0.35, s.y0 + 1.4, f.position.z); world.add(f, fl); } }
  for (const p of pads) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, color: '#7ff0ff' })); const sf = surfAt(cx(p.seg, p.z), p.z); pm.position.set(cx(p.seg, p.z), sf.y + 0.02, p.z); pm.rotation.x = -Math.PI / 2 + Math.atan2(p.seg.y1 - p.seg.y0, p.seg.z0 - p.seg.z1); world.add(pm); p.m = pm; }
  // finish arch
  { const fs = segs[segs.length - 1], a = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 10, 36, Math.PI), glossy(PALS[(level - 1) % PALS.length].ui)); a.position.set(fs.x0, fs.y0, finishZ); a.castShadow = true; world.add(a); }
  // obstacles
  for (const o of obs) {
    const s = o.seg, c = cx(s, o.zc), y = surfAt(c, o.zc).y; o.cx = c; o.y = y;
    if (o.type === 'slide') { o.m = new THREE.Mesh(rounded(1.2, 0.9, 0.7, 0.12), glossy('#ff4f6d')); o.hx = 0.6; o.hz = 0.35; }
    if (o.type === 'sweep') {
      o.px = c + o.side * (s.w / 2 + 0.25); o.len = s.w + 0.5;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.4, 12), glossy('#ffffff')); post.position.set(o.px, y + 0.5, o.zc); post.castShadow = true; world.add(post);
      o.m = new THREE.Group(); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, o.len, 12), mat('#ffffff', { map: stripeTex })); bar.rotation.z = Math.PI / 2; bar.position.x = o.len / 2; bar.castShadow = true; o.m.add(bar); o.m.position.set(o.px, y + 0.35, o.zc);
    }
    if (o.type === 'spin') {
      o.px = c; o.len = s.w / 2 + 0.1;
      o.m = new THREE.Group(); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 16), glossy('#7b5cff')); hub.castShadow = true; o.m.add(hub);
      for (let a = 0; a < 2; a++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(o.len * 2, 0.28, 0.28), glossy('#ff8c1a')); bar.rotation.y = a * Math.PI / 2; bar.position.y = 0.05; bar.castShadow = true; o.m.add(bar); }
      o.m.position.set(c, y + 0.32, o.zc);
    }
    o.m.castShadow = true; world.add(o.m);
  }
}
const segAt = z => { for (const s of segs) if (z <= s.z0 && z >= s.z1) return s; return null; };
const cx = (s, z) => lerp(s.x0, s.x1, (s.z0 - z) / (s.z0 - s.z1));
function surfAt(x, z) {
  const s = segAt(z); if (!s) return null;
  const t = (s.z0 - z) / (s.z0 - s.z1), c = lerp(s.x0, s.x1, t);
  if (Math.abs(x - c) > s.w / 2 + 0.06) return null;
  return { y: lerp(s.y0, s.y1, t), k: (s.y1 - s.y0) / (s.z0 - s.z1), s, c };
}

// ---------------------------------------------------------------- ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 40, 28), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.16, metalness: 0.08 }));
ball.castShadow = true; scene.add(ball);
const B = { p: new THREE.Vector3(), vx: 0, vy: 0, vz: 0, ground: true, k: 0, boost: 0, squash: 0, rot: new THREE.Quaternion() };

// ---------------------------------------------------------------- state
let state = 'ready', lives = 3, cpIdx = -1, cpZ = 0, holding = false, steerPx = 0, botOn = false, botX = 0, t0 = 0, airT = 0, camY = 0, finishT = 0, deadT = 0;
function setLives() { $('lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives); }
function spawnAt(z) {
  const s = segAt(z) || segs[0]; const c = cx(s, z), sf = surfAt(c, z);
  B.p.set(c, sf.y + BR + 0.6, z); B.vx = B.vy = B.vz = 0; B.ground = false; B.boost = 0; deadT = 0;
  ball.visible = true;
}
function buildLevel() {
  const pal = PALS[(level - 1) % PALS.length];
  document.body.style.setProperty('--bg1', pal.bg[0]); document.body.style.setProperty('--bg2', pal.bg[1]); document.body.style.setProperty('--ui', pal.ui);
  buildTrack(); lives = 3; setLives(); cpZ = 2; cpIdx = -1; finishT = 0;
  spawnAt(2); camY = B.p.y; ui.levels(level); ui.progress(0); ui.sub(''); t0 = performance.now();
}

input({
  onDown() { if (state === 'play') { holding = true; botOn = false; } },
  onMove(dx) { if (state === 'play' && holding) steerPx += dx; },
  onUp() { holding = false; },
});
ui.onTap(w => {
  if (w === 'start') { state = 'play'; sfx.tap(); }
  else if (w === 'win') { level++; ST.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});

function fell() {
  lives--; setLives(); buzz([40, 30, 40]); sfx.fail();
  if (lives <= 0) { state = 'lost'; F.level(false, Math.min(1, (6 - B.p.z) / totalLen)); ui.lose('FELL OFF!', Math.round(Math.min(1, (6 - B.p.z) / totalLen) * 100) + '% of the track'); return; }
  ui.pop('CHECKPOINT', '#fff', 34, 30); spawnAt(cpZ); camY = B.p.y;
}
function win() {
  state = 'won'; F.level(true); finishT = 0; const secs = (performance.now() - t0) / 1000;
  best = best ? Math.min(best, secs) : secs; ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); ui.progress(1);
  confetti(world, B.p.clone().add(new THREE.Vector3(0, 1.5, -2)), 110);
  ui.win(level, secs.toFixed(1) + ' s');
}

function collide(o, t) {
  if (Math.abs(B.p.y - BR - o.y) > 1.2) return;
  if (o.type === 'slide') {
    const ox = o.cx + Math.sin(t * o.sp + o.ph) * o.amp, ovx = Math.cos(t * o.sp + o.ph) * o.amp * o.sp;
    o.m.position.set(ox, o.y + 0.45, o.zc);
    const qx = clamp(B.p.x, ox - o.hx, ox + o.hx), qz = clamp(B.p.z, o.zc - o.hz, o.zc + o.hz), dx = B.p.x - qx, dz = B.p.z - qz, d = Math.hypot(dx, dz);
    if (d < BR && d > 1e-4) { const nx = dx / d, nz = dz / d; B.p.x += nx * (BR - d); B.p.z += nz * (BR - d); const vn = B.vx * nx + B.vz * nz; if (vn < 0) { B.vx -= 1.6 * vn * nx; B.vz -= 1.6 * vn * nz; } B.vx += ovx * 0.9 + nx * 2; bump(); }
    return;
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
      const w = o.type === 'sweep' ? Math.cos(ang) * 1.25 * o.sp : o.sp, tv = w * Math.sqrt(l2) * tt;   // tangential speed of the arm at the contact
      B.vx += nx * Math.abs(tv) * 0.9 + nx * 1.5; B.vz += nz * Math.abs(tv) * 0.9; bump();
    }
  }
}
let lastBump = 0;
function bump() { const n = performance.now(); if (n - lastBump < 200) return; lastBump = n; sfx.bounce(); buzz(15); B.squash = 0.8; burst(world, B.p, ['#ffffff', '#ffd21f'], 8, { speed: 0.08, up: 0.06, size: 0.5 }); }

// ---------------------------------------------------------------- loop
const tmp = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion();
loop((dt, t) => {
  if (!segs) return;
  const s = Math.min(dt, 2) / 60;
  if (state === 'play' || state === 'won') {
    const hold = state === 'won' ? false : (holding || botOn);
    const maxV = MAXV + B.boost;
    if (hold) B.vz = Math.max(B.vz - ACC * s, -maxV); else B.vz *= Math.exp(-0.35 * s);
    if (B.vz < -maxV) B.vz = lerp(B.vz, -maxV, 0.05);
    B.boost = Math.max(0, B.boost - 4 * s);
    // steering: finger slide -> lateral speed; bot steers toward its target line
    if (holding && state === 'play') { B.vx = lerp(B.vx, steerPx * 0.011 / s, 0.45); steerPx = 0; }
    else if (botOn && state === 'play') B.vx = lerp(B.vx, clamp((botX - B.p.x) * 5, -7, 7), 0.3);
    else B.vx *= Math.exp(-(B.ground ? 5 : 0.5) * s);
    B.p.x += B.vx * s; B.p.z += B.vz * s;
    const sf = surfAt(B.p.x, B.p.z);
    if (B.ground) {
      if (sf && Math.abs(B.p.y - BR - sf.y) < 0.55) {
        B.p.y = sf.y + BR; B.k = sf.k; B.vz += G * sf.k * s * 0.75;
        if (sf.s.rails) { const lim = sf.s.w / 2 - BR - 0.05; if (Math.abs(B.p.x - sf.c) > lim) { B.p.x = sf.c + Math.sign(B.p.x - sf.c) * lim; B.vx *= -0.4; } }
      } else { B.ground = false; B.vy = -B.vz * B.k; airT = 0; }
    } else {
      B.vy -= G * s; B.p.y += B.vy * s; airT += s;
      if (sf && B.vy <= 0 && B.p.y - BR <= sf.y && B.p.y - BR > sf.y - 0.6) {
        B.p.y = sf.y + BR; B.ground = true;
        if (airT > 0.2) { B.squash = Math.min(1, -B.vy / 8); sfx.bounce(); buzz(10); burst(world, tmp.copy(B.p).setY(sf.y + 0.05), ['#ffffff', '#e2b47a'], 10, { speed: 0.07, up: 0.04, size: 0.5 }); if (airT > 0.45 && state === 'play') ui.pop(['NICE JUMP!', 'WHOOSH!', 'AIR TIME!'][Math.floor(Math.random() * 3)], '#fff', 32, 30); }
        B.vy = 0;
      }
    }
    for (const o of obs) if (Math.abs(o.zc - B.p.z) < 14) collide(o, t); else if (o.type !== 'slide') o.m.rotation.y = -(t * o.sp + o.ph);
    for (const p of pads) if (B.ground && Math.abs(B.p.z - p.z) < 1.3 && Math.abs(B.p.x - cx(p.seg, p.z)) < 0.8 && B.boost < 4) { B.boost = 7; B.vz = -(MAXV + 6); tone(300, 0.35, 'sawtooth', 0.08, 2.4); buzz(12); ui.pop('BOOST!', '#7ff0ff', 36, 30); }
    if (state === 'play') {
      for (let i = 0; i < cps.length; i++) if (i > cpIdx && B.p.z < cps[i].z0 - 1.5 && B.ground) { cpIdx = i; cpZ = cps[i].z0 - 1.5; sfx.coin(); ui.pop('CHECKPOINT!', '#5ce1ff', 32, 30); burst(world, B.p, ['#5ce1ff', '#ffffff'], 14, { speed: 0.1, up: 0.08, size: 0.6 }); }
      if (B.p.z < finishZ && B.ground) win();
      if (B.p.y < (sf ? sf.y : camY) - 9) fell();
      ui.progress(Math.min(1, (6 - B.p.z) / totalLen));
    } else { finishT += s; }
  }
  // ball visuals: roll rotation, squash on landing
  const vel = Math.hypot(B.vx, B.vz);
  if (vel > 0.01) { axis.set(-B.vz, 0, B.vx).normalize(); dq.setFromAxisAngle(axis, -vel * Math.min(dt, 2) / 60 / BR); B.rot.premultiply(dq); }
  B.squash = Math.max(0, B.squash - 0.06 * dt);
  ball.position.copy(B.p); ball.position.y -= B.squash * 0.12; ball.quaternion.copy(B.rot);
  ball.scale.set(1 + B.squash * 0.25, 1 - B.squash * 0.3, 1 + B.squash * 0.25);
  if (vel > MAXV + 1 || B.boost > 2) { $('speed').classList.add('on'); if (Math.random() < 0.5) burst(world, tmp.copy(B.p).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.2, 0.4)), ['#ffffff', '#7ff0ff'], 1, { speed: 0.02, up: 0.01, size: 0.5, gravity: 0, life: 0.5 }); } else $('speed').classList.remove('on');
  // camera: low behind the ball, looking down the track; does not follow a fall
  const sfc = surfAt(B.p.x, B.p.z); if (B.ground || (sfc && B.p.y > sfc.y)) camY = lerp(camY, B.p.y, 0.12 * dt);
  else if (B.p.y > camY - 1) camY = lerp(camY, B.p.y, 0.05 * dt);
  const sp = Math.min(1, -B.vz / (MAXV + 6));
  const cxT = B.p.x * 0.85, czT = B.p.z + 4.6 + sp * 0.6;
  camera.position.set(lerp(camera.position.x, cxT, 0.15 * dt), lerp(camera.position.y, camY + 2.5, 0.15 * dt), state === 'won' ? lerp(camera.position.z, B.p.z + 3 + finishT * 2, 0.05 * dt) : czT);
  camera.lookAt(B.p.x * 0.9, camY + 0.2, B.p.z - 5);
  const fov = 62 + sp * 10; if (Math.abs(camera.fov - fov) > 0.2) { camera.fov = lerp(camera.fov, fov, 0.08); camera.updateProjectionMatrix(); }
  followLight(B.p);
});

buildLevel();
addEventListener('resize', () => { camera.fov = 62; camera.updateProjectionMatrix(); });

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.max(0, level - 1) * 100 + Math.round(Math.min(1, (6 - B.p.z) / totalLen) * 100); },
  bot() {
    if (state !== 'play' || holding) return;
    botOn = true;
    const look = B.p.z - 2.5, s = segAt(look) || segAt(B.p.z);
    if (!s) return;
    let tx = cx(s, look);
    for (const o of obs) {
      const dz = B.p.z - o.zc; if (dz < -1 || dz > 7) continue;
      const w = o.seg.w / 2 - BR - 0.1;
      if (o.type === 'slide') tx = o.cx + (o.m.position.x > o.cx ? -w : w);
      if (o.type === 'spin') tx = o.cx + (Math.sin(performance.now() / 1000 * o.sp) > 0 ? 1 : -1) * 0;
      if (o.type === 'sweep') tx = o.cx;
    }
    botX = tx;
  },
};

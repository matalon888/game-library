// Smash Dummy — original game. Grab the wooden dummy, fling it into swinging balls, spinning paddles,
// passing cars and stairs. Every bump scores damage; reach the goal before you run out of throws.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { createRagdoll, placeRagdoll, stepRagdoll, syncCollider } from './ragdoll.js';

const stage = createStage({ fov: 42, shadows: true, shadowSize: 9 });
const { scene, camera, sun, followLight } = stage;
const ui = createUI({ title: 'SMASH<br>DUMMY', hint: 'Drag & fling the dummy', hand: '👆' });
document.body.style.setProperty('--bg1', '#f3f8fe'); document.body.style.setProperty('--bg2', '#d5e6f6'); document.body.style.setProperty('--ui', '#ff8a1f');
const css = document.createElement('style');
css.textContent = `.hc-score{color:#ff8a1f;text-shadow:0 4px 0 rgba(120,60,0,.18)} .hc-sub{color:#5b7088;text-shadow:none;font-weight:800}
.hc-pill{background:rgba(70,100,140,.18);color:#4a5d75;top:calc(54px + env(safe-area-inset-top))}
.hc-card h1{color:#ff8a1f;text-shadow:0 6px 0 rgba(150,70,0,.2)} .hc-card p,.hc-card .hint{color:#4a5d75;text-shadow:none}
.hc-card.dim{background:rgba(40,60,90,.25)} .hc-card.dim p,.hc-card.dim .hint{color:#fff}
.hc-lvl.next{color:#ff8a1f}
.dmg{position:fixed;font-weight:800;pointer-events:none;z-index:6;transform:translate(-50%,-50%);animation:dmgup .9s ease-out forwards;color:#fff;
  -webkit-text-stroke:1.5px rgba(160,40,0,.55);text-shadow:0 3px 0 rgba(120,30,0,.35)}
@keyframes dmgup{0%{opacity:0;transform:translate(-50%,-30%) scale(.5)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.25)}100%{opacity:0;transform:translate(-50%,-190%) scale(1)}}`;
document.head.appendChild(css);
const save = store('smashdummy');
const F = flow('smashdummy');
let level = +new URLSearchParams(location.search).get('level') || save.get('level', 1), best = save.get('best', 0), state = 'ready';
let damage = 0, goal = 100, throws = 3, total = 0;

// ------------------------------------------------------------------ world
const FOG = new THREE.Color('#e3eef9');
scene.fog = new THREE.Fog(FOG, 22, 60);
stage.hemi.color.set('#ffffff'); stage.hemi.groundColor.set('#cfdcec'); stage.hemi.intensity = 1.3; sun.intensity = 1.45;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#eef4fb', { roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 wp; void main(){ wp = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.); }`,
  fragmentShader: `varying vec3 wp; void main(){ float h = clamp(normalize(wp - cameraPosition).y * 2.2, 0., 1.); vec3 c = mix(vec3(0.89,0.93,0.98), vec3(0.98,0.99,1.0), h); gl_FragColor = vec4(c, 1.);
#include <colorspace_fragment>
}` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), skyMat); scene.add(sky);

// ------------------------------------------------------------------ the dummy (wooden mannequin look)
const rd = createRagdoll();
const WOOD = glossy('#f5a742', { roughness: 0.45 }), JOINT = glossy('#c8742a', { roughness: 0.4 });
const dummy = new THREE.Group(); scene.add(dummy);
const seg = (r, len, m = WOOD) => { const g = new THREE.CapsuleGeometry(r, len, 6, 12); const k = new THREE.Mesh(g, m); k.castShadow = true; dummy.add(k); return k; };
const LIMBS = [ // [a, b, radius]
  ['shL', 'elL', 0.065], ['elL', 'haL', 0.055], ['shR', 'elR', 0.065], ['elR', 'haR', 0.055],
  ['hipL', 'knL', 0.085], ['knL', 'ftL', 0.07], ['hipR', 'knR', 0.085], ['knR', 'ftR', 0.07], ['neck', 'chest', 0.05],
].map(([a, b, r]) => { const A = rd.IDX[a], B = rd.IDX[b], len = rd.P[A].rest.distanceTo(rd.P[B].rest); return { A, B, m: seg(r, Math.max(0.01, len - r * 1.2)) }; });
const torso = new THREE.Mesh(rounded(0.42, 0.34, 0.26, 0.12), WOOD); torso.castShadow = true; dummy.add(torso);
const hipsM = new THREE.Mesh(rounded(0.36, 0.2, 0.24, 0.09), WOOD); hipsM.castShadow = true; dummy.add(hipsM);
const waist = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), JOINT); dummy.add(waist);
const head = new THREE.Group(); dummy.add(head);
{ const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 22, 16), WOOD); h.scale.set(0.95, 1.12, 1); h.castShadow = true; head.add(h);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), mat('#ffffff', { roughness: 0.2 })); w.position.set(s * 0.06, 0.03, 0.135); head.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), mat('#1d1d24')); p.position.set(s * 0.06, 0.03, 0.172); head.add(p); head['pupil' + s] = p; } }
const jointBalls = ['elL', 'elR', 'knL', 'knR', 'shL', 'shR', 'hipL', 'hipR'].map(n => { const k = new THREE.Mesh(new THREE.SphereGeometry(n.startsWith('sh') || n.startsWith('hip') ? 0.085 : 0.07, 12, 10), JOINT); k.castShadow = true; dummy.add(k); return { i: rd.IDX[n], k }; });
const handsFeet = ['haL', 'haR', 'ftL', 'ftR'].map(n => { const f = n.startsWith('ft'); const k = new THREE.Mesh(f ? rounded(0.12, 0.08, 0.24, 0.04) : new THREE.SphereGeometry(0.06, 12, 10), WOOD); k.castShadow = true; dummy.add(k); return { i: rd.IDX[n], k, f }; });
const _u = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3(), _r = new THREE.Vector3(), _f = new THREE.Vector3(), _m4 = new THREE.Matrix4();
function orient(o, up, right, pos) { // build a basis from an up vector and a rough right vector
  _f.crossVectors(right, up).normalize(); _r.crossVectors(up, _f).normalize(); _m4.makeBasis(_r, up, _f); o.quaternion.setFromRotationMatrix(_m4); o.position.copy(pos);
}
function drawDummy() {
  const P = rd.P, I = rd.IDX;
  for (const l of LIMBS) { const a = P[l.A].p, b = P[l.B].p; _t.subVectors(b, a); l.m.position.addVectors(a, b).multiplyScalar(0.5); l.m.quaternion.setFromUnitVectors(_u, _t.normalize()); }
  const right = _r.subVectors(P[I.shR].p, P[I.shL].p).clone();
  const up = _t.subVectors(P[I.neck].p, P[I.pelvis].p).normalize().clone();
  orient(torso, up, right, P[I.chest].p.clone().lerp(P[I.pelvis].p, 0.1));
  orient(hipsM, up, _r.subVectors(P[I.hipR].p, P[I.hipL].p).clone(), P[I.pelvis].p.clone().lerp(P[I.hipL].p, 0.5).lerp(P[I.hipR].p, 0.5).setY((P[I.hipL].p.y + P[I.hipR].p.y) / 2 + 0.0));
  waist.position.copy(P[I.pelvis].p).lerp(P[I.chest].p, 0.45);
  orient(head, _t.subVectors(P[I.head].p, P[I.neck].p).normalize().clone(), right, P[I.head].p);
  for (const j of jointBalls) j.k.position.copy(P[j.i].p);
  for (const h of handsFeet) { h.k.position.copy(P[h.i].p); if (h.f) { const k = h.i === I.ftL ? I.knL : I.knR; orient(h.k, _t.subVectors(P[k].p, P[h.i].p).normalize().clone(), right, P[h.i].p); h.k.translateZ(0.05); } }
}

// ------------------------------------------------------------------ setpieces (kinematic colliders)
let things = [], colliders = [], startAt = new THREE.Vector3(), aimAt = new THREE.Vector3(), camCenter = new THREE.Vector3();
function addCol(obj, type, o = {}) { const c = { obj, type, ...o }; syncCollider(c); colliders.push(c); return c; }
function box(w, h, d, color, x, y, z, r = 0.08) { const m = new THREE.Mesh(rounded(w, h, d, r), mat(color, { roughness: 0.6 })); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); things.push({ m }); return m; }
const T = {
  ball(x0) {   // swinging bowling ball on a chain
    const piv = new THREE.Group(); piv.position.set(x0 + 1.6, 8.6, 0); scene.add(piv);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6, 8), mat('#8a94a6', { metalness: 0.6, roughness: 0.3 })); chain.position.y = -3; piv.add(chain);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 24), glossy('#d23cf0', { roughness: 0.15 })); ball.position.y = -6.6; ball.castShadow = true; piv.add(ball);
    for (const [a, b] of [[0.25, 0.2], [0.42, 0.05], [0.18, -0.05]]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), mat('#3a1046')); h.position.set(a - 0.3, b + 0.25, 0.83); h.lookAt(h.position.clone().multiplyScalar(2)); ball.add(h); }
    const top = box(1.2, 0.3, 0.8, '#b8c3d3', x0 + 1.6, 8.75, 0);
    const col = addCol(ball, 'sphere', { r: 0.85, e: 0.5, mult: 1.3 });
    let ph = Math.random() * 6;
    things.push({ m: piv, update(t, dt) { ph += dt; piv.rotation.z = Math.sin(ph * 1.25) * 1.05; }, col });
    return { start: x0 - 1.4, span: 4, aim: [x0 + 1.6, 2.2] };
  },
  stairs(x0) {   // tall tower with a staircase down the right side; the dummy starts on top
    const top = 5.2; box(2.2, top, 2.4, '#c9d3e1', x0 - 0.6, top / 2, 0, 0.05); addCol(things[things.length - 1].m, 'box', { half: new THREE.Vector3(1.1, top / 2, 1.2), e: 0.15, mult: 1 });
    const n = 8;
    for (let i = 0; i < n; i++) { const h = top - (i + 1) * (top / (n + 1)); const m = box(0.62, 0.36, 2.0, '#dfe6ef', x0 + 0.85 + i * 0.62, h, 0, 0.04); addCol(m, 'box', { half: new THREE.Vector3(0.31, 0.18, 1.0), e: 0.3, mult: 1.6 }); }
    return { start: x0 - 0.9, startY: top, span: 6.5, aim: [x0 + 0.9, top + 0.4] };
  },
  car(x0) {      // a car drives along a road toward the camera, over and over
    const road = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 120), mat('#8b79c9', { roughness: 0.8 })); road.rotation.x = -Math.PI / 2; road.position.set(x0 + 1.8, 0.01, -30); road.receiveShadow = true; scene.add(road); things.push({ m: road });
    for (const s of [-1, 1]) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 120), mat('#ffffff')); ln.rotation.x = -Math.PI / 2; ln.position.set(x0 + 1.8 + s * 1.35, 0.02, -30); scene.add(ln); things.push({ m: ln }); }
    const car = new THREE.Group(); scene.add(car);
    const body = new THREE.Mesh(rounded(2.3, 0.62, 3.8, 0.2), glossy('#f04b5d', { roughness: 0.25 })); body.position.y = 0.62; body.castShadow = true; car.add(body);
    const cab = new THREE.Mesh(rounded(1.9, 0.6, 1.9, 0.22), glossy('#f04b5d', { roughness: 0.25 })); cab.position.set(0, 1.18, -0.2); cab.castShadow = true; car.add(cab);
    const glass = new THREE.Mesh(rounded(1.94, 0.42, 1.6, 0.15), glossy('#3a4766', { roughness: 0.1 })); glass.position.set(0, 1.2, -0.2); car.add(glass);
    for (const [x, z] of [[-1.1, 1.2], [1.1, 1.2], [-1.1, -1.2], [1.1, -1.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18), mat('#2a2a33')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); car.add(w); }
    for (const x of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat('#fff6c8', { emissive: '#fff2a0', emissiveIntensity: 0.6 })); l.position.set(x, 0.66, 1.9); car.add(l); }
    const hit = new THREE.Group(); hit.position.set(0, 0.85, 0); car.add(hit);
    const col = addCol(hit, 'box', { half: new THREE.Vector3(1.15, 0.75, 1.9), e: 0.4, mult: 1.6, fr: 0.95 });
    let ph = 0.6 + Math.random();
    things.push({ m: car, update(t, dt) { ph += dt / 2.8; const k = ph % 1; car.position.set(x0 + 1.8, 0, -34 + k * 52); }, col });
    return { start: x0 - 0.6, span: 4, aim: [x0 + 1.9, 1.2] };
  },
  paddles(x0) {  // spinning paddles on posts
    for (const [dx, sp] of [[1.4, 3.6], [4.1, -4.4]]) {
      box(0.35, 1.8, 0.35, '#b8c3d3', x0 + dx, 0.9, -0.5);
      const hub = new THREE.Group(); hub.position.set(x0 + dx, 1.85, 0); scene.add(hub);
      const bar = new THREE.Mesh(rounded(3.0, 0.32, 0.5, 0.12), glossy('#26c6a8')); bar.castShadow = true; hub.add(bar);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), glossy('#ffd23f')); cap.rotation.x = Math.PI / 2; hub.add(cap);
      const col = addCol(hub, 'box', { half: new THREE.Vector3(1.5, 0.16, 0.25), e: 0.6, mult: 1.3 });
      let ang = Math.random() * 3;
      things.push({ m: hub, update(t, dt) { ang += sp * dt; hub.rotation.z = ang; }, col });
    }
    return { start: x0 - 1.2, span: 6, aim: [x0 + 1.4, 2.2] };
  },
  bumpers(x0) {  // pinball bumpers: big bouncy pops
    const pts = [[1.2, 0.7], [2.9, 2.2], [4.4, 0.9], [2.4, 4.0]];
    for (const [dx, y] of pts) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), glossy('#ff5d8f', { roughness: 0.2 })); b.position.set(x0 + dx, y + 0.0, 0); b.castShadow = true; scene.add(b);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 10, 30), glossy('#ffd23f')); ring.position.copy(b.position); scene.add(ring);
      const col = addCol(b, 'sphere', { r: 0.62, e: 1.6, mult: 1.1, bumper: true });
      things.push({ m: b, ring, col, update(t, dt) { const s = b.userData.pop || 0; b.userData.pop = Math.max(0, s - dt * 5); const k = 1 + b.userData.pop * 0.25; b.scale.setScalar(k); } });
      things.push({ m: ring });
    }
    return { start: x0 - 1.0, span: 5.5, aim: [x0 + 2.9, 2.5] };
  },
  crate(x0) {    // a heavy crate drops when the dummy passes under it
    box(0.3, 7.8, 0.3, '#b8c3d3', x0 + 3.6, 3.9, -0.6); box(2.2, 0.3, 0.3, '#b8c3d3', x0 + 2.6, 7.7, -0.6);
    const cr = new THREE.Group(); scene.add(cr);
    const m = new THREE.Mesh(rounded(1.7, 1.7, 1.7, 0.08), mat('#c98a4a', { roughness: 0.8 })); m.castShadow = true; cr.add(m);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.2, 1.72), mat('#a86c33')); p.position.y = s * 0.55; cr.add(p); }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), mat('#6d5a44')); scene.add(rope); things.push({ m: rope });
    const col = addCol(cr, 'box', { half: new THREE.Vector3(0.85, 0.85, 0.85), e: 0.1, mult: 1.8 });
    const st = { y: 6.0, vy: 0, falling: false, landed: false, x: x0 + 1.7 };
    const trig = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), mat('#ff5d5d')); trig.rotation.x = -Math.PI / 2; trig.position.set(st.x, 0.03, 0); scene.add(trig); things.push({ m: trig });
    things.push({ m: cr, col, update(t, dt) {
      if (!st.falling && !st.landed && dummyLive && rd.P.some(j => Math.abs(j.p.x - st.x) < 1.2 && j.p.y < 3.5)) { st.falling = true; tone(900, 0.12, 'square', 0.06, 0.5); }
      if (st.falling) { st.vy -= 22 * dt; st.y += st.vy * dt; if (st.y < 0.85) { st.y = 0.85; st.falling = false; st.landed = true; shake = 0.5; sfx.smash(); burst(scene, new THREE.Vector3(st.x, 0.2, 0), '#d9c2a0', 20, { speed: 0.15, up: 0.05 }); } }
      cr.position.set(st.x, st.y, 0); rope.visible = !st.landed && !st.falling; rope.scale.y = 7.7 - st.y - 0.85; rope.position.set(st.x, st.y + 0.85 + rope.scale.y / 2, 0);
    } });
    return { start: x0 - 0.6, span: 4.5, aim: [x0 + 1.7, 1.0] };
  },
};
const ORDER = ['ball', 'stairs', 'car', 'paddles', 'bumpers', 'crate'];

function clearWorld() {
  for (const t of things) { scene.remove(t.m); t.ring && scene.remove(t.ring); }
  things = []; colliders = [];
}
function buildLevel() {
  clearWorld();
  const r = rng(level * 4241 + 99);
  const kinds = level <= ORDER.length ? [ORDER[level - 1]] : [ORDER[Math.floor(r() * ORDER.length)]];
  if (level > 3) { let k2; do k2 = ORDER[Math.floor(r() * ORDER.length)]; while (k2 === kinds[0] || k2 === 'stairs'); kinds.push(k2); }
  let x = 0, first = null;
  for (const k of kinds) { const info = T[k](x); if (!first) first = info; x += info.span + 1.5; }
  startAt.set(first.start, first.startY || 0, 0); aimAt.set(first.aim[0], first.aim[1], 0);
  camCenter.set((x - 1.5) / 2 - 0.6, 0, 0);
  goal = Math.round((level === 1 ? 100 : (110 + level * 30) * (kinds.length > 1 ? 1.15 : 1)) * F.k() / 10) * 10;
  throws = 3; damage = 0; dummyLive = false; settleT = 0; grab = null; total = 0;
  placeRagdoll(rd, startAt); drawDummy();
  for (const t of things) t.update && t.update(0, 0);
  for (const c of colliders) { syncCollider(c); syncCollider(c); }
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub('GOAL ' + goal); ui.pill('✋'.repeat(throws));
}

// ------------------------------------------------------------------ damage + juice
let shake = 0, hitStop = 0, slowT = 0, lastHitSfx = 0, dummyLive = false, settleT = 0, grab = null, popCD = 0, flashT = 0;
const WORDS = ['BONK!', 'WHAM!', 'POW!', 'OOF!', 'BOING!', 'THUD!'];
const _s = new THREE.Vector3();
function floater(text, pos, size = 24, color = '#fff') {
  _s.copy(pos).project(camera); if (_s.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmg'; d.textContent = text; d.style.left = (_s.x + 1) / 2 * innerWidth + 'px'; d.style.top = (1 - _s.y) / 2 * innerHeight + 'px'; d.style.fontSize = size + 'px'; d.style.color = color;
  document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
let frameHits = [], pend = null;
function flushFloat(force) { if (!pend || !force && performance.now() - pend.t < 220) return; floater('+' + pend.sum, pend.at, clamp(20 + pend.sum * 0.5, 20, 52), pend.sum > 40 ? '#ffd23f' : '#ffffff'); pend = null; }
function onImpact(j, speed, c, at) {
  if (state !== 'play' || !dummyLive) return;
  const mult = c ? c.mult || 1 : 1;
  const now = performance.now(); if (now - (j.hitT || 0) < 220) return;
  const dmg = Math.round((speed - 4) * 0.8 * mult * (j.n === 'head' ? 1.5 : 1));
  if (dmg <= 0) return; j.hitT = now;
  if (c && c.bumper) c.obj.userData.pop = 1;
  frameHits.push({ dmg, at: at.clone(), speed });
}
function flushHits() {
  if (!frameHits.length) return;
  const sum = frameHits.reduce((a, h) => a + h.dmg, 0), top = frameHits.reduce((a, h) => h.speed > a.speed ? h : a);
  frameHits = [];
  damage += sum; total += sum; ui.score(damage); ui.progress(damage / goal);
  if (!pend) pend = { sum: 0, at: top.at, t: performance.now() };
  pend.sum += sum; if (top.speed > (pend.sp || 0)) { pend.at = top.at; pend.sp = top.speed; }
  const now = performance.now();
  if (now - lastHitSfx > 60) { lastHitSfx = now; tone(clamp(300 - sum * 2, 90, 300), 0.09, 'square', 0.06 + Math.min(0.08, sum / 400), 0.5); tone(140, 0.12, 'sine', 0.12, 0.6); }
  if (sum > 12) { burst(scene, top.at, ['#ffd23f', '#ffffff', '#ff8a1f'], Math.min(16, 4 + sum / 4), { speed: 0.08 + sum / 900, up: 0.05, size: 0.45, shape: 'sphere', life: 0.7 }); }
  if (sum > 25) { shake = Math.max(shake, Math.min(0.6, sum / 100)); buzz(Math.min(40, sum / 2)); flashT = 1; }
  if (sum > 45 && popCD <= 0) { ui.pop(WORDS[Math.floor(Math.random() * WORDS.length)], '#ff8a1f', 40 + Math.min(20, sum / 6), 26); hitStop = 0.09; popCD = 0.5; }
  if (damage >= goal && slowT <= 0 && state === 'play') { slowT = 1.6; ui.flash(0.5); ui.pop('SMASHED!', '#ffd23f', 54, 30); sfx.smash(); }
}

// ------------------------------------------------------------------ input: grab the nearest body part, drag, release to fling
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3();
function pointerWorld(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hitP) ? hitP.clone() : null; }
const dragVel = new THREE.Vector3(); let lastDrag = null, lastDragT = 0;
input({
  onDown(e) {
    if (state !== 'play' || throws <= 0 || slowT > 0) return;
    if (dummyLive && settleT < 0.25 && maxSpeed() > 2.5) return;   // still flying: wait
    let bi = rd.IDX.chest, bd = 1e9;
    for (let i = 0; i < rd.P.length; i++) { _s.copy(rd.P[i].p).project(camera); const sx = (_s.x + 1) / 2 * innerWidth, sy = (1 - _s.y) / 2 * innerHeight; const d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < bd) { bd = d; bi = i; } }
    plane.constant = -rd.P[bi].p.z;
    const w = pointerWorld(e.clientX, e.clientY); if (!w) return;
    grab = { i: bi, target: rd.P[bi].p.clone(), off: rd.P[bi].p.clone().sub(w), moved: 0 };
    dummyLive = true; settleT = 0; lastDrag = w.clone(); lastDragT = performance.now(); dragVel.set(0, 0, 0);
    tone(420, 0.06, 'sine', 0.1, 1.4);
  },
  onMove(dx, dy, e) {
    if (!grab) return;
    const w = pointerWorld(e.clientX, e.clientY); if (!w) return;
    grab.target.copy(w).add(grab.off); grab.target.y = Math.max(0.25, grab.target.y); grab.moved += Math.hypot(dx, dy);
    const now = performance.now(), dtm = Math.max(8, now - lastDragT) / 1000;
    dragVel.lerp(w.clone().sub(lastDrag).divideScalar(dtm), 0.5); lastDrag.copy(w); lastDragT = now;
  },
  onUp() {
    if (!grab) return;
    const g = grab; grab = null;
    if (g.moved < 25) return;
    // fling: give the whole body the drag velocity (clamped), a little extra up
    const v = dragVel.clone(); if (v.length() > 24) v.setLength(24); v.y += 1.5;
    if (performance.now() - lastDragT > 120) v.multiplyScalar(0.2);
    for (const j of rd.P) { j.o.copy(j.p).addScaledVector(v, -1 / 120); }
    throws--; ui.pill(throws ? '✋'.repeat(throws) : '—'); settleT = 0;
    tone(300, 0.2, 'sawtooth', 0.05, 2.2); buzz(10);
  },
});
function maxSpeed() { let m = 0; for (const j of rd.P) m = Math.max(m, j.p.distanceTo(j.o) * 120); return m; }

ui.onTap(w => {
  if (w === 'start') { state = 'play'; buildLevel(); }
  else if (w === 'win') { level++; save.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});
function win() {
  if (state === 'play') F.level(true);
  state = 'won'; sfx.win(); buzz([20, 40, 20]);
  confetti(scene, rd.P[rd.IDX.chest].p.clone().add(new THREE.Vector3(0, 1.5, 0)), 80);
  if (damage > best) { best = damage; save.set('best', best); }
  ui.win(level, `${damage} damage`);
}
function lose() {
  if (state === 'play') F.level(false, Math.min(1, damage / goal));
  state = 'lost'; sfx.fail(); buzz([40, 30, 60]);
  ui.lose('NOT BROKEN!', `${damage} / ${goal} damage`);
}

// ------------------------------------------------------------------ main loop
const camPos = new THREE.Vector3(0, 4, 12), camAt = new THREE.Vector3();
let t = 0, idleT = 0;
loop((dt60) => {
  const rdt = Math.min(dt60 / 60, 1 / 30);
  let ts = 1; if (slowT > 0) { slowT -= rdt; ts = 0.25; if (slowT <= 0 && state === 'play') win(); } if (hitStop > 0) { hitStop -= rdt; ts = 0.1; }
  const dt = rdt * ts; t += dt; popCD -= rdt;
  for (const th of things) th.update && th.update(t, dt);
  for (const c of colliders) syncCollider(c);
  if (dummyLive) {
    const SUB = 2, sdt = 1 / 120;
    // keep simulation step fixed; scale how many steps by time-scale
    stepAcc += dt;
    let n = 0; while (stepAcc >= sdt && n < 6) { stepRagdoll(rd, colliders, sdt, Math.max(dt, 1e-3), { onImpact, grab }); stepAcc -= sdt; n++; }
    flushHits(); flushFloat();
    if (!grab) { if (maxSpeed() < 1.2) settleT += rdt; else settleT = 0; }
    if (rd.P[rd.IDX.pelvis].p.y < -6 || Math.abs(rd.P[0].p.x - camCenter.x) > 30) { placeRagdoll(rd, startAt); dummyLive = false; }
    if (state === 'play' && throws <= 0 && !grab && settleT > 3.2 && damage < goal && slowT <= 0) lose();
  } else {
    // idle: stand and sway, look at the hazards
    idleT += rdt; placeRagdoll(rd, startAt);
    for (const j of rd.P) { const k = j.p.y - startAt.y; j.p.x += Math.sin(idleT * 1.6) * 0.012 * k; j.o.copy(j.p); }
    const I = rd.IDX; rd.P[I.haL].p.x -= 0.03 + Math.sin(idleT * 3) * 0.02; rd.P[I.haR].p.x += 0.03 + Math.sin(idleT * 3) * 0.02;
  }
  drawDummy();
  head.pupil1.position.x = 0.06 + Math.sin(t * 0.7) * 0.012; head['pupil-1'].position.x = -0.06 + Math.sin(t * 0.7) * 0.012;
  // camera: frame the setpiece, drift toward the dummy
  const pel = rd.P[rd.IDX.pelvis].p, asp = camera.aspect;
  const focusX = lerp(camCenter.x, pel.x, Math.abs(pel.x - camCenter.x) > 4 ? 0.85 : 0.55), focusY = clamp(pel.y * 0.8 + 0.9, 1.8, 8);
  const dist = asp < 0.7 ? 12.5 : 10;
  camPos.lerp(_s.set(focusX + 1.2, focusY + 2.2, dist), 1 - Math.pow(0.08, rdt)); camAt.lerp(_r.set(focusX, focusY, 0), 1 - Math.pow(0.08, rdt));
  shake = Math.max(0, shake - rdt * 2);
  camera.position.copy(camPos).add(_t.set((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0)); camera.lookAt(camAt);
  followLight(camAt);
});
let stepAcc = 0;
buildLevel();

// ------------------------------------------------------------------ test hooks
let botStep = 0, botTo = null;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return damage; },
  bot() {
    if (state !== 'play' || slowT > 0) return;
    const fire = (type, p) => dispatchEvent(new PointerEvent(type, { clientX: p[0], clientY: p[1] }));
    const scr = (v) => { _s.copy(v).project(camera); return [(_s.x + 1) / 2 * innerWidth, (1 - _s.y) / 2 * innerHeight]; };
    if (botStep === 0) {
      if (throws <= 0 || dummyLive && settleT < 0.4) return;
      const c = rd.P[rd.IDX.chest].p.clone();
      const ball = colliders.find(cl => cl.type === 'sphere' && !cl.bumper);
      if (ball) { const bp = ball.obj.getWorldPosition(new THREE.Vector3()); const d = Math.abs(bp.x - c.x); if (d < 4.2) { const prev = window.__bd || 0; window.__bd = d; if (d < prev || d > 3.2) return; } }
      const at = (throws === 3 || Math.random() < 0.6) ? aimAt.clone() : c.clone().add(new THREE.Vector3(Math.random() < 0.5 ? 3 : -3, 3, 0));
      const dir = at.clone().sub(c); dir.z = 0; dir.y += 1.5; dir.normalize();
      botTo = [scr(c), scr(c.clone().addScaledVector(dir, 1.2)), scr(c.clone().addScaledVector(dir, 2.6))];
      fire('pointerdown', botTo[0]); botStep = 1; return;
    }
    if (botStep === 1) { fire('pointermove', botTo[1]); botStep = 2; return; }
    if (botStep === 2) { fire('pointermove', botTo[2]); fire('pointerup', botTo[2]); botStep = 0; }
  },
};

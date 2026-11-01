// Smash Dummy — original game. Grab the wooden dummy, fling it into swinging balls, spinning paddles,
// passing cars and stairs. Every bump scores damage; reach the goal before you run out of throws.
import { THREE, createStage, createUI, input, loop, sfx, tone, buzz, store, rng, lerp, clamp, mat, glossy, rounded, burst, confetti, note } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { createRagdoll, placeRagdoll, stepRagdoll, syncCollider } from './ragdoll.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { ab } from './kit/xp.js';
import { WORLDS, LEVELS } from './levels.js';
import { createMeta, SKINS } from './deep.js';
const READY = true;
const QS = new URLSearchParams(location.search);
const DEEP = QS.get('deep') === '0' ? false : (QS.get('deep') === '1' || (READY && ab('deep-smash-dummy')));
const WB = board({ game: 'smash-dummy', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.5 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const stage = createStage({ fov: 42, shadows: true, shadowSize: 9 });
const { scene, camera, sun, followLight } = stage;
const ui = createUI({ title: 'SMASH<br>DUMMY', hint: 'Tap where to fling him · or drag', hand: '👆' });
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
let level = +QS.get('level') || save.get('level', 1), best = save.get('best', 0), state = 'ready';
let damage = 0, goal = 100, throws = 3, total = 0;

// ------------------------------------------------------------------ world
const FOG = new THREE.Color('#e3eef9');
scene.fog = new THREE.Fog(FOG, 22, 60);
stage.hemi.color.set('#ffffff'); stage.hemi.groundColor.set('#cfdcec'); stage.hemi.intensity = 1.3; sun.intensity = 1.45;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#eef4fb', { roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { cLo: { value: new THREE.Color(0.89, 0.93, 0.98) }, cHi: { value: new THREE.Color(0.98, 0.99, 1.0) } },
  vertexShader: `varying vec3 wp; void main(){ wp = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.); }`,
  fragmentShader: `uniform vec3 cLo; uniform vec3 cHi; varying vec3 wp; void main(){ float h = clamp(normalize(wp - cameraPosition).y * 2.2, 0., 1.); vec3 c = mix(cLo, cHi, h); gl_FragColor = vec4(c, 1.);
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

// ------------------------------------------------------------------ v2: hats, skins, meta
const wstyle = document.createElement('style'); wstyle.id = 'sd-w'; document.head.appendChild(wstyle);
const HATS = {};
{ const add = (k, o) => { o.visible = false; head.add(o); HATS[k] = o; };
  const cap = new THREE.Group(); { const d = new THREE.Mesh(new THREE.SphereGeometry(0.175, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#e83a3a')); d.position.y = 0.04; cap.add(d); const v = new THREE.Mesh(rounded(0.26, 0.025, 0.14, 0.01), glossy('#e83a3a')); v.position.set(0, 0.06, 0.2); cap.add(v); } add('cap', cap);
  const top = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.24, 18), glossy('#23232e')); b.position.y = 0.3; top.add(b); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 20), glossy('#23232e')); r.position.y = 0.18; top.add(r); const sr = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.04, 18), glossy('#e83a3a')); sr.position.y = 0.22; top.add(sr); } add('tophat', top);
  const crown = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.1, 18), glossy('#ffd23f', { metalness: 0.5 })); b.position.y = 0.23; crown.add(b); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), glossy('#ffd23f', { metalness: 0.5 })); c.position.set(Math.sin(a) * 0.14, 0.34, Math.cos(a) * 0.14); crown.add(c); const g = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mat('#e83a8a')); g.position.set(Math.sin(a) * 0.14, 0.4, Math.cos(a) * 0.14); crown.add(g); } } add('crown', crown);
  const ant = new THREE.Group(); { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), mat('#5c6f85')); p.position.y = 0.28; ant.add(p); const bl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat('#ff3d3d', { emissive: '#ff0000', emissiveIntensity: 0.5 })); bl.position.y = 0.4; ant.add(bl); } add('antenna', ant);
  const band = new THREE.Group(); { const t = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.022, 8, 24), mat('#ff3d8a')); t.rotation.x = Math.PI / 2; t.position.y = 0.07; band.add(t); for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 6), mat('#ff3d8a')); w.rotation.z = sx * Math.PI / 2; w.position.set(sx * 0.19, 0.07, 0); band.add(w); } } add('band', band);
}
function applySkin(k) { WOOD.color.set(k.body); JOINT.color.set(k.joint); for (const h in HATS) HATS[h].visible = h === k.hat; }
const meta = DEEP ? createMeta({ LEVELS, WORLDS, save, onSkin: applySkin, onPlay: n => { level = n; save.set('level2', n); state = 'play'; ui.hideStart(); meta.hideCard(); buildLevel(); } }) : null;
if (meta) { applySkin(meta.skin()); if (!QS.get('level')) level = Math.min(LEVELS.length, meta.reached()); }

// ------------------------------------------------------------------ setpieces (kinematic colliders)
let R = Math.random, zones = [], things = [], colliders = [], startAt = new THREE.Vector3(), aimAt = new THREE.Vector3(), camCenter = new THREE.Vector3();
function addCol(obj, type, o = {}) { const c = { obj, type, ...o }; syncCollider(c); colliders.push(c); return c; }
function box(w, h, d, color, x, y, z, r = 0.08) { const m = new THREE.Mesh(rounded(w, h, d, r), mat(color, { roughness: 0.6 })); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); things.push({ m }); return m; }
const T = {
  ball(x0, o = {}) {   // swinging bowling ball on a chain (opts: n balls, spd, amp)
    const nb = o.n || 1, spd = o.spd || 1.25, amp = o.amp || 1.05;
    for (let bi = 0; bi < nb; bi++) {
    const bx = x0 + bi * 3.4;
    const piv = new THREE.Group(); piv.position.set(bx + 1.6, 8.6, 0); scene.add(piv);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6, 8), mat('#8a94a6', { metalness: 0.6, roughness: 0.3 })); chain.position.y = -3; piv.add(chain);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 24), glossy('#d23cf0', { roughness: 0.15 })); ball.position.y = -6.6; ball.castShadow = true; piv.add(ball);
    for (const [a, b] of [[0.25, 0.2], [0.42, 0.05], [0.18, -0.05]]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), mat('#3a1046')); h.position.set(a - 0.3, b + 0.25, 0.83); h.lookAt(h.position.clone().multiplyScalar(2)); ball.add(h); }
    const top = box(1.2, 0.3, 0.8, '#b8c3d3', bx + 1.6, 8.75, 0);
    const col = addCol(ball, 'sphere', { r: 0.85, e: 0.5, mult: 1.3 });
    let ph = R() * 6 + bi * 2.4;
    things.push({ m: piv, update(t, dt) { ph += dt; piv.rotation.z = Math.sin(ph * spd) * amp; }, col });
    }
    return { start: x0 - 1.4, span: 4 + (nb - 1) * 3.4, aim: [x0 + 1.6, 2.2] };
  },
  stairs(x0) {   // tall tower with a staircase down the right side; the dummy starts on top
    const top = 5.2; box(2.2, top, 2.4, '#c9d3e1', x0 - 0.6, top / 2, 0, 0.05); addCol(things[things.length - 1].m, 'box', { half: new THREE.Vector3(1.1, top / 2, 1.2), e: 0.15, mult: 1 });
    const n = 8;
    for (let i = 0; i < n; i++) { const h = top - (i + 1) * (top / (n + 1)); const m = box(0.62, 0.36, 2.0, '#dfe6ef', x0 + 0.85 + i * 0.62, h, 0, 0.04); addCol(m, 'box', { half: new THREE.Vector3(0.31, 0.18, 1.0), e: 0.3, mult: 1.6 }); }
    return { start: x0 - 0.9, startY: top, span: 6.5, aim: [x0 + 0.9, top + 0.4] };
  },
  car(x0, o = {}) {      // a car drives along a road toward the camera, over and over
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
    let ph = 0.6 + R();
    things.push({ m: car, update(t, dt) { ph += dt / (o.period || 2.8); const k = ph % 1; car.position.set(x0 + 1.8, 0, -34 + k * 52); }, col });
    return { start: x0 - 0.6, span: 4, aim: [x0 + 1.9, 1.2] };
  },
  paddles(x0, o = {}) {  // spinning paddles on posts
    for (const [dx, sp] of [[1.4, 3.6], [4.1, -4.4], [6.8, 5.0]].slice(0, o.n || 2)) {
      box(0.35, 1.8, 0.35, '#b8c3d3', x0 + dx, 0.9, -0.5);
      const hub = new THREE.Group(); hub.position.set(x0 + dx, 1.85, 0); scene.add(hub);
      const bar = new THREE.Mesh(rounded(3.0, 0.32, 0.5, 0.12), glossy('#26c6a8')); bar.castShadow = true; hub.add(bar);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), glossy('#ffd23f')); cap.rotation.x = Math.PI / 2; hub.add(cap);
      const col = addCol(hub, 'box', { half: new THREE.Vector3(1.5, 0.16, 0.25), e: 0.6, mult: 1.3 });
      let ang = R() * 3;
      things.push({ m: hub, update(t, dt) { ang += sp * dt; hub.rotation.z = ang; }, col });
    }
    return { start: x0 - 1.2, span: 3.7 + 2.7 * (o.n || 2), aim: [x0 + 1.4, 2.2] };
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
  tnt(x0, o = {}) {   // red barrels: touch one hard and it blows (and sets off its neighbours)
    const n = o.n || 1, barrels = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group(); const bx = x0 + 1.5 + i * 1.7; g.position.set(bx, 0.5, 0); scene.add(g);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.0, 20), glossy('#e83a3a', { roughness: 0.35 })); b.castShadow = true; g.add(b);
      for (const y of [-0.25, 0.25]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.465, 0.04, 6, 24), mat('#ffd23f')); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
      const lbl = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), mat('#ffffff')); lbl.position.set(0, 0, 0.47); g.add(lbl);
      const col = addCol(g, 'box', { half: new THREE.Vector3(0.46, 0.5, 0.46), e: 0.3, mult: 0.8, kind: 'tnt' }); barrels.push(col);
      things.push({ m: g, col, update(t, dt) { if (col.off) { g.visible = false; } } });
    }
    return { start: x0 - 0.8, span: 2.6 + 1.7 * (n - 1), aim: [x0 + 1.5, 1.2] };
  },
  glass(x0, o = {}) {   // thin panes: fast hits shatter them for bonus damage
    const n = o.n || 1;
    for (let i = 0; i < n; i++) {
      const gx = x0 + 1.6 + i * 1.8;
      const m = new THREE.Group(); m.position.set(gx, 1.7, 0); m.rotation.y = 0.95; scene.add(m);   // turned so the camera sees the broad face
      m.add(new THREE.Mesh(rounded(0.14, 3.4, 2.2, 0.04), new THREE.MeshStandardMaterial({ color: '#9fe3ff', transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.1 })));
      for (const [w, h, d, y] of [[0.2, 0.14, 2.3, -1.7], [0.2, 0.14, 2.3, 1.7], [0.2, 3.4, 0.14, 0]]) { const f = new THREE.Mesh(rounded(w, h, d, 0.03), mat('#8fb6cf')); f.position.y = y; if (d === 0.14) { f.position.z = 1.1; m.add(f.clone()); f.position.z = -1.1; } m.add(f); }
      const col = addCol(m, 'box', { half: new THREE.Vector3(0.08, 1.7, 1.1), e: 0.15, mult: 0.7, kind: 'glass' });
      things.push({ m, col, update() { m.visible = !col.off; } });
    }
    return { start: x0 - 0.8, span: 3.2 + 1.8 * (n - 1), aim: [x0 + 1.6, 1.8] };
  },
  spikes(x0) {   // a floor of spikes: landing on them hurts twice as much
    const g = new THREE.Group(); g.position.set(x0 + 1.9, 0, 0); scene.add(g);
    const base = new THREE.Mesh(rounded(3.6, 0.2, 2.0, 0.04), mat('#6b7280')); base.position.y = 0.1; base.receiveShadow = true; g.add(base);
    for (let i = 0; i < 7; i++) for (const z of [-0.6, 0.6]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), glossy('#d8dde6', { roughness: 0.25, metalness: 0.5 })); c.position.set(-1.5 + i * 0.5, 0.45, z); c.castShadow = true; g.add(c); }
    const hit = new THREE.Group(); hit.position.set(0, 0.28, 0); g.add(hit);
    const col = addCol(hit, 'box', { half: new THREE.Vector3(1.8, 0.28, 1.0), e: 0.15, mult: 2.2, kind: 'spike' });
    things.push({ m: g, col });
    return { start: x0 - 0.6, span: 4.2, aim: [x0 + 1.9, 1.0] };
  },
  fan(x0, o = {}) {   // updraft fan: a column of air that lifts the dummy
    const g = new THREE.Group(); g.position.set(x0 + 2.6, 0, 0); scene.add(g);
    const base = new THREE.Mesh(rounded(2.4, 0.5, 2.0, 0.12), glossy('#5b6b86')); base.position.y = 0.25; base.castShadow = true; g.add(base);
    const blades = new THREE.Group(); blades.position.y = 0.55; g.add(blades);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(rounded(1.0, 0.04, 0.3, 0.02), glossy('#4dd0e1')); b.position.x = 0.5; const h = new THREE.Group(); h.rotation.y = i * Math.PI / 2; h.add(b); blades.add(h); }
    const air = []; for (let i = 0; i < 14; i++) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.5, 3, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })); a.position.set((R() - 0.5) * 1.8, R() * 6, (R() - 0.5) * 0.8); g.add(a); air.push(a); }
    const zone = { x: x0 + 2.6, hw: 1.15, top: 7.5 };
    zones.push(zone);
    things.push({ m: g, update(t, dt) { blades.rotation.y += dt * 18; for (const a of air) { a.position.y += dt * 7; if (a.position.y > 7) a.position.y = 0.6; } } });
    return { start: x0 - 0.8, span: 5, aim: [x0 + 2.6, 2.6] };
  },
  gold(x0, o = {}) {   // a golden bullseye: one clean hit pays big
    const g = new THREE.Group(); scene.add(g); const y0 = o.y || 3.2, gx = x0 + 2.4;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 28), glossy('#ffc61a', { roughness: 0.15, metalness: 0.6, emissive: '#ffb000', emissiveIntensity: 0.3 })); disc.rotation.x = Math.PI / 2; disc.castShadow = true; g.add(disc);
    for (const [r, c] of [[0.42, '#ffffff'], [0.24, '#ff3d6e']]) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 24), mat(c, { roughness: 0.3 })); ring.rotation.x = Math.PI / 2; g.add(ring); }
    const col = addCol(g, 'sphere', { r: 0.62, e: 0.8, mult: 1, kind: 'gold' });
    let ph = 0;
    things.push({ m: g, col, update(t, dt) { ph += dt; g.visible = !col.off; g.position.set(gx, y0 + (o.bob ? Math.sin(ph * 1.6) * 0.9 : Math.sin(ph * 2) * 0.12), 0); g.rotation.y = Math.sin(ph) * 0.4; } });
    return { start: x0 - 0.6, span: 3.4, aim: [gx, y0] };
  },
};
const ORDER = ['ball', 'stairs', 'car', 'paddles', 'bumpers', 'crate'];

function clearWorld() {
  for (const t of things) { scene.remove(t.m); t.ring && scene.remove(t.ring); }
  things = []; colliders = []; zones = [];
}
function buildLevel() {
  clearWorld();
  const r = rng(level * 4241 + 99), LV = DEEP ? LEVELS[(level - 1) % LEVELS.length] : null;
  R = DEEP ? rng(level * 7919 + 13) : Math.random;
  const kinds = LV ? LV.k : level <= ORDER.length ? [[ORDER[level - 1]]] : [[ORDER[Math.floor(r() * ORDER.length)]]];
  if (!LV && level > 3) { let k2; do k2 = ORDER[Math.floor(r() * ORDER.length)]; while (k2 === kinds[0][0] || k2 === 'stairs'); kinds.push([k2]); }
  if (LV) applyWorld(LV.w);
  let x = 0, first = null;
  for (const [k, o] of kinds) { const info = T[k](x, o); if (!first) first = info; x += info.span + 1.5; }
  worldW = x;
  startAt.set(first.start, first.startY || 0, 0); aimAt.set(first.aim[0], first.aim[1], 0);
  camCenter.set((x - 1.5) / 2 - 0.6, 0, 0);
  goal = Math.round((level === 1 ? 100 : (110 + level * 30) * (kinds.length > 1 ? 1.15 : 1)) * F.k() / 10) * 10;
  throws = 3; damage = 0; stars = 0; chain = 0; chainAt = 0; doneAsked = false; flying = false;
  if (LV) { goal = LV.g[0]; goals = LV.g; throws = LV.thr; ui.sub('TARGET ' + goal); } dummyLive = false; settleT = 0; grab = null; total = 0;
  placeRagdoll(rd, startAt); drawDummy(); for (const j of rd.P) { j.hitT = 0; j.touch = {}; } stepAcc = 0; hitStop = 0; slowT = 0; fuses.length = 0; pend = null; frameHits = [];
  for (const t of things) t.update && t.update(0, 0);
  for (const c of colliders) { syncCollider(c); syncCollider(c); }
  ui.levels(level); ui.progress(0); ui.score(0); if (!LV) ui.sub('GOAL ' + goal); ui.pill('✋'.repeat(throws));
  if (DEEP) { meta.hud.stars(0); meta.hud.combo(0, 1); meta.hud.bank(false); meta.hud.visible(state === 'play'); }
}
let calibrating = false, worldW = 0, stars = 0, goals = [60, 110, 160], chain = 0, chainAt = 0, doneAsked = false, flying = false, chainMult = 1;
function applyWorld(wi) {
  const W = WORLDS[wi]; if (!W) return;
  FOG.set(W.fog); scene.fog.color.set(W.fog); ground.material.color.set(W.ground); stage.hemi.groundColor.set(W.hemi);
  skyMat.uniforms.cLo.value.set(W.sky[0]); skyMat.uniforms.cHi.value.set(W.sky[1]);
  document.body.style.setProperty('--ui', W.ui); document.body.style.background = W.fog;
  document.documentElement.style.setProperty('--w-ui', W.ui); document.documentElement.style.setProperty('--w-sub', W.sub);
  document.getElementById('sd-w').textContent = `.hc-score,.hc-card h1,.hc-lvl.next{color:${W.ui}!important}.hc-sub{color:${W.sub}!important}`;
}

// ------------------------------------------------------------------ damage + juice
let shake = 0, hitStop = 0, crushT = 0, slowT = 0, lastHitSfx = 0, dummyLive = false, settleT = 0, grab = null, popCD = 0, popCD2 = 0, flashT = 0;
const WORDS = ['BONK!', 'WHAM!', 'POW!', 'OOF!', 'BOING!', 'THUD!'];
const _s = new THREE.Vector3();
function floater(text, pos, size = 24, color = '#fff') {
  _s.copy(pos).project(camera); if (_s.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmg'; d.textContent = text; d.style.left = (_s.x + 1) / 2 * innerWidth + 'px'; d.style.top = (1 - _s.y) / 2 * innerHeight + 'px'; d.style.fontSize = size + 'px'; d.style.color = color;
  document.body.appendChild(d); setTimeout(() => d.remove(), 900);
}
let throwDmg0 = 0, trickDone = true, frameHits = [], pend = null, lastChainCount = 0;
function flushFloat(force) { if (!pend || !force && nowMs() - pend.t < 220) return; floater('+' + pend.sum, pend.at, clamp(20 + pend.sum * 0.5, 20, 52), pend.sum > 40 ? '#ffd23f' : '#ffffff'); pend = null; }
const fuses = [];
const mkRng = sd => { const r = rng(sd * 1000003 + 12345); for (let i = 0; i < 8; i++) r(); return r; };
let simMs = 0; const nowMs = () => calibrating ? simMs : performance.now();
function explode(c) {
  if (c.off) return; c.off = true; const ctr = c.obj.getWorldPosition(new THREE.Vector3());
  for (const j of rd.P) { const d = _s.copy(j.p).sub(ctr); const dist = Math.max(0.4, d.length()); d.divideScalar(dist); if (dist < 4.5) { const f = 17 * (1 - dist / 5.5); j.o.addScaledVector(d, -f / 120).y -= f * 0.45 / 120; } }
  frameHits.push({ dmg: 38, at: ctr.clone().add(new THREE.Vector3(0, 0.6, 0)), speed: 16, boom: true });
  burst(scene, ctr, ['#ff8a1f', '#ffd23f', '#ffffff', '#555a66'], 34, { speed: 0.2, up: 0.12, size: 0.8, shape: 'sphere', life: 0.8 });
  shake = Math.max(shake, 0.8); hitStop = 0.1; ui.flash(0.5); sfx.smash(); tone(70, 0.4, 'sawtooth', 0.14, 0.3); buzz([30, 20, 50]);
  for (const o of colliders) if (o.kind === 'tnt' && !o.off && o.obj.position.distanceTo(ctr) < 2.4) fuses.push({ c: o, t: 0.16 });
}
function special(j, speed, c, at) {
  if (c.kind === 'tnt') { if (speed > 4.6) { explode(c); return true; } return false; }
  if (c.kind === 'glass') { if (speed > 5.5) { c.off = true; const p = c.obj.getWorldPosition(new THREE.Vector3());
      frameHits.push({ dmg: 22, at: p, speed: 12 }); burst(scene, p, ['#bfeaff', '#ffffff', '#7fd0ff'], 26, { speed: 0.16, up: 0.1, size: 0.5, life: 0.8 }); tone(1500, 0.18, 'triangle', 0.1, 0.5); tone(2200, 0.1, 'sine', 0.06, 0.6); buzz(15); return true; } return false; }
  if (c.kind === 'gold') { c.off = true; const p = c.obj.getWorldPosition(new THREE.Vector3()); frameHits.push({ dmg: 60, at: p, speed: 18, gold: true });
      confetti(scene, p, 40); ui.pop('GOLDEN!', '#ffc61a', 56, 24); for (const k of [0, 1, 2]) setTimeout(() => note(79 + k * 4, 0.3, 0.16), k * 90); shake = Math.max(shake, 0.4); return true; }
  return false;
}
function onImpact(j, speed, c, at) {
  if (state !== 'play' || !dummyLive) return;
  if (DEEP && c && c.kind && special(j, speed, c, at)) return;
  const mult = c ? c.mult || 1 : 1;
  const now = nowMs(); if (now - (j.hitT || 0) < 220) return;
  const dmg = Math.round((speed - 4) * 0.8 * mult * (j.n === 'head' ? 1.5 : 1));
  if (dmg <= 0) return; j.hitT = now;
  if (c && c.bumper) c.obj.userData.pop = 1;
  frameHits.push({ dmg, at: at.clone(), speed, n: j.n });
}
function flushHits() {
  if (!frameHits.length) return;
  let sum = frameHits.reduce((a, h) => a + h.dmg, 0); const top = frameHits.reduce((a, h) => h.speed > a.speed ? h : a);
  frameHits = [];
  if (DEEP) {   // chained hits inside one throw build a multiplier
    const nowc = nowMs(); if (nowc - chainAt > 1300) chain = 0;
    if (nowc - lastChainCount > 130) { chain++; lastChainCount = nowc; }
    chainAt = nowc; chainMult = Math.min(2.5, 1 + 0.15 * (chain - 1)); sum = Math.round(sum * chainMult); meta.hud.combo(chain >= 3 ? chain : 0, chainMult);
    if (chain >= 2) note(60 + Math.min(24, chain * 2), 0.14, 0.1);   // rising ladder: each chained hit climbs a step
    if (chain === 3) ui.pop('x3', '#ffd23f', 36, 20);
    if (chain === 16) { ui.pop('LEGENDARY!', '#7a3dff', 66, 34); shake = Math.max(shake, 0.9); ui.flash(0.5); }
    if (chain === 5 || chain === 8 || chain === 12) { ui.pop(chain === 5 ? 'COMBO!' : chain === 8 ? 'MEGA COMBO!' : 'UNSTOPPABLE!', '#ff3d6e', 44 + chain, 30); hitStop = Math.max(hitStop, 0.08); }
  }
  damage += sum; total += sum; ui.score(damage); ui.progress(DEEP ? damage / goals[2] : damage / goal);
  if (DEEP) checkStars();
  if (!pend) pend = { sum: 0, at: top.at, t: nowMs() };
  pend.sum += sum; if (top.speed > (pend.sp || 0)) { pend.at = top.at; pend.sp = top.speed; }
  const now = nowMs();
  if (now - lastHitSfx > 60) { lastHitSfx = now; tone(clamp(300 - sum * 2, 90, 300), 0.09, 'square', 0.06 + Math.min(0.08, sum / 400), 0.5); tone(140, 0.12, 'sine', 0.12, 0.6); }
  if (sum > 12) { burst(scene, top.at, ['#ffd23f', '#ffffff', '#ff8a1f'], Math.min(16, 4 + sum / 4), { speed: 0.08 + sum / 900, up: 0.05, size: 0.45, shape: 'sphere', life: 0.7 }); }
  if (sum > 25) { shake = Math.max(shake, Math.min(0.6, sum / 100)); buzz(Math.min(40, sum / 2)); flashT = 1; }
  if (DEEP && sum >= 70 && crushT <= 0 && slowT <= 0 && !calibrating && state === 'play') { crushT = 0.5; ui.pop('CRUSH!', '#ff3d6e', 58, 30); }   // the big one gets a beat of slow motion
  if (DEEP && sum > 18) {   // impact as an event: hit-stop + camera punch scale with damage, body-part callout
    hitStop = Math.max(hitStop, Math.min(0.12, 0.02 + sum / 900)); shake = Math.max(shake, Math.min(0.9, 0.15 + sum / 120));
    const nm = { head: 'HEAD', chest: 'BODY', back: 'BODY', pelvis: 'HIP', neck: 'NECK' }[top.n] || (/^(sh|ha|el)/.test(top.n || '') ? 'ARM' : /^(hip|kn|ft)/.test(top.n || '') ? 'LEG' : 'HIT');
    if (popCD2 <= 0) { popCD2 = 0.35; ui.pop('+' + sum + ' ' + nm, top.n === 'head' ? '#ff3d6e' : '#ffd23f', 30 + Math.min(18, sum / 8), 22); }
    tone(60 + Math.random() * 30, 0.16, 'sawtooth', 0.1 + Math.min(0.1, sum / 500), 0.4); tone(900 + Math.random() * 400, 0.04, 'square', 0.05, 0.3);
  }
  if (sum > 45 && popCD <= 0) { ui.pop(WORDS[Math.floor(Math.random() * WORDS.length)], '#ff8a1f', 40 + Math.min(20, sum / 6), 26); hitStop = 0.09; popCD = 0.5; }
  if (!DEEP && damage >= goal && slowT <= 0 && state === 'play' && !demoThrow) { slowT = 1.6; ui.flash(0.5); ui.pop('SMASHED!', '#ffd23f', 54, 30); sfx.smash(); }
}

function checkStars() {
  if (demoThrow) return;
  while (stars < 3 && damage >= goals[stars]) {
    stars++; meta.hud.stars(stars); tone(500 + stars * 120, 0.2, 'triangle', 0.12, 1.5);
    if (stars === 1) { ui.pop('BROKEN!', '#ffc61a', 46, 24); meta.hud.banner(throws > 0 || dummyLive ? 'keep smashing for 3 stars' : '', '#33465e'); ui.flash(0.35); }
    else if (stars === 2) { ui.pop('SMASHED!', '#ff8a1f', 50, 24); ui.flash(0.4); }
    else if (stars === 3 && state === 'play' && slowT <= 0 && !calibrating) { slowT = 1.6; ui.flash(0.6); ui.pop('PERFECT!', '#ff3d6e', 54, 24); sfx.smash(); }
  }
}
// ------------------------------------------------------------------ input: grab the nearest body part, drag, release to fling
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3();
function pointerWorld(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hitP) ? hitP.clone() : null; }
const dragVel = new THREE.Vector3(); let lastDrag = null, lastDragT = 0;
const arcDots = []; if (DEEP) for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })); m.visible = false; scene.add(m); arcDots.push(m); }
function showArc() {
  const on = DEEP && grab && grab.moved > 25 && state === 'play'; if (!on) { for (const m of arcDots) m.visible = false; return; }
  const v = dragVel.clone(); if (v.length() > 24) v.setLength(24); v.y += 1.5; if (performance.now() - lastDragT > 120) v.multiplyScalar(0.2);
  const p = rd.P[rd.IDX.chest].p.clone(); const dt = 0.07;
  arcDots.forEach((m, i) => { v.y += -18 * dt; p.addScaledVector(v, dt); m.position.copy(p); m.visible = p.y > 0.1; m.material.opacity = 0.8 * (1 - i / arcDots.length); m.scale.setScalar(1 - i / 22); });
}
input({
  onDown(e) {
    if (state !== 'play' || throws <= 0 || slowT > 0 || (meta && meta.mapOpen())) return;
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
  onUp(e) {
    if (!grab) return;
    const g = grab; grab = null;
    let v;
    if (g.moved < 12) {   // a tap flings the dummy toward the tapped spot with medium power (tap on the dummy = hop up and sideways)
      const w = pointerWorld(e.clientX, e.clientY), c = rd.P[rd.IDX.chest].p;
      const dir = w ? w.clone().sub(c) : new THREE.Vector3(); dir.z = 0;
      if (dir.length() < 1.2) dir.set(Math.random() < 0.5 ? -1 : 1, 1.4, 0);
      dir.y += 1.2; const dl = dir.length(); v = dir.normalize().multiplyScalar(DEEP ? Math.min(23, Math.max(9, 8 + dl * 1.6)) : 15);   // deep: tap distance = power, so where you tap matters
    } else if (g.moved < 25) return;
    else {
      // fling: give the whole body the drag velocity (clamped), a little extra up
      v = dragVel.clone(); if (v.length() > 24) v.setLength(24); v.y += 1.5;
      if (performance.now() - lastDragT > 120) v.multiplyScalar(0.2);
    }
    for (const j of rd.P) { j.o.copy(j.p).addScaledVector(v, -1 / 120); }
    throwDmg0 = damage; trickDone = false; throws--; ui.pill(throws ? '✋'.repeat(throws) : '—'); settleT = 0; chain = 0; flying = true; if (meta) meta.hud.bank(false);
    tone(300, 0.2, 'sawtooth', 0.05, 2.2); buzz(10);
  },
});
function maxSpeed() { let m = 0; for (const j of rd.P) m = Math.max(m, j.p.distanceTo(j.o) * 120); return m; }

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on level 1, if nobody has touched it
// 2 s in, the dummy is grabbed and flung into the setpiece (damage pops up), then the round resets: the throw is given back
let demoThrow = false;
addEventListener('pointerdown', e => { if (e.isTrusted && demoThrow) { demoThrow = false; buildLevel(); } }, { capture: true });
demo(n => {
  if (DEEP) return false;
  if (n > 1) { if (demoThrow) { demoThrow = false; buildLevel(); } return false; }
  const scr = v => { _s.copy(v).project(camera); return [(_s.x + 1) / 2 * innerWidth, (1 - _s.y) / 2 * innerHeight]; };
  const c = rd.P[rd.IDX.chest].p.clone(), dir = aimAt.clone().sub(c); dir.z = 0; dir.y += 1.5; dir.normalize();
  const a = scr(c), b = scr(c.clone().addScaledVector(dir, 2.6)), fire = (type, x, y) => dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y }));
  demoThrow = true; fire('pointerdown', a[0], a[1]);
  for (let i = 1; i <= 4; i++) setTimeout(() => { if (!demoThrow) return; const x = a[0] + (b[0] - a[0]) * i / 4, y = a[1] + (b[1] - a[1]) * i / 4; fire('pointermove', x, y);
    if (i === 4) { fire('pointerup', x, y); throws = 3; ui.pill('✋'.repeat(throws)); } }, i * 40);
}, { ready: () => state === 'play' && level === 1 && slowT <= 0 && throws === 3 && (demoThrow || !dummyLive), every: 2800, max: 2 });
ui.onTap(w => { WB.start();
  if (w === 'start') { state = 'play'; buildLevel(); if (DEEP && meta.total() === 0 && level === 1) meta.hud.banner('flick the dummy into the ball', '#33465e'); }
  else if (w === 'win') { level++; save.set('level', level); state = 'play'; buildLevel(); }
  else if (w === 'lose') { state = 'play'; buildLevel(); }
});
function win() {
  if (DEEP) return winDeep();
  if (state === 'play') F.level(true);
  if (state === 'play') WB.submit(1); state = 'won'; sfx.win(); buzz([20, 40, 20]);
  confetti(scene, rd.P[rd.IDX.chest].p.clone().add(new THREE.Vector3(0, 1.5, 0)), 80);
  if (damage > best) { best = damage; save.set('best', best); }
  ui.win(level, `${damage} damage`);
}
function winDeep() {
  if (state === 'play') { F.level(true); WB.submit(1); }
  state = 'won'; sfx.win(); buzz([20, 40, 20]); meta.hud.visible(false);
  confetti(scene, rd.P[rd.IDX.chest].p.clone().add(new THREE.Vector3(0, 1.5, 0)), 30 + stars * 30);
  const s = Math.max(1, stars), r = meta.record(level, damage, s); if (damage > best) { best = damage; save.set('best', best); }
  if (r.unlocked.length) { meta.setSkin(r.unlocked[r.unlocked.length - 1].id); }
  const lv = level, W = WORLDS[LEVELS[lv - 1].w];
  setTimeout(() => { if (state === 'won') meta.win({ level: lv, dmg: damage, s, r, color: W.ui, worldName: W.name, onNext: () => { level = Math.min(LEVELS.length, lv + 1); save.set('level2', level); state = 'play'; buildLevel(); }, onRetry: () => { state = 'play'; buildLevel(); } }); }, 650);
}
function loseDeep() {
  F.level(false, Math.min(1, damage / goal)); state = 'lost'; sfx.fail(); buzz([40, 30, 60]); meta.hud.visible(false);
  const lv = level, W = WORLDS[LEVELS[lv - 1].w];
  setTimeout(() => { if (state === 'lost') meta.lose({ level: lv, dmg: damage, goal, color: W.ui, onRetry: () => { state = 'play'; buildLevel(); } }); }, 550);
}
function lose() {
  if (DEEP) return loseDeep();
  if (state === 'play') F.level(false, Math.min(1, damage / goal));
  state = 'lost'; sfx.fail(); buzz([40, 30, 60]);
  ui.lose('NOT BROKEN!', `${damage} / ${goal} damage`);
}

// ------------------------------------------------------------------ main loop
const camPos = new THREE.Vector3(0, 4, 12), camAt = new THREE.Vector3();
let t = 0, idleT = 0;
function tick(dt60, noDraw) {
  const rdt = Math.min(dt60 / 60, 1 / 30);
  let ts = 1; if (slowT > 0) { slowT -= rdt; ts = 0.25; if (slowT <= 0 && state === 'play') win(); } if (hitStop > 0) { hitStop -= rdt; ts = 0.1; } if (crushT > 0) { crushT -= rdt; ts = Math.min(ts, 0.35); }
  const dt = rdt * ts; t += dt; popCD -= rdt; if (calibrating) simMs += rdt * 1000;
  for (const th of things) th.update && th.update(t, dt);
  for (const c of colliders) syncCollider(c);
  if (dummyLive) {
    const SUB = 2, sdt = 1 / 120;
    // keep simulation step fixed; scale how many steps by time-scale
    stepAcc += dt;
    for (let i = fuses.length - 1; i >= 0; i--) { fuses[i].t -= dt; if (fuses[i].t <= 0) { explode(fuses[i].c); fuses.splice(i, 1); } }
    let n = 0; while (stepAcc >= sdt && n < 6) {
      if (zones.length) for (const z of zones) for (const j of rd.P) if (Math.abs(j.p.x - z.x) < z.hw && j.p.y < z.top) { j.p.y += 31 * sdt * sdt; j.p.x += (z.x - j.p.x) * 0.6 * sdt * sdt * 8; }
      stepRagdoll(rd, colliders, sdt, Math.max(dt, 1e-3), { onImpact, grab }); stepAcc -= sdt; n++; }
    flushHits(); flushFloat();
    showArc();
    if (!grab) { if (maxSpeed() < 1.2) settleT += rdt; else settleT = 0; }
    if (DEEP && !trickDone && !grab && settleT > 0.5 && state === 'play') { trickDone = true; const d = damage - throwDmg0; if (d >= 120) { ui.pop('TRICK SHOT! +' + d, '#7a3dff', 48, 30); tone(700, 0.25, 'triangle', 0.12, 2); ui.flash(0.3); } }
    // deep: after a throw comes to rest with throws left, the dummy hops back to the start spot (throw, crunch, throw)
    if (DEEP && state === 'play' && !grab && throws > 0 && dummyLive && settleT > 0.9 && slowT <= 0 && Math.abs(rd.P[rd.IDX.chest].p.x - startAt.x) > 2.5) { placeRagdoll(rd, startAt); dummyLive = false; burst(scene, startAt.clone().setY(1), '#ffffff', 10, { speed: 3, up: 2, size: 0.25, life: 0.4 }); }
    if (DEEP && state === 'play') {
      const sp = maxSpeed(); if (sp > 13 && !noDraw && (trailT -= rdt) <= 0) { trailT = 0.035; burst(scene, rd.P[rd.IDX.pelvis].p, '#ffffff', 2, { speed: 0.01, up: 0, size: 0.28, shape: 'sphere', life: 0.35 }); }
      if (!grab && sp < 3) flying = false;
      if (meta) meta.hud.bank(stars >= 1 && throws > 0 && !grab && !flying && settleT > 0.4 && slowT <= 0, () => { if (state === 'play') { meta.hud.bank(false); slowT = 0; win(); } });
    }
    liveT = dummyLive ? liveT + rdt : 0;
    const outOfArena = rd.P[rd.IDX.pelvis].p.y < -6 || Math.abs(rd.P[0].p.x - camCenter.x) > 30;
    if (outOfArena || liveT > 16) {
      placeRagdoll(rd, startAt); dummyLive = false; liveT = 0;
      // last throw left the arena (or wedged): end the round instead of freezing
      if (state === 'play' && throws <= 0 && !grab && slowT <= 0) { if (DEEP ? stars >= 1 : damage >= goal) win(); else lose(); }
    }
    if (!DEEP && state === 'play' && throws <= 0 && !grab && settleT > 3.2 && damage < goal && slowT <= 0) lose();
    if (DEEP && state === 'play' && throws <= 0 && !grab && settleT > 1.6 && slowT <= 0) { if (stars >= 1) win(); else lose(); }
  } else {
    // idle: stand and sway, look at the hazards
    idleT += rdt; placeRagdoll(rd, startAt);
    for (const j of rd.P) { const k = j.p.y - startAt.y; j.p.x += Math.sin(idleT * 1.6) * 0.012 * k; j.o.copy(j.p); }
    const I = rd.IDX; rd.P[I.haL].p.x -= 0.03 + Math.sin(idleT * 3) * 0.02; rd.P[I.haR].p.x += 0.03 + Math.sin(idleT * 3) * 0.02;
  }
  // watchdog: no throws left and nothing happening -> always show a result
  if (state === 'play' && throws <= 0 && !grab && slowT <= 0 && maxSpeed() < 2) { endIdle += rdt; if (endIdle > 2.5) { endIdle = 0; dummyLive = false; if (DEEP ? stars >= 1 : damage >= goal) win(); else lose(); } } else endIdle = 0;
  drawDummy();
  head.pupil1.position.x = 0.06 + Math.sin(t * 0.7) * 0.012; head['pupil-1'].position.x = -0.06 + Math.sin(t * 0.7) * 0.012;
  // camera: frame the setpiece, drift toward the dummy
  const pel = rd.P[rd.IDX.pelvis].p, asp = camera.aspect;
  const focusX = lerp(camCenter.x, pel.x, Math.abs(pel.x - camCenter.x) > 4 ? 0.85 : 0.55), focusY = clamp(pel.y * 0.8 + 0.9, 1.8, 8);
  const dist = (asp < 0.7 ? 12.5 : 10) * (DEEP && worldW > 12 ? 1.12 : 1);
  camPos.lerp(_s.set(focusX + 1.2, focusY + 2.2, dist), 1 - Math.pow(0.08, rdt)); camAt.lerp(_r.set(focusX, focusY, 0), 1 - Math.pow(0.08, rdt));
  popCD2 -= rdt; shake = Math.max(0, shake - rdt * 2);
  camera.position.copy(camPos).add(_t.set((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0)); camera.lookAt(camAt);
  followLight(camAt);
}
let trailT = 0, liveT = 0, endIdle = 0;
loop(tick);
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

// v2 test hooks: jump to a level, run seeded rounds without rendering (qa/calib.cjs sets the star goals from these)
Object.assign(window.__game, {
  get meta() { return meta; }, scr(x, y) { _s.set(x, y, 0).project(camera); return [(_s.x + 1) / 2 * innerWidth, (1 - _s.y) / 2 * innerHeight]; }, chest() { const c = rd.P[rd.IDX.chest].p; return [c.x, c.y]; }, get aimXY() { return [aimAt.x, aimAt.y]; }, get demo() { return demoThrow; }, fakeWin(n) { damage = goals[n - 1] + 5; stars = n; ui.score(damage); win(); }, fakeLose() { damage = Math.round(goal * 0.8); lose(); }, get rd() { return rd; }, get aim() { return aimAt; }, tick, get stars() { return stars; }, get throwsLeft() { return throws; }, get goals() { return goals; },
  jump(n) { level = n; state = 'play'; if (meta) { meta.hideCard(); } ui.hideStart(); buildLevel(); return level; },
  launch(vx, vy) { const v = new THREE.Vector3(vx, vy, 0); dummyLive = true; settleT = 0; for (const j of rd.P) j.o.copy(j.p).addScaledVector(v, -1 / 120); throws--; chain = 0; flying = true; ui.pill(throws ? '✋'.repeat(throws) : '—'); },
  play(lv, plan) {   // deterministic replay of a throw plan [{wait, vx, vy}]; returns damage
    calibrating = true; simMs = 0; state = 'play'; level = lv; buildLevel();
    for (const p of plan) { for (let k = 0; k < p.wait * 60; k++) tick(1, true); this.launch(p.vx, p.vy); for (let k = 0; k < 600; k++) { tick(1, true); if (settleT > 1.2) break; } }
    const d = damage; calibrating = false; return d;
  },
  expert(lv, K, seed = 1) {   // greedy best-of-K per throw; returns the damage a good player could reach
    const rr = mkRng(seed * 977 + lv), plan = []; let bestD = 0; const th = LEVELS[lv - 1].thr;
    for (let k = 0; k < th; k++) {
      let best = null; bestD = -1; this.play(lv, plan);   // to read chest position
      const c = rd.P[rd.IDX.chest].p.clone(), aim = aimAt.clone();
      for (let i = 0; i < K; i++) {
        const T = 0.17 + rr() * 0.4, tx = aim.x + (rr() - 0.5) * 4, ty = aim.y + (rr() - 0.5) * 3.5;
        let vx = (tx - c.x) / T, vy = (ty - c.y) / T + 9 * T + rr() * 9; const sp = Math.hypot(vx, vy); if (sp > 24) { vx *= 24 / sp; vy *= 24 / sp; }
        const cand = { wait: rr() * 3.2, vx, vy }, d = this.play(lv, plan.concat(cand));
        if (k === 0 && this.exLog) this.exLog.push([+T.toFixed(2), +vx.toFixed(1), +vy.toFixed(1), +cand.wait.toFixed(1), d]);
        if (d > bestD) { bestD = d; best = cand; }
      }
      plan.push(best);
    }
    return bestD;
  },
});

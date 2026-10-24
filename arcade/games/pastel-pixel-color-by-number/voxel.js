// 3D voxel "pop-up" of a finished picture: every pixel becomes a glossy jelly cube, puffed up in depth by its distance
// from the silhouette edge, flying in row by row, then turning slowly (drag to spin). Mallow the bunny (kawaii
// library k06) cheers beside it. One renderer, reused for every finish.
import * as THREE from './kit/three.module.min.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';

let R = null, scene, cam, group, mesh = null, t = 0, anim = null, spin = 0, drag = null, raf = 0, mascot = null, mixer = null, hips = null, actions = {};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler();
const geo = new RoundedBoxGeometry(0.94, 0.94, 0.94, 2, 0.16);
const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') });

function init() {
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  R.setPixelRatio(Math.min(devicePixelRatio, 2)); R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(R); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7; pm.dispose();
  scene.add(new THREE.HemisphereLight('#fff4fb', '#c9a8e0', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#ffb3e0', 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
  cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  group = new THREE.Group(); scene.add(group);
  const el = R.domElement; el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (drag) spin = drag.s + (e.clientX - drag.x) * 0.012; });
  el.addEventListener('pointerup', () => drag = null);
  new GLTFLoader().loadAsync('./assets/chars/k06.glb').then(g => {
    mascot = g.scene; mascot.traverse(o => { if (o.isMesh) o.frustumCulled = false; if (!hips && o.isBone && /hips/i.test(o.name)) hips = o; });
    mixer = new THREE.AnimationMixer(mascot); for (const c of g.animations) actions[c.name] = mixer.clipAction(c);
    const b = new THREE.Box3().setFromObject(mascot); mascot.userData.h = b.max.y - b.min.y; scene.add(mascot); mascot.visible = false;
  }).catch(() => {});
}

export function warm() { if (!R) init(); }
// pic: { w, h, pal, px } → show it inside `host` (a sized element)
export function popUp(host, pic) {
  if (!R) init();
  host.appendChild(R.domElement);
  const W = host.clientWidth, H = host.clientHeight; R.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix();
  if (mesh) { group.remove(mesh); mesh.dispose(); }
  // distance to the silhouette edge → puffy depth (1–4 layers each side)
  const { w, h, px } = pic, inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[y * w + x] !== '.';
  const dist = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) dist[y * w + x] = 99;
  for (let pass = 0; pass < 6; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!dist[i]) continue;
    const m = Math.min(inside(x + 1, y) ? dist[i + 1] : 0, inside(x - 1, y) ? dist[i - 1] : 0, inside(x, y + 1) ? dist[i + w] : 0, inside(x, y - 1) ? dist[i - w] : 0); dist[i] = Math.min(dist[i], m + 1); }
  const cubes = [];
  const scale = Math.max(w, h) > 30 ? 1 : 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = px[y * w + x]; if (c === '.') continue;
    const d = Math.min(4, Math.ceil(dist[y * w + x] / 2)), col = new THREE.Color(pic.pal[c.charCodeAt(0) - 97]);
    for (let z = -d + 1; z <= d - 1; z++) if (Math.abs(z) === d - 1 || d === 1) cubes.push({ x: x - w / 2 + 0.5, y: h / 2 - y - 0.5, z, col, row: y }); }
  mesh = new THREE.InstancedMesh(geo, mat, cubes.length);
  cubes.forEach((c, i) => mesh.setColorAt(i, c.col));
  mesh.instanceColor.needsUpdate = true; group.add(mesh);
  group.scale.setScalar(scale);
  const size = Math.max(w, h);
  cam.position.set(0, size * 0.1, size * 2.15); cam.lookAt(0, 0, 0);
  if (mascot) { const s = size * 0.36 / mascot.userData.h; mascot.scale.setScalar(s); mascot.position.set(w * 0.36, -h / 2, size * 0.45); mascot.rotation.y = -0.35; mascot.visible = true;
    const a = actions.cheer || actions.idle; if (a) { for (const k in actions) actions[k].stop(); a.reset().play(); } }
  anim = { cubes, t0: t, h }; spin = 0;
  cancelAnimationFrame(raf); let last = performance.now();
  const tick = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; step(dt); R.render(scene, cam); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return { cubes: cubes.length };
}
function step(dt) {
  if (mixer) { mixer.update(dt); if (hips) { _e.setFromQuaternion(hips.quaternion, 'YXZ'); _e.y = 0; hips.quaternion.setFromEuler(_e); } }
  if (!anim) return;
  const k = t - anim.t0;
  anim.cubes.forEach((c, i) => {
    const delay = (anim.h - c.row) / anim.h * 0.9 + (Math.abs(c.x) % 3) * 0.02, f = Math.max(0, Math.min(1, (k - delay) / 0.45));
    const e = f === 0 ? 0 : 1 + 2.2 * Math.pow(f - 1, 3) + 1.2 * Math.pow(f - 1, 2);
    _p.set(c.x, c.y + (1 - f) * -4, c.z * (0.3 + 0.7 * e)); _s.setScalar(Math.max(0.001, e));
    _m.compose(_p, _q, _s); mesh.setMatrixAt(i, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (!drag) spin += dt * 0.5;
  group.rotation.y = Math.sin(spin) * 0.75; group.rotation.x = -0.12 + Math.sin(k * 0.8) * 0.03;
  group.position.y = Math.sin(k * 1.6) * 0.25;
}
export function stopPop() { cancelAnimationFrame(raf); raf = 0; if (R && R.domElement.parentNode) R.domElement.remove(); }

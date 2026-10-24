// Bubble Buns asset loader: kawaii library pieces (assets/*.glb, copied from assets/kawaii/web) as { geo, mat }, stood up
// (the props are stored Z-up) and normalised to largest side = 1; rigged chibi characters (Y-up) with their clips.
import { THREE } from './kit/hc.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';

export const loader = new GLTFLoader();
const cache = new Map();

function toFloat(g) {   // quantized attributes → float32 so transforms can be baked in
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}

/** one prop → { geo, mat, size }. center: 'base' (feet on y=0) or 'mid' (centred). Largest side = 1. */
export function piece(id, center = 'base') {
  const key = id + center;
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`./assets/${id}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true);
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld);
    geo.rotateX(Math.PI / 2);
    geo.computeBoundingBox(); const b = geo.boundingBox, s = new THREE.Vector3(); b.getSize(s);
    const k = 1 / Math.max(s.x, s.y, s.z), c = new THREE.Vector3(); b.getCenter(c);
    geo.translate(-c.x, center === 'mid' ? -c.y : -b.min.y, -c.z); geo.scale(k, k, k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = mesh.material; mat.side = THREE.FrontSide;
    return { geo, mat, size: s.multiplyScalar(k) };
  }));
  return cache.get(key);
}

/** a prop as a Mesh scaled so its largest side = size */
export async function prop(id, size = 1) {
  const p = await piece(id, 'base');
  const m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(size); m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** rigged chibi character → { g (group, feet at 0, height 1), mixer, play(name, once) } */
export async function chibi(id) {
  const gl = await loader.loadAsync(`./assets/chars/${id}.glb`);
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true), h = box.max.y - box.min.y;
  const inner = new THREE.Group(); inner.add(root); root.position.y = -box.min.y; inner.scale.setScalar(1 / h);
  const g = new THREE.Group(); g.add(inner);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
  let cur = null, tmr = 0;
  const play = (n, once = false) => {
    const a = acts[n]; if (!a) return; if (a === cur && !once) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play();
    if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
    clearTimeout(tmr); if (once) tmr = setTimeout(() => play('idle'), a.getClip().duration * 1000 + 80);
  };
  play('idle');
  return { g, mixer, play, clips: Object.keys(acts) };
}

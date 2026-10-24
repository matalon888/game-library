// Load the AI-generated 3D library pieces (./assets/*.glb, our own) as { geo, mat, size }, stood up and normalised.
// The library GLBs are stored Z-up and quantized: convert to float, bake the node transform, rotate upright.
import { THREE } from './kit/hc.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';

export const loader = new GLTFLoader();
const cache = new Map();

function toFloat(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k]; if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute && !a.normalized) continue;
    const n = a.itemSize, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) { out[i * n] = a.getX(i); if (n > 1) out[i * n + 1] = a.getY(i); if (n > 2) out[i * n + 2] = a.getZ(i); if (n > 3) out[i * n + 3] = a.getW(i); }
    g.setAttribute(k, new THREE.BufferAttribute(out, n));
  }
  return g;
}

/** one library GLB → { geo, mat, size } with its base on y = 0, centred in x/z, largest side = 1 */
export function piece(id) {
  if (!cache.has(id)) cache.set(id, loader.loadAsync(`./assets/${id}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true);
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld);
    geo.rotateX(Math.PI / 2);
    geo.computeBoundingBox(); const b = geo.boundingBox, s = new THREE.Vector3(); b.getSize(s);
    const k = 1 / Math.max(s.x, s.y, s.z), c = new THREE.Vector3(); b.getCenter(c);
    geo.translate(-c.x, -b.min.y, -c.z); geo.scale(k, k, k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = mesh.material; mat.side = THREE.FrontSide;
    return { geo, mat, size: s.multiplyScalar(k) };
  }));
  return cache.get(id);
}

/** the Hero Lab host: rigged character with idle / cheer / jump clips */
export async function loadHost(url = './assets/host.glb') {
  const gl = await loader.loadAsync(url);
  const root = gl.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true), h = box.max.y - box.min.y;
  root.position.y = -box.min.y;
  const g = new THREE.Group(); g.add(root);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
  let cur = null, tm = 0;
  const play = (n, once = false) => {
    const a = acts[n]; if (!a) return; if (a === cur && !once) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once; a.play();
    if (cur && cur !== a) cur.crossFadeTo(a, 0.25, false); cur = a;
    clearTimeout(tm); if (once) tm = setTimeout(() => play('idle'), a.getClip().duration * 1000 / a.timeScale - 120);
  };
  play('idle');
  return { g, h, mixer, play, clips: Object.keys(acts) };
}

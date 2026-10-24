// Bubblebay asset loader: AI-generated 3D library pieces (assets/*.glb, ours) as { geo, mat }, stood up + normalised.
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

/** load one GLB → { geo, mat, size }. center: 'base' (feet on y=0, centred x/z) or 'mid' (centred on all axes). Largest side = 1. */
export function piece(id, center = 'base') {
  const key = id + center;
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`./assets/${id}.glb`).then(gl => {
    gl.scene.updateMatrixWorld(true);
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = toFloat(mesh.geometry.clone()); geo.applyMatrix4(mesh.matrixWorld);
    geo.rotateX(Math.PI / 2);   // the library GLBs are authored Z-up: stand them up (front faces +Z)
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

/** a furniture item as a Mesh (shares geometry + material) scaled so its largest side = size */
export async function prop(id, size = 1) {
  const p = await piece(id, 'base');
  const m = new THREE.Mesh(p.geo, p.mat); m.scale.setScalar(size); m.castShadow = true; m.receiveShadow = true;
  return m;
}

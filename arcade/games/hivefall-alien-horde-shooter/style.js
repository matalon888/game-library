// Hivefall look: bright stylised toon shading (3-step ramp) + inverted-hull outlines that work on merged and instanced
// meshes (the hull is pushed along smoothed normals in the vertex shader, so box corners stay closed).
import { THREE } from './kit/cine.js';
import { mergeVertices } from './kit/addons/utils/BufferGeometryUtils.js';

export const INK = '#241a3a';
export const ramp = (() => { const d = new Uint8Array([95, 175, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o });

const outlineMats = new Map();
export function outlineMat(w = 0.035, color = INK) {
  const k = w + color; if (outlineMats.has(k)) return outlineMats.get(k);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.uniforms.uW = { value: w }; sh.vertexShader = 'uniform float uW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * uW;'); };
  m.customProgramCacheKey = () => 'ol' + w; outlineMats.set(k, m); return m;
}
// smooth-normal hull geometry for any (possibly merged, non-indexed) geometry
export function hullGeo(geo) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', geo.attributes.position.clone()); if (geo.index) g.setIndex(geo.index.clone());
  const m = mergeVertices(g, 1e-3); m.computeVertexNormals(); return m;
}
export function outline(mesh, w = 0.035, color = INK) {
  const o = mesh.isInstancedMesh ? new THREE.InstancedMesh(hullGeo(mesh.geometry), outlineMat(w, color), mesh.instanceMatrix.count) : new THREE.Mesh(hullGeo(mesh.geometry), outlineMat(w, color));
  if (mesh.isInstancedMesh) { o.instanceMatrix = mesh.instanceMatrix; o.count = mesh.count; o.frustumCulled = mesh.frustumCulled; }
  o.raycast = () => {}; mesh.add(o); mesh.userData.outline = o; return o;
}
export function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// graffiti-style word (thick ink stroke, white rim, candy fill)
export function graffiti(x, word, cx, cy, size, fill, rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; x.textAlign = 'center'; x.lineJoin = 'round';
  x.lineWidth = size * 0.22; x.strokeStyle = INK; x.strokeText(word, 0, size * 0.35); x.lineWidth = size * 0.09; x.strokeStyle = '#fff'; x.strokeText(word, 0, size * 0.35); x.fillStyle = fill; x.fillText(word, 0, size * 0.35); x.restore();
}

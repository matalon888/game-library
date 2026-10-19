// Toon helpers for Tidewing: stepped-light ramps, toon materials, and screen-space inverted-hull outlines
// (constant pixel width, smooth hull normals so hard-edged parts still get an unbroken ink line).
import * as THREE from './kit/three.module.min.js';
import { mergeVertices } from './kit/addons/utils/BufferGeometryUtils.js';

const ramps = {};
export function ramp(levels = [125, 195, 255]) {
  const k = levels.join(','); if (ramps[k]) return ramps[k];
  const t = new THREE.DataTexture(new Uint8Array(levels), levels.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return ramps[k] = t;
}
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp(), ...o });
export const INK = 0x1d1633;
export const OUTLINE_RES = { value: new THREE.Vector2(1 / 800, 1 / 800) };
const cache = {};
export function outlineMat(px = 2, color = INK) {
  const key = px + ':' + color; if (cache[key]) return cache[key];
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = s => {
    s.uniforms.uPx = { value: px }; s.uniforms.uInvRes = OUTLINE_RES;
    s.vertexShader = 'uniform float uPx; uniform vec2 uInvRes;\n' + s.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vec3 nO = mat3(instanceMatrix) * normal;
      #else
        vec3 nO = normal;
      #endif
      vec3 nV = normalize(normalMatrix * nO); vec2 cn = (projectionMatrix * vec4(nV, 0.0)).xy; float l = length(cn);
      if (l > 1e-5) gl_Position.xy += cn / l * uPx * uInvRes * 2.0 * gl_Position.w;`);
  };
  m.customProgramCacheKey = () => 'outline';
  return cache[key] = m;
}
const geoCache = new WeakMap();
export function outlineGeo(g) {
  if (geoCache.has(g)) return geoCache.get(g);
  const c = new THREE.BufferGeometry(); c.setAttribute('position', g.attributes.position.clone()); if (g.index) c.setIndex(g.index.clone());
  const m = mergeVertices(c, 1e-3); m.computeVertexNormals(); geoCache.set(g, m); return m;
}
export function setOutlineRes(w, h) { OUTLINE_RES.value.set(1 / w, 1 / h); }

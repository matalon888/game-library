// Glowfit dress-up: loads the kawaii chibi girls (k01–k05) and the w* wardrobe props, fits each piece onto the rig
// (props parented to bones in the bind pose, so they follow every clip), and recolours pieces with a hue-swap shader.
import * as THREE from './kit/three.module.min.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- props (Z-up, quantized → float, upright, floor at 0)
function toFloat(src) {
  const g = new THREE.BufferGeometry(); if (src.index) g.setIndex(src.index.clone());
  for (const [n, a] of Object.entries(src.attributes)) {
    const arr = new Float32Array(a.count * a.itemSize), get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) arr[i * a.itemSize + j] = get[j].call(a, i);
    g.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return g;
}
const PROPS = {};
export async function loadProp(id) {
  if (PROPS[id]) return PROPS[id];
  const g = await loader.loadAsync(`assets/${id}.glb`); g.scene.updateMatrixWorld(true);
  const src = g.scene.getObjectByProperty('isMesh', true);
  const geo = toFloat(src.geometry); geo.applyMatrix4(src.matrixWorld); geo.rotateX(Math.PI / 2);
  geo.computeBoundingBox(); const b = geo.boundingBox, s = 1 / Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geo.scale(s, s, s);
  geo.computeBoundingBox(); geo.computeVertexNormals();
  const m = src.material; m.side = THREE.DoubleSide;
  if (m.map) m.map.anisotropy = 4;
  return (PROPS[id] = { geo, mat: m });
}
// code-built pieces (the library has one skirt; the tulle tutu is drawn here in the same glossy pastel look)
export function buildCodePieces() {
  if (PROPS.tutu) return;
  const g = [], layers = [[0.42, 1.0, 0.5, 0], [0.4, 0.86, 0.42, 0.06], [0.38, 0.7, 0.32, 0.12]];
  for (const [r0, r1, h, y] of layers) {
    const c = new THREE.CylinderGeometry(r0, r1, h, 96, 6, true), pos = c.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), t = 0.5 - yy / h;   // t: 0 top → 1 hem
      const k = 1 + 0.07 * t * Math.sin(a * 14) + 0.03 * t * Math.sin(a * 5 + 1);
      pos.setXYZ(i, x * k, yy + y + h / 2 - 0.02 * t * Math.cos(a * 14), z * k);
    }
    c.translate(0, 0, 0); g.push(c);
  }
  // waistband
  const wb = new THREE.TorusGeometry(0.41, 0.045, 10, 64); wb.rotateX(Math.PI / 2); wb.translate(0, 0.5, 0); g.push(wb);
  const merged = mergeGeos(g); merged.computeVertexNormals(); merged.computeBoundingBox();
  const b = merged.boundingBox, sc = 1 / (b.max.x - b.min.x); merged.translate(0, -b.min.y, 0); merged.scale(sc, sc, sc); merged.computeBoundingBox();
  const mat = new THREE.MeshPhysicalMaterial({ color: '#ffb3d9', roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4, clearcoat: 0.3, side: THREE.DoubleSide, });
  mat.userData.code = true;
  PROPS.tutu = { geo: merged, mat };
}
function mergeGeos(list) {
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = []; let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); for (const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(idx); return m;
}
export const propMesh = id => { const p = PROPS[id]; const o = new THREE.Mesh(p.geo, p.mat); o.castShadow = true; return o; };

// keep only the triangles whose centroid passes test(x,y,z) (crop the beret's display head, split the boot pair)
function cropGeo(geo, test) {
  const pos = geo.attributes.position, idx = geo.index ? geo.index.array : [...Array(pos.count).keys()], keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += pos.getX(idx[i + k]); y += pos.getY(idx[i + k]); z += pos.getZ(idx[i + k]); }
    if (test(x / 3, y / 3, z / 3)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  // compact: only the kept vertices (so the bounding box and centre are the piece's own)
  const map = new Map(), nidx = [];
  for (const v of keep) { if (!map.has(v)) map.set(v, map.size); nidx.push(map.get(v)); }
  const g = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(geo.attributes)) {
    const arr = new Float32Array(map.size * a.itemSize);
    for (const [o, i] of map) for (let j = 0; j < a.itemSize; j++) arr[i * a.itemSize + j] = a.array[o * a.itemSize + j];
    g.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(nidx); g.computeBoundingBox(); return g;
}
const DERIVED = {};
function derived(key, id, test) {
  if (DERIVED[key]) return DERIVED[key];
  const p = PROPS[id], g = cropGeo(p.geo, test), b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.computeBoundingBox();
  return (DERIVED[key] = { geo: g, mat: p.mat });
}

// ---------------------------------------------------------------- hue-swap recolour (pastel colourways)
// hue: 0..1 target hue, sat/val multipliers; amt 0 = original colours. Only saturated texels change, so whites,
// creams, gold chains and the tiny details keep their look.
const HSV = `
vec3 gf_rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 gf_hsv2rgb(vec3 c){ vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y); }
uniform vec4 gfHue;`;
const MATS = new Map();
export function tinted(mat, cw) {
  if (!cw || cw.amt === 0) return mat;
  const key = mat.uuid + cw.id; if (MATS.has(key)) return MATS.get(key);
  if (mat.userData.code) { const m = mat.clone(); m.color.set(cw.css).lerp(new THREE.Color('#ffffff'), cw.id === 'noir' ? 0 : 0.35); MATS.set(key, m); return m; }
  const m = mat.clone(); m.userData.gf = new THREE.Vector4(cw.h, cw.s, cw.v, cw.amt ?? 1);
  m.onBeforeCompile = sh => {
    sh.uniforms.gfHue = { value: m.userData.gf };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HSV)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        vec3 sc = pow(max(sampledDiffuseColor.rgb, 0.), vec3(1./2.2)); vec3 hsv = gf_rgb2hsv(sc);
        float msk = smoothstep(0.10, 0.28, hsv.y) * gfHue.w;
        hsv.x = mix(hsv.x, gfHue.x, msk); hsv.y = clamp(mix(hsv.y, hsv.y * gfHue.y, msk), 0., 1.); hsv.z = clamp(mix(hsv.z, hsv.z * gfHue.z, msk), 0., 1.);
        sampledDiffuseColor.rgb = pow(gf_hsv2rgb(hsv), vec3(2.2));
        diffuseColor *= sampledDiffuseColor;
      #endif`);
  };
  m.customProgramCacheKey = () => 'gfhue';
  MATS.set(key, m); return m;
}

// ---------------------------------------------------------------- characters
function twist(q, axis) { const d = q.x * axis.x + q.y * axis.y + q.z * axis.z, t = new THREE.Quaternion(axis.x * d, axis.y * d, axis.z * d, q.w); return t.lengthSq() < 1e-9 ? new THREE.Quaternion() : t.normalize(); }
const depth = o => { let d = 0; while (o.parent) { o = o.parent; d++; } return d; };
const CHARS = {};
export async function loadChar(id) {
  if (CHARS[id]) return CHARS[id];
  const g = await loader.loadAsync(`assets/chars/${id}.glb`);
  return (CHARS[id] = g);
}
// a fresh, independent instance of a character (scene graph + mixer + clips) with fitted-wardrobe support
export function createModel(id, gltf) {
  const root = gltf.scene; // each character is loaded once and used by one model at a time
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; if (o.material.map) o.material.map.anisotropy = 4; o.material.roughness = 0.62; } });
  const skinned = []; root.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  const bones = {}; root.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const mixer = new THREE.AnimationMixer(root), clips = {};
  const hip0 = bones.Hips.position.clone(), hipQ0 = bones.Hips.quaternion.clone();
  for (const a of gltf.animations) {
    // keep the hips on the spot (the game moves the model): X/Z of the root translation track pinned to the rest pose
    const c = a.clone();
    for (const t of c.tracks) if (t.name === 'Hips.position') { const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = hip0.x; v[i + 2] = hip0.z; } }
    // and facing the camera: drop the yaw (twist about the rig's up axis) from the hips rotation, keep the sway
    // spine + neck + head: bones point along local +Y, so their twist about Y is the look-away; keep a little on the head
    for (const t of c.tracks) { const bn = t.name.split('.')[0], keepK = { Spine02: 0, Spine01: 0, Spine: 0, neck: 0.15, Head: 0.25 }[bn];
      if (keepK === undefined || !t.name.endsWith('.quaternion')) continue;
      const v = t.values, q = new THREE.Quaternion(), ax = V3(0, 1, 0), r0 = bones[bn].quaternion, tw0 = twist(r0, ax);
      for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i); const tw = twist(q, ax), tk = tw0.clone().slerp(tw, keepK); q.multiply(tw.invert()).multiply(tk).normalize(); q.toArray(v, i); }
    }
    for (const t of c.tracks) if (t.name === 'Hips.quaternion') {
      const v = t.values, q = new THREE.Quaternion(), tw = new THREE.Quaternion(), up = V3(0, 1, 0).applyQuaternion(bones.Hips.parent.quaternion.clone().invert());
      const tw0 = twist(hipQ0, up);
      for (let i = 0; i < v.length; i += 4) {
        q.fromArray(v, i); tw.copy(twist(q, up)); q.multiply(tw.invert()).multiply(tw0).normalize(); q.toArray(v, i);
      }
    }
    clips[a.name] = c;
  }
  // rest pose (the rig's A-pose node transforms) for measuring and fitting
  // rest pose = the rig's node transforms (it is the bind pose: the skin matches the bones there)
  const rest = Object.values(bones).map(b => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  const toRest = () => { for (const [b, p, q, s] of rest) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); } root.updateMatrixWorld(true); };
  toRest();
  const wp = n => bones[n].getWorldPosition(V3()).sub(root.getWorldPosition(V3()));
  const M = {
    hips: wp('Hips'), sp2: wp('Spine02'), sp1: wp('Spine01'), sp: wp('Spine'), neck: wp('neck'), head: wp('Head'), top: wp('head_end'),
    lArm: wp('LeftArm'), rArm: wp('RightArm'), lUp: wp('LeftUpLeg'), rUp: wp('RightUpLeg'), lLeg: wp('LeftLeg'), rLeg: wp('RightLeg'),
    lFoot: wp('LeftFoot'), rFoot: wp('RightFoot'), lHand: wp('LeftHand'), rHand: wp('RightHand'), front: wp('headfront'),
  };
  // the rigs differ (k03's head bones sit near the crown): measure the head from the neck to the top of the skinned mesh
  const box = new THREE.Box3().setFromObject(root, true);
  const topY = M.top.y - M.neck.y > 0.15 ? Math.min(box.max.y, M.top.y) : box.max.y;
  M.head = M.neck.clone(); M.top.y = topY; M.headH = topY - M.neck.y; M.height = box.max.y;
  M.shoulder = M.lArm.distanceTo(M.rArm); M.hipW = M.lUp.distanceTo(M.rUp);
  let action = null, cur = '';
  const model = {
    id, object: root, mixer, bones, M, outfit: {}, worn: {},
    play(name, { fade = 0.25, once = false, speed = 1 } = {}) {
      if (cur === name && action && !once) return action;
      const c = clips[name]; if (!c) return null;
      const a = mixer.clipAction(c); a.reset(); a.setEffectiveTimeScale(speed); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once;
      if (action && action !== a) { a.crossFadeFrom(action, fade, false); } a.play(); action = a; cur = name; return a;
    },
    get clip() { return cur; },
    clipDur: n => clips[n]?.duration || 1,
    wear(slot, item, cw) { wear(model, slot, item, cw); },
    holdBind(fn) { // run fn with the skeleton in bind pose (attachments are computed there), then restore the clip
      toRest(); fn(); mixer.update(0);
    },
  };
  return model;
}

// how each wardrobe piece sits on the body, in bind pose (A-pose, facing +Z). Measures come from the rig, so the same
// table fits all five girls. w = target width as a multiple of a body measure; at = anchor point; bone = parent.
const FIT = {
  w01: { bone: 'Spine01', at: M => V3(0, M.sp1.y - 0.075, M.sp1.z + 0.01), w: M => M.shoulder * 1.32 },          // sequin crop top
  w02: { bone: 'Spine01', at: M => V3(0, M.sp2.y - 0.07, M.sp1.z - 0.005), w: M => M.shoulder * 2.05 },          // puffer jacket
  w08: { bone: 'Hips', at: M => V3(0, M.lLeg.y + 0.03, M.hips.z), h: M => (M.neck.y - M.lLeg.y) * 1.02 },             // ruffled dress
  w03: { bone: 'Hips', at: M => V3(0, M.hips.y - 0.2, M.hips.z), w: M => M.hipW * 3.5, sy: 1.45 },                         // pleated skirt
  tutu: { bone: 'Hips', at: M => V3(0, M.hips.y - 0.2, M.hips.z), w: M => M.hipW * 3.7, sy: 1.25 },                        // tulle tutu
  w06: { bone: 'Head', at: M => V3(0, M.top.y - M.headH * 0.24, M.head.z - 0.01), w: M => M.headH * 0.9, rx: -0.25 },  // beret
  w07: { bone: 'Head', at: M => V3(0, M.head.y + M.headH * 0.36, M.head.z + 0.02), w: M => M.headH * 1.08 },     // cat-ear headphones
  w09c: { bone: 'Head', at: M => V3(0, M.head.y + M.headH * 0.33, M.front.z + 0.0), w: M => M.headH * 0.62, rx: 0.08 }, // heart sunglasses (temples trimmed)
  b01: { bone: 'Head', at: M => V3(0, M.top.y - M.headH * 0.2, M.head.z - 0.11), w: M => M.headH * 0.6, rx: -0.5 },  // big satin bow
  b02: { bone: 'Head', at: M => V3(M.headH * 0.36, M.head.y + M.headH * 0.62, M.head.z + 0.1), w: M => M.headH * 0.28, rz: -0.6, ry: 0.5 }, // hair clip
  w05: { bone: 'LeftHand', at: M => V3(M.lHand.x + 0.01, M.lHand.y - 0.14, M.lHand.z + 0.02), w: M => M.shoulder * 0.95, ry: Math.PI / 2 },   // heart bag
  r05: { bone: 'RightHand', at: M => V3(M.rHand.x - 0.01, M.rHand.y - 0.07, M.rHand.z + 0.04), h: () => 0.19 },   // bouquet
  x04: { bone: 'RightHand', at: M => V3(M.rHand.x - 0.01, M.rHand.y - 0.05, M.rHand.z + 0.03), h: () => 0.24 },   // star wand
  t09: { bone: 'RightHand', at: M => V3(M.rHand.x - 0.01, M.rHand.y - 0.05, M.rHand.z + 0.03), h: () => 0.2 },    // heart lollipop
  t01: { bone: 'RightHand', at: M => V3(M.rHand.x - 0.01, M.rHand.y - 0.07, M.rHand.z + 0.03), h: () => 0.13 },   // boba
};
function fitPiece(model, id, cw) {
  const f = FIT[id], M = model.M;
  const p = PROPS[id], mesh = new THREE.Mesh(p.geo, tinted(p.mat, cw)); mesh.castShadow = true;
  const sz = p.geo.boundingBox.getSize(V3()), s = f.h ? f.h(M) / sz.y : f.w(M) / sz.x;
  mesh.scale.set(s, s * (f.sy || 1), s); mesh.rotation.set(f.rx || 0, f.ry || 0, f.rz || 0);
  mesh.position.copy(f.at(M)).add(model.object.getWorldPosition(V3()));
  model.bones[f.bone].attach(mesh); return mesh;
}
function fitBoots(model, cw) {
  const M = model.M, out = [];
  for (const side of ['L', 'R']) {
    const d = derived('w04' + side, 'w04', side === 'L' ? (x => x > 0) : (x => x < 0));   // +x half = the girl's left
    const mesh = new THREE.Mesh(d.geo, tinted(d.mat, cw)); mesh.castShadow = true;
    const foot = side === 'L' ? M.lFoot : M.rFoot, leg = side === 'L' ? M.lLeg : M.rLeg;
    const sz = d.geo.boundingBox.getSize(V3()), s = (foot.y + (leg.y - foot.y) * 0.8) / sz.y;
    mesh.scale.setScalar(s); mesh.position.set(foot.x, -0.004, foot.z - 0.005).add(model.object.getWorldPosition(V3()));
    model.bones[side === 'L' ? 'LeftLeg' : 'RightLeg'].attach(mesh); out.push(mesh);
  }
  return out;
}
// slot → piece ids. Accessories have their own slots so a look can stack them.
export function wear(model, slot, id, cw) {
  for (const m of model.worn[slot] || []) { m.parent && m.parent.remove(m); }
  model.worn[slot] = []; model.outfit[slot] = id ? { id, cw: cw && cw.id } : null;
  if (!id) return;
  model.holdBind(() => {
    if (id === 'w04') model.worn[slot] = fitBoots(model, cw);
    else if (id === 'w09') { if (!PROPS.w09c) PROPS.w09c = derived('w09c', 'w09', (x, y, z) => z > 0.14); model.worn[slot] = [fitPiece(model, 'w09c', cw)]; }
    else if (id === 'w06') { if (!PROPS.w06c) { const d = derived('w06c', 'w06', (x, y) => y > 0.52); PROPS.w06c = d; } const f = FIT.w06; FIT.w06c = f; model.worn[slot] = [fitPiece(model, 'w06c', cw)]; }
    else model.worn[slot] = [fitPiece(model, id, cw)];
  });
}
export { FIT };

// a standalone mesh of a piece for thumbnails / shop displays (the beret without its display head)
export function pieceMesh(id, cw) {
  let p = PROPS[id];
  if (id === 'w06') p = PROPS.w06c || (PROPS.w06c = derived('w06c', 'w06', (x, y) => y > 0.52));
  const m = new THREE.Mesh(p.geo, tinted(p.mat, cw)); return m;
}

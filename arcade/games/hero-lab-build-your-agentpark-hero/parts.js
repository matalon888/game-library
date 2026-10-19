// Hero Lab parts: loads a rigged character, measures its body in rest pose (head top/size, eye line, face front, back,
// palms) from the skinned vertices, builds items (cropped GLBs or code-built) and mounts them on bones so they fit any
// body and follow every animation. THREE-agnostic: createParts(THREE, GLTFLoader) so games can pass their own copy.
import { itemById } from './catalog.js';

const HUE_GLSL = `
uniform float uHue; uniform float uSat; uniform float uBri; uniform float uLock;
vec3 hl_rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x); }
vec3 hl_hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
vec3 hl_shift(vec3 lin){
  vec3 c = pow(max(lin, vec3(0.)), vec3(1./2.2)); vec3 h = hl_rgb2hsv(c);
  float skin = (1. - smoothstep(0.075, 0.125, h.x)) * smoothstep(0.12, 0.25, h.y) * (1. - smoothstep(0.6, 0.75, h.y)) * smoothstep(0.1, 0.22, h.z);
  float m = smoothstep(0.1, 0.26, h.y) * (1. - uLock * skin);
  h.x = fract(h.x + uHue * m); h.y = clamp(h.y * mix(1., uSat, m), 0., 1.); h.z *= uBri;
  return pow(hl_hsv2rgb(h), vec3(2.2)); }`;

export function createParts(THREE, GLTFLoader, base = new URL('./', import.meta.url).href) {
  const loader = new GLTFLoader();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ------------------------------------------------------------ colour shader (outfit hue / sat / brightness)
  function hueUniforms(o = {}) { return { uHue: { value: o.hue ?? 0 }, uSat: { value: o.sat ?? 1 }, uBri: { value: o.bri ?? 1 }, uLock: { value: o.lock ?? 1 } }; }
  function patchHue(mat, U) {
    mat.userData.hlU = U;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HUE_GLSL)
        .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n sampledDiffuseColor.rgb = hl_shift(sampledDiffuseColor.rgb);\n diffuseColor *= sampledDiffuseColor;\n#endif');
    };
    mat.customProgramCacheKey = () => 'hl1';
    mat.needsUpdate = true;
  }
  // tint an item: GLB items through the shader uniforms, code-built ones by shifting each material's base colour
  function tint(obj, t = {}) {
    const hue = t.hue ?? 0, sat = t.sat ?? 1, bri = t.bri ?? 1;
    obj.traverse(o => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) {
        if (m.userData.hlU) { m.userData.hlU.uHue.value = hue; m.userData.hlU.uSat.value = sat; m.userData.hlU.uBri.value = bri; continue; }
        if (m.userData.noTint) continue;
        if (!m.userData.base) m.userData.base = { c: m.color.clone(), e: m.emissive ? m.emissive.clone() : null };
        const hsl = {}; m.userData.base.c.getHSL(hsl);
        m.color.setHSL((hsl.h + hue + 1) % 1, Math.min(1, hsl.s * sat), Math.min(1, hsl.l * bri));
        if (m.userData.base.e && m.emissive) { m.userData.base.e.getHSL(hsl); m.emissive.setHSL((hsl.h + hue + 1) % 1, hsl.s, hsl.l); }
      }
    });
  }

  // ------------------------------------------------------------ characters
  async function loadCharacter(id, { colors } = {}) {
    const g = await loader.loadAsync(`${base}assets/chars/${id}.glb`);
    const root = g.scene; root.name = 'hero-' + id;
    const U = hueUniforms(colors);
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        for (const m of [].concat(o.material)) { patchHue(m, U); m.side = THREE.DoubleSide; if (m.map) m.map.anisotropy = 4; }
      }
    });
    const clips = {};
    for (const c of g.animations) { lockRootMotion(c); clips[c.name.toLowerCase()] = c; }
    root.updateMatrixWorld(true);
    cleanStretch(root, [clips.idle, clips.run, clips.cheer, clips.jump, clips.slide].filter(Boolean));
    const M = measure(root);
    // held items are aimed in the idle pose (arms down), not the rest pose, so they look right most of the time
    if (clips.idle) {
      const saved = []; root.traverse(o => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
      const mx = new THREE.AnimationMixer(root); mx.clipAction(clips.idle).play(); mx.setTime(Math.min(0.5, clips.idle.duration * 0.25)); root.updateMatrixWorld(true);
      const I = measure(root); M.idle = { rest: I.rest, rh: I.rh, lh: I.lh };
      mx.stopAllAction(); mx.uncacheRoot(root);
      for (const [o, p, q, sc] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); }
      root.updateMatrixWorld(true);
    }
    return { id, root, clips, M, U, gltf: g };
  }

  // Meshy rigs sometimes fuse a hand to the hip (or a prop to a hand); when the arm moves, the triangles bridging them
  // stretch into dark shards. Sample a few poses and drop triangles that stretch far beyond their rest size.
  function cleanStretch(root, clips) {
    const meshes = []; root.traverse(o => { if (o.isSkinnedMesh && o.geometry.index) meshes.push(o); });
    if (!meshes.length || !clips.length) return;
    const rest = meshes.map(m => { const n = m.geometry.attributes.position.count, a = new Float32Array(n * 3), v = V(); for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; } return a; });
    const bad = meshes.map(m => new Uint8Array(m.geometry.index.count / 3));
    const saved = []; root.traverse(o => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
    const mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) for (const f of [0.15, 0.35, 0.55, 0.8]) {
      mixer.stopAllAction(); const act = mixer.clipAction(clip); act.reset().play(); mixer.setTime(clip.duration * f); root.updateMatrixWorld(true);
      meshes.forEach((m, mi) => {
        const n = m.geometry.attributes.position.count, P = new Float32Array(n * 3), v = V(), R = rest[mi], idx = m.geometry.index.array, B = bad[mi];
        for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
        const d = (A, a, b) => Math.hypot(A[a * 3] - A[b * 3], A[a * 3 + 1] - A[b * 3 + 1], A[a * 3 + 2] - A[b * 3 + 2]);
        for (let t = 0; t < idx.length; t += 3) {
          if (B[t / 3]) continue; const a = idx[t], b = idx[t + 1], c = idx[t + 2];
          const r = Math.max(d(R, a, b), d(R, b, c), d(R, c, a)), p = Math.max(d(P, a, b), d(P, b, c), d(P, c, a));
          if (p > 0.035 && p > r * 3) B[t / 3] = 1;
        }
      });
    }
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    for (const [o, p, q, sc] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); }
    root.updateMatrixWorld(true);
    meshes.forEach((m, mi) => {
      const idx = m.geometry.index.array, B = bad[mi], keep = [];
      for (let t = 0; t < idx.length; t += 3) if (!B[t / 3]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
      if (keep.length < idx.length) m.geometry.setIndex(keep);
      m.userData.dropped = idx.length / 3 - keep.length / 3;
    });
    root.updateMatrixWorld(true);
  }

  // keep the hips over the pedestal: zero the horizontal drift of the Hips track, keep the bounce
  function lockRootMotion(clip) {
    for (const t of clip.tracks) {
      if (!/hips\.position$/i.test(t.name)) continue;
      const v = t.values, x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  }

  const pct = (arr, p) => { if (!arr.length) return 0; const a = Float32Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))]; };

  // Body measurements in the root's space, rest pose. Everything that fits items comes from here.
  function measure(root) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const bones = {}; root.traverse(o => { if (o.isBone) bones[o.name] = o; });
    const rest = {}; for (const n in bones) rest[n] = inv.clone().multiply(bones[n].matrixWorld);
    const G = { head: ['Head', 'headfront', 'head_end'], chest: ['Spine01', 'Spine02', 'Spine', 'Hips', 'neck', 'LeftShoulder', 'RightShoulder'], rh: ['RightHand'], lh: ['LeftHand'] };
    const pts = { head: [], chest: [], rh: [], lh: [], all: [] };
    const v = V();
    root.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      const sk = mesh.skeleton, gi = sk.bones.map(b => Object.keys(G).find(k => G[k].includes(b.name)) || null);
      const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, n = si.count;
      const step = Math.max(1, Math.floor(n / 40000));
      const toRoot = inv.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < n; i += step) {
        mesh.getVertexPosition(i, v); v.applyMatrix4(toRoot);
        const p = [v.x, v.y, v.z]; pts.all.push(p);
        const w = {};
        for (let k = 0; k < 4; k++) { const g = gi[si.getComponent(i, k)]; if (g) w[g] = (w[g] || 0) + sw.getComponent(i, k); }
        for (const g in w) if (w[g] > 0.5) pts[g].push(p);
      }
    });
    const col = (a, k) => a.map(p => p[k]);
    const all = pts.all, minY = pct(col(all, 1), 0.001), maxY = pct(col(all, 1), 0.999);
    // head
    // head = skin weighted to the head, plus anything above the head bone near it (some rigs paint the skull to the neck)
    const hb = rest.Head ? V().setFromMatrixPosition(rest.Head) : null;
    const near = hb ? all.filter(p => p[1] > hb.y + 0.03 && Math.hypot(p[0] - hb.x, p[2] - hb.z) < 0.3) : [];
    const hp = pts.head.length > 50 ? (near.length > pts.head.length * 1.15 ? near : pts.head) : all.filter(p => p[1] > maxY - (maxY - minY) * 0.2);
    const hx = col(hp, 0), hy = col(hp, 1), hz = col(hp, 2);
    const cx = pct(hx, 0.5), cz = pct(hz, 0.5), bottom = pct(hy, 0.04);
    const W0 = pct(hx, 0.95) - pct(hx, 0.05), D0 = pct(hz, 0.97) - pct(hz, 0.03);
    // skull top: central column only, so ears, horns and hair spikes at the sides don't lift hats into the air
    const central = hp.filter(p => Math.abs(p[0] - cx) < W0 * 0.2 && Math.abs(p[2] - cz) < D0 * 0.3);
    const top = pct(col(central.length > 20 ? central : hp, 1), 0.985);
    const H = top - bottom;
    const eyeY = bottom + H * 0.5;
    // width at the eyes, front half only (ignores braids, hoods and hair hanging at the back)
    const eyes = hp.filter(p => Math.abs(p[1] - eyeY) < H * 0.14 && p[2] > cz - D0 * 0.1);
    const upper = hp.filter(p => p[1] > bottom + H * 0.45 && p[1] < bottom + H * 0.85);
    const W = (eyes.length > 30 ? pct(col(eyes, 0), 0.92) - pct(col(eyes, 0), 0.08) : pct(col(upper, 0), 0.95) - pct(col(upper, 0), 0.05)) || W0;
    const D = (pct(col(upper, 2), 0.98) - pct(col(upper, 2), 0.02)) || D0;
    const band = hp.filter(p => Math.abs(p[1] - eyeY) < H * 0.08 && Math.abs(p[0] - cx) < W * 0.3);
    const faceZ = pct(col(band.length > 10 ? band : hp, 2), 0.9);
    const backZ = pct(col(upper, 2), 0.02);
    // torso: spine/shoulder-weighted skin between the hips and the neck
    const bp = n => rest[n] ? V().setFromMatrixPosition(rest[n]) : null;
    const neckP = bp('neck') || V(cx, minY + (maxY - minY) * 0.78, cz), hipP = bp('Hips') || V(cx, minY + (maxY - minY) * 0.55, cz), s2 = bp('Spine02') || hipP.clone().lerp(neckP, 0.4);
    const cp0 = pts.chest.length > 50 ? pts.chest : all;
    const tband = cp0.filter(p => p[1] > s2.y && p[1] < neckP.y && Math.abs(p[0] - neckP.x) < 0.45);
    const tb = tband.length > 30 ? tband : cp0;
    const TW = pct(col(tb, 0), 0.93) - pct(col(tb, 0), 0.07), tcx = (pct(col(tb, 0), 0.93) + pct(col(tb, 0), 0.07)) / 2;
    const mid = tb.filter(p => Math.abs(p[0] - tcx) < TW * 0.25);
    const chest = { y: (s2.y + neckP.y) / 2, top: neckP.y, bot: hipP.y, H: neckP.y - hipP.y, W: TW, cx: tcx,
      backZ: pct(col(mid.length > 20 ? mid : tb, 2), 0.03), frontZ: pct(col(mid.length > 20 ? mid : tb, 2), 0.97) };
    const hand = (arr, bone) => {
      const b = rest[bone]; const bp = b ? V().setFromMatrixPosition(b) : V();
      if (arr.length < 10) return { c: bp, r: 0.05 };
      const c = V(pct(col(arr, 0), 0.5), pct(col(arr, 1), 0.5), pct(col(arr, 2), 0.5));
      const r = Math.max(pct(col(arr, 0), 0.95) - pct(col(arr, 0), 0.05), pct(col(arr, 1), 0.95) - pct(col(arr, 1), 0.05)) / 2;
      return { c, r };
    };
    const height = maxY - minY;
    return {
      minY, maxY, height, k: height / 1.75, bones: Object.keys(bones), rest,
      head: { cx, cz, top, bottom, H, W, D, eyeY, faceZ, backZ },
      chest,
      rh: hand(pts.rh, 'RightHand'), lh: hand(pts.lh, 'LeftHand'),
    };
  }

  // ------------------------------------------------------------ mounting
  // hand items: tip/face directions in rest pose for the RIGHT hand (mirrored for the left), off = palm offset (m)
  const HAND = {
    sword: { tip: [0, -0.3, 1], face: [-1, 0, 0] }, staff: { tip: [0, 1, 0.06], face: [0, 0, 1] }, blaster: { tip: [0, 0.05, 1], face: [0, 1, 0] },
    board: { tip: [0, 1, 0.1], face: [-1, 0, 0], off: [-0.02, 0, 0] }, guitar: { tip: [0.15, 0.9, 0.45], face: [0, -0.4, 1], off: [0, 0.05, 0.04] }, lantern: { tip: [0, 1, 0], face: [0, 0, 1] },
    scythe: { tip: [0, 1, 0.06], face: [0, 0, 1] }, ball: { tip: [0, 1, 0], face: [-0.6, 0, 0.8] }, shield: { tip: [0, 1, 0], face: [-1, 0, 0.15], off: [-0.04, 0.02, 0] },
  };
  const SLOT_BONE = { head: ['Head'], face: ['Head'], back: ['Spine02', 'Spine01', 'Spine'], hand: ['RightHand'], offhand: ['LeftHand'] };
  // Places `obj` (built in its slot's anchor space) on the right bone. anchor space:
  //  head: origin = skull top centre; face: origin = eye line on the face front; back: origin = middle of the back;
  //  hand: origin = palm, +Y = where the tip points, +Z = the item's face.
  function mount(hero, slot, obj, def = {}) {
    const M = hero.M, bone = SLOT_BONE[slot].map(n => hero.root.getObjectByName(n)).find(Boolean);
    if (!bone) return null;
    const A = new THREE.Matrix4();
    if (slot === 'head') A.makeTranslation(M.head.cx, M.head.top, M.head.cz);
    else if (slot === 'face') A.makeTranslation(M.head.cx, M.head.eyeY, M.head.faceZ);
    else if (slot === 'back') A.makeTranslation(M.chest.cx, M.chest.y, M.chest.backZ);
    else {
      const left = slot === 'offhand', P = M.idle || M, h = left ? P.lh : P.rh, s = left ? -1 : 1;
      const f = def.hand || HAND[def.proc] || {}, tip = V(...(f.tip || [0, 0.2, 1])), face = V(...(f.face || [-1, 0, 0]));
      tip.x *= s; face.x *= s; tip.normalize();
      face.sub(tip.clone().multiplyScalar(face.dot(tip))).normalize();
      const xAxis = V().crossVectors(tip, face).normalize();
      A.makeBasis(xAxis, tip, face);
      const off = V(...(f.off || [0, 0, 0])); off.x *= s;
      A.setPosition(h.c.clone().add(off.multiplyScalar(M.k)));
    }
    const boneRest = (slot === 'hand' || slot === 'offhand') && M.idle ? M.idle.rest[bone.name] : M.rest[bone.name];
    const local = boneRest.clone().invert().multiply(A);
    const holder = new THREE.Group(); holder.name = 'slot-' + slot;
    local.decompose(holder.position, holder.quaternion, holder.scale);
    holder.add(obj); bone.add(holder);
    holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    return holder;
  }

  // ------------------------------------------------------------ items
  const glbCache = new Map();
  async function loadItemGLB(id) {
    if (!glbCache.has(id)) glbCache.set(id, loader.loadAsync(`${base}assets/items/${id}.glb`));
    const g = await glbCache.get(id);
    const o = g.scene.clone(true);
    o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); patchHue(m.material, hueUniforms({ lock: 0 })); } });
    return o;
  }

  async function buildItem(id, M) {
    const def = itemById(id); if (!def) return null;
    const k = M.k, Hd = M.head, ch = M.chest;
    let obj;
    if (def.glb) {
      const raw = await loadItemGLB(id);
      const box = new THREE.Box3().setFromObject(raw), sz = box.getSize(V()), f = def.fit || {};
      const wrap = new THREE.Group();
      if (f.rotY) { raw.rotation.y = f.rotY; raw.updateMatrixWorld(true); box.setFromObject(raw); box.getSize(sz); }
      const inner = new THREE.Group(); inner.add(raw); wrap.add(inner);
      const cxz = [-(box.min.x + box.max.x) / 2, -(box.min.z + box.max.z) / 2];
      if (def.slot === 'head') {
        const s = Math.max(Hd.W, Hd.D * 0.85) * (f.w || 1) / sz.x; inner.scale.setScalar(s);
        inner.position.set(cxz[0] * s, -box.min.y * s - (f.sink || 0.3) * Hd.H, cxz[1] * s + (f.dz || 0) * Hd.W);
      } else if (def.slot === 'face') {
        const s = Hd.W * (f.w || 1) / sz.x; inner.scale.setScalar(s);
        inner.position.set(cxz[0] * s, -(box.min.y + box.max.y) / 2 * s + (f.dy || 0) * Hd.H, -box.max.z * s + (f.dz || 0.06) * Hd.W);
      } else if (def.slot === 'back') {
        const s = ch.W * (f.w || 1) / sz.x; inner.scale.setScalar(s);
        inner.position.set(cxz[0] * s, -(box.min.y + box.max.y) / 2 * s + (f.dy || 0) * ch.H, -box.max.z * s + (f.dz || 0) * ch.W);
      } else {   // hand / offhand: long axis is +Y, grip point goes to the palm
        const s = (f.len || 0.8) * k / sz.y; inner.scale.setScalar(s);
        inner.position.set(cxz[0] * s, -(box.min.y + sz.y * (f.grip ?? 0.4)) * s, cxz[1] * s);
      }
      obj = wrap;
    } else {
      obj = PROC[def.proc] ? PROC[def.proc]({ k, W: Hd.W, H: Hd.H, D: Hd.D, eye: Hd.eyeY - Hd.top, front: Hd.faceZ - Hd.cz, back: Hd.backZ - Hd.cz,
        eyeToTop: Hd.top - Hd.eyeY, TW: ch.W, TH: ch.H, TT: ch.top - ch.y, TD: ch.frontZ - ch.backZ }) : new THREE.Group();
    }
    obj.userData.item = id;
    return { obj, def };
  }

  // ------------------------------------------------------------ code-built items
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...o });
  const glow = (color, i = 3.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.3 });
  const gold = () => std('#f2b632', { metalness: 0.85, roughness: 0.25 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const grp = (...c) => { const g = new THREE.Group(); c.forEach(x => g.add(x)); return g; };
  // tube along a curve whose radius tapers from r0 to r1
  function taper(points, r0, r1, seg = 24, rad = 10) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)));
    const geo = new THREE.TubeGeometry(curve, seg, 1, rad, false), pos = geo.attributes.position;
    for (let i = 0; i <= seg; i++) {
      const c = curve.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg);
      for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; const p = V().fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c); pos.setXYZ(idx, p.x, p.y, p.z); }
    }
    geo.computeVertexNormals(); return geo;
  }
  const rbox = (w, h, d, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: Math.min(r, d) * 0.4, bevelSize: Math.min(r, d) * 0.4, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -d / 2); return g;
  };
  const stripes = (a, b, n = 6, horiz = false) => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; if (horiz) x.fillRect(0, i * 128 / n, 128, 128 / n); else x.fillRect(i * 128 / n, 0, 128 / n, 128); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  const ring = (rx, rz, tube, mat, y = 0) => { const m = mesh(new THREE.TorusGeometry(1, tube, 10, 48), mat, 0, y, 0); m.rotation.x = Math.PI / 2; m.scale.set(rx, rz, (rx + rz) / 2); return m; };

  const PROC = {
    // ---------------- head (origin = skull top centre)
    halo: a => { const m = glow('#ffd54a', 2.2); const r = mesh(new THREE.TorusGeometry(a.W * 0.36, a.W * 0.04, 14, 48), m, 0, a.H * 0.22, -a.W * 0.05); r.rotation.x = Math.PI / 2 - 0.25; return grp(r); },
    horns: a => {
      const m = std('#d7263d', { roughness: 0.3, metalness: 0.1 }), g = new THREE.Group();
      for (const s of [-1, 1]) { const h = mesh(taper([[0, 0, 0], [s * a.W * 0.08, a.H * 0.2, 0], [s * a.W * 0.22, a.H * 0.36, -a.W * 0.04], [s * a.W * 0.34, a.H * 0.42, -a.W * 0.02]], a.W * 0.1, a.W * 0.005), m, s * a.W * 0.22, -a.H * 0.14, a.D * 0.08); g.add(h); }
      return g;
    },
    phones: a => {
      const band = std('#20232e', { roughness: 0.35 }), cup = std('#39e67a', { roughness: 0.3, metalness: 0.2 }), pad = std('#15161c', { roughness: 0.9 }), g = new THREE.Group();
      const R = a.W * 0.56, ey = a.eye * 0.85;
      const arc = mesh(new THREE.TorusGeometry(1, 0.06, 10, 40, Math.PI), band, 0, ey, 0); arc.scale.set(R, -ey + a.H * 0.04, R); g.add(arc);
      for (const s of [-1, 1]) {
        const c = mesh(new THREE.CylinderGeometry(a.W * 0.2, a.W * 0.2, a.W * 0.14, 28), cup, s * (R + a.W * 0.02), ey, 0); c.rotation.z = Math.PI / 2; g.add(c);
        const p = mesh(new THREE.TorusGeometry(a.W * 0.15, a.W * 0.05, 10, 24), pad, s * (R - a.W * 0.05), ey, 0); p.rotation.y = Math.PI / 2; g.add(p);
        const l = mesh(new THREE.CylinderGeometry(a.W * 0.1, a.W * 0.1, 0.004, 20), glow('#b6ff5a', 1.6), s * (R + a.W * 0.095), ey, 0); l.rotation.z = Math.PI / 2; g.add(l);
      }
      return g;
    },
    bubble: a => {
      const r = Math.max(a.W, a.H, a.D) * 0.66, cy = -a.H * 0.5;
      const glass = new THREE.MeshPhysicalMaterial({ color: '#cfefff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, envMapIntensity: 2.5, depthWrite: false, side: THREE.DoubleSide });
      glass.userData.noTint = true;
      const s = mesh(new THREE.SphereGeometry(r, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.78), glass, 0, cy + r * 0.12, 0);
      s.renderOrder = 5;
      const collar = ring(r * 0.66, r * 0.66, 0.08, std('#e8edf5', { metalness: 0.7, roughness: 0.25 }), cy + r * 0.12 - r * 0.79);
      const light = mesh(new THREE.SphereGeometry(a.W * 0.05, 12, 8), glow('#5af0ff', 3), 0, cy + r * 0.12 + r * 0.98, 0);
      return grp(s, collar, light);
    },
    band: a => { const r = Math.max(a.W, a.D * 0.9) * 0.53, y = a.eye * 0.45; return grp(ring(r, r * 1.05, 0.1, std('#ff4d6d', { roughness: 0.8 }), y), ring(r * 1.01, r * 1.06, 0.04, std('#ffffff', { roughness: 0.8 }), y)); },
    party: a => {
      const tex = stripes('#ff5dbb', '#ffd23f', 8); tex.repeat.set(3, 1);
      const c = mesh(new THREE.ConeGeometry(a.W * 0.26, a.H * 0.85, 32, 1, true), std('#ffffff', { map: tex, side: THREE.DoubleSide }), 0, a.H * 0.35, 0);
      const pom = mesh(new THREE.IcosahedronGeometry(a.W * 0.08, 2), std('#3ab7ff', { roughness: 0.9 }), 0, a.H * 0.8, 0);
      const g = grp(c, pom); g.rotation.z = -0.18; g.position.x = a.W * 0.05; return g;
    },
    bunny: a => {
      const outer = std('#fff6fb', { roughness: 0.8 }), inner = std('#ff9cc4', { roughness: 0.7 }), g = new THREE.Group();
      for (const s of [-1, 1]) {
        const e = new THREE.Group();
        const o = mesh(new THREE.SphereGeometry(1, 24, 16), outer); o.scale.set(a.W * 0.11, a.H * 0.5, a.W * 0.05);
        const i = mesh(new THREE.SphereGeometry(1, 24, 16), inner, 0, 0, a.W * 0.025); i.scale.set(a.W * 0.065, a.H * 0.4, a.W * 0.03);
        e.add(o, i); e.position.set(s * a.W * 0.2, a.H * 0.35, 0); e.rotation.z = -s * 0.25; g.add(e);
      }
      return g;
    },
    antenna: a => grp(mesh(new THREE.CylinderGeometry(a.W * 0.1, a.W * 0.13, a.W * 0.06, 20), std('#cfd6e3', { metalness: 0.8, roughness: 0.3 }), 0, 0, 0),
      mesh(new THREE.CylinderGeometry(a.W * 0.015, a.W * 0.015, a.H * 0.5, 8), std('#cfd6e3', { metalness: 0.8, roughness: 0.3 }), 0, a.H * 0.25, 0),
      mesh(new THREE.SphereGeometry(a.W * 0.07, 16, 12), glow('#ff3d6e', 3), 0, a.H * 0.52, 0)),

    // ---------------- face (origin = eye line, on the face front)
    shades: a => {
      const lens = std('#0d0f16', { metalness: 0.7, roughness: 0.08 }), frame = std('#111', { roughness: 0.3 }), g = new THREE.Group(), lw = a.W * 0.36, lh = a.W * 0.2;
      for (const s of [-1, 1]) {
        const L = mesh(rbox(lw, lh, a.W * 0.03, lh * 0.35), lens, s * lw * 0.56, 0, a.W * 0.05); L.rotation.y = s * 0.12; g.add(L);
        const arm = mesh(new THREE.BoxGeometry(a.W * 0.03, a.W * 0.03, a.D * 0.75), frame, s * a.W * 0.53, a.W * 0.03, -a.D * 0.33); g.add(arm);
      }
      g.add(mesh(new THREE.BoxGeometry(a.W * 0.16, a.W * 0.035, a.W * 0.03), frame, 0, a.W * 0.05, a.W * 0.06));
      return g;
    },
    specs: a => {
      const fr = std('#c9a227', { metalness: 0.9, roughness: 0.25 }), gl = new THREE.MeshPhysicalMaterial({ color: '#dff4ff', transparent: true, opacity: 0.25, roughness: 0.05 }), g = new THREE.Group(), r = a.W * 0.15;
      gl.userData.noTint = true;
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.TorusGeometry(r, a.W * 0.016, 10, 32), fr, s * r * 1.15, 0, a.W * 0.05));
        g.add(mesh(new THREE.CircleGeometry(r, 32), gl, s * r * 1.15, 0, a.W * 0.05));
        g.add(mesh(new THREE.BoxGeometry(a.W * 0.02, a.W * 0.02, a.D * 0.75), fr, s * a.W * 0.52, a.W * 0.02, -a.D * 0.33));
        const t = mesh(new THREE.BoxGeometry(Math.max(0.001, a.W * 0.52 - r * 2.15), a.W * 0.02, a.W * 0.02), fr, s * (r * 2.15 + (a.W * 0.52 - r * 2.15) / 2), a.W * 0.02, a.W * 0.04); g.add(t);
      }
      g.add(mesh(new THREE.TorusGeometry(r * 0.25, a.W * 0.014, 8, 16, Math.PI), fr, 0, r * 0.15, a.W * 0.05));
      return g;
    },
    goggles: a => {
      const brass = std('#c58b3a', { metalness: 0.85, roughness: 0.3 }), lens = glow('#ffb43d', 0.5), strap = std('#5a3a22', { roughness: 0.9 }), g = new THREE.Group(), r = a.W * 0.17;
      for (const s of [-1, 1]) {
        const c = mesh(new THREE.CylinderGeometry(r, r * 1.08, a.W * 0.16, 28), brass, s * r * 1.15, 0, a.W * 0.06); c.rotation.x = Math.PI / 2; g.add(c);
        const l = mesh(new THREE.CircleGeometry(r * 0.82, 28), lens, s * r * 1.15, 0, a.W * 0.142); lens.transparent = true; lens.opacity = 0.85; g.add(l);
        g.add(mesh(new THREE.TorusGeometry(r * 0.9, a.W * 0.025, 8, 28), brass, s * r * 1.15, 0, a.W * 0.142));
      }
      const st = ring(a.W * 0.53, (a.front - a.back) * 0.52, 0.07, strap, 0); st.position.z = -(a.front + a.back) * 0 - (a.front - a.back) * 0.48; g.add(st);
      return g;
    },
    visor: a => {
      const m = new THREE.MeshStandardMaterial({ color: '#36e6ff', emissive: '#1fb8ff', emissiveIntensity: 1.2, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.3, side: THREE.DoubleSide });
      const R = a.W * 0.62, v = mesh(new THREE.CylinderGeometry(R, R, a.W * 0.2, 40, 1, true, -Math.PI * 0.42, Math.PI * 0.84), m, 0, 0, a.W * 0.1 - R);
      return grp(v, mesh(new THREE.BoxGeometry(a.W * 1.06, a.W * 0.03, a.W * 0.03), std('#d8dee9', { metalness: 0.8, roughness: 0.3 }), 0, a.W * 0.11, a.W * 0.04 - R * 0.06));
    },
    ninja: a => {
      const m = std('#1c1f2b', { roughness: 0.85, side: THREE.DoubleSide }), d = a.front - a.back;
      const c = mesh(new THREE.CylinderGeometry(1, 0.92, 1, 40, 1, true, -Math.PI * 0.62, Math.PI * 1.24), m, 0, -a.H * 0.26, -d * 0.45);
      c.scale.set(a.W * 0.54, a.H * 0.36, d * 0.56);
      const knot = mesh(new THREE.SphereGeometry(a.W * 0.06, 12, 8), m, 0, -a.H * 0.14, -d * 1.0);
      const tail = mesh(taper([[0, 0, 0], [a.W * 0.05, -a.H * 0.15, -a.W * 0.05], [a.W * 0.12, -a.H * 0.35, -a.W * 0.04]], a.W * 0.05, a.W * 0.02, 12, 6), m, 0, -a.H * 0.14, -d * 1.0);
      return grp(c, knot, tail);
    },
    masq: a => {
      const s = new THREE.Shape(), w = a.W * 0.55, h = a.W * 0.2;
      s.moveTo(0, -h * 0.2); s.bezierCurveTo(w * 0.3, -h * 0.7, w * 0.9, -h * 0.6, w, h * 0.5); s.bezierCurveTo(w * 0.7, h * 0.6, w * 0.3, h * 0.5, 0, h * 0.3);
      s.bezierCurveTo(-w * 0.3, h * 0.5, -w * 0.7, h * 0.6, -w, h * 0.5); s.bezierCurveTo(-w * 0.9, -h * 0.6, -w * 0.3, -h * 0.7, 0, -h * 0.2);
      for (const sx of [-1, 1]) { const hole = new THREE.Path(); hole.absellipse(sx * w * 0.45, h * 0.02, w * 0.2, h * 0.24, 0, Math.PI * 2, false); s.holes.push(hole); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: a.W * 0.03, bevelEnabled: true, bevelThickness: a.W * 0.01, bevelSize: a.W * 0.01, bevelSegments: 2 });
      const m = mesh(geo, std('#7b2cbf', { metalness: 0.5, roughness: 0.3 }), 0, 0, a.W * 0.04);
      const trim = gold(), g = grp(m);
      for (let i = 0; i < 3; i++) { const f = mesh(taper([[0, 0, 0], [a.W * 0.06, a.W * 0.18, 0], [a.W * 0.04, a.W * 0.4, -a.W * 0.03]], a.W * 0.035, a.W * 0.005, 12, 6), i === 1 ? trim : std('#ff5dbb', { roughness: 0.6 }), w * 0.85, h * 0.4, a.W * 0.02); f.rotation.z = -0.5 + i * 0.35; g.add(f); }
      return g;
    },
    patch: a => {
      const m = std('#121212', { roughness: 0.7 }), d = a.front - a.back;
      const p = mesh(new THREE.CylinderGeometry(a.W * 0.13, a.W * 0.13, a.W * 0.03, 24), m, -a.W * 0.2, 0, a.W * 0.04); p.rotation.x = Math.PI / 2;
      const st = ring(a.W * 0.53, d * 0.53, 0.04, m, 0); st.position.z = -d * 0.48; st.rotation.z = 0.25;
      return grp(p, st);
    },
    stache: a => {
      const m = std('#5b3a1e', { roughness: 0.8 }), g = new THREE.Group();
      for (const s of [-1, 1]) g.add(mesh(taper([[0, 0, 0], [s * a.W * 0.12, -a.W * 0.04, 0], [s * a.W * 0.24, a.W * 0.0, -a.W * 0.03], [s * a.W * 0.28, a.W * 0.07, -a.W * 0.04]], a.W * 0.07, a.W * 0.015, 16, 8), m));
      g.position.set(0, -a.H * 0.28, a.W * 0.0); return g;
    },

    // ---------------- back (origin = middle of the back; -Z is away from the body)
    jetpack: a => {
      const T = a.TW, body = std('#d9dee8', { metalness: 0.6, roughness: 0.3 }), red = std('#ff4d3d', { metalness: 0.3, roughness: 0.35 }), g = new THREE.Group();
      const z = -T * 0.24;
      g.add(mesh(rbox(T * 0.42, a.TH * 0.9, T * 0.18, T * 0.06), body, 0, 0, -T * 0.08));
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.CylinderGeometry(T * 0.16, T * 0.16, a.TH * 0.95, 24), red, s * T * 0.22, 0, z));
        g.add(mesh(new THREE.SphereGeometry(T * 0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), red, s * T * 0.22, a.TH * 0.475, z));
        g.add(mesh(new THREE.CylinderGeometry(T * 0.1, T * 0.14, T * 0.12, 20), body, s * T * 0.22, -a.TH * 0.53, z));
        const fl = mesh(new THREE.ConeGeometry(T * 0.09, T * 0.38, 16), glow('#ffa03a', 3), s * T * 0.22, -a.TH * 0.53 - T * 0.25, z); fl.rotation.x = Math.PI; g.add(fl);
        g.add(ring(T * 0.165, T * 0.165, 0.12, std('#f2c14e', { metalness: 0.8, roughness: 0.3 }), a.TH * 0.2).translateX(0));
        g.children[g.children.length - 1].position.set(s * T * 0.22, a.TH * 0.2, z);
      }
      return g;
    },
    angel: a => wings(a, false),
    bat: a => wings(a, true),
    pack: a => {
      const T = a.TW, c1 = std('#2e86de', { roughness: 0.7 }), c2 = std('#f6b93b', { roughness: 0.6 }), g = new THREE.Group();
      g.add(mesh(rbox(T * 0.62, a.TH * 0.95, T * 0.3, T * 0.12), c1, 0, -a.TH * 0.05, -T * 0.17));
      g.add(mesh(rbox(T * 0.46, a.TH * 0.4, T * 0.12, T * 0.08), c2, 0, -a.TH * 0.2, -T * 0.36));
      const roll = mesh(new THREE.CylinderGeometry(T * 0.12, T * 0.12, T * 0.75, 20), std('#8e44ad', { roughness: 0.8 }), 0, a.TH * 0.52, -T * 0.16); roll.rotation.z = Math.PI / 2; g.add(roll);
      return g;
    },
    quiver: a => {
      const T = a.TW, g = new THREE.Group(), leather = std('#8a4b2a', { roughness: 0.7 });
      g.add(mesh(new THREE.CylinderGeometry(T * 0.13, T * 0.1, a.TH * 1.25, 20), leather, 0, 0, 0));
      g.add(ring(T * 0.135, T * 0.135, 0.1, gold(), a.TH * 0.6));
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * T * 0.045, z = (i % 2 ? 1 : -1) * T * 0.04;
        g.add(mesh(new THREE.CylinderGeometry(T * 0.012, T * 0.012, a.TH * 0.4, 6), std('#d8b07a'), x, a.TH * 0.75, z));
        const f = mesh(new THREE.ConeGeometry(T * 0.035, T * 0.12, 4), std(['#ff4d6d', '#ffffff', '#3ab7ff'][i % 3], { roughness: 0.6 }), x, a.TH * 0.92, z); g.add(f);
      }
      g.rotation.z = -0.55; g.position.z = -T * 0.18; return g;
    },
    cape: a => {
      const T = a.TW, len = a.TH * 2.1, geo = new THREE.PlaneGeometry(1, 1, 12, 16), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = 0.5 - p.getY(i); // v: 0 top → 1 bottom
        const w = T * (0.85 + v * 0.55), x = (u - 0.5) * w, y = -v * len, z = -T * 0.05 - v * T * 0.28 - Math.cos((u - 0.5) * Math.PI) * T * 0.1 * (0.4 + v) + Math.sin(u * Math.PI * 4) * v * T * 0.03;
        p.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();
      const m = std('#d62839', { roughness: 0.65, side: THREE.DoubleSide });
      const c = mesh(geo, m, 0, a.TT * 0.95, 0);
      const clasp = mesh(new THREE.TorusGeometry(T * 0.42, T * 0.035, 8, 24, Math.PI), gold(), 0, a.TT * 0.95, -T * 0.02); clasp.rotation.x = Math.PI / 2; clasp.rotation.z = Math.PI;
      return grp(c);
    },
    shell: a => {
      const T = a.TW, c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#3f9b4b'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#d9c26a'; x.lineWidth = 7;
      for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) { const cx = q * 48 + (r % 2) * 24, cy = r * 56; x.beginPath(); for (let i = 0; i < 6; i++) { const ang = Math.PI / 3 * i + Math.PI / 6; x.lineTo(cx + 26 * Math.cos(ang), cy + 26 * Math.sin(ang)); } x.closePath(); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const s = mesh(new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', { map: t, roughness: 0.5 }), 0, -a.TH * 0.1, -T * 0.02);
      s.rotation.x = -Math.PI / 2; s.scale.set(T * 0.55, T * 0.4, a.TH * 0.75);
      const rim = ring(T * 0.55, a.TH * 0.75, 0.05, std('#d9c26a', { roughness: 0.5 }), 0); rim.rotation.x = 0; rim.position.set(0, -a.TH * 0.1, -T * 0.02);
      return grp(s, rim);
    },

    // ---------------- hands (origin = palm, +Y = tip, +Z = face)
    sword: a => {
      const k = a.k * 1.25, g = new THREE.Group(), s = new THREE.Shape(), L = 0.62 * k, w = 0.045 * k;
      s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w * 0.85, L * 0.82); s.lineTo(0, L); s.lineTo(-w * 0.85, L * 0.82); s.closePath();
      const bl = new THREE.ExtrudeGeometry(s, { depth: 0.008 * k, bevelEnabled: true, bevelThickness: 0.006 * k, bevelSize: 0.012 * k, bevelSegments: 2 }); bl.translate(0, 0, -0.004 * k);
      g.add(mesh(bl, std('#e8eef7', { metalness: 1, roughness: 0.18 }), 0, 0.07 * k, 0));
      const guard = mesh(rbox(0.2 * k, 0.035 * k, 0.04 * k, 0.015 * k), gold(), 0, 0.07 * k, 0); g.add(guard);
      g.add(mesh(new THREE.CylinderGeometry(0.018 * k, 0.02 * k, 0.13 * k, 12), std('#3d2a5c', { roughness: 0.7 }), 0, 0, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.03 * k), glow('#3a86ff', 1.5), 0, -0.08 * k, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.022 * k), glow('#3a86ff', 1.5), 0, 0.07 * k, 0.025 * k));
      return g;
    },
    staff: a => {
      const k = a.k, g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.018 * k, 0.024 * k, 1.5 * k, 10), std('#7a4a2a', { roughness: 0.8 }), 0, 0.15 * k, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.075 * k, 0), glow('#b46bff', 1.8), 0, 0.98 * k, 0));
      g.add(mesh(new THREE.TorusGeometry(0.07 * k, 0.012 * k, 8, 24), gold(), 0, 0.92 * k, 0));
      for (const s of [-1, 1]) { const p = mesh(taper([[0, 0, 0], [s * 0.05 * k, 0.06 * k, 0], [s * 0.04 * k, 0.14 * k, 0]], 0.012 * k, 0.003 * k, 10, 6), gold(), 0, 0.88 * k, 0); g.add(p); }
      return g;
    },
    blaster: a => {
      const k = a.k * 1.6, g = new THREE.Group(), o = std('#ff8a3d', { roughness: 0.35 }), t = std('#22c3e6', { roughness: 0.35 });
      g.add(mesh(rbox(0.07 * k, 0.12 * k, 0.05 * k, 0.02 * k), t, 0, -0.02 * k, -0.03 * k));         // grip
      const b = mesh(rbox(0.09 * k, 0.24 * k, 0.1 * k, 0.03 * k), o, 0, 0.09 * k, 0.03 * k); g.add(b); // body along +Y
      const br = mesh(new THREE.CylinderGeometry(0.025 * k, 0.03 * k, 0.12 * k, 16), t, 0, 0.26 * k, 0.04 * k); g.add(br);
      g.add(mesh(new THREE.TorusGeometry(0.03 * k, 0.01 * k, 8, 16), glow('#7cff6b', 2.5), 0, 0.32 * k, 0.04 * k).rotateX(Math.PI / 2));
      g.add(mesh(new THREE.SphereGeometry(0.03 * k, 12, 8), glow('#ffd23f', 1.2), 0, 0.12 * k, 0.09 * k));
      return g;
    },
    board: a => {
      const k = a.k, g = new THREE.Group(), tex = stripes('#ff5d8f', '#ffd23f', 6, true);
      const deck = mesh(rbox(0.2 * k, 0.78 * k, 0.025 * k, 0.09 * k), std('#ffffff', { map: tex, roughness: 0.5 }), 0, 0, 0.03 * k); g.add(deck);
      for (const y of [-0.27, 0.27]) for (const x of [-0.07, 0.07]) { const w = mesh(new THREE.CylinderGeometry(0.03 * k, 0.03 * k, 0.03 * k, 14), std('#3ab795'), x * k, y * k, -0.02 * k); w.rotation.z = Math.PI / 2; g.add(w); }
      g.position.x = -0.0; return g;
    },
    guitar: a => {
      const k = a.k * 1.3, g = new THREE.Group(), s = new THREE.Shape();
      s.moveTo(0, 0); s.bezierCurveTo(0.2, 0, 0.2, 0.16, 0.1, 0.2); s.bezierCurveTo(0.17, 0.27, 0.15, 0.4, 0.04, 0.38); s.lineTo(-0.04, 0.38);
      s.bezierCurveTo(-0.15, 0.4, -0.17, 0.27, -0.1, 0.2); s.bezierCurveTo(-0.2, 0.16, -0.2, 0, 0, 0);
      const body = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }); body.scale(k, k, k);
      g.add(mesh(body, std('#e63946', { roughness: 0.25, metalness: 0.2 }), 0, 0.42 * k, -0.025 * k));
      g.add(mesh(new THREE.BoxGeometry(0.045 * k, 0.42 * k, 0.03 * k), std('#3b2416', { roughness: 0.6 }), 0, 0.2 * k, 0));
      g.add(mesh(rbox(0.07 * k, 0.1 * k, 0.025 * k, 0.02 * k), std('#1a1a1a'), 0, -0.04 * k, 0));
      g.add(mesh(new THREE.BoxGeometry(0.14 * k, 0.03 * k, 0.012 * k), std('#f1faee'), 0, 0.68 * k, 0.03 * k));
      return g;
    },
    lantern: a => {
      const k = a.k * 1.5, g = new THREE.Group(), m = std('#2b2d42', { metalness: 0.7, roughness: 0.4 });
      g.add(mesh(new THREE.TorusGeometry(0.035 * k, 0.007 * k, 8, 20, Math.PI), m, 0, -0.035 * k, 0).rotateZ(Math.PI));
      g.add(mesh(new THREE.ConeGeometry(0.075 * k, 0.05 * k, 6), m, 0, -0.06 * k, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.05 * k, 0.05 * k, 0.12 * k, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd58a', emissive: '#ffb347', emissiveIntensity: 2.5, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), 0, -0.145 * k, 0));
      for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2; g.add(mesh(new THREE.BoxGeometry(0.008 * k, 0.13 * k, 0.008 * k), m, Math.cos(ang) * 0.055 * k, -0.145 * k, Math.sin(ang) * 0.055 * k)); }
      g.add(mesh(new THREE.CylinderGeometry(0.07 * k, 0.06 * k, 0.025 * k, 6), m, 0, -0.215 * k, 0));
      return g;
    },
    scythe: a => {
      const k = a.k, g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.018 * k, 0.022 * k, 1.5 * k, 10), std('#2b2235', { roughness: 0.6 }), 0, 0.2 * k, 0));
      const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.2, 0.12, 0.42, 0.06, 0.55, -0.12); s.bezierCurveTo(0.38, -0.02, 0.18, 0.0, 0, -0.06); s.closePath();
      const bl = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.008, bevelSegments: 1 }); bl.scale(k, k, k);
      const b = mesh(bl, std('#bfc8d6', { metalness: 1, roughness: 0.2 }), 0, 0.92 * k, 0); b.rotation.y = -Math.PI / 2; g.add(b);
      g.add(mesh(new THREE.SphereGeometry(0.03 * k, 12, 8), glow('#7cff6b', 2), 0, 0.96 * k, 0));
      return g;
    },
    ball: a => {
      const k = a.k, g = new THREE.Group(), R = 0.12 * k;
      g.add(mesh(new THREE.SphereGeometry(R, 32, 20), std('#f07b24', { roughness: 0.75 }), 0, 0, 0));
      const ln = std('#2a1a10', { roughness: 0.8 });
      g.add(mesh(new THREE.TorusGeometry(R * 1.005, R * 0.03, 6, 40), ln));
      g.add(mesh(new THREE.TorusGeometry(R * 1.005, R * 0.03, 6, 40), ln).rotateY(Math.PI / 2));
      g.add(mesh(new THREE.TorusGeometry(R * 1.005, R * 0.03, 6, 40), ln).rotateX(Math.PI / 2));
      g.position.set(0, 0, R * 0.9); return g;
    },
    shield: a => {
      const k = a.k, g = new THREE.Group(), R = 0.24 * k;
      const wood = mesh(new THREE.CylinderGeometry(R, R, 0.04 * k, 40), std('#9c5b2e', { roughness: 0.7 }), 0, 0, 0.05 * k); wood.rotation.x = Math.PI / 2; g.add(wood);
      g.add(mesh(new THREE.TorusGeometry(R, 0.02 * k, 10, 48), std('#c0c7d1', { metalness: 0.9, roughness: 0.3 }), 0, 0, 0.05 * k));
      const st = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.045 : 0.11, ang = i / 10 * Math.PI * 2 + Math.PI / 2; st[i ? 'lineTo' : 'moveTo'](Math.cos(ang) * r * k, Math.sin(ang) * r * k); }
      g.add(mesh(new THREE.ExtrudeGeometry(st, { depth: 0.015 * k, bevelEnabled: true, bevelThickness: 0.005 * k, bevelSize: 0.005 * k, bevelSegments: 1 }), gold(), 0, 0, 0.07 * k));
      g.add(mesh(new THREE.SphereGeometry(0.035 * k, 16, 10), std('#c0c7d1', { metalness: 0.9, roughness: 0.25 }), 0, 0, 0.09 * k));
      return g;
    },
  };

  function wings(a, bat) {
    const T = a.TW * 1.9, g = new THREE.Group();
    if (!bat) {
      const m = std('#fbfcff', { roughness: 0.55 }), tip = std('#ffe9a8', { roughness: 0.5 });
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const t = i / 8, len = T * (0.55 + 0.5 * Math.sin(t * Math.PI * 0.9 + 0.2));
          const f = mesh(new THREE.SphereGeometry(1, 16, 10), i > 6 ? tip : m); f.scale.set(len * 0.5, T * 0.07, T * 0.025);
          const p = new THREE.Group(); p.add(f); f.position.x = len * 0.45;
          p.rotation.z = 1.05 - t * 1.5; p.position.set(t * T * 0.1, -t * T * 0.05, -t * T * 0.02); w.add(p);
        }
        w.scale.x = s; w.position.set(s * a.TW * 0.1, a.TH * 0.2, -a.TW * 0.15); w.rotation.y = s * -0.35; g.add(w);
      }
    } else {
      const m = std('#3a1f4f', { roughness: 0.5, side: THREE.DoubleSide }), bone = std('#1c0f28', { roughness: 0.4 });
      for (const s of [-1, 1]) {
        const sh = new THREE.Shape(), L = T * 1.15, H = T * 0.75;
        sh.moveTo(0, 0); sh.lineTo(L * 0.35, H * 0.45); sh.lineTo(L, H * 0.55);
        sh.quadraticCurveTo(L * 0.86, H * 0.1, L * 0.8, -H * 0.25); sh.quadraticCurveTo(L * 0.66, -H * 0.05, L * 0.55, -H * 0.35);
        sh.quadraticCurveTo(L * 0.42, -H * 0.1, L * 0.3, -H * 0.4); sh.quadraticCurveTo(L * 0.18, -H * 0.1, 0, -H * 0.15); sh.closePath();
        const geo = new THREE.ExtrudeGeometry(sh, { depth: T * 0.01, bevelEnabled: false });
        const w = new THREE.Group(); w.add(mesh(geo, m));
        w.add(mesh(taper([[0, 0, 0], [L * 0.35, H * 0.45, 0], [L, H * 0.55, 0]], T * 0.035, T * 0.012, 16, 6), bone));
        w.scale.x = s; w.position.set(s * a.TW * 0.08, a.TH * 0.15, -a.TW * 0.12); w.rotation.y = s * -0.5; g.add(w);
      }
    }
    return g;
  }

  return { loadCharacter, measure, mount, buildItem, tint, hueUniforms, patchHue, lockRootMotion, SLOT_BONE };
}

// Strut Off — models and outfits. A model is a Hero Lab character (kit/heroparts) whose outfit is restyled in code:
//   colour  : the character's own main hue is measured from its texture, then shifted onto the swatch (skin locked)
//   fabric  : roughness/metalness override + shader layers (glitter, neon, pearl, velvet sheen, polka, stripes), outfit only
//   4 slots : Hero Lab items (GLB + code-built) and our own pieces (cozy-library t-models + code), mounted on bones
// Items stay attached once built and are shown/hidden, so swapping is instant and shared GPU data is never freed.
import { createParts } from './kit/heroparts.js';
import { heroAssets } from './kit/heroes.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from './kit/addons/environments/RoomEnvironment.js';
import { COLOURS, FINISHES, ITEMS, ACC, itemById, colourById, finishById, LOCAL_CHARS } from './data.js';

let THREE, GLTFLoader, P, loader;
const PROTO = {};          // cozy t-models, normalised (largest side 1, centred, resting on y = 0)
export const anim = [];    // per-frame item animations (wing flaps)
const clock = { t: 0 };
export function tickDress(dt) { clock.t += dt; for (const a of anim) a(clock.t); for (const u of FU_ALL) u.uTime.value = clock.t; }
const FU_ALL = new Set();

export function initDress(T, GL) {
  THREE = T; GLTFLoader = GL; loader = new GLTFLoader();
  const local = new Set(LOCAL_CHARS);
  P = createParts(THREE, GLTFLoader, null, {
    assets: './assets/heroes/',
    charUrl: id => (local.has(id) ? `./assets/heroes/game/chars/${id}.glb` : `${heroAssets()}game/chars/${id}.glb`),
    itemUrl: id => `./assets/heroes/game/items/${id}.glb`,
  });
  return P;
}
// never hang the boot on one file: each load gets a deadline, a failed/stalled prop becomes an empty placeholder
export const withTimeout = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + what)), ms))]);
export async function loadProps(ids, onEach) {
  await Promise.all(ids.map(id => withTimeout(loader.loadAsync(`./assets/${id}.glb`), 15000, id)
    .then(g => { PROTO[id] = norm(g.scene); })
    .catch(e => { console.warn('prop', id, e && e.message); const o = new THREE.Group(); o.userData.size = new THREE.Vector3(1, 1, 1); PROTO[id] = o; })
    .finally(() => onEach && onEach(id))));
}
// the cozy GLBs are stored Z-up: stand them up (+90° about X), centre on x/z, rest on y = 0, largest side = 1
export function norm(scene) {
  scene.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(scene); w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  scene.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(1 / Math.max(sz.x, sz.y, sz.z));
  const root = new THREE.Group(); root.add(w);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const m = o.material; if (m && m.metalness > 0.6) m.metalness = 0.6; } });
  root.userData.size = new THREE.Vector3(sz.x, sz.y, sz.z).multiplyScalar(1 / Math.max(sz.x, sz.y, sz.z));
  return root;
}
export const proto = id => PROTO[id];
const prop = id => { const o = PROTO[id].clone(); o.userData.size = PROTO[id].userData.size; return o; };

// ------------------------------------------------------------------ outfit shader (on top of heroparts' hue shift)
const FIN_GLSL = `
uniform vec4 uFin; uniform vec4 uFin2; uniform float uTime;
float so_m = 0.;
float so_mask(vec3 lin){ vec3 c = pow(max(lin, vec3(0.)), vec3(1./2.2)); vec3 h = hl_rgb2hsv(c);
  float skin = (1. - smoothstep(0.075, 0.125, h.x)) * smoothstep(0.12, 0.25, h.y) * (1. - smoothstep(0.6, 0.75, h.y)) * smoothstep(0.1, 0.22, h.z);
  return smoothstep(0.1, 0.26, h.y) * (1. - skin); }
float so_hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;
function patchFinish(m, FU) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    prev(sh);
    Object.assign(sh.uniforms, FU);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', FIN_GLSL + '\nvoid main() {')
      .replace('sampledDiffuseColor.rgb = hl_shift(sampledDiffuseColor.rgb);', `so_m = so_mask(sampledDiffuseColor.rgb);
        sampledDiffuseColor.rgb = hl_shift(sampledDiffuseColor.rgb);
        if (uFin2.y > 0.5) { vec2 g = vMapUv * 46.; vec2 f = fract(g + vec2(step(1., mod(floor(g.y), 2.)) * 0.5, 0.)) - 0.5;
          float d = smoothstep(0.24, 0.2, length(f)); float st = smoothstep(0.45, 0.5, abs(fract(vMapUv.x * 26.) - 0.5) * 2.);
          float pat = uFin2.y < 1.5 ? d : st; sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.95, 0.93, 0.9), pat * so_m * 0.85); }
        sampledDiffuseColor.rgb *= mix(1., uFin2.w, so_m);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n if (uFin.x >= 0.) roughnessFactor = mix(roughnessFactor, uFin.x, so_m);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n if (uFin.y >= 0.) metalnessFactor = mix(metalnessFactor, uFin.y, so_m);')
      .replace('#include <opaque_fragment>', `{
        vec3 so_V = normalize(vViewPosition); float so_fr = pow(1. - abs(dot(normalize(normal), so_V)), 2.);
        outgoingLight += so_m * uFin.w * diffuseColor.rgb * (1.1 + 0.25 * sin(uTime * 3.));
        vec2 gg = floor(vMapUv * 380.); float hh = so_hash(gg); float tw = step(0.9, hh) * pow(0.5 + 0.5 * sin(uTime * 4. + hh * 70.), 6.);
        outgoingLight += so_m * uFin.z * tw * vec3(1., 0.94, 0.86) * 3.2;
        outgoingLight += so_m * uFin2.x * so_fr * (0.55 + 0.45 * cos(6.2831 * (so_fr * 1.4 + vec3(0., 0.33, 0.67)))) * 0.75;
        outgoingLight += so_m * uFin2.z * so_fr * diffuseColor.rgb * 1.3;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'hl1-so2';
  m.needsUpdate = true;
}

// main hue of the outfit (saturated, non-skin texels of the base colour texture)
const DOM = new Map();
function dominant(root) {
  const key = root.name; if (DOM.has(key)) return DOM.get(key);
  let img = null; root.traverse(o => { if (!img && o.isMesh && o.material?.map?.image) img = o.material.map.image; });
  let res = { h: 0.95, s: 0.5, v: 0.7 };
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 64, 64); const d = x.getImageData(0, 0, 64, 64).data;
    let sx = 0, sy = 0, w = 0, ss = 0, vv = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0;
      if (s < 0.26 || v < 0.12) continue;
      let h = 0; const dd = mx - mn;
      if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h = ((h / 6) + 1) % 1;
      const skin = h > 0.02 && h < 0.11 && s < 0.6 && v > 0.35; if (skin) continue;
      const wt = s * v; sx += Math.cos(h * 6.2832) * wt; sy += Math.sin(h * 6.2832) * wt; w += wt; ss += s; vv += v; n++;
    }
    if (w > 0) res = { h: ((Math.atan2(sy, sx) / 6.2832) + 1) % 1, s: ss / n, v: vv / n };
  } catch (e) {}
  DOM.set(key, res); return res;
}
// which named swatch the model's own colour reads as (its tags score for "Signature")
export function sigSwatch(dom) {
  const pool = COLOURS.filter(c => c.h != null && c.s > 0.5 && c.id !== 'sand');
  let best = pool[0], bd = 9;
  for (const c of pool) { let d = Math.abs(c.h - dom.h); d = Math.min(d, 1 - d); if (d < bd) { bd = d; best = c; } }
  return best;
}

// ------------------------------------------------------------------ a model
export async function createModel(charId, { height = 1.75, sig = null } = {}) {
  const ch = await P.loadCharacter(charId, { colors: { hue: sig?.hue ?? 0, sat: sig?.sat ?? 1, bri: sig?.bri ?? 1, lock: 1 } });
  ch.root.position.y = -(ch.M.idle?.minY ?? ch.M.minY);
  const FU = { uFin: { value: new THREE.Vector4(-1, -1, 0, 0) }, uFin2: { value: new THREE.Vector4(0, 0, 0, 1) }, uTime: { value: 0 } };
  FU_ALL.add(FU);
  const mats = [];
  ch.root.traverse(o => { if (o.isMesh) { for (const m of [].concat(o.material)) { patchFinish(m, FU); mats.push(m); } } });
  const inner = new THREE.Group(); inner.add(ch.root); const k = height / ch.M.height; inner.scale.setScalar(k);
  const object = new THREE.Group(); object.add(inner);
  const mixer = new THREE.AnimationMixer(ch.root), actions = {};
  for (const [n, c] of Object.entries(ch.clips)) actions[n] = mixer.clipAction(c);
  const dom = dominant(ch.root), sigSw = sigSwatch(dom);
  let cur = null, curName = '';
  const M = {
    id: charId, object, ch, mixer, actions, height, dom, sigSw, sigTags: sigSw.tags, sig: sig || { hue: 0, sat: 1, bri: 1 }, FU,
    held: {}, slotTok: {}, outfit: { colour: 'sig', finish: null, head: null, face: null, back: null, hand: null },
    get clip() { return curName; },
    play(name, { fade = 0.22, once, ts = 1, at = 0 } = {}) {
      const a = actions[name]; if (!a) return null;
      const one = once ?? ['jump', 'slide', 'cheer', 'fall'].includes(name);
      a.timeScale = ts;
      if (a === cur && !one) return a;
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(one ? THREE.LoopOnce : THREE.LoopRepeat, one ? 1 : Infinity); a.clampWhenFinished = one;
      if (at) a.time = at;
      a.play(); if (cur && cur !== a) cur.crossFadeTo(a, fade, false);
      cur = a; curName = name; return a;
    },
    setColour(id) {
      const c = colourById(id) || COLOURS[0]; M.outfit.colour = c.id; const U = ch.U;
      if (c.h == null) { U.uHue.value = M.sig.hue; U.uSat.value = M.sig.sat; U.uBri.value = M.sig.bri; }
      else {
        U.uHue.value = c.h - dom.h;
        // grey-ish outfits need a real saturation lift to take a colour; very bright ones are calmed down
        U.uSat.value = c.s * (dom.s < 0.45 ? 0.45 / Math.max(0.2, dom.s) : 1);
        U.uBri.value = c.b * (dom.v > 0.85 && c.b > 1 ? 0.92 : 1) * (dom.v < 0.45 && c.b > 0.6 ? 1.35 : 1);
      }
    },
    setFinish(id) {
      const f = finishById(id); M.outfit.finish = f ? f.id : null;
      const a = FU.uFin.value, b = FU.uFin2.value;
      if (!f) { a.set(-1, -1, 0, 0); b.set(0, 0, 0, 1); return; }
      a.set(f.rough ?? -1, f.metal ?? -1, f.glitter || 0, (f.neon || 0) * 0.55);
      b.set(f.pearl || 0, f.pat || 0, f.velvet || 0, f.bri || 1);
    },
    async setItem(slot, id) {
      const tok = (M.slotTok[slot] = (M.slotTok[slot] || 0) + 1);
      M.outfit[slot] = id || null;
      for (const [iid, h] of Object.entries(M.held)) if (h.userData.slot === slot) h.visible = false;
      if (!id) return null;
      let h = M.held[id];
      if (!h) {
        h = await buildMounted(ch, id); if (!h) return null;
        h.userData.slot = slot; M.held[id] = h; h.visible = false;
      }
      if (tok !== M.slotTok[slot]) return null;
      h.visible = true; return h;
    },
    async wear(o) {
      M.setColour(o.colour || 'sig'); M.setFinish(o.finish || null);
      await Promise.all(ACC.map(s => M.setItem(s, o[s] || null)));
    },
    headPos(v = new THREE.Vector3()) { object.updateMatrixWorld(true); const b = ch.root.getObjectByName('Head'); if (b) b.getWorldPosition(v); else v.setFromMatrixPosition(object.matrixWorld).y += height; return v; },
  };
  M.setColour('sig');
  return M;
}

async function buildMounted(ch, id) {
  const def = itemById(id); if (!def) return null;
  try {
    if (def.hl) { const b = await P.buildItem(def.hl, ch.M); if (!b) return null; const slot = b.def.slot === 'offhand' ? 'offhand' : def.slot; return P.mount(ch, slot, b.obj, b.def); }
    const b = MY[def.my](ch.M); return P.mount(ch, def.slot, b.obj, b.def || {});
  } catch (e) { console.warn('item', id, e); return null; }
}
export async function buildLoose(id, M) {          // an unmounted copy (for wardrobe thumbnails)
  const def = itemById(id);
  if (def.hl) { const b = await P.buildItem(def.hl, M); return b && b.obj; }
  return MY[def.my](M).obj;
}

// ------------------------------------------------------------------ our own pieces (built in each slot's anchor space)
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ni = g => (g.index ? g.toNonIndexed() : g);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05, ...o });
const gold = () => std('#f4bf3a', { metalness: 0.9, roughness: 0.22 });
function fitProp(id, size, axis = 'max') {   // a cozy prop scaled so its `axis` size equals `size`
  const o = prop(id), s = o.userData.size, d = axis === 'x' ? s.x : axis === 'y' ? s.y : Math.max(s.x, s.y, s.z);
  o.scale.setScalar(size / d); o.userData.dims = s.clone().multiplyScalar(size / d); return o;
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const MY = {
  flowercrown(M) {
    const H = M.head, r = Math.max(H.W, H.D * 0.85) * 0.53, fs = H.W * 0.12, n = 11;
    const petal = new THREE.SphereGeometry(1, 10, 8); petal.scale(0.55, 0.2, 1); petal.translate(0, 0, 0.75);
    const parts = []; for (let i = 0; i < 5; i++) { const g = petal.clone(); g.rotateY(i / 5 * Math.PI * 2); parts.push(g); }
    const flower = mergeGeometries(parts); flower.rotateX(-Math.PI / 2 + 0.35);
    const pet = new THREE.InstancedMesh(flower, std('#ffffff', { roughness: 0.55 }), n), mid = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), std('#ffd23f', { roughness: 0.6 }), n);
    const leafG = new THREE.SphereGeometry(1, 8, 6); leafG.scale(0.35, 0.1, 1);
    const leaf = new THREE.InstancedMesh(leafG, std('#5fbf6a', { roughness: 0.6 }), n);
    const cols = ['#ff8fb8', '#ffffff', '#ffd1e3', '#c9a6ff', '#ff6f9c', '#fff2a8'], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, p = V(Math.sin(a) * r, -H.H * 0.24 + Math.cos(a) * H.H * 0.05, Math.cos(a) * r * 1.05);
      e.set(0, a, 0); q.setFromEuler(e); const s = fs * (0.85 + (i % 3) * 0.15);
      m4.compose(p, q, V(s, s, s)); pet.setMatrixAt(i, m4); pet.setColorAt(i, new THREE.Color(cols[i % cols.length]));
      m4.compose(p.clone().add(V(Math.sin(a) * s * 0.25, s * 0.18, Math.cos(a) * s * 0.25)), q, V(s, s, s)); mid.setMatrixAt(i, m4);
      const a2 = a + Math.PI / n; e.set(0.4, a2 + Math.PI / 2, 0); q.setFromEuler(e);
      m4.compose(V(Math.sin(a2) * r * 1.02, -H.H * 0.26, Math.cos(a2) * r * 1.05), q, V(fs, fs, fs)); leaf.setMatrixAt(i, m4);
    }
    const g = new THREE.Group(); g.add(pet, mid, leaf); g.rotation.x = -0.12; return { obj: g };
  },
  tiara(M) {
    const H = M.head, r = Math.max(H.W, H.D * 0.85) * 0.5;
    const band = new THREE.TorusGeometry(r, H.W * 0.045, 10, 40, Math.PI * 1.05); band.rotateX(Math.PI / 2); band.rotateY(-Math.PI * 0.025 + Math.PI);
    const spikes = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.42 + i / 6 * Math.PI * 0.84, h = H.H * (i === 3 ? 0.34 : i % 2 ? 0.16 : 0.24);
      const s = new THREE.ConeGeometry(H.W * 0.075, h, 6); s.translate(0, h / 2, 0); s.rotateX(0.25); s.translate(Math.sin(a) * r, 0, Math.cos(a) * r); spikes.push(s);
    }
    const goldG = mergeGeometries([ni(band), ...spikes.map(ni)]);
    const gems = [];
    for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.42 + i / 6 * Math.PI * 0.84, h = H.H * (i === 3 ? 0.34 : i % 2 ? 0.16 : 0.24); const gm = new THREE.OctahedronGeometry(H.W * (i === 3 ? 0.1 : 0.065)); gm.translate(Math.sin(a) * r * 1.03, h * 0.45 + H.H * 0.02, Math.cos(a) * r * 1.03); gems.push(ni(gm)); }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(goldG, gold()), new THREE.Mesh(mergeGeometries(gems), new THREE.MeshPhysicalMaterial({ color: '#ff5fa8', roughness: 0.05, metalness: 0, clearcoat: 1, emissive: '#ff2f8e', emissiveIntensity: 0.6 })));
    g.position.y = -H.H * 0.2; g.rotation.x = -0.2; return { obj: g };
  },
  sunhat(M) {
    const H = M.head, R = Math.max(H.W, H.D) * 0.52, pts = [];
    pts.push(V(R * 2.3, -H.H * 0.02), V(R * 2.1, H.H * 0.03), V(R * 1.5, H.H * 0.05), V(R * 1.04, H.H * 0.07), V(R * 0.98, H.H * 0.36), V(R * 0.85, H.H * 0.5), V(0.001, H.H * 0.53));
    const straw = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#f0d49a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? 'rgba(160,110,50,.18)' : 'rgba(255,255,255,.18)'; x.fillRect(0, i * 6.4, w, 3); x.fillRect(i * 6.4, 0, 3, h); } });
    straw.wrapS = straw.wrapT = THREE.RepeatWrapping; straw.repeat.set(4, 2);
    const hat = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), std('#ffffff', { map: straw, roughness: 0.85, side: THREE.DoubleSide }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.0, R * 1.04, H.H * 0.12, 40, 1, true), std('#ff7aa8', { roughness: 0.35 }));
    band.position.y = H.H * 0.14;
    const g = new THREE.Group(); g.add(hat, band); g.position.set(0, -H.H * 0.36, -H.D * 0.02); g.rotation.set(-0.12, 0, 0.08); return { obj: g };
  },
  bow(M) {
    const H = M.head, s = H.W * 0.26, lobe = new THREE.SphereGeometry(1, 18, 12); lobe.scale(1, 0.62, 0.45);
    const L = lobe.clone(); L.translate(-0.9, 0, 0); L.rotateZ(0.2); const R = lobe.clone(); R.translate(0.9, 0, 0); R.rotateZ(-0.2);
    const knot = new THREE.SphereGeometry(0.42, 14, 10);
    const tail1 = new THREE.ConeGeometry(0.28, 1.2, 8); tail1.translate(0, -0.6, 0); tail1.rotateZ(0.5);
    const tail2 = new THREE.ConeGeometry(0.28, 1.2, 8); tail2.translate(0, -0.6, 0); tail2.rotateZ(-0.5);
    const geo = mergeGeometries([L, R, knot, tail1, tail2].map(ni));
    const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#ff5f9a', roughness: 0.32, sheen: 1, sheenColor: new THREE.Color('#ffd0e4'), clearcoat: 0.4 }));
    m.scale.setScalar(s); m.position.set(H.W * 0.22, -H.H * 0.12, -H.D * 0.12); m.rotation.set(0.2, 0.5, -0.35);
    const g = new THREE.Group(); g.add(m); return { obj: g };
  },
  clip(M) {
    const H = M.head, o = fitProp('t24', H.W * 0.5); o.position.set(H.W * 0.36, -H.H * 0.3, H.D * 0.05); o.rotation.set(0, 1.1, 0.3);
    const g = new THREE.Group(); g.add(o); flap(o, 0.18, 2.2); return { obj: g };
  },
  hearts(M) {
    const H = M.head, o = fitProp('t15', H.W * 1.18, 'x'), d = o.userData.dims;
    o.position.set(0, -d.y * 0.5, -d.z + H.W * 0.08);
    const g = new THREE.Group(); g.add(o); return { obj: g };
  },
  bwings(M) {
    const C = M.chest, o = fitProp('t24', C.W * 2.9, 'x'), d = o.userData.dims;
    o.position.set(0, -d.y * 0.42, -d.z * 0.5 - C.W * 0.06);
    const piv = new THREE.Group(); piv.add(o); flap(piv, 0.14, 2.6, 'x');
    const g = new THREE.Group(); g.add(piv); return { obj: g };
  },
  bag(M) {
    const o = fitProp('t14', 0.24 * M.k, 'y'), d = o.userData.dims; o.position.set(0, -d.y + 0.03 * M.k, 0);
    const g = new THREE.Group(); g.add(o); return { obj: g, def: { hand: { tip: [0, 1, 0], face: [-1, 0, 0], off: [0, -0.02, 0] } } };
  },
  sunflower(M) {
    const o = fitProp('t28', 0.46 * M.k, 'y'), d = o.userData.dims; o.position.set(0, -d.y * 0.28, 0);
    const g = new THREE.Group(); g.add(o); return { obj: g, def: { hand: { tip: [0.12, 1, 0.3], face: [0, 0, 1] } } };
  },
  perfume(M) {
    const o = fitProp('t12', 0.15 * M.k, 'y'); o.position.set(0, -0.06 * M.k, 0);
    const g = new THREE.Group(); g.add(o); return { obj: g, def: { hand: { tip: [0, 1, 0.15], face: [0, 0, 1] } } };
  },
  parasol(M) {
    const k = M.k, L = 1.0 * k, g = new THREE.Group();
    const lace = canvasTex(256, 64, (x, w, h) => { const c = ['#ffb3cd', '#ffffff']; for (let i = 0; i < 8; i++) { x.fillStyle = c[i % 2]; x.fillRect(i * w / 8, 0, w / 8, h); } x.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 32; i++) { x.beginPath(); x.arc(i * 8 + 4, h - 3, 3, 0, 7); x.fill(); } });
    const can = new THREE.Mesh(new THREE.ConeGeometry(0.44 * k, 0.2 * k, 16, 1, true), std('#ffffff', { map: lace, side: THREE.DoubleSide, roughness: 0.7 }));
    can.position.y = L * 0.8; g.add(can);
    const frill = new THREE.Mesh(new THREE.TorusGeometry(0.44 * k, 0.018 * k, 6, 48), std('#fff4f8', { roughness: 0.8 })); frill.rotation.x = Math.PI / 2; frill.position.y = L * 0.8 - 0.1 * k; g.add(frill);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * k, 0.012 * k, L, 8), gold()); shaft.position.y = L * 0.5 - 0.1 * k; g.add(shaft);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05 * k, 0.014 * k, 8, 20, Math.PI), std('#8a4b2a', { roughness: 0.4 })); hook.position.set(0.05 * k, -0.1 * k, 0); hook.rotation.z = Math.PI; g.add(hook);
    g.position.y = -0.12 * k;
    return { obj: g, def: { hand: { tip: [0.2, 1, -0.35], face: [0, 0, 1] } } };
  },
  fan(M) {
    const k = M.k, r = 0.22 * k;
    const tex = canvasTex(256, 128, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff4f7b'); gr.addColorStop(1, '#b8123f'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; x.fillRect(i * w / 16, 0, w / 16, h); }
      x.fillStyle = '#ffd36b'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(30 + i * 48, 40 + (i % 2) * 16, 9, 0, 7); x.fill(); }
    });
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.RingGeometry(r * 0.25, r, 24, 1, 0, Math.PI), std('#ffffff', { map: tex, side: THREE.DoubleSide, roughness: 0.6 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006 * k, 6, 32, Math.PI), gold());
    g.add(leaf, rim); g.rotation.z = -0.2; g.position.y = 0.01 * k;
    return { obj: g, def: { hand: { tip: [0, 1, 0.25], face: [0, 0, 1] } } };
  },
};
function flap(o, amt, speed, axis = 'x') {
  const base = o.scale.clone(), ph = Math.random() * 6;
  anim.push(t => { if (!o.parent || !o.parent.visible && o.parent.parent && !o.parent.parent.visible) return; const f = 1 - amt * Math.abs(Math.sin(t * speed + ph)); if (axis === 'x') o.scale.set(base.x * f, base.y, base.z); });
}

// ------------------------------------------------------------------ wardrobe thumbnails (rendered once, cached)
let TR = null;
const THUMBS = new Map();
export async function itemThumb(id, M) {
  if (THUMBS.has(id)) return THUMBS.get(id);
  const p = (async () => {
    if (!TR) {
      const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); r.setSize(160, 160, false); r.setPixelRatio(1);
      r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
      const sc = new THREE.Scene(); const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; sc.environmentIntensity = 0.8;
      const sun = new THREE.DirectionalLight('#fff4ea', 2.2); sun.position.set(2, 3, 4); sc.add(sun, new THREE.HemisphereLight('#ffffff', '#ffd6e4', 0.9));
      TR = { r, sc, cam: new THREE.PerspectiveCamera(28, 1, 0.001, 100) };
    }
    const obj = await buildLoose(id, M); if (!obj) return '';
    const g = new THREE.Group(); g.add(obj); g.rotation.y = -0.55; TR.sc.add(g); g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(V()), s = bb.getSize(V()), rad = Math.max(s.x, s.y, s.z) * 0.62;
    TR.cam.position.set(c.x, c.y + rad * 0.25, c.z + rad / Math.tan(14 * Math.PI / 180)); TR.cam.lookAt(c); TR.cam.near = rad * 0.1; TR.cam.far = rad * 20; TR.cam.updateProjectionMatrix();
    TR.r.render(TR.sc, TR.cam);
    const url = TR.r.domElement.toDataURL('image/png');
    TR.sc.remove(g);
    return url;
  })();
  THUMBS.set(id, p); return p;
}

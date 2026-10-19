// Embersite models: everything drawn in code. Each rigid part is one merged mesh with vertex colours and a per-vertex
// "glow" attribute (visors, coils, lights), so a whole robot is a handful of draw calls with one material.
import { THREE } from './kit/cine.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
const V3 = THREE.Vector3, EUL = new THREE.Euler(), QT = new THREE.Quaternion();

// toon ramp (3 bands, like the stylized bar) + inverted-hull outlines pushed out along the normal
export const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const OUT = {};
export function outlineMat(w = .025, color = 0x1b1530) {
  const k = w + '_' + color; if (OUT[k]) return OUT[k];
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = s => { s.uniforms.uW = { value: w }; s.vertexShader = 'uniform float uW;\nvarying float vOD;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uW;').replace('#include <project_vertex>', '#include <project_vertex>\nvOD = -mvPosition.z;');
    s.fragmentShader = 'varying float vOD;\n' + s.fragmentShader.replace('void main() {', 'void main() {\nif (vOD < 4.0) discard;'); };
  m.customProgramCacheKey = () => 'outline'; return OUT[k] = m;
}
export function outline(mesh, w = .025) {
  if (mesh.isInstancedMesh) { const o = new THREE.InstancedMesh(mesh.geometry, outlineMat(w), mesh.count); o.instanceMatrix = mesh.instanceMatrix; o.boundingSphere = mesh.boundingSphere; o.position.copy(mesh.position); (mesh.parent || mesh).add(o); return o; }
  const o = new THREE.Mesh(mesh.geometry, outlineMat(w)); o.castShadow = false; mesh.add(o); return o;
}
export function glowMat({ glow = 5, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP, side });
  const u = m.userData = { glow: { value: glow }, flash: { value: 0 }, dark: { value: 1 } };
  m.onBeforeCompile = s => {
    s.uniforms.uGlow = u.glow; s.uniforms.uFlash = u.flash; s.uniforms.uDark = u.dark;
    s.vertexShader = 'attribute float aGlow;\nvarying float vGlow;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    s.fragmentShader = 'uniform float uGlow, uFlash, uDark;\nvarying float vGlow;\n' + s.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(1., uDark, 1. - vGlow);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * uGlow + vec3(1., .85, .7) * uFlash;');
  };
  m.customProgramCacheKey = () => 'glowtoon';
  return m;
}

const C = {
  gr: '#eef0f3', dk: '#2b3140', mid: '#7f8a9a', or: '#ff6a1f', or2: '#ffb12e', lt: '#c9d0da', red: '#ff2d55', amb: '#ffb020', cy: '#3fe6ff', grn: '#46ff7a', wht: '#ffffff', scr: '#121826',
  olive: '#3f8a5a', olive2: '#2e6b45', tan: '#d9a35a', gun: '#363e52', gun2: '#59647c', glove: '#2b3448', sleeve: '#2f6fd6', glass: '#9fe3ff',
};
class MB {
  constructor() { this.parts = []; }
  add(g, color, { glow = 0, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), QT.setFromEuler(EUL.set(rx, ry, rz)), new V3(sx, sy, sz)));
    const n = g.attributes.position.count, col = new Float32Array(n * 3), gl = new Float32Array(n), c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; gl[i] = glow; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
    this.parts.push(g); return this;
  }
  rbox(w, h, d, color, o = {}, r = Math.min(w, h, d) * .18) { return this.add(new RoundedBoxGeometry(w, h, d, 2, r), color, o); }
  box(w, h, d, color, o) { return this.add(new THREE.BoxGeometry(w, h, d), color, o); }
  cyl(rt, rb, h, color, o, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, o); }
  sph(r, color, o, ws = 12, hs = 8) { return this.add(new THREE.SphereGeometry(r, ws, hs), color, o); }
  // a tube (cable/hose) through points
  tube(pts, r, color, o) { return this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new V3(...p))), 12, r, 5), color, o); }
  geo() { const g = mergeGeometries(this.parts); g.computeBoundingSphere(); return g; }
}
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
const mesh = (g, m, shadow = true, ow = .028) => { const x = new THREE.Mesh(g, m); x.castShadow = shadow; x.receiveShadow = false; if (ow) outline(x, ow); return x; };

// ------------------------------------------------------------------ PICKET: bipedal patrol robot (≈2 m)
export function picket() {
  const G = once('picket', () => {
    const up = new MB();
    up.rbox(.46, .22, .32, C.gr).cyl(.07, .07, .25, C.dk, { y: .2 });
    up.rbox(.64, .5, .42, C.gr, { y: .52 }).rbox(.52, .28, .08, C.or, { y: .56, z: .22 }).box(.4, .03, .02, C.dk, { y: .47, z: .265 });
    for (const s of [-1, 1]) { up.box(.06, .3, .3, C.dk, { x: s * .33, y: .5 }); up.rbox(.22, .15, .32, C.or, { x: s * .41, y: .74 }); up.sph(.08, C.dk, { x: s * .36, y: .66 }); }
    up.rbox(.44, .42, .2, C.dk, { y: .52, z: -.29 }).box(.3, .04, .02, C.amb, { y: .62, z: -.4, glow: 1 }).box(.3, .04, .02, C.amb, { y: .52, z: -.4, glow: .6 });
    up.tube([[.15, .7, -.3], [.3, .55, -.25], [.36, .45, -.05]], .02, C.dk);
    // arms + rifle
    up.box(.1, .1, .34, C.mid, { x: .38, y: .5, z: .12, rx: -.7 }).box(.1, .1, .3, C.mid, { x: -.3, y: .48, z: .2, rx: -1.0, ry: .5 });
    up.rbox(.1, .15, .64, C.gun, { x: .2, y: .42, z: .4 }).cyl(.026, .026, .42, C.gun2, { x: .2, y: .45, z: .9, rx: Math.PI / 2 }, 8);
    up.cyl(.04, .04, .1, C.dk, { x: .2, y: .45, z: 1.1, rx: Math.PI / 2 }, 8).box(.02, .04, .42, C.amb, { x: .255, y: .45, z: .42, glow: 1 }).box(.06, .17, .09, C.dk, { x: .2, y: .29, z: .36, rx: .2 });
    // head
    up.cyl(.06, .08, .14, C.dk, { y: .84 }).rbox(.46, .36, .4, C.gr, { y: 1.02, z: .02 }, .09).rbox(.38, .25, .04, C.scr, { y: 1.01, z: .21 }, .015);
    for (const s of [-1, 1]) { up.sph(.05, C.red, { x: s * .085, y: 1.0, z: .232, sx: .9, sy: 1.25, sz: .35, glow: 1 }, 12, 8).box(.11, .022, .02, C.or, { x: s * .085, y: 1.085, z: .235, rz: s * .32, glow: .4 }); }
    up.rbox(.48, .07, .3, C.or, { y: 1.2, z: -.02 }).rbox(.12, .1, .18, C.or, { x: .25, y: 1.02, z: -.02 }).rbox(.12, .1, .18, C.or, { x: -.25, y: 1.02, z: -.02 });
    up.cyl(.01, .01, .32, C.dk, { x: -.14, y: 1.36, z: -.08 }, 4).sph(.03, C.red, { x: -.14, y: 1.53, z: -.08, glow: 1 }, 8, 6);
    const th = new MB(); th.rbox(.16, .46, .18, C.gr, { y: -.22 }).rbox(.17, .2, .05, C.or, { y: -.2, z: .1 }).sph(.085, C.dk, { y: -.46 });
    const sh = new MB(); sh.rbox(.13, .46, .15, C.gr, { y: -.23 }).rbox(.14, .26, .05, C.or2, { y: -.18, z: .085 }).rbox(.17, .08, .32, C.dk, { y: -.5, z: .06 });
    return { up: up.geo(), th: th.geo(), sh: sh.geo() };
  });
  const mat = glowMat({  }), root = new THREE.Group(), upper = mesh(G.up, mat); upper.position.y = 1.0; root.add(upper);
  const legs = [-1, 1].map(s => { const t = mesh(G.th, mat); t.position.set(s * .16, .98, 0); const k = mesh(G.sh, mat); k.position.y = -.46; t.add(k); root.add(t); return { t, k }; });
  return { root, upper, legs, mat, muzzle: new V3(.2, 1.45, 1.15), hits: [{ o: new V3(0, 1.5, 0), r: .44 }, { o: new V3(0, 2.03, .03), r: .25, crit: true }, { o: new V3(0, .62, 0), r: .36 }] };
}
// ------------------------------------------------------------------ STRIDER: quad-legged turret sentry
export function strider() {
  const G = once('strider', () => {
    const b = new MB();
    b.rbox(1.1, .42, .76, C.gr).rbox(.92, .12, .62, C.or, { y: .26 }).rbox(.4, .34, .3, C.gr, { y: .04, z: .5 });
    b.cyl(.13, .13, .06, C.scr, { y: .04, z: .66, rx: Math.PI / 2 }, 16).sph(.085, C.red, { y: .04, z: .69, sz: .4, glow: 1 }, 12, 8).add(new THREE.TorusGeometry(.13, .025, 6, 18), C.or, { y: .04, z: .68 });
    b.box(.8, .05, .02, C.amb, { y: -.08, z: .385, glow: .8 }).box(.6, .2, .1, C.dk, { y: 0, z: -.42 }).box(.04, .04, .5, C.amb, { x: .56, y: .05, glow: .7 }).box(.04, .04, .5, C.amb, { x: -.56, y: .05, glow: .7 });
    for (const s of [-1, 1]) for (const z of [-.3, .3]) b.sph(.1, C.dk, { x: s * .52, z });
    const t = new MB();
    t.cyl(.24, .26, .12, C.dk).rbox(.34, .22, .44, C.gr, { y: .16, z: .05 }).box(.36, .04, .2, C.or, { y: .29 });
    for (const s of [-1, 1]) t.cyl(.03, .03, .6, C.gun2, { x: s * .08, y: .16, z: .5, rx: Math.PI / 2 }, 8).cyl(.045, .045, .08, C.dk, { x: s * .08, y: .16, z: .8, rx: Math.PI / 2 }, 8);
    t.box(.02, .05, .3, C.red, { x: .18, y: .17, z: .1, glow: 1 }).box(.12, .1, .06, C.red, { y: .2, z: .28, glow: .3 });
    const u = new MB(); u.rbox(.56, .11, .11, C.gr, { x: .28 }).rbox(.4, .06, .13, C.or, { x: .28, y: .06 });
    const l = new MB(); l.rbox(.09, 1.1, .09, C.mid, { y: -.55 }).cyl(.07, .04, .12, C.dk, { y: -1.1 }, 8).sph(.07, C.dk);
    return { b: b.geo(), t: t.geo(), u: u.geo(), l: l.geo() };
  });
  const mat = glowMat({  }), root = new THREE.Group(), body = mesh(G.b, mat); body.position.y = .95; root.add(body);
  const turret = mesh(G.t, mat); turret.position.set(0, .3, -.05); body.add(turret);
  const legs = [];
  for (const [sx, sz] of [[1, .3], [1, -.3], [-1, .3], [-1, -.3]]) {
    const piv = new THREE.Group(); piv.position.set(sx * .52, 0, sz); piv.rotation.y = sx > 0 ? 0 : Math.PI; body.add(piv);
    const u = mesh(G.u, mat); u.rotation.z = .55; piv.add(u); const l = mesh(G.l, mat); l.position.x = .56; l.rotation.z = -.55; u.add(l);
    legs.push({ u, l, sx, sz });
  }
  return { root, body, turret, legs, mat, muzzle: new V3(0, 1.41, .9), hits: [{ o: new V3(0, .95, 0), r: .62 }, { o: new V3(0, 1.4, 0), r: .28 }, { o: new V3(0, .97, .55), r: .2, crit: true }] };
}
// ------------------------------------------------------------------ KESTREL: sniper drone
export function kestrel() {
  const G = once('kestrel', () => {
    const b = new MB();
    b.rbox(.62, .34, .84, C.gr).rbox(.5, .1, .6, C.or, { y: .17 }).cyl(.17, .17, .06, C.scr, { z: .42, rx: Math.PI / 2 }, 16).sph(.11, C.red, { z: .45, sz: .45, glow: 1 }, 12, 8).add(new THREE.TorusGeometry(.17, .03, 6, 18), C.or, { z: .44 });
    for (const [x, z] of [[.6, .5], [-.6, .5], [.6, -.5], [-.6, -.5]]) {
      b.box(.08, .06, Math.hypot(x, z), C.mid, { x: x / 2, z: z / 2, ry: Math.atan2(x, z) });
      b.add(new THREE.TorusGeometry(.32, .025, 6, 20), C.dk, { x, y: .06, z, rx: Math.PI / 2 }).cyl(.05, .05, .1, C.dk, { x, y: .04, z }, 8).sph(.025, C.amb, { x, y: -.03, z, glow: 1 }, 6, 4);
    }
    b.cyl(.025, .025, 1.5, C.gun2, { y: -.22, z: .55, rx: Math.PI / 2 }, 8).rbox(.12, .14, .5, C.gun, { y: -.22, z: .05 }).cyl(.04, .04, .3, C.dk, { y: -.08, z: .08, rx: Math.PI / 2 }, 8);
    b.box(.02, .03, .7, C.red, { x: .07, y: -.22, z: .4, glow: .8 });
    const disc = new THREE.CircleGeometry(.31, 20).rotateX(-Math.PI / 2); const ds = [];
    for (const [x, z] of [[.6, .5], [-.6, .5], [.6, -.5], [-.6, -.5]]) ds.push(disc.clone().translate(x, .08, z));
    return { b: b.geo(), d: mergeGeometries(ds) };
  });
  const mat = glowMat({  }), root = new THREE.Group(), body = mesh(G.b, mat); root.add(body);
  const blur = new THREE.Mesh(G.d, new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: .35, depthWrite: false })); body.add(blur);
  return { root, body, mat, muzzle: new V3(0, -.22, 1.3), hits: [{ o: new V3(0, 0, 0), r: .56, crit: true }] };
}
// ------------------------------------------------------------------ BULWARK: armored walker (≈5 m)
export function bulwark() {
  const G = once('bulwark', () => {
    const up = new MB();
    up.rbox(1.3, .55, 1, C.gr).cyl(.3, .35, .5, C.dk, { y: .4 });
    up.rbox(2.1, 1.35, 1.6, C.gr, { y: 1.05 }).rbox(1.7, .62, .22, C.or, { y: 1.12, z: .82 }).rbox(1.2, .3, .2, C.dk, { y: 1.5, z: .8 }).box(1.05, .2, .03, C.scr, { y: 1.52, z: .905 }).sph(.09, C.red, { x: -.25, y: 1.52, z: .92, sz: .4, glow: 1 }, 10, 8).sph(.09, C.red, { x: .25, y: 1.52, z: .92, sz: .4, glow: 1 }, 10, 8);
    up.rbox(1.9, .25, 1.4, C.or2, { y: 1.8 }).box(.04, .04, 1.3, C.amb, { x: .96, y: 1, glow: .8 }).box(.04, .04, 1.3, C.amb, { x: -.96, y: 1, glow: .8 });
    for (let i = 0; i < 4; i++) up.box(1.4, .06, .04, C.dk, { y: .6 + i * .12, z: .79 });
    // back reactor + cage (weak point)
    up.cyl(.36, .36, .5, C.cy, { y: 1.05, z: -.92, rx: Math.PI / 2, glow: 1 }, 16).cyl(.46, .46, .14, C.dk, { y: 1.05, z: -.82, rx: Math.PI / 2 }, 16);
    for (const a of [0, 1, 2, 3]) up.box(.06, .06, .58, C.mid, { x: Math.cos(a * 1.57 + .78) * .42, y: 1.05 + Math.sin(a * 1.57 + .78) * .42, z: -1.0 });
    // shoulder rocket pods
    for (const s of [-1, 1]) {
      up.rbox(.72, .62, .95, C.gr, { x: s * 1.32, y: 1.55 }).rbox(.74, .14, .97, C.or, { x: s * 1.32, y: 1.88 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) up.cyl(.09, .09, .06, i === 1 && j === 0 ? C.amb : C.dk, { x: s * 1.32 + (i - 1) * .2, y: 1.45 + j * .2, z: .48, rx: Math.PI / 2, glow: i === 1 && j === 0 ? .6 : 0 }, 8);
    }
    // right arm rotary cannon, left arm shield
    up.rbox(.5, .5, .7, C.dk, { x: 1.35, y: .75, z: .2 });
    for (let i = 0; i < 6; i++) up.cyl(.045, .045, 1.5, C.gun2, { x: 1.35 + Math.cos(i * 1.05) * .14, y: .7 + Math.sin(i * 1.05) * .14, z: 1.1, rx: Math.PI / 2 }, 6);
    up.cyl(.24, .24, .16, C.dk, { x: 1.35, y: .7, z: 1.8, rx: Math.PI / 2 }, 12).cyl(.24, .24, .16, C.dk, { x: 1.35, y: .7, z: .6, rx: Math.PI / 2 }, 12);
    up.rbox(.25, 1.4, 1.1, C.or, { x: -1.42, y: .75, z: .35 }).rbox(.2, .5, .5, C.dk, { x: -1.25, y: .9, z: 0 });
    const th = new MB(); th.rbox(.46, 1.3, .55, C.gr, { y: -.62 }).rbox(.5, .7, .12, C.or, { y: -.55, z: .3 }).sph(.24, C.dk, { y: -1.25 });
    const sh = new MB(); sh.rbox(.36, 1.3, .44, C.gr, { y: -.62, z: -.1, rx: .25 }).rbox(.4, .5, .1, C.or2, { y: -.5, z: .14, rx: .25 }).rbox(.8, .26, 1.1, C.dk, { y: -1.3, z: .05 }).rbox(.7, .1, .5, C.or, { y: -1.15, z: .4 });
    return { up: up.geo(), th: th.geo(), sh: sh.geo() };
  });
  const mat = glowMat({  }), root = new THREE.Group(), upper = mesh(G.up, mat); upper.position.y = 2.65; root.add(upper);
  const legs = [-1, 1].map(s => { const t = mesh(G.th, mat); t.position.set(s * .78, 2.6, 0); const k = mesh(G.sh, mat); k.position.y = -1.28; t.add(k); root.add(t); return { t, k }; });
  return { root, upper, legs, mat, muzzle: new V3(1.35, 3.35, 2), pods: [new V3(-1.32, 4.3, .6), new V3(1.32, 4.3, .6)], hits: [{ o: new V3(0, 3.75, .1), r: 1.25 }, { o: new V3(0, 1.6, 0), r: .95 }, { o: new V3(0, 3.7, -1.0), r: .5, crit: true }] };
}
// ------------------------------------------------------------------ HAULER: enemy dropship
export function hauler() {
  const G = once('hauler', () => {
    const b = new MB();
    b.rbox(3.2, 2, 8.5, C.gr).rbox(2.6, .5, 7, C.or, { y: 1.1 }).rbox(2.2, 1.2, 2.6, C.dk, { y: .2, z: 4.6, rx: .35 }).box(2, .1, .1, C.red, { y: .55, z: 5.9, glow: 1 });
    b.box(2.6, 1.6, .2, C.dk, { y: -.2, z: -4.3 }).rbox(.3, 2, 2.6, C.gr, { y: 1.6, z: -3.6 }).rbox(4.6, .2, 1.6, C.gr, { y: .9, z: -3.8 });
    for (const s of [-1, 1]) {
      b.box(1.5, .5, 1.6, C.mid, { x: s * 2.1, y: .4 }).cyl(.95, 1.05, 2.4, C.gr, { x: s * 3.1, y: .3 }, 14).cyl(.98, .98, .3, C.or, { x: s * 3.1, y: 1.1 }, 14);
      b.cyl(.75, .75, .1, C.amb, { x: s * 3.1, y: -.92, glow: 1 }, 14).sph(.08, s > 0 ? C.grn : C.red, { x: s * 3.1, y: 1.4, z: 0, glow: 1 }, 6, 4);
    }
    return b.geo();
  });
  const mat = glowMat({ glow: 6 }), root = new THREE.Group(), body = mesh(G, mat); root.add(body);
  return { root, body, mat };
}
// ------------------------------------------------------------------ KITE-6: the extraction helicopter
export function heli() {
  const G = once('heli', () => {
    const b = new MB();
    b.sph(1.4, C.olive, { y: 1.6, z: .6, sx: 1.05, sy: 1, sz: 1.9 }, 20, 14).rbox(2.3, 1.7, 3.6, C.olive, { y: 1.55, z: -.6 });
    b.sph(1.2, C.glass, { y: 1.85, z: 2, sx: 1.02, sy: .75, sz: 1.2 }, 16, 10);
    b.box(.05, 1.25, 1.6, C.dk, { x: 1.16, y: 1.5, z: -.3 }).box(.05, 1.25, 1.6, C.dk, { x: -1.16, y: 1.5, z: -.3 });
    b.rbox(1.5, .7, 2.6, C.olive2, { y: 2.65, z: -.4 }).cyl(.16, .16, .7, C.dk, { y: 3.2, z: 0 }, 8);
    b.cyl(.3, .55, 6.5, C.olive, { y: 1.95, z: -5, rx: Math.PI / 2 - .05 }, 10).rbox(.15, 1.7, 1.2, C.olive, { y: 2.8, z: -8, rx: -.3 }).rbox(2.4, .1, .7, C.olive, { y: 2.05, z: -7.4 });
    for (const s of [-1, 1]) { b.cyl(.06, .06, 4.2, C.dk, { x: s * 1.1, y: 0, z: .3, rx: Math.PI / 2 }, 6).box(.06, .7, .06, C.dk, { x: s * 1.0, y: .35, z: 1.4, rz: s * .3 }).box(.06, .7, .06, C.dk, { x: s * 1.0, y: .35, z: -.8, rz: s * .3 }); }
    b.sph(.07, C.red, { x: -1.2, y: 1.5, z: .6, glow: 1 }, 6, 4).sph(.07, C.grn, { x: 1.2, y: 1.5, z: .6, glow: 1 }, 6, 4).sph(.08, C.wht, { y: 2.9, z: -8.6, glow: 1 }, 6, 4);
    b.box(.9, .4, .05, '#d8d0b0', { x: 1.18, y: 1.4, z: -1.6, ry: Math.PI / 2 });
    const r = new MB(); for (let i = 0; i < 4; i++) r.box(.32, .05, 5.6, C.dk, { z: 0, ry: i * Math.PI / 2, x: 0 }).box(.3, .06, .4, C.mid, { ry: i * Math.PI / 2, z: 5.4 });
    r.cyl(.25, .25, .25, C.mid, {}, 10);
    const t = new MB(); for (let i = 0; i < 2; i++) t.box(.06, .12, 1.4, C.dk, { rx: i * Math.PI / 2 });
    return { b: b.geo(), r: r.geo().translate(0, 0, 0), t: t.geo() };
  });
  const mat = glowMat({ glow: 5 }), root = new THREE.Group(), body = mesh(G.b, mat); root.add(body);
  const rotor = mesh(G.r, mat); rotor.position.y = 3.55; body.add(rotor);
  // rotor blur disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a1a14, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide })); disc.position.y = 3.56; body.add(disc);
  const tail = mesh(G.t, mat); tail.position.set(.18, 2.9, -8.3); body.add(tail);
  return { root, body, rotor, tail, mat };
}

// ------------------------------------------------------------------ first-person guns (camera space, barrel → −z)
function hands(b, gripZ, foreZ, foreY = -.045) {
  b.rbox(.06, .09, .11, C.glove, { x: .005, y: -.075, z: gripZ, rx: .3 });
  b.rbox(.09, .06, .12, C.glove, { x: -.01, y: foreY - .03, z: foreZ }).rbox(.03, .04, .1, C.glove, { x: -.05, y: foreY + .005, z: foreZ - .02 });
}
export function gunRifle() {
  const G = once('rifle', () => {
    const b = new MB();
    b.rbox(.064, .09, .42, C.tan, { z: -.02 }).rbox(.07, .07, .34, C.gun2, { y: .005, z: -.38 }).box(.016, .01, .3, C.gun, { y: .043, z: -.38 });
    for (let i = 0; i < 5; i++) b.box(.072, .03, .02, C.gun, { y: .0, z: -.25 - i * .06 });
    b.cyl(.013, .013, .42, C.gun, { z: -.72, rx: Math.PI / 2 }, 8).cyl(.022, .022, .08, C.gun2, { z: -.94, rx: Math.PI / 2 }, 8);
    b.rbox(.05, .1, .26, C.tan, { y: -.01, z: .3 }).rbox(.055, .045, .1, C.gun, { y: .055, z: .32 }).rbox(.05, .12, .04, C.gun, { y: -.02, z: .44 });
    b.rbox(.04, .1, .05, C.gun, { y: -.085, z: .1, rx: .35 }).box(.02, .02, .08, C.gun, { y: -.06, z: .02 });
    b.cyl(.012, .012, .03, C.gun2, { x: .042, y: .02, z: .08, rz: Math.PI / 2 }, 6).sph(.014, C.gun2, { x: .055, y: .02, z: .08 }, 6, 4);
    // scope
    b.cyl(.021, .021, .32, C.gun, { y: .088, z: -.04, rx: Math.PI / 2 }, 14).cyl(.032, .022, .08, C.gun, { y: .088, z: -.23, rx: Math.PI / 2 }, 14).cyl(.026, .021, .06, C.gun, { y: .088, z: .14, rx: Math.PI / 2 }, 14);
    b.cyl(.012, .012, .03, C.gun2, { y: .118, z: -.04 }, 8).cyl(.012, .012, .03, C.gun2, { x: .028, y: .088, z: -.04, rz: Math.PI / 2 }, 8);
    b.cyl(.029, .029, .004, C.cy, { y: .088, z: -.272, rx: Math.PI / 2, glow: .25 }, 14);
    b.box(.03, .03, .03, C.gun2, { y: .055, z: -.13 }).box(.03, .03, .03, C.gun2, { y: .055, z: .05 });
    hands(b, .1, -.36);
    const m = new MB(); m.rbox(.046, .13, .085, C.gun2, { y: -.1, z: -.07, rx: .1 }).box(.048, .012, .087, C.gun, { y: -.16, z: -.075, rx: .1 });
    return { b: b.geo(), m: m.geo() };
  });
  return gunParts(G, { muzzle: new V3(0, 0, -.98), sight: .088, name: 'rifle' });
}
export function gunCarbine() {
  const G = once('carbine', () => {
    const b = new MB();
    b.rbox(.06, .085, .34, C.gun, { z: 0 }).rbox(.066, .07, .3, C.gun2, { y: .004, z: -.31 }).box(.018, .012, .58, C.gun, { y: .046, z: -.14 });
    for (let i = 0; i < 4; i++) b.box(.004, .03, .05, C.gun, { x: .034, y: 0, z: -.22 - i * .06 }).box(.004, .03, .05, C.gun, { x: -.034, y: 0, z: -.22 - i * .06 });
    b.cyl(.012, .012, .2, C.gun, { z: -.55, rx: Math.PI / 2 }, 8).cyl(.019, .017, .06, C.gun2, { z: -.67, rx: Math.PI / 2 }, 8);
    b.box(.04, .04, .2, C.gun, { y: -.005, z: .25 }).rbox(.05, .09, .14, C.tan, { y: -.01, z: .38 }).rbox(.04, .1, .05, C.gun, { y: -.08, z: .09, rx: .35 });
    // red-dot sight
    b.rbox(.04, .022, .07, C.gun, { y: .057, z: -.02 }).add(new THREE.TorusGeometry(.021, .005, 6, 18), C.gun, { y: .085, z: -.055 }).box(.008, .03, .012, C.gun, { x: .02, y: .068, z: -.055 }).box(.008, .03, .012, C.gun, { x: -.02, y: .068, z: -.055 });
    b.sph(.0028, C.red, { y: .085, z: -.06, glow: 1 }, 6, 4);
    b.box(.012, .03, .012, C.gun, { y: .065, z: -.42 });
    hands(b, .09, -.3);
    const m = new MB(); m.rbox(.044, .15, .07, C.gun2, { y: -.11, z: -.06, rx: .22 });
    return { b: b.geo(), m: m.geo() };
  });
  return gunParts(G, { muzzle: new V3(0, 0, -.71), sight: .085, name: 'carbine' });
}
export function gunSMG() {
  const G = once('smg', () => {
    const b = new MB();
    b.rbox(.056, .08, .3, C.gun2, { z: 0 }).rbox(.058, .06, .16, C.gun, { y: -.005, z: -.22 });
    b.cyl(.021, .021, .24, C.gun, { y: .005, z: -.42, rx: Math.PI / 2 }, 12).cyl(.022, .022, .01, C.mid, { y: .005, z: -.36, rx: Math.PI / 2 }, 12);
    b.box(.012, .05, .16, C.gun, { y: -.02, z: .25 }).box(.05, .07, .02, C.gun, { y: -.03, z: .34 }).rbox(.04, .09, .045, C.gun, { y: -.075, z: .07, rx: .3 });
    b.rbox(.04, .02, .07, C.gun, { y: .05, z: -.02 }).box(.004, .03, .01, C.gun, { x: .02, y: .066, z: -.05 }).box(.004, .03, .01, C.gun, { x: -.02, y: .066, z: -.05 }).box(.044, .004, .01, C.gun, { y: .083, z: -.05 }).sph(.0026, C.grn, { y: .072, z: -.055, glow: 1 }, 6, 4);
    b.box(.004, .006, .12, C.cy, { x: .03, y: .02, z: -.1, glow: .6 });
    hands(b, .07, -.2);
    const m = new MB(); m.rbox(.036, .17, .05, C.gun2, { y: -.12, z: -.07, rx: .05 });
    return { b: b.geo(), m: m.geo() };
  });
  return gunParts(G, { muzzle: new V3(0, .005, -.55), sight: .072, name: 'smg' });
}
function gunParts(G, o) {
  const mat = glowMat({ glow: 6 }), root = new THREE.Group(), body = new THREE.Mesh(G.b, mat), mag = new THREE.Mesh(G.m, mat);
  root.add(body, mag); body.renderOrder = mag.renderOrder = 10;
  return { root, body, mag, mat, ...o };
}
// ------------------------------------------------------------------ props
export const RARITY = [{ n: 'COMMON', c: '#9aa6b8', g: '#d8e6ff' }, { n: 'RARE', c: '#2f86ff', g: '#5fb0ff' }, { n: 'EPIC', c: '#a34dff', g: '#c78bff' }, { n: 'LEGENDARY', c: '#ffaa1f', g: '#ffd36a' }];
export function crate(r = 0) {
  const R = RARITY[r], G = once('crate' + r, () => {
    const b = new MB(); b.rbox(.9, .42, .56, R.c, {}, .05).box(.94, .06, .6, C.dk, { y: .1 }).box(.94, .06, .6, C.dk, { y: -.12 });
    for (const s of [-1, 1]) b.box(.06, .1, .04, C.lt, { x: s * .3, y: .16, z: .29 }).box(.12, .07, .06, C.dk, { x: s * .47, y: .05 });
    b.box(.3, .12, .01, R.g, { y: -.01, z: .285, glow: .6 });
    const l = new MB(); l.rbox(.92, .1, .58, R.c, { z: .29 }, .04).box(.7, .03, .03, R.g, { y: .05, z: .58, glow: 1 }).box(.5, .025, .3, R.g, { y: .052, z: .29, glow: .7 });
    return { b: b.geo(), l: l.geo() };
  });
  const mat = glowMat({ glow: 3 }), root = new THREE.Group(), body = mesh(G.b, mat), lid = mesh(G.l, mat);
  body.position.y = .21; lid.position.set(0, .42, -.29); root.add(body, lid);
  // rarity light pillar
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18, .32, 9, 12, 1, true).translate(0, 4.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(R.g).multiplyScalar(1.6), transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  root.add(beam);
  return { root, lid, mat, beam };
}
export function charge() {
  const G = once('charge', () => { const b = new MB(); b.rbox(.24, .14, .16, '#3a3a2a').box(.2, .02, .12, '#c8b070', { y: .075 }).sph(.025, C.red, { y: .1, x: .06, glow: 1 }, 6, 4).tube([[-.08, .07, 0], [-.04, .16, .03], [.04, .1, .06]], .008, C.red); return b.geo(); });
  const mat = glowMat({ glow: 8 }); return { root: mesh(G, mat), mat };
}
export function powerCell() {
  const G = once('cell', () => { const b = new MB(); b.cyl(.13, .13, .5, C.dk, {}, 14).cyl(.1, .1, .42, C.cy, { glow: 1 }, 14).cyl(.15, .15, .06, C.mid, { y: .26 }, 14).cyl(.15, .15, .06, C.mid, { y: -.26 }, 14); for (let i = 0; i < 4; i++) b.box(.03, .5, .03, C.mid, { x: Math.cos(i * 1.57) * .13, z: Math.sin(i * 1.57) * .13 }); return b.geo(); });
  const mat = glowMat({ glow: 4 }); return { root: mesh(G, mat), mat };
}

// Grime Gone — power wash cleaning. Drag the water jet over a grimy object to blast the dirt off (a per-vertex dirt
// mask with a noise "dissolve" edge), watch the clean % climb, and make it sparkle at 100%.
import { THREE, createStage, createUI, loop, tone, note, buzz, confetti, burst, store, clamp, lerp, rng, mat, glossy, rounded } from './kit/hc.js';
import { daily } from './kit/daily.js';
// No flow.js: cleaning has no fail state or skill element (FLOW_BRIEF rule 4) — every object can always be finished.

const NAME = 'Grime Gone: Power Wash Cleaning';
const S = store('grimegone');
let level = S.get('level', 1), total = S.get('score', 0);
const ui = createUI({ title: 'GRIME<br>GONE', hint: 'Drag to blast the grime', hand: '👆', score: false });
const D = daily('grimegone', ui, { name: NAME });
const stage = createStage({ fov: 40, shadowSize: 6 });
const { scene, camera, sun, renderer } = stage;
document.body.style.background = 'linear-gradient(180deg,#d9ecff 0%,#f4f8ff 55%,#e3ecf7 100%)';

const css = document.createElement('style');
css.textContent = `
.gg-meter{position:fixed;left:50%;top:calc(56px + env(safe-area-inset-top));transform:translateX(-50%);z-index:5;font-weight:800;font-size:44px;color:#fff;text-shadow:0 4px 0 rgba(30,60,110,.35),0 0 18px rgba(30,60,110,.25);pointer-events:none;line-height:1}
.gg-name{position:fixed;left:0;right:0;top:calc(104px + env(safe-area-inset-top));text-align:center;z-index:5;font-weight:800;font-size:16px;color:#5a7aa8;pointer-events:none;letter-spacing:.5px}
.gg-aim{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid rgba(255,255,255,.95);box-shadow:0 0 0 2px rgba(58,134,255,.35);z-index:6;pointer-events:none;display:none}
.gg-hand{position:fixed;font-size:52px;z-index:7;pointer-events:none;display:none;animation:gghand 1.4s ease-in-out infinite}
@keyframes gghand{0%,100%{transform:translate(-40px,0)}50%{transform:translate(40px,10px)}}`;
document.head.appendChild(css);
const meter = document.createElement('div'); meter.className = 'gg-meter'; meter.textContent = '0%'; document.body.appendChild(meter);
const nameEl = document.createElement('div'); nameEl.className = 'gg-name'; document.body.appendChild(nameEl);
const aimEl = document.createElement('div'); aimEl.className = 'gg-aim'; document.body.appendChild(aimEl);
const handEl = document.createElement('div'); handEl.className = 'gg-hand'; handEl.textContent = '👆'; document.body.appendChild(handEl);

// ---------------------------------------------------------------- yard: tiled floor + wall
function tileTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  c.fillStyle = '#9fb3c8'; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#c4d3e3' : '#b6c7da'; c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.35 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), mat('#eef3fa')); wall.position.set(0, 7, -5); wall.receiveShadow = true; scene.add(wall);
const stripe = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.5), mat('#7fb2ff')); stripe.position.set(0, 1.4, -4.98); scene.add(stripe);
const winM = new THREE.Mesh(rounded(3.4, 2.2, 0.2, 0.2), mat('#ffffff')); winM.position.set(-2.9, 3.7, -4.95); scene.add(winM);
for (const x of [-3.7, -2.1]) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshBasicMaterial({ color: '#bfe6ff' })); pane.position.set(x, 3.7, -4.83); scene.add(pane); }
const shelf = new THREE.Mesh(rounded(3.2, 0.14, 0.7, 0.05), mat('#c58b5c')); shelf.position.set(2.6, 3.4, -4.65); scene.add(shelf);
[['#ff5d6c', 1.6], ['#ffd23f', 2.3], ['#3ab795', 3.0], ['#7b5cff', 3.6]].forEach(([c, x], i) => { const can = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5 + (i % 2) * 0.2, 16), mat(c)); can.position.set(x, 3.72 + (i % 2) * 0.1, -4.6); can.castShadow = true; scene.add(can); });
const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.05, transparent: true, opacity: 0 }));
puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.01; puddle.scale.set(3.4, 2.2, 1); scene.add(puddle);

// ---------------------------------------------------------------- tessellation so the dirt mask has enough vertices
function tess(geo, maxE) {
  const g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position.array, Nn = g.attributes.normal.array, op = [], on = [], st = [];
  for (let i = 0; i < P.length; i += 9) st.push([P.slice(i, i + 9), Nn.slice(i, i + 9)]);
  const m2 = maxE * maxE;
  while (st.length) {
    const [p, n] = st.pop(), d = (a, b) => (p[a * 3] - p[b * 3]) ** 2 + (p[a * 3 + 1] - p[b * 3 + 1]) ** 2 + (p[a * 3 + 2] - p[b * 3 + 2]) ** 2;
    const e = [d(0, 1), d(1, 2), d(2, 0)], k = e.indexOf(Math.max(...e));
    if (e[k] <= m2 || op.length > 360000) { op.push(...p); on.push(...n); continue; }
    const a = k, b = (k + 1) % 3, c = (k + 2) % 3, mp = [], mn = [];
    for (let j = 0; j < 3; j++) { mp[j] = (p[a * 3 + j] + p[b * 3 + j]) / 2; mn[j] = (n[a * 3 + j] + n[b * 3 + j]) / 2; }
    const tri = (i0, i1, ps, ns) => { const q = new Float32Array(9), r = new Float32Array(9); [i0, i1].forEach((ii, s) => { for (let j = 0; j < 3; j++) { q[s * 3 + j] = p[ii * 3 + j]; r[s * 3 + j] = n[ii * 3 + j]; } }); for (let j = 0; j < 3; j++) { q[6 + j] = ps[j]; r[6 + j] = ns[j]; } return [q, r]; };
    // split edge a-b at its midpoint: triangles (c, a, mid) and (b, c, mid) keep the winding
    st.push(tri(c, a, mp, mn), tri(b, c, mp, mn));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(op, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(on, 3));
  const nn = out.attributes.normal; for (let i = 0; i < nn.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(nn, i).normalize(); nn.setXYZ(i, v.x, v.y, v.z); }
  out.setAttribute('dirt', new THREE.Float32BufferAttribute(new Float32Array(nn.count).fill(1), 1));
  return out;
}

// ---------------------------------------------------------------- grime shader (shared by the visible material and the readback pass)
const NOISE = `
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float grime(vec3 p, float d){ float n = vnoise(p * 5.0) * 0.6 + vnoise(p * 15.0) * 0.4; return smoothstep(n - 0.05, n + 0.05, d * 1.12 - 0.06); }
`;
const DIRT = new THREE.Color('#6b4a2b');
const uDirt = { value: DIRT }, uShine = { value: 0 };
function grimeMat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.08, ...o });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = uDirt; sh.uniforms.uShine = uShine;
    sh.vertexShader = 'attribute float dirt;\nvarying float vDirt;\nvarying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirt = dirt; vLP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uDirt;\nuniform float uShine;\nvarying float vDirt;\nvarying vec3 vLP;\n' + NOISE + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat gm = grime(vLP, vDirt);\nvec3 dc = uDirt * (0.55 + 0.7 * vnoise(vLP * 31.0));\ndiffuseColor.rgb = mix(diffuseColor.rgb, dc, gm);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor * (1.0 - uShine * 0.6), 1.0, gm);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.08) * uShine * (1.0 - gm);');
  };
  return m;
}
const readMat = new THREE.ShaderMaterial({
  vertexShader: 'attribute float dirt; varying float vDirt; varying vec3 vLP; void main(){ vDirt = dirt; vLP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vLP, 1.0); }',
  fragmentShader: 'varying float vDirt; varying vec3 vLP;' + NOISE + 'void main(){ gl_FragColor = vec4(1.0, grime(vLP, vDirt) > 0.5 ? 1.0 : 0.0, 0.0, 1.0); }',
});

// ---------------------------------------------------------------- objects (original toy-like props from primitives)
let parts = [];   // { mesh, wp: Float32Array world positions, c: center, r: radius }
function makeObject(kind) {
  const g = new THREE.Group(), proxies = new THREE.Group(); g.add(proxies);
  const add = (geo, color, x, y, z, rx = 0, ry = 0, rz = 0, o = {}) => {
    const m = new THREE.Mesh(tess(geo.clone(), 0.11), grimeMat(color, o)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const pr = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false })); pr.position.copy(m.position); pr.rotation.copy(m.rotation); proxies.add(pr);
    m.layers.enable(1); return m;
  };
  const tube = (a, b, r, color) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B); const geo = new THREE.CylinderGeometry(r, r, L, 12, Math.ceil(L / 0.1)); geo.translate(0, L / 2, 0); geo.lookAt ? 0 : 0; const m = add(geo, color, A.x, A.y, A.z); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.children[0].children[g.children[0].children.length - 1].quaternion.copy(m.quaternion); return m; };
  if (kind === 'car') {
    add(rounded(4.2, 0.95, 1.9, 0.32), '#ff4d5e', 0, 0.95, 0);
    add(rounded(2.4, 0.85, 1.7, 0.32), '#ff4d5e', -0.25, 1.8, 0);
    add(rounded(2.1, 0.62, 1.74, 0.2), '#bfe6ff', -0.25, 1.82, 0, 0, 0, 0, { roughness: 0.1 });
    add(rounded(0.2, 0.3, 1.95, 0.08), '#cfd6e0', 2.1, 0.75, 0); add(rounded(0.2, 0.3, 1.95, 0.08), '#cfd6e0', -2.1, 0.75, 0);
    for (const z of [-0.6, 0.6]) add(new THREE.SphereGeometry(0.16, 14, 10), '#fff2b0', 2.08, 1.05, z);
    for (const x of [-1.35, 1.35]) for (const z of [-0.92, 0.92]) { add(new THREE.CylinderGeometry(0.48, 0.48, 0.36, 24, 3), '#3d3a4b', x, 0.48, z, Math.PI / 2); add(new THREE.CylinderGeometry(0.24, 0.24, 0.38, 16, 2), '#e8edf3', x, 0.48, z, Math.PI / 2); }
  } else if (kind === 'bike') {
    for (const x of [-1.15, 1.15]) { add(new THREE.TorusGeometry(0.72, 0.09, 10, 40), '#3d3a4b', x, 0.8, 0); add(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 12), '#cfd6e0', x, 0.8, 0, Math.PI / 2); }
    const F = '#3ab795';
    tube([-1.15, 0.8, 0], [-0.1, 0.8, 0], 0.07, F); tube([-0.1, 0.8, 0], [-0.4, 1.75, 0], 0.07, F); tube([-1.15, 0.8, 0], [-0.4, 1.7, 0], 0.06, F);
    tube([-0.1, 0.8, 0], [0.85, 1.6, 0], 0.08, F); tube([-0.4, 1.68, 0], [0.8, 1.68, 0], 0.07, F); tube([1.15, 0.8, 0], [0.85, 1.85, 0], 0.07, F);
    tube([0.85, 1.85, -0.45], [0.85, 1.85, 0.45], 0.05, '#3d3a4b'); add(rounded(0.6, 0.16, 0.3, 0.07), '#3d3a4b', -0.45, 1.86, 0);
    add(new THREE.TorusGeometry(0.22, 0.05, 8, 24), '#cfd6e0', -0.1, 0.8, 0.1); add(new THREE.SphereGeometry(0.12, 12, 8), '#ffd23f', 0.95, 1.6, 0);
  } else if (kind === 'fence') {
    for (let i = 0; i < 7; i++) { const x = -2.1 + i * 0.7; add(rounded(0.42, 2.2, 0.14, 0.05), '#fff4e6', x, 1.2, 0); add(new THREE.ConeGeometry(0.3, 0.32, 4, 2), '#fff4e6', x, 2.45, 0, 0, Math.PI / 4); }
    add(rounded(4.9, 0.22, 0.12, 0.04), '#ffd8a8', 0, 0.75, -0.13); add(rounded(4.9, 0.22, 0.12, 0.04), '#ffd8a8', 0, 1.75, -0.13);
  } else if (kind === 'bench') {
    for (let i = 0; i < 4; i++) add(rounded(3.6, 0.1, 0.24, 0.04), '#4fc39f', 0, 0.95, -0.5 + i * 0.3);
    for (let i = 0; i < 3; i++) add(rounded(3.6, 0.22, 0.08, 0.04), '#4fc39f', 0, 1.35 + i * 0.32, -0.72, -0.15);
    for (const x of [-1.5, 1.5]) { add(rounded(0.14, 1.0, 1.2, 0.05), '#3d3a4b', x, 0.48, -0.05); add(rounded(0.14, 1.0, 0.14, 0.05), '#3d3a4b', x, 1.55, -0.76, -0.15); add(rounded(0.16, 0.12, 1.1, 0.05), '#3d3a4b', x, 1.25, -0.05); }
  } else if (kind === 'hydrant') {
    add(new THREE.CylinderGeometry(0.65, 0.75, 0.25, 32, 2), '#ffd23f', 0, 0.12, 0);
    add(new THREE.CylinderGeometry(0.5, 0.55, 1.9, 32, 16), '#ff4d5e', 0, 1.2, 0);
    add(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 32, 2), '#ffd23f', 0, 2.15, 0);
    add(new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), '#ff4d5e', 0, 2.22, 0);
    add(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 12), '#ffd23f', 0, 2.78, 0);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 20, 3), '#ff4d5e', s * 0.62, 1.5, 0, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 20), '#ffd23f', s * 0.82, 1.5, 0, 0, 0, Math.PI / 2); }
    add(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 20, 3), '#ff4d5e', 0, 1.3, 0.55, Math.PI / 2); add(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 6), '#ffd23f', 0, 1.3, 0.72, Math.PI / 2);
  } else if (kind === 'trophy') {
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(0.18 + Math.pow(t, 1.6) * 0.95, t * 1.6)); }
    add(new THREE.LatheGeometry(pts, 40), '#ffc23f', 0, 1.6, 0, 0, 0, 0, { metalness: 0.5, roughness: 0.25, side: THREE.DoubleSide });
    for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.38, 0.08, 10, 28, Math.PI * 1.2), '#ffc23f', s * 1.05, 2.5, 0, 0, 0, s > 0 ? -Math.PI * 0.6 : Math.PI * 0.4, { metalness: 0.5, roughness: 0.25 });
    add(new THREE.CylinderGeometry(0.14, 0.2, 0.8, 18, 6), '#ffc23f', 0, 1.25, 0, 0, 0, 0, { metalness: 0.5, roughness: 0.25 });
    add(rounded(1.5, 0.35, 1.2, 0.08), '#8a5a3b', 0, 0.68, 0); add(rounded(1.9, 0.5, 1.5, 0.1), '#5a3a26', 0, 0.25, 0);
    add(rounded(0.9, 0.2, 0.04, 0.05), '#e8edf3', 0, 0.25, 0.76);
  } else if (kind === 'barrow') {
    add(rounded(2.4, 0.8, 1.6, 0.25), '#3a86ff', 0.2, 1.25, 0); add(rounded(2.1, 0.12, 1.3, 0.05), '#2456b8', 0.2, 1.66, 0);
    add(new THREE.TorusGeometry(0.42, 0.13, 10, 28), '#3d3a4b', 1.55, 0.5, 0); add(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 14), '#ffd23f', 1.55, 0.5, 0, Math.PI / 2);
    for (const z of [-0.55, 0.55]) { tube([1.55, 0.5, z * 0.4], [-1.9, 1.35, z], 0.07, '#ff8c42'); tube([-0.7, 1.0, z], [-0.75, 0.1, z], 0.07, '#ff8c42'); }
  } else if (kind === 'mailbox') {
    add(rounded(0.28, 1.9, 0.28, 0.06), '#8a5a3b', 0, 0.95, 0);
    add(rounded(1.9, 0.7, 0.9, 0.08), '#3ab795', 0, 2.15, 0); add(new THREE.CylinderGeometry(0.45, 0.45, 1.9, 28, 12, false, 0, Math.PI), '#3ab795', 0, 2.5, 0, 0, 0, Math.PI / 2);
    add(rounded(0.06, 0.82, 0.92, 0.03), '#2a8f6e', 0.96, 2.3, 0); add(rounded(0.1, 0.7, 0.12, 0.04), '#ff4d5e', -0.2, 2.75, 0.52); add(rounded(0.4, 0.26, 0.12, 0.04), '#ff4d5e', -0.03, 3.0, 0.52);
    add(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 20), '#9aa5b5', 0, 0.1, 0);
  } else {   // skateboard on a ramp block
    add(rounded(3.6, 0.5, 1.4, 0.12), '#ffd8a8', 0, 0.25, 0);
    add(rounded(3.2, 0.12, 0.95, 0.45), '#7b5cff', 0, 0.98, 0, 0, 0, 0.0);
    for (const x of [-1.05, 1.05]) { add(rounded(0.3, 0.14, 0.7, 0.05), '#cfd6e0', x, 0.84, 0); for (const z of [-0.36, 0.36]) add(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 18, 2), '#ffd23f', x, 0.66, z, Math.PI / 2); }
  }
  return g;
}
const OBJECTS = [['car', 'Muddy car'], ['fence', 'Garden fence'], ['bike', 'Trail bike'], ['hydrant', 'Fire hydrant'], ['trophy', 'Old trophy'], ['bench', 'Park bench'], ['barrow', 'Wheelbarrow'], ['mailbox', 'Mailbox'], ['skate', 'Skateboard']];
const DIRTS = ['#6b4a2b', '#4e5a2a', '#7a4a24', '#5a554d', '#5b3d2e'];

// ---------------------------------------------------------------- spray: jet, droplets, dirt flecks
const gun = new THREE.Group(); camera.add(gun); scene.add(camera);
const gunBody = new THREE.Mesh(rounded(0.26, 0.34, 1.1, 0.08), glossy('#ffd23f')); gunBody.position.z = 0.15; gun.add(gunBody);
const gunGrip = new THREE.Mesh(rounded(0.18, 0.55, 0.22, 0.06), glossy('#2b2d42')); gunGrip.position.set(0, -0.32, 0.4); gunGrip.rotation.x = 0.3; gun.add(gunGrip);
const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.4, 10), glossy('#cfd6e0', { metalness: 0.5 })); lance.rotation.x = Math.PI / 2; lance.position.z = -1.05; gun.add(lance);
const nozzleTip = new THREE.Object3D(); nozzleTip.position.z = -1.78; gun.add(nozzleTip);
gun.position.set(0.62, -1.6, -4.3);
const jetMat = new THREE.MeshBasicMaterial({ color: '#dff2ff', transparent: true, opacity: 0.75, depthWrite: false });
const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 1, 10, 1, true), jetMat); jet.geometry.translate(0, 0.5, 0); jet.geometry.rotateX(Math.PI / 2); scene.add(jet); jet.visible = false;
const hitRing = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide })); scene.add(hitRing); hitRing.visible = false;
const DROPS = 260, dropIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshStandardMaterial({ color: '#e8f6ff', roughness: 0.1, transparent: true, opacity: 0.85 }), DROPS);
const FLECKS = 220, fleckIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 }), FLECKS);
for (const im of [dropIM, fleckIM]) { im.frustumCulled = false; scene.add(im); }
const drops = Array.from({ length: DROPS }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), l: 0 })), flecks = Array.from({ length: FLECKS }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), l: 0, r: 0 }));
let di = 0, fi = 0;
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

// ---------------------------------------------------------------- noise audio: water hiss
let ax = null, hiss = null;
function audioOn() {
  if (ax) return; try {
    ax = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ax.createBuffer(1, ax.sampleRate, ax.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ax.createBufferSource(); src.buffer = buf; src.loop = true; const f = ax.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const f2 = ax.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 3200; f2.gain.value = 6;
    hiss = ax.createGain(); hiss.gain.value = 0; src.connect(f); f.connect(f2); f2.connect(hiss); hiss.connect(ax.destination); src.start(); hiss.f = f2;
  } catch (e) { ax = null; }
}

// ---------------------------------------------------------------- state
let state = 'ready', obj = null, objName = '', clean = 0, spraying = false, aim = null, hit = null, recorded = false, beatenShown = false, sessionLv = 0, shineT = 0, idle = 0, botAim = null, lastMilestone = 0;
const rt = new THREE.WebGLRenderTarget(72, 156), pix = new Uint8Array(72 * 156 * 4);
let target = new THREE.Vector3(0, 1.2, 0), camR = 6;
function fit() {
  const vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2), a = camera.aspect;
  const d = Math.max(camR / (th * a), camR * 1.15 / th) * 0.92;
  const dir = new THREE.Vector3(0.42, 0.36, 1).normalize();
  camera.position.copy(target).addScaledVector(dir, d); camera.position.y += 0.2; camera.lookAt(target.x, target.y - 0.25, target.z);
  camera.updateMatrixWorld();
}
addEventListener('resize', () => { fit(); });
function build() {
  const r = rng(D.seed ? D.seed + sessionLv * 13 : level * 977 + 5);
  const oi = D.seed ? Math.floor(r() * OBJECTS.length) : (level - 1) % OBJECTS.length;
  if (obj) { scene.remove(obj); obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  obj = makeObject(OBJECTS[oi][0]); objName = OBJECTS[oi][1]; scene.add(obj); obj.updateMatrixWorld(true);
  uDirt.value = new THREE.Color(DIRTS[(level - 1 + (D.seed ? Math.floor(r() * 5) : 0)) % DIRTS.length]); fleckIM.material.color.copy(uDirt.value); uShine.value = 0;
  // world-space vertex positions for the cleaning brush
  parts = [];
  obj.children.forEach(m => { if (!m.isMesh) return; const pa = m.geometry.attributes.position, wp = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { _v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld); wp[i * 3] = _v.x; wp[i * 3 + 1] = _v.y; wp[i * 3 + 2] = _v.z; }
    m.geometry.computeBoundingSphere(); const bs = m.geometry.boundingSphere.clone().applyMatrix4(m.matrixWorld);
    parts.push({ mesh: m, wp, c: bs.center, r: bs.radius, dirt: m.geometry.attributes.dirt }); });
  const box = new THREE.Box3().setFromObject(obj); box.getCenter(target); camR = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * 0.62;
  fit(); clean = 0; recorded = false; beatenShown = false; shineT = 0; idle = 0; lastMilestone = 0; puddle.material.opacity = 0;
  meter.textContent = '0%'; nameEl.textContent = objName; ui.levels(D.seed ? 1 : level); ui.progress(0);
  setTimeout(measure, 50);
}

// ---------------------------------------------------------------- cleaning
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function aimHit(px, py) {
  ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(obj.children[0].children, false)[0]; return h ? h.point : null;
}
const RAD = 0.46;
function blast(p, amt) {
  let rem = 0;
  for (const pt of parts) {
    if (pt.c.distanceTo(p) > pt.r + RAD) continue;
    const wp = pt.wp, da = pt.dirt.array; let ch = false;
    for (let i = 0; i < da.length; i++) {
      if (da[i] <= 0) continue;
      const dx = wp[i * 3] - p.x, dy = wp[i * 3 + 1] - p.y, dz = wp[i * 3 + 2] - p.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > RAD * RAD) continue;
      const k = amt * (1 - Math.sqrt(d2) / RAD * 0.7); const nv = Math.max(0, da[i] - k); rem += da[i] - nv; da[i] = nv; ch = true;
    }
    if (ch) pt.dirt.needsUpdate = true;
  }
  return rem;
}
// how much of what the camera sees is still grimy: render the object alone with the readback shader into a tiny target
function measure() {
  if (!obj) return;
  const ol = camera.layers.mask, bg = renderer.getClearColor(new THREE.Color()), ba = renderer.getClearAlpha();
  scene.overrideMaterial = readMat; camera.layers.set(1); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, pix);
  renderer.setRenderTarget(null); scene.overrideMaterial = null; camera.layers.mask = ol; renderer.setClearColor(bg, ba);
  let on = 0, dirty = 0; const dirtyPx = [];
  for (let i = 0; i < pix.length; i += 4) if (pix[i] > 127) { on++; if (pix[i + 1] > 127) { dirty++; if (dirtyPx.length < 400) dirtyPx.push(i / 4); } }
  measure.dirtyPx = dirtyPx; measure.dirty = dirty;
  return on ? 1 - dirty / on : 0;
}
function win() {
  state = 'won'; spraying = false; jet.visible = false; hitRing.visible = false; aimEl.style.display = 'none';
  for (const pt of parts) { pt.dirt.array.fill(0); pt.dirt.needsUpdate = true; }
  meter.textContent = '100%'; ui.progress(1); shineT = 0.001;
  const pts = 100 + Math.round(clean * 0); total += pts; S.set('score', total);
  if (!beatenShown && D.beaten(total)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); }
  ui.pop('SPARKLING!', '#fff', 44, 26); ui.flash(0.5); buzz([20, 40, 20]);
  [0, 4, 7, 11, 14, 19].forEach((s, i) => setTimeout(() => note(76 + s, 0.4, 0.12), i * 80));
  confetti(scene, target.clone().add(new THREE.Vector3(0, 1, 0)), 110);
  const done = level; if (!D.seed) { level++; S.set('level', level); } sessionLv++;
  D.won(total, 'cleaned'); ui.win(D.seed ? 'DAILY' : done, `${objName} · good as new ✨`);
}

// ---------------------------------------------------------------- input: aim 70px above the finger so it stays visible
let down = false;
const setAim = (x, y) => { aim = [x, y - 70]; aimEl.style.left = aim[0] + 'px'; aimEl.style.top = aim[1] + 'px'; };
addEventListener('pointerdown', e => { if (state !== 'play') return; audioOn(); down = true; spraying = true; setAim(e.clientX, e.clientY); aimEl.style.display = 'block'; idle = 0; });
addEventListener('pointermove', e => { if (!down) return; setAim(e.clientX, e.clientY); });
const up = () => { down = false; spraying = false; aimEl.style.display = 'none'; };
addEventListener('pointerup', up); addEventListener('pointercancel', up);
ui.onTap((which) => { audioOn(); if (which === 'start' && state === 'ready') { state = 'play'; return; } build(); state = 'play'; });

// ---------------------------------------------------------------- loop
let measureT = 0, hissV = 0, bendT = 0;
loop((dt, t) => {
  const active = state === 'play' && spraying && aim;
  hit = active ? aimHit(aim[0], aim[1]) : null;
  // gun points at the aim (or rests)
  const look = hit ? hit.clone() : (aim && active ? (() => { ndc.set(aim[0] / innerWidth * 2 - 1, -(aim[1] / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.at(8, new THREE.Vector3()); })() : target.clone());
  gun.lookAt(look); gun.rotateY(Math.PI); gun.rotation.z = Math.sin(t * 50) * (active ? 0.01 : 0);
  gun.position.y = lerp(gun.position.y, active ? -1.52 : -1.65, 0.2);
  const tip = nozzleTip.getWorldPosition(new THREE.Vector3());
  let rem = 0;
  if (active) {
    const end = hit || look; jet.visible = true; jet.position.copy(tip); jet.lookAt(end); jet.scale.set(1 + Math.sin(t * 60) * 0.15, 1 + Math.cos(t * 55) * 0.15, tip.distanceTo(end));
    jetMat.opacity = 0.6 + Math.sin(t * 40) * 0.15;
    if (hit) {
      rem = blast(hit, 0.16 * dt);
      hitRing.visible = true; hitRing.position.copy(hit).addScaledVector(camera.position.clone().sub(hit).normalize(), 0.05); hitRing.lookAt(camera.position); hitRing.scale.setScalar(0.8 + Math.sin(t * 30) * 0.2);
      const away = camera.position.clone().sub(hit).normalize();
      for (let k = 0; k < 4; k++) { const o = drops[di]; di = (di + 1) % DROPS; o.on = true; o.l = 1; o.p.copy(hit); o.v.set((Math.random() - 0.5) * 0.12, Math.random() * 0.1, (Math.random() - 0.5) * 0.12).addScaledVector(away, 0.05); }
      if (rem > 0.02) for (let k = 0; k < Math.min(4, rem * 8); k++) { const o = flecks[fi]; fi = (fi + 1) % FLECKS; o.on = true; o.l = 1; o.r = Math.random() * 6; o.p.copy(hit); o.v.set((Math.random() - 0.5) * 0.1, Math.random() * 0.12, (Math.random() - 0.5) * 0.1).addScaledVector(away, 0.06); }
      puddle.material.opacity = Math.min(0.55, puddle.material.opacity + 0.002 * dt);
    }
  } else { jet.visible = false; hitRing.visible = false; }
  // particles
  for (let i = 0; i < DROPS; i++) { const o = drops[i]; if (o.on) { o.v.y -= 0.006 * dt; o.p.addScaledVector(o.v, dt); o.l -= 0.03 * dt; if (o.l <= 0 || o.p.y < 0) o.on = false; } _m.compose(o.p, _q.identity(), _s.setScalar(o.on ? 0.6 + o.l : 0)); dropIM.setMatrixAt(i, _m); }
  for (let i = 0; i < FLECKS; i++) { const o = flecks[i]; if (o.on) { o.v.y -= 0.006 * dt; o.p.addScaledVector(o.v, dt); o.r += 0.3 * dt; o.l -= 0.015 * dt; if (o.p.y < 0.01) { o.p.y = 0.01; o.v.set(0, 0, 0); } if (o.l <= 0) o.on = false; } _e.set(o.r, o.r * 0.7, 0); _m.compose(o.p, _q.setFromEuler(_e), _s.setScalar(o.on ? 1 : 0)); fleckIM.setMatrixAt(i, _m); }
  dropIM.instanceMatrix.needsUpdate = true; fleckIM.instanceMatrix.needsUpdate = true;
  // audio
  hissV = lerp(hissV, active ? (hit ? 0.16 + clamp(rem * 0.6, 0, 0.12) : 0.1) : 0, 0.25);
  if (hiss) { hiss.gain.value = hissV; hiss.f.frequency.value = 2600 + rem * 3000; }
  if (rem > 0.03 && Math.random() < 0.3) buzz(5);
  // measure progress a few times a second
  measureT += dt;
  if (state === 'play' && measureT > 14) {
    measureT = 0; clean = measure(); const pct = Math.floor(clean * 100);
    meter.textContent = pct + '%'; ui.progress(clean);
    if (Math.floor(pct / 25) > lastMilestone && pct < 100) { lastMilestone = Math.floor(pct / 25); ui.pop(['', 'Nice!', 'Halfway!', 'Almost!'][lastMilestone] || 'Nice!', '#fff', 30, 32); [0, 4, 7].forEach((s, i) => setTimeout(() => note(72 + lastMilestone * 2 + s, 0.18, 0.1), i * 60)); }
    if (clean >= 0.985) win();
  }
  // sparkle after the win
  if (shineT > 0) { shineT += dt / 60; uShine.value = Math.min(1, shineT * 2) * (0.7 + 0.3 * Math.sin(t * 6)); if (Math.random() < 0.3) burst(scene, target.clone().add(new THREE.Vector3((Math.random() - 0.5) * camR * 1.4, (Math.random() - 0.3) * camR, (Math.random() - 0.5) * 1.5)), ['#ffffff', '#fff6b0'], 3, { speed: 0.02, up: 0.02, size: 0.5, shape: 'sphere', gravity: 0 }); }
  meter.style.visibility = nameEl.style.visibility = state === 'ready' ? 'hidden' : 'visible';
  // helper hand when idle
  idle += state === 'play' && !down ? dt / 60 : -idle; handEl.style.display = state === 'play' && idle > 3 ? 'block' : 'none';
  if (handEl.style.display === 'block') { _v.copy(target).project(camera); handEl.style.left = ((_v.x + 1) / 2 * innerWidth - 20) + 'px'; handEl.style.top = ((1 - _v.y) / 2 * innerHeight + 40) + 'px'; }
  sun.position.set(target.x + 5, 12, target.z + 7); sun.target.position.copy(target);
});
build(); ui.start();

// ---------------------------------------------------------------- test hook: aims the jet at a still-dirty pixel from the readback
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  bot() {
    if (state !== 'play') { spraying = false; return; }
    idle = 0; const px = measure.dirtyPx || [];
    if (!px.length) { measure(); return; }
    for (let k = 0; k < 6; k++) { const q = px[Math.floor(Math.random() * px.length)], h = aimHit((q % rt.width + 0.5) / rt.width * innerWidth, (1 - (Math.floor(q / rt.width) + 0.5) / rt.height) * innerHeight); if (h) blast(h, 0.5); }
    // keep sweeping near the last aim: pick the closest dirty pixel to it
    let best = px[0], bd = 1e9;
    if (botAim) for (const q of px) { const x = q % rt.width, y = Math.floor(q / rt.width); const d = (x - botAim[0]) ** 2 + (y - botAim[1]) ** 2; if (d < bd) { bd = d; best = q; } }
    const bx = best % rt.width, by = Math.floor(best / rt.width); botAim = [bx, by];
    const sx = (bx + 0.5) / rt.width * innerWidth, sy = (1 - (by + 0.5) / rt.height) * innerHeight;
    audioOn(); spraying = true; aim = [sx, sy]; aimEl.style.display = 'block'; aimEl.style.left = sx + 'px'; aimEl.style.top = sy + 'px';
    const h = aimHit(sx, sy); if (h) blast(h, 0.6);
  },
};

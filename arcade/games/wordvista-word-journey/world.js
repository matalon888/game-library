// world.js — Wordvista's 3D backdrop (our own code, MIT): one AI-modelled diorama island slowly turning on a bed of
// clouds under a painted gradient sky, with drifting fireflies, sparkle bursts and a springy bounce for every word.
import * as THREE from './kit/three.module.min.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { cine } from './kit/cine.js';

const BASE = new URL('./', import.meta.url).href;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SIZE = 3;                                  // island's largest side in world units

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// the library GLBs use KHR_mesh_quantization (normalised int16): bake to float before transforming, or values clamp to ±1
function toFloat(src) {
  const g = new THREE.BufferGeometry(); if (src.index) g.setIndex(src.index.clone());
  for (const [name, a] of Object.entries(src.attributes)) {
    const n = a.count, s = a.itemSize, arr = new Float32Array(n * s), get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < n; i++) for (let j = 0; j < s; j++) arr[i * s + j] = get[j].call(a, i);
    g.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  return g;
}

export function createWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.domElement.id = 'c'; document.body.prepend(renderer.domElement);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.5, 200);
  const C = cine(renderer, scene, camera, { exposure: 1.0, bloom: 0.2, bloomThreshold: 0.92, bloomRadius: 0.55, envIntensity: 0.65,
    grade: { sat: 1.15, contrast: 1.04, vignette: 0.1, grain: 0, tint: '#fffaf4' } });
  if (C.lite) C.bloom.enabled = false;
  renderer.toneMapping = THREE.NeutralToneMapping;   // keeps the pastel sky and painted textures saturated (ACES greys them)

  // ---------------------------------------------------------- sky dome (gradient + sun glow), not tone mapped
  const skyU = { top: { value: new THREE.Color('#8fd3ff') }, mid: { value: new THREE.Color('#cfeaff') }, bot: { value: new THREE.Color('#ffe7c2') }, glow: { value: new THREE.Color('#fff4d6') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, bot, glow; varying vec3 vD;
      void main(){ float h = vD.y; vec3 c = h > 0.02 ? mix(mid, top, smoothstep(0.02, 0.3, h)) : mix(bot, mid, smoothstep(-0.2, 0.02, h));
        float s = max(0.0, dot(vD, normalize(vec3(0.45, 0.5, -0.75)))); c += glow * pow(s, 8.0) * 0.55;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -1; scene.add(sky);

  // ---------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight('#fff6ea', '#b9a6dc', 1.05); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0da', 2.35); sun.position.set(4.5, 7.5, 5.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 1, far: 22 });
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#ffd9f0', 0.6); rim.position.set(-5, 3, -4); scene.add(rim);

  // ---------------------------------------------------------- clouds (one instanced puff mesh)
  const puffMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, emissive: new THREE.Color('#fff6fb'), emissiveIntensity: 0.38, envMapIntensity: 0.4 });
  const NP = 92, puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), puffMat, NP);
  puffs.receiveShadow = true; puffs.frustumCulled = false; scene.add(puffs);
  const puffData = [];
  { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    // a soft bed under the island
    for (let i = 0; i < 34; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.9; puffData.push({ x: Math.cos(a) * d, y: -1.75 - r() * 0.35 + d * 0.06, z: Math.sin(a) * d * 0.9, s: 0.42 + r() * 0.5, drift: 0, sy: 0.62 }); }
    // wisps in front, low
    for (let i = 0; i < 10; i++) puffData.push({ x: -3.4 + i * 0.75 + r() * 0.3, y: -2.25 - r() * 0.3, z: 1.6 + r() * 0.8, s: 0.35 + r() * 0.35, drift: 0, sy: 0.6 });
    // distant cloud banks
    for (let i = 0; i < 48; i++) { const bank = i % 4; puffData.push({ x: -14 + r() * 28, y: -3.2 + bank * 0.25 + r() * 0.9 + (bank === 3 ? 4.5 + r() * 2 : 0), z: -9 - r() * 9 - bank * 2, s: 0.9 + r() * 1.6, drift: 0.05 + r() * 0.1, sy: 0.55 }); }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V3(), ps = V3();
  function placePuffs(t) {
    puffData.forEach((p, i) => {
      let x = p.x; if (p.drift) { x = ((p.x + t * p.drift + 16) % 32 + 32) % 32 - 16; }
      const b = 1 + Math.sin(t * 0.6 + i) * 0.03;
      m4.compose(ps.set(x, p.y + Math.sin(t * 0.4 + i * 1.7) * 0.03, p.z), q, sc.set(p.s * b, p.s * p.sy * b, p.s * b)); puffs.setMatrixAt(i, m4);
    });
    puffs.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------- fireflies + sparkle bursts (additive points)
  const DOT = softDot();
  const NF = 70, ffGeo = new THREE.BufferGeometry(), ffPos = new Float32Array(NF * 3), ffSeed = [];
  for (let i = 0; i < NF; i++) { ffSeed.push({ a: Math.random() * 6.28, r: 1.2 + Math.random() * 1.6, y: Math.random() * 3.4 - 1.6, v: 0.08 + Math.random() * 0.12, p: Math.random() * 6 }); }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({ map: DOT, size: 0.09, color: new THREE.Color('#fff2b0').multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, toneMapped: false });
  const fireflies = new THREE.Points(ffGeo, ffMat); fireflies.frustumCulled = false; scene.add(fireflies);
  const NB = 220, bGeo = new THREE.BufferGeometry(), bPos = new Float32Array(NB * 3), bCol = new Float32Array(NB * 3), bs = [];
  for (let i = 0; i < NB; i++) { bs.push({ life: 0, v: V3(), c: new THREE.Color() }); bPos[i * 3 + 1] = -99; }
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3)); bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const bMat = new THREE.PointsMaterial({ map: DOT, size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const bursts = new THREE.Points(bGeo, bMat); bursts.frustumCulled = false; scene.add(bursts);
  let bNext = 0;
  function burst(n = 40, colors = ['#fff3a8', '#ffd1ea', '#ffffff'], from = null, power = 1) {
    const top = from || V3(0, island ? island.userData.h * 0.25 : 0.5, 0);
    for (let k = 0; k < n; k++) {
      const b = bs[bNext], i = bNext; bNext = (bNext + 1) % NB;
      const a = Math.random() * 6.28, up = 0.6 + Math.random() * 1.4;
      bPos[i * 3] = top.x + (Math.random() - 0.5) * 1.2; bPos[i * 3 + 1] = top.y + (Math.random() - 0.5) * 0.8; bPos[i * 3 + 2] = top.z + (Math.random() - 0.5) * 1.2;
      b.v.set(Math.cos(a) * (0.6 + Math.random()) * power, up * power, Math.sin(a) * (0.6 + Math.random()) * power);
      b.c.set(colors[k % colors.length]).multiplyScalar(1.6); b.life = 1;
    }
  }
  function stepBursts(dt) {
    for (let i = 0; i < NB; i++) {
      const b = bs[i]; if (b.life <= 0) continue;
      b.life -= dt * 0.75; b.v.y -= dt * 1.1; b.v.multiplyScalar(1 - dt * 0.9);
      bPos[i * 3] += b.v.x * dt; bPos[i * 3 + 1] += b.v.y * dt; bPos[i * 3 + 2] += b.v.z * dt;
      const f = Math.max(0, b.life); bCol[i * 3] = b.c.r * f; bCol[i * 3 + 1] = b.c.g * f; bCol[i * 3 + 2] = b.c.b * f;
      if (b.life <= 0) bPos[i * 3 + 1] = -99;
    }
    bGeo.attributes.position.needsUpdate = true; bGeo.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------- islands
  const loader = new GLTFLoader(), cache = new Map();
  const pivot = new THREE.Group(); scene.add(pivot);
  function load(id) {
    if (cache.has(id)) return cache.get(id);
    const p = loader.loadAsync(`${BASE}assets/${id}.glb`).then(g => {
      g.scene.updateMatrixWorld(true);
      const grp = new THREE.Group(); const box = new THREE.Box3();
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        const geo = toFloat(o.geometry); geo.applyMatrix4(o.matrixWorld); geo.rotateX(Math.PI / 2);   // the library stores them Z-up
        geo.computeBoundingBox(); box.union(geo.boundingBox);
        const mt = o.material; mt.envMapIntensity = 0.75; if (mt.map) mt.map.anisotropy = 8;
        const m = new THREE.Mesh(geo, mt); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      });
      const sz = box.getSize(V3()), k = SIZE / Math.max(sz.x, sz.y, sz.z), ctr = box.getCenter(V3());
      for (const m of grp.children) { m.geometry.translate(-ctr.x, -ctr.y, -ctr.z); m.geometry.scale(k, k, k); m.geometry.computeBoundingSphere(); }
      grp.userData = { id, h: sz.y * k, w: Math.max(sz.x, sz.z) * k };
      grp.visible = false; pivot.add(grp);
      return grp;
    });
    cache.set(id, p); return p;
  }

  let island = null, outgoing = null, inT = 1, outT = 1, spin = 0.11, spinBoost = 0, bounce = 0, bounceV = 0, dragV = 0, yaw = -0.5;
  const skyFrom = { top: new THREE.Color(), mid: new THREE.Color(), bot: new THREE.Color() }, skyTo = { top: new THREE.Color(), mid: new THREE.Color(), bot: new THREE.Color() };
  let skyT = 1;
  async function show(id, theme, instant = false) {
    const g = await load(id);
    if (island === g) { setSky(theme, instant); return g; }
    if (island) { outgoing = island; outT = instant ? 1 : 0; if (instant) outgoing.visible = false; }
    island = g; g.visible = true; inT = instant ? 1 : 0; yaw = -0.5;
    // cloud bed sits just under this island
    const bottom = -g.userData.h / 2;
    puffData.slice(0, 34).forEach(p => { p.y = bottom - 0.05 - Math.random() * 0.25 + Math.hypot(p.x, p.z) * 0.05; });
    puffData.slice(34, 44).forEach(p => { p.y = bottom - 0.5 - Math.random() * 0.3; });
    setSky(theme, instant);
    return g;
  }
  function setSky(theme, instant) {
    for (const k of ['top', 'mid', 'bot']) { skyFrom[k].copy(skyU[k].value); skyTo[k].set(theme.sky[k]); }
    skyT = instant ? 1 : 0; if (instant) for (const k of ['top', 'mid', 'bot']) skyU[k].value.copy(skyTo[k]);
  }

  // ---------------------------------------------------------- framing: put the island at screen point (cx, cy), px wide
  const fr = { cx: innerWidth / 2, cy: innerHeight * 0.33, px: innerWidth * 0.9 }, cur = { ...fr };
  let snap = true;
  function frame(cx, cy, px, instant = false) { fr.cx = cx; fr.cy = cy; fr.px = px; if (instant) snap = true; }
  const ease = t => 1 - Math.pow(1 - t, 3), back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  let tAll = 0;
  function update(dt) {
    tAll += dt;
    const W = innerWidth, H = innerHeight;
    if (snap) { Object.assign(cur, fr); snap = false; }
    const k = 1 - Math.exp(-dt * 4);
    cur.cx += (fr.cx - cur.cx) * k; cur.cy += (fr.cy - cur.cy) * k; cur.px += (fr.px - cur.px) * k;
    const fov = camera.fov * Math.PI / 180, dist = (SIZE * 1.12 * H) / (cur.px * 2 * Math.tan(fov / 2));
    const pitch = 0.2;
    camera.position.set(0, Math.sin(pitch) * dist + 0.15, Math.cos(pitch) * dist); camera.lookAt(0, 0.15, 0);
    camera.aspect = W / H; camera.setViewOffset(W, H, W / 2 - cur.cx, H / 2 - cur.cy, W, H); camera.updateProjectionMatrix();
    // spin, drag, bounce
    dragV *= Math.exp(-dt * 2.2); spinBoost *= Math.exp(-dt * 1.5);
    yaw += (spin + spinBoost) * dt + dragV * dt;
    bounceV += (-bounce * 140 - bounceV * 9) * dt; bounce += bounceV * dt;
    if (island) {
      inT = Math.min(1, inT + dt * 1.4);
      const s = (inT < 1 ? Math.max(0.001, back(inT)) : 1) * (1 + bounce);
      island.scale.set(s, s * (1 - bounce * 0.4), s);
      island.position.y = Math.sin(tAll * 0.9) * 0.05 + (1 - ease(inT)) * -1.2;
      island.rotation.y = yaw - (1 - ease(inT)) * 2.2;
    }
    if (outgoing) {
      outT = Math.min(1, outT + dt * 2.6); const s = Math.max(0.001, 1 - ease(outT));
      outgoing.scale.setScalar(s); outgoing.position.y = ease(outT) * 1.5; outgoing.rotation.y += dt * 4;
      if (outT >= 1) { outgoing.visible = false; outgoing = null; }
    }
    if (skyT < 1) { skyT = Math.min(1, skyT + dt * 1.2); for (const kk of ['top', 'mid', 'bot']) skyU[kk].value.copy(skyFrom[kk]).lerp(skyTo[kk], ease(skyT)); }
    placePuffs(tAll);
    for (let i = 0; i < NF; i++) {
      const f = ffSeed[i]; f.y += f.v * dt; if (f.y > 2.2) f.y = -1.8;
      const a = f.a + tAll * 0.12;
      ffPos[i * 3] = Math.cos(a) * f.r; ffPos[i * 3 + 1] = f.y + Math.sin(tAll * 1.3 + f.p) * 0.08; ffPos[i * 3 + 2] = Math.sin(a) * f.r;
    }
    ffGeo.attributes.position.needsUpdate = true;
    ffMat.opacity = 0.55 + Math.sin(tAll * 2) * 0.2;
    stepBursts(dt);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); C.resize(innerWidth, innerHeight); }
  addEventListener('resize', resize);

  return {
    renderer, scene, camera, C, load, show, frame, update, burst,
    render(dt) { C.render(dt); },
    kick(a = 0.05) { bounceV += a * 9; },
    celebrate() { spinBoost = 3.2; bounceV += 0.7; burst(120, ['#fff3a8', '#ffc2e0', '#bfe6ff', '#ffffff'], null, 1.5); },
    drag(v) { dragV += v; },
    get island() { return island; },
  };
}

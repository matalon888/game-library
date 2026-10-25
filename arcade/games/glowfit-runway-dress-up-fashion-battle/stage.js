// Glowfit Runway: the pastel runway set (built in code around the kawaii AI props): glossy pose disc, catwalk with
// bulb rows, w10 heart arch + giant bulb arches, lilac backdrop with light strips, tiered audience with chibi fan
// billboards holding heart signs, heart balloons, sparkles and bokeh. Plus the Glow Studio room (meta decor).
import * as THREE from './kit/three.module.min.js';
import { propMesh } from './dress.js';

export const RUN_Z0 = -6.2, POSE_Z = 0, STUDIO = new THREE.Vector3(40, 0, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function heartPath(x, cx, cy, s) {
  x.beginPath(); x.moveTo(cx, cy + s * 0.9);
  x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.75, cy - s * 1.25, cx, cy - s * 0.45);
  x.bezierCurveTo(cx + s * 0.75, cy - s * 1.25, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9); x.closePath();
}
export function heartShape(s = 1) {
  const h = new THREE.Shape(); h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-1.5 * s, 0.1 * s, -0.75 * s, 1.25 * s, 0, 0.45 * s);
  h.bezierCurveTo(0.75 * s, 1.25 * s, 1.5 * s, 0.1 * s, 0, -0.9 * s); return h;
}

export function buildStage(scene) {
  const H = { t: 0 };
  const phys = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, ...o });
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
  const add = (m, x = 0, y = 0, z = 0, p = scene) => { m.position.set(x, y, z); p.add(m); return m; };
  const soft = tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  H.soft = soft;

  // ---------------- sky gradient (lilac → pink)
  scene.background = tex(8, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c9a6f2'); g.addColorStop(0.45, '#e9b8ee'); g.addColorStop(1, '#ffd3ea'); x.fillStyle = g; x.fillRect(0, 0, w, h); });

  // ---------------- floor: glossy pastel with a soft radial glow
  const floorT = tex(512, 512, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, '#fbd0ec'); g.addColorStop(0.45, '#eab0e6'); g.addColorStop(1, '#b98ad8'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const floor = add(new THREE.Mesh(new THREE.CircleGeometry(16, 64), phys('#ffffff', { map: floorT, roughness: 0.45, clearcoat: 0.35 })), 0, 0, -3);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;

  // ---------------- pose disc (front) + catwalk
  const discM = phys('#fff4fb', { roughness: 0.22 }), rimM = std('#ff9fd0', { emissive: '#ff7fc0', emissiveIntensity: 1.4 });
  const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.8, 0.12, 72), discM), 0, 0.06, POSE_Z); disc.receiveShadow = true; disc.castShadow = true;
  const discTopT = tex(512, 512, (x, w) => { x.fillStyle = '#fff6fb'; x.fillRect(0, 0, w, w); const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,214,236,.0)'); g.addColorStop(0.7, 'rgba(255,190,226,.55)'); g.addColorStop(0.72, 'rgba(255,255,255,.9)'); g.addColorStop(0.75, 'rgba(255,190,226,.5)'); g.addColorStop(1, 'rgba(230,170,240,.8)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const discTop = add(new THREE.Mesh(new THREE.CircleGeometry(1.76, 72), phys('#ffffff', { map: discTopT, roughness: 0.18 })), 0, 0.121, POSE_Z); discTop.rotation.x = -Math.PI / 2; discTop.receiveShadow = true;
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(1.79, 0.025, 8, 120), rimM), 0, 0.1, POSE_Z); ring.rotation.x = Math.PI / 2;
  const runL = POSE_Z - RUN_Z0 + 1, runW = 1.5;
  const run = add(new THREE.Mesh(new THREE.BoxGeometry(runW, 0.1, runL), discM), 0, 0.05, RUN_Z0 + runL / 2 - 1.2); run.receiveShadow = true;
  const runTopT = tex(64, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f7c4ec'); g.addColorStop(0.12, '#fff3fa'); g.addColorStop(0.88, '#fff3fa'); g.addColorStop(1, '#f7c4ec'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const runTop = add(new THREE.Mesh(new THREE.PlaneGeometry(runW, runL), phys('#ffffff', { map: runTopT, roughness: 0.15 })), 0, 0.101, RUN_Z0 + runL / 2 - 1.2); runTop.rotation.x = -Math.PI / 2; runTop.receiveShadow = true;
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, runL - 1.2), rimM), s * (runW / 2 + 0.012), 0.085, RUN_Z0 + runL / 2 - 0.6);
  // bulb rows along the catwalk + around the disc
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffe2a8', emissiveIntensity: 2.6, roughness: 0.3 });
  const bulbPos = [];
  for (let z = RUN_Z0 + 0.2; z < POSE_Z - 1.6; z += 0.55) for (const s of [-1, 1]) bulbPos.push(V(s * (runW / 2 + 0.08), 0.13, z));
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) < 0) continue; bulbPos.push(V(Math.sin(a) * 1.95, 0.06, POSE_Z + Math.cos(a) * 1.95)); }
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 12, 8), bulbM, bulbPos.length);
  bulbPos.forEach((p, i) => bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(bulbs);

  // ---------------- giant bulb arches (mockup: rings of light behind the model)
  const archM = phys('#ffd9f0', { roughness: 0.25 });
  const archBulbs = [];
  for (const [r, z, y0] of [[0.95, -2.4, 0.1], [0.95, -4.4, 0.1]]) {
    const a = add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.075, 12, 64, Math.PI), archM), 0, y0 + 1.25, z);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.25, 16), archM), s * r, y0 + 0.62, z);
    for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI; archBulbs.push(V(Math.cos(t) * r, y0 + 1.25 + Math.sin(t) * r, z + 0.08)); }
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) archBulbs.push(V(s * r, y0 + 0.2 + k * 0.4, z + 0.09));
  }
  const ab = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 12, 8), bulbM, archBulbs.length);
  archBulbs.forEach((p, i) => ab.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); scene.add(ab);

  // ---------------- heart arch (AI prop) at the top of the runway
  const harch = propMesh('w10'); harch.scale.setScalar(2.3); harch.position.set(0, 0.1, RUN_Z0 - 0.3); scene.add(harch); H.harch = harch;

  // ---------------- backdrop: curved lilac wall with glowing strips + big neon heart
  const wallM = std('#c49be8', { roughness: 0.7 });
  const wall = add(new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 9, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), wallM), 0, 4.4, -1.5);
  wall.material.side = THREE.BackSide; wall.receiveShadow = true;
  const stripM = new THREE.MeshBasicMaterial({ color: '#fff0fb' });
  // the painted stage (art wave 1, assets/art/stage.webp) prints across the wall once it loads: its spotlights, balloons and
  // crowd glow behind the 3D arch. The 3:4 painting is cropped to its top band to fit the wide curved wall; the strips step aside.
  new THREE.TextureLoader().load('./assets/art/stage.webp', t => {
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(-1, 0.36); t.offset.set(1, 0.6); t.anisotropy = 4;
    wallM.map = t; wallM.color.set('#ffffff'); wallM.emissive = new THREE.Color('#ffffff'); wallM.emissiveMap = t; wallM.emissiveIntensity = 0.35; wallM.needsUpdate = true; stripM.visible = false;
  });
  for (let i = -6; i <= 6; i++) { if (Math.abs(i) < 1) continue; const a = i * 0.11; const s = add(new THREE.Mesh(new THREE.PlaneGeometry(0.12, 7), stripM), Math.sin(a) * 8.85, 4.6, -1.5 - Math.cos(a) * 8.85); s.lookAt(0, 4.6, -1.5); }
  const neon = add(new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(1.15), { depth: 0.08, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 20 }), std('#ff8fcf', { emissive: '#ff6fbf', emissiveIntensity: 1.3 })), 0, 6.3, -9.6);
  H.neon = neon;
  // truss with spot cans
  const trussM = std('#f6e8ff', { roughness: 0.4, metalness: 0.4 });
  add(new THREE.Mesh(new THREE.BoxGeometry(9, 0.16, 0.16), trussM), 0, 5.6, -2.2);
  for (let i = -3; i <= 3; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.32, 14), std('#ffffff', { roughness: 0.3 })), i * 1.25, 5.38, -2.2); c.rotation.x = 0.6; }
  // light cones from the truss (additive, soft)
  const coneM = new THREE.MeshBasicMaterial({ color: '#ffe3f6', transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  H.cones = [];
  for (const i of [-2, 0, 2]) { const c = add(new THREE.Mesh(new THREE.ConeGeometry(1.0, 5.4, 24, 1, true), coneM), i * 1.1, 2.75, -1.5); c.rotation.x = 0.28; H.cones.push(c); }

  // ---------------- audience risers (both sides) with chibi fan billboards + heart signs (filled in by setCrowd)
  const riserM = phys('#f0c9f4', { roughness: 0.45 }), riserEdge = std('#ffb3dd', { emissive: '#ff8fcf', emissiveIntensity: 0.9 });
  const RX = [1.1, 1.52, 1.94], RY = [0.16, 0.4, 0.64];
  for (const s of [-1, 1]) for (let r = 0; r < 3; r++) {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, RY[r], 5.6), riserM), s * RX[r], RY[r] / 2, -4.7); m.receiveShadow = true;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 5.6), riserEdge), s * (RX[r] - 0.21), RY[r] - 0.01, -4.7);
  }
  H.fans = [];
  H.crowdSlots = [];
  for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
    const z = -7.2 + k * 0.8 + (r % 2) * 0.38 + (s > 0 ? 0.2 : 0);
    if (z > -2.0) continue;
    H.crowdSlots.push({ p: V(s * (RX[r] + (Math.random() - 0.5) * 0.08), RY[r], z), s, r });
  }
  // heart balloons
  const balM = phys('#ff9fcf', { roughness: 0.15, clearcoat: 1, sheen: 0.5 });
  const balG = new THREE.ExtrudeGeometry(heartShape(0.28), { depth: 0.12, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 4, curveSegments: 16 }); balG.center();
  H.balloons = [];
  for (const [x, y, z, c] of [[-2.6, 3.4, -3.5, '#ff9fcf'], [2.7, 3.0, -2.8, '#ffb8de'], [-3.4, 2.4, -1.2, '#c9a6ff'], [3.3, 3.7, -4.6, '#ff8fc8'], [1.9, 4.2, -6.0, '#ffd1ea'], [-1.8, 4.6, -6.6, '#b9e9ff']]) {
    const b = add(new THREE.Mesh(balG, balM.clone()), x, y, z); b.material.color.set(c); b.userData.base = V(x, y, z); b.userData.ph = Math.random() * 6; H.balloons.push(b);
    const str = add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 4), std('#ffffff')), 0, -0.85, 0, b);
  }
  // bokeh dots far back (additive sprites)
  const bokM = new THREE.SpriteMaterial({ map: soft, color: '#ffe9fb', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  H.bokeh = [];
  for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(bokM.clone()); const a = (Math.random() - 0.5) * 2.2; sp.position.set(Math.sin(a) * 8, 1 + Math.random() * 7, -1.5 - Math.cos(a) * 8); const sc = 0.3 + Math.random() * 0.7; sp.scale.set(sc, sc, 1); sp.material.color.set(['#ffe9fb', '#ffd6f0', '#e8d6ff', '#fff3c9'][i % 4]); sp.userData.ph = Math.random() * 6; scene.add(sp); H.bokeh.push(sp); }

  // ---------------- trophy (w11) for the winner, warmed up (the gold reads dark without help)
  const trophy = propMesh('w11'); trophy.material = trophy.material.clone(); trophy.material.color.set('#ffe9a8'); trophy.material.emissive = new THREE.Color('#5a3b00'); trophy.material.metalness = 0.6; trophy.material.roughness = 0.25;
  trophy.scale.setScalar(0.42); trophy.visible = false; scene.add(trophy); H.trophy = trophy;

  H.update = (dt, T, hype = 0.2) => {
    for (const b of H.balloons) { b.position.y = b.userData.base.y + Math.sin(T * 0.9 + b.userData.ph) * 0.12; b.rotation.y = Math.sin(T * 0.5 + b.userData.ph) * 0.4; }
    for (const s of H.bokeh) s.material.opacity = 0.35 + 0.25 * Math.sin(T * 1.3 + s.userData.ph);
    bulbM.emissiveIntensity = 2.4 + Math.sin(T * 6) * 0.3 * hype;
    neon.material.emissiveIntensity = 1.2 + Math.sin(T * 2.2) * 0.25;
    H.cones.forEach((c, i) => { c.rotation.z = Math.sin(T * 0.6 + i * 2) * 0.18; });
    for (const f of H.fans) {
      const k = hype * (0.6 + 0.4 * Math.sin(T * 2 + f.ph));
      f.sp.position.y = f.base.y + Math.abs(Math.sin(T * (4 + f.ph % 2) + f.ph)) * 0.12 * k;
      if (f.sign) { f.sign.position.y = f.sp.position.y + 0.42 + Math.sin(T * 5 + f.ph) * 0.05 * k; f.sign.material.rotation = Math.sin(T * 3 + f.ph) * 0.25 * k; }
    }
  };
  // fans: billboards of the chibi girls (rendered in-engine at boot) + a heart / phone sign each
  H.setCrowd = (texes) => {
    const heartT = tex(128, 128, x => { x.fillStyle = '#fff'; heartPath(x, 64, 70, 46); x.fill(); x.fillStyle = '#ff6fb0'; heartPath(x, 64, 70, 36); x.fill(); x.fillStyle = 'rgba(255,255,255,.65)'; x.beginPath(); x.ellipse(46, 50, 10, 6, -0.6, 0, 7); x.fill(); });
    const lilT = tex(128, 128, x => { x.fillStyle = '#fff'; heartPath(x, 64, 70, 46); x.fill(); x.fillStyle = '#b98cff'; heartPath(x, 64, 70, 36); x.fill(); x.fillStyle = 'rgba(255,255,255,.65)'; x.beginPath(); x.ellipse(46, 50, 10, 6, -0.6, 0, 7); x.fill(); });
    const phoneT = tex(64, 128, x => { x.fillStyle = '#fff'; x.beginPath(); x.roundRect(8, 4, 48, 120, 12); x.fill(); x.fillStyle = '#ffd6ef'; x.beginPath(); x.roundRect(13, 12, 38, 100, 8); x.fill(); x.fillStyle = '#ff7fbf'; heartPath(x, 32, 62, 10); x.fill(); });
    H.crowdSlots.forEach((c, i) => {
      const t = texes[(i * 7 + c.r) % texes.length];
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.08 }));
      const sc = 0.92 + (i % 3) * 0.05; sp.scale.set(sc, sc, 1); sp.center.set(0.5, 0.0);
      sp.position.copy(c.p); scene.add(sp);
      let sign = null;
      if (i % 3 !== 2) {
        const st = i % 5 === 0 ? phoneT : i % 2 ? lilT : heartT;
        sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, alphaTest: 0.05 }));
        const ss = st === phoneT ? 0.22 : 0.36; sign.scale.set(st === phoneT ? ss * 0.5 : ss, ss, 1);
        sign.position.set(c.p.x - c.s * 0.2, c.p.y + 0.8, c.p.z + 0.12); scene.add(sign);
      }
      H.fans.push({ sp, sign, base: c.p.clone(), ph: Math.random() * 6 });
    });
  };
  return H;
}

// ---------------------------------------------------------------- Glow Studio (the room you decorate with stars)
export function buildStudio(scene) {
  const G = new THREE.Group(); G.position.copy(STUDIO); scene.add(G);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const wallT = tex(256, 256, (x, w) => { x.fillStyle = '#ffe1f1'; x.fillRect(0, 0, w, w); x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { heartPath(x, i * 32 + 16 + (j % 2) * 16, j * 32 + 16, 5); x.fill(); } });
  wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping; wallT.repeat.set(3, 2);
  const floorT = tex(256, 256, (x, w) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#f6dcff' : '#fff2fa'; x.fillRect(i * 32, j * 32, 32, 32); } });
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(2, 2);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 3.2), new THREE.MeshPhysicalMaterial({ map: floorT, roughness: 0.35, clearcoat: 0.6 })); fl.position.set(0, -0.06, 0); fl.receiveShadow = true; G.add(fl);
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 0.12), std('#ffffff', { map: wallT })); back.position.set(0, 1.4, -1.6); back.receiveShadow = true; G.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 3.2), std('#ffffff', { map: wallT })); left.position.set(-2.1, 1.4, 0); left.receiveShadow = true; G.add(left);
  // window with a soft sky + light shaft
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tex(64, 64, (x, w) => { const g = x.createLinearGradient(0, 0, 0, w); g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#ffd9f0'); x.fillStyle = g; x.fillRect(0, 0, w, w); x.fillStyle = '#fff'; x.beginPath(); x.arc(20, 40, 8, 0, 7); x.arc(30, 38, 10, 0, 7); x.arc(40, 41, 7, 0, 7); x.fill(); }) }));
  sky.position.set(-0.9, 1.65, -1.53); G.add(sky);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 4), std('#ffffff', { roughness: 0.3 })); frame.rotation.z = Math.PI / 4; frame.scale.set(1.15, 1.15, 1); frame.position.set(-0.9, 1.65, -1.52); G.add(frame);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.6), new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  shaft.position.set(-0.6, 1.0, -0.9); shaft.rotation.set(-0.7, 0.2, 0.1); G.add(shaft);
  // fairy-light garland
  const gl = []; for (let i = 0; i <= 18; i++) { const t = i / 18; gl.push(new THREE.Vector3(-2 + t * 4, 2.55 - Math.sin(t * Math.PI) * 0.25, -1.5)); }
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffc8e6', emissiveIntensity: 2.5 }), gl.length);
  gl.forEach((p, i) => lights.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))); G.add(lights);
  return G;
}

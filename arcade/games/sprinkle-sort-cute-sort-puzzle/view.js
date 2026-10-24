// Sprinkle Sort renderer: cute glass cups (lathe glass, pastel rim, a coaster, a tiny face on the glass, a heart-lid that
// pops on when a cup is sorted) standing on candy café shelves; the layers inside are textured chunks — strawberry
// sprinkles, grape jelly, mint boba, lemon stars, blueberry dots, peach swirl, bubblegum hearts, cocoa crunch — one
// instanced mesh per kind. Instanced star + heart particles for pours and wins.
// Everything lives in `group` (local units, cups stand along +y, the front of the glass faces +z).
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { CAP } from './logic.js';

const PI = Math.PI, V3 = THREE.Vector3;
export const KIND = [
  { name: 'Strawberry sprinkles', c: '#ff5b86', c2: '#ff9cb8', pat: 'sprinkles', emo: '🍓' },
  { name: 'Grape jelly', c: '#9b64ff', c2: '#c6a3ff', pat: 'cubes', emo: '🍇' },
  { name: 'Mint boba', c: '#3fd6a5', c2: '#a8f0d6', pat: 'boba', emo: '🍵' },
  { name: 'Lemon stars', c: '#ffc928', c2: '#fff09a', pat: 'stars', emo: '🍋' },
  { name: 'Blueberry dots', c: '#3ea6ff', c2: '#a9dcff', pat: 'dots', emo: '🫐' },
  { name: 'Peach swirl', c: '#ff8c4a', c2: '#ffc69a', pat: 'swirl', emo: '🍑' },
  { name: 'Bubblegum hearts', c: '#ff6fd0', c2: '#ffc0ec', pat: 'hearts', emo: '🩷' },
  { name: 'Cocoa crunch', c: '#9a5a3c', c2: '#d9a27c', pat: 'crunch', emo: '🍫' },
];
export const LH = 0.5;                       // layer height
export const R0 = 0.5, R1 = 0.6;             // glass inner radius at the bottom / top
export const CUP_H = CAP * LH + 0.42;        // glass height
export const SPX = 1.5, ROWY = 3.9;          // cup spacing, row spacing
export const FACES = ['happy', 'joy', 'sleepy', 'blink', 'wow'];
export const rAt = y => R0 + (R1 - R0) * Math.min(1, Math.max(0, y / CUP_H));

function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; return t; }
const heart = (x, cx, cy, r) => { x.beginPath(); x.moveTo(cx, cy + r); x.bezierCurveTo(cx - r * 1.5, cy, cx - r * 0.6, cy - r, cx, cy - r * 0.35); x.bezierCurveTo(cx + r * 0.6, cy - r, cx + r * 1.5, cy, cx, cy + r); x.fill(); };
const star = (x, cx, cy, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); };
const SPR = ['#ffffff', '#ffe36e', '#7ee8ff', '#ff9fd0', '#b9ff9a', '#c9a6ff'];
function layerTex(k) {
  return canvasTex(512, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, k.c2); g.addColorStop(0.18, k.c); g.addColorStop(1, k.c); x.fillStyle = g; x.fillRect(0, 0, w, h);
    let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    if (k.pat === 'sprinkles' || k.pat === 'crunch') {
      for (let i = 0; i < 150; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate(r() * PI); x.fillStyle = k.pat === 'crunch' ? ['#5a2f1c', '#f3d2b0', '#ffffff', '#c47a4f'][i % 4] : SPR[i % SPR.length]; x.beginPath(); x.roundRect(-9, -3, 18, 6, 3); x.fill(); x.restore(); }
    } else if (k.pat === 'boba') {
      for (let i = 0; i < 26; i++) { const cx = r() * w, cy = 20 + r() * (h - 30); const rg = x.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 14); rg.addColorStop(0, '#6b4a3e'); rg.addColorStop(1, '#2a1712'); x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, 13, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(cx - 4, cy - 5, 3.5, 0, 7); x.fill(); }
    } else if (k.pat === 'cubes') {
      for (let i = 0; i < 22; i++) { const cx = r() * w, cy = 16 + r() * (h - 24); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.roundRect(cx - 12, cy - 12, 24, 24, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc(cx - 5, cy - 5, 3, 0, 7); x.fill(); }
    } else if (k.pat === 'stars') { x.fillStyle = '#ffffff'; for (let i = 0; i < 18; i++) star(x, r() * w, 14 + r() * (h - 20), 9 + r() * 5); }
    else if (k.pat === 'dots') { for (let i = 0; i < 40; i++) { x.fillStyle = i % 3 ? '#ffffff' : '#1d5fb8'; x.beginPath(); x.arc(r() * w, 10 + r() * (h - 14), 6 + r() * 3, 0, 7); x.fill(); } }
    else if (k.pat === 'swirl') { x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 7; x.lineCap = 'round'; for (let i = 0; i < 10; i++) { const cx = i * 52 + 20, cy = 40 + (i % 2) * 40; x.beginPath(); x.arc(cx, cy, 16, 0, PI * 1.5); x.stroke(); } }
    else if (k.pat === 'hearts') { x.fillStyle = '#ffffff'; for (let i = 0; i < 18; i++) heart(x, r() * w, 14 + r() * (h - 22), 9 + r() * 4); }
    // a creamy seam on top of each layer
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, w, 5);
    x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, h - 4, w, 4);
  });
}
export function drawFace(x, kind, S = 256) {
  const u = S / 256; x.save(); x.scale(u, u);
  const ink = '#3a1838', ey = 120, ex = 46;
  x.fillStyle = 'rgba(255,90,140,.55)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(128 + s * 78, 152, 20, 12, 0, 0, 7); x.fill(); }
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 10;
  const openEye = (cx, big = 1) => { x.fillStyle = ink; x.beginPath(); x.ellipse(cx, ey, 16 * big, 21 * big, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - 5 * big, ey - 8 * big, 7 * big, 0, 7); x.fill(); x.beginPath(); x.arc(cx + 6 * big, ey + 7 * big, 3 * big, 0, 7); x.fill(); };
  const arcEye = cx => { x.beginPath(); x.arc(cx, ey + 9, 16, PI * 1.12, PI * 1.88); x.stroke(); };
  const lineEye = cx => { x.beginPath(); x.moveTo(cx - 14, ey + 2); x.lineTo(cx + 14, ey + 2); x.stroke(); };
  if (kind === 'happy') { openEye(128 - ex); openEye(128 + ex); x.lineWidth = 8; x.beginPath(); x.arc(128, 138, 12, 0.15 * PI, 0.85 * PI); x.stroke(); }
  else if (kind === 'joy') { arcEye(128 - ex); arcEye(128 + ex); x.fillStyle = ink; x.beginPath(); x.moveTo(108, 140); x.quadraticCurveTo(128, 176, 148, 140); x.closePath(); x.fill(); x.fillStyle = '#ff7aa6'; x.beginPath(); x.ellipse(128, 156, 9, 6, 0, 0, 7); x.fill(); }
  else if (kind === 'sleepy') { lineEye(128 - ex); lineEye(128 + ex); x.lineWidth = 7; x.beginPath(); x.ellipse(128, 150, 7, 8, 0, 0, 7); x.stroke(); }
  else if (kind === 'blink') { lineEye(128 - ex); lineEye(128 + ex); x.lineWidth = 8; x.beginPath(); x.arc(128, 138, 12, 0.15 * PI, 0.85 * PI); x.stroke(); }
  else if (kind === 'wow') { openEye(128 - ex, 1.15); openEye(128 + ex, 1.15); x.fillStyle = ink; x.beginPath(); x.ellipse(128, 156, 10, 12, 0, 0, 7); x.fill(); }
  x.restore();
}
function heartShape(k = 1) { const s = new THREE.Shape(); s.moveTo(0, -0.9 * k); s.bezierCurveTo(-0.2 * k, -0.6 * k, -1 * k, -0.2 * k, -1 * k, 0.3 * k); s.bezierCurveTo(-1 * k, 0.9 * k, -0.25 * k, 1 * k, 0, 0.55 * k); s.bezierCurveTo(0.25 * k, 1 * k, 1 * k, 0.9 * k, 1 * k, 0.3 * k); s.bezierCurveTo(1 * k, -0.2 * k, 0.2 * k, -0.6 * k, 0, -0.9 * k); return s; }
function starShape(r1 = 1, r0 = 0.48) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? r0 : r1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; }

export function createView(group) {
  const MAXC = 12;
  // layers: a tapered chunk per kind (unit radius, height LH, base at y=0)
  const layerGeo = new THREE.CylinderGeometry(1, 1, LH * 0.96, 36, 1, false); layerGeo.translate(0, LH * 0.48, 0);
  const layers = KIND.map(k => { const m = new THREE.InstancedMesh(layerGeo, new THREE.MeshPhysicalMaterial({ map: layerTex(k), roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.3, emissive: k.c, emissiveIntensity: 0.2 }), MAXC * CAP + 4); m.frustumCulled = false; m.castShadow = true; group.add(m); return m; });
  // glass
  const pts = []; const seg = 16;
  for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push(new THREE.Vector2(rAt(t * CUP_H) + 0.06, t * CUP_H)); }
  pts.unshift(new THREE.Vector2(0, -0.04), new THREE.Vector2(R0 + 0.02, -0.06));
  const glassGeo = new THREE.LatheGeometry(pts, 40);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.13, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false });
  const glass = new THREE.InstancedMesh(glassGeo, glassMat, MAXC); glass.frustumCulled = false; glass.renderOrder = 2; group.add(glass);
  // a soft vertical highlight streak on the glass
  const shineTex = canvasTex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, 24); x.fill(); });
  const shine = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, CUP_H * 0.7), new THREE.MeshBasicMaterial({ map: shineTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.8 }), MAXC); shine.frustumCulled = false; shine.renderOrder = 3; group.add(shine);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: '#ff9fd0', roughness: 0.2, clearcoat: 1, emissive: '#ff6fb3', emissiveIntensity: 0.1 });
  const rim = new THREE.InstancedMesh(new THREE.TorusGeometry(R1 + 0.07, 0.07, 10, 40), rimMat, MAXC); rim.frustumCulled = false; group.add(rim);
  const coasterGeo = new THREE.CylinderGeometry(R0 + 0.22, R0 + 0.26, 0.12, 32); coasterGeo.translate(0, -0.12, 0);
  const coaster = new THREE.InstancedMesh(coasterGeo, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 1 }), MAXC); coaster.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXC * 3), 3); coaster.frustumCulled = false; coaster.castShadow = true; group.add(coaster);
  // faces on the glass
  const faceGeo = new THREE.PlaneGeometry(0.92, 0.92);
  const faces = FACES.map(k => { const m = new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, x => drawFace(x, k)), transparent: true, depthWrite: false, toneMapped: false }), MAXC); m.frustumCulled = false; m.renderOrder = 4; group.add(m); return m; });
  // lids: a pink dome + heart topper
  const lidG = new THREE.SphereGeometry(R1 + 0.1, 32, 12, 0, PI * 2, 0, PI / 2); lidG.scale(1, 0.5, 1);
  const lid = new THREE.InstancedMesh(lidG, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, clearcoat: 1, emissiveIntensity: 0.1 }), MAXC); lid.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXC * 3), 3); lid.frustumCulled = false; lid.castShadow = true; group.add(lid);
  const hg = new THREE.ExtrudeGeometry(heartShape(0.2), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }); hg.translate(0, 0, -0.05);
  const topper = new THREE.InstancedMesh(hg, new THREE.MeshPhysicalMaterial({ color: '#ff4f9d', roughness: 0.2, clearcoat: 1, emissive: '#ff4f9d', emissiveIntensity: 0.2 }), MAXC); topper.frustumCulled = false; group.add(topper);

  // shelves (rebuilt by layout): glossy candy-pink planks with white scallops
  const shelfMat = new THREE.MeshPhysicalMaterial({ color: '#ffa9d4', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#ff7fbf', emissiveIntensity: 0.08 });
  const lipMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 1 });
  const shelves = new THREE.Group(); group.add(shelves);
  function setShelves(rows) {
    for (const c of shelves.children.slice()) { shelves.remove(c); c.geometry.dispose(); }
    for (const r of rows) {
      const w = r.w + 1.2, s = new THREE.Mesh(new RoundedBoxGeometry(w, 0.32, 1.9, 3, 0.14), shelfMat); s.position.set(r.x, r.y - 0.34, -0.1); s.receiveShadow = true; s.castShadow = true; shelves.add(s);
      const n = Math.max(3, Math.round(w / 0.5)); const sc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 14, 10), lipMat, n); const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m4.makeScale(1, 0.75, 0.6).setPosition(r.x - w / 2 + (i + 0.5) * w / n, r.y - 0.56, 0.86); sc.setMatrixAt(i, m4); } shelves.add(sc);
    }
  }

  // particles
  const PN = 500, plist = [], pmat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const shapes = [new THREE.ExtrudeGeometry(starShape(0.15, 0.07), { depth: 0.03, bevelEnabled: false }), new THREE.ExtrudeGeometry(heartShape(0.12), { depth: 0.03, bevelEnabled: false }), new THREE.CapsuleGeometry(0.035, 0.12, 2, 6)];
  const pms = shapes.map(g => { const m = new THREE.InstancedMesh(g, pmat, PN); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PN * 3), 3); m.count = 0; m.frustumCulled = false; m.renderOrder = 5; group.add(m); return m; });
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new V3(), pv = new V3();
  const P = {
    burst(x, y, z, colors, n = 14, { speed = 4, up = 2, size = 1, life = 0.8, grav = 9, spread = 0.2, kind = -1, vx = 0, vy = 0 } = {}) {
      for (let i = 0; i < n && plist.length < PN; i++) { const a = Math.random() * PI * 2, sp = speed * (0.35 + Math.random() * 0.8);
        plist.push({ k: kind >= 0 ? kind : i % 3, p: new V3(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.3, z + (Math.random() - 0.5) * spread * 0.4), v: new V3(Math.cos(a) * sp + vx, Math.sin(a) * sp * 0.6 + up + vy, (Math.random() - 0.3) * sp * 0.5), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      const cnt = [0, 0, 0];
      for (let k = plist.length - 1; k >= 0; k--) { const p = plist[k]; p.life -= dt; if (p.life <= 0) { plist.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.p.addScaledVector(p.v, dt); p.r += dt * 5; const f = p.life / p.max;
        e.set(p.r * 0.3, p.r * 0.5, p.r); q.setFromEuler(e); sv.setScalar(p.size * (0.35 + Math.min(1, f * 1.6) * 0.8)); tmp.compose(p.p, q, sv);
        const m = pms[p.k], i = cnt[p.k]++; m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); }
      pms.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
    },
  };

  const lc = layers.map(() => 0), fc = faces.map(() => 0);
  let ci = 0, li = 0;
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), cq = new THREE.Quaternion(), ce = new THREE.Euler(), col = new THREE.Color(), one = new V3(1, 1, 1);
  return {
    P, setShelves,
    begin() { ci = 0; li = 0; lc.fill(0); fc.fill(0); },
    /** one cup: x,y (base centre), tilt (rad, around z), squash, list of {k, s (0..1 grow)}, face index, lid (0..1 pop), coaster colour */
    cup(x, y, z, tilt, sq, list, face, lidK, coasterC) {
      if (ci >= MAXC) return;
      ce.set(0, 0, tilt); cq.setFromEuler(ce); M.compose(pv.set(x, y, z), cq, sv.set(1 + sq * 0.3, 1 - sq * 0.4, 1 + sq * 0.3));
      glass.setMatrixAt(ci, M); coaster.setMatrixAt(ci, M); coaster.setColorAt(ci, col.set(coasterC));
      L.makeRotationX(PI / 2).setPosition(0, CUP_H + 0.02, 0); rim.setMatrixAt(ci, tmp.multiplyMatrices(M, L));
      L.makeTranslation(-(R1 - 0.12), CUP_H * 0.55, 0.42); L.multiply(tmp.makeRotationY(-0.5)); shine.setMatrixAt(ci, tmp.multiplyMatrices(M, L));
      let yy = 0;
      for (const it of list) {
        if (it.s <= 0.001) continue; const r = rAt(yy + LH * 0.5) - 0.02, h = it.s;
        L.compose(pv.set(0, yy, 0), q.identity(), sv.set(r, h, r)); const m = layers[it.k]; if (lc[it.k] < m.count + 1e9) { m.setMatrixAt(lc[it.k]++, tmp.multiplyMatrices(M, L)); }
        yy += LH * h;
      }
      const fm = faces[face]; L.makeTranslation(0, 0.95, rAt(0.95) + 0.075); fm.setMatrixAt(fc[face]++, tmp.multiplyMatrices(M, L));
      const ls = Math.max(0.001, lidK); L.compose(pv.set(0, CUP_H + 0.02 + (1 - Math.min(1, lidK)) * 0.6, 0), q.identity(), sv.set(ls, ls, ls)); lid.setMatrixAt(ci, tmp.multiplyMatrices(M, L)); lid.setColorAt(ci, col.set(coasterC).lerp(new THREE.Color('#ff9fd0'), 0.25));
      L.compose(pv.set(0, CUP_H + 0.02 + 0.36 * ls + (1 - Math.min(1, lidK)) * 0.6, 0.0), q.identity(), sv.set(ls, ls, ls)); topper.setMatrixAt(ci, tmp.multiplyMatrices(M, L));
      ci++;
    },
    end() {
      for (const m of [glass, coaster, rim, shine, lid, topper]) { m.count = ci; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      layers.forEach((m, i) => { m.count = lc[i]; m.instanceMatrix.needsUpdate = true; });
      faces.forEach((m, i) => { m.count = fc[i]; m.instanceMatrix.needsUpdate = true; });
    },
  };
}

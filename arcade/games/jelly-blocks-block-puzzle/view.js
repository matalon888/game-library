// Jelly Blocks board renderer: a lilac frosted-glass board with a glossy strawberry-milk rim and pearl studs, squishy
// jelly cubes (one instanced mesh, per-block colour + a soft inner glow) wearing tiny faces (instanced decals, one mesh
// per expression), kawaii charms from the library sitting on milk-jelly blocks, a glassy tray for the three pieces, a
// placement ghost and instanced star + heart sparkles.
// Everything lives in `group` (local units: one cell = 1, board centred on the origin, blocks rise along +z).
import { THREE } from './kit/hc.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { N } from './blocks.js';

const PI = Math.PI, V3 = THREE.Vector3;
// strawberry, grape, mint, butter, sky, peach, bubblegum
export const PAL = ['#ff4f74', '#9d6bff', '#2fd39c', '#ffc62e', '#3fb0ff', '#ff8a3d', '#ff6cc8'];
export const PEARL = '#fff2fa';
export const FRAME = 4.62;
export const TRAY_Y = -FRAME - 2.0, TRAY_H = 3.0, SLOT_X = [-3.05, 0, 3.05], TRAY_S = 0.6;
export const STACK = { top: FRAME + 0.1, bot: TRAY_Y - TRAY_H / 2 - 0.15 };
export const cellPos = (x, y) => [x - (N - 1) / 2, (N - 1) / 2 - y];
export const FACES = ['happy', 'joy', 'sleepy', 'blink', 'wow'];
const H = 0.58;   // jelly height

function jellyGeo() {
  const g = new RoundedBoxGeometry(0.95, 0.95, H, 5, 0.25); g.translate(0, 0, H / 2);
  // baked jelly shading: lighter crown, deeper base, a touch brighter toward the upper left (multiplies the instance colour)
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / H, x = p.getX(i), y = p.getY(i);
    const k = Math.min(1.12, 0.7 + 0.36 * z + (-x + y) * 0.06);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function glowMat(base, k = 0.22) {   // instance colour also feeds the emissive term: jelly glows from inside instead of going muddy
  base.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * ${k.toFixed(2)};\n#endif`);
  };
  return base;
}
export function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

/** a kawaii face on a transparent square: eyes, blush, mouth + the jelly's specular highlight */
export function drawFace(x, kind, S = 256, shine = true) {
  const u = S / 256;
  x.save(); x.scale(u, u);
  if (shine) {
    x.fillStyle = 'rgba(255,255,255,.78)'; x.beginPath(); x.ellipse(62, 50, 34, 15, -0.55, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(104, 32, 7, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(206, 214, 22, 8, -0.6, 0, 7); x.fill();
  }
  const ink = '#3a1838', ey = 142, ex = 50;
  x.fillStyle = 'rgba(255,90,140,.5)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(128 + s * 82, 174, 22, 13, 0, 0, 7); x.fill(); }
  x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 11;
  const openEye = (cx, big = 1) => {
    x.fillStyle = ink; x.beginPath(); x.ellipse(cx, ey, 18 * big, 24 * big, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - 6 * big, ey - 9 * big, 8 * big, 0, 7); x.fill(); x.beginPath(); x.arc(cx + 7 * big, ey + 8 * big, 3.5 * big, 0, 7); x.fill();
  };
  const arcEye = cx => { x.beginPath(); x.arc(cx, ey + 10, 18, PI * 1.12, PI * 1.88); x.stroke(); };
  const lineEye = cx => { x.beginPath(); x.moveTo(cx - 14, ey + 2); x.lineTo(cx + 14, ey + 2); x.stroke(); };
  if (kind === 'happy') { openEye(128 - ex); openEye(128 + ex); x.lineWidth = 9; x.beginPath(); x.arc(128, 158, 13, 0.15 * PI, 0.85 * PI); x.stroke(); }
  else if (kind === 'joy') { arcEye(128 - ex); arcEye(128 + ex); x.fillStyle = ink; x.beginPath(); x.moveTo(108, 160); x.quadraticCurveTo(128, 196, 148, 160); x.closePath(); x.fill(); x.fillStyle = '#ff7aa6'; x.beginPath(); x.ellipse(128, 176, 9, 6, 0, 0, 7); x.fill(); }
  else if (kind === 'sleepy') { lineEye(128 - ex); lineEye(128 + ex); x.lineWidth = 8; x.beginPath(); x.ellipse(128, 168, 7, 8, 0, 0, 7); x.stroke(); }
  else if (kind === 'blink') { lineEye(128 - ex); lineEye(128 + ex); x.lineWidth = 9; x.beginPath(); x.arc(128, 158, 13, 0.15 * PI, 0.85 * PI); x.stroke(); }
  else if (kind === 'wow') { openEye(128 - ex, 1.15); openEye(128 + ex, 1.15); x.fillStyle = ink; x.beginPath(); x.ellipse(128, 176, 10, 12, 0, 0, 7); x.fill(); }
  x.restore();
}
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function slab(w, h, r, depth, bevel = 0.1) {
  const g = new THREE.ExtrudeGeometry(rrect(w, h, r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 12 });
  g.translate(0, 0, -depth); return g;
}
function rim(w, h, r, t, depth) {
  const s = rrect(w + t * 2, h + t * 2, r + t); s.holes.push(rrect(w, h, r));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 6, curveSegments: 14 });
  g.translate(0, 0, -depth * 0.35); return g;
}
function starShape(r1 = 1, r0 = 0.48) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? r0 : r1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; }
export function heartShape(k = 1) { const s = new THREE.Shape(); s.moveTo(0, -0.9 * k); s.bezierCurveTo(-0.2 * k, -0.6 * k, -1 * k, -0.2 * k, -1 * k, 0.3 * k); s.bezierCurveTo(-1 * k, 0.9 * k, -0.25 * k, 1 * k, 0, 0.55 * k); s.bezierCurveTo(0.25 * k, 1 * k, 1 * k, 0.9 * k, 1 * k, 0.3 * k); s.bezierCurveTo(1 * k, -0.2 * k, 0.2 * k, -0.6 * k, 0, -0.9 * k); return s; }

export function createView(group, gemParts) {
  const BLOCK = jellyGeo();
  const blockMat = glowMat(new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55 }), 0.16);
  const CAP = 230;
  const blocks = new THREE.InstancedMesh(BLOCK, blockMat, CAP); blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  blocks.castShadow = true; blocks.receiveShadow = true; blocks.frustumCulled = false; group.add(blocks);
  // faces: one decal mesh per expression
  const faceGeo = new THREE.PlaneGeometry(0.86, 0.86);
  const faces = FACES.map(k => {
    const tex = canvasTex(256, 256, x => drawFace(x, k));
    const m = new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }), CAP);
    m.frustumCulled = false; m.renderOrder = 1; group.add(m); return m;
  });
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false });
  const ghost = new THREE.InstancedMesh(BLOCK, ghostMat, 9); ghost.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(27), 3); ghost.frustumCulled = false; ghost.renderOrder = 2; group.add(ghost);
  const gems = gemParts.map(p => { const m = new THREE.InstancedMesh(p.geo, p.mat, 48); m.castShadow = true; m.frustumCulled = false; group.add(m); return m; });

  // board: frosted lilac slab with soft cell wells, a glossy strawberry-milk rim and pearl studs
  const wells = canvasTex(1024, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c7a3f2'); g.addColorStop(1, '#b38ae8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    // faint hearts in the frosting
    x.fillStyle = 'rgba(255,255,255,.16)';
    for (let i = 0; i < 40; i++) { const px = Math.random() * w, py = Math.random() * h, r = 6 + Math.random() * 8; x.beginPath(); x.moveTo(px, py + r); x.bezierCurveTo(px - r * 1.4, py, px - r * 0.6, py - r, px, py - r * 0.35); x.bezierCurveTo(px + r * 0.6, py - r, px + r * 1.4, py, px, py + r); x.fill(); }
    const m = 1024 * (FRAME - N / 2) / (FRAME * 2), cs = (w - 2 * m) / N;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const px = m + xx * cs + 6, py = m + yy * cs + 6, s = cs - 12;
      x.fillStyle = (xx + yy) % 2 ? '#9f74dc' : '#a77ee0'; x.beginPath(); x.roundRect(px, py, s, s, 26); x.fill();
      const gg = x.createLinearGradient(0, py, 0, py + s); gg.addColorStop(0, 'rgba(70,30,130,.35)'); gg.addColorStop(0.35, 'rgba(70,30,130,0)'); gg.addColorStop(1, 'rgba(255,230,255,.35)');
      x.fillStyle = gg; x.fill();
    }
  });
  const frost = new THREE.MeshPhysicalMaterial({ map: wells, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.35 });
  const plain = new THREE.MeshPhysicalMaterial({ color: '#c39ff0', roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.4 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#c7a4f2', roughness: 0.5 });
  const pink = new THREE.MeshPhysicalMaterial({ color: '#ff7fbf', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6, emissive: '#ff5fa8', emissiveIntensity: 0.1 });
  const lilac = new THREE.MeshPhysicalMaterial({ color: '#ff9fd0', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.6, emissive: '#ff6fb3', emissiveIntensity: 0.08 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: '#fffafd', roughness: 0.15, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.5, envMapIntensity: 1.4 });
  const boardMesh = new THREE.Mesh(slab(FRAME * 2, FRAME * 2, 0.6, 0.45), [frost, sideMat]);
  { const uv = boardMesh.geometry.attributes.uv, p = boardMesh.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + FRAME) / (FRAME * 2), (p.getY(i) + FRAME) / (FRAME * 2)); }
  boardMesh.receiveShadow = true; group.add(boardMesh);
  const frame = new THREE.Mesh(rim(FRAME * 2, FRAME * 2, 0.6, 0.34, 0.5), pink); frame.castShadow = true; frame.receiveShadow = true; group.add(frame);
  const studG = new THREE.SphereGeometry(0.12, 16, 12), studN = 36, studs = new THREE.InstancedMesh(studG, pearl, studN), m4 = new THREE.Matrix4();
  { const R = FRAME + 0.17, per = studN / 4; let i = 0;
    for (let sIdx = 0; sIdx < 4; sIdx++) for (let k = 0; k < per; k++) {
      const t = (k + 0.5) / per * 2 - 1, L = R - 0.45;
      const [x, y] = sIdx === 0 ? [t * L, R] : sIdx === 1 ? [R, -t * L] : sIdx === 2 ? [-t * L, -R] : [-R, t * L];
      m4.makeTranslation(x, y, 0.33); studs.setMatrixAt(i++, m4);
    } }
  group.add(studs);
  // tray
  const trayW = FRAME * 2;
  const tray = new THREE.Mesh(slab(trayW, TRAY_H, 0.7, 0.3), [plain, sideMat]); tray.position.y = TRAY_Y; tray.receiveShadow = true; group.add(tray);
  const trayRim = new THREE.Mesh(rim(trayW, TRAY_H, 0.7, 0.24, 0.34), lilac); trayRim.position.y = TRAY_Y; trayRim.castShadow = true; group.add(trayRim);
  const dotM = new THREE.MeshBasicMaterial({ color: '#e8d6ff', toneMapped: false });
  for (const x of [-1.52, 1.52]) for (let k = -2; k <= 2; k++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), dotM); d.position.set(x, TRAY_Y + k * 0.42, 0.02); group.add(d); }

  // particles (local space): little stars and hearts, alternating
  const PN = 600, plist = [];
  const pmat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const shapes = [new THREE.ExtrudeGeometry(starShape(0.16, 0.075), { depth: 0.03, bevelEnabled: false }), new THREE.ExtrudeGeometry(heartShape(0.13), { depth: 0.03, bevelEnabled: false }), new THREE.SphereGeometry(0.07, 8, 6)];
  const pms = shapes.map(g => { const m = new THREE.InstancedMesh(g, pmat, PN); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PN * 3), 3); m.count = 0; m.frustumCulled = false; m.renderOrder = 3; group.add(m); return m; });
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new V3(), pv = new V3();
  const P = {
    burst(x, y, z, colors, n = 14, { speed = 4, up = 2, size = 1, life = 0.8, grav = 9, spread = 0.2 } = {}) {
      for (let i = 0; i < n && plist.length < PN; i++) { const a = Math.random() * PI * 2, sp = speed * (0.35 + Math.random() * 0.8);
        plist.push({ k: i % 3, p: new V3(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z), v: new V3(Math.cos(a) * sp, Math.sin(a) * sp, up * (0.5 + Math.random())), life, max: life, size: size * (0.6 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      const cnt = [0, 0, 0];
      for (let k = plist.length - 1; k >= 0; k--) { const p = plist[k]; p.life -= dt; if (p.life <= 0) { plist.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.v.multiplyScalar(1 - dt * 1.2); p.p.addScaledVector(p.v, dt); p.r += dt * 4; const f = p.life / p.max;
        e.set(0, 0, p.r); q.setFromEuler(e); sv.setScalar(p.size * (0.3 + Math.min(1, f * 1.6) * 0.9)); tmp.compose(p.p, q, sv);
        const m = pms[p.k], i = cnt[p.k]++; m.setMatrixAt(i, tmp); m.instanceColor.setXYZ(i, p.c.r, p.c.g, p.c.b); }
      pms.forEach((m, i) => { m.count = cnt[i]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
    },
  };

  const gc = gems.map(() => 0), fc = faces.map(() => 0);
  let bi = 0;
  const fq = new THREE.Quaternion();
  return {
    blocks, ghost, P, boardMesh, tray,
    begin() { bi = 0; gc.fill(0); fc.fill(0); },
    /** one jelly: local pos, scale (sx = width, sz = height squash), colour, optional charm (gem) or face index, tilt */
    block(x, y, z, s, c, gem = -1, t = 0, rx = 0, ry = 0, face = 0, sq = 0) {
      if (bi >= CAP || s <= 0.001) return;
      const sx = s * (1 + sq * 0.35), sz = s * (1 - sq * 0.6);
      e.set(rx, ry, 0); q.setFromEuler(e); pv.set(x, y, z); sv.set(sx, sx, Math.max(0.05, sz)); tmp.compose(pv, q, sv); blocks.setMatrixAt(bi, tmp); blocks.setColorAt(bi, c); bi++;
      if (gem >= 0 && gems[gem] && gc[gem] < 48) {
        e.set(rx, Math.sin(t * 1.6 + x) * 0.3 + ry, Math.sin(t * 2 + y) * 0.08); q.setFromEuler(e); pv.set(x, y + 0.02 * s, z + (H + 0.12) * sz); sv.setScalar(0.66 * s); tmp.compose(pv, q, sv);
        gems[gem].setMatrixAt(gc[gem]++, tmp);
      } else if (face >= 0 && faces[face] && fc[face] < CAP) {
        // the face rides on the jelly's crown (follows the squash)
        e.set(rx, ry, 0); fq.setFromEuler(e); const top = new V3(0, 0, H * sz + 0.006).applyQuaternion(fq);
        pv.set(x + top.x, y + top.y, z + top.z); sv.set(sx, sx, 1); tmp.compose(pv, fq, sv); faces[face].setMatrixAt(fc[face]++, tmp);
      }
    },
    ghostCells(list, c) {
      ghost.count = 0; if (!list) return;
      list.forEach(([gx, gy], i) => { const [x, y] = cellPos(gx, gy); tmp.compose(pv.set(x, y, 0.02), q.identity(), sv.set(0.98, 0.98, 0.45)); ghost.setMatrixAt(i, tmp); ghost.setColorAt(i, c); });
      ghost.count = list.length; ghost.instanceMatrix.needsUpdate = true; if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
    },
    end() {
      blocks.count = bi; blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true;
      gems.forEach((m, i) => { m.count = gc[i]; m.instanceMatrix.needsUpdate = true; });
      faces.forEach((m, i) => { m.count = fc[i]; m.instanceMatrix.needsUpdate = true; });
    },
  };
}

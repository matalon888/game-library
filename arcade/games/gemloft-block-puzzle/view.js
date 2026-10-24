// Gemloft board renderer: a plum-velvet jewellery-box board with a gold rim, emerald-cut jewel blocks (one instanced
// mesh, per-block colour + a soft inner glow), the gems from the AI 3D library sitting on pearl blocks, a velvet tray
// for the three offered pieces, a placement ghost, the line-clear preview and instanced sparkle particles.
// Everything lives in `group` (local units: one cell = 1, board centred on the origin, blocks rise along +z).
import { THREE } from './kit/hc.js';
import { N } from './blocks.js';

const PI = Math.PI, V3 = THREE.Vector3;
export const PAL = ['#f0123f', '#1f62ff', '#0fb85c', '#ffaa0a', '#8f3dff', '#ff4fa3', '#08c2da'];
export const PEARL = '#fff3e6';
export const FRAME = 4.62;                 // half-size of the gold rim
export const TRAY_Y = -FRAME - 2.15, TRAY_H = 3.4, SLOT_X = [-3.05, 0, 3.05], TRAY_S = 0.56;
export const STACK = { top: FRAME + 0.1, bot: TRAY_Y - TRAY_H / 2 - 0.15 };
export const cellPos = (x, y) => [x - (N - 1) / 2, (N - 1) / 2 - y];

// emerald-cut block: octagonal girdle, two crown steps, a flat table (flat-shaded facets catch the studio reflections)
function jewelGeo() {
  const L = [[0, 0.47, 0.13], [0.19, 0.47, 0.13], [0.29, 0.415, 0.115], [0.355, 0.31, 0.085]];
  const ring = (z, h, c) => [[h - c, h], [h, h - c], [h, -(h - c)], [h - c, -h], [-(h - c), -h], [-h, -(h - c)], [-h, h - c], [-(h - c), h]].map(([x, y]) => new V3(x, y, z));
  const R = L.map(l => ring(...l)), pos = [];
  const tri = (a, b, c, out) => { const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)); if (n.dot(out) < 0) [b, c] = [c, b]; pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
  for (let l = 0; l < R.length - 1; l++) for (let k = 0; k < 8; k++) {
    const a = R[l][k], b = R[l][(k + 1) % 8], c = R[l + 1][(k + 1) % 8], d = R[l + 1][k];
    const out = new V3().addVectors(a, c).multiplyScalar(0.5).setZ(0).normalize().add(new V3(0, 0, l > 0 ? 0.6 : 0));
    tri(a, b, c, out); tri(a, c, d, out);
  }
  const top = R[R.length - 1], ctr = new V3(0, 0, L[L.length - 1][0]);
  for (let k = 0; k < 8; k++) tri(ctr, top[k], top[(k + 1) % 8], new V3(0, 0, 1));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  // baked facet shading: table bright, crown facets lit from the upper left, girdle darker (reads as a cut stone anywhere)
  const nrm = g.attributes.normal, cols = new Float32Array(nrm.count * 3), Ld = new V3(-0.45, 0.55, 0.7).normalize(), n = new V3();
  for (let i = 0; i < nrm.count; i++) { n.fromBufferAttribute(nrm, i); const k = 0.5 + 0.5 * Math.max(0, n.dot(Ld)) + (n.z > 0.95 ? 0.12 : 0); cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = Math.min(1.1, k); }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}
function glowMat(base) {   // instance colour also feeds the emissive term: jewels glow from inside instead of going muddy
  base.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * 0.12;\n#endif');
  };
  return base;
}
function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function slab(w, h, r, depth, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(rrect(w, h, r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -depth); return g;
}
function rim(w, h, r, t, depth) {   // a rounded rectangular frame
  const s = rrect(w + t * 2, h + t * 2, r + t); s.holes.push(rrect(w, h, r));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 4, curveSegments: 12 });
  g.translate(0, 0, -depth * 0.35); return g;
}

export function createView(group, gemParts) {
  const BLOCK = jewelGeo();
  const blockMat = glowMat(new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.1, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.7, iridescence: 0.18, iridescenceIOR: 1.6, sheen: 0.2, sheenColor: new THREE.Color('#ffffff') }));
  const CAP = 220;
  const blocks = new THREE.InstancedMesh(BLOCK, blockMat, CAP); blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  blocks.castShadow = true; blocks.receiveShadow = true; blocks.frustumCulled = false; group.add(blocks);
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false });
  const ghost = new THREE.InstancedMesh(BLOCK, ghostMat, 9); ghost.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(27), 3); ghost.frustumCulled = false; ghost.renderOrder = 2; group.add(ghost);
  const gems = gemParts.map(p => { const m = new THREE.InstancedMesh(p.geo, p.mat, 48); m.castShadow = true; m.frustumCulled = false; group.add(m); return m; });

  // board: velvet slab with cell wells, gold rim, little gold studs
  const wells = canvasTex(1024, 1024, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h * 0.4, 50, w / 2, h / 2, w * 0.75); g.addColorStop(0, '#4a2a66'); g.addColorStop(1, '#2a1640'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,220,255,${Math.random() * 0.03})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const m = 1024 * (FRAME - N / 2) / (FRAME * 2), cs = (w - 2 * m) / N;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const px = m + xx * cs + 5, py = m + yy * cs + 5, s = cs - 10;
      x.fillStyle = 'rgba(16,6,28,.55)'; x.beginPath(); x.roundRect(px, py, s, s, 14); x.fill();
      const gg = x.createLinearGradient(0, py, 0, py + s); gg.addColorStop(0, 'rgba(0,0,0,.35)'); gg.addColorStop(0.3, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(255,200,255,.10)');
      x.fillStyle = gg; x.fill(); x.strokeStyle = 'rgba(255,215,140,.10)'; x.lineWidth = 2; x.stroke();
    }
  });
  const velvet = new THREE.MeshPhysicalMaterial({ map: wells, roughness: 0.82, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#d9a3ff'), envMapIntensity: 0.5 });
  const plainVelvet = new THREE.MeshPhysicalMaterial({ color: '#3a2152', roughness: 0.85, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#d9a3ff'), envMapIntensity: 0.5 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#2a1640', roughness: 0.7 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#f6c35a', metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.5 });
  const boardMesh = new THREE.Mesh(slab(FRAME * 2, FRAME * 2, 0.5, 0.45), [velvet, sideMat]);
  // planar UVs for the face of the extrude (it maps world x,y by default; normalise to 0..1)
  { const uv = boardMesh.geometry.attributes.uv, p = boardMesh.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + FRAME) / (FRAME * 2), (p.getY(i) + FRAME) / (FRAME * 2)); }
  boardMesh.receiveShadow = true; group.add(boardMesh);
  const frame = new THREE.Mesh(rim(FRAME * 2, FRAME * 2, 0.5, 0.26, 0.42), gold); frame.castShadow = true; frame.receiveShadow = true; group.add(frame);
  const studG = new THREE.SphereGeometry(0.17, 16, 12), studs = new THREE.InstancedMesh(studG, gold, 4), m4 = new THREE.Matrix4();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => { m4.makeTranslation(sx * (FRAME + 0.13), sy * (FRAME + 0.13), 0.38); studs.setMatrixAt(i, m4); }); group.add(studs);
  // tray
  const trayW = FRAME * 2;
  const tray = new THREE.Mesh(slab(trayW, TRAY_H, 0.6, 0.35), [plainVelvet, sideMat]); tray.position.y = TRAY_Y; tray.receiveShadow = true; group.add(tray);
  const trayRim = new THREE.Mesh(rim(trayW, TRAY_H, 0.6, 0.2, 0.3), gold); trayRim.position.y = TRAY_Y; trayRim.castShadow = true; group.add(trayRim);
  const divM = new THREE.MeshStandardMaterial({ color: '#25123a', roughness: 0.9 });
  for (const x of [-1.52, 1.52]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, TRAY_H - 0.6, 0.02), divM); d.position.set(x, TRAY_Y, 0.01); group.add(d); }

  // particles (local space)
  const PN = 700, plist = [], pm = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), PN);
  pm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PN * 3), 3); pm.count = 0; pm.frustumCulled = false; pm.renderOrder = 3; group.add(pm);
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new V3(), pv = new V3(), col = new THREE.Color();
  const P = {
    burst(x, y, z, colors, n = 14, { speed = 4, up = 2, size = 1, life = 0.8, grav = 9, spread = 0.2 } = {}) {
      for (let i = 0; i < n && plist.length < PN; i++) { const a = Math.random() * PI * 2, sp = speed * (0.35 + Math.random() * 0.8);
        plist.push({ p: new V3(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z), v: new V3(Math.cos(a) * sp, Math.sin(a) * sp, up * (0.5 + Math.random())), life, max: life, size: size * (0.5 + Math.random() * 0.8), c: new THREE.Color(colors[i % colors.length]), r: Math.random() * 6, g: grav }); }
    },
    update(dt) {
      let i = 0;
      for (let k = plist.length - 1; k >= 0; k--) { const p = plist[k]; p.life -= dt; if (p.life <= 0) { plist.splice(k, 1); continue; }
        p.v.y -= p.g * dt; p.v.multiplyScalar(1 - dt * 1.2); p.p.addScaledVector(p.v, dt); p.r += dt * 7; const f = p.life / p.max;
        e.set(p.r, p.r * 0.7, 0); q.setFromEuler(e); sv.setScalar(p.size * (0.25 + f * 0.9)); tmp.compose(p.p, q, sv); pm.setMatrixAt(i, tmp);
        pm.instanceColor.setXYZ(i, p.c.r * (0.8 + f), p.c.g * (0.8 + f), p.c.b * (0.8 + f)); i++; }
      pm.count = i; pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
    },
  };

  // per-frame writer: the game hands over a list of block sprites
  const gc = gems.map(() => 0);
  let bi = 0, gi = 0;
  return {
    blocks, ghost, P, boardMesh, tray,
    begin() { bi = 0; gc.fill(0); gi = 0; },
    /** one block: local pos, uniform scale, colour (THREE.Color), optional gem type + spin, tilt */
    block(x, y, z, s, c, gem = -1, t = 0, rx = 0, ry = 0) {
      if (bi >= CAP || s <= 0.001) return;
      e.set(rx, ry, 0); q.setFromEuler(e); pv.set(x, y, z); sv.set(s, s, s * (1 + 0.0)); tmp.compose(pv, q, sv); blocks.setMatrixAt(bi, tmp); blocks.setColorAt(bi, c); bi++;
      if (gem >= 0 && gems[gem] && gc[gem] < 48) {
        e.set(0.25 + rx, Math.sin(t * 1.6 + x) * 0.35 + ry, 0); q.setFromEuler(e); pv.set(x, y + 0.02 * s, z + 0.5 * s); sv.setScalar(0.6 * s); tmp.compose(pv, q, sv);
        gems[gem].setMatrixAt(gc[gem]++, tmp);
      }
    },
    ghostCells(list, c) {   // [[x,y],...] in grid coords
      ghost.count = 0; if (!list) return;
      list.forEach(([gx, gy], i) => { const [x, y] = cellPos(gx, gy); tmp.compose(pv.set(x, y, 0.02), q.identity(), sv.set(0.98, 0.98, 0.5)); ghost.setMatrixAt(i, tmp); ghost.setColorAt(i, c); });
      ghost.count = list.length; ghost.instanceMatrix.needsUpdate = true; if (ghost.instanceColor) ghost.instanceColor.needsUpdate = true;
    },
    end() {
      blocks.count = bi; blocks.instanceMatrix.needsUpdate = true; blocks.instanceColor.needsUpdate = true;
      gems.forEach((m, i) => { m.count = gc[i]; m.instanceMatrix.needsUpdate = true; });
    },
  };
}

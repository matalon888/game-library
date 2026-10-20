// Strut Off — the sets, built in code around the AI props: the runway venue (catwalk, pose disc, arch + marquee sign,
// audience risers with an instanced crowd, truss + light cones, photographers' pit, judges' table) restyled per venue,
// and the atelier (dressing room) where the player builds the look.
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

export const RUN_Y = 0.6, RUN_Z0 = -11.6, RUN_Z1 = 1.2, POSE_Z = 2.5, ATL = { x: 40, z: 0, plinthY: 0.2 };

export function buildStage(THREE, scene, place) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.02, ...o });
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.canvas = c; t.userData.draw = draw; return t; };
  const add = (m, x = 0, y = 0, z = 0, p = scene) => { m.position.set(x, y, z); p.add(m); return m; };
  const soft = tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const H = { soft };
  const venueMats = { run: std('#fff', { roughness: 0.18, metalness: 0.05 }), edge: std('#f6a', { emissive: '#f6a', emissiveIntensity: 1.6, roughness: 0.4 }), floor: std('#f6c9d4', { roughness: 0.32 }),
    wall: std('#ffd9e4', { roughness: 0.75 }), seat: std('#ffd0dd', { roughness: 0.8 }), side: std('#fff', { roughness: 0.4 }) };
  H.mats = venueMats;

  // ---------------- sky
  const skyT = tex(16, 512, () => {}); scene.background = skyT; H.skyT = skyT;

  // ---------------- floor
  const floor = add(new THREE.Mesh(new THREE.CircleGeometry(40, 48), venueMats.floor), 0, 0, -4); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;

  // ---------------- runway + pose disc (glossy lacquer top, light-strip edges)
  const runL = RUN_Z1 - RUN_Z0, runW = 2.1, rz = (RUN_Z0 + RUN_Z1) / 2;
  const body = add(new THREE.Mesh(new THREE.BoxGeometry(runW, RUN_Y - 0.04, runL), venueMats.side), 0, (RUN_Y - 0.04) / 2, rz); body.castShadow = body.receiveShadow = true;
  const top = add(new THREE.Mesh(new THREE.BoxGeometry(runW + 0.06, 0.04, runL), venueMats.run), 0, RUN_Y - 0.02, rz); top.receiveShadow = true;
  const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.1, RUN_Y - 0.04, 64), venueMats.side), 0, (RUN_Y - 0.04) / 2, POSE_Z); disc.castShadow = disc.receiveShadow = true;
  const discTop = add(new THREE.Mesh(new THREE.CylinderGeometry(2.08, 2.08, 0.04, 64), venueMats.run), 0, RUN_Y - 0.02, POSE_Z); discTop.receiveShadow = true;
  const strips = [];
  for (const s of [-1, 1]) { const st = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, runL - 0.6), venueMats.edge), s * (runW / 2 + 0.03), RUN_Y - 0.08, rz - 0.3); strips.push(st); }
  const ringE = add(new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.03, 8, 96), venueMats.edge), 0, RUN_Y - 0.08, POSE_Z); ringE.rotation.x = Math.PI / 2;
  // carpet stripe (palace)
  const carpet = add(new THREE.Mesh(new THREE.PlaneGeometry(1.0, runL), std('#c8324f', { roughness: 0.95 })), 0, RUN_Y + 0.002, rz); carpet.rotation.x = -Math.PI / 2; carpet.receiveShadow = true; H.carpet = carpet;
  // light pools on the runway (additive)
  const poolMat = new THREE.MeshBasicMaterial({ map: soft, color: '#fff3dd', transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending });
  H.pools = [];
  for (let i = 0; i < 6; i++) { const p = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), poolMat), 0, RUN_Y + 0.01, RUN_Z0 + 1.5 + i * 2.2); p.rotation.x = -Math.PI / 2; H.pools.push(p); }
  const posePool = add(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), poolMat.clone()), 0, RUN_Y + 0.012, POSE_Z); posePool.rotation.x = -Math.PI / 2; posePool.material.opacity = 0.5; H.posePool = posePool;

  // ---------------- backdrop: arch wall + glowing doorway + marquee sign
  const wallS = new THREE.Shape(); wallS.moveTo(-9, 0); wallS.lineTo(9, 0); wallS.lineTo(9, 8.5); wallS.lineTo(-9, 8.5); wallS.lineTo(-9, 0);
  const arch = new THREE.Path(); arch.moveTo(-1.25, RUN_Y); arch.lineTo(1.25, RUN_Y); arch.lineTo(1.25, 3.3); arch.absarc(0, 3.3, 1.25, 0, Math.PI, false); arch.lineTo(-1.25, RUN_Y); wallS.holes.push(arch);
  const wall = add(new THREE.Mesh(new THREE.ExtrudeGeometry(wallS, { depth: 0.4, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 24 }), venueMats.wall), 0, 0, RUN_Z0 - 1.0);
  wall.receiveShadow = true;
  const archTrim = add(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 10, 48, Math.PI), std('#f4c35a', { metalness: 0.85, roughness: 0.25 })), 0, 3.3, RUN_Z0 - 0.55);
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.3 - RUN_Y, 10), archTrim.material), s * 1.3, (3.3 + RUN_Y) / 2, RUN_Z0 - 0.55);
  const glowT = tex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff6e8'); g.addColorStop(1, '#ffd0e6'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(i * 7, 0, 3, h); } });
  const door = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.9), new THREE.MeshBasicMaterial({ map: glowT, color: '#ffffff' })), 0, RUN_Y + 1.95, RUN_Z0 - 1.25); H.door = door;
  // backstage floor behind the arch so the models walk out of somewhere
  add(new THREE.Mesh(new THREE.BoxGeometry(2.4, RUN_Y - 0.02, 2.2), venueMats.side), 0, (RUN_Y - 0.02) / 2, RUN_Z0 - 1.5);
  // marquee sign
  const signT = tex(1024, 256, () => {}); H.signT = signT;
  const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshStandardMaterial({ map: signT, transparent: true, emissive: '#ffffff', emissiveMap: signT, emissiveIntensity: 0.9, roughness: 0.4 })), 0, 6.0, RUN_Z0 - 0.5);
  H.sign = sign;
  const bulbG = new THREE.SphereGeometry(0.07, 10, 8), bulbs = new THREE.InstancedMesh(bulbG, new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 3 }), 34);
  { const m = new THREE.Matrix4(); let i = 0; for (let k = 0; k < 13; k++) { m.makeTranslation(-3.3 + k * 0.55, 6.85, RUN_Z0 - 0.45); bulbs.setMatrixAt(i++, m); m.makeTranslation(-3.3 + k * 0.55, 5.15, RUN_Z0 - 0.45); bulbs.setMatrixAt(i++, m); } for (let k = 0; k < 4; k++) { m.makeTranslation(-3.4, 5.4 + k * 0.42, RUN_Z0 - 0.45); bulbs.setMatrixAt(i++, m); m.makeTranslation(3.4, 5.4 + k * 0.42, RUN_Z0 - 0.45); bulbs.setMatrixAt(i++, m); } }
  scene.add(bulbs); H.bulbs = bulbs;

  // ---------------- audience risers + crowd (instanced)
  const riserG = [], seats = [];
  for (const s of [-1, 1]) for (let r = 0; r < 4; r++) {
    const x = s * (2.9 + r * 1.05), y = 0.3 + r * 0.42, g = new THREE.BoxGeometry(1.05, y, RUN_L_PAD(runL)); g.translate(x, y / 2, rz - 0.6); riserG.push(g);
    const bench = new THREE.BoxGeometry(0.5, 0.36, RUN_L_PAD(runL) - 0.3); bench.translate(x + s * 0.18, y + 0.18, rz - 0.6); riserG.push(bench);
    for (let k = 0; k < 15; k++) { const z = RUN_Z0 + 0.4 + k * 0.82 + (r % 2) * 0.35; if (z > RUN_Z1 + 0.6) continue; seats.push({ x: x + s * 0.18, y: y + 0.36, z, s, r }); }
  }
  function RUN_L_PAD(L) { return L + 1.2; }
  const risers = add(new THREE.Mesh(mergeGeometries(riserG), venueMats.seat)); risers.receiveShadow = true;
  const n = seats.length, bodyG = new THREE.CapsuleGeometry(0.2, 0.36, 3, 8), headG = new THREE.SphereGeometry(0.15, 10, 8);
  const bodies = new THREE.InstancedMesh(bodyG, std('#ffffff', { roughness: 0.7 }), n), heads = new THREE.InstancedMesh(headG, std('#ffffff', { roughness: 0.6 }), n);
  const clothes = ['#ff8fb1', '#7fd6c2', '#ffd36b', '#9db4ff', '#c79bff', '#ff9f7a', '#ffffff', '#3d3a55', '#6cc3ff', '#f7b2d9'], skins = ['#f6d3b8', '#e8b48f', '#c98f63', '#8d5a3b', '#ffe0c8', '#6e4630'];
  const crowd = seats.map((p, i) => ({ ...p, ph: Math.random() * 6, amp: 0.02 + Math.random() * 0.03, jump: 0, look: 0 }));
  crowd.forEach((c, i) => { bodies.setColorAt(i, new THREE.Color(clothes[i % clothes.length])); heads.setColorAt(i, new THREE.Color(skins[(i * 7) % skins.length])); });
  scene.add(bodies, heads); H.crowd = crowd;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1), e3 = new THREE.Euler();
  H.updateCrowd = (t, excite, focusZ) => {
    for (let i = 0; i < n; i++) {
      const c = crowd[i]; c.jump = Math.max(0, c.jump - 0.04);
      const bob = Math.abs(Math.sin(t * (2 + excite * 4) + c.ph)) * (c.amp + excite * 0.06) + c.jump * 0.25;
      const yaw = Math.atan2(-c.s * 1, (focusZ - c.z) * 0.6);
      e3.set(0, yaw, 0); q.setFromEuler(e3);
      m4.compose(V(c.x, c.y + 0.38 + bob, c.z), q, sc); bodies.setMatrixAt(i, m4);
      m4.compose(V(c.x, c.y + 0.86 + bob, c.z), q, sc); heads.setMatrixAt(i, m4);
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  };
  H.cheer = (k = 0.5) => { for (const c of crowd) if (Math.random() < k) c.jump = 0.6 + Math.random() * 0.4; };

  // ---------------- truss, lamp cans, light cones
  const trussM = std('#d9dde6', { metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, runL + 4, 8), trussM), s * 1.7, 6.6, rz + 1.5).rotation.x = Math.PI / 2;
  const coneMat = new THREE.MeshBasicMaterial({ color: '#fff0dc', transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const coneG = new THREE.ConeGeometry(1.0, 6.0, 24, 1, true); coneG.translate(0, -3, 0);
  const canG = new THREE.CylinderGeometry(0.16, 0.2, 0.36, 12);
  H.cones = [];
  const cans = new THREE.InstancedMesh(canG, std('#2c2c38', { metalness: 0.6, roughness: 0.4 }), 8);
  for (let i = 0; i < 8; i++) {
    const s = i % 2 ? 1 : -1, z = RUN_Z0 + 1.2 + Math.floor(i / 2) * 3.2;
    const c = new THREE.Mesh(coneG, coneMat); c.position.set(s * 1.7, 6.5, z); c.rotation.z = -s * 0.2; scene.add(c); H.cones.push(c);
    m4.compose(V(s * 1.7, 6.45, z), q.setFromEuler(e3.set(0, 0, -s * 0.2)), V(1, 1, 1)); cans.setMatrixAt(i, m4);
  }
  scene.add(cans);
  const poseCone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6.2, 32, 1, true).translate(0, -3.1, 0), coneMat.clone()); poseCone.position.set(0, 6.8, POSE_Z); poseCone.material.opacity = 0.06; scene.add(poseCone); H.poseCone = poseCone;

  // ---------------- photographers' pit (vintage cameras on tripods) + phone flashes in the crowd
  H.camFlash = [];
  for (const s of [-1, 1]) {
    const c = place('s04', { size: 1.25, pos: [s * 1.95, 0, POSE_Z + 3.0], rot: Math.PI + s * 0.35 });
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.position.set(s * 1.85, 1.1, POSE_Z + 2.6); f.scale.setScalar(1.6); scene.add(f); H.camFlash.push(f);
  }
  const phoneMat = new THREE.SpriteMaterial({ map: soft, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  H.phones = [];
  for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(phoneMat.clone()); sp.scale.setScalar(0.5); scene.add(sp); H.phones.push({ sp, t: 0 }); }
  H.flashCrowd = (k = 3) => { for (let j = 0; j < k; j++) { const p = H.phones.find(p => p.t <= 0); if (!p) return; const c = crowd[Math.floor(Math.random() * n)]; p.sp.position.set(c.x - c.s * 0.25, c.y + 1.05, c.z); p.t = 0.18 + Math.random() * 0.1; } };
  H.flashPit = () => { for (const f of H.camFlash) f.material.opacity = 1; };

  // ---------------- judges' table
  const tblM = std('#ffffff', { roughness: 0.35 });
  const tbl = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 2.6), tblM), 3.75, 0.425, POSE_Z + 0.4); tbl.castShadow = tbl.receiveShadow = true;
  const skirt = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 2.5), venueMats.edge), 3.33, 0.42, POSE_Z + 0.4);
  H.judgeSpots = [V(4.45, 0, POSE_Z - 0.3), V(4.45, 0, POSE_Z + 1.1)];
  H.cards = [];
  for (let i = 0; i < 2; i++) { const cardT = tex(128, 96, () => {}); const c = add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.37), new THREE.MeshStandardMaterial({ map: cardT, roughness: 0.5 })), 3.36, 1.05, H.judgeSpots[i].z); c.rotation.y = -Math.PI / 2 + 0.25; c.visible = false; H.cards.push({ mesh: c, t: cardT }); }

  // ---------------- per-venue dressing
  const dress = { plants: [], chand: [], racks: [] };
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const id = (i + (s > 0 ? 1 : 0)) % 2 ? 'h26' : 'h27'; dress.plants.push(place(id, { size: 0.8, pos: [s * 1.62, 0, RUN_Z0 + 5.4 + i * 2.9], rot: i * 1.3 })); }
  dress.plants.forEach(p => p.traverse(o => { if (o.isMesh) o.castShadow = false; }));
  dress.plants.push(place('h06', { size: 2.1, pos: [-3.1, 0, RUN_Z0 - 0.6], rot: 0.4 }), place('h06', { size: 2.1, pos: [3.1, 0, RUN_Z0 - 0.6], rot: -0.6 }));
  for (let i = 0; i < 3; i++) dress.chand.push(place('h17', { size: 1.25, pos: [0, 4.6, RUN_Z0 + 2 + i * 4.3], rot: i }));
  dress.racks.push(place('s02', { size: 2.0, pos: [-2.6, 0, RUN_Z0 - 0.25], rot: 0.25 }), place('s05', { size: 2.2, pos: [2.5, 0, RUN_Z0 - 0.3], rot: -0.3 }));
  // snow + lasers
  const snowN = 300, snowG = new THREE.BufferGeometry(), sp = new Float32Array(snowN * 3);
  for (let i = 0; i < snowN; i++) { sp[i * 3] = (Math.random() - 0.5) * 22; sp[i * 3 + 1] = Math.random() * 9; sp[i * 3 + 2] = -14 + Math.random() * 22; }
  snowG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ map: soft, size: 0.16, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })); scene.add(snow);
  const laserM = new THREE.MeshBasicMaterial({ color: '#58f6ff', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
  const lasers = []; for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 16, 4).translate(0, -8, 0), i % 2 ? laserM : laserM.clone()); l.position.set(i < 3 ? -4 : 4, 7.5, RUN_Z0 - 0.4); scene.add(l); lasers.push(l); }
  lasers.forEach((l, i) => { if (i % 2 === 0) l.material.color.set('#ff5ce1'); });

  H.setVenue = v => {
    const sky = skyT.userData.canvas, x = sky.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, v.sky[2]); g.addColorStop(0.55, v.sky[1]); g.addColorStop(1, v.sky[0]); x.fillStyle = g; x.fillRect(0, 0, 16, 512); skyT.needsUpdate = true;
    venueMats.run.color.set(v.run); venueMats.edge.color.set(v.edge); venueMats.edge.emissive.set(v.edge); venueMats.floor.color.set(v.floor); venueMats.wall.color.set(v.wall); venueMats.seat.color.set(v.seat);
    venueMats.side.color.set(v.run).multiplyScalar(0.94);
    coneMat.color.set(v.cone); poolMat.color.set(v.cone); poseCone.material.color.set(v.cone); posePool.material.color.set(v.cone);
    carpet.visible = !!v.carpet; if (v.carpet) carpet.material.color.set(v.carpet);
    dress.plants.forEach(p => p.visible = !!v.plants); dress.chand.forEach(p => p.visible = !!v.chandeliers);
    snow.visible = !!v.snow; lasers.forEach(l => l.visible = !!v.lasers);
    drawSign(v);
  };
  function drawSign(v) {
    const c = signT.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, 1024, 256);
    x.fillStyle = 'rgba(255,255,255,.0)'; x.fillRect(0, 0, 1024, 256);
    x.font = "128px 'Lilita One', 'Baloo 2', system-ui"; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 18; x.strokeStyle = '#ffffff'; x.strokeText('STRUT OFF', 512, 118);
    x.fillStyle = v.edge; x.fillText('STRUT OFF', 512, 118);
    x.font = "42px 'Lilita One', system-ui"; x.fillStyle = '#ffffff'; x.fillText('★  ' + v.name.toUpperCase() + '  ★', 512, 222);
    signT.needsUpdate = true;
  }
  H.drawSign = drawSign;
  H.update = (dt, t) => {
    for (const p of H.phones) { if (p.t > 0) { p.t -= dt; p.sp.material.opacity = Math.max(0, p.t * 5); } }
    for (const f of H.camFlash) f.material.opacity = Math.max(0, f.material.opacity - dt * 5);
    if (snow.visible) { const a = snowG.attributes.position; for (let i = 0; i < snowN; i++) { let y = a.getY(i) - dt * 0.6; if (y < 0) y = 9; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t + i) * dt * 0.1); } a.needsUpdate = true; }
    if (lasers[0].visible) lasers.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.7 + i) * 0.5; l.rotation.x = 0.5 + Math.sin(t * 0.5 + i * 2) * 0.3; });
    coneMat.opacity = 0.04 + Math.sin(t * 1.3) * 0.01;
    const bi = Math.floor(t * 6) % 2; bulbs.material.emissiveIntensity = 2.6 + bi * 0.6;
  };

  // ---------------- the atelier (dressing room), off to the side
  const A = new THREE.Group(); A.position.set(ATL.x, 0, ATL.z); scene.add(A); H.atelier = A;
  const herring = tex(512, 512, (x, w) => { x.fillStyle = '#d9a77c'; x.fillRect(0, 0, w, w); for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) { const l = 0.85 + ((r * 7 + c * 3) % 5) * 0.05; x.fillStyle = `rgb(${200 * l | 0},${150 * l | 0},${108 * l | 0})`; x.save(); x.translate(c * 64 + (r % 2) * 32, r * 32); x.rotate(r % 2 ? 0.0 : 0); x.fillRect(1, 1, 62, 30); x.restore(); } });
  herring.wrapS = herring.wrapT = THREE.RepeatWrapping; herring.repeat.set(6.5, 5.5);
  const af = add(new THREE.Mesh(new THREE.PlaneGeometry(26, 22), std('#ffffff', { map: herring, roughness: 0.35 })), 0, 0, 0, A); af.rotation.x = -Math.PI / 2; af.receiveShadow = true;
  const paper = tex(256, 512, (x, w, h) => { x.fillStyle = '#ffe4ea'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffd2dd' : '#ffe9ee'; x.fillRect(i * 32, 0, 32, h); } x.fillStyle = 'rgba(255,255,255,.55)'; for (let r = 0; r < 10; r++) for (let c = 0; c < 4; c++) { x.save(); x.translate(c * 64 + 32 + (r % 2) * 32, r * 52 + 26); x.rotate(Math.PI / 4); x.fillRect(-7, -7, 14, 14); x.restore(); } });
  paper.wrapS = THREE.RepeatWrapping; paper.repeat.set(4, 1);
  const wallM = std('#ffffff', { map: paper, roughness: 0.85 });
  const back = add(new THREE.Mesh(new THREE.PlaneGeometry(16, 9), wallM), 0, 4.5, -3.2, A); back.receiveShadow = true;
  for (const s of [-1, 1]) { const w = add(new THREE.Mesh(new THREE.PlaneGeometry(10, 9), wallM), s * 5.2, 4.5, 0.4, A); w.rotation.y = -s * Math.PI / 2 * 0.72; w.receiveShadow = true; }
  const wainM = std('#fff7f2', { roughness: 0.5 });
  add(new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 0.08), wainM), 0, 0.55, -3.14, A);
  add(new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 0.14), std('#f2c46a', { metalness: 0.7, roughness: 0.3 })), 0, 1.12, -3.1, A);
  for (let i = -5; i <= 5; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.03), std('#ffeef0', { roughness: 0.5 })), i * 1.05, 0.55, -3.08, A);
  // arched window with a light shaft
  const winS = new THREE.Shape(); winS.moveTo(-0.8, 0); winS.lineTo(0.8, 0); winS.lineTo(0.8, 1.5); winS.absarc(0, 1.5, 0.8, 0, Math.PI, false); winS.lineTo(-0.8, 0);
  const win = add(new THREE.Mesh(new THREE.ShapeGeometry(winS, 24), new THREE.MeshBasicMaterial({ color: '#fff9e8' })), 0, 2.0, -3.15, A);
  const frameS = new THREE.Shape(); frameS.moveTo(-0.92, -0.1); frameS.lineTo(0.92, -0.1); frameS.lineTo(0.92, 1.5); frameS.absarc(0, 1.5, 0.92, 0, Math.PI, false); frameS.lineTo(-0.92, -0.1); frameS.holes.push(new THREE.Path(winS.getPoints(24)));
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(frameS, { depth: 0.06, bevelEnabled: false }), std('#ffffff', { roughness: 0.4 })), 0, 2.0, -3.17, A);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.3, 0.05), std('#ffffff')), 0, 3.05, -3.12, A); add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.05), std('#ffffff')), 0, 2.9, -3.12, A);
  const shaft = add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 5), new THREE.MeshBasicMaterial({ map: tex(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,248,225,.55)'); g.addColorStop(1, 'rgba(255,248,225,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), 0.5, 1.6, -1.6, A);
  shaft.rotation.set(-0.9, 0.2, 0.15); H.shaft = shaft;
  // plinth with a glowing rim, rug
  const rug = add(new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), std('#ffc7d8', { roughness: 0.95 })), 0, 0.005, 0, A); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true;
  const plinth = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.86, ATL.plinthY, 48), std('#ffffff', { roughness: 0.25 })), 0, ATL.plinthY / 2, 0, A); plinth.castShadow = plinth.receiveShadow = true;
  const prim = add(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.025, 8, 64), std('#ffd27a', { emissive: '#ffbf5a', emissiveIntensity: 2.2 })), 0, ATL.plinthY, 0, A); prim.rotation.x = Math.PI / 2;
  H.plinth = plinth;
  place('s05', { size: 2.3, pos: [-2.35, 0, -2.0], rot: 0.55, parent: A });
  place('s02', { size: 2.2, pos: [2.45, 0, -2.2], rot: -0.45, parent: A });
  place('h13', { size: 1.5, pos: [-3.4, 0, -0.4], rot: 1.1, parent: A });
  place('h05', { size: 1.5, pos: [3.3, 0, -0.2], rot: -0.6, parent: A });
  place('h17', { size: 1.1, pos: [0, 3.55, -0.6], rot: 0, parent: A });
  return H;
}

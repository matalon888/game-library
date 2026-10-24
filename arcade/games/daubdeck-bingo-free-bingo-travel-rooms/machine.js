// The glossy 3D bingo ball machine (all code): brass stand with marquee bulbs, a glass globe of tumbling balls,
// a crank, and a chute the called ball rolls out of. Units: globe radius 1, base on y = 0.
import { THREE } from './kit/hc.js';
import { BALL_COLORS, LETTER, ballColor } from './data.js';

const V3 = THREE.Vector3, PI = Math.PI;
export const GOLD = new THREE.MeshPhysicalMaterial({ color: '#f2c15a', metalness: 0.95, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.3 });
const ROSE = new THREE.MeshPhysicalMaterial({ color: '#d8325e', metalness: 0.1, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: new THREE.Color('#ff9ab8') });
const CREAM = new THREE.MeshPhysicalMaterial({ color: '#fff4e2', metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });

// ---------------------------------------------------------------- numbered ball textures (equirect: the number faces +Z)
const texCache = new Map();
export function ballTexture(n) {
  if (texCache.has(n)) return texCache.get(n);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  const col = ballColor(n), white = col === BALL_COLORS[2];
  x.fillStyle = col; x.fillRect(0, 0, 512, 256);
  if (!white) { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = g; x.fillRect(0, 0, 512, 256); }
  else { x.fillStyle = '#ffd34d'; x.fillRect(0, 108, 512, 40); }   // N balls get a gold band so they read as a colour too
  for (const cx of [128, 384]) {
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, 128, 64, 62, 0, 0, PI * 2); x.fill();
    x.strokeStyle = white ? '#ffd34d' : 'rgba(0,0,0,.08)'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#2a1d3a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 30px "Baloo 2", system-ui, sans-serif'; x.fillText(LETTER(n), cx, 92);
    x.font = `800 ${n > 9 ? 62 : 70}px "Baloo 2", system-ui, sans-serif`; x.fillText(String(n), cx, 140);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(n, t); return t;
}
const BALL_GEO = new THREE.SphereGeometry(1, 40, 28);
export function bigBall() {
  const m = new THREE.Mesh(BALL_GEO, new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.0, toneMapped: false }));
  m.castShadow = true;
  m.setNumber = n => { m.material.map = ballTexture(n); m.material.needsUpdate = true; m.userData.n = n; };
  return m;
}

// ---------------------------------------------------------------- the machine
export function buildMachine() {
  const g = new THREE.Group();
  // stand: a brass lathe pedestal with a rose lacquer collar
  const prof = [[0, 0], [0.95, 0], [1.0, 0.05], [1.0, 0.16], [0.9, 0.2], [0.62, 0.26], [0.42, 0.42], [0.36, 0.62], [0.42, 0.7], [0.55, 0.74], [0.58, 0.8], [0, 0.8]].map(([a, b]) => new THREE.Vector2(a, b));
  const stand = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), GOLD); stand.castShadow = stand.receiveShadow = true; g.add(stand);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.02, 0.12, 48), ROSE); collar.position.y = 0.1; g.add(collar);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.32, 0.12, 48), CREAM); plinth.position.y = -0.06; plinth.receiveShadow = true; g.add(plinth);
  // marquee bulbs around the collar + the plinth
  const BULBS = 30, bulbMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), bulbMat, BULBS * 2);
  bulbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BULBS * 6), 3);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < BULBS * 2; i++) { const a = (i % BULBS) / BULBS * PI * 2, r = i < BULBS ? 1.03 : 1.3, y = i < BULBS ? 0.1 : -0.06; m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r); bulbs.setMatrixAt(i, m4); }
  g.add(bulbs);
  // globe on top
  const GY = 1.72;
  const globe = new THREE.Group(); globe.position.y = GY; g.add(globe);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, depthWrite: false, specularIntensity: 1 }));
  glass.renderOrder = 3; globe.add(glass);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.004, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { c: { value: new THREE.Color('#fff2d8') } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.6); gl_FragColor = vec4(c, f * .75); }' }));
  rim.renderOrder = 4; globe.add(rim);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, toneMapped: false }));
  hl.scale.set(1.5, 0.7, 0.2); hl.position.set(-0.45, 0.52, 0.7); hl.rotation.z = 0.6; hl.renderOrder = 5; globe.add(hl);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.055, 12, 64), GOLD); ring.rotation.y = PI / 2; globe.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.04, 12, 64), GOLD); ring2.rotation.x = PI / 2; globe.add(ring2);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), GOLD); cap.position.y = 1.0; globe.add(cap);
  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 16), ROSE); capTop.position.y = 1.2; globe.add(capTop);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.22, 32), GOLD); neck.position.y = 0.86; g.add(neck);
  // crank on the right
  const crank = new THREE.Group(); crank.position.set(1.08, GY, 0); g.add(crank);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), GOLD); axle.rotation.z = PI / 2; axle.position.x = 0.1; crank.add(axle);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.08), GOLD); arm.position.set(0.24, 0.22, 0); crank.add(arm);
  const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 12), ROSE); knob.rotation.z = PI / 2; knob.position.set(0.36, 0.45, 0); crank.add(knob);
  // chute: from the bottom-front of the globe down to a little tray at the front-right
  const curve = new THREE.CatmullRomCurve3([new V3(0.35, GY - 0.82, 0.55), new V3(0.75, GY - 1.05, 0.95), new V3(1.15, 0.72, 1.15), new V3(1.45, 0.42, 1.25)]);
  const chute = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.15, 14, false), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, envMapIntensity: 2, depthWrite: false }));
  chute.renderOrder = 2; g.add(chute);
  const rails = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.025, 6, false), GOLD); rails.position.y = -0.14; g.add(rails);
  const tray = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 32), GOLD); tray.rotation.x = PI / 2; tray.position.set(1.5, 0.36, 1.27); g.add(tray);
  // tumbling balls inside the globe
  const N = 22, balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshPhysicalMaterial({ roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, toneMapped: false }), N);
  balls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); balls.castShadow = true; globe.add(balls);
  const bs = [], col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    bs.push({ p: new V3((Math.random() - 0.5) * 1.2, -0.6 + Math.random() * 0.3, (Math.random() - 0.5) * 1.2), v: new V3(), s: 0.85 + Math.random() * 0.3, r: Math.random() * 6 });
    col.set(BALL_COLORS[i % 5]); balls.setColorAt(i, col);
  }
  let spinT = 0, energy = 0.25, t0 = 0;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
  function update(dt, t) {
    t0 = t;
    spinT = Math.max(0, spinT - dt); const target = spinT > 0 ? 1 : 0.18; energy += (target - energy) * Math.min(1, dt * 3);
    crank.rotation.x -= dt * (1 + energy * 9);
    for (let i = 0; i < N; i++) {
      const b = bs[i];
      b.v.y -= 9 * dt;                                                    // gravity
      if (b.p.y < -0.45) { b.v.y += energy * (30 + Math.random() * 30) * dt; b.v.x += (Math.random() - 0.5) * energy * 40 * dt; b.v.z += (Math.random() - 0.5) * energy * 40 * dt; }   // the blower
      b.v.x += -b.p.z * energy * 3 * dt; b.v.z += b.p.x * energy * 3 * dt;   // swirl
      b.v.multiplyScalar(1 - 0.8 * dt);
      b.p.addScaledVector(b.v, dt);
      const L = b.p.length(), R = 0.8;
      if (L > R) { const nrm = b.p.clone().divideScalar(L); b.p.copy(nrm).multiplyScalar(R); const vn = b.v.dot(nrm); if (vn > 0) b.v.addScaledVector(nrm, -1.6 * vn); }
      b.r += b.v.length() * dt * 2;
      e.set(b.r, b.r * 0.7, 0); q.setFromEuler(e); sc.setScalar(b.s); m4.compose(b.p, q, sc); balls.setMatrixAt(i, m4);
    }
    // cheap pairwise push so they don't sit inside each other
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const a = bs[i].p, b = bs[j].p, dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 < 0.1 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.32 - d) * 0.5 / d; a.x += dx * k; a.y += dy * k; a.z += dz * k; b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; } }
    balls.instanceMatrix.needsUpdate = true;
    // marquee chase
    const ph = Math.floor(t * (4 + energy * 10));
    for (let i = 0; i < BULBS * 2; i++) { const on = ((i + ph) % 3 === 0); col.set(on ? '#fff6c8' : '#ffb35a').multiplyScalar(on ? 2.2 : 0.55); bulbs.setColorAt(i, col); }
    bulbs.instanceColor.needsUpdate = true;
  }
  return { group: g, globe, curve, GY, update, spin(sec = 1) { spinT = Math.max(spinT, sec); }, tray: new V3(1.5, 0.55, 1.27) };
}

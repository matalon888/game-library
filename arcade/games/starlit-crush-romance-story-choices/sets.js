// Starlit Crush — five sets, built in code around the kawaii prop library (assets/*.glb, Z-up + quantized, normalised here):
//   quad    the campus quad: pastel brick halls, a star clock tower, cherry trees, heart bench, lamps, fountain, petals
//           variants: day, dusk, night (fairy lights, stars, lit windows)
//   studio  Studio 7: lilac walls, tall windows, easels with paintings, a pottery wheel, shelves of mugs
//           variants: day, dusk, gallery (plinths, framed work, spotlights, fairy lights)
//   cafe    Moonbean Café: checker floor, counter, cake case, tables, moon pendant lamps, menu board
//   dorm    Lilac Hall 4B: bed, beanbag, desk, mushroom lamp, rug, Bea's sketch wall / evidence board
//   roof    the rooftop at night: tiles, railing, string lights, telescope, city skyline, a sky full of stars
// Each set is a Group at the origin; floors at y = 0; people stand on the marks; one set visible at a time.
let THREE, PROTO;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0, ...o });
const gloss = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18, ...o });
function tex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function add(p, m, x = 0, y = 0, z = 0) { m.position.set(x, y, z); p.add(m); return m; }
function box(p, w, h, d, mat, x, y, z, shadow = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = shadow; m.receiveShadow = true; return add(p, m, x, y, z); }
function rbox(w, h, d, r) { // rounded box geometry
  const s = new THREE.Shape(), x = -w / 2 + r, y = -h / 2 + r, ww = w - 2 * r, hh = h - 2 * r;
  s.moveTo(x, y - r); s.lineTo(x + ww, y - r); s.quadraticCurveTo(x + ww + r, y - r, x + ww + r, y); s.lineTo(x + ww + r, y + hh); s.quadraticCurveTo(x + ww + r, y + hh + r, x + ww, y + hh + r);
  s.lineTo(x, y + hh + r); s.quadraticCurveTo(x - r, y + hh + r, x - r, y + hh); s.lineTo(x - r, y); s.quadraticCurveTo(x - r, y - r, x, y - r);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * r) / 2); return g;
}
function rb(p, w, h, d, r, mat, x, y, z) { const m = new THREE.Mesh(rbox(w, h, d, r), mat); m.castShadow = true; m.receiveShadow = true; return add(p, m, x, y, z); }
function place(p, id, size, x, y, z, rot = 0, shadow = true) {
  const src = PROTO[id]; if (!src) return new THREE.Group();
  const o = src.clone(); o.scale.setScalar(size); o.position.set(x, y, z); o.rotation.y = rot; p.add(o);
  if (!shadow) o.traverse(m => { if (m.isMesh) m.castShadow = false; });
  return o;
}
let SOFT;
function glow(p, color, size, x, y, z, op = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); s.position.set(x, y, z); p.add(s); return s;
}
const skyTex = stops => tex(8, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); for (const [o, c] of stops) g.addColorStop(o, c); x.fillStyle = g; x.fillRect(0, 0, w, h); });
// a soft round sparkle field (additive points) that twinkles: the kawaii "air"
function sparkles(p, n, area, color = '#fff2fb', size = 0.06) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * area[0]; pos[i * 3 + 1] = area[3] + rnd() * area[1]; pos[i * 3 + 2] = area[4] + (rnd() - 0.5) * area[2]; ph[i] = rnd() * 6.28; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, s: { value: size * 900 }, op: { value: 1 } },
    vertexShader: 'attribute float ph; uniform float t, s; varying float a; void main(){ vec3 p = position; p.y += sin(t*.6+ph)*.08; vec4 mv = modelViewMatrix*vec4(p,1.); a = .35+.65*pow(.5+.5*sin(t*2.2+ph*3.),3.); gl_PointSize = s*a/ -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c; uniform float op; varying float a; void main(){ vec2 d = gl_PointCoord-.5; float r = length(d); float st = max(0., 1.-abs(d.x)*14.)*max(0.,1.-abs(d.y)*2.2) + max(0., 1.-abs(d.y)*14.)*max(0.,1.-abs(d.x)*2.2); float k = smoothstep(.5,.0,r)*.55 + st*.9; gl_FragColor = vec4(c, k*a*op); }' });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; p.add(pts); return pts;
}
// fairy lights along a catenary between two points: instanced glowing bulbs + one thin wire
function fairy(p, a, b, n, sag, colors, size = 0.05) {
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, q = a.clone().lerp(b, t); q.y -= Math.sin(t * Math.PI) * sag; pts.push(q); }
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#7a6290' })); p.add(wire);
  const geo = new THREE.SphereGeometry(size, 10, 8), cols = colors.map(c => new THREE.Color(c));
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), n); const M = new THREE.Matrix4();
  const bulbs = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, q = a.clone().lerp(b, t); q.y -= Math.sin(t * Math.PI) * sag + size * 1.4; M.makeTranslation(q.x, q.y, q.z); im.setMatrixAt(i, M); const c = cols[i % cols.length].clone().multiplyScalar(2.2); im.setColorAt(i, c); bulbs.push(q); }
  p.add(im); return { im, bulbs, wire };
}
const PAL = { pink: '#ffb3d1', lilac: '#cdb4ff', mint: '#a8ecd6', butter: '#ffe49a', peach: '#ffc4a8', sky: '#a9dcff', cream: '#fff6fb' };
function painting(kind, w = 256, h = 320) {
  return tex(w, h, (x) => {
    const bgs = { sun: ['#ffd6e8', '#ffe9a8'], sea: ['#bfe6ff', '#d9c8ff'], cat: ['#fff0c8', '#ffc7de'], abs: ['#d4f7ec', '#ffd1e6'], star: ['#2a2460', '#6b4fb8'], heart: ['#ffe0ec', '#ffc0d8'] }[kind] || ['#fff', '#eee'];
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bgs[0]); g.addColorStop(1, bgs[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (kind === 'sun') { x.fillStyle = '#ff9fc4'; x.beginPath(); x.arc(w / 2, h * 0.55, 70, 0, 7); x.fill(); x.fillStyle = '#a8ecd6'; x.fillRect(0, h * 0.7, w, h * 0.3); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(70, 80, 40, 16, 0, 0, 7); x.fill(); }
    if (kind === 'sea') { for (let i = 0; i < 6; i++) { x.strokeStyle = ['#7cc6ff', '#a78bff', '#ffffff'][i % 3]; x.lineWidth = 12; x.beginPath(); for (let X = 0; X <= w; X += 8) x.lineTo(X, h * 0.4 + i * 30 + Math.sin(X / 20 + i) * 8); x.stroke(); } }
    if (kind === 'cat') { x.fillStyle = '#c9a8ff'; x.beginPath(); x.arc(w / 2, h * 0.58, 80, 0, 7); x.fill(); x.beginPath(); x.moveTo(w / 2 - 70, h * 0.45); x.lineTo(w / 2 - 50, h * 0.2); x.lineTo(w / 2 - 20, h * 0.4); x.fill(); x.beginPath(); x.moveTo(w / 2 + 70, h * 0.45); x.lineTo(w / 2 + 50, h * 0.2); x.lineTo(w / 2 + 20, h * 0.4); x.fill(); x.fillStyle = '#3a2c55'; x.beginPath(); x.arc(w / 2 - 28, h * 0.56, 9, 0, 7); x.arc(w / 2 + 28, h * 0.56, 9, 0, 7); x.fill(); x.fillStyle = '#ff7eb6'; x.beginPath(); x.arc(w / 2 - 46, h * 0.64, 11, 0, 7); x.arc(w / 2 + 46, h * 0.64, 11, 0, 7); x.fill(); }
    if (kind === 'abs') { for (let i = 0; i < 9; i++) { x.fillStyle = ['#ff9fc4', '#8ee6d1', '#ffd86b', '#b49bff'][i % 4]; x.globalAlpha = 0.85; x.beginPath(); x.arc(30 + rnd() * (w - 60), 30 + rnd() * (h - 60), 20 + rnd() * 50, 0, 7); x.fill(); } x.globalAlpha = 1; }
    if (kind === 'star') { for (let i = 0; i < 60; i++) { x.fillStyle = '#fff'; x.globalAlpha = rnd(); x.fillRect(rnd() * w, rnd() * h, 3, 3); } x.globalAlpha = 1; x.fillStyle = '#ffe27a'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 30 : 74; x.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } x.fill(); }
    if (kind === 'heart') { x.fillStyle = '#ff5fa2'; x.beginPath(); x.moveTo(w / 2, h * 0.75); x.bezierCurveTo(w * 0.05, h * 0.45, w * 0.25, h * 0.15, w / 2, h * 0.35); x.bezierCurveTo(w * 0.75, h * 0.15, w * 0.95, h * 0.45, w / 2, h * 0.75); x.fill(); }
  });
}

// ---------------------------------------------------------------------------------------------- loading
export const PROP_IDS = ['r01', 'r02', 'r03', 'r04', 'r05', 'h01', 'h02', 'h03', 'h05', 'h06', 'h07', 'h08', 'h09', 'h10', 'h11', 'f09', 't01', 'g09', 'g15', 'g17', 'b01', 'b02', 'w09', 'w07'];
export async function loadProps(T, GLTFLoader, ids, onEach) {
  THREE = T; PROTO = {};
  SOFT = tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const loader = new GLTFLoader();
  await Promise.all(ids.map(id => Promise.race([loader.loadAsync(`./assets/${id}.glb`), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))])
    .then(g => { PROTO[id] = norm(g.scene); })
    .catch(e => { console.warn('prop', id, e && e.message); PROTO[id] = new THREE.Group(); })
    .finally(() => onEach && onEach(id))));
  return PROTO;
}
function norm(scene) {   // Z-up → Y-up, centred on x/z, resting on y = 0, largest side = 1 (transforms the meshes, never the quantized geometry)
  scene.rotation.x = Math.PI / 2;
  const w = new THREE.Group(); w.add(scene); w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(V()), c = bb.getCenter(V());
  scene.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(1 / Math.max(sz.x, sz.y, sz.z));
  const root = new THREE.Group(); root.add(w);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const m = o.material; if (m) { m.metalness = Math.min(m.metalness ?? 0, 0.1); m.envMapIntensity = 0.8; } } });
  return root;
}

// ---------------------------------------------------------------------------------------------- sets
export function buildSets(T, scene) {
  THREE = T; seed = 11;
  const S = { quad: quad(), studio: studio(), cafe: cafe(), dorm: dorm(), roof: roof() };
  for (const [k, s] of Object.entries(S)) { s.name = k; s.group.visible = false; scene.add(s.group); }
  return S;
}
function mkSet(VAR, extra = {}) {
  const g = new THREE.Group(), H = { group: g, VAR, upd: [], ...extra };
  H.set = v => {
    const P = VAR[v] || Object.values(VAR)[0]; H.P = P;
    H.bg = skyTex(P.sky); H.fog = P.fog ? new THREE.Fog(P.fog, P.fogN || 14, P.fogF || 60) : null;
    H.hemi = P.hemi; H.sun = P.sun; H.exp = P.exp || 1;
    for (const f of H.onVar || []) f(P, v);
  };
  H.update = (dt, t) => { for (const f of H.upd) f(dt, t); };
  return H;
}

// ---------- the quad
function quad() {
  const VAR = {
    day: { sky: [[0, '#7fbcff'], [0.55, '#c4dcff'], [1, '#ffd9ec']], fog: '#f1d6f0', fogN: 18, fogF: 70, hemi: ['#fff0fa', '#b48ad8', 1.0], sun: ['#fff1e6', 2.2, [6, 12, 8]], exp: 0.95, night: 0 },
    dusk: { sky: [[0, '#6f6bd8'], [0.45, '#ef8fbb'], [0.75, '#ffbb90'], [1, '#ffdcbc']], fog: '#e8a9c4', fogN: 16, fogF: 60, hemi: ['#ffd2e6', '#7a5aa8', 0.9], sun: ['#ffae84', 1.9, [-8, 6, 6]], exp: 0.95, night: 0.4 },
    night: { sky: [[0, '#141547'], [0.5, '#33277a'], [0.8, '#6e3f9a'], [1, '#c062a2']], fog: '#3a2a6c', fogN: 14, fogF: 46, hemi: ['#a493ff', '#2a1a48', 0.62], sun: ['#d6c8ff', 0.75, [4, 9, 7]], exp: 1.0, night: 1 },
  };
  const H = mkSet(VAR), g = H.group;
  // ground: mint grass + a pink brick path + a round plaza
  const grass = tex(512, 512, (x, w, h) => { x.fillStyle = '#b7efcf'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { x.fillStyle = rnd() < 0.5 ? '#a6e6c2' : '#c8f6dc'; x.fillRect(rnd() * w, rnd() * h, 2, 5); } for (let i = 0; i < 40; i++) { x.fillStyle = ['#fff', '#ffd1e6', '#fff2a8'][i % 3]; x.beginPath(); x.arc(rnd() * w, rnd() * h, 3, 0, 7); x.fill(); } }, [10, 10]);
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), std('#ffffff', { map: grass, roughness: 0.95 })); gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true; g.add(gm);
  const brick = tex(256, 256, (x, w, h) => { x.fillStyle = '#e8a9bf'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { x.fillStyle = ['#ffd3e2', '#ffc7da', '#ffdbe7'][(r + c) % 3]; x.beginPath(); x.roundRect(c * 64 + (r % 2) * 32 + 3, r * 32 + 3, 58, 26, 6); x.fill(); } }, [2, 10]);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 40), std('#fff', { map: brick, roughness: 0.8 })); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -10); path.receiveShadow = true; g.add(path);
  const plazaT = tex(512, 512, (x, w) => { x.fillStyle = '#ffd3e4'; x.fillRect(0, 0, w, w); x.strokeStyle = '#ffadcb'; x.lineWidth = 10; for (let r = 40; r < 256; r += 46) { x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke(); } });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), std('#fff', { map: plazaT, roughness: 0.75 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.015, 0.2); plaza.receiveShadow = true; g.add(plaza);
  // the halls: pastel brick facades with windows, rounded roofs, a star clock tower in the middle
  const winT = tex(128, 128, (x, w) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, w); x.fillStyle = '#9fd4ff'; x.beginPath(); x.roundRect(10, 10, 108, 108, [54, 54, 8, 8]); x.fill(); x.fillStyle = '#fff'; x.fillRect(60, 10, 8, 108); x.fillRect(10, 64, 108, 8); });
  const winMat = new THREE.MeshStandardMaterial({ map: winT, emissive: '#ffe7a0', emissiveIntensity: 0, roughness: 0.3 });
  H.winMat = winMat;
  const hall = (x, z, w, h, col, roofCol, ry = 0) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    rb(b, w, h, 3, 0.25, gloss(col, { roughness: 0.55, clearcoat: 0.3 }), 0, h / 2, 0);
    const rf = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, w + 0.3, 24, 1, false, 0, Math.PI), gloss(roofCol)); rf.rotation.z = Math.PI / 2; rf.rotation.y = Math.PI / 2; rf.scale.set(1, 1, 0.55); rf.position.set(0, h, 0); rf.castShadow = true; b.add(rf);
    const geo = new THREE.PlaneGeometry(0.9, 1.15); const cols = Math.floor(w / 1.6), rows = Math.floor((h - 0.6) / 1.8);
    const im = new THREE.InstancedMesh(geo, winMat, cols * rows); let i = 0; const M = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { M.makeTranslation(-w / 2 + 0.8 + c * ((w - 1.6) / Math.max(1, cols - 1)), 1.3 + r * 1.8, 1.53); im.setMatrixAt(i++, M); }
    b.add(im);
    return b;
  };
  hall(-8.5, -11, 9, 6.5, '#ffb9d3', '#a97cff');
  hall(8.5, -11, 9, 6.5, '#c9b2ff', '#ff86b8');
  hall(-15, -4, 7, 5.5, '#c9f1e2', '#ffb7cf', 0.9);
  hall(15, -4, 7, 5.5, '#fff0b8', '#b49bff', -0.9);
  // clock tower with a star
  const tw = new THREE.Group(); tw.position.set(0, 0, -17); g.add(tw);
  rb(tw, 3.0, 9, 3.0, 0.3, gloss('#e3d2ff', { roughness: 0.5, clearcoat: 0.3 }), 0, 4.5, 0);
  { const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 1.0), winMat, 3); const M = new THREE.Matrix4(); [2.0, 3.8, 5.0].forEach((y, i) => { M.makeTranslation(0, y - (i === 2 ? 0 : 0), 1.52); im.setMatrixAt(i, M); }); tw.add(im); }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3, 4), gloss('#c79bff')); cap.rotation.y = Math.PI / 4; cap.position.y = 10.5; cap.castShadow = true; tw.add(cap);
  const clockT = tex(256, 256, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill(); x.lineWidth = 14; x.strokeStyle = '#ff9fc4'; x.stroke(); x.fillStyle = '#8a63ff'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.arc(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92, 7, 0, 7); x.fill(); } x.lineWidth = 10; x.strokeStyle = '#5b3fa0'; x.beginPath(); x.moveTo(128, 128); x.lineTo(128, 58); x.moveTo(128, 128); x.lineTo(180, 128); x.stroke(); });
  const clk = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), std('#fff', { map: clockT })); clk.position.set(0, 7, 1.62); tw.add(clk);
  const starShape = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.32 : 0.75; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starM = new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb800', emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.2 });
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }), starM); star.position.set(0, 12.7, 0); tw.add(star); H.star = star; H.starM = starM;
  H.upd.push((dt, t) => { star.rotation.y = Math.sin(t * 0.6) * 0.5; });
  // cherry trees, bench, lamps
  place(g, 'r01', 3.6, -3.2, 0, -1.6, 0.4); place(g, 'r01', 3.0, 3.6, 0, -2.4, -0.6); place(g, 'r01', 3.2, -6.5, 0, -5, 1.2); place(g, 'r01', 3.4, 6.8, 0, -5.5, 2);
  place(g, 'r02', 1.5, -2.2, 0, -0.7, 0.35);
  const lamps = [[-1.9, 1.6], [1.9, 1.6], [-2.2, -4.5], [2.2, -4.5]].map(([x, z]) => { place(g, 'r03', 2.4, x, 0, z, 0); return glow(g, '#ffd27a', 1.4, x, 2.25, z, 0); });
  // fountain
  const fn = new THREE.Group(); fn.position.set(3.0, 0, 1.0); g.add(fn);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 12, 40), gloss('#ffd0e0')); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; ring.castShadow = true; fn.add(ring);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.3, 40), gloss('#fff0f6')); basin.position.y = 0.15; fn.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.82, 40), new THREE.MeshPhysicalMaterial({ color: '#9fe0ff', roughness: 0.05, transmission: 0, clearcoat: 1, emissive: '#3aa0d0', emissiveIntensity: 0.12 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.31; fn.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 16), gloss('#c9b0ff')); col.position.y = 0.6; fn.add(col);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, 6.3, 0, Math.PI / 2), gloss('#ffd0e0')); bowl.rotation.x = Math.PI; bowl.position.y = 1.15; fn.add(bowl);
  // hedges (rounded jelly bushes)
  const hedgeM = gloss('#8fdcb6', { roughness: 0.6, clearcoat: 0.4 });
  for (const [x, z, s] of [[-4.6, 1.8, 0.7], [-5.4, 0.6, 0.55], [4.9, -0.8, 0.6], [5.6, 1.6, 0.75], [-1.2, -6.5, 0.6], [1.4, -6.8, 0.55]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), hedgeM); b.scale.y = 0.75; b.position.set(x, s * 0.55, z); b.castShadow = true; g.add(b); }
  // fairy lights (night) between the trees and lamps
  const fl1 = fairy(g, V(-3.4, 2.9, -1.0), V(3.4, 2.9, -2.0), 22, 0.6, ['#fff3b0', '#ffb3d9', '#b9f2ff']);
  const fl2 = fairy(g, V(-1.9, 2.4, 1.6), V(1.9, 2.4, 1.6), 14, 0.35, ['#ffb3d9', '#fff3b0', '#d4c2ff']);
  H.fl = [fl1, fl2];
  // falling petals (instanced)
  const petG = new THREE.PlaneGeometry(0.07, 0.05); const petals = new THREE.InstancedMesh(petG, new THREE.MeshBasicMaterial({ color: '#ffc4dc', side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), 70);
  const PS = Array.from({ length: 70 }, () => ({ x: (rnd() - 0.5) * 12, y: rnd() * 5, z: -4 + rnd() * 7, s: 0.3 + rnd() * 0.4, r: rnd() * 6, w: 0.5 + rnd() })); g.add(petals); petals.frustumCulled = false;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = V(1, 1, 1), PP = V();
  H.upd.push((dt, t) => { for (let i = 0; i < PS.length; i++) { const p = PS[i]; p.y -= dt * p.s; p.x += Math.sin(t * p.w + p.r) * dt * 0.25; if (p.y < 0) { p.y = 4.5 + rnd(); p.x = (rnd() - 0.5) * 12; } E.set(t * p.w + p.r, t * 0.7 + p.r, 0); Q.setFromEuler(E); PP.set(p.x, p.y, p.z); M.compose(PP, Q, SC); petals.setMatrixAt(i, M); } petals.instanceMatrix.needsUpdate = true; });
  // stars + sparkles
  const stars = sparkles(g, 140, [70, 20, 6, 8, -30], '#ffffff', 0.09); const air = sparkles(g, 40, [10, 3, 6, 0.4, 0], '#fff0fa', 0.05);
  H.upd.push((dt, t) => { stars.material.uniforms.t.value = t; air.material.uniforms.t.value = t; });
  H.onVar = [P => {
    winMat.emissiveIntensity = P.night * 1.1; stars.visible = P.night > 0.5; stars.material.uniforms.op.value = P.night;
    for (const l of lamps) l.material.opacity = P.night * 0.75;
    for (const f of H.fl) { f.im.visible = P.night > 0.3; f.wire.visible = P.night > 0.3; }
    starM.emissiveIntensity = 0.4 + P.night * 1.6;
  }];
  H.marks = { L: V(-0.75, 0, 0.3), R: V(0.75, 0, 0.3), C: V(0, 0, 0.55), LL: V(-1.85, 0, 0.9), RR: V(1.85, 0, 0.9) };
  H.est = { pos: V(0, 2.4, 7.5), look: V(0, 1.6, -2), fov: 42 };
  return H;
}

// ---------- room helper (back wall + side walls + floor)
function room(g, { wall, wall2 = wall, floorT, w = 9, d = 7, h = 4.2, trim = '#ffffff', wainscot }) {
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('#fff', { map: floorT, roughness: 0.55 })); fl.rotation.x = -Math.PI / 2; fl.position.z = d / 2 - 3; fl.receiveShadow = true; g.add(fl);
  const back = box(g, w, h, 0.2, std(wall, { roughness: 0.85 }), 0, h / 2, -3.1, false);
  const lw = box(g, 0.2, h, d, std(wall2, { roughness: 0.85 }), -w / 2, h / 2, d / 2 - 3, false); const rw = box(g, 0.2, h, d, std(wall2, { roughness: 0.85 }), w / 2, h / 2, d / 2 - 3, false);
  if (wainscot) { box(g, w, 1.0, 0.08, std(wainscot), 0, 0.5, -2.98, false); box(g, w, 0.08, 0.14, std(trim), 0, 1.02, -2.95, false); box(g, 0.08, 1.0, d, std(wainscot), -w / 2 + 0.14, 0.5, d / 2 - 3, false); box(g, 0.08, 1.0, d, std(wainscot), w / 2 - 0.14, 0.5, d / 2 - 3, false); }
  box(g, w, 0.14, 0.1, std(trim), 0, 0.07, -2.95, false);
  return { back, lw, rw };
}
function windowPane(g, x, y, z, w, h, skyMat, ry = 0) {
  const wg = new THREE.Group(); wg.position.set(x, y, z); wg.rotation.y = ry; g.add(wg);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), skyMat); wg.add(sky);
  const fr = gloss('#ffffff', { roughness: 0.4 });
  box(wg, w + 0.2, 0.12, 0.14, fr, 0, h / 2, 0.04, false); box(wg, w + 0.2, 0.16, 0.24, fr, 0, -h / 2, 0.08, false);
  box(wg, 0.1, h, 0.12, fr, -w / 2, 0, 0.04, false); box(wg, 0.1, h, 0.12, fr, w / 2, 0, 0.04, false); box(wg, 0.07, h, 0.08, fr, 0, 0, 0.04, false); box(wg, w, 0.06, 0.08, fr, 0, h * 0.1, 0.04, false);
  return wg;
}
function skyWindowMat(stops) { return new THREE.MeshBasicMaterial({ map: skyTex(stops), toneMapped: false }); }

// ---------- Studio 7
function studio() {
  const VAR = {
    day: { sky: [[0, '#f6e9ff'], [1, '#ffe6f1']], hemi: ['#fff2fa', '#b48ad8', 0.95], sun: ['#fff4ea', 2.1, [-5, 8, 7]], exp: 0.95, win: [[0, '#8fd0ff'], [1, '#ffe4f1']], gallery: 0 },
    dusk: { sky: [[0, '#f0dbff'], [1, '#ffd6e6']], hemi: ['#ffd8ea', '#8a68b8', 0.85], sun: ['#ffb68c', 1.9, [-6, 5, 6]], exp: 0.95, win: [[0, '#8a7ae8'], [0.5, '#f5a0c4'], [1, '#ffd0a8']], gallery: 0 },
    gallery: { sky: [[0, '#2b2160'], [1, '#56347e']], hemi: ['#c9b4ff', '#3a2550', 0.6], sun: ['#ffe9f6', 1.5, [-3, 9, 6]], exp: 1.0, win: [[0, '#181a4a'], [1, '#5b3d8f']], gallery: 1 },
  };
  const H = mkSet(VAR), g = H.group;
  const floorT = tex(512, 512, (x, w, h) => { const n = 8; for (let r = 0; r < n; r++) for (let c = 0; c < 4; c++) { const l = 0.92 + rnd() * 0.08; x.fillStyle = `rgb(${255 * l | 0},${226 * l | 0},${214 * l | 0})`; x.fillRect(c * 128 + (r % 2) * 64 - 64, r * 64, 126, 62); x.fillRect(c * 128 + (r % 2) * 64 + 64, r * 64, 126, 62); } for (let i = 0; i < 30; i++) { x.fillStyle = ['#ff9fc4', '#8ee6d1', '#b49bff', '#ffd86b'][i % 4]; x.globalAlpha = 0.5; x.beginPath(); x.arc(rnd() * w, rnd() * h, 3 + rnd() * 8, 0, 7); x.fill(); } x.globalAlpha = 1; }, [3, 2.5]);
  room(g, { wall: '#d6c2ff', wall2: '#e2d3ff', floorT, w: 10, d: 7, h: 4.4, wainscot: '#b99cf5' });
  const wm = skyWindowMat(VAR.day.win); H.winM = wm;
  windowPane(g, -2.8, 2.5, -2.99, 1.8, 2.2, wm); windowPane(g, 2.8, 2.5, -2.99, 1.8, 2.2, wm);
  // easels with paintings
  const easel = (x, z, ry, kind, s = 1) => {
    const e = new THREE.Group(); e.position.set(x, 0, z); e.rotation.y = ry; e.scale.setScalar(s); g.add(e);
    const wood = gloss('#ffd6a8', { roughness: 0.5, clearcoat: 0.3 });
    for (const sx of [-0.35, 0.35]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.9, 8), wood); l.position.set(sx, 0.92, 0); l.rotation.z = -sx * 0.18; l.castShadow = true; e.add(l); }
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8), wood); b.position.set(0, 0.85, -0.3); b.rotation.x = 0.25; e.add(b);
    box(e, 0.9, 0.05, 0.12, wood, 0, 0.75, 0.04);
    const cv = rb(e, 0.86, 1.06, 0.06, 0.02, std('#fff'), 0, 1.32, 0.04); const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), std('#fff', { map: painting(kind), roughness: 0.7 })); face.position.set(0, 1.32, 0.08); e.add(face);
    return e;
  };
  H.easels = [easel(-3.3, -1.4, 0.45, 'sun'), easel(3.4, -1.2, -0.5, 'cat'), easel(-1.4, -2.3, 0.15, 'abs', 0.9)];
  // pottery wheel (code): base + spinning head + a lopsided pink pot
  const wh = new THREE.Group(); wh.position.set(1.7, 0, -1.7); g.add(wh);
  const wbase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.55, 28), gloss('#a8ecd6')); wbase.position.y = 0.28; wbase.castShadow = true; wh.add(wbase);
  const tray = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 28), gloss('#8fdcc4')); tray.rotation.x = Math.PI / 2; tray.position.y = 0.6; wh.add(tray);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 28), gloss('#ffffff')); head.position.y = 0.6; wh.add(head);
  const potPts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; potPts.push(new THREE.Vector2(0.12 + Math.sin(t * Math.PI * 0.9) * 0.1 + t * 0.03, t * 0.32)); }
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 28), gloss('#ffb3d1', { side: THREE.DoubleSide })); pot.position.y = 0.63; pot.rotation.z = 0.08; pot.castShadow = true; wh.add(pot);
  H.upd.push((dt, t) => { head.rotation.y += dt * 4; pot.rotation.y += dt * 4; });
  // shelves of mugs and pots (code: little glossy cylinders with handles)
  const shelf = (x, y) => { box(g, 2.4, 0.08, 0.36, gloss('#ffffff', { roughness: 0.4 }), x, y, -2.8); for (let i = 0; i < 6; i++) { const c = ['#ffb3d1', '#a8ecd6', '#cdb4ff', '#ffe49a', '#ffc4a8', '#a9dcff'][(i + Math.round(y)) % 6]; const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.2 + rnd() * 0.1, 18), gloss(c)); m.position.set(x - 1.0 + i * 0.4, y + 0.15, -2.75); m.rotation.z = (rnd() - 0.5) * 0.25; m.castShadow = true; g.add(m); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 12), gloss(c)); hd.position.set(x - 0.9 + i * 0.4, y + 0.16, -2.75); g.add(hd); } };
  shelf(0, 1.55); shelf(0, 2.25);
  place(g, 'g17', 0.7, -4.2, 0, -2.2, 0.6); place(g, 'h07', 0.5, 4.3, 0, -2.5, -0.4);
  // gallery dressing: plinths with framed work + spotlights + fairy lights
  const gal = new THREE.Group(); g.add(gal); H.gal = gal;
  const frame = (x, y, kind, w = 1.0, h = 1.25) => { rb(gal, w + 0.16, h + 0.16, 0.08, 0.04, gloss('#ffd84a', { metalness: 0.3, roughness: 0.3 }), x, y, -2.92); const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std('#fff', { map: painting(kind), roughness: 0.7 })); f.position.set(x, y, -2.87); gal.add(f); glow(gal, '#fff2c4', 1.8, x, y + 0.2, -2.6, 0.35); };
  frame(-0.0, 2.8, 'star', 1.3, 1.0); frame(-4.0, 2.4, 'sea'); frame(4.0, 2.4, 'heart');
  for (const [x, z, kind] of [[-2.6, -0.6, 'cup'], [2.7, -0.4, 'bowl']]) { rb(gal, 0.7, 1.0, 0.7, 0.05, gloss('#ffffff', { roughness: 0.35 }), x, 0.5, z); if (kind === 'cup') for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 18), gloss(['#ffb3d1', '#a8ecd6', '#cdb4ff'][i])); m.position.set(x - 0.2 + i * 0.2, 1.1, z); m.rotation.z = (i - 1) * 0.12; m.castShadow = true; gal.add(m); } else { const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 12, 0, 6.3, Math.PI / 2, Math.PI / 2), gloss('#cdb4ff', { side: THREE.DoubleSide })); b.position.set(x, 1.26, z); gal.add(b); const gold = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 30, 2.4), std('#ffd84a', { metalness: 0.8, roughness: 0.2, emissive: '#aa7a00', emissiveIntensity: 0.3 })); gold.position.set(x, 1.12, z + 0.08); gal.add(gold); } }
  const gf = [fairy(gal, V(-4.8, 4.1, -2.6), V(4.8, 4.1, -2.6), 30, 0.5, ['#fff3b0', '#ffb3d9', '#b9f2ff']), fairy(gal, V(-4.8, 4.1, -0.5), V(4.8, 4.1, 1.5), 26, 0.7, ['#ffb3d9', '#fff3b0', '#d4c2ff'])];
  const air = sparkles(g, 50, [9, 3.5, 5, 0.3, -0.5], '#fff0fa', 0.05); H.upd.push((dt, t) => { air.material.uniforms.t.value = t; });
  H.onVar = [P => { wm.map = skyTex(P.win); wm.needsUpdate = true; gal.visible = !!P.gallery; for (const e of H.easels) e.visible = !P.gallery; wh.visible = !P.gallery; air.material.uniforms.op.value = P.gallery ? 1 : 0.6; }];
  H.marks = { L: V(-0.75, 0, 0.6), R: V(0.75, 0, 0.6), C: V(0, 0, 0.85), LL: V(-1.8, 0, 1.0), RR: V(1.8, 0, 1.0) };
  H.est = { pos: V(0, 2.2, 6.4), look: V(0, 1.5, -1.5), fov: 44 };
  return H;
}

// ---------- Moonbean Café
function cafe() {
  const VAR = {
    day: { sky: [[0, '#ffe9f3'], [1, '#ffe1ec']], hemi: ['#fff2f4', '#c08ab8', 0.95], sun: ['#fff1e0', 2.0, [5, 8, 7]], exp: 0.95, win: [[0, '#9fd6ff'], [1, '#fff0d8']], lampK: 0.4 },
    dusk: { sky: [[0, '#ffd9e8'], [1, '#f6c9e0']], hemi: ['#ffd6e4', '#8a64b0', 0.82], sun: ['#ffb08c', 1.8, [5, 6, 6]], exp: 0.95, win: [[0, '#7d6fe0'], [0.5, '#f29cc4'], [1, '#ffcfa0']], lampK: 1 },
  };
  const H = mkSet(VAR), g = H.group;
  const floorT = tex(256, 256, (x, w) => { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 2 ? '#fff4f8' : '#ffafcc'; x.fillRect(c * 64, r * 64, 64, 64); } }, [5, 4]);
  room(g, { wall: '#ffc8df', wall2: '#ffd9e9', floorT, w: 10, d: 7, h: 4.2, wainscot: '#9fe6cc', trim: '#ffffff' });
  const wm = skyWindowMat(VAR.day.win); H.winM = wm;
  windowPane(g, -3.2, 2.3, -2.99, 2.0, 1.9, wm); windowPane(g, 4.94, 2.2, -0.6, 2.0, 1.9, wm, -Math.PI / 2);
  // menu board with the café's moon logo (text drawn in code)
  const menuT = tex(512, 320, (x, w, h) => { x.fillStyle = '#3d2f63'; x.beginPath(); x.roundRect(0, 0, w, h, 30); x.fill(); x.strokeStyle = '#ffb3d1'; x.lineWidth = 10; x.stroke(); x.fillStyle = '#ffe49a'; x.beginPath(); x.arc(110, 110, 56, 0, 7); x.fill(); x.fillStyle = '#3d2f63'; x.beginPath(); x.arc(136, 92, 50, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '700 64px Fredoka, "Baloo 2", sans-serif'; x.fillText('Moonbean', 180, 125); x.font = '600 30px Nunito, sans-serif'; x.fillStyle = '#ffd1e6'; ['boba · 4', 'moon latte · 3', 'cat cookie · 2', 'crit-day macaron · 2'].forEach((s, i) => x.fillText(s, 60 + (i % 2) * 230, 210 + Math.floor(i / 2) * 50)); });
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.44), std('#fff', { map: menuT, roughness: 0.6 })); menu.position.set(1.8, 2.7, -2.98); g.add(menu);
  place(g, 'h09', 1.9, 1.5, 0, -2.45, 0); place(g, 'h11', 0.7, 3.8, 0, -2.4, -0.2);
  place(g, 'h10', 1.6, -3.0, 0, -0.9, 0.3); place(g, 'h10', 1.4, 3.7, 0, 0.6, -0.5);
  place(g, 'f09', 0.32, -3.0, 0.78, -0.9, 0.5); place(g, 't01', 0.24, -2.6, 0.78, -0.75, 0); place(g, 'g09', 0.2, 3.6, 0.7, 0.6, 0);
  place(g, 'h07', 0.55, -4.4, 0, -2.4, 0.2); place(g, 'h06', 0.75, 4.4, 0, -2.5, -0.2);
  // moon pendant lamps
  const lamps = [];
  for (const [x, z] of [[-2.8, -1.0], [0, -0.4], [2.6, -1.2]]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), std('#7a6290')); cord.position.set(x, 3.6, z); g.add(cord);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), new THREE.MeshStandardMaterial({ color: '#fff6c8', emissive: '#ffd27a', emissiveIntensity: 0.5, roughness: 0.4 })); shade.position.set(x, 2.9, z); g.add(shade);
    lamps.push({ shade, glow: glow(g, '#ffd8a0', 1.6, x, 2.85, z, 0.5) });
  }
  // a booth bench along the left wall
  rb(g, 0.6, 0.5, 2.4, 0.12, gloss('#cdb4ff'), -4.55, 0.25, 0.6); rb(g, 0.2, 0.9, 2.4, 0.08, gloss('#e6d8ff'), -4.8, 0.85, 0.6);
  const air = sparkles(g, 40, [9, 3, 5, 0.4, -0.5], '#fff3e0', 0.045); H.upd.push((dt, t) => { air.material.uniforms.t.value = t; });
  H.onVar = [P => { wm.map = skyTex(P.win); wm.needsUpdate = true; for (const l of lamps) { l.shade.material.emissiveIntensity = 0.3 + P.lampK * 0.9; l.glow.material.opacity = 0.2 + P.lampK * 0.45; } }];
  H.marks = { L: V(-0.75, 0, 0.75), R: V(0.75, 0, 0.75), C: V(0, 0, 1.0), LL: V(-1.8, 0, 1.2), RR: V(1.8, 0, 1.2) };
  H.est = { pos: V(0, 2.2, 6.6), look: V(0, 1.4, -1.5), fov: 44 };
  return H;
}

// ---------- Lilac Hall 4B
function dorm() {
  const VAR = {
    morning: { sky: [[0, '#f3e8ff'], [1, '#ffe8f2']], hemi: ['#fff2fa', '#b490d8', 0.95], sun: ['#fff1e2', 2.2, [6, 7, 6]], exp: 0.95, win: [[0, '#9fd6ff'], [1, '#ffe8f4']], lampK: 0.2 },
    evening: { sky: [[0, '#e2d0ff'], [1, '#ffd8ea']], hemi: ['#ffcfe6', '#7a5aa8', 0.78], sun: ['#ffa880', 1.7, [6, 5, 6]], exp: 0.95, win: [[0, '#4b3c9e'], [0.6, '#d47ab4'], [1, '#ffb08a']], lampK: 1 },
  };
  const H = mkSet(VAR), g = H.group;
  const floorT = tex(512, 512, (x, w, h) => { for (let r = 0; r < 8; r++) { let cx = -(r * 97 % 160); while (cx < w) { const len = 140 + (rnd() * 160 | 0), l = 0.93 + rnd() * 0.07; x.fillStyle = `rgb(${250 * l | 0},${222 * l | 0},${206 * l | 0})`; x.fillRect(cx, r * 64, len - 3, 61); cx += len; } } }, [2.5, 2]);
  // wallpaper: lilac with tiny stars
  const wp = tex(256, 256, (x, w) => { x.fillStyle = '#e9dcff'; x.fillRect(0, 0, w, w); x.fillStyle = '#ffffff'; for (let i = 0; i < 16; i++) { const cx = (i % 4) * 64 + 32 + (Math.floor(i / 4) % 2) * 32, cy = Math.floor(i / 4) * 64 + 32; x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3 : 8; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); } }, [6, 3]);
  const R = room(g, { wall: '#ffffff', wall2: '#f1e8ff', floorT, w: 9, d: 7, h: 4.2, wainscot: '#ffd0e0' });
  R.back.material = std('#fff', { map: wp, roughness: 0.9 });
  const wm = skyWindowMat(VAR.morning.win); H.winM = wm;
  windowPane(g, 0.2, 2.5, -2.99, 1.8, 1.7, wm);
  // curtains
  for (const sx of [-1.25, 1.65]) { const c = rb(g, 0.45, 2.2, 0.08, 0.04, gloss('#ffb3d1', { roughness: 0.7, clearcoat: 0.2 }), sx, 2.45, -2.9); }
  place(g, 'h01', 2.3, -3.1, 0, -1.6, Math.PI / 2); place(g, 'h02', 1.0, 3.5, 0, -1.0, -0.7); place(g, 'h03', 1.5, 2.4, 0, -2.4, 0);
  { const rug = place(g, 'h05', 2.4, 0, 0.0, 0.3, 0, false); rug.scale.y *= 0.12; } place(g, 'h06', 0.8, -1.6, 0, -2.5, 0); place(g, 'h08', 1.1, -3.0, 2.0, -2.86, 0); place(g, 'h07', 0.42, 3.2, 0.9, -2.5, 0);
  place(g, 'g15', 0.5, -3.6, 0.55, -1.0, 0.8); place(g, 'g17', 0.6, -2.6, 0.55, -1.9, 0.4);
  // Bea's sketch wall → evidence board: pinned papers + pink string
  const sk = new THREE.Group(); g.add(sk); H.board = sk;
  const paperT = i => tex(128, 160, (x, w, h) => { x.fillStyle = '#fffdf6'; x.fillRect(0, 0, w, h); x.strokeStyle = ['#8a63ff', '#ff5fa2', '#19b892', '#f2a516', '#ff8d5c'][i % 5]; x.lineWidth = 5; x.beginPath(); x.arc(64, 70, 34, 0, 7); x.stroke(); x.beginPath(); x.arc(52, 64, 4, 0, 7); x.arc(76, 64, 4, 0, 7); x.stroke(); x.beginPath(); x.arc(64, 78, 12, 0.2, 2.9); x.stroke(); x.font = '700 18px Nunito'; x.fillStyle = '#5a4a80'; x.fillText(['SOL?', 'MIKA?', 'JUNE?', 'BUN??', 'ME!'][i % 5], 30, 140); });
  const pins = [];
  [[-3.4, 2.9], [-2.6, 3.3], [-1.9, 2.7], [-3.1, 2.1], [-2.2, 2.0]].forEach(([x, y], i) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), std('#fff', { map: paperT(i), roughness: 0.9 })); p.position.set(x, y, -2.98); p.rotation.z = (rnd() - 0.5) * 0.2; sk.add(p); pins.push(V(x, y + 0.25, -2.96)); const pin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), gloss('#ff4f9a')); pin.position.copy(pins[i]); sk.add(pin); });
  const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pins[0], pins[2], pins[4], pins[1], pins[3], pins[0], pins[4]]), new THREE.LineBasicMaterial({ color: '#ff4f9a' })); sk.add(str); H.str = str;
  // fairy lights over the bed + lamp glow
  const fl = fairy(g, V(-4.4, 3.6, -2.8), V(-0.9, 3.5, -2.8), 16, 0.35, ['#fff3b0', '#ffb3d9', '#b9f2ff']);
  const lg = glow(g, '#ffd3a0', 1.6, -1.6, 0.75, -2.4, 0.4);
  const air = sparkles(g, 30, [8, 3, 4, 0.5, -0.5], '#fff0fa', 0.045); H.upd.push((dt, t) => { air.material.uniforms.t.value = t; });
  H.onVar = [P => { wm.map = skyTex(P.win); wm.needsUpdate = true; lg.material.opacity = 0.15 + P.lampK * 0.5; fl.im.visible = true; }];
  H.marks = { L: V(-0.7, 0, 0.7), R: V(0.7, 0, 0.7), C: V(0, 0, 0.95), LL: V(-1.7, 0, 1.1), RR: V(1.7, 0, 1.1) };
  H.est = { pos: V(0, 2.1, 6.2), look: V(0, 1.4, -1.5), fov: 44 };
  return H;
}

// ---------- the rooftop
function roof() {
  const VAR = { night: { sky: [[0, '#120f3d'], [0.5, '#2c2470'], [0.8, '#5b3a92'], [1, '#b2609e']], fog: '#3a2c6c', fogN: 14, fogF: 70, hemi: ['#a898ff', '#2a1a48', 0.65], sun: ['#d6ccff', 0.9, [-4, 9, 7]], exp: 1.0 } };
  const H = mkSet(VAR), g = H.group;
  const tileT = tex(256, 256, (x, w) => { x.fillStyle = '#a58fc8'; x.fillRect(0, 0, w, w); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 2 ? '#d9c8f5' : '#cdb8ef'; x.beginPath(); x.roundRect(c * 64 + 2, r * 64 + 2, 60, 60, 8); x.fill(); } }, [8, 6]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), std('#fff', { map: tileT, roughness: 0.6 })); fl.rotation.x = -Math.PI / 2; fl.position.z = 0; fl.receiveShadow = true; g.add(fl);
  // parapet + railing at the back
  rb(g, 14, 0.6, 0.4, 0.1, gloss('#e9dcff', { roughness: 0.5 }), 0, 0.3, -2.6);
  const rail = gloss('#ffb3d1');
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 14, 8), rail); top.rotation.z = Math.PI / 2; top.position.set(0, 1.25, -2.55); g.add(top);
  for (let x = -6.5; x <= 6.5; x += 0.5) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 6), rail); p.position.set(x, 0.92, -2.55); g.add(p); }
  // city skyline: rounded towers with lit windows
  const cityWin = tex(64, 128, (x, w, h) => { x.fillStyle = '#3b2f7a'; x.fillRect(0, 0, w, h); for (let r = 0; r < 10; r++) for (let c = 0; c < 4; c++) if (rnd() < 0.55) { x.fillStyle = ['#ffe49a', '#ffb3d9', '#bfe9ff'][(r + c) % 3]; x.fillRect(c * 16 + 4, r * 12 + 3, 8, 6); } });
  const bm = new THREE.MeshStandardMaterial({ color: '#4a3c8e', emissiveMap: cityWin, emissive: '#ffffff', emissiveIntensity: 1.2, map: cityWin, roughness: 0.8 });
  for (let i = 0; i < 26; i++) { const w = 1.2 + rnd() * 2, h = 3 + rnd() * 9, x = -26 + i * 2.1 + rnd(), z = -14 - rnd() * 14; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bm); b.position.set(x, h / 2 - 6, z); g.add(b); if (rnd() < 0.3) glow(g, '#ff8fcf', 0.6, x, h - 5.9, z + w / 2, 0.8); }
  // moon + stars + shooting star
  const moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshBasicMaterial({ color: '#fff6d6', toneMapped: false })); moon.position.set(-12, 15, -45); g.add(moon); glow(g, '#fff0c8', 16, -12, 15, -44.5, 0.35);
  const stars = sparkles(g, 260, [90, 34, 10, 4, -42], '#ffffff', 0.12); const air = sparkles(g, 50, [9, 3.5, 5, 0.3, -0.5], '#ffe7f7', 0.05);
  const shoot = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending })); g.add(shoot);
  let st = 3;
  H.upd.push((dt, t) => { stars.material.uniforms.t.value = t; air.material.uniforms.t.value = t; st -= dt; if (st < 0) { st = 5 + rnd() * 5; shoot.position.set(-10 + rnd() * 20, 12 + rnd() * 6, -40); shoot.userData.t = 0; } if (shoot.userData.t != null && shoot.userData.t < 1) { shoot.userData.t += dt * 1.2; const k = shoot.userData.t; shoot.position.x += dt * 22; shoot.position.y -= dt * 8; shoot.rotation.z = -0.35; shoot.material.opacity = Math.sin(k * Math.PI) * 0.9; } });
  // string lights overhead, telescope, blanket picnic, plants, bench
  fairy(g, V(-5, 3.3, -2.4), V(5, 3.3, -2.4), 32, 0.6, ['#fff3b0', '#ffb3d9', '#b9f2ff', '#d4c2ff']);
  fairy(g, V(-5, 3.3, -2.4), V(-3.0, 3.0, 3.5), 18, 0.5, ['#ffb3d9', '#fff3b0']); fairy(g, V(5, 3.3, -2.4), V(3.0, 3.0, 3.5), 18, 0.5, ['#fff3b0', '#b9f2ff']);
  const ts = new THREE.Group(); ts.position.set(2.9, 0, -1.3); ts.rotation.y = -0.6; g.add(ts);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), gloss('#ffffff')); const a = i * 2.1; l.position.set(Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2); l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); ts.add(l); }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 18), gloss('#cdb4ff')); tube.position.set(0, 1.15, 0); tube.rotation.z = 1.0; tube.castShadow = true; ts.add(tube);
  const bl = tex(256, 256, (x, w) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.fillStyle = (r + c) % 2 ? '#fff6fb' : '#ffb3d1'; x.fillRect(c * 32, r * 32, 32, 32); } });
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), std('#fff', { map: bl, roughness: 0.9 })); blanket.rotation.x = -Math.PI / 2; blanket.rotation.z = 0.25; blanket.position.set(-2.6, 0.012, -0.6); blanket.receiveShadow = true; g.add(blanket);
  place(g, 'r05', 0.42, -2.3, 0.01, -0.5, 0.4); place(g, 't01', 0.22, -2.9, 0.01, -0.3, 0); place(g, 'g09', 0.18, -2.6, 0.01, -0.95, 0);
  place(g, 'h07', 0.6, -4.6, 0, -2.0, 0); place(g, 'h07', 0.5, 4.6, 0, -1.9, 1.2); place(g, 'r02', 1.5, -4.4, 0, 0.4, 1.0);
  H.marks = { L: V(-0.7, 0, 0.5), R: V(0.7, 0, 0.5), C: V(0, 0, 0.75), LL: V(-1.8, 0, 1.0), RR: V(1.9, 0, 1.0) };
  H.est = { pos: V(0, 2.0, 6.5), look: V(0, 2.2, -4), fov: 46 };
  return H;
}

// Chain Net Crew — a night street-court shootout driven by the player's own AI coding agents.
// Every live agent is a baller (own jersey colour + project label), subagents are rookies who feed their lead.
// Tool start = the agent takes the ball and dribbles; the result decides the shot: ok = make, failure = brick.
//   edit → 3-pointer · read → layup · commit/deploy → dunk · test ok → alley-oop (slow-mo) · run/web/other → jumper
// The player shoots too (hold, release in the green), coaches the court with points and runs 2-minute shootouts.
import { THREE, createStage, loop, stickman, mat, glossy, rounded, burst, confetti, tone, store, lerp, clamp } from './kit/hc.js';
import { agents, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';

const $ = id => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// ---------------------------------------------------------------- save data
const ST = store('agenthoops');
const TODAY = () => new Date().toLocaleDateString('en-CA');
const SEASON = () => TODAY().slice(0, 7);
const newDay = () => ({ team: 0, tAtt: 0, tMade: 0, my: 0, myAtt: 0, myMade: 0, hi: 0, dunks: 0, threes: 0, oops: 0, tokens: 0, streak: 0, myStreak: 0 });
let save; try { save = ST.get('save', null); } catch (e) { save = null; }
save = Object.assign({ wallet: 0, up: { lights: 0, hoop: 0, crowd: 0, jersey: 0 }, days: {}, season: {}, seasonKey: SEASON(), best: 0, myBest: 0, shots: 0 }, save || {});
function persist() { try { ST.set('save', save); } catch (e) {} }
function day(t) {
  const k = t ? new Date(t).toLocaleDateString('en-CA') : TODAY();
  if (!save.days[k]) { save.days[k] = newDay(); const ks = Object.keys(save.days).sort(); while (ks.length > 30) delete save.days[ks.shift()]; }
  return save.days[k];
}
function season() { if (save.seasonKey !== SEASON()) { save.seasonKey = SEASON(); save.season = {}; } return save.season; }
const demoDay = newDay(), demoSeason = {};
const hype = () => 1 + 0.05 * Object.values(save.up).reduce((a, b) => a + b, 0);
const todayScore = () => { const d = day(); return d.team + d.my; };

// ---------------------------------------------------------------- stage
const stage = createStage({ fov: 42, shadowSize: 13, clear: '#0b0d1e' });
const { scene, camera, renderer, sun, hemi } = stage;
hemi.color.set('#8796d8'); hemi.groundColor.set('#1d1630'); hemi.intensity = 0.75;
sun.color.set('#b9c8ff'); sun.intensity = 0.55; sun.position.set(-7, 18, 6);
scene.fog = new THREE.Fog('#0b0d1e', 34, 80);

const HOOP = V(0, 3.05, -6), RIM_R = 0.25, BALL_R = 0.16, G = 9.8;
const canvasTex = (w, h, draw, rep) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};

// court: 18 x 16 m plane, x -9..9, z -9..7, 64 px / m
const PX = 64, X = x => (x + 9) * PX, Z = z => (z + 9) * PX;
const courtTex = canvasTex(18 * PX, 16 * PX, (g, w, h) => {
  g.fillStyle = '#23263a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  g.fillStyle = '#2f4a8a'; g.fillRect(X(-7.5), Z(-7.6), 15 * PX, 13.6 * PX);              // playing area
  g.fillStyle = '#ff6b2c'; g.fillRect(X(-1.8), Z(-7.6), 3.6 * PX, 4.8 * PX);               // key
  g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.arc(X(0), Z(-6), 5.6 * PX, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(X(-7.5) + Math.random() * 15 * PX, Z(-7.6) + Math.random() * 13.6 * PX, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,.88)'; g.lineWidth = 6;
  g.strokeRect(X(-7.5), Z(-7.6), 15 * PX, 13.6 * PX);
  g.strokeRect(X(-1.8), Z(-7.6), 3.6 * PX, 4.8 * PX);
  g.beginPath(); g.arc(X(0), Z(-2.8), 1.8 * PX, 0, Math.PI * 2); g.stroke();
  const a = Math.asin(1.92 / 5.6);
  g.beginPath(); g.moveTo(X(-5.25), Z(-7.6)); g.lineTo(X(-5.25), Z(-6 + 1.92)); g.arc(X(0), Z(-6), 5.6 * PX, Math.PI - a, a, true); g.lineTo(X(5.25), Z(-7.6)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(-6), 1.25 * PX, 0, Math.PI); g.stroke();
  g.beginPath(); g.arc(X(0), Z(6), 1.9 * PX, Math.PI, 0); g.stroke();
  // painted crew mark at the top of the court
  g.save(); g.translate(X(0), Z(3.4)); g.fillStyle = 'rgba(255,207,58,.22)'; g.beginPath(); g.arc(0, 0, 1.25 * PX, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,207,58,.55)'; g.lineWidth = 5; g.stroke();
  g.fillStyle = 'rgba(255,240,200,.55)'; g.font = `${0.62 * PX}px Bungee, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CNC', 0, 4); g.restore();
});
const court = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), mat('#ffffff', { map: courtTex, roughness: 0.85 }));
court.rotation.x = -Math.PI / 2; court.position.set(0, 0, -1); court.receiveShadow = true; scene.add(court);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat('#14162a', { roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; scene.add(ground);

// sky: stars + moon + skyline with lit windows
{
  const n = 500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3, r = 90; p.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.8 + 6, Math.sin(a) * Math.cos(e) * r - 20], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#dfe6ff', size: 0.35, sizeAttenuation: true, fog: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3cf', fog: false }));
  moon.position.set(-26, 30, -70); scene.add(moon);
  const winTex = k => canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#151a33'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 6; y += 12) for (let x = 6; x < w - 6; x += 12) { const r = Math.random(); g.fillStyle = r < 0.32 + k * 0.08 ? (r < 0.1 ? '#ffd27a' : '#f7b955') : r < 0.45 ? '#2b5c9e' : '#1d2242'; g.fillRect(x, y, 6, 7); }
  });
  const texs = [0, 1, 2].map(winTex);
  for (let i = 0; i < 26; i++) {
    const w = 4 + Math.random() * 7, h = 7 + Math.random() * 22, d = 4 + Math.random() * 4, x = -50 + i * 4 + (Math.random() - 0.5) * 3, z = -24 - Math.random() * 18;
    const t = texs[i % 3].clone(); t.needsUpdate = true; t.repeat.set(w / 4, h / 8);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ map: t, color: '#c8cff5' }));
    m.position.set(x, h / 2, z); scene.add(m);
  }
}

// fence (chain link) behind the hoop + light poles
const fenceTex = canvasTex(64, 64, (g, w, h) => { g.strokeStyle = '#aeb6d6'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); }, [40, 9]);
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.6), new THREE.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: '#8f98bd', metalness: 0.4, roughness: 0.5 }));
  f.position.set(0, 2.3, -9.6); scene.add(f);
  for (let x = -11; x <= 11; x += 2.75) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.7, 8), glossy('#7a83a8', { metalness: 0.5 })); p.position.set(x, 2.35, -9.6); scene.add(p); }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 22, 8), glossy('#7a83a8', { metalness: 0.5 })); rail.rotation.z = Math.PI / 2; rail.position.set(0, 4.65, -9.6); scene.add(rail);
}

// glow sprite texture (halos, flames)
const GLOW = canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const glowSprite = (color, s, op = 0.8) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(s); return sp; };

// ---------------------------------------------------------------- hoop: pole, board, rim, chain net
const hoopG = new THREE.Group(); scene.add(hoopG);
const poleMat = glossy('#3a4466', { metalness: 0.4 });
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 4.1, 12), poleMat); pole.position.set(0, 2.05, -7.9); pole.castShadow = true; hoopG.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.3), poleMat); arm.position.set(0, 3.7, -7.25); arm.castShadow = true; hoopG.add(arm);
  const pad = new THREE.Mesh(rounded(0.5, 1.6, 0.5, 0.12), mat('#ff6b2c')); pad.position.set(0, 0.8, -7.9); hoopG.add(pad);
}
const boardMat = new THREE.MeshStandardMaterial({ color: '#eef2ff', roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 });
const board3d = new THREE.Mesh(rounded(1.9, 1.12, 0.06, 0.04), boardMat); board3d.position.set(0, 3.45, -6.55); board3d.castShadow = true; hoopG.add(board3d);
const boxLine = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), new THREE.MeshBasicMaterial({ color: '#ff5a2a' }));
{ const sq = new THREE.Group(); for (const [w, h, x, y] of [[0.6, 0.05, 0, 0.45], [0.6, 0.05, 0, 0.0], [0.05, 0.5, -0.3, 0.22], [0.05, 0.5, 0.3, 0.22]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ff5a2a' })); m.position.set(x, y, 0); sq.add(m); } sq.position.set(0, 3.12, -6.515); hoopG.add(sq); }
const edgeMat = new THREE.MeshBasicMaterial({ color: '#ff5a2a' });
const boardEdge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 4), edgeMat); boardEdge.rotation.z = Math.PI / 4; boardEdge.scale.set(1.38, 0.82, 1); boardEdge.position.set(0, 3.45, -6.51); hoopG.add(boardEdge);
const rimPivot = new THREE.Group(); rimPivot.position.set(0, HOOP.y, HOOP.z - RIM_R - 0.05); hoopG.add(rimPivot);
const rimMat = glossy('#ff5a1f', { metalness: 0.3, emissive: '#541500' });
const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.024, 10, 36), rimMat); rim.rotation.x = Math.PI / 2; rim.position.z = RIM_R + 0.05; rim.castShadow = true; rimPivot.add(rim);
{ const br = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.22), rimMat); br.position.set(0, 0, 0.0); rimPivot.add(br); }
const rimGlow = glowSprite('#ff5a1f', 1.6, 0); rimGlow.position.copy(HOOP); scene.add(rimGlow);
// chain net: 12 chains, 6 rings of nodes in a diamond lattice, drawn as thin metal cylinders
const NET_N = 12, NET_M = 6;
const netSegs = [];
for (let k = 0; k < NET_M; k++) for (let i = 0; i < NET_N; i++) {
  if (k % 2 === 0) { netSegs.push([i, k, i, k + 1], [i, k, (i + NET_N - 1) % NET_N, k + 1]); }
  else { netSegs.push([i, k, i, k + 1], [i, k, (i + 1) % NET_N, k + 1]); }
}
const netMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 5), glossy('#d9deef', { metalness: 0.8, roughness: 0.25, emissive: '#3a3f55' }), netSegs.length);
netMesh.castShadow = true; scene.add(netMesh);
const net = { kick: 0, sway: 0, nodes: [] };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = V(0, 1, 0), _d = V(), _p = V();
function netNode(i, k, t) {
  const f = k / NET_M, r = (RIM_R - 0.004) * (1 - 0.4 * f) * (1 - 0.35 * net.kick * f);
  const th = (i + (k % 2) * 0.5) / NET_N * Math.PI * 2 + 0.3 * net.kick * Math.sin(t * 22) * f + net.sway * Math.sin(t * 3 + i) * 0.05 * f;
  return _p.set(HOOP.x + Math.cos(th) * r, HOOP.y - 0.085 * k * (1 + 0.5 * net.kick) - rimPivot.rotation.x * 0.25 * (1 - f), HOOP.z + Math.sin(th) * r + Math.sin(t * 2 + i) * 0.006 * f).clone();
}
function updateNet(t) {
  const nodes = [];
  for (let k = 0; k <= NET_M; k++) { nodes[k] = []; for (let i = 0; i < NET_N; i++) nodes[k][i] = netNode(i, k, t); }
  netSegs.forEach(([i, k, j, k2], n) => {
    const a = nodes[k][i], b = nodes[k2][j]; _d.subVectors(b, a); const len = _d.length();
    _q.setFromUnitVectors(_up, _d.normalize()); _s.set(1, len, 1); _m.compose(a.clone().lerp(b, 0.5), _q, _s); netMesh.setMatrixAt(n, _m);
  });
  netMesh.instanceMatrix.needsUpdate = true;
}

// scoreboard above the hoop (canvas texture)
const sbCanvas = document.createElement('canvas'); sbCanvas.width = 512; sbCanvas.height = 200;
const sbTex = new THREE.CanvasTexture(sbCanvas); sbTex.colorSpace = THREE.SRGBColorSpace;
const sb = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.13), new THREE.MeshBasicMaterial({ map: sbTex }));
sb.position.set(0, 5.05, -7.75); scene.add(sb);
{ const back = new THREE.Mesh(rounded(3.1, 1.3, 0.25, 0.06), mat('#1b1f36')); back.position.set(0, 5.05, -7.92); scene.add(back); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), poleMat); post.position.set(0, 4.3, -7.95); scene.add(post); }
let sbKey = '';
function drawScoreboard(team, clock, you, line, o = {}) {
  const key = [team, clock, you, line, o.lt, o.rt, o.rc].join('|'); if (key === sbKey) return; sbKey = key;
  const g = sbCanvas.getContext('2d'), W = 512, H = 200;
  g.fillStyle = '#0a0b14'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ff7a2f'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 20px Rubik, sans-serif'; g.fillStyle = '#9aa3c9'; g.fillText(o.lt || 'TEAM', 90, 30, 160); g.fillText('SHOT', 256, 30); g.fillText(o.rt || 'YOU', 422, 30, 160);
  g.font = '64px Bungee, Impact, sans-serif'; g.fillStyle = '#ff4d3d'; g.shadowColor = '#ff4d3d'; g.shadowBlur = 16; g.fillText(team, 90, 92);
  g.fillStyle = '#ffb020'; g.shadowColor = '#ffb020'; g.font = '84px Bungee, Impact, sans-serif'; g.fillText(clock, 256, 96);
  g.fillStyle = o.rc || '#4ade80'; g.shadowColor = o.rc || '#4ade80'; g.font = '64px Bungee, Impact, sans-serif'; g.fillText(you, 422, 92);
  g.shadowBlur = 0; g.font = '700 24px Rubik, sans-serif'; g.fillStyle = '#e8e3f5'; g.fillText(line, 256, 168);
  sbTex.needsUpdate = true;
}

// ---------------------------------------------------------------- upgrades: lights, hoop style, crowd, jerseys
const UPG = {
  lights: { name: 'Court lights', lv: ['Two old poles', 'Floodlights + string bulbs', 'LED court underglow', 'Sweeping show spots'] },
  hoop: { name: 'Hoop style', lv: ['Classic chain net', 'Glass board, LED edge', 'Gold rim', 'Neon rim'] },
  crowd: { name: 'Crowd', lv: ['A few neighbours', 'Block party', 'Bleachers packed', 'Sold-out sidewalk'] },
  jersey: { name: 'Jerseys', lv: ['Plain tees', 'Headbands', 'Neon sneakers', 'Gold trim + wristbands'] },
};
const COST = [0, 150, 500, 1500];
const lightG = new THREE.Group(); scene.add(lightG);
let sweep = [];
function buildLights() {
  lightG.clear(); sweep = [];
  const L = save.up.lights;
  for (const sx of [-1, 1]) {
    const x = sx * 9.6, z = -8.4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 8.4, 10), poleMat); pole.position.set(x, 4.2, z); pole.castShadow = true; lightG.add(pole);
    const head = new THREE.Mesh(rounded(1.1, 0.45, 0.35, 0.06), mat('#2a3150')); head.position.set(x - sx * 0.4, 8.35, z + 0.2); head.lookAt(0, 0, -2); lightG.add(head);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ color: '#fff4d6' })); lamp.position.copy(head.position); lamp.lookAt(0, 0, -2); lamp.translateZ(0.19); lightG.add(lamp);
    const halo = glowSprite('#ffe9b0', 4 + L, 0.75); halo.position.copy(lamp.position); lightG.add(halo);
    const sp = new THREE.SpotLight('#ffe6b8', 70 + L * 25, 0, 0.62, 0.55, 1.15); sp.position.copy(head.position); sp.target.position.set(sx * -1.5, 0, -2.5);
    if (sx < 0) { sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005; }
    lightG.add(sp, sp.target);
    // soft light cone
    const len = head.position.distanceTo(V(sx * -1.5, 0, -2.5));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.6, len, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe6b8', transparent: true, opacity: 0.045 + L * 0.01, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.copy(head.position).lerp(V(sx * -1.5, 0, -2.5), 0.5); cone.lookAt(head.position); cone.rotateX(-Math.PI / 2); lightG.add(cone);
  }
  if (L >= 1) {   // string bulbs along the fence + a front flood
    for (let i = 0; i < 26; i++) { const x = -10.5 + i * 0.84, y = 4.75 - Math.sin(((i % 13) / 13) * Math.PI) * 0.45; const c = ['#ffd27a', '#ff7aa8', '#7ad9ff', '#a6ff7a'][i % 4]; const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: c })); b.position.set(x, y, -9.5); lightG.add(b); const h = glowSprite(c, 0.6, 0.6); h.position.copy(b.position); lightG.add(h); }
    const f = new THREE.PointLight('#bcd0ff', 18, 30, 1.2); f.position.set(0, 9, 8); lightG.add(f);
  }
  if (L >= 2) {   // LED underglow strips around the playing area
    const strip = (w, d, x, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, 0.02, z); lightG.add(m); };
    strip(15.3, 0.08, 0, -7.75, '#ff3df2'); strip(0.08, 13.8, -7.65, -0.8, '#3dd9ff'); strip(0.08, 13.8, 7.65, -0.8, '#3dd9ff');
    for (const [x, z, c] of [[-7.6, -4, '#3dd9ff'], [7.6, -4, '#3dd9ff'], [0, -7.7, '#ff3df2']]) { const p = new THREE.PointLight(c, 6, 7, 1.4); p.position.set(x, 0.4, z); lightG.add(p); }
  }
  if (L >= 3) {
    for (const c of ['#ff4fd8', '#3df2ff']) { const sp = new THREE.SpotLight(c, 90, 0, 0.32, 0.6, 1.1); sp.position.set(c === '#ff4fd8' ? -6 : 6, 11, 4); lightG.add(sp, sp.target); sweep.push(sp); }
  }
}
function applyHoop() {
  const H = save.up.hoop;
  boardMat.opacity = H >= 1 ? 0.45 : 0.92; boardMat.color.set(H >= 1 ? '#cfe6ff' : '#eef2ff');
  edgeMat.color.set(H >= 1 ? '#3df2ff' : '#ff5a2a');
  rimMat.color.set(H >= 3 ? '#ff3df2' : H >= 2 ? '#ffc93a' : '#ff5a1f'); rimMat.emissive.set(H >= 3 ? '#a0109a' : H >= 2 ? '#6a4a00' : '#541500'); rimMat.metalness = H >= 2 ? 0.7 : 0.3;
  rimGlow.material.color.set(H >= 3 ? '#ff3df2' : H >= 2 ? '#ffd65a' : '#ff5a1f');
}
// crowd
const crowdG = new THREE.Group(); scene.add(crowdG);
let crowd = [], cheer = 0;
const CROWD_N = [5, 12, 22, 32];
function buildCrowd() {
  crowdG.clear(); crowd = [];
  const C = save.up.crowd, spots = [];
  for (let i = 0; i < 12; i++) spots.push([-9 + i * 1.55 + (i > 5 ? 1.4 : 0) - (i > 5 ? 0 : 0.6), 0, -10.4]);
  for (let i = 0; i < 10; i++) { spots.push([-9.4, i % 2 ? 0.55 : 0, -7.5 + i * 0.8]); spots.push([9.4, i % 2 ? 0.55 : 0, -7.5 + i * 0.8]); }
  if (C >= 2) for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 8.5), mat('#3a4266')); b.position.set(sx * 9.8, 0.25, -3.6); b.receiveShadow = true; crowdG.add(b); const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 8.5), mat('#454e78')); b2.position.set(sx * 10.2, 0.5, -3.6); crowdG.add(b2); }
  const cols = ['#e05d7a', '#5d8ee0', '#e0c35d', '#7ae05d', '#b57ae0', '#e0905d', '#5de0d0', '#d0d6ea'];
  const n = Math.min(spots.length, CROWD_N[C]);
  const order = spots.map((s, i) => [s, (hash('c' + i) % 100) + (s[2] < -10 ? 0 : 30)]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = order[i]; const s = stickman(cols[hash('k' + i) % cols.length], ['#f1c7a5', '#c98b62', '#8d5a3b', '#5b3a26', '#ffd7ba'][i % 5], 1.05);
    const yy = C >= 2 && Math.abs(x) > 9 ? (i % 2 ? 1.0 : 0.5) : y;
    s.position.set(x, yy, z); s.lookAt(0, yy, -3); crowdG.add(s); crowd.push({ s, y: yy, ph: Math.random() * 6, flash: null });
    if (C >= 3 && i % 3 === 0) { const f = glowSprite('#ffffff', 0.5, 0); f.position.set(x, yy + 1.9, z + 0.2); crowdG.add(f); crowd[crowd.length - 1].flash = f; }
  }
}

// ---------------------------------------------------------------- flames (fire streak trail)
const flames = [];
for (let i = 0; i < 220; i++) { const s = glowSprite('#ffb020', 0.4, 0); s.visible = false; scene.add(s); flames.push({ s, life: 0, v: V(), sz: 0.4 }); }
let flameI = 0;
function flame(p, sz = 0.45, spread = 0.12) {
  const f = flames[flameI = (flameI + 1) % flames.length];
  f.s.position.set(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread);
  f.v.set((Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4); f.life = 1; f.sz = sz * (0.7 + Math.random() * 0.6); f.s.visible = true;
}
const C_HOT = new THREE.Color('#fff2a0'), C_MID = new THREE.Color('#ff8a1f'), C_END = new THREE.Color('#d61f00');
function updateFlames(dt) {
  for (const f of flames) {
    if (f.life <= 0) continue;
    f.life -= dt * 2.4; if (f.life <= 0) { f.s.visible = false; continue; }
    f.s.position.addScaledVector(f.v, dt); f.s.scale.setScalar(f.sz * (0.4 + f.life * 0.8));
    f.s.material.opacity = f.life * 0.9; f.s.material.color.copy(f.life > 0.6 ? C_HOT.clone().lerp(C_MID, (1 - f.life) / 0.4) : C_MID.clone().lerp(C_END, (0.6 - f.life) / 0.6));
  }
}

// ---------------------------------------------------------------- HTML pops + banners
const _pv = V();
function pop(pos, text, color = '#fff', size = 26) {
  _pv.copy(pos).project(camera); if (_pv.z > 1) return;
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = text; d.style.color = color; d.style.fontSize = (portrait() ? size * 0.72 : size) + 'px';
  d.style.left = clamp((_pv.x + 1) / 2 * innerWidth, 60, innerWidth - 60) + 'px'; d.style.top = clamp((1 - _pv.y) / 2 * innerHeight, 120, innerHeight - 80) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1150);
}
let bannerT = 0;
function banner(text, color = '#ffcf3a', sub = '') {
  const b = $('banner'); if (performance.now() - bannerT < 700) return; bannerT = performance.now();
  b.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); b.style.color = color; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}

// ---------------------------------------------------------------- sound (quiet)
const snd = {
  swish: () => { tone(1700, 0.09, 'sine', 0.035, 0.4); setTimeout(() => tone(2600, 0.05, 'triangle', 0.025, 0.8), 40); setTimeout(() => tone(3100, 0.05, 'triangle', 0.02, 0.9), 90); },
  brick: () => { tone(190, 0.14, 'square', 0.045, 0.6); tone(420, 0.06, 'triangle', 0.03, 0.7); },
  dunk: () => { tone(90, 0.3, 'sawtooth', 0.06, 0.5); tone(55, 0.35, 'square', 0.05, 0.5); setTimeout(() => tone(2400, 0.06, 'triangle', 0.025, 0.9), 60); },
  bounce: v => tone(95, 0.06, 'sine', Math.min(0.05, v * 0.012), 0.7),
  buzzer: () => tone(220, 0.5, 'sawtooth', 0.04, 1),
  ping: () => { tone(880, 0.1, 'sine', 0.05, 1); setTimeout(() => tone(1175, 0.14, 'sine', 0.05, 1), 110); },
  fire: () => { tone(300, 0.25, 'sawtooth', 0.04, 2.2); },
  cheer: () => { for (let i = 0; i < 5; i++) setTimeout(() => tone(500 + Math.random() * 700, 0.12, 'triangle', 0.015, 1.1), i * 40); },
  tick: () => tone(1300, 0.03, 'square', 0.02, 1),
};

// ---------------------------------------------------------------- balls
const ballTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#f07d28'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(110,40,0,${Math.random() * 0.18})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = '#2a1406'; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(1, 0); g.lineTo(1, h); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  for (const c of [w / 4, w * 3 / 4]) { g.beginPath(); for (let y = 0; y <= h; y += 4) { const x = c + Math.sin(y / h * Math.PI) * 30 * (c < w / 2 ? -1 : 1); y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
});
const BALL_GEO = new THREE.SphereGeometry(BALL_R, 24, 16), BALL_MAT = mat('#ffffff', { map: ballTex, roughness: 0.65 });
const balls = [];
class Ball {
  constructor(holder) { this.m = new THREE.Mesh(BALL_GEO, BALL_MAT); this.m.castShadow = true; scene.add(this.m); this.holder = holder; this.mode = 'held'; this.v = V(); this.life = 3; this.fire = false; this.grow = 0; balls.push(this); if (holder) this.m.position.copy(holder.hand('chest')); }
  fly(to, T, H, onArrive) { this.mode = 'fly'; this.holder = null; this.p0 = this.m.position.clone(); this.p1 = to.clone(); this.T = T; this.ft = 0; this.H = H; this.onArrive = onArrive; }
  free(v, life = 2.6) { this.mode = 'free'; this.holder = null; this.v.copy(v); this.life = life; }
  kill() { scene.remove(this.m); balls.splice(balls.indexOf(this), 1); }
  update(dt, t) {
    this.grow = Math.min(1, this.grow + dt * 5); const sc = this.mode === 'free' && this.life < 0.5 ? this.life / 0.5 : 1;
    this.m.scale.setScalar((0.3 + 0.7 * this.grow) * sc);
    if (this.mode === 'held' && this.holder) {
      const h = this.holder;
      if (h.pose === 'dribble' || h.pose === 'rundribble') { const ph = Math.abs(Math.sin(h.t * 7.5)); const p = h.hand('side'); p.y = BALL_R + ph * 0.95 * h.scale * 0.85; this.m.position.copy(p); this.m.rotation.x += dt * 8; }
      else this.m.position.lerp(h.hand(h.pose === 'up' || h.pose === 'slam' ? 'up' : 'chest'), Math.min(1, dt * 22));
    } else if (this.mode === 'fly') {
      this.ft += dt; const s = Math.min(1, this.ft / this.T);
      this.m.position.lerpVectors(this.p0, this.p1, s); this.m.position.y += 4 * this.H * s * (1 - s);
      this.m.rotation.x -= dt * 9;
      if (this.fire) { flame(this.m.position, 0.55); flame(this.m.position, 0.4); }
      if (s >= 1) { this.mode = 'idle'; const cb = this.onArrive; this.onArrive = null; cb && cb(this); }
    } else if (this.mode === 'free') {
      this.v.y -= G * dt; this.m.position.addScaledVector(this.v, dt); this.m.rotation.x += this.v.z * dt * 3; this.m.rotation.z -= this.v.x * dt * 3;
      if (this.m.position.y < BALL_R) { this.m.position.y = BALL_R; if (this.v.y < -1.2) snd.bounce(-this.v.y); this.v.y = -this.v.y * 0.62; this.v.x *= 0.85; this.v.z *= 0.85; }
      if (this.fire && this.life > 2) flame(this.m.position, 0.35);
      this.life -= dt; if (this.life <= 0) this.kill();
    }
  }
}

// ---------------------------------------------------------------- ballers (agents, rookies and you)
const COLORS = ['#ff4d5e', '#3a86ff', '#ffcf3a', '#2ee59d', '#b26bff', '#ff8c42', '#22d3ee', '#ff5fb4', '#a3e635', '#f7f7f7'];
const SKINS = ['#f1c7a5', '#d9a27a', '#a86b48', '#7a4a2e', '#ffd7ba', '#c98b62'];
const tagsG = new THREE.Group(); scene.add(tagsG);
const ballers = new Map(); let colorI = 0, joinI = 0;
let DT = 0;
const portrait = () => innerWidth / innerHeight < 0.8;

function numberTex(n, gold) { return canvasTex(128, 128, (g) => { g.font = '84px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = gold ? '#7a5200' : 'rgba(0,0,0,.55)'; g.strokeText(n, 64, 70); g.fillStyle = gold ? '#ffd65a' : '#ffffff'; g.fillText(n, 64, 70); }); }
function tagSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.renderOrder = 20; sp.userData = { c, tex, key: '' }; tagsG.add(sp); return sp;
}
function drawTag(sp, text, color, mark, fill = false, pill = '') {
  const key = text + color + mark + fill + pill; if (sp.userData.key === key) return; sp.userData.key = key;
  const { c, tex } = sp.userData, g = c.getContext('2d'); g.clearRect(0, 0, 512, 112);
  g.font = '800 26px Rubik, sans-serif'; const pw = pill ? g.measureText(pill).width + 20 : 0;
  g.font = '800 46px Rubik, sans-serif'; const label = (mark ? mark + ' ' : '') + text; const w = Math.min(500, g.measureText(label).width + 50 + (pill ? pw + 10 : 0));
  const c0 = new THREE.Color(color), light = c0.r * 0.3 + c0.g * 0.59 + c0.b * 0.11 > 0.62, ink = fill && light ? '#141830' : '#fff';
  g.fillStyle = fill ? color : 'rgba(12,12,26,.86)'; g.beginPath(); g.roundRect(256 - w / 2, 18, w, 76, 38); g.fill();
  g.lineWidth = 6; g.strokeStyle = fill ? '#ffffff' : color; g.stroke();
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 256 - (pill ? (pw + 10) / 2 : 0), 58, 470 - pw);
  if (pill) { const x = 256 + w / 2 - 22 - pw; g.fillStyle = ink === '#fff' ? 'rgba(255,255,255,.25)' : 'rgba(20,24,48,.16)'; g.beginPath(); g.roundRect(x, 40, pw, 36, 12); g.fill(); g.fillStyle = ink; g.font = '800 26px Rubik, sans-serif'; g.fillText(pill, x + pw / 2, 59); }
  tex.needsUpdate = true;
}

class Baller {
  constructor({ id, parent = null, label, src = 'claude', color, scale = 1.3, you = false }) {
    Object.assign(this, { id, parent, label, src, color, scale, you });
    this.root = new THREE.Group(); this.root.scale.setScalar(scale); scene.add(this.root);
    this.man = stickman(color, SKINS[hash(id) % SKINS.length], 1); this.root.add(this.man);
    this.num = you ? 1 : 2 + hash(id + 'n') % 97;
    this.backNum = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: numberTex(this.num, false), transparent: true }));
    this.backNum.position.set(0, 1.02, -0.232); this.backNum.rotation.y = Math.PI; this.man.add(this.backNum);
    this.frontNum = this.backNum.clone(); this.frontNum.position.z = 0.232; this.frontNum.rotation.y = 0; this.frontNum.scale.setScalar(0.7); this.man.add(this.frontNum);
    this.acc = new THREE.Group(); this.man.add(this.acc);
    this.pos = this.root.position; this.home = V(); this.rot = 0; this.rotT = 0;
    this.queue = []; this.co = null; this.ball = null; this.pose = 'idle'; this.jy = 0; this.sq = 1; this.t = Math.random() * 10;
    this.streak = 0; this.streakQ = 0; this.fire = false; this.wave = false; this.made = 0; this.att = 0; this.last = performance.now(); this.join = joinI++;
    this.tag = tagSprite(); this.leaving = false; this.dead = false;
    this.dress();
  }
  dress() {
    const J = save.up.jersey; this.acc.clear();
    if (J >= 1) { const hb = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 20), mat(J >= 3 ? '#ffd65a' : '#ffffff')); hb.rotation.x = Math.PI / 2; hb.position.y = 1.58; this.acc.add(hb); }
    if (J >= 2) for (const leg of [this.man.legL, this.man.legR]) { if (leg.userData.shoe) leg.remove(leg.userData.shoe); const s = new THREE.Mesh(rounded(0.17, 0.11, 0.3, 0.04), mat('#39ff88', { emissive: '#0c7a3a' })); s.position.set(0, -0.56, 0.06); leg.add(s); leg.userData.shoe = s; }
    if (J >= 3) for (const arm of [this.man.armL, this.man.armR]) { if (arm.userData.band) continue; const b = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.03, 6, 14), mat('#ffd65a')); b.rotation.x = Math.PI / 2; b.position.y = -0.38; arm.add(b); arm.userData.band = b; }
    const gold = J >= 3; this.backNum.material.map = numberTex(this.num, gold); this.backNum.material.needsUpdate = true;
  }
  hand(kind) {
    const s = this.scale, a = this.rot, fx = Math.sin(a), fz = Math.cos(a), base = this.pos;
    if (kind === 'up') return V(base.x + fx * 0.12 * s, base.y + 2.02 * s, base.z + fz * 0.12 * s);
    if (kind === 'side') return V(base.x + fx * 0.32 * s + fz * 0.36 * s, 0, base.z + fz * 0.32 * s - fx * 0.36 * s);
    return V(base.x + fx * 0.42 * s, base.y + 1.08 * s, base.z + fz * 0.42 * s);
  }
  face(a) { this.rotT = a; }
  faceHoop() { this.face(Math.atan2(HOOP.x - this.pos.x, HOOP.z - this.pos.z)); }
  takeBall() { if (this.ball) return; this.ball = new Ball(this); this.pose = 'dribble'; }
  update(dt) {
    this.t += dt;
    if (this.co) { if (this.co.next().done) this.co = null; }
    if (!this.co) {
      if (this.queue.length) this.co = shotScript(this, this.queue.shift());
      else if (this.leaving) this.co = leaveScript(this);
      else if (this.pos.distanceTo(this.home) > 0.3 && !this.you) this.co = runHome(this);
      else { this.faceHoop(); this.pose = this.wave ? 'wave' : this.offline ? 'sad' : this.ball ? 'dribble' : 'idle'; }
    }
    // turn, pose, squash, jump
    let d = this.rotT - this.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); this.rot += d * Math.min(1, dt * 12); this.root.rotation.y = this.rot;
    this.pos.y = this.jy; this.sq = lerp(this.sq, this.squashT || 1, Math.min(1, dt * 14)); this.squashT = 1;
    this.man.scale.set(1 / Math.sqrt(this.sq), this.sq, 1 / Math.sqrt(this.sq));
    applyPose(this);
    if (this.fire) { const fs = this.you ? 0.28 : 0.5; if (Math.random() < 0.7) flame(V(this.pos.x, this.pos.y + 1.75 * this.scale, this.pos.z), fs, 0.3); if (Math.random() < 0.35) flame(V(this.pos.x, this.pos.y + 0.1, this.pos.z), fs, 0.5); }
    // name tag
    const tagH = (portrait() ? 1.3 : 1) * (this.you ? 0.75 : 1) * (1 - 0.45 * camS.focus);
    this.tag.position.set(this.pos.x, this.pos.y + (this.you ? 1.85 : 2.15) * this.scale + 0.2, this.pos.z); this.tag.scale.set(1.95 * tagH * (this.parent ? 0.8 : 1), 0.43 * tagH * (this.parent ? 0.8 : 1), 1);
    if (this.rival) drawTag(this.tag, `${this.flag} ${this.label}${this.sub ? ' +' + this.sub : ''}`, this.color, this.offline ? '😴' : this.wave ? '✋' : this.fire ? '🔥' : '', true, this.pill);
    else drawTag(this.tag, this.you ? 'YOU' : this.label, this.color, this.wave ? '✋' : this.fire ? '🔥' : this.parent ? '·' : '');
  }
  remove() { this.dead = true; scene.remove(this.root); tagsG.remove(this.tag); if (this.ball) { this.ball.kill(); this.ball = null; } }
}
function applyPose(b) {
  const m = b.man, t = b.t;
  for (const l of [m.armL, m.armR, m.legL, m.legR]) l.rotation.set(0, 0, 0);
  m.body.position.y = 0.95; m.head.rotation.set(0, 0, 0);
  switch (b.pose) {
    case 'idle': m.armL.rotation.z = -0.12 - Math.sin(t * 2) * 0.03; m.armR.rotation.z = 0.12 + Math.sin(t * 2) * 0.03; m.body.position.y = 0.95 + Math.sin(t * 2.5) * 0.012; break;
    case 'run': m.run(t, 1); break;
    case 'dribble': { const ph = Math.sin(t * 7.5); m.armR.rotation.x = -0.75 + Math.abs(ph) * 0.35; m.armR.rotation.z = 0.35; m.armL.rotation.x = -0.4; m.armL.rotation.z = -0.25; m.legL.rotation.x = -0.25; m.legR.rotation.x = 0.15; b.squashT = 0.94; break; }
    case 'rundribble': m.run(t, 1); m.armR.rotation.x = -0.6 + Math.abs(Math.sin(t * 7.5)) * 0.3; m.armR.rotation.z = 0.4; break;
    case 'hold': m.armL.rotation.x = -1.25; m.armR.rotation.x = -1.25; m.armL.rotation.z = 0.25; m.armR.rotation.z = -0.25; break;
    case 'up': case 'slam': m.armL.rotation.x = -2.9; m.armR.rotation.x = -2.95; m.armL.rotation.z = 0.12; m.armR.rotation.z = -0.12; m.legL.rotation.x = 0.25; m.legR.rotation.x = -0.1; break;
    case 'follow': m.armR.rotation.x = -2.5 + Math.sin(t * 3) * 0.05; m.armL.rotation.x = -2.2; break;
    case 'wave': m.armR.rotation.z = 2.55 + Math.sin(t * 11) * 0.4; m.armL.rotation.z = -0.15; m.body.position.y = 0.95 + Math.abs(Math.sin(t * 5.5)) * 0.03; break;
    case 'celebrate': m.armL.rotation.z = -2.5 - Math.sin(t * 14) * 0.25; m.armR.rotation.z = 2.5 + Math.sin(t * 14) * 0.25; m.body.position.y = 0.95 + Math.abs(Math.sin(t * 9)) * 0.05; break;
    case 'sad': m.armL.rotation.z = -0.05; m.armR.rotation.z = 0.05; m.head.rotation.x = 0.4; b.squashT = 0.95; break;
    case 'pass': m.armL.rotation.x = -1.6; m.armR.rotation.x = -1.6; break;
  }
}

// ---------------------------------------------------------------- scripts (generators stepped once per frame with DT)
function* wait(s) { for (let t = 0; t < s; t += DT) yield; }
function* runTo(b, p, speed = 6.5, pose = 'run') {
  while (true) {
    const dx = p.x - b.pos.x, dz = p.z - b.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.06) break;
    const st = Math.min(d, speed * DT); b.pos.x += dx / d * st; b.pos.z += dz / d * st; b.face(Math.atan2(dx, dz)); b.pose = b.ball ? (pose === 'run' ? 'rundribble' : pose) : pose; yield;
  }
}
function* runHome(b) { yield* runTo(b, b.home, 4.5); b.faceHoop(); }
function* leaveScript(b) { b.wave = false; const out = V(b.pos.x < 0 ? -12 : 12, 0, b.pos.z + 2); yield* runTo(b, out, 5); b.remove(); }
function* crouch(b, s, pose = 'hold') { b.pose = pose; for (let t = 0; t < s; t += DT) { b.squashT = 0.8; yield; } }
function* jump(b, h, dur, atApex, hang = 0) {
  let t = 0, fired = false;
  while (t < dur + hang) {
    t += DT; let s = t < dur / 2 ? t / dur : t < dur / 2 + hang ? 0.5 : (t - hang) / dur; s = Math.min(1, s);
    b.jy = 4 * h * s * (1 - s); if (!fired && t >= dur / 2) { fired = true; atApex && atApex(); } yield;
  }
  b.jy = 0; b.squashT = 0.78;
}
const FIRE_N = 6;
const SHOT = { edit: ['three', 3, '3-POINTER'], read: ['layup', 2, 'LAYUP'], commit: ['dunk', 3, 'SLAM DUNK'], deploy: ['dunk', 3, 'SLAM DUNK'], test: ['oop', 5, 'ALLEY-OOP'], run: ['jumper', 2, 'JUMPER'], web: ['jumper', 2, 'JUMPER'], delegate: ['jumper', 2, 'ASSIST'], other: ['jumper', 2, 'JUMPER'] };
const shotOf = cat => SHOT[cat] || SHOT.other;

function release(b, ok, it, { T, H, soft = false } = {}) {
  const ball = b.ball || new Ball(b); b.ball = null; ball.m.position.copy(b.hand('up'));
  ball.fire = !!it.fire || b.fire; ball.owner = b;
  const dist = Math.hypot(HOOP.x - ball.m.position.x, HOOP.z - ball.m.position.z);
  T = T || 0.75 + dist * 0.06; H = H || (soft ? 0.45 : 1.1 + dist * 0.13);
  shotClock = 24;
  if (ok) ball.fly(V(HOOP.x, HOOP.y + 0.05, HOOP.z), T, H, bl => swish(bl, b, it));
  else {
    const dir = V(ball.m.position.x - HOOP.x, 0, ball.m.position.z - HOOP.z).normalize(), lat = V(-dir.z, 0, dir.x);
    const long = it.long ?? Math.random() < 0.4;
    const p = HOOP.clone().addScaledVector(dir, long ? -RIM_R * 0.95 : RIM_R * 0.95).addScaledVector(lat, (Math.random() - 0.5) * 0.3); p.y += 0.04;
    ball.fly(p, T, H, bl => brick(bl, b, it, dir, lat));
  }
  return ball;
}
function swish(ball, b, it) {
  ball.free(V((Math.random() - 0.5) * 0.4, -2.6, 0.5), 2.6); ball.m.position.set(HOOP.x, HOOP.y - 0.05, HOOP.z);
  net.kick = it.dunk ? 1.4 : 1; snd.swish(); cheer = Math.max(cheer, it.big ? 1 : 0.6);
  burst(scene, HOOP.clone().add(V(0, -0.3, 0)), [b.color, '#ffffff', '#ffcf3a'], it.big ? 26 : 12, { speed: 0.07, up: 0.06, size: 0.45, gravity: 0.004 });
  if (ball.fire) for (let i = 0; i < 14; i++) flame(HOOP, 0.9, 0.5);
  rimGlow.material.opacity = 1;
  scored(b, it);
}
function brick(ball, b, it, dir, lat) {
  const long = it.long;
  ball.free(V(dir.x * (long ? 1.2 : 2.6) + lat.x * (Math.random() - 0.5) * 2.5, 2.6 + Math.random() * 1.5, dir.z * (long ? 1.2 : 2.6) + lat.z * (Math.random() - 0.5) * 2.5), 2.6);
  snd.brick(); rimShake = 0.12; net.kick = Math.max(net.kick, 0.3);
  burst(scene, ball.m.position.clone(), ['#9aa3c9', '#ffffff'], 6, { speed: 0.05, up: 0.04, size: 0.35 });
  pop(HOOP.clone().add(V(0, 0.5, 0)), it.missText || 'BRICK!', '#9aa3c9', 26);
  missed(b, it);
}
// the shot itself
function* shotScript(b, it) {
  const [type0] = shotOf(it.cat); let type = type0;
  if (!it.ok && type === 'oop') type = 'three';
  if (!b.ball) b.takeBall();
  b.wave = false;
  if (type === 'three' || type === 'jumper') {
    if (type === 'jumper') { const p = b.pos.clone().lerp(V(HOOP.x, 0, HOOP.z), 0.32); yield* runTo(b, p, 5); }
    b.faceHoop(); yield* crouch(b, 0.24);
    b.pose = 'up';
    yield* jump(b, 0.5, 0.62, () => release(b, it.ok, it));
    b.pose = 'follow'; yield* wait(0.35);
  } else if (type === 'layup') {
    const side = b.pos.x >= 0 ? 1 : -1, j = (hash(b.id) % 7) / 10, p = V(side * (0.7 + j), 0, HOOP.z + 1.0 + j * 0.6);
    yield* runTo(b, p, 7.5); b.faceHoop(); b.pose = 'up';
    yield* jump(b, 0.85, 0.66, () => release(b, it.ok, { ...it, missText: 'RIMMED OUT', long: false }, { T: 0.42, soft: true }));
    yield* wait(0.25);
  } else if (type === 'dunk') {
    const p = V(HOOP.x + (b.pos.x > 0 ? 1 : -1) * (0.15 + (hash(b.id) % 5) / 10), 0, HOOP.z + 0.95);
    yield* runTo(b, p, 8); b.faceHoop(); yield* crouch(b, 0.16, 'hold');
    b.pose = 'slam';
    yield* jump(b, 1.15, 0.8, () => {
      if (it.ok) { const bl = b.ball; b.ball = null; bl.mode = 'idle'; bl.m.position.set(HOOP.x, HOOP.y + 0.12, HOOP.z); bl.fire = b.fire; dunkFx(b); swish(bl, b, { ...it, dunk: true, big: true }); bl.v.y = -6.5; }
      else { const bl = b.ball; b.ball = null; bl.m.position.set(HOOP.x, HOOP.y + 0.1, HOOP.z + 0.2); bl.free(V((Math.random() - 0.5) * 3, 4.5, 3.2), 2.6); snd.brick(); rimShake = 0.2; shake(0.15); pop(HOOP.clone().add(V(0, 0.6, 0)), 'STUFFED BY THE RIM', '#9aa3c9', 24); missed(b, it); }
    }, it.ok ? 0.28 : 0);
    b.pose = it.ok ? 'celebrate' : 'sad'; yield* wait(0.6);
  } else if (type === 'oop') {
    // a teammate lobs, the agent skies, the camera slows down
    const passer = findPasser(b);
    const side = b.pos.x >= 0 ? 1 : -1, p = V(side * 0.3, 0, HOOP.z + 1.0);
    if (b.ball) { b.ball.kill(); b.ball = null; }
    const lob = new Ball(passer); lob.fire = b.fire; const from = passer ? passer.hand('up') : V(-side * 7.4, 1.4, -3);
    lob.m.position.copy(from); if (passer) { passer.pose = 'pass'; passer.face(Math.atan2(p.x - passer.pos.x, p.z - passer.pos.z)); }
    const T = 1.05, catchAt = V(p.x * 0.6, HOOP.y + 0.85, HOOP.z + 0.55);
    lob.fly(catchAt, T, 1.6, null); lob.holder = null;
    pop(from.clone().add(V(0, 0.6, 0)), passer ? 'LOB!' : 'COACH LOB!', '#ffffff', 20);
    let t = 0, jumped = false, caught = false;
    const run = runTo(b, p, 7);
    if (performance.now() - lastOop > 6000) { lastOop = performance.now(); focus(1, 2.0); setTimeout(() => slowmo(1.25), 380); }
    while (!caught) {
      t += DT;
      if (!jumped) { const r = run.next(); if (t >= T - 0.42) { jumped = true; b.faceHoop(); b.pose = 'up'; } }
      if (jumped) { const s = clamp((t - (T - 0.42)) / 0.84, 0, 0.5); b.jy = 4 * 1.25 * s * (1 - s); b.pose = 'up'; }
      if (t >= T) { caught = true; }
      yield;
    }
    lob.mode = 'held'; lob.holder = b; b.ball = lob; b.pose = 'slam';
    yield* wait(0.14);
    const bl = b.ball; b.ball = null; bl.mode = 'idle'; bl.m.position.set(HOOP.x, HOOP.y + 0.12, HOOP.z);
    dunkFx(b); swish(bl, b, { ...it, dunk: true, big: true }); bl.v.y = -6.5;
    yield* wait(0.18);
    for (let s = 0.5; s < 1; s += DT / 0.5) { b.jy = 4 * 1.25 * s * (1 - s); yield; }
    b.jy = 0; b.squashT = 0.75; b.pose = 'celebrate'; if (passer) passer.pose = 'celebrate'; yield* wait(0.7);
  }
}
let lastOop = 0;
function findPasser(b) {
  for (const o of ballers.values()) if (o.parent === b.id && !o.co && !o.ball && !o.dead) return o;
  for (const o of ballers.values()) if (o !== b && !o.you && !!o.rival === !!b.rival && !o.co && !o.ball && !o.queue.length && !o.dead && !o.leaving) return o;
  return null;
}
function dunkFx(b) {
  snd.dunk(); shake(0.35); punch(1); flash(0.35); rimBend = 0.38;
  burst(scene, HOOP.clone(), ['#ffffff', '#ffcf3a', b.color], 30, { speed: 0.12, up: 0.08, size: 0.5 });
}

// ---------------------------------------------------------------- scoring
let rimShake = 0, rimBend = 0;
function scored(b, it) {
  if (b.you) return youScored(it);
  if (b.rival) return rivalScored(b, it);
  b.streak = it.streak ?? b.streak + 1; if (!it.fromRookie) { b.made++; b.att++; }
  const wasFire = b.fire; b.fire = b.streak >= FIRE_N;
  const [type, , name] = shotOf(it.cat);
  const pts = it.pts ?? 0;
  if (b.fire && !wasFire) { banner('ON FIRE!', '#ff7a1f', `${b.label} · ${b.streak} in a row`); snd.fire(); }
  else if (type === 'dunk' || (type === 'oop' && it.ok)) banner(type === 'oop' ? 'ALLEY-OOP!' : 'SLAM!', type === 'oop' ? '#3df2ff' : '#ffcf3a', b.label);
  pop(HOOP.clone().add(V(0, 0.55, 0)), `+${pts} ${type === 'three' ? 'SWISH 3' : name}`, b.fire ? '#ff9a3a' : '#ffffff', type === 'three' ? 30 : 26);
  if (round) { round.score += pts; round.team += pts; }
  const du = duel(); if (du && !A.demo) { du.us += pts; persist(); }
  hudDirty = true;
}
function missed(b, it) {
  if (b.you) return youMissed(it);
  if (b.rival) return rivalMissed(b, it);
  b.streak = 0; b.att++; if (b.fire) { b.fire = false; pop(b.pos.clone().add(V(0, 3, 0)), 'fire out', '#9aa3c9', 18); }
  hudDirty = true;
}

// counted stats (once per event, ever) — real agents to save, demo to memory
const streaks = new Map();
function tally(e, demo) {
  const d = demo ? demoDay : day(e.t), se = demo ? demoSeason : season();
  const [type, pts0] = shotOf(e.cat);
  const s = se[e.label] || (se[e.label] = { att: 0, made: 0, best: 0, threes: 0, dunks: 0, oops: 0 });
  s.att++; d.tAtt++;
  if (!e.ok) { streaks.set(e.agent, 0); return { pts: 0, streak: 0 }; }
  const n = (streaks.get(e.agent) || 0) + 1; streaks.set(e.agent, n);
  s.made++; d.tMade++; s.best = Math.max(s.best, n); d.streak = Math.max(d.streak, n);
  if (type === 'three') { s.threes++; d.threes++; } if (type === 'dunk') { s.dunks++; d.dunks++; } if (type === 'oop') { s.oops++; d.oops++; }
  const pts = pts0 * (n >= FIRE_N ? 2 : 1); d.team += pts;
  if (!demo) save.wallet += Math.round(pts * hype() * 0.5);
  return { pts, streak: n };
}

// ---------------------------------------------------------------- agents → ballers
function slots() { const s = [-20, 20, -46, 46, -70, 70, -33, 33, -58, 58]; return portrait() ? s.map(a => a * 0.62) : s; }
function relayout() {
  const leads = [...ballers.values()].filter(b => !b.you && !b.parent && !b.leaving && !b.rival).sort((a, b) => a.join - b.join);
  const sl = RIV ? (portrait() ? [16, 36, 56, 26, 46, 66, 8] : [16, 40, 64, 28, 52, 76, 8]) : slots(), R = portrait() ? 5.0 : 6.1;
  // in a live duel your crew takes the right of the arc and the rival's agents the left
  const rv = [...ballers.values()].filter(b => b.rival && !b.leaving).sort((a, b) => a.join - b.join);
  rv.forEach((b, i) => { const a = -[18, 42, 66, 30, 54][i % 5] * (portrait() ? 0.85 : 1) * Math.PI / 180, r = (portrait() ? 4.6 : 5.6) + (i >= 3 ? 1.1 : 0); b.home.set(Math.sin(a) * r, 0, HOOP.z + Math.cos(a) * r); });
  leads.forEach((b, i) => { const a = (sl[i % sl.length] + (i >= sl.length ? 6 : 0)) * Math.PI / 180, r = R + (i >= sl.length ? 1 : 0); b.home.set(Math.sin(a) * r, 0, HOOP.z + Math.cos(a) * r); });
  for (const L of leads) {
    const kids = [...ballers.values()].filter(b => b.parent === L.id && !b.leaving);
    const out = V(L.home.x - HOOP.x, 0, L.home.z - HOOP.z).normalize(), side = V(-out.z, 0, out.x);
    kids.forEach((k, i) => k.home.copy(L.home).addScaledVector(out, 1.3).addScaledVector(side, (i - (kids.length - 1) / 2) * 1.0));
  }
  for (const b of ballers.values()) if (b.parent && !ballers.has(b.parent) && !b.leaving) b.home.set((hash(b.id) % 9) - 4, 0, 1.2);
  if (typeof you !== 'undefined') { you.home.set(0, 0, portrait() ? 1.3 : 2.7); if (!you.co) you.pos.set(you.home.x, you.pos.y, you.home.z); }
}
function ensure(e) {
  let b = ballers.get(e.agent);
  if (b && !b.dead) return b;
  if (e.kind === 'end') return null;
  const leads = [...ballers.values()].filter(x => !x.you && !x.parent && !x.leaving && !x.rival).length;
  if (!e.parent && leads >= 10) return null;
  const lead = e.parent && ballers.get(e.parent);
  let color = lead ? '#' + new THREE.Color(lead.color).lerp(new THREE.Color('#ffffff'), 0.35).getHexString() : COLORS[colorI++ % COLORS.length];
  for (let n = 0; !lead && n < COLORS.length && nearRival(color); n++) color = COLORS[colorI++ % COLORS.length];
  b = new Baller({ id: e.agent, parent: e.parent, label: e.label || 'agent', src: e.src, color, scale: e.parent ? 1.0 : 1.3 });
  const enter = V(lead ? lead.pos.x : (Math.random() < 0.5 ? -11 : 11), 0, lead ? lead.pos.z + 1 : -2 + Math.random() * 4); b.pos.copy(enter);
  ballers.set(e.agent, b); relayout();
  pop(enter.clone().add(V(0, 3, 0)), e.parent ? 'rookie checks in' : `${b.label} checks in`, b.color, 18);
  return b;
}
let lastPing = 0;
function handleLive(e, r) {
  const b = ensure(e); if (!b) return;
  b.last = performance.now();
  if (e.kind === 'tool') { b.wave = false; if (!b.ball && !b.co) b.takeBall(); }
  else if (e.kind === 'result') {
    const pts = r ? r.pts : shotOf(e.cat)[1];
    b.streakQ = e.ok ? b.streakQ + 1 : 0;
    const it = { cat: e.cat, ok: e.ok, pts, streak: r ? r.streak : b.streakQ, fire: b.streakQ >= FIRE_N };
    if (b.parent && ballers.has(b.parent)) { if (b.queue.length < 3) b.queue.push({ ...it, rookie: true }); }
    else if (b.queue.length < 4) b.queue.push(it);
    else { b.att++; if (e.ok) b.made++; }
  }
  else if (e.kind === 'done' && !b.parent) {
    b.wave = true;
    if (performance.now() - lastPing > 7000) { lastPing = performance.now(); snd.ping(); toast(`✋ ${b.label} finished and is waving for you, coach`, 3500); }
  }
  else if (e.kind === 'prompt') b.wave = false;
  else if (e.kind === 'end') { b.leaving = true; relayout(); }
}
// rookies feed their lead instead of shooting themselves
const _shotScript = shotScript;
function* rookieScript(b, it) {
  const L = ballers.get(b.parent);
  if (!L || L.dead) { yield* _shotScript(b, it); return; }
  if (!b.ball) b.takeBall();
  b.att++; if (it.ok) b.made++; hudDirty = true;
  yield* wait(0.15); b.face(Math.atan2(L.pos.x - b.pos.x, L.pos.z - b.pos.z)); b.pose = 'pass';
  const bl = b.ball; b.ball = null; bl.m.position.copy(b.hand('chest'));
  if (it.ok) {
    bl.fly(L.hand('chest'), 0.45, 0.35, () => {
      pop(L.pos.clone().add(V(0, 3.2, 0)), `+${it.pts} ASSIST`, '#ffffff', 18);
      if (!L.ball && !L.co && !L.queue.length) { bl.mode = 'held'; bl.holder = L; L.ball = bl; L.queue.push({ cat: 'run', ok: true, pts: it.pts, streak: L.streak, fromRookie: true }); }
      else bl.kill();
    });
  } else {
    const side = V(b.pos.x < 0 ? -1 : 1, 0, 0.6).normalize();
    bl.free(V(side.x * 5, 2.5, side.z * 5), 2); pop(b.pos.clone().add(V(0, 2.6, 0)), 'TURNOVER', '#9aa3c9', 18);
  }
  yield* wait(0.5);
}

// ---------------------------------------------------------------- the rival's team, live (a duel on the world board)
// In a live duel the rival's agents walk on court as the away crew on the left of the arc, one baller per agent (max 5),
// named by callsign, in the rival's colour (a simulated rival plays as silver robots). Their finished steps are their shots
// at the same hoop: edits = threes, commits / deploys = dunks, passed tests = alley-oops, failures = bricks.
// Duel points (your crew vs theirs, since the duel started) sit on the scoreboard. No duel: nothing changes.
let RIV = null, rivKey = '';
const esc = s => String(s).replace(/[<>&"]/g, '');
const RSILVER = '#dfe4ec';
const rcol = () => (RIV ? (RIV.sim ? RSILVER : RIV.color) : RSILVER);
const duel = () => (RIV && save.duel && save.duel.key === RIV.key ? save.duel : null);
const RVERB = { test: 'passes tests', commit: 'commits', deploy: 'deploys', edit: 'edits', run: 'runs a step', read: 'reads the code', web: 'searches the web', delegate: 'sends a helper', other: 'finishes a step' };
const RFAIL = { test: 'fails tests', commit: 'fails to commit', deploy: 'botches a deploy' };
function nearRival(c) { if (!RIV || RIV.sim) return false; const a = new THREE.Color(c), b = new THREE.Color(RIV.color); return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.45; }
let callT = 0;
function call(text, color = '#fff', ms = 3600) {
  const el = $('call'); el.textContent = text; el.style.setProperty('--c', color); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(callT); callT = setTimeout(() => el.classList.remove('on'), ms);
}
function robotize(b) {
  const h = b.man.head; h.geometry = rounded(0.42, 0.36, 0.38, 0.1); h.material = glossy('#dde3ee');
  const vis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.04), new THREE.MeshStandardMaterial({ color: '#60f0ff', emissive: '#60f0ff', emissiveIntensity: 0.9 })); vis.position.set(0, 0.03, 0.2); h.add(vis);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5), mat('#99a3b8')); ant.position.y = 0.27; h.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#ff4d6d', emissive: '#ff4d6d', emissiveIntensity: 0.8 })); tip.position.y = 0.38; h.add(tip);
  b.man.body.material = b.man.armL.children[0].material = b.man.armR.children[0].material = glossy(RSILVER, { metalness: 0.15, emissive: '#3a3f48' });
}
function syncRival() {
  const r = B ? B.rival() : null, was = RIV; RIV = r || null;
  const key = r ? `${r.key}|${r.sim ? 'sim' : r.color}` : '';
  if (key !== rivKey) {
    rivKey = key;
    for (const b of ballers.values()) if (b.rival) b.leaving = true;
    if (r) {
      if (!save.duel || save.duel.key !== r.key) { save.duel = { key: r.key, us: 0, them: 0 }; persist(); }
      call(`⚔️ Live duel: ${r.flag} ${r.name}'s agents are on court${r.sim ? ' (simulated)' : ''}`, rcol(), 5000);
      toast(`⚔️ ${r.flag} ${r.name}'s agents are the away crew${r.sim ? ' (simulated)' : ''}`, 3500);
    } else if (was) call('The duel is over. The court is yours again.', '#ffffff');
    relayout(); hudDirty = true;
  }
  if (!r) return;
  const ags = (r.agents || []).slice(0, 5), off = !r.sim && r.online === false, col = rcol(), ids = new Set();
  for (const ag of ags) {
    const id = `rv:${r.key}:${ag.k}`; ids.add(id);
    let b = ballers.get(id);
    if (!b || b.dead) {
      b = new Baller({ id, label: ag.name, src: ag.src, color: col, scale: 1.25 }); b.rival = true; b.k = ag.k;
      if (r.sim) robotize(b);
      b.pos.set(-11.5, 0, -3 + Math.random() * 4); ballers.set(id, b); relayout(); hudDirty = true;
      pop(V(-6, 3, -2), `${ag.name} checks in for ${r.name}`, col, 18);
    }
    b.label = ag.name; b.flag = r.flag; b.pill = ag.src === 'codex' ? 'CX' : 'CC'; b.sub = ag.sub || 0;
    if (!b.co) b.wave = ag.state === 'waiting' && !off; b.offline = off; b.last = performance.now();
  }
  for (const b of ballers.values()) if (b.rival && !b.leaving && !ids.has(b.id)) { b.leaving = true; relayout(); hudDirty = true; }
}
function onRivalEvents(events, r) {
  RIV = r; syncRival();
  const team = [...ballers.values()].filter(x => x.rival && !x.leaving && !x.dead);
  for (const e of events) {
    const b = team.find(x => x.k === e.agent.k) || team.find(x => x.label === e.agent.name) || team[(Math.random() * team.length) | 0];
    if (!b) continue;
    b.wave = false;
    const it = { cat: e.cat, ok: e.ok, pts: shotOf(e.cat)[1], who: `${r.name}'s ${e.agent.name}` };
    if (b.queue.length < 3) b.queue.push(it); else { b.att++; if (e.ok) b.made++; }
  }
}
function rivalScored(b, it) {
  b.streak++; b.made++; b.att++;
  const wasFire = b.fire; b.fire = b.streak >= FIRE_N;
  const [type, , name] = shotOf(it.cat), col = rcol(), pts = it.pts * (b.fire ? 2 : 1);
  const du = duel(); if (du) { du.them += pts; persist(); }
  pop(HOOP.clone().add(V(0, 0.55, 0)), `+${pts} ${it.cat === 'edit' ? 'SWISH 3' : name}`, col, type === 'three' ? 28 : 24);
  const big = type === 'dunk' || type === 'oop';
  if (b.fire && !wasFire) { banner('THEY\'RE ON FIRE', col, `${it.who} · ${b.streak} in a row`); call(`🔥 ${it.who} is on fire: ${b.streak} in a row`, col); }
  else if (big) { banner(type === 'oop' ? 'ALLEY-OOP' : 'SLAM!', col, it.who); call(`${it.who} ${RVERB[it.cat]}, and ${type === 'oop' ? 'throws it down off the lob!' : 'dunks it!'} +${pts}`, col); }
  else call(`${it.who} ${RVERB[it.cat] || RVERB.other}: ${name.toLowerCase()} +${pts}`, col, 2600);
  hudDirty = true;
}
function rivalMissed(b, it) {
  b.streak = 0; b.att++; if (b.fire) { b.fire = false; pop(b.pos.clone().add(V(0, 3, 0)), 'fire out', '#9aa3c9', 18); }
  call(`${it.who} ${RFAIL[it.cat] || 'hits an error'}: ${shotOf(it.cat)[0] === 'dunk' ? 'stuffed by the rim!' : 'brick!'}`, '#ff8a8a', 2800);
  hudDirty = true;
}

// ---------------------------------------------------------------- you: the shooter + timing meter
const you = new Baller({ id: 'you', label: 'YOU', color: '#f4f1ea', scale: 1.3, you: true });
relayout();
let charging = false, chargeT = 0, cooldown = 0, myStreak = 0, myFire = false, shotsTaken = save.shots || 0;
const zone = () => { const w = Math.max(0.075, 0.17 - Math.min(myStreak, 8) * 0.011); return { c: 0.78, w }; };
function meterVal() { const p = (chargeT / 0.82) % 2; return p < 1 ? p : 2 - p; }
function youReady() { return !you.co && cooldown <= 0; }
function startCharge() { if (!youReady() || !$('coach').hidden || !$('stats').hidden || !$('result').hidden) return; charging = true; chargeT = 0; tone(330, 0.05, 'sine', 0.03, 1.4); }
function endCharge() {
  if (!charging) return; charging = false;
  const v = meterVal(), z = zone(), off = v - z.c, ok = Math.abs(off) <= z.w / 2, perfect = Math.abs(off) <= 0.022;
  const verdict = perfect ? 'PERFECT' : ok ? 'GREEN' : off < 0 ? 'EARLY' : 'LATE';
  $('hint').textContent = verdict === 'PERFECT' ? 'PERFECT RELEASE!' : verdict === 'GREEN' ? 'GREEN!' : verdict === 'EARLY' ? 'TOO EARLY: SHORT' : 'TOO LATE: LONG';
  $('hint').className = ok ? 'go' : '';
  you.co = youShot(ok, perfect, off > 0);
}
function* youShot(ok, perfect, long) {
  you.faceHoop(); you.pose = 'up';
  const it = { you: true, ok, perfect, long, pts: 0 };
  yield* jump(you, 0.55, 0.6, () => { you.ball = you.ball || new Ball(you); release(you, ok, it, { H: 2.6 }); });
  you.pose = 'follow'; yield* wait(0.4);
  cooldown = round ? 0.25 : 0.55;
}
function youScored(it) {
  myStreak++; shotsTaken++; save.shots = shotsTaken;
  const d = day(); d.myAtt++; d.myMade++; d.myStreak = Math.max(d.myStreak, myStreak); save.myBest = Math.max(save.myBest, myStreak);
  const wasFire = myFire; myFire = myStreak >= 3; you.fire = myFire;
  let pts = it.perfect ? 3 : 2; if (myFire) pts *= 2;
  const money = round && round.shots % 5 === 4; if (money) pts *= 2;
  if (round) { round.score += pts; round.shots++; round.mine += pts; }
  d.my += pts; save.wallet += Math.round(pts * hype());
  pop(HOOP.clone().add(V(0, 0.55, 0)), `+${pts} ${it.perfect ? 'PERFECT' : 'SWISH'}${money ? ' · MONEY BALL' : ''}`, it.perfect ? '#6dffa0' : '#ffffff', it.perfect ? 32 : 28);
  if (myFire && !wasFire) { banner('YOU\'RE ON FIRE!', '#ff7a1f', 'points ×2 until you miss'); snd.fire(); }
  else if (it.perfect) { punch(0.4); }
  persist(); submitScore(); hudDirty = true;
}
function youMissed(it) {
  shotsTaken++; save.shots = shotsTaken; if (round) round.shots++;
  const d = day(); d.myAtt++; if (myFire) pop(you.pos.clone().add(V(0, 3, 0)), 'fire out', '#9aa3c9', 18);
  myStreak = 0; myFire = false; you.fire = false; persist(); hudDirty = true;
}
renderer.domElement.addEventListener('pointerdown', e => { e.preventDefault(); startCharge(); });
addEventListener('pointerup', endCharge); addEventListener('pointercancel', endCharge);
addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startCharge(); } });
addEventListener('keyup', e => { if (e.code === 'Space') endCharge(); });

// ---------------------------------------------------------------- camera: base framing, shake, punch, focus, slow-mo
const camS = { shake: 0, punch: 0, focus: 0, focusTo: 0, focusUntil: 0, flash: 0 };
let ts = 1, slowUntil = 0;
const shake = a => camS.shake = Math.max(camS.shake, a);
const punch = a => camS.punch = Math.max(camS.punch, a);
const focus = (a, s) => { camS.focusTo = Math.max(camS.focusTo, a); camS.focusUntil = Math.max(camS.focusUntil, performance.now() + s * 1000); };
const slowmo = s => { slowUntil = performance.now() + s * 1000; };
const flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:12;transition:opacity .25s';
document.body.appendChild(flashEl);
function flash(a) { flashEl.style.transition = 'none'; flashEl.style.opacity = a; requestAnimationFrame(() => { flashEl.style.transition = 'opacity .35s'; flashEl.style.opacity = 0; }); }
const camPos = V(), camLook = V();
function updateCamera(rdt, t) {
  const P = portrait();
  const basePos = P ? V(0, 10.8, 13.2) : V(0, 6.4, 11.6), baseLook = P ? V(0, 1.2, -3.3) : V(0, 2.2, -3.4);
  const fPos = P ? V(1.2, 5.2, 1.8) : V(2.2, 4.4, 0.8), fLook = V(0, 3.0, -6);
  if (performance.now() > camS.focusUntil) camS.focusTo = 0;
  camS.focus = lerp(camS.focus, camS.focusTo, Math.min(1, rdt * (camS.focusTo > camS.focus ? 3.5 : 2)));
  const f = camS.focus * camS.focus * (3 - 2 * camS.focus);
  camPos.lerpVectors(basePos, fPos, f * 0.8); camLook.lerpVectors(baseLook, fLook, f * 0.8);
  camPos.x += Math.sin(t * 0.25) * 0.35; // slow drift so it feels alive
  const s = camS.shake; camS.shake = Math.max(0, s - rdt * 1.4);
  camera.position.set(camPos.x + (Math.random() - 0.5) * s, camPos.y + (Math.random() - 0.5) * s, camPos.z + (Math.random() - 0.5) * s);
  camera.lookAt(camLook);
  camS.punch = Math.max(0, camS.punch - rdt * 2.5);
  const fov = (P ? 50 : 42) - camS.punch * 5;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- shootout rounds (2 minutes, high score per day)
let round = null, shotClock = 24, clockAcc = 0;
function startShootout() {
  if (round) return; closePanels();
  let n = 3; banner('3', '#ffffff'); snd.tick();
  const iv = setInterval(() => {
    n--; bannerT = 0;
    if (n > 0) { banner(String(n), '#ffffff'); snd.tick(); }
    else { clearInterval(iv); banner('SHOOTOUT!', '#ff7a2f', '2 minutes · every 5th ball is a money ball'); snd.buzzer(); round = { end: performance.now() + 120000, score: 0, shots: 0, mine: 0, team: 0 }; $('round').hidden = false; cooldown = 0; }
  }, 750);
}
function endShootout() {
  const r = round; round = null; $('round').hidden = true; snd.buzzer();
  const d = day(), newDay = r.score > d.hi, newAll = r.score > save.best;
  d.hi = Math.max(d.hi, r.score); save.best = Math.max(save.best, r.score);
  const bonus = 10 + (newDay && r.score > 0 ? 25 : 0); save.wallet += bonus; persist(); submitScore();
  $('resT').textContent = newAll ? 'ALL-TIME BEST!' : newDay ? 'NEW DAILY HIGH!' : 'SHOOTOUT OVER';
  $('resS').textContent = r.score;
  const p = B.profile(), rank = myRank();
  $('resB').innerHTML = `<p>You ${r.mine} · your agents ${r.team}</p><p>Today's best <b>${d.hi}</b> · All-time <b>${save.best}</b></p><p>+${bonus} ◆ coach points</p>${p ? `<p style="font-size:18px">${flag(p.country)} ${p.name}${rank ? ` · #${rank} today` : ''}</p>` : '<p style="color:#b8b3cc;font-size:13px">Open 🏆 to put your flag on the world board</p>'}`;
  $('result').hidden = false;
  if (newDay) { confetti(scene, HOOP.clone().add(V(0, 1, 2)), 90); snd.cheer(); cheer = 1; }
}

// ---------------------------------------------------------------- panels: coach (upgrades), stats, share
function closePanels() { for (const id of ['coach', 'stats', 'result']) $(id).hidden = true; }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closePanels);
function renderCoach() {
  $('coachSub').textContent = `You have ${save.wallet} ◆. Every upgrade level adds +5% to all points (now ×${hype().toFixed(2)}). Points come from your makes and your real agents' buckets.`;
  $('coachList').innerHTML = Object.entries(UPG).map(([k, u]) => {
    const lv = save.up[k], next = lv < 3 ? COST[lv + 1] : 0;
    return `<div class="up"><div><b>${u.name}</b><p>${u.lv[lv]}${lv < 3 ? ` → <span style="color:#ffe27a">${u.lv[lv + 1]}</span>` : ' · maxed'}</p><div class="pips">${[1, 2, 3].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</div></div>
      <button data-buy="${k}" ${lv >= 3 || save.wallet < next ? 'disabled' : ''}>${lv >= 3 ? 'MAX' : `Upgrade · ${next} ◆`}</button></div>`;
  }).join('');
  $('coachList').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(b.dataset.buy));
}
function buy(k) {
  const lv = save.up[k]; if (lv >= 3 || save.wallet < COST[lv + 1]) return;
  save.wallet -= COST[lv + 1]; save.up[k]++; persist(); applyUpgrades(k);
  confetti(scene, V(0, 2, -2), 70); snd.cheer(); cheer = 1; shake(0.1);
  toast(`${UPG[k].name}: ${UPG[k].lv[save.up[k]]}`, 2500); renderCoach(); hudDirty = true;
}
function applyUpgrades(which) {
  if (!which || which === 'lights') buildLights();
  if (!which || which === 'hoop') applyHoop();
  if (!which || which === 'crowd') buildCrowd();
  if (!which || which === 'jersey') { for (const b of ballers.values()) b.dress(); you.dress(); }
}
const pct = (m, a) => a ? Math.round(m / a * 100) + '%' : '–';
function renderStats() {
  const demo = A.demo, d = demo ? demoDay : day(), se = demo ? demoSeason : season(), me = day();
  const rows = Object.entries(se).sort((a, b) => b[1].made - a[1].made).slice(0, 14);
  const colorOf = l => { for (const b of ballers.values()) if (b.label === l && !b.parent) return b.color; return '#888'; };
  $('statsBody').innerHTML = `<p class="sub">${demo ? 'Demo team (connect your agents to keep real season stats)' : 'Your agents, today'}</p>
    <div class="kpis"><div><b>${d.team}</b><small>TEAM PTS</small></div><div><b>${pct(d.tMade, d.tAtt)}</b><small>FG ${d.tMade}/${d.tAtt}</small></div><div><b>${d.streak}</b><small>LONGEST STREAK</small></div>
    <div><b>${me.myMade}/${me.myAtt}</b><small>YOUR MAKES</small></div><div><b>${me.hi}</b><small>SHOOTOUT TODAY</small></div><div><b>${save.best}</b><small>ALL-TIME BEST</small></div></div>
    <p class="sub"><b>Season ${save.seasonKey}</b> per project${demo ? ' (demo)' : ''}</p>
    ${rows.length ? `<table><tr><th>Baller</th><th>FG%</th><th>Made</th><th>Streak</th><th>3s</th><th>Dunks</th><th>Oops</th></tr>${rows.map(([l, s]) => `<tr><td><i style="background:${colorOf(l)}"></i>${l.replace(/</g, '&lt;')}</td><td>${pct(s.made, s.att)}</td><td>${s.made}/${s.att}</td><td>${s.best}</td><td>${s.threes}</td><td>${s.dunks}</td><td>${s.oops}</td></tr>`).join('')}</table>` : '<p class="sub">No shots yet this season.</p>'}`;
}
$('bCoach').onclick = () => { const o = $('coach').hidden; closePanels(); if (o) { renderCoach(); $('coach').hidden = false; } };
$('bStats').onclick = () => { const o = $('stats').hidden; closePanels(); if (o) { renderStats(); $('stats').hidden = false; } };
$('bShoot').onclick = () => startShootout();
$('bAgain').onclick = () => startShootout();
$('bConnect').onclick = () => A.open();
$('bBoard').onclick = () => B.open();
for (const id of ['bShare', 'bShare2', 'bShare3']) $(id).onclick = share;

function myRank() { try { return JSON.parse(localStorage.getItem('board_rank_agent-hoops')); } catch (e) { return null; } }
async function share() {
  renderer.render(scene, camera);
  const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#141838'); gr.addColorStop(1, '#0b0d1e'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // the court snapshot on the right
  const src = renderer.domElement, sw = src.width, sh = src.height, ar = 560 / 630; let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
  g.save(); g.beginPath(); g.roundRect(620, 20, 560, 590, 24); g.clip(); g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 620, 20, 560, 590); g.restore();
  g.strokeStyle = '#ff7a2f'; g.lineWidth = 4; g.beginPath(); g.roundRect(620, 20, 560, 590, 24); g.stroke();
  const demo = A.demo, d = demo ? demoDay : day(), me = day(), se = demo ? demoSeason : season();
  const top = Object.entries(se).sort((a, b) => b[1].made - a[1].made)[0];
  g.fillStyle = '#ff7a2f'; g.font = '46px Bungee, Impact, sans-serif'; g.fillText('CHAIN NET CREW', 40, 82);
  g.fillStyle = '#f7f1e6'; g.font = '700 28px Rubik, sans-serif'; g.fillText(demo ? 'A demo team today' : 'My AI agents today', 40, 126);
  const box = (x, y, big, small, col = '#ffe27a') => { g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(x, y, 260, 118, 18); g.fill(); g.fillStyle = col; g.font = '50px Bungee, Impact, sans-serif'; g.fillText(big, x + 20, y + 66); g.fillStyle = '#b8b3cc'; g.font = '700 18px Rubik, sans-serif'; g.fillText(small, x + 20, y + 98); };
  box(40, 156, String(d.team), 'TEAM POINTS'); box(320, 156, pct(d.tMade, d.tAtt), `FG ${d.tMade}/${d.tAtt}`, '#4ade80');
  box(40, 290, String(d.streak), 'LONGEST STREAK', '#ff9a3a'); box(320, 290, String(me.hi), 'MY SHOOTOUT BEST', '#3df2ff');
  g.fillStyle = '#f7f1e6'; g.font = '700 22px Rubik, sans-serif';
  if (top) g.fillText(`MVP: ${top[0]} · ${top[1].made}/${top[1].att} · ${top[1].dunks} dunks · ${top[1].threes} threes`, 40, 456, 560);
  const p = B.profile(), rank = myRank();
  if (p && !demo) { g.font = '700 30px Rubik, sans-serif'; g.fillText(`${flag(p.country)} ${p.name}${rank ? `  #${rank} in the world today` : ''}`, 40, 506, 560); }
  g.fillStyle = '#8e88a0'; g.font = '700 20px Rubik, sans-serif'; g.fillText('agentpark.co · connect your AI, play basketball', 40, 584);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'chain-net-crew.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents today', text: 'My AI agents on Chain Net Crew', url: location.href.split('?')[0] }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chain-net-crew.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------------------------------------------------------- connection
let hudDirty = true, B = null;
window.tally = { events: 0, results: 0, counted: 0 };
function submitScore() { if (B && !A.demo) B.submit(todayScore()); }
function onEvents(list, info = {}) {
  B && B.onAgentEvents(list);
  const demo = !!info.demo; let bf = { res: 0, made: 0, pts: 0 };
  for (const e of list) {
    window.tally.events++;
    if (e.kind === 'tokens' && e.counted) (demo ? demoDay : day()).tokens += e.tokens || 0;
    let r = null;
    if (e.kind === 'result') { window.tally.results++; if (e.counted) { window.tally.counted++; r = tally(e, demo); } }
    if (info.backfill) { if (r) { bf.res++; if (e.ok) { bf.made++; bf.pts += r.pts; } } if (e.live && e.kind !== 'end' && e.kind !== 'done') ensure(e); continue; }
    if (!e.live) continue;
    handleLive(e, r);
  }
  if (info.backfill && bf.res) toast(`Today so far: your agents hit ${bf.made} of ${bf.res} shots, +${bf.pts} team points`, 5000);
  if (!demo) { persist(); submitScore(); }
  window.tally.team = day().team; window.tally.wallet = save.wallet; window.tally.tAtt = day().tAtt;
  hudDirty = true;
}
const A = agents({
  game: 'agent-hoops', title: 'CHAIN NET CREW', tagline: 'Street basketball for your AI agents.', accent: '#ff7a2f', demoAgents: 4,
  about: 'Every coding agent you run walks on court as a baller with its project on the jersey. Each tool call is a shot: edits drain threes, reads are layups, commits and deploys are dunks, passing tests are alley-oops, failures clang off the rim. You shoot between their shots, coach the court and chase today\'s high score.',
  onEvents,
  onConnect() { for (const b of [...ballers.values()]) if (b.id.startsWith('d:')) { b.remove(); ballers.delete(b.id); } relayout(); hudDirty = true; },
});
B = board({ game: 'agent-hoops', label: 'Points', A });
window.__A = A; window.__B = B;
B.onRival(onRivalEvents); setInterval(syncRival, 1200);

// ---------------------------------------------------------------- HUD
function renderHud() {
  const demo = A.demo, d = demo ? demoDay : day(), me = day();
  $('wallet').textContent = `◆ ${save.wallet}` + (hype() > 1 ? `  ×${hype().toFixed(2)}` : '');
  const p = B.profile(), rk = myRank(); $('rankTag').textContent = p && !demo ? `${flag(p.country)}${rk ? ' #' + rk : ''}` : '';
  $('sTeam').textContent = d.team; $('sYou').textContent = `${me.myMade}/${me.myAtt}`;
  const list = [...ballers.values()].filter(b => !b.you && !b.dead && !b.leaving && !b.rival).sort((a, b) => (a.parent ? ballers.get(a.parent)?.join ?? a.join : a.join) - (b.parent ? ballers.get(b.parent)?.join ?? b.join : b.join) || (a.parent ? 1 : 0) - (b.parent ? 1 : 0));
  const du = duel(), rv = [...ballers.values()].filter(b => b.rival && !b.dead && !b.leaving), rc = rcol(), off = RIV && !RIV.sim && RIV.online === false;
  $('roster').innerHTML = (RIV ? `<div class="rhd" style="--c:#ff7a2f">YOUR CREW</div>` : '') + list.slice(0, RIV ? 7 : 12).map(b => `<div class="chip ${b.parent ? 'rk' : ''} ${b.wave ? 'wait' : ''} ${b.fire ? 'fire' : ''}" style="--c:${b.color}"><b>${b.wave ? '✋ ' : b.fire ? '🔥 ' : ''}${b.parent ? 'rookie' : b.label.replace(/</g, '&lt;')}</b><span>${b.made}/${b.att}</span></div>`).join('')
    + (RIV ? `<div class="rhd" style="--c:${rc}">${RIV.flag} ${esc(RIV.name)}'s agents${RIV.sim ? ' · simulated' : off ? ' · 😴 offline' : !rv.length ? ' · waiting…' : ''}</div>` + rv.map(b => `<div class="chip rv ${b.wave ? 'wait' : ''} ${b.offline ? 'off' : ''}" style="--c:${rc}"><b>${b.offline ? '😴 ' : b.wave ? '✋ ' : b.fire ? '🔥 ' : ''}${esc(b.label)}<small>${b.pill}</small></b><span>${b.made}/${b.att}</span></div>`).join('') : '');
  $('teamLbl').textContent = du ? 'CREW' : 'TEAM'; if (du) $('sTeam').textContent = du.us;
  $('rivBox').hidden = !du; if (du) { $('rivName').textContent = `${RIV.flag} ${RIV.name}`; $('sRiv').textContent = du.them; $('sRiv').style.color = rc; }
  $('idle').hidden = demo || !A.connected.length || list.some(b => !b.parent);
}

// ---------------------------------------------------------------- main loop
applyUpgrades();
addEventListener('resize', relayout);
let hudT = 0;
loop((dt60, t) => {
  const rdt = dt60 / 60, now = performance.now();
  ts = lerp(ts, now < slowUntil ? 0.28 : 1, Math.min(1, rdt * 8)); DT = rdt * ts;
  for (const b of [...ballers.values()]) { if (b.queue.length && !b.co && b.parent && b.queue[0].rookie) { b.co = rookieScript(b, b.queue.shift()); } b.update(DT); if (b.dead) ballers.delete(b.id); }
  you.update(DT);
  if (!you.co && cooldown > 0) cooldown -= rdt;
  if (youReady() && !you.ball) you.ball = new Ball(you);
  if (youReady()) { you.pose = charging ? 'hold' : 'hold'; if (charging) { chargeT += rdt; you.squashT = 0.86; } }
  for (const bl of [...balls]) bl.update(DT, t);
  // agents that went quiet leave the court (real agents only)
  if (!A.demo) for (const b of ballers.values()) if (!b.leaving && !b.rival && !b.co && now - b.last > 12 * 60e3) { b.leaving = true; relayout(); }
  // hoop + net
  net.kick = Math.max(0, net.kick - DT * 2.2); net.sway = 1;
  rimBend = Math.max(0, rimBend - DT * 1.6); rimShake = Math.max(0, rimShake - DT * 0.8);
  rimPivot.rotation.x = rimBend * Math.abs(Math.cos(t * 30 * (rimBend > 0.05 ? 1 : 0))) + Math.sin(t * 60) * rimShake;
  updateNet(t);
  rimGlow.material.opacity = Math.max(save.up.hoop >= 3 ? 0.45 + Math.sin(t * 4) * 0.15 : 0, rimGlow.material.opacity - rdt * 1.5);
  updateFlames(DT);
  // crowd
  cheer = Math.max(0, cheer - rdt * 0.5);
  for (const c of crowd) { const j = Math.max(0, Math.sin(t * 9 + c.ph)) * cheer * 0.35; c.s.position.y = c.y + j; const up = cheer > 0.3 ? 2.6 + Math.sin(t * 12 + c.ph) * 0.3 : 0.2; c.s.armL.rotation.z = lerp(c.s.armL.rotation.z, -up, 0.2); c.s.armR.rotation.z = lerp(c.s.armR.rotation.z, up, 0.2); if (c.flash) c.flash.material.opacity = cheer > 0.3 && Math.random() < 0.08 ? 1 : c.flash.material.opacity * 0.85; }
  for (const [i, sp] of sweep.entries()) sp.target.position.set(Math.sin(t * 0.7 + i * 2) * 6, 0, -3 + Math.cos(t * 0.9 + i) * 4);
  // clocks
  shotClock -= rdt; if (shotClock <= 0) { shotClock = 24; if (round) snd.buzzer(); }
  if (round) { const left = Math.max(0, round.end - now); $('rTime').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; $('rScore').textContent = round.score; if (left <= 0) endShootout(); }
  // meter
  const z = zone(), mv = charging ? meterVal() : 0;
  $('green').style.left = (z.c - z.w / 2) * 100 + '%'; $('green').style.width = z.w * 100 + '%'; $('perfect').style.left = `calc(${z.c * 100}% - 2px)`;
  $('needle').style.left = mv * 100 + '%'; $('meter').className = youReady() ? '' : 'off';
  if (youReady() && !charging && performance.now() % 4000 < 30) { $('hint').textContent = shotsTaken < 6 ? 'HOLD, RELEASE IN THE GREEN' : myFire ? '🔥 YOU\'RE ON FIRE' : 'HOLD TO SHOOT'; $('hint').className = ''; }
  updateCamera(rdt, t);
  hudT -= rdt;
  if (hudT <= 0 || hudDirty) {
    hudT = 0.3; hudDirty = false; renderHud();
    const d = A.demo ? demoDay : day(), me = day();
    $('sClock').textContent = Math.ceil(shotClock);
    const du = duel();
    if (du && !round) drawScoreboard(String(du.us), String(Math.ceil(shotClock)).padStart(2, '0'), String(du.them), `LIVE DUEL · YOU ${me.myMade}`, { lt: 'CREW', rt: `${RIV.flag} ${RIV.name}`.toUpperCase(), rc: rcol() });
    else drawScoreboard(String(round ? round.score : d.team), String(Math.ceil(shotClock)).padStart(2, '0'), `${me.myMade}`, round ? 'SHOOTOUT ROUND' : `FG ${pct(d.tMade, d.tAtt)} · ${[...ballers.values()].filter(b => !b.you && !b.parent && !b.dead && !b.rival).length} ON COURT`);
  }
});

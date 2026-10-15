// Pin Pals: the 3D bowling alley. Lanes with planar reflections, pins, balls, bowlers, score screens,
// disco lights and lane themes. Everything is drawn in code (canvas textures + three.js geometry).
import { THREE, mat, glossy, rounded, stickman } from './kit/hc.js';
import { L, HALF, GUT, BR, PIT, WALL, SPOTS } from './bowl.js';

export const PITCH = 1.9;
export const SLOT_X = [0, PITCH, -PITCH, PITCH * 2, -PITCH * 2, PITCH * 3, -PITCH * 3];
export const STANCE = 1.75;
const FONT = "'Bungee', 'Baloo 2', system-ui, sans-serif";

// ------------------------------------------------------------------ themes
export const THEMES = {
  classic: { name: 'Classic Maple', bg: '#241a33', fog: '#241a33', wood: ['#e9c48f', '#dcb27a', '#f0cf9f'], approach: '#c99e6e', capping: '#2d8f86', carpet: ['#2b1d44', '#ff5d8f', '#ffd23f', '#3ab7ff'], mask: ['#2a1f55', '#ff5d8f', '#ffd23f'], hemi: 1.05, sun: 1.25, spot: 26, neon: 0.35, dots: 0.22, pinGlow: '#000000', wall: '#33224d', refl: 0.42 },
  cosmic: { name: 'Cosmic Night', bg: '#07031a', fog: '#07031a', wood: ['#5b4a8a', '#4f4080', '#665498'], approach: '#4a3c78', capping: '#1a0f3a', carpet: ['#0c0626', '#ff3df2', '#3dfff2', '#fff23d'], mask: ['#0c0626', '#ff3df2', '#3dfff2'], hemi: 0.45, sun: 0.55, spot: 70, neon: 2.6, dots: 0.75, pinGlow: '#2a1d66', wall: '#0e0828', refl: 0.6 },
  candy: { name: 'Candy Lanes', bg: '#ffd6e7', fog: '#ffd6e7', wood: ['#ffe2c6', '#ffd6b8', '#ffeedd'], approach: '#fff1e2', capping: '#8ee3c8', carpet: ['#ffb3d1', '#ffffff', '#8ee3c8', '#ffe066'], mask: ['#ff8fbf', '#ffffff', '#8ee3c8'], hemi: 1.25, sun: 1.3, spot: 14, neon: 0.5, dots: 0.18, pinGlow: '#000000', wall: '#ffc2dc', refl: 0.35 },
  retro: { name: 'Sunset 70s', bg: '#3a1a10', fog: '#3a1a10', wood: ['#d99a5b', '#c98a4b', '#e6a96a'], approach: '#b9844e', capping: '#e8572c', carpet: ['#4a2512', '#ff8c2b', '#ffd23f', '#21a99c'], mask: ['#4a2512', '#ff8c2b', '#21a99c'], hemi: 1.0, sun: 1.2, spot: 22, neon: 0.6, dots: 0.25, pinGlow: '#000000', wall: '#552a16', refl: 0.42 },
};

function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texOf(c, rep) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function woodTex(th) {
  const [c, x] = cvs(256, 1024);
  for (let i = 0; i < 39; i++) {
    x.fillStyle = th.wood[i % 3]; x.fillRect(i * 256 / 39, 0, 256 / 39 + 1, 1024);
    x.globalAlpha = 0.12; x.strokeStyle = '#7a4a1e';
    for (let k = 0; k < 6; k++) { x.beginPath(); const gx = i * 256 / 39 + Math.random() * 6; x.moveTo(gx, Math.random() * 1024); x.lineTo(gx + (Math.random() - 0.5) * 2, Math.random() * 1024); x.stroke(); }
    x.globalAlpha = 1;
  }
  x.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i <= 39; i++) x.fillRect(i * 256 / 39, 0, 1, 1024);
  return texOf(c, [1, 3]);
}
function carpetTex(th) {
  const [c, x] = cvs(512, 512), [b, a, y, z] = th.carpet;
  x.fillStyle = b; x.fillRect(0, 0, 512, 512);
  const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  for (let i = 0; i < 70; i++) {
    const px = R() * 512, py = R() * 512, col = [a, y, z][i % 3], k = i % 4; x.strokeStyle = x.fillStyle = col; x.lineWidth = 6; x.globalAlpha = 0.85;
    if (k === 0) { x.beginPath(); x.arc(px, py, 10 + R() * 14, 0, 7); x.stroke(); }
    else if (k === 1) { x.beginPath(); x.moveTo(px, py); for (let j = 1; j < 6; j++) x.lineTo(px + j * 12, py + (j % 2 ? -12 : 12)); x.stroke(); }
    else if (k === 2) { x.beginPath(); x.moveTo(px, py - 14); x.lineTo(px + 14, py + 12); x.lineTo(px - 14, py + 12); x.closePath(); x.fill(); }
    else { x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); }
  }
  x.globalAlpha = 1;
  return texOf(c, [6, 6]);
}
function pinTex() {
  const [c, x] = cvs(8, 256);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 8, 256);
  x.fillStyle = '#e8213e'; x.fillRect(0, 256 * (1 - 0.66), 8, 10); x.fillRect(0, 256 * (1 - 0.6), 8, 10);
  return texOf(c);
}
const PIN_PROFILE = [[0.0, 0], [0.027, 0], [0.041, 0.02], [0.056, 0.07], [0.0605, 0.115], [0.056, 0.16], [0.041, 0.21], [0.027, 0.25], [0.023, 0.27], [0.028, 0.30], [0.032, 0.33], [0.030, 0.355], [0.02, 0.374], [0.0, 0.381]];

export const BALLS = {
  house: { name: 'House Blue', base: '#2f6cff', swirl: '#9fd6ff' },
  cherry: { name: 'Cherry Swirl', base: '#e8213e', swirl: '#ffb3c2' },
  mint: { name: 'Mint Marble', base: '#12b88f', swirl: '#d9fff1' },
  ember: { name: 'Ember', base: '#ff5a1f', swirl: '#ffd23f' },
  aqua: { name: 'Deep Aqua', base: '#007ea7', swirl: '#bff5ff' },
  galaxy: { name: 'Galaxy', base: '#25104f', swirl: '#c08cff', stars: true, glow: '#3a1a8a' },
  confetti: { name: 'Confetti Pop', base: '#ffffff', swirl: '#ffe8f3', specks: true },
  gold: { name: 'Solid Gold', base: '#e8b21a', swirl: '#fff0a8', metal: 0.75 },
};
const ballTexCache = {};
export function ballMaterial(kind, custom) {
  const k = custom ? 'c' + custom : kind; if (ballTexCache[k]) return ballTexCache[k];
  const def = custom ? { base: custom, swirl: '#ffffff' } : BALLS[kind] || BALLS.house;
  const [c, x] = cvs(256, 128); x.fillStyle = def.base; x.fillRect(0, 0, 256, 128);
  const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(k.length * 977 + 3);
  x.globalAlpha = 0.55; x.strokeStyle = def.swirl; x.lineCap = 'round';
  for (let i = 0; i < 9; i++) { x.lineWidth = 3 + R() * 9; x.beginPath(); let px = R() * 256, py = R() * 128; x.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (R() - 0.5) * 120; py += (R() - 0.5) * 60; x.quadraticCurveTo(px + 30, py - 20, px, py); } x.stroke(); }
  x.globalAlpha = 1;
  if (def.stars) for (let i = 0; i < 70; i++) { x.fillStyle = R() < 0.5 ? '#ffffff' : '#ffd6ff'; x.fillRect(R() * 256, R() * 128, 1.5 + R() * 2, 1.5 + R() * 2); }
  if (def.specks) for (let i = 0; i < 120; i++) { x.fillStyle = ['#ff5d8f', '#ffd23f', '#3ab7ff', '#7bd94b', '#b26bff'][i % 5]; x.beginPath(); x.arc(R() * 256, R() * 128, 2 + R() * 3, 0, 7); x.fill(); }
  // finger holes
  x.fillStyle = '#111'; for (const [hx, hy] of [[60, 52], [76, 52], [68, 76]]) { x.beginPath(); x.arc(hx, hy, 5.5, 0, 7); x.fill(); }
  const m = new THREE.MeshStandardMaterial({ map: texOf(c), roughness: 0.12, metalness: def.metal || 0.05, emissive: def.glow || '#000000', emissiveIntensity: def.glow ? 0.6 : 0 });
  return (ballTexCache[k] = m);
}
export function ballSwatch(kind) { const b = BALLS[kind]; return `radial-gradient(circle at 35% 30%, ${b.swirl} 0 12%, ${b.base} 45%, #0006 100%)`; }

// ------------------------------------------------------------------ name tag + score screen canvases
export function makeTag(text, color) {
  const [c, x] = cvs(320, 112), tex = texOf(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(0.95, 0.333, 1); spr.renderOrder = 10;
  spr.draw = (dots = []) => {
    x.clearRect(0, 0, 320, 112);
    x.font = `30px ${FONT}`; const w = Math.min(300, x.measureText(text).width + 40);
    x.fillStyle = 'rgba(15,10,30,.82)'; x.beginPath(); x.roundRect(160 - w / 2, 6, w, 54, 27); x.fill();
    x.fillStyle = color; x.beginPath(); x.roundRect(160 - w / 2 + 4, 10, w - 8, 46, 23); x.fill();
    x.fillStyle = '#1a1030'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 160, 35, 280);
    if (dots.length) {
      const n = dots.length, s = 18, x0 = 160 - (n * s) / 2 + s / 2;
      x.fillStyle = 'rgba(15,10,30,.75)'; x.beginPath(); x.roundRect(x0 - 14, 70, n * s + 10, 26, 13); x.fill();
      dots.forEach((dd, i) => { x.fillStyle = dd === 1 ? '#7dff8a' : dd === -1 ? '#ff5d6d' : 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(x0 + i * s - 2, 83, 6, 0, 7); x.fill(); });
    }
    tex.needsUpdate = true;
  };
  spr.draw();
  return spr;
}

export function makeScreen() {
  const [c, x] = cvs(640, 264), tex = texOf(c);
  const g = new THREE.Group();
  const bez = new THREE.Mesh(rounded(1.72, 0.78, 0.07, 0.04), glossy('#141020'));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.66), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scr.position.z = 0.04; g.add(bez, scr);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4), mat('#222')); pole.position.y = 1.05; g.add(pole);
  g.draw = ({ label, color, rolls, fr, totalNow, lane, big, sub, idle }) => {
    x.fillStyle = '#0d0a1c'; x.fillRect(0, 0, 640, 264);
    const gr = x.createLinearGradient(0, 0, 640, 0); gr.addColorStop(0, color); gr.addColorStop(1, '#0d0a1c');
    x.fillStyle = gr; x.fillRect(0, 0, 640, 64);
    x.font = `34px ${FONT}`; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#ffffff'; x.fillText(label, 18, 34, 430);
    x.font = `20px ${FONT}`; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText('LANE ' + lane, 626, 34);
    if (idle) {
      x.textAlign = 'center'; x.fillStyle = '#ffd23f'; x.font = `36px ${FONT}`; x.fillText(idle, 320, 142, 600);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `20px ${FONT}`; x.fillText(sub || '', 320, 204, 600);
    } else {
      const cw = 49.5, y0 = 84;
      for (let i = 0; i < 10; i++) {
        const f = fr[i], fx = 14 + i * cw, w = i === 9 ? cw + 18 : cw;
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.strokeRect(fx, y0, w - 3, 92);
        x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `13px ${FONT}`; x.textAlign = 'center'; x.fillText(i + 1, fx + (w - 3) / 2, y0 - 9);
        x.font = `21px ${FONT}`;
        f.marks.forEach((m, k) => { const n = f.marks.length > 2 || i === 9 ? 3 : 2, bw = (w - 3) / n, bx = fx + bw * (k + (n === 2 && f.marks.length === 2 ? 0 : 0)); x.fillStyle = m === 'X' ? '#ffd23f' : m === '/' ? '#7dff8a' : '#fff'; x.fillText(m, bx + bw / 2, y0 + 20); });
        if (f.cum != null) { x.fillStyle = '#fff'; x.font = `22px ${FONT}`; x.fillText(f.cum, fx + (w - 3) / 2, y0 + 64); }
      }
      x.textAlign = 'left'; x.font = `56px ${FONT}`; x.fillStyle = '#ffd23f'; x.fillText(totalNow, 18, 222);
      if (big) { x.textAlign = 'right'; x.font = `44px ${FONT}`; x.fillStyle = big.color || '#fff'; x.fillText(big.text, 624, 222, 420); }
      else if (sub) { x.textAlign = 'right'; x.font = `20px ${FONT}`; x.fillStyle = 'rgba(255,255,255,.65)'; x.fillText(sub, 624, 226, 420); }
    }
    tex.needsUpdate = true;
  };
  return g;
}

// ------------------------------------------------------------------ bowler
const SKINS = ['#ffd7ba', '#f1c19a', '#c98e62', '#8d5a3b', '#ffe1c9', '#a8704a'];
const HAIR = ['#2b1a12', '#5a3214', '#e8c15a', '#1a1a1a', '#b5462a', '#6b6b7a'];
export function makeBowler(color, seed = 0, scale = 0.92) {
  const g = stickman(color, SKINS[seed % SKINS.length], scale);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(HAIR[(seed >> 2) % HAIR.length], { roughness: 0.8 }));
  hair.position.y = 1.52; hair.rotation.x = 0.25; g.add(hair);
  // collar stripe on the shirt (bowling shirt look)
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.228, 0.228, 0.08, 16), mat('#ffffff'));
  stripe.position.y = 1.08; g.add(stripe);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ------------------------------------------------------------------ turkey (the commit bonus mascot)
export function makeTurkey() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), mat('#8a4b22')); body.scale.set(1, 0.9, 1.1); body.position.y = 0.28; g.add(body);
  const cols = ['#e8572c', '#ffd23f', '#8a4b22', '#ff8c2b', '#e8213e'];
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(cols[i % 5])); const a = -1.2 + i * 0.4; f.scale.set(0.8, 2.4, 0.4); f.position.set(Math.sin(a) * 0.24, 0.42 + Math.cos(a) * 0.24, 0.16); f.rotation.z = -a; g.add(f); }
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), mat('#a0602f')); neck.position.set(0, 0.5, -0.17); g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat('#a0602f')); head.position.set(0, 0.62, -0.2); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 8), mat('#ffb020')); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.61, -0.29); g.add(beak);
  const wat = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat('#e8213e')); wat.scale.y = 2; wat.position.set(0.02, 0.56, -0.27); g.add(wat);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), mat('#111')); e.position.set(s * 0.04, 0.65, -0.26); g.add(e); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12), mat('#ffb020')); leg.position.set(s * 0.07, 0.06, 0); g.add(leg); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ------------------------------------------------------------------ the alley
export function createWorld(stage) {
  const { scene, renderer, sun, hemi } = stage;
  const W = { lanes: [], theme: null, themeKey: '' };
  scene.fog = new THREE.Fog('#241a33', 22, 46);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; sun.shadow.camera.far = 60;
  sun.position.set(3, 14, 4); sun.target.position.set(0, 0, -6); sun.shadow.camera.updateProjectionMatrix();

  // ---- shared materials (re-tinted by themes)
  const M = {
    lane: new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.0 }),
    approach: new THREE.MeshStandardMaterial({ roughness: 0.3 }),
    gutter: new THREE.MeshStandardMaterial({ color: '#2c2a36', roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide }),
    capping: new THREE.MeshStandardMaterial({ roughness: 0.3 }),
    carpet: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    wall: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    pin: new THREE.MeshStandardMaterial({ map: pinTex(), roughness: 0.22, emissive: '#000000' }),
    arrow: new THREE.MeshStandardMaterial({ color: '#7a3b14', emissive: '#000', roughness: 0.4 }),
    pit: new THREE.MeshBasicMaterial({ color: '#05030a' }),
    kick: new THREE.MeshStandardMaterial({ color: '#191426', roughness: 0.5 }),
    rail: glossy('#c9c4d6', { metalness: 0.6 }),
  };
  W.M = M;

  // ---- room
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), M.carpet); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.04, 10); floor.receiveShadow = true; scene.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), M.wall); back.position.set(0, 6, PIT - 1.2); scene.add(back);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), M.wall); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.2, -6); scene.add(ceil);

  // ---- reflection
  const rt = new THREE.WebGLRenderTarget(512, 512, { samples: 0 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const mirrorCam = new THREE.PerspectiveCamera();
  const texMatrix = new THREE.Matrix4();
  const reflMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tRefl: { value: rt.texture }, texMatrix: { value: texMatrix }, uOp: { value: 0.45 } },
    vertexShader: `uniform mat4 texMatrix; varying vec4 vR; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vR = texMatrix * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tRefl; uniform float uOp; varying vec4 vR; varying vec3 vW;
      void main(){ vec3 c = texture2DProj(tRefl, vR).rgb; vec3 v = normalize(cameraPosition - vW); float f = 0.35 + 0.65 * pow(1.0 - abs(v.y), 2.0);
        gl_FragColor = vec4(c, uOp * f);
        #include <colorspace_fragment>
      }`,
  });
  const reflMeshes = [];
  const clipUp = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.001)];

  // ---- lanes
  const LEN = L + 1.0;   // foul line to end of the pin deck
  SLOT_X.forEach((X, i) => {
    const g = new THREE.Group(); g.position.x = X; scene.add(g);
    const lane = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.06, LEN), M.lane); lane.position.set(0, -0.03, -LEN / 2); lane.receiveShadow = true; g.add(lane);
    const appr = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + GUT * 4 + 0.3, 0.06, 4.2), M.approach); appr.position.set(0, -0.03, 2.1); appr.receiveShadow = true; g.add(appr);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, LEN + 4.2), reflMat); refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.002, -LEN / 2 + 2.1); g.add(refl); reflMeshes.push(refl);
    // foul line + arrows + dots
    const foul = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + GUT * 4, 0.03), new THREE.MeshBasicMaterial({ color: '#1a1020' })); foul.rotation.x = -Math.PI / 2; foul.position.set(0, 0.004, 0); g.add(foul);
    const arrowG = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.16), new THREE.Vector2(-0.025, -0.06), new THREE.Vector2(0.025, -0.06)]));
    for (let k = -3; k <= 3; k++) { const a = new THREE.Mesh(arrowG, M.arrow); a.rotation.x = -Math.PI / 2; a.position.set(k * 0.135, 0.003, -3.6 - Math.abs(k) * 0.3); g.add(a); }
    for (let k = -2; k <= 2; k++) { const dd = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), M.arrow); dd.rotation.x = -Math.PI / 2; dd.position.set(k * 0.2, 0.003, -1.9); g.add(dd); }
    // gutters + capping
    for (const s of [-1, 1]) {
      const gut = new THREE.Mesh(new THREE.CylinderGeometry(GUT, GUT, LEN, 16, 1, true, Math.PI / 2, Math.PI), M.gutter); gut.rotation.x = -Math.PI / 2; gut.position.set(s * (HALF + GUT), 0, -LEN / 2); gut.receiveShadow = true; g.add(gut);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, LEN), M.capping); cap.position.set(s * (HALF + GUT * 2 + 0.065), 0.0, -LEN / 2); cap.receiveShadow = true; g.add(cap);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, -PIT - L + 0.9 + 0.4), M.kick); kick.position.set(s * (WALL + 0.06), 0.31, (-L + 0.9 + PIT) / 2 - 0.2); g.add(kick);
    }
    // neon strips (glow at night)
    const neonMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ff3df2', emissiveIntensity: 0.4 });
    for (const s of [-1, 1]) { const n = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, LEN), neonMat); n.position.set(s * (HALF + GUT * 2 + 0.135), 0.03, -LEN / 2); g.add(n); }
    // pit + masking unit
    const pit = new THREE.Mesh(new THREE.BoxGeometry(PITCH, 0.6, 1.2), M.pit); pit.position.set(0, -0.31, PIT - 0.1); g.add(pit);
    const [mc, mx] = cvs(512, 256), mtex = texOf(mc);
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(PITCH, 0.8), new THREE.MeshStandardMaterial({ map: mtex, emissiveMap: mtex, emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.6 }));
    mask.position.set(0, 1.3, -L - 0.25); g.add(mask);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(PITCH, 0.8), M.pit); curtain.position.set(0, 0.4, PIT - 0.5); g.add(curtain);
    // ball return (to the right of each lane)
    const hood = new THREE.Mesh(rounded(0.34, 0.3, 0.5, 0.1), M.capping); hood.position.set(PITCH / 2, 0.17, 0.75); hood.castShadow = true; g.add(hood);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), M.pit); hole.position.set(PITCH / 2, 0.18, 1.005); g.add(hole);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8), M.rail); r.rotation.x = Math.PI / 2; r.position.set(PITCH / 2 + s * 0.07, 0.3, 1.4); g.add(r); }
    // pins
    const pinGeo = new THREE.LatheGeometry(PIN_PROFILE.map(([r, y]) => new THREE.Vector2(r * 1.12, y * 1.12)), 20);
    const pins = SPOTS.map(s => { const m = new THREE.Mesh(pinGeo, M.pin); m.castShadow = true; m.position.set(s.x, 0, s.z); g.add(m); return m; });
    // sweep bar
    const sweep = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.4, 0.12, 0.05), glossy('#d8d4e4', { metalness: 0.5 })); sweep.position.set(0, 1.5, -L + 0.5); sweep.visible = false; g.add(sweep);
    // the ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 20), ballMaterial('house')); ball.castShadow = true; ball.position.set(PITCH / 2, 0.41, 1.75); g.add(ball);
    // score screen
    const screen = makeScreen(); screen.position.set(0, 2.55, -1.6); screen.rotation.x = 0.1; g.add(screen);
    W.lanes.push({ i, X, g, pins, ball, sweep, screen, mask: { c: mc, x: mx, tex: mtex }, neonMat });
  });
  function drawMasks(th) {
    W.lanes.forEach((ln, i) => {
      const { x } = ln.mask, [b, a, c] = th.mask;
      x.fillStyle = b; x.fillRect(0, 0, 512, 256);
      for (let k = 0; k < 7; k++) { x.strokeStyle = k % 2 ? a : c; x.lineWidth = 10; x.beginPath(); x.arc(256, 330, 120 + k * 26, Math.PI, 0); x.stroke(); }
      x.fillStyle = b; x.beginPath(); x.arc(256, 150, 62, 0, 7); x.fill();
      x.font = `66px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.fillText(i + 1, 256, 152);
      // little pin icons
      x.fillStyle = '#ffffff'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(256 + s * 180, 120, 14, 30, 0, 0, 7); x.fill(); x.beginPath(); x.arc(256 + s * 180, 78, 10, 0, 7); x.fill(); x.fillStyle = a; x.fillRect(256 + s * 180 - 9, 88, 18, 5); x.fillStyle = '#fff'; }
      ln.mask.tex.needsUpdate = true;
    });
  }

  // ---- disco: mirror ball, spot lights, floor dots
  const [dc, dx] = cvs(256, 128);
  dx.fillStyle = '#222'; dx.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 8) for (let x2 = 0; x2 < 256; x2 += 8) { const v = 120 + Math.random() * 135 | 0; dx.fillStyle = `rgb(${v},${v},${v + 10})`; dx.fillRect(x2 + 1, y + 1, 6, 6); }
  const mball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshStandardMaterial({ map: texOf(dc), emissiveMap: texOf(dc), emissive: '#ffffff', emissiveIntensity: 0.35, metalness: 0.9, roughness: 0.25, flatShading: true }));
  mball.position.set(0, 4.3, -9); scene.add(mball);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1), mat('#888')); chain.position.set(0, 5, -9); scene.add(chain);
  const spots = ['#ff3df2', '#3dd8ff', '#ffe23d'].map((c, i) => { const s = new THREE.SpotLight(c, 20, 0, 0.32, 0.6, 0); s.position.set((i - 1) * 4, 5.5, -2 - i * 2); scene.add(s, s.target); return s; });
  const DOTS = 90, dotMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }), DOTS);
  const dotSeed = Array.from({ length: DOTS }, (_, i) => ({ r: 1 + Math.random() * 9, a: Math.random() * 7, c: new THREE.Color(['#ff7df5', '#7de8ff', '#fff27d', '#ffffff'][i % 4]) }));
  dotSeed.forEach((d, i) => dotMesh.setColorAt(i, d.c)); scene.add(dotMesh);
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), dv = new THREE.Vector3(), ds = new THREE.Vector3(1, 1, 1);
  // stars for cosmic nights
  const sp = []; for (let i = 0; i < 400; i++) sp.push((Math.random() - 0.5) * 60, 1 + Math.random() * 10, PIT - 1.1);
  for (let i = 0; i < 300; i++) sp.push((Math.random() - 0.5) * 60, 5.1, -Math.random() * 30 + 4);
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 0.06, transparent: true, opacity: 0.8 }));
  scene.add(stars);
  W.flashT = 0;

  W.setTheme = key => {
    if (key === W.themeKey) return; W.themeKey = key; const th = W.theme = THEMES[key];
    scene.background = new THREE.Color(th.bg); scene.fog.color.set(th.fog);
    M.lane.map && M.lane.map.dispose(); M.lane.map = woodTex(th); M.lane.color.set(key === 'cosmic' ? '#b9a8ff' : '#ffffff'); M.lane.needsUpdate = true;
    M.approach.color.set(th.approach); M.capping.color.set(th.capping); M.wall.color.set(th.wall);
    M.carpet.map && M.carpet.map.dispose(); M.carpet.map = carpetTex(th); M.carpet.needsUpdate = true;
    M.pin.emissive.set(th.pinGlow); M.arrow.emissive.set(key === 'cosmic' ? '#3dfff2' : '#000'); M.arrow.emissiveIntensity = 1.2;
    hemi.intensity = th.hemi; sun.intensity = th.sun; reflMat.uniforms.uOp.value = th.refl;
    for (const ln of W.lanes) ln.neonMat.emissiveIntensity = th.neon;
    stars.visible = key === 'cosmic'; dotMesh.material.opacity = th.dots;
    drawMasks(th);
  };
  W.setNeon = (i, color) => W.lanes[i].neonMat.emissive.set(color);
  W.flash = (k = 1) => { W.flashT = Math.max(W.flashT, k); };

  W.update = (dt, t) => {
    mball.rotation.y += 0.006 * dt;
    const th = W.theme, boost = 1 + W.flashT * 3;
    spots.forEach((s, i) => { s.intensity = th.spot * boost; s.target.position.set(Math.sin(t * (0.5 + i * 0.17) + i * 2) * 5, 0, -5 + Math.cos(t * (0.4 + i * 0.13) + i) * 6); });
    for (let i = 0; i < DOTS; i++) { const d = dotSeed[i], a = d.a + t * 0.25; dv.set(Math.cos(a) * d.r, 0.006, -7 + Math.sin(a) * d.r * 0.9); dm.compose(dv, dq, ds); dotMesh.setMatrixAt(i, dm); }
    dotMesh.instanceMatrix.needsUpdate = true; dotMesh.material.opacity = th.dots * (1 + W.flashT * 2);
    W.flashT = Math.max(0, W.flashT - 0.02 * dt);
  };

  W.render = camera => {
    // planar reflection of everything above the lane surface
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rw = Math.max(256, size.x >> 1), rh = Math.max(256, size.y >> 1);
    if (rt.width !== rw || rt.height !== rh) rt.setSize(rw, rh);
    mirrorCam.copy(camera); mirrorCam.position.y = -camera.position.y;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = -dir.y;
    mirrorCam.up.set(0, 1, 0); mirrorCam.lookAt(mirrorCam.position.clone().add(dir)); mirrorCam.updateMatrixWorld(); mirrorCam.updateProjectionMatrix();
    texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
    for (const m of reflMeshes) m.visible = false; dotMesh.visible = false;
    const fogWas = scene.fog; scene.fog = null;
    renderer.clippingPlanes = clipUp; renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(null); renderer.clippingPlanes = [];
    scene.fog = fogWas;
    for (const m of reflMeshes) m.visible = true; dotMesh.visible = true;
    renderer.render(scene, camera);
  };
  return W;
}

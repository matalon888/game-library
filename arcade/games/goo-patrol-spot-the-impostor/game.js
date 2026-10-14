// Goo Patrol — original spot-the-impostor game. Goo blobs are hiding inside human disguises in the crowd.
// Hold and drag the scanner lens: through it humans show their bones, goo shows its true slimy self (battery is limited).
// Let go over someone to zap them. Every impostor also has a small tell you can learn to spot without the scanner.
import { THREE, createStage, createUI, store, loop, input, buzz, sfx, tone, note, burst, confetti, lerp, clamp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Goo Patrol: Spot the Impostor';
const S = store('goopatrol');
let level = +new URLSearchParams(location.search).get('level') || S.get('level', 1);
let best = S.get('best', 0);
const F = flow('goopatrol');

const stage = createStage({ fov: 50, shadowSize: 8 });
const { scene, camera, renderer, sun, hemi } = stage;
stage.autoRender = false;
sun.layers.enable(1); hemi.layers.enable(1);
const ui = createUI({ title: 'GOO<br>PATROL', hint: 'Hold to scan · let go to zap', hand: '👆' });
const D = daily('goopatrol', ui, { name: NAME });

// ---------------------------------------------------------------- HUD bits of our own: scanner battery + hearts
const css = document.createElement('style');
css.textContent = `.gp-bat{position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:8px;z-index:5;pointer-events:none;font-weight:800;font-size:16px;text-shadow:0 2px 0 rgba(0,0,0,.2)}
.gp-bat b{display:block;width:150px;height:14px;border-radius:9px;background:rgba(255,255,255,.55);overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.12)}
.gp-bat i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#29e0c2,#8cff6a);border-radius:9px;transition:width .1s}
.gp-ring{position:fixed;width:180px;height:180px;margin:-90px 0 0 -90px;border-radius:50%;border:7px solid #fff;box-shadow:0 0 0 4px #29e0c2,0 8px 24px rgba(0,0,0,.25);pointer-events:none;z-index:4;display:none}
.gp-ring:after{content:'';position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;border-radius:50%;border:3px solid rgba(255,255,255,.8)}
.gp-hearts{position:fixed;top:calc(52px + env(safe-area-inset-top));right:14px;z-index:5;font-size:22px;letter-spacing:2px;pointer-events:none;filter:drop-shadow(0 2px 0 rgba(0,0,0,.15))}
.gp-left{position:fixed;top:calc(52px + env(safe-area-inset-top));left:14px;z-index:5;font-size:17px;font-weight:800;pointer-events:none;background:rgba(0,0,0,.18);border-radius:16px;padding:2px 12px}`;
document.head.appendChild(css);
const bat = document.createElement('div'); bat.className = 'gp-bat'; bat.innerHTML = '🔋<b><i></i></b>'; document.body.appendChild(bat);
const ring = document.createElement('div'); ring.className = 'gp-ring'; document.body.appendChild(ring);
const hearts = document.createElement('div'); hearts.className = 'gp-hearts'; document.body.appendChild(hearts);
const left = document.createElement('div'); left.className = 'gp-left'; document.body.appendChild(left);
const hud = (on) => { for (const e of [bat, hearts, left]) e.style.display = on ? '' : 'none'; };
hud(false);

// ---------------------------------------------------------------- lens: second render (layer 1 = x-ray) composited in a circle
const rt = new THREE.WebGLRenderTarget(4, 4);
const lensMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: rt.texture }, center: { value: new THREE.Vector2() }, radius: { value: 100 }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, dead: { value: 0 } },
  vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `uniform sampler2D tex;uniform vec2 center,res;uniform float radius,time,dead;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec2 p=gl_FragCoord.xy;float d=distance(p,center);if(d>radius)discard;
  vec3 c=texture2D(tex,p/res).rgb;c=pow(c,vec3(1./2.2));
  c+=0.06*sin(p.y*0.5+time*8.);c*=1.0-0.35*smoothstep(radius*0.6,radius,d);
  float n=h(floor(p/3.)+time);c=mix(c,vec3(n*0.6+0.2),dead);
  gl_FragColor=vec4(c,1.);}`,
  depthTest: false, depthWrite: false,
});
const lensScene = new THREE.Scene(), lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const lensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat); lensQuad.frustumCulled = false; lensScene.add(lensQuad);
function sizeRT() { const pr = renderer.getPixelRatio(); rt.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr)); lensMat.uniforms.res.value.set(innerWidth * pr, innerHeight * pr); lensMat.uniforms.radius.value = 83 * pr; }
addEventListener('resize', sizeRT); sizeRT();
const xgrid = new THREE.GridHelper(30, 30, '#2a8fb0', '#1b5f7c'); xgrid.layers.set(1); scene.add(xgrid);

// ---------------------------------------------------------------- the zapper (in camera space, bottom right)
scene.add(camera);
const zapper = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 6, 14), glossy('#7b5cff')); body.rotation.x = Math.PI / 2; zapper.add(body);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 20), glossy('#ffd23f')); stripe.position.z = -0.08; zapper.add(stripe);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 18, 1, true), glossy('#29e0c2', { side: THREE.DoubleSide })); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.27; zapper.add(cone);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: '#b6ff6a' })); tip.position.z = -0.24; zapper.add(tip); zapper.tip = tip;
  const grip = new THREE.Mesh(rounded(0.07, 0.2, 0.09, 0.03), glossy('#ffffff')); grip.position.set(0, -0.12, 0.08); grip.rotation.x = 0.35; zapper.add(grip);
  const dish = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16), glossy('#ff5d8f')); dish.position.set(0, 0.1, 0.02); zapper.add(dish);
  zapper.scale.setScalar(0.55); zapper.position.set(0.15, -0.31, -0.8); zapper.rotation.set(0.12, 0.45, 0); camera.add(zapper);
}
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#9dff6a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(beam);

// ---------------------------------------------------------------- rooms
const room = new THREE.Group(); scene.add(room);
function texCanvas(fn, w = 128, h = 128) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const checker = (a, b) => texCanvas((x, w) => { x.fillStyle = a; x.fillRect(0, 0, w, w); x.fillStyle = b; x.fillRect(0, 0, w / 2, w / 2); x.fillRect(w / 2, w / 2, w / 2, w / 2); });
const planks = texCanvas((x, w) => { x.fillStyle = '#e8b27a'; x.fillRect(0, 0, w, w); x.fillStyle = '#d99c63'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 32 + 30, w, 2); x.fillRect(60, 0, 2, 32); x.fillRect(20, 32, 2, 32); x.fillRect(90, 64, 2, 32); x.fillRect(40, 96, 2, 32); });
const stripes = (a, b) => texCanvas((x, w) => { x.fillStyle = a; x.fillRect(0, 0, w, w); x.fillStyle = b; for (let i = 0; i < 4; i++) x.fillRect(i * 32, 0, 14, w); });
const lawn = texCanvas((x, w) => { x.fillStyle = '#8fd96a'; x.fillRect(0, 0, w, w); x.fillStyle = '#83cf5f'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 32, w, 16); });
const SCENES = ['park', 'home', 'diner'];
function buildRoom(kind, r) {
  room.clear();
  const floorTex = kind === 'park' ? lawn : kind === 'home' ? planks : checker('#ffffff', '#3a3f58');
  floorTex.repeat.set(kind === 'diner' ? 8 : 4, kind === 'diner' ? 8 : 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat('#ffffff', { map: floorTex, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.z = -3; floor.receiveShadow = true; room.add(floor);
  const bs = document.body.style;
  if (kind === 'park') {
    bs.setProperty('--bg1', '#7cc8ff'); bs.setProperty('--bg2', '#dff4ff'); bs.setProperty('--ui', '#29b38f');
    const trunk = mat('#a8714a'), leaf = [mat('#5cc36b'), mat('#7ed36a'), mat('#4fb37a')];
    for (let i = 0; i < 7; i++) { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.8, 8), trunk); tr.position.y = 0.9; tr.castShadow = true; t.add(tr); for (let j = 0; j < 3; j++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.8 - j * 0.12, 14, 10), leaf[(i + j) % 3]); l.position.set((j - 1) * 0.35, 2.1 + j * 0.35, 0); l.castShadow = true; t.add(l); } t.position.set(-7 + i * 2.3 + r() * 0.6, 0, -9 - r() * 2); t.scale.setScalar(0.9 + r() * 0.5); room.add(t); }
    const hedge = new THREE.Mesh(rounded(14, 0.8, 0.8, 0.3), mat('#5cbf68')); hedge.position.set(0, 0.4, -7.4); room.add(hedge);
    const bench = new THREE.Group(); const seat = new THREE.Mesh(rounded(1.6, 0.12, 0.5, 0.04), mat('#d9774a')); seat.position.y = 0.45; bench.add(seat); const back = new THREE.Mesh(rounded(1.6, 0.4, 0.1, 0.04), mat('#d9774a')); back.position.set(0, 0.75, -0.22); bench.add(back); bench.position.set(2.6, 0, -6.2); bench.rotation.y = -0.4; room.add(bench);
  } else if (kind === 'home') {
    bs.setProperty('--bg1', '#ffd6c2'); bs.setProperty('--bg2', '#fff1e3'); bs.setProperty('--ui', '#ff7a59');
    const wallTex = stripes('#fde7d6', '#f9dcc7'); wallTex.repeat.set(6, 1);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), mat('#ffffff', { map: wallTex })); wall.position.set(0, 3, -8); room.add(wall);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), mat('#ffe2cf')); w.position.set(s * 5, 3, -2); w.rotation.y = -s * Math.PI / 2; room.add(w); }
    const sofa = new THREE.Group(); const sb = new THREE.Mesh(rounded(2.6, 0.5, 0.9, 0.15), mat('#5aa9e6')); sb.position.y = 0.35; sofa.add(sb); const sbk = new THREE.Mesh(rounded(2.6, 0.8, 0.3, 0.15), mat('#4f9bd8')); sbk.position.set(0, 0.8, -0.35); sofa.add(sbk); for (const s of [-1, 1]) { const a = new THREE.Mesh(rounded(0.3, 0.7, 0.9, 0.12), mat('#4f9bd8')); a.position.set(s * 1.3, 0.5, 0); sofa.add(a); } sofa.position.set(-1.6, 0, -7.3); room.add(sofa);
    const win = new THREE.Mesh(rounded(1.8, 1.4, 0.1, 0.06), mat('#bfe6ff', { emissive: '#bfe6ff', emissiveIntensity: 0.4 })); win.position.set(2.4, 2.6, -7.95); room.add(win);
    const frame = new THREE.Mesh(rounded(2, 1.6, 0.06, 0.06), mat('#ffffff')); frame.position.set(2.4, 2.6, -7.98); room.add(frame);
    const lamp = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), mat('#444')); pole.position.y = 0.9; lamp.add(pole); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 16, 1, true), mat('#ffd166', { side: THREE.DoubleSide, emissive: '#ffd166', emissiveIntensity: 0.3 })); shade.position.y = 1.9; lamp.add(shade); lamp.position.set(3.4, 0, -6.6); room.add(lamp);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), mat('#ff9e80')); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, -4); rug.scale.set(1.4, 1, 1); rug.receiveShadow = true; room.add(rug);
    const plant = new THREE.Group(); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 12), mat('#e07a5f')); pot.position.y = 0.2; plant.add(pot); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat('#52b788')); l.scale.set(0.6, 1.6, 0.6); l.position.set(Math.cos(i * 1.3) * 0.15, 0.7, Math.sin(i * 1.3) * 0.15); l.rotation.z = Math.cos(i * 1.3) * 0.5; plant.add(l); } plant.position.set(-3.6, 0, -6.5); room.add(plant);
  } else {
    bs.setProperty('--bg1', '#c8b6ff'); bs.setProperty('--bg2', '#ffe1f0'); bs.setProperty('--ui', '#7b5cff');
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), mat('#ffd9e6')); wall.position.set(0, 3, -8); room.add(wall);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.5), mat('#ff5d8f')); band.position.set(0, 1.2, -7.98); room.add(band);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), mat('#ffe8ef')); w.position.set(s * 5, 3, -2); w.rotation.y = -s * Math.PI / 2; room.add(w); }
    const counter = new THREE.Mesh(rounded(5, 1.1, 0.9, 0.12), mat('#ffffff')); counter.position.set(0.5, 0.55, -7); counter.castShadow = true; room.add(counter);
    const top = new THREE.Mesh(rounded(5.2, 0.12, 1.1, 0.05), mat('#3ab7a5')); top.position.set(0.5, 1.15, -7); room.add(top);
    for (let i = 0; i < 4; i++) { const st = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), mat('#999')); p.position.y = 0.35; st.add(p); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 16), mat('#ff5d8f')); seat.position.y = 0.72; st.add(seat); st.position.set(-1.3 + i * 1.2, 0, -6.1); room.add(st); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), mat('#ffffff', { map: texCanvas((x) => { x.fillStyle = '#ffd23f'; x.beginPath(); x.roundRect(0, 0, 256, 80, 30); x.fill(); x.fillStyle = '#ff5d8f'; x.font = '900 52px system-ui'; x.textAlign = 'center'; x.fillText('SNACKS', 128, 58); }, 256, 80), transparent: true })); sign.position.set(0.5, 3.1, -7.9); room.add(sign);
    for (let i = 0; i < 3; i++) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffffff', { emissive: '#fff3c4', emissiveIntensity: 0.6, side: THREE.DoubleSide })); lamp.rotation.x = Math.PI; lamp.position.set(-2 + i * 2, 4.2, -5); room.add(lamp); }
  }
}

// ---------------------------------------------------------------- citizens
const SKINS = ['#ffd7ba', '#f1c27d', '#c68642', '#8d5524', '#ffe0cc', '#e0ac69'];
const SHIRTS = ['#ff5d8f', '#3a86ff', '#ffd23f', '#52b788', '#ff8c42', '#9b5de5', '#ffffff', '#ef476f', '#06d6a0', '#118ab2'];
const PANTS = ['#2b2d42', '#3d5a80', '#6c584c', '#5a189a', '#264653', '#8d99ae'];
const HAIR = ['#2b2118', '#6f4e37', '#e9c46a', '#d1495b', '#1d1d1d', '#a0a0a0'];
const XBONE = new THREE.MeshBasicMaterial({ color: '#dff9ff' }), XGLOW = new THREE.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.18, depthWrite: false }), XDARK = new THREE.MeshBasicMaterial({ color: '#0b2235' });
const XGOO = new THREE.MeshBasicMaterial({ color: '#a6ff4d' }), XGOO2 = new THREE.MeshBasicMaterial({ color: '#c77dff' });
const onX = (m) => { m.layers.set(1); return m; };
const SPH = new THREE.SphereGeometry(1, 18, 12), CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 5, 10);

function citizen(r, goo, tell) {
  const g = new THREE.Group(), skin = SKINS[Math.floor(r() * SKINS.length)], shirt = SHIRTS[Math.floor(r() * SHIRTS.length)], pants = PANTS[Math.floor(r() * PANTS.length)];
  const mS = mat(shirt), mP = mat(pants), mK = mat(skin), mH = mat(HAIR[Math.floor(r() * HAIR.length)]);
  const body = new THREE.Group(); g.add(body);
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
  const legs = [], arms = [];
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.12, 0.78, 0); body.add(p); add(CAP(0.09, 0.5), mP, 0, -0.38, 0, 1, 1, 1, p); add(SPH, mat('#2b2d42'), 0, -0.72, 0.05, 0.1, 0.07, 0.15, p); legs.push(p); }
  const dress = r() < 0.25;
  if (dress) add(new THREE.ConeGeometry(0.36, 0.6, 16), mS, 0, 0.88, 0);
  add(CAP(0.24, 0.32), mS, 0, 1.1, 0, 1, 1, 0.82);
  const handMat = goo && tell === 1 ? glossy('#9be564', { emissive: '#4c8a1a', emissiveIntensity: 0.3 }) : mK;
  for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 0.3, 1.32, 0); body.add(p); add(CAP(0.07, 0.36), mS, 0, -0.22, 0, 1, 1, 1, p); add(SPH, handMat, 0, -0.48, 0, 0.085, 0.085, 0.085, p); p.rotation.z = s * 0.12; arms.push(p); }
  const head = new THREE.Group(); head.position.y = 1.72; body.add(head);
  add(SPH, mK, 0, 0, 0, 0.29, 0.3, 0.28, head);
  const eyeMat = glossy('#1d1d2b', { emissive: '#000000' });
  for (const s of [-1, 1]) add(SPH, eyeMat, s * 0.1, 0.03, 0.24, 0.045, 0.06, 0.03, head);
  add(SPH, mat('#d0605e'), 0, -0.1, 0.25, 0.06, 0.025, 0.02, head);
  // hair / hats
  const style = Math.floor(r() * 6);
  if (style === 0) add(SPH, mH, 0, 0.08, -0.02, 0.31, 0.26, 0.3, head);
  else if (style === 1) { add(SPH, mH, 0, 0.08, -0.02, 0.31, 0.26, 0.3, head); add(SPH, mH, 0, 0.3, -0.12, 0.13, 0.13, 0.13, head); }
  else if (style === 2) { const hm = mat(SHIRTS[Math.floor(r() * SHIRTS.length)]); add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20), hm, 0, 0.2, 0, 1, 1, 1, head); add(new THREE.CylinderGeometry(0.2, 0.21, 0.32, 20), hm, 0, 0.38, 0, 1, 1, 1, head); }
  else if (style === 3) { const hm = mat(SHIRTS[Math.floor(r() * SHIRTS.length)]); add(SPH, hm, 0, 0.12, 0, 0.3, 0.2, 0.3, head); add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), hm, 0, 0.13, 0.22, 1, 1, 1, head); }
  else if (style === 4) { for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.07, 0.2, 6), mH, (i - 2) * 0.1, 0.3 - Math.abs(i - 2) * 0.03, 0, 1, 1, 1, head).rotation.z = (2 - i) * 0.25; }
  else { add(SPH, mH, 0, 0.06, -0.05, 0.32, 0.3, 0.3, head); add(SPH, mH, 0, -0.18, -0.12, 0.3, 0.22, 0.2, head); }
  if (r() < 0.25) for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.06, 0.012, 6, 14), mat('#2b2d42'), s * 0.1, 0.03, 0.27, 1, 1, 1, head);
  // the tell
  let antenna = null;
  if (goo && tell === 0) { antenna = new THREE.Group(); antenna.position.set(0.08, 0.3, 0); head.add(antenna); add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), glossy('#c77dff'), 0, 0.12, 0, 1, 1, 1, antenna); add(SPH, glossy('#a6ff4d', { emissive: '#7bd62a', emissiveIntensity: 0.6 }), 0, 0.29, 0, 0.05, 0.05, 0.05, antenna); antenna.position.y = style === 2 ? 0.5 : 0.3; }
  // x-ray layer: bones for humans, the real goo for impostors
  if (!goo) {
    add(SPH, XBONE, 0, 0.02, 0, 0.22, 0.24, 0.22, head).layers.set(1);
    for (const s of [-1, 1]) add(SPH, XDARK, s * 0.08, 0.03, 0.17, 0.06, 0.07, 0.06, head).layers.set(1);
    onX(add(CAP(0.26, 0.3), XGLOW, 0, 1.12, 0, 1, 1, 0.8));
    onX(add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), XBONE, 0, 1.15, 0));
    for (let i = 0; i < 3; i++) onX(add(new THREE.TorusGeometry(0.18 - i * 0.02, 0.018, 6, 18), XBONE, 0, 1.3 - i * 0.12, 0, 1, 1, 0.7)).rotation.x = Math.PI / 2;
    for (const p of [...arms, ...legs]) onX(add(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6), XBONE, 0, -0.3, 0, 1, 1, 1, p));
    onX(add(CAP(0.3, 0.1), XGLOW, 0, 0, 0, 1, 1, 1, head));
  } else {
    onX(add(SPH, XGOO, 0, 1.15, 0, 0.36, 0.42, 0.32));
    onX(add(SPH, XGOO, 0, 0.02, 0, 0.3, 0.34, 0.3, head));
    onX(add(SPH, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0, 0.05, 0.2, 0.16, 0.16, 0.1, head));
    onX(add(SPH, XDARK, 0, 0.05, 0.28, 0.07, 0.09, 0.05, head));
    for (const p of [...arms, ...legs]) onX(add(CAP(0.08, 0.4), XGOO2, 0, -0.3, 0, 1, 1, 1, p));
    for (const s of [-1, 1]) onX(add(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), XGOO2, s * 0.12, 0.35, 0, 1, 1, 1, head)).rotation.z = -s * 0.3;
  }
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.1, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.05; g.add(hit);
  return { g, body, head, arms, legs, eyeMat, antenna, hit, goo, tell, skin, shirt, phase: r() * 10, glowT: 2 + r() * 3, dripT: 1 + r() * 2, state: 'idle', t: 0 };
}

// true-form goo creature that bursts out of a zapped impostor
function gooBlob() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(SPH, glossy('#a6ff4d', { emissive: '#5fb51a', emissiveIntensity: 0.35 })); b.scale.set(0.5, 0.55, 0.45); b.position.y = 0.55; b.castShadow = true; g.add(b);
  const e = new THREE.Mesh(SPH, mat('#ffffff')); e.scale.set(0.2, 0.22, 0.12); e.position.set(0, 0.72, 0.38); g.add(e);
  const p = new THREE.Mesh(SPH, glossy('#2b2d42')); p.scale.set(0.09, 0.11, 0.06); p.position.set(0, 0.72, 0.48); g.add(p);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(CAP(0.07, 0.25), glossy('#c77dff')); const a = i / 5 * Math.PI * 2; t.position.set(Math.cos(a) * 0.4, 0.15, Math.sin(a) * 0.35); t.rotation.z = Math.cos(a) * 0.9; t.rotation.x = -Math.sin(a) * 0.9; g.add(t); }
  return g;
}

// ---------------------------------------------------------------- state
let state = 'ready', crowd = [], drips = [], battery = 1, batteryMax = 4, lives = 3, found = 0, total = 1, score = 0, recorded = false, beatenShown = false;
let holding = false, lensX = 0, lensY = 0, beamT = 0, shake = 0, blobs = [], botT = 0, botTarget = null, kickT = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const TELLS = ['antenna', 'goo hands', 'glowing eyes', 'hovering', 'dripping goo'];

function build() {
  for (const c of crowd) scene.remove(c.g); for (const d of drips) scene.remove(d.m); for (const b of blobs) scene.remove(b.g); crowd = []; drips = []; blobs = [];
  const fk = F.k(), r = rng(D.seed || level * 4271 + 11);
  buildRoom(SCENES[(level - 1) % SCENES.length], r);
  const n = clamp(Math.round((4 + level * 0.6) * fk), 4, 11);
  total = level <= 2 ? 1 : level <= 6 ? 2 : 3; total = Math.min(total, n - 2);
  batteryMax = clamp(4.5 / fk - level * 0.12, 1.6, 5.5); battery = 1;
  // spots in staggered rows so nobody is fully hidden
  const spots = [], per = n <= 4 ? 2 : 3, rows = Math.ceil(n / per);
  for (let i = 0; i < n; i++) { const row = Math.floor(i / per), idx = i % per, cnt = Math.min(per, n - row * per); spots.push([(idx - (cnt - 1) / 2) * 1.0 + (row % 2 ? 0.42 : -0.1) + (r() - 0.5) * 0.18, -1.2 - row * 1.25 - r() * 0.25]); }
  const gooIdx = new Set(); while (gooIdx.size < total) gooIdx.add(Math.floor(r() * n));
  const tellPool = level === 1 ? [0] : level === 2 ? [0, 1] : [0, 1, 2, 3, 4];
  spots.forEach(([x, z], i) => {
    const goo = gooIdx.has(i), tell = goo ? tellPool[Math.floor(r() * tellPool.length)] : -1;
    const c = citizen(r, goo, tell); c.g.position.set(clamp(x, -1.6, 1.6), 0, z); c.g.rotation.y = (r() - 0.5) * 0.5 - x * 0.08; c.home = c.g.position.clone(); scene.add(c.g); crowd.push(c);
  });
  lives = 3; found = 0; score = 0; recorded = false; beatenShown = false; holding = false; ring.style.display = 'none'; botTarget = null; botT = 0;
  hearts.textContent = '❤️❤️❤️'; left.textContent = `👾 ${total}`;
  ui.levels(level); ui.progress(0); ui.score(0); ui.sub(`${D.isDaily ? "DAILY · " : ""}Find ${total} goo impostor${total > 1 ? "s" : ""}`);
  setBat();
}
function setBat() { bat.querySelector('i').style.width = battery * 100 + '%'; }

function personAt(sx, sy) {
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const alive = crowd.filter(c => c.state === 'idle'); const hits = ray.intersectObjects(alive.map(c => c.hit));
  return hits.length ? alive.find(c => c.hit === hits[0].object) : null;
}
function screenOf(c, dy = 1.75) { const v = c.g.position.clone(); v.y += dy; v.project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }

function zap(c) {
  if (state !== 'play' || !c || c.state !== 'idle') return;
  kickT = 1; beamT = 1; shake = 0.12;
  const from = new THREE.Vector3(); zapper.tip.getWorldPosition(from); const to = c.g.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  beam.position.copy(from).lerp(to, 0.5); beam.scale.set(1, from.distanceTo(to), 1); beam.lookAt(to); beam.rotateX(Math.PI / 2);
  tone(1200, 0.25, 'sawtooth', 0.07, 0.25); tone(80, 0.25, 'square', 0.06, 0.6);
  if (c.goo) {
    c.state = 'caught'; c.t = 0; found++; score += 100 + Math.round(battery * 50); ui.score(score);
    burst(scene, to, [c.shirt, c.skin, '#a6ff4d', '#c77dff'], 30, { speed: 0.16, up: 0.12, size: 0.9 });
    const b = gooBlob(); b.position.copy(c.g.position); scene.add(b); blobs.push({ g: b, t: 0 }); c.g.visible = false;
    ui.pop(found === total ? 'GOT EM ALL!' : ['GOTCHA!', 'SLIMED!', 'NO DISGUISE!'][found % 3], '#a6ff4d', 44, 24); buzz([20, 30, 40]); ui.flash(0.3);
    [0, 3, 7, 12].forEach((s, i) => setTimeout(() => note(64 + s + found * 2, 0.22, 0.14), i * 60));
    ui.progress(found / total); left.textContent = `👾 ${total - found}`;
    if (!beatenShown && D.beaten(score)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 32); confetti(scene, to, 40); }
    if (found >= total) setTimeout(win, 700);
  } else {
    c.state = 'stunned'; c.t = 0; lives--; hearts.textContent = '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(3 - Math.max(0, lives));
    burst(scene, to, ['#ffffff', '#ffd23f'], 14, { speed: 0.1, up: 0.08, size: 0.5 });
    ui.pop('HEY! HUMAN!', '#ff5d8f', 40, 24); sfx.fail(); buzz([60, 40, 60]); shake = 0.35;
    if (lives <= 0) setTimeout(lose, 500);
  }
}
function win() {
  if (state !== 'play') return; state = 'won'; if (!recorded) { recorded = true; F.level(true); }
  score += lives * 50; ui.score(score); best = Math.max(best, score); S.set('best', best);
  sfx.win(); confetti(scene, new THREE.Vector3(0, 2.4, -3), 110); holding = false; ring.style.display = 'none';
  for (const c of crowd) if (c.state === 'idle' || c.state === 'stunned') c.state = 'cheer';
  D.won(score); ui.win(level, `${found} impostor${found > 1 ? 's' : ''} caught · ${score} pts`);
}
function lose() {
  if (state !== 'play') return; state = 'lost'; if (!recorded) { recorded = true; F.level(false, found / total); }
  holding = false; ring.style.display = 'none'; best = Math.max(best, score); S.set('best', best);
  for (const c of crowd) if (c.goo && c.state === 'idle') { c.state = 'reveal'; c.t = 0; }
  ui.lose('THEY GOT AWAY!', `${found} / ${total} impostors caught`);
}

input({
  onDown: (e) => { if (state !== 'play') return; holding = true; lensX = e.clientX; lensY = e.clientY - 70; tone(700, 0.05, 'sine', 0.06, 1.3); },
  onMove: (dx, dy, e) => { if (holding) { lensX = e.clientX; lensY = e.clientY - 70; } },
  onUp: () => { if (!holding || state !== 'play') { holding = false; return; } holding = false; zap(personAt(lensX, lensY)); },
});
ui.onTap(w => {
  if (w === 'win') { level++; S.set('level', level); build(); }
  else if (w === 'lose') build();
  state = 'play'; ui.els.sc.classList.remove('hc-hidden'); hud(true);
});

// ---------------------------------------------------------------- loop
const tmpV = new THREE.Vector3();
loop((dt, t) => {
  const step = dt / 60;
  // scanner battery
  const scanning = holding && state === 'play';
  if (scanning) { battery = Math.max(0, battery - step / batteryMax); setBat(); if (Math.random() < 0.15 && battery > 0) tone(1800 + Math.random() * 400, 0.02, 'sine', 0.02, 1); }
  ring.style.display = scanning ? 'block' : 'none'; ring.style.left = lensX + 'px'; ring.style.top = lensY + 'px';
  ring.style.boxShadow = `0 0 0 4px ${battery > 0 ? '#29e0c2' : '#ff5d8f'},0 8px 24px rgba(0,0,0,.25)`;
  // citizens
  for (const c of crowd) {
    c.t += step; const ph = t * 1.6 + c.phase;
    if (c.state === 'idle' || c.state === 'cheer') {
      const cheer = c.state === 'cheer';
      c.body.rotation.z = Math.sin(ph) * 0.04; c.head.rotation.y = Math.sin(ph * 0.37) * 0.5; c.head.rotation.z = Math.sin(ph * 0.5) * 0.06;
      c.arms[0].rotation.z = cheer ? 2.6 + Math.sin(t * 12) * 0.3 : -0.12 - Math.abs(Math.sin(ph * 0.8)) * 0.15;
      c.arms[1].rotation.z = cheer ? -2.6 - Math.sin(t * 12) * 0.3 : 0.12 + Math.abs(Math.sin(ph * 0.7)) * 0.15;
      let y = cheer ? Math.abs(Math.sin(t * 8 + c.phase)) * 0.35 : 0;
      if (c.goo && c.tell === 3) y += 0.14 + Math.sin(t * 3 + c.phase) * 0.05;
      c.g.position.y = y; c.g.scale.y = 1 + Math.sin(ph * 2) * 0.012;
      if (c.antenna) c.antenna.rotation.z = Math.sin(t * 6 + c.phase) * 0.35;
      if (c.goo && c.tell === 2) { c.glowT -= step; const on = c.glowT < 0.35; c.eyeMat.emissive.set(on ? '#b6ff3b' : '#000000'); c.eyeMat.emissiveIntensity = on ? 1.5 : 0; if (c.glowT < 0) c.glowT = 2 + Math.random() * 2; }
      if (c.goo && c.tell === 4 && state === 'play') { c.dripT -= step; if (c.dripT < 0) { c.dripT = 1.4 + Math.random() * 1.2; const m = new THREE.Mesh(SPH, glossy('#a6ff4d', { emissive: '#5fb51a', emissiveIntensity: 0.3 })); m.scale.setScalar(0.05); const hand = c.arms[Math.random() < 0.5 ? 0 : 1]; hand.children[1].getWorldPosition(m.position); scene.add(m); drips.push({ m, vy: 0, t: 0, landed: false }); } }
    } else if (c.state === 'stunned') {
      c.body.rotation.x = lerp(c.body.rotation.x, -0.35, 0.2); c.head.rotation.y = Math.sin(t * 20) * 0.3 * Math.max(0, 1 - c.t);
      if (c.t > 1.4) { c.state = 'idle'; c.body.rotation.x = 0; }
    } else if (c.state === 'reveal') { c.g.position.y = Math.abs(Math.sin(t * 10)) * 0.2; c.body.rotation.z = Math.sin(t * 14) * 0.15; }
  }
  // goo drips fall and splat
  for (const d of drips) { d.t += step; if (!d.landed) { d.vy -= 0.012 * dt; d.m.position.y += d.vy * dt; if (d.m.position.y <= 0.02) { d.landed = true; d.m.position.y = 0.01; d.m.scale.set(0.12, 0.012, 0.12); } } }
  for (let i = drips.length - 1; i >= 0; i--) if (drips[i].t > 6) { scene.remove(drips[i].m); drips.splice(i, 1); }
  // revealed goo blobs wobble, then zip up and away
  for (const b of blobs) { b.t += step; const s = Math.min(1, b.t * 4); b.g.scale.set(s * (1 + Math.sin(b.t * 18) * 0.12), s * (1 - Math.sin(b.t * 18) * 0.12), s); if (b.t > 0.9) { b.g.position.y += (b.t - 0.9) * 0.4 * dt; b.g.rotation.y += 0.3 * dt; } }
  // beam + zapper recoil
  beamT = Math.max(0, beamT - 0.08 * dt); beam.material.opacity = beamT * 0.9; beam.scale.x = beam.scale.z = 0.6 + Math.random() * 0.8;
  kickT = Math.max(0, kickT - 0.1 * dt); zapper.position.z = -0.8 + kickT * 0.06; zapper.rotation.x = 0.12 + kickT * 0.3;
  zapper.position.y = -0.34 + Math.sin(t * 2) * 0.006;
  // aim the zapper toward the lens
  if (scanning) { const ax = (lensX / innerWidth - 0.5), ay = (lensY / innerHeight - 0.5); zapper.rotation.y = lerp(zapper.rotation.y, 0.45 - ax * 0.7, 0.2); zapper.rotation.x = lerp(zapper.rotation.x, 0.12 - ay * 0.4, 0.2); }
  shake = Math.max(0, shake - 0.012 * dt);
  camera.position.set(Math.sin(t * 0.4) * 0.12 + (Math.random() - 0.5) * shake, 3.3 + (Math.random() - 0.5) * shake, 4.6);
  camera.lookAt(0, 0.9, -2.9);
  // render: main, then the x-ray lens through the circle
  renderer.render(scene, camera);
  if (scanning) {
    camera.layers.set(1); renderer.setRenderTarget(rt); renderer.setClearColor('#0d2b45', 1); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); camera.layers.set(0);
    const pr = renderer.getPixelRatio(); lensMat.uniforms.center.value.set(lensX * pr, (innerHeight - lensY) * pr); lensMat.uniforms.time.value = t; lensMat.uniforms.dead.value = battery > 0 ? 0 : 1;
    renderer.autoClear = false; renderer.render(lensScene, lensCam); renderer.autoClear = true;
  }
});

build(); ui.start(); ui.els.sc.classList.add('hc-hidden');

window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // sweep the lens over a goo, hold it there a moment, let go to zap
    if (state !== 'play') { holding = false; return; }
    if (!botTarget || botTarget.state !== 'idle') { botTarget = crowd.find(c => c.goo && c.state === 'idle'); botT = 0; if (!holding) { holding = true; lensX = innerWidth / 2; lensY = innerHeight * 0.7; } return; }
    const aims = [1.75, 1.95, 1.2, 0.6], [sx, sy] = screenOf(botTarget, aims[Math.floor(botT / 6) % aims.length]);
    lensX = lerp(lensX, sx, 0.45); lensY = lerp(lensY, sy, 0.45); holding = true;
    botT++; if (Math.hypot(lensX - sx, lensY - sy) < 14 && botT % 6 > 3 && (personAt(lensX, lensY) === botTarget || botT > 40)) { holding = false; zap(personAt(lensX, lensY)); botTarget = null; }
  },
};

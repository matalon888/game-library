// Chip Spin — carving wood on a lathe. Drag the chisel into the spinning log to carve it down to the target silhouette
// (the shaded ghost inside the wood), then paint bands on it. Score = how closely your piece matches the target.
import { THREE, createStage, createUI, loop, tone, note, buzz, confetti, store, clamp, lerp, rng, mat, glossy, rounded } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';

const NAME = 'Chip Spin: Wood Carving Lathe';
const S = store('chipspin');
const F = flow('chipspin');
let level = S.get('level', 1), total = S.get('score', 0);
const ui = createUI({ title: 'CHIP<br>SPIN', hint: 'Drag the chisel into the wood', hand: '👆', score: false });
const D = daily('chipspin', ui, { name: NAME });
const stage = createStage({ fov: 36, shadowSize: 6 });
const { scene, camera, sun, renderer } = stage;
const BGS = [['#c3b4ff', '#8e7cf2'], ['#ffc3d8', '#f08bb0'], ['#b4e6ff', '#6fb5f0'], ['#c7f2c9', '#6fcf97'], ['#ffd8b0', '#f5a25d'], ['#d8c4ff', '#a17cf0']];
const setBg = (L) => { const b = BGS[(L - 1) % BGS.length]; document.body.style.background = `radial-gradient(120% 80% at 50% 30%, ${b[0]} 0%, ${b[1]} 100%)`; };

// ---------------------------------------------------------------- DOM: target card, buttons, swatches
const css = document.createElement('style');
css.textContent = `
.cs-card{position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translateX(-50%);z-index:5;background:rgba(255,255,255,.88);border-radius:18px;padding:8px 12px 6px;box-shadow:0 6px 0 rgba(0,0,0,.08);display:flex;flex-direction:column;align-items:center;pointer-events:none}
.cs-card canvas{display:block;width:190px;height:74px}
.cs-card div{font-weight:800;font-size:15px;color:#4b3a7a;line-height:1.1;margin-top:2px}
.cs-card div b{color:#ff5d8f}
.cs-go{position:fixed;right:16px;bottom:calc(22px + env(safe-area-inset-bottom));z-index:6;width:76px;height:64px;border:0;border-radius:18px;background:#3ccf6e;color:#fff;font:inherit;font-size:34px;font-weight:800;box-shadow:0 6px 0 #23955a;cursor:pointer}
.cs-go:active{transform:translateY(4px);box-shadow:0 2px 0 #23955a}
.cs-go.off{opacity:.4}
.cs-tools{position:fixed;left:14px;bottom:calc(22px + env(safe-area-inset-bottom));z-index:6;display:flex;gap:8px;background:rgba(40,20,80,.35);border-radius:18px;padding:8px}
.cs-tools{max-width:calc(100% - 124px);flex-wrap:wrap;gap:5px!important}
.cs-tools button{width:48px;height:46px;border-radius:12px;border:0;background:#fff;font:inherit;font-size:24px;font-weight:800;color:#2b2d42;cursor:pointer;display:flex;align-items:center;justify-content:center}
.cs-tools button.on{outline:4px solid #ffd23f}
.cs-tools .sw{width:34px;height:34px;border-radius:50%;box-shadow:inset 0 -4px 0 rgba(0,0,0,.18)}
.cs-hide{display:none!important}`;
document.head.appendChild(css);
const card = document.createElement('div'); card.className = 'cs-card cs-hide'; card.innerHTML = '<canvas width="380" height="148"></canvas><div>Match <b data-m>0%</b> · goal <span data-g>60</span>%</div>'; document.body.appendChild(card);
const cardCv = card.querySelector('canvas'), cg = cardCv.getContext('2d');
const goBtn = document.createElement('button'); goBtn.className = 'cs-go cs-hide'; goBtn.textContent = '➜'; document.body.appendChild(goBtn);
const tools = document.createElement('div'); tools.className = 'cs-tools cs-hide'; document.body.appendChild(tools);
for (const el of [goBtn, tools]) el.addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- the lathe
const LEN = 5.0, N = 160, R0 = 1.12, MINR = 0.16;
const xs = Float32Array.from({ length: N + 1 }, (_, i) => -LEN / 2 + i * LEN / N);
let R = new Float32Array(N + 1), T = new Float32Array(N + 1), PC = new Int8Array(N + 1);
const metal = glossy('#c9d2de', { metalness: 0.6, roughness: 0.25 }), dark = mat('#3d3a4b'), body = mat('#4a6fd8'), bodyB = mat('#ffd23f');
const bed = new THREE.Mesh(rounded(8.2, 0.5, 1.2, 0.12), dark); bed.position.set(0, -2.25, -0.75); bed.receiveShadow = true; bed.castShadow = true; scene.add(bed);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.5; floor.receiveShadow = true; scene.add(floor);
const head = new THREE.Mesh(rounded(1.1, 2.6, 1.6, 0.2), body); head.position.set(-LEN / 2 - 0.9, -0.7, -0.2); head.castShadow = true; scene.add(head);
const tail = new THREE.Mesh(rounded(0.9, 2.2, 1.3, 0.2), body); tail.position.set(LEN / 2 + 0.85, -0.9, -0.2); tail.castShadow = true; scene.add(tail);
for (const s of [-1, 1]) {
  const spur = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.45, 20), metal); spur.rotation.z = Math.PI / 2; spur.position.set(s * (LEN / 2 + 0.22), 0, 0); scene.add(spur);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24), bodyB); cap.rotation.z = Math.PI / 2; cap.position.set(s * (LEN / 2 + 0.38), 0, 0); scene.add(cap);
}
const rest = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, LEN + 0.6, 12), metal); rest.rotation.z = Math.PI / 2; rest.position.set(0, -1.42, 0.55); scene.add(rest);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), glossy('#ff5d6c')); knob.position.set(-LEN / 2 - 0.9, 0.85, 0.5); scene.add(knob);

// wood material: vertex colours (bark / fresh wood with growth rings that appear as you cut / paint) × a fine grain map
function grainTex() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 512; const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(120,80,40,${0.03 + Math.random() * 0.06})`; c.fillRect(0, Math.random() * 512, 64, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grainTex(), roughness: 0.78, metalness: 0 });
const ghostMat = new THREE.MeshBasicMaterial({ color: '#2a1a5e', transparent: true, opacity: 0.32, depthWrite: false, depthFunc: THREE.GreaterDepth });
const spinner = new THREE.Group(); spinner.rotation.z = -Math.PI / 2; scene.add(spinner);
const SEG = 44;
let wood = null, ghost = null;
function lathePoints(rad) { const p = [new THREE.Vector2(0.001, xs[0])]; for (let i = 0; i <= N; i++) p.push(new THREE.Vector2(rad[i], xs[i])); p.push(new THREE.Vector2(0.001, xs[N])); return p; }
const BARK = new THREE.Color('#9a6a44'), WOOD = new THREE.Color('#f2cf9a'), RING = new THREE.Color('#d9a76a');
let PAL = ['#ff5d6c', '#ffd23f', '#3a86ff', '#3ccf6e', '#ffffff', '#2b2d42'];
const _c = new THREE.Color();
function rebuildWood() {
  const geo = new THREE.LatheGeometry(lathePoints(R), SEG), P = N + 3, col = new Float32Array(geo.attributes.position.count * 3);
  for (let s = 0; s <= SEG; s++) for (let j = 0; j < P; j++) {
    const i = clamp(j - 1, 0, N), k = (s * P + j) * 3;
    if (PC[i] >= 0) _c.set(PAL[PC[i]]);
    else if (R[i] > R0 - 0.012 && j > 0 && j < P - 1) _c.copy(BARK).multiplyScalar(0.85 + 0.15 * Math.sin(s * 1.7 + i * 0.4));
    else { const ring = 0.5 + 0.5 * Math.sin(R[i] * 46); _c.copy(WOOD).lerp(RING, ring * ring * 0.8); }
    col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!wood) { wood = new THREE.Mesh(geo, woodMat); wood.castShadow = true; wood.receiveShadow = true; spinner.add(wood); }
  else { wood.geometry.dispose(); wood.geometry = geo; }
}
function rebuildGhost() {
  const geo = new THREE.LatheGeometry(lathePoints(T), SEG);
  if (!ghost) { ghost = new THREE.Mesh(geo, ghostMat); ghost.renderOrder = 2; spinner.add(ghost); } else { ghost.geometry.dispose(); ghost.geometry = geo; }
}

// chisel: handle + ferrule + blade; tip shapes: round, flat, vee
const chisel = new THREE.Group(); scene.add(chisel);
const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.2, 6, 14), glossy('#e0782f')); handle.position.y = -1.95; handle.castShadow = true;
const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.22, 16), metal); ferrule.position.y = -1.2;
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.0, 0.07), metal); blade.position.y = -0.6; blade.castShadow = true;
const tipM = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 18, 1, false, 0, Math.PI), metal); tipM.rotation.x = Math.PI / 2; tipM.position.y = -0.11;
chisel.add(handle, ferrule, blade, tipM);
const brush = new THREE.Group(); scene.add(brush); brush.visible = false;
const bHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 12), glossy('#ffffff')); bHandle.position.y = -1.15;
const bFerrule = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.3, 12), metal); bFerrule.position.y = -0.3;
const bTip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 12), glossy('#ff5d6c')); bTip.rotation.x = Math.PI; bTip.position.y = -0.0; bTip.rotation.x = 0; bTip.position.y = 0.0;
brush.add(bHandle, bFerrule, bTip);
const TIPS = [{ k: 'round', w: 0.2, f: (d) => 2.2 * d * d, icon: '◖' }, { k: 'flat', w: 0.16, f: () => 0, icon: '■' }, { k: 'vee', w: 0.22, f: (d) => Math.abs(d) * 1.6, icon: '▲' }];
let tip = 0;

// shavings: instanced curls that fly off and pile up on the bed
const SH = 700, shGeo = new THREE.TorusGeometry(0.12, 0.035, 4, 10, Math.PI * 1.5);
const shIM = new THREE.InstancedMesh(shGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), SH); shIM.castShadow = true; shIM.frustumCulled = false; scene.add(shIM);
const sh = Array.from({ length: SH }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1, life: 0, rest: false }));
let shI = 0; const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < SH; i++) shIM.setMatrixAt(i, Z0);
function shaving(x, y, col) {
  const idx = shI, o = sh[shI]; shI = (shI + 1) % SH;
  o.on = true; o.rest = false; o.life = 1; o.s = 0.6 + Math.random() * 0.9; o.p.set(x + (Math.random() - 0.5) * 0.15, y, 0.3 + Math.random() * 0.4);
  o.v.set((Math.random() - 0.5) * 0.12, 0.02 - Math.random() * 0.1, (Math.random() - 0.55) * 0.16); o.w.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4);
  shIM.setColorAt(idx, _c.copy(col).multiplyScalar(0.85 + Math.random() * 0.25)); if (shIM.instanceColor) shIM.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- noise audio (the carving hiss) + motor hum
let ax = null, hiss = null, hum = null;
function audioOn() {
  if (ax) return; try {
    ax = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ax.createBuffer(1, ax.sampleRate, ax.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ax.createBufferSource(); src.buffer = buf; src.loop = true; const f = ax.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    hiss = ax.createGain(); hiss.gain.value = 0; src.connect(f); f.connect(hiss); hiss.connect(ax.destination); src.start(); hiss.f = f;
    const o = ax.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 62; const lp = ax.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; hum = ax.createGain(); hum.gain.value = 0;
    o.connect(lp); lp.connect(hum); hum.connect(ax.destination); o.start();
  } catch (e) { ax = null; }
}

// ---------------------------------------------------------------- targets (seeded): base profile + beads / coves / tapers / steps
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function makeTarget(seed, L, fk) {
  const r = rng(seed), feats = [], nf = clamp(Math.round((1 + L * 0.45) * fk), 1, 7);
  const base = 0.55 + r() * 0.25, taper = (r() - 0.5) * 0.4;
  for (let k = 0; k < nf; k++) {
    const t = r(), c = 0.12 + r() * 0.76, w = (0.04 + r() * 0.12) / Math.sqrt(fk);
    feats.push(t < 0.38 ? { k: 'bead', c, w, a: 0.12 + r() * 0.22 } : t < 0.7 ? { k: 'cove', c, w, a: 0.12 + r() * 0.25 } : { k: 'step', c, w: w * 0.6, a: (r() - 0.5) * 0.4 });
  }
  for (let i = 0; i <= N; i++) {
    const u = i / N; let v = base + taper * (u - 0.5);
    for (const f of feats) { const d = (u - f.c) / f.w; if (f.k === 'bead') v += f.a * Math.exp(-d * d); else if (f.k === 'cove') v -= f.a * Math.exp(-d * d); else v += f.a * sstep(-1, 1, d); }
    v = Math.min(v, 0.42 + 0.6 * sstep(0, 0.07, u) * sstep(0, 0.07, 1 - u));   // the piece necks in where the lathe holds it
    T[i] = clamp(v, 0.26, R0 - 0.1);
  }
}
function match() {
  let e = 0; for (let i = 0; i <= N; i++) { const d = R[i] - T[i]; e += d < 0 ? -d * 1.7 : d; }
  return clamp(1 - e / (N + 1) / 0.2, 0, 1);
}
function drawCard() {
  const W = cardCv.width, H = cardCv.height; cg.clearRect(0, 0, W, H);
  const sx = W / (N + 6), cy = H / 2, sy = (H / 2 - 6) / R0;
  cg.fillStyle = '#4b3a7a'; cg.beginPath(); cg.moveTo(3 * sx, cy); for (let i = 0; i <= N; i++) cg.lineTo((i + 3) * sx, cy - T[i] * sy); for (let i = N; i >= 0; i--) cg.lineTo((i + 3) * sx, cy + T[i] * sy); cg.fill();
  if (phase !== 'carve' && phase !== 'paint' && phase !== 'done') return;
  cg.strokeStyle = '#ffb703'; cg.lineWidth = 3; cg.beginPath(); for (let i = 0; i <= N; i++) cg.lineTo((i + 3) * sx, cy - R[i] * sy); cg.stroke();
  cg.beginPath(); for (let i = 0; i <= N; i++) cg.lineTo((i + 3) * sx, cy + R[i] * sy); cg.stroke();
}

// ---------------------------------------------------------------- state
let state = 'ready', phase = 'carve', cx = 0, cd = 1.7, prev = null, removedNow = 0, dirty = true, goal = 60, m = 0, recorded = false, beatenShown = false;
let paintCol = 0, painted = 0, spin = 0, camT = 0, botX = -LEN / 2 - 0.3, botPhase = 0, sessionLv = 0, lastPctPop = 0, resultT = 0;
function fit() {
  const vf = camera.fov * Math.PI / 180, th = Math.tan(vf / 2), hw = 3.05;
  const d = Math.max(hw / (th * camera.aspect), 3.6 / th);
  camera.position.set(0, 0.4 + camT * 0.3, d * (1 - camT * 0.12)); camera.lookAt(0, -0.55 + camT * 0.35, 0);
}
addEventListener('resize', fit);
function build() {
  const fk = D.seed ? 1 : F.k(), L = D.seed ? 5 : level;
  setBg(D.seed ? 3 : level);
  makeTarget(D.seed ? D.seed + sessionLv * 31 : level * 7919 + 3, L, fk);
  goal = clamp(Math.round((58 + (L - 1) * 2.2) * fk), 52, 88);
  R.fill(R0); PC.fill(-1); rebuildWood(); rebuildGhost();
  phase = 'carve'; cx = 0; cd = 1.75; prev = null; m = match(); recorded = false; beatenShown = false; painted = 0; camT = 0; botX = -LEN / 2 - 0.3; botPhase = 0; lastPctPop = 0; resultT = 0;
  for (const o of sh) { o.on = false; } for (let i = 0; i < SH; i++) shIM.setMatrixAt(i, Z0); shIM.instanceMatrix.needsUpdate = true;
  chisel.visible = true; brush.visible = false; ghost.visible = true;
  card.querySelector('[data-g]').textContent = goal; card.classList.remove('cs-hide');
  renderTools(); ui.levels(D.seed ? 1 : level); ui.progress(0); drawCard(); fit();
}
function renderTools() {
  goBtn.classList.remove('cs-hide'); tools.classList.remove('cs-hide');
  if (phase === 'carve') tools.innerHTML = TIPS.map((t, i) => `<button data-t="${i}" class="${i === tip ? 'on' : ''}">${t.icon}</button>`).join('');
  else tools.innerHTML = PAL.map((c, i) => `<button data-c="${i}" class="${i === paintCol ? 'on' : ''}" style="background:transparent;width:36px;height:40px;padding:0"><div class="sw" style="background:${c}"></div></button>`).join('');
  tools.querySelectorAll('button').forEach(b => b.onclick = () => { if (b.dataset.t) { tip = +b.dataset.t; updateTipMesh(); } else { paintCol = +b.dataset.c; bTip.material.color.set(PAL[paintCol]); } tone(700, 0.04, 'sine', 0.08, 1.2); renderTools(); });
  goBtn.classList.toggle('off', phase === 'carve' && m < 0.2);
}
function updateTipMesh() {
  tipM.geometry.dispose();
  tipM.geometry = tip === 0 ? new THREE.CylinderGeometry(0.13, 0.13, 0.07, 18, 1, false, 0, Math.PI) : tip === 1 ? new THREE.BoxGeometry(0.26, 0.07, 0.07) : new THREE.CylinderGeometry(0.15, 0.15, 0.07, 3, 1, false, 0, Math.PI * 2);
  tipM.rotation.set(Math.PI / 2, 0, tip === 2 ? Math.PI / 2 : 0); tipM.position.y = tip === 1 ? -0.07 : -0.11;
}

// ---------------------------------------------------------------- carving + painting
function carveAt(x, d) {
  const t = TIPS[tip]; let rem = 0;
  const i0 = Math.max(0, Math.floor((x - t.w + LEN / 2) / LEN * N)), i1 = Math.min(N, Math.ceil((x + t.w + LEN / 2) / LEN * N));
  for (let i = i0; i <= i1; i++) {
    const dx = xs[i] - x; if (Math.abs(dx) > t.w) continue;
    const lim = Math.max(MINR, d + t.f(dx));
    if (R[i] > lim + 0.0005) { const bark = R[i] > R0 - 0.01; rem += R[i] - lim; R[i] = lim; if (Math.random() < 0.35 + (R[i] - lim) * 20) shaving(xs[i], -lim, bark ? BARK : WOOD); }
  }
  if (rem > 0) { removedNow += rem; dirty = true; }
  return rem;
}
function paintAt(x) {
  let any = 0;
  for (let i = 0; i <= N; i++) if (Math.abs(xs[i] - x) < 0.12 && PC[i] !== paintCol) { PC[i] = paintCol; any++; }
  if (any) { dirty = true; painted += any; if (Math.random() < 0.3) tone(900 + Math.random() * 300, 0.04, 'sine', 0.04, 0.8); }
}
function nextPhase() {
  if (state !== 'play') return;
  if (phase === 'carve') {
    if (m < 0.2) { ui.pop('Carve first!', '#fff', 30, 40); return; }
    phase = 'paint'; chisel.visible = false; brush.visible = true; ghost.visible = false; bTip.material.color.set(PAL[paintCol]);
    [0, 4, 7].forEach((s, i) => setTimeout(() => note(72 + s, 0.2, 0.12), i * 70)); ui.pop('Paint it!', '#fff', 36, 40); renderTools(); return;
  }
  if (phase === 'paint') return finish();
}
goBtn.onclick = nextPhase;
function finish() {
  phase = 'done'; brush.visible = false; goBtn.classList.add('cs-hide'); tools.classList.add('cs-hide'); resultT = 0.001;
  woodMat.roughness = 0.3; woodMat.needsUpdate = true;    // varnish shine
  const pct = Math.round(m * 100), ok = pct >= goal;
  const pts = pct + (painted > 20 ? 10 : 0);
  if (ok) {
    state = 'won'; if (!recorded) { recorded = true; if (!D.seed) F.level(true); }
    total += pts; S.set('score', total);
    const stars = pct >= Math.min(97, goal + 25) ? 3 : pct >= goal + 12 ? 2 : 1;
    setTimeout(() => { confetti(scene, new THREE.Vector3(0, 0.5, 1), 120); [0, 4, 7, 12, 16].forEach((s, i) => setTimeout(() => note(72 + s, 0.3, 0.14), i * 90)); ui.flash(0.35); buzz([20, 40, 20]); }, 300);
    if (!beatenShown && D.beaten(total)) { beatenShown = true; ui.pop('BEATEN!', '#fff', 40, 30); }
    const done = level; if (!D.seed) { level++; S.set('level', level); } sessionLv++;
    D.won(total);
    ui.win(D.seed ? 'DAILY' : done, `${'⭐'.repeat(stars)}  ${pct}% match`);
  } else {
    state = 'lost'; if (!recorded) { recorded = true; if (!D.seed) F.level(false, clamp(pct / goal, 0, 1)); }
    [0, -3, -7].forEach((s, i) => setTimeout(() => note(64 + s, 0.25, 0.12), i * 120));
    ui.lose('TOO ROUGH', `${pct}% match · goal ${goal}%`);
  }
}

// ---------------------------------------------------------------- input (relative drag moves the tool; finger stays clear of it)
let down = false, lx = 0, ly = 0;
const wpp = () => 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360) / innerHeight;
addEventListener('pointerdown', e => { if (state !== 'play') return; audioOn(); down = true; lx = e.clientX; ly = e.clientY; });
addEventListener('pointermove', e => {
  if (!down || state !== 'play') return;
  const k = wpp() * 1.15, dx = (e.clientX - lx) * k, dy = (e.clientY - ly) * k; lx = e.clientX; ly = e.clientY;
  if (phase === 'carve') { cx = clamp(cx + dx, -LEN / 2 + 0.05, LEN / 2 - 0.05); cd = clamp(cd + dy, MINR, 2.2); }
  else if (phase === 'paint') { cx = clamp(cx + dx, -LEN / 2, LEN / 2); cd = clamp(cd + dy, 0, 2.2); }
});
const up = () => { down = false; };
addEventListener('pointerup', up); addEventListener('pointercancel', up);
ui.onTap((which) => { audioOn(); if (which === 'start' && state === 'ready') { state = 'play'; return; } build(); state = 'play'; });

// ---------------------------------------------------------------- loop
let hissV = 0, rebuildT = 0;
loop((dt, t) => {
  spin += (phase === 'done' ? 0.06 : 0.32) * dt; if (wood) { wood.rotation.y = spin; ghost.rotation.y = spin; }
  // carve along the tool's path since last frame
  if (state === 'play' && phase === 'carve') {
    const p = prev || [cx, cd], steps = Math.max(1, Math.ceil(Math.abs(cx - p[0]) / 0.02 + Math.abs(cd - p[1]) / 0.02));
    for (let s = 1; s <= steps; s++) carveAt(lerp(p[0], cx, s / steps), lerp(p[1], cd, s / steps));
    prev = [cx, cd];
  }
  if (state === 'play' && phase === 'paint' && (down || botPhase === 2)) paintAt(cx);
  // tool meshes ease to the target position
  const tg = phase === 'carve' ? chisel : brush, ty = phase === 'carve' ? -cd : -(R[clamp(Math.round((cx + LEN / 2) / LEN * N), 0, N)] + 0.17);
  tg.position.x = lerp(tg.position.x, cx, 0.6); tg.position.y = lerp(tg.position.y, ty, 0.6); tg.position.z = 0.3;
  chisel.rotation.z = Math.sin(t * 40) * (removedNow > 0 ? 0.03 : 0);
  if (dirty && t - rebuildT > 0.03) { rebuildWood(); dirty = false; rebuildT = t; m = match(); ui.progress(m); card.querySelector('[data-m]').textContent = Math.round(m * 100) + '%'; drawCard(); goBtn.classList.toggle('off', phase === 'carve' && m < 0.2);
    const pct = Math.round(m * 100);
    if (phase === 'carve' && pct >= goal && lastPctPop < goal) { ui.pop('GOAL!', '#ffd23f', 40, 34); [0, 4, 7].forEach((s, i) => setTimeout(() => note(76 + s, 0.2, 0.12), i * 60)); buzz(20); }
    if (phase === 'carve' && Math.floor(pct / 10) > Math.floor(lastPctPop / 10) && pct >= 30) note(60 + Math.floor(pct / 10) * 2, 0.15, 0.08);
    lastPctPop = Math.max(lastPctPop, pct);
  }
  // audio: hiss follows how much wood came off this frame
  hissV = lerp(hissV, clamp(removedNow * 6, 0, 0.35), 0.3); removedNow = 0;
  if (hiss) { hiss.gain.value = hissV; hiss.f.frequency.value = 1400 + hissV * 2400; hum.gain.value = state === 'play' ? 0.035 : 0.01; }
  if (hissV > 0.05) buzz(4);
  // shavings
  for (let i = 0; i < SH; i++) {
    const o = sh[i]; if (!o.on) continue;
    if (!o.rest) {
      o.v.y -= 0.004 * dt; o.p.addScaledVector(o.v, dt); o.r.x += o.w.x * dt; o.r.y += o.w.y * dt; o.r.z += o.w.z * dt;
      if (o.p.y < -2.0 && Math.abs(o.p.x) < 4.1 && o.p.z < -0.15) { o.p.y = -1.98 + Math.random() * 0.04; o.rest = true; }
      else if (o.p.y < -2.48) { o.p.y = -2.47 + Math.random() * 0.04; o.rest = true; }
    }
    _q.setFromEuler(o.r); _m.compose(o.p, _q, _s.setScalar(o.on ? o.s : 0)); shIM.setMatrixAt(i, o.on ? _m : Z0);
  }
  shIM.instanceMatrix.needsUpdate = true;
  card.classList.toggle('cs-hide', state === 'ready'); if (state === 'ready') { goBtn.classList.add('cs-hide'); tools.classList.add('cs-hide'); } else if (phase !== 'done' && goBtn.classList.contains('cs-hide')) { goBtn.classList.remove('cs-hide'); tools.classList.remove('cs-hide'); }
  if (resultT > 0) camT = Math.min(1, camT + 0.02 * dt);
  fit();
  sun.position.set(4, 10, 8);
});
build(); ui.start();

// ---------------------------------------------------------------- test hook: sweeps the chisel at a depth that never cuts under the target, then paints
function safeDepth(x) { const t = TIPS[tip]; let d = 0; for (let i = 0; i <= N; i++) { const dx = xs[i] - x; if (Math.abs(dx) <= t.w) d = Math.max(d, T[i] - t.f(dx)); } return Math.max(MINR, d + 0.004); }
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return total; },
  get dbg() { return { phase, m, R: Array.from(R).filter((_, i) => i % 20 === 0).map(v => +v.toFixed(2)), T: Array.from(T).filter((_, i) => i % 20 === 0).map(v => +v.toFixed(2)), goal }; },
  bot() {
    if (state !== 'play') return;
    if (phase === 'carve') {
      tip = 0;
      for (let k = 0; k < 10; k++) { botX += 0.04; if (botX > LEN / 2) break; carveAt(botX, safeDepth(botX)); }
      cx = clamp(botX, -LEN / 2, LEN / 2); cd = safeDepth(cx); prev = [cx, cd];
      if (botX > LEN / 2) nextPhase();
    } else if (phase === 'paint') {
      botPhase = 2; cd = 1.2; paintCol = Math.floor((botX + LEN / 2) / LEN * 3) % PAL.length; bTip.material.color.set(PAL[paintCol]);
      botX -= 0.35; cx = botX; paintAt(cx);
      if (botX < -LEN / 2) { botPhase = 0; nextPhase(); }
    }
  },
};

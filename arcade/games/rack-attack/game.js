// Rack Attack — original top-down 8-ball. Touch the table to aim (guide line + ghost ball), pull the cue in the bottom panel for power, release to shoot.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { canvasTex } from './geo.js';

const S = createStage({ fov: 30, shadowSize: 7 });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.25; hemi.intensity = 1.25;
const ui = createUI({ title: 'RACK<br>ATTACK', hint: 'Touch to aim · pull the cue to shoot', hand: '🎱', score: false });
const save = store('rackattack');
let level = save.get('level', 1);
document.body.style.setProperty('--bg1', '#3b4f8f'); document.body.style.setProperty('--bg2', '#1d2547'); document.body.style.setProperty('--ui', '#ffb627');

// ---------------------------------------------------------------- HUD
const css = document.createElement('style'); css.textContent = `
.ra-hud{position:fixed;top:calc(54px + env(safe-area-inset-top));left:8px;right:8px;display:flex;justify-content:space-between;align-items:center;z-index:6;pointer-events:none}
.ra-p{display:flex;align-items:center;gap:6px;background:rgba(10,14,32,.6);border-radius:14px;padding:4px 8px;border:2px solid transparent;transition:all .25s;min-width:150px}
.ra-p.r{flex-direction:row-reverse}
.ra-p.on{border-color:#ffb627;box-shadow:0 0 14px rgba(255,182,39,.55);transform:scale(1.04)}
.ra-av{width:30px;height:30px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:19px}
.ra-nm{font-weight:800;font-size:13px;line-height:1.05}
.ra-pips{display:flex;gap:2px;margin-top:2px}
.ra-pips b{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.18);position:relative;overflow:hidden}
.ra-pips b.st::after{content:'';position:absolute;left:0;right:0;top:3px;height:5px;background:#fff}
.ra-pips b.gone{opacity:.25}
.ra-vs{font-weight:800;font-size:15px;opacity:.8}
.ra-pow{position:fixed;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom));height:56px;z-index:6;pointer-events:none;background:rgba(10,14,32,.55);border-radius:18px;overflow:hidden;border:2px solid rgba(255,255,255,.15)}
.ra-pow i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#3ddc84,#ffd23f 60%,#ff4d6d)}
.ra-pow .cue{position:absolute;top:24px;height:8px;width:120%;left:22%;border-radius:4px;background:linear-gradient(90deg,#2b1d14 0 8%,#e8c79a 8% 70%,#f6f1e6 70% 98%,#4aa3ff 98%);box-shadow:0 2px 0 rgba(0,0,0,.35);transition:transform .05s}
.ra-pow span{position:absolute;left:0;right:0;top:15px;text-align:center;font-weight:800;font-size:16px;opacity:.85;letter-spacing:1px}
.ra-turn{position:fixed;left:0;right:0;top:calc(104px + env(safe-area-inset-top));text-align:center;z-index:6;pointer-events:none;font-weight:800;font-size:15px;opacity:.9}
.hc-pop{-webkit-text-stroke:6px #1a2040;paint-order:stroke fill}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const hud = H(`<div class="ra-hud"><div class="ra-p" data-p="0"><div class="ra-av">😎</div><div><div class="ra-nm">YOU</div><div class="ra-pips"></div></div></div><div class="ra-vs">VS</div><div class="ra-p r" data-p="1"><div class="ra-av" data-av>🤖</div><div style="text-align:right"><div class="ra-nm" data-nm>REX</div><div class="ra-pips"></div></div></div></div>`);
const pow = H('<div class="ra-pow"><i></i><div class="cue"></div><span>◀ PULL TO SHOOT</span></div>');
const turnEl = H('<div class="ra-turn"></div>');

// ---------------------------------------------------------------- table
const W = 5, L = 10, R = 0.18;
const COLORS = { 1: '#ffc61a', 2: '#2f6bff', 3: '#ff3b3b', 4: '#7b4dff', 5: '#ff8c1a', 6: '#16a85a', 7: '#a3243b', 8: '#16161c' };
const colOf = n => COLORS[n > 8 ? n - 8 : n];
const groupOf = n => n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe';
const POCKETS = [[-W / 2 - 0.06, -L / 2 - 0.06, 0.37], [W / 2 + 0.06, -L / 2 - 0.06, 0.37], [-W / 2 - 0.14, 0, 0.32], [W / 2 + 0.14, 0, 0.32], [-W / 2 - 0.06, L / 2 + 0.06, 0.37], [W / 2 + 0.06, L / 2 + 0.06, 0.37]].map(([x, z, r]) => ({ x, z, r }));
{
  const felt = canvasTex(256, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.62); gr.addColorStop(0, '#36d1c4'); gr.addColorStop(1, '#13867f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.03)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w, h * 0.75); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; for (const y of [0.25, 0.75]) { g.beginPath(); g.arc(w / 2, h * y, 3, 0, 7); g.fill(); }
  });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, L + 0.5), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 }));
  f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
  const cush = mat('#1aa197', { roughness: 0.8 }), wood = glossy('#8b4a2b', { roughness: 0.35 }), trim = glossy('#ffb627', { metalness: 0.4, roughness: 0.3 });
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; scene.add(o); return o; };
  // cushions between pockets
  const cl = L / 2 - 0.42 - 0.33, cw = 0.2;
  for (const s of [-1, 1]) {
    for (const zs of [-1, 1]) add(rounded(cw, 0.2, cl, 0.06), cush, s * (W / 2 + cw / 2 - 0.02), 0.1, zs * (0.33 + cl / 2));
    add(rounded(W - 0.84, 0.2, cw, 0.06), cush, 0, 0.1, s * (L / 2 + cw / 2 - 0.02));
  }
  // wooden frame
  const fw = 0.55, fh = 0.32;
  for (const s of [-1, 1]) {
    add(rounded(fw, fh, L + 0.4 + fw * 2, 0.12), wood, s * (W / 2 + 0.2 + fw / 2), fh / 2, 0);
    add(rounded(W + 0.4, fh, fw, 0.12), wood, 0, fh / 2, s * (L / 2 + 0.2 + fw / 2));
  }
  for (const s of [-1, 1]) for (let i = 1; i < 4; i++) add(new THREE.SphereGeometry(0.05, 8, 6), trim, -W / 2 + i * W / 4, fh, s * (L / 2 + 0.2 + fw / 2));
  for (const s of [-1, 1]) for (const z of [-3 * L / 8, -L / 8, L / 8, 3 * L / 8]) add(new THREE.SphereGeometry(0.05, 8, 6), trim, s * (W / 2 + 0.2 + fw / 2), fh, z);
  // pockets
  const hole = new THREE.MeshBasicMaterial({ color: '#07080c' });
  for (const p of POCKETS) {
    add(new THREE.CylinderGeometry(p.r + 0.02, p.r + 0.02, 0.02, 28), hole, p.x, 0.205, p.z);
    const rim = add(new THREE.TorusGeometry(p.r + 0.06, 0.06, 8, 28, Math.PI * 1.2), trim, p.x, 0.3, p.z);
    rim.rotation.x = -Math.PI / 2; rim.rotation.z = Math.atan2(-p.z, -p.x) + Math.PI - Math.PI * 0.6 + Math.PI;
  }
  // under-table shadow plate + legs silhouette
  const base = add(rounded(W + 2.0, 0.6, L + 2.0, 0.3), mat('#121733'), 0, -0.62, 0); base.castShadow = false;
}

// ---------------------------------------------------------------- balls
function ballTex(n) {
  return canvasTex(256, 128, (g, w, h) => {
    const c = n === 0 ? '#fbf7ee' : colOf(n);
    g.fillStyle = n > 8 ? '#fbf7ee' : c; g.fillRect(0, 0, w, h);
    if (n > 8) { g.fillStyle = c; g.fillRect(0, h * 0.27, w, h * 0.46); }
    if (n === 0) { g.fillStyle = '#ff4d6d'; for (const u of [0.25, 0.75]) { g.beginPath(); g.arc(w * u, h / 2, 6, 0, 7); g.fill(); } return; }
    for (const u of [0.25, 0.75]) {
      g.fillStyle = '#fbf7ee'; g.beginPath(); g.ellipse(w * u, h / 2, 17, 20, 0, 0, 7); g.fill();
      g.fillStyle = '#16161c'; g.font = '800 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w * u, h / 2 + 1);
    }
  });
}
const ballGeo = new THREE.SphereGeometry(R, 28, 18);
const TEX = {}; for (let n = 0; n <= 15; n++) TEX[n] = ballTex(n);
let balls = [];
function makeBall(n, x, z) {
  const m = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ map: TEX[n], roughness: 0.18, metalness: 0.02 }));
  m.castShadow = true; m.position.set(x, R + 0.005, z);
  m.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 + (Math.random() - 0.5) * 0.6, 0, Math.random() * 6));
  if (n === 0) m.quaternion.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
  scene.add(m);
  const b = { n, m, x, z, vx: 0, vz: 0, in: false, sink: 0, px: 0, pz: 0 }; balls.push(b); return b;
}
let cue = null;
const HEAD = { x: 0, z: L / 4 }, FOOT = { x: 0, z: -L / 4 };
function rack() {
  balls.forEach(b => scene.remove(b.m)); balls = [];
  const g = Math.min(7, 1 + level), r = rng(level * 71 + 3);
  const sol = [], str = []; for (let i = 1; i <= g; i++) { sol.push(i); str.push(8 + i); }
  const pool = [...sol, ...str].sort(() => r() - 0.5);
  const total = pool.length + 1, pos = [];
  for (let row = 0; pos.length < total; row++) for (let k = 0; k <= row && pos.length < total; k++) pos.push({ x: (k - row / 2) * R * 2.02, z: FOOT.z - row * R * 1.75 });
  const eightIdx = total >= 6 ? 4 : total - 1;
  let pi = 0;
  pos.forEach((p, i) => makeBall(i === eightIdx ? 8 : pool[pi++], p.x + (r() - 0.5) * 0.004, p.z));
  cue = makeBall(0, HEAD.x, HEAD.z);
}

// ---------------------------------------------------------------- cue stick + guides
const stick = new THREE.Group(); scene.add(stick);
{
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 5.2, 14), glossy('#e8c79a')); s.rotation.x = Math.PI / 2; s.position.z = 2.6 + R + 0.05; s.castShadow = true;
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.072, 1.4, 14), glossy('#2b1d14')); butt.rotation.x = Math.PI / 2; butt.position.z = 4.6 + R; butt.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.061, 0.12, 14), glossy('#ffb627', { metalness: 0.5 })); band.rotation.x = Math.PI / 2; band.position.z = 3.85 + R;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 12), mat('#4aa3ff')); tip.rotation.x = Math.PI / 2; tip.position.z = R + 0.08;
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.037, 0.14, 12), mat('#f6f1e6')); ferr.rotation.x = Math.PI / 2; ferr.position.z = R + 0.17;
  stick.add(s, butt, band, tip, ferr); stick.position.y = R + 0.12;
}
const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
const lineMat2 = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false });
const seg = (m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 1), m); o.renderOrder = 3; scene.add(o); return o; };
const guide = seg(lineMat), objLine = seg(lineMat), cueLine = seg(lineMat2), bounceLine = seg(lineMat2);
const ghost = new THREE.Mesh(new THREE.RingGeometry(R - 0.03, R, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false })); ghost.rotation.x = -Math.PI / 2; ghost.renderOrder = 3; scene.add(ghost);
const ghostFill = new THREE.Mesh(new THREE.CircleGeometry(R - 0.03, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); ghostFill.rotation.x = -Math.PI / 2; scene.add(ghostFill);
function setSeg(o, x0, z0, x1, z1, w = 0.03) { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); o.position.set((x0 + x1) / 2, 0.215, (z0 + z1) / 2); o.scale.set(w, 1, Math.max(0.001, len)); o.rotation.y = Math.atan2(dx, dz); o.visible = len > 0.01; }

// ---------------------------------------------------------------- physics
const XB = W / 2 - R, ZB = L / 2 - R;
const inGapZ = z => Math.abs(z) < 0.36 || Math.abs(z) > L / 2 - 0.44, inGapX = x => Math.abs(x) > W / 2 - 0.44;
let shot = null;
function stepPhysics(dt, set = balls, ctx = null) {
  const live = set.filter(b => !b.in), cb = ctx ? ctx.cue : cue, rec = ctx || shot;
  for (const b of live) {
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0) { const ns = Math.max(0, sp * Math.exp(-0.55 * dt) - 2.6 * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    // cushions
    if (Math.abs(b.x) > XB && !inGapZ(b.z)) { b.x = Math.sign(b.x) * XB; b.vx = -b.vx * 0.78; b.vz *= 0.95; if (!ctx) cushionHit(b); }
    if (Math.abs(b.z) > ZB && !inGapX(b.x)) { b.z = Math.sign(b.z) * ZB; b.vz = -b.vz * 0.78; b.vx *= 0.95; if (!ctx) cushionHit(b); }
    // jaws: never escape the table
    const ox = W / 2 + 0.2, oz = L / 2 + 0.2;
    if (Math.abs(b.x) > ox) { b.x = Math.sign(b.x) * ox; b.vx = -b.vx * 0.5; }
    if (Math.abs(b.z) > oz) { b.z = Math.sign(b.z) * oz; b.vz = -b.vz * 0.5; }
    for (const p of POCKETS) if (Math.hypot(b.x - p.x, b.z - p.z) < p.r) { if (ctx) { b.in = true; b.vx = b.vz = 0; ctx.potted.push(b.n); } else pot(b, p); break; }
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], c = live[j]; if (a.in || c.in) continue;
    const dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 < 4 * R * R && d2 > 1e-9) {
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = 2 * R - d;
      a.x -= nx * ov / 2; a.z -= nz * ov / 2; c.x += nx * ov / 2; c.z += nz * ov / 2;
      const rv = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
      if (rv > 0) {
        const k = rv * (1 + 0.96) / 2;
        a.vx -= k * nx; a.vz -= k * nz; c.vx += k * nx; c.vz += k * nz;
        if (rec && rec.first === null && (a === cb || c === cb)) rec.first = (a === cb ? c : a).n;
        if (rv > 0.3 && !ctx) { tone(1100 + Math.random() * 200, 0.04, 'sine', Math.min(0.16, rv * 0.02), 0.9); }
      }
    }
  }
}
function cushionHit(b) { const s = Math.hypot(b.vx, b.vz); if (s > 0.5) tone(160, 0.05, 'sine', Math.min(0.12, s * 0.012), 0.7); if (shot) shot.rails++; }
function pot(b, p) {
  b.in = true; b.sink = 0.001; b.pocket = p; b.vx = b.vz = 0;
  if (shot) shot.potted.push(b.n);
  burst(scene, new THREE.Vector3(p.x, 0.35, p.z), b.n === 0 ? ['#ffffff'] : [colOf(b.n), '#ffffff', '#ffd23f'], 14, { speed: 0.05, up: 0.06, size: 0.35, shape: 'sphere' });
  tone(330, 0.12, 'sine', 0.14, 0.6); setTimeout(() => tone(180, 0.15, 'triangle', 0.1, 0.6), 60); buzz(12);
}
const moving = () => balls.some(b => !b.in && Math.hypot(b.vx, b.vz) > 0.02);

// ---------------------------------------------------------------- aim prediction
function predict(ox, oz, dx, dz, ignore = null) {
  let best = { t: Infinity, ball: null };
  for (const b of balls) {
    if (b.in || b === cue || b === ignore) continue;
    const fx = b.x - ox, fz = b.z - oz, tca = fx * dx + fz * dz; if (tca < 0) continue;
    const d2 = fx * fx + fz * fz - tca * tca, rr = 4 * R * R; if (d2 > rr) continue;
    const t = tca - Math.sqrt(rr - d2); if (t < best.t) best = { t, ball: b };
  }
  let tw = Infinity, nx = 0, nz = 0;
  if (dx) { const t = ((dx > 0 ? XB : -XB) - ox) / dx; if (t < tw) { tw = t; nx = 1; nz = 0; } }
  if (dz) { const t = ((dz > 0 ? ZB : -ZB) - oz) / dz; if (t < tw) { tw = t; nx = 0; nz = 1; } }
  if (tw < best.t) return { t: tw, ball: null, wall: { nx, nz } };
  return best;
}

// ---------------------------------------------------------------- match state
const RIVALS = [['REX', '🤖'], ['MIA', '🦊'], ['DUKE', '🐻'], ['LUNA', '🐱'], ['ACE', '🐯'], ['ZOE', '🐼'], ['MAX', '🦁']];
let state = 'ready', phase = 'aim', turn = 0, groups = [null, null], aim = -Math.PI / 2, power = 0, pulling = false, pullX = 0, aiPlan = null, aiT = 0, strikeT = 0, pendingShot = null, myPots = 0, combo = 0, msgT = 0, totalGroup = 3;
const aiErr = () => Math.max(0.012, 0.1 - level * 0.012);
function startLevel() {
  rack(); turn = 0; groups = [null, null]; phase = 'aim'; aim = -Math.PI / 2; power = 0; myPots = 0; combo = 0; shot = null; aiPlan = null;
  totalGroup = Math.min(7, 1 + level);
  const rv = RIVALS[(level - 1) % RIVALS.length];
  hud.querySelector('[data-nm]').textContent = rv[0]; hud.querySelector('[data-av]').textContent = rv[1];
  ui.levels(level); ui.progress(0); refreshHud(); say('YOUR BREAK!');
}
function say(t) { turnEl.textContent = t; }
function remaining(gr) { return balls.filter(b => !b.in && groupOf(b.n) === gr).length; }
function refreshHud() {
  for (let p = 0; p < 2; p++) {
    const el = hud.querySelector(`[data-p="${p}"]`); el.classList.toggle('on', turn === p && state === 'play');
    const gr = groups[p], pips = el.querySelector('.ra-pips');
    if (!gr) { pips.innerHTML = Array.from({ length: totalGroup }, () => '<b></b>').join(''); continue; }
    const nums = []; for (let i = 1; i <= totalGroup; i++) nums.push(gr === 'solid' ? i : 8 + i);
    pips.innerHTML = nums.map(n => { const b = balls.find(x => x.n === n); return `<b class="${n > 8 ? 'st' : ''} ${b && b.in ? 'gone' : ''}" style="background:${colOf(n)}"></b>`; }).join('');
  }
  const g = groups[0]; ui.progress(g ? (totalGroup - remaining(g) + (balls.find(b => b.n === 8).in ? 1 : 0)) / (totalGroup + 1) : 0);
}
function shoot(angle, pw) {
  if (phase !== 'aim' && phase !== 'ai') return;
  aim = angle; pendingShot = { angle, pw }; strikeT = 0; phase = 'strike';
}
function doStrike() {
  const { angle, pw } = pendingShot, sp = 2 + pw * 17;
  cue.vx = Math.cos(angle) * sp; cue.vz = Math.sin(angle) * sp;
  shot = { first: null, potted: [], rails: 0, by: turn, clearedBefore: groups[turn] ? remaining(groups[turn]) === 0 : false };
  phase = 'roll'; tone(260, 0.06, 'square', 0.1 * pw + 0.05, 0.5); buzz(10 + pw * 20);
}
function endShot() {
  const s = shot, me = s.by, other = 1 - me; shot = null;
  let gr = groups[me];
  const cueIn = s.potted.includes(0), eightIn = s.potted.includes(8);
  let foul = cueIn || s.first === null;
  if (!foul && s.first !== null) {
    if (gr && !s.clearedBefore && groupOf(s.first) !== gr) foul = true;
    if (gr && s.clearedBefore && s.first !== 8) foul = true;
    if (!gr && s.first === 8) foul = true;
  }
  if (eightIn) { finish(!foul && s.clearedBefore ? me : other, foul || !s.clearedBefore ? (me === 0 ? 'Potted the 8 too early!' : `${hud.querySelector('[data-nm]').textContent} sank the 8 early`) : ''); return; }
  const pottedNon = s.potted.filter(n => n !== 0 && n !== 8);
  if (!gr && !foul && pottedNon.length) { gr = groups[me] = groupOf(pottedNon[0]); groups[other] = gr === 'solid' ? 'stripe' : 'solid'; ui.pop(gr === 'solid' ? 'SOLIDS!' : 'STRIPES!', '#ffd23f', 34, 30); }
  const good = !foul && gr && pottedNon.some(n => groupOf(n) === gr);
  if (me === 0) { const mine = pottedNon.filter(n => groupOf(n) === groups[0]).length; myPots += mine; if (good) { combo++; if (mine) ui.pop(combo > 1 ? `${combo} IN A ROW!` : ['NICE POT!', 'CLEAN!', 'SWEET!'][Math.floor(Math.random() * 3)], '#ffffff', 36, 34); sfx.coin(); } else combo = 0; }
  if (cueIn) { respotCue(); }
  if (foul) { ui.pop(cueIn ? 'SCRATCH!' : 'FOUL!', '#ff4d6d', 38, 40); if (me === 0) sfx.fail(); }
  refreshHud();
  if (!good) turn = other;
  phase = turn === 0 ? 'aim' : 'ai'; aiT = 0; aiPlan = null; power = 0;
  say(turn === 0 ? (foul && me === 1 ? 'FOUL — YOUR SHOT' : 'YOUR TURN') : `${hud.querySelector('[data-nm]').textContent}'S TURN`);
  refreshHud();
}
function respotCue() {
  cue.in = false; cue.sink = 0; cue.m.scale.setScalar(1); cue.m.visible = true;
  let x = HEAD.x, z = HEAD.z;
  for (let k = 0; k < 40 && balls.some(b => b !== cue && !b.in && Math.hypot(b.x - x, b.z - z) < 2.2 * R); k++) { x = (Math.random() - 0.5) * 3; z = L / 4 + (Math.random() - 0.5) * 2; }
  cue.x = x; cue.z = z; cue.vx = cue.vz = 0;
}
function finish(winner, line) {
  phase = 'over';
  if (winner === 0) { state = 'won'; save.set('level', level + 1); sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, 1.5, 0), 90); ui.pop('8-BALL!', '#ffd23f', 52, 30); ui.win(level, `You beat ${hud.querySelector('[data-nm]').textContent}!`); }
  else { state = 'lost'; sfx.fail(); ui.lose('MATCH LOST', line || `${hud.querySelector('[data-nm]').textContent} cleared the table`); }
  refreshHud();
}

// ---------------------------------------------------------------- shot planning (AI + bot)
function clearPath(x0, z0, x1, z1, skip) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 1e-6) return true;
  for (const b of balls) {
    if (b.in || skip.includes(b)) continue;
    const t = clamp(((b.x - x0) * dx + (b.z - z0) * dz) / (len * len), 0, 1), px = x0 + dx * t, pz = z0 + dz * t;
    if (Math.hypot(b.x - px, b.z - pz) < 2 * R + 0.01) return false;
  }
  return true;
}
function plan(who) {
  const c = candidates(who); if (c.length) return c[0];
  const gr = groups[who], cleared = gr && remaining(gr) === 0;
  const targets = balls.filter(b => !b.in && b !== cue && (cleared ? b.n === 8 : gr ? groupOf(b.n) === gr : b.n !== 8));
  let best = null;
  if (!best) {
    // safety: smack the nearest legal ball
    const b = targets.sort((a, c) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(c.x - cue.x, c.z - cue.z))[0] || balls.find(x => !x.in && x !== cue);
    if (b) best = { angle: Math.atan2(b.z - cue.z, b.x - cue.x), pw: 0.55, b, safety: true };
  }
  return best;
}
function candidates(who) {
  const gr = groups[who], cleared = gr && remaining(gr) === 0;
  const targets = balls.filter(b => !b.in && b !== cue && (cleared ? b.n === 8 : gr ? groupOf(b.n) === gr : b.n !== 8));
  const out = [];
  for (const b of targets) for (const p of POCKETS) {
    const px = p.x - Math.sign(p.x) * 0.12, pz = p.z - Math.sign(p.z) * (Math.abs(p.z) > 1 ? 0.12 : 0);
    const ox = px - b.x, oz = pz - b.z, od = Math.hypot(ox, oz), ux = ox / od, uz = oz / od;
    const gx = b.x - ux * 2 * R, gz = b.z - uz * 2 * R;
    const cx = gx - cue.x, cz = gz - cue.z, cd = Math.hypot(cx, cz);
    const cos = (cx * ux + cz * uz) / cd; if (cos < 0.25) continue;
    if (Math.abs(gx) > XB || Math.abs(gz) > ZB) continue;
    // side pockets accept only fairly straight approaches
    if (Math.abs(p.z) < 1 && Math.abs(uz) > 0.75) continue;
    if (!clearPath(cue.x, cue.z, gx, gz, [cue, b]) || !clearPath(b.x, b.z, px, pz, [cue, b])) continue;
    const score = cos * cos / (0.6 + cd * 0.35 + od);
    out.push({ score, angle: Math.atan2(cz, cx), pw: clamp((0.18 + od * 0.08 + cd * 0.045) / Math.max(0.45, cos), 0.25, 0.95), b });
  }
  return out.sort((a, c) => c.score - a.score);
}
/** run a full silent simulation of a shot, return what happened */
function simShot(angle, pw) {
  const set = balls.filter(b => !b.in).map(b => ({ n: b.n, x: b.x, z: b.z, vx: 0, vz: 0, in: false }));
  const c = set.find(b => b.n === 0), sp = 2 + pw * 17; c.vx = Math.cos(angle) * sp; c.vz = Math.sin(angle) * sp;
  const ctx = { cue: c, first: null, potted: [] };
  for (let i = 0; i < 1200 * 8; i++) { stepPhysics(1 / 1200, set, ctx); if (i % 60 === 0 && !set.some(b => !b.in && Math.hypot(b.vx, b.vz) > 0.02)) break; }
  return ctx;
}
function judge(who, r) {
  const gr = groups[who], cleared = gr && remaining(gr) === 0;
  if (r.potted.includes(0) || r.first === null) return -1;
  if (gr && !cleared && groupOf(r.first) !== gr) return -1;
  if (cleared) return r.potted.includes(8) ? 10 : -1;
  if (r.potted.includes(8)) return -5;
  if (!gr && r.first === 8) return -1;
  const own = r.potted.filter(n => n !== 8 && (gr ? groupOf(n) === gr : true)).length;
  return own;
}
function bestSimShot(who) {
  const cs = candidates(who).slice(0, 6);
  let best = null;
  for (const c of cs) for (const k of [1, 0.8, 1.25, 0.6]) for (const da of [0, 0.006, -0.006]) {
    const pw = clamp(c.pw * k, 0.15, 1), sc = judge(who, simShot(c.angle + da, pw));
    if (sc > 0 && (!best || sc > best.sc)) best = { angle: c.angle + da, pw, sc };
    if (best && best.sc >= 1) return best;
  }
  return best;
}

// ---------------------------------------------------------------- input
const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R), hit = new THREE.Vector3();
function aimAt(e) {
  raycaster.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (raycaster.ray.intersectPlane(plane, hit)) { const dx = hit.x - cue.x, dz = hit.z - cue.z; if (Math.hypot(dx, dz) > 0.05) aim = Math.atan2(dz, dx); }
}
const inPow = e => e.clientY > innerHeight - 90;
input({
  onDown: (e) => { if (state !== 'play' || phase !== 'aim') return; if (inPow(e)) { pulling = true; pullX = e.clientX; power = 0; } else aimAt(e); },
  onMove: (dx, dy, e) => { if (state !== 'play' || phase !== 'aim') return; if (pulling) power = clamp((pullX - e.clientX) / (innerWidth * 0.62), 0, 1); else aimAt(e); },
  onUp: () => { if (pulling) { pulling = false; if (power > 0.04 && phase === 'aim' && state === 'play') shoot(aim, power); else power = 0; } },
});
ui.onTap(w => { if (w === 'win') level++; startLevel(); state = 'play'; refreshHud(); });

// ---------------------------------------------------------------- loop
const camTarget = new THREE.Vector3(0, 0, 0.05);
let simAcc = 0;
loop((dtRaw, t) => {
  const real = Math.min(dtRaw / 60, 1 / 30);
  // camera: near top-down with a gentle tilt (3D lit table)
  const aspect = innerWidth / innerHeight, needW = (W + 1.5) / 0.9, vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(needW / 2 / (vt * aspect), (L + 2.2 + 3.2) / 2 / vt);
  camera.position.set(0, dist * 0.996, dist * 0.09 + 0.3); camera.lookAt(camTarget);
  if (state === 'play') {
    if (phase === 'roll') {
      simAcc += real * 2.4; const h = 1 / 1200;
      while (simAcc > h) { stepPhysics(h); simAcc -= h; }
      if (!moving()) { balls.forEach(b => { b.vx = b.vz = 0; }); endShot(); }
    } else if (phase === 'strike') {
      strikeT += real; if (strikeT > 0.09) doStrike();
    } else if (phase === 'ai') {
      aiT += real;
      if (!aiPlan) { aiPlan = plan(1); aiPlan.angle += (Math.random() - 0.5) * 2 * aiErr() * (aiPlan.safety ? 0.5 : 1); aiPlan.from = aim; }
      const k = clamp((aiT - 0.15) / 0.45, 0, 1), e = k * k * (3 - 2 * k);
      let d = aiPlan.angle - aiPlan.from; d = Math.atan2(Math.sin(d), Math.cos(d)); aim = aiPlan.from + d * e;
      power = clamp((aiT - 0.65) / 0.3, 0, 1) * aiPlan.pw;
      if (aiT > 1.0) shoot(aiPlan.angle, aiPlan.pw);
    }
  }
  // balls render + sinking
  for (const b of balls) {
    if (b.in) {
      if (b.sink > 0 && b.sink < 1) { b.sink += real * 3.5; const p = b.pocket; b.x = lerp(b.x, p.x, 0.25); b.z = lerp(b.z, p.z, 0.25); b.m.position.set(b.x, R - b.sink * 0.5, b.z); b.m.scale.setScalar(Math.max(0.01, 1 - b.sink * 0.6)); if (b.sink >= 1) b.m.visible = false; }
      continue;
    }
    const dx = b.x - b.m.position.x, dz = b.z - b.m.position.z, dd = Math.hypot(dx, dz);
    if (dd > 1e-5) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz / dd, 0, -dx / dd), dd / R); b.m.quaternion.premultiply(q); }
    b.m.position.set(b.x, R + 0.005, b.z); b.m.visible = true; b.m.scale.setScalar(1);
  }
  // cue stick + guides
  const showAim = state === 'play' && (phase === 'aim' || phase === 'ai' || phase === 'strike') && !cue.in;
  stick.visible = showAim;
  const dx = Math.cos(aim), dz = Math.sin(aim);
  if (showAim) {
    const pull = phase === 'strike' ? lerp(power * 1.1, -0.05, clamp(strikeT / 0.09, 0, 1)) : power * 1.1 + Math.sin(t * 3) * 0.015;
    stick.position.set(cue.x - dx * pull, R + 0.12, cue.z - dz * pull); stick.rotation.y = Math.atan2(-dx, -dz); stick.rotation.x = 0;
    stick.rotateX(-0.06);
  }
  const showGuide = showAim && (phase === 'aim' || (phase === 'ai' && aiT > 0.3));
  guide.visible = objLine.visible = cueLine.visible = bounceLine.visible = ghost.visible = ghostFill.visible = false;
  if (showGuide) {
    const pr = predict(cue.x, cue.z, dx, dz), t1 = Math.min(pr.t, 14);
    const gx = cue.x + dx * t1, gz = cue.z + dz * t1;
    setSeg(guide, cue.x + dx * R, cue.z + dz * R, gx - dx * R, gz - dz * R);
    ghost.visible = ghostFill.visible = true; ghost.position.set(gx, 0.22, gz); ghostFill.position.set(gx, 0.215, gz);
    if (pr.ball) {
      const nx = (pr.ball.x - gx) / (2 * R), nz = (pr.ball.z - gz) / (2 * R), cosA = dx * nx + dz * nz;
      const ol = 0.35 + 0.9 * cosA;
      setSeg(objLine, pr.ball.x + nx * R, pr.ball.z + nz * R, pr.ball.x + nx * (R + ol), pr.ball.z + nz * (R + ol));
      let tx = dx - cosA * nx, tz = dz - cosA * nz; const tl = Math.hypot(tx, tz);
      if (tl > 0.05) { tx /= tl; tz /= tl; setSeg(cueLine, gx, gz, gx + tx * 0.9 * tl, gz + tz * 0.9 * tl, 0.02); }
      const legal = !groups[turn] ? pr.ball.n !== 8 : (remaining(groups[turn]) === 0 ? pr.ball.n === 8 : groupOf(pr.ball.n) === groups[turn]);
      ghost.material.color.set(legal ? '#ffffff' : '#ff4d6d'); lineMat.color.set(legal ? '#ffffff' : '#ff8fa3');
    } else if (pr.wall) {
      const rx = pr.wall.nx ? -dx : dx, rz = pr.wall.nz ? -dz : dz;
      setSeg(bounceLine, gx, gz, gx + rx * 1.4, gz + rz * 1.4, 0.02); ghost.material.color.set('#ffffff'); lineMat.color.set('#ffffff');
    }
  }
  pow.firstElementChild.style.width = (power * 100) + '%';
  pow.querySelector('.cue').style.transform = `translateX(${-power * 90}px)`;
  pow.style.opacity = state === 'play' && phase === 'aim' ? 1 : 0.35;
  S.followLight(new THREE.Vector3(0, 0, 0));
  sun.position.set(2.5, 16, 4);
});

startLevel(); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
let botPlan = null, botStep = 0;
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return myPots; }, get dbg() { return { phase, turn, groups, balls: balls.map(b => [b.n, +b.x.toFixed(2), +b.z.toFixed(2), +b.vx.toFixed(2), +b.vz.toFixed(2), b.in]) }; },
  bot() {
    if (state !== 'play' || turn !== 0 || phase !== 'aim') { botPlan = null; botStep = 0; return; }
    if (!botPlan) { botStep = 0; botPlan = bestSimShot(0) || (balls.filter(b => !b.in).length === balls.length ? { angle: Math.atan2(FOOT.z - cue.z, FOOT.x - cue.x + 0.02), pw: 0.95 } : plan(0)); }
    botStep++;
    aim = botPlan.angle; power = Math.min(botPlan.pw, botStep * 0.35);
    if (botStep >= 3) { const p = botPlan; botPlan = null; shoot(p.angle, p.pw); }
  },
};
